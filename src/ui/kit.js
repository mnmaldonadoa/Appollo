/* Appollo · Página del kit visual (solo para `python3 build.py --kit`, no entra en la app). */
(function () {
  const pares = [
    ['texto/fondo', 'fondo', 'texto', 'Texto'],
    ['secundario/fondo', 'fondo', 'secundario', 'Secundario'],
    ['texto/superficie', 'superficie', 'texto', 'Texto'],
    ['secundario/superficie', 'superficie', 'secundario', 'Secundario'],
    ['primario/superficie', 'superficie', 'primario', 'Primario'],
    ['ok/superficie', 'superficie', 'ok', 'Bien'],
    ['precaucion/superficie', 'superficie', 'precaucion', 'Precaución'],
    ['alerta/superficie', 'superficie', 'alerta', 'Alerta'],
    ['sobre-primario/primario', 'primario', 'sobre-primario', 'Sobre primario'],
    ['sobre-alerta/alerta', 'alerta', 'sobre-alerta', 'Sobre alerta'],
    ['sobre-huevo/huevo', 'huevo', 'sobre-huevo', 'Sobre huevo'],
  ];
  const iconos = ['gallina', 'huevo', 'saco', 'balanza', 'jeringa', 'cruz', 'gota', 'termo', 'inicio', 'mas', 'campana'];
  const nombres = { termo: 'termómetro', cruz: 'sanidad', mas: 'registrar', campana: 'alertas' };
  const dias = Array.from({ length: 14 }, (_, i) => 'Día ' + (i + 1));
  const real = [88, 89.5, 90, 91.2, 90.4, 92, 92.8, 92.1, 93.4, 93.9, 93.2, 94.1, 94.6, 94.3];
  const est = [90, 90.6, 91.2, 91.7, 92.1, 92.5, 92.8, 93.1, 93.3, 93.5, 93.7, 93.8, 93.9, 94];

  const sec = (kit, titulo, html) => `<section class="kit-sec" data-kit="${kit}"><h3 class="kit-h">${titulo}</h3>${html}</section>`;

  function panel(tema) {
    const t = tema === 'claro' ? 'Tema claro' : 'Tema oscuro';
    const sub = tema === 'claro' ? 'Para el sol del mediodía' : 'Para el galpón de noche';
    return `<section class="kit-panel" data-tema="${tema}">
  <header class="kit-cab"><h2>${t}</h2><p class="kit-sub">${sub}</p></header>
  ${sec('muestrario', 'Pares de color', `<div class="kit-pares">${pares.map(([p, f, c, n]) =>
    `<div class="kit-par" data-par="${p}" style="background:var(--${f});color:var(--${c})"><b>${n}</b><span>${p}</span></div>`).join('')}
    <div class="kit-deco"><span style="background:var(--huevo)"></span><span style="background:var(--cielo)"></span><span style="background:var(--ok-viva)"></span><span style="background:var(--precaucion-viva)"></span><span style="background:var(--alerta-viva)"></span></div></div>`)}
  ${sec('boton', 'Botones', `<div class="kit-pila">
    ${Boton({ texto: 'Guardar registro', icono: 'huevo', variante: 'primario', accion: 'kit-palomita' })}
    ${Boton({ texto: 'Ver lote', icono: 'gallina', variante: 'secundario', accion: 'kit' })}
    ${Boton({ texto: 'Cerrar lote', icono: 'cruz', variante: 'peligro', accion: 'kit' })}
    <div class="kit-fila">${Boton({ texto: 'Cancelar', variante: 'secundario', accion: 'kit' })}${Boton({ texto: 'Listo', variante: 'primario', accion: 'kit' })}</div>
    <div class="kit-palomita" aria-live="polite"></div></div>`)}
  ${sec('tarjeta', 'Tarjetas', `<div class="kit-pila">
    ${Tarjeta({ titulo: 'Aves vivas', cifra: 4870, unidad: 'aves', estado: 'verde', icono: 'gallina', pie: 'Viabilidad 97,4 %' })}
    ${Tarjeta({ titulo: 'Huevos hoy', cifra: 4312, unidad: 'huevos', estado: 'ambar', icono: 'huevo', pie: 'Postura 88,5 % · estándar 93 %' })}
    ${Tarjeta({ titulo: 'Mortalidad', cifra: 0.8, unidad: '% acumulada', estado: 'rojo', icono: 'cruz', pie: '12 aves esta semana' })}
    ${Tarjeta({ titulo: 'Alimento del día', cifra: 535.7, unidad: 'kg', icono: 'saco' })}</div>`)}
  ${sec('contador', 'Contador', `<div class="kit-pila">
    ${Contador({ id: 'kit-c1-' + tema, valor: 12, min: 0, max: 999, paso: 1, etiqueta: 'Aves muertas' })}
    ${Contador({ id: 'kit-c2-' + tema, valor: 2.5, min: 0, max: 10, paso: 0.1, etiqueta: 'Peso promedio en kg' })}</div>`)}
  ${sec('grafico', 'Gráfico · % postura', `<div class="kit-pila">
    <div class="kit-caja">${Grafico({ serieReal: real, serieEstandar: est, etiquetas: dias })}</div>
    <div class="kit-caja">${Grafico({ serieReal: [91], serieEstandar: [92, 92.5], etiquetas: ['Hoy', 'Mañana'] })}</div>
    <div class="kit-caja">${Grafico({ serieReal: [], serieEstandar: [] })}</div></div>`)}
  ${sec('iconos', 'Íconos', `<ul class="kit-iconos">${iconos.map(i => `<li>${icono(i)}<span>${nombres[i] || i}</span></li>`).join('')}</ul>`)}
  ${sec('esqueleto', 'Cargando', Esqueleto(3))}
  ${sec('hoja', 'Hoja inferior', `<div class="kit-marco"><div class="kit-detras">${Tarjeta({ titulo: 'Aves vivas', cifra: 4870, unidad: 'aves', icono: 'gallina' })}</div>
    ${Hoja({ titulo: '¿Qué registras?', contenido: `<div class="hoja-rejilla">${[
      ['Mortalidad', 'cruz'], ['Alimento', 'saco'], ['Huevos', 'huevo'], ['Peso', 'balanza'], ['Vacuna', 'jeringa'], ['Sanidad', 'termo'],
    ].map(([n, i]) => Boton({ texto: n, icono: i, variante: 'secundario', accion: 'kit' })).join('')}</div>` })}</div>`)}
</section>`;
  }

  document.getElementById('kit').innerHTML = panel('claro') + panel('oscuro');
  document.querySelectorAll('.tarjeta-cifra[data-cifra]').forEach(el => { el.textContent = '0'; contar(el, Number(el.dataset.cifra)); });
  document.addEventListener('click', e => {
    const b = e.target.closest('[data-accion]');
    if (!b) return;
    const a = b.dataset.accion;
    if (a === 'contador-mas' || a === 'contador-menos') ajustarContador(b.dataset.para, a === 'contador-mas' ? 1 : -1);
    if (a === 'kit-palomita') { palomita(b.closest('.kit-pila').querySelector('.kit-palomita')); vibrar(); }
  });
})();
