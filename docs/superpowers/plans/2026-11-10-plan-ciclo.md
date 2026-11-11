# Plan del ciclo y controles químicos — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que cada lote tenga un plan de ciclo seleccionable (manejo completo + controles químicos con retiro) al que se puedan agregar y quitar labores en cualquier momento.

**Architecture:** Catálogo de tareas en código (`src/catalogo.js`, solo lectura, con fuentes) + almacén IndexedDB nuevo `planTareas` (una fila por tarea del lote) + lógica pura en `src/calc.js` y reglas en `src/alertas.js` + servicio `src/plan.js` (operaciones con DB y Deshacer) + dos vistas (paso de Nuevo lote y pestaña del detalle) + hoja "Agregar labor". Las vacunas siguen en `vacunasPlan` y se muestran junto al plan sin migrarlas.

**Tech Stack:** HTML/CSS/JS plano concatenado por `build.py` (sin bundler), IndexedDB con respaldo en memoria, pruebas `node tests/run.js` (vm) y Playwright en Python (chromium, 360×740).

**Spec:** `docs/superpowers/specs/2026-11-10-plan-ciclo-design.md`

## Global Constraints

- Idioma de la interfaz: español; números con coma decimal (`formatoNumero`).
- Fechas de registro: texto local `YYYY-MM-DD` (`hoyLocal`, `fechaADate`); **nunca** `toISOString()` para fechas de registro. Zona de pruebas: `America/Guayaquil`.
- Contrato de vistas y acciones del proyecto: `VISTAS.x = async params => html`, `VISTAS.x.montar(raiz, params)`, clics por `data-accion` → `ACCIONES[nombre](el, ev)`, `App.refrescar()`, `App.toast(msg, {deshacer})`.
- Sin dosis de productos en el catálogo nuevo. Cada tarea química lleva ingrediente activo o tipo de producto, `retiroHuevoDias`, `retiroCarneDias`, fuente y la advertencia fija: «Confirma producto, dosis y retiro con la etiqueta y tu veterinario.»
- Cero datos de salud animal sin fuente citada; lo que no se pueda respaldar se omite.
- Botones y controles primarios ≥ 56 px; sin desborde horizontal a 360 px; claro y oscuro; offline.
- No modificar `src/model.js`, `src/data.js` ni `/home/claude/appollo` (master). Paridad del planificador: `tests/e2e/planificar.py` y `planificar_golden.py` siguen pasando sin cambios en `planificar.golden.json`.
- Un lote cerrado tiene el plan en solo lectura.
- Commits con `git -c user.email=nichito25@gmail.com -c user.name=Nicolás commit` y los dos trailers: `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>` y `Claude-Session: https://claude.ai/code/session_01Mgq5PCVVYLeCeRWfdPA5Ja`.
- El estilo visual nuevo (subproyecto A) NO se mezcla aquí; las pantallas nuevas usan los componentes y tokens actuales.

## Review Focus

1. Quitar una tarea química ya aplicada no debe borrar su retiro vigente (el aviso «No vender huevos hasta…» sigue). → Task 4 y 5.
2. Tareas con `cadaDias` en lotes que llegan con edad > 0 o cuyo plan se crea semanas después: no deben generar decenas de vencidas falsas. → Task 4.
3. Reactivar una tarea quitada, o agregar la misma tarea del catálogo dos veces: sin duplicados. → Task 6.
4. Respaldo ida y vuelta e importación de un respaldo viejo sin `planTareas`: no falla y no pierde nada. → Task 3.
5. Tarea propia con título vacío, fecha inválida, repetición 0 o negativa, o título con HTML: rechazo claro y escape en pantalla. → Task 6 y 8.

---

## File Structure

