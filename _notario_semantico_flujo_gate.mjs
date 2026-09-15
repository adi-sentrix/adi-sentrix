/* === _notario_semantico_flujo_gate.mjs · EL NOTARIO SEMÁNTICO EN EL FLUJO (fase 2 · owner 2026-09-15, offline) ═══════════════
 * «La respuesta y sus declaraciones deben representar exactamente la misma realidad; ninguna afirmación relevante puede quedar
 * fuera; una declaración incompleta o sin evidencia sigue siendo no verificable; la multa señala exactamente qué falló y cuál es la
 * verdad; el respaldo declara y se verifica con el mismo estándar; las leyes de la casa siguen; lectura no es refugio.»
 * El turno ENTERO (answerViaAgente) con un cerebro fijo —los 12 borradores reales como cierre/reparación— y sin red:
 *   A · el cerebro declara (las declaraciones manuales del fixture como su bloque): el juez semántico veta exactamente las falsas
 *       esperadas (FP/FN dentro del flujo), la multa nombra la afirmación y la verdad, y lo servido lleva su registro notarial;
 *   B · el cerebro NO declara: `sin-declaracion` → una reparación → nunca se sirve como verificado; lo servido sale del respaldo con su
 *       propia declaración verificada;
 *   C · la puerta cerrada: prosa falsa con declaración verdadera → `declaracion-inconsistente`;
 *   D · declaración parcial: se quita un tercio de las de hecho → el detector cobra la omisión;
 *   E · las medidas para el owner: tasa de declaraciones correctas, tasa de afirmaciones omitidas, FP/FN dentro del flujo, reparaciones
 *       provocadas por declaraciones falsas/incompletas, servido sin pasar por el Notario (debe ser 0), y qué queda del Notario viejo.
 * Cero red: el cerebro es un guion; herramientas puras; fixtures en disco. */
import fs from "node:fs";
import { initTenant } from "./src/data/tenantStore.js";
import { TENANT_DEMO } from "./src/data/tenants/demo.js";
import { ESCENARIO_INICIAL } from "./src/config/scenarios.js";
import { answerViaAgente } from "./src/adi/agente/bucleAgente.js";
import { MARCA_INICIO, MARCA_FIN, extraerDeclaracion } from "./src/adi/notario/declaracion.js";
import { CHEQUEOS_DE_HECHO } from "./src/adi/notario/juez.js";

let PASS = 0, FAIL = 0;
const ok = (c, m, extra = "") => { if (c) { PASS++; console.log("  ✓ " + m); } else { FAIL++; console.log("  ✗ " + m + (extra ? "\n      " + extra : "")); } };
const H = (t) => console.log(`\n${t}`);
const pct = (a, b) => (b ? (100 * a / b).toFixed(1) : "0.0") + " %";
initTenant(TENANT_DEMO);
const leer = (f) => JSON.parse(fs.readFileSync(new URL("./fixtures/" + f, import.meta.url), "utf8"));
const S = leer("notario-semantico-2026-09-15.json");
const FACTUALES = new Set(["cifra", "orden", "relacion", "grupo", "conteo", "variacion", "estado"]);
const bloque = (afs) => `${MARCA_INICIO}\n${afs.map((a) => JSON.stringify(Object.fromEntries(Object.entries(a).filter(([k]) => !["veredicto_esperado", "verdad", "nota", "evidencia"].includes(k))))).join("\n")}\n${MARCA_FIN}`;
/* el guion devuelve también la multa que el cerebro RECIBIÓ en la reparación (el último mensaje del motor): ahí se mide la multa exacta */
const turno = async (pregunta, salidas) => { const multas = []; const r = await answerViaAgente({ text: pregunta, history: [], mem: {}, scenario: ESCENARIO_INICIAL, callAgente: async ({ attempt, mensajes }) => { const t = attempt > 0 ? salidas[Math.min(1, salidas.length - 1)] : salidas[0]; if (attempt > 0) { const u = [...(mensajes || [])].reverse().find((m) => m.role === "user" && /NOTARIO/.test(String(m.content))); if (u) multas.push(String(u.content)); } return { tipo: "texto", texto: t, stop: "end_turn" }; } }); r.multaAlModelo = multas.join("\n"); return r; };
const canon = (t) => String(t || "").replace(/(\d),(\d)/g, "$1.$2").replace(/\s+/g, " ");
const pasoDe = (a, sitio) => (a.notario.pasos || []).find((p) => p.sitio === sitio) || null;
const kindsDe = (a) => a.vetos.flatMap((v) => { const m = /·\s+([a-z-]+):/.exec(v); const extra = (/\(\+ ([^)]+)\)/.exec(v) || [])[1]; const leyes = (/· leyes: (.*)$/.exec(v) || [, ""])[1].split(" · ").map((x) => (/^([a-z-]+): /.exec(x) || [])[1]).filter(Boolean); return [...new Set([...(m ? [m[1]] : []), ...(extra ? extra.split(/,\s*/) : []), ...leyes])]; });

