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
 * Puro salvo el estado del módulo · headless-safe (sin localStorage no persiste pero no crashea) · motor sellado intacto. */
import { applyScenarioToClientesMargen } from "../engine/scenarios.js";
import { clientesMargen } from "../data/demoData.js";
import { fig } from "./boleta.js";

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

// ── PERSISTENCIA (patrón criteria.js · localStorage · guarded para headless/gates) ──────────────────────────
const _LS_KEY = "adi_pnl_v1";
const _hasLS = () => { try { return typeof localStorage !== "undefined" && !!localStorage; } catch { return false; } };
let _lines = [];   // [{ nombre, pct, origen:"supuesto_declarado" }] · % sobre la venta · vigente en runtime
const _persist = () => { if (_hasLS()) try { localStorage.setItem(_LS_KEY, JSON.stringify(_lines)); } catch { /* sin storage */ } };
const _emitChange = () => { try { if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("adi-pnl-changed")); } catch { /* headless */ } };
export function loadPnl() { if (!_hasLS()) return []; try { const v = JSON.parse(localStorage.getItem(_LS_KEY) || "[]"); return Array.isArray(v) ? v : []; } catch { return []; } }
export function initPnl() {
  const saved = loadPnl().filter((l) => l && typeof l.nombre === "string" && typeof l.pct === "number" && isFinite(l.pct) && l.pct > 0 && l.pct <= 50);
  _lines = saved.map((l) => ({ nombre: l.nombre, pct: l.pct, origen: "supuesto_declarado" }));
  return activePnl();
}
export function activePnl() { return _lines.map((l) => ({ ...l })); }
export function pnlDefined() { return _lines.length > 0; }
const _validLine = (l) => l && typeof l.nombre === "string" && l.nombre.trim().length >= 2 && l.nombre.trim().length <= 30
  && typeof l.pct === "number" && isFinite(l.pct) && l.pct > 0 && l.pct <= 50;
export function setPnlLines(lines) {
  const ok = (Array.isArray(lines) ? lines : []).filter(_validLine).slice(0, 10)
    .map((l) => ({ nombre: l.nombre.trim(), pct: _r1(l.pct), origen: "supuesto_declarado" }));
  if (!ok.length) return { ok: false };
  _lines = ok; _persist(); _emitChange();
  return { ok: true, lines: activePnl() };
}
export function clearPnl() { const had = _lines.length > 0; _lines = []; _persist(); _emitChange(); return { ok: true, had }; }
const _findLine = (name, pool) => { const n = _norm(name); return (pool || _lines).find((l) => _norm(l.nombre) === n) || null; };
// línea nombrada DENTRO de un texto (para edit/simulate: «cambia logística a 2%») · nombre más largo primero
function _lineInText(q, pool) {
  const nq = _norm(q);
  const cands = (pool || _lines).slice().sort((a, b) => b.nombre.length - a.nombre.length);
  for (const l of cands) if (new RegExp(`(^|[^\\p{L}])${_esc(_norm(l.nombre))}([^\\p{L}]|$)`, "u").test(nq)) return l;
  return null;
}

// ── DRAFT del flujo guiado (multi-turno · en memoria · el reset del chat lo limpia) ─────────────────────────
let _draft = null;   // { stage: "gastos" | "pcts" | "sello", lines: [{nombre, pct|null}] }
export function pnlDraft() { return _draft ? { stage: _draft.stage, lines: _draft.lines.map((l) => ({ ...l })) } : null; }
export function resetPnlDraft() { _draft = null; }

