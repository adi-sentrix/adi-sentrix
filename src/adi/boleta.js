/* === src/adi/boleta.js · ADI Core · BOLETA DE CIFRAS AUTORIZADAS ===
 * La "boleta" es el CONTRATO de cifras que ADI le pasa al LLM #2: la narración premium puede escribir libre,
 * pero SOLO puede usar los `value` de la boleta, verbatim. La arma el COMPOSER (primera clase, misma verdad que
 * el texto determinístico), NO se deriva raspando números. El number-guard valida la narración CONTRA la boleta.
 * Regla madre: ADI calcula y valida; el LLM entiende y narra.
 *
 * Figura de boleta:
 *   { label, value, unit, raw, mandatory, source, formula, context, tipo, canon }
 *   · label     semántico ("Falabella · contribución no capturada")
 *   · value     formateado VERBATIM ("$1.6M") — idéntico a lo que muestra el texto (una sola verdad)
 *   · unit      "money" | "pct" | "ratio" | "days" | "count"
 *   · raw       numérico crudo (referencia/auditoría)
 *   · mandatory la narración DEBE citarla (si falta → bloqueo)
 *   · source    "actual" | "computed"   ← RESERVADO para simulaciones (Fase futura)
 *   · formula   string | null           ← RESERVADO: fórmula auditable ("actual $4.27M × 1.03")
 *   · context   escenario o pregunta ("simulate ventas@cliente +3%")
 *   · tipo      EL TIPO DE LA CIFRA (ver abajo)
 *   · canon     clave canónica "unit:value" para el match unit-aware del guard (interna)
 *
 * EL TIPO (owner 2026-08-09, decisiones 1 y 2). `unit: "money"` NO alcanza: lo comparten la venta comercial (que
 * se almacena en MILES), el inventario (dólares CRUDOS) y el precio unitario ($ por unidad). Con sólo `unit`, esta
 * oración —dos cifras REALES— pasaba el muro entera:
 *     «SAM-TV55 factura $13.3M y sostiene ese volumen con $13K de inventario: menos de un día de cobertura»
 * Por eso TODA cifra emitida por `fig()` declara, sin excepción y sin que el composer tenga que acordarse:
 *     tipo = { unidad, moneda, escala, periodo, escenario, universo, entidad, dimension, fuente,
 *              sello, verificabilidad, verificabilidadRazon }
 * El vocabulario y las reglas viven en config/contract/figureType.js (declaradas, con su evidencia medida); acá
 * sólo se aplican. Es el TIPO, no un guard por ratio: ninguna ruta puede emitir una cifra sin él.
 */
import { deriveFigureType } from "../config/contract/figureType.js";

// formateador canónico · MISMA escala que specRetrieval._money (money en $ CRUDOS)
const _moneyC = (v) => { const a = Math.abs(v), s = v < 0 ? "-" : ""; if (a >= 1e6) return `${s}$${(a / 1e6).toFixed(1)}M`; if (a >= 1e3) return `${s}$${Math.round(a / 1e3)}K`; return `${s}$${Math.round(a)}`; };
const _fmtC = (raw, unit) =>
  unit === "money" ? _moneyC(raw) :
  unit === "pct"   ? `${raw}%` :
  unit === "ratio" ? `${(+raw).toFixed(1)}x` :
  unit === "days"  ? `${Math.round(raw)}d` :
  unit === "pp"    ? `${raw}pp` :
  String(raw);

