/* === _encargo_compuesto_gate.mjs · LA COBERTURA DEL ENCARGO COMPUESTO CUANDO EL MODELO CAE (owner 2026-09-11) ═══
 *
 * EL REQUISITO, textual: «Cuando el usuario realiza un encargo compuesto y ADI ya entendió sus partes y reunió
 * evidencia suficiente, un fallo del narrador no puede hacer que desaparezcan partes explícitamente solicitadas.
 * La respuesta de respaldo puede ser menos elegante, pero debe conservar la cobertura del encargo.»
 * Medido en su batería viva: ejecutivo 6 → 3 · causal 5 → ~3,5 · natural 5 → 0 · comercial 5/5 solo porque
 * sobrevivió el narrador.
 *
 * LO QUE SE PRUEBA, con el cerebro MUDO (el peor caso: el modelo cae siempre):
 *   1 · las partes se reconocen con léxico cerrado, en el orden de la casa, y SOLO con dos o más pedidas;
 *   2 · los pasos del turno son la unión de los del procedimiento y los de cada parte, sin duplicar;
 *   3 · los cuatro prompts de la batería salen por el ensamblador con cobertura completa: cada parte pedida
 *       está, en orden, con una sola tesis, un solo criterio, evidencia separada de hipótesis, y la versión para
 *       el lector al final cuando lo nombró — y ninguna cifra fuerte más de dos veces en el cuerpo;
 *   4 · el paraguas de la foto toma SOLO el encargo compuesto sobre el negocio entero — no una pregunta simple;
 *   5 · una parte sin evidencia se declara en una línea, jamás se inventa;
 *   6 · cableado: el ensamblador va antes del entregable simple y se juzga con el muro.
 *
 * OFFLINE · determinístico · CERO llamadas.
 * `node --import ./scripts/offline-guard.mjs _encargo_compuesto_gate.mjs` */
import { readFileSync } from "node:fs";
import { initTenant } from "./src/data/tenantStore.js";
import { TENANT_DEMO } from "./src/data/tenants/demo.js";
import { answerViaAgente } from "./src/adi/agente/bucleAgente.js";
import { partesDelEncargo, pasosDelEncargo, componerEncargo } from "./src/adi/agente/encargoCompuesto.js";
import { playbookPara, pasosDe } from "./src/adi/agente/playbooks/registro.js";
import { resumenDelNegocio } from "./src/adi/agente/playbooks/resumenDelNegocio.js";
import { TOOLS } from "./src/adi/oracle/toolRegistry.js";
import { cajaDelAgente } from "./src/adi/agente/herramientasAgente.js";
import { runPlan } from "./src/adi/oracle/toolRunner.js";
import { ESCENARIO_INICIAL } from "./src/config/scenarios.js";

let pass = 0, fail = 0;
const ok = (cond, label, detalle) => {
  if (cond) { pass++; console.log(`  ✓ ${label}`); }
  else { fail++; console.log(`  ✗ ${label}`); if (detalle !== undefined) console.log(`      ${String(detalle).slice(0, 360)}`); }
};
const H = (t) => console.log(`\n${t}`);
const ESC = ESCENARIO_INICIAL;
const MUDO = async () => ({ tipo: "texto", texto: "" });
initTenant(TENANT_DEMO);
const CAJA = cajaDelAgente(TOOLS);
const leer = (pasos) => (runPlan({ intent: "answer", calls: pasos.map((s) => ({ tool: s.tool, args: s.args || {} })) }, { scenario: ESC, maxCalls: 8, preguntaUsuario: "x", registry: CAJA }).ledger || {}).figs || [];
const palabras = (t) => String(t).trim().split(/\s+/).length;
const cifras = (t) => (String(t).match(/\$[\d.,]+[KMB]?|[\d.,]+\s*%/g) || []).map((c) => c.replace(/\s+/g, ""));
const masDeDos = (t) => { const n = {}; for (const c of cifras(t)) n[c] = (n[c] || 0) + 1; return Object.entries(n).filter(([, k]) => k > 2).map(([c, k]) => `${c}×${k}`); };
const cuerpoDe = (t) => String(t).split(/\n\nPara (?:el|la|los|las) [^\n]*, (?:en corto|lo que importa es esto|con la evidencia|así):/)[0];
const criterios = (t) => String(t).split("\n").filter((l) => /\b(?:entrar[ií]a por|empezar[ií]a por|partir[ií]a por)\b/i.test(l)).length;

