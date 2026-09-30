/* === src/adi/encargo/validar.js · EL VALIDADOR DEL ENCARGO (Etapa 1 · Corte 1 · owner 2026-09-25) ══════════════
 * `validarEncargo(encargo, ctx) → Resolucion`, puro, en el orden fijo de `_ADI_CONTRATO_ENCARGO_V1.md` §4.
 *
 * LA LEY QUE ESTE ARCHIVO OBEDECE (contrato §0, memoria `adi-no-desviarse-deterministico`): la comprensión del
 * lenguaje es del LLM. Este módulo NUNCA lee `encargo.preguntaOriginal` ni `Supuesto.cita` — viajan solo para
 * auditoría en el rastro, ningún `if` de acá los mira. Todo valor válido es un id EXACTO de una tabla que ya
 * existe en el Core (dominios.js, lexico.js, entityIndex.js, metricRegistry.js, assumptionRegistry.js,
 * ausencias.js, hechos.js, estados.js, glossary.js) — nunca una coincidencia difusa ni una palabra suelta.
 * PROHIBIDO (candado del gate, carnada 4): importar `dominiosDeTexto`, `claveDeMetrica` para leer texto libre,
 * `criterioDeLaPregunta`, `detectors.js`, `intentLayer.js`, o correr una regex sobre `preguntaOriginal`/`cita`.
 *
 * NUNCA SUSTITUCIÓN POR VECINO (`adi-piso-sin-modelo`): una parte inválida no anula a las demás; dentro de una
 * parte, lo válido corre y lo inválido se declara en `noResuelto` — jamás se corre con «el más parecido».
 *
 * PURO · sin I/O · sin red · determinístico: mismo tenant + misma versión de datos + mismo encargo ⇒ misma
 * Resolucion, byte a byte (no depende de nada que cambie entre llamadas salvo el catálogo del tenant activo). */
import { dominioPorId, idsActivos } from "../../config/contract/dominios.js";
import { resolveCanonical, resolveEntityRef, findCandidates, axisEntityNames, AXES } from "../oracle/entityIndex.js";
import { metricaPorClave, esReferencia } from "../notario/lexico.js";
import { validarHecho, validarUniverso } from "../notario/hechos.js";
import { ausenciasDe } from "../../config/contract/ausencias.js";
import { assumptionValid } from "../../config/contract/assumptionRegistry.js";
import { serieRealDe } from "../sentrix/capability.js";
import { CRITERIOS } from "../agente/prioridadIntegrada.js";   // SOLO el dato `CRITERIOS` (§3); nunca `criterioDeLaPregunta`
import { conjuntoConocido } from "../notario/conjuntosDeLaCasa.js";   // §7.3·11: el catálogo ESTÁTICO de conjuntos de la casa (nombre → eje) — carga · benchmark · estado, nunca una lista a mano acá
import {
  PARTES_MAX, SUPUESTOS_USUARIO_MAX, CIERRES, EJES, TIPOS_DE_PREMISA, USAR_VALORES, PROFUNDIDAD_VALORES,
  INICIATIVA_VALORES, CAMPOS_RAIZ, CAMPOS_PARTE, conceptoDeDefinicionValido, ejesConProductor, cruceBloqueadoDe, productorDe,
  sujetoDeTema, nuevoNoResuelto, nuevoAviso, resolucionVacia,
} from "./esquema.js";

const _es = (x) => x != null && typeof x === "object" && !Array.isArray(x);
const _str = (x) => typeof x === "string" && x.trim() !== "";
const _lista = (x) => (Array.isArray(x) ? x : []);

/* ── el índice liviano que `validarHecho`/`validarUniverso` (hechos.js) exigen: SOLO `resolverEntidad` y
 * `tamanoDelEje` (lo único que esas dos funciones tocan de su parámetro `I` — confirmado leyendo hechos.js). Se
 * construye sobre `entityIndex.js` (Fase 3, el índice O(1) del Core), nunca sobre una evidencia de boleta: esta
 * etapa valida FORMA, no verifica veredictos (eso lo hace la Entrega en la etapa 1, con el libro real). */
function _indiceLigero() {
  return {
    resolverEntidad(nombre) {
      if (nombre == null || nombre === "negocio") return null;
      const r = resolveEntityRef(nombre);
      return r.estado === "resuelto" ? { nombre: r.nombre, eje: r.dimension } : null;
    },
    tamanoDelEje(eje) {
      const n = axisEntityNames(eje).length;
      return n || null;
    },
  };
}

/* ── resolución de una entidad declarada en el encargo (§4e) ──────────────────────────────────────────────────
 * Nunca fuzzy para RESOLVER (solo se ofrece como alternativa tipada, `findCandidates`). */
function _resolverEntidadRef(ref) {
  const nombre = ref && ref.nombre;
  if (!_str(nombre)) return { estado: "invalida" };
  if (ref.eje != null) {
    if (!EJES.includes(ref.eje)) return { estado: "eje_desconocido" };
    const canon = resolveCanonical(ref.eje, nombre);
    if (canon) return { estado: "resuelta", nombre: canon, eje: ref.eje };
    // ¿existe en OTRO eje? → entidad_eje_incompatible, nunca se sirve como si fuera del eje pedido
    for (const otro of AXES) {
      if (otro === ref.eje) continue;
      const c2 = resolveCanonical(otro, nombre);
      if (c2) return { estado: "eje_incompatible", nombre: c2, eje: otro };
    }
    // RC13 (owner, diagnostico.md §RC13): acá el eje YA es explícito y estructurado (Entidad.eje, nunca un
    // fragmento de texto libre) — el opt-in `ejeChico` es seguro: con un eje de pocos miembros, ofrecerlos TODOS
    // como alternativa es la respuesta correcta («Mayorista» contra un `canal` de solo 2 miembros).
    return { estado: "inexistente", candidatos: findCandidates(ref.eje, nombre, { ejeChico: true }) };
  }
  const r = resolveEntityRef(nombre);
  if (r.estado === "resuelto") return { estado: "resuelta", nombre: r.nombre, eje: r.dimension };
  if (r.estado === "ambiguo") return { estado: "ambigua", opciones: r.opciones };
  return { estado: "inexistente", candidatos: r.candidatos || [] };
}

/* ── conceptos (§4f): CLAVES_DE_METRICA ∩ DOMINIOS_REGISTRO[tema].metricas, luego productor por (concepto, eje) ──
 * R-EJE-INVALIDO-CONCEPTO-VALIDO (diagnóstico v6, MATERIAL): `eje == null` tiene DOS orígenes distintos — «nunca
 * se declaró un eje» (parte sin entidades, sin Parte.eje, sin sujeto: acá sí «no se puede juzgar productor todavía»
 * y el concepto pasa) y «se declaró un Parte.eje EXPLÍCITO que resultó inválido» (ya cae a `eje_no_soportado` en el
 * llamador, `validar.js` línea ~310). El segundo origen NO es «válido»: dejarlo pasar colaba la parte como
 * `resuelta` pese a su propio `eje_no_soportado` ya declarado, y `componerEntrega` terminaba resolviendo una
 * dimensión que no existe. `ejeExplicitoInvalido` distingue los dos orígenes; el llamador nunca duplica el
 * `noResuelto` de eje (ya lo declaró una vez) y solo evita contar el concepto como válido. */
