/* === _fronteras_del_notario_gate.mjs · LAS FRONTERAS DEL NOTARIO (owner 2026-09-14) ═══════════════════════════════════
 * Tres huecos de frontera que la fase 1 de la auditoría del Notario (`_AUDITORIA_NOTARIO_2026-09-14.md`) encontró FUERA
 * del corpus de los 12 borradores, juzgando con el contexto COMPLETO del tenant —los seis ejes, que es la condición real
 * de la corrida en vivo— y que podían morder en la corrida final. Ninguno es un parche de frase: cada uno cierra una
 * familia, y este gate es su candado.
 *
 *   1 · UNA ENTIDAD DE OTRO EJE INTERPUESTA NO LE QUITA LA CIFRA A SU DUEÑO. El demo declara el canal «Retail» y la bodega
 *       «Santiago»; «Falabella lidera la venta del canal retail y es la relación comercial más importante que sostiene la
 *       cartera, con una venta anual de $19.4M» ardía (cifra-de-boleta-sin-dueno) porque «retail» quedaba como la última
 *       entidad nombrada antes de la cifra. Regla: solo cuenta como interpuesta una entidad del MISMO EJE que los dueños
 *       legítimos de la cifra; los ejes viajan declarados (`ejesDelTenant`, de `axisEntityNames`), jamás se adivinan por
 *       la forma del nombre. Lo que NO afloja: «Lider … con una venta anual de $19.4M» arde (mismo eje), «Santiago vende
 *       $19.4M» y «En retail, la venta anual es $19.4M» arden (no hay dueño en la oración: atribución activa).
 *   2 · EL MENOS TIPOGRÁFICO ES EL MISMO SIGNO. El cuadro (tabla de la cartera) publicaba «−8.2%» (U+2212) con raw
 *       POSITIVO 8.2, así que «Ripley crece 8.2%» sobre una caída no se distinguía por canon. Regla: el emisor publica el
 *       raw con su signo (`cuadroSentrix`), y el muro lee «−», «–» y «-» como el mismo signo (`normalizarSignos`, antes
 *       de todo chequeo; `parseFigures` no se toca).
 *   3 · UNA FIG SIN DUEÑO NO AUTORIZA SU NÚMERO BAJO CUALQUIER CONCEPTO. «La carga de Mercado Libre es 5.4%» pasaba con la
 *       boleta de la descomposición (5.4% es el «Efecto volumen», sin dueño): el binding de significado ya corre sobre
 *       todas las figs, lo que faltaba era que el CONCEPTO del rótulo tuviera vocabulario. «Efecto volumen» es unidades y
 *       variación; «efecto precio» es variación. Los conceptos sin vocabulario (umbral, headline) siguen sin juzgarse.
 *
 * Y LA CONDICIÓN DE PRECISIÓN: sobre los 12 borradores reales y los textos finales servidos de las seis corridas, el
 * contexto completo del tenant (seis ejes + catálogo por eje) no puede producir NINGÚN veto de más respecto del contexto
 * sin catálogo por eje: se comparan los dos juicios, veto por veto.
 * Cero red: herramientas puras, cerebro mudo, fixtures en disco. */
import fs from "node:fs";
import { initTenant } from "./src/data/tenantStore.js";
import { TENANT_DEMO } from "./src/data/tenants/demo.js";
import { ESCENARIO_INICIAL } from "./src/config/scenarios.js";
import { runPlan } from "./src/adi/oracle/toolRunner.js";
import { TOOLS } from "./src/adi/oracle/toolRegistry.js";
import { cajaDelAgente, cuadroSentrix } from "./src/adi/agente/herramientasAgente.js";
import { guardC, normalizarSignos } from "./src/adi/oracle/guardC.js";
import { cifrasDelDato } from "./src/adi/oracle/datoProyectado.js";
import { playbookPara, pasosDe } from "./src/adi/agente/playbooks/registro.js";
import { partesDelEncargo, pasosDelEncargo } from "./src/adi/agente/encargoCompuesto.js";
import { vetosDeRegistro } from "./src/adi/agente/contratoAgente.js";
import { axisEntityNames } from "./src/adi/oracle/entityIndex.js";
import { stripLanguageLeaks } from "./src/adi/llm/voiceGuard.js";

