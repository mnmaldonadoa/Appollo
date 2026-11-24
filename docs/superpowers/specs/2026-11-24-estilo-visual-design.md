# Appollo · Estilo visual nuevo e ilustraciones — diseño

Fecha: 2026-11-24 · Estado: pendiente de revisión de Nicolás · Rama: `estilo-visual` (sobre `main` de GitHub, commit `67111b1`)

## 1. Intención

Appollo la usan productores de gallinas, desde familias hasta granjas comerciales, y muchos leen poco o no tienen formación técnica. Nicolás quiere una app **amigable y visual**: ilustraciones propias de las genéticas, del manejo, de las alertas, de las recomendaciones y de los estados vacíos, con un solo estilo (plano, minimalista, pastel, sin contornos) aplicado a **todas** las pantallas que ya existen. Las imágenes **ayudan a entender, no reemplazan el texto**. Este es el subproyecto "A · estilo visual" que el diseño del Plan del ciclo dejó pendiente.

La fuente de verdad es el encargo de Nicolás (guía "Minimalist Flat Vector"). Este documento la traduce a decisiones de construcción.

## 2. Objetivos, no objetivos y anti-objetivos

**Objetivos**
- Biblioteca de ilustraciones SVG originales, reutilizables por clave, inline y sin conexión.
- Tokens nuevos (paleta pastel, carbón como texto, radios altos, bordes de 2 px, sombras planas) en claro y oscuro, y componentes y muestrario actualizados.
- Aplicarlo a Bienvenida, Nuevo lote (3 pasos), Inicio, hoja Registrar, Lotes, Detalle del lote (con Plan del ciclo), Alertas, Inventario, Reportes, Planificar, Más y Ajustes.
- Tipografía redondeada empaquetada en `src/fonts/` y precacheada.

**No objetivos**
- No cambia la lógica de cálculos, alertas, plan, base de datos ni el formato de respaldo.
- No cambia textos, flujos ni rutas (salvo los textos alternativos nuevos de las ilustraciones).
- No cambia el ícono de Android ni `ic_launcher_background.xml`.

**Anti-objetivos (sería un fracaso aunque funcione)**
- Que se vea como un juego o con humor: nada de escenas cómicas, exageraciones, objetos gigantes ni ironía. Las alertas de mortalidad, retiro y sanidad también se ven serenas.
- Que reproduzca o imite personajes concretos de *Dumb Ways to Die* u otra obra, o logos de casas genéticas.
- Que alguna ilustración muestre dosis, jeringas con cantidades o instrucciones de medicación.
- Que la imagen sustituya al texto o empeore la lectura: tamaños de letra, contraste y áreas táctiles nunca bajan.
- Emojis como íconos, degradados, sombras difusas, contornos alrededor de las siluetas o imágenes externas.

## 3. Restricciones

Las vigilan las pruebas y no se negocian:
- Ningún botón o campo de menos de 56 px de alto. El redondeado no reduce áreas táctiles.
- Sin desborde horizontal en 360×740, ni en claro ni en oscuro.
- Contraste de texto ≥ 7:1, calculado (las pruebas lo calculan con `getComputedStyle`).
- Cero errores de consola y la app completa sin conexión.
- Un lote sin plan funciona igual.
- **Los selectores que usan las e2e se conservan**: clases como `.hoja`, `.hoja-capa`, `.tarjeta`, `.tarjeta-cifra`, `.al-card`, `.al-rojo`, `.pc-item`, `.pc-etiqueta`, `.pc-retiro`, `.pc-vacuna`, `.nl-cat`, `.nl-tarea`, `.lote-item`, `.dl-reg`, `.nav-item`, `.chip`, `.vacia-ilustracion`, `.bienvenida`, `.plan-*`, `.rep-*`, `.inv-*`, además de todos los `data-accion`, ids y textos. Se pueden agregar clases, pero no quitar ni renombrar las que lee una prueba.
- Si una ilustración necesitara un dato nuevo, se propone antes. Este diseño **no necesita ninguno**: todo sale de datos que ya existen (genética, tipo de registro, tipo de alerta, categoría o id de recomendación y de labor).

