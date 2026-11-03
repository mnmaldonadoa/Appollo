/* =========================================================================
   APPOLLO · Base de datos técnica (funciona sin internet)
   Valores de referencia tomados de las guías de manejo de cada genética.
   Para actualizar una genética, edita solo este archivo.
   ========================================================================= */

const GENETICAS = [
  /* ----------------------------- POSTURA ----------------------------- */
  {
    id: 'hyline-brown', nombre: 'Hy-Line Brown', tipo: 'postura', rasgo: 'Huevo marrón',
    origen: 'Hy-Line International',
    desc: 'La ponedora marrón más difundida en granjas comerciales. Dócil, persistente y de cáscara fuerte.',
    datos: [['Pico', '95–97 %'], ['Huevos/ave a 90 sem', '415–434'], ['50 % de postura', '144 días'], ['Consumo', '≈110 g/día']],
    postura: { w50: 20.6, pico: 95.7, k: 1.15, plat: 33, dec: 0.26, m: 0.0008, cons: 110, ew0: 54.5, ewMax: 65.0, ewc: 0.095, fin: 80 },
    cria: { factor: 1.0, viab: 98, peso17: 1.58 },
    campo: 0.96,
    fuente: 'Hy-Line Brown, estándares internacionales de rendimiento (2024)'
  },
  {
    id: 'lohmann-brown', nombre: 'Lohmann Brown-Classic', tipo: 'postura', rasgo: 'Huevo marrón',
    origen: 'Lohmann Breeders',
    desc: 'Robusta y de huevo grande; muy usada en jaula y en piso. Buena conversión y cáscara resistente.',
    datos: [['Pico', '94–96 %'], ['Huevos/ave a 80 sem', '≈367'], ['50 % de postura', '140–145 días'], ['Consumo', '115–125 g/día']],
    postura: { w50: 20.4, pico: 95.0, k: 1.15, plat: 35, dec: 0.30, m: 0.00085, cons: 118, ew0: 55.0, ewMax: 65.6, ewc: 0.09, fin: 80 },
    cria: { factor: 1.0, viab: 98.5, peso17: 1.42 },
    campo: 0.96,
    fuente: 'Lohmann Brown-Classic, datos de rendimiento en jaula (2021)'
  },
  {
    id: 'isa-brown', nombre: 'ISA Brown', tipo: 'postura', rasgo: 'Huevo marrón',
    origen: 'Hendrix Genetics',
    desc: 'Ponedora eficiente y adaptable; buena opción para granjas medianas y sistemas en piso.',
    datos: [['Pico', '96 %'], ['Huevos/ave a 90 sem', '≈420'], ['50 % de postura', '144 días'], ['Consumo', '≈111 g/día']],
    postura: { w50: 20.6, pico: 96.0, k: 1.15, plat: 33, dec: 0.27, m: 0.00086, cons: 111, ew0: 53.5, ewMax: 64.4, ewc: 0.09, fin: 80 },
    cria: { factor: 1.0, viab: 98, peso17: 1.45 },
    campo: 0.96,
    fuente: 'ISA Brown, guía de producto en jaula (Hendrix Genetics)'
  },
  {
    id: 'hisex-brown', nombre: 'Hisex Brown', tipo: 'postura', rasgo: 'Huevo marrón',
    origen: 'Hendrix Genetics',
    desc: 'Ponedora marrón de tamaño medio, tranquila y con buena calidad interna del huevo.',
    datos: [['Pico', '96 %'], ['Huevos/ave a 90 sem', '≈408'], ['50 % de postura', '143 días'], ['Consumo', '≈112 g/día']],
    postura: { w50: 20.4, pico: 96.0, k: 1.15, plat: 30, dec: 0.34, m: 0.00086, cons: 112, ew0: 53.5, ewMax: 64.1, ewc: 0.09, fin: 80 },
    cria: { factor: 1.0, viab: 98, peso17: 1.45 },
    campo: 0.96,
    fuente: 'Hisex Brown, guía comercial (Hendrix Genetics)'
  },
  {
    id: 'lohmann-lsl', nombre: 'Lohmann LSL-Classic', tipo: 'postura', rasgo: 'Huevo blanco',
    origen: 'Lohmann Breeders',
    desc: 'Ponedora blanca liviana; come menos por huevo y tiene muy buena persistencia. Más nerviosa que las marrones.',
    datos: [['Pico', '94–96 %'], ['Huevos/ave a 80 sem', '≈371'], ['50 % de postura', '140–145 días'], ['Consumo', '≈106 g/día']],
    postura: { w50: 20.4, pico: 95.7, k: 1.15, plat: 35, dec: 0.30, m: 0.00085, cons: 106, ew0: 53.0, ewMax: 63.8, ewc: 0.085, fin: 80 },
    cria: { factor: 0.94, viab: 98.5, peso17: 1.23 },
    campo: 0.96,
    fuente: 'Lohmann LSL-Classic, datos de rendimiento (2021)'
  },

  /* ------------------------------ CARNE ------------------------------ */
  {
    id: 'cobb500', nombre: 'Cobb 500', tipo: 'carne', rasgo: 'Pollo de engorde',
    origen: 'Cobb-Vantress',
    desc: 'El pollo de engorde más usado en el país. Crecimiento muy rápido y excelente conversión.',
    datos: [['Peso a 42 días', '≈3,28 kg'], ['Conversión a 42 d', '1,56'], ['Peso a 35 días', '≈2,52 kg'], ['Rendimiento canal', '≈75 %']],
    carne: {
      dias: [0, 7, 10, 14, 18, 21, 28, 35, 42, 49, 56],
      peso: [42, 202, 330, 570, 864, 1116, 1783, 2521, 3278, 4001, 4641],
      ca: [0, 0.891, 0.952, 1.029, 1.116, 1.182, 1.322, 1.441, 1.555, 1.686, 1.842],
      venta: 42, rango: [28, 56], mortBase: 3.5, ciclo: 42, rend: 74
    },
    campo: 0.95,
    fuente: 'Cobb500, suplemento de rendimiento y nutrición (2022), mixto'
  },
  {
    id: 'ross308', nombre: 'Ross 308', tipo: 'carne', rasgo: 'Pollo de engorde',
    origen: 'Aviagen',
    desc: 'Pollo de engorde de alto rendimiento de pechuga; resistente y uniforme.',
    datos: [['Peso a 42 días', '≈3,00 kg'], ['Conversión a 42 d', '1,53'], ['Peso a 35 días', '≈2,30 kg'], ['Rendimiento canal', '≈74 %']],
    carne: {
      dias: [0, 7, 10, 14, 18, 21, 28, 35, 42, 49, 56],
      peso: [44, 213, 330, 533, 789, 1017, 1636, 2296, 2998, 3682, 4318],
      ca: [0, 0.780, 0.900, 1.005, 1.086, 1.135, 1.265, 1.399, 1.531, 1.662, 1.793],
      venta: 42, rango: [28, 56], mortBase: 3.5, ciclo: 42, rend: 74
    },
    campo: 0.95,
    fuente: 'Ross 308, objetivos de rendimiento (Aviagen, 2022), mixto'
  },
  {
    id: 'campero', nombre: 'Pollo campero', tipo: 'carne', rasgo: 'Crecimiento lento',
    origen: 'Líneas de color (tipo Sasso, Redbro, Kabir)',
    desc: 'Pollo de color para semipastoreo. Crece más lento, es rústico y su carne es más firme; se paga mejor.',
    datos: [['Peso a 70 días', '≈2,1–2,2 kg'], ['Conversión a 70 d', '≈2,8'], ['Sistema', 'Semipastoreo'], ['Rendimiento canal', '≈70 %']],
    carne: {
      dias: [0, 7, 14, 21, 28, 35, 42, 49, 56, 63, 70, 77, 84, 91],
      peso: [40, 110, 230, 400, 620, 870, 1150, 1420, 1680, 1920, 2150, 2360, 2550, 2720],
      ca: [0, 1.2, 1.5, 1.7, 1.9, 2.05, 2.2, 2.35, 2.5, 2.65, 2.8, 2.95, 3.1, 3.25],
      venta: 70, rango: [56, 91], mortBase: 4, ciclo: 70, rend: 70
    },
    campo: 0.97,
    fuente: 'Valores medios de líneas camperas de crecimiento lento (referencial)'
  },

  /* ------------------------- DOBLE PROPÓSITO ------------------------- */
  {
    id: 'rhode-island', nombre: 'Rhode Island Red', tipo: 'doble', rasgo: 'Huevo marrón y carne',
    origen: 'Raza estadounidense',
    desc: 'Rústica y buena ponedora para traspatio y pastoreo. Los gallos se aprovechan para carne.',
    datos: [['Huevos/año', '200–250'], ['Pico', '≈80 %'], ['Gallo adulto', '3,5–3,9 kg'], ['Inicio de postura', '22–24 sem']],
    postura: { w50: 24, pico: 79, k: 0.8, plat: 30, dec: 0.5, m: 0.0012, cons: 120, ew0: 48, ewMax: 60, ewc: 0.07, fin: 72 },
    cria: { factor: 1.08, viab: 96, peso17: 1.7 },
    carne: {
      dias: [0, 14, 28, 42, 56, 70, 84, 98, 112, 126, 140, 154, 168],
      peso: [40, 140, 370, 640, 950, 1280, 1620, 1950, 2250, 2520, 2750, 2950, 3100],
      ca: [0, 1.6, 1.9, 2.2, 2.5, 2.75, 3.0, 3.25, 3.5, 3.75, 4.0, 4.25, 4.5],
      venta: 112, rango: [84, 168], mortBase: 5, ciclo: 112, rend: 68
    },
    campo: 0.98,
    fuente: 'Valores medios de la raza en sistemas semiintensivos (referencial)'
  },
  {
    id: 'plymouth-rock', nombre: 'Plymouth Rock Barrada', tipo: 'doble', rasgo: 'Huevo marrón y carne',
    origen: 'Raza estadounidense',
    desc: 'Gallina “jabada” tranquila y resistente al frío; buena para pastoreo en zonas altas.',
    datos: [['Huevos/año', '180–220'], ['Pico', '≈75 %'], ['Gallo adulto', '3,4–4,0 kg'], ['Inicio de postura', '22–25 sem']],
    postura: { w50: 24.5, pico: 75, k: 0.8, plat: 30, dec: 0.5, m: 0.0012, cons: 124, ew0: 48, ewMax: 59, ewc: 0.07, fin: 72 },
    cria: { factor: 1.1, viab: 96, peso17: 1.8 },
    carne: {
      dias: [0, 14, 28, 42, 56, 70, 84, 98, 112, 126, 140, 154, 168],
      peso: [40, 145, 380, 660, 980, 1320, 1670, 2010, 2320, 2600, 2840, 3040, 3200],
      ca: [0, 1.6, 1.9, 2.2, 2.5, 2.75, 3.0, 3.25, 3.5, 3.75, 4.0, 4.25, 4.5],
      venta: 112, rango: [84, 168], mortBase: 5, ciclo: 112, rend: 68
    },
    campo: 0.98,
    fuente: 'Valores medios de la raza en sistemas semiintensivos (referencial)'
  },

  /* ----------------------------- CRIOLLA ----------------------------- */
  {
    id: 'criolla', nombre: 'Gallina criolla', tipo: 'criolla', rasgo: 'Campesina · traspatio',
    origen: 'Población local',
    desc: 'Muy rústica y adaptada a cada zona; huevo pequeño y de yema intensa. Rinde mucho más con vacunas y buena comida.',
    datos: [['Huevos/año', '60–150'], ['Peso del huevo', '50–55 g'], ['Gallina adulta', '2,0–2,5 kg'], ['Gallo adulto', '2,8–3,2 kg']],
    postura: { w50: 25, pico: 48, k: 0.6, plat: 30, dec: 0.38, m: 0.0018, cons: 95, ew0: 44, ewMax: 54, ewc: 0.06, fin: 72 },
    cria: { factor: 0.9, viab: 92, peso17: 1.4 },
    carne: {
      dias: [0, 14, 28, 42, 56, 70, 84, 98, 112, 126, 140, 154, 168, 182],
      peso: [35, 110, 250, 430, 650, 880, 1100, 1310, 1500, 1680, 1850, 2000, 2150, 2280],
      ca: [0, 1.8, 2.2, 2.6, 3.0, 3.3, 3.6, 3.9, 4.2, 4.5, 4.8, 5.0, 5.3, 5.6],
      venta: 140, rango: [98, 182], mortBase: 8, ciclo: 140, rend: 65
    },
    campo: 1.0,
    fuente: 'Estudios de caracterización de gallina criolla en Ecuador (referencial)'
  }
];

