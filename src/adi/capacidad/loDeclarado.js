/* === src/adi/capacidad/loDeclarado.js · LA ENTREGA USA LO DECLARADO Y PUEDE CITAR UNA RESPUESTA ANTERIOR (Etapa 2, bloque 3 · owner 2026-10-03) ═
 * LEYES DEL OWNER (2026-09-25, `adi-flujo-producto-complemento`): los CUATRO ORÍGENES (medido · documento · declarado · supuesto) nunca se funden;
 * la confirmación es un sello APARTE y no cambia el origen; un declarado NUNCA pisa un medido. Y la de siempre: «la comprensión del lenguaje es del LLM»
 * — ADI no reconoce frases: el anfitrión declara un CONCEPTO TIPADO (el id con que la casa nombra una referencia o una métrica) y un valor numérico;
 * ADI valida contra tablas cerradas (el léxico de la casa, `POLICY_CONFIG`) y decide con DATOS, nunca con texto.
 *
 * ESTE BLOQUE SOLO AGREGA UNA ENTRADA NUEVA A LA ENTREGA (la etapa 1 está cerrada: `entrega/`, el contrato §7.3 1-57 y sus controles no se tocan):
 * sin nada declarado y sin cita, la Entrega sale BYTE-IDÉNTICA a la de antes. Todo lo de este archivo es puro (sin I/O, sin red): la capa de las
 * acciones (`acciones.js`) lee la memoria y entra al tramo del Core; acá solo se decide qué de lo declarado tiene LUGAR y cómo se ve.
 *
 * UN DATO DECLARADO TIENE LUGAR EN LA ENTREGA SOLO SI LA CASA YA TIENE EL LUGAR DE ESE CONCEPTO — y solo cuenta lo VIGENTE (= confirmado; un pendiente
 * nunca entra, `continuidad/empresa.js`). Tres destinos, y ninguno se fuerza:
 *   1 · UN CRITERIO (clase «criterio», concepto = una referencia de la casa: benchmark · nivel_carga · umbral_materialidad · piso_rotacion · techo_cobertura ·
 *       umbral_frenado — y, desde el bloque 5, el piso de materialidad de cobranza: `piso_materialidad_cobranza`, criterio de materialidad que no modifica ninguna medición) es EL UMBRAL «declarado por la empresa»: entra por el mismo mecanismo que ya resuelve el origen de toda llave (`businessPolicy.js:umbral`,
 *       el registro del criterio de conversación) y la Entrega lo muestra con su origen donde lo usa (el Marco). Vale para TODA la empresa: un criterio con
 *       entidad o período no tiene ese lugar.
 *   2 · UN HECHO (clase «hecho», concepto = una métrica del léxico) se muestra declarado AL LADO de lo medido de la MISMA métrica y la MISMA entidad, cada uno
 *       con su origen; si no coinciden, se declara la diferencia. NUNCA reemplaza lo medido (ni siquiera con `usar: "declarado"`: ADI no calcula sobre lo
 *       declarado, lo declara). COMPARABILIDAD (decisión §7.3·58): un declarado y un medido se comparan SOLO si ADI puede demostrar el mismo concepto, la misma unidad y,
 *       si es dinero, la misma moneda y la misma escala (`comparabilidad`); si no, se muestran por separado, sin restar. La escala jamás se infiere (ley `adi-moneda-y-marco`):
 *       el dinero declarado hoy no trae moneda ni escala, así que no se compara y queda en la memoria (el mismo resultado de siempre, ahora por una regla explícita).
 *   2b· EL PLAZO DE COBRO (opción A, decisión §7.3·58): se muestra en «Lo declarado» con su procedencia y la pregunta abierta de cobranza de esa cuenta («¿plazo pactado o atraso
 *       real?») lo cita; NO modifica ningún cálculo (el vencido sigue siendo el medido). Si algún día se mide atraso contra el plazo pactado, será una MÉTRICA EXPLÍCITA nueva.
 *   3 · TODO LO DEMÁS (un concepto que la casa no conoce, un documento) SE QUEDA EN LA MEMORIA: se dice en
 *       el momento de declararlo (`lugarDeAporte`) y no se vuelve a mencionar.
 * Y la CITA (`contexto: E1`, `E1.h3`, `E1.u1`): lo que una Entrega anterior de ESTA conversación entregó, tal cual quedó guardado, para que la Entrega nueva
 * lo use como antecedente — sin recalcularlo en silencio (revisar si una cifra cambió con datos nuevos es del bloque 4). */
import { CLAVES_DE_METRICA } from "../notario/lexico.js";
import { normalizar } from "../notario/afirmacion.js";
import { formatoDeLaCasa, formatoDeReferencia } from "../notario/hechos.js";
import { POLICY_DE_REFERENCIA, ETIQUETA_ORIGEN, ORIGEN, etiquetaDeProcedencia, CRITERIOS_FUERA_DE_POLICY } from "../../config/businessPolicy.js";
import { admiteDeclarado } from "../../config/contract/metricRegistry.js";
import { CRITERIA } from "../criteria.js";   // SOLO los límites de plausibilidad de cada criterio (los mismos de «mi margen mínimo es 28 %»): nunca su reconocedor de frases

export const ORIGEN_DECLARADO = "declarado";
const _txt = (x) => String(x == null ? "" : x).trim().toLowerCase();
const _fecha = (iso) => (typeof iso === "string" && iso.length >= 10 && iso[4] === "-" && iso[7] === "-" ? iso.slice(0, 10) : null);   // la fecha de un sello ISO; sin una sola regex en este archivo (el gate lo vigila: ADI no reconoce frases)
const _num = (x) => (typeof x === "number" ? x : x != null && x !== "" ? Number(x) : NaN);

