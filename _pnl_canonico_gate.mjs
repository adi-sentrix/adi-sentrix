/* === _pnl_canonico_gate.mjs · LA TOOL CANÓNICA DEL RESULTADO (owner 2026-08-09 · decisión 3 · hallazgo L) ======
 *
 * EL DEFECTO QUE LOCKEA. `composePnl` (pnl.js) emite la cascada sellada del P&L desde hace meses, pero el oráculo
 * —la ruta primaria en producción— no tenía forma de pedírsela: no existía ninguna tool de P&L en el catálogo.
 * Medido sobre el dato real, `detectPnlIntent` (la red del FLUJO GUIADO) devuelve null para «¿cuál es el resultado
 * del negocio después de gastos?», «el estado de resultados», «¿cuánta utilidad deja el negocio?» y hasta «P&L» a
 * secas — y cuando devuelve null, ChatADI le da el turno al oráculo, que contestaba la CONTRIBUCIÓN ($25.0M) como
 * si fuera el resultado ($18.5M). Son DOS NIVELES FINANCIEROS DISTINTOS de la misma cascada: la contribución es lo
 * que queda ANTES de los gastos declarados; el resultado, lo que queda DESPUÉS. Servir una por la otra es dar una
 * cifra REAL a una pregunta que nadie hizo — el peor modo de falla del producto, y el que rompe el límite 4 de
 * Proporcionalidad.
 *
 * QUÉ PRUEBA, en orden:
 *   [1] EL CRITERIO DEL OWNER · «¿Cuál es el resultado del negocio después de gastos?» resuelve a $18.5M, NO a
 *       $25.0M — y la ruta vieja (contributionRead) se muestra al lado para que la diferencia sea visible.
 *   [2] ENVUELVE, NO RECALCULA · la boleta de `pnlRead` es BYTE-IGUAL a la de `composePnl`, y la cascada que
 *       declara en sus facts es la de `buildPnlCascade`. Cero aritmética nueva.
 *   [3] EL LENGUAJE · las cuatro familias que el owner nombró (+ las que el criterio exige) reclaman; 20 turnos
 *       adversariales NO reclaman (incluida «utilidad» en su sentido no financiero).
 *   [4] REGISTRO · la tool existe en TOOLS, tiene contrato, está en el catálogo y en el enum que PLAN puede emitir.
 *   [5] SIN REGRESIÓN · `detectPnlIntent` responde exactamente lo mismo que antes, y una call de tool NUNCA abre
 *       el flujo guiado (el bug que tendría: `composePnl` sin líneas ABRE un draft, y una tool es pura).
 *   [6] EJES · lo que el P&L no puede abrir, lo DECLINA con el motivo declarado (decisión 8) — nunca prorratea.
 *   [7] ESCENARIOS · la cifra se mueve con el escenario (no es scenario-blind) y la cascada CIERRA en cada uno.
 *   [8] COTA · la evidencia sembrada por el manifiesto no crece con el tenant (cota estructural, ver el gate de
 *       escala) — medida con el máximo de líneas de gasto que el contrato admite.
 *
 * CERO RED · CERO LLM · CERO CRÉDITOS. Todo es composer puro + `runPlan` determinístico.
 *   node _pnl_canonico_gate.mjs
 */
import {
  composePnl, buildPnlCascade, setPnlLines, activePnl, clearPnl, resetPnlDraft, pnlDraft,
  detectPnlIntent, detectPnlLectura, pnlOraclePlan, pnlDisponibilidad, pnlEjesDisponibles,
} from "./src/adi/pnl.js";
import { TOOLS } from "./src/adi/oracle/toolRegistry.js";
import { TOOL_CONTRACTS, getToolContract } from "./src/adi/oracle/toolContracts.js";
import { TOOL_CATALOG, PLAN_TOOL } from "./src/adi/oracle/planPrompt.js";
import { runPlan } from "./src/adi/oracle/toolRunner.js";
import { ledgerBoleta } from "./src/adi/oracle/ledger.js";
import { VIEW_MANIFEST } from "./src/adi/sentrix/viewManifest.js";
import { VIEW_EVIDENCE_ROWS_MAX } from "./src/adi/oracle/viewContext.js";
import { initTenant } from "./src/data/tenantStore.js";
import { TENANT_DEMO } from "./src/data/tenants/demo.js";

