/* === src/adi/encargo/lecturasDe.js · DEL ENCARGO A LAS LECTURAS DEL CORE (Etapa 1 · Corte 3a · owner 2026-09-25)
 * ══════════════════════════════════════════════════════════════════════════════════════════════════════════════
 * `_ADI_CONTRATO_ENCARGO_V1.md` es el contrato; `validar.js` produce la `Resolucion` (Corte 1). Este archivo hace
 * el paso siguiente: `lecturasDe(resolucion) → { plan, porParte }` — un PLAN determinístico de llamadas a las
 * tools del Core (`oracle/toolRegistry.js`, ejecutadas después con `oracle/toolRunner.js:runPlan`), por parte,
 * según (tema × cierre × conceptos × entidades × eje × universo × período × criterio × supuestos). QUÉ NO decide
 * este archivo: la CONCLUSIÓN (eso es de `prioridadIntegrada`/los composers/la Entrega, etapas siguientes) — acá
 * solo se decide QUÉ LECTURAS CORREN.
 *
 * LA LEY QUE OBEDECE (contrato §0, memoria `adi-no-desviarse-deterministico`): cero lectura de
 * `resolucion.encargo.preguntaOriginal`. Lo único que se lee del encargo crudo (`resolucion.encargo.partes`) son
 * los DOS campos estructurados que `validarEncargo` no reproyecta en `ParteResuelta` — `Parte.concepto` (el único
 * concepto de una `definicion`) y `Parte.supuestos` (los ids que una `simulacion` cita) — nunca `preguntaOriginal`
 * ni `Supuesto.cita`. Cero `cuandoAplica`: los disparadores léxicos de los playbooks (`agente/playbooks/registro.js`)
 * NO se usan acá — un playbook se activa por FRASE, y este archivo decide por FORMA (la `Resolucion` tipada).
 *
 * REUSA SIN COPIAR:
 *   · `agente/contratoComercial.js:pasosDelContratoComercial` — las cinco lecturas cuando el tema es comercial.
 *   · `agente/contratoDeDominios.js:pasosDeDominios` — YA recibe `{ dominios, eje }` objetos (nunca texto): es la
 *     pieza que este corte más aprovecha, porque ya compone comercial+inventario+cobranza sin leer una frase.
 *   · `agente/prioridadIntegrada.js` — NO se llama acá (opera sobre `figs` ya leídas, en la etapa de composición);
 *     el cierre `decision` corre las MISMAS lecturas que `lectura` para sus temas — es lo que `prioridadIntegrada`
 *     necesita para poder leer las señales después.
 *   · `oracle/toolRegistry.js:compareEntities` — el cierre `comparacion`.
 *   · `oracle/toolRegistry.js:simulate{General,Carga,Capital,Costo}` — el cierre `simulacion`, con el `productor`
 *     que ya resolvió `validar.js` (`Resolucion.supuestos[].productor`, contrato §3.5): este archivo NUNCA vuelve
 *     a decidir el productor, solo arma los args de la tool que `validar.js` ya nombró.
 *   · `agente/herramientasAgente.js:cobranza` (mesaFlujo) — el productor de cobranza en TODOS los cierres: no vive
 *     en `oracle/toolRegistry.js:TOOLS` (esa caja es la del oráculo puro); vive en la caja EXTENDIDA del agente
 *     (`cajaDelAgente`), la misma que ya usa `contratoDeDominios.js:_PASOS_COBRANZA`. `REGISTRO_LECTURAS` de acá
 *     es esa caja — hay que pasarla a `runPlan(plan, { registry: REGISTRO_LECTURAS })`, si no, `cobranza` sale
 *     "tool desconocida".
 *
 * LOS PLAYBOOKS DE `agente/playbooks/*` (margenEnRiesgo, etc.) NO se importan acá. Se investigó: sus `pasos` son
 * subconjuntos de lo que YA corre `pasosDelContratoComercial()` (margenEnRiesgo: marginRead(bajo_benchmark) +
 * diagnose() — las DOS primeras de las cinco del contrato comercial) o de `pasosDeDominios` (cobranza, lecturaPorEje)
 * — nada de lo que un playbook trae por FORMA (`pasosDe(playbook, pregunta)`, que hoy recibe la pregunta en TEXTO
 * para decidir el EJE de "lectura por eje") es necesario acá: el eje de una `Parte` YA es un campo tipado
 * (`ParteResuelta.eje`), así que la decisión que `pasosDe` tomaría leyendo la frase la toma acá leyendo el campo.
 * Si una etapa futura necesita un playbook que compone algo que ni `pasosDelContratoComercial` ni `pasosDeDominios`
 * cubren, la extensión pedida por el encargo es la de la cabecera del corte: una entrada NUEVA en ese playbook que
 * reciba la `Parte`/`Resolucion` en vez de `pregunta` — aditiva, sin tocar `pasos` (función de texto) que sigue
 * sirviendo al camino natural mientras exista. Hoy no hace falta: se deja escrito para la próxima vez que sí.
 *
 * PURO frente al ENCARGO (nunca lee `preguntaOriginal`/`.cita`) pero NO offline-puro frente al TENANT: como
 * `pasosDeDominios` (que ya lee `getTenantData()` para saber si el tenant trae inventario/cobranza/serie con
 * unidades), este archivo hereda esa dependencia — determinístico por tenant + versión de datos, igual que
 * `validarEncargo`. Nada de red, nada de LLM, nada de Math.random ni Date.now().
 *
 * `lecturasDe(resolucion) → { plan: { intent, calls: [{tool,args}] }, porParte: { [parteId]: [{tool,args,para}] } }`
 *   `plan` es lo que se le pasa a `runPlan` (con `registry: REGISTRO_LECTURAS`, más abajo). `porParte` es la traza:
 *   qué llamadas sirven a qué parte (las de `lectura`/`decision` se ATRIBUYEN por tool → tema, `_temaDeCall`, best
 *   effort de trazabilidad — no es una segunda validación de negocio, ver su comentario). */