/* ═══ 1 · LAS TABLAS: QUÉ SE PUEDE DECLARAR Y DÓNDE TIENE LUGAR ═══════════════════════════════════════════════════════════ */
/** los límites de plausibilidad de cada llave de POLICY que `criteria.js` ya declara (margen, carga, rotación, cobertura); las demás solo exigen un valor positivo */
const _limitesDe = (llave) => { const c = Object.values(CRITERIA).find((x) => x.policyKey === llave); return c ? { min: c.min, max: c.max } : { min: null, max: null }; };

/** CRITERIOS_DECLARABLES: una entrada por referencia de la casa (`lexico.js`, `referencia: true`) → la llave de POLICY que fija. Se DERIVA del léxico y de `POLICY_DE_REFERENCIA`. */
export const CRITERIOS_DECLARABLES = Object.freeze(CLAVES_DE_METRICA.filter((m) => m.referencia).map((m) => Object.freeze({
  concepto: m.clave, rotulo: m.nombre, unidad: m.unidad, llave: POLICY_DE_REFERENCIA[m.clave] || null, ..._limitesDe(POLICY_DE_REFERENCIA[m.clave]),
})));
/** EL PISO DE MATERIALIDAD DE COBRANZA (Etapa 2, bloque 5 · owner 2026-10-04): un criterio de la empresa como los demás —lo declara conversando, queda pendiente hasta que lo confirma y entonces rige en la
 *  capa de conocimiento (PRI-04) «declarado por la empresa»— pero NO es una referencia del léxico ni una llave de POLICY (no lo lee el Core): vive en la tabla `businessPolicy.js:CRITERIOS_FUERA_DE_POLICY`, de donde salen
 *  su concepto, su unidad, su rango y su llave; acá solo se le da lugar. FRONTERA (owner): el piso es un criterio de materialidad —decide qué cuentas quedan como señal, bajo el piso o al borde—, NO modifica saldos,
 *  atrasos ni ninguna medición de cobranza. */
export const NOTA_FRONTERA_PISO_DE_COBRANZA = "decide qué cuentas quedan como señal, bajo el piso o al borde; no modifica ningún saldo, atraso ni medición de cobranza";
const _P = CRITERIOS_FUERA_DE_POLICY.pisoMaterialidadCobranza;
export const CRITERIO_PISO_DE_COBRANZA = Object.freeze({
  concepto: _P.concepto, rotulo: _P.rotulo, unidad: _P.unidad, llave: "pisoMaterialidadCobranza", min: _P.min, max: _P.max,
  aplicadoComo: `criterio de materialidad de cobranza (${NOTA_FRONTERA_PISO_DE_COBRANZA})`,
});
const _esPiso = (concepto) => _txt(concepto) === CRITERIO_PISO_DE_COBRANZA.concepto;
const _criterioDe = (concepto) => CRITERIOS_DECLARABLES.find((c) => c.concepto === _txt(concepto) && c.llave) || (_esPiso(concepto) ? CRITERIO_PISO_DE_COBRANZA : null);
/** ¿el concepto es una referencia de la casa con llave de POLICY? (un criterio con lugar en la Entrega) */
export const esReferenciaDeLaCasa = (concepto) => !!_criterioDe(concepto);

/** las unidades que NO tienen escala que inferir (porcentaje, puntos, días, múltiplos, conteos): una cifra en ellas es la misma cifra donde sea. El dinero no está acá: su valor depende de la moneda y de la escala. */
const UNIDADES_SIN_ESCALA = Object.freeze(["pct", "pp", "days", "ratio", "count"]);
const _normUnidad = (u) => (_txt(u) === "pp" ? "pct" : _txt(u));   // puntos y porcentaje se contrastan como lo que son: una diferencia de porcentajes

/** comparabilidad(declarado, medido) → { comparable, motivo? } · LA REGLA (decisión §7.3·58): un declarado y un medido SE COMPARAN solo si ADI puede DEMOSTRAR mismo concepto, misma unidad y, si es dinero, misma moneda
 *  y misma escala; si no, se muestran por separado y NO se restan. Cada lado = { concepto, unidad, moneda?, escala? }. La escala jamás se infiere (ley «símbolo declarado sí, escala JAMÁS»): solo cuenta la que
 *  AMBOS lados declaran explícitamente. Sin esa demostración, el dinero no se compara. */
export function comparabilidad(declarado, medido) {
  const d = declarado && typeof declarado === "object" ? declarado : null, m = medido && typeof medido === "object" ? medido : null;
  if (!d || !m) return { comparable: false, motivo: "falta uno de los dos lados" };
  if (!d.concepto || _txt(d.concepto) !== _txt(m.concepto)) return { comparable: false, motivo: "no son el mismo concepto" };
  if (!d.unidad || _normUnidad(d.unidad) !== _normUnidad(m.unidad)) return { comparable: false, motivo: "no están en la misma unidad" };
  if (_normUnidad(d.unidad) !== "money") return UNIDADES_SIN_ESCALA.includes(_normUnidad(d.unidad)) ? { comparable: true } : { comparable: false, motivo: "la unidad no tiene una forma comparable demostrada" };
  if (!_txt(d.moneda) || !_txt(m.moneda)) return { comparable: false, motivo: "la moneda no está declarada de los dos lados" };
  if (_txt(d.moneda) !== _txt(m.moneda)) return { comparable: false, motivo: "no son la misma moneda" };
  if (!_txt(d.escala) || !_txt(m.escala)) return { comparable: false, motivo: "la escala no está declarada de los dos lados (ADI no la infiere)" };
  if (_txt(d.escala) !== _txt(m.escala)) return { comparable: false, motivo: "no son la misma escala" };
  return { comparable: true };
}

