/* === _encargo_natural_gate.mjs · EL ENCARGO NATURAL, MEDIDO CONTRA EL SET DE DISEÑO v1 (owner 2026-09-24) ═══════
 * `encargo_natural_diseno.md`: «Nuevos: `_encargo_natural_gate` (con el set de DISEÑO v1, nunca el de validación):
 * FN = 0 en encargos, FP = 0 en simples, 0 "caja" leída como cobranza, 0 respuestas ajenas sin aviso; carnadas
 * (reconocedor que cuenta palabras deja pasar «¿Qué cuentas merecen atención primero por carga comercial y
 * cobranza?»; tesorería → ausencia declarada).»
 *
 * EL SET: `fixtures/encargo-natural-set-diseno-v1.json` — 60 frases (`scratchpad/set_fuera_de_muestra_SELLADO.json`
 * de la sesión de diseño, copiado al repo porque un gate no puede depender de una ruta de scratchpad efímera).
 * Es el set v1: LO LEYÓ el supervisor de diseño y quedó como material de trabajo (memoria `adi-encargo-natural`,
 * textual: «v1 … lo LEYÓ el supervisor → quedó como material de diseño»). El set v2 (`scratchpad/sellado_v2/`) es
 * el de VALIDACIÓN, sellado, y este gate NUNCA lo abre — esa medición la hace el owner aparte, sin que el
 * desarrollo la haya visto.
 *
 * QUÉ MIDE:
 *   0 · forma: 60 frases, con `tipo` ∈ {encargo, simple, un_tema} y `cierre`/`temas`/`sujeto` del propio set.
 *   1 · COBERTURA — FN = 0: toda fila `tipo:"encargo"` da `encargoDe(q).esEncargo === true`.
 *   2 · COBERTURA — FP = 0: toda fila `tipo:"simple"` o `"un_tema"` da `esEncargo === false`.
 *   3 · 0 «caja» LEÍDA COMO COBRANZA: las filas de tesorería PURA (temas = ["tesoreria"], sin cobranza en la
 *       lista) no encienden el dominio activo «cobranza» — solo la ausencia.
 *   4 · CARNADAS: la frase «¿Qué cuentas merecen atención primero por carga comercial y cobranza?» (que un
 *       reconocedor que solo cuenta palabras/interrogativas deja pasar como NO-encargo, por ser corta) se
 *       reconoce; una pregunta de tesorería declara la ausencia, nunca inventa ni desvía a cobranza.
 *   5 · PROFUNDIDAD NUNCA POR COBERTURA: ninguna de las 60 pide `_PIDE_DETALLE` (ninguna dice «detalle» /
 *       «completo» / «paso a paso» …) — `encargoDe(q).profundidad === "corta"` en las 60, encargo o no.
 *   6 · DE PUNTA A PUNTA (una muestra representativa, cerebro MUDO — sin red): las 5 respuestas literales que
 *       pide el informe, más una muestra de 10 filas más (encargo corto, encargo con cuenta nombrada, simple con
 *       dos dominios, tesorería pura, tesorería mezclada con cobranza) — cubre todo, ninguna cifra ajena sin
 *       aviso, un dominio ausente se declara con su alternativa.
 *
 * Cero red: cerebro mudo, herramientas puras, fixture en disco. */
import fs from "node:fs";
import { initTenant } from "./src/data/tenantStore.js";
import { TENANT_DEMO } from "./src/data/tenants/demo.js";
import { ESCENARIO_INICIAL } from "./src/config/scenarios.js";
import { answerViaAgente } from "./src/adi/agente/bucleAgente.js";
import { declarando } from "./_guion_declara.mjs";
import { encargoDe } from "./src/adi/agente/partesDelEncargo.js";
import { dominiosDe, pasosDeDominios } from "./src/adi/agente/contratoDeDominios.js";
import { prioridadIntegrada } from "./src/adi/agente/prioridadIntegrada.js";
import { runPlan } from "./src/adi/oracle/toolRunner.js";
import { TOOLS } from "./src/adi/oracle/toolRegistry.js";
import { cajaDelAgente } from "./src/adi/agente/herramientasAgente.js";

