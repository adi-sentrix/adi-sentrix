/* === _binding_guard_gate.mjs · CONTRATO v2 · FASE 2 (owner 2026-08-07) ==============================
 * El guard deja de atar solo `unit:value` y pasa a atar el BINDING entidad:métrica:período:unidad:valor.
 * Se certifica con CASOS DE ACEPTACIÓN (prosa realista), nunca con regex frase por frase:
 *   [A] LEGÍTIMO — narraciones correctas que DEBEN pasar (protege contra falsos positivos, que son el riesgo
 *       real de subir un aviso a bloqueo: un muro de más degrada respuestas buenas).
 *   [B] MÉTRICA MAL ATRIBUIDA — cifra REAL bajo otra métrica → debe BLOQUEAR.
 *   [C] ENTIDAD MAL ATRIBUIDA — cifra REAL colgada de otra entidad → debe BLOQUEAR (antes era aviso).
 *   [D] PERÍODO CONTRADICTORIO — afirma otro alcance temporal → debe BLOQUEAR (antes solo se appendeaba).
 *   [E] NO REGRESIÓN — el muro numérico de siempre sigue igual de firme.
 * Cero red, cero LLM. `node _binding_guard_gate.mjs`
 */
import { guardC } from "./src/adi/oracle/guardC.js";
import { fig } from "./src/adi/boleta.js";
/* EL NEGOCIO SE DECLARA ACÁ (moneda · owner 2026-08-27). Este gate no cargaba ninguno porque no le hacía
 * falta: `fig()` formateaba con un «$» escrito a mano. Ahora el símbolo sale de la moneda que el negocio
 * declara, así que sin negocio cargado la boleta escribe sin símbolo y deja de coincidir con el texto de
 * prueba. Es la misma migración que forzó la vía 1 cuando el store dejó de traer un dataset por defecto:
 * lo que antes se heredaba en silencio, ahora se declara. */
import { initTenant } from "./src/data/tenantStore.js";
import { TENANT_DEMO } from "./src/data/tenants/demo.js";
initTenant(TENANT_DEMO);

let PASS = 0, FAIL = 0;
const ok = (c, m, extra = "") => { if (c) { PASS++; console.log("  ✓ " + m); } else { FAIL++; console.log("  ✗ " + m + (extra ? "\n      " + extra : "")); } };
const H = (t) => console.log("\n" + t);

// ── LEDGER REALISTA (el turno de perfil de Falabella que venimos usando toda la sesión) ──
const LEDGER = { figs: [
  fig("Falabella · Ventas", "$19.4M", { unit: "money", raw: 19433000 }),
  fig("Falabella · Margen", "22%", { unit: "pct", raw: 22 }),
  fig("Falabella · Contribución", "$4.3M", { unit: "money", raw: 4275000 }),
  fig("Falabella · Carga comercial", "4.5%", { unit: "pct", raw: 4.5 }),
  fig("Falabella · exceso de acciones comerciales", "$194K", { unit: "money", raw: 194330 }),
  fig("Falabella · capital detenido en su mix · subtotal", "$33K", { unit: "money", raw: 33200 }),
  fig("Benchmark de margen", "30.1%", { unit: "pct", raw: 30.1 }),
  fig("Lider · Ventas", "$17.8M", { unit: "money", raw: 17800000 }),
  fig("Lider · Margen", "21.5%", { unit: "pct", raw: 21.5 }),
] };
// los results declaran AMBAS entidades (así _entityNames las conoce — es lo que hace un turno real de comparación).
const RESULTS = [{ tool: "entityProfile", coverage: { supported: true }, facts: {
  periodo: "año cerrado", entityType: "cliente", entidad: "Falabella",
  rows: [{ nombre: "Falabella" }, { nombre: "Lider" }],
} }];
const run = (n) => guardC(n, { ledger: LEDGER, results: RESULTS, question: "perfil de Falabella" });
const kinds = (r) => (r.violations || []).map((v) => v.kind);
const tiene = (r, k) => kinds(r).includes(k);

