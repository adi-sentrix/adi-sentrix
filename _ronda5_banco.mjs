/* === _ronda5_banco.mjs · EL BANCO DE LA RONDA 5 (verdad finita · v3.1 · 2026-09-17, offline) ═══════════════════════════════════════════════
 * NO es un gate (no entra a la suite: tarda ~30 min). Es la MEDIDA del plan §4 sobre los 888 casos de la ronda 5 (fixtures/ronda5-2026-09-17):
 *   · turno (7 ángulos, cerebro guionado): falsedades servidas / ataques · verdaderos verdes a la primera · verdaderos al respaldo · llamadas
 *   · hechos (canal 1): hechos falsos que salen «verdadera» · hechos verdaderos que no
 *   · casa (respaldo): composer mentiroso o descuidado anclado por anclar.js → servido con falsedad
 * Excluye lo que los escépticos refutaron (sintesis.json). Escribe el detalle en <salida> (JSON) y resume por ángulo.
 * Solo con el candado: node --import ./scripts/offline-guard.mjs _ronda5_banco.mjs [salida.json] [--solo angulo,angulo] [--cada N]. Cero red. */
import fs from "node:fs";
import { initTenant } from "./src/data/tenantStore.js";
import { TENANT_DEMO } from "./src/data/tenants/demo.js";
import { ESCENARIO_INICIAL } from "./src/config/scenarios.js";
import { cifrasDelDato } from "./src/adi/oracle/datoProyectado.js";
import { axisEntityNames } from "./src/adi/oracle/entityIndex.js";
import { runPlan } from "./src/adi/oracle/toolRunner.js";
import { TOOLS } from "./src/adi/oracle/toolRegistry.js";
import { cajaDelAgente } from "./src/adi/agente/herramientasAgente.js";
import { playbookPara, pasosDe } from "./src/adi/agente/playbooks/registro.js";
import { partesDelEncargo, pasosDelEncargo } from "./src/adi/agente/encargoCompuesto.js";
import { dominiosDe, pasosDeDominios, unirPasosDeDominios } from "./src/adi/agente/contratoDeDominios.js";
import { answerViaAgente } from "./src/adi/agente/bucleAgente.js";
import { indiceDeEvidencia } from "./src/adi/notario/evidencia.js";
import { libroDeHechos, asignarIds } from "./src/adi/notario/hechos.js";
import { comprobarAnclas } from "./src/adi/notario/anclas.js";
import { anclarDeclaracion, anclarPorFigs } from "./src/adi/notario/anclar.js";
import { crearDeclarador, filtrarPorTexto } from "./src/adi/notario/declarar.js";

initTenant(TENANT_DEMO);
const DIR = new URL("./fixtures/ronda5-2026-09-17/", import.meta.url);
const leer = (f) => JSON.parse(fs.readFileSync(new URL(f, DIR), "utf8"));
const args = process.argv.slice(2);
const salida = args.find((a) => !a.startsWith("--")) || null;
const solo = (() => { const i = args.indexOf("--solo"); return i >= 0 ? new Set(args[i + 1].split(",")) : null; })();
const cada = (() => { const i = args.indexOf("--cada"); return i >= 0 ? Math.max(1, +args[i + 1]) : 1; })();
const soloIds = (() => { const i = args.indexOf("--ids"); return i >= 0 ? new Set(args[i + 1].split(",")) : null; })();
const verbose = args.includes("--verbose");
const idPedido = (id) => !soloIds || [...soloIds].some((x) => String(id).startsWith(x));
/* un esperado compuesto: «verdadera|no-verificable» admite cualquiera; «no-verdadera» admite todo menos verdadera/sellada */
const cumple = (esperado, veredicto) => String(esperado).split("|").some((e) => (e === "no-verdadera" ? !/^(?:verdadera|sellada)$/.test(veredicto) : e === veredicto));
const norm = (t) => String(t || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/(\d),(\d)/g, "$1.$2").replace(/\s+/g, " ").trim();

