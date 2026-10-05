/* === src/adi/continuidad/revalidar.js · RETOMAR UNA CONVERSACIÓN REVALIDANDO SUS CIFRAS (Etapa 2, bloque 4 · owner 2026-10-04) ═════════
 * `_ADI_DISENO_BLOQUE_4.md`, §0: días después, con datos recargados, la persona retoma el hilo y el anfitrión le dice —en UNA línea y solo si
 * pasó algo— qué cifras de lo que ADI ya le entregó siguen valiendo, cuáles cambiaron (con las dos cifras) y cuáles ya no están. Lo dicho antes
 * queda TAL CUAL: nada de este archivo reescribe una Entrega guardada.
 *
 * LA IDEA CENTRAL: revalidar = volver a hacerle al Core HOY la MISMA pregunta tipada que se le hizo entonces (el Encargo que el libro guardó) y
 * comparar HECHO POR HECHO, por llave y con crudos. No hay un segundo camino de evidencia ni una segunda verdad: la cifra «actual» es la que
 * `consultar` daría hoy. Quien llama (`capacidad/acciones.js:retomar`) hace la re-corrida en UN tramo del Core y le pasa a este módulo el libro de
 * hechos que salió; acá solo se COMPARA — puro, sin I/O, sin red, sin LLM, sin leer una sola frase.
 *
 * LA LLAVE DE COMPARACIÓN (la misma idea de `capacidad/loDeclarado.js:_medidoDe` y de `notario/hechos.js`): tipo de hecho · clave canónica de la
 * métrica · dueño (la entidad, normalizada, o «negocio») · unidad · procedencia. La procedencia entra en la llave a propósito: una simulación publica
 * «Venta actual» (medido) y «Venta supuesta» (derivado) con la misma clave, el mismo dueño y la misma unidad — son dos cifras distintas, y una no se
 * contrasta con la otra.
 *
 * LOS SEIS ESTADOS (cerrados, `ESTADOS_DE_REVALIDACION`):
 *   igual           misma llave y la casa IMPRIME lo mismo (`formatoDeLaCasa`: «verificado no es exacto» — una diferencia por debajo de lo impreso no
 *                   es un aviso) · jamás se declara sin haber comparado crudos
 *   cambio          misma llave, otro valor impreso · trae anterior, actual, diferencia (la calcula ADI, nunca el LLM) y las dos cargas
 *   ya_no_existe    TODAS las partes de la consulta resolvieron hoy y la llave no aparece (la entidad o la métrica salió de los datos) · jamás si la
 *                   consulta no se pudo resolver completa (eso es `sin_reverificar`), ni si la entidad pudo caer de un ranking con corte (eso es
 *                   `no_comparable · otro_universo`: que no figure no prueba que haya salido de los datos)
 *   no_comparable   hay cifras de las dos épocas pero no se pueden restar: otro_periodo · otra_moneda · otra_unidad · otra_referencia · otro_universo
 *                   · trae anterior y, si la hay, actual — JAMÁS diferencia
 *   no_se_revalida  lo que NO se midió (un supuesto, una cifra derivada de un supuesto, un declarado, un documento): no se contrasta con los datos
 *   sin_reverificar no hay con qué: la Entrega es anterior a este bloque, no hay valor exacto, no se pudo repetir la consulta · trae su motivo en
 *                   palabras de negocio · JAMÁS trae `actual`
 *
 * LA SELECCIÓN DE LO QUE LA LÍNEA NOMBRA (owner 2026-10-04, `elegirCambiosANombrar`): la línea nombra hasta 3 cambios y dice cuántos más hay; el
 * detalle completo queda tipado. NO hay un sistema de materialidad ni umbrales: se elige con la PRIORIDAD que la Entrega original ya traía (la de la
 * fila de Cifras, la MISMA con que `entrega/tamano.js` decide qué se recorta: menor = más prioritaria) y la magnitud solo DESEMPATA. */
import { formatoDeLaCasa } from "../notario/hechos.js";
import { normalizar } from "../notario/afirmacion.js";

