/* === _oracle_pnl_multiline_gate.mjs · P&L LEGADO · GATE DE ARRANQUE MULTI-LÍNEA (turno 16 del veredicto de 18
 * turnos, owner 2026-07-29) === "el usuario da 3 líneas de gasto con % en una sola frase y el parser las ignora".
 * Repro confirmó: _parseGastoList (src/adi/pnl.js) SIEMPRE supo segmentar "logística 3%, marketing 1.5% y
 * comisiones 2%" — pero solo se invocaba MID-FLOW (con un draft ya abierto). El PRIMER mensaje del hilo caía
 * siempre a {action:"start"} o null, y las 3 líneas se perdían en silencio.
 * Fix: nueva rama en detectPnlIntent (sección SIN DRAFT), gateada por _GASTOS_WORD + _GASTOS_CUE (aísla el
 * preámbulo "quiero armar mi P&L, mis gastos son..." antes de invocar _parseGastoList, que si no mata el batch
 * entero por un segmento inválido). PURO, determinístico, SIN LLM — pnl.js no llama a ningún LLM.
 */
import { detectPnlIntent, composePnl, initPnl, resetPnlDraft, pnlDraft } from "./src/adi/pnl.js";
const SC = "actual";

const POSITIVOS = [
  { q: "quiero armar mi P&L, mis gastos son logística 3%, marketing 1.5% y comisiones 2%", label: "preámbulo + 'mis gastos son' + coma/y" },
  { q: "tengo 3 gastos: logística 3%, marketing 1.5%, comisiones 2%", label: "'tengo N gastos:' + comas" },
  { q: "quiero armar mi P&L, mis gastos son:\nlogística 3%\nmarketing 1.5%\ncomisiones 2%", label: "salto de línea real" },
  { q: "definamos los gastos: logística 3%, marketing 1.5% y comisiones 2%", label: "'definamos los gastos:'" },
  { q: "mis gastos son logística 3% y marketing 1.5%", label: "solo 2 líneas (mínimo aceptado)" },
  { q: "mis gastos son logística, marketing y comisiones", label: "nombres SIN %  → abre draft en 'pcts', no en blanco" },
  { q: "quiero armar mi P&L, mis gastos son tecnología 3%, logística 5% y fuerza de ventas 10%", label: "bug real cazado en vivo (owner 2026-07-29): 'fuerza de ventas' contiene 'ventas' — _METRIC_WORDS sin anclar tumbaba TODO el batch", expectNames: ["Tecnología", "Logística", "Fuerza de ventas"] },
  { q: "mis gastos son biología 2%, energía 4% y compañía 1%", label: "bug real cazado en vivo: nombres terminados en '-ía' truncaban la última letra ('tecnología'→'Tecnologí') — el conector opcional 'a' se comía la vocal final por el bug de \\b sin acentos", expectNames: ["Biología", "Energía", "Compañía"] },
  { q: "mis gastos son logística a 2%, marketing al 3%", label: "control: el conector 'a'/'al' real (con espacio propio) sigue funcionando tras el fix del acento", expectNames: ["Logística", "Marketing"] },
];
const NEGATIVOS = [
  { q: "logística 3%", label: "una sola línea suelta — no debe activar draft_gastos" },
  { q: "¿armamos el P&L? tengo dudas sobre logística y marketing", label: "pregunta con '?' — el guard interno de _parseGastoList debe protegerlo" },
  { q: "¿cuánto tengo que vender para ganar $2M después de gastos?", label: "meta_venta (contiene 'gastos' pero es otra intención) — NO debe ser secuestrado" },
  { q: "hazme un resumen ejecutivo", label: "mensaje ajeno sin relación a P&L" },
  { q: "logística 3%, marketing 1.5% y comisiones 2%", label: "lista pelada SIN palabra 'gastos' — fuera de alcance deliberado (ver memoria), debe seguir null" },
];

let pass = 0, fail = 0;
console.log("── POSITIVOS (deben abrir el draft desde el turno 1, no quedar en blanco) ──");
for (const c of POSITIVOS) {
  resetPnlDraft(); initPnl();
  const pi = detectPnlIntent(c.q);
  const namesOk = !c.expectNames || (pi && pi.lines && c.expectNames.every((n, i) => pi.lines[i] && pi.lines[i].nombre === n));
  const ok = pi && pi.action === "draft_gastos" && Array.isArray(pi.lines) && pi.lines.length >= 2 && namesOk;
  console.log(`  ${ok ? "✓" : "✗"} ${c.label} → action=${pi && pi.action} lines=${pi && JSON.stringify(pi.lines)}`);
  if (ok) pass++; else fail++;
}
console.log("\n── NEGATIVOS (NO deben ser secuestrados por la rama nueva) ──");
for (const c of NEGATIVOS) {
  resetPnlDraft(); initPnl();
  const pi = detectPnlIntent(c.q);
  const ok = !pi || pi.action !== "draft_gastos";
  console.log(`  ${ok ? "✓" : "✗"} ${c.label} → action=${pi && pi.action}`);
  if (ok) pass++; else fail++;
}
console.log("\n── CIERRE: composePnl con las 3 líneas + % completos debe saltar directo a sello ──");
{
  resetPnlDraft(); initPnl();
  const pi = detectPnlIntent("mis gastos son logística 3%, marketing 1.5% y comisiones 2%");
  const r = pi ? composePnl(pi, null, { scenario: SC }) : null;
  const ok = !!(r && /sello\?/i.test(r.text) && /Logística: 3%/.test(r.text) && /Marketing: 1\.5%/.test(r.text) && /Comisiones: 2%/.test(r.text));
  console.log(`  ${ok ? "✓" : "✗"} salta a "¿Lo sello?" con las 3 líneas correctas`);
  if (ok) pass++; else fail++;
}

console.log(`\n── _oracle_pnl_multiline_gate: ${pass} PASS · ${fail} FAIL (de ${pass + fail}) ──`);
process.exit(fail ? 1 : 0);
