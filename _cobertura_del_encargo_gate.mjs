/* === _cobertura_del_encargo_gate.mjs · LA COBERTURA DEL ENCARGO MULTIDOMINIO (owner 2026-09-14) ═══════════════════
 * LA PRUEBA REAL EN PRODUCCIÓN (v2.28): el owner pidió «ventas + contribución + margen + unidades + inventario + cobranza
 * juntos, clientes/SKU que explican el crecimiento, stock mal ubicado, riesgo de cobranza y prioridad» y recibió solo
 * margen/contribución. El diagnóstico (offline, byte por byte igual a la captura): routing correcto (tres dominios),
 * evidencia completa en la boleta, el modelo cayó, y el respaldo «encargo-compuesto» solo conocía partes comerciales —
 * 2 de 7 cosas pedidas, ninguna de inventario ni de cobranza; ninguna ley verificaba la cobertura; el 20×3 no lo vio
 * porque ninguna de las 20 es un encargo compuesto y el gate medía dominios en la BOLETA, no en la RESPUESTA.
 *
 * LA GARANTÍA TRANSVERSAL, textual: (1) «cobertura: si el usuario pide Comercial + Inventario + Cobranza, la respuesta
 * final debe cubrir Comercial + Inventario + Cobranza, tanto si responde el modelo como si termina en respaldo»; (2) «el
 * foco no puede borrar partes explícitas del encargo… "foco" significa ordenar y jerarquizar, no eliminar dominios
 * pedidos»; (3) «una sola lectura: no quiero tres miniinformes pegados… relacionar los dominios cuando existan claves
 * válidas y terminar con una conclusión/prioridad común»; (4) «degradación segura: si el modelo cae, el respaldo puede
 * ser menos elegante, pero nunca menos completo».
 *
 * LA PRUEBA DE SALIDA, textual: dominios pedidos = dominios cubiertos · ninguna parte explícita desaparece · cruces solo
 * donde el dato los permite · prioridad final integrada · modelo y fallback cumplen la misma cobertura.
 *
 * CÓMO SE GARANTIZA: las partes del encargo viven en `partesDelEncargo.js` con su dominio (la hoja que comparten el
 * ensamblador y el contrato); el ensamblador (`encargoCompuesto.js`) compone una parte por cada cosa pedida —incluidas
 * inventario, cobranza cruzada por cliente, el cruce por SKU, quién empuja el crecimiento y las unidades— con la lectura
 * conjunta al abrir y el cierre integrado al final; el cerebro recibe la doctrina del encargo (la lista completa, «el
 * foco ordena, no elimina», las claves válidas, el cierre común) y el cruce ya no le dice «usa el otro dominio SOLO
 * cuando…»; y la ley `parte-del-encargo-omitida` (vetosDeRegistro) cobra la misma lista al cerebro y al ensamblador.
 *
 * Cero red: cerebro mudo, herramientas puras, fixtures en disco. */
import fs from "node:fs";
import { initTenant } from "./src/data/tenantStore.js";
import { TENANT_DEMO } from "./src/data/tenants/demo.js";
import { ESCENARIO_INICIAL } from "./src/config/scenarios.js";
import { answerViaAgente } from "./src/adi/agente/bucleAgente.js";
import { partesDelEncargo, coberturaDelEncargo, dominiosDelEncargo, componerEncargo, pasosDelEncargo, doctrinaDelEncargo } from "./src/adi/agente/encargoCompuesto.js";
import { esEncargoCompuesto, PARTES } from "./src/adi/agente/partesDelEncargo.js";
import { vetosDeRegistro, esEncargoCompuesto as _reexport } from "./src/adi/agente/contratoAgente.js";
import { dominiosDe, doctrinaDeCruce } from "./src/adi/agente/contratoDeDominios.js";
import { playbookPara, pasosDe } from "./src/adi/agente/playbooks/registro.js";
import { runPlan } from "./src/adi/oracle/toolRunner.js";
import { TOOLS } from "./src/adi/oracle/toolRegistry.js";
import { cajaDelAgente } from "./src/adi/agente/herramientasAgente.js";
import { guardC } from "./src/adi/oracle/guardC.js";
import { cifrasDelDato } from "./src/adi/oracle/datoProyectado.js";

