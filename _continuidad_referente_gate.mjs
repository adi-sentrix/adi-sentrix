/* === _continuidad_referente_gate.mjs · EL REFERENTE ES DEL PROCEDIMIENTO ═══════════════════════════════════
 *
 * LA PRUEBA DE CONTINUIDAD DEL OWNER (2026-09-11), auditada offline y cerrada acá:
 *   CASO 1 · tras «¿Cómo va el negocio?», «¿qué está explicando principalmente ese resultado?» redujo el
 *            negocio a Falabella — una referencia anafórica NUNCA reduce el alcance sin instrucción.
 *   CASO 2 · sobre una tabla que abría con Lider, «profundiza en el primero» respondió Falabella — el
 *            referente inequívoco era Lider.
 * LA CAUSA RAÍZ: en el camino del agente nadie conservaba ni resolvía `scope → conjunto presentado → ordinal
 * → entidad activa`; todo vivía en la lectura que el modelo hace del hilo. El mecanismo que lo hacía bien
 * (`conversationScope`, la memoria canónica del Contrato v2) quedó huérfano tras La Poda.
 * SU ORDEN, textual: «reutilizando conversationScope y los mecanismos existentes. No quiero otra memoria
 * paralela ni otro resolver». Y las ocho frases que pidió como pruebas permanentes:
 *   «Profundiza en el primero.» · «Ahora el segundo.» · «¿Y ese?» · «Compáralo con el anterior.» ·
 *   «¿Qué explica eso?» · «Volvamos al negocio completo.» · «Ahora solo Lider.» · «¿Y los otros tres?»
 *
 * ⚠️ NADA DE NOMBRES ESCRITOS A MANO: las cuentas salen del pack por su conducta (las cuatro con mayor brecha
 * bajo el benchmark, en el orden sellado por la lectura), y «Ahora solo Lider.» se arma con la que salió
 * primera — la FORMA es la del owner, el nombre lo pone el dato. Así el candado vale para cualquier planilla.
 *
 * LO QUE SE PRUEBA: (1) el resolutor canónico con las ocho formas y sus contrapesos; (2) la cadena entera con
 * el cerebro MUDO —el respaldo responde por el referente correcto, jamás la frase falsa—; (3) el cerebro que
 * se equivoca de referente: la coerción corrige el pedido y el veto cobra la narración; (4) un conjunto se
 * presenta en UN orden; (5) el cableado y su carnada.
 *
 * OFFLINE · determinístico · CERO llamadas al modelo.
 * `node --import ./scripts/offline-guard.mjs _continuidad_referente_gate.mjs` */
import { readFileSync } from "node:fs";
import { initTenant } from "./src/data/tenantStore.js";
import { TENANT_DEMO } from "./src/data/tenants/demo.js";
import { answerViaAgente } from "./src/adi/agente/bucleAgente.js";
import { resolveConversationReference, resolveOrdinalReference, updateConversationScope, emptyConversationScope, esAlcanceGlobal, vetoReferente, ordenPresentadoEn, DEICTIC_SINGULAR_RE } from "./src/adi/oracle/conversationScope.js";
import { vetosDeContrato } from "./src/adi/agente/contratoAgente.js";
import { buildRequestContext } from "./src/adi/oracle/requestContext.js";
import { TOOLS } from "./src/adi/oracle/toolRegistry.js";
import { cajaDelAgente } from "./src/adi/agente/herramientasAgente.js";
import { runPlan } from "./src/adi/oracle/toolRunner.js";
import { ESCENARIO_INICIAL } from "./src/config/scenarios.js";
import { axisEntityNames } from "./src/adi/oracle/entityIndex.js";

let pass = 0, fail = 0;
const ok = (cond, label, detalle) => {
  if (cond) { pass++; console.log(`  ✓ ${label}`); }
  else { fail++; console.log(`  ✗ ${label}`); if (detalle !== undefined) console.log(`      ${String(detalle).slice(0, 360)}`); }
};
const H = (t) => console.log(`\n${t}`);
const ESC = ESCENARIO_INICIAL;
const MUDO = async () => ({ tipo: "texto", texto: "" });
const FALSA = /no tengo informaci[oó]n autorizada/i;
const nombra = (t, n) => new RegExp(`(?:^|[^\\wáéíóúñ])${String(n).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![\\wáéíóúñ])`, "i").test(t);