let PASS = 0, FAIL = 0;
const ok = (c, m, extra = "") => { if (c) { PASS++; console.log("  ✓ " + m); } else { FAIL++; console.log("  ✗ " + m + (extra ? "\n      " + extra : "")); } };
const H = (t) => console.log("\n" + t);

initTenant(TENANT_DEMO);
const SCN = "bonanza";
// Las MISMAS tres líneas con las que `_pnl_gate.mjs` mide la cascada desde siempre — no un set nuevo inventado
// para este gate: si la cuenta cambia, los dos gates se mueven juntos.
const LINEAS = [{ nombre: "Logística", pct: 3 }, { nombre: "Marketing", pct: 1.5 }, { nombre: "Promotores", pct: 2 }];
const sembrar = () => { clearPnl(); resetPnlDraft(); setPnlLines(LINEAS); };
const figDe = (figs, re) => figs.find((f) => re.test(f.label)) || null;

console.log("── LA TOOL CANÓNICA DEL RESULTADO · pnlRead ────────────────────────────────────────────────────────");
console.log(`   tenant demo · escenario ${SCN} · cero red · cero LLM · composer real contra ledger real\n`);

/* ══ [1] EL CRITERIO DEL OWNER ═══════════════════════════════════════════════════════════════════════════════ */
H("[1] EL CRITERIO · «¿Cuál es el resultado del negocio después de gastos?» → el RESULTADO, no la contribución");
{
  sembrar();
  const Q = "¿Cuál es el resultado del negocio después de gastos?";

  // (a) la red del flujo guiado NO lo reclama — por eso el turno llega al oráculo. Es el punto de partida del bug.
  ok(detectPnlIntent(Q) === null, "detectPnlIntent NO reclama esta pregunta (por eso el turno llega al oráculo)");

  // (b) el plan lo resuelve el MOTOR, sin LLM
  const plan = pnlOraclePlan(Q);
  ok(!!plan && plan.calls.length === 1 && plan.calls[0].tool === "pnlRead",
    `el plan determinístico pide pnlRead — ${plan ? plan.calls.map((c) => c.tool).join(",") : "sin plan"}`);
  ok(!!plan && plan.scope.level === "global", "y con alcance GLOBAL: «del negocio» pisa cualquier entidad anterior");

  // (c) LA CIFRA
  const { ledger, results } = runPlan(plan, { scenario: SCN });
  const figs = ledgerBoleta(ledger);
  const resultado = figDe(figs, /^Resultado comercial$/i);
  const contrib = figDe(figs, /^Contribución$/i);
  const c = buildPnlCascade(SCN);
  ok(!!resultado && resultado.value === "$18.5M",
    `la cifra autorizada del RESULTADO es $18.5M (obtuvo ${resultado ? resultado.value : "—"})`);
  ok(!!contrib && contrib.value === "$25.0M",
    `la CONTRIBUCIÓN viaja en la misma boleta pero con SU nombre y SU cifra: $25.0M (obtuvo ${contrib ? contrib.value : "—"})`);
  ok(!!resultado && !!contrib && resultado.value !== contrib.value,
    "y no son la misma cifra — el error que se está cerrando es contestar una por la otra");
  ok(Math.round(c.contribK - c.totalGastosK) === Math.round(c.resultadoK),
    `contribución − gastos declarados = resultado, exacto (${Math.round(c.contribK)} − ${Math.round(c.totalGastosK)} = ${Math.round(c.resultadoK)})`);
  ok(results[0].facts.nivel_respondido === "resultado_final", "la tool DECLARA qué nivel contestó: resultado_final");
  ok(/contribuci[oó]n/i.test(results[0].facts.nota_nivel) && /despu[eé]s/i.test(results[0].facts.nota_nivel),
    "y lleva la distinción de niveles escrita en sus facts (contribución = antes · resultado = después)");

  // (d) la ruta VIEJA, al lado: lo que ADI contestaba antes de esta tool
  const viejo = runPlan({ calls: [{ tool: "contributionRead", args: { dimension: "cliente", focus: "rank" } }] }, { scenario: SCN });
  const vFigs = ledgerBoleta(viejo.ledger);
  const hayResultado = vFigs.some((f) => /resultado/i.test(f.label));
  ok(!hayResultado, "contributionRead NO autoriza ninguna cifra llamada «resultado» — por eso el turno salía mal tipado");
  console.log(`      antes: contributionRead ranquea contribución por cliente · ahora: pnlRead responde ${resultado ? resultado.value : "—"} de resultado`);
}

