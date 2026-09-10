/* === _forma_conversacional_gate.mjs · LA FORMA DE LA PREGUNTA MANDA =========================================
 *
 * LA REGLA DEL OWNER (2026-09-09), textual y completa — cada frase tiene acá su chequeo:
 *   «Antes de construir rutas nuevas, necesitamos que las puertas actuales cedan cuando la pregunta es
 *    conversacional. Si la pregunta tiene forma de comparación, hipótesis, recuerdo, decisión, acción o
 *    contradicción, no puede ser secuestrada por ficha de cliente ni por margen general. La ficha de cliente
 *    solo debe ganar cuando el usuario pide realmente la ficha o el detalle de ese cliente. Margen general
 *    solo debe ganar cuando la pregunta es de margen general, no cuando margen aparece dentro de una
 *    comparación o tradeoff. La pregunta de quiebre de stock solo debe salir cuando se pidió un porqué, no
 *    como cierre automático de cualquier ficha.»
 *
 * EL INCIDENTE QUE LO ORIGINÓ, medido en producción y reproducido acá: tras un click en «Que ADI lo explique»,
 * durante ocho turnos, TRES preguntas distintas recibían la MISMA respuesta palabra por palabra —la ficha de
 * Falabella y «¿hubo un quiebre de stock?»—: una comparación, una hipótesis y una DECLARACIÓN del dueño. Un
 * censo de nueve rutas conversacionales encontró el mismo mecanismo en siete: no faltaban rutas, sobraban dos
 * puertas que se tragaban la conversación.
 *
 * ⚠️ ESTE CANDADO NO EXIGE QUE ADI RESPONDA BIEN. Exige que DEJE DE RESPONDER MAL — que es lo que el owner
 * ordenó primero, y a propósito: «antes de construir rutas nuevas». Que una de estas preguntas caiga a una
 * declinación honesta es el resultado ESPERADO hoy; responder la ficha de un cliente, no.
 *
 * OFFLINE · determinístico · CERO llamadas al modelo.
 * `node --import ./scripts/offline-guard.mjs _forma_conversacional_gate.mjs` */
import { initTenant, getTenantId } from "./src/data/tenantStore.js";
import { TENANT_DEMO } from "./src/data/tenants/demo.js";
import { formaConversacional, esConversacional, pideLaFicha } from "./src/adi/agente/formaConversacional.js";
import { answerViaAgente } from "./src/adi/agente/bucleAgente.js";
import { builderOutFor } from "./src/adi/sentrix/viewBuilderRun.js";
import { deriveViewContext } from "./src/adi/sentrix/viewContextFrom.js";
import { tituloDeExplicacion } from "./src/adi/sentrix/viewManifest.js";
import { ESCENARIO_INICIAL } from "./src/config/scenarios.js";

let pass = 0, fail = 0;
const ok = (cond, label, detalle) => {
  if (cond) { pass++; console.log(`  ✓ ${label}`); }
  else { fail++; console.log(`  ✗ ${label}`); if (detalle !== undefined) console.log(`      ${String(detalle).slice(0, 300)}`); }
};
const H = (t) => console.log(`\n${t}`);
const MUDO = async () => ({ tipo: "texto", texto: "" });
const ESC = ESCENARIO_INICIAL;   // el escenario que muestra la app — donde el owner vio el defecto

initTenant(TENANT_DEMO);

/* ═══ 1 · LAS SIETE FORMAS SE RECONOCEN ═════════════════════════════════════════════════════════════════════
 * Las seis que el owner enumeró, más la que disparó todo: pedirle a ADI que defienda su propio criterio. */
H("1 · las siete formas conversacionales — con las frases del owner, textuales");
{
  const CASOS = [
    ["justificar", ["¿Por qué mirarías La Polar si solo pesa 2.9% de la venta?", "¿Por qué dices que Jumbo convierte mejor cada peso vendido?", "¿en qué te basas?", "¿cómo sabes que Lider cae?"]],
    ["comparar", ["¿miro La Polar o Falabella?", "entre Ripley y Easy, ¿cuál primero?", "¿qué es más urgente, margen o cobranza?", "¿vendo más o protejo margen?"]],
    ["hipotesis", ["creo que es por descuentos, ¿estoy en lo correcto?", "¿será que Lider está comprando menos?", "¿es cierto que Falabella me está dejando menos?", "me parece que el problema es el costo, ¿tú qué ves?"]],
    ["recuerdo", ["recuerda que Falabella es apuesta mía", "ya sabes que en febrero cierro dos semanas", "eso cambia lo que me dijiste"]],
    ["decision", ["¿estoy tomando una mala decisión?", "¿me conviene seguir vendiendo a Falabella así?", "¿hago bien en priorizar volumen?", "¿debería dejar de venderle a La Polar?"]],
    ["accion", ["qué hago esta semana", "qué le digo al equipo comercial", "qué reviso primero mañana", "dame los tres pasos"]],
    ["contradiccion", ["¿por qué vendo más pero gano menos?", "crecí en venta pero mi margen bajó, ¿cómo se entiende?", "¿por qué tengo caja y aun así estoy apretado?"]],
  ];
  for (const [forma, frases] of CASOS) {
    const malas = frases.filter((f) => formaConversacional(f) !== forma);
    ok(malas.length === 0, `★ «${forma}»: las ${frases.length} frases del owner se reconocen`, malas.map((f) => `${f} → ${formaConversacional(f)}`).join(" · "));
  }
}

