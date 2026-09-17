/* protocolo.js · EL PROTOCOLO v3 DEL CEREBRO (verdad finita, prosa infinita · etapa E3 · owner 2026-09-17) ═══════════════════════════════
 * «ADI entiende y razona → trabaja sobre verdades empresariales verificables → interpreta → redacta libremente. Y Notario verifica esas
 * verdades, no intenta reconstruirlas después.» Acá vive lo que el cerebro recibe para trabajar así, y nada más:
 *   · la instrucción del system (byte-estable; más corta que la v2: no enseña a reconocer formas, enseña a anclar);
 *   · la carta de claves del turno (las claves de métrica y los estados que la evidencia permite usar, y cómo citar una cifra por su id);
 *   · los dos mensajes de reintento: RE-ANCLAR (la prosa congelada, solo las anclas) y REESCRIBIR (con la verdad de la boleta y sus ids);
 *   · la poda residual por tramos (cero llamadas): se quitan los tramos con anclas vetadas y las lecturas que los citan.
 * Detrás de `ADI_NOTARIO_V3`; sin el flag nadie importa esto desde el flujo vivo. Puro: sin I/O, sin red. */
import { MARCA_HECHOS, textoDelLibro } from "./hechos.js";
import { MARCA_FIN } from "./declaracion.js";
import { claveDeMetrica, metricaPorClave } from "./lexico.js";
import { ESTADOS_DE_LA_CASA } from "./estados.js";
import { CLASES_DE_VETO } from "./anclas.js";

/** instruccionDeAnclas() → el bloque del system que enseña el protocolo v3 (byte-estable; bajo el techo del fijo del agente) */
export function instruccionDeAnclas() {
  return [
    "TUS HECHOS Y TUS ANCLAS — el Notario verifica hechos identificados; no reconstruye la verdad desde tu prosa:",
    `Tu salida tiene dos partes, en este orden. (1) El bloque ${MARCA_HECHOS} … ${MARCA_FIN}: un hecho JSON por línea, cada uno con "id" (h1, h2…) y "tipo". (2) Tu respuesta al usuario, donde CADA afirmación de hecho va dentro de un ancla {{ids: tramo}} de los hechos que la sostienen, y cada cifra es un placeholder {id} (o {id.n} {id.m} {id.k} {id.umbral} {id.universo} {id.rel} {id.estado} {id.base}). Un {id} suelto es su propia ancla (así van las celdas de una tabla). Varias ids por ancla sí; anidar no. El usuario ve tu prosa sin marcas y con los valores escritos por la casa: no escribas dígitos fuera de un ancla.`,
    "Tipos (metrica = una clave de la CARTA DE CLAVES; estado = uno de la carta; universo = {eje, estados?, no_estados?, bodega?, filtros?:[{metrica,op,valor,unidad}], top?:{metrica,k,direccion}, excluir?:{entidades?,estados?,top?,bodega?}}): ref{de: el id de una cifra de tus resultados} · cifra{sujeto,metrica,valor?} · orden{sujeto,metrica,orden:{forma:max|min|puesto|topk|comparativo,k?,direccion?:mayor|menor|peor|mejor,vs?},universo} · relacion{sujeto,metrica,relacion:{forma:veces|fraccion|parte|mayor|menor|igual|diferencia,k?,matiz?,vs:{sujeto,metrica?}}} · grupo{miembros:[…],metrica,agregado:suma|participacion,valor?} · conteo{n,m?,de:universo} · variacion{sujeto,metrica,variacion:{direccion:sube|baja,valor?},periodo:anterior|presupuesto} · estado{sujeto,estado,bodega?} · razon{num:{sujeto,metrica}|{id},den:{sujeto,metrica}|{id},valor?} · derivada{op:resta|suma|cociente|diferencia_pp,de:[ids]} · propuesta{valor,sujeto?,de?} (una cifra tuya o del usuario: supuesto, objetivo) · lectura{apoyo:[ids],sello?} (interpretación o recomendación; sin cifras dentro de su ancla). sujeto: el nombre exacto de tus resultados, o \"negocio\" para totales y referencias.",
    "Reglas (cada una cuesta un reintento): todo número, orden o superlativo, comparación, estado, variación, duración y proporción va dentro del ancla de un hecho que dice exactamente eso; dentro de un ancla solo caben las entidades, métricas, estados y dirección de sus hechos —nada hipotético, negado ni de otro período—; una relación nombra primero al sujeto y después al comparado; un universo con filtros, estados, exclusiones o top se escribe con {id.universo}; en una tabla cada columna es una sola métrica y su cabecera la nombra; una recomendación de crédito o cobranza sobre un cliente es una lectura cuyo apoyo incluye un hecho de cobranza verdadero de ese cliente.",
    "Si el Notario pide RE-ANCLAR: devuelve el bloque completo (puedes agregar hechos) y la MISMA prosa, cambiando solo las anclas señaladas. Si pide REESCRIBIR: cambia solo los tramos señalados con la verdad que te entrega (ya trae ids) y devuelve todo de nuevo.",
    `Ejemplo:\n${MARCA_HECHOS}\n{"id":"h1","tipo":"ref","de":"c4"}\n{"id":"h2","tipo":"orden","sujeto":"Distribuidora Norte","metrica":"saldo_pendiente","orden":{"forma":"max"},"universo":{"eje":"cliente"}}\n{"id":"h3","tipo":"conteo","n":3,"de":{"eje":"cliente","filtros":[{"metrica":"dias_vencido","op":">","valor":90,"unidad":"days"}]}}\n{"id":"h4","tipo":"lectura","apoyo":["h1","h2"]}\n${MARCA_FIN}\n{{h2 h1: El que más te debe es Distribuidora Norte, con {h1} pendientes}}; {{h3: {h3.n} cuentas superan {h3.umbral} de mora}}. {{h4: Yo le pediría un calendario de pago antes de venderle más.}}`,
  ].join("\n");
}