let PASS = 0, FAIL = 0;
const ok = (c, m, extra = "") => { if (c) { PASS++; console.log("  ✓ " + m); } else { FAIL++; console.log("  ✗ " + m + (extra ? "\n      " + extra : "")); } };
const H = (t) => console.log(`\n${t}`);
const CAJA = cajaDelAgente(TOOLS);
const MUDO = async (a) => { MUDO.llamadas.push(a); return { tipo: "texto", texto: "", stop: "end_turn" }; };
MUDO.llamadas = [];
initTenant(TENANT_DEMO);
const FX = JSON.parse(fs.readFileSync(new URL("./fixtures/encargo-produccion-2026-09-14.json", import.meta.url), "utf8"));

/* ── LOS CASOS: el prompt de producción, tal cual, y sus equivalentes de dos y tres dominios ─────────────────────── */
const CASOS = [
  { id: "producción (3 dominios)", q: FX.pregunta, dominios: ["comercial", "inventario", "cobranza"], partes: ["foto", "crecimiento", "unidades", "quienes", "cruce-sku", "inventario", "cobranza", "sello", "primero"] },
  { id: "tres dominios, otra forma", q: "Quiero una lectura completa: cómo viene la venta y el margen, qué SKU están empujando las ventas y cuáles tienen stock frenado, quiénes me deben y qué está vencido, y por dónde partirías. Dime qué puedes demostrar y qué no.", dominios: ["comercial", "inventario", "cobranza"], partes: ["crecimiento", "cruce-sku", "inventario", "cobranza", "sello", "primero"] },
  { id: "comercial + inventario", q: "Mira ventas e inventario juntos: qué clientes están empujando el crecimiento, qué SKU tienen capital frenado sin venta detrás, si estoy acumulando stock donde no corresponde y dónde pondrías el foco primero.", dominios: ["comercial", "inventario"], partes: ["crecimiento", "quienes", "cruce-sku", "inventario", "primero"] },
  { id: "comercial + cobranza", q: "Mira ventas, margen y cobranza juntos: qué clientes están deteriorando el resultado, si mis principales clientes también me deben, cuánto está vencido y qué harías primero.", dominios: ["comercial", "cobranza"], partes: ["quienes", "cobranza", "primero"] },
];
const MARCAS = { comercial: /\bventa|\bmargen|\bcontribuci/i, inventario: /\binventario|\bstock|\bfrenad/i, cobranza: /\bcobranza|\bvencid|\bsaldo|\bpor cobrar|\bdeben?\b/i };
const CLIENTES = /\b(?:Falabella|Lider|Jumbo|Sodimac|Tottus|Paris|Easy|Ripley|La Polar|Hites|ABC|Unimarc|Mercado Libre)\b/;
const cubiertos = (t) => Object.entries(MARCAS).filter(([, re]) => re.test(t)).map(([d]) => d);
/* la boleta del turno tal como la arma el bucle (playbook + partes + dominios), para juzgar un texto con el muro */
const boletaDe = (q) => {
  const pb = playbookPara(q, {});
  const pasos = pasosDelEncargo(partesDelEncargo(q), pb ? pasosDe(pb, q, {}) : [], {});
  const rp = runPlan({ intent: "answer", calls: pasos.map((p) => ({ tool: p.tool, args: p.args || {} })) }, { scenario: ESCENARIO_INICIAL, maxCalls: 18, preguntaUsuario: q, registry: CAJA });
  return { figs: rp.ledger.figs || [], results: rp.results, pb, q };
};
const leerCon = (q) => (pasos) => runPlan({ intent: "answer", calls: (pasos || []).map((s) => ({ tool: s.tool, args: s.args || {} })) }, { scenario: ESCENARIO_INICIAL, maxCalls: 18, preguntaUsuario: q, registry: CAJA }).ledger.figs || [];

/* ═══ 0 · EL FIXTURE Y EL DIAGNÓSTICO, CONGELADOS ═════════════════════════════════════════════════════════════════ */
H("0 · el caso real de producción, congelado: lo que el usuario pidió y lo que recibió");
{
  ok(FX.tenant === "demo" && /^Estoy vendiendo más/.test(FX.pregunta) && FX.respuesta_observada.estado === "encargo-compuesto", `la respuesta observada salió del respaldo «encargo-compuesto» (${FX.respuesta_observada.estado})`);
  const obs = FX.respuesta_observada.texto;
  ok(cubiertos(obs).join(",") === "comercial", `★ ANTES: la respuesta observada cubría solo ${cubiertos(obs).join("+")} de ${FX.dominios_pedidos.join("+")}`);
  ok(dominiosDe(FX.pregunta).dominios.join(",") === "comercial,inventario,cobranza", "el routing ya detectaba los tres dominios (no era routing)");
  ok(esEncargoCompuesto(FX.pregunta) && _reexport === esEncargoCompuesto, "es un encargo compuesto, y contratoAgente re-exporta el mismo detector de la hoja (una regla, un archivo)");
}

