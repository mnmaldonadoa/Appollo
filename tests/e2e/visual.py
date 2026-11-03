"""Prueba e2e del sistema visual sobre dist/_kit.html (python3 build.py --kit).
Comprueba tamaños táctiles, desborde, tipografías, contraste WCAG >= 7:1 en claro
y oscuro (colores calculados de elementos reales del kit) y movimiento reducido."""
import socket, subprocess, sys, time, urllib.request
from pathlib import Path
from playwright.sync_api import sync_playwright

RAIZ = Path(__file__).resolve().parents[2]
fallos = 0
errores_pagina = []


def libre():
    s = socket.socket(); s.bind(("127.0.0.1", 0)); p = s.getsockname()[1]; s.close(); return p


def check(nombre, cond, extra=""):
    global fallos
    print(("ok   " if cond else "FAIL ") + nombre + ("" if cond else f"  {extra}"))
    if not cond:
        fallos += 1


# Funciones JS compartidas: luminancia, mezcla alfa y fondo efectivo de un elemento.
JS_COLOR = r"""
window.__c = (() => {
  const parse = s => { const m = s.match(/rgba?\(([^)]+)\)/); if (!m) return null;
    const p = m[1].split(/[ ,\/]+/).filter(Boolean).map(Number); return {r:p[0], g:p[1], b:p[2], a:p.length > 3 ? p[3] : 1}; };
  const mezcla = (f, d) => ({r: f.r*f.a + d.r*(1-f.a), g: f.g*f.a + d.g*(1-f.a), b: f.b*f.a + d.b*(1-f.a), a: 1});
  const canal = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
  const lum = c => 0.2126*canal(c.r) + 0.7152*canal(c.g) + 0.0722*canal(c.b);
  const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
  const fondo = el => { const capas = [];
    for (let n = el; n && n.nodeType === 1; n = n.parentElement) {
      const c = parse(getComputedStyle(n).backgroundColor); if (c && c.a > 0) { capas.push(c); if (c.a >= 1) break; } }
    let r = {r:255, g:255, b:255, a:1}; for (let i = capas.length - 1; i >= 0; i--) r = mezcla(capas[i], r); return r; };
  const par = el => { const f = fondo(el); const t = mezcla(parse(getComputedStyle(el).color), f); return {ratio: ratio(t, f), lum: lum(f)}; };
  const visible = el => { const r = el.getBoundingClientRect(); const s = getComputedStyle(el);
    return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none' && Number(s.opacity) > 0; };
  return {parse, ratio, lum, fondo, par, visible};
})();
"""


