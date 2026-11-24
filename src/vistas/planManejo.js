/* =========================================================================
   APPOLLO · Planificar, paso 3: recomendaciones de manejo.
   Categorías de construirManejo(st), índice de manejo de factores(), marcar todo,
   selector de problema sanitario con remedios caseros y control químico (tiempo de retiro;
   los tratamientos no aptos en postura quedan bloqueados). Misma lógica que el original.
   ========================================================================= */
var ACCIONES = window.ACCIONES || (window.ACCIONES = {});

const PlanManejo = (function () {
  'use strict';
  const P = PlanEstado;
  const $v = s => document.querySelector('#view ' + s);

  function nivel(it) {
    const p = it.prod + 1.5 * it.mort;
    if (p >= 9) return ['alto', 'Impacto alto'];
    if (p >= 4) return ['medio', 'Impacto medio'];
    return ['bajo', 'Impacto bajo'];
  }
  const tag = (clase, texto) => `<span class="plan-tag plan-tag-${clase}">${esc(texto)}</span>`;
  /* `titulo` llega ya escapado (lo arma catHTML). */
  function itemHTML(it, sel, extra = '', bloqueado = false, titulo = null) {
    const [c, l] = it.prod !== undefined ? nivel(it) : ['', ''];
    return `<label class="plan-item${bloqueado ? ' plan-item-bloqueado' : ''}"><input type="checkbox" data-sel="${esc(it.id)}" ${sel.has(it.id) && !bloqueado ? 'checked' : ''} ${bloqueado ? 'disabled' : ''}>
      <span class="plan-caja" aria-hidden="true"></span>${tieneIlustracion('itemRecomendacion', it.id) ? Ilustracion(ilustracionDe('itemRecomendacion', it.id), { tamano: 'mini' }) : ''}
      <span class="plan-item-texto"><span class="plan-item-t">${titulo || esc(it.n)}</span>${it.det ? `<span class="plan-item-d">${esc(it.det)}</span>` : ''}
      <span class="plan-tags">${it.clave ? tag('clave', 'Esencial') : ''}${c ? tag(c, l) : ''}${extra}</span></span></label>`;
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
  const aviso = (texto, suave) => `<div class="plan-aviso${suave ? ' plan-aviso-suave' : ''}">${icono(suave ? 'info' : 'aviso')}<span>${texto}</span></div>`;
  const nota = t => `<p class="reg-ayuda">${esc(t)}</p>`;

  function catHTML(c, st, sel) {
    let body = '';
    if (c.filas) body += `<dl class="plan-tabla">${c.filas.map(f => `<div><dt>${esc(f[0])}</dt><dd>${esc(f[1])}</dd></div>`).join('')}</dl>`;
    if (c.id === 'vac') {
      body += `<div class="plan-items">${c.items.map(it => {
        const et = { pasada: ['pasada', 'Edad pasada: marca si se aplicó'], ahora: ['ahora', 'Toca esta semana'], proxima: ['proxima', 'Próxima'], vigente: ['vigente', 'En curso'] }[it.estado] || ['proxima', ''];
        return itemHTML(it, sel, et[1] ? tag('estado-' + et[0], et[1]) : '', false, `<span class="plan-vac-edad">${esc(it.repite ? 'Desde sem. 20' : P.edadCorta(it.edad))}</span> · ${esc(it.n)}`);
      }).join('')}</div>`;
    } else if (c.id === 'casero') {
      const enf = ENFERMEDADES.find(e => e.id === st.enf);
      body += `<div class="reg-campo"><label class="reg-etiqueta" for="plan-enf">¿Hay algún problema sanitario en el lote?</label>
        <select id="plan-enf" class="reg-select"><option value="">Ninguno, el lote está sano</option>
        ${c.enfermedades.map(e => `<option value="${esc(e.id)}" ${st.enf === e.id ? 'selected' : ''}>${esc(e.n)}</option>`).join('')}</select></div>`;
      if (enf) {
        body += `<p class="plan-signos"><b>Signos:</b> ${esc(enf.signos)}</p>`;
        if (enf.alerta) body += aviso(esc(enf.alerta));
        const cas = enf.caseros.filter(x => !x.solo || x.solo === st.modo);
        if (cas.length) body += `<div class="plan-items">${cas.map(it => itemHTML(it, sel, tag('ev', it.ev))).join('')}</div>`;
        else body += nota('No hay un remedio casero eficaz para este problema.');
        if (enf.nota) body += nota(enf.nota);
      } else {
        body += nota('Opcionales y de apoyo. No reemplazan las vacunas ni la bioseguridad.') +
          `<div class="plan-items">${PREVENTIVOS_CASEROS.map(it => itemHTML(it, sel, tag('ev', it.ev))).join('')}</div>`;
      }
    } else if (c.id === 'quim') {
      const enf = ENFERMEDADES.find(e => e.id === st.enf);
      const enPostura = P.enPostura(st);
      if (!enf) {
        body += aviso('Sin un problema diagnosticado no se recomienda medicar. Los antibióticos preventivos crean resistencia y dejan residuos en huevos y carne. Si aparece un problema, elígelo en <b>Remedios caseros</b>.', true);
      } else if (!enf.quimicos.length) {
        body += enf.alerta ? aviso(`No existe tratamiento. ${esc(enf.alerta)}`) : nota(`No hay tratamiento químico eficaz. ${enf.nota || ''}`);
      } else {
        body += aviso('Úsalos solo con diagnóstico y receta de un médico veterinario. Respeta el tiempo de retiro: no vendas ni consumas huevos o carne durante ese período. Dosis de referencia; confirma siempre en la etiqueta.');
        body += `<div class="plan-items">${enf.quimicos.map(it => {
          const bloq = it.noPostura && enPostura;
          return itemHTML(it, sel, `${bloq ? tag('alto', 'No apto en postura') : ''}${tag('ev', 'Retiro: ' + it.retiro)}`, bloq);
        }).join('')}</div>`;
        if (enf.nota) body += nota(enf.nota);
      }
    } else if (c.items && c.items.length) {
      body += `<div class="plan-items">${c.items.map(it => itemHTML(it, sel)).join('')}</div>`;
    }
    if (c.notas) body += c.notas.map(nota).join('');
    const n = cuenta(c, sel, st);
    return `<section class="tarjeta plan-cat" id="cat-${esc(c.id)}">
      <header class="tarjeta-cab"><span class="tarjeta-il">${Ilustracion(ilustracionDe('recomendacion', c.id), { tamano: 'media' })}</span><h2 class="tarjeta-titulo plan-cat-titulo">${esc(c.n)}</h2><span class="plan-cuenta num" data-cuenta="${esc(c.id)}">${n}</span></header>
      <div class="plan-cat-cuerpo">${body}</div></section>`;
  }

  const medidor = ind => `<div class="plan-medidor${ind >= 85 ? ' plan-medidor-bueno' : ind < 50 ? ' plan-medidor-malo' : ''}" aria-hidden="true"><span style="width:${ind}%"></span></div>`;

  function html() {
    const st = P.estado(), M = construirManejo(st), sel = P.selSet();
    const F = factores(st, M, sel);
    return `<h1>Recomendaciones de manejo</h1>
  <p class="pantalla-texto">${esc(st.g.nombre)} de ${esc(P.edadTxt())} · <b>${esc(M.fase.n)}</b>. Marca lo que vas a aplicar: la proyección cambia con cada elección.</p>
  <div class="tarjeta plan-resumen">
    <div class="plan-indice-fila"><div><p class="eyebrow">Índice de manejo</p><p class="plan-indice-num num" id="plan-indice">${F.indice} %</p></div>
      ${Boton({ texto: F.indice >= 100 ? 'Desmarcar todo' : 'Marcar lo recomendado', variante: 'secundario', accion: 'plan-todo' })}</div>
    ${medidor(F.indice)}
  </div>
  <nav class="plan-saltos" aria-label="Secciones">${M.cats.map(c => `<button type="button" class="selector-btn" data-accion="plan-cat" data-v="${esc(c.id)}">${esc(c.n)}</button>`).join('')}</nav>
  ${M.cats.map(c => catHTML(c, st, sel)).join('')}
  <div class="reg-acciones plan-acciones">${Boton({ texto: 'Atrás', icono: 'atras', variante: 'secundario', accion: 'plan-ir', datos: { paso: 'lote' } })}${
    Boton({ texto: 'Ver proyección', icono: 'sig', variante: 'primario', accion: 'plan-ir', datos: { paso: 'proyeccion' } })}</div>`;
  }

  /* Al marcar o desmarcar: índice, medidor, botón y cuentas sin volver a dibujar (como vivoManejo). */
  function vivo() {
    const st = P.estado(), M = construirManejo(st), sel = P.selSet();
    const F = factores(st, M, sel);
    $v('#plan-indice').textContent = F.indice + ' %';
    const m = $v('.plan-resumen .plan-medidor');
    if (m) m.outerHTML = medidor(F.indice);
    const b = $v('[data-accion="plan-todo"] .btn-texto');
    if (b) b.textContent = F.indice >= 100 ? 'Desmarcar todo' : 'Marcar lo recomendado';
    for (const c of M.cats) { const el = $v(`[data-cuenta="${c.id}"]`); if (el) el.textContent = cuenta(c, sel, st); }
  }

  function montar(raiz) {
    raiz.addEventListener('change', e => {
      const t = e.target;
      if (t.matches('input[data-sel]')) { if (t.disabled) return; P.marcar(t.dataset.sel, t.checked); vivo(); }
      else if (t.id === 'plan-enf') { P.S.enf = t.value || null; P.guardar(); P.refrescar(t); }
    });
  }

  ACCIONES['plan-todo'] = el => { P.marcarTodo(); P.refrescar(el); };
  ACCIONES['plan-cat'] = el => {
    const c = document.getElementById('cat-' + el.dataset.v);
    if (c) c.scrollIntoView({ behavior: reducirMovimiento() ? 'auto' : 'smooth', block: 'start' });
  };

  return { html, montar };
})();
