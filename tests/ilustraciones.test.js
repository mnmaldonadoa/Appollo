/* Biblioteca de ilustraciones: piezas del sprite (body.html) y, desde la Tarea 5, composición y mapeo. */
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const body = fs.readFileSync(path.join(__dirname, '..', 'src', 'body.html'), 'utf8');

// ---------- Sprite: piezas p-* (inventario §9) ----------
const PIEZAS_AVE = ['p-cuerpo', 'p-cuerpo-robusto', 'p-cuerpo-esbelto', 'p-pollito', 'p-ala', 'p-cola', 'p-cola-alta', 'p-cresta',
  'p-cresta-grande', 'p-pico', 'p-barba', 'p-ojos', 'p-ojos-cerrados', 'p-patas', 'p-barrado', 'p-sombra'];
const PIEZAS_OBJETO = ['p-bebedero', 'p-comedero', 'p-saco', 'p-termometro', 'p-gota', 'p-ventilador', 'p-foco', 'p-galpon', 'p-botas',
  'p-vacuna', 'p-balanza', 'p-huevo', 'p-nido', 'p-hoja', 'p-taza', 'p-frasco', 'p-calendario', 'p-libreta', 'p-reloj', 'p-escudo',
  'p-flecha', 'p-palomita', 'p-lupa', 'p-raton', 'p-malla', 'p-estante', 'p-criadora', 'p-cama'];
const PIEZAS = [...PIEZAS_AVE, ...PIEZAS_OBJETO];
// Siluetas principales del ave: nunca llevan trazo (lineless).
const SILUETAS = ['p-cuerpo', 'p-cuerpo-robusto', 'p-cuerpo-esbelto', 'p-ala', 'p-cola', 'p-cola-alta', 'p-cresta', 'p-cresta-grande',
  'p-pico', 'p-barba', 'p-barrado', 'p-sombra', 'p-ojos'];

function simbolo(id) {
  const m = body.match(new RegExp(`<symbol id="${id}"([^>]*)>([\\s\\S]*?)</symbol>`));
  return m && { atributos: m[1], contenido: m[2] };
}

