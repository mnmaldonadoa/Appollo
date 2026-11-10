"""Prueba e2e de Bienvenida, Inicio, Lotes, Nuevo lote y Detalle (dist/, 360x740, servidor http propio).
Uso: python3 build.py && python3 tests/e2e/lotes.py"""
import socket, subprocess, sys, time, urllib.request
from pathlib import Path
from playwright.sync_api import sync_playwright
sys.path.insert(0, str(Path(__file__).resolve().parent))
from util import esperar, cumple

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
                ctx = br.new_context(viewport={"width": 360, "height": 740}, **opc)
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
            check("indicador de 3 pasos", pg.locator("#view .pasos .paso").count() == 3)
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
            br.close()
        check("sin errores de consola ni de página", not errores, errores[:5])
    finally:
        srv.terminate(); srv.wait()
    print("TODO OK" if not fallos else f"{fallos} FALLOS")
    sys.exit(1 if fallos else 0)


if __name__ == "__main__":
    main()
