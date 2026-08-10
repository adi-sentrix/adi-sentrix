/* === src/adi/sentrix/address.js · LA DIRECCIÓN CANÓNICA ÚNICA · ADI ↔ SENTRIX =================================
 * (owner 2026-08-09 · frente EMISIÓN del Contrato de Concordancia)
 *
 * EL PROBLEMA QUE CIERRA. Hoy hay TRES resolvedores sueltos para "qué abre esta respuesta en Sentrix"
 * (`pnlMesaLink` en mesaResultado.js, `clientMesaLink` y el `_tLink` inline en SentrixPanel.jsx) más un if-chain
 * de veinte ramas, y ninguno habla el mismo idioma que la señal que Sentrix manda hacia ADI. Este módulo no agrega
 * una CUARTA dirección: colapsa las dos puntas en UNA.
 *
 *     sentrix://<vista>/<seccion>/<slug>?<query>
 *
 *     vista    comercial | capital | resultado | ficha
 *     seccion  01 | 02 | 03 | otro
 *     slug     el último tramo del componentId
 *     query    eje= · metrica= · entidad= · filtro.<eje>= · escenario= · periodo= · comp= · ctrl.<nombre>= · sel=
 *
 * TRES REGLAS DURAS:
 *   1. `componentId === `${vista}/${seccion}/${slug}`` — la dirección ES el componentId más su estado. No hay dos
 *      identificadores para una misma pieza.
 *   2. NUNCA lleva más de UNA `entidad`. Un conjunto viaja como `filtro.<eje>=<valor>` o no viaja. Es el mismo
 *      candado O(1) del ViewContext, escrito en la gramática: una dirección no puede crecer con el negocio.
 *   3. NUNCA lleva cifras. Es un PUNTERO, no un payload. Lo que se afirma sale de las tools; esto solo dice dónde
 *      se demuestra.
 *
 * DEPENDENCIA ÚNICA: `viewManifest.js` (dato puro). Deliberadamente NO importa mesaResultado.js ni el panel — la
 * dirección tiene que poder resolverse desde el motor sin arrastrar la UI ni el pipeline del P&L.
 * PURO · SIN REACT · SIN I/O · SIN LLM · gate-testable.
 */
import { VIEW_MANIFEST, VISTA_LABEL, VISTAS, SECCIONES, componentIdForTool, vistaComponentId, componentIdsForVista } from "./viewManifest.js";

export const ADDRESS_SCHEME = "sentrix://";
// El vocabulario de vista/sección se LEE del manifiesto, no se vuelve a escribir acá (owner 2026-08-09, revisión
// del frente NÚCLEO): dos listas de las mismas cuatro vistas es un contrato paralelo esperando a desincronizarse —
// el día que se declare una quinta cara, la dirección la rechazaría en silencio.
const _VISTAS = new Set(VISTAS);
const _SECCIONES = new Set(SECCIONES);
const _SLUG_RE = /^[a-z0-9][a-z0-9-]*$/;

const _isObj = (o) => !!o && typeof o === "object" && !Array.isArray(o);
const _str = (v) => (typeof v === "string" ? v.trim() : "");

/* ── addr · la forma en memoria de una dirección ───────────────────────────────────────────────────────────────
 * { vista, seccion, slug, componentId, eje, metrica, entidad, filtros{}, escenario, periodo, comp, controles{}, sel }
 * `entidad` es UNA o null (regla 2). `filtros` y `controles` son mapas de escalares. */
