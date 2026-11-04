"""Prueba e2e de Reportes y Ajustes (dist/, 360x740, servidor http propio).
Uso: python3 build.py && python3 tests/e2e/reportes.py"""
import json, socket, subprocess, sys, tempfile, time, urllib.request
from pathlib import Path
from playwright.sync_api import sync_playwright

RAIZ = Path(__file__).resolve().parents[2]
SDD = RAIZ / ".superpowers/sdd/2026-11-03-appollo-gestion"
fallos = 0
errores = []

CHICOS = """() => [...document.querySelectorAll('button, a, [role=button], select, input')].filter(e => {
    const r = e.getBoundingClientRect(), s = getComputedStyle(e);
    return r.width > 2 && r.height > 2 && s.visibility !== 'hidden' && s.opacity !== '0' && !e.closest('[hidden]') && !e.closest('[inert]');
  }).map(e => ({t: (e.textContent || e.getAttribute('aria-label') || e.id || '').trim().slice(0, 24), h: Math.round(e.getBoundingClientRect().height)}))
  .filter(x => x.h < 56)"""
DESBORDE = "document.documentElement.scrollWidth > document.documentElement.clientWidth"
SIN_NAN = "!/NaN|Infinity|undefined/.test(document.body.innerText)"


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
    tmp = Path(tempfile.mkdtemp(prefix="appollo-rep-"))
    try:
        for _ in range(50):
            try: urllib.request.urlopen(url, timeout=1); break
            except Exception: time.sleep(0.1)
        else:
            print("FAIL el servidor http no arrancó"); sys.exit(1)
        with sync_playwright() as pw:
            br = pw.chromium.launch()
            ctx = br.new_context(viewport={"width": 360, "height": 740}, accept_downloads=True)
            ctx.grant_permissions(["clipboard-read", "clipboard-write"])
            ctx.clock.set_fixed_time("2026-11-04T10:00:00")
            ctx.add_init_script("document.addEventListener('DOMContentLoaded', () => { window.__temaDCL = document.documentElement.getAttribute('data-tema'); });")
            pg = ctx.new_page()
            pg.on("pageerror", lambda e: errores.append("pageerror: " + str(e)))
            pg.on("console", lambda m: m.type == "error" and errores.append("console: " + m.text))
            pg.goto(url); pg.wait_for_selector("#view .pantalla, #view .vista-error", timeout=5000)

            def medir(donde):
                chicos = pg.evaluate(CHICOS)
                check(f"[{donde}] objetivos táctiles >= 56 px", not chicos, chicos[:6])
                check(f"[{donde}] sin desborde horizontal", not pg.evaluate(DESBORDE))
                check(f"[{donde}] sin NaN/Infinity/undefined", pg.evaluate(SIN_NAN))

            def ir(h):
                pg.evaluate(f"location.hash = '{h}'"); pg.wait_for_function(f"location.hash === '{h}'")
                pg.wait_for_selector("#view .pantalla, #view .vista-error"); pg.wait_for_timeout(200)

            def quieto():
                pg.wait_for_function("document.getAnimations().every(a => a.playState !== 'running' || a.effect.getTiming().iterations === Infinity)", timeout=4000)

            # ---------- siembra ----------
            pg.evaluate("DB.guardar('granja', {id:'granja', nombre:'Granja Vieja', tipo:'postura', altitud:2800, tema:'auto'})")
            lid = pg.evaluate("NuevoLote.crear({genetica:'hyline-brown', avesInicio:100, fechaLlegada:'2026-10-01', edadLlegadaDias:210, altitud:2800, galpon:'G1'}).then(l => l.id)")
            regs = [("mortalidad", "2026-10-20", {"cantidad": 4}), ("mortalidad", "2026-11-02", {"cantidad": 2}),
                    ("huevos", "2026-10-25", {"cantidad": 999}), ("huevos", "2026-11-01", {"cantidad": 80}),
                    ("huevos", "2026-11-02", {"cantidad": 90, "rotos": 3}), ("huevos", "2026-11-04", {"cantidad": 85}),
                    ("alimento", "2026-10-25", {"kg": 50}), ("alimento", "2026-11-01", {"kg": 12}),
                    ("alimento", "2026-11-02", {"kg": 12.5}), ("alimento", "2026-11-04", {"kg": 12})]
            pg.evaluate("""async ([lid, regs]) => { let i = 0; for (const [tipo, fecha, datos] of regs)
                await DB.guardar('registros', {id: 'r' + (i++), loteId: lid, fecha, tipo, datos, creado: new Date().toISOString()}); }""", [lid, regs])
            pg.reload(); pg.wait_for_selector("#view .pantalla")

            # ---------- 1. Reportes sin precios ----------
            ir("#/reportes"); quieto()
            tarjeta = lambda t: pg.locator("#view .tarjeta", has_text=t).first.inner_text()
            check("viabilidad 97,9 % (96 -> 94 aves)", "97,9" in tarjeta("Viabilidad"), tarjeta("Viabilidad"))
            check("mortalidad 2 aves", "2" in tarjeta("Mortalidad") and "aves" in tarjeta("Mortalidad"), tarjeta("Mortalidad"))
            check("huevos 255 y 8,5 cubetas", "255" in tarjeta("Huevos") and "8,5" in tarjeta("Huevos"), tarjeta("Huevos"))
            check("% de postura 89,8", "89,8" in tarjeta("% de postura"), tarjeta("% de postura"))
            check("conversión es un número con coma", pg.locator("#view .tarjeta", has_text="Conversión").first.inner_text().count(",") >= 1, tarjeta("Conversión"))
            check("sin precios: costo, ingreso y margen son —", all("—" in tarjeta(t) for t in ("Costo de alimento", "Ingreso", "Margen")))
            check("aviso con botón para poner precios", pg.locator("#view .rep-aviso [data-accion=ir]").count() == 1)
            check("hay gráfica del período", pg.locator("#view .rep-grafica svg").count() == 1)
            medir("reportes sin precios")

            # ---------- 2. Ajustes: granja y precios ----------
            pg.click("#view .rep-aviso [data-accion=ir]"); pg.wait_for_function("location.hash === '#/ajustes'"); pg.wait_for_selector("#view .ajustes")
            check("ajustes muestra la versión", "versión 2.0.0" in pg.inner_text("#view .aj-acerca"))
            pg.fill("#aj-nombre", "   "); pg.click("[data-accion=aj-guardar-granja]")
            check("nombre vacío se rechaza con mensaje", "nombre" in pg.inner_text("#aj-granja-msg").lower() and pg.is_visible("#aj-granja-msg"), pg.inner_text("#aj-granja-msg"))
            check("nombre vacío no guarda", pg.evaluate("DB.obtener('granja','granja')")["nombre"] == "Granja Vieja")
            pg.fill("#aj-nombre", "La <b>Esperanza</b>"); pg.click("[data-accion=aj-tipo][data-tipo=ambas]"); pg.click("[data-accion=aj-guardar-granja]")
            pg.wait_for_function("DB.obtener('granja','granja').then(g => g.tipo === 'ambas')", timeout=3000)
            check("granja guardada con nombre y tipo", pg.evaluate("DB.obtener('granja','granja')")["nombre"] == "La <b>Esperanza</b>")
            pg.fill("#aj-nombre", "La Esperanza"); pg.click("[data-accion=aj-tipo][data-tipo=postura]"); pg.click("[data-accion=aj-guardar-granja]")
            pg.wait_for_function("DB.obtener('granja','granja').then(g => g.nombre === 'La Esperanza')", timeout=3000)
            pg.fill("#aj-p-cubeta", "abc"); pg.click("[data-accion=aj-guardar-precios]")
            check("precio no numérico se rechaza", pg.is_visible("#aj-precios-msg") and "números" in pg.inner_text("#aj-precios-msg"))
            pg.fill("#aj-p-cubeta", "4"); pg.fill("#aj-p-kgAlimento", "0,5"); pg.fill("#aj-p-kgPeso", ""); pg.click("[data-accion=aj-guardar-precios]")
            pg.wait_for_function("DB.obtener('granja','granja').then(g => g.precios && g.precios.cubeta === 4)", timeout=3000)
            check("precios guardados como números", pg.evaluate("DB.obtener('granja','granja')")["precios"] == {"cubeta": 4, "kgAlimento": 0.5})
            pg.reload(); pg.wait_for_selector("#view .ajustes")
            check("precios y granja persisten tras recargar", pg.input_value("#aj-p-cubeta") == "4" and pg.input_value("#aj-p-kgAlimento") == "0,5"
                  and pg.input_value("#aj-nombre") == "La Esperanza" and pg.get_attribute("[data-tipo=postura]", "aria-pressed") == "true")
            quieto(); medir("ajustes claro"); pg.screenshot(path=str(SDD / "t8-ajustes-claro.png"))

            # ---------- 3. Reportes con precios, períodos ----------
            ir("#/reportes"); quieto()
            check("costo $18,25, ingreso $33,60 y margen $15,35", "$18,25" in tarjeta("Costo de alimento") and "$33,60" in tarjeta("Ingreso") and "$15,35" in tarjeta("Margen"),
                  [tarjeta("Costo de alimento"), tarjeta("Ingreso"), tarjeta("Margen")])
            check("con precios no sale el aviso", pg.locator("#view .rep-aviso").count() == 0)
            medir("reportes con datos"); pg.screenshot(path=str(SDD / "t8-reportes.png")); pg.evaluate("window.scrollTo(0, document.body.scrollHeight)"); pg.wait_for_timeout(100); pg.screenshot(path=str(SDD / "t8-reportes-abajo.png"))
            pg.click("[data-accion=rep-periodo][data-periodo=ciclo]"); pg.wait_for_selector("[data-periodo=ciclo][aria-pressed=true]")
            check("ciclo incluye los huevos de octubre", "1.254" in tarjeta("Huevos") or "1254" in tarjeta("Huevos"), tarjeta("Huevos"))
            pg.reload(); pg.wait_for_selector("#view .reportes")
            check("el período elegido se recuerda", pg.get_attribute("[data-periodo=ciclo]", "aria-pressed") == "true"
                  and pg.evaluate("localStorage.getItem('appollo.v2.periodoReporte')") == "ciclo")
            pg.click("[data-accion=rep-periodo][data-periodo=semana]"); pg.wait_for_selector("[data-periodo=semana][aria-pressed=true]")
            check("lote seleccionable", pg.locator("#rep-lote option").count() == 1)

            # ---------- 4. Copiar / compartir ----------
            check("sin navigator.share no hay botón Compartir", pg.locator("[data-accion=rep-compartir]").count() == (1 if pg.evaluate("typeof navigator.share === 'function'") else 0))
            pg.click("[data-accion=rep-copiar]"); pg.wait_for_selector("#toast:not([hidden])")
            clip = pg.evaluate("navigator.clipboard.readText()")
            check("Copiar reporte pone el texto en el portapapeles", "La Esperanza" in clip and "Viabilidad: 97,9 %" in clip and "Margen: $15,35" in clip and "Hy-Line Brown" in clip, clip)
            check("toast Copiado", pg.inner_text("#toast").strip().startswith("Copiado"), pg.inner_text("#toast"))
            pg.evaluate("document.execCommand = () => false; Object.defineProperty(navigator.clipboard, 'writeText', {value: () => Promise.reject(new Error('no')), configurable: true})")
            pg.click("[data-accion=rep-copiar]"); pg.wait_for_selector(".rep-copia:not([hidden])")
            check("sin portapapeles aparece la caja con el texto para copiar a mano", "Viabilidad" in pg.input_value("#rep-texto"))
            pg.evaluate("window.__sh = null; navigator.share = d => { window.__sh = d; return Promise.resolve(); }")
            pg.evaluate("App.refrescar()"); pg.wait_for_selector("[data-accion=rep-compartir]")
            medir("reportes con compartir"); pg.click("[data-accion=rep-compartir]"); pg.wait_for_function("window.__sh !== null")
            sh = pg.evaluate("window.__sh")
            check("Compartir envía título y texto", "Viabilidad: 97,9 %" in sh["text"] and "Reporte" in sh["title"], sh)

            # ---------- 5. Exportar ----------
            ir("#/ajustes")
            with pg.expect_download() as d:
                pg.click("[data-accion=aj-exportar]")
            ruta = tmp / "respaldo.json"; d.value.save_as(str(ruta))
            check("el archivo se llama appollo-respaldo-AAAA-MM-DD.json", d.value.suggested_filename == "appollo-respaldo-2026-11-04.json", d.value.suggested_filename)
            resp = json.loads(ruta.read_text())
            check("el respaldo es JSON y contiene el lote", resp["version"] == 1 and len(resp["datos"]["lotes"]) == 1 and resp["datos"]["lotes"][0]["id"] == lid
                  and len(resp["datos"]["registros"]) == len(regs) and resp["datos"]["granja"][0]["precios"]["cubeta"] == 4)

            # ---------- 6. Importar: corrupto, cancelar, válido ----------
            malo = tmp / "malo.json"; malo.write_text("esto no es json {")
            pg.set_input_files("#aj-archivo", str(malo)); pg.wait_for_selector(".hoja")
            check("la confirmación avisa que reemplaza todo", "Esto reemplaza todos los datos de este teléfono" in pg.inner_text(".hoja"))
            pg.click(".hoja [data-accion=aj-cancelar-importar]"); pg.wait_for_selector(".hoja", state="detached")
            check("Cancelar no importa nada", len(pg.evaluate("DB.listar('lotes')")) == 1 and not pg.is_visible("#aj-respaldo-msg"))
            pg.set_input_files("#aj-archivo", str(malo)); pg.wait_for_selector(".hoja")
            pg.click(".hoja [data-accion=aj-reemplazar]"); pg.wait_for_selector("#aj-respaldo-msg:not([hidden])")
            check("un respaldo corrupto muestra el aviso en español", "no es un respaldo válido" in pg.inner_text("#aj-respaldo-msg"), pg.inner_text("#aj-respaldo-msg"))
            check("y no cambia ni borra los datos", len(pg.evaluate("DB.listar('lotes')")) == 1 and len(pg.evaluate("DB.listar('registros')")) == len(regs)
                  and pg.evaluate("location.hash") == "#/ajustes")
            medir("ajustes con error")
            otro = json.loads(ruta.read_text()); otro["datos"]["lotes"][0]["nombre"] = "Lote importado"; otro["datos"]["registros"] = []
            bueno = tmp / "bueno.json"; bueno.write_text(json.dumps(otro))
            pg.set_input_files("#aj-archivo", str(bueno)); pg.wait_for_selector(".hoja"); pg.screenshot(path=str(SDD / "t8-importar.png"))
            chicos = pg.evaluate("() => [...document.querySelectorAll('.hoja button')].map(b => b.getBoundingClientRect().height).filter(h => h < 56)")
            check("[hoja] botones >= 56 px", not chicos, chicos)
            pg.click(".hoja [data-accion=aj-reemplazar]"); pg.wait_for_function("location.hash === '#/inicio'")
            check("importar válido reemplaza los datos y va a Inicio", pg.evaluate("DB.listar('lotes')")[0]["nombre"] == "Lote importado" and len(pg.evaluate("DB.listar('registros')")) == 0)
            check("toast Respaldo importado", "Respaldo importado" in pg.inner_text("#toast"))

            # ---------- 7. Tema ----------
            ir("#/ajustes"); pg.click("[data-accion=aj-tema][data-tema=oscuro]")
            check("Oscuro pone data-tema en <html> y lo guarda", pg.evaluate("document.documentElement.getAttribute('data-tema')") == "oscuro"
                  and pg.evaluate("localStorage.getItem('appollo.v2.tema')") == "oscuro")
            fondo = pg.evaluate("getComputedStyle(document.body).backgroundColor")
            check("el fondo cambia a oscuro", fondo != "rgb(246, 241, 231)", fondo)
            quieto(); medir("ajustes oscuro"); pg.wait_for_selector("#toast", state="hidden", timeout=6000) if pg.is_visible("#toast") else None; pg.evaluate("window.scrollTo(0, 0)"); pg.screenshot(path=str(SDD / "t8-ajustes-oscuro.png"))
            pg.reload(); pg.wait_for_selector("#view .ajustes")
            check("el tema oscuro ya estaba aplicado al terminar de cargar el HTML (sin parpadeo)", pg.evaluate("window.__temaDCL") == "oscuro", pg.evaluate("window.__temaDCL"))
            check("y el botón Oscuro sigue marcado", pg.get_attribute("[data-accion=aj-tema][data-tema=oscuro]", "aria-pressed") == "true")
            pg.click("[data-accion=aj-tema][data-tema=claro]")
            check("Claro fija data-tema=claro", pg.evaluate("document.documentElement.getAttribute('data-tema')") == "claro")
            pg.click("[data-accion=aj-tema][data-tema=auto]")
            check("Automático quita el atributo y la preferencia", pg.evaluate("document.documentElement.getAttribute('data-tema')") is None
                  and pg.evaluate("localStorage.getItem('appollo.v2.tema')") is None)

            # ---------- 7b. Lotes sin fecha de llegada (migrados de la v1 o respaldos manipulados) ----------
            pg.evaluate("""async () => {
              localStorage.removeItem('appollo.v2.migrado');
              localStorage.setItem('appollo.v1.lotes', JSON.stringify([{id: 77, estado: {gid: 'isa-brown', aves: 40}, resumen: 'x'}, {id: 78, fecha: 'basura', estado: {gid: 'isa-brown', aves: 5}}]));
              await DB.migrarLS(); }""")
            mig = pg.evaluate("DB.listar('lotes').then(ls => ls.filter(l => l.origen === 'v1').map(l => l.fechaLlegada))")
            check("migrarLS nunca deja la fecha de llegada vacía", len(mig) == 2 and all(isinstance(f, str) and len(f) == 10 for f in mig), mig)
            pg.evaluate("""async () => {
              await DB.guardar('lotes', {id: 'h1', nombre: 'Sin fecha', genetica: 'hyline-brown', avesInicio: 50, fechaLlegada: null, estado: 'cerrado'});
              await DB.guardar('lotes', {id: 'h2', nombre: 'Fecha basura', genetica: 'cobb500', avesInicio: 30, fechaLlegada: 'basura', estado: 'activo'});
              await DB.guardar('lotes', {id: 'h3', nombre: 'Sin nada', genetica: 'hyline-brown', avesInicio: 20, estado: 'cerrado'});
              let i = 0;
              for (const [l, t, f, d] of [['h1','huevos','2026-09-01',{cantidad: 20}], ['h1','alimento','2026-09-01',{kg: 5}], ['h1','mortalidad','2026-09-02',{cantidad: 2}],
                                          ['h2','peso','2026-11-01',{gramos: 300}], ['h2','alimento','2026-11-01',{kg: 4}], ['h2','mortalidad','2026-11-02',{cantidad: 1}]])
                await DB.guardar('registros', {id: 'hr' + (i++), loteId: l, fecha: f, tipo: t, datos: d, creado: new Date().toISOString()}); }""")
            pg.reload(); pg.wait_for_selector("#view .pantalla, #view .vista-error")
            def sano(donde):
                txt = pg.inner_text("#view")
                check(f"[{donde}] sin 'Algo salió mal' ni NaN/undefined/Infinity", "Algo salió mal" not in txt and pg.evaluate(SIN_NAN), txt[:200])
            for h in ("#/inicio", "#/lotes", "#/lote/h1", "#/lote/h2", "#/lote/h3", "#/alertas", "#/reportes"):
                ir(h); pg.wait_for_timeout(300); sano(h)
            for lote in ("h1", "h2", "h3"):
                for per in ("semana", "mes", "ciclo"):
                    ir("#/reportes"); pg.select_option("#rep-lote", lote); pg.wait_for_timeout(250)
                    pg.click(f"[data-accion=rep-periodo][data-periodo={per}]"); pg.wait_for_selector(f"[data-periodo={per}][aria-pressed=true]"); pg.wait_for_timeout(200)
                    sano(f"reportes {lote} {per}")
                    if per == "semana" and lote == "h1":
                        check("lote cerrado sin datos en la semana: Viabilidad — y pista de Ciclo", "—" in tarjeta("Viabilidad") and "usa Ciclo" in pg.inner_text("#view"), pg.inner_text("#view")[:300])
            pg.click("[data-accion=rep-copiar]"); pg.wait_for_selector("#toast:not([hidden])"); sano("copiar lote sin fecha")
            pg.evaluate("localStorage.setItem('appollo.v2.periodoReporte', 'ciclo')"); pg.reload(); pg.wait_for_selector("#view .pantalla, #view .vista-error"); ir("#/reportes"); sano("recarga con ciclo guardado")
            for l in ("h1", "h2", "h3"): pg.evaluate("id => DB.borrar('lotes', id)", l)

            # ---------- 8. Estado vacío ----------
            pg.evaluate("DB.importar(JSON.stringify({version: 1, datos: {}}))"); ir("#/ajustes"); ir("#/reportes")
            pg.wait_for_selector("#view .pantalla-vacia")
            check("sin lotes, Reportes invita a crear uno", "Aún no tienes lotes" in pg.inner_text("#view") and pg.locator("#view [data-accion=nuevo-lote]").count() == 1)
            medir("reportes vacío")
            check("sin errores de consola", not errores, errores[:5])
            br.close()
    finally:
        srv.terminate()
    print(f"\n{'TODO OK' if not fallos else str(fallos) + ' FALLOS'}")
    sys.exit(1 if fallos else 0)


main()
