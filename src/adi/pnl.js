/* === src/adi/pnl.js · P&L COMERCIAL (owner 2026-07-15: "sí, parte por p&l") ===
 * "tenemos las ventas (ingreso), los costos, rebate etc. pero no tenemos los gastos — ADI y el usuario podrían
 * prorratear esos gastos (1% administrativos, 3% logística) y eso permite un p&l de negocios movible y proyectado".
 * LAS LÍNEAS SON DINÁMICAS: las define cada usuario en un FLUJO GUIADO por ADI (¿qué gastos? → ¿qué %? → boleta →
 * sello). Este módulo es TODO el P&L:
 *   · persistencia = criterios C.2 (mismo mecanismo del margen mínimo · localStorage · una verdad · forget compatible)
 *   · draft del flujo multi-turno (gastos → pcts → sello) · en memoria · el reset del chat lo limpia
 *   · detectPnlIntent = la RED DETERMINÍSTICA del coerce (claim propio pnl_setup · corre ANTES de fuera-de-dato y
 *     criteria: "marketing/publicidad" como LÍNEA DE GASTO no es una pregunta fuera de dato, y "olvidá mis gastos"
 *     no es un forget de criterio)
 *   · buildPnlCascade = LA CUENTA (determinística · el LLM guía, ADI calcula): ingreso − costo − carga − Σgastos ==
 *     resultado, EXACTO — y por entidad, prorrateo por la venta de la entidad (Σ entidades == total, misma álgebra)
 *   · composePnl = las respuestas del flujo y las lecturas (resultado · qué línea pesa · simulate de línea · meta
 *     de venta · resultado por entidad) — VERBATIM (evidence.kind "criteria": el narrador no las toca, como los
 *     criterios C.2) · toda cifra en boleta · cordura honesta (resultado negativo se DECLARA antes de sellar,
 *     nunca bloquea silencioso)
 * FUTURO C.3: cada línea guarda origen "supuesto_declarado" — la contabilidad real reemplaza línea a línea.
 * DECISIÓN v1 (declarada en el InfoDot de la cara): % SOBRE LA VENTA (drivers finos quedan para iteración).
 *
 * PASE 2 (owner 2026-07-25 · "por familia, por cliente, por punto de venta y del negocio… todo conectado, nada
 * al azar"): el P&L gana ALCANCE — por entidad ("P&L de Falabella" / "de Cuidado Personal"), por eje (la tabla
 * "P&L por familia") y del negocio (lo de siempre). DISPONIBILIDAD DATA-DRIVEN del contrato (pnlDisponibilidad):
 * un eje entra si el contrato declara venta+contribución ahí (METRICS) Y la base del P&L trae la venta
 * DESGLOSADA hacia ese eje (el campo de rollup vive en cada fila y sus valores son entidades reales del eje) —
 * bodega/punto de venta queda fuera HONESTO ("no tengo la venta desglosada por bodega") y SKU también (la venta
 * del P&L no baja desglosada a SKU: el detalle es una muestra). JAMÁS prorratear sobre un eje sin venta.
 * COHERENCIA por construcción: los alcances agrupan LA MISMA base que la cascada del negocio (mismas anclas
 * venta/contribución/carga · costo derivado) → Σ P&L de las entidades de un eje == P&L del negocio, EXACTO, en
 * los 3 escenarios (el gate lo verifica). La CONEXIÓN vive en _scope (el último alcance leído · "volvamos al
 * P&L" · "¿y el de Ripley?") + evidencia ACCIONABLE en las lecturas (entidad/entityList threadean lastEvidence
 * y la memoria manteniendo el verbatim — kind criteria manda en pickNarratedText). */
import { applyScenarioToClientesMargen } from "../engine/scenarios.js";
import { clientesMargen } from "../data/demoData.js";
import { getTenantData, getTenantId, onTenantChange } from "../data/tenantStore.js";   // F1/F2 multiempresa · derivadas + líneas por tenant en initTenant
import { fig } from "./boleta.js";
import { ENTITIES } from "../config/contract/entityRegistry.js";
import { METRICS } from "../config/contract/metricRegistry.js";
import { SOURCES } from "../config/contract/sourceManifest.js";
import { detectMultiAnalysis } from "./multiFocus.js";   // pase 2c: una enumeración de lentes es del MULTI, no del P&L
import { composeSpecDiagnose } from "./specRetrieval.js";   // sello del contrato: los DETECTORES (carga/margen) puentean el porqué de negocio — los mismos de la Mesa (una verdad)

// ── formato (misma escala que mesa.js: dato comercial en $K → $) ─────────────────────────────────────────────
const _r1 = (n) => Math.round(n * 10) / 10;
const _money = (v) => {
  const a = Math.abs(v), s = v < 0 ? "-" : "";
  if (a >= 1e6) return `${s}$${(a / 1e6).toFixed(1)}M`;
  if (a >= 1e3) return `${s}$${Math.round(a / 1e3)}K`;
  return `${s}$${Math.round(a)}`;
};
const _moneyK = (vK) => _money(vK * 1000);
const _fmtPct = (v) => String(_r1(v));
const _norm = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();
const _esc = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const _cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

// ── PERSISTENCIA (patrón criteria.js · localStorage POR TENANT · guarded para headless/gates) ───────────────
// F2 multiempresa: la DECLARACIÓN del usuario queda scopeada por empresa (demo = clave histórica adi_pnl_v1,
// nada guardado se pierde · otros tenants adi_pnl_v1::<id> · espejo en memoria para headless). Si el usuario no
// declaró, miden los DEFAULTS del PERFIL del tenant (perfil.pnlLineas · origen "perfil_empresa"): el rubro trae
// su estructura y la cara Resultado arranca armada — la declaración del usuario la pisa ENTERA, y «olvidá mis
// gastos» vuelve a esa base (como el criterio C.2 vuelve a la vara de la empresa). El demo no declara defaults
// → byte-idéntico. F3 (tenancy operativa): esta persistencia pasa al server (el gateway resuelve tenant+perfil).
let _tid = getTenantId();   // el tenant cuyas líneas están cargadas (se mueve en el callback de initTenant)
const _lsKey = () => (_tid === "demo" ? "adi_pnl_v1" : `adi_pnl_v1::${_tid}`);
const _hasLS = () => { try { return typeof localStorage !== "undefined" && !!localStorage; } catch { return false; } };
let _lines = [];   // [{ nombre, pct, origen:"supuesto_declarado"|"perfil_empresa" }] · % sobre la venta · vigente en runtime
let _declared = false;   // true = declaración del usuario · false = defaults del perfil (o nada)
const _userByTenant = {};   // espejo en memoria de la DECLARACIÓN por tenant (ida-y-vuelta sin storage no pierde ni arrastra)
const _persist = () => { if (_hasLS()) try { localStorage.setItem(_lsKey(), JSON.stringify(_lines)); } catch { /* sin storage */ } };
const _emitChange = () => { try { if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("adi-pnl-changed")); } catch { /* headless */ } };
export function loadPnl() { if (!_hasLS()) return []; try { const v = JSON.parse(localStorage.getItem(_lsKey()) || "[]"); return Array.isArray(v) ? v : []; } catch { return []; } }
const _validLine = (l) => l && typeof l.nombre === "string" && l.nombre.trim().length >= 2 && l.nombre.trim().length <= 30
  && typeof l.pct === "number" && isFinite(l.pct) && l.pct > 0 && l.pct <= 50;
// las líneas default del PERFIL del tenant (validadas con la MISMA regla que una declaración · defensivo)
const _perfilLineas = () => {
  const t = getTenantData();
  const ls = t && t.perfil && Array.isArray(t.perfil.pnlLineas) ? t.perfil.pnlLineas : [];
  return ls.filter(_validLine).slice(0, 10).map((l) => ({ nombre: l.nombre.trim(), pct: _r1(l.pct), origen: "perfil_empresa" }));
};
// resolución de las líneas vigentes: declaración del usuario (espejo de sesión ?? localStorage) ?? perfil del tenant
function _resolveLines() {
  const saved = _userByTenant[_tid] !== undefined
    ? _userByTenant[_tid]
    : loadPnl().filter(_validLine).map((l) => ({ nombre: l.nombre.trim(), pct: _r1(l.pct), origen: "supuesto_declarado" }));
  if (saved.length) { _lines = saved.map((l) => ({ ...l })); _declared = true; }
  else { _lines = _perfilLineas(); _declared = false; }
}
export function initPnl() { _resolveLines(); return activePnl(); }
export function activePnl() { return _lines.map((l) => ({ ...l })); }
export function pnlDefined() { return _lines.length > 0; }
export function pnlDeclared() { return _declared; }   // false = lo que mide viene del perfil de la empresa
export function setPnlLines(lines) {
  const ok = (Array.isArray(lines) ? lines : []).filter(_validLine).slice(0, 10)
    .map((l) => ({ nombre: l.nombre.trim(), pct: _r1(l.pct), origen: "supuesto_declarado" }));
  if (!ok.length) return { ok: false };
  _lines = ok; _declared = true;
  _userByTenant[_tid] = ok.map((l) => ({ ...l }));
  _persist(); _emitChange();
  return { ok: true, lines: activePnl() };
}
export function clearPnl() {
  const had = _declared && _lines.length > 0;
  _userByTenant[_tid] = [];   // "sin declaración" explícito — el espejo no resucita lo borrado
  if (_hasLS()) try { localStorage.removeItem(_lsKey()); } catch { /* sin storage */ }
  _lines = _perfilLineas(); _declared = false; _scope = null;
  _emitChange();
  return { ok: true, had, perfil: activePnl() };
}
const _findLine = (name, pool) => { const n = _norm(name); return (pool || _lines).find((l) => _norm(l.nombre) === n) || null; };
// línea nombrada DENTRO de un texto (para edit/simulate: «cambia logística a 2%») · nombre más largo primero
function _lineInText(q, pool) {
  const nq = _norm(q);
  const cands = (pool || _lines).slice().sort((a, b) => b.nombre.length - a.nombre.length);
  for (const l of cands) if (new RegExp(`(^|[^\\p{L}])${_esc(_norm(l.nombre))}([^\\p{L}]|$)`, "u").test(nq)) return l;
  return null;
}

/* ── EDICIÓN DIRECTA DEL CRITERIO (owner 2026-07-26: "en Sentrix permitirme verlo ordenado y con los supuestos
 * con opción de cambiarlos — eso fue lo que hablamos"): las MISMAS mutaciones de la conversación (edit_set /
 * edit_remove / edit_add pasan por acá) expuestas para la cara Resultado — UNA verdad: editar desde la cara y
 * editar por chat dejan el criterio byte-igual (el gate lo verifica). Editan y emiten adi-pnl-changed (la Mesa
 * abierta se re-arma en vivo); JAMÁS componen una respuesta de ADI — el control edita, nunca dispara. ── */
export function editPnlLine(nombre, pct) {
  const l = _findLine(nombre);
  if (!l) return { ok: false, motivo: "sin_linea" };
  const p = typeof pct === "number" ? pct : parseFloat(String(pct).replace(",", "."));
  if (!_validLine({ nombre: l.nombre, pct: p })) return { ok: false, motivo: "pct" };
  const prev = l.pct;
  setPnlLines(_lines.map((x) => (x === l ? { ...x, pct: _r1(p) } : x)));
  return { ok: true, nombre: l.nombre, prev, pct: _r1(p) };
}
export function removePnlLine(nombre) {
  const l = _findLine(nombre);
  if (!l) return { ok: false, motivo: "sin_linea" };
  const rest = _lines.filter((x) => x !== l);
  if (!rest.length) { clearPnl(); return { ok: true, nombre: l.nombre, prev: l.pct, vacio: true }; }
  setPnlLines(rest);
  return { ok: true, nombre: l.nombre, prev: l.pct, vacio: false };
}
export function addPnlLine(nombre, pct) {
  const nm = _cap(String(nombre || "").trim().replace(/\s+/g, " "));
  const p = typeof pct === "number" ? pct : parseFloat(String(pct).replace(",", "."));
  if (_lines.length >= 10) return { ok: false, motivo: "tope" };
  if (_findLine(nm)) return { ok: false, motivo: "duplicada" };
  if (!/^[\p{L}][\p{L}\s.\-]{1,29}$/u.test(nm) || _METRIC_WORDS.test(nm)) return { ok: false, motivo: "nombre" };
  if (!_validLine({ nombre: nm, pct: p })) return { ok: false, motivo: "pct" };
  setPnlLines([..._lines, { nombre: nm, pct: _r1(p) }]);
  return { ok: true, nombre: nm, pct: _r1(p) };
}

// ── DRAFT del flujo guiado (multi-turno · en memoria · el reset del chat lo limpia) ─────────────────────────
let _draft = null;   // { stage: "gastos" | "pcts" | "sello", lines: [{nombre, pct|null}] }
export function pnlDraft() { return _draft ? { stage: _draft.stage, lines: _draft.lines.map((l) => ({ ...l })) } : null; }
export function resetPnlDraft() { _draft = null; _scope = null; }

/* ── ALCANCE (PASE 2 · owner 2026-07-25: "por familia, por cliente, por punto de venta y del negocio") ────────
 * DISPONIBILIDAD DATA-DRIVEN: nada hardcodeado — se deriva del contrato + el dato. Un eje está disponible si
 * (a) el CONTRATO declara venta+contribución en ese eje (METRICS) y (b) la BASE del P&L (las filas que anclan
 * la cascada) trae la venta DESGLOSADA hacia él: el campo de rollup existe en cada fila y sus valores son
 * entidades reales del eje según SU fuente (SOURCES). Si mañana el dato trae venta por bodega, el eje aparece
 * solo — este módulo no se toca. El canon del alcance incluye también las entidades del contrato SIN cobertura
 * en la base (ej. una marca sin venta por cliente): el pedido se ENTIENDE y se responde honesto, sin prorratear. */
const _BASE_EJE = Object.keys(ENTITIES).find((k) => ENTITIES[k].source === "clientesMargen") || "cliente";
const _rollField = (eje) => {
  if (eje === _BASE_EJE) return ENTITIES[eje].keyField;
  const gf = ENTITIES[eje] && ENTITIES[eje].groupsFrom && Object.values(ENTITIES[eje].groupsFrom)[0];
  return gf || (ENTITIES[eje] && ENTITIES[eje].keyField) || null;
};
const _ejeRows = (eje) => {   // filas de la FUENTE propia del eje (contrato · para nombres canónicos)
  const E = ENTITIES[eje], S = E && SOURCES[E.source];
  if (!S) return [];
  let rows = [];
  try { rows = S.load() || []; } catch { rows = []; }
  return S.rowFilter ? rows.filter(S.rowFilter) : rows;
};
let _dispoCache = null;
export function pnlDisponibilidad() {
  if (_dispoCache) return _dispoCache;
  const out = [];
  for (const [eje, E] of Object.entries(ENTITIES)) {
    const label = E.label || { sing: eje, plur: `${eje}s` };
    if (eje === _BASE_EJE) { out.push({ eje, label, available: true, field: E.keyField }); continue; }
    // F1 multiempresa (caza del fixture empresa-2): EL DATO MANDA — si la base del P&L cubre el desglose
    // (cada fila trae el campo del eje con nombre canónico), el eje está DISPONIBLE aunque el registro de
    // métricas no declare venta@eje (una empresa con venta por bodega en su base lo ve aparecer solo).
    // Con el demo el resultado es byte-idéntico: los ejes que cubren ya estaban declarados, y los motivos
    // de los no-cubiertos salen en el mismo orden de siempre (declara → cubre).
    const declara = (METRICS.ventas.axes || []).includes(eje) && (METRICS.contribucion.axes || []).includes(eje);
    const f = _rollField(eje);
    const names = new Set(_ejeRows(eje).map((r) => _norm(r[E.keyField])).filter(Boolean));
    const cubre = !!f && clientesMargen.length > 0 && clientesMargen.every((r) => typeof r[f] === "string" && r[f] && names.has(_norm(r[f])));
    if (cubre) { out.push({ eje, label, available: true, field: f }); continue; }
    out.push(!declara
      ? { eje, label, available: false, motivo: `no tengo la venta desglosada por ${label.sing}` }
      : { eje, label, available: false, motivo: `la venta del P&L no baja desglosada a ${label.sing}` });
  }
  return (_dispoCache = out);
}
export const pnlEjesDisponibles = () => pnlDisponibilidad().filter((d) => d.available);
const _dispoDe = (eje) => pnlDisponibilidad().find((d) => d.eje === eje) || null;
// la frase "sí puedo dártelo por…" del redirect (data-driven · una sola verdad con la disponibilidad)
const _dondeSi = () => {
  const ls = pnlEjesDisponibles().map((d) => d.label.sing);
  return ls.length > 1 ? `${ls.slice(0, -1).join(", ")} o ${ls[ls.length - 1]}` : (ls[0] || "");
};

// canon del ALCANCE: nombre normalizado → { nombre, eje, covered } (covered=false: entidad del contrato sin
// venta desglosada en la base — se entiende el pedido, se responde honesto)
let _canonCache = null;
function _pnlCanon() {
  if (_canonCache) return _canonCache;
  const m = new Map();
  for (const d of pnlEjesDisponibles()) {
    if (d.eje === _BASE_EJE) { for (const r of clientesMargen) m.set(_norm(r[d.field]), { nombre: r[d.field], eje: d.eje, covered: true }); continue; }
    for (const r of clientesMargen) { const v = r[d.field]; if (v && !m.has(_norm(v))) m.set(_norm(v), { nombre: v, eje: d.eje, covered: true }); }
  }
  for (const d of pnlEjesDisponibles()) {
    if (d.eje === _BASE_EJE) continue;
    for (const r of _ejeRows(d.eje)) { const v = r[ENTITIES[d.eje].keyField]; if (v && !m.has(_norm(v))) m.set(_norm(v), { nombre: v, eje: d.eje, covered: false }); }
  }
  return (_canonCache = m);
}
function _pnlEntityEn(q) {   // entidad del canon del alcance nombrada en el texto · nombre más largo primero
  const nq = _norm(q);
  for (const [k, c] of [..._pnlCanon().entries()].sort((a, b) => b[0].length - a[0].length)) {
    if (k.length < 2) continue;   // ≥2: "LG" es marca real — el borde de palabra evita pescarla adentro de otra
    if (new RegExp(`(^|[^a-z0-9])${_esc(k)}([^a-z0-9]|$)`).test(nq)) return c;
  }
  return null;
}
function _pnlEntitiesEn(q) {   // TODAS las entidades del canon nombradas en el texto (para el conjunto explícito)
  const nq = _norm(q), out = [];
  for (const [k, c] of [..._pnlCanon().entries()].sort((a, b) => b[0].length - a[0].length)) {
    if (k.length < 2) continue;
    if (new RegExp(`(^|[^a-z0-9])${_esc(k)}([^a-z0-9]|$)`).test(nq) && !out.some((o) => o.nombre === c.nombre)) out.push(c);
  }
  return out;
}
// eje nombrado en el texto («por familia» · «por punto de venta») → key del contrato + la palabra del usuario
const _EJE_ALIAS = [
  [/\bpuntos?\s+de\s+venta\b/i, "bodega"], [/\bbodegas?\b/i, "bodega"], [/\bsucursal\w*\b/i, "bodega"],
  [/\btiendas?\b/i, "bodega"], [/\blocales\b/i, "bodega"],
  [/\bfamilias?\b/i, "familia"], [/\bcategor[ií]as?\b/i, "familia"],
  [/\bmarcas?\b/i, "marca"],
  [/\bclientes?\b/i, "cliente"], [/\bcuentas?\b/i, "cliente"],
  [/\bskus?\b/i, "sku"], [/\bproductos?\b/i, "sku"],
];
function _ejeEn(q) {
  for (const [re, k] of _EJE_ALIAS) { const m = re.exec(q); if (m) return { eje: k, pedido: m[0].toLowerCase().replace(/s$/, "").replace(/puntos de venta/, "punto de venta") }; }
  return null;
}
// «P&L por <eje>» exige la preposición pegada a un eje ("los 5 clientes por venta" no es una tabla del P&L)
const _POR_EJE_RE = /\b(?:por|seg[uú]n|a\s+nivel\s+(?:de\s+)?|para\s+cada|desglosado\s+(?:por|en)|abierto\s+por)\s+((?:cada\s+|la\s+|las\s+|los\s+|el\s+|mis\s+)?[\p{L}][\p{L}\s]{2,26})/iu;
const _ejePedido = (q) => { const m = _POR_EJE_RE.exec(q); return m ? _ejeEn(m[1]) : null; };

