/* Plan del ciclo: lógica pura de fechas, retiros y tareas propias. (Task 6 añade la parte de DB.) */
const assert = require('node:assert');
const { cargar } = require('./cargar');

const c = cargar();
const { proximaFecha, estadoTarea, retiroVigente, validarTareaPropia } = c;
const base = '2026-11-01';
const mas = n => c.hoyLocal(new Date(2026, 10, 1 + n)); // fechaBase + n días
const T = o => Object.assign({ id: 't', loteId: 'l', origen: 'catalogo', categoria: 'alimento', titulo: 'x', detalle: '',
  desdeDia: 0, fechaBase: base, estado: 'activa', hechas: [] }, o);

// --- tarea única
const u = T({ desdeDia: 7 });
assert.strictEqual(proximaFecha(u, '2026-11-03'), '2026-11-08');
assert.strictEqual(estadoTarea(u, '2026-11-09'), 'atrasada');
assert.strictEqual(estadoTarea(u, '2026-11-08'), 'hoy');
assert.strictEqual(estadoTarea(u, '2026-11-07'), 'proxima');
assert.strictEqual(estadoTarea(T({ desdeDia: 7, hechas: [{ fecha: '2026-11-08' }] }), '2026-11-20'), 'hecha');
assert.strictEqual(estadoTarea(T({ desdeDia: 7, estado: 'quitada' }), '2026-11-08'), 'quitada');
assert.strictEqual(proximaFecha(T({ desdeDia: 7, estado: 'quitada' }), '2026-11-08'), null);

// --- repetitiva: una sola vencida como máximo
const r = T({ cadaDias: 7 });
assert.strictEqual(proximaFecha(r, mas(60)), mas(63), 'día 60: la ocurrencia 56 queda a 4 días, la próxima es la 63');
assert.strictEqual(estadoTarea(r, mas(60)), 'proxima');
assert.strictEqual(proximaFecha(r, mas(58)), mas(56), 'a 2 días de la ocurrencia: sale atrasada una sola vez');
assert.strictEqual(estadoTarea(r, mas(58)), 'atrasada');
assert.strictEqual(proximaFecha(r, mas(56)), mas(56));
assert.strictEqual(estadoTarea(r, mas(56)), 'hoy');
assert.strictEqual(proximaFecha(r, mas(59)), mas(56), 'justo a 3 días aún cuenta');
assert.strictEqual(proximaFecha(r, mas(60)), mas(63));
assert.strictEqual(proximaFecha(r, '2026-10-20'), base, 'nunca antes de fechaBase + desdeDia');
assert.strictEqual(proximaFecha(T({ cadaDias: 7, desdeDia: 3 }), '2026-11-02'), '2026-11-04');
// con hechas: última + cadaDias
const rh = T({ cadaDias: 7, hechas: [{ fecha: mas(49) }, { fecha: mas(56) }] });
assert.strictEqual(proximaFecha(rh, mas(60)), mas(63));
assert.strictEqual(proximaFecha(T({ cadaDias: 7, hechas: [{ fecha: mas(56) }, { fecha: mas(49) }] }), mas(60)), mas(63), 'toma la hecha más reciente');
assert.strictEqual(estadoTarea(rh, mas(60)), 'proxima');
assert.strictEqual(estadoTarea(rh, mas(64)), 'atrasada');

// --- hastaDia
const h = T({ cadaDias: 7, hastaDia: 30 });
assert.strictEqual(proximaFecha(h, mas(45)), null);
assert.strictEqual(estadoTarea(h, mas(45)), 'omitida');
assert.strictEqual(proximaFecha(h, mas(11)), mas(14));
assert.strictEqual(estadoTarea(T({ desdeDia: 40, hastaDia: 30 }), mas(45)), 'omitida');
assert.strictEqual(estadoTarea(T({ cadaDias: 7, hastaDia: 30, hechas: [{ fecha: mas(28) }] }), mas(45)), 'hecha', 'serie con hechas que terminó no es omitida');

const ua = T({ desdeDia: 3, hastaDia: 30 });
assert.strictEqual(proximaFecha(ua, mas(59)), null);
assert.strictEqual(estadoTarea(ua, mas(59)), 'omitida');
assert.strictEqual(estadoTarea(ua, mas(30)), 'atrasada');
assert.strictEqual(proximaFecha(ua, mas(30)), mas(3));