const TIPOS = {
  postura: { nombre: 'Postura', corto: 'Postura' },
  carne: { nombre: 'Carne', corto: 'Carne' },
  doble: { nombre: 'Doble propósito', corto: 'Doble propósito' },
  criolla: { nombre: 'Criolla', corto: 'Criolla' }
};

/* Consumo de alimento en recría de ponedoras (g/ave/día por semana 1–18),
   escalado por genética con cria.factor */
const CONSUMO_RECRIA = [14, 17, 23, 27, 34, 38, 41, 45, 49, 52, 55, 58, 62, 66, 70, 73, 77, 82];

/* --------------------------- VACUNACIÓN --------------------------- */
/* d = día de aplicación, w = peso del riesgo si no se aplica */
const VACUNAS = {
  postura: [
    { id: 'v_marek', d: 1, n: 'Marek', via: 'Subcutánea, en la incubadora', w: 2 },
    { id: 'v_nb1', d: 7, n: 'Newcastle + Bronquitis', via: 'Gota ocular o agua de bebida', w: 2.5 },
    { id: 'v_gum1', d: 12, n: 'Gumboro (1.ª dosis)', via: 'Agua de bebida', w: 1.5 },
    { id: 'v_gum2', d: 21, n: 'Gumboro (2.ª) + Newcastle', via: 'Agua de bebida', w: 1.5 },
    { id: 'v_nb2', d: 35, n: 'Newcastle + Bronquitis (refuerzo)', via: 'Agua, ocular o aspersión', w: 2 },
    { id: 'v_vir', d: 49, n: 'Viruela aviar', via: 'Punción en la membrana del ala', w: 1.2 },
    { id: 'v_cor1', d: 63, n: 'Coriza infecciosa (1.ª dosis)', via: 'Inyectada (intramuscular o subcutánea)', w: 1.2 },
    { id: 'v_ea', d: 77, n: 'Encefalomielitis aviar + Newcastle', via: 'Agua de bebida o ala', w: 1 },
    { id: 'v_cor2', d: 105, n: 'Coriza infecciosa (2.ª dosis)', via: 'Inyectada', w: 1 },
    { id: 'v_oleo', d: 112, n: 'Newcastle + Bronquitis + EDS (oleosa)', via: 'Inyectada, antes de la postura', w: 2.5 },
    { id: 'v_ref', d: 140, n: 'Refuerzo de Newcastle cada 8–10 semanas', via: 'Agua o aspersión, durante la postura', w: 2, repite: true }
  ],
  criolla: [
    { id: 'v_marek', d: 1, n: 'Marek (si el pollito viene de incubadora)', via: 'Subcutánea', w: 1 },
    { id: 'v_nd1', d: 7, n: 'Newcastle', via: 'Gota ocular o agua de bebida', w: 3 },
    { id: 'v_gum1', d: 14, n: 'Gumboro', via: 'Agua de bebida', w: 1.5 },
    { id: 'v_nb', d: 21, n: 'Newcastle + Bronquitis', via: 'Agua de bebida', w: 2 },
    { id: 'v_vir', d: 42, n: 'Viruela aviar', via: 'Punción en el ala', w: 1.5 },
    { id: 'v_nd2', d: 56, n: 'Newcastle (refuerzo)', via: 'Agua de bebida', w: 2 },
    { id: 'v_ref', d: 140, n: 'Refuerzo de Newcastle cada 3 meses', via: 'Agua de bebida', w: 2, repite: true }
  ],
  carne: [
    { id: 'b_inc', d: 1, n: 'Newcastle + Bronquitis y Gumboro vectorial', via: 'En la incubadora (aspersión e inyección)', w: 2 },
    { id: 'b_nb', d: 8, n: 'Newcastle + Bronquitis', via: 'Gota ocular o agua de bebida', w: 2.5 },
    { id: 'b_gum', d: 14, n: 'Gumboro', via: 'Agua de bebida', w: 2 },
    { id: 'b_nd', d: 21, n: 'Newcastle (refuerzo)', via: 'Agua de bebida', w: 2 }
  ],
  campero: [
    { id: 'b_inc', d: 1, n: 'Newcastle + Bronquitis y Gumboro vectorial', via: 'En la incubadora', w: 2 },
    { id: 'b_nb', d: 8, n: 'Newcastle + Bronquitis', via: 'Gota ocular o agua de bebida', w: 2.5 },
    { id: 'b_gum', d: 14, n: 'Gumboro', via: 'Agua de bebida', w: 2 },
    { id: 'b_nd', d: 21, n: 'Newcastle (refuerzo)', via: 'Agua de bebida', w: 2 },
    { id: 'b_vir', d: 35, n: 'Viruela aviar', via: 'Punción en el ala', w: 1.2 },
    { id: 'b_nd2', d: 49, n: 'Newcastle (2.º refuerzo, pastoreo)', via: 'Agua de bebida', w: 1.5 }
  ]
};

