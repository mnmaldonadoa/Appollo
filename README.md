# Appollo 2 · Gestión de gallinas por genética

Aplicación móvil (PWA) que funciona **sin internet**. Sirve para llevar el día a día de la granja y, además, para planificar un lote antes de comprarlo.

- **Gestión diaria:** crea tus lotes y registra en pocos toques la mortalidad, el alimento, los huevos, el peso, las vacunas y los problemas de sanidad. Appollo calcula el estado de cada lote (aves vivas, % de postura, mortalidad frente al estándar de la genética) y avisa lo que toca hacer.
- **Planificar:** elige la genética, la edad, las aves y la altitud, marca las prácticas de manejo y obtén la proyección de huevos o carne. Con **Crear lote con este plan** pasas directo al alta de un lote con esos datos.
- Todo se guarda en el teléfono (IndexedDB). Nada sale del dispositivo salvo el respaldo que tú compartas.

## Flujo de uso

1. **Bienvenida** (primera vez): nombre de la granja y qué aves crías.
2. **Nuevo lote** en 3 pasos: genética, aves y edad (o fecha de llegada), altitud y galpón. Se genera el calendario de vacunas del lote.
3. **Inicio:** tarjetas con aves vivas, mortalidad, producción, alimento y estado sanitario; botón central **Registrar** disponible en toda la app.
4. **Registrar** (hoja inferior): mortalidad, alimento, huevos, peso, vacuna o sanidad en 3 toques o menos, con **Deshacer**.
5. **Lotes** y **detalle del lote:** historial, gráfica frente al estándar, vacunas pendientes, cerrar o reabrir el lote.
6. **Alertas:** mortalidad alta, atraso de registros, vacunas, retiros, cambio de fase e inventario bajo. La insignia de la barra cuenta las urgentes.
7. **Plan del ciclo** (pestaña del detalle del lote): ver abajo.
8. **Más:** Inventario (el alimento registrado descuenta del stock), Reportes (resumen por periodo, copiar o compartir), Planificar y Ajustes (granja, precios, tema claro/oscuro, respaldo y restauración).

## Plan del ciclo

Cada lote nuevo puede llevar un plan de labores para todo su ciclo, tomado de un catálogo de referencia (`src/catalogo.js`; fuentes en `docs/fuentes-catalogo.md`). Se elige al crear el lote y se ve en la pestaña **Plan del ciclo** del detalle del lote.

- Las labores se agrupan en **Atrasadas**, **Esta semana**, **Próximas**, **Hechas** y **Quitadas**, con su fecha según la edad del lote. Una labor única sin edad límite que pasa 30 días sin hacerse queda como **omitida** (en Hechas) y deja de avisar.
- **Hecho** guarda la labor (con producto y nota si es un químico) y deja un registro de tipo `plan` en el historial; **Deshacer** lo revierte.
- En un químico, la fecha de **Hecho** es el **último día de tratamiento (última dosis)**: el retiro se cuenta desde el último día que las aves recibieron el producto. Si el tratamiento dura varios días, se puede volver a tocar **Hecho** en la labor ya hecha para anotar el último día real; cuenta la fecha más reciente.
- La hoja **Hecho** de un químico trae un campo opcional **Días de retiro según la etiqueta** (huevo y carne; en lotes de carne solo carne), entero de 0 a 365. Si se anota, manda sobre el retiro del catálogo.
- Si las aves recibieron un químico sin retiro conocido (ni en el catálogo ni anotado de la etiqueta), durante 14 días el plan y las alertas muestran en ámbar «Aplicaste … el DD/MM: revisa en la etiqueta el retiro en huevos (o carne) antes de venderlos».
- **Quitar** saca una labor del plan sin borrarla y **Reactivar** la devuelve. **Agregar** permite sumar labores del catálogo o **propias**.
- Los químicos hechos con retiro mueven las alertas rojas: **No vender huevos hasta…** y **No vender carne hasta…**, contados desde el último día de tratamiento registrado.
- En **Alertas**, las labores atrasadas salen en ámbar y juntas, una por lote («N labores atrasadas · lote», con **Ver plan**); las de hoy y de los próximos 7 días salen una por una. **Hecho** desde Alertas guarda con un toque solo las labores que no son químicos; en un químico abre la hoja para anotar el último día de tratamiento.
- Las labores viajan en el respaldo (exportar e importar) y funcionan sin conexión. Un respaldo hecho con esta versión (con `planTareas`) lo rechaza una versión anterior de la app («datos desconocidos»).
- Un lote sin plan sigue funcionando igual que antes.

