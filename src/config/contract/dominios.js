/* === config/contract/dominios.js · EL REGISTRO ÚNICO DE DOMINIOS (owner 2026-09-24, diseño aprobado
 * `encargo_natural_diseno.md` §2) ══════════════════════════════════════════════════════════════════════════════
 *
 * POR QUÉ EXISTE. Medido antes de escribir esto: cinco vocabularios paralelos de dominio, que no coinciden —
 * `dominiosDe` (`contratoDeDominios.js`: `_INVENTARIO`/`_COBRANZA`), `esTemaComercial` (`contratoComercial.js`:
 * `_COMERCIAL`/`_OTRO_UNIVERSO`), `criterioDeLaPregunta` (`prioridadIntegrada.js`: `_SINONIMOS`/`_OBJ`/
 * `_TESORERIA`), `predicados.js` (`pregunta.tema_<id>`) y `notario/lexico.js` (`DOMINIOS`, `DOMINIO_PALABRAS`).
 * De 96 conceptos del contrato del Notario, 24 no encendían su dominio en el reconocedor; de 53 palabras del
 * reconocedor, 39 no existían en el contrato. Este archivo es la fuente única de la que los demás DERIVAN.
 *
 * QUÉ DECLARA. Un dominio: `id · nombre · definicion · sujeto` (el eje de entidades del dominio: cliente | sku |
 * negocio) `· conceptosDeEntrada` (los fragmentos léxicos —palabra o fragmento de regex tolerante a morfología,
 * "vend[ií]…", "inmoviliz[\wáéíóúñ]*"— con los que una pregunta nombra el dominio; el mismo vocabulario que antes
 * vivía repetido en cada consumidor) `· metricas` (las claves de `notario/lexico.js:CLAVES_DE_METRICA` que son de
 * este dominio — por nombre, no por import, para no invertir la capa: `config/contract` no depende de `adi/notario`)
 * `· lentes` (las lentes de `prioridadIntegrada.js:LENTES` que este dominio trae: materialidad siempre; severidad y
 * urgencia si el dominio tiene señal) `· relaciones` ({con, tipo: "alimenta"|"impacta", clave}: con qué otro dominio
 * se relaciona, por qué CLAVE real y en qué sentido — la misma doctrina de `doctrinaDeCruce`) `· estado`
 * ("activo" con datos hoy | "ausente" — un dominio real del negocio que este producto no mide) `· boundary` (cómo
 * se arma el borde de palabra del regex derivado: "acento" — `(?<![\wáéíóúñ])…(?![\wáéíóúñ])`, tolera tildes
 * pegadas — o "w" — `\b…\b`, la que ya usaba `prioridadIntegrada.js` para tesorería) `· ausencia` (solo si
 * `estado: "ausente"`: `{ que, alternativa }`, la misma forma que exige `entrega/esquema.js`).
 *
 * LA MIGRACIÓN, EN DOS ETAPAS (owner, textual: «unión primero, fuente única después, con el candado "entrada
 * registrada ⇒ reconocida"»). Esta etapa hizo FUENTE ÚNICA, byte-idéntica, en los tres puntos donde relocar el
 * vocabulario sin cambiar UN CARÁCTER del regex resultante: `dominiosDe` (`_INVENTARIO`/`_COBRANZA`),
 * `esTemaComercial` (`_COMERCIAL`) y `pideTesoreria` (`_TESORERIA`) — los tres ahora llaman `regexDeDominio(id)`
 * y el `.source` del regex que arma es EXACTO al que antes vivía hardcodeado ahí (mismos fragmentos, mismo orden,
 * mismo envoltorio de borde). Lo que quedó en UNIÓN (no migrado, reportado, no un olvido):
 *   · `_OTRO_UNIVERSO` (`contratoComercial.js`) — una lista MÁS CHICA y compuesta a mano (16 fragmentos) que
 *     `inventario ∪ cobranza` de este registro (que suma 32): no es un recorte cualquiera, es una señal más
 *     liviana a propósito («inventario/cobranza APARECEN, no que compongan del todo») y derivarla como la unión
 *     real cambiaría qué preguntas retiran el tema comercial (ej.: hoy "mercadería" o "dormido" no lo retiran;
 *     con la unión completa, sí). Cambiar esa conducta es una decisión de producto, no una relocación segura.
 *   · `_SINONIMOS`/`_OBJ` (`prioridadIntegrada.js`) — el vocabulario de los CRITERIOS de prioridad (`riesgo`,
 *     `contribucion`, `credito`, `ventas`, `crecimiento`, `capital`), no de los dominios: mezcla palabras de
 *     dominio («cobranza», «capital») con palabras que no son de ningún dominio («riesgo», «urgente», «grave»,
 *     «peligro» — la lente de riesgo integrado cruza los tres). Forzarlo dentro de este registro confundiría
 *     "de qué dominio es esta pregunta" con "qué CRITERIO pidió el usuario para ordenar", que es una capa
 *     distinta (ver `CRITERIOS` en `prioridadIntegrada.js`).
 *   · `notario/lexico.js:DOMINIO_PALABRAS` — un vocabulario para un problema distinto (verificar de qué dominio
 *     es una predicación DENTRO de una prosa ya escrita, con sus propios verbos y adjetivos de la casa), no
 *     "¿de qué dominio es esta pregunta". Solo `DOMINIOS` (la lista plana de ids) se movió a derivarse de acá.
 * Candado: `_registro_de_dominios_gate.mjs` prueba que un dominio SINTÉTICO agregado a una COPIA de este arreglo
 * se reconoce con `dominiosDeTexto` sin tocar ninguna línea de `dominiosDe`/`esTemaComercial`/`pideTesoreria`
 * (la escalabilidad), y que cada concepto activo del registro enciende su dominio (entrada registrada ⇒
 * reconocida).
 *
 * PURO · sin dependencias de `adi/` (capa de contrato, no de negocio) · determinístico · sin red. */