## 4. Enfoques considerados

| Enfoque | Qué es | A favor | En contra |
|---|---|---|---|
| A. Sprite de escenas completas | Cada escena es un `<symbol>` y se llama con `<use>` | Lo más simple de usar; sin JS | Cada escena repite su ave; `dist/` crece más; las proporciones por genética quedan fijas |
| B. Módulo que dibuja en código | `ui/ilustraciones.js` devuelve el SVG completo como texto | Variantes por parámetros; todo se prueba en Node | Cada ilustración pinta todos sus nodos en el DOM |
| **C. Mixto (elegido)** | Piezas base una vez en el sprite; `ui/ilustraciones.js` compone escenas con `<use>`, con color y proporción por variables CSS y `transform` | `dist/` mínimo; variantes por genética; tema por variables; mapeo probado | Algo más de estructura |

**Nicolás eligió C** (2026-11-24) porque cumple su guía: reutilizar piezas, crecimiento mínimo de `dist/` y genéticas que se distinguen por color y proporción, con el mapeo a ilustraciones en un solo lugar probado.

## 5. Paleta y tokens (decidido)

Nicolás aprobó esta regla de contraste: **los pasteles puros solo van en piezas sin texto** (ilustraciones, franjas, puntos e insignias sin letra). **Donde hay texto se usa un tinte claro** del mismo tono con texto carbón encima. Contrastes calculados con la fórmula WCAG:

**Tema claro**

| Rol | Valor | Notas |
|---|---|---|
| Fondo de la app | `#F7F3E8` crema | también `theme-color` y `background_color` del manifest |
| Superficie de tarjeta | `#FFFDF8` | carbón 12,6:1 |
| Superficies de color con texto | menta `#D8E2DC` (9,7:1), cielo `#D0E1F9` (9,7:1), lila `#E8DFF5` (10,0:1) | solo texto principal (carbón) |
| Texto principal | carbón `#2D3142` | 11,6:1 sobre crema |
| Texto secundario | `#424A5C` | 8,0:1 sobre crema y 8,7:1 sobre `#FFFDF8`; **solo sobre crema o blanco**, nunca sobre menta, cielo ni lila (ahí da 6,7:1) |
| Botón principal | fondo carbón `#2D3142`, texto crema | 11,6:1; forma de píldora |
| Alerta roja (superficie con texto) | tinte coral `#F5C7BF` | carbón 8,5:1 |
| Estado bien (superficie con texto) | tinte salvia `#C9D4CA` | carbón 8,4:1 |
| Precaución (superficie con texto) | durazno `#F6BD60` | carbón 7,6:1 (el único pastel puro que admite texto) |
| Tinte marrón (genéticas de huevo marrón) | `#E9D3B9` | carbón 8,9:1 |
| Solo decoración (sin texto) | coral `#F28482`, salvia `#84A59D`, durazno `#F6BD60`, cuerpos `#FAF9F6`, `#FCE181`, `#D4A373`, `#CCD5AE` | |
| Pastel puro con texto carbón (prohibido) | coral 5,15:1 · salvia 4,82:1 · marrón 5,70:1 · gris pizarra `#5C677D` como texto ≤ 5,4:1 | no pasan |

**Acentos profundos para texto y señales** (decidido por Nicolás, 2026-11-24, opción 1; oscurecidos un poco en la implementación para pasar 7:1 también sobre superficie-2, primario-suave y huevo-suave): tres tonos oscuros de la misma familia pastel, **solo para texto, bordes finos, íconos y botones de acción**, nunca como relleno grande de superficie:

