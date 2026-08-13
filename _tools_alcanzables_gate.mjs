/* === _tools_alcanzables_gate.mjs · NINGUNA CAPACIDAD REGISTRADA QUEDA INVISIBLE PARA PLAN ======================
 *
 * POR QUÉ EXISTE: `clientesPorSku` vivió meses en el registro con el dato disponible y la función andando, pero
 * NO estaba en el enum que PLAN puede emitir. El planificador no podía nombrarla, elegía otra cosa, y ADI
 * respondía "no tengo esa información" TENIENDO el dato. Costó una certificación pagada descubrirlo. Este gate
 * hace que ese defecto sea imposible de repetir en silencio: si una capacidad entra al registro y nadie la
 * expone, la suite se pone roja.
 *
 * QUÉ ENTIENDE POR "ALCANZABLE" — las tres condiciones, y las tres hacen falta:
 *   1. REGISTRADA  · está en TOOLS (existe la función que la ejecuta).
 *   2. NOMBRABLE   · está en el enum de `calls[].tool` del schema de PLAN. Sin esto el modelo no la puede emitir.
 *   3. DESCRITA    · aparece en TOOL_CATALOG. Sin esto el modelo puede nombrarla pero no sabe cuándo elegirla,
 *                    que es la versión silenciosa del mismo defecto: alcanzable en el papel, inútil en la práctica.
 *
 * Y la simétrica, igual de grave al revés: una tool NOMBRABLE que no está REGISTRADA es una call que el modelo
 * puede emitir y el motor no puede ejecutar.
 *
 * DEUDA ACEPTADA: se admite dejar una tool fuera, pero SOLO nombrándola abajo con su motivo escrito. Una lista
 * vacía es el estado sano. Agregar una entrada es una decisión que queda firmada en el código, no un olvido.
 */
import { toolNames } from "./src/adi/oracle/toolRegistry.js";
import { TOOL_CATALOG, PLAN_TOOL } from "./src/adi/oracle/planPrompt.js";

let pass = 0, fail = 0;
function ok(name, cond, detail) {
  if (cond) { pass++; console.log(`  OK  ${name}`); }
  else { fail++; console.log(`FAIL  ${name}${detail ? " — " + detail : ""}`); }
}
function section(t) { console.log(`\n== ${t} ==`); }

/* ══════════════════════════════════════════════════════════════════════════════════════════════════════════════
 * LA LISTA DE DEUDA ACEPTADA. Cada entrada: nombre → motivo. El motivo es obligatorio y tiene que decir POR QUÉ
 * no se expone, no que "todavía no se hizo" (eso es un pendiente, y un pendiente va cerrado, no listado acá).
 * ══════════════════════════════════════════════════════════════════════════════════════════════════════════════ */
const DEUDA_ACEPTADA = {
  simulate: "SACADA DEL ENUM a propósito (owner 2026-08-12). Es el simulador GENÉRICO legacy — su propio contrato " +
    "lo declara: «quedó de una etapa previa», superado por simulateGeneral. Se verificó que NINGUNA ruta viva la " +
    "emite: los únicos emisores son dos gates que arman el plan a mano, y el motor despacha por el REGISTRO, no " +
    "por el enum, así que siguen verdes. `guardC._SIM_TOOLS` la nombra para graduar supuestos y lee el nombre de " +
    "la call ejecutada, no del enum. Se queda REGISTRADA (ejecutable) y deja de ser NOMBRABLE: estaba en el enum " +
    "SIN entrada en el catálogo, que es la peor combinación — el modelo podía emitirla sin saber cuándo, y una " +
    "call que nadie sabe cuándo elegir es una ruleta, no una capacidad. Sacarla no le quita nada al usuario: sin " +
    "descripción ya era inelegible en la práctica.",
};

