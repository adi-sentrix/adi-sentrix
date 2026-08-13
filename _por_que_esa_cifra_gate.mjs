/* === _por_que_esa_cifra_gate.mjs · «¿POR QUÉ ESA CIFRA?» TIENE RESPUESTA (owner 2026-08-12) ===========
 * @inspeccion-estatica — lee `conversation.js` como texto para probar el CABLEADO además de las funciones.
 * No importa el gateway, no invoca a nadie, no sale a la red.
 *
 * EL CASO, medido en vivo: el owner miró la cascada del P&L y preguntó «logística por qué tiene un 3.5%».
 * ADI repreguntó, y después repitió la lectura entera sin contestar. La respuesta estaba en su propia tabla:
 * la línea viene sellada «supuesto declarado». Un supuesto NO es una medición, y decirlo era la respuesta.
 *
 * ES LA QUINTA VEZ del mismo patrón en el proyecto —capacidad construida, camino ausente— después de
 * `clientesPorSku`, las dos tools de composición/capital, y los focos de `marginRead`. Por eso este gate
 * prueba el CABLEADO, no solo que las funciones anden: un módulo que nadie llama no existe para el usuario.
 *
 *   [1] EL CASO DEL OWNER · su frase textual, y la respuesta que corresponde.
 *   [2] LAS DOS PROCEDENCIAS · declarado por el usuario ≠ supuesto del perfil de la empresa.
 *   [3] LA RED ES ANGOSTA · no dispara en consultas generales ni sin líneas activas.
 *   [4] EL CABLEADO · está enchufado, ANTES de pnlExplain, y no gasta una llamada.
 *   [5] PROPORCIONALIDAD · nunca presenta el supuesto como medición, y ofrece corregirlo.
 * Cero red, cero LLM. `npm run gates:offline`
 */
import { readFileSync } from "fs";
import { detectaPorQueCifra, componePorQueCifra } from "./src/adi/porQueEstaCifra.js";

let PASS = 0, FAIL = 0;
const ok = (c, m, extra = "") => { if (c) { PASS++; console.log("  ✓ " + m); } else { FAIL++; console.log("  ✗ " + m + (extra ? "\n      " + extra : "")); } };
const H = (t) => console.log("\n" + t);

const LINEAS = [
  { nombre: "Logística", pct: 3.5, origen: "declarado" },
  { nombre: "Administración", pct: 2.0, origen: "perfil_empresa" },
  { nombre: "Marketing", pct: 1.5, origen: "declarado" },
];
const SRC = readFileSync("./src/adi/conversation.js", "utf8");
const CODIGO = SRC.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");   // sin comentarios: se prueba el código

H("[1] EL CASO DEL OWNER · su frase, textual");
{
  const d = detectaPorQueCifra("logistica por que tiene un 3.5%", LINEAS);
  ok(!!d, "detecta la pregunta aunque venga sin tildes ni signos");
  ok(d && d.linea.nombre === "Logística", `y resuelve la línea correcta — ${d && d.linea.nombre}`);
  const t = componePorQueCifra(d);
  ok(/3\.5%/.test(t) && /Log[ií]stica/.test(t), "la respuesta nombra la cifra y la línea");
  ok(/supuesto/i.test(t) && /no una medici[oó]n/i.test(t), "y dice lo esencial: es un supuesto, no una medición");
  ok(/recalculo|dec[ií]melo/i.test(t), "y ofrece corregirlo, que es lo que la vuelve una decisión");
  ok(!/el resto de lo autorizado|magnitud mayor/i.test(t), "sin jerga interna del respaldo");
}

H("[2] LAS DOS PROCEDENCIAS · no es lo mismo tu supuesto que el del perfil");
{
  const propio = componePorQueCifra(detectaPorQueCifra("por que administracion tiene 2%", LINEAS) || {});
  ok(/perfil de tu empresa/i.test(propio), `el del perfil se declara como tal — "${String(propio).slice(0, 70)}…"`);
  const decl = componePorQueCifra(detectaPorQueCifra("de donde sale marketing", LINEAS));
  ok(/declaraste vos/i.test(decl), "y el declarado por el usuario dice que fue él");
  ok(propio !== decl, "las dos respuestas son distintas: la procedencia cambia el sentido");
}