/* ── lo refutado por los escépticos no cuenta (ni como ataque ni como verdadero) ── */
const S = leer("sintesis.json");
const PREF = { CM: "comercial", CB: "cobranza", IN: "inventario", CR: "cruces", HE: "hechos", RE: "respaldo", VE: "verdaderos", FL: "flujo" };
const excluidos = new Set();
const registrar = (s) => { const m = /^([A-Z]{2})\s+(.+)$/.exec(String(s).trim()); if (!m || !PREF[m[1]]) return; for (const id of m[2].split(/\s*\/\s*/)) excluidos.add(`${PREF[m[1]]}:${id.trim()}`); };
for (const r of S.refutadas || []) registrar(r.id);
for (const s of S.falsosPositivosRefutados || []) registrar(s);
const excluido = (angulo, id) => [...excluidos].some((k) => k.startsWith(`${angulo}:`) && String(id).startsWith(k.slice(angulo.length + 1)));

/* ── la boleta de una pregunta (los mismos pasos que corre el bucle), con caché ── */
const CAJA = cajaDelAgente(TOOLS);
const DATO = cifrasDelDato(ESCENARIO_INICIAL);
const ejes = {}; for (const e of ["cliente", "sku", "marca", "familia", "bodega", "canal"]) { try { const n = axisEntityNames(e); if (n && n.length) ejes[e] = n; } catch { /* sin índice */ } }
const nombres = Object.values(ejes).flat();
const cacheFigs = new Map();
const figsDe = (pregunta) => {
  if (cacheFigs.has(pregunta)) return cacheFigs.get(pregunta);
  const pb = playbookPara(pregunta, {});
  const dom = (() => { try { return dominiosDe(pregunta); } catch { return { dominios: [], eje: null }; } })();
  const pasos = unirPasosDeDominios(pasosDelEncargo(partesDelEncargo(pregunta), pb ? pasosDe(pb, pregunta, {}) : [], {}), (() => { try { return pasosDeDominios(dom); } catch { return []; } })());
  const rp = runPlan({ intent: "answer", calls: pasos.map((p) => ({ tool: p.tool, args: p.args || {} })) }, { scenario: ESCENARIO_INICIAL, maxCalls: 18, preguntaUsuario: pregunta, registry: CAJA });
  const figs = asignarIds((rp.ledger && rp.ledger.figs) || []);
  cacheFigs.set(pregunta, figs);
  return figs;
};

const detalle = [];
const M = {};
const cuenta = (angulo, k, n = 1) => { M[angulo] = M[angulo] || {}; M[angulo][k] = (M[angulo][k] || 0) + n; };

