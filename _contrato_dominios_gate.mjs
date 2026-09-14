/* === _contrato_dominios_gate.mjs · EL CONTRATO DE DOMINIOS (owner 2026-09-14) ══════════════════════════════════════
 * LA LEY, textual: «La pregunta determina qué dominios participan; cada dominio aporta su realidad suficiente; ADI solo
 * relaciona aquello que el archivo demuestra que puede relacionarse.» — «Quiero composición, no exclusión.»
 *
 * LA PRUEBA DE PRODUCTO que el owner pidió: las mismas 20 preguntas cruzadas de la auditoría × 3 datasets (demo ·
 * plantilla de ejemplo · la completa del owner si está en esta máquina), offline y con cerebro MUDO — lo que mide es
 * el PISO: qué dominios entran a la boleta, que ningún playbook de un solo dominio secuestre la pregunta, qué cruces
 * deja pasar y cuáles bloquea el muro según lo que declara cada archivo, que las unidades estén, y el tamaño.
 *
 * ANTES (medido 2026-09-14): dominios en la boleta 2/20 en los tres datasets; 7/20 respondían «capital frenado» a
 * preguntas de venta × inventario; 0 cifras de unidades en toda pregunta comercial; el muro bloqueaba en una planilla
 * «vende $14K frente a $28K en stock» con la razón del demo («la venta va en miles»).
 *
  * Cero red: cerebro mudo, herramientas puras. */
import fs from "node:fs";
import { initTenant } from "./src/data/tenantStore.js";
import { TENANT_DEMO } from "./src/data/tenants/demo.js";
import { ESCENARIO_INICIAL } from "./src/config/scenarios.js";
import { answerViaAgente, TECHO_ENTRADA_CIERRE_CHARS } from "./src/adi/agente/bucleAgente.js";
import { dominiosDe, pasosDeDominios, unirPasosDeDominios, doctrinaDeCruce } from "./src/adi/agente/contratoDeDominios.js";
import { playbookPara } from "./src/adi/agente/playbooks/registro.js";
import { runPlan } from "./src/adi/oracle/toolRunner.js";
import { TOOLS } from "./src/adi/oracle/toolRegistry.js";
import { cajaDelAgente } from "./src/adi/agente/herramientasAgente.js";
import { guardC } from "./src/adi/oracle/guardC.js";
import { reconcilian, compatibilidadActiva } from "./src/config/contract/figureType.js";
import { METRICS } from "./src/config/contract/metricRegistry.js";
import { plantillaEjemplo } from "./src/ingesta/plantilla/generarPlantilla.js";
import { ingestarPlantilla } from "./src/ingesta/plantilla/ingestarPlantilla.js";
import { mapaDelDato } from "./src/adi/agente/mapaDelDato.js";
import { catalogoAgente } from "./src/adi/agente/catalogoAgente.js";

let PASS = 0, FAIL = 0;
const ok = (c, m, extra = "") => { if (c) { PASS++; console.log("  ✓ " + m); } else { FAIL++; console.log("  ✗ " + m + (extra ? "\n      " + extra : "")); } };
const H = (t) => console.log(`\n${t}`);
const CAJA = cajaDelAgente(TOOLS);
const MUDO = async () => ({ tipo: "texto", texto: "", stop: "end_turn" });

