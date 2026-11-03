"""Construye Appollo a partir de src/:
   dist/            -> app instalable (PWA) lista para subir a un hosting
   artifact.html    -> versión de una sola página para vista previa
Uso: python3 build.py
"""
import json
import shutil
from pathlib import Path

from PIL import Image, ImageDraw

RAIZ = Path(__file__).parent
SRC, DIST = RAIZ / "src", RAIZ / "dist"

FUENTES = ('<link rel="preconnect" href="https://fonts.googleapis.com">\n'
           '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n'
           '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Atkinson+Hyperlegible:wght@400;700'
           '&family=Zilla+Slab:wght@500;600;700&display=swap">')


def leer(nombre):
    return (SRC / nombre).read_text(encoding="utf-8")


def cuerpo():
    css, body = leer("styles.css"), leer("body.html")
    scripts = "\n".join(f"<script>\n{leer(n)}\n</script>" for n in ("data.js", "model.js", "calc.js", "alertas.js", "db.js", "app.js"))
    return css, body, scripts


def iconos(destino):
    destino.mkdir(parents=True, exist_ok=True)

    def dibujar(tam, margen):
        img = Image.new("RGBA", (tam, tam), (23, 32, 27, 255))
        d = ImageDraw.Draw(img)
        s = tam / 512
        cx = tam / 2
        alto, ancho = (330 - margen) * s, (250 - margen * 0.75) * s
        top = tam / 2 - alto * 0.52
        d.ellipse([cx - ancho / 2, top, cx + ancho / 2, top + alto], fill=(242, 244, 239, 255))
        r = ancho * 0.30
        cy = top + alto * 0.60
        d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=(231, 161, 27, 255))
        return img

    dibujar(512, 0).resize((192, 192), Image.LANCZOS).save(destino / "icon-192.png")
    dibujar(512, 0).save(destino / "icon-512.png")
    dibujar(512, 80).save(destino / "maskable-512.png")
    dibujar(512, 0).resize((180, 180), Image.LANCZOS).save(destino / "apple-touch-icon.png")


def construir():
    css, body, scripts = cuerpo()
    if DIST.exists():
        shutil.rmtree(DIST)
    DIST.mkdir()

    registro_sw = """<script>
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
}
</script>"""

    pwa = f"""<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>Appollo</title>
<meta name="description" content="Manejo de gallinas por genética y proyección de huevos o carne. Funciona sin internet.">
<meta name="theme-color" content="#17201B">
<link rel="manifest" href="manifest.webmanifest">
<link rel="icon" href="icons/icon-192.png">
<link rel="apple-touch-icon" href="icons/apple-touch-icon.png">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="mobile-web-app-capable" content="yes">
{FUENTES}
<style>
{css}
</style>
</head>
<body>
{body}
{scripts}
{registro_sw}
</body>
</html>
"""
    (DIST / "index.html").write_text(pwa, encoding="utf-8")

    manifest = {
        "name": "Appollo · Manejo de gallinas",
        "short_name": "Appollo",
        "description": "Manejo de gallinas por genética y proyección de huevos o carne, sin internet.",
        "lang": "es",
        "start_url": "./",
        "scope": "./",
        "display": "standalone",
        "orientation": "portrait",
        "background_color": "#F2F4EF",
        "theme_color": "#17201B",
        "icons": [
            {"src": "icons/icon-192.png", "sizes": "192x192", "type": "image/png"},
            {"src": "icons/icon-512.png", "sizes": "512x512", "type": "image/png"},
            {"src": "icons/maskable-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable"},
        ],
    }
    (DIST / "manifest.webmanifest").write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
    shutil.copy(SRC / "sw.js", DIST / "sw.js")
    iconos(DIST / "icons")

    # Versión de una sola página (vista previa)
    artefacto = f"""<title>Appollo</title>
<meta name="claude:viewport-fit-sides" content="cover">
{FUENTES}
<style>
{css}
</style>
{body}
{scripts}
"""
    (RAIZ / "artifact.html").write_text(artefacto, encoding="utf-8")
    print("Listo: dist/ y artifact.html")


if __name__ == "__main__":
    construir()
