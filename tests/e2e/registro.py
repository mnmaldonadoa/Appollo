"""Prueba e2e del shell, la navegación y el registro rápido (dist/, 360x740, servidor http propio)."""
import socket, subprocess, sys, time, urllib.request
from pathlib import Path
from playwright.sync_api import sync_playwright

RAIZ = Path(__file__).resolve().parents[2]
fallos = 0
errores = []

SEMBRAR = """async () => {
  await DB.abrir();
  const d = new Date(); d.setDate(d.getDate() - 30);
  await DB.guardar('granja', {id:'granja', nombre:'La Esperanza', tipo:'postura', altitud:2800, tema:'auto'});
  await DB.guardar('lotes', {id:'L1', nombre:'Galpón 1', genetica:'hyline-brown', avesInicio:100,
    fechaLlegada: hoyLocal(d), edadLlegadaDias:0, galpon:'G1', estado:'activo'});
}"""

REGS = """async (tipo) => (await DB.listar('registros', r => r.loteId === 'L1' && r.tipo === tipo && r.fecha === hoyLocal()))"""

# Todo button/a/[role=button] visible mide >= 56 px de alto
CHICOS = """() => [...document.querySelectorAll('button, a, [role=button], select, input')].filter(e => {
    const r = e.getBoundingClientRect(), s = getComputedStyle(e);
    return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && !e.closest('[hidden]');
  }).map(e => ({t: (e.textContent || e.getAttribute('aria-label') || e.id || '').trim().slice(0, 24), h: Math.round(e.getBoundingClientRect().height)}))
  .filter(x => x.h < 56)"""
DESBORDE = "document.documentElement.scrollWidth > document.documentElement.clientWidth"


def libre():
    s = socket.socket(); s.bind(("127.0.0.1", 0)); p = s.getsockname()[1]; s.close(); return p