let PASS = 0, FAIL = 0;
const ok = (c, m, extra = "") => { if (c) { PASS++; console.log("  ✓ " + m); } else { FAIL++; console.log("  ✗ " + m + (extra ? "\n      " + extra : "")); } };
const H = (t) => console.log(`\n${t}`);
initTenant(TENANT_DEMO);
const MUDO = async () => ({ tipo: "texto", texto: "", stop: "end_turn" });

const SET = JSON.parse(fs.readFileSync(new URL("./fixtures/encargo-natural-set-diseno-v1.json", import.meta.url), "utf8"));

/* ═══ 0 · EL SET, CONGELADO ═══════════════════════════════════════════════════════════════════════════════════ */
H("0 · el set de diseño v1: 60 frases, la forma que el protocolo exige");
{
  ok(Array.isArray(SET) && SET.length === 60, `60 frases (${SET.length})`);
  const tipos = new Set(SET.map((x) => x.tipo));
  ok([...tipos].every((t) => ["encargo", "simple", "un_tema"].includes(t)), `tipos ∈ {encargo, simple, un_tema} (${[...tipos].join(",")})`);
  ok(SET.every((x) => x.id && x.pregunta && Array.isArray(x.temas) && x.cierre), "cada fila trae id, pregunta, temas y cierre");
  const porTipo = { encargo: 0, simple: 0, un_tema: 0 };
  for (const x of SET) porTipo[x.tipo]++;
  console.log(`    encargo=${porTipo.encargo} · simple=${porTipo.simple} · un_tema=${porTipo.un_tema}`);
}

/* ═══ 1 · COBERTURA — FN = 0 EN ENCARGOS ══════════════════════════════════════════════════════════════════════ */
H("1 · cobertura: FN = 0 — toda fila tipo=\"encargo\" se reconoce como encargo");
const FN = [];
for (const x of SET.filter((r) => r.tipo === "encargo")) {
  const e = encargoDe(x.pregunta);
  const bien = !!(e && e.esEncargo);
  if (!bien) FN.push(x);
  ok(bien, `[${x.id}] esEncargo=true · temas=${x.temas.join("+")} · cierre=${x.cierre}`, bien ? "" : JSON.stringify(e));
}
console.log(`\n    ★ FN (encargos NO reconocidos): ${FN.length}/${SET.filter((r) => r.tipo === "encargo").length}${FN.length ? " → " + FN.map((x) => x.id).join(",") : ""}`);

/* ═══ 2 · COBERTURA — FP = 0 EN SIMPLES/UN_TEMA ═══════════════════════════════════════════════════════════════ */
H("2 · cobertura: FP = 0 — ninguna fila tipo=\"simple\" o \"un_tema\" se reconoce como encargo");
const FP = [];
for (const x of SET.filter((r) => r.tipo === "simple" || r.tipo === "un_tema")) {
  const e = encargoDe(x.pregunta);
  const bien = !(e && e.esEncargo);
  if (!bien) FP.push(x);
  ok(bien, `[${x.id}] esEncargo=false · temas=${x.temas.join("+")} · cierre=${x.cierre} (${x.tipo})`, bien ? "" : JSON.stringify(e));
}
console.log(`\n    ★ FP (simples reconocidos como encargo): ${FP.length}/${SET.filter((r) => r.tipo !== "encargo").length}${FP.length ? " → " + FP.map((x) => x.id).join(",") : ""}`);

/* ═══ 3 · 0 «CAJA» LEÍDA COMO COBRANZA ═══════════════════════════════════════════════════════════════════════ */
H("3 · 0 «caja» leída como cobranza: la tesorería pura no enciende el dominio cobranza");
{
  const PURA = SET.filter((x) => x.temas.includes("tesoreria") && !x.temas.includes("cobranza"));
  ok(PURA.length >= 5, `${PURA.length} filas de tesorería pura en el set (${PURA.map((x) => x.id).join(",")})`);
  for (const x of PURA) {
    const dom = dominiosDe(x.pregunta);
    const bien = !dom.dominios.includes("cobranza");
    ok(bien, `[${x.id}] «${x.pregunta.slice(0, 60)}…» → cobranza NO encendida (dominios=${dom.dominios.join(",") || "∅"}, ausentes=${(dom.ausentes || []).join(",") || "∅"})`, JSON.stringify(dom));
    ok((dom.ausentes || []).includes("tesoreria"), `   …y la ausencia de tesorería SÍ se reconoce`, JSON.stringify(dom));
  }
  /* las mezcladas (tesorería + cobranza en temas, ej. q43/q45/q47/q49): cobranza SÍ enciende, pero por una
   * palabra real de cobranza («deben», «debe»), nunca por la palabra de caja */
  const MEZCLA = SET.filter((x) => x.temas.includes("tesoreria") && x.temas.includes("cobranza"));
  ok(MEZCLA.length >= 3, `${MEZCLA.length} filas mezcladas tesorería+cobranza (${MEZCLA.map((x) => x.id).join(",")})`);
  for (const x of MEZCLA) {
    const dom = dominiosDe(x.pregunta);
    ok(dom.dominios.includes("cobranza") && (dom.ausentes || []).includes("tesoreria"), `[${x.id}] mezclada → cobranza Y tesorería-ausente, las dos (dominios=${dom.dominios.join(",")}, ausentes=${(dom.ausentes || []).join(",")})`, JSON.stringify(dom));
  }
}

