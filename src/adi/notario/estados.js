/* estados.js · LOS ESTADOS DE LA CASA — cada estado dicho en palabras tiene UNA definición empresarial verificable ═══════════════════════
 *
 * Decisión del owner (2026-09-17, ronda adversarial 3): «ADI sí puede hablar en estados naturales, pero cada estado debe tener una definición
 * empresarial verificable. Si el dato no permite demostrarlo, no puede afirmarlo como hecho». Antes, «al día», «sin mora», «paga puntual»,
 * «vigente», «rota bien», «en quiebre» no eran puntos de afirmación (una cláusula sin número no entraba a juicio) y una falsedad dicha así se
 * servía en verde — incluso sobreviviendo a la poda.
 *
 * Una sola fuente: presencia (los puntos de la prosa), el juez (la consistencia prosa↔declaración), el verificador (el veredicto contra la
 * proyección) y el resolutor (la forma canónica) leen de acá. Cada estado trae:
 *   canon       · el nombre canónico (normalizado, sin tildes)
 *   eje         · a quién se le puede decir (sku · cliente)
 *   re          · cómo se reconoce cuando se DECLARA o se nombra (sinónimos de la casa)
 *   prosa       · cómo se reconoce como PUNTO en la prosa (más conservador: no debe cazar figuras retóricas)
 *   definicion  · la definición empresarial, en palabras
 *   complemento · el estado que dice lo contrario (para «no está al día» = «en mora»)
 *   verificar   · (I, ent) → { ok, verdad, evidencia } o null si la evidencia no lo demuestra (→ no verificable, nunca verdadero)
 *
 * Los estados de la Mesa Capital (frenado · sobrestock · inmovilizado · riesgo de quiebre · capital sano · crítico) siguen viniendo de la
 * proyección SKU por SKU (`I.estadosDe`): acá solo se nombran; el verificador de estados de inventario vive en verificar.js. */
import { normalizar } from "./afirmacion.js";

/* el valor de una entidad en un ranking de la proyección (número) — o null si la proyección no la trae */
const _deRanking = (I, eje, clave, entidad) => {
  const R = I && I.rankings && I.rankings[eje] && I.rankings[eje][clave];
  if (!R || !Array.isArray(R.filas)) return null;
  const k = normalizar(entidad);
  const fila = R.filas.find((x) => normalizar(x.entidad) === k);
  return fila && Number.isFinite(+fila.valor) ? +fila.valor : null;
};
const _kpi = (I, re) => { const f = (I && I.figs || []).find((g) => !g.entidad && re.test(g.conceptoNorm) && Number.isFinite(g.raw)); return f ? f.raw : null; };
const _figDe = (I, entidad, re) => { const k = normalizar(entidad); const f = (I && I.figs || []).find((g) => g.entidad && normalizar(g.entidad) === k && re.test(g.conceptoNorm) && Number.isFinite(g.raw)); return f ? f.raw : null; };
const _fmtM = (v) => (Math.abs(v) >= 1000 ? `$${(v / 1000).toFixed(1)}M` : `$${Math.round(v)}K`);

