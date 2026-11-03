/* Appollo · Vista "Ajustes" (provisional: la reemplaza una tarea posterior). */
var VISTAS = window.VISTAS || (window.VISTAS = {});
VISTAS.ajustes = async function () {
  return `<section class="pantalla"><h1>Ajustes</h1>
  <div class="proximamente">${icono('hoja')}<p>Próximamente: granja, tema y respaldo de datos.</p></div></section>`;
};
