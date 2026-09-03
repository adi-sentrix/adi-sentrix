/* === _humo_criterios.mjs · LOS VEREDICTOS DEL HUMO, COMO CONDUCTA (owner 2026-09-03) ========================
 *
 * EL DEFECTO QUE CIERRA — el caso 13 del patrón de la casa, esta vez EN EL MEDIDOR: la primera corrida viva
 * del humo marcó 2 FAIL sobre respuestas IMPECABLES. «cobranza» falló porque el cerebro no dijo la cadena
 * literal «Te deben:» (dijo «tienes $41.2M en saldo pendiente de cobro, con $12.6M vencido» — mejor);
 * «proyección» falló porque pedía la frase del composer y el cerebro declaró el supuesto con otras palabras.
 * Un semáforo que da rojo sobre respuestas buenas entrena a ignorarlo — el día del rojo real, nadie lo mira.
 *
 * LA REGLA: cada familia define su PASS como CONDUCTA VERIFICABLE (hay cifra de saldo Y el vencido está
 * resuelto — con monto o con su porqué), jamás como cadena de un composer. El texto del cerebro varía; la
 * conducta no debe. CALIBRADO contra el corpus real de los expedientes (fixtures/humo-calibracion-2026-09):
 * las 30+ respuestas certificadas de las corridas —con todos sus fraseos— dan PASS; las que fallaron de
 * verdad en su día (la pregunta de entidad, el menú de labels, el vacío del directorio) dan FAIL.
 *
 * MÓDULO PURO E IMPORTABLE a propósito (la lección de clasificarGates): el humo lo consume para correr y el
 * gate de calibración lo consume para vigilarlo — una sola fuente, o el medidor y su candado divergen. */

/* un monto de dinero, en CUALQUIER forma real del corpus: «$41.2M» · «$8.226.765» · «5.007.016» (la parcial
 * no declara símbolo) · «$76,4M» (coma decimal). Un año suelto («2026») NO cuenta. */
const _MONTO = /\$\s?[\d.,]+\s?[KMB]?\b|\b\d{1,3}(?:\.\d{3})+(?:,\d+)?\b|\b[\d]+,\d\s?[KMB]\b/;
export const hayMonto = (t) => _MONTO.test(String(t).replace(/\b20\d{2}\b/g, ""));   // los años, tapados
export const cuentaMontos = (t) => (String(t).replace(/\b20\d{2}\b/g, "").match(new RegExp(_MONTO.source, "g")) || []).length;

/* lo que NINGUNA familia acepta: los defectos que la certificación mató, en su fraseo medido */
const _PROHIBIDO_COMUN = [
  [/No tengo información autorizada suficiente/i, "la disculpa genérica"],
  [/dime cu[aá]l abro/i, "el menú de labels internos"],
  [/sigue verificado y en pie/i, "la frase de molde"],
];
const _prohibidoComun = (t) => { for (const [re, que] of _PROHIBIDO_COMUN) if (re.test(t)) return que; return null; };

const _MES = /\b(?:enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|setiembre|octubre|noviembre|diciembre)\b/i;

/* ── LA BRECHA DEL NEGOCIO TIENE QUE CERRAR (owner 2026-09-03 · el defecto vivo del 8,6) ─────────────────────
 * Producción abrió con «tu margen está 8,6 puntos por debajo del benchmark — el 25,1% promedio contra el
 * 30,1%…» y 30,1 − 25,1 = 5,0: el 8,6 era la brecha de LIDER vestida de negocio, con la card de la Mesa
 * diciendo 5,0 al lado. El humo de ese día dio PASS porque su criterio era ciego a la aritmética.
 *
 * LA CONDUCTA: una brecha en pp atribuida AL NEGOCIO (señal de negocio en la MISMA oración, el punto decimal
 * no corta) debe venir con sus dos términos en el texto Y cerrar: benchmark − promedio = brecha (±0,15 de
 * redondeo). Los términos se anclan por LÉXICO (un % pegado a «promedio/cartera» · un % pegado a
 * «benchmark/referencia/vara» o «bajo el X%») y se prueban TODOS los pares en la dirección vara−promedio —
 * jamás «cualquier par de porcentajes del texto»: la tabla por cliente trae pares que cierran con la cifra
 * equivocada (30,1 − 21,5 = 8,6 — exactamente el defecto). Una brecha declarada SIN sus dos términos también
 * es FAIL: una cifra derivada sin sus insumos no es verificable, y la conducta certificada los publica siempre. */