initTenant(TENANT_DEMO);
const CAJA = cajaDelAgente(TOOLS);
const RC = buildRequestContext({ scenario: ESC, mem: {} });
const figsDe = (calls) => (runPlan({ intent: "answer", calls }, { scenario: ESC, maxCalls: 4, preguntaUsuario: "x", registry: CAJA }).ledger || {}).figs || [];
const valDe = (f) => String((f && (f.text || f.value)) || "");

/* ── LAS CUATRO, POR SU CONDUCTA: las de mayor brecha bajo el benchmark, en el orden sellado por la lectura ── */
const FIGS_MARGEN = figsDe([{ tool: "marginRead", args: { focus: "bajo_benchmark", dimension: "cliente" } }]);
const CLIENTES = axisEntityNames("cliente");   // «El negocio · Brecha al benchmark» no es una cuenta: el índice decide quién lo es
const CUATRO = [...new Set(FIGS_MARGEN.filter((f) => /· Margen$/i.test(f.label || "")).map((f) => f.label.split("·")[0].trim()).filter((n) => CLIENTES.includes(n)))].slice(0, 4);
const [E1, E2, E3, E4] = CUATRO;
H("0 · el pack trae cuatro cuentas bajo el benchmark, en el orden sellado por la lectura (su fila «· Margen»)");
ok(CUATRO.length === 4, `las cuatro: ${CUATRO.join(" → ")}`);
if (CUATRO.length < 4) { console.log("\n── sin cuatro cuentas no se puede medir la cadena ──"); process.exit(1); }

/* la tabla que el cerebro narra, con las cifras REALES de la boleta (así pasa el muro y es lo que el usuario ve) */
const TABLA = ["Ocho clientes están bajo el benchmark, pero el peso real lo cargan cuatro.", "| Cliente | Margen |",
  ...CUATRO.map((n) => { const m = FIGS_MARGEN.find((f) => f.label === `${n} · Margen`); return `| ${n} | ${valDe(m)} |`; })].join("\n");
const cerebroTabla = () => { let k = 0; return async () => { k++; return k === 1 ? { tipo: "herramientas", pedidos: [{ tool: "marginRead", args: { focus: "bajo_benchmark", dimension: "cliente" } }] } : { tipo: "texto", texto: TABLA }; }; };

