const assert = require('node:assert');
const { cargar } = require('./cargar');
const c = cargar();

const lote = { id: 'L1', nombre: 'A', genetica: 'hyline-brown', avesInicio: 100,
  fechaLlegada: '2026-01-01', edadLlegadaDias: 126, galpon: 'G1', estado: 'activo' };
const reg = (tipo, fecha, datos) => ({ id: tipo + fecha, loteId: 'L1', fecha, tipo, datos });

assert.strictEqual(c.hoyLocal(new Date(2026, 10, 3, 23, 30)), '2026-11-03');
assert.strictEqual(c.edadDias(lote, '2026-01-11'), 136);

const mort = [reg('mortalidad', '2026-02-01', { cantidad: 3 }), reg('mortalidad', '2026-02-02', { cantidad: 2 })];
assert.strictEqual(c.avesVivas(lote, mort, '2026-02-10'), 95);
assert.strictEqual(c.avesVivas(lote, mort, '2026-02-01'), 97);
assert.strictEqual(c.mortalidadPct(lote, mort, '2026-02-10'), 5);
assert.strictEqual(c.viabilidad(lote, mort, '2026-02-10'), 95);

const todas = [reg('mortalidad', '2026-02-01', { cantidad: 100 }), reg('huevos', '2026-02-02', { cantidad: 5 }), reg('alimento', '2026-02-02', { kg: 10 })];
assert.strictEqual(c.pctPostura(lote, todas, '2026-02-02'), null);
assert.strictEqual(c.conversion(lote, todas, '2026-02-02'), null);
assert.strictEqual(c.mortalidadPct({ ...lote, avesInicio: 0 }, [], '2026-02-02'), null);

const h = [...mort, reg('huevos', '2026-02-10', { cantidad: 90 })];
assert.ok(Math.abs(c.pctPostura(lote, h, '2026-02-10') - 94.7) < 0.1);

const lote30 = { ...lote, edadLlegadaDias: 210 }; // 30 semanas
const e = c.estandarDia(lote30, lote30.fechaLlegada, 2800);
const p = c.GENETICAS.find(g => g.id === 'hyline-brown').postura;
assert.ok(Math.abs(e.hdPct - c.hdStd(p, 30)) <= 1);
assert.ok(e.alimentoKg > 0 && e.huevos > 0);

const lc = { ...lote, genetica: 'cobb500', edadLlegadaDias: 0 };
const ec = c.estandarDia(lc, '2026-01-21', 2800);
assert.strictEqual(ec.huevos, 0); assert.strictEqual(ec.hdPct, null); assert.ok(ec.pesoG > 0);

const r = c.rendimiento(lote30, [reg('huevos', lote30.fechaLlegada, { cantidad: 80 })], lote30.fechaLlegada);
assert.ok(r > 0 && Number.isFinite(r));

/* ---- Carne: conversión acumulada y rendimiento (peso real / estándar) ---- */
const carne = { id: 'L1', nombre: 'B', genetica: 'cobb500', avesInicio: 100, fechaLlegada: '2026-01-01', edadLlegadaDias: 0, galpon: 'G', estado: 'activo' };
const rc = [reg('alimento', '2026-01-10', { kg: 20 }), reg('alimento', '2026-01-20', { kg: 30 }), reg('peso', '2026-01-20', { gramos: 800 }),
  reg('mortalidad', '2026-01-15', { cantidad: 10 })];
// 90 aves vivas × 0,8 kg = 72 kg vivos; 50 kg de alimento acumulado -> 50/72
assert.ok(Math.abs(c.conversion(carne, rc, '2026-01-20') - 50 / 72) < 1e-9);
// sólo cuenta el alimento hasta la fecha consultada y el último peso hasta esa fecha
assert.strictEqual(c.conversion(carne, rc, '2026-01-10'), null, 'sin peso registrado aún');
assert.strictEqual(c.conversion(carne, [reg('peso', '2026-01-20', { gramos: 800 })], '2026-01-20'), null, 'sin alimento');
const std20 = c.estandarDia(carne, '2026-01-20', 2800).pesoG;
assert.ok(std20 > 0);
assert.ok(Math.abs(c.rendimiento(carne, rc, '2026-01-20') - 100 * 800 / std20) < 1e-9);
assert.strictEqual(c.rendimiento(carne, [reg('alimento', '2026-01-20', { kg: 5 })], '2026-01-20'), null, 'sin peso: null');
// el peso más reciente manda
const rc2 = rc.concat(reg('peso', '2026-01-18', { gramos: 600 }));
assert.ok(Math.abs(c.rendimiento(carne, rc2, '2026-01-20') - 100 * 800 / std20) < 1e-9);
assert.ok(Math.abs(c.rendimiento(carne, rc2, '2026-01-18') - 100 * 600 / c.estandarDia(carne, '2026-01-18', 2800).pesoG) < 1e-9);
