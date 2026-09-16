/* _resolutor_gate.mjs · LA CASA CANONIZA LA FORMA DE LA DECLARACIÓN (Notario semántico, fase 4 · 2026-09-16) ═══════════════════════
 * Solo por `npm run gates:offline` (o con el candado: node --import ./scripts/offline-guard.mjs _resolutor_gate.mjs). Sin red.
 *
 * Tres candados sobre `src/adi/notario/resolutor.js` + `ubicar.js`:
 *  A · LA CORRIDA EN VIVO DE LA FASE 3, RE-JUZGADA (fixtures/notario-fase3-vivo + etiquetas): los hechos verdaderos que quedaron bloqueados
 *      por la FORMA de la declaración (29 de rigidez + 9 defectos) pasan a verdaderos; las 7 falsedades reales SIGUEN falsas (o quedan no
 *      verificables si su forma no resuelve): jamás verdaderas; ninguna afirmación etiquetada verdadera cambia a falsa; los fragmentos que
 *      quedaban «ajenos» se ubican; 0 falsos negativos.
 *  B · TRES FORMAS, UN VEREDICTO — de la DECLARACIÓN (el espejo del candado de la fase 1, que era de la prosa): las 1.099 afirmaciones
 *      manuales de la fase 1 se re-expresan mecánicamente en las formas que el modelo real produjo (el sujeto-concepto para las cifras del
 *      negocio, el universo escrito dentro de la métrica, un grupo con lista de valores para las cifras de la misma métrica) y el veredicto
 *      tiene que ser EL MISMO — cambiar la forma no cambia la verdad, en ninguna dirección.
 *  C · CARNADAS DE RESOLUCIÓN MALICIOSA: una declaración falsa que «suena» a una fig verdadera no puede resolverse a ella (el valor es el
 *      comprobante; con dos candidatos no se resuelve; una entidad desconocida no se adivina).
 *  D · UNA SOLA DEFINICIÓN DE «CARGA COMERCIAL ALTA» (owner 2026-09-16): el conjunto oficial es el del detector (carga > nivel declarado y
 *      exceso ≥ piso: 6 cuentas), publicado por la proyección desde la misma función que la boleta; el conjunto crudo (las que exceden el
 *      nivel: 9) se llama distinto y «carga alta» jamás resuelve a él. «6 cuentas con carga alta» es verdad; «9 cuentas con carga alta» es falsa.
 *  E · INVENTARIO/CAPITAL VERIFICABLE (owner 2026-09-16: «el mismo nivel de verificabilidad que Comercial y Cobranza»): la proyección declara
 *      para cada SKU su estado de la Mesa Capital (frenado · riesgo de quiebre · sobrestock · capital sano — la misma función que la Mesa) y
 *      la alerta del dato («crítico»); los $ por estado cierran con los «Estado del inventario: …» de la boleta; un estado dicho de un SKU que
 *      no lo tiene es falso. */
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
import { juzgarDeclaracion } from "./src/adi/notario/juez.js";
import { verificarAfirmaciones } from "./src/adi/notario/verificar.js";
import { resolverDeclaraciones } from "./src/adi/notario/resolutor.js";
import { indiceDeEvidencia } from "./src/adi/notario/evidencia.js";
import { ubicarFragmento } from "./src/adi/notario/ubicar.js";

let PASS = 0, FAIL = 0;
const ok = (c, msg, detalle = "") => { if (c) { PASS++; console.log(`  ✓ ${msg}`); } else { FAIL++; console.log(`  ✗ ${msg}${detalle ? `\n      ${String(detalle).slice(0, 400)}` : ""}`); } };
const H = (t) => console.log(`\n${t}`);
const leer = (rel) => JSON.parse(fs.readFileSync(new URL(`./fixtures/${rel}`, import.meta.url), "utf8"));

initTenant(TENANT_DEMO);
const ejes = {}; for (const e of ["cliente", "sku", "marca", "familia", "bodega", "canal"]) { try { const n = axisEntityNames(e); if (n && n.length) ejes[e] = n; } catch { /* sin índice */ } }
const nombres = Object.values(ejes).flat();
const DATO = cifrasDelDato(ESCENARIO_INICIAL);

