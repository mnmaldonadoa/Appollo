# Estilo visual nuevo e ilustraciones · Plan de implementación

> **Para agentes:** SUB-SKILL OBLIGATORIA: usa superpowers:subagent-driven-development (recomendada) o superpowers:executing-plans para ejecutar este plan tarea por tarea. Los pasos usan casillas (`- [ ]`) para el seguimiento.

**Objetivo:** dar a Appollo una paleta pastel con acentos profundos, la tipografía Nunito y una biblioteca de ilustraciones planas y originales, y aplicarlas a todas las pantallas sin tocar la lógica.

**Arquitectura:** enfoque C del diseño. Las piezas SVG base (`p-*`) viven una sola vez en el sprite de `src/body.html`; `src/ui/ilustraciones.js` compone escenas con `<use>`, da color y proporción por genética mediante variables CSS y concentra el único mapeo contexto → clave (`ilustracionDe`). Las vistas solo llaman `Ilustracion(clave, opciones)`.

**Tecnologías:** HTML/CSS/JS sin framework, SVG inline, `build.py` (Python 3), pruebas unitarias con Node `vm` (`tests/run.js`) y e2e con Python + Playwright (360×740).

**Diseño:** `docs/superpowers/specs/2026-11-24-estilo-visual-design.md` (aprobado por Nicolás el 2026-11-24). Quien ejecuta lee el diseño y este plan.

## Restricciones globales

- Botones y campos ≥ 56 px de alto; sin desborde horizontal en 360×740 en claro y oscuro; contraste de texto ≥ 7:1; cero errores de consola; app completa sin conexión.
- No cambian cálculos, alertas, plan, DB ni el formato de respaldo (`data.js`, `model.js`, `calc.js`, `alertas.js`, `db.js`, `plan.js`, `catalogo.js` no se editan).
- Se conservan las clases, ids, `data-accion` y textos que leen las e2e (lista en §3 del diseño). Se pueden agregar clases, pero no quitar ni renombrar las existentes.
- Pasteles puros (`#F28482`, `#84A59D`, `#D4A373`, `#FAF9F6`, `#FCE181`, `#CCD5AE`) solo sin texto; `#F6BD60` es el único pastel que admite texto carbón.
- Texto `#2D3142`; secundario `#424A5C` solo sobre crema o blanco; acentos `#86352F` / `#3A564E` / `#6A4A12` (claro) y `#F5C7BF` / `#C9D4CA` / `#F6BD60` (oscuro).
- Sin `stroke` en las siluetas, sin degradados, sin `box-shadow` con desenfoque, sin `<image>`, sin URL externas, sin emojis, sin dosis ni cantidades en las ilustraciones.
- Animación solo con `transform`/`opacity`, ≤ 300 ms, anulada con `prefers-reduced-motion`.
- Si `dist/` crece más de 60 KB netos sobre 591.937 bytes, se detiene y se consulta a Nicolás.
- Commits en la rama `estilo-visual`; cada mensaje termina con las dos líneas de atribución de la sesión.

## Puntos a vigilar en la revisión

1. **Dos ilustraciones en la misma pantalla:** las genéticas en la rejilla de Nuevo lote y las alertas en lista no deben compartir ids internos (recortes o `clipPath`) ni pisarse las variables de color. Prueba: Tarea 5, «dos Ilustracion seguidas no repiten id».
2. **Genética desconocida en un respaldo importado** (limitación conocida): la cabecera del lote y la tarjeta deben mostrar el ave genérica, sin romper. Prueba: Tarea 5, `ilustracionDe('genetica', 'xyz') === 'gen-generica'`.
3. **Tema oscuro en piezas con trazo:** las patas y los ojos en carbón desaparecen sobre fondos oscuros. Prueba: Tarea 4, el trazo usa `var(--il-trazo)` y `paleta.test.js` exige ≥ 3:1 de `--il-trazo` sobre `--il-fondo-*` en ambos temas (objeto gráfico, WCAG 1.4.11).
4. **Texto largo con ilustración mini en 360 px:** labores y alertas con títulos largos no deben desbordar al sumar una mini de 48 px. Prueba: Tareas 9–10, las e2e `alertas.py` y `plan.py` siguen en verde y `todo.py` recorre el desborde en ambos temas.
5. **Movimiento reducido:** el rebote de entrada no debe correr con `prefers-reduced-motion`. Prueba: Tarea 5, `visual.py` «sin transiciones con movimiento reducido» sigue en verde con una escena en pantalla (la sección del kit la incluye).

---