H("[A] LEGÍTIMO · prosa correcta NO puede bloquearse (control de falsos positivos)");
{
  const casos = [
    ["lectura natural del producto", "Falabella vende $19.4M, con margen 22% — 8.1 puntos bajo tu benchmark de 30.1%. (Datos del año cerrado.)"],
    ["cifra con su métrica pegada", "La contribución de Falabella es $4.3M en el año cerrado."],
    ["dos métricas en la misma oración (ambiguo → no se juzga)", "Falabella deja $4.3M de contribución sobre $19.4M de ventas. (Datos del año cerrado.)"],
    ["palanca cuantificada correcta", "Cerrar el exceso de acciones comerciales libera $194K — hoy la carga comercial es 4.5%. (Datos del año cerrado.)"],
    ["capital con su dueño correcto", "De los productos que le vendés a Falabella, $33K están detenidos en tu inventario. (Datos del año cerrado.)"],
    ["comparación entre dos clientes", "Falabella vende $19.4M y Lider $17.8M; sus márgenes son 22% y 21.5%. (Datos del año cerrado.)"],
    ["mención de mes DENTRO del período (no es re-declaración)", "El mejor mes es diciembre. Falabella vende $19.4M en el año cerrado."],
  ];
  for (const [nombre, texto] of casos) {
    const r = run(texto);
    ok(r.ok, `${nombre}: pasa`, r.ok ? "" : `bloqueó con: ${JSON.stringify(kinds(r))} · ${JSON.stringify((r.violations||[]).map(v=>v.detail))}`);
  }
}

H("[B] MÉTRICA MAL ATRIBUIDA · cifra real bajo otra métrica → BLOQUEA");
{
  const r1 = run("Falabella tiene $4.3M en ventas este año. (Datos del año cerrado.)");
  ok(tiene(r1, "metrica-mal-atribuida"), "«$4.3M en ventas» (es contribución) → bloquea", JSON.stringify(kinds(r1)));
  const r2 = run("Falabella aporta $194K de contribución. (Datos del año cerrado.)");
  ok(tiene(r2, "metrica-mal-atribuida"), "«$194K de contribución» (es exceso de acciones comerciales) → bloquea", JSON.stringify(kinds(r2)));
  // el reverso del criterio conservador: si la MISMA oración nombra las dos métricas, no se juzga (ambiguo).
  // Es un falso negativo DELIBERADO — un bloqueo de más degrada respuestas correctas, que es lo que este muro evita.
  const r2b = run("El exceso de acciones comerciales de Falabella deja una contribución de $194K. (Datos del año cerrado.)");
  ok(!tiene(r2b, "metrica-mal-atribuida"), "dos métricas en la misma oración → NO se juzga (falso negativo deliberado)", JSON.stringify(kinds(r2b)));
  const r3 = run("Falabella tiene un margen de 4.5%. (Datos del año cerrado.)");
  ok(tiene(r3, "metrica-mal-atribuida"), "«margen de 4.5%» (4.5% es carga comercial) → bloquea", JSON.stringify(kinds(r3)));
}

/* ═══ [B2] CIFRA + DUEÑO + SIGNIFICADO (ley del owner 2026-09-12) ═══════════════════════════════════════════
 * «Una cifra correcta con significado equivocado sigue siendo una respuesta falsa.» Medido en su batería compuesta:
 * el panel de ventas vs año anterior etiquetaba su variación % como «% del total» (una participación) y el modelo
 * la narraba como crecimiento — cifra real, dueño real, significado a merced del rótulo. Tres cierres, con lo que
 * existía: la tabla de métricas conoce «participación» y «variación/crecimiento»; el rótulo del panel dice lo que
 * la cifra ES; y con dos métricas en la ventana, las menciones tomadas por otra cifra no compiten (antes: «ambiguo
 * → no se juzga», que dejaba pasar justo la frase mezclada). Fuera a propósito: «sube/baja/cae» y los verbos
 * «pesa/concentra/representa» — con ellos, 18 gates de la casa en rojo. */
