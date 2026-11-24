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