### Task 0 · Tarea 0: Auditoría (Fase 0, ALTO: requiere la aprobación de Nicolás)

**Archivos:**
- Crear: `docs/superpowers/specs/2026-11-24-estilo-visual-inventario.md`
- Crear: `tests/e2e/capturas.py`

**Interfaces:**
- Produce: `python3 tests/e2e/capturas.py <etiqueta>` escribe en `capturas/<etiqueta>/` los PNG `inicio`, `nuevo-lote-1`, `nuevo-lote-2`, `nuevo-lote-3`, `registrar`, `alertas`, `plan-ciclo`, `lotes`, `inventario`, `reportes`, `planificar`, `ajustes` (360×740, `-claro`/`-oscuro`). Siembra un lote Hy-Line Brown con plan y registros usando las mismas utilidades de `tests/e2e/util.py` que `todo.py`. Se agrega `capturas/` a `.gitignore`.

- [ ] **Paso 1:** escribir `capturas.py` (levanta `http.server` sobre `dist/` como las demás e2e) y correr `python3 build.py && python3 tests/e2e/capturas.py antes`. Esperado: 24 PNG en `capturas/antes/`.
- [ ] **Paso 2:** escribir el inventario con estas tablas, cada fila con la clave asignada de §8 del diseño o «sin ilustración (motivo)»:
  - pantallas y sus bloques (tarjetas KPI de Inicio, pasos de Nuevo lote, rejilla de Registrar, toasts…);
  - los 9 `tipo` de `src/alertas.js`;
  - los 6 `TIPOS` de `src/vistas/registrar.js`;
  - las 10 `CATEGORIAS_PLAN` de `src/catalogo.js`;
  - los 9 `cat.id` de `construirManejo` y los ítems con escena propia;
  - las 11 genéticas;
  - los 7 usos de `ilustracion()`.

  Al final, la lista definitiva de claves de escena y de piezas `p-*`.
- [ ] **Paso 3:** commit (`docs: inventario de ilustraciones (fase 0)`), enviar el inventario y 4 capturas «antes» a Nicolás y **esperar su aprobación**. Si cambia claves, actualizar las tablas de las Tareas 4–5 de este plan antes de seguir.

### Task 1 · Tarea 1: Tipografía Nunito

**Archivos:**
- Crear: `src/fonts/nunito-latin-700-normal.woff2`, `src/fonts/nunito-latin-800-normal.woff2`
- Borrar: `src/fonts/zilla-slab-latin-600-normal.woff2`, `src/fonts/zilla-slab-latin-700-normal.woff2`
- Modificar: `build.py` (`FUENTES`), `src/sw.js` (`ARCHIVOS`; el `CACHE` sigue en `appollo-v5` hasta la Tarea 12), `src/styles.css` (`--f-titulo`), `tests/e2e/visual.py` (líneas 112–116), `tests/e2e/todo.py` (lista de fuentes precacheadas, si la nombra)

**Interfaces:**
- Produce: `--f-titulo: "Nunito", ui-rounded, "Segoe UI", system-ui, sans-serif`. Títulos `h1`/`h2` en 800 y `.titulo` y `.tarjeta-cifra` en 800; `h2` en 700.

- [ ] **Paso 1:** en `visual.py`, cambiar las comprobaciones a «títulos usan Nunito» y «cifras usan Nunito», y la lista de cargadas a incluir `Nunito 700` y `Nunito 800`. Correr `python3 build.py --kit && python3 tests/e2e/visual.py`. Esperado: FALLA en «títulos usan Nunito».
- [ ] **Paso 2:** `cd /tmp && npm pack @fontsource/nunito@5.3.0` y copiar `files/nunito-latin-700-normal.woff2` y `files/nunito-latin-800-normal.woff2` a `src/fonts/`; actualizar `FUENTES`, `ARCHIVOS` y `--f-titulo`; borrar Zilla.
- [ ] **Paso 3:** correr `python3 build.py --kit && python3 tests/e2e/visual.py && python3 tests/e2e/todo.py`. Esperado: `TODO OK` en ambas.
- [ ] **Paso 4:** commit `feat: tipografía Nunito en títulos y cifras`.

### Task 2 · Tarea 2: Paleta y tokens con prueba de contraste

**Archivos:**
- Crear: `tests/paleta.test.js`
- Modificar: `src/styles.css` (bloques `:root`, `[data-tema="claro"]`, `@media (prefers-color-scheme: dark)` y `[data-tema="oscuro"]`), `src/ui/kit.js` (`pares`), `build.py` (no cambia aún el `theme-color`: Tarea 12)

