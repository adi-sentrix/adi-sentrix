/* === _dato_al_plan_gate.mjs · EL DATO Y EL PENDIENTE AL PLANIFICADOR (owner 2026-08-14) =========================
 * @inspeccion-estatica — este gate verifica el cableado LEYENDO fuentes como texto (nunca las ejecuta): no importa
 * el gateway ni ningún adapter, no invoca a nadie, y el candado de runtime (offline-guard) aplica igual.
 *
 * EL DEFECTO QUE FIJA, medido en vivo por el owner (5 llamadas, 2026-08-14): con la MISMA proyección del dato que
 * hoy recibe el narrador —y sin plan, sin tools, sin boleta y sin muro— el modelo sostuvo un hilo de tres turnos
 * («Si subo ventas 4%…» → «sobre las ventas» → «simula sobre el total de ventas») sin perder el supuesto ni el
 * alcance. ADI, con el mismo hilo, corrió en el tercer turno una simulación de COSTO que nadie pidió. La
 * diferencia no está en quien narra: está en que quien DECIDE qué tools pedir no veía nada — ni el mapa del
 * negocio (buildPlanUserMessage le manda el hilo recortado, la pregunta y la línea de vista, nada más) ni la
 * simulación a medias (renderInteractionMemory surfaceaba las cuatro capas de memoria y el alcance activo, pero
 * NUNCA `mem.pendingSimulation`).
 *
 * LAS CINCO GARANTÍAS (suite 148 → 149):
 *   1 · EL DATO LLEGA AL SYSTEM DE PLAN, entero y con su doctrina.
 *   2 · EL PREFIJO SIGUE SIENDO PREFIJO — el fijo de siempre es prefijo ESTRICTO del fijo con dato (el caché se
 *       extiende, nunca se parte) y el bloque cierra el fijo; el corte no puede caer dentro de la proyección.
 *   3 · SIN EL CAMPO, BYTE-IDÉNTICO — todo caller de 4 argumentos produce el system de hoy, carácter por carácter.
 *   4 · EL BLOQUE DECLARA QUE ES PARA DECIDIR, NO PARA RESPONDER — las cuatro reglas, y la prohibición de copiar
 *       cifras al plan (PLAN emite JSON de tools: una cifra suya envenena un `args`, no una pantalla).
 *   5 · EL PENDIENTE SE RINDE CON SU VARIABLE Y SU FALTANTE, respeta el plazo de su dueño, y cae del lado
 *       VARIABLE del caché en LAS DOS pasadas (no toca el prefijo cacheable de ninguna).
 */
import { initTenant } from "./src/data/tenantStore.js";
import { TENANT_DEMO } from "./src/data/tenants/demo.js";
import { proyectarDatoNegocio } from "./src/adi/oracle/datoProyectado.js";
import { buildPlanSystem, buildPlanSystemSegments, DOCTRINA_DATO_PLAN, DOCTRINA_CONTEXTO_VISTA, PLAN_TOOL } from "./src/adi/oracle/planPrompt.js";
import { buildNarrateSystemSegments } from "./src/adi/oracle/narratePromptC.js";
import { ADI_PERSONA, ADI_PERSONA_PLAN, renderInteractionMemory } from "./src/adi/oracle/persona.js";
import { PENDING_SIM_TTL_TURNOS } from "./src/adi/oracle/conversationScope.js";
import { readFileSync } from "node:fs";

initTenant(TENANT_DEMO);

let PASS = 0, FAIL = 0;
const ok = (c, m, extra = "") => { if (c) { PASS++; console.log("  ✓ " + m); } else { FAIL++; console.log("  ✗ " + m + (extra ? "\n      " + extra : "")); } };

const DATO = proyectarDatoNegocio("actual");
const MEM_VACIA = "";
const MEM_LLENA = renderInteractionMemory({ identidad: { nombre: "jc" }, preferencias: { prioridad: "financiero" } });

