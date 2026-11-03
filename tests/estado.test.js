const assert = require('node:assert');
const { cargar } = require('./cargar');
const c = cargar();

// estadoSanitario(lote, registros, vacunasPlan, fecha) -> 'verde' | 'ambar' | 'rojo'
const HOY = '2026-11-03';
const N = 10000000; // muchas aves para medir la mortalidad con precisión
const lote = { id: 'L1', nombre: 'A', genetica: 'hyline-brown', avesInicio: N,
  fechaLlegada: '2026-10-01', edadLlegadaDias: 200, galpon: 'G1', estado: 'activo' };
const reg = (tipo, fecha, datos, loteId = 'L1') => ({ id: tipo + fecha + loteId, loteId, fecha, tipo, datos });
const vac = (fechaPrevista, extra = {}, loteId = 'L1') => ({ id: 'v' + fechaPrevista + loteId, loteId, nombre: 'Newcastle', fechaPrevista, via: 'agua', ...extra });
const hoyAlimento = reg('alimento', HOY, { kg: 1 });
const est = (registros, vacunas = [], l = lote, fecha = HOY) => c.estadoSanitario(l, registros, vacunas, fecha);

assert.strictEqual(typeof c.estadoSanitario, 'function', 'falta estadoSanitario en calc.js');

// Verde: registro reciente, sin vacunas próximas, sin retiro, mortalidad normal
assert.strictEqual(est([hoyAlimento]), 'verde');
assert.strictEqual(est([hoyAlimento], [vac('2026-11-05')]), 'verde', 'vacuna en 2 días no es ámbar');
assert.strictEqual(est([hoyAlimento], [vac('2026-11-01', { fechaAplicada: '2026-11-01' })]), 'verde', 'vacuna aplicada no cuenta');

// Vacunas
assert.strictEqual(est([hoyAlimento], [vac('2026-11-02')]), 'rojo', 'vacuna vencida -> rojo');
assert.strictEqual(est([hoyAlimento], [vac(HOY)]), 'ambar', 'vacuna para hoy -> ámbar');
assert.strictEqual(est([hoyAlimento], [vac('2026-11-04')]), 'ambar', 'vacuna para mañana -> ámbar');
assert.strictEqual(est([hoyAlimento], [vac('2026-11-02', {}, 'OTRO')]), 'verde', 'vacunas de otro lote no cuentan');
assert.strictEqual(est([hoyAlimento], [vac('2026-11-02'), vac('2026-11-04')]), 'rojo', 'rojo gana a ámbar');

// Retiro activo: fecha <= fechaRegistro + retiroDias
const san = (fecha, dias, loteId) => reg('sanidad', fecha, { enfermedad: 'x', tratamiento: 'y', retiroDias: dias }, loteId);
assert.strictEqual(est([hoyAlimento, san('2026-11-01', 2)]), 'rojo', 'último día de retiro -> rojo');
assert.strictEqual(est([hoyAlimento, san('2026-11-01', 1)]), 'verde', 'retiro terminado ayer -> verde');
assert.strictEqual(est([hoyAlimento, san(HOY, 5)]), 'rojo', 'retiro que empieza hoy -> rojo');
assert.strictEqual(est([hoyAlimento, san(HOY, 0)]), 'verde', 'retiro 0 días no bloquea');
assert.strictEqual(est([hoyAlimento, san('2026-11-01', 5, 'OTRO')]), 'verde', 'retiro de otro lote no cuenta');
assert.strictEqual(est([hoyAlimento, san('2026-11-05', 5)]), 'verde', 'tratamiento futuro no cuenta');

// Mortalidad de hoy frente a la esperada (% diario sobre las aves al empezar el día)
const esp = c.estandarDia(lote, HOY, undefined).mortEsperada;
assert.ok(esp > 0);
const muertes = k => Math.round(k * esp / 100 * N);
const conMuertes = (k, previas) => est([...(previas || []), reg('mortalidad', HOY, { cantidad: muertes(k) })]);
assert.strictEqual(conMuertes(2.01), 'rojo', '> 2x esperada -> rojo');
assert.strictEqual(conMuertes(1.99), 'ambar', 'entre 1,5x y 2x -> ámbar');
assert.strictEqual(conMuertes(1.51), 'ambar', '> 1,5x -> ámbar');
assert.strictEqual(conMuertes(1.49), 'verde', '<= 1,5x -> verde');
assert.strictEqual(est([hoyAlimento, reg('mortalidad', '2026-11-02', { cantidad: muertes(5) })]), 'verde', 'muertes de ayer no cuentan como hoy');
// La base es las aves al empezar el día: con la mitad muerta antes, la misma cifra pesa el doble
assert.strictEqual(conMuertes(1.2, [reg('mortalidad', '2026-10-20', { cantidad: N / 2 })]), 'rojo');

// Sin registros en los últimos 3 días (hoy, ayer, anteayer) en lote activo con más de 3 días desde la llegada
assert.strictEqual(est([]), 'ambar', 'sin registros -> ámbar');
assert.strictEqual(est([reg('alimento', '2026-11-01', { kg: 1 })]), 'verde', 'registro de anteayer basta');
assert.strictEqual(est([reg('alimento', '2026-10-31', { kg: 1 })]), 'ambar', 'registro de hace 3 días ya no basta');
assert.strictEqual(est([reg('alimento', HOY, { kg: 1 }, 'OTRO')]), 'ambar', 'registros de otro lote no cuentan');
assert.strictEqual(est([], [], { ...lote, fechaLlegada: '2026-10-31' }), 'verde', 'llegó hace 3 días -> aún no exige registros');
assert.strictEqual(est([], [], { ...lote, fechaLlegada: '2026-10-30' }), 'ambar', 'llegó hace 4 días -> ámbar');
assert.strictEqual(est([], [], { ...lote, fechaLlegada: HOY }), 'verde', 'lote recién llegado -> verde');
assert.strictEqual(est([], [vac('2026-11-02')], { ...lote, estado: 'cerrado' }), 'verde', 'lote cerrado no exige registros ni vacunas');

// Robustez: genética desconocida, sin aves, listas vacías o ausentes
assert.strictEqual(est([hoyAlimento], [], { ...lote, genetica: 'no-existe' }), 'verde');
assert.strictEqual(c.estadoSanitario({ ...lote, avesInicio: 0 }, [reg('mortalidad', HOY, { cantidad: 1 })], [], HOY), 'verde');
assert.strictEqual(c.estadoSanitario(lote, undefined, undefined, HOY), 'ambar');
