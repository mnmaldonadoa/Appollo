/* =========================================================================
   APPOLLO · Planificar, paso 4: proyección.
   Cifras de proyectar() con los mismos textos y redondeos del original, gráfico del
   estándar contra la proyección, "lo que más sumaría" (brechas), ingresos y margen con
   los precios de appollo.v1.precios, copiar el resumen y "Crear lote con este plan".
   ========================================================================= */
var ACCIONES = window.ACCIONES || (window.ACCIONES = {});

const PlanProyeccion = (function () {
  'use strict';
  const P = PlanEstado;
  const $v = s => document.querySelector('#view ' + s);

  /* Serie para Grafico: estándar desde el inicio del eje y proyección desde hoy (mismo eje que el original). */
  function grafico(st, r) {
    const est = [], real = [], et = [];
    if (r.tipo === 'huevos') {
      const w0 = st.dias / 7, p = st.g.postura;
      const x0 = w0 < 16 ? 0 : Math.max(16, Math.floor(w0) - 6);
      for (let w = x0; w < w0; w++) { est.push(hdStd(p, w)); real.push(null); et.push('Sem. ' + fmt(w)); }
      for (const q of r.serie) { est.push(hdStd(p, q.w)); real.push(q.hd); et.push('Sem. ' + fmt(q.w, q.w % 1 ? 1 : 0)); }
    } else {
      const c = st.g.carne, desde = {};
      for (const q of r.serie) desde[q.d] = q.p;
      for (let d = 0; d <= st.dFin; d++) { est.push(pesoStd(c, d) / 1000); real.push(d in desde ? desde[d] / 1000 : null); et.push('Día ' + d); }
    }
    const titulo = r.tipo === 'huevos' ? '% de postura por semana' : 'Peso por ave (kg) por día';
    return `<article class="tarjeta plan-grafico"><header class="tarjeta-cab"><h2 class="tarjeta-titulo">${titulo}</h2></header>${
      Grafico({ serieReal: real, serieEstandar: est, etiquetas: et, leyendaReal: 'Tu lote (proyección)', leyendaEstandar: 'Estándar ' + st.g.nombre })}</article>`;
  }

  function ecoHTML(r) {
    const precios = P.precios, h = r.tipo === 'huevos';
    const pv = parseFloat(String(h ? precios.cubeta : precios.kgVivo).replace(',', '.'));
    const pa = parseFloat(String(precios.kgAlim).replace(',', '.'));
    const ing = isFinite(pv) ? (h ? r.cubetas * pv : r.kgVivo * pv) : NaN;
    const cos = isFinite(pa) ? r.alimento * pa : NaN;
    const mar = ing - cos;
    const usd = x => isFinite(x) ? '$ ' + fmt(x, 2) : '—';
    return `<div><span>Ingreso por ${h ? 'huevos' : 'venta en pie'}</span><span class="num">${usd(ing)}</span></div>
      <div><span>Costo del alimento${h && r.alimRecria > 0 ? ' (con recría)' : ''}</span><span class="num">${usd(cos)}</span></div>
      <div class="plan-eco-total"><span>Margen sobre alimento</span><span class="num${isFinite(mar) ? (mar >= 0 ? ' plan-pos' : ' plan-neg') : ''}">${usd(mar)}</span></div>`;
  }

  function html() {
    const { st, r, ref, br } = P.calcular();
    const h = r.tipo === 'huevos';
    const pct = h ? (ref.huevos ? 100 * r.huevos / ref.huevos : 0) : 100 * r.pesoFin / ref.pesoFin;
    const ops = P.opcionesFin();
    let heroe;
    const kpis = [];
    if (h) {
      heroe = `<p class="eyebrow plan-heroe-titulo">Huevos del lote hasta la semana ${Math.round(st.dFin / 7)}</p>
        <p class="plan-heroe-num num">${fmt(r.huevos)}<small>huevos</small></p>
        <p class="plan-heroe-sub"><b>${fmt(r.cubetas)}</b> cubetas de 30 · ${fmt(r.huevosAve)} huevos por ave</p>`;
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
      heroe = `<p class="eyebrow plan-heroe-titulo">Peso vivo por ave a los ${st.dFin} días</p>
        <p class="plan-heroe-num num">${fmt(r.pesoFin / 1000, 2)}<small>kg</small></p>
        <p class="plan-heroe-sub"><b>${fmt(r.kgVivo)}</b> kg en pie · ${fmt(r.kgCanal)} kg de canal</p>`;
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
    const ind = F.indice;
    const precio = (id, etiqueta, valor, ej) => `<div class="reg-campo"><label class="reg-etiqueta" for="${id}">${etiqueta}</label>
      <input class="reg-texto num" id="${id}" type="number" inputmode="decimal" step="0.01" min="0" placeholder="${ej}" value="${esc(valor)}"></div>`;
    return `<h1>Proyección de ${h ? 'huevos' : 'carne'}</h1>
  <p class="pantalla-texto plan-lead">${esc(st.g.nombre)} · ${fmt(st.aves)} aves de ${esc(P.edadTxt())} · ${fmt(st.alt)} msnm</p>
  <div class="reg-campo"><p class="reg-etiqueta" id="plan-lbl-fin">${h ? 'Proyectar hasta la semana' : 'Edad de venta'}</p>
    <div class="nl-presets" role="group" aria-labelledby="plan-lbl-fin">${ops.map(o =>
      `<button type="button" class="segmento-btn" data-accion="plan-fin" data-v="${o}" aria-pressed="${o === st.dFin}">${h ? 'Sem. ' + o / 7 : o + ' días'}</button>`).join('')}</div></div>
  <article class="tarjeta tarjeta-verde plan-heroe">${heroe}<p class="plan-vs">${fmt(pct)} % del estándar de la genética</p></article>
  <div class="plan-kpis">${kpis.map(k => `<div class="plan-kpi"><span class="plan-kpi-v num">${esc(k[0])}${k[1] ? `<small>${esc(k[1])}</small>` : ''}</span><span class="plan-kpi-l">${esc(k[2])}</span></div>`).join('')}</div>
  ${grafico(st, r)}
  <article class="tarjeta plan-mejoras">
    <div class="plan-indice-fila"><div><p class="eyebrow">Índice de manejo</p><p class="plan-indice-num num plan-indice-proy">${ind} %</p></div>
      ${Boton({ texto: 'Ajustar manejo', variante: 'secundario', accion: 'plan-ir', datos: { paso: 'manejo' } })}</div>
    <div class="plan-medidor${ind >= 85 ? ' plan-medidor-bueno' : ind < 50 ? ' plan-medidor-malo' : ''}" aria-hidden="true"><span style="width:${ind}%"></span></div>
    ${br.length ? `<h2 class="plan-sub">Lo que más sumaría a tu ${h ? 'producción' : 'lote'}</h2>
      <ul class="plan-brechas">${br.slice(0, 5).map(b => `<li><span class="plan-brecha-texto"><span class="plan-brecha-n">${esc(b.n)}</span><span class="plan-brecha-c">${esc(b.cat)}</span></span><span class="plan-brecha-g num">+${fmt(b.gana, 0)} ${unidadGana}</span></li>`).join('')}</ul>`
      : `<p class="reg-ayuda">Aplicas todas las prácticas recomendadas para esta fase.</p>`}
  </article>
  ${avisos.length ? `<div class="plan-aviso plan-aviso-suave">${icono('info')}<span>${avisos.map(esc).join('<br>')}</span></div>` : ''}
  <article class="tarjeta plan-precios">
    <header class="tarjeta-cab"><h2 class="tarjeta-titulo">Ingresos y margen</h2></header>
    <p class="reg-ayuda">Escribe tus precios en dólares para ver el margen sobre el alimento.</p>
    ${h ? precio('plan-p-cubeta', 'Precio de la cubeta de 30', P.precios.cubeta, 'Ej.: 3,60') : precio('plan-p-kg', 'Precio del kg en pie', P.precios.kgVivo, 'Ej.: 1,90')}
    ${precio('plan-p-alim', 'Costo del kg de alimento', P.precios.kgAlim, 'Ej.: 0,62')}
    <div class="plan-eco" id="plan-eco">${ecoHTML(r)}</div>
    <p class="reg-ayuda">No incluye compra de aves, mano de obra, energía ni medicamentos.</p>
  </article>
  <details class="plan-metodo"><summary>¿Cómo se calcula?</summary>
    <ul>
      <li>La curva parte del estándar publicado: ${esc(st.g.fuente)}.</li>
      <li>Se aplica un ajuste de campo del ${fmt((st.g.campo || 1) * 100)} % por la diferencia entre las condiciones de prueba de la casa genética y una granja típica.</li>
      <li>Cada práctica que no marcas descuenta producción y suma mortalidad según su importancia. Son coeficientes de referencia de la literatura técnica, no mediciones de tu granja.</li>
      <li>La altitud reduce el crecimiento del pollo de engorde y desde los 2.000 m suma riesgo de ascitis.</li>
      <li>Si escribes un dato real (postura o peso de hoy), la proyección parte de él y en unas 4 semanas se acerca al nivel que permite el manejo elegido.</li>
      <li>Úsala para planificar y compárala cada semana con tus registros.</li>
    </ul></details>
  <div class="rep-acciones plan-acciones plan-final">
    ${Boton({ texto: 'Copiar resumen', icono: 'copiar', variante: 'secundario', accion: 'plan-copiar', clase: 'btn-ancho' })}
    <div class="rep-copia plan-copia" hidden><label class="reg-etiqueta" for="plan-copia-texto">Selecciona y copia el resumen</label><textarea class="reg-texto rep-texto" id="plan-copia-texto" rows="7" readonly></textarea></div>
    ${Boton({ texto: 'Crear lote con este plan', icono: 'mas', variante: 'primario', accion: 'plan-crear-lote', clase: 'btn-ancho btn-grande' })}
    ${Boton({ texto: 'Atrás', icono: 'atras', variante: 'secundario', accion: 'plan-ir', datos: { paso: 'manejo' }, clase: 'btn-ancho' })}
  </div>`;
  }

  function montar(raiz) {
    raiz.addEventListener('input', e => {
      const t = e.target, k = { 'plan-p-cubeta': 'cubeta', 'plan-p-kg': 'kgVivo', 'plan-p-alim': 'kgAlim' }[t.id];
      if (!k) return;
      P.precios[k] = t.value; P.guardarPrecios();
      const { r } = P.calcular(); $v('#plan-eco').innerHTML = ecoHTML(r);
    });
  }

  /* Portapapeles; si falla, textarea oculto + execCommand; si tampoco, caja visible para copiar a mano. */
  async function copiar(texto) {
    try { await navigator.clipboard.writeText(texto); return true; } catch (e) { /* respaldo */ }
    const ta = document.createElement('textarea');
    ta.value = texto; ta.setAttribute('readonly', ''); ta.style.cssText = 'position:fixed;top:0;left:0;opacity:0;';
    document.body.appendChild(ta);
    let ok = false;
    try { ta.focus(); ta.select(); ok = document.execCommand('copy'); } catch (e) { ok = false; }
    ta.remove();
    return ok;
  }

  ACCIONES['plan-fin'] = el => { P.S.fin = Number(el.dataset.v); P.guardar(); App.refrescar(); };
  ACCIONES['plan-copiar'] = async () => {
    if (!P.loteValido()) return;
    const txt = P.textoResumen();
    if (await copiar(txt)) { App.toast('Resumen copiado'); return; }
    const caja = $v('.plan-copia'), ta = $v('#plan-copia-texto');
    if (!caja || !ta) return;
    caja.hidden = false; ta.value = txt;
    ta.scrollIntoView({ block: 'center' }); ta.focus(); ta.select();
    App.toast('Copia el texto de la caja');
  };
  ACCIONES['plan-crear-lote'] = () => {
    const d = P.datosLote();
    if (!d) { App.ir('#/plan/lote'); return; }
    App.estado.prefillLote = d;
    App.ir('#/nuevo-lote');
  };

  return { html, montar };
})();
