# Appollo · Manejo de gallinas por genética

Aplicación móvil que funciona **sin internet**. El usuario elige la genética, ingresa la edad y los datos del lote, marca las prácticas de manejo que va a aplicar y obtiene la proyección de huevos o carne.

## Flujo

1. **Genética** · 11 líneas: Hy-Line Brown, Lohmann Brown-Classic, ISA Brown, Hisex Brown, Lohmann LSL-Classic, Cobb 500, Ross 308, pollo campero, Rhode Island Red, Plymouth Rock Barrada y gallina criolla.
2. **Lote** · edad (días o semanas), número de aves, altitud y un dato real opcional (% de postura o peso actual).
3. **Manejo** · alimentación, temperatura y ambiente, humedad, agua, vitaminas, vacunas, control sanitario, remedios caseros y control químico, todo ajustado a la fase de edad. Cada práctica se marca o desmarca y el índice de manejo se actualiza al instante.
4. **Proyección** · huevos (total, cubetas de 30, pico, peso del huevo, alimento por docena, conversión) o carne (peso a la venta, kg en pie y de canal, conversión, viabilidad, IEP), gráfico frente al estándar de la genética, prácticas que más sumarían y margen sobre alimento.
5. **Mis lotes** · las proyecciones se guardan en el teléfono.

## Estructura

```
src/
  data.js      Base de datos técnica: genéticas, vacunas, enfermedades y remedios (editar aquí)
  model.js     Fases, recomendaciones por edad y modelo de proyección
  app.js       Pantallas e interacción
  styles.css   Diseño (tema claro y oscuro)
  body.html    Íconos y contenedor de la app
  sw.js        Service worker: guarda la app para usarla sin internet
build.py       Une todo en dist/
dist/          App lista para publicar (index.html, manifest, sw.js, íconos)
```

Para reconstruir después de editar `src/`: `python3 build.py` (requiere Python 3 y Pillow).

## Probar e instalar en el teléfono

La app es una PWA (aplicación web progresiva). Para que funcione sin internet debe abrirse una vez desde una dirección `https`:

1. Sube la carpeta `dist/` a un hosting gratuito (GitHub Pages, Netlify o Cloudflare Pages).
2. Abre la dirección en Chrome del teléfono.
3. Menú ⋮ → **Agregar a la pantalla principal** (o **Instalar app**).
4. Desde ese momento abre sin conexión, como cualquier app.

Para probar en la computadora: `cd dist && python3 -m http.server 8000` y abre `http://localhost:8000`.

## Generar el APK con GitHub Actions (sin instalar nada)

El proyecto ya incluye Capacitor (`android/`) y el flujo `.github/workflows/android.yml`.

1. Crea un repositorio en github.com y sube **todo el contenido de esta carpeta** (botón *Add file → Upload files*, o `git push`).
2. Abre la pestaña **Actions**. El flujo "Compilar APK de Appollo" corre solo (unos 5 a 8 minutos). Si no, tócalo y pulsa *Run workflow*.
3. Al terminar, entra a la ejecución y descarga **Appollo-apk** (abajo, en *Artifacts*). Dentro está `app-debug.apk`: cópialo al teléfono e instálalo (permite "instalar apps desconocidas").

Para Play Store se necesita un APK/AAB firmado (*release*) con tu propia llave; eso se agrega después.
Si cambias algo en `src/`: `python3 build.py && npx cap sync android` y vuelve a subir.

## Otras opciones de APK

**Opción rápida · PWABuilder:** con la app ya publicada en `https`, entra a pwabuilder.com, pega la dirección y descarga el paquete Android (Trusted Web Activity).

**Opción nativa · Capacitor** (permite cámara, notificaciones y acceso a archivos más adelante):

```
npm init -y
npm install @capacitor/core @capacitor/cli @capacitor/android
npx cap init Appollo ec.appollo.app --web-dir dist
npx cap add android
npx cap copy
npx cap open android   # se compila el APK en Android Studio
```

## Sobre los datos

- Las curvas de postura y peso parten de las guías publicadas por cada casa genética (Hy-Line 2024, Lohmann 2021, Hendrix ISA/Hisex, Aviagen Ross 308 2022, Cobb500 2022). Doble propósito, campero y criolla usan valores medios de referencia.
- El efecto de cada práctica de manejo, de la altitud y de las enfermedades son coeficientes de referencia, no mediciones. Conviene calibrarlos con registros reales de granjas.
- Las dosis de medicamentos son referenciales. Toda medicación requiere diagnóstico y receta de un médico veterinario y respetar el tiempo de retiro.
- El calendario de vacunación es una guía; debe ajustarse con el veterinario y con los programas de Agrocalidad.