// ── ESTADO DEL HILO (el último alcance leído · "volvamos al P&L" / "¿y el de Ripley?") · en memoria · el
// reset del chat lo limpia (resetPnlDraft) · forget también (clearPnl) ──
let _scope = null;   // { dimension, entity|null, entities|null } · null = negocio (o sin lectura aún)
// F2 multiempresa: al cambiar de tenant caen los DERIVADOS DEL DATO (disponibilidad + canon del alcance), el
// hilo de alcance Y el flujo a medias (nombran cosas de la otra empresa) — y las LÍNEAS se re-resuelven para el
// tenant que entra: su declaración (espejo de sesión ?? localStorage scopeado) ?? los defaults de SU perfil.
// La declaración del que sale queda estacionada en el espejo — cambiar de empresa no arrastra ni pierde nada.
onTenantChange((d) => {
  if (_declared) _userByTenant[_tid] = _lines.map((l) => ({ ...l }));
  _tid = (d && d.id) || "demo";
  _dispoCache = null; _canonCache = null; _scope = null; _draft = null;
  _resolveLines();
});
export function pnlScope() { return _scope ? { ..._scope, entities: _scope.entities ? [..._scope.entities] : null } : null; }

/* detectPnlEllipsis(q) → intent | null · las formas ELÍPTICAS del hilo P&L («¿y el de Ripley?» · «recuerda lo
 * anterior»). SEPARADO de detectPnlIntent porque NO debe cortar la cadena solo: coerceSpec lo consulta ÚNICAMENTE
 * si el LLM #1 no resolvió ya el turno a una operación concreta (un «¿y el de Jumbo?» de un hilo de margen es del
 * margen — la clasificación resuelta manda) y exige hilo P&L vivo (_scope + líneas). */
export function detectPnlEllipsis(q) {
  const t = String(q || "").trim();
  if (!t || !_lines.length || !_scope) return null;
  const mY = t.match(/^¿?\s*¿?\s*y\s+(?:el|la|los|las)?\s*(?:de\s+)?([\p{L}][\p{L}\s.\-]{2,30}?)\s*\??\s*$/iu);
  if (mY) { const c = _pnlEntityEn(mY[1]); if (c) return { action: "resultado_scoped", entidad: c.nombre, eje: c.eje, covered: c.covered }; }
  if (/^¿?\s*(?:recuerda|record[aá]|acord[aá]te\s+de)\s+lo\s+(?:anterior|de\s+antes|[uú]ltimo)\b|qu[eé]\s+me\s+hab[ií]as\s+dicho/i.test(t))
    return { action: "volver" };
  // cambio de eje elíptico dentro del hilo («muéstramelo por familia» · «veámoslo por marca» — sweep 2026-07-25)
  const mP = t.match(/^¿?\s*(?:mu[eé]stra(?:me)?lo|v[eé]a?moslo|d[aá]melo|[aá]brelo|c[aá]mbialo|ll[eé]v[aá]lo|ahora)\s+(?:a\s+|por\s+|en\s+)(.+?)\s*\??\s*$/iu);
  if (mP) { const ej = _ejeEn(mP[1]); if (ej) return { action: "tabla_eje", eje: ej.eje, pedido: ej.pedido }; }
  return null;
}

// ── LA CASCADA (determinística · UNA verdad: la cara Resultado, las lecturas y el cuadro leen de acá) ────────
// Base = clientesMargen del escenario (venta facturada anual · la MISMA base de margen/contribución de la Mesa).
// ANCLAS = las cifras que ADI YA cita en toda otra respuesta: venta y CONTRIBUCIÓN por fila (el escenario las
// recalcula juntas) y la carga desde pctRebate (el campo `rebates` base queda stale en runtime — clase [39]).
// Margen bruto y costo se DERIVAN (margen bruto = contribución + carga · costo = ingreso − margen bruto): así la
// cascada CIERRA EXACTO en cada paso por construcción — ingreso − costo − carga − Σgastos == resultado — y por
// entidad, resultado_e = contribución_e − Σ(pct_i × venta_e/100), con Σ entidades == total (el gate lo verifica).
export function buildPnlCascade(scenario, linesOverride = null, opts = null) {
  const lines = linesOverride || _lines;
  const M = applyScenarioToClientesMargen(scenario || "bonanza") || [];
  const sum = (f) => M.reduce((a, r) => a + (typeof f(r) === "number" ? f(r) : 0), 0);
  const ingresoK = sum((r) => r.venta), contribK = sum((r) => r.contribucion);
  const cargaK = sum((r) => (r.venta * (r.pctRebate || 0)) / 100);
  const margenBrutoK = contribK + cargaK;
  const costoK = ingresoK - margenBrutoK;
  const sumPct = _r1(lines.reduce((a, l) => a + l.pct, 0));
  const gastos = lines.map((l) => ({ nombre: l.nombre, pct: l.pct, origen: l.origen || "supuesto_declarado", usdK: (ingresoK * l.pct) / 100 }));
  const totalGastosK = gastos.reduce((a, g) => a + g.usdK, 0);
  const resultadoK = contribK - totalGastosK;
  const resultadoPct = ingresoK ? (resultadoK / ingresoK) * 100 : 0;
  // ── porEntidad por ALCANCE (pase 2): el eje pedido agrupa LA MISMA base (mismas anclas venta/contribución/
  // carga por fila · costo derivado) → cada entidad cierra exacto y Σ entidades == negocio POR CONSTRUCCIÓN,
  // en todo escenario. El eje base = una fila por entidad (byte-igual al pase 1 + carga/costo derivados). ──
  const dimension = (opts && opts.dimension && opts.dimension !== _BASE_EJE && ENTITIES[opts.dimension]) ? opts.dimension : _BASE_EJE;
  const _entrada = (nombre, ventaK2, contribK2, cargaK2, n) => {
    const gK = (ventaK2 * sumPct) / 100;
    return { nombre, ventaK: ventaK2, contribK: contribK2, cargaK: cargaK2, margenBrutoK: contribK2 + cargaK2,
      costoK: ventaK2 - (contribK2 + cargaK2), gastoK: gK, resultadoK: contribK2 - gK,
      resultadoPct: ventaK2 ? ((contribK2 - gK) / ventaK2) * 100 : 0, n };
  };
  let porEntidad;
  if (dimension === _BASE_EJE) {
    porEntidad = M.map((r) => _entrada(r.nombre, r.venta, r.contribucion, (r.venta * (r.pctRebate || 0)) / 100, 1));
  } else {
    const f = _rollField(dimension), by = new Map();
    for (const r of M) {
      const k = r[f] || "—";
      if (!by.has(k)) by.set(k, { ventaK: 0, contribK: 0, cargaK: 0, n: 0 });
      const g = by.get(k);
      g.ventaK += r.venta; g.contribK += r.contribucion; g.cargaK += (r.venta * (r.pctRebate || 0)) / 100; g.n++;
    }
    porEntidad = [...by.entries()].map(([k, g]) => _entrada(k, g.ventaK, g.contribK, g.cargaK, g.n)).sort((a, b) => b.ventaK - a.ventaK);
  }
  return { defined: lines.length > 0, lines: lines.map((l) => ({ ...l })), ingresoK, costoK, margenBrutoK, cargaK, contribK, gastos, sumPct, totalGastosK, resultadoK, resultadoPct, dimension, porEntidad };
}

// ── DETECCIÓN · la red determinística del claim pnl_setup (corre en coerceSpec ANTES de fuera-de-dato/criteria) ──
// «prorrateo» es vocabulario que ADI EMITE en cada lectura del P&L ("gastos prorrateados") — espejo (owner
// 2026-07-25 en vivo: «quiero nuevos prorrateos» caía en una lectura de ventas): si ADI lo dice, ADI lo entiende.
const _PNL_WORD = /\b(?:p\s*&\s*l|pnl|pyl|p\s+y\s+l|resultado\s+comercial|prorrate\w*)\b/i;
const _GASTOS_WORD = /\b(?:gastos?|l[ií]neas?\s+de\s+gasto)\b/i;
// OJO: nada de \b después de una vocal acentuada — á/é no son word-chars en JS sin flag u y el boundary falla
// silencioso ("olvidá"/"armá" no matchean · mismo bug documentado en criteria.js).
const _ARMAR_RE = /\b(arm(?:emos|amos|ar|[aá])|constru(?:yamos|ir)|defin(?:amos|ir|[ií])|configur(?:emos|ar|[aá])|hagamos|partamos\s+(?:por|con)|empecemos\s+(?:por|con)|quiero\s+(?:armar|definir|configurar))/i;
// palabras del dominio del DATO: si el "gasto" nombrado es una de estas, NO es una línea de P&L (protege el claim)
const _METRIC_WORDS = /\b(ventas?|margen|contribuci[oó]n|capital|stock|inventari\w*|rotaci[oó]n|doh|cobertura|costos?|carga|rebates?|presupuesto|clientes?|sku|marcas?|familias?|bodegas?|benchmark|resultado|unidades|precios?)\b/i;
const _AFFIRM_SELLO = /^\s*(s[ií]|dale|ok(ey)?|s[eé]ll?alo|sella|sellado|confirmo|de una|perfecto|adelante|h[aá]zlo|hacelo|claro|obvio|s[ií],?\s+s[eé]ll?alo)[\s.!…]*$/i;
const _CANCEL_RE = /^\s*(no(,)?\s+)?(mejor\s+no|cancel[aá]\w*|dej[eé]moslo|despu[eé]s\s+(lo\s+)?(seguimos|vemos)|olv[ií]dalo|par[aá]|no\s+por\s+ahora|ahora\s+no)[\s.!…]*$/i;
const _SIMQ_RE = /\b(qu[eé]\s+pasa(?:r[ií]a)?\s+si|c[oó]mo\s+queda(?:r[ií]a\w*|mos)?\s+si|y\s+si)\b|^\s*¿?\s*si\s+\p{L}/iu;

// parse de una LISTA LIBRE de gastos ("administrativos, marketing y promotores" · con % opcional por línea)
function _parseGastoList(q) {
  if (/[?¿]/.test(q)) return null;
  const clean = String(q).replace(/^\s*(?:considerar?[ií]?a?|quiero\s+(?:considerar)?|ser[ií]an|son|pon(?:é|e|gamos)?|anot[aá]|los\s+gastos(?:\s+son)?|gastos?\s*:?)\s*/i, "").trim();
  if (!clean) return null;
  const parts = clean.split(/\s*(?:,|;|·|\n|\s+y\s+|\s+e\s+)\s*/i).map((s) => s.trim().replace(/[.!]+$/, "")).filter(Boolean);
  if (!parts.length || parts.length > 10) return null;
  const lines = [];
  for (const p of parts) {
    const mp = p.match(/^(.+?)\s*(?:[:=]|\ba(?:l)?\b)?\s*(\d+(?:[.,]\d+)?)\s*%\s*$/);
    const name = (mp ? mp[1] : p).replace(/^(?:el|la|los|las|un|una)\s+/i, "").trim();
    if (!/^[\p{L}][\p{L}\s.\-]{1,29}$/u.test(name)) return null;
    if (_METRIC_WORDS.test(name)) return null;
    // ORACIÓN, no nombre de gasto (sweep informal 2026-07-25: «ya gracias, muéstrame el pyl completo» se volvía
    // dos líneas): nombres cortos (≤3 palabras) y sin arranque de verbo/muletilla — si una parte huele a frase,
    // la LISTA entera se descarta y el turno sigue su curso.
    const nName = _norm(name);
    if (nName.split(/\s+/).length > 3) return null;
    if (/^(ya|ok|dale|gracias|listo|bueno|muestr\w*|dame|dime|quiero|hazme|haz|arma\w*|cambi\w*|saca\w*|olvida\w*|recuerda\w*|explica\w*|si|no|deja\w*|pon\w*|vuelv\w*|hola)\b/.test(nName)) return null;
    if (lines.some((l) => _norm(l.nombre) === _norm(name))) continue;
    lines.push({ nombre: _cap(name), pct: mp ? parseFloat(mp[2].replace(",", ".")) : null });
  }
  return lines.length ? lines : null;
}

// parse de PORCENTAJES para las líneas del draft ("3, 1.5, 2" en orden · "logística 3%" por línea · "2% a cada una")
function _parsePcts(q, lines) {
  const nq = _norm(q);
  const nums = [...String(q).matchAll(/(\d+(?:[.,]\d+)?)\s*%?/g)].map((m) => parseFloat(m[1].replace(",", ".")));
  if (!nums.length) return false;
  let touched = false;
  if (/\b(?:a\s+)?(?:cada|todas?|todos)\b/i.test(q) && nums.length === 1) {
    for (const l of lines) l.pct = nums[0];
    return true;
  }
  for (const l of lines) {
    const m = new RegExp(`${_esc(_norm(l.nombre))}[^\\d%]{0,14}(\\d+(?:[.,]\\d+)?)`).exec(nq);
    if (m) { l.pct = parseFloat(m[1].replace(",", ".")); touched = true; }
  }
  if (!touched) {
    const missing = lines.filter((l) => l.pct == null);
    if (nums.length === missing.length) { missing.forEach((l, i) => { l.pct = nums[i]; }); touched = true; }
    else if (nums.length === lines.length) { lines.forEach((l, i) => { l.pct = nums[i]; }); touched = true; }
  }
  return touched;
}

// target monetario de una META ("ganar $2M después de gastos" · "2 millones") → $K | null
function _parseTargetK(q) {
  let m = String(q).match(/\$\s*(\d+(?:[.,]\d+)?)\s*(M|K)?\b/i);
  if (m) { const v = parseFloat(m[1].replace(",", ".")); return m[2] && m[2].toUpperCase() === "K" ? v : (m[2] ? v * 1000 : (v >= 10000 ? v / 1000 : v * 1000)); }
  m = String(q).match(/(\d+(?:[.,]\d+)?)\s*(millones|mill[oó]n)\b/i);
  if (m) return parseFloat(m[1].replace(",", ".")) * 1000;
  m = String(q).match(/(\d+(?:[.,]\d+)?)\s*mil\b/i);
  if (m) return parseFloat(m[1].replace(",", "."));
  return null;
}

/* detectPnlIntent(q) → { action, ... } | null · PURA respecto del texto (lee el estado del módulo: draft + líneas
 * + alcance). Acciones: start · recall · forget · edit_set · edit_add · edit_remove · peso · resultado ·
 * resultado_entidad · simulate_line · meta_venta · draft_* · y del PASE 2: resultado_scoped · tabla_eje ·
 * resultado_deixis · volver (las elípticas del hilo viven en detectPnlEllipsis — no cortan la cadena solas). */