/* ---------------------- PROBLEMAS SANITARIOS ---------------------- */
/* prod = % de producción que se pierde sin tratar, mort = puntos de mortalidad extra.
   mit = fracción de la pérdida que se recupera con esa medida. */
const ENFERMEDADES = [
  {
    id: 'coccidiosis', n: 'Coccidiosis', modos: ['huevos', 'carne'],
    signos: 'Diarrea con sangre o moco, aves erizadas y sin apetito. Frecuente en piso con cama húmeda entre las 2 y 6 semanas.',
    prod: 15, mort: 4,
    caseros: [
      { id: 'h_oreg', n: 'Orégano en el agua', det: 'Infusión de 5 g de hoja seca por litro, colada y fría, durante 5 días.', ev: 'Evidencia moderada para el aceite esencial de orégano; la infusión casera es más débil.', mit: 0.2 },
      { id: 'h_vin', n: 'Vinagre de manzana', det: '5 ml por litro de agua, 3 a 5 días. No usar en bebederos metálicos.', ev: 'Evidencia limitada: acidifica el agua.', mit: 0.08 },
      { id: 'h_cama', n: 'Cambiar la cama húmeda', det: 'Retirar las zonas apelmazadas y añadir viruta o cascarilla de arroz seca.', ev: 'Medida de manejo con efecto comprobado.', mit: 0.3 }
    ],
    quimicos: [
      { id: 'q_amp', n: 'Amprolio 20 %', det: '125–250 mg de amprolio por litro de agua (≈0,6–1,2 g de producto/L) durante 5–7 días.', retiro: 'Revisar la etiqueta; varias presentaciones se permiten en postura.', mit: 0.75 },
      { id: 'q_tol', n: 'Toltrazuril 2,5 %', det: '7 mg/kg de peso al día, 2 días seguidos (≈1 ml de producto por litro de agua durante 48 h).', retiro: 'Retiro en carne según la etiqueta. No usar en gallinas que producen huevo para consumo.', mit: 0.85, noPostura: true }
    ]
  },
  {
    id: 'respiratoria', n: 'Respiratoria crónica (Mycoplasma)', modos: ['huevos', 'carne'],
    signos: 'Estornudos, ronquidos, secreción nasal y ojos llorosos. Empeora con amoníaco, polvo y frío.',
    prod: 10, mort: 3,
    caseros: [
      { id: 'h_ajo', n: 'Ajo machacado en el agua', det: '2 o 3 dientes por litro, renovar a diario, 5 a 7 días.', ev: 'Evidencia limitada; apoyo, no tratamiento.', mit: 0.08 },
      { id: 'h_vent', n: 'Ventilar y bajar el amoníaco', det: 'Abrir cortinas en horas templadas y retirar la cama mojada. Si el olor pica los ojos, hay exceso de amoníaco.', ev: 'Medida de manejo con efecto comprobado.', mit: 0.25 }
    ],
    quimicos: [
      { id: 'q_til', n: 'Tilosina soluble', det: '0,5 g de tilosina por litro de agua durante 3–5 días.', retiro: 'Revisar retiro de carne y huevo en la etiqueta.', mit: 0.7 },
      { id: 'q_dox', n: 'Doxiciclina', det: '10–20 mg/kg de peso al día en el agua, 3–5 días.', retiro: 'Retiro en carne según etiqueta; consultar su uso en postura.', mit: 0.7 },
      { id: 'q_enr', n: 'Enrofloxacina', det: '10 mg/kg de peso al día, 3–5 días.', retiro: 'No usar en gallinas en postura. Antibiótico de importancia crítica: solo con diagnóstico y receta.', mit: 0.75, noPostura: true }
    ]
  },
  {
    id: 'coriza', n: 'Coriza infecciosa', modos: ['huevos'],
    signos: 'Cara e infraorbitarios hinchados, secreción nasal de mal olor y caída brusca de la postura.',
    prod: 20, mort: 2,
    caseros: [
      { id: 'h_aislar', n: 'Aislar aves enfermas y limpiar narinas', det: 'Separar las aves con síntomas y limpiar con agua hervida tibia.', ev: 'Reduce el contagio; no cura.', mit: 0.15 },
      { id: 'h_ajo', n: 'Ajo machacado en el agua', det: '2 o 3 dientes por litro, renovar a diario.', ev: 'Evidencia limitada.', mit: 0.05 }
    ],
    quimicos: [
      { id: 'q_sulfa', n: 'Sulfa + trimetoprim', det: '25–30 mg/kg de peso al día (combinación) durante 5 días.', retiro: 'Según etiqueta; muchas presentaciones no se permiten en postura.', mit: 0.7 },
      { id: 'q_otc', n: 'Oxitetraciclina', det: '25–50 mg/kg de peso al día durante 5 días.', retiro: 'Según etiqueta para carne y huevo.', mit: 0.6 }
    ],
    nota: 'Se previene con la vacuna de coriza a las 8–10 y 14–16 semanas.'
  },
  {
    id: 'parasitos', n: 'Parásitos internos (lombrices)', modos: ['huevos', 'carne'],
    signos: 'Plumas opacas, adelgazamiento, diarrea y lombrices en las heces. Frecuente en aves de piso y pastoreo.',
    prod: 6, mort: 0.5,
    caseros: [
      { id: 'h_zapallo', n: 'Semillas de zapallo molidas', det: 'Un puñado por cada 10 aves mezclado en el alimento, 3 días.', ev: 'Evidencia limitada.', mit: 0.12 },
      { id: 'h_rotar', n: 'Rotar el área de pastoreo', det: 'Dejar descansar el potrero 3–4 semanas para cortar el ciclo del parásito.', ev: 'Medida de manejo con efecto comprobado.', mit: 0.2 }
    ],
    quimicos: [
      { id: 'q_flub', n: 'Flubendazol', det: '30 ppm en el alimento (30 g de principio activo por tonelada) durante 7 días.', retiro: 'Varias marcas lo permiten en postura sin retiro de huevo; confirmar en la etiqueta.', mit: 0.85 },
      { id: 'q_lev', n: 'Levamisol', det: '20–30 mg/kg de peso, dosis única en el agua; repetir a los 21 días si hay reinfestación.', retiro: 'Retiro según etiqueta.', mit: 0.75 },
      { id: 'q_pip', n: 'Piperazina', det: '100–200 mg/kg de peso, dosis única. Solo actúa contra áscaris.', retiro: 'Retiro según etiqueta.', mit: 0.55 }
    ]
  },
  {
    id: 'ectoparasitos', n: 'Piojos y ácaros', modos: ['huevos', 'carne'],
    signos: 'Aves que se picotean, plumas rotas, cresta pálida; ácaros rojos en perchas y nidos por la noche.',
    prod: 5, mort: 0.5,
    caseros: [
      { id: 'h_polvo', n: 'Baño de polvo con ceniza', det: 'Cajón con tierra fina y ceniza de madera fría (2:1); se puede añadir tierra de diatomeas.', ev: 'Evidencia moderada; las aves lo usan solas.', mit: 0.3 },
      { id: 'h_nidos', n: 'Limpiar perchas y nidos', det: 'Lavar con agua caliente y cambiar el material de nido; ruda o eucalipto en los nidos como repelente.', ev: 'La limpieza funciona; las hierbas tienen evidencia limitada.', mit: 0.2 }
    ],
    quimicos: [
      { id: 'q_perm', n: 'Permetrina (polvo o aspersión)', det: 'Aplicar en aves, perchas y nidos según la etiqueta; repetir a los 7–10 días para cortar el ciclo.', retiro: 'Usar productos registrados para aves; revisar el retiro de huevo.', mit: 0.8 },
      { id: 'q_flur', n: 'Fluralaner en el agua (ácaro rojo)', det: 'Dos tomas con 7 días de intervalo, con receta veterinaria.', retiro: 'Confirmar el registro local y el retiro.', mit: 0.85 }
    ]
  },
  {
    id: 'colibacilosis', n: 'Diarrea bacteriana (colibacilosis)', modos: ['huevos', 'carne'],
    signos: 'Diarrea, aves decaídas, ombligos inflamados en pollitos y aumento de la mortalidad.',
    prod: 8, mort: 3,
    caseros: [
      { id: 'h_agua', n: 'Revisar y clorar el agua', det: 'Lavar tanques y bebederos; 2–3 ppm de cloro libre en el agua.', ev: 'Medida de manejo con efecto comprobado.', mit: 0.25 },
      { id: 'h_vin', n: 'Vinagre de manzana', det: '5 ml por litro de agua, 3 a 5 días.', ev: 'Evidencia limitada.', mit: 0.05 }
    ],
    quimicos: [
      { id: 'q_amox', n: 'Amoxicilina', det: '15–20 mg/kg de peso al día durante 3–5 días.', retiro: 'Según etiqueta; consultar su uso en postura.', mit: 0.7 },
      { id: 'q_sulfa', n: 'Sulfa + trimetoprim', det: '25–30 mg/kg de peso al día durante 5 días.', retiro: 'Según etiqueta.', mit: 0.65 }
    ]
  },
  {
    id: 'calor', n: 'Estrés por calor', modos: ['huevos', 'carne'],
    signos: 'Jadeo, alas abiertas, baja de consumo. Más grave en pollos grandes y en zonas cálidas.',
    prod: 10, mort: 2,
    caseros: [
      { id: 'h_sombra', n: 'Agua fresca y sombra', det: 'Bebederos a la sombra, cambiar el agua en horas de calor y mojar el techo.', ev: 'Medida de manejo con efecto comprobado.', mit: 0.35 },
      { id: 'h_ayuno', n: 'Retirar el alimento en el pico de calor', det: 'Retirar 4–6 horas al mediodía y darlo en las horas frescas.', ev: 'Medida de manejo con efecto comprobado en pollos de engorde.', mit: 0.2, solo: 'carne' }
    ],
    quimicos: [
      { id: 'q_elec', n: 'Electrolitos + vitamina C', det: 'En el agua según la etiqueta del producto, durante los días calurosos.', retiro: 'Sin retiro.', mit: 0.4 }
    ]
  },
  {
    id: 'viruela', n: 'Viruela aviar', modos: ['huevos', 'carne'],
    signos: 'Costras en cresta, barbillas y párpados; la forma húmeda forma placas en la boca.',
    prod: 10, mort: 2,
    caseros: [
      { id: 'h_yodo', n: 'Aislar y curar costras con yodo', det: 'Aplicar povidona yodada diluida sobre las lesiones.', ev: 'Evita infecciones secundarias; no cura.', mit: 0.15 },
      { id: 'h_mosq', n: 'Controlar mosquitos', det: 'Eliminar charcos y recipientes con agua estancada cerca del galpón.', ev: 'Medida comprobada: el mosquito transmite el virus.', mit: 0.15 }
    ],
    quimicos: [
      { id: 'q_vacem', n: 'Vacunación de emergencia del resto del lote', det: 'Punción en el ala a las aves sanas, con indicación veterinaria.', retiro: 'Sin retiro.', mit: 0.6 }
    ]
  },
  {
    id: 'ascitis', n: 'Ascitis (mal de altura)', modos: ['carne'],
    signos: 'Abdomen con líquido, cresta morada y jadeo. Típica de pollos de engorde sobre los 2.000 m.',
    prod: 5, mort: 6,
    caseros: [
      { id: 'h_ventasc', n: 'Ventilar sin enfriar', det: 'Renovar el aire evitando corrientes frías sobre las aves.', ev: 'Medida de manejo con efecto comprobado.', mit: 0.2 }
    ],
    quimicos: [
      { id: 'q_vitce', n: 'Vitaminas C y E en el agua', det: 'Según la etiqueta del producto.', retiro: 'Sin retiro.', mit: 0.15 }
    ],
    nota: 'No tiene cura. Se previene con restricción de alimento entre los días 7 y 21, alimento en harina y buena ventilación.'
  },
  {
    id: 'newcastle', n: 'Sospecha de Newcastle o influenza aviar', modos: ['huevos', 'carne'],
    signos: 'Muerte súbita de muchas aves, cuello torcido, parálisis, diarrea verde y caída total de la postura.',
    prod: 40, mort: 30, caseros: [], quimicos: [],
    alerta: 'Es una enfermedad de notificación obligatoria. No mueva ni venda aves ni huevos y avise de inmediato a Agrocalidad y a su médico veterinario.'
  }
];

const PREVENTIVOS_CASEROS = [
  { id: 'p_ajo', n: 'Ajo en el agua, 2 días por semana', det: '2 dientes machacados por litro, renovar a diario.', ev: 'Evidencia limitada.', prod: 0.5 },
  { id: 'p_oreg', n: 'Orégano en el agua', det: 'Infusión de 3–5 g de hoja seca por litro, 3 días al mes.', ev: 'Evidencia moderada para el aceite esencial.', prod: 0.5 },
  { id: 'p_vin', n: 'Vinagre de manzana', det: '5 ml por litro, 2 días por semana. No en bebederos metálicos.', ev: 'Evidencia limitada.', prod: 0.3 }
];