import { TOOLS } from "../oracle/toolRegistry.js";
import { cajaDelAgente } from "../agente/herramientasAgente.js";
/* `pasosDelContratoComercial` NO se importa directo: `pasosDeDominios` (abajo) ya la llama por dentro cuando el
 * tema comercial participa sin eje explícito — importarla acá sería una segunda invocación que nadie usa. */
import { pasosDeDominios } from "../agente/contratoDeDominios.js";
import { sujetoDeTema, metricaCoreDe, productorDe } from "./esquema.js";
import { dominioPorId } from "../../config/contract/dominios.js";
import { dominioDeClave, polaridadDeClave } from "../notario/lexico.js";
import { resolveEntityRef } from "../oracle/entityIndex.js";

/* LA CAJA EXTENDIDA (owner 2026-08-30, F2 · ADI Agente): `cobranza` y `rolesCartera` —las dos que
 * `pasosDelContratoComercial`/`pasosDeDominios` ya citan por nombre— viven en `cajaDelAgente`, no en `TOOLS` del
 * oráculo puro. Se exporta para que el LLAMADOR (el gate, y más adelante `entrega/componer.js`) pase SIEMPRE este
 * registro a `runPlan`, nunca `TOOLS` a secas — si no, esas dos tools salen "desconocida" y el plan degrada honesto
 * pero incompleto. */
export const REGISTRO_LECTURAS = cajaDelAgente(TOOLS);

/* ── conceptos SIN fuente declarativa en `metricRegistry.js` (contrato §3.3, la tabla residual de `esquema.js`):
 * cada familia tiene UN productor fijo, sea cual sea el eje que le llegue (el eje lo filtra `validar.js` — acá ya
 * llegó validado). El orden de estas listas es el de la tabla del contrato, no arbitrario. ─────────────────────── */
const _FAM_DIAGNOSE = new Set(["no_capturada", "carga_alta", "brecha", "brecha_precio_costo"]);
const _FAM_CAPITAL_FRENADO = new Set(["capital_frenado", "capital_inmovilizado", "dias_sin_venta", "margen_inventario"]);
/* markup/peso_costo NO tienen familia acá (corrección del contraste, `esquema.js:_PRODUCTOR_RESIDUAL`, con
 * evidencia): `specRetrieval.js` calcula esos dos valores pero nunca los publica como `fig()` — ni `marginRead`
 * ni `entityRecord` traen una cifra autorizada que citar. `ejesConProductor("markup"|"peso_costo") === []` en
 * TODOS los ejes, así que `validar.js` ya nunca deja esas claves en `ParteResuelta.conceptos` — este archivo no
 * necesita una rama que jamás se alcanza. Si `specRetrieval.js` llega a publicar el fig, la corrección es la
 * inversa: reabrir la fila en `esquema.js` y agregar la familia acá. */
const _FAM_VS_ANTERIOR = new Set(["variacion", "variacion_usd", "ventas_anterior"]);
const _FAM_VS_PRESUPUESTO = new Set(["vs_presupuesto", "vs_presupuesto_usd"]);
const _FAM_COBRANZA = new Set(["venta_credito", "saldo_vencido", "saldo_pendiente", "saldo_por_vencer", "abonado", "recuperado", "dias_vencido"]);
/* CORTE 3d, revisión de calidad del supervisor (2026-09-25, evidencia con crudo real) — `markup` SÍ tiene
 * productor: `agente/herramientasAgente.js:rolesCartera()` publica "{cliente} · Markup sobre costo" con `raw`
 * real, client-only, sin `dimension` (es una lectura de CARTERA, no un group-by con eje — mismo patrón que
 * `_FAM_DIAGNOSE`/`_FAM_CAPITAL_FRENADO`/`_FAM_COBRANZA` de abajo: la tool ignora el eje pedido porque su ruteo
 * es siempre el mismo). Cobertura PARCIAL (cuentas "que caen" + sanos de una huella, no toda la cartera) — el
 * mismo tipo de cobertura que ya tienen `no_capturada`/`carga_alta` (vía diagnose). `peso_costo` NO entra acá:
 * no tiene un `fig()` propio autorizado por ningún playbook (ver la nota de `esquema.js:_PRODUCTOR_RESIDUAL`),
 * viaja solo por el auto-walk de facts — reportado al supervisor, no cableado como productor de un concepto. */
const _FAM_MARKUP = new Set(["markup"]);

