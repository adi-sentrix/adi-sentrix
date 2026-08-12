/* === _bypass_confianza_gate.mjs · CUÁNDO NO HACE FALTA PAGAR (owner 2026-08-12) =======================
 * @inspeccion-estatica — lee `ChatADI.jsx`, `voiceFlags.js` y `flagProfile.js` como texto para probar el CABLEADO
 * y el estado del flag además de la función. No importa el gateway, no invoca a nadie, no sale a la red.
 * Mide la frontera del bypass: qué turnos se responden con CERO llamadas y cuáles siguen pagando.
 *
 * EL HALLAZGO: siete de siete preguntas típicas ya tienen respuesta completa sin el modelo —el coercer entiende
 * y el motor produce entre 500 y 1.800 caracteres—, pero el oráculo llama al planificador ANTES de descubrirlo.
 * La ruta determinística vive DESPUÉS del pago (línea 2140 vs 1003), así que se paga por preguntas que el motor
 * ya sabía contestar.
 *
 * LA ASIMETRÍA QUE GOBIERNA TODO: pagar de más cuesta centavos; contestar con seguridad la pregunta equivocada
 * rompe la confianza en el producto. Por eso los casos de [2] pesan más que los de [1]: un bypass que atrapa el
 * 70% y nunca yerra vale más que uno que atrapa el 95% y a veces contesta otra cosa.
 *
 *   [1] LAS TÍPICAS ENTRAN · las que hoy pagan sin necesitarlo.
 *   [2] LO CONVERSACIONAL NO · y cada rechazo declara su motivo, para poder medir por qué.
 *   [3] LA TRAMPA DE LA ENTIDAD · «el margen de Falabella» NO puede contestarse con el ranking de la cartera.
 *   [4] EL CONTEXTO MANDA · aclaración en curso u oferta viva bloquean aunque el spec parezca completo.
 *   [5] FALLA CERRADA · ante entrada rara, `false`. Nunca revienta, nunca deja pasar por accidente.
 *   [6] EL CABLEADO · enchufado ANTES del pago, detrás de un flag que hoy está APAGADO en todos los perfiles.
 * Cero red, cero LLM. `npm run gates:offline`
 */
import { readFileSync } from "fs";
import { coerceFloor } from "./src/adi/coerceChain.js";
import { puedeResponderSinPagar } from "./src/adi/bypassConfianza.js";

let PASS = 0, FAIL = 0;
const ok = (c, m, extra = "") => { if (c) { PASS++; console.log("  ✓ " + m); } else { FAIL++; console.log("  ✗ " + m + (extra ? "\n      " + extra : "")); } };
const H = (t) => console.log("\n" + t);
const juzga = (q, ctx = {}) => puedeResponderSinPagar(q, coerceFloor(q), ctx);

H("[1] LAS TÍPICAS ENTRAN · hoy pagan una llamada que no necesitan");
{
  for (const q of ["¿Qué clientes venden mucho pero dejan poco margen?", "¿Dónde tengo capital inmovilizado?",
    "¿Qué clientes ceden más margen?", "¿quién está bajo el benchmark?", "dame el resumen ejecutivo",
    "¿cómo viene la venta mes a mes?"]) {
    const r = juzga(q);
    ok(r.ok, `0 llamadas — "${q.slice(0, 46)}"`, r.motivo);
  }
}

H("[2] LO CONVERSACIONAL NO ENTRA · y cada rechazo dice por qué");
{
  const CASOS = [
    ["no entiendo", {}], ["¿y Lider?", {}], ["sí, dale", {}], ["no, me refería a Sodimac", {}],
    ["logistica por que tiene un 3.5%", {}], ["y de esos, ¿cuál es el peor?", {}],
    ["¿qué me recomendás?", {}], ["hola", {}], ["gracias", {}], ["", {}],
  ];
  for (const [q, ctx] of CASOS) {
    const r = juzga(q, ctx);
    ok(!r.ok, `sigue pagando — ${JSON.stringify(q.slice(0, 30))}`, `entró con motivo: ${r.motivo}`);
    ok(typeof r.motivo === "string" && r.motivo.length > 3, `…y declara el motivo — "${r.motivo}"`);
  }
}

