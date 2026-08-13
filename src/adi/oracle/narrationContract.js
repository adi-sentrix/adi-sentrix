/* === src/adi/oracle/narrationContract.js · CONTRATO v2 · FASE 1 · EL SELLADO ===
 * (owner 2026-08-07, tras la revisión de arquitectura del Contrato de Intención y Alcance)
 *
 * EL PROBLEMA QUE RESUELVE. Hasta acá el invariante "el LLM no puede modificar entidades/métricas/períodos/
 * supuestos después de que el motor los valide" NO era validar-y-congelar: era coercionar-antes (answerViaOracle
 * pisa los args del plan) + guardar-después (guardC revisa el TEXTO ya narrado). En el medio, NARRAR recibía el
 * plan completo + los results crudos y redactaba libre. El muro de guardC es sólido para el VALOR numérico (su
 * canon es `unit:value`), pero NO para la SEMÁNTICA que lo envuelve: qué métrica, qué entidad, qué período, si es
 * supuesto o hecho. Esta sesión lo probó tres veces con cifras REALES en oraciones equivocadas (superlativo falso
 * de familia, capital atribuido al cliente en vez de al inventario, exceso de acciones comerciales confundido con
 * la brecha total) — ninguna la detectó guardC; las tres necesitaron doctrina o backstop determinístico.
 *
 * LA IDEA. La unidad de autorización deja de ser LA CIFRA y pasa a ser LA AFIRMACIÓN (claim):
 * (entidad, eje, métrica, período, unidad, valor, estatus epistémico). El motor SELLA un contrato inmutable y
 * NARRAR redacta SOLO sobre lo sellado — no porque el prompt se lo pida, sino porque no recibe otra cosa.
 *
 * FRONTERA (regla de oro del contrato v2): el LLM comprende y PROPONE; el motor canonicaliza, valida, CONGELA,
 * calcula y autoriza; el LLM narra SOLO sobre lo congelado; el guard valida valor Y binding semántico.
 *
 * QUÉ GARANTIZA ESTE MÓDULO (Fase 1, determinístico y verificable):
 *   · el contrato es INMUTABLE (deep-freeze real, no convención) — nadie río abajo puede mutarlo;
 *   · el payload de NARRAR es una PROYECCIÓN PURA del contrato (projectNarratePayload solo lee el contrato,
 *     nunca `plan` ni `results`) — la garantía es ESTRUCTURAL, no doctrinal;
 *   · cada claim lleva su estatus epistémico (probado | indicado | abierto) derivado del dato, no del prompt;
 *   · las RELACIONES entre claims (comparable/derivada/parte-de) se declaran explícitas: qué se puede comparar
 *     con qué es una decisión del motor, no una inferencia del narrador.
 *
 * QUÉ NO GARANTIZA TODAVÍA (honestidad de alcance — sigue siendo doctrina hasta Fase 2):
 *   · que el narrador RESPETE el binding (que no cuelgue una cifra real de la métrica/entidad/período equivocado).
 *     Eso lo cierra el guard estricto de Fase 2, que consume ESTE contrato como fuente de verdad del binding.
 *   · el payload todavía viaja con `datos` (los facts, la forma que el narrador consume hoy). Migrar el CONTENIDO
 *     de facts crudos → claims cambia el prompt y NO es verificable sin corridas pagadas; queda declarado como
 *     Fase 1b y NO se hace acá (el owner fijó "cada fase conserva el comportamiento actual" como puerta de deploy).
 *
 * PURO · SIN ESTADO · SIN LLM · gate-testable. No importa nada que haga red.
 */

// ── INMUTABILIDAD REAL ─────────────────────────────────────────────────────────────────────────────────────────
// Object.freeze es superficial: congela el objeto pero no sus hijos. Un contrato "sellado" cuyo `claims[3].valor`
// se puede reescribir no es un contrato. _deepFreeze recorre y congela todo el árbol. Tolera ciclos (WeakSet) por
// seguridad, aunque el contrato se construye acíclico por diseño.
// EXPORTADA (owner 2026-08-09, Contrato de Concordancia ADI↔Sentrix · mejora A): el ViewContext de Sentrix se sella
// con ESTA MISMA primitiva, no con una copia — ver viewContext.js:sealViewContext. El alias privado `_deepFreeze`
// se conserva para no tocar los usos internos de este archivo. Idempotente: volver a congelar un árbol ya congelado
// no cuesta nada, que es lo que permite sellar en el borde de transporte Y de nuevo dentro del contrato.
export function deepFreeze(obj, seen = new WeakSet()) {
  if (obj === null || typeof obj !== "object" || seen.has(obj)) return obj;
  seen.add(obj);
  for (const k of Object.getOwnPropertyNames(obj)) {
    const v = obj[k];
    if (v && typeof v === "object") deepFreeze(v, seen);
  }
  return Object.freeze(obj);
}
const _deepFreeze = deepFreeze;

// ── PARSE DEL LABEL DE BOLETA ──────────────────────────────────────────────────────────────────────────────────
// La convención "Entidad · Concepto" (boleta.js/fig + specRetrieval.js) es la MISMA que ya leen _groupByEntity /
// _needsTableFormat (narratePromptC.js) y enrichFromFacts (ledger.js): se parte en el PRIMER " · ". Un label sin
// separador es una cifra del NEGOCIO (sin dueño), no una entidad anónima — se marca entidad:null, nunca inventada.
import { resolveEntityRef } from "./entityIndex.js";                              // Fase 3 · el eje REAL de un nombre, O(1) por tenant
import { REFERENCIA_PROCEDENCIA, METRICAS_DE_REFERENCIA } from "../../config/businessPolicy.js";   // procedencia de la vara (una verdad, junto a benchmarkOf)
// CONTRATO DE RESPUESTA PROPORCIONAL (owner · Concordancia ADI ↔ Sentrix): la FORMA del turno se decide en
// progressiveDisclosure.js (junto a resolveTablePolicy, que es la misma clase de decisión) y se COMPONE acá, donde
// los claims ya están sellados — así la graduación PROBADO/INDICADO/ABIERTO nombra las métricas REALES del turno en
// vez de repetir doctrina genérica. Se sella dentro del mismo árbol congelado, no al lado.
import { ANSWER_SHAPES, buildAnswerShapeInstruction } from "./progressiveDisclosure.js";
// REPARACIÓN CONTEXTUAL (Contrato v1.2, owner 2026-08-10): el vocabulario cerrado sale del contrato versionado y
// los supuestos vivos del estado canónico — el contrato de narración no inventa ninguno de los dos.
import { normalizeReparacion } from "./conversationalContract.js";
import { aplicarPresupuestoHilo, NARRAR_HILO_PRESUPUESTO_CHARS } from "./hiloBudget.js";   // Paso 1 "ADI pierde el hilo" (2026-08-13): UNA política de presupuesto para los dos embudos, ver hiloBudget.js
import { supuestosUsuarioVivos } from "./conversationScope.js";
import { parseFigures } from "../boleta.js";   // el MISMO parser que produce el canon de la boleta — nunca un segundo
// EL TIPO DE LA CIFRA (owner 2026-08-09, decisiones 1 y 2): el sello y las reglas de verificabilidad son las MISMAS
// que aplica `fig()`. Acá sólo se refina con el eje, que este módulo sí sabe resolver — nunca se redefine.
import { SELLOS, refinarPorEje, PERIODO_MIXTO_ETIQUETA } from "../../config/contract/figureType.js";