export const ESTADOS_DE_LA_CASA = [
  /* ── inventario (SKU): los estados de la Mesa Capital, declarados por la proyección ── */
  { canon: "inmovilizado", eje: "sku", re: /inmoviliz|deten|parad|bloquead|estancad/, prosa: /inmoviliz[a-záéíóúñ]*|detenid[oa]s?|parad[oa]s?|bloquead[oa]s?|estancad[oa]s?/, definicion: "SKU no activo en la Mesa Capital: frenado o en sobrestock", fuente: "estados de la proyección" },
  { canon: "frenado", eje: "sku", re: /frenad/, prosa: /frenad[oa]s?/, definicion: "SKU frenado según la Mesa Capital (capital detenido sin rotación)", fuente: "estados de la proyección" },
  { canon: "sobrestock", eje: "sku", re: /sobrestock|sobre\s*stock|exceso\s+de\s+stock|sobreinventari/, prosa: /sobrestock|sobre\s+stock|sobreinventariad[oa]s?|exceso\s+de\s+stock/, definicion: "SKU en sobrestock según la Mesa Capital", fuente: "estados de la proyección" },
  { canon: "riesgo de quiebre", eje: "sku", re: /riesgo\s+de\s+quiebre|(?:al\s+borde|cerca|a\s+punto)\s+(?:del?\s+)?(?:quiebre|quebrar)|pr[oó]xim[oa]s?\s+a\s+(?:quebrar|quiebre|agotarse)|por\s+quebrar|se\s+(?:le\s+)?(?:acaba|agota)|quiebre\s+pr[oó]ximo/, prosa: /riesgo\s+de\s+quiebre|al\s+borde\s+del\s+quiebre|a\s+punto\s+de\s+quebrar|pr[oó]xim[oa]s?\s+a\s+(?:quebrar|agotarse)|quiebre\s+pr[oó]ximo/, definicion: "SKU en riesgo de quiebre según la Mesa Capital (cobertura bajo el mínimo)", fuente: "estados de la proyección" },
  { canon: "en quiebre", eje: "sku", re: /\ben\s+quiebre\b(?!\s+pr[oó]xim)|\bquebrad[oa]s?\b|desabastecid[oa]s?|sin\s+stock\b|stock\s+(?:en\s+)?(?:cero|0)\b|agotad[oa]s?\b/, prosa: /en\s+quiebre(?!\s+pr[oó]xim)|quebrad[oa]s?|desabastecid[oa]s?|sin\s+stock|agotad[oa]s?/, definicion: "quiebre consumado: unidades en stock = 0 — no es «riesgo de quiebre» (un estado de la Mesa Capital con stock todavía)", fuente: "unidades en stock",
    verificar: (I, ent) => { const u = _figDe(I, ent, /^unidades en stock$|^stock \(unidades\)$|^unidades$/); if (u == null) return null; return { ok: u === 0, verdad: `${ent} · Unidades en stock = ${u}`, evidencia: [`${ent} · Unidades en stock`] }; } },
  { canon: "capital sano", eje: "sku", re: /\bsan[oa]s?\b|saludable|en\s+regla|sin\s+alerta/, prosa: /capital\s+sano|(?:viene|vienen|est[aá]n?|sigue|siguen|queda|quedan)\s+san[oa]s?/, definicion: "SKU sin alerta de la Mesa Capital", fuente: "estados de la proyección" },
  { canon: "critico", eje: "sku", re: /cr[ií]tic/, prosa: /cr[ií]tic[oa]s?(?!\s+(?:para|que|si|en\s+(?:el|la)\s+(?:lectura|decisi))\b)/, definicion: "alerta crítica del dato (la proyección la declara SKU por SKU)", fuente: "estados de la proyección" },
  { canon: "sin venta", eje: "sku", re: /sin\s+venta|sin\s+movimiento|no\s+(?:se\s+)?vende|sin\s+salida|no\s+rota\b/, prosa: /sin\s+venta|sin\s+movimiento|sin\s+salida/, definicion: "días sin venta > 0 en la proyección", fuente: "días de la proyección",
    verificar: (I, ent) => { const d = I && I.dias && I.dias[ent]; if (!d || !Number.isFinite(d.sinVenta)) return null; return { ok: d.sinVenta > 0, verdad: `${ent}: ${d.sinVenta} días sin venta`, evidencia: ["días de la proyección"] }; } },
  { canon: "rota bien", eje: "sku", re: /rota\s+bien|buena\s+rotaci[oó]n|rotaci[oó]n\s+(?:sana|buena|alta)|rota\s+r[aá]pido/, prosa: /rota\s+bien|rota\s+r[aá]pido|buena\s+rotaci[oó]n/, definicion: "rotación ≥ piso de rotación de la POLICY", fuente: "rotación del SKU y piso de rotación", complemento: "rota lento",
    verificar: (I, ent) => { const r = _figDe(I, ent, /^rotacion$/) ?? _deRanking(I, "sku", "rotacion", ent); const piso = _kpi(I, /^piso de rotacion$/); if (r == null || piso == null) return null; return { ok: r >= piso, verdad: `${ent} · Rotación = ${r}x · Piso de rotación = ${piso}x`, evidencia: [`${ent} · Rotación`, "Piso de rotación"] }; } },
  { canon: "rota lento", eje: "sku", re: /rota\s+(?:lento|poco|mal|despacio)|(?:baja|mala|poca)\s+rotaci[oó]n|rotaci[oó]n\s+(?:baja|lenta|pobre)/, prosa: /rota\s+(?:lento|poco|mal|despacio)|(?:baja|mala|poca)\s+rotaci[oó]n/, definicion: "rotación < piso de rotación de la POLICY", fuente: "rotación del SKU y piso de rotación", complemento: "rota bien",
    verificar: (I, ent) => { const r = _figDe(I, ent, /^rotacion$/) ?? _deRanking(I, "sku", "rotacion", ent); const piso = _kpi(I, /^piso de rotacion$/); if (r == null || piso == null) return null; return { ok: r < piso, verdad: `${ent} · Rotación = ${r}x · Piso de rotación = ${piso}x`, evidencia: [`${ent} · Rotación`, "Piso de rotación"] }; } },
  /* ── cobranza (cliente): sobre los rankings de la proyección (saldo vencido, saldo pendiente, recuperado), que traen a TODOS los clientes ── */
  { canon: "al dia", eje: "cliente", re: /\bal\s+d[ií]a\b|sin\s+(?:mora|atrasos?|retrasos?|deuda\s+vencida|saldos?\s+vencidos?|vencid[oa]s?|nada\s+vencido)\b|paga\s+(?:puntual|a\s+tiempo|en\s+(?:plazo|fecha))|cumple\s+(?:con\s+)?(?:los\s+)?plazos|\bvigente\b|regulariz|no\s+(?:tiene|registra|presenta|acumula|arrastra|mantiene)\s+(?:nada\s+vencido|mora|atrasos?|deuda\s+vencida|saldo\s+vencido|vencidos?|facturas\s+vencidas)|no\s+est[aá]\s+en\s+mora|nada\s+vencido|no\s+(?:le\s+|te\s+)?debe\s+nada\s+vencido|no\s+(?:est[aá]|se\s+encuentra)\s+atrasad/, prosa: /\bal\s+d[ií]a\b|sin\s+(?:mora|atrasos?|retrasos?|deuda\s+vencida|saldos?\s+vencidos?|nada\s+vencido)\b|paga\s+(?:puntual|a\s+tiempo|en\s+(?:plazo|fecha))|cumple\s+(?:con\s+)?(?:los\s+)?plazos|(?:est[aá]n?|queda|sigue|se\s+mantiene|saldo)\s+vigente|regulariz[oó]|no\s+(?:tiene|registra|presenta|acumula|arrastra|mantiene)\s+(?:nada\s+vencido|mora|atrasos?|deuda\s+vencida|saldo\s+vencido|vencidos?|facturas\s+vencidas)|no\s+est[aá]\s+en\s+mora|nada\s+vencido|no\s+(?:est[aá]|se\s+encuentra)\s+atrasad[oa]/, definicion: "saldo vencido = 0 (no tiene facturas vencidas; puede tener saldo pendiente por vencer)", fuente: "ranking saldo_vencido", complemento: "en mora",
    verificar: (I, ent) => { const v = _deRanking(I, "cliente", "saldo_vencido", ent); if (v == null) return null; return { ok: v === 0, verdad: `${ent} · Saldo vencido = ${v === 0 ? "$0" : _fmtM(v)}`, evidencia: ["ranking saldo_vencido"] }; } },
  { canon: "en mora", eje: "cliente", re: /\ben\s+mora\b|\bmoros[oa]s?\b|\batrasad[oa]s?\b|con\s+(?:deuda\s+|saldo\s+)?vencid[oa]s?\b|con\s+(?:atrasos?|mora|retrasos?)\b|paga\s+(?:tarde|con\s+atraso|fuera\s+de\s+plazo)|incumple|tiene\s+(?:mora|atrasos?|deuda\s+vencida|saldo\s+vencido|facturas\s+vencidas)/, prosa: /\ben\s+mora\b|\bmoros[oa]s?\b|(?:est[aá]n?|sigue|siguen|queda|quedan|vienen?)\s+atrasad[oa]s?|con\s+(?:atrasos?|mora|retrasos?)\b|paga\s+(?:tarde|con\s+atraso|fuera\s+de\s+plazo)|incumple\s+(?:los\s+)?plazos/, definicion: "saldo vencido > 0", fuente: "ranking saldo_vencido", complemento: "al dia",
    verificar: (I, ent) => { const v = _deRanking(I, "cliente", "saldo_vencido", ent); if (v == null) return null; return { ok: v > 0, verdad: `${ent} · Saldo vencido = ${v === 0 ? "$0" : _fmtM(v)}`, evidencia: ["ranking saldo_vencido"] }; } },
  { canon: "sin deuda", eje: "cliente", re: /sin\s+deuda\b|sin\s+saldo\b|no\s+(?:te\s+|nos\s+|le\s+)?debe\s+nada\b|pag[oó]\s+todo|saldo\s+(?:en\s+)?cero|nada\s+pendiente|no\s+tiene\s+(?:saldo|deuda|nada)\s+pendiente|saldado|cancel[oó]\s+(?:todo|la\s+deuda|el\s+saldo)/, prosa: /sin\s+deuda\b|no\s+(?:te\s+|nos\s+|le\s+)?debe\s+nada\b|pag[oó]\s+todo|saldo\s+(?:en\s+)?cero|nada\s+pendiente|no\s+tiene\s+(?:saldo|deuda|nada)\s+pendiente|cancel[oó]\s+(?:todo|la\s+deuda|el\s+saldo)/, definicion: "saldo pendiente = 0", fuente: "ranking saldo_pendiente",
    verificar: (I, ent) => { const v = _deRanking(I, "cliente", "saldo_pendiente", ent); if (v == null) return null; return { ok: v === 0, verdad: `${ent} · Saldo pendiente = ${v === 0 ? "$0" : _fmtM(v)}`, evidencia: ["ranking saldo_pendiente"] }; } },
  { canon: "sin pagos", eje: "cliente", re: /no\s+ha\s+pagado\s+nada|no\s+pag[oó]\s+nada|sin\s+(?:pagos|abonos)\b|no\s+(?:ha\s+)?abonad|cero\s+abonos|no\s+(?:ha\s+)?recuperad[oa]\s+nada/, prosa: /no\s+ha\s+pagado\s+nada|no\s+pag[oó]\s+nada|sin\s+(?:pagos|abonos)\b|no\s+(?:ha\s+)?abonad[oa]\s+nada|cero\s+abonos/, definicion: "abonado = 0 (recuperado 0 %)", fuente: "ranking recuperado",
    verificar: (I, ent) => { const v = _deRanking(I, "cliente", "recuperado", ent); if (v == null) return null; return { ok: v === 0, verdad: `${ent} · Recuperado = ${v}%`, evidencia: ["ranking recuperado"] }; } },
];

