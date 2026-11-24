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

# Contraste de todo texto visible de la app (vista, hoja, barra y aviso) >= 7:1, calculado sobre el fondo efectivo.
CONTRASTE_BAJO = r"""() => {
  const parse = s => { const m = s.match(/rgba?\(([^)]+)\)/); if (!m) return null;
    const p = m[1].split(/[ ,\/]+/).filter(Boolean).map(Number); return {r:p[0], g:p[1], b:p[2], a:p.length > 3 ? p[3] : 1}; };
  const mezcla = (f, d) => ({r: f.r*f.a + d.r*(1-f.a), g: f.g*f.a + d.g*(1-f.a), b: f.b*f.a + d.b*(1-f.a), a: 1});
  const canal = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
  const lum = c => 0.2126*canal(c.r) + 0.7152*canal(c.g) + 0.0722*canal(c.b);
  const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
  const fondo = el => { const capas = [];
    for (let n = el; n && n.nodeType === 1; n = n.parentElement) {
      const c = parse(getComputedStyle(n).backgroundColor); if (c && c.a > 0) { capas.push(c); if (c.a >= 1) break; } }
    let r = parse(getComputedStyle(document.body).backgroundColor); for (let i = capas.length - 1; i >= 0; i--) r = mezcla(capas[i], r); return r; };
  const visible = el => { const r = el.getBoundingClientRect(); const s = getComputedStyle(el);
    return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none' && Number(s.opacity) > 0.99 && !el.closest('[inert],[hidden],[disabled]'); };
  // Sin transiciones: un color a medio cambiar de tema (o una pestaña en segundo plano, donde no avanzan) daría falsos fallos.
  const quieto = document.createElement('style'); quieto.textContent = '*, *::before, *::after { transition: none !important; }';
  document.head.appendChild(quieto); getComputedStyle(document.body).color;
  const r = [...document.querySelectorAll('#view *, #capas *, #nav *, #toast *')]
    .filter(e => visible(e) && [...e.childNodes].some(n => n.nodeType === 3 && n.textContent.trim()))
    .map(e => { const f = fondo(e); return [e.textContent.trim().slice(0, 24), +ratio(mezcla(parse(getComputedStyle(e).color), f), f).toFixed(2)]; })
    .filter(x => x[1] < 7);
  quieto.remove();
  return r;
}"""


# Contexto de navegador común: la hora local de la app (hoyLocal, "hoy", medianoche) no debe depender de la máquina que corre las pruebas.
CTX = dict(timezone_id="America/Guayaquil", locale="es-EC")


def nuevo_contexto(br, **kw):
    """br.new_context con zona horaria America/Guayaquil y locale es-EC fijos (se puede sobrescribir con kw)."""
    return br.new_context(**{**CTX, **kw})


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