/** la llamada (o llamadas) que sirve UN concepto por UN eje, group-by, sin entidad puntual (contrato §3.3). */
function _callsDeConceptoEje(tema, concepto, eje) {
  if (tema === "cobranza" || _FAM_COBRANZA.has(concepto)) {
    return [{ tool: "cobranza", args: {}, para: `${concepto} de la cartera de cobranza (mesaFlujo, la misma mesa que la pestaña)` }];
  }
  if (_FAM_DIAGNOSE.has(concepto)) {
    return [{ tool: "diagnose", args: {}, para: `${concepto} — el detector de brecha comercial, por cliente (contrato §3.3)` }];
  }
  if (_FAM_CAPITAL_FRENADO.has(concepto)) {
    return [{ tool: "inventoryStatus", args: { focus: "frenado" }, para: `${concepto} — capital frenado por ${eje} (mesaCapital)` }];
  }
  if (_FAM_VS_ANTERIOR.has(concepto)) {
    return [{ tool: "salesRead", args: { focus: "vs_anterior", dimension: eje }, para: `${concepto} por ${eje} (salesRead vs_anterior)` }];
  }
  if (_FAM_VS_PRESUPUESTO.has(concepto)) {
    return [{ tool: "salesRead", args: { focus: "vs_presupuesto", dimension: eje }, para: `${concepto} por ${eje} (salesRead vs_presupuesto)` }];
  }
  if (_FAM_MARKUP.has(concepto)) {
    return [{ tool: "rolesCartera", args: {}, para: `${concepto} — el papel de cada cuenta y su markup sobre costo, por cliente (contrato §3.3)` }];
  }
  const metrica = metricaCoreDe(concepto) || concepto;
  return [{ tool: "queryMetric", args: { metric: metrica, dimension: eje }, para: `${concepto} por ${eje} (METRICS.${metrica})` }];
}

/* R-DIRECCION-PEOR-MEJOR (supervisor 2026-09-26, segunda vuelta) — `direccion` de `universo.top` acepta CUATRO
 * valores (contrato §2, `hechos.js:_ENUM.direccion`: mayor · menor · peor · mejor), pero acá solo se traducía
 * "menor" a `asc` — "peor"/"mejor" (y hasta "mayor" mal escrito) caían todos al `else` como si fueran "mayor",
 * sin mirar la POLARIDAD de la métrica: para «margen», peor es MENOR; para «saldo vencido», peor es MAYOR — la
 * MISMA resolución que ya usa el Notario para el mismo campo (`notario/verificar.js:_topTipado`, líneas ~540-545)
 * contra `polaridadDeClave` (notario/lexico.js, la fuente única — nunca una segunda tabla de polaridad acá).
 * `direccion:"peor"/"mejor"` sobre una métrica SIN polaridad declarada no se puede resolver acá (esta función no
 * tiene la evidencia que el Notario sí tiene para declarar el error): se sirve el default de siempre (`desc`,
 * como "mayor"), documentado — la defensa en profundidad de `entrega/componer.js:_entidadesDelTopVerificado` lo
 * corrige de todos modos cuando hay `indice` a mano, porque esa sí resuelve contra la polaridad real. */
