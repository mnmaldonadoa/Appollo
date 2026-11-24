/* Appollo · Biblioteca de ilustraciones (estilo plano minimalista, pastel, sin contornos).
   Las piezas p-* viven una sola vez en el sprite de body.html (lienzo 200x200, centradas en 100,100); aquí se
   componen las escenas con <use> y se les da color por variables CSS (--il-c1 cuerpo, --il-c2 ala, --il-c3 cola,
   --il-cresta), así cambian con el tema sin duplicar dibujos. Sin ids: dos ilustraciones en la misma pantalla
   no se pisan. Sin dosis, sin texto, sin humor: cada escena muestra el concepto de forma literal y serena.
   ilustracionDe() es el ÚNICO mapeo de datos de la app (registros, alertas, labores, recomendaciones…) a escenas. */

const _TAMANOS = { mini: 48, media: 96, grande: 160 };
const _r = n => Math.round(n * 100) / 100;

/* Estilo de cada genética: forma del cuerpo, colores (tokens --ave-*), cresta, cola y proporción [ancho, alto].
   Se distinguen por color y proporción, nunca por anatomía realista ni logos. */
const ESTILO_GENETICA = {
  'hyline-brown': { forma: 'frijol', cuerpo: '--ave-marron', ala: '--ave-marron-2', cola: '--ave-marron-2' },
  'lohmann-brown': { forma: 'frijol', cuerpo: '--ave-marron', ala: '--ave-marron-2', cola: '--ave-marron-2', colaAlta: true },
  'isa-brown': { forma: 'frijol', cuerpo: '--ave-marron', ala: '--ave-hueso', cola: '--ave-marron-2' },
  'hisex-brown': { forma: 'frijol', cuerpo: '--ave-marron', ala: '--ave-marron-2', cola: '--ave-hueso', escala: [0.92, 0.92] },
  'lohmann-lsl': { forma: 'frijol', cuerpo: '--ave-hueso', ala: '--ave-hueso-2', cola: '--ave-hueso-2', cresta: 'grande' },
  'cobb500': { forma: 'robusta', cuerpo: '--ave-hueso', ala: '--ave-hueso-2', cola: '--ave-hueso-2', cresta: 'chica' },
  'ross308': { forma: 'robusta', cuerpo: '--ave-hueso', ala: '--ave-hueso-2', cola: '--ave-hueso-2', cresta: 'chica', escala: [1.08, 0.98] },
  'campero': { forma: 'esbelta', cuerpo: '--ave-marron', ala: '--ave-marron-2', cola: '--ave-marron-2' },
  'rhode-island': { forma: 'frijol', cuerpo: '--ave-caoba', ala: '--ave-marron-2', cola: '--ave-cola' },
  'plymouth-rock': { forma: 'frijol', cuerpo: '--ave-gris', ala: '--ave-hueso', cola: '--ave-gris', barrado: true },
  'criolla': { forma: 'esbelta', cuerpo: '--ave-pollito', ala: '--ave-marron', cola: '--ave-marron', colaAlta: true },
};
const _AVE_GENERICA = { forma: 'frijol', cuerpo: '--ave-hueso', ala: '--ave-hueso-2', cola: '--ave-hueso-2' };
const _AVE_REPOSO = { forma: 'frijol', cuerpo: '--ave-gris', ala: '--ave-hueso', cola: '--ave-gris' };
const _AVE_MANEJO = ESTILO_GENETICA['hyline-brown'];
/* Por forma: pieza del cuerpo, desplazamiento vertical de la cabeza y ancho de las alas. */
const _FORMAS = {
  frijol: { pieza: 'p-cuerpo', cabeza: 0, alas: 1 },
  robusta: { pieza: 'p-cuerpo-robusto', cabeza: 10, alas: 1.12 },
  esbelta: { pieza: 'p-cuerpo-esbelto', cabeza: -8, alas: 0.84 },
};

/* <use> de una pieza centrada en (x, y) con escala s. o: { sy (escala vertical relativa), giro (espejo), vars } */
function _pieza(id, x, y, s = 1, o = {}) {
  const sy = s * (o.sy || 1), sx = o.giro ? -s : s;
  const tx = _r(x - 100 * sx), ty = _r(y - 100 * sy);
  const vars = o.vars ? ` style="${Object.entries(o.vars).map(([k, v]) => `--il-${k}:var(${v})`).join(';')}"` : '';
  return `<use href="#${id}" width="200" height="200" transform="translate(${tx} ${ty}) scale(${_r(sx)} ${_r(sy)})"${vars}/>`;
}