| Token | Claro | Oscuro | Usos |
|---|---|---|---|
| `--alerta` (coral profundo) | `#7A2F2A`: 8,4:1 sobre crema, 7,7:1 sobre superficie-2; crema sobre él 9,1:1 | tinte coral `#F5C7BF` como texto (11,7:1 sobre la base) | texto de `.chip-rojo`, errores, fondo de `.btn-peligro` (con texto crema en claro, carbón en oscuro) |
| `--ok` / `--primario` (salvia profunda) | `#344E47`: 8,1:1 sobre crema, 7,5:1 sobre superficie-2 | tinte salvia `#C9D4CA` (11,6:1) | pestaña activa, genética elegida, segmentos presionados, enlaces, texto y borde de `.btn-secundario`, chips de "Bien" |
| `--precaucion` (durazno profundo) | `#5E4210`: 8,4:1 sobre crema, 7,7:1 sobre superficie-2 | durazno `#F6BD60` (10,4:1) | texto de chips "Revisar" y avisos ámbar |

El botón principal sigue en carbón (§ arriba). Los pares que hoy exige `visual.py` (`alerta/superficie`, `sobre-alerta/alerta`, `primario/superficie`, `ok/superficie`, `precaucion/superficie`, `sobre-huevo/huevo`) se mantienen con estos valores y entran en `paleta.test.js`. Estos acentos sobre superficies tintadas (menta, cielo, lila) no se usan como texto salvo que la prueba los valide.

**Tema oscuro** (base `#121A14`, que ya usa la app; superficies `#1B241D` y `#26322A`)
- Texto principal crema `#F3EBDD`. Texto secundario `#DDD6CA`, **solo sobre la base y las superficies neutras** (≥ 9:1).
- Superficies de color con texto: cada pastel mezclado al ~80 % con la base (por ejemplo, menta → `#363E38`, coral → `#3A2D28`, salvia → `#27332D`, durazno → `#3B3722`), con texto crema (≥ 8,8:1). Los valores finales los fija quien construye y los valida la prueba de paleta (§10).
- En las ilustraciones, los cuerpos de las aves siguen claros (son objetos claros sobre un fondo de escena oscuro y apagado). El fondo de escena y las piezas que deben cambiar con el tema usan variables CSS.
- Botón principal: fondo crema `#F3EBDD` con texto carbón (10,9:1).

**Otros tokens**
- Radios: `--r-s: 16px`, `--r: 24px`, `--r-l: 28px`, `--r-xl: 32px` (la hoja inferior). Botones en píldora (`999px`).
- Bordes: 2 px sólidos (`--linea` / `--linea-fuerte` en tonos de la paleta) en lugar de sombras.
- Sombras: se eliminan las difusas (`--sombra*` con blur). Solo se permite una sombra plana de borde duro (desplazamiento sin desenfoque, color sólido algo más oscuro), por ejemplo bajo los botones para que se sientan presionables.
- Se mantienen la escala de espacio, `--presion` y las duraciones de animación.

## 6. Tipografía (decidido por quien construye, dentro de la guía)

- **Nunito** (redondeada, geométrica) en títulos y cifras, pesos 700 y 800, subconjunto latino de `@fontsource/nunito` (npm, la misma fuente que ya usa el proyecto).
- **Atkinson Hyperlegible se queda en el cuerpo**, porque está diseñada para lectores con dificultad. Es coherente con un público que lee poco, y su forma ya es redonda y abierta.
- Se retira Zilla Slab. `build.py` (`FUENTES`), `src/sw.js` (`ARCHIVOS`) y `visual.py` (las comprobaciones "títulos/cifras usan Zilla Slab" pasan a Nunito) se actualizan juntos.
- El cuerpo sigue en 18 px y ningún texto baja de 16 px (lo vigila `planificar.py`).

## 7. Arquitectura de ilustraciones (enfoque C)

