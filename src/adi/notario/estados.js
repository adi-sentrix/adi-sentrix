/* estados.js · LOS ESTADOS DE LA CASA — cada estado dicho en palabras tiene UNA definición empresarial verificable ═══════════════════════
 *
 * Decisión del owner (2026-09-17, ronda adversarial 3): «ADI sí puede hablar en estados naturales, pero cada estado debe tener una definición
 * empresarial verificable. Si el dato no permite demostrarlo, no puede afirmarlo como hecho». Antes, «al día», «sin mora», «paga puntual»,
 * «vigente», «rota bien», «en quiebre» no eran puntos de afirmación (una cláusula sin número no entraba a juicio) y una falsedad dicha así se
 * servía en verde — incluso sobreviviendo a la poda.
 *
 * Una sola fuente: presencia (los puntos de la prosa), el juez (la consistencia prosa↔declaración), el verificador (el veredicto contra la
 * proyección) y el resolutor (la forma canónica) leen de acá. Cada estado trae:
 *   canon       · el nombre canónico (normalizado, sin tildes)
 *   eje         · a quién se le puede decir (sku · cliente)
 *   re          · cómo se reconoce cuando se DECLARA o se nombra (sinónimos de la casa)
 *   prosa       · cómo se reconoce como PUNTO en la prosa (más conservador: no debe cazar figuras retóricas)
 *   definicion  · la definición empresarial, en palabras
 *   complemento · el estado que dice lo contrario (para «no está al día» = «en mora»)
 *   verificar   · (I, ent) → { ok, verdad, evidencia } o null si la evidencia no lo demuestra (→ no verificable, nunca verdadero)
 *
 * Los estados de la Mesa Capital (frenado · sobrestock · inmovilizado · riesgo de quiebre · capital sano · crítico) siguen viniendo de la
 * proyección SKU por SKU (`I.estadosDe`): acá solo se nombran; el verificador de estados de inventario vive en verificar.js. */
import { normalizar } from "./afirmacion.js";

/* el valor de una entidad en un ranking de la proyección (número) — o null si la proyección no la trae */
const _deRanking = (I, eje, clave, entidad) => {
  const R = I && I.rankings && I.rankings[eje] && I.rankings[eje][clave];
  if (!R || !Array.isArray(R.filas)) return null;
  const k = normalizar(entidad);
  const fila = R.filas.find((x) => normalizar(x.entidad) === k);
  return fila && Number.isFinite(+fila.valor) ? +fila.valor : null;
};
const _kpi = (I, re) => { const f = (I && I.figs || []).find((g) => !g.entidad && re.test(g.conceptoNorm) && Number.isFinite(g.raw)); return f ? f.raw : null; };
const _figDe = (I, entidad, re) => { const k = normalizar(entidad); const f = (I && I.figs || []).find((g) => g.entidad && normalizar(g.entidad) === k && re.test(g.conceptoNorm) && Number.isFinite(g.raw)); return f ? f.raw : null; };
const _fmtM = (v) => (Math.abs(v) >= 1000 ? `$${(v / 1000).toFixed(1)}M` : `$${Math.round(v)}K`);
/* el eje de una entidad (para leer su ranking cuando la boleta no trae la fig) */
const _ejeDe = (I, ent) => { try { const r = I && typeof I.resolverEntidad === "function" ? I.resolverEntidad(ent) : null; return r && r.eje ? r.eje : "cliente"; } catch { return "cliente"; } };

