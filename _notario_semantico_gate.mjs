/* === _notario_semantico_gate.mjs · EL NOTARIO SEMÁNTICO, FASE 1 (owner 2026-09-15) ═══════════════════════════════════════════════
 * «El modelo redacta; el modelo declara qué está afirmando; Notario verifica la afirmación contra la evidencia estructurada; la redacción
 * no determina la verdad.» Este gate mide la fase 1 (offline, sin cerebro): el esquema de la afirmación (src/adi/notario/afirmacion.js),
 * el verificador (verificar.js) y el detector de presencia (presencia.js), contra tres conjuntos:
 *   1 · LOS 12 BORRADORES REALES (fixtures/notario-semantico-2026-09-15.json): sus afirmaciones declaradas A MANO, con veredicto esperado
 *       según la evidencia. Medidas: exactitud del veredicto, FP (verdadera→falsa), FN (falsa→verdadera), no-verificables; y los 19
 *       errores reales de la auditoría atrapados con la verdad al lado, los 17 falsos positivos servidos como verdaderos.
 *   2 · LAS OMISIONES: la cobertura de la declaración manual según el detector, y la tasa con que el detector encuentra una afirmación
 *       QUITADA de la declaración (una afirmación relevante omitida debe detectarse y medirse).
 *   3 · «TRES REDACCIONES, UN VEREDICTO» (fixtures/notario-tres-redacciones-2026-09-15.json): la misma afirmación en tres prosas distintas
 *       → el mismo veredicto del verificador, y un punto de afirmación detectable en cada redacción. Informativo: cuántas veces el Notario
 *       viejo cambia de veredicto entre redacciones.
 * Y los candados del owner como aserciones: una declaración incompleta (sin universo, sin período, sin el otro lado) es no-verificable;
 * una lectura no puede encubrir un hecho; lo no verificable nunca es verdadera. Los tres corpus anteriores siguen en sus gates como
 * regresión. Cero red: herramientas puras, fixtures en disco. */
import fs from "node:fs";
import { initTenant } from "./src/data/tenantStore.js";
import { TENANT_DEMO } from "./src/data/tenants/demo.js";
import { ESCENARIO_INICIAL } from "./src/config/scenarios.js";
import { runPlan } from "./src/adi/oracle/toolRunner.js";
import { TOOLS } from "./src/adi/oracle/toolRegistry.js";
import { cajaDelAgente } from "./src/adi/agente/herramientasAgente.js";
import { guardC } from "./src/adi/oracle/guardC.js";
import { cifrasDelDato } from "./src/adi/oracle/datoProyectado.js";
import { playbookPara, pasosDe } from "./src/adi/agente/playbooks/registro.js";
import { partesDelEncargo, pasosDelEncargo } from "./src/adi/agente/encargoCompuesto.js";
import { vetosDeRegistro } from "./src/adi/agente/contratoAgente.js";
import { axisEntityNames } from "./src/adi/oracle/entityIndex.js";
import { stripLanguageLeaks } from "./src/adi/llm/voiceGuard.js";
import { verificarAfirmaciones, encubreHecho } from "./src/adi/notario/verificar.js";
import { normalizarAfirmacion, normalizar, TIPOS } from "./src/adi/notario/afirmacion.js";
import { omisiones, puntosDeAfirmacion } from "./src/adi/notario/presencia.js";
import { indiceDeEvidencia } from "./src/adi/notario/evidencia.js";