const faltan = PIEZAS.filter(id => !simbolo(id));
assert.deepStrictEqual(faltan, [], 'piezas que faltan en body.html');
for (const id of PIEZAS) {
  const s = simbolo(id);
  assert.ok(/viewBox="0 0 200 200"/.test(s.atributos), id + ': viewBox 0 0 200 200');
  assert.ok(!/Gradient|<image|http|filter|<text/.test(s.contenido), id + ': sin degradados, imágenes, URL, filtros ni texto');
  assert.ok(!/#000000|#000\b|black/i.test(s.contenido), id + ': nunca negro puro');
  if (SILUETAS.includes(id)) assert.ok(!/stroke/.test(s.contenido), id + ': silueta sin trazo');
  // Un trazo nunca rodea una forma rellena: todo estilo con stroke declara fill:none.
  for (const m of s.contenido.matchAll(/style="([^"]*)"/g)) {
    if (/stroke\s*:/.test(m[1])) assert.ok(/fill\s*:\s*none/.test(m[1]), `${id}: trazo sin fill:none -> ${m[1]}`);
  }
  // Los colores vienen de variables (tema claro/oscuro), nunca de hex sueltos.
  assert.ok(!/#[0-9a-f]{3,6}\b/i.test(s.contenido), id + ': colores por variables CSS');
}
module.exports = { PIEZAS };

// ---------- Módulo ui/ilustraciones.js: composición y mapeo ----------
const { cargar } = require('./cargar');
const c = cargar();
const { ESCENAS, ESTILO_GENETICA, Ilustracion, ilustracionDe } = c;
const src = f => fs.readFileSync(path.join(__dirname, '..', 'src', f), 'utf8');
const existe = k => Object.prototype.hasOwnProperty.call(ESCENAS, k);

// Mapeo completo: cada dato real de la app da una clave existente
const tiposAlerta = [...new Set([...src('alertas.js').matchAll(/tipo: '([a-z-]+)'/g)].map(m => m[1]))];
assert.strictEqual(tiposAlerta.length, 9, 'alertas.js tiene 9 tipos');
for (const t of tiposAlerta) { const k = ilustracionDe('alerta', t); assert.strictEqual(k, 'al-' + t); assert.ok(existe(k), k); }
const tiposRegistro = [...src('vistas/registrar.js').matchAll(/\{ id: '([a-z]+)', texto:/g)].map(m => m[1]);
assert.strictEqual(tiposRegistro.length, 6);
for (const t of tiposRegistro) { const k = ilustracionDe('registro', t); assert.strictEqual(k, 'reg-' + t); assert.ok(existe(k), k); }
const CAT_PLAN = { alimento: 'man-alimento', ambiente: 'man-temperatura', seleccion: 'man-seleccion', limpieza: 'man-bioseguridad', agua: 'man-agua',
  registros: 'man-registros', plagas: 'san-plagas', mortalidad: 'reg-mortalidad', llegada: 'man-llegada', quimico: 'san-quimico', vacuna: 'san-vacuna' };
for (const cat of [...c.CATEGORIAS_PLAN.map(x => x.id), 'vacuna']) {
  assert.strictEqual(ilustracionDe('categoriaPlan', cat), CAT_PLAN[cat], 'categoriaPlan ' + cat); assert.ok(existe(CAT_PLAN[cat]));
}
const REC = { alim: 'man-alimento', temp: 'man-temperatura', hum: 'man-humedad', agua: 'man-agua', vit: 'man-vitaminas', vac: 'san-vacuna',
  san: 'man-bioseguridad', casero: 'san-remedio-casero', quim: 'san-quimico' };
const ITEM = { t_vent: 'man-ventilacion', t_luz: 'man-luz', a_fase: 'man-cambio-fase', s_desp: 'san-desparasitacion', s_peso: 'man-seleccion', s_bio: 'man-bioseguridad' };
const catsVistas = new Set();
for (const g of c.GENETICAS) {
  const modos = g.tipo === 'doble' ? ['huevos', 'carne'] : [c.modoDe(g, 'huevos')];
  for (const modo of modos) for (const dias of [3, 30, 100, 200]) {
    for (const cat of c.construirManejo({ g, modo, dias, dFin: 600, aves: 100, alt: 2800 }).cats) {
      catsVistas.add(cat.id);
      const kc = ilustracionDe('recomendacion', cat.id);
      assert.strictEqual(kc, REC[cat.id], 'recomendacion ' + cat.id); assert.ok(existe(kc));
      for (const it of cat.items || []) {
        const ki = ilustracionDe('itemRecomendacion', it.id, kc);
        assert.strictEqual(ki, ITEM[it.id] || kc, 'item ' + it.id); assert.ok(existe(ki));
      }
    }
  }
}
assert.deepStrictEqual([...catsVistas].sort(), Object.keys(REC).sort(), 'las 9 categorías de construirManejo');
assert.strictEqual(c.GENETICAS.length, 11);
for (const g of c.GENETICAS) {
  assert.strictEqual(ilustracionDe('genetica', g.id), 'gen-' + g.id); assert.ok(existe('gen-' + g.id), g.id);
  assert.ok(ESTILO_GENETICA[g.id], 'ESTILO_GENETICA ' + g.id);
}
for (const e of ['sin-lotes', 'sin-alertas', 'sin-inventario', 'sin-registros', 'bienvenida', 'exito', 'deshacer']) {
  assert.strictEqual(ilustracionDe('estado', e), 'est-' + e); assert.ok(existe('est-' + e));
}
assert.deepStrictEqual(['alimento', 'vacuna', 'medicamento', 'otro'].map(x => ilustracionDe('inventario', x)), ['man-alimento', 'san-vacuna', 'san-quimico', 'man-registros']);
assert.deepStrictEqual(['postura', 'carne', 'ambas'].map(x => ilustracionDe('bienvenida', x)), ['gen-hyline-brown', 'gen-ross308', 'gen-rhode-island']);
assert.strictEqual(Object.keys(ESCENAS).length, 53, '53 escenas del inventario');

// Respaldos
assert.strictEqual(ilustracionDe('genetica', 'xyz'), 'gen-generica');
assert.strictEqual(ilustracionDe('alerta', 'nuevo'), 'al-plan');
assert.strictEqual(ilustracionDe('raro', 'x'), 'est-exito');
assert.strictEqual(ilustracionDe('itemRecomendacion', 'zzz', 'man-agua'), 'man-agua');
assert.strictEqual(ilustracionDe('itemRecomendacion', 'zzz'), 'man-registros');
assert.strictEqual(ilustracionDe('registro', undefined), 'man-registros');
assert.ok(Ilustracion('no-existe').includes('#p-palomita'), 'clave desconocida -> est-exito');

// Accesibilidad
let h = Ilustracion('man-agua');
assert.ok(h.includes('aria-hidden="true"') && !h.includes('role='), 'decorativa por defecto');
h = Ilustracion('man-agua', { decorativa: false });
assert.ok(h.includes('role="img"') && h.includes('<title>Gallina junto al bebedero</title>'), 'con título accesible');
assert.ok(Ilustracion('man-agua', { decorativa: false, titulo: '<x>' }).includes('<title>&lt;x&gt;</title>'), 'título escapado');

// Reglas de la guía y del sprite
const enSprite = new Set([...body.matchAll(/<symbol id="(p-[^"]+)"/g)].map(m => m[1]));
const salidas = Object.keys(ESCENAS).map(k => [k, Ilustracion(k)]);
for (const [k, s] of salidas) {
  assert.ok(!/Gradient|<image|http|filter/.test(s), k + ': sin degradados, imágenes, URL ni filtros');
  assert.ok(!/\d+\s*(mg|ml|cc|g\/)/i.test(s), k + ': sin dosis');
  assert.ok(!/\p{Extended_Pictographic}/u.test(s), k + ': sin emojis');
  for (const m of s.matchAll(/href="#(p-[^"]+)"/g)) assert.ok(enSprite.has(m[1]), `${k}: #${m[1]} existe en body.html`);
  assert.ok(/^<svg class="il il-media" viewBox="0 0 200 200"/.test(s), k + ': svg 200x200');
}
const gens = c.GENETICAS.map(g => Ilustracion('gen-' + g.id));
assert.strictEqual(new Set(gens).size, 11, 'las 11 genéticas se ven distintas');
assert.ok(Ilustracion('al-mortalidad').includes('#p-ojos-cerrados') && !Ilustracion('al-mortalidad').includes('#p-patas'), 'mortalidad: ave en reposo');
assert.ok(Ilustracion('man-agua', { genetica: 'ross308' }).includes('#p-cuerpo-robusto'), 'genetica aplica su forma a la escena');

// Tamaños
assert.ok(Ilustracion('man-agua', { tamano: 'mini' }).includes('width="48"'));
assert.ok(Ilustracion('man-agua').includes('width="96"'));
assert.ok(Ilustracion('man-agua', { tamano: 'grande' }).includes('width="160"'));
assert.ok(Ilustracion('man-agua', { tamano: 'raro' }).includes('width="96"'));

// Dos ilustraciones seguidas no comparten ids
assert.ok(!/\sid="/.test(Ilustracion('gen-ross308') + Ilustracion('gen-criolla')), 'sin atributos id');
