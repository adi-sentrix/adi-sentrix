/* === src/adi/agente/coberturaCorta.js · EL RESPALDO DE COBERTURA CORTA (owner 2026-09-24) ══════════════════════
 * `encargo_natural_diseno.md` §"Respaldo corto": «Peldaño nuevo de cobertura corta… Declara con `declarar.js`
 * como los demás. Dominio ausente: una línea con la ausencia y su alternativa (sin llamar caja a la cobranza).»
 *
 * VUELTA 3 (coordinador, 2026-09-24): tres defectos medidos contra las respuestas literales —
 *   A · SUSTITUCIÓN DE CONCEPTO: la línea de cada dominio respondía con «la señal líder» (materialidad), no con
 *       el CONCEPTO que el usuario nombró («ventas» recibía la brecha de margen). Ahora cada dominio resuelve su
 *       concepto contra el REGISTRO ÚNICO de métricas (`notario/lexico.js:CLAVES_DE_METRICA`, filtrado por
 *       dominio — nada de una lista de palabras propia): ventas → venta del período; margen/contribución →
 *       la señal de siempre (contribución no capturada + brecha al benchmark, que SÍ son «margen»); carga o
 *       descuentos → carga comercial (nunca llamada «margen» — ese fue el defecto medido: `compararAlternativas.js`
 *       nombra a la carga «el margen» en su propio prosa certificada, y reusarla aquí producía DOS cifras
 *       distintas para «margen» en la misma respuesta). Solo sin concepto nombrado se usa la señal líder.
 *   C · TESORERÍA: si no cabe en la brevedad, se OFRECE la exposición de crédito, no se promete y se calla.
 *
 * VUELTA 4 (coordinador, 2026-09-24): el cierre entre temas de la vuelta 3 comparaba las CUENTAS LÍDERES
 * («Lider pesa más que Falabella», «negocio pesa más que LG-DRYER8KG») en vez de los TEMAS — sin sentido cuando
 * compara el volumen de venta (que no es un problema) contra el capital frenado de un SKU. Cada dominio declara
 * en el REGISTRO su medida de DINERO EN JUEGO — el total del dominio, siempre la misma, sin importar qué
 * concepto nombró la línea (`config/contract/dominios.js:dineroEnJuego`, leída con `dineroEnJuegoDe`): comercial
 * → contribución no capturada (subtotal); inventario → capital frenado (total); cobranza → saldo vencido
 * (total). La LÍNEA de cada dominio muestra el concepto PEDIDO, con su total y quién encabeza («Margen: $4.9M
 * de contribución no capturada; encabeza Falabella con $1.6M.»); si el concepto no es dinero en juego
 * («ventas»), muestra ese concepto (la venta del período, con su variación si está en la boleta).
 *
 * VUELTA 5 (owner, vía coordinador, 2026-09-24): la vuelta 4 hizo el CIERRE comparando esas medidas de dinero en
 * juego entre dominios — y eso ES «un segundo criterio de prioridad por comparación directa de montos entre
 * dominios», textual del owner, que rechazó exactamente eso: «los montos pueden explicar la decisión, pero la
 * prioridad debe seguir perteneciendo al procedimiento existente». La regla nueva, que hereda entero
 * `prioridadIntegrada.js` (CLAUDE.md §2, «materialidad + severidad + urgencia, señal por señal en la clave
 * real») en vez de inventar un criterio propio:
 *   1. El veredicto entre TEMAS lo decide `prioridadIntegrada(figs, temas)` — nunca un total comparado a mano.
 *      Entre los temas pedidos que comparten clave «cliente» (comercial/cobranza), el TEMA que va primero es el
 *      dominio donde la entidad que encabeza la prioridad integrada tiene su MEJOR rango de materialidad (o el
 *      dominio del criterio EXPLÍCITO del usuario, si nombró uno de los temas pedidos — «prioriza cobranza»
 *      manda). La frase cita el criterio del procedimiento, con la señal de esa entidad EN ese dominio — nunca
 *      «por tamaño». Los totales de las líneas quedan como explicación (ya declarados ahí), nunca como la razón
 *      del cierre.
 *   2. Si los temas pedidos NO comparten clave (p. ej. comercial↔inventario: cliente vs SKU — «los SKU van
 *      aparte»), el procedimiento no los ordena entre sí: el cierre lo dice, dice por qué (no comparten clave) y
 *      ofrece abrir uno. Nunca «pesa más» entre dominios sin clave común.
 *   3. La contribución no capturada es una ESTIMACIÓN contra el benchmark (cuatro garantías, CLAUDE.md §2):
 *      cada vez que su total aparece, la línea lo dice — «$4.9M de contribución no capturada (estimada contra
 *      el benchmark)» — nunca como dinero ya perdido, nunca sumada o restada con el vencido.
 *
 * CÓMO SE UBICA EN LA ESCALERA: después de `componerEncargo` (que sigue yendo primero: si ya matcheó ≥2 PARTES,
 * este peldaño ni se intenta) y del playbook activo en solitario — así un encargo de cobertura nunca cae a la
 * respuesta de un solo dominio. Se juzga como cualquier peldaño (muro + contrato + notarial); si no pasa, cede.
 *
 * PURO · determinístico · sin red. */