/* ═══ 1 · LAS PARTES POR DOMINIO ═══════════════════════════════════════════════════════════════════════════════════ */
H("1 · las partes pedidas se reconocen por dominio, y la batería comercial de la 2.27 no cambia");
{
  for (const c of CASOS) {
    const p = partesDelEncargo(c.q);
    ok(p.map((x) => x.clave).join(",") === c.partes.join(","), `${c.id} → ${p.map((x) => x.clave).join(" → ")}`, p.map((x) => x.clave).join(","));
    ok(dominiosDelEncargo(p).join(",") === c.dominios.join(","), `…en ${c.dominios.join(" + ")}`);
  }
  const claves = (q) => partesDelEncargo(q).map((p) => p.clave).join(",");
  ok(claves("Dime cómo va el negocio, qué está explicando el resultado, qué clientes presionan más el margen, qué puedes demostrar y qué harías primero. Al final resúmelo para directorio.") === "foto,porque,quienes,sello,primero", "el encargo ejecutivo de la 2.27 sigue igual: foto → porqué → quiénes → sello → primero");
  ok(claves("Estoy vendiendo más pero siento que gano menos. Quiero que confirmes si es cierto, me digas por qué, si viene de precio, costo, mix o acciones comerciales, qué clientes están detrás y qué información te falta.") === "veredicto,porque,quienes,sello", "…y el causal: veredicto → porqué → quiénes → sello (sin partes de dominio que no pidió)");
  ok(claves("¿Cuánto vende SAM-TV55 y cuánto stock tiene?") === "" && claves("¿Los SKU que más vendo son los que tienen más capital en inventario?") === "", "una pregunta simple de dos dominios NO es un encargo: el ensamblador y la ley no se activan (la selectividad sigue permitida)");
  ok(PARTES.every((p) => p.cubre instanceof RegExp && p.dominio && p.nombre), "cada parte declara dominio, nombre y las marcas con las que se verifica su cobertura");
}

