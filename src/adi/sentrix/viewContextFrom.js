/* === src/adi/sentrix/viewContextFrom.js · LA DERIVACIÓN (mejora B del owner) ==================================
 * "Sentrix NO escribe el contexto a mano: se DERIVA de la salida del builder que ya alimenta al componente."
 *
 * POR QUÉ IMPORTA. Un contexto escrito a mano en la UI es una TERCERA verdad: se desincroniza del builder el día
 * que alguien cambia un universo, un período o una vara, y nadie se entera hasta que ADI contesta con el universo
 * equivocado. Acá el contexto se arma cruzando DOS fuentes y ninguna más:
 *   · `VIEW_MANIFEST[componentId]` — la DECLARACIÓN (qué mide, contra qué se compara, qué tools lo demuestran);
 *   · `builderOut` — la ESTRUCTURA VIVA que el componente está pintando en este mismo render.
 * Lo que sólo el DATO sabe (el tamaño del universo, el período que declaró el composer, el sello que el propio
 * módulo se puso, las etiquetas de evidencia) lo pone el builder y GANA sobre el manifiesto. Lo que sólo la
 * DECLARACIÓN sabe (métrica, eje, comparación, qué tools lo demuestran) lo pone el manifiesto.
 *
 * NUNCA SE LEE EL DOM NI TEXTO VISIBLE. Ni un `innerText`, ni un `querySelector`, ni una etiqueta parseada de la
 * pantalla. Si el `campo` declarado no resuelve contra la salida del builder, se devuelve `null`: sin contexto es
 * honesto, un contexto adivinado no.
 *
 * PURO · SIN DOM · SIN REACT · gate-testable con el builder real.
 */
import { VIEW_MANIFEST } from "./viewManifest.js";
import { sealViewContext, sealViewContextOrErrors, VIEW_SELECTION_MAX, VIEW_EVIDENCE_IDS_MAX, ESTATUS } from "../oracle/viewContext.js";

// ── RESOLUCIÓN DE PATH ─────────────────────────────────────────────────────────────────────────────────────────
// Soporta las TRES formas que el inventario usa y ninguna más: `a.b.c`, índice `a[0]`, selector `a[key='x']`.
// Deliberadamente mínimo — no es un motor de queries, es el puente entre una declaración y un objeto.
function _tokens(path) {
  const out = [];
  let i = 0;
  while (i < path.length) {
    const ch = path[i];
    if (ch === ".") { i++; continue; }
    if (ch === "[") {
      const end = path.indexOf("]", i);
      if (end < 0) return null;
      const inner = path.slice(i + 1, end);
      const sel = /^([A-Za-z_$][\w$]*)\s*=\s*'(.*)'$/.exec(inner);
      if (sel) out.push({ sel: sel[1], val: sel[2] });
      else if (/^\d+$/.test(inner)) out.push({ idx: Number(inner) });
      else return null;
      i = end + 1;
      continue;
    }
    let j = i;
    while (j < path.length && path[j] !== "." && path[j] !== "[") j++;
    out.push({ key: path.slice(i, j) });
    i = j;
  }
  return out;
}
export function resolvePath(obj, path) {
  if (obj == null || typeof path !== "string" || !path.trim()) return undefined;
  const toks = _tokens(path.trim());
  if (!toks) return undefined;
  let cur = obj;
  for (const t of toks) {
    if (cur == null) return undefined;
    if (t.key != null) cur = cur[t.key];
    else if (t.idx != null) cur = Array.isArray(cur) ? cur[t.idx] : undefined;
    else if (t.sel != null) cur = Array.isArray(cur) ? cur.find((x) => x && String(x[t.sel]) === t.val) : undefined;
  }
  return cur;
}

// ── ETIQUETAS DE EVIDENCIA ─────────────────────────────────────────────────────────────────────────────────────
// Las primeras N etiquetas YA FORMATEADAS del campo — sirven para que Sentrix reabra exactamente lo mismo y para
// que un consumidor deduplique. NO viajan al prompt (ver projectViewContextForPlan). Cero cifras: sólo nombres.
const _LABEL_KEYS = ["etiqueta", "label", "nombre", "entidad", "name", "sku", "key"];
function _labelOf(x) {
  if (typeof x === "string") return x.trim() || null;
  if (!x || typeof x !== "object") return null;
  for (const k of _LABEL_KEYS) if (typeof x[k] === "string" && x[k].trim()) return x[k].trim();
  return null;
}
function _labelsFrom(node, max = VIEW_EVIDENCE_IDS_MAX) {
  if (node == null) return [];
  if (Array.isArray(node)) return node.map(_labelOf).filter(Boolean).slice(0, max);
  if (typeof node === "object") {
    for (const k of ["filas", "rows", "barras", "series", "tramos", "vistas", "lista", "items", "grupos"]) {
      if (Array.isArray(node[k])) return _labelsFrom(node[k], max);
    }
    const own = _labelOf(node);
    return own ? [own] : [];
  }
  return [];
}

