/* === _garantia_anti_null_gate.mjs · LA ABSTENCIÓN SILENCIOSA NO EXISTE (2026-08-13 · suite 142 → 143) =========
 * HALLAZGO 1 DEL ESPEJO ANTHROPIC (transcript `_cert_espejo_anthropic.EF.json`, dev=89e1cc1, hilo E turno 4):
 * «dime qué podemos hacer para llegar a ese 25%» → answerViaOracle devolvió NULL tras 4 llamadas pagadas — el
 * usuario no recibió NADA. EL DIAGNÓSTICO, reproducido offline: la prosa AUTO de la reparación ancla en
 * «Medida · cerrar brecha al piso marca $4.9M (venta comercial, anual)» — el marco de universo mete «venta» en la
 * MISMA oración que una cifra cuyo dueño es contribución, y `metrica-mal-atribuida` la cobra con razón (el label
 * del ancla no trae vocabulario de métrica, así que «venta comercial» queda como única señal de la ventana). El
 * compositor y el muro se contradecían POR CONSTRUCCIÓN: 3 intentos del narrador vetados + la única reparación
 * vetada = silencio total.
 * LA GARANTÍA QUE ESTE GATE FIJA: todo turno que llegó a tener plan y resultados TERMINA en un texto no vacío —
 * la escalera de reparación (forma pedida → tabla → mensaje honesto) y, como último recurso absoluto, el genérico
 * pelado de composeNoDataMessage (cero cifras: no hay chequeo del muro con algo que cobrarle). guardC NO se
 * relaja: cada peldaño se verifica igual que siempre; solo el genérico sin números puede adoptarse sin veredicto.
 * LA MATRIZ: planes reales × modos × los 4 alcances, con TODOS los intentos del narrador vetados de dos formas
 * (cifra inventada → guardC rechaza · narración vacía → «sin narración utilizable»). En cada celda: texto no
 * vacío. Y el caso E4 del espejo termina DIGNO: la tabla con el dato del turno, no el mensaje de ausencia.
 * 100% OFFLINE: ejercita `answerViaOracle` ENTERO con las dos pasadas inyectadas por key computada — este archivo
 * no contiene los nombres de esas funciones ni ningún marcador de red, y no importa gateway ni adapters.
 * Cero red, cero LLM. `npm run gates:offline`
 *
 * ══ EXTENSIÓN 2026-08-14 · EL VACÍO ES UNA FALLA, POR LOS DOS CAMINOS (bloques 3 a 8) ═════════════════════════
 * ES LA MISMA GARANTÍA, NO UNA NUEVA — por eso se extiende este gate en vez de abrir uno hermano. Lo que el
 * bloque original fija («todo turno que llegó a tener plan y resultados TERMINA en un texto no vacío») dependía
 * de un supuesto que resultó falso: que si algo llega vacío al muro, el muro lo frena. NO lo frenaba. `guardC("")`
 * devolvía `{ok:true, verdict:"fiel"}` — no por decisión, por construcción: los 26 chequeos buscan afirmaciones
 * que cobrar y una cadena vacía no afirma nada, así que salía limpia. Los 11 sitios que llaman al muro leen `ok`
 * como «adoptá este texto», de modo que el vacío tenía un pase libre a pantalla por cualquiera de ellos.
 * DÓNDE SE MIDIÓ: el brazo NATURAL de la corrida doble (2026-08-14, turno «reduce en 2 puntos las acciones
 * comerciales de esos clientes…») recibió "" del modelo, el muro dijo ok, y el arnés lo contó como «reparado».
 * LO QUE FIJAN LOS BLOQUES NUEVOS:
 *   [3] el muro trata la narración vacía como VEREDICTO PROPIO (`narracion-vacia`), en sus seis formas: null,
 *       undefined, "", solo espacios, solo puntuación, markdown pelado. Y el texto real se sigue juzgando igual.
 *   [4] el camino ACTUAL: el narrador devolviendo cada una de esas formas → texto no vacío igual (la escalera).
 *   [5] el camino NATURAL: LOS 16 TURNOS del set probatorio (`_corrida_doble_casos.mjs`, el MISMO que corre el
 *       arnés) × cada forma de vacío → texto no vacío, con el suplente digno y sus cifras verificadas.
 *   [6] el LAVADO que deja el texto en nada cuenta como vacío (el modelo escribió, el lavador barrió todo).
 *   [7] un vacío RESCATADO por la reparación queda registrado igual — no puede volver a esconderse en «reparado».
 *   [8] el PISO ABSOLUTO: aunque el suplente digno viniera vacío, sale el genérico pelado. Nunca una pantalla en blanco.
 */