/* Ave completa centrada en (x, y) con escala s. pose: 'adulta' (de pie) o 'reposo' (sentada, ojos cerrados). */
function _ave(est, x, y, s, pose = 'adulta') {
  const f = _FORMAS[est.forma] || _FORMAS.frijol;
  const [ex, ey] = est.escala || [1, 1];
  const vars = `--il-c1:var(${est.cuerpo});--il-c2:var(${est.ala});--il-c3:var(${est.cola});--il-cresta:var(--p-coral)`;
  const u = (id, t = '') => `<use href="#${id}" width="200" height="200"${t ? ` transform="${t}"` : ''}/>`;
  const cab = f.cabeza ? `translate(0 ${f.cabeza})` : '';
  const cresta = est.cresta === 'grande' ? u('p-cresta-grande', cab)
    : est.cresta === 'chica' ? u('p-cresta', `${cab} translate(100 52) scale(.72) translate(-100 -52)`.trim()) : u('p-cresta', cab);
  const partes = [
    pose === 'adulta' ? u('p-sombra') : '',
    u(est.colaAlta ? 'p-cola-alta' : 'p-cola', cab),
    cresta,
    pose === 'adulta' ? u('p-patas') : '',
    u(f.pieza),
    est.barrado ? u('p-barrado') : '',
    u('p-ala', f.alas !== 1 ? `translate(100 0) scale(${f.alas} 1) translate(-100 0)` : ''),
    u(pose === 'reposo' ? 'p-ojos-cerrados' : 'p-ojos', cab),
    u('p-pico', cab),
    u('p-barba', cab),
  ].join('');
  const prop = ex !== 1 || ey !== 1 ? ` translate(100 160) scale(${ex} ${ey}) translate(-100 -160)` : '';
  return `<g style="${vars}" transform="translate(${_r(x - 100 * s)} ${_r(y - 100 * s)}) scale(${s})${prop}">${partes}</g>`;
}

/* Escenas: fondo sólido, a lo más un ave y uno o dos elementos del concepto en tamaño normal.
   ave: [x, y, s, pose?] (usa el ave de manejo, o la genética pedida); piezas: [id, x, y, s, opciones?]. */
