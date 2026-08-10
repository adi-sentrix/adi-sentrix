/* === _concordancia_cobertura_gate.mjs · LA MATRIZ DE COBERTURA ADI ↔ SENTRIX (owner 2026-08-09) ===============
 *
 * QUÉ AFIRMA. Que NINGUNA pieza de las cuatro caras queda fuera del contrato. No verifica que las cifras cierren
 * (eso es el gate de concordancia numérica): verifica que cada componente esté CONECTADO en las cinco dimensiones
 * que hacen posible que ADI comprenda lo que el usuario tiene delante, y que un componente nuevo NO PUEDA NACER
 * DESCONECTADO — porque el gate se cae antes de que llegue a producción.
 *
 * LAS CINCO COLUMNAS DE LA MATRIZ, una por componente de comercial · capital · resultado · ficha:
 *
 *   [ID]   TIENE componentId          declarado en el manifiesto, bien formado (`vista/sección/slug`), vocabulario
 *                                     cerrado, y BIYECTIVO con la UI: todo `useViewContext(...)` del panel está
 *                                     declarado, y todo componente declarado está montado o declara por qué no
 *                                     (`_emitidoPor` su pieza padre · `_noMontado` con motivo). El silencio no vale.
 *   [VC]   EMITE ViewContext          deriva de la salida VIVA de su builder y sale SELLADO (isSealed), con su
 *                                     tenant, su escenario y su key. Un componente que no emite es un componente
 *                                     sobre el que ADI no puede responder "esto".
 *   [TOOL] TIENE equivalente en ADI   `evidencia[]` con tools que EXISTEN en el registro del oráculo, o `sinTool`
 *                                     con su motivo. Una pieza que no se puede contrastar es una limitación
 *                                     declarada; una pieza que calla es ADI contestando por una cifra que no tiene.
 *   [DIR]  DIRECCIÓN EN LAS DOS       ida (Sentrix→ADI): vc → address → format → parse → resolve reabre el MISMO
 *          PUNTAS                     componente. vuelta (ADI→Sentrix): la evidencia declarada del componente
 *                                     produce una dirección que abre SU MISMA CARA. La apertura se DERIVA del
 *                                     manifiesto con el mismo orden de ramas que `addressFromEvidence`, no con una
 *                                     tabla nueva: vista→ambiente · ficha→perfil · resultado→pnl · con tools→tool ·
 *                                     sin tools→ninguna (abstención declarada, nunca la cara equivocada).
 *   [DECL] UNIVERSO · UNIDAD ·        universo con kind + label (+ el tamaño que pone el DATO, y con qué cierra
 *          PERÍODO · ESTATUS          cuando el sello es probado) · unidad resoluble contra `metricRegistry` o
 *                                     declarada con su motivo cuando el registro no alcanza · período · sello.
 *
 * VEREDICTO POR FILA:  CUBIERTO · LÍMITE DECLARADO (cubierto, con una frontera honesta escrita) · DESCUBIERTO.
 * El gate FALLA con un solo DESCUBIERTO, y también si la biyección con la UI se rompe en cualquiera de los dos
 * sentidos. "Límite declarado" nunca es un permiso genérico: cada uno exige el texto que dice cuál es el límite.
 *
 * Y UNA SECCIÓN PROPIA PARA EL NIVEL 2 (owner 2026-08-09, decisión 12 · sección [7]). Las superficies que ADI ABRE
 * cuando responde —el Cuadro de mando, la tabla-ring, el recibo, la decisión priorizada y la proyección— entran a
 * la matriz como cualquier pieza, pero además tienen que probar lo que faltaba: que devuelven contexto. Se afirma
 * que cada una corre SU builder (no el de la cara), que la ida reabre su propio componente, que la vuelta aterriza
 * en la cara que la demuestra, que su key nunca choca con la del contexto ambiente de esa cara y que publica como
 * AMBIENTE — que es lo que hace que el contexto se LIMPIE al cambiar de pestaña, de foco o al cerrar el panel.
 *
 * Cero red, cero LLM, cero créditos.   `node _concordancia_cobertura_gate.mjs`
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  VIEW_MANIFEST, VISTAS, SECCIONES, TIPOS, COMPARACIONES, UNIVERSO_KINDS, UNIDADES,
  CONCORDANCIA_ESTADOS, concordanciaDe, divergenciaDe,
  componentIdForTool, vistaComponentId, toolsConComponente,
  SUPERFICIE_BUILDERS, VIEW_BUILDERS, builderKeyOf, componentIdsNivel2,
} from "./src/adi/sentrix/viewManifest.js";
import { builderOutsPorComponente, clavesCorribles } from "./src/adi/sentrix/viewBuilderRun.js";
import { deriveViewContextOrErrors } from "./src/adi/sentrix/viewContextFrom.js";
import { ESTATUS } from "./src/adi/oracle/viewContext.js";
import { isSealed } from "./src/adi/oracle/narrationContract.js";
import {
  formatAddress, parseAddress, addressFromViewContext, addressFromEvidence,
  addressForVista, resolveAddress, evidenceForAddress, buildSentrixActionFromAddress,
} from "./src/adi/sentrix/address.js";
import { normalizeSentrixAction } from "./src/adi/responseContract.js";
import { METRICS } from "./src/config/contract/metricRegistry.js";
import { ENTITIES } from "./src/config/contract/entityRegistry.js";
import { TOOLS } from "./src/adi/oracle/toolRegistry.js";
import { primeraEntidadDe } from "./src/adi/sentrix/viewBuilderRun.js";
import { getTenantId } from "./src/data/tenantStore.js";

const RAIZ = path.dirname(fileURLToPath(import.meta.url));
let PASS = 0, FAIL = 0;
const ok = (c, m, extra = "") => { if (c) { PASS++; console.log("  ✓ " + m); } else { FAIL++; console.log("  ✗ " + m + (extra ? "\n      " + extra : "")); } };
// `info` NO es una afirmación: describe la forma de la cobertura sin sumar al conteo. Un gate que cuenta sus
// descripciones como pruebas se infla solo, y el número deja de significar nada.
const info = (m, extra = "") => console.log("  · " + m + (extra ? "\n      " + extra : ""));
const H = (t) => console.log("\n" + t);

const SCN = "bonanza";
const RC = { tenantId: getTenantId() };
const EJES_NO_ENTIDAD = ["cartera", "tiempo"];

// La salida VIVA contra la que se deriva CADA componente. Sale de `viewBuilderRun.js` —el único lugar que ejecuta
// lo que el manifiesto declara—, no de un mapa vista→builder escrito acá: con las superficies de nivel 2 (decisión
// 12) el builder ya no es el de la cara, y cuatro gates con su propia copia de esa lista es como se desincronizan.
const SALIDAS = builderOutsPorComponente(SCN);
const UNA_ENTIDAD = primeraEntidadDe("cliente", SCN);

/* ══ 1 · LO QUE LA UI MONTA DE VERDAD ═══════════════════════════════════════════════════════════════════════════
 * Se lee el panel como TEXTO, sin ejecutarlo (es JSX con React). Dos formas de montaje y ninguna más:
 *   · literal          useViewContext("comercial/01/kpi-ventas", …) · useVistaContext("comercial", …)
 *   · por tabla        useViewContext(_TABLA[i][1], …) — se resuelve leyendo la declaración de esa tabla.
 * Y se exige que TODO call site quede resuelto: una tercera forma de montar (un componentId calculado, una
 * variable que viene de otro archivo) deja el gate rojo en vez de crear un agujero silencioso en la matriz. */
