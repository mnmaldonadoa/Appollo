/* =========================================================================
   APPOLLO · Planificar: estado del planificador y reglas (sin DOM).
   Copiado del planificador original (Appollo 1, IIFE de la interfaz) sin cambiar la lógica:
   mismas claves de almacenamiento (appollo.v1.estado, appollo.v1.precios), mismos
   valores de fábrica (BASE) y mismas llamadas a construirManejo / proyectar / brechas.
   ========================================================================= */
const PlanEstado = (function () {
  'use strict';
  const LS = {
    get(k, def) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : def; } catch (e) { return def; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* sin almacenamiento */ } }
  };
  const K_ESTADO = 'appollo.v1.estado', K_PRECIOS = 'appollo.v1.precios';
  const BASE = { gid: null, obj: 'huevos', edad: null, unidad: 'semanas', aves: 100, alt: 2800, real: null, fin: null, sel: [], enf: null, filtro: 'todas' };
  const S = Object.assign({}, BASE, LS.get(K_ESTADO, {}));
  if (!Array.isArray(S.sel)) S.sel = [];
  const precios = Object.assign({ cubeta: '', kgVivo: '', kgAlim: '' }, LS.get(K_PRECIOS, {}));
  const guardar = () => LS.set(K_ESTADO, S);
  const guardarPrecios = () => LS.set(K_PRECIOS, precios);

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
  const loteValido = () => !!gen() && !errorEdad() && avesOk();

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
  const enPostura = st => st.modo === 'huevos' && st.dias / 7 >= st.g.postura.w50 - 2;

  /* Paso al que se puede llegar: sin genética no hay lote; sin lote válido no hay manejo ni proyección. */
  const PASOS = ['genetica', 'lote', 'manejo', 'proyeccion'];
  function pasoPermitido(p) {
    let r = PASOS.includes(p) ? p : 'genetica';
    if (r !== 'genetica' && !gen()) r = 'genetica';
    if ((r === 'manejo' || r === 'proyeccion') && !loteValido()) r = 'lote';
    return r;
  }

  /* ---------------------------- Acciones de estado ---------------------------- */
  function elegirGenetica(id) {
    if (S.gid === id) return;
    const g = GENETICAS.find(x => x.id === id); if (!g) return;
    Object.assign(S, { gid: g.id, obj: 'huevos', sel: [], enf: null, fin: null, real: null });
    if (modoDe(g, S.obj) === 'carne') Object.assign(S, { unidad: 'dias', edad: 1 });
    else Object.assign(S, { unidad: 'semanas', edad: 20 });
    guardar();
  }
  function elegirObjetivo(v) {
    if (S.obj === v) return false;
    S.obj = v;
    Object.assign(S, { sel: [], enf: null, fin: null, real: null });
    Object.assign(S, S.obj === 'carne' ? { unidad: 'dias', edad: 1 } : { unidad: 'semanas', edad: 20 });
    guardar(); return true;
  }
  function elegirUnidad(u) {
    if (u === S.unidad) return false;
    const e = Number(S.edad);
    if (isFinite(e)) S.edad = u === 'dias' ? Math.round(e * 7) : Math.round(e / 7 * 10) / 10;
    S.unidad = u; guardar(); return true;
  }
  /* Botones − / + : mismos pasos que el original. Devuelve el valor nuevo. */
  function paso(campo, signo) {
    let v;
    if (campo === 'edad') {
      const e = Number(S.edad) || 0;
      v = S.edad = Math.max(0, Math.round((e + signo) * 10) / 10);
    } else {
      const a = Number(S.aves) || 0;
      const p = a >= 100 ? 10 : a >= 20 ? 5 : 1;
      v = S.aves = Math.max(1, a + signo * p);
    }
    S.fin = null; guardar(); return v;
  }
  /* Lo que escribe la persona en los campos del lote (mismas reglas que el original). */
  function escribir(campo, valor) {
    if (campo === 'edad') { S.edad = valor === '' ? null : Number(valor); S.fin = null; }
    else if (campo === 'aves') S.aves = valor === '' ? NaN : Math.round(Number(valor));
    else if (campo === 'alt') S.alt = Math.max(0, Math.min(4500, Number(valor) || 0));
    else if (campo === 'real') S.real = valor === '' ? null : Number(valor);
    guardar();
  }
  function marcar(id, si) {
    const s = selSet(); if (si) s.add(id); else s.delete(id);
    S.sel = [...s]; guardar();
  }
  function marcarTodo() {
    const st = estado(), M = construirManejo(st);
    const F = factores(st, M, selSet());
    if (F.indice >= 100) { S.sel = []; guardar(); return; }
    const s = selSet();
    for (const c of M.cats) if (c.items) for (const it of c.items) s.add(it.id);
    const enf = ENFERMEDADES.find(e => e.id === st.enf);
    if (enf) {
      enf.caseros.filter(x => /comprobad/i.test(x.ev) && (!x.solo || x.solo === st.modo)).forEach(x => s.add(x.id));
      const q = enf.quimicos.filter(x => !(x.noPostura && enPostura(st))).sort((a, b) => b.mit - a.mit)[0];
      if (q) s.add(q.id);
    }
    S.sel = [...s]; guardar();
  }

  /* ------------------------------ Cálculo ------------------------------ */
  function calcular() {
    const st = estado(), M = construirManejo(st), sel = selSet();
    const r = proyectar(st, M, sel);
    const Fstd = { f: 1, mortExtra: 0, shift: 0 };
    const stStd = Object.assign({}, st, { g: Object.assign({}, st.g, { campo: 1 }), real: null });
    const ref = st.modo === 'huevos' ? simHuevos(stStd, Fstd) : simCarne(stStd, Fstd);
    const br = brechas(st, M, sel, r);
    return { st, M, r, ref, br };
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

  /* Datos para "Crear lote con este plan" (los consume una vez la vista Nuevo lote). */
  function datosLote() {
    if (!loteValido()) return null;
    return { genetica: S.gid, aves: Math.round(S.aves), altitud: Number(S.alt) || 0, edadDias: dias() };
  }

  return { S, BASE, precios, guardar, guardarPrecios, gen, modo, dias, edadTxt, edadCorta, maxDias, errorEdad, avesOk, loteValido,
    opcionesFin, dFin, realVisible, estado, selSet, enPostura, PASOS, pasoPermitido, elegirGenetica, elegirObjetivo, elegirUnidad,
    paso, escribir, marcar, marcarTodo, calcular, textoResumen, datosLote };
})();
