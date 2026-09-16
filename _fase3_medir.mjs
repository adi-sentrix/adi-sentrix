/* _fase3_medir.mjs · NOTARIO SEMÁNTICO · FASE 3 · LA MEDICIÓN (offline, sin red) ═══════════════════════════════════════════════════
 * Lee fixtures/notario-fase3-vivo-2026-09-15.json (la corrida en vivo) y mide lo que el owner pidió:
 *   · la declaración del MODELO real: cuánto declara, cuánto verifica, cuánto omite (detector de presencia + extractor independiente);
 *   · FP/FN del Notario semántico: cada veredicto del verificador se lista para el etiquetado manual (fixtures/notario-fase3-etiquetas…);
 *   · contradicciones prosa↔declaración (declaracion-ajena · declaracion-inconsistente · lectura-encubre-hecho);
 *   · cuántas respuestas llegaron a reparación / poda / respaldo y por qué (los vetos de cada paso);
 *   · hechos servidos sin declaración válida (las medidas del paso servido);
 *   · costo y latencia (por llamada y por turno).
 * Uso: node --import ./scripts/offline-guard.mjs _fase3_medir.mjs [--detalle] [--veredictos] [--omisiones] */
import fs from "node:fs";
import { initTenant } from "./src/data/tenantStore.js";
import { TENANT_DEMO } from "./src/data/tenants/demo.js";
import { ESCENARIO_INICIAL } from "./src/config/scenarios.js";
import { cifrasDelDato } from "./src/adi/oracle/datoProyectado.js";
import { axisEntityNames } from "./src/adi/oracle/entityIndex.js";
import { juzgarDeclaracion } from "./src/adi/notario/juez.js";
import { normalizar } from "./src/adi/notario/afirmacion.js";
import { parseFigures } from "./src/adi/boleta.js";

initTenant(TENANT_DEMO);
const C = JSON.parse(fs.readFileSync("fixtures/notario-fase3-vivo-2026-09-15.json", "utf8"));
const ETQ = fs.existsSync("fixtures/notario-fase3-etiquetas-2026-09-15.json") ? JSON.parse(fs.readFileSync("fixtures/notario-fase3-etiquetas-2026-09-15.json", "utf8")) : null;
const args = new Set(process.argv.slice(2));
const ejes = {}; for (const e of ["cliente", "sku", "marca", "familia", "bodega", "canal"]) { try { const n = axisEntityNames(e); if (n && n.length) ejes[e] = n; } catch { /* sin índice */ } }
const nombres = Object.values(ejes).flat();
const DATO = cifrasDelDato(ESCENARIO_INICIAL);
const pct = (a, b) => (b ? `${((100 * a) / b).toFixed(1)} %` : "—");

/* ── 1 · los pasos del modelo, re-juzgados offline con la boleta de esa llamada (veredicto por afirmación) ── */
const piezas = [];   // {i, sitio, prosa, afirmaciones, J, llamada}
for (const t of C.turnos) {
  const textos = (t.llamadas || []).filter((l) => l.tipo === "texto" && l.declaracion);
  textos.forEach((l, k) => {
    const sitio = k === 0 ? "cierre" : k === 1 ? "reparacion" : `re-cierre-${k}`;
    const prosa = String(l.declaracion.respuesta || "");
    if (!prosa.trim()) return;
    const J = juzgarDeclaracion(prosa, l.declaracion.afirmaciones, { figs: l.figs || [], datoProyectado: DATO, ejesDelTenant: ejes, nombres, sitio, derivada: false });
    piezas.push({ i: t.i, sitio, prosa, afirmaciones: l.declaracion.afirmaciones || [], errores: l.declaracion.errores || [], bloque: l.declaracion.bloque, J, llamada: l });
  });
}