/* ── LAS 20 PREGUNTAS DE LA AUDITORÍA, con los dominios que cada una nombra ─────────────────────────────────────── */
const PREGUNTAS = [
  ["¿Los SKU que más vendo son los que tienen más capital en inventario?", ["comercial", "inventario"]],
  ["¿Cuánto inventario tengo de los 5 SKU que más venden?", ["comercial", "inventario"]],
  ["¿Qué SKU dejan contribución pero tienen capital frenado?", ["comercial", "inventario"]],
  ["¿Estoy sosteniendo stock en productos que no dejan margen?", ["comercial", "inventario"]],
  ["¿Cuántos días de inventario tengo en los SKU con margen bajo el benchmark?", ["comercial", "inventario"]],
  ["¿Qué marca vende más y cuánto capital tiene en inventario?", ["comercial", "inventario"]],
  ["¿Qué familia tiene más stock respecto de lo que vende?", ["comercial", "inventario"]],
  ["¿Los clientes que más compran son los que tienen capital detenido?", ["comercial", "inventario"]],
  ["¿Cuánto vende la bodega Santiago?", ["comercial", "inventario"]],
  ["Mira ventas, margen e inventario juntos: ¿dónde está el problema?", ["comercial", "inventario"]],
  ["¿Cuántas unidades vendimos este año?", ["comercial"]],
  ["¿Vendí más unidades o solo subió el precio?", ["comercial"]],
  ["¿Qué cliente compra más unidades?", ["comercial"]],
  ["¿A qué precio promedio le vendo a Falabella?", ["comercial"]],
  ["¿Cuántas unidades vendí de cada marca?", ["comercial"]],
  ["¿Los clientes que más me deben son los que más compran?", ["comercial", "cobranza"]],
  ["¿Cuánto me debe Falabella y cuánto le vendo?", ["comercial", "cobranza"]],
  ["¿Qué clientes tienen margen bajo y además me deben?", ["comercial", "cobranza"]],
  ["¿Cuánto vendí a crédito y cuánto está pendiente por cliente?", ["comercial", "cobranza"]],
  ["¿Qué parte de mi contribución todavía no la he cobrado?", ["comercial", "cobranza"]],
];
const DOM_RE = {
  comercial: /(?<!in)venta|factur|m[aá]rgen|contribuci|carga|acciones|benchmark|precio|costo|markup|brecha/i,
  inventario: /capital|stock|rotaci|d[ií]as de inventario|inmoviliz|frenad|bodega|sin venta|quiebre|sobrestock|Cobertura \(DOH\)/i,
  cobranza: /saldo|abonad|vencid|cr[eé]dito|por cobrar/i,
};
const parseResultados = (c) => {
  const j = c.indexOf("[", c.indexOf("Resultados:"));
  let depth = 0, k = -1, inStr = false, esc = false;
  for (let i = j; i < c.length; i++) { const ch = c[i]; if (inStr) { if (esc) esc = false; else if (ch === "\\") esc = true; else if (ch === '"') inStr = false; continue; } if (ch === '"') inStr = true; else if (ch === "[" || ch === "{") depth++; else if (ch === "]" || ch === "}") { depth--; if (depth === 0) { k = i; break; } } }
  try { return JSON.parse(c.slice(j, k + 1)); } catch { return null; }
};
async function medir(q) {
  const labels = new Set(); let chars = 0, doctrinaCruce = false;
  const mudo = async ({ mensajes }) => {
    for (const m of mensajes || []) {
      const c = String((m && m.content) || "");
      if (/^\[HERRAMIENTAS — no es el usuario\] Resultados:/.test(c)) { chars = Math.max(chars, c.length); for (const r of parseResultados(c) || []) for (const f of r.cifras || []) labels.add(String(f.label)); }
      if (/^\[CRUCE DE DOMINIOS — no es el usuario\]/.test(c)) doctrinaCruce = true;
    }
    return { tipo: "texto", texto: "", stop: "end_turn" };
  };
  const r = await answerViaAgente({ text: q, history: [], mem: {}, scenario: ESCENARIO_INICIAL, callAgente: mudo });
  const L = [...labels];
  const doms = Object.entries(DOM_RE).filter(([, re]) => L.some((l) => re.test(l))).map(([d]) => d);
  return { a: r.r.agente || {}, texto: String(r.r.text || ""), labels: L, doms, chars, doctrinaCruce, unidades: L.some((l) => /Unidades vendidas|Efecto volumen/i.test(l)) };
}

const DATASETS = [
  ["DEMO", () => TENANT_DEMO],
  ["PLANTILLA ejemplo", () => ingestarPlantilla(Buffer.from(plantillaEjemplo()), { nombreArchivo: "v2.xlsx", fechaCarga: "2026-08-31" }).dataset],
];
const REAL = "C:/Users/jcnav/Downloads/Plantilla_ADI_v2_completa_25_clientes_ajustada.xlsx";
if (fs.existsSync(REAL)) DATASETS.push(["COMPLETA del owner", () => ingestarPlantilla(fs.readFileSync(REAL), { nombreArchivo: "completa.xlsx", fechaCarga: "2026-09-01" }).dataset]);