**Interfaces:**
- Produce estos tokens en ambos temas, que usan las tareas siguientes:
  - `--fondo`, `--superficie`, `--superficie-2`, `--linea`, `--linea-fuerte`, `--texto`, `--secundario`;
  - `--primario`, `--sobre-primario`, `--alerta`, `--sobre-alerta`, `--ok`, `--precaucion`, `--huevo`, `--sobre-huevo`;
  - tintes con texto: `--t-menta`, `--t-cielo`, `--t-lila`, `--t-coral`, `--t-salvia`, `--t-durazno`, `--t-marron`;
  - pasteles puros, solo para decoración: `--p-coral`, `--p-salvia`, `--p-durazno`, `--p-menta`, `--p-cielo`, `--p-lila`, `--p-crema`;
  - cuerpos de ave: `--ave-hueso`, `--ave-pollito`, `--ave-marron`, `--ave-gris`;
  - de ilustración: `--il-trazo`, `--il-fondo-crema`, `--il-fondo-menta`, `--il-fondo-cielo`, `--il-fondo-lila`, `--il-fondo-coral`, `--il-fondo-salvia`, `--il-fondo-durazno`.
- Valores claros: los de §5 del diseño. `--primario` es el botón principal: carbón `#2D3142`, con `--sobre-primario` `#FFFDF8`. `--ok` es salvia profunda `#3A564E`. Los enlaces, la selección y `.btn-secundario` pasan a `--ok`. Oscuros: §5 (`--primario` `#F3EBDD` con `--sobre-primario` `#2D3142`, `--secundario` `#DDD6CA`; tintes al ~80 % sobre `#121A14`).
- `--ave-*` es igual en ambos temas. `--il-fondo-*` en oscuro: el pastel mezclado al ~70 % con `#121A14`. `--il-trazo`: `#2D3142` en claro y `#F3EBDD` en oscuro.

- [ ] **Paso 1: escribir `tests/paleta.test.js`.** Lee `src/styles.css`, extrae con expresión regular los valores de cada token del bloque claro (`:root, [data-tema="claro"]`) y del bloque `[data-tema="oscuro"]`, y además comprueba que el bloque `@media (prefers-color-scheme: dark)` declare los mismos valores que `[data-tema="oscuro"]`. Afirma ≥ 7:1 (fórmula WCAG) en cada tema para estos pares:
  - texto sobre fondo, superficie, superficie-2, t-menta, t-cielo, t-lila, t-coral, t-salvia, t-durazno y t-marron;
  - secundario sobre fondo y superficie;
  - primario, ok, alerta y precaucion sobre fondo y superficie;
  - sobre-primario sobre primario, sobre-alerta sobre alerta y sobre-huevo sobre huevo.

  Afirma ≥ 3:1 para `il-trazo` sobre cada `il-fondo-*` y sobre `ave-*` (claro). Mensaje de fallo: `"<par> <tema>: <ratio>"`.
- [ ] **Paso 2:** `node tests/run.js`. Esperado: FALLA `paleta.test.js` (faltan tokens).
- [ ] **Paso 3:** escribir los tokens en `styles.css` y actualizar `pares` en `kit.js` (agregar `texto/t-coral`, `texto/t-salvia`, `texto/t-menta`).
- [ ] **Paso 4:** `node tests/run.js && python3 build.py --kit && python3 tests/e2e/visual.py`. Esperado: `13/13 archivos de prueba OK` y `TODO OK`.
- [ ] **Paso 5:** commit `feat: paleta pastel con acentos profundos y prueba de contraste`.

### Task 3 · Tarea 3: Componentes planos (radios, bordes, sin sombras difusas)

**Archivos:**
- Modificar: `src/styles.css` (radios `--r-s: 16px; --r: 24px; --r-l: 28px; --r-xl: 32px`; `.btn*`, `.tarjeta*`, `.chip*`, `.hoja*`, navegación, campos, segmentos, toasts), `src/ui/kit.css`
- Test: `tests/paleta.test.js` (agregar)

**Interfaces:**
- Produce: `--sombra-plana` (claro `#D9CFBC`, oscuro `#0A100B`) para la única sombra permitida: `box-shadow: 0 3px 0 0 var(--sombra-plana)`. Botones `border-radius: 999px`. Tarjetas con `border: 2px solid var(--linea)`, sin la franja `::before` difuminada (se conserva la franja de estado como color sólido). `.btn-peligro`: fondo `--alerta`, texto `--sobre-alerta`. Las variables `--sombra`, `--sombra-1`, `--sombra-nav` y `--sombra-alta` se eliminan.

