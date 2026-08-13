/* === src/adi/oracle/toolRunner.js · ARQUITECTURA C · EJECUTOR DEL PLAN (batch determinístico) ===
 * Fase 0 (andamio en sombra). El PLAN lo produce el LLM libre en la Pasada 1 (Fase 3); acá ejecutamos su BATCH:
 *   plan = { intent, rationale?, calls: [ { tool, args } ] }
 * Corre cada call contra el catálogo (TOOLS), acumula sus fig() en un LEDGER con procedencia, y devuelve el trace.
 *
 * PURO y CACHEABLE: mismo plan + mismo scenario → mismo ledger (byte-igual). Una call que falla NO tumba el turno:
 * degrada a coverage.supported=false y el LLM lo lee. Esta es la mitad DETERMINÍSTICA de C (la testeable byte-a-byte).
 *
 * NO importado por el pipeline vivo en Fase 0: se ejercita solo desde el arnés de sombra (_oracle_shadow.mjs).
 */
import { createLedger, recordCall, tiparBoleta } from "./ledger.js";
import { TOOLS } from "./toolRegistry.js";
import { diagnosticarVacio } from "./toolContracts.js";   // VERACIDAD DEL VACÍO (D7) · ver el bloque de _veraz abajo
import { resolveCanonical } from "./entityIndex.js";   // para distinguir «no cabe en la tool» de «no existe en el eje»
import { periodoDeFiguras, PERIODO_TXT } from "../../config/contract/figureType.js";
import { setToolsDeclaradas } from "../llm/telemetry.js";

// EL REGISTRO DE TOOLS SE DECLARA UNA VEZ, ACÁ (owner 2026-08-10, cierre de la certificación live). La telemetría
// necesita saber qué nombres de tool son legítimos para poder emitirlos SIN riesgo de que se le cuele un dato del
// cliente — y ese registro es `TOOLS`, que vive en toolRegistry.js. Copiarlo dentro de telemetry.js sería una
// segunda fuente que se desincroniza con la primera tool nueva; se registra desde donde está el ejecutor real.
// Efecto cero si el sink de telemetría está apagado, que es el default.
setToolsDeclaradas(Object.keys(TOOLS));

// PERÍODO/FECHA DE CORTE (owner "pase quirúrgico de confiabilidad" 2026-07-29, requisito 3: "toda respuesta
// numérica debe declarar período o fecha de corte"): UN solo punto de inyección para TODAS las tools — evita tocar
// cada composer/tool individual (eso sería el refactor amplio que el owner pidió NO hacer). `trend` ya trae su
// propio `marco_temporal` más específico (mes a mes) → no se pisa. `defineConcept` no es numérico → sin boleta,
// sin período.
//
// EL MARCO ES DE LA CIFRA, NO DE LA TOOL (owner 2026-08-09, decisión 5 · hallazgo D). Acá vivía un
// `_PERIODO_HOY = new Set(["inventoryStatus"])`: una lista de TOOLS. Fallaba en las dos direcciones, las dos
// medidas sobre el dato real:
//   · la cara Capital entera salía "año cerrado" — `queryMetric{capital}` (13/13 figs de inventario),
//     `queryMetric{rotacion}` (13/13) y `simulateCapital` (6/6) no estaban en el Set;
//   · y al revés, `inventoryStatus{top_sellers}` estampaba "foto de inventario a hoy" sobre 5 figs de VENTA ANUAL.
// Mover tools de una lista a la otra no arregla ninguno de los dos: la fila completa de un SKU (`entityRecord`)
// es genuinamente MIXTA. El marco sale ahora del TIPO de cada cifra (`figureType.UNIVERSOS[x].periodo`, el mismo
// que ya declara moneda y escala), leyendo las figs YA TIPADAS que el ledger va a grabar — no una segunda pasada.
// `facts.periodos` viaja estructurado al lado del texto para que ningún consumidor tenga que leer la frase con un
// regex; `facts.periodo` sigue siendo la frase canónica, y para un resultado mixto NOMBRA LOS DOS marcos.
function _stampPeriodo(res, figsTipadas) {
  if (!res || !res.facts || res.facts.periodo || res.facts.marco_temporal) return;
  if (!Array.isArray(res.boleta) || !res.boleta.length) return;   // sin cifras reales → no aplica
  const { familias, texto } = periodoDeFiguras(figsTipadas);
  // ninguna cifra declara marco (un resultado de puros conteos: un conteo hereda el marco de lo que cuenta y por
  // eso su universo no declara período) → queda el marco del negocio, que es el que este punto ya estampaba.
  res.facts.periodo = texto || PERIODO_TXT.anual;
  res.facts.periodos = familias.length ? familias : ["anual"];
}