function _validarConcepto(clave, tema, eje, ejeExplicitoInvalido = false) {
  const m = metricaPorClave(clave);
  if (!m) return { estado: "desconocido" };
  if (m.dominio != null && m.dominio !== tema) return { estado: "otro_tema", dominio: m.dominio };
  if (eje == null) return ejeExplicitoInvalido ? { estado: "eje_invalido" } : { estado: "valido" };   // sin eje resuelto todavía (parte sin entidades ni Parte.eje ni sujeto): no se puede juzgar productor
  const cruce = cruceBloqueadoDe(clave, eje);
  if (cruce) return { estado: "cruce_bloqueado", cruce };
  if (!productorDe(clave, eje)) return { estado: "sin_productor", ejes: ejesConProductor(clave) };
  return { estado: "valido" };
}

/* ── el productor de un supuesto de simulación (§3.5): depende de (tipo, tema, eje) — no hay tabla declarativa
 * en el Core para esto (assumptionRegistry.js solo declara la FORMA), así que se codifica la tabla del contrato,
 * leída de `simulateGeneral`/`simulateCarga`/`simulateCapital`/`simulateCosto` (toolContracts.js/specRetrieval.js). */
function _productorDeSupuesto(tipo, tema, eje) {
  if (tema === "comercial") {
    if ((tipo === "growth" || tipo === "price") && ["cliente", "sku", "marca", "familia"].includes(eje)) return "simulateGeneral";
    if (tipo === "margin" && ["sku", "cliente", "marca", "familia"].includes(eje)) return "simulateCosto";
    if (tipo === "carga" && eje === "cliente") return "simulateCarga";     // tipo NUEVO §7.1 (aditivo)
    if (tipo === "costo" && ["sku", "cliente", "marca", "familia"].includes(eje)) return "simulateCosto";   // tipo NUEVO §7.1
    // RETIRADO (owner 2026-09-26, CORTE 3d — «custom es jerga del sistema», error MATERIAL de la Entrega:
    // «Simulación — supuesto: custom -1%…» no dice de qué es el -1%). Ya NO se acepta «custom» en cliente/sku/
    // marca/familia como si fuera «carga»/«costo»: el tipo NUEVO §7.1 existe justo para esto — un supuesto
    // «custom» en esta forma ahora se declina en `_resolverSupuestosRaiz` (motivo `supuesto_mal_formado`, con las
    // alternativas de concepto nombrado), en vez de componer con un rótulo que la prosa no puede nombrar.
    return null;
  }
  if (tema === "inventario") {
    // «liberar el capital frenado» NO tiene un tipo nombrado nuevo (§7.1): es una acción sin parámetro numérico
    // (no hay «−1%» que nombrar en prosa, a diferencia de carga/costo) — «custom» acá nunca produjo jerga, se
    // mantiene como estaba.
    if (tipo === "custom" && eje === "sku") return "simulateCapital";
    return null;   // la simulación paramétrica de inventario (tipo "inventory") NO tiene productor (assumptionRegistry.js lo declara)
  }
  return null;   // cobranza y cualquier otro tema: ningún productor de simulación hoy
}

/* ── periodo (§4h) ──────────────────────────────────────────────────────────────────────────────────────────── */
const _ISO_MES = /^\d{4}-(0[1-9]|1[0-2])$/;
const _ISO_FECHA = /^\d{4}-\d{2}-\d{2}$/;
function _marcoVigenteDe(tema) {
  if (tema === "comercial") return "cerrado";
  if (tema === "inventario" || tema === "cobranza") return "foto";
  return "foto";
}
function _resolverPeriodo(periodo, tema, entidadCanonica) {
  const marcoVigente = _marcoVigenteDe(tema);
  if (periodo == null) return { resuelto: { tipo: "vigente", valor: null, marco: marcoVigente }, problema: null };
  if (!_es(periodo) || !["vigente", "mes", "rango"].includes(periodo.tipo)) {
    return { resuelto: { tipo: "vigente", valor: null, marco: marcoVigente }, problema: { motivo: "periodo_mal_formado" } };
  }
  if (periodo.tipo === "vigente") return { resuelto: { tipo: "vigente", valor: null, marco: marcoVigente }, problema: null };
  if (periodo.tipo === "mes" && !(_str(periodo.valor) && _ISO_MES.test(periodo.valor))) {
    return { resuelto: { tipo: "vigente", valor: null, marco: marcoVigente }, problema: { motivo: "periodo_mal_formado" } };
  }
  if (periodo.tipo === "rango") {
    const v = periodo.valor;
    const ok = _es(v) && _str(v.desde) && _str(v.hasta) && _ISO_FECHA.test(v.desde) && _ISO_FECHA.test(v.hasta);
    if (!ok) return { resuelto: { tipo: "vigente", valor: null, marco: marcoVigente }, problema: { motivo: "periodo_mal_formado" } };
  }
  // "mes"/"rango" bien formados: §7.5 — sin entidad puntual, NINGÚN productor devuelve un mes suelto (la serie
  // del negocio no declara año); con entidad, depende de `serieRealDe` (real:false en el demo → sin-periodo).
  if (!entidadCanonica) return { resuelto: { tipo: "vigente", valor: null, marco: marcoVigente }, problema: { motivo: "periodo_no_disponible" } };
  const serie = serieRealDe(entidadCanonica);
  if (!serie || !serie.real) return { resuelto: { tipo: "vigente", valor: null, marco: marcoVigente }, problema: { motivo: "periodo_no_disponible" } };
  return { resuelto: { tipo: periodo.tipo, valor: periodo.valor, marco: "serie" }, problema: null };
}

/* ── criterio (§4·2) ────────────────────────────────────────────────────────────────────────────────────────── */
const _CRITERIOS_IDS = new Set(Object.keys(CRITERIOS));
// §7.3·14 (2026-09-27) — «caja»/«liquidez» es la ÚNICA palabra reservada de tesorería (contrato §2.1, fila
// `criterio_tesoreria`; `adi-caja-no-es-cobranza`): SOLO esa reserva ofrece la alternativa «exposición de
// crédito» + `sin_datos_tesoreria`. Entender el lenguaje le toca al LLM, no al validador: un lente desconocido
// CUALQUIERA («rentabilidad», una errata) no se traduce a una lente parecida — ofrece TODAS las lentes de
// `CRITERIOS` (más abajo, `alternativas` en la raíz) para que el LLM elija, nunca la alternativa de crédito, que
// es específica de tesorería.
const _LENTE_RESERVADA_TESORERIA = /^(?:caja|liquidez)$/i;
// La referencia del usuario es válida cuando trae concepto (de REFERENCIAS_DE_LA_CASA), valor numérico y unidad (misma prueba que la rama «referencia sola»).
function _referenciaDeUsuarioValida(r) {
  return _es(r) && _str(r.concepto) && typeof r.valor === "number" && _str(r.unidad) && esReferencia(r.concepto) ? r : null;
}
function _resolverCriterio(criterio) {
  if (criterio == null) return { resuelto: { lente: "riesgo", origen: "adi", alternativa: null }, problema: null, avisoAdi: true };
  if (!_es(criterio)) return { resuelto: { lente: "riesgo", origen: "adi", alternativa: null }, problema: { motivo: "criterio_desconocido" }, avisoAdi: true };
  if (_str(criterio.lente)) {
    // §7.3·46 (v22, S47) — la lente y la referencia del usuario CONVIVEN: la lente ordena la prioridad y la referencia (su vara para
    // esta consulta) define el conjunto. Antes la lente ganaba y la referencia se DESCARTABA en silencio. Una referencia inválida
    // junto a una lente válida no invalida la lente: se declara `criterio_desconocido` y la lente sigue.
    const _refJunto = _referenciaDeUsuarioValida(criterio.referencia);
    const _refInvalida = criterio.referencia != null && !_refJunto;
    if (_CRITERIOS_IDS.has(criterio.lente)) return { resuelto: { lente: criterio.lente, origen: "usuario", alternativa: criterio.lente === "riesgo" ? null : "riesgo", ...(_refJunto ? { referencia: { ..._refJunto } } : {}) }, problema: _refInvalida ? { motivo: "criterio_desconocido" } : null, avisoAdi: false };
    const esTesoreria = _LENTE_RESERVADA_TESORERIA.test(String(criterio.lente).trim());
    return { resuelto: { lente: "riesgo", origen: "adi", alternativa: null, ...(_refJunto ? { referencia: { ..._refJunto } } : {}) }, problema: { motivo: "criterio_desconocido", ...(esTesoreria ? { alternativaCredito: true } : {}) }, avisoAdi: true };
  }
  if (_es(criterio.referencia) && _str(criterio.referencia.concepto) && typeof criterio.referencia.valor === "number" && _str(criterio.referencia.unidad)) {
    // REFERENCIAS_DE_LA_CASA (§3) = las claves de lexico.js con `referencia: true` — `esReferencia` es exactamente esa marca.
    if (esReferencia(criterio.referencia.concepto)) return { resuelto: { referencia: { ...criterio.referencia }, origen: "usuario" }, problema: null, avisoAdi: false };
    return { resuelto: { lente: "riesgo", origen: "adi", alternativa: null }, problema: { motivo: "criterio_desconocido" }, avisoAdi: true };
  }
  return { resuelto: { lente: "riesgo", origen: "adi", alternativa: null }, problema: { motivo: "criterio_desconocido" }, avisoAdi: true };
}