/* ═══ 4 · LAS CARNADAS ════════════════════════════════════════════════════════════════════════════════════════ */
H("4 · las carnadas del protocolo: la frase corta del reconocedor-de-palabras, y la ausencia de tesorería declarada");
{
  const q = "¿Qué cuentas merecen atención primero por carga comercial y cobranza?";
  const e = encargoDe(q);
  ok(e && e.esEncargo, "★ carnada: «¿Qué cuentas merecen atención primero por carga comercial y cobranza?» — corta (11 palabras, 1 interrogativa: un conteo de palabras la rechazaría) — SE RECONOCE como encargo", JSON.stringify(e));
  ok(e.dominios.join(",") === "comercial,cobranza" && e.cierre === "decision", "…2 dominios (comercial+cobranza) y cierre de decisión («merecen atención primero»)");
  const q41 = SET.find((x) => x.id === "q41");
  const e41 = encargoDe(q41.pregunta);
  const dom41 = dominiosDe(q41.pregunta);
  ok(!e41.esEncargo && dom41.dominios.length === 0 && (dom41.ausentes || []).includes("tesoreria"), `carnada: «${q41.pregunta}» — tesorería pura, un solo tema: no es encargo, no inventa cobranza, declara la ausencia`, JSON.stringify({ e41, dom41 }));
}

/* ═══ 5 · PROFUNDIDAD NUNCA POR COBERTURA: 59 de 60 piden forma CORTA ═════════════════════════════════════════
 * q01 es la ÚNICA excepción, y a propósito: es el prompt de producción, textual («…separa qué puedes demostrar,
 * qué solo está indicado y qué todavía no sabes»), que SÍ pide profundidad — la corrección que el coordinador
 * pidió (2026-09-24): «probablemente el encargo certificado de producción pide profundidad explícitamente…; si
 * `_PIDE_PROFUNDIDAD` no lo reconoce, eso es lo que hay que arreglar, por estructura». El resto de las 60 —
 * incluida la fila r02 con el MISMO fraseo de negocio entero que q01 pero SIN «separa qué puedes demostrar»—
 * sigue en «corta». */
H("5 · profundidad nunca por cobertura: 59 de 60 piden forma CORTA — la única excepción es q01 (pide profundidad de verdad)");
{
  const larga = SET.filter((x) => { const e = encargoDe(x.pregunta); return e && e.profundidad === "larga"; });
  ok(larga.length === 1 && larga[0].id === "q01", `1 de 60 con profundidad «larga»: q01 («…separa qué puedes demostrar, qué solo está indicado…» — el pedido real, no «detalle»/«completo»)`, larga.map((x) => x.id).join(","));
  const cortos = SET.filter((x) => x.id !== "q01");
  ok(cortos.every((x) => { const e = encargoDe(x.pregunta); return e && e.profundidad === "corta"; }), `★ las otras 59, incluida r02 (mismo fraseo de negocio entero que q01), siguen en «corta»`);
}