export const ESTADOS_DE_REVALIDACION = Object.freeze(["igual", "cambio", "ya_no_existe", "no_comparable", "no_se_revalida", "sin_reverificar"]);
export const MOTIVOS_NO_COMPARABLE = Object.freeze(["otro_periodo", "otra_moneda", "otra_unidad", "otra_referencia", "otro_universo"]);
/** cuántos cambios nombra la línea de continuidad (decisión del owner 2026-10-04): del cuarto en adelante solo se dice cuántos hay */
export const CAMBIOS_NOMBRADOS_MAX = 3;

/* ═══ 1 · LAS CIFRAS, DEL LIBRO DE HECHOS ═════════════════════════════════════════════════════════════════════════════════════ */
const _finito = (x) => typeof x === "number" && Number.isFinite(x);

/** cifraDeHecho(H) → { tipo, clave, dueno, unidad, raw, titular, procedencia } | null · lo que el libro de hechos de la Entrega (`entrega.procedencia.libro.porId`) sabe de UN hecho y la
 *  conversación necesita para revalidarlo: el crudo (la ÚLTIMA cifra del hecho: la propia, o el resultado de una derivada), su unidad, la clave canónica de la métrica, el dueño, de quién es el
 *  dato (`origen.titular`) y cómo se obtuvo (`procedencia`). Es la ÚNICA función de origen: la usan quien REGISTRA la Entrega (`acciones.js`) y quien COMPARA (acá), para que la llave sea la misma. */
export function cifraDeHecho(H) {
  if (!H || H.ok === false) return null;
  const numeros = Array.isArray(H.numeros) ? H.numeros : [];
  const n = numeros.length ? numeros[numeros.length - 1] : null;
  const claves = H.claves && typeof H.claves[Symbol.iterator] === "function" ? [...H.claves] : [];
  const sujetos = H.roles && Array.isArray(H.roles.sujetos) ? H.roles.sujetos.filter((s) => typeof s === "string" && s) : [];
  return {
    tipo: typeof H.tipo === "string" ? H.tipo : null,
    clave: claves[0] || null,
    dueno: sujetos.length ? sujetos.join(" + ") : "negocio",
    unidad: n && typeof n.unidad === "string" ? n.unidad : null,
    raw: n && _finito(n.raw) ? n.raw : null,
    titular: H.origen && typeof H.origen.titular === "string" ? H.origen.titular : null,
    procedencia: typeof H.procedencia === "string" ? H.procedencia : null,
  };
}

const _dueno = (d) => String(d == null ? "negocio" : d).split(" + ").map((x) => normalizar(x)).join(" + ");
/** llaveDeCifra({tipo, clave, dueno, unidad, procedencia}) → string · tipo · clave · dueño · unidad · procedencia */
export const llaveDeCifra = (c) => [c.tipo || "", c.clave || "", _dueno(c.dueno), c.unidad || "", c.procedencia || ""].join("|");
const _llaveSinUnidad = (c) => [c.tipo || "", c.clave || "", _dueno(c.dueno), c.procedencia || ""].join("|");

/** encargoParaElLibro(encargo) → el Encargo con el que se entregó, tal como el libro lo conserva para volver a hacerle la misma pregunta al Core: SOLO su parte estructurada. Lo que no se guarda: el id de la
 *  conversación (el libro ya lo tiene), la cita a una Entrega anterior (no cambia ninguna cifra) y la pregunta original (prosa libre: este libro «NO guarda ni una frase»). Copia profunda: lo guardado no comparte
 *  objetos con la petición. */
const CAMPOS_QUE_EL_LIBRO_NO_GUARDA = Object.freeze(["conversacionId", "preguntaOriginal", "contexto"]);
export function encargoParaElLibro(encargo) {
  if (!encargo || typeof encargo !== "object") return null;
  const resto = Object.fromEntries(Object.entries(encargo).filter(([k]) => !CAMPOS_QUE_EL_LIBRO_NO_GUARDA.includes(k)));
  try { return JSON.parse(JSON.stringify(resto)); } catch { return null; }
}

/** referenciasDe({ criteriosAplicados, marco }) → { criterios, marco } · con qué referencia se calculó una Entrega: los criterios que la empresa declaró y confirmó (llave → valor, origen) y la frase de la
 *  referencia declarada que el Marco imprime (el benchmark, el umbral de materialidad). Una brecha de ayer y una de hoy solo son comparables si las dos se calcularon con la misma. */