/** insumoDeCalculo({ metrica, medido?, declarado? }) → { usa: "medido"|"declarado"|null, valor?, origen?, procedencia?, etiquetaDeOrigen?, declaradoAlLado?, motivo? } · LA SEGUNDA REGLA (decisión §7.3·58): un declarado NO es
 *  «nunca» un insumo de cálculo: participa solo si el contrato de ESA métrica lo admite explícitamente (`metricRegistry.js:admiteDeclarado`, por defecto falso), con su procedencia y SIN sustituir silenciosamente un
 *  medido (si hay un medido, rige el medido y el declarado queda AL LADO). Hoy ninguna métrica lo admite: nada cambia. `metrica` es la clave del contrato. */
export function insumoDeCalculo({ metrica, medido = null, declarado = null } = {}) {
  const hayMedido = !!medido && medido.valor != null && Number.isFinite(Number(medido.valor));
  const alLado = declarado ? { valor: declarado.valor, origen: ORIGEN_DECLARADO, procedencia: declarado.procedencia || null } : null;
  if (hayMedido) return { usa: "medido", valor: Number(medido.valor), origen: "medido", ...(alLado ? { declaradoAlLado: alLado, motivo: "un declarado nunca sustituye a un medido: queda al lado, con su origen" } : {}) };
  if (!declarado) return { usa: null, motivo: "no hay medido ni declarado" };
  if (!admiteDeclarado(metrica)) return { usa: null, declaradoAlLado: alLado, motivo: `el contrato de la métrica «${metrica}» no admite un declarado en el cálculo` };
  return { usa: "declarado", valor: Number(declarado.valor), origen: ORIGEN_DECLARADO, procedencia: declarado.procedencia || null, etiquetaDeOrigen: etiquetaDeProcedencia(declarado.procedencia) };
}

/** HECHOS_DECLARABLES: las métricas del léxico (no las referencias) con dueño de dominio y una unidad cuya escala no se infiere. (El dinero se declara y se queda en la memoria mientras el dato declarado no traiga su
 *  moneda y su escala: `comparabilidad`.) */
export const HECHOS_DECLARABLES = Object.freeze(CLAVES_DE_METRICA.filter((m) => !m.referencia && m.dominio && UNIDADES_SIN_ESCALA.includes(m.unidad)).map((m) => Object.freeze({ concepto: m.clave, rotulo: m.nombre, unidad: m.unidad, dominio: m.dominio })));
const _hechoDe = (concepto) => HECHOS_DECLARABLES.find((h) => h.concepto === _txt(concepto)) || null;
const _metricaDe = (concepto) => CLAVES_DE_METRICA.find((m) => m.clave === _txt(concepto)) || null;
/** El PLAZO DE COBRO (opción A): un hecho declarado que la Entrega MUESTRA y que la pregunta abierta de cobranza CITA, sin contraparte medida y sin cálculo propio. No es una métrica del léxico (no hay un «plazo de cobro»
 *  medido con qué contrastarlo): su lugar es este, y si algún día se mide el atraso contra el plazo pactado será una métrica explícita nueva. */
export const PLAZO_DE_COBRO = Object.freeze({ concepto: "plazo_de_cobro", rotulo: "Plazo de cobro", unidad: "days", dominio: "cobranza" });
const _esPlazo = (concepto) => _txt(concepto) === PLAZO_DE_COBRO.concepto;

/** declarable() → lo que el anfitrión puede declarar con lugar en la Entrega, con la forma exacta del aporte (para `conocerEmpresa`). */
export function declarable() {
  return {
    criterios: [...CRITERIOS_DECLARABLES.filter((c) => c.llave), CRITERIO_PISO_DE_COBRANZA].map((c) => ({
      concepto: c.concepto, rotulo: c.rotulo, unidad: c.unidad, ...(c.min != null ? { min: c.min, max: c.max } : {}),
      ...(_esPiso(c.concepto) ? { nota: `Es un criterio de materialidad: ${NOTA_FRONTERA_PISO_DE_COBRANZA}.` } : {}),
      comoDeclarar: { clase: "criterio", concepto: c.concepto, valor: { raw: "<número>", unidad: c.unidad } },
    })),
    hechos: HECHOS_DECLARABLES.map((h) => ({ concepto: h.concepto, rotulo: h.rotulo, unidad: h.unidad, dominio: h.dominio, comoDeclarar: { clase: "hecho", concepto: h.concepto, entidad: "<la entidad, o ninguna si es del negocio>", valor: { raw: "<número>", unidad: h.unidad } } })),
    /* el plazo de cobro (opción A): se muestra declarado y la pregunta abierta de cobranza de esa cuenta lo cita; no cambia ningún cálculo */
    citables: [{ concepto: PLAZO_DE_COBRO.concepto, rotulo: PLAZO_DE_COBRO.rotulo, unidad: PLAZO_DE_COBRO.unidad, dominio: PLAZO_DE_COBRO.dominio, comoDeclarar: { clase: "hecho", concepto: PLAZO_DE_COBRO.concepto, entidad: "<la cuenta, o ninguna si es del negocio>", valor: { raw: "<número>", unidad: PLAZO_DE_COBRO.unidad } } }],
    uso: [
      `Un criterio es un umbral de toda la empresa (sin entidad ni período): al confirmarse, la Entrega lo usa y lo muestra «${ETIQUETA_ORIGEN[ORIGEN.EMPRESA]}». Un hecho se muestra declarado AL LADO de lo medido por ADI de la misma métrica y la misma entidad; si no coinciden, se declara la diferencia: lo declarado nunca reemplaza lo medido.`,
      "El dinero declarado no se compara con lo medido (solo se compara lo que ADI puede demostrar que es el mismo concepto, la misma unidad, la misma moneda y la misma escala; la escala no se infiere) y lo que no esté en esta lista se queda en la memoria de la empresa sin usarse en la Entrega.",
    ],
  };
}