const _SEP = " · ";
// SEGUNDA RED DEL HALLAZGO G (owner 2026-08-09). La primera es `ledger._labelDe`, que ya no emite el nombre pelado.
// Ésta no depende de aquélla: si CUALQUIER ruta (un composer viejo, una boleta derivada de texto, un tenant nuevo)
// vuelve a emitir un label sin separador que ES el nombre de una entidad real del catálogo, acá se recupera igual
// el dueño en vez de leerlo como cifra DEL NEGOCIO. El caso que importa —"Tu negocio cerró el año en $19.4M",
// siendo $19.4M de Falabella— dejaba de verse justamente porque el claim salía sin entidad.
// Un label SIN separador que NO resuelve contra el catálogo sigue siendo, como siempre, una cifra del negocio.
function _splitLabel(label) {
  const s = String(label == null ? "" : label);
  const i = s.indexOf(_SEP);
  if (i >= 0) return { entidad: s.slice(0, i).trim() || null, metrica: s.slice(i + _SEP.length).trim() };
  const solo = s.trim();
  if (solo && resolveEntityRef(solo).estado === "resuelto") return { entidad: solo, metrica: solo };
  return { entidad: null, metrica: solo };
}

// ── ESTATUS EPISTÉMICO (owner 2026-08-09, decisión 2 · reescrito sobre el TIPO de la cifra) ────────────────────
// probado  · dato directo, o cálculo determinístico exacto RECONCILIADO con sus componentes, sin supuestos.
// indicado · estimación, distribución, afinidad, supuesto o inferencia modelada. Incluye dos casos que la versión
//            anterior sellaba `probado` por no mirar más que `formula`/`source`:
//              · la DERIVADA que no reconcilia — la contribución del cliente sale de venta oficial × margen en
//                todos los escenarios y difiere del literal almacenado en 13 de 13 filas ($4.3M vs $4.1M);
//              · el campo DECLARADO por la fuente que el dato no reconstruye — días de inventario cierra contra
//                stock ÷ venta diaria en 3 de 13 filas, y rotación contra 365 ÷ días en 0 de 13.
// abierto  · lo que el dato no permite calcular ni aislar (ver también buildOpenQuestions).
// EL SELLO YA VIENE EN EL FIG (`tipo.sello`, boleta.js + config/contract/figureType.js): acá no se recalcula, se
// LEE — una sola verdad. Lo único que se agrega es lo que este módulo sabe y el fig no podía saber: el EJE real de
// la entidad, que decide si `contribución`/`costo`/`acciones comerciales` son la lectura almacenada (sku, marca:
// cierran 13/13 y 5/5) o la re-derivada del motor (cliente, familia, canal: no cierra en ninguna fila).
function _estatusDe(fig, eje = null) {
  if (!fig) return "probado";
  const base = (fig.tipo && SELLOS.includes(fig.tipo.sello)) ? fig.tipo.sello
    : (fig.formula || (fig.source && fig.source !== "actual")) ? "indicado" : "probado";
  if (base !== "probado") return base;                  // el refinamiento por eje sólo puede BAJAR de probado
  // El ESCENARIO de la cifra (estampado por ledger.recordCall) decide en los ejes que sólo re-derivan bajo
  // transformación: la contribución por FAMILIA es la re-agregación de clientes re-derivados en bonanza/tensión/
  // crisis, pero en «actual» es el literal almacenado y cierra 4/4 — sellarla indicado ahí marcaba un dato real
  // como estimación (decisión 2 del owner, corregido tras medir eje × escenario y no sólo «actual»).
  return refinarPorEje(fig.label, eje, fig.tipo && fig.tipo.escenario, _uni(fig)) ? "indicado" : base;
}
// la unidad y el universo del TIPO acotan la regla por eje a las cifras de las que de verdad habla (ver
// figureType.js): sin esto, «Costo medio unitario» —un literal que no se mueve nunca— caía bajo la regla del costo.
const _uni = (fig) => ({ unidad: (fig && fig.unit) || null, universo: (fig && fig.tipo && fig.tipo.universo) || null });
// _razonEstatus(fig, eje) → por qué esa cifra tiene ese sello. Viaja en el claim para que la respuesta pueda
// nombrarlo con la razón real del dato en vez de una fórmula genérica de prompt.
function _razonEstatus(fig, eje = null) {
  const porEje = refinarPorEje(fig && fig.label, eje, fig && fig.tipo && fig.tipo.escenario, _uni(fig));
  if (porEje && (!fig.tipo || fig.tipo.sello === "probado")) return porEje.razon;
  return (fig && fig.tipo && fig.tipo.verificabilidadRazon) || null;
}

// ══ REGLA DE PROPORCIONALIDAD SEMÁNTICA (owner 2026-08-07) ═════════════════════════════════════════════════════
// "ADI nunca puede afirmar más de lo que la evidencia autorizada demuestra."
// No es una regla nueva al costado: son CUATRO CAMPOS MÁS en el claim, que el prompt lee y el guard verifica.
// Todo se DERIVA de lo que el motor ya sabe — ningún composer tiene que declarar nada nuevo (salvo la etiqueta de
// referencia, que ya era una convención vigente y ahora está declarada en businessPolicy.js).
//
//   sujetoTipo        entidad | negocio | concepto   ← quién es el sujeto REAL de la cifra
//   procedencia       interna_empresa | externa_sector | null   ← de dónde sale la vara
//   nivelFinanciero   venta|costo|margen|contribucion|carga|resultado|null   ← qué nivel de la cascada es
//   coberturaCausal   total | parcial | no_determinada | null   ← cuánto del fenómeno explica
//   explica           {monto, universo, fraccion} | null        ← la parte y el todo, cuando ambos existen

// ── SUJETO ─────────────────────────────────────────────────────────────────────────────────────────────────────
// El `eje` del claim MENTÍA: buildClaims le estampaba a TODOS el `scope.eje` del turno, que sale del PRIMER
// facts.entityType que aparezca. Medido: executiveSummary (lectura del NEGOCIO) sellaba eje:"cliente", e
// inventoryStatus sellaba eje:"bodega" sobre un ledger que mezcla bodegas, familias y SKU (LG-DRYER8KG quedaba
// tipado como bodega). Ahora el eje se resuelve POR CLAIM contra el catálogo real del tenant, con el índice O(1)
// de Fase 3 — que además separa limpio la entidad real de la pseudo-entidad ("Capital inmovilizado", "Medida",
// "headline" son labels que _splitLabel devuelve como si fueran sujetos, y no lo son).
function _sujetoDe(entidad, ejeDelTurno) {
  if (!entidad) return { sujetoTipo: "negocio", eje: null };
  const ref = resolveEntityRef(entidad);
  if (ref.estado === "resuelto") return { sujetoTipo: "entidad", eje: ref.dimension };
  // no existe en NINGÚN eje del tenant → no es una entidad, es un concepto de la lectura. NO hereda el eje del
  // turno: heredarlo es justamente lo que producía "LG-DRYER8KG es una bodega".
  return { sujetoTipo: "concepto", eje: null, _ejeTurno: ejeDelTurno || null };
}

