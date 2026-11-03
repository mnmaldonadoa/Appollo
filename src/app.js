/* =========================================================================
   APPOLLO 2 · Shell: enrutador por hash, barra inferior, hojas, toast y arranque.
   Contrato de vistas: VISTAS.nombre = async (params) => '<html>' y, opcional,
   VISTAS.nombre.montar = (raiz, params) => {...}. Acciones de clic: ACCIONES[nombre](el, evento)
   para cualquier elemento con data-accion="nombre" (un solo oyente delegado aquí).
   ========================================================================= */
var VISTAS = window.VISTAS || (window.VISTAS = {});
var ACCIONES = window.ACCIONES || (window.ACCIONES = {});

const App = (function () {
  'use strict';
  const K_LOTE = 'appollo.v2.loteActivo';
  const $ = s => document.querySelector(s);
  const lsGet = k => { try { return localStorage.getItem(k); } catch (e) { return null; } };
  const lsSet = (k, v) => { try { if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) { /* sin almacenamiento */ } };
  const estado = { granja: null, loteActivoId: null, modo: null };
  let listo = false, turno = 0;

  /* ------------------------------ Rutas ------------------------------ */
  // Primer segmento del hash -> nombre de vista. Lo demás va en params.
  const ALIAS = { 'nuevo-lote': 'nuevoLote', lote: 'detalleLote', plan: 'planificar' };
  const NAV = { inicio: 'inicio', lotes: 'lotes', nuevoLote: 'lotes', detalleLote: 'lotes', alertas: 'alertas',
    mas: 'mas', inventario: 'mas', reportes: 'mas', ajustes: 'mas', planificar: 'mas' };
  const CONOCIDAS = ['inicio', 'lotes', 'nuevoLote', 'detalleLote', 'alertas', 'mas', 'inventario', 'reportes', 'ajustes', 'planificar'];

  function resolver(hash) {
    const partes = String(hash || '').replace(/^#\/?/, '').split('/').filter(Boolean).map(p => {
      try { return decodeURIComponent(p); } catch (e) { return p; }
    });
    const seg = partes[0] || '';
    const nombre = ALIAS[seg] || seg;
    if (!nombre || !(CONOCIDAS.includes(nombre) || typeof VISTAS[nombre] === 'function')) return null;
    if (nombre === 'detalleLote' && !partes[1]) return null;
    const params = { partes: partes.slice(1) };
    if (nombre === 'detalleLote') params.id = partes[1];
    if (nombre === 'planificar') params.paso = partes[1] || 'genetica';
    return { nombre, params };
  }

  function ir(ruta) {
    cerrarHoja(true);
    const r = String(ruta || '#/inicio');
    if (location.hash === r) render({ animar: true });
    else location.hash = r;
  }

  /* --------------------- Render con captura de errores --------------------- */
  const pendiente = nombre => `<section class="pantalla"><h1>${esc(nombre)}</h1>
  <div class="proximamente">${icono('hoja')}<p>Próximamente: esta pantalla está en camino.</p></div></section>`;
  const fallo = () => `<section class="pantalla vista-error" role="alert">
  <div class="vista-error-icono">${icono('aviso')}</div>
  <h1>Algo salió mal</h1>
  <p>Esta pantalla no se pudo mostrar. Tus datos siguen guardados.</p>
  ${Boton({ texto: 'Volver al inicio', icono: 'inicio', variante: 'primario', accion: 'ir', datos: { ruta: '#/inicio' }, clase: 'btn-ancho' })}
</section>`;

  async function render({ animar } = {}) {
    if (!listo) return;
    const r = resolver(location.hash);
    if (!r) { history.replaceState(null, '', '#/inicio'); return render({ animar }); }
    const mio = ++turno, vista = $('#view');
    marcarNav(NAV[r.nombre] || null);
    let html, montar = null;
    try {
      const fn = VISTAS[r.nombre];
      html = typeof fn === 'function' ? await fn(r.params) : pendiente(r.nombre.charAt(0).toUpperCase() + r.nombre.slice(1));
      if (typeof html !== 'string') throw new Error('La vista ' + r.nombre + ' no devolvió HTML');
      montar = typeof fn === 'function' && typeof fn.montar === 'function' ? fn.montar : null;
    } catch (e) {
      if (mio !== turno) return;
      console.warn('Error de vista', r.nombre, e);
      html = fallo();
    }
    if (mio !== turno) return; // llegó otra navegación mientras esperábamos
    vista.innerHTML = `<div class="vista-raiz${animar && !reducirMovimiento() ? ' pantalla-entra' : ''}">${html}</div>`;
    if (montar) {
      try { await montar(vista.firstElementChild, r.params); } catch (e) {
        if (mio !== turno) return;
        console.warn('Error al montar la vista', r.nombre, e);
        vista.innerHTML = `<div class="vista-raiz">${fallo()}</div>`;
      }
    }
    if (animar) {
      window.scrollTo(0, 0);
      try { vista.focus({ preventScroll: true }); } catch (e) { /* sin foco */ }
    }
  }

  function marcarNav(clave) {
    document.querySelectorAll('#nav [data-nav]').forEach(a => {
      if (a.dataset.nav === clave) a.setAttribute('aria-current', 'page');
      else a.removeAttribute('aria-current');
    });
  }

  /* Vuelve a dibujar la pantalla actual (sin transición) y recalcula las alertas. */
  function refrescar() {
    actualizarAlertas();
    return render({ animar: false });
  }

  /* Cuenta de alertas en la barra: rojas y ámbar (las informativas no suman). */
  async function actualizarAlertas() {
    const ins = $('#nav-insignia');
    if (!ins || typeof generarAlertas !== 'function') return 0;
    let n = 0;
    try {
      const datos = {};
      for (const s of DB.STORES) datos[s] = await DB.listar(s);
      datos.granja = estado.granja;
      n = generarAlertas(datos, new Date()).filter(a => a.gravedad !== 'info').length;
    } catch (e) { n = 0; }
    ins.hidden = !n;
    ins.innerHTML = n ? `${n > 99 ? '99+' : n}<span class="solo-lector"> pendientes</span>` : '';
    return n;
  }

  /* ------------------------------ Lote activo ------------------------------ */
  function fijarLote(id) {
    estado.loteActivoId = id || null;
    lsSet(K_LOTE, id || null);
  }

  /* ------------------------------ Hojas ------------------------------ */
  let hoja = null; // {capa, previo}
  function abrirHoja({ titulo, contenido }) {
    cerrarHoja(true);
    const caja = $('#capas');
    caja.innerHTML = Hoja({ titulo, contenido });
    const capa = caja.firstElementChild, sec = capa.querySelector('.hoja');
    sec.setAttribute('tabindex', '-1');
    hoja = { capa, previo: document.activeElement };
    ['#view', '#nav', '#franjas'].forEach(s => { const el = $(s); if (el) el.inert = true; });
    try { sec.focus({ preventScroll: true }); } catch (e) { /* sin foco */ }
    return capa;
  }
  function cerrarHoja(inmediato) {
    if (!hoja) return;
    const { capa, previo } = hoja;
    hoja = null;
    ['#view', '#nav', '#franjas'].forEach(s => { const el = $(s); if (el) el.inert = false; });
    const quitar = () => { capa.remove(); };
    if (inmediato || reducirMovimiento()) quitar();
    else { capa.classList.add('cerrando'); setTimeout(quitar, 220); }
    if (previo && document.contains(previo) && typeof previo.focus === 'function') {
      try { previo.focus({ preventScroll: true }); } catch (e) { /* sin foco */ }
    }
  }
  const hojaAbierta = () => (hoja ? hoja.capa : null);

  /* ------------------------------ Toast ------------------------------ */
  let toastT = 0;
  function toast(msg, opciones) {
    const t = $('#toast'), deshacer = opciones && typeof opciones.deshacer === 'function' ? opciones.deshacer : null;
    const ms = deshacer ? 5000 : 2600;
    clearTimeout(toastT);
    t.innerHTML = `<span class="toast-texto">${esc(msg)}</span>` +
      (deshacer ? Boton({ texto: 'Deshacer', variante: 'secundario', accion: 'deshacer' }) : '') +
      (deshacer && !reducirMovimiento() ? `<span class="toast-tiempo" aria-hidden="true" style="animation-duration:${ms}ms"></span>` : '');
    t.hidden = false;
    t._deshacer = deshacer;
    toastT = setTimeout(ocultarToast, ms);
  }
  function ocultarToast() { const t = $('#toast'); clearTimeout(toastT); t.hidden = true; t.innerHTML = ''; t._deshacer = null; }

  ACCIONES.deshacer = async () => {
    const fn = $('#toast')._deshacer;
    ocultarToast();
    if (!fn) return;
    try { await fn(); toast('Se deshizo el cambio'); } catch (e) { toast('No se pudo deshacer'); }
    refrescar();
  };
  ACCIONES.ir = el => ir(el.dataset.ruta || '#/inicio');
  ACCIONES['nuevo-lote'] = () => ir('#/nuevo-lote');
  ACCIONES['cerrar-hoja'] = () => cerrarHoja();
  ACCIONES['contador-mas'] = el => ajustarContador(el.dataset.para, 1);
  ACCIONES['contador-menos'] = el => ajustarContador(el.dataset.para, -1);
  ACCIONES.registrar = () => { if (typeof Registrar !== 'undefined') Registrar.abrir(); };

  /* ------------------------------ Franjas ------------------------------ */
  function franjaRed() { const f = $('#franja-offline'); if (f) f.hidden = navigator.onLine !== false; }

  /* ------------------------------ Arranque ------------------------------ */
  async function arrancar() {
    // Se mira antes de cualquier espera: solo se migra si ya había datos de la v1.
    const legado = lsGet('appollo.v1.lotes') !== null;
    document.addEventListener('click', e => {
      const el = e.target.closest('[data-accion]');
      if (!el || el.disabled) return;
      const fn = ACCIONES[el.dataset.accion];
      if (typeof fn === 'function') { e.preventDefault(); fn(el, e); }
    });
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && hoja) { e.preventDefault(); cerrarHoja(); } });
    window.addEventListener('hashchange', () => { cerrarHoja(true); render({ animar: true }); });
    window.addEventListener('online', franjaRed);
    window.addEventListener('offline', franjaRed);
    franjaRed();

    try { estado.modo = (await DB.abrir()).modo; } catch (e) { estado.modo = 'memoria'; }
    if (estado.modo === 'memoria') $('#franja-memoria').hidden = false;
    if (legado) { try { await DB.migrarLS(); } catch (e) { /* la app sigue sin migrar */ } }
    try {
      estado.granja = await DB.obtener('granja', 'granja') ||
        await DB.guardar('granja', { id: 'granja', nombre: '', tipo: '', altitud: null, tema: 'auto', creado: new Date().toISOString() });
    } catch (e) { estado.granja = { id: 'granja', nombre: '', tipo: '', altitud: null, tema: 'auto' }; }
    try {
      const activos = await DB.listar('lotes', { estado: 'activo' });
      const rec = lsGet(K_LOTE);
      estado.loteActivoId = activos.some(l => l.id === rec) ? rec : activos.length === 1 ? activos[0].id : null;
    } catch (e) { estado.loteActivoId = null; }

    listo = true;
    if (!resolver(location.hash)) history.replaceState(null, '', '#/inicio');
    await render({ animar: true });
    actualizarAlertas();
  }

  return { ir, estado, refrescar, toast, actualizarAlertas, abrirHoja, cerrarHoja, hojaAbierta, fijarLote, arrancar };
})();

App.arrancar();
