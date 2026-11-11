"""Prueba e2e de Bienvenida, Inicio, Lotes, Nuevo lote y Detalle (dist/, 360x740, servidor http propio).
Uso: python3 build.py && python3 tests/e2e/lotes.py"""
import socket, subprocess, sys, time, urllib.request
from pathlib import Path
from playwright.sync_api import sync_playwright
sys.path.insert(0, str(Path(__file__).resolve().parent))
from util import esperar, cumple, nuevo_contexto

RAIZ = Path(__file__).resolve().parents[2]
SDD = RAIZ / ".superpowers/sdd/2026-11-03-appollo-gestion"
fallos = 0
errores = []

CHICOS = """() => [...document.querySelectorAll('button, a, [role=button], select, input')].filter(e => {
    const r = e.getBoundingClientRect(), s = getComputedStyle(e);
    return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && !e.closest('[hidden]');
  }).map(e => ({t: (e.textContent || e.getAttribute('aria-label') || e.id || '').trim().slice(0, 24), h: Math.round(e.getBoundingClientRect().height)}))
  .filter(x => x.h < 56)"""
DESBORDE = "document.documentElement.scrollWidth > document.documentElement.clientWidth"
SIN_NAN = "!/NaN|Infinity|undefined/.test(document.body.innerText)"
NAV_GAP = """() => { const it = [...document.querySelectorAll('#nav .nav-item')].map(e => e.getBoundingClientRect());
  const gaps = it.slice(1).map((r, i) => r.left - it[i].right);
  return {css: parseFloat(getComputedStyle(document.querySelector('#nav')).columnGap), min: Math.min(...gaps),
          alto: Math.min(...it.map(r => r.height)),
          texto: [...document.querySelectorAll('#nav .nav-texto')].every(t => t.scrollWidth <= t.parentElement.clientWidth + 0.5)}; }"""