const M = { piezas: piezas.length, declaradas: 0, factuales: 0, verdaderas: 0, falsas: 0, nv: 0, selladas: 0, inconsistentes: 0, ajenas: 0, encubre: 0, puntos: 0, cubiertos: 0, omitidos: 0, sinBloque: 0, erroresDeBloque: 0 };
const kinds = {};
for (const p of piezas) {
  const m = p.J.medidas || {};
  M.declaradas += m.declaradas || 0; M.factuales += m.factuales || 0; M.verdaderas += m.verdaderas || 0; M.falsas += m.falsas || 0; M.nv += m.noVerificables || 0;
  M.selladas += m.selladas || 0; M.inconsistentes += m.inconsistentes || 0; M.puntos += m.puntos || 0; M.cubiertos += m.cubiertos || 0; M.omitidos += m.omitidos || 0;
  if (!p.bloque) M.sinBloque++;
  M.erroresDeBloque += (p.errores || []).length;
  for (const v of p.J.violations) { kinds[v.kind] = (kinds[v.kind] || 0) + 1; if (v.kind === "declaracion-ajena") M.ajenas++; if (v.kind === "lectura-encubre-hecho") M.encubre++; }
}
const porSitio = (s) => piezas.filter((p) => p.sitio === s);
const resumenSitio = (s) => { const ps = porSitio(s); const m = ps.reduce((a, p) => { const x = p.J.medidas || {}; for (const k of ["declaradas", "factuales", "verdaderas", "falsas", "noVerificables", "selladas", "inconsistentes", "puntos", "cubiertos", "omitidos"]) a[k] = (a[k] || 0) + (x[k] || 0); return a; }, {}); return { n: ps.length, ...m, limpias: ps.filter((p) => p.J.ok).length }; };

console.log("═══ FASE 3 · EL MODELO REAL (Sonnet 5) · 12 prompts nuevos · corrida 2026-09-15 ═══");
console.log(`llamadas ${C.contador.llamadas} · gasto US$${C.contador.usd.toFixed(3)} (tope 30 · US$3) · turnos ${C.turnos.length} · piezas del modelo juzgadas: ${piezas.length} (cierres ${porSitio("cierre").length} · reparaciones ${porSitio("reparacion").length})`);

console.log("\n1 · LA DECLARACIÓN DEL MODELO (todas las piezas: cierre + reparación)");
console.log(`  bloque presente: ${piezas.length - M.sinBloque}/${piezas.length} · líneas inválidas en el bloque: ${M.erroresDeBloque}`);
console.log(`  declaradas ${M.declaradas} (de hecho ${M.factuales}) · verdaderas ${M.verdaderas} · falsas ${M.falsas} · no-verificables ${M.nv} · selladas ${M.selladas} · inconsistentes ${M.inconsistentes} · ajenas ${M.ajenas}`);
console.log(`  tasa de declaraciones correctas (verdaderas + selladas) / declaradas: ${pct(M.verdaderas + M.selladas, M.declaradas)} · sobre las de hecho: ${pct(M.verdaderas, M.factuales)}`);
console.log(`  omisión según el detector de presencia: ${M.omitidos}/${M.puntos} puntos de la prosa sin declarar = ${pct(M.omitidos, M.puntos)}`);
for (const s of ["cierre", "reparacion"]) { const r = resumenSitio(s); console.log(`  · ${s}: ${r.n} piezas · declaradas ${r.declaradas} · verdaderas ${r.verdaderas} · falsas ${r.falsas} · nv ${r.noVerificables} · selladas ${r.selladas} · inconsistentes ${r.inconsistentes} · omitidos ${r.omitidos}/${r.puntos} (${pct(r.omitidos, r.puntos)}) · piezas sin veto: ${r.limpias}/${r.n}`); }
console.log(`  vetos por clase: ${JSON.stringify(kinds)}`);