/* ═══ turno ═══ */
const ANGULOS_TURNO = ["comercial", "cobranza", "inventario", "cruces", "verdaderos", "flujo", "respaldo"];
for (const angulo of ANGULOS_TURNO) {
  if (solo && !solo.has(angulo)) continue;
  const F = leer(`${angulo}.json`);
  const casos = (F.casos || F).filter((c) => c && (angulo !== "respaldo" || c.modo === "turno" || c.runner)).filter((c) => typeof c.cierre === "string");
  let i = 0;
  for (const c of casos) {
    if ((i++ % cada) !== 0) continue;
    if (!idPedido(c.id)) continue;
    if (excluido(angulo, c.id)) { cuenta(angulo, "excluidos"); continue; }
    const falsedades = Array.isArray(c.falsedades) ? c.falsedades : [];
    const esAtaque = falsedades.length > 0;
    const llamadas = [];
    let r;
    try {
      r = await answerViaAgente({ text: c.pregunta, history: [], mem: {}, scenario: ESCENARIO_INICIAL, notarioV3: c.v3 !== false, callAgente: async ({ attempt, motivoReintento, soloDeclaracion }) => {
        const tipo = soloDeclaracion ? "declaracion" : motivoReintento === "reanclaje" ? "reanclaje" : attempt > 0 ? "reescritura" : "cierre";
        llamadas.push(tipo);
        const t = tipo === "reanclaje" ? (c.reanclaje != null ? c.reanclaje : c.cierre) : tipo === "reescritura" ? (c.reescritura != null ? c.reescritura : c.reparacion != null ? c.reparacion : c.cierre) : tipo === "declaracion" ? (c.declaracion != null ? c.declaracion : c.cierre) : c.cierre;
        return { tipo: "texto", texto: String(t || ""), stop: "end_turn" };
      } });
    } catch (e) { detalle.push({ angulo, id: c.id, error: String((e && e.message) || e) }); cuenta(angulo, "errores"); continue; }
    const a = r.r.agente || {}, texto = String(r.r.text || "");
    const premium = ["verde", "reparado", "podado"].includes(a.estado);
    const servidas = falsedades.filter((f) => norm(texto).includes(norm(f)));
    const ROMPE = premium && servidas.length > 0;
    const sitio = a.notario && a.notario.servido && a.notario.servido.sitio;
    const pasos = ((a.notario && a.notario.pasos) || []).filter((p) => p.modo === "anclas").map((p) => ({ sitio: p.sitio, vetos: p.vetos, multas: (p.multas || []).slice(0, 4).map((m) => m.slice(0, 200)) }));
    const rec = { angulo, id: c.id, pregunta: c.pregunta, ataque: esAtaque, estado: a.estado, sitio, llamadas, premium, ROMPE, servidas, vetosCasa: (a.vetos || []).slice(0, 3).map((v) => v.slice(0, 200)), pasos, texto: texto.slice(0, 500) };
    detalle.push(rec);
    if (esAtaque) { cuenta(angulo, "ataques"); if (ROMPE) cuenta(angulo, "falsedadesServidas"); }
    else if (c.cierre.trim()) {
      cuenta(angulo, "verdaderos");
      if (a.estado === "verde" && llamadas.length === 1) cuenta(angulo, "verdesALaPrimera");
      else if (premium) cuenta(angulo, "premiumConReintento");
      else { cuenta(angulo, "alRespaldo"); if (pasos.some((p) => p.vetos && p.vetos.length) && !(a.vetos || []).some((v) => /^(?:cierre|reanclaje|reparacion|poda) · (?!hecho|sin-|numero|metrica|estado|entidad|universo|sujeto|ancla|operador|negacion|modalidad|periodo|dominio|base|lados|direccion|continuacion|proporcion|orden|rotulo|celda|columna|predicacion|placeholder|pronombre|notario)/.test(v))) cuenta(angulo, "alRespaldoPorNotario"); else cuenta(angulo, "alRespaldoPorLeyCasa"); }
    } else { cuenta(angulo, "cerebroMudo"); if (premium) cuenta(angulo, "mudoPremium"); if (["limite", "vacio"].includes(a.estado)) cuenta(angulo, "mudoLimiteOVacio"); }
    cuenta(angulo, "llamadas", llamadas.length);
    cuenta(angulo, "turnos");
  }
}

