/* === _forma_salida_contrato_gate.mjs · LA FORMA PEDIDA SE GARANTIZA, NO SE PIDE POR FAVOR (owner 2026-08-11) ==
 * @inyeccion-simulada — ejercita `answerViaOracle` entero con `callPlan`/`callNarrate` a mano. No importa el
 * gateway ni un adapter, no contiene `fetch(`, no importa `src/ui/`. Cero red, cero llamadas pagadas.
 *
 * ── EL DEFECTO (número 8 de la certificación de 44 turnos) ────────────────────────────────────────────────────
 * Las CUATRO direcciones de formato fallaron, y las cuatro con el guard funcionando:
 *   · «mantené el formato» (venía tabla)   → prosa
 *   · «explicalo sin repetir la tabla»      → tabla, y cero explicación
 *   · «ahora solo la conclusión, nada más»  → tabla de clientes, y encima de otro tema
 *   · «hablame directo y sin rodeos»        → doce filas sin una sola frase
 * El guard RECHAZABA (`tabla-faltante`, `tabla-no-autorizada`) y el turno igual salía mal: rechazar no es
 * construir. Se pagaban reintentos para volver a fallar.
 *
 * ── EL CONTRATO ──────────────────────────────────────────────────────────────────────────────────────────────
 * `pref.outputForm` (auto|tabla|prosa|solo_conclusion) lo declara el PLAN y es TURN-LOCAL por construcción: el
 * contrato de `pref` ya dice que no se hereda. Los detectores quedan de RESPALDO — cuando el plan declara, manda.
 * Y la garantía vive en el RENDERER: la forma se impone sobre el texto ya autorizado, con las cifras que la
 * boleta validó. Nada depende de que el narrador obedezca.
 *
 * `detailLevel` y `outputForm` son EJES DISTINTOS: «directo» reduce el detalle y NO borra una tabla pedida.
 *
 * `node --import ./scripts/offline-guard.mjs _forma_salida_contrato_gate.mjs`
 */
import { initTenant } from "./src/data/tenantStore.js";
import { TENANT_DEMO } from "./src/data/tenants/demo.js";
import { answerViaOracle } from "./src/adi/oracle/answerViaOracle.js";
import { resolveOutputForm, OUTPUT_FORMS } from "./src/adi/oracle/progressiveDisclosure.js";

initTenant(TENANT_DEMO);
let PASS = 0, FAIL = 0;
const ok = (c, m, extra = "") => { if (c) { PASS++; console.log("  ✓ " + m); } else { FAIL++; console.log("  ✗ " + m + (extra ? "\n      " + extra : "")); } };
const H = (t) => console.log("\n" + t);
const hayTabla = (s) => /^\s*\|.*\|\s*$/m.test(String(s || ""));

const PLAN = (pref, calls = [{ tool: "marginRead", args: { dimension: "cliente" } }]) => ({ intent: "answer", calls, pref });
// el narrador simulado DESOBEDECE a propósito: devuelve siempre una tabla. Si la forma se cumpliera sólo porque
// el modelo hace caso, este gate no probaría nada — lo que se certifica es que el renderer la impone igual.
const NARRA_TABLA = async () => "Falabella lidera la cartera.\n\n| Cliente | Margen |\n|---|---|\n| Falabella | 22% |\n| Lider | 21.5% |\n\nEmpieza por revisar las acciones comerciales de Falabella.";
const NARRA_PROSA = async () => "Falabella lidera la cartera con 22% de margen.\n\nEmpieza por revisar sus acciones comerciales.";

async function turno(text, plan, narrador = NARRA_TABLA, mem = {}) {
  const o = await answerViaOracle({ text, history: [], mem, scenario: "bonanza", callPlan: async () => plan, callNarrate: narrador });
  return { texto: (o && o.r && o.r.text) || "", mem: (o && o.mem) || {} };
}

H("[1] EL RESOLUTOR · el PLAN manda, el detector es respaldo");
{
  ok(OUTPUT_FORMS.join(",") === "auto,tabla,prosa,solo_conclusion", "las cuatro formas del contrato, en un solo lugar");
  ok(resolveOutputForm({ plan: PLAN({ outputForm: "tabla" }), text: "Explicámelo en prosa." }) === "tabla",
    "lo que el PLAN declara gana sobre lo que diga el detector de texto");
  ok(resolveOutputForm({ plan: PLAN({}), text: "Explicámelo en prosa, sin tabla." }) === "prosa",
    "sin declaración del plan, el respaldo determinístico resuelve igual");
  ok(resolveOutputForm({ plan: PLAN({ outputForm: "auto" }), text: "¿Cuánto vende Lider?" }) === "auto",
    "un turno sin pedido de forma queda en `auto` (no se inventa una forma)");
}