// ── TAMAÑO DEL UNIVERSO ────────────────────────────────────────────────────────────────────────────────────────
// Sólo el dato lo sabe: es el largo de la lista que el componente está pintando, jamás un número del manifiesto.
function _sizeOf(node) {
  // un `universoCampo` puede apuntar DIRECTO al conteo que el builder ya declaró (`entidadesReales` del Pareto):
  // ahí el tamaño del universo es esa cifra, no el largo de lo que se dibuja.
  if (typeof node === "number" && isFinite(node)) return node;
  if (Array.isArray(node)) return node.length;
  if (node && typeof node === "object") {
    for (const k of ["filas", "rows", "barras", "series", "tramos", "vistas", "lista", "items", "grupos", "meses"]) {
      if (Array.isArray(node[k])) return node[k].length;
    }
    if (typeof node.n === "number" && isFinite(node.n)) return node.n;
  }
  return null;
}

// ── SELLO ──────────────────────────────────────────────────────────────────────────────────────────────────────
// Si el builder declara su PROPIO sello, gana el del dato (el módulo sabe más que el manifiesto sobre su cifra).
// Un booleano de reconciliación sólo puede DEGRADAR: `false` (la tabla no cierra con la venta oficial) nunca puede
// venderse como "probado"; `true` no alcanza para subir el sello por su cuenta.
function _estatusFrom(node, estatusDefault) {
  if (typeof node === "string" && ESTATUS.includes(node)) return node;
  if (node === false) return "indicado";
  if (node === true) return estatusDefault;
  if (node && typeof node === "object" && typeof node.estatus === "string" && ESTATUS.includes(node.estatus)) return node.estatus;
  return estatusDefault;
}

// ── LA DERIVACIÓN ──────────────────────────────────────────────────────────────────────────────────────────────
// deriveViewContext(componentId, builderOut, opts) → ViewContext SELLADO, o null.
//   opts.scenario         el escenario que el panel usó DE VERDAD (nunca uno supuesto)
//   opts.requestContext   de donde sale el tenantId, copiado AL CREARSE y jamás recalculado después
//   opts.controles        el estado local del componente (se filtra a lo que el manifiesto declara)
//   opts.seleccion        { modo, entidades[], filtro, n } — lo que el usuario tiene efectivamente seleccionado
export function deriveViewContext(componentId, builderOut, { scenario = null, requestContext = null, controles = {}, seleccion = null, tenantId = null } = {}) {
  const r = deriveViewContextOrErrors(componentId, builderOut, { scenario, requestContext, controles, seleccion, tenantId });
  return r.ok ? r.vc : null;
}

