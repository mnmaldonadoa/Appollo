"""e2e de la revisión final: migración de proyecciones v1 (edad, fecha local, Abrir en Planificador, Borrar lote),
respaldo en el WebView de Capacitor (hoja con Copiar respaldo), importar pegando texto e ids numéricos.
Uso: python3 build.py && python3 tests/e2e/migracion.py"""
import json, sys
from pathlib import Path
from playwright.sync_api import sync_playwright
sys.path.insert(0, str(Path(__file__).resolve().parent))
from util import servidor, esperar, nuevo_contexto, CHICOS, DESBORDE, SIN_NAN

fallos = 0
errores = []


def check(nombre, cond, extra=""):
    global fallos
    print(("ok   " if cond else "FAIL ") + nombre + ("" if cond else f"  {extra}")); fallos += 0 if cond else 1


# Fixture con la forma real de la v1 (app.js de Appollo 1: id = String(Date.now()), fecha = toISOString(), estado = snapshot)
V1 = [
    {"id": "1730000000001", "fecha": "2026-03-06T02:00:00.000Z",  # 21:00 del 5 de marzo en Guayaquil (UTC-5)
     "nombre": "Hy-Line Brown · 500 aves · 40 semanas", "resumen": "55.961 huevos hasta la sem. 90 · índice de manejo 60 %",
     "estado": {"gid": "hyline-brown", "obj": "huevos", "edad": 40, "unidad": "semanas", "aves": 500, "alt": 2800,
                "real": None, "fin": 630, "sel": ["q_amp"], "enf": None, "filtro": "todas"}},
    {"id": "1730000000002", "fecha": "2026-04-01T15:00:00.000Z",
     "nombre": "Cobb 500 · 300 aves · 14 días", "resumen": "2,1 kg por ave a los 42 días",
     "estado": {"gid": "cobb500", "obj": "carne", "edad": 14, "unidad": "dias", "aves": 300, "alt": 2800,
                "real": None, "fin": 42, "sel": [], "enf": None, "filtro": "todas"}},
]
SEMBRAR = "if (!localStorage.getItem('appollo.v2.migrado') && !localStorage.getItem('appollo.v1.lotes')) localStorage.setItem('appollo.v1.lotes', %s);" % json.dumps(json.dumps(V1))