// LA RAZÓN DEL VACÍO SE VERIFICA ACÁ, CONTRA LOS ARGS REALES (owner 2026-08-11, defecto D7 "ADI declina datos que
// acaba de mostrar"). Medido: el turno anterior imprime la tabla de cuatro cuentas con margen y venta, y el
// siguiente contesta que FALTAN SUS REGISTROS EN EL EJE CLIENTE. No faltaban: `compareEntities` compara de a pares
// y el plan le pasó cuatro entidades en `args`; el composer devolvió null por cardinalidad y ese null se tradujo a
// un texto que afirma ausencia de dato. El narrador solo recibe ese texto — es fiel, no tiene con qué saber otra
// cosa.
//
// POR QUÉ EL PUNTO ES ÉSTE Y NO OTRO. La capa de contrato (applyMultiEntityScope, toolContracts.js) se aplica
// contra `plan.scope`, un campo OPCIONAL del schema del planificador que el camino normal del plan no llena — y
// answerViaOracle ni siquiera se lo pasa al ejecutor. `runPlan` es el ÚNICO estrangulamiento por el que pasan las
// veinte tools con los args DEFINITIVOS (después de todos los coerce/backstop), así que es el único lugar donde la
// verificación no depende de que el LLM se haya acordado de algo.
//
// QUÉ HACE Y QUÉ NO. No cambia el veredicto: si la tool declinó, sigue declinando, `supported:false` sigue igual y
// la forma del turno no se mueve (nada acá deriva a un bypass determinístico). Solo corrige QUÉ RAZÓN se declara,
// y estampa `motivoTipo` para que la distinción viaje estructurada en vez de tener que leerse de la prosa. Toda la
// regla vive en `diagnosticarVacio`; acá se aplica sin lógica propia, para que haya UNA sola verdad.
// PURO: nunca muta la cobertura que devolvió la tool — compone una nueva.
function _veraz(name, args, res) {
  if (!res || !res.coverage || res.coverage.supported !== false) return res;
  const parche = diagnosticarVacio(name, args, res.coverage);
  return parche ? { ...res, coverage: { ...res.coverage, ...parche } } : res;
}

