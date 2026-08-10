/* === _forma_respuesta_gate.mjs · CONTRATO DE RESPUESTA PROPORCIONAL (owner 2026-08-09) ==========================
 * "Por defecto las tres reglas (1 qué pasa / 2 por qué, distinguiendo PROBADO-INDICADO-ABIERTO / 3 qué hacer primero
 *  con una sugerencia concreta). Una pregunta puntual NO se convierte en informe: primero responde directo, después
 *  solo la interpretación necesaria. Si pide 'solo el dato' o equivalente semántico: dato, período y alcance, nada
 *  más. Para 'explicame este gráfico': qué mide, cuál es su universo, qué patrón importa, qué sabemos de su causa y
 *  qué conviene revisar primero."
 *
 * QUÉ VERIFICA, y por qué cada cosa:
 *   1. LA PRECEDENCIA es una sola y está en un solo lugar (resolveAnswerShape). `pref` gana siempre; clarify
 *      reemplaza el arco entero; recién después opinan el contexto de pantalla y la forma de la pregunta. Sin esto,
 *      "solo el dato" y "explicame este gráfico" podrían pelearse en un turno que dice las dos cosas.
 *   2. CERO DUPLICACIÓN con responsePreference.js: action_only y solo_dato NO reciben una segunda instrucción acá —
 *      su enforcement ya existe entero (blockInstructionFor + la ruta determinística de answerViaOracle.js).
 *   3. PAYLOAD MÍNIMO: un turno normal, sin Sentrix y sin nada que graduar, NO agrega ni una llave al payload de
 *      NARRAR. Es la puerta de deploy que el owner fijó: cada fase conserva el comportamiento actual.
 *   4. EL SELLO: la forma y el contexto de pantalla quedan DENTRO del árbol congelado (isSealed), no al lado.
 *   5. LOS ACENTOS: `\b` es ASCII en JavaScript. "por qué" y "acá" son exactamente lo que un usuario escribe, y con
 *      `\b` de cierre NO matchean — el gate lo fija para que ningún refactor lo reintroduzca.
 *
 * OFFLINE por construcción: solo importa módulos puros del oráculo, ninguno de los cuales sale a la red. Corre con
 * `npm run gates:offline` — cero créditos.
 * ⚠️ NO ESCRIBAS ACÁ NINGUNO DE LOS MARCADORES DE RED (la lista `LIVE` de scripts/gates-offline.mjs), NI SIQUIERA
 * EN UN COMENTARIO. Ese script clasifica los gates leyendo el ARCHIVO ENTERO —comentarios incluidos— contra esos
 * patrones. La versión original de este encabezado se declaraba "offline" ENUMERÁNDOLOS, y esa misma frase mandó
 * el gate al bucket LIVE: quedó fuera de la suite determinística y solo se habría intentado bajo `npm run gates`,
 * que gasta créditos reales. Describí lo que el gate NO hace sin nombrar lo que el clasificador busca.
 */
import {
  resolveAnswerShape, esPreguntaPuntual, buildAnswerShapeInstruction, buildGraduacionInstruction,
  buildComponentExplainInstruction, buildAlcanceLine, DEICTIC_COMPONENT_RE, ANSWER_SHAPES,
} from "./src/adi/oracle/progressiveDisclosure.js";
import { buildNarrationContract, isSealed } from "./src/adi/oracle/narrationContract.js";
import { buildNarrateUserMessageC } from "./src/adi/oracle/narratePromptC.js";

let fails = 0;
const ok = (c, m) => { console.log(`${c ? "  ✓" : "  ✗"} ${m}`); if (!c) fails++; };

// ViewContext de prueba: un componente REAL del inventario (comercial/01/tabla-cartera), con la forma que declara
// viewContext.js. No se inventa ningún componente que no exista.
const VC = Object.freeze({
  version: "adi-view-context@1.0.0", tenantId: "demo", vista: "comercial", seccion: "01",
  componentId: "comercial/01/tabla-cartera", titulo: "El negocio, cliente por cliente", tipo: "tabla",
  metrica: "ventas", eje: "cliente", periodo: "año cerrado", escenario: "actual",
  universo: { kind: "negocio", n: 13, label: "la cartera completa", cierraCon: "clientesVentas.actual" },
  seleccion: { modo: "todas", n: 0, entidades: [], filtro: null }, filtros: {}, comparacion: "presupuesto",
  controles: {}, evidenceIds: [], estatus: "probado", key: "k1",
});

