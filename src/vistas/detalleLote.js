/* =========================================================================
   APPOLLO · Detalle de lote: resumen, gráfica real vs proyectado, historial (Borrar + Deshacer),
   calendario de vacunas (Marcar aplicada + Deshacer) y Cerrar / Reabrir lote.
   ========================================================================= */
var VISTAS = window.VISTAS || (window.VISTAS = {});
var ACCIONES = window.ACCIONES || (window.ACCIONES = {});

(function () {
  'use strict';
  const PAGINA = 30, limites = {};
  const fin = x => (Number.isFinite(x) ? x : null);
  const r1 = x => (x === null ? null : Math.round(x * 10) / 10);
  const masDias = (f, n) => { const d = fechaADate(f); d.setDate(d.getDate() + n); return hoyLocal(d); };
  const fechaTxt = f => (typeof f === 'string' && f.length >= 10 ? f.slice(8, 10) + '/' + f.slice(5, 7) + '/' + f.slice(0, 4) : '—');
  const n = x => (Number.isFinite(Number(x)) ? formatoNumero(Number(x)) : '—');
  const copia = o => JSON.parse(JSON.stringify(o));
  const TIPO = { mortalidad: ['Mortalidad', 'cruz'], alimento: ['Alimento', 'saco'], huevos: ['Huevos', 'huevo'],
    peso: ['Peso', 'balanza'], vacuna: ['Vacuna', 'jeringa'], sanidad: ['Sanidad', 'termo'], plan: ['Labor', 'hoja'] };

  function valorReg(r) {
    const d = r.datos || {};
    switch (r.tipo) {
      case 'mortalidad': return `${n(d.cantidad)} ${Number(d.cantidad) === 1 ? 'ave' : 'aves'}${d.causa ? ' · ' + d.causa : ''}`;
      case 'alimento': return `${n(d.kg)} kg`;
      case 'huevos': return `${n(d.cantidad)} huevos${Number(d.rotos) > 0 ? ' · ' + n(d.rotos) + ' rotos' : ''}`;
      case 'peso': return `${n(d.gramos)} g por ave`;
      case 'vacuna': return d.nombre || 'Vacuna';
      case 'plan': return d.titulo || 'Labor del plan';
      case 'sanidad': return [d.enfermedad, d.tratamiento].filter(Boolean).join(' · ') + (Number(d.retiroDias) > 0 ? ` · retiro ${n(d.retiroDias)} días` : '');
    }
    return '';
  }

  /* Real vs proyectado desde la llegada (máx. 60 días) hasta hoy o el cierre. */
  function grafica(l, regs, res, hasta, alt) {
    if (!res.ok) return Grafico({});
    const carne = modoDe(res.g) === 'carne', desde = [l.fechaLlegada, masDias(hasta, -59)].sort().pop(), dias = [];
    for (let f = desde; f <= hasta; f = masDias(f, 1)) dias.push(f);
    const real = [], est = [];
    for (const f of dias) {
      const e = estandarDia(l, f, alt, Math.max(0, avesVivas(l, regs, f)));
      if (carne) {
        const p = regs.filter(r => r.tipo === 'peso' && r.fecha === f).pop();
        real.push(p ? fin(Number(p.datos.gramos)) : null); est.push(r1(fin(e.pesoG)));
      } else { real.push(r1(fin(pctPostura(l, regs, f)))); est.push(r1(fin(e.hdPct))); }
    }
    return Grafico({ serieReal: real, serieEstandar: est, etiquetas: dias.map(f => f.slice(8, 10) + '/' + f.slice(5, 7)) });
  }

  function vacunaHtml(v, hoy, activo) {
    let chip = ['verde', 'Aplicada ' + fechaTxt(v.fechaAplicada)];
    if (!v.fechaAplicada) chip = v.fechaPrevista < hoy ? ['rojo', 'Vencida'] : v.fechaPrevista === hoy ? ['ambar', 'Hoy']
      : v.fechaPrevista === masDias(hoy, 1) ? ['ambar', 'Mañana'] : ['', 'Prevista'];
    return `<li class="dl-vac${v.fechaAplicada ? ' dl-vac-hecha' : ''}">
  <div class="dl-fila-texto"><b>${esc(v.nombre)}</b><span>${esc(fechaTxt(v.fechaPrevista))}${v.via ? ' · ' + esc(v.via) : ''}</span></div>
  <span class="chip${chip[0] ? ' chip-' + chip[0] : ''}">${chip[0] ? '<span class="chip-punto" aria-hidden="true"></span>' : ''}${esc(chip[1])}</span>
  ${!v.fechaAplicada && activo ? Boton({ texto: 'Marcar aplicada', icono: 'jeringa', variante: 'secundario', accion: 'dl-aplicar', datos: { id: v.id }, clase: 'btn-ancho' }) : ''}
</li>`;
  }

  VISTAS.detalleLote = async function (params) {
    const l = await DB.obtener('lotes', params.id);
    if (!l) {
      return `<section class="pantalla pantalla-vacia"><div class="vacia-ilustracion" aria-hidden="true">${ilustracion('campo')}</div>
  <h1>Este lote no existe</h1><p class="pantalla-texto">Quizá fue borrado o el enlace está mal.</p>
  ${Boton({ texto: 'Ver mis lotes', icono: 'lotes', variante: 'primario', accion: 'ir', datos: { ruta: '#/lotes' }, clase: 'btn-ancho' })}</section>`;
    }
    const [regs, vacs] = await Promise.all([DB.listar('registros', { loteId: l.id }), DB.listar('vacunasPlan', { loteId: l.id })]);
    const hoy = hoyLocal(), activo = l.estado === 'activo', hasta = activo ? hoy : (l.fechaCierre || hoy);
    const alt = App.estado.granja && App.estado.granja.altitud;
    const res = resumenLote(l, regs, vacs, hasta), mort = res.ok ? fin(mortalidadPct(l, regs, hasta)) : null;
    const carne = res.ok && modoDe(res.g) === 'carne';
    const orden = regs.slice().sort((a, b) => (b.fecha + (b.creado || '')).localeCompare(a.fecha + (a.creado || '')));
    const lim = limites[l.id] || PAGINA;
    const pend = vacs.filter(v => !v.fechaAplicada).sort((a, b) => String(a.fechaPrevista).localeCompare(String(b.fechaPrevista)));
    const hechas = vacs.filter(v => v.fechaAplicada).sort((a, b) => String(b.fechaAplicada).localeCompare(String(a.fechaAplicada)));
    const dato = (t, v) => `<div class="dl-dato"><span>${t}</span><b class="num">${v}</b></div>`;
    return `<section class="pantalla detalle-lote">
  ${Boton({ texto: 'Lotes', icono: 'atras', variante: 'secundario', accion: 'ir', datos: { ruta: '#/lotes' }, clase: 'dl-volver' })}
  <header class="dl-cab">
    <p class="eyebrow">${activo ? 'Lote activo' : 'Lote cerrado' + (l.fechaCierre ? ' el ' + esc(fechaTxt(l.fechaCierre)) : '')}</p>
    <h1>${esc(l.nombre || 'Lote')}</h1>
    <p class="pantalla-texto">${esc(res.g ? res.g.nombre : l.genetica || 'Genética desconocida')}${l.galpon ? ' · ' + esc(l.galpon) : ''} · llegó el ${esc(fechaTxt(l.fechaLlegada))}</p>
    ${activo ? chipEstado(res.estado) : ''}
  </header>
  <div class="dl-datos">
    ${dato('Aves vivas', res.vivas === null ? '—' : formatoNumero(res.vivas) + ' / ' + n(l.avesInicio))}
    ${dato('Edad', esc(textoEdad(res.edad)))}
    ${dato('Mortalidad', mort === null ? '—' : formatoNumero(r1(mort)) + ' %')}
    ${dato('Registros', formatoNumero(regs.length))}
  </div>
  ${l.resumen ? `<p class="pantalla-texto">${esc(l.resumen)}</p>` : ''}
  <article class="tarjeta" data-t="grafica"><header class="tarjeta-cab"><h2 class="tarjeta-titulo">${carne ? 'Peso (g)' : '% de postura'}: real vs proyectado</h2></header>${grafica(l, regs, res, hasta, alt)}</article>
  <h2 class="seccion-titulo">Historial</h2>
  ${orden.length ? `<ul class="dl-lista">${orden.slice(0, lim).map(r => {
    const t = TIPO[r.tipo] || [r.tipo, 'hoja'];
    return `<li class="dl-reg"><span class="dl-icono">${icono(t[1])}</span><div class="dl-fila-texto"><b>${r.tipo === 'plan' ? esc(t[0] + ': ' + valorReg(r)) : esc(t[0] + ' · ' + valorReg(r))}</b><span>${esc(fechaTxt(r.fecha))}</span></div>
  ${Boton({ texto: 'Borrar', variante: 'secundario', accion: 'dl-borrar', datos: { id: r.id }, clase: 'dl-borrar' })}</li>`;
  }).join('')}</ul>${orden.length > lim ? Boton({ texto: `Ver más (${formatoNumero(orden.length - lim)})`, variante: 'secundario', accion: 'dl-mas', datos: { id: l.id }, clase: 'btn-ancho' }) : ''}`
    : '<p class="pantalla-texto">Aún no hay registros. Usa ＋ Registrar en la barra de abajo.</p>'}
  <h2 class="seccion-titulo">Calendario de vacunas</h2>
  ${vacs.length ? `${pend.length ? `<ul class="dl-lista">${pend.slice(0, 3).map(v => vacunaHtml(v, hoy, activo)).join('')}</ul>` : '<p class="pantalla-texto">No quedan vacunas pendientes.</p>'}
  ${pend.length > 3 ? `<details class="dl-hechas"><summary>Siguientes vacunas (${formatoNumero(pend.length - 3)})</summary><ul class="dl-lista">${pend.slice(3).map(v => vacunaHtml(v, hoy, activo)).join('')}</ul></details>` : ''}
  ${hechas.length ? `<details class="dl-hechas"><summary>Aplicadas (${formatoNumero(hechas.length)})</summary><ul class="dl-lista">${hechas.map(v => vacunaHtml(v, hoy, activo)).join('')}</ul></details>` : ''}`
    : '<p class="pantalla-texto">Este lote no tiene vacunas previstas.</p>'}
  ${l.planV1 ? `<div class="dl-plan"><p class="pantalla-texto">Este lote viene de una proyección guardada en la versión 1 de Appollo.</p>
  ${Boton({ texto: 'Abrir en Planificador', icono: 'grafico', variante: 'secundario', accion: 'dl-abrir-plan', datos: { id: l.id }, clase: 'btn-ancho' })}</div>` : ''}
  <div class="dl-cierre">
  ${activo ? `${Boton({ texto: 'Cerrar lote', variante: 'secundario', accion: 'dl-cerrar', clase: 'btn-ancho dl-cerrar' })}
  <div class="dl-confirmar" hidden><p><b>¿Cerrar este lote?</b> Ya no aparecerá en Inicio ni en el registro rápido. Sus datos se conservan y puedes reabrirlo.</p>
    <div class="reg-pregunta-botones">${Boton({ texto: 'Cancelar', variante: 'secundario', accion: 'dl-cerrar-no' })}${Boton({ texto: 'Sí, cerrar lote', variante: 'peligro', accion: 'dl-cerrar-si', datos: { id: l.id } })}</div></div>`
    : Boton({ texto: 'Reabrir lote', variante: 'primario', accion: 'dl-reabrir', datos: { id: l.id }, clase: 'btn-ancho' })}
  </div>
  <div class="dl-borrar-lote">
  ${Boton({ texto: 'Borrar lote', icono: 'cruz', variante: 'secundario', accion: 'dl-borrar-lote', clase: 'btn-ancho dl-borrar-lote-btn' })}
  <div class="dl-confirmar-borrar" hidden><p><b>¿Borrar este lote?</b> Se borran también sus ${formatoNumero(regs.length)} registros y ${formatoNumero(vacs.length)} vacunas. No se puede deshacer.</p>
    <div class="reg-pregunta-botones">${Boton({ texto: 'Cancelar', variante: 'secundario', accion: 'dl-borrar-lote-no' })}${Boton({ texto: 'Sí, borrar lote', variante: 'peligro', accion: 'dl-borrar-lote-si', datos: { id: l.id } })}</div></div>
  </div>
</section>`;
  };

  /* ------------------------------ Acciones ------------------------------ */
  /* Aplica kg al inventario vinculado; devuelve los kg realmente aplicados (0 si no hay ítem o falla). */
  async function inventario(kg) {
    if (!(Number.isFinite(kg) && kg !== 0) || typeof Inventario === 'undefined' || !Inventario || typeof Inventario.descontarAlimento !== 'function') return 0;
    try { const r = await Inventario.descontarAlimento(kg); return Number(r && r.aplicadoKg) || 0; } catch (e) { return 0; }
  }
  async function hacer(fn, msg, deshacer) {
    try { await fn(); } catch (e) { App.toast('No se pudo guardar. Intenta de nuevo.'); return; }
    await App.refrescar();
    App.toast(msg, deshacer ? { deshacer } : undefined);
  }

  /* Marca una vacuna del plan como aplicada hoy y crea su registro. Devuelve la función que lo revierte.
     Compartida con la vista de Alertas (Vacunas.aplicar). */
  window.Vacunas = {
    async aplicar(v) {
      const previo = copia(v), hoy = hoyLocal();
      const nuevo = await DB.guardar('registros', { loteId: v.loteId, fecha: hoy, tipo: 'vacuna',
        datos: { nombre: v.nombre, via: v.via || '', planId: v.id }, creado: new Date().toISOString() });
      await DB.guardar('vacunasPlan', Object.assign({}, v, { fechaAplicada: hoy }));
      return async () => { await DB.borrar('registros', nuevo.id); await DB.guardar('vacunasPlan', previo); };
    }
  };

  ACCIONES['dl-borrar'] = async el => {
    el.disabled = true;
    const r = await DB.obtener('registros', el.dataset.id);
    if (!r) { App.refrescar(); return; }
    const previo = copia(r), kg = r.tipo === 'alimento' ? Number(r.datos && r.datos.descontadoKg) || 0 : 0;
    const plan = r.tipo === 'vacuna' && r.datos && r.datos.planId ? await DB.obtener('vacunasPlan', r.datos.planId) : null;
    const planPrevio = plan ? copia(plan) : null;
    const tarea = r.tipo === 'plan' && r.datos && r.datos.tareaId ? await DB.obtener('planTareas', r.datos.tareaId) : null;
    const tareaPrevia = tarea ? copia(tarea) : null;
    await hacer(async () => {
      await DB.borrar('registros', r.id);
      if (tarea) { // la labor ya no consta como hecha
        const t = copia(tarea), i = (t.hechas || []).findIndex(h => h.fecha === r.fecha);
        if (i >= 0) t.hechas.splice(i, 1);
        await DB.guardar('planTareas', t);
      }
      if (plan) { const p = copia(plan); delete p.fechaAplicada; await DB.guardar('vacunasPlan', p); }
      await inventario(-kg);
    }, 'Registro borrado', async () => {
      await DB.guardar('registros', previo);
      if (planPrevio) await DB.guardar('vacunasPlan', planPrevio);
      if (tareaPrevia) await DB.guardar('planTareas', tareaPrevia);
      const ap = await inventario(kg);
      if (kg && ap !== kg) await DB.guardar('registros', Object.assign({}, previo, { datos: Object.assign({}, previo.datos, { descontadoKg: ap }) }));
    });
  };

  ACCIONES['dl-aplicar'] = async el => {
    el.disabled = true;
    const v = await DB.obtener('vacunasPlan', el.dataset.id);
    if (!v || v.fechaAplicada) { App.refrescar(); return; }
    let deshacer = null;
    await hacer(async () => { deshacer = await Vacunas.aplicar(v); }, 'Vacuna aplicada', () => deshacer());
  };

  ACCIONES['dl-mas'] = el => { limites[el.dataset.id] = (limites[el.dataset.id] || PAGINA) + PAGINA; App.refrescar(); };
  const confirmar = ver => {
    const c = document.querySelector('#view .dl-confirmar'), b = document.querySelector('#view .dl-cerrar');
    if (!c || !b) return;
    c.hidden = !ver; b.hidden = ver;
    const foco = ver ? c.querySelector('[data-accion=dl-cerrar-no]') : b;
    try { foco.focus({ preventScroll: true }); } catch (e) { /* sin foco */ }
    if (ver) c.scrollIntoView({ block: 'nearest' });
  };
  ACCIONES['dl-cerrar'] = () => confirmar(true);
  ACCIONES['dl-cerrar-no'] = () => confirmar(false);

  async function cambiarEstado(id, cerrar) {
    const l = await DB.obtener('lotes', id);
    if (!l) return;
    const previo = copia(l), nuevo = copia(l);
    if (cerrar) { nuevo.estado = 'cerrado'; nuevo.fechaCierre = hoyLocal(); } else { nuevo.estado = 'activo'; delete nuevo.fechaCierre; }
    const lsPrevio = App.estado.loteActivoId;
    await hacer(async () => {
      await DB.guardar('lotes', nuevo);
      if (cerrar && App.estado.loteActivoId === id) App.fijarLote(null);
    }, cerrar ? 'Lote cerrado' : 'Lote reabierto', async () => {
      await DB.guardar('lotes', previo);
      if (cerrar && lsPrevio === id) App.fijarLote(id);
    });
  }
  /* Borrar lote (con confirmación): también sirve para los lotes migrados de la v1. */
  const confirmarBorrar = ver => {
    const c = document.querySelector('#view .dl-confirmar-borrar'), b = document.querySelector('#view .dl-borrar-lote-btn');
    if (!c || !b) return;
    c.hidden = !ver; b.hidden = ver;
    const foco = ver ? c.querySelector('[data-accion=dl-borrar-lote-no]') : b;
    try { foco.focus({ preventScroll: true }); } catch (e) { /* sin foco */ }
    if (ver) c.scrollIntoView({ block: 'nearest' });
  };
  ACCIONES['dl-borrar-lote'] = () => confirmarBorrar(true);
  ACCIONES['dl-borrar-lote-no'] = () => confirmarBorrar(false);
  ACCIONES['dl-borrar-lote-si'] = async el => {
    el.disabled = true;
    const id = el.dataset.id;
    try {
      const [regs, vacs] = await Promise.all([DB.listar('registros', { loteId: id }), DB.listar('vacunasPlan', { loteId: id })]);
      for (const r of regs) await DB.borrar('registros', r.id);
      for (const v of vacs) await DB.borrar('vacunasPlan', v.id);
      await Plan.borrarDeLote(id);
      await DB.borrar('lotes', id);
      if (App.estado.loteActivoId === id) App.fijarLote(null);
    } catch (e) { el.disabled = false; App.toast('No se pudo borrar. Intenta de nuevo.'); return; }
    App.toast('Lote borrado');
    App.actualizarAlertas();
    App.ir('#/lotes');
  };

  /* Restaura en el Planificador la proyección que el lote guardó en la v1 (mismo estado que usa el Planificador). */
  ACCIONES['dl-abrir-plan'] = async el => {
    const l = await DB.obtener('lotes', el.dataset.id);
    if (!l || !l.planV1 || typeof PlanEstado === 'undefined') return;
    const P = PlanEstado;
    Object.assign(P.S, P.BASE, { filtro: P.S.filtro }, copia(l.planV1));
    if (!Array.isArray(P.S.sel)) P.S.sel = [];
    P.guardar();
    App.ir(P.loteValido() ? '#/plan/proyeccion' : '#/plan/genetica');
  };

  ACCIONES['dl-cerrar-si'] = el => { el.disabled = true; return cambiarEstado(el.dataset.id, true); };
  ACCIONES['dl-reabrir'] = el => { el.disabled = true; return cambiarEstado(el.dataset.id, false); };
})();
