/* === src/adi/oracle/calculoCatalogo.js · AMPLITUD F2 · LA CALCULADORA DE CATÁLOGO CERRADO (owner 2026-08-13) ==
 * LA DECISIÓN QUE LO GOBIERNA (D1, owner 2026-08-13): calculadora de CATÁLOGO CERRADO ampliable — cada operación
 * nueva entra con su gate; JAMÁS fórmula libre ni evaluador de expresiones. La regla madre: «el LLM propone, el
 * motor calcula, el muro sella». Este módulo es la mitad "el motor calcula": aritmética pura sobre INSUMOS YA
 * RESUELTOS (cifras con origen), sin una sola referencia al dato — el resolvedor de insumos vive en la tool
 * `calcular` (toolRegistry.js), y el verificador del muro (`esCalculoDelCatalogo`) lo consume guardC.
 *
 * LAS CUATRO REGLAS DURAS del catálogo, y dónde vive cada una:
 *   1 · INSUMOS SOLO POR REFERENCIA — acá cada insumo llega como {raw, unit, universo, label, origen}; quién lo
 *       resolvió y de dónde (entidad·métrica del dato, o cifra del usuario con su procedencia) es contrato de la
 *       tool. Este módulo NUNCA recibe un número sin su unidad y su origen.
 *   2 · UNIDADES VERIFICADAS — cada operación declara qué unidades acepta y produce; una combinación incompatible
 *       DECLINA con la razón honesta (jamás convierte en silencio). $ con % no se suman; una participación es
 *       entre montos del mismo mundo.
 *   3 · JAMÁS CRUZA LOS DOS UNIVERSOS — todo par de insumos con universo declarado pasa por `reconcilian`
 *       (figureType.js, la ÚNICA autoridad declarada sobre qué reconcilia con qué): un par «divergent» declina
 *       NOMBRANDO la regla y su razón medida. Venta comercial ÷ inventario no es una cuenta: es una alarma.
 *   4 · RESULTADO CON FORMATEADOR CANÓNICO + FÓRMULA DECLARADA — el valor se formatea vía parseFigures/canon (el
 *       MISMO patrón que datoProyectado.js F1: se le da el crudo al parser y se lee el canon, que se construye
 *       con el _fmtC privado de boleta.js — cero segundo formateador) y cada resultado lleva su fórmula legible
 *       («$776K = $194K × 4pp») para que la respuesta pueda decir de dónde sale la cifra.
 *
 * QUÉ ENVUELVE Y QUÉ NO (revisado ANTES de escribir, como pide el encargo):
 *   · margen_objetivo ejecuta LA MISMA fórmula que marginRead ya sella como «Valor en juego» (specRetrieval:
 *     `venta × benchmark − contribución`), generalizada a una tasa objetivo que puede aportar el usuario (el caso
 *     canónico del gerente: 21% → 25%). No es una segunda aritmética: es la misma cuenta con la vara parametrizada.
 *   · inverse.js (composeInverseProjection) resuelve el problema TRANSPUESTO — qué VENTA hace falta para un
 *     target de contribución en $ a margen constante — y sigue siendo su dueño; el catálogo no lo duplica.
 *   · brecha_pp es la misma resta que guardC._isCalc ya autoriza (benchmark − margen); acá gana nombre, unidades
 *     declaradas y fórmula, para que el PLAN pueda pedirla explícita.
 *
 * PURO · determinístico · sin I/O · sin eval/Function (el gate lo verifica: catálogo cerrado no es un dicho).
 * Importa SOLO: parseFigures (el canon de la boleta) y reconcilian (el contrato de universos). */
import { parseFigures } from "../boleta.js";
import { reconcilian, UNIVERSOS } from "../../config/contract/figureType.js";

// ── LA TOLERANCIA DE REDONDEO ES LA DE _isCalc (guardC.js), NO UNA SEGUNDA ────────────────────────────────────
// La misma expresión, verbatim: si el muro y la calculadora toleraran distinto, una cuenta ejecutada acá podría
// vetarse allá (o al revés). El gate fija que las dos expresiones coinciden.
export const tolCalculo = (raw, unit) =>
  unit === "money" ? Math.max(1000, Math.abs(raw) * 0.02) : (unit === "pct" || unit === "pp") ? 0.2 : unit === "ratio" ? 0.15 : unit === "days" ? 0.6 : 0.05;