const _IZQ = [66, 104, 0.64], _DER = [142, 112, 0.56];
const _E = (fondo, titulo, ave, piezas = [], extra = {}) => ({ fondo, titulo, ave, piezas, ...extra });
const ESCENAS = {
  /* Manejo */
  'man-agua': _E('cielo', 'Gallina junto al bebedero', _IZQ, [['p-bebedero', ..._DER]]),
  'man-alimento': _E('menta', 'Gallina junto al comedero', _IZQ, [['p-comedero', ..._DER]]),
  'man-cambio-fase': _E('menta', 'Cambio de alimento según la fase', null, [['p-saco', 58, 120, 0.46], ['p-flecha', 102, 116, 0.3], ['p-saco', 148, 106, 0.66]]),
  'man-temperatura': _E('durazno', 'Gallina junto al termómetro', _IZQ, [['p-termometro', ..._DER]]),
  'man-humedad': _E('cielo', 'Gota de agua sobre la cama de viruta', null, [['p-cama', 100, 104, 1], ['p-gota', 100, 86, 0.62]]),
  'man-ventilacion': _E('cielo', 'Gallina junto al ventilador', _IZQ, [['p-ventilador', ..._DER]]),
  'man-luz': _E('lila', 'Gallina bajo un foco encendido', [100, 128, 0.58], [['p-foco', 100, 52, 0.62]]),
  'man-densidad': _E('menta', 'Aves con espacio dentro del galpón', null, [['p-galpon', 100, 96, 0.96]], { grupo: [[64, 150, 0.3], [100, 150, 0.3], [136, 150, 0.3]] }),
  'man-bioseguridad': _E('salvia', 'Botas que solo se usan en el galpón', null, [['p-botas', 100, 104, 0.84]]),
  'man-llegada': _E('durazno', 'Pollitos bajo la criadora', null, [['p-criadora', 100, 84, 0.86], ['p-pollito', 74, 144, 0.4], ['p-pollito', 126, 144, 0.4]]),
  'man-seleccion': _E('cielo', 'Gallina sobre la balanza', [100, 76, 0.5], [['p-balanza', 100, 138, 0.6]]),
  'man-registros': _E('crema', 'Libreta de registros', null, [['p-libreta', 100, 100, 0.84]]),
  'man-vitaminas': _E('menta', 'Vitaminas en el agua de bebida', null, [['p-bebedero', 96, 110, 0.8], ['p-gota', 150, 58, 0.32]]),
  /* Sanidad (sin dosis ni cantidades) */
  'san-vacuna': _E('cielo', 'Frasco de vacuna', null, [['p-vacuna', 100, 100, 0.84]]),
  'san-desparasitacion': _E('salvia', 'Gallina junto a un frasco cerrado', _IZQ, [['p-frasco', ..._DER]]),
  'san-remedio-casero': _E('salvia', 'Hierbas en una taza', null, [['p-taza', 94, 112, 0.78], ['p-hoja', 150, 66, 0.36]]),
  'san-quimico': _E('lila', 'Frasco con su etiqueta', null, [['p-frasco', 100, 102, 0.84]]),
  'san-retiro': _E('coral', 'Huevos en espera junto a un reloj', null, [['p-huevo', 66, 132, 0.2], ['p-huevo', 86, 131, 0.2], ['p-nido', 76, 132, 0.52, { vars: { c3: '--ave-marron-2' } }], ['p-reloj', 146, 78, 0.42]]),
  'san-plagas': _E('crema', 'Malla en la ventana', null, [['p-malla', 96, 90, 0.74], ['p-raton', 146, 152, 0.4]]),
  /* Registrar */
  'reg-mortalidad': _E('crema', 'Gallina en reposo', [100, 108, 0.8, 'reposo'], [], { reposo: true }),
  'reg-alimento': _E('menta', 'Saco de alimento', null, [['p-saco', 100, 104, 0.82]]),
  'reg-huevos': _E('durazno', 'Huevos en el nido', null, [['p-huevo', 76, 132, 0.28], ['p-huevo', 100, 128, 0.3], ['p-huevo', 124, 132, 0.28], ['p-nido', 100, 132, 0.76, { vars: { c3: '--ave-marron-2' } }]]),
  'reg-peso': _E('cielo', 'Gallina en la balanza', [100, 76, 0.5], [['p-balanza', 100, 138, 0.6]]),
  'reg-vacuna': _E('cielo', 'Vacuna aplicada', null, [['p-vacuna', 94, 104, 0.8], ['p-gota', 150, 60, 0.3]]),
  'reg-sanidad': _E('salvia', 'Gallina protegida', _IZQ, [['p-escudo', 142, 108, 0.5]]),
  /* Estados */
  'est-bienvenida': _E('menta', 'Gallina y pollito frente al galpón', [62, 128, 0.56], [['p-galpon', 118, 82, 0.66], ['p-pollito', 132, 152, 0.32]]),
  'est-sin-lotes': _E('cielo', 'Galpón esperando a sus aves', null, [['p-galpon', 96, 94, 0.88], ['p-pollito', 156, 152, 0.3]]),
  'est-sin-alertas': _E('salvia', 'Gallina tranquila, todo en orden', _IZQ, [['p-escudo', 142, 108, 0.5], ['p-palomita', 142, 104, 0.24]]),
  'est-sin-inventario': _E('crema', 'Estante con un saco', null, [['p-estante', 100, 100, 0.9], ['p-saco', 100, 109, 0.35]]),
  'est-sin-registros': _E('crema', 'Libreta abierta', null, [['p-libreta', 100, 100, 0.8]]),
  'est-exito': _E('crema', 'Listo', null, [['p-palomita', 100, 100, 0.9]]),
  'est-deshacer': _E('crema', 'Se deshizo el cambio', null, [['p-flecha', 100, 100, 0.84, { giro: true }]]),
  /* Alertas */
  'al-mortalidad': _E('coral', 'Gallina en reposo', [100, 108, 0.8, 'reposo'], [], { reposo: true }),
  'al-sin-registro': _E('durazno', 'Gallina junto a la libreta de registros', _IZQ, [['p-libreta', 142, 108, 0.5]]),
  'al-postura': _E('durazno', 'Gallina junto a un nido con un huevo', _IZQ, [['p-huevo', 142, 139, 0.2], ['p-nido', 142, 140, 0.46, { vars: { c3: '--ave-marron-2' } }]]),
  'al-vacuna': _E('cielo', 'Vacuna y calendario', null, [['p-vacuna', 74, 110, 0.62], ['p-calendario', 142, 94, 0.48]]),
  'al-retiro': _E('coral', 'Huevos en espera junto a un reloj', null, [['p-huevo', 66, 132, 0.2], ['p-huevo', 86, 131, 0.2], ['p-nido', 76, 132, 0.52, { vars: { c3: '--ave-marron-2' } }], ['p-reloj', 146, 78, 0.42]]),
  'al-etiqueta': _E('durazno', 'Frasco y lupa para leer la etiqueta', null, [['p-frasco', 84, 106, 0.72], ['p-lupa', 142, 132, 0.44]]),
  'al-fase': _E('menta', 'Cambio de alimento según la fase', null, [['p-saco', 58, 120, 0.46], ['p-flecha', 102, 116, 0.3], ['p-saco', 148, 106, 0.66]]),
  'al-inventario': _E('durazno', 'Saco de alimento casi vacío', null, [['p-saco', 100, 124, 0.76, { sy: 0.7 }]]),
  'al-plan': _E('lila', 'Gallina junto a su lista de labores', _IZQ, [['p-libreta', 142, 108, 0.5]]),
};
/* Genéticas: el ave grande y, en las que ponen, un huevo a sus pies. Fondo según el tipo. */
const _FONDO_TIPO = { postura: 'menta', carne: 'cielo', doble: 'lila', criolla: 'durazno' };
for (const g of (typeof GENETICAS !== 'undefined' ? GENETICAS : [])) {
  ESCENAS['gen-' + g.id] = _E(_FONDO_TIPO[g.tipo] || 'crema', 'Ave ' + g.nombre, [96, 98, 0.9], g.tipo === 'carne' ? [] : [['p-huevo', 160, 160, 0.2]], { genetica: g.id });
}
ESCENAS['gen-generica'] = _E('crema', 'Ave', [100, 98, 0.9], [], { genetica: null, generica: true });