/* ══ [2] ENVUELVE, NO RECALCULA ══════════════════════════════════════════════════════════════════════════════ */
H("[2] UNA SOLA VERDAD · la boleta de pnlRead es la de composePnl, byte a byte");
{
  sembrar();
  const directo = composePnl({ action: "resultado" }, null, { scenario: SCN });
  sembrar();   // el composer deja `_scope` vivo: se re-siembra para que las dos corridas partan igual
  const viaTool = TOOLS.pnlRead({ scenario: SCN });
  const a = directo.evidence.boleta, b = viaTool.boleta;
  ok(a.length === b.length && a.every((f, i) => f.label === b[i].label && f.value === b[i].value && f.unit === b[i].unit),
    `las ${a.length} cifras de la boleta son idénticas en label, valor y unidad`,
    a.length !== b.length ? `composePnl=${a.length} pnlRead=${b.length}` : "");

  const c = buildPnlCascade(SCN);
  const F = viaTool.facts.cascada;
  const _mk = (vK) => { const v = vK * 1000, x = Math.abs(v), s = v < 0 ? "-" : ""; return x >= 1e6 ? `${s}$${(x / 1e6).toFixed(1)}M` : x >= 1e3 ? `${s}$${Math.round(x / 1e3)}K` : `${s}$${Math.round(x)}`; };
  ok(F.Ingreso === _mk(c.ingresoK) && F.Contribución === _mk(c.contribK) && F["Resultado del negocio"] === _mk(c.resultadoK)
    && F["Margen bruto"] === _mk(c.margenBrutoK) && F["Gastos declarados"] === _mk(c.totalGastosK),
    "los peldaños que declara la tool son los de buildPnlCascade (no una segunda aritmética)",
    JSON.stringify(F));
  ok(Math.round(c.ingresoK - c.costoK - c.cargaK - c.totalGastosK) === Math.round(c.resultadoK),
    "y la cascada CIERRA: ingreso − costo − carga − gastos = resultado");
  ok(viaTool.facts.pnl === true, "declara `pnl:true` → la evidencia abre la cara Resultado de Sentrix (address.js)");
  ok(/a[nñ]o cerrado/i.test(viaTool.facts.periodo), `declara su período: «${viaTool.facts.periodo}»`);
}