// La segunda forma de deuda: NOMBRABLE pero sin entrada propia en el catálogo. Misma exigencia — motivo escrito.
// Vacía: una tool que el modelo puede emitir y no sabe cuándo usar no se acepta, se describe o se saca del enum.
const SIN_DESCRIPCION_ACEPTADA = {};

/* ── Lectura de las tres fuentes ─────────────────────────────────────────────────────────────────────────────── */
const REGISTRADAS = toolNames();

// El enum sale del schema REAL, no de una copia: si alguien lo mueve de lugar, este gate lo sigue.
const callsProps = PLAN_TOOL?.schema?.properties?.calls?.items?.properties;
const NOMBRABLES = (callsProps?.tool?.enum) || [];

// "Descrita" = el catálogo declara su FIRMA (`nombre{...}`). No alcanza con que el nombre aparezca suelto en
// medio de otra descripción —varias entradas se nombran entre sí para desambiguar—: una mención en prosa no
// lleva llave. Y no se exige que abra línea: simulateCarga/simulateCapital comparten una a propósito, y compartir
// renglón no las vuelve menos descritas.
const describeA = (t) => new RegExp(`${t}\\{`).test(TOOL_CATALOG);

/* ══════════════════════════════════════════════════════════════════════════════════════════════════════════════ */
section("1 · EL SCHEMA SE PUDO LEER (si esto falla, el resto del gate no prueba nada)");
ok("el enum de calls[].tool existe y no está vacío", Array.isArray(NOMBRABLES) && NOMBRABLES.length > 0,
  `enum=${JSON.stringify(NOMBRABLES).slice(0, 80)}`);
ok("el registro devuelve tools", REGISTRADAS.length > 0, `${REGISTRADAS.length}`);
ok("TOOL_CATALOG no está vacío", typeof TOOL_CATALOG === "string" && TOOL_CATALOG.length > 500);

/* ══════════════════════════════════════════════════════════════════════════════════════════════════════════════ */
section("2 · TODA TOOL REGISTRADA ES NOMBRABLE POR PLAN (el defecto de clientesPorSku)");
const inalcanzables = REGISTRADAS.filter((t) => !NOMBRABLES.includes(t) && !(t in DEUDA_ACEPTADA));
ok("ninguna tool registrada queda fuera del enum de PLAN", inalcanzables.length === 0,
  inalcanzables.length ? `INALCANZABLES: ${inalcanzables.join(", ")} — o se exponen, o se declaran en DEUDA_ACEPTADA con su motivo` : "");

for (const [t, motivo] of Object.entries(DEUDA_ACEPTADA)) {
  ok(`deuda aceptada '${t}': trae un motivo escrito`, typeof motivo === "string" && motivo.trim().length >= 20,
    "una entrada sin motivo real es un olvido disfrazado de decisión");
  ok(`deuda aceptada '${t}': sigue registrada (si ya no existe, sacala de la lista)`, REGISTRADAS.includes(t));
  ok(`deuda aceptada '${t}': efectivamente NO está en el enum`, !NOMBRABLES.includes(t),
    "está expuesta: la deuda ya se cerró y la lista quedó vieja");
}

/* ══════════════════════════════════════════════════════════════════════════════════════════════════════════════ */
section("3 · TODA TOOL NOMBRABLE ESTÁ DESCRITA EN EL CATÁLOGO");
// Nombrable sin descripción = el modelo puede emitirla pero no sabe cuándo. Alcanzable en el papel, inútil en uso.
const sinDescripcion = NOMBRABLES.filter((t) => !describeA(t) && !(t in SIN_DESCRIPCION_ACEPTADA));
ok("ninguna tool del enum queda sin entrada propia en el catálogo", sinDescripcion.length === 0,
  sinDescripcion.length ? `SIN DESCRIPCIÓN: ${sinDescripcion.join(", ")} — o se describen, o se declaran en SIN_DESCRIPCION_ACEPTADA con su motivo` : "");

