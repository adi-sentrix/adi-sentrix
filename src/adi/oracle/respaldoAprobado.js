/* === src/adi/oracle/respaldoAprobado.js · EL PELDAÑO COMPARTIDO DEL RESPALDO (paso 0 de la Poda) =============
 *
 * POR QUÉ ES UN MÓDULO PROPIO (owner 2026-09-03, «avanza con todo» — paso 0 de `_PODA_NATURAL_PLAN.md`):
 * este peldaño nació dentro de `caminoNatural.js` y lo comparten DOS caminos — la escalera del suplente del
 * natural y la escalera invertida del AGENTE (`bucleAgente.js`). El natural tiene fecha de retiro (La Poda);
 * el peldaño NO: es conducta certificada del agente. Extraerlo acá deja al agente sin ninguna dependencia del
 * módulo que se va a retirar — la pre-condición medida del plan. La extracción es VERBATIM: cero cambio de
 * conducta, los mismos gates lo prueban en sus dos modos (con y sin `cederSiRepetida`).
 *
 * Historia completa del peldaño en los comentarios de abajo (son parte de la pieza y viajan con ella). */

/* ── EL ESCALÓN QUE FALTABA EN LA ESCALERA DEL SUPLENTE (owner 2026-08-21) ────────────────────────────────────
 * EL DEFECTO, visto por el owner en producción: pidió «hazme un resumen ejecutivo de las dos cosas que te he
 * preguntado» después de DOS respuestas buenas, y el turno cayó al suplente — que le devolvió los KPIs
 * generales del negocio. O sea: arriba, en la misma conversación, había dos lecturas ya aprobadas por el
 * notario, y el respaldo las tiró a la basura para empezar de cero desde la carpeta.
 * EL ESCALÓN: antes de caer al genérico, ofrecer lo que ESTA conversación ya validó. Y se ofrece VERBATIM, no
 * reescrito: un texto que el muro ya aprobó vuelve a pasar por construcción, mientras que resumirlo sería
 * volver a intentar exactamente lo que acaba de fallar. Se juzga igual que cualquier otro peldaño — si el texto
 * viejo no pasa el muro de hoy (una regla nueva puede alcanzarlo), cae al peldaño siguiente sin ruido.
 * NO ES UN CONTRATO NUEVO: es la MISMA escalera de `suplenteDignoDelDato`, con un peldaño más arriba. */
/* EXPORTADO desde F2 (2026-08-30): la escalera invertida del AGENTE reusa ESTE peldaño tal cual — reescribirlo
 * allá sería la «variante paralela que después diverge». Aditivo: nadie de este módulo cambia. */
/* R3 · los temas que definen «de qué habla» una pregunta (con y sin tilde: el usuario tipea como tipea). */
const _TEMAS_RESPALDO = ["margen", "venta", "ventas", "contribución", "contribucion", "carga", "capital",
  "inventario", "rotación", "rotacion", "acciones", "riesgo", "riesgos", "resumen", "directorio",
  "proyección", "proyeccion", "presupuesto", "benchmark", "unidades", "simulación", "simulacion", "brecha", "costo"];
