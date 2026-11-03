/* Appollo · Vista "Inventario" (provisional: la reemplaza una tarea posterior). */
var VISTAS = window.VISTAS || (window.VISTAS = {});
VISTAS.inventario = async function () {
  return `<section class="pantalla"><h1>Inventario</h1>
  <div class="proximamente">${icono('hoja')}<p>Próximamente: alimento, vacunas y medicamentos en bodega.</p></div></section>`;
};
