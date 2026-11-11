/* =========================================================================
   APPOLLO · Servicio Plan (plan del ciclo): operaciones sobre planTareas con Deshacer.
   Script plano: define el global Plan. Todas las operaciones son async. Fechas locales 'YYYY-MM-DD'.
   Las escrituras se encolan (una a la vez) para que dos llamadas seguidas no dupliquen filas.
   Operaciones de escritura sobre un lote cerrado -> {mensaje:'El lote está cerrado'} sin tocar nada.
   Las que se pueden deshacer devuelven una función async que restaura las filas previas.
   ========================================================================= */
const Plan = (function () {
  'use strict';
  const CERRADO = { mensaje: 'El lote está cerrado' };
  const copia = o => JSON.parse(JSON.stringify(o));
  const masDias = (f, n) => { const d = fechaADate(f); d.setDate(d.getDate() + n); return hoyLocal(d); };
  const no = mensaje => ({ mensaje });
  const cerrado = l => !l || l.estado === 'cerrado';
  const ahora = () => new Date().toISOString();

  let cola = Promise.resolve();
  const serie = fn => { const p = cola.then(fn); cola = p.catch(() => { /* la cola sigue */ }); return p; };

  const fechaBaseDe = lote => masDias(lote.fechaLlegada, -(Number(lote.edadLlegadaDias) || 0));

  function filaCatalogo(lote, t) {
    const f = { loteId: lote.id, origen: 'catalogo', catalogoId: t.id, categoria: t.categoria, titulo: t.titulo, detalle: t.detalle || '',
      desdeDia: t.desdeDia, fechaBase: fechaBaseDe(lote), estado: 'activa', hechas: [], creado: ahora() };
    if (t.cadaDias != null) f.cadaDias = t.cadaDias;
    if (t.hastaDia != null) f.hastaDia = t.hastaDia;
    if (t.quimico) f.quimico = copia(t.quimico); // copia: el retiro sigue valiendo aunque cambie el catálogo
    return f;
  }

  /* Carga la fila y su lote; devuelve {t, lote} o {mensaje}. */
  async function cargar(tareaId) {
    const t = await DB.obtener('planTareas', tareaId);
    if (!t) return no('La tarea ya no existe');
    const lote = await DB.obtener('lotes', t.loteId);
    if (!lote) return no('El lote ya no existe');
    if (cerrado(lote)) return CERRADO;
    return { t, lote };
  }
  const restaurar = previo => async () => { await DB.guardar('planTareas', previo); };

  const listar = loteId => DB.listar('planTareas', { loteId });

  function crearInicial(lote, genetica, modo, ids) {
    return serie(async () => {
      if (cerrado(lote)) return CERRADO;
      const quiere = new Set(Array.isArray(ids) ? ids : []), edad = edadDias(lote, hoyLocal()), out = [];
      const existentes = await listar(lote.id);
      for (const t of tareasDelCatalogo(genetica, modo)) {
        if (!quiere.has(t.id)) continue;
        if (t.hastaDia != null && t.hastaDia < edad) continue;
        if (existentes.some(e => e.catalogoId === t.id)) continue;
        out.push(await DB.guardar('planTareas', filaCatalogo(lote, t)));
      }
      return out;
    });
  }

  function agregarCatalogo(lote, catalogoId) {
    return serie(async () => {
      if (cerrado(lote)) return CERRADO;
      const t = CATALOGO.find(x => x.id === catalogoId);
      if (!t) return no('Esa tarea no existe en el catálogo');
      const previa = (await listar(lote.id)).find(f => f.catalogoId === catalogoId);
      if (previa) {
        if (previa.estado === 'activa') return previa;
        const f = Object.assign({}, previa, { estado: 'activa' });
        delete f.quitadaEn;
        return DB.guardar('planTareas', f);
      }
      return DB.guardar('planTareas', filaCatalogo(lote, t));
    });
  }

  function agregarPropia(lote, datos) {
    return serie(async () => {
      if (cerrado(lote)) return CERRADO;
      const v = validarTareaPropia(datos);
      if (v.mensaje) return v;
      const f = Object.assign({ loteId: lote.id, estado: 'activa', hechas: [], creado: ahora() }, v.tarea);
      return { tarea: await DB.guardar('planTareas', f) };
    });
  }

  function cambiarEstado(tareaId, quitar) {
    return serie(async () => {
      const c = await cargar(tareaId);
      if (c.mensaje) return c;
      const previo = copia(c.t), f = copia(c.t);
      if (quitar) { f.estado = 'quitada'; f.quitadaEn = ahora(); } else { f.estado = 'activa'; delete f.quitadaEn; }
      await DB.guardar('planTareas', f);
      return restaurar(previo);
    });
  }
  const quitar = id => cambiarEstado(id, true);
  const reactivar = id => cambiarEstado(id, false);

  function marcarHecha(tareaId, opciones) {
    return serie(async () => {
      const c = await cargar(tareaId);
      if (c.mensaje) return c;
      const o = opciones || {}, fecha = o.fecha === undefined || o.fecha === null || o.fecha === '' ? hoyLocal() : o.fecha;
      if (c.t.estado === 'quitada') return no('La tarea está quitada: reactívala primero');
      const datos = { tareaId: c.t.id, titulo: c.t.titulo };
      const producto = typeof o.producto === 'string' ? o.producto.trim() : '';
      if (producto) datos.producto = producto;
      const v = validarRegistro('plan', datos, c.lote, [], fecha);
      if (!v.ok) return no(v.mensaje);
      const previo = copia(c.t), f = copia(c.t);
      const h = { fecha };
      const nota = typeof o.nota === 'string' ? o.nota.trim() : '';
      if (nota) h.nota = nota;
      if (producto) h.producto = producto;
      f.hechas = (f.hechas || []).concat([h]);
      delete f.proxima; // la fecha movida ya cumplió su papel
      let reg = null;
      try {
        reg = await DB.guardar('registros', { loteId: c.t.loteId, fecha, tipo: 'plan', datos, creado: ahora() });
        await DB.guardar('planTareas', f);
      } catch (e) {
        if (reg) { try { await DB.borrar('registros', reg.id); } catch (x) { /* sigue */ } }
        throw e;
      }
      return async () => { await DB.borrar('registros', reg.id); await DB.guardar('planTareas', previo); };
    });
  }

  function mover(tareaId, nuevaFecha) {
    return serie(async () => {
      const c = await cargar(tareaId);
      if (c.mensaje) return c;
      if (!fechaValida(nuevaFecha)) return no('La fecha no es válida');
      const previo = copia(c.t), f = copia(c.t);
      f.fechaBase = masDias(nuevaFecha, -(Number(f.desdeDia) || 0));
      if (Number(f.cadaDias) > 0) f.proxima = nuevaFecha; // las repetitivas con hechas se rigen por `proxima`
      await DB.guardar('planTareas', f);
      return restaurar(previo);
    });
  }

  function borrarDeLote(loteId) {
    return serie(async () => {
      for (const f of await listar(loteId)) await DB.borrar('planTareas', f.id);
    });
  }

  return { crearInicial, agregarCatalogo, agregarPropia, quitar, reactivar, marcarHecha, mover, listar, borrarDeLote };
})();