- Create `src/catalogo.js` — datos del catálogo + `CATALOGO_AVISO_QUIMICO` + `tareasDelCatalogo(genetica, modo)`.
- Create `docs/fuentes-catalogo.md` — fuente y fecha de cada tarea química y de cada dato de manejo no trivial.
- Modify `src/db.js` — versión 2, almacén `planTareas`, exportar/importar.
- Modify `src/calc.js` — `proximaFecha`, `estadoTarea`, `retiroVigente`, `validarTareaPropia`.
- Modify `src/alertas.js` — `alertaPlan`, `alertaRetiroPlan`, composición en `generarAlertas`.
- Create `src/plan.js` — global `Plan` (operaciones con DB y Deshacer).
- Modify `src/vistas/nuevoLote.js` — paso «¿Qué vas a hacer en este ciclo?» (de 3 a 4 pasos).
- Create `src/vistas/planCiclo.js` — pestaña del detalle + hoja «Agregar labor».
- Modify `src/vistas/detalleLote.js`, `src/vistas/inicio.js`, `src/vistas/alertas.js` — enganches.
- Modify `build.py` (orden de scripts), `src/sw.js` (cache v5), `README.md`.
- Tests: `tests/catalogo.test.js`, `tests/plan.test.js` (puro + DB en memoria), ampliar `tests/db.test.js` y `tests/alertas.test.js`; e2e `tests/e2e/plan.py`; ampliar `tests/e2e/todo.py`, `migracion.py`.

---

### Task 1: Investigación del contenido del catálogo (sin código de producto)

**Files:**
- Create: `docs/fuentes-catalogo.md`, `docs/catalogo-borrador.json`

**Interfaces:**
- Produces: `docs/catalogo-borrador.json` = arreglo de objetos con el formato exacto de la Task 2 (`Tarea`), más campo `fuente` (texto con URL y año) en cada tarea; `docs/fuentes-catalogo.md` = tabla `id | fuente | fecha de consulta | nota`.

- [ ] **Step 1:** Con WebSearch/WebFetch, reunir de guías de manejo de las genéticas que ya trae `src/data.js` (leer `GENETICAS`), de Agrocalidad (Ecuador) y de FAO/OMSA/WOAH para bioseguridad: tareas por categoría `alimento`, `ambiente` (luz, ventilación, espacio), `seleccion` (despique, selección, descartes), `limpieza` (vacío sanitario, desinfección, cama, pediluvio, visitas), `agua`, `registros`, `plagas`, `mortalidad`, `llegada`, `quimico`. Mínimo 40 tareas; para cada una: `desdeDia`, `hastaDia?`, `cadaDias?`, `modos`, `geneticas?` (ids de `GENETICAS`, omitir si aplica a todas).
- [ ] **Step 2:** Para las tareas `quimico` (desparasitación interna y externa, control de coccidiosis preventivo, desinfección con producto, control de ácaros/piojos, control de roedores y moscas): registrar `tipo`, `ingredienteActivo` (genérico, no comercial), `retiroHuevoDias`, `retiroCarneDias` y la fuente; si una fuente no da un retiro, dejar `retiroHuevoDias: null` y la nota «Sin retiro oficial en la fuente; consulta la etiqueta», y marcar `noPostura: true` cuando el producto no deba usarse en gallinas de huevo para consumo. **Sin dosis.**
- [ ] **Step 3:** Verificar: cada fila de `catalogo-borrador.json` tiene `fuente`; `node -e "JSON.parse(require('fs').readFileSync('docs/catalogo-borrador.json'))"` termina sin error; ninguna tarea contiene los campos `dosis` ni texto con «mg/», «ml/», «g/L».
- [ ] **Step 4: Commit** `docs: borrador del catálogo con fuentes`.

### Task 2: Catálogo en código y su validación

**Files:**
- Create: `src/catalogo.js`, `tests/catalogo.test.js`
- Modify: `build.py` (añadir `"catalogo.js"` en `SCRIPTS` después de `"calc.js"`), `tests/cargar.js` (exponer `CATALOGO`, `tareasDelCatalogo`)

