/* Appollo · Componentes de interfaz. Cada función devuelve una cadena HTML.
   Todo texto dinámico pasa por esc(); `contenido` de Hoja es HTML ya armado por otros componentes. */

function esc(s) {
  if (s === null || s === undefined) return '';
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/* Número con formato local (1.234,5). Lo usa también contar() para que la cifra final coincida. */
function formatoNumero(n, decimales) {
  const v = Number(n);
  if (!Number.isFinite(v)) return '';
  const d = decimales === undefined ? (Number.isInteger(v) ? 0 : Math.min(2, (String(v).split('.')[1] || '').length)) : decimales;
  return v.toLocaleString('es-EC', { minimumFractionDigits: d, maximumFractionDigits: d });
}

/* Ícono del sprite (body.html). Siempre decorativo: el componente lo acompaña con texto. */
function icono(nombre, clase) {
  if (!nombre) return '';
  return `<svg class="ic${clase ? ' ' + esc(clase) : ''}" aria-hidden="true" focusable="false"><use href="#i-${esc(nombre)}"></use></svg>`;
}

/* Ilustraciones de pantalla vacía (diseño propio, trazo 3 px redondeado como los íconos; colores por tokens).
   nombre: 'gallina' (gallina junto a su huevo), 'huevo' (huevo con palomita), 'campo' (huevos que crecen). */
let _ilN = 0; // id único por ilustración: dos en la misma página no deben compartir el recorte
function ilustracion(nombre) {
  const rid = 'il-recorte-' + (++_ilN);
  const fondo = `<clipPath id="${rid}"><rect width="160" height="132" rx="30"/></clipPath><circle class="il-sol" cx="124" cy="30" r="14"/><g clip-path="url(#${rid})"><path class="il-colina" d="M0 112C34 90 70 98 92 108s46 0 68-10v34H0z"/><path class="il-colina il-colina-2" d="M0 124c40-14 76-6 104 2s40 0 56-6v12H0z"/></g>`;
  const brote = (x, y, s) => `<g class="il-brote" transform="translate(${x} ${y}) scale(${s})"><path d="M0 0V-16"/><path d="M0-12c-8 0-12-5-12-11 8 0 12 5 12 11z"/><path d="M0-16c7 0 11-4 11-10-7 0-11 4-11 10z"/></g>`;
  let motivo;
  if (nombre === 'huevo') {
    motivo = `<path class="il-huevo" d="M80 22c-22 0-38 34-38 62 0 24 17 40 38 40s38-16 38-40c0-28-16-62-38-62z"/><path class="il-brillo" d="M62 70c2-12 8-22 15-28"/><path class="il-ok" d="M63 86l12 12 22-25"/>${brote(30, 118, 1)}${brote(136, 118, .8)}`;
  } else if (nombre === 'campo') {
    motivo = `<path class="il-huevo" d="M44 112c-8 0-13-9-13-17 0-9 5-19 13-19s13 10 13 19c0 8-5 17-13 17z"/><path class="il-huevo" d="M80 112c-10 0-17-11-17-23 0-13 7-27 17-27s17 14 17 27c0 12-7 23-17 23z"/><path class="il-huevo" d="M118 112c-12 0-21-13-21-29 0-16 9-33 21-33s21 17 21 33c0 16-9 29-21 29z"/><path class="il-brillo" d="M108 76c1-8 5-14 9-18"/>`;
  } else {
    motivo = `<path class="il-huevo il-cola" d="M108 84c12-4 18-14 14-26-6 8-12 12-20 14z"/><path class="il-huevo" d="M48 98c-3-22 10-36 32-36 21 0 32 12 30 29-1 12-12 19-30 19-18 0-30-4-32-12z"/><path class="il-ala" d="M72 86c10-9 24-8 32 2-8 10-22 12-32 6z"/><circle class="il-huevo" cx="58" cy="62" r="12"/><path class="il-cresta" d="M52 52c1-9 6-5 7-2 3-7 8-2 8 1-3 1-5 3-6 5z"/><path class="il-pico" d="M46 62l-10 4 10 4z"/><circle class="il-ojo" cx="56" cy="60" r="2"/><path class="il-pata" d="M76 111v7M88 111v7"/><path class="il-huevo" d="M129 118c-6 0-10-6-10-13s4-14 10-14 10 7 10 14-4 13-10 13z"/>`;
  }
  return `<svg class="ilustracion" viewBox="0 0 160 132" width="160" height="132" aria-hidden="true" focusable="false">${fondo}${motivo}</svg>`;
}

/* `datos` opcional: {ruta:'#/x', id:'L1'} -> data-ruta="#/x" data-id="L1" (claves en minúsculas y guiones).
   `clase` opcional: clases extra (p. ej. 'btn-ancho'). */
function Boton({ texto, icono: ic, variante, accion, datos, clase } = {}) {
  const v = ['primario', 'secundario', 'peligro'].includes(variante) ? variante : 'secundario';
  const da = accion !== undefined && accion !== null ? ` data-accion="${esc(accion)}"` : '';
  const dd = datos && typeof datos === 'object' ? Object.keys(datos)
    .filter(k => /^[a-z][a-z0-9-]*$/.test(k) && k !== 'accion' && datos[k] !== undefined && datos[k] !== null)
    .map(k => ` data-${k}="${esc(datos[k])}"`).join('') : '';
  const cl = clase ? ' ' + esc(clase) : '';
  return `<button type="button" class="btn btn-${v}${cl}"${da}${dd}>${icono(ic)}<span class="btn-texto">${esc(texto)}</span></button>`;
}

const _ESTADOS = { verde: 'Bien', ambar: 'Revisar', rojo: 'Atención' };

function Tarjeta({ titulo, cifra, unidad, estado, icono: ic, pie } = {}) {
  const est = Object.prototype.hasOwnProperty.call(_ESTADOS, estado) ? estado : '';
  const num = typeof cifra === 'number' && Number.isFinite(cifra);
  const valor = num ? formatoNumero(cifra) : esc(cifra === undefined || cifra === null ? '—' : cifra);
  return `<article class="tarjeta${est ? ' tarjeta-' + est : ''}">
  <header class="tarjeta-cab">${ic ? `<span class="tarjeta-icono">${icono(ic)}</span>` : ''}<h3 class="tarjeta-titulo">${esc(titulo)}</h3>${est ? `<span class="chip chip-${est}"><span class="chip-punto" aria-hidden="true"></span>${_ESTADOS[est]}</span>` : ''}</header>
  <p class="tarjeta-valor"><span class="tarjeta-cifra num"${num ? ` data-cifra="${cifra}"` : ''}>${valor}</span>${unidad ? ` <span class="tarjeta-unidad">${esc(unidad)}</span>` : ''}</p>${pie ? `
  <p class="tarjeta-pie">${esc(pie)}</p>` : ''}
</article>`;
}

function Contador({ id, valor, min, max, paso, etiqueta } = {}) {
  const p = Number(paso) > 0 ? Number(paso) : 1;
  const attr = (n, v) => (v === undefined || v === null || !Number.isFinite(Number(v)) ? '' : ` ${n}="${esc(Number(v))}"`);
  const v = Number.isFinite(Number(valor)) ? Number(valor) : 0;
  const de = esc(id);
  const pt = formatoNumero(p);
  return `<div class="contador" data-contador="${de}">
  <button type="button" class="contador-btn contador-menos" data-accion="contador-menos" data-para="${de}" aria-label="Restar ${pt}"><span aria-hidden="true">−</span></button>
  <input class="contador-valor num" id="${de}" type="number" inputmode="${Number.isInteger(p) ? 'numeric' : 'decimal'}" value="${esc(v)}"${attr('min', min)}${attr('max', max)} step="${esc(p)}" aria-label="${esc(etiqueta || 'Cantidad')}">
  <button type="button" class="contador-btn contador-mas" data-accion="contador-mas" data-para="${de}" aria-label="Sumar ${pt}"><span aria-hidden="true">+</span></button>
</div>`;
}

/* Suma o resta un paso al Contador `id` respetando min/max; devuelve el nuevo valor. */
function ajustarContador(id, signo) {
  const el = document.getElementById(id);
  if (!el) return null;
  const p = Number(el.step) > 0 ? Number(el.step) : 1;
  const dec = (String(p).split('.')[1] || '').length;
  let v = (Number(el.value) || 0) + (signo < 0 ? -p : p);
  if (el.min !== '' && v < Number(el.min)) v = Number(el.min);
  if (el.max !== '' && v > Number(el.max)) v = Number(el.max);
  el.value = v.toFixed(dec);
  el.dispatchEvent(new Event('input', { bubbles: true }));
  return Number(el.value);
}

let _hojaN = 0;
function Hoja({ titulo, contenido } = {}) {
  const tid = 'hoja-t-' + (++_hojaN);
  return `<div class="hoja-capa" data-hoja>
  <div class="hoja-fondo" data-accion="cerrar-hoja" aria-hidden="true"></div>
  <section class="hoja" role="dialog" aria-modal="true" aria-labelledby="${tid}">
    <div class="hoja-asa" aria-hidden="true"></div>
    <header class="hoja-cab"><h2 class="hoja-titulo" id="${tid}">${esc(titulo)}</h2>${Boton({ texto: 'Cerrar', variante: 'secundario', accion: 'cerrar-hoja' })}</header>
    <div class="hoja-cuerpo">${contenido || ''}</div>
  </section>
</div>`;
}

function Esqueleto(n) {
  const k = n === undefined ? 1 : Math.max(0, Math.floor(Number(n) || 0));
  let b = '';
  for (let i = 0; i < k; i++) b += `<div class="esqueleto-bloque" aria-hidden="true"></div>`;
  return `<div class="esqueleto" role="status"><span class="solo-lector">Cargando…</span>${b}</div>`;
}