const _BRECHA_NEG = /(\d+(?:[.,]\d+)?)\s*(?:pp\b|puntos?(?:\s+porcentuales)?)\s*(?:por\s+debajo|bajo|abajo)/i;
const _SENAL_NEG = /tu margen|margen (?:promedio|de la cartera|general)|la cartera|el negocio|\bpromedio\b/i;
const _f = (x) => parseFloat(String(x).replace(",", "."));
const _pctsCerca = (s, termino) => {
  const out = [];
  for (const re of [
    new RegExp(`(\\d+(?:[.,]\\d+)?)\\s*%[^%\\n]{0,40}?(?:${termino})`, "gi"),
    new RegExp(`(?:${termino})[^%\\n]{0,40}?(\\d+(?:[.,]\\d+)?)\\s*%`, "gi"),
  ]) for (let m; (m = re.exec(s)); ) out.push(_f(m[1]));
  return out;
};
export const brechaDelNegocioSinCierre = (t) => {
  const s = String(t);
  for (const oracion of s.split(/[!?\n]+|\.(?!\d)/)) {
    const m = _BRECHA_NEG.exec(oracion);
    if (!m || !_SENAL_NEG.test(oracion)) continue;
    const x = _f(m[1]);
    const proms = _pctsCerca(s, "promedio|cartera|ponderad");
    const varas = [..._pctsCerca(s, "benchmark|referencia|\\bvara\\b|\\bpiso\\b|declar"),
      ..._pctsCerca(s, "(?:por debajo|bajo) (?:del?|el|la)")];
    if (!proms.length || !varas.length)
      return `brecha del negocio declarada (${m[1]} pp) sin sus dos términos (margen promedio y benchmark) en el texto`;
    const cierra = varas.some((v) => proms.some((p) => Math.abs((v - p) - x) <= 0.15));
    if (!cierra) return `la brecha del negocio no cierra: declara ${m[1]} pp pero benchmark − promedio no da eso (el 8,6 de un cliente vestido de negocio es este defecto)`;
  }
  return null;
};