/* ═══ 2 · ¿DÓNDE TIENE LUGAR UN APORTE? (al declararlo y al leerlo de la memoria) ═══════════════════════════════════════════ */
/** validarCriterio({ concepto, valor, unidad, entidad, periodo }) → { ok, llave?, valorNumerico?, motivo? } · la validación TIPADA de un criterio con lugar: número finito, la unidad de la referencia (o ninguna), dentro de su rango, y para toda la empresa. */
export function validarCriterio({ concepto, raw, unidad = null, entidad = null, periodo = null, eje = null }) {
  const c = _criterioDe(concepto);
  if (!c) return { ok: false, motivo: `«${concepto}» no es una referencia de la casa` };
  const v = _num(raw);
  if (!Number.isFinite(v)) return { ok: false, motivo: `el criterio «${c.concepto}» (${c.rotulo}) necesita un valor numérico (${c.unidad}); recibió algo que no es un número` };
  if (unidad != null && unidad !== "" && _txt(unidad) !== c.unidad) return { ok: false, motivo: `el criterio «${c.concepto}» (${c.rotulo}) se declara en ${c.unidad}; recibió «${unidad}»` };
  if (!(v > 0) || (c.min != null && (v < c.min || v > c.max))) return { ok: false, motivo: `el valor ${v} no es plausible para «${c.concepto}» (${c.rotulo}): ${c.min != null ? `se declara entre ${c.min} y ${c.max} (${c.unidad})` : `se declara un número mayor que cero (${c.unidad})`}` };
  if (entidad || periodo || eje) return { ok: false, motivo: `el criterio «${c.concepto}» (${c.rotulo}) vale para toda la empresa: no se declara con una entidad, un eje ni un período` };
  return { ok: true, llave: c.llave, valorNumerico: v, unidad: c.unidad, rotulo: c.rotulo };
}

/** aplicadoComoDe(criterio, { conocimientoActivo }) → cómo se dice, en `declarado.criterios`, a qué se aplicó un criterio vigente: «umbral de la empresa» (los de siempre) o, el piso de cobranza, «criterio de materialidad de cobranza (…)»; con la capa de conocimiento apagada, que no se aplica a nada hoy. */
export function aplicadoComoDe(c, { conocimientoActivo = true } = {}) {
  if (!c || !c.aplicadoComo) return "umbral de la empresa";
  return conocimientoActivo === false ? `criterio de materialidad de cobranza declarado (sin efecto hoy: la capa de conocimiento del oficio no está activa; ${NOTA_FRONTERA_PISO_DE_COBRANZA})` : c.aplicadoComo;
}

/** lugarDeAporte(entendido) → { enLaEntrega, como?, motivo?, validos? } · dónde se usaría lo que se acaba de declarar (cuando se CONFIRME): lo dice al declararlo, nunca después. */
export function lugarDeAporte(e, { conocimientoActivo = true } = {}) {
  if (!e || typeof e !== "object") return { enLaEntrega: false, motivo: "sin aporte" };
  const clase = _txt(e.clase), concepto = _txt(e.concepto);
  if (clase === "criterio") {
    const c = _criterioDe(concepto);
    /* el piso de cobranza lo lee SOLO la capa de conocimiento del oficio (PRI-04): con esa capa apagada no se aplica a nada, y decir «la Entrega lo usa» sería una promesa falsa */
    if (c && _esPiso(concepto) && conocimientoActivo === false) return { enLaEntrega: false, motivo: `queda en la memoria de la empresa: el piso de materialidad de cobranza lo usa la capa de conocimiento del oficio, que hoy no está activa; cuando lo esté, regirá «${ETIQUETA_ORIGEN[ORIGEN.EMPRESA]}». Es un criterio de materialidad: ${NOTA_FRONTERA_PISO_DE_COBRANZA}` };
    if (c && _esPiso(concepto)) return { enLaEntrega: true, como: `criterio de materialidad de cobranza (${c.rotulo}): al confirmarse, la Entrega lo usa y lo muestra «${ETIQUETA_ORIGEN[ORIGEN.EMPRESA]}»; ${NOTA_FRONTERA_PISO_DE_COBRANZA}` };
    if (c) return { enLaEntrega: true, como: `umbral de la empresa (${c.rotulo}): al confirmarse, la Entrega lo usa y lo muestra «${ETIQUETA_ORIGEN[ORIGEN.EMPRESA]}»` };
    return { enLaEntrega: false, motivo: "este criterio no es una de las referencias que ADI usa en la Entrega: queda en la memoria de la empresa, sin aplicarse", validos: [...CRITERIOS_DECLARABLES.filter((c2) => c2.llave), CRITERIO_PISO_DE_COBRANZA].map((c2) => c2.concepto) };
  }
  if (clase === "hecho") {
    if (_criterioDe(concepto)) return { enLaEntrega: false, motivo: `«${concepto}» es una referencia de la empresa: se declara con la clase «criterio», no como un hecho`, validos: ["criterio"] };
    if (_esPlazo(concepto)) return { enLaEntrega: true, como: `se muestra declarado en «Lo declarado» (${PLAZO_DE_COBRO.rotulo}) con su origen, y la pregunta abierta de cobranza de esa cuenta («¿plazo pactado o atraso real?») lo cita; no cambia ningún cálculo: el saldo vencido sigue siendo el medido` };
    const h = _hechoDe(concepto);
    if (h) return { enLaEntrega: true, como: `se muestra declarado al lado de lo medido de la misma métrica (${h.rotulo}) y la misma entidad; si no coinciden, se declara la diferencia — nunca reemplaza lo medido` };
    const m = _metricaDe(concepto);
    if (m && m.unidad === "money") return { enLaEntrega: false, motivo: "el dinero declarado no se compara con lo medido mientras ADI no pueda demostrar la misma moneda y la misma escala (ADI no infiere la escala; lo declarado hoy no las trae): queda en la memoria de la empresa, sin usarse en la Entrega" };
    return { enLaEntrega: false, motivo: "este hecho no es una métrica que ADI mida con la que se pueda contrastar: queda en la memoria de la empresa, sin usarse en la Entrega", validos: HECHOS_DECLARABLES.map((h2) => h2.concepto) };
  }
  if (clase === "documento") return { enLaEntrega: false, motivo: "lo que se toma de un documento queda en la memoria de la empresa: la Entrega todavía no lo usa" };
  return { enLaEntrega: false, motivo: "este aporte no tiene lugar en la Entrega" };
}