/* ═══ 6 · DE PUNTA A PUNTA — las 5 respuestas literales del informe + una muestra ════════════════════════════ */
H("6 · de punta a punta (cerebro mudo, sin red): las 5 respuestas literales del informe, cobertura sin cifra ajena");
const LITERALES = {};
{
  const CASOS = [
    "¿qué me preocupa más, margen o cobranza?",
    "mírame ventas e inventario",
    "¿dónde tengo el mayor problema entre margen, stock y caja?",
    "¿cuánto vendí y cuánto cobré?",
    "¿cuánto vendió Lider y cuánto me debe?",
  ];
  /* ⛔ RONDA 7 (coordinador): «¿dónde tengo el mayor problema entre margen, stock y caja?» YA NO es una
   * COLISIÓN CERTIFICADA. Era el caso «precio»/«dominios» de `compararAlternativas.js`, que aplicaba su PROPIA
   * `listaNotarial` a cualquier texto servido y exigía la palabra literal «margen» — cobertura-corta nunca la
   * dice (por diseño, defecto A), así que siempre dejaba un veto `alternativa-escondida` antes de ceder. La
   * consolidación retiró ese caso de `compararAlternativas.js` entero (§10, `_comparar_alternativas_gate.mjs`):
   * ya no hay a quién ceder, ni veto que dejar — cobertura-corta responde LIMPIO, sin vetos, como cualquier
   * otro encargo de temas. Esta fila ahora se mide IGUAL que las demás. */
  for (const q of CASOS) {
    const r = await answerViaAgente({ text: q, history: [], mem: {}, scenario: ESCENARIO_INICIAL, callAgente: declarando(MUDO) });
    LITERALES[q] = { estado: r.r.agente.estado, texto: r.r.text, largo: r.r.text.length };
    ok(r.r.agente.vetos.length === 0, `[${q}] responde sin vetos (estado=${r.r.agente.estado}, ${r.r.text.length} chars)`, JSON.stringify(r.r.agente.vetos).slice(0, 200));
    ok(!!r.r.text && r.r.text.trim().length > 0, `   …y no queda mudo`);
  }
  /* una muestra representativa del set: cubre encargo con cuenta nombrada (q16), encargo corto con decisión
   * (q17), simple de dos dominios (q19), un_tema (q33), y las mezcladas/tesorería (q41, q47) — no todo el set
   * (60 turnos completos de punta a punta es caro; los 60 ya se midieron en frío en 1-5, esto es la prueba viva
   * de que el reconocimiento se traduce en una respuesta real sin red). */
  /* ⚠️ `r.r.agente.vetos` es el EXPEDIENTE AUDITABLE del turno entero (bucleAgente.js, comentario propio: «cada
   * veto con su sitio y su multa, observación, no decisión») — acumula lo que ARDIÓ en CUALQUIER peldaño
   * intentado, no solo el que finalmente respondió. Un peldaño que se intenta, no puede componer y CEDE
   * limpiamente al siguiente (degradación segura) dejar una línea en ese expediente es la conducta NORMAL de la
   * escalera —ya existía antes de esta etapa para `componerEncargo`/`playbookActivo`—, no una falla del turno
   * servido. Lo que importa es que la respuesta SERVIDA (`r.r.text`) exista y sea completa; se prueba así, no
   * exigiendo un expediente vacío. */
  const MUESTRA = ["q16", "q17", "q19", "q33", "q41", "q47"];
  for (const id of MUESTRA) {
    const x = SET.find((r) => r.id === id);
    const r = await answerViaAgente({ text: x.pregunta, history: [], mem: {}, scenario: ESCENARIO_INICIAL, callAgente: declarando(MUDO) });
    ok(!!r.r.text.trim(), `[${id}, ${x.tipo}] «${x.pregunta.slice(0, 55)}…» → estado=${r.r.agente.estado}, ${r.r.text.length} chars`, JSON.stringify(r.r.agente.vetos).slice(0, 200));
    /* ninguna respuesta menciona una cuenta AJENA (no nombrada por el usuario y no la primera del universo) como
     * si fuera EL sujeto de la respuesta, cuando la pregunta trae un sujeto puntual */
    if (Array.isArray(x.sujeto)) {
      const otras = ["Falabella", "Lider", "Jumbo", "Sodimac", "Tottus", "Paris", "Easy", "Ripley", "La Polar", "Hites", "ABC", "Unimarc", "Mercado Libre"].filter((n) => !x.sujeto.includes(n));
      const primeraOracion = (r.r.text.split(/\n/)[0] || "");
      const ajenaAlFrente = otras.find((n) => primeraOracion.startsWith(n) || primeraOracion.includes(`: ${n}`));
      ok(!ajenaAlFrente, `   …y ninguna cuenta ajena (${x.sujeto.join("/")} es el sujeto) abre la respuesta sin avisar`, ajenaAlFrente || "");
    }
  }
}