## Estructura

```
src/
  data.js        Base técnica: genéticas, vacunas, enfermedades y remedios (editar aquí)
  model.js       Fases, recomendaciones por edad y modelo de proyección
  calc.js        Cálculos puros del lote: edad, aves vivas, % de postura, mortalidad, validación de registros, reportes
  alertas.js     Reglas de las alertas (puro)
  db.js          IndexedDB (con respaldo en memoria): listar, obtener, guardar, borrar, exportar e importar
  app.js         Rutas (#/inicio, #/lotes, #/lote/ID, #/alertas, #/mas, #/inventario, #/reportes, #/ajustes, #/plan/...), hojas, toasts
  ui/            Componentes, gráficos, animaciones e ilustraciones (ilustraciones.js); kit.js/kit.css es el muestrario visual
  vistas/        Una pantalla por archivo (inicio, lotes, nuevoLote, detalleLote, registrar, alertas, inventario, reportes, ajustes, planificar*)
  styles.css     Sistema visual: tokens de color, espacio y radios, tema claro y oscuro
  body.html      Íconos (sprite SVG) y contenedores de la app
  fonts/         Tipografías incluidas (Atkinson Hyperlegible, Nunito): no se pide nada a internet
  sw.js          Service worker: guarda la app para usarla sin conexión
build.py         Une todo en dist/ y artifact.html
tests/           Pruebas unitarias (Node) y de extremo a extremo (Python + Playwright)
dist/            App lista para publicar (index.html, manifest, sw.js, fuentes, íconos)
android/         Proyecto Capacitor para el APK
docs/superpowers/  Especificación y plan de esta versión
```

## Estilo visual

Plano y minimalista, en pastel mate, sin contornos ni sombras difusas (guía «Minimalist Flat Vector»; diseño en `docs/superpowers/specs/2026-11-24-estilo-visual-design.md`).

- **Tokens** en `src/styles.css`, en claro y oscuro. Los pasteles puros (`--p-*`, `--ave-*`, `--il-fondo-*`) nunca llevan texto. Donde hay texto se usan los tintes `--t-*` con texto carbón `#2D3142`. Los acentos profundos (`--alerta`, `--ok`, `--precaucion`) van solo como texto, borde o botón de acción. `tests/paleta.test.js` calcula el contraste de cada par.
- **Tipografías:** Nunito en títulos y cifras; Atkinson Hyperlegible en el cuerpo.
- **Ilustraciones:**
  - Las piezas `p-*` viven una sola vez en el sprite de `src/body.html`. Se generan con `python3 tools/piezas_ilustracion.py src/body.html`.
  - `src/ui/ilustraciones.js` arma las 53 escenas: `Ilustracion(clave, { tamano: 'mini'|'media'|'grande' })`.
  - Todo dato de la app (registro, alerta, labor, recomendación, genética, inventario) se convierte en escena **solo** con `ilustracionDe(contexto, id)`, que siempre devuelve una clave válida.
  - El inventario completo está en `docs/superpowers/specs/2026-11-24-estilo-visual-inventario.md`.
  - Ninguna ilustración muestra dosis ni cantidades.
- **Capturas** para revisar: `python3 tests/e2e/capturas.py <etiqueta>` (en `capturas/<etiqueta>/`, claro y oscuro).

## Construir y probar

Requisitos: Python 3 con Pillow y Playwright (`pip install pillow playwright && playwright install chromium`) y Node 18 o más.