// ── NIVEL FINANCIERO ───────────────────────────────────────────────────────────────────────────────────────────
// La cascada real del negocio (buildPnlCascade, pnl.js): Ingreso − Costo = Margen bruto − Carga comercial =
// Contribución − Σ Gastos = Resultado. Venta positiva significa que VENDE; margen positivo, que DEJA MARGEN;
// contribución positiva, que APORTA CONTRIBUCIÓN. Ninguna autoriza por sí sola a decir "es rentable": eso exige
// un RESULTADO que ya descontó costos y gastos. Hoy `resultado` no está declarado para ejes de entidad
// (metricRegistry) y el tenant demo ni siquiera tiene P&L definido — así que en la práctica casi nunca existe,
// y esa ausencia es exactamente lo que el guard usa para bloquear la afirmación de rentabilidad.
// `\b` y no `$`: las etiquetas reales del motor traen calificador ("Venta del período", "Margen bruto",
// "Contribución del período") y sin eso quedaban sin nivel — cazado proyectando el payload de un trend de negocio.
const _NIVEL_POR_METRICA = [
  [/^ventas?\b/i, "venta"], [/^costo\b/i, "costo"], [/^margen\b/i, "margen"],
  [/^contribuci[oó]n\b/i, "contribucion"], [/^carga comercial\b/i, "carga"], [/^resultado\b/i, "resultado"],
];
function _nivelFinancieroDe(metrica) {
  const m = String(metrica || "").trim();
  for (const [re, nivel] of _NIVEL_POR_METRICA) if (re.test(m)) return nivel;
  return null;   // rotación, cobertura, unidades, ticket, capital… no son niveles de la cascada
}

// ── COBERTURA CAUSAL ───────────────────────────────────────────────────────────────────────────────────────────
// Una PALANCA (exceso de acciones comerciales, capital detenido…) explica UNA PARTE de un fenómeno mayor. El caso
// que lo motiva, con las cifras reales: "Falabella · exceso de acciones comerciales" = $194K, dentro de un
// universo de $1.574.333 (venta × benchmark − contribución) — o sea el 12,3%, equivalente a 1,0 pp de los 8,1 pp
// de brecha. Narrado suelto se lee como la explicación completa. Nunca lo es.
// El universo vive en OTRA tool ("Valor en juego" / "Contribución no capturada"), así que puede NO estar en la
// boleta del turno. Esa distinción importa y se sella: con universo → se puede declarar la fracción; sin universo
// → sigue siendo parcial, pero la fracción es INNARRABLE y el prompt lo dice explícito.
const _UNIVERSO_DE_PALANCA = [/valor en juego/i, /contribuci[oó]n no capturada/i, /brecha.*contribuci/i];
function _esUniverso(metrica) { return _UNIVERSO_DE_PALANCA.some((re) => re.test(String(metrica || ""))); }

// LA BRECHA ES EL FENÓMENO A EXPLICAR, y el producto la nombra de cuatro formas distintas en la misma boleta
// («Medida · cerrar brecha al piso», «Lider · Valor en juego», «Falabella · no capturada», «brecha de margen»).
// Se reconoce por MÉTRICA o por ETIQUETA porque el composer no siempre deja la clase en `metrica`, y una brecha
// que no se reconoce es una brecha que nadie audita. Se excluye la carga/exceso: eso es la PALANCA, no el fenómeno.
const _BRECHA_RE = /\bbrecha\b|valor en juego|no capturad|sin capturar|cerrar brecha|margen perdido|contribuci[oó]n dejada/i;
const _ES_BRECHA = (c) => !!c && _BRECHA_RE.test(`${c.metrica || ""} ${c.etiqueta || ""}`)
  && !/exceso|carga comercial/i.test(`${c.metrica || ""} ${c.etiqueta || ""}`);

