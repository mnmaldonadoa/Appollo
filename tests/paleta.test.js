/* Paleta del estilo visual: cada par texto/superficie declarado en styles.css cumple >= 7:1 (WCAG) en claro y
   oscuro, y los trazos de ilustración >= 3:1 sobre sus fondos (objetos gráficos, WCAG 1.4.11). */
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const css = fs.readFileSync(path.join(__dirname, '..', 'src', 'styles.css'), 'utf8');

function bloque(selector) {
  const i = css.indexOf(selector);
  assert.ok(i >= 0, 'falta el bloque ' + selector);
  const a = css.indexOf('{', i), b = css.indexOf('}', a);
  const tokens = {};
  for (const m of css.slice(a + 1, b).matchAll(/--([a-z0-9-]+)\s*:\s*(#[0-9A-Fa-f]{6})\b/g)) tokens[m[1]] = m[2].toUpperCase();
  return tokens;
}
const claro = bloque(':root, [data-tema="claro"]');
const oscuro = bloque('[data-tema="oscuro"] {');
const media = bloque(':root:not([data-tema="claro"])');

const lum = h => {
  const c = [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16) / 255).map(x => (x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
};
const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };

// El bloque de prefers-color-scheme: dark declara lo mismo que [data-tema="oscuro"]
assert.deepStrictEqual(media, oscuro, 'prefers-color-scheme: dark y [data-tema="oscuro"] deben coincidir');

const SUPERFICIES_TEXTO = ['fondo', 'superficie', 'superficie-2', 't-menta', 't-cielo', 't-lila', 't-coral', 't-salvia', 't-durazno', 't-marron'];
const PARES_7 = [
  ...SUPERFICIES_TEXTO.map(s => ['texto', s]),
  ['texto', 'primario-suave'], ['texto', 'huevo-suave'],
  ...['fondo', 'superficie', 'superficie-2', 'primario-suave', 'huevo-suave'].map(f => ['secundario', f]),
  ...['ok', 'alerta', 'precaucion'].flatMap(c => ['fondo', 'superficie', 'superficie-2', 'primario-suave', 'huevo-suave'].map(f => [c, f])),
  ['primario', 'fondo'], ['primario', 'superficie'],
  ['sobre-primario', 'primario'], ['sobre-alerta', 'alerta'], ['sobre-huevo', 'huevo'],
];
const FONDOS_IL = ['crema', 'menta', 'cielo', 'lila', 'coral', 'salvia', 'durazno'].map(f => 'il-fondo-' + f);
const AVES = ['ave-hueso', 'ave-pollito', 'ave-marron', 'ave-gris', 'ave-hueso-2', 'ave-marron-2', 'ave-caoba'];

const fallos = [];
for (const [nombre, t] of [['claro', claro], ['oscuro', oscuro]]) {
  const ver = (a, b, min) => {
    if (!t[a] || !t[b]) { fallos.push(`falta --${!t[a] ? a : b} (${nombre})`); return; }
    const r = ratio(t[a], t[b]);
    if (r < min) fallos.push(`${a}/${b} ${nombre}: ${r.toFixed(2)} < ${min}`);
  };
  PARES_7.forEach(([a, b]) => ver(a, b, 7));
  FONDOS_IL.forEach(f => ver('il-trazo', f, 3));
  AVES.forEach(a => ver('il-ojo', a, 3));
  ver('ave-cola', 'il-fondo-lila', 3); // cola oscura de Rhode Island sobre su fondo (lila) en ambos temas
}
assert.deepStrictEqual(fallos, [], 'contrastes de la paleta:\n' + fallos.join('\n'));

/* Estilo plano: sin sombras difusas (desenfoque > 0 o inset) ni degradados en styles.css y kit.css.
   La única sombra permitida es plana: desplazamiento sin desenfoque, p. ej. 0 3px 0 0 var(--sombra-plana). */
const planas = [];
for (const f of ['styles.css', 'ui/kit.css']) {
  const texto = fs.readFileSync(path.join(__dirname, '..', 'src', f), 'utf8');
  texto.split('\n').forEach((linea, i) => {
    if (/(linear|radial|conic)-gradient/.test(linea)) planas.push(`${f}:${i + 1} degradado`);
    for (const m of linea.matchAll(/(box-shadow|--sombra[a-z0-9-]*)\s*:\s*([^;]+)/g)) {
      const v = m[2].trim();
      if (v === 'none' || /^var\(--sombra-plana\)$/.test(v)) continue;
      for (const capa of v.split(/,(?![^(]*\))/)) {
        const c = capa.trim();
        if (/^var\(/.test(c) || c === 'none') continue;
        const nums = c.replace(/rgba?\([^)]*\)|#[0-9a-f]{3,8}|var\([^)]*\)/gi, '').match(/-?[\d.]+(px)?/g) || [];
        if (/\binset\b/.test(c) || (nums.length >= 3 && parseFloat(nums[2]) !== 0)) planas.push(`${f}:${i + 1} sombra difusa: ${c}`);
      }
    }
  });
}
assert.deepStrictEqual(planas, [], 'estilo plano:\n' + planas.join('\n'));