CIFRA = "t => { const e = document.querySelector(`#view [data-t=${t}] .tarjeta-cifra`); return e ? e.textContent.trim() : null; }"


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

            def nueva(**opc):
                ctx = nuevo_contexto(br, viewport={"width": 360, "height": 740}, **opc)
                pg = ctx.new_page()
                pg.on("pageerror", lambda e: errores.append("pageerror: " + str(e)))
                pg.on("console", lambda m: m.type == "error" and errores.append("console: " + m.text))
                pg.goto(url); pg.wait_for_selector("#view .pantalla, #view .vista-error", timeout=5000)
                return ctx, pg

            def medir(pg, donde):
                chicos = pg.evaluate(CHICOS)
                check(f"[{donde}] objetivos táctiles >= 56 px", not chicos, chicos[:5])
                check(f"[{donde}] sin desborde horizontal", not pg.evaluate(DESBORDE))
                check(f"[{donde}] sin NaN/Infinity/undefined en pantalla", pg.evaluate(SIN_NAN))

            def quieto(pg):
                pg.wait_for_function("document.getAnimations().every(a => a.playState !== 'running' || a.effect.getTiming().iterations === Infinity)", timeout=4000)

            def cifra(pg, t, valor):
                try: pg.wait_for_function(f"({CIFRA})('{t}') === '{valor}'", timeout=4000); return True
                except Exception: return False

            hoy = lambda d=0: f"(() => {{ const d = new Date(); d.setDate(d.getDate() + ({d})); return hoyLocal(d); }})()"

            # ---------- 1. Bienvenida ----------
            ctx, pg = nueva()
            check("primera apertura muestra la bienvenida", pg.locator("#view .bienvenida").count() == 1)
            check("bienvenida paso 1 de 2 pide el nombre", pg.get_attribute("#view .bienvenida", "data-paso") == "1"
                  and pg.locator("#bv-nombre").count() == 1 and "Paso 1 de 2" in pg.inner_text("#view"))
            quieto(pg)
            medir(pg, "bienvenida 1")
            pg.screenshot(path=str(SDD / "t6-bienvenida.png"))
            pg.click("#view [data-accion=bv-siguiente]")
            check("nombre vacío muestra mensaje", pg.locator("#view .bv-error:not([hidden])").count() == 1
                  and pg.get_attribute("#view .bienvenida", "data-paso") == "1")
            pg.fill("#bv-nombre", "Granja <b>La Esperanza</b>"); pg.click("#view [data-accion=bv-siguiente]")
            pg.wait_for_selector("#view .bienvenida[data-paso='2']")
            check("paso 2 de 2 ofrece postura / carne / ambas", pg.locator("#view [data-accion=bv-tipo]").count() == 3
                  and "Paso 2 de 2" in pg.inner_text("#view"))
            medir(pg, "bienvenida 2")
            pg.click("#view [data-accion=bv-tipo][data-tipo=postura]"); pg.click("#view [data-accion=bv-crear]")
            pg.wait_for_function("location.hash === '#/nuevo-lote'")
            g = pg.evaluate("DB.obtener('granja', 'granja')")
            check("la bienvenida guarda la granja", g["nombre"] == "Granja <b>La Esperanza</b>" and g["tipo"] == "postura", g)

            # ---------- 2. Nuevo lote ----------
            pg.wait_for_selector("#view .nuevo-lote[data-paso='1']")
            n_gen = pg.evaluate("GENETICAS.length")
            check("paso 1 muestra todas las genéticas", pg.locator("#view [data-accion=nl-genetica]").count() == n_gen)
            check("indicador de 4 pasos", pg.locator("#view .pasos .paso").count() == 4)
            quieto(pg)
            medir(pg, "nuevo lote 1")
            pg.screenshot(path=str(SDD / "t6-nuevo-lote.png"))
            pg.click("#view [data-accion=nl-genetica][data-id=hyline-brown]"); pg.wait_for_selector("#view .nuevo-lote[data-paso='2']")
            pg.fill("#nl-aves", "100"); pg.click("#view [data-accion=nl-modo][data-modo=edad]")
            pg.click("#view [data-accion=nl-unidad][data-unidad=dias]"); pg.fill("#nl-edad", "800")
            pg.click("#view [data-accion=nl-siguiente]"); pg.wait_for_selector("#view .nl-error:not([hidden])")
            check("edad mayor al máximo se rechaza con mensaje", "supera" in pg.inner_text("#view .nl-error")
                  and pg.get_attribute("#view .nuevo-lote", "data-paso") == "2", pg.inner_text("#view .nl-error"))
            medir(pg, "nuevo lote 2")
            pg.click("#view [data-accion=nl-modo][data-modo=fecha]"); pg.fill("#nl-fecha", pg.evaluate(hoy(1)))
            pg.click("#view [data-accion=nl-siguiente]")
            pg.wait_for_function("(document.querySelector('#view .nl-error:not([hidden])') || {}).textContent?.includes('futura')", timeout=3000)
            check("fecha de llegada futura se rechaza", pg.get_attribute("#view .nuevo-lote", "data-paso") == "2")
            api = pg.evaluate(f"""async () => {{
              const prueba = async o => {{ try {{ await NuevoLote.crear(o); return 'ok'; }} catch (e) {{ return e.message; }} }};
              const b = {{genetica: 'hyline-brown', avesInicio: 100, altitud: 2800, galpon: 'G'}};
              return {{
                edad: await prueba({{...b, edadDias: 9999}}),
                futura: await prueba({{...b, fechaLlegada: {hoy(1)}}}),
                negativa: await prueba({{...b, edadDias: -3}}),
                texto: await prueba({{...b, edadDias: 'abc'}}),
                aves0: await prueba({{...b, avesInicio: 0, edadDias: 10}}),
                avesDec: await prueba({{...b, avesInicio: 10.5, edadDias: 10}}),
                carne: await prueba({{...b, genetica: 'cobb500', edadDias: 56}}),
                lotes: (await DB.listar('lotes')).length, vacunas: (await DB.listar('vacunasPlan')).length }}; }}""")
            check("crear() rechaza edad > máximo, fecha futura, edad negativa o no numérica y aves inválidas",
                  all(api[k] != "ok" and len(api[k]) > 5 for k in ("edad", "futura", "negativa", "texto", "aves0", "avesDec", "carne")), api)
            check("los rechazos no guardan nada", api["lotes"] == 0 and api["vacunas"] == 0, api)
            check("los lotes rechazados no se guardaron", len(pg.evaluate("DB.listar('lotes')")) == 0)
            pg.click("#view [data-accion=nl-modo][data-modo=edad]"); pg.fill("#nl-edad", "30")
            pg.click("#view [data-accion=nl-siguiente]"); pg.wait_for_selector("#view .nuevo-lote[data-paso='3']")
            pg.click("#view [data-accion=nl-plan-siguiente]"); pg.wait_for_selector("#view .nuevo-lote[data-paso='4']")
            check("primera vez: la altitud no viene supuesta", pg.input_value("#nl-altitud") == ""
                  and pg.locator("#view [data-accion=nl-altitud][aria-pressed=true]").count() == 0)
            check("altitud con 5 opciones rápidas", pg.locator("#view [data-accion=nl-altitud]").count() == 5)
            medir(pg, "nuevo lote 3")
            pg.click("#view [data-accion=nl-crear]"); pg.wait_for_selector("#view .nl-error:not([hidden])")
            check("sin altitud pide elegirla", "altitud" in pg.inner_text("#view .nl-error").lower())
            pg.click("#view [data-accion=nl-altitud][data-valor='2800']"); pg.fill("#nl-galpon", "G1")
            pg.click("#view [data-accion=nl-crear]"); pg.wait_for_function("location.hash.startsWith('#/lote/')", timeout=4000)
            check("toast 'Lote creado'", "Lote creado" in pg.inner_text("#toast"))
            lid = pg.evaluate("location.hash.split('/')[2]")
            l = pg.evaluate("id => DB.obtener('lotes', id)", lid)
            check("lote guardado con sus datos", l and l["avesInicio"] == 100 and l["edadLlegadaDias"] == 30 and l["estado"] == "activo"
                  and l["fechaLlegada"] == pg.evaluate("hoyLocal()") and l["nombre"] == "Hy-Line Brown · G1", l)
            vs = pg.evaluate("id => DB.listar('vacunasPlan', {loteId: id})", lid)
            check(f"Hy-Line Brown crea >= 10 vacunas previstas ({len(vs)})", len(vs) >= 10)
            check("vacunas con nombre, vía y fecha prevista no pasada", all(v["nombre"] and v["via"] and v["fechaPrevista"] >= l["fechaLlegada"] for v in vs))
            check("altitud recordada", pg.evaluate("localStorage.getItem('appollo.v2.altitud')") == "2800")

            # ---------- 3. Inicio ----------
            pg.click("#nav [data-nav=inicio]")
            check("Inicio muestra aves vivas 100", cifra(pg, "aves", "100"), pg.evaluate(CIFRA, "aves"))
            check("Inicio muestra mortalidad 0 %", cifra(pg, "mortalidad", "0") and "%" in pg.inner_text("#view [data-t=mortalidad]"))
            check("estado sanitario verde", pg.get_attribute("#view [data-t=sanitario]", "data-estado") == "verde")
            check("sin registros: producción y alimento muestran '—'", pg.evaluate(CIFRA, "produccion") == "—" and pg.evaluate(CIFRA, "alimento") == "—")
            check("gráfica vacía dice 'Aún no hay datos'", "Aún no hay datos" in pg.inner_text("#view [data-t=grafica]"))
            check("Inicio sin NaN ni Infinity", pg.evaluate(SIN_NAN))
            check("nombre de la granja escapado", pg.locator("#view h1").inner_text().startswith("Granja <b>"))
            pg.click("#nav [data-accion=registrar]"); pg.click(".hoja [data-tipo=mortalidad]"); pg.wait_for_selector("#reg-valor")
            pg.fill("#reg-valor", "3"); pg.click(".hoja [data-accion=reg-guardar]")
            pg.wait_for_function("!document.querySelector('.hoja-capa')", timeout=3000)
            check("tras 3 muertes Inicio muestra 97 aves", cifra(pg, "aves", "97"), pg.evaluate(CIFRA, "aves"))
            check("tras 3 muertes mortalidad 3 %", cifra(pg, "mortalidad", "3"), pg.evaluate(CIFRA, "mortalidad"))
            check("3 % de muertes en un día pone el estado en rojo", pg.get_attribute("#view [data-t=sanitario]", "data-estado") == "rojo")
            pg.click("#view [data-t=alertas]")
            check("tarjeta de alertas lleva a #/alertas", cumple(lambda: pg.wait_for_function("location.hash === '#/alertas'")))

            # Segundo lote: el selector suma con "Todos"
            pg.click("#nav [data-nav=lotes]"); pg.wait_for_selector("#view h1:has-text('Lotes')"); pg.click("#view [data-accion=nuevo-lote]")
            pg.wait_for_selector("#view .nuevo-lote[data-paso='1']"); pg.click("#view [data-accion=nl-genetica][data-id=cobb500]")
            pg.fill("#nl-aves", "50"); pg.click("#view [data-accion=nl-modo][data-modo=edad]"); pg.fill("#nl-edad", "10")
            pg.click("#view [data-accion=nl-siguiente]"); pg.wait_for_selector("#view .nuevo-lote[data-paso='3']")
            pg.click("#view [data-accion=nl-plan-siguiente]"); pg.wait_for_selector("#view .nuevo-lote[data-paso='4']")
            check("altitud se precarga la segunda vez", pg.input_value("#nl-altitud") == "2800"
                  and pg.locator("#view [data-accion=nl-altitud][data-valor='2800'][aria-pressed=true]").count() == 1)
            pg.click("#view [data-accion=nl-crear]"); pg.wait_for_function("location.hash.startsWith('#/lote/')", timeout=4000)
            lid2 = pg.evaluate("location.hash.split('/')[2]")
            pg.click("#nav [data-nav=inicio]"); pg.wait_for_selector("#view [data-accion=ini-lote][data-id=todos]")
            check("selector con Todos y 2 lotes", pg.locator("#view [data-accion=ini-lote]").count() == 3)
            pg.click("#view [data-accion=ini-lote][data-id=todos]")
            check("Todos suma las aves (97 + 50)", cifra(pg, "aves", "147"), pg.evaluate(CIFRA, "aves"))
            pg.click(f"#view [data-accion=ini-lote][data-id='{lid2}']")
            check("elegir un lote muestra solo sus aves", cifra(pg, "aves", "50"), pg.evaluate(CIFRA, "aves"))
            check("lote de carne: producción es peso promedio", "Peso" in pg.inner_text("#view [data-t=produccion]"))
            quieto(pg)
            medir(pg, "inicio")

            # ---------- 4. Lotes ----------
            pg.click("#nav [data-nav=lotes]"); pg.wait_for_selector("#view .lote-item")
            check("Lotes lista 2 activos", pg.locator("#view .lotes-activos .lote-item").count() == 2)
            check("tarjeta de lote con genética, edad, aves y estado", all(t in pg.inner_text("#view .lotes-activos") for t in ("Hy-Line Brown", "Cobb 500", "97", "días"))
                  and pg.locator("#view .lotes-activos .lote-item .chip").count() == 2)
            quieto(pg)
            medir(pg, "lotes")
            pg.wait_for_selector("#toast", state="hidden", timeout=8000)
            pg.screenshot(path=str(SDD / "t6-lotes.png"))

            # ---------- 5. Detalle ----------
            pg.click(f"#view .lote-item[data-ruta='#/lote/{lid}']"); pg.wait_for_selector("#view .detalle-lote")
            check("detalle muestra el nombre del lote", "Hy-Line Brown · G1" in pg.inner_text("#view h1"))
            check("detalle con gráfica real vs proyectado", pg.locator("#view [data-t=grafica] .grafico").count() == 1)
            check("historial con el registro de mortalidad", pg.locator("#view .dl-reg").count() == 1)
            n_regs = lambda: len(pg.evaluate(f"DB.listar('registros', {{loteId: '{lid}'}})"))
            pg.click("#view .dl-reg [data-accion=dl-borrar]")
            esperar(pg, f"DB.listar('registros', {{loteId: '{lid}'}}).then(r => r.length === 0)", 3000)
            pg.wait_for_selector("#toast:not([hidden]) [data-accion=deshacer]")
            check("Borrar quita el registro y ofrece Deshacer", pg.locator("#view .dl-reg").count() == 0)
            pg.click("#toast [data-accion=deshacer]")
            esperar(pg, f"DB.listar('registros', {{loteId: '{lid}'}}).then(r => r.length === 1)", 3000)
            pg.wait_for_selector("#view .dl-reg")
            check("Deshacer restaura el registro borrado", n_regs() == 1)
            pend = lambda: pg.evaluate(f"DB.listar('vacunasPlan', {{loteId: '{lid}'}}).then(v => v.filter(x => !x.fechaAplicada).length)")
            antes = pend()
            pg.click("#view [data-accion=dl-aplicar] >> nth=0")
            esperar(pg, f"DB.listar('vacunasPlan', {{loteId: '{lid}'}}).then(v => v.filter(x => !x.fechaAplicada).length === {antes - 1})", 3000)
            vreg = pg.evaluate(f"DB.listar('registros', {{loteId: '{lid}', tipo: 'vacuna'}})")
            check("Marcar aplicada escribe fechaAplicada y un registro de vacuna", len(vreg) == 1 and vreg[0]["fecha"] == pg.evaluate("hoyLocal()")
                  and vreg[0]["datos"].get("planId"), vreg)
            pg.wait_for_selector("#toast:not([hidden]) [data-accion=deshacer]"); pg.click("#toast [data-accion=deshacer]")
            esperar(pg, f"DB.listar('vacunasPlan', {{loteId: '{lid}'}}).then(v => v.filter(x => !x.fechaAplicada).length === {antes})", 3000)
            check("Deshacer desmarca la vacuna y borra su registro", len(pg.evaluate(f"DB.listar('registros', {{loteId: '{lid}', tipo: 'vacuna'}})")) == 0)
            quieto(pg)
            medir(pg, "detalle")
            pg.evaluate("window.scrollTo(0, 0)"); pg.wait_for_selector("#toast", state="hidden", timeout=8000)
            pg.screenshot(path=str(SDD / "t6-detalle.png"))
            pg.click("#view [data-accion=dl-cerrar]"); pg.wait_for_selector("#view .dl-confirmar:not([hidden])")
            check("Cerrar lote pide confirmación sin cerrar aún", pg.evaluate(f"DB.obtener('lotes', '{lid}')")["estado"] == "activo")
            medir(pg, "confirmar cierre")
            pg.click("#view [data-accion=dl-cerrar-si]")
            esperar(pg, f"DB.obtener('lotes', '{lid}').then(l => l.estado === 'cerrado')", 3000)
            check("lote cerrado muestra Reabrir", cumple(lambda: pg.wait_for_selector("#view [data-accion=dl-reabrir]")))
            pg.click("#nav [data-nav=lotes]"); pg.wait_for_selector("#view .lotes-cerrados .lote-item")
            check("lote cerrado aparece en Cerrados", pg.locator("#view .lotes-cerrados .lote-item").count() == 1
                  and pg.locator("#view .lotes-activos .lote-item").count() == 1)
            pg.click(f"#view .lote-item[data-ruta='#/lote/{lid}']"); pg.wait_for_selector("#view [data-accion=dl-reabrir]")
            pg.click("#view [data-accion=dl-reabrir]")
            check("Reabrir vuelve el lote a activo", cumple(lambda: esperar(pg, f"DB.obtener('lotes', '{lid}').then(l => l.estado === 'activo')", 3000)))
            r = pg.evaluate(NAV_GAP)
            check("barra inferior: separación >= 8 px entre objetivos", r["css"] >= 8 and r["min"] >= 7.5, r)
            check("barra inferior: objetivos >= 56 px y textos sin cortar a 360 px", r["alto"] >= 56 and r["texto"], r)
            ctx.close()

            # ---------- 6. Lote de postura con datos (gráfica) y lote sin aves ----------
            ctx, pg = nueva()
            pg.evaluate(f"""async () => {{
              await DB.guardar('granja', {{id: 'granja', nombre: 'La Esperanza', tipo: 'postura', altitud: 2800, tema: 'auto'}});
              const l = await NuevoLote.crear({{genetica: 'hyline-brown', avesInicio: 1000, fechaLlegada: {hoy(-20)}, edadLlegadaDias: 190, altitud: 2800, galpon: 'G3'}});
              for (const v of await DB.listar('vacunasPlan', {{loteId: l.id}})) if (v.fechaPrevista <= hoyLocal()) await DB.guardar('vacunasPlan', {{...v, fechaAplicada: v.fechaPrevista}});
              for (let i = 13; i >= 0; i--) {{ const d = new Date(); d.setDate(d.getDate() - i); const f = hoyLocal(d);
                await DB.guardar('registros', {{loteId: l.id, fecha: f, tipo: 'huevos', datos: {{cantidad: 900 + (i % 4) * 12, rotos: 3}}, creado: f}});
                await DB.guardar('registros', {{loteId: l.id, fecha: f, tipo: 'alimento', datos: {{kg: 112}}, creado: f}}); }}
              await DB.guardar('registros', {{loteId: l.id, fecha: hoyLocal(), tipo: 'mortalidad', datos: {{cantidad: 1}}, creado: hoyLocal()}});
              localStorage.setItem('appollo.v2.loteActivo', l.id);
              await DB.guardar('lotes', {{id: 'L0', nombre: 'Sin aves', genetica: 'isa-brown', avesInicio: 10, fechaLlegada: {hoy(-5)}, edadLlegadaDias: 150, galpon: '', estado: 'activo'}});
              await DB.guardar('registros', {{id: 'm0', loteId: 'L0', fecha: {hoy(-1)}, tipo: 'mortalidad', datos: {{cantidad: 10}}, creado: 'x'}});
              await DB.guardar('registros', {{id: 'h0', loteId: 'L0', fecha: hoyLocal(), tipo: 'huevos', datos: {{cantidad: 0}}, creado: 'x'}});
            }}""")
            pg.reload(); pg.wait_for_selector("#view [data-t=aves]")
            check("lote de postura: aves 999", cifra(pg, "aves", "999"), pg.evaluate(CIFRA, "aves"))
            check("gráfica de 14 días con línea real", pg.locator("#view [data-t=grafica] .grafico-real").count() == 1)
            check("producción muestra huevos de hoy y % postura", "postura" in pg.inner_text("#view [data-t=produccion]").lower())
            quieto(pg)
            medir(pg, "inicio con datos")
            pg.screenshot(path=str(SDD / "t6-inicio.png"))
            pg.screenshot(path=str(SDD / "t6-inicio-completo.png"), full_page=True)
            pg.click("#view [data-accion=ini-lote][data-id=L0]")
            check("lote sin aves: 0 aves vivas", cifra(pg, "aves", "0"), pg.evaluate(CIFRA, "aves"))
            check("lote sin aves: rendimiento '—'", pg.evaluate(CIFRA, "rendimiento") == "—")
            check("lote sin aves: sin NaN ni Infinity", pg.evaluate(SIN_NAN))
            pg.click("#view [data-accion=ini-lote][data-id=todos]")
            check("Todos con lote vacío sin NaN", cifra(pg, "aves", "999") and pg.evaluate(SIN_NAN))
            pg.goto(url + "#/lote/L0"); pg.wait_for_selector("#view .detalle-lote")
            check("detalle de lote sin aves sin NaN ni Infinity", pg.evaluate(SIN_NAN))
            pg.goto(url + "#/lote/no-existe"); pg.wait_for_selector("#view .pantalla")
            check("detalle de lote inexistente muestra aviso", "no existe" in pg.inner_text("#view").lower())
            ctx.close()

            # ---------- 7. Granja sin lotes ----------
            ctx, pg = nueva()
            pg.evaluate("DB.guardar('granja', {id: 'granja', nombre: 'Mi granja', tipo: 'carne', altitud: null, tema: 'auto'})")
            pg.reload(); pg.wait_for_selector("#view .pantalla-vacia")
            b = pg.locator("#view [data-accion=nuevo-lote]")
            check("Inicio sin lotes: botón grande 'Nuevo lote'", b.count() == 1 and b.is_visible() and "Nuevo lote" in b.inner_text())
            pg.click("#nav [data-nav=lotes]"); pg.wait_for_selector("#view h1:has-text('Lotes')")
            check("Lotes vacío ofrece Nuevo lote", pg.locator("#view [data-accion=nuevo-lote]").count() >= 1)
            medir(pg, "lotes vacío")
            ctx.close()
            # ---------- 8. Paso «¿Qué vas a hacer en este ciclo?» ----------
            ctx, pg = nueva()
            pg.evaluate("DB.guardar('granja', {id: 'granja', nombre: 'Plan', tipo: 'postura', altitud: 2800, tema: 'auto'})")
            pg.goto(url + "#/nuevo-lote"); pg.reload(); pg.wait_for_selector("#view .nuevo-lote[data-paso='1']")
            MARCADAS = "[...document.querySelectorAll('#view [data-accion=nl-plan-tarea]:checked')].map(e => e.dataset.id).sort()"
            TODAS = "[...document.querySelectorAll('#view [data-accion=nl-plan-tarea]')].map(e => e.dataset.id).sort()"
            CONTADOR = "(document.querySelector('#view .nl-contador') || {textContent: ''}).textContent.trim()"

            def abrir_todas(pg):
                for i in range(pg.locator("#view .nl-cat-cab").count()):
                    c = pg.locator("#view .nl-cat-cab").nth(i)
                    if c.get_attribute("aria-expanded") != "true": c.click()

            def ir_paso3(pg, gid, edad):
                pg.click(f"#view [data-accion=nl-genetica][data-id={gid}]"); pg.wait_for_selector("#view .nuevo-lote[data-paso='2']")
                pg.fill("#nl-aves", "100"); pg.click("#view [data-accion=nl-modo][data-modo=edad]")
                pg.click("#view [data-accion=nl-unidad][data-unidad=dias]"); pg.fill("#nl-edad", str(edad))
                pg.click("#view [data-accion=nl-siguiente]"); pg.wait_for_selector("#view .nuevo-lote[data-paso='3']")

            def por_defecto(gid, edad):
                return sorted(pg.evaluate(f"NuevoLote.planSugerido(GENETICAS.find(g => g.id === '{gid}'), {edad})"))

            ir_paso3(pg, "hyline-brown", 30)
            check("indicador del paso 3 de 4", "Paso 3 de 4" in pg.inner_text("#view .eyebrow") and pg.locator("#view .pasos .paso").count() == 4)
            check("título del paso 3", pg.locator("#view h1").inner_text() == "¿Qué vas a hacer en este ciclo?")
            ncat = pg.locator("#view .nl-cat").count()
            check("hay una sección por categoría con tareas (>= 3)", ncat >= 3, ncat)
            check("solo la primera sección viene abierta", pg.locator("#view .nl-cat-cab[aria-expanded=true]").count() == 1
                  and pg.locator("#view .nl-cat").first.locator(".nl-cat-cab").get_attribute("aria-expanded") == "true")
            abrir_todas(pg)
            check("cada sección muestra k/n y Todo / Ninguno",
                  pg.locator("#view .nl-cat-cuenta").count() == ncat and pg.locator("#view [data-accion=nl-plan-todo]").count() == ncat
                  and pg.locator("#view [data-accion=nl-plan-ninguno]").count() == ncat)
            pred = por_defecto("hyline-brown", 30)
            check("selección inicial = tareas sugeridas para postura a los 30 días", pg.evaluate(MARCADAS) == pred, (len(pg.evaluate(MARCADAS)), len(pred)))
            n0 = len(pred)
            check("contador «N tareas elegidas»", pg.evaluate(CONTADOR) == f"{n0} tareas elegidas", pg.evaluate(CONTADOR))
            nop = pg.evaluate("[...document.querySelectorAll('#view [data-accion=nl-plan-tarea]:disabled')].map(e => e.dataset.id)")
            check("las tareas noPostura están deshabilitadas y sin marcar", len(nop) >= 1 and not set(nop) & set(pg.evaluate(MARCADAS)), nop)
            check("las noPostura explican por qué", pg.locator("#view .nl-tarea:has(input:disabled)").first.inner_text().count("No se usa en gallinas de postura de huevo para consumo") == 1)
            check("las tareas químicas muestran retiro y aviso",
                  pg.locator("#view .nl-tarea", has_text="Retiro huevo:").count() >= 1
                  and pg.locator("#view .nl-tarea", has_text="Confirma producto, dosis y retiro con la etiqueta y tu veterinario.").count() >= 1)
            check("las tareas con retiro desconocido dicen 'ver etiqueta'", pg.locator("#view .nl-tarea", has_text="ver etiqueta").count() >= 1)
            check("todas las sugeridas (no noPostura) son las visibles menos las noPostura", sorted(set(pg.evaluate(TODAS)) - set(nop)) == pred)
            medir(pg, "paso 3 claro (todo abierto)")
            pg.evaluate("document.documentElement.setAttribute('data-tema', 'oscuro')")
            medir(pg, "paso 3 oscuro (todo abierto)")
            pg.screenshot(path=str(SDD / "t7-paso3-oscuro.png"))
            pg.evaluate("document.documentElement.removeAttribute('data-tema')")
            # Ninguno en una categoría
            cat0 = pg.locator("#view .nl-cat").first
            cid = cat0.get_attribute("data-cat")
            en_cat = pg.evaluate(f"[...document.querySelectorAll('#view [data-cat={cid}] [data-accion=nl-plan-tarea]:checked')].length")
            check("la primera categoría tenía tareas marcadas", en_cat >= 1, en_cat)
            pg.click(f"#view [data-cat={cid}] [data-accion=nl-plan-ninguno]")
            check("«Ninguno» desmarca todas las tareas de la categoría",
                  pg.evaluate(f"document.querySelectorAll('#view [data-cat={cid}] [data-accion=nl-plan-tarea]:checked').length") == 0)
            check("«Ninguno» baja el contador y la cuenta k/n", pg.evaluate(CONTADOR) == f"{n0 - en_cat} tareas elegidas"
                  and cat0.locator(".nl-cat-cuenta").inner_text().startswith("0/"), pg.evaluate(CONTADOR))
            check("«Ninguno» no toca las otras categorías", len(pg.evaluate(MARCADAS)) == n0 - en_cat)
            pg.click(f"#view [data-cat={cid}] [data-accion=nl-plan-todo]")
            check("«Todo» vuelve a marcar las sugeridas de la categoría (sin las noPostura)", pg.evaluate(MARCADAS) == pred)
            # Una tarea
            tid = pred[0]
            pg.click(f"#view [data-accion=nl-plan-tarea][data-id='{tid}']")
            check("tocar una tarea la desmarca y el contador baja en 1", tid not in pg.evaluate(MARCADAS)
                  and pg.evaluate(CONTADOR) == f"{n0 - 1} tareas elegidas", pg.evaluate(CONTADOR))
            pg.click(f"#view [data-accion=nl-plan-tarea][data-id='{tid}']")
            check("tocar de nuevo la tarea la vuelve a marcar", tid in pg.evaluate(MARCADAS) and pg.evaluate(CONTADOR) == f"{n0} tareas elegidas")
            pg.click(f"#view [data-accion=nl-plan-tarea][data-id='{tid}']")
            pg.click(f"#view [data-cat={cid}] [data-accion=nl-plan-ninguno]")
            elegida = pg.evaluate(MARCADAS)
            # Atrás y adelante conserva la selección
            pg.click("#view [data-accion=nl-atras]"); pg.wait_for_selector("#view .nuevo-lote[data-paso='2']")
            check("Atrás desde el paso 3 vuelve al 2 con los datos", pg.input_value("#nl-aves") == "100" and pg.input_value("#nl-edad") == "30")
            pg.click("#view [data-accion=nl-siguiente]"); pg.wait_for_selector("#view .nuevo-lote[data-paso='3']")
            check("Atrás y adelante conserva la selección", pg.evaluate(MARCADAS) == elegida and pg.evaluate(CONTADOR) == f"{len(elegida)} tareas elegidas",
                  (len(pg.evaluate(MARCADAS)), len(elegida)))
            # Cambiar la edad cambia lo sugerido y reinicia
            pg.click("#view [data-accion=nl-atras]"); pg.wait_for_selector("#view .nuevo-lote[data-paso='2']")
            pg.fill("#nl-edad", "200"); pg.click("#view [data-accion=nl-siguiente]"); pg.wait_for_selector("#view .nuevo-lote[data-paso='3']")
            abrir_todas(pg)
            check("cambiar la edad reinicia la selección a lo sugerido para esa edad", pg.evaluate(MARCADAS) == por_defecto("hyline-brown", 200))
            # Cambiar la genética reinicia
            pg.click(f"#view [data-cat={pg.locator('#view .nl-cat').first.get_attribute('data-cat')}] [data-accion=nl-plan-ninguno]")
            check("(preparación) hay una selección modificada", pg.evaluate(MARCADAS) != por_defecto("hyline-brown", 200))
            pg.click("#view [data-accion=nl-atras]"); pg.wait_for_selector("#view .nuevo-lote[data-paso='2']")
            pg.click("#view [data-accion=nl-atras]"); pg.wait_for_selector("#view .nuevo-lote[data-paso='1']")
            pg.click("#view [data-accion=nl-genetica][data-id=isa-brown]"); pg.wait_for_selector("#view .nuevo-lote[data-paso='2']")
            pg.click("#view [data-accion=nl-siguiente]"); pg.wait_for_selector("#view .nuevo-lote[data-paso='3']"); abrir_todas(pg)
            check("cambiar la genética reinicia la selección", pg.evaluate(MARCADAS) == por_defecto("isa-brown", 200), (len(pg.evaluate(MARCADAS)), len(por_defecto("isa-brown", 200))))
            # Crear con lo elegido
            pg.click(f"#view [data-cat={pg.locator('#view .nl-cat').first.get_attribute('data-cat')}] [data-accion=nl-plan-ninguno]")
            elegida = pg.evaluate(MARCADAS)
            check("(preparación) quedan tareas elegidas", len(elegida) >= 1)
            pg.click("#view [data-accion=nl-plan-siguiente]"); pg.wait_for_selector("#view .nuevo-lote[data-paso='4']")
            pg.click("#view [data-accion=nl-altitud][data-valor='2800']"); pg.fill("#nl-galpon", "PL1")
            pg.click("#view [data-accion=nl-crear]"); pg.wait_for_function("location.hash.startsWith('#/lote/')", timeout=4000)
            lid = pg.evaluate("location.hash.split('/')[2]")
            filas = pg.evaluate("id => DB.listar('planTareas', {loteId: id})", lid)
            check("el lote tiene exactamente las tareas elegidas", sorted(f["catalogoId"] for f in filas) == elegida, (len(filas), len(elegida)))
            check("las filas del plan son activas y del lote", all(f["loteId"] == lid and f["estado"] == "activa" for f in filas))
            # Crear con todo desmarcado
            pg.goto(url + "#/nuevo-lote"); pg.wait_for_selector("#view .nuevo-lote[data-paso='1']")
            ir_paso3(pg, "hyline-brown", 30); abrir_todas(pg)
            for i in range(pg.locator("#view [data-accion=nl-plan-ninguno]").count()):
                pg.locator("#view [data-accion=nl-plan-ninguno]").nth(i).click()
            check("todo desmarcado: contador en 0", pg.evaluate(CONTADOR) == "0 tareas elegidas" and pg.evaluate(MARCADAS) == [], pg.evaluate(CONTADOR))
            medir(pg, "paso 3 vacío")
            check("Continuar no se bloquea con 0 tareas", not pg.is_disabled("#view [data-accion=nl-plan-siguiente]"))
            pg.click("#view [data-accion=nl-plan-siguiente]"); pg.wait_for_selector("#view .nuevo-lote[data-paso='4']")
            pg.fill("#nl-galpon", "VACIO"); pg.click("#view [data-accion=nl-crear]"); pg.wait_for_function("location.hash.startsWith('#/lote/')", timeout=4000)
            lid0 = pg.evaluate("location.hash.split('/')[2]")
            check("sin tareas: el lote se crea y no tiene filas de plan",
                  pg.evaluate("id => DB.obtener('lotes', id).then(l => !!l)", lid0) and len(pg.evaluate("id => DB.listar('planTareas', {loteId: id})", lid0)) == 0)
            check("el otro lote conserva sus tareas", len(pg.evaluate("id => DB.listar('planTareas', {loteId: id})", lid)) == len(elegida))
            # Carne: las noPostura sí se pueden elegir
            pg.goto(url + "#/nuevo-lote"); pg.wait_for_selector("#view .nuevo-lote[data-paso='1']")
            ir_paso3(pg, "cobb500", 10); abrir_todas(pg)
            check("en carne no hay tareas deshabilitadas por noPostura", pg.locator("#view [data-accion=nl-plan-tarea]:disabled").count() == 0)
            check("en carne la selección inicial es la sugerida", pg.evaluate(MARCADAS) == por_defecto("cobb500", 10))
            medir(pg, "paso 3 carne")
            ctx.close()

            br.close()
        check("sin errores de consola ni de página", not errores, errores[:5])
    finally:
        srv.terminate(); srv.wait()
    print("TODO OK" if not fallos else f"{fallos} FALLOS")
    sys.exit(1 if fallos else 0)


if __name__ == "__main__":
    main()
