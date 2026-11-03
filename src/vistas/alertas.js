/* Appollo · Vista "Alertas" (provisional: la reemplaza una tarea posterior). */
var VISTAS = window.VISTAS || (window.VISTAS = {});
VISTAS.alertas = async function () {
  return `<section class="pantalla"><h1>Alertas</h1>
  <div class="proximamente">${icono('hoja')}<p>Próximamente: tus alertas ordenadas por gravedad.</p></div></section>`;
};