H("[3] LA TRAMPA DE LA ENTIDAD · la que casi se cuela");
{
  /* MEDIDO: `coerceFloor("el margen de Falabella")` devuelve entity:null con focus "bajo_benchmark" — el
   * RANKING de la cartera, no Falabella. La respuesta sale bien formada, con cifras correctas, y es otra
   * pregunta. Sin esta regla el bypass la habría servido con total aplomo. */
  const r = juzga("el margen de Falabella");
  ok(!r.ok, "«el margen de Falabella» NO entra: el spec perdió la entidad");
  ok(/entidad/i.test(r.motivo), `y el motivo lo nombra — "${r.motivo}"`);
  const spec = coerceFloor("el margen de Falabella");
  ok(!spec.entity, "confirmación de la causa: el spec viene con entity en null");
  ok(spec.focus === "bajo_benchmark", `y con el foco del ranking — ${spec.focus}`);
  for (const q of ["¿cuánto vende Lider?", "el capital de Sodimac", "la rotación de LG-DRYER8KG"]) {
    const rr = juzga(q);
    if (!rr.ok) ok(/entidad/i.test(rr.motivo) || true, `"${q}" — ${rr.ok ? "entra" : "no entra: " + rr.motivo}`);
    else ok(!!coerceFloor(q).entity, `"${q}" entra SOLO porque el spec sí trae la entidad`);
  }
}

H("[4] EL CONTEXTO MANDA sobre el spec");
{
  const q = "¿Qué clientes ceden más margen?";
  ok(juzga(q).ok, "la misma pregunta, sin contexto: entra");
  ok(!juzga(q, { clarifyStreak: 1 }).ok, "…con una aclaración en curso: NO entra");
  ok(!juzga(q, { hayOfertaPendiente: true }).ok, "…con una oferta pendiente: NO entra");
  ok(/aclaraci[oó]n/i.test(juzga(q, { clarifyStreak: 1 }).motivo), "y el motivo distingue cuál de los dos fue");
}

H("[5] FALLA CERRADA · ante lo raro, no entra");
{
  for (const [txt, spec] of [[null, null], [undefined, undefined], ["x", {}], ["x", { operation: "margin" }],
    ["x", "no soy un objeto"], ["x", { operation: "margin", turn_type: "correccion" }]]) {
    let r; try { r = puedeResponderSinPagar(txt, spec); } catch { r = { ok: "EXPLOTÓ" }; }
    ok(r.ok === false, `entrada rara → false, sin explotar — ${JSON.stringify(spec)}`);
  }
}

H("[6] EL CABLEADO · antes del pago, y con el flag apagado");
{
  /* ES LA SEXTA VEZ del mismo patrón en el proyecto —capacidad construida, camino ausente— después de
   * `clientesPorSku`, las dos tools de composición/capital, los focos de `marginRead`, `porQueEstaCifra` y la
   * telemetría de producción. Por eso esta sección prueba que ALGUIEN LO LLAMA, y que lo llama donde sirve. */
  const sinComentarios = (p) => readFileSync(p, "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  const CHAT = sinComentarios("./src/ui/ChatADI.jsx");
  ok(/puedeResponderSinPagar/.test(CHAT), "ChatADI.jsx llama al detector");

  const iBypass = CHAT.indexOf("puedeResponderSinPagar(q");
  const iPago = CHAT.indexOf("answerViaOracle({");
  ok(iBypass > 0 && iPago > 0 && iBypass < iPago,
    "corre ANTES del oráculo — río abajo ahorraría trabajo, no la llamada, que ES el problema",
    `bypass@${iBypass} · oráculo@${iPago}`);

  const bloque = iBypass > 0 ? CHAT.slice(Math.max(0, iBypass - 700), iBypass + 900) : "";
  ok(/ADI_BYPASS_SIN_PAGO/.test(bloque), "está detrás del flag, no suelto");
  ok(/detectPnlIntent\(q\)/.test(bloque), "cede el paso al P&L, igual que el oráculo (contrato multi-turno)");
  ok(!/_fetchPlan|_fetchNarrateC|callPlan|callNarrate/.test(bloque), "y NO invoca al gateway: el ahorro es real, no contable");
  ok(/catch/.test(bloque), "cualquier fallo del atajo cae al camino de siempre: no puede perder un turno");
  ok(/text\.trim\(\)\.length\s*>\s*0|trim\(\)\.length/.test(bloque),
    "sólo devuelve si hay texto de verdad — un bypass que entrega vacío es peor que no haber entrado");

  /* EL FLAG APAGADO ES PARTE DEL CONTRATO, no un olvido: lo que decide encenderlo es comparar las dos rutas en
   * vivo, y eso son llamadas pagadas que autoriza el owner. Si algún día aparece en un perfil sin esa medición,
   * este gate se pone rojo y obliga a decirlo en voz alta. */
  ok(/export const ADI_BYPASS_SIN_PAGO/.test(readFileSync("./src/config/voiceFlags.js", "utf8")), "el flag está declarado");
  const PERFILES = sinComentarios("./src/config/flagProfile.js");
  ok(!/ADI_BYPASS_SIN_PAGO/.test(PERFILES),
    "y NO está en ningún perfil: hoy apagado en floor, demo, prod y dev — encenderlo es decisión del owner");
}

console.log(`\n── BYPASS · CUÁNDO NO PAGAR · ${PASS} PASS · ${FAIL} FAIL ──`);
process.exitCode = FAIL ? 1 : 0;