export function referenciasDe({ criteriosAplicados = [], marco = null } = {}) {
  const criterios = (Array.isArray(criteriosAplicados) ? criteriosAplicados : [])
    .filter((c) => c && typeof c.llave === "string" && _finito(c.valor))
    .map((c) => ({ llave: c.llave, valor: c.valor, origen: c.procedencia && c.procedencia.origen ? c.procedencia.origen : "declarado" }))
    .sort((a, b) => (a.llave < b.llave ? -1 : a.llave > b.llave ? 1 : 0));
  const texto = marco && marco.referenciaDeclarada && typeof marco.referenciaDeclarada.texto === "string" ? marco.referenciaDeclarada.texto : null;
  return { criterios, marco: texto };
}
const _canonDeReferencias = (r) => JSON.stringify({
  criterios: (r && Array.isArray(r.criterios) ? r.criterios : []).map((c) => ({ llave: c.llave, valor: c.valor, origen: c.origen || "declarado" })).sort((a, b) => (a.llave < b.llave ? -1 : a.llave > b.llave ? 1 : 0)),
  marco: r && typeof r.marco === "string" ? r.marco : null,
});
/** mismasReferencias(a, b) → ¿se calcularon con las mismas referencias? (los criterios declarados con su valor y origen, y la frase de la referencia del Marco) */
export const mismasReferencias = (a, b) => _canonDeReferencias(a) === _canonDeReferencias(b);

const _periodoClave = (p) => (p && typeof p === "object" ? `${p.texto || ""}|${p.rango || ""}` : p ? String(p) : "");
const _periodoTexto = (p) => (p && typeof p === "object" ? (p.texto || p.rango || null) : (p || null));

/** cifrasDeLaEntrega(entrega) → [hecho] · las CIFRAS que una Entrega entregó, de a una: la unidad que se revalida. Un hecho del libro es una fila de la tabla de Cifras; una fila común dice UNA cifra y es ella misma
 *  (con el id de siempre, `E<n>.h<k>`); una fila ANCHA (una columna por cifra: «Venta · Margen · Contribución no capturada») guarda en `rv.mas` las demás, y acá cada una sale con su id propio `E<n>.h<k>.<j>` (la
 *  segunda, tercera… cifra de esa fila). Lo guardado antes de este bloque no trae `rv`: sale tal cual, sin nada que revalidar. El hecho que sale NO trae `rv.mas` (ya se abrió en cifras). */
export function cifrasDeLaEntrega(entrega) {
  const out = [];
  for (const h of (entrega && Array.isArray(entrega.hechos) ? entrega.hechos : [])) {
    if (!h || typeof h !== "object") continue;
    const v = h.rv && typeof h.rv === "object" ? h.rv : null;
    if (!v) { out.push(h); continue; }
    const { mas, ...guardada } = v;
    const propia = { titular: "medido", tipo: "ref", ...guardada };   // lo que el libro no escribe por ser lo de siempre
    out.push({ ...h, sujeto: h.sujeto != null ? h.sujeto : (v.sujeto != null ? v.sujeto : null), metrica: h.metrica != null ? h.metrica : (v.metrica != null ? v.metrica : null), valor: h.valor != null ? h.valor : (v.valor != null ? v.valor : null), rv: propia });
    (Array.isArray(mas) ? mas : []).forEach((m, j) => out.push({ id: `${h.id}.${j + 2}`, sujeto: v.sujeto != null ? v.sujeto : h.sujeto || null, metrica: m.metrica != null ? m.metrica : null, valor: m.valor != null ? m.valor : null, unidad: null, periodo: null, origen: h.origen != null ? h.origen : null, ref: m.ref != null ? m.ref : null, rv: { titular: "medido", tipo: "ref", ...m, prioridad: v.prioridad, ...(m.deSupuesto === true ? { deSupuesto: true } : {}) } }));
  }
  return out;
}

