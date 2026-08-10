/* === src/adi/oracle/viewContext.js · CONTRATO DE CONCORDANCIA ADI ↔ SENTRIX · EL CONTEXTO DE PANTALLA =========
 * (owner 2026-08-09 · frente NÚCLEO)
 *
 * QUÉ RESUELVE. "Explicame este gráfico", "qué significa ese punto", "cuáles de estos clientes", "qué hago con
 * esos SKU" no tienen respuesta posible si ADI no sabe QUÉ está mirando el usuario. Hasta hoy esa información
 * viajaba de dos maneras, las dos malas: `uiSignals` (una bolsa global sin forma — `setUISignal(patch)`, 10
 * líneas) y un STRING escrito a mano en cada botón (`onAsk("¿Qué clientes están por debajo de su presupuesto?")`).
 * Este módulo la convierte en un objeto TIPADO, VALIDADO e INMUTABLE.
 *
 * LA FRONTERA (la misma del contrato v2, sin excepción): el ViewContext IDENTIFICA qué está viendo el usuario.
 * NO transporta cifras, ni filas, ni tablas, ni series. PLAN le pide a las tools la evidencia; el MOTOR calcula,
 * filtra, compara, ordena y autoriza. Un contexto de pantalla no autoriza NADA numérico — por eso no lleva números
 * más que conteos de universo, y por eso `projectViewContextForPlan` produce UNA LÍNEA sin una sola cifra de negocio.
 *
 * O(1) EN ENTIDADES · ESTRUCTURAL, NO UNA CONVENCIÓN. `validateViewContext` RECHAZA un contexto con más de
 * VIEW_SELECTION_MAX entidades explícitas. La única forma de representar 300 clientes es
 * `{modo:"filtro", n:300, filtro:{canal:"Retail"}}`. No hay rama del código que pueda emitir 300 nombres: la que
 * lo intente falla la validación y `deriveViewContext` devuelve null.
 *
 * SELLADO EN LA MISMA CAPA QUE NarrationContract (mejora A del owner). `sealViewContext` usa `deepFreeze` —la
 * MISMA primitiva de narrationContract.js, importada, no copiada— y el contexto queda además DENTRO del árbol que
 * `buildNarrationContract` congela al final (`scope.vista`), así que `isSealed(contract)` afirma su inmutabilidad
 * sin una sola línea nueva de verificación.
 *
 * PURO · SIN ESTADO · SIN DOM · SIN LLM · gate-testable.
 */
import { deepFreeze } from "./narrationContract.js";
// REPARACIÓN CONTEXTUAL (Contrato v1.2): la pantalla se invalida con la MISMA matriz de compatibilidad que el
// resto del contexto — nunca con un criterio propio. Ver la regla 2b de invalidateViewContext.
import { normalizeReparacion, camposQueSeInvalidan } from "./conversationalContract.js";
import { fnv1a } from "./sentrixEvidence.js";
import { ENTITIES } from "../../config/contract/entityRegistry.js";
import { METRICS } from "../../config/contract/metricRegistry.js";
import { SURFACE, surfaceBlock } from "../../config/contract/surfaceContract.js";
import { VIEW_MANIFEST, VISTAS, SECCIONES, TIPOS, COMPARACIONES, UNIVERSO_KINDS, VISTA_LABEL, concordanciaDe } from "../sentrix/viewManifest.js";

