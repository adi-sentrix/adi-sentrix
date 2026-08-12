/* === _reintento_economico_gate.mjs · UN RECHAZO DE REDACCIÓN NO SE ARREGLA PAGANDO MÁS (owner 2026-08-11) =====
 * @inyeccion-simulada — `answerViaOracle` con `callPlan`/`callNarrate` a mano. Sin gateway, sin adapter, sin
 * `fetch(`, sin `src/ui/`. Cero red, cero llamadas pagadas.
 *
 * ── EL DEFECTO, MEDIDO SOBRE LA CERTIFICACIÓN REAL (fixtures/certificacion-f4f2949.json) ─────────────────────
 * 21 rechazos del guard, 17 de la clase REDACCIÓN. Cada uno empujaba el intento siguiente a un tier superior, y
 * las 33 llamadas escaladas de NARRAR se llevaron US$1,85 de un gasto total de US$1,95. La corrida se detuvo en
 * el tope monetario con 25 de 44 turnos respondidos.
 * LA CLASE IMPORTA: citar una cifra no autorizada, colgar una métrica de la entidad equivocada o narrar una
 * estimación como hecho no son fallas de CAPACIDAD — son fallas de OBEDIENCIA a un contrato que el prompt ya
 * declara. Un modelo 39× más caro obedece igual.
 *
 * `node --import ./scripts/offline-guard.mjs _reintento_economico_gate.mjs`
 */
import { readFileSync } from "node:fs";
import { initTenant } from "./src/data/tenantStore.js";
import { TENANT_DEMO } from "./src/data/tenants/demo.js";
import { answerViaOracle } from "./src/adi/oracle/answerViaOracle.js";

initTenant(TENANT_DEMO);
let PASS = 0, FAIL = 0;
const ok = (c, m, extra = "") => { if (c) { PASS++; console.log("  ✓ " + m); } else { FAIL++; console.log("  ✗ " + m + (extra ? "\n      " + extra : "")); } };
const H = (t) => console.log("\n" + t);

const PLAN = { intent: "answer", mode: "default", calls: [{ tool: "entityRecord", args: { dimension: "cliente", entity: "Falabella" } }] };
// una narración con una cifra que la boleta NO autoriza → `cifra-no-autorizada`, la clase de redacción más común.
const NARRA_MAL = "Falabella vende $42.7M y su margen es 22%.";
const NARRA_BIEN = "Falabella vende $19.4M en el año cerrado. Su margen es 22%, bajo el benchmark. Empieza por revisar las acciones comerciales.";

async function correr(secuencia) {
  const tiers = [];
  let i = 0;
  const o = await answerViaOracle({
    text: "¿cómo viene Falabella?", history: [], mem: {}, scenario: "bonanza",
    callPlan: async () => PLAN,
    callNarrate: async (a) => { tiers.push(a.attempt); return secuencia[Math.min(i++, secuencia.length - 1)]; },
  });
  return { tiers, texto: (o && o.r && o.r.text) || "", llamadas: tiers.length };
}

H("[1] UN RECHAZO DE REDACCIÓN NO ESCALA DE MODELO");
{
  const r = await correr([NARRA_MAL, NARRA_BIEN]);
  ok(r.tiers.length >= 2, `hubo un reintento (${r.tiers.length} llamadas de NARRAR)`);
  ok(r.tiers[1] === r.tiers[0], `el reintento usa EL MISMO tier (attempts: ${JSON.stringify(r.tiers)}) — no escala`);
  ok(r.tiers.every((t) => t === 0), "ninguna llamada de NARRAR sube de tier por un rechazo de redacción");
}

H("[2] DOS RECHAZOS → COMPOSITOR DETERMINÍSTICO, SIN SEGUIR GASTANDO");
{
  const r = await correr([NARRA_MAL, NARRA_MAL, NARRA_MAL]);
  ok(r.llamadas === 2, `se corta en DOS llamadas de NARRAR, no en tres (fueron ${r.llamadas})`);
  ok(!!r.texto, "…y el turno igual devuelve una respuesta (resuelve el compositor determinístico)", r.texto.slice(0, 80));
  ok(!/42\.7M/.test(r.texto), "la cifra no autorizada NUNCA sale al usuario", r.texto.slice(0, 80));
}

H("[3] LA MEDICIÓN SOBRE LA EVIDENCIA REAL · fixtures/certificacion-f4f2949.json");
{
  const F = JSON.parse(readFileSync("./fixtures/certificacion-f4f2949.json", "utf8"));
  ok(F.turnos === 25 && F.commit === "f4f2949", `el fixture es la corrida real: ${F.turnos} turnos de ${F.commit}`);
  const REDACCION = /cifra-no-autorizada|metrica-mal-atribuida|procedencia-no-autorizada|causa-sobredimensionada/;
  let total = 0, deRedaccion = 0;
  for (const c of F.casos) for (const e of ((c.retryTrace || {}).narrate || [])) {
    if (e.guardOk !== false) continue;
    total++;
    if (REDACCION.test(String(e.reason || ""))) deRedaccion++;
  }
  ok(total === 21, `la corrida tuvo 21 rechazos de guard (contados: ${total})`);
  ok(deRedaccion === 17, `17 son de la clase REDACCIÓN — las que la política nueva deja de escalar (contados: ${deRedaccion})`);
  ok(deRedaccion / total > 0.8, `son el ${Math.round(100 * deRedaccion / total)}% de los rechazos: el grueso del gasto evitable`);
}

H("[4] LO QUE NO CAMBIA · los otros veredictos conservan su escalada");
{
  // `tabla-faltante` no es redacción: el narrador no incumplió un contrato de contenido, produjo otra FORMA.
  // Su camino de reparación es el determinístico que ya existía, y la escalada de PLAN no se toca en ningún caso.
  const src = readFileSync("./src/adi/oracle/answerViaOracle.js", "utf8");
  ok(/_VERDICTOS_DE_REDACCION\s*=\s*\/cifra-no-autorizada\|metrica-mal-atribuida\|procedencia-no-autorizada\|causa-sobredimensionada\//.test(src),
    "la clase de redacción es una lista CERRADA de cuatro veredictos, declarada en un solo lugar");
  ok(!/_VERDICTOS_DE_REDACCION[\s\S]{0,400}tabla-faltante/.test(src), "`tabla-faltante` NO entra en la clase (tiene su propia reparación)");
  ok(/if \(!rateLimited && _isPlanContentError\(e\)\) modelAttempt\+\+/.test(src), "la escalada de PLAN queda intacta");
}

console.log(`\n── _reintento_economico_gate: ${PASS} PASS · ${FAIL} FAIL (de ${PASS + FAIL}) ──`);
process.exit(FAIL ? 1 : 0);
