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

// Estados vacíos: las vistas usan la biblioteca (la ilustracion() vieja ya no existe)
const vistas = fs.readdirSync(path.join(__dirname, '..', 'src', 'vistas')).filter(f => f.endsWith('.js'));
for (const f of vistas) assert.ok(!/\bilustracion\(/.test(src('vistas/' + f)), f + ': usa Ilustracion(), no la ilustracion() vieja');
assert.ok(!/function ilustracion\(/.test(src('ui/componentes.js')), 'componentes.js ya no define ilustracion()');
const VACIOS = { 'alertas.js': 'sin-alertas', 'bienvenida.js': 'bienvenida', 'registrar.js': 'sin-lotes', 'lotes.js': 'sin-lotes',
  'inicio.js': 'sin-lotes', 'detalleLote.js': 'sin-registros', 'reportes.js': 'sin-registros', 'inventario.js': 'sin-inventario' };
for (const [f, e] of Object.entries(VACIOS)) assert.ok(src('vistas/' + f).includes(`ilustracionDe('estado', '${e}')`), `${f}: vacío con est-${e}`);

// TarjetaGenetica: botón de elección de genética con su ave (Nuevo lote y Planificar)
{
  const g = c.GENETICAS[0];
  let t = c.TarjetaGenetica({ g, elegida: false, accion: 'nl-genetica' });
  assert.ok(/^<button type="button" class="gen-opcion tg"/.test(t), 'botón con clases gen-opcion tg');
  assert.ok(t.includes('data-accion="nl-genetica"') && t.includes(`data-id="${g.id}"`), 'data-accion y data-id');
  assert.ok(t.includes('aria-pressed="false"') && !t.includes('tg-elegida'), 'no elegida');
  assert.ok(t.includes('data-il="gen-hyline-brown"') && t.includes('#p-cuerpo'), 'lleva el ave de su genética');
  assert.ok(t.includes(g.nombre) && t.includes(g.rasgo), 'nombre y rasgo');
  t = c.TarjetaGenetica({ g: { ...g, nombre: '<b>x</b>' }, elegida: true, accion: 'plan-genetica', clase: 'plan-gen', extra: '<span class="plan-datos"></span>' });
  assert.ok(t.includes('aria-pressed="true"') && t.includes('tg-elegida') && t.includes('plan-gen'), 'elegida y clase extra');
  assert.ok(t.includes('&lt;b&gt;x') && !t.includes('<b>x</b>'), 'nombre escapado');
  assert.ok(t.includes('<span class="plan-datos"></span>'), 'contenido extra');
}

// Tarjeta con ilustración mini en lugar del ícono (Inicio)
{
  const t = c.Tarjeta({ titulo: 'Mortalidad', ilustracion: 'reg-mortalidad', cifra: 1 });
  assert.ok(t.includes('class="tarjeta-il"') && t.includes('il-mini') && !t.includes('tarjeta-icono'), 'Tarjeta con ilustracion');
  assert.ok(c.Tarjeta({ titulo: 'x', icono: 'huevo' }).includes('tarjeta-icono'), 'Tarjeta sin ilustracion conserva el ícono');
}
// Pantallas de lote: ave de la genética y mini por tipo de registro
assert.ok(src('vistas/inicio.js').includes("ilustracionDe('genetica'"), 'Inicio: ave de la genética en la cabecera');
for (const k of ['reg-mortalidad', 'reg-alimento', 'reg-huevos', 'reg-peso', 'reg-sanidad', 'man-registros']) assert.ok(src('vistas/inicio.js').includes(k), 'Inicio: ' + k);
assert.ok(src('vistas/lotes.js').includes("ilustracionDe('genetica'"), 'Lotes: ave por lote');
assert.ok(src('vistas/detalleLote.js').includes("ilustracionDe('genetica'") && src('vistas/detalleLote.js').includes("ilustracionDe('registro'"), 'Detalle: cabecera e historial');

// Hoja Registrar y avisos
assert.ok(src('vistas/registrar.js').includes("ilustracionDe('registro', t.id)"), 'Registrar: mini por tipo');
assert.ok(src('app.js').includes("'est-exito'") && src('app.js').includes("'est-deshacer'"), 'aviso: éxito y deshacer ilustrados');

// Alertas y Plan del ciclo
assert.ok(src('vistas/alertas.js').includes("ilustracionDe('alerta', a.tipo)"), 'Alertas: mini por tipo');
assert.ok(src('vistas/planCiclo.js').includes("ilustracionDe('categoriaPlan'") && src('vistas/planCiclo.js').includes("'san-retiro'") && src('vistas/planCiclo.js').includes("'al-etiqueta'"), 'Plan del ciclo ilustrado');

// Resto de pantallas
assert.strictEqual(c.tieneIlustracion('itemRecomendacion', 't_vent'), true);
assert.strictEqual(c.tieneIlustracion('itemRecomendacion', 'w_lib'), false);
assert.strictEqual(c.tieneIlustracion('raro', 'x'), false);
assert.ok(src('vistas/inventario.js').includes("ilustracionDe('inventario', id)"), 'Inventario: mini por grupo');
assert.ok(src('vistas/planManejo.js').includes("ilustracionDe('recomendacion', c.id)") && src('vistas/planManejo.js').includes("tieneIlustracion('itemRecomendacion'"), 'Planificar: recomendaciones ilustradas');
assert.ok(src('vistas/bienvenida.js').includes("ilustracionDe('bienvenida', t.id)"), 'Bienvenida: ave por tipo de granja');
assert.ok(/\.grafico-real \{ stroke: var\(--ok\)/.test(fs.readFileSync(path.join(__dirname, '..', 'src', 'styles.css'), 'utf8')), 'gráfica: serie real en --ok');

// Revisión final: una etiqueta nunca repite un atributo (el navegador ignora el segundo, p. ej. un style con opacidad)
for (const m of body.matchAll(/<[a-z]+\b[^>]*>/gi)) {
  const nombres = [...m[0].matchAll(/\s([a-z-]+)="/gi)].map(x => x[1]);
  assert.strictEqual(new Set(nombres).size, nombres.length, 'atributo repetido en ' + m[0].slice(0, 80));
}
// Revisión final: en las escenas de balanza el ave se para sobre la pantalla de la balanza, con las patas sobre el
// fondo de la escena (no encima de la pieza clara, donde el trazo crema del tema oscuro desaparece).
for (const k of ['man-seleccion', 'reg-peso']) {
  const e = ESCENAS[k], b = e.piezas.find(p => p[0] === 'p-balanza');
  const pies = e.ave[1] + (183 - 100) * e.ave[2], techo = b[2] + (66 - 100) * b[3];
  assert.ok(pies <= techo + 1, `${k}: patas (y=${pies}) sobre el techo de la balanza (y=${techo})`);
}
