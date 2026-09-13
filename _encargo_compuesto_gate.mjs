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

/* ═══ 3b · EL PROMPT DE GERENTE: BOLETA UNIDA CON CLIENTES REPETIDOS (owner 2026-09-13) ═══════════════════
 * Lo que destapó C, reproducido exacto: con el cerebro caído (401 del gateway local → respaldo-piso), este encargo
 * compuesto cae en margen-en-riesgo (va antes que la foto en el registro y el prompt dice «ventas y margen»), lee
 * con la boleta UNIDA de cuatro herramientas, y el resumen ejecutivo repite el margen de las tres grandes. El
 * ensamblador compuso la lectura completa y el notario del procedimiento la multó con «nombras 8 de los 11
 * clientes bajo el benchmark»: contaba apariciones, no clientes. `lecturaDeMargen` cuenta ahora por la identidad
 * canónica del cliente (resolveCanonical), y el universo del recorte vuelve a ser el real: 8. */
H("3b · ★★ el prompt de gerente con el cerebro mudo: boleta unida, clientes repetidos, y el notario aprueba los 8 únicos");
{
  const { lecturaDeMargen } = await import("./src/adi/agente/playbooks/margenEnRiesgo.js");
  const { esEncargoCompuesto } = await import("./src/adi/agente/contratoAgente.js");
  const q = "Mira el negocio completo como si fueras mi asesor. Quiero saber si realmente estamos mejorando o si solo estamos vendiendo más. Dime qué está pasando con ventas y margen, qué está explicando el resultado, qué clientes están ayudando y cuáles están dañando, si el problema parece venir de precio, costo, mix o acciones comerciales, cuánto dinero está en juego, qué puedes demostrar con los datos y qué todavía no puedes saber. Si tuvieras que revisar una sola cosa primero, ¿cuál sería y por qué? Al final déjamelo en 5 líneas para directorio";
  const partes = partesDelEncargo(q);
  ok(esEncargoCompuesto(q) && partes.length >= 2, `encargo compuesto (${partes.map((p) => p.clave).join(" → ")})`);
  const pb = playbookPara(q, {});
  ok(pb && pb.nombre === "margen-en-riesgo", `el procedimiento es margen-en-riesgo (${pb && pb.nombre})`);
  const pasos = pasosDelEncargo(partes, pasosDe(pb, q, {}), {});
  const figs = leer(pasos);
  ok(pasos.some((p) => p.tool === "marginRead") && pasos.some((p) => p.tool === "executiveSummary"), `boleta unida: ${pasos.map((p) => p.tool).join(" + ")} (${figs.length} figs)`);
  const margenesCrudos = figs.filter((f) => /· Margen$/i.test(String(f.label)));
  const rep = ["Lider", "Falabella", "Jumbo"].filter((e) => margenesCrudos.filter((f) => String(f.label).startsWith(e + " ·")).length >= 2);
  ok(rep.length === 3, `★ la unión repite el margen de las tres grandes (${margenesCrudos.length} filas «· Margen» para 13 clientes: ${rep.join(", ")} dos veces)`);
  const L = lecturaDeMargen(figs);
  ok(L.bajo.length === 8 && new Set(L.bajo.map((b) => b.entidad)).size === 8 && String(L.conteo && (L.conteo.value || L.conteo.text)) === "8",
    `★★ lecturaDeMargen cuenta clientes únicos: bajo el benchmark = 8 de 8 (${L.bajo.map((b) => b.entidad).join(", ")}), igual al conteo del motor`);
  ok(new Set(L.margenes.map((m) => m.entidad)).size === L.margenes.length && new Set(L.juego.map((j) => j.entidad)).size === L.juego.length && new Set(L.carga.map((c) => c.entidad)).size === L.carga.length,
    `…y márgenes, contribución no capturada y carga alta tampoco repiten entidad (${L.margenes.length} · ${L.juego.length} · ${L.carga.length})`);
  const r = await answerViaAgente({ text: q, history: [], mem: {}, scenario: ESC, callAgente: MUDO });
  const t = String(r.r.text || ""), a = r.r.agente || {};
  ok(a.estado === "encargo-compuesto", `★★ responde el ensamblador completo (${a.estado}, ${a.calls} herramientas, ${palabras(t)} palabras)`, (a.vetos || []).join(" | ").slice(0, 240));
  ok(!(a.vetos || []).some((v) => /lista-sin-corte/.test(String(v))), "★ el notario NO multa «8 de los 11»: aprueba los 8/8 únicos bajo el benchmark", (a.vetos || []).join(" | ").slice(0, 240));
  ok(/Lo primero, y cambia la decisi[oó]n/.test(t) && /- Falabella · deja/.test(t) && /esto está medido:/.test(t) && /queda abierto:/.test(t) && /\$4\.9M/.test(t) && /entrar[ií]a por Falabella/i.test(t) && /Para el directorio, en corto:/.test(t),
    "la lectura trae porqué, quiénes, demostrado/abierto, cuánto en juego, por dónde entrar y las líneas para el directorio");
  /* la lectura nombra a algunos de los 8 (los que pesan) y declara el universo real — «de los 8», el conteo del motor;
   * con las apariciones repetidas, esos mismos nombrados contaban 8 «de los 11» y el recorte declarado no coincidía */
  const dichos = ["Falabella", "Lider", "Jumbo", "Sodimac", "Ripley", "Paris", "Tottus", "Mercado Libre"].filter((e) => t.includes(e)).length;
  ok(dichos >= 2 && dichos <= 8 && /De los 8 que están bajo el benchmark/.test(t) && !/de los 11/.test(t), `nombra ${dichos} de los 8 bajo el benchmark y declara el universo real («De los 8 que están bajo el benchmark»)`);
  ok(!(a.vetos || []).length, `el expediente del turno queda sin vetos (${(a.vetos || []).length})`, (a.vetos || []).join(" | ").slice(0, 240));
}