const _W = "[\\wáéíóúñ]";

/* ── EL REGISTRO ─────────────────────────────────────────────────────────────────────────────────────────────── */
export const DOMINIOS_REGISTRO = [
  {
    id: "comercial",
    nombre: "Comercial",
    definicion: "la venta a clientes: monto, evolución, margen, contribución, carga comercial y precio/costo — el resultado comercial del negocio, por cuenta.",
    sujeto: "cliente",
    estado: "activo",
    boundary: "acento",
    /* byte-idéntico a `_COMERCIAL` (contratoComercial.js, hasta esta etapa): mismos fragmentos, mismo orden. */
    conceptosDeEntrada: [
      "ventas?", `vend[ií](?:[oó]|mos|endo|ste|eron|a|an|e|en)?`, `vend(?:o|es|e|en|emos)`, "vendid[oa]s?",
      `factur${_W}*`, "ingresos?", `contribu${_W}*`, "m[aá]rgen(?:es)?", `rentab${_W}*`, "benchmark", "costos?",
      "precios?", "markup", "acciones comerciales", "carga comercial", "rebates?", "descuentos?", "clientes?",
      "cuentas?", "cartera", "negocio", "resultado comercial", `crec${_W}*`, "volumen", "mix", "ticket",
      "comercial(?:es)?", "ganamos", "ganando", "gano", "mejorando", "apuesta",
    ],
    metricas: ["ventas", "ventas_anterior", "margen", "margen_promedio", "contribucion", "no_capturada", "carga",
      "carga_alta", "brecha", "brecha_precio_costo", "unidades", "markup", "peso_costo", "costo", "variacion",
      "variacion_usd", "vs_presupuesto", "vs_presupuesto_usd", "benchmark", "nivel_carga", "umbral_materialidad"],
    lentes: ["materialidad", "severidad"],   // sin urgencia: «el comercial no trae señal de tiempo en este dato» (prioridadIntegrada.js)
    /* LA MEDIDA DE DINERO EN JUEGO DEL DOMINIO (owner 2026-09-24, ronda 4): la cifra que un cierre ENTRE TEMAS
     * compara —siempre la MISMA, sin importar qué concepto nombró la línea de este dominio—, para que «ventas» o
     * «carga» (que no son esta medida) nunca se cuelen en una comparación de tamaño como si lo fueran; si la
     * línea usó otro concepto, quien cierra declara la sustitución. `regex` casa el rótulo de la boleta TAL
     * COMO lo imprime el agente (verificado en vivo, `runPlan` sobre el dominio solo): «Contribución no
     * capturada · subtotal · 5 cuentas materiales (de 8 bajo el benchmark)» — el universo puede faltar o variar,
     * de ahí el sufijo optativo. `concepto` es la clave de `notario/lexico.js:CLAVES_DE_METRICA` que ES esta
     * medida (para que el reconocedor de concepto sepa si el balde nombrado YA es la medida o es otra cosa). */
    dineroEnJuego: { rotulo: "Contribución no capturada", regex: /^Contribuci[oó]n no capturada · subtotal(?: · \d+ cuentas[^·]*)?$/i, concepto: "no_capturada" },
    relaciones: [
      { con: "inventario", tipo: "alimenta", clave: "sku" },
      { con: "cobranza", tipo: "alimenta", clave: "cliente" },
    ],
  },
  {
    id: "inventario",
    nombre: "Inventario",
    definicion: "el stock: capital, días de inventario, rotación y estado de cada SKU (rotando en rango · riesgo de quiebre · sobrestock · inmovilizado) — una FOTO, nunca un acumulado.",
    sujeto: "sku",
    estado: "activo",
    boundary: "acento",
    /* byte-idéntico a `_INVENTARIO` (contratoDeDominios.js, hasta esta etapa). */
    conceptosDeEntrada: [
      "inventarios?", "stock", "existencias", "mercader[ií]as?", "rotaci[oó]n", "rot(?:a|an|ando)", "bodegas?",
      "dep[oó]sitos?", "almac[eé]n(?:es)?", "reposici[oó]n", "reponer", "quiebres?", "sobrestock",
      `inmoviliz${_W}*`, `frenad${_W}*`, `dormid${_W}*`, "capital(?! de trabajo)", "d[ií]as de inventario", "cobertura",
    ],
    metricas: ["capital", "capital_frenado", "capital_inmovilizado", "rotacion", "dias_inventario", "dias_sin_venta",
      "unidades_stock", "margen_inventario", "piso_rotacion", "techo_cobertura"],
    lentes: ["materialidad", "severidad", "urgencia"],
    /* verificado en vivo: al pedir SOLO inventario el agregado sale como «Capital frenado · total»; dentro de un
     * pedido conjunto con comercial puede salir «Capital frenado · subtotal» a secas — el mismo número, otro
     * rótulo según qué tool lo trajo primero. Se casan los dos. */
    dineroEnJuego: { rotulo: "Capital frenado", regex: /^Capital frenado · (?:total|subtotal)$/i, concepto: "capital_frenado" },
    relaciones: [{ con: "comercial", tipo: "alimenta", clave: "sku" }],
  },
  {
    id: "cobranza",
    nombre: "Cobranza",
    definicion: "cuentas por cobrar: saldo pendiente, vencido y su atraso — el control de la EXPOSICIÓN DE CRÉDITO por cliente (solo la venta A CRÉDITO la genera) y el apoyo a la decisión comercial, además de su impacto financiero. No es tesorería (ver `caja ≠ cobranza`, ley `adi-caja-no-es-cobranza`).",
    sujeto: "cliente",
    estado: "activo",
    boundary: "acento",
    /* la base es byte-idéntica a `_COBRANZA` (contratoDeDominios.js, hasta la etapa 1), CON UNA EXCEPCIÓN
     * (etapa 4, owner 2026-09-24, medido con el set de diseño v1 — ley «caja ≠ cobranza», `adi-caja-no-es-
     * cobranza`): «flujo de caja» y «efectivo» SE QUITARON. Eran el hallazgo que la etapa 1 dejó documentado sin
     * tocar («"efectivo" enciende cobranza Y tesorería a la vez») — una inconsistencia real con la ley del
     * 2026-09-24, que el set v1 destapó como falla («q42: "cómo anda mi flujo de caja" — temas=[tesorería] SOLO,
     * y `dominiosDe` encendía cobranza también»). Los dos fragmentos ya viven, correctos, en `tesoreria` (abajo);
     * quitarlos de acá no pierde cobertura: cobranza sigue con `por cobrar`/`saldos pendientes`/`vencido`/etc.
     * Grep confirmado (2026-09-24): ningún gate depende de que «efectivo»/«flujo de caja» enciendan cobranza.
     * Dos fragmentos MÁS se agregaron en la etapa 2: tolerancia morfológica — «vendí, cobré» son el ejemplo
     * TEXTUAL del diseño aprobado («cobré» no encendía cobranza: ninguno de los fragmentos de siempre cubre la
     * primera persona del pretérito). Solo la forma ACENTUADA («cobré»/«cobrés», nunca «cobre» sin tilde): sin
     * tilde colisiona con «el cobre» (el metal) — un falso positivo real, aunque improbable en este negocio.
     * `paga` (3a persona: «cómo paga», del ejemplo «…considerando margen, stock y cómo paga?») — sin colisión
     * conocida en este negocio. */
    conceptosDeEntrada: [
      "cobranzas?", "cobros?", "cobrad[oa]s?", "cobrar", "cobrando", "vencid[oa]s?", "mora", "deudas?", "deben",
      "debe", `adeud${_W}*`, "abonos?", "abonad[oa]s?", "pagos?", "paga", "pagan", "pagado", "pagar", "plazo de pago",
      "por cobrar", "saldos? pendientes?", "cr[eé]dito", "contado", "cobrés?",
    ],
    metricas: ["venta_credito", "saldo_vencido", "saldo_pendiente", "saldo_por_vencer", "abonado", "recuperado", "dias_vencido"],
    lentes: ["materialidad", "severidad", "urgencia"],
    dineroEnJuego: { rotulo: "Saldo vencido", regex: /^Saldo vencido · total$/i, concepto: "saldo_vencido" },
    relaciones: [{ con: "comercial", tipo: "alimenta", clave: "cliente" }],
  },
  {
    id: "tesoreria",
    nombre: "Tesorería",
    definicion: "posición de caja, liquidez y movimientos de efectivo — capital de trabajo, pagos a proveedores, sueldos. DISTINTA de cobranza: cobranza controla la exposición de crédito, no la caja.",
    sujeto: "negocio",
    estado: "ausente",
    boundary: "w",
    /* la base es byte-idéntica a `_TESORERIA` (prioridadIntegrada.js, hasta la etapa 1 — con el envoltorio "w",
     * ver `boundary` arriba). `proveedores`, `sueldos` y `capital de trabajo` se agregaron en la etapa 4 (owner
     * 2026-09-24, medido con el set de diseño v1: «con lo que me deben los clientes, me alcanza para pagarle a
     * mis proveedores este mes?», «cuál es mi capital de trabajo disponible ahora mismo?» — tesorería real que
     * NO usa la palabra «caja»/«liquidez»/«efectivo»; sin este fragmento quedaba sin ningún dominio reconocido,
     * ni siquiera ausente. Las mismas palabras que ya lista CLAUDE.md §"prioridad integrada" para esta ley
     * (`adi-caja-no-es-cobranza`): «capital de trabajo, pagos a proveedores, sueldos». `plata para` (bigrama, no
     * "plata" sola —demasiado genérica en el habla chilena— del ejemplo v1 «si cobro todo lo vencido hoy, tengo
     * plata para comprar más stock?»): la pregunta de fondo es de caja aunque el insumo sea cobranza/inventario. */
    conceptosDeEntrada: ["caja", "liquidez", "efectivo", "tesorer[ií]a", "proveedores", "sueldos", "capital de trabajo", "plata para"],
    metricas: [],
    lentes: [],
    relaciones: [{ con: "cobranza", tipo: "impacta" }],
    ausencia: {
      id: "sin_datos_tesoreria",
      que: "posición de caja ni movimientos de tesorería",
      alternativa: "la exposición de crédito por cliente (saldo vencido al corte y su atraso) — la referencia disponible sobre crédito, no sobre caja",
    },
  },
];

