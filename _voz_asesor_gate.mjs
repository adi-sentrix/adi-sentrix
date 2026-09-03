/* === _voz_asesor_gate.mjs · LA VOZ DEL ASESOR, CALIBRADA (owner 2026-09-04) =================================
 *
 * EL MÉTODO, por orden del supervisor y ANTES del código: se escriben las respuestas-objetivo en la voz final
 * con las cifras REALES del demo, se pasan por el muro, y cada multa se clasifica —regla que mide FORMA se
 * reapunta y se documenta; multa legítima se corrige EN LA REDACCIÓN, jamás en el juez—. Es
 * `_calibracion_borradores` otra vez: calibrar contra borradores antes de gastar un peso.
 *
 * Y LA CONTRAPRUEBA, que es la mitad que importa: un ANTI-CORPUS de respuestas tramposas con el tono de asesor
 * bien puesto. El riesgo de enseñarle a ADI a razonar el porqué no es que el notario multe de más: es que el
 * tono seguro le haga pasar una mentira. El tono no puede ser un disfraz.
 *
 * QUÉ CONGELA (fixtures/voz-asesor-2026-09.json):
 *   1 · las respuestas-objetivo ESCRITAS pasan el muro limpias;
 *   2 · las respuestas-objetivo VIVAS (las que produce el motor) salen sin un solo veto por el turno entero;
 *   3 · el análisis del porqué CUMPLE su forma (tesis · partición · papeles · huellas selladas · regla de
 *       decisión · pregunta al dueño · paso siguiente · criterio marcado);
 *   4 · las CUATRO trampas caen, cada una por la regla que le toca;
 *   5 · las reglas REAPUNTADAS conservan su carnada: la forma vieja de multar sigue muerta, y lo que antes
 *       cazaban sigue cayendo (anti-resurrección en las dos direcciones).
 *
 * OFFLINE · determinístico · cerebro MUDO · CERO llamadas.
 * `node --import ./scripts/offline-guard.mjs _voz_asesor_gate.mjs` */
import fs from "node:fs";
import path from "node:path";
import { initTenant } from "./src/data/tenantStore.js";
import { TENANT_DEMO } from "./src/data/tenants/demo.js";
import { answerViaAgente } from "./src/adi/agente/bucleAgente.js";
import { cajaDelAgente } from "./src/adi/agente/herramientasAgente.js";
import { TOOLS } from "./src/adi/oracle/toolRegistry.js";
import { runPlan } from "./src/adi/oracle/toolRunner.js";
import { guardC } from "./src/adi/oracle/guardC.js";
import { cifrasDelDato } from "./src/adi/oracle/datoProyectado.js";
import { vetosDeContrato } from "./src/adi/agente/contratoAgente.js";
import { margenEnRiesgo } from "./src/adi/agente/playbooks/margenEnRiesgo.js";
import { axisEntityNames } from "./src/adi/oracle/entityIndex.js";
import { pasosDe } from "./src/adi/agente/playbooks/registro.js";

let PASS = 0, FAIL = 0;
const ok = (c, m, extra = "") => { if (c) { PASS++; console.log("  ✓ " + m); } else { FAIL++; console.log("  ✗ " + m + (extra ? "\n      " + extra : "")); } };
const H = (t) => console.log("\n" + t);
const MUDO = async () => ({ tipo: "texto", texto: "" });

initTenant(TENANT_DEMO);
const F = JSON.parse(fs.readFileSync(path.join(process.cwd(), "fixtures", "voz-asesor-2026-09.json"), "utf8"));
const ejes = (l) => { const o = []; for (const e of l) { try { for (const n of axisEntityNames(e)) o.push(n); } catch { /* sin índice */ } } return o.length ? o : null; };

/* la boleta del turno del porqué — el contexto más rico y por eso el más exigente para juzgar prosa */
const Q = "por que estamos perdiendo margen?";
const RP = runPlan({ intent: "answer", calls: pasosDe(margenEnRiesgo, Q).map((p) => ({ tool: p.tool, args: p.args })) },
  { scenario: "bonanza", maxCalls: 8, preguntaUsuario: Q, registry: cajaDelAgente(TOOLS) });
