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
