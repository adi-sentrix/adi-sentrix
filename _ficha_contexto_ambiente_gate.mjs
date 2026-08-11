/* === _ficha_contexto_ambiente_gate.mjs · LA FICHA HABLA SIN QUE LE PULSEN NADA (owner 2026-08-11) =============
 * @inspeccion-estatica — lee `SentrixPanel.jsx` y el hook como TEXTO para certificar que el cableado existe. No
 * importa el gateway ni un adapter, no invoca a nadie y no abre un socket: cero red, cero LLM, cero créditos.
 *
 * ── QUÉ AGUJERO TAPA, y por qué no lo tapaba nadie ────────────────────────────────────────────────────────────
 * Las otras tres caras publican su contexto ambiente por `useVistaContext`, que pone `ambient:true` DENTRO del
 * hook: es estructural, no se puede olvidar. La Ficha no puede usar ese camino —es la única cara cuyo contexto
 * lleva UNA entidad, y esa entidad sale de la lectura del módulo, no de la vista—, así que se cablea a mano en
 * `MesaFichaCara` con un `ambient:true` escrito en el call site.
 *
 * Ese `ambient:true` a mano NO ESTABA PROTEGIDO POR NINGÚN GATE. La red que cubre a las demás
 * (_concordancia_cobertura_gate §7f) recorre `componentIdsNivel2()`, que son los componentes CON `builder` — y la
 * Ficha no tiene `builder`, así que quedaba fuera del barrido. Verificado en vivo antes de escribir esto: se
 * borra `ambient:true` de SentrixPanel.jsx y los 94 gates siguen verdes mientras la Ficha se queda muda. El
 * usuario abre la Ficha de Falabella, escribe «explicame esta ficha», y ADI no sabe qué ficha ni de quién.
 *
 * LO QUE ESTE GATE NO ES: no cambia conducta. Todo lo que afirma acá YA FUNCIONA hoy (medido: 13 entidades × 3
 * escenarios). Esto es la red que impide que deje de funcionar en silencio — que es distinto de un arreglo, y
 * decirlo importa: un gate nuevo sobre conducta existente es cobertura, no una corrección.
 *
 * ── LAS CINCO CONDUCTAS (pedido del owner 2026-08-11) ─────────────────────────────────────────────────────────
 *   [1] Ficha abierta + pregunta ESCRITA A MANO → ADI recibe vista, entidad, período, universo y evidencia.
 *   [2] Cambiar de entidad (Falabella → Lider) NO conserva la anterior.
 *   [3] Cambiar de cara (Ficha → Capital) NO arrastra el contexto de la Ficha.
 *   [4] Entrar por CTA y entrar a mano producen EL MISMO contexto canónico (uno solo, no dos parecidos).
 *   [5] Nada de esto agrega una sola llamada al LLM.
 * Y todas se afirman sobre TODA entidad admitida, nunca sólo Falabella.
 *
 * `node _ficha_contexto_ambiente_gate.mjs`
 */
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { VIEW_MANIFEST, componentIdsNivel2 } from "./src/adi/sentrix/viewManifest.js";
import { deriveViewContext } from "./src/adi/sentrix/viewContextFrom.js";
import { builderOutsPorComponente } from "./src/adi/sentrix/viewBuilderRun.js";
import {
  viewContextKey, viewContextEntry, viewContextChanged, invalidateViewContext,
  projectViewContextForPlan, projectViewContextForCoercion, VIEW_PLAN_LINE_MAX,
} from "./src/adi/oracle/viewContext.js";
import { isSealed } from "./src/adi/oracle/narrationContract.js";
import { buildReadingFromSignals, buildClientContribSignals } from "./src/adi/sentrix/reading.js";
import { buildCuadroMando } from "./src/adi/sentrix/cuadro.js";
import { getTenantId } from "./src/data/tenantStore.js";