export function detectPnlIntent(q) {
  const t = String(q || "").trim();
  if (!t) return null;
  // ── MID-FLOW · el draft manda (solo claims compatibles con la etapa · un cambio de tema NO se secuestra) ──
  if (_draft) {
    // cancel informal («deja todo como estaba mejor» · sweep 2026-07-25) — sobre texto NORMALIZADO (acentos:
    // "déjalo" no matchea /dej[aá]/ crudo — el acento va en la primera sílaba, misma clase del bug documentado)
    if (_CANCEL_RE.test(t) || /\bdej\w*\s+(?:todo\s+)?(?:como|asi)\s+(?:estaba|esta)\b|\bvolvamos\s+a\s+lo\s+de\s+antes\b/.test(_norm(t)))
      return { action: "draft_cancel" };
    // edición dentro del flujo («cambia logística a 2%» antes de sellar) — misma red del edit, sobre el draft
    const dl = _lineInText(t, _draft.lines);
    if (dl && /(cambi|ajust|dej|pon|mejor|sub|baj)\w*/.test(_norm(t))) {
      const mp = t.match(/(\d+(?:[.,]\d+)?)\s*%?/);
      if (mp) return { action: "draft_edit", nombre: dl.nombre, pct: parseFloat(mp[1].replace(",", ".")) };
      return { action: "draft_edit_reask", nombre: dl.nombre };   // espejo: «cambia X a otro %» sin número → re-pregunta
    }
    if (_draft.stage === "sello") {
      if (_AFFIRM_SELLO.test(t) || /^(vale|listo)[\s.!…]*$/.test(_norm(t))) return { action: "draft_sello" };
      if (/^\s*no\b[\s.!…]*$/i.test(t) || /\b(revis|ajust|cambi)/i.test(t)) return { action: "draft_stay" };
    }
    // ACUSE/META DEL FLUJO (owner cazó en vivo 2026-07-26: «ok. que necesitas» tras abrir la guía caía al
    // fallback narrado genérico — hilo perdido en el primer paso): DENTRO del flujo, un acuse pelado («ok»,
    // «sí», «dale») o un "¿qué necesitas?/cómo seguimos" RE-GUÍA la etapa pendiente, jamás suelta. Sin signo
    // de pregunta también («ok. que necesitas»). Sobre texto normalizado (clase acentos).
    const _ntD = _norm(t);
    const _ackFlujo = /^(ok(ey)?|si|ya|dale|listo|bueno|perfecto|de acuerdo|claro|vale)[\s.!…]*$/.test(_ntD)
      || /\bque\s+necesitas\b|\bnecesitas\s+de\s+mi\b|\bque\s+te\s+(doy|digo|paso)\b|\bcomo\s+seguimos\b|\bque\s+sigue\b|\bcomo\s+lo\s+hacemos\b|\bayuda\b|\bque\s+hago\b/.test(_ntD);
    if (_draft.stage === "gastos") {
      if (_ackFlujo) return { action: "draft_help" };
      // "¿Armamos tu P&L ahora?" / preguntas de gastos DURANTE la etapa → re-guiar (espejo: la oferta que abrió
      // el flujo también se entiende adentro del flujo)
      if (/[?¿]/.test(t) && (_GASTOS_WORD.test(t) || _PNL_WORD.test(t) || _ARMAR_RE.test(t))) return { action: "draft_help" };
      const lines = _parseGastoList(t);
      if (lines) return { action: "draft_gastos", lines };
      return null;   // no parsea como lista → el turno sigue su curso normal (el draft espera)
    }
    if (_draft.stage === "pcts" || _draft.stage === "sello") {
      // acuse/meta a mitad de los % («ok» · «¿qué necesitas?») → re-preguntar los % pendientes, jamás soltar
      if (_draft.stage === "pcts" && _ackFlujo) return { action: "draft_reask" };
      if (/\d/.test(t) && !_SIMQ_RE.test(t)) {
        const lines = _draft.lines.map((l) => ({ ...l }));
        if (_parsePcts(t, lines)) return { action: "draft_pcts", lines };
      }
      // ESTRUCTURA NUEVA a mitad del flujo (rearme · owner 2026-07-25): una lista limpia de gastos (≥2 líneas)
      // reemplaza las del draft — «administrativos, fletes y comisiones» o con sus % — y el camino sigue igual.
      if (!_SIMQ_RE.test(t)) {
        const nl = _parseGastoList(t);
        if (nl && nl.length >= 2) return { action: "draft_gastos", lines: nl };
      }
      return null;
    }
    return null;
  }
  // ── SIN DRAFT ──
  // CRUCE DE LENTES (pase 2c): «margen y resultado de Cuidado Personal» enumera DOS métricas — es del
  // multi-análisis (que ahora tiene la lente resultado), no de un claim P&L single. El P&L no roba el cruce.
  if (detectMultiAnalysis(t).isMulti) return null;
  // LA PREGUNTA CLAVE DEL INICIO (owner 2026-07-25: "'¿dónde estoy perdiendo dinero?' debe ser el P&L del
  // negocio, y ADI debe guiar preguntando supuestos — todo en el chat"): la historia del dinero de punta a
  // punta; sin gastos declarados, ADI abre el flujo guiado ahí mismo. Solo dinero/resultado — "perdiendo
  // margen" sigue siendo del margen.
  {
    const nt0 = _norm(t);
    if (/donde\s+(?:estoy\s+|me\s+estoy\s+|se\s+(?:me\s+)?(?:esta\s+)?)?(?:perdiendo|pierdo|fugando|escapando)\b[^.?!]*\b(?:dinero|resultado)\b/.test(nt0)
      || /donde\s+se\s+me\s+(?:va|escapa|fuga)\s+(?:el\s+)?dinero/.test(nt0))
      return { action: "perdiendo" };
  }
  // PROYECCIÓN DE VENTA (owner 2026-07-25: "te puede pedir que uses otra venta — si vendiera X cuánto me
  // quedaría con estos gastos — manteniendo el margen del cliente, el real a un lado y el proyectado al lado"):
  // condicional/pregunta de venta + MONTO ($ · sin %) → el P&L real vs proyectado, margen/carga constantes.
  if (_lines.length && /\b(vend\w+|venta)\b/i.test(t) && !/\d\s*%/.test(t)
    && !/\bcu[aá]nto\s+(?:tengo\s+que\s+|debo\s+|necesito\s+|tendr[ií]a\s+que\s+|hay\s+que\s+)?vender\b/i.test(t)
    && (_SIMQ_RE.test(t) || /\bcu[aá]nto\s+(?:me\s+)?(?:queda(?:r[ií]a)?|dejar[ií]a)\b/i.test(t) || /\bcon\s+una\s+venta\s+de\b/i.test(t)
      || /\b(?:cambi[aá]|us[ae]|pon(?:é|e|gamos)?|prueb[aá])\w*\s+(?:una\s+|la\s+|otra\s+)?venta\b/i.test(t))) {
    const vK = _parseTargetK(t);
    if (vK && vK > 0) {
      const pi2 = { action: "proyeccion_venta", ventaK: vK };
      if (/\bnegocio\b/i.test(t)) pi2.negocio = true;
      else {
        const ent = _pnlEntityEn(t);
        if (ent) { pi2.entidad = ent.nombre; pi2.eje = ent.eje; pi2.covered = ent.covered; }
      }
      return pi2;
    }
  }
  // simulate de una LÍNEA declarada («¿qué pasa si bajo logística a 2%?») · condicional + línea propia + % target
  // + ALCANCE (pase 2): «…a 2% en Falabella» (canon) o deíctico («¿y si en esa familia bajo logística a 2%?»)
  if (_lines.length && _SIMQ_RE.test(t)) {
    const l = _lineInText(t);
    if (l) {
      const mp = t.match(/(?:\ba(?:l)?\s+)(\d+(?:[.,]\d+)?)\s*%|(\d+(?:[.,]\d+)?)\s*%/);
      if (mp) {
        const pi = { action: "simulate_line", nombre: l.nombre, pct: parseFloat((mp[1] || mp[2]).replace(",", ".")) };
        const ent = _pnlEntityEn(t);
        const mD = t.match(/\b(?:en|para|de)\s+(?:esa?|este?|esta)\s+(familia|cliente|cuenta|marca|entidad)\b/i);
        if (ent && ent.covered) { pi.entidad = ent.nombre; pi.eje = ent.eje; }
        else if (mD) pi.scopeDeictic = mD[1].toLowerCase();   // el sustantivo deíctico (valida el eje al componer)
        else if (/\bah[ií]\b/i.test(t)) pi.scopeDeictic = "entidad";
        return pi;
      }
    }
    return null;   // condicional sin línea propia → la red genérica de simulate resuelve
  }
  // edición de líneas guardadas · verbos sobre texto NORMALIZADO («bájalo»/«súbela»/«cámbialo»: el acento en la
  // primera sílaba rompe /baj[aá]/ crudo — clase acentos, cazada por el sweep informal 2026-07-25)
  if (_lines.length) {
    const l = _lineInText(t);
    const nt = _norm(t);
    if (l && /(saca|quita|elimina|borra)\w*/.test(nt) && !/\d\s*%/.test(t)) return { action: "edit_remove", nombre: l.nombre };
    if (l && /(cambi|ajust|pon|dej|sub|baj)\w*/.test(nt)) {
      const mp = t.match(/(\d+(?:[.,]\d+)?)\s*%?\s*[?.!]*\s*$|(\d+(?:[.,]\d+)?)\s*%/);
      if (mp) return { action: "edit_set", nombre: l.nombre, pct: parseFloat((mp[1] || mp[2]).replace(",", ".")) };
      // espejo (gate 2026-07-25): «cambia logística a otro %» es frase que ADI EMITE — sin número, re-pregunta el %
      return { action: "edit_reask", nombre: l.nombre };
    }
  }
  if (/(agreg[aá]|sum[aá]|a[ñn]ad[ií])/i.test(t) && (_lines.length || _PNL_WORD.test(t) || _GASTOS_WORD.test(t))) {
    const ma = t.match(/(?:agreg[aá]\w*|sum[aá]\w*|a[ñn]ad[ií]\w*)\s+(?:la\s+l[ií]nea\s+)?(?:de\s+)?([\p{L}][\p{L}\s.\-]{1,29}?)\s+(?:con\s+|al\s+|a\s+)?(\d+(?:[.,]\d+)?)\s*%/iu);
    if (ma && !_METRIC_WORDS.test(ma[1])) return { action: "edit_add", nombre: _cap(ma[1].trim()), pct: parseFloat(ma[2].replace(",", ".")) };
    const mn = t.match(/(?:agreg[aá]\w*|sum[aá]\w*|a[ñn]ad[ií]\w*)\s+(?:la\s+l[ií]nea\s+)?(?:de\s+)?([\p{L}][\p{L}\s.\-]{1,29})\s*$/iu);
    if (mn && !_METRIC_WORDS.test(mn[1]) && _lines.length) return { action: "edit_add_nopct", nombre: _cap(mn[1].trim()) };
  }
  // forget («olvidá mi p&l» / «borrá mis gastos») · ANTES que el forget de criteria (que se lo robaría como recall)
  if (/\b(olvid[aá]|borr[aá]|elimin[aá]|resete[aá])/i.test(t) && (_PNL_WORD.test(t) || /\b(mis|los)\s+gastos\b/i.test(t)))
    return { action: "forget" };
  // ── ALCANCE (pase 2) · «volvamos al P&L» → retoma el último alcance · ANTES de scoped/recall ──
  if (/\b(volv(?:amos|emos|é|e[rs]?)|retom(?:emos|[aá]|ar))\b/i.test(t) && _PNL_WORD.test(t))
    return { action: "volver" };
  // ── ALCANCE (pase 2) · «P&L de Falabella» / «de Cuidado Personal» / «por familia» / «del negocio» ·
  // ANTES del recall («muéstrame el P&L de Falabella» no es el recall global) ──
  if (_PNL_WORD.test(t)) {
    const entA = _pnlEntityEn(t);
    if (entA) return { action: "resultado_scoped", entidad: entA.nombre, eje: entA.eje, covered: entA.covered };
    const ej = _ejePedido(t);
    if (ej) return { action: "tabla_eje", eje: ej.eje, pedido: ej.pedido };
    // «¿cómo viene el P&L de mi negocio?» (la pregunta clave del inicio · owner 2026-07-25) → LA HISTORIA
    if (/c[oó]mo\s+(?:viene|va|est[aá]|anda)/i.test(t) || /\bde\s+mi\s+negocio\b/i.test(t)) return { action: "perdiendo" };
    if (/\bdel?\s+negocio(?:\s+completo)?\b|\bnegocio\s+completo\b/i.test(t)) return { action: "resultado" };
  }
  // «resultado después de gastos por familia» (sin la palabra P&L) también es la tabla del eje
  if (/despu[eé]s\s+de\s+(?:los\s+)?gastos/i.test(t)) {
    const ej = _ejePedido(t);
    if (ej && !_pnlEntityEn(t)) return { action: "tabla_eje", eje: ej.eje, pedido: ej.pedido };
  }
  // RE-ARME GUIADO (owner 2026-07-25: "nuevos supuestos, prorrateos, o lo que se le ocurra — es el mismo camino
  // dicho de una manera diferente, y ADI debe guiar eso"): la INTENCIÓN de rehacer la estructura, con cualquier
  // palabra (prorrateos/supuestos/porcentajes/gastos/estructura + querer-cambiar), reabre el flujo guiado en la
  // etapa de % con TUS líneas — «dime qué % quieres usar esta vez» — o con la lista nueva que des.
  if (/\b(?:p\s*&\s*l|pnl|prorrate\w*|porcentajes?|supuestos?|estructura|gastos?)\b/i.test(t)
    && /\b(nuev[oa]s?|otr[oa]s?|cambi\w*|redefin\w*|rearm\w*|reh[aá]g\w*|rehac\w*|actualiz\w*|revis\w*|ajust\w*|us[ae]mos)\b/i.test(t)
    && !_METRIC_WORDS.test(t))
    return { action: "rearmar" };
  // recall («¿qué gastos tengo configurados?» · «muéstrame mi p&l») · ANTES del start ("configurados" contiene "configura")
  if ((/\bqu[eé]\s+gastos\b/i.test(t) && /(tengo|ten[eé]s|configurad|definid|guardad)/i.test(t))
    || (/(mu[eé]strame|mostrame|ver|c[oó]mo\s+(est[aá]|qued[oó])|cu[aá]l\s+es)\b/i.test(t) && _PNL_WORD.test(t) && !/resultado\s+comercial/i.test(t)))
    return { action: "recall" };
  // start («armemos mi p&l» · «definamos los gastos» · el prefill de la cara vacía)
  if ((_ARMAR_RE.test(t) && (_PNL_WORD.test(t) || _GASTOS_WORD.test(t))) || (/\bmi\s+p\s*&\s*l\b/i.test(t) && /\b(armar|empezar|partir)\b/i.test(t)))
    return { action: "start" };
  // qué línea pesa más
  if (/\bl[ií]neas?\b[^.?!]*\b(pesa|pesan|consume|se\s+come)\b[^.?!]*\bresultado\b|\bl[ií]nea\s+que\s+m[aá]s\s+pesa\b/i.test(t))
    return { action: "peso" };
  // DEIXIS (pase 2 · patrón C.1): «de esos, ¿cuánto me dejan después de gastos?» — hereda el conjunto que ADI
  // acaba de nombrar (composePnl lo resuelve desde la última evidencia/memoria; acá solo se detecta).
  if (_lines.length
    && /\b(?:de|entre)\s+(?:esos|esas|ellos|ellas|estos|estas|los\s+mismos|las\s+mismas|los\s+anteriores|los\s+que\s+(?:me\s+)?(?:mostraste|nombraste|dijiste|salieron|aparecieron))\b/i.test(t)
    && (/despu[eé]s\s+de\s+(?:los\s+)?gastos/i.test(t) || /\bresultado\b/i.test(t))
    && /\b(dej[oa]n?|queda[n]?|gan[oa]n?|rinden?|aportan?)\b/i.test(t))
    return { action: "resultado_deixis" };
  // resultado por ENTIDAD («¿cuánto deja Falabella después de gastos?») · pase 2: cualquier entidad del alcance
  if (/despu[eé]s\s+de\s+(?:los\s+)?gastos/i.test(t)) {
    // ESPEJO (F2 · caza del espejo empresa-2): «¿cuánto dejan X y Y después de gastos?» — la repregunta del
    // deixis enseña esta forma con DOS entidades en plural y el detector singular no la entendía (en el demo
    // reclamaba de casualidad vía la cortesía del draft en etapa gastos, que con perfil pnlLineas no existe).
    // 2+ entidades CUBIERTAS del mismo eje + verbo (singular o plural) → el resultado del CONJUNTO explícito
    // (el mismo composer del deixis, sin herencia de contexto).
    const ents = _pnlEntitiesEn(t).filter((e) => e.covered);
    if (ents.length >= 2 && /\b(deja|dejan|queda|quedan|gana|ganan|aporta|aportan|rinde|rinden)\b/i.test(t)) {
      const eje0 = ents[0].eje, mismos = ents.filter((e) => e.eje === eje0);
      if (mismos.length >= 2) return { action: "resultado_deixis", _entities: { entities: mismos.map((e) => e.nombre), dimension: eje0 }, _explicit: true };
    }
    const ent = _pnlEntityEn(t);
    if (ent && /\b(deja|queda|gana|aporta|rinde)\b/i.test(t)) return { action: "resultado_entidad", entidad: ent.nombre, eje: ent.eje, covered: ent.covered };
  }
  // meta de venta («¿cuánto tengo que vender para ganar $2M después de gastos?» · pase 2: scoped — «¿cuánto
  // vender en Falabella para que me deje $500K?» · espejo: «¿qué nivel de venta necesito alcanzar…?» es la
  // pregunta clave que ADI emite en la proyección — si ADI la dice, ADI la entiende)
  if ((/\bcu[aá]nto\s+(?:tengo\s+que\s+|debo\s+|necesito\s+|tendr[ií]a\s+que\s+|hay\s+que\s+)?vender\b/i.test(t)
    || /\bqu[eé]\s+nivel\s+de\s+venta\s+(?:necesito|debo|tengo\s+que|me\s+falta|quiero)\b/i.test(t))
    && /(ganar|resultado|despu[eé]s\s+de\s+gastos|utilidad|quedar|dej[ea]|obtener)/i.test(t)) {
    const targetK = _parseTargetK(t);
    if (targetK) {
      const ent = _pnlEntityEn(t);
      return { action: "meta_venta", targetK, ...(ent ? { entidad: ent.nombre, eje: ent.eje, covered: ent.covered } : {}) };
    }
  }
  // resultado («¿cómo queda mi resultado comercial?» · «¿cuánto gano después de gastos?») · sin condicional
  if (!/\bsi\b/i.test(t)
    && (/\bresultado\s+comercial\b/i.test(t)
      || /\bresultado\s+despu[eé]s\s+de\s+(?:los\s+)?gastos\b/i.test(t)
      || (/\bc[oó]mo\s+queda\b/i.test(t) && /\bresultado\b/i.test(t))
      || /\bcu[aá]nto\s+(?:gano|me\s+queda|queda)\b[^.?!]*\bdespu[eé]s\s+de\s+(?:los\s+)?gastos\b/i.test(t)))
    return { action: "resultado" };
  return null;
}

// ── COMPOSERS · respuestas VERBATIM del flujo y las lecturas (kind "criteria": ni narrador ni gateway) ───────
import { activeCriteria } from "./criteria.js";
function _evidence(extraBol = [], ev = null) {
  const list = activeCriteria();
  const pnl = activePnl();
  const bol = [
    ...list.map((c) => fig(`Criterio · ${c.label}`, c.valueFmt, { unit: c.valueFmt.endsWith("%") ? "pct" : "count", raw: c.value, source: "computed", context: "criterio del negocio" })),
    ...pnl.map((l) => fig(`P&L · ${l.nombre}`, `${_fmtPct(l.pct)}%`, { unit: "pct", raw: l.pct, source: "computed", formula: `${_fmtPct(l.pct)}% sobre la venta`, context: l.origen === "perfil_empresa" ? "supuesto del perfil de la empresa" : "supuesto declarado" })),
    ...extraBol,
  ];
  const base = { followup: true, kind: "criteria", criteriaList: list, pnlList: pnl, boleta: bol };
  // CONEXIÓN TOTAL (pase 2 · "nada al azar"): las LECTURAS con alcance son turnos ACCIONABLES — threadean
  // lastEvidence y la memoria (entidad/entityList/dimension) manteniendo el verbatim (kind criteria manda en
  // pickNarratedText). Las administrativas (flujo/edición/recall) siguen followup:true: una edición a mitad de
  // un hilo scoped NO pisa la última lectura.
  return ev ? { ...base, followup: false, pnl: true, ...ev } : base;
}
const _resp = (text, { route = "pnl_setup", suggestions = null, bol = [], ev = null } = {}) =>
  ({ text, suggestions, sentrixAction: null, evidence: _evidence(bol, ev), route });
const _gPct = (v, label = "Supuesto %") => fig(label, `${_fmtPct(v)}%`, { unit: "pct", raw: _r1(v), source: "computed", gancho: true, context: "P&L comercial" });
const _fMoneyK = (label, vK, { mandatory = false, gancho = false } = {}) =>
  fig(label, _moneyK(vK), { unit: "money", raw: vK * 1000, mandatory, source: "computed", gancho, context: "P&L comercial" });
const _fPct = (label, v, { mandatory = false, gancho = false } = {}) =>
  fig(label, `${_fmtPct(v)}%`, { unit: "pct", raw: _r1(v), mandatory, source: "computed", gancho, context: "P&L comercial" });