export function makeAddress({
  vista, seccion = "otro", slug, eje = null, metrica = null, entidad = null,
  filtros = null, escenario = null, periodo = null, comp = null, controles = null, sel = null,
} = {}) {
  const v = _str(vista).toLowerCase(), s = _str(seccion), g = _str(slug);
  if (!_VISTAS.has(v) || !_SECCIONES.has(s) || !_SLUG_RE.test(g)) return null;
  return {
    vista: v, seccion: s, slug: g, componentId: `${v}/${s}/${g}`,
    eje: _str(eje) || null,
    metrica: _str(metrica) || null,
    entidad: _str(entidad) || null,             // UNA, jamás una lista
    filtros: _escalares(filtros),
    escenario: _str(escenario) || null,
    periodo: _str(periodo) || null,
    comp: _str(comp) || null,
    controles: _escalares(controles),
    sel: _str(sel) || null,                     // la FORMA de la selección ("todas"|"explicita"|"filtro"), nunca la lista
  };
}
/* ── EL EJE REAL DE LA ENTIDAD DEL TURNO ───────────────────────────────────────────────────────────────────────
 * Corrección 2026-08-09 (revisión de arquitectura del frente). `_profileRequest` NO implica "cliente": el reading
 * de perfil se construye para eje cliente Y para eje sku (sentrixEvidence.js:_entityReading), así que un perfil de
 * SKU también deja esa marca. El resolvedor viejo lo sabía y era deliberadamente angosto —`clientMesaLink`
 * (SentrixPanel.jsx) descarta todo lo que no sea entityType cliente/client—; escribir el eje como literal acá
 * rompía esa disciplina y mandaba un SKU a la Ficha de CLIENTE, que la arma con buildClientContribSignals.
 * Dos convenciones conviven en el código para el mismo eje ("cliente" en el oráculo, "client" en la boleta legacy
 * — ver la nota de sentrixEvidence.js:201): se normalizan acá, en un solo lugar. */
function _ejeReal(evidence, scope) {
  const raw = _str(evidence.entityType)
    || (scope ? _str(scope.entityType) : "")
    || (scope ? _str(scope.dimension) : "");
  if (!raw || raw === "cartera") return null;
  return raw === "client" ? "cliente" : raw;
}
// El componente de Ficha que corresponde a ESE eje, leído del manifiesto — nunca un slug escrito a mano. Hoy sólo
// está declarada la Ficha de cliente: un perfil de SKU no encuentra componente y NO se fabrica dirección (misma
// abstención que el resolvedor viejo). El día que se declare una Ficha de SKU, rutea sola, sin tocar este archivo.
function _fichaComponentId(eje) {
  if (!eje) return null;
  for (const id of componentIdsForVista("ficha")) {
    const m = VIEW_MANIFEST[id];
    if (m && m.tipo !== "vista" && m.eje === eje) return id;
  }
  return null;
}
function _escalares(o) {
  const out = {};
  if (!_isObj(o)) return out;
  for (const [k, v] of Object.entries(o)) {
    if (v == null || v === "") continue;
    if (typeof v === "object") continue;        // una dirección no anida: si no es escalar, no viaja
    out[String(k)] = typeof v === "boolean" ? (v ? "1" : "0") : String(v);
  }
  return out;
}

// ── formatAddress(addr) → string ───────────────────────────────────────────────────────────────────────────────
export function formatAddress(addr) {
  if (!_isObj(addr) || !addr.vista || !addr.slug) return null;
  const q = [];
  const push = (k, v) => { if (v != null && v !== "") q.push(`${k}=${encodeURIComponent(String(v))}`); };
  push("eje", addr.eje);
  push("metrica", addr.metrica);
  push("entidad", addr.entidad);
  for (const [k, v] of Object.entries(addr.filtros || {})) push(`filtro.${k}`, v);
  push("escenario", addr.escenario);
  push("periodo", addr.periodo);
  push("comp", addr.comp);
  for (const [k, v] of Object.entries(addr.controles || {})) push(`ctrl.${k}`, v);
  push("sel", addr.sel);
  return `${ADDRESS_SCHEME}${addr.vista}/${addr.seccion}/${addr.slug}${q.length ? `?${q.join("&")}` : ""}`;
}

// ── parseAddress(str) → addr | null ────────────────────────────────────────────────────────────────────────────
// Tolera basura devolviendo null: nunca a medias. Una dirección con más de una `entidad` conserva la PRIMERA
// (la regla 2 se aplica al leer, no solo al escribir — un emisor futuro no puede saltársela).
export function parseAddress(str) {
  const s = _str(str);
  if (!s || !s.startsWith(ADDRESS_SCHEME)) return null;
  const resto = s.slice(ADDRESS_SCHEME.length);
  const iQ = resto.indexOf("?");
  const ruta = iQ < 0 ? resto : resto.slice(0, iQ);
  const query = iQ < 0 ? "" : resto.slice(iQ + 1);
  const tramos = ruta.split("/");
  if (tramos.length !== 3) return null;
  const base = { vista: tramos[0], seccion: tramos[1], slug: tramos[2], filtros: {}, controles: {} };
  for (const par of query.split("&")) {
    if (!par) continue;
    const i = par.indexOf("=");
    if (i < 0) continue;
    const k = decodeURIComponent(par.slice(0, i));
    const v = decodeURIComponent(par.slice(i + 1));
    if (!v) continue;
    if (k.startsWith("filtro.")) { base.filtros[k.slice(7)] = v; continue; }
    if (k.startsWith("ctrl.")) { base.controles[k.slice(5)] = v; continue; }
    if (k === "entidad" && base.entidad) continue;   // regla 2 al leer: la primera gana
    if (["eje", "metrica", "entidad", "escenario", "periodo", "comp", "sel"].includes(k)) base[k] = v;
  }
  return makeAddress(base);
}

