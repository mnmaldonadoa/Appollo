# Appollo 2 · Gestión avícola — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convertir Appollo en una PWA de gestión diaria de granja (registros, inventario, alertas, reportes) con registro en ≤ 3 toques, sin perder el flujo de proyección actual.

**Architecture:** Scripts planos concatenados por `build.py` (sin bundler). Lógica pura y testeable en `calc.js` y `alertas.js`; persistencia en `db.js` (IndexedDB); piezas de interfaz en `ui/` que devuelven HTML; una vista por archivo en `vistas/`; enrutador por hash en `app.js`. `model.js` y `data.js` no cambian de lógica.

**Tech Stack:** HTML/CSS/JS puro, IndexedDB, Service Worker, Python 3 + Pillow (build), Node 22 (`node:assert`, `node:vm`) para pruebas unitarias, Playwright para pruebas de interfaz, Capacitor + GitHub Actions para el APK.

**Spec:** `docs/superpowers/specs/2026-11-03-appollo-gestion-design.md`

## Global Constraints

- Sin React ni paso de compilación aparte de `python3 build.py`; todo funciona sin internet.
- Fechas siempre en hora local como `YYYY-MM-DD` (zona de Ecuador, UTC−5); nunca `toISOString()` para fechas de registro.
- Botones y zonas táctiles ≥ 56 px de alto, separación ≥ 8 px, contador +/− de 64 px; texto ≥ 16 px (base 18 px).
- Paleta: fondo `#F6F1E7`, superficie `#FFFDF8`, primario `#2F6B3A`, texto `#2B2118`, secundario `#6B5A48`, huevo `#E8A317`, cielo `#4A90B8`, alerta `#B23A2B`, precaución `#C77C0E`; contraste de texto ≥ 7:1 en claro y oscuro.
- Fuentes: Atkinson Hyperlegible (texto) y Zilla Slab (títulos/cifras), empaquetadas en `dist/fonts/`, sin Google Fonts.
- Transiciones de pantalla 220 ms; todo animado respeta `prefers-reduced-motion`.
- IndexedDB `appollo` v1; Service Worker `appollo-v2`; todo texto de interfaz en español.
- Valores derivados (aves vivas, % postura, conversión, viabilidad) se calculan, nunca se guardan.
- Commits terminan con: `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>` y `Claude-Session: https://claude.ai/code/session_01Mgq5PCVVYLeCeRWfdPA5Ja`.

## Review Focus

- Mortalidad ingresada mayor que las aves vivas → mensaje "Solo quedan N aves en el lote", no se guarda (Tarea 5).
- Lote con 0 aves vivas o sin registros → % y conversión devuelven `null` y la interfaz muestra "—", nunca `NaN`/`Infinity` (Tarea 1).
- Registro con fecha futura, o retroactivo de otro día, y cambio de día a medianoche local (Tarea 1 y 5).
- IndexedDB no disponible (ventana privada) o importación de respaldo `.json` corrupto → aviso claro, la app sigue usable con datos en memoria (Tarea 3).
- Registro duplicado del mismo tipo y día → pregunta "¿Sumar o reemplazar?" sin perder el dato previo (Tarea 5).

## File Structure

| Archivo | Responsabilidad |
|---|---|
| `tests/cargar.js` | Carga `data.js`+`model.js`+`calc.js`+`alertas.js` en un contexto `vm` y exporta sus funciones. |
| `tests/calc.test.js`, `tests/alertas.test.js` | Pruebas unitarias (`node tests/run.js`). |
| `src/calc.js` | Cálculos puros sobre lote + registros. |
| `src/alertas.js` | Reglas de alerta puras. |
| `src/db.js` | IndexedDB, respaldo, migración, modo memoria. |
| `src/ui/*.js` | `componentes.js`, `grafico.js`, `animar.js`. |
| `src/vistas/*.js` | `inicio`, `lotes`, `nuevoLote`, `detalleLote`, `registrar`, `alertas`, `inventario`, `reportes`, `ajustes`, `bienvenida`, `planificar`. |
| `src/app.js` | Estado global, enrutador, barra de navegación. |
| `src/styles.css`, `src/fonts/` | Tokens, componentes, tema oscuro, fuentes. |
| `tests/e2e/*.py` | Pruebas Playwright en 360×740. |