// fig(label, value, opts) → figura de boleta normalizada. `value` es el string YA formateado por el composer.
// `gancho`: cifra AUTORIZADA que NO está en el texto determinístico (owner 2026-07-09 · fuera la muletilla) —
// contexto opcional para que el narrador la use SOLO si viene al caso. Exenta del check "verbatim en el texto".
//
// OPCIONES DE TIPO (decisiones 1 y 2 · todas OPCIONALES: lo que el composer no declara se DERIVA del contrato, así
// que ningún call-site existente tiene que cambiar y ninguno puede quedarse sin tipo):
//   moneda · escala · periodo · escenario · universo · entidad · dimension · fuente   ← decisión 1
//   sello ("probado"|"indicado"|"abierto") · reconcilia (true = la cuenta CIERRA contra sus componentes)
//   declarada (true = la fuente la declara y el dato no la reconstruye)               ← decisión 2
export function fig(label, value, opts = {}) {
  const {
    unit = "money", raw = null, mandatory = false, source = "actual", formula = null, context = null, gancho = false,
    moneda, escala, periodo, escenario = null, universo, entidad, dimension = null, fuente = null,
    sello = null, reconcilia = null, declarada = false,
    // LA RAZÓN DEL SELLO, cuando el composer sabe algo más específico que la clase (owner 2026-08-12). Sin esto,
    // toda cifra `derivada_no_reconciliada` explicaba lo mismo —«es un supuesto del motor»— y una afinidad de
    // surtido quedaba indistinguible de un promedio ponderado en el prompt del narrador. Opcional como el resto:
    // el que no la declara sigue recibiendo la razón derivada del contrato.
    verificabilidadRazon = null,
    // COBERTURA ESTRUCTURAL (owner 2026-08-11, defecto 2 de la certificación). El alcance de una cifra agregada
    // —total del universo o subtotal de un recorte— lo declara el EMISOR, que es el único que sabe si filtró.
    // Antes viajaba sólo como sufijo del label y el muro lo leía como texto: una etiqueta nueva lo dejaba ciego
    // sin que nadie se enterara. `{ alcance, n, m, universo }` es el campo que no depende de la redacción.
    cobertura = null,
  } = opts;
  const tipo = deriveFigureType({
    label, unit, source, formula,
    moneda, escala, periodo, escenario, universo, entidad, dimension, fuente, sello, reconcilia, declarada,
    verificabilidadRazon,
  });
  return { label, value: String(value), unit, raw, mandatory, source, formula, context, ...(gancho ? { gancho: true } : {}), ...(cobertura ? { cobertura } : {}), tipo, canon: `${unit}:${String(value).replace(/\s/g, "")}` };
}

// isNamedInBoleta(boleta, nombre) → true si ADI NOMBRÓ esa entidad (una cifra de la boleta lleva su nombre en el label).
// Es el ESPEJO Sentrix↔ADI (Frente B · owner 2026-07-06): el panel pinta EXACTAMENTE lo que ADI dijo, y la boleta es la
// fuente de verdad de lo dicho (cada cifra autorizada lleva su entidad en el label). Puro · sin estado · gate-testable.
export function isNamedInBoleta(boleta, nombre) {
  const n = String(nombre == null ? "" : nombre).trim();
  if (n.length < 3 || !Array.isArray(boleta)) return false;
  return boleta.some((f) => f && typeof f.label === "string" && f.label.includes(n));
}

/* ── parseNumeroLocalizado(t) → number · EL SEPARADOR DECIMAL, EN LAS DOS CONVENCIONES ────────────────────────
 * EL DEFECTO QUE CIERRA (hallado 2026-08-10, auditando un rechazo de la certificación): la versión anterior era
 * `parseFloat(t.replace(/,/g, ""))` — borraba TODA coma por considerarla separador de miles. Con eso, el castellano
 * quedaba mal leído por diez o por mil: «8,3%» valía 83% y «$1,6M» valía $16M. Y el reemplazo global tampoco
 * arreglaba el otro lado: «$20.000.000» lo leía `parseFloat` como 20 — veinte dólares.
 * Las dos direcciones son peligrosas y de distinta forma: una RECHAZA una cifra correcta (falso positivo del
 * guard, reintento pagado), y la otra puede DEJAR PASAR una equivocada si su lectura errónea coincide con alguna
 * cifra autorizada. La segunda es peor: es un número mal leído que se presenta como verdad.
 *
 * LA REGLA, sin reemplazos globales y sin adivinar:
 *   1. HAY LOS DOS separadores → el ÚLTIMO es el decimal, el otro es de miles. Cubre `1.234,56` y `1,234.56`.
 *   2. EL MISMO separador REPETIDO → es de miles. Un decimal no aparece dos veces: `1.234.567`, `20.000.000`.
 *   3. UNA sola coma → decimal SALVO que la sigan exactamente 3 dígitos. «8,3»→8.3 · «1,6»→1.6 · «1,600»→1600.
 *   4. UN solo punto → decimal SIEMPRE. Es la convención con que ADI formatea sus propias cifras (ver _moneyC), y
 *      cambiarla reinterpretaría toda boleta ya emitida.
 *
 * EL CASO 3 ES EL ÚNICO GENUINAMENTE AMBIGUO —`$1,600` es 1.600 en inglés y 1,6 en castellano— y se resuelve a
 * favor de la convención que el producto YA usa para escribir. No se adivina por contexto: se declara.
 * NaN para lo que no sea un número, igual que antes: el llamador ya descarta con Number.isFinite.
 */
