/* === _struct_gate.mjs · GATE de ESTRUCTURA · contrato de respuesta ===
 * Fase 1: diagnose_value_leak. Fase 2a: overview_domain(inv) + rank_business_entity. Fase 2b: dive_entity + compare_entities.
 * Fase 2c: overview_domain COMERCIAL (composeRetrieval · ventas/margen por cliente).
 * Valida: estructura ejecutiva (no pelada) por contrato, reading-forward comercial, volumen vs valor, honestidad de snapshot,
 * diferencia por intención, graduación (no inventa), number-safety y bloque honesto. NO-contaminación: una ruta RICA
 * (dispatchIntent) NO lleva _contract (el closer no la tocó).
 * Uso: node _struct_gate.mjs   (exit 1 si algún test falla · CI). Complementa _spec_gate (rutas) y _guard_gate (cifras). */
import esbuild from "esbuild"; import { pathToFileURL } from "url"; import path from "path"; import fs from "fs";
const root = process.cwd();
async function bundle(entry, tag) {
  const out = path.join(root, `_stg_${tag}.mjs`);
  await esbuild.build({ entryPoints: [path.join(root, entry)], bundle: true, outfile: out, format: "esm", platform: "node", logLevel: "silent" });
  const M = await import(pathToFileURL(out).href + "?t=" + Math.random());
  try { fs.unlinkSync(out); } catch {}
  return M;
}
const A = (await bundle("src/adi/answerADIFromSpec.js", "a")).answerADIFromSpec;

const S = (o) => ({ schemaVersion: 1, scenario: "actual", filters: {}, ...o });
const has = (t, re) => re.test(String(t || ""));
const isPelado = (t) => !has(t, /Porqu[eé]|Prioridad|Palanca|Pr[oó]ximo paso|Lectura|Tendencia|Concentraci[oó]n|Se[ñn]al|Patr[oó]n|Brecha|Advertencia|Siguiente|Tensi[oó]n|Mecanismo|Evidencia|Certeza|Diferencia principal|Ganador|Decisi[oó]n|Impacto|volumen|valor|Recomendaci[oó]n|Fundamento|Trade-off|Primer paso/i);
const numSafe = (r) => (r.evidence && r.evidence._contract) ? r.evidence._contract.guard === "ok" : true;
const wrapped = (r) => !!(r.evidence && r.evidence._contract);

const TESTS = []; const push = (n, ok, dbg) => TESTS.push({ n, ok: !!ok, dbg });

const rd = A(S({ operation: "diagnose", metric: "contribucion", dimension: "cliente" }), {}, {});
const ro = A(S({ operation: "overview", metric: "capital",      dimension: "bodega"  }), {}, {});
const rr = A(S({ operation: "rank",     metric: "margen",       dimension: "marca", limit: 3, sort: { by: "margen", dir: "desc" } }), {}, {});
const rv = A(S({ operation: "dive",     metric: null,           dimension: "sku",    entity: "SAM-REF500L" }), {}, {});
const rc = A(S({ operation: "compare",  metric: "margen",       dimension: "sku",    comparison: { dimension: "sku", entities: ["SAM-REF500L", "SAM-TV55"] } }), {}, {});
const rq = A(S({ operation: "overview", metric: "ventas",       dimension: "cliente" }), {}, {});   // COMERCIAL volumen
const rm = A(S({ operation: "overview", metric: "margen",       dimension: "cliente" }), {}, {});   // COMERCIAL valor
const rx = A(S({ operation: "rank",     metric: "ventas",       dimension: "cliente", limit: 5, sort: { by: "ventas", dir: "desc" } }), {}, {}); // RICA (dispatchIntent) · ref no-contaminación
const rh = A(S({ operation: "diagnose", metric: "contribucion", dimension: "cliente", filters: { familia: "__no-existe__" } }), {}, {});
const rw  = A(S({ operation: "why", dimension: "sku",     entity: "LG-DRYER8KG" }), {}, {});                     // why sku (inventario)
const rwc = A(S({ operation: "why", dimension: "cliente", entity: "Falabella", metric: "margen" }), {}, {});     // why cliente scoped
const rwb = A(S({ operation: "why", dimension: "cliente" }), {}, {});                                            // why book-wide (reusa determinístico)
const rwn = A(S({ operation: "why", dimension: "sku" }), {}, {});                                                // why sin entidad → bloqueo honesto
const rr1 = A(S({ operation: "recommend", dimension: "cliente" }), {}, {});                                      // recommend cartera (palanca probada)
const rr2 = A(S({ operation: "recommend", dimension: "cliente", entity: "Mercado Libre" }), {}, {});             // recommend sin foco → honesto
const td=rd.text||"", to=ro.text||"", tr=rr.text||"", tv=rv.text||"", tc=rc.text||"", tq=rq.text||"", tm=rm.text||"", tw=rw.text||"", twc=rwc.text||"", tr1=rr1.text||"";