- [ ] **Paso 1:** en `paleta.test.js`, agregar «sin sombras difusas ni degradados»: en `styles.css` y `kit.css`, toda declaración `box-shadow` con desenfoque distinto de 0 o con `inset` falla, y `linear-gradient`/`radial-gradient` falla. Correr `node tests/run.js`. Esperado: FALLA con la lista de líneas.
- [ ] **Paso 2:** reescribir esas reglas con bordes de 2 px y `--sombra-plana`; botones en píldora.
- [ ] **Paso 3:** `node tests/run.js && python3 build.py --kit && python3 tests/e2e/visual.py && python3 tests/e2e/todo.py`. Esperado: todo OK (≥ 56 px se mantiene).
- [ ] **Paso 4:** `python3 tests/e2e/capturas.py fase1`; commit `feat: componentes planos con bordes de 2 px y botones píldora`; enviar a Nicolás las capturas de Inicio, Nuevo lote, Registrar, Alertas y Plan del ciclo (claro y oscuro) como cierre de la Fase 1.

### Task 4 · Tarea 4: Piezas del sprite

**Archivos:**
- Modificar: `src/body.html` (después de los `i-*`)
- Crear: `tests/ilustraciones.test.js` (parte del sprite)

**Interfaces:**
- Produce símbolos `<symbol id="p-…" viewBox="0 0 200 200">` con las piezas definitivas de la Tarea 0 (punto de partida en §7 del diseño).
  - **Siluetas:** `p-cuerpo`, `p-cuerpo-robusto`, `p-cuerpo-esbelto`, `p-pollito`, `p-ala`, `p-cola`, `p-cresta`, `p-pico`, `p-barba` y los objetos. Rellenan con `fill="var(--il-c1)"` y `fill="var(--il-c2)"` (color principal y secundario, que fija la escena) y nunca llevan `stroke`.
  - **Trazos:** `p-patas`, `p-ojos-cerrados` y los detalles finos de los objetos. Llevan `class="il-trazo"` y en CSS `.il-trazo { fill: none; stroke: var(--il-trazo); stroke-width: 2.5; stroke-linecap: round; stroke-linejoin: round }`.
  - **Ojos:** `p-ojos` son dos círculos de `r` ≤ 4 con `fill="var(--il-trazo)"`.
  - **Sombra plana:** si una escena la usa, es la pieza `p-sombra` (elipse sólida con `fill="var(--il-sombra)"`).

- [ ] **Paso 1:** escribir en `tests/ilustraciones.test.js` el bloque «sprite». Lee `body.html` y, por cada id de la lista `PIEZAS` (la de la Tarea 0, en la prueba):
  - existe `<symbol id="p-…" viewBox="0 0 200 200">`;
  - si la pieza está en `SILUETAS`, su contenido no tiene la cadena `stroke`;
  - ninguna pieza contiene `Gradient`, `<image`, `http` ni `filter`.

  Esperado al correr: FALLA (no existen).
- [ ] **Paso 2:** dibujar las piezas (≤ 6 nodos cada una; curvas suaves, radios altos; picos y crestas como triángulos de vértices redondeados).
- [ ] **Paso 3:** `node tests/run.js`. Esperado: OK. Comprobar `wc -c src/body.html` (las piezas deberían sumar ≤ 25 KB).
- [ ] **Paso 4:** commit `feat: piezas base de ilustración en el sprite`.

### Task 5 · Tarea 5: Módulo `ui/ilustraciones.js`

**Archivos:**
- Crear: `src/ui/ilustraciones.js`
- Modificar: `build.py` (`SCRIPTS`: agregar `"ui/ilustraciones.js"` después de `"ui/componentes.js"`), `tests/cargar.js` (cargar también `ui/ilustraciones.js`), `src/styles.css` (`.il`, `.il-mini`, `.il-media`, `.il-grande`, animación `il-entra`), `src/ui/kit.js` (sección `ilustraciones` en ambos temas)
- Test: `tests/ilustraciones.test.js`