export function parseNumeroLocalizado(t) {
  const s = String(t == null ? "" : t).trim();
  if (!s) return NaN;
  const puntos = (s.match(/\./g) || []).length;
  const comas = (s.match(/,/g) || []).length;
  if (!puntos && !comas) return parseFloat(s);
  let decimal = null;   // el carácter que actúa de separador decimal en ESTE token, o null si no hay
  if (puntos && comas) decimal = s.lastIndexOf(".") > s.lastIndexOf(",") ? "." : ",";
  else if (comas > 1 || puntos > 1) decimal = null;                       // repetido ⇒ miles
  else if (comas === 1) decimal = /,\d{3}$/.test(s) ? null : ",";         // 3 dígitos exactos ⇒ miles
  else decimal = ".";                                                     // un punto ⇒ decimal (convención de ADI)
  const miles = decimal === "." ? "," : decimal === "," ? "." : /[.,]/g;
  const sinMiles = decimal ? s.split(miles).join("") : s.replace(/[.,]/g, "");
  return parseFloat(decimal === "," ? sinMiles.replace(",", ".") : sinMiles);
}

// parseFigures(text) → [{ unit, raw, text, canon }] · extrae las figuras de la narración CON su unidad (unit-aware).
// Cada figura se re-formatea a su forma canónica (mismo formateador) → "money:$31.6M" ≠ "money:$31.6K" (atrapa drift de escala).
export function parseFigures(text) {
  const s = String(text == null ? "" : text);
  const out = [];
  const push = (unit, raw, txt) => { if (Number.isFinite(raw)) out.push({ unit, raw, text: txt, canon: `${unit}:${_fmtC(raw, unit).replace(/\s/g, "")}` }); };
  const num = parseNumeroLocalizado;
  let m;
  const reMoney = /(-?)\$\s?(\d[\d.,]*\d|\d)\s?([KMB])?/gi;   // -?$X · captura el signo → "-$6K" da raw negativo (canon consistente)
  while ((m = reMoney.exec(s))) { let v = num(m[2]); const u = (m[3] || "").toUpperCase(); if (u === "K") v *= 1e3; else if (u === "M") v *= 1e6; else if (u === "B") v *= 1e9; if (m[1] === "-") v = -v; push("money", v, m[0]); }
  const rePct = /(-?)(\d[\d.,]*\d|\d)\s?%/g;              // -?X% / X.Y% · captura el signo (mismo criterio que reMoney/rePP) → "-2%" canoniza "pct:-2%", igual que toolRegistry.js (simulateGeneral) para deltas negativos
  while ((m = rePct.exec(s))) { let v = num(m[2]); if (m[1] === "-") v = -v; push("pct", v, m[0]); }
  const reRatio = /(\d[\d.,]*\d|\d)\s?(?:x\b|×|veces\b|vez\b)/gi;   // Xx / X× / X veces (× = U+00D7, el que usa el motor; atrapa "13 veces")
  while ((m = reRatio.exec(s))) push("ratio", num(m[1]), m[0]);
  const reDays = /(\d[\d.,]*\d|\d)\s?(?:d\b|d[ií]as?\b)/gi;       // Xd / X días
  while ((m = reDays.exec(s))) push("days", num(m[1]), m[0]);
  // pp = PUNTOS PORCENTUALES (turno 18 del veredicto de 18 turnos, owner 2026-07-29): "5 puntos porcentuales"/
  // "8.1 puntos de margen" son una CIFRA con signo (una brecha) tan real como un "%" — antes eran invisibles a
  // parseFigures (ni bloqueadas ni autorizadas), así que un número inventado en esta forma pasaba el guard entero
  // sin que nadie lo mirara. Acotado a "pp"/"puntos porcentuales"/"puntos de margen·brecha·carga" para NO capturar
  // el uso ya establecido "X puntos por debajo/bajo el benchmark" (frase de brecha ya verificada en producción,
  // permanece invisible al guard igual que antes — no se toca ese camino que ya funciona).
  const rePP = /(-?)(\d[\d.,]*\d|\d)\s?(?:pp\b|puntos?\s+porcentuales?|puntos?\s+de\s+(?:margen|brecha|carga))/gi;
  while ((m = rePP.exec(s))) { let v = num(m[2]); if (m[1] === "-") v = -v; push("pp", v, m[0]); }
  return out;
}