const BATERIA = {
  ejecutivo: "Dime cómo va el negocio, qué está explicando el resultado, qué clientes presionan más el margen, qué puedes demostrar y qué harías primero. Al final resúmelo para directorio.",
  causal: "Estoy vendiendo más pero siento que gano menos. Quiero que confirmes si es cierto, me digas por qué, si viene de precio, costo, mix o acciones comerciales, qué clientes están detrás y qué información te falta.",
  comercial: "Analiza la cartera: quién sostiene ventas, quién destruye margen, dónde está la mayor recuperación y qué tres cuentas revisarías primero. Explícalo para comercial.",
  natural: "Mira el negocio completo como si fueras mi asesor. Dime qué está bien, qué te preocupa, por qué, cuánto dinero está en juego y dónde actuarías primero.",
};

/* ═══ 1 · LAS PARTES ══════════════════════════════════════════════════════════════════════════════════════ */
H("1 · las partes pedidas se reconocen con léxico cerrado, en el orden de la casa, y solo con dos o más");
{
  const claves = (q) => partesDelEncargo(q).map((p) => p.clave);
  ok(claves(BATERIA.ejecutivo).join(",") === "foto,porque,quienes,sello,primero", `ejecutivo → ${claves(BATERIA.ejecutivo).join(" → ")}`);
  ok(claves(BATERIA.causal).join(",") === "veredicto,porque,quienes,sello", `causal → ${claves(BATERIA.causal).join(" → ")}`);
  ok(claves(BATERIA.comercial).join(",") === "foto,quienes,primero", `comercial → ${claves(BATERIA.comercial).join(" → ")}`);
  ok(claves(BATERIA.natural).join(",") === "foto,porque,quienes,primero", `natural → ${claves(BATERIA.natural).join(" → ")}`);
  for (const q of ["¿Cómo va el negocio?", "¿Por qué está pasando?", "¿Qué harías primero?", "¿Cuánto vende SAM-TV55 y cuánto stock tiene?", "dame los 3 riesgos para el directorio"])
    ok(claves(q).length === 0, `«${q}» no es un encargo compuesto: el ensamblador no se activa`);
  ok(claves("¿por qué cae el margen, a qué se debe y qué lo explica?").length === 0, "★ tres preguntas sobre UNA sola parte no son un encargo compuesto: hacen falta dos partes distintas");
  ok(claves("Dime cómo va el negocio y qué harías primero, y cuánto dinero hay en juego").join(",") === "foto,quienes,primero", "…y con dos o más partes distintas sí, en el orden de la casa aunque el usuario las pida en otro");
}

/* ═══ 2 · LOS PASOS ═══════════════════════════════════════════════════════════════════════════════════════ */
H("2 · los pasos del turno son la unión de los del procedimiento y los de cada parte, sin duplicar");
{
  const partes = partesDelEncargo(BATERIA.ejecutivo);
  const base = pasosDe(resumenDelNegocio, BATERIA.ejecutivo, {});
  const union = pasosDelEncargo(partes, base, {});
  const tools = union.map((p) => p.tool);
  ok(tools.length === new Set(union.map((p) => `${p.tool}::${JSON.stringify(p.args || {})}`)).size, "sin duplicados por herramienta+args");
  ok(["executiveSummary", "diagnose", "rolesCartera", "marginRead"].every((t) => tools.includes(t)), `la unión trae la evidencia de todas las partes (${tools.join(", ")})`);
  ok(union.length <= 8, `…y cabe en una ronda (${union.length} ≤ 8)`);
}

