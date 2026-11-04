/* =========================================================================
   APPOLLO · Inventario: ítems por categoría, entradas de stock, alta/edición/borrado con Deshacer.
   Inventario.descontarAlimento(kg) lo llaman Registrar y Detalle del lote (kg negativo = devolver).
   ========================================================================= */
var VISTAS = window.VISTAS || (window.VISTAS = {});
var ACCIONES = window.ACCIONES || (window.ACCIONES = {});

var Inventario = {
  async descontarAlimento(kg) {
    if (typeof kg !== 'number' || !Number.isFinite(kg)) return;
    const item = (await DB.listar('inventario')).find(i => i.vinculoAlimento === true);
    if (!item) return;
    const nueva = calcularDescuento(item, kg);
    if (nueva === item.cantidad || !Number.isFinite(Number(nueva))) return;
    await DB.guardar('inventario', Object.assign({}, item, { cantidad: nueva }));
  }
};

(function () {
  'use strict';
  const CATS = [['alimento', 'Alimento', 'saco'], ['vacuna', 'Vacunas', 'jeringa'], ['medicamento', 'Medicamentos', 'capsula'], ['otro', 'Otros', 'hoja']];
  const UNIDADES = ['kg', 'sacos', 'dosis', 'frascos', 'unidades', 'litros'];
  const copia = o => JSON.parse(JSON.stringify(o));
  const num = x => formatoNumero(Number(x));
  const bajo = i => Number(i.cantidad) < Number(i.minimo);
  const $c = s => document.querySelector('#capas ' + s);

  function fila(i) {
    const b = bajo(i);
    return `<li class="inv-fila${b ? ' inv-bajo' : ''}" data-item="${esc(i.id)}">
  <div class="inv-info"><b class="inv-nombre">${esc(i.nombre)}</b>
    <span class="inv-cant num">${num(i.cantidad)} ${esc(i.unidad)}</span>
    <span class="inv-min">Mínimo: ${num(i.minimo)} ${esc(i.unidad)}</span></div>
  ${b ? '<span class="chip chip-ambar"><span class="chip-punto" aria-hidden="true"></span>Bajo</span>' : ''}
  <div class="inv-botones">${Boton({ texto: 'Entrada', icono: 'mas', variante: 'primario', accion: 'inv-entrada', datos: { id: i.id } })}
    ${Boton({ texto: 'Editar', variante: 'secundario', accion: 'inv-editar', datos: { id: i.id } })}</div>
</li>`;
  }

  VISTAS.inventario = async function () {
    const items = (await DB.listar('inventario')).sort((a, b) => String(a.nombre).localeCompare(String(b.nombre), 'es'));
    const grupos = CATS.map(([id, tit, ic]) => {
      const l = items.filter(i => (CATS.some(c => c[0] === i.categoria) ? i.categoria : 'otro') === id);
      return l.length ? `<section class="inv-grupo"><h2 class="seccion-titulo">${icono(ic)} ${tit} <span class="num">${formatoNumero(l.length)}</span></h2>
  <ul class="dl-lista">${l.map(fila).join('')}</ul></section>` : '';
    }).join('');
    return `<section class="pantalla"><h1>Inventario</h1>
  ${Boton({ texto: 'Nuevo ítem', icono: 'mas', variante: 'primario', accion: 'inv-nuevo', clase: 'btn-ancho' })}
  ${grupos || '<p class="pantalla-texto">Aún no tienes nada guardado. Agrega tu alimento, vacunas y medicinas para que Appollo te avise cuando se acaben.</p>'}</section>`;
  };

  /* ------------------------------ Entrada de stock ------------------------------ */
  ACCIONES['inv-entrada'] = async el => {
    const i = await DB.obtener('inventario', el.dataset.id);
    if (!i) return;
    App.abrirHoja({ titulo: 'Entrada: ' + i.nombre, contenido: `<div class="inv-form" data-id="${esc(i.id)}">
  <div class="reg-campo"><label class="reg-etiqueta" for="inv-suma">¿Cuánto entró? (${esc(i.unidad)})</label>
  ${Contador({ id: 'inv-suma', valor: 1, min: 0, paso: i.unidad === 'kg' ? 10 : 1, etiqueta: 'Cantidad que entró' })}</div>
  <p class="reg-error" role="alert" hidden></p>
  ${Boton({ texto: 'Guardar entrada', icono: 'saco', variante: 'primario', accion: 'inv-entrada-ok', clase: 'btn-ancho' })}</div>` });
  };
  ACCIONES['inv-entrada-ok'] = async el => {
    const f = el.closest('.inv-form'), suma = Number(f.querySelector('#inv-suma').value), err = f.querySelector('.reg-error');
    if (!Number.isFinite(suma) || suma <= 0) { err.textContent = 'Escribe una cantidad mayor que 0'; err.hidden = false; return; }
    el.disabled = true;
    const i = await DB.obtener('inventario', f.dataset.id);
    if (!i) { App.cerrarHoja(); return; }
    const previo = copia(i);
    await DB.guardar('inventario', Object.assign({}, i, { cantidad: Math.round((Number(i.cantidad) + suma) * 1e6) / 1e6 }));
    App.cerrarHoja(); await App.refrescar();
    App.toast('Entrada guardada', { deshacer: () => DB.guardar('inventario', previo) });
  };

  /* ------------------------------ Formulario ------------------------------ */
  const sel = (id, opts, val) => `<select class="reg-select" id="${id}">${opts.map(([v, t]) => `<option value="${v}"${v === val ? ' selected' : ''}>${esc(t)}</option>`).join('')}</select>`;
  const campo = (id, et, html, cl) => `<div class="reg-campo${cl ? ' ' + cl : ''}"><label class="reg-etiqueta" for="${id}">${et}</label>${html}</div>`;

  function formulario(i) {
    const n = i || { categoria: 'alimento', unidad: 'kg', cantidad: 0, minimo: 0 };
    return `<div class="inv-form" data-id="${esc(n.id || '')}">
  ${campo('inv-nombre', 'Nombre', `<input class="reg-texto" id="inv-nombre" type="text" maxlength="60" autocomplete="off" value="${esc(n.nombre || '')}" placeholder="Ej.: Balanceado postura">`)}
  ${campo('inv-cat', 'Categoría', sel('inv-cat', CATS.map(c => [c[0], c[1]]), n.categoria))}
  ${campo('inv-unidad', 'Unidad', sel('inv-unidad', UNIDADES.map(u => [u, u]), n.unidad))}
  ${campo('inv-kgpu', 'Kilos por saco o unidad', Contador({ id: 'inv-kgpu', valor: n.kgPorUnidad || 40, min: 0, paso: 1, etiqueta: 'Kilos por unidad' }), 'inv-kgpu-c')}
  ${campo('inv-cant', 'Cantidad que tienes', Contador({ id: 'inv-cant', valor: n.cantidad, min: 0, paso: 1, etiqueta: 'Cantidad' }))}
  ${campo('inv-min', 'Avisarme cuando queden menos de', Contador({ id: 'inv-min', valor: n.minimo, min: 0, paso: 1, etiqueta: 'Mínimo' }))}
  ${campo('inv-costo', 'Costo por unidad en dólares (opcional)', `<input class="reg-texto" id="inv-costo" type="text" inputmode="decimal" autocomplete="off" value="${n.costo === undefined || n.costo === null ? '' : esc(String(n.costo).replace('.', ','))}" placeholder="Ej.: 22,50">`)}
  <div class="reg-campo inv-vinculo-c"><button type="button" class="segmento-btn" id="inv-vinculo" data-accion="inv-vinculo" aria-pressed="${n.vinculoAlimento ? 'true' : 'false'}">Descontar al registrar consumo</button></div>
  <p class="reg-error" role="alert" hidden></p>
  ${Boton({ texto: 'Guardar', variante: 'primario', accion: 'inv-guardar', clase: 'btn-ancho' })}
  ${n.id ? `${Boton({ texto: 'Eliminar ítem', variante: 'secundario', accion: 'inv-borrar', clase: 'btn-ancho inv-borrar' })}
  <div class="dl-confirmar inv-confirmar" hidden><p><b>¿Eliminar "${esc(n.nombre)}"?</b> Podrás deshacerlo unos segundos.</p>
    <div class="reg-pregunta-botones">${Boton({ texto: 'Cancelar', variante: 'secundario', accion: 'inv-borrar-no' })}${Boton({ texto: 'Sí, eliminar', variante: 'peligro', accion: 'inv-borrar-si' })}</div></div>` : ''}</div>`;
  }

  function sincronizar() {
    const cat = $c('#inv-cat'), un = $c('#inv-unidad');
    if (!cat || !un) return;
    const ali = cat.value === 'alimento';
    $c('.inv-vinculo-c').hidden = !ali;
    $c('.inv-kgpu-c').hidden = !(ali && un.value !== 'kg');
  }
  function abrirForm(i) {
    const capa = App.abrirHoja({ titulo: i ? 'Editar ítem' : 'Nuevo ítem', contenido: formulario(i) });
    capa.addEventListener('change', sincronizar);
    sincronizar();
  }
  ACCIONES['inv-nuevo'] = () => abrirForm(null);
  ACCIONES['inv-editar'] = async el => { const i = await DB.obtener('inventario', el.dataset.id); if (i) abrirForm(i); };
  ACCIONES['inv-vinculo'] = el => el.setAttribute('aria-pressed', el.getAttribute('aria-pressed') === 'true' ? 'false' : 'true');

  function leer(f) {
    const v = id => f.querySelector('#' + id).value, cat = v('inv-cat'), unidad = v('inv-unidad');
    const nombre = v('inv-nombre').trim(), cant = v('inv-cant').trim(), min = v('inv-min').trim(), costoT = v('inv-costo').trim().replace(',', '.');
    if (!nombre) return { error: 'Escribe el nombre del ítem' };
    if (cant === '' || !Number.isFinite(Number(cant))) return { error: 'Escribe la cantidad que tienes' };
    if (Number(cant) < 0) return { error: 'La cantidad no puede ser menor que 0' };
    if (min === '' || !Number.isFinite(Number(min))) return { error: 'Escribe el mínimo (puede ser 0)' };
    if (Number(min) < 0) return { error: 'El mínimo no puede ser menor que 0' };
    if (costoT !== '' && !(Number.isFinite(Number(costoT)) && Number(costoT) >= 0)) return { error: 'El costo debe ser 0 o más (o déjalo vacío)' };
    const o = { nombre, categoria: cat, unidad, cantidad: Number(cant), minimo: Number(min) };
    if (costoT !== '') o.costo = Number(costoT);
    if (cat === 'alimento') {
      if (unidad !== 'kg') {
        const k = Number(v('inv-kgpu'));
        if (!(Number.isFinite(k) && k > 0)) return { error: 'Escribe cuántos kilos trae cada ' + unidad.replace(/s$/, '') };
        o.kgPorUnidad = k;
      }
      if (f.querySelector('#inv-vinculo').getAttribute('aria-pressed') === 'true') o.vinculoAlimento = true;
    }
    return { datos: o };
  }

  ACCIONES['inv-guardar'] = async el => {
    const f = el.closest('.inv-form'), err = f.querySelector('.reg-error'), r = leer(f);
    if (r.error) { err.textContent = r.error; err.hidden = false; err.scrollIntoView({ block: 'nearest' }); return; }
    el.disabled = true;
    try {
      const todos = await DB.listar('inventario'), id = f.dataset.id;
      const previos = todos.map(copia);
      const actual = id ? todos.find(i => i.id === id) : null;
      const nuevo = Object.assign({}, actual ? { id: actual.id } : {}, r.datos);
      if (r.datos.vinculoAlimento) {
        for (const o of todos) if (o.id !== id && o.vinculoAlimento) { const c = copia(o); delete c.vinculoAlimento; await DB.guardar('inventario', c); }
      }
      const guardado = await DB.guardar('inventario', nuevo);
      App.cerrarHoja(); await App.refrescar();
      App.toast(id ? 'Cambios guardados' : 'Ítem guardado', { deshacer: async () => {
        if (!id) await DB.borrar('inventario', guardado.id);
        for (const p of previos) await DB.guardar('inventario', p);
      } });
    } catch (e) { el.disabled = false; err.textContent = 'No se pudo guardar. Intenta de nuevo.'; err.hidden = false; }
  };

  const confirmar = ver => {
    const c = $c('.inv-confirmar'), b = $c('.inv-borrar');
    if (!c || !b) return;
    c.hidden = !ver; b.hidden = ver;
    if (ver) c.scrollIntoView({ block: 'nearest' });
  };
  ACCIONES['inv-borrar'] = () => confirmar(true);
  ACCIONES['inv-borrar-no'] = () => confirmar(false);
  ACCIONES['inv-borrar-si'] = async el => {
    el.disabled = true;
    const id = el.closest('.inv-form').dataset.id, previo = await DB.obtener('inventario', id);
    if (!previo) { App.cerrarHoja(); App.refrescar(); return; }
    await DB.borrar('inventario', id);
    App.cerrarHoja(); await App.refrescar();
    App.toast('Ítem eliminado', { deshacer: () => DB.guardar('inventario', previo) });
  };
})();
