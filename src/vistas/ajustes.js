/* =========================================================================
   APPOLLO · Ajustes: granja, precios, tema y respaldo de datos (exportar / importar .json).
   Granja y precios viven en el registro único del almacén 'granja' (precios: {cubeta, kgAlimento, kgPeso}).
   ========================================================================= */
var VISTAS = window.VISTAS || (window.VISTAS = {});
var ACCIONES = window.ACCIONES || (window.ACCIONES = {});

(function () {
  'use strict';
  const TIPOS = [['postura', 'Postura'], ['carne', 'Carne'], ['ambas', 'Ambas']];
  const TEMAS = [['claro', 'Claro'], ['oscuro', 'Oscuro'], ['auto', 'Automático']];
  const PRECIOS = [['cubeta', 'Precio de la cubeta de 30 huevos', 'Ej.: 3,60'], ['kgAlimento', 'Precio del kg de alimento', 'Ej.: 0,62'], ['kgPeso', 'Precio del kg de ave en pie', 'Ej.: 1,90']];
  const lsGet = k => { try { return localStorage.getItem(k); } catch (e) { return null; } };
  const lsSet = (k, v) => { try { localStorage.setItem(k, v); } catch (e) { /* sin almacenamiento */ } };
  const $v = s => document.querySelector('#view ' + s);
  let tipoSel = null, textoRespaldo = null;
  const temaActual = () => { const t = lsGet(K_TEMA); return t === 'claro' || t === 'oscuro' ? t : 'auto'; };
  const numTxt = x => (typeof x === 'number' && Number.isFinite(x) ? String(x).replace('.', ',') : '');

  function msg(id, texto, ok) {
    const p = $v('#' + id);
    if (!p) return;
    p.textContent = texto || '';
    p.hidden = !texto;
    p.classList.toggle('reg-error', !ok);
    p.classList.toggle('aj-ok', !!ok);
    if (texto && !ok) p.scrollIntoView({ block: 'nearest' });
  }

  VISTAS.ajustes = async function () {
    const g = (await DB.obtener('granja', 'granja')) || App.estado.granja || {}, pr = g.precios || {};
    tipoSel = TIPOS.some(t => t[0] === g.tipo) ? g.tipo : null;
    const tema = temaActual();
    const puedeCompartir = typeof navigator.canShare === 'function' && typeof File === 'function' && (() => {
      try { return navigator.canShare({ files: [new File(['{}'], 'a.json', { type: 'application/json' })] }); } catch (e) { return false; }
    })();
    return `<section class="pantalla ajustes">
  <h1>Ajustes</h1>
  <div class="aj-seccion"><h2>Mi granja</h2>
    <div class="reg-campo"><label class="reg-etiqueta" for="aj-nombre">Nombre de la granja</label>
      <input class="reg-texto" id="aj-nombre" type="text" maxlength="60" autocomplete="off" value="${esc(g.nombre || '')}" aria-describedby="aj-granja-msg"></div>
    <div class="reg-campo"><p class="reg-etiqueta" id="aj-tipo-et">¿Qué aves crías?</p>
      <div class="segmento" role="group" aria-labelledby="aj-tipo-et">${TIPOS.map(([id, t]) =>
        `<button type="button" class="segmento-btn" data-accion="aj-tipo" data-tipo="${id}" aria-pressed="${id === tipoSel}">${t}</button>`).join('')}</div></div>
    <p id="aj-granja-msg" role="alert" hidden></p>
    ${Boton({ texto: 'Guardar granja', icono: 'escudo', variante: 'primario', accion: 'aj-guardar-granja', clase: 'btn-ancho' })}
  </div>
  <div class="aj-seccion"><h2>Mis precios</h2>
    <p class="aj-nota">En dólares. Sirven para calcular el costo, el ingreso y el margen en Reportes.</p>
    ${PRECIOS.map(([k, et, ej]) => `<div class="reg-campo"><label class="reg-etiqueta" for="aj-p-${k}">${et}</label>
      <input class="reg-texto" id="aj-p-${k}" data-precio="${k}" type="text" inputmode="decimal" autocomplete="off" placeholder="${ej}" value="${esc(numTxt(pr[k]))}"></div>`).join('')}
    <p id="aj-precios-msg" role="alert" hidden></p>
    ${Boton({ texto: 'Guardar precios', icono: 'saco', variante: 'primario', accion: 'aj-guardar-precios', clase: 'btn-ancho' })}
  </div>
  <div class="aj-seccion"><h2>Tema</h2>
    <div class="segmento" role="group" aria-label="Tema">${TEMAS.map(([id, t]) =>
      `<button type="button" class="segmento-btn" data-accion="aj-tema" data-tema="${id}" aria-pressed="${id === tema}">${t}</button>`).join('')}</div>
  </div>
  <div class="aj-seccion"><h2>Respaldo de datos</h2>
    <p class="aj-nota">Guarda una copia de todos tus lotes y registros (en un archivo, o copiándola como texto), o recupérala en otro teléfono.</p>
    ${Boton({ texto: 'Exportar respaldo', icono: 'sig', variante: 'primario', accion: 'aj-exportar', clase: 'btn-ancho' })}
    ${puedeCompartir ? Boton({ texto: 'Compartir respaldo', icono: 'copiar', variante: 'secundario', accion: 'aj-compartir-respaldo', clase: 'btn-ancho' }) : ''}
    ${Boton({ texto: 'Importar respaldo', icono: 'atras', variante: 'secundario', accion: 'aj-importar', clase: 'btn-ancho' })}
    ${Boton({ texto: 'Pegar respaldo', icono: 'copiar', variante: 'secundario', accion: 'aj-pegar', clase: 'btn-ancho' })}
    <input class="aj-oculto" id="aj-archivo" type="file" accept=".json,application/json" tabindex="-1" aria-label="Archivo de respaldo">
    <p id="aj-respaldo-msg" role="alert" hidden></p>
  </div>
  <p class="aj-acerca">Appollo · versión ${esc(APP_VERSION)}</p>
</section>`;
  };

  function confirmarImportar() {
    App.abrirHoja({ titulo: '¿Importar respaldo?', contenido: `<div class="aj-confirmar">
  <p>Esto reemplaza todos los datos de este teléfono.</p>
  <div class="reg-pregunta-botones">${Boton({ texto: 'Cancelar', variante: 'secundario', accion: 'aj-cancelar-importar' })}${Boton({ texto: 'Reemplazar', variante: 'peligro', accion: 'aj-reemplazar' })}</div></div>` });
  }

  VISTAS.ajustes.montar = function (raiz) {
    const f = raiz.querySelector('#aj-archivo');
    if (f) f.addEventListener('change', async () => {
      const a = f.files && f.files[0];
      if (!a) return;
      try { textoRespaldo = await a.text(); } catch (e) { textoRespaldo = null; msg('aj-respaldo-msg', 'No se pudo leer el archivo.'); f.value = ''; return; }
      f.value = '';
      msg('aj-respaldo-msg', '');
      confirmarImportar();
    });
  };

  ACCIONES['aj-tipo'] = el => {
    tipoSel = el.dataset.tipo;
    document.querySelectorAll('#view [data-accion=aj-tipo]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.tipo === tipoSel)));
  };

  ACCIONES['aj-guardar-granja'] = async () => {
    const nombre = ($v('#aj-nombre').value || '').trim().slice(0, 60);
    const inp = $v('#aj-nombre');
    inp.classList.toggle('aj-campo-error', !nombre);
    if (!nombre) { msg('aj-granja-msg', 'Escribe el nombre de tu granja'); inp.focus(); return; }
    try {
      const g = await DB.guardar('granja', Object.assign({}, (await DB.obtener('granja', 'granja')) || App.estado.granja, { id: 'granja', nombre, tipo: tipoSel || '' }));
      App.estado.granja = g;
      msg('aj-granja-msg', 'Granja guardada', true);
      App.toast('Granja guardada');
    } catch (e) { msg('aj-granja-msg', 'No se pudo guardar. Intenta otra vez.'); }
  };

  ACCIONES['aj-guardar-precios'] = async () => {
    const precios = {};
    for (const inp of document.querySelectorAll('#view [data-precio]')) {
      const crudo = inp.value.trim().replace(',', '.'), k = inp.dataset.precio;
      inp.classList.remove('aj-campo-error');
      if (crudo === '') continue;
      const n = /^\d+(\.\d+)?$/.test(crudo) ? Number(crudo) : NaN;
      if (!Number.isFinite(n) || n > 100000) { inp.classList.add('aj-campo-error'); msg('aj-precios-msg', 'Escribe solo números, por ejemplo 3,60'); inp.focus(); return; }
      precios[k] = Math.round(n * 100) / 100;
    }
    try {
      const g = Object.assign({}, (await DB.obtener('granja', 'granja')) || App.estado.granja, { id: 'granja' });
      if (Object.keys(precios).length) g.precios = precios; else delete g.precios;
      App.estado.granja = await DB.guardar('granja', g);
      msg('aj-precios-msg', 'Precios guardados', true);
      App.toast('Precios guardados');
    } catch (e) { msg('aj-precios-msg', 'No se pudo guardar. Intenta otra vez.'); }
  };

  ACCIONES['aj-tema'] = async el => {
    const t = el.dataset.tema;
    if (t === 'claro' || t === 'oscuro') lsSet(K_TEMA, t); else { try { localStorage.removeItem(K_TEMA); } catch (e) { /* sin almacenamiento */ } }
    aplicarTema(t);
    document.querySelectorAll('#view [data-accion=aj-tema]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.tema === t)));
    try { App.estado.granja = await DB.guardar('granja', Object.assign({}, (await DB.obtener('granja', 'granja')) || App.estado.granja, { id: 'granja', tema: t })); } catch (e) { /* el tema ya quedó aplicado */ }
  };

  const nombreArchivo = () => `appollo-respaldo-${hoyLocal()}.json`;

  /* En el WebView de Capacitor (la app instalada) `a.download` con un blob no hace nada: ahí el respaldo se
     muestra en una hoja para copiarlo. Nunca se avisa de éxito sin que haya ocurrido. */
  const esNativo = () => { try { return !!(window.Capacitor && typeof Capacitor.isNativePlatform === 'function' && Capacitor.isNativePlatform()); } catch (e) { return false; } };

  async function copiarTexto(ta) {
    try { await navigator.clipboard.writeText(ta.value); return true; } catch (e) { /* respaldo: seleccionar y copiar */ }
    try { ta.focus(); ta.select(); ta.setSelectionRange(0, ta.value.length); return !!document.execCommand('copy'); } catch (e) { return false; }
  }

  function hojaRespaldo(json) {
    App.abrirHoja({ titulo: 'Copiar respaldo', contenido: `<div class="aj-confirmar">
  <p>Esta app no puede guardar archivos en el teléfono. Toca <b>Copiar respaldo</b> y pégalo en tus notas o envíalo a ti mismo (WhatsApp, correo). Para recuperarlo, en Ajustes usa <b>Pegar respaldo</b>.</p>
  <textarea class="reg-texto rep-texto aj-respaldo-texto" id="aj-respaldo-texto" readonly aria-label="Texto del respaldo" spellcheck="false"></textarea>
  <p id="aj-copia-msg" role="status" hidden></p>
  ${Boton({ texto: 'Copiar respaldo', icono: 'copiar', variante: 'primario', accion: 'aj-copiar-respaldo', clase: 'btn-ancho btn-grande' })}</div>` });
    const ta = document.getElementById('aj-respaldo-texto');
    if (ta) ta.value = json;
  }

  ACCIONES['aj-copiar-respaldo'] = async () => {
    const ta = document.getElementById('aj-respaldo-texto'), m = document.getElementById('aj-copia-msg');
    if (!ta || !m) return;
    const ok = await copiarTexto(ta);
    m.hidden = false;
    m.classList.toggle('aj-ok', ok); m.classList.toggle('reg-error', !ok);
    m.textContent = ok ? 'Respaldo copiado. Pégalo en tus notas o envíatelo: sin esa copia, tus datos solo viven en este teléfono.'
      : 'No se pudo copiar solo. El texto quedó seleccionado: mantén pulsado y elige Copiar.';
    if (!ok) { try { ta.focus(); ta.select(); } catch (e) { /* sin foco */ } }
  };

  ACCIONES['aj-exportar'] = async () => {
    let json;
    try { json = await DB.exportar(); } catch (e) { msg('aj-respaldo-msg', 'No se pudo crear el respaldo.'); return; }
    if (esNativo()) { msg('aj-respaldo-msg', ''); hojaRespaldo(json); return; }
    try {
      const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
      const a = document.createElement('a');
      a.href = url; a.download = nombreArchivo(); a.style.display = 'none';
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
      msg('aj-respaldo-msg', 'Respaldo descargado', true); // el clic ya se envió al navegador
      App.toast('Respaldo descargado');
    } catch (e) { msg('aj-respaldo-msg', 'No se pudo crear el respaldo.'); }
  };

  ACCIONES['aj-pegar'] = () => {
    msg('aj-respaldo-msg', '');
    App.abrirHoja({ titulo: 'Pegar respaldo', contenido: `<div class="aj-confirmar">
  <p>Pega aquí el texto del respaldo que copiaste antes.</p>
  <textarea class="reg-texto rep-texto aj-respaldo-texto" id="aj-pegado" spellcheck="false" aria-label="Texto del respaldo" aria-describedby="aj-pegado-msg"></textarea>
  <p id="aj-pegado-msg" class="reg-error" role="alert" hidden></p>
  <div class="reg-pregunta-botones">${Boton({ texto: 'Cancelar', variante: 'secundario', accion: 'aj-cancelar-importar' })}${Boton({ texto: 'Revisar', variante: 'primario', accion: 'aj-pegar-revisar' })}</div></div>` });
  };

  ACCIONES['aj-pegar-revisar'] = () => {
    const ta = document.getElementById('aj-pegado'), m = document.getElementById('aj-pegado-msg');
    const t = ta ? ta.value.trim() : '';
    if (!t) { if (m) { m.hidden = false; m.textContent = 'Pega primero el texto del respaldo.'; } if (ta) ta.focus(); return; }
    textoRespaldo = t;
    confirmarImportar();
  };

  ACCIONES['aj-compartir-respaldo'] = async () => {
    try {
      const archivo = new File([await DB.exportar()], nombreArchivo(), { type: 'application/json' });
      await navigator.share({ files: [archivo], title: 'Respaldo de Appollo' });
    } catch (e) { if (!e || e.name !== 'AbortError') msg('aj-respaldo-msg', 'No se pudo compartir. Usa "Exportar respaldo".'); }
  };

  ACCIONES['aj-importar'] = () => { const f = $v('#aj-archivo'); if (f) f.click(); };
  ACCIONES['aj-cancelar-importar'] = () => { textoRespaldo = null; App.cerrarHoja(); };

  ACCIONES['aj-reemplazar'] = async () => {
    const texto = textoRespaldo;
    textoRespaldo = null;
    App.cerrarHoja();
    const r = typeof texto === 'string' ? await DB.importar(texto) : { ok: false, error: 'No se pudo leer el archivo.' };
    if (!r.ok) { msg('aj-respaldo-msg', r.error || 'El archivo no es un respaldo válido.'); return; }
    try {
      App.estado.granja = (await DB.obtener('granja', 'granja')) ||
        await DB.guardar('granja', { id: 'granja', nombre: '', tipo: '', altitud: null, tema: 'auto', creado: new Date().toISOString() });
    } catch (e) { App.estado.granja = { id: 'granja', nombre: '', tipo: '', altitud: null, tema: 'auto' }; }
    App.fijarLote(null);
    App.toast('Respaldo importado');
    App.actualizarAlertas();
    App.ir('#/inicio');
  };
})();