// runPlan(plan, opts) → { ledger, results, trace, unsupported }
//   opts.scenario        escenario base de las tools (default "actual")
//   opts.maxCalls        cap DURO de tool-calls por plan (costo/latencia · plan patológico) · default 8
//   opts.preguntaUsuario la frase LITERAL del turno del usuario (solo la lee defineConcept · ver inyección abajo)
export function runPlan(plan, { scenario = "actual", maxCalls = 8, preguntaUsuario = null } = {}) {
  const ledger = createLedger();
  const results = [];
  const unsupported = [];
  const all = (plan && Array.isArray(plan.calls)) ? plan.calls : [];
  const calls = all.slice(0, Math.max(0, maxCalls));   // cap duro (el resto se reporta como recortado)
  const dropped = all.length - calls.length;

  calls.forEach((call, i) => {
    const callId = `c${i}`;
    const name = call && call.tool;
    const tool = name && TOOLS[name];
    // ARGS TOLERANTE: el modelo a veces emite los args APLANADOS ({tool:"trend", metric:"ventas", entity:"Falabella"})
    // en vez de anidados en `args`. Antes se descartaban en silencio y la tool corría con sus DEFAULTS → respondía
    // OTRA pregunta con cifras reales (el modo de falla más peligroso: "Falabella mes a mes" narraba el negocio).
    // Acá recuperamos las keys sueltas (todo lo que no sea `tool`/`args`), sin pisar lo que venga en `args`.
    const _flat = call && typeof call === "object"
      ? Object.fromEntries(Object.entries(call).filter(([k]) => k !== "tool" && k !== "args"))
      : {};
    let callArgs = { ..._flat, ...((call && call.args) || {}) };
    const scope = callArgs.scope || callArgs.dimension || callArgs.entity || null;
    if (typeof tool !== "function") {
      const res = { facts: null, boleta: [], coverage: { supported: false, reason: `tool desconocida: '${name}'` } };
      recordCall(ledger, { tool: name || "?", callId, scope, args: callArgs }, res);
      results.push({ callId, tool: name || null, ...res });
      unsupported.push({ callId, tool: name || null, reason: res.coverage.reason });
      return;
    }
    /* EL ESCENARIO DEL TURNO LO DECIDE EL RUN, NUNCA EL PLAN (owner 2026-08-11, defecto 5 de la certificación).
     * Estaba escrito `{ scenario, ...callArgs }`, así que un `scenario` presente en los args del plan —incluso
     * `undefined`, que es lo que emite un modelo cuando "declara" el campo sin llenarlo— PISABA el del turno. Y
     * aguas abajo `composeSpecRetrieval` con `scenario: undefined` no falla: cae en `actual` en silencio.
     * MEDIDO en E1.t3 (fixtures/certificacion-f4f2949.json): la MISMA boleta llevó «Lider · Venta» = $17.8M
     * (marginRead, bonanza) y «Lider · Ventas» = $17.9M (queryMetric, con el escenario perdido → actual). Los dos
     * figs DECLARAN `tipo.escenario: "bonanza"` y uno trae el número de otro escenario: la declaración y el
     * cómputo se contradicen, y el usuario ve dos cifras para el mismo hecho en la misma tabla.
     * No es una cuestión de precedencia estética: el escenario es el marco del turno entero. Que una call lo
     * cambie por su cuenta rompe la comparabilidad de todo lo demás en esa misma boleta. */
    /* ── UNA LIMITACIÓN DE LA TOOL NO ES «FALTAN DATOS» (owner 2026-08-12, punto 6) ───────────────────────────
     * MEDIDO en E2.t2: el usuario pidió comparar Falabella, Lider, Jumbo y Sodimac —las cuatro impresas en el
     * turno anterior— y la respuesta salió con «no tengo los datos necesarios». `compareEntities` corre DE A
     * PARES, devolvió vacío, y la boleta del turno llegó con CERO figs: el narrador no tenía nada que decir
     * aunque el dato estuviera ahí.
     * `diagnosticarVacio` ya había corregido la RAZÓN («están en el eje y los tengo»), y eso sigue valiendo; pero
     * una razón honesta SIN DATOS deja al usuario igual de sin respuesta. La regla que faltaba: si el eje puede
     * servir esas entidades, el motor DESCOMPONE el pedido en la lectura multi-entidad que sí las cubre, en vez
     * de convertir su propio límite en una ausencia de dato.
     * LO QUE NO CAMBIA, y por eso se resuelve el eje antes de decidir: una entidad que de verdad NO existe sigue
     * declarada como faltante. La descomposición sirve a las que están; no inventa las que no.
     * LA COBERTURA VIAJA ESTRUCTURADA —`pedidas`, `resueltas`, `faltantes`— para que la respuesta pueda decir
     * cuántas se pidieron y cuántas se sirvieron, en vez de callarlo. */
    let _tool = tool, _nombre = name, _cobertura = null;
    const _argsOriginales = { ...callArgs };   // para que `_veraz` diagnostique el PEDIDO, no la descomposición
    {
      // LA CARDINALIDAD ES DE NOMBRES DISTINTOS, NO DE CASILLEROS. Un plan que repite una entidad —«compará
      // Falabella con Falabella y con Lider»— pide DOS, no tres: declinarlo por cupo, o descomponerlo, serían dos
      // formas del mismo error de contar mal. Se deduplica preservando el ORDEN en que el usuario las nombró.
      const pedidas = Array.isArray(callArgs && callArgs.entities) ? [...new Set(callArgs.entities.filter(Boolean))] : [];
      const dim = callArgs && callArgs.dimension;
      if (name === "compareEntities" && pedidas.length > 2 && dim && TOOLS.gridTable) {
        const enElEje = pedidas.filter((e) => resolveCanonical(dim, e));
        const inexistentes = pedidas.filter((e) => !resolveCanonical(dim, e));
        // se descompone SÓLO si el eje puede servir más de dos: con dos o menos, `compareEntities` es la lectura
        // correcta y no hay nada que reemplazar.
        if (enElEje.length > 2) {
          /* EL REEMPLAZO ES `gridTable`, Y LA RAZÓN ES MEDIBLE. Acá estuvo `marginRead`, y servía 3 de las 4
           * cuentas de E2.t2: su `focus` por defecto es `bajo_benchmark`, o sea que devuelve las cuentas que
           * están BAJO la vara — Paris, que la supera, quedaba afuera. Una comparación de cuatro cuentas
           * NOMBRADAS no puede filtrarse por un criterio que el usuario no pidió: contestar por tres y declarar
           * la cuarta faltante es honesto, pero sigue siendo media respuesta a una pregunta que el dato responde
           * entera. `gridTable` es la lectura que corresponde —esas filas × sus columnas— y trae las cuatro.
           * SE LE PASA `enElEje`, NUNCA `pedidas`: medido, `gridTable` con un nombre que no reconoce IGNORA el
           * scope y devuelve el top-N del eje entero (aparecían Jumbo, Sodimac y Tottus, que nadie pidió). Filtrar
           * antes es lo que impide que una entidad inexistente promueva el alcance a todo el eje. */
          _tool = TOOLS.gridTable; _nombre = "gridTable";
          callArgs = { dimension: dim, entityScope: enElEje, ...(callArgs.metric ? { metric: callArgs.metric } : {}) };
          _cobertura = { pedidas: pedidas.length, entidades: pedidas, inexistentes, via: "gridTable",
            motivo: "compareEntities corre de a pares; el eje sirve las N por lectura multi-entidad" };
        }
      }
    }
    /* LA PREGUNTA DEL TURNO VIAJA POR UN SOLO PUNTO, IGUAL QUE EL PERÍODO (owner 2026-08-13, caso real
     * «bajo_benchmark»). El PLAN a veces normaliza el concepto del usuario a un token interno aunque la doctrina
     * le pida las palabras textuales; defineConcept necesita la frase literal del turno como último peldaño de su
     * escalera de resolución. Se inyecta acá —el único estrangulamiento con los args definitivos— y SOLO para
     * defineConcept: ninguna otra tool cambia de firma, el schema del PLAN no se toca, y sin `preguntaUsuario`
     * (gates/callers viejos) el comportamiento es byte-idéntico al de antes.
     * inventoryStatus SE SUMA (encargo «umbral del usuario», 2026-08-13, hallazgo vivo): cuando la pregunta trae
     * un umbral numérico de días que la tool NO aplica (focus ≠ stale), la tool tiene que poder DECLARARLO en
     * facts — y el único lugar donde ese umbral existe es la frase literal del turno. Mismo mecanismo, misma
     * condición: sin `preguntaUsuario` todo es byte-idéntico. */
    const args = { ...callArgs, scenario, ...((name === "defineConcept" || name === "inventoryStatus") && preguntaUsuario ? { _preguntaUsuario: preguntaUsuario } : {}) };
    let res;
    try {
      res = _tool(args);
      /* LA DESCOMPOSICIÓN SE VERIFICA, NO SE SUPONE (owner 2026-08-12). `marginRead` sirve unos ejes y no otros:
       * aplicarla a ciegas a `familia`, `bodega` o `canal` cambiaba un diagnóstico honesto —«el pedido no cabe en
       * la tool»— por un vacío peor, sin diagnóstico. Si la lectura multi-entidad NO trajo cifras, se descarta y
       * se ejecuta la tool original: su declinación con `motivoTipo:"contrato"` es la respuesta correcta ahí.
       * Cuesta una ejecución extra de una función PURA y determinística; no cuesta una llamada al proveedor. */
      if (_cobertura && !(res && Array.isArray(res.boleta) && res.boleta.length)) {
        _tool = tool; _nombre = name; _cobertura = null;
        res = tool({ ..._argsOriginales, scenario });
      }
    } catch (e) {
      res = { facts: null, boleta: [], coverage: { supported: false, reason: `error en tool '${_nombre}': ${String((e && e.message) || e)}` } };
    }
    if (!res || typeof res !== "object") res = { facts: null, boleta: [], coverage: { supported: false, reason: "tool sin resultado" } };
    // ANTES del ledger y de los results: la razón que se GRABA tiene que ser la misma que se narra (si el parche
    // corriera después, la boleta y la evidencia quedarían citando una causa que el turno ya no afirma).
    // el diagnóstico se hace contra los args ORIGINALES: si la descomposición se descartó, lo que hay que explicar
    // es por qué el PEDIDO del usuario no cupo en la tool, no por qué falló un reemplazo que ya no está.
    res = _veraz(_nombre, _cobertura ? args : _argsOriginales, res);
    // LA COBERTURA DECLARADA · `resueltas` se mide sobre la boleta REAL (quién quedó con cifras), no sobre lo que
    // se pidió; `faltantes` es la resta, e incluye siempre a las que no existen en el eje.
    if (_cobertura) {
      const resueltas = _cobertura.entidades.filter((e) => (res.boleta || []).some((f) => String(f.label || "").startsWith(e)));
      const faltantes = _cobertura.entidades.filter((e) => !resueltas.includes(e));
      res = { ...res, coverage: { ...(res.coverage || {}), cobertura: { ..._cobertura, resueltas, faltantes } } };
    }
    // el tipado corre UNA vez: lo necesita el período (la naturaleza de cada cifra) y es lo mismo que el ledger graba.
    const meta = { tool: _nombre, callId, scope, args };
    const figsTipadas = tiparBoleta(meta, res);
    _stampPeriodo(res, figsTipadas);
    recordCall(ledger, meta, res, figsTipadas);
    results.push({ callId, tool: _nombre, ...res });
    // `motivoTipo` viaja en el unsupported (y de ahí a evidenceSpec.missing → los "límites" del panel): quien lea
    // esta lista tiene que poder distinguir "no cabía así" de "no está" sin parsear la frase.
    if (!res.coverage || res.coverage.supported === false) {
      unsupported.push({ callId, tool: name, reason: res.coverage && res.coverage.reason, ...(res.coverage && res.coverage.motivoTipo ? { motivoTipo: res.coverage.motivoTipo } : {}) });
    }
  });

  return {
    ledger,
    results,
    unsupported,
    trace: {
      intent: (plan && plan.intent) || null,
      calls: results.map((r) => ({ callId: r.callId, tool: r.tool, figCount: (r.boleta || []).length, supported: !!(r.coverage && r.coverage.supported) })),
      droppedByCap: dropped > 0 ? dropped : 0,
    },
  };
}