// ── addressFromViewContext(vc) → addr · SENTRIX → dirección ────────────────────────────────────────────────────
// La punta emisora: lo que el usuario está mirando, convertido en puntero. La selección viaja por su FORMA y (solo
// si es UNA) por su entidad; una selección de 300 se representa por su filtro, nunca por sus nombres.
export function addressFromViewContext(vc) {
  if (!_isObj(vc) || !vc.componentId) return null;
  const tramos = String(vc.componentId).split("/");
  if (tramos.length !== 3) return null;
  const sel = _isObj(vc.seleccion) ? vc.seleccion : null;
  const unaEntidad = sel && sel.modo === "explicita" && sel.entidades && sel.entidades.length === 1 ? sel.entidades[0] : null;
  return makeAddress({
    vista: tramos[0], seccion: tramos[1], slug: tramos[2],
    eje: vc.eje, metrica: vc.metrica, entidad: unaEntidad,
    filtros: { ...(vc.filtros || {}), ...(sel && sel.modo === "filtro" ? sel.filtro : null) },
    escenario: vc.escenario, comp: vc.comparacion,
    controles: vc.controles,
    sel: sel ? sel.modo : null,
  });
}

/* ── addressFromEvidence(evidence, opts) → addr | null · ADI → dirección ───────────────────────────────────────
 * La punta receptora: el turno que ADI acaba de responder, convertido en el componente que lo DEMUESTRA. Reglas
 * determinísticas sobre `evidenceSpec` / `plan.calls` — nunca sobre la prosa de la respuesta.
 *
 * La tabla tool→componente NO está hardcodeada acá: sale de `componentIdForTool`, que viewManifest.js construye
 * de su propio campo `evidencia`. Una tool nueva sin componente cae al default de la vista (honesto) y el gate lo
 * reporta como cobertura faltante, sin romper.
 *
 * `evidence` puede ser la evidencia completa del oráculo (preferido: trae plan.calls, _profileRequest, pnl, lens)
 * o directamente un evidenceSpec. `opts.plan` permite pasar el plan CRUDO, que es el único que conserva el `focus`
 * de cada call — con él la resolución es más fina (diagnose@carga ≠ diagnose@margen). */
