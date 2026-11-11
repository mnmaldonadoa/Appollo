/* =========================================================================
   APPOLLO · Pestaña «Plan del ciclo» del detalle del lote y hoja «Agregar labor».
   PlanCiclo.html(lote, tareas, vacunas, hoy) -> HTML de la pestaña (secciones Atrasadas / Esta semana /
   Próximas / Hechas / Quitadas). Las vacunas del lote (vacunasPlan) salen en las mismas secciones con el botón
   `dl-aplicar` del detalle. Lote cerrado: solo lectura. Todo texto de la persona o del catálogo pasa por esc().
   Acciones: pc-hecho, pc-quitar, pc-reactivar, pc-mover, pc-editar, pc-agregar (+ sus pasos en la hoja).
   ========================================================================= */
var ACCIONES = window.ACCIONES || (window.ACCIONES = {});

const PlanCiclo = (function () {
  'use strict';
  const SEMANA = 7, VISIBLES = 8, DIAS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
  const masDias = (f, n) => { const d = fechaADate(f); d.setDate(d.getDate() + n); return hoyLocal(d); };
  const ddmm = f => (typeof f === 'string' && f.length >= 10 ? f.slice(8, 10) + '/' + f.slice(5, 7) : '—');
  const diaTxt = f => (fechaValida(f) ? DIAS[fechaADate(f).getDay()] + ' ' + ddmm(f) : '—');
  const cadaTxt = n => (Number(n) === 1 ? 'cada día' : 'cada ' + formatoNumero(Number(n)) + ' días');
  const catDe = id => CATEGORIAS_PLAN.find(c => c.id === id) || { nombre: 'Otra labor', icono: 'hoja' };
  const ultimaHecha = t => ((t.hechas || []).map(h => h && h.fecha).filter(fechaValida).sort().pop() || null);
  const norm = s => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const gen = l => (l && typeof GENETICAS !== 'undefined' ? GENETICAS.find(g => g.id === l.genetica) || null : null);
  const noSirve = (t, g) => !!(g && bloqueadaEnModo(t, modoDe(g)));
  const modoLote = l => { const g = gen(l); return g ? modoDe(g) : null; };

  /* ------------------------------ Secciones (puro) ------------------------------ */
  /* -> {atrasadas, semana, proximas, hechas, quitadas}: cada elemento {tipo:'tarea'|'vacuna', dato, estado, fecha}. */
  function secciones(tareas, vacunas, hoy) {
    const s = { atrasadas: [], semana: [], proximas: [], hechas: [], quitadas: [] }, limite = masDias(hoy, SEMANA);
    const pendiente = (it, f) => { (f < hoy ? s.atrasadas : f <= limite ? s.semana : s.proximas).push(it); };
    for (const t of tareas || []) {
      const estado = estadoTarea(t, hoy), it = { tipo: 'tarea', dato: t, estado, fecha: null };
      if (estado === 'quitada') { it.fecha = String(t.quitadaEn || '').slice(0, 10); s.quitadas.push(it); }
      else if (estado === 'hecha' || estado === 'omitida') { it.fecha = ultimaHecha(t); s.hechas.push(it); }
      else { it.fecha = proximaFecha(t, hoy); pendiente(it, it.fecha); }
    }
    for (const v of vacunas || []) {
      const it = { tipo: 'vacuna', dato: v, estado: v.fechaAplicada ? 'hecha' : '', fecha: v.fechaAplicada || v.fechaPrevista };
      if (v.fechaAplicada) { s.hechas.push(it); continue; }
      if (!fechaValida(v.fechaPrevista)) continue;
      it.estado = v.fechaPrevista < hoy ? 'atrasada' : v.fechaPrevista === hoy ? 'hoy' : 'proxima';
      pendiente(it, v.fechaPrevista);
    }
    const titulo = it => String(it.tipo === 'tarea' ? it.dato.titulo : it.dato.nombre);
    const asc = (a, b) => String(a.fecha).localeCompare(String(b.fecha)) || (a.tipo === b.tipo ? 0 : a.tipo === 'tarea' ? -1 : 1) || titulo(a).localeCompare(titulo(b));
    const desc = (a, b) => String(b.fecha || '').localeCompare(String(a.fecha || '')) || titulo(a).localeCompare(titulo(b));
    s.atrasadas.sort(asc); s.semana.sort(asc); s.proximas.sort(asc); s.hechas.sort(desc); s.quitadas.sort(desc);
    return s;
  }

  /* Tareas del catálogo para la hoja: -> [{t, estado:'nueva'|'enplan'|'quitada'|'nosirve', filaId?}]. */
  function catalogo(g, edad, filas, texto) {
    if (!g) return [];
    const q = norm(texto).trim();
    return tareasDelCatalogo(g, modoDe(g))
      .filter(t => t.hastaDia === undefined || t.hastaDia === null || !(Number(edad) > t.hastaDia))
      .filter(t => !q || norm(t.titulo + ' ' + t.detalle + ' ' + (t.quimico ? t.quimico.tipo + ' ' + t.quimico.ingredienteActivo : '') + ' ' + catDe(t.categoria).nombre).includes(q))
      .map(t => {
        const f = (filas || []).find(x => x.catalogoId === t.id);
        if (f) return f.estado === 'quitada' ? { t, estado: 'quitada', filaId: f.id } : { t, estado: 'enplan', filaId: f.id };
        return { t, estado: noSirve(t, g) ? 'nosirve' : 'nueva' };
      });
  }

  /* ------------------------------ HTML ------------------------------ */
  const retiroDias = x => (x === null || x === undefined || x === '' ? 'ver etiqueta' : formatoNumero(Number(x)) + (Number(x) === 1 ? ' día' : ' días'));
  const tag = x => `<span class="plan-tag">${esc(x)}</span>`;
  function quimicoHtml(q) {
    return `<div class="pc-quim"><span class="plan-tags">${tag(q.tipo)}${tag(q.ingredienteActivo)}</span>
  <p class="pc-quim-retiro">Retiro huevo: ${esc(retiroDias(q.retiroHuevoDias))} · carne: ${esc(retiroDias(q.retiroCarneDias))}</p>
  <p class="pc-quim-aviso">${icono('aviso')}<span>${esc(q.advertencia || CATALOGO_AVISO_QUIMICO)}</span></p></div>`;
  }
  const textoRetiro = r => [r.huevo ? 'No vender huevos hasta el ' + ddmm(r.huevo) : '', r.carne ? 'No vender carne hasta el ' + ddmm(r.carne) : ''].filter(Boolean);

  const CHIP = { atrasada: ['rojo', 'Atrasada'], hoy: ['ambar', 'Hoy'], hecha: ['verde', 'Hecha'], omitida: ['', 'Omitida'], quitada: ['', 'Quitada'] };
  const chip = estado => {
    const c = CHIP[estado];
    return c ? `<span class="chip${c[0] ? ' chip-' + c[0] : ''}">${c[0] ? '<span class="chip-punto" aria-hidden="true"></span>' : ''}${c[1]}</span>` : '';
  };

  function cuandoTarea(it) {
    const t = it.dato, cada = Number(t.cadaDias) > 0 ? ' · ' + cadaTxt(t.cadaDias) : '';
    switch (it.estado) {
      case 'atrasada': return 'desde el ' + ddmm(it.fecha) + cada;
      case 'hoy': return 'hoy' + cada;
      case 'proxima': return diaTxt(it.fecha) + cada;
      case 'hecha': return 'hecha el ' + ddmm(it.fecha) + cada;
      case 'omitida': return t.hastaDia != null && t.hastaDia !== '' ? 'pasó su edad sin hacerse' : 'pasó un mes sin hacerse';
      case 'quitada': return 'quitada' + (fechaValida(it.fecha) ? ' el ' + ddmm(it.fecha) : '');
    }
    return '';
  }

  function hechasHtml(t) {
    const hs = (t.hechas || []).filter(h => h && fechaValida(h.fecha)).slice().sort((a, b) => b.fecha.localeCompare(a.fecha));
    if (!hs.length) return '';
    const etq = h => [Number.isInteger(h.etiquetaHuevoDias) ? 'huevo ' + retiroDias(h.etiquetaHuevoDias) : '', Number.isInteger(h.etiquetaCarneDias) ? 'carne ' + retiroDias(h.etiquetaCarneDias) : ''].filter(Boolean).join(', ');
    const fila = h => `<li>${t.quimico ? 'Último día' : 'Hecha el'} ${esc(ddmm(h.fecha))}${h.producto ? ' · producto: ' + esc(h.producto) : ''}${etq(h) ? ' · retiro en la etiqueta: ' + esc(etq(h)) : ''}${h.nota ? ' · ' + esc(h.nota) : ''}</li>`;
    return `<ul class="pc-hechas">${hs.slice(0, 3).map(fila).join('')}${hs.length > 3 ? `<li>y ${formatoNumero(hs.length - 3)} más</li>` : ''}</ul>`;
  }

  function tareaHtml(it, hoy, activo, modo) {
    const t = it.dato, c = catDe(t.categoria), id = t.id, unicaHecha = it.estado === 'hecha'; // única hecha o serie terminada: nada que mover
    // Un químico ya hecho admite otra «Hecho» para anotar el último día real del tratamiento (el retiro cuenta desde ahí).
    const conHecho = !unicaHecha || !!t.quimico;
    const ret = t.quimico ? textoRetiro(retiroVigente([t], [], hoy)) : [];
    const etq = t.quimico ? avisosEtiqueta([t], hoy, modo) : [];
    let acciones = '';
    if (activo) {
      if (it.estado === 'quitada') {
        acciones = `<div class="pc-acciones pc-acciones-una">${Boton({ texto: 'Reactivar', icono: 'mas', variante: 'secundario', accion: 'pc-reactivar', datos: { id } })}</div>`;
      } else {
        const menu = [
          !unicaHecha && it.estado !== 'omitida' ? Boton({ texto: 'Mover fecha', variante: 'secundario', accion: 'pc-mover', datos: { id } }) : '',
          Boton({ texto: 'Editar', variante: 'secundario', accion: 'pc-editar', datos: { id } }),
          Boton({ texto: 'Quitar', icono: 'cruz', variante: 'secundario', accion: 'pc-quitar', datos: { id }, clase: 'pc-quitar' }),
        ].join('');
        const mid = 'pc-menu-' + esc(id);
        acciones = `<div class="pc-acciones${conHecho ? '' : ' pc-acciones-una'}">
    ${conHecho ? Boton({ texto: 'Hecho', icono: 'sig', variante: unicaHecha ? 'secundario' : 'primario', accion: 'pc-hecho', datos: { id } }) : ''}
    <button type="button" class="btn btn-secundario pc-menu-btn" data-accion="pc-menu" data-id="${esc(id)}" aria-expanded="false" aria-controls="${mid}">${icono('menu')}<span class="btn-texto">Opciones</span></button>
  </div>
  <div class="pc-menu" id="${mid}" hidden>${menu}</div>`;
      }
    }
    return `<li class="pc-item pc-${esc(it.estado)}${t.quimico ? ' pc-quimico' : ''}" data-item="${esc(id)}" tabindex="-1">
  <div class="pc-item-cab"><span class="dl-icono">${icono(c.icono)}</span>
    <div class="dl-fila-texto"><b>${esc(t.titulo)}</b><span>${t.origen === 'propia' ? 'Propia · ' : ''}${esc(c.nombre)} · ${esc(cuandoTarea(it))}</span>${chip(it.estado)}</div></div>
  ${t.detalle ? `<p class="pc-detalle">${esc(t.detalle)}</p>` : ''}
  ${t.quimico ? quimicoHtml(t.quimico) : ''}
  ${ret.length ? `<p class="pc-retiro-tarea">${icono('aviso')}<span>${ret.map(esc).join(' · ')}</span></p>` : ''}
  ${etq.map(a => `<p class="pc-etiqueta-tarea">${icono('aviso')}<span>${esc(a.texto)}</span></p>`).join('')}
  ${hechasHtml(t)}
  ${acciones}
</li>`;
  }

  function vacunaHtml(it, hoy, activo) {
    const v = it.dato, est = it.estado;
    const cuando = v.fechaAplicada ? 'aplicada el ' + ddmm(v.fechaAplicada) : est === 'atrasada' ? 'prevista el ' + ddmm(v.fechaPrevista) : est === 'hoy' ? 'hoy' : diaTxt(v.fechaPrevista);
    const ch = v.fechaAplicada ? chip('hecha').replace('Hecha', 'Aplicada') : est === 'atrasada' ? chip('atrasada').replace('Atrasada', 'Vencida') : chip(est);
    return `<li class="pc-item pc-vacuna pc-${esc(est)}" data-item="${esc(v.id)}" tabindex="-1">
  <div class="pc-item-cab"><span class="dl-icono">${icono('jeringa')}</span>
    <div class="dl-fila-texto"><b>Vacuna: ${esc(v.nombre)}</b><span>${v.via ? esc(v.via) + ' · ' : ''}${esc(cuando)}</span>${ch}</div></div>
  ${!v.fechaAplicada && activo ? `<div class="pc-acciones pc-acciones-una">${Boton({ texto: 'Marcar aplicada', icono: 'jeringa', variante: 'secundario', accion: 'dl-aplicar', datos: { id: v.id } })}</div>` : ''}
</li>`;
  }

  const abiertos = new Set(); // <details> abiertos ('loteId|clave'): sobreviven al redibujo
  function html(lote, tareas, vacunas, hoy) {
    if (!fechaValida(hoy)) hoy = hoyLocal();
    const activo = !!lote && lote.estado === 'activo', s = secciones(tareas, vacunas, hoy), lid = lote ? lote.id : '';
    const modo = modoLote(lote);
    const item = it => (it.tipo === 'tarea' ? tareaHtml(it, hoy, activo, modo) : vacunaHtml(it, hoy, activo));
    const lista = its => `<ul class="dl-lista pc-lista">${its.map(item).join('')}</ul>`;
    const det = (clave, resumen, cuerpo, clase) => `<details class="dl-hechas pc-det${clase ? ' ' + clase : ''}" data-det="${esc(clave)}"${abiertos.has(lid + '|' + clave) ? ' open' : ''}><summary>${resumen}</summary>${cuerpo}</details>`;
    const seccion = (clave, titulo, its, corte) => {
      if (!its.length) return '';
      const vis = corte ? its.slice(0, VISIBLES) : its, resto = corte ? its.slice(VISIBLES) : [];
      return `<section class="pc-seccion pc-sec-${clave}" data-sec="${clave}" aria-labelledby="pc-t-${clave}">
  <h2 class="seccion-titulo pc-sec-titulo" id="pc-t-${clave}" tabindex="-1">${titulo} <span class="num">${formatoNumero(its.length)}</span></h2>
  ${lista(vis)}${resto.length ? det(clave + '-mas', `Ver ${formatoNumero(resto.length)} más`, lista(resto)) : ''}</section>`;
    };
    const ret = textoRetiro(retiroVigente(tareas, [], hoy)), etq = avisosEtiqueta(tareas, hoy, modo);
    const vacio = !s.atrasadas.length && !s.semana.length && !s.proximas.length && !s.hechas.length;
    return `<div class="pc-plan">
  ${ret.length ? `<div class="pc-retiro" role="note">${icono('aviso')}<div>${ret.map(x => `<p><b>${esc(x)}</b></p>`).join('')}<p>Por productos aplicados en este lote, contado desde el último día de tratamiento registrado (el día indicado incluido).</p></div></div>` : ''}
  ${etq.length ? `<div class="pc-etiqueta" role="note">${icono('aviso')}<div>${etq.map(a => `<p><b>${esc(a.texto)}</b></p>`).join('')}<p>Este producto no trae retiro en la lista. Si la etiqueta trae días de retiro, anótalos con «Hecho» en esa labor.</p></div></div>` : ''}
  ${activo ? Boton({ texto: 'Agregar labor', icono: 'mas', variante: 'primario', accion: 'pc-agregar', datos: { id: lid }, clase: 'btn-ancho' })
    : '<p class="pc-solo-lectura">Lote cerrado: el plan es de solo lectura.</p>'}
  ${vacio ? `<p class="pantalla-texto">Aún no hay labores en el plan${activo ? '. Usa «Agregar labor» para elegir del catálogo o escribir una propia.' : '.'}</p>` : ''}
  ${seccion('atrasadas', 'Atrasadas', s.atrasadas)}
  ${seccion('semana', 'Esta semana', s.semana)}
  ${seccion('proximas', 'Próximas', s.proximas, true)}
  ${seccion('hechas', 'Hechas', s.hechas, true)}
  ${s.quitadas.length ? `<section class="pc-seccion pc-sec-quitadas" data-sec="quitadas">${det('quitadas', `Quitadas <span class="num">${formatoNumero(s.quitadas.length)}</span>`, lista(s.quitadas), 'pc-quitadas')}</section>` : ''}
</div>`;
  }

  /* ------------------------------ Foco ------------------------------ */
  /* Se recuerda el último control tocado o enfocado dentro de #view; tras un redibujo (App.refrescar, Deshacer)
     el foco vuelve al mismo data-accion/data-id, o a su tarjeta, o al título de su sección, nunca a <body>. */
  let ultimo = null, restaurando = false;
  function anotar(e) {
    if (restaurando) return; // el foco que pone restaurarFoco no reemplaza el control que la persona tocó
    const el = e.target && e.target.closest ? e.target.closest('#view [data-accion], #view [data-item], #view summary') : null;
    if (!el) return;
    const it = el.closest('[data-item]'), sec = el.closest('[data-sec]'), d = el.closest('details[data-det]');
    ultimo = { ruta: location.hash.split('/').slice(0, 3).join('/'), accion: el.dataset.accion || '', id: el.dataset.id || '',
      item: it ? it.dataset.item : '', sec: sec ? sec.dataset.sec : '', det: el.tagName === 'SUMMARY' && d ? d.dataset.det : '' };
  }
  if (typeof document !== 'undefined' && document.addEventListener) {
    document.addEventListener('focusin', anotar, true);
    document.addEventListener('click', anotar, true);
  }
  const visible = el => !!el && el.getClientRects().length > 0 && !el.disabled;
  const cssq = s => (window.CSS && CSS.escape ? CSS.escape(s) : String(s).replace(/["\\]/g, '\\$&'));
  function enfocar(el) { if (!el) return false; try { el.focus({ preventScroll: true }); } catch (e) { return false; } return document.activeElement === el; }
  function restaurarFoco(raiz) {
    const a = document.activeElement;
    if (!ultimo || App.hojaAbierta() || (a && a !== document.body && document.contains(a))) return;
    if (ultimo.ruta !== location.hash.split('/').slice(0, 3).join('/')) return;
    const q = s => raiz.querySelector(s), cands = [];
    if (ultimo.accion) cands.push(q(`[data-accion="${cssq(ultimo.accion)}"]${ultimo.id ? `[data-id="${cssq(ultimo.id)}"]` : ''}`));
    if (ultimo.det) cands.push(q(`details[data-det="${cssq(ultimo.det)}"] > summary`));
    if (ultimo.item) {
      const it = q(`[data-item="${cssq(ultimo.item)}"]`);
      cands.push(it);
      const d = it && it.closest('details:not([open])');
      if (d) cands.push(d.querySelector('summary'));
    }
    if (ultimo.sec) { const s = q(`[data-sec="${cssq(ultimo.sec)}"]`); if (s) cands.push(s.querySelector('h2, summary')); }
    cands.push(q('[role=tab][aria-selected=true]'));
    restaurando = true;
    try { for (const el of cands) if (visible(el) && enfocar(el)) return; } finally { restaurando = false; }
  }
  function montar(raiz) {
    raiz.addEventListener('toggle', e => {
      const d = e.target, lid = location.hash.split('/')[2] || '';
      if (!d.dataset || !d.dataset.det) return;
      const k = decodeURIComponent(lid) + '|' + d.dataset.det;
      if (d.open) abiertos.add(k); else abiertos.delete(k);
    }, true);
    restaurarFoco(raiz);
  }

  /* ------------------------------ Hojas ------------------------------ */
  let ocupado = false; // una operación a la vez: un doble toque no duplica hechas
  const $h = s => { const c = App.hojaAbierta(); return c ? c.querySelector(s) : null; };
  const valor = s => { const el = $h(s); return el ? el.value : ''; };
  const valorNum = s => { const el = $h(s); return !el ? '' : el.validity && el.validity.badInput ? 'x' : el.value; }; // texto no numérico: se rechaza, no se ignora
  function error(msg) { const p = $h('.reg-error'); if (p) { p.textContent = msg; p.hidden = false; } }
  const campo = (id, etiqueta, control, ayuda) => `<div class="reg-campo"><label class="reg-etiqueta" for="${id}">${etiqueta}</label>${control}${ayuda ? `<p class="reg-ayuda">${ayuda}</p>` : ''}</div>`;
  const pie = (accion, id, texto) => `<p class="reg-error" role="alert" hidden></p>
<div class="reg-acciones">${Boton({ texto: 'Cancelar', variante: 'secundario', accion: 'cerrar-hoja' })}${Boton({ texto, variante: 'primario', accion, datos: { id }, clase: 'reg-guardar' })}</div>`;

  /* Ejecuta una escritura desde la hoja: bloquea los controles, muestra el mensaje si se rechaza; si va bien
     cierra la hoja, redibuja y ofrece Deshacer cuando la operación lo permite. */
  async function desdeHoja(fn, msg) {
    if (ocupado) return;
    ocupado = true;
    App.ocultarToast(); // el Deshacer anterior ya no vale
    const cuerpo = $h('.hoja-cuerpo'), ctrls = cuerpo ? [...cuerpo.querySelectorAll('button, input, select, textarea')] : [];
    ctrls.forEach(b => { b.disabled = true; });
    let r;
    try { r = await fn(); } catch (e) { r = { mensaje: 'No se pudo guardar. Intenta de nuevo.' }; }
    ocupado = false;
    if (r && r.mensaje) {
      ctrls.forEach(b => { b.disabled = false; });
      error(r.mensaje);
      return;
    }
    App.cerrarHoja();
    await App.refrescar();
    App.toast(msg, typeof r === 'function' ? { deshacer: r } : undefined);
  }
  /* Escritura con un toque desde la pestaña (Quitar, Reactivar). */
  async function desdeVista(el, fn, msg) {
    if (ocupado) return;
    ocupado = true;
    el.disabled = true;
    App.ocultarToast();
    let r;
    try { r = await fn(); } catch (e) { r = { mensaje: 'No se pudo guardar. Intenta de nuevo.' }; }
    ocupado = false;
    if (r && r.mensaje) { el.disabled = false; App.toast(r.mensaje); return; }
    await App.refrescar();
    App.toast(msg, typeof r === 'function' ? { deshacer: r } : undefined);
  }

  async function cargarTarea(id) {
    const t = await DB.obtener('planTareas', id);
    const l = t ? await DB.obtener('lotes', t.loteId) : null;
    if (!t || !l) { App.toast('La tarea ya no existe'); App.refrescar(); return null; }
    if (l.estado !== 'activo') { App.toast('El lote está cerrado'); App.refrescar(); return null; }
    return { t, l };
  }

  ACCIONES['pc-menu'] = el => {
    const m = document.getElementById(el.getAttribute('aria-controls') || '');
    if (!m) return;
    const abrir = el.getAttribute('aria-expanded') !== 'true';
    el.setAttribute('aria-expanded', String(abrir));
    m.hidden = !abrir;
  };

  /* Hoja «Marcar hecha». En un químico la fecha es el ÚLTIMO día de tratamiento (el retiro se cuenta desde ahí) y hay
     campos opcionales con los días de retiro de la etiqueta. Se abre desde la pestaña y desde Alertas. */
  async function abrirHecho(id) {
    if (ocupado) return;
    const c = await cargarTarea(id);
    if (!c) return;
    const { t, l } = c, hoy = hoyLocal(), q = t.quimico, carne = modoLote(l) === 'carne';
    // Prefill: los días de la etiqueta de la hecha más reciente de esta tarea que los tenga (huevo y carne aparte).
    const previoEtq = k => {
      const hs = (t.hechas || []).filter(h => h && fechaValida(h.fecha) && Number.isInteger(h[k]) && h[k] >= 0);
      return hs.length ? String(hs.reduce((a, b) => (b.fecha >= a.fecha ? b : a))[k]) : '';
    };
    const pre = { 'pc-etq-huevo': previoEtq('etiquetaHuevoDias'), 'pc-etq-carne': previoEtq('etiquetaCarneDias') };
    const num = (id2, et) => `<div class="reg-campo"><label class="reg-etiqueta" for="${id2}">${et}</label><input class="reg-texto" id="${id2}" type="number" inputmode="numeric" min="0" max="365" step="1" placeholder="—" value="${esc(pre[id2])}"></div>`;
    App.abrirHoja({ titulo: 'Marcar hecha', contenido: `<p class="pc-hoja-tarea"><b>${esc(t.titulo)}</b></p>
${q ? quimicoHtml(q) : ''}
${q ? campo('pc-fecha', 'Último día de tratamiento (última dosis)', `<input class="reg-texto" id="pc-fecha" type="date" value="${hoy}" max="${hoy}"${fechaValida(l.fechaLlegada) ? ` min="${esc(l.fechaLlegada)}"` : ''}>`, 'El retiro se cuenta desde el último día que las aves recibieron el producto.')
    : campo('pc-fecha', 'Fecha en que se hizo', `<input class="reg-texto" id="pc-fecha" type="date" value="${hoy}" max="${hoy}"${fechaValida(l.fechaLlegada) ? ` min="${esc(l.fechaLlegada)}"` : ''}>`)}
${q ? campo('pc-producto', 'Producto usado (nombre comercial)', '<input class="reg-texto" id="pc-producto" type="text" maxlength="80" autocomplete="off">', 'Así queda constancia de qué se aplicó.') : ''}
${q ? `<fieldset class="pc-etq"><legend class="reg-etiqueta">Días de retiro según la etiqueta (opcional)</legend>
  <div class="pc-etq-fila${carne ? ' pc-etq-una' : ''}">${carne ? '' : num('pc-etq-huevo', 'Huevo')}${num('pc-etq-carne', 'Carne')}</div>
  <p class="reg-ayuda">De 0 a 365 días. Si lo anotas, manda sobre el retiro de la lista.</p></fieldset>` : ''}
${campo('pc-nota', 'Nota (opcional)', '<input class="reg-texto" id="pc-nota" type="text" maxlength="200" autocomplete="off">')}
${pie('pc-hecho-guardar', t.id, 'Guardar')}` });
  }
  ACCIONES['pc-hecho'] = el => abrirHecho(el.dataset.id);
  ACCIONES['pc-hecho-guardar'] = el => desdeHoja(() => Plan.marcarHecha(el.dataset.id, { fecha: valor('#pc-fecha'), nota: valor('#pc-nota'), producto: valor('#pc-producto'),
    etiquetaHuevoDias: valorNum('#pc-etq-huevo'), etiquetaCarneDias: valorNum('#pc-etq-carne') }), 'Labor hecha');

  ACCIONES['pc-mover'] = async el => {
    if (ocupado) return;
    const c = await cargarTarea(el.dataset.id);
    if (!c) return;
    const { t } = c, f = proximaFecha(t, hoyLocal()) || hoyLocal();
    App.abrirHoja({ titulo: 'Mover fecha', contenido: `<p class="pc-hoja-tarea"><b>${esc(t.titulo)}</b></p>
${campo('pc-mover-fecha', 'Nueva fecha', `<input class="reg-texto" id="pc-mover-fecha" type="date" value="${esc(f)}">`, Number(t.cadaDias) > 0 ? 'Las siguientes repeticiones se cuentan desde esta fecha.' : '')}
${pie('pc-mover-guardar', t.id, 'Mover')}` });
  };
  ACCIONES['pc-mover-guardar'] = el => desdeHoja(() => Plan.mover(el.dataset.id, valor('#pc-mover-fecha')), 'Fecha cambiada');

  ACCIONES['pc-editar'] = async el => {
    if (ocupado) return;
    const c = await cargarTarea(el.dataset.id);
    if (!c) return;
    const { t } = c;
    App.abrirHoja({ titulo: 'Editar labor', contenido: `${campo('pc-edit-titulo', 'Título', `<input class="reg-texto" id="pc-edit-titulo" type="text" maxlength="80" autocomplete="off" value="${esc(t.titulo)}">`)}
${campo('pc-edit-detalle', 'Detalle o nota', `<textarea class="reg-texto pc-area" id="pc-edit-detalle" rows="4" maxlength="500">${esc(t.detalle || '')}</textarea>`)}
${pie('pc-editar-guardar', t.id, 'Guardar')}` });
  };
  ACCIONES['pc-editar-guardar'] = el => desdeHoja(() => Plan.editar(el.dataset.id, { titulo: valor('#pc-edit-titulo'), detalle: valor('#pc-edit-detalle') }), 'Labor editada');

  ACCIONES['pc-quitar'] = el => desdeVista(el, () => Plan.quitar(el.dataset.id), 'Labor quitada');

  /* Reactivar: desde la sección Quitadas o desde el catálogo de la hoja (allí la hoja sigue abierta). */
  ACCIONES['pc-reactivar'] = async el => {
    if (!el.closest('.hoja')) return desdeVista(el, () => Plan.reactivar(el.dataset.id), 'Labor reactivada');
    if (ocupado) return;
    ocupado = true; el.disabled = true;
    let r;
    try { r = await Plan.reactivar(el.dataset.id); } catch (e) { r = { mensaje: 'No se pudo guardar. Intenta de nuevo.' }; }
    ocupado = false;
    await trasCatalogo(el, r, 'Labor reactivada');
  };

  /* ---------- Hoja «Agregar labor»: pestañas Del catálogo / Propia ---------- */
  let hojaLote = null; // {lote, g, edad}
  async function pintarCatalogo() {
    const caja = $h('.pc-cat-resultados');
    if (!caja || !hojaLote) return;
    const texto = valor('#pc-buscar'), filas = await Plan.listar(hojaLote.lote.id);
    if (!$h('.pc-cat-resultados')) return;
    const res = catalogo(hojaLote.g, hojaLote.edad, filas, texto);
    const abiertas = new Set([...caja.querySelectorAll('details[open]')].map(d => d.dataset.cat));
    const fila = x => {
      const t = x.t;
      const boton = x.estado === 'nueva' ? Boton({ texto: 'Agregar', icono: 'mas', variante: 'primario', accion: 'pc-agregar-cat', datos: { id: t.id } })
        : x.estado === 'quitada' ? Boton({ texto: 'Reactivar', icono: 'mas', variante: 'secundario', accion: 'pc-reactivar', datos: { id: x.filaId } })
          : x.estado === 'enplan' ? '<span class="chip chip-verde"><span class="chip-punto" aria-hidden="true"></span>En el plan</span>'
            : `<p class="plan-item-d"><b>${esc(motivoBloqueo(t))}</b></p>`;
      return `<li class="pc-cat-item" data-cat-item="${esc(t.id)}" tabindex="-1"><div class="pc-cat-texto"><b>${esc(t.titulo)}</b>
  <span class="pc-cat-dia">Desde el día ${formatoNumero(t.desdeDia)}${Number(t.cadaDias) > 0 ? ' · ' + esc(cadaTxt(t.cadaDias)) : ''}</span>
  ${t.detalle ? `<span class="plan-item-d">${esc(t.detalle)}</span>` : ''}${t.quimico ? quimicoHtml(t.quimico) : ''}</div>${boton}</li>`;
    };
    let cuerpo;
    if (!hojaLote.g) cuerpo = '<p class="pantalla-texto">La genética de este lote no está en el catálogo. Puedes agregar labores propias.</p>';
    else if (!res.length) cuerpo = `<p class="pantalla-texto">No hay labores que coincidan con «${esc(texto.trim())}».</p>`;
    else if (texto.trim()) cuerpo = `<p class="reg-ayuda" role="status">${formatoNumero(res.length)} ${res.length === 1 ? 'labor encontrada' : 'labores encontradas'}</p><ul class="pc-cat-lista">${res.map(fila).join('')}</ul>`;
    else {
      cuerpo = CATEGORIAS_PLAN.map(c => {
        const xs = res.filter(x => x.t.categoria === c.id);
        if (!xs.length) return '';
        const nuevas = xs.filter(x => x.estado === 'nueva' || x.estado === 'quitada').length;
        return `<details class="pc-cat" data-cat="${esc(c.id)}"${abiertas.has(c.id) ? ' open' : ''}><summary><span>${esc(c.nombre)}</span><span class="nl-cat-cuenta">${nuevas ? formatoNumero(nuevas) + ' para agregar' : 'Todo en el plan'}</span></summary><ul class="pc-cat-lista">${xs.map(fila).join('')}</ul></details>`;
      }).join('');
    }
    caja.innerHTML = cuerpo;
  }
  async function trasCatalogo(el, r, msg) {
    const id = el.closest('[data-cat-item]') ? el.closest('[data-cat-item]').dataset.catItem : '';
    if (r && r.mensaje) { el.disabled = false; App.toast(r.mensaje); return; }
    await App.refrescar();
    await pintarCatalogo();
    const it = id ? $h(`[data-cat-item="${cssq(id)}"]`) : null;
    if (it) enfocar(it.querySelector('button') || it);
    App.toast(msg, typeof r === 'function' ? { deshacer: r } : undefined); // Reactivar devuelve su deshacer
  }

  ACCIONES['pc-agregar'] = async el => {
    if (ocupado) return;
    const lote = await DB.obtener('lotes', el.dataset.id);
    if (!lote || lote.estado !== 'activo') { App.refrescar(); return; }
    const g = gen(lote), hoy = hoyLocal();
    hojaLote = { lote, g, edad: edadDias(lote, hoy) };
    const pest = (id, texto, sel) => `<button type="button" class="segmento-btn" role="tab" id="pc-tab-${id}" aria-controls="pc-panel-${id}" aria-selected="${sel}" data-accion="pc-hoja-pestana" data-id="${id}">${texto}</button>`;
    App.abrirHoja({ titulo: 'Agregar labor', contenido: `<div class="segmento pc-hoja-pestanas" role="tablist" aria-label="Origen de la labor">${pest('catalogo', 'Del catálogo', true)}${pest('propia', 'Propia', false)}</div>
<div class="pc-panel" id="pc-panel-catalogo" role="tabpanel" aria-labelledby="pc-tab-catalogo">
  ${campo('pc-buscar', 'Buscar en el catálogo', '<input class="reg-texto" id="pc-buscar" type="search" autocomplete="off" placeholder="Ej.: agua, cama, piojos">')}
  <div class="pc-cat-resultados"></div>
</div>
<div class="pc-panel" id="pc-panel-propia" role="tabpanel" aria-labelledby="pc-tab-propia" hidden>
  ${campo('pc-titulo', 'Título', '<input class="reg-texto" id="pc-titulo" type="text" maxlength="80" autocomplete="off" placeholder="Ej.: Revisar cortinas">')}
  ${campo('pc-categoria', 'Categoría', `<select class="reg-select" id="pc-categoria">${CATEGORIAS_PLAN.map(c => `<option value="${esc(c.id)}">${esc(c.nombre)}</option>`).join('')}</select>`)}
  ${campo('pc-propia-fecha', 'Fecha', `<input class="reg-texto" id="pc-propia-fecha" type="date" value="${hoy}">`)}
  ${campo('pc-cada', 'Repetir cada (días, opcional)', '<input class="reg-texto" id="pc-cada" type="number" inputmode="numeric" min="1" max="365" step="1" placeholder="Vacío: una sola vez">')}
  ${campo('pc-detalle', 'Nota (opcional)', '<input class="reg-texto" id="pc-detalle" type="text" maxlength="200" autocomplete="off">')}
  ${pie('pc-propia-guardar', lote.id, 'Agregar labor')}
</div>` });
    const b = $h('#pc-buscar');
    if (b) b.addEventListener('input', () => { pintarCatalogo(); });
    await pintarCatalogo();
  };
  ACCIONES['pc-hoja-pestana'] = el => {
    const c = App.hojaAbierta();
    if (!c) return;
    c.querySelectorAll('[data-accion="pc-hoja-pestana"]').forEach(b => {
      const sel = b === el;
      b.setAttribute('aria-selected', String(sel));
      const p = c.querySelector('#' + b.getAttribute('aria-controls'));
      if (p) p.hidden = !sel;
    });
  };
  ACCIONES['pc-agregar-cat'] = async el => {
    if (ocupado || !hojaLote) return;
    ocupado = true; el.disabled = true;
    let r;
    try { r = await Plan.agregarCatalogo(hojaLote.lote, el.dataset.id); } catch (e) { r = { mensaje: 'No se pudo guardar. Intenta de nuevo.' }; }
    ocupado = false;
    await trasCatalogo(el, r, 'Labor agregada');
  };
  ACCIONES['pc-propia-guardar'] = () => {
    if (!hojaLote) return;
    return desdeHoja(async () => {
      const r = await Plan.agregarPropia(hojaLote.lote, { titulo: valor('#pc-titulo'), categoria: valor('#pc-categoria'),
        fecha: valor('#pc-propia-fecha'), cadaDias: valor('#pc-cada'), detalle: valor('#pc-detalle') });
      return r && r.mensaje ? r : null;
    }, 'Labor agregada');
  };

  return { html, secciones, catalogo, montar, abrirHecho };
})();