export const VIEW_CONTEXT_VERSION = "adi-view-context@1.0.0";
// EL CANDADO O(1), en una constante. 8 es el techo de lo que una persona señala a mano en una pantalla; por encima
// de eso lo que hay es un FILTRO, y así viaja. Subirlo no rompe nada, pero deja de ser O(1) — por eso está acá,
// visible, y no escondido dentro de un `if`.
export const VIEW_SELECTION_MAX = 8;
// Cuántos turnos sobrevive el contexto con el panel CERRADO. 1: el usuario cierra Sentrix y pregunta "y eso por
// qué pasó" — ese turno todavía es sobre lo que estaba mirando. El siguiente ya no.
export const VIEW_CONTEXT_TTL_TURNOS = 1;
// LA UNIDAD DEL CONTADOR, explícita (owner 2026-08-09, revisión del frente NÚCLEO). `turno` NO es un contador de
// turnos conversacionales: es `history.length` — la convención que ya reciben updateConversationScope y
// updateRecentSubjects. Y `history` es la lista PLANA de mensajes (ChatADI.jsx empuja userMsg + adiMsg), así que un
// turno conversacional avanza el contador de a DOS. Comparar el TTL en "turnos" contra un delta en "entradas" hacía
// que el contexto muriera SIEMPRE en el turno siguiente (delta 2 > TTL 1) y la sobrevida declarada arriba no
// ocurriera nunca. La conversión vive acá, en una constante visible, y no escondida dentro del `if`.
export const VIEW_CONTEXT_ENTRADAS_POR_TURNO = 2;
export const VIEW_CONTEXT_TTL_ENTRADAS = VIEW_CONTEXT_TTL_TURNOS * VIEW_CONTEXT_ENTRADAS_POR_TURNO;
// Tope de etiquetas de evidencia que viaja. No van al prompt: sirven para que Sentrix reabra lo mismo.
export const VIEW_EVIDENCE_IDS_MAX = 12;
// Tope duro de la línea que ve el LLM. Si un componente tuviera un label largo, se recorta — nunca se infla el prompt.
export const VIEW_PLAN_LINE_MAX = 240;
// ── EL SEGUNDO CANDADO O(1) · LAS FILAS DE LA EVIDENCIA SEMBRADA ────────────────────────────────────────────────
// (owner 2026-08-09, hallazgo del frente de ESCALA — medido, no supuesto.) VIEW_SELECTION_MAX acota lo que el
// CONTEXTO transporta; esto acota lo que el contexto MANDA A PEDIR. Sin él, el candado de arriba se cumplía y el
// prompt explotaba igual: "explicame este gráfico" sobre `capital/01/barras` siembra queryMetric{capital,sku}, que
// NO tiene cota propia (composeSpecRetrieval solo recorta si viene `limit`), así que el payload de la Pasada 2
// medía 6.114 B en el tenant demo (13 SKU) y 613.411 B en un tenant de 5.200 SKU — ×100, ~118 B por SKU, lineal en
// las entidades. Y era además una discordancia: ese componente declara `universo.n = 2` (dos barras en pantalla)
// mientras la evidencia autorizaba 5.200 cifras — ADI quedaba habilitado a hablar de un universo que nadie miró.
// El tope se aplica a la call SEMBRADA, no a la que pide el usuario ni a la que emite PLAN: es el motor limitando
// SU PROPIA siembra automática. 50 está por encima de cualquier universo que el demo declara (el corte es un no-op
// ahí, byte por byte) y por debajo del punto donde un ranking deja de ser legible en una narración.
export const VIEW_EVIDENCE_ROWS_MAX = 50;
// Tools SIN COTA PROPIA que aceptan `limit`: la siembra las acota. Las demás no entran acá por razones distintas y
// verificadas una por una — gridTable (default 20) y tensionRead (default 10) ya vienen acotadas por el registro, y
// meterles un `limit` las EMPEORARÍA (subiría su tope); inventoryStatus acepta `limit` pero solo lo honra en los
// focos de cruce ranking×inventario (specRetrieval.js), no en el foco por defecto, así que pasárselo daría una
// falsa sensación de cota; marginRead/salesRead/contributionRead/diagnose no tienen el parámetro. Lo que esos
// casos siguen costando está MEDIDO y declarado, no supuesto (ver el reporte del frente de escala).
const _TOOLS_SIN_COTA_PROPIA = new Set(["queryMetric"]);
// _acotaArgs(tool, args) → args con la cota aplicada. Si el manifiesto ya declaró un `limit`, gana el MENOR de los
// dos: el manifiesto puede pedir menos filas que el tope, nunca más.
function _acotaArgs(tool, args) {
  const a = { ...(args || {}) };
  if (!_TOOLS_SIN_COTA_PROPIA.has(tool)) return a;
  const decl = Number(a.limit);
  a.limit = (isFinite(decl) && decl > 0) ? Math.min(decl, VIEW_EVIDENCE_ROWS_MAX) : VIEW_EVIDENCE_ROWS_MAX;
  return a;
}

