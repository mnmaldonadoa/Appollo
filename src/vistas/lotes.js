/* Appollo · Vista "Lotes" (provisional: la reemplaza una tarea posterior). */
var VISTAS = window.VISTAS || (window.VISTAS = {});
VISTAS.lotes = async function () {
  return `<section class="pantalla"><h1>Lotes</h1>
  <div class="proximamente">${icono('hoja')}<p>Próximamente: aquí verás tus lotes activos y cerrados.</p></div></section>`;
};
