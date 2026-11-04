const assert = require('node:assert');
const { cargar } = require('./cargar');
const c = cargar();
const cerca = (a, b, eps = 1e-6) => assert.ok(typeof a === 'number' && Math.abs(a - b) < eps, `${a} != ${b}`);
const reg = (loteId, tipo, fecha, datos) => ({ id: loteId + tipo + fecha, loteId, fecha, tipo, datos });

/* ---------- Postura: Hy-Line Brown, 100 aves, llegaron a las 30 semanas el 2026-10-01 ---------- */
const L = { id: 'L1', nombre: 'Galpón 1', genetica: 'hyline-brown', avesInicio: 100, fechaLlegada: '2026-10-01', edadLlegadaDias: 210, estado: 'activo' };
const R = [
  reg('L1', 'mortalidad', '2026-10-20', { cantidad: 4 }),   // antes del período
  reg('L1', 'mortalidad', '2026-11-02', { cantidad: 2 }),
  reg('L1', 'mortalidad', '2026-11-05', { cantidad: 3 }),
  reg('L1', 'mortalidad', '2026-11-08', { cantidad: 5 }),   // después
  reg('L1', 'huevos', '2026-10-31', { cantidad: 999 }),     // fuera (un día antes)
  reg('L1', 'huevos', '2026-11-01', { cantidad: 80 }),      // límite inicial incluido
  reg('L1', 'huevos', '2026-11-02', { cantidad: 90, rotos: 3 }),
  reg('L1', 'huevos', '2026-11-07', { cantidad: 85 }),      // límite final incluido
  reg('L1', 'huevos', '2026-11-08', { cantidad: 999 }),     // fuera (un día después)
  reg('L1', 'alimento', '2026-10-31', { kg: 50 }),
  reg('L1', 'alimento', '2026-11-01', { kg: 12 }),
  reg('L1', 'alimento', '2026-11-02', { kg: 12.5 }),
  reg('L1', 'alimento', '2026-11-07', { kg: 12 }),
  reg('L2', 'mortalidad', '2026-11-03', { cantidad: 50 }),  // otro lote: se ignora
  reg('L2', 'huevos', '2026-11-03', { cantidad: 500 }),
  reg('L2', 'alimento', '2026-11-03', { kg: 77 })
];
const P = { cubeta: 4, kgAlimento: 0.5, kgPeso: 2 };
const s = c.resumenReporte(L, R, '2026-11-01', '2026-11-07', P);

assert.strictEqual(s.dias, 7);
cerca(s.viabilidad, 91 / 96 * 100);                 // 96 al inicio (100 - 4), 91 al final
assert.strictEqual(s.mortalidad, 5);                // 2 + 3 dentro del período
assert.strictEqual(s.produccion, 255);              // 80 + 90 + 85, límites incluidos
cerca(s.cubetas, 8.5);
cerca(s.pctPostura, 255 / (96 + 94 + 91) * 100);    // aves vivas de los 3 días con registro de huevos
cerca(s.alimentoKg, 36.5);
cerca(s.costoAlimento, 18.25);
cerca(s.ingreso, (255 - 3) / 30 * 4);               // 33,6: se descuentan los rotos
cerca(s.margen, 33.6 - 18.25);
const ew = d => c.ewStd(c.GENETICAS.find(g => g.id === 'hyline-brown').postura, (210 + d) / 7);
const masa = (80 * ew(31) + 90 * ew(32) + 85 * ew(37)) / 1000;   // 1 de noviembre = día 31 desde la llegada
cerca(s.conversion, 36.5 / masa, 1e-5);
assert.ok(s.conversion > 1.5 && s.conversion < 4, 'conversión plausible: ' + s.conversion);
for (const v of Object.values(s)) assert.ok(v === null || (typeof v === 'number' && Number.isFinite(v)) || typeof v === 'string' || typeof v === 'boolean', 'sin NaN');