**Piezas en el sprite (`src/body.html`)**, prefijo `p-`, con `viewBox` del lienzo de escena (`0 0 200 200`) para que se superpongan sin cálculos:
- Ave: `p-cuerpo` (frijol), `p-cuerpo-robusto` (pollo de carne), `p-cuerpo-esbelto` (criolla y campero), `p-pollito`, `p-ala`, `p-cola`, `p-cresta`, `p-pico`, `p-barba`, `p-ojos`, `p-patas`, `p-ojos-cerrados` (descanso), `p-barrado` (franjas de la Plymouth Rock).
- Objetos de manejo: `p-bebedero`, `p-comedero`, `p-saco`, `p-termometro`, `p-gota`, `p-ventilador`, `p-foco`, `p-galpon`, `p-botas`, `p-vacuna` (frasco sin cantidades), `p-balanza`, `p-huevos`, `p-hoja`, `p-frasco` (químico, sin dosis), `p-calendario`, `p-lista`, `p-caja`, `p-escudo`, `p-reloj`, `p-flecha-vuelta`.
- Las piezas no llevan `fill` fijo: lo toman de variables (`fill="var(--il-cuerpo)"` y similares), que heredan dentro de `<use>`. Las patas y los trazos finos llevan `stroke: #2D3142` (en oscuro, la variable de trazo pasa a crema), `stroke-width` 2–2,5 y `stroke-linecap: round`. Las siluetas principales no llevan `stroke`.

**Módulo `src/ui/ilustraciones.js`** (se agrega a `SCRIPTS` en `build.py` después de `componentes.js`):
- `Ilustracion(clave, { tamano: 'mini'|'media'|'grande', genetica, decorativa, titulo })` devuelve una cadena `<svg viewBox="0 0 200 200" ...>` con `<use>` de las piezas y un `<rect>` de fondo de escena redondeado. Con `decorativa`, lleva `aria-hidden="true"`; si no, lleva `role="img"` y `<title>`. Tamaños: mini 48 px (filas, alertas, botones de Registrar), media 96 px (genéticas, cabeceras), grande 160 px (vacíos y bienvenida).
- `ESTILO_GENETICA[id]`: color de cuerpo, cresta y forma, más `escala` para la proporción. Por ejemplo, ponedora marrón: cuerpo `#D4A373`, forma frijol; LSL: `#FAF9F6`; Cobb/Ross: `p-cuerpo-robusto` en `#FAF9F6`; campero: esbelto en `#D4A373`; criolla: esbelta en `#CCD5AE` con cola alta; Rhode Island: frijol en marrón más profundo con cola oscura; Plymouth Rock: frijol gris cálido con `p-barrado`. Una genética desconocida usa un ave genérica.
- `ilustracionDe(contexto, id)`: **la única función de mapeo**, pura y probada. `contexto` ∈ `registro`, `alerta`, `categoriaPlan`, `labor`, `recomendacion`, `itemRecomendacion`, `estado`. Devuelve una clave existente o un respaldo por contexto (nunca `undefined`).
- `ilustracion()` de `componentes.js` se reemplaza por una llamada a `Ilustracion()` con las claves de estado; sus 7 usos actuales se actualizan.
- Una ilustración usada como mini en una fila no repite el texto de la fila: es decorativa.

**Por qué no se toca `model.js`:** el encargo dice "cada recomendación referencia una ilustración por clave". Se cumple con el mapeo por `cat.id` / `item.id` en `ilustracionDe('recomendacion' | 'itemRecomendacion', id)`. Agregar un campo a los objetos de `construirManejo` también sería válido, pero ensucia un módulo de lógica y obliga a tocar dos lugares por cada clave nueva. **Llamada de quien construye** (§12).

## 8. Inventario de ilustraciones (claves)

La Fase 0 entrega el inventario confirmado contra el código antes de dibujar y puede agregar o fusionar claves. Punto de partida (unas 55 escenas):