// ── CLAIMS ─────────────────────────────────────────────────────────────────────────────────────────────────────
// buildClaims(ledgerFigs, {eje, periodo}) → la boleta convertida en AFIRMACIONES tipadas. Cada claim conserva el
// `canon` original de la fig (unit:value) para que el guard de Fase 2 pueda atar el binding sin recalcular nada.
// El orden se preserva (la boleta ya viene ordenada por el composer — el orden es información).
export function buildClaims(ledgerFigs, { eje = null, periodo = null } = {}) {
  const figs = Array.isArray(ledgerFigs) ? ledgerFigs : [];
  const base = figs.filter(Boolean).map((f, i) => {
    const { entidad, metrica } = _splitLabel(f.label);
    const suj = _sujetoDe(entidad, eje);
    return {
      id: `c${i}`,
      entidad,
      // PROPORCIONALIDAD SEMÁNTICA · el sujeto real, resuelto por claim contra el catálogo del tenant (ver
      // _sujetoDe): deja de heredar a ciegas el eje del turno, que en ledgers multi-eje mentía.
      sujetoTipo: suj.sujetoTipo,
      eje: suj.eje,
      metrica,
      periodo,
      unidad: f.unit || null,
      valor: f.value,                     // string YA formateado (verbatim, una sola verdad con el texto)
      valorRaw: typeof f.raw === "number" ? f.raw : null,
      estatus: _estatusDe(f, suj.eje),
      estatusRazon: _razonEstatus(f, suj.eje),
      // EL TIPO COMPLETO (decisión 1) viaja con el claim: moneda, escala, período, escenario, universo,
      // entidad/dimensión, fuente y unidad. El guard lo lee para juzgar cruces entre universos que no reconcilian.
      tipo: f.tipo || null,
      universo: (f.tipo && f.tipo.universo) || null,
      // PROCEDENCIA · una REFERENCIA no es una medición del negocio. Las tres capas de benchmarkOf son internas
      // de la empresa, así que se narra "tu benchmark"/"tu referencia" — nunca sectorial (ver businessPolicy.js).
      procedencia: METRICAS_DE_REFERENCIA.includes(metrica) ? REFERENCIA_PROCEDENCIA : null,
      // NIVEL FINANCIERO · qué escalón de la cascada es esta cifra. Solo `resultado` sostiene "es rentable".
      nivelFinanciero: _nivelFinancieroDe(metrica),
      coberturaCausal: null,              // se completa abajo: necesita ver TODOS los claims del turno
      explica: null,
      obligatoria: !!f.mandatory,         // la narración DEBE citarla (guardC ya lo enforcea)
      gancho: !!f.gancho,                 // disponible pero opcional (no exigible)
      formula: f.formula || null,
      // SUPUESTOS del claim: lo que hubo que asumir para que esta cifra exista. Hoy son dos y ambos derivan del
      // fig: la fórmula (es una cuenta, no una lectura) y la referencia usada (la vara es interna, no del sector).
      supuestos: [
        ...(f.formula ? [`se calcula como ${f.formula}`] : []),
        ...(METRICAS_DE_REFERENCIA.includes(metrica) ? ["la referencia la define tu negocio, no una fuente sectorial"] : []),
      ],
      contexto: f.context || null,
      etiqueta: f.label,                  // el label ORIGINAL — el binding del guard se ata a esto
      canon: f.canon || null,
    };
  });

  // ── SEGUNDA PASADA · COBERTURA CAUSAL ────────────────────────────────────────────────────────────────────────
  // Necesita el conjunto completo: una palanca es PARCIAL siempre, pero solo se puede declarar la FRACCIÓN si su
  // universo está en la MISMA boleta y para la MISMA entidad. Sin universo, la cobertura sigue siendo parcial y
  // la fracción queda explícitamente innarrable — que es distinto de no saber nada.
  // ── ATRIBUCIÓN DE LA BRECHA · SE SELLA ACÁ, COMPARANDO MONTOS (owner 2026-08-11, defecto 3 de la certificación)
  // EL CASO MEDIDO, textual: «Lider presenta una brecha de margen de $1.5M, que representa el valor en juego al
  // llevar sus acciones comerciales a la meta». La boleta de ese turno NO TRAÍA NINGUNA cifra de palanca — ni un
  // exceso de acciones comerciales, ni nada— así que la brecha entera quedó adjudicada a una palanca que el dato
  // no cuantifica. Sus acciones comerciales son $125K contra $1.5M de brecha: el 8%.
  // LA REGLA ES ARITMÉTICA, no de vocabulario: se suman las palancas de LA MISMA entidad presentes en ESTA boleta
  // y se comparan con la brecha. Tres desenlaces, y el tercero es el que faltaba:
  //   · total        — las palancas cubren la brecha (dentro de la tolerancia de redondeo)
  //   · parcial      — la explican en parte, y la fracción es verificable
  //   · no_atribuida — NO HAY palanca en la boleta: nada autoriza a decir qué la cierra
  // El narrador lee esto (narratePromptC) y el muro lo hace cumplir (guardC, chequeo de causa sobredimensionada).
  for (const c of base) {
    if (!_ES_BRECHA(c) || typeof c.valorRaw !== "number" || c.valorRaw <= 0) continue;
    const palancas = base.filter((p) => p !== c && p.entidad === c.entidad
      && _PALANCAS.some((x) => x.esParte && x.re.test(p.metrica || "")) && typeof p.valorRaw === "number" && p.valorRaw > 0);
    const suma = palancas.reduce((s, p) => s + p.valorRaw, 0);
    const frac = suma / c.valorRaw;
    c.atribucion = {
      cobertura: !palancas.length ? "no_atribuida" : (frac >= 0.95 ? "total" : "parcial"),
      montoPalancas: palancas.length ? suma : null,
      fraccion: palancas.length ? `${Math.round(frac * 1000) / 10}%` : null,
      palancas: palancas.map((p) => ({ etiqueta: p.etiqueta, valor: p.valor })),
      // el texto que el prompt y el guard citan: una sola redacción para las tres clases, nunca improvisada.
      leyenda: !palancas.length
        ? "esta boleta no trae ninguna palanca cuantificada para esta brecha: no se puede afirmar qué la cierra"
        : (frac >= 0.95
          ? "las palancas de esta boleta cubren la brecha"
          : `las palancas de esta boleta explican ${Math.round(frac * 1000) / 10}% de la brecha, no toda`),
    };
  }

  for (const c of base) {
    const pal = _PALANCAS.find((p) => p.re.test(c.metrica));
    if (!pal || !pal.esParte) continue;   // la brecha es el FENÓMENO, no una parte de sí misma (ver _PALANCAS)
    c.coberturaCausal = "parcial";
    // EL UNIVERSO DE UNA PALANCA ES LA BRECHA QUE PRETENDE CERRAR, no la venta (owner 2026-08-11). Con la venta,
    // la fracción de «$194K de exceso» daba 1% —cierto y ajeno a la pregunta—; contra la brecha de $1.6M da 12%,
    // que es la cifra que decide si esa palanca alcanza. Se cae a la venta sólo si no hay brecha en la boleta.
    const universo = base.find((u) => u !== c && u.entidad === c.entidad && _ES_BRECHA(u) && typeof u.valorRaw === "number" && u.valorRaw > 0)
      || base.find((u) => u !== c && u.entidad === c.entidad && _esUniverso(u.metrica) && typeof u.valorRaw === "number" && u.valorRaw > 0);
    const monto = typeof c.valorRaw === "number" ? c.valorRaw : null;
    c.explica = {
      clase: pal.clase,
      monto: c.valor,
      montoRaw: monto,
      universo: universo ? universo.valor : null,
      universoEtiqueta: universo ? universo.etiqueta : null,
      // la fracción SOLO existe si ambas cifras están autorizadas en este turno. Si no, es null y el prompt
      // instruye a decir "explica una parte" sin ponerle número — nunca a estimarla.
      fraccion: (universo && monto != null) ? `${Math.round((monto / universo.valorRaw) * 1000) / 10}%` : null,
    };
  }
  return base;
}

// ── RELACIONES AUTORIZADAS ─────────────────────────────────────────────────────────────────────────────────────
// El owner pidió "relaciones autorizadas entre claims" — o sea: QUÉ se puede cruzar con QUÉ lo decide el motor, no
// el narrador. Tres relaciones, todas derivadas determinísticamente de los claims (nunca del texto):
//   · comparable   mismos (métrica, unidad, período) en entidades DISTINTAS → autoriza compararlas entre sí.
//                  Sin esta relación explícita, comparar dos cifras es una inferencia libre del LLM; con ella, es
//                  una operación autorizada. (Y su ausencia es igual de informativa: dos métricas distintas NO son
//                  comparables aunque compartan unidad — la trampa clásica de "margen 22% vs carga 4.5%".)
//   · derivada     el claim tiene fórmula → se declara que es una CUENTA, con su fórmula auditable al lado.
//   · mismaEntidad todos los claims de una misma entidad → autoriza construir el perfil de esa entidad sin mezclar.
export function buildRelations(claims) {
  const cs = Array.isArray(claims) ? claims : [];
  const comparables = [];
  const porClave = new Map();
  for (const c of cs) {
    if (!c.entidad || !c.metrica) continue;
    const k = `${c.metrica}|${c.unidad}|${c.periodo || ""}`;
    if (!porClave.has(k)) porClave.set(k, []);
    porClave.get(k).push(c.id);
  }
  for (const [k, ids] of porClave) {
    if (ids.length < 2) continue;
    const [metrica, unidad] = k.split("|");
    comparables.push({ tipo: "comparable", metrica, unidad, claims: ids });
  }
  const derivadas = cs.filter((c) => c.formula).map((c) => ({ tipo: "derivada", claim: c.id, formula: c.formula }));
  const porEntidad = new Map();
  for (const c of cs) {
    if (!c.entidad) continue;
    if (!porEntidad.has(c.entidad)) porEntidad.set(c.entidad, []);
    porEntidad.get(c.entidad).push(c.id);
  }
  const mismaEntidad = [...porEntidad.entries()].map(([entidad, ids]) => ({ tipo: "mismaEntidad", entidad, claims: ids }));
  // PARTE-DE (Regla de Proporcionalidad Semántica) — la relación que la cabecera de este archivo prometía y que
  // nunca se había escrito. Es la que impide que una causa parcial se narre como la explicación completa: declara
  // explícitamente qué claim es una PARTE de qué otro, con la fracción cuando ambas cifras están autorizadas.
  // Su AUSENCIA también informa: una palanca sin universo en la boleta sigue siendo parcial, pero su fracción es
  // innarrable — el prompt lo dice, y nunca se estima.
  const parteDe = cs.filter((c) => c.coberturaCausal === "parcial" && c.explica).map((c) => ({
    tipo: "parte-de",
    claim: c.id,
    clase: c.explica.clase,
    parte: c.explica.monto,
    universo: c.explica.universo,           // null si no está en esta boleta
    universoEtiqueta: c.explica.universoEtiqueta,
    fraccion: c.explica.fraccion,           // null si el universo no está autorizado en este turno
    cuantificable: !!c.explica.fraccion,
  }));
  return { comparables, derivadas, mismaEntidad, parteDe };
}