**Interfaces:**
- Consume: piezas `p-*` (Tarea 4), tokens `--il-*` y `--ave-*` (Tarea 2), `esc()` de `componentes.js`.
- Produce:
  - `ESCENAS: { [clave]: { fondo, ave, piezas, titulo } }`:
    - `fondo` ∈ `'crema'|'menta'|'cielo'|'lila'|'coral'|'salvia'|'durazno'`;
    - `ave` ∈ `'adulta'|'pollito'|'reposo'|null`;
    - `piezas: [[id, x, y, escala]]` para los objetos de la escena;
    - `titulo`: frase literal en español, por ejemplo «Gallina junto al bebedero».
    
    Claves: todas las de §8 del diseño (ajustadas en la Tarea 0) más `gen-generica`.
  - `ESTILO_GENETICA: { [geneticaId]: { forma: 'frijol'|'robusta'|'esbelta', cuerpo: '--ave-*', cresta, cola, barrado: bool, escala: [sx, sy] } }` para las 11 genéticas de `data.js`, con los colores de §7 del diseño.
  - `Ilustracion(clave: string, { tamano = 'media', genetica = null, decorativa = true, titulo = null } = {}): string` devuelve `<svg class="il il-<tamano>" viewBox="0 0 200 200" width=… height=…>`.
    - Tamaños: 48, 96 o 160 px.
    - Fija en un `style` local `--il-c1`, `--il-c2` y `--il-fondo` (no usa ids).
    - Con `decorativa`, lleva `aria-hidden="true" focusable="false"`; si no, `role="img"` y `<title>` escapado con `esc()` (el `titulo` dado o el de la escena).
    - Las claves `gen-*` usan `ESTILO_GENETICA`; `genetica` aplica el estilo de esa genética al ave de cualquier escena.
    - Una clave desconocida devuelve la escena `est-exito`, nunca una cadena vacía.
  - `ilustracionDe(contexto: string, id: string, respaldo?: string): string` devuelve siempre una clave de `ESCENAS`:
    - `registro`: `mortalidad|alimento|huevos|peso|vacuna|sanidad` → `reg-<id>`; respaldo `man-registros`.
    - `alerta`: `mortalidad|sin-registro|postura|vacuna|retiro|etiqueta|fase|inventario|plan` → `al-<id>`; respaldo `al-plan`.
    - `categoriaPlan`:
      - `alimento` → `man-alimento`, `ambiente` → `man-temperatura`, `seleccion` → `man-seleccion`;
      - `limpieza` → `man-bioseguridad`, `agua` → `man-agua`, `registros` → `man-registros`;
      - `plagas` → `san-plagas`, `mortalidad` → `reg-mortalidad`, `llegada` → `man-llegada`;
      - `quimico` → `san-quimico`, `vacuna` → `san-vacuna`;
      - respaldo `man-registros`.
    - `recomendacion`:
      - `alim` → `man-alimento`, `temp` → `man-temperatura`, `hum` → `man-humedad`;
      - `agua` → `man-agua`, `vit` → `man-vitaminas`, `vac` → `san-vacuna`;
      - `san` → `man-bioseguridad`, `casero` → `san-remedio-casero`, `quim` → `san-quimico`;
      - respaldo `man-registros`.
    - `itemRecomendacion`: `t_vent` → `man-ventilacion`, `t_luz` → `man-luz`, `a_fase` → `man-cambio-fase`, `s_desp` → `san-desparasitacion`, `s_peso` → `man-seleccion`, `s_bio` → `man-bioseguridad`; si no, el `respaldo` (la clave de su categoría) o `man-registros`.
    - `estado`: `sin-lotes|sin-alertas|sin-inventario|sin-registros|bienvenida|exito|deshacer` → `est-<id>`; respaldo `est-exito`.
    - `genetica`: id de `GENETICAS` → `gen-<id>`; respaldo `gen-generica`.
    - Un contexto desconocido devuelve `respaldo` o `est-exito`.

