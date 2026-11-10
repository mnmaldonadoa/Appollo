/* NuevoLote.planVacunas: regla de omisión, repetición cada 63 días y corte en la edad máxima de la genética. */
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { cargar } = require('./cargar');

const ctx = cargar();
ctx.window = ctx; // nuevoLote.js cuelga VISTAS/ACCIONES de window; el resto (DB, App, DOM) solo se usa dentro de funciones
const p = path.join(__dirname, '..', 'src', 'vistas', 'nuevoLote.js');
const NuevoLote = vm.runInContext(fs.readFileSync(p, 'utf8') + '\n;NuevoLote', ctx, { filename: p });
const plan = (gid, edadLlegadaDias, fechaLlegada = '2026-01-01') =>
  JSON.parse(JSON.stringify(NuevoLote.planVacunas(ctx.GENETICAS.find(g => g.id === gid), { id: 'L1', fechaLlegada, edadLlegadaDias })));
const dias = (a, b) => Math.round((Date.UTC(...b.split('-').map((x, i) => i === 1 ? x - 1 : +x)) - Date.UTC(...a.split('-').map((x, i) => i === 1 ? x - 1 : +x))) / 864e5);
const de = (arr, id) => arr.filter(x => x.vacunaId === id).map(x => x.fechaPrevista);

// 1. Llegada a 0 días: todas las vacunas, a su día de vida, con fecha = llegada + d; ordenadas por fecha
let r = plan('hyline-brown', 0);
assert.strictEqual(de(r, 'v_marek')[0], '2026-01-02', 'Marek (día 1) = llegada + 1');
assert.strictEqual(de(r, 'v_oleo')[0], '2026-04-23', 'oleosa (día 112) = 2026-01-01 + 112');
assert.ok(r.every(x => x.loteId === 'L1' && x.nombre && x.via), 'cada vacuna lleva lote, nombre y vía');
assert.deepStrictEqual(r.map(x => x.fechaPrevista), r.map(x => x.fechaPrevista).slice().sort(), 'ordenado por fecha');

// 2. Regla de omisión: las vacunas de un día de vida anterior a la edad de llegada no se programan; la de ese mismo día sí
r = plan('hyline-brown', 35);
assert.deepStrictEqual(['v_marek', 'v_nb1', 'v_gum1', 'v_gum2'].map(id => de(r, id).length), [0, 0, 0, 0], 'omite las anteriores a los 35 días');
assert.deepStrictEqual(de(r, 'v_nb2'), ['2026-01-01'], 'la del día exacto de llegada (35) se programa ese mismo día');
assert.strictEqual(de(r, 'v_vir')[0], '2026-01-15', 'día 49 = llegada + 14');
r = plan('hyline-brown', 36);
assert.strictEqual(de(r, 'v_nb2').length, 0, 'edad 36 ya pasó el día 35');

// 3. Repetición cada 63 días (Newcastle de refuerzo) desde el día 140 hasta la edad máxima (693)
r = plan('hyline-brown', 0);
const ref = de(r, 'v_ref');
assert.strictEqual(ref.length, 9, '140, 203, ... 644 (9 aplicaciones): la siguiente, 707, pasa de 693');
assert.strictEqual(ref[0], '2026-05-21', 'primera a los 140 días');
for (let i = 1; i < ref.length; i++) assert.strictEqual(dias(ref[i - 1], ref[i]), 63, 'separadas 63 días');
assert.strictEqual(dias('2026-01-01', ref[ref.length - 1]), 644, 'última a los 644 días');
assert.ok(dias('2026-01-01', ref[ref.length - 1]) <= NuevoLote.maxDias(ctx.GENETICAS.find(g => g.id === 'hyline-brown')), 'nunca después de la edad máxima');
assert.strictEqual(r.length, 10 + 9, '10 vacunas de una sola vez + 9 aplicaciones del refuerzo');

// 4. Omisión también en las repeticiones: llegada a 200 días -> solo desde el día 203
r = plan('hyline-brown', 200);
assert.deepStrictEqual(de(r, 'v_ref').map(f => dias('2026-01-01', f)), [3, 66, 129, 192, 255, 318, 381, 444], 'repeticiones 203..644 desde la llegada a 200');
assert.strictEqual(de(r, 'v_cor2').length, 0);
assert.strictEqual(r.length, 8, 'a los 200 días solo quedan las repeticiones');

// 5. Corte exacto: si la repetición cae justo en la edad máxima, entra; un día más, no
assert.strictEqual(NuevoLote.maxDias(ctx.GENETICAS.find(g => g.id === 'hyline-brown')), 693);
r = plan('hyline-brown', 693);
assert.strictEqual(r.length, 0, 'llegar con la edad máxima: no queda nada por programar');

// 6. Carne: sin repeticiones, y solo hasta lo que dura el ciclo
r = plan('cobb500', 0);
assert.deepStrictEqual(r.map(x => x.vacunaId), ['b_inc', 'b_nb', 'b_gum', 'b_nd'], 'Cobb 500: las 4 vacunas, ordenadas');
assert.deepStrictEqual(plan('cobb500', 10).map(x => x.vacunaId), ['b_gum', 'b_nd'], 'llegar a 10 días omite Newcastle del día 8');
r = plan('campero', 30);
assert.deepStrictEqual(r.map(x => x.vacunaId), ['b_vir', 'b_nd2']);

// 7. Criolla repite Newcastle cada 63 días (140 + 63k) como la de postura
r = plan('criolla', 0);
assert.ok(de(r, 'v_ref').length >= 2 && dias(de(r, 'v_ref')[0], de(r, 'v_ref')[1]) === 63);
console.log('ok   nuevolote.test.js');