/* ── supuestos de la raíz (§4·3) — se resuelven ANTES del recorrido de partes para que una parte "simulacion"
 * sepa si sus ids citados tienen productor; el ORDEN de aparición en `noResuelto` no importa (§8: subconjunto). */
function _resolverSupuestosRaiz(supuestos, partes) {
  const lista = _lista(supuestos);
  const resueltos = [];         // SupuestoResuelto[] (solo válidos, con productor)
  const noResuelto = [];
  const porId = new Map();      // id → { ok, productor }
  /* RC16 (owner, medición de cierre etapa 1 · diagnostico.md §RC16 — MATERIAL, contradice el ejemplo explícito
   * del contrato): superar el tope RECHAZA EL CONJUNTO ENTERO, nunca «los primeros N». Antes se seguía validando
   * `lista.slice(0, MAX)` — con 4 supuestos y tope 3, los 3 primeros terminaban con productor y corriendo en
   * `RESOLUCION.supuestos`, exactamente lo que el contrato prohíbe. Con el tope excedido, `usados = []`: ningún
   * supuesto de ESE encargo se valida ni se liga a partes (toda `simulacion` que los cite queda sin supuestos
   * válidos → `no_resuelta`, por el camino que ya existe más abajo). */
  const excedeTope = lista.length > SUPUESTOS_USUARIO_MAX;
  const usados = excedeTope ? [] : lista;
  if (excedeTope) {
    noResuelto.push(nuevoNoResuelto({ campo: "supuesto", valor: lista.length, motivo: "supuesto_tope", detalle: `más de ${SUPUESTOS_USUARIO_MAX} supuestos` }));
  }
  for (const s of usados) {
    if (!_es(s) || !_str(s.id)) continue;   // sin id no se puede referenciar desde una parte: se declina en silencio de forma inofensiva (no hay campo que nombrar)
    if (s.origen != null && !["supuesto", "declarado"].includes(s.origen)) {
      noResuelto.push(nuevoNoResuelto({ campo: "supuesto", valor: s.id, motivo: "origen_no_admitido", detalle: `origen «${s.origen}» no admitido por el encargo: un supuesto de un documento entra por «aportar contexto»` }));
      porId.set(s.id, { ok: false }); continue;
    }
    const v = assumptionValid({ type: s.tipo, value: s.valor, unit: s.unidad });
    if (!v.ok) {
      noResuelto.push(nuevoNoResuelto({ campo: "supuesto", valor: s.id, motivo: "supuesto_mal_formado", detalle: v.reason, alternativas: [{ tipo: "supuesto", tipo_supuesto: s.tipo, units: v.offer || [] }] }));
      porId.set(s.id, { ok: false }); continue;
    }
    let eje = null;
    if (s.alcance === "negocio") { eje = "negocio"; }
    else if (_es(s.alcance) && EJES.includes(s.alcance.eje) && _str(s.alcance.nombre)) {
      const canon = resolveCanonical(s.alcance.eje, s.alcance.nombre);
      if (!canon) { noResuelto.push(nuevoNoResuelto({ campo: "supuesto", valor: s.id, motivo: "supuesto_mal_formado", detalle: `el alcance no resuelve: «${s.alcance.nombre}» no existe en ${s.alcance.eje}` })); porId.set(s.id, { ok: false }); continue; }
      eje = s.alcance.eje;
    } else {
      noResuelto.push(nuevoNoResuelto({ campo: "supuesto", valor: s.id, motivo: "supuesto_mal_formado", detalle: "el alcance no resuelve: falta {eje, nombre} o \"negocio\"" }));
      porId.set(s.id, { ok: false }); continue;
    }
    const parteQueLoCita = partes.find((p) => _es(p) && _lista(p.supuestos).includes(s.id));
    const tema = parteQueLoCita ? parteQueLoCita.tema : null;
    // CORTE 3d (owner 2026-09-26) — «un supuesto custom sin concepto del registro NO llega a la Entrega»: un
    // "custom" en un alcance donde SÍ hay un tipo nombrado (carga/costo, §7.1) se declina ACÁ, con las
    // alternativas de concepto — nunca compone con «custom» de jerga. Va ANTES del lookup genérico de productor
    // porque el motivo es más específico (`supuesto_mal_formado`, no `supuesto_sin_productor`: el motor SÍ podría
    // correr esto, lo que falta es que el supuesto declare CON QUÉ CONCEPTO de negocio se nombra).
    if (s.tipo === "custom" && tema === "comercial" && eje === "cliente") {
      noResuelto.push(nuevoNoResuelto({ campo: "supuesto", valor: s.id, motivo: "supuesto_mal_formado", detalle: `«custom» no nombra un concepto de negocio: dime si el supuesto mueve la carga comercial o el costo, con el tipo "carga" o "costo"`, alternativas: [{ tipo: "concepto", concepto: "carga" }, { tipo: "concepto", concepto: "costo" }] }));
      porId.set(s.id, { ok: false }); continue;
    }
    if (s.tipo === "custom" && tema === "comercial" && ["sku", "marca", "familia"].includes(eje)) {
      noResuelto.push(nuevoNoResuelto({ campo: "supuesto", valor: s.id, motivo: "supuesto_mal_formado", detalle: `«custom» no nombra un concepto de negocio: dime si el supuesto mueve el costo, con el tipo "costo"`, alternativas: [{ tipo: "concepto", concepto: "costo" }] }));
      porId.set(s.id, { ok: false }); continue;
    }
    const productor = tema ? _productorDeSupuesto(s.tipo, tema, eje) : null;
    if (!productor) {
      noResuelto.push(nuevoNoResuelto({ campo: "supuesto", valor: s.id, motivo: "supuesto_sin_productor", detalle: `«${s.tipo}» sobre ${eje} en ${tema || "(ninguna parte lo cita)"}: la simulación paramétrica todavía no tiene productor en el motor` }));
      porId.set(s.id, { ok: false }); continue;
    }
    resueltos.push({ id: s.id, tipo: s.tipo, valor: s.valor, unidad: s.unidad, alcance: s.alcance, origen: s.origen || "supuesto", productor });
    porId.set(s.id, { ok: true, productor });
  }
  return { resueltos, noResuelto, porId };
}