// --- retiroVigente
const quim = T({ categoria: 'quimico', quimico: { retiroHuevoDias: 7, retiroCarneDias: 0 }, hechas: [{ fecha: '2026-11-01', producto: 'p' }] });
assert.strictEqual(JSON.stringify(retiroVigente([quim], [], '2026-11-05')), JSON.stringify({ huevo: '2026-11-08', carne: null }));
assert.strictEqual(JSON.stringify(retiroVigente([Object.assign({}, quim, { estado: 'quitada' })], [], '2026-11-05')), JSON.stringify({ huevo: '2026-11-08', carne: null }));
assert.strictEqual(JSON.stringify(retiroVigente([quim], [], '2026-11-08')), JSON.stringify({ huevo: '2026-11-08', carne: null }), 'el día del vencimiento sigue bloqueado (hasta inclusive)');
assert.strictEqual(JSON.stringify(retiroVigente([quim], [], '2026-11-09')), JSON.stringify({ huevo: null, carne: null }));
const q2 = T({ quimico: { retiroHuevoDias: 3, retiroCarneDias: 10 }, hechas: [{ fecha: '2026-11-04' }, { fecha: '2026-11-02' }] });
assert.strictEqual(JSON.stringify(retiroVigente([quim, q2, T()], [{ fechaAplicada: '2026-11-03' }], '2026-11-05')), JSON.stringify({ huevo: '2026-11-08', carne: '2026-11-14' }));
assert.strictEqual(JSON.stringify(retiroVigente([T({ quimico: { retiroHuevoDias: 7 } })], [], '2026-11-05')), JSON.stringify({ huevo: null, carne: null }), 'sin hechas no hay retiro');
assert.strictEqual(JSON.stringify(retiroVigente(null, null, '2026-11-05')), JSON.stringify({ huevo: null, carne: null }));

// --- validarTareaPropia
const ok = { titulo: 'Revisar bebederos', categoria: 'agua', fecha: '2026-11-10', cadaDias: '' };
const v = validarTareaPropia(ok);
assert.ok(v.tarea && !v.mensaje, 'válida');
assert.strictEqual(v.tarea.titulo, 'Revisar bebederos');
assert.strictEqual(v.tarea.origen, 'propia');
assert.strictEqual(v.tarea.fechaBase, '2026-11-10');
assert.strictEqual(v.tarea.desdeDia, 0);
assert.strictEqual(v.tarea.cadaDias, undefined);
assert.strictEqual(validarTareaPropia(Object.assign({}, ok, { cadaDias: '14' })).tarea.cadaDias, 14);
assert.ok(validarTareaPropia(Object.assign({}, ok, { titulo: '' })).mensaje);
assert.ok(validarTareaPropia(Object.assign({}, ok, { titulo: '   ' })).mensaje);
assert.ok(validarTareaPropia(Object.assign({}, ok, { titulo: 'a'.repeat(81) })).mensaje);
assert.ok(validarTareaPropia(Object.assign({}, ok, { titulo: 'a'.repeat(80) })).tarea);
assert.strictEqual(validarTareaPropia(Object.assign({}, ok, { titulo: '<img onerror>' })).tarea.titulo, '<img onerror>');
assert.ok(validarTareaPropia(Object.assign({}, ok, { categoria: 'otra' })).mensaje);
assert.ok(validarTareaPropia(Object.assign({}, ok, { fecha: '2026-02-30' })).mensaje);
assert.ok(validarTareaPropia(Object.assign({}, ok, { fecha: '' })).mensaje);
for (const bad of [0, '0', -3, 366, 1.5, 'abc']) assert.ok(validarTareaPropia(Object.assign({}, ok, { cadaDias: bad })).mensaje, 'cadaDias ' + bad);
assert.strictEqual(validarTareaPropia(Object.assign({}, ok, { cadaDias: 365 })).tarea.cadaDias, 365);
for (const bad of [true, '1e1', '0x10', '-3', {}]) assert.ok(validarTareaPropia(Object.assign({}, ok, { cadaDias: bad })).mensaje, 'cadaDias ' + String(bad));
for (const good of [7, '7', ' 7 ', null, '', undefined]) assert.ok(validarTareaPropia(Object.assign({}, ok, { cadaDias: good })).tarea, 'cadaDias ' + String(good));
assert.ok(validarTareaPropia(null).mensaje);
console.log('plan (puro) OK');

