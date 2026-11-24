"""Prueba de conjunto de Appollo (dist/, 360x740, servidor http propio).
Recorrido completo: bienvenida -> lote -> registros rápidos -> alertas -> inventario -> reportes -> ajustes -> planificador
-> crear lote con plan -> Plan del ciclo (propia, hecho, quitar, reactivar, retiro) -> respaldo exportar/importar; sin errores de consola, sin desborde horizontal en claro y oscuro en cada ruta, objetivos
táctiles >= 56 px, y modo sin conexión (service worker). Uso: python3 build.py && python3 tests/e2e/todo.py"""
import json, re, sys, tempfile
from pathlib import Path
from playwright.sync_api import sync_playwright
sys.path.insert(0, str(Path(__file__).resolve().parent))
from util import RAIZ, CHICOS, DESBORDE, SIN_NAN, CONTRASTE_BAJO, RECORTE, servidor, esperar, cumple, nuevo_contexto

fallos = 0
errores = []
SDD = RAIZ / ".superpowers/sdd/2026-11-03-appollo-gestion"

# Excepciones documentadas a la regla de 56 px (texto/etiqueta del control -> motivo).
EXCEPCIONES = {
    # <input type=file class=aj-oculto> de Ajustes: oculto a la vista (1 px, tabindex -1, no recibe toques ni foco);
    # el control que toca la persona es el botón "Importar respaldo", que sí mide >= 56 px y lo abre.
    "Archivo de respaldo": "input de archivo invisible, abierto por el botón Importar",
}


def check(nombre, cond, extra=""):
    global fallos
    print(("ok   " if cond else "FAIL ") + nombre + ("" if cond else f"  {extra}")); fallos += 0 if cond else 1