/* ═══ 1 · LA PREGUNTA DETERMINA QUÉ DOMINIOS PARTICIPAN ═══════════════════════════════════════════════════════════ */
H("1 · la pregunta determina qué dominios participan (léxico, determinístico) — composición, no exclusión");
{
  initTenant(TENANT_DEMO);
  for (const [q, esperados] of PREGUNTAS) {
    const d = dominiosDe(q).dominios;
    ok(esperados.every((e) => d.includes(e)), `«${q.slice(0, 60)}» → ${d.join("+") || "—"}`, `esperaba ${esperados.join("+")}`);
  }
  ok(dominiosDe("¿Dónde está frenado mi capital?").dominios.join() === "inventario", "una pregunta solo de inventario trae SOLO inventario: la base comercial no viaja gratis");
  ok(dominiosDe("quién me debe y qué está vencido").dominios.join() === "cobranza", "una pregunta solo de cobranza trae SOLO cobranza");
  ok(dominiosDe("¿Cómo van las ventas?").dominios.join() === "comercial", "una pregunta solo comercial trae SOLO comercial");
  ok(dominiosDe("¿qué es el margen bruto?").dominios.length === 0 && dominiosDe("hola").dominios.length === 0, "definiciones y saludos no hacen participar a ningún dominio");
  ok(dominiosDe("¿Qué marca vende más y cuánto capital tiene en inventario?").eje === "marca" && dominiosDe("¿Cuánto vende la bodega Santiago?").eje === "bodega", "…y el eje nombrado (marca/familia/canal/bodega) viaja con los dominios");
}

/* ═══ 2 · CADA DOMINIO APORTA SU REALIDAD SUFICIENTE ═════════════════════════════════════════════════════════════ */
H("2 · cada dominio aporta su realidad suficiente: los pasos de Inventario (10 capítulos) y las unidades de Comercial");
{
  initTenant(TENANT_DEMO);
  const inv = pasosDeDominios({ dominios: ["inventario"], eje: null });
  const firma = (p) => `${p.tool}${JSON.stringify(p.args)}`;
  ok(inv.some((p) => firma(p) === 'inventoryStatus{"focus":"estado"}') && inv.some((p) => firma(p) === 'inventoryStatus{"focus":"frenado"}'), "Inventario: la foto completa (estado) y el capital frenado");
  ok(inv.some((p) => firma(p) === 'queryMetric{"metric":"capital","dimension":"sku"}') && inv.some((p) => firma(p) === 'queryMetric{"metric":"doh","dimension":"sku"}') && inv.some((p) => firma(p) === 'queryMetric{"metric":"stock","dimension":"sku"}') && inv.some((p) => firma(p) === 'queryMetric{"metric":"capital","dimension":"bodega"}'),
    "…capital, días y unidades en stock por SKU, y capital por bodega");
  ok(!inv.some((p) => p.tool === "tensionRead" || (p.args && p.args.focus === "top_sellers")), "…y el cruce por SKU NO viaja cuando Comercial no participa");
  const ambos = pasosDeDominios({ dominios: ["comercial", "inventario"], eje: null });
  ok(ambos.some((p) => firma(p) === 'inventoryStatus{"focus":"top_sellers"}') && ambos.some((p) => firma(p) === 'tensionRead{"dimension":"sku"}'), "con Comercial e Inventario juntos, el cruce por SKU (venta × stock · contribución × capital) sí viaja");
  ok(ambos.some((p) => firma(p) === 'queryMetric{"metric":"unidades","dimension":"cliente"}'), "Comercial trae las unidades vendidas por cliente (owner: «no debe quedar en 0 cifras»)");
  const marca = pasosDeDominios({ dominios: ["comercial", "inventario"], eje: "marca" });
  ok(marca.some((p) => firma(p) === 'queryMetric{"metric":"capital","dimension":"marca"}') && marca.some((p) => firma(p) === 'queryMetric{"metric":"ventas","dimension":"marca"}') && !marca.some((p) => p.tool === "rolesCartera"),
    "por otro eje (marca) cada dominio aporta su lectura por ESE eje — no las trece cuentas");
  const bod = pasosDeDominios({ dominios: ["comercial", "inventario"], eje: "bodega" });
  ok(!bod.some((p) => p.args && p.args.metric === "ventas"), "por bodega no hay venta en el archivo: Comercial no inventa una lectura por bodega");
  ok(METRICS.unidades && METRICS.unidades.sourceByAxis.cliente && METRICS.stock && METRICS.capital.sourceByAxis.marca, "el contrato declara `unidades`, `stock` y capital por marca sobre campos que el dato ya trae");
  const unidos = unirPasosDeDominios([{ tool: "queryMetric", args: { metric: "capital", dimension: "bodega" } }], ambos);
  ok(unidos.filter((p) => p.tool === "queryMetric").length === ambos.filter((p) => p.tool === "queryMetric").length, "la unión distingue cortes distintos de la misma herramienta (queryMetric por SKU y por bodega no se pisan)");
  const map = mapaDelDato();
  ok(/unidades vendidas/.test(map) && /unidades en stock/.test(map), "el mapa del dato declara las unidades vendidas y las unidades en stock al cerebro");
  const cat = catalogoAgente();
  const tr = cat.find((t) => t.name === "tensionRead"), is = cat.find((t) => t.name === "inventoryStatus");
  ok(tr && /CRUCE/.test(tr.description) && /contribuci/i.test(tr.description), "el catálogo le dice al cerebro qué cruza `tensionRead`");
  ok(is && /top_sellers/.test(JSON.stringify(is.input_schema)) && /estado/.test(JSON.stringify(is.input_schema)), "…y los focos de `inventoryStatus`, con `top_sellers` y `estado` en el enum");
}

