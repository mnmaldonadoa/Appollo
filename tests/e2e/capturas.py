"""Capturas de pantalla de Appollo para revisar el estilo visual (360x740, claro y oscuro).
Siembra por la interfaz una granja con un lote Hy-Line Brown con plan, registros e inventario, y guarda PNG en
capturas/<etiqueta>/<pantalla>-<tema>.png. No es una prueba: no falla salvo que la app no cargue.
Uso: python3 build.py && python3 tests/e2e/capturas.py <etiqueta>"""
import sys
from pathlib import Path
from playwright.sync_api import sync_playwright
sys.path.insert(0, str(Path(__file__).resolve().parent))
from util import RAIZ, servidor, esperar, nuevo_contexto

TEMAS = ("claro", "oscuro")


def main():
    etiqueta = sys.argv[1] if len(sys.argv) > 1 else "actual"
    salida = RAIZ / "capturas" / etiqueta
    salida.mkdir(parents=True, exist_ok=True)
    with servidor() as url, sync_playwright() as pw:
        br = pw.chromium.launch()
        pg = nuevo_contexto(br, viewport={"width": 360, "height": 740}, device_scale_factor=2).new_page()
        pg.goto(url); pg.wait_for_selector("#view .pantalla", timeout=5000)

        def quieto():
            pg.wait_for_function("document.getAnimations().every(a => a.playState !== 'running' || a.effect.getTiming().iterations === Infinity)", timeout=4000)
            pg.wait_for_timeout(150)

        def foto(nombre, completa=False):
            quieto()
            for t in TEMAS:
                pg.evaluate(f"document.documentElement.setAttribute('data-tema', '{t}')"); pg.wait_for_timeout(60)
                pg.screenshot(path=str(salida / f"{nombre}-{t}.png"), full_page=completa)
            pg.evaluate("document.documentElement.setAttribute('data-tema', 'claro')")

        def ir(h):
            pg.evaluate(f"location.hash = '{h}'"); pg.wait_for_function(f"location.hash === '{h}'")
            pg.wait_for_selector("#view .pantalla"); pg.wait_for_timeout(150)

        def cerrada(): esperar(pg, "!document.querySelector('.hoja-capa')", 4000)

        def registrar(tipo, valor):
            pg.click("#nav [data-accion=registrar]"); pg.click(f".hoja [data-tipo={tipo}]"); pg.wait_for_selector(".hoja .reg-guardar")
            pg.fill("#reg-valor", str(valor)); pg.click(".hoja [data-accion=reg-guardar]"); cerrada()
            pg.wait_for_selector("#toast", state="hidden", timeout=9000)

        foto("bienvenida")
        pg.fill("#bv-nombre", "Granja La Esperanza"); pg.click("#view [data-accion=bv-siguiente]")
        pg.wait_for_selector("#view .bienvenida[data-paso='2']")
        pg.click("#view [data-accion=bv-tipo][data-tipo=postura]"); pg.click("#view [data-accion=bv-crear]")
        pg.wait_for_selector("#view .nuevo-lote")
        foto("nuevo-lote-1", completa=True)
        pg.click("#view [data-accion=nl-genetica][data-id=hyline-brown]"); pg.wait_for_selector("#view .nuevo-lote[data-paso='2']")
        pg.fill("#nl-aves", "500"); pg.click("#view [data-accion=nl-modo][data-modo=edad]")
        pg.click("#view [data-accion=nl-unidad][data-unidad=dias]"); pg.fill("#nl-edad", "150")
        foto("nuevo-lote-2")
        pg.click("#view [data-accion=nl-siguiente]"); pg.wait_for_selector("#view .nuevo-lote[data-paso='3']")
        foto("nuevo-lote-3")
        pg.click("#view [data-accion=nl-plan-siguiente]"); pg.wait_for_selector("#view .nuevo-lote[data-paso='4']")
        pg.click("#view [data-accion=nl-altitud][data-valor='2800']"); pg.fill("#nl-galpon", "G1")
        foto("nuevo-lote-4")
        pg.click("#view [data-accion=nl-crear]"); pg.wait_for_function("location.hash.startsWith('#/lote/')", timeout=4000)
        lid = pg.evaluate("location.hash.split('/')[2]")

        registrar("mortalidad", 3); registrar("huevos", 410); registrar("alimento", 55)
        pg.click("#nav [data-accion=registrar]"); pg.wait_for_selector(".hoja [data-tipo=mortalidad]")
        foto("registrar"); pg.keyboard.press("Escape"); cerrada()

        ir("#/inicio"); foto("inicio", completa=True)
        ir("#/alertas"); foto("alertas", completa=True)
        ir("#/lotes"); foto("lotes")
        ir("#/lote/" + lid); foto("detalle", completa=True)
        ir("#/lote/" + lid + "/plan"); foto("plan-ciclo", completa=True)
        ir("#/inventario"); foto("inventario")
        ir("#/reportes"); foto("reportes", completa=True)
        ir("#/mas"); foto("mas")
        ir("#/ajustes"); foto("ajustes", completa=True)
        ir("#/plan/genetica"); foto("planificar", completa=True)
        br.close()
    print(f"Listo: {len(list(salida.glob('*.png')))} capturas en {salida.relative_to(RAIZ)}")


if __name__ == "__main__":
    main()
