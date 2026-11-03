/* =========================================================================
   APPOLLO · Modelo: fases, recomendaciones de manejo y proyección
   ========================================================================= */

const clamp = (x, a, b) => Math.max(a, Math.min(b, x));

function interp(xs, ys, x) {
  const n = xs.length;
  if (x <= xs[0]) return ys[0];
  if (x >= xs[n - 1]) {
    const s = (ys[n - 1] - ys[n - 2]) / (xs[n - 1] - xs[n - 2]);
    return ys[n - 1] + s * (x - xs[n - 1]) * 0.85;
  }
  for (let i = 1; i < n; i++) {
    if (x <= xs[i]) {
      const t = (x - xs[i - 1]) / (xs[i] - xs[i - 1]);
      return ys[i - 1] + t * (ys[i] - ys[i - 1]);
    }
  }
  return ys[n - 1];
}

const modoDe = (g, obj) => g.tipo === 'postura' ? 'huevos' : g.tipo === 'carne' ? 'carne' : (obj || 'huevos');
const esBroiler = g => g.id === 'cobb500' || g.id === 'ross308';

/* ------------------------------ Curvas ------------------------------ */
function hdStd(p, w, shift = 0) {
  const L = 1 / (1 + Math.exp(-p.k * (w - (p.w50 + shift))));
  let v = p.pico * L;
  const pl = p.plat + shift;
  if (w > pl) v -= p.dec * (w - pl);
  return Math.max(0, v);
}
function ewStd(p, w, shift = 0) {
  const t = Math.max(0, w - (p.w50 + shift));
  return p.ewMax - (p.ewMax - p.ew0) * Math.exp(-p.ewc * t);
}
function consumoPostura(g, w) {
  const p = g.postura, f = g.cria.factor;
  if (w < 18) return CONSUMO_RECRIA[Math.min(17, Math.max(0, Math.floor(w)))] * f;
  const ini = 82 * f, finRampa = p.w50 + 4;
  if (w >= finRampa) return p.cons;
  return ini + (p.cons - ini) * (w - 18) / (finRampa - 18);
}
const pesoStd = (c, d) => interp(c.dias, c.peso, d);
const caStd = (c, d) => interp(c.dias, c.ca, d);
const consAcumStd = (c, d) => pesoStd(c, d) * caStd(c, d);
const consumoCarne = (c, d) => Math.max(5, consAcumStd(c, d + 1) - consAcumStd(c, d));

/* ------------------------------ Fases ------------------------------ */
function fase(g, modo, d) {
  const w = d / 7;
  if (modo === 'huevos') {
    const off = g.postura.w50 - 20.5;
    if (w < 6) return { id: 'cria', n: 'Cría', r: '0–6 semanas' };
    if (w < 12) return { id: 'crec', n: 'Crecimiento', r: '7–12 semanas' };
    if (w < 16 + off) return { id: 'des', n: 'Desarrollo', r: `13–${Math.round(16 + off)} semanas` };
    if (w < 18.5 + off) return { id: 'pre', n: 'Prepostura', r: 'hasta el 2 % de postura' };
    if (w < 45) return { id: 'p1', n: 'Postura fase 1', r: 'inicio al pico · hasta 45 sem' };
    if (w < 65) return { id: 'p2', n: 'Postura fase 2', r: '46–65 semanas' };
    return { id: 'p3', n: 'Postura fase 3', r: 'más de 65 semanas' };
  }
  if (esBroiler(g)) {
    if (d <= 10) return { id: 'pre', n: 'Preiniciación', r: '0–10 días' };
    if (d <= 22) return { id: 'ini', n: 'Inicial', r: '11–22 días' };
    if (d <= 35) return { id: 'eng', n: 'Engorde', r: '23–35 días' };
    return { id: 'fin', n: 'Finalización', r: '36 días a la venta' };
  }
  if (g.id === 'campero') {
    if (d <= 28) return { id: 'ini', n: 'Iniciación', r: '0–28 días' };
    if (d <= 56) return { id: 'crec', n: 'Crecimiento', r: '29–56 días' };
    return { id: 'fin', n: 'Acabado en semipastoreo', r: '57 días a la venta' };
  }
  if (d <= 42) return { id: 'ini', n: 'Cría', r: '0–6 semanas' };
  if (d <= 84) return { id: 'crec', n: 'Crecimiento', r: '7–12 semanas' };
  return { id: 'fin', n: 'Engorde y acabado', r: 'más de 12 semanas' };
}