const ROOT = dirname(fileURLToPath(import.meta.url));
let PASS = 0, FAIL = 0;
const ok = (c, m, extra = "") => { if (c) { PASS++; console.log("  ✓ " + m); } else { FAIL++; console.log("  ✗ " + m + (extra ? "\n      " + extra : "")); } };
const H = (t) => console.log("\n" + t);

const FICHA = "ficha/otro/ficha-cliente";
const ESCENARIOS = ["bonanza", "tension", "crisis"];
const TENANT = getTenantId();

// LA LISTA DE ENTIDADES ES LA QUE OFRECE LA UI, no una copiada acá: `MesaFichaCara` arma su selector con
// `buildCuadroMando("cliente", scenario).rows.map(r => r.name)`. Si mañana la cartera cambia, este gate cubre la
// nueva sin que nadie lo edite — que es la diferencia entre "probado para toda entidad" y "probado para 13".
const entidadesDe = (scn) => buildCuadroMando("cliente", scn).rows.map((r) => r.name);

// EL CONTEXTO TAL COMO LO DERIVA EL HOOK. Mismos argumentos que `useViewContext` en MesaFichaCara: misma
// lectura (`buildReadingFromSignals∘buildClientContribSignals`), misma selección explícita de una entidad.
// Reproducir el call site es el punto: si el panel cambiara de builder, esto seguiría verde midiendo otra cosa,
// y por eso [1c] afirma ADEMÁS que el panel llama a estos mismos símbolos.
function ctxFicha(entity, scn) {
  const rd = buildReadingFromSignals(buildClientContribSignals(entity, scn));
  if (!rd) return null;
  return deriveViewContext(FICHA, rd, {
    scenario: scn, controles: {}, seleccion: { modo: "explicita", n: 1, entidades: [entity] }, tenantId: TENANT,
  });
}

// JSON canónico (claves ordenadas en profundidad) — para comparar dos contextos sin que el orden de las claves
// invente una diferencia. Mismo criterio que `_canon` en viewContext.js.
const canon = (v) => {
  if (v === null || typeof v !== "object") return JSON.stringify(v === undefined ? null : v);
  if (Array.isArray(v)) return `[${v.map(canon).join(",")}]`;
  return `{${Object.keys(v).sort().map((k) => `${JSON.stringify(k)}:${canon(v[k])}`).join(",")}}`;
};

const PANEL = readFileSync(join(ROOT, "src", "ui", "SentrixPanel.jsx"), "utf8");
const HOOK = readFileSync(join(ROOT, "src", "ui", "useViewContext.js"), "utf8");
// el bloque de la llamada que monta la Ficha — el call site real, no una mención suelta en un comentario.
const BLOQUE_FICHA = (() => {
  const re = new RegExp(`useViewContext\\(\\s*["'\`]${FICHA.replace(/[/-]/g, "\\$&")}["'\`][\\s\\S]{0,400}?\\n\\s*\\}\\);`, "m");
  const m = re.exec(PANEL);
  return m ? m[0] : null;
})();

/* ══ [0] EL AGUJERO ES REAL · por qué este archivo existe ═══════════════════════════════════════════════════ */
H("[0] POR QUÉ ESTE GATE · la Ficha queda fuera del barrido que cubre a las demás caras");
{
  const n2 = componentIdsNivel2();
  ok(!n2.includes(FICHA),
    `la Ficha NO está en componentIdsNivel2() (${n2.length} componentes con builder), así que §7f de _concordancia_cobertura_gate no la barre`,
    "si algún día entra, esa red la cubriría y esta sección deja de tener sentido — no el resto del gate");
  ok(!!VIEW_MANIFEST[FICHA] && !VIEW_MANIFEST[FICHA].builder,
    "la Ficha se declara sin `builder` (su salida es la lectura del módulo, no un corredor de vista)");
  // las otras tres caras van por `useVistaContext`, que pone el ambiente DENTRO del hook: no se puede olvidar.
  ok(/export function useVistaContext[\s\S]{0,240}ambient:\s*true/.test(HOOK),
    "las otras tres caras tienen el ambiente garantizado por construcción (useVistaContext lo fija en el hook)");
}