export function addressFromEvidence(evidence, opts = {}) {
  if (!_isObj(evidence)) return null;
  const spec = _isObj(evidence.evidenceSpec) ? evidence.evidenceSpec : (evidence.version && evidence.scope ? evidence : null);
  const scope = (spec && _isObj(spec.scope)) ? spec.scope : (_isObj(evidence.scope) ? evidence.scope : null);
  const escenario = _str(evidence.periodo) || _str(opts.scenario) || null;

  // 1 · PERFIL ÚNICO — la Ficha, con su entidad. Es la marca que los DOS pipelines dejan (`_profileRequest`).
  // El eje y el componente salen del DATO y del MANIFIESTO (ver _ejeReal/_fichaComponentId), nunca de un literal:
  // un perfil cuyo eje no tiene Ficha declarada NO produce dirección de Ficha y cae a las ramas de abajo.
  const entidadPerfil = _str(evidence.entidad) || (scope ? _str(scope.entityLabel) : "");
  const ejeReal = _ejeReal(evidence, scope);
  const fichaId = _fichaComponentId(ejeReal);
  if (evidence._profileRequest && entidadPerfil && !entidadPerfil.includes(",") && fichaId) {
    const tf = fichaId.split("/");
    return makeAddress({ vista: tf[0], seccion: tf[1], slug: tf[2], eje: ejeReal, entidad: entidadPerfil, escenario });
  }

  // 2 · P&L — la cara Resultado con SU alcance (el eje al selector del cuadro, la entidad a la cascada).
  if (evidence.pnl) {
    const eje = _str(evidence.dimension) || null;
    const ent = _str(evidence.entidad) || null;
    return makeAddress({ vista: "resultado", seccion: "01", slug: "cuadro", eje, entidad: ent && !ent.includes(",") ? ent : null, escenario });
  }

  // 3 · las TOOLS del turno, en orden, contra el índice inverso del manifiesto.
  const callsPlan = _isObj(opts.plan) && Array.isArray(opts.plan.calls) ? opts.plan.calls : null;
  // `args` viaja junto al `focus` (corrección 2026-08-09, revisión del frente): `componentIdForTool` declara TRES
  // niveles de precisión —focus · metric/dimension · tool sola— y este era el ÚNICO llamador de producción, así que
  // omitir los args dejaba el nivel 2 inalcanzable. Consecuencia REAL medida: `queryMetric` y `gridTable` declaran
  // componentes en DOS vistas cada una, y sin args el índice se abstiene (devuelve null) — es decir, las dos tools
  // más frecuentes del oráculo no producían dirección y la respuesta salía SIN el botón que este frente existe para
  // dar. Con args, `queryMetric{ventas,cliente}` → comercial/01/kpi-ventas y `gridTable{cliente}` →
  // comercial/01/tabla-cartera. El orden de precedencia no cambia: el focus se sigue evaluando primero.
  const pares = callsPlan
    ? callsPlan.map((c) => ({
      tool: c && c.tool,
      focus: (c && c.args && (c.args.focus || c.args.foco)) || null,
      args: (c && _isObj(c.args)) ? c.args : null,
    }))
    : (_isObj(evidence.plan) && Array.isArray(evidence.plan.calls) ? evidence.plan.calls.map((t) => ({ tool: t, focus: null, args: null })) : []);
  for (const p of pares) {
    if (!p.tool) continue;
    const componentId = componentIdForTool(p.tool, p.focus, p.args);
    if (!componentId) continue;
    const m = VIEW_MANIFEST[componentId];
    const tramos = componentId.split("/");
    // La Ficha es la única cara cuyo CONTENIDO ENTERO es una entidad de un eje declarado: abrirla para una entidad
    // de otro eje no es un foco perdido, es la página equivocada (la arma buildClientContribSignals). Si el eje no
    // coincide se SALTA este componente y se sigue buscando — mismo criterio de abstención que la rama 1 y que el
    // resolvedor viejo. En las demás caras la entidad es una pista de foco que el panel ignora si no aplica.
    if (tramos[0] === "ficha" && m && m.eje && ejeReal && m.eje !== ejeReal) continue;
    const ent = scope && _str(scope.entityLabel) && !_str(scope.entityLabel).includes(",") ? _str(scope.entityLabel) : null;
    return makeAddress({
      vista: tramos[0], seccion: tramos[1], slug: tramos[2],
      eje: (scope && _str(scope.dimension)) || (m && m.eje) || null,
      metrica: (m && m.metrica) || null,
      entidad: ent, escenario, comp: (m && m.comparacion) || null,
    });
  }

  // 4 · el mes a mes ampliado abre la película del año, que vive en la cara comercial.
  if (_str(evidence.lens) === "temporal")
    return makeAddress({ vista: "comercial", seccion: "01", slug: "evolutivo-serie", eje: "tiempo", metrica: "ventas", escenario });

  // 5 · la Mesa, sin pieza puntual — la VISTA, honesta.
  if (_str(evidence.lens) === "mesa") return addressForVista("comercial", escenario);
  return null;
}

// La dirección de una VISTA entera (el catch-all honesto y el contexto ambiente de la pantalla).
export function addressForVista(vista, escenario = null) {
  const id = vistaComponentId(vista);
  if (!id) return null;
  const t = id.split("/");
  return makeAddress({ vista: t[0], seccion: t[1], slug: t[2], escenario });
}

/* ── legacyAddressFrom(evidence) → addr | null ─────────────────────────────────────────────────────────────────
 * Los TRES resolvedores viejos, unificados y byte-compatibles: `pnlMesaLink` (evidence.pnl → cara Resultado con
 * eje y foco), `clientMesaLink` (_profileRequest + entityType cliente/client → cara Ficha) y el `_tLink` inline
 * (lens temporal → cara comercial). NO se borran los originales: este es el mismo comportamiento expresado en la
 * gramática nueva, para que el camino viejo siga funcionando exactamente igual cuando no hay `evidence.address`. */