---

### Task 1: Cálculos puros (`calc.js`)

**Files:** Create `src/calc.js`, `tests/cargar.js`, `tests/run.js`, `tests/calc.test.js`.

**Interfaces:**
- Produces (tipos: `Lote{id,nombre,genetica,avesInicio,fechaLlegada,edadLlegadaDias,galpon,estado}`, `Registro{id,loteId,fecha,tipo,datos}`):
  - `hoyLocal(d?: Date): string`
  - `edadDias(lote, fecha: string): number`
  - `avesVivas(lote, registros, fecha): number`
  - `mortalidadPct(lote, registros, fecha): number|null`
  - `estandarDia(lote, fecha, altitud): {alimentoKg, huevos, hdPct, pesoG, mortEsperada}`
  - `pctPostura(lote, registros, fecha): number|null`
  - `conversion(lote, registros, fecha): number|null`
  - `viabilidad(lote, registros, fecha): number|null`
  - `rendimiento(lote, registros, fecha): number|null` (real ÷ estándar × 100)

- [ ] **Step 1: Crear `tests/cargar.js` y `tests/run.js`.** `cargar.js` lee los archivos de `src/` en orden y los ejecuta con `vm.runInNewContext`, devolviendo el contexto; `run.js` ejecuta todos los `*.test.js` y falla con código ≠ 0 si alguno lanza.
- [ ] **Step 2: Escribir pruebas que fallan** en `tests/calc.test.js`: `hoyLocal(new Date(2026,10,3,23,30))==='2026-11-03'`; lote de 100 aves con registros de mortalidad 3 y 2 → `avesVivas===95`; `mortalidadPct===5`; lote con 0 aves vivas → `pctPostura===null` y `conversion===null`; registros de huevos 90 con 95 aves → `pctPostura` ≈ 94.7; `estandarDia` de `hyline-brown` a 30 semanas devuelve `hdPct` dentro de ±1 del valor de `hdStd`.
- [ ] **Step 3: Ejecutar** `node tests/run.js` → Expected: FAIL (`calc` no definido).
- [ ] **Step 4: Implementar `src/calc.js`** con las firmas de arriba, usando `hdStd`, `consumoPostura`, `pesoStd` y `GENETICAS` de `model.js`/`data.js`. Fechas con `new Date(y,m,d)` locales.
- [ ] **Step 5: Ejecutar** `node tests/run.js` → Expected: PASS.
- [ ] **Step 6: Commit** `feat: cálculos puros de lote`.

### Task 2: Reglas de alerta (`alertas.js`)

**Files:** Create `src/alertas.js`, `tests/alertas.test.js`.

**Interfaces:**
- Consumes: `avesVivas`, `edadDias`, `estandarDia`, `pctPostura`, `hoyLocal` (Tarea 1).
- Produces: `generarAlertas(datos: {lotes,registros,inventario,vacunasPlan}, ahora: Date): Alerta[]` con `Alerta{id, tipo, gravedad:'rojo'|'ambar'|'info', loteId?, texto, accion:{etiqueta, ruta}}`, ordenadas rojo → ámbar → info.

- [ ] **Step 1: Pruebas que fallan** (una por regla, spec §7): vacuna con `fechaPrevista` ayer y sin `fechaAplicada` → rojo; para mañana → ámbar; mortalidad del día = 2,5 × `mortEsperada` → rojo, 1,5 × → ninguna; postura 3 días recientes 4 puntos bajo los 3 previos → ámbar; ítem con cantidad < mínimo → ámbar; registro sanidad con retiro hasta mañana → rojo "No vendas huevos/carne hasta …"; sin registros a las 18:01 → info, a las 17:59 → ninguna; lote cerrado no genera alertas.
- [ ] **Step 2: Ejecutar** `node tests/run.js` → Expected: FAIL.
- [ ] **Step 3: Implementar** `generarAlertas` como composición de una función por regla (`alertaVacunas`, `alertaMortalidad`, `alertaPostura`, `alertaInventario`, `alertaRetiro`, `alertaSinRegistro`, `alertaCambioAlimento`).
- [ ] **Step 4: Ejecutar** `node tests/run.js` → Expected: PASS.
- [ ] **Step 5: Commit** `feat: reglas de alerta`.