/* ═══ 3 · LO VIGENTE DE LA MEMORIA → LO QUE ENTRA ═════════════════════════════════════════════════════════════════════════ */
const _sello = (f) => { const c = f && f.confirmacion; return c && typeof c === "object" ? { por: c.por || null, cuando: c.cuando || null, medio: c.medio || null } : null; };

/** procedenciaDeFila(fila) → { origen, fuente, confirmado } · el ACTO DE DECLARACIÓN de una fila VIGENTE de la memoria (decisión §7.3·58): la empresa la declaró y la confirmó, así que es «declarado por la empresa»; si la fila
 *  se tomó de un documento (origen «documento», o un `documento` con nombre) y la empresa la confirmó adoptar, pasa a declarado CONSERVANDO el rastro («declarado por la empresa, tomado de <documento>»). Solo se llama con filas
 *  vigentes: lo pendiente no entra, así que nunca hay un «según <documento>, sin confirmar» que usar acá. */
export function procedenciaDeFila(f) {
  const d = f && f.documento && typeof f.documento === "object" ? f.documento : null;
  const nombre = d && typeof d.nombre === "string" && d.nombre.trim() ? d.nombre.trim() : null;
  const deDocumento = _txt(f && f.origen) === "documento" || !!nombre;
  return { origen: ORIGEN.EMPRESA, fuente: deDocumento ? { tipo: "documento", detalle: nombre } : { tipo: "chat", detalle: null }, confirmado: true };
}
/** procedenciasDeCriterios(criterios) → { [llaveDePolicy]: { origen:"documento", fuente, confirmado:true } } · el rastro de los criterios que se tomaron de un documento, para el perfil (`conCriteriosDeEmpresa`): el resto se declaró en el chat. */
export function procedenciasDeCriterios(criterios) {
  const out = {};
  for (const c of Array.isArray(criterios) ? criterios : []) if (c && c.procedencia && c.procedencia.fuente && c.procedencia.fuente.tipo === "documento" && c.procedencia.fuente.detalle) out[c.llave] = { origen: "documento", fuente: c.procedencia.fuente.detalle, confirmado: true };
  return out;
}

/** clasificarLoDeclarado(filas) → { criterios, hechos, plazos } · `filas` = las filas de la memoria de la empresa (cualquier estado): SOLO cuenta lo VIGENTE (confirmado) — un pendiente, un retirado o un omitido
 *  NUNCA entra. `criterios` = los que tienen lugar y valen (uno por llave: el más reciente), `hechos` = los que se contrastan con lo medido, `plazos` = el plazo de cobro declarado (se muestra y lo cita la pregunta abierta; no se
 *  contrasta). Cada uno lleva su `procedencia` ({ origen, fuente, confirmado }). Lo que no tiene lugar no se lista: se queda en la memoria. */
export function clasificarLoDeclarado(filas) {
  const vigentes = (Array.isArray(filas) ? filas : []).filter((f) => f && f.estado === "vigente" && !f.migradoDeLegado);
  const porLlave = new Map();
  const hechos = [];
  const plazos = [];
  for (const f of vigentes) {
    const clase = _txt(f.clase);
    if (clase === "criterio") {
      const c = _criterioDe(f.concepto);
      if (!c) continue;
      const v = f.valor && typeof f.valor === "object" ? f.valor : {};
      const val = validarCriterio({ concepto: f.concepto, raw: v.raw, unidad: v.unidad, entidad: f.entidad, periodo: f.periodo, eje: f.eje });
      if (!val.ok) continue;
      const previo = porLlave.get(c.llave);
      if (previo && String(previo.declaradoEn || "") >= String(f.declaradoEn || "")) continue;
      porLlave.set(c.llave, { id: f.id, concepto: c.concepto, rotulo: c.rotulo, llave: c.llave, valor: val.valorNumerico, unidad: c.unidad, ...(c.aplicadoComo ? { aplicadoComo: c.aplicadoComo } : {}), origen: ORIGEN_DECLARADO, procedencia: procedenciaDeFila(f), sello: _sello(f), declaradoEn: f.declaradoEn || null });
    } else if (clase === "hecho") {
      const v = f.valor && typeof f.valor === "object" ? f.valor : {};
      const raw = _num(v.raw);
      /* el PLAZO DE COBRO (opción A): se muestra y la pregunta abierta de cobranza lo cita; solo en días; de la cuenta que dice la fila (o del negocio si no dice ninguna) */
      if (_esPlazo(f.concepto)) {
        if (!Number.isFinite(raw) || !(raw > 0) || (v.unidad != null && v.unidad !== "" && _txt(v.unidad) !== PLAZO_DE_COBRO.unidad)) continue;
        plazos.push({ id: f.id, concepto: PLAZO_DE_COBRO.concepto, rotulo: PLAZO_DE_COBRO.rotulo, unidad: PLAZO_DE_COBRO.unidad, entidad: f.entidad ? String(f.entidad) : null, valor: raw, origen: ORIGEN_DECLARADO, procedencia: procedenciaDeFila(f), sello: _sello(f), declaradoEn: f.declaradoEn || null });
        continue;
      }
      let h = _hechoDe(f.concepto);
      let moneda = null, escala = null;
      /* el DINERO declarado entra solo si lo declarado trae su moneda Y su escala (nunca se infieren): sin ambas, se queda en la memoria */
      if (!h) {
        const m = _metricaDe(f.concepto);
        if (m && !m.referencia && m.dominio && m.unidad === "money" && _txt(v.moneda) && _txt(v.escala)) { h = { concepto: m.clave, rotulo: m.nombre, unidad: "money", dominio: m.dominio }; moneda = String(v.moneda).trim(); escala = String(v.escala).trim(); }
      }
      if (!h) continue;
      if (!Number.isFinite(raw)) continue;
      if (v.unidad != null && v.unidad !== "" && _txt(v.unidad) !== h.unidad) continue;   // otra unidad: no se compara (jamás se convierte)
      hechos.push({ id: f.id, concepto: h.concepto, rotulo: h.rotulo, unidad: h.unidad, entidad: f.entidad ? String(f.entidad) : null, periodo: f.periodo ? String(f.periodo) : null, valor: raw, ...(moneda ? { moneda, escala } : {}), origen: ORIGEN_DECLARADO, procedencia: procedenciaDeFila(f), sello: _sello(f), declaradoEn: f.declaradoEn || null });
    }
  }
  return { criterios: [...porLlave.values()], hechos, plazos };
}

