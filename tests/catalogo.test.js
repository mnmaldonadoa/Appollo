/* Catálogo del plan de ciclo: integridad de datos, sin dosis y filtro por genética/modo. */
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { cargar } = require('./cargar');

const c = cargar();
const { CATALOGO, CATEGORIAS_PLAN, CATALOGO_AVISO_QUIMICO, GENETICAS } = c;
assert.ok(Array.isArray(CATALOGO) && CATALOGO.length > 0, 'CATALOGO definido');

const ids = CATALOGO.map(t => t.id);
assert.strictEqual(new Set(ids).size, ids.length, 'ids únicos');

const cats = new Set(CATEGORIAS_PLAN.map(x => x.id));
const gids = new Set(GENETICAS.map(g => g.id));
for (const t of CATALOGO) {
  assert.ok(cats.has(t.categoria), t.id + ': categoría de CATEGORIAS_PLAN');
  assert.ok(t.titulo && t.titulo.length <= 140, t.id + ': título hasta 140 caracteres');
  assert.ok(t.detalle, t.id + ': detalle');
  assert.ok(Array.isArray(t.modos) && t.modos.length && t.modos.every(m => m === 'huevos' || m === 'carne'), t.id + ': modos válidos');
  if (t.geneticas) assert.ok(t.geneticas.length && t.geneticas.every(g => gids.has(g)), t.id + ': geneticas existen en GENETICAS');
  assert.ok(Number.isInteger(t.desdeDia) && t.desdeDia >= 0, t.id + ': desdeDia entero >= 0');
  if (t.hastaDia !== undefined) assert.ok(Number.isInteger(t.hastaDia) && t.hastaDia >= t.desdeDia, t.id + ': hastaDia >= desdeDia');
  if (t.cadaDias !== undefined) assert.ok(Number.isInteger(t.cadaDias) && t.cadaDias >= 1, t.id + ': cadaDias entero >= 1');
  assert.ok(typeof t.fuente === 'string' && t.fuente.trim(), t.id + ': fuente no vacía');
  assert.strictEqual('obligatoria' in t, false, t.id + ': sin obligatoria');
  if (t.quimico) {
    const q = t.quimico;
    assert.strictEqual(q.advertencia, CATALOGO_AVISO_QUIMICO, t.id + ': advertencia fija');
    for (const k of ['retiroHuevoDias', 'retiroCarneDias'])
      assert.ok(q[k] === null || (typeof q[k] === 'number' && q[k] >= 0), t.id + ': ' + k + ' número >= 0 o null');
    assert.ok(!('dosis' in q) && !('dosis' in t), t.id + ': sin campo dosis');
    assert.ok(!('enAves' in q) || q.enAves === true, t.id + ': enAves es true o no está');
  }
  const texto = [t.titulo, t.detalle, t.quimico ? JSON.stringify(t.quimico) : ''].join(' ');
  assert.ok(!/\d\s*(mg|ml|g)\s*\/\s*(kg|l|ave)/i.test(texto), t.id + ': sin dosis en el texto');
}
assert.ok(CATALOGO.some(t => t.quimico), 'hay tareas con quimico');

// Cada icono de categoría existe en el sprite
const body = fs.readFileSync(path.join(__dirname, '..', 'src', 'body.html'), 'utf8');
for (const k of CATEGORIAS_PLAN) assert.ok(body.includes('id="i-' + k.icono + '"'), 'icono i-' + k.icono + ' en body.html');

// Filtro por modo
const g = id => GENETICAS.find(x => x.id === id);
const carne = c.tareasDelCatalogo(g('ross308'), 'carne');
assert.ok(carne.length > 0 && carne.every(t => t.modos.includes('carne')), 'ross308 carne: solo tareas de carne');
assert.ok(carne.every(t => !(t.modos.length === 1 && t.modos[0] === 'huevos')), 'sin tareas solo de huevos');
assert.ok(carne.every(t => !t.geneticas || t.geneticas.includes('ross308')), 'respeta geneticas');

// Orden por desdeDia (y luego id) con una genética de postura
const post = c.tareasDelCatalogo(g('hyline-brown'), 'huevos');
assert.ok(post.length > 0 && post.every(t => t.modos.includes('huevos')), 'postura: solo tareas de huevos');
assert.strictEqual(post[0].desdeDia, Math.min(...post.map(t => t.desdeDia)), 'primero la de menor desdeDia');
for (let i = 1; i < post.length; i++) {
  const a = post[i - 1], b = post[i];
  assert.ok(a.desdeDia < b.desdeDia || (a.desdeDia === b.desdeDia && a.id <= b.id), 'orden estable desdeDia, id');
}
// enAves: solo los productos que reciben las aves (valores fijos)
assert.deepStrictEqual([...CATALOGO.filter(t => t.quimico && t.quimico.enAves).map(t => t.id)].sort(), ['qui-acaro-rojo-agua', 'qui-cocci-amprolio',
  'qui-cocci-broiler', 'qui-cocci-pollitas', 'qui-cocci-toltrazuril', 'qui-despara-pastoreo', 'qui-despara-postura', 'qui-larvicida-jaula', 'qui-piojos-acaros']);
// noPostura: bloqueo por modo y su motivo
const tq = id => CATALOGO.find(t => t.id === id);
assert.strictEqual(c.bloqueadaEnModo(tq('qui-cocci-pollitas'), 'huevos'), true);
assert.strictEqual(c.bloqueadaEnModo(tq('qui-cocci-pollitas'), 'carne'), false);
assert.strictEqual(c.bloqueadaEnModo(tq('qui-despara-postura'), 'huevos'), false);
assert.strictEqual(c.motivoBloqueo(tq('qui-cocci-pollitas')), 'Solo para crianza de pollitas; no aplica en gallinas ya en postura');
assert.strictEqual(c.motivoBloqueo(tq('qui-cocci-toltrazuril')), 'No se usa en gallinas de postura de huevo para consumo');
console.log('catalogo.test.js OK');
