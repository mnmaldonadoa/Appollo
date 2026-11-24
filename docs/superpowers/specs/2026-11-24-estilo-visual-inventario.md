# Appollo · Inventario de ilustraciones (Fase 0)

Fecha: 2026-11-24 · Estado: **pendiente de aprobación de Nicolás**. No se dibuja nada hasta que la apruebe.
Base: `main` `67111b1` + diseño `2026-11-24-estilo-visual-design.md`. Capturas «antes»: `capturas/antes/` (`python3 tests/e2e/capturas.py antes`).

Notación: **mini** = 48 px · **media** = 96 px · **grande** = 160 px. «Ícono» = se queda el ícono de línea actual del sprite (`i-*`), recoloreado.

## 1. Pantallas y bloques

Nuevo lote tiene **4 pasos**, no 3: Genética, Aves, Tareas (el plan) y Lugar.

| Pantalla | Bloque | Ilustración |
|---|---|---|
| Bienvenida (2 pasos) | cabecera | `est-bienvenida` grande |
| | elección «qué aves crías» (3 opciones) | postura → `gen-hyline-brown`, carne → `gen-ross308`, las dos → `gen-rhode-island` (mini) |
| Nuevo lote 1 · Genética | una tarjeta por genética (11) | `gen-*` media (`TarjetaGenetica`) |
| Nuevo lote 2 · Aves | encabezado | `man-densidad` mini |
| Nuevo lote 3 · Tareas | cabecera de cada categoría del plan (`.nl-cat-cab`, 10) | mapeo `categoriaPlan` mini (§4) |
| Nuevo lote 4 · Lugar | encabezado (altitud y galpón) | `man-temperatura` mini |
| Inicio | cabecera | ave de la genética del lote, media (`gen-generica` con todos los lotes) |
| | KPI Aves vivas | `gen-*` del lote, mini |
| | KPI Mortalidad | `reg-mortalidad` mini |
| | KPI Alimento de hoy | `reg-alimento` mini |
| | KPI Huevos de hoy | `reg-huevos` mini |
| | KPI Peso promedio | `reg-peso` mini |
| | KPI Rendimiento vs estándar | `man-registros` mini |
| | KPI Estado sanitario | `reg-sanidad` mini |
| | KPI Alertas pendientes | ícono (campana): la mini repetiría la pantalla de Alertas |
| | vacío (sin lotes) | `est-sin-lotes` grande |
| Hoja Registrar | 6 botones de tipo | `reg-*` mini (§3) |
| | sin lotes | `est-sin-lotes` grande |
| | aviso de guardado con «Deshacer» | `est-exito` mini; tras deshacer, `est-deshacer` mini |
| Lotes | cada lote activo o cerrado | `gen-*` mini |
| | vacío | `est-sin-lotes` grande |
| Detalle del lote · Resumen | cabecera | `gen-*` media |
| | gráfica real vs proyectado | sin ilustración (es un dato) |
| | historial (`.dl-reg`) | mini según el tipo de registro (§3); el tipo `plan` usa la de su categoría |
| | calendario de vacunas | `san-vacuna` mini en el título |
| | sin registros | `est-sin-registros` grande |
| Detalle · Plan del ciclo | cada labor (`.pc-item`) | mapeo `categoriaPlan` mini (§4) |
| | vacunas del plan (`.pc-vacuna`) | `san-vacuna` mini |
| | aviso de retiro (`.pc-retiro`) | `san-retiro` mini |
| | aviso de revisar etiqueta (`.pc-etiqueta`) | `al-etiqueta` mini |
| Alertas | cada tarjeta (`.al-card`) | mapeo `alerta` mini (§2) |
| | vacío («Todo en orden») | `est-sin-alertas` grande |
| Inventario | título de cada grupo (4) | mapeo `inventario` mini: alimento → `man-alimento`, vacuna → `san-vacuna`, medicamento → `san-quimico`, otro → `man-registros` |
| | vacío | `est-sin-inventario` grande |
| Reportes | gráficas y cifras | sin ilustración |
| | sin datos | `est-sin-registros` grande |
| Planificar 1 · Genética | tarjetas | igual que en Nuevo lote 1 |
| Planificar 2 · Lote | encabezado | `man-densidad` mini |
| Planificar 3 · Manejo | cabecera de cada categoría (9) | mapeo `recomendacion` media (§5) |
| | ítems con escena propia | mapeo `itemRecomendacion` mini (§5) |
| Planificar 4 · Proyección | gráficas, brechas e ingresos | sin ilustración |
| Más | filas de menú | ícono |
| Ajustes | secciones (granja, precios, tema, respaldo) | ícono |
| Barra de navegación y botones | — | ícono |

## 2. Alertas (`src/alertas.js`: 9 tipos)