**Interfaces:**
- Produces: `const CATEGORIAS_PLAN = [{id, nombre, icono}]` (ids: `alimento, ambiente, seleccion, limpieza, agua, registros, plagas, mortalidad, llegada, quimico`; `icono` debe existir en el sprite de `src/body.html`).
- Produces: `const CATALOGO = Tarea[]` con `Tarea { id:string, categoria:string, titulo:string, detalle:string, modos:('huevos'|'carne')[], geneticas?:string[], desdeDia:number, hastaDia?:number, cadaDias?:number, quimico?:{tipo:string, ingredienteActivo:string, retiroHuevoDias:number|null, retiroCarneDias:number|null, noPostura?:boolean, advertencia:string}, fuente:string }`.
- Produces: `const CATALOGO_AVISO_QUIMICO = 'Confirma producto, dosis y retiro con la etiqueta y tu veterinario.'`
- Produces: `tareasDelCatalogo(genetica:object, modo:'huevos'|'carne') -> Tarea[]` (filtra por `modos` y `geneticas`, orden por `desdeDia`).

- [ ] **Step 1: Write the failing test** en `tests/catalogo.test.js`: `ids únicos`; `toda tarea tiene categoría de CATEGORIAS_PLAN`; `desdeDia entero ≥ 0, hastaDia ≥ desdeDia, cadaDias entero ≥ 1`; `toda tarea tiene fuente no vacía`; `toda tarea con quimico tiene advertencia === CATALOGO_AVISO_QUIMICO`, `retiroHuevoDias` y `retiroCarneDias` número ≥ 0 o null, y **ningún** campo `dosis` ni patrón /\d\s*(mg|ml|g)\s*\/\s*(kg|l|ave)/i en título/detalle/quimico; `tareasDelCatalogo(ross308,'carne')` no incluye tareas con `modos:['huevos']`; con una genética de postura devuelve primero la tarea de menor `desdeDia`.
- [ ] **Step 2: Run** `node tests/run.js` → FAIL (`CATALOGO` no definido).
- [ ] **Step 3: Implement** `src/catalogo.js` convirtiendo `docs/catalogo-borrador.json` (quitando `fuente` de la vista, pero conservándola en cada objeto) y `tareasDelCatalogo`; `titulo` y `detalle` en español claro para un productor, ≤ 140 caracteres de título.
- [ ] **Step 4: Run** `node tests/run.js` y `python3 build.py` → PASS.
- [ ] **Step 5: Commit** `feat: catálogo de tareas del ciclo`.

### Task 3: Almacén `planTareas`, migración y respaldo

**Files:**
- Modify: `src/db.js` (`VERSION = 2`, `STORES` += `'planTareas'`, índice `loteId` en `onupgradeneeded` solo para stores nuevos, `exportar`, `importar`), `tests/db.test.js`, `tests/e2e/migracion.py`

**Interfaces:**
- Consumes: API actual de `DB` (`listar`, `guardar`, `borrar`, `obtener`, `exportar`, `importar`).
- Produces: store `planTareas` con filas `{ id, loteId, origen:'catalogo'|'propia', catalogoId?, categoria, titulo, detalle, desdeDia, cadaDias?, hastaDia?, fechaBase, estado:'activa'|'quitada', quitadaEn?, hechas:[{fecha, nota?, producto?}], creado }`. `fechaBase` = fecha local de la que se cuenta `desdeDia` (la fecha de nacimiento aproximada del lote: `fechaLlegada` − `edadLlegadaDias`).
- `importar` acepta respaldos sin `planTareas` (lo trata como `[]`) y normaliza `id` y `loteId` a texto en `planTareas`.