const _porId = new Map(DOMINIOS_REGISTRO.map((d) => [d.id, d]));

/** dominioPorId(id, registro?) → la entrada del registro, o null. `registro` optativo: una COPIA (para el
 *  candado de escalabilidad, que agrega un dominio sintético sin tocar el registro real). */
export function dominioPorId(id, registro = DOMINIOS_REGISTRO) {
  const mapa = registro === DOMINIOS_REGISTRO ? _porId : new Map(registro.map((d) => [d.id, d]));
  return mapa.get(String(id || "")) || null;
}

/** idsActivos(registro?) → los ids de dominio con `estado: "activo"`, en el orden del registro. */
export function idsActivos(registro = DOMINIOS_REGISTRO) {
  return registro.filter((d) => d.estado === "activo").map((d) => d.id);
}

/** idsDeDominios({ incluirAusentes, registro }) → todos los ids, o solo los activos. */
export function idsDeDominios({ incluirAusentes = false, registro = DOMINIOS_REGISTRO } = {}) {
  return registro.filter((d) => incluirAusentes || d.estado === "activo").map((d) => d.id);
}

/** conceptosDe(id, registro?) → el array de conceptos de entrada de ese dominio, [] si no existe. */
export function conceptosDe(id, registro = DOMINIOS_REGISTRO) {
  const d = dominioPorId(id, registro);
  return d ? d.conceptosDeEntrada.slice() : [];
}