for (const [t, motivo] of Object.entries(SIN_DESCRIPCION_ACEPTADA)) {
  ok(`sin descripción aceptada '${t}': trae un motivo escrito`, typeof motivo === "string" && motivo.trim().length >= 20);
  ok(`sin descripción aceptada '${t}': sigue en el enum (si ya no está, sacala de la lista)`, NOMBRABLES.includes(t));
  ok(`sin descripción aceptada '${t}': efectivamente NO está descrita`, !describeA(t),
    "ya tiene entrada: la deuda se cerró y la lista quedó vieja");
}

/* ══════════════════════════════════════════════════════════════════════════════════════════════════════════════ */
section("4 · LA SIMÉTRICA · TODA TOOL NOMBRABLE EXISTE EN EL REGISTRO");
// Una call que el modelo puede emitir y el motor no puede ejecutar: el mismo defecto, del otro lado.
const fantasmas = NOMBRABLES.filter((t) => !REGISTRADAS.includes(t));
ok("ninguna tool del enum falta en el registro", fantasmas.length === 0,
  fantasmas.length ? `FANTASMAS (nombrables pero no ejecutables): ${fantasmas.join(", ")}` : "");

/* ══════════════════════════════════════════════════════════════════════════════════════════════════════════════ */
section("5 · LAS DOS QUE SE EXPUSIERON EN ESTE PASE, UNA POR UNA");
for (const t of ["entityComposicion", "entityCapitalLigado", "clientesPorSku"]) {
  ok(`${t} · registrada`, REGISTRADAS.includes(t));
  ok(`${t} · nombrable por PLAN`, NOMBRABLES.includes(t));
  ok(`${t} · descrita en el catálogo`, describeA(t));
}

/* ══════════════════════════════════════════════════════════════════════════════════════════════════════════════ */
section("6 · EL CATÁLOGO NO CRECIÓ MÁS DE LO DECLARADO");
// Presupuesto de prompt: el catálogo entero es lado FIJO del caché, así que crece para todos los turnos. El tope
// no es una cifra mágica — es el valor medido tras exponer las dos, con margen para una entrada más. Si alguien
// suma una descripción larga, este gate lo obliga a decidirlo a propósito y a mover el número acá.
/* EL TOPE SUBE A 18.550 (encargo «umbral del usuario», 2026-08-13) — ANÁLISIS GARANTÍA-VS-FORMATO, como el gate
 * mismo lo pide («subí TOPE_CAR y dejá escrito por qué»): la línea de `calcular` gana `suma_filtrada` — la
 * capacidad que el hallazgo VIVO del owner mostró ausente («¿capital parado >90 días?» respondió el total del
 * criterio interno como si fuera el umbral pedido) — y la señal de enrutamiento que evita repetir el defecto
 * (el corte numérico explícito NO es de inventoryStatus). EL COSTO ES EXACTO: 496 caracteres (~124 tokens por
 * llamada de PLAN), medido: 18.492. Todo cae del lado FIJO del caché — con caché al 90% son ~12 tokens efectivos.
 * Mismo criterio de siempre: el presupuesto existe para que el costo se DECIDA, no para que una capacidad quede
 * muda — y el tope se deja pegado a lo medido (58 car de holgura), no aflojado. */
const TOPE_CAR = 18550;
ok(`TOOL_CATALOG dentro del presupuesto (${TOOL_CATALOG.length} ≤ ${TOPE_CAR} car)`, TOOL_CATALOG.length <= TOPE_CAR,
  `${TOOL_CATALOG.length} car — si el crecimiento es deliberado, subí TOPE_CAR y dejá escrito por qué`);

console.log(`\nREGISTRADAS ${REGISTRADAS.length} · NOMBRABLES ${NOMBRABLES.length} · DEUDA ACEPTADA ${Object.keys(DEUDA_ACEPTADA).length}`);
console.log(`${pass} OK · ${fail} FAIL`);
process.exit(fail ? 1 : 0);
