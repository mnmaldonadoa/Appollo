"""Utilidades comunes de las pruebas e2e (Playwright sobre dist/, servidor http propio)."""
import socket, subprocess, sys, time, urllib.request
from contextlib import contextmanager
from pathlib import Path

RAIZ = Path(__file__).resolve().parents[2]

CHICOS = """() => [...document.querySelectorAll('button, a, [role=button], select, input')].filter(e => {
    const r = e.getBoundingClientRect(), s = getComputedStyle(e);
    return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && !e.closest('[hidden]') && !e.closest('[inert]');
  }).map(e => ({t: (e.textContent || e.getAttribute('aria-label') || e.id || '').trim().slice(0, 24), h: Math.round(e.getBoundingClientRect().height)}))
  .filter(x => x.h < 56)"""
DESBORDE = "document.documentElement.scrollWidth > document.documentElement.clientWidth"
SIN_NAN = "!/NaN|Infinity|undefined/.test(document.body.innerText)"


def libre():
    s = socket.socket(); s.bind(("127.0.0.1", 0)); p = s.getsockname()[1]; s.close(); return p


@contextmanager
def servidor(directorio=None):
    """Arranca `python3 -m http.server` sobre dist/ (el service worker y IndexedDB necesitan http) y da la URL."""
    port = libre()
    srv = subprocess.Popen([sys.executable, "-m", "http.server", str(port), "--bind", "127.0.0.1",
                            "--directory", str(directorio or RAIZ / "dist")], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    url = f"http://localhost:{port}/"
    try:
        for _ in range(50):
            try: urllib.request.urlopen(url, timeout=1); break
            except Exception: time.sleep(0.1)
        else:
            print("FAIL el servidor http no arrancó"); sys.exit(1)
        yield url
    finally:
        srv.terminate()


def esperar(pg, expresion, ms=3000):
    """Espera de verdad a que `expresion` (JS; puede devolver una Promesa) sea verdadera: sondea DENTRO de la página
    y lanza AssertionError al agotar el tiempo.
    NO usar wait_for_function con un predicado que devuelve una Promesa: retorna en cuanto ésta se resuelve,
    aunque sea a false (causa de la intermitencia de alertas.py, arreglada en 0d5b2de)."""
    ok = pg.evaluate("""async ([f, n]) => { const fn = (0, eval)('async () => (' + f + ')');
      for (let i = 0; i < n; i++) { if (await fn()) return true; await new Promise(r => setTimeout(r, 25)); }
      return false; }""", [expresion, max(1, ms // 25)])
    if not ok: raise AssertionError("tiempo agotado esperando: " + expresion)


def cumple(accion):
    """True si la espera `accion()` (wait_for_*, esperar) termina sin agotar el tiempo; False si no: así la espera
    es una aserción real de check() y no un check(..., True) constante."""
    try: accion(); return True
    except Exception: return False