def main():
    with servidor() as url, sync_playwright() as pw:
        br = pw.chromium.launch()

        def nueva(init=None, **opc):
            ctx = nuevo_contexto(br, viewport={"width": 360, "height": 740}, **opc)
            if init: ctx.add_init_script(init)
            pg = ctx.new_page()
            pg.on("pageerror", lambda e: errores.append("pageerror: " + str(e)))
            pg.on("console", lambda m: m.type == "error" and errores.append("console: " + m.text))
            pg.goto(url); pg.wait_for_selector("#view .pantalla, #view .vista-error", timeout=5000)
            return ctx, pg

        def ir(pg, h):
            pg.evaluate(f"location.hash = '{h}'"); pg.wait_for_function(f"location.hash === '{h}'")
            pg.wait_for_selector("#view .pantalla, #view .vista-error")

        # ---------- 1. Proyecciones v1 migradas ----------
        ctx, pg = nueva(SEMBRAR)
        esperar(pg, "() => DB.listar('lotes').then(l => l.length === 2)")
        lotes = pg.evaluate("DB.listar('lotes')")
        por = {l["id"]: l for l in lotes}
        a = por["ls-1730000000001"]
        check("40 semanas -> edadLlegadaDias 280", a["edadLlegadaDias"] == 280, a)
        check("14 días -> 14", por["ls-1730000000002"]["edadLlegadaDias"] == 14)
        check("fecha de llegada en hora local (21:00 del 5, no el 6)", a["fechaLlegada"] == "2026-03-05" and "2026-03-05" in a["nombre"], a)
        check("guarda el plan v1 en planV1", a["planV1"]["edad"] == 40 and a["planV1"]["unidad"] == "semanas" and a["planV1"]["sel"] == ["q_amp"], a.get("planV1"))
        ir(pg, "#/lotes")
        pg.wait_for_selector(".lote-item")
        txt = pg.inner_text("#view")
        check("Mis lotes muestra 280 días · 40 sem para la proyección de 40 semanas", "280 días" in txt and "40 sem" in txt, txt)
        check("Mis lotes muestra 14 días para la de carne", "14 días" in txt, txt)
        ir(pg, "#/lote/ls-1730000000001")
        pg.wait_for_selector(".detalle-lote")
        dato = pg.inner_text(".dl-datos")
        check("detalle: Edad 280 días · 40 sem", "280 días" in dato and "40 sem" in dato, dato)
        check("detalle sin NaN y sin desborde", pg.evaluate(SIN_NAN) and not pg.evaluate(DESBORDE))

        # ---------- 2. Abrir en Planificador ----------
        pg.click("#view [data-accion=dl-abrir-plan]")
        pg.wait_for_function("location.hash === '#/plan/proyeccion'")
        pg.wait_for_selector("#view .pantalla")
        st = pg.evaluate("JSON.parse(localStorage.getItem('appollo.v1.estado'))")
        check("el Planificador recibe gid, edad, unidad, aves y práctica marcada", st["gid"] == "hyline-brown" and st["edad"] == 40 and st["unidad"] == "semanas" and st["aves"] == 500 and st["sel"] == ["q_amp"], st)
        check("la proyección se dibuja (Hy-Line Brown, sin NaN)", "Hy-Line" in pg.inner_text("#view") and pg.evaluate(SIN_NAN), pg.inner_text("#view")[:200])
        ir(pg, "#/lote/ls-1730000000002"); pg.wait_for_selector(".detalle-lote")
        pg.click("#view [data-accion=dl-abrir-plan]")
        pg.wait_for_function("location.hash === '#/plan/proyeccion'"); pg.wait_for_selector("#view .pantalla")
        st = pg.evaluate("JSON.parse(localStorage.getItem('appollo.v1.estado'))")
        check("proyección de carne restaurada (14 días)", st["gid"] == "cobb500" and st["edad"] == 14 and st["unidad"] == "dias" and st["obj"] == "carne", st)

        # ---------- 3. Borrar lote migrado ----------
        ir(pg, "#/lote/ls-1730000000001"); pg.wait_for_selector(".detalle-lote")
        check("Borrar lote visible y de >= 56 px", pg.locator("[data-accion=dl-borrar-lote]").is_visible() and not [c for c in pg.evaluate(CHICOS) if "Borrar lote" in c["t"]])
        pg.click("[data-accion=dl-borrar-lote]")
        check("pide confirmación", pg.locator(".dl-confirmar-borrar").is_visible() and pg.locator("[data-accion=dl-borrar-lote-si]").is_visible())
        pg.click("[data-accion=dl-borrar-lote-no]")
        check("Cancelar no borra", pg.evaluate("DB.listar('lotes')").__len__() == 2 and not pg.locator(".dl-confirmar-borrar").is_visible())
        pg.click("[data-accion=dl-borrar-lote]"); pg.click("[data-accion=dl-borrar-lote-si]")
        pg.wait_for_function("location.hash === '#/lotes'")
        esperar(pg, "() => DB.listar('lotes').then(l => l.length === 1 && l[0].id === 'ls-1730000000002')")
        check("el lote se borró y se volvió a Lotes", pg.locator(".lote-item").count() == 1)
        ctx.close()

        # ---------- 4. Capacitor: el respaldo se copia, no se "descarga" ----------
        ctx, pg = nueva("window.Capacitor = { isNativePlatform: () => true };", permissions=["clipboard-read", "clipboard-write"])
        pg.evaluate("""async () => { await DB.guardar('lotes', {id: 'L9', nombre: 'Prueba', genetica: 'isa-brown', avesInicio: 12, fechaLlegada: '2026-01-02', edadLlegadaDias: 0, estado: 'activo'}); }""")
        descargas = []
        pg.on("download", lambda d: descargas.append(d))
        ir(pg, "#/ajustes")
        pg.click("[data-accion=aj-exportar]")
        pg.wait_for_selector(".hoja #aj-respaldo-texto")
        json_txt = pg.input_value("#aj-respaldo-texto")
        check("la hoja muestra el JSON del respaldo", json.loads(json_txt)["version"] == 1 and "L9" in json_txt)
        pg.wait_for_timeout(400)
        check("no hay descarga ni toast de éxito antes de copiar", not descargas and "descargado" not in pg.inner_text("#toast").lower() and "descargado" not in pg.inner_text("#view").lower())
        check("texto honesto: no guarda archivos, copiar y pegar en notas", "no puede guardar archivos" in pg.inner_text(".hoja") and "notas" in pg.inner_text(".hoja"))
        check("botón grande Copiar respaldo", pg.locator(".hoja [data-accion=aj-copiar-respaldo]").is_visible() and pg.locator(".hoja [data-accion=aj-copiar-respaldo]").bounding_box()["height"] >= 56)
        pg.click(".hoja [data-accion=aj-copiar-respaldo]")
        pg.wait_for_selector("#aj-copia-msg:not([hidden])")
        check("copiar lleva el respaldo completo al portapapeles", pg.evaluate("navigator.clipboard.readText()") == json_txt and "copiado" in pg.inner_text("#aj-copia-msg"), pg.inner_text("#aj-copia-msg"))
        # Sin Clipboard API: cae a seleccionar el textarea y execCommand('copy')
        pg.evaluate("Object.defineProperty(navigator, 'clipboard', {value: {writeText: () => Promise.reject(new Error('no'))}, configurable: true}); window.__cmd = []; const o = document.execCommand.bind(document); document.execCommand = c => { window.__cmd.push(c); return true; };")
        pg.click(".hoja [data-accion=aj-copiar-respaldo]")
        esperar(pg, "() => window.__cmd.includes('copy')")
        check("respaldo de copia: execCommand('copy') sobre el textarea seleccionado", pg.evaluate("(() => { const t = document.getElementById('aj-respaldo-texto'); return t.selectionEnd - t.selectionStart === t.value.length; })()"))
        pg.click(".hoja [data-accion=cerrar-hoja]")
        # -- importar pegando --
        pg.evaluate("DB.borrar('lotes', 'L9')")
        esperar(pg, "() => DB.listar('lotes').then(l => l.length === 0)")
        pg.click("[data-accion=aj-pegar]"); pg.wait_for_selector(".hoja #aj-pegado")
        pg.click(".hoja [data-accion=aj-pegar-revisar]")
        check("pegar vacío avisa", not pg.locator("#aj-pegado-msg").is_hidden())
        pg.fill("#aj-pegado", "esto no es un respaldo")
        pg.click(".hoja [data-accion=aj-pegar-revisar]"); pg.wait_for_selector(".hoja [data-accion=aj-reemplazar]")
        pg.click(".hoja [data-accion=aj-reemplazar]")
        pg.wait_for_selector("#aj-respaldo-msg:not([hidden])")
        check("texto inválido: aviso en español, nada cambia", "no es un respaldo válido" in pg.inner_text("#aj-respaldo-msg"), pg.inner_text("#aj-respaldo-msg"))
        pg.click("[data-accion=aj-pegar]"); pg.wait_for_selector(".hoja #aj-pegado")
        # id numérico en el respaldo pegado: debe quedar como texto y poderse abrir con #/lote/5
        resp = {"version": 1, "datos": {"lotes": [{"id": 5, "nombre": "Numerico", "genetica": "isa-brown", "avesInicio": 20, "fechaLlegada": "2026-01-02", "edadLlegadaDias": 0, "estado": "activo"}],
                "registros": [{"id": 8, "loteId": 5, "fecha": "2026-01-03", "tipo": "mortalidad", "datos": {"cantidad": 1}}], "inventario": [], "vacunasPlan": []}}
        pg.fill("#aj-pegado", json.dumps(resp))
        pg.click(".hoja [data-accion=aj-pegar-revisar]"); pg.wait_for_selector(".hoja [data-accion=aj-reemplazar]")
        pg.click(".hoja [data-accion=aj-reemplazar]")
        pg.wait_for_function("location.hash === '#/inicio'")
        ir(pg, "#/lote/5"); pg.wait_for_selector(".detalle-lote")
        check("#/lote/5 abre el lote importado con id numérico", "Numerico" in pg.inner_text("#view") and "19 / 20" in pg.inner_text("#view"), pg.inner_text("#view")[:300])
        check("sin NaN ni desborde en Ajustes/Detalle", pg.evaluate(SIN_NAN) and not pg.evaluate(DESBORDE))
        ctx.close()

        # ---------- 5. Navegador: sigue descargando, y el toast sólo después de enviar la descarga ----------
        ctx, pg = nueva(accept_downloads=True)
        ir(pg, "#/ajustes")
        with pg.expect_download() as d:
            pg.click("[data-accion=aj-exportar]")
        check("navegador: descarga el .json", d.value.suggested_filename.startswith("appollo-respaldo-") and d.value.suggested_filename.endswith(".json"))
        pg.wait_for_selector("#toast:not([hidden])")
        check("navegador: toast Respaldo descargado", "Respaldo descargado" in pg.inner_text("#toast"))
        check("navegador: no abre la hoja de copiar", pg.locator(".hoja").count() == 0)
        ctx.close()
        # ---------- 6. Base IndexedDB versión 1 (cinco almacenes, con datos) -> la app nueva (versión 2) la migra sin perder nada ----------
        ctx = nuevo_contexto(br, viewport={"width": 360, "height": 740})
        pg = ctx.new_page()
        pg.on("pageerror", lambda e: errores.append("pageerror: " + str(e)))
        pg.on("console", lambda m: m.type == "error" and errores.append("console: " + m.text))
        pg.goto(url + "manifest.webmanifest")  # mismo origen que la app, sin cargar la app: aquí se crea la base antigua
        pg.evaluate("""() => new Promise((ok, mal) => {
          const rq = indexedDB.open('appollo', 1);
          rq.onupgradeneeded = () => {
            const db = rq.result;
            ['granja', 'lotes', 'registros', 'inventario', 'vacunasPlan'].forEach(s => {
              const st = db.createObjectStore(s, { keyPath: 'id' });
              if (s === 'registros') st.createIndex('loteId+fecha', ['loteId', 'fecha']);
              if (s === 'vacunasPlan') st.createIndex('loteId', 'loteId');
            });
          };
          rq.onerror = () => mal(rq.error);
          rq.onsuccess = () => {
            const db = rq.result, tx = db.transaction(['lotes', 'registros', 'vacunasPlan', 'inventario'], 'readwrite');
            tx.objectStore('lotes').put({ id: 'V1L', nombre: 'Lote viejo', genetica: 'isa-brown', avesInicio: 30, fechaLlegada: '2026-01-02', edadLlegadaDias: 0, estado: 'activo' });
            tx.objectStore('registros').put({ id: 'V1R', loteId: 'V1L', fecha: '2026-01-03', tipo: 'mortalidad', datos: { cantidad: 2 } });
            tx.objectStore('vacunasPlan').put({ id: 'V1V', loteId: 'V1L', nombre: 'Newcastle', fechaPrevista: '2026-01-10' });
            tx.objectStore('inventario').put({ id: 'V1I', nombre: 'Maiz', cantidad: 5 });
            tx.oncomplete = () => { db.close(); ok(); };
            tx.onerror = () => mal(tx.error);
          };
        })""")
        check("la base antigua quedó en versión 1 sin planTareas", pg.evaluate("""() => new Promise(ok => { const r = indexedDB.open('appollo'); r.onsuccess = () => { const d = r.result, o = [d.version, [...d.objectStoreNames].includes('planTareas')]; d.close(); ok(o); }; })""") == [1, False])
        pg.goto(url); pg.wait_for_selector("#view .pantalla, #view .vista-error", timeout=5000)
        esperar(pg, "() => DB.listar('lotes').then(l => l.some(x => x.id === 'V1L'))")
        check("v1 -> v2: el lote sigue", pg.evaluate("DB.obtener('lotes', 'V1L')")["nombre"] == "Lote viejo")
        check("v1 -> v2: registro, vacuna e inventario siguen",
              pg.evaluate("DB.obtener('registros', 'V1R')") is not None and pg.evaluate("DB.obtener('vacunasPlan', 'V1V')") is not None and pg.evaluate("DB.obtener('inventario', 'V1I')") is not None)
        check("v1 -> v2: planTareas existe y está vacío", pg.evaluate("DB.listar('planTareas')") == [])
        info = pg.evaluate("""() => new Promise(ok => { const r = indexedDB.open('appollo'); r.onsuccess = () => { const d = r.result, tx = d.transaction('planTareas'), st = tx.objectStore('planTareas'),
          o = { v: d.version, stores: [...d.objectStoreNames].sort(), idx: [...st.indexNames], reg: [...d.transaction('registros').objectStore('registros').indexNames] }; d.close(); ok(o); }; })""")
        check("versión 2, seis almacenes, índice loteId en planTareas y el índice de registros intacto",
              info == {"v": 2, "stores": ["granja", "inventario", "lotes", "planTareas", "registros", "vacunasPlan"], "idx": ["loteId"], "reg": ["loteId+fecha"]}, info)
        pg.evaluate("DB.guardar('planTareas', {id: 'pt1', loteId: 'V1L', titulo: 'x', hechas: []})")
        check("planTareas se puede guardar y consultar por loteId", len(pg.evaluate("DB.listar('planTareas', {loteId: 'V1L'})")) == 1)
        ctx.close()
        # ---------- 7. Una pestaña vieja mantiene abierta la base v1: la app nueva espera y NO cae a memoria ----------
        ctx = nuevo_contexto(br, viewport={"width": 360, "height": 740})
        vieja = ctx.new_page()
        vieja.on("pageerror", lambda e: errores.append("pageerror vieja: " + str(e)))
        vieja.goto(url + "manifest.webmanifest")
        vieja.evaluate("""() => new Promise((ok, mal) => {
          const rq = indexedDB.open('appollo', 1);
          rq.onupgradeneeded = () => {
            const db = rq.result;
            ['granja', 'lotes', 'registros', 'inventario', 'vacunasPlan'].forEach(s => {
              const st = db.createObjectStore(s, { keyPath: 'id' });
              if (s === 'registros') st.createIndex('loteId+fecha', ['loteId', 'fecha']);
              if (s === 'vacunasPlan') st.createIndex('loteId', 'loteId');
            });
          };
          rq.onerror = () => mal(rq.error);
          rq.onsuccess = () => {
            const db = rq.result, tx = db.transaction('lotes', 'readwrite');
            tx.objectStore('lotes').put({ id: 'BL', nombre: 'Lote bloqueado', genetica: 'isa-brown', avesInicio: 9, fechaLlegada: '2026-01-02', edadLlegadaDias: 0, estado: 'activo' });
            tx.oncomplete = () => { window.__conexion = db; ok(); };   // la pestaña vieja la deja abierta, sin onversionchange
            tx.onerror = () => mal(tx.error);
          };
        })""")
        vieja.evaluate("() => { setTimeout(() => window.__conexion.close(), 1200); }")  # la pestaña vieja la cierra a los 1,2 s
        nueva_pg = ctx.new_page()
        nueva_pg.on("pageerror", lambda e: errores.append("pageerror: " + str(e)))
        nueva_pg.goto(url); nueva_pg.wait_for_selector("#view .pantalla, #view .vista-error", timeout=8000)
        esperar(nueva_pg, "() => DB.listar('lotes').then(l => l.some(x => x.id === 'BL'))", 6000)
        check("base v1 bloqueada: la app termina en indexeddb (no memoria)", nueva_pg.evaluate("DB.modo") == "indexeddb" and nueva_pg.evaluate("App.estado.modo") == "indexeddb")
        check("base v1 bloqueada: los datos siguen y no hay aviso de pérdida", nueva_pg.evaluate("DB.obtener('lotes', 'BL')")["nombre"] == "Lote bloqueado" and nueva_pg.locator("#franja-memoria").is_hidden())
        nueva_pg.evaluate("DB.guardar('lotes', {id: 'BL2', nombre: 'Otro', estado: 'activo'})")
        nueva_pg.reload(); nueva_pg.wait_for_selector("#view .pantalla, #view .vista-error", timeout=8000)
        check("base v1 bloqueada: lo guardado persiste tras recargar", nueva_pg.evaluate("DB.obtener('lotes', 'BL2')") is not None)
        ctx.close()
        br.close()
    check("sin errores de consola ni de página", not errores, errores[:5])
    print("TODO OK" if not fallos else f"{fallos} FALLOS")
    sys.exit(1 if fallos else 0)


if __name__ == "__main__":
    main()
