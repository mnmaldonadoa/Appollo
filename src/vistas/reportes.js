/* Appollo · Vista "Reportes" (provisional: la reemplaza una tarea posterior). */
var VISTAS = window.VISTAS || (window.VISTAS = {});
VISTAS.reportes = async function () {
  return `<section class="pantalla"><h1>Reportes</h1>
  <div class="proximamente">${icono('hoja')}<p>Próximamente: viabilidad, conversión y producción por período.</p></div></section>`;
};
