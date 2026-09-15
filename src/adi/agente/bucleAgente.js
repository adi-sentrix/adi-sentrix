/* === src/adi/agente/bucleAgente.js · EL BUCLE DEL AGENTE (F2 · owner 2026-08-30: «esta vez quiero ADI agente»)
 *
 * LA FORMA (F1, aprobado): un solo cerebro · el hilo entero · la caja completa con contrato · bucle corto ·
 * la boleta se ACUMULA de lo que las herramientas devuelven · guardC sella al final.
 *
 *   [RONDA 1..3]  el cerebro ve mapa + hilo + boleta acumulada y decide: pedir herramientas o responder.
 *                 Las herramientas las ejecuta EL MOTOR (runPlan con la caja extendida — client-side, puro).
 *   [CIERRE]      si agotó las rondas sin responder, una última llamada SIN herramientas («cierra ahora»).
 *   [MURO]        guardC con la boleta acumulada + las fuentes de siempre · veto → UNA reparación con multa.
 *   [ESCALERA]    INVERTIDA (owner): 1· la línea honesta del límite con la cifra más cercana VERIFICADA ·
 *                 2· el respaldo de lo ya aprobado en el hilo · 3· el genérico pelado. El tablero de KPIs
 *                 dejó de ser primer recurso: queda para cuando el usuario lo pida (herramienta executiveSummary).
 *
 * LOS TOPES SON DEL CLIENTE, no promesas del prompt: 3 rondas de herramientas + 1 cierre, más UNA ronda extra
 * cuando el cierre o la reparación piden una herramienta VÁLIDA (R1 del examen 1: descartar ese pedido mataba
 * el turno — T7 vacío pidiendo inventoryStatus) y su re-cierre — techo duro de 6 llamadas al cerebro por
 * turno (3 rondas + cierre + ronda extra con re-cierre + reparación). 8 calls por ronda (el cap de runPlan) y
 * 12 por turno; una herramienta desconocida recibe UNA corrección de contrato y a la segunda quema la ronda.
 * Jamás un reintento infinito.
 *
 * EL CEREBRO SE INYECTA (`callAgente`) — ChatADI pondrá el fetch real cuando el adapter hable el modo libre;
 * los gates ponen GUIONES, incluidos los maliciosos. Contrato de `callAgente({ mensajes, mapa, herramientas,
 * ronda, attempt, motivoReintento, figsEnBoleta, figs })` → Promise<{ tipo:"herramientas", pedidos:[{tool,args}] } |
 * { tipo:"texto", texto }>. Este módulo no conoce el cable (tool_use nativo vs texto): eso es del adapter.
 * `figs` (Notario semántico, fase 2) es la boleta verificada del turno tal cual: el adapter real NO la usa —el modelo
 * declara sus afirmaciones solo, con lo que leyó en los mensajes—; la reciben los GUIONES de los gates, que declaran
 * desde la evidencia igual que el respaldo (`_guion_declara.mjs`). Sin ella, un guion sin bloque cae por
 * `sin-declaracion`, como caería un modelo que no declara.
 * `figsEnBoleta` (R-eco del examen 1 del agente): cuántas cifras verificadas acumula el turno — el adapter
 * decide el tier con eso (escalar el cierre a un modelo mejor SOLO cuando hay material que reescribir; con
 * boleta vacía la escalada fue 66% del gasto y CERO verdes).
 *
 * PURO · sin red · detrás de la bandera ADI_AGENTE (hoy APAGADA en todos los perfiles). */
import { runPlan } from "../oracle/toolRunner.js";
import { TOOLS } from "../oracle/toolRegistry.js";
import { cajaDelAgente } from "./herramientasAgente.js";
import { doctrinasParaRonda } from "./doctrinaAgente.js";
import { esPorQue, doctrinaDelPorque, vetosDelPorque } from "./porque.js";   // la ley del porqué, transversal (owner 2026-09-09)
import { vetosDeReferencia } from "./referenciaDeLaCifra.js";
import { esReformular, doctrinaDeReformular, vetosDeReformular, componerReformulacion, destinatarioDe, doctrinaDeAudiencia, previaSustantiva } from "./reformular.js";   // la misma respuesta, para otro (owner 2026-09-10)   // owner 2026-09-09: la cifra que sostiene una recomendación trae su referencia
import { mapaDelDato, faltanteQueToca } from "./mapaDelDato.js";   // + lo que el archivo del usuario no trajo (owner 2026-08-31)
import { guardC, esNarracionVacia, parseCounts } from "../oracle/guardC.js";   // parseCounts: los conteos de la previa se re-autorizan igual que sus cifras (Etapa 4)
import { cifrasDelDato } from "../oracle/datoProyectado.js";
import { axisEntityNames } from "../oracle/entityIndex.js";
import { parseFigures } from "../boleta.js";
import { stripLanguageLeaks } from "../llm/voiceGuard.js";
import { getSelloDeCarga, idDeCargaActiva } from "../../ingesta/estadoCarga.js";
import { anteponerSello } from "../../ingesta/selloEnRespuesta.js";
import { detectFichaIntent } from "../oracle/fichaIntent.js";   // la puerta a la ficha desde texto libre (re-cableada en La Poda: era del natural)
import { entidadNombrada } from "./playbooks/indiceEntidades.js";   // DIARIO ETAPA 2: la entidad de la cita manda sobre la de la pregunta
import { extraerCalculos, stripAllMarks, composeNoDataMessage } from "../oracle/narrationBlocks.js";
import { normalizeResponse } from "../responseContract.js";
import { _respaldoDeLoYaAprobado } from "../oracle/respaldoAprobado.js";   // paso 0 de la Poda: el peldaño compartido ya no vive en el módulo con fecha de retiro
import { _oracionesDe } from "../oracle/narratePromptC.js";   // la PODA usa el cortador que ya existe — jamás un tercero (ver `_podarOracionVetada`)
import { recitaAprobadaDe, alcanceHeredadoDe } from "../oracle/cicloNotarial.js";   // R2: la MISMA memoria de re-cita · y el ALCANCE HEREDADO («esos clientes»), re-cableado tras la poda
import { detectCriteriaIntent } from "../criteria.js";     // el MISMO detector que answerViaOracle — una red, una verdad
import { composeCriteria } from "../conversation.js";      // la MISMA composición (setCriterion/forgetCriterion), jamás una copia
import { envejecerPendingSimulation, pendingSimulationVigente, withOfertaPendiente,
  emptyConversationScope, resolveConversationReference, updateConversationScope, composeReferenceAmbiguity, composeReferenceDecline,
  doctrinaDeReferente, vetoReferente, ordenPresentadoEn, esAlcanceGlobal } from "../oracle/conversationScope.js";   // EL SCOPE CANÓNICO, cableado al agente (owner 2026-09-11): no otra memoria, no otro resolver
import { buildRequestContext } from "../oracle/requestContext.js";   // el tenant del scope se valida con el MISMO contexto que usa el resto
import { ESCENARIO_INICIAL } from "../../config/scenarios.js";   // colapso del eje: el agente lee el MISMO dato que la pantalla
import { vetosDeContrato, esIdentificadorInterno, esEncargoCompuesto } from "./contratoAgente.js";
import { vetoCifraSinBoleta } from "./cifraSinBoleta.js";   // el juez del turno que NO leyó — vive SOLO en el agente (ver su cabecera)
import { getNombreUsuario, setNombreUsuario } from "./preferenciaNombre.js";   // R4c · el trato viaja en los rescates y persiste por `mem`
import { detectSerieIntent, composeSerieIntent } from "../oracle/serieIntent.js";   // R9 · el puente, también en modo agente
import { playbookPara, pasosDe, promesasCumplidas, doctrinaDelPlaybook, vetosDelPlaybook, formaDelTurno } from "./playbooks/registro.js";
import { anclaDelCuadro } from "./playbooks/cuadroExplicado.js";   // el cuadro abierto persiste en la memoria del hilo (owner 2026-09-08: «profundiza en…»)   // el playbook: la evidencia ANTES de la decisión (owner 2026-08-31)
import { serieRealDe } from "../sentrix/capability.js";
import { buildRolesCartera } from "../sentrix/rolesCartera.js";
import { partesDelEncargo, pasosDelEncargo, componerEncargo, doctrinaDelEncargo } from "./encargoCompuesto.js";
import { dominiosDe, pasosDeDominios, unirPasosDeDominios, doctrinaDeDominios } from "./contratoDeDominios.js";   // la pregunta determina qué dominios participan (owner 2026-09-14) — generaliza el contrato comercial   // toda pregunta comercial parte de la misma realidad comercial (owner 2026-09-13)   // el peldaño del encargo compuesto (owner 2026-09-11): cobertura garantizada cuando el cerebro cae   // las huellas con sello del turno: el juez compartido las lee para no aceptar un mecanismo afirmado sin su sello (owner 2026-09-11)
import { getTenantId, getTenantData } from "../../data/tenantStore.js";
/* ── EL NOTARIO SEMÁNTICO (owner 2026-09-15, fase 2) ─────────────────────────────────────────────────────────────────
 * «El modelo redacta; el modelo declara qué está afirmando; Notario verifica la afirmación contra la evidencia estructurada; la
 * redacción no determina la verdad.» El cerebro entrega la respuesta y, al final, su bloque de afirmaciones; el juez semántico
 * (verificador + detector de presencia + consistencia prosa/declaración) dicta el veredicto DE HECHO; los chequeos de hecho del
 * muro dejan de vetar y quedan en el expediente como detectores; las leyes de la casa siguen juzgando la respuesta entera. Los
 * peldaños determinísticos declaran desde sus propias figs (declaración derivada) y se juzgan con el mismo estándar. */
import { extraerDeclaracion, declaracionDeRespaldo } from "../notario/declaracion.js";
import { crearDeclarador, filtrarPorTexto } from "../notario/declarar.js";
import { juzgarDeclaracion, CHEQUEOS_DE_HECHO } from "../notario/juez.js";
import { indiceDeEvidencia } from "../notario/evidencia.js";   // getTenantData: el contexto que el negocio declaró — la ley del porqué lo cita en vez de repreguntar   // la semilla de variación: tenant + pregunta + largo del hilo

const TOPE_RONDAS = 3;      // rondas que pueden pedir herramientas
const TOPE_CALLS = 12;      // tool-calls por turno, sumadas todas las rondas
const CALLS_POR_RONDA = 8;  // el cap vigente de runPlan
/* LA RONDA PREVIA DEL CONTRATO NO ES UN PLAN DEL CEREBRO (owner 2026-09-14, contrato de dominios): sus pasos son los de
 * la casa —determinísticos, sin costo de modelo— y con dos dominios suman más de ocho (comercial 5–7 · inventario 6 ·
 * el cruce 2). Los topes de arriba existen contra un plan PATOLÓGICO del modelo; recortar la realidad de un dominio
 * por un cap pensado para eso era justo lo que dejaba la boleta a medias (medido: los días por SKU no llegaban). La
 * ronda previa tiene su propio techo, y el cerebro conserva su presupuesto de siempre después de ella. */
const TOPE_PRE_RONDA = 18;   // pasos del contrato + del procedimiento en la ronda previa

/* P1b DE LA CORRIDA 2 (2026-08-31): LA REPARACIÓN TIENE QUE SABER QUÉ CIFRA SE VETÓ. Medido en T2: el cierre
 * y su reparación cosecharon la multa IDÉNTICA («30.1% narrado como ventas, pero pertenece a margen») porque
 * el mensaje pedía «reescribe tu respuesta COMPLETA» y el modelo devolvía la misma frase con otro envoltorio.
 * La multa YA nombra la cifra ofensora: se extrae mecánicamente y se le pide reformular ESA oración —o quitarla—
 * con el aviso de que repetir cosecha el mismo rechazo. Determinístico: regex sobre la multa, cero comprensión. */
/* ⚠️ EL «%» NO LLEVA `\b` DETRÁS. Medido sobre la corrida 4 y es el defecto que dejó a P1b a medias: este
 * extractor NO detectaba ni un porcentaje («1%», «52%», «30.1%» → nada), solo dinero y «pp». Así que en cada
 * veto de porcentaje —los más frecuentes: márgenes, benchmark, carga— la multa viajaba SIN la instrucción
 * quirúrgica, y el cerebro reformulaba a ciegas: es la tercera parte del defecto de T10. `\b` se define sobre
 * [A-Za-z0-9_]: entre «%» y el fin de la cadena (o un espacio) no hay frontera. El `\b` queda solo donde la
 * unidad termina en letra («pp», «x»). Vigilado por `_agente_contrato_gate` §5g. */