console.log("── 1 · EL DATO LLEGA AL SYSTEM DE PLAN ──");
const conDato = buildPlanSystem(ADI_PERSONA_PLAN, MEM_VACIA, "actual", false, DATO);
const sinDato = buildPlanSystem(ADI_PERSONA_PLAN, MEM_VACIA, "actual", false);
ok(conDato.includes(DATO), "la proyección entera viaja en el system de PLAN");
ok(conDato.includes(DOCTRINA_DATO_PLAN), "la doctrina del dato viaja con el bloque");
ok(conDato.indexOf(DOCTRINA_DATO_PLAN) < conDato.indexOf(DATO), "la doctrina va ANTES del bloque (declara qué es antes de que lo lea)");
ok(!sinDato.includes(DOCTRINA_DATO_PLAN), "sin el dato, la doctrina NO entra: un turno sin bloque no paga un token por reglas que no va a usar");

console.log("── 2 · EL PREFIJO SIGUE SIENDO PREFIJO (el caché se extiende, no se parte) ──");
const segCon = buildPlanSystemSegments(ADI_PERSONA_PLAN, MEM_VACIA, "actual", false, DATO);
const segSin = buildPlanSystemSegments(ADI_PERSONA_PLAN, MEM_VACIA, "actual", false);
ok(segCon.fijo.startsWith(segSin.fijo), "el fijo de SIEMPRE es prefijo del fijo con dato, byte por byte");
ok(segCon.fijo.length > segSin.fijo.length, "…y prefijo ESTRICTO: el bloque EXTIENDE el segmento cacheable");
ok(segCon.fijo.endsWith(DATO + "\n\n"), "el dato CIERRA el fijo: nada estable queda del lado variable por su culpa");
ok(segCon.fijo + segCon.variable === conDato, "`fijo + variable` sigue siendo byte por byte el system completo (con dato)");
ok(segSin.fijo + segSin.variable === sinDato, "…y sin dato también (la garantía vieja no se movió)");
// el corte del caché se busca por marcador de texto: si un marcador apareciera DENTRO de la proyección, el corte
// caería adentro del dato y partiría el bloque en dos. Se afirma que no puede pasar, no se supone.
// COLAPSO DEL EJE (retrabajo ultracode 2026-08-30): la línea del escenario murió; los marcadores de corte son
// ahora la doctrina de pantalla, la memoria (dinámica — no verificable acá) y la instrucción final. Se afirma
// que NINGUNO de los estáticos puede caer dentro de la proyección.
ok(!DATO.includes(DOCTRINA_CONTEXTO_VISTA) && !DATO.includes("Emití el plan con emitPlan."),
  "ningún marcador de corte aparece dentro de la proyección — el corte no puede caer adentro del bloque");
// el fijo es el MISMO con y sin línea de pantalla, con y sin memoria, en cualquier escenario de sesión: todo lo
// que varía por turno sigue del lado variable, así que el prefijo cacheable no se rompe entre turnos.
const CASOS = [
  { mem: MEM_VACIA, sc: "actual", vista: false }, { mem: MEM_LLENA, sc: "actual", vista: false },
  { mem: MEM_LLENA, sc: "actual", vista: true }, { mem: MEM_VACIA, sc: "tension", vista: true },
];
const fijos = CASOS.map((c) => buildPlanSystemSegments(ADI_PERSONA_PLAN, c.mem, c.sc, c.vista, DATO).fijo);
ok(fijos.every((f) => f === fijos[0]), "el FIJO con dato es byte-idéntico entre memoria/escenario/pantalla — el prefijo aguanta el turno a turno");
ok(CASOS.every((c) => {
  const s = buildPlanSystemSegments(ADI_PERSONA_PLAN, c.mem, c.sc, c.vista, DATO);
  return s.fijo + s.variable === buildPlanSystem(ADI_PERSONA_PLAN, c.mem, c.sc, c.vista, DATO);
}), "…y en los 4 casos el corte no pierde ni un byte");

console.log("── 3 · SIN EL CAMPO, BYTE-IDÉNTICO AL DE HOY ──");
ok(buildPlanSystem(ADI_PERSONA_PLAN, MEM_LLENA, "actual", true) === buildPlanSystem(ADI_PERSONA_PLAN, MEM_LLENA, "actual", true, null),
  "4 argumentos y 5 con null producen el MISMO system (los ~30 callers/gates viejos no se mueven)");
