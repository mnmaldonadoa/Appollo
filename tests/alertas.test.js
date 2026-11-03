const assert = require('node:assert');
const { cargar } = require('./cargar');
const c = cargar();

const lote = { id: 'L1', nombre: 'A', genetica: 'hyline-brown', avesInicio: 100000,
  fechaLlegada: '2026-01-01', edadLlegadaDias: 210, galpon: 'G1', estado: 'activo' };
const HOY = '2026-11-03';
const dia = (h, m = 0) => new Date(2026, 10, 3, h, m);
const reg = (tipo, fecha, datos, id) => ({ id: id || tipo + fecha, loteId: 'L1', fecha, tipo, datos });
const base = (o = {}) => ({ lotes: [lote], registros: [reg('alimento', HOY, { kg: 1 })], inventario: [], vacunasPlan: [], ...o });
const gen = (o, h = 10) => c.generarAlertas(base(o), dia(h));
const de = (as, tipo) => as.filter(a => a.tipo === tipo);

// Vacunas
let as = gen({ vacunasPlan: [{ id: 'v1', loteId: 'L1', nombre: 'Newcastle', fechaPrevista: '2026-11-02', via: 'ocular' }] });
assert.strictEqual(de(as, 'vacuna')[0].gravedad, 'rojo');
assert.strictEqual(de(as, 'vacuna')[0].id, 'vacuna-v1');
as = gen({ vacunasPlan: [{ id: 'v2', loteId: 'L1', nombre: 'Newcastle', fechaPrevista: '2026-11-04', via: 'ocular' }] });
assert.strictEqual(de(as, 'vacuna')[0].gravedad, 'ambar');
as = gen({ vacunasPlan: [{ id: 'v3', loteId: 'L1', nombre: 'N', fechaPrevista: '2026-11-02', fechaAplicada: '2026-11-02', via: 'ocular' }] });
assert.strictEqual(de(as, 'vacuna').length, 0);
as = gen({ vacunasPlan: [{ id: 'v4', loteId: 'L1', nombre: 'N', fechaPrevista: '2026-11-10', via: 'ocular' }] });
assert.strictEqual(de(as, 'vacuna').length, 0);

// Mortalidad
const esp = c.estandarDia(lote, HOY, 2800).mortEsperada; // % diario
const muertes = k => Math.round(k * esp / 100 * lote.avesInicio);
as = gen({ registros: [reg('mortalidad', HOY, { cantidad: muertes(2.5) }), reg('alimento', HOY, { kg: 1 })] });
assert.strictEqual(de(as, 'mortalidad')[0].gravedad, 'rojo');
as = gen({ registros: [reg('mortalidad', HOY, { cantidad: muertes(1.5) }), reg('alimento', HOY, { kg: 1 })] });
assert.strictEqual(de(as, 'mortalidad').length, 0);

// Postura
const dd = n => { const d = new Date(2026, 10, 3 - n); return c.hoyLocal(d); };
const hue = (n, pct) => reg('huevos', dd(n), { cantidad: pct * 1000 });
as = gen({ registros: [hue(0, 90), hue(1, 90), hue(2, 90), hue(3, 94), hue(4, 94), hue(5, 94)] });
assert.strictEqual(de(as, 'postura')[0].gravedad, 'ambar');
as = gen({ registros: [hue(0, 92), hue(1, 92), hue(2, 92), hue(3, 94), hue(4, 94), hue(5, 94)] });
assert.strictEqual(de(as, 'postura').length, 0);

// Inventario
as = gen({ inventario: [
  { id: 'i1', nombre: 'Maíz', categoria: 'alimento', cantidad: 5, unidad: 'kg', minimo: 10, costo: 1 },
  { id: 'i2', nombre: 'Soya', categoria: 'alimento', cantidad: 20, unidad: 'kg', minimo: 10, costo: 1 }] });
assert.strictEqual(de(as, 'inventario').length, 1);
assert.strictEqual(de(as, 'inventario')[0].gravedad, 'ambar');
assert.strictEqual(de(as, 'inventario')[0].accion.ruta, '#/inventario');

// Retiro
as = gen({ registros: [reg('alimento', HOY, { kg: 1 }), reg('sanidad', '2026-11-01', { enfermedad: 'x', tratamiento: 'y', retiroDias: 3 }, 's1')] });
let r = de(as, 'retiro');
assert.strictEqual(r.length, 1); assert.strictEqual(r[0].gravedad, 'rojo');
assert.strictEqual(r[0].id, 'retiro-s1');
assert.ok(r[0].texto.includes('No vendas huevos/carne hasta 2026-11-04'));
as = gen({ registros: [reg('alimento', HOY, { kg: 1 }), reg('sanidad', '2026-10-30', { enfermedad: 'x', tratamiento: 'y', retiroDias: 3 }, 's2')] });
assert.strictEqual(de(as, 'retiro').length, 0);

// Sin registro
as = c.generarAlertas(base({ registros: [] }), dia(18, 1));
assert.strictEqual(de(as, 'sin-registro')[0].gravedad, 'info');
as = c.generarAlertas(base({ registros: [] }), dia(17, 59));
assert.strictEqual(de(as, 'sin-registro').length, 0);

// Lote cerrado
as = c.generarAlertas({ lotes: [{ ...lote, estado: 'cerrado' }], registros: [],
  inventario: [], vacunasPlan: [{ id: 'v9', loteId: 'L1', nombre: 'N', fechaPrevista: '2026-11-01', via: 'ocular' }] }, dia(19));
assert.strictEqual(as.length, 0);

// Cambio de fase: postura, 17 semanas = 119 d; fase 'des' -> 'pre' ocurre en w = 16+off
const g = c.GENETICAS.find(x => x.id === 'hyline-brown');
const wCambio = 16 + (g.postura.w50 - 20.5);
const dCambio = Math.ceil(wCambio * 7);
const loteF = d => ({ ...lote, edadLlegadaDias: d, fechaLlegada: HOY });
as = c.generarAlertas(base({ lotes: [loteF(dCambio - 3)] }), dia(10));
assert.strictEqual(de(as, 'fase').length, 1); assert.strictEqual(de(as, 'fase')[0].gravedad, 'info');
as = c.generarAlertas(base({ lotes: [loteF(dCambio - 20)] }), dia(10));
assert.strictEqual(de(as, 'fase').length, 0);

// Orden
as = gen({ inventario: [{ id: 'i1', nombre: 'M', categoria: 'a', cantidad: 1, unidad: 'kg', minimo: 10, costo: 1 }],
  vacunasPlan: [{ id: 'v1', loteId: 'L1', nombre: 'N', fechaPrevista: '2026-11-02', via: 'ocular' }] });
const orden = { rojo: 0, ambar: 1, info: 2 };
for (let i = 1; i < as.length; i++) assert.ok(orden[as[i - 1].gravedad] <= orden[as[i].gravedad]);