/* ── premisas de la raíz (§4·4 y §1.3) — SOLO forma: el veredicto lo pone la Entrega con el libro real. ────── */
function _resolverPremisasRaiz(premisas, I) {
  const validas = [];
  const noResuelto = [];
  for (const p of _lista(premisas)) {
    if (!_es(p) || !_str(p.id)) continue;
    if (!TIPOS_DE_PREMISA.includes(p.tipo)) {
      noResuelto.push(nuevoNoResuelto({ campo: "premisa", valor: p.id, motivo: "premisa_mal_formada", detalle: `tipo «${p.tipo}» no es una premisa factual (${TIPOS_DE_PREMISA.join(" · ")})` }));
      continue;
    }
    const err = validarHecho(p, I);
    if (err) { noResuelto.push(nuevoNoResuelto({ campo: "premisa", valor: p.id, motivo: "premisa_mal_formada", detalle: err })); continue; }
    validas.push(p);
  }
  return { validas, noResuelto };
}

/* ── una Parte completa (§4·1) ──────────────────────────────────────────────────────────────────────────────── */
function _validarParte(parteCruda, idx, supuestosPorId, I) {
  const id = _str(parteCruda && parteCruda.id) ? parteCruda.id : `p${idx + 1}`;
  const noResuelto = [];
  const avisos = [];

  const rarosDeParte = Object.keys(parteCruda || {}).filter((k) => !CAMPOS_PARTE.includes(k));
  /* RC18 (owner, diagnostico.md §RC18): §7.1 ya cerró esto — «el campo desconocido dentro de una parte es
   * aviso... se declara en noResuelto con campo "raiz"/"campo_desconocido"... y la parte corre» (mismo motivo
   * que a nivel raíz, líneas 441-447 más abajo). Antes solo se empujaba a `avisos`: la mitad de la ley. Esto NO
   * cambia `parcialForzado` ni ningún estado — sigue siendo un aviso no bloqueante, ahora también declarado. */
  for (const k of rarosDeParte) {
    avisos.push(nuevoAviso("campo_desconocido", `campo «${k}» no reconocido en la parte`, id));
    noResuelto.push(nuevoNoResuelto({ parte: id, campo: "raiz", valor: k, motivo: "campo_desconocido" }));
  }

  const tema = parteCruda && parteCruda.tema;
  const temaEntrada = dominioPorId(tema);
  if (!temaEntrada) {
    noResuelto.push(nuevoNoResuelto({ parte: id, campo: "tema", valor: tema, motivo: "tema_desconocido", alternativas: idsActivos().map((t) => ({ tipo: "tema", tema: t })) }));
    return { id, tema: tema ?? null, cierre: parteCruda && parteCruda.cierre, estado: "no_resuelta", conceptos: [], entidades: [], eje: null, universo: null, periodo: null, ausencias: [], noResuelto, avisos };
  }
  if (temaEntrada.estado === "ausente") {
    noResuelto.push(nuevoNoResuelto({ parte: id, campo: "tema", valor: tema, motivo: "tema_ausente", alternativas: [{ tipo: "ausencia", id: temaEntrada.ausencia.id, alternativa: temaEntrada.ausencia.alternativa }] }));
    return { id, tema, cierre: parteCruda && parteCruda.cierre, estado: "no_resuelta", conceptos: [], entidades: [], eje: null, universo: null, periodo: null, ausencias: [], noResuelto, avisos };
  }

  const cierre = parteCruda.cierre;
  if (!CIERRES.includes(cierre)) {
    noResuelto.push(nuevoNoResuelto({ parte: id, campo: "cierre", valor: cierre, motivo: "cierre_desconocido", alternativas: CIERRES.map((c) => ({ tipo: "cierre", cierre: c })) }));
    return { id, tema, cierre: cierre ?? null, estado: "no_resuelta", conceptos: [], entidades: [], eje: null, universo: null, periodo: null, ausencias: ausenciasDe(tema).map((a) => a.id), noResuelto, avisos };
  }

  /* ── entidades (§4e) ── */
  const entidadesEntrada = _lista(parteCruda.entidades);
  const entidadesResueltas = [];       // { nombre, eje } — SOLO las que sí resolvieron
  let entidadesValidasN = 0;
  for (const ref of entidadesEntrada) {
    const r = _resolverEntidadRef(ref);
    if (r.estado === "resuelta") { entidadesResueltas.push({ nombre: r.nombre, eje: r.eje }); entidadesValidasN++; continue; }
    if (r.estado === "eje_incompatible") {
      noResuelto.push(nuevoNoResuelto({ parte: id, campo: "entidad", valor: ref, motivo: "entidad_eje_incompatible", alternativas: [{ tipo: "entidad", nombre: r.nombre, eje: r.eje }] }));
      continue;
    }
    if (r.estado === "ambigua") {
      noResuelto.push(nuevoNoResuelto({ parte: id, campo: "entidad", valor: ref, motivo: "entidad_ambigua", alternativas: (r.opciones || []).map((o) => ({ tipo: "entidad", nombre: o.nombre, eje: o.dimension })) }));
      continue;
    }
    if (r.estado === "eje_desconocido") {
      noResuelto.push(nuevoNoResuelto({ parte: id, campo: "eje", valor: ref && ref.eje, motivo: "eje_no_soportado", alternativas: EJES.map((e) => ({ tipo: "eje", eje: e })) }));
      continue;
    }
    // "inexistente" | "invalida"
    // R-EJECHICO-CAP-3 (diagnóstico v6, MEDIA): este `.slice(0, 3)` recapaba lo que `findCandidates` (RC13,
    // `oracle/entityIndex.js`, con `ejeChico:true`) ya había decidido ofrecer completo (hasta 5, con un eje de
    // pocos miembros) — un segundo tope que deshacía el primero. `r.candidatos` ya viene acotado por
    // `findCandidates` (≤3 por similitud fuzzy, o TODOS con eje chico): no hace falta un segundo recorte acá.
    noResuelto.push(nuevoNoResuelto({ parte: id, campo: "entidad", valor: ref, motivo: "entidad_inexistente", alternativas: (r.candidatos || []).map((c) => ({ tipo: "entidad", nombre: c.nombre, eje: c.dimension || (ref && ref.eje) || null })) }));
  }

  /* ── el eje efectivo de la parte (§4d): el de la primera entidad resuelta; si no hay entidades, Parte.eje o el sujeto del tema ── */
  let ejeEfectivo = null;
  if (entidadesResueltas.length) ejeEfectivo = entidadesResueltas[0].eje;
  else if (_str(parteCruda.eje)) ejeEfectivo = EJES.includes(parteCruda.eje) ? parteCruda.eje : null;
  else ejeEfectivo = sujetoDeTema(tema);
  /* R-EJE-INVALIDO-CONCEPTO-VALIDO (diagnóstico v6): se guarda el origen de `ejeEfectivo == null` para que la
   * validación de conceptos (abajo) no confunda «eje explícito inválido» con «eje nunca declarado». */
  const ejeExplicitoInvalido = _str(parteCruda.eje) && !EJES.includes(parteCruda.eje) && !entidadesResueltas.length;
  if (ejeExplicitoInvalido) {
    noResuelto.push(nuevoNoResuelto({ parte: id, campo: "eje", valor: parteCruda.eje, motivo: "eje_no_soportado", alternativas: EJES.map((e) => ({ tipo: "eje", eje: e })) }));
  }

  /* ── conceptos (§4f) ── */
  const conceptosEntrada = _lista(parteCruda.conceptos);
  const conceptosValidos = [];
  /* el eje sin productor se reporta de DOS formas posibles (contrato §4d/D36: «se acepta también
   * concepto_sin_productor si el implementador valida concepto antes que eje — pero UNO de los dos tiene que
   * aparecer»): cuando el usuario declaró `Parte.eje` EXPLÍCITO, la raíz del problema es el eje que pidió, así
   * que se reporta UNA vez como `eje_no_soportado` (campo "eje"); cuando el eje salió por defecto (de una entidad
   * o del sujeto del tema), se reporta por CONCEPTO (`concepto_sin_productor`), porque ahí no hay un campo "eje"
   * que el usuario haya escrito para señalar. */
  const ejeFueExplicito = _str(parteCruda.eje) && EJES.includes(parteCruda.eje);
  /* RC6 (decisión del SUPERVISOR, diagnostico.md §RC6 — el propio código traía la ambigüedad documentada como
   * D36, sin decidir). Con eje EXPLÍCITO, un concepto "sin_productor" no se declara todavía: se junta acá y se
   * decide DESPUÉS de recorrer TODOS los conceptos de la parte, porque el motivo correcto depende del resultado
   * conjunto (ver el bloque de abajo). */
  const sinProductorPendientes = [];   // { c, ejes } — solo cuando el eje fue explícito
  for (const c of conceptosEntrada) {
    if (!_str(c)) continue;
    const r = _validarConcepto(c, tema, ejeEfectivo, ejeExplicitoInvalido);
    if (r.estado === "valido") { conceptosValidos.push(c); continue; }
    if (r.estado === "eje_invalido") continue;   // el eje_no_soportado de la parte ya se declaró una vez; el concepto no cuenta como válido
    if (r.estado === "desconocido") {
      noResuelto.push(nuevoNoResuelto({ parte: id, campo: "concepto", valor: c, motivo: "concepto_desconocido", alternativas: temaEntrada.metricas.map((k) => ({ tipo: "concepto", clave: k })) }));
      continue;
    }
    if (r.estado === "otro_tema") {
      noResuelto.push(nuevoNoResuelto({ parte: id, campo: "concepto", valor: c, motivo: "concepto_de_otro_tema", alternativas: [{ tipo: "tema", tema: r.dominio }] }));
      continue;
    }
    if (r.estado === "cruce_bloqueado") {
      noResuelto.push(nuevoNoResuelto({ parte: id, campo: "concepto", valor: c, motivo: "cruce_bloqueado", detalle: r.cruce ? r.cruce.reason : "", alternativas: ejesConProductor(c).map((e) => ({ tipo: "eje", eje: e })) }));
      continue;
    }
    // "sin_productor"
    if (ejeFueExplicito) { sinProductorPendientes.push({ c, ejes: r.ejes }); continue; }
    noResuelto.push(nuevoNoResuelto({ parte: id, campo: "concepto", valor: c, motivo: "concepto_sin_productor", alternativas: r.ejes.map((e) => ({ tipo: "eje", eje: e })) }));
  }
  /* La decisión (§RC6 del diagnóstico, tomada por el supervisor): si el eje es explícito y AL MENOS UN OTRO
   * concepto de la MISMA parte SÍ resuelve en ese eje, el eje en sí queda probado válido por esa prueba — el
   * motivo correcto es `concepto_sin_productor`, uno por cada concepto que falla (campo "concepto"). Si NINGÚN
   * concepto pedido tiene productor en ese eje, es el EJE el que falla, no cada concepto: UN solo
   * `eje_no_soportado` (campo "eje") con las alternativas de ejes que sí producen. Con eje POR DEFECTO (no
   * explícito) la rama de arriba ya declara siempre `concepto_sin_productor` — esta decisión no la toca. */
  if (ejeFueExplicito && sinProductorPendientes.length) {
    if (conceptosValidos.length > 0) {
      for (const { c, ejes } of sinProductorPendientes) {
        noResuelto.push(nuevoNoResuelto({ parte: id, campo: "concepto", valor: c, motivo: "concepto_sin_productor", alternativas: ejes.map((e) => ({ tipo: "eje", eje: e })) }));
      }
    } else {
      const ejesAlternativos = new Set();
      for (const { ejes } of sinProductorPendientes) for (const e of ejes) ejesAlternativos.add(e);
      noResuelto.push(nuevoNoResuelto({ parte: id, campo: "eje", valor: parteCruda.eje, motivo: "eje_no_soportado", alternativas: [...ejesAlternativos].map((e) => ({ tipo: "eje", eje: e })) }));
    }
  }
  /* RC-A (diagnóstico v2, supervisor 2026-09-26 — MATERIAL: «Resolucion.ok»/«estado» mienten sobre si el eje
   * sirve algo) — con eje EXPLÍCITO y CERO conceptos declarados (contrato §1: `[]` = «lo que el procedimiento del
   * tema sirva»), el bucle de arriba (línea 328) NUNCA corre (`conceptosEntrada` vacío), así que
   * `sinProductorPendientes` nunca se llena y el bloque de arriba nunca puede detectar un eje SIN NINGÚN productor
   * para el tema entero (ej. cobranza·marca — cobranza solo produce por cliente, contrato §3.3). Antes, esa
   * combinación pasaba la validación como `resuelta` con `conceptos:[]`, y en silencio terminaba sirviendo
   * contenido de OTRO alcance (compuesto con R1) en vez de declinar. `lecturasDe.js:_pasosLecturaDecision` y
   * `entrega/componer.js` (fallback de eje explícito) YA expanden "sin conceptos" a "todos los del tema con
   * productor en ese eje" para decidir QUÉ CORRE — acá se hace la MISMA pregunta, pero SOLO para decidir el
   * ESTADO: si NINGÚN concepto del tema tiene productor en `ejeEfectivo`, es el eje el que falla (mismo motivo
   * `eje_no_soportado` que la rama de arriba usa para el caso análogo con conceptos declarados). Nunca se agrega
   * nada a `conceptosValidos`/`ParteResuelta.conceptos` — esa lista sigue siendo `[]` cuando nada se declaró
   * explícito; esto solo alimenta la validación interna del eje. Si AL MENOS UN concepto del tema sí produce en
   * ese eje, la parte sigue resolviendo con `conceptos:[]` (el procedimiento decide qué sirve, como siempre).
   * Acotado a `lectura`/`decision` (el caso diagnosticado): `cifra` ya tiene su propio candado para "sin nada
   * que mostrar" (`cifraSinNada`, más abajo) y puede sostenerse solo con `universo.top` sin declarar `conceptos`
   * — no se le suma un segundo motivo de aquí. */
  const ejeSinProductorImplicito = (cierre === "lectura" || cierre === "decision") && ejeFueExplicito && conceptosEntrada.length === 0
    && !(temaEntrada.metricas || []).some((c) => productorDe(c, ejeEfectivo));
  if (ejeSinProductorImplicito) {
    const ejesAlternativos = new Set();
    for (const c of temaEntrada.metricas || []) for (const e of ejesConProductor(c)) ejesAlternativos.add(e);
    noResuelto.push(nuevoNoResuelto({ parte: id, campo: "eje", valor: parteCruda.eje, motivo: "eje_no_soportado", alternativas: [...ejesAlternativos].map((e) => ({ tipo: "eje", eje: e })) }));
  }

  /* ── universo (§4g) ── */
  let universoResuelto = null, universoValido = null, universoDado = parteCruda.universo != null;
  if (universoDado) {
    const uEff = _es(parteCruda.universo) ? { ...parteCruda.universo, eje: parteCruda.universo.eje || ejeEfectivo } : parteCruda.universo;
    const sujetoParaValidar = entidadesResueltas.length ? entidadesResueltas[0].nombre : null;
    const err = validarUniverso(uEff, I, sujetoParaValidar);
    if (err) {
      noResuelto.push(nuevoNoResuelto({ parte: id, campo: "universo", valor: parteCruda.universo, motivo: "universo_invalido", detalle: err }));
      universoValido = false;
    } else if (_es(uEff) && uEff.eje && ejeEfectivo && uEff.eje !== ejeEfectivo) {
      noResuelto.push(nuevoNoResuelto({ parte: id, campo: "universo", valor: parteCruda.universo, motivo: "universo_invalido", detalle: `el universo es de ${uEff.eje} y la parte es de ${ejeEfectivo}` }));
      universoValido = false;
    } else {
      // §7.3·11 del contrato, COMPLETO (decisión del coordinador, 2026-09-26) — un `base` que no es NINGÚN
      // conjunto de la casa («clientes grandes») o que es un conjunto de OTRO eje («carga comercial alta», de
      // cliente, con eje:"sku") se declina ACÁ, antes de que el compositor termine sirviendo el eje entero en
      // silencio porque el universo no se pudo evaluar más adelante. Fuente: `notario/conjuntosDeLaCasa.js` — el
      // catálogo ESTÁTICO de nombre+eje (carga · benchmark · estado), la MISMA fuente que ya usa
      // `notario/verificar.js:_conjuntosConocidos` para sus nombres — nunca una lista escrita a mano acá. Esto NO
      // resuelve MEMBRESÍA (quiénes son miembros sigue siendo pregunta de `conjuntoDeUniverso` en tiempo de
      // composición, que sí necesita las figs del turno para la familia de benchmark) — solo si el NOMBRE existe y
      // para qué eje, que es conocimiento estático y ahora cubre las dos familias completas.
      // A6 (supervisor 2026-09-27, diagnóstico v8) — `_errorDeBase` reusa el MISMO registro (`conjuntoConocido`)
      // para el `base` de nivel superior Y para el `base` de cada miembro de `universo.union[]`, con el eje
      // DECLARADO de ese miembro (nunca el del universo padre): antes `validar.js` no tenía ninguna lógica que
      // reconociera `union` (cero apariciones de la palabra en todo el archivo) y dejaba pasar, sin validar, una
      // unión con un miembro de OTRO eje («con saldo vencido» —de cliente— dentro de un universo `eje:"sku"`),
      // que `componerEntrega` terminaba sirviendo con datos reales del eje del universo padre, ignorando en
      // silencio el miembro inválido.
      const _errorDeBase = (baseStr, eje) => {
        if (!baseStr || /^todos?|todas$/i.test(baseStr)) return null;
        const c = conjuntoConocido(baseStr);
        if (!c) return `«${baseStr}» no es un conjunto que la casa reconozca`;
        if (c.eje && eje && c.eje !== eje) return `«${baseStr}» es un conjunto de ${c.eje}, no de ${eje}`;
        return null;
      };
      const _baseStr = _es(uEff) && typeof uEff.base === "string" ? uEff.base.trim() : "";
      let _baseError = _errorDeBase(_baseStr, uEff.eje);
      if (!_baseError && _es(uEff) && Array.isArray(uEff.union)) {
        for (const miembro of uEff.union) {
          if (!_es(miembro)) continue;
          const miembroBaseStr = typeof miembro.base === "string" ? miembro.base.trim() : "";
          const miembroEje = miembro.eje || uEff.eje;
          const err = _errorDeBase(miembroBaseStr, miembroEje);
          if (err) { _baseError = err; break; }
        }
      }
      if (_baseError) {
        noResuelto.push(nuevoNoResuelto({ parte: id, campo: "universo", valor: parteCruda.universo, motivo: "universo_invalido", detalle: _baseError }));
        universoValido = false;
      } else {
        universoResuelto = uEff; universoValido = true;
      }
    }
  }

  /* ── periodo (§4h) ── */
  const entidadParaSerie = entidadesResueltas.length ? entidadesResueltas[0].nombre : null;
  const periodoDado = parteCruda.periodo != null;
  const { resuelto: periodoResuelto, problema: periodoProblema } = _resolverPeriodo(parteCruda.periodo, tema, entidadParaSerie);
  if (periodoProblema) {
    const alt = [{ tipo: "periodo", periodo: { tipo: "vigente" } }];
    noResuelto.push(nuevoNoResuelto({ parte: id, campo: "periodo", valor: parteCruda.periodo, motivo: periodoProblema.motivo, alternativas: alt }));
  }
  const periodoValido = !periodoProblema;

  /* ── concepto único de `definicion` (§1.1) ── */
  let definicionValida = null;
  if (cierre === "definicion") {
    /* RC14 (owner, diagnostico.md §RC14): un campo REQUERIDO ausente (`concepto == null` — no vino, distinto de
     * un valor inválido que sí vino) es `cierre_incompleto` (§2.1), no `concepto_desconocido` — son motivos
     * semánticamente distintos: «no me dijiste qué concepto» vs. «me dijiste uno que no existe». El campo que
     * falta es "concepto" (el campo que el motivo señala), no "cierre" — el cierre en sí está bien formado. */
    if (parteCruda.concepto == null) {
      noResuelto.push(nuevoNoResuelto({ parte: id, campo: "concepto", valor: null, motivo: "cierre_incompleto", detalle: "una definición exige el campo concepto" }));
      definicionValida = false;
    } else {
      definicionValida = conceptoDeDefinicionValido(parteCruda.concepto);
      if (!definicionValida) {
        noResuelto.push(nuevoNoResuelto({ parte: id, campo: "concepto", valor: parteCruda.concepto, motivo: "concepto_desconocido", alternativas: [] }));
      }
    }
  }

  /* ── cardinalidad / ejes mezclados de `comparacion` (§1.1) ── */
  let cardinalidadOk = true, ejesMezclados = false;
  if (cierre === "comparacion") {
    if (entidadesEntrada.length !== 2) {
      cardinalidadOk = false;
      noResuelto.push(nuevoNoResuelto({ parte: id, campo: "cierre", valor: entidadesEntrada.length, motivo: "cardinalidad", alternativas: [{ tipo: "cierre", cierre: "cifra" }] }));
    } else if (entidadesResueltas.length === 2 && entidadesResueltas[0].eje !== entidadesResueltas[1].eje) {
      ejesMezclados = true;
      /* RC15 (owner, diagnostico.md §RC15): mismo bloque, misma clase de problema que su vecino `cardinalidad`
       * (3 líneas arriba) — el cierre completo (`comparacion`) no puede correr por cómo está armado el CONJUNTO
       * de entidades, no por un campo de entrada suelto. `campo:"cierre"`, igual que `cardinalidad` y el ejemplo
       * 6.3 del contrato. */
      noResuelto.push(nuevoNoResuelto({ parte: id, campo: "cierre", valor: entidadesResueltas.map((e) => e.eje), motivo: "ejes_mezclados", alternativas: entidadesResueltas.map((e) => ({ tipo: "eje", eje: e.eje })) }));
    }
  }

  /* ── supuestos citados por una `simulacion` (§1.1 + §4·3, resuelto arriba a nivel raíz) ── */
  const supuestosCitados = cierre === "simulacion" ? _lista(parteCruda.supuestos).filter((x) => _str(x)) : [];
  const supuestosValidosN = supuestosCitados.filter((sid) => supuestosPorId.get(sid) && supuestosPorId.get(sid).ok).length;
  if (cierre === "simulacion" && supuestosValidosN === 0) {
    noResuelto.push(nuevoNoResuelto({ parte: id, campo: "cierre", valor: supuestosCitados, motivo: "cierre_incompleto", detalle: "ningún supuesto citado tiene productor" }));
  }

  /* ── cifra sin concepto ni universo.top (§1.1) ──
   * R-CIFRA-SIN-CONCEPTO-CAMPO-CIERRE (diagnóstico v6, §3.3): el campo que FALTA es «concepto» (mismo principio
   * RC14 ya aplicado a `definicion`, línea 425 arriba) — el cierre en sí está bien formado, lo que falta es qué
   * mostrar. `campo:"cierre"` quedaba reservado para cuando el CIERRE es el problema (cardinalidad, ejes_mezclados). */
  if (cierre === "cifra" && conceptosEntrada.length === 0 && !(universoResuelto && universoResuelto.top)) {
    noResuelto.push(nuevoNoResuelto({ parte: id, campo: "concepto", valor: null, motivo: "cierre_incompleto", detalle: "una cifra exige al menos un concepto o un universo con top" }));
  }

  /* ── ausencias del tema (§4j): SIEMPRE que el tema esté activo, sea cual sea el resto ── */
  const ausencias = ausenciasDe(tema).map((a) => a.id);

  /* ── el estado final de la parte (§1.2) ── */
  // «la única entidad» es el caso con 1 sola entidad pedida — pero CERO de N válidas (N ≥ 1) es igual de esencial:
  // no hay nada válido que correr, así que tampoco es «parcial» (parcial exige algo útil que mostrar).
  const entidadEsencialFalla = entidadesEntrada.length > 0 && entidadesValidasN === 0;
  // simétrico para concepto: «el único concepto» O todos los conceptos pedidos, si además no hay un universo.top
  // que sostenga la cifra por otro lado (D02: conceptos inválidos con universo.top corriendo igual no es este caso).
  const conceptoEsencialFalla = (cierre === "cifra") && conceptosEntrada.length > 0 && conceptosValidos.length === 0
    && !(universoResuelto && universoResuelto.top);
  const cifraSinNada = cierre === "cifra" && conceptosEntrada.length === 0 && !(universoResuelto && universoResuelto.top);
  /* RC17 (owner, diagnostico.md §RC17 — MATERIAL, viola literalmente «nada se sustituye por un vecino»): cuando
   * la parte NO tiene entidades y el ÚNICO universo declarado es inválido, no hay población sobre la que correr
   * el concepto — mismo patrón que `entidadEsencialFalla`/`conceptoEsencialFalla`. Antes esto solo marcaba
   * `parcialForzado` y la parte quedaba "parcial": el compositor (que sí filtra por estado) igual la corría y
   * servía un listado GLOBAL sin el filtro que el usuario pidió — una sustitución silenciosa. Aplica a los tres
   * cierres con universo real (comparacion/definicion/simulacion no lo usan). */
  const universoEsencialFalla = (cierre === "cifra" || cierre === "lectura" || cierre === "decision")
    && entidadesEntrada.length === 0 && universoDado && universoValido === false;
  /* RC9 (owner, diagnostico.md §RC9): en lectura/decision, cuando la entidad resuelve pero TODOS los conceptos
   * EXPLÍCITAMENTE pedidos fallan, la parte no corrió nada de lo pedido para ese tema — la etiqueta correcta es
   * `no_resuelta`, el MISMO patrón que ya aplica `cifra` (`conceptoEsencialFalla`), extendido a los dos cierres
   * que faltaban. */
  const conceptoEsencialFallaLD = (cierre === "lectura" || cierre === "decision")
    && conceptosEntrada.length > 0 && conceptosValidos.length === 0;
  const parcialForzado = (entidadesEntrada.length > entidadesValidasN) || (conceptosEntrada.length > conceptosValidos.length)
    || (universoDado && !universoValido) || (periodoDado && !periodoValido)
    || (cierre === "simulacion" && supuestosCitados.length > supuestosValidosN);

  let estado;
  if (cierre === "definicion") {
    estado = definicionValida ? "resuelta" : "no_resuelta";
  } else if (cierre === "comparacion") {
    estado = (cardinalidadOk && !ejesMezclados && entidadesResueltas.length === 2) ? (parcialForzado ? "parcial" : "resuelta") : "no_resuelta";   /* §1.2: parcial = elementos válidos e inválidos en un campo-lista */
  } else if (cierre === "simulacion") {
    if (supuestosValidosN === 0 || entidadEsencialFalla) estado = "no_resuelta";
    else estado = parcialForzado ? "parcial" : "resuelta";
  } else if (cierre === "cifra") {
    if (entidadEsencialFalla || conceptoEsencialFalla || cifraSinNada || universoEsencialFalla) estado = "no_resuelta";
    else estado = parcialForzado ? "parcial" : "resuelta";
  } else {   // lectura · decision
    if (entidadEsencialFalla || conceptoEsencialFallaLD || universoEsencialFalla || ejeSinProductorImplicito) estado = "no_resuelta";
    else estado = parcialForzado ? "parcial" : "resuelta";
  }

  /* §7.3·43(d): una parte `no_resuelta` NO reporta entidades resueltas (la parte no corre: el contrato §1.2 pone las
   * entidades en `resuelta`/`parcial`; la entidad que existe queda dicha en `noResuelto`/alternativas cuando es lo que
   * falló, y una premisa que la nombre la juzga por su cuenta). Es UNA sola salida: los seis caminos que llegan aquí
   * (cifra sin concepto, comparación con una cuenta sola, eje explícito sin productor, simulación con el tope de
   * supuestos, …) la comparten; los retornos tempranos de arriba ya devolvían `entidades: []`. */
  return {
    id, tema, cierre, estado,
    conceptos: conceptosValidos, entidades: estado === "no_resuelta" ? [] : entidadesResueltas, eje: ejeEfectivo,
    universo: universoValido ? universoResuelto : null, periodo: periodoResuelto,
    ausencias, noResuelto, avisos,
  };
}

