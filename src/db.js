/* =========================================================================
   APPOLLO · Persistencia (IndexedDB con respaldo en memoria)
   Script plano: define el global DB. Todas las operaciones devuelven Promise.
   ========================================================================= */
const DB = (function () {
  'use strict';
  const NOMBRE = 'appollo', VERSION = 1;
  const STORES = ['granja', 'lotes', 'registros', 'inventario', 'vacunasPlan'];
  const K_V1 = 'appollo.v1.lotes', K_MIGRADO = 'appollo.v2.migrado';
  let impl = null, abriendo = null;

  const nuevoId = () => {
    try { if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID(); } catch (e) { /* sigue */ }
    return Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 6);
  };
  const lsGet = k => { try { return localStorage.getItem(k); } catch (e) { return null; } };
  const lsSet = (k, v) => { try { localStorage.setItem(k, v); return true; } catch (e) { return false; } };
  const copia = o => JSON.parse(JSON.stringify(o));
  const coincide = (obj, filtro) => {
    if (!filtro) return true;
    if (typeof filtro === 'function') return !!filtro(obj);
    return Object.keys(filtro).every(k => obj[k] === filtro[k]);
  };
  const exigeStore = s => { if (!STORES.includes(s)) throw new Error('Almacén desconocido: ' + s); };

  /* ---------------------------- IndexedDB ---------------------------- */
  const pedido = r => new Promise((ok, mal) => { r.onsuccess = () => ok(r.result); r.onerror = () => mal(r.error || new Error('Error de IndexedDB')); });
  const transaccion = tx => new Promise((ok, mal) => {
    tx.oncomplete = () => ok();
    tx.onerror = () => mal(tx.error || new Error('Error de IndexedDB'));
    tx.onabort = () => mal(tx.error || new Error('Transacción cancelada'));
  });

  function abrirIDB() {
    return new Promise((ok, mal) => {
      let req;
      try { req = indexedDB.open(NOMBRE, VERSION); } catch (e) { mal(e); return; }
      req.onupgradeneeded = () => {
        const db = req.result;
        STORES.forEach(s => {
          const st = db.createObjectStore(s, { keyPath: 'id' });
          if (s === 'registros') st.createIndex('loteId+fecha', ['loteId', 'fecha']);
          if (s === 'vacunasPlan') st.createIndex('loteId', 'loteId');
        });
      };
      req.onsuccess = () => ok(req.result);
      req.onerror = () => mal(req.error || new Error('No se pudo abrir IndexedDB'));
      req.onblocked = () => mal(new Error('IndexedDB bloqueada'));
    }).then(db => ({
      modo: 'indexeddb',
      async todos(s) { return pedido(db.transaction(s).objectStore(s).getAll()); },
      async uno(s, id) { return pedido(db.transaction(s).objectStore(s).get(id)); },
      async poner(s, o) { const tx = db.transaction(s, 'readwrite'); tx.objectStore(s).put(o); await transaccion(tx); },
      async quitar(s, id) { const tx = db.transaction(s, 'readwrite'); tx.objectStore(s).delete(id); await transaccion(tx); },
      async reemplazar(datos) {
        const tx = db.transaction(STORES, 'readwrite');
        const fin = transaccion(tx);
        try {
          STORES.forEach(s => { const st = tx.objectStore(s); st.clear(); (datos[s] || []).forEach(o => st.put(o)); });
        } catch (e) {
          try { tx.abort(); } catch (x) { /* ya cerrada */ }
          try { await fin; } catch (x) { /* abortada */ }
          throw e;
        }
        await fin;
      }
    }));
  }

  /* ----------------------------- Memoria ----------------------------- */
  function abrirMemoria() {
    const m = {};
    STORES.forEach(s => { m[s] = new Map(); });
    return {
      modo: 'memoria',
      async todos(s) { return Array.from(m[s].values()).map(copia); },
      async uno(s, id) { return m[s].has(id) ? copia(m[s].get(id)) : undefined; },
      async poner(s, o) { m[s].set(o.id, copia(o)); },
      async quitar(s, id) { m[s].delete(id); },
      async reemplazar(datos) { STORES.forEach(s => { m[s] = new Map((datos[s] || []).map(o => [o.id, copia(o)])); }); }
    };
  }

  /* ------------------------------ API ------------------------------ */
  function abrir() {
    if (impl) return Promise.resolve({ modo: impl.modo });
    if (!abriendo) {
      abriendo = (typeof indexedDB === 'undefined' || !indexedDB ? Promise.reject(new Error('Sin IndexedDB')) : abrirIDB())
        .catch(() => abrirMemoria())
        .then(i => { impl = i; return { modo: i.modo }; });
    }
    return abriendo;
  }
  const lista = async () => { await abrir(); return impl; };

  async function listar(store, filtro) {
    exigeStore(store);
    const todos = await (await lista()).todos(store);
    return filtro ? todos.filter(o => coincide(o, filtro)) : todos;
  }
  async function obtener(store, id) { exigeStore(store); return (await lista()).uno(store, id); }
  async function guardar(store, obj) {
    exigeStore(store);
    const o = Object.assign({}, obj);
    if (o.id === undefined || o.id === null || o.id === '') o.id = nuevoId();
    await (await lista()).poner(store, o);
    return o;
  }
  async function borrar(store, id) { exigeStore(store); await (await lista()).quitar(store, id); }

  async function exportar() {
    const i = await lista(), datos = {};
    for (const s of STORES) datos[s] = await i.todos(s);
    return JSON.stringify({ version: 1, exportado: new Date().toISOString(), datos });
  }

  const idValido = id => (typeof id === 'string' && id !== '') || (typeof id === 'number' && isFinite(id));

  function validar(texto) {
    let j;
    try { j = JSON.parse(texto); } catch (e) { return { error: 'El archivo no es un respaldo válido: no se pudo leer el JSON.' }; }
    if (!j || typeof j !== 'object' || Array.isArray(j)) return { error: 'El respaldo no tiene el formato esperado.' };
    if (j.version !== 1) return { error: 'Versión de respaldo no compatible (se esperaba la versión 1).' };
    if (!j.datos || typeof j.datos !== 'object' || Array.isArray(j.datos)) return { error: 'El respaldo no contiene la sección de datos.' };
    for (const k of Object.keys(j.datos)) {
      if (!STORES.includes(k)) return { error: 'El respaldo contiene datos desconocidos: ' + k + '.' };
      if (!Array.isArray(j.datos[k])) return { error: 'Los datos de "' + k + '" deben ser una lista.' };
      if (!j.datos[k].every(o => o && typeof o === 'object' && !Array.isArray(o) && idValido(o.id)))
        return { error: 'Hay registros inválidos en "' + k + '" (cada uno debe tener un id de texto o número).' };
    }
    return { datos: j.datos };
  }

  async function importar(texto) {
    const v = validar(texto);
    if (v.error) return { ok: false, error: v.error };
    try { await (await lista()).reemplazar(v.datos); } catch (e) { return { ok: false, error: 'No se pudo guardar el respaldo en este dispositivo.' }; }
    return { ok: true };
  }

  async function migrarLS() {
    await abrir();
    if (lsGet(K_MIGRADO)) return 0;
    const crudo = lsGet(K_V1);
    let viejos = [];
    try { const p = crudo ? JSON.parse(crudo) : []; viejos = Array.isArray(p) ? p : []; } catch (e) { viejos = []; }
    let n = 0;
    for (const e of viejos) {
      if (!e || typeof e !== 'object') continue;
      const est = e.estado && typeof e.estado === 'object' ? e.estado : {};
      const gid = est.gid || e.gid || e.genetica || null;
      const aves = Number(est.aves !== undefined ? est.aves : (e.avesInicio !== undefined ? e.avesInicio : e.aves));
      let gNombre = gid;
      try { const g = typeof GENETICAS !== 'undefined' && GENETICAS.find(x => x.id === gid); if (g) gNombre = g.nombre; } catch (x) { /* sin catálogo */ }
      const fecha = typeof e.fecha === 'string' ? e.fecha.slice(0, 10) : '';
      // Fecha de llegada siempre válida: si la entrada vieja no trae una, se usa hoy (nunca null).
      const llegada = typeof fechaValida === 'function' && fechaValida(fecha) ? fecha : (typeof hoyLocal === 'function' ? hoyLocal() : new Date().toISOString().slice(0, 10));
      const nombre = [gNombre || 'Lote anterior', fecha].filter(Boolean).join(' · ');
      await guardar('lotes', {
        id: 'ls-' + (e.id !== undefined ? e.id : nuevoId()),
        nombre, genetica: gid, avesInicio: isFinite(aves) ? aves : 0,
        fechaLlegada: llegada, edadLlegadaDias: 0, estado: 'cerrado', origen: 'v1', resumen: e.resumen || ''
      });
      n++;
    }
    // En modo memoria los datos no persisten: no se marca la migración para reintentarla tras recargar.
    if (impl && impl.modo === 'indexeddb') lsSet(K_MIGRADO, '1');
    return n;
  }

  return { abrir, listar, obtener, guardar, borrar, exportar, importar, migrarLS, STORES };
})();