- [ ] **Step 1: Write the failing tests** en `tests/db.test.js`: `guardar/listar planTareas por loteId`; `exportar incluye planTareas`; `importar un respaldo v2 sin planTareas no falla y deja []`; `importar con loteId numérico 5 lo guarda como "5"`; `importar un respaldo con planTareas ida y vuelta es idéntico`. En `migracion.py`: abrir una base IndexedDB versión 1 con datos (crearla desde la página de la versión anterior con `indexedDB.open('appollo',1)` y los 5 stores), recargar con la app nueva y comprobar que los lotes siguen y que `planTareas` existe vacío.
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement** el cambio de versión (`onupgradeneeded` crea solo los stores que no existen: `if (!db.objectStoreNames.contains(s))`) y la normalización en `importar`.
- [ ] **Step 4: Run** `node tests/run.js` y `python3 tests/e2e/migracion.py` → PASS.
- [ ] **Step 5: Commit** `feat: almacén planTareas y migración de base`.

### Task 4: Lógica pura del plan en `calc.js`

**Files:**
- Modify: `src/calc.js`, `tests/cargar.js` (exponer las funciones nuevas), `tests/plan.test.js` (parte pura)

**Interfaces:**
- Produces: `proximaFecha(t, hoy:string) -> string|null` — primera fecha ≥ la última hecha + `cadaDias`, o `fechaBase + desdeDia` si no hay hechas; con `cadaDias` y sin hechas, la primera ocurrencia es la **más próxima ≥ hoy − 0** (las ocurrencias anteriores a `hoy` que nadie hizo no se cuentan como vencidas más allá de la última; solo la inmediatamente anterior si cae dentro de 3 días); `null` si `hastaDia` ya pasó o si `estado === 'quitada'`.
- Produces: `estadoTarea(t, hoy) -> 'hecha'|'atrasada'|'hoy'|'proxima'|'quitada'|'omitida'` (`hecha` = tarea única ya hecha; las repetitivas se miden por `proximaFecha`; `omitida` = pasó `hastaDia` sin hechas).
- Produces: `retiroVigente(tareas, vacunasPlanAplicadas, hoy) -> {huevo:string|null, carne:string|null}` — máximo de `fechaHecha + retiroXDias` de todas las aplicaciones químicas **hechas** (incluidas las de tareas quitadas) con retiro > hoy.
- Produces: `validarTareaPropia(o) -> {mensaje}|{tarea}` — título 1–80 caracteres, `categoria` en `CATEGORIAS_PLAN`, fecha válida (`fechaValida`), `cadaDias` vacío o entero 1–365.

- [ ] **Step 1: Write the failing tests** en `tests/plan.test.js`: tarea única `desdeDia:7` con `fechaBase` 2026-11-01 → `proximaFecha` = 2026-11-08, `estadoTarea` en 2026-11-09 = `atrasada`, en 2026-11-08 = `hoy`, en 2026-11-07 = `proxima`; hecha → `hecha`; tarea `cadaDias:7`, `desdeDia:0`, lote de 60 días sin hechas, `hoy` = fechaBase+60 → una sola vencida como máximo (no 8); con hecha en fechaBase+56 → próxima fechaBase+63; `hastaDia:30` y hoy en el día 45 sin hechas → `omitida` y `proximaFecha` null; `quitada` → `quitada`; `retiroVigente` con una aplicación química hecha el 2026-11-01 con `retiroHuevoDias:7` → en 2026-11-05 `{huevo:'2026-11-08', carne:null}`, y sigue igual si la tarea está `quitada`; en 2026-11-09 → `{huevo:null,…}`; `validarTareaPropia({titulo:'',…})` → mensaje; `'<img onerror>'` como título es válido pero se conserva tal cual (el escape es de la vista); `cadaDias:0` → mensaje; fecha `2026-02-30` → mensaje.
- [ ] **Step 2: Run** `node tests/run.js` → FAIL.
- [ ] **Step 3: Implement** las cuatro funciones puras (sin DOM) en `src/calc.js` usando `fechaADate`/`hoyLocal`.
- [ ] **Step 4: Run** → PASS (todas las pruebas previas también).
- [ ] **Step 5: Commit** `feat: lógica pura del plan del ciclo`.

