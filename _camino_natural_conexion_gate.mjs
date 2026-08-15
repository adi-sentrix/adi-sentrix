/* === _camino_natural_conexion_gate.mjs · LA CONEXIÓN DEL CAMINO NATURAL COMO PRINCIPAL (owner 2026-08-14) ======
 * @inyeccion-simulada — este gate ejercita `answerViaNatural` y `answerViaOracle` con el cerebro/las pasadas como
 * funciones locales (cero red, cero gateway, cero adapter importado; el candado de runtime igual vigila).
 *
 * QUÉ FIJA, condición por condición del owner:
 *  [0] EL FLAG · ADI_CAMINO_NATURAL: OFF en floor (Node/gates → piso byte-exacto) · ON en prod y dev (autorizado
 *      como principal) · apagarlo en todas partes es UNA línea de flagProfile.js.
 *  [1] EL SYSTEM ES EL DEL ARNÉS, TEXTUAL (condición 3, cero reglas nuevas): la doctrina del notario y el
 *      contrato [[CALCULO]] de naturalPrompt.js son BYTE POR BYTE los del `SYSTEM_NATURAL` de `_corrida_doble.mjs`
 *      (el prototipo medido) — leídos del propio arnés y comparados, no re-declarados a mano acá.
 *  [2] EL FLUJO COMPLETO con el cerebro mockeado: verde · reparado (alcance heredado desde mem.recentNarrations,
 *      multa como turno del NOTARIO) · suplente (texto vetado NO presta cifras) · vacío (suplente digno, pantalla
 *      nunca en blanco) — y en TODOS los estados, [[CALCULO]] jamás visible (condición 1: ni marca ni contenido).
 *  [3] LA MEMORIA DEL CAMINO: recentNarrations guarda el texto LIMPIO · la re-cita SOLO se acumula si el muro
 *      aprobó (candado del owner) · el registro del turno viaja en r.natural (condición 5, campos expuestos).
 *  [4] CRITERIA · el ÚNICO bypass conservado: corre ANTES del cerebro (cero llamadas) y responde BYTE-IDÉNTICO
 *      al camino actual (misma red, misma composición — answerViaOracle con las pasadas mockeadas que no se llaman).
 *  [5] LA RED DE RESILIENCIA + FLAG OFF, por candado estático sobre ChatADI.jsx: answerViaNatural vive SOLO
 *      dentro del flag, envuelto en su catch, ANTES del oráculo actual — flag OFF = el código de siempre, intacto.
 *      Y el gateway/los adapters declaran el modo natural sin tocar ni un byte del camino existente.
 */
import { readFileSync } from "node:fs";
import { initTenant } from "./src/data/tenantStore.js";
import { TENANT_DEMO } from "./src/data/tenants/demo.js";
import { answerViaNatural } from "./src/adi/oracle/caminoNatural.js";
import { answerViaOracle } from "./src/adi/oracle/answerViaOracle.js";
import { buildNaturalSystemSegments, DOCTRINA_NOTARIO_NATURAL, CONTRATO_CALCULO_NATURAL } from "./src/adi/oracle/naturalPrompt.js";
import { MARCA_CALCULO, composeNoDataMessage } from "./src/adi/oracle/narrationBlocks.js";
import { esNarracionVacia } from "./src/adi/oracle/guardC.js";
import { TURNOS } from "./_corrida_doble_casos.mjs";
import { detectCriteriaIntent } from "./src/adi/criteria.js";
import { composeCriteria } from "./src/adi/conversation.js";
initTenant(TENANT_DEMO);

let pass = 0, fail = 0;
const ok = (c, m, extra = "") => { console.log(`  ${c ? "✓" : "✗"} ${m}${!c && extra ? " — " + extra : ""}`); c ? pass++ : fail++; };
const sinBloque = (t) => !String(t).includes(MARCA_CALCULO) && !/\bop=/.test(String(t)) && !/\bid=c\d/.test(String(t)) && !/\binputs=/.test(String(t));