// guardAgainstBoleta(narration, boleta) → { ok, unauthorized[], missing[], reason }
//   A · toda figura de la narración debe estar en la boleta (canónico unit-aware O verbatim). Si no → bloqueo.
//   B · toda figura mandatory de la boleta debe aparecer en la narración. Si falta → bloqueo.
// Atrapa: número inventado, drift de escala/unidad ($M vs $K), ratio garbleado (1.3x → "13 veces"), obligatoria omitida.
export function guardAgainstBoleta(narration, boleta) {
  const authCanon = new Set(boleta.map((f) => f.canon));
  const authVerbatim = new Set(boleta.map((f) => String(f.value).replace(/\s/g, "")));
  const figs = parseFigures(narration);
  const unauthorized = [];
  for (const f of figs) {
    if (!authCanon.has(f.canon) && !authVerbatim.has(String(f.text).replace(/\s/g, ""))) unauthorized.push(f.text);
  }
  const narrCanon = new Set(figs.map((f) => f.canon));
  const narrVerbatim = new Set(figs.map((f) => String(f.text).replace(/\s/g, "")));
  const missing = [];
  for (const f of boleta) {
    if (f.mandatory && !narrCanon.has(f.canon) && !narrVerbatim.has(String(f.value).replace(/\s/g, ""))) missing.push(f.value);
  }
  const ok = unauthorized.length === 0 && missing.length === 0;
  return {
    ok, unauthorized, missing,
    reason: ok ? "narración fiel a la boleta"
      : unauthorized.length ? `cifra(s) fuera de la boleta: ${unauthorized.join(", ")}`
      : `falta(n) cifra(s) obligatoria(s): ${missing.join(", ")}`,
  };
}