/* ═══ 2 · Y UNA LECTURA NORMAL NO ES CONVERSACIONAL ═════════════════════════════════════════════════════════
 * El riesgo de este candado es el inverso del que cierra: un detector que se activa de más apaga rutas que
 * hoy funcionan bien. Por eso el corpus de control es más largo que el de las formas. */
H("2 · las lecturas de siempre NO se tocan — el falso positivo acá apagaría lo que funciona");
{
  const LECTURAS = [
    "dame la ficha de Falabella", "cómo viene Falabella", "por qué cae mi margen", "cuánto vendí en marzo",
    "explícame el cuadro", "por qué febrero es el mes más bajo", "quiénes están bajo el benchmark",
    "muéstrame el margen por canal", "cuánto me deben", "profundiza en la contribución",
    "dónde está mi capital frenado", "el margen de Lider", "cómo va el negocio", "qué clientes caen",
    "dame los 3 riesgos para el directorio", "cuál es mi mejor cliente", "el stock de Samsung",
  ];
  const fp = LECTURAS.filter((q) => esConversacional(q));
  ok(fp.length === 0, `★★ ninguna de las ${LECTURAS.length} lecturas corrientes se marca como conversacional`, fp.map((q) => `${q} → ${formaConversacional(q)}`).join(" · "));
}

/* ═══ 3 · LAS PUERTAS CEDEN · EL INCIDENTE, REPRODUCIDO Y CERRADO ═══════════════════════════════════════════ */
H("3 · tras un click en la Mesa, una conversación natural ya no recibe la ficha de un cliente");
{
  const CID = "comercial/01/tabla-cartera";
  const vc = deriveViewContext(CID, builderOutFor(CID, ESC, { todos: "0" }), { scenario: ESC, controles: { todos: "0" }, tenantId: getTenantId() });
  const r0 = await answerViaAgente({ text: tituloDeExplicacion(CID), history: [], mem: {}, scenario: ESC, callAgente: MUDO, viewContext: vc, cuadro: vc });
  ok(r0.r.agente.estado === "playbook" && /Falabella|cartera|venta/i.test(String(r0.r.text || "")),
    "el click sigue funcionando: la lectura del cuadro no se tocó", r0.r.agente.estado);
  const hist = [{ role: "user", text: "x" }, { role: "adi", text: r0.r.text }];

  /* LAS TRES FRASES QUE RECIBÍAN LA MISMA RESPUESTA, palabra por palabra */
  const ANTES = ["¿miro La Polar o Falabella?", "¿es cierto que Falabella me está dejando menos?", "recuerda que Falabella es apuesta mía"];
  const respuestas = [];
  for (const q of ANTES) {
    const r = await answerViaAgente({ text: q, history: hist, mem: r0.mem, scenario: ESC, callAgente: MUDO });
    const T = String(r.r.text || "");
    respuestas.push(T);
    ok(!/^Falabella: venta/m.test(T) && !/quiebre de stock/.test(T),
      `★★ «${q}» ya NO recibe la ficha de un cliente ni la pregunta del quiebre de stock`, T.split("\n")[0]);
  }
  ok(new Set(respuestas.map((t) => t.slice(0, 60))).size > 1 || respuestas.every((t) => /No tengo informaci/.test(t)),
    "★ …y tres preguntas distintas dejan de tener LA MISMA respuesta (el síntoma que el owner vio)");

  /* LAS DOS DEL INCIDENTE ORIGINAL */
  for (const q of ["¿Por qué mirarías La Polar si solo pesa 2.9% de la venta?", "¿Por qué dices que Jumbo convierte mejor cada peso vendido?"]) {
    const r = await answerViaAgente({ text: q, history: hist, mem: r0.mem, scenario: ESC, callAgente: MUDO });
    const T = String(r.r.text || "");
    ok(!/es participación de|No es una cuenta mía/.test(T) && !/quiebre de stock/.test(T),
      `★★ «${q.slice(0, 46)}…» ya no recibe la procedencia de la cifra ni la ficha de la fila`, T.split("\n")[0]);
  }
}