/* ═══ 1 · EL RESOLUTOR CANÓNICO, EXTENDIDO — las ocho formas y sus contrapesos ═══════════════════════════════ */
H("1 · el resolutor canónico resuelve las ocho formas sobre el conjunto presentado — y no adivina");
{
  const CUR = { dimension: "cliente", entities: CUATRO, selection: { orden: "descendente", subset: null }, tenant: { tenantId: RC.tenantId } };
  const scope = (current) => ({ version: 1, current, history: [] });
  const res = (q, cur = CUR) => resolveConversationReference(q, { scope: { level: null, entities: [] } }, scope(cur), RC, null, null);
  const ents = (r) => (r && r.entities) ? r.entities.join(",") : `(${r && r.kind}${r && r.reason ? ":" + r.reason : ""})`;
  ok(ents(res("Profundiza en el primero.")) === E1, `«Profundiza en el primero.» → ${E1}`, ents(res("Profundiza en el primero.")));
  ok(ents(res("Ahora el segundo.")) === E2, `«Ahora el segundo.» → ${E2}`, ents(res("Ahora el segundo.")));
  ok(ents(res("el último")) === E4 && ents(res("los dos primeros")) === `${E1},${E2}`, "«el último» y «los dos primeros» siguen como siempre");
  const conSel = { ...CUR, selection: { orden: "descendente", subset: { kind: "seleccion", entities: [E2], anterior: [E1] } } };
  ok(ents(res("¿Y ese?", conSel)) === E2, `«¿Y ese?» con selección activa → la activa (${E2})`, ents(res("¿Y ese?", conSel)));
  ok(res("¿Y ese?").kind === "ambiguous" && res("¿Y ese?").options.length === 4, "★ «¿Y ese?» sin selección y con cuatro en pantalla → se PREGUNTA, no se elige solo", res("¿Y ese?").kind);
  ok(ents(res("Compáralo con el anterior.", conSel)) === `${E2},${E1}`, `«Compáralo con el anterior.» → la activa y la anterior (${E2}, ${E1})`, ents(res("Compáralo con el anterior.", conSel)));
  ok(res("Compáralo con el anterior.").kind === "decline" && res("Compáralo con el anterior.").reason === "sin_anterior", "…y sin selección anterior se declina con su motivo, no se inventa");
  ok(ents(res("¿Qué explica eso?", conSel)) === E2, "«¿Qué explica eso?» (neutro) conserva la selección vigente");
  ok(ents(res("¿Qué explica eso?")) === CUATRO.join(","), "★ …y sin selección conserva el conjunto ENTERO: una anáfora nunca reduce el alcance");
  const cartera = { dimension: "cartera", entities: [], selection: null, tenant: { tenantId: RC.tenantId } };
  ok(res("¿Qué está explicando principalmente ese resultado?", cartera).kind === "resolved-scope" && res("¿Qué está explicando principalmente ese resultado?", cartera).alcance === "cartera",
    "★★ CASO 1: «ese resultado» sobre el negocio entero → alcance = negocio entero, ninguna cuenta");
  ok(esAlcanceGlobal("Volvamos al negocio completo.") && esAlcanceGlobal("¿Cómo va el negocio?") && !esAlcanceGlobal("¿cómo va Falabella?"),
    "«Volvamos al negocio completo.» es cambio de alcance; «¿cómo va X?» no");
  const conLider = { ...CUR, selection: { orden: "descendente", subset: { kind: "seleccion", entities: [E1], anterior: null } } };
  ok(ents(res("¿Y los otros tres?", conLider)) === [E2, E3, E4].join(","), `«¿Y los otros tres?» con ${E1} activa → ${[E2, E3, E4].join(", ")}`, ents(res("¿Y los otros tres?", conLider)));
  const dos = res("¿Y los otros dos?", conLider);
  ok(dos.kind === "decline" && dos.reason === "conteo_no_calza" && dos.detalle.hay === 3, "★ «¿Y los otros dos?» cuando son tres → se declina diciendo cuántos son: no se adivina");
  ok(res("Ahora solo " + E1 + ".", CUR).kind === "none", "«Ahora solo X.» nombra a alguien: el resolutor no interviene (lo toma el índice)");

  /* los falsos positivos que NO puede tener: sin scope no hay nada que resolver; «esta semana» no es un deíctico */
  ok(resolveConversationReference("¿Y ese?", { scope: { level: null, entities: [] } }, emptyConversationScope(), RC).kind === "none", "sin scope establecido, «¿y ese?» no resuelve nada (none)");
  for (const q of ["¿qué hago esta semana?", "Falabella esta perdiendo margen", "explícamelo para el equipo comercial", "¿cómo va este mes?", "dame los 5 clientes de mejor margen"]) {
    ok(res(q).kind === "none", `no es una referencia: «${q}»`, res(q).kind);
  }
  ok(!DEICTIC_SINGULAR_RE.test("Falabella esta perdiendo margen"), "★ «esta» pegado a un verbo (el «está» sin tilde del chat) NO es un deíctico");
}

/* ═══ 2 · EL ESCRITOR: el conjunto presentado, con selección dentro del conjunto ═══════════════════════════ */
H("2 · el escritor canónico guarda lo que el usuario VIO y la selección dentro del conjunto");
{
  const resultados = runPlan({ intent: "answer", calls: [{ tool: "marginRead", args: { focus: "bajo_benchmark", dimension: "cliente" } }] }, { scenario: ESC, maxCalls: 2, preguntaUsuario: "x", registry: CAJA }).results;
  const s1 = updateConversationScope(emptyConversationScope(), { plan: { scope: { level: null, entities: [] } }, calls: [{ tool: "marginRead", args: {} }], results: resultados, turno: 2, requestContext: RC, ordenPresentado: ordenPresentadoEn(TABLA, CUATRO.concat(["Ripley", "Easy"])) });
  ok(s1.current && s1.current.entities.join(",") === CUATRO.join(","), `el conjunto es el de la TABLA (${s1.current.entities.length}), no todo lo que la herramienta devolvió`, s1.current && s1.current.entities.join(","));
  const s2 = updateConversationScope(s1, { plan: { scope: { level: null, entities: [] } }, calls: [], results: [], turno: 4, requestContext: RC, seleccion: { entities: [E1] } });
  ok(s2.current.entities.join(",") === CUATRO.join(",") && s2.current.selection.subset.entities.join(",") === E1, "una selección dentro del conjunto CONSERVA el conjunto");
  const s3 = updateConversationScope(s2, { plan: { scope: { level: null, entities: [] } }, calls: [], results: [], turno: 6, requestContext: RC, seleccion: { entities: [E2] } });
  ok(s3.current.selection.subset.entities.join(",") === E2 && s3.current.selection.subset.anterior.join(",") === E1, "…y la selección previa queda como «anterior»");
  const s4 = updateConversationScope(s3, { plan: { scope: { level: "global", entities: [] } }, calls: [], results: [], turno: 8, requestContext: RC });
  ok(s4.current.dimension === "cartera" && s4.history[0] && s4.history[0].entities.join(",") === CUATRO.join(","), "el cambio a negocio entero retira el conjunto a la historia, como siempre");
  ok(ordenPresentadoEn(TABLA, CUATRO).join(",") === CUATRO.join(","), "el orden presentado se lee de las filas de la tabla");
}