function _estiloAve(sc, genetica) {
  if (genetica && ESTILO_GENETICA[genetica]) return ESTILO_GENETICA[genetica];
  if (sc.generica) return _AVE_GENERICA;
  if (sc.genetica && ESTILO_GENETICA[sc.genetica]) return ESTILO_GENETICA[sc.genetica];
  if (sc.reposo) return _AVE_REPOSO;
  return _AVE_MANEJO;
}

/* Ilustracion(clave, { tamano: 'mini'|'media'|'grande', genetica, decorativa = true, titulo }) -> '<svg …>'.
   Decorativa (junto a un texto que ya dice lo mismo): aria-hidden. Si no: role="img" con <title>. */
function Ilustracion(clave, { tamano = 'media', genetica = null, decorativa = true, titulo = null } = {}) {
  const k = Object.prototype.hasOwnProperty.call(ESCENAS, clave) ? clave : 'est-exito';
  const sc = ESCENAS[k];
  const t = _TAMANOS[tamano] ? tamano : 'media', px = _TAMANOS[t];
  const est = _estiloAve(sc, genetica);
  // Orden: fondo, objetos y al final las aves (así el ave queda sobre la balanza o el galpón).
  const objetos = sc.piezas.map(p => _pieza(p[0], p[1], p[2], p[3], p[4])).join('');
  const aves = (sc.grupo || (sc.ave ? [sc.ave] : [])).map(([x, y, s, pose]) => _ave(est, x, y, s, pose || 'adulta')).join('');
  const a11y = decorativa ? 'aria-hidden="true" focusable="false"' : 'role="img" focusable="false"';
  const tit = decorativa ? '' : `<title>${esc(titulo || sc.titulo)}</title>`;
  return `<svg class="il il-${t}" viewBox="0 0 200 200" width="${px}" height="${px}" ${a11y}>${tit}`
    + `<rect width="200" height="200" rx="40" style="fill:var(--il-fondo-${sc.fondo})"/>${objetos}${aves}</svg>`;
}

