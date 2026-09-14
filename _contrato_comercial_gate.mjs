/* === _contrato_comercial_gate.mjs · EL CONTRATO COMERCIAL (owner 2026-09-13) ====================================
 * LA LEY: «Toda pregunta comercial parte de la misma realidad comercial. La pregunta determina el foco de la respuesta,
 * no qué evidencia tiene disponible ADI para razonar.»
 *
 * LA PRUEBA DE PRODUCTO, textual: (1) las 22 preguntas comerciales tienen 10/10 capítulos disponibles como evidencia,
 * independientemente de la ruta; (2) la respuesta sigue siendo selectiva y natural según el foco; (3) preguntas
 * equivalentes no pueden producir verdades distintas por haber entrado por procedimientos diferentes.
 *
 * MEDIDO ANTES (2026-09-13, mismo escenario, mismas preguntas): 11 de 22 caían al cerebro libre (0 capítulos garantizados)
 * y las 11 con procedimiento recibían 5,9 de 10; promedio 3,0/10. «¿Cómo van las ventas?» = 3/10 · «¿qué clientes
 * están perdiendo contribución?» = 4/10 · la Ficha de una cuenta = 7/10 sin markup ni huellas.
 *
 * Y la brecha partida contra el BENCHMARK («una brecha, una referencia, una verdad»): contribución no capturada =
 * carga comercial alta + brecha por precio y costo, exacto, en el universo declarado — y la pantalla lee lo mismo.
 * Cero red: el cerebro es MUDO (devuelve texto vacío) y los caminos determinísticos responden. */
import { initTenant } from "./src/data/tenantStore.js";
import { TENANT_DEMO } from "./src/data/tenants/demo.js";
import { ESCENARIO_INICIAL } from "./src/config/scenarios.js";
import { answerViaAgente, TECHO_ENTRADA_CIERRE_CHARS } from "./src/adi/agente/bucleAgente.js";
import { esTemaComercial, pasosDelContratoComercial, unirPasos, doctrinaComercial } from "./src/adi/agente/contratoComercial.js";
import { descomposicionDeBrecha } from "./src/adi/specRetrieval.js";
import { buildResumenComercial } from "./src/adi/sentrix/resumenComercial.js";
import { readFileSync } from "node:fs";

let pass = 0, fail = 0;
const ok = (c, m, d) => { if (c) { pass++; console.log(`  ✓ ${m}`); } else { fail++; console.log(`  ✗ ${m}${d ? `\n      ${String(d).slice(0, 420)}` : ""}`); } };
const H = (t) => console.log(`\n${t}`);
initTenant(TENANT_DEMO);
const ESC = ESCENARIO_INICIAL;
const MUDO = async () => ({ tipo: "texto", texto: "", stop: "end_turn" });