/* ═══ A · EL CEREBRO DECLARA ═══════════════════════════════════════════════════════════════════════════════════════════════ */
H("A · EL CEREBRO DECLARA: los 12 borradores reales con sus declaraciones (cierre → reparación → poda → respaldo)");
const ids = [...new Set(S.corpus.map((c) => c.id))];
const M = { pasos: 0, declaradas: 0, factuales: 0, verdaderas: 0, falsas: 0, nv: 0, selladas: 0, incons: 0, puntos: 0, cubiertos: 0, omitidos: 0, fp: 0, fn: 0, reparaciones: 0, reparacionesPorDeclaracion: 0, servidos: 0, servidosSinNotario: 0, servidosConFalsas: 0, leyes: new Map(), detectores: new Map(), estados: {} };
for (const id of ids) {
  const cierre = S.corpus.find((c) => c.id === id && c.sitio === "cierre");
  const rep = S.corpus.find((c) => c.id === id && c.sitio === "reparacion");
  const F = leer(cierre.fixture);
  const salidaDe = (c) => `${F.borradores[c.borrador - 1].texto}\n\n${bloque(c.afirmaciones)}`;
  const r = await turno(F.pregunta, [salidaDe(cierre), salidaDe(rep)]);
  const a = r.r.agente;
  const esperadasFalsas = (c) => c.afirmaciones.filter((x) => x.veredicto_esperado === "falsa").length;
  for (const [c, sitio] of [[cierre, "cierre"], [rep, "reparacion"]]) {
    const p = pasoDe(a, sitio);
    if (!p) continue;
    M.pasos++;
    const m = p.medidas;
    M.declaradas += m.declaradas; M.factuales += m.factuales; M.verdaderas += m.verdaderas; M.falsas += m.falsas; M.nv += m.noVerificables; M.selladas += m.selladas; M.incons += m.inconsistentes;
    M.puntos += m.puntos; M.cubiertos += m.cubiertos; M.omitidos += m.omitidos;
    const esp = esperadasFalsas(c);
    if (m.falsas > esp) M.fp += m.falsas - esp;
    if (m.falsas < esp) M.fn += esp - m.falsas;
    for (const k of (p.detectores || [])) M.detectores.set(k, (M.detectores.get(k) || 0) + 1);
  }
  const c1 = pasoDe(a, "cierre");
  const reparo = !!pasoDe(a, "reparacion");
  if (reparo) { M.reparaciones++; if (c1 && (c1.medidas.falsas || c1.medidas.noVerificables || c1.medidas.omitidos || c1.medidas.inconsistentes)) M.reparacionesPorDeclaracion++; }
  M.servidos++;
  const sv = a.notario.servido;
  if (!sv || sv.sinJuicioSemantico) M.servidosSinNotario++;
  else if (sv.medidas && (sv.medidas.falsas || sv.medidas.omitidos || sv.medidas.inconsistentes)) M.servidosConFalsas++;
  M.estados[a.estado] = (M.estados[a.estado] || 0) + 1;
  for (const k of kindsDe(a)) if (!CHEQUEOS_DE_HECHO.has(k) && !/^(?:afirmacion|declaracion|sin-declaracion|lectura-encubre)/.test(k)) M.leyes.set(k, (M.leyes.get(k) || 0) + 1);
  const c1m = c1 ? c1.medidas : null;
  console.log(`  ${id} · cierre: ${c1m ? `${c1m.falsas} falsas (esperadas ${esperadasFalsas(cierre)}) · ${c1m.noVerificables} nv · ${c1m.omitidos} omitidas · ${c1m.inconsistentes} inconsistentes` : "sin juicio"} → ${reparo ? "reparación" : "sin reparación"} → estado ${a.estado} · servido por ${sv && sv.sitio}${sv && sv.derivada ? " (derivada)" : ""}`);
  /* la multa exacta: cada afirmación falsa esperada del cierre llega al cerebro nombrada («declaraste «…»») y con la verdad de la boleta al lado */
  const falsasCierre = cierre.afirmaciones.filter((x) => x.veredicto_esperado === "falsa");
  const multaAlModelo = canon(r.multaAlModelo);
  for (const x of falsasCierre.slice(0, 3)) {
    const i = multaAlModelo.indexOf("declaraste «" + canon(x.texto).slice(0, 25));
    const tramo = i >= 0 ? multaAlModelo.slice(i, i + 1200) : "";
    ok(i >= 0 && /y es FALSA: /.test(tramo) && /· La boleta: /.test(tramo), `${id} · el cerebro recibe la multa exacta: «declaraste «${canon(x.texto).slice(0, 25)}…» … y es FALSA … La boleta: …»`, i < 0 ? "no la nombra" : "sin la verdad de la boleta");
  }
}
H("MEDIDA · dentro del flujo (los 12 borradores, declaración manual = la declaración de un cerebro que declara bien)");
console.log(`  pasos juzgados (cierre + reparación): ${M.pasos} · declaradas ${M.declaradas} (de hecho ${M.factuales}) · verdaderas ${M.verdaderas} · falsas ${M.falsas} · no-verificables ${M.nv} · selladas ${M.selladas} · inconsistentes ${M.incons}`);
console.log(`  tasa de declaraciones correctas (verdaderas + selladas, consistentes) / declaradas: ${pct(M.verdaderas + M.selladas, M.declaradas)}`);
console.log(`  tasa de afirmaciones relevantes omitidas (puntos de la prosa sin declarar): ${M.omitidos}/${M.puntos} = ${pct(M.omitidos, M.puntos)}`);
console.log(`  FP dentro del flujo (falsas de más contra lo esperado): ${M.fp} · FN (falsas de menos): ${M.fn}`);
console.log(`  reparaciones: ${M.reparaciones} de ${ids.length} turnos · provocadas por declaraciones falsas/incompletas/omitidas: ${M.reparacionesPorDeclaracion}`);
console.log(`  servido sin pasar por el Notario semántico: ${M.servidosSinNotario}/${M.servidos} · servido con falsas u omisiones: ${M.servidosConFalsas}/${M.servidos} · estados: ${JSON.stringify(M.estados)}`);
console.log(`  leyes de la casa que ardieron (siguen en el Notario viejo): ${[...M.leyes.entries()].map(([k, n]) => `${k} (${n})`).join(", ") || "ninguna"}`);
console.log(`  detectores (chequeos de hecho del muro, ya sin veredicto): ${[...M.detectores.entries()].map(([k, n]) => `${k} (${n})`).join(", ") || "ninguno"}`);
ok(M.fp === 0, `0 falsos positivos de hecho dentro del flujo (hoy ${M.fp})`);
ok(M.fn === 0, `0 falsos negativos de hecho dentro del flujo (hoy ${M.fn})`);
ok(M.incons === 0, `0 declaraciones inconsistentes con la prosa en los 12 borradores (hoy ${M.incons})`);
ok(M.servidosSinNotario === 0, `nada servido sin registro del Notario semántico (hoy ${M.servidosSinNotario})`);
ok(M.servidosConFalsas === 0, `nada servido con afirmaciones falsas u omitidas (hoy ${M.servidosConFalsas})`);