// el ask de simulación de una línea (mismo formato que emite la cara Resultado · promesa gate-proven)
export function pnlSimAsk(l) {
  const t = _r1(Math.max(l.pct / 2, l.pct - 1));
  return `¿Qué pasa si bajas ${l.nombre.toLowerCase()} a ${_fmtPct(t)}%?`;
}
const _listado = (lines) => lines.map((l) => `${l.nombre.toLowerCase()} ${_fmtPct(l.pct)}%`).join(" · ");
// REGLA DE FORMATO (owner 2026-07-25 · "cada uno una línea, así se ve un orden — debería ser una regla"):
// toda enumeración de CIFRAS del P&L (líneas, propuestas, cascadas) va UNA POR LÍNEA con "·" — se lee como
// cuenta, no como párrafo. Los ecos cortos de estado (recall/start) pueden seguir inline.
const _lineasPct = (lines) => lines.map((l) => `· ${_cap(l.nombre)}: ${l.pct == null ? "(falta el %)" : `${_fmtPct(l.pct)}%`}`).join("\n");
// ANTES|AHORA de una edición (regla del owner 2026-07-25: dos columnas de números = tabla, siempre): la línea
// tocada y cómo mueve gastos y resultado — estructurada en la evidencia (mismo patrón tabla_comparada de la
// venta proyectada). Viaja con followup:true: editar a mitad de un hilo NO pisa la última lectura.
const _tablaEdicion = (nombreLinea, aPct, bPct, c0, c) => ({
  titulo: `${_cap(nombreLinea)} — antes vs. ahora`,
  cols: ["Antes", "Ahora"],
  rows: [
    { label: `Línea · ${_cap(nombreLinea)}`, a: aPct == null ? "—" : `${_fmtPct(aPct)}%`, b: bPct == null ? "—" : `${_fmtPct(bPct)}%`, strong: true },
    { label: "Gastos declarados · % sobre venta", a: `${_fmtPct(c0.sumPct)}%`, b: `${_fmtPct(c.sumPct)}%` },
    { label: "Gastos declarados", a: _moneyK(c0.totalGastosK), b: _moneyK(c.totalGastosK) },
    { label: "Resultado comercial", a: _moneyK(c0.resultadoK), b: _moneyK(c.resultadoK), strong: true, resultado: true },
    { label: "Resultado sobre venta", a: `${_fmtPct(c0.resultadoPct)}%`, b: `${_fmtPct(c.resultadoPct)}%`, pct: true },
  ],
  nota: "venta y margen de hoy constantes · lo que cambia son tus gastos declarados",
});
// las cifras del ANTES entran a la boleta (toda cifra que la tabla muestra es una cifra autorizada)
const _bolAntes = (c0) => [_fPct("Gastos · antes", c0.sumPct), _fMoneyK("Resultado · antes", c0.resultadoK), _fPct("Resultado % · antes", c0.resultadoPct)];
const _lineFigs = (lines) => lines.filter((l) => l.pct != null).map((l) => _fPct(`Línea · ${l.nombre}`, l.pct));

// resumen tipo boleta + sello (la pregunta de cierre ES la oferta que un "sí" acepta)
function _proponerSello(scenario) {
  const c = buildPnlCascade(scenario, _draft.lines);
  _draft.stage = "sello";
  const neg = c.resultadoK < 0;
  const cordura = neg
    ? `Una cordura primero: con esos porcentajes el resultado queda en ${_fmtPct(c.resultadoPct)}% (${_moneyK(c.resultadoK)}) — negativo. ¿Los revisamos? Puedes ajustar cualquier línea («cambia ${c.lines[0].nombre.toLowerCase()} a otro %») o sellarlo igual si así lo manejas.\n\n`
    : "";
  const bol = [
    ..._lineFigs(c.lines), _fPct("Gastos · total", c.sumPct),
    _fMoneyK("Ingreso", c.ingresoK), _fMoneyK("Costo", c.costoK), _fMoneyK("Carga comercial", c.cargaK),
    _fMoneyK("Gastos declarados", c.totalGastosK), _fMoneyK("Resultado comercial", c.resultadoK, { mandatory: true }), _fPct("Resultado %", c.resultadoPct),
  ];
  return _resp(
    `${cordura}Queda así, sobre la venta:\n${_lineasPct(c.lines)}\n· Gastos totales: ${_fmtPct(c.sumPct)}%\n\nCon tu dato real:\n· Ingreso: ${_moneyK(c.ingresoK)}\n· Costo: −${_moneyK(c.costoK)}\n· Carga comercial: −${_moneyK(c.cargaK)}\n· Gastos declarados: −${_moneyK(c.totalGastosK)}\n· **Resultado comercial: ${_moneyK(c.resultadoK)}** — ${_fmtPct(c.resultadoPct)}% de la venta\n\n¿Lo sello?`,
    { suggestions: ["Séllalo"], bol }
  );
}

/* ── LA CASCADA COMO TABLA (owner 2026-07-26 en vivo, sobre la captura de la pregunta clave: "ADI es el que
 * cuenta la historia, ¿dónde está acá? Sentrix muestra el dato en la mesa"): el TEXTO de toda lectura P&L narra
 * QUÉ SIGNIFICA (asesor · regla madre "ADI no muestra datos, arma decisiones") y la cuenta viaja ESTRUCTURADA
 * en la evidencia (tabla_matriz — el mismo patrón tabla_comparada que el owner aprobó para la proyección: la UI
 * la renderiza ordenada bajo el texto). Graduación a la vista: cada gasto lleva su nota de supuesto — el mismo
 * lenguaje de la cara Resultado. e = una entidad de porEntidad (scoped) · null = el negocio. ── */
function _tablaCascada(c, e = null, titulo = null) {
  const V = e || { ventaK: c.ingresoK, costoK: c.costoK, margenBrutoK: c.margenBrutoK, cargaK: c.cargaK, contribK: c.contribK, resultadoK: c.resultadoK, resultadoPct: c.resultadoPct };
  const gK = (l) => (e ? (e.ventaK * l.pct) / 100 : (c.ingresoK * l.pct) / 100);
  return {
    titulo: titulo || (e ? `P&L de ${e.nombre} — gastos prorrateados sobre su venta` : "Tu P&L comercial — la cascada completa"),
    head: "Concepto", cols: ["USD"],
    rows: [
      { label: "Ingreso", values: [_moneyK(V.ventaK)] },
      { label: "Costo", values: [`− ${_moneyK(V.costoK)}`] },
      { label: "Margen bruto", values: [_moneyK(V.margenBrutoK)] },
      { label: "Carga comercial", values: [`− ${_moneyK(V.cargaK)}`] },
      { label: "Contribución", values: [_moneyK(V.contribK)] },
      ...c.lines.map((l) => ({ label: l.nombre, values: [`− ${_moneyK(gK(l))}`],
        nota: `${l.origen === "perfil_empresa" ? "supuesto del perfil" : "supuesto declarado"} · ${_fmtPct(l.pct)}%` })),
      { label: "Resultado comercial", values: [_moneyK(V.resultadoK)], strong: true, negativo: V.resultadoK < 0 },
      { label: "Resultado sobre venta", values: [`${_fmtPct(V.resultadoPct)}%`], negativo: V.resultadoK < 0 },
    ],
    nota: e ? `prorrateo por la venta de ${e.nombre} — supuesto, no contabilidad de la entidad · cierra exacto`
      : "probado hasta la contribución · tus gastos, supuestos declarados (% sobre la venta) · cierra exacto",
  };
}

/* ── EL SELLO DEL CONTRATO EN LAS LECTURAS (auditoría del owner 2026-07-26 sobre «¿Cómo viene el P&L de mi
 * negocio?»: la lectura saltaba del CUÁNTO al qué-hacer — el movimiento 2 había desaparecido y el 3 listaba
 * tres frentes sin priorizar, con cierre vago). Los tres movimientos:
 *   02 · EL PORQUÉ: los drivers de la cascada en una frase («de cada $100 de venta, $X se van en costo…») —
 *        aritmética probada; los porqués de NEGOCIO (carga sobre target · cuentas bajo benchmark) puentean a
 *        los DETECTORES del diagnose (probados) y la causa queda ABIERTA con su oferta — jamás se inventa.
 *   03 · LA ACCIÓN PRIORIZADA: UNA primero con su $ — la mayor entre carga recuperable (detector) · margen no
 *        capturado (detector) · línea de gasto dominante (supuesto declarado) — las otras como secundarias, y
 *        el cierre es la decisión ejecutiva del contrato («¿Partimos por X ($N) o prefieres Y?»).
 * Asks reusadas gate-proven (_promise_gate · _pnl_gate las prueba por la cadena). Registro ejecutivo. ── */
const _d100 = (v) => `$${_fmtPct(Math.abs(v))}`;   // la parte de cada $100 de venta ("$71.2" · 1 decimal, como todo %)
const _f100 = (label, v) => fig(label, _d100(v), { unit: "money", raw: _r1(Math.abs(v)), source: "computed", formula: "por cada $100 de venta", context: "P&L comercial" });
const _fMoney = (label, usd, opts = {}) => fig(label, _money(usd), { unit: "money", raw: usd, source: "computed", context: "P&L comercial", ...opts });
// misma cifra citada por dos caminos (p.ej. la línea top en el frente y en la boleta base) → una sola entrada
const _dedupeBol = (figs) => { const seen = new Set(); return figs.filter((f) => { const k = `${f.label}|${f.value}`; if (seen.has(k)) return false; seen.add(k); return true; }); };
// los findings del diagnose — los MISMOS detectores de la Mesa (una verdad) · [] si no hay focos materiales
function _findings(scenario) {
  try {
    const d = composeSpecDiagnose({ filters: {}, scenario: scenario || "bonanza" });
    return (d && d.evidence && d.evidence.findings) || [];
  } catch { return []; }
}
// movimiento 2 · los drivers del NEGOCIO (aritmética probada) + la graduación en la misma frase
function _porqueGlobal(c) {
  const p = (n) => (c.ingresoK ? _r1((n / c.ingresoK) * 100) : 0);
  const costoP = p(c.costoK), cargaP = p(c.cargaK), gastoP = _r1(c.sumPct), resP = _r1(c.resultadoPct);
  const resFrase = c.resultadoK >= 0
    ? `por eso te quedan ${_d100(resP)}`
    : `por eso el resultado queda negativo: se pierden ${_d100(resP)} de cada $100`;
  return {
    text: `¿Qué explica ese resultado? De cada $100 de venta, ${_d100(costoP)} se van en el costo de los productos, ${_d100(cargaP)} en la carga comercial y ${_d100(gastoP)} en tus gastos declarados — ${resFrase}. Hasta la contribución es dato probado; los gastos son supuestos declarados por ti, así que el resultado se mueve con ellos.`,
    figs: [_f100("Base · cada $100 de venta", 100), _f100("Costo · por $100", costoP), _f100("Carga · por $100", cargaP), _f100("Gastos · por $100", gastoP), _f100("Resultado · por $100", resP)],
  };
}
// movimiento 2 scoped · por qué la entidad rinde distinto al promedio (sus drivers vs los del negocio)
function _porqueEntidad(e, c) {
  const p = (n) => (e.ventaK ? _r1((n / e.ventaK) * 100) : 0);
  const costoP = p(e.costoK), cargaP = p(e.cargaK), contribP = p(e.contribK);
  const contribNP = c.ingresoK ? _r1((c.contribK / c.ingresoK) * 100) : 0;
  const gastoP = _r1(c.sumPct);
  const resFrase = e.resultadoK >= 0
    ? `por eso su resultado es el ${_fmtPct(e.resultadoPct)}% de su venta (negocio: ${_fmtPct(c.resultadoPct)}%)`
    : `con tus supuestos, ${e.nombre} queda en negativo — su contribución no cubre los gastos prorrateados`;
  return {
    text: `De cada $100 que factura ${e.nombre}, ${_d100(costoP)} se van en costo y ${_d100(cargaP)} en carga comercial — le quedan ${_d100(contribP)} de contribución (${_d100(contribNP)} en el negocio) — y tus gastos prorrateados se llevan ${_d100(gastoP)}; ${resFrase}.`,
    figs: [_f100("Base · cada $100 de venta", 100), _f100(`Costo por $100 · ${e.nombre}`, costoP), _f100(`Carga por $100 · ${e.nombre}`, cargaP), _f100(`Contribución por $100 · ${e.nombre}`, contribP), _f100("Contribución por $100 · negocio", contribNP), _f100("Gastos · por $100", gastoP), _fPct("Resultado % · negocio", c.resultadoPct)],
  };
}
// movimiento 3 · los frentes del NEGOCIO con su $, ordenados por tamaño (detector probado · línea = supuesto)
function _frentesNegocio(scenario, c) {
  const F = _findings(scenario);
  const cg = F.find((f) => f.detector === "carga") || null;
  const mg = F.find((f) => f.detector === "margen") || null;
  const top = c.gastos.slice().sort((x, y) => y.usdK - x.usdK)[0] || null;
  const fs = [];
  if (cg && cg.subtotal_usd > 0) fs.push({
    key: "carga", usd: cg.subtotal_usd, nombre: "la carga comercial",
    accion: `recuperar la carga comercial que corre sobre tu target — el detector marca ${_money(cg.subtotal_usd)} recuperables (probado en el dato)`,
    corto: `la carga sobre el target (${_money(cg.subtotal_usd)})`,
    ask: "¿Cuánta carga comercial puedo recuperar?",
    figs: [_fMoney("Frente · carga recuperable", cg.subtotal_usd)],
  });
  if (mg && mg.subtotal_usd > 0) fs.push({
    key: "margen", usd: mg.subtotal_usd, nombre: "el margen",
    accion: `bajar a las cuentas que ceden margen — el detector marca ${_money(mg.subtotal_usd)} de contribución no capturada contra tu benchmark (probado); el porqué de negocio se ve cuenta a cuenta`,
    corto: `el margen no capturado (${_money(mg.subtotal_usd)})`,
    ask: "¿Cuánta contribución no estoy capturando?",
    figs: [_fMoney("Frente · margen no capturado", mg.subtotal_usd)],
  });
  if (top && top.usdK > 0) fs.push({
    key: "gasto", usd: top.usdK * 1000, nombre: `la línea ${top.nombre.toLowerCase()}`,
    accion: `revisar la línea que más pesa de tus gastos: ${top.nombre.toLowerCase()} (${_moneyK(top.usdK)} al año · ${_fmtPct(top.pct)}%) — es supuesto declarado: si el % real es otro, actualizarlo deja la cuenta honesta`,
    corto: `la línea que más pesa (${top.nombre.toLowerCase()} · ${_moneyK(top.usdK)})`,
    ask: pnlSimAsk(top),
    figs: [_fMoneyK(`Gasto · ${top.nombre}`, top.usdK), _fPct(`Línea · ${top.nombre}`, top.pct), _gPct(_r1(Math.max(top.pct / 2, top.pct - 1)))],
  });
  fs.sort((a, b) => b.usd - a.usd);
  return fs;
}
// movimiento 3 armado: la acción mayor abre, las otras quedan nombradas, y el cierre decide
function _mov3Global(scenario, c) {
  const fr = _frentesNegocio(scenario, c);
  if (!fr.length) return { text: "", figs: [], asks: [] };
  const [f1, ...resto] = fr;
  const despues = resto.length ? ` Después: ${resto.map((f) => f.corto).join(" y ")}.` : "";
  const cierre = resto.length
    ? `¿Partimos por ${f1.nombre} (${_money(f1.usd)}) o prefieres ${resto[0].nombre}?`
    : `¿Partimos por ${f1.nombre} (${_money(f1.usd)})?`;
  return { text: `Dónde actuar primero: ${f1.accion}.${despues}\n\n${cierre}`, figs: fr.flatMap((f) => f.figs), asks: fr.map((f) => f.ask) };
}
// movimiento 3 scoped · la acción de ESA cuenta, priorizada por $: detector sobre la entidad (probado) > la
// línea de gasto dominante prorrateada (supuesto). Los detectores miran la base (clientes) — otro eje cae a la línea.
function _accionCuenta(scenario, e, eje, c) {
  const top = c.gastos.slice().sort((x, y) => y.usdK - x.usdK)[0] || null;
  const F = eje === _BASE_EJE ? _findings(scenario) : [];
  const item = (det) => { const f = F.find((x) => x.detector === det); return (f && (f.items || []).find((i) => _norm(i.entidad) === _norm(e.nombre))) || null; };
  const itC = item("carga"), itM = item("margen");
  const out = [];
  if (itC && itC.usd > 0) out.push({
    key: "carga", usd: itC.usd,
    texto: `su carga comercial corre sobre tu target — el detector marca ${_money(itC.usd)} recuperables en ${e.nombre} (probado en el dato)`,
    corto: `la carga (${_money(itC.usd)})`,
    // la ask GENERAL del detector (gate-proven en todo escenario) — la por-cuenta solo responde para la cuenta
    // top del foco (el recommend scoped bloquea honesto por materialidad en las chicas · cazado por _pnl_gate [28])
    ask: "¿Cuánta carga comercial puedo recuperar?",
    figs: [_fMoney(`Carga recuperable · ${e.nombre}`, itC.usd)],
  });
  if (itM && itM.usd > 0) out.push({
    key: "margen", usd: itM.usd,
    texto: `está bajo tu benchmark de margen — ${_money(itM.usd)} de contribución no capturada según el detector (probado); el porqué de negocio se ve en la cuenta`,
    corto: `el margen no capturado (${_money(itM.usd)})`,
    ask: `¿Por qué ${e.nombre} cede margen?`,
    figs: [_fMoney(`No capturada · ${e.nombre}`, itM.usd)],
  });
  if (top) {
    const gUsd = (e.ventaK * top.pct / 100) * 1000;
    const simT = _r1(Math.max(top.pct / 2, top.pct - 1));
    if (gUsd > 0) out.push({
      key: "gasto", usd: gUsd,
      texto: `de tus gastos prorrateados, la línea que más pesa aquí es ${top.nombre.toLowerCase()} (${_money(gUsd)} · supuesto declarado)`,
      corto: `${top.nombre.toLowerCase()} (${_money(gUsd)})`,
      ask: `¿Qué pasa si bajas ${top.nombre.toLowerCase()} a ${_fmtPct(simT)}% en ${e.nombre}?`,
      figs: [_fMoney(`Gasto ${top.nombre} · ${e.nombre}`, gUsd), _gPct(simT)],
    });
  }
  out.sort((a, b) => b.usd - a.usd);
  return out;
}

/* ── EL ANÁLISIS DEL CONTRATO (owner 2026-07-26 verbatim: "cuando me dice lo sello, debería darme el análisis
 * como lo tenemos en contrato") · UNA verdad para la lectura «resultado» Y para el sello: los TRES movimientos
 * (cuánto queda → qué lo explica, graduado → dónde actuar primero con su $ y el cierre en decisión) — con la
 * cascada completa en la TABLA (historia en el texto, dato ordenado abajo y editable en la Mesa). ── */
