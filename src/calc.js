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

/* ---------------------- Validación de un registro ----------------------
   validarRegistro(tipo, datos, lote, registros, fecha) -> {ok, mensaje?, duplicado?}
   `duplicado` (con ok:true) avisa que ya existe un registro del mismo lote, tipo y día. */
const TIPOS_DIARIOS = ['alimento', 'huevos', 'mortalidad', 'peso'];

function fechaValida(s) {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  return hoyLocal(fechaADate(s)) === s; // descarta 2026-02-30, mes 13, etc.
}

function validarRegistro(tipo, datos, lote, registros, fecha) {
  const no = mensaje => ({ ok: false, mensaje });
  const d = datos || {}, regs = registros || [];
  const entero = x => x !== '' && x !== null && x !== undefined && Number.isInteger(Number(x));
  const texto = x => typeof x === 'string' && x.trim() !== '';
  if (!lote) return no('Elige un lote');
  if (!fechaValida(fecha)) return no('La fecha no es válida');
  if (fecha > hoyLocal()) return no('La fecha no puede ser futura');
  if (fechaValida(lote.fechaLlegada) && fecha < lote.fechaLlegada)
    return no('La fecha es anterior a la llegada del lote (' + lote.fechaLlegada + ')');

  switch (tipo) {
    case 'mortalidad': {
      if (!entero(d.cantidad) || Number(d.cantidad) < 1) return no('Las aves muertas deben ser un número entero de 1 o más');
      const vivas = Math.max(0, avesVivas(lote, regs, fecha));
      if (Number(d.cantidad) > vivas) return no('Solo quedan ' + vivas + ' aves en el lote');
      break;
    }
    case 'alimento':
      if (!(Number.isFinite(Number(d.kg)) && Number(d.kg) > 0) || d.kg === null || d.kg === '') return no('Los kilos de alimento deben ser mayores que 0');
      break;
    case 'huevos':
      if (!entero(d.cantidad) || Number(d.cantidad) < 0) return no('Los huevos deben ser un número entero de 0 o más');
      if (d.rotos !== undefined && d.rotos !== null && d.rotos !== '') {
        if (!entero(d.rotos) || Number(d.rotos) < 0) return no('Los huevos rotos deben ser un número entero de 0 o más');
        if (Number(d.rotos) > Number(d.cantidad)) return no('Los huevos rotos no pueden ser más que los recogidos');
      }
      break;
    case 'peso':
      if (!(Number.isFinite(Number(d.gramos)) && Number(d.gramos) > 0) || d.gramos === null || d.gramos === '') return no('El peso debe ser mayor que 0 gramos');
      break;
    case 'vacuna':
      if (!texto(d.nombre)) return no('Escribe el nombre de la vacuna');
      break;
    case 'sanidad':
      if (!texto(d.enfermedad) && !texto(d.tratamiento)) return no('Escribe la enfermedad o el tratamiento');
      if (d.retiroDias !== undefined && d.retiroDias !== null && d.retiroDias !== '' &&
        (!entero(d.retiroDias) || Number(d.retiroDias) < 0)) return no('Los días de retiro deben ser un número entero de 0 o más');
      break;
    default:
      return no('Tipo de registro desconocido');
  }
  const dup = TIPOS_DIARIOS.includes(tipo) &&
    regs.some(r => r && r.loteId === lote.id && r.tipo === tipo && r.fecha === fecha);
  return dup ? { ok: true, duplicado: true } : { ok: true };
}

/* ---------------------- Estado sanitario del lote ----------------------
   estadoSanitario(lote, registros, vacunasPlan, fecha) -> 'verde' | 'ambar' | 'rojo'
   Rojo: vacuna vencida sin aplicar, retiro de medicamento activo o mortalidad de hoy > 2× la esperada.
   Ámbar: vacuna para hoy o mañana, mortalidad de hoy > 1,5× la esperada, o lote activo con más de
   3 días desde la llegada y sin registros hoy, ayer ni anteayer. Un lote cerrado no exige vacunas ni registros. */
function _masDias(fecha, n) {
  const d = fechaADate(fecha);
  d.setDate(d.getDate() + n);
  return hoyLocal(d);
}

function estadoSanitario(lote, registros, vacunasPlan, fecha) {
  const regs = (registros || []).filter(r => r && r.loteId === lote.id);
  const vacs = (vacunasPlan || []).filter(v => v && v.loteId === lote.id && !v.fechaAplicada && v.fechaPrevista);
  const activo = lote.estado === 'activo', manana = _masDias(fecha, 1);
  let ambar = false;

  if (activo) {
    if (vacs.some(v => v.fechaPrevista < fecha)) return 'rojo';
    if (vacs.some(v => v.fechaPrevista === fecha || v.fechaPrevista === manana)) ambar = true;
  }
  for (const r of regs) {
    const dias = Number(r.datos && r.datos.retiroDias) || 0;
    if (r.tipo === 'sanidad' && dias > 0 && r.fecha <= fecha && fecha <= _masDias(r.fecha, dias)) return 'rojo';
  }

  const g = _genDe(lote);
  const muertes = _suma(regs.filter(r => r.tipo === 'mortalidad' && r.fecha === fecha), 'cantidad');
  if (g && muertes > 0 && typeof lote.fechaLlegada === 'string') {
    const base = avesVivas(lote, regs, fecha) + muertes; // aves al empezar el día
    const esp = base > 0 ? estandarDia(lote, fecha).mortEsperada : 0;
    if (esp > 0) {
      const pct = 100 * muertes / base;
      if (pct > 2 * esp) return 'rojo';
      if (pct > 1.5 * esp) ambar = true;
    }
  }

  if (activo && typeof lote.fechaLlegada === 'string' && fechaValida(lote.fechaLlegada)) {
    const desde = edadDias({ fechaLlegada: lote.fechaLlegada, edadLlegadaDias: 0 }, fecha);
    const inicio = _masDias(fecha, -2);
    if (desde > 3 && !regs.some(r => r.fecha >= inicio && r.fecha <= fecha)) ambar = true;
  }
  return ambar ? 'ambar' : 'verde';
}