export const ESTADOS_CANON = new Set(ESTADOS_DE_LA_CASA.map((e) => e.canon));
const _porCanon = new Map(ESTADOS_DE_LA_CASA.map((e) => [e.canon, e]));
export const estadoDeLaCasa = (canon) => _porCanon.get(canon) || null;

/** estadoCanon(texto) → el nombre canónico del estado que el texto nombra (o el texto normalizado si no es un estado de la casa) */
export function estadoCanon(t) {
  const s = normalizar(t);
  /* «riesgo de quiebre» antes que «en quiebre» (contiene «quiebre»); el orden de la lista es el de prioridad */
  for (const e of ESTADOS_DE_LA_CASA) if (e.re.test(s)) return e.canon;
  return s;
}
/** ESTADOS: la tabla [re, canon] que la casa exponía antes (compatibilidad) */
export const ESTADOS = ESTADOS_DE_LA_CASA.map((e) => [e.re, e.canon]);

/** compatibles(dicho, otro) → el estado dicho no contradice al otro: iguales, o «inmovilizado» con frenado/sobrestock */
export const estadosCompatibles = (dicho, otro) => dicho === otro || (dicho === "inmovilizado" && (otro === "frenado" || otro === "sobrestock")) || (otro === "inmovilizado" && (dicho === "frenado" || dicho === "sobrestock"));
/** complementoDe(canon) → el estado contrario («al día» ↔ «en mora»), o null */
export const complementoDe = (canon) => { const e = _porCanon.get(canon); return e && e.complemento ? e.complemento : null; };
/** la expresión regular de los PUNTOS de estado en la prosa (todas las formas de todos los estados), sin flags */
export const ESTADO_PROSA_SRC = ESTADOS_DE_LA_CASA.map((e) => e.prosa.source).join("|");
/** la expresión regular con la que se reconocen los estados NOMBRADOS en un texto (fragmentos, predicados, métricas) */
export const ESTADO_NOMBRADO_SRC = ESTADOS_DE_LA_CASA.map((e) => e.re.source).join("|");
/** estadosEn(texto) → los estados canónicos que un texto nombra, en orden de aparición */
export function estadosEn(texto) {
  const s = normalizar(texto);
  const out = [];
  const rx = new RegExp(ESTADO_NOMBRADO_SRC, "g");
  let m; while ((m = rx.exec(s))) { const c = estadoCanon(m[0]); if (ESTADOS_CANON.has(c) && !out.includes(c)) out.push(c); }
  return out;
}
/** verificarEstadoDeLaCasa(canon, I, entidad) → { ok, verdad, evidencia } · null si la definición no se puede demostrar con esta evidencia ·
 *  undefined si el estado no tiene definición propia (los de la Mesa Capital se juzgan por la proyección) */
export function verificarEstadoDeLaCasa(canon, I, entidad) {
  const e = _porCanon.get(canon);
  if (!e || typeof e.verificar !== "function") return undefined;
  return e.verificar(I, entidad);
}
/** definicionesDeEstados() → [{canon, eje, definicion, fuente}] para la carta y los gates */
export const definicionesDeEstados = () => ESTADOS_DE_LA_CASA.map((e) => ({ canon: e.canon, eje: e.eje, definicion: e.definicion, fuente: e.fuente, complemento: e.complemento || null }));
