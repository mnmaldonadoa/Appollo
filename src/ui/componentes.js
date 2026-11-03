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

function Boton({ texto, icono: ic, variante, accion } = {}) {
  const v = ['primario', 'secundario', 'peligro'].includes(variante) ? variante : 'secundario';
  const da = accion !== undefined && accion !== null ? ` data-accion="${esc(accion)}"` : '';
  return `<button type="button" class="btn btn-${v}"${da}>${icono(ic)}<span class="btn-texto">${esc(texto)}</span></button>`;
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
