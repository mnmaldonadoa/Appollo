/* Appollo · Vista "Lote" (provisional: la reemplaza una tarea posterior). */
var VISTAS = window.VISTAS || (window.VISTAS = {});
VISTAS.detalleLote = async function () {
  return `<section class="pantalla"><h1>Lote</h1>
  <div class="proximamente">${icono('hoja')}<p>Próximamente: resumen, historial y vacunas del lote.</p></div></section>`;
};