/* ═══ 3c · LOS BORRADORES DEL MODELO, POR EL BUCLE: LA MULTA COMPLETA (owner 2026-09-13) ═════════════════════
 * «ADI no puede degradar una respuesta buena, correcta y completa por falsos positivos internos.» Los dos borradores
 * capturados en la corrida autorizada (fixtures/gerente-borradores-2026-09-13) se reproducen con un cerebro que los
 * devuelve tal cual. Lo que este caso fija:
 *   · el cierre cae por lo REAL (35-38% inventado, $4.9M como cartera entera, prioridad sin criterio) y la multa
 *     que recibe el modelo lleva TAMBIÉN lo del contrato y el notario («no es un problema de precio ni de mix» sin
 *     sello) — antes el muro cortaba primero y el modelo reparaba a ciegas la mitad;
 *   · la reparación del modelo (676 palabras) pasa el muro entero (su único veto era el falso positivo de Lider) y
 *     cae SOLO por el contrato, por lo que nunca supo: el mecanismo sin sello. Correcto, y ahora dicho a tiempo;
 *   · con esa oración sellada —lo que un modelo hace cuando se lo nombran— la reparación se SIRVE: estado
 *     «reparado», el texto del modelo en pantalla, no el respaldo. */
H("3c · ★★★ los borradores del modelo por el bucle: la multa completa, y la reparación buena se sirve");
{
  const FX = JSON.parse(readFileSync(new URL("./fixtures/gerente-borradores-2026-09-13.json", import.meta.url), "utf8"));
  const [b1, b2] = FX.borradores.map((b) => b.texto);
  const mensajesVistos = [];
  const cerebroDe = (textos) => { let i = 0; return async ({ mensajes }) => { mensajesVistos.push(mensajes); const t = textos[i++]; return { tipo: "texto", texto: t || "", stop: "end_turn" }; }; };
  const r = await answerViaAgente({ text: FX.pregunta, history: [], mem: {}, scenario: ESC, callAgente: cerebroDe([b1, b2]) });
  const a = r.r.agente || {};
  const vetos = a.vetos || [];
  ok(vetos.length >= 2 && /^cierre · /.test(vetos[0]) && /35%|37%|extremo de un rango/.test(vetos[0]), `el cierre cae por lo real (rango inventado): ${vetos[0].slice(0, 90)}…`, vetos.join(" | ").slice(0, 300));
  ok(/\(\+ [^)]*mecanismo-sin-sello/.test(vetos[0]), "★★ …y el expediente del cierre lista lo que el contrato vio (mecanismo-sin-sello) aunque el muro cortara primero", vetos[0]);
  const multaAlModelo = String((mensajesVistos[1] || []).slice(-1)[0]?.content || "");
  ok(/NOTARIO/.test(multaAlModelo) && /extremo de un rango/.test(multaAlModelo) && /mecanismo|sello/.test(multaAlModelo) && /cartera entera|SUBTOTAL|subtotal/i.test(multaAlModelo),
    "★★★ la multa que recibe el modelo es COMPLETA: rango + subtotal + mecanismo sin sello, en una sola reparación", multaAlModelo.slice(0, 400));
  ok(!/narrado como margen/.test(multaAlModelo) && !/afirma que la supera/.test(multaAlModelo) && !/apuesta deliberada/.test(multaAlModelo),
    "★★ …y NO lleva los tres falsos positivos ($99.9M como margen · Lider supera · apuesta deliberada)", multaAlModelo.slice(0, 400));
  ok(vetos.length >= 2 && /^reparacion · mecanismo-sin-sello/.test(vetos[1]), `la reparación del modelo pasa el muro entero y cae SOLO por el mecanismo sin sello (correcto): ${String(vetos[1]).slice(0, 80)}…`, vetos.join(" | ").slice(0, 300));
  ok(a.estado === "encargo-compuesto", `…y el turno cierra por el ensamblador (${a.estado}), como debe cuando la reparación sigue violando una garantía`);
  /* la reparación con la oración del mecanismo SELLADA — lo que el modelo hace cuando se lo nombran — se sirve */
  const b2sellado = b2.replace("No es un problema de precio de venta ni de mix por ahora: es un problema de carga comercial.",
    "Lo demostrado es la carga comercial; el precio de lista queda indicado y el mix, abierto.");
  const r2 = await answerViaAgente({ text: FX.pregunta, history: [], mem: {}, scenario: ESC, callAgente: cerebroDe([b1, b2sellado]) });
  const a2 = r2.r.agente || {};
  ok(a2.estado === "reparado", `★★★ con el mecanismo sellado, la reparación del modelo SE SIRVE (${a2.estado}): ${palabras(r2.r.text)} palabras del modelo en pantalla, no el respaldo`, (a2.vetos || []).join(" | ").slice(0, 300));
  ok(/Para directorio/.test(String(r2.r.text)) && /Falabella \(39\.1%\)/.test(String(r2.r.text)) && /esto es criterio mío/.test(String(r2.r.text)), "…con las 5 líneas para directorio, los markups exactos con dueño y el criterio marcado");
}

