/* Appollo · Vista "Inicio" (provisional: Task 6 pone las tarjetas del lote). */
var VISTAS = window.VISTAS || (window.VISTAS = {});
VISTAS.inicio = async function () {
  let lotes = [];
  try { lotes = await DB.listar('lotes', { estado: 'activo' }); } catch (e) { lotes = []; }
  const granja = App.estado.granja && App.estado.granja.nombre;
  if (!lotes.length) {
    return `<section class="pantalla pantalla-vacia">
  <div class="vacia-ilustracion" aria-hidden="true">${icono('gallina')}</div>
  <h1>${granja ? esc(granja) : 'Bienvenido a Appollo'}</h1>
  <p class="pantalla-texto">Aún no tienes lotes. Crea el primero para registrar mortalidad, alimento y huevos cada día.</p>
  ${Boton({ texto: 'Crear mi primer lote', icono: 'mas', variante: 'primario', accion: 'nuevo-lote', clase: 'btn-ancho btn-grande' })}
</section>`;
  }
  return `<section class="pantalla"><h1>${granja ? esc(granja) : 'Inicio'}</h1>
  <p class="pantalla-texto">${lotes.length === 1 ? '1 lote activo' : lotes.length + ' lotes activos'}</p>
  <div class="proximamente">${icono('hoja')}<p>Próximamente: aves vivas, mortalidad, alimento y producción de un vistazo.</p></div></section>`;
};
