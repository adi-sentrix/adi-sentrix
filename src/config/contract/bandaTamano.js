/* === config/contract/bandaTamano.js · EL TAMAÑO GENERAL DE ADI · SE CALCULA, NUNCA SE PREGUNTA (owner 2026-10-05) ===
 * ═══════════════════════════════════════════════════════════════════════════════════════════════════════════
 * BLOQUE «TAMAÑO GENERAL DE ADI» (Etapa 2). Decisiones del owner (2026-10-05), textuales en su sentido:
 *   · El tamaño en ADI es un **criterio general y regional de ADI para el contexto de Knowledge**: NO es una
 *     clasificación legal ni una medición financiera de precisión. Acotado a eso — no abre la clasificación legal
 *     local ni otros usos.
 *   · Bandas por **ventas anuales en US$**, base **IFC** (International Finance Corporation, «Definitions of
 *     Targeted Sectors», https://www.ifc.org/ → Financial Institutions → Definitions of Targeted Sectors, columna
 *     «Annual sales US$»: micro < US$100.000 · pequeña US$100.000 a < US$3 millones · mediana US$3 a US$15 millones,
 *     verificado el 2026-10-05) y «grande» **sobre US$15 millones como EXTENSIÓN PROPIA DE ADI** (la fuente no define
 *     una banda mayor; la declaración vive en la `fuente` de esa banda, abajo).
 *   · Conversión: la venta anual (en la moneda del negocio) se pasa a US$ con el **promedio MENSUAL oficial del tipo de
 *     cambio del mes de CIERRE del período declarado**, publicado tal cual (`tablaTipoCambio.js`; ADI no calcula
 *     promedios). Sin tipo de cambio oficial válido para esa moneda y período → **NO clasifica** y declara por qué
 *     (falla cerrada: nunca el mes vecino, nunca interpolación). Moneda USD → factor 1, sin tabla.
 *   · La UF queda DESCONECTADA del perfil general: `tablaUF.js` (y `UMBRALES_UF`/`bandaPorUF`, movidos allí sin
 *     cambiar un valor) siguen en el repo SIN uso de este módulo ni del perfil; solo existirían para una capacidad
 *     futura que necesite la clasificación legal chilena. Reemplaza el diseño anterior de 2026-09-23 (umbrales
 *     2.400 · 25.000 · 100.000 UF), que clasificaba con la UF del cierre.
 *   · La procedencia de la banda es «criterio general de ADI» (la escribe `perfilCliente.js` desde la función única de
 *     origen de `businessPolicy.js`), `procedencia: "derivado"`: jamás «declarado por la empresa» ni «clasificación
 *     oficial».
 *
 * LOS BORDES (decisión documentada, el owner pidió definir de qué lado cae el valor exacto): se sigue la tabla IFC
 * LITERAL, que es de límite inferior inclusivo —micro «< US$100.000»; pequeña «US$100.000 – < US$3 millones»; mediana
 * «US$3 millones – US$15 millones»—. Por lo tanto: exactamente US$100.000 → pequeña; exactamente US$3.000.000 →
 * mediana; exactamente US$15.000.000 → mediana (el techo de la mediana es cerrado en la fuente); solo lo que supera
 * US$15.000.000 es grande. Si el owner prefiere el borde «hasta» (micro ≤ 100.000), se cambia en UNA constante
 * (`BANDAS_DE_TAMANO`), sin tocar la lógica.
 *
 * ⚠️ SIN RED. Este módulo importa SOLO `tablaTipoCambio.js` (una tabla de datos, ver su cabecera) y
 * `taxonomiaPerfil.js` (vocabulario puro) — nada de `fetch`, `oracle/llmGateway`, ni ningún cliente HTTP. El candado
 * `_tamano_general_gate` lee el TEXTO de este archivo y de `tablaTipoCambio.js` y se enciende si aparece una palabra
 * de red.
 *
 * QUÉ MES SE USA cuando el período abarca varios meses — el del CIERRE (`periodo_actual`), nunca un promedio de los
 * doce meses ni el del día de hoy: es la única fecha que el dato declara (`plantilla.js:PARAMETROS` — una fecha de
 * cierre, no un rango), y esta capa nunca reconstruye una serie que el cliente no entregó.
 *
 * DE DÓNDE SALE EL PERÍODO — SONDA (2026-09-23): el `dataset` que devuelve `motorKpi.js:calcularDataset` no expone el
 * período declarado como campo de primer nivel; la única ruta MEDIDA que sobrevive hasta el `tenant` en producción es
 * `tenant.hechos.parametros.periodo_actual` (`persistirCarga.server.js`, `activarVersion`). Un tenant escrito a mano
 * que NO declara esa ruta da «sin período declarado» — que es la verdad. `periodoDeclaradoDe` lee ESA ruta y ninguna
 * otra; no inventa un fallback (p. ej. el último mes de `ventasMensuales`): sería una inferencia silenciosa. */
