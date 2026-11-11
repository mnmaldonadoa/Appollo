/* PlanCiclo.secciones / PlanCiclo.html: reparto en secciones, escape, tarjeta química, solo lectura en lote cerrado. */
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { cargar } = require('./cargar');

const c = cargar();
c.window = c; // planCiclo.js cuelga ACCIONES de window; DB/App/DOM solo se usan dentro de las acciones
const p = path.join(__dirname, '..', 'src', 'vistas', 'planCiclo.js');
const PC = vm.runInContext(fs.readFileSync(p, 'utf8') + '\n;PlanCiclo', c, { filename: p });

const hoy = '2026-11-10';
const T = o => Object.assign({ loteId: 'L1', origen: 'catalogo', categoria: 'agua', titulo: 'x', detalle: '',
  desdeDia: 0, fechaBase: '2026-11-01', estado: 'activa', hechas: [] }, o);
const tareas = [
  T({ id: 'atr', titulo: 'Atrasada', desdeDia: 5 }),                       // 06/11
  T({ id: 'hoy', titulo: 'De hoy', desdeDia: 9 }),                          // 10/11
  T({ id: 'sem', titulo: 'En la semana', desdeDia: 16 }),                   // 17/11 = hoy + 7
  T({ id: 'pro', titulo: 'Más adelante', desdeDia: 17 }),                   // 18/11
  T({ id: 'hec', titulo: 'Ya hecha', desdeDia: 2, hechas: [{ fecha: '2026-11-03', nota: 'listo' }] }),
  T({ id: 'rep', titulo: 'Repetitiva', desdeDia: 0, cadaDias: 7, hechas: [{ fecha: '2026-11-08' }] }), // próxima 15/11
  T({ id: 'omi', titulo: 'Omitida', desdeDia: 1, hastaDia: 3 }),
  T({ id: 'fin', titulo: 'Serie terminada', desdeDia: 1, cadaDias: 7, hastaDia: 10, hechas: [{ fecha: '2026-11-02' }, { fecha: '2026-11-09' }] }),
  T({ id: 'qui', titulo: 'Quitada', desdeDia: 12, estado: 'quitada', quitadaEn: '2026-11-09T10:00:00Z' }),
  T({ id: 'xss', origen: 'propia', titulo: '<img src=x onerror=alert(1)>', detalle: '"><script>x</script>', desdeDia: 0, fechaBase: '2026-11-12' }),
  T({ id: 'quim', categoria: 'quimico', titulo: 'Desparasitar', desdeDia: 3, hechas: [{ fecha: hoy, producto: 'Flubenol <b>' }],
    quimico: { tipo: 'Antiparasitario interno', ingredienteActivo: 'Flubendazol', retiroHuevoDias: 7, retiroCarneDias: 14, advertencia: c.CATALOGO_AVISO_QUIMICO } }),
];
const vacunas = [
  { id: 'v1', loteId: 'L1', nombre: 'Newcastle', via: 'ocular', fechaPrevista: '2026-11-12' },
  { id: 'v2', loteId: 'L1', nombre: 'Gumboro', via: 'agua', fechaPrevista: '2026-11-01', fechaAplicada: '2026-11-02' },
  { id: 'v3', loteId: 'L1', nombre: 'Viruela', via: 'ala', fechaPrevista: '2026-11-05' },
  { id: 'v4', loteId: 'L1', nombre: 'Coriza', via: 'IM', fechaPrevista: '2026-12-20' },
];

const s = PC.secciones(tareas, vacunas, hoy);
const ids = k => JSON.parse(JSON.stringify(s[k].map(x => x.dato.id)));
assert.deepStrictEqual(ids('atrasadas'), ['v3', 'atr'], 'atrasadas por fecha: vacuna 05/11, tarea 06/11');
assert.deepStrictEqual(ids('semana'), ['hoy', 'xss', 'v1', 'rep', 'sem'], 'esta semana: hoy..hoy+7 por fecha');
assert.deepStrictEqual(ids('proximas'), ['pro', 'v4']);
assert.deepStrictEqual(ids('hechas').sort(), ['fin', 'hec', 'omi', 'quim', 'v2'].sort(), 'hechas: únicas hechas, omitidas y vacunas aplicadas');
assert.strictEqual(ids('hechas')[0], 'quim', 'las hechas más recientes primero');
assert.deepStrictEqual(ids('quitadas'), ['qui']);
assert.strictEqual(s.hechas.find(x => x.dato.id === 'omi').estado, 'omitida');