// figFor(figs, entidad, metrica) → la fig EXACTA de esa entidad+métrica si ADI ya la citó ESTE turno | null
// (evidenceSpec, owner 2026-07-31 "Sentrix es la evidencia"). ÚNICA forma SANCIONADA de leer un valor ya
// autorizado: si existe, el llamador usa SU .raw/.value verbatim — el recalculo desde el dataset crudo
// (scenarios.js/businessPolicy.js) queda reservado para entidades/métricas que ADI NO mencionó este turno.
// Match normalizado (sin acento/mayúscula) por SEGMENTO del label ("Entidad · Métrica", el mismo separador que
// usa TODO el resto del guard — ver guardC.js `_norm`/`_valueOwners`): la entidad debe calzar un segmento
// completo o como substring de uno (evita que "Falabella" cace a medias "Falabella Retail" por accidente en
// sentido inverso: un segmento MÁS LARGO que la entidad buscada sigue siendo un match honesto, ej. "Falabella ·
// Margen" al buscar "Falabella"); la métrica se busca como substring de CUALQUIER segmento restante (tolera
// "Margen" vs "Margen actual"/"Margen supuesto").
const _normFF = (s) => String(s == null ? "" : s).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
// EXACTO ANTES QUE PARCIAL (owner 2026-08-10, barrido de ambigüedad de términos). El match del concepto era
// `s.includes(met)`, así que un token corto se comía a la etiqueta larga que lo CONTIENE: pedir "Margen" para un
// SKU devolvía «SKU · Margen de inventario» (skuInventario.margenPct, universo de la foto de hoy) porque esa fuente
// se recorre primero, no «SKU · Margen» (skusMargen, el universo comercial que muestra kpis.js). Los dos son
// legítimos y NO reconcilian — por eso tienen nombres distintos; lo que estaba mal era que el lector no distinguía.
// Dos pasadas: primero la igualdad EXACTA de segmento, y sólo si nadie la cumple, el `includes` histórico (que
// sigue haciendo falta para tokens parciales del plan, ej. "contribucion" → "Margen de contribución").
export function figFor(figs, entidad, metrica) {
  if (!Array.isArray(figs) || !entidad || !metrica) return null;
  const ent = _normFF(entidad), met = _normFF(metrica);
  if (!ent || !met) return null;
  const _delaEntidad = (f) => {
    if (!f || typeof f.label !== "string") return null;
    const segs = f.label.split("·").map((s) => _normFF(s));
    return segs.some((s) => s === ent || s.includes(ent)) ? segs : null;
  };
  for (const f of figs) { const segs = _delaEntidad(f); if (segs && segs.some((s) => s === met)) return f; }
  for (const f of figs) { const segs = _delaEntidad(f); if (segs && segs.some((s) => s.includes(met))) return f; }
  return null;
}

// boletaFromText(text) → boleta DERIVADA del texto de un composer SELLADO (rutas del motor: compare de marca/cliente/bodega,
// que no pueden emitir boleta propia sin tocar el motor). Unit-aware: value = la cifra VERBATIM del texto CON su unidad →
// el guard autoriza EXACTAMENTE las cifras de ADI y bloquea drift/garble (1.3× → "13 veces"). El closer del contrato no se toca.
// El `canon` acá NO se recalcula desde el value (por eso no pasa por `fig()`): `parseFigures` ya lo canonizó desde
// el RAW ("94 días" → "days:94d"), y reconstruirlo del texto verbatim rompería el match unit-aware del guard. El
// TIPO sí se deriva igual — una cifra sin tipo es exactamente lo que la decisión 1 prohíbe.
export function boletaFromText(text, { context = null, mandatory = false } = {}) {
  return parseFigures(text).map((f) => ({
    label: f.text, value: f.text, unit: f.unit, raw: f.raw,
    mandatory, source: "actual", formula: null, context,
    tipo: deriveFigureType({ label: f.text, unit: f.unit, source: "actual", formula: null }),
    canon: f.canon,
  }));
}

// ensureBoletaCoversText(boleta, text) → parte de la boleta FIRST-CLASS del composer (labels/mandatory/formula) y AGREGA
// las cifras del texto FINAL que no estén cubiertas (derivadas · las capas de _finalize agregan: suffix proactivo, lead,
// narrativa). Garantiza que la boleta cubra EXACTAMENTE el texto que la narración reformula → self-consistente, flag-independiente.
export function ensureBoletaCoversText(boleta, text, { context = null } = {}) {
  const base = Array.isArray(boleta) ? boleta.slice() : [];
  const seenCanon = new Set(base.map((f) => f.canon));
  const seenVerb = new Set(base.map((f) => String(f.value).replace(/\s/g, "")));
  for (const f of parseFigures(text)) {
    if (!seenCanon.has(f.canon) && !seenVerb.has(String(f.text).replace(/\s/g, ""))) {
      base.push({
        label: f.text, value: f.text, unit: f.unit, raw: f.raw, mandatory: false, source: "actual", formula: null, context,
        tipo: deriveFigureType({ label: f.text, unit: f.unit, source: "actual", formula: null }),
        canon: f.canon,
      });
      seenCanon.add(f.canon);
    }
  }
  return base;
}