// ── EL FORMATEADOR CANÓNICO, SIN UN SEGUNDO FORMATEADOR (mismo patrón que datoProyectado.js) ──────────────────
// parseFigures canoniza toda cifra con el _fmtC privado de boleta.js (canon = `unit:_fmtC(raw,unit)`). Darle el
// crudo en una forma mínima y leer el canon ES usar ese formateador. El % va con UN decimal (la convención del
// producto: ledger.js «SIEMPRE .toFixed(1) para %»); pp igual (la brecha se muestra como «8.1pp»).
export function formatearCanon(raw, unit) {
  const v = unit === "pct" || unit === "pp" ? +(+raw).toFixed(1) : unit === "ratio" ? +(+raw).toFixed(1) : Math.round(+raw);
  const semilla = unit === "money" ? `$${v}` : unit === "pct" ? `${v}%` : unit === "pp" ? `${v}pp` : unit === "days" ? `${v}d` : unit === "ratio" ? `${v}x` : String(v);
  const p = parseFigures(semilla);
  return p.length ? p[0].canon.slice(p[0].canon.indexOf(":") + 1) : semilla;
}

// ── EL CATÁLOGO ───────────────────────────────────────────────────────────────────────────────────────────────
// Cada operación declara: aridad · qué UNIDADES acepta y produce (texto honesto para la declinación) · el
// verificador de unidades (unidadesOk → null si operan, o la razón) · y el ejecutor puro. AMPLIABLE CON GATES
// (D1): una operación nueva = una entrada acá + sus casos bidireccionales en _amplitud_calculadora_gate.mjs.
// `_sujeto(insumos)` — la entidad del cálculo cuando los insumos la comparten (para etiquetar el resultado).
const _MONTOS = ["money", "pp", "count"];   // lo sumable/restable entre sí — jamás $ con % (la tasa no es un monto)