### Task 3: Persistencia (`db.js`)

**Files:** Create `src/db.js`, `tests/e2e/db.py`.

**Interfaces:**
- Produces (todas devuelven `Promise`): `DB.abrir(): {modo:'indexeddb'|'memoria'}`; `DB.listar(store, filtro?)`; `DB.obtener(store,id)`; `DB.guardar(store,obj)` (asigna `id` si falta); `DB.borrar(store,id)`; `DB.exportar(): string` (JSON); `DB.importar(texto): {ok, error?}`; `DB.migrarLS(): number` (lotes antiguos importados).
- Stores: `granja`, `lotes`, `registros` (índice `loteId+fecha`), `inventario`, `vacunasPlan` (índice `loteId`).

- [ ] **Step 1: Prueba e2e que falla** (`tests/e2e/db.py`, Playwright sobre `dist/`): guardar y listar un lote; exportar → borrar → importar restaura; `importar('{no es json')` devuelve `{ok:false}` sin tocar datos; con `indexedDB` anulado por script, `abrir()` devuelve `modo:'memoria'`; con `localStorage['appollo.v1.lotes']` previo, `migrarLS()` crea ese número de lotes cerrados una sola vez.
- [ ] **Step 2: Ejecutar** `python3 tests/e2e/db.py` → Expected: FAIL.
- [ ] **Step 3: Implementar `src/db.js`** envolviendo IndexedDB en promesas; si falla `indexedDB.open`, usar un objeto en memoria con la misma interfaz. `importar` valida estructura antes de escribir.
- [ ] **Step 4: Ejecutar** `python3 build.py && python3 tests/e2e/db.py` → Expected: PASS.
- [ ] **Step 5: Commit** `feat: persistencia en IndexedDB con respaldo`.

### Task 4: Sistema visual y componentes

**Files:** Create `src/ui/componentes.js`, `src/ui/grafico.js`, `src/ui/animar.js`, `src/fonts/*.woff2`; Modify `src/styles.css`, `src/body.html` (íconos nuevos), `build.py` (copiar fuentes a `dist/fonts`, `@font-face` local, quitar Google Fonts), `src/sw.js` (cache `appollo-v2` y fuentes).

**Interfaces:**
- Produces (devuelven strings HTML): `Boton({texto, icono, variante:'primario'|'secundario'|'peligro', accion})`, `Tarjeta({titulo, cifra, unidad, estado, icono, pie})`, `Contador({id, valor, min, max, paso})`, `Hoja({titulo, contenido})`, `Esqueleto(n)`, `Grafico({serieReal, serieEstandar, etiquetas})`; en `animar.js`: `contar(el, hasta)`, `palomita(el)`, `vibrar()`, `reducirMovimiento(): boolean`.
- Íconos SVG añadidos al sprite: `i-gallina, i-huevo, i-saco, i-balanza, i-jeringa, i-cruz, i-gota, i-termo, i-inicio, i-mas, i-campana`.

- [ ] **Step 1: Prueba e2e que falla** (`tests/e2e/visual.py`): una página de prueba `dist/_kit.html` generada por `build.py --kit` muestra cada componente; el script comprueba que todo `button, a` visible mide ≥ 56 px de alto, que el contraste de texto de los tokens claro y oscuro es ≥ 7:1 (calculado con la fórmula WCAG) y que `getComputedStyle(body).fontFamily` empieza con "Atkinson".
- [ ] **Step 2: Ejecutar** → Expected: FAIL.
- [ ] **Step 3: Implementar** tokens CSS (claro, oscuro y `prefers-color-scheme`), componentes y animaciones; instalar `@fontsource/atkinson-hyperlegible` y `@fontsource/zilla-slab` solo para copiar los `.woff2` latinos 400/700 a `src/fonts/` (sin añadirlos como dependencia de ejecución).
- [ ] **Step 4: Ejecutar** `python3 build.py --kit && python3 tests/e2e/visual.py` → Expected: PASS.
- [ ] **Step 5: Commit** `feat: sistema visual y componentes`.

