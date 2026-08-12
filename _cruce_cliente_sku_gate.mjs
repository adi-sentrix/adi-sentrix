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

/* ═══ 2 · E4.t3 · QUÉ CUENTAS PODRÍAN COMPRAR ESTOS SKU ════════════════════════════════════════════════════════ */
h("2 · E4.t3 · «para esos SKU, qué clientes» — la transpuesta de la matriz, sellada");
{
  const SKUS = ["SAM-TV55", "LG-WASH11KG"];
  const r = correr("clientesPorSku", { entities: SKUS, topN: 3 });
  const figs = r.ledger.figs || [];
  const F = r.results[0].facts || {};
  ok(figs.length > 0, `hay cifras antes de narrar (${figs.length} figs) — en la certificación fueron 0`);
  ok(SKUS.every((s) => figs.some((f) => String(f.label || "").endsWith(s))),
    "los DOS SKU traen sus cuentas asociadas", figs.map((f) => f.label).join(" · "));

  // LA DECISIÓN DEL OWNER, VERIFICADA EN EL DATO Y NO EN UN COMENTARIO: «inferencia autorizada, estatus INDICADO».
  ok(F.estatus === "indicado", `el turno se declara INDICADO, no probado`, String(F.estatus));
  ok(figs.every((f) => f.tipo && f.tipo.sello === "indicado"),
    "y CADA fig lleva el sello `indicado` — la gradación viaja con la cifra, no en una advertencia suelta",
    [...new Set(figs.map((f) => f.tipo && f.tipo.sello))].join(","));
  ok(SELLOS.includes("indicado"), "el sello es del vocabulario declarado del contrato, no una etiqueta inventada acá");

  // LA SEPARACIÓN QUE LA PREGUNTA PIDIÓ LITERALMENTE («separa lo probado de la afinidad indicada»).
  ok(typeof F.lo_probado === "string" && F.lo_probado.length > 0, "declara QUÉ está probado");
  ok(typeof F.lo_indicado === "string" && /estimaci[oó]n de afinidad/i.test(F.lo_indicado),
    "…y QUÉ es afinidad estimada, con esas palabras", String(F.lo_indicado));
  ok(F.relacion === "afinidad_modelada",
    "la relación se nombra por lo que es, nunca como compra observada", String(F.relacion));

  // LA MITAD QUE IMPIDE REABRIR LA DECISIÓN 9: ni un peso de INVENTARIO colgado del nombre de una cuenta.
  ok(/venta|contribuci[oó]n/i.test(F.metrica || ""), "la métrica es de FLUJO (venta/contribución)", String(F.metrica));
  ok(figs.every((f) => /afinidad de surtido/i.test(String(f.context || ""))),
    "cada cifra declara en su contexto que es asociación por afinidad");
  ok(!figs.some((f) => /inventario|stock|inmovilizado|capital/i.test(String(f.label) + String(f.context))),
    "NINGUNA cifra atribuye inventario, stock ni capital inmovilizado a una cuenta");
}

/* ═══ 3 · LAS CARAS QUE IMPIDEN CAMBIAR UN DEFECTO POR OTRO ════════════════════════════════════════════════════ */
h("3 · lo que la tool NO puede hacer");
{
  const vacio = correr("clientesPorSku", { entities: [] });
  ok(vacio.results[0].coverage.supported === false, "sin SKU declina, no inventa un universo");

  const fantasma = correr("clientesPorSku", { entities: ["NO-EXISTE-SKU"], topN: 3 });
  const c = fantasma.results[0].coverage;
  ok(c.supported === false && (c.cobertura.faltantes || []).includes("NO-EXISTE-SKU"),
    "un SKU inexistente se declara FALTANTE — la matriz no le fabrica compradores", JSON.stringify(c.cobertura));

  const mixto = correr("clientesPorSku", { entities: ["SAM-TV55", "NO-EXISTE-SKU"], topN: 2 });
  const cm = mixto.results[0].coverage;
  ok(cm.supported === true && cm.cobertura.resueltos.length === 1 && cm.cobertura.faltantes.length === 1,
    "cobertura PARCIAL: responde por el que existe y declara el que no", JSON.stringify(cm.cobertura));
}

console.log(`\n── _cruce_cliente_sku_gate: ${PASS} PASS · ${FAIL} FAIL (de ${PASS + FAIL}) ──`);
process.exit(FAIL ? 1 : 0);
