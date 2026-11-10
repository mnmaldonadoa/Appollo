/* DB en modo memoria (sin indexedDB en el contexto): migración v1, importar y respaldo completo. */
const assert = require('node:assert');
const { cargar } = require('./cargar');

const nuevo = () => { const c = cargar(); return c; };
const J = o => JSON.parse(JSON.stringify(o));
const importar = (c, datos) => c.DB.importar(JSON.stringify({ version: 1, datos }));

module.exports = (async () => {
  /* ---- Migración v1: edad, fecha local, snapshot del plan ---- */
  let c = nuevo();
  const plan40 = { gid: 'hyline-brown', obj: 'huevos', edad: 40, unidad: 'semanas', aves: 500, alt: 2800, real: null, fin: 630, sel: ['q_amp'], enf: null, filtro: 'todas' };
  const planCarne = { gid: 'cobb500', obj: 'carne', edad: 14, unidad: 'dias', aves: 300, alt: 2800, real: null, fin: 42, sel: [], enf: null, filtro: 'todas' };
  c.localStorage.setItem('appollo.v1.lotes', JSON.stringify([
    { id: '1', fecha: '2026-03-05T10:00:00.000Z', nombre: 'x', resumen: 'r1', estado: plan40 },
    { id: '2', fecha: '2026-03-06T10:00:00.000Z', nombre: 'y', resumen: 'r2', estado: planCarne },
    { id: '3', fecha: '2026-03-06T10:00:00.000Z', resumen: 'sin edad', estado: { gid: 'isa-brown', aves: 10 } }
  ]));
  assert.strictEqual(await c.DB.migrarLS(), 3);
  const ls = J(await c.DB.listar('lotes')), por = id => ls.find(l => l.id === id);
  assert.strictEqual(por('ls-1').edadLlegadaDias, 280, '40 semanas = 280 días');
  assert.strictEqual(por('ls-2').edadLlegadaDias, 14, '14 días');
  assert.strictEqual(por('ls-3').edadLlegadaDias, 0);
  assert.deepStrictEqual(por('ls-1').planV1, plan40, 'guarda el plan v1');
  assert.deepStrictEqual(por('ls-2').planV1, planCarne);
  assert.strictEqual(por('ls-1').estado, 'cerrado');
  // La edad mostrada el día de llegada es la edad guardada
  assert.strictEqual(c.edadDias(por('ls-1'), por('ls-1').fechaLlegada), 280);
  assert.strictEqual(por('ls-1').fechaCierre, por('ls-1').fechaLlegada, 'cerrado el día del guardado: la edad queda fija');
  assert.strictEqual(c.edadDias(por('ls-1'), por('ls-1').fechaCierre), 280);

  /* ---- Fecha: se toma en hora local (no el día UTC) ---- */
  c = nuevo();
  const tarde = new Date(2026, 2, 5, 23, 0, 0); // 23:00 locales del 5/mar, que en UTC puede ser el 6 (o el 5)
  c.localStorage.setItem('appollo.v1.lotes', JSON.stringify([{ id: '9', fecha: tarde.toISOString(), estado: { gid: 'isa-brown', aves: 5 } }]));
  await c.DB.migrarLS();
  assert.strictEqual((await c.DB.obtener('lotes', 'ls-9')).fechaLlegada, '2026-03-05');

  /* ---- importar: ids a texto ---- */
  c = nuevo();
  const L = { id: 5, nombre: 'N', genetica: 'isa-brown', avesInicio: 10, fechaLlegada: '2026-01-01', edadLlegadaDias: 0, estado: 'activo' };
  let r = await importar(c, {
    lotes: [L], inventario: [{ id: 7, nombre: 'Maíz', cantidad: 3 }],
    registros: [{ id: 11, loteId: 5, fecha: '2026-01-02', tipo: 'alimento', datos: { kg: 1, planId: 3 } }],
    vacunasPlan: [{ id: 3, loteId: 5, nombre: 'ND', fechaPrevista: '2026-01-05' }]
  });
  assert.ok(r.ok, JSON.stringify(r));
  assert.ok(await c.DB.obtener('lotes', '5'), 'lote 5 alcanzable por id de texto');
  assert.ok(await c.DB.obtener('inventario', '7'));
  const reg = J((await c.DB.listar('registros'))[0]);
  assert.strictEqual(reg.id, '11'); assert.strictEqual(reg.loteId, '5'); assert.strictEqual(reg.datos.planId, '3');
  const vp = J((await c.DB.listar('vacunasPlan'))[0]);
  assert.strictEqual(vp.id, '3'); assert.strictEqual(vp.loteId, '5');
  assert.strictEqual((await c.DB.listar('registros', { loteId: '5' })).length, 1);

  /* ---- importar: genética desconocida se normaliza (no revienta alertas) ---- */
  r = await importar(c, { lotes: [{ ...L, id: 'a', genetica: 'marciana' }, { ...L, id: 'b', genetica: 42 }], registros: [
    { id: 'r1', loteId: 'a', fecha: '2026-11-03', tipo: 'mortalidad', datos: { cantidad: 5 } }] });
  assert.ok(r.ok);
  const a = J(await c.DB.obtener('lotes', 'a'));
  assert.strictEqual(a.genetica, null); assert.strictEqual(a.geneticaOriginal, 'marciana');
  assert.strictEqual(J(await c.DB.obtener('lotes', 'b')).genetica, null);

  /* ---- alertas: lote con genética desconocida se omite, no lanza ---- */
  const datos = { lotes: [{ ...L, id: 'x', genetica: 'marciana' }], registros: [{ id: 'r', loteId: 'x', fecha: '2026-11-03', tipo: 'mortalidad', datos: { cantidad: 5 } }], inventario: [], vacunasPlan: [] };
  assert.doesNotThrow(() => c.generarAlertas(datos, new Date(2026, 10, 3, 10)));
  assert.doesNotThrow(() => c.alertaMortalidad(datos, '2026-11-03'));
  assert.deepStrictEqual(J(c.alertaMortalidad(datos, '2026-11-03')), []);
  const sinGen = { ...datos, lotes: [{ ...datos.lotes[0], genetica: null }] };
  assert.doesNotThrow(() => c.generarAlertas(sinGen, new Date(2026, 10, 3, 10)));

  /* ---- respaldo: ida y vuelta con contenido completo ---- */
  c = nuevo();
  const origen = {
    granja: [{ id: 'granja', nombre: 'La Tola', tipo: 'postura', altitud: 2800, tema: 'oscuro', precios: { cubeta: 3.6 } }],
    lotes: [{ ...L, id: 'L1', genetica: 'hyline-brown', galpon: 'G1', planV1: { gid: 'isa-brown', edad: 3, unidad: 'dias' } }, { ...L, id: 'L2', genetica: 'cobb500', estado: 'cerrado', fechaCierre: '2026-02-01' }],
    registros: [{ id: 'g1', loteId: 'L1', fecha: '2026-01-03', tipo: 'huevos', datos: { cantidad: 90, rotos: 2 }, creado: '2026-01-03T10:00:00.000Z' },
      { id: 'g2', loteId: 'L1', fecha: '2026-01-03', tipo: 'alimento', datos: { kg: 12.5, descontadoKg: 12.5 }, creado: '2026-01-03T11:00:00.000Z' }],
    inventario: [{ id: 'i1', nombre: 'Balanceado', tipo: 'alimento', cantidad: 80, unidad: 'kg', extra: { x: 1 } }],
    vacunasPlan: [{ id: 'v1', loteId: 'L1', nombre: 'Newcastle', fechaPrevista: '2026-01-10', via: 'ocular', fechaAplicada: '2026-01-10' }]
  };
  assert.ok((await importar(c, origen)).ok);
  const txt = await c.DB.exportar();
  const c2 = nuevo();
  assert.ok((await c2.DB.importar(txt)).ok);
  const dd = J(JSON.parse(await c2.DB.exportar()).datos), d0 = J(JSON.parse(txt).datos);
  const orden = o => { for (const k of Object.keys(o)) o[k].sort((a, b) => String(a.id).localeCompare(String(b.id))); return o; };
  assert.deepStrictEqual(orden(dd), orden(d0), 'el respaldo conserva todo el contenido');
  assert.deepStrictEqual(orden(dd), orden(J(origen)), 'y coincide con lo importado originalmente');
})();