/* ═══ A · LA FASE 3, RE-JUZGADA ══════════════════════════════════════════════════════════════════════════════════ */
H("A · la corrida en vivo de la fase 3, re-juzgada con la forma canónica");
const V = leer("notario-fase3-vivo-2026-09-15.json");
const E = leer("notario-fase3-etiquetas-2026-09-15.json").veredictos;
const juicios = new Map();   // "i.sitio" → {J, prosa}
for (const t of V.turnos) {
  const textos = (t.llamadas || []).filter((l) => l.tipo === "texto" && l.declaracion && String(l.declaracion.respuesta || "").trim());
  textos.forEach((l, k) => {
    const sitio = k === 0 ? "cierre" : "reparacion";
    const J = juzgarDeclaracion(String(l.declaracion.respuesta), l.declaracion.afirmaciones, { figs: l.figs || [], datoProyectado: DATO, ejesDelTenant: ejes, nombres, sitio, derivada: false });
    juicios.set(`${t.i}.${sitio}`, { J, prosa: String(l.declaracion.respuesta), originales: l.declaracion.afirmaciones || [] });
  });
}
/* el veredicto de una afirmación etiquetada [i.sitio.k] (k = posición ORIGINAL): los veredictos canónicos llevan id a(k+1) o a(k+1).n */
const veredictosDe = (id) => {
  const [i, sitio, k] = id.split("."); const j = juicios.get(`${i}.${sitio}`); if (!j) return [];
  const base = `a${Number(k) + 1}`;
  return j.J.veredictos.filter((v) => v.id === base || String(v.id).startsWith(base + "."));
};
const esVerdad = (vs) => vs.length > 0 && vs.every((v) => v.veredicto === "verdadera");
const hayFalsa = (vs) => vs.some((v) => v.veredicto === "falsa");
const ningunaVerdadera = (vs) => vs.length > 0 && vs.every((v) => v.veredicto !== "verdadera");
{
  const rig = E.rigidezIds.map((id) => ({ id, vs: veredictosDe(id) }));
  const fpe = E.fpEstricto.map((id) => ({ id, vs: veredictosDe(id) }));
  const rigOk = rig.filter((x) => esVerdad(x.vs)), fpOk = fpe.filter((x) => esVerdad(x.vs));
  console.log(`  rigidez (29): ${rigOk.length} pasan a verdadera · pendientes: ${rig.filter((x) => !esVerdad(x.vs)).map((x) => `${x.id} (${x.vs.map((v) => v.veredicto + ": " + String(v.motivo).slice(0, 60)).join(" | ") || "sin veredicto"})`).join(" · ")}`);
  console.log(`  FP estricto (9): ${fpOk.length} pasan a verdadera · pendientes: ${fpe.filter((x) => !esVerdad(x.vs)).map((x) => `${x.id} (${x.vs.map((v) => v.veredicto + ": " + String(v.motivo).slice(0, 60)).join(" | ") || "sin veredicto"})`).join(" · ")}`);
  ok(rigOk.length + fpOk.length >= 33, `★ ≥ 33 de los 38 hechos verdaderos bloqueados por la forma pasan a verdadera (hoy ${rigOk.length + fpOk.length}/38)`);
  const falsas = E.falsasConfirmadasIds.map((id) => ({ id, vs: veredictosDe(id) }));
  ok(falsas.every((x) => ningunaVerdadera(x.vs)), `★ las ${falsas.length} falsedades reales del modelo NUNCA pasan a verdadera (0 FN)`, falsas.filter((x) => !ningunaVerdadera(x.vs)).map((x) => x.id).join(", "));
  ok(falsas.filter((x) => hayFalsa(x.vs)).length >= 6, `…y siguen dictadas FALSAS (${falsas.filter((x) => hayFalsa(x.vs)).length}/${falsas.length})`, falsas.filter((x) => !hayFalsa(x.vs)).map((x) => `${x.id}: ${x.vs.map((v) => v.veredicto).join("/")}`).join(", "));
  /* la afirmación 2.cierre.3 («la más alta de toda la cartera», FALSA en la boleta: Easy 5,5 % > Sodimac 5,4 %) quedaba no-verificable */
  const c3 = veredictosDe("2.cierre.3");
  ok(hayFalsa(c3), "★ el resolutor ENDURECE: «la más alta de toda la cartera» (universo «la cartera de clientes») pasa de no-verificable a FALSA", c3.map((v) => `${v.veredicto}: ${String(v.motivo).slice(0, 120)}`).join(" | "));
  /* ninguna verdadera de la fase 3 se vuelve falsa (la resolución jamás inventa una falsedad) */
  const antesVerdaderas = leer("notario-fase3-etiquetas-2026-09-15.json").verdaderasIds || null;
  const totales = [...juicios.values()].reduce((a, { J }) => { for (const v of J.veredictos) a[v.veredicto] = (a[v.veredicto] || 0) + 1; return a; }, {});
  console.log(`  veredictos hoy: ${JSON.stringify(totales)}`);
  /* las falsas fuera de las 7 confirmadas se nombran una por una: la octava falsedad real que el resolutor destapó (2.cierre.3) y tres
   * declaraciones cuya forma contradice su propio valor o su métrica — «mayor» declarado con 41.4 % contra 57.3 % (2.cierre.10 y
   * 9.cierre.11: la prosa es cierta, la declaración no), «la que más carga tiene» declarada en % cuando Falabella va 4.ª (4.reparacion.9).
   * El veredicto sobre la DECLARACIÓN es correcto y la reparación se la pide al modelo. Y una novena falsedad real que destapó el inventario
   * verificable: LG-WASH11KG dicho «entre los SKU con más riesgo de quiebre» (8.cierre.6) está «capital sano» por la definición de la Mesa
   * Capital (21 días de cobertura contra un techo de 20), que la proyección ahora declara SKU por SKU. Ninguna otra falsa puede aparecer. */
  const ESPERADAS_FUERA = new Set(["2.cierre.3", "2.cierre.10", "9.cierre.11", "4.reparacion.9", "8.cierre.6"]);
  const falsasFuera = [];
  for (const [clave, { J }] of juicios) for (const v of J.veredictos) if (v.veredicto === "falsa") { const id = `${clave}.${Number(String(v.id).replace(/^a/, "").split(".")[0]) - 1}`; if (!E.falsasConfirmadasIds.includes(id)) falsasFuera.push(id); }
  ok(falsasFuera.every((id) => ESPERADAS_FUERA.has(id)), `fuera de las 7 confirmadas, las falsas son solo las 5 nombradas (hoy ${[...new Set(falsasFuera)].length}: ${[...new Set(falsasFuera)].join(", ")})`, falsasFuera.filter((id) => !ESPERADAS_FUERA.has(id)).join(", "));
  /* el verificador no revienta: un error se dicta no-verificable y puede esconder una falsa (pasó con «las 6 cuentas sobre el nivel declarado») */
  const errores = [...juicios.values()].flatMap(({ J }) => J.veredictos.filter((v) => /^error-del-verificador/.test(String(v.motivo))));
  ok(errores.length === 0, `el verificador no revienta en ninguna de las ${[...juicios.values()].reduce((n, { J }) => n + J.veredictos.length, 0)} declaraciones (errores: ${errores.length})`, errores.slice(0, 2).map((v) => v.motivo).join(" | "));
  const ajenas = [...juicios.values()].reduce((n, { J }) => n + J.violations.filter((v) => v.kind === "declaracion-ajena").length, 0);
  ok(ajenas === 0, `★ los 16 fragmentos «ajenos» de la fase 3 se ubican (hoy ${ajenas} ajenos)`);
  const incons = [...juicios.values()].reduce((n, { J }) => n + J.violations.filter((v) => v.kind === "declaracion-inconsistente").length, 0);
  ok(incons <= 3, `las inconsistencias prosa↔declaración bajan de 6 a ≤ 3 (hoy ${incons})`);
  void antesVerdaderas;
}

