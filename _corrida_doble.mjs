/* === _corrida_doble.mjs · LA CORRIDA DOBLE (exigencia 5 de la constitución · owner 2026-08-14: «autorizado»).
 * Las mismas preguntas por los DOS caminos, comparadas:
 *   ARM A «ACTUAL»  — el pipeline de producción (PLAN con dato → tools → NARRAR → muro → reparación/suplente).
 *   ARM B «NATURAL» — un solo cerebro (persona + carpeta, sin PLAN ni tools) + lavador + EL MISMO notario
 *                     calibrado + el ciclo de reparación acordado (una corrección quirúrgica, luego suplente).
 * Set probatorio: 9 hilos · 16 turnos — los casos donde ADI se rompió en vivo + los ejemplos canónicos del owner.
 * («17 turnos» en la cabecera y el mensaje de commit del 2026-08-14 era un error de conteo: los hilos suman 16,
 *  y el transcript de esa corrida trae 16 por brazo. Contados por el gate, no a mano.)
 * TOPE DURO 80 llamadas compartido. LLM_TIMEOUT_MS se setea en el SHELL.
 *
 * ⚠️ LA GARANTÍA ANTI-VACÍO DEL BRAZO NATURAL (2026-08-14, tras auditar la propia corrida) ─────────────────────
 * LO QUE ESTA CORRIDA MIDIÓ MAL: en «reduce en 2 puntos las acciones comerciales de esos clientes…» el modelo
 * devolvió UNA CADENA VACÍA, y el arnés la contó como «reparado» — porque `guardC("")` no encontraba violaciones
 * (una cadena vacía no afirma nada) y salía `ok`. El balance de la corrida quedó inflado por esa puerta: 7
 * reparados de los que uno era una pantalla en blanco.
 * LO QUE SE CERRÓ, en dos niveles:
 *   · PRINCIPIO — `guardC` trata la narración vacía como veredicto propio (`narracion-vacia`, bloqueante). El
 *     vacío ya no puede pasar por ningún camino, no solo por este arnés. Ver esNarracionVacia en guardC.js.
 *   · ARNÉS — una respuesta vacía dispara el MISMO ciclo que un veto (reparación quirúrgica; si vuelve vacía,
 *     suplente digno con las cifras verificadas de la proyección), se registra intento por intento en el
 *     transcript y se reporta como CATEGORÍA PROPIA del balance — nunca escondida dentro de «reparado». */
import fs from "fs";
for (const ln of fs.readFileSync(".env", "utf8").split(/\r?\n/)) {
  const m = ln.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}
process.env.LLM_PROVIDER = "anthropic";
delete process.env.LLM_MODEL_PARSE;
delete process.env.LLM_MODEL_NARRATE;

import { answerViaOracle } from "./src/adi/oracle/answerViaOracle.js";
import { handlePlan, handleNarrateC } from "./src/adi/llm/gatewayCore.js";
import { buildNarrateUserMessageC } from "./src/adi/oracle/narratePromptC.js";
import { proyectarDatoNegocio, cifrasDelDato, suplenteDignoDelDato } from "./src/adi/oracle/datoProyectado.js";
import { ADI_PERSONA } from "./src/adi/oracle/persona.js";
import { guardC, esNarracionVacia } from "./src/adi/oracle/guardC.js";
import { responderConNotario, alcanceHeredadoDe, recitaAprobadaDe } from "./src/adi/oracle/cicloNotarial.js";   // el ciclo de la constitución, compartido con el gate offline
import { HILOS } from "./_corrida_doble_casos.mjs";                        // el set probatorio, compartido con el gate offline
import { stripLanguageLeaks } from "./src/adi/llm/voiceGuard.js";
import { parseFigures } from "./src/adi/boleta.js";
import { axisEntityNames } from "./src/adi/oracle/entityIndex.js";
import { initTenant } from "./src/data/tenantStore.js";
import { TENANT_DEMO } from "./src/data/tenants/demo.js";
initTenant(TENANT_DEMO);