function _dirAscDesc(direccionPalabra) { return direccionPalabra === "menor" ? "asc" : "desc"; }
function _direccionDeTop(direccion, metrica) {
  const dir = String(direccion || "mayor").toLowerCase();
  if (dir === "peor" || dir === "mejor") {
    const pol = polaridadDeClave(metrica);
    const peorEs = pol === "mayor" ? "menor" : pol === "menor" ? "mayor" : null;
    if (peorEs) return _dirAscDesc(dir === "peor" ? peorEs : (peorEs === "mayor" ? "menor" : "mayor"));
  }
  return _dirAscDesc(dir === "menor" ? "menor" : "mayor");
}
/* ── cierre `cifra` (contrato §1.1: productor `queryMetric / entityRecord / gridTable / mesaFlujo / mesaCapital`) */
function _pasosCifra(p) {
  const eje = p.eje;
  if (p.tema === "cobranza") {
    // mesaFlujo es SIEMPRE por cliente (contrato §3.3): una entidad puntual o la cartera entera pasan por la
    // MISMA tool — la fila de un cliente puntual la recorta la Entrega, no una segunda llamada.
    const quien = p.entidades.length ? p.entidades.map((e) => e.nombre).join(", ") : "la cartera";
    return [{ tool: "cobranza", args: {}, para: `cobranza de ${quien} (mesaFlujo)` }];
  }
  if (p.entidades.length) {
    // LA FILA COMPLETA de cada entidad (entityRecord: "TODAS sus columnas reales del dato") — cubre de sobra
    // cualquier concepto puntual de comercial/inventario que la parte haya pedido, sin adivinar cuál.
    // RC12 (owner, diagnostico.md §RC12 — MATERIAL, el contrato §3.4 ejemplifica comparar bodegas): `entityRecord`
    // SOLO tiene fuente para sku/cliente/marca/familia (`entityRecord.js:_sources`, `default: return null`) — una
    // entidad de eje bodega/canal SIEMPRE fallaba ahí, aunque `productorDe(concepto, eje)` sea `true` (el camino
    // de listado/group-by SÍ la sirve). Esas entidades van por el MISMO camino que un `cifra` sin entidades
    // (group-by de `queryMetric`/etc. por ese eje, SIN filtro de entidad — un filtro `{bodega: nombre}` redirige
    // a `entityRecord` otra vez, `toolRegistry.js:queryMetric` líneas 230-232): el compositor
    // (`_planCifraEntidad`, componer.js) ya filtra las figs resultantes por `entidad === nombre`, así que no hace
    // falta una segunda ruta de composición — solo la llamada correcta, por CONCEPTO PEDIDO (sin `conceptos`
    // declarados no hay «fila completa» posible en este camino: nada que listar).
    const out = [];
    for (const e of p.entidades) {
      // RC-G (diagnóstico v2, supervisor 2026-09-26 — MATERIAL, misma familia que RC12 del diagnóstico v1):
      // `entityRecord.js:_sources` SOLO tiene fuente comercial para los ejes "marca"/"familia" (marcasMargen/
      // marcasVentas, sfamiliasMargen/sfamiliasVentas) — una entidad de esos dos ejes para un TEMA que no es
      // comercial (inventario: capital por marca/familia SÍ existe, contrato §3.3) siempre fallaba ahí, aunque
      // `productorDe(concepto, eje)` sea `true`. RC12 ya resolvió el mismo defecto para bodega/canal (ningún eje
      // de esos dos tiene fuente en `entityRecord` para NINGÚN tema); acá se generaliza la MISMA regla — no es un
      // caso por eje, es "cuando `entityRecord` no sirve este (tema, eje), usar el listado/group-by que sí lo
      // sirve, filtrado a la entidad por el compositor" — a marca/familia cuando el tema no es comercial (el
      // único caso, hoy, en que `entityRecord` SÍ tiene fuente para esos dos ejes).
      const sinFuenteEnEntityRecord = e.eje === "bodega" || e.eje === "canal"
        || ((e.eje === "marca" || e.eje === "familia") && p.tema !== "comercial");
      if (sinFuenteEnEntityRecord) {
        for (const c of (p.conceptos || [])) out.push(..._callsDeConceptoEje(p.tema, c, e.eje));
        continue;
      }
      out.push({ tool: "entityRecord", args: { dimension: e.eje, entity: e.nombre }, para: `la fila completa de ${e.nombre} (entityRecord)` });
    }
    return _dedupeCalls(out);
  }
  if (p.universo && p.universo.top && p.universo.top.metrica) {
    const { metrica, k, direccion } = p.universo.top;
    const ejeUniverso = p.universo.eje || eje;
    // R-SORT-DIRECCION-IGNORADA (supervisor 2026-09-26, MATERIAL, ESTRUCTURAL, la más grave de la ronda: «los 3
    // más chicos» servía los 3 más grandes) — `specRetrieval.js:composeSpecRetrieval` lee `sort.dir` (un OBJETO,
    // `{dir:"asc"|"desc"}`: así lo mandan TODOS los demás llamadores, `answerADIFromSpec.js`/`coerceChain.js`).
    // Acá se mandaba un STRING a secas (`"asc"`/`"desc"`): `sort.dir` sobre un string es SIEMPRE `undefined`, así
    // que `dir` caía SIEMPRE a `"desc"` sin importar `direccion` — un top «menor» servía el extremo opuesto,
    // siempre, en silencio. Se manda la FORMA que el productor espera, nunca texto.
    const out = [{ tool: "queryMetric", args: { metric: metricaCoreDe(metrica) || metrica, dimension: ejeUniverso, sort: { dir: _direccionDeTop(direccion, metrica) }, limit: k }, para: `el top ${k} de ${ejeUniverso} por ${metrica} (universo.top)` }];
    // los OTROS conceptos de la parte, por el mismo eje SIN recorte: la Entrega selecciona de ahí las filas del
    // top ya fijado arriba — dos rankings por separado, nunca una segunda decisión de universo.
    for (const c of p.conceptos) { if (c === metrica) continue; out.push(..._callsDeConceptoEje(p.tema, c, ejeUniverso)); }
    return _dedupeCalls(out);
  }
  if (p.universo && Array.isArray(p.universo.filtros) && p.universo.filtros.length) {
    const out = [];
    for (const f of p.universo.filtros) {
      const ref = f && (f.ref || f.metrica);
      if (ref === "nivel_carga" || f.metrica === "carga") out.push({ tool: "diagnose", args: {}, para: "el universo sobre el nivel de carga — mismo detector que lo declaró (contrato §3.3)" });
      else if (ref === "benchmark" || f.metrica === "margen") out.push({ tool: "marginRead", args: { focus: "bajo_benchmark", dimension: "cliente" }, para: "el universo bajo el benchmark — mismo detector que lo declaró (contrato §3.3)" });
    }
    for (const c of p.conceptos) out.push(..._callsDeConceptoEje(p.tema, c, p.universo.eje || eje));
    return _dedupeCalls(out);
  }
  // group-by listing: eje sin entidades ni universo — un concepto, una o más llamadas.
  const out = [];
  for (const c of p.conceptos) out.push(..._callsDeConceptoEje(p.tema, c, eje));
  return _dedupeCalls(out);
}