/* ═══ 3 · ★★ LA CADENA ENTERA CON EL CEREBRO MUDO — el respaldo responde por el referente correcto ══════════ */
H("3 · ★★ la cadena del owner con el cerebro MUDO: cada turno responde por el referente correcto, nunca la frase falsa");
let history = [], mem = {};
const turno = async (q, cerebro = MUDO) => {
  const r = await answerViaAgente({ text: q, history, mem, scenario: ESC, callAgente: cerebro });
  history = [...history, { role: "user", text: q }, { role: "assistant", text: String(r.r.text || "") }];
  mem = r.mem || mem;
  return { t: String(r.r.text || ""), a: r.r.agente, cs: r.mem && r.mem.conversationScope && r.mem.conversationScope.current };
};
{
  const t1 = await turno("¿Cómo va el negocio?");
  ok(t1.cs && t1.cs.dimension === "cartera", "T1 «¿Cómo va el negocio?» deja el alcance en negocio entero");
  const t2 = await turno("¿Qué está explicando principalmente ese resultado?");
  ok(t2.a.referente && t2.a.referente.alcance === "cartera", "★★ CASO 1: «ese resultado» se resuelve al negocio entero");
  ok(t2.a.estado === "playbook" && !FALSA.test(t2.t), `…y el procedimiento del porqué responde a ese nivel (${t2.a.estado})`, t2.t.slice(0, 120));
  ok(!/^\s*(?:\w[\w ]*) · /.test(t2.t) && !/Lo que sí tengo verificado: [^·\n]+ · Brecha/.test(t2.t), "…sin reducirse a la fila de una cuenta");
  const t3 = await turno("¿Qué clientes explican más eso?", cerebroTabla());
  ok(t3.cs && t3.cs.entities.join(",") === CUATRO.join(","), `T3 la tabla deja el conjunto presentado: ${CUATRO.join(" → ")}`, t3.cs && t3.cs.entities.join(","));
  const t4 = await turno("Profundiza en el primero.");
  ok(t4.a.referente && t4.a.referente.entities && t4.a.referente.entities[0] === E1, `★★ CASO 2: «el primero» = ${E1}`, JSON.stringify(t4.a.referente));
  ok(t4.a.estado === "playbook" && nombra(t4.t, E1) && !FALSA.test(t4.t), `…y con el cerebro mudo la FICHA de ${E1} responde (${t4.a.estado})`, t4.t.slice(0, 100));
  ok(!new RegExp(`^${E2}`).test(t4.t), `…no la de ${E2}`);
  const t5 = await turno("Ahora el segundo.");
  ok(t5.a.referente.entities[0] === E2 && nombra(t5.t, E2) && t5.a.estado === "playbook", `«Ahora el segundo.» → ${E2}, con ficha`, t5.t.slice(0, 80));
  ok(t5.cs.selection.subset.entities[0] === E2 && t5.cs.selection.subset.anterior[0] === E1, "…y el scope recuerda la selección y la anterior");
  const t6 = await turno("¿Y ese?");
  ok(t6.a.referente.entities[0] === E2 && nombra(t6.t, E2), `«¿Y ese?» → sigue en ${E2}`);
  const t7 = await turno("Compáralo con el anterior.");
  ok(t7.a.referente.entities.join(",") === `${E2},${E1}`, `«Compáralo con el anterior.» → ${E2} vs ${E1}`, JSON.stringify(t7.a.referente));
  ok(t7.a.estado === "playbook" && nombra(t7.t, E1) && nombra(t7.t, E2) && !FALSA.test(t7.t), "…y comparar-alternativas responde con las dos (los dos caminos, con precio)", t7.t.slice(0, 100));
  const t8 = await turno("¿Qué explica eso?");
  ok(t8.a.referente.entities.join(",") === `${E2},${E1}` && !FALSA.test(t8.t) && nombra(t8.t, E1) && nombra(t8.t, E2), "«¿Qué explica eso?» conserva el par — y si no hay lectura, el límite NOMBRA al par (nunca la frase falsa)", t8.t.slice(0, 120));
  const t9 = await turno("Volvamos al negocio completo.");
  ok(t9.cs.dimension === "cartera" && t9.a.estado === "playbook" && !FALSA.test(t9.t), "«Volvamos al negocio completo.» → negocio entero, con la foto del negocio como procedimiento", t9.a.estado);
  const t10 = await turno("¿Qué explica eso?");
  ok(t10.a.referente && t10.a.referente.alcance === "cartera" && !FALSA.test(t10.t), "★ «¿Qué explica eso?» tras la vuelta: alcance = negocio entero, no vuelve a una cuenta");
}
{
  history = []; mem = {};
  await turno("¿Qué clientes explican más eso?", cerebroTabla());
  const s1 = await turno(`Ahora solo ${E1}.`);
  ok(s1.a.estado === "playbook" && nombra(s1.t, E1) && s1.cs.entities.join(",") === CUATRO.join(",") && s1.cs.selection.subset.entities[0] === E1,
    `«Ahora solo ${E1}.» → la ficha, y el conjunto se CONSERVA con ${E1} seleccionada`, `${s1.a.estado} · ${s1.cs && s1.cs.entities.join(",")}`);
  const s2 = await turno("¿Y los otros tres?");
  ok(s2.a.referente.entities.join(",") === [E2, E3, E4].join(","), `«¿Y los otros tres?» → ${[E2, E3, E4].join(", ")}`, JSON.stringify(s2.a.referente));
  ok(!FALSA.test(s2.t) && nombra(s2.t, E2) && nombra(s2.t, E3) && nombra(s2.t, E4) && !new RegExp(`^${E1}`).test(s2.t), "…y con el cerebro mudo el límite nombra a los tres, jamás la frase falsa ni la cuenta ya vista", s2.t.slice(0, 140));
  /* tras seleccionar a los tres, «los otros» es UNO (la cuenta que quedó afuera): «dos» no calza y se dice */
  const s3 = await turno("¿Y los otros dos?");
  ok(s3.a.estado === "referente-sin-conjunto" && s3.a.calls === 0 && /son 1, no 2/.test(s3.t) && nombra(s3.t, E1), "«¿Y los otros dos?» cuando no calza → se dice cuántos son y quiénes, sin llamar al cerebro", s3.t);
}