ok(buildPlanSystem(ADI_PERSONA_PLAN, MEM_LLENA, "actual", true) === buildPlanSystem(ADI_PERSONA_PLAN, MEM_LLENA, "actual", true, ""),
  "…y un string vacío tampoco cuela un bloque de aire");
{
  const a = buildPlanSystemSegments(ADI_PERSONA_PLAN, MEM_LLENA, "tension", true);
  const b = buildPlanSystemSegments(ADI_PERSONA_PLAN, MEM_LLENA, "tension", true, null);
  ok(a.fijo === b.fijo && a.variable === b.variable, "los segmentos también: sin dato, el corte del caché queda donde estaba");
}

console.log("── 4 · EL BLOQUE DECLARA QUE ES PARA DECIDIR, NO PARA RESPONDER ──");
const REGLAS_DATO = [
  [/NO RESPOND[EÉ]S CON ESTO/, "no se responde con el bloque (PLAN emite JSON, no prosa)"],
  [/NO COPIES NI UNA CIFRA AL PLAN/, "ninguna cifra del bloque va a args ni a rationale"],
  [/ELIJAS BIEN LA HERRAMIENTA Y EL ALCANCE/, "para qué está: elegir tool y alcance"],
  [/USALO PARA ACERTAR EL NOMBRE, EL EJE Y LA TOOL/, "el nombre y el eje son un HECHO del dato, no del fraseo"],
  [/NO PLANIFIQUES CONTRA UN HUECO/, "no se arman calls contra lo que el dato declara ausente"],
  [/LOS DOS UNIVERSOS QUE NO RECONCILIAN/, "la divergencia entre universos también es ley para el plan"],
  [/NO reemplaza a las tools/, "el bloque no reemplaza a las tools: las cifras las trae el motor"],
];
const faltan = REGLAS_DATO.filter(([re]) => !re.test(DOCTRINA_DATO_PLAN)).map(([, n]) => n);
ok(faltan.length === 0, `las ${REGLAS_DATO.length} declaraciones del contrato del bloque están en el texto`, `faltan: ${faltan.join(" · ")}`);
// las DOS secciones que hacen declinar bien tienen que estar en el bloque que el PLAN lee (no solo en el del narrador)
ok(conDato.includes("LO QUE ESTE DATO NO TIENE") && conDato.includes("PROHIBIDO cruzarlos"),
  "el PLAN lee las dos secciones que le permiten NO pedir lo que no existe");