### Task 5: Alertas del plan y del retiro

**Files:**
- Modify: `src/alertas.js`, `tests/alertas.test.js`

**Interfaces:**
- Consumes: `estadoTarea`, `proximaFecha`, `retiroVigente` (Task 4); `datos` de `generarAlertas(datos, hoy)` ahora puede traer `datos.planTareas` (opcional).
- Produces: `alertaPlan(datos, hoy) -> Alerta[]` — `tipo:'plan'`; atrasada → `rojo`; hoy → `ambar`; próxima en ≤ 7 días → `info`; tareas `quitada`/`omitida`/lotes no activos no generan; `id: 'plan-' + t.id`; `accion: {etiqueta:'Ver plan', ruta:'#/lote/<id>'}`.
- Produces: `alertaRetiroPlan(datos, hoy) -> Alerta[]` — `tipo:'retiro'`, `rojo`, texto «No vender huevos hasta el DD/MM» y/o «No vender carne hasta el DD/MM» por lote activo, usando `retiroVigente`.
- `generarAlertas` incluye ambas; el orden por gravedad existente se mantiene.

- [ ] **Step 1: Write the failing tests:** atrasada → rojo con texto que incluye el nombre del lote y de la tarea; hoy → ámbar; a 8 días no genera; quitada no genera; retiro vigente genera rojo aunque la tarea esté quitada; sin `planTareas` en `datos` no falla (respaldos viejos); un lote con genética desconocida no rompe la generación.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat: alertas del plan del ciclo y del retiro`.

### Task 6: Servicio `Plan` (operaciones con DB y Deshacer)

**Files:**
- Create: `src/plan.js` (global `Plan`); Modify: `build.py` (después de `db.js`), `tests/cargar.js`, `tests/plan.test.js` (parte con DB en memoria)

**Interfaces:**
- Consumes: `DB`, `CATALOGO`, `tareasDelCatalogo`, `validarTareaPropia`, `hoyLocal`.
- Produces (todas `async`, devuelven `Promise`):
  - `Plan.crearInicial(lote, genetica, modo, idsCatalogo:string[]) -> TareaFila[]` — crea filas `origen:'catalogo'` solo para los ids dados; `fechaBase` = `fechaLlegada` − `edadLlegadaDias` (en días, con `masDias`); omite las cuyo `hastaDia` < edad actual.
  - `Plan.agregarCatalogo(lote, catalogoId) -> TareaFila` — si ya existe una fila del mismo `catalogoId` y lote: la reactiva (`estado:'activa'`, borra `quitadaEn`) y no duplica.
  - `Plan.agregarPropia(lote, datos) -> {mensaje}|{tarea}` — usa `validarTareaPropia`; `fechaBase` = la fecha elegida − `desdeDia` 0.
  - `Plan.quitar(tareaId) -> deshacer:()=>Promise` / `Plan.reactivar(tareaId) -> deshacer`.
  - `Plan.marcarHecha(tareaId, {fecha?, nota?, producto?}) -> deshacer` — agrega a `hechas`; también crea un registro `registros` tipo `plan` con `datos:{tareaId, titulo, producto}` para que aparezca en el historial; `deshacer` borra ambos.
  - `Plan.mover(tareaId, nuevaFecha) -> deshacer` — ajusta `fechaBase` para que la próxima ocurrencia sea `nuevaFecha`.
  - `Plan.listar(loteId) -> TareaFila[]`; `Plan.borrarDeLote(loteId)` (usado por «Borrar lote»).
  - Tareas de un lote cerrado: todas las operaciones de escritura devuelven `{mensaje:'El lote está cerrado'}` sin cambiar nada.

- [ ] **Step 1: Write the failing tests** (DB en memoria): `crearInicial` con 3 ids crea 3 filas; `agregarCatalogo` dos veces → 1 fila; tras `quitar`, `agregarCatalogo` la reactiva sin duplicar; `marcarHecha` crea registro y `deshacer` los quita ambos; `quitar` + `deshacer` restaura exactamente la fila; `agregarPropia` con `<b>x</b>` guarda el texto literal; título vacío → `{mensaje}`; lote cerrado → mensaje y nada cambia; `marcarHecha` de una química guarda `producto` y `retiroVigente` lo cuenta; `borrarDeLote` elimina solo las de ese lote.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement** `src/plan.js`. **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat: servicio Plan con agregar, quitar, reactivar, hecho y deshacer`.

