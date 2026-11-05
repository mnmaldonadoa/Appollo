/* =========================================================================
   APPOLLO · Planificar (#/plan/genetica|lote|manejo|proyeccion).
   Enrutador de pasos, encabezado (Atrás + indicador de 4 pasos) y los pasos
   1 · Genética y 2 · Lote. Manejo y Proyección viven en planManejo.js y planProyeccion.js;
   el estado y las reglas, en planEstado.js (copiados del planificador original).
   ========================================================================= */
var VISTAS = window.VISTAS || (window.VISTAS = {});
var ACCIONES = window.ACCIONES || (window.ACCIONES = {});

(function () {
  'use strict';
  const P = PlanEstado, S = P.S;
  const NOMBRES = { genetica: 'Genética', lote: 'Lote', manejo: 'Manejo', proyeccion: 'Proyección' };
  const ATRAS = { lote: 'genetica', manejo: 'lote', proyeccion: 'manejo' };
  const $v = s => document.querySelector('#view ' + s);
  const apagado = (html, off) => (off ? html.replace('<button ', '<button disabled ') : html);

  /* ------------------------------ Encabezado ------------------------------ */
  function cabecera(paso) {
    const i = P.PASOS.indexOf(paso);
    const puede = k => k === 'genetica' || (k === 'lote' && P.gen()) || ((k === 'manejo' || k === 'proyeccion') && P.loteValido());
    const volver = ATRAS[paso]
      ? Boton({ texto: 'Atrás', icono: 'atras', variante: 'secundario', accion: 'plan-ir', datos: { paso: ATRAS[paso] }, clase: 'plan-volver' })
      : Boton({ texto: 'Atrás', icono: 'atras', variante: 'secundario', accion: 'ir', datos: { ruta: '#/mas' }, clase: 'plan-volver' });
    return `<div class="plan-cab">${volver}<p class="eyebrow">Planificar · Paso ${i + 1} de 4</p></div>
  <ol class="plan-pasos" aria-label="Pasos">${P.PASOS.map((k, j) => `<li class="plan-paso${j < i ? ' plan-paso-hecho' : ''}"${j === i ? ' aria-current="step"' : ''}>
    <button type="button" data-accion="plan-ir" data-paso="${k}"${puede(k) ? '' : ' disabled'}><span class="paso-barra" aria-hidden="true"></span><span class="plan-paso-nombre">${NOMBRES[k]}</span></button></li>`).join('')}</ol>`;
  }

  /* ============================ 1 · GENÉTICA ============================ */
  const FILTROS = [['todas', 'Todas'], ['postura', 'Postura'], ['carne', 'Carne'], ['doble', 'Doble propósito'], ['criolla', 'Criolla']];
  function listaGen() {
    return GENETICAS.filter(g => S.filtro === 'todas' || g.tipo === S.filtro).map(g => `
    <button type="button" class="gen-opcion plan-gen" data-accion="plan-genetica" data-id="${esc(g.id)}" aria-pressed="${S.gid === g.id}">
      <span class="gen-cab"><b class="gen-nombre">${esc(g.nombre)}</b><span class="gen-tipo gen-tipo-${esc(g.tipo)}">${esc(TIPOS[g.tipo].corto)}</span></span>
      <span class="gen-desc">${esc(g.desc)}</span>
      <span class="plan-datos">${g.datos.map(d => `<span><span class="plan-dt">${esc(d[0])}</span><b class="num">${esc(d[1])}</b></span>`).join('')}</span>
      <span class="gen-desc">${esc(g.rasgo)} · ${esc(g.origen)}</span>
    </button>`).join('');
  }
  function pasoGenetica() {
    return `<h1>¿Qué gallinas vas a manejar?</h1>
  <p class="pantalla-texto">Elige la genética. Cada línea tiene su propio estándar de producción y sus recomendaciones.</p>
  <div class="segmento" role="group" aria-label="Filtrar por tipo">${FILTROS.map(f =>
    `<button type="button" class="segmento-btn" data-accion="plan-filtro" data-v="${f[0]}" aria-pressed="${S.filtro === f[0]}">${f[1]}</button>`).join('')}</div>
  <div class="gen-lista">${listaGen()}</div>`;
  }

  /* ============================== 2 · LOTE ============================== */
  function presetsEdad() {
    const g = P.gen();
    if (P.modo() === 'huevos') return [[1, 'dias', '1 día'], [4, 'semanas', '4 sem'], [10, 'semanas', '10 sem'], [17, 'semanas', '17 sem'], [25, 'semanas', '25 sem'], [40, 'semanas', '40 sem'], [60, 'semanas', '60 sem']];
    if (esBroiler(g)) return [1, 7, 14, 21, 28, 35].map(d => [d, 'dias', d === 1 ? '1 día' : `${d} días`]);
    if (g.id === 'campero') return [1, 14, 28, 42, 56].map(d => [d, 'dias', d === 1 ? '1 día' : `${d} días`]);
    return [[1, 'dias', '1 día'], [4, 'semanas', '4 sem'], [8, 'semanas', '8 sem'], [12, 'semanas', '12 sem'], [16, 'semanas', '16 sem']];
  }
  const pasador = (c, valor, etiqueta, modoTeclado) => `<div class="contador">
    <button type="button" class="contador-btn contador-menos" data-accion="plan-menos" data-c="${c}" aria-label="Restar"><span aria-hidden="true">−</span></button>
    <input class="contador-valor num" id="plan-${c}" type="number" inputmode="${modoTeclado}" min="${c === 'edad' ? 0 : 1}" step="any" value="${esc(valor)}" aria-label="${etiqueta}" aria-describedby="plan-err-${c}">
    <button type="button" class="contador-btn contador-mas" data-accion="plan-mas" data-c="${c}" aria-label="Sumar"><span aria-hidden="true">+</span></button></div>`;
  function pasoLote() {
    const g = P.gen(), dual = g.tipo === 'doble' || g.tipo === 'criolla';
    const alts = [[100, 'Costa'], [400, 'Amazonía'], [1800, 'Valle'], [2800, 'Sierra']];
    const seg = (accion, actual, ops, etiqueta) => `<div class="segmento" role="group" aria-label="${etiqueta}">${ops.map(([v, t]) =>
      `<button type="button" class="segmento-btn" data-accion="${accion}" data-v="${v}" aria-pressed="${actual === v}">${t}</button>`).join('')}</div>`;
    return `<h1>Datos del lote</h1>
  <p class="pantalla-texto">Con la edad, el número de aves y la altitud se ajustan las recomendaciones y la proyección.</p>
  <div class="plan-elegida"><div><b class="gen-nombre">${esc(g.nombre)}</b><p class="gen-desc">${esc(g.rasgo)} · ${esc(TIPOS[g.tipo].nombre)}</p></div>
    ${Boton({ texto: 'Cambiar', variante: 'secundario', accion: 'plan-ir', datos: { paso: 'genetica' } })}</div>
  ${dual ? `<div class="reg-campo"><p class="reg-etiqueta">¿Para qué las crías?</p>${seg('plan-obj', S.obj, [['huevos', 'Huevos'], ['carne', 'Carne']], '¿Para qué las crías?')}</div>` : ''}
  <div class="reg-campo"><label class="reg-etiqueta" for="plan-edad">Edad de las aves</label>
    ${seg('plan-unidad', S.unidad, [['dias', 'Días'], ['semanas', 'Semanas']], 'Unidad de edad')}
    ${pasador('edad', S.edad === null || S.edad === undefined ? '' : S.edad, 'Edad de las aves', 'decimal')}
    <div class="nl-presets" role="group" aria-label="Edades frecuentes">${presetsEdad().map(p =>
      `<button type="button" class="segmento-btn" data-accion="plan-preset" data-v="${p[0]}" data-u="${p[1]}">${p[2]}</button>`).join('')}</div>
    <div id="plan-fase-vivo"></div>
    <p class="reg-error plan-error" id="plan-err-edad" role="alert"></p></div>
  <div class="reg-campo"><label class="reg-etiqueta" for="plan-aves">Número de aves vivas</label>
    ${pasador('aves', Number.isFinite(S.aves) ? S.aves : '', 'Número de aves vivas', 'numeric')}
    <p class="reg-error plan-error" id="plan-err-aves" role="alert"></p></div>
  <div class="reg-campo"><label class="reg-etiqueta" for="plan-alt">Altitud de la granja (msnm)</label>
    <input class="reg-texto num" id="plan-alt" type="number" inputmode="numeric" min="0" max="4500" step="50" value="${esc(S.alt)}">
    <div class="nl-presets" role="group" aria-label="Zonas">${alts.map(a =>
      `<button type="button" class="segmento-btn" data-accion="plan-alt" data-v="${a[0]}" aria-pressed="${Number(S.alt) === a[0]}">${a[1]} · ${fmt(a[0])} m</button>`).join('')}</div>
    <p class="reg-ayuda" id="plan-ayuda-alt"></p></div>
  <div id="plan-real-vivo"></div>
  <div class="reg-acciones plan-acciones">${Boton({ texto: 'Atrás', icono: 'atras', variante: 'secundario', accion: 'plan-ir', datos: { paso: 'genetica' } })}${
    apagado(Boton({ texto: 'Ver recomendaciones', icono: 'sig', variante: 'primario', accion: 'plan-siguiente' }), !P.loteValido())}</div>`;
  }

  /* Partes del paso Lote que cambian mientras se escribe (como vivoLote del original). */
  function vivoLote() {
    const g = P.gen(); if (!g || !$v('#plan-edad')) return;
    const err = P.errorEdad();
    $v('#plan-err-edad').textContent = err;
    $v('#plan-err-aves').textContent = P.avesOk() ? '' : 'Escribe cuántas aves tienes: de 1 a 1.000.000.';
    const f = $v('#plan-fase-vivo');
    if (err) f.innerHTML = '';
    else { const ph = fase(g, P.modo(), P.dias()); f.innerHTML = `<p class="plan-fase">${icono('huevo')}<span>Fase: <b>${esc(ph.n)}</b> · ${esc(ph.r)}</span></p>`; }
    const alt = Number(S.alt) || 0;
    $v('#plan-ayuda-alt').textContent = P.modo() === 'carne' && esBroiler(g) && alt >= 2000 ? 'Sobre 2.000 m el pollo de engorde crece menos y tiene más riesgo de ascitis. La app lo incluye en la proyección.'
      : alt >= 2000 ? 'En zona alta las noches son frías: la app ajusta las recomendaciones de temperatura.' : 'La altitud ajusta temperatura, densidad y riesgo de ascitis.';
    document.querySelectorAll('#view [data-accion="plan-alt"]').forEach(b => b.setAttribute('aria-pressed', String(Number(b.dataset.v) === S.alt)));
    const rv = $v('#plan-real-vivo');
    if (!err && P.realVisible()) {
      const h = P.modo() === 'huevos';
      if (rv.dataset.tipo !== (h ? 'h' : 'c')) {
        rv.dataset.tipo = h ? 'h' : 'c';
        rv.innerHTML = `<div class="reg-campo"><label class="reg-etiqueta" for="plan-real">${h ? '% de postura actual' : 'Peso promedio actual (g)'} <span class="plan-opcional">· opcional</span></label>
          <input class="reg-texto num" id="plan-real" type="number" inputmode="decimal" min="0" step="${h ? '0.1' : '1'}" placeholder="${h ? 'Ej.: 88' : 'Ej.: 1250'}" value="${esc(S.real === null ? '' : S.real)}">
          <p class="reg-ayuda">${h ? 'Huevos recogidos ayer ÷ aves vivas × 100.' : 'Pesa 1 de cada 20 aves y saca el promedio.'} Con este dato la proyección parte de lo que hoy produce tu lote.</p></div>`;
      }
    } else { rv.innerHTML = ''; delete rv.dataset.tipo; }
    const btn = $v('[data-accion="plan-siguiente"]'); if (btn) btn.disabled = !P.loteValido();
  }

  /* ============================== Vista ============================== */
  VISTAS.planificar = async function (params) {
    const pedido = (params && params.paso) || 'genetica', paso = P.pasoPermitido(pedido);
    if (paso !== pedido || location.hash !== '#/plan/' + paso) history.replaceState(null, '', '#/plan/' + paso);
    const cuerpo = paso === 'genetica' ? pasoGenetica() : paso === 'lote' ? pasoLote() : paso === 'manejo' ? PlanManejo.html() : PlanProyeccion.html();
    return `<section class="pantalla planificar" data-paso="${paso}">${cabecera(paso)}${cuerpo}</section>`;
  };
  VISTAS.planificar.montar = function (raiz) {
    const sec = raiz.querySelector('.planificar'); if (!sec) return;
    const paso = sec.dataset.paso;
    if (paso === 'lote') {
      vivoLote();
      raiz.addEventListener('input', e => {
        const id = e.target.id;
        if (id === 'plan-edad' || id === 'plan-aves' || id === 'plan-alt' || id === 'plan-real') { P.escribir(id.slice(5), e.target.value); if (id !== 'plan-real') vivoLote(); }
      });
    } else if (paso === 'manejo') PlanManejo.montar(raiz);
    else if (paso === 'proyeccion') PlanProyeccion.montar(raiz);
  };

  /* ------------------------------ Acciones ------------------------------ */
  ACCIONES['plan-ir'] = el => App.ir('#/plan/' + el.dataset.paso);
  ACCIONES['plan-filtro'] = el => { S.filtro = el.dataset.v; P.guardar(); App.refrescar(); };
  ACCIONES['plan-genetica'] = el => { P.elegirGenetica(el.dataset.id); App.ir('#/plan/lote'); };
  ACCIONES['plan-obj'] = el => { if (P.elegirObjetivo(el.dataset.v)) App.refrescar(); };
  ACCIONES['plan-unidad'] = el => { if (P.elegirUnidad(el.dataset.v)) App.refrescar(); };
  ACCIONES['plan-preset'] = el => { S.edad = Number(el.dataset.v); S.unidad = el.dataset.u; S.fin = null; P.guardar(); App.refrescar(); };
  ACCIONES['plan-alt'] = el => { S.alt = Number(el.dataset.v); P.guardar(); const i = $v('#plan-alt'); if (i) i.value = S.alt; vivoLote(); };
  const pasoBtn = (el, signo) => { const v = P.paso(el.dataset.c, signo); const i = $v('#plan-' + el.dataset.c); if (i) i.value = v; vivoLote(); };
  ACCIONES['plan-mas'] = el => pasoBtn(el, 1);
  ACCIONES['plan-menos'] = el => pasoBtn(el, -1);
  ACCIONES['plan-siguiente'] = () => { if (P.loteValido()) App.ir('#/plan/manejo'); else vivoLote(); };
})();
