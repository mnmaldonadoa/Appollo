const fs = require('fs');
const path = require('path');
const vm = require('vm');

function cargar() {
  const mem = new Map();
  const localStorage = { getItem: k => (mem.has(k) ? mem.get(k) : null), setItem: (k, v) => { mem.set(k, String(v)); }, removeItem: k => { mem.delete(k); } };
  const ctx = vm.createContext({ console, localStorage });
  const dir = path.join(__dirname, '..', 'src');
  for (const f of ['data.js', 'model.js', 'calc.js', 'catalogo.js', 'alertas.js', 'db.js', 'ui/componentes.js']) {
    const p = path.join(dir, f);
    if (!fs.existsSync(p)) {
      if (f === 'alertas.js' || f === 'db.js') continue;
      throw new Error('Falta ' + p);
    }
    const src = fs.readFileSync(p, 'utf8');
    vm.runInContext(src, ctx, { filename: p });
    // const/let de nivel superior no cuelgan del objeto global del contexto:
    // se copian como propiedades para que las pruebas los lean (c.GENETICAS).
    for (const m of src.matchAll(/^(?:const|let)\s+([A-Za-z_$][\w$]*)\s*=/gm)) {
      ctx[m[1]] = vm.runInContext(m[1], ctx);
    }
  }
  return ctx;
}
module.exports = { cargar };