export const OPERACIONES_CALCULO = {
  suma: {
    aridad: 2, produce: "la unidad de los insumos",
    unidades: "dos insumos de la MISMA unidad: $ con $, pp con pp, unidades con unidades — jamás $ con % ni unidades mezcladas",
    unidadesOk: (ins) => (ins[0].unit === ins[1].unit && _MONTOS.includes(ins[0].unit) ? null
      : `suma solo opera ${_MONTOS.join("/")} de la MISMA unidad (llegaron ${ins.map((i) => i.unit).join(" y ")})`),
    ejecutar: (ins) => [{ clave: "suma", raw: ins[0].raw + ins[1].raw, unit: ins[0].unit, operandos: [ins[0], ins[1]], simbolo: "+" }],
  },
  resta: {
    aridad: 2, produce: "la unidad de los insumos",
    unidades: "dos insumos de la MISMA unidad: $ con $, pp con pp, unidades con unidades — jamás $ con %",
    unidadesOk: (ins) => (ins[0].unit === ins[1].unit && _MONTOS.includes(ins[0].unit) ? null
      : `resta solo opera ${_MONTOS.join("/")} de la MISMA unidad (llegaron ${ins.map((i) => i.unit).join(" y ")})`),
    ejecutar: (ins) => [{ clave: "resta", raw: ins[0].raw - ins[1].raw, unit: ins[0].unit, operandos: [ins[0], ins[1]], simbolo: "−" }],
  },
  variacion_pct: {
    aridad: 2, produce: "pct",
    unidades: "de A hacia B, los dos montos de la misma unidad ($ o unidades) — devuelve el % de cambio",
    unidadesOk: (ins) => (ins[0].unit === ins[1].unit && ["money", "count"].includes(ins[0].unit)
      ? (ins[0].raw === 0 ? "no puedo calcular una variación desde cero (el punto de partida es 0)" : null)
      : `variacion_pct opera dos montos de la misma unidad ($ o unidades), llegaron ${ins.map((i) => i.unit).join(" y ")}`),
    ejecutar: (ins) => [{ clave: "variacion", raw: ((ins[1].raw - ins[0].raw) / Math.abs(ins[0].raw)) * 100, unit: "pct", operandos: [ins[1], ins[0]], simbolo: "→" }],
  },
  participacion: {
    aridad: 2, produce: "pct",
    unidades: "A sobre B, los dos montos de la misma unidad y del MISMO universo — devuelve qué % representa",
    unidadesOk: (ins) => (ins[0].unit === ins[1].unit && ["money", "count"].includes(ins[0].unit)
      ? (ins[1].raw === 0 ? "no puedo calcular una participación sobre un total de 0" : null)
      : `participacion opera dos montos de la misma unidad ($ o unidades), llegaron ${ins.map((i) => i.unit).join(" y ")}`),
    ejecutar: (ins) => [{ clave: "participacion", raw: (ins[0].raw / ins[1].raw) * 100, unit: "pct", operandos: [ins[0], ins[1]], simbolo: "÷" }],
  },
  brecha_pp: {
    aridad: 2, produce: "pp",
    unidades: "dos TASAS (%) — devuelve la diferencia en puntos porcentuales, que es una resta de tasas, nunca un % de algo",
    unidadesOk: (ins) => (ins[0].unit === "pct" && ins[1].unit === "pct" ? null
      : `brecha_pp opera dos tasas (%), llegaron ${ins.map((i) => i.unit).join(" y ")}`),
    ejecutar: (ins) => [{ clave: "brecha", raw: ins[0].raw - ins[1].raw, unit: "pp", operandos: [ins[0], ins[1]], simbolo: "−" }],
  },
  // regla de tres / proyección lineal simple: «si 1 punto vale $194K, ¿cuánto valen 4?» — un $ por unidad × un
  // factor SIN unidad de plata (pp o unidades). Deliberadamente NO acepta % como factor: escalar un monto por una
  // tasa es participación/margen_objetivo, y aceptarlo acá abriría la puerta a «venta × margen» disfrazado.
  escalar: {
    aridad: 2, produce: "money",
    unidades: "un monto $ (cuánto vale UNA unidad/punto) × un factor en pp o unidades — proyección lineal simple",
    unidadesOk: (ins) => (ins[0].unit === "money" && ["pp", "count"].includes(ins[1].unit) ? null
      : `escalar opera un monto $ por un factor en pp/unidades (llegaron ${ins.map((i) => i.unit).join(" y ")})`),
    ejecutar: (ins) => [{ clave: "escalado", raw: ins[0].raw * ins[1].raw, unit: "money", operandos: [ins[0], ins[1]], simbolo: "×" }],
  },
  /* «¿Y SI MI VENTA SUBIERA 10%?» (cierre de la certificación amplia 2026-08-13, hallazgo 3 · hilo E turno 5,
   * medido en vivo): la proyección de negocio más común de todas — aplicar una variación % a un monto — no tenía
   * operación en el catálogo: `escalar` la rechaza a propósito (no acepta % como factor) y el turno murió con la
   * razón técnica a pantalla. Entra por la puerta que D1 dejó abierta («catálogo cerrado AMPLIABLE — cada
   * operación nueva entra con su gate»): monto × tasa, con el delta y el proyectado declarados cada uno con su
   * fórmula. NO reemplaza a `escalar` (regla de tres $-por-punto) ni abre «venta × margen»: la tool solo la
   * resuelve por rescate cuando la tasa es DEL USUARIO (una hipótesis con procedencia), jamás una tasa del dato. */
  variacion_aplicada: {
    aridad: 2, produce: "money",
    unidades: "un monto $ y la variación en % a aplicarle — devuelve el cambio en $ y el monto proyectado",
    unidadesOk: (ins) => (ins[0].unit === "money" && ins[1].unit === "pct" ? null
      : `variacion_aplicada opera un monto $ con una tasa % (llegaron ${ins.map((i) => i.unit).join(" y ")})`),
    ejecutar: (ins) => {
      const delta = ins[0].raw * (ins[1].raw / 100);
      return [
        { clave: "delta", raw: delta, unit: "money", operandos: [ins[0], ins[1]], simbolo: "×" },
        { clave: "proyectado", raw: ins[0].raw + delta, unit: "money", operandos: [ins[0], { raw: delta, unit: "money" }], simbolo: "+" },
      ];
    },
  },
  /* «¿CUÁNTO CAPITAL TENGO PARADO HACE MÁS DE 90 DÍAS?» (encargo «umbral del usuario», 2026-08-13 — hallazgo VIVO
   * del owner): la pregunta trae un UMBRAL del usuario sobre un campo por fila, y el motor no tenía ninguna
   * operación que filtre-y-sume — el turno cayó a inventoryStatus, cuyo total es el del criterio INTERNO del motor
   * (estados por rotación/DOH), y ese total salió presentado como si fuera el umbral pedido ($33K como «>90 días»,
   * cuando con diasSinVenta>90 son 2 SKU ≈ $22K). Entra por la puerta que D1 dejó abierta (catálogo cerrado
   * AMPLIABLE con gate): suma un campo MONETARIO de las filas de UN universo cuyo OTRO campo cumple el umbral
   * (>, >=, <, <=) que trae el usuario. Los insumos llegan YA FILTRADOS por la tool (una fila = un insumo, cada
   * una con su entidad en el label — la resolución por referencia y el filtro son de la tool, regla 1); acá solo
   * vive la suma con aridad variable. La REGLA DE LA FASE (verificada por gate): el resultado declara SIEMPRE el
   * criterio COMPLETO en la fórmula y en facts, con las filas que lo componen — un total filtrado sin sus filas
   * es un top-N sin cola. */
  suma_filtrada: {
    aridad: "1+", produce: "money",
    unidades: "las filas ya filtradas de UN universo, todas con su monto en $ — el campo a sumar es monetario y el umbral va declarado en el criterio",
    unidadesOk: (ins) => (ins.every((i) => i.unit === "money") ? null
      : `suma_filtrada solo suma montos $ (llegaron ${[...new Set(ins.map((i) => i.unit))].join(" y ")})`),
    ejecutar: (ins) => [{ clave: "suma_filtrada", raw: ins.reduce((a, i) => a + i.raw, 0), unit: "money", operandos: ins, simbolo: "Σ" }],
  },
  // EL CASO CANÓNICO del gerente (owner 2026-08-13): «la industria debería estar en 25% — ¿qué nos falta?».
  // Insumos: venta ($) · contribución ($) · tasa objetivo (%). Cuatro resultados, cada uno con su fórmula. La
  // cuenta madre es la MISMA que marginRead sella («venta × benchmark − contribución») con la vara parametrizada.
  margen_objetivo: {
    aridad: 3, produce: "pct + pp + money",
    unidades: "la venta ($) y la contribución ($) de la entidad, y la tasa objetivo (%) — devuelve margen actual, brecha en pp y contribución faltante",
    unidadesOk: (ins) => (ins[0].unit === "money" && ins[1].unit === "money" && ins[2].unit === "pct"
      ? (ins[0].raw === 0 ? "no puedo calcular un margen sobre una venta de 0" : null)
      : `margen_objetivo espera venta ($), contribución ($) y tasa objetivo (%) — llegaron ${ins.map((i) => i.unit).join(", ")}`),
    ejecutar: (ins) => {
      const [venta, contrib, obj] = ins;
      const margenActual = (contrib.raw / venta.raw) * 100;
      const contribObjetivo = venta.raw * (obj.raw / 100);
      return [
        { clave: "margen_actual", raw: margenActual, unit: "pct", operandos: [contrib, venta], simbolo: "÷" },
        { clave: "brecha", raw: obj.raw - margenActual, unit: "pp", operandos: [obj, { raw: margenActual, unit: "pct" }], simbolo: "−" },
        { clave: "contribucion_objetivo", raw: contribObjetivo, unit: "money", operandos: [venta, obj], simbolo: "×" },
        { clave: "contribucion_faltante", raw: contribObjetivo - contrib.raw, unit: "money", operandos: [{ raw: contribObjetivo, unit: "money" }, contrib], simbolo: "−" },
      ];
    },
  },
};