let PASS = 0, FAIL = 0;
const ok = (c, m, extra = "") => { if (c) { PASS++; console.log("  ✓ " + m); } else { FAIL++; console.log("  ✗ " + m + (extra ? "\n      " + extra : "")); } };
const H = (t) => console.log(`\n${t}`);
initTenant(TENANT_DEMO);
const CAJA = cajaDelAgente(TOOLS);
const EJES = ["cliente", "sku", "marca", "familia", "bodega", "canal"];
const _ejes = (lista) => { const o = []; for (const e of lista) { try { for (const n of axisEntityNames(e)) o.push(n); } catch { /* eje sin índice */ } } return o.length ? o : null; };
const _porEje = () => { const o = {}; for (const e of EJES) { try { const n = axisEntityNames(e); if (n && n.length) o[e] = n; } catch { /* eje sin índice */ } } return o; };
const _ctx = (conEjes) => ({ datoProyectado: cifrasDelDato(ESCENARIO_INICIAL), entidadesDelTenant: _ejes(["cliente", "sku", "marca"]), duenosDelTenant: _ejes(EJES), ...(conEjes ? { ejesDelTenant: _porEje() } : {}), contentScope: "full" });
const _muro = (t, { figs, results, question, conEjes = true }) => { const v = guardC(t, { ledger: { figs }, results, trace: null, question, ..._ctx(conEjes) }); return v.ok ? [] : (v.violations || []); };
const _kinds = (vs) => vs.map((x) => x.kind).join(", ") || "pasa";
const _arde = (vs, kind, re = null) => vs.some((x) => x.kind === kind && (!re || re.test(String(x.detail))));
const planDe = (Q) => { const pb = playbookPara(Q, {}); return runPlan({ intent: "answer", calls: pasosDelEncargo(partesDelEncargo(Q), pb ? pasosDe(pb, Q, {}) : [], {}).map((p) => ({ tool: p.tool, args: p.args || {} })) }, { scenario: ESCENARIO_INICIAL, maxCalls: 18, preguntaUsuario: Q, registry: CAJA }); };

