/* =========================================================================
   APPOLLO · Vista "Alertas": lista por gravedad con acción grande; las vacunas se marcan hechas aquí.
   ========================================================================= */
var VISTAS = window.VISTAS || (window.VISTAS = {});
var ACCIONES = window.ACCIONES || (window.ACCIONES = {});

(function () {
  'use strict';
  const GRAV = {
    rojo: { chip: 'Urgente', clase: 'chip chip-rojo', ic: 'aviso' },
    ambar: { chip: 'Atención', clase: 'chip chip-ambar', ic: 'campana' },
    info: { chip: 'Aviso', clase: 'chip', ic: 'info' }
  };

  async function calcular() {
    const datos = {};
    for (const s of DB.STORES) datos[s] = await DB.listar(s);
    return generarAlertas(datos, new Date());
  }

  function tarjeta(a) {
    const g = GRAV[a.gravedad] || GRAV.info;
    const hecha = a.tipo === 'vacuna' && String(a.id).startsWith('vacuna-');
    const labor = a.tipo === 'plan' && a.tareaId; // la alerta agrupada de atrasadas no lleva Hecho
    return `<li class="al-card al-${esc(a.gravedad)}" data-alerta="${esc(a.id)}">
  <div class="al-cab"><span class="al-icono">${icono(g.ic)}</span><span class="${g.clase}">${a.gravedad === 'info' ? '' : '<span class="chip-punto" aria-hidden="true"></span>'}${g.chip}</span></div>
  <p class="al-texto">${esc(a.texto)}</p>
  <div class="al-botones">
    ${Boton({ texto: a.accion && a.accion.etiqueta || 'Ver', variante: 'primario', accion: 'ir', datos: { ruta: a.accion && a.accion.ruta }, clase: 'btn-ancho' })}
    ${labor ? Boton({ texto: 'Hecho', icono: 'sig', variante: 'secundario', accion: 'al-plan-hecho', datos: { id: a.tareaId }, clase: 'btn-ancho' }) : ''}
    ${hecha ? Boton({ texto: 'Marcar hecha', icono: 'jeringa', variante: 'secundario', accion: 'al-hecha', datos: { id: String(a.id).slice('vacuna-'.length) }, clase: 'btn-ancho' }) : ''}
  </div>
</li>`;
  }

  VISTAS.alertas = async function () {
    const lista = await calcular();
    if (!lista.length) {
      return `<section class="pantalla pantalla-vacia"><div class="vacia-ilustracion" aria-hidden="true">${Ilustracion(ilustracionDe('estado', 'sin-alertas'), { tamano: 'grande' })}</div>
  <h1>Todo en orden</h1><p class="pantalla-texto">No hay nada pendiente. Tus aves y tu inventario van bien.</p></section>`;
    }
    return `<section class="pantalla"><h1>Alertas</h1>
  <p class="pantalla-texto">${formatoNumero(lista.length)} ${lista.length === 1 ? 'aviso' : 'avisos'}, primero lo más urgente.</p>
  <ul class="al-lista">${lista.map(tarjeta).join('')}</ul></section>`;
  };

  /* Foco: tras redibujar (Hecho, Deshacer) vuelve al mismo data-accion/data-id; si esa tarjeta ya no está, a la primera
     acción de la lista o al título; nunca a <body>. */
  let ultimo = null, restaurando = false;
  const cssq = x => (window.CSS && CSS.escape ? CSS.escape(x) : String(x).replace(/["\\]/g, '\\$&'));
  const anotar = e => {
    if (restaurando) return;
    const el = e.target && e.target.closest ? e.target.closest('#view [data-accion]') : null;
    if (el && el.closest('.al-card')) ultimo = { accion: el.dataset.accion || '', id: el.dataset.id || '', ruta: el.dataset.ruta || '' };
  };
  if (typeof document !== 'undefined' && document.addEventListener) {
    document.addEventListener('focusin', anotar, true);
    document.addEventListener('click', anotar, true);
    window.addEventListener('hashchange', () => { ultimo = null; }); // otra pantalla: nada que restaurar
  }
  VISTAS.alertas.montar = raiz => {
    const a = document.activeElement;
    if (!ultimo || location.hash !== '#/alertas' || App.hojaAbierta() || (a && a !== document.body && document.contains(a))) return;
    const q = x => raiz.querySelector(x), cands = [];
    if (ultimo.id) cands.push(q(`[data-accion="${cssq(ultimo.accion)}"][data-id="${cssq(ultimo.id)}"]`));
    cands.push(q('.al-card .btn'), q('h1'));
    restaurando = true;
    try {
      for (const el of cands) {
        if (!el || el.disabled || !el.getClientRects().length) continue;
        if (el.tagName === 'H1') el.tabIndex = -1;
        try { el.focus({ preventScroll: true }); } catch (e) { continue; }
        if (document.activeElement === el) return;
      }
    } finally { restaurando = false; }
  };

  let ocupado = false; // una acción a la vez: un doble toque no duplica la labor hecha
  /* Hecho desde Alertas: una labor común se guarda con un toque (con Deshacer). Un químico NO: abre la hoja del plan
     para anotar el último día de tratamiento (desde ahí se cuenta el retiro), el producto y la etiqueta. */
  ACCIONES['al-plan-hecho'] = async el => {
    if (ocupado) return;
    ocupado = true; // antes de cualquier await: un doble toque no pasa dos veces
    let t = null;
    try { t = await DB.obtener('planTareas', el.dataset.id); } catch (e) { t = null; }
    if (t && t.quimico) { ocupado = false; return PlanCiclo.abrirHecho(t.id); }
    el.disabled = true;
    App.ocultarToast(); // el Deshacer anterior ya no vale
    let r;
    try { r = await Plan.marcarHecha(el.dataset.id); } catch (e) { r = { mensaje: 'No se pudo guardar. Intenta de nuevo.' }; }
    ocupado = false;
    if (r && r.mensaje) { el.disabled = false; App.toast(r.mensaje); return; }
    await App.refrescar();
    App.toast('Labor hecha', typeof r === 'function' ? { deshacer: r } : undefined);
  };

  ACCIONES['al-hecha'] = async el => {
    el.disabled = true;
    let deshacer = null;
    try {
      const v = await DB.obtener('vacunasPlan', el.dataset.id);
      if (!v || v.fechaAplicada) { App.refrescar(); return; }
      deshacer = await Vacunas.aplicar(v);
    } catch (e) { App.toast('No se pudo guardar. Intenta de nuevo.'); el.disabled = false; return; }
    await App.refrescar();
    App.toast('Vacuna aplicada', { deshacer });
  };
})();