import { pasosDeDominios } from "./contratoDeDominios.js";
import { senalesDelDominio, LENTES, prioridadIntegrada, CRITERIOS, criterioDeLaPregunta } from "./prioridadIntegrada.js";
import { declaradorDe } from "../notario/declarar.js";
import { dominioPorId, dineroEnJuegoDe } from "../../config/contract/dominios.js";
import { CLAVES_DE_METRICA } from "../notario/lexico.js";   // el registro único de métricas — de acá se resuelve el CONCEPTO nombrado, nunca de una lista propia

const _DOM_TXT = { comercial: "Comercial", inventario: "Inventario", cobranza: "Cobranza", tesoreria: "Tesorería" };
const _val = (f) => String((f && (f.text || f.value)) || "");
const _lab = (f) => String((f && f.label) || "");
const _find = (figs, re) => (Array.isArray(figs) ? figs : []).find((f) => re.test(_lab(f))) || null;
const _esc = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const _norm = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

/** los pasos de todos los dominios pedidos, UN DOMINIO A LA VEZ (owner 2026-09-24: el tope de llamadas por ronda
 *  —8— se agotaría si se pidieran juntos; medido: «Inventario: sin señal material» aunque el dato SÍ tenía SKU
 *  frenados). Cada `leer()` es su propia ronda. */
function _figsPorDominio(dominios, leer) {
  const out = [];
  for (const d of dominios || []) { try { out.push(...(leer(pasosDeDominios({ dominios: [d], eje: null })) || [])); } catch { /* ese dominio queda sin figs, no rompe el resto */ } }
  return out;
}

/* ═══ A · EL CONCEPTO QUE LA PREGUNTA NOMBRÓ, RESUELTO CONTRA EL REGISTRO ═══════════════════════════════════════
 * `_claveNombrada(pregunta, dominio)` busca, entre los conceptos de `CLAVES_DE_METRICA` que son de ESE dominio,
 * el que aparece en la pregunta — el de coincidencia más LARGA gana («contribución no capturada» sobre
 * «contribución»). Sin ninguno, null: la pregunta nombró el dominio en genérico y se usa la señal líder. */
function _claveNombrada(pregunta, dominio) {
  const q = _norm(pregunta);
  let mejor = null;
  for (const m of CLAVES_DE_METRICA) {
    if (m.dominio !== dominio || m.referencia) continue;
    for (const c of m.conceptos) {
      const cn = _norm(c);
      if (cn.length < 4) continue;   // conceptos de 1-3 letras («caja», no aplica acá) son demasiado ambiguos para detectar solos
      const re = new RegExp(`(?<![a-z0-9ñ])${_esc(cn)}(?![a-z0-9ñ])`, "i");
      if (re.test(q) && (!mejor || cn.length > mejor.len)) mejor = { clave: m.clave, len: cn.length };
    }
  }
  return mejor ? mejor.clave : null;
}
/* las claves de comercial se agrupan en TRES baldes de reporte (owner 2026-09-24, el mapeo textual del
 * coordinador): «ventas» → venta del período; «margen/contribución/…» → la señal de siempre (no_capturada +
 * brecha); «carga/descuentos» → carga comercial — NUNCA llamada «margen» (ver la nota del defecto A arriba). */
const _BALDE_COMERCIAL = {
  ventas: "ventas", ventas_anterior: "ventas", unidades: "ventas", variacion: "ventas", variacion_usd: "ventas", vs_presupuesto: "ventas", vs_presupuesto_usd: "ventas",
  carga: "carga", carga_alta: "carga",
  margen: "margen", margen_promedio: "margen", contribucion: "margen", no_capturada: "margen", brecha: "margen", brecha_precio_costo: "margen", markup: "margen", peso_costo: "margen", costo: "margen", benchmark: "margen", nivel_carga: "margen",
};
const _baldeComercial = (pregunta) => { const c = _claveNombrada(pregunta, "comercial"); return c ? (_BALDE_COMERCIAL[c] || null) : null; };

/* el universo de un total: la subtotal de comercial trae su grupo en el propio rótulo («· subtotal · 5 cuentas
 * materiales (de 8 bajo el benchmark)» — se cita, como ya hace `margenEnRiesgo.js`); inventario/cobranza son un
 * «· total» a secas (el mismo patrón ya usado en `asesoria.js`/`encargoCompuesto.js`). */
function _universoDeTotal(dominio, fig) {
  if (dominio !== "comercial") return "total";
  const m = /subtotal · (\d+ cuentas materiales[^)]*\)?)/i.exec(_lab(fig));
  if (m) return `las ${m[1]}`;
  /* ronda 7: la carga comercial alta no trae «cuentas materiales» — trae su PROPIO grupo («6 cuentas sobre el
   * nivel declarado (5 de ellas bajo el benchmark)»). «el subtotal» a secas no CASA con ese rótulo (el Notario
   * lo juzga «universo-distinto») — pero el número EXACTO («6 cuentas…») exige verificar las 6 cifras
   * individuales, y la boleta de este playbook no siempre trae la fila de cada una (medido: 5 de 6, faltaba
   * Ripley) — «universo-incompleto». Se cita el grupo SIN el conteo ni el paréntesis de detalle («cuentas
   * sobre el nivel declarado»): las mismas PALABRAS del propio rótulo (el Notario las casa por vocabulario de
   * conjuntos, `_universoCasa`), sin pedir la lista completa de una cifra que no la trae. */
  const m2 = /subtotal · (?:\d+\s+)?(.+?)(?:\s*\([^)]*\))?$/i.exec(_lab(fig));
  return m2 ? m2[1] : "el subtotal";
}
/** _medidaDineroEnJuego(dominio, figs) → { rotulo, fmt, valor, universo } | null — LA medida de dinero en juego
 *  que el REGISTRO declara para ese dominio (owner 2026-09-24, ronda 4), independiente de qué concepto nombró la
 *  línea: el cierre entre temas SIEMPRE compara esto, nunca la cifra de la línea si son distintas. Quién
 *  encabeza esta medida lo da `senalesDelDominio` (el eje correcto: nunca mezcla bodega/SKU bajo el mismo
 *  sufijo — ronda 7: «carga» ya no nombra líder, ver la nota en `_lineaComercial`). */
