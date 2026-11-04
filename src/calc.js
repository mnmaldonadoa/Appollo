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
  // Sin fecha de llegada válida (lote migrado de la v1 o respaldo manipulado) no hay días que contar.
  if (!fechaValida(lote.fechaLlegada) || !fechaValida(fecha)) return Number(lote.edadLlegadaDias) || 0;
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

/* Nueva cantidad de un ítem de inventario tras gastar `kg` de alimento (kg negativo = devolver).
   Convierte a la unidad del ítem con kgPorUnidad; nunca baja de 0. Si no puede convertir, no cambia. */
function calcularDescuento(item, kg) {
  const cant = item ? item.cantidad : undefined;
  if (typeof kg !== 'number' || !Number.isFinite(kg) || !Number.isFinite(Number(cant))) return cant;
  let por = 1;
  if (item.unidad !== 'kg') {
    por = Number(item.kgPorUnidad);
    if (!(por > 0) || !Number.isFinite(por)) return cant;
  }
  const nueva = Number(cant) - kg / por;
  return Math.max(0, Math.round(nueva * 1e6) / 1e6);
}

/* Kg realmente quitados del stock al aplicar `kg` (positivo: salieron; negativo: se devolvieron; 0 si nada cambió). */
function kgDescontados(item, kg) {
  if (!item) return 0;
  const nueva = Number(calcularDescuento(item, kg)), cant = Number(item.cantidad);
  const por = item.unidad === 'kg' ? 1 : Number(item.kgPorUnidad);
  if (!Number.isFinite(nueva) || !Number.isFinite(cant) || !(por > 0)) return 0;
  return Math.round((cant - nueva) * por * 1e6) / 1e6;
}

/* ---------------------- Reportes por período ----------------------
   resumenReporte(lote, registros, desde, hasta, precios) -> cifras del período [desde, hasta] (inclusive, 'YYYY-MM-DD').
   Flujos (mortalidad, huevos, alimento del período) solo cuentan registros dentro del período y del lote.
   Estados acumulados: en carne, el último peso (hasta `hasta`) y el alimento acumulado desde la llegada.
   Todo valor sin datos suficientes es null; nunca NaN ni Infinity. */
const _repR6 = x => Math.round(x * 1e6) / 1e6;
const _repFin = x => (typeof x === 'number' && Number.isFinite(x) ? _repR6(x) : null);
const _repPrecio = p => (typeof p === 'number' && Number.isFinite(p) && p >= 0 ? p : null);
const _repMasDias = (f, n) => { const d = fechaADate(f); d.setDate(d.getDate() + n); return hoyLocal(d); };

function resumenReporte(lote, registros, desde, hasta, precios) {
  if (!fechaValida(hasta)) hasta = fechaValida(desde) ? desde : hoyLocal();
  if (!fechaValida(desde)) desde = hasta;
  if (desde > hasta) desde = hasta;
  const pr = precios || {}, regs = (registros || []).filter(r => r && r.loteId === lote.id);
  const en = tipo => regs.filter(r => r.tipo === tipo && r.fecha >= desde && r.fecha <= hasta);
  const g = _genDe(lote), carne = !!g && _esCarne(g);
  const a = fechaADate(desde), b = fechaADate(hasta);
  const dias = Math.max(1, Math.round((Date.UTC(b.getFullYear(), b.getMonth(), b.getDate()) -
    Date.UTC(a.getFullYear(), a.getMonth(), a.getDate())) / 86400000) + 1);

  const ini = lote.avesInicio > 0 ? avesVivas(lote, regs, _repMasDias(desde, -1)) : 0, fin = avesVivas(lote, regs, hasta);
  const viab = ini > 0 ? 100 * Math.max(0, fin) / ini : null;
  const mortalidad = _suma(en('mortalidad'), 'cantidad');
  const alim = en('alimento'), alimentoKg = _suma(alim, 'kg');
  const costoAlimento = alim.length && _repPrecio(pr.kgAlimento) !== null ? alimentoKg * pr.kgAlimento : null;

  let produccion = null, cubetas = null, pct = null, conv = null, ingreso = null;
  if (carne) {
    const ps = regs.filter(r => r.tipo === 'peso' && r.fecha <= hasta && Number(r.datos && r.datos.gramos) > 0)
      .sort((x, y) => (x.fecha < y.fecha ? -1 : 1));
    const biomasa = ps.length && fin > 0 ? Number(ps[ps.length - 1].datos.gramos) * fin / 1000 : null;
    const acum = _suma(regs.filter(r => r.tipo === 'alimento' && r.fecha <= hasta), 'kg');
    produccion = biomasa;
    conv = biomasa > 0 && acum > 0 ? acum / biomasa : null;
    ingreso = biomasa !== null && _repPrecio(pr.kgPeso) !== null ? biomasa * pr.kgPeso : null;
  } else {
    const hs = en('huevos');
    if (hs.length) {
      const total = _suma(hs, 'cantidad'), fechas = [...new Set(hs.map(r => r.fecha))];
      const vivasDias = fechas.reduce((s, f) => s + Math.max(0, avesVivas(lote, regs, f)), 0);
      let masaKg = 0;
      for (const f of fechas) {
        let e = null;
        try { e = g ? estandarDia(lote, f).pesoG : null; } catch (x) { e = null; }
        masaKg += _suma(hs.filter(r => r.fecha === f), 'cantidad') * (e > 0 ? e : NaN) / 1000;
      }
      produccion = total; cubetas = total / 30;
      pct = vivasDias > 0 ? 100 * total / vivasDias : null;
      conv = alimentoKg > 0 && masaKg > 0 ? alimentoKg / masaKg : null;
      ingreso = _repPrecio(pr.cubeta) !== null ? Math.max(0, total - _suma(hs, 'rotos')) / 30 * pr.cubeta : null;
    }
  }
  const ing = _repFin(ingreso), cos = _repFin(costoAlimento);
  return { desde, hasta, dias, carne, viabilidad: _repFin(viab), conversion: _repFin(conv), produccion: _repFin(produccion),
    cubetas: _repFin(cubetas), pctPostura: _repFin(pct), mortalidad, alimentoKg: _repFin(alimentoKg) || 0,
    costoAlimento: cos, ingreso: ing, margen: ing !== null && cos !== null ? _repR6(ing - cos) : null };
}