const FIGS = (RP.ledger && RP.ledger.figs) || [];
const juzgar = (t, pregunta = Q) => {
  const v = guardC(t, { ledger: { figs: FIGS }, results: RP.results || [], trace: null, question: pregunta,
    datoProyectado: cifrasDelDato("bonanza"), entidadesDelTenant: ejes(["cliente", "sku", "marca"]),
    duenosDelTenant: ejes(["cliente", "sku", "marca", "familia", "bodega", "canal"]),
    contentScope: "full", tablePolicy: "auto" });
  return [
    ...(v.ok ? [] : (v.violations || []).map((x) => `${x.kind}`)),
    ...vetosDeContrato(t, { pregunta, entidades: ejes(["cliente", "sku", "marca"]) || [] }).map((x) => `contrato:${x.regla || x.kind}`),
    ...margenEnRiesgo.listaNotarial(t, { figs: FIGS, pregunta }).map((x) => `notarial:${x.regla}`),
  ];
};

/* ═══ 1 · EL CORPUS OBJETIVO ESCRITO · pasa el muro limpio ══════════════════════════════════════════════════ */
H("1 · las respuestas-objetivo escritas pasan el muro (la especificación, ejecutable)");
{
  const escritas = F.objetivo.filter((c) => c.texto);
  ok(escritas.length >= 3, `el fixture trae ${escritas.length} respuestas-objetivo escritas con cifras reales del demo`);
  for (const c of escritas) {
    const m = juzgar(c.texto, c.pregunta || Q);
    ok(m.length === 0, `★ «${c.id}» (${c.familia}) pasa limpia`, m.join(" · "));
  }
}

/* ═══ 2 · EL CORPUS OBJETIVO VIVO · el motor produce la voz, sin un veto ════════════════════════════════════ */
H("2 · las respuestas vivas: el motor las produce y salen sin veto por el turno entero");
{
  for (const c of F.objetivo.filter((x) => x.vivo)) {
    const r = await answerViaAgente({ text: c.pregunta, history: [], mem: {}, scenario: "bonanza", callAgente: MUDO });
    ok(r.r.agente.estado === "playbook" && !(r.r.agente.vetos || []).length,
      `★ «${c.id}» sale por su playbook sin vetos (${r.r.agente.estado})`, JSON.stringify(r.r.agente.vetos));
  }
}

/* ═══ 3 · LA FORMA DEL RAZONAMIENTO · lo que el owner pidió, punto por punto ════════════════════════════════ */
H("3 · el análisis del porqué trae las seis piezas del alineamiento del owner");
{
  const r = await answerViaAgente({ text: Q, history: [], mem: {}, scenario: "bonanza", callAgente: MUDO });
  const t = String(r.r.text || "");
  ok(/No son dos problemas|no todos los que caen .* por la misma razón/i.test(t),
    "★ TESIS que une los puntos — «no son dos problemas, es uno con dos caras»");
  ok(/De los \d+ que están bajo la vara: .*·/.test(t),
    "★ PARTICIÓN declarada contra el conteo del motor, antes de nombrar a nadie");
  ok(/acciones comerciales/i.test(t) && /(volumen|margen delgado)/i.test(t),
    "★ LOS PAPELES: la fuga por acciones y el resto, separados — estrategia distinguida de fuga");
  ok(/PROBADO/.test(t) && /ABIERTO/.test(t),
    "★ HUELLAS CON SELLO: lo que el dato permite afirmar y lo que no, cada una con el suyo");
  ok(/agregar la familia .* a cada fila de venta en la planilla/i.test(t),
    "★ …y donde el dato se acaba, QUÉ agregar a la planilla — la investigación no muere en «no se puede»");
  ok(/si el exceso de carga se repite parejo/i.test(t) && /es política comercial/i.test(t),
    "★ REGLA DE DECISIÓN: convierte la duda en un experimento que el usuario puede correr");
  ok(/¿El volumen de .* es una apuesta tuya/i.test(t),
    "★ LA PREGUNTA AL DUEÑO — lo que ninguna columna puede saber se pregunta, no se supone");
  ok(/criterio m[íi]o/i.test(t) && /(serie mes a mes|te abro)/i.test(t),
    "★ CRITERIO MARCADO y el PASO SIGUIENTE dentro de ADI — jamás «convendría una reunión»");
  ok(!/convendr[íi]a (?:una )?reuni[oó]n|habr[íi]a que reunir/i.test(t),
    "…y no termina derivando a una reunión: si ADI puede avanzar, avanza");
  /* el CONTROL: la pregunta que NO pide el porqué no arrastra el análisis (ni su costo) */
  const rc = await answerViaAgente({ text: "como viene mi margen?", history: [], mem: {}, scenario: "bonanza", callAgente: MUDO });
  ok(!/PROBADO|ABIERTO|papel/i.test(String(rc.r.text)),
    "★ CONTROL: «cómo viene mi margen» NO trae el análisis de papeles — la evidencia cara viaja solo cuando se pide");
  ok(pasosDe(margenEnRiesgo, "como viene mi margen?").length === 2 && pasosDe(margenEnRiesgo, Q).length === 3,
    "…y eso es del procedimiento: 2 pasos para la lectura, 3 cuando preguntan el porqué");
}