/* ── cierre `comparacion` (contrato §1.1: EXACTAMENTE 2 entidades del MISMO eje → `compareEntities`) ──────────── */
function _pasosComparacion(p) {
  if (p.entidades.length !== 2 || p.entidades[0].eje !== p.entidades[1].eje) return [];
  return [{ tool: "compareEntities", args: { dimension: p.entidades[0].eje, entities: p.entidades.map((e) => e.nombre) }, para: `comparación ${p.entidades.map((e) => e.nombre).join(" vs ")}` }];
}

/* ── cierre `simulacion` (contrato §3.5: el PRODUCTOR ya lo resolvió `validar.js`, acá solo se arman los args) ─── */
function _callDeSupuesto(s) {
  const alcance = s.alcance;
  const esNegocio = alcance === "negocio";
  const nombre = esNegocio ? null : (alcance && alcance.nombre) || null;
  const ejeAlcance = esNegocio ? null : (alcance && alcance.eje) || null;
  // CORREGIDO (owner 2026-09-26, CORTE 3d — hallazgo de raíz, «96 filas de clientes no pedidos» en D27) —
  // `oracle/specRetrieval.js:_scopeRows` exige `entityScope.entities` (un ARRAY dentro de esa clave; ver
  // `oracle/toolContracts.js`, el otro productor de este mismo campo: `entityScope: { entities }`). Este archivo
  // pasaba `[nombre]` — un array A SECAS, sin la clave `.entities` — así que `Array.isArray(entityScope.entities)`
  // daba `false` (un array no tiene esa propiedad) y el filtro por entidad se saltaba EN SILENCIO: la simulación
  // corría sobre las 13 cuentas del tenant en vez de la UNA que el supuesto citaba. Mismo defecto para
  // simulateCarga/simulateCapital/simulateCosto (los tres consumen `entityScope` vía `_scopeRows`).
  const entityScope = nombre ? { entities: [nombre] } : null;
  if (s.productor === "simulateGeneral") {
    // simulateGeneral exige DOS variables de rol distinto (precio · volumen), cada una con su delta — contrato
    // §3.5: "price" mueve precio, "growth" mueve volumen; la variable que el supuesto NO trae viaja en 0 (el
    // usuario no declaró ese movimiento, así que su delta es cero, nunca inferido de otra cifra).
    const variableA = { campo: "precioLista", delta_pct: s.tipo === "price" ? s.valor : 0 };
    const variableB = { campo: "unidades", delta_pct: s.tipo === "growth" ? s.valor : 0 };
    return { tool: "simulateGeneral", args: { dimension: ejeAlcance, entity: nombre, variableA, variableB }, para: `simulación ${s.tipo} (${s.valor}${s.unidad}) sobre ${nombre || "el negocio"} (simulateGeneral)` };
  }
  if (s.productor === "simulateCarga") {
    return { tool: "simulateCarga", args: { entityScope, delta_pp: s.valor }, para: `simulación de carga (${s.valor}pp) sobre ${nombre || "la cartera"} (simulateCarga)` };
  }
  if (s.productor === "simulateCapital") {
    return { tool: "simulateCapital", args: { entityScope }, para: `liberar el capital frenado de ${nombre || "el SKU"} (simulateCapital)` };
  }
  if (s.productor === "simulateCosto") {
    // scope:"all" — el supuesto apunta a UNA entidad puntual (entityScope); el filtro "bajo_benchmark" de
    // simulateCosto es del modo SIN entidad (mover el costo de todo el eje bajo la vara) y la excluiría si ya
    // está sobre el benchmark, que no es la pregunta que el supuesto puntual hace.
    return { tool: "simulateCosto", args: { dimension: ejeAlcance, entityScope, pct: s.valor, scope: "all" }, para: `simulación de costo (${s.valor}%) sobre ${nombre || "el eje"} (simulateCosto)` };
  }
  return null;
}
function _pasosSimulacion(p, supuestosResueltos, citadosPorParte) {
  const citados = citadosPorParte.get(p.id) || [];
  const out = [];
  for (const sid of citados) {
    const s = (supuestosResueltos || []).find((x) => x.id === sid);
    if (!s) continue;   // el gate del corte 1 ya lo declara en noResuelto; acá simplemente no hay llamada que armar
    const call = _callDeSupuesto(s);
    if (call) out.push(call);
  }
  return out;
}

/* ── cierre `definicion` (contrato §1.1: exige `concepto`, prohíbe cifras — `defineConcept` nunca lee la boleta) */
function _pasosDefinicion(p, conceptoPorParte) {
  const concepto = conceptoPorParte.get(p.id);
  if (!concepto) return [];
  return [{ tool: "defineConcept", args: { concept: concepto }, para: `definición de ${concepto} (defineConcept)` }];
}

/* ── cierres `lectura` y `decision` (contrato §1.1: `decision` corre lo que `prioridadIntegrada` necesita LEER
 * después — las MISMAS lecturas que `lectura` para sus temas; `prioridadIntegrada` no se llama acá, opera sobre
 * los `figs` que estas llamadas van a producir, en la etapa de composición). Se agrupan TODAS las partes con
 * estos dos cierres de una vez (mismo criterio que `pasosDeDominios`: el `multi` de dos temas juntos trae MÁS
 * pasos que la suma de cada uno por separado — `_INV_CRUCE`, `_COM_POR_EJE` bajo `multi`) — es la pieza que este
 * corte reusa completa, sin copiar una línea de su cuerpo. */