console.log("── 0 · EL FLAG · OFF en floor, ON en prod y dev, rollback de una línea ──");
{
  const vf = await import("./src/config/voiceFlags.js");
  ok(vf.ADI_CAMINO_NATURAL === false, "en floor (Node/gates) el flag está OFF — el piso byte-exacto no se mueve");
  globalThis.__ADI_PROFILE__ = "prod";
  const fpProd = await import("./src/config/flagProfile.js?perfil=prod");
  ok(fpProd.P("ADI_CAMINO_NATURAL") === true, "perfil prod → ON (el owner lo autorizó como principal)");
  globalThis.__ADI_PROFILE__ = "dev";
  const fpDev = await import("./src/config/flagProfile.js?perfil=dev");
  ok(fpDev.P("ADI_CAMINO_NATURAL") === true, "perfil dev → ON");
  delete globalThis.__ADI_PROFILE__;
  const perfilSrc = readFileSync("./src/config/flagProfile.js", "utf8");
  ok(/"ADI_CAMINO_NATURAL",/.test(perfilSrc), "apagarlo en todas partes = borrar UNA línea de FEATURE");
}

console.log("\n── 1 · EL SYSTEM NATURAL ES EL DEL ARNÉS, BYTE POR BYTE (condición 3: cero reglas nuevas) ──");
{
  // los DOS lados se normalizan a LF: un checkout con autocrlf no puede convertir una igualdad real en un rojo.
  const nl = (s) => String(s).replace(/\r\n/g, "\n");
  const arnes = nl(readFileSync("./_corrida_doble.mjs", "utf8"));
  const iDoc = arnes.indexOf("════════ LO QUE EL NOTARIO VERIFICA");
  const fin = "no está autorizada.";
  const fDoc = arnes.indexOf(fin, iDoc) + fin.length;
  ok(iDoc > 0 && fDoc > iDoc, "el arnés trae la doctrina (ancla encontrada)");
  const doctrinaArnes = arnes.slice(iDoc, fDoc);
  const doctrinaProducto = nl(`${DOCTRINA_NOTARIO_NATURAL}\n\n${CONTRATO_CALCULO_NATURAL}`);
  ok(doctrinaProducto === doctrinaArnes, "doctrina del notario + contrato [[CALCULO]] = los del arnés, byte por byte",
    `difieren en el índice ${[...doctrinaProducto].findIndex((c, i) => c !== doctrinaArnes[i])}`);
  const seg0 = buildNaturalSystemSegments("PERSONA-X", "CARPETA-Y", "MEM-Z");
  const seg = { fijo: nl(seg0.fijo), variable: seg0.variable };
  ok(seg.fijo.startsWith("PERSONA-X\n\n════════ EL NEGOCIO DEL QUE HABLAS ════════"), "el fijo abre con la persona y la carpeta del negocio");
  ok(seg.fijo.includes("Esto es TODO lo que sabes de este negocio. No tienes herramientas: respondes con esto o declaras el límite.")
    && seg.fijo.includes("\n\nCARPETA-Y\n\n"), "la cabecera de la carpeta es la del arnés y el dato entra entero");
  ok(seg.fijo.endsWith(doctrinaProducto), "el fijo cierra con la doctrina + el contrato (nada después: byte-estable para el caché)");
  ok(seg.variable === "MEM-Z", "la memoria de interacción viaja en el segmento variable (fuera del corte del caché)");
  const seg2 = buildNaturalSystemSegments("PERSONA-X", "CARPETA-Y", "OTRA-MEM");
  ok(seg2.fijo === seg0.fijo, "mismo tenant+escenario → fijo IDÉNTICO aunque la memoria cambie (el caché pega)");
}

// las piezas medidas de la corrida doble #2 / el gate del alcance heredado — los MISMOS textos.
const PREV_4 = "Falabella vende $19.4M con margen 22.0%, Lider $17.9M con 21.5%, Jumbo $17.3M con 24.0% y Sodimac $8.2M con 23.5% — los cuatro bajo tu benchmark de 30.1%.";
const Q2 = "reduce en 2 puntos las acciones comerciales de esos clientes y dime si quedan sobre el benchmark";
const PIERDE = "Ninguno de los tres cruza el benchmark de 30.1%: Falabella 22.0% a 24.0%, Lider 21.5% a 23.5% y Jumbo 24.0% a 26.0%. Tottus, en cambio, ya está sobre la referencia.";
const CUATRO = "Ninguna de las cuatro cruza el benchmark de 30.1%: Falabella 22.0% a 24.0%, Lider 21.5% a 23.5%, Jumbo 24.0% a 26.0% y Sodimac 23.5% a 25.5%.";