// _formula(res) → la fórmula DECLARADA, legible, con los valores canónicos («$776K = $194K × 4pp»).
function _formula(res) {
  const f = (x) => formatearCanon(x.raw, x.unit);
  // Σ (suma_filtrada): N operandos, cada uno con su entidad si el label la trae — la tool completa el criterio.
  if (res.simbolo === "Σ") {
    const partes = res.operandos.map((o) => (o.label ? `${f(o)} (${String(o.label).split("·")[0].trim()})` : f(o)));
    return `${formatearCanon(res.raw, res.unit)} = ${partes.join(" + ")}`;
  }
  const cuerpo = res.simbolo === "→"
    ? `(${f(res.operandos[0])} − ${f(res.operandos[1])}) ÷ ${f(res.operandos[1])}`
    : res.simbolo === "÷"
      ? `${f(res.operandos[0])} ÷ ${f(res.operandos[1])}`
      : `${f(res.operandos[0])} ${res.simbolo} ${f(res.operandos[1])}`;
  return `${formatearCanon(res.raw, res.unit)} = ${cuerpo}`;
}

// ── EL EJECUTOR · ejecutarCalculo(operacion, insumos) ─────────────────────────────────────────────────────────
// insumos: [{ raw, unit, universo?, label?, origen? }] YA RESUELTOS (regla 1: la resolución por referencia es de
// la tool). Devuelve { ok:true, resultados:[{clave, raw, unit, value, formula}] } o { ok:false, razon, regla }.
// `regla` dice CUÁL de las reglas duras declinó — la tool la narra tal cual, honesta.
export function ejecutarCalculo(operacion, insumos) {
  const op = OPERACIONES_CALCULO[String(operacion || "").trim()];
  if (!op) {
    return { ok: false, regla: "catalogo-cerrado", razon: `'${operacion}' no está en el catálogo de cálculo — las operaciones disponibles son: ${Object.keys(OPERACIONES_CALCULO).join(", ")}. No ejecuto fórmulas libres.` };
  }
  const ins = Array.isArray(insumos) ? insumos : [];
  // aridad "1+" = variable (suma_filtrada: una fila filtrada = un insumo); el resto sigue siendo exacta.
  if (op.aridad === "1+" ? ins.length < 1 : ins.length !== op.aridad) {
    return { ok: false, regla: "aridad", razon: op.aridad === "1+"
      ? `'${operacion}' necesita al menos 1 insumo (llegaron ${ins.length}) — ${op.unidades}`
      : `'${operacion}' necesita exactamente ${op.aridad} insumos (llegaron ${ins.length}) — ${op.unidades}` };
  }
  for (const i of ins) if (!i || !Number.isFinite(i.raw) || !i.unit) {
    return { ok: false, regla: "insumo-invalido", razon: "cada insumo tiene que llegar resuelto, con su valor numérico y su unidad — un número sin origen no entra al cálculo" };
  }
  // regla 3 · JAMÁS cruza los dos universos: todo par con universo declarado pasa por el contrato.
  for (let a = 0; a < ins.length; a++) for (let b = a + 1; b < ins.length; b++) {
    const uA = ins[a].universo, uB = ins[b].universo;
    if (!uA || !uB || uA === uB) continue;
    const r = reconcilian(uA, uB);
    if (r.estado === "divergent") {
      const eA = (UNIVERSOS[uA] && UNIVERSOS[uA].etiqueta) || uA, eB = (UNIVERSOS[uB] && UNIVERSOS[uB].etiqueta) || uB;
      return { ok: false, regla: "universos-no-reconcilian", razon: `no opero «${eA}» contra «${eB}»: los dos universos no reconcilian — ${r.razon}` };
    }
  }
  // regla 2 · unidades verificadas: la operación declara qué acepta, y lo que no opera declina con la razón.
  const uViol = op.unidadesOk(ins);
  if (uViol) return { ok: false, regla: "unidades-incompatibles", razon: uViol };
  const crudos = op.ejecutar(ins);
  return {
    ok: true,
    resultados: crudos.map((r) => ({ clave: r.clave, raw: r.raw, unit: r.unit, value: formatearCanon(r.raw, r.unit), formula: _formula(r) })),
  };
}

