/* Appollo · Vista "Nuevo lote" (provisional: la reemplaza una tarea posterior). */
var VISTAS = window.VISTAS || (window.VISTAS = {});
VISTAS.nuevoLote = async function () {
  return `<section class="pantalla"><h1>Nuevo lote</h1>
  <div class="proximamente">${icono('hoja')}<p>Próximamente: crea un lote en tres pasos (genética, aves y galpón).</p></div></section>`;
};