/* ── §1 · EL EJE DE LA ENTIDAD INTERPUESTA ──────────────────────────────────────────────────────────────────────────── */
H("§1 · una entidad de OTRO EJE interpuesta no le quita la cifra a su dueño (boleta real del encargo vivo 6, seis ejes)");
const F6 = JSON.parse(fs.readFileSync(new URL("./fixtures/encargo-vivo6-2026-09-14.json", import.meta.url), "utf8"));
const rp6 = planDe(F6.pregunta);
const canales = axisEntityNames("canal"), bodegas = axisEntityNames("bodega");
ok(canales.some((c) => /retail/i.test(c)) && bodegas.some((b) => /santiago/i.test(b)), `el demo declara el canal «Retail» y la bodega «Santiago» (canales: ${canales.join("/")} · bodegas: ${bodegas.join("/")})`);
const venta = (n) => rp6.ledger.figs.find((f) => new RegExp(`^${n} · Venta$`).test(f.label));
ok(venta("Falabella") && venta("SAM-TV55") && venta("Lider") && venta("Falabella").value !== venta("Lider").value, `la boleta trae la venta de Falabella (${venta("Falabella") && venta("Falabella").value}), de SAM-TV55 (${venta("SAM-TV55") && venta("SAM-TV55").value}) y de Lider (${venta("Lider") && venta("Lider").value}): hay dueños distintos en la misma métrica`);
const vF = venta("Falabella").value, vS = venta("SAM-TV55").value;
const m6 = (t, conEjes = true) => _muro(t, { figs: rp6.ledger.figs, results: rp6.results, question: F6.pregunta, conEjes });
const PASAN_1 = [
  `Falabella lidera la venta del canal retail y es la relación comercial más importante que sostiene la cartera, con una venta anual de ${vF}.`,
  `Falabella lidera la venta del canal retail, con una venta anual de ${vF}.`,
  `SAM-TV55 es el producto que más vende del negocio y su inventario completo está en la bodega Santiago, donde acumula una venta de ${vS}.`,
  `En la bodega Santiago, SAM-TV55 acumula una venta de ${vS}.`,
  `Falabella, que concentra su compra en el canal retail y no en e-commerce, es la cuenta que más vende: ${vF} en el año.`,
];
for (const t of PASAN_1) { const vs = m6(t); ok(!_arde(vs, "cifra-de-boleta-sin-dueno"), `pasa: «${t.slice(0, 96)}…» → ${_kinds(vs)}`); }
const ARDEN_1 = [
  [`Lider lidera la venta del canal retail y es la relación comercial más importante que sostiene la cartera, con una venta anual de ${vF}.`, "Lider es del MISMO eje que Falabella: sigue interpuesto"],
  [`Santiago vende ${vF}.`, "una bodega reclamando la venta de un cliente, sin dueño en la oración"],
  [`Falabella lidera la venta del canal retail. En retail, la venta anual es ${vF}.`, "la oración de la cifra solo nombra al canal: atribución activa"],
  [`El canal retail vende ${vF} al año.`, "el canal como sujeto de la venta de un cliente"],
];
for (const [t, por] of ARDEN_1) { const vs = m6(t); ok(_arde(vs, "cifra-de-boleta-sin-dueno", /Falabella/), `arde (${por}): «${t.slice(0, 80)}…» → ${_kinds(vs)}`); }
/* el eje se lee del catálogo declarado, no de la forma del nombre: sin `ejesDelTenant` la lectura es la de antes (la frase
 * larga arde, porque «retail» vuelve a ser la última entidad de la cláusula) — la evidencia de que nada se adivina */
ok(_arde(m6(PASAN_1[0], false), "cifra-de-boleta-sin-dueno"), "sin el catálogo por eje (`ejesDelTenant`) la frase larga sigue ardiendo: el eje viene declarado, no adivinado");
/* la coordinación distributiva tampoco se rompe por una entidad de otro eje entre las coordinadas y las cifras: con el canal
 * en el medio, «Falabella y Lider … retail …» seguía terminando en «retail» (corrida de una sola entidad) y el reparto por
 * orden no aplicaba. Los dueños van lejos de la cifra (más de 90 caracteres, como en el candado de la invertida del cruce)
 * para que decida la lectura por estructura y no la ventana. */
{
  const vL = venta("Lider").value;
  const cola = `las dos del canal retail, lideran la venta con diferencia y sostienen la mayor parte de la cartera durante todo el año cerrado, con ventas anuales de ${vF} y ${vL}.`;
  const t = `Falabella y Lider, ${cola}`;
  const vs = m6(t);
  ok(!_arde(vs, "cifra-de-boleta-sin-dueno"), `la coordinación «A y B, del canal retail, … x e y» reparte por orden con el canal transparente: «${t.slice(0, 70)}…» → ${_kinds(vs)}`);
  const inv = `Lider y Falabella, ${cola}`;
  ok(_arde(m6(inv), "cifra-de-boleta-sin-dueno"), `…y la invertida sigue ardiendo: «${inv.slice(0, 70)}…» → ${_kinds(m6(inv))}`);
}

