"""Prueba e2e del planificador nuevo (#/plan/genetica|lote|manejo|proyeccion) contra los valores del ORIGINAL.
Uso: python3 build.py && python3 tests/e2e/planificar.py

Recorre cada configuración de tests/e2e/planificar.golden.json (capturado con tests/e2e/planificar_golden.py sobre
el dist de Appollo 1) en la interfaz nueva a 360x740 y compara lo que se muestra: titular, subtítulo, % del estándar,
KPIs, índice de manejo, lista "lo que más sumaría", semanas/días finales, ingresos y el resumen copiado.

Normalización (norm): se pasa a minúsculas (el original mostraba el título en mayúsculas por CSS), se quitan todos
los espacios (incluidos NBSP y espacio fino; el original pegaba número y unidad: "55.961huevos"), se quitan los
separadores de miles (punto, espacio o NBSP entre dígitos seguidos de 3 dígitos) y la coma decimal se vuelve punto.
Así "55.961 huevos" == "55.961huevos" == "55961huevos" y "36,8 %" == "36.8%". Los dígitos deben ser idénticos."""
import json, re, socket, subprocess, sys, time, urllib.request
from pathlib import Path
from playwright.sync_api import sync_playwright
sys.path.insert(0, str(Path(__file__).resolve().parent))
from util import nuevo_contexto

RAIZ = Path(__file__).resolve().parents[2]
SDD = RAIZ / ".superpowers/sdd/2026-11-03-appollo-gestion"
GOLDEN = json.loads(Path(__file__).with_name("planificar.golden.json").read_text(encoding="utf-8"))
fallos = 0
errores = []

CHICOS = """() => [...document.querySelectorAll('button, a, [role=button], select, input, summary')].filter(e => {
    const r = e.getBoundingClientRect(), s = getComputedStyle(e);
    return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && !e.closest('[hidden]');
  }).map(e => ({t: (e.textContent || e.getAttribute('aria-label') || e.id || '').trim().slice(0, 24), h: Math.round(e.getBoundingClientRect().height)}))
  .filter(x => x.h < 56)"""
DESBORDE = "document.documentElement.scrollWidth > document.documentElement.clientWidth"
SIN_NAN = "!/NaN|Infinity|undefined/.test(document.body.innerText)"
LETRA_CHICA = """() => [...document.querySelectorAll('#view *')].filter(e => {
    if (!e.childNodes.length || ![...e.childNodes].some(n => n.nodeType === 3 && n.textContent.trim())) return false;
    const r = e.getBoundingClientRect(); if (!r.width || !r.height) return false;
    return parseFloat(getComputedStyle(e).fontSize) < 16;
  }).map(e => e.tagName + '.' + e.className + ': ' + e.textContent.trim().slice(0, 20))"""

LEER = """() => {
  const t = s => { const e = document.querySelector(s); return e ? e.innerText.replace(/\\s+/g, ' ').trim() : null; };
  const all = (s, f) => [...document.querySelectorAll(s)].map(f);
  return {
    heroe: t('#view .plan-heroe-num'), sub: t('#view .plan-heroe-sub'), vs: t('#view .plan-vs'), titulo: t('#view .plan-heroe-titulo'),
    kpis: all('#view .plan-kpi', k => [k.querySelector('.plan-kpi-v').innerText.trim(), k.querySelector('.plan-kpi-l').innerText.trim()]),
    indice: t('#view .plan-indice-proy'),
    brechas: all('#view .plan-brechas li', li => [li.querySelector('.plan-brecha-n').innerText.trim(), li.querySelector('.plan-brecha-g').innerText.trim()]),
    fin: all('#view [data-accion=plan-fin]', b => [b.innerText.trim(), b.getAttribute('aria-pressed') === 'true']),
    eco: all('#plan-eco > div', d => [...d.querySelectorAll('span')].map(s => s.innerText.trim())),
    lead: t('#view .plan-lead'),
    avisos: (() => { const e = document.querySelector('#view .plan-aviso-suave > span'); return e ? e.innerText.split('\\n').map(x => x.trim()).filter(Boolean) : []; })()
  };
}"""