/* ---------------------- Parte con DB (memoria) ---------------------- */
module.exports = (async () => {
  const J = o => JSON.parse(JSON.stringify(o));
  const hoy = c.hoyLocal(), dias = (f, n) => { const d = c.fechaADate(f); d.setDate(d.getDate() + n); return c.hoyLocal(d); };
  const g = c.GENETICAS.find(x => x.id === 'isa-brown');
  assert.strictEqual(typeof c.Plan, 'object', 'Plan existe');
  const P = c.Plan;
  const mkLote = async (extra) => J(await c.DB.guardar('lotes', Object.assign({ nombre: 'L', genetica: 'isa-brown', avesInicio: 100,
    fechaLlegada: hoy, edadLlegadaDias: 0, estado: 'activo' }, extra)));
  const filas = async id => J(await P.listar(id)).sort((a, b) => (a.id < b.id ? -1 : 1));
  const todas = async () => J(await c.DB.listar('planTareas'));

  // crearInicial: solo los ids dados, fechaBase = llegada - edad
  let l = await mkLote({ fechaLlegada: dias(hoy, -3), edadLlegadaDias: 10 });
  let r = await P.crearInicial(l, g, 'huevos', ['agua-analisis', 'agua-bebederos', 'ali-peso-postura-1', 'no-existe']);
  assert.strictEqual(r.length, 3);
  let fs3 = await filas(l.id);
  assert.strictEqual(fs3.length, 3);
  const fa = fs3.find(f => f.catalogoId === 'agua-analisis');
  assert.strictEqual(fa.fechaBase, dias(hoy, -13), 'fechaBase = llegada - edad');
  assert.strictEqual(fa.origen, 'catalogo'); assert.strictEqual(fa.estado, 'activa'); assert.deepStrictEqual(fa.hechas, []);
  assert.strictEqual(fa.loteId, l.id);
  assert.ok(fa.titulo && fa.categoria && fa.creado);

  // omite las cuyo hastaDia < edad actual (agua-bebederos hastaDia 14; edad 13 -> entra; con edad 20 no)
  let l2 = await mkLote({ edadLlegadaDias: 20 });
  r = await P.crearInicial(l2, g, 'huevos', ['agua-analisis', 'agua-bebederos']);
  assert.deepStrictEqual(J(r).map(f => f.catalogoId), ['agua-analisis']);

  // agregarCatalogo: sin duplicar; reactiva
  let l3 = await mkLote();
  const a1 = await P.agregarCatalogo(l3, 'agua-analisis'), a2 = await P.agregarCatalogo(l3, 'agua-analisis');
  assert.strictEqual(a1.id, a2.id);
  assert.strictEqual((await filas(l3.id)).length, 1);
  const concurrente = await Promise.all([P.agregarCatalogo(l3, 'agua-bebederos'), P.agregarCatalogo(l3, 'agua-bebederos')]);
  assert.strictEqual(concurrente[0].id, concurrente[1].id, 'llamadas simultáneas tampoco duplican');
  assert.strictEqual((await filas(l3.id)).length, 2);
  assert.ok((await P.agregarCatalogo(l3, 'xx')).mensaje, 'id desconocido -> mensaje');

  // quitar + deshacer restaura exactamente; quitar -> agregarCatalogo reactiva
  const antes = J(await c.DB.obtener('planTareas', a1.id));
  const des = await P.quitar(a1.id);
  assert.strictEqual(typeof des, 'function');
  let q = J(await c.DB.obtener('planTareas', a1.id));
  assert.strictEqual(q.estado, 'quitada'); assert.ok(q.quitadaEn);
  await des();
  assert.deepStrictEqual(J(await c.DB.obtener('planTareas', a1.id)), antes, 'deshacer restaura exacto');
  await P.quitar(a1.id);
  const re = await P.agregarCatalogo(l3, 'agua-analisis');
  assert.strictEqual(re.id, a1.id); assert.strictEqual(re.estado, 'activa'); assert.ok(!('quitadaEn' in J(re)));
  assert.strictEqual((await filas(l3.id)).length, 2);
  // reactivar + deshacer
  await P.quitar(a1.id);
  const quit = J(await c.DB.obtener('planTareas', a1.id));
  const des2 = await P.reactivar(a1.id);
  assert.strictEqual((await c.DB.obtener('planTareas', a1.id)).estado, 'activa');
  await des2();
  assert.deepStrictEqual(J(await c.DB.obtener('planTareas', a1.id)), quit);

  // marcarHecha: crea registro 'plan', deshacer quita ambos
  await P.reactivar(a2.id);
  assert.ok((await P.quitar(a2.id)) && (await P.marcarHecha(a2.id, {})).mensaje, 'tarea quitada no se marca');
  await P.reactivar(a2.id);
  const t0 = J(await c.DB.obtener('planTareas', a2.id));
  const regsAntes = (await c.DB.listar('registros')).length;
  const dh = await P.marcarHecha(a2.id, { nota: 'ok' });
  assert.strictEqual(typeof dh, 'function');
  let t1 = J(await c.DB.obtener('planTareas', a2.id));
  assert.strictEqual(t1.hechas.length, 1); assert.strictEqual(t1.hechas[0].fecha, hoy); assert.strictEqual(t1.hechas[0].nota, 'ok');
  const rp = J(await c.DB.listar('registros', { loteId: l3.id, tipo: 'plan' }));
  assert.strictEqual(rp.length, 1); assert.strictEqual(rp[0].datos.tareaId, a2.id); assert.strictEqual(rp[0].datos.titulo, t1.titulo);
  assert.strictEqual(rp[0].fecha, hoy);
  // validarRegistro, exportar/importar no fallan con tipo plan
  assert.ok(c.validarRegistro('plan', rp[0].datos, l3, [], hoy).ok);
  assert.ok(!c.validarRegistro('plan', { tareaId: 'x', titulo: '' }, l3, [], hoy).ok);
  const exp = await c.DB.exportar();
  assert.ok((await c.DB.importar(exp)).ok);
  assert.strictEqual((await c.DB.listar('registros', { tipo: 'plan' })).length, 1);
  await dh();
  assert.deepStrictEqual(J(await c.DB.obtener('planTareas', a2.id)), t0);
  assert.strictEqual((await c.DB.listar('registros')).length, regsAntes);

  // marcarHecha: fecha futura / inválida rechazada; fecha pasada ok
  const fut = await P.marcarHecha(a2.id, { fecha: dias(hoy, 1) });
  assert.ok(fut && fut.mensaje && typeof fut !== 'function');
  assert.ok((await P.marcarHecha(a2.id, { fecha: '2026-02-30' })).mensaje);
  assert.deepStrictEqual(J(await c.DB.obtener('planTareas', a2.id)), t0);
  assert.strictEqual((await c.DB.listar('registros', { tipo: 'plan' })).length, 0);
  assert.strictEqual(typeof (await P.marcarHecha(a2.id, { fecha: hoy })), 'function');

  // química: guarda producto y retiroVigente lo cuenta
  let l4 = await mkLote();
  const [qt] = await P.crearInicial(l4, g, 'huevos', ['qui-despara-postura']);
  assert.ok(qt.quimico && qt.quimico.retiroCarneDias === 7, 'copia el quimico del catálogo');
  await P.marcarHecha(qt.id, { producto: 'Ivermectina 1%' });
  const qh = J(await c.DB.obtener('planTareas', qt.id));
  assert.strictEqual(qh.hechas[0].producto, 'Ivermectina 1%');
  assert.strictEqual(J(await c.DB.listar('registros', { loteId: l4.id, tipo: 'plan' }))[0].datos.producto, 'Ivermectina 1%');
  assert.strictEqual(c.retiroVigente(await P.listar(l4.id), [], hoy).carne, dias(hoy, 7));
  assert.strictEqual(c.retiroVigente(await P.listar(l4.id), [], hoy).huevo, null);

  // agregarPropia
  let l5 = await mkLote();
  const pr = await P.agregarPropia(l5, { titulo: '<b>x</b>', categoria: 'limpieza', fecha: dias(hoy, 2), cadaDias: 7, detalle: '<i>d</i>' });
  assert.ok(pr.tarea, JSON.stringify(pr));
  const prFila = J(await c.DB.obtener('planTareas', pr.tarea.id));
  assert.strictEqual(prFila.titulo, '<b>x</b>'); assert.strictEqual(prFila.origen, 'propia');
  assert.strictEqual(prFila.fechaBase, dias(hoy, 2)); assert.strictEqual(prFila.desdeDia, 0);
  assert.strictEqual(prFila.cadaDias, 7); assert.strictEqual(prFila.loteId, l5.id); assert.strictEqual(prFila.estado, 'activa');
  const n5 = (await filas(l5.id)).length;
  for (const mal of [{ titulo: '', categoria: 'limpieza', fecha: hoy }, { titulo: 'x', categoria: 'zz', fecha: hoy }]) {
    const m = await P.agregarPropia(l5, mal);
    assert.ok(m.mensaje && !m.tarea);
  }
  assert.strictEqual((await filas(l5.id)).length, n5);

  // mover
  const mv = await P.agregarPropia(l5, { titulo: 'm', categoria: 'limpieza', fecha: dias(hoy, 2) });
  const mvPrev = J(await c.DB.obtener('planTareas', mv.tarea.id));
  const dm = await P.mover(mv.tarea.id, dias(hoy, 9));
  assert.strictEqual(typeof dm, 'function');
  const mvFila = J(await c.DB.obtener('planTareas', mv.tarea.id));
  assert.strictEqual(c.proximaFecha(mvFila, hoy), dias(hoy, 9));
  await dm();
  assert.deepStrictEqual(J(await c.DB.obtener('planTareas', mv.tarea.id)), mvPrev);
  const mvCat = await P.agregarCatalogo(l5, 'agua-analisis'); // repetitiva sin hechas
  await P.mover(mvCat.id, dias(hoy, 5));
  assert.strictEqual(c.proximaFecha(J(await c.DB.obtener('planTareas', mvCat.id)), hoy), dias(hoy, 5));
  assert.ok((await P.mover(mvCat.id, 'mal')).mensaje);

  // lote cerrado: nada cambia
  let lc = await mkLote({ estado: 'cerrado' });
  const tc = await P.agregarCatalogo(l5, 'agua-bebederos'); // fila del lote activo para operaciones por id
  const cerrado = J(await c.DB.guardar('lotes', Object.assign({}, l5, { estado: 'cerrado' })));
  const snap = await todas(), snapR = J(await c.DB.listar('registros'));
  const MSG = 'El lote está cerrado';
  for (const op of [() => P.crearInicial(cerrado, g, 'huevos', ['agua-analisis']), () => P.agregarCatalogo(cerrado, 'agua-analisis'),
    () => P.agregarPropia(cerrado, { titulo: 'z', categoria: 'limpieza', fecha: hoy }), () => P.quitar(tc.id), () => P.reactivar(tc.id),
    () => P.marcarHecha(tc.id, {}), () => P.mover(tc.id, dias(hoy, 3))]) {
    const res = await op();
    assert.deepStrictEqual(J(res), { mensaje: MSG });
  }
  assert.deepStrictEqual(await todas(), snap); assert.deepStrictEqual(J(await c.DB.listar('registros')), snapR);
  assert.ok(lc);

  // borrarDeLote: solo las de ese lote
  const antesL3 = (await filas(l3.id)).length, antesL5 = (await filas(l5.id)).length;
  assert.ok(antesL3 > 0 && antesL5 > 0);
  await P.borrarDeLote(l5.id);
  assert.strictEqual((await filas(l5.id)).length, 0);
  assert.strictEqual((await filas(l3.id)).length, antesL3);
  await P.borrarDeLote('inexistente');

  // tareas inexistentes
  assert.ok((await P.quitar('nope')).mensaje); assert.ok((await P.marcarHecha('nope', {})).mensaje);

  // DB.modo: memoria marcada
  assert.strictEqual(c.DB.modo, 'memoria');
  console.log('plan (DB) OK');
})();