| `tipo` | Qué avisa | Clave | Escena |
|---|---|---|---|
| `mortalidad` | mortalidad alta | `al-mortalidad` | ave en reposo (ojos cerrados) en gris cálido, fondo coral |
| `sin-registro` | días sin registrar | `al-sin-registro` | ave junto a una libreta en blanco, fondo durazno |
| `postura` | caída de postura | `al-postura` | ave junto a un nido con un solo huevo, fondo durazno |
| `vacuna` | vacuna próxima o atrasada | `al-vacuna` | ave junto a un frasco de vacuna y un calendario, fondo cielo |
| `retiro` | no vender huevos o carne hasta… | `al-retiro` | huevos en su bandeja junto a un reloj, fondo coral |
| `etiqueta` | revisar el retiro en la etiqueta | `al-etiqueta` | frasco con su etiqueta en blanco y una lupa, fondo durazno |
| `fase` | cambio de fase de alimento | `al-fase` | dos sacos (pequeño y grande) con una flecha, fondo menta |
| `inventario` | inventario bajo | `al-inventario` | saco casi vacío, fondo durazno |
| `plan` | labores de hoy o atrasadas | `al-plan` | ave junto a una lista con casillas, fondo lila |

## 3. Registrar (`src/vistas/registrar.js`: 6 tipos)

| Tipo | Clave | Escena |
|---|---|---|
| `mortalidad` | `reg-mortalidad` | ave en reposo, gris cálido, fondo crema |
| `alimento` | `reg-alimento` | ave junto al comedero, fondo menta |
| `huevos` | `reg-huevos` | tres huevos en un nido, fondo durazno |
| `peso` | `reg-peso` | ave sobre una balanza, fondo cielo |
| `vacuna` | `reg-vacuna` | frasco de vacuna con gota (sin cantidades), fondo cielo |
| `sanidad` | `reg-sanidad` | ave con un escudo pequeño, fondo salvia |

## 4. Plan del ciclo (`CATEGORIAS_PLAN`: 10, más las vacunas)

| Categoría | Clave |
|---|---|
| `alimento` | `man-alimento` |
| `ambiente` | `man-temperatura` |
| `seleccion` | `man-seleccion` |
| `limpieza` | `man-bioseguridad` |
| `agua` | `man-agua` |
| `registros` | `man-registros` |
| `plagas` | `san-plagas` |
| `mortalidad` | `reg-mortalidad` |
| `llegada` | `man-llegada` |
| `quimico` | `san-quimico` |
| vacunas del plan | `san-vacuna` |

## 5. Recomendaciones por edad (`construirManejo`: 9 categorías)

| `cat.id` | Clave (media) |
|---|---|
| `alim` (Alimentación) | `man-alimento` |
| `temp` (Temperatura y ambiente) | `man-temperatura` |
| `hum` (Humedad) | `man-humedad` |
| `agua` (Agua) | `man-agua` |
| `vit` (Vitaminas) | `man-vitaminas` |
| `vac` (Vacunas) | `san-vacuna` |
| `san` (Control sanitario) | `man-bioseguridad` |
| `casero` (Remedios caseros) | `san-remedio-casero` |
| `quim` (Control químico) | `san-quimico` |

Ítems con escena propia (mini):

| Ítem | Clave |
|---|---|
| `a_fase` | `man-cambio-fase` |
| `t_vent` | `man-ventilacion` |
| `t_luz` | `man-luz` |
| `s_desp` | `san-desparasitacion` |
| `s_peso` | `man-seleccion` |
| `s_bio` | `man-bioseguridad` |

El resto de ítems usa la clave de su categoría.

## 6. Genéticas (`data.js`: 11, más la genérica)

| Genética | Clave | Forma | Cuerpo | Detalle que la distingue |
|---|---|---|---|---|
| Hy-Line Brown | `gen-hyline-brown` | frijol | marrón `#D4A373` | cola corta, cresta coral |
| Lohmann Brown-Classic | `gen-lohmann-brown` | frijol | marrón | cola más alta |
| ISA Brown | `gen-isa-brown` | frijol | marrón | ala blanco hueso |
| Hisex Brown | `gen-hisex-brown` | frijol algo más pequeño | marrón | cola blanco hueso |
| Lohmann LSL-Classic | `gen-lohmann-lsl` | frijol | blanco hueso `#FAF9F6` | cresta grande |
| Cobb 500 | `gen-cobb500` | robusta (redonda, patas más separadas) | blanco hueso | cresta pequeña |
| Ross 308 | `gen-ross308` | robusta | blanco hueso | pecho más ancho, cresta pequeña |
| Pollo campero | `gen-campero` | esbelta | marrón | cuello más largo |
| Rhode Island Red | `gen-rhode-island` | frijol | marrón más profundo (sin texto encima) | cola oscura (carbón) |
| Plymouth Rock Barrada | `gen-plymouth-rock` | frijol | gris cálido `#CCD5AE` | franjas (`p-barrado`) |
| Gallina criolla | `gen-criolla` | esbelta | amarillo pollito `#FCE181` con ala marrón | cola alta |
| (desconocida) | `gen-generica` | frijol | blanco hueso | ninguno |