/* ── 2 · el extractor independiente (Opus 5, solo la prosa) contra lo declarado por el modelo ── */
const _num = (s) => { const f = parseFigures(String(s || "").replace(/[−–]/g, "-")); return f.length ? f[0] : null; };
const _tok = (s) => normalizar(String(s || "")).replace(/[^a-z0-9 ]/g, " ").split(/\s+/).filter((w) => w.length >= 3);
const _sujeto = (a) => Array.isArray(a.sujeto) ? a.sujeto.map((x) => normalizar(x)) : [normalizar(a.sujeto || "negocio")];
const _mismoValor = (x, y) => { if (!x || !y) return false; if ((x.unit === y.unit) || (/pct|pp/.test(x.unit) && /pct|pp/.test(y.unit))) return Math.abs(x.raw - y.raw) <= Math.max(1e-9, Math.abs(y.raw) * 0.02); return false; };
const _valorDe = (a) => _num(a.valor || (a.variacion && a.variacion.valor) || (a.relacion && a.relacion.valor) || "");
const FAMILIA = { cifra: "cifra", variacion: "cifra", relacion: "relacion", orden: "orden", grupo: "grupo", conteo: "conteo", estado: "estado" };
const _valoresDe = (x) => { const out = []; for (const v of [x.valor, x.variacion && x.variacion.valor, x.relacion && x.relacion.valor]) if (v) for (const g of parseFigures(String(v).replace(/[\u2212\u2013]/g, "-"))) out.push(g); return out; };
const _ESTADOS_DEL_NEGOCIO = /frenad|inmoviliz|sobrestock|quiebre|sano|en rango|vencid|al d[ií]a|mora|cr[ií]tic|activo|bajo el benchmark|sobre el nivel|sobre la referencia/i;
const esRuido = (e) => e.tipo === "estado" && !_ESTADOS_DEL_NEGOCIO.test(String((e.estado && e.estado.estado) || "") + " " + String(e.metrica || "") + " " + String(e.texto || ""));
const casa = (e, d) => {
  if (d.tipo === "lectura") return false;
  const se = _sujeto(e), sd = _sujeto(d);
  const sujetoOk = se.some((x) => sd.some((y) => x === y || x.includes(y) || y.includes(x))) || (sd.includes("negocio") && se.includes("negocio"));
  const ve = _valoresDe(e), vd = _valoresDe(d);
  const te = _tok(e.metrica), td = _tok(d.metrica);
  const metricaOk = te.some((w) => td.some((v) => v.startsWith(w.slice(0, 5)) || w.startsWith(v.slice(0, 5))));
  /* la misma cifra en la declaración (en cualquiera de sus valores, o en el texto declarado) y el mismo sujeto, la misma métrica o el mismo tramo */
  if (ve.length) {
    const enDecl = (g) => vd.some((h) => _mismoValor(g, h)) || parseFigures(String(d.texto || "")).some((h) => _mismoValor(g, h));
    if (ve.every(enDecl) && (sujetoOk || metricaOk || normalizar(String(d.texto || "")).includes(normalizar(String(e.texto || "")).slice(0, 25)))) return true;
    if (ve.some(enDecl) && sujetoOk && metricaOk) return true;
  }
  if (!ve.length) {
    /* un conteo extraído cuyo número vive en el universo de un orden o conteo declarado («los 13 clientes», «las 5 cuentas materiales») */
    if (e.tipo === "conteo") { const n = e.conteo && e.conteo.n; const nums = String(e.texto || "").match(/\d+/g) || []; const cand = n != null ? [String(n), ...nums] : nums; if (cand.length && (d.tipo === "orden" || d.tipo === "conteo" || d.tipo === "grupo") && cand.some((k) => new RegExp("\\b" + k + "\\b").test(String(d.universo || "") + " " + String((d.conteo && d.conteo.n) ?? "") + " " + String((d.conteo && d.conteo.m) ?? "") + " " + String((d.grupo && d.grupo.n) ?? "")))) return true; }
    if (!sujetoOk) return false;
    if (e.tipo === "orden" && d.tipo === "orden") return true;
    if (e.tipo === "relacion" && (d.tipo === "relacion" || d.tipo === "orden")) return metricaOk || !te.length;
    if (e.tipo === "estado" && d.tipo === "estado") return true;
    if (e.tipo === "conteo" && (d.tipo === "conteo" || d.tipo === "grupo")) { const ne = e.conteo && e.conteo.n, nd = (d.conteo && d.conteo.n) ?? (d.grupo && d.grupo.n); return ne == null || nd == null || Number(ne) === Number(nd); }
    if (e.tipo === "grupo" && (d.tipo === "grupo" || d.tipo === "conteo" || d.tipo === "orden" || d.tipo === "estado")) return true;
    if (e.tipo === "variacion" && (d.tipo === "variacion" || d.tipo === "relacion")) return true;
    if (FAMILIA[e.tipo] === FAMILIA[d.tipo]) return metricaOk;
  }
  return false;
};
const omis = { piezas: 0, extraidas: 0, declaradasPorExtractor: 0, omitidasCrudas: 0, porTurno: [] };
for (const x of C.extractor) {
  const p = piezas.find((q) => q.i === x.i && q.sitio === x.sitio); if (!p) continue;
  const E = (x.afirmaciones || []).filter((e) => e && e.tipo && e.tipo !== "lectura" && !esRuido(e));
  omis.ruido = (omis.ruido || 0) + (x.afirmaciones || []).filter((e) => e && e.tipo && e.tipo !== "lectura" && esRuido(e)).length;
  const D = p.afirmaciones || [];
  const noDecl = E.filter((e) => !D.some((d) => casa(e, d)));
  omis.piezas++; omis.extraidas += E.length; omis.declaradasPorExtractor += E.length - noDecl.length; omis.omitidasCrudas += noDecl.length;
  omis.porTurno.push({ i: x.i, sitio: x.sitio, extraidas: E.length, omitidas: noDecl.length, lista: noDecl });
}
console.log("\n2 · OMISIÓN SEGÚN EL EXTRACTOR INDEPENDIENTE (Opus 5, ve solo la prosa del modelo)");
console.log(`  piezas ${omis.piezas} · apartadas como ruido del extractor (estados que no son del negocio: huella, mecanismo, fecha…) ${omis.ruido || 0} · afirmaciones de hecho extraídas ${omis.extraidas} · con declaración del modelo que las cubre ${omis.declaradasPorExtractor} · sin cubrir (omisión cruda) ${omis.omitidasCrudas} = ${pct(omis.omitidasCrudas, omis.extraidas)}`);
if (ETQ && ETQ.omisiones) {
  const rev = ETQ.omisiones;   // {total, reales, ruidoDelExtractor, nota}
  console.log(`  revisión manual de las ${rev.total} omisiones crudas: ${rev.reales} omisiones REALES del modelo · ${rev.ruidoDelExtractor} ruido del extractor (la misma afirmación partida, un fragmento de lectura, un valor ya declarado con otra forma) → omisión real ${pct(rev.reales, omis.extraidas)}`);
}
for (const t of omis.porTurno) console.log(`  · turno ${t.i} ${t.sitio}: ${t.omitidas}/${t.extraidas} sin cubrir`);
if (args.has("--omisiones")) for (const t of omis.porTurno) for (const e of t.lista) console.log(`    [${t.i} ${t.sitio}] ${e.tipo} · ${JSON.stringify(e.sujeto)} · ${e.metrica || ""} · ${e.valor || (e.variacion && e.variacion.valor) || ""} · «${String(e.texto || "").slice(0, 80)}»`);