console.log("── 1 · PRECEDENCIA · una sola, en un solo lugar ──");
ok(ANSWER_SHAPES.length === 4 && ANSWER_SHAPES.includes("tres_reglas"), "cuatro formas declaradas, con el default del owner entre ellas");
ok(resolveAnswerShape({ text: "resumen ejecutivo, solo cifras", pref: { contentScope: "data_only" } }) === "solo_dato", "data_only → solo_dato");
ok(resolveAnswerShape({ text: "solo los resultados", pref: { contentScope: "results_only" } }) === "solo_dato", "results_only → solo_dato");
ok(resolveAnswerShape({ text: "explicame este gráfico, pero solo el dato", viewContext: VC, pref: { contentScope: "data_only" } }) === "solo_dato", "pref GANA sobre el contexto de pantalla, aunque el turno diga las dos cosas");
ok(resolveAnswerShape({ text: "dame solo la acción", pref: { contentScope: "action_only" } }) === null, "action_only → null: lo gobierna responsePreference.js, acá no se duplica");
ok(resolveAnswerShape({ text: "explicame este gráfico", plan: { mode: "clarify" }, viewContext: VC }) === null, "clarify → null: su contrato reemplaza el arco entero");

console.log("\n── 2 · LAS CUATRO FORMAS ──");
ok(resolveAnswerShape({ text: "explicame esta tabla", viewContext: VC }) === "explicar_componente", "«explicame esta tabla» con contexto de pantalla");
ok(resolveAnswerShape({ text: "¿qué significa ese punto?", viewContext: VC }) === "explicar_componente", "«qué significa ese punto»");
ok(resolveAnswerShape({ text: "explicame este gráfico" }) === "tres_reglas", "sin contexto de pantalla NO hay explicar_componente (no se inventa el universo)");
ok(resolveAnswerShape({ text: "¿cuánto vendió Falabella?", plan: { mode: "default", calls: [{ tool: "queryMetric" }] } }) === "puntual", "pregunta puntual");
ok(resolveAnswerShape({ text: "dame el margen de Falabella", plan: { mode: "default", calls: [{ tool: "marginRead" }] } }) === "puntual", "pedido directo de un dato también es puntual");
ok(resolveAnswerShape({ text: "¿por qué cayó el margen de Falabella?", plan: { mode: "default", calls: [{ tool: "marginRead" }] } }) === "tres_reglas", "«por qué» NUNCA es puntual: es el turno que MÁS necesita el arco completo");
ok(resolveAnswerShape({ text: "¿qué hago con esos SKU?", plan: { mode: "decision", calls: [] }, viewContext: VC }) === "tres_reglas", "pedido de acción → arco completo");
ok(resolveAnswerShape({ text: "dame el mes a mes de Falabella", plan: { mode: "default", calls: [{ tool: "trend" }] } }) === "tres_reglas", "pedir la serie es pedir DETALLE, no una pregunta puntual");
ok(resolveAnswerShape({ text: "cómo viene el negocio", plan: { mode: "diagnostico", calls: [] } }) === "tres_reglas", "panorama → tres_reglas");
ok(!esPreguntaPuntual({ text: "¿cómo va Falabella?", plan: { mode: "default", calls: [{ tool: "entityProfile" }] } }), "un perfil general nunca es puntual (esa es la divulgación progresiva)");
ok(!esPreguntaPuntual({ text: "el margen viene raro", plan: { mode: "default", calls: [] } }), "un enunciado suelto no es una pregunta");

console.log("\n── 3 · DEIXIS DE COMPONENTE · una sola definición, y los acentos ──");
for (const t of ["explicame este gráfico", "qué significa ese punto", "los de arriba", "acá qué pasa", "esta tabla", "esos números", "en pantalla", "esa barra"]) {
  ok(DEICTIC_COMPONENT_RE.test(t), `reconoce «${t}»`);
}
for (const t of ["cuánto vendió Falabella", "estos clientes ceden margen", "acabo de ver el margen"]) {
  ok(!DEICTIC_COMPONENT_RE.test(t), `NO confunde con deixis de componente: «${t}»`);
}

console.log("\n── 4 · LA GRADUACIÓN PROBADO/INDICADO/ABIERTO, atada a ESTE turno ──");
ok(buildAnswerShapeInstruction("tres_reglas", { claims: [{ metrica: "Ventas", estatus: "probado" }] }) === "", "todo probado y sin preguntas abiertas → sin instrucción (payload mínimo)");
const grad = buildGraduacionInstruction([{ metrica: "Ventas", estatus: "probado" }, { metrica: "Brecha de margen", estatus: "indicado" }], []);
ok(/PROBADO/.test(grad) && /INDICADO/.test(grad), "nombra los dos estatus");
ok(/Ventas/.test(grad) && /Brecha de margen/.test(grad), "y nombra las MÉTRICAS REALES del turno, no doctrina genérica");
const gradAbierta = buildGraduacionInstruction([], [{ tool: "trend", motivo: "no hay serie a futuro" }]);
ok(/ABIERTO/.test(gradAbierta) && /no hay serie a futuro/.test(gradAbierta), "una pregunta abierta cita el motivo REAL que declaró la tool");