const CAP = 80;
let llamadas = 0;
const _cap = (s) => { llamadas++; if (llamadas > CAP) throw new Error(`TOPE (${CAP}) en ${s}`); };
const DATO = proyectarDatoNegocio("actual");
const CIFRAS = cifrasDelDato("actual");
const KEY = process.env.ANTHROPIC_API_KEY;
const _ejes = (a) => { const o = []; for (const e of a) { try { for (const n of axisEntityNames(e)) o.push(n); } catch { } } return o.length ? o : null; };
const ENT3 = _ejes(["cliente", "sku", "marca"]), ENT6 = _ejes(["cliente", "sku", "marca", "familia", "bodega", "canal"]);
// el catálogo POR EJE (no aplanado): `alcanceHeredadoDe` necesita saber a qué eje pertenece cada nombre para
// elegir el dominante de la respuesta anterior y juzgar solo contra los candidatos de ESE eje.
const CATALOGO_POR_EJE = (() => {
  const o = {};
  for (const eje of ["cliente", "sku", "marca", "familia", "bodega", "canal"]) {
    try { const n = axisEntityNames(eje); if (n && n.length) o[eje] = n; } catch { /* sin índice: ese eje no participa */ }
  }
  return o;
})();

// el set probatorio vive en `_corrida_doble_casos.mjs`: lo comparte con el gate offline que fija la garantía
// anti-vacío sobre EXACTAMENTE estos turnos (ver la cabecera de ese archivo).

/* ── ARM A · el pipeline actual ── */
async function armActual(hilo) {
  let history = [], mem = {}, out = null;
  const turnos = [];
  for (const q of hilo.turnos) {
    const t = { q, calls: 0, texto: null, suplente: false, vetos: [] };
    const callPlan = async (a) => { _cap("A·plan"); t.calls++; const pr = await handlePlan({ text: a.text, history: a.history, mem: a.mem, scenario: a.scenario, attempt: a.attempt, vistaLinea: a.vistaLinea, datoNegocio: DATO }); if (!pr.ok) throw new Error(pr.error || "sin plan"); return pr.plan; };
    const callNarrate = async (a) => { _cap("A·narrar"); t.calls++; const payload = buildNarrateUserMessageC(a); const nr = await handleNarrateC({ payload, mem: a.mem, attempt: a.attempt, datoNegocio: DATO }); if (!nr.ok) throw new Error(nr.error || "sin narración"); return nr.narration; };
    try {
      out = await answerViaOracle({ text: q, history, mem, scenario: "actual", callPlan, callNarrate });
      t.texto = (out && out.r.text) || "(sin texto)";
      t.suplente = !!(out && (out.r.deterministic || out.r.narrationRepaired));
      const nt = out && out.r.retryTrace && out.r.retryTrace.narrate;
      if (nt) for (const x of nt) if (x.guardOk === false) t.vetos.push(x.reason);
      history = history.concat([{ role: "user", text: q }, { role: "adi", text: t.texto }]);
      mem = (out && out.mem) || mem;
    } catch (e) { t.texto = `(ERROR: ${String(e && e.message).slice(0, 90)})`; }
    turnos.push(t);
  }
  return turnos;
}