/* --------------------------- Ambiente --------------------------- */
function tempRango(g, modo, d) {
  if (modo === 'carne') {
    const xs = [0, 3, 7, 14, 21, 28, 35, 42];
    if (d <= 42) return [Math.round(interp(xs, [32, 31, 29, 27, 24, 22, 20, 19], d)), Math.round(interp(xs, [33, 32, 30, 28, 26, 24, 22, 21], d))];
    return g.tipo === 'carne' && esBroiler(g) ? [18, 21] : [16, 24];
  }
  const xs = [0, 4, 7, 14, 21, 28, 35, 42];
  if (d <= 42) return [Math.round(interp(xs, [33, 31, 29, 27, 25, 23, 21, 19], d)), Math.round(interp(xs, [35, 32, 31, 29, 27, 25, 23, 21], d))];
  if (g.tipo === 'criolla' || g.tipo === 'doble') return [15, 26];
  return d < 126 ? [18, 22] : [18, 24];
}
function humedadRango(modo, d) {
  if (d <= 3) return [60, 70];
  if (d <= 14) return [55, 65];
  return modo === 'carne' ? [50, 65] : [45, 65];
}
function consumoDia(g, modo, d) {
  return modo === 'huevos' ? consumoPostura(g, d / 7) : consumoCarne(g.carne, d);
}

/* ------------------------- Alimentación ------------------------- */
function especAlimento(g, modo, ph) {
  if (modo === 'huevos') {
    const t = {
      cria: ['Iniciador de pollitas', '19–20 %', '2.850–2.950', '1,0 %', 'Harina o migaja'],
      crec: ['Crecimiento', '17–18 %', '2.800–2.900', '1,0 %', 'Harina'],
      des: ['Desarrollo', '15–16 %', '2.750–2.850', '1,0 %', 'Harina'],
      pre: ['Prepostura', '16–17 %', '2.750–2.850', '2,0–2,5 %', 'Harina'],
      p1: ['Postura fase 1', '17–18 %', '2.750–2.850', '3,9–4,2 %', 'Harina gruesa'],
      p2: ['Postura fase 2', '16–17 %', '2.700–2.800', '4,1–4,4 %', 'Harina gruesa'],
      p3: ['Postura fase 3', '15,5–16 %', '2.700–2.800', '4,3–4,6 %', 'Harina gruesa']
    }[ph.id];
    return { nombre: t[0], pc: t[1], em: t[2], ca: t[3], pres: t[4] };
  }
  if (esBroiler(g)) {
    const t = {
      pre: ['Preiniciador', '21–22 %', '2.900–3.000', 'Migaja'],
      ini: ['Inicial', '19–20 %', '2.950–3.050', 'Migaja o pellet'],
      eng: ['Engorde', '18–19 %', '3.020–3.150', 'Pellet'],
      fin: ['Finalizador', '17–18 %', '3.100–3.200', 'Pellet']
    }[ph.id];
    return { nombre: t[0], pc: t[1], em: t[2], pres: t[3] };
  }
  if (g.id === 'campero') {
    const t = {
      ini: ['Iniciador', '20–21 %', '2.900', 'Migaja'],
      crec: ['Crecimiento', '18 %', '2.950–3.000', 'Pellet'],
      fin: ['Acabado + pastoreo', '16–17 %', '3.000–3.100', 'Pellet y maíz partido']
    }[ph.id];
    return { nombre: t[0], pc: t[1], em: t[2], pres: t[3] };
  }
  const t = {
    ini: ['Iniciador', '19–20 %', '2.850', 'Harina o migaja'],
    crec: ['Crecimiento', '16–17 %', '2.800', 'Harina'],
    fin: ['Engorde + forraje', '15–16 %', '2.900', 'Harina, maíz y forraje verde']
  }[ph.id];
  return { nombre: t[0], pc: t[1], em: t[2], pres: t[3] };
}