/* ═══ B · TRES FORMAS, UN VEREDICTO — de la declaración ═════════════════════════════════════════════════════════════════ */
H("B · tres formas de la misma declaración → el mismo veredicto (corpus manual de la fase 1)");
{
  const S = leer("notario-semantico-2026-09-15.json");
  const preguntas = leer("adversarial-notario-2026-09-14.json").preguntas;
  const CAJA = cajaDelAgente(TOOLS);
  const contextos = new Map();
  const contextoDe = (pregunta) => {
    if (contextos.has(pregunta)) return contextos.get(pregunta);
    const pb = playbookPara(pregunta, {});
    const rp = runPlan({ intent: "answer", calls: pasosDelEncargo(partesDelEncargo(pregunta), pb ? pasosDe(pb, pregunta, {}) : [], {}).map((p) => ({ tool: p.tool, args: p.args || {} })) }, { scenario: ESCENARIO_INICIAL, maxCalls: 18, preguntaUsuario: pregunta, registry: CAJA });
    const figs = (rp.ledger && rp.ledger.figs) || rp.ledger || [];
    const I = indiceDeEvidencia({ figs, datoProyectado: DATO, ejesDelTenant: ejes });
    contextos.set(pregunta, { figs, I });
    return contextos.get(pregunta);
  };
  const FIX = { P1: "encargo-vivo5-2026-09-14.json", P2: "encargo-vivo6-2026-09-14.json" };
  const preguntaDe = (c) => preguntas[c.id.startsWith("P1") ? "P1" : "P2"];
  void FIX;
  /* las tres formas mecánicas */
  const formaConcepto = (a) => (a.tipo === "cifra" && (a.sujeto === "negocio" || a.sujeto == null) && a.metrica ? { ...a, sujeto: a.metrica, metrica: "" } : null);
  const formaUniversoEnMetrica = (a) => (a.universo && typeof a.universo === "string" && a.metrica && !/·/.test(a.metrica) && ["cifra", "conteo", "orden"].includes(a.tipo) ? { ...a, metrica: `${a.metrica} · ${a.universo}`, universo: "" } : null);
  const formaGrupoLista = (lista) => {
    /* dos cifras de la misma métrica y distinto sujeto en el mismo borrador → un grupo con los dos valores */
    const out = [];
    const porMetrica = new Map();
    for (const a of lista) if (a.tipo === "cifra" && typeof a.sujeto === "string" && a.sujeto !== "negocio" && a.valor && a.metrica) { const k = a.metrica; if (!porMetrica.has(k)) porMetrica.set(k, []); porMetrica.get(k).push(a); }
    for (const [metrica, as] of porMetrica) if (as.length >= 2) { const dos = as.slice(0, 2); out.push({ originales: dos, grupo: { tipo: "grupo", metrica, grupo: { entidades: dos.map((a) => a.sujeto), n: 2 }, valor: dos.map((a) => a.valor).join(", "), texto: dos[0].texto, id: `g:${dos[0].id || dos[0].texto}` } }); }
    return out;
  };
  const R = { concepto: { n: 0, igual: 0 }, universo: { n: 0, igual: 0 }, grupo: { n: 0, igual: 0 } };
  const diffs = [];
  const _limpia = (a) => Object.fromEntries(Object.entries(a).filter(([k]) => !["veredicto_esperado", "verdad", "nota", "evidencia", "_resuelta", "id"].includes(k)));
  /* cada afirmación se juzga sola (una declaración puede partirse en varias canónicas): la comparación es lista contra lista */
  const juzgar = (lista, figs) => verificarAfirmaciones(lista, { figs, datoProyectado: DATO, ejesDelTenant: ejes }).veredictos;
  const probarFormas = (etiqueta, base, figs) => {
    for (const a of base) {
      const V0 = juzgar([a], figs).map((v) => v.veredicto).join("/");
      for (const [nombre, forma] of [["concepto", formaConcepto], ["universo", formaUniversoEnMetrica]]) {
        const b = forma(a); if (!b) continue;
        R[nombre].n++;
        const vs1 = juzgar([b], figs);
        const V1 = vs1.map((v) => v.veredicto).join("/");
        if (V1 === V0) R[nombre].igual++; else diffs.push(`${etiqueta} [${nombre}] «${String(a.texto).slice(0, 50)}»: ${V0} → ${V1} (${String(vs1[0] && vs1[0].motivo).slice(0, 80)})`);
      }
    }
    for (const { originales, grupo } of formaGrupoLista(base)) {
      R.grupo.n++;
      const v0 = originales.map((a) => juzgar([a], figs)[0].veredicto);
      const v1 = juzgar([grupo], figs).map((v) => v.veredicto);
      const igual = v1.length === v0.length && v1.every((x, i) => x === v0[i]);
      if (igual) R.grupo.igual++; else diffs.push(`${etiqueta} [grupo] «${String(grupo.texto).slice(0, 50)}»: ${v0.join("/")} → ${v1.join("/")}`);
    }
  };
  /* el corpus manual de la fase 1 (1.099 afirmaciones, contexto reconstruido con el playbook) */
  for (const c of S.corpus) { const { figs } = contextoDe(preguntaDe(c)); probarFormas(`${c.id}·${c.sitio}`, c.afirmaciones.map(_limpia), figs); }
  /* …y las declaraciones del MODELO en la fase 3 en vivo (383 afirmaciones, con la boleta de cada turno) */
  for (const [clave, { originales }] of juicios) { const l = V.turnos.find((t) => String(t.i) === clave.split(".")[0]); const ll = (l.llamadas || []).filter((x) => x.tipo === "texto" && x.declaracion && String(x.declaracion.respuesta || "").trim())[clave.endsWith("cierre") ? 0 : 1]; probarFormas(`fase3·${clave}`, originales.filter((a) => a && typeof a === "object").map(_limpia), ll.figs || []); }
  console.log(`  sujeto-concepto: ${R.concepto.igual}/${R.concepto.n} · universo dentro de la métrica: ${R.universo.igual}/${R.universo.n} · grupo con lista: ${R.grupo.igual}/${R.grupo.n}`);
  for (const d of diffs.slice(0, 12)) console.log(`    ≠ ${d}`);
  ok(R.concepto.n >= 100 && R.concepto.igual === R.concepto.n, `★ sujeto-concepto → el mismo veredicto en ${R.concepto.igual}/${R.concepto.n}`);
  ok(R.universo.n >= 100 && R.universo.igual === R.universo.n, `★ universo dentro de la métrica → el mismo veredicto en ${R.universo.igual}/${R.universo.n}`);
  ok(R.grupo.n >= 30 && R.grupo.igual === R.grupo.n, `★ grupo con lista de valores → los mismos veredictos, cifra por cifra, en ${R.grupo.igual}/${R.grupo.n}`);
}