function _pasosLecturaDecision(partes) {
  if (!partes.length) return [];
  const dominios = [...new Set(partes.map((p) => p.tema))];
  // el primer eje EXPLÍCITO (≠ el sujeto por defecto del tema) entre estas partes — el mismo campo que ya resolvió
  // `validar.js` en `ParteResuelta.eje`; nunca se relee una frase para encontrarlo.
  let eje = null;
  for (const p of partes) { if (p.eje && p.eje !== sujetoDeTema(p.tema)) { eje = p.eje; break; } }
  let out = pasosDeDominios({ dominios, eje });
  // LA GRIETA DE UN SOLO TEMA CON EJE EXPLÍCITO (documentada, corte 3a): `pasosDeDominios` solo agrega la lectura
  // comercial POR EJE (`_COM_POR_EJE`) cuando participan DOS o más dominios (`multi`); con un único tema comercial
  // y un eje explícito (p. ej. "el margen por marca", sin que inventario/cobranza participen) devuelve `[]` para
  // esa parte. Ningún caso del catálogo de desarrollo lo ejercita hoy (D20 es de dos temas), así que se documenta
  // en vez de tocar `contratoDeDominios.js` sin un caso que lo pida: si aparece, cae acá, por concepto y eje —
  // mismo camino que el group-by de `cifra`, para no inventar una segunda regla de composición.
  if (!out.length && dominios.length === 1 && eje) {
    // RC8 (owner, diagnostico.md §RC8, punto 1): `conceptos` SIN declarar (`Parte.conceptos` vacío/ausente) es,
    // por contrato (§1: "lo que el procedimiento del tema sirva"), NO "nada que pedir" — antes el bucle solo
    // recorría lo DECLARADO, así que una parte "dame el margen por familia" (eje explícito, sin conceptos)
    // producía `plan.calls: []` y la Entrega fallaba con "el encargo no generó ninguna lectura del Core". Sin
    // conceptos declarados, se usan TODOS los del tema con productor en ESE eje (mismo criterio que ya usa
    // `validar.js:_validarConcepto` vía `productorDe`, nunca una segunda tabla).
    const declarados = partes.flatMap((p) => p.conceptos || []);
    const metricasDelTema = (dominioPorId(dominios[0]) && dominioPorId(dominios[0]).metricas) || [];
    const conceptos = new Set(declarados.length ? declarados : metricasDelTema.filter((c) => productorDe(c, eje)));
    for (const c of conceptos) out.push(..._callsDeConceptoEje(dominios[0], c, eje));
  }
  // RC-B (diagnóstico v2, supervisor 2026-09-26 — MATERIAL, la raíz que más fallas explica): `vs_presupuesto`/
  // `vs_presupuesto_usd` es un concepto que `validar.js` YA acepta con productor (contrato §3.3, corregido en el
  // corte 3a) pero que las lecturas FIJAS de arriba (`pasosDeDominios`/`pasosDelContratoComercial`, el `salesRead`
  // que traen es SIEMPRE el de foco por defecto) nunca leen — así que un `lectura`/`decision` que lo declara
  // (con entidad, como W36, o sobre la cartera entera, como W37) nunca lo trae al turno: no aparece en Cifras y
  // el Notario declara «no-verificable» una premisa (`variacion` con `periodo:"presupuesto"`) que el Core SÍ
  // puede verificar de verdad. Mismo criterio que `_pasosCifra`/`_callsDeConceptoEje` ya usan para `cifra`: si
  // ALGUNA parte de este grupo declaró el concepto y ninguna llamada YA planeada trae ese foco, se agrega — nunca
  // se reemplaza lo que el contrato ya trae. NO se usa `unirPasosDeDominios` (que agrupa por NOMBRE DE TOOL para
  // `salesRead`: colapsaría este `salesRead{focus:"vs_presupuesto"}` contra el `salesRead` default del contrato
  // comercial, que es justo el bug) — se hace la unión por tool+args EXACTO, el mismo criterio de `_dedupeCalls`
  // que ya cierra esta función más abajo (`lecturasDe`, línea ~330).
  const conceptosDeclarados = new Set(partes.flatMap((p) => p.conceptos || []));
  if (conceptosDeclarados.has("vs_presupuesto") || conceptosDeclarados.has("vs_presupuesto_usd")) {
    const yaTrae = out.some((c) => c.tool === "salesRead" && c.args && c.args.focus === "vs_presupuesto");
    if (!yaTrae) {
      const pConVsPresupuesto = partes.find((p) => (p.conceptos || []).includes("vs_presupuesto") || (p.conceptos || []).includes("vs_presupuesto_usd"));
      const temaVs = (pConVsPresupuesto && pConVsPresupuesto.tema) || dominios[0];
      const ejeVs = (pConVsPresupuesto && pConVsPresupuesto.eje) || eje || sujetoDeTema(temaVs);
      out.push({ tool: "salesRead", args: { focus: "vs_presupuesto", dimension: ejeVs }, para: "vs_presupuesto — declarado por el encargo, no cubierto por las lecturas fijas del contrato comercial (RC-B)" });
    }
  }
  return out;
}

