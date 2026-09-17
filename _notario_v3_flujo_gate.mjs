/* === _notario_v3_flujo_gate.mjs · EL BUCLE v3 DETRÁS DEL FLAG (verdad finita · etapa E3 · owner 2026-09-17, offline) ═══════════════════════
 * «ADI puede hablar con libertad sin que esa libertad amplíe la superficie de verdad.» El turno ENTERO (answerViaAgente con `notarioV3`) con un
 * cerebro de guion y sin red:
 *   0 · el flag: con el flag apagado el system es el de hoy (sin <<HECHOS>>) y no está en ningún perfil; con el flag el protocolo v3 entra bajo el
 *       techo del fijo (4.700 tok) y es byte-estable;
 *   1 · los turnos: verde a la primera (tabla + prosa + lectura, tres dominios) · mentira anclada → reescritura con la verdad y sus ids · sin bloque
 *       → re-anclaje con la prosa congelada · el modelo no arregla → poda residual · ley de la casa → reescritura (no re-anclaje) · el modelo
 *       insiste → escalera, jamás la falsedad · flag apagado → el turno de hoy;
 *   2 · las medidas para el owner: 0 falsedades servidas, verdaderos verdes a la primera, llamadas por turno ≤ hoy (cierre + 1 reintento), y NINGÚN
 *       DÍGITO servido lo escribió el modelo (lo servido = el render de la casa);
 *   3 · las piezas puras: soloReanclaje y podarTramos.
 * Solo por `npm run gates:offline` (o con el candado: node --import ./scripts/offline-guard.mjs _notario_v3_flujo_gate.mjs). Cero red. */
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
import { sistemaDelAgente } from "./src/adi/agente/sistemaAgente.js";
import { indiceDeEvidencia } from "./src/adi/notario/evidencia.js";
import { libroDeHechos, asignarIds, extraerHechos, MARCA_HECHOS } from "./src/adi/notario/hechos.js";
import { renderizar } from "./src/adi/notario/anclas.js";
import { instruccionDeAnclas, soloReanclaje, podarTramos } from "./src/adi/notario/protocolo.js";

let PASS = 0, FAIL = 0;
const ok = (c, m, extra = "") => { if (c) { PASS++; console.log("  ✓ " + m); } else { FAIL++; console.log("  ✗ " + m + (extra ? "\n      " + extra : "")); } };
const H = (t) => console.log(`\n${t}`);
initTenant(TENANT_DEMO);
const F = JSON.parse(fs.readFileSync(new URL("./fixtures/notario-v3-flujo-2026-09-17.json", import.meta.url), "utf8"));
const expandir = (t) => String(t || "").replace(/@(hechos_integrada|prosa_integrada|hechos_deuda)/g, (_, k) => F[k]);
const norm = (t) => String(t || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/(\d),(\d)/g, "$1.$2").replace(/\s+/g, " ").trim();
const numerosDe = (t) => new Set((String(t || "").match(/\d[\d.,]*/g) || []).map((x) => x.replace(/,/g, ".").replace(/\.$/, "")));

/* ═══ 0 · EL FLAG ═══ */
H("0 · el flag: apagado = el system de hoy; encendido = el protocolo v3 bajo el techo");
{
  const v2 = sistemaDelAgente("actual").fijo, v3 = sistemaDelAgente("actual", { notarioV3: true }).fijo;
  ok(!v2.includes(MARCA_HECHOS) && v2.includes("<<AFIRMACIONES>>"), "sin el flag, el system trae el protocolo v2 y no el v3 (byte-idéntico al de hoy)");
  ok(v3.includes(MARCA_HECHOS) && !v3.includes("<<AFIRMACIONES>>"), "con el flag, el system trae el protocolo v3 y no el v2");
  ok(v3.length / 3.7 < 4700, `el fijo con el protocolo v3 queda bajo el techo (${Math.round(v3.length / 3.7)} tok; el v2 mide ${Math.round(v2.length / 3.7)})`);
  ok(v3 === sistemaDelAgente("actual", { notarioV3: true }).fijo, "byte-estable (el prefijo cacheable del proveedor)");
  ok(instruccionDeAnclas().length / 3.7 <= 1000, `el protocolo v3 mide ≤ 1.000 tok (${Math.round(instruccionDeAnclas().length / 3.7)})`);
  const perfil = fs.readFileSync(new URL("./src/config/flagProfile.js", import.meta.url), "utf8").replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "");
  ok(!/"ADI_NOTARIO_V3"/.test(perfil), "ADI_NOTARIO_V3 no está en ningún perfil: apagado en demo, prod y dev hasta el piloto");
}