/* ═══ 4 · LO DECLARADO AL LADO DE LO MEDIDO ═══════════════════════════════════════════════════════════════════════════════ */
/** el hecho MEDIDO que la Entrega ya sirve para (métrica, entidad, unidad): una cita directa (un solo insumo, origen medido) del libro de hechos de la Entrega — la misma llave (clave · sujeto · unidad)
 *  con la que el libro detecta una discrepancia entre orígenes (`notario/hechos.js`). */
function _medidoDe(libro, h) {
  const sujetoDeclarado = h.entidad ? normalizar(h.entidad) : null;
  for (const H of (libro && Array.isArray(libro.hechos) ? libro.hechos : [])) {
    if (!H || !H.ok || !(H.tipo === "ref" || H.tipo === "cifra") || !(H.claves && H.claves.has && H.claves.has(h.concepto))) continue;
    if (!H.origen || H.origen.titular !== "medido" || !Array.isArray(H.composicion) || H.composicion.length !== 1) continue;
    const n = H.numeros && H.numeros[H.numeros.length - 1];
    if (!n || !Number.isFinite(n.raw)) continue;
    const u = n.unidad === "pp" ? "pct" : n.unidad;
    if (u !== (h.unidad === "pp" ? "pct" : h.unidad)) continue;
    const sujeto = (H.roles && H.roles.sujetos && H.roles.sujetos[0]) || "negocio";
    if (sujetoDeclarado === null ? normalizar(sujeto) !== "negocio" : normalizar(sujeto) !== sujetoDeclarado) continue;
    return { id: H.id, raw: n.raw, unidad: n.unidad, texto: formatoDeLaCasa(n.raw, n.unidad) || n.texto };   // la forma de la casa, la misma con que la Entrega escribe una cifra medida
  }
  return null;
}
const _entidadesResueltas = (p) => (Array.isArray(p && p.entidades) ? p.entidades : []).map((e) => normalizar(typeof e === "string" ? e : (e && e.nombre) || ""));
/** ¿alguna parte resuelta de la consulta PIDIÓ esa métrica (para esa entidad, o sin entidad)? — un declarado en juego aunque ADI no tenga una cifra medida con la que contrastarlo */
function _laPidio(resolucion, h) {
  const e = h.entidad ? normalizar(h.entidad) : null;
  /* un declarado SIN entidad es del negocio: solo está en juego si la parte pidió esa métrica SIN entidades (del negocio); uno con entidad, si la parte la pidió para esa entidad */
  return (Array.isArray(resolucion && resolucion.partes) ? resolucion.partes : []).some((p) => (p.estado === "resuelta" || p.estado === "parcial") && Array.isArray(p.conceptos) && p.conceptos.includes(h.concepto) && (e === null ? _entidadesResueltas(p).length === 0 : _entidadesResueltas(p).includes(e)));
}

/** contrastarHechos({ hechos, libro, resolucion, periodos, marcoDeLoMedido? }) → [{ ...declarado, estado: "coincide"|"difiere"|"sin_medido"|"no_comparable", medido?, diferencia? }]
 *  Solo los que están EN JUEGO en esta Entrega (hay un medido de lo mismo, o una parte lo pidió); un declarado con período no se estira a otro (solo vale si
 *  el período del Marco de la Entrega es EXACTAMENTE ese: `periodos` = el texto y el rango del período del Marco). COMPARABILIDAD (§7.3·58): se resta solo si `comparabilidad` lo demuestra
 *  (mismo concepto, misma unidad y, en dinero, la misma moneda y escala DECLARADAS de los dos lados: `marcoDeLoMedido` = { moneda, escala } de lo medido, si el contrato de lo medido las declara);
 *  si no, `no_comparable`: las dos cifras se muestran por separado, sin restar. */