export const ESTADOS_DE_LA_CASA = [
  /* ── inventario (SKU): los estados de la Mesa Capital, declarados por la proyección ── */
  /* «inmovilizado critico» VA ANTES que «inmovilizado» a propósito (owner 2026-09-28, §7.3·30-34, etapa 5,
   * decisión 0.1 del diseño de inventario): «el orden de la lista es el de prioridad» (ver `estadoCanon`, más
   * abajo) — el patrón MÁS ESPECÍFICO tiene que probarse primero, si no «inmovilizados críticos» matchea la
   * alternativa corta de «inmovilizado» (`/inmoviliz|.../`) y el canon nuevo nunca se reconoce. Es el tramo
   * `capital_frenado` de la Mesa Capital — rotación bajo el piso o días de inventario sobre el techo. Reemplaza
   * al canon que ANTES se llamaba «frenado» acá (esa palabra queda para venta interrumpida, abajo). Sigue siendo
   * un estado DECLARADO por la proyección (`I.estadosDe`, sin `verificar:` propio — mismo mecanismo que
   * «sobrestock»/«riesgo de quiebre»/«capital sano»): `datoProyectado.js` lo declara como
   * `estado: "inmovilizado critico"` SKU por SKU (antes `"frenado"`, renombrado en la migración). */
  { canon: "inmovilizado critico", eje: "sku", re: /inmoviliz[a-záéíóúñ]*\s+cr[ií]tic[oa]s?/, prosa: /inmoviliz[a-záéíóúñ]*\s+cr[ií]tic[oa]s?/, definicion: "el tramo crítico del inventario (capital_frenado): rotación bajo el piso o días de inventario sobre el techo — subconjunto de inmovilizado, verificable", fuente: "estados de la proyección" },
  { canon: "inmovilizado", eje: "sku", re: /inmoviliz|deten|parad|bloquead|estancad/, prosa: /inmoviliz[a-záéíóúñ]*(?!\s+cr[ií]tic)|detenid[oa]s?|parad[oa]s?|bloquead[oa]s?|estancad[oa]s?/, definicion: "SKU inmovilizado: en la Mesa Capital, inmovilizado crítico o en sobrestock (jerarquiaInventario)", fuente: "estados de la proyección" },
  /* «frenado» (MIGRACIÓN DE SIGNIFICADO, owner 2026-09-28, §7.3·30-34, etapa 5, diseño §0.3/§4.3): antes sinónimo
   * de `capital_frenado` (rotación) — ahora VENTA INTERRUMPIDA: días sin venta ≥ el umbral declarado (empresa o
   * planteado en la consulta, `criterio.referencia{umbral_frenado}`). SIN umbral publicado, la afirmación no es
   * verificable — nunca verdadera ni falsa por un umbral inventado (CLAUDE.md §2, «nada hardcodeado»; owner:
   * «nunca 60 días como verdad de ADI»). El umbral se publica como KPI «Umbral de venta frenada» (datoProyectado.js,
   * SOLO si `J.frenado.evaluado`) y los días sin venta ya vienen en `I.dias[ent].sinVenta` (estado «sin venta», arriba). */
  { canon: "frenado", eje: "sku", re: /frenad/, prosa: /frenad[oa]s?/, definicion: "SKU con la venta interrumpida: días sin venta sobre el umbral declarado (empresa o consulta) — sin umbral declarado, no verificable", fuente: "días de la proyección y el umbral declarado",
    verificar: (I, ent) => {
      const d = I && I.dias && I.dias[ent];
      /* BUG REAL (encontrado 2026-09-29, cerrando la etapa 5 — no es la clase A del contrato, es un typo de
       * mayúscula): `_kpi` busca contra `g.conceptoNorm`, que SIEMPRE es la etiqueta NORMALIZADA (minúsculas —
       * ver el resto de este archivo: `/^piso de rotacion$/`, `/^unidades en stock$|.../`, todas en minúscula).
       * Este regex tenía la «U» en mayúscula («Umbral de venta frenada»): nunca calzaba con «umbral de venta
       * frenada» y `_kpi` siempre devolvía null — «frenado» salía "no-verificable" SIEMPRE, incluso con la
       * empresa declarando el umbral en su perfil (verificado: `I.figs` SÍ trae la fig «Umbral de venta
       * frenada» con `conceptoNorm:"umbral de venta frenada"` cuando `frenadoDiasSinVenta` está en el perfil —
       * el hueco era puramente el `case` del patrón, no el dato ni el mecanismo de publicación). */
      const umbral = _kpi(I, /^umbral de venta frenada$/);
      if (!d || !Number.isFinite(d.sinVenta) || !Number.isFinite(umbral)) return null;
      /* ETAPA 6 (2026-09-29): «sobre el umbral» = ESTRICTO (`>`), la MISMA frontera que `jerarquiaInventario`
       * (`diasSinVenta > umbral`), el glosario («superan el umbral») y la Entrega («más de N días»). Antes este
       * verificador usaba `>=`: un SKU con exactamente N días salía «frenado» para el Notario y «con venta» para
       * la pantalla — dos verdades para el mismo SKU. El umbral puede venir de la empresa o de la consulta
       * (`I.figs` lo publica con su origen, `datoProyectado.js`). */
      return { ok: d.sinVenta > umbral, verdad: `${ent}: ${d.sinVenta} días sin venta · Umbral de venta frenada = ${umbral} días`, evidencia: ["días de la proyección", "Umbral de venta frenada"] };
    } },
  { canon: "sobrestock", eje: "sku", re: /sobrestock|sobre\s*stock|exceso\s+de\s+stock|sobreinventari/, prosa: /sobrestock|sobre\s+stock|sobreinventariad[oa]s?|exceso\s+de\s+stock/, definicion: "SKU en sobrestock según la Mesa Capital", fuente: "estados de la proyección" },
  { canon: "riesgo de quiebre", eje: "sku", re: /riesgo\s+de\s+quiebre|(?:al\s+borde|cerca|a\s+punto)\s+(?:del?\s+)?(?:quiebre|quebrar)|pr[oó]xim[oa]s?\s+a\s+(?:quebrar|quiebre|agotarse)|por\s+quebrar|se\s+(?:le\s+)?(?:acaba|agota)|quiebre\s+pr[oó]ximo/, prosa: /riesgo\s+de\s+quiebre|al\s+borde\s+del\s+quiebre|a\s+punto\s+de\s+quebrar|pr[oó]xim[oa]s?\s+a\s+(?:quebrar|agotarse)|quiebre\s+pr[oó]ximo/, definicion: "SKU en riesgo de quiebre según la Mesa Capital (cobertura bajo el mínimo)", fuente: "estados de la proyección" },
  { canon: "en quiebre", eje: "sku", re: /\ben\s+quiebre\b(?!\s+pr[oó]xim)|\bquebrad[oa]s?\b|desabastecid[oa]s?|sin\s+stock\b|stock\s+(?:en\s+)?(?:cero|0)\b|agotad[oa]s?\b/, prosa: /en\s+quiebre(?!\s+pr[oó]xim)|quebrad[oa]s?|desabastecid[oa]s?|sin\s+stock|agotad[oa]s?/, definicion: "quiebre consumado: unidades en stock = 0 — no es «riesgo de quiebre» (un estado de la Mesa Capital con stock todavía)", fuente: "unidades en stock",
    verificar: (I, ent) => { const u = _figDe(I, ent, /^unidades en stock$|^stock \(unidades\)$|^unidades$/); if (u == null) return null; return { ok: u === 0, verdad: `${ent} · Unidades en stock = ${u}`, evidencia: [`${ent} · Unidades en stock`] }; } },
  { canon: "capital sano", eje: "sku", re: /\bsan[oa]s?\b|saludable|en\s+regla|sin\s+alerta/, prosa: /capital\s+sano|(?:viene|vienen|est[aá]n?|sigue|siguen|queda|quedan)\s+san[oa]s?/, definicion: "SKU sin alerta de la Mesa Capital", fuente: "estados de la proyección" },
  /* «critico» a secas SOLO es la alerta del archivo (decisión 0.1 del diseño de inventario, sin cambio) — nunca
   * el tramo `capital_frenado`, que ahora se dice «inmovilizado crítico» (canon propio, arriba). El punto de
   * prosa de ESTE canon excluye «crítico» pegado a «inmovilizado» con un lookbehind (owner 2026-09-28, §7.3·30-34,
   * etapa 5): sin la exclusión, cada mención de «inmovilizado crítico» dispara TAMBIÉN un punto «critico» bare
   * sin declarar — la palabra es una subcadena literal de la otra. */
  { canon: "critico", eje: "sku", re: /cr[ií]tic/, prosa: /(?<!inmoviliz[a-záéíóúñ]*\s)cr[ií]tic[oa]s?(?!\s+(?:para|que|si|en\s+(?:el|la)\s+(?:lectura|decisi))\b)/, definicion: "alerta crítica del dato (la proyección la declara SKU por SKU)", fuente: "estados de la proyección" },
  { canon: "sin venta", eje: "sku", re: /sin\s+venta|sin\s+movimiento|no\s+(?:se\s+)?vende|sin\s+salida|no\s+rota\b/, prosa: /sin\s+venta|sin\s+movimiento|sin\s+salida/, definicion: "días sin venta > 0 en la proyección", fuente: "días de la proyección",
    verificar: (I, ent) => { const d = I && I.dias && I.dias[ent]; if (!d || !Number.isFinite(d.sinVenta)) return null; return { ok: d.sinVenta > 0, verdad: `${ent}: ${d.sinVenta} días sin venta`, evidencia: ["días de la proyección"] }; } },
  // RAÍZ A4 (supervisor 2026-09-27, diagnóstico v9) — el piso se imprime con UN decimal (`.toFixed(1)`, «2.0x»),
  // el mismo formato que `notario/hechos.js:formatoDeLaCasa("ratio")` ya usa para cualquier otra cifra de la
  // casa («el valor es el comprobante a la precisión de lo impreso», ronda adversarial 2) — antes imprimía el
  // número crudo («2x» cuando el piso es 2.0), una precisión DISTINTA de la que el resto de la Entrega declara
  // para la MISMA referencia (`referenciaDeEstado`/`valorDeReferencia`, componer.js/hechos.js), así que la MISMA
  // cifra aparecía escrita de dos formas en el mismo turno.
  { canon: "rota bien", eje: "sku", re: /rota\s+bien|buena\s+rotaci[oó]n|rotaci[oó]n\s+(?:sana|buena|alta)|rota\s+r[aá]pido/, prosa: /rota\s+bien|rota\s+r[aá]pido|buena\s+rotaci[oó]n/, definicion: "rotación ≥ piso de rotación de la POLICY", fuente: "rotación del SKU y piso de rotación", complemento: "rota lento",
    verificar: (I, ent) => { const r = _figDe(I, ent, /^rotacion$/) ?? _deRanking(I, "sku", "rotacion", ent); const piso = _kpi(I, /^piso de rotacion$/); if (r == null || piso == null) return null; return { ok: r >= piso, verdad: `${ent} · Rotación = ${r}x · Piso de rotación = ${piso.toFixed(1)}x`, evidencia: [`${ent} · Rotación`, "Piso de rotación"] }; } },
  { canon: "rota lento", eje: "sku", re: /rota\s+(?:lento|poco|mal|despacio)|(?:baja|mala|poca)\s+rotaci[oó]n|rotaci[oó]n\s+(?:baja|lenta|pobre)/, prosa: /rota\s+(?:lento|poco|mal|despacio)|(?:baja|mala|poca)\s+rotaci[oó]n/, definicion: "rotación < piso de rotación de la POLICY", fuente: "rotación del SKU y piso de rotación", complemento: "rota bien",
    verificar: (I, ent) => { const r = _figDe(I, ent, /^rotacion$/) ?? _deRanking(I, "sku", "rotacion", ent); const piso = _kpi(I, /^piso de rotacion$/); if (r == null || piso == null) return null; return { ok: r < piso, verdad: `${ent} · Rotación = ${r}x · Piso de rotación = ${piso.toFixed(1)}x`, evidencia: [`${ent} · Rotación`, "Piso de rotación"] }; } },
  /* ── cobranza (cliente): sobre los rankings de la proyección (saldo vencido, saldo pendiente, recuperado), que traen a TODOS los clientes ── */
  { canon: "al dia", eje: "cliente", re: /\bal\s+d[ií]a\b|sin\s+(?:mora|atrasos?|retrasos?|deuda\s+vencida|saldos?\s+vencidos?|vencid[oa]s?|nada\s+vencido)\b|\bvigente\b|regulariz|no\s+(?:tiene|registra|presenta|acumula|arrastra|mantiene)\s+(?:nada\s+vencido|mora|atrasos?|deuda\s+vencida|saldo\s+vencido|vencidos?|facturas\s+vencidas)|no\s+est[aá]\s+en\s+mora|nada\s+vencido|no\s+(?:le\s+|te\s+)?debe\s+nada\s+vencido|no\s+(?:est[aá]|se\s+encuentra)\s+atrasad/, prosa: /\bal\s+d[ií]a\b|sin\s+(?:mora|atrasos?|retrasos?|deuda\s+vencida|saldos?\s+vencidos?|vencid[oa]s?|nada\s+vencido)\b|(?:est[aá]n?|queda|sigue|se\s+mantiene|saldo)\s+vigente|regulariz[oó]|no\s+(?:tiene|registra|presenta|acumula|arrastra|mantiene)\s+(?:nada\s+vencido|mora|atrasos?|deuda\s+vencida|saldo\s+vencido|vencidos?|facturas\s+vencidas)|no\s+est[aá]\s+en\s+mora|nada\s+vencido|no\s+(?:est[aá]|se\s+encuentra)\s+atrasad[oa]/, definicion: "saldo vencido = 0 (no tiene facturas vencidas; puede tener saldo pendiente por vencer)", fuente: "ranking saldo_vencido", complemento: "en mora",
    verificar: (I, ent) => { const v = _deRanking(I, "cliente", "saldo_vencido", ent); if (v == null) return null; return { ok: v === 0, verdad: `${ent} · Saldo vencido = ${v === 0 ? "$0" : _fmtM(v)}`, evidencia: ["ranking saldo_vencido"] }; } },
  { canon: "en mora", eje: "cliente", re: /\ben\s+mora\b|\bmoros[oa]s?\b|\batrasad[oa]s?\b|con\s+(?:deuda\s+|saldo\s+)?vencid[oa]s?\b|con\s+(?:atrasos?|mora|retrasos?)\b|paga\s+(?:tarde|con\s+atraso|fuera\s+de\s+plazo)|incumple|tiene\s+(?:mora|atrasos?|deuda\s+vencida|saldo\s+vencido|facturas\s+vencidas)/, prosa: /\ben\s+mora\b|\bmoros[oa]s?\b|(?:est[aá]n?|sigue|siguen|queda|quedan|vienen?)\s+atrasad[oa]s?|con\s+(?:atrasos?|mora|retrasos?)\b|paga\s+(?:tarde|con\s+atraso|fuera\s+de\s+plazo)|incumple\s+(?:los\s+)?plazos/, definicion: "saldo vencido > 0", fuente: "ranking saldo_vencido", complemento: "al dia",
    verificar: (I, ent) => { const v = _deRanking(I, "cliente", "saldo_vencido", ent); if (v == null) return null; return { ok: v > 0, verdad: `${ent} · Saldo vencido = ${v === 0 ? "$0" : _fmtM(v)}`, evidencia: ["ranking saldo_vencido"] }; } },
  { canon: "sin deuda", eje: "cliente", re: /sin\s+deuda\b|sin\s+saldo\b|no\s+(?:te\s+|nos\s+|le\s+)?debe\s+nada\b|pag[oó]\s+todo|saldo\s+(?:en\s+)?cero|nada\s+pendiente|no\s+tiene\s+(?:saldo|deuda|nada)\s+pendiente|saldado|cancel[oó]\s+(?:todo|la\s+deuda|el\s+saldo)/, prosa: /sin\s+deuda\b|no\s+(?:te\s+|nos\s+|le\s+)?debe\s+nada\b|pag[oó]\s+todo|saldo\s+(?:en\s+)?cero|nada\s+pendiente|no\s+tiene\s+(?:saldo|deuda|nada)\s+pendiente|cancel[oó]\s+(?:todo|la\s+deuda|el\s+saldo)/, definicion: "saldo pendiente = 0", fuente: "ranking saldo_pendiente",
    verificar: (I, ent) => { const v = _deRanking(I, "cliente", "saldo_pendiente", ent); if (v == null) return null; return { ok: v === 0, verdad: `${ent} · Saldo pendiente = ${v === 0 ? "$0" : _fmtM(v)}`, evidencia: ["ranking saldo_pendiente"] }; } },
  /* ── los estados de PRODUCTO del cierre de raíz (owner 2026-09-17) ──
   * «buen pagador / paga bien / cumple los plazos / paga puntual» exige EVIDENCIA HISTÓRICA: no puede inferirse de la foto del corte. Existe
   * en el catálogo para que el Notario lo reconozca y lo deje SIN demostrar (nunca verdadero, nunca servido como hecho) mientras no haya historial. */
  { canon: "buen pagador", eje: "cliente", re: /buen(?:a|os|as)?\s+pagador(?:a|es|as)?|paga\s+(?:bien|puntual(?:mente)?|a\s+tiempo|en\s+(?:plazo|fecha)|como\s+un\s+reloj|religiosamente)|cumple\s+(?:con\s+)?(?:los\s+|sus\s+)?(?:plazos|pagos|compromisos)|al\s+corriente\b|impecable\s+en\s+(?:pagos?|cobranza)|historial\s+(?:de\s+pagos?\s+)?(?:impecable|limpio|sano)|se\s+porta\s+bien\s+con\s+los\s+pagos/, prosa: /buen(?:a|os|as)?\s+pagador(?:a|es|as)?|paga\s+(?:bien|puntual(?:mente)?|a\s+tiempo|en\s+(?:plazo|fecha)|como\s+un\s+reloj|religiosamente)|cumple\s+(?:con\s+)?(?:los\s+|sus\s+)?(?:plazos|pagos|compromisos)|al\s+corriente\b|impecable\s+en\s+(?:pagos?|cobranza)|se\s+porta\s+bien\s+con\s+los\s+pagos/, definicion: "historial de pago (exige serie histórica de pagos: no se demuestra con la foto del corte)", fuente: "historial de pagos (no disponible)", complemento: "mal pagador",
    verificar: () => null, historial: true },
  { canon: "mal pagador", eje: "cliente", re: /mal(?:a|os|as)?\s+pagador(?:a|es|as)?|paga\s+(?:mal|siempre\s+tarde)|historial\s+(?:de\s+pagos?\s+)?(?:malo|sucio|manchado)|moros[oa]\s+cr[oó]nic/, prosa: /mal(?:a|os|as)?\s+pagador(?:a|es|as)?|paga\s+(?:mal|siempre\s+tarde)|moros[oa]\s+cr[oó]nic/, definicion: "historial de pago (exige serie histórica de pagos: no se demuestra con la foto del corte)", fuente: "historial de pagos (no disponible)", complemento: "buen pagador",
    verificar: () => null, historial: true },
  /* «no deja contribución» y «no deja margen» son conceptos distintos con sus métricas respectivas (owner 2026-09-17) */
  { canon: "sin contribucion", eje: "cliente", re: /no\s+(?:deja|aporta|genera)\s+(?:nada\s+de\s+)?contribuci[oó]n|sin\s+contribuci[oó]n|contribuci[oó]n\s+(?:cero|nula|negativa)|no\s+contribuye/, prosa: /no\s+(?:deja|aporta|genera)\s+(?:nada\s+de\s+)?contribuci[oó]n|sin\s+contribuci[oó]n|contribuci[oó]n\s+(?:cero|nula|negativa)|no\s+contribuye/, definicion: "contribución ≤ 0", fuente: "contribución de la entidad",
    verificar: (I, ent) => { const c = _figDe(I, ent, /^contribucion$/) ?? _deRanking(I, _ejeDe(I, ent), "contribucion", ent); if (c == null) return null; return { ok: c <= 0, verdad: `${ent} · Contribución = ${_fmtM(c / 1000)}`, evidencia: [`${ent} · Contribución`] }; } },
  { canon: "sin margen", eje: "cliente", re: /no\s+(?:deja|tiene|da)\s+margen|sin\s+margen|margen\s+(?:cero|nulo|negativo)/, prosa: /no\s+(?:deja|tiene|da)\s+margen|sin\s+margen|margen\s+(?:cero|nulo|negativo)/, definicion: "margen ≤ 0", fuente: "margen de la entidad",
    verificar: (I, ent) => { const m = _figDe(I, ent, /^margen$/) ?? _deRanking(I, _ejeDe(I, ent), "margen", ent); if (m == null) return null; return { ok: m <= 0, verdad: `${ent} · Margen = ${m}%`, evidencia: [`${ent} · Margen`] }; } },
  { canon: "sin pagos", eje: "cliente", re: /no\s+ha\s+pagado\s+nada|no\s+pag[oó]\s+nada|sin\s+(?:pagos|abonos)\b|no\s+(?:ha\s+)?abonad|cero\s+abonos|no\s+(?:ha\s+)?recuperad[oa]\s+nada/, prosa: /no\s+ha\s+pagado\s+nada|no\s+pag[oó]\s+nada|sin\s+(?:pagos|abonos)\b|no\s+(?:ha\s+)?abonad[oa]\s+nada|cero\s+abonos/, definicion: "abonado = 0 (recuperado 0 %)", fuente: "ranking recuperado",
    verificar: (I, ent) => { const v = _deRanking(I, "cliente", "recuperado", ent); if (v == null) return null; return { ok: v === 0, verdad: `${ent} · Recuperado = ${v}%`, evidencia: ["ranking recuperado"] }; } },
];