// diagnose (Fase 1)
push("1 · diagnose · 6 slots ejecutivos", has(td,/Diagn[oó]stico|foco/i)&&has(td,/\$/)&&has(td,/Porqu[eé]/i)&&has(td,/Palanca/i)&&has(td,/Prioridad/i)&&has(td,/Pr[oó]ximo paso/i), td.slice(0,60));
push("2 · diagnose · gradúa (no inventa causa)", has(td,/necesita el detalle|no puedo cerrar la causa|la se[ñn]al apunta/i), "");
push("3 · diagnose · number-safe", numSafe(rd), "");
// overview inventario (Fase 2a)
push("4 · overview inv · ejecutivo (concentración+señal)", has(to,/Concentraci[oó]n/i)&&has(to,/Se[ñn]al/i)&&!isPelado(to), to.slice(0,60));
push("5 · overview inv · number-safe", numSafe(ro), "");
// rank (Fase 2a)
push("6 · rank · ejecutivo (patrón+brecha)", has(tr,/Patr[oó]n/i)&&has(tr,/Brecha/i)&&!isPelado(tr), tr.slice(0,60));
push("7 · rank · number-safe", numSafe(rr), "");
// dive (Fase 2b)
push("8 · dive · ejecutivo (tensión+mecanismo)", has(tv,/Tensi[oó]n/i)&&has(tv,/Mecanismo/i)&&!isPelado(tv), tv.slice(0,60));
push("9 · dive · number-safe", numSafe(rv), "");
// compare (Fase 2b)
push("10 · compare · ejecutivo (diferencia+decisión)", has(tc,/Diferencia principal/i)&&has(tc,/Decisi[oó]n/i)&&!isPelado(tc), tc.slice(0,60));
push("11 · compare · number-safe", numSafe(rc), "");
// overview COMERCIAL (Fase 2c)
push("12 · overview com · READING-FORWARD (no sale como tabla)", tq.slice(0,45).includes("Lectura general")&&!isPelado(tq), tq.slice(0,45));
push("13 · overview com · distingue volumen de valor", has(tq,/volumen/i)&&has(tm,/valor/i), "");
push("14 · overview com · honestidad de snapshot (no inventa evolución)", has(tq,/snapshot|sin evoluci[oó]n/i), "");
push("15 · overview com · number-safe", numSafe(rq)&&numSafe(rm), "");
// diferencia por intención + NO-contaminación
push("16 · diagnose ≠ overview (marcadores distintos)", has(td,/foco/i)&&!has(to,/foco/i), "");
push("17 · NO-contaminación: ruta RICA (rank ventas@cliente) sin _contract", !wrapped(rx), "el closer tocó una ruta rica");
// bloque honesto
push("18 · bloque honesto NO se envuelve (closer no-op en _degrade)", /^spec_blocked/.test(rh.route||"")&&isPelado(rh.text), `route=${rh.route}`);
// why_mechanism (Fase 3a)
push("19 · why sku · ejecutivo (mecanismo + certeza · explica causa, no repite síntoma)", has(tw,/Mecanismo/i)&&has(tw,/Certeza/i)&&!isPelado(tw), tw.slice(0,60));
push("20 · why sku · gradúa (probado / la señal apunta / no puedo afirmar)", has(tw,/probado por el dato|la se[ñn]al apunta|no puedo afirmar/i), "");
push("21 · why sku · number-safe", numSafe(rw), "");
push("22 · why cliente · explica causa (mecanismo + evidencia + certeza)", has(twc,/Mecanismo/i)&&has(twc,/Evidencia/i)&&has(twc,/Certeza/i), twc.slice(0,60));
push("23 · why cliente · number-safe", numSafe(rwc), "");
push("24 · why book-wide REUSA el mecanismo determinístico (route cross_domain · sin _contract)", rwb.route==="cross_domain_mechanism"&&!wrapped(rwb), `route=${rwb.route}`);
push("25 · why sin entidad → bloqueo honesto (no fabrica · closer no lo envuelve)", /^spec_blocked/.test(rwn.route||"")&&!wrapped(rwn), `route=${rwn.route}`);
// recommend_action (Fase 3b · el de mayor riesgo)
push("26 · recommend · ejecutivo (recomendación + fundamento probado + trade-off)", has(tr1,/Recomendaci[oó]n/i)&&has(tr1,/probado por el dato/i)&&has(tr1,/Trade-off/i)&&!isPelado(tr1), tr1.slice(0,60));
push("27 · recommend · recomienda palanca PROBADA (carga), no una solución de margen inventada", has(tr1,/carga comercial hacia el target|capital dormido/i)&&!has(tr1,/sub[íi] el margen|baj[áa] el costo/i), tr1.slice(0,60));
push("28 · recommend · trade-off nombra el riesgo que el dato NO predice", has(tr1,/no predice|no dice a qué precio/i), "");
push("29 · recommend · number-safe", numSafe(rr1), "");
push("30 · recommend · sin foco material → bloqueo honesto (no inventa solución)", /^spec_blocked/.test(rr2.route||"")&&!wrapped(rr2), `route=${rr2.route}`);

let pass=0, fail=0; const outl=[];
for (const t of TESTS){ if(t.ok)pass++; else fail++; outl.push(`  ${t.ok?"✓":"✗"} ${t.n}${t.ok?"":`   → ${t.dbg}`}`); }
console.log(`── _struct_gate: PASS ${pass} · FAIL ${fail} (de ${TESTS.length}) ──`);
console.log(outl.join("\n"));
process.exit(fail ? 1 : 0);
