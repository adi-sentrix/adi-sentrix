/* === src/adi/llm/consumo.js · EL AGREGADOR DE UNA CORRIDA (owner 2026-09-25, ETAPA 0 · "el contador de consumo") ==
 *
 * POR QUÉ EXISTE. CLAUDE.md §3, textual: «el repo NO registra consumo. No hay contador de llamadas, gasto ni
 * reintentos… ninguna afirmación de costo es verificable hoy». La telemetría (`telemetry.js` + `telemetrySink.js`)
 * ya MIDE cada llamada y la ESCRIBE — lo que faltaba es alguien que la LEA y conteste, sin abrir la calculadora a
 * mano, las preguntas que motivaron el instrumento: ¿cuántas llamadas salieron?, ¿con qué modelo?, ¿cuánto costó?,
 * ¿cuántas volvieron sin poder contarse?, ¿cuántas fueron reintentos?
 *
 * QUÉ ES: una función PURA. `resumenDeCorrida(eventos)` recibe la lista de renglones que ya produjo `telemetry.js`
 * (el mismo objeto que `emit()` manda al sink, uno por línea de un JSONL) y devuelve un resumen. Sin red, sin
 * proveedor, sin efectos — el mismo candado de pureza que ya rige `modelPricing.js` y `telemetry.js`: esto OBSERVA
 * lo que ya se registró, no decide nada del negocio ni vuelve a llamar a nadie.
 *
 * TRES REGLAS QUE EL ENCARGO FIJÓ Y QUE ESTE MÓDULO NO PUEDE ROMPER:
 *   1. UNA LLAMADA «SALIÓ AL PROVEEDOR» SOLO SI `ev.consumo` LO DICE. El campo lo decide `telemetry.js` con el
 *      cruce `salioAlProveedor` (ver `desdeRespuesta`): un turno frenado ANTES de tocar al proveedor (acceso,
 *      rate limit, `falta` de proveedor, un guard) tiene `consumo: null` y no cuenta como llamada, aunque haya un
 *      evento de telemetría para él (frenos y llamadas comparten el mismo canal de observación, a propósito).
 *   2. SIN CONTEO NO ES CERO. Un evento con `consumo:"sin_conteo"` SALIÓ y VOLVIÓ sin `tokens_in`/`tokens_out`
 *      utilizables — pudo facturarse igual (ver el bloque CONSUMO en `telemetry.js`). Se cuenta APARTE, nunca se
 *      suma como 0 tokens ni como $0: sumarlo como cero es la mentira exacta que `modelPricing.js` ya documentó
 *      («un costo desconocido no es un costo cero») y que este agregador no puede repetir.
 *   3. UN MODELO SIN PRECIO SE DECLARA, NUNCA SE OMITE. El costo de cada llamada «contada» se resuelve con
 *      `costoLlamadaUSD` (la MISMA función que usa el router / la UI — no se reimplementa la tarifa acá, sería una
 *      segunda fuente que se desincroniza con `modelPricing.js` a la primera tabla que cambie). Cuando esa función
 *      devuelve `SIN_PRECIO`, el modelo entra a `modelosSinPrecio` y NO se suma como si costara $0: cualquier total
 *      que lo hiciera estaría subcontando en silencio, exactamente el defecto que `modelPricing.js` ya cerró una vez.
 *
 * QUÉ NO HACE: no instala nada, no lee un archivo, no decide si una corrida "pasó" — eso es del gate y de quien lo
 * lea. `corridaMedida.js` es quien abre/cierra una corrida real contra un sink; este archivo solo agrega.
 */
import { costoLlamadaUSD, ESTADO_COSTO } from "./modelPricing.js";

// clave de agrupación por proveedor·modelo·etapa — "null" declarado, nunca undefined silencioso.
const _clave = (ev) => `${ev.proveedor ?? "(sin proveedor)"}\u0000${ev.modelo ?? "(sin modelo)"}\u0000${ev.etapa ?? "(sin etapa)"}`;

function _grupoVacio(ev) {
  return {
    proveedor: ev.proveedor ?? null,
    modelo: ev.modelo ?? null,
    etapa: ev.etapa ?? null,
    llamadas: 0,
    sinConteo: 0,
    tokens_in: 0,
    tokens_in_cache: 0,
    tokens_in_fresh: 0,
    tokens_out: 0,
    costoUSD: 0,
  };
}

