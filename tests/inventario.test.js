const assert = require('node:assert');
const { cargar } = require('./cargar');
const c = cargar();
const d = (item, kg) => c.calcularDescuento(item, kg);

assert.strictEqual(d({ unidad: 'kg', cantidad: 200 }, 50), 150);
assert.strictEqual(d({ unidad: 'sacos', kgPorUnidad: 40, cantidad: 10 }, 50), 8.75);
assert.strictEqual(d({ unidad: 'kg', cantidad: 20 }, 50), 0);                 // nunca baja de 0
assert.strictEqual(d({ unidad: 'sacos', kgPorUnidad: 40, cantidad: 1 }, 100), 0);
assert.strictEqual(d({ unidad: 'kg', cantidad: 150 }, -50), 200);             // kg negativo devuelve
assert.strictEqual(d({ unidad: 'sacos', kgPorUnidad: 40, cantidad: 8.75 }, -50), 10);
for (const kg of [NaN, Infinity, -Infinity, undefined, null, 'abc'])
  assert.strictEqual(d({ unidad: 'kg', cantidad: 7 }, kg), 7);
assert.strictEqual(d({ unidad: 'sacos', cantidad: 10 }, 50), 10);             // sin kgPorUnidad: no convierte
assert.strictEqual(d({ unidad: 'sacos', kgPorUnidad: 0, cantidad: 10 }, 50), 10);
assert.ok(Number.isNaN(Number(d({ unidad: 'kg', cantidad: 'x' }, 5))) || d({ unidad: 'kg', cantidad: 'x' }, 5) === 'x'); // cantidad ilegible: sin cambio
assert.strictEqual(d({ unidad: 'kg', cantidad: 0.3 }, 0.1) , 0.2);            // sin ruido de flotantes
console.log('inventario ok');
