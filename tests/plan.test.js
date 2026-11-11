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

// --- única sin hastaDia: omitida a los 30 días sin hacerse (no se acumula para siempre)
const u30 = T({ desdeDia: 7 }); // fecha 2026-11-08
assert.strictEqual(proximaFecha(u30, '2026-12-08'), '2026-11-08', 'a 30 días aún atrasada');
assert.strictEqual(estadoTarea(u30, '2026-12-08'), 'atrasada');
assert.strictEqual(proximaFecha(u30, '2026-12-09'), null, 'a 31 días ya no hay próxima');
assert.strictEqual(estadoTarea(u30, '2026-12-09'), 'omitida');
assert.strictEqual(estadoTarea(T({ desdeDia: 7, hechas: [{ fecha: '2026-11-20' }] }), '2027-02-01'), 'hecha', 'hecha no pasa a omitida');
assert.strictEqual(proximaFecha(T({ cadaDias: 7 }), '2027-02-01'), '2027-01-31', 'las repetitivas no se omiten');

// --- retiroVigente: tratamiento de varios días (se cuenta desde la última hecha registrada)
const multi = T({ quimico: { retiroHuevoDias: 0, retiroCarneDias: 7 }, hechas: [{ fecha: '2026-11-01' }] });
assert.strictEqual(retiroVigente([multi], [], '2026-11-03').carne, '2026-11-08', 'primer día registrado: 01/11 + 7');
const multi2 = Object.assign({}, multi, { hechas: [{ fecha: '2026-11-01' }, { fecha: '2026-11-07' }] }); // último día del tratamiento
assert.strictEqual(retiroVigente([multi2], [], '2026-11-03').carne, '2026-11-14', 'con la última dosis 07/11: hasta el 14/11');
assert.strictEqual(retiroVigente([multi2], [], '2026-11-12').carne, '2026-11-14');
assert.strictEqual(retiroVigente([multi2], [], '2026-11-15').carne, null);
assert.strictEqual(retiroVigente([Object.assign({}, multi, { hechas: [{ fecha: '2026-11-07' }, { fecha: '2026-11-01' }] })], [], '2026-11-03').carne, '2026-11-14', 'el orden de las hechas no importa');
assert.strictEqual(retiroVigente([multi2], [], '2026-11-03').huevo, null, 'retiro 0 en huevo: nada que bloquear');
// días según la etiqueta (en la hecha) mandan sobre el catálogo
const etq = T({ quimico: { retiroHuevoDias: null, retiroCarneDias: null }, hechas: [{ fecha: '2026-11-04', etiquetaHuevoDias: 5, etiquetaCarneDias: 12 }] });
assert.strictEqual(JSON.stringify(retiroVigente([etq], [], '2026-11-05')), JSON.stringify({ huevo: '2026-11-09', carne: '2026-11-16' }));
const etq2 = T({ quimico: { retiroHuevoDias: 3, retiroCarneDias: 7 }, hechas: [{ fecha: '2026-11-04', etiquetaHuevoDias: 10 }] });
assert.strictEqual(JSON.stringify(retiroVigente([etq2], [], '2026-11-05')), JSON.stringify({ huevo: '2026-11-14', carne: '2026-11-11' }), 'la etiqueta de huevo manda; carne sigue el catálogo');
const etq0 = T({ quimico: { retiroHuevoDias: 3, retiroCarneDias: null }, hechas: [{ fecha: '2026-11-04', etiquetaHuevoDias: 0 }] });
assert.strictEqual(JSON.stringify(retiroVigente([etq0], [], '2026-11-05')), JSON.stringify({ huevo: null, carne: null }), 'etiqueta 0: sin retiro');