/* ── §2 · EL MENOS TIPOGRÁFICO ──────────────────────────────────────────────────────────────────────────────────────── */
H("§2 · el menos tipográfico es el mismo signo (cuadro comercial/01/tabla-cartera)");
const C = cuadroSentrix({ componentId: "comercial/01/tabla-cartera" }, { scenario: ESCENARIO_INICIAL });
ok(C.coverage && C.coverage.supported, "el cuadro de la cartera se lee");
const caidas = C.boleta.filter((f) => /vs año anterior \(%\)$/.test(f.label) && Number.isFinite(f.raw) && f.raw < 0);
ok(caidas.length > 0, `el cuadro publica variaciones negativas con su raw NEGATIVO (${caidas.map((f) => `${f.label.split(" · ")[0]} ${f.value}`).join(" · ")})`);
ok(C.boleta.every((f) => !/[−–]/.test(String(f.value))), "ningún valor publicado por el cuadro lleva el menos tipográfico: el emisor normaliza el signo antes de publicar");
ok(caidas.every((f) => f.canon === `pct:${f.value.replace(/\s/g, "")}` && /^pct:-/.test(f.canon)), "el canon de cada caída lleva el signo ASCII («pct:-8.2%»), el mismo que lee el parser de la narración");
const rip = caidas.find((f) => /^Ripley/.test(f.label)) || caidas[0];
const ent = rip.label.split(" · ")[0], mag = rip.value.replace(/^-/, ""), tip = "−" + mag, raya = "–" + mag;
const mC = (t) => _muro(t, { figs: C.boleta, results: [{ tool: "cuadroSentrix", facts: C.facts }], question: "explícame el cuadro de la cartera" });
for (const t of [`${ent} crece ${mag}.`, `${ent} tiene ${mag} de crecimiento.`, `${ent} sube ${mag} contra el año anterior.`]) {
  const vs = mC(t);
  ok(vs.length > 0 && !vs.some((x) => x.kind === "narracion-vacia"), `arde (una caída narrada como subida): «${t}» → ${_kinds(vs)}`);
}
for (const t of [`${ent} cae ${tip}.`, `${ent} cae ${rip.value}.`, `${ent} varía ${raya} contra el año anterior.`, `${ent} vende menos que el año pasado: ${tip} (${normalizarSignos(C.boleta.find((f) => /^Ripley · vs año anterior$/.test(f.label)).value)}).`]) {
  const vs = mC(t);
  ok(vs.length === 0, `pasa (el signo bien puesto, en cualquiera de sus tres formas): «${t}» → ${_kinds(vs)}`);
}
ok(normalizarSignos("Lider — $4.6M vencidos —no una cifra del dato— y Falabella – $2.5M") === "Lider — $4.6M vencidos —no una cifra del dato— y Falabella – $2.5M", "una raya entre palabras sigue siendo puntuación: normalizarSignos solo toca el signo pegado a la cifra");
ok(normalizarSignos("−8.2% · –$422K · −€1.2M") === "-8.2% · -$422K · -€1.2M", "«−» y «–» pegados a un dígito o a un símbolo de moneda pasan a «-»");

/* ── §3 · LA FIG SIN DUEÑO ──────────────────────────────────────────────────────────────────────────────────────────── */
H("§3 · una fig sin dueño no autoriza su número bajo cualquier concepto (boleta de la descomposición volumen/precio)");
const Q3 = "¿El crecimiento es por volumen o por precio?";
const rp3 = runPlan({ intent: "answer", calls: [{ tool: "salesRead", args: { focus: "descomposicion_vol_precio" } }] }, { scenario: ESCENARIO_INICIAL, maxCalls: 18, preguntaUsuario: Q3, registry: CAJA });
const fVol = rp3.ledger.figs.find((f) => /^Efecto volumen$/.test(f.label)), fPre = rp3.ledger.figs.find((f) => /^Efecto precio/.test(f.label));
ok(fVol && fPre && !fVol.label.includes("·"), `la boleta trae «Efecto volumen» (${fVol && fVol.value}) y «Efecto precio realizado» (${fPre && fPre.value}), sin dueño`);
const vol = fVol.value.replace(/^\+/, ""), pre = fPre.value.replace(/^\+/, "");
const m3 = (t) => _muro(t, { figs: rp3.ledger.figs, results: rp3.results, question: Q3 });
for (const [t, como] of [[`La carga de Mercado Libre es ${vol}.`, "carga"], [`El margen del negocio es ${vol}.`, "margen"], [`La participación de volumen es ${vol} del total.`, "participacion"], [`La carga comercial sube a ${pre}.`, "carga"]]) {
  const vs = m3(t);
  ok(_arde(vs, "metrica-mal-atribuida", new RegExp(`narrado como ${como}`)), `arde (narrada como ${como}): «${t}» → ${_kinds(vs)} ${vs.map((x) => String(x.detail).slice(0, 90)).join(" | ")}`);
}
/* la frase del propio composer de la descomposición (specRetrieval, focus descomposicion_vol_precio), armada con las cifras
 * publicadas: «El +7.5% de crecimiento se parte en volumen y precio: **más unidades +5.4%** y **mejor precio realizado +2.0%**» */