/**
 * resumenDeCorrida(eventos) → resumen puro de una corrida, a partir de la lista de renglones de telemetría.
 * `eventos` puede venir de memoria (un array que juntó el propio sink) o de releer un JSONL línea a línea —
 * a este módulo le da igual el origen: solo mira la forma que ya declaró `telemetry.js`.
 */
export function resumenDeCorrida(eventos = []) {
  const lista = Array.isArray(eventos) ? eventos.filter((e) => e && typeof e === "object") : [];

  const grupos = new Map();
  const sinConteoDetalle = [];
  const modelosSinPrecio = new Map();   // modelo → veces (declarado, no solo un booleano)
  const resultados = {};                // resultado declarado → cuenta (incluye los frenados: también son un hecho)
  const reintentosPorEtapa = {};
  let reintentosTotal = 0;
  let salieron = 0, sinConteoTotal = 0;
  let tokensIn = 0, tokensInCache = 0, tokensInFresh = 0, tokensOut = 0;
  let costoUSDTotal = 0;

  for (const ev of lista) {
    // resultado y reintento se cuentan SIEMPRE, salga o no la llamada: un turno frenado también es un hecho de la
    // corrida (por eso "resultado" no se filtra por `consumo`, a diferencia del resto de este bloque).
    const res = ev.resultado ?? "(sin resultado)";
    resultados[res] = (resultados[res] || 0) + 1;
    if (Number(ev.intento) > 0) {
      reintentosTotal++;
      const et = ev.etapa ?? "(sin etapa)";
      reintentosPorEtapa[et] = (reintentosPorEtapa[et] || 0) + 1;
    }

    if (ev.consumo !== "contado" && ev.consumo !== "sin_conteo") continue;   // no salió al proveedor: no es una llamada

    salieron++;
    const clave = _clave(ev);
    if (!grupos.has(clave)) grupos.set(clave, _grupoVacio(ev));
    const g = grupos.get(clave);
    g.llamadas++;

    if (ev.consumo === "sin_conteo") {
      g.sinConteo++;
      sinConteoTotal++;
      sinConteoDetalle.push({ traceId: ev.traceId ?? null, proveedor: ev.proveedor ?? null, modelo: ev.modelo ?? null, etapa: ev.etapa ?? null });
      continue;   // REGLA 2: sin conteo no se suma como cero — ni tokens ni costo
    }

    // "contado": hay tokens utilizables (telemetry.js ya lo garantiza: "contado" ⇔ algún tokens_in/out no-null)
    if (ev.tokens_in != null) { g.tokens_in += ev.tokens_in; tokensIn += ev.tokens_in; }
    if (ev.tokens_in_cache != null) { g.tokens_in_cache += ev.tokens_in_cache; tokensInCache += ev.tokens_in_cache; }
    if (ev.tokens_in_fresh != null) { g.tokens_in_fresh += ev.tokens_in_fresh; tokensInFresh += ev.tokens_in_fresh; }
    if (ev.tokens_out != null) { g.tokens_out += ev.tokens_out; tokensOut += ev.tokens_out; }

    const { usd, estado } = costoLlamadaUSD(ev.modelo, { input_tokens: ev.tokens_in, output_tokens: ev.tokens_out });
    if (estado === ESTADO_COSTO.TARIFADO) {
      g.costoUSD += usd;
      costoUSDTotal += usd;
    } else if (estado === ESTADO_COSTO.SIN_PRECIO) {
      // REGLA 3: se declara, nunca se suma como $0.
      const id = ev.modelo || "(sin modelo)";
      modelosSinPrecio.set(id, (modelosSinPrecio.get(id) || 0) + 1);
    }
    // SIN_USAGE no debería llegar acá (ya filtramos por "contado"), pero por robustez tampoco sumaría nada.
  }

  return {
    eventos: lista.length,
    salieron,
    noSalieron: lista.length - salieron,
    sinConteo: { total: sinConteoTotal, detalle: sinConteoDetalle },
    porGrupo: [...grupos.values()],
    tokens: { in: tokensIn, inCache: tokensInCache, inFresh: tokensInFresh, out: tokensOut },
    costoUSD: costoUSDTotal,
    modelosSinPrecio: [...modelosSinPrecio.entries()].map(([modelo, veces]) => ({ modelo, veces })),
    reintentos: { total: reintentosTotal, porEtapa: reintentosPorEtapa },
    resultados,
  };
}