/* ═══ 2 · CEREBRO MUDO: EL RESPALDO CUBRE TODO LO PEDIDO, EN UNA SOLA LECTURA ═════════════════════════════════════ */
H("2 · con el cerebro mudo, el respaldo cubre todos los dominios y todas las partes pedidas, relaciona solo por claves válidas y cierra con una prioridad común");
const SALIDAS = {};
for (const c of CASOS) {
  MUDO.llamadas = [];
  const r = await answerViaAgente({ text: c.q, history: [], mem: {}, scenario: ESCENARIO_INICIAL, callAgente: MUDO });
  const t = r.r.text;
  SALIDAS[c.id] = { t, r, llamadas: MUDO.llamadas.slice() };
  const partes = partesDelEncargo(c.q);
  const faltan = coberturaDelEncargo(t, partes);
  console.log(`  — ${c.id}: [${r.r.agente.estado}] ${t.length} chars`);
  ok(r.r.agente.estado === "encargo-compuesto", `   el turno lo responde el ensamblador (${r.r.agente.estado})`, t.slice(0, 120));
  ok(cubiertos(t).join(",") === c.dominios.join(","), `   ★ dominios pedidos = dominios cubiertos (${cubiertos(t).join(" + ")})`);
  ok(faltan.length === 0, `   ★ ninguna parte explícita desaparece (${partes.length} partes)`, faltan.map((p) => p.clave).join(","));
  ok(/^Lectura conjunta de /.test(t), "   abre con la lectura conjunta: qué se relaciona y por qué clave");
  if (c.dominios.includes("inventario")) {
    ok(/período cerrado/.test(t) && /foto de inventario/.test(t), "   el cruce por SKU va con sus dos marcos (período cerrado · foto de inventario)");
    ok(!new RegExp(`${CLIENTES.source}[^.\\n]{0,80}\\b(?:stock|inventario|frenad)`, "i").test(t), "   ningún cliente queda relacionado con el inventario (esa clave no existe en el archivo)");
  }
  if (c.dominios.includes("cobranza")) ok(/Tus principales clientes por venta, con su saldo y su vencido al lado/.test(t), "   la cobranza va cruzada por cliente con la venta (clave real: la misma cuenta)");
  ok(/Dónde pondría el foco primero — /.test(t) && (t.match(/^Criterio:/gm) || []).length === 1, "   ★ cierra con UNA prioridad integrada y su criterio dicho");
  ok(!/¿Lo abrimos por|Dime y lo abrimos|Si igual quieres verlo/.test(t), "   una sola lectura: sin ofertas de cierre de cada parte");
  ok(r.r.agente.vetos.length === 0, "   el ensamblador pasó el muro, el contrato y la notarial sin vetos", JSON.stringify(r.r.agente.vetos).slice(0, 200));
}
{
  const t = SALIDAS["producción (3 dominios)"].t;
  ok(/Quién empuja el crecimiento/.test(t) && /Lider · \+\$2\.3M/.test(t) && /Quién cae:/.test(t) && /Ripley · -\$422K/.test(t), "producción: quién empuja el crecimiento (Lider +$2.3M) y quién cae (Ripley −$422K), contra el año anterior");
  ok(/Unidades vendidas en el período/.test(t) && /Jumbo · 1194 unidades/.test(t), "producción: las unidades vendidas por cliente (Jumbo 1194)");
  ok(/Entre los que más venden no aparece capital frenado: el capital frenado está en LG-DRYER8KG, BOS-SANDER, MAK-COMP-AIR/.test(t), "producción: el cruce por SKU dice dónde está el frenado — SKU, no bodegas");
  ok(/Falabella · venta \$19\.4M · saldo \$8\.2M · vencido \$2\.5M/.test(t) && /Lider · venta \$17\.8M · saldo \$9\.8M · vencido \$4\.6M/.test(t), "producción: los principales clientes con su saldo y su vencido al lado");
  ok(/^1\. Lider — /m.test(t) && /antes que Falabella: más grave en comercial, distancia al benchmark \(8\.6 pp contra 8\.1 pp\); en cobranza, vencido \(\$4\.6M contra \$2\.5M\)/.test(t), "★ producción: la prioridad integrada abre con Lider, por señales (materialidad + severidad + urgencia), no por «coincide en dos dominios» (ver _prioridad_integrada_gate)");
  ok(/En inventario \(clave SKU: no se compara con las cuentas\): LG-DRYER8KG primero — \$14K frenados, 165d de inventario, 94d sin venta/.test(t), "…y el inventario entra aparte, con su clave y sus lentes (LG-DRYER8KG, $14K, 165d, 94d sin venta)");
  ok(/Lo que puedo demostrar y lo que no/.test(t) && /queda localizado, no explicado/.test(t), "…y lo demostrado, lo indicado y lo abierto siguen separados");
}

