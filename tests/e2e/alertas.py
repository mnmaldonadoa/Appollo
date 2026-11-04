"""Prueba e2e de Alertas e Inventario (dist/, 360x740, servidor http propio).
Uso: python3 build.py && python3 tests/e2e/alertas.py"""
import socket, subprocess, sys, time, urllib.request
from pathlib import Path
from playwright.sync_api import sync_playwright

RAIZ = Path(__file__).resolve().parents[2]
SDD = RAIZ / ".superpowers/sdd/2026-11-03-appollo-gestion"
fallos = 0
errores = []

CHICOS = """() => [...document.querySelectorAll('button, a, [role=button], select, input')].filter(e => {
    const r = e.getBoundingClientRect(), s = getComputedStyle(e);
    return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && !e.closest('[hidden]') && !e.closest('[inert]');
  }).map(e => ({t: (e.textContent || e.getAttribute('aria-label') || e.id || '').trim().slice(0, 24), h: Math.round(e.getBoundingClientRect().height)}))
  .filter(x => x.h < 56)"""
DESBORDE = "document.documentElement.scrollWidth > document.documentElement.clientWidth"
SIN_NAN = "!/NaN|Infinity|undefined/.test(document.body.innerText)"
REGS = "t => DB.listar('registros').then(r => r.filter(x => x.tipo === t))"
INV = "id => DB.obtener('inventario', id)"
HOY = lambda d=0: f"(() => {{ const d = new Date(); d.setDate(d.getDate() + ({d})); return hoyLocal(d); }})()"


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
            ctx = br.new_context(viewport={"width": 360, "height": 740})
            pg = ctx.new_page()
            pg.on("pageerror", lambda e: errores.append("pageerror: " + str(e)))
            pg.on("console", lambda m: m.type == "error" and errores.append("console: " + m.text))
            pg.goto(url); pg.wait_for_selector("#view .pantalla, #view .vista-error", timeout=5000)

            def medir(donde):
                chicos = pg.evaluate(CHICOS)
                check(f"[{donde}] objetivos táctiles >= 56 px", not chicos, chicos[:6])
                check(f"[{donde}] sin desborde horizontal", not pg.evaluate(DESBORDE))
                check(f"[{donde}] sin NaN/Infinity/undefined", pg.evaluate(SIN_NAN))

            def quieto():
                pg.wait_for_function("document.getAnimations().every(a => a.playState !== 'running' || a.effect.getTiming().iterations === Infinity)", timeout=4000)

            def ir(h):
                pg.evaluate(f"location.hash = '{h}'"); pg.wait_for_function(f"location.hash === '{h}'")
                pg.wait_for_selector("#view .pantalla, #view .vista-error"); pg.wait_for_timeout(150)

            # ---------- siembra ----------
            pg.evaluate("DB.guardar('granja', {id:'granja', nombre:'La Esperanza', tipo:'postura', altitud:2800, tema:'auto'})")
            lid = pg.evaluate("NuevoLote.crear({genetica:'hyline-brown', avesInicio:100, altitud:2800, galpon:'G1', edadDias:30}).then(l => l.id)")
            pg.evaluate("""async lid => { for (const v of await DB.listar('vacunasPlan')) await DB.borrar('vacunasPlan', v.id);
               await DB.guardar('vacunasPlan', {id:'vp1', loteId: lid, nombre:'Newcastle', fechaPrevista: %s, via:'ocular'}); }""" % HOY(-1), lid)
            pg.reload(); pg.wait_for_selector("#view .pantalla")

            # ---------- 1. Alerta roja y contador ----------
            pg.wait_for_function("!document.querySelector('#nav-insignia').hidden", timeout=4000)
            check("la barra muestra el contador de alertas (1+)", int(pg.inner_text("#nav-insignia").split()[0]) >= 1, pg.inner_text("#nav-insignia"))
            ir("#/alertas"); quieto()
            check("hay una alerta roja de vacuna con chip 'Urgente'",
                  pg.locator("#view .al-rojo").count() >= 1 and "Urgente" in pg.inner_text("#view .al-rojo")
                  and "Newcastle" in pg.inner_text("#view .al-rojo"), pg.inner_text("#view"))
            check("botón de acción grande 'Ver lote'", pg.locator("#view .al-rojo [data-accion=ir]").inner_text().strip() == "Ver lote")
            medir("alertas")
            pg.screenshot(path=str(SDD / "t7-alertas.png"))
            pg.click("#view .al-rojo [data-accion=ir]"); pg.wait_for_function("location.hash === '#/lote/%s'" % lid)
            ir("#/alertas")

            # ---------- 2. Marcar hecha / Deshacer ----------
            pg.click("#view .al-rojo [data-accion=al-hecha]")
            pg.wait_for_selector("#toast:not([hidden]) [data-accion=deshacer]")
            pg.wait_for_function("document.querySelectorAll('#view .al-rojo').length === 0")
            vp = pg.evaluate("DB.obtener('vacunasPlan', 'vp1')")
            regs = pg.evaluate(REGS, "vacuna")
            check("Marcar hecha fija fechaAplicada y crea registro de vacuna",
                  vp.get("fechaAplicada") == pg.evaluate(HOY()) and len(regs) == 1 and regs[0]["datos"]["planId"] == "vp1", (vp, regs))
            check("la alerta desaparece y el contador baja", pg.locator("#view .al-rojo").count() == 0
                  and pg.evaluate("document.querySelector('#nav-insignia').hidden"))
            pg.click("#toast [data-accion=deshacer]")
            pg.wait_for_function("document.querySelectorAll('#view .al-rojo').length === 1")
            check("Deshacer restaura la alerta, quita fechaAplicada y borra el registro",
                  "fechaAplicada" not in pg.evaluate("DB.obtener('vacunasPlan', 'vp1')") and len(pg.evaluate(REGS, "vacuna")) == 0)
            pg.wait_for_selector("#toast", state="hidden", timeout=8000)

            # estado vacío
            pg.evaluate("DB.borrar('vacunasPlan', 'vp1')"); pg.evaluate("location.reload()"); pg.wait_for_selector("#view .pantalla")
            ir("#/inicio"); ir("#/alertas")
            hoyh = pg.evaluate("new Date().getHours()")
            if hoyh < 18:
                check("sin alertas: 'Todo en orden'", "Todo en orden" in pg.inner_text("#view") and pg.locator("#view .vacia-ilustracion").count() == 1)
                medir("alertas vacío")

            # ---------- 3. Inventario: crear ----------
            ir("#/inventario"); quieto()
            check("inventario vacío invita a agregar", "Nuevo ítem" in pg.inner_text("#view"))
            pg.click("#view [data-accion=inv-nuevo]"); pg.wait_for_selector(".hoja #inv-nombre")
            pg.click(".hoja [data-accion=inv-guardar]")
            check("nombre vacío: mensaje en español", "nombre" in pg.inner_text(".hoja .reg-error").lower() and pg.locator(".hoja").count() == 1)
            pg.fill("#inv-nombre", "Balanceado <i>postura</i>"); pg.fill("#inv-cant", "-5")
            pg.click(".hoja [data-accion=inv-guardar]")
            check("cantidad negativa se rechaza", "cantidad" in pg.inner_text(".hoja .reg-error").lower())
            pg.fill("#inv-cant", "200"); pg.fill("#inv-min", "-1"); pg.click(".hoja [data-accion=inv-guardar]")
            check("mínimo negativo se rechaza", "mínimo" in pg.inner_text(".hoja .reg-error").lower())
            pg.fill("#inv-min", "50"); pg.fill("#inv-costo", "abc"); pg.click(".hoja [data-accion=inv-guardar]")
            check("costo inválido se rechaza", "costo" in pg.inner_text(".hoja .reg-error").lower())
            pg.fill("#inv-costo", "22,50")
            check("alimento muestra el interruptor de descuento", pg.locator(".hoja #inv-vinculo").is_visible()
                  and pg.locator(".hoja .inv-kgpu-c").is_hidden())
            pg.click(".hoja #inv-vinculo")
            medir("form ítem"); pg.screenshot(path=str(SDD / "t7-item-form.png"))
            pg.click(".hoja [data-accion=inv-guardar]"); pg.wait_for_function("!document.querySelector('.hoja-capa')", timeout=3000)
            items = pg.evaluate("DB.listar('inventario')")
            ali = items[0]
            check("ítem creado con valores correctos", len(items) == 1 and ali["cantidad"] == 200 and ali["minimo"] == 50 and ali["costo"] == 22.5
                  and ali["vinculoAlimento"] is True and ali["nombre"] == "Balanceado <i>postura</i>", items)
            check("el nombre se muestra escapado", pg.locator("#view .inv-nombre i").count() == 0)
            aid = ali["id"]

            # ---------- 4. Registrar 50 kg descuenta; Deshacer devuelve ----------
            def registrar_kg(kg):
                pg.click("#nav [data-accion=registrar]"); pg.click(".hoja [data-tipo=alimento]")
                pg.wait_for_selector("#reg-valor"); pg.fill("#reg-valor", str(kg))
                pg.click(".hoja [data-accion=reg-guardar]")
                pg.wait_for_function("!document.querySelector('.hoja-capa')", timeout=3000)
                pg.wait_for_selector("#toast:not([hidden]) [data-accion=deshacer]")
            ir("#/inicio")
            registrar_kg(50)
            pg.wait_for_function("id => DB.obtener('inventario', id).then(i => i.cantidad === 150)", arg=aid, timeout=3000)
            check("registrar 50 kg con 200 kg deja 150 kg", pg.evaluate(INV, aid)["cantidad"] == 150)
            pg.click("#toast [data-accion=deshacer]")
            pg.wait_for_function("id => DB.obtener('inventario', id).then(i => i.cantidad === 200)", arg=aid, timeout=3000)
            check("Deshacer el registro devuelve el stock a 200 kg", pg.evaluate(INV, aid)["cantidad"] == 200 and len(pg.evaluate(REGS, "alimento")) == 0)
            pg.wait_for_selector("#toast", state="hidden", timeout=8000)

            # ---------- 5. Ítem en sacos ----------
            ir("#/inventario")
            pg.click("#view [data-accion=inv-editar]"); pg.wait_for_selector(".hoja #inv-unidad")
            pg.select_option("#inv-unidad", "sacos")
            check("sacos pide kilos por saco", pg.locator(".hoja .inv-kgpu-c").is_visible())
            pg.fill("#inv-kgpu", "40"); pg.fill("#inv-cant", "10"); pg.fill("#inv-min", "2")
            pg.click(".hoja [data-accion=inv-guardar]"); pg.wait_for_function("!document.querySelector('.hoja-capa')", timeout=3000)
            it = pg.evaluate(INV, aid)
            check("edición guarda sacos con kgPorUnidad 40", it["unidad"] == "sacos" and it["kgPorUnidad"] == 40 and it["cantidad"] == 10, it)
            pg.wait_for_selector("#toast", state="hidden", timeout=8000)
            ir("#/inicio"); registrar_kg(50)
            pg.wait_for_function("id => DB.obtener('inventario', id).then(i => i.cantidad === 8.75)", arg=aid, timeout=3000)
            check("50 kg bajan 1,25 sacos (de 10 a 8,75)", pg.evaluate(INV, aid)["cantidad"] == 8.75)
            pg.click("#toast [data-accion=deshacer]"); pg.wait_for_timeout(300)
            pg.wait_for_selector("#toast", state="hidden", timeout=8000)

            # ---------- 6. Solo un vínculo + Entrada + Bajo ----------
            ir("#/inventario")
            pg.click("#view [data-accion=inv-nuevo]"); pg.wait_for_selector(".hoja #inv-nombre")
            pg.fill("#inv-nombre", "Maíz"); pg.fill("#inv-cant", "5"); pg.fill("#inv-min", "20")
            pg.click(".hoja #inv-vinculo"); pg.click(".hoja [data-accion=inv-guardar]")
            pg.wait_for_function("!document.querySelector('.hoja-capa')", timeout=3000)
            items = pg.evaluate("DB.listar('inventario')")
            check("solo un ítem tiene vinculoAlimento", sum(1 for i in items if i.get("vinculoAlimento")) == 1
                  and next(i for i in items if i["nombre"] == "Maíz").get("vinculoAlimento") is True, items)
            mid = next(i["id"] for i in items if i["nombre"] == "Maíz")
            check("ítem bajo el mínimo: chip 'Bajo' y resalte", pg.locator("#view .inv-bajo .chip", has_text="Bajo").count() == 1)
            n_amb = pg.evaluate("generarAlertas({lotes: [], registros: [], inventario: [%s], vacunasPlan: []}, new Date()).length" % __import__("json").dumps(next(i for i in items if i["id"] == mid)))
            check("genera una alerta ámbar de inventario", n_amb == 1)
            ir("#/alertas")
            check("la alerta ámbar muestra 'Atención' y decimales con coma", "Atención" in pg.inner_text("#view .al-ambar") and "Maíz" in pg.inner_text("#view .al-ambar"), pg.inner_text("#view"))
            pg.click("#view .al-ambar [data-accion=ir]"); pg.wait_for_function("location.hash === '#/inventario'")
            pg.wait_for_selector("#view .inv-fila")
            pg.click(f"#view [data-item='{mid}'] [data-accion=inv-entrada]"); pg.wait_for_selector(".hoja #inv-suma")
            pg.fill("#inv-suma", "30"); pg.click(".hoja [data-accion=inv-entrada-ok]")
            pg.wait_for_function("!document.querySelector('.hoja-capa')", timeout=3000)
            check("Entrada suma stock (5 + 30 = 35) y quita el chip Bajo", pg.evaluate(INV, mid)["cantidad"] == 35
                  and pg.locator(f"#view [data-item='{mid}'] .chip").count() == 0)
            pg.evaluate("DB.guardar('inventario', {id:'dec', nombre:'Vitamina', categoria:'medicamento', unidad:'litros', cantidad:1.25, minimo:2.5, costo:3})")
            ir("#/alertas"); ir("#/inventario"); quieto()
            check("decimales con coma en inventario y alertas", "1,25 litros" in pg.inner_text("#view"))
            ir("#/alertas"); check("alerta de inventario con coma", "1,25" in pg.inner_text("#view .al-ambar") and "." not in pg.inner_text("#view .al-ambar").split("mínimo")[0].replace("Maíz", ""), pg.inner_text("#view .al-ambar"))
            ir("#/inventario"); quieto(); medir("inventario"); pg.screenshot(path=str(SDD / "t7-inventario.png"))

            # ---------- 7. Eliminar + Deshacer ----------
            pg.click("#view [data-item=dec] [data-accion=inv-editar]"); pg.wait_for_selector(".hoja .inv-borrar")
            pg.click(".hoja .inv-borrar"); pg.click(".hoja [data-accion=inv-borrar-si]")
            pg.wait_for_function("!document.querySelector('.hoja-capa')", timeout=3000)
            pg.wait_for_selector("#toast:not([hidden]) [data-accion=deshacer]")
            check("eliminar quita el ítem", pg.evaluate("DB.obtener('inventario', 'dec')") is None and pg.locator("#view [data-item=dec]").count() == 0)
            pg.click("#toast [data-accion=deshacer]"); pg.wait_for_selector("#view [data-item=dec]")
            check("Deshacer restaura el ítem", pg.evaluate("DB.obtener('inventario', 'dec')")["cantidad"] == 1.25)

            # ---------- 8. descontarAlimento robusto ----------
            r = pg.evaluate("""async () => { const antes = (await DB.obtener('inventario', '%s')).cantidad;
              for (const k of [NaN, Infinity, undefined, 'x']) await Inventario.descontarAlimento(k);
              const igual = (await DB.obtener('inventario', '%s')).cantidad === antes;
              await Inventario.descontarAlimento(1e9); const cero = (await DB.obtener('inventario', '%s')).cantidad;
              return {igual, cero}; }""" % (mid, mid, mid))
            check("descontarAlimento ignora no finitos y no baja de 0", r["igual"] and r["cero"] == 0, r)
            check("sin errores de consola", not errores, errores[:5])
            ctx.close(); br.close()
    finally:
        srv.terminate()
    print("FALLOS:", fallos)
    sys.exit(1 if fallos else 0)

main()