// ── PREGUNTAS ABIERTAS (el estatus "abierto" del contrato) ─────────────────────────────────────────────────────
// Lo que el motor NO pudo responder este turno no es una cifra: es un límite declarado. Sale de coverage.supported
// === false (la tool degradó honesto) con su motivo y sus alternativas — la MISMA fuente que hoy alimenta el
// bloque HONESTIDAD del narrador, pero tipada en vez de mezclada dentro de `datos`.
export function buildOpenQuestions(results) {
  const list = Array.isArray(results) ? results : [];
  return list.filter((r) => r && r.coverage && r.coverage.supported === false).map((r) => ({
    tool: r.tool || null,
    motivo: (r.coverage && r.coverage.reason) || null,
    alternativas: Array.isArray(r.coverage && r.coverage.alternativas) ? r.coverage.alternativas.slice() : [],
    cruceImposible: !!(r.coverage && r.coverage.cross),
  }));
}

// ── SUPUESTOS ──────────────────────────────────────────────────────────────────────────────────────────────────
// Un supuesto NO es un hecho, y esa distinción tiene que viajar tipada (hoy es doctrina de prosa: "SI hacés X,
// PODRÍAS recuperar Y"). Dos fuentes determinísticas: los supuestos_faltantes del plan (simulación que pidió
// clarificación) y los facts.supuestos que sellan los composers de simulación.
export function buildSupuestos({ plan, results }) {
  const out = [];
  const faltantes = plan && Array.isArray(plan.supuestos_faltantes) ? plan.supuestos_faltantes : [];
  for (const s of faltantes) if (s) out.push({ tipo: "faltante", detalle: String(s) });
  const list = Array.isArray(results) ? results : [];
  for (const r of list) {
    const sup = r && r.facts && r.facts.supuestos;
    if (Array.isArray(sup)) for (const s of sup) if (s) out.push({ tipo: "declarado", tool: r.tool || null, detalle: typeof s === "string" ? s : JSON.stringify(s) });
    else if (sup && typeof sup === "object") out.push({ tipo: "declarado", tool: r.tool || null, detalle: JSON.stringify(sup) });
  }
  return out;
}

// ── ACCIONES Y PRIORIDADES PERMITIDAS ──────────────────────────────────────────────────────────────────────────
// El owner pidió "acciones y prioridades permitidas". La regla: una acción es proponible SOLO si el motor computó
// una palanca CUANTIFICADA para ella. Se derivan de los claims cuya métrica nombra una palanca reconocida por el
// contrato de negocio (exceso de acciones comerciales, brecha de margen, capital detenido) — cada una con su monto
// para que la PRIORIDAD sea del dato (mayor monto primero), no del criterio del narrador.
// Nota de alcance: es una lista de lo PERMITIDO/priorizable, no una orden. El narrador sigue eligiendo cómo
// contarlo; lo que no puede es proponer una acción sin respaldo cuantificado en esta lista.
// `esParte` (Regla de Proporcionalidad Semántica): distingue el MECANISMO del FENÓMENO. Un mecanismo explica una
// PARTE de algo mayor — el exceso de acciones comerciales y el capital detenido son mecanismos. La BRECHA no: la
// brecha ES el fenómeno, el universo contra el que se mide la parte. Sin esta distinción, la primera versión
// marcaba la brecha de 8,1 pp como "causa parcial de sí misma" (cazado corriendo la derivación sobre 4 ejes).
const _PALANCAS = [
  { re: /exceso de acciones comerciales/i, clase: "acciones_comerciales", accion: "revisar las acciones comerciales (rebates y descuentos)", esParte: true },
  { re: /capital detenido/i,               clase: "capital_detenido",     accion: "liberar el capital detenido en inventario",               esParte: true },
  { re: /\bbrecha\b/i,                     clase: "brecha_margen",        accion: "cerrar la brecha de margen contra el benchmark",          esParte: false },
];
export function buildAllowedActions(claims) {
  const cs = Array.isArray(claims) ? claims : [];
  const out = [];
  for (const c of cs) {
    const p = _PALANCAS.find((x) => x.re.test(c.metrica || ""));
    if (!p) continue;
    out.push({
      clase: p.clase,
      accion: p.accion,
      sobre: c.entidad,
      magnitud: c.valor,
      magnitudRaw: c.valorRaw,
      unidad: c.unidad,
      claim: c.id,
      estatus: c.estatus,
    });
  }
  // prioridad = magnitud en dinero, descendente. Las no-dinerarias (pp) van después: una brecha en puntos no es
  // comparable con un $ (misma trampa que evita `comparables` arriba) — se ordenan entre sí, nunca contra el $.
  const money = out.filter((a) => a.unidad === "money").sort((a, b) => (b.magnitudRaw || 0) - (a.magnitudRaw || 0));
  const resto = out.filter((a) => a.unidad !== "money");
  return [...money, ...resto].map((a, i) => ({ ...a, prioridad: i + 1 }));
}

// ── REPARACIÓN CONTEXTUAL · Contrato Conversacional v1.2 (owner 2026-08-10) ────────────────────────────────────
// buildReparacion({ plan, mem }) → el objeto de reparación SELLADO, o null en el 99% de los turnos.
// DOS FUENTES, ninguna nueva: `plan.reparacion` (qué declaró PLAN de ESTE turno) y los supuestos aportados por el
// usuario que siguen vivos en el estado canónico (mem.conversationScope.current.supuestos). No hace falta un
// argumento más en ninguna firma: `plan` y `mem` ya viajaban enteros hasta acá.
// Un supuesto del usuario VIVO viaja aunque este turno no sea una reparación — es justamente el caso que §5.1
// cubre: la cifra sigue siendo suya "mientras siga viva en la conversación", no solo en el turno que la aportó.
// ── EL TERCER UNIVERSO, TIPADO · una sola verdad para el guard y para el renderer ──────────────────────────────
// cifrasDelUsuario(reparacion) → las cifras APORTADAS POR EL USUARIO que están vivas en el turno, YA PARSEADAS con
// el mismo parser que produce el canon de la boleta (parseFigures). Es la ÚNICA definición: guardC.js la lee para
// juzgar y narratePromptC.js para estampar la procedencia. Dos implementaciones paralelas de "qué cifra es del
// usuario" serían exactamente cómo se llega a que el candado juzgue una cosa y el producto muestre otra.
// Devuelve [] en el 99% de los turnos, sin recorrer nada.
// _parseCifraUsuario(texto) → las cifras del string TAL COMO lo escribió el usuario, canonizadas.
// LA CIFRA DEL USUARIO NO VIENE FORMATEADA POR EL MOTOR, y eso importa más de lo que parece: el canon es lo que
// ata el candado al texto narrado, así que un formato que el parser no reconoce apaga §5.1 entero **y además**
// deja la respuesta en un callejón — el contrato OBLIGA a mostrar la discrepancia, pero esa cifra sin canon se
// rechaza como inventada, así que no hay redacción posible y el turno se pierde reintentando.
// Tres normalizaciones, todas acotadas a ESTE string (nunca al parser general, que sella la boleta del motor):
//   · «20 millones» / «20M» sin signo → se les antepone el símbolo, porque el usuario habla de plata sin escribirlo;
//   · «millones»/«mil» escritos con palabras → su sufijo.
// LOS SEPARADORES YA NO SE NORMALIZAN ACÁ (owner 2026-08-10): «$20.000.000» y «8,3%» los resuelve el parser
// general (parseNumeroLocalizado, boleta.js), que es donde corresponde — una cifra del usuario y una del motor se
// leen con la MISMA regla o el canon deja de significar lo mismo en los dos lados.
function _parseCifraUsuario(texto) {
  const crudo = String(texto || "").trim();
  const directo = parseFigures(crudo);
  if (directo.length) return directo;
  const variantes = [
    crudo.replace(/\s*millones?\b/i, "M").replace(/\s*mil\b/i, "K"),
    "$" + crudo.replace(/\s*millones?\b/i, "M").replace(/\s*mil\b/i, "K").replace(/^\$\s?/, ""),
  ];
  for (const v of variantes) {
    const p = parseFigures(v);
    if (p.length) return p;
  }
  return directo;
}