function _medidaDineroEnJuego(dominio, figs) {
  const dj = dineroEnJuegoDe(dominio);
  if (!dj) return null;
  const total = _find(figs, dj.regex);
  if (!total) return null;
  return { rotulo: dj.rotulo, fmt: _val(total), valor: _num(total), universo: _universoDeTotal(dominio, total) };
}

/** { texto, valor, universo, entidad, rotulo, fmt, esMedidaDeDineroEnJuego, nombreTema } de la línea COMERCIAL,
 *  según el balde (owner 2026-09-24, ronda 4): «margen» ES la medida de dinero en juego del dominio —el total y
 *  quién encabeza, la MISMA cifra que el cierre reusará—; «ventas»/«carga» NO lo son (ventas no es dinero en
 *  riesgo; carga es dinero, pero no la medida registrada), así que un cierre que las cruce declara la
 *  sustitución en vez de comparar calladamente la cifra equivocada. */
function _lineaComercial(pregunta, sujeto, figs, D, breve = false) {
  const balde = _baldeComercial(pregunta);
  if (balde === "ventas") {
    const f = sujeto ? _find(figs, new RegExp(`^${_esc(sujeto)} · Venta$`, "i")) : _find(figs, /^Ventas del per[ií]odo$/i);
    if (!f) return null;
    const entidad = sujeto || "negocio";
    let t;
    if (sujeto) {
      t = `Ventas: ${sujeto} vendió ${_val(f)}.`;
      D.cifra({ sujeto, metrica: "Venta", valor: _val(f), texto: t });
    } else {
      /* la variación vs año anterior viaja como fig «headline» (declarar.js ya sabe traducirla por su `context`
       * — nunca «vs presupuesto» confundida con «vs año anterior»); sin ella en la boleta, la línea se queda con
       * la venta sola (nunca inventa el signo ni el número). */
      const h = _find(figs, /^headline$/i);
      const esAnioAnterior = h && /a[ñn]o anterior/i.test(String(h.context || ""));
      t = `Ventas: ${_val(f)} en el período`;
      if (esAnioAnterior) { const v = _val(h); t += `, ${/^-/.test(v) ? "" : "+"}${v} contra el año anterior`; }
      t += ".";
      D.cifra({ sujeto: "negocio", metrica: "Venta", valor: _val(f), universo: "total", texto: t });
      /* «contra el año anterior» es un punto de VARIACIÓN para el detector de presencia (no una cifra): solo un
       * `D.variacion` lo cubre (`_CUBRE.variacion` no admite tipo «cifra» — un `D.cifra`/`D.deFig` acá se queda
       * sin declarar, medido en la ronda 4). */
      if (esAnioAnterior) D.variacion({ sujeto: "negocio", metrica: "Ventas", direccion: /^-/.test(_val(h)) ? "baja" : "sube", valor: _val(h), texto: t });
    }
    return { texto: t, valor: _num(f), universo: "venta", entidad, rotulo: "Venta", fmt: _val(f), esMedidaDeDineroEnJuego: false, nombreTema: "comercial" };
  }
  if (balde === "carga") {
    const f = _find(figs, /^Carga comercial alta · subtotal/i);
    if (!f) return null;
    /* ronda 7: SIN «encabeza {lider}» — a propósito. «Carga comercial alta» es una métrica DERIVADA (solo las
     * cuentas sobre el nivel declarado la traen, nunca el eje entero: 5-6 de 13 clientes según el corte), y un
     * orden sobre ella —«max» o «comparativo»— exige que el Notario resuelva su universo, y ahí siempre falta
     * al menos una fila («universo-incompleto», medido con esta boleta: 5 de 6 cuentas del subtotal). Declarar
     * un «encabeza» que no se puede verificar del todo no se sirve a medias (regla de la casa) — mejor el total
     * solo, verificado entero, que un líder a medio verificar. El total y su marca ya son la regla 2 obligatoria;
     * el líder es dato extra (igual que la severidad/urgencia con 3+ temas), no un requisito. */
    let t = `Carga comercial: ${_val(f)} de carga comercial — lo que se cede en acciones comerciales por sobre el nivel declarado`;
    /* el subtotal es un agregado («N cuentas sobre el nivel…») y sin `universo` el muro lo marca
     * `universo-no-declarado` — el mismo dato que ya declara la línea de margen (`_universoDeTotal`), reusado. */
    D.cifra({ sujeto: "negocio", metrica: "Carga comercial alta", valor: _val(f), universo: _universoDeTotal("comercial", f), texto: t });
    t += ".";
    return { texto: t, valor: _num(f), universo: "carga", entidad: "negocio", rotulo: "Carga comercial alta", fmt: _val(f), esMedidaDeDineroEnJuego: false, nombreTema: "comercial" };
  }
  /* «margen» (o genérico, sin concepto nombrado): LA medida de dinero en juego del dominio — su total y quién
   * encabeza (el líder de `senalesDelDominio`: el mismo eje que ya reporta esta métrica, nunca un barrido plano
   * de figs que mezclaría otro nivel de agregación), más la brecha del líder al benchmark (severidad). El TEMA
   * del cierre se llama «margen» solo si la pregunta lo nombró así (se le devuelve su propia palabra); genérico
   * («lo comercial»), se llama «comercial» — el nombre del dominio que SÍ dijo, no uno que no dijo. */
  const dj = _medidaDineroEnJuego("comercial", figs);
  if (!dj) return null;
  const nombreTema = balde === "margen" ? "margen" : "comercial";
  /* owner 2026-09-24, ronda 5: la contribución no capturada es una ESTIMACIÓN contra el benchmark, nunca dinero
   * ya perdido (cuatro garantías, CLAUDE.md §2) — la marca va en la propia línea, cada vez que el total aparece. */
  let t = `${balde === "margen" ? "Margen" : "Comercial"}: ${dj.fmt} de contribución no capturada (estimada contra el benchmark)`;
  D.cifra({ sujeto: "negocio", metrica: dj.rotulo, valor: dj.fmt, universo: dj.universo, texto: t });
  const s = senalesDelDominio(figs, "comercial");
  const xLider = s[0];
  if (xLider) {
    t += `; encabeza ${xLider.entidad} con ${xLider.materialidad.fmt}`;
    D.cifra({ sujeto: xLider.entidad, metrica: dj.rotulo, valor: xLider.materialidad.fmt, texto: t });
    D.orden({ sujeto: xLider.entidad, metrica: xLider.materialidad.rotulo, forma: "max", universo: LENTES.comercial.universo(), texto: t });
    /* con 3+ temas en juego, la severidad extra (la brecha del líder) se omite — presupuesto de brevedad
     * (owner 2026-09-24, ~450 chars para 3 temas): el total y quién encabeza SÍ son obligatorios (regla 2), el
     * dato extra no. */
    if (!breve && xLider.severidad) { t += `, ${_frase(xLider.severidad.fmt, xLider.severidad.rotulo)}`; D.cifra({ sujeto: xLider.entidad, metrica: xLider.severidad.rotulo, valor: xLider.severidad.fmt, texto: t }); }
  }
  t += ".";
  return { texto: t, valor: dj.valor, universo: "margen", entidad: "negocio", rotulo: dj.rotulo, fmt: dj.fmt, esMedidaDeDineroEnJuego: true, nombreTema };
}

