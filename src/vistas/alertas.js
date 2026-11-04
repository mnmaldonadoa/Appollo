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
    return `<li class="al-card al-${esc(a.gravedad)}" data-alerta="${esc(a.id)}">
  <div class="al-cab"><span class="al-icono">${icono(g.ic)}</span><span class="${g.clase}">${a.gravedad === 'info' ? '' : '<span class="chip-punto" aria-hidden="true"></span>'}${g.chip}</span></div>
  <p class="al-texto">${esc(a.texto)}</p>
  <div class="al-botones">
    ${Boton({ texto: a.accion && a.accion.etiqueta || 'Ver', variante: 'primario', accion: 'ir', datos: { ruta: a.accion && a.accion.ruta }, clase: 'btn-ancho' })}
    ${hecha ? Boton({ texto: 'Marcar hecha', icono: 'jeringa', variante: 'secundario', accion: 'al-hecha', datos: { id: String(a.id).slice('vacuna-'.length) }, clase: 'btn-ancho' }) : ''}
  </div>
</li>`;
  }

  VISTAS.alertas = async function () {
    const lista = await calcular();
    if (!lista.length) {
      return `<section class="pantalla pantalla-vacia"><div class="vacia-ilustracion" aria-hidden="true">${icono('escudo')}</div>
  <h1>Todo en orden</h1><p class="pantalla-texto">No hay nada pendiente. Tus aves y tu inventario van bien.</p></section>`;
    }
    return `<section class="pantalla"><h1>Alertas</h1>
  <p class="pantalla-texto">${formatoNumero(lista.length)} ${lista.length === 1 ? 'aviso' : 'avisos'}, primero lo más urgente.</p>
  <ul class="al-lista">${lista.map(tarjeta).join('')}</ul></section>`;
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