function densidad(g, modo, d, alt) {
  if (modo === 'carne') {
    if (esBroiler(g)) return alt >= 2000 ? '8–10 aves/m²' : '10–12 aves/m²';
    return '8–10 aves/m² bajo techo + 1 m² de pastoreo por ave';
  }
  if (g.tipo === 'criolla' || g.tipo === 'doble') return '4–5 aves/m² bajo techo + 2–4 m² de pastoreo por ave';
  if (d < 126) return d < 42 ? '15–20 pollitas/m²' : '10–12 pollitas/m²';
  return 'Piso: 6–7 aves/m² · Jaula: según el fabricante';
}

function programaLuz(g, modo, d) {
  if (modo === 'carne') {
    if (d <= 7) return '23 h de luz y 1 h de oscuridad';
    return '18–20 h de luz con 4–6 h de oscuridad continua';
  }
  const w = d / 7, off = g.postura.w50 - 20.5;
  if (d <= 7) return '20–22 h de luz la primera semana';
  if (w < 16 + off) return 'Bajar a luz natural (≈12 h) y mantenerla constante';
  if (w < 18.5 + off) return 'Estimular con peso objetivo: subir a 13–14 h';
  return 'Subir 15–30 min por semana hasta 16 h y no reducir';
}

/* --------------------- Recomendaciones de manejo --------------------- */
function vacunasPara(g, modo) {
  if (modo === 'carne') return g.id === 'cobb500' || g.id === 'ross308' ? VACUNAS.carne : VACUNAS.campero;
  return g.tipo === 'criolla' ? VACUNAS.criolla : VACUNAS.postura;
}