export const SELECCION_MODOS = ["todas", "explicita", "filtro"];
export const ESTATUS = ["probado", "indicado", "abierto"];
const EJES_NO_ENTIDAD = ["cartera", "tiempo"];

// ── helpers puros ──────────────────────────────────────────────────────────────────────────────────────────────
const _str = (v) => (typeof v === "string" ? v.trim() : "");
const _isPlain = (v) => !!v && typeof v === "object" && !Array.isArray(v);
// un valor de filtro/control legítimo es ESCALAR. Un objeto anidado ahí sería un payload disfrazado de contexto.
const _isScalar = (v) => v == null || typeof v === "string" || typeof v === "number" || typeof v === "boolean";
function _cleanScalarMap(obj, { max = 24 } = {}) {
  const out = {};
  if (!_isPlain(obj)) return out;
  for (const [k, v] of Object.entries(obj)) {
    if (Object.keys(out).length >= max) break;
    if (v == null || v === "") continue;
    if (!_isScalar(v)) continue;
    out[String(k)] = v;
  }
  return out;
}
// JSON canónico (claves ordenadas en profundidad) — para que la key del contexto sea estable pase lo que pase con
// el orden en que la UI arme el objeto. Sin esto, `{a,b}` y `{b,a}` darían dos keys distintas para la misma pantalla.
function _canon(v) {
  if (v === null || typeof v !== "object") return JSON.stringify(v === undefined ? null : v);
  if (Array.isArray(v)) return `[${v.map(_canon).join(",")}]`;
  return `{${Object.keys(v).sort().map((k) => `${JSON.stringify(k)}:${_canon(v[k])}`).join(",")}}`;
}