/* ── EL VALIDADOR ────────────────────────────────────────────────────────────────────────────────────────────── */
/** validarEncargo(encargo, ctx) → Resolucion. `ctx = { tenant?, versionId?, indice? }`: el tenant/versionId activos
 *  ya gobiernan `entityIndex.js` (se cambian con `initTenant`/`onTenantChange` ANTES de llamar, como el resto del
 *  Core) — acá solo se leen por si un llamador quiere dejar constancia de con qué corrió; `ctx.indice`, si viene,
 *  REEMPLAZA el índice liviano por defecto (inyectable para un gate que arma un tenant sintético sin re-inicializar
 *  el store real — mismo patrón que `dominiosDeTexto(texto, { registro })`). */
export function validarEncargo(encargo, ctx = {}) {
  if (!_es(encargo)) return resolucionVacia(encargo);

  /* § raíz (§4·0): version · partes · claves desconocidas — si falla, PARA. */
  const raroDeRaiz = Object.keys(encargo).filter((k) => !CAMPOS_RAIZ.includes(k));
  const noResuletoRaiz = [];
  if (encargo.version !== "encargo/v1") noResuletoRaiz.push(nuevoNoResuelto({ campo: "version", valor: encargo.version, motivo: "version_invalida" }));
  const partesCrudas = _lista(encargo.partes);
  if (partesCrudas.length === 0) noResuletoRaiz.push(nuevoNoResuelto({ campo: "partes", valor: encargo.partes, motivo: "encargo_vacio" }));
  else if (partesCrudas.length > PARTES_MAX) noResuletoRaiz.push(nuevoNoResuelto({ campo: "partes", valor: partesCrudas.length, motivo: "partes_tope" }));
  if (raroDeRaiz.length) for (const k of raroDeRaiz) noResuletoRaiz.push(nuevoNoResuelto({ campo: "raiz", valor: k, motivo: "campo_desconocido" }));
  if (encargo.version !== "encargo/v1" || partesCrudas.length === 0 || partesCrudas.length > PARTES_MAX || raroDeRaiz.length) {
    // §7.3·18 (supervisor 2026-09-27, diagnóstico v8), PRECISADA por §7.3·20 (supervisor 2026-09-27, diagnóstico
    // v9, RAÍZ C1) — si la raíz es inválida pero la LISTA de partes SÍ se pudo leer (existe y no está vacía —
    // `partes_tope`/`version_invalida`/`campo_desconocido` en la raíz), cada parte declarada aparece en
    // `R.partes` como `no_resuelta`. «Con el motivo de la raíz» se refiere a CADA parte (decisión 20, precisa la
    // 18): además de la declaración única en `noResuelto` (`parte:null`, ya armada arriba), cada parte legible
    // lleva el MISMO motivo en su propio campo `R.partes[i].motivo` — quien consulta sabe así, por cada parte,
    // qué pasó y por qué, sin tener que cruzar `noResuelto` a mano. `noResuletoRaiz[0]` es el motivo REAL de esta
    // corrida (raroDeRaiz solo agrega más de un `campo_desconocido` cuando hay varias claves ajenas a la vez; el
    // resto de las condiciones de esta rama son mutuamente excluyentes con ella). Solo cuando las partes no se
    // pueden leer (`encargo_vacio`: la lista está vacía o no es una lista) `R.partes` queda vacío, como antes.
    const motivoRaiz = noResuletoRaiz[0] ? noResuletoRaiz[0].motivo : null;
    const partesLegibles = partesCrudas.length
      ? partesCrudas.map((p, i) => ({
          id: _str(p && p.id) ? p.id : `p${i + 1}`,
          tema: (p && p.tema) ?? null, cierre: (p && p.cierre) ?? null, estado: "no_resuelta",
          conceptos: [], entidades: [], eje: null, universo: null, periodo: null, ausencias: [],
          motivo: motivoRaiz,
        }))
      : [];
    return { ok: false, encargo, partes: partesLegibles, criterio: null, supuestos: [], premisas: [], noResuelto: noResuletoRaiz, avisos: [] };
  }

  const I = ctx.indice || _indiceLigero();

  /* asigna ids de parte por posición cuando faltan (§1: "id... si falta, ADI lo asigna por posición") */
  const partesConId = partesCrudas.map((p, i) => (_es(p) && !_str(p.id) ? { ...p, id: `p${i + 1}` } : p));

  /* § supuestos de la raíz (§4·3) — ANTES del recorrido de partes: una `simulacion` necesita saber si sus ids tienen productor */
  const { resueltos: supuestosResueltos, noResuelto: noResueltoSupuestos, porId: supuestosPorId } = _resolverSupuestosRaiz(encargo.supuestos, partesConId);

  /* § criterio (§4·2) */
  const { resuelto: criterioResuelto, problema: criterioProblema, avisoAdi } = _resolverCriterio(encargo.criterio);
  const noResueltoCriterio = [];
  const avisosRaiz = [];
  if (criterioProblema) {
    const alternativas = criterioProblema.alternativaCredito
      ? [{ tipo: "lente", lente: "credito" }, { tipo: "ausencia", id: "sin_datos_tesoreria" }]
      : Object.keys(CRITERIOS).map((l) => ({ tipo: "lente", lente: l }));
    noResueltoCriterio.push(nuevoNoResuelto({ campo: "criterio", valor: encargo.criterio, motivo: criterioProblema.motivo, alternativas }));
  }
  if (avisoAdi) avisosRaiz.push(nuevoAviso("criterio_de_adi", "sin criterio válido del usuario: se usó el criterio de ADI (riesgo integrado)"));

  /* § premisas (§4·4 + §1.3) */
  const { validas: premisasValidas, noResuelto: noResueltoPremisas } = _resolverPremisasRaiz(encargo.premisas, I);

  /* § usar · profundidad (§4·5) */
  const noResueltoUsarProfundidad = [];
  if (encargo.usar != null && !USAR_VALORES.includes(encargo.usar)) noResueltoUsarProfundidad.push(nuevoNoResuelto({ campo: "usar", valor: encargo.usar, motivo: "usar_invalido" }));
  if (encargo.profundidad != null && !PROFUNDIDAD_VALORES.includes(encargo.profundidad)) noResueltoUsarProfundidad.push(nuevoNoResuelto({ campo: "profundidad", valor: encargo.profundidad, motivo: "profundidad_invalida" }));
  // Corte 3d.1 (owner 2026-09-25) — `iniciativa` (§A.2c): un valor inválido no bloquea el encargo, se declara y
  // el compositor cae al default ("completa") — el MISMO patrón que `profundidad_invalida` arriba.
  if (encargo.iniciativa != null && !INICIATIVA_VALORES.includes(encargo.iniciativa)) noResueltoUsarProfundidad.push(nuevoNoResuelto({ campo: "iniciativa", valor: encargo.iniciativa, motivo: "iniciativa_invalida" }));

  /* § contexto (§4·6) — sin libro de conversación en esta etapa: cualquier contexto pedido está no disponible */
  const noResueltoContexto = [];
  if (_es(encargo.contexto)) {
    const idOk = /^E\d+(?:\.[hu]\d+)?$/;
    const idsDeContexto = [encargo.contexto.entregaRef, ...(Array.isArray(encargo.contexto.hechosRef) ? encargo.contexto.hechosRef : []), encargo.contexto.universoRef].filter(_str);
    for (const cid of idsDeContexto) {
      if (!idOk.test(cid)) noResueltoContexto.push(nuevoNoResuelto({ campo: "contexto", valor: cid, motivo: "contexto_mal_formado" }));
      else noResueltoContexto.push(nuevoNoResuelto({ campo: "contexto", valor: cid, motivo: "contexto_no_disponible" }));
    }
  }

  /* § cada parte, sola (§4·1) */
  const partesResueltas = partesConId.map((p, i) => _validarParte(p, i, supuestosPorId, I));

  const avisosDeParte = partesResueltas.flatMap((p) => p.avisos.map((a) => ({ ...a, parte: p.id })));
  const noResueltoPartes = partesResueltas.flatMap((p) => p.noResuelto);

  const ok = partesResueltas.some((p) => p.estado === "resuelta" || p.estado === "parcial");

  return {
    ok,
    encargo: { ...encargo, partes: partesConId },
    partes: partesResueltas.map((p) => ({
      id: p.id, tema: p.tema, cierre: p.cierre, estado: p.estado,
      conceptos: p.conceptos, entidades: p.entidades, eje: p.eje, universo: p.universo, periodo: p.periodo,
      ausencias: p.ausencias,
    })),
    criterio: criterioResuelto,
    supuestos: supuestosResueltos,
    premisas: premisasValidas,
    noResuelto: [...noResueltoSupuestos, ...noResueltoCriterio, ...noResueltoPremisas, ...noResueltoUsarProfundidad, ...noResueltoContexto, ...noResueltoPartes],
    avisos: [...avisosRaiz, ...avisosDeParte],
  };
}