let PASS = 0, FAIL = 0;
const ok = (c, m, extra = "") => { if (c) { PASS++; console.log("  ✓ " + m); } else { FAIL++; console.log("  ✗ " + m + (extra ? "\n      " + extra : "")); } };
const H = (t) => console.log(`\n${t}`);
const pct = (a, b) => (b ? (100 * a / b).toFixed(1) : "0.0") + " %";
initTenant(TENANT_DEMO);
const CAJA = cajaDelAgente(TOOLS);
const _ejes = (lista) => { const o = []; for (const e of lista) { try { for (const n of axisEntityNames(e)) o.push(n); } catch { /* eje sin índice */ } } return o.length ? o : null; };
const _porEje = () => { const o = {}; for (const e of ["cliente", "sku", "marca", "familia", "bodega", "canal"]) { try { const n = axisEntityNames(e); if (n && n.length) o[e] = n; } catch { /* eje sin índice */ } } return o; };
const contextos = new Map();
const contextoDe = (pregunta) => {
  if (contextos.has(pregunta)) return contextos.get(pregunta);
  const pb = playbookPara(pregunta, {});
  const rp = runPlan({ intent: "answer", calls: pasosDelEncargo(partesDelEncargo(pregunta), pb ? pasosDe(pb, pregunta, {}) : [], {}).map((p) => ({ tool: p.tool, args: p.args || {} })) }, { scenario: ESCENARIO_INICIAL, maxCalls: 18, preguntaUsuario: pregunta, registry: CAJA });
  const datoProyectado = cifrasDelDato(ESCENARIO_INICIAL);
  const ejesDelTenant = _porEje();
  const ctx = {
    indice: indiceDeEvidencia({ figs: rp.ledger.figs, datoProyectado, ejesDelTenant }),
    muro: (t) => { const v = guardC(stripLanguageLeaks(t), { ledger: { figs: rp.ledger.figs }, results: rp.results, trace: null, question: pregunta, datoProyectado, entidadesDelTenant: _ejes(["cliente", "sku", "marca"]), duenosDelTenant: _ejes(["cliente", "sku", "marca", "familia", "bodega", "canal"]), ejesDelTenant, contentScope: "full" }); return v.ok ? [] : (v.violations || []); },
    contrato: (t, sitio = "cierre") => vetosDeRegistro(stripLanguageLeaks(t), { pregunta, figs: rp.ledger.figs, sitio }),
  };
  contextos.set(pregunta, ctx);
  return ctx;
};
const leer = (f) => JSON.parse(fs.readFileSync(new URL("./fixtures/" + f, import.meta.url), "utf8"));
const FACTUALES = new Set(["cifra", "orden", "relacion", "grupo", "conteo", "variacion", "estado"]);

/* ═══ 0 · LOS CANDADOS DEL ESQUEMA ═══════════════════════════════════════════════════════════════════════════════════════════ */
H("0 · LOS CANDADOS DEL ESQUEMA (declaración incompleta = no-verificable · lectura no encubre hecho · lo no verificable nunca es verdadera)");
ok(TIPOS.length === 8 && TIPOS.includes("lectura"), "los ocho tipos del owner: cifra · orden · relacion · grupo · conteo · variacion · estado · lectura");
const incompletas = [
  ["orden sin universo", { tipo: "orden", sujeto: "Falabella", metrica: "Contribución", orden: { forma: "max" }, texto: "la que más aporta" }],
  ["variación sin período", { tipo: "variacion", sujeto: "Mercado Libre", metrica: "Ventas", variacion: { direccion: "sube" }, texto: "crece" }],
  ["relación sin el otro lado", { tipo: "relacion", sujeto: "Falabella", metrica: "Ventas", relacion: { forma: "veces", k: 2 }, texto: "el doble" }],
  ["conteo sin universo ni m", { tipo: "conteo", conteo: { n: 5, predicado: "bajo el benchmark" }, texto: "5 cuentas" }],
  ["grupo sin entidades", { tipo: "grupo", metrica: "Contribución", valor: "49%", texto: "concentran 49 %" }],
  ["lectura sin sello", { tipo: "lectura", texto: "yo miraría primero a Lider" }],
  ["puesto sin k", { tipo: "orden", sujeto: "Lider", metrica: "Brecha al benchmark", orden: { forma: "puesto", direccion: "mayor" }, universo: "los 13 clientes", texto: "la segunda" }],
];
for (const [nombre, a] of incompletas) { const { faltas } = normalizarAfirmacion(a); ok(faltas.length > 0, `incompleta → faltas: ${nombre} (${faltas.join("; ")})`); }
const CTX0 = contextoDe(leer("adversarial-notario-2026-09-14.json").preguntas.P1);
for (const [nombre, a] of incompletas) { const v = verificarAfirmaciones([a], CTX0).veredictos[0]; ok(v.veredicto === "no-verificable" && /declaracion-incompleta/.test(v.motivo), `incompleta → no-verificable, nunca verdadera: ${nombre}`); }
ok(!!encubreHecho("Lider es la cuenta que más vende"), "una lectura que encubre un orden sobre una métrica se detecta («la cuenta que más vende»)");
ok(!!encubreHecho("Lider concentra $4.6M vencidos, criterio mío"), "una lectura que encubre una cifra se detecta");
ok(!encubreHecho("Yo miraría primero a Lider: es el riesgo más grave"), "una opinión sin métrica de la boleta («el riesgo más grave») sigue siendo lectura");
ok(!encubreHecho("no hay serie para decir si el margen cae"), "un hecho bajo negación («no hay serie para decir si cae») no es un hecho encubierto");
{
  const v = verificarAfirmaciones([{ tipo: "lectura", sello: "criterio mío", texto: "Lider es la cuenta que más vende" }], CTX0).veredictos[0];
  ok(v.veredicto === "no-verificable" && /lectura-encubre-hecho/.test(v.motivo), "lectura que encubre un hecho → no-verificable con motivo lectura-encubre-hecho");
}