import { initTenant } from "./src/data/tenantStore.js";
import { TENANT_DEMO } from "./src/data/tenants/demo.js";
import { answerViaOracle } from "./src/adi/oracle/answerViaOracle.js";
import { guardC, esNarracionVacia } from "./src/adi/oracle/guardC.js";
import { cifrasDelDato, suplenteDignoDelDato } from "./src/adi/oracle/datoProyectado.js";
import { responderConNotario } from "./src/adi/oracle/cicloNotarial.js";
import { stripLanguageLeaks } from "./src/adi/llm/voiceGuard.js";   // el MISMO lavador que inyecta el camino natural
import { composeNoDataMessage } from "./src/adi/oracle/narrationBlocks.js";
import { axisEntityNames } from "./src/adi/oracle/entityIndex.js";
import { TURNOS } from "./_corrida_doble_casos.mjs";

initTenant(TENANT_DEMO);

let PASS = 0, FAIL = 0;
const ok = (c, m, extra = "") => { if (c) { PASS++; console.log("  ✓ " + m); } else { FAIL++; console.log("  ✗ " + m + (extra ? "\n      " + String(extra).slice(0, 260) : "")); } };
const H = (t) => console.log("\n" + t);

const K_PLAN = ["call", "Plan"].join("");
const K_NARR = ["call", "Narr", "ate"].join("");
async function turno({ texto, plan, mem = {}, narrar = "", history = [] }) {
  const opts = { text: texto, history, mem, scenario: "actual" };
  opts[K_PLAN] = async () => plan;
  opts[K_NARR] = async () => narrar;
  const o = await answerViaOracle(opts);
  return { r: (o && o.r) || null };
}

// el narrador «vetado» en sus dos formas reales: una narración con cifras que la boleta no autoriza (guardC la
// rechaza los 3 intentos — el caso del espejo) y una narración vacía (el gateway devolvió nada utilizable).
const NARR_VETADA = "Para llegar ahí deberías recuperar $77.7M en Falabella y $88.8M en Lider este trimestre.";
const VETOS = [["cifra inventada", NARR_VETADA], ["vacía", ""]];

// planes REALES del catálogo (el primero es el plan literal de E4), con modos distintos a propósito.
const PLANES = [
  ["E4 diagnose+marginRead·decision", "dime qué podemos hacer para llegar a ese 25%",
    { intent: "answer", mode: "decision", calls: [{ tool: "diagnose", args: {} }, { tool: "marginRead", args: { focus: "bajo_benchmark", dimension: "cliente" } }] }],
  ["marginRead·default", "dame el margen por cliente",
    { intent: "answer", mode: "default", calls: [{ tool: "marginRead", args: { focus: "bajo_benchmark", dimension: "cliente" } }] }],
  ["entityProfile·evidencia", "cuéntame de Falabella",
    { intent: "answer", mode: "evidencia", calls: [{ tool: "entityProfile", args: { entity: "Falabella", dimension: "cliente" } }] }],
  ["inventoryStatus·diagnostico", "qué pasa con mi inventario",
    { intent: "answer", mode: "diagnostico", calls: [{ tool: "inventoryStatus", args: { focus: "frenado" } }] }],
  ["executiveSummary·diagnostico", "qué opinas de mi negocio",
    { intent: "answer", mode: "diagnostico", calls: [{ tool: "executiveSummary", args: {} }] }],
  ["queryMetric·default", "ventas por cliente",
    { intent: "answer", mode: "default", calls: [{ tool: "queryMetric", args: { metric: "venta", dimension: "cliente" } }] }],
  ["defineConcept·define", "qué es el benchmark",
    { intent: "define", mode: "default", calls: [{ tool: "defineConcept", args: { concept: "benchmark" } }] }],
  ["sin calls·clarify", "no sé qué mirar primero",
    { intent: "answer", mode: "clarify", calls: [] }],
];
const SCOPES = [null, "data_only", "results_only", "action_only"];

