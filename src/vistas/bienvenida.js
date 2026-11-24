/* Appollo · Bienvenida (primera vez, granja sin nombre): 2 pasos → "Crear mi primer lote".
   Guarda granja {nombre, tipo: 'postura'|'carne'|'ambas'} y lleva a #/nuevo-lote. */
var VISTAS = window.VISTAS || (window.VISTAS = {});
var ACCIONES = window.ACCIONES || (window.ACCIONES = {});

(function () {
  'use strict';
  const st = { paso: 1, nombre: '', tipo: '' };
  const TIPOS = [
    { id: 'postura', texto: 'Gallinas de postura', ayuda: 'Para huevos', icono: 'huevo' },
    { id: 'carne', texto: 'Pollos de carne', ayuda: 'Para engorde y venta', icono: 'balanza' },
    { id: 'ambas', texto: 'Las dos', ayuda: 'Huevos y carne', icono: 'gallina' },
  ];
  const $v = s => document.querySelector('#view ' + s);

  function paso1() {
    return `<div class="bv-ilustracion" aria-hidden="true">${Ilustracion(ilustracionDe('estado', 'bienvenida'), { tamano: 'grande' })}</div>
  <p class="eyebrow">Paso 1 de 2</p>
  <h1>Bienvenido a Appollo</h1>
  <p class="pantalla-texto">Lleva el control diario de tus aves, aunque no tengas internet.</p>
  <div class="reg-campo"><label class="reg-etiqueta" for="bv-nombre">¿Cómo se llama tu granja?</label>
    <input class="reg-texto" id="bv-nombre" type="text" autocomplete="organization" enterkeyhint="next" maxlength="60" placeholder="Ej.: Granja San José" value="${esc(st.nombre)}"></div>
  <p class="reg-error bv-error" role="alert" hidden></p>
  ${Boton({ texto: 'Siguiente', icono: 'sig', variante: 'primario', accion: 'bv-siguiente', clase: 'btn-ancho btn-grande' })}`;
  }

  function paso2() {
    return `<p class="eyebrow">Paso 2 de 2</p>
  <h1>¿Qué aves crías?</h1>
  <p class="pantalla-texto">Así te mostramos primero las genéticas que te sirven. Puedes tener lotes de cualquier tipo.</p>
  <div class="reg-opciones" role="group" aria-label="Tipo de granja">${TIPOS.map(t =>
    `<button type="button" class="reg-opcion bv-opcion" data-accion="bv-tipo" data-tipo="${t.id}" aria-pressed="${st.tipo === t.id}">
    ${Ilustracion(ilustracionDe('bienvenida', t.id), { tamano: 'mini' })}<span class="bv-opcion-texto"><b>${t.texto}</b><span>${t.ayuda}</span></span></button>`).join('')}</div>
  <p class="reg-error bv-error" role="alert" hidden></p>
  ${Boton({ texto: 'Crear mi primer lote', icono: 'mas', variante: 'primario', accion: 'bv-crear', clase: 'btn-ancho btn-grande' })}
  ${Boton({ texto: 'Atrás', icono: 'atras', variante: 'secundario', accion: 'bv-atras', clase: 'btn-ancho' })}`;
  }

  const html = () => `<section class="pantalla bienvenida" data-paso="${st.paso}">${st.paso === 1 ? paso1() : paso2()}</section>`;

  function pintar() {
    const s = $v('.bienvenida');
    if (!s) return;
    s.outerHTML = html();
    const foco = st.paso === 1 ? $v('#bv-nombre') : $v('[data-accion=bv-tipo]');
    if (foco) try { foco.focus({ preventScroll: true }); } catch (e) { /* sin foco */ }
  }
  function error(msg) { const p = $v('.bv-error'); if (p) { p.textContent = msg; p.hidden = false; } }

  VISTAS.bienvenida = async function () {
    const g = App.estado.granja || {};
    if (!st.nombre && g.nombre) st.nombre = g.nombre;
    return html();
  };
  VISTAS.bienvenida.montar = function (raiz) {
    raiz.addEventListener('keydown', e => {
      if (e.key === 'Enter' && e.target && e.target.id === 'bv-nombre') { e.preventDefault(); ACCIONES['bv-siguiente'](); }
    });
  };

  ACCIONES['bv-siguiente'] = () => {
    const el = $v('#bv-nombre');
    st.nombre = el ? el.value.trim() : st.nombre;
    if (!st.nombre) { error('Escribe el nombre de tu granja'); if (el) el.focus(); return; }
    st.paso = 2; pintar();
  };
  ACCIONES['bv-atras'] = () => { st.paso = 1; pintar(); };
  ACCIONES['bv-tipo'] = el => {
    st.tipo = el.dataset.tipo;
    document.querySelectorAll('#view [data-accion=bv-tipo]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.tipo === st.tipo)));
    const p = $v('.bv-error'); if (p) p.hidden = true;
  };
  ACCIONES['bv-crear'] = async el => {
    if (!st.tipo) { error('Elige qué aves crías'); return; }
    el.disabled = true;
    try {
      App.estado.granja = await DB.guardar('granja', Object.assign({ id: 'granja', altitud: null, tema: 'auto' },
        App.estado.granja, { nombre: st.nombre, tipo: st.tipo }));
    } catch (e) { el.disabled = false; error('No se pudo guardar. Intenta de nuevo.'); return; }
    st.paso = 1;
    App.ir('#/nuevo-lote');
  };
})();