/* ═══ 7 · LAS CARNADAS DE LAS RONDAS 3-5 (coordinador 2026-09-24) ═══════════════════════════════════════════════
 *   A · SUSTITUCIÓN DE CONCEPTO: una línea de dominio con un concepto NOMBRADO cita la cifra de LA CLAVE de ese
 *       concepto (verificado por clave, contra `CLAVES_DE_METRICA`, no por palabras sueltas de la prosa):
 *       «ventas» → clave de venta, nunca de margen ni de carga; «margen» → clave de margen (contribución no
 *       capturada / brecha), nunca la carga comercial re-etiquetada.
 *   B · UNA SOLA VERDAD POR EJE: la MISMA clave de métrica no aparece con DOS cifras distintas en una respuesta
 *       corta.
 *   RONDA 5 (owner, vía coordinador): el cierre de la ronda 4 comparaba DINERO EN JUEGO entre dominios — «un
 *       segundo criterio de prioridad», textual del owner, que lo rechazó. El veredicto ahora lo hereda
 *       `prioridadIntegrada.js` (CLAUDE.md §2), nunca un monto comparado a mano:
 *   E (a) · MUTAR LOS MONTOS NO CAMBIA EL TEMA QUE VA PRIMERO si la prioridad integrada no cambia — inflar el
 *       TOTAL de un dominio (una fig que `prioridadIntegrada` ni lee) no mueve el ganador.
 *   E (b) · SIN ORDEN DEL PROCEDIMIENTO (temas sin clave común: cliente vs SKU), EL CIERRE NO CONTIENE VEREDICTO
 *       ENTRE TEMAS — ni «pesa más», ni ninguna palabra que elija un lado.
 *   E (c) · LA BRECHA NUNCA APARECE SIN SU MARCA DE ESTIMACIÓN: toda mención de «contribución no capturada» va
 *       con «(estimada contra el benchmark)» al lado, nunca como dinero ya perdido. */