/* ═══ 3d · LA CORRIDA 3: EL MODELO OBEDECE LAS CONCLUSIONES DEL PROCEDIMIENTO Y SU REPARACIÓN SE SIRVE ═══════════
 * (owner 2026-09-13 · fixtures/gerente-borradores-2026-09-13b) Con la doctrina de conclusiones (prioridad oficial,
 * definición del subtotal, métricas comparables, lenguaje), el cierre cayó por lo REAL —nombró a Paris entre las 5
 * materiales (es Ripley), comparó markup con margen, priorizó sin criterio, negó «volumen» sin sello— y la reparación
 * corrigió TODO: Falabella primero con Lider como alternativa, «5 de 8 clientes … $4.9M», «el markup de los sanos no
 * está en la boleta», criterio marcado, 5 líneas numeradas. Cayó por tres falsos positivos, calibrados con este
 * fixture: el «N de» del universo partido por el borde de la ventana, el «supera el benchmark» cuyo sujeto es «el
 * resto de la cartera», y el «porque» de una elección declarada como criterio. */
H("3d · ★★★ la corrida 3: lo real arde en el cierre, la reparación que obedece al procedimiento SE SIRVE");
{
  const FX = JSON.parse(readFileSync(new URL("./fixtures/gerente-borradores-2026-09-13b.json", import.meta.url), "utf8"));
  const [b1, b2] = FX.borradores.map((b) => b.texto);
  const cerebroDe = (textos) => { let i = 0; return async () => { const t = textos[i++]; return { tipo: "texto", texto: t || "", stop: "end_turn" }; }; };
  const r = await answerViaAgente({ text: FX.pregunta, history: [], mem: {}, scenario: ESC, callAgente: cerebroDe([b1, b2]) });
  const a = r.r.agente || {}, vetos = a.vetos || [];
  ok(vetos.length >= 1 && /^cierre · /.test(vetos[0]) && /Paris/.test(vetos[0]), `el cierre cae por lo real: Paris entre las 5 materiales (es Ripley) — ${String(vetos[0]).slice(0, 90)}…`, vetos.join(" | ").slice(0, 300));
  ok(/mecanismo-sin-sello/.test(vetos[0]), "…y la multa completa lleva el contrato (volumen negado sin sello)", vetos[0]);   // «porque-sin-pregunta» ya no: la pregunta de la casa por la intención cuenta como concreta (2026-09-13)
  /* ── LAS CUATRO GARANTÍAS TRANSVERSALES (owner 2026-09-13, sobre esta misma reparación) ──────────────────────────
   * La reparación obedeció al procedimiento y aun así conservaba: «crecimiento con calidad deteriorada» / «se diluye la
   * calidad» (evolución temporal sin evidencia temporal), «no es teórico, es lo que ya se dejó de capturar» (brecha
   * estimada narrada como pérdida realizada), «$655K — caja que se está yendo» (naturaleza cambiada) y «el markup … más
   * pegado al costo que el de los sanos» sin las cifras de los dos lados. Las cuatro arden — y son leyes del producto,
   * no excepciones de este prompt. */
  ok(a.estado === "encargo-compuesto" && vetos.length >= 2 && /brecha-narrada-como-perdida|cifra-narrada-como-caja|deterioro-no-medido|markup-sin-el-otro-lado/.test(vetos.join(" ")),
    `★★ la reparación con las cuatro faltas de producto NO se sirve (${a.estado}): las leyes la cobran`, vetos.join(" | ").slice(0, 400));
  const { guardC } = await import("./src/adi/oracle/guardC.js");
  const { vetosDeContrato } = await import("./src/adi/agente/contratoAgente.js");
  const figsB = leer(pasosDelEncargo(partesDelEncargo(FX.pregunta), pasosDe(playbookPara(FX.pregunta, {}), FX.pregunta, {}), {}));
  const kindsB = (guardC(b2, { ledger: { figs: figsB }, results: [], question: FX.pregunta, contentScope: "full" }).violations || []).map((v) => v.kind);
  const { buildRolesCartera } = await import("./src/adi/sentrix/rolesCartera.js");
  const huellasFx = (() => { const A = buildRolesCartera(ESC); return A && A.hay ? A.huellas : []; })();
  const reglasB = vetosDeContrato(b2, { pregunta: FX.pregunta, sitio: "reparacion", figs: figsB }).map((v) => v.regla);
  ok(kindsB.includes("brecha-narrada-como-perdida"), "★ «no es teórico, es lo que ya se dejó de capturar» → brecha narrada como pérdida realizada", kindsB.join(","));
  ok(kindsB.includes("cifra-narrada-como-caja"), "★ «$655K — caja que se está yendo» → la contribución no es caja", kindsB.join(","));
  ok(reglasB.includes("deterioro-no-medido"), "★ «crecimiento con calidad deteriorada» → evolución temporal sin evidencia temporal", reglasB.join(","));
  ok(reglasB.includes("markup-sin-el-otro-lado"), "★ «markup … más pegado al costo que el de los sanos» sin cifras → comparación sin sus dos lados", reglasB.join(","));
  /* la MISMA reparación con las cuatro faltas corregidas —lo que un modelo hace cuando la multa se lo nombra— SE SIRVE */
  const b2ok = b2
    .replace("Eso es crecer volumen mientras se diluye la calidad de esa venta.", "Eso es crecer en volumen con el margen bajo el benchmark.")
    .replace("Ese es el dinero en juego — no es teórico, es lo que ya se dejó de capturar.", "Es la brecha estimada contra el benchmark: lo que sumarían esas cinco cuentas si llegaran a él.")
    .replace("$655K — caja que se está yendo en descuentos/rebates.", "$655K — contribución cedida en acciones comerciales por sobre el nivel de referencia.")
    .replace(/Hay una segunda huella, más débil \(sello "indicado", no probado\): el markup de estos mismos clientes está más pegado al costo que el de los clientes sanos\. Sodimac[^]*?aparte de la carga\./, "Hay una segunda huella, más débil (sello \"indicado\", no probado): el markup promedio de los que caen es 41.4% contra 57.3% de los sanos — el precio de lista nace más pegado al costo en estas cuentas, aparte de la carga.")
    .replace("(25.1% vs 30.1%): crecimiento con calidad deteriorada.", "(25.1% vs 30.1%): el crecimiento no llega al margen.")
    .replace("4. Ese mismo grupo muestra precio de lista más pegado al costo que el resto de la cartera — señal indicada, no aún probada, de que el problema también empieza en la lista.", "4. El markup promedio de ese grupo es 41.4% contra 57.3% de los sanos — señal indicada, no aún probada, de que el problema también empieza en la lista.")
    /* y las TRES CUESTIONES TRANSVERSALES (owner 2026-09-13, tras la corrida 5): ganar más es comparación temporal que no hay;
     * el precio (indicado) no se descarta; «deteriorada» no va sin serie */
    .replace("Estamos vendiendo más, pero no todo eso está mejorando el negocio.", "Estamos vendiendo más; si el negocio gana más no se puede saber con este dato.")
    .replace("el patrón apunta a fuga por acciones comerciales, no a un problema de costo.", "el patrón apunta a fuga por acciones comerciales; el precio de lista queda indicado y el mix, abierto.");
  ok(b2ok !== b2 && !/calidad deteriorada|se diluye|no es teórico|caja que|más pegado al costo que el de los clientes sanos|está mejorando el negocio|no a un problema de costo/.test(b2ok) && /41.4% contra 57.3%/.test(b2ok), "la reparación corregida ya no tiene las cuatro faltas (ni las tres cuestiones transversales)");
  const reglasB2 = vetosDeContrato(b2, { pregunta: FX.pregunta, sitio: "reparacion", figs: figsB, huellas: huellasFx }).map((v) => v.regla);
  ok(reglasB2.includes("ganancia-no-comparada") && reglasB2.includes("mecanismo-sin-sello"), "★ «no todo eso está mejorando el negocio» y «no a un problema de costo» (precio INDICADO) → ganancia sin comparación temporal + descarte de un mecanismo indicado", reglasB2.join(","));
  const r2 = await answerViaAgente({ text: FX.pregunta, history: [], mem: {}, scenario: ESC, callAgente: cerebroDe([b1, b2ok]) });
  const a2 = r2.r.agente || {}, t = String(r2.r.text);
  ok(a2.estado === "reparado", `★★★ la reparación que obedece al procedimiento Y a las cuatro leyes SE SIRVE (${a2.estado}): ${palabras(t)} palabras del modelo en pantalla`, (a2.vetos || []).join(" | ").slice(0, 400));
  ok(/Falabella: mayor contribución no capturada \(\$1\.6M\)/.test(t) && /Alternativa si prefieres priorizar por brecha porcentual: Lider/.test(t), "…con la prioridad oficial (Falabella) y Lider como alternativa secundaria");
  ok(/5 de 8 clientes bajo benchmark \(Falabella, Lider, Jumbo, Sodimac, Ripley\), que representan \$4\.9M/.test(t), "…con el subtotal en su definición («5 de 8 clientes … $4.9M») sin veto de alcance");
  ok(/41\.4% contra 57\.3%/.test(t), "…y la comparación de markup con sus dos lados, de la boleta");
  ok(/Para el directorio — 5 líneas/.test(t) && (t.match(/^\d\. /gm) || []).length === 5, "…y las 5 líneas para el directorio, numeradas");
}