function construirManejo(st) {
  const g = st.g, modo = st.modo, d = st.dias, alt = st.alt, aves = st.aves;
  const ph = fase(g, modo, d);
  const w = d / 7;
  const enPostura = modo === 'huevos' && w >= g.postura.w50 - 2;
  const joven = d <= 42;
  const cats = [];

  /* Alimentación */
  const esp = especAlimento(g, modo, ph);
  const cons = consumoDia(g, modo, d);
  const filasA = [['Alimento', esp.nombre], ['Proteína cruda', esp.pc], ['Energía metabolizable', esp.em + ' kcal/kg']];
  if (esp.ca) filasA.push(['Calcio', esp.ca]);
  filasA.push(['Presentación', esp.pres]);
  filasA.push(['Consumo estimado', fmt(cons, 0) + ' g/ave/día'], ['Tu lote', fmt(cons * aves / 1000, 1) + ' kg/día']);
  const itemsA = [
    { id: 'a_fase', n: `Dar balanceado de ${esp.nombre.toLowerCase()}`, det: 'Cambiar de alimento según la fase y no mezclar fórmulas de otras especies.', prod: 12, mort: 0.5, clave: true },
    { id: 'a_racion', n: 'Ración según tabla y comederos suficientes', det: modo === 'carne' ? 'Comederos de tolva: 1 cada 30–40 aves. Revisar que nunca se vacíen.' : 'Ofrecer la ración diaria de la tabla; 1 comedero de tolva cada 25–30 aves.', prod: 4, mort: 0 }
  ];
  if (enPostura) itemsA.push({ id: 'a_conchilla', n: 'Conchilla o carbonato grueso en la tarde', det: '2–4 g por ave al final del día para una cáscara firme.', prod: 3, mort: 0 });
  if (g.tipo === 'criolla' || g.tipo === 'doble' || g.id === 'campero') itemsA.push({ id: 'a_pastoreo', n: 'Pastoreo y forraje verde como complemento', det: 'Alfalfa, hojas de leguminosas o pasto tierno. El balanceado debe seguir siendo la base.', prod: 2, mort: 0 });
  if (g.tipo === 'criolla' || g.tipo === 'doble') itemsA.push({ id: 'a_grano', n: 'Limitar maíz y desperdicios a un tercio de la ración', det: 'El maíz solo aporta energía; en exceso baja la postura y engorda a la gallina.', prod: 4, mort: 0 });
  cats.push({ id: 'alim', n: 'Alimentación', icono: 'grano', filas: filasA, items: itemsA });

  /* Temperatura y ambiente */
  const [tmin, tmax] = tempRango(g, modo, d);
  const filasT = [['Temperatura a la altura de las aves', `${tmin}–${tmax} °C`], ['Programa de luz', programaLuz(g, modo, d)], ['Densidad', densidad(g, modo, d, alt)]];
  const notasT = ['Si se amontonan bajo la criadora tienen frío; si se alejan, abren las alas y jadean, tienen calor.'];
  if (alt >= 2000) notasT.push('Sobre los 2.000 m las noches bajan de 10 °C: cierra cortinas al atardecer y mantén la criadora encendida de noche en las primeras semanas.');
  const itemsT = [
    { id: 't_rango', n: `Mantener ${tmin}–${tmax} °C`, det: joven ? 'Criadora o campana, cortinas y termómetro a la altura de las aves.' : 'Manejo de cortinas según la hora del día.', prod: 6, mort: joven ? 3 : 1, clave: true },
    { id: 't_vent', n: 'Ventilación mínima y amoníaco bajo', det: 'Si el olor pica los ojos, el amoníaco pasa de 20 ppm: ventila aunque haga frío.', prod: 3, mort: 1 },
    { id: 't_luz', n: 'Cumplir el programa de luz', det: programaLuz(g, modo, d) + '.', prod: modo === 'huevos' ? (w >= 15 ? 6 : 2) : 1, mort: modo === 'carne' ? 0.5 : 0 }
  ];
  if (modo === 'carne' && esBroiler(g) && alt >= 2000) itemsT.push({ id: 't_asc', n: 'Programa contra ascitis por altura', det: 'Restricción de alimento entre los días 7 y 21 (8–10 h sin comida), alimento en harina y buena ventilación.', prod: 0, mort: 0, especial: 'ascitis' });
  cats.push({ id: 'temp', n: 'Temperatura y ambiente', icono: 'termo', filas: filasT, notas: notasT, items: itemsT });

  /* Humedad */
  const [hmin, hmax] = humedadRango(modo, d);
  cats.push({
    id: 'hum', n: 'Humedad', icono: 'gota', filas: [['Humedad relativa', `${hmin}–${hmax} %`], ['Cama', 'Viruta o cascarilla de arroz, 8–10 cm, seca y suelta']],
    notas: ['Prueba del puño: aprieta un poco de cama; si queda hecha bola, está muy húmeda.'],
    items: [
      { id: 'h_rango', n: `Mantener la humedad entre ${hmin} y ${hmax} %`, det: hmin >= 60 ? 'Los primeros días el aire seco deshidrata al pollito: humedecer el piso alrededor si hace falta.' : 'Evitar goteras y derrames de bebederos.', prod: 2, mort: 0.5 },
      { id: 'h_cama', n: 'Cama seca y suelta', det: 'Retirar las zonas apelmazadas cada semana y voltear la cama.', prod: 2, mort: 1 }
    ]
  });

  /* Agua */
  const ratio = modo === 'carne' ? 1.75 : 2.0;
  const agua = cons * ratio * (d <= 3 ? 1.2 : 1);
  cats.push({
    id: 'agua', n: 'Agua', icono: 'vaso',
    filas: [['Consumo a 21 °C', fmt(agua, 0) + ' ml/ave/día'], ['Tu lote', fmt(agua * aves / 1000, 0) + ' L/día'], ['Calidad', 'pH 6–8 · cloro libre 1–3 ppm'], ['Bebederos', modo === 'carne' ? '1 niple cada 10–12 aves o 1 de campana cada 80' : '1 niple cada 8–10 aves o 1 de campana cada 50']],
    notas: ['Por cada grado sobre 21 °C, el consumo de agua sube cerca de 6 %. Una caída brusca del consumo suele ser la primera señal de enfermedad.'],
    items: [
      { id: 'w_lib', n: 'Agua limpia y fresca a voluntad', det: 'Nunca dejar las aves sin agua; revisar mañana y tarde.', prod: 10, mort: 2, clave: true },
      { id: 'w_clor', n: 'Clorar o potabilizar el agua', det: 'Cloro libre de 1–3 ppm en el bebedero. Suspender 24 h antes y después de vacunar por el agua.', prod: 2, mort: 1 },
      { id: 'w_limp', n: 'Lavar bebederos a diario y ajustar la altura', det: 'El borde del bebedero a la altura del lomo del ave.', prod: 1, mort: 0.5 }
    ]
  });

  /* Vitaminas */
  const filasV = [];
  const itemsV = [];
  if (d <= 7) {
    filasV.push(['Llegada', 'Vitaminas A, D3, E + complejo B y electrolitos 3–5 días']);
    itemsV.push({ id: 'v_llegada', n: 'Vitaminas y electrolitos los primeros días', det: 'Del día 1 al 5 en el agua, según la etiqueta.', prod: 2, mort: 1 });
  }
  filasV.push(['Vacunaciones y cambios', 'Multivitamínico 2 días antes y 3 después']);
  itemsV.push({ id: 'v_estres', n: 'Vitaminas en vacunaciones, traslados y cambios de alimento', det: 'Reduce la caída de consumo por estrés.', prod: 2, mort: 0.5 });
  filasV.push(['Calor', 'Vitamina C y electrolitos en días calurosos']);
  if (modo === 'huevos' && w >= 14 && w < g.postura.w50 + 1) {
    filasV.push(['Prepostura', 'Vitamina AD3E 3 días + calcio de prepostura']);
    itemsV.push({ id: 'v_pre', n: 'Vitamina AD3E en la prepostura', det: 'Ayuda a formar el hueso medular que aporta calcio a la cáscara.', prod: 2, mort: 0 });
  }
  if (modo === 'carne' && esBroiler(g) && alt >= 2000) {
    itemsV.push({ id: 'v_alt', n: 'Vitaminas C y E en zonas altas', det: 'Apoyo antioxidante contra la ascitis, 3 días por semana desde el día 10.', prod: 1, mort: 1 });
  }
  cats.push({ id: 'vit', n: 'Vitaminas', icono: 'capsula', filas: filasV, notas: ['El balanceado comercial ya trae vitaminas y minerales. En el agua solo se dan en momentos de estrés.'], items: itemsV });

  /* Vacunas */
  const vac = vacunasPara(g, modo);
  const dFin = st.dFin;
  const itemsVac = vac.filter(v => v.d <= dFin || (v.repite && dFin >= v.d)).map(v => {
    let estado = 'proxima';
    if (v.repite && d >= v.d) estado = 'vigente';
    else if (v.d < d - 3) estado = 'pasada';
    else if (v.d <= d + 7) estado = 'ahora';
    return { id: v.id, n: v.n, det: v.via, edad: v.d, estado, prod: v.w * 1.2, mort: v.w * 1.6, vacuna: true };
  });
  cats.push({ id: 'vac', n: 'Vacunas', icono: 'jeringa', items: itemsVac, notas: ['Calendario de referencia. Ajústalo con tu médico veterinario según las enfermedades de tu zona. La vacuna contra influenza aviar solo se aplica dentro de los programas de Agrocalidad.'] });

  /* Control sanitario */
  const itemsS = [
    { id: 's_bio', n: 'Bioseguridad', det: 'Pediluvio con desinfectante, ropa y botas solo para el galpón, sin visitas ni aves de otros lugares.', prod: 3, mort: 2, clave: true },
    { id: 's_limp', n: d <= 7 ? 'Limpieza, desinfección y vacío sanitario' : 'Retirar la mortalidad a diario', det: d <= 7 ? 'Lavar, desinfectar y dejar el galpón vacío 15–21 días antes de recibir el lote.' : 'Enterrar o compostar las aves muertas lejos del galpón.', prod: 2, mort: 1 },
    { id: 's_roed', n: 'Control de roedores, moscas y aves silvestres', det: 'Mallas en ventanas, cebos en estaciones cerradas y alimento tapado.', prod: 1, mort: 1 },
    { id: 's_reg', n: 'Registro diario', det: modo === 'huevos' && enPostura ? 'Huevos recogidos, alimento, agua y mortalidad del día.' : 'Alimento, agua, mortalidad y peso semanal de 1 de cada 20 aves.', prod: 2, mort: 0 }
  ];
  if (modo === 'huevos' && d >= 42) itemsS.push({ id: 's_desp', n: 'Desparasitación programada', det: 'A las 8 y 16 semanas y luego cada 3–4 meses en aves de piso o pastoreo.', prod: 3, mort: 0.5 });
  if (modo === 'carne' && !esBroiler(g) && d >= 28) itemsS.push({ id: 's_desp', n: 'Desparasitación al salir a pastoreo', det: 'Una dosis al iniciar el pastoreo y otra a los 2 meses.', prod: 3, mort: 0.5 });
  if (d < 126 || modo === 'carne') itemsS.push({ id: 's_peso', n: 'Pesaje semanal y uniformidad', det: 'Pesar 1 de cada 20 aves; meta de uniformidad sobre 80 %.', prod: 2, mort: 0 });
  cats.push({ id: 'san', n: 'Control sanitario', icono: 'escudo', items: itemsS });

  /* Sanidad actual: remedios caseros y control químico */
  const enfDisp = ENFERMEDADES.filter(e => e.modos.includes(modo));
  cats.push({ id: 'casero', n: 'Remedios caseros', icono: 'hoja', sanidad: true, enfermedades: enfDisp });
  cats.push({ id: 'quim', n: 'Control químico', icono: 'matraz', sanidad: true, enfermedades: enfDisp });

  return { fase: ph, cats };
}