/* ═══ 2 · REVALIDAR UNA ENTREGA ═══════════════════════════════════════════════════════════════════════════════════════════════ */
const MOTIVO = Object.freeze({
  supuesto: "un supuesto es de quien lo planteó: no se revalida contra los datos",
  declarado: "lo que la empresa declaró no se contrasta con una medición: no se revalida contra los datos",
  documento: "lo que dice un documento no se revalida contra los datos medidos",
  sinCrudo: "se entregó sin valor exacto",
  antigua: "esta Entrega se guardó antes de que ADI conservara el valor exacto y la pregunta",
  sinRecorrida: "la consulta no se pudo volver a resolver con los datos actuales",
  incompleta: "la consulta ya no se pudo responder completa con los datos actuales",
  ambigua: "la misma cifra aparece más de una vez, con valores distintos, en los datos actuales",
  deListado: "es la suma de las cifras de su listado, que se revalidan una por una: el total no se vuelve a comparar aparte, y no se afirma como vigente",
});
const _motivoDeTitular = (t) => (t === "declarado" ? MOTIVO.declarado : t === "documento" ? MOTIVO.documento : MOTIVO.supuesto);

/** ¿este hecho guardado es de lo que NO se midió? (un supuesto del usuario, algo derivado de un supuesto, un declarado, un documento, una propuesta) */
function _noSeRevalida(v) {
  if (v.deSupuesto === true) return MOTIVO.supuesto;
  if (v.deListado === true) return MOTIVO.deListado;   /* el total de un listado completo (owner 2026-10-05): lo revalidan sus filas, no él */
  if (v.procedencia === "supuesto_usuario" || v.procedencia === "propuesta") return MOTIVO.supuesto;
  if (v.titular && v.titular !== "medido") return _motivoDeTitular(v.titular);
  return null;
}

/* lo que el libro guardó de la cifra: el texto con que se entregó (`valor`) y, aparte (`rv`), el valor exacto y su unidad */
const _anteriorDe = (h) => { const v = h && h.rv ? h.rv : {}; return { valor: h && h.valor != null ? h.valor : null, raw: _finito(v.raw) ? v.raw : null, unidad: v.unidad || null }; };
const _actualDe = (A) => ({ valor: A.texto != null ? A.texto : formatoDeLaCasa(A.raw, A.unidad), raw: A.raw, unidad: A.unidad, hecho: A.id });

/** el texto con que la Entrega ya IMPRIME la cifra de un hecho del libro (la forma de la casa de la tabla de Cifras) */
function _textoDe(libro, H, c, renderDe) {
  const t = typeof renderDe === "function" ? renderDe(libro, H.id) : null;
  return t != null ? t : formatoDeLaCasa(c.raw, c.unidad);
}

/** revalidarEntrega(entregaGuardada, ctx) → { hechos: Map id → revalidacion, resumen }
 *   entregaGuardada = una Entrega del libro: { n, versionId, periodo, moneda, referencias, universos, revalidable, recortada, hechos[] } · cada hecho trae su `rv` (ver `libro.js`)
 *   ctx = {
 *     libroActual         el libro de hechos de la re-corrida de HOY (`entrega.procedencia.libro`) · null si no hubo re-corrida
 *     marcoActual         el Marco de la re-corrida ({periodo, moneda}) · null si no hubo
 *     referenciasActuales `referenciasDe(...)` de hoy
 *     versionIdActual     la carga activa
 *     parteResuelta       true solo si TODAS las partes de la consulta resolvieron hoy
 *     noResuelto          [{campo, valor, motivo}] de la resolución de hoy (primitivos), para decir por qué no
 *     motivoSinRecorrida  texto: por qué no hubo re-corrida (error, consulta que no compone) · null si la hubo
 *     renderDe            `notario/hechos.js:renderDe` (inyectado: este módulo no sabe leer el libro por dentro)
 *   }
 * Cada `revalidacion` = { estado, motivo?, detalle?, anterior, actual?, diferencia?, cargaAnterior?, cargaActual? } con las reglas duras del encabezado. */