/* ── 3 · contradicciones prosa ↔ declaración ── */
console.log("\n3 · PROSA ↔ DECLARACIÓN");
const contra = piezas.map((p) => ({ i: p.i, sitio: p.sitio, ajena: p.J.violations.filter((v) => v.kind === "declaracion-ajena").length, inconsistente: p.J.violations.filter((v) => v.kind === "declaracion-inconsistente").length, encubre: p.J.violations.filter((v) => v.kind === "lectura-encubre-hecho").length }));
const tot = (k) => contra.reduce((n, x) => n + x[k], 0);
console.log(`  declaración ajena (el fragmento declarado no está en la prosa): ${tot("ajena")} · inconsistente (la frase dice otra cosa que la declaración): ${tot("inconsistente")} · lectura que encubre un hecho: ${tot("encubre")} · piezas con alguna: ${contra.filter((x) => x.ajena + x.inconsistente + x.encubre > 0).length}/${piezas.length}`);

/* ── 4 · la escalera: qué se sirvió y por qué ── */
console.log("\n4 · LA ESCALERA (cierre → reparación → poda → respaldo)");
const est = {}; for (const t of C.turnos) est[t.estado || "error"] = (est[t.estado || "error"] || 0) + 1;
console.log(`  estados servidos: ${JSON.stringify(est)} (verde/reparado = la prosa del modelo entera · podado = la prosa del modelo sin las oraciones vetadas · playbook/limite = el respaldo determinístico)`);
for (const t of C.turnos) {
  const pasos = (t.notario && t.notario.pasos) || [];
  const c = pasos.find((p) => p.sitio === "cierre"), r = pasos.find((p) => p.sitio === "reparacion");
  console.log(`  · turno ${t.i} [${t.estado || "ERROR: " + (t.cortado || t.error)}] «${t.pregunta.slice(0, 58)}» · cierre: ${c ? `${c.vetos.length} vetos (${[...new Set(c.vetos)].join(", ")})` : "—"} · reparación: ${r ? `${r.vetos.length} vetos (${[...new Set(r.vetos)].join(", ")})` : "—"}`);
}