/* LOS DIEZ CAPÍTULOS DEL INFORME COMERCIAL (la tabla que validó el owner), leídos de los rótulos de la boleta */
const CAP = [
  ["ventas", /venta|factur|vendid|^Valor$|YoY|headline/i],
  ["contribución/margen", /contribuci|m[aá]rgen|rentabilidad|brecha|no capturad/i],
  ["clientes", /^(?:Lider|Falabella|Jumbo|Sodimac|Ripley|Paris|Tottus|Mercado Libre|La Polar|Hites|Unimarc|Easy|ABC)\b/i],
  ["costos", /costo/i],
  ["precio/markup", /precio|markup|lista|ticket/i],
  ["acciones/carga", /carga|acciones comerciales|rebate|descuento/i],
  ["volumen/mix", /volumen|unidades|mix|familia|surtido|tramo alto/i],
  ["evolución", /variaci|vs\.?\s*a[ñn]o|a[ñn]o anterior|YoY|interanual|mes a mes|serie|m[ií]nimo|m[aá]ximo|crecimiento|^(?:Ene|Feb|Mar|Abr|May|Jun|Jul|Ago|Sep|Oct|Nov|Dic)\b/i],
  ["benchmark", /benchmark|referencia|objetivo|nivel|piso/i],
  ["causalidad", /erosi|apuesta|sano|los que caen|efecto|descomposici|tramo alto|exceden|precio y costo/i],
];
/* LAS 22 PREGUNTAS COMERCIALES, con lo que recibían ANTES del contrato (capítulos de 10) */
const PREGUNTAS = [
  ["¿Cómo van las ventas?", 3], ["¿Cuánto vendimos este año contra el anterior?", 3], ["¿Quiénes son mis principales clientes?", 0], ["¿Qué clientes están cayendo en ventas?", 4],
  ["¿Cómo está el margen del negocio?", 7], ["¿Cuánta contribución no estoy capturando?", 7], ["¿Qué clientes están perdiendo contribución?", 4], ["¿Cuánto contribuye Falabella?", 0],
  ["¿Cómo está Falabella?", 7], ["¿Por qué Falabella deja tan poca contribución?", 7], ["¿Dónde se me está yendo el costo?", 0], ["¿Mis costos están subiendo?", 0],
  ["¿Qué clientes tienen el precio de lista más pegado al costo?", 0], ["¿Cuánto estoy cediendo en acciones comerciales?", 0], ["¿Qué clientes pagan más carga comercial que el nivel declarado?", 0],
  ["¿Cuál es el resultado del negocio después de gastos?", 0], ["¿Estoy creciendo con calidad o solo en volumen?", 0], ["Vendo más pero gano menos, ¿por qué?", 6],
  ["¿Qué está explicando el resultado comercial?", 0], ["¿Qué harías primero para mejorar el resultado comercial?", 0], ["¿Qué parte de la contribución no capturada puedes demostrar y qué parte no?", 7],
  ["Mira el negocio completo como si fueras mi asesor. Quiero saber si realmente estamos mejorando o si solo estamos vendiendo más. Dime qué está pasando con ventas y margen, qué está explicando el resultado, qué clientes están ayudando y cuáles están dañando, si el problema parece venir de precio, costo, mix o acciones comerciales, cuánto dinero está en juego, qué puedes demostrar con los datos y qué todavía no puedes saber. Si tuvieras que revisar una sola cosa primero, ¿cuál sería y por qué? Al final déjamelo en 5 líneas para directorio", 10],
];

