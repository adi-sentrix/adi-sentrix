/* === _recentsubjects_filters_gate.mjs · GATE · mem.recentSubjects/lastOffer también capturan entidad vía `filters` ===
 * owner 2026-07-31, auditoría (defecto "Inventario y capital inmovilizado", alto_riesgo):
 *
 * dialogueState.js (updateRecentSubjects/extractOffer) solo alimentaba mem.recentSubjects/mem.lastOffer cuando
 * plan.scope.level==='entity'. Pero planPrompt.js nunca le pedía al LLM declarar scope.level='entity' cuando el
 * alcance de una consulta viaja vía `filters` (bodega/marca/familia/cliente, usado por inventoryStatus/
 * marginRead/contributionRead/etc.) — el LLM dejaba scope.level='global' incluso cuando el usuario nombró una
 * bodega/entidad explícita. Efecto: esa entidad/bodega nunca quedaba registrada en la memoria de continuidad.
 *
 * FIX: (1) doctrina reforzada en planPrompt.js (REGLA DE ALCANCE: un filtro de un solo valor SIGUE siendo una
 * entidad puntual). (2) respaldo determinístico en dialogueState.js — _singleFilterEntity: si `filters` trae
 * EXACTAMENTE un valor de eje poblado (inequívoco), updateRecentSubjects/extractOffer lo capturan igual, sin
 * depender de que el LLM haya declarado scope.level='entity'.
 */
import { updateRecentSubjects, extractOffer } from "./src/adi/oracle/dialogueState.js";

let pass = 0, fail = 0;
const ok = (cond, label) => { console.log(`  ${cond ? "✓" : "✗"} ${label}`); if (cond) pass++; else fail++; };

console.log("── 1 · updateRecentSubjects captura la bodega vía filters, aunque scope.level quede 'global' ──");
{
  const plan = { intent: "answer", mode: "default", scope: { level: "global" } };
  const calls = [{ tool: "inventoryStatus", args: { filters: { bodega: "Santiago" } } }];
  const list = updateRecentSubjects([], plan, calls, 0);
  ok(list.length === 1 && list[0].entidad === "Santiago" && list[0].dimension === "bodega", `recentSubjects captura {entidad:"Santiago", dimension:"bodega"} — obtuvo ${JSON.stringify(list)}`);
}

console.log("\n── 2 · REGRESIÓN — scope.level='entity' explícito sigue funcionando igual (prioridad sobre filters) ──");
{
  const plan = { intent: "answer", mode: "default", scope: { level: "entity", entities: ["Falabella"] } };
  const calls = [{ tool: "entityProfile", args: { dimension: "cliente", entity: "Falabella" } }];
  const list = updateRecentSubjects([], plan, calls, 0);
  ok(list.length === 1 && list[0].entidad === "Falabella" && list[0].dimension === "cliente", `scope.level='entity' sigue capturando igual — obtuvo ${JSON.stringify(list)}`);
}

console.log("\n── 3 · REGRESIÓN — filters con 2+ ejes poblados (ambiguo) NO se captura como entidad puntual ──");
{
  const plan = { intent: "answer", mode: "default", scope: { level: "global" } };
  const calls = [{ tool: "marginRead", args: { dimension: "cliente", filters: { marca: "Samsung", bodega: "Santiago" } } }];
  const list = updateRecentSubjects([], plan, calls, 0);
  ok(list.length === 0, `2 ejes poblados a la vez → NO se adivina cuál es "la" entidad, recentSubjects queda vacío — obtuvo ${JSON.stringify(list)}`);
}

console.log("\n── 4 · REGRESIÓN — scope global SIN filters (negocio completo) sigue sin registrar nada ──");
{
  const plan = { intent: "answer", mode: "default", scope: { level: "global" } };
  const calls = [{ tool: "executiveSummary", args: {} }];
  const list = updateRecentSubjects([], plan, calls, 0);
  ok(list.length === 0, `sin filters ni scope entity, recentSubjects sigue vacío (sin cambios) — obtuvo ${JSON.stringify(list)}`);
}

console.log("\n── 5 · reordena (no duplica) si la entidad-vía-filters YA estaba en la lista ──");
{
  const plan = { intent: "answer", mode: "default", scope: { level: "global" } };
  const calls = [{ tool: "inventoryStatus", args: { filters: { bodega: "Santiago" } } }];
  const prev = [{ entidad: "Falabella", dimension: "cliente", turno: 0 }, { entidad: "Santiago", dimension: "bodega", turno: 1 }];
  const list = updateRecentSubjects(prev, plan, calls, 2);
  ok(list.length === 2 && list[0].entidad === "Santiago" && list[1].entidad === "Falabella", `"Santiago" sube al frente sin duplicarse — obtuvo ${JSON.stringify(list)}`);
}

console.log("\n── 6 · extractOffer también deriva la entidad vía filters (mem.lastOffer.entidad) ──");
{
  const narration = "El inventario detenido de la bodega Santiago asciende a $25K. ¿Querés que profundice en cómo liberarlo?";
  const calls = [{ tool: "inventoryStatus", args: { filters: { bodega: "Santiago" } } }];
  const plan = { intent: "answer", mode: "default", scope: { level: "global" } };
  const offer = extractOffer(narration, { plan, calls, pref: { contentScope: "full" }, turno: 0 });
  ok(!!offer && offer.entidad === "Santiago", `lastOffer.entidad = "Santiago" (antes: null, pese a que los datos SÍ quedaron acotados a esa bodega) — obtuvo ${JSON.stringify(offer)}`);
}

console.log(`\n── _recentsubjects_filters_gate: ${pass} PASS · ${fail} FAIL (de ${pass + fail}) ──`);
process.exit(fail ? 1 : 0);
