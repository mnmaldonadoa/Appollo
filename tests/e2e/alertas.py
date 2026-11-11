"""Prueba e2e de Alertas e Inventario (dist/, 360x740, servidor http propio).
Uso: python3 build.py && python3 tests/e2e/alertas.py"""
import socket, subprocess, sys, time, urllib.request
from pathlib import Path
from playwright.sync_api import sync_playwright
sys.path.insert(0, str(Path(__file__).resolve().parent))
import util as U

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
            ctx = U.nuevo_contexto(br, viewport={"width": 360, "height": 740})
            ctx.clock.set_fixed_time("2026-11-04T10:00:00")   # fecha fija; los temporizadores siguen en tiempo real
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

            def esperar(f, ms=3000):
                """Espera de verdad la condición asíncrona `f` (fuente de una función); ver util.esperar."""
                U.esperar(pg, f"({f})()", ms)

            def inv_es(item, cant): esperar(f"() => DB.obtener('inventario', '{item}').then(i => i.cantidad === {cant})")

            def ir(h):
                pg.evaluate(f"location.hash = '{h}'"); pg.wait_for_function(f"location.hash === '{h}'")
                pg.wait_for_selector("#view .pantalla, #view .vista-error"); pg.wait_for_timeout(150)

            try: esperar("() => Promise.resolve(false)", 200); espera_ok = False
            except AssertionError: espera_ok = True
            check("el helper esperar() espera de verdad (no retorna con una Promesa que da false)", espera_ok)

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
            check("sin alertas: 'Todo en orden'", "Todo en orden" in pg.inner_text("#view") and pg.locator("#view .vacia-ilustracion").count() == 1, pg.inner_text("#view"))
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
            inv_es(aid, 150)
            check("registrar 50 kg con 200 kg deja 150 kg", pg.evaluate(INV, aid)["cantidad"] == 150)
            pg.click("#toast [data-accion=deshacer]")
            inv_es(aid, 200)
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
            inv_es(aid, 8.75)
            check("50 kg bajan 1,25 sacos (de 10 a 8,75)", pg.evaluate(INV, aid)["cantidad"] == 8.75)
            pg.click("#toast [data-accion=deshacer]"); inv_es(aid, 10)
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
            pg.wait_for_selector("#toast", state="hidden", timeout=8000)
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
            esperar("() => DB.obtener('inventario', 'dec').then(i => !!i)")
            check("Deshacer restaura el ítem", pg.evaluate("DB.obtener('inventario', 'dec')")["cantidad"] == 1.25)

            # ---------- 8. descontarAlimento robusto ----------
            r = pg.evaluate("""async () => { const antes = (await DB.obtener('inventario', '%s')).cantidad;
              for (const k of [NaN, Infinity, undefined, 'x']) await Inventario.descontarAlimento(k);
              const igual = (await DB.obtener('inventario', '%s')).cantidad === antes;
              await Inventario.descontarAlimento(1e9); const cero = (await DB.obtener('inventario', '%s')).cantidad;
              return {igual, cero}; }""" % (mid, mid, mid))
            check("descontarAlimento ignora no finitos y no baja de 0", r["igual"] and r["cero"] == 0, r)
            # ---------- 9. Deshacer exacto con stock recortado ----------
            def poner(cant, vinculo=True):
                pg.evaluate("""async ([id, c, v]) => { const i = await DB.obtener('inventario', id); i.cantidad = c; i.unidad = 'kg'; delete i.kgPorUnidad;
                  if (v) i.vinculoAlimento = true; else delete i.vinculoAlimento; await DB.guardar('inventario', i); }""", [mid, cant, vinculo])
            def stock(): return pg.evaluate(INV, mid)["cantidad"]
            def limpiar():
                pg.evaluate("DB.listar('registros').then(rs => Promise.all(rs.filter(r => r.tipo === 'alimento').map(r => DB.borrar('registros', r.id))))")
                pg.wait_for_selector("#toast", state="hidden", timeout=8000)
            def desc(v): esperar(f"() => DB.listar('registros').then(rs => rs.some(r => r.tipo === 'alimento' && r.datos.descontadoKg === {v}))")
            ir("#/inicio"); limpiar(); poner(20)
            registrar_kg(50)
            esperar(f"() => DB.obtener('inventario', '{mid}').then(i => i.cantidad === 0)")
            desc(20)
            check("stock 20 + registro de 50 kg -> 0 y guarda descontadoKg 20", stock() == 0 and pg.evaluate(REGS, "alimento")[0]["datos"]["descontadoKg"] == 20)
            pg.click("#toast [data-accion=deshacer]")
            esperar(f"() => DB.obtener('inventario', '{mid}').then(i => i.cantidad === 20)")
            check("Deshacer devuelve exactamente 20 (no 50)", stock() == 20 and len(pg.evaluate(REGS, "alimento")) == 0)
            pg.wait_for_selector("#toast", state="hidden", timeout=8000)
            registrar_kg(50)
            esperar(f"() => DB.obtener('inventario', '{mid}').then(i => i.cantidad === 0)")
            pg.wait_for_selector("#toast", state="hidden", timeout=8000)
            ir(f"#/lote/{lid}"); pg.click("#view .dl-borrar >> nth=0")
            esperar(f"() => DB.obtener('inventario', '{mid}').then(i => i.cantidad === 20)")
            check("borrar ese registro en el detalle deja 20 (no 70)", stock() == 20)
            pg.click("#toast [data-accion=deshacer]")
            esperar(f"() => DB.obtener('inventario', '{mid}').then(i => i.cantidad === 0)")
            desc(20)
            check("Deshacer el borrado vuelve a 0 y conserva descontadoKg 20",
                  stock() == 0 and pg.evaluate(REGS, "alimento")[0]["datos"]["descontadoKg"] == 20)
            pg.wait_for_selector("#toast", state="hidden", timeout=8000)
            # Sumar y deshacer
            ir("#/inicio"); limpiar(); poner(20)
            registrar_kg(10)
            esperar(f"() => DB.obtener('inventario', '{mid}').then(i => i.cantidad === 10)")
            pg.wait_for_selector("#toast", state="hidden", timeout=8000)
            pg.click("#nav [data-accion=registrar]"); pg.click(".hoja [data-tipo=alimento]"); pg.wait_for_selector("#reg-valor")
            pg.fill("#reg-valor", "30"); pg.click(".hoja [data-accion=reg-guardar]")
            pg.wait_for_selector(".hoja [data-accion=reg-sumar]"); pg.click(".hoja [data-accion=reg-sumar]")
            esperar(f"() => DB.obtener('inventario', '{mid}').then(i => i.cantidad === 0)")
            desc(20)
            r = pg.evaluate(REGS, "alimento")[0]["datos"]
            check("Sumar con stock insuficiente: kg 40 y descontadoKg 20", r["kg"] == 40 and r["descontadoKg"] == 20, r)
            pg.wait_for_selector("#toast:not([hidden]) [data-accion=deshacer]"); pg.click("#toast [data-accion=deshacer]")
            esperar(f"() => DB.obtener('inventario', '{mid}').then(i => i.cantidad === 10)")
            desc(10)
            r = pg.evaluate(REGS, "alimento")[0]["datos"]
            check("Deshacer Sumar vuelve al stock original (10) y a descontadoKg 10", stock() == 10 and r["kg"] == 10 and r["descontadoKg"] == 10, r)
            pg.wait_for_selector("#toast", state="hidden", timeout=8000)
            # registro anterior al vínculo
            ir("#/inicio"); limpiar(); poner(20, vinculo=False)
            registrar_kg(30)
            pg.wait_for_selector("#toast", state="hidden", timeout=8000)
            check("sin vínculo no guarda descontadoKg", "descontadoKg" not in pg.evaluate(REGS, "alimento")[0]["datos"])
            poner(20, vinculo=True)
            ir(f"#/lote/{lid}"); pg.click("#view .dl-borrar >> nth=0")
            pg.wait_for_selector("#toast:not([hidden])")
            esperar("() => DB.listar('registros').then(r => r.filter(x => x.tipo === 'alimento').length === 0)")  # el borrado terminó de verdad
            pg.wait_for_timeout(100)  # margen corto: si el borrado tocara el stock, ya lo habría hecho
            check("borrar un registro creado antes del vínculo no cambia el stock", stock() == 20 and len(pg.evaluate(REGS, "alimento")) == 0, stock())
            pg.wait_for_selector("#toast", state="hidden", timeout=8000)

            # ---------- 9b. Plan del ciclo: alertas con Hecho/Deshacer y aviso 'Elegir tareas del ciclo' ----------
            CAP = Path("/tmp/claude-0/-home-claude/b1ccecc4-68b0-5c48-8f90-0cece85f2c0c/scratchpad/t9"); CAP.mkdir(parents=True, exist_ok=True)
            AV = f"appollo.v2.planAvisado:{lid}"
            def inicio_listo():
                if pg.evaluate("location.hash") == "#/inicio": pg.evaluate("App.refrescar()")  # misma ruta: no hay hashchange
                ir("#/inicio"); pg.wait_for_selector("#view .ini-rejilla"); quieto()
            pg.evaluate("DB.listar('planTareas').then(fs => Promise.all(fs.map(f => DB.borrar('planTareas', f.id))))")
            pg.evaluate("k => localStorage.removeItem(k)", AV)
            pg.evaluate("DB.guardar('lotes', {id:'cerr', nombre:'Viejo', estado:'cerrado', genetica:'hyline-brown', avesInicio:10, fechaLlegada:'2026-01-01', edadLlegadaDias:0, galpon:'G9'})")
            inicio_listo(); pg.wait_for_selector("#view [data-t=plan-aviso]")
            check("lote sin plan: una sola tarjeta 'Elegir tareas del ciclo' (sin lote cerrado)",
                  pg.locator("#view [data-t=plan-aviso]").count() == 1 and "Elegir tareas del ciclo" in pg.inner_text("#view [data-t=plan-aviso]")
                  and "Viejo" not in pg.inner_text("#view [data-t=plan-aviso]"), pg.inner_text("#view"))
            medir("inicio con aviso de plan"); pg.screenshot(path=str(CAP / "inicio-aviso.png"))
            pg.click("#view [data-accion=ini-elegir-plan]"); pg.wait_for_function("location.hash === '#/lote/%s/plan'" % lid)
            pg.wait_for_selector("#view [role=tab][aria-selected=true]")
            check("abrir la tarjeta lleva a la pestaña Plan y marca el aviso",
                  pg.evaluate("k => localStorage.getItem(k)", AV) == "1" and pg.locator("#view [role=tab][aria-selected=true]", has_text="Plan").count() == 1)
            inicio_listo()
            check("la tarjeta no vuelve a salir", pg.locator("#view [data-t=plan-aviso]").count() == 0)
            pg.evaluate("k => localStorage.removeItem(k)", AV); inicio_listo(); pg.wait_for_selector("#view [data-t=plan-aviso]")
            pg.click("#view [data-accion=ini-plan-despues]"); pg.wait_for_function("!document.querySelector('#view [data-t=plan-aviso]')")
            check("'Ahora no' descarta el aviso y queda marcado", pg.evaluate("k => localStorage.getItem(k)", AV) == "1")
            # sin localStorage la página sigue funcionando
            pg.evaluate("k => localStorage.removeItem(k)", AV)
            pg.evaluate("() => { Storage.prototype._g = Storage.prototype.getItem; Storage.prototype.getItem = function () { throw new Error('bloqueado'); }; }")
            inicio_listo(); pg.wait_for_selector("#view [data-t=plan-aviso]")
            check("con localStorage bloqueado Inicio sigue mostrando la tarjeta sin errores", pg.locator("#view [data-t=plan-aviso]").count() == 1)
            pg.evaluate("() => { Storage.prototype.getItem = Storage.prototype._g; }")
            pg.evaluate("k => localStorage.setItem(k, '1')", AV)

            # labor de hoy -> alerta ámbar individual -> Hecho / Deshacer (no químico: un toque)
            pg.evaluate("""lid => DB.guardar('planTareas', {id:'pt1', loteId: lid, origen:'propia', categoria:'manejo', titulo:'Desparasitar <b>x</b>',
               desdeDia:0, fechaBase:'2026-11-04', estado:'activa', hechas:[]})""", lid)
            pg.evaluate("location.reload()"); pg.wait_for_selector("#view .pantalla")
            inicio_listo()
            check("Inicio cuenta la alerta de plan (tarjeta Alertas pendientes con 1+)", int(pg.locator("#view [data-t=alertas] .tarjeta-cifra").get_attribute("data-cifra")) >= 1)
            pg.screenshot(path=str(CAP / "inicio-plan.png"))
            ir("#/alertas"); quieto()
            card = pg.locator("#view [data-alerta=plan-pt1]")
            check("labor de hoy: alerta ámbar 'Atención' con texto escapado y botones Ver plan / Hecho",
                  card.count() == 1 and "al-ambar" in card.get_attribute("class") and "Atención" in card.inner_text() and "Desparasitar <b>x</b>" in card.inner_text()
                  and card.locator("b").count() == 0 and card.locator("[data-accion=ir]").inner_text().strip() == "Ver plan"
                  and card.locator("[data-accion=al-plan-hecho]").inner_text().strip() == "Hecho", card.inner_text() if card.count() else pg.inner_text("#view"))
            check("'Ver plan' usa el enlace profundo de la pestaña Plan", card.locator("[data-accion=ir]").get_attribute("data-ruta") == "#/lote/%s/plan" % lid)
            pg.click("#view [data-alerta=plan-pt1] [data-accion=al-plan-hecho]")
            pg.wait_for_selector("#toast:not([hidden]) [data-accion=deshacer]")
            esperar("() => DB.obtener('planTareas', 'pt1').then(t => t.hechas.length === 1)")
            pg.wait_for_function("!document.querySelector('#view [data-alerta=plan-pt1]')")
            check("Hecho quita la alerta, anota la hecha y crea el registro de plan",
                  pg.evaluate("DB.obtener('planTareas', 'pt1')")["hechas"][0]["fecha"] == pg.evaluate(HOY()) and len(pg.evaluate(REGS, "plan")) == 1)
            check("tras Hecho el foco no queda en <body>", pg.evaluate("document.activeElement && document.activeElement !== document.body") or pg.locator("#view .al-card").count() == 0)
            pg.click("#toast [data-accion=deshacer]")
            pg.wait_for_selector("#view [data-alerta=plan-pt1]")
            esperar("() => DB.obtener('planTareas', 'pt1').then(t => t.hechas.length === 0)")
            check("Deshacer restaura la alerta y borra el registro", len(pg.evaluate(REGS, "plan")) == 0)
            check("tras Deshacer el foco vuelve al botón Hecho de esa alerta",
                  pg.evaluate("(document.activeElement.dataset || {}).accion === 'al-plan-hecho' && document.activeElement.dataset.id === 'pt1'"))
            # doble toque: un solo registro
            pg.wait_for_selector("#toast", state="hidden", timeout=8000)
            pg.evaluate("document.querySelector('#view [data-accion=al-plan-hecho]').click(); document.querySelector('#view [data-accion=al-plan-hecho]').click()")
            esperar("() => DB.listar('registros').then(r => r.filter(x => x.tipo === 'plan').length >= 1)")
            pg.wait_for_timeout(300)
            check("doble toque en Hecho registra una sola vez", len(pg.evaluate(REGS, "plan")) == 1)
            pg.wait_for_selector("#toast", state="hidden", timeout=8000)

            # atrasadas: UNA alerta ámbar por lote, sin Hecho, detrás de las rojas
            pg.evaluate("""lid => Promise.all([
               DB.guardar('planTareas', {id:'pa1', loteId: lid, origen:'propia', categoria:'agua', titulo:'Lavar tanque', desdeDia:0, fechaBase:'2026-10-30', estado:'activa', hechas:[]}),
               DB.guardar('planTareas', {id:'pa2', loteId: lid, origen:'propia', categoria:'agua', titulo:'Revisar cortinas', desdeDia:0, fechaBase:'2026-11-01', estado:'activa', hechas:[]}),
               DB.guardar('planTareas', {id:'pa3', loteId: lid, origen:'propia', categoria:'agua', titulo:'Muy vieja', desdeDia:0, fechaBase:'2026-09-20', estado:'activa', hechas:[]})])""", lid)
            pg.evaluate("App.refrescar()"); pg.wait_for_selector("#view [data-alerta='plan-atrasadas-%s']" % lid); quieto()
            g = pg.locator("#view [data-alerta='plan-atrasadas-%s']" % lid)
            check("atrasadas agrupadas: '2 labores atrasadas · lote' ámbar con Ver plan y sin Hecho (la de hace 45 días quedó omitida)",
                  g.count() == 1 and "al-ambar" in g.get_attribute("class") and "2 labores atrasadas · " in g.inner_text()
                  and g.locator("[data-accion=ir]").get_attribute("data-ruta") == "#/lote/%s/plan" % lid and g.locator("[data-accion=al-plan-hecho]").count() == 0
                  and pg.locator("#view [data-alerta=plan-pa1], #view [data-alerta=plan-pa2], #view [data-alerta=plan-pa3]").count() == 0, g.inner_text() if g.count() else pg.inner_text("#view"))
            orden = pg.evaluate("[...document.querySelectorAll('#view .al-card')].map(c => c.classList.contains('al-rojo') ? 0 : c.classList.contains('al-ambar') ? 1 : 2)")
            check("ninguna ámbar o info antes de una roja", orden == sorted(orden), orden)
            check("la insignia de urgentes no cuenta las labores", pg.evaluate("document.querySelector('#nav-insignia').hidden || !/2 labores/.test(document.querySelector('#nav-insignia').textContent)"))

            # químico de hoy: Hecho desde Alertas NO guarda en un toque; abre la hoja con «Último día de tratamiento»
            pg.evaluate("""lid => DB.guardar('planTareas', {id:'pq1', loteId: lid, origen:'catalogo', catalogoId:'qui-cocci-amprolio', categoria:'quimico',
               titulo:'Amprolio en el agua', detalle:'', desdeDia:0, fechaBase:'2026-11-04', estado:'activa', hechas:[],
               quimico:{tipo:'Anticoccidial de tratamiento en el agua', ingredienteActivo:'Amprolio', retiroHuevoDias:null, retiroCarneDias:null, enAves:true,
                 advertencia: CATALOGO_AVISO_QUIMICO}})""", lid)
            pg.evaluate("App.refrescar()"); pg.wait_for_selector("#view [data-alerta=plan-pq1]"); quieto()
            nreg = len(pg.evaluate(REGS, "plan"))
            pg.click("#view [data-alerta=plan-pq1] [data-accion=al-plan-hecho]")
            pg.wait_for_selector(".hoja-capa:not(.cerrando) .hoja #pc-fecha"); quieto()
            hoja = pg.locator(".hoja")
            check("químico: Hecho abre la hoja (sin guardar) con 'Último día de tratamiento (última dosis)' y su ayuda",
                  "Último día de tratamiento (última dosis)" in hoja.inner_text() and "El retiro se cuenta desde el último día que las aves recibieron el producto" in hoja.inner_text()
                  and len(pg.evaluate(REGS, "plan")) == nreg and pg.evaluate("DB.obtener('planTareas', 'pq1')")["hechas"] == [], hoja.inner_text())
            check("la hoja trae el aviso fijo y los días de retiro de la etiqueta (huevo y carne)",
                  pg.evaluate("CATALOGO_AVISO_QUIMICO") in hoja.inner_text() and "Días de retiro según la etiqueta (opcional)" in hoja.inner_text()
                  and hoja.locator("#pc-etq-huevo").count() == 1 and hoja.locator("#pc-etq-carne").count() == 1)
            medir("hoja Hecho químico"); pg.screenshot(path=str(CAP / "hoja-hecho-quimico.png"))
            pg.fill("#pc-etq-carne", "400"); pg.click(".hoja [data-accion=pc-hecho-guardar]")
            pg.wait_for_selector(".hoja .reg-error:not([hidden])")
            check("días de etiqueta fuera de 0-365: error y no guarda", "entero de 0 a 365" in pg.inner_text(".hoja .reg-error") and len(pg.evaluate(REGS, "plan")) == nreg)
            pg.fill("#pc-etq-carne", ""); pg.fill("#pc-producto", "Amprolin")
            pg.click(".hoja [data-accion=pc-hecho-guardar]")
            pg.wait_for_selector(".hoja-capa", state="detached", timeout=4000)
            pg.wait_for_selector("#toast:not([hidden]) [data-accion=deshacer]")
            esperar("() => DB.obtener('planTareas', 'pq1').then(t => t.hechas.length === 1)")
            pg.wait_for_selector("#view [data-alerta=etiqueta-pq1]")
            check("el toast de la hoja ofrece Deshacer", pg.is_visible("#toast [data-accion=deshacer]"))
            pg.wait_for_selector("#toast", state="hidden", timeout=8000); quieto()
            e = pg.locator("#view [data-alerta=etiqueta-pq1]")
            check("tras guardar: aviso ámbar 'revisa en la etiqueta el retiro en huevos y carne' con el producto",
                  "al-ambar" in e.get_attribute("class") and "Aplicaste Amprolin el 04/11: revisa en la etiqueta el retiro en huevos y carne antes de venderlos" in e.inner_text(), e.inner_text())
            medir("alertas con plan"); pg.screenshot(path=str(CAP / "alertas-plan.png"))
            pg.emulate_media(color_scheme="dark"); pg.wait_for_timeout(150); pg.screenshot(path=str(CAP / "alertas-plan-oscuro.png")); pg.emulate_media(color_scheme="light")
            pg.evaluate("DB.listar('registros').then(rs => Promise.all(rs.filter(r => r.tipo === 'plan').map(r => DB.borrar('registros', r.id))))")
            pg.evaluate("DB.listar('planTareas').then(fs => Promise.all(fs.map(f => DB.borrar('planTareas', f.id))))")
            pg.evaluate("DB.borrar('lotes', 'cerr')")
            pg.wait_for_selector("#toast", state="hidden", timeout=8000)

            # ---------- 10. A las 19:00: aviso 'sin registro' no suma al contador ----------
            ctx2 = U.nuevo_contexto(br, viewport={"width": 360, "height": 740}); ctx2.clock.set_fixed_time("2026-11-04T19:00:00")
            p2 = ctx2.new_page(); p2.on("pageerror", lambda e: errores.append("pageerror: " + str(e)))
            p2.on("console", lambda m: m.type == "error" and errores.append("console: " + m.text))
            p2.goto(url); p2.wait_for_selector("#view .pantalla")
            p2.evaluate("DB.guardar('granja', {id:'granja', nombre:'La Esperanza', tipo:'postura', altitud:2800, tema:'auto'})")
            p2.evaluate("NuevoLote.crear({genetica:'hyline-brown', avesInicio:100, altitud:2800, galpon:'G1', edadDias:30})")
            p2.evaluate("DB.listar('vacunasPlan').then(vs => Promise.all(vs.map(v => DB.borrar('vacunasPlan', v.id))))")
            p2.reload(); p2.wait_for_selector("#view .pantalla")
            p2.evaluate("location.hash = '#/alertas'"); p2.wait_for_selector("#view .al-card")
            card = p2.locator("#view .al-card")
            check("a las 19:00 aparece el aviso 'sin registro' etiquetado 'Aviso'",
                  card.count() == 1 and "Aviso" in card.inner_text() and "aún no hay registros" in card.inner_text(), p2.inner_text("#view"))
            check("el aviso informativo no cuenta en la insignia", p2.evaluate("document.querySelector('#nav-insignia').hidden"))
            ctx2.close()
            check("sin errores de consola", not errores, errores[:5])
            ctx.close(); br.close()
    finally:
        srv.terminate()
    print("FALLOS:", fallos)
    sys.exit(1 if fallos else 0)

main()
