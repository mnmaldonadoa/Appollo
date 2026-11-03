"""Prueba e2e de src/db.js sobre dist/ (servidor http propio, Playwright)."""
import json, socket, subprocess, sys, time, urllib.request
from pathlib import Path
from playwright.sync_api import sync_playwright

RAIZ = Path(__file__).resolve().parents[2]
fallos = 0
errores_pagina = []


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

            def nueva(init=None):
                ctx = br.new_context()
                if init: ctx.add_init_script(init)
                pg = ctx.new_page()
                pg.on("pageerror", lambda e: (print("  pageerror:", e), errores_pagina.append(str(e))))
                pg.goto(url)
                return ctx, pg

            # 1. guardar y listar
            ctx, pg = nueva()
            r = pg.evaluate("""async () => {
              const m = await DB.abrir();
              const g = await DB.guardar('lotes', {nombre:'L1', estado:'activo', avesInicio:50});
              await DB.guardar('lotes', {nombre:'L2', estado:'cerrado', avesInicio:10});
              const todos = await DB.listar('lotes');
              const act = await DB.listar('lotes', {estado:'activo'});
              const fn = await DB.listar('lotes', l => l.avesInicio > 20);
              const o = await DB.obtener('lotes', g.id);
              return {modo:m.modo, id:g.id, n:todos.length, act:act.length, fn:fn.length, nombre:o && o.nombre};
            }""")
            check("abrir usa indexeddb", r["modo"] == "indexeddb", r)
            check("guardar asigna id", isinstance(r["id"], str) and len(r["id"]) > 5, r)
            check("listar devuelve 2 lotes", r["n"] == 2, r)
            check("listar con objeto filtra", r["act"] == 1, r)
            check("listar con funcion filtra", r["fn"] == 1, r)
            check("obtener devuelve el lote", r["nombre"] == "L1", r)
            r = pg.evaluate("""async () => {
              const a = await DB.guardar('registros', {loteId:'x', fecha:'2026-11-02', tipo:'huevos', datos:{cantidad:3}});
              await DB.guardar('registros', {loteId:'x', fecha:'2026-11-01', tipo:'huevos', datos:{cantidad:2}});
              await DB.guardar('vacunasPlan', {loteId:'x', nombre:'Newcastle'});
              const l = await DB.listar('registros', {loteId:'x'});
              await DB.borrar('registros', a.id);
              const d = await DB.listar('registros');
              const v = await DB.listar('vacunasPlan', {loteId:'x'});
              return {l:l.length, d:d.length, v:v.length};
            }""")
            check("registros y vacunasPlan guardan/listan/borran", r == {"l": 2, "d": 1, "v": 1}, r)

            # 2. exportar -> borrar -> importar
            r = pg.evaluate("""async () => {
              const antes = (await DB.listar('lotes')).map(l => l.nombre).sort();
              const txt = await DB.exportar();
              const j = JSON.parse(txt);
              for (const l of await DB.listar('lotes')) await DB.borrar('lotes', l.id);
              const vacio = (await DB.listar('lotes')).length;
              const res = await DB.importar(txt);
              const despues = (await DB.listar('lotes')).map(l => l.nombre).sort();
              return {antes, despues, vacio, res, ver:j.version, fecha:typeof j.exportado, stores:Object.keys(j.datos).sort()};
            }""")
            check("exportar tiene formato version 1", r["ver"] == 1 and r["fecha"] == "string" and
                  r["stores"] == ["granja", "inventario", "lotes", "registros", "vacunasPlan"], r)
            check("borrar vacia", r["vacio"] == 0, r)
            check("importar restaura", r["res"] == {"ok": True} and r["antes"] == r["despues"] == ["L1", "L2"], r)

            # 3. importar invalido no toca datos
            r = pg.evaluate("""async () => {
              const out = {};
              const casos = {
                noJson: '{no es json',
                version: JSON.stringify({version:2, datos:{}}),
                storeDesconocido: JSON.stringify({version:1, datos:{otro:[]}}),
                noArreglo: JSON.stringify({version:1, datos:{lotes:{}}}),
                sinDatos: JSON.stringify({version:1}),
                mezcla: JSON.stringify({version:1, datos:{lotes:[], registros:'x'}}),
              };
              for (const [k, t] of Object.entries(casos)) {
                const res = await DB.importar(t);
                out[k] = {ok:res.ok, msg:typeof res.error === 'string' && res.error.length > 0};
              }
              out.n = (await DB.listar('lotes')).length;
              return out;
            }""")
            check("importar invalido devuelve ok:false con mensaje",
                  all(r[k] == {"ok": False, "msg": True} for k in
                      ["noJson", "version", "storeDesconocido", "noArreglo", "sinDatos", "mezcla"]), r)
            check("importar invalido deja datos intactos", r["n"] == 2, r)
            r = pg.evaluate("""async () => {
              const antes = JSON.stringify((await DB.listar('lotes')).map(l => l.id).sort());
              const out = {};
              const casos = {
                idTrue: {version:1, datos:{lotes:[{id:'ok1', nombre:'nuevo'}], registros:[{id:true}]}},
                idObjeto: {version:1, datos:{lotes:[{id:{}}]}},
                sinId: {version:1, datos:{lotes:[{id:'ok2'}, {nombre:'sin id'}]}},
              };
              for (const [k, c] of Object.entries(casos)) out[k] = (await DB.importar(JSON.stringify(c))).ok;
              out.intacto = antes === JSON.stringify((await DB.listar('lotes')).map(l => l.id).sort());
              out.regs = (await DB.listar('registros')).length;
              return out;
            }""")
            check("importar con id:true / id objeto / sin id falla", r["idTrue"] is False and r["idObjeto"] is False and r["sinId"] is False, r)
            check("importar con ids invalidos deja lotes y registros intactos", r["intacto"] and r["regs"] == 1, r)
            ctx.close()

            # 4. persistencia entre recargas
            ctx, pg = nueva()
            pg.evaluate("async () => { await DB.abrir(); await DB.guardar('lotes', {nombre:'P'}); }")
            pg.reload()
            n = pg.evaluate("async () => { await DB.abrir(); return (await DB.listar('lotes')).length; }")
            check("datos persisten tras recargar", n == 1, n)
            ctx.close()

            # 5. respaldo en memoria
            ctx, pg = nueva("Object.defineProperty(window, 'indexedDB', {value: undefined, configurable: true});")
            r = pg.evaluate("""async () => {
              const m = await DB.abrir();
              const g = await DB.guardar('lotes', {nombre:'M'});
              const l = await DB.listar('lotes', {nombre:'M'});
              const txt = await DB.exportar();
              await DB.borrar('lotes', g.id);
              const imp = await DB.importar(txt);
              return {modo:m.modo, n:l.length, imp, despues:(await DB.listar('lotes')).length};
            }""")
            check("sin indexedDB abrir() devuelve memoria", r["modo"] == "memoria", r)
            check("memoria: misma interfaz funciona", r["n"] == 1 and r["imp"] == {"ok": True} and r["despues"] == 1, r)
            ctx.close()

            # 6. open() rechaza -> memoria
            ctx, pg = nueva("""Object.defineProperty(window, 'indexedDB', {configurable:true, value:{
              open() { const q = {}; setTimeout(() => q.onerror && q.onerror({target:q}), 0); return q; } }});""")
            m = pg.evaluate("async () => (await DB.abrir()).modo")
            check("open() que falla cae a memoria", m == "memoria", m)
            ctx.close()

            # 7. migrarLS
            ctx, pg = nueva()
            viejos = [
                {"id": "1", "fecha": "2026-03-05T10:00:00.000Z", "nombre": "Hy-Line Brown · 100 aves · 20 semanas",
                 "resumen": "x", "estado": {"gid": "hyline-brown", "obj": "huevos", "edad": 20, "unidad": "semanas", "aves": 100}},
                {"id": "2", "fecha": "2026-04-01T10:00:00.000Z", "nombre": "Otro", "resumen": "y",
                 "estado": {"gid": "isa-brown", "aves": 250}},
            ]
            pg.evaluate("v => localStorage.setItem('appollo.v1.lotes', JSON.stringify(v))", viejos)
            r = pg.evaluate("""async () => {
              await DB.abrir();
              const n1 = await DB.migrarLS();
              const n2 = await DB.migrarLS();
              const ls = await DB.listar('lotes');
              return {n1, n2, total:ls.length, estados:ls.map(l => l.estado), aves:ls.map(l => l.avesInicio).sort((a,b)=>a-b),
                      gen:ls.map(l => l.genetica).sort(), nombres:ls.map(l => l.nombre),
                      flag:localStorage.getItem('appollo.v2.migrado')};
            }""")
            check("migrarLS importa 2 lotes cerrados", r["n1"] == 2 and r["total"] == 2 and set(r["estados"]) == {"cerrado"}, r)
            check("migrarLS copia aves y genetica", r["aves"] == [100, 250] and r["gen"] == ["hyline-brown", "isa-brown"], r)
            check("migrarLS arma nombre con genetica y fecha", any("Hy-Line Brown" in n and "2026-03-05" in n for n in r["nombres"]), r)
            check("migrarLS corre una sola vez", r["n2"] == 0 and r["flag"], r)
            ctx.close()

            # 7b. migrarLS en modo memoria no marca la migracion
            ctx, pg = nueva("Object.defineProperty(window, 'indexedDB', {value: undefined, configurable: true});")
            pg.evaluate("v => localStorage.setItem('appollo.v1.lotes', JSON.stringify(v))", viejos)
            r = pg.evaluate("""async () => {
              const m = await DB.abrir();
              const n = await DB.migrarLS();
              return {modo:m.modo, n, flag:localStorage.getItem('appollo.v2.migrado'), legado:!!localStorage.getItem('appollo.v1.lotes')};
            }""")
            check("memoria: migrarLS importa pero no marca ni borra el legado", r["modo"] == "memoria" and r["n"] == 2 and r["flag"] is None and r["legado"], r)
            ctx.close()

            # 8. migrarLS sin datos / localStorage roto
            ctx, pg = nueva()
            n = pg.evaluate("async () => { await DB.abrir(); return await DB.migrarLS(); }")
            check("migrarLS sin datos devuelve 0", n == 0, n)
            ctx.close()
            ctx, pg = nueva("Object.defineProperty(window, 'localStorage', {get() { throw new Error('bloqueado'); }, configurable: true});")
            n = pg.evaluate("async () => { await DB.abrir(); return await DB.migrarLS(); }")
            check("migrarLS tolera localStorage bloqueado", n == 0, n)
            ctx.close()
            br.close()
    finally:
        srv.terminate()
        try: srv.wait(5)
        except Exception: srv.kill()
    if errores_pagina:
        print("FAIL errores de página:", errores_pagina); globals()["fallos"] += 1
    print("RESULTADO:", "FALLO" if fallos else "OK")
    sys.exit(1 if fallos else 0)


if __name__ == "__main__":
    main()
