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
import { libroDeHechos, peorProcedencia, formatoDeLaCasa } from "../notario/hechos.js";
import { pisoMaterialidadCobranzaDe, BORDE_FACTOR_INFERIOR, BORDE_FACTOR_SUPERIOR } from "../../config/contract/pisoMaterialidadCobranza.js";
import { getTenantData } from "../../data/tenantStore.js";

/* el número crudo de un hecho YA VERIFICADO por `libroDeHechos` (h.ok === true): para `cifra` es el único valor
 * declarado; para `razon` es el ÚLTIMO de los tres (numerador, denominador, razón) — ver hechos.js:_razon, que
 * empuja exactamente en ese orden. Nunca se lee de un hecho que no verificó. */
function _crudo(h) {
  if (!h || !h.ok || !Array.isArray(h.numeros) || !h.numeros.length) return null;
  const n = h.numeros[h.numeros.length - 1];
  return n && Number.isFinite(n.raw) ? n.raw : null;
}
const _cita = (h) => (h && h.ok ? { id: h.id, texto: h.render && h.render.valor } : null);

/* ── PRI-04 · PISO DE MATERIALIDAD DE COBRANZA (owner 2026-09-23, diseño sellado) — helpers compartidos entre
 * el cálculo por cuenta y la línea de cobertura del cierre (`coberturaPisoDeCobranza`, exportada más abajo). ── */

/* el universo evaluable (regla 2 del sello: «solo clientes con plazo de pago declarado»), sobre el LIBRO
 * COMPLETO de la tabla de señales — nunca sobre el subconjunto que la Respuesta nombra. `tabla.cuentas[e]
 * .tienePlazoDeclarado` lo publica `tablaSenales.js` (true = hay fig "· Saldo vencido" para esa cuenta; false =
 * hay saldo pendiente pero ninguna fig de vencido — sin plazo; ausente = sin evidencia de saldo pendiente). */
function _universoDePiso(tabla) {
  const cs = (tabla && tabla.cuentas) || {};
  const evaluables = [], sinPlazo = [];
  for (const e of Object.keys(cs)) {
    const c = cs[e];
    if (c.saldoPendiente == null) continue;
    if (c.tienePlazoDeclarado === true) evaluables.push(e);
    else if (c.tienePlazoDeclarado === false) sinPlazo.push(e);
  }
  return { evaluables, sinPlazo };
}

/* una SUMA verificada de `metrica` sobre `lista` de entidades — un hecho `derivada` (op:"suma") cuando hay dos o
 * más, la `cifra` directa cuando hay una sola, y un hecho sintético de $0 (procedencia "derivado": un total
 * sobre un conjunto vacío es un cálculo del motor, no una lectura) cuando la lista está vacía. Devuelve el
 * hecho YA VERIFICADO por `libroDeHechos`, o `null` si no verificó — nunca un número que esta capa calculó por
 * su cuenta. */
function _sumaVerificada(id, lista, metrica, I) {
  if (!lista.length) return { id, ok: true, tipo: "derivada", resultado: { raw: 0, unidad: "money", texto: "$0" }, render: { valor: "$0" }, procedencia: "derivado", numeros: [{ raw: 0, unidad: "money", texto: "$0" }] };
  if (lista.length === 1) {
    const libro = libroDeHechos([{ id, tipo: "cifra", sujeto: lista[0], metrica }], { indice: I });
    const h = libro.hechos[0];
    return h && h.ok ? h : null;
  }
  const libro = libroDeHechos([{ id, tipo: "derivada", op: "suma", de: lista.map((e) => ({ sujeto: e, metrica })) }], { indice: I });
  const h = libro.hechos[0];
  return h && h.ok ? h : null;
}

/* un hecho YA VERIFICADO, reempaquetado como operando CONSTANTE (con su procedencia YA calculada) para una
 * razón/derivada siguiente — la «operación nueva mínima» que permite encadenar hechos sin releer texto
 * redondeado (owner 2026-09-23; ver `notario/hechos.js:_operandoConstante`). */