export function revalidarEntrega(entrega, ctx = {}) {
  const hechos = new Map();
  const E = entrega && typeof entrega === "object" ? entrega : {};
  const H0 = cifrasDeLaEntrega(E);
  const libroActual = ctx.libroActual && Array.isArray(ctx.libroActual.hechos) ? ctx.libroActual : null;
  const renderDe = ctx.renderDe;
  const marcoActual = ctx.marcoActual || null;
  const versionIdActual = ctx.versionIdActual != null ? ctx.versionIdActual : null;

  /* las cifras de hoy, una sola vez (llave → [{id, texto, ...cifra}]) */
  const deHoy = new Map(), deHoySinUnidad = new Map();
  if (libroActual) {
    for (const H of libroActual.hechos) {
      const c = cifraDeHecho(H);
      if (!c || c.raw == null || !c.clave) continue;
      const item = { id: H.id, texto: _textoDe(libroActual, H, c, renderDe), ...c };
      for (const [mapa, k] of [[deHoy, llaveDeCifra(c)], [deHoySinUnidad, _llaveSinUnidad(c)]]) { if (!mapa.has(k)) mapa.set(k, []); mapa.get(k).push(item); }
    }
  }
  const periodoCambio = Boolean(libroActual && marcoActual && _periodoClave(E.periodo) !== _periodoClave(marcoActual.periodo));
  const mismaReferencia = mismasReferencias(E.referencias, ctx.referenciasActuales);
  /* cuentas que la consulta original SELECCIONÓ con un corte (los N de mayor…): que ya no figuren no prueba que hayan salido de los datos */
  const enUniversoConCorte = (dueno) => (Array.isArray(E.universos) ? E.universos : []).some((u) => u && u.top && Array.isArray(u.entidades) && u.entidades.some((x) => _dueno(x) === _dueno(dueno)));

  const noComparable = (h, motivo, detalle, A) => ({ estado: "no_comparable", motivo, detalle, anterior: _anteriorDe(h), ...(A ? { actual: _actualDe(A), ...(motivo === "otro_periodo" ? { periodoActual: _periodoTexto(marcoActual && marcoActual.periodo) } : {}) } : {}), ...(motivo === "otro_periodo" ? { periodoAnterior: _periodoTexto(E.periodo) } : {}) });
  const sinReverificar = (h, motivo, extra = {}) => ({ estado: "sin_reverificar", motivo, anterior: _anteriorDe(h), ...extra });

  for (const h of H0) {
    if (!h || !h.id) continue;
    let r;
    const v = h.rv && typeof h.rv === "object" ? h.rv : {};
    const motivoSupuesto = _noSeRevalida(v);
    if (motivoSupuesto) r = { estado: "no_se_revalida", motivo: motivoSupuesto, anterior: _anteriorDe(h) };
    else if (!E.revalidable) r = sinReverificar(h, MOTIVO.antigua);
    else if (!_finito(v.raw) || !v.clave) r = sinReverificar(h, MOTIVO.sinCrudo);
    else if (!libroActual) r = sinReverificar(h, ctx.motivoSinRecorrida || MOTIVO.sinRecorrida, ctx.noResuelto && ctx.noResuelto.length ? { noResuelto: ctx.noResuelto } : {});
    else {
      const cifra = { tipo: v.tipo || null, clave: v.clave, dueno: v.dueno, unidad: v.unidad, procedencia: v.procedencia };
      const candidatas = deHoy.get(llaveDeCifra(cifra)) || [];
      const hallada = candidatas[0] || null;
      const otraUnidad = (deHoySinUnidad.get(_llaveSinUnidad(cifra)) || []).find((x) => x.unidad !== v.unidad) || null;

      if (candidatas.length > 1 && candidatas.some((x) => x.raw !== hallada.raw)) r = sinReverificar(h, MOTIVO.ambigua);
      else if (periodoCambio) r = noComparable(h, "otro_periodo", `los datos actuales son de otro período (antes: ${_periodoTexto(E.periodo) || "sin período declarado"}; ahora: ${_periodoTexto(marcoActual.periodo) || "sin período declarado"}): no se comparan cifras de períodos distintos`, hallada);
      else if (!hallada && otraUnidad) r = noComparable(h, "otra_unidad", "la misma cifra hoy se mide en otra unidad: no se comparan", otraUnidad);
      else if (!hallada && ctx.parteResuelta !== true) r = sinReverificar(h, MOTIVO.incompleta, ctx.noResuelto && ctx.noResuelto.length ? { noResuelto: ctx.noResuelto } : {});
      else if (!hallada && enUniversoConCorte(v.dueno)) r = noComparable(h, "otro_universo", "ya no figura entre las cuentas que la consulta selecciona (un ranking con corte): que no aparezca no prueba que haya salido de los datos", null);
      else if (!hallada) r = { estado: "ya_no_existe", anterior: _anteriorDe(h) };
      else if (v.unidad === "money" && E.moneda && marcoActual && marcoActual.moneda && E.moneda !== marcoActual.moneda) r = noComparable(h, "otra_moneda", `la moneda de la Entrega cambió (antes: ${E.moneda}; ahora: ${marcoActual.moneda}): no se comparan`, hallada);
      else if (v.procedencia === "estimacion_referencia" && !mismaReferencia) r = noComparable(h, "otra_referencia", "la referencia con la que se calculó esta cifra cambió: no es un cambio de lo medido, sino de la referencia", hallada);
      else {
        const impresoAntes = formatoDeLaCasa(v.raw, v.unidad), impresoAhora = formatoDeLaCasa(hallada.raw, hallada.unidad);
        if (impresoAntes === impresoAhora) r = { estado: "igual", anterior: _anteriorDe(h) };
        else {
          const d = hallada.raw - v.raw;
          r = {
            estado: "cambio", anterior: _anteriorDe(h), actual: _actualDe(hallada),
            diferencia: { valor: d, texto: formatoDeLaCasa(Math.abs(d), v.unidad === "pct" ? "pp" : v.unidad), sentido: d > 0 ? "sube" : "baja" },
            cargaAnterior: E.versionId != null ? E.versionId : null, cargaActual: versionIdActual,
          };
        }
      }
    }
    hechos.set(h.id, r);
  }
  return { hechos, resumen: resumirRevalidacion([...hechos.values()]) };
}