H("[1b] UNA CONSULTA GENERAL NO ES UNA PETICIÓN DE TABLA (residual del defecto 8, owner 2026-08-11)");
{
  // «¿Cómo viene Falabella?» resolvía `tabla` porque `_TEMPORAL` aceptaba «cómo viene» SIN complemento temporal.
  // Es una consulta ejecutiva sobre la entidad —qué pasa, por qué, qué hacer primero—, no un pedido de serie.
  for (const t of ["¿Cómo viene Falabella?", "¿Cómo va Falabella?", "Resumen de Falabella", "Perfil de Falabella",
    "Diagnóstico de Falabella", "Muéstrame Falabella", "Falabella"]) {
    ok(resolveOutputForm({ plan: PLAN({}), text: t }) === "auto", `«${t}» → auto (no fuerza tabla)`);
  }
  // …Y LA CARA OPUESTA: lo que SÍ es una petición explícita de presentación tabular sigue resolviendo `tabla`.
  for (const t of ["Muéstrame las ventas de Falabella en una tabla", "Ventas mes a mes en tabla",
    "Hazme un cuadro con los clientes", "Armá una planilla con el mix", "Dame la evolución mes a mes"]) {
    ok(resolveOutputForm({ plan: PLAN({}), text: t }) === "tabla", `«${t}» → tabla`);
  }
  // el complemento es lo que distingue, no el verbo: con unidad de tiempo, «cómo viene» SÍ pide la serie.
  ok(resolveOutputForm({ plan: PLAN({}), text: "¿Cómo viene el año?" }) === "tabla", "«¿Cómo viene el año?» → tabla (trae unidad de tiempo)");
  ok(resolveOutputForm({ plan: PLAN({}), text: "¿Cómo evolucionó Falabella?" }) === "tabla", "«¿cómo evolucionó X?» → tabla (verbo de trayectoria)");
  // PLAN manda, y un valor inválido cae al respaldo CONSERVADOR (auto), nunca a tabla.
  ok(resolveOutputForm({ plan: PLAN({ outputForm: "tabla" }), text: "¿Cómo viene Falabella?" }) === "tabla",
    "un `outputForm` válido del PLAN prevalece sobre la consulta general");
  ok(resolveOutputForm({ plan: PLAN({ outputForm: "zzz-invalido" }), text: "¿Cómo viene Falabella?" }) === "auto",
    "un `outputForm` INVÁLIDO cae a `auto`, nunca a `tabla`");
  ok(resolveOutputForm({ plan: PLAN({}), text: "¿Cómo viene Falabella?" }) === "auto",
    "un `outputForm` ausente cae a `auto`");
  // NO SE ROMPE LA POLISEMIA: negar una PARTE de una tabla pedida sigue entregando la tabla.
  ok(resolveOutputForm({ plan: PLAN({}), text: "Dame la tabla mes a mes, sin la columna de unidades" }) === "tabla",
    "negar una columna no degrada una tabla pedida (la protección de polisemia sigue viva)");
}

H("[2] TABLA EXPLÍCITA · el renderer la construye aunque el narrador no la traiga");
{
  const r = await turno("Dame la evolución mes a mes en una tabla.", PLAN({ outputForm: "tabla" }), NARRA_PROSA);
  ok(hayTabla(r.texto), "pidió tabla y la respuesta trae tabla, con un narrador que devolvió prosa", r.texto.slice(0, 120));
}

H("[3] PROSA EXPLÍCITA · no puede aparecer ninguna tabla");
{
  const r = await turno("Explicámelo en prosa, sin tabla.", PLAN({ outputForm: "prosa" }), NARRA_TABLA);
  ok(!hayTabla(r.texto), "pidió prosa y NO sale ninguna tabla, con un narrador que devolvió una", r.texto.slice(0, 120));
  ok(/Falabella/.test(r.texto), "…y el dato no se pierde al quitar la forma");
}

H("[4] «SIN REPETIR LA TABLA» · el caso E3.t3 de la certificación");
{
  const r = await turno("Explicalo sin repetir la tabla: cuál fue el peor mes.", PLAN({ outputForm: "prosa" }), NARRA_TABLA);
  ok(!hayTabla(r.texto), "no repite la tabla", r.texto.slice(0, 120));
}

H("[5] SOLO LA CONCLUSIÓN · sólo el cierre, sin el detalle anterior");
{
  const r = await turno("Ahora solo la conclusión, nada más.", PLAN({ outputForm: "solo_conclusion" }), NARRA_TABLA);
  ok(!hayTabla(r.texto), "no trae tabla", r.texto.slice(0, 120));
  ok(r.texto.split(/\n{2,}/).filter(Boolean).length === 1, "entrega UN solo bloque: la conclusión", JSON.stringify(r.texto.slice(0, 120)));
}

H("[6] DIRECTO + TABLA · «directo» reduce detalle, NO borra una tabla pedida");
{
  ok(resolveOutputForm({ plan: PLAN({ detailLevel: "brief" }), text: "Dame la tabla mes a mes, pero directo y sin rodeos." }) === "tabla",
    "un pedido de brevedad NO degrada a prosa una tabla pedida expresamente");
  const r = await turno("Dame la tabla mes a mes, pero directo y sin rodeos.", PLAN({ outputForm: "tabla", detailLevel: "brief" }), NARRA_PROSA);
  ok(hayTabla(r.texto), "…y la tabla sale igual", r.texto.slice(0, 100));
}

H("[7] CORRECCIÓN DE FORMATO · reemplaza, y NO se arrastra al turno siguiente");
{
  const t1 = await turno("Dame la tabla mes a mes.", PLAN({ outputForm: "tabla" }), NARRA_PROSA);
  ok(hayTabla(t1.texto), "turno 1: tabla");
  const t2 = await turno("Mejor explicámelo en prosa.", PLAN({ outputForm: "prosa" }), NARRA_TABLA, t1.mem);
  ok(!hayTabla(t2.texto), "turno 2 corrige la forma: la anterior se reemplaza", t2.texto.slice(0, 100));
  // NO PERSISTENCIA: el turno 3 no pide forma, así que la prosa del turno 2 no puede seguir mandando.
  ok(resolveOutputForm({ plan: PLAN({}), text: "¿Y cuánto contribuye Jumbo?" }) !== "prosa",
    "turno 3 sin pedido de forma: la corrección del turno 2 NO se arrastra");
  const memKeys = JSON.stringify(t2.mem || {});
  ok(!/outputForm/.test(memKeys), "la forma no se guarda en la memoria del hilo (es turn-local por construcción)");
}

console.log(`\n── _forma_salida_contrato_gate: ${PASS} PASS · ${FAIL} FAIL (de ${PASS + FAIL}) ──`);
process.exit(FAIL ? 1 : 0);