/* las formas de la ronda 5 (datos): se suman a `re` y a `prosa` del estado; el complemento de «frenado» son los estados sanos */
const _FORMAS_EXTRA = {
  "buen pagador": ["historial\\s+(?:impecable|limpio|sano)", "(?:es|son)\\s+de\\s+fiar", "confiables?\\s+(?:en|para)\\s+(?:el\\s+)?pago", "de\\s+confianza\\s+(?:en|para)\\s+(?:el\\s+)?pago", "paga\\s+dentro\\s+de(?:l)?\\s+plazo", "(?:nunca|sin|jam[aá]s)\\s+(?:[a-záéíóúñ]+\\s+){0,3}problemas\\s+de\\s+(?:cobranza|pago)", "impecable\\s+en\\s+pagos?"],
  "sin deuda": ["a\\s+paz\\s+y\\s+salvo", "cancel[oó]\\s+toda\\s+su\\s+deuda", "(?:dej[oó]|qued[oó])\\s+(?:en|a)\\s+cero", "saldo\\s+en\\s+cero"],
  "al dia": ["tiene\\s+todo\\s+vigente", "ni\\s+una\\s+factura\\s+vencida", "no\\s+tienen\\s+nada\\s+vencido", "sin\\s+nada\\s+vencido"],
  "sin pagos": ["ni\\s+un\\s+(?:peso|centavo)", "no\\s+ha\\s+entrado\\s+nada"],
  "sin venta": ["no\\s+se\\s+mueve", "sin\\s+moverse"],
};
for (const e of ESTADOS_DE_LA_CASA) {
  const extra = _FORMAS_EXTRA[e.canon]; if (!extra) continue;
  e.re = new RegExp(e.re.source + "|" + extra.join("|"), e.re.flags);
  e.prosa = new RegExp(e.prosa.source + "|" + extra.join("|"), e.prosa.flags);
}
/* «frenado» no lleva complemento en el catálogo: el juez v2 (presencia) leería «no está frenado» como un punto de «capital sano» sin declarar; el libro v3 usa COMPLEMENTO_V3.
 * MIGRACIÓN (owner 2026-09-28, §7.3·30-34, etapa 5): «inmovilizado critico» hereda el complemento que «frenado»
 * tenía antes («capital sano», la Mesa Capital). «frenado» (venta interrumpida) YA NO tiene complemento acá — no
 * hay un único estado canónico contrario dentro del catálogo (no está vendiendo ≠ ningún estado de Mesa Capital);
 * sin entrada, `_verdadDeLoFalso` (hechos.js:769) simplemente no ofrece un hecho sintético adicional para la
 * negación, que sigue siendo correcta por el veredicto directo de `verificar()` (estados.js, arriba). */
