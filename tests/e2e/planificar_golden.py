"""Captura los valores de referencia del planificador ORIGINAL (Appollo 1) para tests/e2e/planificar.golden.json.
Uso: python3 tests/e2e/planificar_golden.py /ruta/a/appollo-1/dist
Conduce la interfaz antigua (data-act) con Playwright a 360x740 y guarda las cifras tal como se muestran."""
import json, socket, subprocess, sys, time, urllib.request
from pathlib import Path
from playwright.sync_api import sync_playwright

RAIZ = Path(__file__).resolve().parents[2]
SALIDA = Path(__file__).with_name("planificar.golden.json")

# Configuraciones: genética, objetivo (doble/criolla), edad+unidad (None = la de fábrica), aves, altitud,
# dato real (% postura o g), marcar todo, prácticas a desmarcar o a marcar (lista), enfermedad,
# semana/día final en días (None = el de fábrica), precios.
CONFIGS = [
    {"id": "a-hyline", "gen": "hyline-brown", "edad": 24, "unidad": "semanas", "aves": 500, "alt": 2800,
     "todo": False, "precios": {"cubeta": "3.60", "kgAlim": "0.62"}},
    {"id": "a2-hyline-todo", "gen": "hyline-brown", "edad": 24, "unidad": "semanas", "aves": 500, "alt": 2800, "todo": True},
    {"id": "b-cobb", "gen": "cobb500", "aves": 500, "alt": 2800, "todo": True, "precios": {"kgVivo": "1.90", "kgAlim": "0.62"}},
    {"id": "c-ross", "gen": "ross308", "aves": 500, "alt": 2800, "todo": True, "quitar": "primero"},
    {"id": "d-criolla", "gen": "criolla", "aves": 500, "alt": 2800, "todo": True},
    {"id": "d2-rhode-carne", "gen": "rhode-island", "obj": "carne", "aves": 500, "alt": 2800, "todo": True},
    {"id": "e-lohmann-enf", "gen": "lohmann-brown", "edad": 30, "unidad": "semanas", "aves": 500, "alt": 2800,
     "todo": True, "enf": "primera"},
    # Ronda de revisión 1: dato real + fin no de fábrica, altitud baja con manejo parcial, postura parcial a 1500 m.
    {"id": "f-hyline-real-fin90", "gen": "hyline-brown", "edad": 30, "unidad": "semanas", "aves": 500, "alt": 2800,
     "real": "85", "todo": True, "fin": 630},
    {"id": "g-ross-400-parcial", "gen": "ross308", "aves": 500, "alt": 400,
     "marcar": ["a_fase", "a_racion", "t_rango", "w_lib", "b_nd", "s_bio"], "precios": {"kgVivo": "1.90", "kgAlim": "0.62"}},
    {"id": "h-isa-1500-parcial", "gen": "isa-brown", "edad": 40, "unidad": "semanas", "aves": 300, "alt": 1500,
     "marcar": ["a_fase", "a_conchilla", "t_luz", "w_lib", "w_clor", "v_ref", "s_desp"], "precios": {"cubeta": "3.60", "kgAlim": "0.62"}},
]

LEER = """() => {
  const t = s => { const e = document.querySelector(s); return e ? e.innerText.replace(/\\s+/g, ' ').trim() : null; };
  const all = (s, f) => [...document.querySelectorAll(s)].map(f);
  return {
    heroe: t('.heroe-num'), sub: t('.heroe-sub'), vs: t('.heroe .vs'), titulo: t('.heroe .eyebrow'),
    kpis: all('.kpi', k => [k.querySelector('.v').innerText.replace(/\\s+/g, ' ').trim(), k.querySelector('.l').innerText.trim()]),
    indice: t('.bloque .indice-num'),
    brechas: all('.brechas li', li => [li.querySelector('span span').innerText.trim(), li.querySelector('.g').innerText.trim()]),
    fin: all('[data-act=fin]', b => [b.innerText.trim(), b.getAttribute('aria-pressed') === 'true']),
    eco: all('#eco-res > div', d => [...d.querySelectorAll('span')].map(s => s.innerText.trim())),
    lead: t('.intro .lead'),
    avisos: (() => { const e = document.querySelector('#view .aviso.suave > span'); return e ? e.innerText.split('\\n').map(x => x.trim()).filter(Boolean) : []; })()
  };
}"""