/* ═══ 1 · LOS TURNOS ═══ */
H("1 · los turnos del bucle v3 con cerebro de guion");
const turno = async (c) => {
  const llamadas = [], recibidos = [];
  const r = await answerViaAgente({ text: c.pregunta, history: [], mem: {}, scenario: ESCENARIO_INICIAL, notarioV3: c.v3 !== false, callAgente: async ({ attempt, mensajes, motivoReintento, soloDeclaracion, notarioV3 }) => {
    const ultimo = [...(mensajes || [])].reverse().find((m) => m.role === "user");
    const tipo = soloDeclaracion ? "declaracion" : motivoReintento === "reanclaje" ? "reanclaje" : attempt > 0 ? "reescritura" : "cierre";
    llamadas.push(tipo); recibidos.push({ tipo, contenido: String((ultimo && ultimo.content) || ""), notarioV3: !!notarioV3 });
    const t = tipo === "reanclaje" ? (c.reanclaje != null ? c.reanclaje : c.cierre) : tipo === "reescritura" ? (c.reescritura != null ? c.reescritura : c.cierre) : tipo === "declaracion" ? (c.declaracion != null ? c.declaracion : c.cierre) : c.cierre;
    return { tipo: "texto", texto: expandir(t), stop: "end_turn" };
  } });
  return { a: r.r.agente || {}, texto: String(r.r.text || ""), llamadas, recibidos };
};
/* el render de la casa, calculado aparte: la evidencia de la pregunta (los mismos pasos que corre el bucle) + el libro del guion */
const CAJA = cajaDelAgente(TOOLS);
const DATO = cifrasDelDato(ESCENARIO_INICIAL);
const ejes = {}; for (const e of ["cliente", "sku", "marca", "familia", "bodega", "canal"]) { try { const n = axisEntityNames(e); if (n && n.length) ejes[e] = n; } catch { /* sin índice */ } }
const renderLocal = (pregunta, salida) => {
  const pb = playbookPara(pregunta, {});
  const dom = (() => { try { return dominiosDe(pregunta); } catch { return { dominios: [], eje: null }; } })();
  const pasos = unirPasosDeDominios(pasosDelEncargo(partesDelEncargo(pregunta), pb ? pasosDe(pb, pregunta, {}) : [], {}), (() => { try { return pasosDeDominios(dom); } catch { return []; } })());
  const rp = runPlan({ intent: "answer", calls: pasos.map((p) => ({ tool: p.tool, args: p.args || {} })) }, { scenario: ESCENARIO_INICIAL, maxCalls: 18, preguntaUsuario: pregunta, registry: CAJA });
  const figs = asignarIds((rp.ledger && rp.ledger.figs) || []);
  const I = indiceDeEvidencia({ figs, datoProyectado: DATO, ejesDelTenant: ejes });
  const X = extraerHechos(expandir(salida));
  return renderizar(X.prosa, libroDeHechos(X.hechos || [], { indice: I })).texto;
};
const M = { casos: 0, falsedadesServidas: 0, verdesEsperados: 0, verdesALaPrimera: 0, llamadasMax: 0, digitosAjenos: 0 };
for (const c of F.casos) {
  const R = await turno(c);
  M.casos++;
  const premium = ["verde", "reparado", "podado"].includes(R.a.estado);
  const lineas = [`${c.id} → ${R.a.estado} · sitio ${R.a.notario && R.a.notario.servido && R.a.notario.servido.sitio} · llamadas ${R.llamadas.join(", ")}`];
  const detalle = () => `estado ${R.a.estado} · vetos: ${(R.a.vetos || []).slice(0, 4).join(" | ").slice(0, 600)}\n      texto: ${R.texto.slice(0, 300).replace(/\n/g, " ⏎ ")}`;
  if (c.estado) ok(c.estado.includes(R.a.estado), lineas[0], detalle()); else console.log("  · " + lineas[0]);
  if (c.estadoNo) ok(!c.estadoNo.includes(R.a.estado) && !premium, `${c.id} · no se sirve como premium`, detalle());
  if (c.sitio) ok(!!(R.a.notario && R.a.notario.servido && R.a.notario.servido.sitio === c.sitio), `${c.id} · lo servido lleva el registro del sitio «${c.sitio}»`, JSON.stringify(R.a.notario && R.a.notario.servido).slice(0, 200));
  if (c.llamadas) ok(JSON.stringify(R.llamadas) === JSON.stringify(c.llamadas), `${c.id} · llamadas al cerebro: ${c.llamadas.join(" → ")}`, `hubo: ${R.llamadas.join(" → ")}`);
  if (c.llamadasSin) for (const l of c.llamadasSin) ok(!R.llamadas.includes(l), `${c.id} · sin llamada «${l}»`, R.llamadas.join(" → "));
  if (c.modo) ok(!!(R.a.notario && R.a.notario.modo === c.modo), `${c.id} · el expediente dice modo «${c.modo}»`, R.a.notario && R.a.notario.modo);
  if (c.v3 !== false) ok(!!(R.a.notario && R.a.notario.modo === "anclas") && R.recibidos.every((x) => x.notarioV3), `${c.id} · el expediente dice modo «anclas» y cada llamada al cerebro llevó el flag`);
  for (const frag of c.servido || []) ok(norm(R.texto).includes(norm(frag)), `${c.id} · sirve «${frag}»`, `texto: ${R.texto.slice(0, 400).replace(/\n/g, " ⏎ ")}`);
  for (const frag of c.ausente || []) ok(!norm(R.texto).includes(norm(frag)), `${c.id} · NO sirve «${frag}»`, `texto: ${R.texto.slice(0, 400).replace(/\n/g, " ⏎ ")}`);
  const mentiras = (c.falsedades || []).filter((f) => norm(R.texto).includes(norm(f)));
  if (c.falsedades) { ok(!mentiras.length, `${c.id} · ninguna falsedad servida (${c.falsedades.length} vigiladas)`, mentiras.join(" | ")); if (mentiras.length) M.falsedadesServidas += mentiras.length; }
  if (c.mensaje) { const m = R.recibidos.find((x) => x.tipo === c.mensaje.tipo); ok(!!m && c.mensaje.contiene.every((s) => norm(m.contenido).includes(norm(s))), `${c.id} · el mensaje de ${c.mensaje.tipo} lleva: ${c.mensaje.contiene.join(" · ")}`, m ? m.contenido.slice(0, 700) : "(no hubo)"); }
  if (c.estado && c.estado.includes("verde") && c.llamadas && c.llamadas.length === 1) { M.verdesEsperados++; if (R.a.estado === "verde" && R.llamadas.length === 1) M.verdesALaPrimera++; }
  M.llamadasMax = Math.max(M.llamadasMax, R.llamadas.length);
  /* ningún dígito lo escribió el modelo: los números servidos son los del render de la casa sobre la MISMA salida que se sirvió */
  if (premium && c.v3 !== false) {
    const salidaServida = R.a.estado === "verde" && R.llamadas.includes("reanclaje") ? c.reanclaje : R.a.estado === "verde" ? c.cierre : (c.reescritura != null ? c.reescritura : c.cierre);
    const nums = numerosDe(R.texto), nr = numerosDe(renderLocal(c.pregunta, salidaServida));
    const ajenos = [...nums].filter((n) => !nr.has(n));
    ok(!ajenos.length, `${c.id} · todo número servido lo escribió la casa (${nums.size} números)`, `ajenos: ${ajenos.join(", ")} · render: ${[...nr].join(", ")}`);
    if (ajenos.length) M.digitosAjenos += ajenos.length;
  }
}