export const COMPLEMENTO_V3 = { "inmovilizado critico": "capital sano" };
for (const e of ESTADOS_DE_LA_CASA) if (e.canon === "sin contribucion" || e.canon === "sin margen") e.ejes = ["cliente", "sku", "marca", "familia", "canal"];   // se demuestran con la métrica, en cualquier eje que la tenga
/** ejeCompatible(def, eje) → el estado vale en ese eje */
export const ejeCompatible = (def, eje) => !def || !eje || (Array.isArray(def.ejes) ? def.ejes.includes(eje) : !def.eje || def.eje === eje);
/** estadoDeclarado(s) → el canon de un estado escrito por su nombre exacto o por una forma del catálogo que lo nombra ENTERA (sin negación); null si no */
export function estadoDeclarado(s) {
  const t = normalizar(String(s || "").replace(/_/g, " ")).trim();
  if (!t) return null;
  if (ESTADOS_CANON.has(t)) return t;
  if (/(?:^|\s)(?:no|ni|nunca|jamas|tampoco)(?:\s|$)/.test(t)) return null;
  for (const e of ESTADOS_DE_LA_CASA) { const rx = new RegExp("^(?:" + e.re.source + ")$", "i"); if (rx.test(t)) return e.canon; }
  return null;
}
export const ESTADOS_CANON = new Set(ESTADOS_DE_LA_CASA.map((e) => e.canon));
const _porCanon = new Map(ESTADOS_DE_LA_CASA.map((e) => [e.canon, e]));
export const estadoDeLaCasa = (canon) => _porCanon.get(canon) || null;
/* §7.3·28 (SUPERVISOR, ley de registro del owner) — cuando un estado no se reconoce, la declinación ofrece
 * alternativas EN VEZ de citar la palabra que lo disparó (si esa palabra está vetada del registro, ver
 * hechos.js). `estadosValidosPara(eje)` es la ÚNICA fuente de "qué estados existen para este eje" — la misma
 * tabla que ya usan `estadoDeclarado`/`ejeCompatible`, nunca una lista escrita a mano; sin `eje` (contexto no
 * resuelto todavía) devuelve el catálogo entero, nunca una lista vacía. */