/* ═══ 1 · LOS 12 BORRADORES REALES, DECLARADOS A MANO ════════════════════════════════════════════════════════════════════════ */
H("1 · LOS 12 BORRADORES REALES: las afirmaciones declaradas a mano contra el verificador");
const S = leer("notario-semantico-2026-09-15.json");
const AUD = leer("auditoria-notario-2026-09-14.json");
const M = { n: 0, factual: 0, acuerdo: 0, fp: 0, fn: 0, nvV: 0, nvF: 0, faltas: 0, sinUbicar: 0, verd: 0, fal: 0, nv: 0, sell: 0, otros: 0 };
const porTipo = {};
const vetosViejos = new Map();   // kind → veces en los 12 borradores
let erroresAtrapados = 0, erroresTotal = 0, fpServidos = 0, fpTotal = 0, erroresDeLey = 0;
const pendientes = [];
const omisionesManual = { puntos: 0, afirmados: 0, cubiertos: 0, negados: 0, porClase: {} };
const quitadas = { n: 0, detectadas: 0, redundantes: 0, porTipo: {} };
for (const c of S.corpus) {
  const F = leer(c.fixture);
  const texto = String(F.borradores[c.borrador - 1].texto);
  const textoN = normalizar(texto);
  const CTX = contextoDe(F.pregunta);
  const { veredictos } = verificarAfirmaciones(c.afirmaciones, CTX);
  let acuerdo = 0;
  c.afirmaciones.forEach((a, i) => {
    const v = veredictos[i];
    const esp = String(a.veredicto_esperado || "").trim();
    M.n++;
    if (FACTUALES.has(a.tipo)) M.factual++;
    if (v.faltas && v.faltas.length && esp !== "no-verificable") { M.faltas++; pendientes.push(`${c.id}·${c.sitio} · declaración incompleta en el fixture: ${v.faltas.join("; ")} · «${String(a.texto).slice(0, 60)}»`); }
    if (a.texto && !textoN.includes(normalizar(a.texto))) M.sinUbicar++;
    if (v.veredicto === "verdadera") M.verd++; else if (v.veredicto === "falsa") M.fal++; else if (v.veredicto === "sellada") M.sell++; else M.nv++;
    const T = porTipo[a.tipo] = porTipo[a.tipo] || { n: 0, bien: 0 };
    T.n++;
    if (v.veredicto === esp) { M.acuerdo++; acuerdo++; T.bien++; return; }
    if (esp === "verdadera" && v.veredicto === "falsa") { M.fp++; pendientes.push(`${c.id}·${c.sitio} · FALSO POSITIVO: «${String(a.texto).slice(0, 70)}» → ${v.motivo.slice(0, 110)}`); }
    else if (esp === "falsa" && v.veredicto === "verdadera") { M.fn++; pendientes.push(`${c.id}·${c.sitio} · FALSO NEGATIVO: «${String(a.texto).slice(0, 70)}» → ${v.motivo.slice(0, 110)}`); }
    else if (esp === "verdadera" && v.veredicto === "no-verificable") M.nvV++;
    else if (esp === "falsa" && v.veredicto === "no-verificable") M.nvF++;
    else M.otros++;
  });
  /* los errores reales y los falsos positivos de la auditoría, por su texto */
  const aud = AUD.corpus.find((x) => x.id === c.id && x.sitio === c.sitio);
  /* el texto de la auditoría (a veces abreviado con «…» o anotado tras « — ») casa con una afirmación si comparten una ventana de 20 caracteres */
  const _dec = (s) => s.replace(/(\d),(\d)/g, "$1.$2");
  const casa = (frag) => { const f0 = _dec(normalizar(String(frag))); const f = _dec(normalizar(String(frag).split(" — ")[0])); const trozos = [...f0.split("…"), ...f.split("…")].map((x) => x.trim()).filter((x) => x.length >= 8); return c.afirmaciones.map((a, i) => ({ a, v: veredictos[i] })).filter(({ a }) => { const t = _dec(normalizar(a.texto)); if (!t) return false; if (t.includes(f0) || f0.includes(t) || t.includes(f) || f.includes(t)) return true; return trozos.every((tr) => { if (tr.length < 12) return t.includes(tr); for (let k = 0; k + 12 <= tr.length; k += 4) if (t.includes(tr.slice(k, k + 12))) return true; return false; }); }); };
  if (aud) {
    for (const e of aud.errores_reales) {
      /* un error de LEY DE LA CASA (coincidencia como razón, intención, formato) no es un hecho: lo juzga el Notario viejo, no el verificador */
      if (/coincid|ley del owner|intenci|formato|juicio|prioridad/i.test(String(e.tipo || ""))) { erroresDeLey++; continue; }
      erroresTotal++; const hs = casa(e.texto); if (hs.some(({ v }) => v.veredicto === "falsa")) erroresAtrapados++; else pendientes.push(`${c.id}·${c.sitio} · error real NO atrapado como falsa: «${e.texto.slice(0, 70)}» (${hs.map(({ v }) => v.veredicto).join(",") || "sin afirmación que lo cubra"})`);
    }
    for (const e of aud.falsos_positivos) { fpTotal++; const hs = casa(e.texto); if (hs.length && hs.every(({ v }) => v.veredicto !== "falsa")) fpServidos++; else pendientes.push(`${c.id}·${c.sitio} · falso positivo de la auditoría ${hs.length ? "vetado otra vez" : "sin afirmación que lo cubra"}: «${e.texto.slice(0, 70)}»`); }
  }
  /* las omisiones de la declaración manual, y la detección de una afirmación quitada */
  const O = omisiones(texto, c.afirmaciones);
  omisionesManual.puntos += O.puntos; omisionesManual.afirmados += O.afirmados; omisionesManual.cubiertos += O.cubiertos; omisionesManual.negados += O.negados;
  for (const o of O.omisiones) omisionesManual.porClase[o.clase] = (omisionesManual.porClase[o.clase] || 0) + 1;
  const base = new Set(O.omisiones.map((o) => o.pos + ":" + o.span));
  /* se quita cada afirmación de hecho y se mira si el detector la extraña: las que no cargan ningún punto propio (su hecho está declarado
   * también en otra afirmación) son REDUNDANTES, no omisiones — se cuentan aparte */
  c.afirmaciones.forEach((a, i) => {
    if (!FACTUALES.has(a.tipo) || !a.texto) return;
    const resto = c.afirmaciones.filter((_, j) => j !== i);
    const O2 = omisiones(texto, resto);
    const nuevas = O2.omisiones.filter((o) => !base.has(o.pos + ":" + o.span));
    const Q = quitadas.porTipo[a.tipo] = quitadas.porTipo[a.tipo] || { n: 0, det: 0, red: 0 };
    if (nuevas.length) { quitadas.n++; Q.n++; quitadas.detectadas++; Q.det++; return; }
    /* sin omisión nueva: ¿su hecho sigue declarado en otra afirmación (mismo valor, o el mismo tramo con un tipo compatible)? entonces es redundante */
    const { afirmacion: na } = normalizarAfirmacion(a);
    const canonesDe = (x) => { const { afirmacion: nx } = normalizarAfirmacion(x); const out = []; for (const v of [nx.valor, nx.variacion && nx.variacion.valor, nx.relacion && nx.relacion.valor]) if (v && v.canon) out.push(String(v.canon).replace(/\$/g, "")); if (nx.conteo && Number.isFinite(nx.conteo.n)) out.push("count:" + nx.conteo.n); return out; };
    const misCanones = canonesDe(a);
    const tA = normalizar(a.texto);
    const redundante = resto.some((b) => { if (!FACTUALES.has(b.tipo) || !b.texto) return false; const cb = canonesDe(b); if (misCanones.length && misCanones.every((k) => cb.includes(k))) return true; const tB = normalizar(b.texto); return (tB.includes(tA) || tA.includes(tB)) && (b.tipo === a.tipo || (a.tipo === "cifra" && cb.some((k) => misCanones.includes(k)))); });
    const estadoEnMetrica = a.tipo === "estado" && resto.some((b) => FACTUALES.has(b.tipo) && b.metrica && /frenad|inmoviliz|sobrestock|quiebre|sano|sin venta/i.test(String(b.metrica)) && JSON.stringify(b.sujeto || "").toLowerCase().includes(String(Array.isArray(a.sujeto) ? a.sujeto[0] : a.sujeto || "").toLowerCase()));
    if (redundante || estadoEnMetrica) { quitadas.redundantes++; Q.red++; return; }
    quitadas.n++; Q.n++;
  });
  /* el Notario viejo sobre el mismo borrador: qué vetos dicta (para saber qué parte sigue haciendo falta) */
  for (const x of CTX.muro(texto)) vetosViejos.set(x.kind, (vetosViejos.get(x.kind) || 0) + 1);
  for (const x of CTX.contrato(texto, c.sitio)) vetosViejos.set(x.regla, (vetosViejos.get(x.regla) || 0) + 1);
  console.log(`  ${c.id} · ${c.sitio.padEnd(10)} ${String(c.afirmaciones.length).padStart(3)} afirmaciones · acuerdo ${acuerdo}/${c.afirmaciones.length} · presencia: ${O.afirmados} puntos afirmados, ${O.omisiones.length} omisiones (${pct(O.cubiertos, O.afirmados)} cubierto)`);
}
H("MEDIDA · el verificador sobre las afirmaciones manuales");
console.log(`  afirmaciones: ${M.n} (${M.factual} de hecho) · veredictos: ${M.verd} verdaderas · ${M.fal} falsas · ${M.nv} no-verificables · ${M.sell} selladas`);
console.log(`  exactitud (veredicto = esperado): ${M.acuerdo}/${M.n} = ${pct(M.acuerdo, M.n)}`);
console.log(`  falsos positivos (verdadera → falsa): ${M.fp} (${pct(M.fp, M.n)}) · falsos negativos (falsa → verdadera): ${M.fn} (${pct(M.fn, M.n)})`);
console.log(`  no-verificable donde se esperaba verdadera: ${M.nvV} · donde se esperaba falsa: ${M.nvF} (no se sirven como verdaderas) · otros desacuerdos: ${M.otros}`);
console.log(`  cobertura de la evidencia (verificables entre las de hecho): ${pct(M.factual - M.nv, M.factual)}`);
console.log(`  por tipo: ${Object.entries(porTipo).map(([k, x]) => `${k} ${x.bien}/${x.n}`).join(" · ")}`);
console.log(`  errores reales de la auditoría atrapados como falsa (con la verdad al lado): ${erroresAtrapados}/${erroresTotal} (+ ${erroresDeLey} de ley de la casa, que siguen en el Notario viejo) · falsos positivos de la auditoría servidos: ${fpServidos}/${fpTotal}`);
H("MEDIDA · omisiones");
console.log(`  declaración manual: ${omisionesManual.afirmados} puntos afirmados (${omisionesManual.negados} bajo negación) · cubiertos ${omisionesManual.cubiertos} (${pct(omisionesManual.cubiertos, omisionesManual.afirmados)}) · omisiones por clase: ${JSON.stringify(omisionesManual.porClase)}`);
console.log(`  afirmación quitada de la declaración → detectada: ${quitadas.detectadas}/${quitadas.n} = ${pct(quitadas.detectadas, quitadas.n)} (aparte, ${quitadas.redundantes} redundantes: su hecho sigue declarado en otra afirmación) · por tipo: ${Object.entries(quitadas.porTipo).map(([k, x]) => `${k} ${x.det}/${x.n}${x.red ? " (+" + x.red + " red.)" : ""}`).join(" · ")}`);
if (pendientes.length) { console.log(`  PENDIENTES (${pendientes.length}; muestra de ${Math.min(pendientes.length, 25)}):`); for (const p of pendientes.slice(0, 25)) console.log("   - " + p); }
const base1 = S.linea_base || {};
ok(M.faltas === 0, `todas las afirmaciones del fixture están completas (${M.faltas} con faltas)`);
ok(M.sinUbicar === 0, `todos los textos declarados están en su borrador (${M.sinUbicar} sin ubicar)`);
ok(M.fn <= (base1.fn ?? M.fn), `falsos negativos sin regresión contra la línea base (${base1.fn ?? "—"}): hoy ${M.fn}`);
ok(M.fp <= (base1.fp ?? M.fp), `falsos positivos sin regresión contra la línea base (${base1.fp ?? "—"}): hoy ${M.fp}`);
ok(M.acuerdo >= (base1.acuerdo ?? M.acuerdo), `exactitud sin regresión contra la línea base (${base1.acuerdo ?? "—"}): hoy ${M.acuerdo}`);
ok(erroresAtrapados >= (base1.errores_atrapados ?? erroresAtrapados), `errores reales atrapados sin regresión (${base1.errores_atrapados ?? "—"}): hoy ${erroresAtrapados}/${erroresTotal}`);
ok(quitadas.detectadas >= (base1.quitadas_detectadas ?? quitadas.detectadas), `detección de afirmaciones quitadas sin regresión (${base1.quitadas_detectadas ?? "—"}): hoy ${quitadas.detectadas}/${quitadas.n}`);

