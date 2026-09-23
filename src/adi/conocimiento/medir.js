/* === src/adi/conocimiento/medir.js · ¿ESTÁ OCURRIENDO? (Business Knowledge v0.2, Parte A §1 + Parte B §2) ═══════
 * «Cada pieza pertinente nombra el cálculo que lo decide y se sirve en uno de tres estados... Ningún dígito lo
 * escribe la capa. La capa pide el cálculo al motor por nombre; el motor lo publica como hecho y la capa cita
 * su id. Si el cálculo no existe, el estado es "no se puede saber", nunca una cifra propia.»
 *
 * medirPieza(pieza, entidad, tabla) → { estado, cifra, referencia, motivo, resolveria, hechos, libro }
 *
 * REGLAS DURAS (documento §2, textual):
 *   · `indeterminable` si falta cualquier insumo o si `existe_en_motor: false` (y no es derivado barato — ver
 *     abajo).
 *   · `no_ocurre` SOLO si `decisivo: true`. Si `decisivo: false` y el comparador da falso → `indeterminable`
 *     con motivo «la cifra disponible no decide».
 *   · TODA cifra servida es un HECHO VERIFICADO por `notario/hechos.js` — nunca un número que esta capa calculó
 *     y declaró por su cuenta.
 *
 * ═══ CORRECCIÓN 2026-09-23 (owner): «un mini-libro propio imita la forma pero no pasa por la verificación» ═════
 * La primera versión de este archivo tenía su propio `_libro()` — un tracker liviano que asignaba ids y una
 * "procedencia" a mano. Eso ERA exactamente el patrón de segunda fuente de verdad que el proyecto prohíbe: un
 * error aritmético acá habría servido una cifra falsa con la autoridad de ADI, y ningún candado lo habría
 * atrapado. Se retiró por completo.
 *
 * LA SONDA (antes de reescribir, como pide la regla de la casa — «medí antes de afirmar»):
 *   1 · `descomposicionDeBrecha` (specRetrieval.js) publica el EXCESO en $ de carga solo para las cuentas que
 *       EXCEDEN el nivel declarado ("· Carga comercial alta") — no una carga % de cada cliente. PERO: un hecho
 *       `{tipo:"cifra", sujeto:<cliente>, metrica:"carga"}` SÍ verifica para LAS 13 cuentas del demo, incluidas
 *       las que no exceden el nivel — `notario/hechos.js:_figDe` cae a la PROYECCIÓN por ranking
 *       (`valorDeRanking`) cuando la boleta no trae una fig literal, y esa proyección lee la carga % de
 *       `datoProyectado.rankings`, publicada por el mismo `descomposicionDeBrecha`. Probado con las 13 cuentas
 *       reales del demo: las 13 verifican `veredicto:"verdadera"`.
 *   2 · «grupo» con `agregado:"promedio"` (hechos.js `_ENUM.agregado`, verificar.js:893) SÍ existe, pero es un
 *       verificador de una afirmación YA HECHA (necesita un `valor` declarado para contrastar) — no una función
 *       que DERIVE el promedio. Para "el promedio de las demás cuentas" (que esta capa necesita CALCULAR, no
 *       verificar una frase ajena) el camino correcto es el que permite el documento mismo (Parte B §1:
 *       «relaciones entre dos hechos, sin umbral: mayor(a,b) · menor(a,b)»): pedir CADA cifra individual como un
 *       hecho `cifra` verificado por separado (case 1) y promediar EN ESTA CAPA sobre números que YA verificó
 *       `notario/hechos.js` uno por uno — la capa no inventa ningún dígito, solo los agrega y los compara.
 *   3 · La participación cruzada (venta/vencido) SÍ se expresa como `razon` — y SÍ reconcilia cruzando comercial
 *       y cobranza (`hechos.js:_reconcilian`: esos dos dominios SÍ se dividen entre sí; la ley del owner sobre
 *       «nombrar los dos marcos, nunca sumar» rige la SUMA entre dominios, no el cociente, que es justo la
 *       operación que mide EXPOSICIÓN — el propio negocio de PRI-04). Probado: `razon` con
 *       `num:{sujeto:"Lider",metrica:"ventas"}` / `den:{sujeto:"negocio",metrica:"ventas"}` verifica
 *       `veredicto:"verdadera"` contra "Ventas totales" resuelta por la MISMA proyección de ranking — sin que
 *       ninguna boleta trajera una fig literal de "Ventas totales".
 *   4 · Vencido por tramo de antigüedad (CAU-03) sigue sin existir — confirmado, sin cambios (ver piezas.js).
 *
 * RESULTADO: `cargaCuentaVsResto` y `participacionCruzada` declaran hechos `cifra`/`razon` REALES y los verifica
 * `libroDeHechos` sobre el índice de evidencia compartido (`tabla._indice`, construido en tablaSenales.js sobre
 * la UNIÓN de las boletas comercial+cobranza+inventario — el MISMO módulo, `notario/evidencia.js`, que usa
 * `src/adi/entrega/componer.js`). Si el índice falta, o un hecho no verifica, la pieza mide "no se puede saber"
 * — nunca una cifra sin verificar. */
