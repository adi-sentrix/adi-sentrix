/* === config/contract/bandaTamano.js · LA BANDA DE TAMAÑO · SE CALCULA, NUNCA SE PREGUNTA (owner 2026-09-23) ===
 * ═══════════════════════════════════════════════════════════════════════════════════════════════════════════
 * TAREA 1 del encargo: `_ADI_PERFIL_VOCABULARIOS_PROPUESTA.md` §3, «Tamaño: tres [cuatro] bandas, derivadas, sin
 * tipo de cambio». Textual del owner: «la clasificación oficial está definida en UF... pero el usuario trabaja y
 * ve pesos.» Consecuencia de diseño (propuesta §3, textual): «el umbral se guarda en UF; los pesos son
 * presentación.»
 *
 * ⚠️ SIN RED. Este módulo importa SOLO `tablaUF.js` (una tabla de datos, ver su cabecera) y
 * `taxonomiaPerfil.js` (vocabulario puro) — nada de `fetch`, `oracle/llmGateway`, ni ningún cliente HTTP. El
 * candado `_uf_offline_gate` en `_entrega_gate.mjs` lee el TEXTO de este archivo y de `tablaUF.js` y se enciende
 * si aparece la palabra `fetch`, un `import` de un gateway o de cualquier módulo de red conocido.
 *
 * LA CADENA DE FALLA CERRADA (propuesta §3 + el encargo, textual): «sin período declarado no hay UF aplicable →
 * no hay banda → el perfil queda incompleto → la capa no se entrega.» Y lo mismo para una moneda sin tabla
 * firmada — «es la misma regla, sin excepción.» Ninguna de las dos rutas devuelve un valor aproximado: cuando
 * falta un insumo, `calcularBandaTamano` devuelve `banda: null` con el motivo exacto de qué faltó.
 *
 * QUÉ UF SE USA cuando el período abarca varios meses — DECISIÓN DE SIGNIFICADO, con fundamento (owner
 * 2026-09-23, «quiero tu lectura, no mi supuesto»): la del CIERRE del período (`periodo_actual`), nunca un
 * promedio de los doce meses ni la del día de hoy. Tres razones, ninguna es la costumbre por sí sola:
 *   1. Es la práctica de la clasificación oficial chilena: SII/SERCOTEC clasifican con la venta anual declarada
 *      en el ejercicio tributario y la UF vigente al cierre de ESE ejercicio, no un promedio de UF intra-año.
 *      Usar el cierre es alinearse con el mismo criterio que define los propios umbrales (2.400/25.000/100.000
 *      UF, `UMBRALES_UF` abajo), no un criterio distinto aplicado a una escala ajena.
 *   2. Es la única UF que el dato puede sostener sin inventar historia: `periodo_actual` es una fecha de cierre
 *      única (una sola fecha, `plantilla.js:PARAMETROS`), no un rango — no hay 12 fechas de cierre mensuales
 *      declaradas con las que promediar, y esta tabla nunca interpola ni reconstruye una serie que el cliente no
 *      entregó (misma ley que gobierna toda la tabla: «sin interpolación ni estimación»).
 *   3. Es la que más le importa al negocio cerca de un corte: la banda de una empresa que cruza 2.400 UF a mitad
 *      de año debe reflejar dónde TERMINÓ el ejercicio, no un promedio que diluye el cruce — clasificar "Micro"
 *      a una empresa que cerró el año ya "Pequeña" (o viceversa) sería la banda de un año que no fue.
 * Cambia en qué banda cae una empresa cerca de un corte: una empresa que promedia bajo el umbral pero CIERRA
 * sobre él (o al revés) tiene una banda distinta según qué UF se use — por eso queda esta decisión escrita, no
 * implícita en el código. `periodo_actual` es una fecha de cierre (una sola fecha), así que no hay ambigüedad de
 * "cuál mes del rango" una vez tomada esta decisión — la pregunta que sí sería una decisión de significado
 * (promediar UF entre varios meses) no se presenta con la forma actual del dato.
 *
 * DE DÓNDE SALE EL PERÍODO — SONDA (ver el informe de la tarea, sección "la sonda del período"): el `dataset`
 * que devuelve `motorKpi.js:calcularDataset` (el que se vuelve `tenant`/`pack`) NO expone el período declarado
 * como campo de primer nivel — se leyó el objeto `dataset` completo (líneas 410-450 de `motorKpi.js`) y no hay
 * ninguna clave de período. La única ruta MEDIDA que sobrevive hasta el `tenant` en producción es
 * `tenant.hechos.parametros.periodo_actual` (la fecha cruda que declaró el archivo, dentro de
 * `packAGuardar.hechos` — `persistirCarga.server.js`, y la reconstruye `activarVersion` en la fusión histórica,
 * línea 271). Un tenant escrito a mano (`empresa2`, el tenant vacío) que NO declara esa ruta da «sin período
 * declarado» — que es la verdad: nunca declaró un período en el sentido de la plantilla. `TENANT_DEMO` SÍ la
 * declara desde la corrección del owner 2026-09-23 (`data/tenants/demo.js`, ver el comentario junto a `hechos`
 * ahí: la evidencia del propio archivo para el período real del demo). `periodoDeclaradoDe` lee ESA ruta y
 * ninguna otra; no inventa un fallback (por ejemplo, tomar el último mes de `ventasMensuales`) porque eso sería
 * exactamente el tipo de inferencia silenciosa que este perfil prohíbe en cualquier otro campo. */