/** cartaDeClaves(I) → la carta del turno para el protocolo v3: cómo citar una cifra por id, las claves de métrica presentes en la evidencia
 *  (boleta + rankings de la proyección) y los estados verificables. Texto derivado de la evidencia: sin ella, "". */
export function cartaDeClaves(I) {
  if (!I || !Array.isArray(I.figs)) return "";
  const claves = new Set();
  for (const f of I.figs) { const c = claveDeMetrica(f.concepto); if (c) claves.add(c); }
  for (const R of Object.values(I.rankings || {})) for (const k of Object.keys(R || {})) if (metricaPorClave(k)) claves.add(k);
  if (!claves.size) return "";
  const estados = ESTADOS_DE_LA_CASA.filter((e) => !e.historial).map((e) => `${e.canon.replace(/\s+/g, "_")} (${e.eje})`);
  const conHistorial = ESTADOS_DE_LA_CASA.filter((e) => e.historial).map((e) => e.canon.replace(/\s+/g, "_"));
  return [
    "[CARTA DE CLAVES — no es el usuario] Cada cifra de tus resultados trae \"id\" (c1, c2…): cítala como {\"tipo\":\"ref\",\"de\":\"cN\"} o por sujeto + metrica.",
    `· Claves de metrica: ${[...claves].join(" · ")}.`,
    `· Estados verificables (estado{sujeto, estado}): ${estados.join(" · ")}.${conHistorial.length ? ` Sin historial de pagos NO se demuestran: ${conHistorial.join(" · ")} — no los afirmes.` : ""}`,
    "· Ejes de universo: cliente · sku · marca · familia · bodega · canal.",
  ].join("\n");
}

/* ── los mensajes de reintento ─────────────────────────────────────────────────────────────────────────────────────────────── */
const _linea = (x) => `${x && x.kind ? x.kind + ": " : ""}${String((x && x.detail) || "").split("\n")[0].slice(0, 320)}`;

/** mensajeDeReanclaje(v) → la prosa congelada, solo las anclas (reemplaza a la «declaración sola» de la fase 4 B, y sí puede arreglar lo que se cobra) */
export function mensajeDeReanclaje(v) {
  const puntos = (v && Array.isArray(v.violations) ? v.violations : []).map(_linea).filter(Boolean).slice(0, 16);
  return `[NOTARIO — re-anclar; no es el usuario] Tu prosa queda EXACTAMENTE como está: no la reescribas, no la resumas, no agregues ni quites frases. Lo que falla son las anclas:
${puntos.map((p) => "- " + p).join("\n")}
Devuelve tu salida COMPLETA: el bloque ${MARCA_HECHOS} … ${MARCA_FIN} (puedes agregar hechos nuevos con su id) y la MISMA prosa con las anclas corregidas —cada cifra, orden, comparación, estado, variación y proporción dentro del ancla del hecho que lo dice—. No menciones esta corrección.`;
}

/** mensajeDeReescritura(v, libro, multa) → la multa completa (Notario + leyes de la casa) con la verdad de la boleta y sus ids; solo los tramos señalados cambian */
export function mensajeDeReescritura(v, libro, multa) {
  const verdad = libro && typeof libro === "object" ? textoDelLibro(libro).split("\n").filter((l) => l.startsWith("✗")).join("\n") : "";
  return `[NOTARIO — no es el usuario] Tu respuesta no pasó la verificación:
${String(multa || "").trim() || (v && Array.isArray(v.violations) ? v.violations.map(_linea).join("\n") : "")}${verdad ? `\nLa verdad de la boleta, con ids que puedes usar:\n${verdad}` : ""}
Reescribe SOLO los tramos señalados con esa verdad (cita sus ids como {id}); el resto de tu prosa queda igual. Devuelve tu salida COMPLETA de nuevo: el bloque ${MARCA_HECHOS} … ${MARCA_FIN} actualizado y la prosa anclada. No menciones esta corrección.`;
}