const _CIFRA_EN_MULTA = /\$\s?[\d.,]+\s?[KMB]?|[\d.,]+\s*%|[\d.,]+\s*(?:pp|x)\b/gi;
function _cifrasDeMulta(multa) {
  const t = String(multa || "");
  const entrecomilladas = (t.match(/«[^»]{1,40}»|"[^"]{1,40}"/g) || []).join(" ");
  const fuente = /\d/.test(entrecomilladas) ? entrecomilladas : t;
  return [...new Set((fuente.match(_CIFRA_EN_MULTA) || []).map((s) => s.trim()))].slice(0, 4);
}
const _MENSAJE_NOTARIO = (multa) => {
  const cifras = _cifrasDeMulta(multa);
  const foco = cifras.length
    ? `\nLo rechazado es ${cifras.length === 1 ? "esta cifra" : "estas cifras"}: ${cifras.join(" · ")}. Reescribe SOLO la oración que ${cifras.length === 1 ? "la" : "las"} contiene: dale el dueño y el concepto que de verdad le corresponden según tus resultados, o quítala. Repetir la misma frase recibe el mismo rechazo.`
    : "";
  return `[NOTARIO — no es el usuario] Tu respuesta no pasó la verificación:\n${multa}${foco}\nDevuelve tu respuesta COMPLETA con esa corrección, manteniendo tu calidad de asesor, y vuelve a declarar TODAS tus afirmaciones en el bloque <<AFIRMACIONES>> … <<FIN>> (actualizado: lo corregido con su nueva declaración, lo quitado sin ella). No menciones esta corrección.`;
};

/* ── _podarOracionVetada · quitar la oración que el muro rechazó, cuando la respuesta NO depende de ella ─────
 * Devuelve el texto sin esas oraciones, o `null` si podar sería mutilar. Las cuatro condiciones son
 * acumulativas y se verifican acá — ninguna se declara:
 *   (a) la multa NOMBRA cifras (si el veto no está localizado en una cifra, no hay oración que señalar);
 *   (b) las oraciones ofensoras son POCAS — hasta `TOPE_PODA`: si media respuesta está vetada, el problema no
 *       es una frase de color y el turno tiene que declinar como siempre;
 *   (c) queda texto Y queda al menos UNA cifra de la boleta de este turno — o sea: lo que el usuario pidió
 *       sobrevive al corte. Si la cifra vetada era la respuesta, no se poda nada;
 *   (d) el resultado vuelve al muro completo (lo hace el caller).
 * El corte usa `_oracionesDe` de `narratePromptC` —el mismo criterio de bordes que guardC, con las cifras
 * enmascaradas para que el punto de «$13.3M» no parta una oración—: no se escribe un tercer cortador. */
const TOPE_PODA = 2;
export function _podarOracionVetada(texto, multa, figs, fragmentos = []) {   // exportada para que el gate y la medición usen LA función, no una copia
  const cifras = _cifrasDeMulta(multa);
  /* los FRAGMENTOS que el juez semántico señaló (la afirmación falsa, no verificable o no declarada) localizan la oración igual que una cifra */
  const frags = (Array.isArray(fragmentos) ? fragmentos : []).map((x) => String(x || "").trim()).filter((x) => x.length >= 3);
  if (!cifras.length && !frags.length) return null;                  // (a)
  const t = String(texto || "");
  let tramos = [];
  try { tramos = _oracionesDe(t) || []; } catch { return null; }
  if (tramos.length < 2) return null;                                // una sola oración: podarla es tirar el turno
  const _norm = (s) => String(s).replace(/\s+/g, "");
  const _normF = (s) => String(s).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, "");
  /* con fragmentos del juez semántico la poda es EXACTA: corta la oración de la afirmación señalada, no toda oración que repita su cifra
   * («$3.0M adicionales» verdadera en el primer párrafo y «Los $3.0M extra no te recuperan…» inconsistente en el segundo) */
  const ofensoras = frags.length
    ? tramos.filter(([lo, hi]) => frags.some((f) => _normF(t.slice(lo, hi)).includes(_normF(f))))
    : tramos.filter(([lo, hi]) => cifras.some((c) => _norm(t.slice(lo, hi)).includes(_norm(c))));
  if (!ofensoras.length || ofensoras.length > TOPE_PODA) return null;   // (b)
  /* (b2) NO PODAR SI LA ORACIÓN SIGUIENTE LA REFERENCIA. Medido sobre el corpus: en el T4 la multa señala
   * «$1.0M» en «si entran a margen actual, sumas $1.0M», y la oración de después dice «…sumas $1.2M — una
   * diferencia de $200K». Podando la primera, la segunda afirma una diferencia contra un término que ya no
   * está: el texto queda gramatical y MIENTE. Una comparación explícita después de la ofensora es señal de que
   * la ofensora sostiene lo que sigue — y lo que sostiene algo no es una frase de color. */
  /* ⚠️ `\bvs\.?\b` NO EXISTE, y lo escribí yo: `\b` se define sobre [A-Za-z0-9_], así que después del punto de
   * «vs.» no hay frontera y esa alternativa jamás matchea. Es el mismo defecto que este frente lleva cazando
   * toda la semana; me lo cazó el barrido de §5g del gate del contrato, no yo. El cierre correcto es el
   * negative-lookahead de la casa. */
  const _COMPARA = /\buna diferencia de\b|\bversus\b|\bvs\.?(?![a-záéíóúüñ])|\bfrente a\b|\bcomparad[oa] con\b|\ben vez de\b|\bcontra (?:los|las|el|la)\b|\bcontra \$|\bm[aá]s que\b|\bmenos que\b|\ben cambio\b|\bpor el contrario\b|\bsi en (?:cambio|vez)\b/i;
  const finUltimaOfensora = Math.max(...ofensoras.map(([, hi]) => hi));
  const posteriores = tramos.filter(([lo]) => lo >= finUltimaOfensora).map(([lo, hi]) => t.slice(lo, hi)).join(" ");
  if (_COMPARA.test(posteriores)) return null;
  /* (b3) NI SI LA SIGUIENTE LA SEÑALA CON EL DEDO (batería en vivo de la Etapa 4, corrida 3): la ofensora nombraba
   * a las cuatro cuentas y la de después abría «en estos cuatro, el margen bajo el benchmark coincide con…» — podada
   * la primera, «estos cuatro» quedó apuntando a nada en la pantalla del dueño. Un deíctico al arranque de la
   * oración siguiente (estos · esos · ese · ahí · los tres/cuatro…) es la misma señal que la comparación: la
   * ofensora sostiene lo que sigue. Solo la INMEDIATA: más lejos, la referencia es del hilo.
   * ⚠️ LA ORACIÓN SIGUIENTE ENTERA, no sus primeros 60 caracteres (owner 2026-09-12, batería compuesta · «natural»):
   * «Es la brecha entre el margen que hoy entregan y el benchmark, no una acción ya cuantificada que garantice ESE
   * MONTO» señalaba al $4.9M podado desde el carácter 95, y sobrevivió huérfana. Si depende de la podada, no se
   * poda: el turno baja al peldaño siguiente. */
  const _SENALA = /(?<![\wáéíóúñ])(?:est[eoa]s?|es[eoa]s?|aqu[eé]ll[oa]s?|ah[ií]|ell[oa]s|dich[oa]s?|(?:el|la|los|las) mism[oa]s?|los (?:dos|tres|cuatro|cinco|seis)|las (?:dos|tres|cuatro|cinco|seis)|ambos|ambas)(?![\wáéíóúñ])/i;
  const siguiente = tramos.find(([lo]) => lo >= finUltimaOfensora);
  if (siguiente && _SENALA.test(t.slice(siguiente[0], siguiente[1]).trim())) return null;

  const quedan = tramos.filter((x) => !ofensoras.includes(x));
  const podado = quedan.map(([lo, hi]) => t.slice(lo, hi)).join("").replace(/[ \t]+\n/g, "\n").replace(/\n[ \t]+/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  if (!podado) return null;
  /* (c) LA RESPUESTA TIENE QUE SOBREVIVIR. Una cifra de LA BOLETA DE ESTE TURNO es la prueba de que lo que
   * quedó sigue respondiendo con lo que el turno leyó — no un texto sin cifras que suene bien. */
  const deLaBoleta = (Array.isArray(figs) ? figs : []).map((f) => _norm(f && f.value)).filter(Boolean);
  if (!deLaBoleta.length) return null;
  const sobrevive = deLaBoleta.some((v) => _norm(podado).includes(v));
  return sobrevive ? podado : null;
}

const _ejes = (lista) => {
  const o = [];
  for (const e of lista) { try { for (const n of axisEntityNames(e)) o.push(n); } catch { /* eje sin índice */ } }
  return o.length ? o : null;
};

/* P3 DE LA CORRIDA 2 (2026-08-31) · EL CIERRE RE-PAGA LA BOLETA ENTERA. Los resultados viajan sin caché y cada
 * llamada posterior (cierre · reparación · re-cierre) los re-paga completos: 4 turnos con gridTable fueron el
 * 57% de la corrida. MEDIDO acá, sobre el demo: gridTable(cliente) 16.201 chars · gridTable(sku) 24.389 ·
 * el resto de las herramientas < 3.700. Y de ese peso, lo CITABLE (label + valor de cada fila) es 9.715 y
 * 14.959: el resto son `facts` con las mismas filas en otra forma.
 * LA PODA: por encima del tope, `facts` se recorta a sus escalares de cabecera (lens, dimensión, n, totales) y
 * se DECLARA el corte — nunca en silencio (la ley del mapa). Las cifras van TODAS: lo que el modelo puede citar
 * verbatim no se toca, y las figs completas siguen yendo a guardC, que corre local y gratis. Las herramientas
 * chicas no se tocan: se poda lo que pesa, no todo. */
const TOPE_RESULTADO_CHARS = 6000;
/* LA SEGUNDA PALANCA DE P3, declarada y medida: por encima de este hilo, el cierre NO escala al tier caro.
 * Con la poda de arriba, un turno con la tabla entera de SKU deja el hilo en ~15.6K chars (medido: 24.389 →
 * 15.646, −36%); superarlo requiere DOS lecturas grandes en el mismo turno, y ahí el tier caro dejó de comprar
 * calidad — la corrida 2 gastó el 78% en cierres que re-pagaban boleta y salió PEOR (verdes 14→2). Es una
 * palanca de COSTO, explícita y revisable, no una regla de calidad. Se mide en chars (determinístico, sin
 * tokenizer). UNA sola verdad: la consola del examen y el adapter de producción importan esta constante. */
export const TECHO_ENTRADA_CIERRE_CHARS = 28000;
function _factsCompactos(facts) {
  const out = {};
  if (facts && typeof facts === "object") {
    for (const [k, v] of Object.entries(facts)) if (v === null || typeof v !== "object") out[k] = v;
  }
  out.detalle_recortado = "las filas completas no viajan en el hilo — cada cifra citable está en `cifras`";
  return out;
}
/** el resumen de una ronda de herramientas, para el cerebro — datos crudos, no prosa. */
/* `compactoDesde` (contrato de dominios, 2026-09-14): en una ronda previa de DOS dominios los resultados son 13–16 y sus
 * `facts` pesan el doble que las cifras (medido: 20K de facts contra 11K de cifras, 33K en total, sobre el techo de 28K
 * del cierre). Cada cifra citable ya viaja en `cifras`; los facts de las lecturas se compactan a sus escalares desde un
 * umbral más bajo, salvo las herramientas que llevan su contrato en los facts (`conservar`). Sin las opciones, la
 * conducta de siempre, byte a byte. */
function _resumenDeRonda(rp, { compactoDesde = TOPE_RESULTADO_CHARS, conservar = null } = {}) {
  return rp.results.map((r) => {
    const base = {
      tool: r.tool,
      ok: !(r.coverage && r.coverage.supported === false),
      ...(r.coverage && r.coverage.supported === false ? { motivo: r.coverage.reason } : {}),
      facts: r.facts,
      cifras: (r.boleta || []).map((f) => ({ label: f.label, valor: f.text || f.value })),
    };
    const umbral = conservar && conservar.has(r.tool) ? TOPE_RESULTADO_CHARS : compactoDesde;
    if (JSON.stringify(base).length <= umbral) return base;
    return { ...base, facts: _factsCompactos(r.facts) };
  });
}
/* las herramientas cuyos facts SON su contrato (huellas con sello, partición de la brecha, la mesa del cobro): no se compactan */
const _FACTS_QUE_SE_CONSERVAN = new Set(["rolesCartera", "diagnose", "cobranza"]);
const TOPE_RESULTADO_PRE_RONDA = 1500;

/* ── LA ESCALERA INVERTIDA · peldaño 1: la línea honesta con lo VERIFICADO del turno ─────────────────────────── */
/* R4b · métricas para emparejar un supuesto con su contraparte verificada (con y sin tilde). */
const _METRICAS_REFUTACION = ["margen", "venta", "ventas", "contribución", "contribucion", "carga", "capital",
  "inventario", "rotación", "rotacion", "unidades", "acciones", "costo"];
const _reWord = (t) => new RegExp(`\\b${String(t).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
function _lineaHonesta({ motivos, figs, juzgar, entidades, falta, preferir = null, relegar = null }) {
  const motivo = motivos.length ? motivos[motivos.length - 1] : null;
  /* las cifras salen de la BOLETA ACUMULADA — verificadas por el muro antes de adoptarse, nunca compuestas
   * libres (F1 §9.3). Obligatorias primero.
   * ⚠️ JAMÁS UN SUPUESTO DEL USUARIO: la frase dice «lo que sí tengo verificado», y una cifra que el usuario
   * ofreció es exactamente lo contrario — citarla acá la blanquearía como dato. */
  const verificadas = figs.filter((f) => f.source !== "user_supuesto" && f.label && (f.text || f.value));

  /* R4b DEL EXAMEN 1 (2026-08-31): si el turno registró un supuesto y lo verificado lo CONTRADICE, la
   * refutación viaja también en el rescate — la corrección 30%→22.0% de T5 existía en los borradores y nunca
   * llegó: el usuario quedó creyendo el 30%. Emparejamiento CONSERVADOR: entidad Y métrica del supuesto
   * presentes en el label verificado, misma unidad, valor distinto — ante cualquier duda, nada. */
  let refutacion = null, contra = null;
  const sup = figs.find((f) => f.source === "user_supuesto" && f.label);
  if (sup) {
    const entSup = (Array.isArray(entidades) ? entidades : []).find((e) => _reWord(e).test(sup.label)) || null;
    const metSup = _METRICAS_REFUTACION.find((m) => _reWord(m).test(sup.label)) || null;
    if (entSup && metSup) {
      contra = verificadas.find((f) => _reWord(entSup).test(String(f.label)) && _reWord(metSup).test(String(f.label))) || null;
      if (contra && contra.unit === sup.unit && Number.isFinite(contra.raw) && Number.isFinite(sup.raw) && Math.abs(contra.raw - sup.raw) > 1e-9) {
        refutacion = `El supuesto que registraste no coincide con lo verificado: ${contra.label} = ${contra.text || contra.value}.`;
      } else { contra = null; }
    }
  }

  /* UNA CIFRA POR ORACIÓN, SIEMPRE (P1a de la corrida 2, y la regla se mantiene acá aunque ahora se prueben
   * varias cifras): apilar cifras en una misma oración le da al binding semántico del muro varias candidatas
   * que atribuir y el propio rescate se veta — fue el tercer escalón de la cascada que terminó en VACÍO. Se
   * prueban VARIAS, se sirve UNA. */
  /* ⚠️ `mandatory` NOMBRABA DOS CONCEPTOS, y este peldaño usaba el equivocado (T2 de la certificación,
   * 2026-09-01). En el contrato de la boleta `mandatory` significa «esta cifra HAY QUE CITARLA»; acá se lo
   * estaba leyendo como «esta es la MEJOR para rescatar». No son lo mismo, y la tool `proyectar` lo dejó a la
   * vista: marca la base como obligatoria (es dato verificado) y la proyección como no obligatoria (un
   * supuesto no se exige) — las dos con razón. Resultado: ante una pregunta de proyección, el peldaño servía
   * la BASE y ofrecía la respuesta: «también tengo Proyección: dime cuál abro». Enumeraba en vez de servir.
   *
   * LA SEPARACIÓN, no la inversión: invertir el orden arregla este caso y rompe el siguiente. El peldaño gana
   * su propio criterio —«¿qué fue a buscar este turno?»— y `mandatory` conserva el suyo dentro de cada grupo.
   * La señal es `source`, que la boleta YA declara: una cifra calculada o proyectada es lo que el turno
   * produjo para responder; una lectura del dato es el insumo con el que lo produjo. (No se puede declarar un
   * campo nuevo: `fig()` desestructura opciones conocidas y `boleta.js` no se toca.) */
  const _RESULTADO_DEL_TURNO = new Set(["computed", "proyeccion"]);
  const _esResultado = (f) => _RESULTADO_DEL_TURNO.has(String(f && f.source));
  /* LAS CIFRAS QUE SOLO TRAJO EL CONTRATO COMERCIAL VAN AL FINAL (2026-09-13): el turno fue a buscar otra cosa —la
   * proyección, el año anterior, la cuenta nombrada— y eso es lo que el rescate sirve primero; la realidad comercial
   * de fondo queda como último recurso, no como la fila 1. `relegar(f)` lo decide el bucle, que sabe qué herramienta
   * trajo cada cifra y quién la pidió. */
  const _rel = typeof relegar === "function" ? (f) => { try { return !!relegar(f); } catch { return false; } } : () => false;
  const _cat = (f) => (_esResultado(f) && f.mandatory ? 0 : _esResultado(f) && !f.mandatory ? 1 : f.mandatory ? 2 : 3) + (_rel(f) ? 4 : 0);
  const _ordenBase = verificadas.map((f, i) => ({ f, i, c: _cat(f) })).sort((a, b) => a.c - b.c || a.i - b.i).map((x) => x.f).filter((f) => f !== contra);
  /* ⚠️ EL RESCATE RESPETA EL REFERENTE Y EL ALCANCE (owner 2026-09-11, su prueba de continuidad). Medido: a
   * «¿qué está explicando ese resultado?» —pregunta del negocio entero— este peldaño sirvió «Falabella · Brecha
   * al benchmark, 8.1 pp»: la fila 1 de `rolesCartera`, que ordena por venta. No «recordaba» a Falabella: no
   * tenía noción alguna de referente ni de alcance. La partición es ESTABLE (el orden de siempre se conserva
   * dentro de cada mitad): con referente, primero las cifras cuyo dueño es el referente; con alcance de
   * negocio, primero las que no tienen dueño de cuenta. Sin `preferir`, no cambia un solo byte. */
  const _duenoDe = (f) => { const l = String(f.label || ""); const i = l.indexOf(" · "); return i === -1 ? null : l.slice(0, i).trim(); };
  const _esDeEntidad = (f) => { const d = _duenoDe(f); return !!d && (Array.isArray(entidades) ? entidades : []).some((e) => _reWord(e).test(d)); };
  const _preferida = (f) => {
    if (!preferir) return true;
    if (Array.isArray(preferir.entidades) && preferir.entidades.length) { const d = _duenoDe(f); return !!d && preferir.entidades.some((e) => _reWord(e).test(d)); }
    if (preferir.alcance === "cartera") return !_esDeEntidad(f);
    return true;
  };
  /* la MÉTRICA pedida ordena dentro de cada mitad (2026-09-14): la cifra del concepto que la pregunta nombra va primero */
  const _deLaMetrica = (f) => !!(preferir && preferir.metrica instanceof RegExp && preferir.metrica.test(String(f.label || "")));
  /* …pero NUNCA por delante del RESULTADO del turno (la proyección, el cálculo): eso es lo que el turno fue a buscar —
   * la métrica pedida solo ordena entre las lecturas del dato */
  const _conMetrica = (arr) => (preferir && preferir.metrica instanceof RegExp
    ? [...arr.filter((f) => _esResultado(f) && _deLaMetrica(f)), ...arr.filter((f) => !_esResultado(f) && _deLaMetrica(f)), ...arr.filter((f) => _esResultado(f) && !_deLaMetrica(f)), ...arr.filter((f) => !_esResultado(f) && !_deLaMetrica(f))]
    : arr);
  /* ── EL RÓTULO NO ES SUPERFICIE (owner 2026-09-11, batería compuesta · «natural») ──────────────────────────
   * Este peldaño sirvió «Lo que tengo verificado ahora: Medida · cerrar brecha al piso, $4.9M»: un rótulo interno
   * del motor, con su separador, en la pantalla del dueño. La regla ya existía para la ALTERNATIVA que se ofrece
   * (ver `_JERGA` abajo) y no para la cifra que se CITA. Ahora las dos pasan por el mismo filtro —una medida
   * interna o un identificador no es una cifra que se pueda decir— y la citada se escribe en prosa: «el margen
   * de Falabella, 22%», «las ventas del período, $99.9M». Sin rótulo, sin punto medio. */
  const _JERGA_ROTULO = /^(?:medida|vs(?![a-záéíóúñ])|% |porcentaje|headline|sub(?![a-záéíóúñ]))/i;
  const _conceptoYDueno = (f) => {
    const partes = String(f.label || "").split("·").map((x) => x.trim()).filter(Boolean);
    const _ents = Array.isArray(entidades) ? entidades : [];
    if (partes.length >= 2 && _ents.some((e) => _reWord(e).test(partes[0]))) return { concepto: partes.slice(1).join(" · "), dueno: partes[0] };
    return { concepto: partes.join(" · "), dueno: null };
  };
  const _decible = (f) => {
    const { concepto } = _conceptoYDueno(f);
    if (!concepto || concepto.length < 3 || _JERGA_ROTULO.test(concepto)) return false;
    return !concepto.split(/\s+/).some((pz) => esIdentificadorInterno(pz, Array.isArray(entidades) ? entidades : []));
  };
  const _enProsa = (f) => {
    const { concepto, dueno } = _conceptoYDueno(f);
    const c = concepto.replace(/\s*·\s*/g, " "); const cMin = c.charAt(0).toLowerCase() + c.slice(1);
    return dueno ? `${cMin} de ${dueno}` : cMin;
  };
  const _base = _ordenBase.filter(_decible);
  const candidatas = preferir ? [..._conMetrica(_base.filter(_preferida)), ..._conMetrica(_base.filter((f) => !_preferida(f)))] : _base;

  /* C3 DE LA CORRIDA 3 (2026-08-31) · EL RESCATE DEJA DE RENDIRSE CON LA PRIMERA CIFRA. Medido: «compara Q1 vs
   * Q2» con `trend` corrido llegaba acá con 46 cifras verificadas en la boleta; este peldaño elegía la primera
   * obligatoria («Venta del período = $100.0M»), el muro la vetaba CON RAZÓN —es una derivada que el dato
   * declara no reconciliada— y como no había segundo intento el turno caía al genérico pelado: «No tengo
   * información autorizada suficiente», con la serie mensual del negocio en la mano. No faltaba dato: estaba
   * mal elegida la cifra. Ahora se recorren las candidatas hasta que una pase el muro.
   * Y LA ALTERNATIVA SE NOMBRA (criterio del owner: «límite corto CON alternativa disponible… el trimestre no
   * está en el dato; el corte anual sí: ¿lo abro?»): sale de lo que ESTE turno ya tiene —los conceptos que la
   * boleta trajo—, no de adivinar la familia de la pregunta. Sin cifras en esa oración: es una oferta, no una
   * afirmación. */
  /* EL CONCEPTO DE UN LABEL, con la convención de la boleta («Entidad · Concepto» o «Serie · Punto»): si la
   * IZQUIERDA es una entidad del tenant, el concepto es la derecha («Falabella · Margen» → «Margen»); si no lo
   * es, la izquierda ya ES el concepto («Este año · Ene» → «Este año»). Se descartan las etiquetas de medida
   * interna («Medida …», «Vs …», «% del total»): la alternativa se le ofrece al usuario, así que va en su
   * idioma, no en el del motor. */
  const _ents = Array.isArray(entidades) ? entidades : [];
  const _JERGA = /^(?:medida|vs\b|% |porcentaje)/i;
  const alternativa = (excluida) => {
    const conteo = new Map();
    for (const f of verificadas) {
      const partes = String(f.label).split("·").map((s) => s.trim()).filter(Boolean);
      let concepto = partes[0];
      if (partes.length >= 2) concepto = _ents.some((e) => _reWord(e).test(partes[0])) ? partes[partes.length - 1] : partes[0];
      /* ⚠️ EL FILTRO MEDÍA UN PREFIJO (medido en la certificación, 2026-09-01): `_JERGA` descarta lo que
       * EMPIEZA con «Medida», «Vs», «% » — y `headlineSub`, que es un nombre de campo del motor, no empieza
       * con ninguno, así que se ofreció al usuario en pantalla («también tengo Valor y headlineSub»). La
       * alternativa se le ofrece a una persona: va en su idioma. Se pregunta por el CONCEPTO —¿esto es un
       * identificador de código?— y no por cómo arranca la palabra. */
      if (!concepto || concepto.length < 5 || /^\d/.test(concepto) || _JERGA.test(concepto)) continue;
      if (concepto.split(/\s+/).some((p) => esIdentificadorInterno(p, _ents))) continue;
      if (_ents.some((e) => _reWord(e).test(concepto))) continue;   // una entidad no es un concepto que ofrecer
      conteo.set(concepto, (conteo.get(concepto) || 0) + 1);
    }
    const yaCitado = excluida ? String(excluida.label) : "";
    const nombres = [...conteo.entries()]
      .filter(([c, n]) => (n >= 2 || verificadas.some((f) => f.mandatory && String(f.label).includes(c))) && !yaCitado.includes(c))
      .sort((a, b) => b[1] - a[1]).map(([c]) => c).slice(0, 2);
    /* LA VOZ (2026-09-03): «dime cuál abro» era además LA MISMA cadena que el humo marca como el menú de
     * labels — el peldaño legítimo y el defecto histórico compartían frase. La oferta ahora pregunta. */
    return nombres.length ? `De este mismo turno también tengo ${nombres.join(" y ")}: ¿te abro alguno?` : null;
  };

  /* sin un LÍMITE que nombrar ni contenido que ofrecer, este peldaño no tiene nada honesto que decir: cede al
   * siguiente. Una disculpa sin cifra ni alternativa no es una respuesta (criterio del owner). */
  if (!motivo && !candidatas.length && !refutacion && !falta) return null;
  /* SI LO QUE FALTA ES DEL ARCHIVO, SE NOMBRA (owner 2026-08-31): «tu archivo no trae la hoja Abonos: con
   * ella te abro quién te debe». Eso es el «límite corto CON alternativa» aplicado al dato incompleto — decir
   * la CAUSA, no la consecuencia, y con el nombre de la columna o la hoja tal como la ingesta la nombró. */
  /* ── EL LÍMITE HACE AVANZAR LA CONVERSACIÓN (Etapa 3, owner 2026-09-11) ────────────────────────────────────
   * Su vara, textual: no una respuesta «defensiva ni burocrática» («no pude completar la lectura con la calidad
   * que corresponde»), sino «puedo demostrar X, pero no todavía Y; si me dices Z, separo ambas causas». El
   * orden cambia de sentido: PRIMERO lo que sí se puede afirmar —la cifra verificada, con su dueño—, DESPUÉS el
   * límite con su causa cuando la hay, y al final la puerta concreta. Mismo material, misma verdad; el que lee
   * se lleva primero lo que sirve. Sin causa nombrable y sin cifra, se dice corto y se pide la pista. */
  const _limite = falta ? `Tu archivo no trae ${falta.pieza}: con eso te abro ${falta.abre}.`
    : motivo ? `Lo que no pude armar es el resto: ${motivo}.` : null;
  const _armar = (fig) => (fig
    ? [
      `Lo que tengo verificado ahora: ${_enProsa(fig)}, ${fig.text || fig.value}.`,
      _limite || "La lectura completa que pediste no la pude armar con la calidad que corresponde.",
      refutacion,
      alternativa(fig) || "Dime por dónde quieres que siga y lo trabajo sobre lo disponible.",
    ]
    : [
      _limite || "No pude armar esa lectura con la calidad que corresponde.",
      refutacion,
      alternativa(fig) || "Dime qué cuenta, cifra o corte estás mirando y lo trabajo sobre lo disponible.",
    ]).filter(Boolean).join(" ");

  const _pasa = (t) => {
    if (typeof juzgar !== "function") return true;
    try { const v = juzgar(t); return !!(v && v.ok); } catch { return false; }
  };
  const TOPE_INTENTOS = 6;   // acotado: recorrer la boleta entera sería pagar juicios sin fin por un rescate
  for (const fig of candidatas.slice(0, TOPE_INTENTOS)) {
    const c = _armar(fig);
    if (_pasa(c)) return c;
  }
  // ninguna cifra pasó (o no había): el límite igual se dice, con su alternativa y sin cifra que lo hunda
  const sinCifra = _armar(null);
  return _pasa(sinCifra) ? sinCifra : null;
}

/**
 * answerViaAgente({ text, history, mem, scenario, callAgente }) → { r, mem } | throws
 * El caller (ChatADI) atrapa el throw y cae al camino natural — la misma red de resiliencia de siempre.
 */
/* ── LA SIEMBRA DEL CONTEXTO DE CUADRO (owner 2026-09-05, adenda: «sembrar, no construir») ──────────────────
 * Palabra del owner: «el botón que está en Sentrix en cuadros o tablas, ADI debe explicar exactamente lo que
 * ve ahí la foto… puedes sembrar el camino». EL HALLAZGO al cablearlo: la UI YA arma ese contexto (el
 * `registerAsk((q, vc) => …)` de ChatADI guarda la pieza que el usuario tocó) y se lo pasa al camino natural
 * — pero al AGENTE no se lo pasaba nadie. O sea: el emisor ya sembró y el receptor no escuchaba.
 *
 * EL CONTEXTO entra, viaja y queda REGISTRADO en el expediente del turno (`agente.viewContext`).
 *
 * LA REGLA QUE RIGE: el contexto DESCRIBE la superficie (vista, eje, campo), jamás trae cifras. Lo que no
 * entra por el módulo no se cuela al texto — una sola verdad.
 *
 * ── `cuadro` · EL ANCLA DEL CLICK, QUE ES OTRA COSA QUE `viewContext` (owner 2026-09-08) ──────────────────
 * «El botón no manda solo texto: manda el ancla completa del cuadro que el usuario está viendo.» Los dos
 * campos transportan un ViewContext, y la diferencia es de ORIGEN, que es lo único que importa acá:
 *   · `viewContext` = lo que el turno tiene delante — el explícito si hubo click, y si no, EL AMBIENTE de la
 *     vista abierta. Sirve para desambiguar; sigue sin cambiar por sí solo ninguna respuesta.
 *   · `cuadro`      = SOLO el explícito: la pieza que el usuario TOCÓ en este turno. Se consume una vez.
 * Un click, un turno: el ambiente sigue publicado mientras la Mesa está abierta, así que abrir la explicación
 * de cuadro por ambiente haría que la siguiente pregunta escrita a mano se respondiera como si fuera un botón.
 * Por eso son dos campos y no uno. Ver `_CONTRATO_ASK_DE_CUADRO.md`. */
export async function answerViaAgente({ text, history, mem, scenario = ESCENARIO_INICIAL, callAgente, viewContext = null, cuadro = null } = {}) {
  if (typeof callAgente !== "function") throw new TypeError("answerViaAgente sin callAgente: el cerebro lo pone el caller");
  const q = String(text || "").trim();
  const memIn = (mem && typeof mem === "object") ? mem : {};
  const recentPrev = Array.isArray(memIn.recentNarrations) ? memIn.recentNarrations : [];
  /* EL TRATO VIAJA EN LA MEMORIA DEL TURNO, y esta es la causa REAL de que el rescate de T7 saliera sin nombre
   * (medido 2026-08-31, no supuesto): `preferenciaNombre` guarda en el módulo + localStorage, y la consola del
   * examen corre UN PROCESO POR TURNO sin localStorage — el nombre registrado en un turno se perdía al
   * terminar ese proceso. Por eso el trato aparecía solo cuando el cerebro volvía a llamar la herramienta en el
   * MISMO turno, y lo que parecía «el apodo persiste once turnos» era el modelo copiándolo del hilo, no la
   * preferencia funcionando. Se rehidrata desde `mem`, que sí viaja turno a turno por el mismo canal que el
   * resto de la memoria. En el navegador no cambia nada: el módulo ya lo tiene y esto solo lo respalda. */
  if (typeof memIn.nombreUsuario === "string" && memIn.nombreUsuario && !getNombreUsuario()) {
    try { setNombreUsuario(memIn.nombreUsuario); } catch { /* un nombre inválido en memoria no rompe el turno */ }
  }
  /* ⚠️ EL TRATO SE REGISTRA SOLO, NO SE LE PIDE AL CEREBRO (T1 de la certificación, 2026-09-01). El usuario
   * abrió con «llamame jc de ahora en adelante» y el turno salió sin trato. Medido en el expediente:
   * `mem.nombreUsuario` quedó `undefined` en los OCHO turnos — el cerebro escribió «JC,» en su prosa (lo leyó
   * de la pregunta) pero NUNCA llamó a `preferenciaNombre`, así que la preferencia no existió para el motor y
   * el playbook, que es determinístico, salió sin nombre. El cableado estaba bien: lo que faltaba era el
   * registro. Y no es que «el bucle no aplique el trato al texto del playbook» —lo aplica, el playbook marca
   * `suplente`—: nunca hubo nombre que aplicar.
   * SE HACE ACÁ Y NO EN LA LETRA porque una instrucción al modelo es una promesa y esto es un hecho: la
   * herramienta sigue existiendo para cuando el cerebro quiera usarla, pero el trato ya no depende de que se
   * acuerde. Patrón acotado —la forma en que se pide un trato, no cualquier nombre en la frase— y la validación
   * la hace `setNombreUsuario`, que rechaza lo que no es un nombre corto y simple. */
  {
    /* ⚠️ SIN «dime»/«decime» (cazado en la sonda del playbook C, 2026-09-01): «proyecta 12 meses con +4% y DIME
     * CUÁNTO genera» registraba «cuánto» como el nombre del usuario, y «dime SI alguno queda» registraba «si».
     * La respuesta salía «cuánto: Sobre tu venta…». «Dime X» casi nunca es un trato y casi siempre es una
     * pregunta; «llámame X» / «me llamo X» / «mi nombre es X» sí lo son, y con eso alcanza. */
    const m = String(q || "").match(/\b(?:ll[aá]mame|llamame|llam[aá]me|puedes llamarme|pod[eé]s llamarme|me llamo|mi nombre es)\s+(?:"|«)?([\p{L}][\p{L}\p{N}.'-]{1,23})/iu);
    /* el punto de FIN DE ORACIÓN no es parte del nombre: «llámame Ana.» registraba «Ana.» y el trato salía
     * «Ana.: …». Se permite el punto interno («J.C.») y se recorta la puntuación final. */
    const _trato = m && m[1] ? m[1].replace(/[.,;:!?]+$/, "") : "";
    if (_trato) { try { setNombreUsuario(_trato); } catch { /* un trato inválido no rompe el turno */ } }
  }
  /* ── DIARIO ETAPA 2 · EL CAPTURADOR DE INTENCIÓN y EL OLVIDO (owner 2026-09-05, GO al plan) ──────────────
   * rolesCartera emite la pregunta al dueño («¿El volumen de X a ese margen es una apuesta tuya…?») y hasta
   * hoy NADIE capturaba la respuesta. El capturador es ANGOSTO y determinístico (cero llamadas, el patrón
   * del criterio): solo si el turno ANTERIOR del asistente contiene la pregunta (su frase fija, con las
   * entidades que la propia casa escribió) y el usuario AFIRMA — se guarda SU CITA textual, jamás un resumen.
   * Ante la duda, no se guarda y el turno sigue su camino normal. */
  {
    const _prevAsistente = (() => {
      const h = Array.isArray(history) ? history : [];
      for (let i = h.length - 1; i >= 0; i--) {
        const m = h[i];
        if (m && m.role !== "user" && typeof m.text === "string" && m.text.trim()) return m.text;
      }
      return "";
    })();
    const _mPregunta = /¿El volumen de (.+?)(?: y (.+?))? a ese margen es una apuesta tuya/.exec(_prevAsistente);
    /* sin `\b` tras clases con vocal acentuada (§5g — quinta mordida del mismo perro, cazada por el barrido) */
    const _FINP = "(?![a-záéíóúüñ])";
    const _AFIRMA = new RegExp([
      `\\bapuesta m[ií]a${_FINP}`, `\\bes (?:una )?apuesta${_FINP}`, `\\blo (?:decid[ií]|empuj[oé]) yo${_FINP}`,
      `\\bes deliberad`, `\\bes estrategia${_FINP}`, `\\bs[ií]${_FINP}[^.\\n]{0,30}(?:apuesta|deliberad|estrategia|m[ií]a${_FINP})`,
    ].join("|"), "i");
    if (_mPregunta && _AFIRMA.test(q) && q.trim().length <= 240) {
      /* LA ENTIDAD DE LA CITA MANDA (medido en la sonda al estrenar esto): se preguntó por Falabella y Jumbo
       * y el dueño respondió «el volumen de LIDER es apuesta mía» — anotar su palabra bajo las entidades de
       * LA PREGUNTA la desalineaba. Si su frase nombra a alguien del índice, se anota bajo ESE nombre; si no
       * nombra a nadie, respondió a la pregunta tal cual y valen las entidades preguntadas. */
      const _delaCita = (() => { try { const e = entidadNombrada(q); return e ? [e.nombre] : null; } catch { return null; } })();
      const entidades = _delaCita || [_mPregunta[1], _mPregunta[2]].filter(Boolean);
      const intencion = { cita: q.trim(), pregunta: "volumen_deliberado", entidades,
        fecha: new Date().toISOString().slice(0, 10), carga: (() => { try { return idDeCargaActiva(); } catch { return null; } })() };
      const previas = Array.isArray(memIn.intenciones) ? memIn.intenciones : [];
      const mem2 = { ...memIn, intenciones: [...previas.filter((x) => !(x && x.pregunta === "volumen_deliberado" && JSON.stringify(x.entidades) === JSON.stringify(entidades))), intencion].slice(-10), diarioCambio: true };
      const texto = `Anotado, con tu palabra: «${q.trim()}». Cuando lea el margen de ${entidades.join(" y ")}, lo voy a recordar como decisión tuya — y si el dato cambia, te lo digo re-midiendo, no de memoria.`;
      return {
        r: normalizeResponse({ text: texto, route: "agente", deterministic: true, claims: [], suggestions: null, sentrixAction: null,
          agente: { estado: "intencion", rondas: 0, calls: 0, figs: 0, motivos: [], vetos: [], recitaCifras: 0 } }),
        mem: { ...mem2, recentNarrations: [texto, ...recentPrev].slice(0, 2) },
      };
    }
    /* EL OLVIDO — con persistencia real, «cerrar el chat» ya no borra: el usuario manda sobre su memoria.
     * Detector angosto del objeto DIARIO (el criterio tiene el suyo); borrar acá + la marca para el server. */
    const _OLVIDA = /\bolvid[aá](?:te)?\b[^.\n]{0,50}\b(?:lo que (?:guardaste|anotaste|ten[eé]s guardado)|la (?:lectura|tesis)|mi (?:respuesta|palabra)|esa intenci[oó]n|todo lo que (?:guardaste|anotaste|sabes de m[ií]))/i;
    if (_OLVIDA.test(q)) {
      const habia = !!(memIn.diarioTesis || (Array.isArray(memIn.intenciones) && memIn.intenciones.length));
      const mem2 = { ...memIn, diarioTesis: null, intenciones: [], diarioCambio: true };
      const texto = habia
        ? "Listo: borré la lectura y las respuestas que tenía guardadas. El borrado es definitivo — no lo puedo deshacer, y una carga nueva no lo revive."
        : "No tenía nada guardado tuyo — no hay nada que borrar.";
      return {
        r: normalizeResponse({ text: texto, route: "agente", deterministic: true, claims: [], suggestions: null, sentrixAction: null,
          agente: { estado: "olvido", rondas: 0, calls: 0, figs: 0, motivos: [], vetos: [], recitaCifras: 0 } }),
        mem: { ...mem2, recentNarrations: [texto, ...recentPrev].slice(0, 2) },
      };
    }
  }
  /* ── MEMORIA DE CRITERIO · el bypass ANTES del cerebro (re-cableado en la tanda post-poda, 2026-09-05) ────
   * La poda dejó esta conducta INALCANZABLE: `detectCriteriaIntent`/`composeCriteria` solo vivían en
   * coerceChain/answerViaOracle, y el peldaño del agente respondía antes — «recuerda que mi margen mínimo es
   * 25%» GASTABA una llamada y no persistía nada. Es el MISMO bloque que tenía el natural (y que answerViaOracle
   * conserva): mismo detector, misma composición, mismo trato de memoria. NO pasa por guardC por la razón
   * documentada allá: es confirmación administrativa con cifras que el usuario nombró — el muro la vetaría
   * como cifra-no-autorizada. */
  {
    const criteriaIntent = (() => { try { return detectCriteriaIntent(q); } catch { return null; } })();
    if (criteriaIntent) {
      const cr = composeCriteria(criteriaIntent);
      let mem2 = { ...memIn, lastOffer: null, pendingSimulation: envejecerPendingSimulation(pendingSimulationVigente(memIn.pendingSimulation)), recentNarrations: [cr.text, ...recentPrev].slice(0, 2) };
      if (mem2.conversationScope) mem2 = { ...mem2, conversationScope: withOfertaPendiente(mem2.conversationScope, null) };
      return {
        r: normalizeResponse({
          text: cr.text,
          route: "oracle",   // byte-idéntico al bypass del oráculo: es el MISMO bypass, conservado
          evidence: cr.evidence,
          deterministic: true,
          claims: [],
          suggestions: cr.suggestions || null,
          sentrixAction: cr.sentrixAction || null,
          agente: { estado: "criterio", rondas: 0, calls: 0, figs: 0, motivos: [], vetos: [], recitaCifras: 0 },
        }),
        mem: mem2,
      };
    }
  }
  /* ── REFORMULAR SIN NADA QUE REFORMULAR (owner 2026-09-10) ─────────────────────────────────────────────
   * Si piden re-decir lo ya respondido y en el hilo todavía no hay respuesta, no hace falta salir a leer NI
   * llamar al cerebro: no hay material. Lo que importa es QUÉ se le dice, y la frase de siempre —«no tengo
   * información autorizada suficiente»— sería falsa otra vez: el dato está, lo que falta es la lectura.
   * Se responde con la verdad y se ofrece hacerla. Cero herramientas, cero llamadas. */
  {
    const _hs = Array.isArray(history) ? history : [];
    const _hayPrevia = _hs.some((h) => h && h.role !== "user" && typeof h.text === "string" && h.text.trim().length > 40);
    if (esReformular(q) && !_hayPrevia) {
      return {
        r: normalizeResponse({
          text: "Todavía no te he respondido nada en esta conversación, así que no hay una respuesta que reescribir. Dime qué quieres mirar y la hago; después te la dejo en el tono y el largo que necesites.",
          route: "agente", deterministic: true, claims: [], evidence: null, suggestions: null, sentrixAction: null,
          agente: { estado: "sin-que-reformular", rondas: 0, calls: 0, figs: 0, motivos: [], vetos: [], recitaCifras: 0 },
        }),
        mem: memIn,
      };
    }
  }

  const caja = cajaDelAgente(TOOLS);
  const herramientas = Object.keys(caja).sort();
  const mapa = mapaDelDato(scenario);
  /* R9 DEL EXAMEN 1 (2026-08-31): ENTIDAD×PERÍODO BLOQUEADA → EL PUENTE, también en modo agente. Medido en el
   * bloque B: las 4 variantes declinaron honestas PERO en 8-11 líneas con menú, T9 divergió con un cuestionario
   * que prometía una cifra que el bloqueo hace imposible («con eso puedo traerte la cifra limpia» — puerta
   * falsa), y las 4 expusieron el instrumento. El puente determinístico resuelve el MISMO caso en 1-2 líneas
   * con la razón verdadera y la puerta real (la ficha) — esa ES la letra, y acá se sirve VERBATIM, como en el
   * camino natural (determinístico aprobado; el mismo espejo, no una segunda letra). SOLO intercepta la serie
   * BLOQUEADA o el nombre ambiguo: con serie real reconciliada el cerebro corre con su herramienta
   * (serieEntidad) — el agente sigue siendo agente donde el dato responde. */
  {
    const det = (() => { try { return detectSerieIntent(q); } catch { return null; } })();
    const bloqueada = det && !det.ambiguo && det.entidad && (() => { try { return !serieRealDe(det.entidad).real; } catch { return false; } })();
    /* `noResuelve` también es del puente (2026-09-02): el nombre pedido no existe en el índice y el compose
     * declina nombrándolo y ofreciendo el parecido — sin esta rama, el turno seguía al cerebro con un intent
     * sin entidad y la declinación honesta no llegaba a pantalla. */
    if (det && (det.ambiguo || det.noResuelve || bloqueada)) {
      const puente = (() => { try { return composeSerieIntent({ q, scenario }); } catch { return null; } })();
      if (puente && puente.text) {
        const pantalla = anteponerSello(puente.text, getSelloDeCarga(), { calculos: [] });
        return {
          r: normalizeResponse({
            text: pantalla, route: "agente", deterministic: true, claims: [], suggestions: null,
            sentrixAction: puente.sentrixAction || null,
            agente: { estado: "puente", rondas: 0, calls: 0, figs: 0, motivos: [], vetos: [], recitaCifras: 0 },
          }),
          mem: { ...memIn, recentNarrations: [pantalla, ...recentPrev].slice(0, 2) },
        };
      }
    }
  }

  /* R2 DEL EXAMEN 1 DEL AGENTE (2026-08-31): la re-cita de lo YA aprobado a pantalla — el MISMO cable del
   * camino natural (caminoNatural.js), que acá NUNCA se conectó: el contador marcó 0 en los 28 turnos y las
   * cifras aprobadas en turnos previos ($194K de T9, re-citado en T13) morían como «no autorizadas». Raíz de
   * la mayoría de los turnos no-verdes. Los candados del owner viven en recitaAprobadaDe (mismo dueño, misma
   * unidad, solo textos que el muro aprobó). */
  const recita = (memIn.recitaAprobada && Array.isArray(memIn.recitaAprobada.figs) && memIn.recitaAprobada.figs.length)
    ? memIn.recitaAprobada : null;
  /* LA RE-CITA TAMBIÉN ES EVIDENCIA (R2): una cifra que ya salió a pantalla con su dueño en un turno previo se puede volver a decir del mismo
   * dueño. Entra al índice como fig rotulada «dueño · conceptos (re-cita)», con la misma memoria y los mismos candados que usa el muro. */
  const _figsDeRecita = (() => {
    if (!recita || !Array.isArray(recita.figs)) return [];
    const nombres = new Set((_ejes(["cliente", "sku", "marca", "familia", "bodega", "canal"]) || []).map((n) => String(n).toLowerCase()));   // (los dueños del tenant, calculados acá porque `duenosTenant` se declara después)
    return recita.figs.map((x) => {
      const duenos = Array.isArray(x.duenos) ? x.duenos.map(String) : [];
      const ent = duenos.find((d) => nombres.has(d.toLowerCase()));
      const conceptos = duenos.filter((d) => d !== ent && !/^(?:negocio|total|totales|cartera|global)$/i.test(d));
      const pf = parseFigures(String(x.value || ""))[0] || null;
      return { label: `${ent || "negocio"} · ${conceptos.length ? conceptos.join(" ") : "cifra"} (re-cita)`, value: String(x.value || ""), unit: pf ? pf.unit : null, raw: pf ? pf.raw : NaN, canon: x.canon, source: "recita", mandatory: false, context: "cifra aprobada a pantalla en un turno previo, con su dueño" };
    }).filter((g) => g.unit);
  })();


  // ── el hilo que ve el cerebro (la misma disciplina del camino natural: el turno una sola vez) ──
  const mensajes = [];
  for (const h of Array.isArray(history) ? history : []) {
    if (!h || typeof h.text !== "string" || !h.text.trim() || h.pending) continue;
    mensajes.push({ role: h.role === "user" ? "user" : "assistant", content: h.text });
  }
  const _ultimo = mensajes.length ? mensajes[mensajes.length - 1] : null;
  if (!(_ultimo && _ultimo.role === "user" && _ultimo.content.trim() === q)) mensajes.push({ role: "user", content: q });

  /* ── EL SCOPE CANÓNICO ENTRA AL AGENTE (owner 2026-09-11) ──────────────────────────────────────────────────
   * LA PRUEBA DE CONTINUIDAD DEL OWNER, auditada offline: «¿qué está explicando ese resultado?» redujo el negocio
   * a Falabella y «profundiza en el primero» —sobre una tabla que abría con Lider— respondió Falabella. En este
   * camino NADIE conservaba ni resolvía `scope → conjunto presentado → ordinal → entidad activa`: todo vivía en
   * la lectura que el modelo hace del hilo. `conversationScope` (la memoria canónica del Contrato v2) lo hacía
   * bien para el oráculo y quedó huérfana tras La Poda: el agente ni la escribía ni la leía.
   * SU ORDEN: «reutilizando conversationScope y los mecanismos existentes. No quiero otra memoria paralela ni
   * otro resolver». Acá se LEE (la referencia se resuelve ANTES del cerebro y viaja como hecho del
   * procedimiento) y al cierre del turno se ESCRIBE (el conjunto que este turno presentó, en su orden).
   * El plan es SINTÉTICO —el agente no tiene PLAN— y solo declara lo que el turno ya sabe sin adivinar: si la
   * pregunta pide el negocio entero, y si nombra una entidad del índice. Nada más. */
  const scopePrev = (memIn.conversationScope && typeof memIn.conversationScope === "object") ? memIn.conversationScope : emptyConversationScope();
  const requestContext = (() => { try { return buildRequestContext({ scenario, mem: memIn }); } catch { return null; } })();
  const _nombrada = (() => { try { return entidadNombrada(q); } catch { return null; } })();
  const planSintetico = { intent: null, mode: null, scope: { level: esAlcanceGlobal(q) ? "global" : (_nombrada ? "entity" : null), entities: _nombrada ? [_nombrada.nombre] : [] } };
  const referente = (() => { try { return resolveConversationReference(q, planSintetico, scopePrev, requestContext, null, viewContext || null); } catch { return { kind: "none" }; } })();
  /* AMBIGUO O SIN CONJUNTO → se pregunta o se declina en una línea, SIN llamar al cerebro (cero costo): la
   * misma composición que ya usaba el oráculo, nunca una pregunta genérica. */
  if (referente && (referente.kind === "ambiguous" || referente.kind === "decline")) {
    const texto = referente.kind === "ambiguous" ? composeReferenceAmbiguity(referente.options) : composeReferenceDecline(referente.reason, referente.detalle || null);
    const pantalla = anteponerSello(texto, getSelloDeCarga(), { calculos: [] });
    return {
      r: normalizeResponse({
        text: pantalla, route: "agente", deterministic: true, claims: [], suggestions: null, sentrixAction: null,
        agente: { estado: referente.kind === "ambiguous" ? "referente-ambiguo" : "referente-sin-conjunto", rondas: 0, calls: 0, figs: 0, motivos: [], vetos: [], recitaCifras: 0,
          referente: { kind: referente.kind, reason: referente.reason || null, options: referente.options || null } },
      }),
      mem: { ...memIn, recentNarrations: [pantalla, ...recentPrev].slice(0, 2) },
    };
  }
  /* el cambio a negocio entero («volvamos al negocio completo») también se le DICE al cerebro: el resolutor
   * devuelve «none» ahí a propósito (el cambio de tema lo maneja el escritor), pero el alcance es un hecho. */
  const _doctrinaRef = doctrinaDeReferente(planSintetico.scope.level === "global" ? { kind: "resolved-scope", alcance: "cartera" } : referente, scopePrev.current);
  if (_doctrinaRef) mensajes.push({ role: "user", content: _doctrinaRef });
  /* lo que el resolutor decidió, para el rescate y para el expediente */
  const _preferirDelTurno0 = referente && referente.kind === "resolved" ? { entidades: referente.entities }
    : (referente && referente.kind === "resolved-scope" && referente.alcance === "cartera") || planSintetico.scope.level === "global" ? { alcance: "cartera" }
    /* la cuenta NOMBRADA en la pregunta (contrato comercial, 2026-09-13): la boleta trae a las trece, y el rescate de
     * «¿qué hago con Ferretería Aurora?» tiene que citar a Ferretería Aurora, no la fila 1 de la primera herramienta */
    : planSintetico.scope.level === "entity" && planSintetico.scope.entities.length ? { entidades: planSintetico.scope.entities }
    : null;
  /* LA MÉTRICA QUE LA PREGUNTA NOMBRA (contrato de dominios, 2026-09-14): «¿cuántas unidades vendimos?» rescatado con
   * «valor de Lider, $2.3M» era la fila 1 de la primera herramienta. Con dos dominios en la boleta, la cifra que se
   * sirve primero es la del concepto pedido —unidades, stock, saldo— y el resto queda como alternativa. Léxico, y solo
   * ORDENA: no cambia qué cifras existen ni cuáles están verificadas. */
  /* los dominios que la pregunta hace participar (contrato de dominios, 2026-09-14) — se leen UNA vez; los usan el rescate y la ronda previa */
  const _dom = (() => { try { return dominiosDe(q); } catch { return { dominios: [], eje: null }; } })();
  const _metricaPedida = (() => {
    const t = String(q || "");
    const M = [
      [/\bunidades\b|\bvolumen\b|\bcantidad(?:es)?\b/i, /Unidades vendidas|Efecto volumen/i],
      [/\bstock\b|\binventario\b|\bcapital\b|\bd[ií]as de inventario\b/i, /Capital|Stock|Valor de inventario|Unidades en stock|Cobertura \(DOH\)/i],
      [/\bcobr|\bdeb(?:e|en)\b|\bdeuda|\bvencid|\bsaldo\b|\bcr[eé]dito\b/i, /Saldo pendiente|Saldo vencido/i],
      [/\bcontribuci/i, /Contribución/i],
      [/\bm[aá]rgen/i, /Margen/i],
      [/\bventas?\b|\bvend[a-zíó]*\b|\bfactur/i, /· Venta$|Ventas|Venta total|Variación vs año anterior/i],
    ];
    /* en un turno de UN dominio el orden de siempre manda (medido: C3 servía el año anterior y debe seguir) — salvo las
     * unidades, que son nuevas y no tenían quién las sirviera («¿cuántas unidades vendimos?» rescatado con «valor de Lider») */
    if (_dom.dominios.length < 2) return M[0][0].test(t) ? M[0][1] : null;
    /* con dos dominios: la métrica que la pregunta nombra PRIMERO («¿qué marca vende más y cuánto capital…?» → la venta) */
    const enOrden = M.map(([re, out]) => { const m = re.exec(t); return m ? { i: m.index, out } : null; }).filter(Boolean).sort((a, b) => a.i - b.i);
    return enOrden.length ? enOrden[0].out : null;
  })();
  /* y EL EJE que la pregunta nombra en un turno de dos dominios («¿qué marca vende más y cuánto capital…?»): sin esto el
   * alcance «cartera» prefería las cifras sin dueño y el rescate servía «sobrestock % del total» a una pregunta por marca.
   * Con el eje nombrado, primero las cifras cuyo dueño es una entidad de ESE eje. Solo si ningún referente lo resolvió. */
  const _entidadesDelEje = (() => {
    if (_dom.dominios.length < 2 || !_dom.eje || (_preferirDelTurno0 && Array.isArray(_preferirDelTurno0.entidades))) return null;
    try { const n = axisEntityNames(_dom.eje) || []; return n.length ? n : null; } catch { return null; }
  })();
  const preferirDelTurno = _preferirDelTurno0 || _metricaPedida || _entidadesDelEje
    ? { ...(_preferirDelTurno0 || {}), ...(_entidadesDelEje ? { entidades: _entidadesDelEje, alcance: undefined } : {}), ...(_metricaPedida ? { metrica: _metricaPedida } : {}) }
    : null;

  // ── el bucle ──
  const figsTotales = [];
  const resultsTotales = [];
  const callsDelTurno = [];
  const motivosCoercion = [];   // pedidos corregidos por el referente resuelto — observación, va al expediente
  const motivosNoSoportado = [];
  let calls = 0, rondas = 0, correccionUsada = false, rondaExtraUsada = false;
  let texto = null;

  /* ejecuta UNA tanda de pedidos y deja el intercambio en `destino` (el hilo que verá la llamada siguiente).
   * Es EL cuerpo de la ronda — la ronda normal y la ronda extra de R1 comparten esta única implementación
   * para que jamás diverjan. false = sin cupo (el tope manda). */
  let topeCalls = TOPE_CALLS;   // se re-fija tras la ronda previa: el cerebro conserva su presupuesto entero
  const _rondaDeHerramientas = (pedidosCrudos, destino, { preRonda = false, compacta = false } = {}) => {
    const cupo = preRonda ? Math.min(TOPE_PRE_RONDA, Math.max(CALLS_POR_RONDA, pedidosCrudos.length)) : Math.min(CALLS_POR_RONDA, topeCalls - calls);
    if (cupo <= 0) return false;
    /* EL REFERENTE RESUELTO MANDA SOBRE EL PEDIDO (2026-09-11): si el procedimiento resolvió «el primero» = Lider
     * y el cerebro pide la herramienta para Falabella —otra cuenta del MISMO conjunto—, el pedido se corrige
     * antes de correr (la misma coerción que el oráculo hacía con su plan). Solo cuando el referente es UNA
     * entidad y la pedida está en el conjunto presentado: un pedido por una cuenta de afuera es otra cosa y
     * se respeta. Queda en el expediente: nunca una corrección muda. */
    const pedidosCoercidos = pedidosCrudos.map((p) => {
      const ent = p && p.args && typeof p.args.entity === "string" ? p.args.entity : null;
      if (!ent || !referente || referente.kind !== "resolved" || referente.entities.length !== 1) return p;
      const conjunto = (scopePrev.current && Array.isArray(scopePrev.current.entities)) ? scopePrev.current.entities : [];
      if (ent === referente.entities[0] || !conjunto.includes(ent)) return p;
      motivosCoercion.push(`${p.tool}: pidió ${ent}, el referente resuelto es ${referente.entities[0]}`);
      return { ...p, args: { ...p.args, entity: referente.entities[0] } };
    });
    /* UNA HERRAMIENTA NO CORRE DOS VECES CON LOS MISMOS ARGUMENTOS EN EL MISMO TURNO (2026-09-11, cazado al
     * medir la mini prueba): el playbook ya había corrido `marginRead` y el cerebro la volvió a pedir; la boleta
     * quedó con cada cliente DUPLICADO y el composer, que reconcilia «8 de 8», vio 16 y se retiró. Los resultados
     * ya están arriba en el hilo: se le dice y no se re-corre — que además es una llamada menos. */
    const _firma = (p) => `${p.tool}::${JSON.stringify(p.args || {})}`;
    const yaCorridas = new Set(callsDelTurno.map(_firma));
    const pedidos = pedidosCoercidos.filter((p) => !yaCorridas.has(_firma(p)));
    if (!pedidos.length) {
      destino.push({ role: "assistant", content: `[pedido de herramientas] ${pedidosCoercidos.map((p) => p.tool).join(", ")}` });
      destino.push({ role: "user", content: "[MOTOR — no es el usuario] Esas herramientas ya corrieron en este turno con esos mismos argumentos y sus resultados están arriba. Responde con ellos; no hace falta volver a pedirlas." });
      return true;   // la ronda se consume, la boleta no se duplica
    }
    const rp = runPlan({ intent: "answer", calls: pedidos.map((p) => ({ tool: p.tool, args: p.args || {} })) },
      { scenario, maxCalls: cupo, preguntaUsuario: q, registry: caja });
    calls += Math.min(pedidos.length, cupo);
    callsDelTurno.push(...pedidos.slice(0, cupo).map((p) => ({ tool: p.tool, args: p.args || {} })));
    figsTotales.push(...(rp.ledger && rp.ledger.figs ? rp.ledger.figs : []));
    resultsTotales.push(...rp.results);
    for (const u of rp.unsupported || []) if (u && u.reason) motivosNoSoportado.push(u.reason);
    for (const r of rp.results) if (r.coverage && r.coverage.supported === false && r.coverage.reason) motivosNoSoportado.push(r.coverage.reason);

    destino.push({ role: "assistant", content: `[pedido de herramientas] ${pedidos.map((p) => p.tool).join(", ")}` });
    /* DOCTRINA BAJO DEMANDA (F2b · §10): la instrucción de CADA herramienta usada viaja pegada a su resultado —
     * el turno que no toca P&L no carga su arco. Bloques byte-estables y en orden fijo (la disciplina del mapa):
     * el prefijo del proveedor no distingue «mismo contenido en otro orden» de «contenido nuevo». */
    const doctrina = doctrinasParaRonda(rp.results.map((r) => r.tool));
    destino.push({ role: "user", content: `[HERRAMIENTAS — no es el usuario] Resultados:\n${JSON.stringify(_resumenDeRonda(rp, compacta ? { compactoDesde: TOPE_RESULTADO_PRE_RONDA, conservar: _FACTS_QUE_SE_CONSERVAN } : {}))}${doctrina ? `\n${doctrina}` : ""}\nResponde al usuario con esto, o pide más herramientas si de verdad faltan.` });
    return true;
  };

  /* R6 DEL EXAMEN 1 (2026-08-31): LEER ANTES DE DECLINAR U OPINAR. Medido: T20 afirmó una limitación FALSA
   * («sin 24 meses no puedo» — el dato trae el año anterior) con 0 herramientas y quedó verde; en 5 de 7 turnos
   * de la ventana 17-23 declinó o clarificó sin UNA cifra; en 24-28 pidió permiso conversacional para lecturas
   * internas («¿Quieres que tire el Executive Summary? ¿Sí o no?») en vez de ejecutarlas. Declinar sin boleta
   * es opinar. El empujón es UNO por turno, consume ronda (jamás un bucle infinito) y NO aplica cuando el
   * límite citado ya es el DECLARADO del mapa («no reconcilia» — ahí declinar directo ES la conducta). */
  const _RE_DECLINA_SIN_LEER = /\bno (?:tengo|puedo|dispongo|hay|registro)\b|\bsin (?:datos|serie|hist[oó]rico?a?|24 meses)\b|¿(?:quieres|deseas) que\b|¿s[ií] o no\?|¿vamos con\b|¿procedo\b/i;
  /* P2 DE LA CORRIDA 2 (2026-08-31): EL EMPUJÓN NO APLICA A RE-NARRACIONES. Medido sobre la MISMA pregunta
   * («dame una versión más dura, como si tuviera que presentarla al gerente»): corrida 1 = US$0.0059, verde,
   * UNA llamada barata desde la historia; corrida 2 con el empujón = US$0.2534, limite, 5 llamadas con dos
   * cierres del tier caro. 43× más caro y PEOR. Reformular lo ya dicho no necesita leer nada: lo que hace
   * falta ya está en el hilo. Patrones CONSERVADORES (sobre la pregunta, no sobre la respuesta): «versión más
   * X», reformular/reescribir, «de otra manera», «más corto/duro/formal», «resumí eso/lo anterior», «como si
   * tuviera que…». NO caza «resumen ejecutivo» ni «resumen para el directorio»: esas son lecturas NUEVAS. */
  const _RE_RENARRACION = /\bversi[oó]n (?:m[aá]s|distinta|corta|dura)\b|\breformul|\breescrib|\bde otra manera\b|\ben otras palabras\b|\bm[aá]s (?:corto|corta|breve|conciso|concisa|duro|dura|simple|formal|directo|directa|suave)\b|\bresum[ií](?:lo|melo|me)?\s+(?:eso|esto|lo anterior|lo que)\b|\bmismo (?:texto|mensaje)\b|\bcomo si (?:tuviera|fuera|se lo|lo)\b/i;
  const esRenarracion = _RE_RENARRACION.test(q);
  let nudgeUsado = false;

  /* ── EL PLAYBOOK · LA EVIDENCIA ANTES DE LA DECISIÓN (owner 2026-08-31) ────────────────────────────────────
   * «Responder con toda la evidencia disponible antes de rescatar o pedir aclaración… como criterio
   * ESTRUCTURAL, idealmente apoyado en playbooks, no con prompts genéricos de "sé menos cauteloso"» (textual).
   * Acá está la estructura: cuando un playbook aplica, sus pasos corren ANTES de la primera llamada al
   * cerebro, por el MISMO cuerpo de ronda que todo lo demás (mismos cupos, misma boleta, misma doctrina). El
   * cerebro no decide «si se anima a leer»: cuando decide, la evidencia ya está en la mano. Y si igual falla,
   * el playbook tiene su entregable determinístico en la escalera (más abajo). La bandera del agente sigue
   * apagada; esto no enciende nada. */
  /* el hilo viaja al detector (T5): las formas elípticas del porqué solo abren si la última lectura fue de
   * margen, y eso solo se sabe mirando el hilo. Un caller sin history mide el peor caso: la elíptica no abre. */
  /* `mem` viaja en el ctx del playbook (owner 2026-09-08, tercera entrega): «si el usuario quiere profundizar
   * debes seguir — te podría decir "profundiza en la contribución"». El ancla del click se consume en SU turno;
   * la profundización del turno siguiente la reabre desde `mem.cuadroAbierto` (escrito más abajo), y SOLO una
   * pregunta con forma de profundización — la memoria desambigua, jamás secuestra un turno libre. */
  /* `referente` viaja también (2026-09-11): «profundiza en el primero» no nombra a nadie, pero el scope canónico ya
   * resolvió a quién apunta — y un playbook que responde por UNA entidad (la ficha) o por DOS (comparar) puede
   * tomar el turno con el referente como si lo hubieran nombrado. Así el turno tiene procedimiento y entregable
   * determinístico, y si el cerebro falla, el respaldo responde por el referente y no por otro. */
  const ctxTurno = { history, viewContext, cuadro, mem: memIn, referente };   // el ctx del turno, ENTERO, para toda la cadena del playbook
  const playbook = (() => { try { return playbookPara(q, ctxTurno); } catch { return null; } })();
  let playbookActivo = null;
  /* LOS PASOS PUEDEN DEPENDER DE LA PREGUNTA (2026-09-01): `pasosDe` resuelve el Array de siempre o la función
   * de un playbook de FORMA —«lectura por eje» elige la herramienta según el eje que su detector léxico ya
   * identificó—. Un playbook cuyos pasos no se resuelven a nada se retira acá mismo, sin ruido. */
  /* EL ENCARGO COMPUESTO (owner 2026-09-11): sus partes se reconocen ANTES del cerebro y los pasos del turno son la
   * unión de los del procedimiento activo y los de cada parte — el modelo recibe toda la evidencia, y si cae, el
   * ensamblador (peldaño 0, más abajo) compone con lo ya leído sin salir a buscar nada. Solo con dos o más partes.
   * Sin procedimiento activo no hay pasos ni peldaño: el encargo sobre el negocio entero lo toma la foto como
   * paraguas (su detector), y el resto sigue el camino de siempre. */
  const _partesEncargo = (() => { try { return partesDelEncargo(q); } catch { return []; } })();
  const _pasosPb = playbook ? (_partesEncargo.length ? pasosDelEncargo(_partesEncargo, pasosDe(playbook, q, ctxTurno), ctxTurno) : pasosDe(playbook, q, ctxTurno)) : [];
  /* EL CONTRATO COMERCIAL (owner 2026-09-13): «toda pregunta comercial parte de la misma realidad comercial; la pregunta
   * determina el foco de la respuesta, no qué evidencia tiene disponible ADI». Si el tema es comercial, los pasos del
   * contrato corren en la MISMA ronda que los del procedimiento —unidos, sin repetir una herramienta con los mismos
   * argumentos— también cuando ningún procedimiento aplica: el cerebro libre recibe la realidad comercial precargada
   * y elige extras, en vez de elegir desde cero. Los del procedimiento van primero (su orden es su lectura). */
  /* EL CONTRATO DE DOMINIOS (owner 2026-09-14) generaliza el comercial: «la pregunta determina qué dominios participan;
   * cada dominio aporta su realidad suficiente; ADI solo relaciona aquello que el archivo demuestra que puede
   * relacionarse». Comercial · Inventario · Cobranza, cada uno con sus pasos; una palabra de inventario ya no retira la
   * base comercial (composición, no exclusión), y en un turno de dos dominios viaja además la doctrina de CRUCE: claves
   * de unión, compatibilidad declarada por el pack, los dos marcos, y qué relación no existe. */
  const _esComercial = _dom.dominios.includes("comercial");
  const _pasosContrato = (() => { try { return pasosDeDominios(_dom); } catch { return []; } })();
  const _pasosTurno = unirPasosDeDominios(_pasosPb, _pasosContrato);
  if (_pasosTurno.length) {
    if (_rondaDeHerramientas(_pasosTurno.map((p) => ({ tool: p.tool, args: p.args || {} })), mensajes, { preRonda: true, compacta: _dom.dominios.length >= 2 })) {
      topeCalls = Math.max(TOPE_CALLS, calls + (TOPE_CALLS - CALLS_POR_RONDA));   // el cerebro conserva al menos el presupuesto que tenía tras una ronda previa llena
      /* el playbook solo PROMETE si sus figs obligatorias llegaron: en un dato que no las sostiene se retira
       * sin ruido y el turno sigue por el camino de siempre (nada de prometer lo que no se puede cumplir).
       * Con pasos por pregunta, las obligatorias también dependen de ella — si no, la promesa que se verifica
       * no sería la que se hizo. */
      if (playbook && _pasosPb.length && promesasCumplidas(playbook, figsTotales, q, ctxTurno)) {
        playbookActivo = playbook;
        mensajes.push({ role: "user", content: doctrinaDelPlaybook(playbook, q, ctxTurno, figsTotales) });   // con la boleta: las conclusiones del procedimiento viajan (owner 2026-09-13)
      }
      /* y las doctrinas de los dominios que participan (la comercial: las conclusiones del procedimiento — margen-en-
       * riesgo ya las manda con la suya, ahí no se duplican; la de inventario; la de cobranza; y la de cruce) */
      if (_pasosContrato.length) {
        for (const _d of doctrinaDeDominios(_dom, figsTotales, { playbookActivo: playbookActivo ? playbookActivo.nombre : null, encargo: _partesEncargo.length >= 2 })) {
          if (_d) mensajes.push({ role: "user", content: _d });
        }
      }
      /* LA DOCTRINA DEL ENCARGO (owner 2026-09-14): con dos o más partes pedidas, el cerebro recibe la lista completa de
       * lo pedido, la ley de cobertura («el foco ordena, no elimina»), las claves de unión válidas y el cierre integrado.
       * El contrato cobra la misma lista (`parte-del-encargo-omitida`), y el ensamblador la compone si el cerebro cae. */
      if (_partesEncargo.length >= 2) {
        const _de = (() => { try { return doctrinaDelEncargo(_partesEncargo, _dom.dominios, figsTotales, q); } catch { return ""; } })();
        if (_de) mensajes.push({ role: "user", content: _de });
      }
    }
  }

  /* ── LA LEY DEL PORQUÉ, PARA TODO CAMINO (owner 2026-09-09) ─────────────────────────────────────────────
   * «No quiero que el método del porqué dependa de venir desde un cuadro.» Va ACÁ y no en la doctrina por
   * herramienta ni en la carta, y las tres razones están medidas: la doctrina del playbook solo se empuja si
   * `promesasCumplidas` (arriba), así que el TURNO LIBRE —el que más lo necesita: «¿por qué cae mi margen?»
   * sin playbook— jamás la vería; `DOCTRINAS` exige llave = herramienta real y esta se decide por la PREGUNTA;
   * y la carta ya rompió su techo con la operativa del porqué. Un mensaje, solo en el turno que lo pide, y
   * byte-estable — el mismo principio de `doctrinaAgente.js`: la instrucción no viaja hasta que hace falta. */
  const _esPorQueDelTurno = esPorQue(q);
  if (_esPorQueDelTurno) mensajes.push({ role: "user", content: doctrinaDelPorque() });
  /* ── REFORMULAR · la misma respuesta para otro destinatario o en otro largo (owner 2026-09-10) ──────────
   * Misma mecánica que la ley del porqué y por la misma razón: no es un playbook porque no sale a leer —su
   * material es la respuesta anterior, que ya pasó el muro—, y un playbook sin pasos no se activa nunca.
   * `_previaDelHilo` es lo último que ADI respondió en este hilo: el material legítimo de este turno. */
  /* lo último que ADI respondió, leído del hilo que el bucle ya tiene: es lo que se pide reformular. Se lee
   * de `history` y no de una memoria nueva — la casa no crea una segunda fuente para lo que ya viaja. */
  /* …y es la última SUSTANTIVA (batería en vivo de la Etapa 4): tres reformulaciones seguidas se apoyaban cada
   * una en la anterior y el material se degradaba en cadena. `previaSustantiva` salta las reformulaciones. */
  const _previaDelHilo = previaSustantiva(history);
  const _esReformularDelTurno = esReformular(q);
  if (_esReformularDelTurno) mensajes.push({ role: "user", content: doctrinaDeReformular() });
  /* EL MOLDE DEL LECTOR viaja solo cuando la pregunta nombra una audiencia (Etapa 3, owner 2026-09-11) — en un
   * turno de reformular o en uno nuevo («dame los riesgos para el directorio»). La carta lo remite acá porque
   * cuatro moldes en cada turno rompían el techo del 20% del system; acá cuesta solo cuando sirve. */
  const _destinatarioDelTurno = (() => { try { return destinatarioDe(q); } catch { return null; } })();
  const _doctrinaAud = _destinatarioDelTurno ? doctrinaDeAudiencia(_destinatarioDelTurno) : null;
  if (_doctrinaAud) mensajes.push({ role: "user", content: _doctrinaAud });
  /* EL ENCARGO COMPUESTO SIN PROCEDIMIENTO (owner 2026-09-11): la forma del turno viaja con la doctrina del playbook;
   * cuando ningún procedimiento aplica —«mira el negocio completo como si fueras mi asesor…»— el cerebro trabaja solo
   * con las herramientas y necesita igual la consigna: una sola lectura, en orden, y el lector al final. */
  if (!playbookActivo && esEncargoCompuesto(q)) mensajes.push({ role: "user", content: formaDelTurno(q) });

  /* EL MOTIVO DE CORTE DEL PROVEEDOR, por llamada (tanda post-poda, 2026-09-05): el gateway ya lo re-emite y
   * el cliente lo lee — acá se junta en el expediente. La lección del natural, completa de punta a punta:
   * un turno vacío que solo dice «vacio» es indiagnosticable. Observación pura: no decide nada. */
  const cortesDelTurno = [];
  const _llamarCerebro = async (args) => {
    const res = await callAgente({ ...args, figs: [...figsTotales, ..._figsDeRecita] });   // la boleta del turno y la re-cita: la misma evidencia con la que se juzga
    if (res && typeof res === "object" && "stop" in res) cortesDelTurno.push(String(res.stop || "(no declarado)"));
    return res;
  };
  while (rondas < TOPE_RONDAS && texto === null) {
    rondas++;
    const res = await _llamarCerebro({ mensajes: [...mensajes], mapa, herramientas, ronda: rondas, attempt: 0, figsEnBoleta: figsTotales.length });
    if (res && res.tipo === "texto" && typeof res.texto === "string" && res.texto.trim()) {
      if (calls === 0 && !nudgeUsado && !esRenarracion && _RE_DECLINA_SIN_LEER.test(res.texto) && !/no reconcilia/i.test(res.texto)) {
        nudgeUsado = true;
        mensajes.push({ role: "assistant", content: res.texto });
        mensajes.push({ role: "user", content: "[MOTOR — no es el usuario] Antes de declinar, afirmar un límite del dato o pedir permiso para una lectura: VERIFICA — pide ahora la(s) herramienta(s) que respalden tu respuesta y las ejecuto. Las lecturas internas no piden permiso: se ejecutan y se sirve el resultado. Solo si el límite ya está declarado en el mapa del dato, responde directo citándolo." });
        continue;   // la ronda cuenta contra el tope
      }
      texto = res.texto; break;
    }

    const pedidos = (res && res.tipo === "herramientas" && Array.isArray(res.pedidos)) ? res.pedidos.filter(Boolean) : [];
    if (!pedidos.length) continue;   // ronda vacía: cuenta contra el tope, jamás un reintento infinito

    /* herramienta desconocida: UNA corrección de contrato (el cerebro corrige); a la segunda, la ronda se
     * pierde — el error igual queda registrado en la boleta por runPlan («tool desconocida»). */
    const desconocidas = pedidos.filter((p) => !caja[p.tool]).map((p) => p.tool);
    if (desconocidas.length && !correccionUsada) {
      correccionUsada = true;
      mensajes.push({ role: "assistant", content: `[pedido de herramientas] ${pedidos.map((p) => p.tool).join(", ")}` });
      mensajes.push({ role: "user", content: `[MOTOR — no es el usuario] ${desconocidas.length === 1 ? "La herramienta" : "Las herramientas"} ${desconocidas.join(", ")} no ${desconocidas.length === 1 ? "existe" : "existen"}. El catálogo es: ${herramientas.join(", ")}. Pide de nuevo solo herramientas del catálogo.` });
      continue;
    }

    if (!_rondaDeHerramientas(pedidos, mensajes)) break;
  }

  /* R1 DEL EXAMEN 1 (2026-08-31): ¿el pedido trae al menos una herramienta REAL que valga una ronda extra?
   * En el examen, cuando el cierre o la reparación pedían una herramienta válida el pedido SE DESCARTABA y el
   * turno moría (T7: el reintento pidió inventoryStatus en cierre → vacío; mismo patrón T13/T24/T26 — 11 de
   * los 14 no-verdes). La ronda extra es UNA por turno, con el mismo cupo de calls de siempre. */
  const _pedidosValidos = (res) => {
    if (rondaExtraUsada || !res || res.tipo !== "herramientas" || !Array.isArray(res.pedidos)) return null;
    const pedidos = res.pedidos.filter(Boolean);
    return pedidos.some((p) => caja[p.tool]) ? pedidos : null;
  };

  // ── el cierre forzado: agotó las rondas sin responder ──
  if (texto === null) {
    const pedirCierre = () => _llamarCerebro({ mensajes: [...mensajes, { role: "user", content: "[MOTOR — no es el usuario] Se acabaron las rondas de herramientas. Responde AHORA al usuario con lo que tienes; si no alcanza, declina en una línea diciendo qué falta." }], mapa, herramientas, ronda: TOPE_RONDAS + 1, attempt: 0, cierre: true, figsEnBoleta: figsTotales.length });
    let res = await pedirCierre();
    const extra = _pedidosValidos(res);
    if (extra && _rondaDeHerramientas(extra, mensajes)) {   // R1: el cierre pidió una herramienta válida — se ejecuta y se le vuelve a pedir el cierre
      rondaExtraUsada = true;
      res = await pedirCierre();
    }
    if (res && res.tipo === "texto" && typeof res.texto === "string" && res.texto.trim()) texto = res.texto;
  }

  // ── el muro · el MISMO juez, con la boleta acumulada ──
  const supuestosDelHilo = [];
  for (const h of Array.isArray(history) ? history : []) {
    if (!h || h.role !== "user" || typeof h.text !== "string") continue;
    for (const pf of parseFigures(h.text)) supuestosDelHilo.push(pf.text);
  }
  for (const pf of parseFigures(q)) supuestosDelHilo.push(pf.text);
  for (const f of figsTotales) if (f.source === "user_supuesto" && (f.text || f.value)) supuestosDelHilo.push(String(f.text || f.value));

  const duenosTenant = _ejes(["cliente", "sku", "marca", "familia", "bodega", "canal"]);
  /* EL ALCANCE HEREDADO, re-cableado (tanda post-poda, 2026-09-05): la poda se llevó el gate del natural y
   * nadie notó que el BUCLE nunca lo pasó a guardC — «esos clientes» + uno agregado en silencio SALÍA. El
   * armado es el del natural, de las mismas fuentes: la respuesta anterior es recentNarrations[0] (la memoria
   * que ya existe, jamás una nueva) y el catálogo por eje sale del índice del tenant. */
  const catalogoPorEje = (() => {
    const o = {};
    for (const eje of ["cliente", "sku", "marca", "familia", "bodega", "canal"]) {
      try { const n = axisEntityNames(eje); if (n && n.length) o[eje] = n; } catch { /* sin índice */ }
    }
    return o;
  })();
  const respuestaAnterior = typeof recentPrev[0] === "string" ? recentPrev[0] : null;
  const heredado = (() => { try { return alcanceHeredadoDe({ pregunta: q, respuestaAnterior, catalogoPorEje }); } catch { return null; } })();
  /* ── EL FALSO ROJO DEL PELDAÑO DE RESPALDO (owner 2026-09-10, autorización mínima y explícita) ───────────
   * EL SÍNTOMA, medido: con la boleta vacía, `guardC` rechazaba el texto que el peldaño de respaldo replica
   * («cifra-no-autorizada: 22.560, 2026, 24.029») y el turno caía a `vacio`. El bucle documenta ese caso como
   * VERDE POR DISEÑO —«el respaldo replica un texto aprobado… con boleta vacía es VERDE por diseño, la raíz
   * de T13/T24»— y el gate del bucle lo exige en su R3. La conducta y su candado decían lo mismo; el cable
   * faltaba.
   * ⚠️ EL ARREGLO NO TOCA EL GUARDIA NI LO AFLOJA. Usa el canal que la casa ya tiene para esto,
   * `boletaAnterior` («re-citar lo que ADI misma ya mostró no es inventar», guardC §Paso 1b), y lo enciende
   * SOLO en el sitio `respaldo`. Todos los demás sitios siguen llamando exactamente igual que antes: sin
   * `boletaAnterior`, que es el default de siempre.
   * ⚠️ Y NO ES CIRCULAR. `ultimaAprobada` guarda, por contrato de `respaldoAprobado.js`, ÚNICAMENTE textos que
   * el notario aprobó —jamás un respaldo, justo para no afirmar verificación sobre lo que no se verificó—.
   * Sus cifras ya pasaron el muro contra la boleta del turno que las produjo; lo que se hace acá es cargar esa
   * verificación, no inventar una. Si el marco del peldaño agregara una cifra que NO está en ese texto, el
   * guardia la sigue cazando: se autoriza el texto aprobado, no el sitio. */
  const _boletaAprobadaPrevia = (typeof memIn.ultimaAprobada === "string" && memIn.ultimaAprobada.trim().length > 40)
    ? { figs: [{ value: memIn.ultimaAprobada }], counts: parseCounts(memIn.ultimaAprobada).map((c) => c.raw).filter(Number.isFinite) } : null;
  const _guard = (t, boletaPrevia = null) => guardC(t, {
    boletaAnterior: boletaPrevia,
    ledger: { figs: figsTotales }, results: resultsTotales, trace: null, question: q,
    supuestoPendiente: supuestosDelHilo,
    recitaAprobada: recita,   // R2: cifras aprobadas a pantalla en turnos previos — el muro las re-autoriza con su dueño
    alcanceHeredado: heredado,   // «esos clientes» hereda el conjunto del turno anterior — agregar uno en silencio es veto
    datoProyectado: cifrasDelDato(scenario),
    entidadesDelTenant: _ejes(["cliente", "sku", "marca"]),
    duenosDelTenant: duenosTenant,
    ejesDelTenant: catalogoPorEje,   // el eje de cada dueño, declarado: una bodega o un canal interpuestos no le quitan la cifra a un cliente (owner 2026-09-14)
    contentScope: "full",
    /* ── LA TABLA LA PONE SENTRIX, NO ADI (owner 2026-09-08) ─────────────────────────────────────────────
     * «La idea no es que ADI vuelva a hacer las tablas… imagina, hace dos tablas diferentes repitiendo datos.
     * Lo que el usuario quiere es entender qué ve.» En un turno nacido de un cuadro, la tabla ESTÁ AL LADO en
     * la pantalla: redibujarla es servir dos veces el mismo dato y tapar la interpretación, que es lo único
     * que ADI aporta ahí. El playbook activo lo DECLARA (`tablaProhibida`) y el muro lo hace cumplir con la
     * política que ya existía — no hace falta una regla nueva, hacía falta conectarla.
     * ⚠️ Y NO ES UNA PROHIBICIÓN GENERAL: si el usuario PIDE una tabla («hazme una tabla con la venta mes por
     * mes»), ese turno no nace de un cuadro y la política sigue en «auto». La palabra del owner es explícita:
     * «se puede dar que el usuario le pida a ADI hazme una tabla… y podría hacerlo». */
    tablePolicy: (playbookActivo && playbookActivo.tablaProhibida === true) ? "forbidden" : "auto",
  });
  /* F3 · EL CONTRATO DE SUGERENCIAS SE SUMA AL MURO, SIN TOCARLO (owner: «ese qué hacer debe ser SUGERENCIAS…
   * las decisiones son del usuario»). guardC queda INTACTO; `vetosDeContrato` es un juez NUEVO y CIEGO (regex,
   * jamás comprensión) que corre DESPUÉS: un texto con cifras perfectas que ORDENA la ejecución («procede
   * con X») recibe multa y entra al MISMO ciclo de una-reparación. También rige la escalera: un respaldo viejo
   * que ordenaba no se re-sirve. Calibrado contra el corpus de exámenes (24 aceptadas · 0 vetos). */
  /* R7 DEL EXAMEN 1 (expediente auditable): CADA veto queda registrado con su sitio y su multa — el examen 1
   * corrió con «vetos: ninguno» en los 28 veredictos mientras 14 turnos reintentaban por guard, y el post-mortem
   * quedó a ciegas justo en los turnos degradados. El registro es OBSERVACIÓN pura: no decide nada. */
  const vetosDelTurno = [];
  /* «250 d» A SECAS NO SE PUEDE REPARAR (encargo en vivo, 2026-09-14): el muro vetó «el vencido de Lider y Sodimac con más
   * de 250 días» (269d y 251d en la boleta: una cifra redondeada que no existe en el dato) y la multa llevaba solo «250 d»,
   * sin decir qué estaba mal; el modelo reparó todo lo demás y repitió la frase — y un borrador completo cayó al respaldo.
   * El veredicto no cambia y el expediente tampoco (el rastro sigue diciendo «cierre · 250 d»): cambia lo que se le
   * dice AL MODELO. Una cifra no autorizada viaja con su regla: ni inventada ni redondeada, tal cual está en la boleta
   * o fuera. */
  const _detalleDe = (x) => (x && (x.detalle || x.detail || x.reason || x));
  const _explicado = (x) => {
    const d = _detalleDe(x);
    if (x && x.kind === "cifra-no-autorizada" && typeof d === "string" && !/ — /.test(d)) {
      return `«${d}» no está en tus resultados: ni inventada ni redondeada — un redondeo o un «más de» no vale; cita cada cifra tal cual está en la boleta, con su dueño, o quita la frase.`;
    }
    return d;
  };
  const _multaDe = (v) => (v && (v.multa || (v.violations || []).map(_detalleDe).join("\n"))) || "cifras no verificables";
  const _multaParaElModelo = (v) => (v && (v.multa || (v.violations || []).map(_explicado).join("\n"))) || "cifras no verificables";
  /* LA PREVIA DEL HILO COMO BOLETA (owner 2026-09-10, su prueba de continuidad): el piso de reformular re-dice
   * un texto que ADI ya sirvió y el muro ya aprobó en su turno. Es el MISMO canal que usa el respaldo
   * (`boletaAnterior`, guardC §Paso 1b) y por la misma razón; lo que cambia es de dónde sale el texto: del
   * HILO, no de `mem.ultimaAprobada`. Esa memoria es justamente la que faltó en la 2.24 —los turnos de
   * procedimiento no la escribían— y un piso que se apoya en lo que puede faltar no es un piso. Si el marco
   * agregara una cifra que no está en ese texto, el guardia la sigue cazando: se autoriza el texto, no el sitio. */
  /* ⚠️ Y LOS CONTEOS TAMBIÉN (batería en vivo de la Etapa 4, T4): la previa decía «6 clientes» y el piso, que la
   * re-dice verbatim, murió en el muro por «conteo no autorizado» — el canal boletaAnterior tiene su mitad de
   * conteos (Paso 1b) y el piso solo le pasaba las cifras. Se autoriza lo que ADI YA mostró: figs y conteos. */
  const _boletaDelHilo = (typeof _previaDelHilo === "string" && _previaDelHilo.trim().length > 40)
    ? { figs: [{ value: _previaDelHilo }], counts: parseCounts(_previaDelHilo).map((c) => c.raw).filter(Number.isFinite) } : null;
  /* las huellas del motor de papeles (probado · indicado · abierto), una vez por turno: el juez compartido las usa
   * para cobrar «el mecanismo es costo» cuando ese mecanismo está solo indicado o abierto (owner 2026-09-11, B) */
  const _huellasDelTurno = (() => { try { const A = buildRolesCartera(scenario); return A && A.hay && Array.isArray(A.huellas) ? A.huellas : []; } catch { return []; } })();
  /* ── EL JUEZ SEMÁNTICO, POR SITIO (fase 2) ──────────────────────────────────────────────────────────────────────
   * El índice de la evidencia del turno se arma una vez (la boleta acumulada + la proyección + los ejes). En los sitios del
   * CEREBRO (cierre · reparación · poda) la declaración es la suya; en los peldaños determinísticos se DERIVA de las mismas figs
   * con las que compusieron (`declaracionDeRespaldo`) y se juzga igual. Los dos sitios que RE-CITAN un texto aprobado en un
   * turno anterior (`respaldo` · `reformular-piso`) no tienen evidencia estructurada de este turno: conservan el juicio de
   * siempre (el muro con `boletaAnterior`), porque ese texto ya pasó el Notario cuando se produjo. */
  /* …y se rearma si la boleta creció después (la reparación que pide una herramienta suma figs en la ronda extra: el re-cierre y los
   * peldaños se juzgan contra la boleta completa, no contra la de antes) */
  /* lo que el pack declara de sí mismo (`guardadoSinAnalizar`: campos guardados sin analizar, con sus filas y valores distintos) son cifras de la
   * ingesta que el límite honesto cita: entran al índice como figs del negocio */
  const _figsDelPack = (() => {
    try {
      const d = getTenantData() || {};
      return (Array.isArray(d.guardadoSinAnalizar) ? d.guardadoSinAnalizar : []).flatMap((g) => {
        const campo = String((g && g.campo) || "").trim(); if (!campo) return [];
        const out = [];
        if (Number.isFinite(+g.filas)) out.push({ label: `${campo} · filas guardadas sin analizar`, value: String(g.filas), unit: "count", raw: +g.filas, source: "pack", mandatory: false, context: "lo declara el pack: columna guardada y aún no analizada" });
        if (Number.isFinite(+g.distintos)) out.push({ label: `${campo} · valores distintos`, value: String(g.distintos), unit: "count", raw: +g.distintos, source: "pack", mandatory: false, context: "lo declara el pack: valores distintos de la columna guardada" });
        return out;
      });
    } catch { return []; }
  })();
  let _indiceCache = null, _indiceCon = -1;
  const _indiceDelTurno = () => {
    if (_indiceCache && _indiceCon === figsTotales.length) return _indiceCache;
    try { _indiceCache = indiceDeEvidencia({ figs: [...figsTotales, ..._figsDeRecita, ..._figsDelPack], datoProyectado: cifrasDelDato(scenario), ejesDelTenant: catalogoPorEje }); } catch { _indiceCache = null; }
    _indiceCon = figsTotales.length;
    return _indiceCache;
  };
  const notarioDelTurno = [];   // el expediente del Notario semántico: por sitio, medidas y vetos
  const _SITIOS_SIN_DECLARACION = new Set(["respaldo", "reformular-piso"]);
  const _juezSemantico = (t, sitio, afirmaciones, calculos = []) => {
    const _I = _indiceDelTurno();
    if (!_I || _SITIOS_SIN_DECLARACION.has(sitio)) return null;
    const derivada = afirmaciones === undefined;
    const decl = derivada ? (() => { try { return declaracionDeRespaldo(t, figsTotales, { ejesDelTenant: catalogoPorEje, datoProyectado: cifrasDelDato(scenario) }); } catch { return []; } })() : afirmaciones;
    let sem;
    try { sem = juzgarDeclaracion(t, decl, { indice: _I, nombres: duenosTenant || [], sitio, derivada, calculos }); }
    catch (e) { sem = { ok: false, violations: [{ kind: "notario-semantico-error", detail: `el juez semántico falló: ${(e && e.message) || e}`, texto: "" }], medidas: { error: true } }; }
    notarioDelTurno.push({ sitio, derivada, medidas: sem.medidas, vetos: sem.violations.map((x) => x.kind), multas: sem.violations.slice(0, 24).map((x) => String(x.detail || "").slice(0, 400)) });
    return sem;
  };
  const juzgar = (t, sitio = "cierre", afirmaciones = undefined) => {
    /* el canal de lo ya aprobado se enciende SOLO acá: en cualquier otro sitio la llamada es la de siempre */
    const v0 = _guard(t, sitio === "respaldo" ? _boletaAprobadaPrevia : sitio === "reformular-piso" ? _boletaDelHilo : null);
    const sem = _juezSemantico(t, sitio, afirmaciones, (v0 && Array.isArray(v0.calculos)) ? v0.calculos : []);   // los [[CALCULO]] que el muro autorizó en este texto son evidencia
    let v = v0;
    let _leyesDelMuro = [];   // las leyes de la casa del muro que ardieron junto al juez semántico (van al rastro con su multa)
    if (sem) {
      /* los chequeos DE HECHO del muro y del contrato ya no dictan veredicto: quedan en el expediente como detectores */
      const detectores = ((v0 && v0.violations) || []).filter((x) => CHEQUEOS_DE_HECHO.has(x.kind));
      const restantes = ((v0 && v0.violations) || []).filter((x) => !CHEQUEOS_DE_HECHO.has(x.kind));
      if (detectores.length) notarioDelTurno[notarioDelTurno.length - 1].detectores = detectores.map((x) => x.kind);
      if (restantes.length && sem.violations.length) { _leyesDelMuro = restantes; notarioDelTurno[notarioDelTurno.length - 1].leyes = restantes.map((x) => ({ regla: x.kind, multa: String(_detalleDe(x) || "").split("\n")[0].slice(0, 200) })); }
      const todas = [...sem.violations, ...restantes];
      v = todas.length ? { ...(v0 || {}), ok: false, violations: todas, multa: undefined } : { ...(v0 || {}), ok: true, violations: [] };
      if (v.ok === false && sem.violations.length) v.fragmentos = sem.violations.map((x) => x.texto).filter(Boolean);   // la poda los usa
    }
    if (!v || !v.ok) {
      /* ── LA MULTA COMPLETA (prompt de gerente, 2026-09-13) ──────────────────────────────────────────────────
       * Medido con los dos borradores capturados: el muro tumbó el cierre y la multa llevó SOLO lo del muro; el
       * modelo reparó todo lo que se le nombró (markups exactos con dueño, el subtotal, el criterio marcado) y
       * cayó en la reparación por lo que el contrato había visto desde el principio y nadie le dijo («no es un
       * problema de precio ni de mix» sin sello). Con una sola reparación por turno, la multa tiene que decirle
       * TODO de una vez: cuando el muro tumba al cerebro, se corren también los otros jueces y sus reglas van
       * en la misma multa. Solo en los sitios del cerebro (cierre · reparación): a los peldaños no se les cobra
       * lo que ellos arreglan. El veredicto del muro no cambia —sus violaciones siguen primero y son las que
       * leen la poda y la escalada—; lo del contrato viaja aparte, en `multaCompleta`, para el mensaje al
       * modelo, y en el expediente entre paréntesis. */
      if ((sitio === "cierre" || sitio === "reparacion") && v) {
        const vc = (() => { try { return _otrosJueces(t, sitio); } catch { return []; } })();
        if (vc.length) {
          v.multaCompleta = `${_multaParaElModelo(v)}\n${vc.map((x) => x.multa).join("\n")}`;
          v.reglasContrato = vc.map((x) => x.regla);
          v.leyesDelContrato = vc.map((x) => ({ regla: x.regla, multa: String(x.multa || "").split("\n")[0].slice(0, 160) }));
        }
      }
      /* las leyes de la casa que ardieron detrás del veto semántico van con su multa: el rastro tiene que decir TODO lo que rechazó */
      const _leyes = [..._leyesDelMuro.map((x) => `${x.kind}: ${String(_detalleDe(x) || "").split("\n")[0].slice(0, 160)}`), ...((v && Array.isArray(v.leyesDelContrato) && sem) ? v.leyesDelContrato.map((x) => `${x.regla}: ${x.multa}`) : [])];
      vetosDelTurno.push(`${sitio} · ${String(_multaDe(v)).split("\n")[0].slice(0, 180)}${v && v.reglasContrato && v.reglasContrato.length ? ` (+ ${v.reglasContrato.join(", ")})` : ""}${_leyes.length ? ` · leyes: ${_leyes.join(" · ")}` : ""}`);
      return v;
    }
    const vc = _otrosJueces(t, sitio);
    if (!vc.length) return v;
    /* TODAS las reglas que ardieron quedan en el expediente, no solo la primera (Etapa 3, 2026-09-11): al sumar
     * el veto de voz de motor, el borrador certificado del caso 2 ardía por ÉL primero y la resta de la notarial
     * (30,1 − 25,1 ≠ 8,6) dejaba de verse en el rastro aunque también había ardido. «Nunca evaluar una respuesta
     * sin saber qué mecanismo la produjo» vale también para saber TODO lo que la rechazó. El formato de siempre
     * se conserva —sitio · regla: multa— y las demás reglas van entre paréntesis al final. */
    const _otras = vc.slice(1).map((x) => x.regla);
    vetosDelTurno.push(`${sitio} · ${vc[0].regla}: ${vc[0].multa.split("\n")[0].slice(0, 160)}${_otras.length ? ` (+ ${_otras.join(", ")})` : ""}`);
    return { ok: false, violations: vc.map((x) => ({ rule: x.regla, detalle: x.multa })), multa: vc.map((x) => x.multa).join("\n") };
  };
  /* los jueces que se SUMAN al muro, en una sola lista (los mismos de siempre; ver las notas de cada uno abajo) */
  function _otrosJueces(t, sitio) {
    /* AL MURO SE LE SUMAN TRES JUECES, y ninguno lo toca: el contrato F3 (el cierre que ordena), el juez del
     * turno que no leyó (`cifra-sin-boleta`, ver su archivo) y —solo cuando un playbook está activo— SU lista
     * notarial, que chequea las promesas de ESE procedimiento. La lista es del playbook, no del bucle: el
     * notario crece por reglas declaradas, jamás por comprensión.
     *
     * EL DE LA BOLETA VACÍA VIVE ACÁ Y SOLO ACÁ (condición del owner y del supervisor): el camino natural
     * corre en producción con la boleta vacía SIEMPRE, así que esta regla allá no lo endurecería — lo
     * apagaría. Se le pasa `figsTotales.length`, que es la boleta REAL del turno.
     *
     * ⚠️ Y JUZGA AL CEREBRO, NO A LOS PELDAÑOS. Medido al conectarlo: aplicado a toda la función tumbaba 9
     * checks del gate del bucle, todos de la escalera. Tiene sentido — los peldaños NO inventan cifras: la
     * línea honesta sirve una que ya pasó el muro, el respaldo replica un texto aprobado y la re-cita repite
     * lo que el usuario ya vio (que con boleta vacía es VERDE por diseño, la raíz de T13/T24). El defecto que
     * este juez existe para cazar lo cometió el CEREBRO, en su cierre. Multar al rescate por una cifra que el
     * bucle ya verificó es castigar al que arregla. */
    const vSinBoleta = (sitio === "cierre" || sitio === "reparacion") ? vetoCifraSinBoleta({
      texto: t, figsEnBoleta: figsTotales.length, pregunta: q,
      recitaAprobada: recita, datoProyectado: cifrasDelDato(scenario),
    }) : null;
    /* ⚠️ Y UN CUARTO: LA LEY DEL PORQUÉ (owner 2026-09-09). Vive acá y no en un playbook porque el turno libre
     * —el que pregunta una causa sin que ningún procedimiento se active— no tiene lista notarial ninguna, y
     * era justo el camino sin ley. Se acota al cerebro con el mismo criterio que el juez de la boleta (el
     * módulo lo re-verifica por `sitio`): a los peldaños de rescate no se les cobra lo que ellos arreglan. */
    const vPorQue = vetosDelPorque(t, {
      pregunta: q, figs: figsTotales, results: resultsTotales, recita,
      /* el contexto que el negocio DECLARÓ (perfil del tenant): si el usuario ya nos contó su realidad, la
       * ley acepta que ADI la cite en vez de volver a preguntar — la condición del owner «si él ya lo
       * declaró, cítalo». Se lee del tenant, que es donde la UI lo toma para el system. */
      mem: memIn, contexto: (() => { try { const t = getTenantData(); return (t && t.perfil && t.perfil.contexto) || null; } catch { return null; } })(), sitio,
    });
    /* ⚠️ Y UN QUINTO: LA REFERENCIA DE LA CIFRA (owner 2026-09-09). «Si ADI usa una cifra para sostener una
     * recomendación, debe traer también su referencia.» Vive en el muro y no en un playbook porque la regla
     * es del producto entero: nació de una frase del piso determinístico —«su carga va 4.5%, el espacio lo
     * ves ahí»— que era correcta cifra por cifra y aun así no servía para decidir. Un 4.5% no es alto ni bajo
     * hasta que se dice contra qué; sin referencia el dueño no evalúa el consejo, solo lo cree. */
    const vRef = vetosDeReferencia(t, { figs: figsTotales, sitio });
    const vRef2 = vetosDeReformular(t, { pregunta: q, previa: _previaDelHilo, sitio });
    /* EL REFERENTE ES DEL PROCEDIMIENTO (2026-09-11): «el primero» lo resolvió el scope canónico; si el cerebro
     * narra sobre otra cuenta del mismo conjunto sin nombrar al referente, se cobra. Solo al cerebro. */
    const vRefte = (sitio === "cierre" || sitio === "reparacion") ? vetoReferente(t, referente, scopePrev.current) : null;
    /* `sitio` viaja al contrato desde la densidad ejecutiva (2026-09-11): la forma se juzga al cerebro, no a los peldaños */
    const vc = [...vetosDeContrato(t, { pregunta: q, entidades: duenosTenant || [], limiteDeHerramienta: motivosNoSoportado.length > 0, sitio, huellas: _huellasDelTurno, figs: figsTotales }),
      ...(vSinBoleta ? [vSinBoleta] : []),
      ...(vRefte ? [vRefte] : []),
      ...vPorQue,
      ...vRef,
      ...vRef2,
      ...(playbookActivo ? vetosDelPlaybook(playbookActivo, t, { figs: figsTotales, pregunta: q, ctx: ctxTurno }) : [])];
    /* con el juez semántico en el sitio, los chequeos de hecho del contrato (atribución, relación en palabras, universos, variación) son detectores */
    if (!(_indiceDelTurno() && !_SITIOS_SIN_DECLARACION.has(sitio))) return vc;
    /* las reglas DE HECHO del contrato ya no dictan veredicto (el juez semántico las reemplaza): quedan como detectores en el expediente del sitio */
    const deHecho = vc.filter((x) => CHEQUEOS_DE_HECHO.has(x.regla));
    if (deHecho.length) { const paso = [...notarioDelTurno].reverse().find((p) => p.sitio === sitio); if (paso) paso.detectores = [...(paso.detectores || []), ...deHecho.map((x) => x.regla)]; }
    return vc.filter((x) => !CHEQUEOS_DE_HECHO.has(x.regla));
  }

  let estado = "vacio";
  let aprobado = false;
  let final = null;

  /* la declaración del cerebro se separa de la prosa ANTES de lavar; los fragmentos declarados se lavan igual que la prosa */
  const _lavarDeclaracion = (afs) => (Array.isArray(afs) ? afs.map((a) => (a && typeof a === "object" && typeof a.texto === "string") ? { ...a, texto: stripLanguageLeaks(a.texto) } : a) : afs);
  const _declCierre = (typeof texto === "string" && texto.trim()) ? extraerDeclaracion(texto) : null;
  if (_declCierre) texto = _declCierre.respuesta;
  const afirmacionesCierre = _declCierre ? _lavarDeclaracion(_declCierre.afirmaciones) : null;
  if (typeof texto === "string" && texto.trim()) {
    const lavado = stripLanguageLeaks(String(texto));
    const v1 = juzgar(lavado, "cierre", afirmacionesCierre);
    if (v1 && v1.ok) { final = lavado; estado = "verde"; aprobado = true; }
    else {
      /* UNA reparación con la multa — la mecánica del ciclo notarial, con el contexto del agente.
       * ⚠️ LA MULTA SE ARMA CON `_multaDe`, LA MISMA QUE REGISTRA EL EXPEDIENTE (una sola verdad). Acá vivía
       * una segunda derivación que leía `x.detalle || x.reason` — campos que las violations de guardC NO
       * tienen (usa `detail`): cuando el veredicto no traía `.multa`, al modelo le llegaba «[object Object]»
       * y el reintento reformulaba a ciegas. Cazado al escribir el chequeo de P1b (corrida 2). */
      /* la multa COMPLETA al modelo (muro + contrato + notarial, ver `juzgar`): una sola reparación, con todo lo que
       * ardió. La escalada y la poda siguen leyendo la del muro, que es la que nombra cifras. */
      const multa = (v1 && v1.multaCompleta) || _multaParaElModelo(v1);
      /* (ii) DE P2 (owner 2026-08-31, con medición previa): R-eco corta la escalada estéril —la de la corrida
       * 2, 66% del gasto y CERO verdes—, pero le quitaba la escalada a un veto que SÍ era reparable: T10 murió
       * porque el tier barato devolvió el mismo texto ante «1%». La condición vuelve a la regla que R-eco
       * escribió («escalar solo cuando el veto sea reparable por modelo mejor, no por plomería»): si la multa
       * NOMBRA una cifra concreta, corregir es reescribir una oración, y eso lo hace un modelo mejor. Medido
       * sobre la corrida 4: son 2 escaladas nuevas en 28 turnos (T10 y T18), no una puerta abierta. */
      const vetoConCifra = _cifrasDeMulta(_multaDe(v1)).length > 0;
      const hiloReparacion = [...mensajes, { role: "assistant", content: esNarracionVacia(lavado) ? "(respuesta vacía)" : lavado }, { role: "user", content: _MENSAJE_NOTARIO(multa) }];
      let res2 = await _llamarCerebro({
        mensajes: [...hiloReparacion],
        mapa, herramientas, ronda: rondas, attempt: 1, motivoReintento: "guard", figsEnBoleta: figsTotales.length, vetoConCifra,
      });
      /* R1: la reparación pidió una herramienta VÁLIDA (T7: pidió inventoryStatus y el pedido se tiraba →
       * turno vacío). Se ejecuta la ronda extra SOBRE EL HILO DE LA REPARACIÓN (la multa sigue a la vista) y
       * se le pide reescribir con las cifras ya verificadas — recién ahí hay material para pasar el muro. */
      const extra2 = _pedidosValidos(res2);
      if (extra2 && _rondaDeHerramientas(extra2, hiloReparacion)) {
        rondaExtraUsada = true;
        res2 = await _llamarCerebro({
          mensajes: [...hiloReparacion, { role: "user", content: "[MOTOR — no es el usuario] Las herramientas que pediste ya corrieron: sus cifras están arriba. Reescribe AHORA tu respuesta completa con esas cifras verificadas, corrigiendo lo que observó la verificación." }],
          mapa, herramientas, ronda: rondas, attempt: 1, motivoReintento: "guard", figsEnBoleta: figsTotales.length, vetoConCifra,
        });
      }
      const _declRep = res2 && res2.tipo === "texto" ? extraerDeclaracion(String(res2.texto || "")) : null;
      const t2 = _declRep ? stripLanguageLeaks(_declRep.respuesta) : "";
      const afirmacionesRep = _declRep ? _lavarDeclaracion(_declRep.afirmaciones) : null;
      const v2 = t2.trim() ? juzgar(t2, "reparacion", afirmacionesRep) : null;
      if (v2 && v2.ok) { final = t2; estado = "reparado"; aprobado = true; }
      /* ── LA PODA · TIRAR LA ORACIÓN, NO EL TURNO (certificación 2026-09-01) ────────────────────────────────
       * EL DEFECTO MEDIDO, T2: el turno tenía la respuesta pedida, completa y correcta —«tu venta del período
       * es $100.0M; con +3.0% a 12 meses la proyección te deja en $103.0M, $3.0M adicionales»— y el usuario
       * recibió «No pude completar la lectura». Lo que lo mató fue UNA ORACIÓN DE COLOR que sobraba: «los
       * $3.0M extra no te recuperan los $4.9M… en Falabella, Lider y Jumbo», con una cifra traída de memoria
       * cuyo dueño real es otro. La reparación la reformuló («que vimos en» → «concentrada en») sin mover la
       * atribución, y el turno entero se descartó por una frase accesoria. Era todo-o-nada.
       *
       * SE INTENTA SOLO CUANDO LA REPARACIÓN YA FALLÓ: no es un atajo del muro, es lo último antes de tirar
       * una respuesta que existe. Y el texto podado VUELVE A PASAR EL MURO COMPLETO — no se sirve por confiar
       * en el corte. */
      if (!aprobado && t2.trim() && v2 && !v2.ok) {
        const podado = _podarOracionVetada(t2, _multaDe(v2), figsTotales, v2.fragmentos || []);
        if (podado) {
          /* la declaración de lo podado: solo las afirmaciones cuyo fragmento sigue en el texto */
          const _norm = (x) => String(x || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, " ");
          const afirmacionesPoda = Array.isArray(afirmacionesRep) ? afirmacionesRep.filter((a) => a && typeof a.texto === "string" && _norm(podado).includes(_norm(a.texto))) : afirmacionesRep;
          const v3 = juzgar(podado, "poda", afirmacionesPoda);
          if (v3 && v3.ok) { final = podado; estado = "podado"; aprobado = true; }
        }
      }
    }
  }

  /* [10] DEL EXAMEN 1 (2026-08-31): EL CONTEO HONESTO. T8 — el modelo papagayeó la plantilla de rescate tras 7
   * fallbacks seguidos en su historial y el turno se contó VERDE (el MISMO texto que en T6 fue «limite»: infló
   * la tasa del criterio A). El muro hizo bien en no vetarlo — la cifra era verdadera y con dueño (quinta
   * fuente; el refutado T-transversal-5 lo probó reproduciendo guardC) — lo deshonesto era la ETIQUETA. Un
   * texto aprobado que ES la plantilla de rescate se cuenta como lo que es: un rescate. Tampoco se vuelve
   * `ultimaAprobada` (no es una respuesta de verdad que el respaldo pueda re-ofrecer). */
  if (aprobado && typeof final === "string" && /^No pude (?:completar|armar) la lectura/.test(final.trim())) {
    estado = "limite";
  }

  // ── la escalera INVERTIDA ──
  let suplente = false;
  if (estado === "limite" && final !== null) suplente = true;   // [10] · el eco de plantilla es un rescate también para la memoria
  /* PELDAÑO 0 · EL ENTREGABLE DEL PLAYBOOK. Va ARRIBA de la línea honesta a propósito: cuando el procedimiento
   * ya trajo la evidencia, «no pude completar la lectura» es FALSO — la lectura está hecha. Este peldaño
   * responde la pregunta con las cifras que los pasos verificaron, y se juzga como cualquier otro (guardC + el
   * contrato + la propia lista del playbook): si no pasara, cede al siguiente sin ruido. */
  /* PELDAÑO 0 · EL ENSAMBLADOR DEL ENCARGO COMPUESTO (owner 2026-09-11). Va ARRIBA del entregable simple: cuando el
   * usuario pidió varias cosas y las partes tienen evidencia, responder una sola es dejar caer partes explícitamente
   * pedidas. Cada parte se compone con SU boleta (los resultados de sus propios pasos, ya ejecutados en este
   * turno; `leer` los re-deriva de las mismas herramientas, sin cerebro y sin red), se juzga como cualquier peldaño
   * y, si no pasa, cede al piso simple de siempre. */
  if (final === null && playbookActivo && _partesEncargo.length >= 2) {
    const _semillaEc = `${(() => { try { return getTenantId() || "demo"; } catch { return "demo"; } })()}::${q}::${Array.isArray(history) ? history.length : 0}`;
    const _leer = (pasos) => { try { return (runPlan({ intent: "answer", calls: (pasos || []).map((s) => ({ tool: s.tool, args: s.args || {} })) }, { scenario, maxCalls: CALLS_POR_RONDA, preguntaUsuario: q, registry: caja }).ledger || {}).figs || []; } catch { return []; } };
    const _Dec = crearDeclarador();
    const _ec = (() => { try { return componerEncargo({ partes: _partesEncargo, leer: _leer, scenario, mem: memIn, semilla: _semillaEc, pregunta: q, declarar: _Dec }); } catch { return null; } })();
    if (_ec && _ec.trim()) {
      const _declEc = filtrarPorTexto(_Dec.lista(), _ec);
      const vEc = juzgar(_ec, "encargo-compuesto", _declEc.length ? _declEc : undefined);
      if (vEc && vEc.ok) { final = _ec; estado = "encargo-compuesto"; suplente = true; }
    }
  }
  if (final === null && playbookActivo && typeof playbookActivo.componer === "function") {
    /* LA SEMILLA DE VARIACIÓN (owner 2026-09-03, «matar la repetición»): tenant + pregunta + largo del hilo —
     * todo del turno mismo, cero estado nuevo. Determinística (los gates replican byte a byte) y distinta
     * entre turnos (el hilo crece), así el mismo cierre no sale tres veces seguidas. Los composers sin
     * semilla devuelven su primera opción: nada cambia para quien no la pasa. */
    const _semilla = `${(() => { try { return getTenantId() || "demo"; } catch { return "demo"; } })()}::${q}::${Array.isArray(history) ? history.length : 0}`;
    /* `scenario` viaja desde 2026-09-04: el composer del porqué necesita LEER el motor de papeles (qué rol
     * tiene cada cliente, qué huella está sellada) — leer el motor no es calcular, es la misma técnica que
     * `pisoFocosUSD()` en los playbooks de asesoría. Las CIFRAS siguen saliendo verbatim de la boleta. */
    const _Dpb = crearDeclarador();
    const _pb = (() => { try { return playbookActivo.componer({ figs: figsTotales, pregunta: q, semilla: _semilla, scenario, mem: memIn, ctx: ctxTurno, declarar: _Dpb }); } catch { return null; } })();
    if (_pb && _pb.trim()) {
      const _declPb = filtrarPorTexto(_Dpb.lista(), _pb);
      const vPb = juzgar(_pb, `playbook:${playbookActivo.nombre}`, _declPb.length ? _declPb : undefined);
      if (vPb && vPb.ok) { final = _pb; estado = "playbook"; suplente = true; }
    }
  }
  /* PELDAÑO 0b · REFORMULAR SIN CEREBRO. Va ARRIBA de la línea honesta por el mismo argumento que el
   * entregable del playbook: con la respuesta anterior en el hilo, «no pude completar la lectura» es FALSO —
   * la lectura está hecha y en pantalla. Medido con el hilo real del owner (2026-09-10): sin este peldaño el
   * turno terminaba `vacio` y la escalera servía el mensaje de sin-datos, que es LA MISMA FRASE que los vetos
   * de esta ruta acaban de prohibir. El candado cerraba la puerta y la salida de emergencia daba a la misma
   * habitación. Compone verbatim desde la previa (`componerReformulacion`) y se juzga como todo lo que sale;
   * si no pasara, cede al siguiente sin ruido. */
  if (final === null && _esReformularDelTurno && _previaDelHilo) {
    const _rf = (() => { try { return componerReformulacion(_previaDelHilo, { pregunta: q }); } catch { return null; } })();
    if (_rf && _rf.trim()) {
      const vRf = juzgar(_rf, "reformular-piso");
      if (vRf && vRf.ok) { final = _rf; estado = "reformular-piso"; suplente = true; }
    }
  }
  if (final === null) {
    /* `preferir` (2026-09-11): el rescate ya no sirve la fila 1 de la herramienta a ciegas — con un referente
     * resuelto prefiere SUS cifras, y con alcance de negocio entero prefiere las cifras sin dueño de cuenta.
     * Es lo que el owner vio: «¿qué explica ese resultado?» rescatado con «Falabella · Brecha 8.1 pp». */
    /* qué cifras trajo SOLO el contrato: las de las herramientas que ni el procedimiento ni el cerebro pidieron */
    const _figsDelContrato = (() => {
      try {
        const pedidas = new Set([..._pasosPb.map((p) => p.tool), ...callsDelTurno.slice(_pasosTurno.length).map((c) => c.tool)]);
        const soloContrato = new Set(_pasosContrato.map((p) => p.tool).filter((t) => !pedidas.has(t)));
        const labels = new Set();
        /* en un turno de DOS dominios las cifras del CRUCE (venta × stock · contribución × capital por SKU) son lo que
         * la pregunta pidió: no se relegan detrás del resto del contrato (owner 2026-09-14) */
        const _esCruce = _dom.dominios.length >= 2 ? (f) => /· (?:Venta|Stock|Valor de inventario)$|^Resto de /i.test(String((f && f.label) || "")) : () => false;
        for (const r of resultsTotales) if (r && soloContrato.has(r.tool)) for (const f of r.boleta || []) if (!_esCruce(f)) labels.add(String(f.label));
        return labels;
      } catch { return new Set(); }
    })();
    final = _lineaHonesta({ motivos: motivosNoSoportado, figs: figsTotales, juzgar: (t) => juzgar(t, "linea-honesta"), entidades: duenosTenant || [], falta: (() => { try { return faltanteQueToca(q); } catch { return null; } })(), preferir: preferirDelTurno,
      relegar: _figsDelContrato.size ? (f) => _figsDelContrato.has(String(f && f.label)) : null });
    if (final !== null) { estado = "limite"; suplente = true; }
  }
  if (final === null) {
    // R3: el contexto de pertinencia viaja — el peldaño no afirma «sobre esto» si la pregunta habla de otra cosa
    /* `cederSiRepetida` es del AGENTE y solo del agente (owner 2026-08-31): acá, si lo aprobado es lo que el
     * usuario acaba de ver, el peldaño cede y el turno cae al límite con alternativa. El camino natural NO lo
     * pasa y conserva su conducta de hoy — su fallback propio es un encargo futuro, no un rebote de este. */
    final = _respaldoDeLoYaAprobado(memIn, (t) => juzgar(t, "respaldo"), { pregunta: q, entidades: duenosTenant || [], recienMostrado: recentPrev[0] || null, cederSiRepetida: true });
    if (final !== null) { estado = "respaldo"; suplente = true; }
  }
  /* ÚLTIMO PELDAÑO ANTES DEL GENÉRICO · EL LÍMITE NOMBRA AL REFERENTE (owner 2026-09-11). Con un referente o un
   * alcance RESUELTOS y sin lectura que servir, «no tengo información autorizada» es falso —el dato de esa
   * cuenta está y no cambió— y además pierde el hilo: la respuesta siguiente ya no sabe de qué se hablaba.
   * Se dice la verdad útil: sobre QUIÉN no se pudo armar la lectura y por dónde se puede entrar. Sin cifras,
   * juzgado como todo lo que sale. Es la misma lección de reformular: prohibir no es responder. */
  if (final === null && preferirDelTurno && (preferirDelTurno.entidades || preferirDelTurno.alcance)) {   // solo con referente o alcance: la métrica pedida no abre este peldaño
    const ents = Array.isArray(preferirDelTurno.entidades) ? preferirDelTurno.entidades : [];
    const _yLista = (xs) => (xs.length > 1 ? `${xs.slice(0, -1).join(", ")} y ${xs[xs.length - 1]}` : String(xs[0] || ""));
    const txt = ents.length
      ? `No pude armar la lectura sobre ${_yLista(ents)} con la calidad que corresponde. ${ents.length > 1 ? "Sus datos siguen" : "Su dato sigue"} en pantalla y no ${ents.length > 1 ? "cambiaron" : "cambió"}: dime qué quieres mirar de ${ents.length > 1 ? "ellas" : "esa cuenta"} —el cuadro completo, el margen contra la referencia, la carga comercial— y lo abro.`
      : `No pude armar la lectura del negocio entero con la calidad que corresponde. La foto del negocio sigue en pie: dime por dónde quieres entrar —margen, cobranza o inventario— y la abro a ese nivel.`;
    const vL = juzgar(txt, "limite-referente");
    if (vL && vL.ok) { final = txt; estado = "limite"; suplente = true; }
  }
  if (final === null) { final = composeNoDataMessage(null); estado = "vacio"; suplente = true; }

  /* R4c DEL EXAMEN 1 (2026-08-31): el trato registrado llega TAMBIÉN en los peldaños de rescate — en T14/T15
   * «jc»/«wachin» se guardaron en el motor y jamás aparecieron en pantalla (los verdes lo traen porque el
   * cerebro lee lineaDeNombre; los rescates son deterministas y no lo leían). El prefijo se verifica igual que
   * todo lo que sale a pantalla; si no pasa, sale sin trato — jamás sin respuesta. La sonda no registra veto
   * en el expediente a propósito: es cosmética, no una reparación fallida. */
  if (suplente && typeof final === "string" && final) {
    const trato = getNombreUsuario();
    if (trato && !final.startsWith(`${trato}:`)) {
      const conTrato = `${trato}: ${final}`;
      try { const vt = _guard(conTrato); if (vt && vt.ok && !vetosDeContrato(conTrato).length) final = conTrato; } catch { /* sin trato antes que sin respuesta */ }
    }
  }

  // ── pantalla · misma limpieza y sello que el camino natural ──
  const ex = extraerCalculos(final);
  let pantalla = stripAllMarks(ex.limpio);
  if (esNarracionVacia(pantalla)) { pantalla = composeNoDataMessage(null); estado = "vacio"; suplente = true; }
  pantalla = anteponerSello(pantalla, getSelloDeCarga(), { calculos: ex.calculos });

  const memOut = { ...memIn, recentNarrations: [pantalla, ...recentPrev].slice(0, 2) };
  /* ── EL SCOPE CANÓNICO SE ESCRIBE AL CIERRE (owner 2026-09-11) ─────────────────────────────────────────────
   * Lo que este turno PRESENTÓ queda en `mem.conversationScope` con el MISMO escritor que usaba el oráculo:
   * las entidades salen de un resultado ESTRUCTURADO (jamás de la prosa), y entre varios resultados se elige
   * el que la respuesta mostró (`ordenPresentado`, leído de las filas de tabla de la pantalla aprobada). Una
   * referencia resuelta a un subconjunto se guarda como SELECCIÓN dentro del conjunto —el conjunto se
   * conserva para «el segundo», «los otros tres», «el anterior»—. Y la entidad nombrada explícitamente
   * («ahora solo Lider») cuenta como selección cuando vive dentro del conjunto vigente. */
  try {
    const seleccion = (referente && referente.kind === "resolved" && Array.isArray(referente.entities) && referente.entities.length) ? { entities: referente.entities }
      : (_nombrada && _nombrada.nombre) ? { entities: [_nombrada.nombre] } : null;
    memOut.conversationScope = updateConversationScope(scopePrev, {
      plan: planSintetico, calls: callsDelTurno, results: resultsTotales, turno: Array.isArray(history) ? history.length : null,
      requestContext, seleccion, ordenPresentado: ordenPresentadoEn(pantalla, duenosTenant || []),
    });
  } catch { /* la memoria canónica jamás rompe el turno: si no se pudo escribir, queda la anterior */ }
  /* EL CUADRO ABIERTO queda en la memoria del hilo (owner 2026-09-08): cuando el turno respondió un cuadro
   * —por click o por profundización—, el turno siguiente puede decir «profundiza en la contribución» y seguir
   * sobre ESA pieza. Se guarda la DIRECCIÓN (componentId + controles), jamás cifras; el playbook lo caduca a
   * las 8 entradas de hilo y solo lo lee ante una forma de profundización. Un turno de cuadro NUEVO lo pisa. */
  if (playbookActivo && playbookActivo.nombre === "cuadro-explicado" && estado !== "vacio") {
    try {
      const _prev = memIn.cuadroAbierto && typeof memIn.cuadroAbierto === "object" ? memIn.cuadroAbierto : null;
      const _anclaAbierta = anclaDelCuadro(ctxTurno)
        || (_prev ? { componentId: _prev.componentId, escenario: _prev.escenario, controles: _prev.controles } : null);
      if (_anclaAbierta && _anclaAbierta.componentId) {
        /* el ESCENARIO se guarda con la dirección: reabrir el cuadro en otra carpeta es reabrir OTRO cuadro
         * (medido: sin esto la reapertura caía a ESCENARIO_INICIAL y devolvía cifras de otro mundo). */
        memOut.cuadroAbierto = { componentId: _anclaAbierta.componentId,
          escenario: _anclaAbierta.escenario || scenario || null,
          controles: _anclaAbierta.controles || {}, turno: Array.isArray(history) ? history.length : 0 };
      }
    } catch { /* la memoria del cuadro jamás rompe el turno */ }
  }
  { const _trato = getNombreUsuario(); if (_trato) memOut.nombreUsuario = _trato; }   // el trato persiste por el canal de la memoria (ver arriba)
  /* ⚠️ UN ENTREGABLE DE PLAYBOOK ES UNA RESPUESTA VERIFICADA, y no guardarlo dejaba al turno siguiente sin
   * material. LO PAGÓ EL OWNER EN PRODUCCIÓN (2026-09-10): pidió «explícamelo para el equipo comercial»
   * después de una respuesta de playbook y recibió TRES VECES «no tengo información autorizada suficiente».
   * La cadena, medida: `aprobado` solo se marca en los caminos del CEREBRO (verde/reparado/podado); el
   * peldaño del playbook marca `estado="playbook"` y `suplente=true`, así que esta línea no escribía nada.
   * El turno siguiente encontraba la memoria vacía, el respaldo no tenía qué re-servir, y la escalera
   * terminaba en el genérico. Con las CINCO rutas conversacionales resueltas por playbook, eso dejaba sin
   * memoria a la conversación entera — no solo a la ruta de reformular.
   * ⚠️ Y NO AFLOJA NADA: el texto del playbook pasó SU PROPIO juicio con el mismo muro (`vPb.ok`) antes de
   * adoptarse. Es la misma equivalencia que este archivo ya aplica al diario de la tesis unas líneas más
   * abajo —`estado === "playbook" || (aprobado && !suplente)`—: se extiende el criterio que ya existía, no
   * se inventa uno. Los demás suplentes (respaldo, línea honesta, re-cita) siguen sin escribir, que es el
   * contrato de `respaldoAprobado`: un respaldo jamás se ofrece como «esto quedó verificado». */
  if ((aprobado && !suplente) || estado === "playbook") memOut.ultimaAprobada = pantalla;
  /* R2 · la otra punta del cable: lo que el muro APROBÓ presta sus cifras al turno siguiente — el MISMO
   * constructor y los MISMOS candados del camino natural (un texto vetado o un respaldo no acumulan nada). */
  /* la re-cita sigue la MISMA equivalencia: un entregable de playbook presta sus cifras al turno siguiente,
   * porque salieron verbatim de la boleta y pasaron el muro. Sin esto, la conversación quedaba sin memoria
   * de cifras justo después de las rutas que más cifras publican. */
  if (aprobado || estado === "playbook") {
    const recitaNueva = recitaAprobadaDe({ textoAprobado: pantalla, catalogoEntidades: duenosTenant || [], previa: recita });
    if (recitaNueva) memOut.recitaAprobada = recitaNueva;
  }
  /* EL DIARIO DE LA TESIS · paso 1 (owner 2026-09-04): cuando el turno del porqué SALE APROBADO con su tesis,
   * la HUELLA MEDIDA queda en la memoria del hilo — y el próximo porqué la confirma o la corrige en voz alta.
   * Solo turnos aprobados y no-suplentes escriben (la misma condición que `ultimaAprobada`: un rescate no es
   * una tesis); un turno de otro tema no la toca. El corte conservador aprobado: hilo, no servidor. */
  /* el entregable del playbook marca suplente=true para la memoria de re-cita — pero SU tesis del porqué
   * es legítima: la produjo el procedimiento con la evidencia en la mano. estado==="playbook" la habilita. */
  /*  solo lo encienden los caminos del CEREBRO (verde/reparado/podado); el peldaño del playbook
   * pasó su PROPIO juicio antes de adoptarse (vPb.ok) — estado==="playbook" ya es un turno juzgado. */
  if ((estado === "playbook" || (aprobado && !suplente)) && playbookActivo && typeof playbookActivo.diarioDeTesis === "function") {
    try {
      const _tesis = playbookActivo.diarioDeTesis(scenario);
      if (_tesis && /por\s?qu[eé]|porqu[eé]|a qu[eé] se debe|motivo|profundiz|explic/i.test(q)) {
        /* DIARIO ETAPA 2 (owner 2026-09-05): la tesis lleva FECHA y la IDENTIDAD DE LA CARGA con la que se
         * midió — la caducidad del diario persistente se decide contra estas dos (una tesis de otra carga se
         * re-mide y se dice; una de 30+ días no se afirma, se ofrece retomar). Y el guardado SE AVISA en una
         * línea, para que la memoria no sea secreta: solo cuando la tesis es nueva o su huella cambió. */
        const _previa = memIn.diarioTesis && memIn.diarioTesis.clave === _tesis.clave ? memIn.diarioTesis : null;
        const _huellaCambio = !_previa || JSON.stringify(_previa.huella) !== JSON.stringify(_tesis.huella);
        memOut.diarioTesis = { ..._tesis, fecha: new Date().toISOString().slice(0, 10), carga: (() => { try { return idDeCargaActiva(); } catch { return null; } })() };
        if (_huellaCambio) {
          memOut.diarioCambio = true;   // la marca para que el caller persista (ChatADI · op:"diario")
          /* la letra la eligió el owner (Etapa 3, 2026-09-11): «lo tendré en cuenta» suena a asesor; «me guardo esta lectura», a sistema */
          pantalla = `${pantalla}\n\n(Lo tendré en cuenta en las próximas lecturas.)`;
        }
      }
    } catch { /* el diario jamás rompe el turno */ }
  }

  return {
    r: normalizeResponse({
      text: pantalla,
      route: "agente",
      deterministic: false,
      claims: [],
      suggestions: null,
      /* LA PUERTA A LA FICHA DESDE TEXTO LIBRE (re-cableada en La Poda, 2026-09-05): `detectFichaIntent` era
       * huérfano tras el retiro — su único caller era el orquestador del natural, y el plan lo daba por
       * compartido. La conducta es la de siempre: si la pregunta pide la ficha de una entidad (typos
       * incluidos), el turno sale CON el botón que la abre; una consulta de dato sale sin él. El detector es
       * puro y va después de componer: adjunta una acción, jamás cambia el texto ni las cifras. */
      sentrixAction: (() => { try { const f = detectFichaIntent(q, { escenario: scenario }); return (f && f.sentrixAction) || null; } catch { return null; } })(),
      agente: { estado, rondas, calls, figs: figsTotales.length, motivos: motivosNoSoportado.slice(0, 3),
        contrato: _esComercial ? "comercial" : null,   // el turno partió de la realidad comercial completa (owner 2026-09-13)
        dominios: _dom.dominios.slice(),               // los dominios que la pregunta hizo participar (owner 2026-09-14); `eje` si nombró otro corte
        eje: _dom.eje || null,
        vetos: vetosDelTurno,   // R7 · el expediente auditable: cada veto con su sitio y su multa (observación, no decisión)
        /* EL REFERENTE Y EL ALCANCE, en el expediente (2026-09-11): «nunca más evaluar una respuesta sin saber
         * qué mecanismo la produjo» — acá se lee a quién resolvió el procedimiento y qué pedido corrigió. */
        referente: referente && referente.kind !== "none" ? { kind: referente.kind, entities: referente.entities || null, alcance: referente.alcance || null } : null,
        alcance: preferirDelTurno && (preferirDelTurno.entidades || preferirDelTurno.alcance) ? (preferirDelTurno.alcance || "entidades") : null,
        coerciones: motivosCoercion.slice(0, 4),
        cortes: cortesDelTurno.slice(0, 6),   // el motivo de corte del proveedor, por llamada (la lección del natural, punta a punta)
        /* EL NOTARIO SEMÁNTICO (fase 2): por sitio, cuánto se declaró, cuánto quedó sin declarar, qué se vetó y qué detectaron los
         * chequeos viejos; y el sitio que se sirvió, con sus medidas — nada se sirve sin este registro */
        notario: { modo: "semantico", pasos: notarioDelTurno, servido: (() => { const ultimo = [...notarioDelTurno].reverse().find((x) => x.sitio === (estado === "verde" ? "cierre" : estado === "reparado" ? "reparacion" : estado === "podado" ? "poda" : estado === "playbook" ? `playbook:${playbookActivo ? playbookActivo.nombre : ""}` : estado === "limite" ? "limite" : estado) || (estado === "limite" && (x.sitio === "linea-honesta" || x.sitio === "limite-referente"))); return ultimo ? { sitio: ultimo.sitio, derivada: ultimo.derivada, medidas: ultimo.medidas, vetos: ultimo.vetos } : { sitio: estado, sinJuicioSemantico: true }; })() },
        recitaCifras: recita && Array.isArray(recita.figs) ? recita.figs.length : 0,
        /* la SIEMBRA: el cuadro desde el que se preguntó queda en el expediente — hoy solo se registra, y esa
         * es toda la promesa (ver la nota de `viewContext` arriba y `_CONTRATO_ASK_DE_CUADRO.md`). */
        ...(viewContext ? { viewContext: { vista: viewContext.vista || viewContext.view || null,
          seccion: viewContext.seccion || viewContext.section || null,
          eje: viewContext.eje || viewContext.dimension || null,
          entidad: viewContext.entidad || viewContext.entity || null } } : {}) },
    }),
    mem: memOut,
  };
}