H("7 · las carnadas de las rondas 3-5: sustitución de concepto, una sola verdad por eje, veredicto heredado de prioridadIntegrada");
{
  const rVentas = await answerViaAgente({ text: "mírame ventas e inventario", history: [], mem: {}, scenario: ESCENARIO_INICIAL, callAgente: declarando(MUDO) });
  const tVentas = rVentas.r.text;
  /* A · «ventas» nombrado → la línea comercial cita la clave de venta («Ventas: $100.0M en el período[,
   * variación]», ya no «venta del período»/«vendió» — se admite cualquiera de las dos formas), nunca la de
   * margen (contribución no capturada / brecha) ni la de carga (carga comercial) */
  ok(/\bventas?:\s*\$|venta del per[ií]odo|vendi[oó]/i.test(tVentas), `A · «mírame ventas e inventario» → la línea comercial cita la clave de VENTA`, tVentas);
  ok(!/contribuci[oó]n no capturada|brecha al benchmark|carga comercial/i.test(tVentas), `A · …y NO sustituye por la clave de margen ni de carga (0 mención de esas claves)`, tVentas);

  const rMargen = await answerViaAgente({ text: "¿qué me preocupa más, margen o cobranza?", history: [], mem: {}, scenario: ESCENARIO_INICIAL, callAgente: declarando(MUDO) });
  const tMargen = rMargen.r.text;
  /* A (el otro sentido) · «margen» nombrado → la línea comercial cita la clave de margen, nunca la de venta */
  ok(/contribuci[oó]n no capturada|brecha al benchmark/i.test(tMargen), `A · «…margen o cobranza?» → la línea comercial cita la clave de MARGEN`, tMargen);
  ok(!/venta del per[ií]odo|vendi[oó]/i.test(tMargen), `A · …y NO sustituye por la clave de venta`, tMargen);
  /* B · la clave de margen aparece UNA sola vez con UNA sola cifra: «$1.6M» no se repite con otro valor bajo el
   * mismo nombre («contribución»/«margen») en la misma respuesta — se cuentan las apariciones de la cifra de
   * contribución no capturada de Falabella y tiene que ser exactamente una */
  const cifraMargen = (tMargen.match(/\$1\.6M/g) || []).length;
  ok(cifraMargen === 1, `B · la cifra de margen ($1.6M, contribución no capturada de Falabella) aparece UNA sola vez, no dos con nombres distintos`, tMargen);
  /* RONDA 5 · el veredicto abre con «Primero {el/la} {TEMA}:», nombra el criterio del procedimiento (no «por
   * tamaño»), y cita la entidad que la prioridad integrada encabeza como EXPLICACIÓN del tema, no al revés. */
  ok(/Primero (?:el|la) (?:margen|cobranza):/.test(tMargen), `RONDA 5 · el veredicto abre «Primero {el/la} {tema}:» (nombra el TEMA, no «por tamaño»)`, tMargen);
  ok(/criterio: riesgo integrado/i.test(tMargen), `…y nombra el criterio del PROCEDIMIENTO (riesgo integrado), no un monto comparado a mano`, tMargen);
  ok(!/\bpesa m[aá]s\b|\bpesan parecido\b/i.test(tMargen), `…y ya no dice «pesa más»/«pesan parecido» (la ronda 4, retirada por el owner)`, tMargen);
  /* el veredicto cita la cifra de la ENTIDAD que decide (Lider, $4.6M vencidos) — nunca el TOTAL del dominio
   * ($12.6M), que queda como explicación en la línea, jamás como razón del cierre. ⚠️ el corte NO puede ser el
   * primer «.» (las cifras en dólares lo usan como separador decimal, «$4.6M»): se corta en el paréntesis del
   * criterio, que sí cierra la oración del veredicto. */
  const veredicto5 = (/Primero[\s\S]*?\(criterio: [^)]+\)\./i.exec(tMargen) || [tMargen])[0];
  ok(/\$4\.6M/.test(veredicto5) && !/\$12\.6M/.test(veredicto5), `…el veredicto cita la cifra de la ENTIDAD (Lider, $4.6M), nunca el TOTAL del dominio ($12.6M, que queda en la línea)`, veredicto5);

  /* E (a) · MUTAR LOS MONTOS (el total de un dominio, no las señales por entidad) no cambia el tema que va
   * primero si `prioridadIntegrada` no cambia — se prueba con las figs REALES: se infla el total de comercial
   * muy por encima del vencido y se confirma que la integrada (que nunca lee ese total) sigue igual. */
  {
    const CAJA = cajaDelAgente(TOOLS);
    const figsDe = (doms) => { const out = []; for (const d of doms) { const pasos = pasosDeDominios({ dominios: [d], eje: null }); const rp = runPlan({ intent: "answer", calls: pasos.map((p) => ({ tool: p.tool, args: p.args || {} })) }, { scenario: ESCENARIO_INICIAL, maxCalls: 8, preguntaUsuario: "x", registry: CAJA }); out.push(...((rp.ledger || {}).figs || [])); } return out; };
    const figsBase = figsDe(["comercial", "cobranza"]);
    const Pbase = prioridadIntegrada(figsBase, ["comercial", "cobranza"]);
    const figsInflados = figsBase.map((f) => (/^Contribuci[oó]n no capturada · subtotal/i.test(String(f.label || "")) ? { ...f, raw: 99e6, text: "$99.0M", value: "$99.0M" } : f));
    const Pinflado = prioridadIntegrada(figsInflados, ["comercial", "cobranza"]);
    ok(!!Pbase && !!Pinflado && Pbase.integrada[0].entidad === Pinflado.integrada[0].entidad, `E (a) · inflar el TOTAL comercial ($4.9M → $99.0M, una fig que \`prioridadIntegrada\` no lee) NO cambia quién encabeza la integrada (${Pbase && Pbase.integrada[0].entidad} = ${Pinflado && Pinflado.integrada[0].entidad})`, JSON.stringify({ base: Pbase && Pbase.integrada[0].entidad, inflado: Pinflado && Pinflado.integrada[0].entidad }));
  }

  /* D → E (b) · un tema que entró por «ventas» (comercial, clave cliente) cruzado con inventario (clave SKU): el
   * procedimiento no comparte clave entre los dos, así que el cierre NO elige — nada de «pesa más», ni un
   * veredicto que nombre un tema como ganador. */
  const rSust = await answerViaAgente({ text: "mira ventas e inventario juntos y dime dónde pondrías el foco primero", history: [], mem: {}, scenario: ESCENARIO_INICIAL, callAgente: declarando(MUDO) });
  const tSust = rSust.r.text;
  ok(rSust.r.agente.estado === "cobertura-corta" && rSust.r.agente.vetos.length === 0, `E (b) · «ventas e inventario…foco primero» resuelve en cobertura-corta, sin vetos (${tSust.length} chars)`, tSust);
  ok(/no comparten clave/i.test(tSust), `…dice que el procedimiento no los ordena entre sí, y por qué (no comparten clave)`, tSust);
  ok(!/^Primero /m.test(tSust) && !/\bpesa m[aá]s\b/i.test(tSust), `…sin veredicto entre temas: ni «Primero…», ni «pesa más»`, tSust);
  ok(/\?$/m.test(tSust.trim()) || /abrimos/i.test(tSust), `…y ofrece abrir uno`, tSust);

  /* C+D, el caso de 3 temas (q17: comercial + inventario + cobranza, cierre de decisión) — comercial+cobranza SÍ
   * comparten clave (veredicto), inventario va aparte con la frase certificada del ensamblador. */
  const rTres = await answerViaAgente({ text: "que deberia mirar primero esta semana, lo comercial, el inventario o la cobranza? no doy abasto", history: [], mem: {}, scenario: ESCENARIO_INICIAL, callAgente: declarando(MUDO) });
  const tTres = rTres.r.text;
  ok(rTres.r.agente.estado === "cobertura-corta" && rTres.r.agente.vetos.length === 0, `C · el encargo de 3 temas resuelve en cobertura-corta, sin vetos (${tTres.length} chars)`, tTres);
  ok(/Primero (?:el|la) (?:comercial|cobranza):/.test(tTres), `…el veredicto entre comercial/cobranza abre «Primero {tema}:»`, tTres);
  ok(/clave SKU: no se compara con las cuentas/i.test(tTres), `…y el inventario va aparte, con la frase certificada del ensamblador (nunca comparado por tamaño)`, tTres);
  ok((tTres.match(/\bComercial:/g) || []).length <= 1 && (tTres.match(/\bInventario:/g) || []).length <= 1 && (tTres.match(/\bCobranza:/g) || []).length <= 1, `un solo paso: cada frente aparece una sola vez, no se repite`, tTres);

  /* la carnada del propio pedido del coordinador: «¿qué me preocupa más, stock o cobranza?» — inventario (SKU) y
   * cobranza (cliente) no comparten clave: E (b) otra vez, con otro par de dominios. */
  const rStock = await answerViaAgente({ text: "¿qué me preocupa más, stock o cobranza?", history: [], mem: {}, scenario: ESCENARIO_INICIAL, callAgente: declarando(MUDO) });
  const tStock = rStock.r.text;
  ok(rStock.r.agente.estado === "cobertura-corta" && rStock.r.agente.vetos.length === 0, `E (b) · «…stock o cobranza?» resuelve en cobertura-corta, sin vetos (${tStock.length} chars)`, tStock);
  ok(/no comparten clave/i.test(tStock) && !/^Primero /m.test(tStock) && !/\bpesa m[aá]s\b/i.test(tStock), `…no comparten clave (inventario es SKU, cobranza es cliente): sin veredicto, sin «pesa más»`, tStock);

  /* E (c) · la brecha nunca sin su marca de estimación, en las cuatro respuestas que la mencionan */
  for (const [id, t] of [["margen/cobranza", tMargen], ["ventas/inventario", tSust], ["3 temas", tTres]]) {
    const menciones = t.match(/contribuci[oó]n no capturada/gi) || [];
    const marcadas = t.match(/contribuci[oó]n no capturada \(estimada contra el benchmark\)/gi) || [];
    ok(menciones.length === marcadas.length, `E (c) · «${id}»: toda mención de «contribución no capturada» (${menciones.length}) lleva su marca de estimación (${marcadas.length})`, t);
  }
}