/* ═══ 3 · LA MISMA LEY PARA EL MODELO Y PARA EL RESPALDO ═══════════════════════════════════════════════════════════ */
H("3 · la ley «parte-del-encargo-omitida» cobra la misma lista al cerebro y al ensamblador; una pregunta simple no la tiene");
{
  const q = FX.pregunta;
  const v = vetosDeRegistro(FX.respuesta_observada.texto, { pregunta: q, figs: [], sitio: "cierre" });
  const om = v.find((x) => x.regla === "parte-del-encargo-omitida");
  ok(!!om, "★ la respuesta observada en producción arde por «parte-del-encargo-omitida»", v.map((x) => x.regla).join(","));
  ok(om && /«el inventario: dónde hay capital frenado»/.test(om.multa) && /«la cobranza: quién debe y qué está vencido»/.test(om.multa) && /«los SKU: venta y contribución frente a su inventario»/.test(om.multa) && /«las unidades vendidas»/.test(om.multa), "…y la multa nombra lo que faltó: inventario, cobranza, los SKU y las unidades", om && om.multa.slice(0, 300));
  ok(om && /el foco ordena y jerarquiza, no elimina/.test(om.multa), "…con la ley del owner en la multa");
  ok(!vetosDeRegistro(SALIDAS["producción (3 dominios)"].t, { pregunta: q, figs: [], sitio: "encargo-compuesto" }).some((x) => x.regla === "parte-del-encargo-omitida"), "★ el texto del ensamblador pasa la misma ley (modelo y fallback, la misma cobertura)");
  /* un borrador del modelo que cubre todo, dicho a su manera, pasa */
  const borrador = "Sí crece, pero no todo el crecimiento es sano. La venta sube +7.5% contra el año anterior y la empujan Lider (+$2.3M) y Jumbo (+$1.9M); Ripley y La Polar caen. En unidades, Jumbo mueve 1194 y Falabella 1042. El margen queda en 25.1%, 5.0 pp bajo el benchmark: Falabella deja $1.6M sin capturar. En inventario no estás acumulando stock en lo que vende: los SKU que más venden (SAM-TV55, LG-WASH11KG) rotan en menos de 60 días; el capital frenado está en LG-DRYER8KG ($14K, 165d). En cobranza, Lider tiene $4.6M vencidos a 269d y Falabella $2.5M. Primero: Falabella — contribución sin capturar y vencido en la misma cuenta. Está medido lo anterior; el porqué del vencido y de los frenados queda abierto.";
  ok(!vetosDeRegistro(borrador, { pregunta: q, figs: [], sitio: "cierre" }).some((x) => x.regla === "parte-del-encargo-omitida"), "un borrador del modelo que cubre todo, con sus palabras, no arde");
  const parcial = borrador.replace(" En cobranza, Lider tiene $4.6M vencidos a 269d y Falabella $2.5M.", "").replace("vencido en la misma cuenta", "la mayor contribución en juego").replace("el porqué del vencido y de los frenados", "el porqué de los frenados");
  ok(!/cobranza|vencid|saldo|deben?\b/i.test(parcial), "(la carnada parcial de verdad no dice nada de cobranza)");
  const vp = vetosDeRegistro(parcial, { pregunta: q, figs: [], sitio: "cierre" }).find((x) => x.regla === "parte-del-encargo-omitida");
  ok(vp && /«la cobranza: quién debe y qué está vencido»/.test(vp.multa) && !/«el inventario/.test(vp.multa), "…y el mismo borrador sin la cobranza arde SOLO por la cobranza", vp && vp.multa.slice(0, 200));
  ok(!vetosDeRegistro("Los SKU que más venden, con su inventario: SAM-TV55 vende $13.3M · stock $13K.", { pregunta: "¿Cuánto vende SAM-TV55 y cuánto stock tiene?", figs: [], sitio: "cierre" }).some((x) => x.regla === "parte-del-encargo-omitida"), "una pregunta simple no tiene ley de cobertura: responder selectivamente sigue bien");
  ok(!vetosDeRegistro(FX.respuesta_observada.texto, { pregunta: q, figs: [], sitio: "playbook:cruce-por-sku" }).some((x) => x.regla === "parte-del-encargo-omitida"), "a los peldaños de abajo (el último recurso) no se les cobra: quitarles la respuesta parcial dejaría al usuario sin nada");
}

/* ═══ 4 · LO QUE RECIBE EL CEREBRO ═════════════════════════════════════════════════════════════════════════════════ */
H("4 · el cerebro recibe la lista completa de lo pedido y la ley del foco; el cruce ya no le dice «usa el otro dominio SOLO cuando…»");
{
  const { llamadas } = SALIDAS["producción (3 dominios)"];
  const contenidos = (llamadas[0] ? llamadas[0].mensajes : []).map((m) => String(m.content || ""));
  const de = contenidos.find((c) => c.startsWith("[ENCARGO COMPUESTO"));
  ok(!!de, "viaja la doctrina del encargo");
  ok(de && /pidió 9 cosas en 3 dominios \(comercial \+ inventario \+ cobranza\)/.test(de) && /LA RESPUESTA LAS CUBRE TODAS/.test(de) && /el foco ordena y jerarquiza, no elimina/.test(de), "…con las 9 cosas, los 3 dominios y la ley del foco", de && de.slice(0, 200));
  ok(de && /- la cobranza: quién debe y qué está vencido/.test(de) && /- el inventario: dónde hay capital frenado/.test(de) && /- las unidades vendidas/.test(de), "…y cada parte nombrada, inventario y cobranza incluidas");
  ok(de && /por SKU/.test(de) && /por cliente/.test(de) && /Cliente ↔ inventario y bodega ↔ venta no existen/.test(de) && /la de cada dominio y la integrada del negocio/.test(de), "…con las claves válidas, las que no existen y el cierre: la prioridad de cada dominio y la integrada");
  ok(de && /El entregable del procedimiento activo es UNA de las partes; el entregable del turno es el encargo completo/.test(de), "…y el entregable del procedimiento (la ficha del cruce) queda como UNA parte, no como el turno");
  const cruce = contenidos.find((c) => c.startsWith("[CRUCE DE DOMINIOS"));
  ok(cruce && /pedidos explícitamente por el usuario: todos entran en la respuesta/.test(cruce) && !/SOLO cuando cambie/.test(cruce), "★ el cruce, en un encargo, dice «todos entran; el foco los ordena», no «SOLO cuando cambie la lectura»");
  ok(/SOLO cuando cambie o explique la lectura/.test(doctrinaDeCruce({ dominios: ["comercial", "inventario"], eje: null })), "…y en una pregunta simple de dos dominios conserva la doctrina de siempre (el otro dominio solo si cambia la lectura)");
  ok(doctrinaDelEncargo(partesDelEncargo("¿Cómo va el negocio?"), []) === "", "sin encargo no hay doctrina del encargo");
}