H("[B2] CIFRA + DUEÑO + SIGNIFICADO · una participación no se narra como crecimiento, ni al revés");
{
  const LED2 = { figs: [
    fig("Mercado Libre · Variación vs año anterior", "25.3%", { unit: "pct", raw: 25.3 }),
    fig("Mercado Libre · Carga comercial", "1.8%", { unit: "pct", raw: 1.8 }),
    fig("Lider · % del total", "14.9%", { unit: "pct", raw: 14.9 }),
    fig("Lider · YoY", "$2.3M", { unit: "money", raw: 2300000 }),
    fig("Ventas del período", "$99.9M", { unit: "money", raw: 99900000 }),
  ] };
  const RES2 = [{ tool: "salesRead", coverage: { supported: true }, facts: { rows: [{ nombre: "Mercado Libre" }, { nombre: "Lider" }] } }];
  const run2 = (n) => guardC(n, { ledger: LED2, results: RES2, question: "cómo va el negocio" });
  ok(!tiene(run2("Mercado Libre: crece 25.3%."), "metrica-mal-atribuida"), "la variación narrada como crecimiento PASA (es lo que la cifra es)");
  ok(tiene(run2("Mercado Libre pesa 25.3% del total."), "metrica-mal-atribuida"), "★★ la MISMA cifra narrada como participación («25.3% del total») → BLOQUEA");
  ok(tiene(run2("Lider crece 14.9%."), "metrica-mal-atribuida"), "★★ una participación («Lider · % del total») narrada como crecimiento → BLOQUEA");
  ok(!tiene(run2("Lider pesa 14.9% del total."), "metrica-mal-atribuida"), "…y narrada como participación PASA");
  ok(tiene(run2("Lider vende $2.3M."), "metrica-mal-atribuida"), "★ la variación en $ («Lider · YoY») narrada como venta → BLOQUEA");
  ok(!tiene(run2("Lider creció $2.3M contra el año anterior."), "metrica-mal-atribuida"), "…y narrada como variación PASA");
  /* la ventana mezclada: la mención tomada por OTRA cifra no compite — antes, «ambiguo → no se juzga» */
  const LED3 = { figs: [fig("Mercado Libre · % del total", "25.3%", { unit: "pct", raw: 25.3 }), fig("Mercado Libre · Carga comercial", "1.8%", { unit: "pct", raw: 1.8 })] };
  const run3 = (n) => guardC(n, { ledger: LED3, results: RES2, question: "" });
  ok(tiene(run3("Mercado Libre: crece 25.3% con solo 1.8% de carga comercial."), "metrica-mal-atribuida"),
    "★★ «crece 25.3% con solo 1.8% de carga comercial» — «carga comercial» es de 1.8%, la única mención libre de 25.3% es «crece» → BLOQUEA");
  ok(!tiene(run3("Mercado Libre pesa 25.3% del total con solo 1.8% de carga comercial."), "metrica-mal-atribuida"), "…y con el significado correcto, la misma ventana mezclada PASA");
  /* lo que sigue pasando: los pisos de la casa y el corpus (verbos ambiguos fuera del vocabulario) */
  ok(!tiene(run("Falabella concentra $4.3M de contribución y pesa en la cartera. (Datos del año cerrado.)"), "metrica-mal-atribuida"), "«concentra», «pesa» no son participación: prosa de la casa, pasa");
  ok(!tiene(run("Falabella vende $19.4M y genera $4.3M de contribución, mientras Lider, con $17.8M de venta, genera lo mismo. (Datos del año cerrado.)"), "metrica-mal-atribuida"), "la comparación venta↔contribución del owner sigue pasando");
  ok(!tiene(run("6 de los que caen la tienen sobre el 4.5% de carga comercial. (Datos del año cerrado.)"), "metrica-mal-atribuida"), "«caen» no es una métrica: el porqué de la casa pasa");
  /* el canon: «22.0%» y «22%» son la misma cifra para el dueño de la métrica (antes, dos llaves y la cifra sin dueño) */
  ok(tiene(run("Falabella tiene una carga comercial de 22.0%. (Datos del año cerrado.)"), "metrica-mal-atribuida"), "★ «22.0%» (el margen de Falabella) narrado como carga → BLOQUEA — el canon con decimal cero ya tiene dueño");
  /* el rótulo del panel dice lo que la cifra ES: en «movers» (ventas vs año anterior) el pct es una variación; en un ranking sigue siendo participación */
  const { enrichFromFacts } = await import("./src/adi/oracle/ledger.js");
  const movers = enrichFromFacts([], { ventas: { panel: { kind: "movers", title: "Vs año anterior", rows: [{ nombre: "Mercado Libre", val: 1100000, valFmt: "+$1.1M", pct: 25.3, pos: true }] } } });
  const rank = enrichFromFacts([], { ventas: { panel: { kind: "rank", title: "Ranking", rows: [{ nombre: "Lider", val: 17800000, valFmt: "$17.8M", pct: 17.8 }] } } });
  const lab = (b) => (b || []).map((f) => f.label);
  ok(lab(movers).includes("Mercado Libre · Variación vs año anterior") && !lab(movers).includes("Mercado Libre · % del total"), "★★ el pct del panel «movers» se rotula «Variación vs año anterior», no «% del total»", lab(movers).join(" | "));
  ok(lab(rank).includes("Lider · % del total"), "…y el pct de un ranking sigue siendo «% del total»", lab(rank).join(" | "));
}