/** dineroEnJuegoDe(id, registro?) → { rotulo, regex, concepto } | null — la medida de dinero en juego que ese
 *  dominio declara (owner 2026-09-24, ronda 4): la cifra que un cierre ENTRE TEMAS compara, siempre la misma,
 *  nunca la del concepto que nombró la línea. `null` si el dominio no declara una (tesorería, por ausente). */
export function dineroEnJuegoDe(id, registro = DOMINIOS_REGISTRO) {
  const d = dominioPorId(id, registro);
  return (d && d.dineroEnJuego) || null;
}

/** regexDeConceptos(conceptos, { boundary }) → RegExp | null — el mismo envoltorio de borde que ya usaban los
 *  cinco consumidores de esta casa: "acento" tolera una tilde pegada al concepto (`(?<![\wáéíóúñ])…(?![\wáéíóúñ])`,
 *  la forma de `contratoDeDominios.js`/`contratoComercial.js`); "w" es el borde de palabra estándar (`\b…\b`, la
 *  forma que ya usaba `prioridadIntegrada.js` para tesorería). */
export function regexDeConceptos(conceptos, { boundary = "acento" } = {}) {
  const arr = (Array.isArray(conceptos) ? conceptos : []).filter(Boolean);
  if (!arr.length) return null;
  const cuerpo = arr.join("|");
  return boundary === "w" ? new RegExp(`\\b(?:${cuerpo})\\b`, "i") : new RegExp(`(?<!${_W})(?:${cuerpo})(?!${_W})`, "i");
}