// ── VALIDACIÓN ─────────────────────────────────────────────────────────────────────────────────────────────────
// Valida contra las FUENTES REALES del contrato de datos (ENTITIES/METRICS/SURFACE) y contra el manifiesto —
// nunca contra listas nuevas paralelas. Devuelve el contexto NORMALIZADO (mismos campos, tipos garantizados) o
// la lista de errores. Nunca tira: un contexto inválido es una señal, no una excepción.
export function validateViewContext(raw) {
  const e = [];
  if (!_isPlain(raw)) return { ok: false, errors: ["el contexto no es un objeto"] };

  const tenantId = _str(raw.tenantId);
  if (!tenantId) e.push("tenantId ausente — un contexto sin tenant no se puede validar contra ningún dato");

  const componentId = _str(raw.componentId);
  const m = VIEW_MANIFEST[componentId];
  if (!componentId) e.push("componentId ausente");
  else if (!m) e.push(`componentId no declarado en viewManifest.js: "${componentId}"`);

  const vista = _str(raw.vista);
  if (!VISTAS.includes(vista)) e.push(`vista inválida: "${vista}"`);
  const seccion = _str(raw.seccion);
  if (!SECCIONES.includes(seccion)) e.push(`sección inválida: "${seccion}"`);
  const tipo = _str(raw.tipo);
  if (!TIPOS.includes(tipo)) e.push(`tipo inválido: "${tipo}"`);
  // LA DIRECCIÓN ES EL componentId: si vista/sección no son las del id, hay dos identificadores y el contrato se cae.
  if (m && componentId && (!componentId.startsWith(`${vista}/${seccion}/`)))
    e.push(`componentId "${componentId}" no concuerda con vista/sección "${vista}/${seccion}"`);

  const metrica = raw.metrica == null ? null : _str(raw.metrica);
  if (metrica && !METRICS[metrica]) e.push(`métrica no declarada en metricRegistry: "${metrica}"`);
  const eje = raw.eje == null ? null : _str(raw.eje);
  if (eje && !ENTITIES[eje] && !EJES_NO_ENTIDAD.includes(eje)) e.push(`eje no declarado en entityRegistry: "${eje}"`);

  const escenario = _str(raw.escenario);
  if (!escenario) e.push("escenario ausente — sin escenario el contexto no identifica qué dato está en pantalla");
  const periodo = raw.periodo == null ? null : _str(raw.periodo) || null;

  const u = _isPlain(raw.universo) ? raw.universo : null;
  if (!u) e.push("universo ausente");
  else if (!UNIVERSO_KINDS.includes(_str(u.kind))) e.push(`universo.kind inválido: "${u && u.kind}"`);
  const universo = u ? {
    kind: _str(u.kind),
    n: typeof u.n === "number" && isFinite(u.n) ? u.n : null,
    label: u.label == null ? null : _str(u.label) || null,
    cierraCon: u.cierraCon == null ? null : _str(u.cierraCon) || null,
  } : null;

  const s = _isPlain(raw.seleccion) ? raw.seleccion : { modo: "todas", n: 0, entidades: [], filtro: null };
  const modo = SELECCION_MODOS.includes(_str(s.modo)) ? _str(s.modo) : null;
  if (!modo) e.push(`selección.modo inválido: "${s && s.modo}"`);
  const entidades = Array.isArray(s.entidades) ? s.entidades.filter((x) => typeof x === "string" && x.trim()).map((x) => x.trim()) : [];
  const filtroSel = _isPlain(s.filtro) ? _cleanScalarMap(s.filtro) : null;
  const nSel = typeof s.n === "number" && isFinite(s.n) ? s.n : entidades.length;
  // ── EL CANDADO O(1) ──────────────────────────────────────────────────────────────────────────────────────────
  if (modo === "explicita" && entidades.length > VIEW_SELECTION_MAX)
    e.push(`selección explícita de ${entidades.length} entidades supera VIEW_SELECTION_MAX=${VIEW_SELECTION_MAX} — una selección grande viaja como FILTRO, jamás como lista de nombres`);
  if (modo === "explicita" && !entidades.length) e.push("selección explícita sin entidades");
  if (modo === "filtro" && (!filtroSel || !Object.keys(filtroSel).length)) e.push("selección por filtro sin filtro declarado");
  const seleccion = modo ? {
    modo,
    n: modo === "explicita" ? entidades.length : nSel,
    entidades: modo === "explicita" ? entidades.slice(0, VIEW_SELECTION_MAX) : [],
    filtro: modo === "filtro" ? filtroSel : null,
  } : null;

  const filtros = _cleanScalarMap(raw.filtros);
  const comparacion = raw.comparacion == null ? null : _str(raw.comparacion) || null;
  if (comparacion && !COMPARACIONES.includes(comparacion)) e.push(`comparación no declarada: "${comparacion}"`);
  // los controles se acotan a lo que el manifiesto declara: un toggle no declarado se DESCARTA en vez de viajar
  // como estado arbitrario que nadie validó.
  const controlesDecl = (m && Array.isArray(m.controles)) ? m.controles : [];
  const controlesIn = _cleanScalarMap(raw.controles);
  const controles = {};
  for (const k of Object.keys(controlesIn)) if (controlesDecl.includes(k)) controles[k] = controlesIn[k];

  const evidenceIds = (Array.isArray(raw.evidenceIds) ? raw.evidenceIds : [])
    .filter((x) => typeof x === "string" && x.trim()).map((x) => x.trim()).slice(0, VIEW_EVIDENCE_IDS_MAX);

  let estatus = _str(raw.estatus);
  if (!ESTATUS.includes(estatus)) e.push(`estatus inválido: "${raw.estatus}"`);

  // ── SUPERFICIE HONESTA ───────────────────────────────────────────────────────────────────────────────────────
  // Si el par métrica@eje está DECLARADO en el contrato de superficie y ese escenario lo bloquea, el contexto no
  // puede prometer un cruce que el dato no sostiene: se fuerza el sello a "abierto" con su motivo.
  // Si el par NO está declarado en SURFACE, eso NO es un bloqueo: es un cruce que el contrato de superficie
  // todavía no inventarió (SURFACE cubre un subconjunto). Se registra como `bloqueo.declarado:false` para que el
  // consumidor lo sepa, pero NO se degrada el sello — degradarlo contradiría una vista que sí reconcilia.
  let bloqueo = null;
  if (metrica && eje && ENTITIES[eje] && !e.length) {
    const declarado = Object.prototype.hasOwnProperty.call(SURFACE, `${metrica}@${eje}`);
    const b = surfaceBlock(metrica, eje, escenario);
    if (b) {
      bloqueo = { motivo: b.reason || null, alternativas: Array.isArray(b.offer) ? b.offer.slice() : [], declarado };
      if (declarado) estatus = "abierto";
    }
  }

  if (e.length) return { ok: false, errors: e };

  const vc = {
    version: VIEW_CONTEXT_VERSION,
    tenantId,
    dataSnapshotId: `${tenantId}::${escenario}`,   // MISMO formato que requestContext.js:42 — una sola verdad
    vista, seccion, componentId, tipo,
    metrica: metrica || null,
    eje: eje || null,
    periodo,
    escenario,
    universo,
    seleccion,
    filtros,
    comparacion,
    controles,
    evidenceIds,
    estatus,
    bloqueo,
    key: "",
  };
  vc.key = viewContextKey(vc);
  return { ok: true, vc };
}