export function _respaldoDeLoYaAprobado(memIn, juzgar, contexto = {}) {
  /* SOLO lo que el notario APROBÓ y no fue respaldo (ver `ultimaAprobada`, en caminoNatural). Leer
   * `recentNarrations` era el defecto: ahí también vive el respaldo del turno anterior, y ofrecerlo como
   * «quedó verificado» es afirmar algo falso sobre un texto que justamente no pudo verificarse. */
  const previa = typeof (memIn && memIn.ultimaAprobada) === "string" && memIn.ultimaAprobada.trim().length > 40
    ? memIn.ultimaAprobada : null;
  if (!previa) return null;

  /* R3 DEL EXAMEN 1 DEL AGENTE (2026-08-31): PERTINENCIA ANTES DE AFIRMAR «sobre esto». Medido en el examen:
   * este peldaño sirvió la respuesta de TOTTUS a una pregunta por FALABELLA enmarcada como «lo que ya te
   * respondí sobre esto quedó verificado» (T13 — afirmación falsa con entidad equivocada), el replay de un
   * clarify como si fuera el resumen pedido (T24), y la misma pantalla dos veces seguidas (T26). El marco solo
   * afirma pertinencia si la tiene; si no, dice la verdad. El contexto LO PASA EL CALLER — este peldaño sigue
   * sin leer memorias nuevas (la lección del Examen 5: jamás OFRECE recentNarrations; `recienMostrado` llega
   * de afuera y solo se COMPARA, nunca se sirve). Sin contexto (callers viejos), todo queda como antes. */
  const pregunta = String(contexto.pregunta || "");
  const entidades = Array.isArray(contexto.entidades) ? contexto.entidades : [];
  const recienMostrado = typeof contexto.recienMostrado === "string" ? contexto.recienMostrado : null;
  const _re = (t) => new RegExp(`\\b${String(t).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");

  const _sellar = (candidato) => {
    if (typeof juzgar !== "function") return candidato;
    try { const v = juzgar(candidato); return v && v.ok ? candidato : null; } catch { return null; }
  };

  /* T26: la misma pantalla dos veces seguidas no informa — si lo aprobado ES lo que el usuario acaba de ver,
   * este peldaño no tiene nada nuevo que ofrecer.
   *
   * ⚠️ C1 DE LA CORRIDA 3 (2026-08-31), Y SU ALCANCE ACOTADO POR EL OWNER: la frase fija de abajo era el
   * defecto que él marcó como «disculpa vacía» y «molde único» — su condición es VERDADERA POR CONSTRUCCIÓN
   * después de cualquier turno aprobado (el caller escribe la misma pantalla en `ultimaAprobada` y en
   * `recentNarrations[0]`), así que una salvaguarda para un caso raro se volvió la respuesta por defecto:
   * cuatro preguntas de familias distintas (T17·T19·T24·T27) recibieron la MISMA cadena de 153 caracteres, y
   * una vez en el hilo el cerebro la copiaba (T20).
   *
   * PERO ESTE PELDAÑO LO COMPARTEN DOS CAMINOS, y el natural está VIVO en producción (`ADI_CAMINO_NATURAL` va
   * en el perfil `prod`; la bandera apagada es `ADI_AGENTE`, que es otra cosa). Medido antes de tocar: al ceder,
   * el turno del camino natural pasaba de esta frase de 153 chars al tablero de KPIs de `suplenteDignoDelDato`,
   * 1.174 chars. PALABRA DEL OWNER (2026-08-31, textual): «No quiero que una reparación diseñada y medida para
   * el agente cambie de rebote ADI_CAMINO_NATURAL en producción. La disculpa vacía del camino actual la podemos
   * corregir después con un fallback propio, ejecutivo y breve; no quiero reemplazarla automáticamente por un
   * tablero largo.» Así que CEDE SOLO QUIEN LO PIDE: el agente pasa `cederSiRepetida` y cae a su peldaño de
   * límite con alternativa; el camino natural no lo pasa y queda BYTE-IDÉNTICO a hoy, con su pendiente
   * declarado en el mapa (§11c del F1: fallback propio, ejecutivo y breve — NO el tablero). */
  if (recienMostrado && recienMostrado.trim() === previa.trim()) {
    if (contexto.cederSiRepetida) return null;
    return _sellar("No pude armar la lectura nueva que pediste. Lo que te respondí recién sigue verificado y en pie — dime qué parte profundizo o pídeme otro corte del dato.");
  }

  // T13/T24: ¿la pregunta nombra entidades o temas que la respuesta vieja NO trae?
  // Una entidad ajena mata la pertinencia sola (el caso grave); los temas se miden por mayoría.
  const entQ = entidades.filter((e) => _re(e).test(pregunta));
  const temasQ = _TEMAS_RESPALDO.filter((c) => _re(c).test(pregunta));
  let pertinente;
  if (entQ.length && !entQ.some((n) => _re(n).test(previa))) pertinente = false;
  else {
    const nombrados = [...entQ, ...temasQ];
    const enPrevia = nombrados.filter((n) => _re(n).test(previa)).length;
    pertinente = !nombrados.length || enPrevia >= Math.ceil(nombrados.length / 2);
  }

  if (!pertinente) {
    const temaPrevia = entidades.find((e) => _re(e).test(previa)) || null;
    return _sellar([
      temaPrevia
        ? `No pude armar la lectura que pediste con la calidad que corresponde. Lo último que dejamos verificado fue sobre ${temaPrevia}:`
        : "No pude armar la lectura que pediste con la calidad que corresponde. Lo último que dejamos verificado fue esto:",
      "",
      previa.trim(),
      "",
      "Pídeme de nuevo lo que buscabas y lo trabajo sobre el dato.",
    ].join("\n"));
  }

  const candidato = [
    "No pude armar la lectura nueva con la calidad que corresponde. Lo que ya te respondí sobre esto quedó verificado y sigue en pie:",
    "",
    previa.trim(),
    "",
    "Dime qué parte de esto necesitas y lo trabajo sobre esas mismas cifras.",
  ].join("\n");
  return _sellar(candidato);
}