/* ══ [3] EL LENGUAJE ═════════════════════════════════════════════════════════════════════════════════════════ */
H("[3] EL LENGUAJE · lo que el owner nombró reclama; lo que se le parece, no");
{
  sembrar();
  const DEBE = [
    "¿Cuál es el resultado del negocio después de gastos?", "¿Cuál es el resultado del negocio?",
    "¿Cuál es el estado de resultados?", "muéstrame el estado de resultados", "estado de pérdidas y ganancias",
    "¿cuánta utilidad deja el negocio?", "¿cuál es la utilidad neta?", "¿cuál es mi utilidad?", "utilidad del ejercicio",
    "¿cuál es el resultado final?", "el resultado operacional", "¿cuál es el resultado de la empresa?",
    "el resultado neto del año", "resultado del ejercicio", "¿cuánto gana el negocio después de gastos?",
    "P&L", "¿cuál es mi P&L?", "el pnl", "¿cuál es la ganancia neta?", "¿cuál es la ganancia del negocio?",
  ];
  const NO_DEBE = [
    "¿cuál es la utilidad de este análisis?", "¿qué utilidad tiene el reporte?", "¿cuál es la utilidad de tener stock de seguridad?",
    "¿qué resultado dio la simulación?", "¿cuál es la contribución del negocio?", "muéstrame el ranking de contribución",
    "¿cuánto vendió Falabella?", "¿cuál es el margen del negocio?", "¿cuál es el capital inmovilizado?",
    "¿y si bajo logística a 2%?", "¿qué pasa si subo el precio 5% a Falabella?", "el resultado de bajar el costo medio un 3%",
    "¿cuánto tengo que vender para ganar $2M después de gastos?", "¿qué nivel de venta necesito para que el resultado sea $20M?",
    "dame el resultado de la comparación entre Falabella y Lider", "¿cómo viene la venta mes a mes?",
    "¿quién tiene la rotación más baja?", "¿cuánto capital tengo detenido en Antofagasta?",
    "¿cuáles son mis mejores clientes?", "hola, ¿cómo estás?",
  ];
  const sinClaim = DEBE.filter((q) => !detectPnlLectura(q));
  ok(!sinClaim.length, `las ${DEBE.length} formas de pedir el resultado reclaman`, sinClaim.join(" · "));
  const falsos = NO_DEBE.filter((q) => detectPnlLectura(q));
  ok(!falsos.length, `y los ${NO_DEBE.length} turnos adversariales NO reclaman (ni una simulación, ni una meta de venta, ni «utilidad» en su sentido no financiero)`, falsos.join(" · "));

  // el ALCANCE, resuelto por el motor
  const gEnt = detectPnlLectura("¿cuánta utilidad deja Falabella después de gastos?");
  ok(!!gEnt && gEnt.focus === "entidad" && gEnt.entity === "Falabella" && gEnt.dimension === "cliente",
    "una entidad nombrada se resuelve contra el canon REAL del P&L (no contra el fraseo)", JSON.stringify(gEnt));
  const gEje = detectPnlLectura("quiero ver el estado de resultados por familia");
  ok(!!gEje && gEje.focus === "eje" && gEje.dimension === "familia", "«por familia» se resuelve como la tabla del eje", JSON.stringify(gEje));
  const gNeg = detectPnlLectura("¿cuál es el resultado del negocio después de gastos?");
  ok(!!gNeg && gNeg.focus === "resultado" && gNeg.entity === null, "«del negocio» fuerza alcance global", JSON.stringify(gNeg));
  ok(DEBE.every((q) => { const p = pnlOraclePlan(q); return p && p.calls[0].tool === "pnlRead" && TOOLS[p.calls[0].tool]; }),
    "y TODAS producen un plan que pide una tool que EXISTE en el registro del oráculo");
}

/* ══ [4] REGISTRO ════════════════════════════════════════════════════════════════════════════════════════════ */
H("[4] REGISTRO · PLAN puede emitirla, y el contrato la declara");
{
  ok(typeof TOOLS.pnlRead === "function", "pnlRead está registrada en TOOLS (toolRegistry.js)");
  const c = getToolContract("pnlRead");
  ok(!!c && c === TOOL_CONTRACTS.pnlRead, "y tiene contrato en TOOL_CONTRACTS");
  ok(!!c && Array.isArray(c.supuestosRequeridos) && c.supuestosRequeridos.length,
    "que declara su supuesto requerido (las líneas de gasto) — es la única tool del catálogo que depende de uno");
  ok(!!c && c.dimensionesSoportadas.every((d) => (pnlEjesDisponibles().some((x) => x.eje === d))),
    "los ejes que declara el contrato son los que el DATO habilita hoy",
    JSON.stringify({ contrato: c && c.dimensionesSoportadas, dato: pnlEjesDisponibles().map((x) => x.eje) }));
  const enumTools = PLAN_TOOL.schema.properties.calls.items.properties.tool.enum;
  ok(enumTools.includes("pnlRead"), "PLAN la puede emitir (está en el enum del schema)");
  ok(/\bpnlRead\b/.test(TOOL_CATALOG), "y está descrita en el catálogo que el LLM lee");
  ok(/contribuci[oó]n/i.test(TOOL_CATALOG.split("\n").find((l) => l.startsWith("pnlRead")) || ""),
    "la descripción le advierte explícitamente que NO conteste el resultado con contributionRead");
  const enRegistro = Object.keys(TOOLS).sort(), enContrato = Object.keys(TOOL_CONTRACTS).sort();
  ok(enRegistro.length === enContrato.length && enRegistro.every((t, i) => t === enContrato[i]),
    `el catálogo y la tabla de contratos siguen cubriéndose exactamente (${enRegistro.length} tools)`);
  // el manifiesto: los dos componentes de la cara Resultado ya no declaran `sinTool`
  for (const id of ["resultado/otro/vista", "resultado/01/cascada"]) {
    const m = VIEW_MANIFEST[id];
    ok(!!m && !m.sinTool && (m.evidencia || []).some((e) => e.tool === "pnlRead"),
      `${id} declara pnlRead como su evidencia (ya no dice que el oráculo no puede contrastarlo)`);
  }
}