/* ═══ 4 · LO QUE SIGUE GANANDO · las excepciones que el owner dejó escritas ═════════════════════════════════ */
H("4 · la ficha gana si la piden · el margen general sigue siendo suyo · su continuación también");
{
  ok(pideLaFicha("dame la ficha de Falabella") && pideLaFicha("cómo viene Falabella"),
    "★ pedir la ficha se reconoce como tal");
  ok(!pideLaFicha("¿miro La Polar o Falabella?") && !pideLaFicha("recuerda que Falabella es apuesta mía"),
    "…y nombrar a alguien dentro de otra conversación NO es pedir su ficha");
  const rF = await answerViaAgente({ text: "dame la ficha de Falabella", history: [], mem: {}, scenario: ESC, callAgente: MUDO });
  ok(rF.r.agente.estado === "playbook" && /Falabella/.test(String(rF.r.text || "")),
    "★★ y la ficha PEDIDA sigue respondiendo: se cerró el secuestro, no la ruta", rF.r.agente.estado);
  const rM = await answerViaAgente({ text: "cómo viene mi margen?", history: [], mem: {}, scenario: ESC, callAgente: MUDO });
  ok(rM.r.agente.estado === "playbook" && /margen/i.test(String(rM.r.text || "")),
    "★★ el margen GENERAL sigue siendo del margen — la regla es que no gane una conversación ajena", rM.r.agente.estado);
  /* ⚠️ SU PROPIA CONTINUACIÓN TAMBIÉN, y esto lo cazó el gate de playbooks cuando la guarda quedó antes de las
   * puertas de seguimiento: «¿y qué harías primero?» tras una lectura de margen tiene forma de ACCIÓN, pero es
   * el seguimiento legítimo de este mismo playbook. El orden importa. */
  const hM = [{ role: "user", text: "cómo viene mi margen?" }, { role: "adi", text: rM.r.text }];
  const rSeg = await answerViaAgente({ text: "¿y qué harías primero?", history: hM, mem: rM.mem, scenario: ESC, callAgente: MUDO });
  ok(rSeg.r.agente.estado === "playbook",
    "★★ …y «¿y qué harías primero?» tras una lectura de margen SIGUE abriendo: su continuación es suya", rSeg.r.agente.estado);
}

/* ═══ 5 · LA PREGUNTA DEL QUIEBRE DE STOCK, SOLO CON PORQUÉ ═════════════════════════════════════════════════ */
H("5 · el cierre por la causa solo sale si pidieron un porqué");
{
  const CID = "comercial/01/tabla-cartera";
  const vc = deriveViewContext(CID, builderOutFor(CID, ESC, { todos: "0" }), { scenario: ESC, controles: { todos: "0" }, tenantId: getTenantId() });
  const r0 = await answerViaAgente({ text: tituloDeExplicacion(CID), history: [], mem: {}, scenario: ESC, callAgente: MUDO, viewContext: vc, cuadro: vc });
  const hist = [{ role: "user", text: "x" }, { role: "adi", text: r0.r.text }];
  const rPorQue = await answerViaAgente({ text: "y ripley por que cae?", history: hist, mem: r0.mem, scenario: ESC, callAgente: MUDO });
  ok(/quiebre de stock/.test(String(rPorQue.r.text || "")),
    "★ con un PORQUÉ, la pregunta por la causa sí sale — es el paso 3 de la ley del porqué");
  const rSin = await answerViaAgente({ text: "y ripley?", history: hist, mem: r0.mem, scenario: ESC, callAgente: MUDO });
  const T = String(rSin.r.text || "");
  ok(!/quiebre de stock/.test(T),
    "★★ …y SIN porqué no sale: preguntarle al dueño qué le pasó a una cuenta que nadie cuestionó es no haber leído el turno", T.split("\n").pop());
}

/* ═══ 6 · EL DETECTOR VIVE EN UN SOLO LUGAR ════════════════════════════════════════════════════════════════ */
H("6 · una sola definición de «forma conversacional» en toda la casa");
{
  ok(typeof formaConversacional === "function" && typeof esConversacional === "function" && typeof pideLaFicha === "function",
    "el módulo exporta las tres piezas: la forma, la guarda y la excepción de la ficha");
  ok(formaConversacional("") === null && formaConversacional(null) === null && formaConversacional(undefined) === null,
    "…y con entrada vacía o nula no inventa una forma");
}

console.log(`\n── _forma_conversacional_gate: ${pass} PASS · ${fail} FAIL (de ${pass + fail}) ──`);
process.exit(fail ? 1 : 0);