H("[3] LA RED ES ANGOSTA · ante la duda no dispara");
{
  for (const q of ["¿Cuánto me queda después de gastos?", "no entiendo", "¿qué clientes ceden más margen?",
    "dame el resumen ejecutivo", "¿dónde tengo capital inmovilizado?"])
    ok(!detectaPorQueCifra(q, LINEAS), `NO dispara — "${q}"`);
  ok(!detectaPorQueCifra("por que tiene 3.5%", []), "sin líneas activas no dispara (el P&L todavía no está armado)");
  ok(!detectaPorQueCifra("por que tiene 3.5% el flete", LINEAS), "ni con una línea que no existe en ESTE P&L");
  for (const q of ["de donde sale logistica", "que incluye logistica", "como calculaste logistica"])
    ok(!!detectaPorQueCifra(q, LINEAS), `sí con las otras formas reales de preguntarlo — "${q}"`);
}

H("[4] EL CABLEADO · enchufado, y ANTES de pnlExplain");
{
  ok(/detectaPorQueCifra/.test(CODIGO), "conversation.js llama al detector");
  ok(/componePorQueCifra/.test(CODIGO), "…y al compositor");
  const iDet = CODIGO.indexOf("detectaPorQueCifra");
  const iExp = CODIGO.indexOf("pnlExplain(");
  ok(iDet > 0 && iExp > 0 && iDet < iExp,
    "el detector corre ANTES de pnlExplain — si no, la cascada en llano se come la pregunta puntual",
    `detector@${iDet} · pnlExplain@${iExp}`);
  ok(/route:\s*"pnl_por_que_cifra"/.test(CODIGO), "la ruta queda declarada y es rastreable en la evidencia");
  ok(!/callNarrate|handleNarrate/.test(CODIGO.slice(iDet, iDet + 900)), "y no invoca al narrador: no gasta una llamada");
}

H("[5] PROPORCIONALIDAD · un supuesto nunca se presenta como medición");
{
  const t = componePorQueCifra(detectaPorQueCifra("por que logistica tiene 3.5%", LINEAS));
  ok(/no es contabilidad cerrada/i.test(t), "declara que no es contabilidad cerrada");
  ok(/venta, costo, carga comercial y contribuci[oó]n/i.test(t), "y separa lo que SÍ está medido, que es lo que va antes");
  ok(componePorQueCifra({}) === null && componePorQueCifra({ linea: null }) === null, "sin línea no inventa nada: devuelve null");
}

H("[6] EL TURNO LLEGA HASTA ACÁ · lo que la sección [4] NO probaba");
{
  /* LA LECCIÓN, y la pagué yo. La sección [4] certifica que `conversation.js` está bien cableado por dentro, y
   * es verdad — pero `answerConversational` corre DESPUÉS del oráculo en ChatADI, y el oráculo se queda este
   * turno (`detectPnlIntent` devuelve null para «logística por qué tiene un 3.5%»). O sea que el arreglo estaba
   * construido, probado, verde… y sólo habría entrado si el oráculo se abstenía. Nunca, en la práctica.
   * «Cableado» y «alcanzable» no son lo mismo, y un gate que sólo mira lo primero da una falsa tranquilidad. */
  const CHAT = readFileSync("./src/ui/ChatADI.jsx", "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  ok(/responderPorQueCifra\(q,/.test(CHAT), "ChatADI llama al compositor con la pregunta del turno");
  const iPq = CHAT.indexOf("responderPorQueCifra(q,");
  const iOraculo = CHAT.indexOf("answerViaOracle({");
  ok(iPq > 0 && iOraculo > 0 && iPq < iOraculo,
    "y lo llama ANTES del oráculo — si fuera después, el oráculo ya se habría quedado el turno",
    `porQueCifra@${iPq} · oráculo@${iOraculo}`);
  const bloque = iPq > 0 ? CHAT.slice(Math.max(0, iPq - 400), iPq + 400) : "";
  ok(!/_fetchPlan|_fetchNarrateC/.test(bloque), "sin invocar al gateway: la respuesta sale del dato ya sellado");

  /* UNA SOLA VERDAD: los dos caminos tienen que usar el MISMO compositor. Si ChatADI se armara su propia versión,
   * la misma pregunta tendría dos respuestas posibles según por dónde entre — justo lo que el repo prohíbe. */
  const CONV = readFileSync("./src/adi/conversation.js", "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  ok(/export function responderPorQueCifra/.test(CONV), "el compositor está exportado una sola vez");
  ok(/responderPorQueCifra\(state && state\.text, last\)/.test(CONV),
    "y el camino de siempre usa ESE mismo, no una copia: una pregunta, una respuesta");
  ok(!/componePorQueCifra/.test(CHAT), "ChatADI no recompone nada por su cuenta");
}

console.log(`\n── ¿POR QUÉ ESA CIFRA? · ${PASS} PASS · ${FAIL} FAIL ──`);
process.exitCode = FAIL ? 1 : 0;
