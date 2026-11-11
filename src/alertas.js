/* =========================================================================
   APPOLLO · Reglas de alerta (puras: sin DOM, sin almacenamiento)
   Cada regla devuelve Alerta[]; generarAlertas las compone y ordena.
   Alerta{id, tipo, gravedad:'rojo'|'ambar'|'info', loteId?, texto, accion:{etiqueta, ruta}}
   ========================================================================= */

function _sumaDias(fecha, n) {
  const d = fechaADate(fecha);
  d.setDate(d.getDate() + n);
  return hoyLocal(d);
}
/* Número con coma decimal (formatoNumero vive en la interfaz; en pruebas sin DOM se usa un equivalente). */
const _num = (x, d) => (typeof formatoNumero === 'function' ? formatoNumero(x, d) : (d === undefined ? String(x) : Number(x).toFixed(d)).replace('.', ','));
const _rutaLote = l => '#/lote/' + l.id;
const _activos = lotes => lotes.filter(l => l.estado === 'activo');

function alertaVacunas(datos, hoy) {
  const out = [], manana = _sumaDias(hoy, 1);
  const activos = new Map(_activos(datos.lotes).map(l => [l.id, l]));
  for (const v of datos.vacunasPlan || []) {
    const l = activos.get(v.loteId);
    if (!l || v.fechaAplicada) continue;
    let gravedad = null, cuando = '';
    if (v.fechaPrevista < hoy) { gravedad = 'rojo'; cuando = 'vencida (' + v.fechaPrevista + ')'; }
    else if (v.fechaPrevista === hoy) { gravedad = 'ambar'; cuando = 'es hoy'; }
    else if (v.fechaPrevista === manana) { gravedad = 'ambar'; cuando = 'es mañana'; }
    if (!gravedad) continue;
    out.push({ id: 'vacuna-' + v.id, tipo: 'vacuna', gravedad, loteId: l.id,
      texto: 'Vacuna ' + v.nombre + ' · ' + l.nombre + ': ' + cuando,
      accion: { etiqueta: 'Ver lote', ruta: _rutaLote(l) } });
  }
  return out;
}

function alertaMortalidad(datos, hoy) {
  const out = [];
  for (const l of _activos(datos.lotes)) {
    if (!GENETICAS.some(g => g.id === l.genetica)) continue; // genética desconocida (respaldo manipulado, lote migrado): sin estándar, sin alerta
    const muertes = datos.registros.filter(r => r.loteId === l.id && r.tipo === 'mortalidad' && r.fecha === hoy)
      .reduce((s, r) => s + (Number(r.datos && r.datos.cantidad) || 0), 0);
    if (!muertes) continue;
    const base = avesVivas(l, datos.registros, hoy) + muertes; // aves al empezar el día
    if (!(base > 0)) continue;
    const esp = estandarDia(l, hoy, undefined).mortEsperada;
    const pct = 100 * muertes / base;
    if (esp > 0 && pct > 2 * esp) {
      out.push({ id: 'mortalidad-' + l.id + '-' + hoy, tipo: 'mortalidad', gravedad: 'rojo', loteId: l.id,
        texto: l.nombre + (muertes === 1 ? ': hoy murió 1 ave (' : ': hoy murieron ' + muertes + ' aves (') + _num(pct, 2) + ' %), más del doble de lo esperado',
        accion: { etiqueta: 'Ver lote', ruta: _rutaLote(l) } });
    }
  }
  return out;
}

function alertaPostura(datos, hoy) {
  const out = [];
  for (const l of _activos(datos.lotes)) {
    const prom = desde => {
      const v = [0, 1, 2].map(i => pctPostura(l, datos.registros, _sumaDias(hoy, -(desde + i)))).filter(x => x !== null);
      return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
    };
    const rec = prom(0), prev = prom(3);
    if (rec !== null && prev !== null && prev - rec > 3) {
      out.push({ id: 'postura-' + l.id + '-' + hoy, tipo: 'postura', gravedad: 'ambar', loteId: l.id,
        texto: l.nombre + ': la postura bajó ' + _num(prev - rec, 1) + ' puntos frente a los 3 días previos',
        accion: { etiqueta: 'Ver lote', ruta: _rutaLote(l) } });
    }
  }
  return out;
}

function alertaInventario(datos) {
  return (datos.inventario || [])
    .filter(i => Number(i.cantidad) < Number(i.minimo))
    .map(i => ({ id: 'inventario-' + i.id, tipo: 'inventario', gravedad: 'ambar',
      texto: i.nombre + ': quedan ' + _num(Number(i.cantidad)) + ' ' + i.unidad + ' (mínimo ' + _num(Number(i.minimo)) + ')',
      accion: { etiqueta: 'Ver inventario', ruta: '#/inventario' } }));
}