// ── LA CASCADA (determinística · UNA verdad: la cara Resultado, las lecturas y el cuadro leen de acá) ────────
// Base = clientesMargen del escenario (venta facturada anual · la MISMA base de margen/contribución de la Mesa).
// ANCLAS = las cifras que ADI YA cita en toda otra respuesta: venta y CONTRIBUCIÓN por fila (el escenario las
// recalcula juntas) y la carga desde pctRebate (el campo `rebates` base queda stale en runtime — clase [39]).
// Margen bruto y costo se DERIVAN (margen bruto = contribución + carga · costo = ingreso − margen bruto): así la
// cascada CIERRA EXACTO en cada paso por construcción — ingreso − costo − carga − Σgastos == resultado — y por
// entidad, resultado_e = contribución_e − Σ(pct_i × venta_e/100), con Σ entidades == total (el gate lo verifica).
export function buildPnlCascade(scenario, linesOverride = null) {
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
  const porEntidad = M.map((r) => {
    const gK = (r.venta * sumPct) / 100;
    return { nombre: r.nombre, ventaK: r.venta, contribK: r.contribucion, gastoK: gK, resultadoK: r.contribucion - gK, resultadoPct: r.venta ? ((r.contribucion - gK) / r.venta) * 100 : 0 };
  });
  return { defined: lines.length > 0, lines: lines.map((l) => ({ ...l })), ingresoK, costoK, margenBrutoK, cargaK, contribK, gastos, sumPct, totalGastosK, resultadoK, resultadoPct, porEntidad };
}

// ── DETECCIÓN · la red determinística del claim pnl_setup (corre en coerceSpec ANTES de fuera-de-dato/criteria) ──
const _PNL_WORD = /\b(?:p\s*&\s*l|pnl|p\s+y\s+l|resultado\s+comercial)\b/i;
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

const _CLIENTES = new Map(clientesMargen.map((r) => [_norm(r.nombre), r.nombre]));
function _clienteEn(q) {
  const nq = _norm(q);
  for (const [k, nombre] of _CLIENTES) if (new RegExp(`(^|[^a-z0-9])${_esc(k)}([^a-z0-9]|$)`).test(nq)) return nombre;
  return null;
}

/* detectPnlIntent(q) → { action, ... } | null · PURA respecto del texto (lee el estado del módulo: draft + líneas).
 * Acciones: start · recall · forget · edit_set · edit_add · edit_remove · peso · resultado · resultado_entidad ·
 * simulate_line · meta_venta · draft_gastos · draft_pcts · draft_sello · draft_cancel · draft_stay · draft_help */