// --- diasEtiqueta: entero de 0 a 365 u omitido
for (const vac of ['', '  ', null, undefined]) assert.strictEqual(c.diasEtiqueta(vac).valor, null, 'vacío ' + String(vac));
assert.strictEqual(c.diasEtiqueta('0').valor, 0); assert.strictEqual(c.diasEtiqueta(' 14 ').valor, 14);
assert.strictEqual(c.diasEtiqueta(365).valor, 365); assert.strictEqual(c.diasEtiqueta('365').valor, 365);
for (const bad of ['366', '-1', '1.5', 'abc', '1e1', 1.5, -2, 400, true, {}]) {
  assert.strictEqual(c.diasEtiqueta(bad).mensaje, 'Los días de retiro deben ser un número entero de 0 a 365', 'mal ' + String(bad));
}

// --- avisosEtiqueta: producto que reciben las aves sin retiro conocido -> revisar la etiqueta 14 días
const sinRet = T({ id: 'am', titulo: 'Amprolio', quimico: { enAves: true, retiroHuevoDias: null, retiroCarneDias: null },
  hechas: [{ fecha: '2026-11-02' }, { fecha: '2026-11-05', producto: 'Amprolin' }] });
let av = c.avisosEtiqueta([sinRet], '2026-11-05', 'huevos');
assert.strictEqual(av.length, 1);
assert.strictEqual(av[0].texto, 'Aplicaste Amprolin el 05/11: revisa en la etiqueta el retiro en huevos y carne antes de venderlos');
assert.strictEqual(av[0].tareaId, 'am'); assert.strictEqual(av[0].fecha, '2026-11-05');
assert.strictEqual(av[0].huevo, true); assert.strictEqual(av[0].carne, true);
assert.strictEqual(c.avisosEtiqueta([sinRet], '2026-11-19', 'huevos').length, 1, 'el día 14 sigue');
assert.strictEqual(c.avisosEtiqueta([sinRet], '2026-11-20', 'huevos').length, 0, 'el día 15 ya no');
assert.strictEqual(c.avisosEtiqueta([sinRet], '2026-11-04', 'huevos').length, 1, 'antes de la última hecha: cuenta la anterior');
assert.strictEqual(c.avisosEtiqueta([sinRet], '2026-11-04', 'huevos')[0].fecha, '2026-11-02');
assert.strictEqual(c.avisosEtiqueta([sinRet], '2026-11-01', 'huevos').length, 0, 'antes de aplicar nada');
assert.strictEqual(c.avisosEtiqueta([sinRet], '2026-11-06', 'carne')[0].texto, 'Aplicaste Amprolin el 05/11: revisa en la etiqueta el retiro en carne antes de venderla', 'aves de carne: solo carne');
const soloHuevo = Object.assign({}, sinRet, { titulo: 'Piojos', quimico: { enAves: true, retiroHuevoDias: null, retiroCarneDias: 0 }, hechas: [{ fecha: '2026-11-05' }] });
assert.strictEqual(c.avisosEtiqueta([soloHuevo], '2026-11-06', 'huevos')[0].texto, 'Aplicaste Piojos el 05/11: revisa en la etiqueta el retiro en huevos antes de venderlos', 'sin producto: el título');
assert.strictEqual(c.avisosEtiqueta([soloHuevo], '2026-11-06', 'carne').length, 0, 'carne con retiro 0 conocido: nada');
assert.strictEqual(c.avisosEtiqueta([Object.assign({}, soloHuevo, { estado: 'quitada' })], '2026-11-06', 'huevos').length, 1, 'también si la tarea se quitó');
const conEtq = Object.assign({}, sinRet, { hechas: [{ fecha: '2026-11-05', etiquetaHuevoDias: 0 }] });
assert.strictEqual(c.avisosEtiqueta([conEtq], '2026-11-06', 'huevos')[0].texto, 'Aplicaste Amprolio el 05/11: revisa en la etiqueta el retiro en carne antes de venderla', 'huevo ya revisado en la etiqueta');
assert.strictEqual(c.avisosEtiqueta([Object.assign({}, sinRet, { hechas: [{ fecha: '2026-11-05', etiquetaHuevoDias: 2, etiquetaCarneDias: 9 }] })], '2026-11-06', 'huevos').length, 0, 'ambos revisados');
assert.strictEqual(c.avisosEtiqueta([Object.assign({}, sinRet, { quimico: { retiroHuevoDias: null, retiroCarneDias: null } })], '2026-11-06', 'huevos').length, 0, 'no va en las aves (desinfectante, cebo): sin aviso');
assert.strictEqual(c.avisosEtiqueta([Object.assign({}, sinRet, { hechas: [] })], '2026-11-06', 'huevos').length, 0, 'sin hechas');
assert.strictEqual(c.avisosEtiqueta([T()], '2026-11-06', 'huevos').length, 0, 'sin químico');
assert.strictEqual(c.avisosEtiqueta([sinRet], '2026-11-06', null)[0].huevo, true, 'modo desconocido: también huevos');
assert.strictEqual(c.avisosEtiqueta(null, '2026-11-06', 'huevos').length, 0);

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

  // crearInicial con edad de llegada E: las únicas con desdeDia < E no se crean; las repetitivas sí, sin atrasadas
  const todoIsa = c.tareasDelCatalogo(g, 'huevos').map(t => t.id);
  const l30 = await mkLote({ edadLlegadaDias: 30 }); // llega hoy con 30 días
  const f30 = J(await P.crearInicial(l30, g, 'huevos', todoIsa));
  assert.ok(f30.every(f => Number(f.cadaDias) > 0 || f.desdeDia >= 30), 'E=30: ninguna única con desdeDia < 30');
  assert.ok(!f30.some(f => f.catalogoId === 'lle-precalentar' || f.catalogoId === 'ali-isa-crecimiento'), 'E=30: sin precalentar (0) ni crecimiento (28)');
  assert.ok(f30.some(f => f.catalogoId === 'qui-roedores'), 'E=30: la repetitiva de roedores (desde 0, cada 7) sí');
  assert.strictEqual(f30.length, 30, 'E=30: 30 filas (la noPostura de cocci, única del día 0, tampoco entra)');
  assert.strictEqual(f30.filter(f => c.estadoTarea(f, hoy) === 'atrasada').length, 0, 'E=30: 0 atrasadas el día de llegada');
  const roe = f30.find(f => f.catalogoId === 'qui-roedores');
  assert.strictEqual(roe.proxima, dias(hoy, 5), 'roedores: día 0 + 7k; la primera desde la llegada (día 30) es el 35');
  assert.strictEqual(c.proximaFecha(roe, hoy), dias(hoy, 5));
  // llegada pasada (hace 20 días con 30 días; hoy tienen 50): ninguna atrasada y ninguna `proxima` en el pasado
  const lp = await mkLote({ fechaLlegada: dias(hoy, -20), edadLlegadaDias: 30 });
  const fp = J(await P.crearInicial(lp, g, 'huevos', todoIsa));
  assert.strictEqual(fp.filter(f => c.estadoTarea(f, hoy) === 'atrasada').length, 0, 'llegada pasada: 0 atrasadas');
  assert.ok(fp.every(f => !('proxima' in f) || f.proxima >= hoy), 'nunca una próxima pasada');
  const roeP = fp.find(f => f.catalogoId === 'qui-roedores'); // serie desde hace 50 días cada 7: 50 = 7*7+1 -> la siguiente en 6 días
  assert.strictEqual(c.proximaFecha(roeP, hoy), dias(hoy, 6));
  const l0 = await mkLote({ edadLlegadaDias: 0 });
  const f0 = J(await P.crearInicial(l0, g, 'huevos', todoIsa));
  assert.ok(f0.some(f => f.catalogoId === 'lle-precalentar') && f0.some(f => f.catalogoId === 'lle-alimento-papel'), 'E=0: las de antes/al llegar se crean');
  assert.strictEqual(f0.length, 61, 'E=0: 61 filas (la noPostura no entra en postura)');
  assert.ok(f0.every(f => !('proxima' in f)), 'E=0: sin próxima forzada');
  // agregar después desde el catálogo no pasa por la regla (elección explícita)
  const tarde = J(await P.agregarCatalogo(l30, 'lle-precalentar'));
  assert.strictEqual(tarde.catalogoId, 'lle-precalentar'); assert.strictEqual(tarde.estado, 'activa');

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

  // químico de varios días: otra «Hecho» con el último día mueve el retiro (flubendazol: carne 7)
  const lM = await mkLote({ fechaLlegada: dias(hoy, -20) });
  const [fm] = await P.crearInicial(lM, g, 'huevos', ['qui-despara-postura']);
  assert.strictEqual(typeof (await P.marcarHecha(fm.id, { fecha: dias(hoy, -6) })), 'function');
  assert.strictEqual(c.retiroVigente(await P.listar(lM.id), [], hoy).carne, dias(hoy, 1), 'primer día: -6 + 7');
  assert.strictEqual(c.estadoTarea(J(await c.DB.obtener('planTareas', fm.id)), hoy), 'hecha');
  assert.strictEqual(typeof (await P.marcarHecha(fm.id, { fecha: hoy })), 'function', 'una química ya hecha acepta otra hecha (último día)');
  const fm2 = J(await c.DB.obtener('planTareas', fm.id));
  assert.strictEqual(fm2.hechas.length, 2);
  assert.strictEqual(c.retiroVigente([fm2], [], hoy).carne, dias(hoy, 7), 'retiro desde el último día registrado');
  assert.strictEqual(J(await c.DB.listar('registros', { loteId: lM.id, tipo: 'plan' })).length, 2);
  // días de retiro según la etiqueta: se validan y se guardan en la hecha (y en el registro)
  const [fa2] = await P.crearInicial(lM, g, 'huevos', ['qui-cocci-amprolio']);
  const antesE = J(await c.DB.obtener('planTareas', fa2.id)), nRegE = (await c.DB.listar('registros')).length;
  for (const mal of ['366', '-1', '2.5', 'x']) {
    assert.strictEqual((await P.marcarHecha(fa2.id, { fecha: hoy, etiquetaHuevoDias: mal })).mensaje, 'Los días de retiro deben ser un número entero de 0 a 365', 'huevo ' + mal);
    assert.strictEqual((await P.marcarHecha(fa2.id, { fecha: hoy, etiquetaCarneDias: mal })).mensaje, 'Los días de retiro deben ser un número entero de 0 a 365', 'carne ' + mal);
  }
  assert.deepStrictEqual(J(await c.DB.obtener('planTareas', fa2.id)), antesE, 'rechazo no toca la fila');
  assert.strictEqual((await c.DB.listar('registros')).length, nRegE, 'rechazo no crea registro');
  const dE = await P.marcarHecha(fa2.id, { fecha: dias(hoy, -1), etiquetaHuevoDias: '3', etiquetaCarneDias: '' });
  assert.strictEqual(typeof dE, 'function');
  const fe = J(await c.DB.obtener('planTareas', fa2.id));
  assert.strictEqual(fe.hechas[0].etiquetaHuevoDias, 3); assert.ok(!('etiquetaCarneDias' in fe.hechas[0]), 'vacío no se guarda');
  assert.strictEqual(c.retiroVigente([fe], [], hoy).huevo, dias(hoy, 2), 'la etiqueta manda: -1 + 3');
  const rE = J(await c.DB.listar('registros', { loteId: lM.id, tipo: 'plan' })).find(x => x.datos.tareaId === fa2.id);
  assert.strictEqual(rE.datos.etiquetaHuevoDias, 3);
  assert.strictEqual(c.avisosEtiqueta([fe], hoy, 'huevos')[0].texto, 'Aplicaste ' + fe.titulo + ' el ' + dias(hoy, -1).slice(8, 10) + '/' + dias(hoy, -1).slice(5, 7) + ': revisa en la etiqueta el retiro en carne antes de venderla');
  await dE();
  assert.deepStrictEqual(J(await c.DB.obtener('planTareas', fa2.id)), antesE, 'deshacer restaura');
  // en una labor no química los días de etiqueta se ignoran
  const pnq = (await P.agregarPropia(lM, { titulo: 'Agua', categoria: 'agua', fecha: hoy })).tarea;
  await P.marcarHecha(pnq.id, { etiquetaHuevoDias: '999' });
  assert.ok(!('etiquetaHuevoDias' in J(await c.DB.obtener('planTareas', pnq.id)).hechas[0]));

  // noPostura: nunca en lotes de postura, ni al crear ni al agregar (defensa en profundidad)
  const lN = await mkLote();
  const fN = J(await P.crearInicial(lN, g, 'huevos', ['qui-cocci-pollitas', 'agua-analisis']));
  assert.deepStrictEqual(fN.map(f => f.catalogoId), ['agua-analisis'], 'crearInicial salta la noPostura en huevos');
  assert.strictEqual((await P.agregarCatalogo(lN, 'qui-cocci-pollitas')).mensaje, 'Solo para crianza de pollitas; no aplica en gallinas ya en postura');
  assert.strictEqual((await filas(lN.id)).length, 1);
  const gR = c.GENETICAS.find(x => x.id === 'ross308');
  const lR = await mkLote({ genetica: 'ross308' });
  assert.deepStrictEqual(J(await P.crearInicial(lR, gR, 'carne', ['qui-cocci-toltrazuril'])).map(f => f.catalogoId), ['qui-cocci-toltrazuril'], 'en carne sí');
  assert.strictEqual(J(await P.agregarCatalogo(lR, 'qui-cocci-broiler')).catalogoId, 'qui-cocci-broiler');

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

  // mover una repetitiva con hechas
  const l6 = await mkLote({ fechaLlegada: dias(hoy, -30) });
  const rep = await P.agregarPropia(l6, { titulo: 'rep', categoria: 'limpieza', fecha: dias(hoy, -20), cadaDias: 7 });
  await P.marcarHecha(rep.tarea.id, { fecha: dias(hoy, -2) });
  const repPrev = J(await c.DB.obtener('planTareas', rep.tarea.id));
  assert.strictEqual(c.proximaFecha(repPrev, hoy), dias(hoy, 5));
  const dr = await P.mover(rep.tarea.id, dias(hoy, 10));
  assert.strictEqual(typeof dr, 'function');
  let rf = J(await c.DB.obtener('planTareas', rep.tarea.id));
  assert.strictEqual(c.proximaFecha(rf, hoy), dias(hoy, 10)); assert.strictEqual(c.estadoTarea(rf, hoy), 'proxima');
  await dr();
  assert.deepStrictEqual(J(await c.DB.obtener('planTareas', rep.tarea.id)), repPrev, 'deshacer mover restaura la fila exacta');
  await P.mover(rep.tarea.id, dias(hoy, -1));
  rf = J(await c.DB.obtener('planTareas', rep.tarea.id));
  assert.strictEqual(c.proximaFecha(rf, hoy), dias(hoy, -1)); assert.strictEqual(c.estadoTarea(rf, hoy), 'atrasada');
  await P.mover(rep.tarea.id, dias(hoy, 10));
  await P.marcarHecha(rep.tarea.id, { fecha: hoy });
  rf = J(await c.DB.obtener('planTareas', rep.tarea.id));
  assert.ok(!('proxima' in rf), 'marcarHecha borra proxima');
  assert.strictEqual(c.proximaFecha(rf, hoy), dias(hoy, 7));

  // rechazos de mover: fecha <= última hecha (fila intacta) y tarea quitada
  const antesRech = J(await c.DB.obtener('planTareas', rep.tarea.id));
  for (const d of [-10, -2]) {
    const m = await P.mover(rep.tarea.id, dias(hoy, d));
    assert.strictEqual(m.mensaje, 'No se puede mover esta tarea a esa fecha', 'dia ' + d);
  }
  assert.deepStrictEqual(J(await c.DB.obtener('planTareas', rep.tarea.id)), antesRech);
  assert.strictEqual(typeof (await P.mover(rep.tarea.id, dias(hoy, 3))), 'function');
  await P.quitar(rep.tarea.id);
  const quitRech = J(await c.DB.obtener('planTareas', rep.tarea.id));
  assert.strictEqual((await P.mover(rep.tarea.id, dias(hoy, 20))).mensaje, 'La tarea está quitada: reactívala primero');
  assert.deepStrictEqual(J(await c.DB.obtener('planTareas', rep.tarea.id)), quitRech);

  // Reportes: un registro 'plan' no rompe ni cuenta
  {
    const lr = { id: 'R', genetica: 'isa-brown', avesInicio: 50, fechaLlegada: dias(hoy, -5), edadLlegadaDias: 0, estado: 'activo' };
    const base = [{ id: 'a', loteId: 'R', fecha: dias(hoy, -1), tipo: 'alimento', datos: { kg: 5 } }];
    const conPlan = base.concat([{ id: 'p', loteId: 'R', fecha: dias(hoy, -1), tipo: 'plan', datos: { tareaId: 't', titulo: '<b>x</b>' } }]);
    const r1 = c.resumenReporte(lr, base, dias(hoy, -4), hoy, {}), r2 = c.resumenReporte(lr, conPlan, dias(hoy, -4), hoy, {});
    assert.strictEqual(JSON.stringify(r2), JSON.stringify(r1));
    assert.ok(c.textoReporte(r2, lr, 'periodo', { nombre: 'G' }));
  }

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

  // editar: título y detalle; valida; deshacer restaura exacto; quitada y cerrado rechazan
  const lEd = await mkLote();
  const ed = (await P.agregarPropia(lEd, { titulo: 'Original', categoria: 'agua', fecha: hoy, detalle: 'd0' })).tarea;
  const edPrev = J(await c.DB.obtener('planTareas', ed.id));
  const de1 = await P.editar(ed.id, { titulo: '  <b>Nuevo</b>  ', detalle: '  nota  ' });
  assert.strictEqual(typeof de1, 'function');
  let edF = J(await c.DB.obtener('planTareas', ed.id));
  assert.strictEqual(edF.titulo, '<b>Nuevo</b>'); assert.strictEqual(edF.detalle, 'nota');
  assert.strictEqual(edF.fechaBase, edPrev.fechaBase); assert.deepStrictEqual(edF.hechas, edPrev.hechas);
  await de1();
  assert.deepStrictEqual(J(await c.DB.obtener('planTareas', ed.id)), edPrev, 'deshacer editar restaura exacto');
  assert.ok((await P.editar(ed.id, { titulo: '   ', detalle: '' })).mensaje, 'título vacío');
  assert.ok((await P.editar(ed.id, { titulo: 'x'.repeat(81) })).mensaje, 'título largo');
  assert.ok((await P.editar(ed.id, { titulo: 'ok', detalle: 'y'.repeat(501) })).mensaje, 'detalle largo');
  assert.deepStrictEqual(J(await c.DB.obtener('planTareas', ed.id)), edPrev, 'rechazos no tocan nada');
  await P.quitar(ed.id);
  assert.ok((await P.editar(ed.id, { titulo: 'z' })).mensaje, 'quitada no se edita');
  await P.reactivar(ed.id);
  await c.DB.guardar('lotes', Object.assign({}, lEd, { estado: 'cerrado' }));
  assert.strictEqual((await P.editar(ed.id, { titulo: 'z' })).mensaje, 'El lote está cerrado');
  assert.ok((await P.editar('nope', { titulo: 'z' })).mensaje);

  // tareas inexistentes
  assert.ok((await P.quitar('nope')).mensaje); assert.ok((await P.marcarHecha('nope', {})).mensaje);

  // DB.modo: memoria marcada
  assert.strictEqual(c.DB.modo, 'memoria');
  console.log('plan (DB) OK');
})();