console.log("\n── 2 · VERDE · el cerebro responde, el bloque [[CALCULO]] jamás llega a pantalla ──");
{
  const Q4 = "Si subo ventas 4%, ¿qué cambia?";
  const CONBLOQUE = `Las ventas del negocio subirían a $104.0M.\n\n${MARCA_CALCULO}\nid=c1 · op=aplicar_pct · inputs=$100.0M; 4% · formula=$100.0M + 4% · resultado=$104.0M · unidad=money`;
  const { r, mem } = await answerViaNatural({ text: Q4, history: [], mem: {}, scenario: "actual", callNatural: async () => CONBLOQUE });
  ok(r.route === "natural" && r.natural && r.natural.estado === "verde", `el turno sale verde por el camino natural (obtuvo ${r.natural && r.natural.estado})`);
  ok(sinBloque(r.text), "condición 1: ni la marca ni el contenido del bloque en pantalla", r.text.slice(0, 120));
  ok(r.text.includes("Las ventas del negocio subirían a $104.0M"), "la prosa del cerebro se conserva intacta");
  ok(r.natural.calculosDeclarados === 1 && r.natural.reparaciones === 0, "el registro del turno declara el cálculo y cero reparaciones (condición 5)");
  ok(mem.recentNarrations[0] === r.text && sinBloque(mem.recentNarrations[0]), "la memoria del hilo guarda el texto LIMPIO");
  ok(mem.recitaAprobada && mem.recitaAprobada.figs.some((f) => String(f.value).includes("104")), "la cifra que el muro aprobó queda en la re-cita del hilo");
}

console.log("\n── 3 · REPARADO · el alcance heredado sale de mem.recentNarrations y la multa viaja como NOTARIO ──");
{
  const llamadas = [];
  const { r, mem } = await answerViaNatural({
    text: Q2,
    history: [
      { role: "user", text: "¿Qué clientes venden mucho pero dejan poco margen?" },
      { role: "adi", text: PREV_4 },
    ],
    mem: { recentNarrations: [PREV_4] },
    scenario: "actual",
    callNatural: async ({ mensajes, attempt }) => {
      llamadas.push({ mensajes, attempt });
      if (attempt === 0) return PIERDE;
      return mensajes.some((m) => /NOTARIO/.test(m.content) && /Tottus/.test(m.content)) ? CUATRO : PIERDE;
    },
  });
  ok(r.natural.estado === "reparado" && r.natural.reparaciones === 1, `veto → UNA reparación → verde (obtuvo ${r.natural.estado})`);
  ok(r.natural.vetos[0] === "alcance-heredado-cambiado", `el veto es el del alcance heredado — el cable desde mem.recentNarrations funciona (obtuvo ${r.natural.vetos[0]})`);
  ok(r.text === CUATRO, "sale la respuesta corregida del cerebro, no el suplente");
  ok(llamadas.length === 2 && llamadas[0].mensajes.length === 3 && llamadas[0].mensajes[2].content === Q2,
    "el hilo ENTERO viaja al cerebro (los 2 turnos previos + el actual, el usuario al final)");
  ok(llamadas[1].mensajes.some((m) => m.role === "assistant" && m.content === PIERDE)
    && llamadas[1].mensajes.some((m) => m.role === "user" && m.content.startsWith("[NOTARIO — no es el usuario]")),
    "la reparación devuelve el borrador como turno del asistente + la multa como turno del NOTARIO (textual del arnés)");
  ok(mem.recentNarrations[0] === CUATRO, "la memoria del hilo avanza con el texto aprobado");
}