export function legacyAddressFrom(evidence) {
  if (!_isObj(evidence)) return null;
  const escenario = _str(evidence.periodo) || null;
  if (evidence.pnl) {
    const eje = _str(evidence.dimension) || null;
    return makeAddress({ vista: "resultado", seccion: "01", slug: "cuadro", eje, entidad: _str(evidence.entidad) || null, escenario });
  }
  if (evidence._profileRequest && _str(evidence.entidad)
      && (evidence.entityType === "client" || evidence.entityType === "cliente"))
    return makeAddress({ vista: "ficha", seccion: "otro", slug: "ficha-cliente", eje: "cliente", entidad: _str(evidence.entidad), escenario });
  if (_str(evidence.lens) === "temporal")
    return makeAddress({ vista: "comercial", seccion: "01", slug: "evolutivo-serie", eje: "tiempo", metrica: "ventas", escenario });
  return null;
}

/* ── resolveAddress(addr) → lo que la Mesa aplica ──────────────────────────────────────────────────────────────
 * El reemplazo ÚNICO de `pnlMesaLink` + `clientMesaLink` + `_tLink` + el if-chain del panel. Devuelve el estado
 * que MesaPanel tiene que aplicar: la cara, la sección, el componente, el eje, el foco y los CONTROLES. Los
 * controles son lo que hace que "Ver evidencia" abra la vista, la sección, la entidad Y el filtro exactos — no
 * solo la cara. */
export function resolveAddress(addr) {
  if (!_isObj(addr) || !addr.vista) return null;
  const m = VIEW_MANIFEST[addr.componentId] || null;
  return {
    cara: addr.vista,
    seccion: addr.seccion,
    componentId: addr.componentId,
    conocido: !!m,
    eje: addr.eje || (m && m.eje) || null,
    entidad: addr.entidad || null,
    // el foco de la cascada del P&L conserva el shape que la cara Resultado ya consume: { eje, nombre }
    foco: addr.vista === "resultado" && addr.entidad ? { eje: addr.eje || null, nombre: addr.entidad } : null,
    filtros: { ...(addr.filtros || {}) },
    controles: { ...(addr.controles || {}) },
    escenario: addr.escenario || null,
    metrica: addr.metrica || (m && m.metrica) || null,
  };
}

/* ── evidenceForAddress(addr, scenario) → evidence ─────────────────────────────────────────────────────────────
 * Lo que App.jsx le pasa a SentrixPanel para abrir esa dirección. `lens:"mesa"` es la puerta que el dispatcher del
 * panel ya conoce; `address` es lo nuevo que MesaPanel resuelve. Sin dirección resoluble no se fabrica evidencia:
 * el llamador abre la Mesa como siempre. */
export function evidenceForAddress(addr, scenario = null) {
  const a = _isObj(addr) ? addr : parseAddress(addr);
  if (!a) return null;
  return { lens: "mesa", periodo: a.escenario || scenario || null, address: formatAddress(a) };
}

/* ── buildSentrixActionFromAddress(addr, {label, moduleChip}) → sentrixAction | null ────────────────────────────
 * El CTA de la respuesta. Devuelve null cuando no hay dirección resoluble: no se pinta un botón que no lleva a
 * ningún lado. `normalizeSentrixAction` (responseContract.js) valida la forma río abajo; el payload viaja con la
 * dirección adentro, y App.jsx la abre tal cual. */
export function buildSentrixActionFromAddress(addr, { label = null, moduleChip = null } = {}) {
  const a = _isObj(addr) ? addr : parseAddress(addr);
  if (!a) return null;
  const s = formatAddress(a);
  if (!s) return null;
  return {
    label: _str(label) || addressLabel(a),
    moduleChip: moduleChip || null,
    payload: { modulo: a.vista, address: s, clientes: [], skus: [] },
  };
}

// El texto del botón, compuesto DESDE la dirección (nunca una etiqueta genérica). Voz formal, sin cifras.
export function addressLabel(addr) {
  const a = _isObj(addr) ? addr : parseAddress(addr);
  if (!a) return "Ver la evidencia en Sentrix";
  const m = VIEW_MANIFEST[a.componentId];
  const vista = VISTA_LABEL[a.vista] || a.vista;
  if (a.vista === "ficha" && a.entidad) return `Ver la ficha de ${a.entidad} en Sentrix`;
  if (m && m.tipo === "vista") return `Ver la vista ${vista} en Sentrix`;
  if (m && m.label) return `Ver «${m.label}» en Sentrix`;
  return `Ver ${vista} en Sentrix`;
}
