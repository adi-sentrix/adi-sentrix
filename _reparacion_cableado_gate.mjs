/* === _reparacion_cableado_gate.mjs · CONTRATO v1.2 · EL CABLEADO, CERTIFICADO POR LECTURA ======================
 * @inspeccion-estatica — este gate LEE código fuente como TEXTO. No importa el gateway ni ningún adapter, no
 * invoca a handlePlan/handleNarrateC/callPlan/callNarrate y no abre un socket: menciona esos símbolos porque son
 * justamente lo que tiene que certificar que existe (o que NO existe) en el archivo del motor. Cumple las tres
 * condiciones del escape declarado en scripts/gates-offline.mjs, y el candado de runtime se le aplica igual.
 *
 * QUÉ CERTIFICA, y por qué no alcanza con probar las funciones sueltas:
 *   §8.13 · que NO hay una tercera llamada al LLM — es una afirmación sobre los SITIOS DE LLAMADA del motor, no
 *           sobre una función; solo se puede probar contando los sitios.
 *   §8.3  · que el backstop de "redirect sin calls" trae la excepción de la corrección ambigua (el que cobraba
 *           tres llamadas de PLAN por una respuesta correcta).
 *   §1    · que la reparación se aplica ANTES de todo lo que consume el contexto anterior. Un orden invertido
 *           dejaría el código presente y la garantía rota, que es exactamente el defecto más caro de detectar.
 *   §4.1  · que el guard recibe la reparación en TODOS los puntos donde valida una narración.
 *   §8.12 · que los adapters siguen sin importar una sola línea del contrato de ADI.
 */
import { readFileSync } from "node:fs";

let pass = 0, fail = 0;
function ok(name, cond, detail) {
  if (cond) { pass++; console.log(`  OK  ${name}`); }
  else { fail++; console.log(`FAIL  ${name}${detail ? " — " + detail : ""}`); }
}
function section(t) { console.log(`\n== ${t} ==`); }
const leer = (p) => readFileSync(p, "utf8");
const cuenta = (s, re) => (s.match(re) || []).length;

const MOTOR = leer("./src/adi/oracle/answerViaOracle.js");
const GATEWAY = leer("./src/adi/llm/gatewayCore.js");
const NARRAR = leer("./src/adi/oracle/narratePromptC.js");
const PLANP = leer("./src/adi/oracle/planPrompt.js");

