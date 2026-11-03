"""Construye Appollo a partir de src/:
   dist/            -> app instalable (PWA) lista para subir a un hosting
   artifact.html    -> versión de una sola página para vista previa
   dist/_kit.html   -> muestrario del sistema visual (con --kit)
Uso: python3 build.py [--kit]
"""
import base64
import json
import re
import shutil
import sys
from pathlib import Path

from PIL import Image, ImageDraw

RAIZ = Path(__file__).parent
SRC, DIST = RAIZ / "src", RAIZ / "dist"

# Tipografías empaquetadas (subconjunto latino de @fontsource): (familia, peso, archivo)
FUENTES = [
    ("Atkinson Hyperlegible", 400, "atkinson-hyperlegible-latin-400-normal.woff2"),
    ("Atkinson Hyperlegible", 700, "atkinson-hyperlegible-latin-700-normal.woff2"),
    ("Zilla Slab", 600, "zilla-slab-latin-600-normal.woff2"),
    ("Zilla Slab", 700, "zilla-slab-latin-700-normal.woff2"),
]
SCRIPTS = ("data.js", "model.js", "calc.js", "alertas.js", "db.js",
           "ui/componentes.js", "ui/grafico.js", "ui/animar.js")


def scripts_app():
    """Base + src/vistas/*.js en orden alfabético (sin *.legacy.js) + app.js al final."""
    vistas = sorted(p.relative_to(SRC).as_posix() for p in (SRC / "vistas").glob("*.js")
                    if not p.name.endswith(".legacy.js"))
    return SCRIPTS + tuple(vistas) + ("app.js",)


def fuentes_css(incrustar=False):
    """@font-face con url(fonts/...) relativa, o con data URI base64 (una sola página)."""
    reglas = []
    for familia, peso, archivo in FUENTES:
        if incrustar:
            datos = base64.b64encode((SRC / "fonts" / archivo).read_bytes()).decode("ascii")
            url = f"data:font/woff2;base64,{datos}"
        else:
            url = f"fonts/{archivo}"
        reglas.append(f'@font-face {{ font-family: "{familia}"; font-style: normal; font-weight: {peso}; '
                      f'font-display: swap; src: url({url}) format("woff2"); }}')
    return "<style>\n" + "\n".join(reglas) + "\n</style>"


def leer(nombre):
    return (SRC / nombre).read_text(encoding="utf-8")


def cuerpo():
    css, body = leer("styles.css"), leer("body.html")
    scripts = "\n".join(f"<script>\n{leer(n)}\n</script>" for n in scripts_app())
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
{fuentes_css()}
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
    (DIST / "fonts").mkdir()
    for _, _, archivo in FUENTES:
        shutil.copy(SRC / "fonts" / archivo, DIST / "fonts" / archivo)
    iconos(DIST / "icons")

    # Versión de una sola página (vista previa)
    artefacto = f"""<title>Appollo</title>
<meta name="claude:viewport-fit-sides" content="cover">
{fuentes_css(incrustar=True)}
<style>
{css}
</style>
{body}
{scripts}
"""
    (RAIZ / "artifact.html").write_text(artefacto, encoding="utf-8")
    print("Listo: dist/ y artifact.html")


def construir_kit():
    """dist/_kit.html: cada componente en tema claro y oscuro (sin app.js)."""
    css = leer("styles.css")
    sprite = re.match(r"\s*(<svg.*?</svg>)", leer("body.html"), re.S).group(1)
    scripts = "\n".join(f"<script>\n{leer(n)}\n</script>" for n in SCRIPTS + ("ui/kit.js",))
    kit = f"""<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Appollo · Kit visual</title>
{fuentes_css()}
<style>
{css}
{leer("ui/kit.css")}
</style>
</head>
<body>
{sprite}
<header class="kit-portada"><p class="kit-marca">Appollo 2</p><h1>Kit visual</h1>
<p>Componentes del sistema en tema claro y oscuro. Sin atributo, la página sigue el tema del teléfono.</p></header>
<main id="kit"></main>
{scripts}
</body>
</html>
"""
    (DIST / "_kit.html").write_text(kit, encoding="utf-8")
    print("Listo: dist/_kit.html")


if __name__ == "__main__":
    construir()
    if "--kit" in sys.argv[1:]:
        construir_kit()