### Task 5: Shell, navegación y registro rápido

**Files:** Create `src/vistas/registrar.js`, `tests/e2e/registro.py`; Modify `src/app.js` (nuevo enrutador), `src/body.html`.

**Interfaces:**
- Consumes: `DB.*` (T3), `Hoja`, `Contador`, `palomita`, `vibrar` (T4), `avesVivas`, `estandarDia`, `hoyLocal` (T1).
- Produces: `App.ir(ruta)`, `App.estado` (`{granja, loteActivoId}`), `App.refrescar()`, `App.toast(msg, {deshacer?: fn})`; rutas `#/inicio|lotes|lote/:id|nuevo-lote|alertas|mas|inventario|reportes|ajustes|plan/...`; `Registrar.abrir(tipo?)`; `validarRegistro(tipo, datos, lote, registros, fecha): {ok, mensaje?, duplicado?}` (puro, exportado también a `tests/cargar.js`).

- [ ] **Step 1: Pruebas que fallan.** Unitarias para `validarRegistro`: mortalidad 6 con 5 aves vivas → `mensaje:'Solo quedan 5 aves en el lote'`; peso 0 → inválido; fecha futura → inválido; segundo registro de alimento del mismo día → `duplicado:true`. E2E (`registro.py`): con un lote creado, de Inicio a mortalidad guardada hay ≤ 3 toques; aparece la barra Deshacer 5 s y al tocarla el registro desaparece; con "Sumar" el total del día suma ambos.
- [ ] **Step 2: Ejecutar** `node tests/run.js && python3 tests/e2e/registro.py` → Expected: FAIL.
- [ ] **Step 3: Implementar** barra inferior (Inicio · Lotes · ＋ · Alertas con contador · Más), enrutador con transición de 220 ms, hoja de registro con precarga de alimento/huevos desde `estandarDia`, diálogo "Sumar o reemplazar", deshacer 5 s y captura de errores de vista ("Algo salió mal · Volver al inicio").
- [ ] **Step 4: Ejecutar** ambas pruebas → Expected: PASS.
- [ ] **Step 5: Commit** `feat: navegación y registro rápido`.

### Task 6: Bienvenida, Inicio, Lotes y detalle

**Files:** Create `src/vistas/bienvenida.js`, `inicio.js`, `lotes.js`, `nuevoLote.js`, `detalleLote.js`, `tests/e2e/lotes.py`.

**Interfaces:**
- Consumes: T1–T5. Produces: `nuevoLote.crear({genetica, avesInicio, fechaLlegada|edadDias, altitud, galpon}): Promise<Lote>` que además escribe el `vacunasPlan` desde `vacunasPara(g, modo)` con `fechaPrevista = fechaLlegada + d`.

- [ ] **Step 1: Prueba e2e que falla:** primera apertura muestra bienvenida de 2 pasos; crear lote de Hy-Line Brown con 100 aves crea ≥ 10 vacunas previstas; Inicio muestra aves vivas 100, mortalidad 0 %, estado sanitario "verde"; tras registrar 3 muertes muestra 97 y mortalidad 3 %; lote con edad mayor al máximo de la genética se rechaza con mensaje; fecha de llegada futura se rechaza; Inicio con 0 registros muestra "—" y no `NaN`.
- [ ] **Step 2: Ejecutar** `python3 tests/e2e/lotes.py` → Expected: FAIL.
- [ ] **Step 3: Implementar** las cinco vistas con tarjetas del spec §4, selector Todos/lote, minigráfica de 14 días, calendario de vacunas con "Marcar aplicada" y "Cerrar lote".
- [ ] **Step 4: Ejecutar** → Expected: PASS.
- [ ] **Step 5: Commit** `feat: inicio, lotes y detalle`.

### Task 7: Alertas e inventario

**Files:** Create `src/vistas/alertas.js`, `inventario.js`, `tests/e2e/alertas.py`.

**Interfaces:** Consumes `generarAlertas` (T2), `DB`. Produces `Inventario.descontarAlimento(kg): Promise<void>` llamado desde `Registrar` al guardar alimento si existe ítem con `vinculoAlimento:true`.