def main():
    precache = re.findall(r"'\./([^']*)'", (RAIZ / "dist/sw.js").read_text(encoding="utf-8").split("ARCHIVOS")[1].split("];")[0])
    with servidor() as url, sync_playwright() as pw:
        br = pw.chromium.launch()
        ctx = nuevo_contexto(br, viewport={"width": 360, "height": 740})
        pg = ctx.new_page()
        pg.on("pageerror", lambda e: errores.append("pageerror: " + str(e)))
        pg.on("console", lambda m: m.type in ("error", "warning") and errores.append(f"console {m.type}: " + m.text))
        pg.goto(url); pg.wait_for_selector("#view .pantalla, #view .vista-error", timeout=5000)

        def quieto():
            pg.wait_for_function("document.getAnimations().every(a => a.playState !== 'running' || a.effect.getTiming().iterations === Infinity)", timeout=4000)

        def tema(t):
            pg.evaluate(f"document.documentElement.setAttribute('data-tema', '{t}')")

        def medir(donde, temas=("claro", "oscuro")):
            """Sin desborde, sin NaN y todo control visible >= 56 px, en claro y en oscuro."""
            quieto()
            for t in temas:
                tema(t)
                chicos = [c for c in pg.evaluate(CHICOS) if not any(k in c["t"] for k in EXCEPCIONES)]
                check(f"[{donde}/{t}] controles >= 56 px", not chicos, chicos[:6])
                check(f"[{donde}/{t}] sin desborde horizontal", not pg.evaluate(DESBORDE))
                bajos = pg.evaluate(CONTRASTE_BAJO)
                check(f"[{donde}/{t}] texto >= 7:1", not bajos, bajos[:6])
                cortados = pg.evaluate(RECORTE)
                check(f"[{donde}/{t}] sin texto recortado", not cortados, cortados[:6])
            check(f"[{donde}] sin NaN/Infinity/undefined", pg.evaluate(SIN_NAN))
            tema("claro")

        def ir(h):
            pg.evaluate(f"location.hash = '{h}'"); pg.wait_for_function(f"location.hash === '{h}'")
            pg.wait_for_selector("#view .pantalla, #view .vista-error"); pg.wait_for_timeout(120)
            check(f"{h} sin vista de error", pg.locator("#view .vista-error").count() == 0)

        def cerrada(): esperar(pg, "!document.querySelector('.hoja-capa')", 4000)

        def registrar(tipo, valor=None, extra=None):
            pg.click("#nav [data-accion=registrar]"); pg.click(f".hoja [data-tipo={tipo}]"); pg.wait_for_selector(".hoja .reg-guardar")
            if valor is not None: pg.fill("#reg-valor", str(valor))
            for k, v in (extra or {}).items(): pg.fill(k, str(v))
            medir(f"registrar {tipo}", temas=("claro", "oscuro"))
            pg.click(".hoja [data-accion=reg-guardar]")
            cerrada(); pg.wait_for_selector("#toast:not([hidden]) [data-accion=deshacer]")
            pg.wait_for_selector("#toast", state="hidden", timeout=9000)

        regs = lambda t: pg.evaluate("t => DB.listar('registros').then(r => r.filter(x => x.tipo === t))", t)

        # ---------- 1. Bienvenida y primer lote ----------
        check("primera apertura muestra la bienvenida", pg.locator("#view .bienvenida").count() == 1)
        medir("bienvenida 1")
        pg.fill("#bv-nombre", "Granja Prueba"); pg.click("#view [data-accion=bv-siguiente]"); pg.wait_for_selector("#view .bienvenida[data-paso='2']")
        medir("bienvenida 2")
        pg.click("#view [data-accion=bv-tipo][data-tipo=postura]"); pg.click("#view [data-accion=bv-crear]")
        pg.wait_for_function("location.hash === '#/nuevo-lote'"); pg.wait_for_selector("#view .nuevo-lote")
        medir("nuevo lote 1")
        pg.click("#view [data-accion=nl-genetica][data-id=hyline-brown]"); pg.wait_for_selector("#view .nuevo-lote[data-paso='2']")
        pg.fill("#nl-aves", "100"); pg.click("#view [data-accion=nl-modo][data-modo=edad]")
        pg.click("#view [data-accion=nl-unidad][data-unidad=dias]"); pg.fill("#nl-edad", "150")
        medir("nuevo lote 2")
        pg.click("#view [data-accion=nl-siguiente]"); pg.wait_for_selector("#view .nuevo-lote[data-paso='3']")
        pg.click("#view [data-accion=nl-plan-siguiente]"); pg.wait_for_selector("#view .nuevo-lote[data-paso='4']")
        pg.click("#view [data-accion=nl-altitud][data-valor='2800']"); pg.fill("#nl-galpon", "G1")
        medir("nuevo lote 3")
        pg.click("#view [data-accion=nl-crear]"); pg.wait_for_function("location.hash.startsWith('#/lote/')", timeout=4000)
        lid = pg.evaluate("location.hash.split('/')[2]")
        check("lote creado con sus vacunas previstas", pg.evaluate("id => DB.listar('vacunasPlan', {loteId: id}).then(v => v.length)", lid) >= 5)
        pg.wait_for_selector("#view .pantalla"); medir("detalle de lote")

        # ---------- 2. Registros rápidos ----------
        ir("#/inicio"); medir("inicio")
        pg.click("#nav [data-accion=registrar]"); pg.wait_for_selector(".hoja [data-tipo=mortalidad]"); medir("hoja de tipos")
        pg.keyboard.press("Escape"); cerrada()
        registrar("mortalidad", 2)
        check("mortalidad: 1 registro de 2 aves", [r["datos"]["cantidad"] for r in regs("mortalidad")] == [2], regs("mortalidad"))
        registrar("peso", 1500)
        check("peso guardado", [r["datos"]["gramos"] for r in regs("peso")] == [1500], regs("peso"))
        registrar("alimento", 11.5)
        check("alimento guardado", [r["datos"]["kg"] for r in regs("alimento")] == [11.5], regs("alimento"))
        registrar("huevos", 80, {"#reg-rotos": 3})
        check("huevos guardados (80, 3 rotos)", [(r["datos"]["cantidad"], r["datos"]["rotos"]) for r in regs("huevos")] == [(80, 3)], regs("huevos"))
        # vacuna: la primera pendiente del plan
        pg.click("#nav [data-accion=registrar]"); pg.click(".hoja [data-tipo=vacuna]"); pg.wait_for_selector(".hoja [data-accion=reg-vacuna]")
        medir("registrar vacuna"); pg.click(".hoja [data-accion=reg-vacuna]"); pg.click(".hoja [data-accion=reg-guardar]"); cerrada()
        esperar(pg, "DB.listar('vacunasPlan').then(v => v.some(x => x.fechaAplicada))", 3000)
        check("vacuna aplicada marcada en el plan", len(regs("vacuna")) == 1)
        pg.wait_for_selector("#toast", state="hidden", timeout=9000)
        registrar("sanidad", None, {"#reg-enfermedad": "Coriza", "#reg-tratamiento": "Reposo"})
        check("sanidad guardada", len(regs("sanidad")) == 1)
        ir("#/inicio"); medir("inicio con datos")
        check("inicio muestra 98 aves vivas", cumple(lambda: esperar(pg, "(document.querySelector('#view [data-t=aves] .tarjeta-cifra')||{}).textContent?.trim() === '98'", 4000)))

        # ---------- 3. Alertas, Más, Inventario ----------
        ir("#/alertas"); medir("alertas")
        ir("#/lotes"); medir("lotes")
        ir("#/lote/" + lid); medir("detalle con datos")
        ir("#/mas"); medir("más")
        ir("#/inventario"); medir("inventario vacío")
        pg.click("#view [data-accion=inv-nuevo]"); pg.wait_for_selector(".hoja #inv-nombre")
        pg.fill("#inv-nombre", "Balanceado"); pg.fill("#inv-cant", "200"); pg.fill("#inv-min", "50")
        medir("inventario formulario"); pg.click(".hoja [data-accion=inv-guardar]"); cerrada()
        check("ítem de inventario guardado", pg.evaluate("DB.listar('inventario').then(i => i.length)") == 1)
        pg.wait_for_selector("#toast", state="hidden", timeout=9000)
        quieto(); medir("inventario con ítem")

        # ---------- 4. Reportes y Ajustes ----------
        ir("#/reportes"); medir("reportes")
        ir("#/ajustes"); medir("ajustes")
        pg.click("#view [data-accion=aj-tema][data-tema=oscuro]") if pg.locator("#view [data-accion=aj-tema][data-tema=oscuro]").count() else None
        pg.wait_for_timeout(150); medir("ajustes (tema elegido)", temas=("oscuro",))
        pg.click("#view [data-accion=aj-tema][data-tema=claro]") if pg.locator("#view [data-accion=aj-tema][data-tema=claro]").count() else None

        # ---------- 5. Planificador y crear lote con plan ----------
        ir("#/plan/genetica"); medir("planificar genética")
        pg.click("#view [data-accion=plan-genetica][data-id=hyline-brown]"); pg.wait_for_selector("#view .planificar[data-paso='lote']")
        pg.click("#view [data-accion=plan-unidad][data-v=semanas]"); pg.fill("#plan-edad", "24"); pg.fill("#plan-aves", "500")
        medir("planificar lote")
        pg.click("#view [data-accion=plan-siguiente]"); pg.wait_for_selector("#view .planificar[data-paso='manejo']"); medir("planificar manejo")
        pg.click("#view [data-accion=plan-ir][data-paso=proyeccion]"); pg.wait_for_selector("#view .planificar[data-paso='proyeccion']")
        quieto(); medir("planificar proyección")
        pg.click("#view [data-accion=plan-crear-lote]"); pg.wait_for_function("location.hash === '#/nuevo-lote'")
        pg.wait_for_selector("#view .nuevo-lote[data-paso='2']")
        check("el plan llega precargado (500 aves)", pg.input_value("#nl-aves") == "500", pg.input_value("#nl-aves"))
        pg.click("#view [data-accion=nl-siguiente]"); pg.wait_for_selector("#view .nuevo-lote[data-paso='3']")
        pg.click("#view [data-accion=nl-plan-siguiente]"); pg.wait_for_selector("#view .nuevo-lote[data-paso='4']")
        pg.fill("#nl-galpon", "G2"); pg.click("#view [data-accion=nl-crear]"); pg.wait_for_function("location.hash.startsWith('#/lote/') && !location.hash.endsWith('%s')" % lid, timeout=4000)
        check("hay 2 lotes y el nuevo tiene 500 aves", sorted(pg.evaluate("DB.listar('lotes').then(l => l.map(x => x.avesInicio))")) == [100, 500])
        check("un lote nuevo no deja errores", not errores, errores[:3])

        # ---------- 5b. Plan del ciclo: agregar propia -> hecho -> quitar -> reactivar -> alertas/retiro -> respaldo ----------
        lid2 = pg.evaluate("location.hash.split('/')[2]")
        def quieto_plan():  # la barra de tiempo del toast (5 s) no cuenta
            esperar(pg, "document.getAnimations().every(a => a.playState !== 'running' || a.effect.getTiming().iterations === Infinity || (a.effect.target && a.effect.target.closest && a.effect.target.closest('#toast')))", 4000)
        def hoja_abierta(): pg.wait_for_selector(".hoja-capa:not(.cerrando) .hoja"); quieto_plan()
        def toast(txt): esperar(pg, f"!document.querySelector('#toast').hidden && document.querySelector('#toast').textContent.includes({txt!r})", 4000)
        def en_sec(sec, tid): return f"!!document.querySelector('#view [data-sec={sec}] [data-item=\"{tid}\"]')"
        def medir_plan(donde):
            quieto_plan()
            for t in ("claro", "oscuro"):
                tema(t)
                chicos = pg.evaluate(CHICOS)
                check(f"[{donde}/{t}] controles >= 56 px", not chicos, chicos[:6])
                check(f"[{donde}/{t}] sin desborde horizontal", not pg.evaluate(DESBORDE))
                bajos = pg.evaluate(CONTRASTE_BAJO)
                check(f"[{donde}/{t}] texto >= 7:1", not bajos, bajos[:6])
                cortados = pg.evaluate(RECORTE)
                check(f"[{donde}/{t}] sin texto recortado", not cortados, cortados[:6])
            check(f"[{donde}] sin NaN/Infinity/undefined", pg.evaluate(SIN_NAN))
            tema("claro")
        fila = lambda tid: pg.evaluate("id => DB.obtener('planTareas', id)", tid)
        n_plan = len(pg.evaluate("id => DB.listar('planTareas', {loteId: id})", lid2))
        check("el lote nuevo guardó su plan del ciclo (labores del catálogo)", n_plan >= 10, n_plan)
        pg.click("#dl-tab-plan"); pg.wait_for_selector("#view .pc-plan"); medir_plan("plan del ciclo")
        check("Plan del ciclo: la ruta pasa a /plan", pg.evaluate("location.hash") == f"#/lote/{lid2}/plan")
        pg.click("#view [data-accion=pc-agregar]"); hoja_abierta()
        pg.click(".hoja [data-accion=pc-hoja-pestana][data-id=propia]"); pg.fill("#pc-titulo", "Revisar cortinas")
        medir_plan("agregar labor propia")
        pg.click(".hoja [data-accion=pc-propia-guardar]"); cerrada(); toast("Labor agregada")
        pid = pg.evaluate("id => DB.listar('planTareas', {loteId: id}).then(f => (f.find(x => x.titulo === 'Revisar cortinas') || {}).id)", lid2)
        check("la labor propia queda guardada y a la vista", bool(pid) and pg.locator(f"#view [data-item='{pid}']").count() == 1)
        pg.click(f"#view [data-accion=pc-hecho][data-id='{pid}']"); hoja_abierta(); medir_plan("hoja hecho")
        pg.click(".hoja [data-accion=pc-hecho-guardar]"); cerrada(); toast("Labor hecha"); esperar(pg, en_sec("hechas", pid), 4000)
        check("hecho: una sola vez hecha y un registro 'plan'", len(fila(pid)["hechas"]) == 1
              and len(pg.evaluate("id => DB.listar('registros', {loteId: id, tipo: 'plan'})", lid2)) == 1)
        pg.click("#toast [data-accion=deshacer]"); toast("Se deshizo el cambio"); esperar(pg, en_sec("semana", pid), 4000)
        pg.click(f"#view [data-accion=pc-menu][data-id='{pid}']"); pg.wait_for_selector(f"#pc-menu-{pid}:not([hidden])")
        pg.click(f"#view [data-accion=pc-quitar][data-id='{pid}']"); toast("Labor quitada"); esperar(pg, en_sec("quitadas", pid), 4000)
        check("quitar: queda guardada como quitada", fila(pid)["estado"] == "quitada")
        pg.click("#view .pc-quitadas > summary"); medir_plan("plan con quitadas")
        pg.click(f"#view [data-accion=pc-reactivar][data-id='{pid}']"); toast("Labor reactivada"); esperar(pg, en_sec("semana", pid), 4000)
        check("reactivar: vuelve a Esta semana", fila(pid)["estado"] == "activa")
        # química con retiro de huevo (el catálogo no trae ninguna con retiro > 0: se siembra la fila): aviso en el plan y en Alertas
        qid = pg.evaluate("""id => DB.guardar('planTareas', {loteId: id, origen:'catalogo', catalogoId:'prueba-quimica', categoria:'quimico',
          titulo:'Desparasitar (prueba)', detalle:'', desdeDia:0, fechaBase: hoyLocal(), estado:'activa', hechas:[], creado:new Date().toISOString(),
          quimico:{tipo:'Antiparasitario interno', ingredienteActivo:'Flubendazol', retiroHuevoDias:7, retiroCarneDias:14, advertencia: CATALOGO_AVISO_QUIMICO}}).then(f => f.id)""", lid2)
        pg.evaluate("App.refrescar()"); esperar(pg, f"!!document.querySelector('#view [data-item=\"{qid}\"]')", 4000)
        pg.click(f"#view [data-accion=pc-hecho][data-id='{qid}']"); hoja_abierta()
        pg.fill("#pc-producto", "Flubenol"); pg.click(".hoja [data-accion=pc-hecho-guardar]"); cerrada(); esperar(pg, en_sec("hechas", qid), 4000)
        check("la química hecha muestra el retiro de huevo en el plan", cumple(lambda: esperar(pg, "document.querySelector('#view .pc-retiro') && document.querySelector('#view .pc-retiro').innerText.includes('No vender huevos hasta')", 4000)))
        pg.evaluate("App.ocultarToast()")
        ir("#/alertas"); medir("alertas con retiro")
        check("Alertas muestra «No vender huevos hasta…»", cumple(lambda: esperar(pg, "document.querySelector('#view').innerText.includes('No vender huevos hasta')", 4000)))
        # respaldo: exportar -> alterar -> importar -> el plan vuelve idéntico
        antes = pg.evaluate("DB.listar('planTareas').then(f => f.sort((a, b) => a.id < b.id ? -1 : 1))")
        ir("#/ajustes")
        with pg.expect_download() as d:
            pg.click("[data-accion=aj-exportar]")
        archivo = Path(tempfile.mkdtemp()) / "respaldo.json"; d.value.save_as(str(archivo))
        resp = json.loads(archivo.read_text(encoding="utf-8"))
        check("el respaldo incluye las labores del plan", len(resp["datos"]["planTareas"]) == len(antes) and len(antes) > n_plan, (len(antes), n_plan))
        pg.wait_for_selector("#toast:not([hidden])"); pg.evaluate("App.ocultarToast()")
        pg.evaluate("DB.listar('planTareas').then(f => Promise.all(f.map(x => DB.guardar('planTareas', Object.assign({}, x, {estado: 'quitada', hechas: []})))))")
        pg.set_input_files("#aj-archivo", str(archivo)); pg.wait_for_selector(".hoja [data-accion=aj-reemplazar]")
        pg.click(".hoja [data-accion=aj-reemplazar]")
        esperar(pg, "DB.listar('planTareas').then(f => f.some(x => x.estado === 'activa'))", 6000)
        despues = pg.evaluate("DB.listar('planTareas').then(f => f.sort((a, b) => a.id < b.id ? -1 : 1))")
        check("importar el respaldo devuelve el plan idéntico (labores, estados, hechas, química)", despues == antes, (len(antes), len(despues)))
        check("tras importar siguen los 2 lotes y la mortalidad", len(pg.evaluate("DB.listar('lotes')")) == 2 and len(regs("mortalidad")) == 1, len(regs("mortalidad")))
        ir("#/lote/" + lid2 + "/plan")
        check("tras importar el plan se ve con la labor reactivada y la química hecha", pg.locator(f"#view [data-item='{pid}']").count() == 1 and pg.locator(f"#view [data-item='{qid}']").count() == 1)
        check("el recorrido del plan no dejó errores", not errores, errores[:3])

        # ---------- 6. Sin conexión ----------
        pg.evaluate("navigator.serviceWorker.ready.then(() => 0)")
        esperar(pg, "navigator.serviceWorker.controller !== null", 8000)
        faltan = pg.evaluate("""async lista => { const c = await caches.open('appollo-v5'); const ks = (await c.keys()).map(r => new URL(r.url).pathname);
            return lista.filter(p => !ks.includes('/' + p)); }""", [p for p in precache if p])
        check("el service worker precargó todos los archivos (fuentes, íconos, manifest)", not faltan and len(precache) >= 10, faltan)
        check("el caché 'appollo-v5' es el único", pg.evaluate("caches.keys()") == ["appollo-v5"], pg.evaluate("caches.keys()"))
        ctx.set_offline(True)
        pg.reload(); pg.wait_for_selector("#view .pantalla, #view .vista-error", timeout=8000)
        check("sin conexión: la app carga desde el service worker", pg.locator("#view .vista-error").count() == 0 and pg.title() == "Appollo")
        check("sin conexión: aparece la franja 'Sin conexión'", cumple(lambda: pg.wait_for_selector("#franja-offline", state="visible", timeout=4000)))
        check("sin conexión: los datos siguen ahí (2 lotes)", pg.evaluate("DB.listar('lotes').then(l => l.length)") == 2)
        check("sin conexión: tipografías cargadas", pg.evaluate("document.fonts.ready.then(() => [...document.fonts].filter(f => f.status === 'error').length === 0 && [...document.fonts].some(f => f.status === 'loaded'))"))
        for h in ["#/lotes", "#/alertas", "#/mas", "#/inventario", "#/reportes", "#/ajustes", "#/plan/genetica"]:
            ir(h)
        ir("#/lote/" + lid2 + "/plan")
        check("sin conexión: el Plan del ciclo se ve con sus labores", pg.locator("#view .pc-plan .pc-item").count() > 0)
        pg.click("#view [data-accion=pc-agregar]"); pg.wait_for_selector(".hoja .pc-cat"); pg.keyboard.press("Escape"); cerrada()
        medir("plan sin conexión")
        medir("ajustes sin conexión", temas=("claro", "oscuro"))
        ir("#/inicio")
        # importar el respaldo deja sin lote activo y el orden de los lotes no está fijado: se elige el nuevo (sin mortalidad hoy),
        # para que no salga la pregunta Sumar/Reemplazar del lote 1
        pg.evaluate("id => App.fijarLote(id)", lid2)
        registrar("mortalidad", 1)
        check("sin conexión se puede registrar (3 aves muertas en total)", sum(r["datos"]["cantidad"] for r in regs("mortalidad")) == 3, regs("mortalidad"))
        ctx.set_offline(False)
        esperar(pg, "document.querySelector('#franja-offline').hidden", 4000)
        check("sin errores de consola ni de página en todo el recorrido", not errores, errores[:5])
        br.close()
    print("TODO OK" if not fallos else f"{fallos} FALLOS"); sys.exit(1 if fallos else 0)


main()