export function contrastarHechos({ hechos, libro, resolucion, periodos = [], marcoDeLoMedido = null }) {
  const out = [];
  const delMarco = (Array.isArray(periodos) ? periodos : [periodos]).filter((p) => typeof p === "string" && p.trim()).map((p) => normalizar(p));
  for (const h of Array.isArray(hechos) ? hechos : []) {
    if (h.periodo && !delMarco.includes(normalizar(h.periodo))) continue;
    const m = _medidoDe(libro, h);
    if (!m) { if (_laPidio(resolucion, h)) out.push({ ...h, estado: "sin_medido", medido: null, diferencia: null }); continue; }
    const comp = comparabilidad({ concepto: h.concepto, unidad: h.unidad, moneda: h.moneda, escala: h.escala }, { concepto: h.concepto, unidad: m.unidad, moneda: marcoDeLoMedido && marcoDeLoMedido.moneda, escala: marcoDeLoMedido && marcoDeLoMedido.escala });
    if (!comp.comparable) { out.push({ ...h, estado: "no_comparable", medido: { valor: m.raw, texto: m.texto, hecho: m.id, origen: "medido" }, diferencia: null, motivoNoComparable: comp.motivo }); continue; }
    const mismo = formatoDeLaCasa(h.valor, h.unidad === "pp" ? "pct" : h.unidad) === formatoDeLaCasa(m.raw, m.unidad === "pp" ? "pct" : m.unidad);
    const d = h.valor - m.raw;
    out.push({
      ...h, estado: mismo ? "coincide" : "difiere",
      medido: { valor: m.raw, texto: m.texto, hecho: m.id, origen: "medido" },
      diferencia: mismo ? null : { valor: d, texto: formatoDeLaCasa(Math.abs(d), h.unidad === "pct" ? "pp" : h.unidad), sentido: d > 0 ? "declarado_mayor" : "declarado_menor" },
    });
  }
  return out;
}

/** lo que va JUNTO al bloque `declarado` de la respuesta (un campo nuevo: no toca la cabecera de uso de siempre) */
export const USO_DE_LO_DECLARADO = Object.freeze([
  `Lo ${ETIQUETA_ORIGEN[ORIGEN.EMPRESA]} se dice como declarado (con su origen): nunca se presenta como medido por ADI.`,
  "Si un hecho declarado no coincide con lo medido, se dicen las dos cifras, cada una con su origen, y la diferencia; ADI no sustituye lo medido por lo declarado.",
  "Los criterios declarados rigen en todo lo que ADI calcula para esta empresa; la Entrega los muestra con su origen donde los usa.",
]);

/* ═══ 5 · EL TEXTO (tercera persona: la Entrega no le habla a nadie) ═════════════════════════════════════════════════════ */
const _quien = (h) => [h.entidad, h.rotulo].filter(Boolean).join(" · ");
const _confirmado = (s) => (s && _fecha(s.cuando) ? ` (confirmado el ${_fecha(s.cuando)})` : " (confirmado)");

/** la procedencia de lo declarado, de la tabla única (con el rastro del documento si lo hubo); un declarado sin procedencia anotada es el de siempre: declarado por la empresa */
const _etiquetaDe = (x) => etiquetaDeProcedencia(x && x.procedencia) || ETIQUETA_ORIGEN[ORIGEN.EMPRESA];
const _cifraDe = (h) => formatoDeReferencia(h.valor, h.unidad) || formatoDeLaCasa(h.valor, h.unidad);

/** plazosCitados({ plazos, entrega }) → [{ ...plazo, citadoPor: { pregunta, entidad } }] · el plazo de cobro declarado que la PREGUNTA ABIERTA de cobranza de esta Entrega cita: la pregunta abierta de «saldo vencido» de una cuenta
 *  (`entrega.paraSuJuicio`, el ítem tipado `_preguntaAbierta`, `sobre.metrica` + `sobre.entidad`) y el plazo declarado de ESA cuenta (si no hay uno suyo, el del negocio). Sin pregunta abierta de cobranza no hay nada que citar. No toca la Entrega. */
export function plazosCitados({ plazos, entrega }) {
  const preguntas = (entrega && Array.isArray(entrega.paraSuJuicio) ? entrega.paraSuJuicio : []).filter((p) => p && p._preguntaAbierta === true && p.sobre && p.sobre.metrica === "saldo vencido" && p.sobre.entidad);
  const out = [];
  for (const q of preguntas) {
    const e = normalizar(String(q.sobre.entidad));
    const propio = (plazos || []).find((p) => p.entidad && normalizar(p.entidad) === e);
    const delNegocio = (plazos || []).find((p) => !p.entidad);
    const p = propio || delNegocio;
    if (p && !out.some((o) => o.id === p.id && o.citadoPor.entidad === q.sobre.entidad)) out.push({ ...p, citadoPor: { pregunta: q.pregunta, entidad: String(q.sobre.entidad) } });
  }
  return out;
}

