/* Appollo · Vista "Más": acceso a Inventario, Reportes, Planificar y Ajustes. */
var VISTAS = window.VISTAS || (window.VISTAS = {});
VISTAS.mas = async function () {
  const destinos = [
    ['Inventario', 'saco', '#/inventario'],
    ['Reportes', 'grafico', '#/reportes'],
    ['Planificar', 'huevo', '#/plan/genetica'],
    ['Ajustes', 'ajustes', '#/ajustes'],
  ];
  return `<section class="pantalla"><h1>Más</h1>
  <div class="mas-lista">${destinos.map(([t, i, r]) =>
    Boton({ texto: t, icono: i, variante: 'secundario', accion: 'ir', datos: { ruta: r }, clase: 'btn-ancho btn-lista' })).join('')}</div>
</section>`;
};
