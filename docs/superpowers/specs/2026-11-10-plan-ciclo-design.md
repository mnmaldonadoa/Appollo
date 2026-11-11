# Appollo · Plan del ciclo y controles químicos — diseño

Fecha: 2026-11-10 · Estado: pendiente de revisión del usuario

## 1. Intención (acordada con Nicolás)

- Hoy, en "Lotes", solo se pueden elegir vacunas. Nicolás quiere **elegir todo lo que va a hacer durante el ciclo** (manejo completo) y que la app **recomiende controles químicos**, que hoy no existen.
- El plan **no es fijo**: a lo largo del ciclo se pueden **agregar o quitar labores** según cómo se desarrolle el lote.
- Nivel de detalle químico elegido: **programa con tipo de producto o ingrediente activo y período de retiro (huevo y carne)**, sin dosis; siempre con aviso de confirmar con la etiqueta y el veterinario.
- Categorías pedidas: pesajes y cambios de alimento; luz, ventilación y espacio; despique, selección y descartes; limpieza, bioseguridad y cama; más "todo lo importante para un productor" (se incluyen: manejo de agua, registros y sala de huevos, control de plagas y roedores, manejo de muerte/eliminación de mortalidad, preparación de la llegada).
- Subproyectos: **B** plan del ciclo (este documento), **C** controles químicos (este documento, como categoría del mismo plan), **A** estilo visual (spec aparte, después: pastel crema/menta/celeste/amarillo, gallinas-frijol originales, íconos de alimento/vacuna/vitaminas, botones píldora). Orden: B+C → A.

## 2. Alcance

Entra: catálogo de tareas, selección al crear el lote, pestaña "Plan del ciclo" en el detalle, marcar hecho, **agregar/quitar tareas en cualquier momento (del catálogo o propias)**, alertas, retiros, respaldo/migración, pruebas, README.

No entra (queda como limitación conocida): dosis de productos, estilo visual nuevo (A), recomendaciones por foto/diagnóstico, compra de insumos.

## 3. Modelo de datos

Catálogo (código, `src/catalogo.js`, solo lectura, con fuentes en comentarios y en `docs/fuentes-catalogo.md`):

```
Tarea { id, categoria, titulo, detalle, modos:['huevos'|'carne'|'ambos'],
        geneticas?:[id], desdeDia, hastaDia?, cadaDias?, obligatoria:false,
        quimico?: { tipo, ingredienteActivo, retiroHuevoDias, retiroCarneDias, advertencia } }
```

Almacén nuevo IndexedDB `planTareas` (índice `loteId`), una fila por tarea del lote:

```
{ id, loteId, origen:'catalogo'|'propia', catalogoId?, categoria, titulo, detalle,
  desdeDia, cadaDias?, hastaDia?, estado:'activa'|'quitada', quitadaEn?,
  hechas:[{fecha, nota?, producto?}], creado }
```

- **Quitar** = `estado:'quitada'` (no se borra el historial; se puede **reactivar**).
- **Agregar** = fila nueva desde el catálogo (cualquier edad actual del lote) o **tarea propia** (título, categoría, fecha o "cada N días").
- Vacunas: siguen en `vacunasPlan`; el Plan del ciclo las muestra junto a las demás sin migrarlas. El respaldo incluye `planTareas`; la importación normaliza ids a texto.
- Migración: DB sube a versión 2 (almacén nuevo); lotes existentes empiezan con plan vacío y un aviso "Elegir tareas del ciclo".

## 4. Lógica pura (`src/calc.js`, sin DOM, con pruebas unitarias)

- `proximaFecha(tarea, lote)`, `estadoTarea(tarea, hoy)` → `atrasada | hoy | proxima | hecha | quitada`.
- `retiroVigente(lote, hechas)`: fecha hasta la cual no vender huevo/carne (máximo de las fechas de retiro de aplicaciones químicas y vacunas).
- Fechas locales `YYYY-MM-DD`, nunca `toISOString` para fechas de registro.

## 4b. Alertas

`generarAlertas` añade: tareas atrasadas (rojo), de hoy y de los próximos 7 días (ámbar/neutral), y **retiro vigente** ("No vender huevos hasta el 14/12"). Una tarea quitada no genera alertas.

## 5. Pantallas

1. **Nuevo lote → paso "¿Qué vas a hacer en este ciclo?"**: categorías plegables, casillas, "Todo/Ninguno" por categoría, botón grande "Continuar". Todo viene sugerido según genética y modo; la persona desmarca lo que no hará.
2. **Detalle del lote → pestaña "Plan del ciclo"**: secciones Atrasadas / Esta semana / Próximas / Hechas; botón "Hecho" con fecha (por defecto hoy), nota y, en químicos, producto usado; menú por tarea: Quitar, Mover fecha, Editar.
3. **"+ Agregar labor"** (siempre visible): hoja con dos pestañas, "Del catálogo" (buscador y categorías, con las quitadas para reactivar) y "Propia" (título, categoría, fecha o repetición).
4. **Controles químicos**: tarjeta con tipo/ingrediente activo, retiro en huevo y carne, y la advertencia fija "Confirma producto, dosis y retiro con la etiqueta y tu veterinario".
5. Botones ≥56 px, modo oscuro, offline, sin desborde a 360 px (mismas reglas del proyecto).

## 6. Contenido del catálogo (riesgo principal)

Salud animal: **no se inventan datos**. Antes de escribir el catálogo, un agente investiga y cita fuentes (guías de manejo de Hy-Line, Lohmann, ISA/Hendrix, Aviagen/Cobb para ponedoras y carne; normativa y registros de Agrocalidad Ecuador; OMSA/FAO para bioseguridad). Cada tarea química lleva fuente y fecha. Lo que no se pueda respaldar con fuente se omite. Revisión de contenido por un segundo agente independiente antes de integrarlo. Nicolás puede además pedir validación con su tutor o un veterinario.

## 7. Errores y casos límite

- Lote cerrado: plan en solo lectura.
- Edad actual > `hastaDia`: no se ofrece como próxima; se muestra en "Hechas/Omitidas".
- Tarea propia sin fecha: se rechaza con mensaje claro.
- Quitar una tarea con aplicaciones hechas: se conserva el historial y el retiro vigente sigue contando.
- Sin plan elegido: Inicio y Alertas muestran "Elegir tareas del ciclo" una vez, sin molestar después.

## 8. Pruebas

- Unitarias: fechas, repeticiones, estados, retiro vigente, agregar/quitar/reactivar, normalización de importación.
- E2E 360×740 claro/oscuro: crear lote con plan, marcar hecho, quitar, reactivar, agregar del catálogo y propia, alertas y retiro, respaldo ida y vuelta, migración, offline.
- Revisión de contenido del catálogo (agente independiente, con fuentes).
- Paridad: el planificador y los números existentes no cambian (los 265 controles dorados siguen pasando).

## 9. Fuera de alcance explícito / limitaciones conocidas

Sin dosis. Sin diagnóstico. El catálogo es referencia general, no sustituye al veterinario. El estilo visual (A) se hace después y no se mezcla con este cambio.
