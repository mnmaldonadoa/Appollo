const fs = require('fs');
const path = require('path');
(async () => {
  let fallos = 0, n = 0;
  for (const f of fs.readdirSync(__dirname).filter(f => f.endsWith('.test.js')).sort()) {
    n++;
    try { await require(path.join(__dirname, f)); console.log('ok   ' + f); }
    catch (e) { fallos++; console.error('FAIL ' + f + '\n' + (e && e.stack || e)); }
  }
  console.log(`${n - fallos}/${n} archivos de prueba OK`);
  process.exit(fallos ? 1 : 0);
})();