/* ----------------------- Factores de manejo ----------------------- */
function factores(st, manejo, sel) {
  const g = st.g, modo = st.modo;
  let f = 1, mortExtra = 0, pesoTot = 0, pesoCub = 0;
  const faltan = [];
  for (const c of manejo.cats) {
    if (!c.items) continue;
    for (const it of c.items) {
      if (it.especial) continue;
      const peso = it.prod + 1.5 * it.mort;
      pesoTot += peso;
      if (sel.has(it.id)) { pesoCub += peso; continue; }
      f *= 1 - it.prod / 100;
      mortExtra += it.mort;
      faltan.push({ id: it.id, n: it.n, cat: c.n });
    }
  }
  // Problema sanitario
  const enf = ENFERMEDADES.find(e => e.id === st.enf);
  let mit = 0;
  if (enf) {
    let resto = 1;
    for (const t of [...enf.caseros, ...enf.quimicos]) if (sel.has(t.id)) resto *= 1 - t.mit;
    mit = Math.min(0.9, 1 - resto);
    f *= 1 - enf.prod * (1 - mit) / 100;
    mortExtra += enf.mort * (1 - mit);
    const peso = enf.prod + 1.5 * enf.mort;
    pesoTot += peso; pesoCub += peso * mit;
  } else {
    let bono = 0;
    for (const p of PREVENTIVOS_CASEROS) if (sel.has(p.id)) bono += p.prod;
    f *= 1 + Math.min(1, bono) / 100;
  }
  // Altitud
  let altPeso = 0, altMort = 0;
  if (modo === 'carne' && st.alt > 1500) {
    const broiler = esBroiler(g);
    altPeso = (st.alt - 1500) / 1000 * (broiler ? 6 : 2);
    altMort = st.alt > 2000 ? (st.alt - 2000) / 1000 * (broiler ? 6 : 1.5) : 0;
    if (sel.has('t_asc')) { altMort *= 0.4; altPeso += 1; }
  } else if (modo === 'huevos' && st.alt > 2000) {
    altPeso = (st.alt - 2000) / 1000 * 1.5;
  }
  f *= 1 - altPeso / 100;
  mortExtra += altMort;
  f = clamp(f, 0.3, 1.02);
  // Retraso del inicio de postura por mala recría
  let shift = 0;
  if (modo === 'huevos' && st.dias / 7 < g.postura.w50 - 2) shift = (1 - f) * 5;
  const indice = pesoTot ? Math.round(100 * pesoCub / pesoTot) : 100;
  return { f, mortExtra, shift, indice, enf, mit, altPeso, altMort, faltan };
}

