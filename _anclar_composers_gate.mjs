/* === _anclar_composers_gate.mjs · LA CASA ANCLA LO SUYO (verdad finita · etapa E4 · owner 2026-09-17, offline) ═══════════════════════════════
 * «Todos los caminos que puedan terminar frente al usuario deben quedar bajo el mismo contrato de verdad, sin degradar la naturalidad de ADI.»
 * Los peldaños de la escalera (playbook · encargo compuesto · línea honesta · límite) se sirven con el cerebro MUDO, con el flag apagado y con el
 * flag encendido, sobre las preguntas de la certificación congelada y los cruces vivos:
 *   1 · MISMO TEXTO: lo que el usuario recibe con el v3 es byte-igual a lo de hoy (el render de la casa sobre un composer que imprime en canon);
 *   2 · MISMO CONTRATO: cada peldaño servido pasó por el juez de anclas (expediente `modo: "anclas"`, sin vetos), con sus hechos anclados y ningún
 *       dígito fuera de un ancla — el mismo estándar que al cerebro;
 *   3 · las piezas puras: `anclarDeclaracion` (tramo declarado = ancla; solapes = un ancla con varios ids; tabla = celda por celda; lecturas con
 *       apoyo) y `anclarPorFigs` (cifras verbatim de la boleta → placeholders de su ref; ambigüedad = no se ancla).
 * Solo por `npm run gates:offline` (o con el candado: node --import ./scripts/offline-guard.mjs _anclar_composers_gate.mjs). Cero red. */
import { initTenant } from "./src/data/tenantStore.js";
import { TENANT_DEMO } from "./src/data/tenants/demo.js";
import { ESCENARIO_INICIAL } from "./src/config/scenarios.js";
import { answerViaAgente } from "./src/adi/agente/bucleAgente.js";
import { anclarDeclaracion, anclarPorFigs, hechoDeDeclaracion } from "./src/adi/notario/anclar.js";
import { parsearAnclas } from "./src/adi/notario/anclas.js";

let PASS = 0, FAIL = 0;
const ok = (c, m, extra = "") => { if (c) { PASS++; console.log("  ✓ " + m); } else { FAIL++; console.log("  ✗ " + m + (extra ? "\n      " + extra : "")); } };
const H = (t) => console.log(`\n${t}`);
initTenant(TENANT_DEMO);
const MUDO = async () => ({ tipo: "texto", texto: "", stop: "end_turn" });
const PREGUNTAS = [
  "Dime cuáles son los clientes que venden mucho pero están bajo el benchmark",
  "ranking por canal: mejores y peores",
  "qué marca deja más margen",
  "margen por familia",
  "capital por bodega",
  "quién me debe y qué está vencido",
  "cuánto vendí a crédito vs contado",
  "dame los 3 riesgos para el directorio",
  "qué SKU tienen capital frenado",
  "cuánto me compró Easy el último mes",
  "¿cómo viene mi margen?",
  "¿Los SKU que más vendo son también los que más capital me inmovilizan?",
  "¿Mis principales clientes comerciales son también los que más me deben?",
  "¿Estoy sosteniendo stock en productos que venden bien pero dejan poca contribución?",
  "Dame una lectura integrada de comercial, cobranza e inventario y dime qué priorizo",
  "por punto de venta, ¿quién queda bajo el plan?",
];

/* ═══ 1-2 · MISMO TEXTO, MISMO CONTRATO ═══ */
H("1 · los peldaños con el flag apagado y encendido: mismo texto, mismo estado; con el flag, bajo el juez de anclas");
const M = { turnos: 0, iguales: 0, anclados: 0, conDigitos: 0, hechos: 0, sitios: new Map() };
for (const q of PREGUNTAS) {
  const v2 = await answerViaAgente({ text: q, history: [], mem: {}, scenario: ESCENARIO_INICIAL, callAgente: MUDO });
  const v3 = await answerViaAgente({ text: q, history: [], mem: {}, scenario: ESCENARIO_INICIAL, callAgente: MUDO, notarioV3: true });
  const a2 = v2.r.agente || {}, a3 = v3.r.agente || {};
  const t2 = String(v2.r.text || ""), t3 = String(v3.r.text || "");
  M.turnos++;
  const igual = t2 === t3 && a2.estado === a3.estado;
  if (igual) M.iguales++;
  ok(igual, `«${q.slice(0, 70)}» → ${a3.estado} · mismo texto y mismo estado con y sin flag`, `v2 ${a2.estado}: ${t2.slice(0, 160).replace(/\n/g, " ⏎ ")}\n      v3 ${a3.estado}: ${t3.slice(0, 160).replace(/\n/g, " ⏎ ")}`);
  const sv = a3.notario && a3.notario.servido;
  const paso = sv && (a3.notario.pasos || []).slice().reverse().find((p) => p.sitio === sv.sitio) || null;
  M.sitios.set(a3.estado, (M.sitios.get(a3.estado) || 0) + 1);
  if (/^(?:playbook|encargo-compuesto|limite)$/.test(a3.estado)) {
    ok(!!paso && paso.modo === "anclas" && (paso.vetos || []).length === 0, `   · el peldaño «${sv && sv.sitio}» pasó por el juez de anclas sin vetos`, JSON.stringify(paso).slice(0, 300));
    if (paso && paso.modo === "anclas") M.anclados++;
    if (/\d/.test(t3.replace(/\b(?:19|20)\d\d\b/g, ""))) { M.conDigitos++; ok(!!paso && paso.medidas && paso.medidas.hechos > 0, `   · con dígitos en pantalla, el peldaño llevó hechos anclados (${paso && paso.medidas ? paso.medidas.hechos : 0})`); if (paso && paso.medidas) M.hechos += paso.medidas.hechos || 0; }
  }
}
H("2 · las medidas");
ok(M.iguales === M.turnos, `texto y estado idénticos con y sin flag: ${M.iguales} de ${M.turnos}`);
console.log(`  peldaños servidos: ${[...M.sitios.entries()].map(([k, n]) => `${k} ${n}`).join(" · ")} · bajo el juez de anclas: ${M.anclados} · con dígitos: ${M.conDigitos} · hechos anclados: ${M.hechos}`);
ok(M.anclados >= 8, `al menos 8 peldaños con composer bajo el juez de anclas (${M.anclados})`);

