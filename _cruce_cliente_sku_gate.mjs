/* === _cruce_cliente_sku_gate.mjs · E2.t2 y E4.t3: LA BOLETA LLEGA CON CIFRAS (owner 2026-08-12) ===============
 * Los dos turnos que la certificación de f4f2949 midió con la boleta VACÍA, y que por eso ADI contestó
 * declinando. Ninguno de los dos era una limitación del dato:
 *   · E2.t2 «compará estas cuatro cuentas» → `compareEntities` corre de a PARES; el plan le pasó cuatro y el
 *     composer devolvió null por cardinalidad. El eje sí sirve las cuatro por lectura multi-entidad.
 *   · E4.t3 «para esos SKU, qué clientes podrían comprarlos» → `compradoresSku()` existe en la matriz desde el
 *     2026-07-10; no estaba expuesta como tool, así que el planificador no tenía cómo pedirla.
 * ESTE GATE MIDE AGUAS ARRIBA DEL TEXTO: no juzga cómo redacta el narrador —eso sólo lo dice una corrida pagada—
 * sino que EXISTAN `results` y `figs` antes de narrar. Un narrador fiel con la boleta vacía sólo puede declinar;
 * la corrección tiene que estar acá o no está.
 *
 * `node --import ./scripts/offline-guard.mjs _cruce_cliente_sku_gate.mjs`
 */
import { initTenant } from "./src/data/tenantStore.js";
import { TENANT_DEMO } from "./src/data/tenants/demo.js";
import { runPlan } from "./src/adi/oracle/toolRunner.js";
import { SELLOS } from "./src/config/contract/figureType.js";

initTenant(TENANT_DEMO);
let PASS = 0, FAIL = 0;
const ok = (c, m, extra = "") => { if (c) { PASS++; console.log("  ✓ " + m); } else { FAIL++; console.log("  ✗ " + m + (extra ? "\n      " + extra : "")); } };
const h = (t) => console.log(`\n${t}`);
const correr = (tool, args) => runPlan({ intent: "answer", calls: [{ tool, args }] }, { scenario: "actual", maxCalls: 4 });

/* ═══ 1 · E2.t2 · CUATRO CUENTAS ═══════════════════════════════════════════════════════════════════════════════ */
h("1 · E2.t2 · «compará estas cuatro cuentas» — la boleta ya NO llega vacía");
{
  const CUATRO = ["Falabella", "Lider", "Ripley", "Paris"];
  const r = correr("compareEntities", { dimension: "cliente", entities: CUATRO });
  const figs = r.ledger.figs || [];
  ok(figs.length > 0, `hay cifras antes de narrar (${figs.length} figs) — en la certificación fueron 0`);
  ok(CUATRO.every((e) => figs.some((f) => String(f.label || "").startsWith(e))),
    "las CUATRO cuentas tienen cifra propia, no sólo dos");
  const cb = (r.results[0].coverage || {}).cobertura;
  ok(!!cb && cb.pedidas === 4 && cb.resueltas.length === 4 && cb.faltantes.length === 0,
    "la cobertura declara pedidas/resueltas/faltantes", JSON.stringify(cb));
}

/* ═══ 2 · E4.t3 · QUÉ CUENTAS PODRÍAN COMPRAR ESTOS SKU — APAGADA POR DECISIÓN DEL OWNER (2026-09-14) ═══════════════
 * La transpuesta de la matriz existió del 2026-08-12 al 2026-09-14 con sello «indicado». La decisión que la retira,
 * textual: «apaga también `clientesPorSku` mientras sea una matriz estimada. Si más adelante la ingesta trae
 * cliente×SKU real, se vuelve a habilitar desde esa evidencia.» Lo que este gate mide desde hoy es la DECLINACIÓN
 * honesta: sin filas cliente×SKU en el pack la tool no fabrica candidatos, dice por qué y nombra la puerta. */
h("2 · E4.t3 · «para esos SKU, qué clientes» — la afinidad estimada está apagada: declina con la puerta nombrada");
{
  const SKUS = ["SAM-TV55", "LG-WASH11KG"];
  const r = correr("clientesPorSku", { entities: SKUS, topN: 3 });
  const figs = r.ledger.figs || [];
  const c = r.results[0].coverage || {};
  ok(figs.length === 0 && c.supported === false, `no hay cifras: la relación cliente×SKU no está registrada en este archivo (${figs.length} figs)`);
  ok(c.relacion === "afinidad_apagada", "la razón se declara por lo que es: afinidad estimada, apagada", String(c.relacion));
  ok(/no construye una relación que el archivo no demuestra/.test(String(c.reason)) && /filas de venta por cliente y SKU/.test(String(c.reason)),
    "…y nombra la ley y la puerta (las filas cliente×SKU del pack)", String(c.reason).slice(0, 160));
  ok(Array.isArray(c.alternativas) && c.alternativas.length > 0, "…con alternativas que SÍ son dato (venta/contribución de esos SKU, clientes por venta o margen)");
  ok(!figs.some((f) => /inventario|stock|inmovilizado|capital/i.test(String(f.label) + String(f.context))),
    "NINGUNA cifra atribuye inventario, stock ni capital inmovilizado a una cuenta (la decisión 9 sigue cerrada)");
}

/* ═══ 3 · LAS CARAS QUE IMPIDEN CAMBIAR UN DEFECTO POR OTRO ══════════════════════════════════════════════════════ */
h("3 · lo que la tool NO puede hacer");
{
  const vacio = correr("clientesPorSku", { entities: [] });
  ok(vacio.results[0].coverage.supported === false, "sin SKU declina, no inventa un universo");
  const fantasma = correr("clientesPorSku", { entities: ["NO-EXISTE-SKU"], topN: 3 });
  ok(fantasma.results[0].coverage.supported === false, "un SKU inexistente tampoco recibe compradores fabricados");
  /* la puerta, medida en el dato: la relación se enciende solo con filas atómicas cliente×SKU en el pack */
  const { datasetCapability } = await import("./src/adi/sentrix/capability.js");
  ok(datasetCapability().crosses.atomic === false, "el contrato de dataset sigue declarando crosses.atomic === false: la clave real todavía no entra al pack");
}

console.log(`\n── _cruce_cliente_sku_gate: ${PASS} PASS · ${FAIL} FAIL (de ${PASS + FAIL}) ──`);
process.exit(FAIL ? 1 : 0);