/* ═══ C · CARNADAS DE RESOLUCIÓN MALICIOSA ══════════════════════════════════════════════════════════════════════════ */
H("C · la resolución no inventa verdad: el valor es el comprobante y la ambigüedad no se resuelve");
{
  const q = "¿Cómo viene mi margen?";
  const CAJA = cajaDelAgente(TOOLS);
  const pb = playbookPara(q, {});
  const rp = runPlan({ intent: "answer", calls: pasosDelEncargo(partesDelEncargo(q), pb ? pasosDe(pb, q, {}) : [], {}).map((p) => ({ tool: p.tool, args: p.args || {} })) }, { scenario: ESCENARIO_INICIAL, maxCalls: 18, preguntaUsuario: q, registry: CAJA });
  const figs = (rp.ledger && rp.ledger.figs) || rp.ledger || [];
  const ctx = { figs, datoProyectado: DATO, ejesDelTenant: ejes };
  const juzgar = (a) => verificarAfirmaciones([a], ctx).veredictos[0];
  const bench = figs.find((f) => /^benchmark de margen$/i.test(f.label));
  ok(!!bench, `la boleta trae el benchmark (${bench && bench.value})`);
  /* 1 · el sujeto-concepto con OTRO valor no se resuelve al benchmark (el comprobante manda) */
  const v1 = juzgar({ tipo: "cifra", sujeto: "Benchmark de margen", metrica: "Benchmark", valor: "35.0%", texto: "benchmark de 35.0%" });
  ok(v1.veredicto !== "verdadera", `carnada «Benchmark de margen = 35,0 %» (el real es ${bench && bench.value}) → ${v1.veredicto}, nunca verdadera`, v1.motivo);
  /* 2 · una entidad desconocida no se adivina como otra parecida */
  const v2 = juzgar({ tipo: "cifra", sujeto: "Falabela", metrica: "Margen", valor: "22.0%", texto: "Falabela 22.0%" });
  ok(v2.veredicto !== "verdadera", `carnada «Falabela · Margen 22,0 %» (entidad mal escrita) → ${v2.veredicto}, nunca verdadera`, v2.motivo);
  /* 3 · un grupo con lista de valores TROCADOS entre entidades es falso cifra por cifra */
  const m = new Map(figs.filter((f) => /^(Falabella|Lider) · Margen$/.test(f.label)).map((f) => [f.label.split(" · ")[0], f.value]));
  if (m.size === 2) {
    const v3 = verificarAfirmaciones([{ tipo: "grupo", metrica: "Margen", grupo: { entidades: ["Falabella", "Lider"], n: 2 }, valor: `${m.get("Lider")}, ${m.get("Falabella")}`, texto: "Falabella y Lider" }], ctx).veredictos;
    ok(v3.length === 2 && v3.every((v) => v.veredicto === "falsa"), `carnada grupo con los valores trocados (Falabella ← ${m.get("Lider")} · Lider ← ${m.get("Falabella")}) → ${v3.map((v) => v.veredicto).join("/")}`);
    const v3b = verificarAfirmaciones([{ tipo: "grupo", metrica: "Margen", grupo: { entidades: ["Falabella", "Lider"], n: 2 }, valor: `${m.get("Falabella")}, ${m.get("Lider")}`, texto: "Falabella y Lider" }], ctx).veredictos;
    ok(v3b.length === 2 && v3b.every((v) => v.veredicto === "verdadera"), `…y con los valores en su lugar → ${v3b.map((v) => v.veredicto).join("/")}`);
  } else ok(false, "la boleta trae el margen de Falabella y Lider");
  /* 4 · «total» de una métrica que la boleta trae solo por cuenta no se resuelve a un total inexistente */
  const v4 = juzgar({ tipo: "cifra", sujeto: "total de markup", metrica: "Markup sobre costo", valor: "45%", texto: "un markup total de 45%" });
  ok(v4.veredicto !== "verdadera", `carnada «total de markup 45 %» (no existe ese total) → ${v4.veredicto}`, v4.motivo);
  /* 5 · un otro-lado que es una cifra pelada se resuelve solo si es ÚNICA */
  const v5 = juzgar({ tipo: "relacion", sujeto: "Falabella", metrica: "Contribución no capturada", relacion: { forma: "parte", vs: "$99.9M" }, texto: "de los $99.9M" });
  ok(v5.veredicto !== "verdadera" || /parte/.test(String(v5.motivo)), `una relación «parte de $99.9M» se juzga contra la fig única con ese valor (${v5.veredicto}: ${String(v5.motivo).slice(0, 80)})`);
  /* 6 · la dirección de un orden no se inventa: sin palabra de dirección en el fragmento, sigue faltando */
  const v6 = juzgar({ tipo: "orden", sujeto: "Lider", metrica: "Contribución", orden: { forma: "puesto", k: 3 }, universo: "los 13 clientes", texto: "la tercera cartera" });
  ok(v6.veredicto === "no-verificable" && /direccion/.test(String(v6.motivo)), `sin «más grande» ni «mayor» en el fragmento, orden.direccion sigue faltando (${v6.veredicto})`, v6.motivo);
  const v6b = juzgar({ tipo: "orden", sujeto: "Lider", metrica: "Contribución", orden: { forma: "puesto", k: 3 }, universo: "los 13 clientes", texto: "la tercera cartera más grande" });
  ok(v6b.veredicto !== "no-verificable" || !/direccion/.test(String(v6b.motivo)), `…y con «más grande» la dirección se lee del fragmento (${v6b.veredicto}: ${String(v6b.motivo).slice(0, 90)})`);
  /* 7 · el ubicador tolerante no ubica un fragmento que la prosa no dice */
  const P = "Falabella vende $19.4M y deja $4.3M de contribución. Lider vende $17.8M.";
  /* R13 · el otro lado que trae su cifra: «por encima del nivel de referencia (3,5%)» compara la carga de Lider con el nivel declarado, no con el subtotal en $.
   * La boleta del turno 0 de la fase 3 (la del cruce completo) trae la carga en % de Lider y su variación; la del playbook de margen, no. */
  const figs0 = (V.turnos.find((t) => t.i === 0).llamadas || []).filter((x) => x.tipo === "texto" && x.declaracion)[0].figs || [];
  const juzgar0 = (x) => verificarAfirmaciones([x], { figs: figs0, datoProyectado: DATO, ejesDelTenant: ejes }).veredictos[0];
  const v7 = juzgar0({ tipo: "relacion", sujeto: "Lider", metrica: "Carga comercial", relacion: { forma: "mayor", vs: "nivel de referencia (3,5%)" }, texto: "por encima del nivel de referencia (3,5%)" });
  ok(v7.veredicto === "verdadera" && /Nivel de carga/i.test(String(v7.motivo) + String(v7.verdad)), `R13 · «vs nivel de referencia (3,5%)» resuelve al nivel declarado con esa cifra → ${v7.veredicto} (${String(v7.motivo).slice(0, 90)})`, v7.motivo);
  const v7b = juzgar0({ tipo: "relacion", sujeto: "Lider", metrica: "Carga comercial", relacion: { forma: "mayor", vs: "nivel de referencia (4,0%)" }, texto: "por encima del nivel de referencia (4,0%)" });
  ok(v7b.veredicto !== "verdadera", `R13 · …y con la cifra equivocada (4,0 %) no se resuelve al nivel: ${v7b.veredicto}`, v7b.motivo);
  const v7c = juzgar0({ tipo: "relacion", sujeto: "Lider", metrica: "Carga comercial", relacion: { forma: "mayor", vs: "nivel declarado" }, texto: "su carga está sobre el nivel declarado" });
  ok(v7c.veredicto === "verdadera" && !/subtotal/i.test(String(v7c.verdad)), `R13 · «vs nivel declarado» sin cifra elige el candidato de la UNIDAD del sujeto (%), no el subtotal en $ → ${v7c.veredicto} (${String(v7c.verdad).slice(0, 80)})`, v7c.motivo + " · " + v7c.verdad);
  /* R12 · el período implícito: «Lider creció 14,9%» sin período, con la única variación de la boleta (vs año anterior) */
  const v8 = juzgar0({ tipo: "variacion", sujeto: "Lider", metrica: "Ventas", variacion: { direccion: "sube", valor: "14,9%" }, texto: "Lider creció 14,9%" });
  ok(v8.veredicto === "verdadera" && v8.resuelta && v8.resuelta.some((x) => /periodo/.test(x)), `R12 · una variación sin período toma «vs año anterior» si es la única de la boleta → ${v8.veredicto} (${(v8.resuelta || []).join("; ").slice(0, 90)})`, v8.motivo);
  const v8b = juzgar0({ tipo: "variacion", sujeto: "Lider", metrica: "Ventas", variacion: { direccion: "sube", valor: "20,0%" }, texto: "Lider creció 20,0%" });
  ok(v8b.veredicto === "falsa", `R12 · …y con la cifra equivocada sigue siendo falsa (el valor es el comprobante): ${v8b.veredicto}`, v8b.motivo);
  /* el eje pelado como universo («familias») es el eje entero */
  const v9 = juzgar({ tipo: "orden", sujeto: "Electrodomésticos", metrica: "Ventas", orden: { forma: "max" }, universo: "familias", texto: "la familia que más vende" });
  ok(v9.veredicto !== "no-verificable" || !/universo-no-resoluble/.test(String(v9.motivo)), `el universo «familias» a secas es el eje entero → ${v9.veredicto} (${String(v9.motivo).slice(0, 80)})`, v9.motivo);
  ok(!ubicarFragmento(P, "Lider deja $4.3M de contribución", { nombres }), "un fragmento con la cifra de OTRA entidad no se ubica (la oración de $4.3M no nombra a Lider)");
  ok(!!ubicarFragmento(P, "Falabella deja $4.3M", { nombres }), "…y el fragmento con la cifra y el dueño correctos sí (asistida)");
}