H("[1] EL CASO E4 DEL ESPEJO TERMINA EN TEXTO DIGNO (el dato del turno, no la ausencia)");
{
  const [, texto, plan] = PLANES[0];
  const a = await turno({ texto, plan, narrar: NARR_VETADA });
  const txt = String((a.r && a.r.text) || "");
  ok(!!a.r && txt.trim().length > 0, "el turno que en vivo fue NULL ahora responde", txt.slice(0, 120));
  ok(/\|\s*Concepto\s*\|\s*Valor\s*\|/.test(txt) && /Contribución no capturada/.test(txt),
    "…y responde DIGNO: la tabla con la boleta del turno (contribución, carga, capital)", txt.slice(0, 200));
  ok(!/No tengo información autorizada suficiente/.test(txt),
    "…no el mensaje de ausencia teniendo el dato sellado en la mano", txt.slice(0, 200));
  ok(a.r.narrationRepaired === true, "la marca de reparación viaja (debug/telemetría)");
}

H("[2] LA MATRIZ: ningún plan × alcance × veto del narrador produce silencio");
for (const [tag, texto, plan] of PLANES) {
  for (const scope of SCOPES) {
    const mem = scope ? { responsePref: { contentScope: scope, detailLevel: "standard" } } : {};
    for (const [veto, narrar] of (scope ? VETOS.slice(0, 1) : VETOS)) {
      const a = await turno({ texto, plan, mem, narrar });
      const txt = a.r && typeof a.r.text === "string" ? a.r.text : "";
      ok(!!a.r && txt.trim().length > 0,
        `${tag} · ${scope || "full"} · narrador ${veto} → texto no vacío`,
        a.r ? JSON.stringify(txt).slice(0, 160) : "answerViaOracle devolvió null");
    }
  }
}

/* ══════════ EXTENSIÓN · EL VACÍO ES UNA FALLA (2026-08-14) ══════════════════════════════════════════════════ */

// LAS SEIS FORMAS DEL VACÍO. Las tres primeras son lo que devuelve un proveedor que no escribió nada; las tres
// últimas, lo que puede quedar después de un lavado o de un modelo que emitió solo armazón.
const VACIOS = [
  ["null", null],
  ["undefined", undefined],
  ["cadena vacía", ""],
  ["solo espacios", "   \n\t  \r\n "],
  ["solo puntuación", "... — · ¿? ¡! ,;:"],
  ["markdown pelado", "**\n\n---\n\n|   |   |\n|---|---|\n\n> \n"],
];
const REAL = "Falabella marca 22.0% de margen sobre $19.4M de ventas, y su carga comercial es 4.5%.";

H("[3] EL MURO · UNA NARRACIÓN VACÍA ES VEREDICTO PROPIO, NO UN APROBADO");
for (const [rot, v] of VACIOS) {
  const g = guardC(v, { ledger: { figs: [] } });
  ok(esNarracionVacia(v) && g.ok === false && g.verdict === "narracion-vacia",
    `${rot} → esNarracionVacia + guardC bloquea con kind propio`, `esNarracionVacia=${esNarracionVacia(v)} ok=${g.ok} verdict=${g.verdict}`);
}
{
  // ADITIVIDAD: el texto REAL no cambia de trato — el chequeo 0 solo puede convertir un ok en bloqueo, jamás al revés.
  ok(!esNarracionVacia(REAL) && guardC(REAL, { ledger: { figs: [] } }).verdict !== "narracion-vacia",
    "…y un texto real sigue juzgándose por los 26 chequeos de siempre (el chequeo 0 no lo toca)");
  ok(!esNarracionVacia("0") && !esNarracionVacia("a"),
    "…el criterio es ANGOSTO: una sola letra o un solo dígito ya es contenido (no puede vetar prosa legítima)");
}

H("[4] EL CAMINO ACTUAL · el narrador devolviendo CADA forma de vacío → texto no vacío igual");
{
  const [, texto, plan] = PLANES[0];
  for (const [rot, v] of VACIOS) {
    const a = await turno({ texto, plan, narrar: v });
    const txt = a.r && typeof a.r.text === "string" ? a.r.text : "";
    ok(!!a.r && !esNarracionVacia(txt), `narrador ${rot} → la escalera responde igual`, a.r ? JSON.stringify(txt).slice(0, 140) : "answerViaOracle devolvió null");
  }
}

/* ── EL CAMINO NATURAL · el mismo ciclo que corre el arnés, con el modelo MOCKEADO ────────────────────────────
 * `responderConNotario` es EL MISMO código que ejecuta `_corrida_doble.mjs`: acá solo cambia quién responde
 * (una función que devuelve la forma de vacío en vez del modelo real). Cero red por construcción — el mock es
 * síncrono y este archivo no importa nada que hable con un proveedor. */