export function cifrasDelUsuario(reparacion) {
  const r = (reparacion && typeof reparacion === "object") ? reparacion : null;
  if (!r) return [];
  const crudos = [];
  if (Array.isArray(r.supuestos)) for (const s of r.supuestos) if (s && s.valor) crudos.push({ texto: String(s.valor), metrica: s.metrica || null });
  if (r.dato && r.dato.valor) crudos.push({ texto: String(r.dato.valor), metrica: r.dato.metrica || null });
  const out = [];
  const vistos = new Set();
  for (const c of crudos) {
    for (const f of _parseCifraUsuario(c.texto)) {
      if (vistos.has(f.canon)) continue;
      vistos.add(f.canon);
      // ETIQUETA CON DUEÑO, igual que cualquier fig de la boleta ("Entidad · Concepto"): el dueño de esta cifra es
      // el usuario, y decirlo en la etiqueta es lo que la hace un claim de primera clase en vez de un caso especial.
      out.push({ ...f, label: `Tu dato · ${c.metrica || "cifra aportada"}`, metrica: c.metrica || null, origen: "usuario" });
    }
  }
  return out;
}

// `reparacion` (owner 2026-08-10, integración general del P&L): una reparación YA RESUELTA por el motor. La usan
// las rutas que arman un plan sintético sin consultar a PLAN, donde `plan.reparacion` no puede existir y la
// reparación se infiere de la estructura (ver inferirCorrige). Se pasa entera para que el narrador y el guard
// juzguen EXACTAMENTE lo mismo que el estado ya invalidó — nunca una segunda derivación acá.
export function buildReparacion({ plan, mem, reparacion = null } = {}) {
  // UNA SOLA LECTURA del objeto crudo (ver normalizeReparacion): el intent y la contradicción `ambigua`+`corrige`
  // se resuelven ahí, una vez, para que el guard, el estado y el prompt no puedan juzgar tres cosas distintas.
  const r = reparacion || normalizeReparacion(plan);
  const supuestos = supuestosUsuarioVivos(mem && mem.conversationScope)
    .map((s) => ({ origen: "usuario", valor: String(s.valor), metrica: s.metrica || null, periodo: s.periodo || null }));
  if (!r && !supuestos.length) return null;
  return {
    tipo: r ? r.tipo : null,
    corrige: r ? r.corrige : [],
    ambigua: !!(r && r.ambigua),
    // la cifra que el usuario afirma EN ESTE TURNO — viaja para que la narración pueda contrastarla contra la
    // oficial. Es texto suyo, no una cifra autorizada: nunca entra al ledger ni a `cifras_autorizadas`.
    dato: r ? r.dato : null,
    aceptado: !!(r && r.aceptado),
    supuestos,
  };
}

// ── SCOPE CONTRACT ─────────────────────────────────────────────────────────────────────────────────────────────
// El ALCANCE como campo de PRIMERA CLASE (hoy vive disperso en plan.scope + call.args + mem.conversationScope +
// una docena de coercers). Se sella DESPUÉS de que answerViaOracle ya coercionó/validó, así que lo que entra acá
// es el alcance YA validado contra el catálogo del tenant — este objeto es la única verdad río abajo.
// `periodo` sale del dato (facts.periodo sellado por el composer) y cae al escenario solo si el dato no lo declara:
// nunca se inventa un período que el dato no sostenga.
// `viewContext` (owner 2026-08-09, Contrato de Concordancia · mejora A) — el CONTEXTO DE PANTALLA entra como UN
// CAMPO MÁS del alcance sellado (`scope.vista`), no como un objeto congelado al lado. Consecuencia directa: queda
// dentro del árbol que _deepFreeze congela al final de buildNarrationContract, así que `isSealed(contract)` —la
// función que ya existía— afirma también la inmutabilidad del ViewContext, sin una línea nueva de verificación.
// Es DECLARACIÓN de qué está mirando el usuario: no trae cifras, y el narrador nunca puede derivar una de acá.
export function sealScopeContract({ plan, results, scenario = null, requestContext = null, pref = null, viewContext = null } = {}) {
  const list = Array.isArray(results) ? results : [];
  const scope = (plan && plan.scope) || null;
  const entidades = scope && Array.isArray(scope.entities) ? scope.entities.filter(Boolean).slice() : [];
  // el eje: el que declaren los facts (entityType/dimension son la salida YA canonicalizada del motor).
  let eje = null;
  for (const r of list) {
    const f = r && r.facts;
    if (!f) continue;
    if (f.entityType) { eje = f.entityType; break; }
    if (f.dimension) { eje = f.dimension; break; }
  }
  // el período: sellado por el composer si existe; si no, el escenario del turno. Un resultado de marco MIXTO
  // (decisión 5: venta del año cerrado y stock de la foto de hoy en la misma call) trae en `facts.periodo` la
  // frase larga que INSTRUYE al narrador — el alcance sellado lo DECLARA, así que va la etiqueta corta.
  let periodo = null;
  for (const r of list) {
    const f = r && r.facts;
    if (!f) continue;
    if (Array.isArray(f.periodos) && f.periodos.length > 1) { periodo = PERIODO_MIXTO_ETIQUETA; break; }
    if (f.periodo) { periodo = f.periodo; break; }
  }
  if (!periodo && scenario) periodo = scenario;
  const metricas = [];
  for (const r of list) {
    const ms = r && r.facts && Array.isArray(r.facts.metrics) ? r.facts.metrics : [];
    for (const m of ms) if (m && m.label && !metricas.includes(m.label)) metricas.push(m.label);
  }
  const filtros = {};
  for (const c of (plan && Array.isArray(plan.calls) ? plan.calls : [])) {
    const f = c && c.args && c.args.filters;
    if (f && typeof f === "object") for (const [k, v] of Object.entries(f)) if (v != null && v !== "") filtros[k] = v;
  }
  return {
    tenant: (requestContext && requestContext.tenantId) || null,
    escenario: scenario || null,
    periodo,
    eje,
    entidades,
    nivel: (scope && scope.level) || (entidades.length > 1 ? "list" : entidades.length === 1 ? "entity" : "global"),
    // `declarado` = el alcance TAL COMO lo emitió el plan, ya coercionado/validado por answerViaOracle. Se sella
    // verbatim (no una reconstrucción) porque es lo que el narrador viene consumiendo como `alcance` — mantenerlo
    // idéntico es lo que hace que Fase 1 no cambie una coma del prompt. Fase 1b lo reemplaza por eje/entidades.
    declarado: scope || null,
    filtros,
    metricas,
    // CONTEXTO DE PANTALLA (mejora A) — null en cualquier turno que no venga de Sentrix, que es el default.
    vista: viewContext || null,
    modo: (plan && plan.mode) || "default",
    contentScope: (pref && pref.contentScope) || "full",
    detalle: (pref && pref.detailLevel) || "standard",
  };
}