/* ═══ D · UNA SOLA DEFINICIÓN DE «CARGA COMERCIAL ALTA» ══════════════════════════════════════════════════════════════ */
H("D · «carga comercial alta» tiene una sola definición (la del detector); el conjunto crudo se llama distinto");
{
  const q = "¿Cómo viene mi margen?";
  const CAJA = cajaDelAgente(TOOLS);
  const pb = playbookPara(q, {});
  const rp = runPlan({ intent: "answer", calls: pasosDelEncargo(partesDelEncargo(q), pb ? pasosDe(pb, q, {}) : [], {}).map((p) => ({ tool: p.tool, args: p.args || {} })) }, { scenario: ESCENARIO_INICIAL, maxCalls: 18, preguntaUsuario: q, registry: CAJA });
  const figs = (rp.ledger && rp.ledger.figs) || rp.ledger || [];
  const ctx = { figs, datoProyectado: DATO, ejesDelTenant: ejes };
  const juzgar = (a) => verificarAfirmaciones([a], ctx).veredictos[0];
  const oficial = DATO.conjuntos && DATO.conjuntos["carga comercial alta"], crudo = DATO.conjuntos && DATO.conjuntos["sobre el nivel declarado de carga"];
  ok(!!oficial && oficial.entidades.length === 6 && !!crudo && crudo.entidades.length === 9, `la proyección publica los dos conjuntos con su fuente: oficial ${oficial && oficial.entidades.length} (detector) · crudo ${crudo && crudo.entidades.length} (sobre el nivel declarado)`);
  /* el subtotal oficial de la boleta (diagnose) tiene EXACTAMENTE el conjunto del detector */
  const I = indiceDeEvidencia(ctx);
  const sub = I.figs.find((g) => /^carga comercial alta · subtotal/.test(g.conceptoNorm) && g.entidadesDelGrupo && g.entidadesDelGrupo.length);
  ok(!!sub && oficial && sub.entidadesDelGrupo.length === oficial.entidades.length && sub.entidadesDelGrupo.every((e) => oficial.entidades.includes(e)), `el subtotal «Carga comercial alta» de la boleta y el conjunto oficial son las mismas ${sub ? sub.entidadesDelGrupo.length : "?"} cuentas`);
  /* el verificador: solo el oficial responde a «carga alta»; el crudo lleva otro nombre y no la reconoce */
  const c6 = juzgar({ tipo: "conteo", sujeto: "negocio", metrica: "clientes", conteo: { n: 6, predicado: "con carga comercial alta" }, universo: "los 13 clientes", texto: "6 cuentas con carga comercial alta" });
  ok(c6.veredicto === "verdadera", `«6 cuentas con carga comercial alta» → ${c6.veredicto} (${String(c6.motivo).slice(0, 90)})`, c6.motivo);
  const c9 = juzgar({ tipo: "conteo", sujeto: "negocio", metrica: "clientes", conteo: { n: 9, predicado: "con carga alta" }, universo: "los 13 clientes", texto: "9 cuentas con carga alta" });
  ok(c9.veredicto === "falsa" && /son 6/.test(String(c9.motivo)), `«9 cuentas con carga alta» → ${c9.veredicto}: ${String(c9.motivo).slice(0, 90)} (el crudo ya no se llama así)`, c9.motivo);
  const c9b = juzgar({ tipo: "conteo", sujeto: "negocio", metrica: "clientes", conteo: { n: 9, predicado: "sobre el nivel declarado de carga" }, universo: "los 13 clientes", texto: "9 cuentas sobre el nivel declarado" });
  ok(c9b.veredicto === "verdadera", `«9 cuentas sobre el nivel declarado de carga» → ${c9b.veredicto} (${String(c9b.motivo).slice(0, 90)})`, c9b.motivo);
  /* SIN el subtotal en la boleta (un turno sin diagnose): «sobre el nivel declarado» se lee LITERAL — son las 9 que exceden el nivel — así que
   * «6 cuentas sobre el nivel declarado» dicho como CONTEO es falso («son 9») aunque el rótulo del subtotal describa así a sus 6 (esa redacción
   * del rótulo es una decisión de producto pendiente); «9 cuentas sobre el nivel declarado de carga» es verdad; «7 con carga alta» es falso */
  const sinSubtotal = { figs: [], datoProyectado: DATO, ejesDelTenant: ejes };
  const j2 = (x) => verificarAfirmaciones([x], sinSubtotal).veredictos[0];
  const s6 = j2({ tipo: "conteo", sujeto: "negocio", metrica: "clientes", conteo: { n: 6, predicado: "sobre el nivel declarado" }, universo: "los 13 clientes", texto: "6 cuentas sobre el nivel declarado" });
  ok(s6.veredicto === "falsa" && /son 9/.test(String(s6.motivo)), `sin el subtotal en la boleta, «6 cuentas sobre el nivel declarado» como conteo → ${s6.veredicto}: ${String(s6.motivo).slice(0, 80)} (literal: 9 exceden el nivel)`, s6.motivo);
  const s9 = j2({ tipo: "conteo", sujeto: "negocio", metrica: "clientes", conteo: { n: 9, predicado: "sobre el nivel declarado de carga" }, universo: "los 13 clientes", texto: "9 cuentas sobre el nivel declarado de carga" });
  ok(s9.veredicto === "verdadera", `…y «9 cuentas sobre el nivel declarado de carga» (el crudo, por su número) → ${s9.veredicto} (${String(s9.motivo).slice(0, 80)})`, s9.motivo);
  const u6 = j2({ tipo: "orden", sujeto: "Easy", metrica: "Carga comercial", orden: { forma: "max", direccion: "mayor" }, universo: "las cuentas con carga alta", texto: "Easy es la de mayor carga entre las cuentas con carga alta" });
  ok(u6.veredicto === "verdadera" && /detector/.test(String(u6.motivo)), `…y el universo «las cuentas con carga alta» sin el subtotal en la boleta resuelve al oficial (6): ${u6.veredicto} (${String(u6.motivo).slice(0, 90)})`, u6.motivo);
  const s7 = j2({ tipo: "conteo", sujeto: "negocio", metrica: "clientes", conteo: { n: 7, predicado: "con carga alta" }, universo: "los 13 clientes", texto: "7 cuentas con carga alta" });
  ok(s7.veredicto === "falsa" && /son 6/.test(String(s7.motivo)), `…y «7 cuentas con carga alta» → ${s7.veredicto}: ${String(s7.motivo).slice(0, 80)}`, s7.motivo);
  /* un orden «entre las cuentas con carga alta» se juzga sobre las 6 del detector: Falabella es la de mayor carga en $ entre ellas */
  const o1 = juzgar({ tipo: "orden", sujeto: "Easy", metrica: "Carga comercial", orden: { forma: "max", direccion: "mayor" }, universo: "las cuentas con carga alta", texto: "Easy es la de mayor carga comercial entre las cuentas con carga alta" });
  ok(o1.veredicto === "verdadera" && /6\b|detector/.test(String(o1.motivo) + String(o1.verdad)), `«la de mayor carga entre las cuentas con carga alta» se juzga sobre las 6 del detector → ${o1.veredicto} (${String(o1.motivo).slice(0, 100)})`, o1.motivo);
}

