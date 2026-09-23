/* === src/adi/conocimiento/predicados.js · EL VOCABULARIO CERRADO DE PERTINENCIA (Business Knowledge v0.2 §1) ═══
 * `_ADI_BUSINESS_KNOWLEDGE_V0_PROPUESTA.md`, Parte B §1: «la pieza no trae umbrales: solo lee veredictos que el
 * Core ya emitió (estados, conjuntos, rankings, signos de variación, ausencias) y relaciones de orden entre dos
 * hechos». Este archivo declara la LISTA CERRADA de predicados atómicos que una pieza puede nombrar en su campo
 * `pertinencia`, y los evalúa contra la tabla de señales (`tablaSenales.js` — la proyección del libro de hechos
 * del turno, nunca contra prosa).
 *
 * CERO LITERALES NUMÉRICOS ACÁ (candado del validador, `validarPieza.js`): cada predicado lee un booleano, un
 * enum o `null` ("no se puede saber con este predicado") que la tabla YA decidió — el "alto"/"bajo" lo definió
 * el motor (`marginRead`/`diagnose`/POLICY), nunca esta capa. Si un predicado nuevo necesitara un umbral que el
 * motor no publica, es una decisión de MOTOR, no de esta capa (frenada — ver el informe de la tarea).
 *
 * `null` es un tercer valor legítimo, no un error: significa "este predicado no se puede evaluar hoy" — o
 * porque el motor no lo publica todavía (`cuenta.contraparte`, `cuenta.grupo` — Ficha sin integrar) o porque la
 * entidad no tiene el dato (un cliente sin fig de variación interanual). `evaluarPertinencia.js` trata `null`
 * como "no enciende" (conservador: nunca sirve algo que no pudo verificar que aplica).
 *
 * Puro. Sin red, sin I/O — lee solo la `tabla` que `tablaSenales.js` construyó antes. */

/** La lista cerrada, en la forma exacta del documento (Parte B §1). Cada entrada declara si el predicado se
 *  puede evaluar HOY contra este motor (`disponible`) — las que no, quedan documentadas para que agregar una
 *  pieza que las necesite sea una decisión consciente, no un olvido. */
export const PREDICADOS_CERRADOS = Object.freeze([
  { predicado: "cuenta.bajo_benchmark", sujeto: "cuenta", disponible: true, fuente: "descomposicionDeBrecha(scenario).filas[].bajoBenchmark (marginRead — brecha > 0 vs benchmark declarado)" },
  { predicado: "cuenta.carga_alta", sujeto: "cuenta", disponible: true, fuente: "conjunto \"carga comercial alta\" del detector (diagnose · datoProyectado.conjuntos)" },
  { predicado: "cuenta.carga_sobre_resto", sujeto: "cuenta", disponible: true, fuente: "derivado barato: carga % de la cuenta > promedio de carga % de las demás cuentas del mismo dato (relación mayor(a,b), sin umbral)" },
  { predicado: "cuenta.vencido_positivo", sujeto: "cuenta", disponible: true, fuente: "cobranza (mesaFlujo) — saldo vencido > 0" },
  { predicado: "cuenta.al_dia", sujeto: "cuenta", disponible: true, fuente: "cobranza (mesaFlujo) — saldo vencido = 0 (notario/estados.js: \"al día\")" },
  { predicado: "cuenta.variacion_venta_neg", sujeto: "cuenta", disponible: true, fuente: "fig \"· Variación\" de la boleta comercial si existe; si no hay fig, indisponible (sin_serie)" },
  { predicado: "cuenta.variacion_venta_pos", sujeto: "cuenta", disponible: true, fuente: "idem, signo contrario" },
  { predicado: "cuenta.en_respuesta", sujeto: "cuenta", disponible: true, fuente: "entidades nombradas por la conclusión del procedimiento de ESTA Entrega (top/segundo de la ruta), pasadas por el compositor" },
  { predicado: "cuenta.prioridad_primera", sujeto: "cuenta", disponible: true, fuente: "prioridadDe(figs).top / prioridadIntegrada(figs,dominios).integrada[0]" },
  { predicado: "cuenta.contraparte_cadena", sujeto: "cuenta", disponible: false, fuente: "Ficha — confirmación del usuario, no integrada todavía (plan §7)" },
  { predicado: "cuenta.contraparte_comercio", sujeto: "cuenta", disponible: false, fuente: "idem" },
  { predicado: "cuenta.grupo_declarado", sujeto: "cuenta", disponible: false, fuente: "Ficha + mapa IMP-05, no integrado todavía" },
  { predicado: "sku.frenado", sujeto: "sku", disponible: true, fuente: "inventoryStatus{focus:\"frenado\"} — Mesa Capital" },
  { predicado: "sku.top_seller", sujeto: "sku", disponible: true, fuente: "inventoryStatus{focus:\"top_sellers\"} — orden por Venta, el mismo cruce de crucePorSku.js" },
  { predicado: "sku.estado_critico", sujeto: "sku", disponible: true, fuente: "Mesa Capital (mesaCapital.js CAPITAL_ESTADOS) — estado \"critico\"" },
  { predicado: "periodo.abierto", sujeto: "periodo", disponible: true, fuente: "figureType.periodoDeFiguras — tipo distinto de \"cerrado\" (el mismo campo que ya declara el Marco de la Entrega)" },
  { predicado: "pregunta.tema_comercial", sujeto: "pregunta", disponible: true, fuente: "contratoDeDominios.js / partesDelEncargo.js — dominio \"comercial\"" },
  { predicado: "pregunta.tema_cobranza", sujeto: "pregunta", disponible: true, fuente: "idem — dominio \"cobranza\"" },
  { predicado: "pregunta.tema_inventario", sujeto: "pregunta", disponible: true, fuente: "idem — dominio \"inventario\"" },
  { predicado: "pregunta.tema_prioridad", sujeto: "pregunta", disponible: true, fuente: "criterioDeLaPregunta(pregunta) (prioridadIntegrada.js) no nulo, o partesDelEncargo con ≥2 dominios" },
  { predicado: "pregunta.metrica_margen", sujeto: "pregunta", disponible: true, fuente: "texto de la pregunta menciona margen/rentabilidad — mismo léxico que el contrato comercial" },
  { predicado: "pregunta.metrica_carga", sujeto: "pregunta", disponible: true, fuente: "texto de la pregunta menciona carga comercial/convenio/rappel" },
  { predicado: "pregunta.metrica_plazos", sujeto: "pregunta", disponible: true, fuente: "texto de la pregunta menciona plazo/días de pago" },
]);

