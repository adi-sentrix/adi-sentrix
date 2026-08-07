/* === src/adi/oracle/entityIndex.js · CONTRATO v2 · FASE 3 · CANONICALIZACIÓN CON RED ===========================
 * (owner 2026-08-07, tras la revisión de arquitectura)
 *
 * TRES HUECOS QUE CIERRA, todos confirmados leyendo el código:
 *
 * (1) ESCALA. `resolveEntity` (entityRecord.js) hacía un scan LINEAL normalizando (NFD, no barato) CADA candidato
 *     en CADA llamada, y `guessDimension` pagaba el PEOR caso —6 ejes × scan completo— justo cuando el nombre NO
 *     existe, que es el fallo más frecuente (el typo). Con `buildGrid`/`buildTension` haciendo map(_rawRecord) eso
 *     se vuelve O(N²) por ranking, recomputado cada turno. Acá se construye UN índice Map(normalizado → canónico)
 *     por EJE y por TENANT, y la resolución pasa a O(1).
 *
 * (2) TYPOS SIN RED. La corrección de "Falabela"→"Falabella" estaba 100% delegada al LLM, que además NUNCA ve el
 *     catálogo del tenant: si el modelo no adivinaba, la tool declinaba pelada, sin candidatos. El único
 *     Levenshtein del sistema vivía en guardC como guard de SALIDA que RECHAZA — exactamente al revés de donde se
 *     necesita. Acá el fuzzy vive en la ENTRADA y PROPONE candidatos reales del tenant.
 *
 * (3) COLISIONES SILENCIOSAS. `guessDimension` recorría los ejes en orden FIJO (sku > cliente > marca > …) y
 *     devolvía el primero que matcheara, EN SILENCIO. Con catálogos grandes sube la chance de homónimos entre ejes
 *     y el motor servía la fila del eje equivocado con cifras REALES — error de ATRIBUCIÓN que ningún guard
 *     numérico marca. Acá las colisiones se DETECTAN y se exponen para desambiguar.
 *
 * FRONTERA (contrato v2): el LLM propone el nombre; el MOTOR canonicaliza, corrige y —si hay ambigüedad real—
 * devuelve candidatos para preguntar. Ningún paso semántico crítico queda sin red determinística.
 * PURO salvo el caché (invalidado por tenant). Sin LLM, sin red, gate-testable.
 */
import { clientesMargen, clientesVentas, marcasMargen, marcasVentas, sfamiliasMargen, sfamiliasVentas, skuInventario } from "../../data/demoData.js";
import { skusMargen } from "../../data/skusMargen.js";
import { onTenantChange } from "../../data/tenantStore.js";
import { ENTITIES } from "../../config/contract/entityRegistry.js";

// El orden de los ejes se conserva EXACTO al de guessDimension original — es la prioridad histórica y cambiarla
// alteraría resoluciones existentes. Acá solo deja de ser silenciosa: si hay colisión, se reporta.
export const AXES = ["sku", "cliente", "marca", "familia", "bodega", "canal"];

const _norm = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();

// fuentes por eje — mismo mapa que entityRecord._sources/_axisNames, replicado acá A PROPÓSITO para no crear un
// ciclo de imports (entityRecord delega en este módulo). Es una tabla de 6 líneas, no lógica duplicada.
function _axisRows(dimension) {
  const A = (x) => (Array.isArray(x) ? x : []);
  switch (dimension) {
    case "sku": return [{ rows: A(skuInventario), key: "sku" }, { rows: A(skusMargen), key: "nombre" }];
    case "cliente": return [{ rows: A(clientesMargen), key: "nombre" }, { rows: A(clientesVentas), key: "nombre" }];
    case "marca": return [{ rows: A(marcasMargen), key: "nombre" }, { rows: A(marcasVentas), key: "nombre" }];
    case "familia": return [{ rows: A(sfamiliasMargen), key: "nombre" }, { rows: A(sfamiliasVentas), key: "nombre" }];
    default: {
      const E = ENTITIES[dimension];
      if (!E || !E.isGroupBy) return null;
      const rows = E.source === "skuInventario" ? A(skuInventario) : E.source === "clientesVentas" ? A(clientesVentas) : null;
      return Array.isArray(rows) ? [{ rows, key: E.keyField }] : null;
    }
  }
}