/* ---------------------------- Simulaciones ---------------------------- */
function simHuevos(st, F) {
  const g = st.g, p = g.postura;
  const fObj = F.f * (g.campo || 1);
  const d0 = st.dias, dFin = st.dFin;
  const w0 = d0 / 7;
  let f0 = fObj;
  const std0 = hdStd(p, w0, F.shift);
  if (st.real != null && std0 > 10) f0 = clamp(st.real / std0, 0.1, 1.15);
  const dias = Math.max(1, dFin - d0);
  const extraDia = (F.mortExtra / 100) * Math.min(1, dias / 300) / dias;
  let vivas = st.aves, huevos = 0, masa = 0, alimento = 0, alimRecria = 0;
  let pico = 0, wPico = 0, w50 = null;
  const serie = [];
  for (let d = d0; d < dFin; d++) {
    const w = (d + 0.5) / 7, t = d - d0;
    const fh = fObj + (f0 - fObj) * Math.exp(-t / 28);
    const hd = hdStd(p, w, F.shift) * fh;
    if (hd > pico) { pico = hd; wPico = w; }
    if (w50 === null && hd >= 50) w50 = w;
    const e = vivas * hd / 100;
    huevos += e;
    masa += e * ewStd(p, w, F.shift) * (1 - (1 - fh) * 0.25);
    const kg = vivas * consumoPostura(g, w) * (0.97 + 0.03 * fh) / 1000;
    alimento += kg;
    if (w < 18) alimRecria += kg;
    const mBase = d < 126 ? (1 - g.cria.viab / 100) / 126 : p.m / 7;
    vivas *= 1 - mBase - extraDia;
    if ((d - d0) % 7 === 0) serie.push({ w: d / 7, hd });
  }
  const est = [];
  for (let w = Math.max(16, Math.floor(w0) - 2); w <= dFin / 7; w++) est.push({ w, hd: hdStd(p, w) });
  const hdHoy = hdStd(p, w0 + 0.5 / 7, F.shift) * f0;
  return {
    tipo: 'huevos', huevos, huevosAve: huevos / st.aves, masaKg: masa / 1000, alimento, alimRecria,
    pesoHuevo: huevos ? masa / huevos : 0, conversion: masa ? (alimento - alimRecria) / (masa / 1000) : 0,
    kgDocena: huevos ? (alimento - alimRecria) / (huevos / 12) : 0, cubetas: huevos / 30,
    vivasFin: vivas, viab: 100 * vivas / st.aves, pico, wPico, w50, hdHoy, serie, est
  };
}