/* «165d de días de inventario» / «269d de dias vencido» repiten la unidad — el rótulo ya empieza con lo que el
 * fmt («165d») ya trae. «Días de Z»/«Días sin Z» se dicen sin duplicar «días»; «Dias Vencido» (cobranza) se dice
 * «días de atraso», la forma que pidió el coordinador. */
const _frase = (fmt, rotulo) => {
  const r = String(rotulo || "");
  if (/^dias?\s+vencido$/i.test(r)) {
    /* owner 2026-09-24, forma E: «269 días de atraso», no «269d de atraso» — el «d» corto se deletrea acá */
    const dias = /^(\d+)\s*d$/i.exec(String(fmt || ""));
    return dias ? `${dias[1]} días de atraso` : `${fmt} de atraso`;
  }
  const m = /^D[ií]as (de|sin) (.+)$/i.exec(r);
  /* «165 días de inventario», no «165d de inventario» (supervisor 2026-09-24, misma forma que el atraso).
   * ⚠️ trampa de escape medida acá: la versión anterior de esta línea tenía `(d+)s*d` —sin las barras de `\d`/
   * `\s`, perdidas al editar— y por eso NUNCA matcheaba «165d»: quedaba muda y caía al fallback de abajo (la
   * forma vieja, sin arreglar). Reparado a `(\d+)\s*d`, el patrón que sí matchea. */
  const n = /^(\d+)\s*d$/i.exec(String(fmt || ""));
  if (m && n) return `${n[1]} días ${m[1]} ${m[2].toLowerCase()}`;
  return m ? `${fmt} ${m[1]} ${m[2].toLowerCase()}` : `${fmt} de ${r.toLowerCase()}`;
};
const _num = (f) => (f && Number.isFinite(f.raw) ? f.raw : NaN);

/** la línea de INVENTARIO o COBRANZA: SIEMPRE la medida de dinero en juego del dominio (stock/inventario →
 *  capital frenado total; deuda/cobranza/atraso → saldo vencido total — el mapeo del coordinador coincide con
 *  lo que el registro declara, así que no hace falta un balde de conceptos acá), con su total y quién encabeza,
 *  más la severidad/urgencia del líder (recuperado, días, atraso) como dato adicional. */