/* ── EL VERIFICADOR DEL MURO · esCalculoDelCatalogo(raw, unit, pool) ──────────────────────────────────────────
 * La otra mitad de la regla madre («el muro sella»): guardC lo consulta cuando una cifra narrada no está en
 * ninguna fuente — ¿es el resultado EXACTO (con la tolerancia de _isCalc, nunca otra) de una operación del
 * catálogo sobre cifras AUTORIZADAS del turno? El pool llega YA ACOTADO por guardC (mismo principio que
 * _isCalc2: figs de las entidades mencionadas en la narración + fuentes del turno — jamás combinatoria global).
 *
 * QUÉ RECOMPUTA Y QUÉ NO — cada rama espeja UNA operación del catálogo:
 *   pct  → variacion_pct ((b−a)/|a|·100 en ambos sentidos) · participacion (a/b·100)  [suma/resta de tasas ya
 *          las cubre _isCalc nivel 1 con el pool del ledger; acá sería redundante]
 *   pp   → brecha_pp (tasa − tasa) — _isCalc también la ve, pero SOLO sobre el ledger: el pool de acá incluye
 *          las otras fuentes del turno (pregunta/1b/usuario/dato), así que la rama se re-verifica sobre él
 *   money→ escalar ($ × pp/unidades) · margen_objetivo (venta×obj% y venta×obj%−contribución, el trío del caso
 *          canónico) · [suma/resta de montos: _isCalc nivel 1]
 * NADA MÁS: una cifra que no sale de una operación del catálogo sigue vetada. El catálogo crece acá y en la
 * tool JUNTOS, con su gate — nunca uno sin el otro. `suma_filtrada` DELIBERADAMENTE NO SE ESPEJA (encargo
 * «umbral del usuario» 2026-08-13, misma razón medida que el `proyectado` de variacion_aplicada): una suma
 * N-aria sobre el pool es combinatoria pura — con 134 montos en el dato, casi cualquier cifra se volvería
 * «una suma posible» y el muro autorizaría cifras ajenas. Sus resultados SIEMPRE llegan sellados en la boleta
 * de la tool (filas + total); un narrador que sume por su cuenta se veta y repara — conservador a propósito.
 *
 * COTA DURA anti-combinatoria (falso negativo antes que costo): los pools por unidad se recortan a _CAP valores
 * (el pool scopeado real trae ~10-30). El trío de margen_objetivo es el único nivel-3 y queda acotado por la
 * misma cota. Jamás recursivo: un resultado del catálogo NO entra como operando de otro. */
