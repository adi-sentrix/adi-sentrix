/* === _probe_paso2_definir.mjs · Paso 2 "ADI pierde el hilo" · A2.1 + A2.2 + A2.3 (2026-08-13) ============
 * PROBE 100% OFFLINE: importa el ejecutor determinístico (toolRunner) y los módulos del glosario/narración —
 * NO importa el gateway ni ningún adapter — ninguna ruta de código acá puede producir una llamada pagada.
 * Correr con el candado de red puesto:  node --import ./scripts/offline-guard.mjs _probe_paso2_definir.mjs
 *
 * Qué demuestra:
 *   A2.1 · el caso real del owner (PLAN emitió `bajo_benchmark`, un token interno): la escalera de resolución
 *          de defineConcept lo resuelve — peldaño (b) "_"→" " SOLO, y también el caso completo con la
 *          pregunta del turno inyectada; y el peldaño (c) por separado, con un concept irrecuperable.
 *   A2.2 · un concepto REALMENTE desconocido sigue declinando honesto, su reason cita palabras de usuario
 *          (jamás /\w_\w/), y composeNoDataMessage sobre ese resultado no imprime identificadores internos.
 *   A2.3 · las OTRAS tools no cambiaron: queryMetric y marginRead devuelven byte-idéntico con y sin la
 *          pregunta inyectada en runPlan (la inyección es SOLO para defineConcept).
 */
const TR = await import(new URL("./src/adi/oracle/toolRunner.js", import.meta.url).href);
const GL = await import(new URL("./src/adi/sentrix/glossary.js", import.meta.url).href);
const NB = await import(new URL("./src/adi/oracle/narrationBlocks.js", import.meta.url).href);

const { runPlan } = TR;
const { resolveGlossary, CONCEPT_DEFS } = GL;
const { composeNoDataMessage } = NB;

let PASS = 0, FAIL = 0;
const ok = (cond, msg, extra) => {
  if (cond) { PASS++; console.log(`  ✓ ${msg}`); }
  else { FAIL++; console.log(`  ✗ ${msg}${extra ? " — " + extra : ""}`); }
};

const PREGUNTA_OWNER = "las cuentas que estan bajo benchmark, que eso?";
const TOKEN_SUCIO = "bajo_benchmark";
const _define = (concept, preguntaUsuario) =>
  runPlan({ intent: "define", calls: [{ tool: "defineConcept", args: { concept } }] },
    { scenario: "actual", ...(preguntaUsuario ? { preguntaUsuario } : {}) }).results[0];

/* ── A2.1 · el caso real del owner: el token sucio resuelve por la escalera ───────────────────────────── */
console.log("── A2.1 · el caso del owner: «bajo_benchmark» ya no pierde la definición ──");

// el punto de partida sigue igual (glossary.js intacto): el token crudo NO resuelve en el glosario
ok(resolveGlossary(TOKEN_SUCIO) === null, "resolveGlossary('bajo_benchmark') sigue siendo null (glossary.js SIN cambios — la tolerancia vive en la tool)");
ok(!!resolveGlossary("bajo benchmark"), "resolveGlossary('bajo benchmark') resuelve (como siempre)");

// PELDAÑO (b) SOLO: el token sucio, SIN pregunta inyectada — "_"→" " alcanza por sí solo
{
  const r = _define(TOKEN_SUCIO);
  ok(r.coverage && r.coverage.supported === true, "peldaño (b) SOLO · defineConcept('bajo_benchmark') SIN pregunta → supported:true");
  ok(r.facts && r.facts.definicion === CONCEPT_DEFS.benchmark.def, "peldaño (b) · y la definición es LA de benchmark, byte-igual al catálogo");
  ok(r.facts && r.facts.concepto === CONCEPT_DEFS.benchmark.aka, `peldaño (b) · concepto = «${r.facts && r.facts.concepto}»`);
}

// EL CASO COMPLETO de punta a punta: token sucio + pregunta del turno inyectada (como llega desde answerViaOracle)
{
  const r = _define(TOKEN_SUCIO, PREGUNTA_OWNER);
  ok(r.coverage && r.coverage.supported === true, "caso completo · token sucio + pregunta inyectada → supported:true");
  ok(r.facts && r.facts.definicion === CONCEPT_DEFS.benchmark.def, "caso completo · la definición de benchmark viaja en facts");
}