/* ══════════════════════════════════════════════════════════════════════════════════════════════════════════════ */
section("1 · SON DOS LLAMADAS, NO TRES (§8.13)");
// Los dos únicos sitios donde el motor invoca al proveedor. Se cuentan los SITIOS de invocación, no las
// menciones: un tercero aparecería acá aunque estuviera escondido detrás de otro nombre de variable.
const sitiosPlan = cuenta(MOTOR, /await\s+callPlan\s*\(/g);
const sitiosNarrate = cuenta(MOTOR, /await\s+callNarrate\s*\(/g);
ok("PLAN se invoca desde UN solo sitio", sitiosPlan === 1, `${sitiosPlan}`);
ok("NARRAR se invoca desde UN solo sitio", sitiosNarrate === 1, `${sitiosNarrate}`);
ok("no hay ninguna tercera puerta al proveedor en el motor",
  sitiosPlan + sitiosNarrate === 2 && !/await\s+call(?!Plan|Narrate)[A-Z]/.test(MOTOR));
ok("el gateway sigue exponiendo DOS handlers para el oráculo (plan · narrate-c)",
  /"\/api\/adi-plan":\s*handlePlan/.test(GATEWAY) && /"\/api\/adi-narrate-c":\s*handleNarrateC/.test(GATEWAY));
// el presupuesto de reintentos tampoco cambió: 3 intentos por pasada, como antes de este contrato.
ok("el presupuesto de reintentos sigue siendo 3 por pasada (la reparación no compró llamadas)",
  cuenta(MOTOR, /attempt\s*<\s*3/g) === 2, `${cuenta(MOTOR, /attempt\s*<\s*3/g)}`);

section("2 · EL BACKSTOP QUE COBRABA UNA RESPUESTA CORRECTA (§8.3)");
const lineaBackstop = MOTOR.split("\n").find((l) => /intent === "redirect"/.test(l) && /redirect sin calls/.test(l)) || "";
ok("el backstop de «redirect sin calls» sigue existiendo", !!lineaBackstop);
ok("§4.1 · pero ya NO dispara sobre una corrección ambigua", /_esReparacionAmbigua\(p\)/.test(lineaBackstop), lineaBackstop.trim().slice(0, 120));
// LA RECONCILIACIÓN VIVE EN UN SOLO LUGAR (owner 2026-08-10). Antes cada consumidor resolvía por su cuenta la
// contradicción `ambigua:true` + `corrige:["entidad"]`, y resolvían distinto: el motor recalculaba, el estado no
// invalidaba nada y el guard no exigía evidencia — ADI contestaba sobre la entidad nueva con la memoria de la
// vieja. Ahora se resuelve en `normalizeReparacion` y los cuatro leen de ahí.
const CONTRATO = leer("./src/adi/oracle/conversationalContract.js");
ok("la contradicción `ambigua` + `corrige` se reconcilia en el normalizador, una sola vez",
  /export function normalizeReparacion[\s\S]{0,2400}?ambigua: r\.tipo === "correccion" && r\.ambigua === true && corrige\.length === 0/.test(CONTRATO));
// §2 · la protección contra el secuestro ya no es una intención FIJA sino una CONSISTENCIA: la reparación vale
// cuando su clase y la intención del turno se corresponden. Exigir `redirect` a todas se volvió contradictorio
// con la coerción por tipo — el motor normalizaba un desacuerdo a `answer` y después descartaba su reparación.
// LA TABLA CANÓNICA, UNA SOLA, con TRES consumidores: la validación de consistencia, la coerción del intent y el
// prompt (que la IMPRIME en vez de reescribirla). La 3ª corrida pagada mostró por qué importa: el encabezado de la
// doctrina decía a mano `intent="redirect"` para las tres clases — literalmente lo contrario de lo que el motor
// acepta desde la validación por consistencia. Si el modelo obedecía el prompt, su reparación se descartaba.
ok("§2 · la reparación se valida por CONSISTENCIA contra la tabla canónica",
  /p\.intent !== INTENT_POR_TIPO\[tipo\]\) return null/.test(CONTRATO)
  && /export const INTENT_POR_TIPO = Object\.freeze\(\{ correccion: "redirect", desacuerdo: "answer", dato_usuario: "answer" \}\)/.test(CONTRATO));
ok("…y esa tabla es UNA sola: la usan la validación, la coerción Y el prompt",
  /const destino = INTENT_POR_TIPO\[tipoCanonico\(r && r\.tipo\)\] \|\| null/.test(CONTRATO)
  && /const mapa = Object\.entries\(INTENT_POR_TIPO\)\.map/.test(CONTRATO));
ok("…y el prompt la IMPRIME, no la reescribe (no puede volver a contradecir al motor)",
  /\$\{mapa\}/.test(CONTRATO) && !/CORRECCIÓN \/ DESACUERDO \/ DATO APORTADO → intent="redirect"/.test(CONTRATO));
ok("el motor NO re-decide la ambigüedad: delega en el normalizador",
  /const _reparacionDe = \(plan\) => normalizeReparacion\(plan\)/.test(MOTOR)
  && /function _esReparacionAmbigua[\s\S]{0,200}?return !!\(r && r\.ambigua\)/.test(MOTOR));
// TRES CAMINOS A LA PREGUNTA. La 4ª corrida pagada agregó el tercero, y es el que más costaba: una ambigüedad
// DECLARADA CON su pregunta ya redactada manda sobre unas calls sueltas — son dos campos coherentes entre sí
// contra uno que los contradice. Antes el motor prefería lo respondible, y ese turno gastó CUATRO llamadas, con
// dos rechazos del guard y una escalada al modelo más caro, para responder donde §4 manda preguntar.
ok("…y el corte por ambigüedad cubre los tres casos (sin calls · con pregunta · inferida)",
  /const _cortaPorAmbigua = _repAmbigua && \(_sinCalls \|\| _preguntaValida \|\| _reparacion\.inferida === true\)/.test(MOTOR));
ok("§4 · con la pregunta redactada, la ambigüedad MANDA y las calls se descartan",
  MOTOR.includes("const _preguntaValida = !!(_reparacion && typeof _reparacion.pregunta === \"string\" && _reparacion.pregunta.includes(\"?\"))"));
ok("la pregunta de precisión tiene una segunda candidata: nunca cae en silencio si el guard rechaza la primera",
  /for \(const candidata of \[pregunta, stripLanguageLeaks\(_propia\)\]\)/.test(MOTOR));

section("3 · EL ORDEN IMPORTA: la reparación corre antes que todo lo que lee el contexto (§1)");
const iRep = MOTOR.indexOf("applyRepairToScope(conversationScopePrev");
const iRef = MOTOR.indexOf("resolveConversationReference(q, plan, conversationScopePrev");
const iBatch = MOTOR.indexOf("runPlan({ intent: plan.intent, calls }");
const iMem2 = MOTOR.indexOf("if (conversationScopePrev.current || conversationScopePrev.history.length)");
const iAmbigua = MOTOR.indexOf("composePrecisionQuestion(conversationScopePrev");
ok("la reparación se aplica ANTES de resolver referencias deícticas", iRep > 0 && iRef > 0 && iRep < iRef, `${iRep} < ${iRef}`);
ok("…ANTES del batch de tools", iRep < iBatch, `${iRep} < ${iBatch}`);
ok("…y ANTES de armar la memoria que ve el narrador", iRep < iMem2, `${iRep} < ${iMem2}`);
ok("§4 · la pregunta de precisión corta ANTES del batch (no se calcula nada sin saber qué corregir)",
  iAmbigua > 0 && iAmbigua < iBatch, `${iAmbigua} < ${iBatch}`);
ok("§3.6 · la oferta invalidada se apaga también en el shim `mem.lastOffer`",
  /mem2 = \{ \.\.\.mem2, lastOffer: priorOffer \|\| null \}/.test(MOTOR));
ok("§5.1 · el supuesto del usuario solo se guarda si él lo autorizó en ESTE turno",
  /_reparacion\.tipo === "dato_usuario" && _reparacion\.aceptado === true/.test(MOTOR));

section("4 · EL GUARD JUZGA EL MISMO OBJETO QUE VE EL PROMPT (§4.1)");
const guardsNarracion = cuenta(MOTOR, /guardC\((?:det|c|n),/g);
const guardsConReparacion = cuenta(MOTOR, /guardC\((?:det|c|n),[^\n]*reparacion: reparacionSellada/g);
ok("todos los guardC que validan una narración reciben la reparación",
  guardsNarracion > 0 && guardsNarracion === guardsConReparacion, `${guardsConReparacion}/${guardsNarracion}`);
ok("la reparación sellada se compone UNA vez, con el mismo builder del contrato de narración",
  cuenta(MOTOR, /const reparacionSellada = buildReparacion\(/g) === 1);
// Paso 0 "ADI pierde el hilo" (2026-08-13): el gateway ahora arma el system SEGMENTADO (buildNarrateSystemSegments,
// mismo mecanismo que PLAN) — la garantía que este chequeo protege NO cambió: la reparación entra al system desde
// el payload sellado, nunca del plan crudo. Solo cambió el nombre del builder que la recibe.
// [,)] y no ")" (AMPLITUD F1, 2026-08-13): el builder ganó un 7º argumento (`datoNegocio`) DESPUÉS de la
// reparación — misma garantía (la reparación entra desde el payload sellado), otro cierre de llamada. Formato.
ok("el system de NARRAR la recibe desde el PAYLOAD, no del plan crudo",
  /buildNarrateSystemSegments\([\s\S]{0,240}?payload\.reparacion \|\| null[,)]/.test(GATEWAY));
ok("la doctrina de NARRAR es condicional (un turno normal no paga tokens)",
  /doctrinaReparacion \? `\\n\$\{doctrinaReparacion\}\\n` : ""/.test(NARRAR));

section("4b · EL CANDADO YA NO MIRA CÓMO ESTÁ REDACTADO (§5.1)");
const GUARD = leer("./src/adi/oracle/guardC.js");
const NARRAR_SRC = NARRAR;
// El encargo del owner fue explícito: "el guard no debe depender de una lista cerrada de formas de redactarlo".
// Las tres listas que había —procedencia, consolidación, estimación— ya no existen; se verifica su AUSENCIA, que
// es lo único que impide que vuelvan de a poco.
for (const [re, nombre] of [[/_PROCEDENCIA_USUARIO_RE/, "lista de frases de procedencia"], [/_CONSOLIDA_RE/, "lista de verbos de consolidación"], [/\b_ESTIMACION_RE/, "lista de palabras de estimación"]]) {
  ok(`el guard ya NO tiene ${nombre}`, !re.test(GUARD));
}
/* LA DOCTRINA SE PRECISA, NO SE AFLOJA (owner 2026-08-12, hallazgo M1). El encargo original —«el guard no debe
 * depender de una lista cerrada de formas de redactarlo»— apuntaba a un modo de falla concreto: un candado cuyo
 * ÚNICO disparador es cómo está escrita una frase falla en las dos direcciones (cualquier paráfrasis lo esquiva, y
 * una redacción inocente lo dispara). Las tres listas de arriba eran así, y siguen retiradas.
 * `_afinidadComoCompra` NO es de esa familia, y la diferencia es verificable acá: su disparador es EL DATO —figs
 * selladas `indicado` cuyo propio `context` declara que la relación es de afinidad—, y sólo DESPUÉS de eso mira la
 * redacción. Sin esa condición del dato no juzga una sola palabra: sobre un turno normal, ninguna de esas frases
 * significa nada y la regla ni se ejecuta.
 * POR QUÉ HACE FALTA MIRAR LA REDACCIÓN ACÁ: lo que hay que detectar es si el texto AFIRMA una compra que no
 * ocurrió. Eso no tiene señal del lado del dato —el dato ya dijo lo suyo, y lo dijo bien: `indicado`—; lo que falla
 * es el paso del sello a la prosa. Medido en vivo en M1: 20 figs `indicado` y tres frases de historial de compra.
 * SE VERIFICA EL ORDEN, que es lo que impide que esto se convierta en la cuarta lista suelta. */
ok("la regla de afinidad se dispara por el DATO (fig sellada `indicado` con contexto de afinidad), no por la redacción",
  /function _afinidadComoCompra/.test(GUARD)
  && /const hayAfinidad = [\s\S]{0,220}?sello === "indicado"[\s\S]{0,80}?_AFINIDAD_CTX_RE/.test(GUARD)
  && /if \(!hayAfinidad \|\| !text\) return \[\];/.test(GUARD));
ok("la marca de procedencia la ESTAMPA el renderer, y corre sobre el texto final",
  /export function markUserProvenance/.test(NARRAR_SRC) && /textoFinal = markUserProvenance\(textoFinal, reparacionSellada, figs\)/.test(MOTOR));
ok("§5.1 viñeta 2 · la consolidación SÍ bloquea, y se detecta por aritmética (es lo único que el renderer no puede reparar)",
  /function _consolidaConElMotor/.test(GUARD) && /Math\.abs\(\(s\.raw \+ x\.raw\) - f\.raw\)/.test(GUARD));
ok("la definición de «cifra del usuario» es UNA sola, compartida por el guard y el renderer",
  /import \{ buildClaims, cifrasDelUsuario \}/.test(GUARD) && /import \{ cifrasDelUsuario \}/.test(NARRAR_SRC));
ok("§4.1 · la evidencia se mide contra la boleta DE ESTE TURNO, no contra «hay un número»",
  /const canonBoleta = new Set\(figs\.map\(\(f\) => f\.canon\)\)/.test(GUARD));
ok("…y los contratos que prohíben citar cifras (action_only · clarify) ganan sobre esa exigencia",
  /contentScope === "action_only" \|\| mode === "clarify"\) return null/.test(GUARD));

section("5 · NO SE CREÓ NINGUNA CAPA PARALELA (§7)");
ok("la reparación viaja dentro del intent=redirect que ya existía",
  /enum: \["answer", "define", "redirect", "ack"\]/.test(PLANP));
ok("no hay un módulo nuevo de reparación: el estado vive en conversationScope",
  /from "\.\/conversationScope\.js"/.test(MOTOR) && /applyRepairToScope/.test(MOTOR));
ok("no se agregó una memoria: los supuestos usan el campo que el shape ya reservaba",
  /supuestos: \[\]/.test(leer("./src/adi/oracle/conversationScope.js")));
ok("el criterio de compatibilidad vive en el contrato versionado, no en el motor",
  /camposQueSeInvalidan/.test(leer("./src/adi/oracle/conversationScope.js")) && !/camposQueSeInvalidan/.test(MOTOR));

section("5b · LA RUTA QUE NO CONSULTA A PLAN · integración general, sin detector de frases");
{
  const SCOPE = leer("./src/adi/oracle/conversationScope.js");
  ok("la reparación se infiere comparando ESTRUCTURAS, no el texto del usuario",
    /export function inferirCorrige\(scopePrev, plan\)/.test(SCOPE) && !/inferirCorrige[\s\S]{0,1200}?\btext\b/.test(SCOPE));
  // DÓNDE PUEDE ACTIVARSE, y es angosto: un plan sintético (nadie pudo declararla) o un `redirect` que dice que
  // reencauza pero no dice qué. En una consulta normal —`answer` no sintético— ni se evalúa; en un desacuerdo o un
  // dato aportado la reparación YA existe con su tipo, así que el bloque no corre.
  ok("…y solo se evalúa en un plan SINTÉTICO o en un redirect sin reparación declarada",
    /const _puedeInferir = !_reparacion && \(planWasSynthetic \|\| plan\.intent === "redirect"\)/.test(MOTOR));
  ok("si la diferencia no alcanza para identificar la corrección, se trata como AMBIGUA (nunca se adivina)",
    /_reparacion = \{ tipo: "correccion", corrige: \[\], ambigua: true/.test(MOTOR));
  ok("el esquema exige `reparacion` en todos los turnos, y admite null",
    /required: \["intent", "mode", "rationale", "calls", "reparacion"\]/.test(PLANP) && /type: \["object", "null"\]/.test(PLANP));
  ok("la invalidación corre igual venga declarada o inferida (sin la guarda de plan sintético)",
    /if \(_reparacion\) \{[\s\S]{0,400}?const scopeReparado = applyRepairToScope/.test(MOTOR));
  // LA COERCIÓN DEL VOCABULARIO corre ANTES que todo lo que lo lee: el backstop de redirect-sin-calls, el
  // normalizador y las coerciones de este archivo. Si corriera después, repararía un valor que ya se descartó.
  ok("la coerción del vocabulario corre ANTES del backstop y del normalizador",
    MOTOR.indexOf("const _cv = coerceVocabularioPlan(p)") > 0
    && MOTOR.indexOf("const _cv = coerceVocabularioPlan(p)") < MOTOR.indexOf('p.intent === "redirect" && !(Array.isArray(p.calls)'));
  ok("…y es UN SOLO punto (migración + coerción), no dos pasos sueltos",
    cuenta(MOTOR, /coerceVocabularioPlan\(/g) === 1 && !/normalizeIntent\(/.test(MOTOR));
  // MIGRACIÓN ESTRUCTURAL: la clase escrita en `intent` se muda a `reparacion.tipo`, que es su casa. No se
  // adivina nada — se mueve un valor de nuestro propio vocabulario del campo equivocado al correcto.
  ok("la clase escrita en `intent` se migra a `reparacion.tipo`",
    /clase-en-intent→reparacion\.tipo/.test(CONTRATO) && /if \(claseEnIntent && !tipoDeclarado\)/.test(CONTRATO));
  ok("…y lo DECLARADO manda sobre lo deducido (no pisa un tipo válido)",
    /const tipoDeclarado = tipoCanonico\(rep && rep\.tipo\)/.test(CONTRATO));
  ok("…conservando el contenido íntegro (solo se agrega el tipo)",
    /reparacion: \{ \.\.\.\(rep \|\| \{\}\), tipo: claseEnIntent \}/.test(CONTRATO));
  ok("los valores fuera de enum dejan causa visible en el trace, nunca se descartan en silencio",
    /planCoerciones\.push\(\.\.\._cv\.coerciones\)/.test(MOTOR) && /mode-invalido/.test(MOTOR) && /corrige-descartado/.test(MOTOR)
    && /coerciones: planCoerciones/.test(MOTOR));
  ok("el narrador y el guard juzgan la MISMA reparación que el estado ya invalidó",
    /buildReparacion\(\{ plan, mem: mem2, reparacion: _reparacion \}\)/.test(MOTOR));
  ok("§7 · no se agregó una llamada: la ruta sintética sigue sin invocar a PLAN",
    cuenta(MOTOR, /await\s+callPlan\s*\(/g) === 1);
}

section("6 · LOS ADAPTERS SIGUEN SIN SABER NADA DE ADI (§8.12)");
for (const a of ["openai", "anthropic"]) {
  const src = leer(`./src/adi/llm/adapters/${a}.js`);
  const importaContrato = /^\s*import[^\n]*from\s+["'][^"']*(oracle\/|conversationalContract|narrationContract|planPrompt|narratePromptC)/m.test(src);
  ok(`adapter ${a}: no importa una sola línea del contrato de ADI`, !importaContrato);
  ok(`adapter ${a}: recibe el schema NEUTRAL verbatim, sin traducirlo`, /tool\.schema/.test(src));
}

console.log(`\n${pass} OK · ${fail} FAIL`);
process.exit(fail ? 1 : 0);