// misma derivación, con el MOTIVO del rechazo. Es lo que consume el gate y lo que `useViewContext` usa para tirar
// en dev: un contexto que se cae en silencio es un componente que quedó mudo sin que nadie se entere.
export function deriveViewContextOrErrors(componentId, builderOut, { scenario = null, requestContext = null, controles = {}, seleccion = null, tenantId = null } = {}) {
  const m = VIEW_MANIFEST[componentId];
  if (!m) return { ok: false, errors: [`componentId no declarado en viewManifest.js: "${componentId}"`] };
  if (builderOut == null || typeof builderOut !== "object") return { ok: false, errors: [`el builder de "${m.vista}" no devolvió una salida utilizable`] };

  // 1 · el campo declarado tiene que RESOLVER contra la salida viva. Si no resuelve, no hay contexto.
  const node = resolvePath(builderOut, m.campo);
  if (node === undefined || node === null) {
    if (m.campoOpcional) return { ok: false, errors: [`campo opcional "${m.campo}" ausente en esta construcción (limitación declarada, no un error)`], opcional: true };
    return { ok: false, errors: [`el campo "${m.campo}" no resuelve contra la salida de ${m.vista}`] };
  }

  // 2 · lo que SÓLO EL DATO sabe
  const universoNode = m.universoCampo ? resolvePath(builderOut, m.universoCampo) : node;
  const n = _sizeOf(universoNode);
  const periodoDato = m.periodoCampo ? resolvePath(builderOut, m.periodoCampo) : null;
  const periodo = (typeof periodoDato === "string" && periodoDato.trim()) ? periodoDato.trim() : (m.periodo || null);
  const estatus = _estatusFrom(m.estatusCampo ? resolvePath(builderOut, m.estatusCampo) : undefined, m.estatusDefault || "indicado");
  const evidenceIds = _labelsFrom(node);

  // 3 · la SELECCIÓN, con el candado O(1) aplicado ANTES de validar (la validación es la red, no el camino).
  const selIn = (seleccion && typeof seleccion === "object") ? seleccion : null;
  let sel = { modo: "todas", n: typeof n === "number" ? n : 0, entidades: [], filtro: null };
  if (selIn && selIn.modo === "filtro" && selIn.filtro && Object.keys(selIn.filtro).length) {
    sel = { modo: "filtro", n: typeof selIn.n === "number" ? selIn.n : 0, entidades: [], filtro: { ...selIn.filtro } };
  } else if (selIn && Array.isArray(selIn.entidades) && selIn.entidades.length) {
    const ents = selIn.entidades.filter((x) => typeof x === "string" && x.trim());
    if (ents.length > VIEW_SELECTION_MAX) {
      // 300 clientes NO viajan como 300 nombres. Si el llamador declaró un filtro equivalente, se usa; si no, el
      // contexto declara honestamente "todas las filas visibles (n)" — que es lo que la pantalla realmente muestra.
      sel = (selIn.filtro && Object.keys(selIn.filtro).length)
        ? { modo: "filtro", n: ents.length, entidades: [], filtro: { ...selIn.filtro } }
        : { modo: "todas", n: ents.length, entidades: [], filtro: null };
    } else {
      sel = { modo: "explicita", n: ents.length, entidades: ents, filtro: null };
    }
  } else if (m.entidadCampo) {
    // componentes de UNA entidad (la Ficha): el sujeto sale del propio builder, no de la UI.
    const ent = resolvePath(builderOut, m.entidadCampo);
    if (typeof ent === "string" && ent.trim()) sel = { modo: "explicita", n: 1, entidades: [ent.trim()], filtro: null };
  }

  // 4 · los CONTROLES, acotados a lo declarado (la validación vuelve a filtrarlos: dos candados, no uno)
  const ctrlDecl = Array.isArray(m.controles) ? m.controles : [];
  const ctrl = {};
  for (const k of ctrlDecl) if (controles && controles[k] != null && controles[k] !== "") ctrl[k] = controles[k];

  const tid = tenantId || (requestContext && requestContext.tenantId) || null;
  const esc = scenario || (requestContext && typeof requestContext.dataSnapshotId === "string" ? requestContext.dataSnapshotId.split("::")[1] : null) || null;

  // 5 · validar + sellar. Todo lo demás sale del manifiesto, que es la declaración.
  return sealViewContextOrErrors({
    tenantId: tid,
    vista: m.vista, seccion: m.seccion, componentId, tipo: m.tipo,
    metrica: m.metrica || null,
    eje: m.eje || null,
    periodo,
    escenario: esc,
    universo: { kind: (m.universo && m.universo.kind) || "negocio", n, label: (m.universo && m.universo.label) || null, cierraCon: (m.universo && m.universo.cierraCon) || null },
    seleccion: sel,
    filtros: (seleccion && seleccion.filtros) || {},
    comparacion: m.comparacion || null,
    controles: ctrl,
    evidenceIds,
    estatus,
  });
}

// deriveVistaContext(vista, builderOut, opts) → el contexto de LA VISTA ENTERA (el componente `<vista>/otro/vista`).
// Es el que viaja cuando el usuario escribe desde Sentrix SIN haber pulsado ningún CTA (requisito 2 del owner):
// no identifica un componente puntual, pero sí la vista, el escenario, el eje y el universo que tiene delante.
export function deriveVistaContext(vista, builderOut, opts = {}) {
  return deriveViewContext(`${vista}/otro/vista`, builderOut, opts);
}

// _seal re-exportado por comodidad de los consumidores de este módulo (una sola importación en la UI).
export { sealViewContext };