function _analisisResultado(scenario) {
  const c = buildPnlCascade(scenario);
  _scope = { dimension: _BASE_EJE, entity: null, entities: null, global: true };   // hilo vivo: "¿y el de Ripley?" / "volvamos al P&L"
  const top = c.gastos.slice().sort((x, y) => y.usdK - x.usdK)[0];
  const pq = _porqueGlobal(c);
  const m3 = _mov3Global(scenario, c);
  const bol = _dedupeBol([
    _fMoneyK("Resultado comercial", c.resultadoK, { mandatory: true }), _fPct("Resultado %", c.resultadoPct, { mandatory: true }),
    _fMoneyK("Ingreso", c.ingresoK), _fMoneyK("Costo", c.costoK), _fMoneyK("Margen bruto", c.margenBrutoK),
    _fMoneyK("Carga comercial", c.cargaK), _fMoneyK("Contribución", c.contribK), _fMoneyK("Gastos declarados", c.totalGastosK),
    _fPct("Gastos · total", c.sumPct), _fMoneyK(`Gasto · ${top.nombre}`, top.usdK), _fPct(`Línea · ${top.nombre}`, top.pct),
    ..._lineFigs(c.lines.filter((l) => l.nombre !== top.nombre)),
    _gPct(_r1(Math.max(top.pct / 2, top.pct - 1))),
    ...pq.figs, ...m3.figs,
  ]);
  const neg = c.resultadoK < 0 ? ` Ojo: el resultado es negativo con los supuestos declarados — vale revisar las líneas antes que la venta.` : "";
  // LOS TRES MOVIMIENTOS (historia primero + sello del contrato): cuánto queda → qué lo explica (drivers,
  // graduado) → dónde actuar primero con su $ y el cierre en decisión. La cascada viaja en la TABLA (ev.tablaM).
  const text = `Tu resultado comercial: ${_moneyK(c.resultadoK)} al año — el ${_fmtPct(c.resultadoPct)}% de tu venta queda contigo después del costo, la carga comercial y tus gastos declarados (${_fmtPct(c.sumPct)}%).\n\n${pq.text}${neg}${m3.text ? `\n\n${m3.text}` : ""}`;
  const asks = [...new Set([...m3.asks, "¿Qué línea pesa más en el resultado?"])].slice(0, 3);
  return { c, top, bol, text, tablaM: _tablaCascada(c), asks };
}

/* composePnl(pi, ctx, state) → respuesta finalizada (shape de la UI). pi = el intent del detector (o null si el
 * LLM #1 clasificó pnl_setup sin red — se resuelve por estado: draft → re-preguntar la etapa · líneas → resultado ·
 * nada → start). El scenario viaja en state (como el resto del camino conversacional). */