const CIFRAS = cifrasDelDato("actual");
const _ejes = (a) => { const o = []; for (const e of a) { try { for (const n of axisEntityNames(e)) o.push(n); } catch { } } return o.length ? o : null; };
const ENT3 = _ejes(["cliente", "sku", "marca"]), ENT6 = _ejes(["cliente", "sku", "marca", "familia", "bodega", "canal"]);
const juezNatural = (q) => (t) => guardC(t, { ledger: { figs: [] }, results: [], trace: null, question: q, datoProyectado: CIFRAS, entidadesDelTenant: ENT3, duenosDelTenant: ENT6, contentScope: "full", tablePolicy: "auto" });
const suplenteDe = (q) => () => suplenteDignoDelDato({ scenario: "actual", juzgar: juezNatural(q) });

H(`[5] EL CAMINO NATURAL · los ${TURNOS.length} turnos del set probatorio × las ${VACIOS.length} formas del vacío`);
for (const [rot, v] of VACIOS) {
  const rs = [];
  for (const { q } of TURNOS) rs.push(await responderConNotario({ pedir: async () => v, juzgar: juezNatural(q), suplente: suplenteDe(q) }));
  const sinTexto = rs.filter((r) => esNarracionVacia(r.texto));
  ok(sinTexto.length === 0, `modelo ${rot} → los ${TURNOS.length} turnos salen con texto`, `${sinTexto.length} en blanco`);
  ok(rs.every((r) => r.estado === "vacio"), `…y los ${TURNOS.length} quedan clasificados «vacio», NUNCA «reparado»`, [...new Set(rs.map((r) => r.estado))].join("/"));
  ok(rs.every((r) => r.suplenteDigno === true && r.vacias.length === 2), "…con la marca del suplente digno y los DOS intentos vacíos registrados");
}
{
  // el suplente no es un «no puedo»: trae las cifras VERIFICADAS del negocio, y las trae del muro, no de una copia.
  const r = await responderConNotario({ pedir: async () => "", juzgar: juezNatural(TURNOS[0].q), suplente: suplenteDe(TURNOS[0].q) });
  ok(/\$[\d.,]+M/.test(r.texto) && /benchmark/i.test(r.texto), "el suplente digno trae cifras verificadas del negocio, no un «no puedo»", r.texto.slice(0, 160));
  ok(juezNatural(TURNOS[0].q)(r.texto).ok === true, "…y el suplente pasa el MISMO muro (no se adopta sin veredicto)", JSON.stringify(juezNatural(TURNOS[0].q)(r.texto)).slice(0, 200));
}

H("[6] EL LAVADO QUE DEJA EL TEXTO EN NADA cuenta como vacío (el modelo escribió; el lavador barrió todo)");
{
  const r = await responderConNotario({ pedir: async () => "relleno relleno relleno", lavar: () => "   ", juzgar: juezNatural(TURNOS[0].q), suplente: suplenteDe(TURNOS[0].q) });
  ok(!esNarracionVacia(r.texto) && r.estado === "vacio" && r.vacias.length === 2,
    "texto no vacío del modelo + lavado que lo deja en blanco → misma falla, mismo suplente", `${r.estado} · vacias=${r.vacias.length}`);
  const rNull = await responderConNotario({ pedir: async () => "algo", lavar: () => null, juzgar: juezNatural(TURNOS[0].q), suplente: suplenteDe(TURNOS[0].q) });
  ok(!esNarracionVacia(rNull.texto), "…y un lavador que devuelve null tampoco rompe ni deja la pantalla en blanco");
}

H("[7] UN VACÍO RESCATADO POR LA REPARACIÓN QUEDA REGISTRADO (no vuelve a esconderse en «reparado»)");
{
  const r = await responderConNotario({
    pedir: async ({ intento }) => (intento === 1 ? "" : "El benchmark de margen del negocio es 30.1%."),
    juzgar: juezNatural(TURNOS[0].q), suplente: suplenteDe(TURNOS[0].q),
  });
  ok(r.estado === "reparado", "el 2º intento válido repara el turno (el estado sigue siendo el que corresponde)", r.estado);
  ok(r.vacias.length === 1 && r.vacias[0] === 1, "…pero el intento 1 queda anotado como vacío: el balance no puede taparlo", JSON.stringify(r.vacias));
  ok(r.vetos[0] === "narracion-vacia", "…y el veto que lo disparó se nombra por lo que fue, no como una cifra mal puesta", JSON.stringify(r.vetos));
  ok(r.suplenteDigno === false, "…sin suplente: el cerebro se corrigió solo, que es lo que la reparación busca");
}