// ── KEY · la huella de "qué está mirando" ──────────────────────────────────────────────────────────────────────
// Incluye TODO lo que cambia la pantalla y NADA de lo que sólo cambia el repintado: `evidenceIds` y `universo.n`
// quedan afuera a propósito (volver a pintar la misma vista con el mismo dato no invalida el contexto). Cambiar
// vista, sección, componente, métrica, eje, período, escenario, filtro, comparación, control o TAMAÑO de la
// selección sí cambia la key — y eso es exactamente lo que dispara la invalidación.
export function viewContextKey(vc) {
  if (!_isPlain(vc)) return "";
  const seed = _canon({
    t: vc.tenantId || null, v: vc.vista || null, s: vc.seccion || null, c: vc.componentId || null,
    e: vc.eje || null, m: vc.metrica || null, esc: vc.escenario || null, p: vc.periodo || null,
    f: vc.filtros || {}, cmp: vc.comparacion || null, ctrl: vc.controles || {},
    selM: vc.seleccion ? vc.seleccion.modo : null,
    selN: vc.seleccion ? vc.seleccion.n : null,
    selF: vc.seleccion ? (vc.seleccion.filtro || null) : null,
    selE: vc.seleccion && vc.seleccion.modo === "explicita" ? vc.seleccion.entidades.slice().sort() : null,
    uk: vc.universo ? vc.universo.kind : null,
  });
  return `vc_${fnv1a(seed)}`;
}

// ── SELLADO ────────────────────────────────────────────────────────────────────────────────────────────────────
// sealViewContext(raw) → ViewContext congelado en profundidad, o null si no valida. Se sella en el BORDE de
// transporte (Sentrix → ADI) para que nadie mute el contexto entre la UI y el motor, y vuelve a quedar dentro del
// árbol congelado de buildNarrationContract. `deepFreeze` es idempotente: el doble sellado no cuesta nada.
export function sealViewContext(raw) {
  const r = validateViewContext(raw);
  if (!r.ok) return null;
  return deepFreeze(r.vc);
}
// sealViewContextOrErrors(raw) → la misma operación, pero devolviendo el motivo. Es lo que consume el gate y lo
// que `useViewContext` usa para tirar en dev: un contexto rechazado en silencio es un bug que nadie ve.
export function sealViewContextOrErrors(raw) {
  const r = validateViewContext(raw);
  if (!r.ok) return { ok: false, errors: r.errors };
  return { ok: true, vc: deepFreeze(r.vc) };
}