- [ ] **Paso 1: escribir las pruebas** en `tests/ilustraciones.test.js` (con `cargar()`):
  - «mapeo completo»:
    - cada `tipo: '…'` de `src/alertas.js` (extraído con regex) da una clave `al-*` presente en `ESCENAS`;
    - cada `{ id: '…', texto:` de `src/vistas/registrar.js` da `reg-*`;
    - cada `CATEGORIAS_PLAN[i].id`, más `vacuna`;
    - cada genética;
    - cada `cat.id` e `item.id` de `construirManejo({ g, modo: modoDe(g, 'huevos'), dias, dFin: 600, aves: 100, alt: 2800 })` para todas las genéticas con `dias` ∈ {3, 30, 100, 200}, más `modoDe(g, 'carne')` en las de tipo `doble`;
    - en todos los casos el resultado es una clave existente.
  - «respaldos»: `ilustracionDe('genetica', 'xyz') === 'gen-generica'`; `ilustracionDe('alerta', 'nuevo') === 'al-plan'`; `ilustracionDe('raro', 'x') === 'est-exito'`; `ilustracionDe('itemRecomendacion', 'zzz', 'man-agua') === 'man-agua'`.
  - «accesibilidad»: la salida por defecto contiene `aria-hidden="true"` y no `role=`; con `{ decorativa: false }` contiene `role="img"` y `<title>Gallina junto al bebedero</title>` (para `man-agua`); `titulo: '<x>'` sale escapado.
  - «reglas de la guía»: para cada clave de `ESCENAS`, la salida no contiene `Gradient`, `<image`, `http`, `filter`, ni la expresión `/\d+\s*(mg|ml|cc|g\/)/i`, ni caracteres en el rango de emojis (`/\p{Extended_Pictographic}/u`); cada `href="#p-…"` existe en `body.html`; las 11 `gen-*` producen cadenas distintas entre sí.
  - «tamaños»: `mini` → `width="48"`, `media` → `96`, `grande` → `160`.
  - «dos Ilustracion seguidas no repiten id»: la concatenación de `Ilustracion('gen-ross308')` y `Ilustracion('gen-criolla')` no contiene ningún atributo `id="`.
- [ ] **Paso 2:** `node tests/run.js`. Esperado: FALLA `ilustraciones.test.js`.
- [ ] **Paso 3:** implementar el módulo y las escenas. Composición: fondo de escena como `<rect width="200" height="200" rx="40" fill="var(--il-fondo)">`, un elemento del concepto y el ave. Tono sereno (§3 de la guía y §8 del diseño); `al-mortalidad` y `reg-mortalidad` usan `ave: 'reposo'`.
- [ ] **Paso 4:** CSS: `.il { display: block; flex: none }` y `@keyframes il-entra` (de `scale(.92)`/`opacity: 0` a 1, 260 ms, `--rebote`) aplicada a `.il-media, .il-grande`, anulada en `@media (prefers-reduced-motion: reduce)`. Kit: la sección `ilustraciones` muestra todas las claves en mini y media en cada tema.
- [ ] **Paso 5:** `node tests/run.js && python3 build.py --kit && python3 tests/e2e/visual.py`. Esperado: todo OK. Medir `du -sb dist` (sin `_kit.html`) y anotarlo.
- [ ] **Paso 6:** commit `feat: biblioteca de ilustraciones y mapeo probado`.

### Task 6 · Tarea 6: Reemplazar `ilustracion()` por la biblioteca

**Archivos:**
- Modificar: `src/ui/componentes.js` (borrar `ilustracion` y `_ilN`), `src/styles.css` (borrar `.il-sol`, `.il-colina*`, `.il-huevo`, `.il-brillo`, `.il-ok`, `.il-brote`, `.il-cola`, `.il-ala`, `.il-cresta`, `.il-pico`, `.il-ojo`, `.il-pata` y `.ilustracion`), `src/vistas/alertas.js:39`, `bienvenida.js:17`, `registrar.js:45`, `lotes.js:31`, `detalleLote.js:64`, `reportes.js:66`, `inicio.js:130`, `src/vistas/inventario.js` (vacío nuevo)

**Interfaces:**
- Consume: `Ilustracion(ilustracionDe('estado', …), { tamano: 'grande' })`.
- Mapeo de usos:
  - `alertas` → `sin-alertas`;
  - `bienvenida` → `bienvenida`;
  - `registrar`, `lotes` e `inicio` → `sin-lotes`;
  - `detalleLote` y `reportes` → `sin-registros`;
  - `inventario` (lista vacía) → `sin-inventario`, dentro de un `.vacia-ilustracion`.

- [ ] **Paso 1:** `grep -rn "ilustracion(" src tests`. Esperado: solo los 7 usos y la definición.
- [ ] **Paso 2:** hacer los reemplazos y borrar el código viejo; agregar el vacío de Inventario.
- [ ] **Paso 3:** `node tests/run.js && python3 build.py --kit && python3 tests/e2e/todo.py && python3 tests/e2e/alertas.py && python3 tests/e2e/lotes.py`. Esperado: todo OK (en `alertas.py`, «sin alertas: 'Todo en orden'» sigue encontrando `.vacia-ilustracion`).
- [ ] **Paso 4:** `python3 tests/e2e/capturas.py fase2`; commit `refactor: estados vacíos con la biblioteca de ilustraciones`; enviar a Nicolás la sección del kit (captura de `dist/_kit.html`, claro y oscuro) y los vacíos como cierre de la Fase 2.

### Task 7 · Tarea 7: Nuevo lote y selector de genética de Planificar