function _constOperando(H, label, concepto) {
  const raw = H.resultado ? H.resultado.raw : _crudo(H);
  const unidad = H.resultado ? H.resultado.unidad : ((H.numeros && H.numeros.length) ? H.numeros[H.numeros.length - 1].unidad : "money");
  const texto = (H.render && H.render.valor) || (H.resultado && H.resultado.texto) || formatoDeLaCasa(raw, unidad);
  return { raw, unidad, texto, procedencia: H.procedencia, label: label || H.id, concepto: concepto || H.id, entidad: "negocio" };
}

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

  /* ── PRI-04 · EL PISO DE MATERIALIDAD DE COBRANZA (owner 2026-09-23, diseño sellado — cinco reglas) ──────────
   * Para la cuenta `entidad`: D_c = (participación en el vencido − participación en la venta) × vencido total,
   * las dos participaciones sobre el UNIVERSO EVALUABLE completo (regla 2). Material ⟺ D_c ≥ k × P, con
   * P = saldo pendiente del universo evaluable y k el criterio de materialidad (ADI por defecto, ajustable por
   * la empresa — `pisoMaterialidadCobranza.js`). NUNCA "no_ocurre": `estadoFalso: "bajo_piso"` le dice a
   * `medirPieza` que el veredicto negativo es "bajo el piso" (afirma la diferencia y el piso, nunca "no ocurre"
   * — regla 3). Cada cifra que sale de acá pasó por `libroDeHechos`; el único número que esta función declara
   * sin pasar por una fig es `k` (el criterio de materialidad), declarado como OPERANDO CONSTANTE con su propia
   * procedencia (`_operandoConstante`, notario/hechos.js) — nunca como un dígito servido sin dueño. */
  pisoMaterialidadCobranza(entidad, tabla) {
    const I = tabla && tabla._indice;
    if (!I) return { insuficiente: true, motivo: "no hay índice de evidencia para verificar el piso de materialidad de cobranza", resolveria: "reconstruir la tabla de señales con la boleta de cobranza disponible" };
    const c = tabla.cuentas && tabla.cuentas[entidad];
    if (!c || c.saldoPendiente == null) return { insuficiente: true, motivo: `${entidad} no tiene saldo pendiente en la boleta de cobranza de este turno`, resolveria: "correr la boleta de cobranza para esta cuenta" };
    if (c.tienePlazoDeclarado !== true) return { insuficiente: true, motivo: `${entidad} no tiene plazo de pago declarado: su vencido no se puede calcular`, resolveria: "declarar el plazo de pago de esta cuenta, o el general de la empresa (config/politicaCobro.js)" };

    const { evaluables } = _universoDePiso(tabla);
    if (evaluables.length < 2) return { insuficiente: true, motivo: "el universo evaluable (cuentas con plazo de pago declarado) tiene menos de dos cuentas: no hay con qué comparar participaciones", resolveria: "declarar plazo de pago de más clientes" };

    const ventaEvaluableTotal = _sumaVerificada("venta_evaluable_total", evaluables, "ventas", I);
    if (!ventaEvaluableTotal) return { insuficiente: true, motivo: "la venta del universo evaluable no se pudo verificar (falta la venta de al menos una cuenta con plazo declarado)", resolveria: "correr la boleta comercial para todas las cuentas con plazo declarado" };
    const saldoEvaluado = _sumaVerificada("saldo_evaluado", evaluables, "saldo_pendiente", I);
    if (!saldoEvaluado) return { insuficiente: true, motivo: "el saldo pendiente del universo evaluable no se pudo verificar", resolveria: "correr la boleta de cobranza para todas las cuentas con plazo declarado" };

    const { k, procedencia: procK, declaradoPorLaEmpresa } = pisoMaterialidadCobranzaDe(getTenantData());

    const libroA = libroDeHechos([
      { id: "vencido_total", tipo: "cifra", sujeto: "negocio", metrica: "saldo_vencido" },
      { id: "share_venta", tipo: "razon", num: { sujeto: entidad, metrica: "ventas" }, den: { constante: _constOperando(ventaEvaluableTotal, "venta_evaluable_total", "ventas") }, forma: "pct" },
      { id: "share_vencido", tipo: "razon", num: { sujeto: entidad, metrica: "saldo_vencido" }, den: { sujeto: "negocio", metrica: "saldo_vencido" }, forma: "pct" },
    ], { indice: I });
    const [hVencidoTotal, hShareVenta, hShareVencido] = libroA.hechos;
    if (!hVencidoTotal || !hVencidoTotal.ok) return { insuficiente: true, motivo: "el vencido total del universo evaluable no se pudo verificar", resolveria: "correr la boleta de cobranza" };
    if (!hShareVenta || !hShareVenta.ok) return { insuficiente: true, motivo: `la participación de ${entidad} en la venta del universo evaluable no se pudo verificar (${hShareVenta ? hShareVenta.motivo : "sin hecho"})`, resolveria: "correr la boleta comercial para esta cuenta" };
    if (!hShareVencido || !hShareVencido.ok) return { insuficiente: true, motivo: `la participación de ${entidad} en el vencido no se pudo verificar (${hShareVencido ? hShareVencido.motivo : "sin hecho"})`, resolveria: "correr la boleta de cobranza para esta cuenta" };

    const libroB = libroDeHechos([
      { id: "dif_pp", tipo: "derivada", op: "pp", de: [
        { constante: _constOperando(hShareVencido, "share_vencido", "saldo_vencido") },
        { constante: _constOperando(hShareVenta, "share_venta", "ventas") },
      ] },
    ], { indice: I });
    const hDifPp = libroB.hechos[0];
    if (!hDifPp || !hDifPp.ok) return { insuficiente: true, motivo: `la diferencia de participación de ${entidad} no se pudo verificar`, resolveria: null };

    const libroC = libroDeHechos([
      { id: "dif_monto", tipo: "derivada", op: "producto", de: [
        { constante: _constOperando(hDifPp, "dif_pp", "saldo_vencido") },
        { constante: _constOperando(hVencidoTotal, "vencido_total", "saldo_vencido") },
      ] },
      { id: "piso_monto", tipo: "derivada", op: "producto", de: [
        { constante: _constOperando(saldoEvaluado, "saldo_evaluado", "saldo_pendiente") },
        { constante: { raw: k * 100, unidad: "pct", texto: formatoDeLaCasa(k * 100, "pct"), procedencia: procK, label: "piso_criterio_adi", concepto: "Piso de materialidad" } },
      ] },
    ], { indice: I });
    const [hDifMonto, hPisoMonto] = libroC.hechos;
    if (!hDifMonto || !hDifMonto.ok) return { insuficiente: true, motivo: `la diferencia en dinero de ${entidad} no se pudo verificar`, resolveria: null };
    if (!hPisoMonto || !hPisoMonto.ok) return { insuficiente: true, motivo: "el piso de materialidad (en dinero) no se pudo verificar", resolveria: null };

    const difRaw = _crudo(hDifMonto), pisoRaw = _crudo(hPisoMonto), saldoEvalRaw = _crudo(saldoEvaluado);
    const material = difRaw >= pisoRaw;
    // el borde (regla 3): el veredicto cambiaría dentro de la banda [k/2, 2k] — dos evaluaciones más, sin nuevo hecho servido (no es una cifra, es un atributo del veredicto)
    const pisoInf = BORDE_FACTOR_INFERIOR * k * saldoEvalRaw, pisoSup = BORDE_FACTOR_SUPERIOR * k * saldoEvalRaw;
    const borde = (difRaw >= pisoInf) !== (difRaw >= pisoSup);

    const shareVencidoTxt = hShareVencido.render.valor, shareVentaTxt = hShareVenta.render.valor;
    const pisoTxt = hPisoMonto.render.valor;
    const procedencia = peorProcedencia(hDifMonto.procedencia, hPisoMonto.procedencia);

    // ★ owner 2026-09-23 (segunda vuelta): «nada de montos negativos» — una diferencia EN CONTRA (la cuenta
    // pesa menos en el vencido que en la venta) se dice con DIRECCIÓN EN PALABRAS y magnitud positiva, nunca
    // "-$390K". La diferencia se muestra en puntos Y en monto, siempre las dos (Aclaración 2 del diseño).
    const difPpRaw = _crudo(hDifPp);
    const direccion = difPpRaw > 0 ? "pesa más" : difPpRaw < 0 ? "pesa menos" : "pesa igual";
    const aFavor = difPpRaw < 0 ? " a su favor" : "";
    const puntosTxt = formatoDeLaCasa(Math.abs(difPpRaw), "pp").replace(/\bpp\b/, "puntos");
    const montoAbsTxt = formatoDeLaCasa(Math.abs(difRaw), "money");
    // hecho con cifra (parte 1) — nombra la entidad y su dirección; servir.js ya no antepone "En {entidad}"
    // para esta pieza (regla C: tres partes fijas, también para señal).
    const hechoTxt = `${entidad} ${direccion} en el vencido que en la venta: ${shareVencidoTxt} del vencido y ${shareVentaTxt} de la venta. La diferencia es de ${puntosTxt}, ${montoAbsTxt}${aFavor}.`;
    // piso con su dueño (parte 2) — «piso de ADI»/«declarado por tu empresa» YA declara la autoría: nunca se
    // agrega jerga de procedencia («estimación contra referencia») al texto del usuario (owner, segunda vuelta).
    // La procedencia ESTRUCTURAL sigue viva en `procedencia` (nunca "medido") para quien la necesite verificar.
    const pisoDesc = `${formatoDeLaCasa(k * 100, "pct")} del saldo pendiente evaluable, ${pisoTxt}`;
    /* el dueño del piso se nombra según quién lo puso (regla 1): si la empresa lo ajustó, NO es «de ADI». */
    const pisoDe = declaradoPorLaEmpresa ? "el piso declarado por tu empresa" : "el piso de ADI";
    const referenciaTexto = material ? `Supera ${pisoDe} (${pisoDesc}).` : `Queda bajo ${pisoDe} (${pisoDesc}).`;

    return {
      insuficiente: false,
      condicion: material,
      // ★ "señal" reemplaza a "ocurre" para esta pieza (nunca "no_ocurre" — regla 3): las dos son estados
      // PROPIOS de PRI-04, con su propia forma fija en servir.js — nada de lo que CAU-01/CAU-06 hacen con
      // "ocurre" cambia (esos cálculos nunca declaran `estadoVerdadero`).
      estadoVerdadero: "senal",
      estadoFalso: "bajo_piso",
      citas: [{ id: hDifMonto.id, texto: hechoTxt }],
      referenciaTexto,
      hechosDeApoyo: [hVencidoTotal.id, hShareVenta.id, hShareVencido.id, hDifPp.id, hDifMonto.id, hPisoMonto.id],
      borde,
      procedencia,
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
      // ★ PRI-04 (owner 2026-09-23): `estadoVerdadero` es PASSTHROUGH opcional — `undefined` para todo cálculo
      // que no lo declare (CAU-01/CAU-06/CAU-03, byte-idéntico a antes: siguen dando "ocurre").
      estado: r.estadoVerdadero || "ocurre",
      cifra: r.citas[0] || null, referencia: { texto: r.referenciaTexto, hechos: hechosDeApoyo },
      motivo: null, resolveria: null,
      decisivo, noExcluye, calculo: m.calculo, hechos: hechosDeApoyo,
      // ★ PRI-04 (owner 2026-09-23): borde/procedencia son PASSTHROUGH opcionales — `undefined` para todo
      // cálculo que no los declare (CAU-01/CAU-06/CAU-03, sin cambios), así que se normalizan a `null` acá.
      borde: r.borde != null ? r.borde : null, procedencia: r.procedencia || null,
    };
  }

  // r.condicion === false
  if (!decisivo) {
    return {
      estado: "indeterminable",
      cifra: r.citas[0] || null, referencia: { texto: r.referenciaTexto, hechos: hechosDeApoyo },
      motivo: "la cifra disponible no decide (medición no decisiva)", resolveria: null,
      decisivo, noExcluye, calculo: m.calculo, hechos: hechosDeApoyo,
      borde: null, procedencia: null,
    };
  }
  // ★ "no_ocurre" SOLO si el cálculo no declaró `estadoFalso` (PRI-04 lo cambia a "bajo_piso" — regla 3 del
  // sello: esta pieza nunca dice "no ocurre"; el veredicto negativo afirma la diferencia y el piso, no la niega).
  return {
    estado: r.estadoFalso || "no_ocurre",
    cifra: r.citas[0] || null, referencia: { texto: r.referenciaTexto, hechos: hechosDeApoyo },
    motivo: null, resolveria: null,
    decisivo, noExcluye, calculo: m.calculo, hechos: hechosDeApoyo,
    borde: r.borde != null ? r.borde : null, procedencia: r.procedencia || null,
  };
}

