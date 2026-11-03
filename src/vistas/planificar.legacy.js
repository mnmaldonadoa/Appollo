/* =========================================================================
   APPOLLO · Interfaz
   ========================================================================= */
(function () {
  'use strict';

  /* ----------------------- Almacenamiento local ----------------------- */
  const LS = {
    get(k, def) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : def; } catch (e) { return def; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* sin almacenamiento */ } }
  };
  const K_ESTADO = 'appollo.v1.estado', K_LOTES = 'appollo.v1.lotes', K_PRECIOS = 'appollo.v1.precios';
  const BASE = { gid: null, obj: 'huevos', edad: null, unidad: 'semanas', aves: 100, alt: 2800, real: null, fin: null, sel: [], enf: null, filtro: 'todas' };
  const S = Object.assign({}, BASE, LS.get(K_ESTADO, {}));
  const precios = Object.assign({ cubeta: '', kgVivo: '', kgAlim: '' }, LS.get(K_PRECIOS, {}));
  const guardar = () => LS.set(K_ESTADO, S);

  /* ------------------------------ Útiles ------------------------------ */
  const $ = (s, el = document) => el.querySelector(s);
  const view = $('#view'), barra = $('#barra'), top = $('#top');
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const ic = (n, extra = '') => `<svg class="ic ${extra}" aria-hidden="true"><use href="#i-${n}"></use></svg>`;
  const huevo = (cls = '') => `<svg viewBox="0 0 20 24" aria-hidden="true" class="${cls}"><path class="egg-shell" d="M10 1.5C5.2 1.5 1.8 9 1.8 14.2 1.8 19 5.4 22.5 10 22.5s8.2-3.5 8.2-8.3C18.2 9 14.8 1.5 10 1.5z"/><circle class="egg-yolk" cx="10" cy="14.6" r="4.3"/></svg>`;
  const gen = () => GENETICAS.find(g => g.id === S.gid);
  const modo = () => { const g = gen(); return g ? modoDe(g, S.obj) : 'huevos'; };
  const dias = () => { const e = Number(S.edad); if (!isFinite(e)) return NaN; return Math.round(S.unidad === 'semanas' ? e * 7 : e); };
  const plural = (n, s, p) => `${fmt(n, n % 1 ? 1 : 0)} ${n === 1 ? s : p}`;
  const edadTxt = () => S.unidad === 'semanas' ? plural(Number(S.edad), 'semana', 'semanas') : plural(Number(S.edad), 'día', 'días');
  const edadCorta = d => d <= 56 ? `Día ${d}` : `Sem. ${Math.round(d / 7)}`;

  function maxDias() {
    const g = gen(); if (!g) return 0;
    return modo() === 'huevos' ? 693 : g.carne.rango[1] - 1;
  }
  function errorEdad() {
    const d = dias();
    if (S.edad === null || S.edad === '' || !isFinite(d)) return 'Escribe la edad de las aves.';
    if (d < 0) return 'La edad no puede ser negativa.';
    if (d > maxDias()) return modo() === 'huevos' ? 'Para proyectar, la edad debe ser menor a 99 semanas.' : `La edad supera la edad máxima de venta (${gen().carne.rango[1]} días).`;
    return '';
  }
  const avesOk = () => Number.isFinite(S.aves) && S.aves >= 1 && S.aves <= 1000000;
  const loteValido = () => gen() && !errorEdad() && avesOk();

  function opcionesFin() {
    const g = gen(), d = dias();
    if (modo() === 'huevos') {
      const o = [72, 80, 90, 100].map(w => w * 7).filter(x => x > d + 6);
      return o.length ? o : [700];
    }
    const o = [];
    for (let x = g.carne.rango[0]; x <= g.carne.rango[1]; x += 7) if (x > d) o.push(x);
    return o.length ? o : [g.carne.rango[1]];
  }
  function dFin() {
    const g = gen(), ops = opcionesFin();
    const def = modo() === 'huevos' ? g.postura.fin * 7 : g.carne.venta;
    if (S.fin && ops.includes(S.fin)) return S.fin;
    if (ops.includes(def)) return def;
    return ops[0];
  }
  function realVisible() {
    const g = gen(), d = dias();
    if (modo() === 'huevos') return d >= (g.postura.w50 - 1) * 7;
    return d >= 3;
  }
  function estado() {
    const g = gen();
    const real = realVisible() && S.real !== null && S.real !== '' && isFinite(Number(S.real)) ? Number(S.real) : null;
    return { g, modo: modo(), dias: dias(), dFin: dFin(), aves: Math.round(S.aves), alt: Number(S.alt) || 0, enf: S.enf, real };
  }
  const selSet = () => new Set(S.sel);

  function toast(msg) {
    const t = $('#toast'); t.textContent = msg; t.hidden = false;
    clearTimeout(toast._t); toast._t = setTimeout(() => { t.hidden = true; }, 2200);
  }

  /* ------------------------------ Rutas ------------------------------ */
  const RUTAS = ['genetica', 'lote', 'manejo', 'proyeccion', 'lotes'];
  let rutaActual = null;
  function ruta() {
    let r = location.hash.slice(1);
    if (!RUTAS.includes(r)) r = 'genetica';
    if ((r === 'lote' || r === 'manejo' || r === 'proyeccion') && !gen()) r = 'genetica';
    if ((r === 'manejo' || r === 'proyeccion') && !loteValido()) r = 'lote';
    return r;
  }
  function ir(r) {
    if (location.hash.slice(1) !== r) location.hash = r;
    else render();
  }
  window.addEventListener('hashchange', () => render());

  function render(mantenerScroll) {
    const r = ruta();
    const y = window.scrollY;
    top.innerHTML = cabecera(r);
    view.innerHTML = PANTALLAS[r]();
    const b = BARRAS[r]();
    barra.innerHTML = b ? `<div class="barra-in">${b}</div>` : '';
    barra.hidden = !b;
    if (r !== rutaActual) { window.scrollTo(0, 0); rutaActual = r; }
    else if (mantenerScroll) window.scrollTo(0, y);
    if (r === 'lote') vivoLote();
    document.documentElement.style.setProperty('--top-h', top.offsetHeight + 'px');
    const res = document.querySelector('.resumen-manejo');
    if (res) document.documentElement.style.setProperty('--res-h', res.offsetHeight + 'px');
  }

  /* ----------------------------- Cabecera ----------------------------- */
  function cabecera(r) {
    const atras = { lote: 'genetica', manejo: 'lote', proyeccion: 'manejo', lotes: gen() && loteValido() ? 'proyeccion' : 'genetica' }[r];
    const nLotes = LS.get(K_LOTES, []).length;
    const pasos = [['genetica', 'Genética'], ['lote', 'Lote'], ['manejo', 'Manejo'], ['proyeccion', 'Proyección']];
    const idx = pasos.findIndex(p => p[0] === r);
    const puede = k => k === 'genetica' || (k === 'lote' && gen()) || ((k === 'manejo' || k === 'proyeccion') && loteValido());
    return `
      <div class="top-row">
        ${atras ? `<button class="icon-btn solo" data-act="ir" data-r="${atras}" aria-label="Volver">${ic('atras')}</button>` : ''}
        <div class="marca">${huevo('logo')}<span>Appollo</span></div>
        <button class="icon-btn" data-act="ir" data-r="lotes" aria-label="Mis lotes guardados">${ic('lotes')}<span>Mis lotes${nLotes ? ` · ${nLotes}` : ''}</span></button>
      </div>
      ${r === 'lotes' ? '' : `<ol class="huevera" aria-label="Pasos">
        ${pasos.map((p, i) => `<li class="${i < idx ? 'hecho' : i === idx ? 'actual' : ''}"><button data-act="ir" data-r="${p[0]}" ${puede(p[0]) ? '' : 'disabled'} ${i === idx ? 'aria-current="step"' : ''}>${huevo()}<span>${p[1]}</span></button></li>`).join('')}
      </ol>`}`;
  }

  /* ========================= 1 · GENÉTICA ========================= */
  function pantGenetica() {
    const filtros = [['todas', 'Todas'], ['postura', 'Postura'], ['carne', 'Carne'], ['doble', 'Doble propósito'], ['criolla', 'Criolla']];
    return `<section class="screen">
      <div class="intro"><span class="eyebrow">Paso 1 de 4</span>
        <h1>¿Qué gallinas vas a manejar?</h1>
        <p class="lead">Elige la genética. Cada línea tiene su propio estándar de producción y sus recomendaciones.</p></div>
      <div class="chips" role="group" aria-label="Filtrar por tipo">
        ${filtros.map(f => `<button class="chip" data-act="filtro" data-v="${f[0]}" aria-pressed="${S.filtro === f[0]}">${f[1]}</button>`).join('')}
      </div>
      <div class="lista" id="lista-gen">${listaGen()}</div>
    </section>`;
  }
  function listaGen() {
    return GENETICAS.filter(g => S.filtro === 'todas' || g.tipo === S.filtro).map(g => `
      <button class="gen" data-act="gen" data-id="${g.id}" aria-current="${S.gid === g.id}">
        <span class="gen-head"><span class="gen-nombre">${esc(g.nombre)}</span><span class="tag ${g.tipo}">${TIPOS[g.tipo].corto}</span></span>
        <span class="gen-desc">${esc(g.desc)}</span>
        <span class="datos">${g.datos.map(d => `<span><span class="dt">${esc(d[0])}</span><span class="dd">${esc(d[1])}</span></span>`).join('')}</span>
        <span class="gen-pie"><span>${esc(g.rasgo)} · ${esc(g.origen)}</span><span class="ir">Elegir ${ic('sig')}</span></span>
      </button>`).join('');
  }

  /* =========================== 2 · LOTE =========================== */
  function presetsEdad() {
    const g = gen();
    if (modo() === 'huevos') return [[1, 'dias', '1 día'], [4, 'semanas', '4 sem'], [10, 'semanas', '10 sem'], [17, 'semanas', '17 sem'], [25, 'semanas', '25 sem'], [40, 'semanas', '40 sem'], [60, 'semanas', '60 sem']];
    if (esBroiler(g)) return [1, 7, 14, 21, 28, 35].map(d => [d, 'dias', d === 1 ? '1 día' : `${d} días`]);
    if (g.id === 'campero') return [1, 14, 28, 42, 56].map(d => [d, 'dias', d === 1 ? '1 día' : `${d} días`]);
    return [[1, 'dias', '1 día'], [4, 'semanas', '4 sem'], [8, 'semanas', '8 sem'], [12, 'semanas', '12 sem'], [16, 'semanas', '16 sem']];
  }
  function pantLote() {
    const g = gen();
    const dual = g.tipo === 'doble' || g.tipo === 'criolla';
    const alts = [[100, 'Costa'], [400, 'Amazonía'], [1800, 'Valle'], [2800, 'Sierra']];
    return `<section class="screen">
      <div class="intro"><span class="eyebrow">Paso 2 de 4</span><h1>Datos del lote</h1>
        <p class="lead">Con la edad, el número de aves y la altitud se ajustan las recomendaciones y la proyección.</p></div>
      <div class="sel-gen"><div><div class="gen-nombre">${esc(g.nombre)}</div><div class="small muted">${esc(g.rasgo)} · ${TIPOS[g.tipo].nombre}</div></div>
        <button class="link" data-act="ir" data-r="genetica">Cambiar</button></div>
      ${dual ? `<div class="bloque"><div class="campo"><span class="lbl" id="lbl-obj">¿Para qué las crías?</span>
        <div class="seg" role="group" aria-labelledby="lbl-obj">
          <button data-act="obj" data-v="huevos" aria-pressed="${S.obj === 'huevos'}">Huevos</button>
          <button data-act="obj" data-v="carne" aria-pressed="${S.obj === 'carne'}">Carne</button></div></div></div>` : ''}
      <div class="bloque">
        <div class="campo">
          <div class="bloque-head"><label for="edad">Edad de las aves</label>
            <div class="seg" role="group" aria-label="Unidad de edad" style="width:190px">
              <button data-act="unidad" data-v="dias" aria-pressed="${S.unidad === 'dias'}">Días</button>
              <button data-act="unidad" data-v="semanas" aria-pressed="${S.unidad === 'semanas'}">Semanas</button></div></div>
          <div class="stepper"><button data-act="menos" data-c="edad" aria-label="Restar">−</button>
            <input id="edad" class="num" type="number" inputmode="decimal" min="0" step="1" value="${S.edad ?? ''}" aria-describedby="err-edad">
            <button data-act="mas" data-c="edad" aria-label="Sumar">+</button></div>
          <div class="chips" role="group" aria-label="Edades frecuentes">${presetsEdad().map(p => `<button class="chip" data-act="preset" data-v="${p[0]}" data-u="${p[1]}">${p[2]}</button>`).join('')}</div>
          <div id="fase-vivo"></div>
          <p class="error" id="err-edad" role="alert"></p>
        </div>
      </div>
      <div class="bloque">
        <div class="campo"><label for="aves">Número de aves vivas</label>
          <div class="stepper"><button data-act="menos" data-c="aves" aria-label="Restar 10">−</button>
            <input id="aves" class="num" type="number" inputmode="numeric" min="1" step="1" value="${S.aves}">
            <button data-act="mas" data-c="aves" aria-label="Sumar 10">+</button></div></div>
        <div class="campo"><label for="alt">Altitud de la granja (msnm)</label>
          <input id="alt" class="entrada chica num" type="number" inputmode="numeric" min="0" max="4500" step="50" value="${S.alt}">
          <div class="chips" role="group" aria-label="Zonas">${alts.map(a => `<button class="chip" data-act="alt" data-v="${a[0]}" aria-pressed="${Number(S.alt) === a[0]}">${a[1]} · ${fmt(a[0])} m</button>`).join('')}</div>
          <p class="ayuda" id="ayuda-alt"></p></div>
      </div>
      <div id="real-vivo"></div>
    </section>`;
  }
  function vivoLote() {
    const g = gen(); if (!g) return;
    const err = errorEdad();
    const e = $('#err-edad'); if (e) e.textContent = err;
    const f = $('#fase-vivo');
    if (f) {
      if (err) f.innerHTML = '';
      else {
        const ph = fase(g, modo(), dias());
        f.innerHTML = `<div class="fase">${huevo()}<span>Fase: <strong>${ph.n}</strong> · ${ph.r}</span></div>`;
      }
    }
    const a = $('#ayuda-alt');
    if (a) {
      const alt = Number(S.alt) || 0;
      a.textContent = modo() === 'carne' && esBroiler(g) && alt >= 2000 ? 'Sobre 2.000 m el pollo de engorde crece menos y tiene más riesgo de ascitis. La app lo incluye en la proyección.'
        : alt >= 2000 ? 'En zona alta las noches son frías: la app ajusta las recomendaciones de temperatura.' : 'La altitud ajusta temperatura, densidad y riesgo de ascitis.';
    }
    const rv = $('#real-vivo');
    if (rv) {
      if (!err && realVisible()) {
        const h = modo() === 'huevos';
        const prev = rv.dataset.tipo === (h ? 'h' : 'c');
        if (!prev) {
          rv.dataset.tipo = h ? 'h' : 'c';
          rv.innerHTML = `<div class="bloque"><div class="campo"><label for="real">${h ? '% de postura actual' : 'Peso promedio actual (g)'} <span class="muted small">· opcional</span></label>
            <input id="real" class="entrada chica num" type="number" inputmode="decimal" min="0" step="${h ? '0.1' : '1'}" placeholder="${h ? 'Ej.: 88' : 'Ej.: 1250'}" value="${S.real ?? ''}">
            <p class="ayuda">${h ? 'Huevos recogidos ayer ÷ aves vivas × 100.' : 'Pesa 1 de cada 20 aves y saca el promedio.'} Con este dato la proyección parte de lo que hoy produce tu lote.</p></div></div>`;
        }
      } else { rv.innerHTML = ''; delete rv.dataset.tipo; }
    }
    const btn = $('#btn-sig'); if (btn) btn.disabled = !loteValido();
  }

  /* ========================== 3 · MANEJO ========================== */
  function nivel(it) {
    const p = it.prod + 1.5 * it.mort;
    if (p >= 9) return ['alto', 'Impacto alto'];
    if (p >= 4) return ['medio', 'Impacto medio'];
    return ['bajo', 'Impacto bajo'];
  }
  function itemHTML(it, sel, extraTags = '', disabled = false, titulo = null) {
    const [c, l] = it.prod !== undefined ? nivel(it) : ['', ''];
    return `<label class="item"><input type="checkbox" data-sel="${it.id}" ${sel.has(it.id) && !disabled ? 'checked' : ''} ${disabled ? 'disabled' : ''}>
      <span><span class="item-t">${titulo || esc(it.n)}</span>${it.det ? `<span class="item-d">${esc(it.det)}</span>` : ''}
      <span class="item-tags">${it.clave ? '<span class="tag clave">Esencial</span>' : ''}${c ? `<span class="tag ${c}">${l}</span>` : ''}${extraTags}</span></span></label>`;
  }
  function pantManejo() {
    const st = estado(), M = construirManejo(st), sel = selSet();
    const F = factores(st, M, sel);
    const ph = M.fase;
    return `<section class="screen">
      <div class="intro"><span class="eyebrow">Paso 3 de 4</span><h1>Recomendaciones de manejo</h1>
        <p class="lead">${esc(st.g.nombre)} de ${edadTxt()} · <strong>${ph.n}</strong>. Marca lo que vas a aplicar: la proyección cambia con cada elección.</p></div>
      <div class="resumen-manejo">
        <div class="indice-row"><div><div class="eyebrow">Índice de manejo</div><div class="indice-num" id="indice">${F.indice} %</div></div>
          <button class="btn-sec" data-act="todo" id="btn-todo">${F.indice >= 100 ? 'Desmarcar todo' : 'Marcar lo recomendado'}</button></div>
        <div class="medidor ${F.indice >= 85 ? 'bueno' : F.indice < 50 ? 'malo' : ''}" id="medidor"><span style="width:${F.indice}%"></span></div>
        <div class="chips" role="navigation" aria-label="Secciones">${M.cats.map(c => `<button class="chip" data-act="ircat" data-v="${c.id}">${c.n}</button>`).join('')}</div>
      </div>
      ${M.cats.map(c => catHTML(c, st, sel)).join('')}
    </section>`;
  }
  function cuenta(c, sel, st) {
    if (c.sanidad) {
      const enf = ENFERMEDADES.find(e => e.id === st.enf);
      const lista = c.id === 'casero' ? (enf ? enf.caseros.filter(x => !x.solo || x.solo === st.modo) : PREVENTIVOS_CASEROS) : (enf ? enf.quimicos : []);
      if (!lista.length) return '';
      return `${lista.filter(x => sel.has(x.id)).length}/${lista.length}`;
    }
    return `${c.items.filter(x => sel.has(x.id)).length}/${c.items.length}`;
  }
  function catHTML(c, st, sel) {
    let body = '';
    if (c.filas) body += `<dl class="tabla">${c.filas.map(f => `<div><dt>${esc(f[0])}</dt><dd>${esc(f[1])}</dd></div>`).join('')}</dl>`;
    if (c.id === 'vac') {
      body += `<div class="items">${c.items.map(it => {
        const et = { pasada: ['pasada', 'Edad pasada: marca si se aplicó'], ahora: ['ahora', 'Toca esta semana'], proxima: ['proxima', 'Próxima'], vigente: ['vigente', 'En curso'] }[it.estado];
        return itemHTML(it, sel, `<span class="tag estado-${et[0]}">${et[1]}</span>`, false, `<span class="vac-edad">${it.repite ? 'Desde sem. 20' : edadCorta(it.edad)}</span> · ${esc(it.n)}`);
      }).join('')}</div>`;
    } else if (c.id === 'casero') {
      const enf = ENFERMEDADES.find(e => e.id === st.enf);
      body += `<div class="campo"><label for="enf">¿Hay algún problema sanitario en el lote?</label>
        <select id="enf" class="entrada"><option value="">Ninguno, el lote está sano</option>
        ${c.enfermedades.map(e => `<option value="${e.id}" ${st.enf === e.id ? 'selected' : ''}>${esc(e.n)}</option>`).join('')}</select></div>`;
      if (enf) {
        body += `<p class="signos"><strong>Signos:</strong> ${esc(enf.signos)}</p>`;
        if (enf.alerta) body += `<div class="aviso">${ic('aviso')}<span>${esc(enf.alerta)}</span></div>`;
        const cas = enf.caseros.filter(x => !x.solo || x.solo === st.modo);
        if (cas.length) body += `<div class="items">${cas.map(it => itemHTML(it, sel, `<span class="tag ev">${esc(it.ev)}</span>`)).join('')}</div>`;
        else body += `<p class="nota">No hay un remedio casero eficaz para este problema.</p>`;
        if (enf.nota) body += `<p class="nota">${esc(enf.nota)}</p>`;
      } else {
        body += `<p class="nota">Opcionales y de apoyo. No reemplazan las vacunas ni la bioseguridad.</p>
          <div class="items">${PREVENTIVOS_CASEROS.map(it => itemHTML(it, sel, `<span class="tag ev">${esc(it.ev)}</span>`)).join('')}</div>`;
      }
    } else if (c.id === 'quim') {
      const enf = ENFERMEDADES.find(e => e.id === st.enf);
      const enPostura = st.modo === 'huevos' && st.dias / 7 >= st.g.postura.w50 - 2;
      if (!enf) {
        body += `<div class="aviso suave">${ic('info')}<span>Sin un problema diagnosticado no se recomienda medicar. Los antibióticos preventivos crean resistencia y dejan residuos en huevos y carne. Si aparece un problema, elígelo en <strong>Remedios caseros</strong>.</span></div>`;
      } else if (!enf.quimicos.length) {
        body += enf.alerta ? `<div class="aviso">${ic('aviso')}<span>No existe tratamiento. ${esc(enf.alerta)}</span></div>` : `<p class="nota">No hay tratamiento químico eficaz. ${esc(enf.nota || '')}</p>`;
      } else {
        body += `<div class="aviso">${ic('aviso')}<span>Úsalos solo con diagnóstico y receta de un médico veterinario. Respeta el tiempo de retiro: no vendas ni consumas huevos o carne durante ese período. Dosis de referencia; confirma siempre en la etiqueta.</span></div>`;
        body += `<div class="items">${enf.quimicos.map(it => {
          const bloq = it.noPostura && enPostura;
          return itemHTML(it, sel, `${bloq ? '<span class="tag alto">No apto en postura</span>' : ''}<span class="tag ev">Retiro: ${esc(it.retiro)}</span>`, bloq);
        }).join('')}</div>`;
        if (enf.nota) body += `<p class="nota">${esc(enf.nota)}</p>`;
      }
    } else if (c.items && c.items.length) {
      body += `<div class="items">${c.items.map(it => itemHTML(it, sel)).join('')}</div>`;
    }
    if (c.notas) body += c.notas.map(n => `<p class="nota">${esc(n)}</p>`).join('');
    return `<section class="cat" id="cat-${c.id}">
      <div class="cat-head"><span class="cat-ico">${ic(c.icono)}</span><h2>${esc(c.n)}</h2><span class="cuenta" data-cuenta="${c.id}">${cuenta(c, sel, st)}</span></div>
      <div class="cat-body">${body}</div></section>`;
  }
  function vivoManejo() {
    const st = estado(), M = construirManejo(st), sel = selSet();
    const F = factores(st, M, sel);
    $('#indice').textContent = F.indice + ' %';
    const m = $('#medidor');
    m.className = 'medidor ' + (F.indice >= 85 ? 'bueno' : F.indice < 50 ? 'malo' : '');
    m.firstElementChild.style.width = F.indice + '%';
    $('#btn-todo').textContent = F.indice >= 100 ? 'Desmarcar todo' : 'Marcar lo recomendado';
    for (const c of M.cats) { const el = document.querySelector(`[data-cuenta="${c.id}"]`); if (el) el.textContent = cuenta(c, sel, st); }
  }
  function marcarTodo() {
    const st = estado(), M = construirManejo(st);
    const F = factores(st, M, selSet());
    if (F.indice >= 100) { S.sel = []; guardar(); render(true); return; }
    const s = selSet();
    for (const c of M.cats) if (c.items) for (const it of c.items) s.add(it.id);
    const enf = ENFERMEDADES.find(e => e.id === st.enf);
    if (enf) {
      enf.caseros.filter(x => /comprobad/i.test(x.ev) && (!x.solo || x.solo === st.modo)).forEach(x => s.add(x.id));
      const enPostura = st.modo === 'huevos' && st.dias / 7 >= st.g.postura.w50 - 2;
      const q = enf.quimicos.filter(x => !(x.noPostura && enPostura)).sort((a, b) => b.mit - a.mit)[0];
      if (q) s.add(q.id);
    }
    S.sel = [...s]; guardar(); render(true);
  }

  /* ======================== 4 · PROYECCIÓN ======================== */
  function grafico(st, r) {
    const W = 360, H = 214, m = { l: 40, r: 14, t: 18, b: 34 };
    const iw = W - m.l - m.r, ih = H - m.t - m.b;
    let x0, x1, y1, std = [], proj, hoy, xt = [], yt = [], fy, xlab;
    if (r.tipo === 'huevos') {
      const w0 = st.dias / 7, p = st.g.postura;
      x0 = w0 < 16 ? 0 : Math.max(16, Math.floor(w0) - 6); x1 = st.dFin / 7; y1 = 100;
      for (let w = x0; w <= x1 + 0.001; w += 0.5) std.push([w, hdStd(p, w)]);
      proj = r.serie.map(q => [q.w, q.hd]).filter(q => q[0] >= x0);
      hoy = w0; yt = [0, 25, 50, 75, 100]; fy = v => v + ' %'; xlab = 'Semanas de edad';
      for (let w = Math.ceil(x0 / 10) * 10; w <= x1; w += 10) xt.push(w);
    } else {
      const c = st.g.carne;
      x0 = 0; x1 = st.dFin;
      for (let d = 0; d <= x1; d++) std.push([d, pesoStd(c, d)]);
      proj = r.serie.map(q => [q.d, q.p]);
      const mx = Math.max(pesoStd(c, x1), r.pesoFin);
      const paso = mx > 2600 ? 1000 : 500;
      y1 = Math.ceil(mx / paso) * paso;
      for (let v = 0; v <= y1; v += paso) yt.push(v);
      fy = v => fmt(v / 1000, paso < 1000 ? 1 : 0) + ' kg'; xlab = 'Días de edad'; hoy = st.dias;
      const pd = x1 <= 63 ? 7 : 14;
      for (let d = 0; d <= x1; d += pd) xt.push(d);
    }
    const X = v => m.l + (v - x0) / Math.max(0.001, x1 - x0) * iw;
    const Y = v => m.t + ih - v / y1 * ih;
    const linea = pts => pts.map((q, i) => `${i ? 'L' : 'M'}${X(q[0]).toFixed(1)},${Y(q[1]).toFixed(1)}`).join('');
    const area = proj.length > 1 ? `${linea(proj)}L${X(proj[proj.length - 1][0]).toFixed(1)},${Y(0).toFixed(1)}L${X(proj[0][0]).toFixed(1)},${Y(0).toFixed(1)}Z` : '';
    const ult = proj[proj.length - 1];
    const hx = X(clamp(hoy, x0, x1));
    return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${r.tipo === 'huevos' ? 'Curva de postura por semana: estándar de la genética y proyección de tu lote' : 'Curva de peso por día: estándar de la genética y proyección de tu lote'}">
      ${yt.map(v => `<line class="grid-l" x1="${m.l}" x2="${W - m.r}" y1="${Y(v)}" y2="${Y(v)}"/><text class="ax" x="${m.l - 6}" y="${Y(v) + 3.5}" text-anchor="end">${fy(v)}</text>`).join('')}
      ${xt.map(v => `<text class="ax" x="${X(v)}" y="${H - m.b + 15}" text-anchor="middle">${v}</text>`).join('')}
      <text class="ax" x="${m.l + iw / 2}" y="${H - 4}" text-anchor="middle">${xlab}</text>
      <path class="a-proj" d="${area}"/>
      <path class="l-std" d="${linea(std)}"/>
      <path class="l-proj" d="${linea(proj)}"/>
      <line class="hoy-l" x1="${hx}" x2="${hx}" y1="${m.t - 4}" y2="${m.t + ih}"/>
      <text class="hoy-t" x="${Math.min(hx + 4, W - m.r - 22)}" y="${m.t + 4}">Hoy</text>
      ${ult ? `<circle class="punto" cx="${X(ult[0])}" cy="${Y(ult[1])}" r="4.5"/>` : ''}
    </svg>`;
  }

  function calcular() {
    const st = estado(), M = construirManejo(st), sel = selSet();
    const r = proyectar(st, M, sel);
    const Fstd = { f: 1, mortExtra: 0, shift: 0 };
    const stStd = Object.assign({}, st, { g: Object.assign({}, st.g, { campo: 1 }), real: null });
    const ref = st.modo === 'huevos' ? simHuevos(stStd, Fstd) : simCarne(stStd, Fstd);
    const br = brechas(st, M, sel, r);
    return { st, M, r, ref, br };
  }

  function pantProyeccion() {
    const { st, r, ref, br } = calcular();
    const h = r.tipo === 'huevos';
    const pct = h ? (ref.huevos ? 100 * r.huevos / ref.huevos : 0) : 100 * r.pesoFin / ref.pesoFin;
    const ops = opcionesFin();
    const unidadFin = h ? 'sem.' : 'días';
    let heroe, kpis = [];
    if (h) {
      heroe = `<span class="eyebrow">Huevos del lote hasta la semana ${Math.round(st.dFin / 7)}</span>
        <div class="heroe-num">${fmt(r.huevos)}<small>huevos</small></div>
        <div class="heroe-sub"><strong>${fmt(r.cubetas)}</strong> cubetas de 30 · ${fmt(r.huevosAve)} huevos por ave</div>`;
      if (r.hdHoy >= 5) kpis.push([fmt(r.hdHoy, 1), '%', 'Postura esperada esta semana']);
      else kpis.push([r.w50 ? 'Sem. ' + fmt(r.w50, 0) : '—', '', r.w50 ? 'Llega al 50 % de postura' : 'No llega al 50 % de postura']);
      kpis.push([fmt(r.pico, 1), '%', `Pico esperado (sem. ${fmt(r.wPico, 0)})`]);
      kpis.push([fmt(r.pesoHuevo, 1), 'g', 'Peso medio del huevo']);
      kpis.push([fmt(r.kgDocena, 2), 'kg', 'Alimento por docena de huevos']);
      kpis.push([fmt(r.conversion, 2), '', 'Conversión (kg alimento / kg huevo)']);
      kpis.push([fmt(r.vivasFin), 'aves', `Al final del ciclo (${fmt(r.viab, 1)} % viven)`]);
      kpis.push([fmt(r.alimento - r.alimRecria), 'kg', 'Alimento en postura (lote)']);
      if (r.alimRecria > 0) kpis.push([fmt(r.alimRecria), 'kg', 'Alimento de recría (lote)']);
      else kpis.push([fmt(r.masaKg), 'kg', 'Masa de huevo del lote']);
    } else {
      heroe = `<span class="eyebrow">Peso vivo por ave a los ${st.dFin} días</span>
        <div class="heroe-num">${fmt(r.pesoFin / 1000, 2)}<small>kg</small></div>
        <div class="heroe-sub"><strong>${fmt(r.kgVivo)}</strong> kg en pie · ${fmt(r.kgCanal)} kg de canal</div>`;
      kpis.push([fmt(r.caAcum, 2), '', 'Conversión acumulada']);
      kpis.push([fmt(r.vivasFin), 'aves', `Para la venta (${fmt(r.viab, 1)} % viven)`]);
      kpis.push([fmt(r.alimento), 'kg', 'Alimento desde hoy (lote)']);
      kpis.push([fmt(r.caPeriodo, 2), '', 'Conversión desde hoy']);
      if (esBroiler(st.g)) kpis.push([fmt(r.iep), '', 'Índice de eficiencia productiva (IEP)']);
      else kpis.push([fmt(st.g.carne.rend), '%', 'Rendimiento a canal']);
      kpis.push([fmt(r.pesoStdFin / 1000, 2), 'kg', 'Peso estándar de la genética']);
    }
    const F = r.F;
    const avisos = [];
    if (F.altPeso > 0.5) avisos.push(h ? `Altitud de ${fmt(st.alt)} m: la proyección descuenta ${fmt(F.altPeso, 1)} % de producción.` : `Altitud de ${fmt(st.alt)} m: la proyección descuenta ${fmt(F.altPeso, 1)} % del crecimiento${F.altMort > 0.1 ? ` y suma ${fmt(F.altMort, 1)} puntos de mortalidad por ascitis` : ''}.`);
    if (F.enf) avisos.push(`${F.enf.n}: ${F.mit > 0 ? `con el tratamiento elegido se recupera cerca del ${fmt(F.mit * 100)} % de la pérdida.` : 'sin tratamiento, la pérdida se aplica completa.'}`);
    if (st.real != null) avisos.push(h ? `La proyección parte de tu ${fmt(st.real, 1)} % de postura actual.` : `La proyección parte de tu peso actual de ${fmt(st.real)} g.`);
    const unidadGana = h ? 'huevos' : 'kg';
    return `<section class="screen">
      <div class="intro"><span class="eyebrow">Paso 4 de 4</span><h1>Proyección de ${h ? 'huevos' : 'carne'}</h1>
        <p class="lead">${esc(st.g.nombre)} · ${fmt(st.aves)} aves de ${edadTxt()} · ${fmt(st.alt)} msnm</p></div>
      <div class="campo"><span class="lbl" id="lbl-fin">${h ? 'Proyectar hasta la semana' : 'Edad de venta'}</span>
        <div class="chips" role="group" aria-labelledby="lbl-fin">${ops.map(o => `<button class="chip" data-act="fin" data-v="${o}" aria-pressed="${o === st.dFin}">${h ? 'Sem. ' + o / 7 : o + ' días'}</button>`).join('')}</div></div>
      <div class="heroe">${heroe}<span class="vs">${fmt(pct)} % del estándar de la genética</span></div>
      <div class="kpis">${kpis.map(k => `<div class="kpi"><span class="v">${k[0]}${k[1] ? `<small>${k[1]}</small>` : ''}</span><span class="l">${k[2]}</span></div>`).join('')}</div>
      <div class="grafico">${grafico(st, r)}
        <div class="leyenda"><span><i></i>Tu lote (proyección)</span><span><i class="std"></i>Estándar ${esc(st.g.nombre)}</span></div></div>
      <div class="bloque">
        <div class="indice-row"><div><div class="eyebrow">Índice de manejo</div><div class="indice-num">${F.indice} %</div></div>
          <button class="btn-sec" data-act="ir" data-r="manejo">Ajustar manejo</button></div>
        <div class="medidor ${F.indice >= 85 ? 'bueno' : F.indice < 50 ? 'malo' : ''}"><span style="width:${F.indice}%"></span></div>
        ${br.length ? `<h3>Lo que más sumaría a tu ${h ? 'producción' : 'lote'}</h3>
          <ul class="brechas">${br.slice(0, 5).map(b => `<li><span><span>${esc(b.n)}</span><br><span class="c">${esc(b.cat)}</span></span><span class="g">+${fmt(b.gana, h ? 0 : 0)} ${unidadGana}</span></li>`).join('')}</ul>`
          : `<p class="muted small">Aplicas todas las prácticas recomendadas para esta fase.</p>`}
      </div>
      ${avisos.length ? `<div class="aviso suave">${ic('info')}<span>${avisos.map(esc).join('<br>')}</span></div>` : ''}
      <div class="bloque">
        <div><h3>Ingresos y margen</h3><p class="ayuda">Escribe tus precios en dólares para ver el margen sobre el alimento.</p></div>
        <div class="eco">
          ${h ? `<div class="campo"><label for="p-cubeta">Precio de la cubeta de 30</label><input id="p-cubeta" class="entrada chica num" type="number" inputmode="decimal" step="0.01" min="0" placeholder="Ej.: 3,60" value="${esc(precios.cubeta)}"></div>`
              : `<div class="campo"><label for="p-kg">Precio del kg en pie</label><input id="p-kg" class="entrada chica num" type="number" inputmode="decimal" step="0.01" min="0" placeholder="Ej.: 1,90" value="${esc(precios.kgVivo)}"></div>`}
          <div class="campo"><label for="p-alim">Costo del kg de alimento</label><input id="p-alim" class="entrada chica num" type="number" inputmode="decimal" step="0.01" min="0" placeholder="Ej.: 0,62" value="${esc(precios.kgAlim)}"></div>
        </div>
        <div class="eco-res" id="eco-res">${ecoHTML(r)}</div>
        <p class="ayuda">No incluye compra de aves, mano de obra, energía ni medicamentos.</p>
      </div>
      <details class="metodo"><summary>¿Cómo se calcula?</summary>
        <ul>
          <li>La curva parte del estándar publicado: ${esc(st.g.fuente)}.</li>
          <li>Se aplica un ajuste de campo del ${fmt((st.g.campo || 1) * 100)} % por la diferencia entre las condiciones de prueba de la casa genética y una granja típica.</li>
          <li>Cada práctica que no marcas descuenta producción y suma mortalidad según su importancia. Son coeficientes de referencia de la literatura técnica, no mediciones de tu granja.</li>
          <li>La altitud reduce el crecimiento del pollo de engorde y desde los 2.000 m suma riesgo de ascitis.</li>
          <li>Si escribes un dato real (postura o peso de hoy), la proyección parte de él y en unas 4 semanas se acerca al nivel que permite el manejo elegido.</li>
          <li>Úsala para planificar y compárala cada semana con tus registros.</li>
        </ul></details>
    </section>`;
  }
  function ecoHTML(r) {
    const h = r.tipo === 'huevos';
    const pv = parseFloat(String(h ? precios.cubeta : precios.kgVivo).replace(',', '.'));
    const pa = parseFloat(String(precios.kgAlim).replace(',', '.'));
    const ing = isFinite(pv) ? (h ? r.cubetas * pv : r.kgVivo * pv) : NaN;
    const cos = isFinite(pa) ? r.alimento * pa : NaN;
    const mar = ing - cos;
    const usd = x => isFinite(x) ? '$ ' + fmt(x, 2) : '—';
    return `<div><span>Ingreso por ${h ? 'huevos' : 'venta en pie'}</span><span>${usd(ing)}</span></div>
      <div><span>Costo del alimento${h && r.alimRecria > 0 ? ' (con recría)' : ''}</span><span>${usd(cos)}</span></div>
      <div><span>Margen sobre alimento</span><span class="${isFinite(mar) ? (mar >= 0 ? 'pos' : 'neg') : ''}">${usd(mar)}</span></div>`;
  }

  function textoResumen() {
    const { st, r } = calcular();
    const h = r.tipo === 'huevos';
    const L = [`Appollo · ${st.g.nombre}`, `${fmt(st.aves)} aves de ${edadTxt()} · ${fmt(st.alt)} msnm`, `Fase: ${fase(st.g, st.modo, st.dias).n}`, `Índice de manejo: ${r.F.indice} %`];
    if (h) L.push(`Proyección a la semana ${Math.round(st.dFin / 7)}: ${fmt(r.huevos)} huevos (${fmt(r.cubetas)} cubetas de 30), ${fmt(r.huevosAve)} por ave`, `Peso medio del huevo: ${fmt(r.pesoHuevo, 1)} g · Alimento por docena: ${fmt(r.kgDocena, 2)} kg`);
    else L.push(`Proyección a ${st.dFin} días: ${fmt(r.pesoFin / 1000, 2)} kg por ave, ${fmt(r.kgVivo)} kg en pie`, `Conversión acumulada: ${fmt(r.caAcum, 2)} · Viabilidad: ${fmt(r.viab, 1)} %`);
    L.push(`Fecha: ${new Date().toLocaleDateString('es-EC')}`);
    return L.join('\n');
  }

  /* ======================== LOTES GUARDADOS ======================== */
  function pantLotes() {
    const lotes = LS.get(K_LOTES, []);
    return `<section class="screen">
      <div class="intro"><h1>Mis lotes</h1><p class="lead">Proyecciones guardadas en este teléfono. Ábrelas para actualizar la edad o el manejo.</p></div>
      ${lotes.length ? `<div class="lista">${lotes.map(l => `<article class="lote">
          <div class="gen-head"><span class="gen-nombre" style="font-size:1.12rem">${esc(l.nombre)}</span><span class="small muted">${esc(new Date(l.fecha).toLocaleDateString('es-EC'))}</span></div>
          <div class="small">${esc(l.resumen)}</div>
          <div class="lote-acc"><button class="btn-sec" data-act="abrir" data-id="${l.id}">Abrir</button><button class="btn-sec" data-act="borrar" data-id="${l.id}">Eliminar</button></div>
        </article>`).join('')}</div>`
        : `<div class="vacio">${huevo()}<strong>Aún no guardas ningún lote</strong><span class="small">Al terminar una proyección toca <em>Guardar lote</em> y aparecerá aquí.</span></div>`}
    </section>`;
  }

  const PANTALLAS = { genetica: pantGenetica, lote: pantLote, manejo: pantManejo, proyeccion: pantProyeccion, lotes: pantLotes };
  const BARRAS = {
    genetica: () => '',
    lote: () => `<button class="btn" id="btn-sig" data-act="ir" data-r="manejo" ${loteValido() ? '' : 'disabled'}>Ver recomendaciones ${ic('sig')}</button>`,
    manejo: () => `<button class="btn" data-act="ir" data-r="proyeccion">Ver proyección ${ic('sig')}</button>`,
    proyeccion: () => `<button class="btn borde" data-act="copiar">${ic('copiar')}Copiar</button><button class="btn" data-act="guardar">${ic('lotes')}Guardar lote</button>`,
    lotes: () => `<button class="btn oscuro" data-act="nuevo">Nueva consulta</button>`
  };

  /* ----------------------------- Acciones ----------------------------- */
  const ACC = {
    ir: t => ir(t.dataset.r),
    filtro: t => {
      S.filtro = t.dataset.v; guardar();
      document.querySelectorAll('[data-act="filtro"]').forEach(b => b.setAttribute('aria-pressed', b.dataset.v === S.filtro));
      $('#lista-gen').innerHTML = listaGen();
    },
    gen: t => {
      if (S.gid !== t.dataset.id) {
        const g = GENETICAS.find(x => x.id === t.dataset.id);
        Object.assign(S, { gid: g.id, obj: 'huevos', sel: [], enf: null, fin: null, real: null });
        if (modoDe(g, S.obj) === 'carne') Object.assign(S, { unidad: 'dias', edad: 1 });
        else Object.assign(S, { unidad: 'semanas', edad: 20 });
        guardar();
      }
      ir('lote');
    },
    obj: t => {
      if (S.obj === t.dataset.v) return;
      S.obj = t.dataset.v;
      Object.assign(S, { sel: [], enf: null, fin: null, real: null });
      Object.assign(S, S.obj === 'carne' ? { unidad: 'dias', edad: 1 } : { unidad: 'semanas', edad: 20 });
      guardar(); render(true);
    },
    unidad: t => {
      const u = t.dataset.v; if (u === S.unidad) return;
      const e = Number(S.edad);
      if (isFinite(e)) S.edad = u === 'dias' ? Math.round(e * 7) : Math.round(e / 7 * 10) / 10;
      S.unidad = u; guardar(); render(true);
    },
    preset: t => { S.edad = Number(t.dataset.v); S.unidad = t.dataset.u; S.fin = null; guardar(); render(true); },
    alt: t => { S.alt = Number(t.dataset.v); guardar(); render(true); },
    mas: t => paso(t.dataset.c, 1),
    menos: t => paso(t.dataset.c, -1),
    ircat: t => { const el = document.getElementById('cat-' + t.dataset.v); if (el) el.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' }); },
    todo: () => marcarTodo(),
    fin: t => { S.fin = Number(t.dataset.v); guardar(); render(true); },
    guardar: () => {
      const { st, r } = calcular();
      const lotes = LS.get(K_LOTES, []);
      const resumen = r.tipo === 'huevos' ? `${fmt(r.huevos)} huevos hasta la sem. ${Math.round(st.dFin / 7)} · índice de manejo ${r.F.indice} %` : `${fmt(r.pesoFin / 1000, 2)} kg por ave a los ${st.dFin} días · ${fmt(r.kgVivo)} kg en pie · índice ${r.F.indice} %`;
      const snap = { gid: S.gid, obj: S.obj, edad: S.edad, unidad: S.unidad, aves: S.aves, alt: S.alt, real: S.real, fin: S.fin, sel: S.sel.slice(), enf: S.enf };
      lotes.unshift({ id: String(Date.now()), fecha: new Date().toISOString(), nombre: `${st.g.nombre} · ${fmt(st.aves)} aves · ${edadTxt()}`, resumen, estado: snap });
      LS.set(K_LOTES, lotes.slice(0, 60));
      top.innerHTML = cabecera(ruta());
      toast('Lote guardado en Mis lotes');
    },
    copiar: async () => {
      const txt = textoResumen();
      try { await navigator.clipboard.writeText(txt); toast('Resumen copiado'); }
      catch (e) {
        let box = $('#copia');
        if (!box) { view.insertAdjacentHTML('beforeend', `<div class="bloque"><label for="copia" class="lbl">Selecciona y copia el resumen</label><textarea id="copia" class="copia" readonly></textarea></div>`); box = $('#copia'); }
        box.value = txt; box.scrollIntoView({ block: 'center' }); box.focus(); box.select();
      }
    },
    abrir: t => {
      const l = LS.get(K_LOTES, []).find(x => x.id === t.dataset.id); if (!l) return;
      Object.assign(S, BASE, { filtro: S.filtro }, l.estado); guardar(); ir('proyeccion');
    },
    borrar: t => {
      if (t.dataset.confirmar !== '1') { t.dataset.confirmar = '1'; t.textContent = 'Toca otra vez para eliminar'; return; }
      LS.set(K_LOTES, LS.get(K_LOTES, []).filter(x => x.id !== t.dataset.id));
      render(true); toast('Lote eliminado');
    },
    nuevo: () => { Object.assign(S, BASE, { aves: S.aves, alt: S.alt, filtro: S.filtro }); guardar(); ir('genetica'); }
  };
  function paso(campo, signo) {
    if (campo === 'edad') {
      const e = Number(S.edad) || 0;
      S.edad = Math.max(0, Math.round((e + signo) * 10) / 10);
      $('#edad').value = S.edad;
    } else {
      const a = Number(S.aves) || 0;
      const p = a >= 100 ? 10 : a >= 20 ? 5 : 1;
      S.aves = Math.max(1, a + signo * p);
      $('#aves').value = S.aves;
    }
    S.fin = null; guardar(); vivoLote();
  }

  document.addEventListener('click', e => {
    const t = e.target.closest('[data-act]');
    if (!t || t.disabled) return;
    ACC[t.dataset.act] && ACC[t.dataset.act](t, e);
  });
  document.addEventListener('input', e => {
    const t = e.target;
    if (t.id === 'edad') { S.edad = t.value === '' ? null : Number(t.value); S.fin = null; guardar(); vivoLote(); }
    else if (t.id === 'aves') { S.aves = t.value === '' ? NaN : Math.round(Number(t.value)); guardar(); vivoLote(); }
    else if (t.id === 'alt') {
      S.alt = Math.max(0, Math.min(4500, Number(t.value) || 0)); guardar(); vivoLote();
      document.querySelectorAll('[data-act="alt"]').forEach(b => b.setAttribute('aria-pressed', Number(b.dataset.v) === S.alt));
    }
    else if (t.id === 'real') { S.real = t.value === '' ? null : Number(t.value); guardar(); }
    else if (t.id === 'p-cubeta' || t.id === 'p-kg' || t.id === 'p-alim') {
      if (t.id === 'p-cubeta') precios.cubeta = t.value; else if (t.id === 'p-kg') precios.kgVivo = t.value; else precios.kgAlim = t.value;
      LS.set(K_PRECIOS, precios);
      const { r } = calcular(); $('#eco-res').innerHTML = ecoHTML(r);
    }
  });
  document.addEventListener('change', e => {
    const t = e.target;
    if (t.matches('input[data-sel]')) {
      const s = selSet(); if (t.checked) s.add(t.dataset.sel); else s.delete(t.dataset.sel);
      S.sel = [...s]; guardar(); vivoManejo();
    } else if (t.id === 'enf') { S.enf = t.value || null; guardar(); render(true); }
  });

  render();
})();
