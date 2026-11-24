/* =========================================================================
   APPOLLO · Registro rápido (hoja inferior): ＋ → tipo → Guardar (3 toques).
   Registrar.abrir(tipo?) abre la hoja; con `tipo` salta directo a la pantalla de valor.
   Registro: {id, loteId, fecha (hoyLocal), tipo, datos, creado}.
   ========================================================================= */
var ACCIONES = window.ACCIONES || (window.ACCIONES = {});

const Registrar = (function () {
  'use strict';
  const TIPOS = [
    { id: 'mortalidad', texto: 'Mortalidad', icono: 'cruz' },
    { id: 'alimento', texto: 'Alimento', icono: 'saco' },
    { id: 'huevos', texto: 'Huevos', icono: 'huevo' },
    { id: 'peso', texto: 'Peso', icono: 'balanza' },
    { id: 'vacuna', texto: 'Vacuna', icono: 'jeringa' },
    { id: 'sanidad', texto: 'Sanidad', icono: 'termo' },
  ];
  const CAUSAS = ['Enfermedad', 'Calor', 'Aplastamiento', 'Depredador', 'Desconocida'];
  const DIARIOS = ['alimento', 'huevos', 'mortalidad', 'peso'];
  const SUMABLES = ['alimento', 'huevos', 'mortalidad']; // sumar pesos no tiene sentido
  const UNIDAD = { mortalidad: 'aves', alimento: 'kg', huevos: 'huevos', peso: 'g' };

  let st = null; // {lotes, loteId, tipo, registros, vacunas, vacunaId, guardando, existente}
  const $h = s => { const c = App.hojaAbierta(); return c ? c.querySelector(s) : null; };
  const lote = () => st && st.lotes.find(l => l.id === st.loteId);
  const gen = l => (typeof GENETICAS !== 'undefined' ? GENETICAS.find(g => g.id === l.genetica) : null);
  const esCarne = l => { const g = gen(l); return !!g && modoDe(g) === 'carne'; };
  const redondear = (x, d) => { const f = Math.pow(10, d); return Math.round(x * f) / f; };
  const num = id => { const el = $h('#' + id); return el ? (el.value === '' ? NaN : Number(el.value)) : NaN; };
  const txt = id => { const el = $h('#' + id); return el ? el.value.trim() : ''; };
  const vivasHoy = () => Math.max(0, avesVivas(lote(), st.registros, hoyLocal()));

  /* ------------------------------ Pantallas ------------------------------ */
  function poner(titulo, html) {
    const c = App.hojaAbierta();
    if (!c) return;
    c.querySelector('.hoja-titulo').textContent = titulo;
    c.querySelector('.hoja-cuerpo').innerHTML = html;
  }

  const htmlTipos = () => `<div class="hoja-rejilla">${TIPOS.map(t =>
    `<button type="button" class="btn btn-secundario reg-tipo-btn" data-accion="reg-tipo" data-tipo="${t.id}">${Ilustracion(ilustracionDe('registro', t.id), { tamano: 'mini' })}<span class="btn-texto">${esc(t.texto)}</span></button>`).join('')}</div>`;

  const htmlSinLotes = () => `<div class="reg-vacio">
  <div class="vacia-ilustracion" aria-hidden="true">${Ilustracion(ilustracionDe('estado', 'sin-lotes'), { tamano: 'grande' })}</div>
  <p class="reg-vacio-titulo">Primero crea un lote</p>
  <p>Para registrar necesitas al menos un lote de aves activo.</p>
  ${Boton({ texto: 'Crear lote', icono: 'mas', variante: 'primario', accion: 'ir', datos: { ruta: '#/nuevo-lote' }, clase: 'btn-ancho' })}
</div>`;

  function htmlLote() {
    const l = lote(), aves = formatoNumero(vivasHoy());
    const dentro = `${icono('gallina')}<span class="reg-lote-texto"><b>${esc(l.nombre || 'Lote')}</b><span>${aves} aves vivas</span></span>`;
    return st.lotes.length > 1
      ? `<button type="button" class="reg-lote reg-lote-btn" data-accion="reg-cambiar-lote">${dentro}<span class="reg-lote-cambiar">Cambiar</span></button>`
      : `<p class="reg-lote">${dentro}</p>`;
  }

  function predeterminado(tipo) {
    const l = lote(), hoy = hoyLocal(), vivas = vivasHoy();
    let e = null;
    try { e = estandarDia(l, hoy, App.estado.granja && App.estado.granja.altitud, vivas); } catch (x) { e = null; }
    const ok = x => Number.isFinite(x) && x > 0;
    if (tipo === 'mortalidad') return { valor: 1 };
    if (tipo === 'alimento') return { valor: e && ok(e.alimentoKg) ? redondear(e.alimentoKg, 1) : 0, estandar: e && ok(e.alimentoKg) };
    if (tipo === 'huevos') return { valor: e && ok(e.huevos) ? Math.round(e.huevos) : 0, estandar: e && ok(e.huevos) };
    if (tipo === 'peso') {
      // Último peso registrado; si no hay, el estándar de engorde. En postura pesoG es el peso del huevo, no del ave.
      const ps = st.registros.filter(r => r.tipo === 'peso' && Number(r.datos && r.datos.gramos) > 0).sort((a, b) => (a.fecha < b.fecha ? -1 : 1));
      if (ps.length) return { valor: Math.round(Number(ps[ps.length - 1].datos.gramos)), ultimo: true };
      return { valor: esCarne(l) && e && ok(e.pesoG) ? Math.round(e.pesoG) : 0, estandar: esCarne(l) && e && ok(e.pesoG) };
    }
    return { valor: 0 };
  }

  const campo = (etiqueta, html, ayuda) => `<div class="reg-campo"><p class="reg-etiqueta">${etiqueta}</p>${html}${ayuda ? `<p class="reg-ayuda">${ayuda}</p>` : ''}</div>`;
  const pasoPara = v => (v >= 200 ? 5 : v >= 20 ? 1 : 0.5);

  function htmlValor() {
    const t = st.tipo, p = predeterminado(t), vivas = vivasHoy();
    const ayudaStd = p.estandar ? `Estándar de hoy para ${formatoNumero(vivas)} aves` : '';
    let campos = '', guardar = 'Guardar';
    if (t === 'mortalidad') {
      campos = campo('Aves muertas hoy', Contador({ id: 'reg-valor', valor: p.valor, min: 1, max: vivas >= 1 ? vivas : null, paso: 1, etiqueta: 'Aves muertas' })) +
        `<div class="reg-campo"><label class="reg-etiqueta" for="reg-causa">Causa (opcional)</label>
  <select class="reg-select" id="reg-causa"><option value="">Sin indicar</option>${CAUSAS.map(c => `<option>${c}</option>`).join('')}</select></div>`;
    } else if (t === 'alimento') {
      campos = campo('Alimento del día (kg)', Contador({ id: 'reg-valor', valor: p.valor, min: 0, paso: pasoPara(p.valor), etiqueta: 'Alimento en kilos' }), ayudaStd);
    } else if (t === 'huevos') {
      campos = campo('Huevos recogidos hoy', Contador({ id: 'reg-valor', valor: p.valor, min: 0, paso: p.valor >= 200 ? 10 : 1, etiqueta: 'Huevos recogidos' }), ayudaStd) +
        campo('Rotos o sucios', Contador({ id: 'reg-rotos', valor: 0, min: 0, paso: 1, etiqueta: 'Huevos rotos' }));
    } else if (t === 'peso') {
      campos = campo('Peso promedio por ave (g)', Contador({ id: 'reg-valor', valor: p.valor, min: 0, paso: 10, etiqueta: 'Peso promedio en gramos' }),
        p.ultimo ? 'Último peso registrado' : p.estandar ? 'Peso estándar para la edad' : 'Pesa una muestra de aves y anota el promedio');
    } else if (t === 'vacuna') {
      if (st.vacunas.length) {
        if (!st.vacunas.some(v => v.id === st.vacunaId)) st.vacunaId = st.vacunas[0].id;
        guardar = 'Marcar aplicada';
        campos = `<div class="reg-campo"><p class="reg-etiqueta">Vacuna pendiente</p><div class="reg-opciones">${st.vacunas.map(v =>
          `<button type="button" class="reg-opcion" data-accion="reg-vacuna" data-id="${esc(v.id)}" aria-pressed="${v.id === st.vacunaId}">
  <b>${esc(v.nombre)}</b><span>${esc(v.fechaPrevista || '')}${v.via ? ' · ' + esc(v.via) : ''}</span></button>`).join('')}</div></div>`;
      } else {
        campos = `<p class="reg-nota">No hay vacunas pendientes en este lote. Puedes anotar una vacuna aplicada fuera del plan.</p>` +
          `<div class="reg-campo"><label class="reg-etiqueta" for="reg-vacuna-nombre">Nombre de la vacuna</label><input class="reg-texto" id="reg-vacuna-nombre" type="text" autocomplete="off"></div>`;
      }
    } else if (t === 'sanidad') {
      campos = `<div class="reg-campo"><label class="reg-etiqueta" for="reg-enfermedad">Enfermedad o síntoma</label><input class="reg-texto" id="reg-enfermedad" type="text" autocomplete="off"></div>
<div class="reg-campo"><label class="reg-etiqueta" for="reg-tratamiento">Tratamiento</label><input class="reg-texto" id="reg-tratamiento" type="text" autocomplete="off"></div>` +
        campo('Días de retiro (sin vender huevos ni carne)', Contador({ id: 'reg-retiro', valor: 0, min: 0, paso: 1, etiqueta: 'Días de retiro' }));
    }
    return `${htmlLote()}
${campos}
<p class="reg-error" role="alert" hidden></p>
<div class="reg-pregunta" hidden></div>
<div class="reg-acciones">
  ${Boton({ texto: 'Atrás', icono: 'atras', variante: 'secundario', accion: 'reg-atras' })}
  ${Boton({ texto: guardar, variante: 'primario', accion: 'reg-guardar', clase: 'reg-guardar' })}
</div>`;
  }

  function htmlElegirLote() {
    return `<div class="reg-opciones">${st.lotes.map(l =>
      `<button type="button" class="reg-opcion" data-accion="reg-elegir-lote" data-lote="${esc(l.id)}" aria-pressed="${l.id === st.loteId}">
  <b>${esc(l.nombre || 'Lote')}</b><span>${esc((gen(l) || {}).nombre || l.genetica || '')}</span></button>`).join('')}</div>
${Boton({ texto: 'Atrás', icono: 'atras', variante: 'secundario', accion: 'reg-volver-valor', clase: 'btn-ancho' })}`;
  }

  /* ------------------------------ Flujo ------------------------------ */
  async function abrir(tipo) {
    let activos = [];
    try { activos = await DB.listar('lotes', { estado: 'activo' }); } catch (e) { activos = []; }
    if (!activos.length) { st = null; App.abrirHoja({ titulo: 'Registrar', contenido: htmlSinLotes() }); return; }
    const pref = App.estado.loteActivoId;
    st = { lotes: activos, loteId: activos.some(l => l.id === pref) ? pref : activos[0].id, tipo: null,
      registros: [], vacunas: [], vacunaId: null, guardando: false, existente: null };
    App.abrirHoja({ titulo: '¿Qué registras?', contenido: htmlTipos() });
    if (tipo && TIPOS.some(t => t.id === tipo)) await elegirTipo(tipo);
  }

  async function cargarLote() {
    st.registros = await DB.listar('registros', { loteId: st.loteId });
    st.vacunas = (await DB.listar('vacunasPlan', { loteId: st.loteId }))
      .filter(v => !v.fechaAplicada).sort((a, b) => String(a.fechaPrevista || '').localeCompare(String(b.fechaPrevista || '')));
  }

  async function elegirTipo(tipo) {
    if (!st) return;
    st.tipo = tipo; st.existente = null;
    try { await cargarLote(); } catch (e) { st.registros = []; st.vacunas = []; }
    if (!App.hojaAbierta()) return;
    poner(TIPOS.find(t => t.id === tipo).texto, htmlValor());
  }

  function mostrarError(msg) {
    const p = $h('.reg-error');
    if (p) { p.textContent = msg; p.hidden = false; }
  }
  function limpiarMensajes() {
    const p = $h('.reg-error'), q = $h('.reg-pregunta'), a = $h('.reg-acciones');
    if (p) { p.hidden = true; p.textContent = ''; }
    if (q) { q.hidden = true; q.innerHTML = ''; }
    if (a) a.hidden = false;
  }

  function leerDatos() {
    switch (st.tipo) {
      case 'mortalidad': { const d = { cantidad: num('reg-valor') }; const c = txt('reg-causa'); if (c) d.causa = c; return d; }
      case 'alimento': return { kg: num('reg-valor') };
      case 'huevos': return { cantidad: num('reg-valor'), rotos: Number.isFinite(num('reg-rotos')) ? num('reg-rotos') : 0 };
      case 'peso': return { gramos: num('reg-valor') };
      case 'vacuna': {
        const v = st.vacunas.find(x => x.id === st.vacunaId);
        return v ? { nombre: v.nombre, via: v.via || '', planId: v.id } : { nombre: txt('reg-vacuna-nombre'), via: '' };
      }
      case 'sanidad': return { enfermedad: txt('reg-enfermedad'), tratamiento: txt('reg-tratamiento'), retiroDias: num('reg-retiro') };
    }
    return {};
  }

  function sumarDatos(a, b) {
    const n = k => Number(a && a[k]) || 0, m = k => Number(b && b[k]) || 0;
    if (st.tipo === 'alimento') return { kg: redondear(n('kg') + m('kg'), 3) };
    if (st.tipo === 'huevos') return { cantidad: n('cantidad') + m('cantidad'), rotos: n('rotos') + m('rotos') };
    const d = { cantidad: n('cantidad') + m('cantidad') }, causa = (b && b.causa) || (a && a.causa);
    if (causa) d.causa = causa;
    return d;
  }

  function preguntar(existente) {
    st.existente = existente;
    const q = $h('.reg-pregunta'), a = $h('.reg-acciones');
    const d = existente.datos || {};
    const previo = st.tipo === 'alimento' ? formatoNumero(d.kg) + ' kg' : st.tipo === 'peso' ? formatoNumero(d.gramos) + ' g'
      : formatoNumero(d.cantidad) + ' ' + UNIDAD[st.tipo];
    const nombre = TIPOS.find(t => t.id === st.tipo).texto.toLowerCase();
    const sumable = SUMABLES.includes(st.tipo);
    q.innerHTML = `<p class="reg-pregunta-texto"><b>Hoy ya registraste ${esc(nombre)}: ${esc(previo)}.</b> ${sumable ? '¿Sumar o reemplazar?' : '¿Reemplazar el registro de hoy?'}</p>
<div class="reg-pregunta-botones">
  ${sumable ? Boton({ texto: 'Sumar', icono: 'mas', variante: 'primario', accion: 'reg-sumar' }) : ''}
  ${Boton({ texto: 'Reemplazar', variante: sumable ? 'secundario' : 'primario', accion: 'reg-reemplazar' })}
</div>
${Boton({ texto: 'Cancelar', variante: 'secundario', accion: 'reg-cancelar-dup', clase: 'btn-ancho' })}`;
    q.hidden = false;
    a.hidden = true;
    const b = q.querySelector('button');
    if (b) try { b.focus({ preventScroll: true }); } catch (e) { /* sin foco */ }
  }

  /* Aplica kg al inventario vinculado; devuelve los kg realmente aplicados (0 si no hay ítem o falla). */
  async function inventario(kg) {
    if (!(Number.isFinite(kg) && kg !== 0)) return 0;
    if (typeof Inventario !== 'undefined' && Inventario && typeof Inventario.descontarAlimento === 'function') {
      try { const r = await Inventario.descontarAlimento(kg); return Number(r && r.aplicadoKg) || 0; } catch (e) { /* el registro vale aunque falle el inventario */ }
    }
    return 0;
  }
  const descontado = r => Number(r && r.datos && r.datos.descontadoKg) || 0;
  const conDescontado = (datos, kg) => { const d = Object.assign({}, datos); if (kg) d.descontadoKg = kg; else delete d.descontadoKg; return d; };

  /* Escribe el cambio y devuelve la función que lo revierte exactamente (el inventario se revierte con
     los kg realmente descontados, guardados en datos.descontadoKg). */
  async function escribir(modo, datos) {
    const l = lote(), hoy = hoyLocal(), ahora = new Date().toISOString(), ali = st.tipo === 'alimento';
    if (modo === 'sumar' || modo === 'reemplazar') {
      const previo = JSON.parse(JSON.stringify(st.existente)), prevDesc = descontado(previo);
      const final = modo === 'sumar' ? sumarDatos(previo.datos, datos) : datos;
      const guardarReg = d => DB.guardar('registros', Object.assign({}, previo, { datos: d, editado: ahora }));
      await guardarReg(final);
      let neto = 0;
      if (ali) {
        if (modo === 'sumar') neto = await inventario((Number(final.kg) || 0) - (Number(previo.datos && previo.datos.kg) || 0));
        else { await inventario(-prevDesc); neto = await inventario(Number(final.kg) || 0) - prevDesc; }
        const nuevoDesc = prevDesc + neto;
        if (nuevoDesc !== descontado({ datos: final }) || (nuevoDesc && !final.descontadoKg)) await guardarReg(conDescontado(final, nuevoDesc));
      }
      return async () => { await DB.guardar('registros', previo); if (ali) await inventario(-neto); };
    }
    let planPrevio = null;
    if (st.tipo === 'vacuna' && datos.planId) {
      const plan = st.vacunas.find(v => v.id === datos.planId);
      planPrevio = JSON.parse(JSON.stringify(plan));
      await DB.guardar('vacunasPlan', Object.assign({}, plan, { fechaAplicada: hoy }));
    }
    const nuevo = await DB.guardar('registros', { loteId: l.id, fecha: hoy, tipo: st.tipo, datos, creado: ahora });
    let desc = 0;
    if (ali) {
      desc = await inventario(Number(datos.kg) || 0);
      if (desc) await DB.guardar('registros', Object.assign({}, nuevo, { datos: conDescontado(datos, desc) }));
    }
    return async () => {
      await DB.borrar('registros', nuevo.id);
      if (planPrevio) await DB.guardar('vacunasPlan', planPrevio);
      if (desc) await inventario(-desc);
    };
  }

  async function guardar(modo) {
    if (!st || st.guardando || !st.tipo) return;
    const l = lote(), hoy = hoyLocal(), datos = leerDatos();
    if (!modo) limpiarMensajes();
    let v;
    if (modo) {
      // Se valida el resultado final contra los registros sin el que se va a cambiar.
      const sin = st.registros.filter(r => r.id !== st.existente.id);
      v = validarRegistro(st.tipo, modo === 'sumar' ? sumarDatos(st.existente.datos, datos) : datos, l, sin, hoy);
    } else {
      v = validarRegistro(st.tipo, datos, l, st.registros, hoy);
    }
    if (!v.ok) { if (modo) limpiarMensajes(); mostrarError(v.mensaje); return; }
    if (!modo && v.duplicado && DIARIOS.includes(st.tipo)) {
      const ex = st.registros.filter(r => r.tipo === st.tipo && r.fecha === hoy)
        .sort((a, b) => String(a.creado || '').localeCompare(String(b.creado || '')))[0];
      if (ex) { preguntar(ex); return; }
    }
    App.ocultarToast(); // el Deshacer del guardado anterior ya no vale: borraría datos sumados después
    st.guardando = true;
    const cuerpo = $h('.hoja-cuerpo');
    if (cuerpo) cuerpo.querySelectorAll('button, input, select').forEach(b => { b.disabled = true; });
    let deshacer;
    try { deshacer = await escribir(modo, datos); } catch (e) {
      st.guardando = false;
      if (cuerpo) cuerpo.querySelectorAll('button, input, select').forEach(b => { b.disabled = false; });
      limpiarMensajes();
      mostrarError('No se pudo guardar. Intenta de nuevo.');
      return;
    }
    App.fijarLote(l.id);
    const q = $h('.reg-pregunta'), a = $h('.reg-acciones');
    if (q && !q.hidden) { q.hidden = true; a.hidden = false; }
    const btn = $h('.reg-guardar');
    if (btn) { btn.classList.add('guardado'); btn.setAttribute('aria-label', 'Guardado'); palomita(btn); }
    vibrar(30);
    const capa = App.hojaAbierta();
    const fin = () => {
      if (App.hojaAbierta() === capa) { st = null; App.cerrarHoja(); }
      App.refrescar(); App.toast('Guardado', { deshacer });
    };
    if (reducirMovimiento()) fin(); else setTimeout(fin, 700);
  }

  /* ------------------------------ Acciones ------------------------------ */
  ACCIONES['reg-tipo'] = el => elegirTipo(el.dataset.tipo);
  ACCIONES['reg-guardar'] = () => guardar();
  ACCIONES['reg-sumar'] = () => guardar('sumar');
  ACCIONES['reg-reemplazar'] = () => guardar('reemplazar');
  ACCIONES['reg-cancelar-dup'] = () => {
    limpiarMensajes(); if (st) st.existente = null;
    const g = $h('.reg-guardar'); if (g) try { g.focus({ preventScroll: true }); } catch (e) { /* sin foco */ }
  };
  ACCIONES['reg-atras'] = () => { if (!st) return; st.tipo = null; poner('¿Qué registras?', htmlTipos()); };
  ACCIONES['reg-cambiar-lote'] = () => { if (st) poner('¿Qué lote?', htmlElegirLote()); };
  ACCIONES['reg-volver-valor'] = () => { if (st && st.tipo) elegirTipo(st.tipo); };
  ACCIONES['reg-elegir-lote'] = el => { if (!st) return; st.loteId = el.dataset.lote; st.vacunaId = null; elegirTipo(st.tipo); };
  ACCIONES['reg-vacuna'] = el => {
    if (!st) return;
    st.vacunaId = el.dataset.id;
    const c = App.hojaAbierta();
    if (c) c.querySelectorAll('[data-accion="reg-vacuna"]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.id === st.vacunaId)));
  };

  return { abrir };
})();