function simCarne(st, F) {
  const g = st.g, c = g.carne;
  const fObj = F.f * (g.campo || 1);
  const d0 = st.dias, dFin = st.dFin;
  const fPasado = 1 - (1 - fObj) * Math.min(1, d0 / 14);
  let peso = st.real != null && st.real > 0 ? st.real : pesoStd(c, d0) * fPasado;
  const peso0 = peso;
  const dias = Math.max(1, dFin - d0);
  const mBaseDia = c.mortBase / 100 / c.ciclo;
  const extraDia = (F.mortExtra / 100) * Math.min(1, dias / c.ciclo) / dias;
  let vivas = st.aves, alimento = 0, avesDia = 0;
  const desperdicio = 1 + (1 - F.f) * 0.35;
  const serie = [{ d: d0, p: peso }];
  for (let d = d0; d < dFin; d++) {
    const ratio = peso / pesoStd(c, d);
    const gan = (pesoStd(c, d + 1) - pesoStd(c, d)) * fObj * Math.pow(clamp(ratio, 0.4, 1.3), 0.3);
    alimento += vivas * consumoCarne(c, d) * Math.pow(clamp(ratio, 0.4, 1.3), 0.75) * desperdicio / 1000;
    avesDia += vivas;
    peso += gan;
    vivas *= 1 - mBaseDia - extraDia;
    serie.push({ d: d + 1, p: peso });
  }
  const avesProm = avesDia / dias;
  const alimAve = alimento / avesProm;
  const previo = consAcumStd(c, d0) * Math.pow(clamp(peso0 / pesoStd(c, d0), 0.4, 1.3), 0.75) / 1000;
  const caAcum = (previo + alimAve) / (peso / 1000);
  const caPeriodo = alimAve / Math.max(0.01, (peso - peso0) / 1000);
  const viabPrev = 1 - c.mortBase / 100 * Math.min(1, d0 / c.ciclo);
  const viab = 100 * viabPrev * vivas / st.aves;
  const kgVivo = vivas * peso / 1000;
  const iep = dFin > 0 ? (viab * (peso / 1000)) / (dFin * caAcum) * 100 : 0;
  const est = [];
  const dMax = Math.max(dFin, c.venta);
  for (let d = 0; d <= dMax; d += 1) est.push({ d, p: pesoStd(c, d) });
  return {
    tipo: 'carne', pesoFin: peso, pesoStdFin: pesoStd(c, dFin), peso0, kgVivo, kgCanal: kgVivo * c.rend / 100,
    alimento, caAcum, caPeriodo, vivasFin: vivas, viab, iep, serie, est
  };
}