/* ═══ hechos (canal 1) ═══ */
if (!solo || solo.has("hechos")) {
  const F = leer("hechos.json");
  for (const c of (F.casos || F)) {
    if (!idPedido(c.id)) continue;
    if (excluido("hechos", c.id)) { cuenta("hechos", "excluidos"); continue; }
    const figs = figsDe(c.pregunta);
    const I = indiceDeEvidencia({ figs, datoProyectado: DATO, ejesDelTenant: ejes });
    let libro;
    try { libro = libroDeHechos(c.hechos, { indice: I }); } catch (e) { detalle.push({ angulo: "hechos", id: c.id, error: String((e && e.message) || e) }); cuenta("hechos", "errores"); continue; }
    const esp = c.esperado && typeof c.esperado === "object" ? c.esperado : {};
    const vistosId = new Set();
    for (const H of libro.hechos) {
      if (H.derivadoDe) continue;
      if (vistosId.has(H.id)) continue; vistosId.add(H.id);   /* un id repetido: solo el primero entra al libro */
      const e = esp[H.id]; if (!e) continue;
      cuenta("hechos", "hechos");
      const esperadoVerdadero = /^(?:verdadera|sellada)$/.test(e);
      const salioVerdadero = H.veredicto === "verdadera" || H.veredicto === "sellada";
      const mot = String(H.motivo).slice(0, verbose ? 600 : 200);
      if (!esperadoVerdadero && salioVerdadero && !cumple(e, H.veredicto)) { cuenta("hechos", "falsosQueSalenVerdaderos"); detalle.push({ angulo: "hechos", id: `${c.id} ${H.id}`, ROMPE: true, esperado: e, veredicto: H.veredicto, motivo: mot }); }
      else if (esperadoVerdadero && !salioVerdadero) { cuenta("hechos", "verdaderosBloqueados"); detalle.push({ angulo: "hechos", id: `${c.id} ${H.id}`, FP: true, esperado: e, veredicto: H.veredicto, motivo: mot }); }
      else if (esperadoVerdadero) cuenta("hechos", "verdaderosVerdes");
      else if (verbose) detalle.push({ angulo: "hechos", id: `${c.id} ${H.id}`, esperado: e, veredicto: H.veredicto, motivo: mot });
      else cuenta("hechos", "falsosFrenados");
    }
  }
}