/* ═══ 3e · LA CORRIDA 4: LA REPARACIÓN QUE CUMPLE LAS CUATRO GARANTÍAS AL PIE DE LA LETRA SE SIRVE ═══════════════
 * (owner 2026-09-13 · fixtures/gerente-borradores-2026-09-13c) Tras las cuatro garantías, el modelo obedeció con
 * NEGACIONES —«brecha estimada, no dinero perdido ni caja», «(estimado, no pérdida realizada)», «aunque no el margen más
 * bajo (ese es Líder)»— y con el rótulo de la fig («la medida para cerrar la brecha … es $4.9M»). Cinco reglas lo cobraron
 * como si afirmara lo que negaba; calibradas con este fixture. El cierre sigue cayendo por lo real («no una apuesta
 * deliberada» dictamina; «no es un problema de mix» niega sin sello). */
H("3e · ★★★ la corrida 4: las negaciones y el rótulo no son afirmaciones — la reparación que cumple las cuatro garantías SE SIRVE");
{
  const FX = JSON.parse(readFileSync(new URL("./fixtures/gerente-borradores-2026-09-13c.json", import.meta.url), "utf8"));
  const [b1, b2] = FX.borradores.map((b) => b.texto);
  const cerebroDe = (textos) => { let i = 0; return async () => { const t = textos[i++]; return { tipo: "texto", texto: t || "", stop: "end_turn" }; }; };
  /* «apunta a fuga por acciones comerciales, no a un problema de precio de lista» descarta un mecanismo INDICADO (owner
   * 2026-09-13, tras la corrida 5): la reparación tal cual ya no se sirve; corregida —el precio con su sello— sí */
  const r0 = await answerViaAgente({ text: FX.pregunta, history: [], mem: {}, scenario: ESC, callAgente: cerebroDe([b1, b2]) });
  const a0 = r0.r.agente || {};
  ok(a0.estado === "encargo-compuesto" && /reparacion · mecanismo-sin-sello: descartas como hecho el mecanismo «costo\/precio»/.test((a0.vetos || []).join(" ")), `★ la reparación que descarta el precio de lista (INDICADO) NO se sirve (${a0.estado})`, (a0.vetos || []).join(" | ").slice(0, 300));
  const b2ok = b2.replace("apunta a fuga por acciones comerciales, no a un problema de precio de lista.", "apunta a fuga por acciones comerciales; el precio de lista queda indicado y el mix, abierto.");
  ok(b2ok !== b2, "la reparación corregida deja al precio de lista con su sello");
  const r = await answerViaAgente({ text: FX.pregunta, history: [], mem: {}, scenario: ESC, callAgente: cerebroDe([b1, b2ok]) });
  const a = r.r.agente || {}, vetos = a.vetos || [], t = String(r.r.text);
  ok(vetos.length >= 1 && /^cierre · /.test(vetos[0]) && /intencion-inferida|mecanismo-sin-sello/.test(vetos[0]), `el cierre cae por lo real (dictamen de intención · mecanismo negado sin sello): ${String(vetos[0]).slice(0, 80)}…`, vetos.join(" | ").slice(0, 300));
  ok(a.estado === "reparado", `★★★ la reparación SE SIRVE (${a.estado}): ${palabras(t)} palabras del modelo en pantalla`, vetos.join(" | ").slice(0, 400));
  ok(/brecha estimada contra el benchmark, no dinero perdido ni caja/.test(t) && /\(estimado, no pérdida realizada\)/.test(t), "…con las negaciones de la casa intactas («no dinero perdido ni caja», «estimado, no pérdida realizada»)");
  ok(/aunque no el margen más bajo \(ese es Líder/.test(t) && /Líder tiene el margen más bajo de toda la cartera \(21\.5%/.test(t), "…«aunque no el margen más bajo (ese es Líder)» y «Líder tiene el margen más bajo» (verdad, con tilde) sin veto de superlativo");
  ok(/markup promedio 41\.4% en los que caen contra 57\.3% en los sanos/.test(t), "…con la comparación de markup con sus dos lados");
  ok(/¿fue apuesta de rotación o se fue de las manos\?/.test(t), "…y la pregunta de la casa al dueño cuenta como pregunta concreta");
}

/* ═══ 3f · LA CORRIDA 5: EL CONTEO QUE MANDA ES EL MÁS CERCANO A LA CIFRA ═══════════════════════════════════════════
 * (owner 2026-09-13 · fixtures/gerente-borradores-2026-09-13d) La reparación cumplía todo y fue PODADA: «De los ocho
 * clientes bajo el benchmark, cinco son materiales (…) y concentran $4.9M» y «Ocho de trece clientes …; cinco concentran
 * $4.9M» cuelgan la cifra de los CINCO, y el chequeo de alcance leía el ocho y el trece. La poda le quitó al usuario la
 * definición del $4.9M y la primera línea del directorio. Manda el conteo más cercano; «N de M» con palabras no cuenta. */
H("3f · ★★★ la corrida 5: «de los ocho …, cinco concentran $4.9M» no es colgar la cifra de los ocho — la reparación SE SIRVE entera");
{
  const FX = JSON.parse(readFileSync(new URL("./fixtures/gerente-borradores-2026-09-13d.json", import.meta.url), "utf8"));
  const [b1, b2] = FX.borradores.map((b) => b.texto);
  const cerebroDe = (textos) => { let i = 0; return async () => { const t = textos[i++]; return { tipo: "texto", texto: t || "", stop: "end_turn" }; }; };
  /* LAS TRES CUESTIONES TRANSVERSALES (owner 2026-09-13, sobre esta misma respuesta): «vendiendo más, no ganando más» sin
   * comparación temporal de contribución; «apunta a carga comercial, no a precio de lista ni a mix» con el precio INDICADO
   * y el mix ABIERTO; «negociación que se deterioró» sin evidencia temporal (y dentro de un «es si … o …»: la hipótesis no
   * absuelve esa palabra). Las tres arden en el cierre y en la reparación tal cual; corregidas, la reparación se sirve entera. */
  const r0 = await answerViaAgente({ text: FX.pregunta, history: [], mem: {}, scenario: ESC, callAgente: cerebroDe([b1, b2]) });
  const a0 = r0.r.agente || {}, v0 = a0.vetos || [];
  ok(v0.length >= 1 && /^cierre · (?:ganancia-no-comparada|mecanismo-sin-sello|deterioro-no-medido)/.test(v0[0]) && /ganancia-no-comparada/.test(v0[0]) && /deterioro-no-medido/.test(v0[0]) && /mecanismo-sin-sello/.test(v0[0]), `★★★ el cierre cae por las tres cuestiones a la vez (ganancia sin comparación · descarte de precio/mix · «se deterioró»): ${String(v0[0]).slice(0, 70)}…`, v0.join(" | ").slice(0, 400));
  ok(a0.estado === "encargo-compuesto" && /reparacion · ganancia-no-comparada: dices «no ganando más»/.test(v0.join(" ")), `★ la reparación con las tres cuestiones NO se sirve (${a0.estado})`, v0.join(" | ").slice(0, 300));
  const b2ok = b2
    .replace("**El negocio está vendiendo más, no ganando más — y son cosas distintas.**", "**El negocio está vendiendo más; si gana más no se puede saber con este dato — y son cosas distintas.**")
    .replace("el patrón apunta a carga comercial, no a precio de lista ni a mix.", "el patrón apunta a carga comercial; el precio de lista queda indicado y el mix, abierto.")
    .replace("estrategia deliberada o negociación que se deterioró.", "estrategia deliberada o negociación que quedó bajo la referencia.");
  ok(b2ok !== b2 && !/no ganando más|no a precio de lista|se deterioró/.test(b2ok), "la reparación corregida conserva la diferencia entre lo probado, lo indicado, lo abierto y lo que cambió en el tiempo");
  const r = await answerViaAgente({ text: FX.pregunta, history: [], mem: {}, scenario: ESC, callAgente: cerebroDe([b1, b2ok]) });
  const a = r.r.agente || {}, vetos = a.vetos || [], t = String(r.r.text);
  ok(a.estado === "reparado", `★★★ la reparación corregida SE SIRVE entera, sin poda (${a.estado}): ${palabras(t)} palabras`, vetos.join(" | ").slice(0, 400));
  ok(/De los ocho clientes bajo el benchmark, cinco son materiales \(Falabella, Lider, Jumbo, Sodimac, Ripley\) y concentran una brecha estimada de \$4\.9M/.test(t), "…con la definición del $4.9M en su lugar («de los ocho …, cinco son materiales … $4.9M»)");
  ok(/Ocho de trece clientes están bajo la referencia; cinco concentran una brecha estimada de \$4\.9M/.test(t), "…y la primera línea del directorio intacta («Ocho de trece …; cinco concentran … $4.9M»)");
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