import { tipoCambioDelPeriodo, monedasConTipoDeCambio } from "./tablaTipoCambio.js";
import { TAMANO_BANDAS } from "./taxonomiaPerfil.js";

export { TAMANO_BANDAS };

/** El origen de las tres bandas que define la fuente, y la declaración de la que NO define. */
const FUENTE_IFC = "IFC (International Finance Corporation), «Definitions of Targeted Sectors», ventas anuales en US$ — ifc.org, verificado el 2026-10-05";
const FUENTE_EXTENSION_ADI = "extensión propia de ADI: IFC no define una banda sobre US$15 millones; se declara así, no se atribuye a IFC";

/** LAS BANDAS, EN UNA SOLA CONSTANTE (ventas anuales en US$). `desdeIncluido`/`hastaIncluido` dicen de qué lado cae el
 *  valor exacto del umbral (ver «LOS BORDES» arriba): la tabla IFC es de límite inferior inclusivo; el techo de la
 *  mediana (15 millones) es cerrado en la fuente. `hastaUSD: null` = sin techo. Contiguas y en el orden de
 *  `TAMANO_BANDAS` (el gate lo verifica). Los códigos son los de la taxonomía del perfil: no hace falta migración. */
export const BANDAS_DE_TAMANO = Object.freeze([
  Object.freeze({ codigo: "micro",   desdeUSD: 0,       desdeIncluido: true,  hastaUSD: 100000,   hastaIncluido: false, fuente: FUENTE_IFC }),
  Object.freeze({ codigo: "pequena", desdeUSD: 100000,  desdeIncluido: true,  hastaUSD: 3000000,  hastaIncluido: false, fuente: FUENTE_IFC }),
  Object.freeze({ codigo: "mediana", desdeUSD: 3000000, desdeIncluido: true,  hastaUSD: 15000000, hastaIncluido: true,  fuente: FUENTE_IFC }),
  Object.freeze({ codigo: "grande",  desdeUSD: 15000000, desdeIncluido: false, hastaUSD: null,     hastaIncluido: false, fuente: FUENTE_EXTENSION_ADI }),
]);

/** bandaPorVentaUSD(ventaAnualUSD) → una de TAMANO_BANDAS | null (si el número no es válido). Pura, sin insumos
 *  externos — la función que de verdad clasifica, separada de dónde salen sus insumos para que la carnada de bordes
 *  pueda probarla directo, sin armar un tenant completo. */
export function bandaPorVentaUSD(ventaAnualUSD) {
  if (typeof ventaAnualUSD !== "number" || !Number.isFinite(ventaAnualUSD) || ventaAnualUSD < 0) return null;
  for (const b of BANDAS_DE_TAMANO) {
    const sobreElPiso = b.desdeIncluido ? ventaAnualUSD >= b.desdeUSD : ventaAnualUSD > b.desdeUSD;
    const bajoElTecho = b.hastaUSD == null ? true : (b.hastaIncluido ? ventaAnualUSD <= b.hastaUSD : ventaAnualUSD < b.hastaUSD);
    if (sobreElPiso && bajoElTecho) return b.codigo;
  }
  return null;
}

/** periodoDeclaradoDe(tenant) → "aaaa-mm" | null — ver la nota de la sonda arriba: la ÚNICA ruta medida que
 *  llega hasta acá es `tenant.hechos.parametros.periodo_actual`. */
export function periodoDeclaradoDe(tenant) {
  const crudo = tenant && tenant.hechos && tenant.hechos.parametros && tenant.hechos.parametros.periodo_actual;
  if (typeof crudo !== "string" || !crudo) return null;
  const p = crudo.slice(0, 7);
  return /^\d{4}-\d{2}$/.test(p) ? p : null;
}

/** mesesInformadosDe(tenant) → number | null — cuántos meses de venta trae el archivo. Reusa `ventasMensuales`
 *  (ya viaja en el dataset persistido). `null` cuando el campo no está — un tenant sin esta forma no fuerza un
 *  prorrateo que no puede probar. */
export function mesesInformadosDe(tenant) {
  const vm = tenant && tenant.ventasMensuales;
  return Array.isArray(vm) ? vm.length : null;
}

/** calcularBandaTamano({ ventaAnual, moneda, periodo, mesesInformados }) → el resultado con TODOS sus insumos, para
 *  poder auditar por qué se eligió esa banda. Pura: no toca `tenant`, no hace red, no adivina. Cadena de falla
 *  cerrada, en orden:
 *    1. sin `ventaAnual` numérica → sin banda.
 *    2. sin `periodo` (aaaa-mm) → sin banda («sin período declarado no hay tipo de cambio aplicable»).
 *    3. sin `moneda` → sin banda.
 *    4. moneda USD → factor 1 (sin tabla); cualquier otra → la fila EXACTA del mes de cierre en
 *       `tablaTipoCambio.js`; sin fila (moneda sin tabla, o mes sin tipo de cambio oficial) → sin banda y el
 *       motivo dice cuál de las dos cosas falta. Nunca el mes vecino, nunca interpolación. */