**Archivos:**
- Modificar: `src/vistas/nuevoLote.js` (paso 1: tarjetas de genética; pasos 2–3: encabezados con mini; categorías del plan `.nl-cat-cab` con mini), `src/vistas/planificar.js` (selector de genética), `src/ui/componentes.js` (nuevo componente), `src/styles.css`
- Test: `tests/ui.test.js` (agregar)

**Interfaces:**
- Produce: `TarjetaGenetica({ g, elegida, accion, datos }): string` en `componentes.js`. Es un `<button>` con `Ilustracion(ilustracionDe('genetica', g.id), { tamano: 'media' })`, el nombre (`g.nombre`) y el rasgo (`g.rasgo`), con `aria-pressed` según `elegida` y la clase `tg-elegida` (borde de 2 px `--texto` e insignia salvia). Lo usan las Tareas 7 y 11.

- [ ] **Paso 1:** en `ui.test.js`, «TarjetaGenetica»: para `GENETICAS[0]` la salida contiene `gen-hyline-brown` (en el `<use>` o en un atributo `data-il`), el nombre escapado, `aria-pressed="false"` y `data-accion`; con `elegida: true`, `aria-pressed="true"` y `tg-elegida`. Correr: FALLA.
- [ ] **Paso 2:** implementar y usar el componente en ambos selectores, conservando los `data-accion`, `data-id` y textos que leen `lotes.py` y `planificar.py`.
- [ ] **Paso 3:** `node tests/run.js && python3 build.py && python3 tests/e2e/lotes.py && python3 tests/e2e/planificar.py && python3 tests/e2e/planificar_golden.py && python3 tests/e2e/todo.py`. Esperado: todo OK.
- [ ] **Paso 4:** commit `feat: tarjetas ilustradas de genética en Nuevo lote y Planificar`.

### Task 8 · Tarea 8: Inicio, Lotes y Detalle del lote

**Archivos:**
- Modificar: `src/vistas/inicio.js`, `src/vistas/lotes.js`, `src/vistas/detalleLote.js`, `src/styles.css`

**Interfaces:**
- Consume: `Ilustracion`, `ilustracionDe('genetica' | 'registro', …)`.
- Inicio: la cabecera lleva el ave media de la genética del lote seleccionado (`gen-generica` en la vista de todos los lotes). Las tarjetas KPI llevan superficie tintada según su estado: `--t-salvia` verde, `--t-durazno` ámbar, `--t-coral` rojo, `--superficie` sin estado.
- Lotes: cada `.lote-item` lleva una mini de su genética.
- Detalle: la cabecera lleva el ave media; cada fila `.dl-reg` del historial, la mini `ilustracionDe('registro', r.tipo)`.

- [ ] **Paso 1:** implementar.
- [ ] **Paso 2:** `python3 build.py && python3 tests/e2e/lotes.py && python3 tests/e2e/registro.py && python3 tests/e2e/todo.py`. Esperado: todo OK.
- [ ] **Paso 3:** commit `feat: Inicio, Lotes y Detalle con ilustraciones`.

### Task 9 · Tarea 9: Hoja Registrar y avisos

**Archivos:**
- Modificar: `src/vistas/registrar.js` (`htmlTipos`), `src/app.js` (toast de éxito con **Deshacer**), `src/styles.css`

**Interfaces:**
- Cada botón de `TIPOS` lleva `Ilustracion(ilustracionDe('registro', t.id), { tamano: 'mini' })` sobre su texto. El botón sigue ≥ 56 px y la rejilla no desborda en 360 px.
- El toast de éxito muestra una mini `est-exito`. Tras **Deshacer**, el toast muestra `est-deshacer`.

- [ ] **Paso 1:** implementar.
- [ ] **Paso 2:** `python3 build.py && python3 tests/e2e/registro.py && python3 tests/e2e/todo.py`. Esperado: todo OK.
- [ ] **Paso 3:** commit `feat: hoja Registrar ilustrada`.

### Task 10 · Tarea 10: Alertas y Plan del ciclo

**Archivos:**
- Modificar: `src/vistas/alertas.js`, `src/vistas/planCiclo.js`, `src/styles.css`

**Interfaces:**
- Alertas: cada `.al-card` lleva la mini `ilustracionDe('alerta', a.tipo)` y una superficie según `gravedad`: `rojo` → `--t-coral`, `ambar` → `--t-durazno`, `info` → `--superficie`. El texto rojo usa `--alerta`. Se conserva `.al-rojo`.
- Plan del ciclo: cada `.pc-item` lleva la mini `ilustracionDe('categoriaPlan', t.categoria)` (y `'vacuna'` en `.pc-vacuna`). `.pc-retiro` lleva la mini `san-retiro` sobre `--t-coral`. `.pc-etiqueta` va sobre `--t-durazno`.