/* ═══ 4 · EL ANTI-CORPUS · las cuatro trampas caen ══════════════════════════════════════════════════════════ */
H("4 · la contraprueba: el tono de asesor no es un disfraz — las trampas caen todas");
{
  ok(F.trampas.length >= 4, `el anti-corpus trae ${F.trampas.length} trampas con el tono bien puesto`);
  for (const t of F.trampas) {
    const m = juzgar(t.texto);
    ok(m.length > 0, `★ cae «${t.id}» — ${t.porque_debe_caer.slice(0, 80)}`, "PASÓ: el tono la disfrazó");
  }
  /* y cada una cae por la regla que le toca, no por casualidad */
  const porRegla = Object.fromEntries(F.trampas.map((t) => [t.id, juzgar(t.texto)]));
  ok(porRegla["causa-afirmada-con-prosa-elegante"].some((x) => /causalidad-sin-respaldo/.test(x)),
    "…la causa inventada cae por el cerrojo de causalidad del muro (que NO se tocó)");
  ok(porRegla["cifra-inventada-dentro-de-mi-lectura"].some((x) => /monto-fuera-de-boleta/.test(x)),
    "…la cifra inventada cae por «monto-fuera-de-boleta»: el marcador de criterio no autoriza un número");
  ok(porRegla["hipotesis-que-se-vuelve-certeza"].some((x) => /hipotesis-vuelta-certeza/.test(x)),
    "…la hipótesis ascendida a certeza cae por su propia regla: marcarla obliga a seguir marcada");
  ok(porRegla["apuesta-de-volumen-declarada-sin-el-dueno"].some((x) => /intencion-declarada/.test(x)),
    "…y la intención del dueño declarada como hecho cae: eso se pregunta, no se afirma");
}

/* ═══ 5 · LAS REGLAS REAPUNTADAS CONSERVAN SU CARNADA ═══════════════════════════════════════════════════════ */
H("5 · anti-resurrección: lo que la regla vieja cazaba, sigue cayendo");
{
  const carnada = F.calibracion_2026_09_04.find((c) => c.carnada);
  ok(!!carnada, "la calibración documenta qué regla se reapuntó y por qué");
  ok(margenEnRiesgo.listaNotarial(carnada.carnada, { figs: FIGS, pregunta: Q }).some((x) => x.regla === "causa-sin-respaldo"),
    "★ la causa SIN mecanismo medido («porque su equipo comercial negocia mal») sigue cayendo tras reapuntar `MECANISMOS`");
  ok(margenEnRiesgo.listaNotarial("Empezaría por Lider porque ahí coinciden la carga sobre el target y el volumen.", { figs: FIGS, pregunta: Q })
    .every((x) => x.regla !== "causa-sin-respaldo"),
    "★ …y la que nombra el mecanismo MEDIDO con otras palabras ya no se multa (el motivo del reapuntado)");
  ok(margenEnRiesgo.listaNotarial("Lo que el dato no sabe: si ese volumen fue una decisión tuya.", { figs: FIGS, pregunta: Q })
    .every((x) => x.regla !== "intencion-declarada"),
    "★ la DUDA sobre la intención pasa limpia; la afirmación cae — la regla distingue, no censura el verbo");
  ok(F.calibracion_2026_09_04.filter((c) => /LEG[IÍ]TIMA/.test(c.clase)).length >= 3,
    `…y quedan documentadas las ${F.calibracion_2026_09_04.filter((c) => /LEG[IÍ]TIMA/.test(c.clase)).length} multas legítimas que corrigieron la REDACCIÓN, no al juez`);
}

console.log(`\n── _voz_asesor_gate: ${PASS} PASS · ${FAIL} FAIL (de ${PASS + FAIL}) ──`);
process.exit(FAIL ? 1 : 0);