/** resumirRevalidacion(revalidaciones) → { total, igual, cambio, ya_no_existe, no_comparable, no_se_revalida, sin_reverificar, noComparablePorMotivo } · el conteo por estado (la suma es siempre el total) */
export function resumirRevalidacion(revalidaciones) {
  const lista = Array.isArray(revalidaciones) ? revalidaciones : [];
  const out = { total: lista.length };
  for (const e of ESTADOS_DE_REVALIDACION) out[e] = 0;
  const porMotivo = {};
  for (const r of lista) {
    const e = r && ESTADOS_DE_REVALIDACION.includes(r.estado) ? r.estado : "sin_reverificar";
    out[e]++;
    if (e === "no_comparable" && r.motivo) porMotivo[r.motivo] = (porMotivo[r.motivo] || 0) + 1;
  }
  return { ...out, noComparablePorMotivo: porMotivo };
}

/** reverificadorDe(resultadosPorEntrega) → reverificar(h, ctx) · cumple la firma que `continuidad/retomar.js` ya espera: `resultadosPorEntrega` = Map n → { hechos: Map id → revalidacion }. Un hecho sin resultado
 *  (su Entrega no se revalidó) vuelve `sin_reverificar`: nunca se adivina un veredicto. */
export function reverificadorDe(resultadosPorEntrega) {
  const mapa = resultadosPorEntrega instanceof Map ? resultadosPorEntrega : new Map();
  return (h) => {
    const id = String((h && h.id) || "");   // el id del libro (`E<n>.h<k>`): el `n` dice a qué re-corrida mirar
    const n = id.startsWith("E") && id.includes(".") ? Number(id.slice(1, id.indexOf("."))) : NaN;
    const r = Number.isFinite(n) && mapa.get(n) && mapa.get(n).hechos.get(id);
    if (!r) return { estado: "sin_reverificar", revalidacion: { estado: "sin_reverificar", motivo: MOTIVO.sinRecorrida, anterior: _anteriorDe(h || {}) } };
    return { estado: r.estado, ...(r.actual ? { valorNuevo: r.actual.valor } : {}), revalidacion: r };
  };
}