console.log("── 5 · EL PENDIENTE COMO SEÑAL (y de qué lado del caché cae) ──");
const PEND = { dimension: "cliente", entity: "Falabella", entities: ["Falabella"], known: { campo: "precioLista", delta_pct: 5 }, missingCampo: "unidades", restan: PENDING_SIM_TTL_TURNOS };
const bloqueP = renderInteractionMemory({ pendingSimulation: PEND });
ok(/Simulaci[oó]n EMPEZADA Y SIN CERRAR/.test(bloqueP), "el pendiente vivo se surfacea (antes: invisible para las dos pasadas)");
ok(/Falabella/.test(bloqueP) && /eje cliente/.test(bloqueP), "…nombra la entidad y el eje de la simulación");
ok(/el precio en \+5%/.test(bloqueP), "…rinde la variable YA DECLARADA con su valor y su signo");
ok(/FALTA el volumen \(unidades vendidas\)/.test(bloqueP), "…y declara QUÉ falta, con el vocabulario del producto");
ok(/es A ESTA simulaci[oó]n que se refiere/.test(bloqueP), "…redactado como SEÑAL, igual que lastOffer («si contesta eso, es A ESTO»)");
ok(/no la traigas tú/.test(bloqueP), "…con el freno que impide que la respuesta la mencione de oficio en un turno ajeno");
{
  const inverso = renderInteractionMemory({ pendingSimulation: { ...PEND, known: { campo: "unidades", delta_pct: -10 }, missingCampo: "precioLista" } });
  ok(/el volumen \(unidades vendidas\) en -10%/.test(inverso) && /FALTA el precio/.test(inverso),
    "el par se rinde en los dos sentidos (volumen declarado → falta el precio), con el signo negativo intacto");
}
// EL PLAZO LO JUZGA SU DUEÑO: un pendiente vencido o mal formado NO se surfacea — una señal a medias es peor que
// ninguna, porque el LLM la completaría inventando.
ok(renderInteractionMemory({ pendingSimulation: { ...PEND, restan: 0 } }) === "", "un pendiente VENCIDO no se surfacea (el plazo es el de conversationScope, no uno nuevo)");
ok(renderInteractionMemory({ pendingSimulation: { ...PEND, entity: null, entities: [] } }) === "", "un pendiente sin entidad no se surfacea");
ok(renderInteractionMemory({ pendingSimulation: { ...PEND, known: null } }) === "", "un pendiente sin la variable conocida no se surfacea");
ok(renderInteractionMemory({}) === "" && renderInteractionMemory(null) === "", "sin pendiente, el bloque de memoria queda como siempre (vacío es vacío)");
// DE QUÉ LADO DEL CACHÉ CAE, en las DOS pasadas: la memoria ya viajaba en el segmento variable de ambas, así que
// surfacear el pendiente NO puede tocar ningún prefijo cacheable. Se afirma, no se supone.
{
  const p = buildPlanSystemSegments(ADI_PERSONA_PLAN, bloqueP, "actual", false, DATO);
  ok(p.variable.includes(bloqueP) && !p.fijo.includes("Simulación EMPEZADA"), "PLAN: el pendiente cae del lado VARIABLE — el prefijo cacheable no se mueve");
  const pSin = buildPlanSystemSegments(ADI_PERSONA_PLAN, "", "actual", false, DATO);
  ok(p.fijo === pSin.fijo, "…y el fijo de PLAN es el MISMO con y sin pendiente en la memoria");
}
{
  const n = buildNarrateSystemSegments(ADI_PERSONA, bloqueP, "default", null, false, null, DATO);
  const nSin = buildNarrateSystemSegments(ADI_PERSONA, "", "default", null, false, null, DATO);
  ok(n.variable.includes(bloqueP) && !n.fijo.includes("Simulación EMPEZADA"), "NARRAR: idem — el pendiente viaja en la cola variable");
  ok(n.fijo === nSin.fijo, "…y el fijo de NARRAR (con el dato adentro) no se mueve por la memoria del turno");
}

console.log("── 6 · EL CABLEADO (leído de la fuente, nunca ejecutado) ──");
const GW = readFileSync(new URL("./src/adi/llm/gatewayCore.js", import.meta.url), "utf8");
ok(/export async function handlePlan\(\{[^}]*datoNegocio/.test(GW), "el handler de PLAN acepta `datoNegocio` del body (campo hermano, como en la pasada de narrar)");
ok(/buildPlanSystemSegments\([\s\S]{0,320}?datoNegocio/.test(GW), "…y se lo pasa al builder segmentado");
ok(/const system = \[\{ text: _seg\.fijo, cache: true \}/.test(GW), "…y el fijo de PLAN sigue declarado cache:true (el dato queda del lado que el caché sirve)");
const UI = readFileSync(new URL("./src/ui/ChatADI.jsx", import.meta.url), "utf8");
ok(/body: JSON\.stringify\(\{ text, history, mem, scenario,[^\n]*datoNegocio: proyectarDatoNegocio\(scenario\)/.test(UI),
  "el fetcher de PLAN manda la MISMA proyección que el de narrar (misma función, mismo memo por tenant+escenario)");
// EL CONTRATO DE SALIDA DE PLAN NO SE MOVIÓ: se afirma sobre el schema serializado, no sobre el texto del archivo
// (el comentario de la doctrina nombra el campo, y un chequeo de texto lo confundiría con el schema).
ok(!/datoNegocio/i.test(JSON.stringify(PLAN_TOOL)), "el schema del plan no conoce el dato: el contrato de salida de PLAN queda intacto");

console.log(`\n── _dato_al_plan_gate: ${PASS} PASS · ${FAIL} FAIL ──`);
process.exit(FAIL ? 1 : 0);