// ── EL ÍNDICE (por tenant · invalidado en onTenantChange) ───────────────────────────────────────────────────────
// Estructura: Map(eje → Map(nombreNormalizado → nombreCanónico)). Se construye perezoso al primer uso y se tira
// entero cuando cambia el tenant — nunca se mezclan catálogos de dos empresas.
let _index = null;
let _generation = 0;
function _build() {
  const byAxis = new Map();
  for (const dim of AXES) {
    const srcs = _axisRows(dim);
    if (!srcs) continue;
    const m = new Map();
    for (const s of srcs) for (const r of s.rows) {
      const id = r && r[s.key];
      if (id == null) continue;
      const canon = String(id);
      const k = _norm(canon);
      if (k && !m.has(k)) m.set(k, canon);   // primera aparición gana (mismo criterio que el scan original)
    }
    if (m.size) byAxis.set(dim, m);
  }
  return { byAxis, generation: ++_generation };
}
function _idx() { if (!_index) _index = _build(); return _index; }
onTenantChange(() => { _index = null; });   // catálogo nuevo → índice nuevo, sin residuos del tenant anterior

// invalidateEntityIndex() → fuerza la reconstrucción (para gates que mutan el dato en caliente).
export function invalidateEntityIndex() { _index = null; }
// entityIndexStats() → observabilidad del índice (tamaño por eje, generación) para gates de escala.
export function entityIndexStats() {
  const { byAxis, generation } = _idx();
  const porEje = {};
  for (const [dim, m] of byAxis) porEje[dim] = m.size;
  return { generation, ejes: [...byAxis.keys()], porEje, total: Object.values(porEje).reduce((a, b) => a + b, 0) };
}

// axisEntityNames(dimension) → los nombres canónicos del eje (O(1) de acceso al índice ya construido).
export function axisEntityNames(dimension) {
  const m = _idx().byAxis.get(dimension);
  return m ? [...m.values()] : [];
}

// ── (1) CANONICALIZACIÓN O(1) ──────────────────────────────────────────────────────────────────────────────────
// resolveCanonical(dimension, name) → nombre canónico del dato | null si no existe en ese eje.
// A diferencia del resolveEntity histórico (que devolvía el CRUDO cuando no matcheaba, mezclando "no existe" con
// "existe tal cual"), acá null significa inequívocamente "no está en el catálogo de este eje".
export function resolveCanonical(dimension, name) {
  if (name == null) return null;
  const m = _idx().byAxis.get(dimension);
  if (!m) return null;
  return m.get(_norm(name)) || null;
}

// ── (2) FUZZY EN LA ENTRADA ────────────────────────────────────────────────────────────────────────────────────
// Levenshtein ACOTADO (corta apenas supera el umbral — nunca recorre la matriz completa por un nombre largo).
function _lev(a, b, max) {
  const s = String(a), t = String(b);
  if (Math.abs(s.length - t.length) > max) return max + 1;
  let prev = Array.from({ length: t.length + 1 }, (_, i) => i);
  for (let i = 1; i <= s.length; i++) {
    const cur = [i];
    let best = i;
    for (let j = 1; j <= t.length; j++) {
      const cost = s[i - 1] === t[j - 1] ? 0 : 1;
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
      if (cur[j] < best) best = cur[j];
    }
    if (best > max) return max + 1;   // corte temprano: ninguna celda de la fila puede mejorar
    prev = cur;
  }
  return prev[t.length];
}
// umbral por longitud: nombres cortos toleran 1 error, largos hasta 2. Nunca más — a 3 empieza a proponer
// cualquier cosa, y un candidato equivocado con cifras reales es peor que un decline honesto.
const _maxDist = (n) => (n <= 4 ? 0 : n <= 7 ? 1 : 2);

// findCandidates(dimension, name) → [{nombre, distancia, motivo}] ordenados por cercanía. Vacío si nada se acerca.
// Motivos: "exacto" (ya canonicaliza) · "prefijo" (el usuario escribió de menos) · "tipeo" (Levenshtein).
export function findCandidates(dimension, name, { max = 3 } = {}) {
  const m = _idx().byAxis.get(dimension);
  if (!m || name == null) return [];
  const q = _norm(name);
  if (!q) return [];
  const exact = m.get(q);
  if (exact) return [{ nombre: exact, distancia: 0, motivo: "exacto" }];
  const lim = _maxDist(q.length);
  const out = [];
  for (const [k, canon] of m) {
    if (k.startsWith(q) || q.startsWith(k)) { out.push({ nombre: canon, distancia: Math.abs(k.length - q.length), motivo: "prefijo" }); continue; }
    if (lim > 0) { const d = _lev(q, k, lim); if (d <= lim) out.push({ nombre: canon, distancia: d, motivo: "tipeo" }); }
  }
  return out.sort((a, b) => a.distancia - b.distancia || a.nombre.localeCompare(b.nombre)).slice(0, max);
}