/* ═══ 3 · LOS CUATRO PROMPTS, CON EL CEREBRO MUDO ═════════════════════════════════════════════════════════ */
H("3 · ★★ los cuatro prompts de la batería, con el modelo caído, salen por el ensamblador con cobertura completa");
const R = {};
for (const [k, q] of Object.entries(BATERIA)) {
  const r = await answerViaAgente({ text: q, history: [], mem: {}, scenario: ESC, callAgente: MUDO });
  R[k] = { t: String(r.r.text || ""), a: r.r.agente };
  ok(r.r.agente.estado === "encargo-compuesto", `«${k}» responde el ensamblador (${r.r.agente.estado}, ${r.r.agente.calls} herramientas, ${palabras(R[k].t)} palabras)`, (r.r.agente.vetos || []).join(" | ").slice(0, 200));
}
{
  const t = R.ejecutivo.t, c = cuerpoDe(t);
  const at = (re) => { const m = re.exec(t); return m ? m.index : -1; };
  const iTesis = 0, iPorque = at(/Lo primero, y cambia la decisi[oó]n/), iQuienes = at(/- Falabella · deja/), iSello = at(/esto está medido:/), iPrimero = at(/Entrar[ií]a por [^.]+\. Una sola cosa\./), iDir = at(/Para el directorio, en corto:/);
  ok(!/\d/.test(t.split("\n")[0]) && /creciendo|crece/i.test(t.split("\n")[0]), "ejecutivo · abre con la tesis, sin cifras");
  ok(iPorque > 0 && iSello > iPorque && iQuienes > iPorque && iPrimero > iQuienes && iDir > iPrimero, `ejecutivo · las seis partes están y en orden: tesis(${iTesis}) < porqué(${iPorque}) < quiénes(${iQuienes}) < primero(${iPrimero}) < directorio(${iDir})`);
  ok(/esto está medido:/.test(t) && /queda abierto:/.test(t) && /el patrón apunta ahí, sin prueba todavía/.test(t), "ejecutivo · evidencia separada de hipótesis: medido · patrón · abierto");
  ok(/apuesta tuya/.test(t) && /Eso lo sabes tú|el dato mide la carga comercial, no la intención/.test(t), "ejecutivo · la intención se le pregunta al dueño, no se dictamina");
  ok(criterios(c) === 1 && /Entrar[ií]a por Falabella\. Una sola cosa\./.test(c), `ejecutivo · un solo criterio en el cuerpo, el de la prioridad (${criterios(c)})`);
  ok(masDeDos(c).length === 0, "ejecutivo · ninguna cifra fuerte más de dos veces en el cuerpo", masDeDos(c).join(", "));
  ok(/\n\nPara el directorio, en corto:\n/.test(t) && /Entrar[ií]a por Falabella\./.test(t.slice(iDir)), "ejecutivo · cierra con la versión para el directorio, con la misma conclusión");
}
{
  const t = R.causal.t;
  ok(/^Las dos son ciertas y no se contradicen\./.test(t), "causal · el veredicto lo pone la contradicción, y abre");
  ok(/Lo primero, y cambia la decisi[oó]n/.test(t) && /- Falabella · deja/.test(t) && /Para cerrarlo:/.test(t) && /queda abierto:/.test(t), "causal · por qué, quiénes y qué falta están");
  ok(/precio|costo/.test(t) && /mix/.test(t) && /acciones comerciales/.test(t), "causal · precio/costo, mix y acciones comerciales aparecen con su sello");
  ok(criterios(t) === 1, `causal · un solo criterio (${criterios(t)})`);
  ok(masDeDos(t).length === 0, "causal · ninguna cifra fuerte más de dos veces", masDeDos(t).join(", "));
}
{
  const t = R.comercial.t, c = cuerpoDe(t);
  ok(/- Falabella · deja \$1\.6M/.test(c) && /- Lider · deja/.test(c) && /- Jumbo · deja/.test(c), "comercial · las tres cuentas con su cifra");
  ok(/Entrar[ií]a por Falabella\. Una sola cosa\./.test(c) && criterios(c) === 1, "comercial · una sola prioridad, la del procedimiento");
  ok(/\n\nPara el equipo comercial, lo que importa es esto:\n/.test(t) && /- Falabella · deja/.test(t.slice(t.indexOf("Para el equipo comercial"))), "comercial · cierra con la versión para el equipo comercial, con las cuentas");
  ok(!/\b(?:arranquen|empiecen|renegocien|revisen)\b/i.test(t), "comercial · sin órdenes al equipo");
  ok(masDeDos(c).length === 0, "comercial · ninguna cifra fuerte más de dos veces en el cuerpo", masDeDos(c).join(", "));
}
{
  const t = R.natural.t;
  ok(playbookPara(BATERIA.natural, {}) && playbookPara(BATERIA.natural, {}).nombre === "resumen-del-negocio", "★ natural · la foto es el paraguas del encargo sobre el negocio entero");
  ok(/creciendo/.test(t.split("\n")[0]) && /Lo primero, y cambia la decisi[oó]n/.test(t) && /\$4\.9M/.test(t) && /Entrar[ií]a por Falabella\. Una sola cosa\./.test(t), "natural · qué está bien, qué preocupa, por qué, cuánto en juego y dónde actuar: los cinco");
  ok(criterios(t) === 1 && masDeDos(t).length === 0, `natural · un solo criterio y ninguna cifra más de dos veces (${criterios(t)}; ${masDeDos(t).join(", ") || "—"})`);
  ok(!(R.natural.a.vetos || []).some((v) => /encargo-compuesto/.test(String(v))), "natural · el ensamblado pasó el muro a la primera");
}