function _lineaSenal(dominio, figs, D, breve = false) {
  const dj = _medidaDineroEnJuego(dominio, figs);
  const L = LENTES[dominio];
  if (!dj || !L) return null;
  let t = `${_DOM_TXT[dominio]}: ${dj.fmt} de ${dj.rotulo.toLowerCase()}`;
  D.cifra({ sujeto: "negocio", metrica: dj.rotulo, valor: dj.fmt, universo: dj.universo, texto: t });
  /* quién encabeza sale de `senalesDelDominio` (el eje correcto: SKU en inventario, cliente en cobranza) —
   * NUNCA de un barrido plano de figs, que en inventario mezclaría bodegas bajo el mismo sufijo «· Capital
   * frenado» (medido: «encabeza Valparaíso» con la severidad de otro SKU pegada al lado). */
  const s = senalesDelDominio(figs, dominio);
  const xLider = s[0];
  if (xLider) {
    t += `; encabeza ${xLider.entidad} con ${xLider.materialidad.fmt}`;
    D.cifra({ sujeto: xLider.entidad, metrica: dj.rotulo, valor: xLider.materialidad.fmt, texto: t });
    D.orden({ sujeto: xLider.entidad, metrica: xLider.materialidad.rotulo, forma: L.materialidad.peor === "menor" ? "min" : "max", universo: L.universo(), texto: t });
    /* presupuesto de brevedad con 3+ temas (ver la nota gemela en `_lineaComercial`): el total y quién encabeza
     * son obligatorios; severidad/urgencia son dato extra. */
    if (!breve) {
      if (xLider.severidad) { t += `, ${_frase(xLider.severidad.fmt, xLider.severidad.rotulo)}`; D.cifra({ sujeto: xLider.entidad, metrica: xLider.severidad.rotulo, valor: xLider.severidad.fmt, texto: t }); }
      if (xLider.urgencia && L.urgencia) { t += `, ${_frase(xLider.urgencia.fmt, xLider.urgencia.rotulo)}`; D.cifra({ sujeto: xLider.entidad, metrica: xLider.urgencia.rotulo, valor: xLider.urgencia.fmt, texto: t }); }
    }
  }
  t += ".";
  /* entidad/rotulo/fmt son el TOTAL del dominio (sujeto «negocio»): el cierre entre temas (si lo hay) reusa
   * exactamente esta cifra — la misma medida que el registro declara, nunca la del líder ni una fuente nueva. */
  return { texto: t, valor: dj.valor, universo: dominio, entidad: "negocio", rotulo: dj.rotulo, fmt: dj.fmt, esMedidaDeDineroEnJuego: true, nombreTema: dominio };
}

/** la línea de un dominio pedido — comercial resuelve su concepto; inventario/cobranza usan la señal (coinciden
 *  con el mapeo del coordinador); sin señal, lo dice. */
function _lineaDeDominio(dominio, pregunta, sujeto, figs, D, breve = false) {
  const r = dominio === "comercial" ? _lineaComercial(pregunta, sujeto, figs, D, breve) : _lineaSenal(dominio, figs, D, breve);
  return r || { texto: `${_DOM_TXT[dominio] || dominio}: sin señal material en este dato.`, valor: NaN, universo: dominio };
}

/** la línea de un dominio AUSENTE (tesorería): la ausencia declarada — y la exposición de crédito se OFRECE, no
 *  se promete sin entregar (owner 2026-09-24, defecto C: «Tesorería… mido en su lugar…» y después ninguna cifra).
 *  ⚠️ NO repite «caja»/«efectivo» (guardC.js:_COMO_CAJA mira ±140/260 chars alrededor de cada cifra; ver la nota
 *  histórica de esta misma función). */
function _lineaDeAusencia(id, D) {
  const info = dominioPorId(id);
  if (!info || !info.ausencia) return null;
  const t = `Tesorería: este archivo no trae datos de tesorería. Puedo mostrarte en su lugar la exposición de crédito por cliente si te sirve.`;
  D.lectura({ texto: t, sello: "criterio mío" });
  return { texto: t, valor: NaN, universo: "tesoreria" };
}

/* ═══ B · EL CIERRE ENTRE TEMAS (owner 2026-09-24, defecto B; vuelta 5: hereda `prioridadIntegrada.js`) ═════════
 * Una decisión ENTRE TEMAS («¿qué me preocupa más, margen o cobranza?») NO se decide comparando cuentas líderes
 * (ronda 3) ni totales de dinero en juego entre dominios (ronda 4: el owner lo rechazó — «un segundo criterio de
 * prioridad»). El veredicto lo da el PROCEDIMIENTO existente: `prioridadIntegrada(figs, temas)`, restringido a
 * los temas de clave «cliente» (comercial/cobranza) — la misma regla que ya usa el ensamblador
 * (`componerPrioridadIntegrada`), aquí solo LEÍDA, no reescrita. Si el usuario dio un criterio explícito que
 * nombra uno de los temas pedidos («prioriza cobranza»), ese criterio manda (CLAUDE.md §2, «el criterio del
 * usuario manda») y no hace falta calcular la integrada. Un tema de clave «sku» (inventario) nunca entra al
 * veredicto — «los SKU van aparte» — y se menciona con la MISMA frase certificada que usa el ensamblador
 * («clave SKU: no se compara con las cuentas»), nunca comparado por tamaño. */
const _GENERO = { margen: "el", comercial: "el", inventario: "el", cobranza: "la" };
/* la frase de una señal (materialidad + urgencia si el dominio la trae; la severidad ya está en la línea de
 * arriba y no se repite acá) — «Lider, $4.6M vencidos con 269 días de atraso». */
function _fraseDeSenal(x, dominio) {
  const L = LENTES[dominio];
  const partes = [L.materialidad.como(x.materialidad.fmt)];
  /* «269 días de atraso», no «269d» (owner 2026-09-24, forma E, la misma que usan las líneas): `_frase` deletrea
   * el día corto; `L.urgencia.como()` no lo hace (es la forma corta que usa el ensamblador largo, certificada
   * pero distinta). */
  if (x.urgencia && L.urgencia) partes.push(_frase(x.urgencia.fmt, x.urgencia.rotulo));
  return `${x.entidad}, ${partes.join(" con ")}`;
}
function _declararSenal(D, x, dominio, texto) {
  D.cifra({ sujeto: x.entidad, metrica: x.materialidad.rotulo, valor: x.materialidad.fmt, texto });
  if (x.urgencia && LENTES[dominio].urgencia) D.cifra({ sujeto: x.entidad, metrica: x.urgencia.rotulo, valor: x.urgencia.fmt, texto });
}
/* el tema de clave «sku» (inventario), aparte — la frase certificada de `componerPrioridadIntegrada`
 * (`prioridadIntegrada.js:530`), byte a byte, con su misma declaración (D.orden + D.cifra por señal). */