```
python3 build.py              # genera dist/ y artifact.html
python3 build.py --kit        # además dist/_kit.html (muestrario visual)
node tests/run.js             # pruebas unitarias: cálculos, alertas, validación, inventario, reportes, componentes, planVacunas
python3 tests/e2e/todo.py     # recorrido completo, sin conexión, claro y oscuro, objetivos táctiles, contraste 7:1 y texto recortado
```

Las demás pruebas de extremo a extremo (`tests/e2e/lotes.py`, `registro.py`, `alertas.py`, `reportes.py`, `planificar.py`, `planificar_golden.py`, `plan.py`, `db.py`, `migracion.py`, `visual.py`) se ejecutan igual: `python3 tests/e2e/<nombre>.py`. Cada una levanta su propio servidor `http.server` sobre `dist/` (el service worker y IndexedDB necesitan `http`, no `file://`) y usa un teléfono de 360×740. `visual.py` necesita antes `python3 build.py --kit`.

Reglas que las pruebas vigilan: ningún botón o campo de menos de 56 px de alto, sin desborde horizontal ni en claro ni en oscuro, contraste de texto de al menos 7:1, cero errores de consola y la app completa sin conexión. Para esperar un resultado asíncrono (una escritura en la base) usa `esperar()` de `tests/e2e/util.py`; no uses `wait_for_function` con un predicado que devuelva una Promesa.

## PWA y uso sin conexión

- La primera vez la app debe abrirse desde una dirección `https` (o `http://localhost`). El service worker guarda `index.html`, el manifest, los íconos y las cuatro tipografías en el caché `appollo-v6`; desde entonces abre sin internet y los datos se escriben en el teléfono.
- **Sube el número de `CACHE` en `src/sw.js` en cada versión que publiques** (`appollo-v6` → `appollo-v7`…): sin eso los teléfonos que ya instalaron la app siguen con los archivos viejos. La instalación del service worker descarga los archivos con `cache: 'reload'`, así que nunca guarda copias viejas del caché HTTP.
- La barra de estado y la pantalla de arranque usan el color crema de la app (`#F7F3E8`; `#121A14` en modo oscuro).
- Si el navegador no deja guardar datos (modo privado), aparece un aviso y conviene exportar un respaldo desde **Ajustes**.

## Instalar en el teléfono

1. Sube la carpeta `dist/` a un hosting gratuito (GitHub Pages, Netlify o Cloudflare Pages).
2. Abre la dirección en Chrome del teléfono.
3. Menú ⋮ → **Agregar a la pantalla principal** (o **Instalar app**).

Para probar en la computadora: `cd dist && python3 -m http.server 8000` y abre `http://localhost:8000`.

## Generar el APK

El proyecto incluye Capacitor (`android/`) y el flujo `.github/workflows/android.yml`.

1. Reconstruye y sincroniza: `python3 build.py && npx cap sync android`.
2. Sube el repositorio a GitHub. En la pestaña **Actions** corre "Compilar APK de Appollo" (5 a 8 minutos).
3. Descarga **Appollo-apk** de *Artifacts*: dentro está `app-debug.apk`. Cópialo al teléfono e instálalo (permite "instalar apps desconocidas").

Para Play Store se necesita un APK/AAB firmado (*release*) con tu propia llave. Como alternativa rápida, con la app publicada en `https` puedes usar pwabuilder.com y descargar el paquete Android.

## Limitaciones conocidas