/* ── 5 · lo servido: ¿algún hecho sin declaración válida? ── */
console.log("\n5 · LO SERVIDO");
let servidosConProblema = 0;
for (const t of C.turnos) {
  const s = t.notario && t.notario.servido; if (!s) { console.log(`  · turno ${t.i}: sin texto servido (${t.cortado || t.error || "?"})`); continue; }
  const m = s.medidas || {};
  const problema = (m.falsas || 0) + (m.noVerificables || 0) + (m.omitidos || 0) + (m.inconsistentes || 0) + (m.sinDeclaracion ? 1 : 0);
  if (problema) servidosConProblema++;
  console.log(`  · turno ${t.i} [${s.sitio}]: declaradas ${m.declaradas} · verdaderas ${m.verdaderas} · falsas ${m.falsas} · nv ${m.noVerificables} · omitidos ${m.omitidos}/${m.puntos} · ${problema ? "⚠ con problema" : "limpio"}`);
}
console.log(`  respuestas servidas con algún hecho falso, no verificable o sin declarar: ${servidosConProblema}/${C.turnos.filter((t) => t.notario && t.notario.servido).length}`);

/* ── 6 · costo y latencia ── */
console.log("\n6 · COSTO Y LATENCIA");
const L = C.turnos.flatMap((t) => (t.llamadas || []).map((l) => ({ ...l, i: t.i })));
const sum = (arr, f) => arr.reduce((n, x) => n + (Number(f(x)) || 0), 0);
const agIn = sum(L, (l) => l.usage && l.usage.input_tokens), agCache = sum(L, (l) => l.usage && l.usage.cache_read_input_tokens), agOut = sum(L, (l) => l.usage && l.usage.output_tokens);
const agUsd = sum(L, (l) => l.usd), agCasa = sum(L, (l) => l.usdCasa), exUsd = sum(C.extractor, (x) => x.usd);
const turnosOk = C.turnos.filter((t) => !t.error);
console.log(`  agente: ${L.length} llamadas · tokens entrada ${agIn} (+ ${agCache} leídos del caché) · salida ${agOut} · US$${agUsd.toFixed(3)} contando el caché (tabla de la casa sin caché: US$${agCasa.toFixed(3)}) · latencia media por llamada ${(sum(L, (l) => l.ms) / L.length / 1000).toFixed(1)} s · por turno ${(sum(turnosOk, (t) => t.ms) / turnosOk.length / 1000).toFixed(1)} s (${turnosOk.length} turnos completos)`);
console.log(`  extractor (Opus 5): ${new Set(C.extractor.map((x) => x.ms + ":" + x.i)).size >= 0 ? C.extractor.length : 0} piezas en ${C.contador.llamadas - L.length} llamadas · US$${exUsd.toFixed(3)}`);
console.log(`  total: ${C.contador.llamadas} llamadas · US$${C.contador.usd.toFixed(3)} · costo medio por turno del agente US$${(agUsd / turnosOk.length).toFixed(3)}`);