// ── POLÍTICA DE EXTENSIÓN ──────────────────────────────────────────────────────────────────────────────────────
// Qué le está permitido AGREGAR al narrador por encima de los claims. El owner fue explícito: "puede redactar con
// naturalidad, pero no agregar ni modificar entidades, métricas, períodos, causalidad, acciones o supuestos fuera
// de ese contrato". Esto lo declara como DATO (no como párrafo de prompt) para que Fase 2 pueda verificarlo y para
// que sea legible por cualquier proveedor.
export function buildExtensionPolicy({ scope, claims, acciones, tablePolicy = "auto", formaRespuesta = null }) {
  return {
    puedeRedactarLibre: true,               // la naturalidad es del LLM — no se toca
    puedeAgregarEntidades: false,
    puedeAgregarMetricas: false,
    puedeAgregarPeriodos: false,
    puedeAgregarCausalidad: false,          // el "por qué" solo puede apoyarse en relaciones/claims sellados
    puedeAgregarAcciones: false,            // solo las de `acciones` (cuantificadas)
    puedeAgregarSupuestos: false,
    entidadesPermitidas: [...new Set((claims || []).map((c) => c.entidad).filter(Boolean))],
    metricasPermitidas: [...new Set((claims || []).map((c) => c.metrica).filter(Boolean))],
    periodoPermitido: scope ? scope.periodo : null,
    accionesPermitidas: (acciones || []).map((a) => a.accion),
    // cuánto puede extenderse: el contrato de forma ya resuelto (modo + densidad) — la "proporcionalidad".
    // TABLA: la FORMA es una decisión de PRESENTACIÓN del turno, con TRES estados (ver progressiveDisclosure.js):
    //   forbidden · por DOS orígenes distintos, y el contrato tiene que declarar los dos (corrección 2026-08-11):
    //               (1) EL USUARIO LO PIDIÓ — "sin tabla", "nada de tablas", "explicámelo en prosa", "solo la
    //                   conclusión". Mientras este origen no existió, la doctrina de este mismo bloque decía que
    //                   `forbidden` era siempre cosa del motor, y así certificaba como contrato el defecto: un
    //                   pedido de forma del usuario no podía prohibir nada, sólo agregar obligaciones.
    //               (2) PERFIL GENERAL — el detalle no viajó; tabular lo que queda sería reconstruirlo peor que la Ficha.
    //   required  · el usuario pidió tabla / mes a mes / desglose — responder en prosa también sería incumplir
    //   auto      · el resto — decide el narrador con los detectores de forma; el guard no juzga
    // El guard valida LA POLÍTICA DECIDIDA para este turno, nunca una prohibición general de tablas.
    tablePolicy: ["forbidden", "required", "auto"].includes(tablePolicy) ? tablePolicy : "auto",
    // FORMA DE RESPUESTA DEL TURNO (owner 2026-08-09, contrato de respuesta proporcional — ver
    // progressiveDisclosure.js:resolveAnswerShape). Se declara acá, junto a tablePolicy, por la MISMA razón: es una
    // decisión de PRESENTACIÓN ya tomada por el motor, y declararla como dato (no como párrafo de prompt) es lo que
    // permite que el guard la valide y que cualquier proveedor la lea igual. Cuatro estados:
    //   solo_dato            · el usuario pidió el dato pelado (o su equivalente semántico) — manda `pref`
    //   explicar_componente  · "explicame este gráfico" con contexto de pantalla — qué mide / universo / patrón /
    //                          qué sabemos de la causa / qué revisar primero
    //   puntual              · una pregunta concreta: se responde DIRECTO y después solo lo necesario (nunca informe)
    //   tres_reglas          · el default del owner: qué pasa · por qué (probado/indicado/abierto) · qué hacer primero
    // UNA SOLA LISTA, la importada. Acá había una COPIA literal del enum que este mismo archivo ya importa 34 líneas
    // más arriba (ANSWER_SHAPES, progressiveDisclosure.js): hoy coinciden, pero la copia significaba que agregar una
    // forma la validaba en `forma.formaRespuesta` (línea de buildNarrationContract) y la anulaba en
    // `politicaExtension.formaRespuesta` — el contrato sellado se contradiría a sí mismo, en silencio, dentro del
    // mismo objeto congelado. Es exactamente la "segunda verdad" que el contrato prohíbe.
    formaRespuesta: ANSWER_SHAPES.includes(formaRespuesta) ? formaRespuesta : null,
    densidad: scope ? scope.contentScope : "full",
    detalle: scope ? scope.detalle : "standard",
  };
}

// _memoriaSinVista(mem) → la memoria de interacción SIN la key `viewContext`. Ver la nota junto a `memoria:` en
// buildNarrationContract para el porqué. Devuelve la MISMA referencia cuando no hay nada que sacar, así que el
// contrato —y el payload proyectado— quedan byte-idénticos en el 100% de los turnos que no vienen de Sentrix.
function _memoriaSinVista(mem) {
  if (!mem || typeof mem !== "object") return mem || null;
  // `boletaAnterior` (Paso 1b, owner 2026-08-13) se excluye por el MISMO filtro y la misma razón que viewContext:
  // es PERMISO para guardC (la cuarta fuente de autorización), no dato para el narrador — que ya ve esas cifras
  // EN EL TEXTO de hilo_reciente. Dejarla pasar sería una segunda representación de lo mismo en el mismo prompt.
  const _tieneVista = Object.prototype.hasOwnProperty.call(mem, "viewContext");
  const _tieneBoleta = Object.prototype.hasOwnProperty.call(mem, "boletaAnterior");
  if (!_tieneVista && !_tieneBoleta) return mem;
  const { viewContext: _descartado, boletaAnterior: _descartada, ...resto } = mem;
  return resto;
}

