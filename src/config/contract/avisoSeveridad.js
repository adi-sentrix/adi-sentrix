/* === config/contract/avisoSeveridad.js · LA SEVERIDAD DE CADA AVISO DE INGESTA, DECLARADA (2026-09-25) =========
 *
 * Corrección del supervisor sobre el Acta de ingesta (corte 0a): `actaDeIngesta.js` clasificaba la severidad de
 * un aviso con un REGEX sobre su `tipo` («contradictori|incoherente|no-positiva|sospechos|…»). Un regex es un
 * reconocedor que crece por parecido y falla en silencio ante una forma nueva — exactamente lo que la ley
 * `adi-no-desviarse-deterministico` prohíbe para texto de negocio, y el mismo riesgo aplica acá: un `tipo`
 * nuevo que no matchee ningún patrón caía a "info" sin que nadie lo decidiera.
 *
 * ESTA ES LA TABLA CERRADA, declarada por su `tipo` (la clave estable que ya usan `B()`/`A()` en
 * `validarPlantilla.js`, los avisos de `motorKpi.js`/`serieDesdePlanilla.js` y los de `ingestarLibro.js`/
 * `normalizar.js`). Solo cubre AVISOS — un BLOQUEO, por definición, siempre rechaza la carga entera, así que su
 * severidad es "blocker" sin necesidad de tabla (`actaDeIngesta.js` lo fija directo).
 *
 * LA PARTICIÓN (CLAUDE.md §4, las categorías que ya usa `validationRules.js` para el dato consolidado, aplicadas
 * acá al RESULTADO de una carga suelta):
 *   · "warning" — algo que huele a error real del archivo o del dato: una fila que no cierra, una entidad cuya
 *     serie no reconcilia, una hoja que no se pudo clasificar, una fila descartada por falta de clave. Vale la
 *     pena que una persona lo mire.
 *   · "info"    — una limitación DECLARADA del archivo (una columna opcional vacía, un benchmark que cae a la
 *     referencia general, una celda sin dato): el archivo está bien, simplemente no trae eso.
 *
 * ⚠️ UN `tipo` SIN ENTRADA HACE FALLAR, no cae a "info" en silencio (`severidadAviso` lanza). Cuando un aviso
 * nuevo aparezca en cualquiera de los dos caminos de ingesta, este archivo es DONDE se declara su severidad —
 * nunca un patrón que lo adivine por el nombre.
 */

export const SEVERIDAD_AVISO = {
  // ── camino negocio (validarPlantilla.js) ──────────────────────────────────────────────────────────────────
  "clave-mas-gruesa": "info",                  // se pudo cargar igual, agregado al total — declarado, no error
  "columna-opcional-vacia": "info",            // limitación declarada: ADI no va a poder responder sobre eso
  "fila-duplicada-identica": "info",           // colapsa inofensivo (mismos valores) — no es una contradicción
  "parametro-ausente": "info",                 // cae a la referencia general de ADI, declarado en pantalla

  // ── camino negocio (motorKpi.js) ──────────────────────────────────────────────────────────────────────────
  "benchmark-sin-declarar": "info",            // ídem: referencia general, declarada
  "periodo-declarado-sin-ventas": "warning",   // el período que el negocio dijo informar no tiene filas — revisar
  "sin-periodo-anterior": "info",              // limitación del archivo (un solo período), no un error
  "sku-solo-en-inventario": "info",            // SKU en stock sin venta informada — declarado, no bloquea
  "sku-sin-valorizar": "warning",              // no se pudo costear ese SKU: el capital en stock queda incompleto
  "sku-sin-ritmo": "warning",                  // sin venta en el período no hay con qué medir días/rotación
  "ritmo-por-sku-no-por-bodega": "info",       // comportamiento esperado cuando el stock viene por bodega y la venta no
  "inventario-sin-bodega": "info",             // comportamiento esperado sin columna bodega

  // ── camino negocio (serieDesdePlanilla.js) ────────────────────────────────────────────────────────────────
  "serie-no-reconcilia": "warning",            // la serie de una entidad no cierra contra su cifra oficial
  "serie-sin-cifra-del-periodo": "info",       // no hay con qué reconciliar — limitación, no contradicción
  "nombre-en-dos-ejes": "warning",             // colisión de nombre entre dos ejes — riesgo real de confundir datos

  // ── camino heterogéneo (ingestarLibro.js) ─────────────────────────────────────────────────────────────────
  "hoja-sin-eje": "warning",                   // una hoja del archivo no se pudo clasificar: información real perdida
  "ambiguedad-resuelta-por-no-material": "info",   // corte 0b: se resolvió sola, sin pérdida material — informativo

  // ── camino heterogéneo (normalizar.js) ────────────────────────────────────────────────────────────────────
  "fila-sin-clave": "warning",                 // una fila se descartó por no tener su clave — dato real perdido
  "celdas-vacias": "info",                     // limitación declarada, celda por celda
};

/** severidadAviso(tipo) → "warning" | "info". Lanza si `tipo` no está en la tabla — un aviso nuevo NECESITA que
 *  alguien lo clasifique acá; no puede quedar como "info" por defecto y en silencio. */
export function severidadAviso(tipo) {
  const s = SEVERIDAD_AVISO[tipo];
  if (!s) throw new Error(`avisoSeveridad: el tipo de aviso "${tipo}" no está declarado en SEVERIDAD_AVISO — clasifícalo (warning/info) antes de usarlo`);
  return s;
}
