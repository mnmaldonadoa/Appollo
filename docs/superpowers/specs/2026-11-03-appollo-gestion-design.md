# Appollo 2 · Gestión avícola — Especificación de diseño

Fecha: 2026-11-03 · Estado: pendiente de revisión

## 1. Propósito y usuarios
Convertir Appollo (hoy un planificador de proyección) en una herramienta de gestión diaria de la granja.
Usuarios: desde criadores familiares con poca experiencia tecnológica hasta granjas comerciales.
Condiciones: una sola mano, sol directo, guantes ligeros o pantalla mojada, conexión lenta o nula.
Éxito: registrar mortalidad, alimento o huevos en ≤ 3 toques; ver el estado del lote de un vistazo; funcionar 100 % sin internet.

## 2. Decisiones técnicas
- PWA en HTML/CSS/JS puro, sin paso de compilación (opción 1 elegida). Sin React/Shadcn/Framer Motion: componentes y animaciones propios.
- Datos en IndexedDB. Se conservan `model.js` y `data.js` (estándares por genética y modelo de proyección).
- `build.py` sigue uniendo todo en `dist/`; el proyecto Capacitor y el flujo de GitHub Actions se mantienen.

## 3. Navegación
Barra inferior fija: **Inicio · Lotes · [＋ Registrar] · Alertas (contador) · Más**.
"Más" contiene: Inventario, Reportes, Planificar, Ajustes (granja, tema, respaldo).

### Registro rápido (≤ 3 toques)
1. ＋ Registrar → hoja inferior con 6 botones: Mortalidad, Alimento, Huevos, Peso, Vacuna, Sanidad.
2. Elegir tipo. Lote preseleccionado (último usado o único activo); se puede cambiar.
3. Ajustar valor con contador +/− (64 px) o teclado numérico → Guardar.
- Alimento precargado con el consumo estándar del día (genética + edad) × aves vivas.
- Huevos precargado con el estándar de postura del día × aves vivas.
- Feedback: palomita animada, vibración corta (si existe), "pop" en la tarjeta del Inicio, barra Deshacer 5 s.

## 4. Pantallas
- **Bienvenida (primera vez):** 2 pasos (nombre de granja; postura/carne/ambas) → "Crear mi primer lote".
- **Inicio:** selector de lote (Todos / lote). Tarjetas: aves vivas; mortalidad hoy y acumulada %; alimento del día; producción (huevos y % postura, o peso promedio); estado sanitario (verde/amarillo/rojo); alertas pendientes; rendimiento vs estándar (%); minigráfica 14 días.
- **Lotes:** lista de activos (tarjeta con genética, edad, aves, indicador) y cerrados. Botón "Nuevo lote".
- **Nuevo lote (3 pasos):** genética (tarjetas actuales) → cantidad + fecha de llegada o edad → altitud (recordada) y galpón. Genera el plan de vacunas desde `VACUNAS`.
- **Detalle de lote:** resumen, gráfica real vs proyectado, historial (borrar con botón y deslizar, con deshacer), calendario de vacunas (marcar aplicada), cerrar lote.
- **Alertas:** lista ordenada por gravedad, cada una con acción directa ("Marcar hecha" / "Registrar" / "Ver").
- **Inventario:** ítems por categoría (alimento, vacuna, medicamento, otro), cantidad, unidad, mínimo, costo. Entradas manuales; el alimento se descuenta al registrar consumo si hay ítem de alimento vinculado.
- **Reportes:** por lote y período (7 d, 30 d, ciclo): viabilidad, conversión, producción, % postura, costo de alimento vs ingreso. Copiar / compartir como texto (WhatsApp).
- **Planificar:** flujo actual (genética → edad → manejo → proyección) con el nuevo estilo; termina con "Crear lote con este plan".
- **Ajustes:** granja, tema claro/oscuro/automático, exportar/importar respaldo `.json`.