// ── EL CONTRATO ────────────────────────────────────────────────────────────────────────────────────────────────
// buildNarrationContract(args) → NarrationContract INMUTABLE. Es lo único que NARRAR puede ver.
// `datos` viaja acá (Fase 1) porque el narrador de hoy consume facts y migrar ese contenido cambia el prompt —
// pero YA está DENTRO del contrato, sellado: nadie río abajo lo lee de `results`. Fase 1b lo reemplaza por claims.
export function buildNarrationContract({
  text, plan, results, ledgerFigs, mem, history, pref, instruccionOrientacion, instruccionDisclosure, tablePolicy = "auto", scenario = null, requestContext = null,
  viewContext = null, instruccionForma = null, formaRespuesta = null,
} = {}) {
  const scope = sealScopeContract({ plan, results, scenario, requestContext, pref, viewContext });
  const claims = buildClaims(ledgerFigs, { eje: scope.eje, periodo: scope.periodo });
  const relaciones = buildRelations(claims);
  const preguntasAbiertas = buildOpenQuestions(results);
  const supuestos = buildSupuestos({ plan, results });
  const acciones = buildAllowedActions(claims);
  // CONTRATO DE RESPUESTA PROPORCIONAL — la forma se DECIDE en progressiveDisclosure.js (resolveAnswerShape, con su
  // precedencia explícita) y se COMPONE acá, que es donde los claims y las preguntas abiertas ya están sellados: así
  // la graduación PROBADO/INDICADO/ABIERTO nombra las métricas REALES de este turno en vez de repetir doctrina.
  // `instruccionForma` explícita gana (un caller que ya la compuso no se recompone); si no viene, se deriva.
  const formaValida = ANSWER_SHAPES.includes(formaRespuesta) ? formaRespuesta : null;
  const instruccionFormaFinal = instruccionForma
    || buildAnswerShapeInstruction(formaValida, { viewContext, claims, preguntasAbiertas })
    || null;
  const politicaExtension = buildExtensionPolicy({ scope, claims, acciones, tablePolicy, formaRespuesta: formaValida });
  const datos = (results || []).map((r) => ({
    tool: r.tool,
    disponible: !!(r.coverage && r.coverage.supported),
    ...(r.coverage && r.coverage.supported === false ? { motivo: r.coverage.reason } : {}),
    facts: r.facts || null,
  }));
  // EL HILO CON PRESUPUESTO (owner 2026-08-13, Paso 1 "ADI pierde el hilo" — antes: `.slice(0,220)` por turno):
  // de la respuesta larga del turno anterior sobrevivían 220 chars y el deíctico ("explícame eso") no tenía a qué
  // referirse. La política vive en hiloBudget.js (UNA sola, compartida con buildPlanUserMessage): el último turno
  // de ADI SIEMPRE entero, hacia atrás turnos completos mientras quepa NARRAR_HILO_PRESUPUESTO_CHARS, el que no
  // cabe se resume a su primera oración + "…". El slice(-4) NO se toca. Prioridad invertida a text||gist — el
  // gist era la adaptación al corte de 220 y quedaría reintroduciéndolo; sigue de fallback para turnos sin text.
  const h = Array.isArray(history) ? history.slice(-4) : [];
  const hiloReciente = aplicarPresupuestoHilo(h, NARRAR_HILO_PRESUPUESTO_CHARS)
    .map((m) => ({ quien: m.role === "user" ? "usuario" : "ADI", dijo: m.dijo }))
    .filter((m) => m.dijo);
  return _deepFreeze({
    version: 1,
    pregunta: String(text == null ? "" : text),
    intencion: (plan && plan.intent) || "answer",
    scope,
    claims,
    relaciones,
    supuestos,
    acciones,
    preguntasAbiertas,
    // REPARACIÓN CONTEXTUAL (Contrato v1.2) — null en cualquier turno que no corrija, no discrepe y no tenga una
    // cifra del usuario viva, que es el default. Queda DENTRO del árbol que _deepFreeze congela, así que la
    // procedencia del tercer universo es tan inmutable como el resto del contrato.
    reparacion: buildReparacion({ plan, mem }),
    politicaExtension,
    // ── material de FORMA ya resuelto por el motor (no es "results crudos": son decisiones tomadas) ──
    forma: {
      modo: scope.modo,
      clarifyStreak: (plan && plan.clarifyStreak) || null,
      instruccionOrientacion: instruccionOrientacion || null,
      // DIVULGACIÓN PROGRESIVA (owner 2026-08-07): qué decir en vez de la tabla que NO se trajo. Va en
      // porque es una instrucción de FORMA del turno, igual que la orientación — no es un claim ni un dato.
      instruccionDisclosure: instruccionDisclosure || null,
      // CONTRATO DE RESPUESTA PROPORCIONAL (owner 2026-08-09): la instrucción que corresponde a `formaRespuesta`
      // (ver progressiveDisclosure.js:buildAnswerShapeInstruction). Misma naturaleza que las dos de arriba: una
      // decisión de FORMA ya tomada por el motor, no un dato ni un claim. Null en el default (tres_reglas), que es
      // exactamente lo que el narrador ya hace hoy — un turno normal no agrega ni una llave al payload.
      instruccionForma: instruccionFormaFinal,
      formaRespuesta: formaValida,
      // el plan sigue viajando SOLO para los detectores de forma que hoy lo consultan (perfil completo, orden por
      // monto). Fase 1b los mueve a consumir `claims`/`scope` y este campo desaparece.
      _planCalls: (plan && Array.isArray(plan.calls) ? plan.calls : []).map((c) => ({ tool: c && c.tool })),
    },
    datos,
    hiloReciente,
    // MEMORIA DE INTERACCIÓN — viaja al narrador como `memoria_interaccion` (narratePromptC.js, las DOS
    // proyecciones). `mem.viewContext` se EXCLUYE acá, y no es una limpieza cosmética: answerViaOracle.js persiste
    // el ViewContext sellado como key hermana de conversationScope, así que sin este filtro el OBJETO entero
    // (componentId, evidenceIds, key, dataSnapshotId, tenantId, controles y la lista cruda de
    // `seleccion.entidades`) entraba al prompt por la puerta de atrás — exactamente lo que la frontera declarada en
    // viewContext.js y en _lineaVista prohíbe ("nunca el objeto ViewContext"), y saltándose la proyección que a
    // propósito colapsa una selección de N entidades en un CONTEO en vez de nombrarlas.
    // El contexto de pantalla YA entra al contrato por su única puerta legítima: `scope.vista` (sealScopeContract),
    // desde donde `_lineaVista` lo proyecta como UNA línea de ≤240 caracteres y sin cifras. Dos representaciones de
    // lo mismo en el mismo prompt serían, además, la segunda verdad que el contrato prohíbe.
    memoria: _memoriaSinVista(mem),
    pref: pref || null,
    // trazabilidad: para auditar de dónde salió el contrato sin volver a los crudos.
    _fuente: { figs: Array.isArray(ledgerFigs) ? ledgerFigs.length : 0, results: Array.isArray(results) ? results.length : 0 },
  });
}

// ── VERIFICACIÓN DE SELLADO (para gates) ───────────────────────────────────────────────────────────────────────
// isSealed(contract) → true si el contrato es realmente inmutable en profundidad. Un gate puede afirmarlo sin
// intentar mutarlo (que en modo no-estricto falla en silencio y daría un falso verde).
export function isSealed(contract, seen = new WeakSet()) {
  if (contract === null || typeof contract !== "object") return true;
  if (seen.has(contract)) return true;
  seen.add(contract);
  if (!Object.isFrozen(contract)) return false;
  for (const k of Object.getOwnPropertyNames(contract)) {
    const v = contract[k];
    if (v && typeof v === "object" && !isSealed(v, seen)) return false;
  }
  return true;
}