// ── (3) COLISIONES ENTRE EJES ──────────────────────────────────────────────────────────────────────────────────
// axisCollisions(name) → TODOS los ejes donde ese nombre existe. Con 2+ hay homónimo real: servir el primero del
// orden fijo sería exactamente el error de atribución silencioso que este módulo viene a matar.
export function axisCollisions(name) {
  if (name == null) return [];
  const q = _norm(name);
  const out = [];
  for (const dim of AXES) {
    const m = _idx().byAxis.get(dim);
    if (m && m.has(q)) out.push({ dimension: dim, nombre: m.get(q) });
  }
  return out;
}

// ── RESOLUCIÓN COMPLETA (la que consume el motor) ──────────────────────────────────────────────────────────────
// resolveEntityRef(name, {dimension}) → un veredicto EXPLÍCITO, nunca un nombre a secas:
//   { estado:"resuelto",   dimension, nombre }                        → existe, sin ambigüedad
//   { estado:"ambiguo",    motivo:"colision_ejes", opciones:[…] }     → homónimo en 2+ ejes: hay que preguntar
//   { estado:"sugerencia", candidatos:[…] }                           → no existe, pero hay casi-matches reales
//   { estado:"desconocido" }                                          → no existe y nada se le parece
// Si viene `dimension`, se resuelve SOLO en ese eje (el plan ya decidió el eje). Sin `dimension`, se busca en
// todos y se reportan las colisiones.
export function resolveEntityRef(name, { dimension = null } = {}) {
  if (name == null || String(name).trim() === "") return { estado: "desconocido" };
  if (dimension) {
    const canon = resolveCanonical(dimension, name);
    if (canon) return { estado: "resuelto", dimension, nombre: canon };
    const cands = findCandidates(dimension, name);
    return cands.length ? { estado: "sugerencia", dimension, candidatos: cands } : { estado: "desconocido", dimension };
  }
  const hits = axisCollisions(name);
  if (hits.length === 1) return { estado: "resuelto", dimension: hits[0].dimension, nombre: hits[0].nombre };
  if (hits.length > 1) return { estado: "ambiguo", motivo: "colision_ejes", opciones: hits };
  // sin match exacto en ningún eje → juntamos candidatos de todos los ejes
  const cands = [];
  for (const dim of AXES) for (const c of findCandidates(dim, name, { max: 2 })) cands.push({ ...c, dimension: dim });
  cands.sort((a, b) => a.distancia - b.distancia || a.nombre.localeCompare(b.nombre));
  return cands.length ? { estado: "sugerencia", candidatos: cands.slice(0, 3) } : { estado: "desconocido" };
}

// ── CARDINALIDAD DETERMINÍSTICA ────────────────────────────────────────────────────────────────────────────────
// Las reglas del contrato dejan de ser doctrina de prompt y pasan a ser un resolver del motor (portable entre
// proveedores, verificable sin LLM):
//   · 1 entidad SIN métrica  → perfil ejecutivo
//   · 1 entidad CON métrica  → consulta puntual
//   · 2+ entidades           → comparación
//   · métrica SIN entidad    → el alcance conversacional; sin alcance → el negocio
// `alcanceConversacional` es lo que ya resuelve conversationScope.js (no se duplica: se recibe resuelto).
export function resolveCardinalidad({ entidades = [], metricas = [], alcanceConversacional = [] } = {}) {
  const ents = (Array.isArray(entidades) ? entidades : []).filter(Boolean);
  const mets = (Array.isArray(metricas) ? metricas : []).filter(Boolean);
  const heredadas = (Array.isArray(alcanceConversacional) ? alcanceConversacional : []).filter(Boolean);
  if (ents.length >= 2) return { forma: "comparacion", entidades: ents, metricas: mets, origenAlcance: "explicito" };
  if (ents.length === 1) return mets.length
    ? { forma: "puntual", entidades: ents, metricas: mets, origenAlcance: "explicito" }
    : { forma: "perfil", entidades: ents, metricas: [], origenAlcance: "explicito" };
  if (mets.length && heredadas.length >= 2) return { forma: "comparacion", entidades: heredadas, metricas: mets, origenAlcance: "conversacional" };
  if (mets.length && heredadas.length === 1) return { forma: "puntual", entidades: heredadas, metricas: mets, origenAlcance: "conversacional" };
  if (mets.length) return { forma: "negocio", entidades: [], metricas: mets, origenAlcance: "negocio" };
  if (heredadas.length === 1) return { forma: "perfil", entidades: heredadas, metricas: [], origenAlcance: "conversacional" };
  return { forma: "negocio", entidades: [], metricas: [], origenAlcance: "negocio" };
}