/* Mapeo de datos de la app a escenas. Devuelve siempre una clave de ESCENAS (con respaldo por contexto). */
const _MAPEO = {
  categoriaPlan: { alimento: 'man-alimento', ambiente: 'man-temperatura', seleccion: 'man-seleccion', limpieza: 'man-bioseguridad', agua: 'man-agua',
    registros: 'man-registros', plagas: 'san-plagas', mortalidad: 'reg-mortalidad', llegada: 'man-llegada', quimico: 'san-quimico', vacuna: 'san-vacuna' },
  recomendacion: { alim: 'man-alimento', temp: 'man-temperatura', hum: 'man-humedad', agua: 'man-agua', vit: 'man-vitaminas', vac: 'san-vacuna',
    san: 'man-bioseguridad', casero: 'san-remedio-casero', quim: 'san-quimico' },
  itemRecomendacion: { t_vent: 'man-ventilacion', t_luz: 'man-luz', a_fase: 'man-cambio-fase', s_desp: 'san-desparasitacion', s_peso: 'man-seleccion', s_bio: 'man-bioseguridad' },
  inventario: { alimento: 'man-alimento', vacuna: 'san-vacuna', medicamento: 'san-quimico', otro: 'man-registros' },
  bienvenida: { postura: 'gen-hyline-brown', carne: 'gen-ross308', ambas: 'gen-rhode-island' },
};
const _PREFIJO = { registro: 'reg-', alerta: 'al-', estado: 'est-', genetica: 'gen-' };
const _RESPALDO = { registro: 'man-registros', alerta: 'al-plan', estado: 'est-exito', genetica: 'gen-generica', categoriaPlan: 'man-registros',
  recomendacion: 'man-registros', itemRecomendacion: 'man-registros', inventario: 'man-registros', bienvenida: 'gen-generica' };

function ilustracionDe(contexto, id, respaldo) {
  const existe = k => typeof k === 'string' && Object.prototype.hasOwnProperty.call(ESCENAS, k);
  let k = null;
  if (_PREFIJO[contexto] && id !== undefined && id !== null) k = _PREFIJO[contexto] + id;
  else if (_MAPEO[contexto]) k = _MAPEO[contexto][id];
  if (existe(k)) return k;
  if (existe(respaldo)) return respaldo;
  return _RESPALDO[contexto] || 'est-exito';
}

/* Tarjeta para elegir una genética (Nuevo lote y Planificar): el ave a la izquierda, nombre, tipo y rasgo.
   `extra`: HTML ya armado que se agrega al final (p. ej. los datos del Planificador). */
function TarjetaGenetica({ g, elegida = false, accion, clase = '', extra = '' } = {}) {
  const k = ilustracionDe('genetica', g.id);
  const tipo = typeof TIPOS !== 'undefined' && TIPOS[g.tipo] ? TIPOS[g.tipo].corto : g.tipo;
  return `<button type="button" class="gen-opcion tg${elegida ? ' tg-elegida' : ''}${clase ? ' ' + esc(clase) : ''}" data-accion="${esc(accion)}" data-id="${esc(g.id)}" aria-pressed="${elegida ? 'true' : 'false'}">
  <span class="tg-ave" data-il="${k}">${Ilustracion(k, { tamano: 'media' })}</span>
  <span class="tg-texto"><span class="gen-cab"><b class="gen-nombre">${esc(g.nombre)}</b><span class="gen-tipo gen-tipo-${esc(g.tipo)}">${esc(tipo)}</span></span>
  <span class="gen-desc">${esc(g.rasgo)}${g.origen ? ' · ' + esc(g.origen) : ''}</span>${extra}</span></button>`;
}

/* true si el dato tiene una escena propia en el mapeo (no un respaldo). Sirve para poner la mini solo donde aporta. */
function tieneIlustracion(contexto, id) {
  return !!(_MAPEO[contexto] && Object.prototype.hasOwnProperty.call(_MAPEO[contexto], id));
}