- [ ] **Step 1: Prueba e2e que falla:** vacuna vencida produce alerta roja y el contador de la barra; "Marcar hecha" la quita y fija `fechaAplicada`; registrar 50 kg de alimento con ítem de 200 kg deja 150 kg; ítem bajo el mínimo genera alerta ámbar.
- [ ] **Step 2: Ejecutar** → Expected: FAIL.
- [ ] **Step 3: Implementar** ambas vistas y recalcular alertas al abrir la app y tras cada registro.
- [ ] **Step 4: Ejecutar** → Expected: PASS.
- [ ] **Step 5: Commit** `feat: alertas e inventario`.

### Task 8: Reportes y ajustes

**Files:** Create `src/vistas/reportes.js`, `ajustes.js`, `tests/e2e/reportes.py`.

**Interfaces:** Produces `resumenReporte(lote, registros, desde, hasta): {viabilidad, conversion, produccion, pctPostura, costoAlimento, ingreso}` (puro, en `calc.js`, con prueba unitaria) y `textoReporte(resumen, lote): string` para copiar o compartir.

- [ ] **Step 1: Pruebas que fallan:** unitaria de `resumenReporte` con datos fijos y valores esperados escritos a mano; e2e: copiar reporte pone texto en el portapapeles (o usa el respaldo del botón), exportar respaldo descarga un `.json` e importar uno corrupto muestra el aviso sin borrar datos.
- [ ] **Step 2: Ejecutar** `node tests/run.js && python3 tests/e2e/reportes.py` → Expected: FAIL.
- [ ] **Step 3: Implementar** períodos 7 d / 30 d / ciclo, compartir con `navigator.share` si existe, ajustes (granja, tema, respaldo).
- [ ] **Step 4: Ejecutar** ambas → Expected: PASS.
- [ ] **Step 5: Commit** `feat: reportes y ajustes`.

### Task 9: Planificar (flujo existente)

**Files:** Create `src/vistas/planificar.js` (código movido de `app.js`: pantallas genética, lote, manejo, proyección con claves `appollo.v1.estado/precios` intactas); Modify `src/app.js`, `tests/e2e/planificar.py`.

**Interfaces:** Consumes `nuevoLote.crear` (T6). Produces ruta `#/plan/genetica|lote|manejo|proyeccion` y botón "Crear lote con este plan" que precarga genética, aves y altitud.

- [ ] **Step 1: Prueba e2e que falla:** Hy-Line Brown, 24 semanas, 500 aves, 2 800 m, proyección a la semana 80 muestra ≈ 127 473 huevos (±1 %, valor de referencia ya verificado); "Crear lote con este plan" abre Nuevo lote precargado.
- [ ] **Step 2: Ejecutar** → Expected: FAIL.
- [ ] **Step 3: Mover y adaptar** el código con los nuevos componentes, sin tocar `model.js`.
- [ ] **Step 4: Ejecutar** → Expected: PASS.
- [ ] **Step 5: Commit** `feat: planificar integrado`.

### Task 10: Pruebas de conjunto y entrega

**Files:** Modify `README.md`, `src/sw.js`, `package.json`; Create `tests/e2e/todo.py`.

- [ ] **Step 1: Prueba que falla** (`todo.py`, 360×740): recorrido completo sin errores de consola; sin desborde horizontal en claro y oscuro; modo sin conexión (`context.set_offline(True)`) tras la primera carga; ningún botón < 56 px.
- [ ] **Step 2: Ejecutar** `python3 build.py && node tests/run.js && python3 tests/e2e/todo.py` → Expected: FAIL hasta cerrar pendientes.
- [ ] **Step 3: Corregir** lo que falle; actualizar README (estructura, pruebas, flujo nuevo), `sw.js` precache de fuentes y vistas.
- [ ] **Step 4: Ejecutar** todo → Expected: PASS. Luego `npx cap sync android` → Expected: sin errores.
- [ ] **Step 5: Entregar:** regenerar `artifact.html` y publicarlo, crear `Appollo-android.zip`, guardar README en el Project y enviar archivos.
- [ ] **Step 6: Commit** `chore: entrega Appollo 2`.