const _POR_NOMBRE = new Map(PREDICADOS_CERRADOS.map((p) => [p.predicado, p]));

/** predicadoValido(nombre) → boolean — está en la lista cerrada (disponible o no; "no disponible" sigue siendo
 *  un predicado VÁLIDO del vocabulario, solo que hoy evalúa siempre a `null`). */
export function predicadoValido(nombre) {
  return _POR_NOMBRE.has(String(nombre || ""));
}

/** predicadoDisponible(nombre) → boolean|null — null si el nombre no está en la lista cerrada. */
export function predicadoDisponible(nombre) {
  const p = _POR_NOMBRE.get(String(nombre || ""));
  return p ? p.disponible : null;
}

/** evaluarPredicadoAtomico(predicado, entidad, tabla, ctx) → true | false | null
 *  `tabla` es la tabla de señales (`tablaSenales.js`). `ctx` trae `{ pregunta }` para los predicados de sujeto
 *  "pregunta" (que no dependen de una entidad). Nunca compara contra un número: cada rama LEE un campo booleano
 *  o enum que `tablaSenales.js` ya decidió. */
export function evaluarPredicadoAtomico(predicado, entidad, tabla, ctx = {}) {
  const p = _POR_NOMBRE.get(String(predicado || ""));
  if (!p) return null;                                  // fuera de la lista cerrada — el validador ya lo rechazó antes de llegar acá
  if (!p.disponible) return null;                        // declarado, no integrado (Ficha) — nunca se inventa

  if (p.sujeto === "pregunta") {
    const preg = (tabla && tabla.pregunta) || {};
    switch (predicado) {
      case "pregunta.tema_comercial": return preg.temas ? preg.temas.includes("comercial") : null;
      case "pregunta.tema_cobranza": return preg.temas ? preg.temas.includes("cobranza") : null;
      case "pregunta.tema_inventario": return preg.temas ? preg.temas.includes("inventario") : null;
      case "pregunta.tema_prioridad": return preg.temas ? preg.temas.includes("prioridad") : null;
      case "pregunta.metrica_margen": return preg.metricas ? preg.metricas.includes("margen") : null;
      case "pregunta.metrica_carga": return preg.metricas ? preg.metricas.includes("carga") : null;
      case "pregunta.metrica_plazos": return preg.metricas ? preg.metricas.includes("plazos") : null;
      default: return null;
    }
  }
  if (p.sujeto === "periodo") {
    const per = tabla && tabla.periodo;
    if (predicado === "periodo.abierto") return per ? per.abierto : null;
    return null;
  }
  if (p.sujeto === "cuenta") {
    const c = tabla && tabla.cuentas && entidad ? tabla.cuentas[entidad] : null;
    if (!c) return null;
    switch (predicado) {
      case "cuenta.bajo_benchmark": return c.bajoBenchmark;
      case "cuenta.carga_alta": return c.cargaAlta;
      case "cuenta.carga_sobre_resto": return c.cargaSobreResto;
      case "cuenta.vencido_positivo": return c.vencidoPositivo;
      case "cuenta.al_dia": return c.alDia;
      case "cuenta.variacion_venta_neg": return c.variacionVenta === "neg";
      case "cuenta.variacion_venta_pos": return c.variacionVenta === "pos";
      case "cuenta.en_respuesta": return c.enRespuesta;
      case "cuenta.prioridad_primera": return c.prioridadPrimera;
      default: return null;
    }
  }
  if (p.sujeto === "sku") {
    const s = tabla && tabla.skus && entidad ? tabla.skus[entidad] : null;
    if (!s) return null;
    switch (predicado) {
      case "sku.frenado": return s.frenado;
      case "sku.top_seller": return s.topSeller;
      case "sku.estado_critico": return s.estado === "critico";
      default: return null;
    }
  }
  return null;
}

/** ejeDelPredicado(nombre) → "cuenta" | "sku" | null — el eje de entidades que hay que recorrer para evaluar
 *  este predicado (los de sujeto "pregunta"/"periodo" no recorren entidades: se evalúan una sola vez). */
export function ejeDelPredicado(nombre) {
  const p = _POR_NOMBRE.get(String(nombre || ""));
  if (!p) return null;
  return p.sujeto === "cuenta" || p.sujeto === "sku" ? p.sujeto : null;
}
