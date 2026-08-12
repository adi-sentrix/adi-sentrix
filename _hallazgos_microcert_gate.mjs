/* === _hallazgos_microcert_gate.mjs · LOS TRES HALLAZGOS DE LA MICRO-CERTIFICACIÓN (owner 2026-08-12) ==========
 * Los tres salieron de texto REAL del proveedor, no de hipótesis:
 *   M1  · `clientesPorSku` devolvió 20 figs selladas `indicado` y la respuesta las narró como compra observada
 *         («dado su gran volumen de compra», «Lider es la cuenta predominante», «reforzar la relación comercial»),
 *         sin decir en ningún lado que la relación es estimada — y la pregunta pedía separar probado de indicado.
 *   A3  · «Sumá las dos y decime el total del negocio» → ADI no cruzó universos, pero tampoco declinó: se fue a
 *         hablar de capital por bodega. El chequeo «no emite total consolidado» pasó EN VACÍO.
 *   PIE · el cuerpo decía «foto de inventario a hoy» y el pie estampaba «(Datos del año cerrado.)»: cada pieza
 *         correcta por separado, el conjunto contradictorio.
 *
 * @inyeccion-simulada · `callPlan`/`callNarrate` se inyectan a mano. No importa el gateway ni `src/ui/`, no hay
 * `fetch`: no existe camino a la red, y el candado de runtime lo verifica igual.
 *
 * `node --import ./scripts/offline-guard.mjs _hallazgos_microcert_gate.mjs`
 */
import { initTenant } from "./src/data/tenantStore.js";
import { TENANT_DEMO } from "./src/data/tenants/demo.js";
import { guardC, ensurePeriodoDeclared } from "./src/adi/oracle/guardC.js";
import { componerPorForma } from "./src/adi/oracle/narrationBlocks.js";
import { ensureDeclinacionDeSuma } from "./src/adi/oracle/answerViaOracle.js";
import { runPlan } from "./src/adi/oracle/toolRunner.js";

initTenant(TENANT_DEMO);
let PASS = 0, FAIL = 0;
const ok = (c, m, extra = "") => { if (c) { PASS++; console.log("  ✓ " + m); } else { FAIL++; console.log("  ✗ " + m + (extra ? "\n      " + extra : "")); } };
const h = (t) => console.log(`\n${t}`);

/* ═══ 1 · M1 · LA AFINIDAD `indicado` LLEGA AL TEXTO ══════════════════════════════════════════════════════════ */
h("1 · M1 · una relación estimada no se narra como historial de compra");
{
  const r = runPlan({ intent: "answer", calls: [{ tool: "clientesPorSku", args: { entities: ["SAM-TV55", "LG-WASH11KG"], topN: 3 } }] }, { scenario: "actual", maxCalls: 4 });
  const figs = r.ledger.figs || [];
  const ctx = { ledger: r.ledger, results: r.results, trace: null, question: "Para esos SKU, ¿qué clientes podrían comprarlos? Separá lo probado de la afinidad indicada.", mechanismMemory: {}, sealedOrders: [] };
  ok(figs.length > 0 && figs.every((f) => f.tipo.sello === "indicado"), `la boleta trae ${figs.length} figs, todas \`indicado\``);

  // EL TEXTO REAL DE LA CORRIDA, recortado a las frases que el owner nombró. Antes pasaba el muro entero.
  const COMO_SALIO = "Para el SAM-TV55, las cuentas con participación alta son Falabella, Paris y Ripley. Te sugiero comenzar por reforzar la relación comercial con Falabella, dado su gran volumen de compra. En LG-WASH11KG, Lider es la cuenta predominante.";
  const g = guardC(COMO_SALIO, ctx);
  ok(!g.ok, "el texto que salió en vivo AHORA se bloquea", (g.violations || []).map((v) => v.kind).join(",") || "(pasó)");
  const detalles = (g.violations || []).map((v) => String(v.detail || "")).join(" | ");
  ok(/volumen de compras?/i.test(detalles), "…y el veredicto NOMBRA la frase que afirma la compra", detalles.slice(0, 140));

  // las tres frases que el owner listó, una por una — cada una sola tiene que bastar para bloquear.
  for (const frase of ["Falabella muestra un gran volumen de compra en este SKU.", "Lider es la cuenta predominante.", "Conviene reforzar la relación comercial con Paris."]) {
    ok(!guardC(frase, ctx).ok, `«${frase.slice(0, 46)}…» se bloquea sola`);
  }
  // y la que falta aunque no haya ninguna frase de compra: el silencio sobre el estatus también es una falta.
  ok(!guardC("Falabella encabeza con 46.3% y Paris sigue con 15.0%.", ctx).ok,
    "un texto sin frases de compra pero que NO declara la estimación también se bloquea");

  // LA OTRA CARA · lo correcto tiene que pasar, o el muro sólo sabría decir que no.
  const BIEN = "Son cuentas candidatas por afinidad de surtido, no compras registradas: el dato no registra qué SKU se le vendió a cada cuenta. Para SAM-TV55 los principales candidatos son Falabella y Paris.";
  ok(guardC(BIEN, ctx).ok, "una redacción que declara la afinidad estimada PASA", (guardC(BIEN, ctx).violations || []).map((v) => v.kind).join(","));

  // y el fallback determinístico también, porque la regla no distingue quién redactó.
  for (const forma of ["prosa", "tabla", "auto", "solo_conclusion"]) {
    const t = componerPorForma({ figs, contentScope: "full", forma });
    ok(guardC(t, ctx).ok, `el fallback en forma «${forma}» pasa su propio muro`, (guardC(t, ctx).violations || []).map((v) => v.kind).join(","));
    ok(/afinidad|estimad|candidat/i.test(t), `…y declara la estimación en «${forma}»`, t.slice(0, 90));
  }
}

