/* =========================================================================
   APPOLLO · Reportes: cifras de un lote en un período (semana, mes o ciclo),
   gráfica del período y botones para copiar o compartir el texto (WhatsApp).
   Lo que no se puede calcular se muestra "—", nunca NaN.
   ========================================================================= */
var VISTAS = window.VISTAS || (window.VISTAS = {});
var ACCIONES = window.ACCIONES || (window.ACCIONES = {});

(function () {
  'use strict';
  const K_PERIODO = 'appollo.v2.periodoReporte', PERIODOS = [['semana', 'Semana'], ['mes', 'Mes'], ['ciclo', 'Ciclo']];
  const lsGet = k => { try { return localStorage.getItem(k); } catch (e) { return null; } };
  const lsSet = (k, v) => { try { localStorage.setItem(k, v); } catch (e) { /* sin almacenamiento */ } };
  let periodo = PERIODOS.some(p => p[0] === lsGet(K_PERIODO)) ? lsGet(K_PERIODO) : 'semana';
  let loteId = null, actual = null; // actual: {texto, titulo}
  const r1 = x => (x === null ? null : Math.round(x * 10) / 10);
  const dinero = x => (x === null ? null : (x < 0 ? '-$' : '$') + formatoNumero(Math.abs(x), 2));
  const ddmm = f => (typeof f === 'string' && f.length >= 10 ? f.slice(8, 10) + '/' + f.slice(5, 7) : '—');

  /* Serie diaria del período (máx. 60 días finales): % postura o peso real contra el estándar. */
  function grafica(l, regs, res, g) {
    if (!g) return '';
    if (typeof res.hasta !== 'string' || typeof res.desde !== 'string') return '';
    const fin = res.hasta, tope = _repMasDias(fin, -59), desde = res.desde > tope ? res.desde : tope;
    const real = [], est = [], dias = [];
    for (let f = desde; f <= fin; f = _repMasDias(f, 1)) {
      dias.push(f);
      let e = null, v = null;
      try {
        const std = estandarDia(l, f, null, Math.max(0, avesVivas(l, regs, f)));
        if (res.carne) {
          const p = regs.filter(r => r.tipo === 'peso' && r.fecha === f).pop();
          v = p ? Number(p.datos.gramos) : null; e = std.pesoG;
        } else { v = pctPostura(l, regs, f); e = std.hdPct; }
      } catch (x) { /* día fuera de la guía */ }
      real.push(Number.isFinite(v) ? r1(v) : null); est.push(Number.isFinite(e) ? r1(e) : null);
    }
    if (!real.some(v => v !== null)) return '';
    return `<article class="tarjeta rep-grafica"><header class="tarjeta-cab"><h3 class="tarjeta-titulo">${res.carne ? 'Peso promedio (g)' : '% de postura por día'}</h3></header>${
      Grafico({ serieReal: real, serieEstandar: est, etiquetas: dias.map(ddmm) })}</article>`;
  }

  function tarjetas(s) {
    const t = (titulo, ic, cifra, unidad, pie) => `<div class="ini-celda">${Tarjeta({ titulo, icono: ic, cifra, unidad: cifra === null ? '' : unidad, pie })}</div>`;
    const m = s.mortalidad === 1 ? 'ave' : 'aves';
    return [
      t('Viabilidad', 'escudo', r1(s.viabilidad), '%', 'Aves que siguen vivas'),
      t('Mortalidad', 'cruz', s.mortalidad, m, 'En este período'),
      s.carne ? t('Peso en pie', 'balanza', r1(s.produccion), 'kg', 'Estimado: peso × aves vivas')
        : t('Huevos', 'huevo', s.produccion, 'huevos', s.cubetas === null ? 'Sin huevos registrados' : `${formatoNumero(r1(s.cubetas))} cubetas de 30`),
      s.carne ? t('Alimento', 'saco', r1(s.alimentoKg), 'kg', 'Dado en el período')
        : t('% de postura', 'grafico', r1(s.pctPostura), '%', 'Huevos ÷ aves vivas'),
      t('Conversión', 'balanza', s.conversion === null ? null : Math.round(s.conversion * 100) / 100, 'kg/kg',
        s.carne ? 'Alimento ÷ peso en pie' : 'Alimento ÷ kg de huevo'),
      t('Costo de alimento', 'saco', dinero(s.costoAlimento), '', s.costoAlimento === null ? 'Falta el precio o el alimento' : `${formatoNumero(r1(s.alimentoKg))} kg`),
      t('Ingreso', 'huevo', dinero(s.ingreso), '', s.ingreso === null ? 'Falta el precio o la producción' : s.carne ? 'Peso en pie × precio del kg' : 'Cubetas vendidas × precio'),
      t('Margen', 'grafico', dinero(s.margen), '', 'Ingreso − alimento')
    ].join('');
  }

  VISTAS.reportes = async function () {
    const lotes = await DB.listar('lotes');
    if (!lotes.length) {
      actual = null;
      return `<section class="pantalla pantalla-vacia">
  <div class="vacia-ilustracion" aria-hidden="true">${icono('grafico')}</div>
  <h1>Reportes</h1>
  <p class="pantalla-texto">Aún no tienes lotes. Crea uno y registra tus datos para ver cómo va.</p>
  ${Boton({ texto: 'Nuevo lote', icono: 'mas', variante: 'primario', accion: 'nuevo-lote', clase: 'btn-ancho btn-grande' })}
</section>`;
    }
    const orden = (a, b) => String(b.fechaLlegada || '').localeCompare(String(a.fechaLlegada || ''));
    const lista = lotes.filter(l => l.estado === 'activo').sort(orden).concat(lotes.filter(l => l.estado !== 'activo').sort(orden));
    const l = lista.find(x => x.id === loteId) || lista.find(x => x.id === App.estado.loteActivoId) || lista[0];
    loteId = l.id;
    const [regs, granja] = await Promise.all([DB.listar('registros', { loteId: l.id }), DB.obtener('granja', 'granja')]);
    const hoy = hoyLocal(), per = periodoReporte(l, periodo, hoy, regs);
    const s = resumenReporte(l, regs, per.desde, per.hasta, (granja && granja.precios) || {});
    // Lote cerrado sin registros en el período: no se muestra una viabilidad de 100 % inventada.
    const sinDatos = !regs.some(r => r.fecha >= s.desde && r.fecha <= s.hasta), cerrado = l.estado !== 'activo';
    if (cerrado && sinDatos) s.viabilidad = null;
    const g = GENETICAS.find(x => x.id === l.genetica);
    const texto = textoReporte(s, l, periodo, granja);
    actual = { texto, titulo: 'Reporte · ' + (l.nombre || 'Lote') };
    const sinPrecios = [s.costoAlimento, s.ingreso].every(v => v === null) && !(granja && granja.precios && Object.keys(granja.precios).length);
    const comp = typeof navigator.share === 'function';
    const opciones = lista.map(x => `<option value="${esc(x.id)}"${x.id === l.id ? ' selected' : ''}>${esc(x.nombre || 'Lote')}${x.estado === 'activo' ? '' : ' (cerrado)'}</option>`).join('');
    return `<section class="pantalla reportes">
  <header class="ini-cab"><h1>Reportes</h1><p class="pantalla-texto">${esc(g ? g.nombre : '')} · ${esc(ddmm(s.desde))} al ${esc(ddmm(s.hasta))}</p></header>
  ${cerrado && sinDatos && periodo !== 'ciclo' ? '<p class="rep-aviso">Este lote está cerrado: usa Ciclo</p>' : ''}
  <div class="reg-campo"><label class="reg-etiqueta" for="rep-lote">Lote</label><select class="reg-select" id="rep-lote">${opciones}</select></div>
  <div class="segmento" role="group" aria-label="Período">${PERIODOS.map(([id, t]) =>
    `<button type="button" class="segmento-btn" data-accion="rep-periodo" data-periodo="${id}" aria-pressed="${id === periodo}">${t}</button>`).join('')}</div>
  <div class="ini-rejilla rep-cifras">${tarjetas(s)}</div>
  ${sinPrecios ? `<div class="rep-aviso"><p>Escribe tus precios para ver el costo, el ingreso y el margen.</p>${Boton({ texto: 'Poner precios', icono: 'ajustes', variante: 'secundario', accion: 'ir', datos: { ruta: '#/ajustes' }, clase: 'btn-ancho' })}</div>` : ''}
  ${grafica(l, regs, s, g)}
  <div class="rep-acciones">${Boton({ texto: 'Copiar reporte', icono: 'copiar', variante: 'primario', accion: 'rep-copiar', clase: 'btn-ancho btn-grande' })}${
    comp ? Boton({ texto: 'Compartir', icono: 'sig', variante: 'secundario', accion: 'rep-compartir', clase: 'btn-ancho btn-grande' }) : ''}</div>
  <div class="rep-copia" hidden><label class="reg-etiqueta" for="rep-texto">Selecciona y copia el reporte</label><textarea class="reg-texto rep-texto" id="rep-texto" rows="8" readonly></textarea></div>
</section>`;
  };

  VISTAS.reportes.montar = function (raiz) {
    const sel = raiz.querySelector('#rep-lote');
    if (sel) sel.addEventListener('change', () => { loteId = sel.value; App.fijarLote(sel.value); App.refrescar(); });
  };

  ACCIONES['rep-periodo'] = el => { periodo = el.dataset.periodo; lsSet(K_PERIODO, periodo); App.refrescar(); };

  /* Portapapeles moderno; si no hay o se niega: textarea oculto + execCommand; si tampoco, caja visible para copiar a mano. */
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

  ACCIONES['rep-copiar'] = async () => {
    if (!actual) return;
    if (await copiar(actual.texto)) { App.toast('Copiado'); return; }
    const caja = document.querySelector('#view .rep-copia'), ta = document.querySelector('#rep-texto');
    if (!caja || !ta) return;
    caja.hidden = false; ta.value = actual.texto;
    ta.scrollIntoView({ block: 'center' }); ta.focus(); ta.select();
    App.toast('Copia el texto de la caja');
  };

  ACCIONES['rep-compartir'] = async () => {
    if (!actual || typeof navigator.share !== 'function') return;
    try { await navigator.share({ title: actual.titulo, text: actual.texto }); }
    catch (e) { if (!e || e.name !== 'AbortError') ACCIONES['rep-copiar'](); }
  };
})();