function alertaRetiro(datos, hoy) {
  const out = [], activos = new Map(_activos(datos.lotes).map(l => [l.id, l]));
  for (const r of datos.registros) {
    const dias = Number(r.datos && r.datos.retiroDias) || 0;
    const l = activos.get(r.loteId);
    if (r.tipo !== 'sanidad' || dias <= 0 || !l) continue;
    const fin = _sumaDias(r.fecha, dias);
    if (hoy <= fin) {
      out.push({ id: 'retiro-' + r.id, tipo: 'retiro', gravedad: 'rojo', loteId: l.id,
        texto: 'No vendas huevos/carne hasta ' + fin + ' · ' + l.nombre,
        accion: { etiqueta: 'Ver lote', ruta: _rutaLote(l) } });
    }
  }
  return out;
}

/* 'YYYY-MM-DD' -> 'DD/MM' (puro, sin DOM). */
const _ddmm = f => f.slice(8, 10) + '/' + f.slice(5, 7);

/* Labores del plan del ciclo: atrasada -> rojo, hoy -> ámbar, próxima en 1-7 días -> info. */
function alertaPlan(datos, hoy) {
  const out = [], activos = new Map(_activos(datos.lotes).map(l => [l.id, l]));
  for (const t of datos.planTareas || []) {
    const l = activos.get(t.loteId);
    if (!l) continue;
    const est = estadoTarea(t, hoy);
    if (est !== 'atrasada' && est !== 'hoy' && est !== 'proxima') continue;
    const f = proximaFecha(t, hoy);
    if (!f) continue;
    let gravedad, cuando;
    if (est === 'atrasada') { gravedad = 'rojo'; cuando = 'atrasada desde ' + _ddmm(f); }
    else if (est === 'hoy') { gravedad = 'ambar'; cuando = 'hoy'; }
    else if (f <= _sumaDias(hoy, 7)) { gravedad = 'info'; cuando = 'el ' + _ddmm(f); }
    else continue;
    out.push({ id: 'plan-' + t.id, tipo: 'plan', gravedad, loteId: l.id,
      texto: 'Labor · ' + l.nombre + ': ' + t.titulo + ' (' + cuando + ')',
      accion: { etiqueta: 'Ver plan', ruta: _rutaLote(l) } });
  }
  return out;
}

/* Retiro vigente por aplicaciones químicas del plan (también de tareas quitadas): una alerta por lote y tipo. */
function alertaRetiroPlan(datos, hoy) {
  const out = [], tareas = datos.planTareas || [];
  for (const l of _activos(datos.lotes)) {
    const r = retiroVigente(tareas.filter(t => t.loteId === l.id), [], hoy);
    for (const [campo, nombre] of [['huevo', 'huevos'], ['carne', 'carne']]) {
      if (!r[campo]) continue;
      out.push({ id: 'retiro-plan-' + campo + '-' + l.id, tipo: 'retiro', gravedad: 'rojo', loteId: l.id,
        texto: 'No vender ' + nombre + ' hasta el ' + _ddmm(r[campo]) + ' · ' + l.nombre,
        accion: { etiqueta: 'Ver plan', ruta: _rutaLote(l) } });
    }
  }
  return out;
}

function alertaSinRegistro(datos, hoy, ahora) {
  if (ahora.getHours() < 18) return [];
  return _activos(datos.lotes)
    .filter(l => !datos.registros.some(r => r.loteId === l.id && r.fecha === hoy))
    .map(l => ({ id: 'sin-registro-' + l.id + '-' + hoy, tipo: 'sin-registro', gravedad: 'info', loteId: l.id,
      texto: l.nombre + ': aún no hay registros de hoy',
      accion: { etiqueta: 'Registrar', ruta: _rutaLote(l) } }));
}

/* Avisa si la fase de alimento cambia hoy o en los próximos 7 días. */
function alertaCambioAlimento(datos, hoy) {
  const out = [];
  for (const l of _activos(datos.lotes)) {
    const g = GENETICAS.find(x => x.id === l.genetica);
    if (!g) continue;
    const modo = modoDe(g), d = edadDias(l, hoy);
    for (let k = 0; k <= 7; k++) {
      const antes = fase(g, modo, d + k - 1), despues = fase(g, modo, d + k);
      if (antes.id !== despues.id) {
        const cuando = k === 0 ? 'hoy' : k === 1 ? 'mañana' : 'en ' + k + ' días';
        out.push({ id: 'fase-' + l.id + '-' + despues.id, tipo: 'fase', gravedad: 'info', loteId: l.id,
          texto: l.nombre + ': ' + cuando + ' pasa a la fase "' + despues.n + '" de alimento',
          accion: { etiqueta: 'Ver lote', ruta: _rutaLote(l) } });
        break;
      }
    }
  }
  return out;
}

function generarAlertas(datos, ahora) {
  const hoy = hoyLocal(ahora);
  const orden = { rojo: 0, ambar: 1, info: 2 };
  return [
    ...alertaVacunas(datos, hoy), ...alertaMortalidad(datos, hoy), ...alertaPostura(datos, hoy),
    ...alertaInventario(datos), ...alertaRetiro(datos, hoy), ...alertaRetiroPlan(datos, hoy), ...alertaPlan(datos, hoy), ...alertaSinRegistro(datos, hoy, ahora),
    ...alertaCambioAlimento(datos, hoy)
  ].map((a, i) => [a, i]).sort((x, y) => orden[x[0].gravedad] - orden[y[0].gravedad] || x[1] - y[1]).map(x => x[0]);
}
