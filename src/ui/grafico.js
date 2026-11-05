/* Appollo · Gráfico de líneas en SVG: real (verde, continua) contra estándar (cielo, discontinua).
   Tolera series vacías, de un punto, con nulos o de distinto largo sin producir NaN.
   leyendaReal / leyendaEstandar (opcionales) cambian los textos de la leyenda. */

function Grafico({ serieReal, serieEstandar, etiquetas, leyendaReal, leyendaEstandar } = {}) {
  const W = 320, H = 150, PX = 10, PY = 14;
  const lista = s => (Array.isArray(s) ? s.map(v => (v === null || v === '' || v === undefined ? NaN : Number(v))) : []);
  const real = lista(serieReal), est = lista(serieEstandar);
  const ets = Array.isArray(etiquetas) ? etiquetas : [];
  const n = Math.max(real.length, est.length, ets.length);
  const vals = real.concat(est).filter(Number.isFinite);
  const f = v => (Math.round(v * 10) / 10).toString();

  let lo = vals.length ? Math.min(...vals) : 0, hi = vals.length ? Math.max(...vals) : 1;
  if (hi - lo < 1e-9) { const d = Math.abs(hi) * 0.1 || 1; lo -= d; hi += d; }
  const m = (hi - lo) * 0.12; lo -= m; hi += m;
  const x = i => (n <= 1 ? W / 2 : PX + (i * (W - 2 * PX)) / (n - 1));
  const y = v => PY + ((hi - v) * (H - 2 * PY)) / (hi - lo);

  // Tramos continuos de puntos válidos; un punto aislado se dibuja como círculo.
  function trazar(serie, clase, extra) {
    let d = '', puntos = '', tramo = [];
    const cerrar = () => {
      if (tramo.length === 1) puntos += `<circle class="${clase}-punto" cx="${f(x(tramo[0]))}" cy="${f(y(serie[tramo[0]]))}" r="4"/>`;
      else if (tramo.length > 1) d += tramo.map((i, k) => (k ? 'L' : 'M') + f(x(i)) + ' ' + f(y(serie[i]))).join('');
      tramo = [];
    };
    serie.forEach((v, i) => (Number.isFinite(v) ? tramo.push(i) : cerrar()));
    cerrar();
    return (d ? `<path class="${clase}" d="${d}" fill="none"${extra}/>` : '') + puntos;
  }

  const rejilla = [0.25, 0.5, 0.75].map(t => `<line class="grafico-rejilla" x1="0" x2="${W}" y1="${f(PY + t * (H - 2 * PY))}" y2="${f(PY + t * (H - 2 * PY))}"/>`).join('');
  const base = `<line class="grafico-base" x1="0" x2="${W}" y1="${H - 1}" y2="${H - 1}"/>`;
  let ult = '';
  for (let i = real.length - 1; i >= 0; i--) if (Number.isFinite(real[i])) { ult = `<circle class="grafico-ultimo" cx="${f(x(i))}" cy="${f(y(real[i]))}" r="5.5"/>`; break; }

  const hayDatos = vals.length > 0;
  const svg = `<svg class="grafico-svg" viewBox="0 0 ${W} ${H}" aria-hidden="true" focusable="false">${rejilla}${base}${hayDatos
    ? trazar(est, 'grafico-estandar', ' stroke-dasharray="7 6"') + trazar(real, 'grafico-real', ' pathLength="1"') + ult : ''}</svg>`;

  const primera = ets.length ? ets[0] : '', ultima = ets.length > 1 ? ets[ets.length - 1] : '';
  const ejes = hayDatos && (primera !== '' || ultima !== '')
    ? `<div class="grafico-ejes"><span>${esc(primera)}</span><span>${esc(ultima)}</span></div>` : '';
  const ultimoReal = real.filter(Number.isFinite).pop();
  const resumen = hayDatos
    ? `Gráfico de ${n} ${n === 1 ? 'punto' : 'puntos'}: real${ultimoReal !== undefined ? ' último ' + formatoNumero(ultimoReal) : ''} contra estándar`
    : 'Gráfico sin datos';
  return `<figure class="grafico${hayDatos ? '' : ' grafico-vacio'}" role="img" aria-label="${esc(resumen)}">
  ${svg}${hayDatos ? '' : `<p class="grafico-aviso">Aún no hay datos para graficar</p>`}
  ${ejes}
  <figcaption class="grafico-leyenda"><span class="ley ley-real">${esc(leyendaReal || 'Real')}</span><span class="ley ley-estandar">${esc(leyendaEstandar || 'Estándar')}</span></figcaption>
</figure>`;
}