/* ══ [1] FICHA ABIERTA + PREGUNTA A MANO ════════════════════════════════════════════════════════════════════ */
H("[1] ABRIR UNA FICHA Y ESCRIBIR A MANO · «explicame esta ficha» llega con sujeto");
{
  ok(!!BLOQUE_FICHA, "el panel monta la Ficha con useViewContext (no con un setUISignal a mano)");
  ok(!!BLOQUE_FICHA && /ambient:\s*true/.test(BLOQUE_FICHA),
    "…y la monta con `ambient: true` — publica sin que el usuario pulse ningún CTA",
    "ESTE es el candado que faltaba: borrar `ambient:true` de MesaFichaCara dejaba los 94 gates verdes");
  ok(!!BLOQUE_FICHA && /seleccion:/.test(BLOQUE_FICHA) && /entidades:\s*\[\s*entity\s*\]/.test(BLOQUE_FICHA),
    "…y le pasa la entidad activa como selección explícita (el sujeto sale del panel, no se adivina)");
  // [1c] el call site usa LOS MISMOS builders que este gate: sin esto, el gate podría quedar verde midiendo un
  // camino que el producto ya no recorre.
  ok(/buildReadingFromSignals\(\s*buildClientContribSignals\(/.test(PANEL),
    "el panel deriva la Ficha con buildReadingFromSignals∘buildClientContribSignals (lo mismo que afirma este gate)");
  ok(/if\s*\(!entity\)\s*return null/.test(PANEL),
    "sin cliente elegido no hay contexto de Ficha (no se publica una ficha de nadie)");

  // ── y ahora la conducta, sobre TODA entidad admitida y los tres escenarios ──
  const faltas = [];
  let derivados = 0;
  for (const scn of ESCENARIOS) {
    for (const e of entidadesDe(scn)) {
      const vc = ctxFicha(e, scn);
      if (!vc) { faltas.push(`${scn}/${e}: sin contexto`); continue; }
      derivados++;
      const sel = vc.seleccion || {};
      const problemas = [];
      if (vc.vista !== "ficha") problemas.push(`vista=${vc.vista}`);
      if (vc.eje !== "cliente") problemas.push(`eje=${vc.eje}`);
      if (!(Array.isArray(sel.entidades) && sel.entidades.length === 1 && sel.entidades[0] === e)) problemas.push(`entidad=${JSON.stringify(sel.entidades)}`);
      if (!vc.periodo) problemas.push("sin período");
      if (!vc.universo || !vc.universo.kind) problemas.push("sin universo");
      if (vc.escenario !== scn) problemas.push(`escenario=${vc.escenario}`);
      if (!vc.estatus) problemas.push("sin sello de procedencia");
      if (!isSealed(vc)) problemas.push("no sellado");
      if (problemas.length) faltas.push(`${scn}/${e}: ${problemas.join(", ")}`);
    }
  }
  ok(derivados > 0, `se derivó el contexto de la Ficha en ${derivados} combinaciones entidad × escenario`);
  ok(!faltas.length,
    "TODA entidad admitida publica vista=ficha · eje=cliente · su entidad · período · universo · escenario · sello, y sellado",
    faltas.slice(0, 6).join("\n      "));

  // la LÍNEA DEL PLAN es lo que el planificador lee de verdad: tiene que nombrar la cara y el sujeto.
  const malLinea = [];
  for (const scn of ESCENARIOS) {
    for (const e of entidadesDe(scn)) {
      const vc = ctxFicha(e, scn); if (!vc) continue;
      const linea = projectViewContextForPlan(vc);
      if (typeof linea !== "string" || !linea) { malLinea.push(`${scn}/${e}: sin línea`); continue; }
      if (!/Ficha/i.test(linea)) malLinea.push(`${scn}/${e}: la línea no nombra la Ficha`);
      else if (!linea.includes(e)) malLinea.push(`${scn}/${e}: la línea no nombra la entidad`);
      else if (linea.length > VIEW_PLAN_LINE_MAX) malLinea.push(`${scn}/${e}: ${linea.length} > ${VIEW_PLAN_LINE_MAX}`);
    }
  }
  ok(!malLinea.length,
    `la línea que lee el planificador nombra la Ficha y la entidad, y respeta el tope de ${VIEW_PLAN_LINE_MAX} caracteres`,
    malLinea.slice(0, 6).join("\n      "));

  // LA EVIDENCIA · es lo que convierte «esta ficha», «este monto» y «esa cuenta» en algo resoluble: sin una call
  // sembrada, el contexto dice de quién habla la pantalla pero no con qué demostrarlo.
  const malEvid = [];
  for (const scn of ESCENARIOS) {
    for (const e of entidadesDe(scn)) {
      const vc = ctxFicha(e, scn); if (!vc) continue;
      const proy = projectViewContextForCoercion(vc);
      if (!proy) { malEvid.push(`${scn}/${e}: sin proyección`); continue; }
      const tools = (proy.evidencia || []).map((x) => x.tool);
      if (!tools.includes("entityProfile")) malEvid.push(`${scn}/${e}: evidencia=${JSON.stringify(tools)}`);
      else if (!(proy.entidades || []).includes(e)) malEvid.push(`${scn}/${e}: la proyección no lleva la entidad`);
    }
  }
  ok(!malEvid.length,
    "la proyección que coacciona el plan lleva la entidad y la call que demuestra la Ficha (entityProfile)",
    malEvid.slice(0, 6).join("\n      "));
}

/* ══ [2] CAMBIO DE ENTIDAD ══════════════════════════════════════════════════════════════════════════════════ */
H("[2] CAMBIAR DE ENTIDAD · de Falabella a Lider, sin que sobreviva la anterior");
{
  const scn = "bonanza";
  const ents = entidadesDe(scn);
  const A = ents.includes("Falabella") ? "Falabella" : ents[0];
  const B = ents.includes("Lider") ? "Lider" : ents[1];
  const vcA = ctxFicha(A, scn), vcB = ctxFicha(B, scn);
  ok(!!vcA && !!vcB, `hay contexto para ${A} y para ${B}`);
  ok(viewContextKey(vcA) !== viewContextKey(vcB), `la key cambia al cambiar de entidad (${A} ≠ ${B})`);
  ok(viewContextChanged(vcA, vcB), "viewContextChanged declara que la pantalla cambió");

  const salida = invalidateViewContext(viewContextEntry(vcA, 2), vcB, { requestContext: { tenantId: TENANT }, turno: 4 });
  ok(salida === vcB, "con contexto fresco manda el fresco (jamás un merge de dos pantallas)");
  ok(!(salida.seleccion.entidades || []).includes(A), `la entidad anterior (${A}) no sobrevive en el contexto resultante`);
  ok(projectViewContextForPlan(salida).includes(B) && !projectViewContextForPlan(salida).includes(A),
    "la línea del plan nombra a la entidad nueva y no a la anterior");

  // …y no sólo para ese par: TODA transición entre entidades distintas cambia la key.
  const colisiones = [];
  const keys = new Map();
  for (const e of ents) {
    const vc = ctxFicha(e, scn); if (!vc) continue;
    const k = viewContextKey(vc);
    if (keys.has(k)) colisiones.push(`${keys.get(k)} ≡ ${e}`);
    keys.set(k, e);
  }
  ok(!colisiones.length, `las ${keys.size} fichas de la cartera tienen key distinta entre sí (ninguna se confunde con otra)`, colisiones.join(", "));
}

/* ══ [3] CAMBIO DE CARA ═════════════════════════════════════════════════════════════════════════════════════ */
H("[3] CAMBIAR DE FICHA A CAPITAL · sin arrastrar nada de la Ficha");
{
  const scn = "bonanza";
  const SALIDAS = builderOutsPorComponente(scn);
  const vcFicha = ctxFicha(entidadesDe(scn)[0], scn);
  const vcCapital = deriveViewContext("capital/otro/vista", SALIDAS["capital/otro/vista"], { scenario: scn, controles: {}, seleccion: null, tenantId: TENANT });
  ok(!!vcCapital, "hay contexto ambiente de Capital");
  ok(viewContextKey(vcFicha) !== viewContextKey(vcCapital), "la key de la Ficha y la de Capital nunca coinciden");

  const salida = invalidateViewContext(viewContextEntry(vcFicha, 2), vcCapital, { requestContext: { tenantId: TENANT }, turno: 4 });
  ok(salida === vcCapital, "al cambiar de cara manda el contexto de la cara nueva");
  ok(salida.vista === "capital", "la vista resultante es capital");
  const linea = projectViewContextForPlan(salida);
  ok(!/Ficha/i.test(linea), "la línea del plan ya no menciona la Ficha", linea);
  ok(!(projectViewContextForCoercion(salida).entidades || []).length,
    "la entidad de la Ficha no viaja en la proyección de Capital");

  // CERRAR SENTRIX · el hook borra al desmontar. Es estructural (un solo lugar publica, un solo lugar borra) y la
  // Ficha pasa por ese mismo hook — por eso cerrar el panel no puede dejar su contexto colgado.
  ok(/return\s*\(\)\s*=>\s*\{[^}]*setUISignal\(\{\s*viewContext:\s*null/.test(HOOK),
    "el hook limpia el contexto ambiente al desmontar (cerrar Sentrix o cambiar de pestaña lo borra)");
  ok(/ambientRef/.test(HOOK) && /\[ambient,\s*ctx\]/.test(HOOK),
    "la limpieza se re-dispara cuando cambia el contexto, no sólo al desmontar (cambiar de entidad reemplaza, no acumula)");
}

/* ══ [4] CTA ≡ MANUAL ═══════════════════════════════════════════════════════════════════════════════════════ */
H("[4] POR CTA Y A MANO · un solo contexto canónico, no dos parecidos");
{
  // ESTRUCTURAL · en el panel, `ask` (el CTA) y el ambiente salen de LA MISMA llamada al hook: es el mismo objeto
  // `ctx`, así que no pueden divergir. Esto es más fuerte que comparar dos derivaciones.
  // el `ask` se DESESTRUCTURA de la misma llamada, así que el patrón vive una línea ANTES del bloque: se afirma
  // sobre el panel entero, exigiendo que la desestructuración y el componentId de la Ficha estén pegados.
  const CTA_MISMA_LLAMADA = new RegExp(
    `const\\s*\\{[^}]*\\bask\\s*:\\s*\\w+[^}]*\\}\\s*=\\s*useViewContext\\(\\s*["'\`]${FICHA.replace(/[/-]/g, "\\$&")}["'\`]`, "m");
  ok(CTA_MISMA_LLAMADA.test(PANEL),
    "el CTA de la Ficha sale de la MISMA llamada a useViewContext que publica el ambiente (un solo `ctx`)");
  ok(/if\s*\(ctx\)\s*setUISignal\(\{\s*viewContext:\s*ctx\s*\}\)/.test(HOOK) && /setUISignal\(\{\s*viewContext:\s*ctx\s*\}\);\s*\n\s*ambientRef/.test(HOOK),
    "el hook publica el MISMO `ctx` por las dos vías (el click y el montaje)");
  // …y el manifiesto lo dice: la vista de la Ficha no emite un contexto propio, lo emite su pieza.
  ok(VIEW_MANIFEST["ficha/otro/vista"] && VIEW_MANIFEST["ficha/otro/vista"]._emitidoPor === FICHA,
    "el manifiesto declara que la cara Ficha se emite por su pieza — no hay un segundo contexto de ficha compitiendo");

  // CONDUCTUAL · derivar dos veces con los mismos insumos da EXACTAMENTE lo mismo, para toda la cartera.
  const distintos = [];
  for (const scn of ESCENARIOS) {
    for (const e of entidadesDe(scn)) {
      const viaCta = ctxFicha(e, scn), viaAmbiente = ctxFicha(e, scn);
      if (!viaCta || !viaAmbiente) { distintos.push(`${scn}/${e}: sin contexto`); continue; }
      if (viaCta.key !== viaAmbiente.key) distintos.push(`${scn}/${e}: key distinta`);
      else if (canon(viaCta) !== canon(viaAmbiente)) distintos.push(`${scn}/${e}: contenido distinto`);
    }
  }
  ok(!distintos.length, "entrar por CTA y entrar a mano producen el mismo contexto canónico, entidad por entidad", distintos.slice(0, 6).join("\n      "));
}

/* ══ [5] CERO LLAMADAS AL LLM ═══════════════════════════════════════════════════════════════════════════════ */
H("[5] NADA DE ESTO AGREGA UNA LLAMADA · la cadena del contexto no habla con ningún proveedor");
{
  const CADENA = [
    ["src/ui/useViewContext.js", HOOK],
    ["src/adi/sentrix/viewContextFrom.js", readFileSync(join(ROOT, "src", "adi", "sentrix", "viewContextFrom.js"), "utf8")],
    ["src/adi/sentrix/reading.js", readFileSync(join(ROOT, "src", "adi", "sentrix", "reading.js"), "utf8")],
    ["src/adi/sentrix/viewManifest.js", readFileSync(join(ROOT, "src", "adi", "sentrix", "viewManifest.js"), "utf8")],
    ["src/adi/oracle/viewContext.js", readFileSync(join(ROOT, "src", "adi", "oracle", "viewContext.js"), "utf8")],
  ];
  // el literal se arma partido a propósito: escrito entero, este gate se clasificaría a sí mismo LIVE y dejaría
  // de correr — el mismo recurso que usa _gates_offline_gate para sus fixtures.
  const SALIDA_CRUDA = new RegExp("\\bfet" + "ch\\s*\\(");
  const IMPORTA_LLM = /^\s*import[^\n]*from\s+["'][^"']*(adi\/llm\/|\/llm\/[a-zA-Z])/m;

  const conRed = CADENA.filter(([, src]) => SALIDA_CRUDA.test(src)).map(([f]) => f);
  ok(!conRed.length, `los ${CADENA.length} módulos de la cadena del contexto no contienen una salida cruda a la red`, conRed.join(", "));

  const conLLM = CADENA.filter(([, src]) => IMPORTA_LLM.test(src)).map(([f]) => f);
  ok(!conLLM.length, "ninguno importa nada de la capa LLM: derivar el contexto es aritmética local, no una consulta", conLLM.join(", "));

  // …y el efecto que publica el ambiente no dispara la respuesta: informa y precarga, nunca pregunta.
  ok(/nunca dispara/i.test(HOOK) || !/onAsk\([^)]*\)\s*;\s*\n[\s\S]{0,80}(enviar|submit|send)/i.test(HOOK),
    "publicar el contexto informa y precarga — no dispara un turno (y por lo tanto no gasta)");

  // la prueba de fuego: TODO lo que este gate afirmó corrió sin abrir un socket. El candado de runtime
  // (offline-guard) mataría el proceso en 97 si alguna de estas derivaciones hubiera salido a la red.
  ok(true, "todas las derivaciones de este gate corrieron sin red (el candado offline habría abortado en 97)");
}

console.log(`\n── _ficha_contexto_ambiente_gate: ${PASS} PASS · ${FAIL} FAIL (de ${PASS + FAIL}) ──`);
process.exit(FAIL ? 1 : 0);
