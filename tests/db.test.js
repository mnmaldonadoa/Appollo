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
    registros: [{ id: 11, loteId: 5, fecha: '2026-01-02', tipo: 'alimento', datos: { kg: 1, planId: 3 } },
      { id: 12, loteId: 5, fecha: '2026-01-03', tipo: 'plan', datos: { tareaId: 8, titulo: 'Agua' } }],
    vacunasPlan: [{ id: 3, loteId: 5, nombre: 'ND', fechaPrevista: '2026-01-05' }],
    planTareas: [{ id: 8, loteId: 5, titulo: 'Agua', estado: 'activa', fechaBase: '2026-01-01', desdeDia: 2, hechas: [{ fecha: '2026-01-03' }] }]
  });
  assert.ok(r.ok, JSON.stringify(r));
  assert.ok(await c.DB.obtener('lotes', '5'), 'lote 5 alcanzable por id de texto');
  assert.ok(await c.DB.obtener('inventario', '7'));
  const reg = J((await c.DB.listar('registros'))[0]);
  assert.strictEqual(reg.id, '11'); assert.strictEqual(reg.loteId, '5'); assert.strictEqual(reg.datos.planId, '3');
  const vp = J((await c.DB.listar('vacunasPlan'))[0]);
  assert.strictEqual(vp.id, '3'); assert.strictEqual(vp.loteId, '5');
  const regP = J(await c.DB.obtener('registros', '12'));
  assert.strictEqual(regP.datos.tareaId, '8', 'tareaId del registro plan pasa a texto (como planId)');
  assert.ok(await c.DB.obtener('planTareas', regP.datos.tareaId), 'y alcanza su tarea');
  assert.strictEqual((await c.DB.listar('registros', { loteId: '5' })).length, 2);

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
  assert.deepStrictEqual(orden(dd), orden({ planTareas: [], ...J(origen) }), 'y coincide con lo importado originalmente (planTareas ausente queda [])');

  /* ---- planTareas: almacén nuevo (v2 de la base) ---- */
  c = nuevo();
  const T = { id: 't1', loteId: 'L1', origen: 'catalogo', catalogoId: 'cat-x', categoria: 'sanidad', titulo: 'Vacuna', detalle: 'd', desdeDia: 7, cadaDias: 14, hastaDia: 90, fechaBase: '2026-01-01', estado: 'activa', hechas: [{ fecha: '2026-01-08', nota: 'ok', producto: 'P' }], creado: '2026-01-01T10:00:00.000Z' };
  assert.ok(c.DB.STORES.includes('planTareas'));
  await c.DB.guardar('planTareas', T);
  await c.DB.guardar('planTareas', { ...T, id: 't2', loteId: 'L2', origen: 'propia', estado: 'quitada', quitadaEn: '2026-01-20', hechas: [] });
  assert.strictEqual((await c.DB.listar('planTareas', { loteId: 'L1' })).length, 1, 'guardar/listar planTareas por loteId');
  assert.deepStrictEqual(J(await c.DB.obtener('planTareas', 't1')), T);
  assert.ok(Array.isArray(JSON.parse(await c.DB.exportar()).datos.planTareas), 'exportar incluye planTareas');
  assert.strictEqual(JSON.parse(await c.DB.exportar()).datos.planTareas.length, 2);
  // Respaldo anterior sin planTareas: no falla y deja []
  c = nuevo();
  await c.DB.guardar('planTareas', T);
  r = await importar(c, { lotes: [L] });
  assert.ok(r.ok, JSON.stringify(r));
  assert.deepStrictEqual(J(await c.DB.listar('planTareas')), [], 'sin planTareas en el respaldo queda []');
  // ids numéricos a texto
  r = await importar(c, { planTareas: [{ ...T, id: 9, loteId: 5 }] });
  assert.ok(r.ok);
  const pt = J((await c.DB.listar('planTareas'))[0]);
  assert.strictEqual(pt.id, '9'); assert.strictEqual(pt.loteId, '5');
  assert.strictEqual((await c.DB.listar('planTareas', { loteId: '5' })).length, 1);
  // ida y vuelta idéntica
  const conPlan = { lotes: [{ ...L, id: 'L1', genetica: 'isa-brown' }], planTareas: [T, { ...T, id: 't2', origen: 'propia', catalogoId: undefined, estado: 'quitada', quitadaEn: '2026-02-01', hechas: [] }].map(J) };
  assert.ok((await importar(c, conPlan)).ok);
  const txtP = await c.DB.exportar(), c3 = nuevo();
  assert.ok((await c3.DB.importar(txtP)).ok);
  assert.deepStrictEqual(orden(J(JSON.parse(await c3.DB.exportar()).datos)), orden(J(JSON.parse(txtP).datos)), 'planTareas ida y vuelta idéntico');
  assert.deepStrictEqual(orden(J(JSON.parse(txtP).datos)).planTareas, orden(J(conPlan)).planTareas);

  /* ---- Modo: memoria marcada; IndexedDB bloqueada un momento se espera y no cae a memoria ---- */
  c = nuevo();
  assert.strictEqual(c.DB.modo, null, 'sin abrir aún');
  await c.DB.abrir();
  assert.strictEqual(c.DB.modo, 'memoria');
  c = nuevo(); c.setTimeout = setTimeout; c.clearTimeout = clearTimeout;
  const bd = { closed: false, close() { this.closed = true; } };
  let intentos = 0;
  c.indexedDB = { open() {
    intentos++;
    const req = { result: bd };
    setTimeout(() => { if (req.onblocked) req.onblocked(); }, 5);
    setTimeout(() => { if (req.onsuccess) req.onsuccess(); }, 60); // la otra pestaña cierra la v1 a los 60 ms
    return req;
  } };
  assert.strictEqual((await c.DB.abrir()).modo, 'indexeddb', 'esperó el cierre de la conexión anterior');
  assert.strictEqual(intentos, 1);
  assert.strictEqual(typeof bd.onversionchange, 'function');
  bd.onversionchange(); assert.ok(bd.closed, 'onversionchange cierra la conexión');
})();