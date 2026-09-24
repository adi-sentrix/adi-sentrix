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
/* ── CAU-01 · LA CARGA COMERCIAL DE LA CUENTA CONTRA EL RESTO DE LA CARTERA (owner 2026-09-23, diseño aprobado)
 * — el MISMO piso que ya decide "Carga comercial alta" en el detector del Core (nunca recalculado aparte: se
 * toma de `pisoFocosUSD()`, specRetrieval.js) y la MISMA doctrina de propiedad que ya resuelve `businessPolicy.js`
 * para el resto de los umbrales de POLICY (`materialidadFocoEsDelNegocio`, hermana de `cargaEsDelNegocio`). */
import { pisoFocosUSD } from "../specRetrieval.js";
import { POLICY, materialidadFocoEsDelNegocio } from "../../config/businessPolicy.js";

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
  /* ── CAU-01 · LA CARGA COMERCIAL DE LA CUENTA CONTRA EL RESTO DE LA CARTERA (owner 2026-09-23, diseño aprobado)
   * ─────────────────────────────────────────────────────────────────────────────────────────────────────────────
   * «El resto de la cartera» = la TASA REAL PONDERADA del resto, nunca el promedio simple de porcentajes (un
   * promedio de tasas no es verificable: `hechos.js` no suma porcentajes — regla 1 del owner). Para la cuenta
   * `entidad`, sobre las OTRAS cuentas de la CARTERA COMPLETA (nunca solo las bajo benchmark ni las nombradas en
   * la Respuesta):
   *   tasa_resto = Σ(carga%ᵢ × ventaᵢ) del resto ÷ Σ(ventaᵢ) del resto     (carga $ del resto ÷ venta del resto)
   *   exceso = (carga%_propia − tasa_resto) × venta_propia                (mismo signo que la diferencia de pp)
   *   piso   = pisoFocosUSD() — el MISMO piso que decide "Carga comercial alta" en el detector del Core (Core:
   *            0,05% de la venta REAL del negocio · specRetrieval.js, NUNCA recalculado aparte)
   *   Señal ⟺ exceso ≥ piso. Si la cuenta carga MENOS o IGUAL que el resto (exceso ≤ 0), nunca hay exceso que
   *   comparar: siempre "bajo el piso" (regla del owner: «no hay exceso que comparar con el piso» — nunca se dice
   *   "queda bajo el piso" al lado de "a favor", se lee contradictorio).
   * Cada cifra —la carga% y la venta de cada cuenta, propia y del resto— es un HECHO por separado, verificado por
   * `libroDeHechos` (el mismo camino que ya prueba la cabecera de este archivo para las 13 cuentas del demo); el
   * carga-$ por cuenta, los totales del resto, la tasa, la diferencia en pp y el exceso en $ son DERIVADAS
   * encadenadas por id dentro del MISMO libro — ningún dígito lo calcula esta capa por fuera de esa verificación.
   * Si CUALQUIER cuenta del resto no verifica venta o carga, la medición entera de `entidad` es "no se puede
   * saber" (nunca un resto parcial vendido como completo — regla del owner, misma que la regla 2 del sello de
   * PRI-04). */
  cargaCuentaVsResto(entidad, tabla) {
    const I = tabla && tabla._indice;
    if (!I) return { insuficiente: true, motivo: "no hay índice de evidencia para verificar la carga comercial de esta boleta", resolveria: "reconstruir la tabla de señales con la boleta comercial disponible" };
    const cs = (tabla && tabla.cuentas) || {};
    // la cartera COMPLETA (owner: «nunca solo las bajo benchmark ni las nombradas en la respuesta») — toda
    // cuenta con venta comercial declarada en este turno, el mismo universo que `descomposicionDeBrecha` publica.
    const cartera = Object.keys(cs).filter((e) => cs[e] && cs[e].venta != null);
    if (!cs[entidad] || cs[entidad].venta == null) return { insuficiente: true, motivo: `${entidad} no tiene venta comercial declarada en la boleta de este turno`, resolveria: "correr marginRead/diagnose para esta cuenta" };
    const otras = cartera.filter((e) => e !== entidad);
    if (!otras.length) return { insuficiente: true, motivo: `no hay otras cuentas en la cartera con las que comparar la carga comercial de ${entidad}`, resolveria: "cargar el resto de la cartera" };

    const hechos = [
      { id: "carga_propia", tipo: "cifra", sujeto: entidad, metrica: "carga" },
      { id: "venta_propia", tipo: "cifra", sujeto: entidad, metrica: "ventas" },
    ];
    const cargaUSDIds = [], ventaIds = [];
    otras.forEach((e, i) => {
      hechos.push({ id: `carga_resto_${i}`, tipo: "cifra", sujeto: e, metrica: "carga" });
      hechos.push({ id: `venta_resto_${i}`, tipo: "cifra", sujeto: e, metrica: "ventas" });
      // carga $ de esta cuenta del resto = venta × carga% — una derivada por cuenta, encadenada por id dentro
      // del mismo libro (nunca un promedio de porcentajes).
      hechos.push({ id: `cargaUSD_resto_${i}`, tipo: "derivada", op: "producto", de: [`venta_resto_${i}`, `carga_resto_${i}`] });
      cargaUSDIds.push(`cargaUSD_resto_${i}`); ventaIds.push(`venta_resto_${i}`);
    });
    const cargaUSDTotalId = cargaUSDIds.length >= 2 ? "cargaUSD_total" : cargaUSDIds[0];
    const ventaTotalId = ventaIds.length >= 2 ? "venta_total" : ventaIds[0];
    if (cargaUSDIds.length >= 2) hechos.push({ id: "cargaUSD_total", tipo: "derivada", op: "suma", de: cargaUSDIds });
    if (ventaIds.length >= 2) hechos.push({ id: "venta_total", tipo: "derivada", op: "suma", de: ventaIds });
    // tasa_resto = carga $ del resto ÷ venta del resto (la tasa REAL ponderada, no el promedio de porcentajes)
    hechos.push({ id: "tasa_resto", tipo: "derivada", op: "cociente", de: [cargaUSDTotalId, ventaTotalId] });
    hechos.push({ id: "dif_pp", tipo: "derivada", op: "pp", de: ["carga_propia", "tasa_resto"] });
    // exceso = dif_pp × venta propia — se calcula siempre (con el signo de dif_pp); solo se USA cuando dif_pp > 0
    hechos.push({ id: "exceso", tipo: "derivada", op: "producto", de: ["dif_pp", "venta_propia"] });

    const libro = libroDeHechos(hechos, { indice: I });
    const porId = libro.porId;
    const propioCarga = porId.get("carga_propia"), propioVenta = porId.get("venta_propia");
    if (!propioCarga || !propioCarga.ok) return { insuficiente: true, motivo: `la carga comercial de ${entidad} no se pudo verificar en la boleta (${propioCarga ? propioCarga.motivo : "sin hecho"})`, resolveria: "correr marginRead/diagnose para esta cuenta" };
    if (!propioVenta || !propioVenta.ok) return { insuficiente: true, motivo: `la venta de ${entidad} no se pudo verificar en la boleta (${propioVenta ? propioVenta.motivo : "sin hecho"})`, resolveria: "correr marginRead/diagnose para esta cuenta" };

    // ★ regla del owner: el resto es la cartera completa o la pieza no mide — nunca un resto parcial vendido
    // como completo. Se comprueba CADA cuenta del resto por separado (no basta con que la suma final "no dé
    // error": una cuenta faltante tiene que nombrarse).
    const fallidas = [];
    otras.forEach((e, i) => {
      const hC = porId.get(`carga_resto_${i}`), hV = porId.get(`venta_resto_${i}`);
      if (!hC || !hC.ok || !hV || !hV.ok) fallidas.push(e);
    });
    if (fallidas.length) {
      return {
        insuficiente: true,
        motivo: `el resto de la cartera no se pudo verificar completo: ${otras.length - fallidas.length} de ${otras.length} cuentas (sin verificar: ${fallidas.join(", ")})`,
        resolveria: "correr marginRead/diagnose para el resto de la cartera",
      };
    }

    const hTasaResto = porId.get("tasa_resto");
    if (!hTasaResto || !hTasaResto.ok) return { insuficiente: true, motivo: `la tasa de carga del resto de la cartera no se pudo verificar para ${entidad}`, resolveria: null };
    const hDifPp = porId.get("dif_pp");
    if (!hDifPp || !hDifPp.ok) return { insuficiente: true, motivo: `la diferencia de carga comercial de ${entidad} contra el resto no se pudo verificar`, resolveria: null };
    const hExceso = porId.get("exceso");
    if (!hExceso || !hExceso.ok) return { insuficiente: true, motivo: `el exceso de carga comercial de ${entidad} no se pudo verificar`, resolveria: null };

    const difPpRaw = _crudo(hDifPp), excesoRaw = _crudo(hExceso);
    const direccion = difPpRaw > 0 ? "carga más" : difPpRaw < 0 ? "carga menos" : "carga igual";
    const aFavor = difPpRaw < 0 ? " a su favor" : "";
    const puntosTxt = formatoDeLaCasa(Math.abs(difPpRaw), "pp").replace(/\bpp\b/, "puntos");
    const montoAbsTxt = formatoDeLaCasa(Math.abs(excesoRaw), "money");
    const cargaPropiaTxt = propioCarga.render.valor, cargaRestoTxt = hTasaResto.render.valor;
    // hecho con cifra (parte 1) — nombra la entidad, su carga y la tasa REAL del resto de la cartera (regla 3
    // del encargo: el texto de CAU-01 nombra siempre "el resto de la cartera" como su referencia).
    const hechoTxt = `${entidad} ${direccion} en carga comercial que el resto de la cartera: ${cargaPropiaTxt} propio y ${cargaRestoTxt} del resto de la cartera. La diferencia es de ${puntosTxt}, ${montoAbsTxt}${aFavor}.`;

    // piso con su dueño (parte 2) — tomado de la MISMA función del Core, nunca recalculado aparte.
    const pisoUSD = pisoFocosUSD();
    const declaradoPorLaEmpresa = materialidadFocoEsDelNegocio();
    const pctMaterialidad = POLICY.materialidadFocoPctVenta;
    const pisoTxt = formatoDeLaCasa(pisoUSD, "money");
    // el mismo formato que ya usa `specRetrieval.js:declaracionUmbralFocos` para el % (String(pct), no
    // formatoDeLaCasa: un 0,05% redondeado a un decimal leería "0.1%" y mentiría sobre el piso real) — y la
    // MISMA frase que la pestaña Comercial ("de tu venta", owner 2026-09-24: nunca "de tu venta real"). Sin
    // paréntesis propios: quien la usa (referenciaTexto de abajo, coberturaCargaVsResto) ya la envuelve en los
    // suyos — anidar paréntesis fue exactamente el defecto 4 que el owner cazó («($50K) mal ubicado»).
    const pisoDesc = `${String(pctMaterialidad)}% de tu venta, ${pisoTxt}`;
    const pisoDe = declaradoPorLaEmpresa ? "el piso declarado por tu empresa" : "el piso de ADI";

    let material, referenciaTexto, borde;
    if (difPpRaw > 0) {
      material = excesoRaw >= pisoUSD;
      // el borde (mismo criterio que PRI-04): el veredicto cambiaría dentro de la banda [piso/2, 2×piso]
      const pisoInf = BORDE_FACTOR_INFERIOR * pisoUSD, pisoSup = BORDE_FACTOR_SUPERIOR * pisoUSD;
      borde = (excesoRaw >= pisoInf) !== (excesoRaw >= pisoSup);
      referenciaTexto = material ? `Supera ${pisoDe} (${pisoDesc}).` : `Queda bajo ${pisoDe} (${pisoDesc}).`;
    } else {
      // ★ owner: la cuenta carga MENOS (o igual) que el resto — no hay exceso que comparar con el piso; nunca
      // "queda bajo el piso" al lado de "a favor" (se lee contradictorio). Siempre bajo el piso, sin borde: no
      // hay exceso cerca del que el veredicto pueda cambiar.
      material = false;
      borde = false;
      referenciaTexto = `No hay exceso que comparar con ${pisoDe} (${pisoDesc}).`;
    }

    const procedencia = peorProcedencia(hExceso.procedencia, declaradoPorLaEmpresa ? "supuesto_usuario" : "estimacion_referencia");
    const hechosDeApoyo = [
      propioCarga.id, propioVenta.id,
      ...otras.flatMap((e, i) => [`carga_resto_${i}`, `venta_resto_${i}`]),
      cargaUSDTotalId, ventaTotalId, hTasaResto.id, hDifPp.id, hExceso.id,
    ];

    return {
      insuficiente: false,
      condicion: material,
      // "señal"/"bajo_piso" — los mismos dos estados PROPIOS que ya sirve PRI-04 (servir.js ya tiene su forma
      // fija genérica para cualquier pieza que los declare): nunca "no_ocurre" — el veredicto negativo afirma
      // la diferencia y el piso, nunca "no ocurre" (misma ley que PRI-04).
      estadoVerdadero: "senal",
      estadoFalso: "bajo_piso",
      citas: [{ id: hExceso.id, texto: hechoTxt }],
      referenciaTexto,
      hechosDeApoyo,
      borde,
      procedencia,
      // ═══ owner 2026-09-24 (presentación en bloque) — las PARTES crudas de la redacción, para que servir.js
      // arme el bloque sin volver a parsear texto (nunca una regex sobre `hechoTxt`/`referenciaTexto`: cada
      // pieza ya es un valor con dueño). `sentido` es la MISMA lectura que decide `direccion`/`aFavor` arriba,
      // expuesta como enum en vez de en prosa.
      partes: {
        propio: cargaPropiaTxt, resto: cargaRestoTxt, puntos: puntosTxt, monto: montoAbsTxt,
        sentido: difPpRaw > 0 ? "mas" : difPpRaw < 0 ? "menos" : "igual",
        pisoTexto: pisoTxt, declaradoPorLaEmpresa,
      },
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

    // ★ owner 2026-09-24 («caja ≠ cobranza»; ver ADI_CAJA_NO_ES_COBRANZA): la participación en VENTA de una
    // lectura de cobranza es sobre la venta A CRÉDITO (clave "venta_credito"), nunca sobre la venta comercial
    // total ("ventas") — solo la venta a crédito genera exposición de cobranza.
    const hechos = [
      { id: "part_venta", tipo: "razon", num: { sujeto: entidad, metrica: "venta_credito" }, den: { sujeto: "negocio", metrica: "venta_credito" }, forma: "pct" },
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

    // ★ owner 2026-09-24 («caja ≠ cobranza», decisión 2 — base de PRI-04): la venta contra la que se mide la
    // participación es la venta A CRÉDITO del mismo flujo de cobranza (clave "venta_credito"), nunca la venta
    // comercial total ("ventas") — la venta de contado no genera exposición y no puede diluir la participación.
    const ventaEvaluableTotal = _sumaVerificada("venta_evaluable_total", evaluables, "venta_credito", I);
    if (!ventaEvaluableTotal) return { insuficiente: true, motivo: "la venta a crédito del universo evaluable no se pudo verificar (falta la venta a crédito de al menos una cuenta con plazo declarado)", resolveria: "correr la boleta de cobranza para todas las cuentas con plazo declarado" };
    const saldoEvaluado = _sumaVerificada("saldo_evaluado", evaluables, "saldo_pendiente", I);
    if (!saldoEvaluado) return { insuficiente: true, motivo: "el saldo pendiente del universo evaluable no se pudo verificar", resolveria: "correr la boleta de cobranza para todas las cuentas con plazo declarado" };

    const { k, procedencia: procK, declaradoPorLaEmpresa } = pisoMaterialidadCobranzaDe(getTenantData());

    const libroA = libroDeHechos([
      { id: "vencido_total", tipo: "cifra", sujeto: "negocio", metrica: "saldo_vencido" },
      { id: "share_venta", tipo: "razon", num: { sujeto: entidad, metrica: "venta_credito" }, den: { constante: _constOperando(ventaEvaluableTotal, "venta_evaluable_total", "venta_credito") }, forma: "pct" },
      { id: "share_vencido", tipo: "razon", num: { sujeto: entidad, metrica: "saldo_vencido" }, den: { sujeto: "negocio", metrica: "saldo_vencido" }, forma: "pct" },
    ], { indice: I });
    const [hVencidoTotal, hShareVenta, hShareVencido] = libroA.hechos;
    if (!hVencidoTotal || !hVencidoTotal.ok) return { insuficiente: true, motivo: "el vencido total del universo evaluable no se pudo verificar", resolveria: "correr la boleta de cobranza" };
    if (!hShareVenta || !hShareVenta.ok) return { insuficiente: true, motivo: `la participación de ${entidad} en la venta a crédito del universo evaluable no se pudo verificar (${hShareVenta ? hShareVenta.motivo : "sin hecho"})`, resolveria: "correr la boleta de cobranza para esta cuenta" };
    if (!hShareVencido || !hShareVencido.ok) return { insuficiente: true, motivo: `la participación de ${entidad} en el vencido no se pudo verificar (${hShareVencido ? hShareVencido.motivo : "sin hecho"})`, resolveria: "correr la boleta de cobranza para esta cuenta" };

    const libroB = libroDeHechos([
      { id: "dif_pp", tipo: "derivada", op: "pp", de: [
        { constante: _constOperando(hShareVencido, "share_vencido", "saldo_vencido") },
        { constante: _constOperando(hShareVenta, "share_venta", "venta_credito") },
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
    const hechoTxt = `${entidad} ${direccion} en el vencido que en la venta a crédito: ${shareVencidoTxt} del vencido y ${shareVentaTxt} de la venta a crédito. La diferencia es de ${puntosTxt}, ${montoAbsTxt}${aFavor}.`;
    // piso con su dueño (parte 2) — «piso de ADI»/«declarado por tu empresa» YA declara la autoría: nunca se
    // agrega jerga de procedencia («estimación contra referencia») al texto del usuario (owner, segunda vuelta).
    // La procedencia ESTRUCTURAL sigue viva en `procedencia` (nunca "medido") para quien la necesite verificar.
    const pisoDesc = `${formatoDeLaCasa(k * 100, "pct")} del saldo pendiente evaluable, ${pisoTxt}`;
    /* el dueño del piso se nombra según quién lo puso (regla 1): si la empresa lo ajustó, NO es «de ADI». */
    const pisoDe = declaradoPorLaEmpresa ? "el piso declarado por tu empresa" : "el piso de ADI";
    // ═══ AJUSTE DE REDACCIÓN (owner 2026-09-23, cierre de CAU-01) — «no escribas "Queda bajo el piso de ADI
    // ($50K)" al lado de "$131K a su favor" — se lee contradictorio» — misma claridad que CAU-01, CERO cambio de
    // veredicto: `material` ya daba `false` en esta rama (difRaw negativo o cero nunca alcanza `pisoRaw` positivo).
    // Solo cambia la FRASE: cuando la cuenta pesa menos o igual (nunca hay un exceso que comparar), se dice así
    // en vez de "Queda bajo…", que sugiere una comparación que no ocurrió.
    const referenciaTexto = difPpRaw <= 0
      ? `No hay exceso que comparar con ${pisoDe} (${pisoDesc}).`
      : (material ? `Supera ${pisoDe} (${pisoDesc}).` : `Queda bajo ${pisoDe} (${pisoDesc}).`);

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
      // ═══ owner 2026-09-24 (presentación en bloque, la misma forma para CAU-01 y PRI-04) — ver la nota
      // gemela en `cargaCuentaVsResto`: las partes crudas, para que servir.js arme el bloque sin parsear texto.
      partes: {
        propio: shareVencidoTxt, resto: shareVentaTxt, puntos: puntosTxt, monto: montoAbsTxt,
        sentido: difPpRaw > 0 ? "mas" : difPpRaw < 0 ? "menos" : "igual",
        pisoTexto: pisoTxt, declaradoPorLaEmpresa,
      },
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
      // `partes` (owner 2026-09-24): idem, las piezas crudas para el bloque — `null` si el cálculo no las declara.
      borde: r.borde != null ? r.borde : null, procedencia: r.procedencia || null, partes: r.partes || null,
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
    borde: r.borde != null ? r.borde : null, procedencia: r.procedencia || null, partes: r.partes || null,
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
  const vtOk = !!(hVT && hVT.ok);
  const vtRaw = vtOk ? _crudo(hVT) : null;
  const pisoSobreEvaluado = k * saldoEvalRaw;
  const vencidoTotalBajoPiso = vtOk && Number.isFinite(vtRaw) && vtRaw < pisoSobreEvaluado;
  // ═══ owner 2026-09-24 (pertinencia por encargo, defecto 1) — «la oferta de PRI-04 necesita el vencido total y
  // su peso en el saldo pendiente; ya son hechos verificados acá, reusalos» — se expone el MISMO hecho `hVT` (ya
  // verificado arriba, nunca recalculado) como campo estructural del retorno, para que `servir.js:servirOferta
  // PisoDeCobranza` arme su cola sin declarar un hecho nuevo ni reparsear el texto de esta línea. */
  const vencidoTotal = vtOk ? { hechoId: hVT.id, raw: vtRaw, texto: hVT.render.valor, pctTexto: pctSaldo(vtRaw) } : null;

  // ═══ FORMA CORTA (owner 2026-09-24, cierre de presentación) — solo con cobertura LIMPIA: sin truncar y sin
  // ninguna cuenta sin plazo declarado. Con cobertura parcial o con cuentas sin plazo, sigue la forma larga de
  // siempre — nunca calla lo que hay que declarar; acá solo se acorta lo que ya estaba completo. Mismos números,
  // misma identidad (evaluados+sinPlazo=total, señal+bajo_piso+al_dia=evaluados) — ya verificados arriba. */
  if (!truncado && !sinPlazo.length) {
    const pisoTxtCorto = formatoDeLaCasa(pisoSobreEvaluado, "money");
    const pisoLineaCorta = declaradoPorLaEmpresa
      ? `Piso: ${formatoDeLaCasa(k * 100, "pct")} del saldo pendiente (${pisoTxtCorto}), declarado por tu empresa; no es una referencia del sector ni una meta.`
      : `Piso: ${formatoDeLaCasa(k * 100, "pct")} del saldo pendiente (${pisoTxtCorto}), criterio general de ADI, ajustable por tu empresa; no es una referencia del sector ni una meta.`;
    const vtLineaCorta = vtOk ? `Vencido total: ${hVT.render.valor} (${pctSaldo(vtRaw)} del saldo pendiente).${vencidoTotalBajoPiso ? ` El vencido total queda bajo ${declaradoPorLaEmpresa ? "el piso declarado por tu empresa" : "el piso de ADI"}: ninguna cuenta puede ser señal en este turno.` : ""}` : null;
    const clientesLineaCorta = `${evaluables.length} clientes evaluados, todos con plazo declarado: ${nSenal} señal · ${nBajoPiso} bajo el piso · ${nAlDia} al día.`;
    return { texto: [vtLineaCorta, clientesLineaCorta, pisoLineaCorta].filter(Boolean).join(" "), vencidoTotal };
  }

  if (vtOk) {
    partes.push(`Vencido total: ${hVT.render.valor} (${pctSaldo(vtRaw)} ${baseLabel}).`);
    if (vencidoTotalBajoPiso) partes.push(`El vencido total queda bajo ${declaradoPorLaEmpresa ? "el piso declarado por tu empresa" : "el piso de ADI"}: ninguna cuenta puede ser señal en este turno.`);
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
  return { texto: partes.join(" "), vencidoTotal };
}

/** coberturaCargaVsResto(tabla) → { texto } | null — la LÍNEA DE COBERTURA fija al cierre de CAU-01 (mismo
 *  patrón que `coberturaPisoDeCobranza`, ver arriba): identidades que TIENEN que cerrar — `señal + bajo_piso +
 *  sin_evaluar = bajo el benchmark` (el universo pertinente de CAU-01, ver `piezas.js`: la pieza se enciende
 *  con "cuenta.bajo_benchmark"). Si no cierran, no se sirve nada (falla cerrado). Recorre TODAS las cuentas bajo
 *  el benchmark de la cartera completa (nunca el subconjunto que la Respuesta nombra), reutilizando
 *  `CALCULOS.cargaCuentaVsResto` cuenta por cuenta — el mismo cálculo que sirve cada línea. Llamada por
 *  `seleccionar.js` una sola vez por turno, cuando CAU-01 es pertinente. `null` si no hay ninguna cuenta bajo el
 *  benchmark que cubrir (nada que declarar), o si las identidades no cierran. */
export function coberturaCargaVsResto(tabla) {
  const I = tabla && tabla._indice;
  if (!I) return null;
  const cs = (tabla && tabla.cuentas) || {};
  const cartera = Object.keys(cs).filter((e) => cs[e] && cs[e].venta != null);
  const bajoBenchmark = cartera.filter((e) => cs[e].bajoBenchmark === true);
  if (!bajoBenchmark.length) return null;

  let nSenal = 0, nBajoPiso = 0, nSinEvaluar = 0;
  for (const e of bajoBenchmark) {
    const r = CALCULOS.cargaCuentaVsResto(e, tabla);
    if (r.insuficiente) { nSinEvaluar++; continue; }
    if (r.condicion === true) nSenal++; else nBajoPiso++;
  }
  // ★ LA IDENTIDAD QUE TIENE QUE CERRAR: señal + bajo el piso + sin evaluar = cuentas bajo el benchmark.
  if (nSenal + nBajoPiso + nSinEvaluar !== bajoBenchmark.length) return null;

  const pisoUSD = pisoFocosUSD();
  const declaradoPorLaEmpresa = materialidadFocoEsDelNegocio();
  const pctMaterialidad = POLICY.materialidadFocoPctVenta;
  const pisoTxt = formatoDeLaCasa(pisoUSD, "money");
  // ═══ REDACCIÓN (owner 2026-09-24, cierre de presentación) — "Piso: X% de tu venta ($Y)" en una sola
  // cláusula (nunca "($Y)" colgando después de "ajustable por tu empresa", que lo hacía leer como si el monto
  // calificara a la empresa) y "de tu venta" (nunca "de tu venta real" — la MISMA frase de
  // `specRetrieval.js:declaracionUmbralFocos`, la que ya lee la pestaña Comercial). Piso primero, cartera
  // después — el orden que pidió el owner para el cierre del bloque. ═══
  const lineaPiso = declaradoPorLaEmpresa
    ? `Piso: ${String(pctMaterialidad)}% de tu venta (${pisoTxt}), declarado por tu empresa; no es una referencia del sector ni una meta.`
    : `Piso: ${String(pctMaterialidad)}% de tu venta (${pisoTxt}), criterio general de ADI, ajustable por tu empresa; no es una referencia del sector ni una meta.`;

  const sinEvaluarTxt = nSinEvaluar ? ` · ${nSinEvaluar} sin evaluar (el resto de la cartera no se pudo verificar completo para esa(s) cuenta(s))` : "";
  const lineaCartera = `Cartera de ${cartera.length} cuentas; ${bajoBenchmark.length} bajo el benchmark: ${nSenal} señal · ${nBajoPiso} bajo el piso${sinEvaluarTxt}.`;
  return { texto: `${lineaPiso} ${lineaCartera}` };
}

/** resultadosCargaVsResto(pieza, tabla) → { cartera, bajoBenchmark, porEntidad } — el mismo escaneo que
 *  `coberturaCargaVsResto` (todas las cuentas bajo benchmark de la cartera COMPLETA, nunca el subconjunto que
 *  la Respuesta nombra), pero devolviendo la MEDICIÓN COMPLETA por cuenta (`medirPieza`, con `.cifra`/
 *  `.referencia`/`.partes`/`.borde`) en vez de solo el conteo — lo que necesita el bloque de presentación
 *  (`servir.js:servirBloqueCargaVsResto`) para nombrar cada señal y cada cuenta bajo el piso. `porEntidad` es
 *  un `Map` en el orden natural de la cartera (el mismo que ya usa el resto de la capa — nunca un orden
 *  inventado). Owner 2026-09-24, presentación en bloque. */
export function resultadosCargaVsResto(pieza, tabla) {
  const cs = (tabla && tabla.cuentas) || {};
  const cartera = Object.keys(cs).filter((e) => cs[e] && cs[e].venta != null);
  const bajoBenchmark = cartera.filter((e) => cs[e].bajoBenchmark === true);
  const porEntidad = new Map();
  for (const e of bajoBenchmark) porEntidad.set(e, medirPieza(pieza, e, tabla));
  return { cartera, bajoBenchmark, porEntidad };
}

/** resultadosPisoDeCobranza(pieza, tabla) → { evaluables, porEntidad, nAlDia } — el mismo universo evaluable
 *  que `coberturaPisoDeCobranza` (regla 2 del sello: el libro evaluable COMPLETO), con la medición completa por
 *  cuenta (`medirPieza`) para las cuentas con vencido positivo (las "al día" no miden señal/bajo_piso: se
 *  cuentan aparte, `nAlDia`, igual que ya hace `coberturaPisoDeCobranza`). Owner 2026-09-24, presentación en
 *  bloque — sin cambiar la pertinencia ni el universo evaluable sellados de PRI-04. */
export function resultadosPisoDeCobranza(pieza, tabla) {
  const { evaluables } = _universoDePiso(tabla);
  const porEntidad = new Map();
  let nAlDia = 0;
  for (const e of evaluables) {
    const c = tabla.cuentas[e];
    if (c.vencidoPositivo === false) { nAlDia++; continue; }
    porEntidad.set(e, medirPieza(pieza, e, tabla));
  }
  return { evaluables, porEntidad, nAlDia };
}