def main():
    kit = RAIZ / "dist" / "_kit.html"
    if not kit.exists():
        print("FAIL falta dist/_kit.html (python3 build.py --kit)"); sys.exit(1)
    port = libre()
    srv = subprocess.Popen([sys.executable, "-m", "http.server", str(port), "--bind", "127.0.0.1",
                            "--directory", str(RAIZ / "dist")], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    url = f"http://localhost:{port}/_kit.html"
    try:
        for _ in range(50):
            try: urllib.request.urlopen(url, timeout=1); break
            except Exception: time.sleep(0.1)
        else:
            print("FAIL el servidor http no arrancó"); sys.exit(1)
        with sync_playwright() as pw:
            br = pw.chromium.launch()

            def nueva(**opc):
                ctx = br.new_context(viewport={"width": 360, "height": 740}, **opc)
                ctx.add_init_script(JS_COLOR)
                pg = ctx.new_page()
                pg.on("pageerror", lambda e: (print("  pageerror:", e), errores_pagina.append(str(e))))
                pg.goto(url)
                pg.evaluate("document.fonts.ready")
                return ctx, pg

            ctx, pg = nueva()

            # 1. Paneles del kit
            n_pan = pg.evaluate("document.querySelectorAll('.kit-panel[data-tema]').length")
            check("kit tiene panel claro y oscuro", pg.evaluate(
                "!!document.querySelector('.kit-panel[data-tema=claro]') && !!document.querySelector('.kit-panel[data-tema=oscuro]')"), n_pan)
            for comp in ("boton", "tarjeta", "contador", "hoja", "esqueleto", "grafico", "iconos"):
                check(f"kit muestra {comp} en ambos temas",
                      pg.evaluate(f"document.querySelectorAll('[data-kit=\"{comp}\"]').length >= 2"))

            # 2. Tamaños táctiles
            chicos = pg.evaluate("""() => [...document.querySelectorAll('button, a, [role=button]')].filter(__c.visible)
              .map(e => ({t: (e.textContent || e.getAttribute('aria-label') || '').trim().slice(0, 30), h: e.getBoundingClientRect().height}))
              .filter(x => x.h < 56)""")
            n_obj = pg.evaluate("[...document.querySelectorAll('button, a, [role=button]')].filter(__c.visible).length")
            check(f"todo button/a/[role=button] visible mide >= 56 px ({n_obj})", n_obj > 0 and not chicos, chicos[:5])
            cont = pg.evaluate("""() => [...document.querySelectorAll('.contador button')].filter(__c.visible)
              .map(e => { const r = e.getBoundingClientRect(); return [r.width, r.height]; })""")
            check("botones del Contador >= 64 px", len(cont) >= 4 and all(w >= 64 and h >= 64 for w, h in cont), cont)
            juntos = pg.evaluate("""() => {
              const ts = [...document.querySelectorAll('button, a, [role=button], input')].filter(__c.visible);
              const malos = [];
              for (let i = 0; i < ts.length; i++) for (let j = i + 1; j < ts.length; j++) {
                const a = ts[i], b = ts[j]; if (a.contains(b) || b.contains(a)) continue;
                const p = a.getBoundingClientRect(), q = b.getBoundingClientRect();
                const dx = Math.max(q.left - p.right, p.left - q.right), dy = Math.max(q.top - p.bottom, p.top - q.bottom);
                if (dx < 7.5 && dy < 7.5) malos.push([a.textContent.trim().slice(0, 15), b.textContent.trim().slice(0, 15), dx, dy]);
              }
              return malos; }""")
            check("separación >= 8 px entre objetivos táctiles", not juntos, juntos[:5])

            # 3. Desborde horizontal
            ov = pg.evaluate("[document.documentElement.scrollWidth, document.documentElement.clientWidth]")
            check("sin desborde horizontal a 360 px", ov[0] <= ov[1], ov)

            # 4. Tipografía
            fam = pg.evaluate("getComputedStyle(document.body).fontFamily")
            check("body usa Atkinson Hyperlegible", fam.strip('"\' ').startswith("Atkinson"), fam)
            check("texto base 18 px", pg.evaluate("getComputedStyle(document.body).fontSize") == "18px")
            hfam = pg.evaluate("getComputedStyle(document.querySelector('h1, h2')).fontFamily")
            check("títulos usan Zilla Slab", hfam.strip('"\' ').startswith("Zilla Slab"), hfam)
            cifra = pg.evaluate("getComputedStyle(document.querySelector('.tarjeta-cifra')).fontFamily")
            check("cifras usan Zilla Slab", cifra.strip('"\' ').startswith("Zilla Slab"), cifra)
            cargadas = pg.evaluate("""() => [...document.fonts].filter(f => f.status === 'loaded').map(f => f.family.replace(/["']/g, '') + ' ' + f.weight)""")
            check("fuentes cargadas: Atkinson 400/700, Zilla 600/700",
                  all(x in cargadas for x in ("Atkinson Hyperlegible 400", "Atkinson Hyperlegible 700", "Zilla Slab 600", "Zilla Slab 700")), cargadas)
            check("document.fonts.check Atkinson y Zilla", pg.evaluate(
                "document.fonts.check('18px \"Atkinson Hyperlegible\"') && document.fonts.check('700 32px \"Zilla Slab\"')"))
            minimo = pg.evaluate("""() => [...document.querySelectorAll('body *')].filter(e => __c.visible(e) &&
                [...e.childNodes].some(n => n.nodeType === 3 && n.textContent.trim()))
              .map(e => [e.textContent.trim().slice(0, 20), parseFloat(getComputedStyle(e).fontSize)]).filter(x => x[1] < 16)""")
            check("ningún texto menor de 16 px", not minimo, minimo[:5])

            # 5. Contraste: pares de tokens (muestrario) y todo texto visible, por panel
            for tema in ("claro", "oscuro"):
                pares = pg.evaluate(f"""() => [...document.querySelectorAll('.kit-panel[data-tema={tema}] [data-par]')]
                  .map(e => [e.dataset.par, __c.par(e).ratio])""")
                nombres = {p for p, _ in pares}
                requeridos = {"texto/fondo", "texto/superficie", "secundario/fondo", "secundario/superficie",
                              "sobre-primario/primario", "primario/superficie", "alerta/superficie",
                              "precaucion/superficie", "sobre-alerta/alerta", "sobre-huevo/huevo", "ok/superficie"}
                check(f"[{tema}] muestrario con todos los pares", requeridos <= nombres, requeridos - nombres)
                bajos = [(p, round(r, 2)) for p, r in pares if r < 7]
                check(f"[{tema}] pares de tokens >= 7:1 ({len(pares)})", pares and not bajos, bajos)
                bajos = pg.evaluate(f"""() => [...document.querySelectorAll('.kit-panel[data-tema={tema}] *')]
                  .filter(e => __c.visible(e) && [...e.childNodes].some(n => n.nodeType === 3 && n.textContent.trim()))
                  .map(e => [e.textContent.trim().slice(0, 24), +__c.par(e).ratio.toFixed(2)]).filter(x => x[1] < 7)""")
                check(f"[{tema}] todo texto visible del panel >= 7:1", not bajos, bajos[:6])
            lum = pg.evaluate("[__c.fondo(document.querySelector('.kit-panel[data-tema=claro]')).r, __c.lum(__c.fondo(document.querySelector('.kit-panel[data-tema=oscuro]')))]")
            check("panel oscuro tiene fondo oscuro", lum[1] < 0.05, lum)

            # 6. Gráfico sin NaN con series vacías o cortas
            graf = pg.evaluate("[...document.querySelectorAll('[data-kit=grafico] svg')].map(s => s.outerHTML)")
            check("gráficos renderizados (incluye vacío y corto)", len(graf) >= 6, len(graf))
            check("gráficos sin NaN/undefined/Infinity", graf and not any(("NaN" in g or "undefined" in g or "Infinity" in g) for g in graf))

            # 7. Animaciones activas sin movimiento reducido
            r = pg.evaluate("""() => { const el = document.createElement('div'); document.body.appendChild(el);
              palomita(el); const anim = document.getAnimations().filter(a => el.contains(a.effect && a.effect.target)).length;
              return {anim, svg: !!el.querySelector('svg'), rm: reducirMovimiento()}; }""")
            check("palomita anima sin movimiento reducido", r["svg"] and r["anim"] > 0 and r["rm"] is False, r)
            ctx.close()

            # 8. Tema: atributo en <html> y prefers-color-scheme
            ctx, pg = nueva(color_scheme="dark")
            l = pg.evaluate("__c.lum(__c.fondo(document.body))")
            check("sin atributo sigue prefers-color-scheme: dark", l < 0.05, l)
            pg.evaluate("document.documentElement.dataset.tema = 'claro'")
            l = pg.evaluate("__c.lum(__c.fondo(document.body))")
            check("data-tema=claro en <html> fuerza claro", l > 0.8, l)
            ctx.close()
            ctx, pg = nueva(color_scheme="light")
            pg.evaluate("document.documentElement.dataset.tema = 'oscuro'")
            l = pg.evaluate("__c.lum(__c.fondo(document.body))")
            check("data-tema=oscuro en <html> fuerza oscuro", l < 0.05, l)
            ctx.close()

            # 9. Movimiento reducido: palomita y contar instantáneos
            ctx, pg = nueva(reduced_motion="reduce")
            r = pg.evaluate("""() => { const el = document.createElement('div'); document.body.appendChild(el);
              palomita(el); const p = el.querySelector('path');
              const corriendo = document.getAnimations().filter(a => a.playState === 'running').length;
              const off = p ? parseFloat(getComputedStyle(p).strokeDashoffset) || 0 : -1;
              const n = document.createElement('span'); document.body.appendChild(n); contar(n, 1234);
              const trans = [...document.querySelectorAll('.kit-panel *')].some(e => parseFloat(getComputedStyle(e).transitionDuration) > 0.011);
              return {rm: reducirMovimiento(), corriendo, off, n: n.textContent, trans}; }""")
            check("reducirMovimiento() es true", r["rm"] is True, r)
            check("palomita completa al instante (sin animación)", r["corriendo"] == 0 and r["off"] == 0, r)
            check("contar instantáneo", r["n"].replace(".", "").replace(",", "").replace(" ", "").replace(" ", "") == "1234", r)
            check("sin transiciones con movimiento reducido", r["trans"] is False, r)
            check("vibrar() no lanza error", pg.evaluate("(() => { try { vibrar(); return true; } catch (e) { return false; } })()"))
            ctx.close()
            br.close()
        check("sin errores de página", not errores_pagina, errores_pagina[:3])
    finally:
        srv.terminate(); srv.wait()
    print("TODO OK" if not fallos else f"{fallos} FALLOS")
    sys.exit(1 if fallos else 0)


if __name__ == "__main__":
    main()