console.log("\n── 4 · SUPLENTE Y VACÍO · el texto vetado no presta cifras; la pantalla nunca queda en blanco ──");
{
  const rSup = await answerViaNatural({ text: Q2, history: [], mem: { recentNarrations: [PREV_4] }, scenario: "actual", callNatural: async () => PIERDE });
  ok(rSup.r.natural.estado === "suplente" && rSup.r.natural.vetos.length === 2, `dos textos vetados → estado suplente (obtuvo ${rSup.r.natural.estado})`);
  ok(!("recitaAprobada" in rSup.mem), "un texto que el muro rechazó NO acumula re-cita (candado del owner)");
  ok(sinBloque(rSup.r.text) && !esNarracionVacia(rSup.r.text), "también en este estado: sin bloque y con texto");

  const rVac = await answerViaNatural({ text: TURNOS[0].q, history: [], mem: {}, scenario: "actual", callNatural: async () => "" });
  ok(rVac.r.natural.estado === "vacio" && rVac.r.natural.suplenteDigno === true && rVac.r.natural.vacias.length === 2,
    `cerebro en blanco dos veces → vacío + suplente digno (obtuvo ${rVac.r.natural.estado}, vacias=${JSON.stringify(rVac.r.natural.vacias)})`);
  ok(!esNarracionVacia(rVac.r.text) && sinBloque(rVac.r.text), "la garantía anti-vacío se sostiene por el camino conectado");
  ok(rVac.r.deterministic === true, "el suplente queda marcado deterministic para la telemetría existente");

  // el cerebro que escribe SOLO el bloque: la limpieza no puede dejar la pantalla en blanco (mismo piso absoluto).
  const soloBloque = `${MARCA_CALCULO}\nid=c1 · op=aplicar_pct · inputs=$100.0M; 4% · formula=$100.0M + 4% · resultado=$104.0M · unidad=money`;
  const rSolo = await answerViaNatural({ text: "Si subo ventas 4%, ¿qué cambia?", history: [], mem: {}, scenario: "actual", callNatural: async () => soloBloque });
  ok(!esNarracionVacia(rSolo.r.text) && sinBloque(rSolo.r.text) && rSolo.r.natural.suplenteDigno === true,
    "solo-bloque → nunca una pantalla en blanco, nunca el bloque", rSolo.r.text.slice(0, 100));
  ok(rSolo.r.text === composeNoDataMessage(null) || /\$|benchmark/i.test(rSolo.r.text), "…y lo que sale es el piso del producto, no un invento");
}

console.log("\n── 5 · CRITERIA · el único bypass conservado: antes del cerebro y BYTE-IDÉNTICO al camino actual ──");
{
  const QC = "recuerda que mi margen mínimo es 25%";
  let cerebro = 0;
  const rc = await answerViaNatural({ text: QC, history: [], mem: {}, scenario: "actual", callNatural: async () => { cerebro++; return "x"; } });
  ok(cerebro === 0, "el criterio persiste SIN llamar al cerebro (corre antes, como en answerViaOracle)");
  // composeCriteria es CON ESTADO («antes usaba X»): se vuelve al estándar antes de la segunda ruta, para que
  // las dos partan de las MISMAS condiciones — lo que se compara es la composición, no el orden de ejecución.
  composeCriteria(detectCriteriaIntent("olvidá el margen mínimo"));
  const ro = await answerViaOracle({ text: QC, history: [], mem: {}, scenario: "actual",
    callPlan: async () => { throw new Error("no debía llamar"); }, callNarrate: async () => { throw new Error("no debía llamar"); } });
  ok(!!ro && !!ro.r && ro.r.text === rc.r.text, "flag ON u OFF, el criterio responde IGUAL: misma red, misma composición, mismo texto",
    `natural=${JSON.stringify(rc.r.text).slice(0, 90)} · oracle=${JSON.stringify(ro && ro.r && ro.r.text).slice(0, 90)}`);
  composeCriteria(detectCriteriaIntent("olvidá el margen mínimo"));   // no dejar el criterio puesto para los asserts que siguen
  ok(rc.r.deterministic === true && rc.mem.recentNarrations[0] === rc.r.text, "confirmación administrativa, memoria del hilo al día");
}