// Sin huevos en el período: postura y producción nulas
const sinH = c.resumenReporte(L, R, '2026-11-03', '2026-11-04', P);
assert.strictEqual(sinH.pctPostura, null);
assert.strictEqual(sinH.produccion, null);
assert.strictEqual(sinH.ingreso, null);
assert.strictEqual(sinH.margen, null);
assert.strictEqual(sinH.conversion, null);
assert.strictEqual(sinH.alimentoKg, 0);
assert.strictEqual(sinH.costoAlimento, null);       // sin alimento registrado no se inventa un costo

// Precios ausentes: ingreso, costo y margen nulos; el resto sigue
for (const pr of [undefined, {}, { cubeta: NaN, kgAlimento: undefined }]) {
  const q = c.resumenReporte(L, R, '2026-11-01', '2026-11-07', pr);
  assert.strictEqual(q.ingreso, null); assert.strictEqual(q.costoAlimento, null); assert.strictEqual(q.margen, null);
  assert.strictEqual(q.produccion, 255);
}
// Solo el precio de la cubeta: hay ingreso pero no margen
const soloC = c.resumenReporte(L, R, '2026-11-01', '2026-11-07', { cubeta: 4 });
cerca(soloC.ingreso, 33.6); assert.strictEqual(soloC.costoAlimento, null); assert.strictEqual(soloC.margen, null);

// Lote sin registros: ceros y nulos, nunca NaN
const vacio = c.resumenReporte(L, [], '2026-11-01', '2026-11-07', P);
assert.strictEqual(vacio.viabilidad, 100); assert.strictEqual(vacio.mortalidad, 0); assert.strictEqual(vacio.alimentoKg, 0);
for (const k of ['produccion', 'pctPostura', 'conversion', 'costoAlimento', 'ingreso', 'margen']) assert.strictEqual(vacio[k], null, k);
// Lote sin aves: viabilidad nula
assert.strictEqual(c.resumenReporte({ ...L, avesInicio: 0 }, [], '2026-11-01', '2026-11-07', P).viabilidad, null);
// Todas las aves muertas antes del período: viabilidad nula (0 aves al inicio)
assert.strictEqual(c.resumenReporte(L, [reg('L1', 'mortalidad', '2026-10-05', { cantidad: 100 }), reg('L1', 'huevos', '2026-11-02', { cantidad: 5 })], '2026-11-01', '2026-11-07', P).viabilidad, null);

/* ---------- Carne: Cobb 500, 200 pollitos llegaron el 2026-11-01 ---------- */
const C = { id: 'C1', nombre: 'Pollos', genetica: 'cobb500', avesInicio: 200, fechaLlegada: '2026-11-01', edadLlegadaDias: 0, estado: 'activo' };
const RC = [
  reg('C1', 'mortalidad', '2026-11-03', { cantidad: 4 }),
  reg('C1', 'mortalidad', '2026-11-06', { cantidad: 6 }),
  reg('C1', 'peso', '2026-11-01', { gramos: 42 }),
  reg('C1', 'peso', '2026-11-07', { gramos: 600 }),
  reg('C1', 'peso', '2026-11-10', { gramos: 900 }),        // posterior al período
  reg('C1', 'alimento', '2026-11-01', { kg: 10 }),
  reg('C1', 'alimento', '2026-11-04', { kg: 20 }),
  reg('C1', 'alimento', '2026-11-07', { kg: 30 }),
  reg('L1', 'peso', '2026-11-07', { gramos: 5000 })
];
const k = c.resumenReporte(C, RC, '2026-11-01', '2026-11-07', P);
assert.strictEqual(k.produccion, 114);                // 600 g × 190 aves / 1000
cerca(k.conversion, 60 / 114);
cerca(k.viabilidad, 95); assert.strictEqual(k.mortalidad, 10);
assert.strictEqual(k.pctPostura, null);
cerca(k.ingreso, 228); cerca(k.costoAlimento, 30); cerca(k.margen, 198);
// Período corto al final del ciclo: viabilidad del período, alimento del período, conversión acumulada
const k2 = c.resumenReporte(C, RC, '2026-11-05', '2026-11-07', P);
cerca(k2.viabilidad, 190 / 196 * 100); assert.strictEqual(k2.mortalidad, 6);
cerca(k2.alimentoKg, 30); cerca(k2.conversion, 60 / 114); assert.strictEqual(k2.produccion, 114);
// Sin pesos: biomasa, conversión e ingreso nulos
const k3 = c.resumenReporte(C, RC.filter(r => r.tipo !== 'peso'), '2026-11-01', '2026-11-07', P);
assert.strictEqual(k3.produccion, null); assert.strictEqual(k3.conversion, null); assert.strictEqual(k3.ingreso, null); assert.strictEqual(k3.margen, null);
cerca(k3.costoAlimento, 30);