/* ═══ 4 · ★★ EL CEREBRO QUE SE EQUIVOCA DE REFERENTE — lo que hizo producción ═══════════════════════════════ */
H("4 · ★★ el cerebro resuelve mal «el primero»: la coerción corrige el pedido y el veto cobra la narración");
{
  history = []; mem = {};
  await turno("¿Qué clientes explican más eso?", cerebroTabla());
  let k = 0;
  const equivocado = async () => { k++; return k === 1 ? { tipo: "herramientas", pedidos: [{ tool: "entityProfile", args: { entity: E2 } }] } : { tipo: "texto", texto: `${E2} es la cuenta que más pesa y ahí entraría. Por qué rinde así no está en este dato. ¿La comparo con la cartera?` }; };
  const r = await turno("Profundiza en el primero.", equivocado);
  ok((r.a.coerciones || []).some((c) => new RegExp(`pidió ${E2}, el referente resuelto es ${E1}`).test(c)), `★ el pedido por ${E2} se corrige a ${E1} y queda en el expediente`, JSON.stringify(r.a.coerciones));
  ok((r.a.vetos || []).some((v) => /referente-cambiado/.test(String(v))), `★ la narración sobre ${E2} sin nombrar a ${E1} ARDE (referente-cambiado)`, JSON.stringify(r.a.vetos));
  ok(nombra(r.t, E1) && !new RegExp(`^${E2}`).test(r.t) && !FALSA.test(r.t), `★★ la pantalla habla de ${E1}: el referente es del procedimiento, no del narrador`, r.t.slice(0, 120));
  /* y la narración CORRECTA sobre el referente pasa limpia — la regla no muerde prosa buena */
  const cur = { dimension: "cliente", entities: CUATRO };
  ok(vetoReferente(`${E1} vende menos margen que la cartera; ${E2} le sigue de cerca.`, { kind: "resolved", entities: [E1], dimension: "cliente" }, cur) === null, "…y nombrar al referente junto a otra cuenta (una comparación) NO arde");
  ok(vetoReferente(`${E2} es la cuenta que más pesa.`, { kind: "resolved", entities: [E1], dimension: "cliente" }, cur) !== null, "…pero hablar de otra sin nombrar al referente sí");
}