export const FAMILIAS = [
  {
    familia: "insignia · serie por entidad",
    pregunta: ({ cliente }) => `muéstrame la venta de ${cliente} mes a mes`,
    /* CONDUCTA: al menos un mes nombrado con su monto cerca (la serie o el punto), O la declinación honesta
     * que nombra el límite o al pedido — jamás el silencio ni el tablero. */
    pasa: (t) => {
      const conMes = String(t).split(/\n/).some((l) => _MES.test(l) && hayMonto(l));
      const declina = /no est[aá] en el dato|no reconcilia|de muestra|[Nn]o encuentro «/.test(t);
      return conMes || declina;
    },
    prohibido: (t) => _prohibidoComun(t),
  },
  {
    familia: "cobranza",
    pregunta: () => "quién me debe y qué está vencido",
    /* CONDUCTA: hay cifra de saldo/deuda Y el vencido está RESUELTO — con su monto, o con el porqué de que no
     * se puede (sin plazo declarado) — O la declinación que nombra la hoja Abonos. El «Te deben:» del composer
     * es UNA forma; la conducta es la de arriba. */
    pasa: (t) => {
      const s = String(t);
      const saldo = /sald|pendiente|deb[eo]n?\b|por cobrar|cobro|cobranza/i.test(s) && hayMonto(s);
      const vencidoResuelto = /vencid/i.test(s) && (hayMonto(s) || /no se puede|sin plazo|no declar[oó] plazo/i.test(s));
      const sinHoja = /no trae la hoja[^\n]{0,20}Abonos/i.test(s);
      return (saldo && (vencidoResuelto || /no se puede|sin plazo/i.test(s))) || sinHoja;
    },
    prohibido: (t) => _prohibidoComun(t) || (/vencid[oa][^.\n]{0,30}\$\s?0\b/.test(t) ? "el vencido en $0 (la regla del owner)" : null),
  },
  {
    familia: "síntesis ejecutiva",
    pregunta: () => "dame los 3 riesgos para el directorio",
    /* CONDUCTA: habla de riesgos con AL MENOS DOS montos del negocio (una síntesis sin cifras es opinión con
     * numeración) — o declara honesto cuántos materiales sostiene el dato. */
    pasa: (t) => /riesgo/i.test(t) && cuentaMontos(t) >= 2,
    prohibido: (t) => _prohibidoComun(t),
  },
  {
    familia: "proyección declarada",
    pregunta: () => "Si crezco 3% los próximos 12 meses, ¿cuánto vendería?",
    /* CONDUCTA: hay cifra proyectada Y el resultado viene ENLAZADO a una hipótesis del usuario — el conjunto
     * de formas es CONCEPTUAL: la palabra de la familia (proyección/supuesto/escenario/estimación), el tiempo
     * CONDICIONAL (sería/venderías/tendrías — el condicional ES la marca de hipótesis), o el enlace explícito
     * al crecimiento declarado. Ninguna frase de composer. */
    pasa: (t) => {
      const s = String(t);
      const atribuye = /proyecci[oó]n|proyectad[oa]|supuesto|escenario|hip[oó]tesis|estimad[oa]|ser[ií]a[ns]?\b|vender[ií]as|tendr[ií]as|quedar[ií]as|con (?:un |el )?crecimiento (?:de|del)\s?\d/i.test(s);
      return hayMonto(s) && atribuye;
    },
    /* la pregunta de entidad es EL defecto P1 medido (corrida 4): pedirle al usuario que elija alcance en vez
     * de proyectar sobre el total — en cualquiera de sus fraseos reales */
    prohibido: (t) => _prohibidoComun(t)
      || (/¿[^?]{0,90}global o por cliente|necesito saber si (?:es )?sobre|para (?:simular|proyectar)[^.\n]{0,60}necesito/i.test(t)
        ? "la pregunta de entidad (el defecto P1: elegir alcance en vez de proyectar)" : null),
  },
  {
    familia: "límite honesto",
    pregunta: () => "compará Q1 vs Q2",
    /* CONDUCTA: nombra el corte pedido (trimestre/Q) Y declara que no está — con cualquiera de los fraseos
     * reales del corpus («no hay dato trimestral», «viene por año cerrado», «no está en la carpeta»). Puede
     * además ofrecer la alternativa; lo que no puede es fingir el corte ni rescatarse con el menú. */
    pasa: (t) => /trimestr|\bq1\b|\bq2\b/i.test(t)
      && /no (?:trae|tengo|hay|puedo|est[aá]|existe|viene desglosad)|sin (?:corte|dato)|por a[ñn]o cerrado|mes a mes|mensual/i.test(t),
    prohibido: (t) => _prohibidoComun(t),
  },
  {
    familia: "margen (el playbook fundador)",
    pregunta: () => "¿cómo viene mi margen?",
    /* CONDUCTA: habla del margen contra UNA VARA nombrada (benchmark/vara/referencia/plan/piso — o «por
     * debajo de») con al menos un porcentaje. «Benchmark de margen: 30.1%» es una forma; «bajo el plan en 15
     * clientes» y «8.6 puntos por debajo del benchmark» son la misma conducta. */
    pasa: (t) => /margen/i.test(t) && /%/.test(t)
      && /benchmark|\bvara\b|referencia|\bplan\b|\bpiso\b|por debajo|bajo el/i.test(t),
    /* el cierre aritmético de la brecha del negocio (arriba): el 8,6 de Lider vestido de negocio — que este
     * mismo criterio dejó pasar el 2026-09-03 — ahora es FAIL, y las respuestas viejas que lo traían TIENEN
     * que caer: eran defectuosas (palabra del owner). */
    prohibido: (t) => _prohibidoComun(t) || brechaDelNegocioSinCierre(t),
  },
];