// ── PROYECCIÓN AL PLAN · UNA LÍNEA, SIN CIFRAS ─────────────────────────────────────────────────────────────────
// Esto —y sólo esto— es lo que ve el LLM. No viajan filas, ni tablas, ni series, ni la salida del builder, ni
// listas de entidades por encima del tope, ni cifras formateadas, ni `evidenceIds`, ni `controles` crudos, ni el
// objeto ViewContext. Si el contexto no existe, devuelve null y el prompt no cambia ni un carácter.
const _METRICA_HUMANA = (k) => (METRICS[k] && METRICS[k].label ? String(METRICS[k].label).toLowerCase() : k);
export function projectViewContextForPlan(vc) {
  if (!_isPlain(vc) || !vc.componentId) return null;
  const m = VIEW_MANIFEST[vc.componentId];
  const label = (m && m.label) || vc.componentId;
  const cabeza = `${VISTA_LABEL[vc.vista] || vc.vista} › ${vc.seccion} › «${label}» (${vc.tipo})`;
  // prioridad: 0 = nunca se cae; números más altos se descartan primero cuando la línea no entra.
  const partes = [{ p: 0, t: cabeza }];
  if (vc.metrica) partes.push({ p: 1, t: `métrica ${_METRICA_HUMANA(vc.metrica)}` });
  if (vc.eje) partes.push({ p: 1, t: `eje ${vc.eje}` });
  // la SELECCIÓN: una entidad viaja por su nombre (es el sujeto de la pantalla, no una cifra); un conjunto viaja
  // como conteo o como filtro. Nunca una lista de nombres — ese es el candado O(1), también en el prompt.
  const sel = vc.seleccion;
  if (sel && sel.modo === "explicita" && sel.n === 1) partes.push({ p: 1, t: `entidad «${sel.entidades[0]}»` });
  else if (sel && sel.modo === "explicita" && sel.n > 1) partes.push({ p: 2, t: `selección de ${sel.n} entidades` });
  else if (sel && sel.modo === "filtro") partes.push({ p: 2, t: `selección por filtro (${Object.keys(sel.filtro || {}).join(", ")})` });
  if (vc.periodo) partes.push({ p: 3, t: `período ${vc.periodo}` });
  partes.push({ p: 3, t: `escenario ${vc.escenario}` });
  const fk = Object.keys(vc.filtros || {});
  if (fk.length) partes.push({ p: 3, t: `filtros: ${fk.map((k) => `${k}=${vc.filtros[k]}`).join(", ")}` });
  // la COMPARACIÓN antes que la prosa del universo: "contra qué se está mirando" cambia qué tools pide PLAN; el
  // universo completo ya viaja al MOTOR por projectViewContextForCoercion, que no tiene tope de caracteres.
  if (vc.comparacion) partes.push({ p: 4, t: `comparación: ${vc.comparacion}` });
  if (vc.universo && vc.universo.label) partes.push({ p: 5, t: `universo: ${vc.universo.label}${typeof vc.universo.n === "number" ? ` (${vc.universo.n})` : ""}` });
  partes.push({ p: 0, t: `sello ${vc.estatus}` });

  const arma = (list) => `Contexto de pantalla: ${list.map((x) => x.t).join(" · ")}.`;
  let vivos = partes.slice();
  let out = arma(vivos);
  while (out.length > VIEW_PLAN_LINE_MAX) {
    let peor = -1, peorP = 0;
    for (let i = 0; i < vivos.length; i++) if (vivos[i].p > peorP) { peorP = vivos[i].p; peor = i; }
    if (peor < 0) break;                       // sólo quedan partes irrenunciables
    vivos.splice(peor, 1);
    out = arma(vivos);
  }
  // último recurso: recorte duro. La línea NUNCA puede pasarse del tope — inflar el prompt no es una opción.
  if (out.length > VIEW_PLAN_LINE_MAX) out = `${out.slice(0, VIEW_PLAN_LINE_MAX - 1)}…`;
  return out;
}