const _CAP = 48;
function _vals(pool, unit) {
  const out = [], vistos = new Set();
  for (const f of pool) {
    if (!f || f.unit !== unit || !Number.isFinite(f.raw)) continue;
    if (vistos.has(f.raw)) continue;
    vistos.add(f.raw);
    out.push(f.raw);
    if (out.length >= _CAP) break;
  }
  return out;
}
export function esCalculoDelCatalogo(raw, unit, pool) {
  if (!Number.isFinite(raw) || !Array.isArray(pool) || !pool.length) return false;
  const tol = tolCalculo(raw, unit);
  if (unit === "pct") {
    const montos = [..._vals(pool, "money"), ..._vals(pool, "count")];
    for (let i = 0; i < montos.length; i++) for (let j = 0; j < montos.length; j++) {
      if (i === j) continue;
      if (montos[i] !== 0 && Math.abs(((montos[j] - montos[i]) / Math.abs(montos[i])) * 100 - raw) <= tol) return true;   // variacion_pct
      if (montos[j] !== 0 && Math.abs((montos[i] / montos[j]) * 100 - raw) <= tol) return true;                            // participacion
    }
    return false;
  }
  if (unit === "pp") {
    const tasas = _vals(pool, "pct");
    for (let i = 0; i < tasas.length; i++) for (let j = 0; j < tasas.length; j++) {
      if (i !== j && Math.abs((tasas[i] - tasas[j]) - raw) <= tol) return true;                                            // brecha_pp
    }
    return false;
  }
  if (unit === "money") {
    const montos = _vals(pool, "money");
    const factores = [..._vals(pool, "pp"), ..._vals(pool, "count")];
    for (const m of montos) for (const f of factores) {
      if (Math.abs(m * f - raw) <= tol) return true;                                                                       // escalar
    }
    const tasas = _vals(pool, "pct");
    for (const venta of montos) for (const p of tasas) {
      const objetivo = venta * (p / 100);
      if (Math.abs(objetivo - raw) <= tol) return true;                                                                    // margen_objetivo · contribución objetivo (≡ variacion_aplicada · delta)
      // variacion_aplicada · proyectado (monto × (1 + %)) DELIBERADAMENTE NO SE ESPEJA ACÁ (cierre cert amplia
      // 2026-08-13, medido en este mismo pase): con la densidad real del dato (F1 §7.1: 134 montos, 17/26 enteros
      // de tasa ocupados), monto×(1+%) sobre el pool colisionaba con cifras ajenas y AUTORIZÓ una cifra con dueño
      // equivocado que la quinta fuente vetaba (el gate del dato-narrador se puso rojo — garantía, no formato).
      // No hace falta: los resultados de variacion_aplicada SIEMPRE llegan sellados en la boleta de la tool (el
      // rescate ejecuta ANTES de narrar), así que el muro los autoriza por la vía de siempre; un narrador que
      // hiciera esa cuenta por su cuenta se veta y repara — conservador a propósito.
      for (const contrib of montos) {
        if (contrib !== venta && Math.abs((objetivo - contrib) - raw) <= tol) return true;                                 // margen_objetivo · contribución faltante
      }
    }
    return false;
  }
  return false;   // ratio/days/count: el catálogo no produce esas unidades — nada que verificar
}