console.log("\n── 5 · EXPLICAR UN COMPONENTE · los cinco movimientos, sin una sola cifra ──");
const expl = buildComponentExplainInstruction(VC, []);
for (const m of ["QUÉ MIDE", "CUÁL ES SU UNIVERSO", "QUÉ PATRÓN IMPORTA", "QUÉ SABEMOS DE SU CAUSA", "QUÉ CONVIENE REVISAR PRIMERO"]) {
  ok(expl.includes(m), `movimiento presente: ${m}`);
}
ok(/la cartera completa/.test(expl) && /clientesVentas\.actual/.test(expl), "el universo y su cierre salen del ViewContext, no de una lista fija");
ok(/probado/.test(expl), "el sello del componente entra en el «por qué»");
ok(!/\$/.test(expl) && !/\d+\s*%/.test(expl), "la instrucción NO trae ninguna cifra: el contexto dice QUÉ se mira, nunca cuánto vale");
ok(buildComponentExplainInstruction(null, []).length > 0, "sin ViewContext degrada honesto (instrucción genérica), nunca rompe el turno");

console.log("\n── 6 · «SOLO EL DATO» = dato + período + ALCANCE ──");
ok(buildAnswerShapeInstruction("solo_dato", {}) === "", "no se compone una segunda instrucción: responsePreference.js ya la tiene");
ok(buildAlcanceLine({ entidades: ["Falabella"], eje: "cliente", filtros: {} }) === "Alcance: Falabella · eje cliente.", "alcance de una entidad");
ok(buildAlcanceLine({ entidades: [], eje: "cliente", filtros: { canal: "Retail" } }) === "Alcance: todo el eje cliente · canal: Retail.", "alcance global con filtro");
ok(!/\d/.test(buildAlcanceLine({ entidades: ["A", "B", "C", "D"], eje: "sku", filtros: {} })), "el alcance NUNCA introduce un número (nada que el guard deba autorizar)");
ok(buildAlcanceLine(null) === "" && buildAlcanceLine({}) !== null, "tolera alcance ausente sin romper");

console.log("\n── 7 · SELLADO Y TRANSPORTE ──");
const figs = [
  { label: "Falabella · Ventas", value: "$12.3M", unit: "money", raw: 12300000, canon: "money:12300000", source: "actual" },
  { label: "Falabella · Brecha de margen", value: "8.1 pp", unit: "pp", raw: 8.1, canon: "pp:8.1", formula: "benchmark − margen" },
];
const plan = { intent: "answer", mode: "default", calls: [{ tool: "marginRead", args: {} }], scope: { level: "entity", entities: ["Falabella"] } };
const results = [{ tool: "marginRead", coverage: { supported: true }, facts: { entityType: "cliente", periodo: "año cerrado" } }];
const contrato = buildNarrationContract({ text: "explicame esta tabla", plan, results, ledgerFigs: figs, viewContext: VC, formaRespuesta: "explicar_componente" });
ok(isSealed(contrato), "el contrato completo —con la vista y la forma adentro— queda congelado en profundidad");
ok(contrato.politicaExtension.formaRespuesta === "explicar_componente", "la forma se declara como DATO en politicaExtension (verificable por el guard)");
ok(typeof contrato.forma.instruccionForma === "string" && contrato.forma.instruccionForma.length > 0, "la instrucción se compone sobre los claims YA sellados");
ok(/Brecha de margen/.test(contrato.forma.instruccionForma), "y arrastra la graduación real del turno");
ok(buildNarrationContract({ text: "x", plan, results, ledgerFigs: figs, formaRespuesta: "cualquier_cosa" }).politicaExtension.formaRespuesta === null, "una forma no declarada se descarta, nunca se propaga");

const payloadVista = buildNarrateUserMessageC({ text: "explicame esta tabla", plan, results, ledgerFigs: figs, viewContext: VC, formaRespuesta: "explicar_componente" });
ok(typeof payloadVista.instruccion_forma_respuesta === "string", "el payload emite instruccion_forma_respuesta");
ok(typeof payloadVista.contexto_vista === "string" && payloadVista.contexto_vista.length <= 240, "contexto_vista es UNA línea de ≤240 caracteres");
ok(!/\$/.test(payloadVista.contexto_vista), "y no lleva ninguna cifra de dinero");

console.log("\n── 8 · EL TURNO NORMAL NO PAGA NADA (puerta de deploy) ──");
const payloadNormal = buildNarrateUserMessageC({ text: "cuánto vendió Falabella", plan, results, ledgerFigs: [figs[0]], formaRespuesta: "tres_reglas" });
ok(!("contexto_vista" in payloadNormal), "sin Sentrix: la llave contexto_vista NI APARECE");
ok(!("instruccion_forma_respuesta" in payloadNormal), "sin nada que graduar: la llave instruccion_forma_respuesta NI APARECE");
const payloadPuntual = buildNarrateUserMessageC({ text: "cuánto vendió Falabella", plan, results, ledgerFigs: [figs[0]], formaRespuesta: "puntual" });
ok(/PREGUNTA PUNTUAL/.test(payloadPuntual.instruccion_forma_respuesta || ""), "una pregunta puntual SÍ recibe su instrucción de «directo primero»");

console.log(fails ? `\n✗ _forma_respuesta_gate: ${fails} fallas` : "\n✓ _forma_respuesta_gate: todo verde");
process.exit(fails ? 1 : 0);