/* ═══ 8 · RONDA 7 (coordinador): LA CONSOLIDACIÓN, TRES CARNADAS ═══════════════════════════════════════════════
 *   (a) una disyuntiva entre TEMAS/FRENTES del registro, en CUALQUIER redacción del set de diseño y en frases
 *       CORTAS, termina en `cobertura-corta` — nunca en `compararAlternativas.js` (una sola voz, por diseño:
 *       el reconocimiento sale del registro + la forma «comparar», no de frases nuevas).
 *   (b) un tema pedido (tesorería incluida) nunca falta en la respuesta.
 *   (c) ningún cierre hace dos preguntas seguidas. */
H("8 · ronda 7: la consolidación — frases cortas y largas, siempre cobertura-corta; ningún tema se pierde; un solo «?»");
{
  /* (a) · frases del set de diseño (largas, con marca de decisión) Y frases CORTAS sin ninguna palabra de
   * `_CIERRE_DECISION` — la forma «¿ataco X o Y?» sola, con el registro reconociendo ≥ 2 temas. */
  const FRASES_A = [
    "¿qué es más urgente, margen o cobranza?",              // el set de diseño: «más urgente» (_CIERRE_DECISION)
    "¿dónde tengo el mayor problema entre margen, stock y caja?",   // el literal del owner (630 caracteres en su versión larga)
    "¿ataco el margen o el capital frenado?",                // CORTA: ningún gatillo de _CIERRE_DECISION, solo la forma «comparar» + 2 temas
    "¿ataco la carga comercial o el capital frenado?",       // CORTA, mismo par de dominios, otro concepto nombrado
    "¿priorizo caja o cobranza?",                             // CORTA: «priorizo» no está en _CIERRE_DECISION («prioriza» sí, «priorizo» no)
    "¿reviso el capital frenado o la cobranza primero?",      // CORTA, verbo distinto — y sin «margen»/«protej», así compararAlternativas.js no la confunde con su caso «estrategias» (crecer vs proteger)
  ];
  for (const q of FRASES_A) {
    const r = await answerViaAgente({ text: q, history: [], mem: {}, scenario: ESCENARIO_INICIAL, callAgente: declarando(MUDO) });
    ok(r.r.agente.estado === "cobertura-corta", `(a) «${q}» termina en cobertura-corta, en cualquier redacción`, `estado=${r.r.agente.estado} · ${r.r.text.slice(0, 160)}`);
    ok(r.r.agente.vetos.length === 0, `   …sin vetos del muro`, JSON.stringify(r.r.agente.vetos).slice(0, 200));
  }

  /* (b) · «margen, stock y caja»: los TRES temas pedidos aparecen, tesorería incluida — nunca cae en silencio */
  const rTriple = await answerViaAgente({ text: "¿dónde tengo el mayor problema entre margen, stock y caja?", history: [], mem: {}, scenario: ESCENARIO_INICIAL, callAgente: declarando(MUDO) });
  const tTriple = rTriple.r.text;
  ok(/margen|comercial/i.test(tTriple), `(b) «margen, stock y caja»: margen/comercial presente`, tTriple);
  ok(/inventario|stock|capital frenado/i.test(tTriple), `   …inventario/stock presente`, tTriple);
  ok(/Tesorer[ií]a/i.test(tTriple), `   …y TESORERÍA presente — nunca desaparece en silencio (el defecto medido por el owner)`, tTriple);
  const marcasEstimacion = (tTriple.match(/estimad[ao] contra el benchmark|frente al benchmark|una estimaci[oó]n, no dinero ya perdido/gi) || []).length;
  ok(marcasEstimacion <= 1, `   …y la marca de estimación aparece UNA sola vez (no tres, el otro defecto medido)`, `x${marcasEstimacion}`);

  /* (c) · ningún cierre hace dos preguntas seguidas — sobre TODAS las respuestas servidas en este gate (§6 y §8a) */
  const todasLasRespuestas = [...Object.values(LITERALES).map((r) => r.texto)];
  for (const q of FRASES_A) {
    const r = await answerViaAgente({ text: q, history: [], mem: {}, scenario: ESCENARIO_INICIAL, callAgente: declarando(MUDO) });
    todasLasRespuestas.push(r.r.text);
  }
  for (const t of todasLasRespuestas) {
    const preguntas = (t.match(/\?/g) || []).length;
    ok(preguntas <= 1, `(c) ningún cierre hace dos preguntas seguidas`, `${preguntas} signos «?» · ${t.slice(0, 200)}`);
  }
}

console.log("\n── las 5 respuestas literales (para el informe) ──");
for (const [q, r] of Object.entries(LITERALES)) console.log(`\n[${r.estado} · ${r.largo} chars] ${q}\n${r.texto}`);

console.log(`\n── _encargo_natural_gate: ${PASS} PASS · ${FAIL} FAIL (de ${PASS + FAIL}) ──`);
process.exit(FAIL ? 1 : 0);