/* ═══ 3 · QUÉ NOMBRA LA LÍNEA ═════════════════════════════════════════════════════════════════════════════════════════════════ */
/** etiquetaDeCifra(h) → «venta de Lider» · la cifra dicha en palabras de negocio, de lo que la Entrega ya había rotulado */
export function etiquetaDeCifra(h) {
  const m = h && h.metrica ? String(h.metrica).trim() : "";
  const s = h && h.sujeto ? String(h.sujeto).trim() : "";
  const metrica = m ? m.charAt(0).toLowerCase() + m.slice(1) : "";
  return metrica && s ? `${metrica} de ${s}` : (metrica || s || (h && h.id) || "una cifra");
}

/** elegirCambiosANombrar(cambios, { max }) → { ordenados (sin repetir), nombrados (los primeros `max`), adicionales (cuántos más) }
 *  `cambios` = SOLO `cambio` y `ya_no_existe` (los demás estados jamás entran): [{ id, prioridad, orden, unidad, magnitud }]
 *    prioridad  la `.prioridad` de la fila de Cifras de la que salió el hecho (menor = más prioritaria: la de `entrega/tamano.js:gobernarTamano`; sin ella, el orden de aparición en la tabla, el fallback de ese mismo archivo)
 *    orden      la posición de aparición en la conversación (Entrega y hecho) — el último desempate
 *    unidad     la unidad de la cifra
 *    magnitud   |actual − anterior| de un `cambio` (un `ya_no_existe` no tiene: no hay «actual»)
 *    dedup      (opcional) la cifra dicha en palabras con sus dos valores: si la MISMA cifra cambió en dos Entregas (el mismo cliente, la misma métrica, los mismos valores), se nombra UNA vez — la línea no repite
 *  LA REGLA (owner 2026-10-04, SIN materialidad, scoring ni umbrales): (a) manda la prioridad que la Entrega original ya traía; (b) la magnitud SOLO desempata, y solo entre cifras de la MISMA prioridad y la MISMA
 *  unidad (jamás dinero contra porcentaje); (c) el resto del empate, el orden de aparición. Para que sea un orden TOTAL (un comparador que mira unidades a medias no lo es), dentro de una misma prioridad las
 *  unidades se agrupan en el orden en que aparece cada una por primera vez, y dentro de cada grupo manda la magnitud. Puro y determinístico. */
export function elegirCambiosANombrar(cambios, { max = CAMBIOS_NOMBRADOS_MAX } = {}) {
  const lista = (Array.isArray(cambios) ? cambios : []).filter((c) => c && c.id != null).map((c, i) => ({ ...c, _i: i, _orden: _finito(c.orden) ? c.orden : i, _prioridad: _finito(c.prioridad) ? c.prioridad : (_finito(c.orden) ? c.orden : i) }));
  const primeraDeUnidad = new Map();   // «prioridad|unidad» → la primera aparición de esa unidad dentro de esa prioridad
  for (const c of lista) { const k = `${c._prioridad}|${c.unidad || ""}`; if (!primeraDeUnidad.has(k) || c._orden < primeraDeUnidad.get(k)) primeraDeUnidad.set(k, c._orden); }
  const magnitud = (c) => (_finito(c.magnitud) ? Math.abs(c.magnitud) : 0);
  const ordenados = lista.slice().sort((a, b) =>
    a._prioridad - b._prioridad
    || primeraDeUnidad.get(`${a._prioridad}|${a.unidad || ""}`) - primeraDeUnidad.get(`${b._prioridad}|${b.unidad || ""}`)
    || magnitud(b) - magnitud(a)
    || a._orden - b._orden
    || a._i - b._i);
  const vistas = new Set();
  const unicos = ordenados.filter((c) => { if (c.dedup == null) return true; if (vistas.has(c.dedup)) return false; vistas.add(c.dedup); return true; });
  const tope = Math.max(0, Number.isFinite(max) ? Math.floor(max) : CAMBIOS_NOMBRADOS_MAX);
  const limpiar = ({ _i, _orden, _prioridad, ...c }) => c;
  return { ordenados: unicos.map(limpiar), nombrados: unicos.slice(0, tope).map(limpiar), adicionales: Math.max(0, unicos.length - tope) };
}
