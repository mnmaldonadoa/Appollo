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