function _lineaSkuAparte(dominio, figs, D) {
  const s = senalesDelDominio(figs, dominio);
  if (!s.length) return null;
  const y = s[0], L = LENTES[dominio];
  const partes = [L.materialidad.como(y.materialidad.fmt)];
  if (y.severidad) partes.push(L.severidad.como(y.severidad.fmt));
  if (y.urgencia && L.urgencia) partes.push(L.urgencia.como(y.urgencia.fmt));
  const l = `En ${dominio} (clave SKU: no se compara con las cuentas): ${y.entidad} primero — ${partes.join(", ")}.`;
  D.orden({ sujeto: y.entidad, metrica: y.materialidad.rotulo, forma: L.materialidad.peor === "menor" ? "min" : "max", universo: L.universo(), texto: l });
  D.cifra({ sujeto: y.entidad, metrica: y.materialidad.rotulo, valor: y.materialidad.fmt, texto: l });
  if (y.severidad) D.cifra({ sujeto: y.entidad, metrica: y.severidad.rotulo, valor: y.severidad.fmt, texto: l });
  if (y.urgencia && L.urgencia) D.cifra({ sujeto: y.entidad, metrica: y.urgencia.rotulo, valor: y.urgencia.fmt, texto: l });
  return l;
}
/** decisionEntreTemas({ dominios, figs, pregunta }) → LA decisión del procedimiento entre dos o más temas — la
 *  MISMA función que usa `componerCoberturaCorta` para su propio cierre (owner 2026-09-24, ronda 6: «reusá la
 *  función, no la copies» — `compararAlternativas.js` la importa de acá, nunca reescribe la regla). Nunca
 *  compara montos entre dominios: hereda `prioridadIntegrada.js` entera para los temas que comparten clave
 *  «cliente» (regla 1) y declara, sin elegir, cuando los temas pedidos no comparten clave (regla 2).
 *    → { tipo: "sinClaveComun", partes: [{ dominio, clave }] }
 *    → { tipo: "veredicto", temaGanador, temaPerdedor, x: { entidad, materialidad, severidad?, urgencia? },
 *        criterioNombre, skuAparte: [dominios de clave sku, si los hay] }
 *    → null — ni el criterio explícito ni `prioridadIntegrada` resolvieron nada con esta boleta */
export function decisionEntreTemas({ dominios, figs, pregunta = "" } = {}) {
  const doms = [...new Set((Array.isArray(dominios) ? dominios : []).filter((d) => LENTES[d]))];
  const clienteKeyed = doms.filter((d) => LENTES[d].clave === "cliente");
  const skuKeyed = doms.filter((d) => LENTES[d].clave === "sku");
  /* REGLA 2 · sin clave común entre los temas pedidos, el procedimiento no los ordena: nunca «pesa más» sin
   * clave compartida — se declara la razón, ninguna elección. */
  if (clienteKeyed.length < 2) {
    if (doms.length < 2) return null;
    return { tipo: "sinClaveComun", partes: doms.map((d) => ({ dominio: d, clave: LENTES[d].clave })) };
  }
  /* REGLA 1 · el veredicto lo da `prioridadIntegrada`, o el criterio EXPLÍCITO del usuario si nombra uno de los
   * temas pedidos (manda sobre el procedimiento por defecto — CLAUDE.md §2). */
  const cr = criterioDeLaPregunta(pregunta);
  let temaGanador = null, x = null, criterioNombre = CRITERIOS.riesgo.nombre;
  if (cr && cr.modo === "explicito" && CRITERIOS[cr.criterio] && CRITERIOS[cr.criterio].dominio && clienteKeyed.includes(CRITERIOS[cr.criterio].dominio)) {
    temaGanador = CRITERIOS[cr.criterio].dominio;
    criterioNombre = CRITERIOS[cr.criterio].nombre;
    const s = senalesDelDominio(figs, temaGanador);
    if (!s.length) return null;
    x = s[0];
  } else {
    const P = prioridadIntegrada(figs, clienteKeyed);
    if (!P || !P.integrada.length) return null;
    const c = P.integrada[0];
    for (const d of clienteKeyed) {
      const sd = c.senales[d];
      if (!sd || !sd.materialidad) continue;
      if (!temaGanador || sd.materialidad.rango < c.senales[temaGanador].materialidad.rango) temaGanador = d;
    }
    if (!temaGanador) return null;
    x = { ...c.senales[temaGanador], entidad: c.entidad };
  }
  const temaPerdedor = clienteKeyed.find((d) => d !== temaGanador) || null;
  return { tipo: "veredicto", temaGanador, temaPerdedor, x, criterioNombre, skuAparte: skuKeyed };
}