- **Respaldo en la app instalada (Android):** el WebView no puede guardar archivos desde la página, así que ahí **Exportar respaldo** muestra el texto para **Copiar respaldo** (pegar en notas o enviártelo) y se recupera con **Pegar respaldo**. En el navegador sí se descarga un `.json`. Un plugin nativo de archivos (p. ej. Filesystem/Share de Capacitor) requeriría cambiar el proyecto Android.
- Las proyecciones guardadas en la versión 1 pasan a **Lotes cerrados** con su edad y un botón **Abrir en Planificador**; no tienen registros ni vacunas.
- Borrar un lote borra también sus registros y vacunas y no se puede deshacer (pide confirmación); no devuelve el alimento descontado del inventario.
- No hay deslizar para borrar (se borra con botón).
- Solo se registra el día de hoy: no hay registro de días pasados.
- No se pueden registrar vacunas no previstas en el calendario.
- El costo de los ítems del inventario se guarda pero aún no se usa en Reportes.
- La alerta de "sin registro" no tiene el atajo **Registrar**.
- Para doble propósito, la elección de huevos o carne es una sola por lote.
- Los precios viven en dos lugares (Ajustes y los del Planificador).
- El margen superior de pantalla usa `:has()` (Chrome 105 o más); en un WebView más viejo aparece un poco de espacio extra arriba.
- Los colores del ícono de Android (`ic_launcher_background.xml`) los ajusta quien genera el APK.
- Un respaldo con una genética desconocida se importa, pero el lote queda sin genética y sin alertas.

### Plan del ciclo

- **Sin dosis:** el plan muestra el ingrediente activo y el retiro, nunca la dosis. Confirma producto, dosis y retiro con la etiqueta y con tu veterinario.
- **Inconsistencia conocida:** el Planificador original sí muestra dosis en sus tratamientos reactivos; el plan del ciclo no.
- El catálogo es una referencia general y no sustituye al veterinario.
- Los tiempos de retiro del catálogo provienen de fuentes de la Unión Europea, el Reino Unido y Estados Unidos; en Ecuador rige la etiqueta del producto registrado en Agrocalidad.
- Ningún químico del catálogo tiene retiro de huevo mayor que 0 (en `src/catalogo.js` es 0 días o no hay dato en la fuente), así que con el catálogo actual el aviso «No vender huevos hasta…» no se genera; el retiro de carne sí (por ejemplo, 7 días para flubendazol).
- **Programa de luz:** el texto de `src/model.js` (`programaLuz`) dice subir 15–30 min por semana; la guía Hy-Line Max da pasos de 30–60 min (la HL 2018 no da minutos). Pendiente de armonizar.
- **Huecos del catálogo:** criolla, campero, doble propósito (Rhode Island, Plymouth Rock) solo tienen la labor general de acceso al alimento, sin cambios de fase de alimento; Hisex Brown solo tiene las dos labores de peso de postura; para Ross 308 solo hay dos cambios (día 11 a Crecimiento, día 25 a Engorde) y no hay un segundo Finalizador.
- Las pestañas del detalle del lote no se recorren con las flechas del teclado.

## Sobre los datos

- Las curvas de postura y peso parten de las guías publicadas por cada casa genética (Hy-Line 2024, Lohmann 2021, Hendrix ISA/Hisex, Aviagen Ross 308 2022, Cobb500 2022). Doble propósito, campero y criolla usan valores medios de referencia.
- El efecto de cada práctica de manejo, de la altitud y de las enfermedades son coeficientes de referencia, no mediciones. Conviene calibrarlos con registros reales de granjas.
- Las dosis de medicamentos son referenciales. Toda medicación requiere diagnóstico y receta de un médico veterinario y respetar el tiempo de retiro.
- El calendario de vacunación es una guía; debe ajustarse con el veterinario y con los programas de Agrocalidad.

## Subir a GitHub y obtener el APK

1. Crea un repositorio vacío en GitHub (sin README) y, desde esta carpeta:
   `git remote add origin https://github.com/TU_USUARIO/appollo.git`
   `git push -u origin appollo-2` (o fusiona antes con `main`).
2. En la pestaña **Actions** se ejecuta «Compilar APK de Appollo» con cada push (también con «Run workflow»).
3. Al terminar, descarga el artefacto **Appollo-apk** (`app-debug.apk`) e instálalo en el teléfono (permite «orígenes desconocidos»).
4. Es un APK de depuración; para publicar en Play Store hay que firmar uno de release.