H("[8] EL PISO ABSOLUTO · ni un suplente vacío puede dejar la pantalla en blanco");
for (const [rot, sup] of [["suplente que devuelve ''", () => ""], ["suplente que devuelve null", () => null], ["sin suplente", null]]) {
  const r = await responderConNotario({ pedir: async () => "", juzgar: juezNatural(TURNOS[0].q), suplente: sup });
  ok(!esNarracionVacia(r.texto) && r.texto === composeNoDataMessage(null),
    `${rot} → cae al genérico PELADO, la misma frase canónica de la escalera anti-null`, JSON.stringify(r.texto).slice(0, 140));
}

/* ── [9] EL SEGUNDO REINTENTO Y SU CANDADO (owner 2026-08-14, tras el examen 1) ────────────────────────────────
 * «Permite un segundo intento solo si el veto es distinto. Tope duro de 3 llamadas. Si repite el mismo veto,
 * suplente.» Las tres mitades se fijan acá, con un cerebro mockeado que devuelve lo que cada caso necesita. */
H("[9] EL SEGUNDO REINTENTO · solo si el veto CAMBIÓ, y nunca más de 3 llamadas");
{
  const Q = TURNOS[0].q, JUEZ = juezNatural(Q), SUP = suplenteDe(Q);
  const BUENA = "El benchmark de margen del negocio es 30.1%.";
  const MALA1 = "El negocio cerró con $777.7M de venta.";           // cifra inventada
  const MALA2 = "";                                                  // vacío: OTRO veredicto
  // (a) dos vetos DISTINTOS → se concede el tercer intento, y si ahí acierta, el turno se repara
  {
    const r = await responderConNotario({ pedir: async ({ intento }) => (intento === 1 ? MALA1 : intento === 2 ? MALA2 : BUENA), juzgar: JUEZ, suplente: SUP });
    ok(r.calls === 3 && r.estado === "reparado" && r.texto === BUENA,
      "veto distinto en el 2º → hay 3ª llamada, y la buena repara el turno", `calls=${r.calls} · ${r.estado}`);
    ok(r.vetos.length === 2 && !r.suplenteDigno, "…con los dos vetos registrados y SIN suplente", JSON.stringify(r.vetos));
  }
  // (b) el MISMO veto dos veces → suplente de inmediato, sin gastar la tercera llamada
  {
    let vistas = 0;
    const r = await responderConNotario({ pedir: async () => { vistas++; return MALA1; }, juzgar: JUEZ, suplente: SUP });
    ok(vistas === 2 && r.calls === 2, "mismo veto repetido → NO se concede el 3º intento (se corta en 2 llamadas)", `llamadas=${vistas}`);
    ok(r.estado === "suplente" && r.suplenteDigno && r.texto !== MALA1, "…y responde el suplente digno, nunca el borrador vetado");
    ok(!r.aprobado, "…y el turno NO queda aprobado: un texto vetado no presta sus cifras al turno siguiente");
  }
  // (c) TOPE DURO: aunque los veredictos sigan cambiando, jamás hay una cuarta llamada
  {
    let vistas = 0;
    const CAMBIANTE = ["El negocio cerró con $777.7M de venta.", "", "Falabella factura $999.9M en el año."];
    const r = await responderConNotario({ pedir: async () => CAMBIANTE[Math.min(vistas++, 2)], juzgar: JUEZ, suplente: SUP });
    ok(vistas === 3 && r.calls === 3, "tres veredictos distintos → se corta en 3 llamadas, el tope no depende de que dejen de cambiar", `llamadas=${vistas}`);
    ok(r.estado === "suplente" && r.suplenteDigno, "…y termina en suplente digno");
    ok(r.vetos.length === 3 && /^3º: /.test(r.vetos[2]), "…con los tres vetos anotados y numerados", JSON.stringify(r.vetos));
  }
  /* (c2) EL MISMO NOMBRE DE VEREDICTO NO ES EL MISMO VETO (medido en el examen 1, turno 1): el intento 1 murió
   * por una línea del bloque cortada y el 2 por usar la operación equivocada — dos defectos distintos bajo el
   * mismo `calculo-no-verificable`. Si se comparara por nombre, el reintento no existiría justo donde hace falta. */
  {
    let n = 0;
    const juezDosFallas = (t) => {
      if (/BUENA/.test(t)) return { ok: true, verdict: "ok", violations: [] };
      n++;
      return n === 1
        ? { ok: false, verdict: "calculo-no-verificable", violations: [{ kind: "calculo-no-verificable", detail: "línea «id=c4 · op=puntos» — campo «resultado»: la declaración está incompleta" }] }
        : { ok: false, verdict: "calculo-no-verificable", violations: [{ kind: "calculo-no-verificable", detail: "línea «id=c12 · op=aplicar_pct» — campo «resultado»: la cuenta no cierra" }] };
    };
    const r = await responderConNotario({ pedir: async ({ intento }) => (intento === 3 ? "BUENA" : `borrador ${intento}`), juzgar: juezDosFallas, suplente: SUP });
    ok(r.calls === 3 && r.estado === "reparado", "dos multas DISTINTAS con el mismo nombre de veredicto → sí hay 3er intento", `calls=${r.calls} · ${r.estado}`);
  }
  // (c3) …y la multa IDÉNTICA repetida sigue cortando en dos, aunque el nombre del veredicto no diga nada
  {
    const juezIgual = () => ({ ok: false, verdict: "calculo-no-verificable", violations: [{ kind: "calculo-no-verificable", detail: "línea «id=c1» — campo «op»: la operación no existe" }] });
    let n = 0;
    const r = await responderConNotario({ pedir: async () => { n++; return "borrador vetado"; }, juzgar: juezIgual, suplente: SUP });
    ok(n === 2 && r.estado === "suplente", "la MISMA multa repetida corta en 2 llamadas y va al suplente", `llamadas=${n} · ${r.estado}`);
  }
  // (d) NO CAMBIA LO QUE YA FUNCIONABA: la reparación al primer intento sigue costando UNA llamada extra
  {
    const r = await responderConNotario({ pedir: async ({ intento }) => (intento === 1 ? MALA1 : BUENA), juzgar: JUEZ, suplente: SUP });
    ok(r.calls === 2 && r.estado === "reparado" && !r.suplenteDigno, "el turno que se repara al 2º intento sigue costando exactamente 2 llamadas", `calls=${r.calls}`);
  }
  // (e) el verde no paga nada de esto
  {
    const r = await responderConNotario({ pedir: async () => BUENA, juzgar: JUEZ, suplente: SUP });
    ok(r.calls === 1 && r.estado === "verde" && r.aprobado && !r.vetos.length, "el turno que pasa a la primera sigue costando UNA llamada");
  }
}