import { libroDeHechos } from "../notario/hechos.js";

/* el número crudo de un hecho YA VERIFICADO por `libroDeHechos` (h.ok === true): para `cifra` es el único valor
 * declarado; para `razon` es el ÚLTIMO de los tres (numerador, denominador, razón) — ver hechos.js:_razon, que
 * empuja exactamente en ese orden. Nunca se lee de un hecho que no verificó. */
function _crudo(h) {
  if (!h || !h.ok || !Array.isArray(h.numeros) || !h.numeros.length) return null;
  const n = h.numeros[h.numeros.length - 1];
  return n && Number.isFinite(n.raw) ? n.raw : null;
}
const _cita = (h) => (h && h.ok ? { id: h.id, texto: h.render && h.render.valor } : null);

/* ── los cálculos con nombre (Parte B §4 — "derivado barato": funciones puras sobre lo que el motor ya publica
 * Y ya verificó; el trabajo de esta capa es publicar la COMPARACIÓN, nunca la cifra). Cada uno devuelve
 * { insuficiente, motivo, resolveria, condicion: true|false|null, citas: [{id,texto}], referenciaTexto,
 * hechosDeApoyo: [id,...] }. `condicion` es el resultado de la relación (mayor/menor/pertenece) — nunca un
 * número que esta capa inventó: sale de comparar `raw`s que YA verificó `libroDeHechos`. ── */
