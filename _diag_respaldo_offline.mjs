/* === _diag_respaldo_offline.mjs · QUÉ COMPONE EL RESPALDO, ANTES Y DESPUÉS (owner 2026-08-14) ==================
 * EL RESPALDO es el texto que arma el motor cuando el narrador libre agota sus intentos o el muro lo veta. Dejó de
 * ser un caso raro: seguirá disparando ante un corte de red, un veto real o los reintentos agotados — y su texto
 * es lo que ve un directorio. Este probe lo fuerza OFFLINE (el narrador inyectado devuelve un borrador con dos
 * cifras que no están en ninguna boleta, así que el muro lo veta con certeza) y muestra el resultado.
 *
 * EL ANTES está RECORDADO, no recalculado: es el texto medido en `dev`=8373074 con este mismo probe, pegado abajo
 * verbatim. No es una copia de la lógica vieja (eso se pudre): es el registro de una medición. El DESPUÉS se
 * compone en vivo con el código de este árbol, así que la comparación envejece del lado correcto — si alguien
 * rompe la composición, el DESPUÉS cambia y el ANTES sigue diciendo de dónde veníamos.
 *
 * CERO RED. `node _diag_respaldo_offline.mjs`
 */
import { answerViaOracle } from "./src/adi/oracle/answerViaOracle.js";
import { componerPorForma } from "./src/adi/oracle/narrationBlocks.js";
import { initTenant } from "./src/data/tenantStore.js";
import { TENANT_DEMO } from "./src/data/tenants/demo.js";
initTenant(TENANT_DEMO);

const BORRADOR_VETADO = "Falabella vendió $77.7M con un margen de 99.9% y eso explica todo.";

const FAMILIAS = [
  {
    id: "1 · LA PREGUNTA DEL OWNER",
    q: "¿Qué clientes venden mucho pero dejan poco margen?",
    plan: { intent: "answer", mode: "default", calls: [{ tool: "marginRead", args: {} }] },
    antes: [
      "| Entidad | Margen |",
      "|---|---:|",
      "| Lider | 21.5% |",
      "| Falabella | 22.0% |",
      "| Sodimac | 23.5% |",
      "| Jumbo | 24.0% |",
      "| Ripley | 25.0% |",
      "| Paris | 26.5% |",
      "| Tottus | 28.0% |",
      "| Mercado Libre | 29.0% |",
      "| ABC | 31.0% |",
      "| Easy | 32.0% |",
      "| Unimarc | 32.5% |",
      "| Hites | 33.0% |",
      "",
      "El resto de lo autorizado en este turno: Medida · cerrar brecha al piso: $4.9M · Falabella · Valor en juego: $1.6M · Benchmark de margen: 30.1% · clientes bajo el benchmark: 8 · Margen promedio: 25.1% · Lider · Venta: $17.9M. El dato disponible no aísla la causa — para cerrarla falta evidencia que este turno no trae.",
      "",
      "Por dónde partir: Lider · Margen, que es la métrica por la que preguntaste. (Datos del año cerrado.)",
    ].join("\n"),
    quejas: [
      "una sola columna: la venta estaba en la boleta del mismo turno y no aparecía",
      "doce clientes, incluidos los que están POR ENCIMA del benchmark de 30.1%",
      "«lo autorizado en este turno» y «la métrica por la que preguntaste»: el motor hablando de su maquinaria",
      "«Entidad» como encabezado del eje",
      "sin apertura de lectura y sin el monto en juego, que es con lo que decide un directorio",
    ],
  },
  {
    id: "2 · CAPITAL POR BODEGA",
    q: "¿Cuánto capital tengo inmovilizado por bodega?",
    plan: { intent: "answer", mode: "default", calls: [{ tool: "inventoryStatus", args: {} }] },
    antes: [
      "Valparaíso · Capital detenido marca $25K (inventario, hoy).",
      "",
      "El resto de lo autorizado en este turno: Capital inmovilizado · total: $33K · Valparaíso · % del total: 75% · Antofagasta · Capital detenido: $8K · Antofagasta · % del total: 25% · Materiales de Construcción · Familia: $20K · Línea Blanca · Familia: $14K. El dato disponible no aísla la causa — para cerrarla falta evidencia que este turno no trae.",
      "",
      "Por dónde partir: Valparaíso · Capital detenido, que es la magnitud mayor de las autorizadas.",
    ].join("\n"),
    quejas: ["vocabulario de máquina en las dos líneas de cierre"],
  },
  {
    id: "3 · ENTIDAD PUNTUAL",
    q: "¿Cómo viene Falabella?",
    plan: { intent: "answer", mode: "default", scope: { level: "entity", entities: ["Falabella"] }, calls: [{ tool: "entityProfile", args: { dimension: "cliente", entity: "Falabella" } }] },
    antes: [
      "Sobre Falabella: Falabella · Ventas marca $19.4M (venta comercial, anual).",
      "",
      "El resto de lo autorizado en este turno: Falabella · Margen: 22% · Falabella · Contribución: $4.3M · Falabella · Costo: $15.2M · Falabella · Acciones comerciales: $874K · Falabella · Carga comercial: 4.5% · Benchmark de margen: 30.1%. El dato disponible no aísla la causa — para cerrarla falta evidencia que este turno no trae.",
      "",
      "Por dónde partir: Falabella · Ventas, que es la magnitud mayor de las autorizadas. (Datos del año cerrado.)",
    ].join("\n"),
    quejas: ["vocabulario de máquina; una sola entidad no tiene eje que tabular y eso está bien"],
  },
  {
    id: "4 · EJE SIN SEGUNDA MÉTRICA",
    q: "¿Cuál es la rotación por SKU?",
    plan: { intent: "answer", mode: "default", calls: [{ tool: "gridTable", args: { dimension: "sku", metric: "rotacion" } }] },
    antes: [
      "| Sku | Rotación |",
      "|---|---:|",
      "| SAM-TV55 | 3.6x |   (…doce filas…)",
      "",
      "El resto de lo autorizado en este turno: SAM-TV55 · Valor de inventario: $13K · SAM-TV55 · Unidades en stock: 18 · … El dato disponible no aísla la causa — para cerrarla falta evidencia que este turno no trae.",
      "",
      "Por dónde partir: SAM-TV55 · Rotación, que es la métrica por la que preguntaste.",
    ].join("\n"),
    quejas: [
      "«Sku» con la caja del token interno, no como lo escribe el producto",
      "trece SKU en el dato y doce en la tabla, sin declarar cuál quedó afuera",
      "una línea de volcado con métricas que la pregunta no pidió",
    ],
  },
  {
    id: "5 · UNA CUENTA DENTRO DEL EJE",
    q: "¿Cuál es el margen de Sodimac?",
    plan: { intent: "answer", mode: "default", scope: { level: "entity", entities: ["Sodimac"] }, calls: [{ tool: "queryMetric", args: { dimension: "cliente", entity: "Sodimac", metric: "margen" } }] },
    antes: [
      "Sobre Sodimac: Sodimac · Margen marca 23.5% (venta comercial, anual).",
      "",
      "El resto de lo autorizado en este turno: Sodimac · Ventas: $8.2M · … El dato disponible no aísla la causa — para cerrarla falta evidencia que este turno no trae.",
      "",
      "Por dónde partir: Sodimac · Margen, que es la métrica por la que preguntaste. (Datos del año cerrado.)",
    ].join("\n"),
    quejas: ["vocabulario de máquina"],
  },
];