export function composePnl(pi, ctx = null, state = {}) {
  const scenario = (state && state.scenario) || "bonanza";
  // claim del LLM #1 CON ALCANCE (specTool: pnl { entity?, dimension? } — sin action): se normaliza acá contra
  // el canon — el LLM entiende QUÉ quiere el usuario; ADI decide si SE PUEDE y con los nombres reales del dato.
  if (pi && !pi.action && pi.intent === "perdiendo") pi = { action: "perdiendo" };
  if (pi && !pi.action && (pi.entity || pi.dimension)) {
    if (pi.entity && /\bnegocio\b/i.test(String(pi.entity))) pi = { action: _lines.length ? "resultado" : "start" };
    else if (pi.entity) {
      const c = _pnlEntityEn(String(pi.entity));
      pi = c ? { action: "resultado_scoped", entidad: c.nombre, eje: c.eje, covered: c.covered } : { action: "scoped_missing", pedido: String(pi.entity) };
    } else if (pi.dimension === "negocio") pi = { action: _lines.length ? "resultado" : "start" };
    else if (ENTITIES[pi.dimension]) pi = { action: "tabla_eje", eje: pi.dimension };
    else pi = null;
  }
  if (!pi || !pi.action) {
    if (_draft) pi = { action: _draft.stage === "gastos" ? "draft_help" : _draft.stage === "pcts" ? "draft_reask" : "draft_stay" };
    // con ALCANCE VIVO, la vuelta sin señal retoma el último alcance (pase 2 · "recuerda lo anterior")
    else pi = { action: _lines.length ? (_scope ? "volver" : "resultado") : "start" };
  }
  const a = pi.action;

  // ── FLUJO GUIADO ──
  if (a === "start") {
    // F2 · líneas del PERFIL sin declaración del usuario: «armemos mi P&L» abre el REARME guiado sobre esa base
    // (no el eco "ya está armado" — su «olvida mi P&L para partir de cero» sería promesa falsa: el forget vuelve
    // al perfil, nunca a cero). El usuario manda sus % o su estructura y al sellar queda SU declaración encima.
    if (_lines.length && !_declared) {
      _draft = { stage: "pcts", lines: _lines.map((l) => ({ nombre: l.nombre, pct: null })) };
      const nombres = _lines.map((l) => l.nombre.toLowerCase());
      return _resp(
        `Tu P&L ya mide con los supuestos del perfil de tu empresa: ${_listado(_lines)}. Armemos el tuyo sobre esa base — dime qué % le pongo a cada línea («${nombres[0]} al 2%» o en orden: «2, 1.5»), o nómbrame otra estructura de gastos («administrativos, fletes, comisiones») y parto de esas líneas. El perfil sigue midiendo hasta que selles el tuyo.`,
        { bol: [..._lineFigs(_lines), _gPct(2), _gPct(1.5)] }
      );
    }
    if (_lines.length) {
      const c = buildPnlCascade(scenario);
      return _resp(
        `Tu P&L comercial ya está armado: ${_listado(c.lines)} — ${_fmtPct(c.sumPct)}% sobre la venta, y el resultado queda en ${_moneyK(c.resultadoK)} (${_fmtPct(c.resultadoPct)}% de la venta). ¿Quieres ajustarlo? «cambia ${c.lines[0].nombre.toLowerCase()} a otro %» · «agrega una línea con su %» · «saca una línea» — o «olvida mi P&L» para partir de cero.`,
        { suggestions: ["¿Cómo queda mi resultado comercial?", "¿Qué línea pesa más en el resultado?"], bol: [_fPct("Gastos · total", c.sumPct), _fMoneyK("Resultado comercial", c.resultadoK, { mandatory: true }), _fPct("Resultado %", c.resultadoPct), ..._lineFigs(c.lines)] }
      );
    }
    _draft = { stage: "gastos", lines: [] };
    return _resp(
      `Armemos tu P&L comercial. Del dato ya tengo el ingreso, el costo y la carga comercial — falta tu estructura de gastos.\n\n¿Qué gastos quieres considerar? Nómbralos como los manejas tú — por ejemplo: administrativos, logística, marketing, promotores. Si quieres, dame los porcentajes de una («logística 3%, marketing 1.5%»).`,
      { bol: [_gPct(3), _gPct(1.5)] }
    );
  }
  // RE-ARME GUIADO (owner 2026-07-25 · "es el mismo camino dicho de una manera diferente, y ADI debe guiar"):
  // reabre el flujo en la etapa de % con TUS líneas — el sellado vigente sigue midiendo hasta el sello nuevo.
  if (a === "rearmar") {
    if (!_lines.length) return composePnl({ action: "start" }, ctx, state);
    _draft = { stage: "pcts", lines: _lines.map((l) => ({ nombre: l.nombre, pct: null })) };
    const nombres = _lines.map((l) => l.nombre.toLowerCase());
    return _resp(
      `Armemos tus nuevos supuestos — el mismo camino, tú mandas los números. Hoy va: ${_listado(_lines)}. Dime qué % le pongo a cada línea esta vez, en orden («2, 1, 1.5») o línea por línea («${nombres[0]} al 2%»). ¿Prefieres otra estructura? Nómbrame los gastos de nuevo («administrativos, fletes, comisiones») y parto de esas líneas. Tu P&L vigente sigue midiendo hasta que selles el nuevo.`,
      { bol: [..._lineFigs(_lines), _gPct(2), _gPct(1), _gPct(1.5)] }
    );
  }
  if (a === "draft_help")
    return _resp(`Los gastos que manejes tú — los nombres son tuyos, no un catálogo. Ejemplos comunes: administrativos, logística, marketing, promotores, publicidad, bodegaje. Nómbralos (con o sin su %) y seguimos.`);
  if (a === "draft_cancel") {
    _draft = null;
    return _resp(`Listo, lo dejamos acá — no guardé nada. Cuando quieras lo retomamos: «armemos mi P&L».`);
  }
  if (a === "draft_gastos") {
    _draft = { stage: "pcts", lines: pi.lines.map((l) => ({ ...l })) };
    if (_draft.lines.every((l) => l.pct != null)) return _proponerSello(scenario);
    const conPct = _draft.lines.filter((l) => l.pct != null);
    const sinPct = _draft.lines.filter((l) => l.pct == null);
    const pide = conPct.length
      ? `Me falta el % de ${sinPct.map((l) => l.nombre.toLowerCase()).join(", ")}.`
      : `¿Qué % le asigno a cada uno, sobre la venta? Puedes dármelos en el mismo orden («3, 1.5, 2») o línea por línea («${sinPct[0].nombre.toLowerCase()} al 2%»).`;
    return _resp(`Anotado:\n${_lineasPct(_draft.lines)}\n\n${pide}`, { bol: [..._lineFigs(conPct), _gPct(3), _gPct(1.5), _gPct(2)] });
  }
  if (a === "draft_pcts") {
    _draft.lines = pi.lines.map((l) => ({ ...l }));
    if (_draft.lines.every((l) => l.pct != null)) return _proponerSello(scenario);
    const sinPct = _draft.lines.filter((l) => l.pct == null);
    return _resp(`Anotado. Me falta el % de ${sinPct.map((l) => l.nombre.toLowerCase()).join(", ")} — dímelo y te muestro cómo queda.`, { bol: _lineFigs(_draft.lines) });
  }
  if (a === "draft_reask") {
    const sinPct = _draft.lines.filter((l) => l.pct == null);
    const quien = sinPct.length ? sinPct : _draft.lines;
    return _resp(`Seguimos con tu P&L: me falta el % de ${quien.map((l) => l.nombre.toLowerCase()).join(", ")}, sobre la venta.`, { bol: _lineFigs(_draft.lines) });
  }
  if (a === "draft_edit") {
    const l = _findLine(pi.nombre, _draft.lines);
    if (l && _validLine({ nombre: l.nombre, pct: pi.pct })) { l.pct = _r1(pi.pct); return _proponerSello(scenario); }
    return _resp(`Ese porcentaje no me cierra para ${pi.nombre.toLowerCase()} — dame un valor entre 0.1% y 50% y sigo.`, { bol: [_gPct(0.1), _gPct(50)] });
  }
  if (a === "draft_edit_reask") {
    const l = _findLine(pi.nombre, _draft ? _draft.lines : null);
    return _resp(`Dime el porcentaje y lo muevo: «cambia ${String(pi.nombre).toLowerCase()} a 2%».${l && l.pct != null ? ` Hoy ${l.nombre.toLowerCase()} va en ${_fmtPct(l.pct)}%.` : ""}`,
      { bol: [_gPct(2), ...(l && l.pct != null ? [_fPct(`Línea · ${l.nombre}`, l.pct)] : [])] });
  }
  if (a === "draft_stay") {
    const c = buildPnlCascade(scenario, _draft.lines);
    return _resp(`Bien — dime qué ajusto («cambia ${c.lines[0].nombre.toLowerCase()} a otro %») o dime «cancelar» y lo dejamos sin guardar. Hoy va: ${_listado(c.lines)}.`, { bol: _lineFigs(c.lines) });
  }
  if (a === "draft_sello") {
    const lines = _draft.lines.filter((l) => l.pct != null);
    const r = setPnlLines(lines);
    _draft = null;
    if (!r.ok) return _resp(`No pude sellar el P&L — me faltan líneas válidas. Retomemos: «armemos mi P&L».`);
    // EL SELLO ENTREGA EL ANÁLISIS (owner 2026-07-26 verbatim: "cuando me dice lo sello, debería darme el
    // análisis como lo tenemos en contrato, y en Sentrix permitirme verlo ordenado y con los supuestos con
    // opción de cambiarlos — eso fue lo que hablamos"): una línea de acuse y de ahí la lectura completa —
    // la MISMA cascada graduada, línea que más pesa y simulación sugerida de «¿cómo queda mi resultado
    // comercial?» (byte-igual · _analisisResultado), sin pedir "muéstramelo" aparte. La evidencia viaja
    // accionable: el deep-link abre la Mesa en la cara Resultado, donde los supuestos se editan directo.
    const an = _analisisResultado(scenario);
    return _resp(
      `Sellado — tus gastos quedaron declarados (${_fmtPct(an.c.sumPct)}% sobre la venta) y miden desde ahora en cada lectura.\n\n${an.text}`,
      { route: "pnl_setup", suggestions: an.asks, bol: an.bol, ev: { dimension: _BASE_EJE, tablaM: an.tablaM } }
    );
  }

  // ── EDICIÓN de líneas guardadas (conversando · una verdad) ──
  if (a === "edit_set") {
    const l = _findLine(pi.nombre);
    if (!l) return _resp(`No tengo una línea «${pi.nombre.toLowerCase()}» en tu P&L. Hoy va: ${_listado(_lines)}.`, { bol: _lineFigs(_lines) });
    if (!_validLine({ nombre: l.nombre, pct: pi.pct })) return _resp(`Ese porcentaje no me cierra para ${l.nombre.toLowerCase()} — dame un valor entre 0.1% y 50%.`, { bol: [_gPct(0.1), _gPct(50)] });
    const prev = l.pct;
    const c0 = buildPnlCascade(scenario);   // el ANTES (con el % vigente) — para la tabla comparada
    editPnlLine(l.nombre, pi.pct);   // la MISMA primitiva que usa la cara Resultado (una verdad)
    const c = buildPnlCascade(scenario);
    return _resp(
      `Listo — ${l.nombre.toLowerCase()} pasa de ${_fmtPct(prev)}% a ${_fmtPct(_r1(pi.pct))}%. Con eso, el resultado comercial queda en ${_moneyK(c.resultadoK)} (${_fmtPct(c.resultadoPct)}% de la venta) con ${_fmtPct(c.sumPct)}% de gastos totales.`,
      { suggestions: ["¿Cómo queda mi resultado comercial?"], bol: [_fPct("Anterior", prev, { gancho: true }), _fPct("Nuevo", _r1(pi.pct)), _fMoneyK("Resultado comercial", c.resultadoK, { mandatory: true }), _fPct("Resultado %", c.resultadoPct), _fPct("Gastos · total", c.sumPct), ..._bolAntes(c0)],
        ev: { tabla: _tablaEdicion(l.nombre, prev, _r1(pi.pct), c0, c), followup: true } }
    );
  }
  if (a === "edit_reask") {
    const l = _findLine(pi.nombre);
    if (!l) return _resp(`No tengo una línea «${String(pi.nombre || "").toLowerCase()}» en tu P&L. Hoy va: ${_listado(_lines)}.`, { bol: _lineFigs(_lines) });
    return _resp(`Dime el porcentaje y la muevo: «cambia ${l.nombre.toLowerCase()} a 2%». Hoy ${l.nombre.toLowerCase()} va en ${_fmtPct(l.pct)}% sobre la venta.`, { bol: [_fPct(`Línea · ${l.nombre}`, l.pct), _gPct(2)] });
  }
  if (a === "edit_add" || a === "edit_add_nopct") {
    if (a === "edit_add_nopct") return _resp(`Dímelo con su % sobre la venta y lo agrego: «agrega ${pi.nombre.toLowerCase()} 1.5%».`, { bol: [_gPct(1.5)] });
    if (_findLine(pi.nombre)) return _resp(`${_cap(pi.nombre.toLowerCase())} ya está en tu P&L — si quieres moverla: «cambia ${pi.nombre.toLowerCase()} a ${_fmtPct(pi.pct)}%».`, { bol: [_gPct(pi.pct)] });
    if (!_validLine({ nombre: pi.nombre, pct: pi.pct })) return _resp(`Ese porcentaje no me cierra — dame un valor entre 0.1% y 50%.`, { bol: [_gPct(0.1), _gPct(50)] });
    if (_lines.length >= 10) return _resp(`Tu P&L ya tiene 10 líneas de gasto — el tope de esta versión. Saca una («saca ${_lines[0].nombre.toLowerCase()}») y agregamos la nueva.`, { bol: _lineFigs(_lines) });
    const c0 = buildPnlCascade(scenario);   // el ANTES (sin la línea nueva)
    addPnlLine(pi.nombre, pi.pct);   // la MISMA primitiva que usa la cara Resultado (una verdad)
    const c = buildPnlCascade(scenario);
    return _resp(
      `Agregada: ${pi.nombre.toLowerCase()} ${_fmtPct(_r1(pi.pct))}% sobre la venta. Tu P&L queda con ${_fmtPct(c.sumPct)}% de gastos y el resultado comercial en ${_moneyK(c.resultadoK)} (${_fmtPct(c.resultadoPct)}% de la venta).`,
      { suggestions: ["¿Cómo queda mi resultado comercial?"], bol: [_fPct(`Línea · ${_cap(pi.nombre)}`, _r1(pi.pct)), _fPct("Gastos · total", c.sumPct), _fMoneyK("Resultado comercial", c.resultadoK, { mandatory: true }), _fPct("Resultado %", c.resultadoPct), ..._bolAntes(c0)],
        ev: { tabla: _tablaEdicion(pi.nombre, null, _r1(pi.pct), c0, c), followup: true } }
    );
  }
  if (a === "edit_remove") {
    const l = _findLine(pi.nombre);
    if (!l) return _resp(`No tengo una línea «${pi.nombre.toLowerCase()}» en tu P&L. Hoy va: ${_listado(_lines)}.`, { bol: _lineFigs(_lines) });
    if (_lines.length === 1) {
      removePnlLine(l.nombre);   // la MISMA primitiva que usa la cara Resultado (una verdad) — era la última: clearPnl
      return _resp(`Saqué ${l.nombre.toLowerCase()} — era la última línea, así que tu P&L quedó vacío y la cara Resultado vuelve a su punto de partida. Cuando quieras: «armemos mi P&L».`);
    }
    const c0 = buildPnlCascade(scenario);   // el ANTES (con la línea todavía adentro)
    removePnlLine(l.nombre);
    const c = buildPnlCascade(scenario);
    return _resp(
      `Saqué ${l.nombre.toLowerCase()} (${_fmtPct(l.pct)}%). Tu P&L queda: ${_listado(c.lines)} — ${_fmtPct(c.sumPct)}% en total, y el resultado comercial en ${_moneyK(c.resultadoK)} (${_fmtPct(c.resultadoPct)}% de la venta).`,
      { suggestions: ["¿Cómo queda mi resultado comercial?"], bol: [_fPct(`Línea · ${l.nombre}`, l.pct, { gancho: true }), ..._lineFigs(c.lines), _fPct("Gastos · total", c.sumPct), _fMoneyK("Resultado comercial", c.resultadoK, { mandatory: true }), _fPct("Resultado %", c.resultadoPct), ..._bolAntes(c0)],
        ev: { tabla: _tablaEdicion(l.nombre, l.pct, null, c0, c), followup: true } }
    );
  }
  if (a === "forget") {
    const r = clearPnl();
    resetPnlDraft();
    // F2: si el PERFIL de la empresa trae defaults, «olvidá» quita TU declaración y esa base vuelve a medir —
    // se declara honesto (con el demo, sin defaults, los textos de siempre byte-iguales).
    if (r.perfil && r.perfil.length) return _resp(r.had
      ? `Listo, olvidé tus líneas declaradas. Tu P&L vuelve a los supuestos del perfil de tu empresa: ${_listado(r.perfil)} — sigue midiendo con esos. Para declarar los tuyos: «armemos mi P&L».`
      : `No tenía una declaración tuya que olvidar: tus líneas vienen del perfil de tu empresa (${_listado(r.perfil)}) y esa base se mantiene. Para declarar las tuyas: «armemos mi P&L».`);
    return _resp(r.had
      ? `Listo, olvidé tu P&L comercial: las líneas de gasto quedaron fuera y la cara Resultado vuelve a su punto de partida. Cuando quieras rearmarlo: «armemos mi P&L».`
      : `No tengo un P&L guardado — estás midiendo hasta la contribución. ¿Armamos tu P&L ahora?`);
  }
  if (a === "recall") {
    if (!_lines.length) return _resp(`Todavía no armamos tu P&L comercial: sin tus líneas de gasto, lo que puedo mostrarte llega hasta la contribución. ¿Armamos tu P&L ahora?`);
    const c = buildPnlCascade(scenario);
    const _origen = _declared
      ? "cada línea como supuesto declarado (cuando llegue el dato contable real, se reemplaza línea a línea)"
      : "las líneas vienen del perfil de tu empresa como supuestos (declara las tuyas y las pisan)";
    return _resp(
      `Tu P&L comercial: ${_listado(c.lines)} — ${_fmtPct(c.sumPct)}% sobre la venta, ${_origen}. Con el dato de hoy, el resultado comercial queda en ${_moneyK(c.resultadoK)} (${_fmtPct(c.resultadoPct)}% de la venta). Para ajustar: «cambia ${c.lines[0].nombre.toLowerCase()} a otro %» · «saca una línea» · «agrega una línea con su %».`,
      { suggestions: ["¿Cómo queda mi resultado comercial?", "¿Qué línea pesa más en el resultado?"], bol: [..._lineFigs(c.lines), _fPct("Gastos · total", c.sumPct), _fMoneyK("Resultado comercial", c.resultadoK, { mandatory: true }), _fPct("Resultado %", c.resultadoPct)] }
    );
  }

  // ── LECTURAS (cascada determinística · el sello entender→explicar→actuar en una respuesta) ──
  const sinPnl = () => {
    // GUÍA (owner 2026-07-25 "ADI debe guiar preguntando supuestos, todo en el chat"): la oferta ABRE el flujo —
    // el próximo mensaje con nombres de gastos ya fluye (gastos→%→sello); cualquier otro tema sigue su curso.
    _draft = { stage: "gastos", lines: [] };
    return _resp(`Esa cuenta llega hasta la contribución: todavía no tengo tus líneas de gasto, así que no hay resultado después de gastos que afirmar. ¿Armamos tu P&L ahora? Dime qué gastos quieres considerar y los porcentajes los definimos juntos.`, { route: "pnl_reading" });
  };
  const _EJE_LBL = (eje) => (ENTITIES[eje] && ENTITIES[eje].label) || { sing: String(eje), plur: `${eje}s` };

  // ── LA PREGUNTA CLAVE DEL INICIO (owner 2026-07-25): "¿dónde estoy perdiendo dinero?" = la historia del
  // P&L del negocio, de punta a punta — y sin gastos declarados, ADI GUÍA los supuestos ahí mismo. ──
  if (a === "perdiendo") {
    const c = buildPnlCascade(scenario);
    if (!_lines.length) {
      _draft = { stage: "gastos", lines: [] };
      const bol = [
        _fMoneyK("Ingreso", c.ingresoK, { mandatory: true }), _fMoneyK("Costo", c.costoK),
        _fMoneyK("Carga comercial", c.cargaK), _fMoneyK("Contribución", c.contribK, { mandatory: true }),
      ];
      // HISTORIA PRIMERO: el texto cuenta hasta dónde llega el dato y qué falta; la cuenta viaja en la tabla.
      const tSin = {
        titulo: "Dónde está el dinero — hasta donde llega el dato", head: "Concepto", cols: ["USD"],
        rows: [
          { label: "Venta del año", values: [_moneyK(c.ingresoK)] },
          { label: "Costo de los productos", values: [`− ${_moneyK(c.costoK)}`] },
          { label: "Carga comercial", values: [`− ${_moneyK(c.cargaK)}`] },
          { label: "Contribución", values: [_moneyK(c.contribK)], strong: true },
        ],
        nota: "hasta aquí todo es dato real — faltan tus líneas de gasto para llegar al resultado",
      };
      return _resp(
        `Te muestro dónde está el dinero, con los datos actuales del negocio: de ${_moneyK(c.ingresoK)} de venta quedan ${_moneyK(c.contribK)} de contribución después del costo y la carga comercial — hasta aquí, todo es dato real.\n\nEn los datos actuales ya se ven dos fugas: parte de esa carga comercial se puede recuperar, y hay cuentas vendiendo con un margen más bajo que el resto.\n\nPara decirte cuánto te queda DE VERDAD me falta un dato tuyo: tus gastos. Armémoslo ahora — dime qué gastos quieres considerar (administrativos, logística, promotores… como los manejes tú) y después te pregunto el porcentaje de cada uno.`,
        { route: "pnl_reading", suggestions: ["¿Cuánta carga comercial puedo recuperar?", "¿Cuánta contribución no estoy capturando?"], bol, ev: { dimension: _BASE_EJE, tablaM: tSin } }
      );
    }
    _scope = { dimension: _BASE_EJE, entity: null, entities: null, global: true };
    const topP = c.gastos.slice().sort((x, y) => y.usdK - x.usdK)[0];
    const pqP = _porqueGlobal(c);
    const m3P = _mov3Global(scenario, c);
    // el ingreso dejó de ser obligatorio EN EL TEXTO (historia primero: vive en la tabla y en la boleta)
    const bol = _dedupeBol([
      _fMoneyK("Ingreso", c.ingresoK), _fMoneyK("Costo", c.costoK),
      _fMoneyK("Carga comercial", c.cargaK), _fMoneyK("Contribución", c.contribK),
      _fMoneyK("Gastos declarados", c.totalGastosK), _fPct("Gastos · total", c.sumPct),
      _fMoneyK("Resultado comercial", c.resultadoK, { mandatory: true }), _fPct("Resultado %", c.resultadoPct),
      ...(topP ? [_fMoneyK(`Gasto · ${topP.nombre}`, topP.usdK), _fPct(`Línea · ${topP.nombre}`, topP.pct)] : []),
      ...pqP.figs, ...m3P.figs,
    ]);
    // LOS TRES MOVIMIENTOS (la captura del owner 2026-07-26 era ESTA respuesta · auditoría del sello): qué te
    // queda → qué lo explica (drivers, graduado) → dónde actuar primero con su $ y el cierre en decisión. La
    // cascada de punta a punta viaja en la tabla, no en el texto. Registro ejecutivo enforced (_registro_gate).
    return _resp(
      `**Te quedan ${_moneyK(c.resultadoK)} al año** — el ${_fmtPct(c.resultadoPct)}% de tu venta, después del costo de los productos, la carga comercial y tus gastos declarados (${_fmtPct(c.sumPct)}%).\n\n${pqP.text}${m3P.text ? `\n\n${m3P.text}` : ""}`,
      { route: "pnl_reading", suggestions: m3P.asks.length ? m3P.asks.slice(0, 3) : ["¿Qué línea pesa más en el resultado?"], bol, ev: { dimension: _BASE_EJE, tablaM: _tablaCascada(c, null, "Tu dinero, de punta a punta") } }
    );
  }
  // ── ALCANCE (PASE 2) · volver / P&L de una entidad / la tabla del eje / deixis / entidad desconocida ──
  if (a === "volver") {
    if (!_lines.length) return sinPnl();
    if (_scope && _scope.entity) return composePnl({ action: "resultado_scoped", entidad: _scope.entity, eje: _scope.dimension, covered: true, _retoma: true }, ctx, state);
    if (_scope && _scope.entities && _scope.entities.length) return composePnl({ action: "resultado_deixis", _entities: { entities: _scope.entities, dimension: _scope.dimension }, _retoma: true }, ctx, state);
    if (_scope && _scope.dimension && !_scope.global) return composePnl({ action: "tabla_eje", eje: _scope.dimension, _retoma: true }, ctx, state);
    return composePnl({ action: "resultado" }, ctx, state);
  }
  if (a === "scoped_missing") {
    const primero = pnlEjesDisponibles()[0];
    return _resp(
      `No tengo a «${String(pi.pedido || "").trim()}» en el alcance del P&L — está armado sobre la venta por ${_dondeSi()}. Dime la entidad como aparece en tu cartera o pídeme la tabla completa: «P&L por ${primero.label.sing}».`,
      { route: "pnl_reading", suggestions: [`P&L por ${primero.label.sing}`, "P&L del negocio"] }
    );
  }
  if (a === "resultado_scoped") {
    if (!_lines.length) return sinPnl();
    const eje = (pi.eje && ENTITIES[pi.eje]) ? pi.eje : _BASE_EJE;
    if (pi.covered === false) {
      // entidad del CONTRATO sin venta desglosada en la base (ej. una marca que no vende por cliente en el dato):
      // el pedido se entiende y se responde honesto — JAMÁS prorratear sobre venta que el dato no desglosa.
      const covered = buildPnlCascade(scenario, null, { dimension: eje }).porEntidad.map((x) => x.nombre);
      return _resp(
        `El P&L de ${pi.entidad} no lo puedo armar con rigor: el P&L ancla en la venta desglosada por ${_EJE_LBL(_BASE_EJE).sing}, y ${pi.entidad} no tiene esa venta en el dato — prorratear tus gastos ahí sería inventar. Sí puedo darte su margen o su contribución como siempre, o el P&L de ${covered.length ? covered.slice(0, 3).join(", ") : _dondeSi()}. ¿Cuál te sirve?`,
        { route: "pnl_reading", suggestions: [`¿Cómo está ${pi.entidad}?`, ...(covered.length ? [`P&L de ${covered[0]}`] : [])] }
      );
    }
    const c = buildPnlCascade(scenario, null, { dimension: eje });
    const e = c.porEntidad.find((x) => _norm(x.nombre) === _norm(pi.entidad));
    if (!e) return _resp(`A ${pi.entidad} no lo tengo en el dato vigente del P&L. Hoy puedo armarlo por ${_dondeSi()} o del negocio completo.`, { route: "pnl_reading", suggestions: ["P&L del negocio"] });
    _scope = { dimension: eje, entity: e.nombre, entities: null };
    const otros = c.porEntidad.filter((x) => x.nombre !== e.nombre);
    const share = c.resultadoK > 0 && e.resultadoK > 0 ? _r1((e.resultadoK / c.resultadoK) * 100) : null;
    // EL SELLO PROPORCIONAL (auditoría del owner 2026-07-26): su cifra → por qué rinde distinto al promedio
    // (drivers de la entidad, graduado) → la acción de ESA cuenta priorizada por $ + cierre en decisión.
    const pqE = _porqueEntidad(e, c);
    const acc = _accionCuenta(scenario, e, eje, c);
    const a1 = acc[0] || null;
    const accTxt = a1 ? `Dónde actuar en ${e.nombre}: ${a1.texto}.${acc[1] ? ` Después: ${acc[1].corto}.` : ""}` : "";
    const cierre = a1
      ? (otros.length ? `¿Partimos por ahí (${_money(a1.usd)}) o seguimos con «P&L de ${otros[0].nombre}»?` : `¿Partimos por ahí (${_money(a1.usd)})?`)
      : (otros.length ? `¿Seguimos con «P&L de ${otros[0].nombre}»?` : "");
    const bol = _dedupeBol([
      _fMoneyK(`Resultado · ${e.nombre}`, e.resultadoK, { mandatory: true }), _fPct(`Resultado % · ${e.nombre}`, e.resultadoPct),
      _fMoneyK(`Ingreso · ${e.nombre}`, e.ventaK), _fMoneyK(`Costo · ${e.nombre}`, e.costoK),
      _fMoneyK(`Margen bruto · ${e.nombre}`, e.margenBrutoK), _fMoneyK(`Carga comercial · ${e.nombre}`, e.cargaK),
      _fMoneyK(`Contribución · ${e.nombre}`, e.contribK), _fMoneyK(`Gastos prorrateados · ${e.nombre}`, e.gastoK),
      _fPct("Gastos · total", c.sumPct),
      ...(share != null ? [_fPct("Peso en el resultado", share), _fMoneyK("Resultado del negocio", c.resultadoK)] : []),
      ...pqE.figs, ...acc.flatMap((x) => x.figs),
    ]);
    return _resp(
      `${pi._retoma ? `Retomo tu P&L donde lo dejamos — ${e.nombre}.\n\n` : ""}**El P&L de ${e.nombre}: te deja ${_moneyK(e.resultadoK)} al año** — el ${_fmtPct(e.resultadoPct)}% de su venta (${_moneyK(e.ventaK)}), con tus gastos prorrateados (${_fmtPct(c.sumPct)}%).${share != null ? ` Aporta el ${_fmtPct(share)}% del resultado del negocio (${_moneyK(c.resultadoK)}).` : ""}\n\n¿Por qué rinde eso? ${pqE.text} Hasta la contribución es dato probado; los gastos son tus supuestos declarados prorrateados sobre su venta — no contabilidad de ${e.nombre}.${accTxt ? `\n\n${accTxt}\n\n${cierre}` : ""}`,
      { route: "pnl_reading", suggestions: [...new Set([...(a1 && a1.ask ? [a1.ask] : []), ...(otros.length ? [`P&L de ${otros[0].nombre}`] : []), ...(acc[1] && acc[1].ask ? [acc[1].ask] : [])])].slice(0, 3), bol, ev: { entidad: e.nombre, entityType: eje, dimension: eje, tablaM: _tablaCascada(c, e) } }
    );
  }
  if (a === "tabla_eje") {
    if (!_lines.length) return sinPnl();
    const d = _dispoDe(pi.eje);
    const pedido = String(pi.pedido || (d ? d.label.sing : pi.eje || "ese eje")).replace(/^sku$/i, "SKU");
    if (!d || !d.available) {
      // REDIRECT que se adueña (doctrina fuera-de-dato): declara el límite REAL del dato y abre el camino donde SÍ.
      const si = pnlEjesDisponibles().map((x) => x.label.sing);
      return _resp(
        `El P&L por ${pedido} no lo puedo armar — ${d ? d.motivo : "no tengo ese eje en el dato"}. Sí puedo dártelo por ${si.length > 1 ? `${si.slice(0, -1).join(", ")} o ${si[si.length - 1]}` : si[0]}, o del negocio completo. ¿Cuál te sirve?`,
        { route: "pnl_reading", suggestions: [...si.slice(0, 2).map((x) => `P&L por ${x}`), "P&L del negocio"] }
      );
    }
    const eje = d.eje, lbl = d.label;
    const c = buildPnlCascade(scenario, null, { dimension: eje });
    const rows = c.porEntidad.slice().sort((x, y) => y.resultadoK - x.resultadoK);
    const MAXN = 6;
    const listadas = rows.length > MAXN ? rows.slice(0, MAXN - 1) : rows;
    const resto = rows.length > MAXN ? rows.slice(MAXN - 1) : [];
    const restoK = resto.reduce((acc, x) => acc + x.resultadoK, 0);
    _scope = { dimension: eje, entity: null, entities: null };
    const negs = rows.filter((x) => x.resultadoK < 0);
    const restoVK = resto.reduce((acc, x) => acc + x.ventaK, 0), restoGK = resto.reduce((acc, x) => acc + x.gastoK, 0);
    // HISTORIA PRIMERO: el texto sintetiza (quién encabeza · Σ == negocio · negativos); las filas van en la tabla.
    const tEje = {
      titulo: `Tu P&L por ${lbl.sing} — resultado después de gastos`, head: _cap(lbl.sing),
      cols: ["Venta", "Gastos", "Resultado", "Res. %"],
      rows: [
        ...listadas.map((x) => ({ label: x.nombre, values: [_moneyK(x.ventaK), `− ${_moneyK(x.gastoK)}`, _moneyK(x.resultadoK), `${_fmtPct(x.resultadoPct)}%`], negativo: x.resultadoK < 0 })),
        ...(resto.length ? [{ label: `…y ${resto.length} más`, values: [_moneyK(restoVK), `− ${_moneyK(restoGK)}`, _moneyK(restoK), "—"] }] : []),
        { label: "Total", values: [_moneyK(c.ingresoK), `− ${_moneyK(c.totalGastosK)}`, _moneyK(c.resultadoK), `${_fmtPct(c.resultadoPct)}%`], strong: true },
      ],
      nota: `gastos = tus % declarados (${_fmtPct(c.sumPct)}) prorrateados por la venta de cada ${lbl.sing} · la suma cierra exacto con el negocio`,
    };
    const bol = [
      _fMoneyK("Resultado del negocio", c.resultadoK, { mandatory: true }), _fPct("Gastos · total", c.sumPct),
      _fMoneyK("Venta · negocio", c.ingresoK), _fMoneyK("Gastos declarados", c.totalGastosK), _fPct("Resultado %", c.resultadoPct),
      ...listadas.flatMap((x) => [_fMoneyK(`Venta · ${x.nombre}`, x.ventaK), _fMoneyK(`Gastos · ${x.nombre}`, x.gastoK), _fMoneyK(`Resultado · ${x.nombre}`, x.resultadoK), _fPct(`Resultado % · ${x.nombre}`, x.resultadoPct)]),
      ...(resto.length ? [_fMoneyK("Resto · resultado", restoK), _fMoneyK("Resto · venta", restoVK), _fMoneyK("Resto · gastos", restoGK)] : []),
    ];
    return _resp(
      `${pi._retoma ? "Retomo tu P&L donde lo dejamos. " : ""}Tu P&L por ${lbl.sing} — el mismo negocio repartido en ${rows.length} ${lbl.plur}, con tus gastos declarados (${_fmtPct(c.sumPct)}% sobre la venta de cada ${lbl.sing}). Sus ${rows.length} ${lbl.plur} suman exacto el resultado del negocio: ${_moneyK(c.resultadoK)}.\n\n${rows[0].nombre} encabeza: deja ${_moneyK(rows[0].resultadoK)}, el ${_fmtPct(rows[0].resultadoPct)}% de su venta.${negs.length ? ` Ojo: ${negs.map((x) => x.nombre).join(" y ")} queda${negs.length > 1 ? "n" : ""} en negativo con tus supuestos.` : ""} ¿Profundizo en ${eje === _BASE_EJE ? "una cuenta" : `una ${lbl.sing}`} — «P&L de ${rows[0].nombre}» — o lo vemos por otro eje?`,
      { route: "pnl_reading", suggestions: [`P&L de ${rows[0].nombre}`, ...pnlEjesDisponibles().filter((x) => x.eje !== eje).slice(0, 2).map((x) => `P&L por ${x.label.sing}`)], bol,
        ev: { dimension: eje, entityList: { entities: listadas.filter((x) => x.nombre !== "—").map((x) => x.nombre), dimension: eje }, tablaM: tEje } }
    );
  }
  // ── PROYECCIÓN DE VENTA (owner 2026-07-25): «si vendiera $X, ¿cuánto me queda con estos gastos?» — el REAL
  // a un lado y el PROYECTADO al lado, manteniendo el margen y la carga de HOY (todo lineal: escala, no
  // estructura). Alcance: entidad explícita > «negocio» > el alcance vivo > la entidad de la memoria > negocio. ──
  if (a === "proyeccion_venta") {
    if (!_lines.length) return sinPnl();
    if (!(pi.ventaK > 0)) return sinPnl();
    if (pi.covered === false) return composePnl({ action: "resultado_scoped", entidad: pi.entidad, eje: pi.eje, covered: false }, ctx, state);
    let nombre = pi.entidad || null, eje = (pi.eje && ENTITIES[pi.eje]) ? pi.eje : null;
    if (!nombre && !pi.negocio) {
      if (_scope && _scope.entity) { nombre = _scope.entity; eje = _scope.dimension; }
      else if (ctx && ctx.memoria && ctx.memoria.entidad && ctx.memoria.entidad.nombre) {
        const c0 = _pnlEntityEn(ctx.memoria.entidad.nombre);
        if (c0 && c0.covered) { nombre = c0.nombre; eje = c0.eje; }
      }
    }
    const c = buildPnlCascade(scenario, null, nombre ? { dimension: eje || _BASE_EJE } : null);
    let r0;   // las anclas REALES del alcance (entidad o negocio)
    if (nombre) {
      const e = c.porEntidad.find((x) => _norm(x.nombre) === _norm(nombre));
      if (!e) return _resp(`A ${nombre} no lo tengo en el dato vigente del P&L. Hoy puedo proyectar la venta de ${_dondeSi()} o del negocio.`, { route: "pnl_reading" });
      r0 = e;
      _scope = { dimension: eje || _BASE_EJE, entity: e.nombre, entities: null };
    } else {
      r0 = { nombre: "el negocio", ventaK: c.ingresoK, costoK: c.costoK, margenBrutoK: c.margenBrutoK, cargaK: c.cargaK, contribK: c.contribK, gastoK: c.totalGastosK, resultadoK: c.resultadoK, resultadoPct: c.resultadoPct };
      _scope = { dimension: _BASE_EJE, entity: null, entities: null, global: true };
    }
    if (!(r0.ventaK > 0)) return sinPnl();
    const vK = pi.ventaK, f = vK / r0.ventaK;
    const p = {
      ventaK: vK, contribK: r0.contribK * f, cargaK: r0.cargaK * f,
      margenBrutoK: r0.margenBrutoK * f, costoK: r0.costoK * f,
      gastoK: (vK * c.sumPct) / 100,
    };
    p.resultadoK = p.contribK - p.gastoK;
    const quien = nombre || "el negocio";
    // la PREGUNTA CLAVE (palabras del owner 2026-07-25) — invierte la proyección · gate-proven por el espejo
    const metaAsk = `¿Qué nivel de venta necesito alcanzar${nombre ? ` en ${nombre}` : ""} para obtener un resultado final de ${_moneyK(p.resultadoK)}?`;
    const cordura = (f >= 5 || f <= 0.2) ? ` Ojo: es una escala muy distinta a la de hoy — a esa distancia, las condiciones actuales son solo una referencia.` : "";
    const bol = [
      _fMoneyK("Venta proyectada", vK, { mandatory: true }),
      _fMoneyK(`Ingreso · real`, r0.ventaK), _fMoneyK(`Costo · real`, r0.costoK), _fMoneyK(`Costo · proyectado`, p.costoK),
      _fMoneyK(`Margen bruto · real`, r0.margenBrutoK), _fMoneyK(`Margen bruto · proyectado`, p.margenBrutoK),
      _fMoneyK(`Carga · real`, r0.cargaK), _fMoneyK(`Carga · proyectada`, p.cargaK),
      _fMoneyK(`Contribución · real`, r0.contribK), _fMoneyK(`Contribución · proyectada`, p.contribK),
      _fMoneyK(`Gastos · real`, r0.gastoK), _fMoneyK(`Gastos · proyectados`, p.gastoK), _fPct("Gastos · total", c.sumPct),
      _fMoneyK(`Resultado · real`, r0.resultadoK, { mandatory: true }), _fMoneyK(`Resultado · proyectado`, p.resultadoK, { mandatory: true }),
      _fPct("Resultado %", r0.resultadoPct),
    ];
    // LA TABLA (owner 2026-07-25 · mockup: "así debería verse en el orden, porque si no no se entiende bien"):
    // el orden de la cascada en columnas Real hoy | Proyectado — data estructurada en la evidencia, la UI la
    // renderiza (chartSpec → InlineChart, tipo tabla_comparada) · cifras verbatim de la única verdad.
    const tabla = {
      titulo: `${nombre || "El negocio"} — Real hoy vs. proyectado`,
      cols: ["Real hoy", "Proyectado"],
      rows: [
        { label: "Ingreso", a: _moneyK(r0.ventaK), b: _moneyK(vK), strong: true },
        { label: "Costo", a: _moneyK(r0.costoK), b: _moneyK(p.costoK) },
        { label: "Margen bruto", a: _moneyK(r0.margenBrutoK), b: _moneyK(p.margenBrutoK) },
        { label: "Carga comercial", a: _moneyK(r0.cargaK), b: _moneyK(p.cargaK) },
        { label: "Contribución", a: _moneyK(r0.contribK), b: _moneyK(p.contribK), strong: true },
        { label: `Gastos declarados · ${_fmtPct(c.sumPct)}%`, a: _moneyK(r0.gastoK), b: _moneyK(p.gastoK) },
        { label: "Resultado", a: _moneyK(r0.resultadoK), b: _moneyK(p.resultadoK), strong: true, resultado: true },
        { label: "Resultado sobre venta", a: `${_fmtPct(r0.resultadoPct)}%`, b: `${_fmtPct(r0.resultadoPct)}%`, pct: true },
      ],
      nota: "proyectado = tu P&L real a esa venta · margen, carga y porcentajes de hoy constantes",
    };
    // EL EXPLICATIVO (palabras del owner 2026-07-25: "aritmética y esas cosas complican al usuario") — llano:
    // qué significa · qué muestra y qué no asegura · la pregunta clave. Los números viven en la tabla de abajo.
    const sube = vK >= r0.ventaK;
    const dirV = sube ? "aumenta" : "baja";
    const dirR = sube ? (p.resultadoK >= 0 ? "subiría" : "quedaría") : "bajaría";
    const alcance2 = sube
      ? `Este cálculo muestra cuánto podría dejar${nombre ? ` ${nombre}` : ""} al vender más, pero no asegura que esa venta ocurra.`
      : `Este cálculo muestra cómo quedaría el resultado si la venta cae — no anticipa esa caída.`;
    return _resp(
      `**¿Qué significa?** Hoy ${quien} vende ${_moneyK(r0.ventaK)} y deja un resultado de ${_moneyK(r0.resultadoK)}. Si la venta ${dirV} a ${_moneyK(vK)} y se mantienen las mismas condiciones actuales — margen, carga y tus gastos declarados (${_fmtPct(c.sumPct)}%) — el resultado ${dirR} a ${_moneyK(p.resultadoK)}.\n\n${alcance2} Tampoco considera cambios en los productos vendidos, los precios o el comportamiento de los clientes.${cordura}\n\n**Pregunta clave:** ${metaAsk}`,
      { route: "pnl_reading", suggestions: [metaAsk, ...(nombre ? [`P&L de ${nombre}`] : ["¿Cómo queda mi resultado comercial?"])], bol,
        ev: { proyeccion: tabla, ...(nombre ? { entidad: nombre, entityType: eje || _BASE_EJE, dimension: eje || _BASE_EJE } : { dimension: _BASE_EJE }) } }
    );
  }
  if (a === "resultado_deixis") {
    if (!_lines.length) return sinPnl();
    const last = (ctx && (ctx.last || ctx.lastEvidence)) || null;
    const el = pi._entities || (last && last.entityList) || null;
    const mem = (ctx && ctx.memoria) || null;
    if (!el || !Array.isArray(el.entities) || !el.entities.length) {
      // sin conjunto heredable: la ENTIDAD en foco de la memoria (paréntesis largo) antes que la repregunta
      if (mem && mem.entidad && mem.entidad.nombre) {
        const c0 = _pnlEntityEn(mem.entidad.nombre);
        if (c0) return composePnl({ action: "resultado_scoped", entidad: c0.nombre, eje: c0.eje, covered: c0.covered }, ctx, state);
      }
      const primero = pnlEjesDisponibles()[0];
      // F2 (caza del espejo empresa-2): el ejemplo nombraba «Ripley y La Polar» hardcodeado — fuga del demo en
      // otro tenant. Data-driven: los dos clientes chicos de la base de ESTE negocio (el tramo que un deixis
      // suele heredar) — con el demo el ejemplo dice «ABC y Unimarc» (delta deliberado del texto ejemplo).
      const ejD = clientesMargen.slice(-2).map((r) => r.nombre);
      const ejemplo = ejD.length === 2 ? `«¿cuánto dejan ${ejD[0]} y ${ejD[1]} después de gastos?»` : `«¿cuánto dejan ${(ejD[0] || primero.label.plur)} después de gastos?»`;
      return _resp(`¿De cuáles? Nómbralos (${ejemplo}) o pídeme la tabla completa: «P&L por ${primero.label.sing}».`, { route: "pnl_reading", suggestions: [`P&L por ${primero.label.sing}`] });
    }
    let eje = el.dimension && ENTITIES[el.dimension] ? el.dimension : null;
    if (!eje) { const c0 = _pnlEntityEn(String(el.entities[0] || "")); eje = c0 ? c0.eje : null; }
    const d = eje && _dispoDe(eje);
    if (!d || !d.available) {
      // el conjunto heredado vive en un eje SIN venta desglosada (ej. SKUs) → honesto + dónde SÍ (nunca prorratear)
      const lp = (eje && _EJE_LBL(eje).plur) || "entidades de un eje que no está en el P&L";
      return _resp(
        `Los que veníamos mirando son ${lp} — y ahí el P&L no baja: ${d ? d.motivo : "no tengo la venta desglosada en ese eje"}. Sí puedo dártelo por ${_dondeSi()} o del negocio completo. ¿Cuál te sirve?`,
        { route: "pnl_reading", suggestions: [...pnlEjesDisponibles().slice(0, 2).map((x) => `P&L por ${x.label.sing}`), "P&L del negocio"] }
      );
    }
    const c = buildPnlCascade(scenario, null, { dimension: eje });
    const setN = new Set(el.entities.map(_norm));
    const es = c.porEntidad.filter((x) => setN.has(_norm(x.nombre)));
    if (!es.length) return _resp(`A esos no los tengo en el alcance del P&L. Pídeme la tabla y de ahí bajamos: «P&L por ${d.label.sing}».`, { route: "pnl_reading", suggestions: [`P&L por ${d.label.sing}`] });
    _scope = { dimension: eje, entity: es.length === 1 ? es[0].nombre : null, entities: es.map((x) => x.nombre) };
    const sumR = es.reduce((acc, x) => acc + x.resultadoK, 0), sumV = es.reduce((acc, x) => acc + x.ventaK, 0);
    const pctJ = sumV ? (sumR / sumV) * 100 : 0;
    const bol = [
      ...es.flatMap((x) => [_fMoneyK(`Resultado · ${x.nombre}`, x.resultadoK, { mandatory: true }), _fPct(`Resultado % · ${x.nombre}`, x.resultadoPct)]),
      _fMoneyK("Resultado del grupo", sumR), _fPct("Resultado % del grupo", pctJ), _fPct("Gastos · total", c.sumPct),
    ];
    // opener honesto: el conjunto EXPLÍCITO (F2 · el usuario los acaba de nombrar) no dice "veníamos mirando"
    const _abreD = pi._explicit ? "Después de gastos: " : `${pi._retoma ? "Retomo tu P&L donde lo dejamos. " : ""}De los que veníamos mirando, después de gastos: `;
    return _resp(
      `${_abreD}${es.map((x) => `${x.nombre} deja ${_moneyK(x.resultadoK)} (${_fmtPct(x.resultadoPct)}% de su venta)`).join(" · ")}.${es.length > 1 ? ` Juntos: ${_moneyK(sumR)} — el ${_fmtPct(pctJ)}% de su venta combinada.` : ""} El prorrateo usa tus porcentajes declarados (${_fmtPct(c.sumPct)}% sobre la venta de cada uno) — supuesto, no contabilidad por ${d.label.sing}.`,
      { route: "pnl_reading", suggestions: [`P&L de ${es[0].nombre}`], bol, ev: { dimension: eje, entityList: { entities: es.map((x) => x.nombre), dimension: eje } } }
    );
  }
  if (a === "resultado") {
    if (!_lines.length) return sinPnl();
    // la lectura y el sello comparten _analisisResultado (una verdad · el gate verifica byte-igual)
    const an = _analisisResultado(scenario);
    return _resp(an.text,
      { route: "pnl_reading", suggestions: an.asks, bol: an.bol, ev: { dimension: _BASE_EJE, tablaM: an.tablaM } }
    );
  }
  if (a === "peso") {
    if (!_lines.length) return sinPnl();
    const c = buildPnlCascade(scenario);
    const orden = c.gastos.slice().sort((x, y) => y.usdK - x.usdK);
    const top = orden[0];
    const share = c.totalGastosK ? _r1((top.usdK / c.totalGastosK) * 100) : 0;
    const resto = orden.slice(1).map((g) => `${g.nombre.toLowerCase()} (${_moneyK(g.usdK)} · ${_fmtPct(g.pct)}%)`).join(" · ");
    const bol = [
      _fMoneyK("Gastos declarados", c.totalGastosK, { mandatory: true }), _fPct("Gastos · total", c.sumPct),
      _fMoneyK(`Gasto · ${top.nombre}`, top.usdK, { mandatory: true }), _fPct(`Línea · ${top.nombre}`, top.pct), _fPct("Peso sobre gastos", share),
      ...orden.slice(1).flatMap((g) => [_fMoneyK(`Gasto · ${g.nombre}`, g.usdK), _fPct(`Línea · ${g.nombre}`, g.pct)]),
      _gPct(_r1(Math.max(top.pct / 2, top.pct - 1))),
    ];
    return _resp(
      `De tus gastos declarados (${_moneyK(c.totalGastosK)} al año · ${_fmtPct(c.sumPct)}% de la venta), la línea que más pesa es ${top.nombre.toLowerCase()}: ${_moneyK(top.usdK)} — el ${_fmtPct(share)}% del total de gastos.${resto ? ` Le sigue${orden.length > 2 ? "n" : ""}: ${resto}.` : ""} Todas miden % sobre la venta: si la venta se mueve, se mueven con ella — son supuestos declarados, no dato contable.\n\n${pnlSimAsk(top)}`,
      { route: "pnl_reading", suggestions: [pnlSimAsk(top)], bol, ev: { dimension: _BASE_EJE } }
    );
  }
  if (a === "simulate_line") {
    if (!_lines.length) return sinPnl();
    const l = _findLine(pi.nombre);
    if (!l) return sinPnl();
    if (!(pi.pct >= 0 && pi.pct <= 50)) return _resp(`Ese porcentaje no me sirve como supuesto para ${l.nombre.toLowerCase()} — prueba un valor entre 0% y 50% sobre la venta.`, { route: "pnl_reading", bol: [_gPct(0), _gPct(50)] });
    const t = _r1(pi.pct);
    // ── PROYECCIÓN SCOPED (pase 2): «…a 2% en Falabella» o «¿y si en esa familia…?» (el alcance vivo/memoria ·
    // el sustantivo deíctico DEBE calzar con el eje del referente — "esa familia" jamás resuelve a un cliente) ──
    let sEnt = pi.entidad || null, sEje = (pi.eje && ENTITIES[pi.eje]) ? pi.eje : null;
    if (!sEnt && pi.scopeDeictic) {
      const _dEje = { familia: "familia", cliente: "cliente", cuenta: "cliente", marca: "marca" }[String(pi.scopeDeictic)] || null;
      const _calza = (eje) => !_dEje || _dEje === eje;
      if (_scope && _scope.entity && _calza(_scope.dimension)) { sEnt = _scope.entity; sEje = _scope.dimension; }
      else if (ctx && ctx.memoria && ctx.memoria.entidad && ctx.memoria.entidad.nombre) {
        const c0 = _pnlEntityEn(ctx.memoria.entidad.nombre);
        if (c0 && c0.covered && _calza(c0.eje)) { sEnt = c0.nombre; sEje = c0.eje; }
      }
      if (!sEnt) return _resp(`¿En cuál? Dímelo con nombre: «¿y si en Cuidado Personal bajo ${l.nombre.toLowerCase()} a ${_fmtPct(t)}%?»`, { route: "pnl_reading", bol: [_gPct(t)] });
    }
    if (sEnt) {
      const cS = buildPnlCascade(scenario, null, { dimension: sEje || _BASE_EJE });
      const e = cS.porEntidad.find((x) => _norm(x.nombre) === _norm(sEnt));
      if (e) {
        _scope = { dimension: sEje || _BASE_EJE, entity: e.nombre, entities: null };
        const gA = (e.ventaK * l.pct) / 100, gB = (e.ventaK * t) / 100;
        const dK = gA - gB;   // gasto que baja = resultado que sube (aritmética local exacta)
        const resB = e.resultadoK + dK, pctB = e.ventaK ? (resB / e.ventaK) * 100 : 0;
        const negocioB = cS.resultadoK + dK;
        const dir = dK >= 0 ? "sube" : "baja";
        const bol = [
          _fPct(`Línea · ${l.nombre}`, l.pct), _fPct("Supuesto nuevo", t, { mandatory: true }),
          _fMoneyK(`Gasto actual en ${e.nombre}`, gA), _fMoneyK(`Gasto con el supuesto en ${e.nombre}`, gB),
          _fMoneyK("Efecto en su resultado", dK, { mandatory: true }),
          _fMoneyK(`Resultado actual · ${e.nombre}`, e.resultadoK), _fPct(`Resultado actual % · ${e.nombre}`, e.resultadoPct),
          _fMoneyK(`Resultado con el supuesto · ${e.nombre}`, resB), _fPct(`Resultado con el supuesto % · ${e.nombre}`, pctB),
          _fMoneyK("Resultado del negocio con el supuesto", negocioB),
        ];
        return _resp(
          `**Supuesto (local):** ${l.nombre.toLowerCase()} pasa de ${_fmtPct(l.pct)}% a ${_fmtPct(t)}% solo en ${e.nombre}.\n**Efecto directo:** su gasto de ${l.nombre.toLowerCase()} va de ${_moneyK(gA)} a ${_moneyK(gB)}, y su resultado ${dir} ${_moneyK(Math.abs(dK))}: de ${_moneyK(e.resultadoK)} (${_fmtPct(e.resultadoPct)}%) a ${_moneyK(resB)} (${_fmtPct(pctB)}% de su venta). El del negocio queda en ${_moneyK(negocioB)}.\n**Límite:** tu P&L declara ${l.nombre.toLowerCase()} global (${_fmtPct(l.pct)}% en toda la venta) — este supuesto es local y es aritmética, no contabilidad de ${e.nombre}.\n**Decisión:** para moverlo de verdad, global: «cambia ${l.nombre.toLowerCase()} a ${_fmtPct(t)}%».`,
          { route: "pnl_reading", suggestions: [`Cambia ${l.nombre.toLowerCase()} a ${_fmtPct(t)}%`, `P&L de ${e.nombre}`], bol, ev: { entidad: e.nombre, entityType: sEje || _BASE_EJE, dimension: sEje || _BASE_EJE } }
        );
      }
    }
    const base = buildPnlCascade(scenario);
    const simLines = _lines.map((x) => (x === l ? { ...x, pct: t } : { ...x }));
    const sim = buildPnlCascade(scenario, simLines);
    const dK = sim.resultadoK - base.resultadoK;
    const gA = base.gastos.find((g) => g.nombre === l.nombre), gB = sim.gastos.find((g) => g.nombre === l.nombre);
    const dir = dK >= 0 ? "sube" : "baja";
    const bol = [
      _fPct(`Línea · ${l.nombre}`, l.pct), _fPct("Supuesto nuevo", t, { mandatory: true }),
      _fMoneyK(`Gasto actual · ${l.nombre}`, gA.usdK), _fMoneyK(`Gasto con el supuesto · ${l.nombre}`, gB.usdK),
      _fMoneyK("Efecto en el resultado", dK, { mandatory: true }),
      _fMoneyK("Resultado actual", base.resultadoK), _fPct("Resultado actual %", base.resultadoPct),
      _fMoneyK("Resultado con el supuesto", sim.resultadoK), _fPct("Resultado con el supuesto %", sim.resultadoPct),
    ];
    return _resp(
      `**Supuesto:** ${l.nombre.toLowerCase()} pasa de ${_fmtPct(l.pct)}% a ${_fmtPct(t)}% sobre la venta.\n**Efecto directo:** el gasto anual de ${l.nombre.toLowerCase()} va de ${_moneyK(gA.usdK)} a ${_moneyK(gB.usdK)}, y el resultado comercial ${dir} ${_moneyK(Math.abs(dK))}: de ${_moneyK(base.resultadoK)} (${_fmtPct(base.resultadoPct)}%) a ${_moneyK(sim.resultadoK)} (${_fmtPct(sim.resultadoPct)}% de la venta).\n**Límite:** es aritmética sobre tu supuesto declarado — no predice el efecto operativo de mover ${l.nombre.toLowerCase()}.\n**Decisión:** si te cierra, confírmalo: «cambia ${l.nombre.toLowerCase()} a ${_fmtPct(t)}%».`,
      { route: "pnl_reading", suggestions: [`Cambia ${l.nombre.toLowerCase()} a ${_fmtPct(t)}%`], bol, ev: { dimension: _BASE_EJE } }
    );
  }
  if (a === "meta_venta") {
    if (!_lines.length) return sinPnl();
    const c = buildPnlCascade(scenario);
    const targetK = pi.targetK;
    if (!(targetK > 0)) return sinPnl();
    // ── META SCOPED (pase 2): «¿cuánto vender en Falabella para que me deje $500K después de gastos?» ──
    if (pi.entidad && pi.covered !== false) {
      const eje = (pi.eje && ENTITIES[pi.eje]) ? pi.eje : _BASE_EJE;
      const cS = buildPnlCascade(scenario, null, { dimension: eje });
      const e = cS.porEntidad.find((x) => _norm(x.nombre) === _norm(pi.entidad));
      if (e) {
        _scope = { dimension: eje, entity: e.nombre, entities: null };
        if (e.resultadoPct <= 0) {
          return _resp(
            `Con tu estructura actual, ${e.nombre} deja ${_moneyK(e.resultadoK)} (${_fmtPct(e.resultadoPct)}% de su venta) — vender más ahí no lo da vuelta: cada venta adicional entra con el mismo % negativo. Primero revisemos sus números («P&L de ${e.nombre}») o tus líneas de gasto (${_fmtPct(cS.sumPct)}% en total).`,
            { route: "pnl_reading", suggestions: [`P&L de ${e.nombre}`, "¿Qué línea pesa más en el resultado?"], bol: [_fMoneyK(`Resultado · ${e.nombre}`, e.resultadoK, { mandatory: true }), _fPct(`Resultado % · ${e.nombre}`, e.resultadoPct), _fPct("Gastos · total", cS.sumPct)], ev: { entidad: e.nombre, entityType: eje, dimension: eje } }
          );
        }
        const ventaNecK = (targetK / e.resultadoPct) * 100;
        const gapK = ventaNecK - e.ventaK;
        const bol = [
          _fMoneyK("Meta de resultado", targetK, { mandatory: true }), _fMoneyK("Venta necesaria", ventaNecK, { mandatory: true }),
          _fPct(`Resultado % · ${e.nombre}`, e.resultadoPct), _fMoneyK(`Venta actual · ${e.nombre}`, e.ventaK),
          _fMoneyK(`Resultado actual · ${e.nombre}`, e.resultadoK), _fMoneyK(gapK >= 0 ? "Venta adicional" : "Holgura", Math.abs(gapK)),
          _fPct("Gastos · total", cS.sumPct),
        ];
        // EXPLICATIVO LLANO (palabras del owner 2026-07-25 · mismo trato que la proyección: sin "la cuenta/
        // estructura/mix" — hoy vende y deja · cuánto falta · por qué esa cifra · qué no asegura)
        return _resp(
          `Para que ${e.nombre} te deje ${_moneyK(targetK)} después de gastos, su venta tiene que llegar a ${_moneyK(ventaNecK)} al año. Hoy vende ${_moneyK(e.ventaK)} y deja ${_moneyK(e.resultadoK)}${gapK > 0 ? ` — le faltan ${_moneyK(gapK)} de venta adicional` : ` — la meta ya está cubierta, con ${_moneyK(Math.abs(gapK))} de holgura`}.\n\n¿Por qué esa cifra? Hoy el ${_fmtPct(e.resultadoPct)}% de su venta queda como resultado después de gastos. Si eso se mantiene igual — margen, carga y tus gastos declarados (${_fmtPct(cS.sumPct)}%) — esa es la venta que produce ${_moneyK(targetK)}.\n\nEste cálculo no asegura que esa venta ocurra, ni considera cambios en los productos vendidos, los precios o el comportamiento de los clientes.`,
          { route: "pnl_reading", suggestions: [`¿Y si ${e.nombre} vendiera ${_moneyK(ventaNecK)}?`, "¿Qué línea pesa más en el resultado?"], bol, ev: { entidad: e.nombre, entityType: eje, dimension: eje } }
        );
      }
    }
    if (c.resultadoPct <= 0) {
      return _resp(
        `Con tu estructura actual el resultado comercial es ${_moneyK(c.resultadoK)} (${_fmtPct(c.resultadoPct)}% de la venta) — vender más no lo da vuelta: cada venta adicional entra con el mismo % negativo. Primero revisemos las líneas de gasto (${_fmtPct(c.sumPct)}% en total) o el margen.`,
        { route: "pnl_reading", suggestions: ["¿Qué línea pesa más en el resultado?"], bol: [_fMoneyK("Resultado comercial", c.resultadoK, { mandatory: true }), _fPct("Resultado %", c.resultadoPct), _fPct("Gastos · total", c.sumPct)], ev: { dimension: _BASE_EJE } }
      );
    }
    const ventaNecK = (targetK / c.resultadoPct) * 100;
    const gapK = ventaNecK - c.ingresoK;
    const bol = [
      _fMoneyK("Meta de resultado", targetK, { mandatory: true }), _fMoneyK("Venta necesaria", ventaNecK, { mandatory: true }),
      _fPct("Resultado %", c.resultadoPct), _fMoneyK("Venta actual", c.ingresoK), _fMoneyK("Resultado actual", c.resultadoK),
      _fMoneyK(gapK >= 0 ? "Venta adicional" : "Holgura", Math.abs(gapK)), _fPct("Gastos · total", c.sumPct),
    ];
    // EXPLICATIVO LLANO (palabras del owner 2026-07-25 · mismo trato que la proyección)
    return _resp(
      `Para un resultado de ${_moneyK(targetK)} después de gastos, la venta tiene que llegar a ${_moneyK(ventaNecK)} al año. Hoy el negocio vende ${_moneyK(c.ingresoK)} y deja ${_moneyK(c.resultadoK)}${gapK > 0 ? ` — faltan ${_moneyK(gapK)} de venta adicional` : ` — la meta ya está cubierta, con ${_moneyK(Math.abs(gapK))} de holgura`}.\n\n¿Por qué esa cifra? Hoy el ${_fmtPct(c.resultadoPct)}% de la venta queda como resultado después de gastos. Si eso se mantiene igual — margen, carga y tus gastos declarados (${_fmtPct(c.sumPct)}%) — esa es la venta que produce ${_moneyK(targetK)}.\n\nEste cálculo no asegura que esa venta ocurra, ni considera cambios en los productos vendidos, los precios o el comportamiento de los clientes.`,
      { route: "pnl_reading", suggestions: [`¿Y si el negocio vendiera ${_moneyK(ventaNecK)}?`, "¿Qué línea pesa más en el resultado?"], bol, ev: { dimension: _BASE_EJE } }
    );
  }
  if (a === "resultado_entidad") {
    if (!_lines.length) return sinPnl();
    // pase 2: entidad de CUALQUIER eje del alcance («¿cuánto deja Cuidado Personal después de gastos?») ·
    // sin cobertura en la base → el mismo camino honesto del scoped (jamás prorratear sin venta desglosada)
    if (pi.covered === false) return composePnl({ action: "resultado_scoped", entidad: pi.entidad, eje: pi.eje, covered: false }, ctx, state);
    let eje = (pi.eje && ENTITIES[pi.eje]) ? pi.eje : _BASE_EJE;
    let c = buildPnlCascade(scenario, null, eje === _BASE_EJE ? null : { dimension: eje });
    let e = c.porEntidad.find((x) => _norm(x.nombre) === _norm(pi.entidad));
    if (!e) {
      // el eje no vino (ej. la lente del multi): el canon del alcance lo resuelve — familia/marca incluidas
      const c0 = _pnlEntityEn(String(pi.entidad || ""));
      if (c0 && !c0.covered) return composePnl({ action: "resultado_scoped", entidad: c0.nombre, eje: c0.eje, covered: false }, ctx, state);
      if (c0 && c0.eje !== eje) { eje = c0.eje; c = buildPnlCascade(scenario, null, { dimension: eje }); e = c.porEntidad.find((x) => _norm(x.nombre) === _norm(c0.nombre)); }
    }
    if (!e) return sinPnl();
    _scope = { dimension: eje, entity: e.nombre, entities: null };
    // EL SELLO PROPORCIONAL (auditoría del owner 2026-07-26): su cifra → por qué rinde distinto al promedio
    // (drivers de la entidad, graduado) → la acción de ESA cuenta con su $ y el cierre en decisión.
    const pqE = _porqueEntidad(e, c);
    const acc = _accionCuenta(scenario, e, eje, c);
    const a1 = acc[0] || null;
    const accTxt = a1 ? `Dónde actuar en ${e.nombre}: ${a1.texto}. ¿Partimos por ahí (${_money(a1.usd)}) o lo vemos completo — «P&L de ${e.nombre}»?` : "";
    const bol = _dedupeBol([
      _fMoneyK(`Resultado · ${e.nombre}`, e.resultadoK, { mandatory: true }), _fPct(`Resultado % · ${e.nombre}`, e.resultadoPct),
      _fMoneyK(`Contribución · ${e.nombre}`, e.contribK), _fMoneyK(`Venta · ${e.nombre}`, e.ventaK),
      _fMoneyK(`Gastos prorrateados · ${e.nombre}`, e.gastoK), _fPct("Gastos · total", c.sumPct),
      ...pqE.figs, ...acc.flatMap((x) => x.figs),
    ]);
    return _resp(
      `Después de gastos, ${e.nombre} deja ${_moneyK(e.resultadoK)} — ${_fmtPct(e.resultadoPct)}% de su venta. ¿Por qué rinde eso? ${pqE.text} El prorrateo usa tus porcentajes declarados (${_fmtPct(c.sumPct)}% sobre su venta) — supuesto, no dato contable de ${e.nombre}.${accTxt ? `\n\n${accTxt}` : ""}`,
      { route: "pnl_reading", suggestions: [...new Set([...(a1 && a1.ask ? [a1.ask] : []), `P&L de ${e.nombre}`, "¿Cómo queda mi resultado comercial?"])].slice(0, 3), bol, ev: { entidad: e.nombre, entityType: eje, dimension: eje } }
    );
  }
  // acción desconocida → estado honesto
  return _resp(_lines.length
    ? `Seguimos con tu P&L cuando quieras: «¿cómo queda mi resultado comercial?» · «cambia una línea a otro %» · «olvida mi P&L».`
    : `Todavía no armamos tu P&L comercial. ¿Armamos tu P&L ahora?`);
}