## 5. Sistema visual
Paleta (claro): fondo #F6F1E7, superficie #FFFDF8, primario verde campo #2F6B3A, texto #2B2118, secundario #6B5A48, huevo #E8A317, cielo #4A90B8, alerta #B23A2B, precaución #C77C0E. Tema oscuro verde/tierra. Contraste de texto ≥ 7:1.
Tipografía: Atkinson Hyperlegible (texto, 18 px base, mínimo 16 px), Zilla Slab (títulos y cifras 32–40 px); fuentes empaquetadas localmente.
Táctil: botones ≥ 56 px, separación ≥ 8 px, contador 64 px, acciones abajo, ningún gesto obligatorio sin botón.
Íconos: SVG propios, trazo 2 px redondeado (estilo Lucide), siempre con texto: gallina, huevo, saco, balanza, jeringa, cruz sanitaria, gota, termómetro.
Movimiento: transición de pantalla 220 ms (deslizar + desvanecer), hoja con rebote, palomita al guardar, cifras que cuentan, barras que se llenan, esqueletos de carga; `prefers-reduced-motion` desactiva todo. Franja "Sin conexión" no bloqueante.

## 6. Datos (IndexedDB `appollo`, v1)
- `granja` {id, nombre, tipo, altitud, tema}
- `lotes` {id, nombre, genetica, avesInicio, fechaLlegada, edadLlegadaDias, galpon, estado}
- `registros` {id, loteId, fecha (YYYY-MM-DD), tipo, datos, creado}
  - mortalidad {cantidad, causa?} · alimento {kg} · huevos {cantidad, rotos?} · peso {gramos, muestra?} · vacuna {nombre, via} · sanidad {enfermedad, tratamiento, retiroDias}
- `inventario` {id, nombre, categoria, cantidad, unidad, minimo, costo, vinculoAlimento?}
- `vacunasPlan` {id, loteId, nombre, fechaPrevista, fechaAplicada?, via}
Índices: registros por loteId+fecha; vacunasPlan por loteId.
Migración: los lotes de `localStorage` `appollo.v1.lotes` se importan una vez como lotes cerrados o planes.
Valores derivados (nunca guardados): aves vivas, edad actual, % postura, conversión, viabilidad, rendimiento vs estándar.

## 7. Alertas (`alertas.js`, función pura sobre los datos)
- Vacuna vencida (rojo) o para hoy/mañana (ámbar).
- Mortalidad del día > 2 × esperada según genética (rojo).
- % postura cae > 3 puntos en promedio de 3 días vs 3 días previos (ámbar).
- Inventario bajo mínimo (ámbar).
- Medicamento con retiro activo: no vender huevos/carne hasta la fecha (rojo).
- Sin registros en el lote activo hoy después de las 18:00 (informativa).
- Cambio de fase de alimento por edad (informativa).

## 8. Módulos
- `src/db.js` — acceso a IndexedDB (promesas), migración.
- `src/calc.js` — cálculos puros (aves vivas, edad, % postura, conversión, viabilidad, estándar del día).
- `src/alertas.js` — reglas de alerta puras.
- `src/ui/*.js` — componentes: botón, tarjeta, contador, hoja inferior, gráfico, toast/deshacer, barra de navegación.
- `src/vistas/*.js` — una vista por pantalla.
- `src/app.js` — enrutador y estado global.
- `model.js`, `data.js` — sin cambios de lógica.
`build.py` concatena en orden y empaqueta fuentes locales; `sw.js` sube a `appollo-v2`.

## 9. Errores
Validación con mensaje claro (muertes > aves vivas, peso 0, fecha futura). Duplicado del día → "¿Sumar o reemplazar?". Deshacer 5 s. Fallo de almacenamiento → aviso + "Exportar respaldo ahora". Error de vista → "Algo salió mal · Volver al inicio" sin tocar datos.

## 10. Pruebas
- Unitarias (Node, sin librerías) para `calc.js` y `alertas.js`, escritas antes del código.
- Playwright 360×740: crear lote, registrar en 3 toques, alerta visible, modo sin conexión, tema oscuro, sin desborde horizontal, objetivos táctiles ≥ 56 px.
- Contraste automático de tokens ≥ 7:1.

## 11. Entrega
Artefacto web publicado, zip con `dist/` y proyecto Android/GitHub Actions, README actualizado.

## Fuera de alcance
Notificaciones con app cerrada, sincronización en la nube, multiusuario, formulación de raciones, diagnóstico por fotos.