/* ═══ casa (respaldo: composer mentiroso o descuidado) ═══ */
if (!solo || solo.has("casa")) {
  const F = leer("respaldo_casa.json");
  const figPorLabel = (figs, label) => figs.find((f) => f && norm(f.label) === norm(label)) || null;
  const declarar = (figs, decls) => { const D = crearDeclarador(); for (const d of decls || []) { if (d.raw) { D.agregar(d.raw); continue; } if (d.fn === "deFig") { const f = figPorLabel(figs, d.label); if (!f) throw new Error(`fig no encontrada: ${d.label}`); D.deFig(f, d.texto, d.extra || {}); continue; } if (typeof D[d.fn] !== "function") throw new Error(`fn desconocida: ${d.fn}`); D[d.fn](d.args); } return D.lista(); };
  for (const c of (F.casos || F)) {
    if (!idPedido(c.id)) continue;
    if (excluido("respaldo", c.id)) { cuenta("casa", "excluidos"); continue; }
    const figs = figsDe(c.pregunta);
    const I = indiceDeEvidencia({ figs, datoProyectado: DATO, ejesDelTenant: ejes });
    let X;
    try { X = c.modo === "declaracion" ? anclarDeclaracion(c.texto, filtrarPorTexto(declarar(figs, c.declaraciones), c.texto), { prefijo: "d" }) : anclarPorFigs(c.texto, figs, { prefijo: "r" }); }
    catch (e) { detalle.push({ angulo: "casa", id: c.id, error: String((e && e.message) || e) }); cuenta("casa", "errores"); continue; }
    const libro = libroDeHechos(X.hechos || [], { indice: I });
    const Rj = comprobarAnclas(X.prosa, libro, { nombres, alias: {} });
    const usados = new Set([...X.prosa.matchAll(/(?:\{\{|⟦)\s*([^:}⟧]+):/g)].flatMap((m) => m[1].trim().split(/\s+/)).concat([...X.prosa.matchAll(/\{([a-z][a-z0-9]*)(?:\.[a-z]+)?\}/gi)].map((m) => m[1])));
    const falsosUsados = [...usados].filter((id) => { const H = libro.porId.get(id); return H && !H.ok; });
    const servidas = (c.falsedades || []).filter((f) => norm(Rj.servido).includes(norm(f)));
    const ROMPE = Rj.ok && falsosUsados.length === 0 && servidas.length > 0;
    const FP = !!c.verdadero && !Rj.ok;
    detalle.push({ angulo: "casa", id: c.id, modo: c.modo, verdadero: !!c.verdadero, ok: Rj.ok, ROMPE, FP, vetos: Rj.violations.map((v) => v.kind), servidas, ...(verbose ? { prosa: X.prosa, hechos: libro.hechos.map((H) => ({ id: H.id, tipo: H.tipo, veredicto: H.veredicto, motivo: String(H.motivo).slice(0, 160), claves: [...H.claves], direccion: H.direccion || null, k: H.render && H.render.k })), violations: Rj.violations.map((v) => `${v.kind}: ${v.detalle || v.detail || v.msg || ""}`.slice(0, 200)) } : {}) });
    cuenta("casa", "casos"); if (c.verdadero) { cuenta("casa", "verdaderos"); if (FP) cuenta("casa", "verdaderosBloqueados"); } else { cuenta("casa", "ataques"); if (ROMPE) cuenta("casa", "falsedadesServidas"); }
  }
}

/* ═══ resumen ═══ */
const T = { ataques: 0, falsedadesServidas: 0, verdaderos: 0, verdesALaPrimera: 0, premiumConReintento: 0, alRespaldo: 0, llamadas: 0, turnos: 0 };
for (const angulo of ANGULOS_TURNO) { const m = M[angulo] || {}; for (const k of Object.keys(T)) T[k] += m[k] || 0; }
const pct = (a, b) => (b ? `${a}/${b} = ${(100 * a / b).toFixed(1)} %` : "—");
console.log("\n══ RONDA 5 · banco ══");
for (const angulo of ANGULOS_TURNO) { const m = M[angulo]; if (!m) continue; console.log(`  ${angulo.padEnd(11)} ataques ${String(m.ataques || 0).padStart(3)} · falsedades servidas ${String(m.falsedadesServidas || 0).padStart(3)} · verdaderos ${String(m.verdaderos || 0).padStart(3)} · verdes 1.ª ${String(m.verdesALaPrimera || 0).padStart(3)} · premium c/reintento ${String(m.premiumConReintento || 0).padStart(2)} · respaldo ${String(m.alRespaldo || 0).padStart(3)} (notario ${m.alRespaldoPorNotario || 0} · ley ${m.alRespaldoPorLeyCasa || 0})${m.cerebroMudo ? ` · mudo ${m.cerebroMudo} (premium ${m.mudoPremium || 0} · límite/vacío ${m.mudoLimiteOVacio || 0})` : ""} · llamadas/turno ${m.turnos ? (m.llamadas / m.turnos).toFixed(2) : "—"}${m.excluidos ? ` · excluidos ${m.excluidos}` : ""}${m.errores ? ` · ERRORES ${m.errores}` : ""}`); }
console.log(`  TOTAL turno  falsedades servidas ${pct(T.falsedadesServidas, T.ataques)} · verdaderos verdes a la primera ${pct(T.verdesALaPrimera, T.verdaderos)} · premium con reintento ${T.premiumConReintento} · al respaldo ${pct(T.alRespaldo, T.verdaderos)} · llamadas/turno ${T.turnos ? (T.llamadas / T.turnos).toFixed(2) : "—"}`);
if (M.hechos) console.log(`  hechos (canal 1): ${M.hechos.hechos || 0} hechos con veredicto esperado · falsos que salen verdaderos ${M.hechos.falsosQueSalenVerdaderos || 0} · verdaderos bloqueados ${M.hechos.verdaderosBloqueados || 0} · verdaderos verdes ${M.hechos.verdaderosVerdes || 0}${M.hechos.excluidos ? ` · excluidos ${M.hechos.excluidos}` : ""}`);
if (M.casa) console.log(`  casa (respaldo): ataques ${M.casa.ataques || 0} · falsedades servidas ${M.casa.falsedadesServidas || 0} · verdaderos ${M.casa.verdaderos || 0} · bloqueados ${M.casa.verdaderosBloqueados || 0}${M.casa.errores ? ` · ERRORES ${M.casa.errores}` : ""}`);
if (salida) { fs.writeFileSync(salida, JSON.stringify({ medidas: M, totales: T, detalle }, null, 1)); console.log(`  detalle → ${salida}`); }