- [ ] **Paso 1:** implementar.
- [ ] **Paso 2:** `python3 build.py && python3 tests/e2e/alertas.py && python3 tests/e2e/plan.py && python3 tests/e2e/todo.py`. Esperado: todo OK.
- [ ] **Paso 3:** commit `feat: Alertas y Plan del ciclo ilustrados`.

### Task 11 · Tarea 11: Inventario, Reportes, Planificar, Más, Ajustes y Bienvenida

**Archivos:**
- Modificar: `src/vistas/inventario.js`, `src/vistas/reportes.js`, `src/vistas/planManejo.js`, `src/vistas/planEstado.js`, `src/vistas/planProyeccion.js`, `src/vistas/mas.js`, `src/vistas/ajustes.js`, `src/vistas/bienvenida.js`, `src/ui/grafico.js` (colores de serie), `src/styles.css`

**Interfaces:**
- Inventario: cada ítem lleva la mini `man-alimento`.
- Planificar · manejo: cada categoría de `construirManejo` lleva la media `ilustracionDe('recomendacion', cat.id)` en la cabecera. Los ítems con escena propia, la mini `ilustracionDe('itemRecomendacion', item.id, <clave de la categoría>)`.
- Gráficas: la serie real en `--ok` y la estándar en `--secundario` punteada. En la proyección, las líneas y áreas van en sólido sin degradado.
- Más y Ajustes: solo tokens nuevos; sin escenas.
- Bienvenida: `est-bienvenida` grande (ya hecho en la Tarea 6) y campos con los tokens nuevos.

- [ ] **Paso 1:** implementar.
- [ ] **Paso 2:** `python3 build.py --kit && python3 tests/e2e/reportes.py && python3 tests/e2e/planificar.py && python3 tests/e2e/planificar_golden.py && python3 tests/e2e/db.py && python3 tests/e2e/migracion.py && python3 tests/e2e/visual.py && python3 tests/e2e/todo.py`. Esperado: todo OK.
- [ ] **Paso 3:** `python3 tests/e2e/capturas.py fase3`; commit `feat: resto de pantallas con el estilo nuevo`; enviar a Nicolás las capturas de la Fase 3.

### Task 12 · Tarea 12: Cierre (Fase 4)

**Archivos:**
- Modificar: `src/sw.js` (`CACHE = 'appollo-v6'`), `tests/e2e/todo.py` (líneas 226 y 229: `appollo-v6`), `build.py` (`theme-color` claro y manifest `background_color`/`theme_color` a `#F7F3E8`), `README.md` (fuentes, tokens y la quita de «estilo visual pendiente» en Limitaciones)
- Proyecto claude.ai: actualizar `claude/appollo-version-1.md` con lo mismo (`project_read` → editar → `project_write`)

- [ ] **Paso 1:** en `todo.py`, cambiar a `appollo-v6`. Correr `python3 build.py && python3 tests/e2e/todo.py`. Esperado: FALLA «el caché 'appollo-v6' es el único».
- [ ] **Paso 2:** subir `CACHE`, actualizar el `theme-color` y el manifest, y el README.
- [ ] **Paso 3:** verificación completa (skill superpowers:verification-before-completion). Correr `python3 build.py && python3 build.py --kit && node tests/run.js` y luego las 12 e2e: `todo`, `lotes`, `registro`, `alertas`, `reportes`, `planificar`, `planificar_golden`, `plan`, `db`, `migracion`, `visual` y `capturas final`. Esperado: `14/14 archivos de prueba OK` y `TODO OK` en cada e2e. Guardar la salida.
- [ ] **Paso 4:** medir `du -sb dist` (sin `_kit.html`) y `wc -c artifact.html` frente a la línea base (591.937 / 595.060 bytes).
- [ ] **Paso 5:** commit `chore: caché appollo-v6, color de tema crema y documentación del estilo nuevo`. Entregar a Nicolás:
  - el resumen con las pantallas que cambiaron;
  - la lista de ilustraciones;
  - el peso antes y después;
  - la salida de cada comando;
  - las capturas claras y oscuras de Inicio, Nuevo lote, Registrar, Alertas y Plan del ciclo;
  - la rama `estilo-visual` como parche (`git format-patch main`) o como ZIP. Desde esta sesión no se puede subir a GitHub.