function _cierreEntreTemas(items, figs, pregunta, D) {
  const validos = items.filter((it) => it && it.dominio && LENTES[it.dominio]);
  const nombreDe = (it) => it.nombreTema || (_DOM_TXT[it.dominio] || it.dominio).toLowerCase();
  const dec = decisionEntreTemas({ dominios: validos.map((it) => it.dominio), figs, pregunta });
  if (!dec) return null;

  if (dec.tipo === "sinClaveComun") {
    const claveTxt = (d) => (LENTES[d].clave === "sku" ? "por SKU" : "por cliente");
    const partes = dec.partes.map(({ dominio }) => `${_DOM_TXT[dominio] || dominio} (${claveTxt(dominio)})`);
    return `El procedimiento no ordena ${partes.join(" y ")} entre sí: no comparten clave. ¿Cuál abrimos primero?`;
  }

  const itemGanador = validos.find((it) => it.dominio === dec.temaGanador);
  const nombreTemaGanador = itemGanador ? nombreDe(itemGanador) : (_DOM_TXT[dec.temaGanador] || dec.temaGanador).toLowerCase();
  const gen = _GENERO[nombreTemaGanador] || _GENERO[dec.temaGanador] || "el";
  const senalTxt = _fraseDeSenal(dec.x, dec.temaGanador);
  /* «pondría el foco» — la misma forma de recomendación que ya usa `componerPrioridadIntegrada` para su propia
   * cabecera («dónde pondría el foco primero…»), certificada y nunca vetada como afirmación-no-declarada en
   * este archivo: el veredicto es UNA lectura del procedimiento («criterio mío»), con sus cifras declaradas
   * aparte por `_declararSenal`. */
  const t = `Primero ${gen} ${nombreTemaGanador}: ahí pondría el foco, por la prioridad integrada — ${senalTxt} (criterio: ${dec.criterioNombre}).`;
  D.lectura({ texto: t, sello: "criterio mío" });
  _declararSenal(D, dec.x, dec.temaGanador, t);

  const partesFinal = [t];
  for (const d of dec.skuAparte) {
    const l = _lineaSkuAparte(d, figs, D);
    if (l) partesFinal.push(l);
  }
  return partesFinal.join(" ");
}

/**
 * componerCoberturaCorta({ encargo, pregunta, leer, declarar }) → texto | null
 *   Una línea por dominio pedido (el CONCEPTO que la pregunta nombró, o la señal líder si lo nombró en genérico)
 *   + una por ausencia (con la oferta, no la promesa vacía) + el cierre ENTRE TEMAS si el cierre pedido es
 *   DECISIÓN. Nunca una cobertura sin veredicto cuando el usuario pidió uno: sin cierre posible, cede el turno.
 */
export function componerCoberturaCorta({ encargo, pregunta = "", leer, declarar = null } = {}) {
  if (!encargo || !encargo.esEncargo || typeof leer !== "function") return null;
  const dominios = Array.isArray(encargo.dominios) ? encargo.dominios : [];
  const ausentes = Array.isArray(encargo.ausentes) ? encargo.ausentes : [];
  if (dominios.length < 2 && !(dominios.length >= 1 && ausentes.length >= 1)) return null;   // cobertura real: ≥ 2 temas
  const D = declaradorDe(declarar);
  const figs = _figsPorDominio(dominios, leer);
  /* presupuesto de brevedad (owner 2026-09-24, ~450 chars para 3 temas): con 3 o más dominios pedidos, cada
   * línea se queda en el total y quién encabeza (regla 2, obligatorio); la severidad/urgencia extra —dato, no
   * requisito— se omite. Con 2 dominios hay presupuesto de sobra y se muestra completa, como siempre. */
  const breve = dominios.length >= 3;
  const items = dominios.map((d) => ({ dominio: d, ...(_lineaDeDominio(d, pregunta, encargo.sujeto, figs, D, breve)) }));
  const L = items.map((it) => it.texto);
  for (const a of ausentes) { const r = _lineaDeAusencia(a, D); if (r) { L.push(r.texto); items.push({ dominio: a, ...r }); } }
  if (!L.length) return null;
  /* ronda 7 (coordinador): un tema pedido (tesorería incluida) NUNCA falta en la respuesta — pero pedir
   * PRIORIDAD entre un dominio real y uno AUSENTE («¿priorizo caja o cobranza?») no es una decisión con dos
   * lados: solo hay UN precio que poner. `_cierreEntreTemas` decide ENTRE TEMAS con LENTES (dominios activos);
   * un ausente nunca entra ahí (no tiene lente) y forzar un veredicto con un solo lado real cedía el turno
   * entero al playbook del dominio real —perdiendo la línea de ausencia que ya se había compuesto, el defecto
   * inverso al que esta regla existe para evitar—. Con < 2 dominios REALES no hay nada que el procedimiento
   * pueda ordenar entre sí: se sirve lo que hay (la línea del dominio + la ausencia con su oferta), sin
   * fingir un veredicto ni ceder por uno que no correspondía. */
  if (encargo.cierre === "decision" && dominios.length >= 2) {
    const cierre = _cierreEntreTemas(items, figs, pregunta, D);   // hereda prioridadIntegrada.js — declara su propia lectura + cifras
    if (!cierre) return null;   // una decisión sin veredicto posible no se sirve a medias: cede al siguiente peldaño
    L.push(cierre);
  }
  return L.join(" ");
}

/* ═══ LA COBERTURA CORTA EN MODO CIFRA (owner 2026-09-24, ronda 2, item 2) ═══════════════════════════════════════
 * «Una pregunta simple de dos temas con cierre "cifra" tiene que responder las dos cifras, en forma corta y
 * verificadas.» Esto NO es un encargo (cierre="cifra" es la marca de «una cifra por tema», la corrección de
 * diseño del set v1). Una línea por tema, con la cifra QUE LA PREGUNTA PIDIÓ: «cobré» → abonado; «debe/deuda» →
 * saldo pendiente; «vencido» → saldo vencido. Sin cifra verificada para UN tema pedido, cede entero al límite
 * (nunca sustituye en silencio — certificación congelada p3). */