/* ══ [5] SIN REGRESIÓN ═══════════════════════════════════════════════════════════════════════════════════════ */
H("[5] SIN REGRESIÓN · el flujo guiado sigue siendo el de siempre");
{
  const REG = [
    ["¿cuál es mi P&L?", "recall"], ["¿cuánto me queda después de gastos?", "resultado"],
    ["¿cuánto deja Falabella después de gastos?", "resultado_entidad"], ["resultado después de gastos por familia", "tabla_eje"],
    ["resultado comercial", "resultado"], ["¿cómo queda mi resultado?", "resultado"],
    ["armemos mi p&l", "start"], ["¿y si bajo logística a 2%?", "simulate_line"], ["cambia logística a 2%", "edit_set"],
    ["olvidá mi p&l", "forget"], ["¿qué línea pesa más en el resultado?", "peso"],
    ["¿cuál es la contribución del negocio?", null], ["¿cuánto vendió Falabella?", null],
  ];
  const malos = [];
  for (const [q, esperado] of REG) {
    sembrar();
    const r = detectPnlIntent(q);
    const got = r ? r.action : null;
    if (got !== esperado) malos.push(`«${q}» → ${got} (esperaba ${esperado})`);
  }
  ok(!malos.length, `detectPnlIntent responde lo mismo que antes en los ${REG.length} turnos del flujo guiado`, malos.join("\n      "));

  // EL BUG QUE NO PUEDE VOLVER: `composePnl` sin líneas ABRE un draft (sinPnl → _draft stage "gastos"). Una tool
  // del oráculo es PURA por contrato: no puede dejar al usuario dentro de un flujo que nadie pidió.
  clearPnl(); resetPnlDraft();
  const sinLineas = TOOLS.pnlRead({ scenario: SCN });
  ok(sinLineas.coverage.supported === false, "sin P&L declarado, pnlRead DECLINA (no estima, no inventa gastos)");
  ok(/contribuci[oó]n/i.test(sinLineas.coverage.reason), "y su motivo dice hasta dónde SÍ llega la cuenta (la contribución)");
  ok(pnlDraft() === null, "y NO abrió el flujo guiado — la tool no deja estado conversacional");
  ok(sinLineas.boleta.length === 0, "sin cifras autorizadas: nada que el narrador pueda afirmar");
  // contraprueba: la ruta conversacional SÍ lo abre (es su trabajo, y sigue haciéndolo)
  clearPnl(); resetPnlDraft();
  composePnl({ action: "resultado" }, null, { scenario: SCN });
  ok(pnlDraft() !== null, "contraprueba: la ruta conversacional sí abre el flujo guiado — esa capacidad no se tocó");
  resetPnlDraft();
}

/* ══ [6] EJES ════════════════════════════════════════════════════════════════════════════════════════════════ */
H("[6] EJES · lo que el P&L no puede abrir lo DECLINA con el motivo declarado (decisión 8)");
{
  sembrar();
  const noDisponibles = pnlDisponibilidad().filter((d) => !d.available);
  ok(noDisponibles.length > 0, `el dato deja ${noDisponibles.length} ejes fuera del P&L: ${noDisponibles.map((d) => d.eje).join(", ")}`);
  const malos = [];
  for (const d of noDisponibles) {
    const r = TOOLS.pnlRead({ dimension: d.eje, scenario: SCN });
    if (r.coverage.supported !== false) malos.push(`${d.eje} devolvió supported:true`);
    else if (!String(r.coverage.reason).includes(d.motivo)) malos.push(`${d.eje} declinó sin el motivo declarado`);
    else if (!r.boleta.length === false) malos.push(`${d.eje} devolvió cifras pese a declinar`);
  }
  ok(!malos.length, "cada uno declina con SU motivo del contrato, y sin una sola cifra", malos.join(" · "));
  const disp = pnlEjesDisponibles();
  const rotos = disp.filter((d) => !TOOLS.pnlRead({ dimension: d.eje, scenario: SCN }).coverage.supported).map((d) => d.eje);
  ok(!rotos.length, `y los ${disp.length} ejes que SÍ están disponibles responden (${disp.map((d) => d.eje).join(", ")})`, rotos.join(", "));
  // el eje que sí abre tiene que CERRAR contra el negocio: Σ entidades == resultado del negocio
  for (const d of disp) {
    const c = buildPnlCascade(SCN, null, { dimension: d.eje });
    const suma = c.porEntidad.reduce((a, x) => a + x.resultadoK, 0);
    ok(Math.abs(suma - c.resultadoK) < 0.5, `Σ resultado por ${d.eje} == resultado del negocio (${Math.round(suma)} vs ${Math.round(c.resultadoK)})`);
  }
  const inexistente = TOOLS.pnlRead({ dimension: "planeta", scenario: SCN });
  ok(inexistente.coverage.supported === false, "un eje inventado también declina, nunca cae al negocio en silencio");
  const fantasma = TOOLS.pnlRead({ entity: "Cliente Que No Existe", scenario: SCN });
  ok(fantasma.coverage.supported === false && !fantasma.boleta.length, "una entidad inexistente declina sin cifras");
}