- **Genéticas (11, según `data.js`):** `gen-hyline-brown`, `gen-lohmann-brown`, `gen-isa-brown`, `gen-hisex-brown`, `gen-lohmann-lsl`, `gen-cobb500`, `gen-ross308`, `gen-campero`, `gen-rhode-island`, `gen-plymouth-rock`, `gen-criolla`. Son la misma escena (`gen`) con `ESTILO_GENETICA`; las de huevo marrón pueden compartir cuerpo y distinguirse por un detalle mínimo (tono de cresta o de cola).
- **Manejo:** `man-agua`, `man-alimento`, `man-cambio-fase`, `man-temperatura`, `man-humedad`, `man-ventilacion`, `man-luz`, `man-densidad`, `man-bioseguridad`, `man-llegada`, `man-seleccion`, `man-registros`, `man-vitaminas`.
- **Sanidad:** `san-vacuna`, `san-desparasitacion`, `san-remedio-casero`, `san-quimico`, `san-retiro`, `san-plagas`.
- **Registrar (6, según `registrar.js`):** `reg-mortalidad`, `reg-alimento`, `reg-huevos`, `reg-peso`, `reg-vacuna`, `reg-sanidad`.
- **Estados:** `est-sin-lotes`, `est-sin-alertas`, `est-sin-inventario`, `est-sin-registros` (reportes y detalle), `est-bienvenida`, `est-exito`, `est-deshacer`.
- **Alertas (los 9 tipos de `alertas.js`, que son más que los 7 del encargo):** `al-mortalidad`, `al-sin-registro`, `al-postura` (caída de postura), `al-vacuna`, `al-retiro`, `al-etiqueta` (revisar etiqueta), `al-fase`, `al-inventario`, `al-plan` (labores atrasadas y del día).
- **Mapeos sin escena propia:** las 10 categorías del plan (`CATEGORIAS_PLAN`) y las 9 categorías de `construirManejo` (`alim`, `temp`, `hum`, `agua`, `vit`, `vac`, `san`, `casero`, `quim`) apuntan a claves `man-*` o `san-*`. Algunos ítems apuntan a una escena más precisa: `t_vent` → `man-ventilacion`, `t_luz` → `man-luz`, `a_fase` → `man-cambio-fase`, `s_desp` → `san-desparasitacion`, `s_peso` → `man-seleccion`, `s_bio` → `man-bioseguridad`.

**Mortalidad (criterio de tono):** un ave en reposo con `p-ojos-cerrados`, en gris cálido, sobre un fondo neutro. Nunca un ave caída, heridas, cruces dramáticas ni sangre.

## 9. Aplicación por pantalla

| Pantalla | Cambio visual |
|---|---|
| Bienvenida | `est-bienvenida` grande; campos y botón píldora con tokens nuevos |
| Nuevo lote 1 · genética | Cada genética es una tarjeta con `gen-*` media, nombre y rasgo; la elegida, con borde de 2 px carbón y una insignia salvia |
| Nuevo lote 2–3 | Encabezados de paso con mini (`man-densidad` para aves y edad, `man-temperatura` para altitud y galpón); categorías del plan con su mini |
| Inicio | Cabecera con el ave de la genética del lote; tarjetas KPI con superficies tintadas y mini (mortalidad, producción, alimento, sanidad); estado vacío `est-sin-lotes` |
| Hoja Registrar | Rejilla de 6 botones con `reg-*` mini sobre texto; éxito y "Deshacer" con `est-exito` / `est-deshacer` mini en el toast |
| Lotes | Cada lote con `gen-*` mini; vacío `est-sin-lotes` |
| Detalle del lote | Cabecera con `gen-*` media; el historial con mini por tipo; Plan del ciclo con mini por categoría en cada labor; retiros con `san-retiro` |
| Alertas | Cada `.al-card` con `al-*` mini y superficie tintada según la gravedad (coral, durazno o neutro); vacío `est-sin-alertas` |
| Inventario | Ítems con `man-alimento` mini; vacío `est-sin-inventario` |
| Reportes | Tokens nuevos en gráficas y tarjetas; vacío `est-sin-registros` |
| Planificar | Selector de genética igual que en Nuevo lote; cada categoría de recomendaciones con su escena media en la cabecera |
| Más y Ajustes | Filas con íconos del sprite actual recoloreados; sin escenas (no aportan comprensión) |

Los íconos de línea actuales (`i-*`) se quedan para navegación y botones pequeños, con el trazo en carbón. Las ilustraciones van donde ayudan a reconocer un concepto.

**Animación:** las escenas aparecen con un rebote corto (`transform: scale` + `opacity`, ≤ 300 ms) y las genéticas parpadean con suavidad al elegirlas. Todo se apaga con `prefers-reduced-motion` (la prueba "sin transiciones con movimiento reducido" sigue valiendo).

## 10. Pruebas