/* ═══ 3 · LA COMPATIBILIDAD LA DECLARA EL ARCHIVO ════════════════════════════════════════════════════════════════ */
H("3 · la compatibilidad entre universos la declara el pack: divergente en el demo, comparable en una planilla");
{
  initTenant(TENANT_DEMO);
  const d = reconcilian("venta_comercial", "inventario");
  ok(d.estado === "divergent" && d.declarada === true && /MILES/.test(d.razon), "el demo declara a mano su divergencia (miles contra crudos) — byte-igual a DIVERGENCIAS");
  ok(compatibilidadActiva() && compatibilidadActiva()["inventario|venta_comercial"], "…y la declaración activa la registró initTenant");
  initTenant(DATASETS[1][1]());
  const c = reconcilian("venta_comercial", "inventario");
  ok(c.estado === "comparable" && c.declarada === true && /mismo archivo/.test(c.razon) && c.marcos && /foto de inventario al 2026-08-31/.test(c.marcos.inventario),
    "la plantilla declara COMPARABLE: misma moneda y valorización, marcos distintos (período cerrado / foto fechada)");
  ok(reconcilian("tasa_comercial", "tasa_inventario").estado === "divergent" && reconcilian("venta_comercial", "unidades").estado === "unsupported", "lo no declarado sigue con el contrato de siempre");
  initTenant({ ...DATASETS[1][1](), compatibilidad: undefined });
  ok(reconcilian("venta_comercial", "inventario").estado === "divergent", "un pack SIN la llave cae a DIVERGENCIAS: nunca se adivina por la pinta del dato");
  initTenant(TENANT_DEMO);
  ok(reconcilian("venta_comercial", "inventario").estado === "divergent", "…y al volver al demo, la declaración activa vuelve con él");
}