def norm(x):
    if isinstance(x, (list, tuple)):
        return [norm(v) for v in x]
    if isinstance(x, bool) or x is None:
        return x
    s = str(x).lower()
    s = re.sub(r"(?<=\d)[.   ](?=\d{3}(?!\d))", "", s)
    s = re.sub(r"(?<=\d),(?=\d)", ".", s)
    return re.sub(r"[\s  ]+", "", s)


def libre():
    s = socket.socket(); s.bind(("127.0.0.1", 0)); p = s.getsockname()[1]; s.close(); return p


def check(nombre, cond, extra=""):
    global fallos
    print(("ok   " if cond else "FAIL ") + nombre + ("" if cond else f"  {extra}")); fallos += 0 if cond else 1


def main():
    port = libre()
    srv = subprocess.Popen([sys.executable, "-m", "http.server", str(port), "--bind", "127.0.0.1",
                            "--directory", str(RAIZ / "dist")], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    url = f"http://localhost:{port}/"
    try:
        for _ in range(50):
            try: urllib.request.urlopen(url, timeout=1); break
            except Exception: time.sleep(0.1)
        else:
            print("FAIL el servidor http no arrancó"); sys.exit(1)
        with sync_playwright() as pw:
            br = pw.chromium.launch()

            def nueva(ruta="#/plan/genetica", **opc):
                ctx = nuevo_contexto(br, viewport={"width": 360, "height": 740},
                                     permissions=["clipboard-read", "clipboard-write"], **opc)
                pg = ctx.new_page()
                pg.on("pageerror", lambda e: errores.append("pageerror: " + str(e)))
                pg.on("console", lambda m: m.type == "error" and errores.append("console: " + m.text))
                pg.goto(url + ruta); pg.wait_for_selector("#view .pantalla, #view .vista-error", timeout=5000)
                return ctx, pg

            def quieto(pg):
                pg.wait_for_function("document.getAnimations().every(a => a.playState !== 'running' || a.effect.getTiming().iterations === Infinity)", timeout=4000)

            def medir(pg, donde):
                quieto(pg)
                chicos = pg.evaluate(CHICOS)
                check(f"[{donde}] objetivos táctiles >= 56 px", not chicos, chicos[:5])
                check(f"[{donde}] sin desborde horizontal", not pg.evaluate(DESBORDE))
                check(f"[{donde}] sin NaN/Infinity/undefined en pantalla", pg.evaluate(SIN_NAN))
                chica = pg.evaluate(LETRA_CHICA)
                check(f"[{donde}] texto >= 16 px", not chica, chica[:5])

            def paso(pg, p):
                pg.wait_for_selector(f"#view .planificar[data-paso='{p}']", timeout=5000)

            def lote(pg, c):
                pg.click(f"#view [data-accion=plan-genetica][data-id={c['gen']}]"); paso(pg, "lote")
                if c.get("obj"):
                    pg.click(f"#view [data-accion=plan-obj][data-v={c['obj']}]"); pg.wait_for_selector(f"#view [data-accion=plan-obj][data-v={c['obj']}][aria-pressed=true]")
                if c.get("unidad"):
                    pg.click(f"#view [data-accion=plan-unidad][data-v={c['unidad']}]"); pg.wait_for_selector(f"#view [data-accion=plan-unidad][data-v={c['unidad']}][aria-pressed=true]")
                if c.get("edad") is not None:
                    pg.fill("#plan-edad", str(c["edad"]))
                pg.fill("#plan-aves", str(c["aves"])); pg.fill("#plan-alt", str(c["alt"]))
                if c.get("real") is not None:
                    pg.wait_for_selector("#plan-real"); pg.fill("#plan-real", str(c["real"]))

            def a_manejo(pg):
                pg.click("#view [data-accion=plan-siguiente]"); paso(pg, "manejo")

            def a_proy(pg):
                pg.click("#view .plan-acciones [data-accion=plan-ir][data-paso=proyeccion]"); paso(pg, "proyeccion")

            def sel(pg):
                return sorted(pg.evaluate("JSON.parse(localStorage.getItem('appollo.v1.estado')).sel"))

            def foco(pg):
                return pg.evaluate("(() => { const a = document.activeElement; return a ? {accion: a.dataset.accion || null, v: a.dataset.v || null, id: a.id || null, tag: a.tagName} : null; })()")

            # ---------- 1. Paridad con el original: todas las configuraciones ----------
            for item in GOLDEN["configs"]:
                c, e = item["config"], item["esperado"]
                cid = c["id"]
                ctx, pg = nueva()
                paso(pg, "genetica")
                lote(pg, c)
                check(f"[{cid}] edad y unidad como el original", float(pg.input_value("#plan-edad")) == e["edad"]
                      and pg.get_attribute("#view [data-accion=plan-unidad][aria-pressed=true]", "data-v") == e["unidad"],
                      (pg.input_value("#plan-edad"), e["edad"], e["unidad"]))
                a_manejo(pg)
                if e.get("enf"):
                    pg.select_option("#plan-enf", e["enf"]); pg.wait_for_selector("#view .plan-signos")
                if c.get("todo"):
                    pg.click("#view [data-accion=plan-todo]"); pg.wait_for_timeout(100)
                if e.get("quitar"):
                    pg.click(f"#view input[data-sel='{e['quitar']}']"); pg.wait_for_timeout(50)
                for sid in c.get("marcar") or []:
                    pg.click(f"#view input[data-sel='{sid}']")
                check(f"[{cid}] índice de manejo {e['indiceManejo']}", norm(pg.inner_text("#plan-indice")) == norm(e["indiceManejo"]),
                      pg.inner_text("#plan-indice"))
                check(f"[{cid}] prácticas marcadas iguales al original", sel(pg) == e["sel"], (sel(pg), e["sel"]))
                a_proy(pg)
                if c.get("fin"):
                    pg.click(f"#view [data-accion=plan-fin][data-v='{c['fin']}']")
                    pg.wait_for_selector(f"#view [data-accion=plan-fin][data-v='{c['fin']}'][aria-pressed=true]")
                for k, v in (c.get("precios") or {}).items():
                    pg.fill({"cubeta": "#plan-p-cubeta", "kgVivo": "#plan-p-kg", "kgAlim": "#plan-p-alim"}[k], v)
                r = pg.evaluate(LEER)
                for campo in ("titulo", "heroe", "sub", "vs", "kpis", "indice", "brechas", "fin", "eco", "lead", "avisos"):
                    check(f"[{cid}] {campo}", norm(r[campo]) == norm(e[campo]), f"nuevo={r[campo]!r} original={e[campo]!r}")
                check(f"[{cid}] sin NaN/Infinity/undefined", pg.evaluate(SIN_NAN))
                pg.click("#view [data-accion=plan-copiar]")
                pg.wait_for_function("document.querySelector('#toast') && !document.querySelector('#toast').hidden", timeout=3000)
                txt = pg.evaluate("navigator.clipboard.readText()")
                lineas = [l for l in txt.split("\n") if not l.startswith("Fecha:")]
                check(f"[{cid}] resumen copiado igual al original", lineas == e["resumen"], (lineas, e["resumen"]))
                check(f"[{cid}] el resumen trae la fecha", any(l.startswith("Fecha:") for l in txt.split("\n")))
                ctx.close()

            # ---------- 2. Indicador de pasos, botón Atrás y guardas de ruta ----------
            ctx, pg = nueva("#/plan/proyeccion")
            paso(pg, "genetica")
            check("sin genética, #/plan/proyeccion vuelve a genética", pg.evaluate("location.hash") == "#/plan/genetica")
            check("indicador de 4 pasos", pg.locator("#view .plan-pasos .plan-paso").count() == 4)
            check("paso actual marcado: Genética", "Genética" in pg.inner_text("#view .plan-paso[aria-current=step]"))
            check("sin genética no se puede saltar a Lote", pg.locator("#view .plan-paso button[data-paso=lote][disabled]").count() == 1)
            n_gen = pg.evaluate("GENETICAS.length")
            check("se muestran todas las genéticas", pg.locator("#view [data-accion=plan-genetica]").count() == n_gen)
            pg.focus("#view [data-accion=plan-filtro][data-v=carne]"); pg.keyboard.press("Enter")
            pg.wait_for_selector("#view [data-accion=plan-filtro][data-v=carne][aria-pressed=true]")
            f = foco(pg)
            check("con teclado (Enter) el foco sigue en el mismo filtro tras redibujar", f and f["accion"] == "plan-filtro" and f["v"] == "carne", f)
            n_carne = pg.evaluate("GENETICAS.filter(g => g.tipo === 'carne').length")
            check("filtro Carne", pg.locator("#view [data-accion=plan-genetica]").count() == n_carne)
            pg.click("#view [data-accion=plan-filtro][data-v=todas]")
            pg.wait_for_selector("#view [data-accion=plan-filtro][data-v=todas][aria-pressed=true]")
            medir(pg, "genética")
            pg.evaluate("scrollTo(0, 0)"); pg.screenshot(path=str(SDD / "t9-genetica.png"))
            pg.click("#view .plan-volver"); pg.wait_for_function("location.hash === '#/mas'")
            try: pg.wait_for_selector("#view .mas-lista", timeout=3000); en_mas = True
            except Exception: en_mas = False
            check("Atrás en genética vuelve a Más", en_mas and pg.evaluate("location.hash") == "#/mas")
            pg.goto(url + "#/plan/genetica"); paso(pg, "genetica")
            lote(pg, {"gen": "hyline-brown", "unidad": "semanas", "edad": 24, "aves": 500, "alt": 2800})
            check("paso actual marcado: Lote", "Lote" in pg.inner_text("#view .plan-paso[aria-current=step]"))
            check("Genética queda hecha", pg.locator("#view .plan-paso.plan-paso-hecho").count() == 1)
            check("se muestra la fase", "Postura fase 1" in pg.inner_text("#view .plan-fase"))
            medir(pg, "lote")
            pg.evaluate("scrollTo(0, 0)"); pg.screenshot(path=str(SDD / "t9-lote.png"))
            pg.click("#view .plan-paso button[data-paso=genetica]"); paso(pg, "genetica")
            check("el indicador lleva a Genética", pg.evaluate("location.hash") == "#/plan/genetica")
            check("la genética elegida queda marcada", pg.get_attribute("#view [data-accion=plan-genetica][data-id=hyline-brown]", "aria-pressed") == "true")
            pg.click("#view .plan-paso button[data-paso=lote]"); paso(pg, "lote")
            check("los datos del lote se conservan", pg.input_value("#plan-edad") == "24" and pg.input_value("#plan-aves") == "500")
            a_manejo(pg)
            check("paso actual marcado: Manejo", "Manejo" in pg.inner_text("#view .plan-paso[aria-current=step]"))
            check("índice inicial 0 % (como el original)", norm(pg.inner_text("#plan-indice")) == "0%")
            medir(pg, "manejo")
            pg.evaluate("scrollTo(0, 0)"); pg.screenshot(path=str(SDD / "t9-manejo.png"))
            pg.click("#view .plan-volver"); paso(pg, "lote")
            check("Atrás en manejo vuelve a lote", pg.evaluate("location.hash") == "#/plan/lote")
            a_manejo(pg); a_proy(pg)
            check("paso actual marcado: Proyección", "Proyección" in pg.inner_text("#view .plan-paso[aria-current=step]"))
            check("hay gráfico de estándar contra proyección", pg.locator("#view .plan-grafico .grafico-estandar").count() == 1
                  and pg.locator("#view .plan-grafico .grafico-real").count() == 1)
            medir(pg, "proyección")
            pg.evaluate("scrollTo(0, 0)"); pg.screenshot(path=str(SDD / "t9-proyeccion.png"))
            pg.evaluate("scrollTo(0, 0)"); pg.screenshot(path=str(SDD / "t9-proyeccion-completa.png"), full_page=True)
            pg.click("#view .plan-volver"); paso(pg, "manejo")
            check("Atrás en proyección vuelve a manejo", pg.evaluate("location.hash") == "#/plan/manejo")

            # ---------- 3. Marcar / desmarcar cambia la proyección y "lo que más sumaría" ----------
            base = GOLDEN["configs"][0]["esperado"]
            pg.click("#view input[data-sel=a_fase]"); pg.wait_for_timeout(50)
            check("marcar una práctica sube el índice", norm(pg.inner_text("#plan-indice")) != "0%")
            check("la cuenta de la categoría se actualiza", pg.inner_text("#view [data-cuenta=alim]").strip() == "1/3", pg.inner_text("#view [data-cuenta=alim]"))
            a_proy(pg)
            r = pg.evaluate(LEER)
            check("con la práctica marcada hay más huevos", int(norm(r["heroe"]).replace("huevos", "")) > int(norm(base["heroe"]).replace("huevos", "")), r["heroe"])
            check("la práctica marcada sale de 'lo que más sumaría'", all(b[0] != "Dar balanceado de postura fase 1" for b in r["brechas"]), r["brechas"])
            pg.click("#view [data-accion=plan-ir][data-paso=manejo]"); paso(pg, "manejo")
            pg.click("#view input[data-sel=a_fase]"); pg.wait_for_timeout(50)
            check("desmarcar vuelve a 0 %", norm(pg.inner_text("#plan-indice")) == "0%")
            a_proy(pg)
            r = pg.evaluate(LEER)
            check("al desmarcar vuelve el valor original", norm(r["heroe"]) == norm(base["heroe"]) and norm(r["brechas"]) == norm(base["brechas"]), r)

            # ---------- 4. Validación de la edad (textos del original) ----------
            pg.click("#view .plan-paso button[data-paso=lote]"); paso(pg, "lote")

            def edad_error(valor, texto, donde):
                pg.fill("#plan-edad", valor)
                pg.wait_for_function(f"document.querySelector('#plan-err-edad').textContent === {json.dumps(texto)}", timeout=3000)
                bloqueado = pg.is_disabled("#view [data-accion=plan-siguiente]")
                pg.click("#view [data-accion=plan-siguiente]", force=True); pg.wait_for_timeout(150)
                check(f"edad {donde}: '{texto}' y bloquea Siguiente", bloqueado and pg.evaluate("location.hash") == "#/plan/lote")
            for v, t, d in (("100", "Para proyectar, la edad debe ser menor a 99 semanas.", "sobre el máximo"),
                            ("-1", "La edad no puede ser negativa.", "negativa"),
                            ("", "Escribe la edad de las aves.", "vacía")):
                try: edad_error(v, t, d)
                except Exception as ex: check(f"edad {d}", False, ex)
            for ruta in ("#/plan/manejo", "#/plan/proyeccion"):
                pg.evaluate(f"location.hash = '{ruta}'"); paso(pg, "lote")
                check(f"con edad inválida {ruta} vuelve a lote", pg.evaluate("location.hash") == "#/plan/lote")
            pg.fill("#plan-edad", "24")
            pg.wait_for_function("document.querySelector('#plan-err-edad').textContent === ''", timeout=3000)
            check("edad válida habilita Siguiente", not pg.is_disabled("#view [data-accion=plan-siguiente]"))
            pg.fill("#plan-aves", "0")
            check("aves fuera de rango bloquea Siguiente", pg.is_disabled("#view [data-accion=plan-siguiente]"))
            pg.fill("#plan-aves", "500")
            pg.click("#view .plan-paso button[data-paso=genetica]"); paso(pg, "genetica")
            pg.click("#view [data-accion=plan-genetica][data-id=cobb500]"); paso(pg, "lote")
            mx = pg.evaluate("GENETICAS.find(g => g.id === 'cobb500').carne.rango[1]")
            try: edad_error(str(mx + 5), f"La edad supera la edad máxima de venta ({mx} días).", "de carne sobre el máximo")
            except Exception as ex: check("edad de carne sobre el máximo", False, ex)
            pg.click("#view [data-accion=plan-menos][data-c=edad]")
            check("el botón − resta 1 a la edad", pg.input_value("#plan-edad") == str(mx + 4))
            pg.click("#view [data-accion=plan-preset]:first-child")
            pg.wait_for_function("document.querySelector('#plan-err-edad').textContent === ''", timeout=3000)
            check("un atajo de edad corrige el error", pg.input_value("#plan-edad") == "1")
            ctx.close()

            # ---------- 5. Enfermedad: remedios caseros, control químico y prácticas bloqueadas ----------
            ctx, pg = nueva()
            paso(pg, "genetica")
            lote(pg, {"gen": "lohmann-brown", "unidad": "semanas", "edad": 30, "aves": 500, "alt": 2800}); a_manejo(pg)
            check("sin problema sanitario: preventivos caseros", pg.locator("#view #cat-casero input[data-sel]").count() == pg.evaluate("PREVENTIVOS_CASEROS.length"))
            check("sin problema sanitario: no se recomienda medicar", "no se recomienda medicar" in pg.inner_text("#view #cat-quim"))
            pg.select_option("#plan-enf", "coccidiosis"); pg.wait_for_selector("#view .plan-signos")
            try: pg.wait_for_function("document.activeElement && document.activeElement.id === 'plan-enf'", timeout=3000)
            except Exception: pass
            check("tras elegir la enfermedad el foco vuelve al selector", (foco(pg) or {}).get("id") == "plan-enf", foco(pg))
            cas = pg.inner_text("#view #cat-casero")
            check("remedios caseros de la enfermedad con evidencia", pg.locator("#view #cat-casero input[data-sel=h_oreg]").count() == 1
                  and "Evidencia moderada" in cas, cas[:200])
            qu = pg.inner_text("#view #cat-quim")
            check("control químico con tiempo de retiro y aviso veterinario", "Retiro:" in qu and "receta de un médico veterinario" in qu
                  and pg.locator("#view #cat-quim input[data-sel=q_amp]").count() == 1, qu[:200])
            check("tratamiento no apto en postura está bloqueado", pg.is_disabled("#view input[data-sel=q_tol]") and "No apto en postura" in qu)
            antes = sel(pg)
            pg.click("#view input[data-sel=q_tol]", force=True); pg.wait_for_timeout(100)
            check("la práctica bloqueada no se puede marcar", sel(pg) == antes and not pg.is_checked("#view input[data-sel=q_tol]"), sel(pg))
            pg.focus("#view [data-accion=plan-todo]"); pg.keyboard.press("Enter")
            pg.wait_for_function("JSON.parse(localStorage.getItem('appollo.v1.estado')).sel.includes('q_amp')", timeout=3000)
            f = foco(pg)
            check("con teclado (Enter) el foco sigue en 'Marcar lo recomendado' tras redibujar", f and f["accion"] == "plan-todo", f)
            check("marcar todo no incluye la bloqueada", "q_tol" not in sel(pg) and "q_amp" in sel(pg), sel(pg))
            check("con 98 % (la bloqueada no cuenta) el botón sigue en 'Marcar lo recomendado', como el original",
                  norm(pg.inner_text("#plan-indice")) == "98%" and "Marcar lo recomendado" in pg.inner_text("#view [data-accion=plan-todo]"))
            medir(pg, "manejo con enfermedad")
            pg.locator("#view #cat-quim").scroll_into_view_if_needed(); pg.screenshot(path=str(SDD / "t9-manejo-quimico.png"))
            ctx.close()

            # ---------- 6. Copiar sin portapapeles: caja para copiar a mano ----------
            ctx, pg = nueva()
            paso(pg, "genetica")
            lote(pg, {"gen": "hyline-brown", "unidad": "semanas", "edad": 24, "aves": 500, "alt": 2800}); a_manejo(pg); a_proy(pg)
            pg.evaluate("navigator.clipboard.writeText = () => Promise.reject(new Error('no')); document.execCommand = () => false;")
            pg.click("#view [data-accion=plan-copiar]")
            pg.wait_for_selector("#view .plan-copia:not([hidden]) textarea", timeout=3000)
            check("sin portapapeles se muestra el resumen para copiar", "Appollo · Hy-Line Brown" in pg.input_value("#view .plan-copia textarea"))

            # ---------- 7. Crear lote con este plan ----------
            pg.click("#view [data-accion=plan-crear-lote]")
            pg.wait_for_function("location.hash === '#/nuevo-lote'")
            pg.wait_for_selector("#view .nuevo-lote[data-paso='2']", timeout=5000)
            check("nuevo lote abre en el paso 2 con la genética", "Hy-Line Brown" in pg.inner_text("#view .nuevo-lote h1"))
            check("la precarga se consume al abrir el asistente", pg.evaluate("App.estado.prefillLote == null"), pg.evaluate("App.estado.prefillLote"))
            check("aves precargadas", pg.input_value("#nl-aves") == "500", pg.input_value("#nl-aves"))
            check("edad precargada en días", pg.input_value("#nl-edad") == "168"
                  and pg.get_attribute("#view [data-accion=nl-unidad][aria-pressed=true]", "data-unidad") == "dias", pg.input_value("#nl-edad"))
            pg.click("#view [data-accion=nl-atras]"); pg.wait_for_selector("#view .nuevo-lote[data-paso='1']")
            check("la genética queda elegida en el paso 1", pg.get_attribute("#view [data-accion=nl-genetica][data-id=hyline-brown]", "aria-pressed") == "true")
            pg.click("#view [data-accion=nl-genetica][data-id=hyline-brown]"); pg.wait_for_selector("#view .nuevo-lote[data-paso='2']")
            pg.click("#view [data-accion=nl-siguiente]"); pg.wait_for_selector("#view .nuevo-lote[data-paso='3']")
            check("altitud precargada", pg.input_value("#nl-altitud") == "2800"
                  and pg.get_attribute("#view [data-accion=nl-altitud][data-valor='2800']", "aria-pressed") == "true", pg.input_value("#nl-altitud"))
            pg.click("#view [data-accion=nl-crear]")
            pg.wait_for_function("location.hash.startsWith('#/lote/')", timeout=5000)
            lotes = pg.evaluate("DB.listar('lotes')")
            l = lotes[0] if len(lotes) == 1 else {}
            check("se crea el lote con los datos del plan", len(lotes) == 1 and l.get("genetica") == "hyline-brown" and l.get("avesInicio") == 500
                  and l.get("edadLlegadaDias") == 168 and l.get("altitud") == 2800, lotes)
            # Sin recargar la página (App.estado y el asistente siguen vivos): Inicio y otra vez Nuevo lote.
            pg.evaluate("window.__sinRecarga = 1")
            pg.evaluate("location.hash = '#/inicio'"); pg.wait_for_function("location.hash === '#/inicio'"); pg.wait_for_selector("#view .pantalla")
            pg.evaluate("location.hash = '#/nuevo-lote'")
            try:
                pg.wait_for_selector("#view .nuevo-lote", timeout=5000)
                abierto = pg.evaluate("""() => ({ paso: document.querySelector('#view .nuevo-lote').dataset.paso,
                  elegidas: document.querySelectorAll('#view [data-accion=nl-genetica][aria-pressed=true]').length,
                  aves: !!document.querySelector('#nl-aves'), edad: !!document.querySelector('#nl-edad'), vivo: window.__sinRecarga === 1 })""")
            except Exception as ex:
                abierto = {"error": str(ex)}
            check("sin recargar, Nuevo lote vuelve al paso 1 sin genética ni datos precargados",
                  abierto.get("vivo") and abierto.get("paso") == "1" and abierto.get("elegidas") == 0 and not abierto.get("aves") and not abierto.get("edad"), abierto)
            pg.click("#view [data-accion=nl-genetica][data-id=hyline-brown]"); pg.wait_for_selector("#view .nuevo-lote[data-paso='2']")
            check("el paso 2 trae los valores de fábrica, no los del plan (aves 100, edad 1)",
                  pg.input_value("#nl-aves") == "100" and pg.input_value("#nl-edad") == "1", (pg.input_value("#nl-aves"), pg.input_value("#nl-edad")))
            ctx.close()

            # ---------- 8. Tema oscuro ----------
            ctx, pg = nueva(color_scheme="dark")
            paso(pg, "genetica")
            medir(pg, "genética oscuro")
            lote(pg, {"gen": "cobb500", "aves": 500, "alt": 2800})
            medir(pg, "lote oscuro")
            a_manejo(pg)
            pg.click("#view [data-accion=plan-todo]"); pg.wait_for_timeout(100)
            check("al 100 % el botón cambia a Desmarcar todo", norm(pg.inner_text("#plan-indice")) == "100%"
                  and "Desmarcar todo" in pg.inner_text("#view [data-accion=plan-todo]"))
            medir(pg, "manejo oscuro")
            pg.click("#view [data-accion=plan-todo]"); pg.wait_for_timeout(100)
            check("Desmarcar todo deja 0 %", norm(pg.inner_text("#plan-indice")) == "0%" and sel(pg) == [])
            pg.click("#view [data-accion=plan-todo]"); pg.wait_for_timeout(100)
            a_proy(pg)
            medir(pg, "proyección oscuro")
            pg.evaluate("scrollTo(0, 0)"); pg.screenshot(path=str(SDD / "t9-proyeccion-oscuro.png"))
            ctx.close()

            br.close()
        check("sin errores de consola ni de página", not errores, errores[:5])
    finally:
        srv.terminate()
    print(f"\n{'OK' if not fallos else 'FALLOS: ' + str(fallos)}")
    sys.exit(1 if fallos else 0)


if __name__ == "__main__":
    main()