/* periodoReporte(lote, 'semana'|'mes'|'ciclo', hoy[, registros]) -> {desde, hasta}.
   Semana = últimos 7 días con hoy; mes = últimos 30. Ciclo = llegada → hoy (lote cerrado: su último registro,
   o su fecha de cierre, o la llegada). */
function periodoReporte(lote, periodo, hoy, registros) {
  if (!fechaValida(hoy)) hoy = hoyLocal();
  if (periodo === 'semana') return { desde: _repMasDias(hoy, -6), hasta: hoy };
  if (periodo === 'mes') return { desde: _repMasDias(hoy, -29), hasta: hoy };
  const fs = (registros || []).filter(r => r && r.loteId === lote.id && fechaValida(r.fecha)).map(r => r.fecha).sort();
  // Sin llegada válida: el ciclo arranca en el primer registro, o en hoy si no hay ninguno.
  const desde = fechaValida(lote.fechaLlegada) ? lote.fechaLlegada : fs.length ? fs[0] : hoy;
  let hasta = hoy;
  if (lote.estado !== 'activo') hasta = fs.length ? fs[fs.length - 1] : fechaValida(lote.fechaCierre) ? lote.fechaCierre : desde;
  return { desde, hasta: hasta < desde ? desde : hasta };
}

const _REP_PERIODOS = { semana: 'Última semana', mes: 'Último mes', ciclo: 'Ciclo completo' };

/* Texto plano para WhatsApp. Lo que no se pudo calcular va como "—". */
function textoReporte(resumen, lote, periodo, granja) {
  const g = _genDe(lote), n = x => (x === null || x === undefined ? null : formatoNumero(Math.round(x * 10) / 10));
  const dd = f => (f ? f.slice(8, 10) + '/' + f.slice(5, 7) + '/' + f.slice(0, 4) : '—');
  const con = (x, f) => (x === null || x === undefined ? '—' : f(x));
  const dinero = x => (x === null || x === undefined ? '—' : (x < 0 ? '-$' : '$') + formatoNumero(Math.abs(x), 2));
  const prod = resumen.carne
    ? con(resumen.produccion, x => n(x) + ' kg de pollo en pie (estimado)')
    : resumen.produccion === null ? '—' : `${formatoNumero(resumen.produccion)} huevos (${n(resumen.cubetas)} cubetas de 30)`;
  const nombre = (granja && granja.nombre ? granja.nombre + ' · ' : '') + (lote.nombre || 'Lote');
  return [
    `Reporte Appollo · ${nombre}`,
    `Genética: ${g ? g.nombre : lote.genetica || '—'}`,
    `Período: ${_REP_PERIODOS[periodo] || 'Período'} (${dd(resumen.desde)} al ${dd(resumen.hasta)}, ${formatoNumero(resumen.dias || 0)} ${resumen.dias === 1 ? 'día' : 'días'})`,
    '',
    `Viabilidad: ${con(resumen.viabilidad, x => n(x) + ' %')}`,
    `Mortalidad: ${formatoNumero(resumen.mortalidad || 0)} ${resumen.mortalidad === 1 ? 'ave' : 'aves'}`,
    `Producción: ${prod}`,
    ...(resumen.carne ? [] : [`% de postura: ${con(resumen.pctPostura, x => n(x) + ' %')}`]),
    `Conversión: ${con(resumen.conversion, x => formatoNumero(Math.round(x * 100) / 100) + ' kg de alimento por kg')}`,
    `Alimento: ${formatoNumero(Math.round((resumen.alimentoKg || 0) * 10) / 10)} kg`,
    `Costo de alimento: ${dinero(resumen.costoAlimento)}`,
    `Ingreso: ${dinero(resumen.ingreso)}`,
    `Margen: ${dinero(resumen.margen)}`
  ].join('\n');
}