/* ── SEGUIMIENTO CONVERSACIONAL DEL P&L (owner 2026-07-25: "explícame esto más sencillo · dime qué decisiones
 * tomar — el LLM debe entender perfecto y responder perfecto") · los resolvers estándar (followup_explain ·
 * followup_recommendation · meta real-o-supuesto) se vuelven P&L-aware vía evidence.pnl: ADI cuenta LA MISMA
 * historia — más simple o en modo decisión — con las mismas cifras de la boleta, jamás el relleno genérico. ── */

// «explícame esto más sencillo» sobre una lectura P&L → la cascada contada en llano (alcance de la evidencia/hilo)
export function pnlExplain(last, ctx = null, state = {}) {
  if (!_lines.length) return null;
  const scenario = (state && state.scenario) || "bonanza";
  const nombre = (last && last.entidad) || (_scope && _scope.entity) || null;
  const eje = (last && last.entityType && ENTITIES[last.entityType]) ? last.entityType
    : (_scope && _scope.entity && ENTITIES[_scope.dimension]) ? _scope.dimension : null;
  const c = buildPnlCascade(scenario, null, nombre && eje ? { dimension: eje } : null);
  const e = nombre ? c.porEntidad.find((x) => _norm(x.nombre) === _norm(nombre)) : null;
  const r0 = e || { nombre: "el negocio", ventaK: c.ingresoK, costoK: c.costoK, cargaK: c.cargaK, contribK: c.contribK, gastoK: c.totalGastosK, resultadoK: c.resultadoK };
  const quien = e ? e.nombre : "el negocio";
  const top = c.gastos.slice().sort((x, y) => y.usdK - x.usdK)[0];
  const simT = top ? _r1(Math.max(top.pct / 2, top.pct - 1)) : null;
  const simAsk = top ? (e ? `¿Qué pasa si bajas ${top.nombre.toLowerCase()} a ${_fmtPct(simT)}% en ${e.nombre}?` : pnlSimAsk(top)) : null;
  const bol = [
    _fMoneyK(`Venta · ${quien}`, r0.ventaK), _fMoneyK(`Costo · ${quien}`, r0.costoK), _fMoneyK(`Carga · ${quien}`, r0.cargaK),
    _fMoneyK(`Contribución · ${quien}`, r0.contribK), _fMoneyK(`Gastos · ${quien}`, r0.gastoK),
    _fMoneyK(`Resultado · ${quien}`, r0.resultadoK, { mandatory: true }), _fPct("Gastos · total", c.sumPct),
    ...(top ? [_gPct(simT)] : []),
  ];
  return _resp(
    `Te lo cuento simple. ${e ? e.nombre : "El negocio"} vendió ${_moneyK(r0.ventaK)} en el año. De esa venta, ${_moneyK(r0.costoK)} se fueron en el costo de los productos y ${_moneyK(r0.cargaK)} en condiciones comerciales al canal; quedaron ${_moneyK(r0.contribK)} — hasta ahí, todo es dato de tu cartera. Después se restan los gastos que declaraste tú (${_fmtPct(c.sumPct)}% de la venta: ${_moneyK(r0.gastoK)}) y quedan ${_moneyK(r0.resultadoK)}. Eso es el resultado: lo que ${e ? e.nombre : "el negocio"} te deja al año.\n\nLa parte firme llega hasta la contribución; los gastos son los porcentajes que me diste — si cambias un porcentaje, el resultado cambia contigo.${simAsk ? ` ${simAsk}` : ""}`,
    { route: "pnl_reading", suggestions: [...(simAsk ? [simAsk] : []), e ? `P&L de ${e.nombre}` : "¿Qué línea pesa más en el resultado?"], bol,
      ev: e ? { entidad: e.nombre, entityType: eje || _BASE_EJE, dimension: eje || _BASE_EJE, tablaM: _tablaCascada(c, e) } : { dimension: _BASE_EJE, tablaM: _tablaCascada(c) } }
  );
}