export function calcularBandaTamano({ ventaAnual, moneda, periodo, mesesInformados = null } = {}) {
  const insumosBase = { ventaAnual: typeof ventaAnual === "number" ? ventaAnual : null, moneda: moneda || null, periodo: periodo || null, mesesInformados };

  if (typeof ventaAnual !== "number" || !Number.isFinite(ventaAnual)) {
    return { banda: null, procedencia: null, motivo: "no hay venta anual con qué calcular la banda", insumos: insumosBase };
  }
  if (!periodo || !/^\d{4}-\d{2}$/.test(String(periodo).slice(0, 7))) {
    return { banda: null, procedencia: null, motivo: "sin período declarado no hay tipo de cambio aplicable — la banda no se calcula sin saber de qué mes es la venta", insumos: insumosBase };
  }
  if (!moneda) {
    return { banda: null, procedencia: null, motivo: "sin moneda declarada no hay con qué convertir la venta a US$", insumos: insumosBase };
  }

  const esUSD = String(moneda).toUpperCase() === "USD";
  const tc = esUSD ? { valor: 1, fila: null } : tipoCambioDelPeriodo(periodo, moneda);
  if (!tc) {
    const periodoMes = String(periodo).slice(0, 7);
    const motivo = monedasConTipoDeCambio().includes(String(moneda).toUpperCase())
      ? `no hay tipo de cambio oficial del mes «${periodoMes}» para la moneda «${moneda}» en la tabla (\`tablaTipoCambio.js\`) — ese mes de cierre no tiene promedio mensual publicado y firmado; ADI no usa el mes vecino ni interpola, así que no clasifica el tamaño`
      : `la moneda «${moneda}» no tiene tipo de cambio oficial en la tabla (\`tablaTipoCambio.js\`) — sin él no hay con qué convertir la venta a US$, y ADI no clasifica el tamaño sin ese dato (misma regla, sin excepción)`;
    return { banda: null, procedencia: null, motivo, insumos: insumosBase };
  }

  const proporcionada = typeof mesesInformados === "number" && mesesInformados > 0 && mesesInformados < 12;
  const ventaEfectiva = proporcionada ? ventaAnual * (12 / mesesInformados) : ventaAnual;
  const ventaAnualUSD = ventaEfectiva / tc.valor;
  const banda = bandaPorVentaUSD(ventaAnualUSD);

  return {
    banda,
    procedencia: banda ? "derivado" : null,
    motivo: banda ? null : "la venta anual no dio un número válido para clasificar (revisar el monto)",
    insumos: {
      ...insumosBase,
      ventaAnualProrrateada: proporcionada ? ventaEfectiva : null,
      proporcionada,
      tipoCambioValor: tc.valor,
      tipoCambioFila: tc.fila,
      ventaAnualUSD,
      bandas: BANDAS_DE_TAMANO,
    },
  };
}

/** textoDeFuenteDeBanda(resultado, etiquetaDeCriterio) → la `fuente` que acompaña a la banda en el perfil: nombra el
 *  criterio general (la etiqueta la entrega quien la toma de `businessPolicy.js`, nunca escrita acá), el tipo de
 *  cambio usado y la base IFC/extensión de ADI; y dice qué NO es. `null` si no hay banda. */
export function textoDeFuenteDeBanda(resultado, etiquetaDeCriterio) {
  if (!resultado || !resultado.banda || !resultado.insumos || !etiquetaDeCriterio) return null;
  const i = resultado.insumos;
  /* el decimal canónico es el PUNTO (owner, `figureType.js:SEPARADOR_DECIMAL`) y los umbrales se dicen sin separador de miles ambiguo: «100 mil», «3 millones» */
  const usd = (n) => (n >= 1000000 ? `${n / 1000000} millones` : `${n / 1000} mil`);
  const [micro, pequena, mediana, grande] = BANDAS_DE_TAMANO;
  const conversion = i.tipoCambioFila
    ? `venta anual convertida a US$ con el promedio mensual del dólar observado de ${i.periodo.slice(0, 7)} publicado por el SII ($${i.tipoCambioValor} por US$)`
    : "venta anual ya en US$ (factor 1, sin tipo de cambio)";
  return `${etiquetaDeCriterio} — ${conversion}, ubicada en las bandas de ADI: micro menor que US$${usd(micro.hastaUSD)}, pequeña hasta menos de US$${usd(pequena.hastaUSD)} y mediana hasta US$${usd(mediana.hastaUSD)} (base IFC), y grande sobre US$${usd(grande.desdeUSD)} (extensión propia de ADI, no de IFC). Es un contexto para Knowledge, no una clasificación legal ni una medición financiera de precisión`;
}