/* ═══ 2 · TRES REDACCIONES, UN VEREDICTO ═════════════════════════════════════════════════════════════════════════════════════ */
H("2 · TRES REDACCIONES, UN VEREDICTO");
const T3 = leer("notario-tres-redacciones-2026-09-15.json");
const preguntas = leer("adversarial-notario-2026-09-14.json").preguntas;
const R = { n: 0, mismoVeredicto: 0, esperado: 0, detectable3: 0, viejoCambia: 0, viejoMismo: 0 };
const fallas3 = [];
const CLASE_DE = { cifra: ["cifra"], orden: ["orden", "relacion", "cifra"], relacion: ["relacion", "cifra", "orden"], grupo: ["grupo", "cifra"], conteo: ["grupo", "cifra", "estado"], variacion: ["variacion", "cifra"], estado: ["estado"], lectura: [] };
for (const it of T3.items) {
  R.n++;
  const ctxs = it.contexto === "ambos" ? ["P1", "P2"] : [it.contexto];
  const vs = it.redacciones.map((r) => verificarAfirmaciones([{ ...it.afirmacion, texto: r }], contextoDe(preguntas[ctxs[0]])).veredictos[0]);
  const mismo = vs.every((v) => v.veredicto === vs[0].veredicto);
  if (mismo) R.mismoVeredicto++;
  if (mismo && vs[0].veredicto === it.esperado) R.esperado++;
  else fallas3.push(`${it.id} · esperado ${it.esperado} → ${vs.map((v) => v.veredicto).join(" / ")} · ${vs[0].motivo.slice(0, 100)}`);
  const clases = CLASE_DE[it.afirmacion.tipo] || [];
  const det = it.afirmacion.tipo === "lectura" ? true : it.redacciones.every((r) => puntosDeAfirmacion(r).some((p) => !p.negado && clases.includes(p.clase)));
  if (det) R.detectable3++; else fallas3.push(`${it.id} · el detector no ve un punto de clase ${clases.join("/")} en las tres redacciones`);
  /* informativo: el Notario viejo sobre cada redacción */
  const LEYES = new Set(T3.leyes_de_la_casa || leer("adversarial-notario-2026-09-14.json").leyes_de_la_casa || []);
  const viejo = it.redacciones.map((r) => { const out = []; for (const c of ctxs) { const C = contextoDe(preguntas[c]); for (const x of C.muro(r)) if (!LEYES.has(x.kind)) out.push(x.kind); for (const x of C.contrato(r)) if (!LEYES.has(x.regla)) out.push(x.regla); } return out.length ? "arde" : "pasa"; });
  if (viejo.every((x) => x === viejo[0])) R.viejoMismo++; else R.viejoCambia++;
}
console.log(`  ítems: ${R.n} · mismo veredicto en las tres redacciones: ${R.mismoVeredicto}/${R.n} · y el esperado: ${R.esperado}/${R.n} (${pct(R.esperado, R.n)})`);
console.log(`  punto de afirmación detectable en las tres redacciones: ${R.detectable3}/${R.n} (${pct(R.detectable3, R.n)})`);
console.log(`  informativo · el Notario viejo cambia de veredicto entre redacciones equivalentes en ${R.viejoCambia}/${R.n} ítems (${pct(R.viejoCambia, R.n)})`);
if (fallas3.length) { console.log(`  fallas (${fallas3.length}; muestra):`); for (const f of fallas3.slice(0, 15)) console.log("   - " + f); }
ok(R.mismoVeredicto === R.n, `tres redacciones → un veredicto, por construcción: ${R.mismoVeredicto}/${R.n}`);
const base3 = T3.linea_base || {};
ok(R.esperado >= (base3.esperado ?? R.esperado), `veredicto esperado sin regresión contra la línea base (${base3.esperado ?? "—"}): hoy ${R.esperado}/${R.n}`);
ok(R.detectable3 >= (base3.detectable ?? R.detectable3), `detección en las tres redacciones sin regresión (${base3.detectable ?? "—"}): hoy ${R.detectable3}/${R.n}`);

