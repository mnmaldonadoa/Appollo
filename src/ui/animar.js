/* Appollo · Animaciones pequeñas. Con prefers-reduced-motion todo ocurre al instante. */

function reducirMovimiento() {
  try { return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches; }
  catch (e) { return false; }
}

/* Cuenta desde la cifra que muestra el elemento hasta `hasta`. Devuelve una promesa. */
function contar(el, hasta, ms) {
  const fin = Number(hasta);
  if (!el || !Number.isFinite(fin)) return Promise.resolve();
  const dec = Number.isInteger(fin) ? 0 : Math.min(2, (String(fin).split('.')[1] || '').length);
  const pinta = v => { el.textContent = formatoNumero(v, dec); };
  if (el._contar) cancelAnimationFrame(el._contar);
  const desde = Number(String(el.textContent || '').replace(/[^\d,-]/g, '').replace(',', '.')) || 0;
  if (reducirMovimiento() || desde === fin || typeof requestAnimationFrame !== 'function') { pinta(fin); return Promise.resolve(); }
  const dur = ms || 700;
  return new Promise(res => {
    let t0 = null;
    const paso = t => {
      if (t0 === null) t0 = t;
      const p = Math.min(1, (t - t0) / dur);
      const e = 1 - Math.pow(1 - p, 3);
      pinta(desde + (fin - desde) * e);
      if (p < 1) el._contar = requestAnimationFrame(paso);
      else { el._contar = 0; pinta(fin); res(); }
    };
    el._contar = requestAnimationFrame(paso);
  });
}

/* Dibuja una palomita verde dentro de `el` (círculo que aparece y trazo que se dibuja). */
function palomita(el) {
  if (!el) return Promise.resolve();
  el.innerHTML = '<svg class="palomita" viewBox="0 0 52 52" aria-hidden="true" focusable="false">' +
    '<circle class="palomita-circulo" cx="26" cy="26" r="23"/>' +
    '<path class="palomita-trazo" d="M15 27.5l7.2 7.2L37.5 19" pathLength="1"/></svg>';
  if (reducirMovimiento() || typeof Element.prototype.animate !== 'function') return Promise.resolve();
  const c = el.querySelector('.palomita-circulo'), p = el.querySelector('.palomita-trazo');
  const a1 = c.animate([{ transform: 'scale(.4)', opacity: 0 }, { transform: 'scale(1.08)', opacity: 1, offset: 0.7 }, { transform: 'scale(1)', opacity: 1 }],
    { duration: 320, easing: 'cubic-bezier(.2,.8,.3,1)', fill: 'backwards' });
  const a2 = p.animate([{ strokeDashoffset: 1 }, { strokeDashoffset: 0 }],
    { duration: 300, delay: 180, easing: 'cubic-bezier(.6,0,.3,1)', fill: 'backwards' });
  return Promise.all([a1.finished, a2.finished]).then(() => {}, () => {});
}

/* Vibración corta si el teléfono la permite. */
function vibrar(ms) {
  try { if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') navigator.vibrate(ms || 30); }
  catch (e) { /* sin vibración */ }
}