/* ═══ 4 · EL PARAGUAS, SOLO PARA EL ENCARGO COMPUESTO SOBRE EL NEGOCIO ENTERO ═════════════════════════════ */
H("4 · el paraguas de la foto no captura preguntas simples ni ambiguas");
{
  ok(playbookPara("¿Cómo va el negocio?", {}).nombre === "resumen-del-negocio", "«¿cómo va el negocio?» sigue siendo la foto (como siempre)");
  const corto = playbookPara("Mira el negocio completo y dime qué harías", {});
  ok(!corto || corto.nombre !== "resumen-del-negocio", `«mira el negocio completo y dime qué harías» (dos cosas, no compuesto) NO entra por el paraguas (lo toma ${corto ? corto.nombre : "nadie"}, como antes)`);
  ok(playbookPara("¿por qué cae el margen del negocio completo?", {}) === null || playbookPara("¿por qué cae el margen del negocio completo?", {}).nombre !== "resumen-del-negocio", "«¿por qué cae el margen del negocio completo?» no es de la foto");
  ok(playbookPara("Mira el negocio completo: dime qué está bien, qué te preocupa, por qué y dónde actuarías primero. Y cómo viene Falabella.", {}) === null || playbookPara("Mira el negocio completo: dime qué está bien, qué te preocupa, por qué y dónde actuarías primero. Y cómo viene Falabella.", {}).nombre !== "resumen-del-negocio",
    "…y si nombra una cuenta, la foto se retira (responde por el negocio entero)");
}

/* ═══ 5 · LA PARTE SIN EVIDENCIA SE DECLARA ═══════════════════════════════════════════════════════════════ */
H("5 · una parte que no se puede armar se declara en una línea — no se inventa, y el resto sigue");
{
  const partes = partesDelEncargo(BATERIA.ejecutivo);
  const sinMargen = (pasos) => (pasos.some((p) => p.tool === "rolesCartera" || p.tool === "marginRead") ? [] : leer(pasos));
  const t = componerEncargo({ partes, leer: sinMargen, scenario: ESC, mem: {}, semilla: "s", pregunta: BATERIA.ejecutivo });
  ok(t === null || /no pude armar la lectura con lo leído en este turno/.test(t), "sin la evidencia del margen, las partes de margen se declaran (o el ensamblador cede)", String(t).slice(0, 200));
  const soloFoto = (pasos) => (pasos.some((p) => p.tool === "executiveSummary") ? leer(pasos) : []);
  ok(componerEncargo({ partes, leer: soloFoto, scenario: ESC, mem: {}, semilla: "s", pregunta: BATERIA.ejecutivo }) === null, "★ con UNA sola parte armable el ensamblador cede al piso simple: no hay encargo compuesto que garantizar");
  ok(componerEncargo({ partes: partes.slice(0, 1), leer, scenario: ESC, mem: {}, semilla: "s", pregunta: BATERIA.ejecutivo }) === null, "…y con una sola parte pedida tampoco compone");
}

/* ═══ 6 · CABLEADO ════════════════════════════════════════════════════════════════════════════════════════ */
H("6 · cableado: antes del entregable simple, con el muro, y sin memoria nueva");
{
  const bucle = readFileSync(new URL("./src/adi/agente/bucleAgente.js", import.meta.url), "utf8");
  const iEc = bucle.indexOf('juzgar(_ec, "encargo-compuesto")'), iPb = bucle.indexOf("juzgar(_pb, `playbook:${playbookActivo.nombre}`)");
  ok(iEc > 0 && iPb > iEc, "el ensamblador va ANTES del entregable simple del playbook, y se juzga con el muro");
  ok(/pasosDelEncargo\(_partesEncargo, pasosDe\(playbook, q, ctxTurno\), ctxTurno\)/.test(bucle), "los pasos del turno son la unión (antes del cerebro)");
  ok(/if \(final === null && playbookActivo && _partesEncargo\.length >= 2\)/.test(bucle), "…y el peldaño exige dos o más partes");
  const ec = readFileSync(new URL("./src/adi/agente/encargoCompuesto.js", import.meta.url), "utf8");
  ok(!/\bmem\.[a-zA-Z]+\s*=/.test(ec) && !/localStorage|memOut/.test(ec), "el ensamblador no escribe memoria: compone y se va");
  ok(/componerReformulacion\(cuerpo, \{ pregunta: `para \$\{lector\}` \}\)/.test(ec), "…y la versión para el lector es el piso de reformular de siempre");
}

console.log(`\n── _encargo_compuesto_gate: ${pass} PASS · ${fail} FAIL (de ${pass + fail}) ──`);
process.exit(fail ? 1 : 0);