/* ═══ 3 · QUÉ PARTE DEL NOTARIO VIEJO SIGUE HACIENDO FALTA ═══════════════════════════════════════════════════════════════════ */
H("3 · QUÉ PARTE DEL NOTARIO VIEJO SIGUE HACIENDO FALTA (vetos que dicta hoy sobre los 12 borradores)");
const LEYES_DE_LA_CASA = new Set([...(leer("adversarial-notario-2026-09-14.json").leyes_de_la_casa || []), "causa-sin-respaldo", "precio-y-costo-no-se-separan", "coincidencia-como-razon", "prioridad-integrada-cambiada", "registro", "voz", "lexico"]);
const deHecho = [], deLaCasa = [];
for (const [k, n] of [...vetosViejos.entries()].sort((a, b) => b[1] - a[1])) (LEYES_DE_LA_CASA.has(k) ? deLaCasa : deHecho).push(`${k} (${n})`);
console.log(`  vetos DE HECHO (los reemplaza el verificador; quedan como detectores de presencia): ${deHecho.join(", ") || "ninguno"}`);
console.log(`  LEYES DE LA CASA (juzgan la respuesta entera; siguen como están): ${deLaCasa.join(", ") || "ninguna"}`);
ok(true, "informativo: el reparto se lee arriba");

console.log(`\n── _notario_semantico_gate: ${PASS} PASS · ${FAIL} FAIL (de ${PASS + FAIL}) ──`);
process.exit(FAIL ? 1 : 0);