/* ═══ 3 · LAS PIEZAS PURAS ═══ */
H("3 · anclarDeclaracion y anclarPorFigs");
{
  const texto = "Lider vende $17.8M y su margen es 21.5%.\n\n| Cliente | Venta | Margen |\n|---|---|---|\n| Lider | $17.8M | 21.5% |\n\nCriterio mío: yo miraría primero a Lider.";
  const decl = [
    { tipo: "cifra", sujeto: "Lider", metrica: "Ventas", valor: "$17.8M", texto: "Lider vende $17.8M", evidencia: ["Lider · Ventas"] },
    { tipo: "cifra", sujeto: "Lider", metrica: "Margen", valor: "21.5%", texto: "su margen es 21.5%", evidencia: ["Lider · Margen"] },
    { tipo: "cifra", sujeto: "Lider", metrica: "Ventas", valor: "$17.8M", texto: "| Lider | $17.8M | 21.5% |", evidencia: ["Lider · Ventas"] },
    { tipo: "cifra", sujeto: "Lider", metrica: "Margen", valor: "21.5%", texto: "| Lider | $17.8M | 21.5% |", evidencia: ["Lider · Margen"] },
    { tipo: "lectura", sello: "criterio mío", texto: "Criterio mío: yo miraría primero a Lider." },
  ];
  const R = anclarDeclaracion(texto, decl);
  ok(R.hechos.length === 5 && R.hechos[0].tipo === "ref" && R.hechos[0].de === "Lider · Ventas", "una cifra con una fig de evidencia es una ref a esa fig", JSON.stringify(R.hechos[0]));
  ok(R.prosa.startsWith("{{d1: Lider vende $17.8M}} y {{d2: su margen es 21.5%}}."), "una cifra declarada ancla su cláusula (v3.1: hasta la conjunción, el corte o la siguiente cifra; la palabra pegada a la cifra queda bajo el juez)", R.prosa.split("\n")[0]);
  ok(R.prosa.includes("| Lider | {{d3: $17.8M}} | {{d4: 21.5%}} |"), "una fila de tabla se ancla celda por celda, cada celda con el id cuyo valor es", R.prosa.split("\n").find((l) => /^\| Lider/.test(l)));
  const lect = R.hechos.find((h) => h.tipo === "lectura");
  ok(lect && lect.apoyo.length === 4, "la lectura se apoya en los hechos del mismo composer");
  ok(parsearAnclas(R.prosa).errores.length === 0, "la prosa anclada está bien formada");
  const S = anclarDeclaracion("Lider debe $9.8M, la más alta de la cartera.", [
    { tipo: "cifra", sujeto: "Lider", metrica: "Saldo pendiente", valor: "$9.8M", texto: "Lider debe $9.8M", evidencia: ["Lider · Saldo pendiente"] },
    { tipo: "orden", sujeto: "Lider", metrica: "Saldo pendiente", orden: { forma: "max" }, universo: "los 13 clientes", texto: "Lider debe $9.8M, la más alta de la cartera" },
  ]);
  ok(S.prosa === "{{d1 d2: Lider debe $9.8M, la más alta de la cartera}}." && S.hechos[1].universo === "los 13 clientes", "dos tramos que se solapan son UN ancla con dos ids", S.prosa);
  ok(hechoDeDeclaracion({ tipo: "estado", sujeto: "Jumbo", estado: { estado: "al día" } }, "x").estado === "al día", "el estado declarado viaja como estado v3");
  const figs = [{ id: "c1", label: "Lider · Ventas", text: "$17.8M" }, { id: "c2", label: "Falabella · Saldo pendiente", text: "$8.2M" }, { id: "c3", label: "Jumbo · Saldo pendiente", text: "$8.2M" }, { id: "c4", label: "Clientes · total", text: "13" }];
  const F = anclarPorFigs("Lo que tengo verificado ahora: venta de Lider, $17.8M; saldo pendiente de Falabella, $8.2M. Son 13 clientes, no 130.", figs);
  ok(F.prosa === "Lo que tengo verificado ahora: {{r1: venta de Lider, $17.8M}}; {{r2: saldo pendiente de Falabella, $8.2M}}. {{r3: Son 13 clientes}}, no 130." && F.hechos.every((h) => h.tipo === "ref"), "las cifras verbatim de la boleta se anclan con su cláusula a su ref; el valor repetido lo decide la entidad de la línea; «130» no es «13»", F.prosa);
  const G = anclarPorFigs("Hay $8.2M pendientes.", figs);
  ok(G.prosa === "Hay $8.2M pendientes." && G.hechos.length === 0, "con dos figs del mismo valor y ninguna entidad en la línea, no se ancla (el Notario lo cobrará)", G.prosa);
}

console.log(`\n── _anclar_composers_gate: ${PASS} PASS · ${FAIL} FAIL (de ${PASS + FAIL}) ──`);
process.exit(FAIL ? 1 : 0);