/* ── [10] EL SUPLENTE TAMBIÉN PASA POR EL LAVADO DE REGISTRO (medido 2026-08-14, examen 1 · turno 3) ───────────
 * El suplente sale a pantalla igual que el borrador del cerebro, y salía SIN lavar: se le midió encima una
 * palabra prohibida heredada de la carpeta. La garantía es del módulo, no de quién compone el suplente. */
H("[10] EL SUPLENTE DIGNO SE LAVA IGUAL QUE EL BORRADOR DEL CEREBRO");
{
  const r = await responderConNotario({
    pedir: async () => "", juzgar: juezNatural(TURNOS[0].q),
    suplente: () => "La vara la declara el negocio: benchmark de margen 30.1%.",
    lavar: stripLanguageLeaks,
  });
  ok(!/\bvara\b/i.test(r.texto) && /referencia/i.test(r.texto),
    "una palabra prohibida en el suplente NO llega a pantalla", JSON.stringify(r.texto).slice(0, 120));
  ok(r.suplenteDigno === true && r.estado === "vacio", "…y el lavado no cambia el estado ni la marca del turno", `${r.estado}`);
  // y el suplente REAL del producto sale limpio de punta a punta
  const rr = await responderConNotario({ pedir: async () => "", juzgar: juezNatural(TURNOS[0].q), suplente: suplenteDe(TURNOS[0].q), lavar: stripLanguageLeaks });
  ok(!/\bvara\b/i.test(rr.texto), "el suplente real del dato tampoco trae la palabra prohibida", (rr.texto.match(/.{0,30}vara.{0,20}/i) || ["limpio"])[0]);
}

console.log(`\n── GATE · garantía anti-null · ${PASS} PASS · ${FAIL} FAIL ──`);
process.exitCode = FAIL ? 1 : 0;