- **Unitarias nuevas (`tests/ilustraciones.test.js`, TDD):**
  - `ilustracionDe` cubre cada tipo de `registrar.js`, cada tipo de alerta, cada categoría de `CATEGORIAS_PLAN`, cada `cat.id` de `construirManejo` (recorriendo varias genéticas y edades) y cada genética de `data.js`; ninguna devuelve `undefined` y toda clave devuelta existe.
  - Cada `Ilustracion()` lleva `role="img"` + `<title>` o `aria-hidden`.
  - El SVG no contiene `stroke` en las siluetas, `linearGradient`/`radialGradient`, `<image>`, `http` ni emojis, ni números con unidades de dosis (`mg`, `ml`, `cc`).
  - Cada `<use href="#p-…">` existe en `body.html`.
- **Unitaria nueva (`tests/paleta.test.js`):** lee los tokens de `styles.css` (claro y oscuro) y verifica ≥ 7:1 en cada par texto/superficie declarado en una tabla de la prueba (la de §5).
- **e2e:** `visual.py` pasa a esperar Nunito en títulos y cifras; `todo.py` espera el caché `appollo-v6` con los archivos de Nunito; el resto sigue igual y debe pasar en claro y oscuro.
- El muestrario (`build.py --kit`) agrega una sección "Ilustraciones" con todas las claves en claro y oscuro, que sirve para revisar y para las capturas.

## 11. Fases y entregables

Cada fase cierra con capturas (claro y oscuro) para Nicolás. **La Fase 0 es un alto**: no se dibuja hasta que Nicolás apruebe el inventario. Las fases 1–4 cierran con un informe y capturas, y el trabajo sigue salvo que él lo detenga. El plan se escribe completo sobre la lista de §8, y la Fase 2 la ajusta a lo que apruebe la Fase 0.
0. **Auditoría:** inventario de pantallas, tarjetas, alertas, labores y recomendaciones, con la ilustración asignada a cada una. Se entrega antes de dibujar.
1. **Tokens y componentes:** `styles.css`, `ui/kit.css`, `ui/kit.js`, Nunito en `build.py`, prueba de paleta.
2. **Biblioteca:** piezas del sprite, `ui/ilustraciones.js`, pruebas y la sección del muestrario.
3. **Pantallas:** §9.
4. **Cierre:** `CACHE` `appollo-v5` → `appollo-v6` con Nunito en `ARCHIVOS`; `theme-color` y manifest en `#F7F3E8`; `build.py`, `node tests/run.js`, todas las e2e y capturas finales. Entrega con el peso de `dist/` antes y después (línea base: `dist/` 591.937 bytes y `artifact.html` 595.060 bytes, medidos el 2026-11-24) y la actualización del README del proyecto (sección "Limitaciones": quitar "estilo visual pendiente").

Si `dist/` crece más de **60 KB** netos (Nunito pesa aproximadamente lo mismo que el Zilla Slab que sale; las piezas SVG deberían sumar unos 20–30 KB), se para y se consulta a Nicolás.

## 12. Lo que queda a quien construye

- Forma exacta de cada pieza y de cada escena, dentro de §7–§8 y la guía de Nicolás.
- Valores finales de los tintes del tema oscuro, validados por `paleta.test.js`.
- Mapeo de recomendaciones en `ui/ilustraciones.js` (preferido) o un campo en `model.js`, sin cambiar la lógica.
- Nombres finales de las piezas `p-*` y la fusión de escenas casi iguales, si la Fase 0 lo justifica.
- Orden interno de trabajo dentro de cada fase.
- Colores de las gráficas (series dentro de la paleta; las líneas y puntos no llevan texto) y el ave de cabecera de Inicio cuando la vista muestra todos los lotes (ave genérica).
- Obtener Nunito con `npm pack @fontsource/nunito` (v5.3.0; no está en `node_modules`) y copiar solo los `.woff2` latinos 700 y 800 a `src/fonts/`.
- Los íconos del lanzador (PNG que dibuja `build.py` y `ic_launcher_background.xml`) siguen verdes: no entran en este subproyecto.