H("[C] ENTIDAD MAL ATRIBUIDA · promovida de AVISO a BLOQUEO");
{
  const r = run("Lider aporta $4.3M de contribución. (Datos del año cerrado.)");
  ok(tiene(r, "entidad-mal-atribuida"), "«Lider ... $4.3M» (es de Falabella, que no aparece) → bloquea", JSON.stringify(kinds(r)));
  const rr = run("Falabella deja $4.3M de contribución, más que Lider. (Datos del año cerrado.)");
  ok(!tiene(rr, "entidad-mal-atribuida"), "la dueña real presente en el texto → NO bloquea (criterio nítido intacto)", JSON.stringify(kinds(rr)));
}

H("[D] PERÍODO CONTRADICTORIO · afirmar otro alcance temporal → BLOQUEA");
{
  const r1 = run("En el primer trimestre Falabella vende $19.4M.");
  ok(tiene(r1, "periodo-contradictorio"), "«en el primer trimestre» sobre dato anual → bloquea", JSON.stringify(kinds(r1)));
  const r2 = run("En lo que va del año Falabella vende $19.4M.");
  ok(tiene(r2, "periodo-contradictorio"), "«en lo que va del año» sobre dato anual → bloquea", JSON.stringify(kinds(r2)));
  const r3 = run("Falabella vende $19.4M. (Datos del año cerrado.)");
  ok(!tiene(r3, "periodo-contradictorio"), "el período correcto NO bloquea");
  const r4 = run("Falabella vende $19.4M.");
  ok(!tiene(r4, "periodo-contradictorio"), "OMITIR el período NO bloquea (lo agrega ensurePeriodoDeclared, como siempre)");
}

H("[E] NO REGRESIÓN · el muro numérico de siempre sigue firme");
{
  const r1 = run("Falabella vende $77.7M. (Datos del año cerrado.)");
  ok(tiene(r1, "cifra-no-autorizada"), "una cifra inventada sigue bloqueando");
  const r2 = run("Falabella vende $19.4M, con margen 22%. (Datos del año cerrado.)");
  ok(r2.ok, "una narración limpia sigue pasando entera");
  ok(Array.isArray(r2.advisories), "los avisos siguen existiendo (graduación) aunque atribución ya no sea aviso");
}

console.log(`\n── _binding_guard_gate: ${PASS} PASS · ${FAIL} FAIL (de ${PASS + FAIL}) ──`);
process.exit(FAIL ? 1 : 0);