/* ═══ 5 · EL ENSAMBLADOR, DE FRENTE: DEGRADACIÓN SEGURA ════════════════════════════════════════════════════════════ */
H("5 · degradación segura: la parte sin evidencia se declara en una línea y el resto sigue; el muro juzga el texto entero");
{
  const q = FX.pregunta;
  const partes = partesDelEncargo(q);
  const leer = leerCon(q);
  const sinCobranza = (pasos) => (pasos.some((p) => p.tool === "cobranza") ? [] : leer(pasos));
  const t = componerEncargo({ partes, leer: sinCobranza, scenario: ESCENARIO_INICIAL, mem: {}, semilla: "s", pregunta: q });
  ok(t && /Sobre la cobranza: quién debe y qué está vencido no pude armar la lectura con lo leído en este turno/.test(t), "sin la evidencia de cobranza, la parte se declara en una línea (no desaparece, no se inventa)");
  ok(t && coberturaDelEncargo(t, partes).length === 0, "…y esa declaración cuenta como cobertura: la ley no arde");
  ok(t && /inventario → LG-DRYER8KG/.test(t) && !/cobranza → /.test(t) && /^1\. Falabella — /m.test(t), "…y el cierre integrado ordena con lo que hay (inventario sí, cobranza no): sin señal de tiempo entre las cuentas, manda la materialidad (Falabella)");
  const b = boletaDe(q);
  const completo = componerEncargo({ partes, leer, scenario: ESCENARIO_INICIAL, mem: {}, semilla: `demo::${q}::0`, pregunta: q });   // la semilla del bucle: tenant::pregunta::largo del hilo
  const v = guardC(completo, { ledger: { figs: b.figs }, results: b.results, question: q, datoProyectado: cifrasDelDato(ESCENARIO_INICIAL), contentScope: "full" });
  ok(v.ok, "el texto completo del ensamblador pasa el muro con la boleta del turno", (v.violations || []).map((x) => x.kind + ": " + String(x.detail).slice(0, 100)).join(" | "));
  ok(completo === SALIDAS["producción (3 dominios)"].t, "…y es byte por byte lo que el turno mudo sirvió (determinístico)");
}