/* ═══ 4 · CRUCES PERMITIDOS Y BLOQUEADOS, SEGÚN LO QUE DECLARA CADA ARCHIVO ══════════════════════════════════════ */
H("4 · el muro: en el demo la relación se bloquea; en la planilla pasa con los dos marcos; sumar no pasa en ninguno");
{
  const conBoleta = (q) => { const rp = runPlan({ intent: "answer", calls: [{ tool: "inventoryStatus", args: { focus: "top_sellers" } }] }, { scenario: ESCENARIO_INICIAL, maxCalls: 2, preguntaUsuario: q, registry: CAJA }); return { figs: rp.ledger.figs || [], results: rp.results }; };
  const juez = (t, b, q) => guardC(t, { ledger: { figs: b.figs }, results: b.results, question: q });
  initTenant(TENANT_DEMO);
  const bD = conBoleta("¿Cuánto inventario tengo de los SKU que más venden?");
  ok(juez("SAM-TV55 vende $13.3M y tiene $13K en stock.", bD, "x").ok, "demo · la ficha enumerada pasa");
  const vD = juez("SAM-TV55 vende $13.3M frente a $13K en stock.", bD, "x");
  ok(!vD.ok && vD.verdict === "cruce-de-universos", "demo · la relación «frente a» se BLOQUEA con la razón del demo (cruce-de-universos)");
  ok(!juez("Sumando la venta de SAM-TV55 ($13.3M) y su stock ($13K), ambos suman $13.3M.", bD, "x").ok, "demo · la suma se bloquea");
  initTenant(DATASETS[1][1]());
  const bP = conBoleta("¿Cuánto inventario tengo de los SKU que más venden?");
  ok(juez("ELE-CAB25 vende $14K y tiene $28K en stock.", bP, "x").ok, "planilla · la ficha enumerada pasa");
  const vP = juez("ELE-CAB25 vende $14K frente a $28K en stock.", bP, "x");
  ok(!vP.ok && vP.verdict === "marco-temporal-no-declarado" && /período/.test(vP.violations[0].detail) && /foto/.test(vP.violations[0].detail),
    "planilla · la relación SIN marcos se bloquea nombrando los dos marcos que faltan (marco-temporal-no-declarado)");
  ok(juez("ELE-CAB25 vendió $14K en el período cerrado y tiene $28K en stock en la foto de inventario al 2026-08-31: es el SKU con más stock frente a lo que vende.", bP, "x").ok,
    "★ planilla · la MISMA relación CON los dos marcos PASA — la compatibilidad la declaró el archivo, no el demo");
  const sP = juez("Sumando la venta del período de ELE-CAB25 ($14K) y su stock a hoy ($28K), ambos suman $42K.", bP, "x");
  ok(!sP.ok && vP.verdict !== undefined && /no se suman/.test(String((sP.violations[0] || {}).detail)), "planilla · sumar venta con stock se bloquea igual (comparable no es sumable)");
  /* lo que NO existe en ningún archivo: cliente×inventario y la afinidad estimada, apagadas */
  initTenant(TENANT_DEMO);
  const cps = runPlan({ intent: "answer", calls: [{ tool: "clientesPorSku", args: { entities: ["SAM-TV55"], topN: 3 } }] }, { scenario: ESCENARIO_INICIAL, maxCalls: 2, preguntaUsuario: "x", registry: CAJA }).results[0];
  ok(cps.coverage.supported === false && cps.coverage.relacion === "afinidad_apagada", "`clientesPorSku` declina: la afinidad estimada está apagada (owner 2026-09-14)");
  if (DATASETS[2]) {
    initTenant(DATASETS[2][1]());
    const cl = runPlan({ intent: "answer", calls: [{ tool: "entityCapitalLigado", args: { dimension: "cliente", entity: "Mercado Norte" } }] }, { scenario: ESCENARIO_INICIAL, maxCalls: 2, preguntaUsuario: "x", registry: CAJA }).results[0];
    ok(cl.coverage.supported === false && cl.coverage.relacion === "afinidad_apagada" && /filas de venta por cliente y SKU/.test(cl.coverage.reason),
      "`entityCapitalLigado` en la completa del owner ya NO sirve capital «por afinidad estimada»: declina con la puerta nombrada");
  }
  const dc = doctrinaDeCruce({ dominios: ["comercial", "inventario"], eje: null });
  ok(/Clave de unión: el SKU/.test(dc) && /Por cliente NO existe relación/.test(dc) && /no lo vuelques/.test(dc), "la doctrina de cruce nombra la clave (SKU), lo que no existe (cliente, bodega) y el foco (no volcar el otro dominio)");
}