/* ═══ E · INVENTARIO/CAPITAL VERIFICABLE ════════════════════════════════════════════════════════════════════════════ */
H("E · Inventario/Capital: cada SKU con su estado de la Mesa Capital (y la alerta del dato), verificable como Comercial");
{
  const q = "¿Cómo está mi inventario?";
  const CAJA = cajaDelAgente(TOOLS);
  const pb = playbookPara(q, {});
  const rp = runPlan({ intent: "answer", calls: pasosDelEncargo(partesDelEncargo(q), pb ? pasosDe(pb, q, {}) : [], {}).map((p) => ({ tool: p.tool, args: p.args || {} })) }, { scenario: ESCENARIO_INICIAL, maxCalls: 18, preguntaUsuario: q, registry: CAJA });
  const figs = (rp.ledger && rp.ledger.figs) || rp.ledger || [];
  const ctx = { figs, datoProyectado: DATO, ejesDelTenant: ejes };
  const juzgar = (a) => verificarAfirmaciones([a], ctx).veredictos[0];
  const skus = ejes.sku || [];
  const MESA = ["frenado", "riesgo de quiebre", "sobrestock", "capital sano"];
  const porSku = new Map(); for (const e of DATO.estados) if (MESA.includes(e.estado)) porSku.set(e.entidad, [...(porSku.get(e.entidad) || []), e.estado]);
  ok(skus.length > 0 && skus.every((k) => (porSku.get(k) || []).length === 1), `cada uno de los ${skus.length} SKU tiene EXACTAMENTE un estado de la Mesa Capital en la proyección`, skus.filter((k) => (porSku.get(k) || []).length !== 1).join(", "));
  /* los $ por estado de la proyección cierran con los «Estado del inventario: …» de la boleta del inventario (la Mesa y la carpeta, una verdad) */
  const inv = TENANT_DEMO.skuInventario || [];
  const usdPor = (estado) => inv.filter((r) => (porSku.get(r.sku) || [])[0] === estado).reduce((a, r) => a + (Number(r.stockUSD) || 0), 0);
  const rot = { frenado: "capital frenado", "riesgo de quiebre": "riesgo de quiebre", sobrestock: "sobrestock", "capital sano": "capital sano" };
  const cierres = MESA.map((e) => { const fg = figs.find((x) => x.label === `Estado del inventario: ${rot[e]}`); return { e, boleta: fg ? fg.raw : null, proy: usdPor(e) }; });
  ok(cierres.every((c) => c.boleta != null && Math.abs(c.boleta - c.proy) < 1), `los $ por estado cierran con la boleta: ${cierres.map((c) => `${c.e} ${c.proy} = ${c.boleta}`).join(" · ")}`);
  const critico = inv.filter((r) => String(r.alerta || "").toLowerCase() === "crit").map((r) => r.sku);
  const noCritico = inv.filter((r) => String(r.alerta || "").toLowerCase() !== "crit").map((r) => r.sku);
  const vC = juzgar({ tipo: "estado", sujeto: critico[0], estado: { estado: "crítico" }, texto: `${critico[0]} está marcado como crítico` });
  ok(critico.length > 0 && vC.veredicto === "verdadera", `«${critico[0]} está marcado como crítico» → ${vC.veredicto} (la alerta del dato, declarada)`, vC.motivo);
  const vNC = juzgar({ tipo: "estado", sujeto: noCritico[0], estado: { estado: "crítico" }, texto: `${noCritico[0]} está marcado como crítico` });
  ok(vNC.veredicto === "falsa", `«${noCritico[0]} está marcado como crítico» → ${vNC.veredicto} (no lo está)`, vNC.motivo);
  const quiebre = [...porSku].filter(([, v]) => v[0] === "riesgo de quiebre").map(([k]) => k), sanos = [...porSku].filter(([, v]) => v[0] === "capital sano").map(([k]) => k);
  const vQ = juzgar({ tipo: "estado", sujeto: quiebre[0], estado: { estado: "riesgo de quiebre" }, texto: `${quiebre[0]} está en riesgo de quiebre` });
  ok(quiebre.length > 0 && vQ.veredicto === "verdadera", `«${quiebre[0]} está en riesgo de quiebre» → ${vQ.veredicto}`, vQ.motivo);
  const vS = juzgar({ tipo: "estado", sujeto: sanos[0], estado: { estado: "riesgo de quiebre" }, texto: `${sanos[0]} está en riesgo de quiebre` });
  ok(vS.veredicto === "falsa", `«${sanos[0]} está en riesgo de quiebre» (está sano) → ${vS.veredicto}: ${String(vS.motivo).slice(0, 80)}`, vS.motivo);
  /* un conteo por estado se verifica contra el conjunto declarado: «3 SKU en riesgo de quiebre» */
  const cQ = juzgar({ tipo: "conteo", sujeto: "negocio", metrica: "SKU", conteo: { n: quiebre.length, predicado: "en riesgo de quiebre" }, universo: `los ${skus.length} SKU`, texto: `${quiebre.length} SKU en riesgo de quiebre` });
  ok(cQ.veredicto === "verdadera", `«${quiebre.length} SKU en riesgo de quiebre» → ${cQ.veredicto} (${String(cQ.motivo).slice(0, 80)})`, cQ.motivo);
}

console.log(`\n── _resolutor_gate: ${PASS} PASS · ${FAIL} FAIL (de ${PASS + FAIL}) ──`);
process.exit(FAIL ? 1 : 0);