const CALCULOS = {
  cargaCuentaVsResto(entidad, tabla) {
    const I = tabla && tabla._indice;
    if (!I) return { insuficiente: true, motivo: "no hay índice de evidencia para verificar la carga comercial de esta boleta", resolveria: "reconstruir la tabla de señales con la boleta comercial disponible" };
    const otras = Object.keys((tabla && tabla.cuentas) || {}).filter((e) => e !== entidad);
    if (!otras.length) return { insuficiente: true, motivo: `no hay otras cuentas con las que promediar la carga comercial de ${entidad}`, resolveria: "cargar el resto de la cartera" };

    const hechos = [
      { id: "carga_propia", tipo: "cifra", sujeto: entidad, metrica: "carga" },
      ...otras.map((e, i) => ({ id: `carga_resto_${i}`, tipo: "cifra", sujeto: e, metrica: "carga" })),
    ];
    const libro = libroDeHechos(hechos, { indice: I });
    const propio = libro.hechos[0];
    const resto = libro.hechos.slice(1).filter((h) => h.ok);

    if (!propio || !propio.ok) return { insuficiente: true, motivo: `la carga comercial de ${entidad} no se pudo verificar en la boleta (${propio ? propio.motivo : "sin hecho"})`, resolveria: "correr marginRead/diagnose para esta cuenta" };
    if (!resto.length) return { insuficiente: true, motivo: "ninguna de las demás cuentas verificó su carga comercial para calcular el promedio", resolveria: "correr marginRead/diagnose para el resto de la cartera" };

    const propioRaw = _crudo(propio);
    const promedioResto = resto.reduce((s, h) => s + _crudo(h), 0) / resto.length;
    return {
      insuficiente: false,
      condicion: propioRaw > promedioResto,
      citas: [_cita(propio)],
      referenciaTexto: `${promedioResto.toFixed(1)}% (promedio de ${resto.length} de ${otras.length} cuentas verificadas — cada una, un hecho verificado por separado)`,
      hechosDeApoyo: resto.map((h) => h.id),
    };
  },

  skuFrenadoVsTopSeller(entidad, tabla) {
    const s = tabla && tabla.skus && tabla.skus[entidad];
    if (!s) return { insuficiente: true, motivo: `${entidad} no aparece en la boleta de inventario de este turno`, resolveria: "correr inventoryStatus{focus:frenado} para este SKU" };
    if (s.topSeller == null) return { insuficiente: true, motivo: `no se pudo cruzar ${entidad} contra el ranking de venta (top_sellers)`, resolveria: "correr inventoryStatus{focus:top_sellers} — el cruce por SKU de crucePorSku.js" };
    // esto NO es un dígito: es pertenencia a un conjunto (¿el SKU aparece en la boleta certificada de
    // "los que más venden"?). Cuando pertenece, se cita el hecho REAL (su fig de Venta, verificada); cuando no
    // pertenece, no hay cifra que citar — es la AUSENCIA de una fig en una boleta ya certificada, no un número
    // que esta capa calculó. Se declara así, sin fingir un id de libro que no existe.
    const I = tabla && tabla._indice;
    if (s.topSeller === true && I) {
      const figVenta = ((tabla._figs && tabla._figs.inventarioTop) || []).find((f) => new RegExp(`^${entidad.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")} · Venta$`, "i").test(String(f.label || "")));
      if (figVenta && figVenta.id) {
        const libro = libroDeHechos([{ id: "top_seller_venta", tipo: "ref", de: figVenta.id }], { indice: I });
        const h = libro.hechos[0];
        if (h && h.ok) return { insuficiente: false, condicion: true, citas: [{ id: h.id, texto: `entre los SKU que más venden (${h.render.valor})` }], referenciaTexto: "pertenencia al ranking de SKU que más venden", hechosDeApoyo: [] };
      }
    }
    return { insuficiente: false, condicion: s.topSeller === true, citas: [{ id: null, texto: s.topSeller ? "entre los SKU que más venden" : "fuera de los SKU que más venden (ausente en la boleta certificada de top sellers)" }], referenciaTexto: "pertenencia al ranking de SKU que más venden", hechosDeApoyo: [] };
  },

  vencidoPorTramoDeAntiguedad() {
    // verificado antes de sembrar la pieza (ver piezas.js, CAU-03): el dato NO trae tramos de antigüedad —
    // cobranza.js lo declara como límite textual. `existe_en_motor: false` ya cierra esto en `medirPieza`
    // antes de llegar acá; esta rama solo documenta el motivo para quien invoque el cálculo directamente.
    return { insuficiente: true, motivo: "el dato no trae vencido por tramo de antigüedad — solo un saldo vencido total por cliente (verificado en src/adi/agente/playbooks/cobranza.js)", resolveria: "declarar antigüedad por tramo en la ingesta de cobranza (no existe hoy)" };
  },

  participacionCruzada(entidad, tabla) {
    const I = tabla && tabla._indice;
    if (!I) return { insuficiente: true, motivo: "no hay índice de evidencia para verificar la participación de esta cuenta", resolveria: "reconstruir la tabla de señales con las boletas comercial y de cobranza disponibles" };
    const c = tabla && tabla.cuentas && tabla.cuentas[entidad];
    if (!c || c.vencido == null || c.venta == null) return { insuficiente: true, motivo: `falta el vencido o la venta de ${entidad} para calcular su participación`, resolveria: "correr la boleta de cobranza y la comercial para esta cuenta" };

    const hechos = [
      { id: "part_venta", tipo: "razon", num: { sujeto: entidad, metrica: "ventas" }, den: { sujeto: "negocio", metrica: "ventas" }, forma: "pct" },
      { id: "part_vencido", tipo: "razon", num: { sujeto: entidad, metrica: "saldo_vencido" }, den: { sujeto: "negocio", metrica: "saldo_vencido" }, forma: "pct" },
    ];
    const libro = libroDeHechos(hechos, { indice: I });
    const [hVenta, hVencido] = libro.hechos;
    if (!hVenta || !hVenta.ok) return { insuficiente: true, motivo: `la participación en venta de ${entidad} no se pudo verificar (${hVenta ? hVenta.motivo : "sin hecho"})`, resolveria: "declarar la venta total de la cartera y de la cuenta" };
    if (!hVencido || !hVencido.ok) return { insuficiente: true, motivo: `la participación en vencido de ${entidad} no se pudo verificar (${hVencido ? hVencido.motivo : "sin hecho"})`, resolveria: "declarar el vencido total de la cartera y de la cuenta" };

    const pVenta = _crudo(hVenta), pVencido = _crudo(hVencido);
    return {
      insuficiente: false,
      condicion: pVencido > pVenta,
      citas: [_cita(hVencido)],
      referenciaTexto: `${hVenta.render.valor} de participación en la venta`,
      hechosDeApoyo: [hVenta.id],
    };
  },
};