/* ═══ 2 · LAS MEDIDAS ═══ */
H("2 · las medidas");
ok(M.falsedadesServidas === 0, `falsedades servidas: ${M.falsedadesServidas} (debe ser 0)`);
ok(M.verdesALaPrimera === M.verdesEsperados || M.verdesEsperados === 0, `verdaderos verdes a la primera: ${M.verdesALaPrimera} de ${M.verdesEsperados}`);
ok(M.llamadasMax <= 3, `llamadas por turno al cerebro: máximo ${M.llamadasMax} (el tope del diseño: cierre + re-anclaje + reescritura = 3; hoy: cierre + declaración + reparación = 3)`);
ok(M.digitosAjenos === 0, `dígitos servidos que no escribió la casa: ${M.digitosAjenos}`);

/* ═══ 3 · LAS PIEZAS PURAS ═══ */
H("3 · soloReanclaje y podarTramos");
{
  ok(soloReanclaje({ ok: false, violations: [{ kind: "hecho-sin-ancla" }, { kind: "sujeto-invisible" }] }), "solo forma de anclas → re-anclaje");
  ok(!soloReanclaje({ ok: false, violations: [{ kind: "hecho-sin-ancla" }, { kind: "hecho-invalido" }] }), "un hecho falso → reescritura");
  ok(!soloReanclaje({ ok: false, violations: [{ kind: "hecho-sin-ancla" }], reglasContrato: ["lexico-meta"] }), "una ley del contrato → reescritura");
  ok(!soloReanclaje({ ok: false, violations: [{ kind: "hecho-sin-ancla" }, { kind: "registro-informal" }] }), "una ley del muro → reescritura");
  ok(soloReanclaje({ ok: false, violations: [{ kind: "sin-hechos" }, { kind: "hecho-sin-ancla" }] }), "sin bloque + léxico suelto → re-anclaje (la prosa se congela y se piden bloque y anclas)");
  const prosa = "{{h3: Lider te debe {h3} pendientes}} y {{h6: Falabella {h6}}}. {{hF: Falabella es la que más te debe}}.\n- {{hF: la peor es Falabella}}\n{{hL: Yo la llamaría.}}";
  const libro = { porId: new Map([["hL", { tipo: "lectura", roles: { apoyo: ["hF"] } }]]) };
  const p = podarTramos(prosa, [{ kind: "hecho-invalido", texto: "Falabella es la que más te debe", ids: ["hF"] }], libro, { tope: 3 });
  ok(p === "{{h3: Lider te debe {h3} pendientes}} y {{h6: Falabella {h6}}}.", "quita la oración vetada, la viñeta con el mismo id y la lectura que lo cita; conserva lo demás", JSON.stringify(p));
  ok(podarTramos("{{hF: Falabella es la que más te debe}}.", [{ kind: "hecho-invalido", texto: "Falabella es la que más te debe", ids: ["hF"] }], null) === null, "si no queda ningún hecho, no se poda (respaldo)");
  ok(podarTramos(prosa, [{ kind: "hecho-invalido", texto: "Falabella es la que más te debe", ids: ["hF"] }], libro, { tope: 1 }) === null, "más unidades que el tope → no se poda");
}

console.log(`\n── _notario_v3_flujo_gate: ${PASS} PASS · ${FAIL} FAIL (de ${PASS + FAIL}) ──`);
process.exit(FAIL ? 1 : 0);
