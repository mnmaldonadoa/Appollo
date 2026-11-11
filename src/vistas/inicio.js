/* =========================================================================
   APPOLLO · Inicio: selector Todos / lote y tarjetas del día (aves, mortalidad, alimento,
   producción, estado sanitario, alertas, rendimiento) con minigráfica de 14 días.
   "Todos" suma los lotes activos. Lo que no se puede calcular se muestra "—", nunca NaN.
   ========================================================================= */
var VISTAS = window.VISTAS || (window.VISTAS = {});
var ACCIONES = window.ACCIONES || (window.ACCIONES = {});

(function () {
  'use strict';
  let verTodos = false, ultimo = '', previo = {};
  /* Aviso único «Elegir tareas del ciclo»: la marca vive en localStorage (puede fallar: sin ella, el aviso sigue sin romper nada). */
  const kAviso = id => 'appollo.v2.planAvisado:' + id;
  const avisado = id => { try { return localStorage.getItem(kAviso(id)) === '1'; } catch (e) { return false; } };
  const marcarAvisado = id => { try { localStorage.setItem(kAviso(id), '1'); } catch (e) { /* sin almacenamiento */ } };
  /* Primer lote activo sin filas de plan y sin avisar (los cerrados nunca entran: `lotes` ya viene filtrado). */
  const loteSinPlan = (lotes, filas) => lotes.find(l => !filas.some(f => f.loteId === l.id) && !avisado(l.id)) || null;
  const fin = x => (Number.isFinite(x) ? x : null);
  const r1 = x => (x === null ? null : Math.round(x * 10) / 10);
  const suma = xs => xs.reduce((s, x) => s + x, 0);
  const sumaDatos = (rs, campo) => suma(rs.map(r => Number(r.datos && r.datos[campo]) || 0));
  const masDias = (f, n) => { const d = fechaADate(f); d.setDate(d.getDate() + n); return hoyLocal(d); };
  const ddmm = f => f.slice(8, 10) + '/' + f.slice(5, 7);
  const ESTADO = { verde: 'Verde', ambar: 'Amarillo', rojo: 'Rojo' }, PEOR = ['verde', 'ambar', 'rojo'];

  /* Cifras de un lote para el día `hoy`. */
  function metricas(l, regs, vacs, hoy, alt) {
    const propios = regs.filter(r => r.loteId === l.id), del = t => propios.filter(r => r.tipo === t && r.fecha === hoy);
    const res = resumenLote(l, propios, vacs, hoy), carne = !!res.g && modoDe(res.g) === 'carne';
    let std = null;
    if (res.ok) { try { std = estandarDia(l, hoy, alt, res.vivas); } catch (e) { std = null; } }
    const ps = propios.filter(r => r.tipo === 'peso' && r.fecha <= hoy && Number(r.datos && r.datos.gramos) > 0).sort((a, b) => (a.fecha < b.fecha ? -1 : 1));
    const alim = del('alimento'), hue = del('huevos');
    return { l, res, carne, std, propios,
      inicio: Number(l.avesInicio) || 0, muertesTot: mortalidadTotal(l, propios, hoy), muertesHoy: sumaDatos(del('mortalidad'), 'cantidad'),
      kg: alim.length ? sumaDatos(alim, 'kg') : null, huevos: hue.length ? sumaDatos(hue, 'cantidad') : null,
      peso: ps.length ? Number(ps[ps.length - 1].datos.gramos) : null,
      rend: res.ok ? fin(rendimiento(l, propios, hoy)) : null };
  }

  /* Suma de varios lotes (o de uno solo). */
  function agregado(ms) {
    const vivas = suma(ms.map(m => m.res.vivas || 0)), inicio = suma(ms.map(m => m.inicio));
    const post = ms.filter(m => !m.carne && m.res.ok), conH = post.filter(m => m.huevos !== null && m.res.vivas > 0);
    const vivH = suma(conH.map(m => m.res.vivas)), stdH = suma(conH.map(m => (m.std && m.std.huevos) || 0));
    const conR = ms.filter(m => m.rend !== null && m.res.vivas > 0), vivR = suma(conR.map(m => m.res.vivas));
    const conKg = ms.filter(m => m.kg !== null), stds = ms.filter(m => m.std && m.std.alimentoKg > 0);
    const estados = ms.map(m => m.res.estado).filter(Boolean);
    return {
      vivas, inicio, mortPct: inicio > 0 ? fin(100 * suma(ms.map(m => m.muertesTot)) / inicio) : null, muertesHoy: suma(ms.map(m => m.muertesHoy)),
      kg: conKg.length ? suma(conKg.map(m => m.kg)) : null, kgStd: stds.length ? suma(stds.map(m => m.std.alimentoKg)) : null,
      postura: post.length > 0 || !ms.some(m => m.carne),
      huevos: conH.length ? suma(conH.map(m => m.huevos)) : null,
      pct: vivH > 0 ? fin(100 * suma(conH.map(m => m.huevos)) / vivH) : null, pctStd: vivH > 0 ? fin(100 * stdH / vivH) : null,
      carneUnico: ms.filter(m => m.carne).length === 1 ? ms.find(m => m.carne) : null,
      rend: vivR > 0 ? fin(suma(conR.map(m => m.rend * m.res.vivas)) / vivR) : null,
      estado: estados.length ? estados.reduce((a, b) => (PEOR.indexOf(b) > PEOR.indexOf(a) ? b : a)) : null
    };
  }

  /* 14 días: % postura real vs estándar (postura) o peso real vs estándar (un lote de carne). */
  function serie14(ms, a, hoy, alt) {
    const dias = []; for (let i = 13; i >= 0; i--) dias.push(masDias(hoy, -i));
    const real = [], est = [];
    for (const f of dias) {
      if (a.postura) {
        let h = 0, vh = 0, sh = 0, vs = 0;
        for (const m of ms.filter(x => !x.carne && x.res.ok && f >= x.l.fechaLlegada)) {
          const v = Math.max(0, avesVivas(m.l, m.propios, f)), hs = m.propios.filter(r => r.tipo === 'huevos' && r.fecha === f);
          if (hs.length && v > 0) { h += sumaDatos(hs, 'cantidad'); vh += v; }
          const e = fin(estandarDia(m.l, f, alt, v).hdPct);
          if (e !== null && v > 0) { sh += e * v; vs += v; }
        }
        real.push(vh > 0 ? r1(100 * h / vh) : null); est.push(vs > 0 ? r1(sh / vs) : null);
      } else if (a.carneUnico && a.carneUnico.res.ok && f >= a.carneUnico.l.fechaLlegada) {
        const m = a.carneUnico, p = m.propios.filter(r => r.tipo === 'peso' && r.fecha === f).pop();
        real.push(p ? fin(Number(p.datos.gramos)) : null); est.push(r1(fin(estandarDia(m.l, f, alt).pesoG)));
      } else { real.push(null); est.push(null); }
    }
    return { serieReal: real, serieEstandar: est, etiquetas: dias.map(ddmm) };
  }

  const celda = (t, html, ancho) => `<div class="ini-celda${ancho ? ' ini-ancha' : ''}" data-t="${t}">${html}</div>`;
  const kg = x => (x === null ? '—' : formatoNumero(r1(x)) + ' kg');

  function construir(d) {
    const { activos, sel, ms, a, alertas, hoy, alt, sinPlan } = d;
    const g = App.estado.granja || {};
    const uno = sel !== 'todos' ? ms[0] : null;
    const selector = activos.length > 1 ? `<div class="ini-selector" role="group" aria-label="Ver lote">${[{ id: 'todos', nombre: 'Todos' }].concat(activos).map(l =>
      `<button type="button" class="selector-btn" data-accion="ini-lote" data-id="${esc(l.id)}" aria-pressed="${sel === l.id}">${esc(l.nombre || 'Lote')}</button>`).join('')}</div>` : '';
    const sub = uno ? `${esc(uno.l.nombre || 'Lote')} · ${esc(textoEdad(uno.res.edad))}` : `${activos.length} lotes activos`;
    const rojas = alertas.filter(x => x.gravedad === 'rojo').length;
    let prod;
    if (a.postura) prod = Tarjeta({ titulo: 'Huevos de hoy', icono: 'huevo', cifra: a.huevos, unidad: a.huevos === null ? '' : 'huevos',
      pie: `Postura ${a.pct === null ? '—' : formatoNumero(r1(a.pct)) + ' %'} · estándar ${a.pctStd === null ? '—' : formatoNumero(r1(a.pctStd)) + ' %'}` });
    else {
      const m = a.carneUnico;
      prod = Tarjeta({ titulo: 'Peso promedio', icono: 'balanza', cifra: m ? m.peso : null, unidad: m && m.peso !== null ? 'g' : '',
        pie: m ? `Estándar ${m.std && fin(m.std.pesoG) !== null ? formatoNumero(Math.round(m.std.pesoG)) + ' g' : '—'}` : 'Elige un lote para ver su peso' });
    }
    const motivo = alertas.find(x => x.gravedad !== 'info');
    const s14 = a.postura || a.carneUnico ? serie14(ms, a, hoy, alt) : null;
    const graf = Grafico(s14 && s14.serieReal.some(v => v !== null) ? s14 : {});
    return `<section class="pantalla inicio">
  <header class="ini-cab"><h1>${esc(g.nombre || 'Inicio')}</h1><p class="pantalla-texto">${sub}</p></header>
  ${selector}
  <div class="ini-rejilla">
  ${sinPlan ? `<div class="ini-celda ini-ancha" data-t="plan-aviso"><article class="tarjeta ini-aviso-plan">
    <header class="tarjeta-cab"><span class="tarjeta-icono">${icono('hoja')}</span><h3 class="tarjeta-titulo">Elegir tareas del ciclo</h3></header>
    <p class="ini-aviso-texto">${esc(sinPlan.nombre || 'Lote')}: elige las vacunas y labores que quieres que Appollo te recuerde.</p>
    <div class="ini-aviso-botones">${Boton({ texto: 'Elegir tareas', icono: 'sig', variante: 'primario', accion: 'ini-elegir-plan', datos: { id: sinPlan.id }, clase: 'btn-ancho' })}
    ${Boton({ texto: 'Ahora no', variante: 'secundario', accion: 'ini-plan-despues', datos: { id: sinPlan.id }, clase: 'btn-ancho' })}</div></article></div>` : ''}
  ${celda('aves', Tarjeta({ titulo: 'Aves vivas', icono: 'gallina', cifra: a.vivas, pie: `de ${formatoNumero(a.inicio)} al llegar` }))}
  ${celda('mortalidad', Tarjeta({ titulo: 'Mortalidad', icono: 'cruz', cifra: r1(a.mortPct), unidad: a.mortPct === null ? '' : '%', pie: `Hoy: ${formatoNumero(a.muertesHoy)} ${a.muertesHoy === 1 ? 'ave' : 'aves'}` }))}
  ${celda('alimento', Tarjeta({ titulo: 'Alimento de hoy', icono: 'saco', cifra: r1(a.kg), unidad: a.kg === null ? '' : 'kg', pie: 'Estándar ' + kg(a.kgStd) }), true)}
  ${celda('produccion', prod, true)}
  <div class="ini-celda ini-ancha" data-t="sanitario" data-estado="${a.estado || ''}">${Tarjeta({ titulo: 'Estado sanitario', icono: 'escudo', estado: a.estado || undefined,
    cifra: a.estado ? ESTADO[a.estado] : null, pie: motivo ? motivo.texto : a.estado === 'ambar' ? 'Sin registros en los últimos 3 días' : 'Todo en orden' })}</div>
  <a class="ini-celda ini-ancha ini-enlace" data-t="alertas" href="#/alertas">${Tarjeta({ titulo: 'Alertas pendientes', icono: 'campana', cifra: alertas.length,
    estado: rojas ? 'rojo' : alertas.length ? 'ambar' : undefined, pie: alertas.length ? 'Toca para verlas' : 'Nada pendiente' })}</a>
  ${celda('rendimiento', Tarjeta({ titulo: 'Rendimiento vs estándar', icono: 'grafico', cifra: r1(a.rend), unidad: a.rend === null ? '' : '%',
    pie: a.postura ? 'Postura real ÷ estándar' : 'Peso real ÷ estándar' }), true)}
  ${celda('grafica', `<article class="tarjeta"><header class="tarjeta-cab"><h3 class="tarjeta-titulo">Últimos 14 días · ${a.postura ? '% postura' : 'peso (g)'}</h3></header>${graf}</article>`, true)}
  </div>
</section>`;
  }

  const vacio = () => `<section class="pantalla pantalla-vacia">
  <div class="vacia-ilustracion" aria-hidden="true">${ilustracion('gallina')}</div>
  <h1>${esc((App.estado.granja && App.estado.granja.nombre) || 'Bienvenido a Appollo')}</h1>
  <p class="pantalla-texto">Aún no tienes lotes. Crea el primero para registrar mortalidad, alimento y huevos cada día.</p>
  ${Boton({ texto: 'Nuevo lote', icono: 'mas', variante: 'primario', accion: 'nuevo-lote', clase: 'btn-ancho btn-grande' })}
</section>`;

  VISTAS.inicio = async function () {
    const activos = await DB.listar('lotes', { estado: 'activo' });
    if (!activos.length) { ultimo = ''; return vacio(); }
    return ultimo || `<section class="pantalla inicio">${Esqueleto(5)}</section>`;
  };

  VISTAS.inicio.montar = async function (raiz) {
    if (!raiz.querySelector('.inicio')) return;
    const [lotes, registros, vacunasPlan, inventario, planTareas] = await Promise.all(['lotes', 'registros', 'vacunasPlan', 'inventario', 'planTareas'].map(s => DB.listar(s)));
    const activos = lotes.filter(l => l.estado === 'activo').sort((x, y) => String(x.fechaLlegada || '').localeCompare(String(y.fechaLlegada || '')));
    const hoy = hoyLocal(), alt = App.estado.granja && App.estado.granja.altitud;
    const id = App.estado.loteActivoId;
    const sel = activos.length === 1 ? activos[0].id : !verTodos && activos.some(l => l.id === id) ? id : 'todos';
    const elegidos = sel === 'todos' ? activos : activos.filter(l => l.id === sel);
    const ms = elegidos.map(l => metricas(l, registros, vacunasPlan, hoy, alt));
    let alertas = [];
    try { alertas = generarAlertas({ lotes, registros, vacunasPlan, inventario, planTareas, granja: App.estado.granja }, new Date()); } catch (e) { alertas = []; }
    alertas = alertas.filter(x => x.gravedad !== 'info' && (sel === 'todos' || !x.loteId || x.loteId === sel));
    if (!raiz.isConnected) return;
    raiz.innerHTML = construir({ activos, sel, ms, a: agregado(ms), alertas, hoy, alt, sinPlan: loteSinPlan(elegidos, planTareas) });
    ultimo = raiz.innerHTML;
    raiz.querySelectorAll('[data-t] .tarjeta-cifra[data-cifra]').forEach(el => {
      const t = el.closest('[data-t]').dataset.t, clave = sel + ':' + t, meta = Number(el.dataset.cifra);
      if (previo[clave] !== undefined && previo[clave] !== meta) { const c = el.closest('.tarjeta'); if (c && !reducirMovimiento()) c.classList.add('pop'); }
      el.textContent = formatoNumero(previo[clave] !== undefined ? previo[clave] : 0);
      previo[clave] = meta;
      contar(el, meta);
    });
  };

  ACCIONES['ini-elegir-plan'] = el => { marcarAvisado(el.dataset.id); ultimo = ''; App.ir('#/lote/' + encodeURIComponent(el.dataset.id) + '/plan'); };
  ACCIONES['ini-plan-despues'] = el => { marcarAvisado(el.dataset.id); ultimo = ''; App.refrescar(); };

  ACCIONES['ini-lote'] = el => {
    const id = el.dataset.id;
    verTodos = id === 'todos';
    if (!verTodos) App.fijarLote(id);
    App.refrescar();
  };
})();