/* ⚠️ LA TRAMPA DE SIEMPRE DE ESTA CASA: `\b` no encuentra borde justo después de una vocal acentuada («cobré »)
 * porque `\b`/`\w` son ASCII. Los bordes se escriben con la clase que sí conoce la tilde y la ñ. */
const _FIN_CC = "(?![\\wáéíóúñ])";
const _METRICA_COBRANZA = [
  [new RegExp(`\\bcobr[eé]s?${_FIN_CC}|\\bcobrad[oa]s?${_FIN_CC}|\\babon`, "i"), "Abonado", "abonado"],
  [/\bvencid/i, "Saldo vencido", "vencido"],
  [/\bdeb[eo]\b|\bdeben\b|\badeud|\bdeuda\b/i, "Saldo pendiente", "pendiente"],
];
const _metricaCobranza = (pregunta) => { for (const [re, label, nombre] of _METRICA_COBRANZA) if (re.test(pregunta)) return { label, nombre }; return { label: "Saldo pendiente", nombre: "pendiente" }; };
const _METRICA_INVENTARIO = [[/\bstock\b|\bunidades\b/i, "Unidades en stock", "stock"], [/\bcapital\b|\binventario\b/i, "Capital", "capital en inventario"]];
const _metricaInventario = (pregunta) => { for (const [re, label, nombre] of _METRICA_INVENTARIO) if (re.test(pregunta)) return { label, nombre }; return { label: "Capital", nombre: "capital en inventario" }; };

/** { texto, verificada } — `verificada` false cuando no hubo fig y el texto es la declaración de ausencia. */
function _lineaCifraDeDominio(dominio, { sujeto, pregunta, figs, D }) {
  if (dominio === "comercial") {
    const f = sujeto ? _find(figs, new RegExp(`^${_esc(sujeto)} · Venta$`, "i")) : _find(figs, /^Ventas del per[ií]odo$/i);
    if (!f) return { texto: `${_DOM_TXT.comercial}: sin cifra verificada de venta en este dato.`, verificada: false };
    const t = sujeto ? `${sujeto} vendió ${_val(f)}.` : `Venta del período: ${_val(f)}.`;
    D.cifra({ sujeto: sujeto || "negocio", metrica: "Venta", valor: _val(f), universo: sujeto ? undefined : "total", texto: t });
    return { texto: t, verificada: true };
  }
  if (dominio === "cobranza") {
    const { label, nombre } = _metricaCobranza(pregunta);
    const f = sujeto ? _find(figs, new RegExp(`^${_esc(sujeto)} · ${_esc(label)}$`, "i")) : _find(figs, new RegExp(`^${_esc(label)} · total$`, "i"));
    if (!f) return { texto: `${_DOM_TXT.cobranza}: sin cifra verificada de ${nombre} en este dato.`, verificada: false };
    /* «Lider tiene $9.8M de pendiente» → «Lider te debe $9.8M (saldo pendiente)» (owner 2026-09-24, forma) */
    const t = sujeto
      ? (label === "Saldo pendiente" ? `${sujeto} te debe ${_val(f)} (saldo pendiente).` : `${sujeto}: ${_val(f)} de ${nombre}.`)
      : `${label}: ${_val(f)}.`;
    D.cifra({ sujeto: sujeto || "negocio", metrica: label, valor: _val(f), universo: sujeto ? undefined : "total", texto: t });
    return { texto: t, verificada: true };
  }
  if (dominio === "inventario") {
    const { label, nombre } = _metricaInventario(pregunta);
    const f = sujeto ? _find(figs, new RegExp(`^${_esc(sujeto)} · ${_esc(label)}$`, "i")) : _find(figs, new RegExp(`^${_esc(label)} · total$`, "i"));
    if (!f) return { texto: `${_DOM_TXT.inventario}: sin cifra verificada de ${nombre} en este dato.`, verificada: false };
    const t = sujeto ? `${sujeto}: ${_val(f)} de ${nombre}.` : `${label} en inventario: ${_val(f)}.`;
    D.cifra({ sujeto: sujeto || "negocio", metrica: label, valor: _val(f), universo: sujeto ? undefined : "total", texto: t });
    return { texto: t, verificada: true };
  }
  return null;
}

/**
 * componerCoberturaCifra({ dominios, ausentes, sujeto, pregunta, leer, declarar }) → texto | null
 */
export function componerCoberturaCifra({ dominios, ausentes = [], sujeto = null, pregunta = "", leer, declarar = null } = {}) {
  const doms = Array.isArray(dominios) ? dominios : [];
  const aus = Array.isArray(ausentes) ? ausentes : [];
  if (doms.length + aus.length < 2 || typeof leer !== "function") return null;
  const D = declaradorDe(declarar);
  const figs = _figsPorDominio(doms, leer);
  const L = [];
  for (const d of doms) {
    const r = _lineaCifraDeDominio(d, { sujeto, pregunta, figs, D });
    if (!r || !r.verificada) return null;   // UN tema pedido sin cifra ⇒ el turno entero cede al límite (nunca una sustitución silenciosa)
    L.push(r.texto);
  }
  for (const a of aus) { const l = _lineaDeAusencia(a, D); if (l) L.push(l.texto); }
  if (!L.length) return null;
  return L.join(" ");
}