/* ═══ 5 · LA PRUEBA DE PRODUCTO · 20 preguntas × datasets, por el bucle con cerebro mudo ═════════════════════════ */
for (const [nombre, cargar] of DATASETS) {
  H(`5 · ${nombre} · las 20 preguntas por el bucle: dominios en la boleta, cero secuestros, unidades, tamaño`);
  initTenant(cargar());
  let activadas = 0, secuestros = 0, maxChars = 0, conUnidades = 0, comerciales = 0, cruces = 0;
  const filas = [];
  for (const [q, esperados] of PREGUNTAS) {
    const m = await medir(q);
    filas.push({ q, ...m });
    const tiene = esperados.every((d) => m.doms.includes(d));
    if (tiene) activadas++;
    maxChars = Math.max(maxChars, m.chars);
    if (esperados.includes("comercial") && esperados.length === 1) { comerciales++; if (m.unidades) conUnidades++; }
    if (esperados.length >= 2 && m.doctrinaCruce) cruces++;
    /* SECUESTRO = un playbook de un solo dominio compone la respuesta de una pregunta de dos dominios */
    const pb = playbookPara(q, {});
    if (esperados.length >= 2 && pb && pb.multidominio !== true) secuestros++;
    /* y el secuestro concreto que se midió: capital frenado como respuesta a venta × inventario */
    if (esperados.includes("inventario") && esperados.includes("comercial") && /^De tu inventario, lo que este dato publica es el capital que quedó frenado/.test(m.texto)) secuestros++;
  }
  ok(activadas >= 19, `★ activación correcta de dominios: ${activadas}/20 (antes: 2/20)`, filas.filter((f) => !PREGUNTAS.find(([q]) => q === f.q)[1].every((d) => f.doms.includes(d))).map((f) => `${f.q.slice(0, 40)} → ${f.doms.join("+")}`).join(" | "));
  ok(secuestros === 0, `★ cero secuestros: ningún playbook de un solo dominio compone una pregunta de dos (antes: 7/20 «capital frenado»)`, String(secuestros));
  ok(conUnidades === comerciales, `★ unidades disponibles en toda pregunta comercial (${conUnidades}/${comerciales})`);
  ok(maxChars <= TECHO_ENTRADA_CIERRE_CHARS, `★ tamaño máximo ${maxChars} chars, bajo el techo de ${TECHO_ENTRADA_CIERRE_CHARS}`);
  ok(cruces >= 14, `★ la doctrina de cruce viaja en las preguntas de dos dominios (${cruces}/15)`);
  /* la lectura por eje deja de secuestrar «unidades por marca» con un ranking de margen */
  const um = filas.find((f) => /unidades vendí de cada marca/.test(f.q));
  ok(um && /unidades vendidas por marca/i.test(um.texto) && !/margen por marca/i.test(um.texto), "«¿Cuántas unidades vendí de cada marca?» responde UNIDADES por marca, no margen", um && um.texto.slice(0, 80));
}

/* ═══ 6 · EL CRUCE QUE CAMBIA LA CONCLUSIÓN · el piso determinístico ═════════════════════════════════════════════ */
H("6 · el cruce por SKU cambia la conclusión: el piso compone la ficha enumerada, con marcos, y pasa el muro");
{
  initTenant(TENANT_DEMO);
  const r = await answerViaAgente({ text: "¿Qué SKU dejan contribución pero tienen capital frenado?", history: [], mem: {}, scenario: ESCENARIO_INICIAL, callAgente: MUDO });
  const t = r.r.text;
  ok(r.r.agente.estado === "playbook" && r.r.agente.playbook === "cruce-por-sku" || (r.r.agente.estado === "playbook" && /Los SKU que más venden, con su inventario/.test(t)), `el playbook del cruce compone (${r.r.agente.estado})`, t.slice(0, 100));
  ok(/período cerrado/.test(t) && /foto de inventario/.test(t), "…cada cifra con su marco: período cerrado · foto de inventario");
  ok(/Entre los que más venden no aparece capital frenado: el capital frenado está en LG-DRYER8KG, BOS-SANDER, MAK-COMP-AIR/.test(t),
    "★ LA CONCLUSIÓN QUE CAMBIA: el capital frenado NO está en los que más venden — antes la respuesta era un ranking de frenados sin la venta al lado");
  ok(/Dejan contribución y también concentran capital en inventario: SAM-REF500L/.test(t) && /Concentran capital sin estar entre los que más contribuyen ni más venden: LG-DRYER8KG/.test(t),
    "…y la intersección contribución × capital, con quién queda solo en una lista");
  ok(!/(?<!no se )\bsuman?\b|frente a|por cada|equivale/.test(t) && /no se suman/.test(t), "sin sumar venta con stock ni relaciones que el demo no permite: enumeración pura, y lo dice («no se suman»)");
  if (DATASETS[2]) {
    initTenant(DATASETS[2][1]());
    const rc = await answerViaAgente({ text: "¿Los SKU que más vendo son los que tienen más capital en inventario?", history: [], mem: {}, scenario: ESCENARIO_INICIAL, callAgente: MUDO });
    ok(rc.r.agente.estado === "playbook" && /foto de inventario al 2026-09-01/.test(rc.r.text) && /de inventario/.test(rc.r.text), `en la completa del owner el cruce compone con la foto fechada y los días por SKU (${rc.r.agente.estado})`, rc.r.text.slice(0, 120));
  }
}

console.log(`\n── _contrato_dominios_gate: ${PASS} PASS · ${FAIL} FAIL (de ${PASS + FAIL}) ──`);
process.exit(FAIL ? 1 : 0);