/** coberturaPisoDeCobranza(tabla) → { texto } | null — la LÍNEA DE COBERTURA fija al cierre de PRI-04 (regla 4
 *  del sello, owner 2026-09-23): identidades que TIENEN que cerrar — `evaluados + sin_plazo = total`,
 *  `señal + bajo_piso + al_dia = evaluados`, `saldo_evaluado + saldo_sin_plazo = saldo_pendiente`. Si no
 *  cierran, la pieza no se sirve (falla cerrado): esta función devuelve `null` en vez de un texto roto.
 *  Recorre el universo COMPLETO de la tabla de señales (nunca el subconjunto que la Respuesta nombra),
 *  reutilizando `CALCULOS.pisoMaterialidadCobranza` cuenta por cuenta — el mismo cálculo que sirve cada línea,
 *  nunca una cuenta aparte. Llamada por `seleccionar.js` una sola vez por turno, cuando PRI-04 es pertinente. */
export function coberturaPisoDeCobranza(tabla) {
  const I = tabla && tabla._indice;
  if (!I) return null;
  const { evaluables, sinPlazo } = _universoDePiso(tabla);
  const total = evaluables.length + sinPlazo.length;
  if (!total) return null;

  // ★ REGLA B (owner 2026-09-23, segunda vuelta) — «la cobertura nunca puede afirmar más de lo que vio». El
  // universo TOTAL de la fuente (`buildMesaFlujo`, vía `tablaSenales.js:_universoCobranza`) es independiente de
  // cuántas cuentas esta evidencia logró verificar — si hay MENOS verificadas que las que la fuente conoce, la
  // cobertura es PARCIAL y lo dice, con el conteo exacto; nunca "100%" de un universo que no vio entero. Una
  // cartera de prueba autónoma (sin `buildMesaFlujo` real detrás) no declara `_universoCobranza`, y ahí se
  // confía en lo que se vio (no hay una fuente externa con la que contrastar).
  const universoTotal = Number.isFinite(tabla._universoCobranza) && tabla._universoCobranza > 0 ? tabla._universoCobranza : total;
  const noVerificados = Math.max(0, universoTotal - total);
  const truncado = noVerificados > 0;
  const baseLabel = truncado ? "del saldo verificado" : "del saldo pendiente evaluable";

  const saldoPendienteTotal = _sumaVerificada("saldo_pendiente_total_cobertura", [...evaluables, ...sinPlazo], "saldo_pendiente", I);
  const saldoEvaluado = _sumaVerificada("saldo_evaluado_cobertura", evaluables, "saldo_pendiente", I);
  const saldoSinPlazo = _sumaVerificada("saldo_sin_plazo_cobertura", sinPlazo, "saldo_pendiente", I);
  if (!saldoPendienteTotal || !saldoEvaluado || !saldoSinPlazo) return null;
  const saldoTotalRaw = _crudo(saldoPendienteTotal), saldoEvalRaw = _crudo(saldoEvaluado), saldoSinPlazoRaw = _crudo(saldoSinPlazo);
  // ★ LA IDENTIDAD QUE TIENE QUE CERRAR (regla 4): si no cierra, no se sirve nada — nunca una cobertura rota.
  if (!(Number.isFinite(saldoTotalRaw) && Number.isFinite(saldoEvalRaw) && Number.isFinite(saldoSinPlazoRaw) && Math.abs((saldoEvalRaw + saldoSinPlazoRaw) - saldoTotalRaw) <= Math.max(1, Math.abs(saldoTotalRaw) * 1e-6))) return null;

  let nSenal = 0, nBajoPiso = 0, nAlDia = 0;
  for (const e of evaluables) {
    const c = tabla.cuentas[e];
    if (c.vencidoPositivo === false) { nAlDia++; continue; }
    const r = CALCULOS.pisoMaterialidadCobranza(e, tabla);
    if (r.insuficiente) continue;   // no debería pasar para un evaluable con vencido positivo; defensivo
    if (r.condicion === true) nSenal++; else nBajoPiso++;
  }
  // ★ LA SEGUNDA IDENTIDAD (regla 4): si no cierra, tampoco se sirve.
  if (nSenal + nBajoPiso + nAlDia !== evaluables.length) return null;

  const pctSaldo = (x) => (saldoTotalRaw > 0 ? formatoDeLaCasa((x / saldoTotalRaw) * 100, "pct") : "0%");
  const { k, procedencia: procK, declaradoPorLaEmpresa } = pisoMaterialidadCobranzaDe(getTenantData());
  const lineaPiso = declaradoPorLaEmpresa
    ? `Piso de materialidad: ${formatoDeLaCasa(k * 100, "pct")} del saldo pendiente, declarado por tu empresa.`
    : `Piso de materialidad: ${formatoDeLaCasa(k * 100, "pct")} del saldo pendiente. Es el criterio general de ADI, ajustable por tu empresa; no es una referencia del sector ni una meta.`;
  void procK;

  // ── caso «ningún cliente tiene plazo declarado» (Aclaración 3) — no hay vencido calculable en absoluto ──
  if (!evaluables.length) {
    const top = [...sinPlazo].sort((a, b) => (tabla.cuentas[b].saldoPendiente || 0) - (tabla.cuentas[a].saldoPendiente || 0))[0];
    const topTxt = top ? `${top} concentra el ${pctSaldo(tabla.cuentas[top].saldoPendiente || 0)}` : "";
    const universoTxt = truncado ? `${total} de ${universoTotal} clientes verificados (${noVerificados} sin verificar en este turno)` : `${total} clientes`;
    return { texto: `No puedo evaluar la desproporción de vencido: ningún cliente tiene plazo de pago declarado, así que no hay vencido calculable. Lo que sí puedo decir: saldo pendiente ${saldoPendienteTotal.render.valor} en ${universoTxt}${topTxt ? `; ${topTxt}` : ""}. Con los plazos en la planilla, la evaluación se activa.` };
  }

  // ── ABRE CON EL VENCIDO TOTAL Y SU PESO EN EL SALDO PENDIENTE (orden de servicio del diseño sellado) — si el
  // vencido total mismo queda bajo el piso, se dice explícito: nadie puede ser señal en este turno, en vez de
  // callarlo (diseño del piso, 2026-09-23: no es un umbral nuevo, es la MISMA cuenta del piso aplicada al vencido
  // total). ──
  const partes = [];
  const libroVT = libroDeHechos([{ id: "vencido_total_cobertura", tipo: "cifra", sujeto: "negocio", metrica: "saldo_vencido" }], { indice: I });
  const hVT = libroVT.hechos[0];
  if (hVT && hVT.ok) {
    const vtRaw = _crudo(hVT);
    partes.push(`Vencido total: ${hVT.render.valor} (${pctSaldo(vtRaw)} ${baseLabel}).`);
    const pisoSobreEvaluado = k * saldoEvalRaw;
    if (Number.isFinite(vtRaw) && vtRaw < pisoSobreEvaluado) partes.push(`El vencido total queda bajo ${declaradoPorLaEmpresa ? "el piso declarado por tu empresa" : "el piso de ADI"}: ninguna cuenta puede ser señal en este turno.`);
  }
  // ★ REGLA B — nunca "100% del saldo" (ni "N clientes" a secas) si el universo de la fuente es más grande que
  // lo que esta evidencia pudo verificar: la cobertura se declara PARCIAL, con el conteo exacto de lo que falta.
  if (truncado) {
    partes.push(`Cobertura parcial: se pudo verificar el saldo pendiente de ${total} de ${universoTotal} clientes con venta a crédito (${noVerificados} sin verificar en este turno). De los verificados, evaluados ${evaluables.length} (${pctSaldo(saldoEvalRaw)} ${baseLabel}): ${nSenal} señal · ${nBajoPiso} bajo el piso · ${nAlDia} al día.`);
  } else {
    partes.push(`Cobertura: ${total} clientes con saldo pendiente. Evaluados ${evaluables.length} (${pctSaldo(saldoEvalRaw)} ${baseLabel}): ${nSenal} señal · ${nBajoPiso} bajo el piso · ${nAlDia} al día.`);
  }
  if (sinPlazo.length) {
    if (sinPlazo.length <= 3) {
      partes.push(`Sin evaluar: ${sinPlazo.join(", ")} no ${sinPlazo.length === 1 ? "tiene" : "tienen"} plazo de pago declarado, así que su vencido no se puede calcular (${saldoSinPlazo.render.valor}, ${pctSaldo(saldoSinPlazoRaw)} ${baseLabel}). Se evalúa${sinPlazo.length === 1 ? "" : "n"} cuando el plazo esté en la planilla.`);
    } else {
      partes.push(`Sin evaluar ${sinPlazo.length} (${pctSaldo(saldoSinPlazoRaw)} ${baseLabel}): no tienen plazo de pago declarado.`);
    }
  }
  partes.push(lineaPiso);
  return { texto: partes.join(" ") };
}