/* ═══ 2 · A3 · DECLINAR LA SUMA ES RESPONDER, NO CAMBIAR DE TEMA ══════════════════════════════════════════════ */
h("2 · A3 · ante «sumá las dos», se declina explícito — no se salta a otro tema");
{
  const FIGS = [
    { label: "Ventas del año", value: "$99.9M", raw: 99900000, tipo: { universo: "venta_comercial", sello: "probado", periodo: "anual" } },
    { label: "Capital detenido", value: "$33K", raw: 33000, tipo: { universo: "inventario", sello: "probado", periodo: "hoy" } },
  ];
  const Q = "Sumá las dos y decime el total del negocio.";
  // EL TEXTO REAL DE LA CORRIDA: se fue a capital por bodega sin decir que no sumaba.
  const COMO_SALIO = "Valparaíso y Antofagasta suman $33K de capital detenido, en la foto de inventario a hoy.";
  const out = ensureDeclinacionDeSuma(COMO_SALIO, FIGS, Q);
  ok(out !== COMO_SALIO, "la respuesta que cambiaba de tema ahora lleva la declinación");
  ok(/^No las sumo/.test(out), "…y va PRIMERO: es la respuesta al pedido, no una nota al pie", out.slice(0, 60));
  ok(/universos distintos/.test(out), "…nombrando que son universos distintos", out.split("\n")[0]);
  ok(/stock a hoy/.test(out) && /flujo del per[ií]odo/.test(out),
    "…y POR QUÉ: una es stock a hoy y la otra flujo del período", out.split("\n")[0]);
  ok(!/\$/.test(out.split("\n")[0]), "la línea agregada no emite ninguna cifra", out.split("\n")[0]);
  ok(out.includes(COMO_SALIO), "…y no borra lo que el narrador ya había dicho");

  // LAS CARAS QUE IMPIDEN QUE MOLESTE
  ok(ensureDeclinacionDeSuma("El total del negocio es $99.9M.", [FIGS[0]], Q) === "El total del negocio es $99.9M.",
    "con un solo universo NO se entromete: sumar dentro del mismo universo es legítimo");
  const yaDijo = "No las sumo porque son universos distintos: una es flujo y la otra stock.";
  ok(ensureDeclinacionDeSuma(yaDijo, FIGS, Q) === yaDijo, "si el narrador YA declinó, no se le pisa la redacción");
  const otraPregunta = "¿Cómo viene Falabella?";
  ok(ensureDeclinacionDeSuma(COMO_SALIO, FIGS, otraPregunta) === COMO_SALIO,
    "sin pedido de suma no agrega nada, aunque haya dos universos en la boleta");
}

/* ═══ 3 · PIE TEMPORAL COHERENTE ══════════════════════════════════════════════════════════════════════════════ */
h("3 · PIE · con dos marcos se declara la mezcla, no la familia que faltaba");
{
  // EL CASO MEDIDO: el cuerpo ya decía «a hoy», así que el pie agregaba sólo «Datos del año cerrado» y el conjunto
  // se contradecía.
  const CUERPO = "Valparaíso y Antofagasta suman $33K de capital detenido, en la foto de inventario a hoy.";
  const con2 = ensurePeriodoDeclared(CUERPO, ["anual", "hoy"]);
  ok(/dos marcos distintos/i.test(con2), "con DOS familias el pie declara la mezcla", con2.slice(-120));
  ok(!/\(Datos del año cerrado\.\)\s*$/.test(con2),
    "…y ya NO cierra con «Datos del año cerrado» sobre un cuerpo que habla de hoy", con2.slice(-90));
  ok(/venta es del año cerrado/i.test(con2) && /inventario es la foto a hoy/i.test(con2),
    "…diciendo cuál es cuál, no sólo que son dos", con2.slice(-120));

  // LO QUE NO CAMBIA: con UNA sola familia, el pie de siempre, byte por byte.
  const soloAnual = ensurePeriodoDeclared("La venta llega a $99.9M.", ["anual"]);
  ok(/\(Datos del año cerrado\.\)$/.test(soloAnual), "con una sola familia, el pie de siempre", soloAnual);
  const soloHoy = ensurePeriodoDeclared("El capital detenido es $33K.", ["hoy"]);
  ok(/\(Foto de inventario a hoy\.\)$/.test(soloHoy), "…y el de inventario también", soloHoy);
  const yaDeclarado = "La venta del año cerrado llega a $99.9M.";
  ok(ensurePeriodoDeclared(yaDeclarado, ["anual"]) === yaDeclarado, "si el cuerpo ya lo declara, no se agrega nada");
  // no se duplica si ya está la mezcla
  ok(ensurePeriodoDeclared(con2, ["anual", "hoy"]) === con2, "y la mezcla no se estampa dos veces");
}

console.log(`\n── _hallazgos_microcert_gate: ${PASS} PASS · ${FAIL} FAIL (de ${PASS + FAIL}) ──`);
process.exit(FAIL ? 1 : 0);