export function detectPnlIntent(q) {
  const t = String(q || "").trim();
  if (!t) return null;
  // ── MID-FLOW · el draft manda (solo claims compatibles con la etapa · un cambio de tema NO se secuestra) ──
  if (_draft) {
    if (_CANCEL_RE.test(t)) return { action: "draft_cancel" };
    // edición dentro del flujo («cambia logística a 2%» antes de sellar) — misma red del edit, sobre el draft
    const dl = _lineInText(t, _draft.lines);
    if (dl && /(cambi[aá]|ajust[aá]|dej[aá]|pon[eé]|mejor)/i.test(t)) {
      const mp = t.match(/(\d+(?:[.,]\d+)?)\s*%?/);
      if (mp) return { action: "draft_edit", nombre: dl.nombre, pct: parseFloat(mp[1].replace(",", ".")) };
    }
    if (_draft.stage === "sello") {
      if (_AFFIRM_SELLO.test(t)) return { action: "draft_sello" };
      if (/^\s*no\b[\s.!…]*$/i.test(t) || /\b(revis|ajust|cambi)/i.test(t)) return { action: "draft_stay" };
    }
    if (_draft.stage === "gastos") {
      if (/[?¿]/.test(t) && _GASTOS_WORD.test(t)) return { action: "draft_help" };
      const lines = _parseGastoList(t);
      if (lines) return { action: "draft_gastos", lines };
      return null;   // no parsea como lista → el turno sigue su curso normal (el draft espera)
    }
    if (_draft.stage === "pcts" || _draft.stage === "sello") {
      if (/\d/.test(t) && !_SIMQ_RE.test(t)) {
        const lines = _draft.lines.map((l) => ({ ...l }));
        if (_parsePcts(t, lines)) return { action: "draft_pcts", lines };
      }
      return null;
    }
    return null;
  }
  // ── SIN DRAFT ──
  // simulate de una LÍNEA declarada («¿qué pasa si bajo logística a 2%?») · condicional + línea propia + % target
  if (_lines.length && _SIMQ_RE.test(t)) {
    const l = _lineInText(t);
    if (l) {
      const mp = t.match(/(?:\ba(?:l)?\s+)(\d+(?:[.,]\d+)?)\s*%|(\d+(?:[.,]\d+)?)\s*%/);
      if (mp) return { action: "simulate_line", nombre: l.nombre, pct: parseFloat((mp[1] || mp[2]).replace(",", ".")) };
    }
    return null;   // condicional sin línea propia → la red genérica de simulate resuelve
  }
  // edición de líneas guardadas
  if (_lines.length) {
    const l = _lineInText(t);
    if (l && /(sac[aá]|quit[aá]|elimin[aá]|borr[aá])/i.test(t) && !/\d\s*%/.test(t)) return { action: "edit_remove", nombre: l.nombre };
    if (l && /(cambi[aá]|ajust[aá]|pon[eé]|dej[aá]|sub[ií]|baj[aá])/i.test(t)) {
      const mp = t.match(/(\d+(?:[.,]\d+)?)\s*%?\s*[?.!]*\s*$|(\d+(?:[.,]\d+)?)\s*%/);
      if (mp) return { action: "edit_set", nombre: l.nombre, pct: parseFloat((mp[1] || mp[2]).replace(",", ".")) };
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
  // resultado por ENTIDAD («¿cuánto deja Falabella después de gastos?»)
  if (/despu[eé]s\s+de\s+(?:los\s+)?gastos/i.test(t)) {
    const ent = _clienteEn(t);
    if (ent && /\b(deja|queda|gana|aporta|rinde)\b/i.test(t)) return { action: "resultado_entidad", entidad: ent };
  }
  // meta de venta («¿cuánto tengo que vender para ganar $2M después de gastos?»)
  if (/\bcu[aá]nto\s+(?:tengo\s+que|debo|necesito|tendr[ií]a\s+que|hay\s+que)\s+vender\b/i.test(t)
    && /(ganar|resultado|despu[eé]s\s+de\s+gastos|utilidad|quedar)/i.test(t)) {
    const targetK = _parseTargetK(t);
    if (targetK) return { action: "meta_venta", targetK };
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
function _evidence(extraBol = []) {
  const list = activeCriteria();
  const pnl = activePnl();
  const bol = [
    ...list.map((c) => fig(`Criterio · ${c.label}`, c.valueFmt, { unit: c.valueFmt.endsWith("%") ? "pct" : "count", raw: c.value, source: "computed", context: "criterio del negocio" })),
    ...pnl.map((l) => fig(`P&L · ${l.nombre}`, `${_fmtPct(l.pct)}%`, { unit: "pct", raw: l.pct, source: "computed", formula: `${_fmtPct(l.pct)}% sobre la venta`, context: "supuesto declarado" })),
    ...extraBol,
  ];
  return { followup: true, kind: "criteria", criteriaList: list, pnlList: pnl, boleta: bol };
}
const _resp = (text, { route = "pnl_setup", suggestions = null, bol = [] } = {}) =>
  ({ text, suggestions, sentrixAction: null, evidence: _evidence(bol), route });
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
    `${cordura}Queda así, sobre la venta: ${_listado(c.lines)} — ${_fmtPct(c.sumPct)}% en total.\n\nCon tu dato real: ingreso ${_moneyK(c.ingresoK)} − costo ${_moneyK(c.costoK)} − carga comercial ${_moneyK(c.cargaK)} − gastos ${_moneyK(c.totalGastosK)} = resultado comercial ${_moneyK(c.resultadoK)} (${_fmtPct(c.resultadoPct)}% de la venta).\n\n¿Lo sello?`,
    { suggestions: ["Séllalo"], bol }
  );
}

/* composePnl(pi, ctx, state) → respuesta finalizada (shape de la UI). pi = el intent del detector (o null si el
 * LLM #1 clasificó pnl_setup sin red — se resuelve por estado: draft → re-preguntar la etapa · líneas → resultado ·
 * nada → start). El scenario viaja en state (como el resto del camino conversacional). */
export function composePnl(pi, ctx = null, state = {}) {
  const scenario = (state && state.scenario) || "bonanza";
  if (!pi) {
    if (_draft) pi = { action: _draft.stage === "gastos" ? "draft_help" : _draft.stage === "pcts" ? "draft_reask" : "draft_stay" };
    else pi = { action: _lines.length ? "resultado" : "start" };
  }
  const a = pi.action;

  // ── FLUJO GUIADO ──
  if (a === "start") {
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
    const eco = _draft.lines.map((l) => (l.pct != null ? `${l.nombre.toLowerCase()} ${_fmtPct(l.pct)}%` : l.nombre.toLowerCase())).join(" · ");
    const pide = conPct.length
      ? `Me falta el % de ${sinPct.map((l) => l.nombre.toLowerCase()).join(", ")}.`
      : `¿Qué % le asigno a cada uno, sobre la venta? Puedes dármelos en el mismo orden («3, 1.5, 2») o línea por línea («${sinPct[0].nombre.toLowerCase()} al 2%»).`;
    return _resp(`Anotado: ${eco}. ${pide}`, { bol: [..._lineFigs(conPct), _gPct(3), _gPct(1.5), _gPct(2)] });
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
  if (a === "draft_stay") {
    const c = buildPnlCascade(scenario, _draft.lines);
    return _resp(`Bien — dime qué ajusto («cambia ${c.lines[0].nombre.toLowerCase()} a otro %») o dime «cancelar» y lo dejamos sin guardar. Hoy va: ${_listado(c.lines)}.`, { bol: _lineFigs(c.lines) });
  }
  if (a === "draft_sello") {
    const lines = _draft.lines.filter((l) => l.pct != null);
    const r = setPnlLines(lines);
    _draft = null;
    if (!r.ok) return _resp(`No pude sellar el P&L — me faltan líneas válidas. Retomemos: «armemos mi P&L».`);
    const c = buildPnlCascade(scenario);
    return _resp(
      `Sellado. Desde ahora tu P&L comercial mide con ${c.lines.length === 1 ? "una línea de gasto" : `${c.lines.length} líneas de gasto`} (${_fmtPct(c.sumPct)}% sobre la venta) y el resultado comercial queda en ${_moneyK(c.resultadoK)} — ${_fmtPct(c.resultadoPct)}% de la venta. La cara Resultado de la Mesa ya lo muestra completo. Cada línea entró como supuesto declarado: cuando llegue el dato contable real, se reemplaza línea a línea sin rehacer nada. Para ajustar: «cambia ${c.lines[0].nombre.toLowerCase()} a otro %».`,
      { route: "pnl_setup", suggestions: ["¿Cómo queda mi resultado comercial?", "¿Qué línea pesa más en el resultado?"], bol: [_fPct("Gastos · total", c.sumPct), _fMoneyK("Resultado comercial", c.resultadoK, { mandatory: true }), _fPct("Resultado %", c.resultadoPct), ..._lineFigs(c.lines)] }
    );
  }

  // ── EDICIÓN de líneas guardadas (conversando · una verdad) ──
  if (a === "edit_set") {
    const l = _findLine(pi.nombre);
    if (!l) return _resp(`No tengo una línea «${pi.nombre.toLowerCase()}» en tu P&L. Hoy va: ${_listado(_lines)}.`, { bol: _lineFigs(_lines) });
    if (!_validLine({ nombre: l.nombre, pct: pi.pct })) return _resp(`Ese porcentaje no me cierra para ${l.nombre.toLowerCase()} — dame un valor entre 0.1% y 50%.`, { bol: [_gPct(0.1), _gPct(50)] });
    const prev = l.pct;
    setPnlLines(_lines.map((x) => (x === l ? { ...x, pct: _r1(pi.pct) } : x)));
    const c = buildPnlCascade(scenario);
    return _resp(
      `Listo — ${l.nombre.toLowerCase()} pasa de ${_fmtPct(prev)}% a ${_fmtPct(_r1(pi.pct))}%. Con eso, el resultado comercial queda en ${_moneyK(c.resultadoK)} (${_fmtPct(c.resultadoPct)}% de la venta) con ${_fmtPct(c.sumPct)}% de gastos totales.`,
      { suggestions: ["¿Cómo queda mi resultado comercial?"], bol: [_fPct("Anterior", prev, { gancho: true }), _fPct("Nuevo", _r1(pi.pct)), _fMoneyK("Resultado comercial", c.resultadoK, { mandatory: true }), _fPct("Resultado %", c.resultadoPct), _fPct("Gastos · total", c.sumPct)] }
    );
  }
  if (a === "edit_add" || a === "edit_add_nopct") {
    if (a === "edit_add_nopct") return _resp(`Dímelo con su % sobre la venta y lo agrego: «agrega ${pi.nombre.toLowerCase()} 1.5%».`, { bol: [_gPct(1.5)] });
    if (_findLine(pi.nombre)) return _resp(`${_cap(pi.nombre.toLowerCase())} ya está en tu P&L — si quieres moverla: «cambia ${pi.nombre.toLowerCase()} a ${_fmtPct(pi.pct)}%».`, { bol: [_gPct(pi.pct)] });
    if (!_validLine({ nombre: pi.nombre, pct: pi.pct })) return _resp(`Ese porcentaje no me cierra — dame un valor entre 0.1% y 50%.`, { bol: [_gPct(0.1), _gPct(50)] });
    setPnlLines([..._lines, { nombre: pi.nombre, pct: _r1(pi.pct) }]);
    const c = buildPnlCascade(scenario);
    return _resp(
      `Agregada: ${pi.nombre.toLowerCase()} ${_fmtPct(_r1(pi.pct))}% sobre la venta. Tu P&L queda con ${_fmtPct(c.sumPct)}% de gastos y el resultado comercial en ${_moneyK(c.resultadoK)} (${_fmtPct(c.resultadoPct)}% de la venta).`,
      { suggestions: ["¿Cómo queda mi resultado comercial?"], bol: [_fPct(`Línea · ${_cap(pi.nombre)}`, _r1(pi.pct)), _fPct("Gastos · total", c.sumPct), _fMoneyK("Resultado comercial", c.resultadoK, { mandatory: true }), _fPct("Resultado %", c.resultadoPct)] }
    );
  }
  if (a === "edit_remove") {
    const l = _findLine(pi.nombre);
    if (!l) return _resp(`No tengo una línea «${pi.nombre.toLowerCase()}» en tu P&L. Hoy va: ${_listado(_lines)}.`, { bol: _lineFigs(_lines) });
    const rest = _lines.filter((x) => x !== l);
    if (!rest.length) {
      clearPnl();
      return _resp(`Saqué ${l.nombre.toLowerCase()} — era la última línea, así que tu P&L quedó vacío y la cara Resultado vuelve a su punto de partida. Cuando quieras: «armemos mi P&L».`);
    }
    setPnlLines(rest);
    const c = buildPnlCascade(scenario);
    return _resp(
      `Saqué ${l.nombre.toLowerCase()} (${_fmtPct(l.pct)}%). Tu P&L queda: ${_listado(c.lines)} — ${_fmtPct(c.sumPct)}% en total, y el resultado comercial en ${_moneyK(c.resultadoK)} (${_fmtPct(c.resultadoPct)}% de la venta).`,
      { suggestions: ["¿Cómo queda mi resultado comercial?"], bol: [_fPct(`Línea · ${l.nombre}`, l.pct, { gancho: true }), ..._lineFigs(c.lines), _fPct("Gastos · total", c.sumPct), _fMoneyK("Resultado comercial", c.resultadoK, { mandatory: true }), _fPct("Resultado %", c.resultadoPct)] }
    );
  }
  if (a === "forget") {
    const r = clearPnl();
    resetPnlDraft();
    return _resp(r.had
      ? `Listo, olvidé tu P&L comercial: las líneas de gasto quedaron fuera y la cara Resultado vuelve a su punto de partida. Cuando quieras rearmarlo: «armemos mi P&L».`
      : `No tengo un P&L guardado — estás midiendo hasta la contribución. ¿Armamos tu P&L ahora?`);
  }
  if (a === "recall") {
    if (!_lines.length) return _resp(`Todavía no armamos tu P&L comercial: sin tus líneas de gasto, lo que puedo mostrarte llega hasta la contribución. ¿Armamos tu P&L ahora?`);
    const c = buildPnlCascade(scenario);
    return _resp(
      `Tu P&L comercial: ${_listado(c.lines)} — ${_fmtPct(c.sumPct)}% sobre la venta, cada línea como supuesto declarado (cuando llegue el dato contable real, se reemplaza línea a línea). Con el dato de hoy, el resultado comercial queda en ${_moneyK(c.resultadoK)} (${_fmtPct(c.resultadoPct)}% de la venta). Para ajustar: «cambia ${c.lines[0].nombre.toLowerCase()} a otro %» · «saca una línea» · «agrega una línea con su %».`,
      { suggestions: ["¿Cómo queda mi resultado comercial?", "¿Qué línea pesa más en el resultado?"], bol: [..._lineFigs(c.lines), _fPct("Gastos · total", c.sumPct), _fMoneyK("Resultado comercial", c.resultadoK, { mandatory: true }), _fPct("Resultado %", c.resultadoPct)] }
    );
  }

  // ── LECTURAS (cascada determinística · el sello entender→explicar→actuar en una respuesta) ──
  const sinPnl = () => _resp(`Esa cuenta llega hasta la contribución: todavía no tengo tus líneas de gasto, así que no hay resultado después de gastos que afirmar. ¿Armamos tu P&L ahora? Dime qué gastos quieres considerar y los porcentajes los definimos juntos.`, { route: "pnl_reading" });
  if (a === "resultado") {
    if (!_lines.length) return sinPnl();
    const c = buildPnlCascade(scenario);
    const top = c.gastos.slice().sort((x, y) => y.usdK - x.usdK)[0];
    const bol = [
      _fMoneyK("Resultado comercial", c.resultadoK, { mandatory: true }), _fPct("Resultado %", c.resultadoPct, { mandatory: true }),
      _fMoneyK("Ingreso", c.ingresoK), _fMoneyK("Costo", c.costoK), _fMoneyK("Margen bruto", c.margenBrutoK),
      _fMoneyK("Carga comercial", c.cargaK), _fMoneyK("Contribución", c.contribK), _fMoneyK("Gastos declarados", c.totalGastosK),
      _fPct("Gastos · total", c.sumPct), _fMoneyK(`Gasto · ${top.nombre}`, top.usdK), _fPct(`Línea · ${top.nombre}`, top.pct),
      ..._lineFigs(c.lines.filter((l) => l.nombre !== top.nombre)),
      _gPct(_r1(Math.max(top.pct / 2, top.pct - 1))),
    ];
    const neg = c.resultadoK < 0 ? ` Ojo: el resultado es negativo con los supuestos declarados — vale revisar las líneas antes que la venta.` : "";
    return _resp(
      `Tu resultado comercial: ${_moneyK(c.resultadoK)} al año — ${_fmtPct(c.resultadoPct)}% de la venta.\n\nLa cascada completa sobre el dato real: ingreso ${_moneyK(c.ingresoK)} − costo ${_moneyK(c.costoK)} = margen bruto ${_moneyK(c.margenBrutoK)} − carga comercial ${_moneyK(c.cargaK)} = contribución ${_moneyK(c.contribK)} − tus gastos declarados ${_moneyK(c.totalGastosK)} (${_fmtPct(c.sumPct)}% sobre la venta) = resultado ${_moneyK(c.resultadoK)}. Hasta la contribución es dato probado; los gastos son supuestos declarados por ti, así que el resultado se mueve con ellos.${neg}\n\nLa línea que más pesa: ${top.nombre.toLowerCase()} (${_moneyK(top.usdK)} · ${_fmtPct(top.pct)}%). ${pnlSimAsk(top)}`,
      { route: "pnl_reading", suggestions: [pnlSimAsk(top), "¿Qué línea pesa más en el resultado?"], bol }
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
      { route: "pnl_reading", suggestions: [pnlSimAsk(top)], bol }
    );
  }
  if (a === "simulate_line") {
    if (!_lines.length) return sinPnl();
    const l = _findLine(pi.nombre);
    if (!l) return sinPnl();
    if (!(pi.pct >= 0 && pi.pct <= 50)) return _resp(`Ese porcentaje no me sirve como supuesto para ${l.nombre.toLowerCase()} — prueba un valor entre 0% y 50% sobre la venta.`, { route: "pnl_reading", bol: [_gPct(0), _gPct(50)] });
    const t = _r1(pi.pct);
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
      { route: "pnl_reading", suggestions: [`Cambia ${l.nombre.toLowerCase()} a ${_fmtPct(t)}%`], bol }
    );
  }
  if (a === "meta_venta") {
    if (!_lines.length) return sinPnl();
    const c = buildPnlCascade(scenario);
    const targetK = pi.targetK;
    if (!(targetK > 0)) return sinPnl();
    if (c.resultadoPct <= 0) {
      return _resp(
        `Con tu estructura actual el resultado comercial es ${_moneyK(c.resultadoK)} (${_fmtPct(c.resultadoPct)}% de la venta) — vender más no lo da vuelta: cada venta adicional entra con el mismo % negativo. Primero revisemos las líneas de gasto (${_fmtPct(c.sumPct)}% en total) o el margen.`,
        { route: "pnl_reading", suggestions: ["¿Qué línea pesa más en el resultado?"], bol: [_fMoneyK("Resultado comercial", c.resultadoK, { mandatory: true }), _fPct("Resultado %", c.resultadoPct), _fPct("Gastos · total", c.sumPct)] }
      );
    }
    const ventaNecK = (targetK / c.resultadoPct) * 100;
    const gapK = ventaNecK - c.ingresoK;
    const bol = [
      _fMoneyK("Meta de resultado", targetK, { mandatory: true }), _fMoneyK("Venta necesaria", ventaNecK, { mandatory: true }),
      _fPct("Resultado %", c.resultadoPct), _fMoneyK("Venta actual", c.ingresoK), _fMoneyK("Resultado actual", c.resultadoK),
      _fMoneyK(gapK >= 0 ? "Venta adicional" : "Holgura", Math.abs(gapK)), _fPct("Gastos · total", c.sumPct),
    ];
    const cierre = gapK > 0
      ? `La brecha es ${_moneyK(Math.abs(gapK))} de venta adicional.`
      : `Ya estás por encima: con la venta actual te sobran ${_moneyK(Math.abs(gapK))} de holgura.`;
    return _resp(
      `Para un resultado de ${_moneyK(targetK)} después de gastos necesitas vender ${_moneyK(ventaNecK)} al año. La cuenta: con tu estructura actual, el resultado es el ${_fmtPct(c.resultadoPct)}% de la venta (margen y carga del dato − ${_fmtPct(c.sumPct)}% de gastos declarados). Hoy la venta es ${_moneyK(c.ingresoK)} y el resultado ${_moneyK(c.resultadoK)}. ${cierre} Supuesto: mantiene tu mix y tus porcentajes constantes — no es una proyección de demanda.`,
      { route: "pnl_reading", suggestions: ["¿Qué línea pesa más en el resultado?"], bol }
    );
  }
  if (a === "resultado_entidad") {
    if (!_lines.length) return sinPnl();
    const c = buildPnlCascade(scenario);
    const e = c.porEntidad.find((x) => x.nombre === pi.entidad);
    if (!e) return sinPnl();
    const bol = [
      _fMoneyK(`Resultado · ${e.nombre}`, e.resultadoK, { mandatory: true }), _fPct(`Resultado % · ${e.nombre}`, e.resultadoPct),
      _fMoneyK(`Contribución · ${e.nombre}`, e.contribK), _fMoneyK(`Venta · ${e.nombre}`, e.ventaK),
      _fMoneyK(`Gastos prorrateados · ${e.nombre}`, e.gastoK), _fPct("Gastos · total", c.sumPct),
    ];
    return _resp(
      `Después de gastos, ${e.nombre} deja ${_moneyK(e.resultadoK)} — ${_fmtPct(e.resultadoPct)}% de su venta. La cuenta: contribución ${_moneyK(e.contribK)} − ${_fmtPct(c.sumPct)}% de gastos prorrateados sobre su venta de ${_moneyK(e.ventaK)} (${_moneyK(e.gastoK)}) = ${_moneyK(e.resultadoK)}. El prorrateo usa tus porcentajes declarados sobre la venta de la cuenta — supuesto, no dato contable de ${e.nombre}.`,
      { route: "pnl_reading", suggestions: [`Profundiza en ${e.nombre}`, "¿Cómo queda mi resultado comercial?"], bol }
    );
  }
  // acción desconocida → estado honesto
  return _resp(_lines.length
    ? `Seguimos con tu P&L cuando quieras: «¿cómo queda mi resultado comercial?» · «cambia una línea a otro %» · «olvida mi P&L».`
    : `Todavía no armamos tu P&L comercial. ¿Armamos tu P&L ahora?`);
}