def libre():
    s = socket.socket(); s.bind(("127.0.0.1", 0)); p = s.getsockname()[1]; s.close(); return p


def capturar(pg, url, c):
    pg.goto(url + "#genetica"); pg.wait_for_selector("[data-act=gen]")
    pg.click(f"[data-act=gen][data-id={c['gen']}]"); pg.wait_for_selector("#edad")
    if c.get("obj"):
        pg.click(f"[data-act=obj][data-v={c['obj']}]"); pg.wait_for_selector("#edad")
    if c.get("unidad"):
        pg.click(f"[data-act=unidad][data-v={c['unidad']}]")
    if c.get("edad") is not None:
        pg.fill("#edad", str(c["edad"]))
    pg.fill("#aves", str(c["aves"])); pg.fill("#alt", str(c["alt"]))
    if c.get("real") is not None:
        pg.wait_for_selector("#real"); pg.fill("#real", str(c["real"]))
    edad = pg.input_value("#edad"); unidad = pg.evaluate("document.querySelector('[data-act=unidad][aria-pressed=true]').dataset.v")
    pg.click("#btn-sig"); pg.wait_for_selector(".resumen-manejo")
    info = {"edad": float(edad), "unidad": unidad}
    if c.get("enf"):
        enf = pg.evaluate("document.querySelector('#enf option[value]:not([value=\"\"])').value")
        pg.select_option("#enf", enf); pg.wait_for_selector(".signos")
        info["enf"] = enf
    if c.get("todo"):
        pg.click("[data-act=todo]"); pg.wait_for_timeout(100)
    if c.get("quitar"):
        sid = pg.evaluate("document.querySelector('input[data-sel]:checked').dataset.sel")
        pg.click(f"input[data-sel='{sid}']"); info["quitar"] = sid
    for sid in c.get("marcar") or []:
        pg.click(f"input[data-sel='{sid}']")
    info["indiceManejo"] = pg.inner_text("#indice")
    info["sel"] = sorted(pg.evaluate("JSON.parse(localStorage.getItem('appollo.v1.estado')).sel"))
    pg.click("#barra [data-r=proyeccion]"); pg.wait_for_selector(".heroe-num")
    if c.get("fin"):
        pg.click(f"[data-act=fin][data-v='{c['fin']}']")
        pg.wait_for_selector(f"[data-act=fin][data-v='{c['fin']}'][aria-pressed=true]")
    for k, v in (c.get("precios") or {}).items():
        pg.fill({"cubeta": "#p-cubeta", "kgVivo": "#p-kg", "kgAlim": "#p-alim"}[k], v)
    info.update(pg.evaluate(LEER))
    pg.click("#barra [data-act=copiar]"); pg.wait_for_timeout(200)
    txt = pg.evaluate("navigator.clipboard.readText()")
    info["resumen"] = [l for l in txt.split("\n") if not l.startswith("Fecha:")]
    return info


def main():
    dist = Path(sys.argv[1] if len(sys.argv) > 1 else "/home/claude/appollo/dist")
    port = libre()
    srv = subprocess.Popen([sys.executable, "-m", "http.server", str(port), "--bind", "127.0.0.1", "--directory", str(dist)],
                           stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    url = f"http://localhost:{port}/"
    try:
        for _ in range(50):
            try: urllib.request.urlopen(url, timeout=1); break
            except Exception: time.sleep(0.1)
        out = {"fuente": "Appollo 1 (dist original), capturado con tests/e2e/planificar_golden.py", "configs": []}
        with sync_playwright() as pw:
            br = pw.chromium.launch()
            for c in CONFIGS:
                ctx = br.new_context(viewport={"width": 360, "height": 740}, permissions=["clipboard-read", "clipboard-write"])
                pg = ctx.new_page()
                r = capturar(pg, url, c)
                out["configs"].append({"config": c, "esperado": r})
                print(c["id"], r["heroe"], r["sub"], r["indice"])
                ctx.close()
            br.close()
        SALIDA.write_text(json.dumps(out, ensure_ascii=False, indent=1), encoding="utf-8")
        print("Escrito", SALIDA)
    finally:
        srv.terminate()


if __name__ == "__main__":
    main()