let figsOwner = [];
for (const f of FAMILIAS) {
  const out = await answerViaOracle({
    text: f.q, history: [], mem: {}, scenario: "actual",
    callPlan: async () => f.plan,
    callNarrate: async (a) => { if (f.id.startsWith("1")) figsOwner = (a && a.ledgerFigs) || []; return BORRADOR_VETADO; },
  });
  console.log(`\n\n╔══════════════════════════════════════════════════════════════════════════════════════════════`);
  console.log(`║ ${f.id} — «${f.q}»`);
  console.log(`╚══════════════════════════════════════════════════════════════════════════════════════════════`);
  console.log(`\n──── ANTES (medido en dev 8373074) ────`);
  console.log(f.antes);
  console.log(`\n   lo que estaba mal:`);
  for (const q of f.quejas) console.log(`     · ${q}`);
  console.log(`\n──── DESPUÉS (compuesto en vivo por este árbol) ────`);
  console.log(String((out && out.r && out.r.text) || "(NULL — el motor se quedó sin texto)"));
}

console.log(`\n\n╔══════════════════════════════════════════════════════════════════════════════════════════════`);
console.log(`║ 6 · BOLETA POBRE — dos figs de una boleta real, compositor directo`);
console.log(`╚══════════════════════════════════════════════════════════════════════════════════════════════`);
console.log(`\n   sin eje que tabular, la composición NO promete una tabla: degrada a la prosa de tres actos.`);
console.log(componerPorForma({ figs: figsOwner.slice(0, 2), contentScope: "full", forma: "auto", metricaLabels: ["Ventas", "Margen"] }) || "(NULL)");

console.log(`\n\n──── LA BOLETA DEL TURNO 1, para verificar que ninguna cifra es nueva ────`);
for (const f of figsOwner) console.log(`  ${f.label} = ${f.value}`);