// ── PROYECCIÓN AL MOTOR · lo que consume el backstop determinístico (client-side, gratis) ──────────────────────
// Acá SÍ va todo lo estructural: es el motor el que filtra, compara y ordena. Sigue sin haber una sola cifra.
export function projectViewContextForCoercion(vc) {
  if (!_isPlain(vc) || !vc.componentId) return null;
  const m = VIEW_MANIFEST[vc.componentId] || null;
  const sel = vc.seleccion || { modo: "todas", n: 0, entidades: [], filtro: null };
  // los filtros efectivos = los de la vista + los de la selección-por-filtro. El motor recibe UN solo mapa.
  const filtros = { ...(vc.filtros || {}), ...(sel.modo === "filtro" ? (sel.filtro || {}) : {}) };
  return {
    componentId: vc.componentId,
    vista: vc.vista, seccion: vc.seccion, tipo: vc.tipo,
    eje: vc.eje, metrica: vc.metrica,
    entidades: sel.modo === "explicita" ? sel.entidades.slice() : [],
    filtros,
    periodo: vc.periodo, escenario: vc.escenario,
    universo: vc.universo ? { ...vc.universo } : null,
    comparacion: vc.comparacion,
    estatus: vc.estatus,
    // las calls que demuestran ESTE componente, declaradas en el manifiesto. Si el componente no tiene equivalente
    // en el oráculo, `evidencia` va vacío y `sinTool` dice por qué — el motor no siembra una call inventada.
    // ACOTADAS (ver VIEW_EVIDENCE_ROWS_MAX): una call sembrada por la pantalla no puede pedir el eje entero de un
    // tenant grande. El contexto es O(1) en lo que transporta Y en lo que manda a pedir — si no, lo segundo paga
    // lo que lo primero ahorró, y el prompt crece linealmente con las entidades igual.
    evidencia: (m && Array.isArray(m.evidencia) ? m.evidencia : []).map((x) => ({ tool: x.tool, args: _acotaArgs(x.tool, x.args), focus: x.focus || null })),
    sinTool: (m && m.sinTool) || null,
    // EL ESTADO EXPLÍCITO (owner 2026-08-09, decisión 11). Antes viajaba `divergencia`, que era `null` en 16 de 43
    // componentes SIN que nadie lo hubiera comprobado — y el motor lee ese null como «la cifra de la tool es la de
    // la pantalla». Ahora viaja el estado completo: `reconciled|divergent|unsupported` + razón verificable.
    // VIAJA UNA SOLA VEZ. Las dos formas derivadas (`divergenciaDe` para "¿hay desacuerdo NUMÉRICO declarado?" y
    // `limiteDeclarado` para "¿qué le digo al usuario?") se calculan en el consumidor desde este mismo objeto: la
    // proyección tiene un presupuesto de bytes que `_concordancia_semantica_gate` verifica, y meter la misma razón
    // tres veces lo triplicaba por comodidad.
    concordancia: (m && concordanciaDe(m)) || null,
  };
}

