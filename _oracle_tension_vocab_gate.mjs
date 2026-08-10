/* === _oracle_tension_vocab_gate.mjs · ARQUITECTURA C · GATE DE VOCABULARIO NATURAL DE tensionRead ===
 * owner 2026-07-29 (2ª vuelta de residuales): "cruza rotación con contribución" ya funcionaba, pero frases
 * naturales como "¿quién sostiene la contribución y quién tiene menor margen/deja menos margen/consume margen?"
 * (sin decir "cruza" ni a veces ni "tensión") sustituían la métrica en silencio o, peor, mostraban el ranking en
 * la dirección CONTRARIA ("quién cede más margen" mostraba a los de MEJOR margen).
 * 3 mecanismos nuevos en answerViaOracle.js, testeados acá con callPlan/callNarrate MOCKEADOS (determinístico, sin
 * LLM — mismo patrón que _oracle_plan_retry_gate.mjs): (1) _extractTensionMetrics — token + DIRECCIÓN por métrica,
 * con ventana acotada hacia atrás para no filtrarse entre cláusulas; (2) corrección de metricA/metricB/dirA/dirB
 * sobre una call tensionRead YA elegida por el plan; (3) inyección de tensionRead cuando el plan fragmentó la
 * pregunta en 2+ tools separadas pero el TEXTO tiene la estructura de una tensión; (4) dedupe cuando el plan repite
 * tensionRead por cada dimensión posible.
 */
import { answerViaOracle } from "./src/adi/oracle/answerViaOracle.js";

let pass = 0, fail = 0;
const ok = (cond, label) => { console.log(`  ${cond ? "✓" : "✗"} ${label}`); if (cond) pass++; else fail++; };

async function correctedCalls(text, rawPlan) {
  let captured = null;
  const callPlan = async () => rawPlan;
  const callNarrate = async ({ plan }) => { captured = plan.calls; return "texto de prueba sin cifras."; };
  await answerViaOracle({ text, history: [], mem: {}, scenario: "actual", callPlan, callNarrate });
  return captured;
}

console.log("── 1 · corrige metricA/metricB/dirA/dirB sobre una call tensionRead YA elegida, sin tocar el default ──");
{
  const text = "¿Hay tensión entre quién sostiene la contribución y quién tiene menor margen?";
  const calls = await correctedCalls(text, { intent: "answer", calls: [{ tool: "tensionRead", args: { dimension: "sku" } }] });
  ok(calls && calls.length === 1 && calls[0].tool === "tensionRead", "sigue habiendo exactamente 1 call tensionRead");
  ok(calls && calls[0].args.metricA === "contribucion" && calls[0].args.dirA === "desc", `metricA=contribucion, dirA=desc (sostiene→alto primero) — obtuvo ${JSON.stringify(calls && calls[0].args)}`);
  ok(calls && calls[0].args.metricB === "margen" && calls[0].args.dirB === "asc", `metricB=margen, dirB=asc (menor→bajo primero) — obtuvo ${JSON.stringify(calls && calls[0].args)}`);
}

console.log("\n── 2 · 'cede más margen' también dispara dirB=asc (mismo significado que 'menor', otro verbo) ──");
{
  const text = "¿quién sostiene la contribución del negocio y quién cede más margen?";
  const calls = await correctedCalls(text, { intent: "answer", calls: [{ tool: "tensionRead", args: { dimension: "cliente" } }] });
  ok(calls && calls[0].args.metricA === "contribucion" && calls[0].args.dirA === "desc", "metricA=contribucion desc");
  ok(calls && calls[0].args.metricB === "margen" && calls[0].args.dirB === "asc", `metricB=margen, dirB=asc — obtuvo ${JSON.stringify(calls && calls[0].args)}`);
}

console.log("\n── 3 · CONTROL — 'consume más capital' NO es dirección baja (consumir mucho = valor ALTO, sigue desc) ──");
{
  const text = "¿qué SKU aportan contribución pero consumen más capital?";
  const calls = await correctedCalls(text, { intent: "answer", calls: [{ tool: "tensionRead", args: { dimension: "sku" } }] });
  ok(calls && calls[0].args.metricA === "contribucion" && calls[0].args.dirA === "desc", "metricA=contribucion desc");
  ok(calls && calls[0].args.metricB === "stockUSD" && calls[0].args.dirB === "desc", `metricB=stockUSD, dirB=desc (consumir MÁS = valor alto, NO ascendente) — obtuvo ${JSON.stringify(calls && calls[0].args)}`);
}

console.log("\n── 4 · sin tensionRead en el plan pero el TEXTO tiene la estructura → la INYECTA (plan fragmentado en 2 tools) ──");
{
  const text = "¿quién sostiene la contribución del negocio y quién cede más margen?";
  const calls = await correctedCalls(text, { intent: "answer", calls: [
    { tool: "contributionRead", args: { dimension: "cliente" } },
    { tool: "marginRead", args: { dimension: "cliente", focus: "bajo_benchmark" } },
  ] });
  ok(calls && calls.length === 1 && calls[0].tool === "tensionRead", `reemplaza el plan fragmentado por UNA call tensionRead — obtuvo ${JSON.stringify(calls)}`);
  ok(calls && calls[0].args.dimension === "cliente", "hereda la dimension que el plan fragmentado ya había resuelto (cliente)");
  ok(calls && calls[0].args.metricB === "margen" && calls[0].args.dirB === "asc", "metricB/dirB correctos también en el camino de inyección");
}

console.log("\n── 5 · dedupe — el plan repite tensionRead por cada dimensión, se queda con la primera ──");
{
  const text = "¿Hay tensión entre quién sostiene la contribución y quién tiene menor margen?";
  const calls = await correctedCalls(text, { intent: "answer", calls: [
    { tool: "tensionRead", args: { dimension: "cliente" } },
    { tool: "tensionRead", args: { dimension: "marca" } },
    { tool: "tensionRead", args: { dimension: "sku" } },
  ] });
  ok(calls && calls.length === 1, `solo queda 1 call tensionRead (obtuvo ${calls && calls.length})`);
  ok(calls && calls[0].args.dimension === "cliente", "se quedó con la PRIMERA (cliente), no con marca/sku");
}

console.log("\n── 6 · CONTROL — sin 2 métricas claras, no toca nada (el plan decide) ──");
{
  const text = "¿quién cede más margen?";   // solo 1 métrica nombrada
  const calls = await correctedCalls(text, { intent: "answer", calls: [{ tool: "tensionRead", args: { dimension: "cliente", metricA: "contribucion", metricB: "stockUSD" } }] });
  ok(calls && calls[0].args.metricA === "contribucion" && calls[0].args.metricB === "stockUSD", "con 1 sola métrica en el texto, deja los args tal cual el plan los trajo (no inventa una 2ª)");
}

console.log("\n── 7 · CONTROL — sin estructura de tensión ni tensionRead en el plan, no inyecta nada de más ──");
{
  const text = "¿cómo viene el margen de Falabella?";
  const calls = await correctedCalls(text, { intent: "answer", calls: [{ tool: "entityProfile", args: { dimension: "cliente", entity: "Falabella" } }] });
  ok(calls && calls.length === 1 && calls[0].tool === "entityProfile", "no secuestra un turno que no es de tensión");
}

console.log(`\n── _oracle_tension_vocab_gate: ${pass} PASS · ${fail} FAIL (de ${pass + fail}) ──`);
process.exit(fail ? 1 : 0);
