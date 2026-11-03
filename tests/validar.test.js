const assert = require('node:assert');
const { cargar } = require('./cargar');
const c = cargar();

assert.strictEqual(typeof c.validarRegistro, 'function', 'validarRegistro existe en calc.js');

const hoy = c.hoyLocal();
const masDias = n => { const d = new Date(); d.setDate(d.getDate() + n); return c.hoyLocal(d); };
const lote = { id: 'L1', nombre: 'A', genetica: 'hyline-brown', avesInicio: 10,
  fechaLlegada: masDias(-30), edadLlegadaDias: 0, galpon: 'G1', estado: 'activo' };
const reg = (tipo, fecha, datos, loteId = 'L1') => ({ id: tipo + fecha + Math.random(), loteId, fecha, tipo, datos });
// JSON: los objetos del contexto vm tienen otro prototipo y deepStrictEqual los distinguiría
const v = (tipo, datos, regs = [], fecha = hoy, l = lote) => JSON.parse(JSON.stringify(c.validarRegistro(tipo, datos, l, regs, fecha)));
const invalido = (r, que) => {
  assert.strictEqual(r.ok, false, que + ' debe ser inválido');
  assert.ok(typeof r.mensaje === 'string' && r.mensaje.length > 3, que + ' trae mensaje');
  assert.ok(!/NaN|undefined/.test(r.mensaje), que + ' sin NaN/undefined en el mensaje');
};

// Mortalidad: no más que las aves vivas (10 al inicio, 5 muertas antes)
const muertas = [reg('mortalidad', masDias(-3), { cantidad: 5 })];
let r = v('mortalidad', { cantidad: 6 }, muertas);
assert.deepStrictEqual({ ok: r.ok, mensaje: r.mensaje }, { ok: false, mensaje: 'Solo quedan 5 aves en el lote' });
assert.strictEqual(v('mortalidad', { cantidad: 5 }, muertas).ok, true, 'exactamente las vivas es válido');
assert.deepStrictEqual(v('mortalidad', { cantidad: 1 }), { ok: true });
invalido(v('mortalidad', { cantidad: 0 }), 'mortalidad 0');
invalido(v('mortalidad', { cantidad: -2 }), 'mortalidad negativa');
invalido(v('mortalidad', { cantidad: 1.5 }), 'mortalidad fraccionaria');
invalido(v('mortalidad', { cantidad: 'abc' }), 'mortalidad no numérica');
invalido(v('mortalidad', {}), 'mortalidad sin cantidad');
// Muertes de otro lote no cuentan
assert.strictEqual(v('mortalidad', { cantidad: 10 }, [reg('mortalidad', hoy, { cantidad: 9 }, 'L2')]).ok, true);

// Alimento, huevos, peso
invalido(v('alimento', { kg: 0 }), 'alimento 0');
invalido(v('alimento', { kg: -1 }), 'alimento negativo');
assert.strictEqual(v('alimento', { kg: 2.5 }).ok, true);
assert.strictEqual(v('huevos', { cantidad: 0 }).ok, true, 'huevos 0 es válido');
assert.strictEqual(v('huevos', { cantidad: 8, rotos: 2 }).ok, true);
invalido(v('huevos', { cantidad: -1 }), 'huevos negativos');
invalido(v('huevos', { cantidad: 2.5 }), 'huevos fraccionarios');
invalido(v('huevos', { cantidad: 3, rotos: 4 }), 'rotos > cantidad');
invalido(v('peso', { gramos: 0 }), 'peso 0');
invalido(v('peso', { gramos: -10 }), 'peso negativo');
assert.strictEqual(v('peso', { gramos: 1450 }).ok, true);

// Vacuna y sanidad
assert.strictEqual(v('vacuna', { nombre: 'Newcastle', via: 'Agua' }).ok, true);
invalido(v('vacuna', { nombre: '  ' }), 'vacuna sin nombre');
assert.strictEqual(v('sanidad', { enfermedad: 'Coriza', tratamiento: '', retiroDias: 7 }).ok, true);
invalido(v('sanidad', { enfermedad: '', tratamiento: ' ', retiroDias: 0 }), 'sanidad vacía');
invalido(v('sanidad', { enfermedad: 'Coriza', retiroDias: -1 }), 'retiro negativo');
invalido(v('otro', { x: 1 }), 'tipo desconocido');

// Fechas
invalido(v('alimento', { kg: 3 }, [], masDias(1)), 'fecha futura');
assert.ok(/futur/i.test(v('alimento', { kg: 3 }, [], masDias(1)).mensaje), 'mensaje de fecha futura');
invalido(v('alimento', { kg: 3 }, [], masDias(-31)), 'fecha antes de la llegada');
for (const f of ['2026-13-01', '2026-02-30', 'ayer', '', null, undefined, '2026-1-5', 20261103])
  invalido(c.validarRegistro('alimento', { kg: 3 }, lote, [], f), 'fecha malformada ' + JSON.stringify(f));
assert.strictEqual(v('alimento', { kg: 3 }, [], masDias(-30)).ok, true, 'el día de llegada es válido');
invalido(v('alimento', { kg: 3 }, [], hoy, null), 'sin lote');

// Duplicados del día: alimento/huevos/mortalidad/peso sí; vacuna/sanidad no
const conAlimento = [reg('alimento', hoy, { kg: 2 })];
assert.deepStrictEqual(v('alimento', { kg: 3 }, conAlimento), { ok: true, duplicado: true });
assert.deepStrictEqual(v('alimento', { kg: 3 }, [reg('alimento', masDias(-1), { kg: 2 })]), { ok: true }, 'otro día no es duplicado');
assert.deepStrictEqual(v('alimento', { kg: 3 }, [reg('alimento', hoy, { kg: 2 }, 'L2')]), { ok: true }, 'otro lote no es duplicado');
assert.deepStrictEqual(v('huevos', { cantidad: 3 }, conAlimento), { ok: true }, 'otro tipo no es duplicado');
assert.strictEqual(v('huevos', { cantidad: 3 }, [reg('huevos', hoy, { cantidad: 1 })]).duplicado, true);
assert.strictEqual(v('mortalidad', { cantidad: 1 }, [reg('mortalidad', hoy, { cantidad: 1 })]).duplicado, true);
assert.strictEqual(v('peso', { gramos: 900 }, [reg('peso', hoy, { gramos: 800 })]).duplicado, true);
const vac = [reg('vacuna', hoy, { nombre: 'Marek' })];
assert.deepStrictEqual(v('vacuna', { nombre: 'Gumboro' }, vac), { ok: true }, 'vacuna dos veces el mismo día no es duplicado');
assert.deepStrictEqual(v('sanidad', { enfermedad: 'x' }, [reg('sanidad', hoy, { enfermedad: 'y' })]), { ok: true });
// Inválido gana a duplicado
assert.strictEqual(v('alimento', { kg: 0 }, conAlimento).ok, false);