// PELDAÑO (c) SOLO: un concept irrecuperable aun en palabras — la FRASE del usuario es la que resuelve
{
  const r = _define("ese_termino_interno", PREGUNTA_OWNER);
  ok(r.coverage && r.coverage.supported === true, "peldaño (c) SOLO · concept irrecuperable + pregunta del owner → resuelve POR LA FRASE");
  ok(r.facts && r.facts.definicion === CONCEPT_DEFS.benchmark.def, "peldaño (c) · y también llega a benchmark");
  const sin = _define("ese_termino_interno");
  ok(sin.coverage && sin.coverage.supported === false, "peldaño (c) · control: el mismo concept SIN pregunta declina (la frase era la señal)");
}

// el orden importa: si el concept del plan YA resuelve, la pregunta no lo pisa (la señal específica gana)
{
  const r = _define("margen bruto", "qué es la carga comercial?");
  ok(r.facts && r.facts.definicion === CONCEPT_DEFS.margen_bruto.def, "orden de la escalera · concept válido GANA a la pregunta (margen bruto, no carga)");
}

/* ── A2.2 · un desconocido real sigue declinando honesto, sin identificadores internos ────────────────── */
console.log("\n── A2.2 · lo desconocido declina honesto y la excusa habla en palabras de usuario ──");
{
  const r = _define("flujo_de_caja_proyectado", "qué es el flujo de caja proyectado?");
  ok(r.coverage && r.coverage.supported === false, "concepto sin entrada curada → supported:false (no hay fuzzy, no hay invento)");
  const reason = (r.coverage && r.coverage.reason) || "";
  console.log(`  reason: ${JSON.stringify(reason)}`);
  ok(!/\w_\w/.test(reason), "el reason NO contiene identificadores con guion bajo (/\\w_\\w/)");
  ok(/flujo de caja proyectado/.test(reason), "el reason cita el término EN PALABRAS («flujo de caja proyectado»)");
  ok(/no tengo una definición curada/.test(reason), "y conserva el prefijo honesto de siempre");
  const msg = composeNoDataMessage([r]);
  console.log(`  a pantalla: ${JSON.stringify(msg)}`);
  ok(!/\w_\w/.test(msg), "composeNoDataMessage: el mensaje que ve el usuario tampoco trae /\\w_\\w/");
  ok(!/defineConcept|queryMetric|marginRead|coverage|supported/i.test(msg), "ni nombres de tools ni vocabulario del contrato interno");
}
// y el REGRESO del caso del owner tal como se vio en prod: el reason de ANTES habría sido el token
{
  const r = _define(TOKEN_SUCIO, PREGUNTA_OWNER);
  ok(!(r.coverage && r.coverage.reason), "el caso del owner ya NI llega a tener excusa: ahora responde");
}
// caso degenerado: sin concept y sin pregunta → genérico sin identificadores
{
  const r = _define("");
  ok(r.coverage && r.coverage.supported === false && !/\w_\w/.test(r.coverage.reason || ""), "sin concept ni pregunta → declina con genérico limpio", JSON.stringify(r.coverage && r.coverage.reason));
}

/* ── A2.3 · las OTRAS tools no cambiaron: byte-idéntico con y sin la pregunta inyectada ───────────────── */
console.log("\n── A2.3 · queryMetric y marginRead: byte-idéntico, la inyección es SOLO de defineConcept ──");
{
  const CALLS = [
    { tool: "queryMetric", args: { metric: "ventas", dimension: "cliente" } },
    { tool: "marginRead", args: { dimension: "cliente", focus: "bajo_benchmark" } },
  ];
  const sin = runPlan({ intent: "answer", calls: CALLS }, { scenario: "actual" });
  const con = runPlan({ intent: "answer", calls: CALLS }, { scenario: "actual", preguntaUsuario: PREGUNTA_OWNER });
  ok(JSON.stringify(sin.results) === JSON.stringify(con.results), "results de queryMetric+marginRead BYTE-IDÉNTICOS con y sin preguntaUsuario");
  ok(JSON.stringify(sin.ledger) === JSON.stringify(con.ledger), "y el ledger completo también byte-idéntico");
  ok(sin.results[0].coverage && sin.results[0].coverage.supported === true, "control: queryMetric respondió con datos reales (no es un empate de vacíos)");
  ok(sin.results[1].coverage && sin.results[1].coverage.supported === true, "control: marginRead también");
  const argsLedger = (con.ledger.calls || []).map((c) => c.args || {});
  ok(argsLedger.every((a) => !("_preguntaUsuario" in a)), "en el ledger, NINGUNA de esas dos calls recibió _preguntaUsuario");
}

console.log(`\nPASO 2 · PROBE · ${PASS} PASS · ${FAIL} FAIL`);
process.exit(FAIL ? 1 : 0);