const PANEL_PATH = path.join(RAIZ, "src", "ui", "SentrixPanel.jsx");
const PANEL_SRC = fs.readFileSync(PANEL_PATH, "utf8");
// se descartan comentarios: el panel DOCUMENTA componentes que hoy no pinta, y contarlos como montados sería
// justamente el agujero que este gate viene a cerrar.
const PANEL = PANEL_SRC
  .replace(/\/\*[\s\S]*?\*\//g, "")
  .split("\n").filter((l) => !/^\s*(\/\/|\*)/.test(l)).join("\n");

const MONTADOS = new Set();
const MONTAJE = {};   // componentId → "literal" | "tabla <ID>" | "vista"
let callSites = 0, callSitesResueltos = 0;

for (const mth of PANEL.matchAll(/useViewContext\(\s*(?:"([^"]+)"|'([^']+)'|`([^`]+)`)/g)) {
  callSites++; callSitesResueltos++;
  const id = mth[1] || mth[2] || mth[3];
  MONTADOS.add(id); MONTAJE[id] = MONTAJE[id] || "literal";
}
for (const mth of PANEL.matchAll(/useVistaContext\(\s*(?:"([^"]+)"|'([^']+)'|`([^`]+)`)/g)) {
  callSites++; callSitesResueltos++;
  const v = mth[1] || mth[2] || mth[3];
  const id = `${v}/otro/vista`;
  MONTADOS.add(id); MONTAJE[id] = MONTAJE[id] || "vista";
}
for (const mth of PANEL.matchAll(/useViewContext\(\s*([A-Za-z_$][\w$]*)\s*\[/g)) {
  callSites++;
  const ident = mth[1];
  const decl = new RegExp(`(?:const|let|var)\\s+${ident}\\s*=\\s*\\[([\\s\\S]*?)\\n\\]`, "m").exec(PANEL);
  if (!decl) continue;
  const ids = [...decl[1].matchAll(/["'`]([a-z]+\/(?:01|02|03|otro)\/[a-z0-9-]+)["'`]/g)].map((x) => x[1]);
  if (!ids.length) continue;
  callSitesResueltos++;
  for (const id of ids) { MONTADOS.add(id); MONTAJE[id] = MONTAJE[id] || `tabla ${ident}`; }
}
// El TOTAL de invocaciones del hook en el panel. Si no coincide con lo resuelto arriba es que apareció una TERCERA
// forma de montar (un componentId calculado, una variable importada de otro archivo): el gate queda rojo en vez de
// dejar una pieza fuera de la matriz sin que nadie se entere.
const callSitesTotales = [...PANEL.matchAll(/use(?:View|Vista)Context\(/g)].length;

/* ══ 2 · LA APERTURA DESDE ADI · derivada, nunca una tabla nueva ════════════════════════════════════════════════
 * Mismo orden de ramas que `addressFromEvidence`. Que sea DERIVADA es el punto: un componente nuevo hereda su
 * apertura de su vista y de si declara tools, así que no hay un segundo lugar donde olvidarse de declararlo. */
function aperturaDe(m) {
  if (m.tipo === "vista") return "ambiente";                       // contexto de pantalla, jamás evidencia de una cifra
  if (m.vista === "ficha") return "perfil";                        // rama 1 · _profileRequest
  if (m.vista === "resultado") return "pnl";                       // rama 2 · evidence.pnl
  if (Array.isArray(m.evidencia) && m.evidencia.length) return "tool";   // rama 3 · índice inverso del manifiesto
  return "ninguna";                                                 // sin tool: se ABSTIENE y cae a la vista, honesto
}
function sondaDe(id, m) {
  const ap = aperturaDe(m);
  if (ap === "ambiente") {
    const a = addressForVista(m.vista, SCN);
    return { ap, addr: a };
  }
  // `entityType` NO es decoración de la sonda: `_profileRequest` lo dejan por igual el perfil de CLIENTE y el de
  // SKU (sentrixEvidence.js:_entityReading construye reading para los dos ejes), así que la rama 1 sólo puede
  // resolver la Ficha si sabe el eje REAL de la entidad. La sonda lo pasa desde el propio manifiesto —que es lo
  // que hace el pipeline real, donde el eje llega en los facts y en evidenceSpec.scope—; omitirlo hacía que el
  // gate probara una forma de evidencia que la producción nunca emite.
  if (ap === "perfil") return { ap, addr: addressFromEvidence({ _profileRequest: true, entidad: UNA_ENTIDAD, entityType: m.eje, periodo: SCN }, { scenario: SCN }) };
  if (ap === "pnl") return { ap, addr: addressFromEvidence({ pnl: true, dimension: m.eje, periodo: SCN }, { scenario: SCN }) };
  if (ap === "tool") {
    const calls = m.evidencia.map((e) => ({ tool: e.tool, args: { ...(e.args || {}), ...(e.focus ? { focus: e.focus } : {}) } }));
    return { ap, addr: addressFromEvidence({ periodo: SCN }, { plan: { calls }, scenario: SCN }) };
  }
  return { ap, addr: null };
}

/* ══ 3 · LA UNIDAD · se LEE del registro de métricas; se declara sólo donde el registro no alcanza ══════════════ */
function unidadDe(m) {
  const met = m.metrica ? METRICS[m.metrica] : null;
  const ejeEntidad = m.eje && !!ENTITIES[m.eje];
  const registro = met ? met.unit : null;
  const escalaRegistro = met && met.scale && ejeEntidad ? met.scale[m.eje] || null : null;
  const unidad = m.unidad || registro || null;
  const escala = m.escala || escalaRegistro || null;
  const errores = [];
  if (!unidad) errores.push("sin unidad: el componente no declara métrica y tampoco `unidad`");
  else if (!UNIDADES.includes(unidad)) errores.push(`unidad fuera del vocabulario: "${unidad}"`);
  // la unidad declarada que CONTRADICE al registro es legítima (la card de acciones comerciales muestra dinero y su
  // métrica está en pct) — pero tiene que decir por qué. Coincide o está declarada; nunca en silencio.
  if (m.unidad && registro && m.unidad !== registro && !m.unidadMotivo)
    errores.push(`unidad "${m.unidad}" contradice a metricRegistry ("${registro}" para ${m.metrica}) sin \`unidadMotivo\``);
  if (m.unidad && !registro && !m.unidadMotivo && m.metrica)
    errores.push("unidad declarada sin motivo pese a tener métrica en el registro");
  // dinero sin escala es media unidad: es el desalineamiento K-vs-raw que rompió Capital.
  if (unidad === "money" && !escala) errores.push(`money sin escala declarada (eje ${m.eje || "—"}): la cifra queda ambigua entre miles y dólares crudos`);
  return { unidad, escala, errores };
}

/* ══ 4 · LA MATRIZ ═════════════════════════════════════════════════════════════════════════════════════════════ */
const FILAS = [];
for (const [id, m] of Object.entries(VIEW_MANIFEST)) {
  const f = { id, m, vista: m.vista, seccion: m.seccion, label: m.label || id, limites: [], fallas: [] };
  // cada falla se etiqueta con SU columna. Sin la etiqueta habría que adivinar a cuál pertenece leyendo su texto —
  // y adivinar por substring es cómo "no resuelve contra la salida de comercial" terminaba marcando la columna de
  // la dirección (dentro de "salida " está "ida "). La columna es un dato, no una inferencia sobre prosa.
  const cae = (col, txt) => { f.fallas.push({ col, txt }); };
  const fallasDe = (col) => f.fallas.filter((x) => x.col === col).map((x) => x.txt);
  const marca = (col, alt = "✓") => (fallasDe(col).length ? "✗" : alt);

  // ── [ID] identidad ────────────────────────────────────────────────────────────────────────────────────────
  const [v, s, ...resto] = id.split("/");
  const slug = resto.join("/");
  const idOk = VISTAS.includes(v) && SECCIONES.includes(s) && !!slug && !slug.includes("/")
    && m.vista === v && m.seccion === s && TIPOS.includes(m.tipo)
    && (!m.comparacion || COMPARACIONES.includes(m.comparacion));
  const montado = MONTADOS.has(id);
  const padre = m._emitidoPor || null;
  const noMontado = m._noMontado || null;
  f.montaje = montado ? (MONTAJE[id] || "literal") : (padre ? `padre ${padre}` : (noMontado ? "no montado" : "—"));
  if (!idOk) cae("ID", "componentId mal formado o con vocabulario fuera del contrato");
  if (!montado) {
    if (padre) {
      if (!VIEW_MANIFEST[padre]) cae("ID", `\`_emitidoPor\` apunta a un componente inexistente: ${padre}`);
      else if (!MONTADOS.has(padre)) cae("ID", `\`_emitidoPor\` apunta a ${padre}, que tampoco está montado`);
      else if (VIEW_MANIFEST[padre].vista !== m.vista) cae("ID", `\`_emitidoPor\` apunta a ${padre}, que vive en otra cara — una pieza no puede viajar en el contexto de una vista que no es la suya`);
      else f.limites.push(`emitido por su pieza padre (${padre})`);
    } else if (noMontado) {
      if (String(noMontado).trim().length < 20) cae("ID", "`_noMontado` sin un motivo legible: no alcanza con marcar que no está, hay que decir por qué");
      else f.limites.push(`declarado y hoy no pintado: ${noMontado}`);
    } else {
      cae("ID", "declarado en el manifiesto pero NO montado en la UI y sin declarar por qué (`_emitidoPor` o `_noMontado`)");
    }
  }
  f.cID = marca("ID", montado ? "✓" : "◐");

  // ── [VC] emite ViewContext ────────────────────────────────────────────────────────────────────────────────
  const out = SALIDAS[id];
  const r = out == null ? { ok: false, errors: [`el builder declarado (${builderKeyOf(id)}) no produjo salida`] } : deriveViewContextOrErrors(id, out, { scenario: SCN, requestContext: RC });
  f.vc = r.ok ? r.vc : null;
  if (r.ok) {
    if (!isSealed(r.vc)) cae("VC", "el ViewContext derivado no está sellado en profundidad");
    if (r.vc.escenario !== SCN) cae("VC", `el contexto declara escenario "${r.vc.escenario}" y el panel usó "${SCN}"`);
    if (!r.vc.tenantId) cae("VC", "el contexto no lleva tenant");
    if (!r.vc.key) cae("VC", "el contexto no lleva key de invalidación");
    f.cVC = marca("VC");
  } else if (r.opcional && m.campoOpcional) {
    f.limites.push(`el campo "${m.campo}" no existe en esta construcción — limitación declarada (campoOpcional)`);
    f.cVC = "◐";
  } else {
    cae("VC", `no emite ViewContext: ${r.errors.join(" | ")}`);
    f.cVC = "✗";
  }

  // ── [TOOL] equivalente en el oráculo ──────────────────────────────────────────────────────────────────────
  const ev = Array.isArray(m.evidencia) ? m.evidencia : [];
  const desconocidas = ev.filter((e) => !e || !e.tool || !TOOLS[e.tool]).map((e) => (e && e.tool) || "(sin tool)");
  if (desconocidas.length) cae("TOOL", `declara tools que no existen en el registro del oráculo: ${desconocidas.join(", ")}`);
  let toolAlt = "✓";
  if (!ev.length) {
    const motivo = typeof m.sinTool === "string" ? m.sinTool.trim() : "";
    if (motivo.length < 40) cae("TOOL", "sin evidencia y sin un `sinTool` que explique por qué no se puede contrastar");
    else { f.limites.push("sin equivalente en el oráculo: " + _corto(motivo)); toolAlt = "◐"; }
  }
  // ── EL ESTADO DE CONCORDANCIA (owner 2026-08-09, decisión 11) ────────────────────────────────────────────
  // Ya no se pregunta "¿declara divergencia?" (un `null` respondía que no y significaba "no lo comprobé"): se
  // exige un estado del vocabulario cerrado y una razón verificable, en LOS TRES casos. Un `reconciled` sin razón
  // es la misma afirmación silenciosa que el null que vino a reemplazar.
  const conc = m.concordancia;
  if (!conc || typeof conc !== "object") cae("TOOL", "no declara `concordancia`: un componente sin estado explícito le dice al motor que su cifra y la de la tool son la misma (decisión 11)");
  else if (!CONCORDANCIA_ESTADOS.includes(conc.estado)) cae("TOOL", `\`concordancia.estado\` fuera del vocabulario: "${conc.estado}" (esperado ${CONCORDANCIA_ESTADOS.join(" | ")})`);
  else {
    const raz = typeof conc.razon === "string" ? conc.razon.trim() : "";
    if (raz.length < 40) cae("TOOL", `declara \`concordancia.estado: "${conc.estado}"\` sin una razón verificable (${raz.length} caracteres)`);
    else if (conc.estado !== "reconciled") {
      // un límite declarado BAJA la columna a "límite", pero nunca puede TAPAR una falla ya encontrada: si la
      // pieza declaró una tool inexistente, la columna sigue en ✗ aunque su razón esté impecablemente escrita.
      f.limites.push((conc.estado === "divergent" ? "cifra no reconciliada, declarada: " : "sin cifra que reconciliar, declarado: ") + _corto(raz));
      toolAlt = "◐";
    }
    if (conc.estado === "divergent" && !(Array.isArray(conc.campos) && conc.campos.length))
      cae("TOOL", "declara `divergent` sin decir en QUÉ campos: un desacuerdo sin dirección no se puede verificar");
  }
  f.cTOOL = marca("TOOL", toolAlt);
  f.tools = ev.map((e) => e.tool + (e.focus ? `@${e.focus}` : "")).join(" ") || "—";

  // ── [DIR] las dos puntas ──────────────────────────────────────────────────────────────────────────────────
  let ida = false, vuelta = false;
  if (f.vc) {
    const str = formatAddress(addressFromViewContext(f.vc));
    const back = str && parseAddress(str);
    const res = back && resolveAddress(back);
    ida = !!(res && res.componentId === id && res.cara === m.vista && res.conocido);
    if (!ida) cae("DIR", `la ida Sentrix→ADI no reabre el mismo componente (${str || "sin dirección"})`);
    const act = normalizeSentrixAction(buildSentrixActionFromAddress(back));
    if (!act || !act.label) cae("DIR", "la dirección no produce un CTA que sobreviva a normalizeSentrixAction");
    if (!evidenceForAddress(back, SCN)) cae("DIR", "la dirección no produce la evidencia que abre el panel");
  } else {
    // sin contexto derivable no hay ida que probar. Si esa ausencia está DECLARADA (campoOpcional) es un límite ya
    // registrado; si no lo está, la falla ya quedó anotada en la columna VC y no se duplica acá.
    ida = null;
  }
  const sonda = sondaDe(id, m);
  f.apertura = sonda.ap;
  if (sonda.ap === "ninguna") {
    vuelta = null;
    f.limites.push("ADI no puede señalar esta pieza: ninguna tool la demuestra, así que se abstiene y cae a la vista");
  } else if (!sonda.addr) {
    cae("DIR", `la vuelta ADI→Sentrix no produce dirección (apertura declarada: ${sonda.ap})`);
  } else {
    const res = resolveAddress(sonda.addr);
    if (!res || !res.conocido) cae("DIR", `la vuelta ADI→Sentrix apunta a un componente no declarado (${formatAddress(sonda.addr)})`);
    else if (res.cara !== m.vista) cae("DIR", `la vuelta ADI→Sentrix abre OTRA cara: ${res.cara} en vez de ${m.vista}`);
    else {
      vuelta = true;
      f.aterriza = res.componentId;
      if (res.componentId !== id) f.limites.push(`la vuelta aterriza en la pieza hermana ${res.componentId} (comparten evidencia; la tool no las distingue)`);
    }
  }
  f.cDIR = marca("DIR", (ida === true && vuelta === true && f.aterriza === id) ? "✓" : "◐");

  // ── [DECL] universo · unidad · período · estatus ──────────────────────────────────────────────────────────
  const u = m.universo || null;
  if (!u || !UNIVERSO_KINDS.includes(u.kind)) cae("DECL", "universo sin `kind` del vocabulario");
  if (!u || !u.label || !String(u.label).trim()) cae("DECL", "universo sin label: nadie sabría contra qué se lee la cifra");
  if (u && m.estatusDefault === "probado" && !u.cierraCon) cae("DECL", "un componente sellado `probado` tiene que declarar con qué cierra su universo");
  if (u && !u.cierraCon) f.limites.push("universo sin ancla de cierre declarada");
  const un = unidadDe(m);
  for (const e of un.errores) cae("DECL", e);
  f.unidad = un.unidad ? un.unidad + (un.escala ? `:${un.escala}` : "") : "—";
  if (m.unidadMotivo) f.limites.push("unidad declarada contra el registro: " + _corto(m.unidadMotivo));
  const periodo = (m.periodo && String(m.periodo).trim()) || (m.periodoCampo ? "(del builder)" : "");
  if (!periodo) cae("DECL", "sin período declarado ni `periodoCampo`");
  if (f.vc && !f.vc.periodo) cae("DECL", "el contexto derivado sale sin período");
  if (!ESTATUS.includes(m.estatusDefault)) cae("DECL", `estatus por defecto fuera del vocabulario: "${m.estatusDefault}"`);
  if (f.vc && !ESTATUS.includes(f.vc.estatus)) cae("DECL", `el contexto derivado sale con un sello inválido: "${f.vc.estatus}"`);
  f.estatus = (f.vc && f.vc.estatus) || m.estatusDefault || "—";
  f.universoN = f.vc && f.vc.universo && f.vc.universo.n != null ? String(f.vc.universo.n) : "—";
  f.cDECL = marca("DECL");

  // ── veredicto ─────────────────────────────────────────────────────────────────────────────────────────────
  f.veredicto = f.fallas.length ? "DESCUBIERTO" : (f.limites.length ? "LÍMITE DECLARADO" : "CUBIERTO");
  f.fallasDe = fallasDe;
  FILAS.push(f);
}
function _corto(s, n = 96) { const t = String(s).replace(/\s+/g, " ").trim(); return t.length > n ? t.slice(0, n - 1) + "…" : t; }

/* ══ 5 · IMPRESIÓN DE LA MATRIZ ════════════════════════════════════════════════════════════════════════════════ */
const pad = (s, n) => { const t = String(s); return t.length > n ? t.slice(0, n - 1) + "…" : t + " ".repeat(n - t.length); };
console.log("\n╔══ MATRIZ DE COBERTURA · ADI ↔ SENTRIX ═══════════════════════════════════════════════════════════════════════════════╗");
console.log(`  ${pad("COMPONENTE", 44)} ${pad("MONTAJE", 15)} ID VC TOOL DIR DECL  ${pad("UNIDAD", 10)} ${pad("SELLO", 9)} ${pad("N", 4)} VEREDICTO`);
console.log("  " + "─".repeat(126));
for (const vista of VISTAS) {
  const filas = FILAS.filter((f) => f.vista === vista);
  if (!filas.length) continue;
  console.log(`  ── ${vista.toUpperCase()} ${"─".repeat(120 - vista.length)}`);
  for (const f of filas) {
    const marca = f.veredicto === "CUBIERTO" ? "CUBIERTO" : f.veredicto === "LÍMITE DECLARADO" ? "límite declarado" : "✗ DESCUBIERTO";
    console.log(`  ${pad(f.id, 44)} ${pad(f.montaje, 15)} ${f.cID}  ${f.cVC}  ${pad(f.cTOOL, 4)} ${pad(f.cDIR, 3)} ${pad(f.cDECL, 4)}  ${pad(f.unidad, 10)} ${pad(f.estatus, 9)} ${pad(f.universoN, 4)} ${marca}`);
  }
}
console.log("  " + "─".repeat(126));
{
  const cub = FILAS.filter((f) => f.veredicto === "CUBIERTO").length;
  const lim = FILAS.filter((f) => f.veredicto === "LÍMITE DECLARADO").length;
  const des = FILAS.filter((f) => f.veredicto === "DESCUBIERTO").length;
  console.log(`  ${FILAS.length} componentes · ${cub} cubiertos · ${lim} con límite declarado · ${des} descubiertos`);
  for (const vista of VISTAS) {
    const fs2 = FILAS.filter((f) => f.vista === vista);
    if (!fs2.length) continue;
    console.log(`     ${pad(vista, 11)} ${pad(String(fs2.length) + " piezas", 11)} ${fs2.filter((f) => f.veredicto === "CUBIERTO").length} cubiertas · ${fs2.filter((f) => f.veredicto === "LÍMITE DECLARADO").length} con límite · ${fs2.filter((f) => f.veredicto === "DESCUBIERTO").length} descubiertas`);
  }
}
console.log("╚══════════════════════════════════════════════════════════════════════════════════════════════════════════════════════╝");

/* ══ 6 · LAS AFIRMACIONES ══════════════════════════════════════════════════════════════════════════════════════ */
H("[1] IDENTIDAD · biyección UI ↔ manifiesto (un componente nuevo no puede nacer desconectado)");
{
  ok(callSitesTotales > 0, `el panel monta contextos en ${callSitesTotales} puntos`);
  ok(callSites === callSitesTotales && callSitesResueltos === callSitesTotales,
    `los ${callSitesTotales} call sites del hook resuelven a un componentId (${callSitesResueltos} resueltos)`,
    "hay una forma de montar el hook que este gate no sabe leer: o se usa un literal, o se extiende el resolvedor — nunca un agujero silencioso");
  const fantasmas = [...MONTADOS].filter((id) => !VIEW_MANIFEST[id]);
  ok(!fantasmas.length, "todo componente montado en la UI está declarado en el manifiesto", fantasmas.join(", "));
  const huerfanos = FILAS.filter((f) => f.cID === "✗").map((f) => f.id);
  ok(!huerfanos.length, "todo componente declarado está montado, o declara `_emitidoPor` / `_noMontado` con motivo", huerfanos.join("\n      "));
  const malPadre = Object.entries(VIEW_MANIFEST).filter(([, m]) => m._emitidoPor && m._noMontado).map(([id]) => id);
  ok(!malPadre.length, "ningún componente declara a la vez que lo emite su padre y que no está montado", malPadre.join(", "));
  const sinVista = VISTAS.filter((v) => !vistaComponentId(v));
  ok(!sinVista.length, "las cuatro caras tienen su componente de contexto ambiente", sinVista.join(", "));
}

H("[2] EMISIÓN · cada pieza deriva de su builder real y sale sellada");
{
  const mudos = FILAS.filter((f) => f.cVC === "✗").map((f) => f.id + " → " + f.fallasDe("VC").join(" | "));
  ok(!mudos.length, `${FILAS.filter((f) => f.cVC === "✓").length} de ${FILAS.length} componentes emiten ViewContext sellado`, mudos.join("\n      "));
  const opc = FILAS.filter((f) => f.cVC === "◐");
  ok(opc.every((f) => f.m.campoOpcional), `los ${opc.length} que no emiten son ausencias DECLARADAS (campoOpcional), no fallas`, opc.map((f) => f.id).join(", "));
  const escenarioMal = FILAS.filter((f) => f.vc && f.vc.escenario !== SCN).map((f) => f.id);
  ok(!escenarioMal.length, "ningún contexto declara un escenario distinto del que usó el panel", escenarioMal.join(", "));
  const keys = new Map();
  for (const f of FILAS) if (f.vc) { if (keys.has(f.vc.key)) keys.set(f.vc.key, keys.get(f.vc.key) + "," + f.id); else keys.set(f.vc.key, f.id); }
  const chocan = [...keys.values()].filter((x) => x.includes(","));
  ok(!chocan.length, "dos componentes distintos nunca comparten key de invalidación", chocan.join(" | "));
}

H("[3] EQUIVALENTE EN ADI · o hay tool, o está declarado por qué no");
{
  const rotas = FILAS.filter((f) => f.cTOOL === "✗").map((f) => f.id + " → " + f.fallasDe("TOOL").join(" | "));
  ok(!rotas.length, "ningún componente calla ni declara una tool inexistente", rotas.join("\n      "));
  const conTool = FILAS.filter((f) => (f.m.evidencia || []).length).length;
  const sinTool = FILAS.filter((f) => !(f.m.evidencia || []).length).length;
  info(`${conTool} componentes tienen equivalente en el oráculo · ${sinTool} declaran por qué no lo tienen`);
  const declaradas = new Set(toolsConComponente());
  const huerfanas = Object.keys(TOOLS).filter((t) => !declaradas.has(t));
  info(`${declaradas.size} tools del oráculo tienen componente que las demuestra; ${huerfanas.length} caen al default honesto de la vista`, huerfanas.join(", "));
  const divSinMotivo = Object.keys(VIEW_MANIFEST).filter((id) => { const d = divergenciaDe(id); return d && !(d.motivo || "").trim(); });
  ok(!divSinMotivo.length, "toda divergencia numérica conocida viene con su motivo escrito", divSinMotivo.join(", "));

  // DECISIÓN 11 · NINGÚN COMPONENTE PUEDE CALLAR. El candado es sobre el manifiesto ENTERO, no sólo sobre las filas
  // que este gate cruzó: un componente sin estado le dice al motor que la cifra de su tool es la de la pantalla.
  const sinEstado = Object.keys(VIEW_MANIFEST).filter((id) => {
    const c = concordanciaDe(id);
    return !c || !CONCORDANCIA_ESTADOS.includes(c.estado) || String(c.razon || "").trim().length < 40;
  });
  ok(!sinEstado.length,
    `los ${Object.keys(VIEW_MANIFEST).length} componentes declaran su estado de concordancia con razón verificable (0 \`null\` silenciosos)`,
    sinEstado.join(", "));
  const porEstado = CONCORDANCIA_ESTADOS.map((e) => `${e}: ${Object.keys(VIEW_MANIFEST).filter((id) => concordanciaDe(id).estado === e).length}`);
  info("estado de concordancia declarado por componente · " + porEstado.join(" · "));
}

H("[4] DIRECCIÓN · resoluble en las dos puntas");
{
  const rotas = FILAS.filter((f) => f.cDIR === "✗").map((f) => f.id + " → " + f.fallasDe("DIR").join(" | "));
  ok(!rotas.length, "todas las direcciones resuelven en las dos puntas o declaran su abstención", rotas.join("\n      "));
  const exactas = FILAS.filter((f) => f.aterriza === f.id).length;
  const hermanas = FILAS.filter((f) => f.aterriza && f.aterriza !== f.id);
  info(`la vuelta ADI→Sentrix aterriza exacta en ${exactas} piezas y en una hermana de la misma cara en ${hermanas.length}`,
    hermanas.map((f) => `${f.id} → ${f.aterriza}`).join(" · "));
  const caraMala = FILAS.filter((f) => f.aterriza && VIEW_MANIFEST[f.aterriza].vista !== f.vista).map((f) => f.id);
  ok(!caraMala.length, "ninguna vuelta manda al usuario a la cara equivocada", caraMala.join(", "));
  const aperturas = {};
  for (const f of FILAS) aperturas[f.apertura] = (aperturas[f.apertura] || 0) + 1;
  info("aperturas declaradas: " + Object.entries(aperturas).map(([k, n]) => `${k} ${n}`).join(" · "));
  // la abstención tiene que ser DECLARADA, nunca el efecto secundario de un manifiesto incompleto
  const abst = FILAS.filter((f) => f.apertura === "ninguna");
  const abstMuda = abst.filter((f) => !(f.m.sinTool || "").trim()).map((f) => f.id);
  ok(!abstMuda.length, `las ${abst.length} piezas que ADI no puede señalar declaran su motivo`, abstMuda.join(", "));
}

H("[5] UNIVERSO · UNIDAD · PERÍODO · SELLO declarados");
{
  const rotas = FILAS.filter((f) => f.cDECL === "✗").map((f) => f.id + " → " + f.fallasDe("DECL").join(" | "));
  ok(!rotas.length, "los 4 declarados están completos en todos los componentes", rotas.join("\n      "));
  const money = FILAS.filter((f) => f.unidad.startsWith("money"));
  const sinEscala = money.filter((f) => !f.unidad.includes(":")).map((f) => f.id);
  ok(!sinEscala.length, `las ${money.length} piezas en dinero declaran su escala (miles vs dólares crudos)`, sinEscala.join(", "));
  const conMotivo = FILAS.filter((f) => f.m.unidadMotivo);
  ok(conMotivo.every((f) => f.m.unidad), `las ${conMotivo.length} unidades que se apartan del registro de métricas dicen por qué`,
    conMotivo.map((f) => f.id).join(", "));
  // el tamaño del universo lo pone el DATO, no el manifiesto
  const listas = FILAS.filter((f) => f.vc && ["tabla", "lista", "serie", "barra"].includes(f.m.tipo));
  const sinN = listas.filter((f) => f.vc.universo.n == null).map((f) => f.id);
  ok(!sinN.length, `las ${listas.length} tablas/listas/series/barras traen el tamaño de su universo desde el dato`, sinN.join(", "));
  const sellos = {};
  for (const f of FILAS) sellos[f.estatus] = (sellos[f.estatus] || 0) + 1;
  info("sellos en pantalla: " + Object.entries(sellos).map(([k, n]) => `${k} ${n}`).join(" · "));
}

H("[6] VEREDICTO DE COBERTURA");
{
  const des = FILAS.filter((f) => f.veredicto === "DESCUBIERTO");
  ok(!des.length, `ningún componente de las cuatro caras queda sin cobertura (${FILAS.length} evaluados)`,
    des.map((f) => `${f.id}\n        · ` + f.fallas.map((x) => `[${x.col}] ${x.txt}`).join("\n        · ")).join("\n      "));
  const lim = FILAS.filter((f) => f.veredicto === "LÍMITE DECLARADO");
  ok(lim.every((f) => f.limites.length), "todo 'límite declarado' trae el texto que dice cuál es el límite");
  // el gate no se puede quedar corto: tiene que haber mirado TODAS las caras y TODOS los componentes
  const vistasCubiertas = new Set(FILAS.map((f) => f.vista));
  ok(vistasCubiertas.size === VISTAS.length, `la matriz cubre las ${VISTAS.length} caras`, [...vistasCubiertas].join(", "));
  ok(FILAS.length === Object.keys(VIEW_MANIFEST).length, "la matriz tiene una fila por componente declarado, sin omitir ninguno");
}

H("[7] NIVEL 2 · las superficies que ADI ABRE devuelven contexto (decisión 12)");
{
  const N2 = componentIdsNivel2();
  ok(N2.length > 0, `${N2.length} superficies de nivel 2 declaradas (las que el chat abre cuando responde)`);

  // 7a · cada una declara un builder PROPIO y ese builder existe y produce salida. Un componente de nivel 2 que
  // heredara el builder de su cara estaría describiendo otra cosa que la que el usuario tiene delante.
  const sinSpec = N2.filter((id) => !SUPERFICIE_BUILDERS[VIEW_MANIFEST[id].builder]);
  ok(!sinSpec.length, "cada superficie declara un builder propio, presente en SUPERFICIE_BUILDERS", sinSpec.join(", "));
  const sinSalida = N2.filter((id) => SALIDAS[id] == null);
  ok(!sinSalida.length, `las ${N2.length} superficies producen salida viva con el builder que declaran`, sinSalida.join(", "));

  // 7b · el runner y el manifiesto declaran EXACTAMENTE las mismas claves. Una superficie sin corredor quedaría
  // muda; un corredor sin superficie es una salida que nadie declara. Las dos son rojo, no una nota al pie.
  const declaradas = [...new Set([...Object.keys(VIEW_BUILDERS), ...Object.keys(SUPERFICIE_BUILDERS)])].sort();
  const corribles = clavesCorribles();
  const huerfanas = declaradas.filter((k) => !corribles.includes(k));
  const sobrantes = corribles.filter((k) => !declaradas.includes(k));
  ok(!huerfanas.length && !sobrantes.length,
    `las ${declaradas.length} claves de builder declaradas son exactamente las que el runner sabe correr`,
    [huerfanas.length ? `declaradas sin corredor: ${huerfanas.join(", ")}` : "", sobrantes.length ? `corredores sin declarar: ${sobrantes.join(", ")}` : ""].filter(Boolean).join(" · "));

  // 7c · LA VUELTA. Es lo que faltaba: el panel que ADI abre tiene que producir dirección hacia SU cara. Una
  // superficie que se abstiene deja al usuario sin camino de regreso, y eso acá no puede pasar en silencio.
  const mudas = N2.filter((id) => FILAS.find((f) => f.id === id).apertura === "ninguna");
  ok(!mudas.length, "ninguna superficie de nivel 2 se abstiene: todas resuelven la vuelta ADI→Sentrix", mudas.join(", "));
  const caraMal = N2.map((id) => FILAS.find((f) => f.id === id)).filter((f) => f.aterriza && VIEW_MANIFEST[f.aterriza].vista !== f.vista);
  ok(!caraMal.length, "la vuelta de cada superficie aterriza en la cara que la demuestra", caraMal.map((f) => `${f.id} → ${f.aterriza}`).join(", "));

  // 7d · LA IDA. El contexto que emite tiene que reabrir la MISMA superficie, no la cara genérica: es lo que
  // convierte «y de esos, ¿cuál…?» en una pregunta resoluble sobre lo que el usuario está mirando.
  const idaMal = [];
  for (const id of N2) {
    const f = FILAS.find((x) => x.id === id);
    if (!f.vc) { idaMal.push(`${id} (sin contexto derivado)`); continue; }
    const back = parseAddress(formatAddress(addressFromViewContext(f.vc)));
    const res = back && resolveAddress(back);
    if (!res || res.componentId !== id) idaMal.push(`${id} → ${res ? res.componentId : "sin dirección"}`);
  }
  ok(!idaMal.length, `las ${N2.length} superficies reabren su propio componente desde el contexto que emiten`, idaMal.join(", "));

  // 7e · el contexto de una superficie NUNCA puede confundirse con el de su cara: si compartieran key, el chat
  // resolvería «esto» contra la pantalla de atrás. La key es el candado de invalidación, así que es la prueba.
  const choques = N2.filter((id) => {
    const f = FILAS.find((x) => x.id === id);
    const amb = FILAS.find((x) => x.id === `${VIEW_MANIFEST[id].vista}/otro/vista`);
    return f.vc && amb && amb.vc && f.vc.key === amb.vc.key;
  });
  ok(!choques.length, "ninguna superficie comparte key de invalidación con el contexto ambiente de su cara", choques.join(", "));

  // 7f · EL EMISOR ESTÁ CABLEADO EN LA UI, y con `ambient`: publicar mientras está montada y LIMPIAR al
  // desmontarla es lo que hace que cambiar de vista o de pestaña no deje el contexto anterior contaminando el
  // turno siguiente. Sin `ambient` la superficie sólo hablaría si el usuario pulsa un botón.
  const sinAmbiente = N2.filter((id) => {
    const re = new RegExp(`useViewContext\\(\\s*["'\`]${id.replace(/[/-]/g, "\\$&")}["'\`][\\s\\S]{0,300}?\\n`, "m");
    const bloque = re.exec(PANEL);
    return !bloque || !/ambient\s*:/.test(bloque[0]);
  });
  ok(!sinAmbiente.length,
    `las ${N2.length} superficies publican su contexto como AMBIENTE (se limpia solo al desmontarse: cambiar de pestaña, de foco o cerrar el panel lo borra)`,
    sinAmbiente.join(", "));

  // 7g · la LIMPIEZA es del hook, no de cada call site: un solo lugar publica y un solo lugar borra.
  const HOOK = fs.readFileSync(path.join(RAIZ, "src", "ui", "useViewContext.js"), "utf8");
  ok(/return\s*\(\)\s*=>\s*\{[^}]*setUISignal\(\{\s*viewContext:\s*null/.test(HOOK),
    "el hook borra el contexto ambiente al desmontar (la limpieza es estructural, no una convención de cada vista)");
}

if (FILAS.some((f) => f.limites.length)) {
  H("LÍMITES DECLARADOS · las fronteras honestas del contrato, en un solo lugar");
  for (const f of FILAS.filter((x) => x.limites.length)) {
    console.log(`  · ${f.id}`);
    for (const l of f.limites) console.log(`      ${l}`);
  }
}

console.log(`\n${FAIL ? "✗" : "✓"} CONCORDANCIA · COBERTURA · ${PASS} pasaron · ${FAIL} fallaron`);
process.exit(FAIL ? 1 : 0);