/* la clasificación tool→tema es de TRAZABILIDAD (`porParte`), no una segunda validación de negocio: si una tool
 * sirve dos temas (queryMetric), se distingue por la métrica pedida. Nunca se usa para decidir QUÉ corre — eso ya
 * lo decidió `pasosDeDominios`/`pasosDelContratoComercial` arriba. */
const _TOOLS_COBRANZA = new Set(["cobranza"]);
const _TOOLS_INVENTARIO = new Set(["inventoryStatus", "tensionRead"]);
const _TOOLS_COMERCIAL = new Set(["salesRead", "marginRead", "contributionRead", "diagnose", "rolesCartera", "trend"]);
const _METRICAS_INVENTARIO = new Set(["capital", "doh", "stock", "rotacion"]);
function _temaDeCall(call) {
  const tool = call && call.tool;
  if (_TOOLS_COBRANZA.has(tool)) return "cobranza";
  if (_TOOLS_INVENTARIO.has(tool)) return "inventario";
  if (_TOOLS_COMERCIAL.has(tool)) return "comercial";
  if (tool === "queryMetric") return _METRICAS_INVENTARIO.has(call.args && call.args.metric) ? "inventario" : "comercial";
  return null;
}

/* dedupe EXACTO (tool + args, byte a byte vía JSON): dos llamadas iguales colapsan en una — nunca dos llamadas
 * DISTINTAS con el mismo nombre de tool (dos `queryMetric` con distinto `metric`/`dimension` son dos lecturas). */
function _dedupeCalls(calls) {
  const vistos = new Set();
  const out = [];
  for (const c of calls) {
    if (!c || !c.tool) continue;
    const clave = JSON.stringify({ tool: c.tool, args: c.args || {} });
    if (vistos.has(clave)) continue;
    vistos.add(clave);
    out.push(c);
  }
  return out;
}

/* ── R-EVIDENCIA-PREMISA (diagnóstico v3, supervisor 2026-09-26 — MATERIAL, la raíz más alineada con la ley del
 * owner ya aprobada, memoria `adi-flujo-producto-complemento`: «una premisa se juzga contra LO QUE ADI SABE de la
 * empresa, no contra la boleta de la parte»). Hasta acá el plan solo miraba `resolucion.partes` — una premisa
 * (`resolucion.premisas`, ya validada y tipada por `validar.js:_resolverPremisasRaiz` vía `hechos.js:validarHecho`)
 * podía declarar un (metrica, eje) que NINGUNA parte pidió (marca dentro de una lectura por cliente, familia
 * dentro de una simulación de una sola entidad): esa lectura nunca se agendaba, y `libroPremisas`
 * (`entrega/componer.js`, MISMO índice de evidencia `I` que arma este plan) la declaraba «sin-evidencia» aunque
 * el Core supiera calcularla. `_conceptosYEjesDePremisa` resuelve qué (concepto, eje) necesita CADA premisa —
 * exactamente los mismos campos tipados que ya lee `_pasosCifra`/`_pasosLecturaDecision` de una Parte — y
 * `_callsDeConceptoEje` arma la MISMA llamada que ya usa el resto de este archivo para esa combinación (nunca un
 * productor nuevo, nunca una segunda tabla).
 *
 * EL EJE de un sujeto puntual (Samsung, Línea Blanca) se resuelve con `resolveEntityRef` — el MISMO índice de
 * entidades que ya usa `validar.js` para resolver `Parte.entidades` (`oracle/entityIndex.js`): tenant-dependiente,
 * nunca de red ni de LLM, coherente con la dependencia que este archivo ya declara en su cabecera. `productorDe`
 * (esquema.js) es el MISMO candado que ya audita el pedido de una Parte: sin productor para ese (concepto, eje),
 * no hay llamada que inventar — la premisa sigue «sin-evidencia», honesto, no un intento fallido.
 *
 * ESTAS LLAMADAS VIAJAN EN EL PLAN GENERAL (comparten `I` con `libroPremisas`, `entrega/componer.js`) PERO NUNCA
 * SE ATRIBUYEN A NINGÚN `porParte[id]` — la ley que este corte no puede romper: «nunca agregan cifras ni
 * entidades a lo servido en la parte». Esa separación la garantiza `_figsDeParte` (componer.js), que solo deja
 * ver a una parte las figs de LAS LLAMADAS QUE SU PROPIO `porParte[pid]` ya declaró; una llamada que no aparece en
 * ningún `porParte[pid]` quedó fuera de esa vista, aunque su fig exista en el índice de evidencia. Tipos de
 * premisa NO cubiertos hoy (alcance de este corte, con evidencia): `estado` (el estado ya lo sirven los
 * detectores fijos de cada dominio, `pasosDeDominios`, no un concepto con productor) y `razon`/`derivada` (sus
 * operandos referencian otro hecho por id, no un `(concepto, eje)` nuevo — fuera de lo que el catálogo diagnosticó). */