// ── INVALIDACIÓN · mecánica, no doctrinal ──────────────────────────────────────────────────────────────────────
// El contexto anterior NO puede contaminar la respuesta cuando el usuario cambia de vista, filtro, entidad o tema.
// Cuatro reglas, en orden, todas verificables:
//   1. TENANT distinto → null. Nunca se reusa parcialmente el contexto de otra empresa (mismo criterio que
//      validateScopeTenant/assertTenantContext: ante la duda, se descarta ENTERO).
//   2. plan.scope.level === "global" → null. Es el MISMO y único disparador de "cambió el tema" que ya usa
//      updateConversationScope — no se inventa un segundo clasificador difuso.
//   2b. UNA CORRECCIÓN QUE INVALIDA LA ENTIDAD → null (Contrato v1.2 §1/§6, owner 2026-08-10). Tampoco es un
//      clasificador nuevo: es la MISMA matriz de compatibilidad del contrato conversacional, leída desde acá. El
//      hueco era real y silencioso — con la Ficha de Falabella abierta y un "no, era Lider", el alcance se
//      corregía en todos lados menos en la pantalla: la línea de contexto seguía diciendo «entidad Falabella» en
//      los DOS prompts, `resolveAnswerShape` podía seguir explicando el componente viejo, y `viewContextEntry` le
//      re-estampaba un turno fresco, así que el contexto invalidado se renovaba solo y podía no morir nunca.
//      §6 pide que "Sentrix reciba el mismo alcance corregido"; sin esto recibía el anterior.
//   3. hay contexto fresco → manda el fresco. Si su key difiere del anterior, el anterior se DESCARTA ENTERO
//      (jamás un merge: un merge de dos pantallas produce una tercera que nadie miró).
//   4. no hay contexto fresco (el usuario tipeó con el panel cerrado) → el anterior sobrevive como máximo
//      VIEW_CONTEXT_TTL_TURNOS turnos (= VIEW_CONTEXT_TTL_ENTRADAS entradas de history, que es la unidad en que
//      llega `turno`), y sólo para referencias de COMPONENTE; para referencias de ENTIDAD manda
//      conversationScope, que ya tiene su propia política.
// _correccionInvalidaEntidad(plan) → ¿esta corrección dejó sin efecto la entidad del turno anterior? Se resuelve
// con la MISMA matriz del contrato conversacional (normalizeReparacion + camposQueSeInvalidan), no con un
// criterio propio: la pantalla no puede tener su propia idea de qué sobrevive a una corrección.
function _correccionInvalidaEntidad(plan) {
  const r = normalizeReparacion(plan);
  if (!r || r.tipo !== "correccion" || r.ambigua) return false;
  return camposQueSeInvalidan(r.corrige).includes("entities");
}

export function invalidateViewContext(prevEntry, freshVc, { plan = null, requestContext = null, turno = null } = {}) {
  const tenantActivo = requestContext && requestContext.tenantId ? requestContext.tenantId : null;
  const fresh = _isPlain(freshVc) ? freshVc : null;
  if (fresh && tenantActivo && fresh.tenantId !== tenantActivo) return null;
  if (plan && plan.scope && plan.scope.level === "global") return null;
  if (_correccionInvalidaEntidad(plan)) return null;
  if (fresh) return fresh;
  if (!_isPlain(prevEntry) || !_isPlain(prevEntry.vc)) return null;
  const prev = prevEntry.vc;
  if (tenantActivo && prev.tenantId !== tenantActivo) return null;
  // el delta se mide en ENTRADAS de history (ver VIEW_CONTEXT_ENTRADAS_POR_TURNO), que es la unidad real de `turno`.
  if (typeof turno === "number" && typeof prevEntry.turno === "number" && (turno - prevEntry.turno) > VIEW_CONTEXT_TTL_ENTRADAS) return null;
  return prev;
}

// viewContextEntry(vc, turno) → la entrada que se guarda en `mem.viewContext`. Una key HERMANA de
// `mem.conversationScope`, escrita en el mismo punto del turno — nunca una memoria paralela con su propio ciclo.
export function viewContextEntry(vc, turno = 0) {
  if (!_isPlain(vc)) return null;
  return { key: vc.key || viewContextKey(vc), vc, turno: typeof turno === "number" ? turno : 0 };
}

// viewContextChanged(a, b) → ¿cambió la pantalla? Es la pregunta que hace la invalidación y la que hace el gate.
export function viewContextChanged(a, b) {
  const ka = _isPlain(a) ? (a.key || viewContextKey(a)) : null;
  const kb = _isPlain(b) ? (b.key || viewContextKey(b)) : null;
  return ka !== kb;
}