/** soloReanclaje(v) → true si TODO lo que falló es forma de las anclas (léxico sin ancla, ancla inconsistente, sujeto invisible, rótulo, operador
 *  fuera, apoyo…): la prosa se congela y se piden solo las anclas. Un hecho falso o no verificable, una ley de la casa o del contrato exigen reescritura. */
const _EXIGEN_REESCRITURA = new Set(["hecho-invalido", "notario-sin-indice", "notario-anclas-error"]);
export function soloReanclaje(v, clases = CLASES_DE_VETO) {
  if (!v || v.ok !== false || !Array.isArray(v.violations) || !v.violations.length) return false;
  if (Array.isArray(v.reglasContrato) && v.reglasContrato.length) return false;
  return v.violations.every((x) => { const k = String(x && x.kind); return (clases.includes(k) || k === "sin-hechos") && !_EXIGEN_REESCRITURA.has(k); });
}

/* ── la poda residual por tramos (comprobación 14): sin conectores, sin leer dependencia — la dependencia está en `apoyo` ── */
const _norm = (t) => String(t || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
const _RE_PLACEHOLDER = /\{[a-z][a-z0-9]*(?:\.[a-z]+)?\}/i;
function _oracionesConAnclas(linea) {
  /* las anclas, los placeholders y las cifras se enmascaran (sus puntos no cortan); se corta por . ! ? seguido de espacio o fin */
  const mask = linea.replace(/\{\{[\s\S]*?\}\}|⟦[^⟧]*⟧|\{[a-z][a-z0-9]*(?:\.[a-z]+)?\}|\d[\d.,]*/gi, (m) => "x".repeat(m.length));
  const out = []; let ini = 0; let m;
  const re = /[.!?](?=\s|$)/g;
  while ((m = re.exec(mask))) { out.push(linea.slice(ini, m.index + 1)); ini = m.index + 1; }
  if (ini < linea.length && linea.slice(ini).trim()) out.push(linea.slice(ini));
  return out.map((o) => o.trim()).filter(Boolean);
}
/** podarTramos(prosa, violations, libro, {tope}) → la prosa anclada sin los tramos vetados (y sin las lecturas cuyo apoyo los cita), o null si podar sería mutilar:
 *  se quitan a lo sumo `tope` unidades (oración, fila de tabla, viñeta o encabezado) y sobrevive solo si queda al menos un hecho de la boleta. */
export function podarTramos(prosa, violations, libro, { tope = 2 } = {}) {
  const s = String(prosa || "");
  const vs = Array.isArray(violations) ? violations : [];
  const frags = [...new Set(vs.map((x) => x && x.texto).filter((t) => typeof t === "string" && t.trim()).map(_norm))];
  const idsVetados = new Set(vs.flatMap((x) => (x && Array.isArray(x.ids) ? x.ids : [])).map(String));
  if (!frags.length && !idsVetados.size) return null;
  const citaId = (u, id) => new RegExp(`(?:\\{\\{|⟦)\\s*(?:[a-z0-9]+\\s+)*${id}(?:\\s|:)`, "i").test(u) || new RegExp(`\\{${id}(?:\\.[a-z]+)?\\}`, "i").test(u);
  const contiene = (u) => { const n = _norm(u); return frags.some((f) => n.includes(f)) || [...idsVetados].some((id) => citaId(u, id)); };
  const lecturaQueCita = (u) => {
    if (!libro || !libro.porId) return false;
    return [...u.matchAll(/(?:\{\{|⟦)([^:}⟧]+):/g)].some((m) => m[1].trim().split(/\s+/).some((id) => { const H = libro.porId.get(id); return H && H.tipo === "lectura" && H.roles && Array.isArray(H.roles.apoyo) && H.roles.apoyo.some((a) => idsVetados.has(String(a))); }));
  };
  const out = []; let quitadas = 0;
  for (const linea of s.split("\n")) {
    if (/^\s*(?:\||[-*•]|\d+[.)])\s/.test(linea) || /^\s*#/.test(linea)) { if (contiene(linea) || lecturaQueCita(linea)) { quitadas++; continue; } out.push(linea); continue; }
    const keep = _oracionesConAnclas(linea).filter((o) => { if (contiene(o) || lecturaQueCita(o)) { quitadas++; return false; } return true; });
    out.push(keep.join(" ").trim());
  }
  if (quitadas === 0 || quitadas > tope) return null;
  const resto = out.join("\n").replace(/\n{3,}/g, "\n\n").trim();
  if (!resto || !(/\{\{|⟦/.test(resto) || _RE_PLACEHOLDER.test(resto))) return null;
  return resto;
}
