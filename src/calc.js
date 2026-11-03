/* =========================================================================
   APPOLLO · Cálculos puros de lote (sin DOM, sin almacenamiento)
   Fechas: cadenas locales 'YYYY-MM-DD'. Nunca se usa toISOString().
   ========================================================================= */

function fechaADate(s) {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function hoyLocal(d = new Date()) {
  const p = n => String(n).padStart(2, '0');
  return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
}

/* Edad en días = edad al llegar + días enteros transcurridos desde la llegada. */
function edadDias(lote, fecha) {
  const a = fechaADate(lote.fechaLlegada), b = fechaADate(fecha);
  // UTC solo para contar días enteros sin que el cambio de hora afecte el resultado
  const dias = Math.round((Date.UTC(b.getFullYear(), b.getMonth(), b.getDate()) -
    Date.UTC(a.getFullYear(), a.getMonth(), a.getDate())) / 86400000);
  return lote.edadLlegadaDias + dias;
}

const _genDe = lote => GENETICAS.find(g => g.id === lote.genetica);
const _esCarne = g => modoDe(g) === 'carne';
const _delLote = (lote, registros, tipo) =>
  registros.filter(r => r.loteId === lote.id && r.tipo === tipo);
const _suma = (rs, campo) => rs.reduce((s, r) => s + (Number(r.datos && r.datos[campo]) || 0), 0);

function mortalidadTotal(lote, registros, fecha) {
  return _suma(_delLote(lote, registros, 'mortalidad').filter(r => r.fecha <= fecha), 'cantidad');
}

function avesVivas(lote, registros, fecha) {
  return lote.avesInicio - mortalidadTotal(lote, registros, fecha);
}

function mortalidadPct(lote, registros, fecha) {
  if (!(lote.avesInicio > 0)) return null;
  return 100 * mortalidadTotal(lote, registros, fecha) / lote.avesInicio;
}

function viabilidad(lote, registros, fecha) {
  const m = mortalidadPct(lote, registros, fecha);
  return m === null ? null : 100 - m;
}

/* Valores de referencia del día para `aves` aves (por defecto avesInicio).
   `altitud` se acepta por compatibilidad de firma; el estándar de guía no la usa. */
function estandarDia(lote, fecha, altitud, aves) {
  const g = _genDe(lote), d = edadDias(lote, fecha);
  const n = aves == null ? lote.avesInicio : aves;
  if (_esCarne(g)) {
    const c = g.carne;
    return {
      alimentoKg: n * consumoCarne(c, d) / 1000,
      huevos: 0, hdPct: null,
      pesoG: pesoStd(c, d),
      mortEsperada: c.mortBase / c.ciclo // % diario
    };
  }
  const p = g.postura, w = d / 7;
  const hd = hdStd(p, w);
  return {
    alimentoKg: n * consumoPostura(g, w) / 1000,
    huevos: n * hd / 100,
    hdPct: hd,
    pesoG: ewStd(p, w), // peso del huevo (g)
    mortEsperada: p.m / 7 * 100 // % diario
  };
}

function pctPostura(lote, registros, fecha) {
  const vivas = avesVivas(lote, registros, fecha);
  if (!(vivas > 0)) return null;
  const hs = _delLote(lote, registros, 'huevos').filter(r => r.fecha === fecha);
  if (!hs.length) return null;
  return 100 * _suma(hs, 'cantidad') / vivas;
}

/* Postura: kg de alimento del día / kg de huevo del día (peso de huevo de guía).
   Carne: alimento acumulado / kg vivos (último peso registrado × aves vivas). */
function conversion(lote, registros, fecha) {
  const vivas = avesVivas(lote, registros, fecha);
  if (!(vivas > 0)) return null;
  const g = _genDe(lote);
  if (_esCarne(g)) {
    const alim = _suma(_delLote(lote, registros, 'alimento').filter(r => r.fecha <= fecha), 'kg');
    const ps = _delLote(lote, registros, 'peso').filter(r => r.fecha <= fecha).sort((a, b) => a.fecha < b.fecha ? -1 : 1);
    if (!ps.length || !alim) return null;
    const kgVivo = vivas * (Number(ps[ps.length - 1].datos.gramos) || 0) / 1000;
    return kgVivo > 0 ? alim / kgVivo : null;
  }
  const alim = _suma(_delLote(lote, registros, 'alimento').filter(r => r.fecha === fecha), 'kg');
  const huevos = _suma(_delLote(lote, registros, 'huevos').filter(r => r.fecha === fecha), 'cantidad');
  const kgHuevo = huevos * ewStd(g.postura, edadDias(lote, fecha) / 7) / 1000;
  return alim > 0 && kgHuevo > 0 ? alim / kgHuevo : null;
}

/* Real ÷ estándar × 100. Postura: % postura vs HD estándar. Carne: último peso vs peso estándar. */
function rendimiento(lote, registros, fecha) {
  const g = _genDe(lote), e = estandarDia(lote, fecha);
  if (_esCarne(g)) {
    const ps = _delLote(lote, registros, 'peso').filter(r => r.fecha <= fecha).sort((a, b) => a.fecha < b.fecha ? -1 : 1);
    if (!ps.length || !(e.pesoG > 0)) return null;
    return 100 * (Number(ps[ps.length - 1].datos.gramos) || 0) / e.pesoG;
  }
  const real = pctPostura(lote, registros, fecha);
  return real === null || !(e.hdPct > 0) ? null : 100 * real / e.hdPct;
}
