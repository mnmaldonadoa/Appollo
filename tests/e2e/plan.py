"""Prueba e2e de la pestaña «Plan del ciclo» y la hoja «Agregar labor» (dist/, 360x740, claro y oscuro,
zona America/Guayaquil, fecha fija 2026-11-10). Uso: python3 build.py && python3 tests/e2e/plan.py [carpeta_capturas]"""
import sys
from pathlib import Path
from playwright.sync_api import sync_playwright
sys.path.insert(0, str(Path(__file__).resolve().parent))
import util as U

fallos = 0
errores = []
dialogos = []
CAPTURAS = Path(sys.argv[1]) if len(sys.argv) > 1 else None
HOY = "2026-11-10"
XSS = "<img src=x onerror=alert(1)>"
FOCO_OK = "document.activeElement && document.activeElement !== document.body && document.contains(document.activeElement)"


def check(nombre, cond, extra=""):
    global fallos
    print(("ok   " if cond else "FAIL ") + nombre + ("" if cond else f"  {extra}")); fallos += 0 if cond else 1


def main():
    with U.servidor() as url, sync_playwright() as pw:
        br = pw.chromium.launch()
        ctx = U.nuevo_contexto(br, viewport={"width": 360, "height": 740})
        ctx.clock.set_fixed_time(HOY + "T10:00:00")  # fecha fija; los temporizadores siguen en tiempo real
        pg = ctx.new_page()
        pg.on("pageerror", lambda e: errores.append("pageerror: " + str(e)))
        pg.on("console", lambda m: m.type == "error" and errores.append("console: " + m.text))
        pg.on("dialog", lambda d: (dialogos.append(d.message), d.dismiss()))
        pg.goto(url); pg.wait_for_selector("#view .pantalla, #view .vista-error", timeout=5000)

        def esperar(expr, ms=3000): U.esperar(pg, expr, ms)
        def ok_espera(expr, ms=3000): return U.cumple(lambda: esperar(expr, ms))
        def fila(tid): return pg.evaluate("id => DB.obtener('planTareas', id)", tid)
        def en_sec(sec, tid): return f"!!document.querySelector('#view [data-sec={sec}] [data-item=\"{tid}\"]')"
        def quieto():
            # la barra de tiempo del toast (5 s) no cuenta: solo se espera a la hoja y a la vista
            esperar("document.getAnimations().every(a => a.playState !== 'running' || a.effect.getTiming().iterations === Infinity || (a.effect.target && a.effect.target.closest && a.effect.target.closest('#toast')))", 4000)
        def hoja(): pg.wait_for_selector(".hoja-capa:not(.cerrando) .hoja"); quieto()
        def sin_hoja(): pg.wait_for_selector(".hoja-capa", state="detached")
        def toast(txt): esperar(f"!document.querySelector('#toast').hidden && document.querySelector('#toast').textContent.includes({txt!r})")
        def deshacer(): pg.click("#toast [data-accion=deshacer]"); toast("Se deshizo el cambio")
        def menu(tid): pg.click(f"#view [data-accion=pc-menu][data-id='{tid}']"); pg.wait_for_selector(f"#pc-menu-{tid}:not([hidden])")

        def medir(donde):
            chicos = pg.evaluate(U.CHICOS)
            check(f"[{donde}] objetivos táctiles >= 56 px", not chicos, chicos[:6])
            check(f"[{donde}] sin desborde horizontal", not pg.evaluate(U.DESBORDE))
            check(f"[{donde}] sin NaN/Infinity/undefined", pg.evaluate(U.SIN_NAN))

        def captura(nombre):
            if CAPTURAS:
                CAPTURAS.mkdir(parents=True, exist_ok=True); quieto(); pg.screenshot(path=str(CAPTURAS / nombre))

        # ---------- siembra: lote ISA Brown de 30 días con el plan sugerido menos 'agua-analisis' ----------
        pg.evaluate("DB.guardar('granja', {id:'granja', nombre:'La Esperanza', tipo:'postura', altitud:2800, tema:'auto'})")
        lid = pg.evaluate("""(() => { const g = GENETICAS.find(x => x.id === 'isa-brown');
          const plan = NuevoLote.planSugerido(g, 30).filter(id => id !== 'agua-analisis');
          return NuevoLote.crear({genetica:'isa-brown', avesInicio:100, altitud:2800, galpon:'G1', edadDias:30, plan}).then(l => l.id); })()""")
        lote = pg.evaluate("id => DB.obtener('lotes', id)", lid)
        atr = pg.evaluate("l => Plan.agregarPropia(l, {titulo:'Revisar cortinas', categoria:'ambiente', fecha:'2026-11-08'}).then(r => r.tarea.id)", lote)
        sem = pg.evaluate("l => Plan.agregarPropia(l, {titulo:'Pesar muestra', categoria:'seleccion', fecha:'2026-11-13'}).then(r => r.tarea.id)", lote)
        # Fila química con retiro en huevo (copia del químico en la fila, como hace Plan con el catálogo)
        qui = pg.evaluate("""l => DB.guardar('planTareas', {loteId: l.id, origen:'catalogo', catalogoId:'prueba-quimica', categoria:'quimico',
          titulo:'Desparasitar (prueba)', detalle:'', desdeDia:0, fechaBase:'2026-11-10', estado:'activa', hechas:[], creado:new Date().toISOString(),
          quimico:{tipo:'Antiparasitario interno', ingredienteActivo:'Flubendazol', retiroHuevoDias:7, retiroCarneDias:14, advertencia: CATALOGO_AVISO_QUIMICO}}).then(f => f.id)""", lote)

        # ---------- lote nuevo que llega con 30 días y el plan sugerido completo: sin atrasadas falsas ----------
        l30 = pg.evaluate("""(() => { const g = GENETICAS.find(x => x.id === 'isa-brown');
          return NuevoLote.crear({genetica:'isa-brown', avesInicio:50, altitud:2800, galpon:'G30', edadDias:30, plan: NuevoLote.planSugerido(g, 30)}).then(l => l.id); })()""")
        n30 = len(pg.evaluate("id => DB.listar('planTareas', {loteId: id})", l30))
        pg.evaluate(f"location.hash = '#/lote/{l30}/plan'"); pg.wait_for_selector("#view .pc-plan")
        check("llega con 30 días y el plan sugerido completo (30 labores): 0 Atrasadas",
              n30 == 30 and pg.locator("#view [data-sec=atrasadas] .pc-item").count() == 0, (n30, pg.locator("#view [data-sec=atrasadas] .pc-item").count()))
        al30 = pg.evaluate("""id => (async () => { const d = {}; for (const s of DB.STORES) d[s] = await DB.listar(s); d.granja = App.estado.granja;
          return generarAlertas(d, new Date()).filter(a => a.loteId === id && a.tipo === 'plan').map(a => a.gravedad); })()""", l30)
        check("y 0 alertas de labores atrasadas (rojas) en Alertas", al30.count("rojo") == 0, al30)
        print(f"     (alertas de labores del lote a 30 días: {len(al30)} — de hoy/próximos 7 días: {al30})")
        pg.evaluate("id => DB.obtener('lotes', id).then(l => DB.guardar('lotes', Object.assign({}, l, {estado:'cerrado', fechaCierre:'2026-11-10'})))", l30)

        # ---------- pestañas ----------
        pg.evaluate(f"location.hash = '#/lote/{lid}'"); pg.wait_for_selector("#view .detalle-lote")
        check("el detalle tiene las pestañas Resumen | Plan del ciclo, con Resumen elegida",
              pg.locator("#view [role=tab]").count() == 2 and pg.get_attribute("#dl-tab-resumen", "aria-selected") == "true"
              and pg.locator("#view .dl-datos").count() == 1)
        pg.click("#dl-tab-plan"); pg.wait_for_selector("#view .pc-plan")
        check("Plan del ciclo: la ruta pasa a /plan sin sumar historial", pg.evaluate("location.hash") == f"#/lote/{lid}/plan")
        check("Plan del ciclo: el foco sigue en la pestaña", pg.evaluate("document.activeElement && document.activeElement.id") == "dl-tab-plan")
        secs = pg.evaluate("[...document.querySelectorAll('#view .pc-seccion')].map(s => s.dataset.sec)")
        check("muestra Atrasadas, Esta semana y Próximas", all(s in secs for s in ("atrasadas", "semana", "proximas")), secs)
        check("la propia atrasada está en Atrasadas y la de 13/11 en Esta semana", pg.evaluate(en_sec("atrasadas", atr)) and pg.evaluate(en_sec("semana", sem)))
        vac = pg.evaluate("id => DB.listar('vacunasPlan', {loteId: id}).then(v => v.filter(x => !x.fechaAplicada).length)", lid)
        check("las vacunas pendientes aparecen con Marcar aplicada", vac > 0 and pg.locator("#view .pc-vacuna [data-accion=dl-aplicar]").count() == vac,
              (vac, pg.locator("#view .pc-vacuna [data-accion=dl-aplicar]").count()))
        check("+ Agregar labor está visible", pg.is_visible("#view [data-accion=pc-agregar]"))
        medir("plan claro")
        captura("plan-claro.png")

        # ---------- Hecho (doble toque no duplica) + historial + Deshacer ----------
        pg.click(f"#view [data-accion=pc-hecho][data-id='{atr}']"); hoja()
        check("la hoja Hecho trae la fecha de hoy", pg.input_value("#pc-fecha") == HOY)
        pg.fill("#pc-nota", "todo bien")
        medir("hoja hecho")
        pg.evaluate("(() => { const b = document.querySelector('.hoja [data-accion=pc-hecho-guardar]'); b.click(); b.click(); })()")
        sin_hoja(); toast("Labor hecha")
        esperar(en_sec("hechas", atr))
        f = fila(atr)
        check("Hecho: la tarea pasa a Hechas con una sola hecha (doble toque no duplica)", len(f["hechas"]) == 1 and f["hechas"][0] == {"fecha": HOY, "nota": "todo bien"}, f["hechas"])
        regs = pg.evaluate("id => DB.listar('registros', {loteId: id, tipo: 'plan'})", lid)
        check("Hecho: un solo registro 'plan'", len(regs) == 1 and regs[0]["datos"]["tareaId"] == atr, regs)
        check("Hecho: el foco no cae en body", pg.evaluate(FOCO_OK), pg.evaluate("document.activeElement && document.activeElement.outerHTML.slice(0, 80)"))
        check("única ya hecha: sin Hecho ni Mover fecha", pg.locator(f"#view [data-accion=pc-hecho][data-id='{atr}']").count() == 0
              and pg.locator(f"#view [data-accion=pc-mover][data-id='{atr}']").count() == 0)
        check("el toast ofrece Deshacer", pg.is_visible("#toast [data-accion=deshacer]"))
        deshacer()
        esperar(en_sec("atrasadas", atr))
        check("Deshacer la devuelve a Atrasadas y borra el registro", fila(atr)["hechas"] == []
              and len(pg.evaluate("id => DB.listar('registros', {loteId: id, tipo: 'plan'})", lid)) == 0)
        check("Deshacer: el foco vuelve al botón Hecho de la tarea", ok_espera(f"document.activeElement && document.activeElement.dataset.accion === 'pc-hecho' && document.activeElement.dataset.id === '{atr}'"),
              pg.evaluate("document.activeElement && document.activeElement.outerHTML.slice(0, 80)"))
        pg.click(f"#view [data-accion=pc-hecho][data-id='{atr}']"); hoja(); pg.click(".hoja [data-accion=pc-hecho-guardar]"); sin_hoja(); toast("Labor hecha")
        pg.click("#dl-tab-resumen"); pg.wait_for_selector("#view .dl-datos")
        check("la labor hecha aparece en el historial", "Labor: Revisar cortinas" in pg.inner_text("#view .dl-lista"))
        pg.click("#dl-tab-plan"); pg.wait_for_selector("#view .pc-plan")

        # ---------- Quitar + Deshacer, Quitar + Reactivar ----------
        menu(sem)
        check("el menú ofrece Mover fecha, Editar y Quitar", all(pg.is_visible(f"#view [data-accion={a}][data-id='{sem}']") for a in ("pc-mover", "pc-editar", "pc-quitar")))
        pg.click(f"#view [data-accion=pc-quitar][data-id='{sem}']"); toast("Labor quitada")
        esperar(en_sec("quitadas", sem))
        check("Quitar: pasa a Quitadas (plegada) y queda guardada como quitada", fila(sem)["estado"] == "quitada"
              and pg.evaluate("!document.querySelector('#view .pc-quitadas').open"))
        check("Quitar: el foco no cae en body", pg.evaluate(FOCO_OK))
        deshacer(); esperar(en_sec("semana", sem))
        check("Deshacer quitar la devuelve a Esta semana", fila(sem)["estado"] == "activa")
        menu(sem); pg.click(f"#view [data-accion=pc-quitar][data-id='{sem}']"); toast("Labor quitada"); esperar(en_sec("quitadas", sem))
        pg.click("#view .pc-quitadas > summary")
        pg.click(f"#view [data-accion=pc-reactivar][data-id='{sem}']"); toast("Labor reactivada")
        esperar(en_sec("semana", sem))
        check("Reactivar desde Quitadas la devuelve a Esta semana", fila(sem)["estado"] == "activa")
        check("Reactivar: el foco va a la tarjeta de la tarea", ok_espera(f"document.activeElement && document.activeElement.dataset.item === '{sem}'"),
              pg.evaluate("document.activeElement && document.activeElement.outerHTML.slice(0, 80)"))

        # ---------- Mover fecha + Deshacer; Editar ----------
        menu(sem); pg.click(f"#view [data-accion=pc-mover][data-id='{sem}']"); hoja()
        check("Mover: la hoja trae la fecha actual", pg.input_value("#pc-mover-fecha") == "2026-11-13")
        pg.fill("#pc-mover-fecha", "2026-11-25"); pg.click(".hoja [data-accion=pc-mover-guardar]"); sin_hoja(); toast("Fecha cambiada")
        esperar(en_sec("proximas", sem))
        check("Mover: la tarea pasa a Próximas con la nueva fecha", "25/11" in pg.inner_text(f"#view [data-item='{sem}']"))
        check("Mover: el toast ofrece Deshacer", pg.is_visible("#toast [data-accion=deshacer]"))
        deshacer(); esperar(en_sec("semana", sem))
        check("Deshacer mover vuelve a 13/11", "13/11" in pg.inner_text(f"#view [data-item='{sem}']"))
        menu(sem); pg.click(f"#view [data-accion=pc-editar][data-id='{sem}']"); hoja()
        pg.fill("#pc-edit-titulo", "Pesar 50 aves"); pg.click(".hoja [data-accion=pc-editar-guardar]"); sin_hoja(); toast("Labor editada")
        check("Editar cambia el título", fila(sem)["titulo"] == "Pesar 50 aves" and "Pesar 50 aves" in pg.inner_text(f"#view [data-item='{sem}']"))

        # ---------- Agregar labor: del catálogo (buscar) ----------
        pg.click("#view [data-accion=pc-agregar]"); hoja()
        pg.wait_for_selector(".hoja .pc-cat")
        check("la hoja tiene las pestañas Del catálogo y Propia", pg.locator(".hoja [data-accion=pc-hoja-pestana]").count() == 2)
        pg.click(".hoja .pc-cat summary"); medir("hoja catálogo")
        captura("agregar-claro.png")
        pg.fill("#pc-buscar", "ANALIZALA")  # el detalle dice «analízala»
        check("buscar sin tildes encuentra la tarea que no estaba en el plan",
              ok_espera("!!document.querySelector('.hoja [data-cat-item=\"agua-analisis\"] [data-accion=pc-agregar-cat]')"))
        n0 = len(pg.evaluate("id => DB.listar('planTareas', {loteId: id})", lid))
        pg.click(".hoja [data-cat-item='agua-analisis'] [data-accion=pc-agregar-cat]"); toast("Labor agregada")
        esperar("!!document.querySelector('.hoja [data-cat-item=\"agua-analisis\"] .chip')")
        filas = pg.evaluate("id => DB.listar('planTareas', {loteId: id})", lid)
        check("del catálogo agrega una fila nueva y la marca En el plan", len(filas) == n0 + 1 and any(x.get("catalogoId") == "agua-analisis" for x in filas))
        check("la hoja sigue abierta y el foco queda en la tarjeta", pg.is_visible(".hoja") and pg.evaluate(FOCO_OK))

        # ---------- Propia: título con HTML y título vacío ----------
        pg.click(".hoja [data-accion=pc-hoja-pestana][data-id=propia]")
        check("pestaña Propia visible", pg.is_visible("#pc-titulo") and not pg.is_visible("#pc-buscar"))
        medir("hoja propia")
        pg.click(".hoja [data-accion=pc-propia-guardar]")
        esperar("!document.querySelector('.hoja .pc-panel:not([hidden]) .reg-error').hidden")
        check("título vacío: mensaje claro y la hoja sigue abierta", "Escribe un título" in pg.inner_text(".hoja .pc-panel:not([hidden]) .reg-error") and pg.is_visible(".hoja"))
        pg.fill("#pc-titulo", XSS); pg.select_option("#pc-categoria", "limpieza")
        pg.click(".hoja [data-accion=pc-propia-guardar]"); sin_hoja(); toast("Labor agregada")
        pid = pg.evaluate(f"id => DB.listar('planTareas', {{loteId: id}}).then(f => (f.find(x => x.titulo === {XSS!r}) || {{}}).id)", lid)
        esperar(f"!!document.querySelector('#view [data-item=\"{pid}\"]')")
        check("título con HTML se muestra como texto", XSS in pg.inner_text(f"#view [data-item='{pid}'] b"))
        check("y no crea elementos ni ejecuta código", pg.locator("#view img").count() == 0 and not dialogos, dialogos)
        check("Agregar: el foco vuelve a + Agregar labor", ok_espera("document.activeElement && document.activeElement.dataset.accion === 'pc-agregar'"),
              pg.evaluate("document.activeElement && document.activeElement.outerHTML.slice(0, 80)"))

        # ---------- química: producto, retiro y alerta; quitar no apaga el aviso ----------
        pg.click(f"#view [data-accion=pc-hecho][data-id='{qui}']"); hoja()
        check("la hoja de una química pide el producto y muestra la advertencia", pg.is_visible("#pc-producto")
              and "Confirma producto, dosis y retiro con la etiqueta y tu veterinario." in pg.inner_text(".hoja"))
        pg.fill("#pc-producto", "Flubenol"); pg.click(".hoja [data-accion=pc-hecho-guardar]"); sin_hoja(); toast("Labor hecha")
        esperar(en_sec("hechas", qui))
        t = pg.inner_text(f"#view [data-item='{qui}']")
        check("la química hecha muestra tipo, ingrediente, retiro y producto",
              all(x in t for x in ("Antiparasitario interno", "Flubendazol", "Retiro huevo: 7 días", "No vender huevos hasta el 17/11", "Flubenol")), t)
        check("aviso de retiro arriba del plan", "No vender huevos hasta el 17/11" in pg.inner_text("#view .pc-retiro"))
        pg.evaluate("App.ocultarToast()"); pg.locator(f"#view [data-item='{qui}']").scroll_into_view_if_needed()
        captura("plan-retiro-claro.png")
        pg.evaluate("location.hash = '#/alertas'"); pg.wait_for_selector("#view .pantalla")
        check("Alertas muestra «No vender huevos hasta…»", ok_espera("document.querySelector('#view').innerText.includes('No vender huevos hasta el 17/11')"))
        pg.evaluate(f"location.hash = '#/lote/{lid}/plan'"); pg.wait_for_selector("#view .pc-plan")
        menu(qui); pg.click(f"#view [data-accion=pc-quitar][data-id='{qui}']"); toast("Labor quitada"); esperar(en_sec("quitadas", qui))
        check("quitar la química no apaga el aviso del plan", "No vender huevos hasta el 17/11" in pg.inner_text("#view .pc-retiro"))
        pg.evaluate("location.hash = '#/alertas'"); pg.wait_for_selector("#view .pantalla")
        check("ni el de Alertas", ok_espera("document.querySelector('#view').innerText.includes('No vender huevos hasta el 17/11')"))
        pg.evaluate(f"location.hash = '#/lote/{lid}/plan'"); pg.wait_for_selector("#view .pc-plan")

        # ---------- oscuro ----------
        pg.emulate_media(color_scheme="dark"); pg.wait_for_timeout(100)
        medir("plan oscuro")
        captura("plan-oscuro.png")
        pg.evaluate("App.ocultarToast()"); pg.locator("#view .pc-item").first.scroll_into_view_if_needed()
        captura("plan-oscuro-tarjetas.png")
        pg.click("#view [data-accion=pc-agregar]"); hoja(); pg.wait_for_selector(".hoja .pc-cat")
        pg.click(".hoja .pc-cat summary"); medir("hoja catálogo oscuro")
        captura("agregar-oscuro.png")
        pg.keyboard.press("Escape"); sin_hoja()
        check("Escape cierra la hoja y el foco vuelve a + Agregar labor", ok_espera("document.activeElement && document.activeElement.dataset.accion === 'pc-agregar'"))
        pg.emulate_media(color_scheme="light")

        # ---------- lote cerrado: solo lectura ----------
        pg.evaluate("id => DB.obtener('lotes', id).then(l => DB.guardar('lotes', Object.assign({}, l, {estado:'cerrado', fechaCierre:'2026-11-10'})))", lid)
        pg.evaluate("App.refrescar()"); esperar("!!document.querySelector('#view .pc-solo-lectura')")
        edicion = pg.evaluate("[...document.querySelectorAll('#view [data-accion]')].map(e => e.dataset.accion).filter(a => /^pc-|^dl-aplicar$/.test(a))")
        check("lote cerrado: sin botones de edición en el plan", not edicion, edicion)
        check("lote cerrado: el plan sigue a la vista", pg.locator("#view .pc-item").count() > 0)
        medir("plan cerrado")

        br.close()
    check("sin errores de consola ni de página", not errores, errores[:5])
    print("TODO OK" if not fallos else f"{fallos} FALLOS")
    sys.exit(1 if fallos else 0)


if __name__ == "__main__":
    main()