export const CALCULOS_DISPONIBLES = Object.freeze(Object.keys(CALCULOS));

/** medirPieza(pieza, entidad, tabla) → { estado, cifra, referencia, motivo, resolveria, decisivo, noExcluye,
 *  calculo, hechos, libro } — la medición de UNA pieza sobre UNA entidad (ya sabida pertinente por
 *  `evaluarPertinencia`; este módulo no vuelve a evaluar pertinencia). Toda cifra que sale de acá YA pasó por
 *  `notario/hechos.js:libroDeHechos` — nada se calcula ni se declara por fuera de esa verificación. */
export function medirPieza(pieza, entidad, tabla) {
  const m = (pieza && pieza.medicion) || {};
  const decisivo = m.decisivo === true;
  const noExcluye = typeof m.no_excluye === "string" ? m.no_excluye : null;

  // «existe_en_motor: false» solo cierra la medición cuando ADEMÁS no es un derivado barato de esta capa (§4 B
  // del documento: la tabla de señales y sus derivados —cargaCuentaVsResto, participacionCruzada…— SON el
  // trabajo de esta capa, «publicar, no calcular» sobre lo que el motor ya sostiene Y ya verifica). El esquema
  // de PRI-04 en el documento (§5) es literal: `existe_en_motor: false, derivado_barato: true`. Sin
  // `derivado_barato`, `existe_en_motor: false` es la puerta de siempre (CAU-03: ni en el motor ni derivable).
  if (m.existe_en_motor !== true && m.derivado_barato !== true) {
    return {
      estado: "indeterminable",
      cifra: null, referencia: null,
      motivo: `el cálculo "${m.calculo || "(sin nombre)"}" no existe en el motor hoy ni es un derivado barato de esta capa`,
      resolveria: (Array.isArray(m.insumos) && m.insumos.length) ? m.insumos.join(" · ") : "declarar el insumo que falta",
      decisivo, noExcluye, calculo: m.calculo || null, hechos: [],
    };
  }
  const fn = CALCULOS[m.calculo];
  if (typeof fn !== "function") {
    return {
      estado: "indeterminable", cifra: null, referencia: null,
      motivo: `"${m.calculo}" no está en el catálogo de cálculos de esta capa (¿falta implementarlo?)`,
      resolveria: "implementar el cálculo con nombre en medir.js antes de servir esta pieza",
      decisivo, noExcluye, calculo: m.calculo || null, hechos: [],
    };
  }

  const r = fn(entidad, tabla);
  if (r.insuficiente) {
    return {
      estado: "indeterminable", cifra: null, referencia: null,
      motivo: r.motivo, resolveria: r.resolveria || null,
      decisivo, noExcluye, calculo: m.calculo, hechos: [],
    };
  }

  const hechosDeApoyo = r.hechosDeApoyo || [];
  if (r.condicion == null) {
    return {
      estado: "indeterminable", cifra: r.citas && r.citas[0] ? r.citas[0] : null, referencia: null,
      motivo: "la relación no se pudo evaluar con los datos disponibles", resolveria: null,
      decisivo, noExcluye, calculo: m.calculo, hechos: hechosDeApoyo,
    };
  }

  if (r.condicion === true) {
    return {
      estado: "ocurre",
      cifra: r.citas[0] || null, referencia: { texto: r.referenciaTexto, hechos: hechosDeApoyo },
      motivo: null, resolveria: null,
      decisivo, noExcluye, calculo: m.calculo, hechos: hechosDeApoyo,
    };
  }

  // r.condicion === false
  if (!decisivo) {
    return {
      estado: "indeterminable",
      cifra: r.citas[0] || null, referencia: { texto: r.referenciaTexto, hechos: hechosDeApoyo },
      motivo: "la cifra disponible no decide (medición no decisiva)", resolveria: null,
      decisivo, noExcluye, calculo: m.calculo, hechos: hechosDeApoyo,
    };
  }
  return {
    estado: "no_ocurre",
    cifra: r.citas[0] || null, referencia: { texto: r.referenciaTexto, hechos: hechosDeApoyo },
    motivo: null, resolveria: null,
    decisivo, noExcluye, calculo: m.calculo, hechos: hechosDeApoyo,
  };
}