/* ══ [7] ESCENARIOS ══════════════════════════════════════════════════════════════════════════════════════════ */
H("[7] ESCENARIOS · la cifra se mueve con el dato y la cascada cierra en los tres");
{
  const vistos = new Set();
  for (const scn of ["bonanza", "tension", "crisis"]) {
    sembrar();
    const r = TOOLS.pnlRead({ scenario: scn });
    const f = figDe(r.boleta, /^Resultado comercial$/i);
    vistos.add(f && f.value);
    const c = buildPnlCascade(scn);
    ok(Math.round(c.ingresoK - c.costoK - c.cargaK - c.totalGastosK) === Math.round(c.resultadoK),
      `[${scn}] la cascada cierra exacto — resultado ${f ? f.value : "—"}`);
  }
  ok(vistos.size === 3, `la cifra del resultado es DISTINTA en los tres escenarios (${[...vistos].join(" · ")}) — la tool no es scenario-blind`);
}

/* ══ [8] COTA ════════════════════════════════════════════════════════════════════════════════════════════════ */
H("[8] COTA · la evidencia sembrada por el manifiesto no crece con el tenant");
{
  // el MÁXIMO que el contrato del P&L admite: 10 líneas de gasto (setPnlLines corta ahí).
  clearPnl(); resetPnlDraft();
  const diez = Array.from({ length: 12 }, (_, i) => ({ nombre: `Línea ${i + 1}`, pct: 1 }));
  setPnlLines(diez);
  const topeLineas = activePnl().length;
  ok(topeLineas === 10, `el contrato del P&L topea las líneas declaradas en 10 (se pidieron 12, quedaron ${topeLineas})`);
  const r = TOOLS.pnlRead({ scenario: SCN });
  ok(r.coverage.supported && r.boleta.length <= VIEW_EVIDENCE_ROWS_MAX,
    `con el máximo de líneas que el contrato admite, la boleta son ${r.boleta.length} cifras (tope de siembra ${VIEW_EVIDENCE_ROWS_MAX})`);
  sembrar();
  const base = TOOLS.pnlRead({ scenario: SCN });
  const porLinea = (r.boleta.length - base.boleta.length) / (topeLineas - LINEAS.length);
  ok(porLinea <= 3.01,
    `cada línea declarada agrega ${porLinea.toFixed(1)} cifras (${base.boleta.length} con ${LINEAS.length} líneas → ${r.boleta.length} con ${topeLineas}): la evidencia crece con el SUPUESTO del usuario, nunca con el tamaño del tenant`);
  const seed = (VIEW_MANIFEST["resultado/01/cascada"].evidencia || [])[0];
  ok(!!seed && !seed.args.dimension, "la siembra del manifiesto pide el NEGOCIO (sin `dimension`) — el alcance de cota fija");
}

sembrar();
console.log(`\n──────────────────────────────────────────────────────────────────────────────────────────────────`);
console.log(`\n${FAIL ? "✗" : "✓"} P&L CANÓNICO · ${PASS} pasaron · ${FAIL} fallaron`);
if (FAIL) process.exitCode = 1;