### Task 7: Paso «¿Qué vas a hacer en este ciclo?» en Nuevo lote

**Files:**
- Modify: `src/vistas/nuevoLote.js` (3 → 4 pasos; `crear` llama `Plan.crearInicial`), `tests/nuevolote.test.js`, `tests/e2e/lotes.py`

**Interfaces:**
- Consumes: `CATEGORIAS_PLAN`, `tareasDelCatalogo`, `Plan.crearInicial`.
- Produces: estado `st.plan = Set<catalogoId>` (por defecto: todas las sugeridas para la genética y el modo); paso 3 nuevo con categorías plegables, casilla por tarea (con aviso químico donde aplique), botones «Todo» / «Ninguno» por categoría y contador «N tareas elegidas»; el paso de altitud y galpón pasa a ser el 4.
- Reglas: el lote se crea aunque no se elija ninguna tarea; `data-accion` nuevos con prefijo `nl-plan-`.

- [ ] **Step 1: Write the failing tests** (unit: el estado inicial contiene solo tareas del modo/genética correctos; e2e en `lotes.py`): crear un lote de ponedora, en el paso 3 hay categorías, «Ninguno» en una categoría desmarca todas sus tareas, continuar y crear → `DB.listar('planTareas',{loteId})` tiene exactamente las marcadas; crear con todo desmarcado → lote creado y 0 filas.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** `node tests/run.js`, `python3 tests/e2e/lotes.py` → PASS.
- [ ] **Step 5: Commit** `feat: elegir las tareas del ciclo al crear el lote`.

### Task 8: Pestaña «Plan del ciclo» y hoja «Agregar labor»

**Files:**
- Create: `src/vistas/planCiclo.js`; Modify: `src/vistas/detalleLote.js` (selector de pestañas Resumen | Plan del ciclo; Borrar lote llama `Plan.borrarDeLote`), `src/styles.css` (solo clases nuevas con los tokens actuales), `tests/e2e/plan.py`

**Interfaces:**
- Consumes: `Plan.*`, `estadoTarea`, `proximaFecha`, `retiroVigente`, `CATEGORIAS_PLAN`, `CATALOGO_AVISO_QUIMICO`, `Hoja` o el mecanismo de hoja modal existente en `registrar.js`.
- Produces: `PlanCiclo.html(lote, tareas, vacunas, hoy) -> string` y las acciones `pc-hecho`, `pc-quitar`, `pc-reactivar`, `pc-mover`, `pc-editar`, `pc-agregar` (abre hoja con pestañas «Del catálogo» y «Propia»). Secciones: Atrasadas / Esta semana / Próximas / Hechas / Quitadas (plegada). Vacunas del lote aparecen en las mismas secciones, con el botón existente `dl-aplicar`. Las tareas químicas muestran tarjeta con tipo/ingrediente activo, retiro huevo/carne y la advertencia fija. Todo texto de usuario va por `esc()`.