// «¿qué decisiones tomo?» sobre una lectura P&L → las decisiones a la mano (línea top · dónde empujar · meta)
export function pnlRecommend(last, ctx = null, state = {}) {
  if (!_lines.length) return null;
  const scenario = (state && state.scenario) || "bonanza";
  const c = buildPnlCascade(scenario);
  const top = c.gastos.slice().sort((x, y) => y.usdK - x.usdK)[0];
  if (!top) return null;
  const simT = _r1(Math.max(top.pct / 2, top.pct - 1));
  const metaM = c.resultadoK > 0 ? Math.max(1, Math.ceil((c.resultadoK * 1.1) / 1000)) : null;
  const primero = pnlEjesDisponibles()[0];
  const neg = c.resultadoK < 0;
  const bol = [
    _fMoneyK(`Gasto · ${top.nombre}`, top.usdK, { mandatory: true }), _fPct(`Línea · ${top.nombre}`, top.pct),
    _fMoneyK("Resultado comercial", c.resultadoK), _fPct("Gastos · total", c.sumPct), _gPct(simT),
    ...(metaM ? [fig("Meta sugerida", `$${metaM}M`, { unit: "money", raw: metaM * 1e6, source: "computed", gancho: true, context: "P&L comercial" })] : []),
  ];
  const simAsk = `¿Qué pasa si bajas ${top.nombre.toLowerCase()} a ${_fmtPct(simT)}%?`;
  const d1 = `1. Revisar la línea que más pesa: ${top.nombre.toLowerCase()} se lleva ${_moneyK(top.usdK)} al año (${_fmtPct(top.pct)}% de la venta). Si el porcentaje real es otro, actualizarlo deja la cuenta honesta — y si puedes bajarlo, el resultado sube de inmediato. Prueba: «${simAsk}»`;
  const d2 = `2. Decidir dónde empujar la venta: las cuentas no dejan lo mismo después de gastos — el cuadro por ${primero.label.sing} muestra quién rinde más sobre su venta. «P&L por ${primero.label.sing}»`;
  const d3 = metaM
    ? `3. Fijar una meta concreta: dime cuánto quieres que quede y te digo qué venta se necesita. «¿Cuánto tengo que vender para ganar $${metaM}M después de gastos?»`
    : `3. Revisar los porcentajes completos antes de empujar la venta: con el resultado en negativo, cada venta adicional entra igual de cargada. «¿Qué línea pesa más en el resultado?»`;
  return _resp(
    `${neg ? `Primero lo primero: con tus porcentajes el resultado está en negativo (${_moneyK(c.resultadoK)}) — la decisión inicial es revisar las líneas, no la venta.\n\n` : ""}Con tu P&L a la vista, las decisiones a la mano:\n\n${d1}\n\n${d2}\n\n${d3}`,
    { route: "pnl_reading", suggestions: [simAsk, `P&L por ${primero.label.sing}`, ...(metaM ? [`¿Cuánto tengo que vender para ganar $${metaM}M después de gastos?`] : ["¿Qué línea pesa más en el resultado?"])], bol, ev: { dimension: _BASE_EJE } }
  );
}