const _cacheRegex = new Map();
/** regexDeDominio(id, registro?) → el regex derivado del dominio (su propio `boundary`), cacheado por id cuando
 *  se usa el registro real (una `registro` distinta — la copia del candado de escalabilidad — nunca se cachea). */
export function regexDeDominio(id, registro = DOMINIOS_REGISTRO) {
  const d = dominioPorId(id, registro);
  if (!d) return null;
  if (registro === DOMINIOS_REGISTRO) {
    if (!_cacheRegex.has(id)) _cacheRegex.set(id, regexDeConceptos(d.conceptosDeEntrada, { boundary: d.boundary }));
    return _cacheRegex.get(id);
  }
  return regexDeConceptos(d.conceptosDeEntrada, { boundary: d.boundary });
}

/** dominiosDeTexto(texto, { registro }) → { dominios: [ids activos cuyo léxico aparece], ausentes: [ids ausentes
 *  cuyo léxico aparece] } — el reconocedor PURO del registro: sirve para el candado de escalabilidad (un dominio
 *  sintético en una COPIA del registro se reconoce sin tocar esta función) y como pieza reusable fuera del
 *  pipeline de `contratoDeDominios.js` (que además filtra saludos, definiciones y nombres de entidad del tenant
 *  — esta función es más simple a propósito: solo léxico). */
export function dominiosDeTexto(texto, { registro = DOMINIOS_REGISTRO } = {}) {
  const q = String(texto || "");
  const dominios = [], ausentes = [];
  for (const d of registro) {
    const re = regexDeDominio(d.id, registro);
    if (re && re.test(q)) (d.estado === "activo" ? dominios : ausentes).push(d.id);
  }
  return { dominios, ausentes };
}