console.log("\n── 6 · LA RED DE RESILIENCIA · el fallo del gateway LANZA y ChatADI cae al camino actual ──");
{
  let lanzo = false;
  try { await answerViaNatural({ text: "hola, ¿cómo viene el negocio?", history: [], mem: {}, scenario: "actual", callNatural: async () => { throw new Error("gateway caído"); } }); }
  catch { lanzo = true; }
  ok(lanzo, "el error del cerebro/gateway se propaga — la caída al camino actual la decide el caller en el MISMO turno");

  const ui = readFileSync("./src/ui/ChatADI.jsx", "utf8");
  const iFlag = ui.indexOf("if (ADI_CAMINO_NATURAL)");
  const iNat = ui.indexOf("answerViaNatural({");
  const iOra = ui.indexOf("await answerViaOracle({");
  ok(iFlag > 0 && iNat > iFlag && iOra > iNat, "en ChatADI, answerViaNatural vive SOLO dentro del flag y ANTES del oráculo actual (flag OFF = el código de hoy, intacto)");
  ok((ui.match(/answerViaNatural\(\{/g) || []).length === 1, "un único sitio de llamada del camino natural");
  ok(/catch\s*(?:\([^)]*\))?\s*\{[^}]*red de resiliencia/i.test(ui.slice(iFlag, iOra)), "el catch de la red de resiliencia envuelve al natural: el error nunca llega al usuario");
  /* …PERO LA RED NO PUEDE SER MUDA (medido en la app 2026-08-14): el catch era `catch {}` a secas y un turno cayó
   * al oráculo sin que nadie se enterara — el usuario vio otra respuesta, con otras cifras, y nosotros creíamos
   * que estábamos midiendo el camino nuevo. El fallback se conserva; lo que se exige acá es que deje rastro. */
  ok(/catch\s*\([^)]+\)\s*\{/.test(ui.slice(iFlag, iOra)) && /console\.warn/.test(ui.slice(iFlag, iOra)),
    "…y NO es muda: la caída al oráculo queda registrada, para que un fallo del camino natural no se vuelva invisible");
  ok(ui.indexOf("responderPorQueCifra(") < iFlag && ui.indexOf("!detectPnlIntent(q)") < iFlag,
    "los interceptores con estado propio (por-qué-cifra · cesión al P&L) siguen ANTES del camino, como estaban");
  ok(/modoNatural:\s*true/.test(ui), "el fetch natural declara modoNatural hacia el MISMO endpoint del narrador");
}

console.log("\n── 7 · EL GATEWAY Y LOS ADAPTERS · el modo natural existe y el camino existente no cambió un byte ──");
{
  const gw = readFileSync("./src/adi/llm/gatewayCore.js", "utf8");
  ok(/modoNatural === true/.test(gw) && /buildNaturalSystemSegments\(/.test(gw), "handleNarrateC arma el system natural cuando el payload lo declara");
  ok(/modo natural sin datoNegocio/.test(gw) && /modo natural sin mensajes/.test(gw), "sin carpeta o sin hilo, el gateway frena con error tipado (el cliente cae al camino actual)");
  const adA = readFileSync("./src/adi/llm/adapters/anthropic.js", "utf8").replace(/\r\n/g, "\n");
  ok(/_mensajesNaturales/.test(adA), "el adapter Anthropic sabe mandar el hilo como messages en modo natural");
  ok(adA.includes('messages: mensajes || [{ role: "user", content: JSON.stringify(validatedOutput) }]'),
    "…y sin modo natural el body es el de siempre (el payload serializado en un único mensaje)");
  const adO = readFileSync("./src/adi/llm/adapters/openai.js", "utf8");
  ok(/modoNatural === true/.test(adO), "el adapter OpenAI también (mismo contrato, provider-neutral)");
}

console.log(`\n── _camino_natural_conexion_gate: ${pass} PASS · ${fail} FAIL (de ${pass + fail}) ──`);
process.exit(fail ? 1 : 0);
