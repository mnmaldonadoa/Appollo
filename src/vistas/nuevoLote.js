/* =========================================================================
   APPOLLO · Nuevo lote (4 pasos: genética → aves y edad → tareas del ciclo → altitud y galpón).
   NuevoLote.crear({genetica, avesInicio, fechaLlegada|edadDias, edadLlegadaDias?, altitud, galpon, nombre?, plan?: string[]})
   -> Promise<Lote>; rechaza con un Error de mensaje en español y sin guardar nada.
   Escribe también el vacunasPlan del lote desde vacunasPara(g, modo) y, si llega `plan` (ids del catálogo), las tareas del ciclo con Plan.crearInicial.
   ========================================================================= */
var VISTAS = window.VISTAS || (window.VISTAS = {});
var ACCIONES = window.ACCIONES || (window.ACCIONES = {});

const NuevoLote = (function () {
  'use strict';
  const K_ALT = 'appollo.v2.altitud', REPITE_CADA = 63, MAX_AVES = 1000000;
  const ALTITUDES = [[0, 'Costa'], [500, 'Amazonía'], [1500, 'Valle'], [2800, 'Sierra'], [3500, 'Páramo']];
  const ORDEN = { postura: ['postura', 'doble', 'criolla', 'carne'], carne: ['carne', 'doble', 'criolla', 'postura'] };
  const genDe = id => GENETICAS.find(g => g.id === id);
  const lsGet = k => { try { return localStorage.getItem(k); } catch (e) { return null; } };
  const lsSet = (k, v) => { try { localStorage.setItem(k, v); } catch (e) { /* sin almacenamiento */ } };

  /* --------------------------- Reglas (sin DOM) --------------------------- */
  const maxDias = g => (modoDe(g) === 'huevos' ? 693 : g.carne.rango[1] - 1);
  const masDias = (f, n) => { const d = fechaADate(f); d.setDate(d.getDate() + n); return hoyLocal(d); };
  const corta = g => g.nombre.split(' ').slice(0, 2).join(' ');
  const numero = x => (typeof x === 'number' ? x : typeof x === 'string' && x.trim() !== '' ? Number(x) : NaN);
  const semanas = d => formatoNumero(Math.floor(d / 7)) + ' sem';

  /* Fechas del plan: cada vacuna a su día de vida; las ya pasadas al llegar se omiten. */
  function planVacunas(g, lote) {
    const max = maxDias(g), out = [];
    for (const v of vacunasPara(g, modoDe(g))) {
      const dias = [v.d];
      if (v.repite) for (let d = v.d + REPITE_CADA; d <= max; d += REPITE_CADA) dias.push(d);
      for (const d of dias) {
        if (d < lote.edadLlegadaDias) continue;
        out.push({ loteId: lote.id, vacunaId: v.id, nombre: v.n, via: v.via, fechaPrevista: masDias(lote.fechaLlegada, d - lote.edadLlegadaDias) });
      }
    }
    return out.sort((a, b) => (a.fechaPrevista < b.fechaPrevista ? -1 : 1));
  }

  /* Tareas del catálogo que se muestran: las de la genética y el modo que aún no pasaron por edad (hastaDia >= edad).
     Sin edad válida (null) se muestran todas. */
  const noSirve = (t, g) => !!(t.quimico && t.quimico.noPostura && modoDe(g) === 'huevos');
  function tareasVisibles(g, edad) {
    return tareasDelCatalogo(g, modoDe(g)).filter(t => edad === null || edad === undefined || t.hastaDia === undefined || t.hastaDia === null || t.hastaDia >= edad);
  }
  /* Ids marcados por defecto: todas las visibles menos las que no se usan en postura de huevo. */
  const planSugerido = (g, edad) => tareasVisibles(g, edad).filter(t => !noSirve(t, g)).map(t => t.id);

  /* -> {mensaje} si algo no vale, o {lote} listo para guardar (sin id). */
  function validar(o) {
    const no = mensaje => ({ mensaje }), hoy = hoyLocal();
    const g = o && genDe(o.genetica);
    if (!g) return no('Elige la genética de tus aves');
    const aves = numero(o.avesInicio);
    if (!Number.isInteger(aves) || aves < 1) return no('La cantidad de aves debe ser un número entero de 1 o más');
    if (aves > MAX_AVES) return no('La cantidad de aves no puede pasar de 1.000.000');
    let fecha = hoy, llegada;
    const edadOk = (x, que) => {
      const n = numero(x);
      if (!Number.isFinite(n)) return { m: 'Escribe ' + que + ' de las aves con números' };
      if (n < 0) return { m: 'La edad no puede ser negativa' };
      if (!Number.isInteger(n)) return { m: 'La edad debe ser un número entero de días' };
      return { n };
    };
    if (o.fechaLlegada !== undefined && o.fechaLlegada !== null && o.fechaLlegada !== '') {
      if (!fechaValida(o.fechaLlegada)) return no('La fecha de llegada no es válida');
      if (o.fechaLlegada > hoy) return no('La fecha de llegada no puede ser futura');
      fecha = o.fechaLlegada;
      const e = o.edadLlegadaDias === undefined || o.edadLlegadaDias === null || o.edadLlegadaDias === '' ? { n: 0 } : edadOk(o.edadLlegadaDias, 'la edad al llegar');
      if (e.m) return no(e.m);
      llegada = e.n;
    } else {
      const e = edadOk(o.edadDias, 'la edad');
      if (e.m) return no(e.m);
      llegada = e.n;
    }
    const lote = { genetica: g.id, avesInicio: aves, fechaLlegada: fecha, edadLlegadaDias: llegada, estado: 'activo' };
    const actual = edadDias(lote, hoy), max = maxDias(g);
    if (actual > max) return no(`La edad (${formatoNumero(actual)} días, ${semanas(actual)}) supera el máximo para ${g.nombre}: ${formatoNumero(max)} días (${semanas(max)})`);
    let alt = null;
    if (o.altitud !== undefined && o.altitud !== null && o.altitud !== '') {
      alt = numero(o.altitud);
      if (!Number.isFinite(alt) || alt < 0 || alt > 6000) return no('La altitud debe estar entre 0 y 6000 m');
    }
    const galpon = String(o.galpon || '').trim().slice(0, 40);
    const nombre = String(o.nombre || '').trim().slice(0, 60) || `${corta(g)} · ${galpon || 'Lote'}`;
    return { lote: Object.assign(lote, { nombre, galpon, altitud: alt, creado: new Date().toISOString() }) };
  }

  async function crear(o) {
    const v = validar(o);
    if (v.mensaje) throw new Error(v.mensaje);
    const g = genDe(v.lote.genetica), hechos = [];
    let lote;
    try {
      lote = await DB.guardar('lotes', v.lote);
      for (const p of planVacunas(g, lote)) hechos.push((await DB.guardar('vacunasPlan', p)).id);
      if (Array.isArray(o.plan) && o.plan.length) {
        const r = await Plan.crearInicial(lote, g, modoDe(g), o.plan);
        if (!Array.isArray(r)) throw new Error('plan');
      }
    } catch (e) {
      for (const id of hechos) { try { await DB.borrar('vacunasPlan', id); } catch (x) { /* sigue */ } }
      if (lote) { try { await Plan.borrarDeLote(lote.id); } catch (x) { /* sigue */ } }
      if (lote) { try { await DB.borrar('lotes', lote.id); } catch (x) { /* sigue */ } }
      throw new Error('No se pudo guardar el lote. Intenta de nuevo.');
    }
    if (lote.altitud !== null) {
      lsSet(K_ALT, String(lote.altitud));
      try { // se lee de la base: App.estado puede estar desactualizado
        const gr = (await DB.obtener('granja', 'granja')) || App.estado.granja || { id: 'granja' };
        App.estado.granja = gr.altitud === lote.altitud ? gr : await DB.guardar('granja', Object.assign({}, gr, { altitud: lote.altitud }));
      } catch (e) { /* no crítico */ }
    }
    return lote;
  }

  /* ------------------------------ Pantalla ------------------------------ */
  const altGuardada = () => {
    const ls = numero(lsGet(K_ALT)), gr = App.estado.granja && App.estado.granja.altitud;
    return Number.isFinite(ls) ? ls : Number.isFinite(gr) ? gr : '';
  };
  const nuevo = () => ({ paso: 1, gid: null, aves: 100, modo: 'edad', edad: 1, unidad: 'dias', fecha: hoyLocal(), edadLlegada: 0, altitud: altGuardada(), galpon: '', nombre: '', plan: new Set(), planClave: null, abiertas: new Set(['alimento']) });
  let st = null;
  const $v = s => document.querySelector('#view ' + s);
  const val = id => { const el = $v('#' + id); return el ? el.value : undefined; };

  function presets(g) {
    const d = x => [x, 'dias', x === 1 ? '1 día' : x + ' días'], s = x => [x, 'semanas', x + ' sem'];
    if (modoDe(g) === 'huevos') return [d(1), s(4), s(10), s(17), s(25), s(40), s(60)];
    return (esBroiler(g) ? [1, 7, 14, 21, 28, 35] : g.id === 'campero' ? [1, 14, 28, 42, 56] : [1, 28, 56, 84]).map(d);
  }

  function leer() {
    if (!st) return;
    const v = { aves: val('nl-aves'), edad: val('nl-edad'), fecha: val('nl-fecha'), edadLlegada: val('nl-edad-llegada'),
      altitud: val('nl-altitud'), galpon: val('nl-galpon'), nombre: val('nl-nombre') };
    Object.keys(v).forEach(k => { if (v[k] !== undefined) st[k] = v[k]; });
  }
  const datos = () => {
    const o = { genetica: st.gid, avesInicio: st.aves, altitud: st.altitud, galpon: st.galpon, nombre: st.nombre, plan: Array.from(st.plan) };
    if (st.modo === 'fecha') { o.fechaLlegada = st.fecha || ' '; o.edadLlegadaDias = st.edadLlegada; }
    else { const n = numero(st.edad); o.edadDias = st.unidad === 'semanas' && Number.isFinite(n) ? Math.round(n * 7) : st.edad; }
    return o;
  };
  const seg = (accion, clave, ops) => `<div class="segmento" role="group">${ops.map(([v, t]) =>
    `<button type="button" class="segmento-btn" data-accion="${accion}" data-${clave}="${v}" aria-pressed="${st[clave] === v || String(st[clave]) === String(v)}">${t}</button>`).join('')}</div>`;
  const campo = (id, etiqueta, html, ayuda) => `<div class="reg-campo"><label class="reg-etiqueta" for="${id}">${etiqueta}</label>${html}${ayuda ? `<p class="reg-ayuda">${ayuda}</p>` : ''}</div>`;
  const texto = (id, valor, extra) => `<input class="reg-texto" id="${id}" value="${esc(valor)}" ${extra}>`;

  function paso1() {
    const t = (App.estado.granja && App.estado.granja.tipo) || '', orden = ORDEN[t] || ORDEN.postura;
    const lista = GENETICAS.slice().sort((a, b) => orden.indexOf(a.tipo) - orden.indexOf(b.tipo));
    return `<h1>¿Qué aves llegan?</h1>
  <div class="gen-lista">${lista.map(g => `<button type="button" class="gen-opcion" data-accion="nl-genetica" data-id="${esc(g.id)}" aria-pressed="${st.gid === g.id}">
    <span class="gen-cab"><b class="gen-nombre">${esc(g.nombre)}</b><span class="gen-tipo gen-tipo-${esc(g.tipo)}">${esc(TIPOS[g.tipo].corto)}</span></span>
    <span class="gen-desc">${esc(g.rasgo)} · ${esc(g.origen)}</span></button>`).join('')}</div>
  ${Boton({ texto: 'Cancelar', variante: 'secundario', accion: 'ir', datos: { ruta: '#/lotes' }, clase: 'btn-ancho' })}`;
  }

  function paso2() {
    const g = genDe(st.gid), max = maxDias(g);
    const edad = st.modo === 'edad'
      ? campo('nl-edad', 'Edad de las aves hoy', Contador({ id: 'nl-edad', valor: st.edad, min: 0, paso: 1, etiqueta: 'Edad' }) +
        seg('nl-unidad', 'unidad', [['dias', 'Días'], ['semanas', 'Semanas']]) +
        `<div class="nl-presets">${presets(g).map(([n, u, t]) => `<button type="button" class="segmento-btn" data-accion="nl-preset" data-valor="${n}" data-unidad="${u}">${t}</button>`).join('')}</div>`,
        `Máximo para ${esc(g.nombre)}: ${formatoNumero(max)} días (${semanas(max)})`)
      : campo('nl-fecha', 'Fecha de llegada', texto('nl-fecha', st.fecha, `type="date" max="${hoyLocal()}"`)) +
        campo('nl-edad-llegada', 'Edad al llegar (días)', Contador({ id: 'nl-edad-llegada', valor: st.edadLlegada, min: 0, paso: 1, etiqueta: 'Edad al llegar en días' }), 'Pon 0 o 1 si llegaron pollitos recién nacidos');
    return `<h1>${esc(g.nombre)}</h1>
  ${campo('nl-aves', '¿Cuántas aves llegaron?', Contador({ id: 'nl-aves', valor: st.aves, min: 1, paso: 10, etiqueta: 'Cantidad de aves' }))}
  <div class="reg-campo"><p class="reg-etiqueta">¿Qué sabes de su edad?</p>${seg('nl-modo', 'modo', [['edad', 'Su edad hoy'], ['fecha', 'Fecha de llegada']])}</div>
  ${edad}
  <p class="reg-error nl-error" role="alert" hidden></p>
  <div class="reg-acciones">${Boton({ texto: 'Atrás', icono: 'atras', variante: 'secundario', accion: 'nl-atras' })}${Boton({ texto: 'Siguiente', icono: 'sig', variante: 'primario', accion: 'nl-siguiente' })}</div>`;
  }

  /* Edad actual de las aves según el paso 2 (null si no vale). */
  const edadActual = () => { const v = validar(Object.assign(datos(), { altitud: null })); return v.lote ? edadDias(v.lote, hoyLocal()) : null; };
  /* La selección se reinicia solo si cambia lo que se sugiere (genética o edad actual). */
  function prepararPlan() {
    const g = genDe(st.gid), edad = edadActual(), clave = st.gid + '|' + edad;
    if (st.planClave !== clave) { st.planClave = clave; st.plan = new Set(planSugerido(g, edad)); st.abiertas = new Set(['alimento']); }
  }
  function tareaHTML(t, g) {
    const bloq = noSirve(t, g), marcada = !bloq && st.plan.has(t.id), q = t.quimico;
    const retiro = x => (x === null || x === undefined ? 'ver etiqueta' : x + ' d');
    const tag = x => `<span class="plan-tag">${esc(x)}</span>`;
    const quim = q ? `<span class="plan-tags">${tag(q.tipo)}${tag(q.ingredienteActivo)}${tag('Retiro huevo: ' + retiro(q.retiroHuevoDias) + ' · carne: ' + retiro(q.retiroCarneDias))}</span>
        <span class="plan-item-d">${esc(CATALOGO_AVISO_QUIMICO)}</span>` : '';
    const nota = bloq ? '<span class="plan-item-d"><b>No se usa en gallinas de postura de huevo para consumo</b></span>' : '';
    return `<label class="plan-item nl-tarea${q ? ' nl-tarea-quimica' : ''}${bloq ? ' plan-item-bloqueado' : ''}"><input type="checkbox" data-accion="nl-plan-tarea" data-id="${esc(t.id)}" ${marcada ? 'checked' : ''} ${bloq ? 'disabled' : ''}>
      <span class="plan-caja" aria-hidden="true"></span>
      <span class="plan-item-texto"><span class="plan-item-t">${esc(t.titulo)}</span><span class="plan-item-d nl-detalle">${esc(t.detalle)}</span>${quim}${nota}</span></label>`;
  }
  function paso3() {
    prepararPlan();
    const g = genDe(st.gid), todas = tareasVisibles(g, edadActual());
    const elegidas = todas.filter(t => st.plan.has(t.id) && !noSirve(t, g)).length;
    const cats = CATEGORIAS_PLAN.map(c => {
      const ts = todas.filter(t => t.categoria === c.id);
      if (!ts.length) return '';
      const k = ts.filter(t => st.plan.has(t.id) && !noSirve(t, g)).length, abierta = st.abiertas.has(c.id);
      return `<section class="nl-cat" data-cat="${esc(c.id)}">
    <button type="button" class="nl-cat-cab" data-accion="nl-plan-abrir" data-id="${esc(c.id)}" aria-expanded="${abierta}"><b>${esc(c.nombre)}</b><span class="nl-cat-cuenta">${k}/${ts.length}</span></button>
    ${abierta ? `<div class="nl-cat-cuerpo"><div class="nl-cat-botones">${Boton({ texto: 'Todo', variante: 'secundario', accion: 'nl-plan-todo', datos: { id: c.id } })}${Boton({ texto: 'Ninguno', variante: 'secundario', accion: 'nl-plan-ninguno', datos: { id: c.id } })}</div>
      <div class="plan-items">${ts.map(t => tareaHTML(t, g)).join('')}</div></div>` : ''}</section>`;
    }).join('');
    return `<h1>¿Qué vas a hacer en este ciclo?</h1>
  <p class="nl-contador" role="status" aria-live="polite"><b>${elegidas}</b> ${elegidas === 1 ? 'tarea elegida' : 'tareas elegidas'}</p>
  <p class="reg-ayuda">Puedes cambiar esto después en el plan del lote.</p>
  <div class="nl-cats">${cats}</div>
  <div class="reg-acciones">${Boton({ texto: 'Atrás', icono: 'atras', variante: 'secundario', accion: 'nl-atras' })}${Boton({ texto: 'Continuar', icono: 'sig', variante: 'primario', accion: 'nl-plan-siguiente' })}</div>`;
  }

  function paso4() {
    const g = genDe(st.gid), v = validar(datos()), def = v.lote ? `${corta(g)} · ${String(st.galpon || '').trim() || 'Lote'}` : '';
    return `<h1>¿Dónde están?</h1>
  <div class="reg-campo"><label class="reg-etiqueta" for="nl-altitud">Altitud de la granja (metros)</label>
    <div class="nl-alturas">${ALTITUDES.map(([m, t]) => `<button type="button" class="segmento-btn nl-altura" data-accion="nl-altitud" data-valor="${m}" aria-pressed="${String(st.altitud) === String(m)}"><b>${formatoNumero(m)} m</b><span>${t}</span></button>`).join('')}</div>
    ${texto('nl-altitud', st.altitud, 'type="number" inputmode="numeric" min="0" max="6000" step="1" placeholder="Otra altitud en metros"')}
    <p class="reg-ayuda">La recordamos para tus próximos lotes.</p></div>
  ${campo('nl-galpon', 'Galpón (opcional)', texto('nl-galpon', st.galpon, 'type="text" maxlength="40" autocomplete="off" placeholder="Ej.: Galpón 2"'))}
  ${campo('nl-nombre', 'Nombre del lote (opcional)', texto('nl-nombre', st.nombre, `type="text" maxlength="60" autocomplete="off" placeholder="${esc(def)}"`))}
  <p class="reg-error nl-error" role="alert" hidden></p>
  <div class="reg-acciones">${Boton({ texto: 'Atrás', icono: 'atras', variante: 'secundario', accion: 'nl-atras' })}${Boton({ texto: 'Crear lote', icono: 'mas', variante: 'primario', accion: 'nl-crear', clase: 'reg-guardar' })}</div>`;
  }

  function html() {
    const nombres = ['Genética', 'Aves', 'Tareas', 'Lugar'];
    return `<section class="pantalla nuevo-lote" data-paso="${st.paso}">
  <p class="eyebrow">Nuevo lote · Paso ${st.paso} de 4</p>
  <ol class="pasos pasos-4">${nombres.map((n, i) => `<li class="paso${i + 1 < st.paso ? ' paso-hecho' : ''}"${i + 1 === st.paso ? ' aria-current="step"' : ''}><span class="paso-barra" aria-hidden="true"></span><span class="paso-nombre">${n}</span></li>`).join('')}</ol>
  ${st.paso === 1 ? paso1() : st.paso === 2 ? paso2() : st.paso === 3 ? paso3() : paso4()}
</section>`;
  }

  function pintar(enfocar) {
    const s = $v('.nuevo-lote');
    if (!s) return;
    s.outerHTML = html();
    if (enfocar) { window.scrollTo(0, 0); const h = $v('.nuevo-lote h1'); if (h) { h.tabIndex = -1; try { h.focus({ preventScroll: true }); } catch (e) { /* sin foco */ } } }
  }
  function error(msg) { const p = $v('.nl-error'); if (p) { p.textContent = msg; p.hidden = false; p.scrollIntoView({ block: 'nearest' }); } }

  /* App.estado.prefillLote = {genetica, aves, altitud, edadDias} (lo deja "Crear lote con este plan"):
     se usa una sola vez y abre el asistente en el paso 2 con todo lleno. */
  function precargar() {
    const p = App.estado.prefillLote;
    App.estado.prefillLote = null;
    if (!p || !genDe(p.genetica)) return false;
    st = Object.assign(nuevo(), { paso: 2, gid: p.genetica, modo: 'edad', unidad: 'dias' });
    if (Number.isFinite(numero(p.aves))) st.aves = String(p.aves);
    if (Number.isFinite(numero(p.edadDias))) st.edad = String(p.edadDias);
    if (Number.isFinite(numero(p.altitud))) st.altitud = String(p.altitud);
    return true;
  }

  VISTAS.nuevoLote = async function () { if (!precargar() && !st) st = nuevo(); return html(); };
  VISTAS.nuevoLote.crear = crear;

  ACCIONES['nl-genetica'] = el => { st.gid = el.dataset.id; st.paso = 2; pintar(true); };
  ACCIONES['nl-atras'] = () => { leer(); st.paso = Math.max(1, st.paso - 1); pintar(true); };
  ACCIONES['nl-modo'] = el => { leer(); st.modo = el.dataset.modo; pintar(); };
  ACCIONES['nl-unidad'] = el => { leer(); st.unidad = el.dataset.unidad; pintar(); };
  ACCIONES['nl-preset'] = el => { leer(); st.edad = el.dataset.valor; st.unidad = el.dataset.unidad; pintar(); };
  ACCIONES['nl-altitud'] = el => { leer(); st.altitud = el.dataset.valor; pintar(); };
  ACCIONES['nl-siguiente'] = () => {
    leer();
    const v = validar(Object.assign(datos(), { altitud: null }));
    if (v.mensaje) { error(v.mensaje); return; }
    st.paso = 3; pintar(true);
  };
  const conservar = (f, accion, id) => {
    const y = window.scrollY; f(); pintar(); window.scrollTo(0, y);
    const el = $v(`[data-accion="${accion}"][data-id="${id}"]`);
    if (el) { try { el.focus({ preventScroll: true }); } catch (e) { /* sin foco */ } }
  };
  const idsDe = cat => tareasVisibles(genDe(st.gid), edadActual()).filter(t => t.categoria === cat && !noSirve(t, genDe(st.gid))).map(t => t.id);
  ACCIONES['nl-plan-tarea'] = el => conservar(() => { const id = el.dataset.id; if (st.plan.has(id)) st.plan.delete(id); else st.plan.add(id); }, 'nl-plan-tarea', el.dataset.id);
  ACCIONES['nl-plan-todo'] = el => conservar(() => idsDe(el.dataset.id).forEach(id => st.plan.add(id)), 'nl-plan-todo', el.dataset.id);
  ACCIONES['nl-plan-ninguno'] = el => conservar(() => idsDe(el.dataset.id).forEach(id => st.plan.delete(id)), 'nl-plan-ninguno', el.dataset.id);
  ACCIONES['nl-plan-abrir'] = el => conservar(() => { const id = el.dataset.id; if (st.abiertas.has(id)) st.abiertas.delete(id); else st.abiertas.add(id); }, 'nl-plan-abrir', el.dataset.id);
  ACCIONES['nl-plan-siguiente'] = () => { st.paso = 4; pintar(true); };
  ACCIONES['nl-crear'] = async el => {
    leer();
    if (st.altitud === '' || st.altitud === null || st.altitud === undefined) { error('Elige la altitud de tu granja'); return; }
    el.disabled = true;
    let lote;
    try { lote = await crear(datos()); } catch (e) { el.disabled = false; error(e.message); return; }
    st = null;
    App.fijarLote(lote.id);
    App.ir('#/lote/' + encodeURIComponent(lote.id));
    App.toast('Lote creado');
    App.actualizarAlertas();
  };

  return { crear, validar, maxDias, planVacunas, planSugerido, tareasVisibles };
})();
