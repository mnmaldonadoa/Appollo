const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ctx = vm.createContext({ console });
for (const f of ['componentes.js', 'grafico.js', 'animar.js']) {
  const p = path.join(__dirname, '..', 'src', 'ui', f);
  vm.runInContext(fs.readFileSync(p, 'utf8'), ctx, { filename: p });
}
const c = ctx;

// esc
assert.strictEqual(c.esc('<a href="x">&\'</a>'), '&lt;a href=&quot;x&quot;&gt;&amp;&#39;&lt;/a&gt;');
assert.strictEqual(c.esc(null), '');
assert.strictEqual(c.esc(0), '0');

// Boton
let h = c.Boton({ texto: '<b>Guardar</b>', icono: 'huevo', variante: 'primario', accion: 'guardar"x' });
assert.ok(!h.includes('<b>'), 'Boton escapa el texto');
assert.ok(h.includes('&lt;b&gt;Guardar'));
assert.ok(h.includes('data-accion="guardar&quot;x"'));
assert.ok(h.includes('#i-huevo'));
assert.ok(/class="[^"]*btn-primario/.test(h));
assert.ok(/^<button type="button"/.test(h));
assert.ok(/btn-secundario/.test(c.Boton({ texto: 'x' })), 'variante por defecto secundario');
assert.ok(/btn-peligro/.test(c.Boton({ texto: 'x', variante: 'peligro' })));
assert.ok(/btn-secundario/.test(c.Boton({ texto: 'x', variante: 'raro' })), 'variante desconocida cae a secundario');
h = c.Boton({ texto: 'Ir', accion: 'ir', datos: { ruta: '#/lote/"1"', id: 'L1', 'Malo': 'x', 'a b': 'y', vacio: null }, clase: 'btn-ancho' });
assert.ok(h.includes('data-ruta="#/lote/&quot;1&quot;"'), 'Boton escapa data-*');
assert.ok(h.includes('data-id="L1"') && !h.includes('Malo') && !h.includes('a b') && !h.includes('data-vacio'), 'Boton filtra claves data-* inválidas');
assert.ok(/class="btn btn-secundario btn-ancho"/.test(h), 'Boton acepta clase extra');
assert.ok(!/data-accion="x"/.test(c.Boton({ texto: 'x', accion: 'ir', datos: { accion: 'x' } })), 'datos no pisa data-accion');

// Tarjeta
h = c.Tarjeta({ titulo: 'Aves <vivas>', cifra: 1234, unidad: 'aves', estado: 'rojo', icono: 'gallina', pie: 'hoy' });
assert.ok(h.includes('Aves &lt;vivas&gt;'));
assert.ok(h.includes('tarjeta-rojo'));
assert.ok(h.includes('1234') || h.includes('1.234'));
assert.ok(/data-cifra="1234"/.test(h));
assert.ok(!/tarjeta-(verde|ambar|rojo)/.test(c.Tarjeta({ titulo: 't', cifra: 1 })), 'sin estado no hay clase de estado');
assert.ok(!c.Tarjeta({ titulo: 't', cifra: 1, estado: 'x" onclick="y' }).includes('onclick'));
assert.ok(/Atención|Revisar|Bien|Alerta/.test(h), 'estado tiene texto, no solo color');

// Contador
h = c.Contador({ id: 'c1', valor: 5, min: 0, max: 10, paso: 1 });
assert.ok(h.includes('id="c1"'));
assert.ok(h.includes('inputmode="numeric"') || h.includes('inputmode="decimal"'));
assert.ok(h.includes('value="5"'));
assert.ok(h.includes('min="0"') && h.includes('max="10"') && h.includes('step="1"'));
assert.strictEqual((h.match(/<button/g) || []).length, 2);
assert.ok(h.includes('aria-label="Restar') && h.includes('aria-label="Sumar'));
assert.ok(!c.Contador({ id: '"><x', valor: 1 }).includes('"><x'));

// Hoja
h = c.Hoja({ titulo: 'Registrar <x>', contenido: '<p>ya es html</p>' });
assert.ok(h.includes('role="dialog"') && h.includes('aria-modal="true"'));
assert.ok(h.includes('Registrar &lt;x&gt;'));
assert.ok(h.includes('<p>ya es html</p>'), 'contenido es HTML de confianza');
assert.ok(h.includes('hoja-fondo'));

// Esqueleto
assert.strictEqual((c.Esqueleto(3).match(/class="esqueleto-bloque/g) || []).length, 3);
assert.strictEqual((c.Esqueleto().match(/class="esqueleto-bloque/g) || []).length, 1);
assert.strictEqual((c.Esqueleto(-2).match(/class="esqueleto-bloque/g) || []).length, 0);

// Grafico: series vacías, cortas, con nulos
const sinNaN = s => assert.ok(!/NaN|undefined|Infinity/.test(s), s.slice(0, 200));
for (const args of [
  {}, { serieReal: [], serieEstandar: [] }, { serieReal: [5] }, { serieReal: [3, 3, 3], serieEstandar: [3, 3, 3] },
  { serieReal: [1, null, 4], serieEstandar: [2, 3, 4], etiquetas: ['a', 'b', 'c'] },
  { serieReal: [90, 92, 91, 93], serieEstandar: [94, 94, 93, 93], etiquetas: ['<1>', '2', '3', '4'] },
]) {
  const g = c.Grafico(args);
  sinNaN(g);
  assert.ok(g.startsWith('<figure') || g.startsWith('<svg') || g.includes('<svg'));
}
const g = c.Grafico({ serieReal: [1, 2, 3], serieEstandar: [1, 2, 4], etiquetas: ['<1>', '2', '3'] });
assert.ok(g.includes('stroke-dasharray'), 'estándar es discontinua');
assert.ok(!g.includes('<1>'));
assert.ok(/Real/.test(g) && /Estándar/.test(g), 'leyenda con texto');