/* ---------- periodoReporte ---------- */
assert.deepStrictEqual({ ...c.periodoReporte(L, 'semana', '2026-11-04') }, { desde: '2026-10-29', hasta: '2026-11-04' });
assert.deepStrictEqual({ ...c.periodoReporte(L, 'mes', '2026-11-04') }, { desde: '2026-10-06', hasta: '2026-11-04' });
assert.deepStrictEqual({ ...c.periodoReporte(L, 'ciclo', '2026-11-04') }, { desde: '2026-10-01', hasta: '2026-11-04' });
assert.deepStrictEqual({ ...c.periodoReporte(L, 'semana', '2026-03-03') }, { desde: '2026-02-25', hasta: '2026-03-03' });   // cruza febrero
const cerrado = { ...L, estado: 'cerrado', fechaCierre: '2026-11-20' };
assert.deepStrictEqual({ ...c.periodoReporte(cerrado, 'ciclo', '2026-12-01', R) }, { desde: '2026-10-01', hasta: '2026-11-08' });  // último registro del lote
assert.deepStrictEqual({ ...c.periodoReporte(cerrado, 'ciclo', '2026-12-01', []) }, { desde: '2026-10-01', hasta: '2026-11-20' });  // sin registros: cierre
assert.deepStrictEqual({ ...c.periodoReporte({ ...L, estado: 'cerrado' }, 'ciclo', '2026-12-01', []) }, { desde: '2026-10-01', hasta: '2026-10-01' });
assert.strictEqual(c.resumenReporte(L, R, '2026-11-01', '2026-11-01', P).dias, 1);

/* ---------- textoReporte ---------- */
const t = c.textoReporte({ ...s, desde: '2026-11-01', hasta: '2026-11-07' }, L, 'semana', { nombre: 'La Esperanza' });
assert.ok(t.includes('La Esperanza') && t.includes('Galpón 1') && t.includes('Hy-Line Brown'), t);
assert.ok(/semana/i.test(t) && t.includes('01/11/2026') && t.includes('07/11/2026'), t);
assert.ok(t.includes('94,8 %'), t);                 // viabilidad con coma decimal
assert.ok(t.includes('90,7 %'), t);                 // % de postura
assert.ok(t.includes('255') && t.includes('8,5'), t);
assert.ok(t.includes('36,5 kg'), t);
assert.ok(t.includes('$18,25') && t.includes('$33,60') && t.includes('$15,35'), t);
assert.ok(!/NaN|undefined|null|Infinity/.test(t), t);
const tn = c.textoReporte({ ...vacio, desde: '2026-11-01', hasta: '2026-11-07' }, L, 'mes');
assert.ok(/Conversión: —/.test(tn) && /Margen: —/.test(tn) && /% de postura: —/.test(tn), tn);
assert.ok(!/NaN|undefined|null|Infinity/.test(tn), tn);
const tk = c.textoReporte({ ...k, desde: '2026-11-01', hasta: '2026-11-07' }, C, 'ciclo');
assert.ok(tk.includes('114 kg') && tk.includes('Cobb 500') && /ciclo/i.test(tk) && tk.includes('0,53'), tk);
console.log('reporte ok');