const L = { id: 'L1', nombre: 'Lote', genetica: 'isa-brown', estado: 'activo', fechaLlegada: '2026-11-01', edadLlegadaDias: 0, avesInicio: 100 };
const h = PC.html(L, tareas, vacunas, hoy);
const tiene = (acc, id) => new RegExp(`data-accion="${acc}" data-id="${id}"`).test(h);
for (const k of ['Atrasadas', 'Esta semana', 'Próximas', 'Hechas', 'Quitadas']) assert.ok(h.includes(k), 'sección ' + k);
assert.ok(/<details[^>]*class="[^"]*pc-quitadas/.test(h), 'Quitadas va plegada en <details>');
assert.ok(h.includes('data-accion="pc-agregar"'), '+ Agregar labor');
// escape
assert.ok(!h.includes('<img src=x'), 'el título no se inserta como HTML');
assert.ok(h.includes('&lt;img src=x onerror=alert(1)&gt;'), 'el título se ve como texto');
assert.ok(!h.includes('<script>x'), 'el detalle tampoco');
assert.ok(h.includes('Flubenol &lt;b&gt;'), 'el producto usado se escapa');
// botones por estado
assert.ok(tiene('pc-hecho', 'atr') && tiene('pc-quitar', 'atr') && tiene('pc-mover', 'atr') && tiene('pc-editar', 'atr'));
assert.ok(!tiene('pc-hecho', 'hec') && !tiene('pc-mover', 'hec'), 'única ya hecha: ni Hecho ni Mover');
assert.ok(tiene('pc-quitar', 'hec') && tiene('pc-editar', 'hec'), 'única ya hecha: sí Quitar y Editar');
assert.ok(tiene('pc-hecho', 'rep') && tiene('pc-mover', 'rep'), 'repetitiva con hechas: Hecho y Mover');
assert.strictEqual(s.hechas.find(x => x.dato.id === 'fin').estado, 'hecha', '(preparación) serie terminada = hecha');
assert.ok(!tiene('pc-hecho', 'fin') && !tiene('pc-mover', 'fin') && tiene('pc-quitar', 'fin') && tiene('pc-editar', 'fin'), 'serie terminada: sin Hecho ni Mover');
assert.ok(!tiene('pc-mover', 'omi'), 'omitida: sin Mover');
assert.ok(tiene('pc-reactivar', 'qui') && !tiene('pc-hecho', 'qui') && !tiene('pc-quitar', 'qui'), 'quitada: solo Reactivar');
assert.ok(tiene('dl-aplicar', 'v1') && tiene('dl-aplicar', 'v3') && !tiene('dl-aplicar', 'v2'), 'vacunas pendientes con Marcar aplicada');
// tarjeta química
assert.ok(h.includes('Antiparasitario interno') && h.includes('Flubendazol'), 'tipo e ingrediente activo');
assert.ok(h.includes('Retiro huevo: 7 días') && h.includes('carne: 14 días'), 'días de retiro');
assert.ok(h.includes(c.CATALOGO_AVISO_QUIMICO), 'advertencia fija');
assert.ok(h.includes('No vender huevos hasta el 17/11') && h.includes('No vender carne hasta el 24/11'), 'retiro vigente');
// retiro de una tarea química quitada sigue a la vista
const quitadaQ = tareas.map(t => (t.id === 'quim' ? Object.assign({}, t, { estado: 'quitada' }) : t));
assert.ok(PC.html(L, quitadaQ, vacunas, hoy).includes('No vender huevos hasta el 17/11'), 'quitar no apaga el retiro');
// sin retiro vigente pasado el plazo
assert.ok(!PC.html(L, tareas, vacunas, '2026-11-30').includes('No vender huevos'), 'fuera de plazo no hay aviso');
// lote cerrado: solo lectura
const hc = PC.html(Object.assign({}, L, { estado: 'cerrado' }), tareas, vacunas, hoy);
for (const a of ['pc-hecho', 'pc-quitar', 'pc-reactivar', 'pc-mover', 'pc-editar', 'pc-agregar', 'pc-menu', 'dl-aplicar'])
  assert.ok(!hc.includes(`data-accion="${a}"`), 'cerrado sin ' + a);
assert.ok(hc.includes('solo lectura'), 'cerrado avisa solo lectura');
assert.ok(hc.includes('Atrasadas') || hc.includes('Hechas'), 'cerrado aún muestra el plan');
// vacío
const hv = PC.html(L, [], [], hoy);
assert.ok(hv.includes('data-accion="pc-agregar"') && /Aún no hay labores/.test(hv), 'plan vacío invita a agregar');
assert.ok(!/NaN|undefined/.test(h + hc + hv), 'sin NaN/undefined');

// catálogo de la hoja: búsqueda sin tildes, en el plan / quitada / agregar
const g = c.GENETICAS.find(x => x.id === 'isa-brown');
const filas = [T({ id: 'r1', catalogoId: 'agua-analisis' }), T({ id: 'r2', catalogoId: 'agua-bebederos', estado: 'quitada' })];
const cat = PC.catalogo(g, 0, filas, '');
const a = cat.find(x => x.t.id === 'agua-analisis'), b = cat.find(x => x.t.id === 'agua-bebederos');
assert.strictEqual(a.estado, 'enplan'); assert.strictEqual(b.estado, 'quitada'); assert.strictEqual(b.filaId, 'r2');
assert.ok(cat.some(x => x.estado === 'nueva'));
const busc = PC.catalogo(g, 0, filas, 'ANALISIS');
assert.ok(busc.length >= 1 && busc.every(x => /an[aá]lisis/i.test(x.t.titulo + ' ' + x.t.detalle)), 'busca sin tildes ni mayúsculas');
assert.ok(PC.catalogo(g, 400, [], '').every(x => x.t.hastaDia == null || x.t.hastaDia >= 400), 'no ofrece las que ya pasaron su edad');
console.log('planCiclo OK');