export const estadosValidosPara = (eje) => ESTADOS_DE_LA_CASA.filter((e) => ejeCompatible(e, eje)).map((e) => e.canon);

/** estadoCanon(texto) → el nombre canónico del estado que el texto nombra (o el texto normalizado si no es un estado de la casa) */
export function estadoCanon(t) {
  const s = normalizar(t);
  /* «riesgo de quiebre» antes que «en quiebre» (contiene «quiebre»); el orden de la lista es el de prioridad */
  for (const e of ESTADOS_DE_LA_CASA) if (e.re.test(s)) return e.canon;
  return s;
}
/** ESTADOS: la tabla [re, canon] que la casa exponía antes (compatibilidad) */
export const ESTADOS = ESTADOS_DE_LA_CASA.map((e) => [e.re, e.canon]);

/** compatibles(dicho, otro) → el estado dicho no contradice al otro: iguales, o «inmovilizado» con inmovilizado
 *  crítico/sobrestock (MIGRACIÓN owner 2026-09-28, §7.3·30-34: antes «frenado», ahora «inmovilizado critico») */
export const estadosCompatibles = (dicho, otro) => dicho === otro || (dicho === "inmovilizado" && (otro === "inmovilizado critico" || otro === "sobrestock")) || (otro === "inmovilizado" && (dicho === "inmovilizado critico" || dicho === "sobrestock"));
/** complementoDe(canon) → el estado contrario («al día» ↔ «en mora»), o null */
export const complementoDe = (canon) => { const e = _porCanon.get(canon); return e && e.complemento ? e.complemento : null; };
/** la expresión regular de los PUNTOS de estado en la prosa (todas las formas de todos los estados), sin flags */
export const ESTADO_PROSA_SRC = ESTADOS_DE_LA_CASA.map((e) => e.prosa.source).join("|");
/** la expresión regular con la que se reconocen los estados NOMBRADOS en un texto (fragmentos, predicados, métricas) */
export const ESTADO_NOMBRADO_SRC = ESTADOS_DE_LA_CASA.map((e) => e.re.source).join("|");
/** estadosEn(texto) → los estados canónicos que un texto nombra, en orden de aparición */
export function estadosEn(texto) {
  const s = normalizar(texto);
  const out = [];
  const rx = new RegExp(ESTADO_NOMBRADO_SRC, "g");
  let m; while ((m = rx.exec(s))) { const c = estadoCanon(m[0]); if (ESTADOS_CANON.has(c) && !out.includes(c)) out.push(c); }
  return out;
}
/** verificarEstadoDeLaCasa(canon, I, entidad) → { ok, verdad, evidencia } · null si la definición no se puede demostrar con esta evidencia ·
 *  undefined si el estado no tiene definición propia (los de la Mesa Capital se juzgan por la proyección) */
export function verificarEstadoDeLaCasa(canon, I, entidad) {
  const e = _porCanon.get(canon);
  if (!e || typeof e.verificar !== "function") return undefined;
  return e.verificar(I, entidad);
}
/** definicionesDeEstados() → [{canon, eje, definicion, fuente}] para la carta y los gates */
export const definicionesDeEstados = () => ESTADOS_DE_LA_CASA.map((e) => ({ canon: e.canon, eje: e.eje, definicion: e.definicion, fuente: e.fuente, complemento: e.complemento || null }));