Ninguna lleva logos ni nombres dibujados.

## 7. Manejo y sanidad (escenas)

Cada escena lleva un ave, un elemento del concepto en tamaño normal y un fondo sólido.

| Clave | Escena | Fondo |
|---|---|---|
| `man-agua` | gallina junto al bebedero | cielo |
| `man-alimento` | gallina junto al comedero | menta |
| `man-cambio-fase` | dos sacos (pequeño y grande) y una flecha | menta |
| `man-temperatura` | gallina junto a un termómetro de pared | durazno |
| `man-humedad` | gota y cama de viruta | cielo |
| `man-ventilacion` | gallina junto a un ventilador | cielo |
| `man-luz` | gallina bajo un foco | lila |
| `man-densidad` | tres aves con espacio entre ellas dentro del galpón | menta |
| `man-bioseguridad` | botas junto a un pediluvio | salvia |
| `man-llegada` | pollitos bajo la criadora | durazno |
| `man-seleccion` | gallina sobre una balanza | cielo |
| `man-registros` | libreta con casillas | crema |
| `man-vitaminas` | bebedero con una gota de color | menta |
| `san-vacuna` | frasco de vacuna con gota, sin cantidades | cielo |
| `san-desparasitacion` | gallina junto a un frasco cerrado | salvia |
| `san-remedio-casero` | hojas en una taza | salvia |
| `san-quimico` | frasco con etiqueta en blanco, sin dosis | lila |
| `san-retiro` | huevos en su bandeja y un reloj | coral |
| `san-plagas` | malla en la ventana y un ratón pequeño afuera | crema |

## 8. Estados

| Clave | Escena |
|---|---|
| `est-bienvenida` | gallina y pollito frente al galpón |
| `est-sin-lotes` | galpón con la puerta abierta, vacío, y un pollito en la entrada |
| `est-sin-alertas` | gallina tranquila junto a un escudo con palomita |
| `est-sin-inventario` | estante con un saco cerrado |
| `est-sin-registros` | libreta abierta en blanco |
| `est-exito` | palomita dentro de un círculo salvia |
| `est-deshacer` | flecha que vuelve, dentro de un círculo crema |

Total: **12 genéticas + 19 de manejo y sanidad + 9 alertas + 6 de registro + 7 estados = 53 escenas.**

## 9. Piezas del sprite (`p-*`)

**Ave (siluetas):** `p-cuerpo` (frijol), `p-cuerpo-robusto`, `p-cuerpo-esbelto`, `p-pollito`, `p-ala`, `p-cola`, `p-cola-alta`, `p-cresta`, `p-cresta-grande`, `p-pico`, `p-barba`.

**Ave (trazos y detalles):** `p-ojos`, `p-ojos-cerrados`, `p-patas`, `p-barrado`, `p-sombra`.

**Objetos (siluetas):** `p-bebedero`, `p-comedero`, `p-saco`, `p-termometro`, `p-gota`, `p-ventilador`, `p-foco`, `p-galpon`, `p-botas`, `p-vacuna`, `p-balanza`, `p-huevo`, `p-nido`, `p-hoja`, `p-taza`, `p-frasco`, `p-calendario`, `p-libreta`, `p-reloj`, `p-escudo`, `p-flecha`, `p-palomita`, `p-lupa`, `p-raton`, `p-malla`, `p-estante`, `p-criadora`, `p-cama`.

Son 16 piezas de ave y 28 objetos. Las escenas reutilizan estas piezas con distinto color, posición y escala.

## 10. Usos actuales de `ilustracion()` (7)

| Archivo | Hoy | Pasa a |
|---|---|---|
| `alertas.js:39` | `huevo` | `est-sin-alertas` |
| `bienvenida.js:17` | `gallina` | `est-bienvenida` |
| `registrar.js:45` | `gallina` | `est-sin-lotes` |
| `lotes.js:31` | `gallina` | `est-sin-lotes` |
| `inicio.js:130` | `gallina` | `est-sin-lotes` |
| `detalleLote.js:64` | `campo` | `est-sin-registros` |
| `reportes.js:66` | `campo` | `est-sin-registros` |

Inventario no tiene ilustración de vacío hoy; se agrega `est-sin-inventario`.

## 11. Cambios frente al plan

- Nuevo contexto de mapeo **`inventario`** (4 categorías), además de los del plan.
- Contexto **`bienvenida`** para la elección de tipo de aves: `postura` → `gen-hyline-brown`, `carne` → `gen-ross308`, `ambas` → `gen-rhode-island`.
- Las escenas pasan de unas 55 a **53**, y se agregan piezas (`p-nido`, `p-taza`, `p-lupa`, `p-raton`, `p-malla`, `p-estante`, `p-criadora`, `p-cama`, `p-cola-alta`, `p-cresta-grande`) frente a la lista inicial del diseño.