/* ═══ 5 · UN CONJUNTO, UN ORDEN ═════════════════════════════════════════════════════════════════════════════ */
H("5 · un conjunto se presenta en UN orden: la enumeración de la prosa no contradice a la tabla");
{
  const prosaAlReves = `Ocho clientes están bajo el benchmark, pero el peso real lo cargan cuatro: ${E2}, ${E1}, ${E4} y ${E3} explican la mayor parte.\n${TABLA.split("\n").slice(1).join("\n")}`;
  const v = (t) => vetosDeContrato(t, { entidades: CUATRO.concat(["Ripley", "Easy"]) }).map((x) => x.regla);
  ok(v(prosaAlReves).includes("dos-ordenes"), "★★ la pantalla del owner ARDE: prosa en un orden, tabla en otro", v(prosaAlReves).join(","));
  const prosaIgual = `Ocho clientes están bajo el benchmark, pero el peso real lo cargan cuatro: ${CUATRO.join(", ").replace(/, ([^,]+)$/, " y $1")} explican la mayor parte.\n${TABLA.split("\n").slice(1).join("\n")}`;
  ok(!v(prosaIgual).includes("dos-ordenes"), "…y enumerar en el MISMO orden que la tabla pasa limpio");
  const sueltas = `${E2} concentra más venta que ${E1}, pero ${E1} tiene la peor brecha.\n${TABLA.split("\n").slice(1).join("\n")}`;
  ok(!v(sueltas).includes("dos-ordenes"), "…y nombrar cuentas sueltas en la prosa, en cualquier orden, sigue siendo libre");
}

/* ═══ 6 · EL CABLEADO Y SU CARNADA ══════════════════════════════════════════════════════════════════════════ */
H("6 · la ley está cableada al agente, no solo escrita — y sin el escritor, el ordinal vuelve a fallar");
{
  const bucle = readFileSync(new URL("./src/adi/agente/bucleAgente.js", import.meta.url), "utf8");
  ok(/memOut\.conversationScope = updateConversationScope\(/.test(bucle), "el bucle ESCRIBE el scope canónico al cierre del turno");
  ok(/resolveConversationReference\(q, planSintetico, scopePrev, requestContext/.test(bucle), "…y lo LEE al abrir el turno con el resolutor canónico");
  ok(/vetoReferente\(t, referente, scopePrev\.current\)/.test(bucle), "…el juez cobra el referente cambiado");
  ok(/preferir: preferirDelTurno/.test(bucle), "…y el rescate recibe el referente/alcance para no servir la fila 1 a ciegas");
  ok(!/recentSubjects\s*=|mem\.referenteActivo|conjuntoPresentado\s*=/.test(bucle), "★ sin memoria paralela: el único estado es mem.conversationScope");
  /* la carnada: sin la escritura del scope, «el primero» no tiene conjunto y el turno se cae */
  const url = "data:text/javascript;base64," + Buffer.from(bucle.replace(/memOut\.conversationScope = updateConversationScope\([\s\S]*?\}\);/, "/* carnada: sin escritor */").replace(/from "\.\.\/\.\.\//g, `from "${new URL("./src/", import.meta.url).href}`).replace(/from "\.\.\//g, `from "${new URL("./src/adi/", import.meta.url).href}`).replace(/from "\.\//g, `from "${new URL("./src/adi/agente/", import.meta.url).href}`), "utf8").toString("base64");
  let cazada = null;
  try {
    const Mut = await import(url);
    let h = [], m = {};
    const paso = async (q, cerebro) => { const r = await Mut.answerViaAgente({ text: q, history: h, mem: m, scenario: ESC, callAgente: cerebro }); h = [...h, { role: "user", text: q }, { role: "assistant", text: String(r.r.text || "") }]; m = r.mem || m; return r; };
    await paso("¿Qué clientes explican más eso?", cerebroTabla());
    const r = await paso("Profundiza en el primero.", MUDO);
    cazada = !(r.r.agente.referente && r.r.agente.referente.entities && r.r.agente.referente.entities[0] === E1);
  } catch (e) { cazada = `la copia mutada no cargó: ${String(e.message).slice(0, 100)}`; }
  ok(cazada === true, "★ carnada: sin el escritor del scope, «el primero» ya no resuelve — el chequeo de §3 daría ✗", cazada);
}

console.log(`\n══ ${pass} PASS · ${fail} FAIL ══`);
process.exit(fail ? 1 : 0);