/* ═══ 6 · EL CAMINO DEL MODELO, DE PUNTA A PUNTA, CON LOS BORRADORES VIVOS COMO CEREBRO ═══════════════════════════ */
H("6 · la corrida en vivo (autorizada, 2 llamadas) como fixture: el modelo cubrió todo; lo que lo tumbó y lo que se cerró");
{
  const V = JSON.parse(fs.readFileSync(new URL("./fixtures/encargo-vivo-2026-09-14.json", import.meta.url), "utf8"));
  const q = V.pregunta;
  ok(q === FX.pregunta && V.borradores.length === 2 && V.final.estado === "encargo-compuesto", "la corrida: el prompt exacto, dos borradores del modelo, y el usuario recibió el ensamblador (completo)");
  const partes = partesDelEncargo(q);
  for (const b of V.borradores) ok(coberturaDelEncargo(b.texto, partes).length === 0 && cubiertos(b.texto).join(",") === "comercial,inventario,cobranza", `★ el borrador ${b.n} del modelo cubre las ${partes.length} partes y los 3 dominios en una sola lectura (la doctrina del encargo funcionó)`);
  const b2 = V.borradores[1].texto;
  ok(/Dónde pondría el foco primero/.test(b2) && /Lider/.test(b2.slice(b2.indexOf("Dónde pondría el foco primero"))), "…y cierra con una prioridad integrada (Lider: crecimiento + margen + vencido en la misma cuenta)");
  /* lo que lo tumbó, juzgado offline con la boleta del turno */
  const b = boletaDe(q);
  const muro = (t) => { const v = guardC(t, { ledger: { figs: b.figs }, results: b.results, question: q, datoProyectado: cifrasDelDato(ESCENARIO_INICIAL), contentScope: "full" }); return v.ok ? [] : (v.violations || []); };
  const v2 = muro(b2);
  ok(v2.length === 1 && v2[0].kind === "cifra-no-autorizada" && String(v2[0].detail) === "250 d", "el borrador reparado cae SOLO por «250 d»: «más de 250 días» es una cifra redondeada que no existe en la boleta (269d y 251d) — veto legítimo", v2.map((x) => x.kind + ": " + String(x.detail).slice(0, 80)).join(" | "));
  ok(!muro(V.borradores[0].texto).some((x) => /narrado como/.test(String(x.detail))), "★ los dos falsos positivos del muro en el primer borrador quedaron cerrados: «$4.4M narrado como carga» (la métrica dueña va justo después: «al componente de precio y costo») y «24.0% narrado como variación» (la cifra cierra un paréntesis)", muro(V.borradores[0].texto).map((x) => x.kind + ": " + String(x.detail).slice(0, 90)).join(" | "));
  const corregido = b2.replace("el vencido de Lider y Sodimac con más de 250 días", "el vencido de Lider (269 días) y Sodimac (251 días)");
  ok(muro(corregido).length === 0 && !vetosDeRegistro(corregido, { pregunta: q, figs: b.figs, sitio: "cierre" }).length, "★ el mismo borrador con las cifras tal cual están en la boleta pasa el muro y el contrato enteros");
  ok(muro("Tu carga comercial es $4.4M en total.").some((x) => x.kind === "metrica-mal-atribuida") && muro("Jumbo crece 24.0% este año.").some((x) => x.kind === "metrica-mal-atribuida"), "candados: «tu carga comercial es $4.4M» y «Jumbo crece 24.0%» siguen ardiendo (la mención de antes atribuye como siempre)");
  /* el camino del modelo entero, offline: un cerebro que devuelve el borrador vivo y, con la multa, la versión corregida */
  const recibido = [];
  const cerebro = async ({ mensajes, attempt }) => {
    recibido.push({ attempt, ultimo: String(([...(mensajes || [])].reverse().find((m) => m && m.role === "user") || {}).content || "") });
    return { tipo: "texto", texto: attempt === 0 ? b2 : corregido, stop: "end_turn" };
  };
  const r = await answerViaAgente({ text: q, history: [], mem: {}, scenario: ESCENARIO_INICIAL, callAgente: cerebro });
  ok(r.r.agente.estado === "reparado" && r.r.text === corregido, `★ con la multa explicada, la reparación del modelo se sirve entera (${r.r.agente.estado}): el usuario recibe la lectura del modelo, no el respaldo`, r.r.agente.estado + " · " + JSON.stringify(r.r.agente.vetos).slice(0, 200));
  const multa = (recibido.find((x) => x.attempt === 1) || {}).ultimo;
  ok(/«250 d» no está en tus resultados: ni inventada ni redondeada/.test(multa), "…porque la multa ya no dice «250 d» a secas: explica la regla (ni inventada ni redondeada, tal cual está en la boleta)", String(multa).slice(0, 200));
  ok(coberturaDelEncargo(r.r.text, partes).length === 0 && cubiertos(r.r.text).join(",") === "comercial,inventario,cobranza", "★ modelo y respaldo cumplen la misma cobertura: dominios pedidos = dominios cubiertos, ninguna parte desaparece");
}

console.log(`\n── _cobertura_del_encargo_gate: ${PASS} PASS · ${FAIL} FAIL (de ${PASS + FAIL}) ──`);
process.exit(FAIL ? 1 : 0);