- [ ] **Step 1: Write the failing e2e** `tests/e2e/plan.py` (360×740, claro y oscuro, zona America/Guayaquil, util.py `esperar`): lote con plan → pestaña muestra secciones; «Hecho» mueve la tarea a Hechas y aparece en el historial; Deshacer la devuelve; «Quitar» la pasa a Quitadas y el toast permite Deshacer; reactivar desde Quitadas; «+ Agregar labor» → del catálogo agrega una tarea nueva (y buscarla por texto); pestaña «Propia» con título `<img src=x onerror=alert(1)>` se muestra como texto (sin ejecutar) y con título vacío muestra el mensaje; una tarea química hecha muestra el retiro y Alertas muestra «No vender huevos hasta…»; quitar esa tarea no apaga el aviso; lote cerrado → sin botones de edición; sin desborde en claro/oscuro; botones ≥ 56 px.
- [ ] **Step 2: Run** `python3 tests/e2e/plan.py` → FAIL. **Step 3: Implement.** **Step 4: Run** → PASS, y repetir `lotes.py`, `registro.py`, `alertas.py` para confirmar que no hay regresiones.
- [ ] **Step 5: Commit** `feat: pestaña Plan del ciclo con agregar y quitar labores`.

### Task 9: Enganches en Inicio y Alertas, y lotes sin plan

**Files:**
- Modify: `src/vistas/inicio.js`, `src/vistas/alertas.js`, `src/app.js` (datos para `generarAlertas` incluyen `planTareas`), `tests/e2e/alertas.py`

**Interfaces:**
- Consumes: `generarAlertas` (Task 5), `Plan.marcarHecha`.
- Produces: en Alertas, las de tipo `plan` ofrecen «Hecho» (usa `Plan.marcarHecha` con Deshacer); lotes activos con 0 filas de plan muestran **una vez** una tarjeta «Elegir tareas del ciclo» en Inicio que abre la pestaña del plan; tras elegir o descartar no vuelve a salir (`localStorage` `appollo.v2.planAvisado:<loteId>` envuelto en try/catch).

- [ ] **Step 1: Write the failing e2e** (en `alertas.py`): tarea vencida → alerta roja → «Hecho» la quita de alertas y Deshacer la restaura; lote sin plan → tarjeta única que desaparece tras abrirla. **Step 2–4:** run FAIL → implement → PASS (`alertas.py`, `todo.py`). **Step 5: Commit** `feat: plan en Inicio y Alertas`.

### Task 10: QA de conjunto, migración, README y entrega

**Files:**
- Modify: `tests/e2e/todo.py` (incluir plan), `src/sw.js` (`CACHE = 'appollo-v5'`), `README.md` (nueva sección + «Limitaciones conocidas»: sin dosis, catálogo de referencia, estilo visual pendiente, inconsistencia: el Planificador original muestra dosis en sus tratamientos reactivos y el plan nuevo no), `docs/fuentes-catalogo.md`

- [ ] **Step 1:** Ampliar `todo.py` con el recorrido «crear lote con plan → hecho → quitar → agregar propia → alertas → respaldo → importar → offline». Correr `python3 build.py && node tests/run.js` y **todos** los e2e (`db, registro, lotes, alertas, reportes, planificar, planificar_golden, plan, migracion, todo`; `build.py --kit` + `visual.py`) dos veces seguidas; todos PASS y `planificar.golden.json` sin cambios (`git diff --stat` vacío para ese archivo).
- [ ] **Step 2:** Regenerar `dist/` y `artifact.html`; commit `chore: plan del ciclo, QA y README`. No subir ni publicar; lo hace el controlador.

---

## Self-Review (hecha)

- **Cobertura del spec:** catálogo y fuentes → T1–T2; almacén y migración → T3; lógica de fechas/retiro → T4; alertas → T5; agregar/quitar/reactivar/propias/hecho/deshacer → T6 y T8; selección al crear → T7; pestaña y hoja → T8; Inicio/Alertas y lote sin plan → T9; pruebas y entrega → T10. El estilo (A) queda explícitamente fuera y tiene su propio spec posterior.
- **Consistencia de tipos:** `TareaFila` definida en T3 y usada con los mismos campos en T4–T9; `Tarea` del catálogo en T2; `retiroVigente` devuelve `{huevo, carne}` en T4 y se consume igual en T5 y T8.
- **Proporción:** el plan nombra interfaces y pruebas; los cuerpos los escribe quien implementa.