/* ═══ B · EL CEREBRO NO DECLARA ══════════════════════════════════════════════════════════════════════════════════════════ */
H("B · EL CEREBRO NO DECLARA: sin bloque → sin-declaracion → una reparación → nunca verde; el respaldo declara y se verifica");
{
  const c = S.corpus.find((x) => x.id === "P1·1" && x.sitio === "cierre");
  const F = leer(c.fixture);
  const r = await turno(F.pregunta, [F.borradores[0].texto, F.borradores[1].texto]);
  const a = r.r.agente;
  const k1 = kindsDe(a);
  ok(k1.includes("sin-declaracion"), `el cierre sin bloque se veta por sin-declaracion (${a.vetos[0] ? a.vetos[0].slice(0, 80) : ""})`);
  ok(a.estado !== "verde" && a.estado !== "reparado" && a.estado !== "podado", `no se sirve como verificado: estado ${a.estado}`);
  const sv = a.notario.servido;
  ok(!!sv && !sv.sinJuicioSemantico && sv.medidas && !sv.medidas.falsas && !sv.medidas.omitidos, `lo servido (${sv && sv.sitio}${sv && sv.derivada ? ", derivada" : ", nativa"}) pasó el juez semántico: ${sv && sv.medidas ? JSON.stringify(sv.medidas) : ""}`);
}