/* ── ARM B · un solo cerebro + notario calibrado + ciclo de reparación ── */
const SYSTEM_NATURAL = `${ADI_PERSONA}

════════ EL NEGOCIO DEL QUE HABLAS ════════
Esto es TODO lo que sabes de este negocio. No tienes herramientas: respondes con esto o declaras el límite.

${DATO}

════════ LO QUE EL NOTARIO VERIFICA EN TU RESPUESTA ════════
Cada afirmación se verifica antes de llegar a pantalla:
· CADA CIFRA CON SU DUEÑO EN LA MISMA ORACIÓN. No cambies la cifra: nombra al dueño al lado.
· LAS CUENTAS SE MUESTRAN («$54.6M = $19.4M + $17.9M + $17.3M»). Una derivada sin su origen no pasa.
· LOS ESTADOS Y RANKINGS SON LOS DEL DATO: no clasifiques ni ordenes por tu cuenta.
· LAS SIMULACIONES van selladas como proyección («bajo este supuesto, generaría»), jamás como hecho.
· Si un «%» del usuario es ambiguo (relativo vs puntos), declara tu lectura o pregunta.
· LO QUE NO ESTÁ EN EL DATO NO EXISTE: se declara como límite, nunca se completa.
· CADA CIFRA CONTRA LA VARA DE SU PROPIO UNIVERSO. El benchmark de margen y la meta de carga son del universo
  VENTA; el piso de rotación y el techo de días, del universo INVENTARIO. Un margen de inventario NO se compara
  contra el benchmark de cartera.
· UN CAMPO QUE EXISTE EN LOS DOS UNIVERSOS SE NOMBRA COMPLETO: un SKU tiene «margen de inventario» (foto de hoy)
  y «margen de venta» (año cerrado), y son cifras distintas — «margen» a secas no basta.
· UN RANKING PARCIAL DECLARA SU COLA: «7 de 13», «top 7», o por qué cortas ahí.

════════ EL CONTRATO DE CÁLCULO (obligatorio cuando calculas) ════════
Tu prosa puede contar la cuenta como quieras — pero CADA cálculo que muestres va declarado además en un bloque
[[CALCULO]] al FINAL de tu respuesta (el usuario nunca lo ve; el notario lo recomputa). Una línea por cálculo:
id=c1 · op=<sumar|restar|multiplicar|dividir|pct_de|aplicar_pct|puntos> · inputs=<cifras o ids previos, separados por ;> · formula=<la cuenta en palabras> · resultado=<cifra con unidad> · unidad=<money|pct|pp> · dueno=<de QUIÉN es el resultado>
Ejemplo:
[[CALCULO]]
id=c1 · op=aplicar_pct · inputs=$100.0M; 4% · formula=$100.0M + 4% · resultado=$104.0M · unidad=money · dueno=negocio
id=c2 · op=pct_de · inputs=c1; 25.1% · formula=25.1% de $104.0M · resultado=$26.1M · unidad=money · dueno=negocio
id=c3 · op=puntos · inputs=22.0%; 2pp · formula=22.0% + 2pp · resultado=24.0% · unidad=pp · dueno=Falabella
Reglas: los inputs salen del dato, de un supuesto del usuario o de un id previo · si una cuenta no cierra, el
notario la rechaza entera — verifica antes de declarar · una cifra calculada que NO declares no está autorizada.
EL DUEÑO ES OBLIGATORIO y se verifica contra tu prosa: si el resultado es de una entidad concreta, escribe su
nombre exacto (dueno=Falabella) y nómbrala en la MISMA ORACIÓN que la cifra. Si el resultado es del conjunto,
declara dueno=total (o negocio/cartera) — y entonces NO puedes presentarlo como la cifra de un cliente, marca o
SKU concreto. Y el dueño sale de los INSUMOS: una cuenta hecha con cifras de otra entidad no da una cifra tuya.`;

async function askNatural(mensajes) {
  _cap("B·natural");
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST", headers: { "content-type": "application/json", "x-api-key": KEY, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({ model: "claude-sonnet-5", max_tokens: 3072, system: SYSTEM_NATURAL, messages: mensajes }),
  });
  const d = await r.json();
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return (d.content || []).filter((b) => b.type === "text").map((b) => b.text).join("").trim();
}