const fTot = rp3.ledger.figs.find((f) => /^Crecimiento total YoY$/.test(f.label));
const lineaComposer = `El ${fTot.value} de crecimiento se parte en volumen y precio: **más unidades ${fVol.value}** y **mejor precio realizado ${fPre.value}**.`;
for (const t of [lineaComposer, `El efecto volumen es ${fVol.value}.`, `Más unidades: ${fVol.value}.`, `El volumen creció ${vol}.`, `Las unidades crecen ${vol} y el precio realizado ${pre}.`]) {
  const vs = m3(t);
  ok(!_arde(vs, "metrica-mal-atribuida"), `pasa (el concepto bien dicho): «${t.replace(/\*/g, "").slice(0, 100)}» → ${_kinds(vs)}`);
}

/* ── LA CONDICIÓN DE PRECISIÓN · los 12 borradores y los 6 finales, con y sin el catálogo por eje ──────────────────── */
H("los 12 borradores reales y los textos finales servidos: el catálogo por eje no agrega ni un veto");
const A = JSON.parse(fs.readFileSync(new URL("./fixtures/auditoria-notario-2026-09-14.json", import.meta.url), "utf8"));
const planes = new Map();
const plan = (Q) => { if (!planes.has(Q)) planes.set(Q, planDe(Q)); return planes.get(Q); };
const juzgar = (Q, texto, sitio, conEjes) => { const rp = plan(Q); return [..._muro(texto, { figs: rp.ledger.figs, results: rp.results, question: Q, conEjes }).map((x) => `${x.kind}: ${String(x.detail).slice(0, 120)}`), ...vetosDeRegistro(texto, { pregunta: Q, figs: rp.ledger.figs, sitio }).map((x) => `${x.regla}: ${String(x.multa).slice(0, 120)}`)]; };
let textos = 0, deMas = [];
const vistos = new Set();
for (const c of A.corpus) {
  const F = JSON.parse(fs.readFileSync(new URL("./fixtures/" + c.fixture, import.meta.url), "utf8"));
  const casos = [[`${c.id}·${c.sitio}`, F.borradores[c.borrador - 1].texto, c.sitio]];
  if (!vistos.has(c.fixture) && F.final && F.final.texto) casos.push([`${c.id}·final`, F.final.texto, "cierre"]);
  vistos.add(c.fixture);
  for (const [id, raw, sitio] of casos) {
    const texto = stripLanguageLeaks(String(raw));
    const sin = juzgar(F.pregunta, texto, sitio, false), con = juzgar(F.pregunta, texto, sitio, true);
    textos++;
    for (const v of con) if (!sin.includes(v)) deMas.push(`${id}: ${v}`);
  }
}
ok(deMas.length === 0, `${textos} textos juzgados con y sin catálogo por eje: ningún veto de más con el contexto completo del tenant`, deMas.join("\n      "));

console.log(`\n── _fronteras_del_notario_gate: ${PASS} PASS · ${FAIL} FAIL (de ${PASS + FAIL}) ──`);
process.exit(FAIL ? 1 : 0);