function proyectar(st, manejo, sel) {
  const F = factores(st, manejo, sel);
  const r = st.modo === 'huevos' ? simHuevos(st, F) : simCarne(st, F);
  r.F = F;
  return r;
}

/* Cuánto gana el lote si agrega cada práctica que falta */
function brechas(st, manejo, sel, base) {
  const out = [];
  const valor = r => r.tipo === 'huevos' ? r.huevos : r.kgVivo;
  const v0 = valor(base);
  for (const fz of base.F.faltan) {
    const s2 = new Set(sel); s2.add(fz.id);
    const v = valor(proyectar(st, manejo, s2));
    if (v - v0 > 0.0005 * Math.max(1, v0)) out.push({ ...fz, gana: v - v0 });
  }
  return out.sort((a, b) => b.gana - a.gana);
}

/* ------------------------------ Formato ------------------------------ */
function fmt(x, dec = 0) {
  if (!isFinite(x)) return '—';
  return x.toLocaleString('es-EC', { minimumFractionDigits: dec, maximumFractionDigits: dec });
}

if (typeof module !== 'undefined') module.exports = { hdStd, ewStd, consumoPostura, pesoStd, caStd, construirManejo, factores, proyectar, brechas, simHuevos, simCarne, modoDe, fase, fmt };