def check(nombre, cond, extra=""):
    global fallos
    print(("ok   " if cond else "FAIL ") + nombre + ("" if cond else f"  {extra}"))
    if not cond:
        fallos += 1


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

            def nueva(init=None, **opc):
                ctx = br.new_context(viewport={"width": 360, "height": 740}, **opc)
                if init: ctx.add_init_script(init)
                pg = ctx.new_page()
                pg.on("pageerror", lambda e: errores.append("pageerror: " + str(e)))
                pg.on("console", lambda m: m.type == "error" and errores.append("console: " + m.text))
                pg.goto(url)
                pg.wait_for_selector("#view .pantalla, #view .vista-error", timeout=5000)
                return ctx, pg

            def medir(pg, donde):
                chicos = pg.evaluate(CHICOS)
                check(f"[{donde}] objetivos táctiles >= 56 px", not chicos, chicos[:5])
                check(f"[{donde}] sin desborde horizontal", not pg.evaluate(DESBORDE))

            # ---------- 1. Sin lotes ----------
            ctx, pg = nueva()
            check("arranque sin hash va a #/inicio", pg.evaluate("location.hash") == "#/inicio", pg.evaluate("location.hash"))
            check("barra inferior con 5 destinos", pg.locator("#nav .nav-item").count() == 5)
            for t in ("Inicio", "Lotes", "Registrar", "Alertas", "Más"):
                check(f"barra muestra texto '{t}'", pg.locator("#nav").get_by_text(t, exact=True).count() == 1)
            check("Inicio marcado en la barra", pg.get_attribute("#nav [data-nav=inicio]", "aria-current") == "page")
            boton = pg.locator("#view [data-accion=nuevo-lote]")
            check("Inicio sin lotes muestra botón para crear lote", boton.count() == 1 and boton.is_visible())
            medir(pg, "inicio vacío")
            pg.screenshot(path=str(RAIZ / ".superpowers/sdd/2026-11-03-appollo-gestion/t5-inicio.png"))
            boton.click()
            pg.wait_for_function("location.hash === '#/nuevo-lote'")
            check("botón del Inicio lleva a #/nuevo-lote", True)
            pg.click("#nav [data-nav=lotes]")
            pg.wait_for_selector("#view h1:has-text('Lotes')")
            check("barra navega a Lotes y lo resalta", pg.get_attribute("#nav [data-nav=lotes]", "aria-current") == "page"
                  and pg.get_attribute("#nav [data-nav=inicio]", "aria-current") is None)
            pg.click("#nav [data-nav=mas]")
            pg.wait_for_selector("#view h1:has-text('Más')")
            check("Más ofrece Inventario, Reportes, Planificar y Ajustes",
                  all(pg.locator("#view").get_by_text(t).count() >= 1 for t in ("Inventario", "Reportes", "Planificar", "Ajustes")))
            pg.click("#nav [data-accion=registrar]")
            pg.wait_for_selector(".hoja")
            check("＋ sin lotes dice 'Primero crea un lote'", pg.locator(".hoja").get_by_text("Primero crea un lote").count() == 1)
            pg.click(".hoja [data-ruta='#/nuevo-lote']")
            pg.wait_for_function("location.hash === '#/nuevo-lote' && !document.querySelector('.hoja-capa')")
            check("botón de la hoja lleva a #/nuevo-lote y la cierra", True)
            pg.goto(url + "#/no-existe")
            pg.wait_for_function("location.hash === '#/inicio'")
            check("ruta desconocida va a #/inicio", True)
            ctx.close()

            # ---------- 2. Con un lote: registro rápido ----------
            ctx, pg = nueva()
            pg.evaluate(SEMBRAR)
            pg.reload()
            pg.wait_for_selector("#view .pantalla")
            toques = 0

            def toque(sel):
                nonlocal toques
                toques += 1
                pg.click(sel)

            toque("#nav [data-accion=registrar]")
            pg.wait_for_selector(".hoja [data-tipo=mortalidad]")
            check("hoja muestra los 6 tipos", all(pg.locator(f".hoja [data-tipo={t}]").count() == 1
                  for t in ("mortalidad", "alimento", "huevos", "peso", "vacuna", "sanidad")))
            check("foco entra en la hoja al abrir", pg.evaluate("!!document.activeElement.closest('.hoja')"))
            medir(pg, "hoja tipos")
            pg.wait_for_function("document.getAnimations().every(a => a.playState !== 'running')", timeout=3000)
            pg.screenshot(path=str(RAIZ / ".superpowers/sdd/2026-11-03-appollo-gestion/t5-hoja.png"))
            toque(".hoja [data-tipo=mortalidad]")
            pg.wait_for_selector("#reg-valor")
            check("mortalidad precargada en 1", pg.input_value("#reg-valor") == "1", pg.input_value("#reg-valor"))
            check("lote preseleccionado visible", pg.locator(".hoja").get_by_text("Galpón 1").count() >= 1)
            medir(pg, "hoja mortalidad")
            pg.screenshot(path=str(RAIZ / ".superpowers/sdd/2026-11-03-appollo-gestion/t5-valor.png"))
            toque(".hoja [data-accion=reg-guardar]")
            pg.wait_for_function(f"({REGS})('mortalidad').then(r => r.length === 1)", timeout=3000)
            r = pg.evaluate(REGS, "mortalidad")
            check(f"mortalidad guardada en {toques} toques (<= 3)", toques <= 3 and len(r) == 1 and r[0]["datos"]["cantidad"] == 1, r)
            check("registro con forma {id, loteId, fecha, tipo, datos, creado}",
                  set(r[0]) >= {"id", "loteId", "fecha", "tipo", "datos", "creado"}, r[0])
            pg.wait_for_selector("#toast:not([hidden]) [data-accion=deshacer]")
            check("toast 'Guardado' con Deshacer", "Guardado" in pg.inner_text("#toast"))
            pg.wait_for_function("!document.querySelector('.hoja-capa')", timeout=3000)
            check("hoja se cierra tras guardar", True)
            medir(pg, "toast")
            pg.click("#toast [data-accion=deshacer]")
            pg.wait_for_function(f"({REGS})('mortalidad').then(r => r.length === 0)", timeout=3000)
            check("Deshacer borra el registro", True)

            # Toast desaparece a los 5 s
            pg.click("#nav [data-accion=registrar]"); pg.click(".hoja [data-tipo=huevos]")
            pg.wait_for_selector("#reg-valor")
            huevos = pg.input_value("#reg-valor")
            check("huevos precargados con número entero", huevos.isdigit(), huevos)
            pg.click(".hoja [data-accion=reg-guardar]")
            pg.wait_for_selector("#toast:not([hidden])")
            t0 = time.time()
            pg.wait_for_selector("#toast", state="hidden", timeout=8000)
            dur = time.time() - t0
            check(f"barra Deshacer dura ~5 s ({dur:.1f} s)", 4.0 <= dur <= 6.5, dur)
            check("huevos guardados con el valor precargado", pg.evaluate(REGS, "huevos")[0]["datos"]["cantidad"] == int(huevos))

            # Alimento dos veces: Sumar
            pg.click("#nav [data-accion=registrar]"); pg.click(".hoja [data-tipo=alimento]")
            pg.wait_for_selector("#reg-valor")
            kg = float(pg.input_value("#reg-valor"))
            check("alimento precargado > 0 kg", kg > 0, kg)
            pg.click(".hoja [data-accion=reg-guardar]")
            pg.wait_for_function("!document.querySelector('.hoja-capa')", timeout=3000)
            pg.click("#nav [data-accion=registrar]"); pg.click(".hoja [data-tipo=alimento]")
            pg.wait_for_selector("#reg-valor")
            pg.click(".hoja [data-accion=reg-guardar]")
            pg.wait_for_selector(".hoja [data-accion=reg-sumar]")
            check("segundo alimento pregunta Sumar / Reemplazar",
                  pg.locator(".hoja [data-accion=reg-reemplazar]").count() == 1)
            medir(pg, "pregunta duplicado")
            check("la pregunta no escribe nada todavía", len(pg.evaluate(REGS, "alimento")) == 1)
            pg.click(".hoja [data-accion=reg-cancelar-dup]")
            check("Cancelar no pierde datos ni cierra la hoja", len(pg.evaluate(REGS, "alimento")) == 1
                  and pg.locator(".hoja").count() == 1)
            pg.click(".hoja [data-accion=reg-guardar]")
            pg.click(".hoja [data-accion=reg-sumar]")
            pg.wait_for_function("!document.querySelector('.hoja-capa')", timeout=3000)
            r = pg.evaluate(REGS, "alimento")
            check("Sumar deja un solo registro con los kg sumados",
                  len(r) == 1 and abs(r[0]["datos"]["kg"] - 2 * kg) < 1e-6, r)
            pg.click("#toast [data-accion=deshacer]")
            pg.wait_for_function(f"({REGS})('alimento').then(r => r.length === 1 && Math.abs(r[0].datos.kg - {kg}) < 1e-6)", timeout=3000)
            check("Deshacer tras Sumar restaura el registro previo", True)

            # Reemplazar
            pg.click("#nav [data-accion=registrar]"); pg.click(".hoja [data-tipo=alimento]")
            pg.wait_for_selector("#reg-valor")
            pg.fill("#reg-valor", "7.5")
            pg.click(".hoja [data-accion=reg-guardar]")
            pg.click(".hoja [data-accion=reg-reemplazar]")
            pg.wait_for_function("!document.querySelector('.hoja-capa')", timeout=3000)
            r = pg.evaluate(REGS, "alimento")
            check("Reemplazar sobrescribe el registro del día", len(r) == 1 and r[0]["datos"]["kg"] == 7.5, r)

            # Mortalidad mayor que las aves vivas
            pg.click("#nav [data-accion=registrar]"); pg.click(".hoja [data-tipo=mortalidad]")
            pg.wait_for_selector("#reg-valor")
            pg.fill("#reg-valor", "101")
            pg.click(".hoja [data-accion=reg-guardar]")
            pg.wait_for_selector(".hoja .reg-error:has-text('Solo quedan 100 aves en el lote')")
            check("mortalidad 101 muestra 'Solo quedan 100 aves en el lote'", True)
            check("mortalidad inválida no escribe nada y no cierra", len(pg.evaluate(REGS, "mortalidad")) == 0
                  and pg.locator(".hoja").count() == 1)

            # Escape cierra y devuelve el foco
            pg.keyboard.press("Escape")
            pg.wait_for_function("!document.querySelector('.hoja-capa')", timeout=3000)
            check("Escape cierra la hoja", True)
            check("foco vuelve al botón ＋", pg.evaluate("document.activeElement && document.activeElement.dataset.accion") == "registrar")
            # Fondo cierra
            pg.click("#nav [data-accion=registrar]")
            pg.wait_for_selector(".hoja")
            pg.mouse.click(180, 30)
            pg.wait_for_function("!document.querySelector('.hoja-capa')", timeout=3000)
            check("tocar el fondo cierra la hoja", True)

            # Sanidad y vacuna libre
            pg.click("#nav [data-accion=registrar]"); pg.click(".hoja [data-tipo=sanidad]")
            pg.wait_for_selector("#reg-enfermedad")
            pg.fill("#reg-enfermedad", "Coriza"); pg.fill("#reg-tratamiento", "Enrofloxacina")
            pg.click(".hoja [data-accion=reg-guardar]")
            pg.wait_for_function(f"({REGS})('sanidad').then(r => r.length === 1)", timeout=3000)
            pg.wait_for_function("!document.querySelector('.hoja-capa')", timeout=3000)
            r = pg.evaluate(REGS, "sanidad")[0]["datos"]
            check("sanidad guarda enfermedad, tratamiento y retiroDias", r.get("enfermedad") == "Coriza" and r.get("retiroDias") == 0, r)

            # Vacuna desde el plan
            pg.evaluate("""async () => { await DB.guardar('vacunasPlan', {id:'V1', loteId:'L1', nombre:'Newcastle', fechaPrevista:hoyLocal(), via:'Agua'});
                                         await DB.guardar('vacunasPlan', {id:'V0', loteId:'L1', nombre:'Marek', fechaPrevista:'2026-01-01', via:'SC', fechaAplicada:'2026-01-01'}); }""")
            pg.click("#nav [data-accion=registrar]"); pg.click(".hoja [data-tipo=vacuna]")
            pg.wait_for_selector(".hoja [data-accion=reg-vacuna]")
            check("vacuna lista solo las pendientes", pg.locator(".hoja [data-accion=reg-vacuna]").count() == 1)
            pg.click(".hoja [data-accion=reg-guardar]")
            pg.wait_for_function("DB.obtener('vacunasPlan', 'V1').then(v => !!v.fechaAplicada)", timeout=3000)
            r = pg.evaluate(REGS, "vacuna")
            check("Marcar aplicada escribe registro de vacuna", len(r) == 1 and r[0]["datos"]["nombre"] == "Newcastle", r)
            pg.wait_for_function("!document.querySelector('.hoja-capa')", timeout=3000)
            pg.click("#toast [data-accion=deshacer]")
            pg.wait_for_function("DB.obtener('vacunasPlan', 'V1').then(v => !v.fechaAplicada)", timeout=3000)
            check("Deshacer vacuna desmarca el plan y borra el registro", len(pg.evaluate(REGS, "vacuna")) == 0)

            # Error de vista
            pg.evaluate("VISTAS.test = async () => { throw new Error('vista rota'); }; location.hash = '#/test';")
            pg.wait_for_selector("#view .vista-error")
            check("vista que falla muestra 'Algo salió mal'", "Algo salió mal" in pg.inner_text("#view"))
            check("error de vista no borra datos", len(pg.evaluate("async () => DB.listar('lotes')")) == 1)
            pg.click("#nav [data-nav=lotes]")
            pg.wait_for_selector("#view h1:has-text('Lotes')")
            check("la barra sigue funcionando tras el error", True)
            pg.evaluate("location.hash = '#/test'")
            pg.wait_for_selector("#view .vista-error")
            pg.click("#view [data-ruta='#/inicio']")
            pg.wait_for_function("location.hash === '#/inicio'")
            check("'Volver al inicio' funciona", True)
            ctx.close()

            # ---------- 3. Dos lotes: cambiar de lote ----------
            ctx, pg = nueva()
            pg.evaluate(SEMBRAR)
            pg.evaluate("""async () => { const d = new Date(); d.setDate(d.getDate() - 10);
              await DB.guardar('lotes', {id:'L2', nombre:'Galpón 2', genetica:'cobb500', avesInicio:50, fechaLlegada:hoyLocal(d), edadLlegadaDias:0, galpon:'G2', estado:'activo'}); }""")
            pg.reload(); pg.wait_for_selector("#view .pantalla")
            pg.click("#nav [data-accion=registrar]"); pg.click(".hoja [data-tipo=mortalidad]")
            pg.click(".hoja [data-accion=reg-cambiar-lote]")
            pg.click(".hoja [data-accion=reg-elegir-lote][data-lote=L2]")
            pg.wait_for_selector(".hoja .reg-lote:has-text('Galpón 2')")
            pg.click(".hoja [data-accion=reg-guardar]")
            pg.wait_for_function("DB.listar('registros', {loteId:'L2'}).then(r => r.length === 1)", timeout=3000)
            check("con 2 lotes se puede cambiar el lote del registro", True)
            check("lote usado se recuerda", pg.evaluate("localStorage.getItem('appollo.v2.loteActivo')") == "L2")
            ctx.close()

            # ---------- 4. Franjas: sin conexión y modo memoria; movimiento reducido ----------
            ctx, pg = nueva()
            ctx.set_offline(True)
            pg.wait_for_selector("#franja-offline:not([hidden])", timeout=3000)
            check("franja 'Sin conexión' aparece", "Sin conexión, tus datos se guardan en el teléfono" in pg.inner_text("#franja-offline"))
            ctx.set_offline(False)
            pg.wait_for_selector("#franja-offline", state="hidden", timeout=3000)
            check("franja 'Sin conexión' se oculta al volver la red", True)
            ctx.close()
            ctx, pg = nueva("Object.defineProperty(window, 'indexedDB', {value: undefined, configurable: true});")
            pg.wait_for_selector("#franja-memoria:not([hidden])", timeout=3000)
            check("modo memoria muestra aviso de respaldo",
                  "Tu navegador no permite guardar datos: exporta un respaldo" in pg.inner_text("#franja-memoria"))
            ctx.close()
            ctx, pg = nueva(reduced_motion="reduce")
            pg.evaluate(SEMBRAR); pg.reload(); pg.wait_for_selector("#view .pantalla")
            pg.click("#nav [data-accion=registrar]"); pg.click(".hoja [data-tipo=mortalidad]")
            pg.click(".hoja [data-accion=reg-guardar]")
            pg.wait_for_function("!document.querySelector('.hoja-capa')", timeout=400)
            check("movimiento reducido: la hoja se cierra al instante", True)
            pg.click("#nav [data-nav=lotes]")
            anim = pg.evaluate("document.getAnimations().filter(a => a.playState === 'running').length")
            check("movimiento reducido: sin transición de pantalla", anim == 0, anim)
            ctx.close()
            br.close()
        check("sin errores de consola ni de página", not errores, errores[:5])
    finally:
        srv.terminate(); srv.wait()
    print("TODO OK" if not fallos else f"{fallos} FALLOS")
    sys.exit(1 if fallos else 0)


if __name__ == "__main__":
    main()