import { ufDelPeriodo } from "./tablaUF.js";
import { TAMANO_BANDAS } from "./taxonomiaPerfil.js";

export { TAMANO_BANDAS };

/** LOS UMBRALES EN UF, SELLADOS POR EL OWNER (2026-09-23, textual: «UMBRALES CONFIRMADOS POR EL OWNER:
 *  2.400 · 25.000 · 100.000 UF»). Semántica de borde (propuesta, tabla §3 — "hasta 2.400 UF" para Micro y
 *  "sobre 100.000 UF" para Grande): el umbral pertenece a la banda DE ABAJO — 2.400 UF exactos siguen siendo
 *  Micro, 25.000 UF exactos siguen siendo Pequeña, 100.000 UF exactos siguen siendo Mediana. Solo lo que supera
 *  estrictamente el umbral sube de banda. */
export const UMBRALES_UF = Object.freeze({ micro: 2400, pequena: 25000, mediana: 100000 });

/** bandaPorUF(ventaAnualUF) → una de TAMANO_BANDAS | null (si el número no es válido). Pura, sin insumos
 *  externos — la función que de verdad clasifica, separada de dónde salen sus insumos para que la carnada de
 *  bordes pueda probarla directo, sin tener que armar un tenant completo. */
export function bandaPorUF(ventaAnualUF) {
  if (typeof ventaAnualUF !== "number" || !Number.isFinite(ventaAnualUF) || ventaAnualUF < 0) return null;
  if (ventaAnualUF <= UMBRALES_UF.micro) return "micro";
  if (ventaAnualUF <= UMBRALES_UF.pequena) return "pequena";
  if (ventaAnualUF <= UMBRALES_UF.mediana) return "mediana";
  return "grande";
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
 *  (ya viaja en el dataset persistido, `motorKpi.js` línea 433 — a diferencia de `periodos.todos`, que solo
 *  vivía en la preview de carga y no sobrevivía al pack, medido en la misma sonda). `null` cuando el campo no
 *  está — un tenant sin esta forma no fuerza un prorrateo que no puede probar. */
export function mesesInformadosDe(tenant) {
  const vm = tenant && tenant.ventasMensuales;
  return Array.isArray(vm) ? vm.length : null;
}

/** calcularBandaTamano({ ventaAnual, moneda, periodo, mesesInformados }) → el resultado con TODOS sus insumos,
 *  para poder auditar por qué se eligió ese benchmark (propuesta §8, nota técnica). Pura: no toca `tenant`, no
 *  hace red, no adivina. Cadena de falla cerrada, en orden:
 *    1. sin `ventaAnual` numérica → sin banda.
 *    2. sin `periodo` (aaaa-mm) → sin banda («sin período declarado no hay UF aplicable»).
 *    3. sin tabla de UF para esa `moneda` → sin banda («la clasificación es chilena»; toda moneda que no sea
 *       CLP no tiene tabla hoy, y no tenerla ES la respuesta, no un caso pendiente de programar).
 *    4. sin una fila EXACTA para ese `periodo` en la tabla de esa moneda → sin banda (nunca se interpola). */
export function calcularBandaTamano({ ventaAnual, moneda, periodo, mesesInformados = null } = {}) {
  const insumosBase = { ventaAnual: typeof ventaAnual === "number" ? ventaAnual : null, moneda: moneda || null, periodo: periodo || null, mesesInformados };

  if (typeof ventaAnual !== "number" || !Number.isFinite(ventaAnual)) {
    return { banda: null, procedencia: null, motivo: "no hay venta anual con qué calcular la banda", insumos: insumosBase };
  }
  if (!periodo || !/^\d{4}-\d{2}$/.test(String(periodo).slice(0, 7))) {
    return { banda: null, procedencia: null, motivo: "sin período declarado no hay UF aplicable — la banda no se calcula sin saber de qué mes es la venta", insumos: insumosBase };
  }
  if (!moneda) {
    return { banda: null, procedencia: null, motivo: "sin moneda declarada no hay tabla de umbrales que consultar", insumos: insumosBase };
  }

  const uf = ufDelPeriodo(periodo, moneda);
  if (!uf) {
    const motivo = String(moneda).toUpperCase() === "CLP"
      ? `no hay UF firmada para el período «${periodo}» en la tabla (\`tablaUF.js\`) — hay que sembrar esa fila antes de poder clasificar este período`
      : `la moneda «${moneda}» no tiene tabla de umbrales firmada — la clasificación oficial de tamaño es chilena, expresada en UF; sin tabla propia para esta moneda no hay banda (misma regla, sin excepción)`;
    return { banda: null, procedencia: null, motivo, insumos: insumosBase };
  }

  const proporcionada = typeof mesesInformados === "number" && mesesInformados > 0 && mesesInformados < 12;
  const ventaEfectiva = proporcionada ? ventaAnual * (12 / mesesInformados) : ventaAnual;
  const ventaAnualUF = ventaEfectiva / uf.valor;
  const banda = bandaPorUF(ventaAnualUF);

  return {
    banda,
    procedencia: banda ? "derivado" : null,
    motivo: banda ? null : "la venta anual no dio un número válido para clasificar (revisar el monto)",
    insumos: {
      ...insumosBase,
      ventaAnualProrrateada: proporcionada ? ventaEfectiva : null,
      proporcionada,
      ufValor: uf.valor,
      ufFila: uf.fila,
      ventaAnualUF,
      umbralesUF: UMBRALES_UF,
    },
  };
}