function _ejeDeSujetoPremisa(sujeto) {
  const nombre = Array.isArray(sujeto) ? sujeto[0] : (sujeto && typeof sujeto === "object" ? null : sujeto);
  if (typeof nombre !== "string" || !nombre.trim() || nombre === "negocio") return null;
  const r = resolveEntityRef(nombre);
  return r && r.estado === "resuelto" ? r.dimension : null;
}
function _conceptosYEjesDePremisa(p) {
  if (!p || typeof p !== "object") return [];
  const out = [];
  const add = (concepto, eje) => { if (concepto && eje) out.push({ concepto: String(concepto), eje }); };
  const ejeDeUniverso = (u) => (u && typeof u === "object" ? u.eje : null);
  const tipo = p.tipo;
  if (tipo === "cifra") {
    add(p.metrica, ejeDeUniverso(p.universo) || _ejeDeSujetoPremisa(p.sujeto));
  } else if (tipo === "orden" || tipo === "grupo") {
    add(p.metrica, ejeDeUniverso(p.universo) || _ejeDeSujetoPremisa(p.sujeto));
  } else if (tipo === "conteo") {
    add(p.metrica, ejeDeUniverso(p.de != null ? p.de : p.universo));
  } else if (tipo === "variacion") {
    add(p.metrica, _ejeDeSujetoPremisa(p.sujeto));
  } else if (tipo === "relacion") {
    const eje = ejeDeUniverso(p.universo) || _ejeDeSujetoPremisa(p.sujeto);
    add(p.metrica, eje);
    const vs = p.relacion && p.relacion.vs;
    if (vs) {
      const vsSujeto = vs.sujeto != null ? vs.sujeto : vs.grupo;
      add(vs.metrica || p.metrica, _ejeDeSujetoPremisa(vsSujeto) || eje);
    }
  }
  return out;
}
/** callsDePremisas(premisas) → las llamadas ➕ que las PREMISAS del encargo necesitan para poder juzgarse, más
 *  allá de lo que la Parte ya pidió — SOLO para `libroPremisas`, ver la nota de arriba. */
function _callsDePremisas(premisas) {
  const out = [];
  for (const p of Array.isArray(premisas) ? premisas : []) {
    for (const { concepto, eje } of _conceptosYEjesDePremisa(p)) {
      if (!productorDe(concepto, eje)) continue;   // sin productor: nada que agendar, la premisa sigue sin-evidencia
      out.push(..._callsDeConceptoEje(dominioDeClave(concepto) || "", concepto, eje));
    }
  }
  return out;
}

/** lecturasDe(resolucion) → { plan, porParte }. Puro frente al encargo (nunca lee `preguntaOriginal`); hereda de
 *  `pasosDeDominios` la dependencia del TENANT activo (no de la red, no del LLM) — ver cabecera. */
export function lecturasDe(resolucion) {
  if (!resolucion || !Array.isArray(resolucion.partes)) return { plan: { intent: "encargo", calls: [] }, porParte: {} };

  const partesCrudas = (resolucion.encargo && Array.isArray(resolucion.encargo.partes)) ? resolucion.encargo.partes : [];
  const conceptoPorParte = new Map();     // Parte.concepto (SOLO `definicion`) — no viaja en ParteResuelta
  const citadosPorParte = new Map();      // Parte.supuestos (SOLO `simulacion`) — no viaja en ParteResuelta
  for (const cruda of partesCrudas) {
    if (!cruda || typeof cruda !== "object" || !cruda.id) continue;
    if (typeof cruda.concepto === "string") conceptoPorParte.set(cruda.id, cruda.concepto);
    if (Array.isArray(cruda.supuestos)) citadosPorParte.set(cruda.id, cruda.supuestos.filter((x) => typeof x === "string"));
  }

  const porParte = {};
  const sueltas = [];          // llamadas de cifra/comparacion/simulacion/definicion — una parte, sus llamadas
  const partesLecturaDecision = [];   // se agrupan al final (ver _pasosLecturaDecision)

  for (const p of resolucion.partes) {
    if (!p || p.estado === "no_resuelta") { if (p) porParte[p.id] = []; continue; }
    if (p.cierre === "cifra") { const c = _pasosCifra(p); porParte[p.id] = c; sueltas.push(...c); }
    else if (p.cierre === "comparacion") { const c = _pasosComparacion(p); porParte[p.id] = c; sueltas.push(...c); }
    else if (p.cierre === "simulacion") { const c = _pasosSimulacion(p, resolucion.supuestos, citadosPorParte); porParte[p.id] = c; sueltas.push(...c); }
    else if (p.cierre === "definicion") { const c = _pasosDefinicion(p, conceptoPorParte); porParte[p.id] = c; sueltas.push(...c); }
    else { partesLecturaDecision.push(p); }   // "lectura" | "decision": se agrupan
  }

  const lecturaCalls = _pasosLecturaDecision(partesLecturaDecision);
  for (const p of partesLecturaDecision) porParte[p.id] = lecturaCalls.filter((c) => _temaDeCall(c) === p.tema);

  // R-EVIDENCIA-PREMISA: se agregan DESPUÉS de fijar `porParte` (arriba) — nunca entran a esa traza, así que
  // ninguna parte las hereda como "lo servido" (ver la nota de `_callsDePremisas`).
  const premisaCalls = _callsDePremisas(resolucion.premisas);

  const todas = _dedupeCalls([...lecturaCalls, ...sueltas, ...premisaCalls]);
  return {
    plan: { intent: "encargo", calls: todas.map(({ tool, args }) => ({ tool, args: args || {} })) },
    porParte,
  };
}