/* ═══ C · LA PUERTA CERRADA ══════════════════════════════════════════════════════════════════════════════════════════════ */
H("C · LA PUERTA CERRADA: prosa falsa con declaración verdadera");
{
  const P1 = leer("adversarial-notario-2026-09-14.json").preguntas.P1;
  const casos = [
    ["sujeto", `Falabella acumula $4,6M vencidos y 269 días de atraso.\n\n${MARCA_INICIO}\n{"tipo":"cifra","sujeto":"Lider","metrica":"Saldo vencido","valor":"$4,6M","texto":"acumula $4,6M vencidos"}\n{"tipo":"cifra","sujeto":"Lider","metrica":"Dias Vencido","valor":"269 días","texto":"269 días de atraso"}\n${MARCA_FIN}`],
    ["métrica", `Lider vendió $4,6M en el período.\n\n${MARCA_INICIO}\n{"tipo":"cifra","sujeto":"Lider","metrica":"Saldo vencido","valor":"$4,6M","texto":"Lider vendió $4,6M"}\n${MARCA_FIN}`],
    ["cifra", `Lider acumula $4,7M vencidos.\n\n${MARCA_INICIO}\n{"tipo":"cifra","sujeto":"Lider","metrica":"Saldo vencido","valor":"$4,6M","texto":"acumula vencidos"}\n${MARCA_FIN}`],
    ["orden como lectura", `Lider es la cuenta que más vende de la cartera.\n\n${MARCA_INICIO}\n{"tipo":"lectura","sello":"criterio mío","texto":"Lider es la cuenta que más vende de la cartera"}\n${MARCA_FIN}`],
  ];
  for (const [nombre, salida] of casos) {
    const r = await turno(P1, [salida, salida]);
    const a = r.r.agente;
    const k = kindsDe(a);
    ok(k.some((x) => /declaracion-inconsistente|declaracion-ajena|afirmacion-no-declarada|lectura-encubre-hecho|afirmacion-falsa/.test(x)) && a.estado !== "verde", `${nombre}: la prosa falsa no se sirve como verdadera (${k.filter((x) => /declaracion|afirmacion|lectura/.test(x)).slice(0, 2).join(", ")} · estado ${a.estado})`);
  }
}

/* ═══ D · DECLARACIÓN PARCIAL ════════════════════════════════════════════════════════════════════════════════════════════ */
H("D · DECLARACIÓN PARCIAL: se quita un tercio de las afirmaciones de hecho → el detector cobra la omisión");
{
  let detectadas = 0, total = 0, omitidasMedidas = 0, quitadas = 0;
  for (const id of ids) {
    const c = S.corpus.find((x) => x.id === id && x.sitio === "cierre");
    const F = leer(c.fixture);
    const parcial = c.afirmaciones.filter((a, i) => !FACTUALES.has(a.tipo) || i % 3 !== 0);
    quitadas += c.afirmaciones.length - parcial.length;
    const salida = `${F.borradores[c.borrador - 1].texto}\n\n${bloque(parcial)}`;
    const r = await turno(F.pregunta, [salida, salida]);
    const p = pasoDe(r.r.agente, "cierre");
    total++;
    if (p && p.vetos.includes("afirmacion-no-declarada")) detectadas++;
    if (p) omitidasMedidas += p.medidas.omitidos;
  }
  console.log(`  quitadas ${quitadas} afirmaciones de hecho en ${total} borradores → omisiones medidas: ${omitidasMedidas} · borradores con omisión cobrada: ${detectadas}/${total}`);
  ok(detectadas === total, `en todos los borradores con declaración parcial el detector cobra la omisión (${detectadas}/${total})`);
}

/* ═══ E · LÍNEA BASE ═════════════════════════════════════════════════════════════════════════════════════════════════════ */
const base = S.linea_base_flujo || null;
if (base) {
  ok(M.omitidos <= base.omitidos, `omisiones dentro del flujo sin regresión (${base.omitidos}): hoy ${M.omitidos}`);
  ok(M.verdaderas + M.selladas >= base.correctas, `declaraciones correctas sin regresión (${base.correctas}): hoy ${M.verdaderas + M.selladas}`);
} else ok(true, "sin línea base del flujo todavía (se fija al cerrar la fase 2)");

console.log(`\n── _notario_semantico_flujo_gate: ${PASS} PASS · ${FAIL} FAIL (de ${PASS + FAIL}) ──`);
process.exit(FAIL ? 1 : 0);