async function armNatural(hilo) {
  const msgs = [];
  const turnos = [];
  const supuestosDelHilo = [];
  let respuestaAnterior = null;   // la única huella de «de qué se habló» que tiene un cerebro sin boleta
  let recita = null;              // las cifras que ADI YA MOSTRÓ Y EL MURO APROBÓ, con su dueño (ver cicloNotarial)
  for (const q of hilo.turnos) {
    for (const pf of parseFigures(q)) supuestosDelHilo.push(pf.text);   // lo que el usuario declaró sigue vivo en el hilo
    msgs.push({ role: "user", content: q });
    const t = { q, calls: 0, texto: null, estado: "verde", vetos: [], vacias: [], suplenteDigno: false, alcanceHeredado: null };
    /* EL ALCANCE HEREDADO (corrida doble #2: el natural perdió a Sodimac de «esos clientes»). El notario ya sabía
     * cazarlo; faltaba pasárselo. Se deriva de la respuesta ANTERIOR con `alcanceHeredadoDe` — el mismo detector
     * deíctico del camino vigente — y solo viaja cuando de verdad hay un conjunto que heredar. */
    const heredado = alcanceHeredadoDe({ pregunta: q, respuestaAnterior, catalogoPorEje: CATALOGO_POR_EJE });
    if (heredado) t.alcanceHeredado = { eje: heredado.eje, entities: heredado.entities };
    const juzgar = (texto) => guardC(texto, { ledger: { figs: [] }, results: [], trace: null, question: q, supuestoPendiente: supuestosDelHilo, alcanceHeredado: heredado, recitaAprobada: recita, datoProyectado: CIFRAS, entidadesDelTenant: ENT3, duenosDelTenant: ENT6, contentScope: "full", tablePolicy: "auto" });
    try {
      /* EL CICLO NO VIVE ACÁ (2026-08-14): lo ejecuta `responderConNotario` (src/adi/oracle/cicloNotarial.js), el
       * MISMO código que el gate offline ejercita con un modelo mockeado que devuelve ""/espacios/null. Este arnés
       * solo aporta lo que el gate no puede tener: el modelo real y el hilo de mensajes. */
      const r = await responderConNotario({
        juzgar,
        lavar: stripLanguageLeaks,
        suplente: () => suplenteDignoDelDato({ scenario: "actual", juzgar }),
        pedir: async ({ intento, multa, anterior }) => {
          if (intento === 1) return askNatural(msgs);
          // el turno del asistente que se le devuelve al modelo NUNCA puede ir vacío (el proveedor rechaza un
          // content en blanco): se nombra lo que pasó, que además es exactamente lo que hay que corregir.
          msgs.push({ role: "assistant", content: esNarracionVacia(anterior) ? "(respuesta vacía)" : anterior });
          msgs.push({ role: "user", content: `[NOTARIO — no es el usuario] Tu respuesta no pasó la verificación:\n${multa}\nReescribe tu respuesta COMPLETA corrigiendo solo lo observado, manteniendo tu calidad de asesor. No menciones esta corrección.` });
          try { return await askNatural(msgs); } finally { msgs.pop(); msgs.pop(); }
        },
      });
      // `vacias`: en QUÉ intentos el cerebro devolvió una pantalla en blanco (1 y/o 2). Viaja al transcript aunque
      // la reparación después la rescate — que es justo el caso que el balance escondía dentro de «reparado».
      t.calls = r.calls; t.texto = r.texto; t.estado = r.estado; t.vetos = r.vetos; t.vacias = r.vacias; t.suplenteDigno = r.suplenteDigno;
      msgs.push({ role: "assistant", content: r.texto });
      respuestaAnterior = r.texto;   // el alcance del turno siguiente sale de acá
      // SOLO si el muro la aprobó: un texto vetado no presta sus cifras (candado de la regla del owner).
      if (r.aprobado) recita = recitaAprobadaDe({ textoAprobado: r.texto, catalogoEntidades: ENT6, previa: recita });
    } catch (e) { t.texto = `(ERROR: ${String(e && e.message).slice(0, 90)})`; t.estado = "error"; msgs.push({ role: "assistant", content: "(error)" }); respuestaAnterior = null; }
    turnos.push(t);
  }
  return turnos;
}

/* ── LA CORRIDA ── */
const registro = [];
/* FILTRO POR HILO (owner 2026-08-14, mini doble enfocada): `node _corrida_doble.mjs H1 H2` corre SOLO esos
 * hilos. Es el MISMO código —arnés, ciclo, notario, balance—, nunca un arnés paralelo que pueda divergir: una
 * medición enfocada tiene que ser comparable con la completa. Sin argumentos, corre los 9 hilos. */
