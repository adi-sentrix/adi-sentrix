/* === config/contract/coberturaDeFuentes.js · LA COBERTURA DE CADA FUENTE (owner 2026-10-01, §7.3·52b · «el cero solo si el dato lo demuestra») ═══
 *
 * LA REGLA DEL OWNER. Hay DOS ceros reales y nada más:
 *   · el MEDIDO: la fuente tiene la fila de la entidad y el valor es 0;
 *   · el de COBERTURA DECLARADA: la fuente declara que cubre a todo el grupo; no figurar = nada, y se dice por qué
 *     («no figura entre los SKU inmovilizados críticos»).
 * Todo lo demás es DATO AUSENTE: «sin dato de X para Y», nunca un número; no se ordena, no se cuenta ni se suma como 0, y se declara aparte.
 * Una tasa sin denominador es «sin dato», nunca 0 %. Cada cifra lleva su origen: medido · cobertura declarada · ausente.
 *
 * QUÉ REEMPLAZA. `AUSENTE_VALE_CERO` era una LISTA POR MÉTRICA (`notario/lexico.js`) que decía «lo que no figura vale 0» para siete claves,
 * sin preguntar si la fuente cubría de verdad a la entidad: un saldo vencido «ausente» era cero aunque la cuenta nunca hubiera entrado a la
 * mesa de cobranza. Ahora la lista es una DECLARACIÓN DE COBERTURA POR FUENTE: cada fuente dice qué grupo cubre (sus `ejes`) y, de las
 * métricas que publica solo para los miembros que cumplen su definición, por qué quien no figura no tiene nada. Lo que NO está declarado
 * acá no vale cero: la mesa de cobranza (saldo vencido, saldo pendiente, días vencido…) y los días sin venta publican una FILA por cada
 * cuenta o SKU que cubren —su cero es MEDIDO, está en la fila—, y una cuenta que la mesa no trae es dato ausente.
 *
 * LA FUENTE DE CADA ENTRADA (todas del dato del tenant, `config/contract/sourceManifest.js`):
 *   · `foto_inventario`  — `skuInventario`: la foto de TODOS los SKU del inventario (y las bodegas, marcas y familias que ellos forman).
 *                          El capital inmovilizado (crítico o la categoría amplia) solo lo publican los SKU que cumplen la definición.
 *   · `venta_comercial`  — `clientesMargen`: la venta comercial de TODAS las cuentas (con su margen y su carga). La contribución no capturada
 *                          solo la publican las cuentas bajo el benchmark; la carga comercial alta, las cuentas sobre el nivel declarado.
 * Un pack nuevo declara su cobertura acá con una entrada más; ningún composer ni verificador la escribe a mano.
 *
 * PURO · sin imports · determinístico. */

export const COBERTURA_DE_FUENTES = Object.freeze([
  Object.freeze({
    id: "foto_inventario",
    fuente: "la foto de inventario",
    cubre: "todos los SKU del inventario y las bodegas, marcas y familias que forman",
    ejes: Object.freeze(["sku", "bodega", "marca", "familia"]),
    /* métrica → por qué quien no figura no tiene nada (el texto que acompaña al cero de cobertura: corto a propósito, viaja en la columna «Tipo» de cada fila y cuenta contra el tope de palabras) */
    metricas: Object.freeze({
      capital_frenado: "no figura entre los inmovilizados críticos",
      capital_inmovilizado: "no figura entre los inmovilizados",
    }),
  }),
  Object.freeze({
    id: "venta_comercial",
    fuente: "la venta comercial por cuenta",
    cubre: "todas las cuentas de la venta comercial",
    ejes: Object.freeze(["cliente", "marca", "familia", "canal"]),
    metricas: Object.freeze({
      no_capturada: "no figura bajo el benchmark",
      carga_alta: "no figura sobre el nivel de carga",
    }),
  }),
]);

/** coberturaDeLaMetrica(clave, eje?) → { fuente, id, cubre, porQue } si ALGUNA fuente declara que cubre al grupo y que quien no figura en la métrica no tiene nada;
 *  null en cualquier otro caso (el cero de esa métrica solo puede ser MEDIDO, y sin fila es dato ausente). Sin `eje`, vale que alguna fuente la declare. */
export function coberturaDeLaMetrica(clave, eje = null) {
  if (!clave) return null;
  const e = eje == null ? null : String(eje).trim().toLowerCase();
  for (const f of COBERTURA_DE_FUENTES) {
    if (!Object.prototype.hasOwnProperty.call(f.metricas, clave)) continue;
    if (e != null && !f.ejes.includes(e)) continue;
    return { id: f.id, fuente: f.fuente, cubre: f.cubre, porQue: f.metricas[clave] };
  }
  return null;
}

/** las métricas cuya ausencia una fuente declara cubierta (para los generadores y los gates; nunca para decidir un cero) */
export const METRICAS_CON_COBERTURA = Object.freeze([...new Set(COBERTURA_DE_FUENTES.flatMap((f) => Object.keys(f.metricas)))]);