/* ── 7 · los veredictos, uno por uno (para el etiquetado manual de FP/FN) ── */
if (args.has("--veredictos")) {
  console.log("\n7 · VEREDICTOS DEL VERIFICADOR, UNO POR UNO (para etiquetar FP/FN)");
  for (const p of piezas) {
    console.log(`\n■ turno ${p.i} · ${p.sitio}`);
    (p.J.veredictos || []).forEach((v, k) => { const a = p.afirmaciones[k] || {}; console.log(`  [${p.i}.${p.sitio}.${k}] ${String(v.veredicto).toUpperCase()} · ${a.tipo} · ${JSON.stringify(a.sujeto)} · ${a.metrica || ""} · ${a.valor || (a.variacion && a.variacion.valor) || (a.conteo && a.conteo.n) || ""} · «${String(a.texto || "").slice(0, 70)}» → ${String(v.motivo || "").slice(0, 200)}${v.verdad ? ` · verdad: ${String(v.verdad).slice(0, 120)}` : ""}`); });
  }
}
if (ETQ && ETQ.veredictos) {
  const e = ETQ.veredictos;
  console.log(`\n8 · FP/FN DEL NOTARIO SEMÁNTICO (etiquetado manual de ${e.revisados} declaraciones de hecho)`);
  console.log(`  falsos negativos (falsa dictada verdadera): ${e.fn} = ${pct(e.fn, e.revisados)}`);
  console.log(`  falsos positivos ESTRICTOS (declaración bien formada, evidencia en la boleta, veredicto errado): ${e.fp} = ${pct(e.fp, e.revisados)}`);
  console.log(`  rigidez (hecho verdadero y verificable, bloqueado por la FORMA de la declaración): ${e.rigidez} = ${pct(e.rigidez, e.revisados)} → FP + rigidez: ${e.fp + e.rigidez} = ${pct(e.fp + e.rigidez, e.revisados)}`);
  console.log(`  falsas confirmadas (el modelo se equivocó y el Notario lo cazó): ${e.falsasConfirmadas} · no-verificables legítimos (sin evidencia o declaración incompleta): ${e.nvLegitimos}`);
  for (const x of e.defectosSinVeredictoErrado || []) console.log(`  · defecto sin veredicto errado: ${x}`);
  console.log("  ejemplos:"); for (const x of e.ejemplos || []) console.log(`  · ${x}`);
}
if (ETQ && ETQ.omisiones) { console.log("\n9 · EJEMPLOS DE OMISIÓN REAL DEL MODELO"); for (const x of ETQ.omisiones.ejemplos || []) console.log(`  · ${x}`); }
if (args.has("--detalle")) for (const p of piezas) { console.log(`\n══ turno ${p.i} · ${p.sitio} ══\n${p.prosa}\n-- vetos: ${p.J.violations.map((v) => v.kind + ": " + String(v.detail).slice(0, 160)).join("\n   ")}`); }