const _filtro = process.argv.slice(2).filter((a) => /^H\d+$/i.test(a)).map((a) => a.toUpperCase());
const HILOS_A_CORRER = _filtro.length ? HILOS.filter((h) => _filtro.some((f) => h.id.toUpperCase().startsWith(f + "·"))) : HILOS;
if (_filtro.length) console.log(`◆ MINI DOBLE ENFOCADA — hilos ${_filtro.join(", ")} (${HILOS_A_CORRER.length} de ${HILOS.length})\n`);
for (const hilo of HILOS_A_CORRER) {
  console.log(`\n╔═══════════ ${hilo.id} ═══════════╗`);
  const A = await armActual(hilo);
  const B = await armNatural(hilo);
  registro.push({ hilo: hilo.id, A, B });
  for (let i = 0; i < hilo.turnos.length; i++) {
    console.log(`\n— «${hilo.turnos[i]}»`);
    console.log(`  ACTUAL  (${A[i].calls} llamadas${A[i].suplente ? " · SUPLENTE" : ""}${A[i].vetos.length ? " · vetos: " + A[i].vetos.join("|") : ""}):`);
    console.log(`    ${String(A[i].texto).replace(/\n/g, "\n    ").slice(0, 550)}`);
    const _vac = (B[i].vacias || []).length ? ` · ⬛ VACÍA del modelo en el intento ${B[i].vacias.join(" y ")}${B[i].suplenteDigno ? " → suplente digno" : " → rescatada por la reparación"}` : "";
    console.log(`  NATURAL (${B[i].calls} llamadas · ${B[i].estado}${B[i].vetos.length ? " · " + B[i].vetos.join(" · ") : ""}${_vac}):`);
    console.log(`    ${String(B[i].texto).replace(/\n/g, "\n    ").slice(0, 550)}`);
  }
}

const tA = registro.flatMap((r) => r.A), tB = registro.flatMap((r) => r.B);
console.log(`\n\n╔════════ BALANCE ════════╗`);
console.log(`ACTUAL : ${tA.reduce((a, t) => a + t.calls, 0)} llamadas · suplente en ${tA.filter((t) => t.suplente).length}/${tA.length} turnos · turnos con veto: ${tA.filter((t) => t.vetos.length).length}`);
/* LOS ESTADOS SON EXCLUYENTES y suman el total de turnos: verde + reparado + suplente + vacío + error. «vacío» es
 * CATEGORÍA PROPIA — un turno que terminó en el suplente digno porque el modelo devolvió una pantalla en blanco.
 * Y aparte se declara el CENSO del vacío: cuántos turnos vieron una respuesta en blanco en ALGÚN intento,
 * incluidos los que la reparación después rescató. Sin esa segunda línea, un vacío rescatado vuelve a esconderse
 * dentro de «reparado», que es exactamente el defecto que esta corrida destapó. */
const _conVacia = tB.filter((t) => (t.vacias || []).length);
console.log(`NATURAL: ${tB.reduce((a, t) => a + t.calls, 0)} llamadas · verde 1er intento ${tB.filter((t) => t.estado === "verde").length}/${tB.length} · reparados ${tB.filter((t) => t.estado === "reparado").length} · suplente ${tB.filter((t) => t.estado === "suplente").length} · VACÍAS ${tB.filter((t) => t.estado === "vacio").length} · errores ${tB.filter((t) => t.estado === "error").length}`);
console.log(`         censo del vacío: ${_conVacia.length}/${tB.length} turnos con una respuesta en blanco del modelo (intentos vacíos: ${_conVacia.reduce((a, t) => a + t.vacias.length, 0)}) · rescatados por la reparación ${_conVacia.filter((t) => t.estado === "reparado").length} · terminados en suplente digno ${tB.filter((t) => t.suplenteDigno).length}`);
const _todosConTexto = tB.every((t) => !esNarracionVacia(t.texto));
console.log(`         ${_todosConTexto ? `✓ los ${tB.length} turnos salieron con texto` : "✗ HAY TURNOS EN BLANCO — la garantía anti-vacío se rompió"}`);
console.log(`llamadas totales: ${llamadas}/${CAP}`);
// una corrida enfocada NO pisa el transcript de la completa: son mediciones distintas y las dos son evidencia.
const _destino = _filtro.length ? `_corrida_doble_${_filtro.join("").toLowerCase()}.json` : "_corrida_doble.json";
fs.writeFileSync(_destino, JSON.stringify({ fecha: "2026-08-14", hilos: HILOS_A_CORRER.map((h) => h.id), llamadas, registro }, null, 2), "utf8");
console.log(`transcript completo en ${_destino}`);