/** textoDeLoDeclarado({ hechos, plazos?, usar }) → string | "" · el bloque que va al final del texto de la Entrega: lo declarado y lo medido, cada uno con su origen, y la diferencia cuando no coinciden; y el plazo de cobro que la pregunta abierta cita. */
export function textoDeLoDeclarado({ hechos, plazos = [], usar = null }) {
  const lineas = [];
  for (const h of hechos || []) {
    const declarado = `${_quien(h)}: ${_cifraDe(h)}, ${_etiquetaDe(h)}${_confirmado(h.sello)}`;
    if (h.estado === "no_comparable") lineas.push(`- ${declarado}. Medido por ADI: ${h.medido.texto}. No se comparan: ${h.motivoNoComparable}; las dos cifras se muestran por separado, sin restar.`);
    else if (h.estado === "sin_medido") lineas.push(`- ${declarado}. ADI no tiene en esta Entrega una cifra medida de lo mismo con la que contrastarlo.`);
    else if (h.estado === "coincide") lineas.push(`- ${declarado}. Coincide con lo medido por ADI (${h.medido.texto}).`);
    else lineas.push(`- ${declarado}. Medido por ADI: ${h.medido.texto}. No coinciden: ${h.diferencia.sentido === "declarado_mayor" ? "lo declarado supera" : "lo declarado queda por debajo de"} lo medido por ${h.diferencia.texto}. Las dos cifras se muestran con su origen y ADI no sustituye lo medido por lo declarado.`);
  }
  for (const p of plazos || []) {
    const cuenta = p.entidad ? `${p.entidad} · ` : "";
    lineas.push(`- ${cuenta}${p.rotulo}: ${_cifraDe(p)}, ${_etiquetaDe(p)}${_confirmado(p.sello)}. Referencia para la pregunta abierta sobre la deuda de ${p.citadoPor.entidad} («¿plazo pactado o atraso real?»): ADI no calcula el atraso contra este plazo ni cambia ninguna cifra; el saldo vencido de esta Entrega es el medido.`);
  }
  if (!lineas.length) return "";
  /* un declarado nunca sustituye a un medido: con `usar: "declarado"` rige el medido (`insumoDeCalculo`: solo un declarado que el contrato de SU métrica admita, y sin medido, entraría en un cálculo) */
  const pidioDeclarado = usar === "declarado" && (hechos || []).some((h) => h.estado === "difiere" && insumoDeCalculo({ metrica: h.concepto, medido: h.medido, declarado: h }).usa === "medido");
  return `**Lo ${ETIQUETA_ORIGEN[ORIGEN.EMPRESA]} y confirmado.**\n${lineas.join("\n")}${pidioDeclarado ? "\n- Se pidió usar lo declarado: ADI no calcula sobre lo declarado ni lo pone en lugar de lo medido; las cifras de esta Entrega son las medidas y lo declarado figura al lado, con su origen." : ""}`;
}

/* ═══ 6 · LA CITA: LO QUE UNA ENTREGA ANTERIOR ENTREGÓ ════════════════════════════════════════════════════════════════════ */
/** antecedentesDe(contextoResuelto, { versionActiva }) → [{ id, tipo, entrega, hechos?|hecho?|universo?, cargaActual, cargaCambio }] · exactamente lo que `resolverContexto` trajo del libro, más una sola cosa que se DECLARA: si la carga con que se entregó no es la activa. */
export function antecedentesDe(contextoResuelto, { versionActiva = null } = {}) {
  return (Array.isArray(contextoResuelto) ? contextoResuelto : []).map((r) => {
    const cambio = Boolean(r.entrega && r.entrega.versionId && versionActiva && r.entrega.versionId !== versionActiva);
    const base = { id: r.id, tipo: r.tipo, entrega: r.entrega, cargaActual: versionActiva || null, cargaCambio: cambio };
    if (r.tipo === "entrega") return { ...base, hechos: r.hechos, universos: r.universos };
    if (r.tipo === "hecho") return { ...base, hecho: r.hecho };
    if (r.tipo === "puesto") return { ...base, universo: r.universo, puesto: r.puesto, entidad: r.entidad, lente: r.lente };   /* ensayo 11: el puesto `E<n>.u<k>.<j>` de una prioridad ordenada */
    return { ...base, universo: r.universo };
  });
}
const _lineaDeHecho = (h) => `- ${h.id} · ${[h.sujeto, h.metrica].filter(Boolean).join(" · ") || "hecho"}: ${h.valor != null ? h.valor : "sin valor"}${h.origen ? ` (${h.origen})` : ""}`;
const _lineaDeUniverso = (u, etiqueta) => `- ${etiqueta} · universo${u.texto ? `: ${u.texto}` : ""}${Array.isArray(u.entidades) && u.entidades.length ? ` (${u.entidades.join(", ")})` : ""}`;

/** textoDeAntecedentes(antecedentes) → string | "" · una sección por cita: la Entrega, su carga y su fecha, y lo que entregó tal cual (no recalculado). */
export function textoDeAntecedentes(antecedentes) {
  const secciones = [];
  for (const a of antecedentes || []) {
    const e = a.entrega || {};
    const periodo = e.periodo && typeof e.periodo === "object" ? (e.periodo.texto || null) : (e.periodo || null);
    const cabeza = `**Antecedente: lo que la Entrega E${e.n} ya entregó** (${a.id}). Carga ${e.versionId || "sin versión declarada"}${e.entregadaEn ? `, entregada el ${e.entregadaEn}` : ""}${periodo ? `; período: ${periodo}` : ""}.`;
    const lineas = [];
    if (a.tipo === "entrega") {
      if (e.recortada) lineas.push(`- La Entrega E${e.n} se recortó por capacidad de la memoria de la conversación: conserva sus temas${e.temas.length ? ` (${e.temas.join(", ")})` : ""} y su carga, pero ya no sus hechos; vuelva a consultarla.`);
      else { for (const h of a.hechos || []) lineas.push(_lineaDeHecho(h)); (a.universos || []).forEach((u, k) => lineas.push(_lineaDeUniverso(u, `E${e.n}.u${k + 1}`))); }
    } else if (a.tipo === "hecho") lineas.push(_lineaDeHecho(a.hecho));
    else if (a.tipo === "puesto") lineas.push(`- ${a.id} · puesto ${a.puesto} de la prioridad por ${a.lente === "riesgo" ? "riesgo integrado" : a.lente}: ${a.entidad}`);
    else lineas.push(_lineaDeUniverso(a.universo, a.id));
    const nota = `Son las cifras tal como se entregaron entonces: ADI no las recalculó.${a.cargaCambio ? ` La carga activa ahora es ${a.cargaActual}: esas cifras no se volvieron a verificar contra ella.` : ""}`;
    secciones.push([cabeza, ...lineas, nota].join("\n"));
  }
  return secciones.join("\n\n");
}