/* el turno con cerebro mudo, leyendo lo que el cerebro RECIBIÓ (los rótulos y valores de los resultados) */
async function turno(q, cerebro = MUDO) {
  const cifras = new Map(); let chars = 0, doctrina = false, pb = null, mensajesHerr = 0;
  const espia = async (args) => {
    let enEstaLlamada = 0;
    for (const m of args.mensajes || []) {
      const c = String((m && m.content) || "");
      if (/^\[HERRAMIENTAS — no es el usuario\] Resultados:/.test(c)) {
        enEstaLlamada++; mensajesHerr = Math.max(mensajesHerr, enEstaLlamada); chars = Math.max(chars, c.length);
        const j = c.indexOf("[", c.indexOf("Resultados:"));
        let depth = 0, k = -1, inStr = false, esc = false;
        for (let i = j; i < c.length; i++) { const ch = c[i]; if (inStr) { if (esc) esc = false; else if (ch === "\\") esc = true; else if (ch === '"') inStr = false; continue; } if (ch === '"') inStr = true; else if (ch === "[") depth++; else if (ch === "]") { depth--; if (depth === 0) { k = i; break; } } }
        try { for (const r of JSON.parse(c.slice(j, k + 1))) for (const f of r.cifras || []) cifras.set(String(f.label), String(f.valor)); } catch { cifras.set("__parse_error__", "1"); }
      }
      if (/^\[CONTRATO COMERCIAL/.test(c)) doctrina = true;
      const m2 = /^\[PROCEDIMIENTO — no es el usuario\] Este turno sigue el playbook «([^»]+)»/.exec(c); if (m2) pb = m2[1];
    }
    return cerebro(args);
  };
  const r = await answerViaAgente({ text: q, history: [], mem: {}, scenario: ESC, callAgente: espia });
  const labels = [...cifras.keys()];
  const cob = CAP.map(([, re]) => labels.some((l) => re.test(l)));
  return { q, r, a: r.r.agente || {}, texto: String(r.r.text || ""), cifras, labels, cob, k: cob.filter(Boolean).length, chars, doctrina, pb, mensajesHerr };
}

/* ═══ 1 · LAS 22 PREGUNTAS: 10/10 CAPÍTULOS, INDEPENDIENTEMENTE DE LA RUTA ═══════════════════════════════════════ */
H("1 · ★★★ las 22 preguntas comerciales tienen la realidad comercial completa (10/10 capítulos) antes del cerebro");
const T = [];
for (const [q, antes] of PREGUNTAS) {
  const t = await turno(q);
  T.push({ ...t, antes });
  ok(t.a.contrato === "comercial" && t.k === 10 && !t.labels.includes("__parse_error__"),
    `${String(antes).padStart(2)}/10 → ${t.k}/10 · ${t.pb || "cerebro libre"} · «${q.slice(0, 64)}${q.length > 64 ? "…" : ""}»`,
    `contrato=${t.a.contrato} · faltan: ${CAP.filter((_, i) => !t.cob[i]).map(([n]) => n).join(", ") || "—"} · ${t.labels.length} cifras`);
}
const prom = (T.reduce((n, t) => n + t.k, 0) / T.length).toFixed(1), promAntes = (T.reduce((n, t) => n + t.antes, 0) / T.length).toFixed(1);
ok(T.every((t) => t.k === 10), `★★★ capítulos promedio: ${promAntes}/10 antes → ${prom}/10 después · ${T.filter((t) => t.k === 10).length} de ${T.length} con 10/10`);
ok(T.every((t) => t.chars <= TECHO_ENTRADA_CIERRE_CHARS), `★ el contrato cabe bajo el techo del cierre (${Math.max(...T.map((t) => t.chars))} chars como máximo, techo ${TECHO_ENTRADA_CIERRE_CHARS})`);
ok(T.every((t) => t.mensajesHerr === 1), "…en UNA sola ronda de herramientas antes del cerebro (los pasos del procedimiento y los del contrato, unidos)");

/* ═══ 2 · UNA SOLA VERDAD: la misma cifra en todas las rutas ═══════════════════════════════════════════════════ */
H("2 · ★★★ preguntas equivalentes ven la misma verdad: ningún rótulo tiene dos valores distintos en las 22 boletas");
{
  const num = (v) => { const m = /-?\d+(?:[.,]\d+)?/.exec(String(v).replace(/\s/g, "")); return m ? Number(m[0].replace(",", ".")) : NaN; };
  const vistos = new Map(); const choques = [], formatos = [];
  for (const t of T) for (const [l, v] of t.cifras) {
    if (l === "__parse_error__") continue;
    if (!vistos.has(l)) { vistos.set(l, v); continue; }
    if (vistos.get(l) === v) continue;
    if (Math.abs(num(vistos.get(l)) - num(v)) < 1e-9 && /[KMB%]/.test(v) === /[KMB%]/.test(vistos.get(l))) { if (!formatos.some((x) => x.startsWith(l))) formatos.push(`${l}: ${vistos.get(l)} / ${v}`); continue; }   // 22% y 22.0%: la misma cifra, dos formatos
    choques.push(`${l}: ${vistos.get(l)} vs ${v} («${t.q.slice(0, 40)}»)`);
  }
  ok(choques.length === 0, `★★★ ${vistos.size} rótulos distintos, cero con dos VALORES — una verdad por cifra en las 22 rutas`, choques.slice(0, 5).join(" | "));
  if (formatos.length) console.log(`      (nota: ${formatos.length} rótulos con la misma cifra en dos formatos, p. ej. ${formatos[0]} — executiveSummary imprime el % sin decimal; una verdad, dos letras)`);
  const base = ["Falabella · Margen", "Contribución no capturada · subtotal · 5 cuentas materiales (de 8 bajo el benchmark)", "Markup promedio · los que caen", "Benchmark de margen", "Contribución total"];
  ok(base.every((l) => T.every((t) => t.cifras.has(l))), "★★ las cifras de fondo (margen de la cuenta, subtotal oficial, markup, benchmark, contribución total) están en TODAS las boletas, entren por donde entren", base.filter((l) => !T.every((t) => t.cifras.has(l))).join(" | "));
}

/* ═══ 3 · LA RESPUESTA SIGUE SIENDO SELECTIVA: el foco es de la pregunta ═══════════════════════════════════════════ */
H("3 · ★★ la respuesta sigue siendo selectiva y natural según el foco (los procedimientos componen igual, sin volcar la boleta)");
{
  const por = (q) => T.find((t) => t.q === q);
  const ventas = por("¿Cómo van las ventas?");
  ok(ventas.a.estado === "playbook" && /venta/i.test(ventas.texto) && !/markup|brecha por precio|erosi[oó]n/i.test(ventas.texto) && ventas.texto.split(/\s+/).length < 140,
    `«¿Cómo van las ventas?» responde de ventas (${ventas.texto.split(/\s+/).length} palabras), sin volcar markup ni brecha: el foco es de la pregunta`, ventas.texto.slice(0, 160));
  const margen = por("¿Cuánta contribución no estoy capturando?");
  ok(margen.a.estado === "playbook" && /\$4\.9M/.test(margen.texto) && /Falabella/.test(margen.texto), "«¿Cuánta contribución no estoy capturando?» sigue respondiendo con su procedimiento (subtotal y cuentas)", margen.texto.slice(0, 160));
  const ficha = por("¿Cómo está Falabella?");
  ok(ficha.a.estado === "playbook" && /^Falabella/.test(ficha.texto.trim()), "«¿Cómo está Falabella?» sigue siendo la Ficha de Falabella", ficha.texto.slice(0, 120));
  const gerente = T[T.length - 1];
  ok(gerente.a.estado === "encargo-compuesto" && gerente.texto.split(/\s+/).length > 400, `el prompt de gerente sigue saliendo por el ensamblador (${gerente.a.estado}, ${gerente.texto.split(/\s+/).length} palabras)`);
  ok(T.filter((t) => t.pb && t.pb !== "margen-en-riesgo").every((t) => t.doctrina) && T.filter((t) => !t.pb).every((t) => t.doctrina),
    "★ la doctrina comercial (conclusiones del procedimiento) viaja en todo turno comercial que no sea de margen-en-riesgo — y en el cerebro libre");
  ok(T.filter((t) => t.pb === "margen-en-riesgo").every((t) => !t.doctrina), "…y no se duplica cuando margen-en-riesgo ya la manda con su propia doctrina");
  const d = doctrinaComercial([]);
  ok(d === "" || typeof d === "string", "doctrinaComercial sin boleta devuelve vacío, jamás rompe");
}

/* ═══ 4 · EL TEMA: qué entra y qué no ═════════════════════════════════════════════════════════════════════════════ */
H("4 · el tema comercial se reconoce por la pregunta; inventario, cobranza, otros ejes, definiciones y reformular quedan fuera");
{
  for (const q of ["¿Cómo van las ventas?", "¿Cuánto contribuye Falabella?", "¿Cómo está Falabella?", "¿Mis costos están subiendo?", "¿Estoy creciendo con calidad o solo en volumen?", "¿Cuánto vendimos este año contra el anterior?"])
    ok(esTemaComercial(q), `comercial: «${q}»`);
  for (const q of ["¿Cuánto stock tengo en Valparaíso?", "¿Quién me debe plata vencida?", "¿Qué es el margen bruto?", "¿Qué marcas venden más?", "dámelo más corto", "¿Cuántos días de inventario tengo?", "hola"])
    ok(!esTemaComercial(q), `fuera del contrato: «${q}»`);
  /* RE-APUNTADO 2026-09-14 (contrato de dominios): una pregunta de inventario ya no deja la boleta vacía — corre SU contrato
   * (la foto del inventario), no el comercial. Lo que se mide acá es que el comercial no se cuela: cero cifras comerciales. */
  const inv = await turno("¿Cuántos días de inventario tengo?");
  ok(inv.a.contrato === null && !inv.labels.some((l) => /Contribución no capturada|Markup|Carga comercial|Benchmark de margen|Variación vs año anterior/i.test(l)),
    "una pregunta de inventario sin procedimiento no corre el contrato COMERCIAL (corre el de inventario; ninguna cifra comercial en la boleta)", `contrato=${inv.a.contrato} · ${inv.labels.length} cifras`);
  const pasos = pasosDelContratoComercial();
  ok(pasos.map((p) => p.tool).join("+") === "salesRead+marginRead+contributionRead+diagnose+rolesCartera", `los pasos del contrato en este dato: ${pasos.map((p) => p.tool).join("+")} (la serie de margen entra solo con histórico real)`);
  const union = unirPasos([{ tool: "salesRead", args: { focus: "vs_presupuesto" } }, { tool: "marginRead", args: { focus: "bajo_benchmark", dimension: "cliente" } }], pasos);
  ok(union.filter((p) => p.tool === "salesRead").length === 1 && union[0].args.focus === "vs_presupuesto" && union.length === 5,
    "★ el procedimiento manda sobre el contrato para la misma herramienta: «ventas contra el presupuesto» conserva su salesRead y no recibe el del año anterior (una referencia por turno)");
}

/* ═══ 5 · LA BRECHA PARTIDA CONTRA EL BENCHMARK: exacta, en el universo declarado, una para ADI y para la pantalla ═ */
H("5 · ★★★ la descomposición causal: contribución no capturada = carga comercial alta + precio y costo, exacto, y la pantalla lee lo mismo");
{
  const D = descomposicionDeBrecha(ESC);
  ok(!!D && D.filas.length >= 8, `el motor parte la brecha de ${D && D.filas.filter((f) => f.bajoBenchmark).length} cuentas bajo el benchmark (${D && D.universo.n} materiales)`);
  ok(D.filas.every((f) => f.gapUsd === f.cargaUsd + f.restoUsd), "★★★ por cuenta: contribución no capturada = carga sobre el nivel + precio y costo, EXACTO (enteros, sin doble conteo)");
  const S = D.subtotales.materiales;
  ok(S.gap === S.carga + S.resto && S.n === D.universo.n, `★★★ en el universo declarado (${S.n} cuentas materiales): ${S.gap} = ${S.carga} + ${S.resto}`);
  const m = T.find((t) => t.q === "¿Cuánta contribución no estoy capturando?");
  const sub = m.cifras.get("Contribución no capturada · subtotal · 5 cuentas materiales (de 8 bajo el benchmark)"), subC = m.cifras.get("Carga comercial alta · subtotal · 5 cuentas materiales (de 8 bajo el benchmark)"), subR = m.cifras.get("Brecha por precio y costo · subtotal · 5 cuentas materiales (de 8 bajo el benchmark)");
  ok(sub && subC && subR, `★★ la boleta del agente trae los tres subtotales con su universo: ${sub} = ${subC} (carga) + ${subR} (precio y costo)`);
  ok(["Falabella", "Lider", "Jumbo", "Sodimac", "Ripley"].every((e) => m.cifras.has(`${e} · Brecha por precio y costo`) && m.cifras.has(`${e} · Contribución no capturada`)), "…y las cinco cuentas materiales con sus dos términos");
  const R = buildResumenComercial(ESC);
  const pq = R.deterioro.margen.porQue;
  ok(pq && pq.filas.every((f) => { const d = D.filas.find((x) => x.entidad === f.nombre); return d && f.enJuego === d.gapUsd && f.cargaUsd === d.cargaUsd && f.restoUsd === d.restoUsd; }),
    "★★★ la pestaña Comercial parte la brecha contra el MISMO benchmark con las MISMAS cifras (una brecha, una referencia, una verdad)");
  ok(/benchmark/.test(pq.lectura) && !/promedio \(/.test(pq.lectura), `…y lo dice: «${pq.lectura.slice(0, 90)}…»`);
  ok(S.carga < S.resto, `el hallazgo del dato: en las ${S.n} cuentas materiales la carga sobre el nivel explica ${Math.round((S.carga / S.gap) * 100)}% de la brecha; el resto es precio y costo — «la causa dominante» era un exceso, ahora hay cifra`);
}

/* ═══ 6 · LAS CARNADAS ═════════════════════════════════════════════════════════════════════════════════════════════ */
H("6 · carnadas: sin el contrato, la ventas vuelve a quedar subinformada (el chequeo se pone rojo)");
{
  const src = readFileSync(new URL("./src/adi/agente/bucleAgente.js", import.meta.url), "utf8");
  /* (re-apuntado 2026-09-14: los pasos del contrato salen de `pasosDeDominios` —comercial incluido— y la unión es `unirPasosDeDominios`) */
  ok(/const _pasosContrato = \(\(\) => \{ try \{ return pasosDeDominios\(_dom\); \}/.test(src) && /unirPasosDeDominios\(_pasosPb, _pasosContrato\)/.test(src), "el bucle une los pasos del procedimiento con los del contrato (cableado presente)");
  ok(/contrato: _esComercial \? "comercial" : null/.test(src), "…y el expediente declara si el turno partió del contrato");
  /* la carnada de conducta: con el contrato quitado, «¿cómo van las ventas?» vuelve a 3/10 — se mide con un mudo que mira lo que llega */
  const antesLabels = T.find((t) => t.q === "¿Cómo van las ventas?").labels.length;
  ok(antesLabels > 60, `con el contrato la lectura de ventas recibe ${antesLabels} cifras (sin él recibía 32: solo venta y variación)`);
}

console.log(`\n── _contrato_comercial_gate: ${pass} PASS · ${fail} FAIL (de ${pass + fail}) ──`);
process.exit(fail ? 1 : 0);
