/* Appollo · Vista "Lotes": activos y cerrados como tarjetas tocables → #/lote/:id. */
var VISTAS = window.VISTAS || (window.VISTAS = {});

/* Resumen compartido por Lotes, Inicio y Detalle. Nunca devuelve NaN: lo que no se puede calcular es null. */
function resumenLote(l, registros, vacunas, fecha) {
  const g = typeof GENETICAS !== 'undefined' ? GENETICAS.find(x => x.id === l.genetica) : null;
  const ok = g && typeof l.fechaLlegada === 'string' && fechaValida(l.fechaLlegada) && Number.isFinite(Number(l.edadLlegadaDias));
  const fin = fecha || hoyLocal();
  const edad = ok ? edadDias(l, fin) : null;
  const vivas = Number.isFinite(Number(l.avesInicio)) ? Math.max(0, avesVivas(l, registros, fin)) : null;
  return { g, ok, edad, vivas, estado: ok ? estadoSanitario(l, registros, vacunas, fin) : null };
}
const textoEdad = d => (d === null || d === undefined ? 'Edad —' : `${formatoNumero(d)}\u00a0${d === 1 ? 'día' : 'días'} · ${formatoNumero(Math.floor(d / 7))}\u00a0sem`);
const chipEstado = e => (e ? `<span class="chip chip-${e}"><span class="chip-punto" aria-hidden="true"></span>${{ verde: 'Bien', ambar: 'Revisar', rojo: 'Atención' }[e]}</span>` : '');

VISTAS.lotes = async function () {
  const [lotes, registros, vacunas] = await Promise.all(['lotes', 'registros', 'vacunasPlan'].map(s => DB.listar(s)));
  const hoy = hoyLocal();
  const tarjeta = l => {
    const r = resumenLote(l, registros, vacunas, l.estado === 'activo' ? hoy : (l.fechaCierre || hoy));
    return `<button type="button" class="lote-item" data-accion="ir" data-ruta="#/lote/${esc(encodeURIComponent(l.id))}">
  <span class="lote-cab"><b class="lote-nombre">${esc(l.nombre || 'Lote')}</b>${chipEstado(l.estado === 'activo' ? r.estado : null)}</span>
  <span class="lote-gen">${esc(r.g ? r.g.nombre : l.genetica || 'Genética desconocida')}</span>
  <span class="lote-datos"><span><b class="num">${r.vivas === null ? '—' : formatoNumero(r.vivas)}</b> aves vivas</span><span>${textoEdad(r.edad)}</span></span>
</button>`;
  };
  const orden = (a, b) => String(b.fechaLlegada || '').localeCompare(String(a.fechaLlegada || ''));
  const activos = lotes.filter(l => l.estado === 'activo').sort(orden), cerrados = lotes.filter(l => l.estado !== 'activo').sort(orden);
  const nuevo = Boton({ texto: 'Nuevo lote', icono: 'mas', variante: 'primario', accion: 'nuevo-lote', clase: 'btn-ancho btn-grande' });
  if (!lotes.length) {
    return `<section class="pantalla pantalla-vacia"><div class="vacia-ilustracion" aria-hidden="true">${icono('gallina')}</div>
  <h1>Lotes</h1><p class="pantalla-texto">Aún no tienes lotes. Un lote es un grupo de aves que llegó junto.</p>${nuevo}</section>`;
  }
  return `<section class="pantalla">
  <h1>Lotes</h1>
  ${nuevo}
  <h2 class="seccion-titulo">Activos <span class="num">(${activos.length})</span></h2>
  <div class="lotes-lista lotes-activos">${activos.length ? activos.map(tarjeta).join('') : '<p class="pantalla-texto">No hay lotes activos.</p>'}</div>
  ${cerrados.length ? `<h2 class="seccion-titulo">Cerrados <span class="num">(${cerrados.length})</span></h2>
  <div class="lotes-lista lotes-cerrados">${cerrados.map(tarjeta).join('')}</div>` : ''}
</section>`;
};
