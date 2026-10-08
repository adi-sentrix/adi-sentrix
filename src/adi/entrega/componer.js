/* === src/adi/entrega/componer.js · EL COMPOSITOR DE LA ENTREGA (plan `_ADI_LLMBUSINESS_PLAN.md`, corte vertical) ═══
 * PRIMER CORTE VERTICAL — una sola ruta, de punta a punta: «¿dónde estoy perdiendo plata?» (contribución no
 * capturada / brecha comercial contra el benchmark), el ejemplo del §7 del plan.
 *
 * CERO LLAMADAS A UN MODELO. Todo determinístico: el motor produce la boleta (marginRead + diagnose, los mismos
 * dos pasos del playbook `margen-en-riesgo`), este módulo selecciona y arma, y cada cifra que llega al texto pasó
 * antes por el libro de hechos (`notario/hechos.js`) — la MISMA verificación que el Notario v3 usa para hechos
 * declarados por un modelo, reusada acá para hechos declarados por este compositor. Nada se calcula a mano y se
 * imprime sin pasar por esa verificación: una cifra derivada (participación del primero, resto de la brecha tras
 * la carga) es un hecho `razon`/`derivada` del libro, no una cuenta hecha en este archivo.
 *
 * REUSA, no reescribe: `margenEnRiesgo.pasos` (los mismos dos pasos del playbook vivo), `lecturaDeMargen` y
 * `prioridadDe` (las mismas derivaciones que ya defienden la notarial del playbook — «una sola verdad», no una
 * copia), `buildRolesCartera` (las huellas con sello probado/indicado/abierto y la pregunta al dueño, para «Para
 * su juicio»), y toda la maquinaria de verificación de `notario/hechos.js` + `notario/evidencia.js`.
 *
 * Puro salvo por la lectura del tenant activo (vía las tools) — determinístico para un tenant+escenario+pregunta
 * dados. Sin red, sin estado global nuevo. Detrás de la bandera `ADI_ENTREGA` (APAGADA en todos los perfiles):
 * este módulo no se importa desde ningún camino de producción todavía — lo ejercita solo el gate. */
import { ESCENARIO_INICIAL } from "../../config/scenarios.js";
import { benchmarkOf, ETIQUETA_ORIGEN, umbral, procedenciaDeUmbrales, procedenciaDeUmbral, esProcedenciaDeCriterio, NOMBRE_DE_UMBRAL, valorDeUmbralEnTexto, procedenciaDeMaterialidad, procedenciaDeSupuesto, etiquetaDeProcedencia, nombreSegunOrigen } from "../../config/businessPolicy.js";
import { umbralesDeBases, umbralesDeConceptos, NOMBRE_CARGA_ALTA, referenciaDeBase, formaDeConjunto, conjuntoDeFormaEnEje } from "../notario/conjuntosDeLaCasa.js";   // R-BASE-BENCHMARK-SIN-REFERENCIA (diagnóstico v6): el valor del benchmark cuando ninguna fig de la boleta lo trae · ETIQUETA_ORIGEN: la procedencia del criterio de inventario (etapa 5, owner 2026-09-28, §7.3·30-34)
import { runPlan } from "../oracle/toolRunner.js";
import { TOOLS } from "../oracle/toolRegistry.js";
import { cajaDelAgente } from "../agente/herramientasAgente.js";
import { pasosDe } from "../agente/playbooks/registro.js";
import { margenEnRiesgo, lecturaDeMargen, prioridadDe } from "../agente/playbooks/margenEnRiesgo.js";
import { cobranza } from "../agente/playbooks/cobranza.js";
import { buildRolesCartera } from "../sentrix/rolesCartera.js";
// CORTE 3e (owner 2026-09-26) — `CONCEPT_DEFS[slug].neutra`: la redacción en tercera persona del glosario, para
// el cierre `definicion` (`_planDefinicion`, más abajo). Cruzar hacia `sentrix/` desde `entrega/` ya es un patrón
// establecido en este archivo (`rolesCartera.js`, línea de arriba) — no es una capa nueva.
import { CONCEPT_DEFS } from "../sentrix/glossary.js";
import { cifrasDelDato } from "../oracle/datoProyectado.js";
import { descomposicionDeBrecha } from "../specRetrieval.js";   // v17 (W27): el detector de «carga comercial alta», la MISMA función que la proyección y la boleta — para declarar cuántas cuentas serían con el piso que planteó la consultaimport { axisEntityNames } from "../oracle/entityIndex.js";
import { axisEntityNames } from "../oracle/entityIndex.js";
import { indiceDeEvidencia } from "../notario/evidencia.js";
import { libroDeHechos, asignarIds, renderDe, procedenciaDe, NOMBRE_DE_PROCEDENCIA, PROCEDENCIAS, validarUniverso, nombrarUniverso, dominioDeEstado, formatoDeLaCasa, formatoDeReferencia, esCifraPropia } from "../notario/hechos.js";
import { periodoDeFiguras, reconcilian, UNIVERSOS, PERIODO_TXT, historiaDeFiguras } from "../../config/contract/figureType.js";
// CORTE 3c (owner 2026-09-25, piezas 1 y 3 del encargo) — `conjuntoDeUniverso` es LA MISMA primitiva que ya
// evalúa un universo tipado (estados/filtros) para el Notario v3 (`notario/hechos.js:_conteoTipado` la llama
// igual): se reusa acá para el mismo fin, nunca un motor de estados nuevo. `estadoCanon` (estados.js) traduce el
// estado de una premisa a su canon para saber a qué dominio pertenece (pieza 3). `valorDeReferencia`
// (supervisor 2026-09-26, segunda vuelta) resuelve la cifra de una referencia (benchmark, nivel de carga, techo)
// citada por una premisa, para declararla en el Marco sin excepción al guardrail «comparables juntas».
import { conjuntoDeUniverso, valorDeReferencia, valorDeRanking } from "../notario/verificar.js";
import { estadoCanon, estadoDeclarado, formaDeEstado, estadoDeLaPremisa, umbralesDeEstados, ESTADO_DE_CONCEPTO, UMBRALES_DE_ESTADO } from "../notario/estados.js";
// R-SORT-DIRECCION-IGNORADA, defensa en profundidad (supervisor 2026-09-26) — la MISMA normalización de nombres
// que ya usa el Notario, para comparar el conjunto que `conjuntoDeUniverso` resuelve contra lo que una tool sirvió.
import { normalizar } from "../notario/afirmacion.js";
// TAREA 3 (encargo multidominio, owner 2026-09-23) — LA MISMA hoja y LA MISMA prioridad que ya certifica el
// agente en vivo: «no escribas otra prioridad, sería una segunda verdad». Nada de esto se reescribe acá.
import { partesDelEncargo, dominiosDelEncargo } from "../agente/partesDelEncargo.js";
import { pasosDeDominios } from "../agente/contratoDeDominios.js";
import { LENTES, CRITERIOS } from "../agente/prioridadIntegrada.js";
import { crearEntrega } from "./esquema.js";
import { prioridadDeParte, alOrdenServido, valoresDeProyeccion, prioridadCruzada, lideresPorDominio, prioridadPorLente, prioridadPorMedidaParcial, temasQueDecidenPorSuCuenta, temaDeLaParteQuePrioriza, conceptoDeLaMedidaParcial, modoDeLaCruzada, vaAntesQue, nombreVisibleDeLente, lenteIdDelCriterio, primeroPorMedida, marcaDePrioridad, ALCANCE_DE_PRIORIDAD, esOracionDePrioridad, primeroDeLaConclusion } from "./prioridad.js";   // FAMILIA 1 (consolidación): quién va primero y qué lente o medida se nombra, UNA pieza
// CORTE 3b (Etapa 1, owner 2026-09-25, `_ADI_LLMBUSINESS_PLAN.md` §1 + `_ADI_CONTRATO_ENCARGO_V1.md`) — la Entrega
// para CUALQUIER encargo válido: `lecturasDe` (corte 3a) decide QUÉ CORRE, este archivo decide CÓMO SE ESCRIBE.
// `metricaPorClave` es la MISMA fuente que ya usa `validar.js` para juzgar conceptos — acá se usa para el otro
// sentido: clave → `nombre` (el rótulo humano, "Venta"/"Margen"/…) que las figs YA traen ("Entidad · Venta"), la
// MISMA convención que las 4 rutas fijas ya explotan a mano (`figVenta`, `figMargen`, …) — nunca una segunda tabla.
import { lecturasDe, REGISTRO_LECTURAS, consultaDeFrenado as _consultaDeFrenado, estadosDeUniverso as _estadosDeUniverso, frenadoSinUmbral as _frenadoSinUmbral } from "../encargo/lecturasDe.js";
import { ceroPorCobertura, metricaPorClave, claveDeMetrica, claveExactaDeMetrica, dominioDeClave, unidadDeClave, conteoDeEje, conPreposicion, sintagmaDe, esCero, dichoElCero, diasEnPalabras } from "../notario/lexico.js";
import { objetivoPorMeta } from "../llm/voiceGuard.js";   // v21 (T12): el nombre del concepto que la Entrega imprime como título de su definición va en la voz de la casa («meta» → «objetivo»)
import { ausenciaPorId, textoOracionRetirada, MOTIVO_ORACION_RETIRADA, textoSinDato } from "../../config/contract/ausencias.js";   // Etapa 2 §2 (owner 2026-09-23): las ausencias del dato, declaradas UNA vez
// Etapa 2 §4 (owner 2026-09-23, plan §3 «cómo se pega al cliente») — EL PERFIL DEL CLIENTE viaja en el Marco,
// como los demás hechos: `getTenantData()` es el MISMO acceso que ya usa todo `oracle/` (datoProyectado.js,
// entityRecord.js, toolRegistry.js) para leer el tenant activo — no se abre una segunda fuente de identidad.
import { getTenantData } from "../../data/tenantStore.js";
import { construirPerfilCliente, ETIQUETA_DEL_CAMPO } from "../../config/contract/perfilCliente.js";
// Etapa 3 (owner 2026-09-23, `_ADI_BUSINESS_KNOWLEDGE_V0_PROPUESTA.md` v0.2) — el enganche real de la Referencia
// del oficio: pertinencia medida contra la tabla de señales, nunca contra prosa. `referenciaDelOficio` ENVUELVE
// a `seleccionarConocimientoDelOficio` (perfilCliente.js): con la bandera `ADI_CONOCIMIENTO` apagada (hoy, en
// todos los perfiles) delega en ella tal cual — cero diferencia de comportamiento (ver `_conocimiento_gate.mjs`).
import { referenciaDelOficioConOfertas } from "../conocimiento/seleccionar.js";
import { textoDePerfilIncompletoConCapa } from "../conocimiento/alcance.js";
import { ADI_CONOCIMIENTO } from "../../config/voiceFlags.js";
// CORTE 3d.2 (owner 2026-09-25, `_ADI_DISENO_CORTE_3D.md` §A.4) — la pertinencia de Knowledge por FORMA del
// encargo, no por prosa: `componerEntrega` (abajo) pasaba `pregunta: ""` a la capa de conocimiento, así que
// ninguna pieza podía ser PRINCIPAL en el camino general (PRI-04 en cobranza salía como oferta). Con
// `construirEncargoDeLaTabla` se arma el objeto tipado desde la `Resolucion`, nunca desde texto.
import { construirEncargoDeLaTabla } from "../conocimiento/tablaSenales.js";
// CORTE 3d.1 (owner 2026-09-25, `_ADI_DISENO_CORTE_3D.md` §A) — la iniciativa de CFO: hechos que el Core ya
// puede calcular y que ADI ofrece SIN que el encargo los haya pedido, con proporcionalidad por cierre y
// candado de que lo pedido nunca cambia. Vive en su propio archivo (catálogo + motor), nunca mezclado con el
// árbol de decisión de `_delegarRutaCanonica`/las 4 rutas fijas (que no la ejercitan — ver `_iniciativa_gate`).
import { calcularIniciativa, MARCA_INICIATIVA, INICIATIVA_VALORES } from "./iniciativa.js";
// CORTE de cierre RC-diagnóstico v2 (supervisor 2026-09-26) — EL ALCANCE EN UN SOLO PUNTO (R1/R2/RC-D/RC-F):
// `alcanceDeParte` deriva el alcance declarado de una parte (eje, entidades excluidas, top); `figsEnAlcance` lo
// aplica a las figs de esa parte ANTES de que cualquier compositor las use — ver `entrega/alcance.js`.
import { alcanceDeParte, figsEnAlcance, recortarATop } from "./alcance.js";
// CORTE 3d.3/3d.4 (owner 2026-09-25/26, `_ADI_DISENO_CORTE_3D.md` §B) — TAMAÑO GOBERNADO: la estructura de la
// Entrega sigue SIEMPRE completa (`entrega.procedencia.libro`, `entrega.universos`); lo que se gobierna por
// `encargo.profundidad` es el TEXTO servido (`respuesta`/`cifras.filas`) — `gobernarTamano` (puro, en su propio
// archivo para no mezclar la PRIORIDAD del procedimiento con el árbol de decisión de arriba) recorta por
// prioridad, nunca por aparición, y lo recortado va a `entrega.detalle` con los MISMOS ids («lo recortado no
// desaparece»). `PROFUNDIDAD_VALORES`/`CAMPOS_RAIZ` son la MISMA fuente que ya valida `encargo/validar.js` —
// nunca una segunda lista de profundidades válidas ni un segundo orden de campos del encargo.
import { gobernarTamano } from "./tamano.js";
// FAMILIA 2 (consolidación, paso 2) — «lo anunciado es lo servido» y LA REGLA DEL CERO (§7.3·52b): la fila de cada entidad servida en cada concepto pedido, su origen (medido · cobertura declarada) y lo que falta («sin dato de X para Y») se deciden en `servidas.js`; acá solo se redacta.
import { figDeLaProyeccion, filasDeEntidad, completarGrupo, declararLoQueFalta, origenDeLaFig, ORIGEN } from "./servidas.js";
// FAMILIA 3 (consolidación, paso 2) — la referencia de la consulta: qué conjuntos pone en juego, con qué conteo y qué partes cubre, al lado de la oficial.
import { referenciasDeLaConsulta, referenciasOficiales, referenciaDelMarco, procedenciaDeLosUmbrales, textoDeBenchmark, textoDeUmbralDeMaterialidad, figDelBenchmarkOficial, planPoneElBenchmark } from "./referencias.js";
// FAMILIA 4 (consolidación, paso 2) — el RÓTULO de cada cifra según su concepto (§7.3·49f · 51f · 52a · 52e): una pieza lo decide (el nombre del léxico de la clave de la cifra; las filas de señales conservan el de su señal; una fig sin clave se declara, nunca se imprime cruda); los planes y los renders le preguntan a ella.
import { rotuloDeLaCasa, rotuloDeClave, rotuloEnOracion, rotuloDeDiferencia, rotuloDeSenal, rotuloDeDiferenciaDeSenal, rotuloDeConcentracion, rotuloDeSimulacion, filaDeCifra, temaDeLaFila, unaFilaPorCifra, claveDeLaFig, conceptoDeLaFig, declaracionDeFigSinClave } from "./rotulos.js";
// FAMILIA 5 (consolidación, paso 2) — toda oración que se sirve pasó su verificador (§7.3·48d · 51c · 52e): `servirConGarantia` (abajo) corre `verificarEntrega` sobre la Entrega compuesta antes de que salga.
import { FILAS_BREVE_MAX, FILAS_COMPLETA_MAX, verificarEntrega, cifrasEnTexto, contarPalabras } from "./verificar.js";
import { PROFUNDIDAD_VALORES, CAMPOS_RAIZ, productorDe, sujetoDeTema, universoTieneRestriccionPropia } from "../encargo/esquema.js";
import { dominioPorId } from "../../config/contract/dominios.js";
import { createHash } from "node:crypto";
// CORTE 3e (owner 2026-09-26, «la Entrega no le habla a nadie», REFINADO) — la pregunta abierta con función
// sugerida REEMPLAZA «Solo usted/tú puede(s) responder…» en las siete llamadas de este archivo (las 4 rutas
// fijas + el camino general): ver `preguntaAbierta.js` para las leyes y el cruce dominio × tipo de hueco.
import { construirPreguntaAbierta } from "./preguntaAbierta.js";

export const PREGUNTA_BRECHA_COMERCIAL = "¿dónde estoy perdiendo plata?";
export const PREGUNTA_COBRANZA = "¿quién me debe más?";
export const PREGUNTA_INVENTARIO = "¿tengo demasiado inventario?";
export const PREGUNTA_MULTIDOMINIO = "Hazme una lectura ejecutiva de estos datos. ¿Qué debería preocuparme primero?";
const _EJES = ["cliente", "sku", "marca", "familia", "bodega", "canal"];

/* EL PERÍODO EN EL CORE (owner 2026-09-22, TAREA 1 del incremento 2) — investigado ANTES de escribir esto:
 *   · `figureType.UNIVERSOS[universo].periodo` es la fuente de verdad que YA declara todo el motor (guardC,
 *     toolRunner, la Mesa) — "anual" (año cerrado, los 12 meses ya ocurridos) u "hoy" (foto). Cada fig que
 *     `marginRead`/`diagnose` ya trae para esta ruta pasa por `fig()` (boleta.js) y llega TIPADA con ese campo
 *     (`tiparBoleta`, ledger.js) — no hay que inventar nada nuevo: `periodoDeFiguras(figs)` (la MISMA función
 *     que `toolRunner._stampPeriodo` usa para el camino viejo) ya resuelve la familia y el texto canónico.
 *   · Para esta ruta (marginRead + diagnose sobre venta_comercial/tasa_comercial) la familia es SIEMPRE "anual":
 *     un año cerrado, 12 meses ya ocurridos — verificable, no inventado.
 *   · Lo que el pack NO declara: un RANGO calendario. `ventasMensuales` (demo.js) trae 12 meses con nombre
 *     ("Ene".."Dic") pero SIN año, y no hay un campo equivalente a `flujoComercial.fechaCorte` (que sí existe,
 *     pero es de OTRO universo: cobranza/inventario, periodo "hoy") para el universo comercial. Declarar
 *     "enero-agosto 2026" —el ejemplo del plan §7— sería inventar una fecha que el dato no sostiene. Por eso el
 *     tipo se publica (verificable) y el rango se deja fuera, con el hueco declarado en `limites` en vez de
 *     estampado a mano. */
const _TIPO_DE_FAMILIA = { anual: "cerrado", hoy: "foto" };
function _periodoDelMarco(figs) {
  const { familias, texto } = periodoDeFiguras(figs);
  if (!texto) return { periodo: null, faltaRango: false };
  const tipo = familias.length > 1 ? "mixto" : _TIPO_DE_FAMILIA[familias[0]] || null;
  // el rango calendario solo se declara si el propio universo lo hace verificable — hoy ningún universo de esta
  // ruta lo hace (ver la nota de arriba): se deja `null` a propósito, nunca completado a mano.
  return { periodo: { tipo, texto, familias, rango: null }, faltaRango: true };
}

/* ── utilidades de boleta — el mismo patrón que YA usan los playbooks (margenEnRiesgo.js, limiteHonesto.js): cada
 * archivo trae su propia lectura mínima de figs, a propósito (no es una capa nueva que acoplar). ── */
const _lab = (f) => String((f && f.label) || "");
const _find = (figs, re) => (Array.isArray(figs) ? figs : []).find((f) => re.test(_lab(f))) || null;
const _all = (figs, re) => (Array.isArray(figs) ? figs : []).filter((f) => re.test(_lab(f)));
const _esc = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
// «Entidad · Concepto» — la convención de rótulo que ya usa todo el motor (mismo patrón que cobranza.js/rolesCartera.js)
const _entidadDe = (label) => { const p = String(label || "").split("·").map((s) => s.trim()); return p.length >= 2 ? p[0] : null; };

function _vacia(motivo) {
  return { texto: "", entrega: null, libro: null, ok: false, motivo };
}

/* ── TAREA 1 (owner 2026-09-23, Etapa 2 §1 del plan — «la procedencia sube a campo del hecho, y el texto sale de
 * ahí, no al revés») ──────────────────────────────────────────────────────────────────────────────────────────
 * Antes, la columna "Tipo" de cada fila de Cifras era un string escrito A MANO por ruta ("medido", "medido /
 * brecha estimada", "medido / vencido no calculado", "subtotal"...) — cinco redacciones sin una fuente común.
 * Ahora sale de `notario/hechos.js` (`procedenciaDe`, la MISMA verificación que ya corre por hecho): la
 * procedencia de una FILA es la peor entre los hechos que declaró (la misma regla del owner —"una derivada
 * hereda la peor procedencia de sus insumos"— aplicada a una fila con más de una cifra). `_textoDeTipo` es el
 * ÚNICO lugar de este archivo que redacta el string visible. */
function _procedenciaDeFila(libro, ids) {
  const ps = (Array.isArray(ids) ? ids : [ids]).filter(Boolean).map((id) => procedenciaDe(libro, id)).filter(Boolean);
  if (!ps.length) return null;
  return ps.reduce((peor, p) => (PROCEDENCIAS.indexOf(p) > PROCEDENCIAS.indexOf(peor) ? p : peor));
}
function _textoDeTipo(procedencia, { subtotal = false, extra = null } = {}) {
  const base = procedencia ? NOMBRE_DE_PROCEDENCIA[procedencia] : "sin procedencia declarada";
  return [base, subtotal ? "subtotal" : null, extra].filter(Boolean).join(" · ");
}

/* TAREA 2 (owner 2026-09-23, Etapa 2 §2 del plan — «las ausencias como hechos, no como silencios»): el límite
 * «Sin conocimiento del sector cargado todavía» vivía escrito a mano, con variaciones, en las CUATRO rutas de
 * este archivo. Ahora sale del catálogo declarado (`config/contract/ausencias.js`) — una ausencia, un id, usada
 * donde corresponde. El texto que cada ruta sirve NO cambió (medido: mismo título, mismo motivo por dominio). */
/* `_ausencia: true` (corte 3b, corrección del supervisor 2026-09-25): marca el límite como la frase FIJA de una
 * ausencia declarada (p. ej. «sin Business Knowledge del sector: compara solo contra el benchmark que usted
 * declaró»), que puede nombrar «benchmark»/«brecha» para decir que NO hay uno del sector — no para afirmar una
 * brecha propia. `verificarEntrega` (regla 4, comparables-juntas) la excluye de su escaneo por esta marca, nunca
 * por texto adivinado. Campo aditivo: `_textoDeLaEntrega` solo lee `titulo`/`motivo`, así que esto NO cambia el
 * texto impreso — las 4 rutas fijas siguen byte a byte iguales. */
const _limiteDeAusencia = (id) => { const a = ausenciaPorId(id); return a && a.entrega ? { titulo: a.entrega.titulo, motivo: a.entrega.motivo, _ausencia: true } : null; };

/* TAREA 4 (owner 2026-09-23, Etapa 2 §4 del plan — «cómo se pega al cliente»): la IDENTIDAD del tenant activo
 * (nombre + perfil) para el Marco. Una sola lectura por Entrega, reusada por las cuatro rutas — el mismo patrón
 * que `_correrPlaybook`/`_indiceDelTenant` ya establecen en este archivo (TAREA 3, línea ~152): lo genérico
 * entre rutas se extrae UNA vez, no se copia. `getTenantData()` puede dar `{}` si nada se cargó (tenantEmpty.js)
 * — `construirPerfilCliente` ya sabe declarar ausente cada campo sobre un tenant vacío, no se protege acá. */
function _identidadDelTenant() {
  const t = getTenantData() || {};
  return { empresaNombre: t.nombre || null, perfil: construirPerfilCliente(t) };
}

/* Etapa 3 (owner 2026-09-24, pertinencia por encargo) — el SUJETO DEL USUARIO: las cuentas que la PREGUNTA misma
 * nombra, con la MISMA comparación que ya usa `contratoComercial.js:esTemaComercial` (índice de entidades del
 * tenant, `axisEntityNames("cliente")` — nunca una lista de palabras). Se pasa a `referenciaDelOficioConOfertas`
 * ADEMÁS de `entidadesEnRespuesta` (lo que el PROCEDIMIENTO nombra): la capa de conocimiento necesita distinguir
 * las dos fuentes para decidir bloque principal (sujeto = usuario + procedimiento) vs. mención (solo usuario) —
 * ver `conocimiento/seleccionar.js`. */
const _normEnt = (t) => String(t || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
function _entidadesDeLaPregunta(pregunta) {
  const q = _normEnt(pregunta);
  if (!q.trim()) return [];
  try { return (axisEntityNames("cliente") || []).filter((e) => e && String(e).length >= 3 && q.includes(_normEnt(e))); } catch { return []; }
}
/* las ofertas (documento §5, exactamente una por pieza no principal) tal como las arma `conocimiento/servir.js`
 * — su `.texto` YA es una frase completa con la cifra-gancho verificada; acá solo se extrae ese texto para
 * sumarlo al menú `queMasPuedoCalcular.puedo` (array de strings, ver `_textoDeLaEntrega`). Con la capa apagada o
 * sin ofertas este turno, `ofertas` es `[]` y el menú queda BYTE-IDÉNTICO al de antes de esta Etapa. */
function _ofertasTexto(ofertas) {
  return (Array.isArray(ofertas) ? ofertas : []).map((o) => o && o.texto).filter(Boolean);
}

/* El límite «perfil incompleto» (plan §3, «falla cerrado»): SOLO se declara si falta algo — un perfil completo
 * no necesita un hallazgo que lo diga. El título sale del catálogo de ausencias (una sola redacción); el motivo
 * es dinámico porque los campos que faltan cambian por tenant (mismo patrón que `faltaRango` en `_periodoDelMarco`). */
function _limitePerfilIncompleto(perfil, { capaActiva = false } = {}) {
  if (!perfil || perfil.completo) return null;
  const a = ausenciaPorId("perfil_cliente_incompleto");
  const titulo = (a && a.entrega && a.entrega.titulo) || "Sin perfil completo del cliente todavía";
  // capa de conocimiento ACTIVA (bloque 6, owner 2026-10-04): el texto de la ley vieja («ADI no aplica conocimiento del oficio a esta empresa») ya no es verdad — dice la regla nueva (`alcance.js`)
  if (capaActiva) return { titulo, motivo: textoDePerfilIncompletoConCapa(perfil.faltantes) };
  const campos = perfil.faltantes.map((c) => ETIQUETA_DEL_CAMPO[c] || c).join(", ");
  return { titulo, motivo: `Falta declarar o no se pudo derivar: ${campos}. Sin el perfil completo, ADI no aplica conocimiento del oficio a esta empresa aunque el catálogo lo tuviera — para no comparar contra un sector equivocado.` };
}

/* ═══ COHERENCIA CON LA CAPA DE CONOCIMIENTO (Etapa 2, bloque 6 · owner 2026-10-04, opción A, frontera estricta) ═══════════════════════════════════════════════════════════════
 * «No reabrir la Entrega de Etapa 1 ni tocar su comportamiento cuando la capa está apagada; solo dejar coherente el texto cuando la capa de conocimiento esté activa.» Con la capa APAGADA esta función
 * no hace NADA (ni un byte, ni un campo). Con la capa ACTIVA, dos frases de la ley vieja dejan de ser verdad y se corrigen:
 *   · «Sin perfil completo del cliente todavía» afirmaba que sin el perfil completo «ADI no aplica conocimiento del oficio»: ahora dice la regla nueva (solo queda sin aplicar lo que depende de lo que falta;
 *     `alcance.js:textoDePerfilIncompletoConCapa`, y cada referencia sin su contexto lo declara por campo en «Referencia del oficio», desde los datos de la pieza y del campo);
 *   · «Sin conocimiento del sector cargado todavía» afirmaba que el Business Knowledge no está construido: si la sección «Referencia del oficio» trae contenido (una referencia servida, el recuento de lo
 *     revisado o el límite de una referencia sin su contexto), la frase es falsa y se retira. Si la sección queda vacía (nada del conocimiento corresponde a lo consultado) la frase se conserva: sigue siendo verdad. */
const _capaActiva = (conocimientoActivo) => (conocimientoActivo === undefined || conocimientoActivo === null ? ADI_CONOCIMIENTO : Boolean(conocimientoActivo));
function _coherenciaConLaCapa(entrega, { conocimientoActivo, perfil }) {
  if (!_capaActiva(conocimientoActivo)) return;
  const titulosSinSector = new Set(["conocimiento_sector_comercial", "conocimiento_sector_cobranza", "conocimiento_sector_inventario", "conocimiento_sector_general"].map((id) => { const a = ausenciaPorId(id); return a && a.entrega ? a.entrega.titulo : null; }).filter(Boolean));
  const tituloPerfil = (ausenciaPorId("perfil_cliente_incompleto") || { entrega: {} }).entrega.titulo || "Sin perfil completo del cliente todavía";
  const conContenido = Array.isArray(entrega.referenciaDelOficio) && entrega.referenciaDelOficio.length > 0;
  const nuevoPerfil = _limitePerfilIncompleto(perfil, { capaActiva: true });
  entrega.limites = entrega.limites
    .filter((l) => !(conContenido && l && l._ausencia === true && titulosSinSector.has(l.titulo)))
    .map((l) => (nuevoPerfil && l && l.titulo === tituloPerfil && !l._ausencia ? nuevoPerfil : l));
}

/* TAREA 3 (owner 2026-09-23, Etapa 2 §3 del plan — «el universo como objeto»): "los 2 de mayor brecha", "los
 * mayores deudores", "los SKU con más capital frenado" dejan de ser listas parecidas sin identidad y pasan a ser
 * OBJETOS con eje, entidades, filtros y período — el mismo vocabulario de "universo tipado" que
 * `notario/hechos.js` ya valida (`validarUniverso`) y nombra (`nombrarUniverso`) para los hechos `orden`/`grupo`/
 * `conteo`. `validarUniverso` es best-effort: la Entrega NO se cae porque el universo no valide contra el índice
 * del turno (ej. un `top.metrica` que el índice no puede casar sin figs de ESE eje) — se declara igual, con el
 * error a la vista, nunca en silencio (CLAUDE.md §5: «declara, no esconde»). Es el CIMIENTO para que una
 * pregunta de seguimiento («de esos, ¿cuál priorizo?») se resuelva sobre el universo correcto — la conversación
 * en sí queda para más adelante (Etapa 6 del plan), acá solo se declara la identidad. */
function _declararUniverso(entrega, I, { id, eje, top = null, base = null, filtros = null, excluir = null, periodo = null, entidades = [], criterio = null, estados = null, no_estados = null, soloRanking = false, bodega = null, union = null }) {
  const u = { eje };
  if (bodega) u.bodega = bodega;
  if (Array.isArray(union) && union.length) u.union = union;
  if (top) u.top = top;
  if (base) u.base = base;
  if (filtros) u.filtros = filtros;
  if (excluir) u.excluir = excluir;
  // CORTE 3c · pieza 1 (owner 2026-09-25) — `estados`/`no_estados` (universo por estado: «en mora», «frenados»…)
  // eran los dos únicos campos del universo tipado que este declarador no sabía pasar (aditivo, sin tocar el
  // resto de la firma: todo llamador existente sigue igual, ninguno pasaba estos campos antes de este corte).
  if (estados) u.estados = estados;
  if (no_estados) u.no_estados = no_estados;
  let errorValidacion = null;
  // `top` es OPCIONAL a propósito: la prioridad integrada (multidominio) no reduce a una sola métrica declarada
  // —es materialidad+severidad+urgencia, señal por señal (prioridadIntegrada.js)— y forzar un `top.metrica` que
  // no es el criterio real sería declarar un universo falso. Sin `top`/`base`/`filtros`/`excluir`, `validarUniverso`
  // no tiene nada que objetar (el eje entero) y `criterio` lleva la descripción en texto libre.
  try { errorValidacion = validarUniverso(u, I); } catch (e) { errorValidacion = `error-de-validacion: ${e && e.message ? e.message : e}`; }
  let texto = "";
  try { texto = criterio || nombrarUniverso(u, I); } catch { texto = criterio || ""; }
  // CANDADO DE ALCANCE (diagnóstico v2, supervisor 2026-09-26, punto 2) — `soloRanking:true` marca un universo
  // declarado SOLO para el DENOMINADOR del puesto de una conclusión ("5° de 13 clientes"), nunca para autorizar
  // cifra propia: `verificarEntrega` lo excluye de la unión de entidades autorizadas (si no, el ranking completo
  // de la cartera —13 nombres— autorizaría a CUALQUIERA de ellos a aparecer con cifra propia en cualquier parte
  // de la Entrega, aunque el encargo solo haya pedido una).
  entrega.universos.push({ id, eje, base: base || null, top: top || null, filtros: filtros || null, excluir: excluir || null, estados: estados || null, no_estados: no_estados || null, periodo, entidades, criterio, texto, valido: !errorValidacion, errorValidacion, soloRanking });
}

/* ── el libro de hechos de este turno: declara SOLO `ref` (cita literal de una fig), `razon` y `derivada`
 * (las tentaciones precalculadas, mecanismo 6 del plan) — los tres tipos que `notario/hechos.js` verifica sin
 * necesitar un universo tipado complejo. Cada `ref` es la MISMA fig que el playbook ya prueba en producción. ── */
function _declararRef(hechos, contador, fig) {
  /* FAMILIA 2 (§7.3·44a · «cada servido tiene fila» · §7.3·52b): la cifra de una entidad servida que la boleta no publica —la fila de la proyección (medido) o el cero de COBERTURA DECLARADA de su fuente— no tiene fig en la boleta; se declara como una `cifra` tipada que el MISMO libro verifica contra la evidencia: nunca un número que el libro no compruebe. Su ORIGEN viaja a la fila de la tabla (`contador.origenes`) */
  if (fig && fig._deLaProyeccion === true) { const id = `e${++contador.n}`; hechos.push({ id, tipo: "cifra", sujeto: fig._sujeto, metrica: fig._clave, valor: fig.value }); (contador.origenes || (contador.origenes = new Map())).set(id, { origen: fig.origen, porQue: fig.porQue || null, clave: fig._clave }); return id; }
  if (!fig || fig.id == null) return null;
  const id = `e${++contador.n}`;
  hechos.push({ id, tipo: "ref", de: fig.id });
  return id;
}

/* ── LAS TRES PREGUNTAS ABIERTAS QUE REPITEN LAS 4 RUTAS FIJAS + EL CAMINO GENERAL (corte 3e, owner 2026-09-26)
 * ────────────────────────────────────────────────────────────────────────────────────────────────────────────
 * Antes: «Solo usted/tú puede(s) responder: …» — segunda persona, y una función nunca sugerida. Ahora, las TRES
 * preguntas de siempre (comercial: la intención detrás del volumen a ese margen; inventario: la causa de que un
 * SKU esté frenado; cobranza: el plazo pactado detrás de una deuda) se escriben UNA vez acá y las llaman las
 * cuatro rutas fijas y el camino general — nunca se redactan de nuevo por sitio (sería la segunda verdad que
 * este archivo mismo advierte que no se permite, línea ~10).
 *
 * `roles.preguntaAlDueno.texto` (`sentrix/rolesCartera.js`) NO se reusa tal cual: esa prosa está en segunda
 * persona («…es una apuesta tuya…», «…sin que lo decidieras») porque `rolesCartera.js` es de OTRO carril (la
 * cara Comercial de Sentrix, fuera del alcance de este corte — el encargo lista `src/adi/entrega/` como lo único
 * que este corte toca). En vez de parchear texto ajeno con cirugía de regex, se compone una pregunta NUEVA, en
 * tercera persona, con las mismas entidades (`roles.preguntaAlDueno.entidades`) y el mismo fundamento
 * (`.porque`: «el dato no mide intención») — la regla de composición vive en `entrega/`, que es de este corte. */
// CORTE 3e (owner 2026-09-26, ronda de cierre) — texto BREVE a propósito, ver la nota gemela en
// `preguntaAbierta.js:_DONDE_POR_TIPO`: la ruta multidominio sirve hasta tres de estos bloques, y las 4 rutas
// fijas no gobiernan tamaño — cada palabra de más se paga tres veces contra el tope de 900.
function _preguntaAbiertaComercial(roles, perfil) {
  if (!roles || !roles.hay || !roles.preguntaAlDueno) return null;
  const ents = roles.preguntaAlDueno.entidades || [];
  if (!ents.length) return null;
  const sujeto = ents.length > 1 ? `${ents[0]} y ${ents[1]}` : ents[0];
  return construirPreguntaAbierta({
    pregunta: `¿El volumen de ${sujeto} fue deliberado?`,
    sobre: { entidad: sujeto, metrica: "margen y volumen" },
    porQueNoEstaEnLosDatos: "El dato no mide intención.",
    dominio: "comercial", tipoDeHueco: "causa_no_medida",
    queCambia: "Si fue deliberado, sostenerlo; si no, revisar la cuenta.",
    perfil,
  });
}
function _preguntaAbiertaInventario(entidad, perfil) {
  if (!entidad) return null;
  // RENOMBRE (owner 2026-09-28, §7.3·30-34, etapa 5, migración de significado de «frenado»): la pregunta habla
  // de un SKU inmovilizado (crítico o sobrestock) — «frenado» queda para venta interrumpida, que esta pregunta
  // no afirma. `metrica` sigue siendo «capital frenado» (el clave de la MÉTRICA en dinero, sin cambio).
  return construirPreguntaAbierta({
    pregunta: `¿Qué explica que ${entidad} esté inmovilizado — sobrecompra, temporada, cliente que no retiró, o proveedor tardío?`,
    sobre: { entidad, metrica: "capital frenado" },
    porQueNoEstaEnLosDatos: "El dato no mide causa.",
    dominio: "inventario", tipoDeHueco: "causa_no_medida",
    queCambia: "Según la causa: liquidar, reprogramar la compra o reclamar al proveedor.",
    perfil,
  });
}
function _preguntaAbiertaCobranza(entidad, perfil) {
  if (!entidad) return null;
  return construirPreguntaAbierta({
    pregunta: `La deuda de ${entidad}, ¿es un plazo pactado más largo o un atraso real?`,
    sobre: { entidad, metrica: "saldo vencido" },
    porQueNoEstaEnLosDatos: "El dato no registra el plazo pactado.",
    dominio: "cobranza", tipoDeHueco: "condicion_pactada",
    queCambia: "Si el plazo es más largo, no hay atraso; si no, corresponde cobranza.",
    perfil,
  });
}

/** componerEntregaBrechaComercial({ scenario, pregunta }) → { texto, entrega, libro, ok, motivo }
 *  El corte vertical completo: boleta → libro de hechos verificado → Entrega (texto markdown + estructura). */
/* ── LO GENÉRICO ENTRE RUTAS (owner 2026-09-22, TAREA 3 — extraído al sumar `componerEntregaCobranza`) ──
 * Las dos rutas comparten EXACTAMENTE estos dos pasos: correr el playbook (`pasosDe` + `runPlan`) y construir
 * el índice de evidencia del turno. Antes de la TAREA 3 vivían pegados dentro de `componerEntregaBrechaComercial`
 * — al escribir la segunda ruta habría sido copiar y pegar, la segunda verdad que este archivo mismo advierte
 * que no se permite (línea 10). Se extraen ACÁ, sin cambiar una línea de lo que ya hacían. ── */
function _correrPlaybook(playbook, { scenario, pregunta }) {
  const pasos = pasosDe(playbook, pregunta);
  const rp = runPlan(
    { intent: "answer", calls: pasos.map((p) => ({ tool: p.tool, args: p.args })) },
    { scenario, maxCalls: 8, preguntaUsuario: pregunta, registry: cajaDelAgente(TOOLS) },
  );
  return { pasos, rp, figs: asignarIds((rp.ledger && rp.ledger.figs) || []) };
}
/* (owner 2026-09-29, cierre del inventario) `consultaDeFrenado` / `estadosDeUniverso` / `frenadoSinUmbral` viven en `encargo/lecturasDe.js`: la LECTURA que pide los días sin venta y la ENTREGA que declara el límite juzgan «frenado sin umbral» con la MISMA función. */
/* el límite de una parte cuyo universo no se pudo evaluar: el de negocio si falta el umbral de «frenado» (con el
 * ofrecimiento de fijarlo, sin proponer un número); el de siempre, con su motivo, en los demás casos. */
/* §7.3·45(c) — el universo del HECHO histórico de los días sin venta cuando falta el umbral de «frenado»: el veredicto (estados, top, base) no se
 * puede juzgar y se cae, pero la BODEGA pedida —o la excluida— sí acota el hecho: «los frenados de Valparaíso» sirve los SKU de Valparaíso, nunca los de
 * todas las bodegas. Solo se conserva lo de bodega, con la misma forma tipada del universo (`bodega`, `excluir.bodega`, y una `union` cuyas ramas
 * TODAS traen su bodega: si una rama no acota por bodega, esa rama es el eje entero y la unión no acota nada). */
function _acoteDeBodega(u) {
  const acote = { eje: "sku" };
  if (!u || typeof u !== "object") return acote;
  if (u.bodega) acote.bodega = u.bodega;
  if (u.excluir && typeof u.excluir === "object" && u.excluir.bodega) acote.excluir = { bodega: u.excluir.bodega };
  if (Array.isArray(u.union) && u.union.length) {
    const ramas = u.union.map((v) => { const a = _acoteDeBodega(v); return a.bodega || a.excluir ? a : null; });
    if (ramas.every(Boolean)) acote.union = ramas;
  }
  return acote;
}
const _txtBodegas = (b) => (Array.isArray(b) ? b : [b]).filter(Boolean).join(" y ");
/* la frase de bodega del límite: «de Valparaíso» / «fuera de Valparaíso» (vacía si el universo no acota por bodega). */
function _fraseDeBodegaDelHecho(u) {
  const a = _acoteDeBodega(u);
  if (a.bodega) return ` de ${_txtBodegas(a.bodega)}`;
  if (a.excluir) return ` fuera de ${_txtBodegas(a.excluir.bodega)}`;
  return "";
}
function _limiteDeUniverso(p, motivo, resolucion, conRanking = false) {
  const dom = _DOM_NOMBRE[p.tema] || p.tema;
  /* con `conRanking` (cierre del inventario, owner 2026-09-29) la Entrega YA trae los días sin venta de cada SKU, ordenados: el
   * límite lo dice en vez de mandar a otra pestaña; sin ranking (la lectura no trajo las cifras) queda el texto de siempre. */
  if (_frenadoSinUmbral(p.universo, resolucion)) { const deB = _fraseDeBodegaDelHecho(p.universo); return { titulo: `Sobre la parte ${p.id} (${dom}), la venta frenada queda sin evaluar`, motivo: `La empresa no ha declarado desde cuántos días sin venta considera frenado un producto, y la consulta tampoco lo plantea. ${conRanking ? `Los días sin venta de cada SKU${deB}, un hecho histórico, van ordenados en esta Entrega, sin veredicto` : `Los días sin venta de cada SKU${deB}, un hecho histórico, están en la pestaña de inventario`}; si se indica un umbral en días, se puede evaluar cuáles lo superan y cuánto capital reúnen.` }; }
  return { titulo: `Sobre la parte ${p.id} (${dom}), el universo declarado no se pudo evaluar`, motivo };
}
/* la frase del Marco para lo histórico (etapa 6, §7.3·35), armada SOLO de los campos tipados de `marco.historicos`
 * (etiqueta · ventana · límite): «Días sin venta: días transcurridos entre la última venta y la fecha de corte del
 * inventario; describe lo que pasó; no es un pronóstico.» — una por clase de hecho. */
const _textoDeHistoricos = (h) => (h && Array.isArray(h.hechos) ? h.hechos.map((x) => `${x.etiqueta.charAt(0).toUpperCase()}${x.etiqueta.slice(1)}: ${x.ventana}; ${h.limite}.`).join(" ") : "");
/* §7.3·46(d) · 47 · 48(b) · 50(a) · 51(d) · 52 — LA DECISIÓN de prioridad (quién va primero · qué lente o medida se nombra · si se declara que la lente no ordena) vive en `./prioridad.js`, una sola pieza para todos los sitios. Acá queda solo la REDACCIÓN de cada oración. */
/* la fig de la medida de la lente se declara (`ref`) con el resto de las figs del grupo, ANTES de armar el libro: el render solo la cita */
function _declararLenteDelGrupo(lg, ref, porEntidad) {
  if (!lg) return lg;
  lg.filasExtra = [];
  const idDe = (fig, ubic) => {
    if (!fig) return null;
    const ya = ubic && porEntidad && porEntidad.get && porEntidad.get(ubic.e) ? porEntidad.get(ubic.e).get(ubic.c) : null;
    if (typeof ya === "string") return ya;   /* la fig ya está en la tabla con su id: el mismo hecho, nunca dos */
    /* FAMILIA 4 (§7.3·49f · «la misma cifra nunca con dos rótulos»): el productor de la medida de la lente la publica con SU rótulo («Ventas», «Venta (flujo)»), distinto del que el léxico da a ese concepto; si la tabla del grupo ya trae el CONCEPTO de esa entidad (su fila vino de la proyección y no es la misma fig de la boleta), es la misma cifra con el mismo rótulo: no se agrega una fila más (antes salía dos veces, con dos rótulos; con el rótulo del léxico saldría dos veces idéntica) */
    const _rot = rotuloDeLaCasa({ fig }), _e = _entidadDe(_lab(fig));
    const yaDelConcepto = _rot.clave && _rot.rotulo !== conceptoDeLaFig(_lab(fig)) && _e && porEntidad && porEntidad.get && porEntidad.get(_e) ? porEntidad.get(_e).get(_rot.clave) : null;
    if (typeof yaDelConcepto === "string") return yaDelConcepto;
    const id = ref(fig);
    if (id != null) lg.filasExtra.push({ entidad: _entidadDe(_lab(fig)) || "", concepto: rotuloDeLaCasa({ fig }).rotulo, id });   /* FAMILIA 4: la fila de la medida de la lente lleva el rótulo de SU concepto («Venta a crédito», nunca «Venta (flujo)») */
    return id;
  };
  lg.idFig = idDe(lg.fig, lg.ubicFig); lg.idCero = idDe(lg.figCero, lg.ubicCero); lg.idEmpate = idDe(lg.figEmpate, lg.ubicEmpate);
  return lg;
}
/* FAMILIA 4 (§7.3·52e): una cifra cuyo concepto el léxico no conoce no se imprime con el rótulo crudo del productor: se declara (el texto vive en `config/contract/ausencias.js`, vía `rotulos.js`) */
const _limiteDeFigSinClave = (parte, entidades) => { const d = declaracionDeFigSinClave(entidades); return { titulo: `Sobre la parte ${parte.id} (${_DOM_NOMBRE[parte.tema] || parte.tema}), ${d.titulo}`, motivo: d.motivo }; };
/* la oración de prioridad de un grupo cuando la lente que aplica NO coronó a nadie: nombra la lente PEDIDA y dice por qué no hay una cuenta primera (nunca se corona a la primera de la lista) */
function _oracionLenteSinPrimero(lg, R, listaDe, cola = "") {
  const cab = `Prioridad del procedimiento dentro de este grupo, por ${lg.nombreVisible}: ninguna cuenta queda primera, porque `;
  const nombres = lg.entidades || [];
  const grupo = `el grupo (${nombres.slice(0, 8).join(", ")}${nombres.length > 8 ? " y otros" : ""})`;
  if (lg.motivo === "cero") { const id = lg.idCero; return { texto: `${cab}${grupo} ${dichoElCero(lg.concepto, R(id))}.`, hechos: [id], _sinPrimero: true }; }
  if (lg.motivo === "empate") { const id = lg.idEmpate; return { texto: `${cab}${listaDe(lg.empatadas)} empatan en ${lg.concepto} (${R(id)}).`, hechos: [id], _sinPrimero: true }; }
  return { texto: `${cab}${grupo} no trae ${lg.concepto}${cola}.`, hechos: [], _sinPrimero: true };
}
/* la frase que sigue a «por» cuando la lente no coronó. La DECISIÓN de qué se nombra es de `prioridad.js:nombraLaLista` (46d · 47d · 48b · 52e); acá solo se redacta. Sin nada que nombrar → null (no hay oración). */
const _porLista = (nombra) => {
  if (!nombra) return null;
  if (nombra.tipo === "lente") return nombra.nombre;
  if (nombra.tipo === "nombre") return nombra.texto;
  if (!nombra.clave) return null;   /* una referencia sin medida que ordenara no se nombra como criterio (52e) */
  const clave = _labelDeClave(nombra.clave).toLowerCase();
  if (nombra.tipo === "referencia") return `${clave} (la referencia pedida, ${nombra.referencia}, no ordena este grupo)`;
  const d = nombra.declara;
  if (nombra.porElTop) return `${clave}, el top que se pidió`;   /* §7.3·55(a): la lista la ordenó el top por ventas que pidió el usuario: se nombra la venta como lo que ordenó, sin declarar que «ventas» no ordena */
  if (!d) return clave;
  /* se dice «riesgo» (el nombre visible de la lente), no «riesgo integrado»: esa expresión es la de la oración de prioridad CRUZADA y un grupo de una parte no la cruza */
  if (d.entreDominios) return `${clave} (el criterio pedido, ${d.nombre}, es el criterio entre dominios y no ordena este grupo)`;
  return `${clave} (el criterio pedido, ${d.nombre}, ${d.dominio && _DOM_NOMBRE[d.dominio] ? `es de ${_DOM_NOMBRE[d.dominio]} y ` : ""}no ordena este grupo)`;
};
/* la marca estructural de una oración de prioridad (`prioridad.js:marcaDePrioridad`): quien necesita saber «cuál es la oración de prioridad» la lee, nunca el texto */
const _marcaGrupo = (primero) => marcaDePrioridad(ALCANCE_DE_PRIORIDAD.GRUPO, primero);
function _indiceDelTenant(figs, scenario, consulta = null) {
  const datoProyectado = cifrasDelDato(scenario, consulta);
  const ejesDelTenant = {};
  for (const eje of _EJES) { try { const n = axisEntityNames(eje); if (n && n.length) ejesDelTenant[eje] = n; } catch { /* eje sin índice en este tenant */ } }
  return { I: indiceDeEvidencia({ figs, datoProyectado, ejesDelTenant }), ejesDelTenant };
}

export function componerEntregaBrechaComercial({ scenario = ESCENARIO_INICIAL, pregunta = PREGUNTA_BRECHA_COMERCIAL, conocimientoActivo = undefined, conocimientoCatalogo = undefined } = {}) {
  // 1 · LA BOLETA — los mismos dos pasos que el playbook margen-en-riesgo ya certifica (marginRead + diagnose)
  const { figs } = _correrPlaybook(margenEnRiesgo, { scenario, pregunta });
  if (!figs.length) return _vacia("sin boleta: el motor no produjo cifras para esta pregunta con los datos activos");

  // 2 · EL ÍNDICE DE EVIDENCIA — el mismo que usa el Notario v3 para verificar hechos declarados
  const { I, ejesDelTenant } = _indiceDelTenant(figs, scenario);

  // 3 · LA LECTURA — reusada del playbook, NO recalculada: «una sola verdad» (CLAUDE.md §2)
  const lect = lecturaDeMargen(figs);
  const pr = prioridadDe(figs);
  if (!lect.bench || !pr) return _vacia("sin evidencia suficiente: falta el benchmark declarado o la contribución no capturada de al menos una cuenta");
  /* FAMILIA 1: quién va primero lo decide la pieza (la contribución no capturada: la magnitud que más pesa); el playbook trae los valores */
  const _primeroBrecha = primeroPorMedida({ tema: "comercial", claveOrden: "no_capturada", entidades: pr.juego.map((x) => x.entidad), valorDe: (n) => { const x = pr.juego.find((y) => y.entidad === n); return x ? x.usd : NaN; } });
  const top = pr.juego.find((x) => x.entidad === _primeroBrecha) || pr.top;
  const segundo = pr.juego.length > 1 ? pr.juego[1] : null;

  const figVenta = (e) => _find(figs, new RegExp(`^${_esc(e)} · Venta$`, "i"));
  const figMargen = (e) => _find(figs, new RegExp(`^${_esc(e)} · Margen$`, "i"));
  const figJuego = (e) => _find(figs, new RegExp(`^${_esc(e)} · Contribuci[oó]n no capturada$`, "i"));
  const figCarga = (e) => _find(figs, new RegExp(`^${_esc(e)} · Carga comercial alta$`, "i"));

  // 4 · EL LIBRO DE HECHOS — cada cifra que el texto va a imprimir se declara ACÁ primero, y se verifica
  const hechos = [];
  const contador = { n: 0 };
  // `figsUsadas` — las figs REALMENTE citadas por esta Entrega (owner 2026-09-22, TAREA 1): `figs` es la boleta
  // CRUDA del turno (marginRead + diagnose, que barre TODOS los detectores — incluido capital inmovilizado,
  // universo "hoy"), y la mayoría nunca llega a imprimirse. Declarar el período del Marco sobre `figs` entera
  // contaminaba el marco con "foto de inventario a hoy" aunque la Entrega no mencione una sola cifra de
  // inventario. El período se declara sobre lo que el texto USA, igual que `cifrasImpresas`.
  const figsUsadas = [];
  const ref = (fig) => { if (fig) figsUsadas.push(fig); return _declararRef(hechos, contador, fig); };

  const idBench = ref(lect.bench);
  const idTotal = ref(lect.totalJuego);
  const idCargaTotal = lect.cargaTotal ? ref(lect.cargaTotal) : null;

  const _declararCliente = (entidad) => ({
    venta: ref(figVenta(entidad)),
    margen: ref(figMargen(entidad)),
    juego: ref(figJuego(entidad)),
    carga: ref(figCarga(entidad)),
  });
  const idsTop = _declararCliente(top.entidad);
  const idsSeg = segundo ? _declararCliente(segundo.entidad) : null;

  // la participación del primero sobre el total (mecanismo 6: la tentación precalculada, no dejada al anfitrión)
  const idShare = idsTop.juego && idTotal ? (() => { const id = `e${++contador.n}`; hechos.push({ id, tipo: "razon", num: { id: idsTop.juego }, den: { id: idTotal }, forma: "pct" }); return id; })() : null;
  // el resto de la brecha tras la carga comercial (gap = carga + resto, exacto por construcción — specRetrieval.js)
  const idResto = idTotal && idCargaTotal ? (() => { const id = `e${++contador.n}`; hechos.push({ id, tipo: "derivada", op: "diferencia", de: [{ id: idTotal }, { id: idCargaTotal }] }); return id; })() : null;

  const libro = libroDeHechos(hechos, { indice: I });
  // 5 · LA GARANTÍA (plan §1, mecanismo de autoverificación): si un hecho que este compositor declaró no pasa la
  // verificación, la Entrega NO se sirve a medias — se declina completa. Un hecho `ref` que no verifica es un
  // BUG del compositor (la fig existe, se está citando literal), y el gate lo pone rojo antes que un cliente lo vea.
  const rotos = libro.hechos.filter((h) => !h.ok);
  if (rotos.length) return { texto: "", entrega: null, libro, ok: false, motivo: `${rotos.length} hecho(s) no verificaron: ${rotos.map((h) => `${h.id} (${h.motivo})`).join(" · ")}` };

  // 6 · LA ENTREGA — la estructura, llenada con los renders VERIFICADOS (nunca con un número escrito a mano)
  const entrega = crearEntrega();
  const cifrasImpresas = [];
  const R = (id) => { const v = renderDe(libro, id); if (v != null) cifrasImpresas.push(v); return v; };

  const nClientes = ejesDelTenant.cliente ? ejesDelTenant.cliente.length : null;
  const { periodo, faltaRango } = _periodoDelMarco(figsUsadas);
  const { empresaNombre, perfil } = _identidadDelTenant();
  entrega.marco = {
    empresa: empresaNombre,   // el nombre del tenant activo (getTenantData().nombre) — no de la boleta de este playbook
    periodo,         // HECHO verificable (figureType.UNIVERSOS · periodoDeFiguras) — nunca texto suelto
    universo: nClientes != null ? `${nClientes} clientes` : null,
    moneda: "$",     // el símbolo que la boleta ya imprime — la escala nunca se declara (regla de la casa)
    definiciones: ["Margen = contribución sobre venta neta.", "La brecha estimada es la diferencia contra el benchmark declarado, no dinero ya perdido."],
    // CORTE 3e (owner 2026-09-26) — «declarado por usted» → «declarado por la empresa» (tercera persona).
    referenciaDeclarada: { texto: textoDeBenchmark(R(idBench)), hechoId: idBench },   // FAMILIA 3: la frase del benchmark oficial es de `referencias.js`
    perfil,          // plan §3 «cómo se pega al cliente» — sector/tipoProducto/tamaño/país/modelo comercial, con procedencia
  };
  if (nClientes != null) cifrasImpresas.push(`${nClientes} clientes`);
  // el «12» de «los 12 meses ya ocurrieron» es texto CANÓNICO del contrato (figureType.PERIODO_TXT), no un
  // número que este compositor calculó — se registra igual que el universo, para que la regla 1 (cero cifras
  // desnudas) no lo confunda con una cifra sin dueño.
  if (periodo && periodo.texto) cifrasImpresas.push(periodo.texto);

  // ── RESPUESTA · 2-3 oraciones, cada una dueño + métrica + valor en la misma oración (mecanismo 2) ──
  const respuesta = [];
  {
    const vTop = R(idsTop.venta), mTop = R(idsTop.margen), bTop = R(idBench), jTop = R(idsTop.juego), pShare = idShare ? R(idShare) : null;
    const texto = `Donde más contribución deja de capturar es en ${top.entidad}: vende ${vTop}, con un margen de ${mTop} contra su benchmark de ${bTop}; la brecha estimada es ${jTop}${pShare ? `, el ${pShare} de la brecha total estimada` : ""}.`;
    respuesta.push({ texto, hechos: [idsTop.venta, idsTop.margen, idBench, idsTop.juego, idShare].filter(Boolean) });
  }
  if (idsSeg) {
    const vSeg = R(idsSeg.venta), mSeg = R(idsSeg.margen), jSeg = R(idsSeg.juego);
    const texto = `El segundo es ${segundo.entidad}: ${vSeg} de venta, ${mSeg} de margen, brecha estimada ${jSeg}.`;
    respuesta.push({ texto, hechos: [idsSeg.venta, idsSeg.margen, idsSeg.juego].filter(Boolean) });
  }
  if (idCargaTotal && idResto) {
    const total = R(idTotal), carga = R(idCargaTotal), resto = R(idResto);
    const texto = `De la brecha total de ${total}, la carga comercial alta explica ${carga}; los ${resto} restantes son precio y costo, que los datos no separan.`;
    respuesta.push({ texto, hechos: [idTotal, idCargaTotal, idResto] });
  }
  {
    const jTop = R(idsTop.juego);
    const texto = `Prioridad del procedimiento, por mayor contribución en juego: ${top.entidad}, con ${jTop} sin capturar.`;
    respuesta.push({ texto, hechos: [idsTop.juego], _prioridad: marcaDePrioridad(ALCANCE_DE_PRIORIDAD.DOMINIO, top.entidad) });
  }
  entrega.respuesta = respuesta;

  // ── CIFRAS · la tabla — la unidad que no se puede partir (mecanismo 2): dueño + venta + margen + brecha + tipo ──
  /* FAMILIA 4: los encabezados de la tabla de la ruta fija son los rótulos del léxico de sus conceptos (`rotulos.js`), no literales */
  const _cVenta = _RC("ventas"), _cMargen = _RC("margen"), _cBrecha = `${_RC("no_capturada")} (brecha estimada)`;
  entrega.cifras.columnas = ["Cliente", _cVenta, _cMargen, _cBrecha, "Tipo"];
  const _filaCliente = (entidad, ids) => {
    const hechosFila = [ids.venta, ids.margen, ids.juego].filter(Boolean);
    const procedencia = _procedenciaDeFila(libro, hechosFila);
    return {
      valores: { Cliente: entidad, [_cVenta]: R(ids.venta), [_cMargen]: R(ids.margen), [_cBrecha]: R(ids.juego), Tipo: _textoDeTipo(procedencia) },
      hechos: hechosFila,
      procedencia,
    };
  };
  entrega.cifras.filas.push(_filaCliente(top.entidad, idsTop));
  if (idsSeg) entrega.cifras.filas.push(_filaCliente(segundo.entidad, idsSeg));
  if (idTotal) { const procedencia = _procedenciaDeFila(libro, [idTotal]); entrega.cifras.filas.push({
    valores: { Cliente: "Total (cuentas materiales)", [_cVenta]: "", [_cMargen]: "", [_cBrecha]: R(idTotal), Tipo: _textoDeTipo(procedencia, { subtotal: true }) },
    hechos: [idTotal],
    procedencia,
  }); }

  // ── LO QUE NO SE PUEDE CONCLUIR · cada ausencia es un HALLAZGO con título, nunca una prohibición ni una excusa ──
  entrega.limites = [
    // CORTE 3e (owner 2026-09-26) — «que usted declaró» → «que la empresa declaró».
    { titulo: "La brecha estimada no es dinero ya perdido", motivo: `Es una comparación contra el ${nombreSegunOrigen("declaro_benchmark", "benchmark")} (${R(idBench)}); no es recuperable en su totalidad ni necesariamente.` },
    { titulo: `La causa de que ${top.entidad} esté bajo el benchmark no está en los datos`, motivo: "Esta lectura localiza dónde está la brecha, no explica por qué — no hay causalidad sin respaldo." },
    { titulo: "No hay serie mensual de margen por cliente en este dato", motivo: `No se puede afirmar que el margen de ${top.entidad} venga subiendo, bajando o se mantenga: solo que está en el valor de este corte.` },
    _limiteDeAusencia("conocimiento_sector_comercial"),
  ];
  // El Marco YA declara el período con verdad (tipo "cerrado", año cerrado — ver `_periodoDelMarco`); lo único
  // que el pack no sostiene es el RANGO calendario (fecha de inicio/fin). Se declara como límite, no se inventa
  // una fecha — ver la nota de `_periodoDelMarco` sobre el hueco de ingesta exacto.
  if (faltaRango) entrega.limites.push({ titulo: "El período no declara un rango de fechas calendario", motivo: "El dato confirma que es el año cerrado (12 meses ya ocurridos), pero el pack no trae una fecha de cierre para el universo comercial — a diferencia de la cobranza, que sí la declara (flujoComercial.fechaCorte). No se afirma un mes ni un año." });
  { const lp = _limitePerfilIncompleto(perfil); if (lp) entrega.limites.push(lp); }

  // ── REFERENCIA DEL OFICIO · Etapa 3 — pertinencia medida contra la tabla de señales de ESTA Entrega (las
  // cuentas que la Respuesta nombra encienden `cuenta.en_respuesta`) ──
  const _refOficio1 = referenciaDelOficioConOfertas({ perfil, pregunta, entidadesEnRespuesta: [top.entidad, ...(segundo ? [segundo.entidad] : [])], entidadesDeLaPregunta: _entidadesDeLaPregunta(pregunta), scenario, activo: conocimientoActivo, catalogo: conocimientoCatalogo });
  entrega.referenciaDelOficio = _refOficio1.salida;
  _coherenciaConLaCapa(entrega, { conocimientoActivo, perfil });

  // ── PARA SU JUICIO · reusa las huellas con sello (probado/indicado/abierto) y la pregunta al dueño de
  // `rolesCartera` — sin introducir NINGÚN número que no esté ya verificado arriba (regla 1 del plan) ──
  let roles = null;
  try { roles = buildRolesCartera(scenario); } catch { roles = null; }
  const paraSuJuicio = [];
  // CORTE 3e (owner 2026-09-26) — antes: `Solo usted puede responder: ${roles.preguntaAlDueno.texto}` (segunda
  // persona, sin función sugerida). Ahora: pregunta abierta en tercera persona + función derivada del cruce
  // dominio × tipo de hueco — ver `_preguntaAbiertaComercial`, arriba.
  { const pa = _preguntaAbiertaComercial(roles, perfil); if (pa) paraSuJuicio.push(pa); }
  if (idsTop.carga) {
    const cTop = R(idsTop.carga);
    paraSuJuicio.push({ texto: `Hipótesis no demostrada: parte de la brecha de ${top.entidad} está en la carga comercial (apoyo: ${cTop} de carga comercial alta medida en esa cuenta).`, hechos: [idsTop.carga] });
  }
  entrega.paraSuJuicio = paraSuJuicio;

  // ── QUÉ MÁS PUEDO CALCULAR · menú por ruta + las ofertas de la capa de conocimiento (Etapa 3, owner 2026-09-24:
  // antes un menú estático sin cifras; una oferta trae una cifra-gancho YA verificada — `_ofertasTexto`) ──
  entrega.queMasPuedoCalcular = {
    puedo: [
      `${_RC("margen")} por producto dentro de ${top.entidad}`,
      `${_RC("carga_alta")}, cuenta por cuenta`,
      `Ranking completo por ${_RCo("no_capturada")}`,
      "Simular un cambio de carga o de precio en la cuenta prioritaria",
      ..._ofertasTexto(_refOficio1.ofertas),
    ],
    noPuedo: ["Quién dejó de comprar qué (no hay historial cliente×SKU)", "La causa exacta de la brecha (el dato localiza, no explica)"],
  };

  // TAREA 3 — el universo que sostiene la Respuesta y las Cifras: los clientes citados, rankeados por la MISMA
  // métrica que ordena `prioridadDe` (contribución no capturada, descendente).
  _declararUniverso(entrega, I, {
    id: "brecha_comercial_prioridad", eje: "cliente", top: { metrica: "no_capturada", k: idsSeg ? 2 : 1, direccion: "mayor" },
    periodo: periodo ? periodo.tipo : null, entidades: [top.entidad, ...(segundo ? [segundo.entidad] : [])],
  });

  entrega.procedencia = { libro, cifrasImpresas };

  const texto = _textoDeLaEntrega(entrega);
  return { texto, entrega, libro, ok: true, motivo: "" };
}

/** componerEntregaCobranza({ scenario, pregunta }) → { texto, entrega, libro, ok, motivo }
 *  SEGUNDA RUTA (plan §1, TAREA 3 del incremento 2, owner 2026-09-22) — «¿quién me debe más?», sobre el
 *  playbook `cobranza` (playbooks/cobranza.js), para probar que el patrón del compositor GENERALIZA. Mismo
 *  molde que `componerEntregaBrechaComercial`: boleta real → libro de hechos verificado → Entrega → texto,
 *  con `verificar.js` y `_entrega_gate.mjs` sin cambios de fondo (solo la regla 4 se generalizó — ver abajo).
 *
 *  QUÉ NO GENERALIZABA TAL CUAL (documentado acá, no escondido — el owner pidió reportarlo aunque incomode):
 *   1. `margenEnRiesgo.js` exporta `lecturaDeMargen`/`prioridadDe`: funciones PURAS y reusables que devuelven
 *      datos estructurados, no prosa. `cobranza.js` NO tiene equivalente — toda su lectura vive DENTRO de su
 *      `componer()` (un armador de texto). Acá no hubo dato estructurado que importar: se leyó la boleta con
 *      los MISMOS patrones de rótulo que cobranza.js ya usa (`_find`/`_all` sobre "Entidad · Concepto"), pero
 *      escritos de nuevo en este archivo. Si se agrega una tercera ruta, vale la pena extraer una
 *      `lecturaDeCobranza(figs)` de cobranza.js —como ya existe para margen— para que esta Entrega la importe
 *      en vez de leer la boleta por su cuenta.
 *   2. EL PERÍODO NO SE PUDO REUSAR TAL CUAL (`_periodoDelMarco`, la función de la TAREA 1). El contrato
 *      (`figureType.UNIVERSOS`) no tiene un universo «cobranza»: sus cifras (saldo, vencido, abonado, venta a
 *      crédito) caen por default a `venta_comercial` (período "anual" — año cerrado), que es FALSO: cobranza es
 *      una FOTO al cierre (`flujoComercial.fechaCorte`, igual que inventario), medido en vivo con
 *      `_probe_cobranza_periodo.mjs` (mismo tenant demo): las 40 figs de esta ruta salieron TODAS tipadas
 *      `venta_comercial|anual` salvo "Días Vencido" (que cae bien por suerte, no por diseño). Declarar un
 *      universo «cobranza» en el contrato es una decisión de significado que toca guardC y la Mesa —no la tomo
 *      acá—, así que esta ruta usa la fuente MÁS verificable que tiene a mano: `facts.fechaCorte`, que el propio
 *      tool ya declara (la misma fecha que pinta la pestaña Flujo Comercial). Es mejor que el caso 1: acá SÍ hay
 *      un rango verificado, no solo un tipo.
 *   3. La regla 4 de `verificar.js` («comparables-juntas») asumía que TODA Entrega compara contra un benchmark
 *      — cierto en brecha comercial, falso en cobranza (no hay benchmark de deuda). Se generalizó a activarse
 *      por CONTENIDO (el texto nombra «brecha»/«benchmark»), no por la forma de la Entrega — ver verificar.js. */
export function componerEntregaCobranza({ scenario = ESCENARIO_INICIAL, pregunta = PREGUNTA_COBRANZA, conocimientoActivo = undefined, conocimientoCatalogo = undefined } = {}) {
  // 1 · LA BOLETA — el mismo (único) paso que el playbook `cobranza` ya certifica
  const { rp, figs } = _correrPlaybook(cobranza, { scenario, pregunta });
  if (!figs.length) return _vacia("sin boleta: el motor no produjo cifras para esta pregunta con los datos activos");

  // 2 · EL ÍNDICE DE EVIDENCIA — el mismo helper que la ruta 1 (extraído en la TAREA 3)
  const { I, ejesDelTenant } = _indiceDelTenant(figs, scenario);

  // 3 · LA LECTURA — sin `lecturaDeMargen`/`prioridadDe` equivalentes en cobranza.js (nota 1 de arriba): se lee
  // la boleta con los MISMOS patrones de rótulo que ya usa el playbook, no una segunda verdad.
  const figVentaTotal = _find(figs, /^Venta (?:a crédito del período|del período \(flujo\))$/i);
  const figAbonadoTotal = _find(figs, /^Abonado · total$/i);
  const figSaldoTotal = _find(figs, /^Saldo pendiente · total$/i);
  const figVencidoTotal = _find(figs, /^Saldo vencido · total$/i);
  if (!figSaldoTotal) return _vacia("sin evidencia suficiente: falta el saldo pendiente total de la mesa de cobranza");
  // orden del módulo (mesaFlujo.js): vencido primero, después saldo — el primero de la lista YA es quien más debe
  const filasSaldo = _all(figs, /· Saldo pendiente$/i);
  /* FAMILIA 1: quién va primero («quien más le debe») lo decide la pieza por el saldo pendiente; la mesa trae las cuentas y sus valores */
  const _enSaldo = filasSaldo.map((f) => ({ e: _entidadDe(_lab(f)), v: Number.isFinite(f.raw) ? f.raw : NaN })).filter((x) => x.e);
  const topEntidad = _enSaldo.length ? primeroPorMedida({ tema: "cobranza", claveOrden: "saldo_pendiente", entidades: _enSaldo.map((x) => x.e), valorDe: (n) => { const x = _enSaldo.find((y) => y.e === n); return x ? x.v : NaN; } }) : null;
  const segundoEntidad = (_enSaldo.find((x) => x.e !== topEntidad) || {}).e || null;
  if (!topEntidad) return _vacia("sin evidencia suficiente: la mesa de cobranza no trae saldo por cliente");
  const figSaldoDe = (e) => _find(figs, new RegExp(`^${_esc(e)} · Saldo pendiente$`, "i"));
  const figVencidoDe = (e) => _find(figs, new RegExp(`^${_esc(e)} · Saldo vencido$`, "i"));

  // 4 · EL LIBRO DE HECHOS — mismo mecanismo que la ruta 1: nada se imprime sin declararse y verificarse antes
  const hechos = [];
  const contador = { n: 0 };
  const figsUsadas = [];
  const ref = (fig) => { if (fig) figsUsadas.push(fig); return _declararRef(hechos, contador, fig); };

  const idVentaTotal = ref(figVentaTotal);
  const idAbonadoTotal = ref(figAbonadoTotal);
  const idSaldoTotal = ref(figSaldoTotal);
  const idVencidoTotal = figVencidoTotal ? ref(figVencidoTotal) : null;
  const _declararCliente = (entidad) => ({ saldo: ref(figSaldoDe(entidad)), vencido: (() => { const f = figVencidoDe(entidad); return f ? ref(f) : null; })() });
  const idsTop = _declararCliente(topEntidad);
  const idsSeg = segundoEntidad ? _declararCliente(segundoEntidad) : null;

  // la tentación precalculada (mecanismo 6 del plan): la participación del mayor deudor sobre el total —de
  // vencido si hay vencido calculado, si no de saldo pendiente— para que el anfitrión no la multiplique por su cuenta
  let idShare = null;
  if (idsTop.vencido && idVencidoTotal) {
    idShare = (() => { const id = `e${++contador.n}`; hechos.push({ id, tipo: "razon", num: { id: idsTop.vencido }, den: { id: idVencidoTotal }, forma: "pct" }); return id; })();
  } else if (idsTop.saldo && idSaldoTotal) {
    idShare = (() => { const id = `e${++contador.n}`; hechos.push({ id, tipo: "razon", num: { id: idsTop.saldo }, den: { id: idSaldoTotal }, forma: "pct" }); return id; })();
  }

  const libro = libroDeHechos(hechos, { indice: I });
  const rotos = libro.hechos.filter((h) => !h.ok);
  if (rotos.length) return { texto: "", entrega: null, libro, ok: false, motivo: `${rotos.length} hecho(s) no verificaron: ${rotos.map((h) => `${h.id} (${h.motivo})`).join(" · ")}` };

  // 5 · LA ENTREGA
  const entrega = crearEntrega();
  const cifrasImpresas = [];
  const R = (id) => { const v = renderDe(libro, id); if (v != null) cifrasImpresas.push(v); return v; };

  // EL PERÍODO — NO se reusa `_periodoDelMarco` (nota 2 de arriba): se declara desde `facts.fechaCorte`, el
  // dato MÁS verificable que esta tool ya publica (la misma fecha de la pestaña Flujo Comercial).
  const fechaCorte = rp.results[0] && rp.results[0].facts && rp.results[0].facts.fechaCorte;
  const periodo = fechaCorte ? { tipo: "foto", texto: `foto de cobranza al ${fechaCorte}`, familias: ["hoy"], rango: fechaCorte } : null;

  const nClientes = ejesDelTenant.cliente ? ejesDelTenant.cliente.length : null;
  const { empresaNombre, perfil } = _identidadDelTenant();
  entrega.marco = {
    empresa: empresaNombre,
    periodo,
    universo: nClientes != null ? `${nClientes} clientes` : null,
    moneda: "$",
    definiciones: ["Saldo pendiente = venta a crédito menos lo ya abonado.", "El saldo vencido es la parte del saldo pendiente que ya superó su plazo de pago; sin plazo declarado no se calcula — nunca se declara en cero."],
    referenciaDeclarada: null,   // cobranza no compara contra un benchmark — no se inventa uno (regla 4 generalizada)
    perfil,
  };
  if (nClientes != null) cifrasImpresas.push(`${nClientes} clientes`);
  if (periodo && periodo.texto) cifrasImpresas.push(periodo.texto);

  // ── RESPUESTA ──
  const respuesta = [];
  {
    const vSaldo = R(idSaldoTotal), vVenta = idVentaTotal ? R(idVentaTotal) : null, vAbonado = idAbonadoTotal ? R(idAbonadoTotal) : null;
    // CORREGIDO (owner 2026-09-25, ley «caja ≠ cobranza», misma corrección que playbooks/cobranza.js el mismo
    // día): esta cifra viene de `mesaFlujo` y es SIEMPRE la venta A CRÉDITO — nunca depende de si el rótulo del
    // emisor trae literalmente la palabra «crédito» (la planilla sí, el demo dice «Venta del período (flujo)»).
    // Antes decía «a crédito» solo si el rótulo lo traía escrito; ahora lo dice siempre.
    const texto = vVenta && vAbonado
      ? `Tiene ${vSaldo} por cobrar, de una venta a crédito de ${vVenta} — ya le abonaron ${vAbonado}.`
      : `Tiene ${vSaldo} por cobrar en toda la cartera.`;
    respuesta.push({ texto, hechos: [idSaldoTotal, idVentaTotal, idAbonadoTotal].filter(Boolean) });
  }
  {
    const sTop = R(idsTop.saldo);
    if (idsTop.vencido) {
      const vTop = R(idsTop.vencido), pShare = idShare ? R(idShare) : null;
      const texto = `Quien más le debe es ${topEntidad}: ${sTop} pendientes, de los cuales ${vTop} ya está vencido${pShare ? `, el ${pShare} de su propio saldo` : ""}.`;
      respuesta.push({ texto, hechos: [idsTop.saldo, idsTop.vencido, idShare].filter(Boolean) });
    } else {
      const texto = `Quien más le debe es ${topEntidad}, con ${sTop} pendientes.`;
      respuesta.push({ texto, hechos: [idsTop.saldo] });
    }
  }
  if (idsSeg) {
    const sSeg = R(idsSeg.saldo);
    const texto = idsSeg.vencido ? `El segundo es ${segundoEntidad}: ${sSeg} pendientes, ${R(idsSeg.vencido)} vencido.` : `El segundo es ${segundoEntidad}, con ${sSeg} pendientes.`;
    respuesta.push({ texto, hechos: [idsSeg.saldo, idsSeg.vencido].filter(Boolean) });
  }
  if (idVencidoTotal) {
    const texto = `Del total pendiente, ${R(idVencidoTotal)} ya está vencido en toda la cartera.`;
    respuesta.push({ texto, hechos: [idVencidoTotal] });
  }
  entrega.respuesta = respuesta;

  // ── CIFRAS ──
  const _cSaldo = _RC("saldo_pendiente"), _cVencido = _RC("saldo_vencido");   /* FAMILIA 4: encabezados = rótulos del léxico */
  entrega.cifras.columnas = ["Cliente", _cSaldo, _cVencido, "Tipo"];
  const _filaCliente = (entidad, ids) => {
    const hechosFila = [ids.saldo, ids.vencido].filter(Boolean);
    const procedencia = _procedenciaDeFila(libro, hechosFila);
    return {
      valores: { Cliente: entidad, [_cSaldo]: R(ids.saldo), [_cVencido]: ids.vencido ? R(ids.vencido) : "—", Tipo: _textoDeTipo(procedencia, { extra: ids.vencido ? null : "vencido no calculado" }) },
      hechos: hechosFila,
      procedencia,
    };
  };
  entrega.cifras.filas.push(_filaCliente(topEntidad, idsTop));
  if (idsSeg) entrega.cifras.filas.push(_filaCliente(segundoEntidad, idsSeg));
  { const hechosFila = [idSaldoTotal, idVencidoTotal].filter(Boolean); const procedencia = _procedenciaDeFila(libro, hechosFila); entrega.cifras.filas.push({
    valores: { Cliente: "Total (cartera)", [_cSaldo]: R(idSaldoTotal), [_cVencido]: idVencidoTotal ? R(idVencidoTotal) : "—", Tipo: _textoDeTipo(procedencia, { subtotal: true }) },
    hechos: hechosFila,
    procedencia,
  }); }

  // ── LO QUE NO SE PUEDE CONCLUIR ──
  entrega.limites = [
    { titulo: "El saldo pendiente no es una pérdida", motivo: "Es capital retenido del cliente; sería pérdida solo si se volviera incobrable, y eso no está en los datos." },
    { titulo: "La causa de la deuda no está en los datos", motivo: "Esta lectura localiza cuánto y quién debe, no explica la conducta de pago — no hay causalidad sin respaldo." },
    _limiteDeAusencia("conocimiento_sector_cobranza"),
    // AGREGADO INTENCIONAL (owner/supervisor, 2026-09-25, revisión de calidad del corte 3d): «toda Entrega que
    // sirve cobranza declara que el dato no trae la antigüedad del vencido por tramos» — antes solo lo declaraba
    // el camino general; el owner pidió extenderlo también a esta ruta fija. Sale de `ausencias.js` (el mismo
    // catálogo, no la pieza CAU-01 en borrador). ÚNICO cambio de texto de esta ruta en este corte — ver
    // `_entrega_gate.mjs` (expectativas de `limites.length` actualizadas con la misma fecha).
    _limiteDeAusencia("sin_antiguedad_vencido"),
  ];
  if (!idVencidoTotal) entrega.limites.push({ titulo: "El vencido no se puede calcular", motivo: "Su empresa no declaró un plazo de pago: sin plazo, no se puede afirmar qué parte del saldo está vencida — nunca se declara en cero. Declárelo y el vencido se calcula solo." });
  { const lp = _limitePerfilIncompleto(perfil); if (lp) entrega.limites.push(lp); }

  // ── REFERENCIA DEL OFICIO · Etapa 3 (ver la nota de la ruta 1) ──
  const _refOficio2 = referenciaDelOficioConOfertas({ perfil, pregunta, entidadesEnRespuesta: [topEntidad, ...(segundoEntidad ? [segundoEntidad] : [])], entidadesDeLaPregunta: _entidadesDeLaPregunta(pregunta), scenario, activo: conocimientoActivo, catalogo: conocimientoCatalogo });
  entrega.referenciaDelOficio = _refOficio2.salida;
  _coherenciaConLaCapa(entrega, { conocimientoActivo, perfil });

  // ── PARA SU JUICIO ──
  // CORTE 3e (owner 2026-09-26) — antes: `Solo usted puede responder: la deuda de X, ¿responde a un plazo
  // pactado…?` (segunda persona). Ahora: pregunta abierta en tercera persona, tipo de hueco "condicion_pactada"
  // → función sugerida «la gestión de crédito y cobranza» — ver `_preguntaAbiertaCobranza`.
  entrega.paraSuJuicio = idVencidoTotal
    ? [_preguntaAbiertaCobranza(topEntidad, perfil)].filter(Boolean)
    : [{ texto: "Declarar el plazo de pago de cada cliente permite calcular el vencido automáticamente, sin volver a cargar el archivo.", hechos: [] }];

  // ── QUÉ MÁS PUEDO CALCULAR ──
  entrega.queMasPuedoCalcular = {
    puedo: ["Deuda vencida por antigüedad", "Cuánto se vendió a crédito contra al contado", "Ranking completo de deudores", ..._ofertasTexto(_refOficio2.ofertas)],
    noPuedo: ["Por qué un cliente dejó de pagar a tiempo (el dato mide cuánto, no por qué)", "Riesgo de que la deuda se vuelva incobrable (no hay historial de mora)"],
  };

  // TAREA 3 — el universo: los clientes citados, rankeados por la MISMA clave que mesaFlujo.js (vencido
  // descendente, saldo pendiente como desempate — `buildMesaFlujo`, líneas 231/392).
  _declararUniverso(entrega, I, {
    id: "cobranza_prioridad", eje: "cliente", top: { metrica: "saldo_vencido", k: idsSeg ? 2 : 1, direccion: "mayor" },
    periodo: periodo ? periodo.tipo : null, entidades: [topEntidad, ...(segundoEntidad ? [segundoEntidad] : [])],
  });

  entrega.procedencia = { libro, cifrasImpresas };

  // CORTE 3e (owner 2026-09-26) — «¿Quién le debe más?» → «¿Quién le debe más a la empresa?»: «le» sin sujeto
  // explícito es ambiguo entre «a usted» y «a la empresa»; con el sujeto explícito, tercera persona sin ambigüedad.
  const texto = _textoDeLaEntrega(entrega, "¿Quién le debe más a la empresa?");
  return { texto, entrega, libro, ok: true, motivo: "" };
}

/** componerEntregaInventario({ scenario, pregunta }) → { texto, entrega, libro, ok, motivo }
 *  TERCERA RUTA (plan §1, TAREA 2 del incremento 3, owner 2026-09-23) — «¿tengo demasiado inventario?», sobre
 *  la MISMA evidencia del playbook `inventario-inmovilizado` (asesoria.js: `inventoryStatus{focus:"frenado"}`,
 *  la Mesa Capital) — mismo molde que las dos rutas anteriores: boleta real → libro de hechos verificado →
 *  Entrega → texto.
 *
 *  QUÉ NO GENERALIZABA TAL CUAL (mismo espíritu que la nota de `componerEntregaCobranza` — documentado, no
 *  escondido):
 *   1. `asesoria.js` tampoco exporta una lectura pura reusable (nota 1 de la ruta de cobranza): su
 *      `inventarioInmovilizado.componer()` es un armador de PROSA, no datos estructurados. Acá se lee la boleta
 *      con los MISMOS patrones «Entidad · Concepto» que el propio playbook ya usa (`_find`/`_all`), y además —
 *      a diferencia de cobranza— `result.facts.inventory.{byBodega,bySku}` YA vienen estructurados (sin prosa
 *      que parsear), así que la selección de "el mayor SKU" sale de ahí, no de ordenar figs a mano.
 *   2. EL PERÍODO SÍ SE PUDO REUSAR TAL CUAL (a diferencia de cobranza en el incremento anterior): el universo
 *      `inventario` (figureType.js) YA declaraba `periodo: "hoy"` correctamente ANTES de este incremento —
 *      medido con `_sonda_inventario_boleta.mjs` sobre las 36 figs reales de esta ruta: TODAS salen tipadas
 *      `inventario` / `tasa_inventario` / `dias_inventario` / `rotacion`, todas con `periodo: "hoy"`. No hubo
 *      que declarar nada nuevo en el contrato — `_periodoDelMarco` (TAREA 1 del incremento anterior) generaliza
 *      sin tocarla.
 *   3. LA LEY DURA DEL PROYECTO — «venta comercial e inventario NUNCA se suman» — se aplica leyendo
 *      `reconcilian("inventario","venta_comercial")` (declarado en el contrato, no una constante nueva acá) y
 *      declarándolo como límite: esta Entrega NUNCA construye una cifra que cruce los dos universos (ninguna
 *      "cobertura" ni "días de venta del stock" calculada de contribución/venta sobre este capital).
 *   4. El límite de transferencia entre bodegas (`facts.limite_transferencia`, `inventoryStatus` en
 *      toolRegistry.js) se reusa TAL CUAL — `cap.motivo`/`cap.faltante` son el texto que el owner ya selló para
 *      la cara Capital (capability.js): no se redacta una frase nueva para decir lo mismo. */
export function componerEntregaInventario({ scenario = ESCENARIO_INICIAL, pregunta = PREGUNTA_INVENTARIO, conocimientoActivo = undefined, conocimientoCatalogo = undefined } = {}) {
  // 1 · LA BOLETA — TRES focos del MISMO tool, en UN plan (un solo `runPlan`, un solo ledger: la migración de
  // significado de «frenado» — owner 2026-09-28, §7.3·30-34, etapa 5, diseño §4.3 — exige los tres universos en
  // la misma Entrega: inmovilizado crítico (por SKU, con días/rotación — el playbook `inventario-inmovilizado`
  // ya lo certifica), inmovilizado ∪ (crítico ⊎ sobrestock, con SU fig por SKU) y venta frenada (el hecho SIEMPRE;
  // el veredicto SOLO con umbral publicado — `specRetrieval.js` focus "stale", etapa 4). Los tres comparten
  // tenant+escenario: la MISMA jerarquía (`J`, `evidence.inventory.jerarquia`) viaja en los tres resultados.
  const rp = runPlan(
    { intent: "answer", calls: [
      { tool: "inventoryStatus", args: { focus: "frenado" } },
      { tool: "inventoryStatus", args: { focus: "inmovilizado" } },
      { tool: "inventoryStatus", args: { focus: "stale" } },
    ] },
    { scenario, maxCalls: 8, preguntaUsuario: pregunta, registry: cajaDelAgente(TOOLS) },
  );
  const figs = asignarIds((rp.ledger && rp.ledger.figs) || []);
  if (!figs.length) return _vacia("sin boleta: el motor no produjo cifras para esta pregunta con los datos activos");

  // 2 · EL ÍNDICE DE EVIDENCIA — el mismo helper que las demás rutas
  const { I, ejesDelTenant } = _indiceDelTenant(figs, scenario);

  // 3 · LA LECTURA — `facts.inventory` YA viene estructurado; `jerarquia` es la MISMA que ya pinta la Mesa Capital
  // (mesaCapital.js) y sirve el foco `inmovilizado` (specRetrieval.js) — una sola verdad, sin recalcular nada acá.
  const rCritico = rp.results[0], rInmov = rp.results[1], rFrenado = rp.results[2];
  const invCritico = rCritico && rCritico.facts && rCritico.facts.inventory;
  const invUnion = rInmov && rInmov.facts && rInmov.facts.inventory;
  const J = (invUnion && invUnion.jerarquia) || (invCritico && invCritico.jerarquia) || null;
  const figTotalInmov = _find(figs, /^Capital inmovilizado · total$/i);
  if (!J || !invUnion || !figTotalInmov || !J.inmovilizado || !J.inmovilizado.n) return _vacia("sin evidencia suficiente: no hay capital inmovilizado en los datos activos");
  const figCriticoSub = _find(figs, /^Capital inmovilizado cr[ií]tico · subtotal$/i);
  const figSobrestockSub = _find(figs, /^Sobrestock · subtotal$/i);
  // el top-2 «por qué / qué hacer» sigue viniendo del tramo CRÍTICO (con días/rotación — el hecho que explica la
  // recomendación); el sobrestock no tiene ese relato (rota, solo que de más).
  const byCritico = Array.isArray(invCritico && invCritico.bySku) ? [...invCritico.bySku].sort((a, b) => (b.usd || 0) - (a.usd || 0)) : [];
  /* FAMILIA 1: quién va primero (el mayor SKU crítico) lo decide la pieza por el capital inmovilizado crítico; el inventario trae los SKU y sus montos */
  const _primeroCritico = byCritico.length ? primeroPorMedida({ tema: "inventario", claveOrden: "capital_frenado", entidades: byCritico.map((x) => x.sku), valorDe: (n) => { const x = byCritico.find((y) => y.sku === n); return x ? (x.usd || 0) : NaN; } }) : null;
  const topSku = byCritico.find((x) => x.sku === _primeroCritico) || byCritico[0] || null;
  const segundoSku = byCritico.find((x) => x !== topSku) || null;

  const figSkuCritico = (sku) => _find(figs, new RegExp(`^${_esc(sku)} · Capital inmovilizado cr[ií]tico$`, "i"));
  const figSkuInmov = (sku) => _find(figs, new RegExp(`^${_esc(sku)} · capital inmovilizado$`, "i"));
  const figSkuDias = (sku) => _find(figs, new RegExp(`^${_esc(sku)} · D[ií]as de inventario$`, "i"));
  const figSkuRot = (sku) => _find(figs, new RegExp(`^${_esc(sku)} · Rotaci[oó]n$`, "i"));
  const figSano = _find(figs, /^Estado del inventario: capital sano$/i);
  const figQuiebre = _find(figs, /^Estado del inventario: riesgo de quiebre$/i);
  const figUmbralPct = _find(figs, /^Umbral de materialidad · % de la venta$/i);
  const figUmbralUsd = _find(figs, /^Umbral de materialidad · en dinero$/i);
  // «FRENADO» (venta interrumpida) — figs del foco `stale`: con umbral evaluado y ≥1 SKU, viene boleta completa
  // (total + por SKU); sin umbral, o con umbral y cero SKU, la tool declina con facts=null (el hecho igual se
  // declara con J, más abajo — sin fig que citar como «ref», nunca inventado).
  const invFrenado = rFrenado && rFrenado.facts && rFrenado.facts.inventory;
  const figFrenadoTotal = _find(figs, /^Venta frenada · total$/i);

  // 4 · EL LIBRO DE HECHOS — mismo mecanismo que las demás rutas
  const hechos = [];
  const contador = { n: 0 };
  const figsUsadas = [];
  const ref = (fig) => { if (fig) figsUsadas.push(fig); return _declararRef(hechos, contador, fig); };
  // «la suma de N SKU» (mecanismo 6 del plan: la tentación precalculada) — para la intersección medida (§4.3):
  // un solo SKU se cita directo (su propia fig), dos o más se declaran como `derivada` (suma) sobre sus refs.
  const _sumaDeSkus = (skus, buscador) => {
    const ids = (skus || []).map((s) => { const f = buscador(s); return f ? ref(f) : null; }).filter(Boolean);
    if (!ids.length) return null;
    if (ids.length === 1) return ids[0];
    const id = `e${++contador.n}`; hechos.push({ id, tipo: "derivada", op: "suma", de: ids }); return id;
  };

  const idTotal = ref(figTotalInmov);
  const idCritico = figCriticoSub ? ref(figCriticoSub) : null;
  const idSobrestock = figSobrestockSub ? ref(figSobrestockSub) : null;
  const idSano = figSano ? ref(figSano) : null;
  const idQuiebre = figQuiebre ? ref(figQuiebre) : null;
  const idUmbralPct = figUmbralPct ? ref(figUmbralPct) : null;
  const idUmbralUsd = figUmbralUsd ? ref(figUmbralUsd) : null;
  const _declararSku = (s) => ({ monto: ref(figSkuCritico(s.sku)), dias: (() => { const f = figSkuDias(s.sku); return f ? ref(f) : null; })(), rot: (() => { const f = figSkuRot(s.sku); return f ? ref(f) : null; })() });
  const idsTop = topSku ? _declararSku(topSku) : null;
  const idsSeg = segundoSku ? _declararSku(segundoSku) : null;

  // la tentación precalculada: la participación del mayor SKU sobre el total inmovilizado crítico
  let idShare = null;
  if (idsTop && idsTop.monto && idCritico) { idShare = (() => { const id = `e${++contador.n}`; hechos.push({ id, tipo: "razon", num: { id: idsTop.monto }, den: { id: idCritico }, forma: "pct" }); return id; })(); }

  // LA INTERSECCIÓN MEDIDA, SOLO CON UMBRAL (diseño §4.3): «de los $X inmovilizados, $Y tienen además la venta
  // frenada» — Y es la SUMA de las cifras individuales de cada SKU que está en los dos conjuntos a la vez (nunca
  // se asume contención; `J.interseccion` la mide). Sin umbral publicado, `J.interseccion` es `null` y nada de
  // este bloque se declara.
  const idFrenadoTotal = figFrenadoTotal ? ref(figFrenadoTotal) : null;
  let idInterseccion = null, idInmovNoFrenado = null, idFrenadoNoInmov = null;
  if (J.frenado.evaluado && J.interseccion) {
    if (J.interseccion.frenadoEInmovilizado.n) idInterseccion = _sumaDeSkus(J.interseccion.frenadoEInmovilizado.skus, figSkuInmov);
    if (J.interseccion.inmovilizadoNoFrenado.n) idInmovNoFrenado = _sumaDeSkus(J.interseccion.inmovilizadoNoFrenado.skus, figSkuInmov);
    if (J.interseccion.frenadoNoInmovilizado.n) idFrenadoNoInmov = _sumaDeSkus(J.interseccion.frenadoNoInmovilizado.skus, figSkuInmov);
  }

  const libro = libroDeHechos(hechos, { indice: I });
  const rotos = libro.hechos.filter((h) => !h.ok);
  if (rotos.length) return { texto: "", entrega: null, libro, ok: false, motivo: `${rotos.length} hecho(s) no verificaron: ${rotos.map((h) => `${h.id} (${h.motivo})`).join(" · ")}` };

  // 5 · LA ENTREGA
  const entrega = crearEntrega();
  const cifrasImpresas = [];
  const R = (id) => { const v = renderDe(libro, id); if (v != null) cifrasImpresas.push(v); return v; };

  // EL PERÍODO — SÍ se reusa `_periodoDelMarco`: el universo `inventario` ya declara "hoy".
  const nBodegas = ejesDelTenant.bodega ? ejesDelTenant.bodega.length : null;
  const { periodo, faltaRango } = _periodoDelMarco(figsUsadas);
  const { empresaNombre, perfil } = _identidadDelTenant();
  // LA PROCEDENCIA DEL CRITERIO (diseño §4.3, «Frase de procedencia», impresa UNA vez en el Marco): si los tres
  // umbrales del detector comparten origen, una sola etiqueta; si no, se nombran por separado. Números de `J`
  // directos (no un hecho del libro): es la definición del criterio, como ya lo era la glosa vieja — un
  // «definiciones» descriptivo, no una afirmación que el Notario tenga que verificar cifra por cifra.
  // SIN CIFRAS DESNUDAS (regla 1 del plan, `entrega/verificar.js`): este párrafo es descriptivo (la definición del
  // criterio), nunca una afirmación con números propios — los números de `J` NO se imprimen acá (quedarían sin
  // hecho que los respalde); se nombran en palabras. Las cifras del criterio SÍ se imprimen, con su hecho, en la
  // tabla de cifras y en `entrega.marco.referenciaDeclarada` (umbral de materialidad) cuando corresponde.
  const _origRot = J.umbrales.rotacionMin.origen, _origDoh = J.umbrales.dohMax.origen, _origSob = J.umbrales.sobrestockDohMin.origen;
  const _procedenciaCriterio = (_origRot === _origDoh && _origDoh === _origSob)
    ? ETIQUETA_ORIGEN[_origRot]
    : `piso de rotación y techo de días de inventario ${ETIQUETA_ORIGEN[_origRot]}; umbral de sobrestock, ${ETIQUETA_ORIGEN[_origSob]}`;
  const _definiciones = [
    `Inmovilizado = capital cuya rotación está bajo el piso declarado o cuyos días de inventario superan el techo declarado (inmovilizado crítico), o entre el umbral de sobrestock y ese techo (sobrestock). Criterio de inventario: ${_procedenciaCriterio}.`,
    "El capital inmovilizado no se suma ni se compara con la venta comercial: son universos distintos (ver «Lo que no se puede concluir»).",
  ];
  if (J.frenado.evaluado) {
    _definiciones.push(`Venta frenada = días sin venta sobre el umbral declarado, ${ETIQUETA_ORIGEN[J.frenado.umbral.origen]}${J.frenado.n ? "" : " — ningún SKU la cumple hoy"}.`);
  } else {
    _definiciones.push("Venta frenada: la empresa no ha declarado a partir de cuántos días sin venta considera frenada la venta de un producto — esa condición queda sin evaluar (ver «Lo que no se puede concluir»).");
  }
  entrega.marco = {
    empresa: empresaNombre,
    periodo,
    universo: nBodegas != null ? `${J.inmovilizado.n} SKU inmovilizados en ${nBodegas} bodegas` : `${J.inmovilizado.n} SKU inmovilizados`,
    moneda: "$",
    definiciones: _definiciones,
    referenciaDeclarada: (idUmbralPct && idUmbralUsd)
      // A8 (diagnóstico v12, §7.3·36b): el origen sale del helper único (`procedenciaDeUmbral`), nunca «declarado por la empresa» a
      // ciegas — el umbral de materialidad puede ser el criterio general de ADI (y entonces NO es «de la empresa»).
      ? { texto: textoDeUmbralDeMaterialidad(R(idUmbralPct), R(idUmbralUsd)), hechoId: idUmbralPct }   /* FAMILIA 3: la frase del piso de materialidad con su origen es de `referencias.js` */
      : null,
    perfil,
  };
  if (nBodegas != null) cifrasImpresas.push(`${J.inmovilizado.n} SKU inmovilizados en ${nBodegas} bodegas`); else cifrasImpresas.push(`${J.inmovilizado.n} SKU inmovilizados`);
  if (periodo && periodo.texto) cifrasImpresas.push(periodo.texto);

  // ── RESPUESTA ──
  const respuesta = [];
  {
    // LA APERTURA (diseño §4.3): cifra + dueño + significado, en una sola oración — inmovilizado (∪), con su
    // partición crítico/sobrestock cuando la hay.
    const vTotal = R(idTotal);
    const vCritico = idCritico ? R(idCritico) : null, vSobrestock = idSobrestock ? R(idSobrestock) : null;
    const partes = [vCritico ? `${vCritico} en ${J.critico.n} SKU crítico${J.critico.n === 1 ? "" : "s"} que no rota${J.critico.n === 1 ? "" : "n"}` : null, vSobrestock ? `${vSobrestock} en ${J.sobrestock.n} SKU con sobrestock` : null].filter(Boolean);
    const texto = `La empresa tiene ${vTotal} de capital inmovilizado en ${J.inmovilizado.n} SKU${partes.length ? `: ${partes.join(" y ")}` : ""}.`;
    respuesta.push({ texto, hechos: [idTotal, idCritico, idSobrestock].filter(Boolean) });
  }
  if (idsTop) {
    const vMonto = R(idsTop.monto), vDias = idsTop.dias ? R(idsTop.dias) : null, vRot = idsTop.rot ? R(idsTop.rot) : null;
    const extra = [vDias ? `${vDias} de inventario` : null, vRot ? `rotación ${vRot}` : null].filter(Boolean).join(" · ");
    const texto = `El mayor SKU crítico es ${topSku.sku}: ${vMonto} inmovilizados${extra ? ` (${extra})` : ""}.`;
    respuesta.push({ texto, hechos: [idsTop.monto, idsTop.dias, idsTop.rot].filter(Boolean) });
  }
  if (idsSeg) {
    const vMonto = R(idsSeg.monto), vDias = idsSeg.dias ? R(idsSeg.dias) : null;
    const texto = `El segundo es ${segundoSku.sku}: ${vMonto} inmovilizados${vDias ? `, ${vDias} de inventario` : ""}.`;
    respuesta.push({ texto, hechos: [idsSeg.monto, idsSeg.dias].filter(Boolean) });
  }
  if (idSano || idQuiebre) {
    const partes = [idSano ? `${R(idSano)} está sano` : null, idQuiebre ? `${R(idQuiebre)} en riesgo de quiebre` : null].filter(Boolean);
    const texto = `Del resto del inventario, ${partes.join(", ")} — estados independientes, no la causa del capital inmovilizado.`;
    respuesta.push({ texto, hechos: [idSano, idQuiebre].filter(Boolean) });
  }
  // FRENADO CON UMBRAL (diseño §4.3) — solo si la empresa (o la consulta) lo declaró.
  if (J.frenado.evaluado && J.frenado.n) {
    const _proc = ETIQUETA_ORIGEN[J.frenado.umbral.origen];
    if (idInterseccion) {
      const vInter = R(idInterseccion);
      const texto = `De los ${R(idTotal)} inmovilizados, ${vInter} tienen además la venta frenada: ${J.interseccion.frenadoEInmovilizado.n} SKU con más de ${J.frenado.umbral.valor} días sin venta (${_proc}).`;
      respuesta.push({ texto, hechos: [idTotal, idInterseccion].filter(Boolean) });
      if (idInmovNoFrenado || idFrenadoNoInmov) {
        const p2 = [idInmovNoFrenado ? `${R(idInmovNoFrenado)} en ${J.interseccion.inmovilizadoNoFrenado.n} SKU están inmovilizados pero siguen vendiendo` : null, idFrenadoNoInmov ? `${R(idFrenadoNoInmov)} en ${J.interseccion.frenadoNoInmovilizado.n} SKU tienen la venta frenada sin estar inmovilizados` : null].filter(Boolean);
        respuesta.push({ texto: `${p2.join("; ")}.`, hechos: [idInmovNoFrenado, idFrenadoNoInmov].filter(Boolean) });
      }
    } else if (idFrenadoTotal) {
      const texto = `Con el umbral de ${J.frenado.umbral.valor} días (${_proc}), ${J.frenado.n} SKU tienen la venta frenada por ${R(idFrenadoTotal)}; ninguno de ellos está además inmovilizado.`;
      respuesta.push({ texto, hechos: [idFrenadoTotal] });
    }
  }
  {
    const pShare = idShare ? R(idShare) : null;
    const texto = idsTop
      ? `Prioridad del procedimiento, por mayor capital inmovilizado crítico: abrir primero ${topSku.sku}${pShare ? `, el ${pShare} del total crítico` : ""}.`
      : "Prioridad del procedimiento: sin SKU crítico, el inmovilizado de hoy es todo sobrestock — sigue rotando, sin acción de liquidación urgente.";
    respuesta.push({ texto, hechos: idsTop ? [idsTop.monto, idShare].filter(Boolean) : [], _prioridad: marcaDePrioridad(ALCANCE_DE_PRIORIDAD.DOMINIO, idsTop ? topSku.sku : null) });
  }
  entrega.respuesta = respuesta;

  // ── CIFRAS · una fila por SKU crítico (con evidencia de días/rotación), más el total ∪ (mecanismo 2: dueño +
  // cuánto + con qué evidencia, en la misma fila) — tabla de §4.3: SKU · Bodega · Capital · Situación · Días de
  // inventario · Rotación · (Venta si hay umbral evaluado). ──
  const _cCapital = _RC("capital_inmovilizado"), _cDias = _RC("dias_inventario"), _cRot = _RC("rotacion");   /* FAMILIA 4: encabezados = rótulos del léxico */
  entrega.cifras.columnas = ["SKU", "Bodega", _cCapital, "Situación", _cDias, _cRot, "Tipo"];
  const _filaSku = (s, ids, situacion) => {
    const hechosFila = [ids.monto, ids.dias, ids.rot].filter(Boolean);
    const procedencia = _procedenciaDeFila(libro, hechosFila);
    return {
      valores: { SKU: s.sku, Bodega: s.bodega || "—", [_cCapital]: R(ids.monto), Situación: situacion, [_cDias]: ids.dias ? R(ids.dias) : "—", [_cRot]: ids.rot ? R(ids.rot) : "—", Tipo: _textoDeTipo(procedencia) },
      hechos: hechosFila,
      procedencia,
    };
  };
  if (idsTop) entrega.cifras.filas.push(_filaSku(topSku, idsTop, "Crítico"));
  if (idsSeg) entrega.cifras.filas.push(_filaSku(segundoSku, idsSeg, "Crítico"));
  { const procedencia = _procedenciaDeFila(libro, [idTotal]); entrega.cifras.filas.push({
    valores: { SKU: `Total (${J.inmovilizado.n} SKU inmovilizados)`, Bodega: "", [_cCapital]: R(idTotal), Situación: "", [_cDias]: "", [_cRot]: "", Tipo: _textoDeTipo(procedencia, { subtotal: true }) },
    hechos: [idTotal],
    procedencia,
  }); }

  // ── LO QUE NO SE PUEDE CONCLUIR ──
  const _cruce = reconcilian("inventario", "venta_comercial");
  entrega.limites = [];
  if (_cruce.estado !== "reconciled") {
    entrega.limites.push({ titulo: "El capital inmovilizado y la venta comercial son universos distintos", motivo: "El inventario se mide en una escala y una moneda propias, y no reconcilia con la venta comercial (contrato de datos declarado): nunca se suman ni se comparan directamente en esta Entrega." });
  }
  entrega.limites.push({ titulo: "La causa de que cada SKU esté inmovilizado no está en los datos", motivo: "Esta lectura localiza cuánto capital y en qué SKU está inmovilizado, no explica por qué — no hay historial de compras, lead time de proveedor ni causa de la detención en este dato." });
  // LÍMITE «SIN EVALUAR» (diseño §4.3, con el ofrecimiento — NUNCA «no hay SKU frenados»): la empresa no declaró
  // el umbral de venta frenada. El hecho (días sin venta) igual está en la tabla de la Mesa Capital.
  if (!J.frenado.evaluado) {
    // SIN CIFRAS DESNUDAS: el ofrecimiento no imprime días de ejemplo (60/90) sin un hecho que los respalde —
    // se ofrece el mecanismo, no un número propuesto por esta Entrega.
    entrega.limites.push({ titulo: "Venta frenada: sin evaluar", motivo: "La empresa no ha declarado a partir de cuántos días sin venta considera frenada la venta. Los días sin venta de cada SKU están en la pestaña de inventario; si se indica un umbral en días, se puede evaluar cuáles lo superan y cuánto capital reúnen." });
  }
  const lt = rInmov && rInmov.facts && rInmov.facts.limite_transferencia;
  if (lt && lt.evaluable === false) {
    // `lt.motivo`/`lt.faltante` son el texto que el owner ya selló para la cara Capital (capability.js) — se
    // reusan verbatim; solo se capitaliza `faltante` al pegarlo después de un punto (es una cláusula suelta en
    // minúscula en su fuente, pensada para completar una oración, no para abrir una nueva).
    const _falt = typeof lt.faltante === "string" && lt.faltante ? lt.faltante.charAt(0).toUpperCase() + lt.faltante.slice(1) : null;
    entrega.limites.push({ titulo: "Mover stock entre bodegas queda sin evidencia para evaluarlo", motivo: [lt.motivo, _falt].filter(Boolean).join(" ") });
  }
  entrega.limites.push(_limiteDeAusencia("conocimiento_sector_inventario"));
  if (faltaRango) entrega.limites.push({ titulo: "El período no declara una fecha de corte para el inventario", motivo: "El dato confirma que es una foto de inventario a hoy, pero el pack no trae una fecha de corte declarada para este universo — a diferencia de la cobranza, que sí la declara (flujoComercial.fechaCorte). No se afirma una fecha." });
  { const lp = _limitePerfilIncompleto(perfil); if (lp) entrega.limites.push(lp); }

  // ── REFERENCIA DEL OFICIO · eje SKU: no hay cuentas que el usuario pueda nombrar en la pregunta para este eje,
  // `entidadesDeLaPregunta` queda vacío (comportamiento de siempre) ──
  const _refOficio3 = referenciaDelOficioConOfertas({ perfil, pregunta, entidadesEnRespuesta: [topSku ? topSku.sku : null, segundoSku ? segundoSku.sku : null].filter(Boolean), entidadesDeLaPregunta: _entidadesDeLaPregunta(pregunta), scenario, activo: conocimientoActivo, catalogo: conocimientoCatalogo });
  entrega.referenciaDelOficio = _refOficio3.salida;
  _coherenciaConLaCapa(entrega, { conocimientoActivo, perfil });

  // ── PARA SU JUICIO · la MISMA pregunta que ya certifica el playbook (asesoria.js) — no se redacta una nueva ──
  entrega.paraSuJuicio = topSku ? [_preguntaAbiertaInventario(topSku.sku, perfil)].filter(Boolean) : [];

  // ── QUÉ MÁS PUEDO CALCULAR ──
  entrega.queMasPuedoCalcular = {
    puedo: [`${_RC("capital_inmovilizado")} por bodega`, `${_RC("capital")} por familia y marca`, "Detalle de riesgo de quiebre y sobrestock", "Simular el efecto de liberar los SKU inmovilizados", ..._ofertasTexto(_refOficio3.ofertas)],
    noPuedo: ["Por qué cada SKU quedó inmovilizado (no hay historial de compras ni causa declarada)", "Si conviene transferir stock entre bodegas (ningún SKU está en más de una)"],
  };

  // el universo: los SKU críticos citados, rankeados por capital inmovilizado crítico descendente.
  if (topSku) {
    _declararUniverso(entrega, I, {
      id: "inventario_prioridad", eje: "sku", top: { metrica: "capital_frenado", k: idsSeg ? 2 : 1, direccion: "mayor" },
      periodo: periodo ? periodo.tipo : null, entidades: [topSku.sku, ...(segundoSku ? [segundoSku.sku] : [])],
    });
  }

  entrega.procedencia = { libro, cifrasImpresas };

  const texto = _textoDeLaEntrega(entrega, "¿Tiene la empresa demasiado inventario?");
  return { texto, entrega, libro, ok: true, motivo: "" };
}

/* ── vocabulario de presentación de los tres dominios (owner 2026-09-23, TAREA 3) — SOLO nombres y la forma
 * corta del marco que cada universo YA declara (figureType.UNIVERSOS); no es una segunda declaración de qué es
 * cada dominio, es cómo se nombra el que `partesDelEncargo.js`/`contratoDeDominios.js` ya reconocen. ── */
const _DOM_UNIVERSO = { comercial: "venta_comercial", inventario: "inventario", cobranza: "cobranza" };
const _DOM_NOMBRE = { comercial: "comercial", inventario: "inventario", cobranza: "cobranza" };
const _MARCO_CORTO = { anual: "año cerrado", hoy: "foto a hoy" };

/** componerEntregaMultidominio({ scenario, pregunta }) → { texto, entrega, libro, ok, motivo, partes, dominios }
 *  CUARTA RUTA (plan §1, TAREA 3 del incremento 3, owner 2026-09-23) — LA IMPORTANTE: el encargo multidominio,
 *  «¿qué debería preocuparme primero?» sobre un negocio completo (comercial + inventario + cobranza). Es la
 *  prueba de fuego porque cruza los tres dominios y cierra con UNA prioridad.
 *
 *  QUÉ SE REUSA, TEXTUAL (no se reescribe ninguna decisión de producto):
 *   · `partesDelEncargo.js` (`partesDelEncargo`/`dominiosDelEncargo`) — LA hoja que dice qué pide el encargo y en
 *     qué dominios cae. Es la MISMA que ya cobra `encargoCompuesto.js` y el contrato de dominios: una regla, un
 *     archivo. Este compositor no decide por su cuenta qué es "un dominio pedido".
 *   · `contratoDeDominios.js` (`pasosDeDominios`) — la realidad COMPLETA de cada dominio (los mismos pasos que
 *     ya corre el ensamblador para el cierre integrado), un dominio a la vez (el tope de 8 llamadas por ronda se
 *     agotaría si se pidieran los tres juntos — el mismo motivo que documenta `componerEncargo` en
 *     `encargoCompuesto.js`).
 *   · `prioridadIntegrada.js` (`prioridadIntegrada`) — LA prioridad: materialidad + severidad + urgencia por
 *     dominio, señal por señal entre dominios, nunca por suma de montos. **No se escribe otra prioridad acá**:
 *     este módulo solo selecciona QUÉ señales de la que YA calculó `prioridadIntegrada` se citan y las declara en
 *     el libro de hechos de la Entrega — el mismo patrón que las otras tres rutas aplican sobre
 *     `lecturaDeMargen`/`prioridadDe`/`facts.inventory`.
 *
 *  LA COBERTURA ES UN CANDADO NUEVO (no solo una convención de esta ruta): `verificar.js` ahora acepta un
 *  tercer argumento `partes` y, si viene, corre `coberturaDelEncargo` (`partesDelEncargo.js`) — la Entrega se
 *  pone roja si el texto servido no cubre alguna parte pedida. Este compositor pasa sus `partes` al llamador
 *  (`_entrega_gate.mjs` las reenvía a `verificarEntrega`) en vez de verificarse a sí mismo: la regla vive en el
 *  verificador, no en cada compositor.
 *
 *  NUNCA SE SUMAN DOS UNIVERSOS: no hay un solo hecho `derivada` con `op:"suma"` que cruce dominios en este
 *  archivo — la única tentación precalculada (mecanismo 6) es DENTRO de cobranza (participación del líder sobre
 *  el vencido total de LA MISMA cartera). Y aunque alguna vez se declarara una, `notario/hechos.js` la rechaza
 *  de raíz (`_derivada`, «dominios-distintos») — ver la carnada 3.e en `_entrega_gate.mjs`. */
export function componerEntregaMultidominio({ scenario = ESCENARIO_INICIAL, pregunta = PREGUNTA_MULTIDOMINIO, conocimientoActivo = undefined, conocimientoCatalogo = undefined } = {}) {
  // 1 · QUÉ PIDE EL ENCARGO — la misma hoja que ya cobra el contrato de dominios
  const partes = partesDelEncargo(pregunta);
  if (partes.length < 2) return _vacia("no es un encargo multidominio: la pregunta no pide dos o más partes");
  const dominios = dominiosDelEncargo(partes);
  if (dominios.length < 2) return _vacia("no es un encargo multidominio: pide un solo dominio");

  // 2 · LA REALIDAD DE CADA DOMINIO — un dominio a la vez (nota 2 de arriba)
  let figsRaw = [];
  for (const d of dominios) {
    const pasos = pasosDeDominios({ dominios: [d], eje: null });
    if (!pasos.length) continue;
    const rp = runPlan(
      { intent: "answer", calls: pasos.map((p) => ({ tool: p.tool, args: p.args })) },
      { scenario, maxCalls: 8, preguntaUsuario: pregunta, registry: cajaDelAgente(TOOLS) },
    );
    figsRaw = figsRaw.concat((rp.ledger && rp.ledger.figs) || []);
  }
  const figs = asignarIds(figsRaw);
  if (!figs.length) return _vacia("sin boleta: el motor no produjo cifras para esta pregunta con los datos activos");

  // 3 · LA PRIORIDAD INTEGRADA — la misma función que ya certifica el agente (nota 3 de arriba)
  const { P, top } = prioridadCruzada(figs, dominios);   /* FAMILIA 1: quién va primero entre dominios lo pregunta la pieza */
  if (!P || !Object.keys(P.porDominio).length) return _vacia("sin evidencia suficiente: no se pudo calcular la prioridad integrada de estos dominios");

  const { I } = _indiceDelTenant(figs, scenario);   // `ejesDelTenant` no se usa acá: el universo del Marco se dice en dominios, no en un eje

  // 4 · EL LIBRO DE HECHOS — cada señal que la Respuesta cita se declara y se verifica ACÁ, igual que las otras
  // tres rutas; y cada (dominio, entidad) citada se acumula en `filasMap` para la doble colocación (regla 3 del
  // verificador: toda cifra de un cliente/SKU citada en Respuesta tiene que reaparecer en Cifras)
  const hechos = [];
  const contador = { n: 0 };
  const figsUsadas = [];
  const ref = (fig) => { if (fig) figsUsadas.push(fig); return _declararRef(hechos, contador, fig); };
  const figSenal = (entidad, rotulo) => _find(figs, new RegExp(`^${_esc(entidad)} · ${_esc(rotulo)}$`, "i"));

  const filasMap = new Map();   // "dominio::entidad" -> { dominio, entidad, materialidad, severidad, urgencia (ids) }
  const _fila = (dominio, entidad) => { const k = `${dominio}::${entidad}`; if (!filasMap.has(k)) filasMap.set(k, { dominio, entidad, materialidad: null, severidad: null, urgencia: null }); return filasMap.get(k); };
  /* UNA SOLA CACHÉ DE HECHOS POR (dominio, entidad, lente) (owner 2026-09-23, corrección medida con
   * `verificarEntrega`: la primera versión creaba un `ref` NUEVO cada vez que una misma señal se citaba dos
   * veces —una vez para el líder/la integrada, otra para el «versus»— y la regla 3 (doble-colocación) solo veía
   * el primero en `filasMap`, así que el segundo id nunca aparecía en Cifras aunque fuera la MISMA fig). Ahora
   * toda cita de la misma señal devuelve el MISMO id, y por construcción cae en la MISMA fila de Cifras. */
  const idsPorClave = new Map();
  const refSenal = (dominio, entidad, lente, rotulo) => {
    const k = `${dominio}::${entidad}::${lente}`;
    if (idsPorClave.has(k)) return idsPorClave.get(k);
    const id = ref(figSenal(entidad, rotulo));
    idsPorClave.set(k, id);
    const fila = _fila(dominio, entidad);
    fila[lente] = fila[lente] || id;
    return id;
  };
  const declararSenales = (dominio, x) => {
    const ids = {};
    for (const lente of ["materialidad", "severidad", "urgencia"]) { if (x[lente]) ids[lente] = refSenal(dominio, x.entidad, lente, x[lente].rotulo); }
    return ids;
  };

  const lideres = {};
  { const _lid = lideresPorDominio(P); for (const d of Object.keys(_lid)) lideres[d] = { x: _lid[d], ids: declararSenales(d, _lid[d]) }; }   /* FAMILIA 1: el líder de cada dominio lo decide la pieza */

  // la tentación precalculada (mecanismo 6): DENTRO de cobranza — nunca cruzando dominios
  let idShare = null;
  if (lideres.cobranza && lideres.cobranza.ids.materialidad) {
    const figVencidoTotal = _find(figs, /^Saldo vencido · total$/i);
    if (figVencidoTotal) {
      const idTotal = ref(figVencidoTotal);
      idShare = (() => { const id = `e${++contador.n}`; hechos.push({ id, tipo: "razon", num: { id: lideres.cobranza.ids.materialidad }, den: { id: idTotal }, forma: "pct" }); return id; })();
    }
  }

  // la cuenta integrada #1 y su «versus» contra la siguiente — señal por señal, tal como lo calculó prioridadIntegrada
  let idsIntegrada = null, idsVersus = null;
  if (top) {
    idsIntegrada = {};
    for (const d of Object.keys(top.senales)) idsIntegrada[d] = declararSenales(d, top.senales[d]);
    if (top.versus && Array.isArray(top.versus.gana) && top.versus.gana.length) {
      idsVersus = [];
      for (const it of top.versus.gana.slice(0, 3)) {
        const idA = refSenal(it.dominio, top.entidad, it.lente, it.metrica);
        const idB = refSenal(it.dominio, top.versus.contra, it.lente, it.metrica);
        idsVersus.push({ it, idA, idB });
      }
    }
  }

  // la referencia declarada del dominio comercial (regla 4 del verificador, «comparables-juntas»): las señales
  // de severidad comercial dicen «bajo el benchmark» (LENTES.comercial.severidad.como) — sin esto el texto
  // hablaría de benchmark sin declarar cuál es
  const idBenchComercial = dominios.includes("comercial") ? ref(figDelBenchmarkOficial(figs)) : null;   /* FAMILIA 3 */

  const libro = libroDeHechos(hechos, { indice: I });
  const rotos = libro.hechos.filter((h) => !h.ok);
  if (rotos.length) return { texto: "", entrega: null, libro, ok: false, motivo: `${rotos.length} hecho(s) no verificaron: ${rotos.map((h) => `${h.id} (${h.motivo})`).join(" · ")}` };

  // 5 · LA ENTREGA
  const entrega = crearEntrega();
  const cifrasImpresas = [];
  const R = (id) => { const v = renderDe(libro, id); if (v != null) cifrasImpresas.push(v); return v; };
  const frase = (dominio, lente, ids) => (ids && ids[lente]) ? LENTES[dominio][lente].como(R(ids[lente])) : null;

  const domTxt = dominios.map((d) => _DOM_NOMBRE[d]).join(", ").replace(/, ([^,]*)$/, " y $1");
  const { periodo, faltaRango } = _periodoDelMarco(figsUsadas);
  const { empresaNombre, perfil } = _identidadDelTenant();
  entrega.marco = {
    empresa: empresaNombre,
    periodo,
    universo: `${dominios.length} dominios (${domTxt})`,
    moneda: "$",
    definiciones: [
      "Esta Entrega cruza comercial, inventario y cobranza: cada dominio aporta su propia cifra, con su propio universo y su propio marco temporal — nunca se consolidan en un total único.",
      "La prioridad integrada compara señal por señal dentro de cada dominio y entre los dominios que comparten cliente; nunca suma montos de dominios distintos.",
    ],
    // CORTE 3e (owner 2026-09-26) — «declarado por ti» → «declarado por la empresa».
    referenciaDeclarada: idBenchComercial ? { texto: textoDeBenchmark(R(idBenchComercial), { calificador: "comercial", nota: "Inventario y cobranza no comparan contra un benchmark en este dato." }), hechoId: idBenchComercial } : null,   /* FAMILIA 3 */
    perfil,
  };
  cifrasImpresas.push(`${dominios.length} dominios (${domTxt})`);
  if (periodo && periodo.texto) cifrasImpresas.push(periodo.texto);

  // ── RESPUESTA · la prioridad integrada ES la Respuesta (instrucción del owner) ──
  const respuesta = [];
  for (const d of dominios) {
    const L = lideres[d];
    if (!L) continue;
    const partesFrase = ["materialidad", "severidad", "urgencia"].map((l) => frase(d, l, L.ids)).filter(Boolean);
    const texto = `En ${_DOM_NOMBRE[d]}, quien más pesa es ${L.x.entidad}: ${partesFrase.join(", ")}.`;
    respuesta.push({ texto, hechos: Object.values(L.ids).filter(Boolean) });
  }
  if (top && idsIntegrada) {
    const partesTop = [];
    for (const d of Object.keys(idsIntegrada)) for (const l of ["materialidad", "severidad", "urgencia"]) { const t = frase(d, l, idsIntegrada[d]); if (t) partesTop.push(`${_DOM_NOMBRE[d]}: ${t}`); }
    const coincide = top.dominios.length > 1 ? ` — coincide en ${top.dominios.map((dd) => _DOM_NOMBRE[dd]).join(" y ")}` : "";
    const texto = `Prioridad del procedimiento, por riesgo integrado: abrir primero ${top.entidad}${coincide} (${partesTop.join("; ")}).`;
    respuesta.push({ texto, hechos: Object.values(idsIntegrada).flatMap((o) => Object.values(o)).filter(Boolean), _prioridad: marcaDePrioridad(ALCANCE_DE_PRIORIDAD.CRUZADA, top.entidad) });
  }
  if (top && idsVersus && idsVersus.length) {
    const comparativos = idsVersus.map(({ it, idA, idB }) => `${it.nombre} (${R(idA)} contra ${R(idB)})`).join(", ");
    const texto = `${top.entidad} va antes que ${top.versus.contra}: es peor en ${comparativos}. Coincidir en dos dominios agrava el caso; la prioridad la deciden estas señales, no la coincidencia.`;
    respuesta.push({ texto, hechos: idsVersus.flatMap((x) => [x.idA, x.idB]).filter(Boolean) });
  }
  if (lideres.cobranza && idShare) {
    const texto = `De lo vencido en toda la cartera, ${top && top.entidad === lideres.cobranza.x.entidad ? top.entidad : lideres.cobranza.x.entidad} concentra el ${R(idShare)}.`;
    respuesta.push({ texto, hechos: [idShare] });
  }
  entrega.respuesta = respuesta.filter((r) => r.hechos.length);

  // ── CIFRAS · una fila por (dominio, entidad) citada en la Respuesta — la doble colocación (mecanismo 2) ──
  entrega.cifras.columnas = ["Dominio", "Entidad", "Materialidad", "Severidad", "Urgencia", "Marco"];
  // AGREGADO (supervisor, revisión de cierre del 3d / corte 3e, 2026-09-26) — «269d» → «269 días» en las celdas
  // de ESTA tabla (misma transformación que ya aplica el camino GENERAL a su prosa, `_desabreviarDias`, más
  // abajo en este archivo — no se comparte la función porque una vive antes de renderizar filas de esta ruta
  // fija y la otra después de renderizar prosa del camino general, ámbitos que no se cruzan). Esta ruta fija no
  // gobierna tamaño (`gobernarTamano` no la ejercita: `entrega.detalle`/`entrega.meta` quedan `null` siempre),
  // así que el «si el tope lo permite» del owner es hoy un SÍ incondicional — no hay tope de palabras que la
  // tabla de esta ruta pueda exceder por desabreviar una unidad.
  const _desabreviarDiasTabla = (t) => String(t == null ? "" : t).replace(/\b(\d+(?:[.,]\d+)?)d\b/g, (_, n) => diasEnPalabras(n));   // singular/plural de la casa (lexico.js): «1 día», «68 días»
  for (const fila of filasMap.values()) {
    const hechosFila = [fila.materialidad, fila.severidad, fila.urgencia].filter(Boolean);
    if (!hechosFila.length) continue;
    entrega.cifras.filas.push({
      valores: {
        Dominio: _DOM_NOMBRE[fila.dominio], Entidad: fila.entidad,
        Materialidad: fila.materialidad ? _desabreviarDiasTabla(R(fila.materialidad)) : "—",
        Severidad: fila.severidad ? _desabreviarDiasTabla(R(fila.severidad)) : "—",
        Urgencia: fila.urgencia ? _desabreviarDiasTabla(R(fila.urgencia)) : "—",
        Marco: _MARCO_CORTO[UNIVERSOS[_DOM_UNIVERSO[fila.dominio]].periodo] || "—",
      },
      hechos: hechosFila,
      // sin columna "Tipo" propia (esta tabla no la tenía antes de la Etapa 2): la procedencia queda como CAMPO
      // estructural, igual que las otras tres rutas — no se le agrega una columna visible nueva a una tabla ya
      // cerrada por el candado del owner sin que él lo pida.
      procedencia: _procedenciaDeFila(libro, hechosFila),
    });
  }

  // ── LO QUE NO SE PUEDE CONCLUIR ──
  entrega.limites = [
    { titulo: "Los tres dominios no se consolidan en un total único", motivo: "Comercial, inventario y cobranza se miden en escalas y marcos temporales propios y no reconcilian entre sí (contrato de datos declarado): cada cifra de esta Entrega queda con su propio dominio, nunca sumada con la de otro." },
    { titulo: "La causa de estas señales no está en los datos", motivo: "Esta lectura localiza dónde pesa más cada dominio y quién concentra más de uno, no explica por qué — no hay causalidad sin respaldo." },
    _limiteDeAusencia("conocimiento_sector_general"),
    // AGREGADO INTENCIONAL (owner/supervisor, 2026-09-25, revisión de calidad del corte 3d) — ver la nota gemela
    // en `componerEntregaCobranza`: esta ruta SIEMPRE cubre cobranza (los tres dominios son su forma canónica),
    // así que declara la ausencia sin condición. ÚNICO cambio de texto de esta ruta en este corte.
    _limiteDeAusencia("sin_antiguedad_vencido"),
  ];
  if (faltaRango) entrega.limites.push({ titulo: "El año comercial no declara un rango de fechas calendario", motivo: "El dato confirma que la parte comercial es el año cerrado (12 meses ya ocurridos), pero el pack no trae una fecha de cierre para ese universo — a diferencia de inventario y cobranza, que sí declaran su foto al corte." });
  { const lp = _limitePerfilIncompleto(perfil); if (lp) entrega.limites.push(lp); }

  // ── REFERENCIA DEL OFICIO · Etapa 3 (ver la nota de la ruta 1) — las entidades líder de cada dominio ──
  const _refOficio4 = referenciaDelOficioConOfertas({ perfil, pregunta, entidadesEnRespuesta: [...new Set(Object.values(lideres).map((L) => L.x.entidad))], entidadesDeLaPregunta: _entidadesDeLaPregunta(pregunta), scenario, activo: conocimientoActivo, catalogo: conocimientoCatalogo });
  entrega.referenciaDelOficio = _refOficio4.salida;
  _coherenciaConLaCapa(entrega, { conocimientoActivo, perfil });

  // ── PARA SU JUICIO · una pregunta por dominio, reusando el mismo texto que ya certifican las otras rutas ──
  entrega.paraSuJuicio = [];
  if (lideres.comercial) {
    let roles = null;
    try { roles = buildRolesCartera(scenario); } catch { roles = null; }
    // CORTE 3e (owner 2026-09-26) — antes: `Sobre comercial, solo tú puedes responder: …` (segunda persona).
    { const pa = _preguntaAbiertaComercial(roles, perfil); if (pa) entrega.paraSuJuicio.push(pa); }
  }
  // CORTE 3e (owner 2026-09-26) — antes: `Sobre inventario/cobranza, solo tú puedes responder: …` (segunda
  // persona). Ahora: preguntas abiertas en tercera persona con función sugerida (mismas dos de siempre).
  { const pa = _preguntaAbiertaInventario(lideres.inventario && lideres.inventario.x.entidad, perfil); if (pa) entrega.paraSuJuicio.push(pa); }
  { const pa = _preguntaAbiertaCobranza(lideres.cobranza && lideres.cobranza.x.entidad, perfil); if (pa) entrega.paraSuJuicio.push(pa); }

  // ── QUÉ MÁS PUEDO CALCULAR ──
  entrega.queMasPuedoCalcular = {
    puedo: ["El detalle de cada dominio por separado (comercial, inventario o cobranza)", "El cruce por SKU entre venta e inventario", "La cobranza cruzada con la venta, cuenta por cuenta", "Reordenar la prioridad con otro criterio (ventas, contribución, capital)", ..._ofertasTexto(_refOficio4.ofertas)],
    noPuedo: ["Por qué pasa cada cosa que esta prioridad localiza (el dato mide qué y cuánto, no por qué)", "Un total único de los tres dominios (no reconcilian entre sí)"],
  };

  // TAREA 3 — un universo POR DOMINIO (el líder que cita la Respuesta, eje según el dominio — inventario es SKU,
  // comercial/cobranza son cliente) más el universo de la prioridad INTEGRADA (materialidad+severidad+urgencia,
  // señal por señal — prioridadIntegrada.js — no reduce a una sola métrica, así que `top` queda sin declarar y
  // el criterio viaja en texto libre; ver el comentario de `_declararUniverso`).
  const _ejeDeDominio = (d) => (d === "inventario" ? "sku" : "cliente");
  for (const d of Object.keys(lideres)) {
    _declararUniverso(entrega, I, { id: `${d}_lider`, eje: _ejeDeDominio(d), periodo: _MARCO_CORTO[UNIVERSOS[_DOM_UNIVERSO[d]].periodo] || null, entidades: [lideres[d].x.entidad], criterio: `quien más pesa en ${_DOM_NOMBRE[d]}, por materialidad · severidad · urgencia` });
  }
  if (top) {
    _declararUniverso(entrega, I, { id: "prioridad_integrada", eje: _ejeDeDominio(top.dominios[0] || "comercial"), entidades: [top.entidad], criterio: "prioridad integrada por señales — materialidad, severidad y urgencia entre los dominios que comparten cliente, nunca por suma de montos" });
  }

  entrega.procedencia = { libro, cifrasImpresas };

  // CORTE 3e (owner 2026-09-26) — «¿Qué debería preocuparme primero?» (primera persona, «-me») → tercera persona.
  const texto = _textoDeLaEntrega(entrega, "¿Qué debería preocupar primero a la empresa?");
  return { texto, entrega, libro, ok: true, motivo: "", partes, dominios };
}

/* ════════════════════════════════════════════════════════════════════════════════════════════════════════════
 * CORTE 3b · componerEntrega(resolucion) — LA ENTREGA PARA CUALQUIER ENCARGO VÁLIDO (owner 2026-09-25)
 * ════════════════════════════════════════════════════════════════════════════════════════════════════════════
 * Hasta acá (corte 3a) `lecturasDe(resolucion)` decide QUÉ CORRE en el Core. Este corte decide CÓMO SE ESCRIBE:
 * generaliza lo que las 4 rutas fijas de arriba ya tienen en común (declarar cada cifra como hecho `ref` ANTES de
 * imprimirla, verificar el libro, renderizar con `R(id)`, nunca leer `preguntaOriginal`) sobre DOS ejes:
 *   · LECTURA POR TEMA — comercial / cobranza / inventario, con el MISMO vocabulario de rótulo «Entidad · Concepto»
 *     que YA usa todo el Core (`metricaPorClave(clave).nombre` es la MISMA tabla que arma «Venta»/«Margen»/…).
 *   · FORMA POR CIERRE — `_ADI_CONTRATO_ENCARGO_V1.md` §1.1: cifra/lectura/decision/comparacion/simulacion/definicion.
 *
 * EQUIVALENCIA BYTE A BYTE (owner, obligatoria): las 4 preguntas fijas expresadas como encargo tienen que producir
 * EXACTAMENTE el mismo texto y el mismo libro que las 4 rutas de arriba. La única forma de garantizar eso sin
 * reescribir 900 líneas ya certificadas es NO reescribirlas: `_delegarRutaCanonica` detecta la forma exacta de esos
 * 4 encargos (ver `fixtures/encargos-desarrollo.json` D08-D11) y llama LITERALMENTE a las 4 funciones de arriba —
 * mismo código, mismo texto, byte a byte, por construcción (no por coincidencia). El camino general de abajo NUNCA
 * se ejercita para esos 4 casos.
 *
 * DOS PUNTOS DE ENGANCHE PARA EL CORTE 3c (owner, fuera de este corte — señalados, no resueltos acá):
 *   · CÁLCULOS POR INICIATIVA / TENTACIONES PRECALCULADAS más allá de una razón/derivada simple.
 *   · TOPE DE TAMAÑO POR PROFUNDIDAD (`resolucion.profundidad "breve"|"completa"` no se lee todavía acá).
 *
 * GAP DECLARADO (no una decisión de significado, una decisión de ALCANCE del corte): un `universo` con
 * `estados`/`no_estados`/`filtros` (no `top`) sobre una parte SIN entidades — ej. «cobranza en mora» — exige
 * evaluar el ESTADO de cada entidad contra el dato real (motor de `notario/estados.js` aplicado a un universo
 * completo), un subsistema que este corte no construye. Esa parte se declina como límite («declina honestamente
 * cuenta como éxito», CLAUDE.md §5) en vez de forzar un listado sin filtrar o adivinar el criterio — NUNCA se sirve
 * como si el filtro se hubiera aplicado. `universo.top` (el ranking) SÍ está resuelto — es el caso que cubre el
 * catálogo (D02).
 */
/* EL ROTULO DE UN CONCEPTO NO ES UNO SOLO (hallazgo del corte, con evidencia): `notario/lexico.js` (nombre "Venta",
 * singular) y `config/contract/metricRegistry.js`/`entityRecord.js` (label "Ventas", plural, lo que emiten
 * `queryMetric`/`entityRecord`) NOMBRAN LA MISMA MÉTRICA distinto — un defecto de vocabulario preexistente del
 * Core (mismo espíritu que «Cobertura» ≠ «Días de inventario», CLAUDE.md §4), no una decisión de este corte.
 * CORRECCIÓN DEL SUPERVISOR (2026-09-25): nada de un segundo emparejador aproximado inventado en `componer.js`
 * — el Notario YA resuelve «un rótulo de fig dicho con palabras» → clave, con su propia tolerancia de sinónimos y
 * singular/plural (`notario/lexico.js:claveDeMetrica`, la MISMA función que `hechos.js` usa para reconocer el
 * concepto de una fig — `_addClave`/`_dominioDeFig`/`_claveEstricta`, ver sus líneas ~434-740). Acá se REUSA esa
 * canonización, en la MISMA dirección que ya la usa el Notario (rótulo de una fig de ADI → clave), NUNCA sobre
 * texto del usuario. Confirmado leyendo el registro: `claveDeMetrica("Ventas")` casa por el sinónimo "ventas" ya
 * declarado en `CLAVES_DE_METRICA.ventas.conceptos`, y `claveDeMetrica("Cobertura (DOH)")` casa por "cobertura"
 * en `CLAVES_DE_METRICA.dias_inventario.conceptos` — los DOS pares que motivaron el matcher viejo ya estaban
 * cubiertos por el léxico existente, sin alias nuevo. Si algún rótulo de fig NO casa con ninguna clave, esa fig
 * simplemente no entra a la parte (declara menos, nunca adivina) — se reporta al supervisor si aparece uno. */
const _figsDeEntidad = (figs, entidad) => _all(figs, new RegExp(`^${_esc(entidad)} · `, "i"));
/* FAMILIA 4 (§7.3·49f · 51f · 52e): el concepto de una fig «Entidad · Concepto», su clave canónica (v22 · S84: la tolerante no vale contra la UNIDAD de la fig) y el RÓTULO del léxico de una clave los decide `./rotulos.js`; acá solo los nombres cortos con que los planes ya los llamaban. */
const _conceptoDeLabel = conceptoDeLaFig;
const _claveDeFig = claveDeLaFig;
const _labelDeClave = rotuloDeClave;
const _RC = (clave) => rotuloDeLaCasa({ clave }).rotulo;   /* el rótulo del léxico de una clave (encabezados y claves de las tablas de las rutas fijas, ofertas del menú) */
const _RCo = (clave) => rotuloEnOracion({ clave });   /* … en minúscula, para decirlo dentro de una frase */
const _filaDe = (figs, entidad, clave) => _figsDeEntidad(figs, entidad).find((f) => _claveDeFig(f) === clave) || null;
const _todasLasFilasDeConcepto = (figs, clave) => {
  const out = [];
  for (const f of figs) { if (_claveDeFig(f) === clave) { const e = _entidadDe(_lab(f)); if (e) out.push({ entidad: e, fig: f }); } }
  return out;
};

/* R-COBRANZA-TOP8-SIN-COLA-MENOR (diagnóstico v6) / A2 (diagnóstico v7, MATERIAL) — «una Entrega nunca revienta»:
 * una entidad de `plan.orden`/`plan.miembros` puede quedar sin NINGÚN concepto en `plan.porEntidad` (ninguna fig
 * publicada para ella en toda la parte — p. ej. una entidad que el `top` verificado agregó pero de la que ninguna
 * fig llegó, `_entidadesDelTopVerificado`), y `.get(entidad)` devuelve `undefined`. `_mapaDe` es la ÚNICA guarda
 * de archivo (antes vivía redeclarada en dos sitios): se usa en TODO `.get()` de un mapa `porEntidad` — nunca
 * inventa una fig, solo evita el `.get()` sobre `undefined`. */
const _mapaDe = (m, e) => (m && m.get(e)) || new Map();

/* ── delegación a las 4 rutas fijas (equivalencia byte a byte) ────────────────────────────────────────────────── */
// R1, hallazgo gemelo (diagnóstico v2, supervisor 2026-09-26 — MATERIAL, reproducido con W10: la delegación a la
// ruta fija «¿dónde la empresa deja de ganar?» se disparaba para CUALQUIER `lectura` sin entidades/conceptos/
// universo, sin mirar el EJE — «léeme el negocio por marca» (eje explícito "marca") calzaba con `_parteSimple`
// igual que «léeme el negocio» (cartera de CLIENTES, sujeto por defecto) y la Entrega servida terminaba siendo
// la de siempre, por CLIENTE, con Falabella de protagonista — exactamente la misma clase de sustitución de
// alcance que `iniciativa.js:_tieneLecturaDeCarteraEntera` tenía (mismo criterio de arreglo: `alcanceDeParte`,
// `entrega/alcance.js` — un eje declarado DISTINTO del sujeto por defecto del tema ya no es «simple»).
const _parteSimple = (p) => p && p.cierre === "lectura" && (!p.entidades || !p.entidades.length)
  && (!p.conceptos || !p.conceptos.length) && !p.universo && (!p.periodo || p.periodo.tipo === "vigente")
  && !(alcanceDeParte(p).eje && alcanceDeParte(p).eje !== sujetoDeTema(p.tema));
const _criterioPorDefecto = (c) => !c || (!c.referencia && (!c.lente || c.lente === "riesgo"));
function _delegarRutaCanonica(resolucion) {
  if (!resolucion || !Array.isArray(resolucion.partes)) return null;
  if (!_criterioPorDefecto(resolucion.criterio)) return null;
  if ((resolucion.supuestos && resolucion.supuestos.length) || (resolucion.premisas && resolucion.premisas.length)) return null;
  const partes = resolucion.partes;
  if (partes.length === 1 && _parteSimple(partes[0])) {
    if (partes[0].tema === "comercial") return componerEntregaBrechaComercial();
    if (partes[0].tema === "cobranza") return componerEntregaCobranza();
    if (partes[0].tema === "inventario") return componerEntregaInventario();
    return null;
  }
  if (partes.length === 3 && partes.every(_parteSimple)) {
    const temas = new Set(partes.map((p) => p.tema));
    if (temas.size === 3 && temas.has("comercial") && temas.has("inventario") && temas.has("cobranza")) return componerEntregaMultidominio();
  }
  return null;
}

/* ── límites derivados de `noResuelto` y de las ausencias (gate: «cada noResuelto y cada ausencia visibles como
 * límite», ley del owner «declina honestamente cuenta como éxito») — texto de la CASA: el título nombra el campo
 * cerrado del contrato (§2.1, nunca prosa nueva por caso) y el motivo es `nr.detalle`, que YA es texto de
 * `validarUniverso`/`validarHecho`/`ausencia.texto`/`BLOQUEADOS.porque` (contrato §5).
 * `temasCubiertos` (no `ParteResuelta.ausencias` completo): `ausenciasDe(tema)` es el REGISTRO de todo lo que ese
 * dominio no trae (sin_pronostico · sin_meta_declarada · conocimiento del sector · perfil incompleto · …) —
 * imprimirlo ENTERO por cada parte (7 entradas por tema) es la misma clase de defecto que el proyecto ya cerró
 * con "Cobertura": un catálogo entero servido como si cada entrada aplicara a ESTE turno. Las 4 rutas fijas nunca
 * lo hacen: declaran UNA (`conocimiento_sector_<tema>`, la única que el plan §1 pide — "Sin conocimiento del
 * sector cargado todavía"). El general composer hace lo mismo, una vez por tema con contenido servido. */
function _limitesDeclarados(resolucion, temasCubiertos) {
  const limites = [];
  const vistos = new Set();
  const agregarAusencia = (id) => { if (!id || vistos.has(`a:${id}`)) return; vistos.add(`a:${id}`); const l = _limiteDeAusencia(id); if (l) limites.push(l); };
  for (const tema of temasCubiertos) agregarAusencia(`conocimiento_sector_${tema}`);
  for (const nr of resolucion.noResuelto || []) {
    const clave = `nr:${nr.parte || "raiz"}:${nr.campo}:${JSON.stringify(nr.valor)}`;
    if (!vistos.has(clave)) {
      vistos.add(clave);
      const sujeto = nr.parte ? `la parte ${nr.parte}` : "el encargo";
      // MARCA ESTRUCTURAL (supervisor 2026-09-27, diagnóstico v9 · raíz A11 — W39) — `motivo:"universo_invalido"`
      // (validar.js) es SIEMPRE un ECO del nombre que el usuario/LLM escribió («SKU bajo el benchmark», «carga
      // comercial alta»), nunca una afirmación de ADI sobre una brecha o un benchmark propios — declina el
      // universo pedido, no compara nada. `entrega/verificar.js` (regla 4, comparables-juntas) lo excluye de su
      // escaneo por esta marca, nunca por texto adivinado (mismo criterio que ya usa con `lim._ausencia`).
      const _esUniversoInvalido = nr.motivo === "universo_invalido";
      limites.push({ titulo: `Sobre ${sujeto}, un ${nr.campo} pedido quedó sin resolver (${nr.motivo.replace(/_/g, " ")})`, motivo: nr.detalle || `Motivo cerrado del contrato: ${nr.motivo}.`, ...(_esUniversoInvalido ? { _universoInvalido: true } : {}) });
    }
    const altAusencia = (nr.alternativas || []).find((a) => a.tipo === "ausencia");
    if (altAusencia) agregarAusencia(altAusencia.id);
  }
  return limites;
}

/* R-RUTA-FIJA-SIN-LIMITES-RAIZ (supervisor 2026-09-26, MATERIAL) — CANDADO GENERAL: ningún `noResuelto` de la
 * `Resolucion` puede faltar en `entrega.limites`, sea cual sea el camino que compuso la Entrega. Las 4 rutas
 * canónicas (`_delegarRutaCanonica`) devuelven ANTES de la sección «MARCO, LÍMITES» del camino general (línea
 * ~2189: `if (canonica) return _conTamanoGobernado(canonica, resolucion);`) — nunca llaman a `_limitesDeclarados`,
 * así que un `usar`/`profundidad`/`iniciativa`/`contexto` inválido en la RAÍZ del encargo (contrato §2.1) se
 * declara en `resolucion.noResuelto` pero desaparece sin rastro de la Entrega cuando la única parte cae en una de
 * esas 4 rutas «simples» — el MISMO campo inválido, sobre el MISMO tema, SÍ se declara si la parte trae una
 * entidad o un concepto explícito (cae al camino general, que sí llama `_limitesDeclarados` con la `Resolucion`
 * completa, línea ~2847). Se cierra acá, con la MISMA función que ya usa el camino general — nunca una prosa
 * nueva —, filtrada a los `noResuelto` de RAÍZ (`nr.parte` vacío: los de una parte no aplican a una ruta fija, que
 * por definición solo tiene una parte «simple» sin declarar nada que pueda fallar). SIN dedupe por texto: el
 * camino general tampoco lo hace (`_limitesDeclarados` solo dedupe por su propia clave `parte:campo:valor`, nunca
 * por el título ya renderizado) — dos `contexto_no_disponible` con distinto `nr.valor` (dos ids de hecho citados)
 * son dos límites reales aunque su título se lea igual (W70), y esta función tiene que servir los MISMOS que
 * serviría el camino general con la misma `Resolucion`, byte a byte. Con un encargo LIMPIO (`resolucion.noResuelto`
 * vacío o solo de parte) esta función no agrega nada: el byte a byte de las 4 rutas fijas no cambia — la carnada
 * del gate lo exige. */
function _conLimitesDeRaiz(resultado, resolucion) {
  if (!resultado || !resultado.entrega || !Array.isArray(resultado.entrega.limites)) return resultado;
  const raiz = (resolucion && resolucion.noResuelto || []).filter((nr) => !nr.parte);
  if (!raiz.length) return resultado;
  resultado.entrega.limites.push(..._limitesDeclarados({ noResuelto: raiz }, new Set()));
  return resultado;
}

/* CORRECCIÓN DEL SUPERVISOR (2026-09-25, revisión de calidad tras la entrega de 3d) — «un rótulo que ya termina
 * en "en $" duplica el signo cuando se pega a un valor en dinero (regla madre: la Entrega la lee un LLM, no
 * puede llevar jerga ni ruido)». Se corta el sufijo " en $" SOLO al armar una ORACIÓN (nunca en la tabla de
 * Cifras, donde el rótulo y el valor viven en columnas separadas y no hay ambigüedad ni doble signo). */
const _sinSufijoDolar = (etiqueta) => String(etiqueta || "").replace(/\s+en\s*\$\s*$/i, "");

/* ── PLAN «entidad» (cierre `cifra`/`lectura`/`decision` con ≥1 entidad declarada) ──────────────────────────────
 * Declara CADA fig «entidad · concepto» que encuentra para esa entidad (filtrada a `parte.conceptos` si el
 * encargo los trajo — nunca sustituye un concepto por otro) y devuelve el plan (solo ids, sin texto: se rinde
 * en la fase 2, después de verificar el libro — el MISMO patrón de las 4 rutas fijas).
 *
 * CORRECCIÓN DEL SUPERVISOR (2026-09-25) — dos defectos de calidad reales, medidos sobre el ejemplo servido:
 *   1 · «la Respuesta nunca repite la misma cifra con dos rótulos»: en el camino "dame todo" (sin `conceptos`
 *       declarados), dos figs pueden canonizar a la MISMA clave con etiquetas de origen distintas (ej. "YoY" y
 *       "Variación vs año anterior en $" son la MISMA clave `variacion_usd` — notario/lexico.js) — acá se dedupea
 *       por CLAVE CANÓNICA (`_claveDeFig`, la misma que ya usa el Notario), quedándose con la primera fig.
 *   2 · una `lectura`/`decision` sobre una entidad ya NO abre con un volcado de conceptos: abre con la
 *       CONCLUSIÓN del procedimiento para esa entidad (`_construirConclusionEntidad`, abajo) — posición en la
 *       cartera, brecha contra el benchmark, contribución no capturada, carga contra el resto (comercial);
 *       posición y saldo/vencido (cobranza); posición y capital frenado (inventario). Reusa `lecturaDeMargen`/
 *       `prioridadDe` — LAS MISMAS funciones que ya arma la ruta fija de brecha comercial (`_ADI_DISENO...`
 *       instrucción del supervisor: «mira cómo la ruta de brecha comercial arma su Respuesta... y reusa eso»).
 *       Las figs que la conclusión necesita SIEMPRE quedan también en `filas` (Cifras) — nunca un id que solo
 *       vive en la Respuesta (regla 3 de verificar.js, doble colocación). `cifra` (no lectura/decision) sigue
 *       con el listado — es lo que ese cierre pide por contrato (§1.1: una cifra puntual). */
function _planCifraEntidad(parte, figs, ref, I, declararDerivada = null, sinCifraOut = null, criterio = null) {
  const filasPorEntidad = [];
  const faltantes = [];   /* FAMILIA 2: los conceptos pedidos que ninguna fuente demuestra para una entidad nombrada (se declaran: «sin dato de X para Y») */
  const sinClave = new Set();   /* FAMILIA 4: las entidades de las que el productor trajo una cifra que el léxico no conoce (se declara, no se imprime cruda) */
  const esLecturaODecision = parte.cierre === "lectura" || parte.cierre === "decision";
  for (const e of parte.entidades) {
    const universo = parte.conceptos && parte.conceptos.length ? parte.conceptos : null;
    let candidatas;
    if (universo) {
      /* FAMILIA 2 (§7.3·51b · «una entidad que el usuario NOMBRA tiene su fila en cada concepto pedido que su productor publica»): la boleta del turno, si no la fila de la proyección (medido) o su cero de cobertura declarada; lo que ninguna fuente demuestra se declara */
      const r = filasDeEntidad({ entidad: e.nombre, eje: e.eje, conceptos: universo, figDe: (c) => _filaDe(figs, e.nombre, c), I });
      candidatas = r.filas.map((x) => ({ clave: x.clave, fig: x.fig, origen: x.origen }));
      for (const c of r.faltantes) faltantes.push({ entidad: e.nombre, clave: c });
    } else {
      const vistos = new Set();
      candidatas = [];
      for (const f of _figsDeEntidad(figs, e.nombre)) {
        const clave = _claveDeFig(f);
        // UNA SOLA VERDAD (owner 2026-09-26, CORTE 3d — «Peso del costo») — el «dame todo» camina TODAS las figs
        // de la entidad, incluidas las que llegan por el AUTO-WALK de `oracle/ledger.js:enrichFromFacts` (activo
        // de verdad en `toolRunner.js`, no «sombra»): antes de este corte, un concepto que `validar.js` DECLINA
        // cuando el usuario lo pide a propósito (`concepto_sin_productor` — hoy solo `peso_costo`, sin productor
        // declarado para NINGÚN eje, `esquema.js:_PRODUCTOR_RESIDUAL.peso_costo = []`) igual se SERVÍA acá, sin
        // que nadie lo pidiera — la MISMA cifra, autorizada para el «dame todo» y prohibida para el pedido
        // explícito, dos verdades. Se elige la opción que respeta «toda cifra servida es una cifra autorizada del
        // pipeline»: si el validador declina el concepto (cero ejes con productor), el «dame todo» tampoco lo
        // sirve — nunca una tabla de excepciones a mano para «peso_costo»: es la MISMA función `productorDe` que
        // ya audita el pedido explícito, aplicada acá con el MISMO criterio (regla general, no un caso especial).
        /* FAMILIA 4 (§7.3·52e): una fig sin clave en el léxico se DECLARA (`sinClave`, abajo), nunca se imprime con el rótulo crudo del productor */
        if (!clave) { sinClave.add(e.nombre); continue; }
        if (!productorDe(clave, e.eje)) continue;
        if (vistos.has(clave)) continue;   // ★ dedup por clave canónica — «la misma cifra nunca con dos rótulos»
        vistos.add(clave);
        candidatas.push({ clave, fig: f });
      }
    }
    // ★ el rótulo de Cifras (columna "Métrica") queda CANÓNICO, con su "en $" si lo tiene — nunca se le quita
    // acá: dos claves distintas (ej. "variacion" % y "variacion_usd" $) pueden compartir casi el mismo nombre, y
    // recortar "en $" las volvería INDISTINGUIBLES en la tabla ("un rótulo no puede nombrar dos campos",
    // CLAUDE.md §4). El recorte de "en $" es SOLO para la ORACIÓN (ver el volcado en la fase 2, más abajo).
    const filas = candidatas.map((c) => ({ clave: c.clave, etiqueta: rotuloDeLaCasa({ clave: c.clave }).rotulo, id: ref(c.fig), _fig: c.fig, origen: c.origen || origenDeLaFig(c.fig) })).filter((f) => f.id);   /* FAMILIA 4: el rótulo de cada fila es el del léxico de SU clave */
    // RAÍZ A1 (supervisor 2026-09-29, diagnóstico v13, Z78) — una entidad nombrada que quedó SIN ninguna cifra ya no se
    // descarta en silencio: el llamador la declara como límite («nunca omite en silencio», §7.3·29-30).
    if (!filas.length) { if (Array.isArray(sinCifraOut)) sinCifraOut.push(e.nombre); continue; }
    const entry = { entidad: e.nombre, eje: e.eje, filas };
    if (esLecturaODecision) entry.conclusion = _construirConclusionEntidad(parte.tema, e.nombre, figs, filas, ref, I, parte.conceptos);
    filasPorEntidad.push(entry);
  }
  // R-TENTACION-SIN-PLANCIFRAENTIDAD (diagnóstico v6, MEDIA) — mecanismo 6 (tentación precalculada), análogo al
  // que ya tiene `_planCifraGrupo` (línea ~2444) pero para el camino de ENTIDADES EXPLÍCITAS: con ≥2 cuentas
  // nombradas de punta que comparten una misma clave, se declara la diferencia entre la primera y la segunda antes
  // de imprimir — sin esto, `verificarEntrega` («toda tentación precalculada», verificar.js) marcaba
  // `tentacion-no-precalculada` en cualquier `cifra`/`lectura`/`decision` con 2+ entidades explícitas sobre un
  // concepto compartido, porque el libro de hechos nunca traía un `razon`/`derivada` que las relacionara.
  if (declararDerivada && filasPorEntidad.length > 1) {
    const [pA, pB] = filasPorEntidad;
    const claveComun = pA.filas.map((f) => f.clave).find((c) => c && pB.filas.some((f2) => f2.clave === c));
    if (claveComun) {
      const figA = _filaDe(figs, pA.entidad, claveComun), figB = _filaDe(figs, pB.entidad, claveComun);
      const idA = pA.filas.find((f) => f.clave === claveComun).id, idB = pB.filas.find((f) => f.clave === claveComun).id;
      const idDiffEntidad = declararDerivada(figA, idA, figB, idB);
      if (idDiffEntidad) return _conPrioridadEntrePedidas({ kind: "entidad", tema: parte.tema, parteId: parte.id, cierre: parte.cierre, filasPorEntidad, idDiffEntidad, faltantes, sinCifra: sinCifraOut, sinClave: [...sinClave] });
    }
  }
  return _conPrioridadEntrePedidas({ kind: "entidad", tema: parte.tema, parteId: parte.id, cierre: parte.cierre, filasPorEntidad, faltantes, sinCifra: sinCifraOut, sinClave: [...sinClave] });
  /* §7.3·49(b): una `decision` con entidades nombradas DECIDE entre ellas. Cuando la prioridad no sale del plan de señales de riesgo (los ejes sin señales —marca, familia, bodega, canal— o un grupo sin señal), el grupo de las pedidas se ordena como cualquier grupo de una decisión: por la lente pedida si aplica a su dominio (con su medida; si no distingue a nadie se declara, sin coronar a la primera) o por la medida propia del grupo, NOMBRADA; una lente que no lo ordena se declara (46d · 47a · 47d). Las cifras son las de las filas de cada entidad: ninguna cifra nueva salvo la medida de la lente cuando no era un concepto pedido. */
  function _conPrioridadEntrePedidas(out) {
    if (parte.cierre !== "decision" || filasPorEntidad.length < 2) return out;
    const figDe = (x, c) => { const f = x.filas.find((y) => y.clave === c); return f ? f._fig : null; };
    const conceptos = parte.conceptos && parte.conceptos.length ? parte.conceptos : [...new Set(filasPorEntidad.flatMap((x) => x.filas.map((y) => y.clave).filter(Boolean)))];
    const claveOrden = conceptos.find((c) => filasPorEntidad.every((x) => figDe(x, c))) || conceptos.find((c) => filasPorEntidad.some((x) => figDe(x, c))) || null;
    if (!claveOrden && !(conceptoDeLaMedidaParcial(criterio, parte.tema) && I)) return out;   /* 57(b): la lente «crecimiento» ordena entre las nombradas por la variación en %, aunque ningún concepto pedido traiga cifra para ordenar la lista */
    const dirMenor = false;   /* la lista: de MAYOR a menor, como siempre; la oración de prioridad nombra a quien pide atención (§7.3·50a, abajo) */
    const val = (x) => { const f = figDe(x, claveOrden); return f && Number.isFinite(f.raw) ? f.raw : NaN; };
    const ordenados = [...filasPorEntidad].sort((a, b) => { const va = val(a), vb = val(b); if (!Number.isFinite(va) || !Number.isFinite(vb)) return Number.isFinite(va) === Number.isFinite(vb) ? 0 : (Number.isFinite(va) ? -1 : 1); return dirMenor ? va - vb : vb - va; });
    const nombres = ordenados.map((x) => x.entidad);
    const porEntidadFig = new Map(ordenados.map((x) => [x.entidad, new Map(x.filas.filter((y) => y.clave).map((y) => [y.clave, y._fig]))]));
    /* §7.3·56 + 57(a)(b): la lente «crecimiento» ordena entre las nombradas por la variación EN %, completada con la proyección para quien la boleta no la trae; a quien el dato no trae se le declara «sin dato de X para Y» (52b) y la lente ordena a los demás */
    { const _cLente = conceptoDeLaMedidaParcial(criterio, parte.tema), _eje = parte.eje || sujetoDeTema(parte.tema);
      if (_cLente && I && productorDe(_cLente, _eje)) {
        for (const x of ordenados) { const m = porEntidadFig.get(x.entidad); if (!m.has(_cLente)) { const f = _filaDe(figs, x.entidad, _cLente); if (f && Number.isFinite(f.raw)) m.set(_cLente, f); } }
        for (const f of completarGrupo({ nombres, conceptos: [_cLente], porEntidad: porEntidadFig, eje: _eje, I })) if (!faltantes.some((y) => y.entidad === f.entidad && y.clave === f.clave)) faltantes.push(f);
      } }
    const prio = prioridadDeParte({ criterio, tema: parte.tema, cierre: "decision", entidades: nombres, claveOrden, valorDe: (n) => val(ordenados.find((x) => x.entidad === n)), proyeccion: valoresDeProyeccion(I, parte.eje || sujetoDeTema(parte.tema), claveOrden), figs, porEntidad: porEntidadFig });   /* FAMILIA 1: la decisión de prioridad es de `prioridad.js` */
    alOrdenServido(prio, filasPorEntidad.map((x) => x.entidad));   /* §7.3·55(c): «ninguna cuenta queda primera» enumera el grupo en el orden en que se NOMBRÓ (el de la tabla), no en el de la primera medida con que se decidió */
    const { lenteGrupo, primeroAtencion } = prio;
    const porEntidadId = new Map(ordenados.map((x) => [x.entidad, new Map(x.filas.filter((y) => y.clave).map((y) => [y.clave, y.id]))]));
    return { ...out, prioridadEntre: { orden: nombres, claveOrden, lenteGrupo, porEntidadId, prioridad: prio, ...(primeroAtencion ? { primeroAtencion } : {}) } };
  }
}

/* «abre con la CONCLUSIÓN del procedimiento para esa entidad» (supervisor, revisión de calidad 2026-09-25) —
 * arma los INSUMOS (ids ya `ref()`ados, listos para `R()`) de la conclusión, reusando SIEMPRE una fig que ya
 * esté en `filas` cuando exista (`_idDeClave`, abajo): así todo hecho de la Respuesta también vive en Cifras
 * (regla 3, doble colocación), y ninguna cifra se cuenta dos veces. Devuelve `null` si no hay ni el mínimo dato
 * (venta/margen para comercial, saldo para cobranza) para no fingir una conclusión sin sostén — la Respuesta cae
 * al listado (ver el llamador en la fase 2) en vez de imprimir una oración vacía.
 *
 * CORRECCIÓN DEL SUPERVISOR (2026-09-25, error MATERIAL de universo) — «Lider, 1° de 8 clientes» sobre una
 * cartera de 13: el puesto se calculaba sobre la BOLETA de este turno, capada a 8 filas por
 * `herramientasAgente.js:cobranza()` (memoria `adi-piso-materialidad-cobranza`: «la boleta de cobranza del
 * agente trae solo 8 filas»). Ahora el puesto se lee de `I.rankings.<eje>.<clave>` — LA MISMA proyección
 * (`oracle/datoProyectado.js`, sobre `mesaFlujo`/el dato completo, sin tope) que ya usa el resto del Notario
 * para completar una fig que la boleta no trajo — nunca la boleta capada. Si el pack no publica ese ranking (un
 * escenario sintético sin `mesaFlujo`), cae a la boleta de este turno COMO RESPALDO, declarado como tal (nunca
 * en silencio) — un caso que hoy no ocurre con TENANT_DEMO. `universoEntidades`/`universoCriterio` viajan para
 * que el llamador (fase 2) declare el universo en `entrega.universos` — el DENOMINADOR del puesto tiene que ser
 * el tamaño de un universo declarado, no un número suelto (candado del gate). */
function _idDeClave(filas, figs, entidad, clave, ref) {
  const existente = filas.find((f) => f.clave === clave && f.origen !== ORIGEN.COBERTURA);   /* FAMILIA 2: el cero de cobertura declarada va en la TABLA, no cambia la oración de conclusión */
  if (existente) return existente.id;
  const fig = _filaDe(figs, entidad, clave);
  if (!fig) return null;
  const id = ref(fig);
  if (id != null) filas.push({ clave, etiqueta: rotuloDeLaCasa({ clave }).rotulo, id });   // FAMILIA 4: el rótulo del léxico de SU clave — ver la nota de `_planCifraEntidad`
  return id;
}
/* ranking de la PROYECCIÓN (universo completo), ordenado de mayor a menor — `null` si el pack no lo publica. */
function _rankingCompleto(I, eje, clave) {
  const r = I && I.rankings && I.rankings[eje] && I.rankings[eje][clave];
  if (!r || !Array.isArray(r.filas) || !r.filas.length) return null;
  return [...r.filas].sort((a, b) => (Number.isFinite(b.valor) ? b.valor : -Infinity) - (Number.isFinite(a.valor) ? a.valor : -Infinity));
}
function _construirConclusionEntidad(tema, entidad, figs, filas, ref, I, conceptos) {
  if (tema === "comercial") {
    const idVenta = _idDeClave(filas, figs, entidad, "ventas", ref);
    const idMargen = _idDeClave(filas, figs, entidad, "margen", ref);
    if (idVenta == null && idMargen == null) return null;
    const lect = lecturaDeMargen(figs);
    const pr = prioridadDe(figs);
    // el benchmark es del "negocio" (referencia, no cliente): un `ref()` propio no exige doble colocación
    // (verificar.js regla 3 solo exige la cita de hechos CUYO dueño no es "negocio").
    const idBench = lect && lect.bench ? ref(lect.bench) : null;
    const idJuego = _idDeClave(filas, figs, entidad, "no_capturada", ref);
    const idCarga = _idDeClave(filas, figs, entidad, "carga_alta", ref);
    // ★ CORRECCIÓN (2026-09-25, tras revisión) — el universo de "contribución no capturada" es el de las CUENTAS
    // MATERIALES bajo el benchmark (`prioridadDe(figs).juego` — margenEnRiesgo.js, LA MISMA fuente que ya usa la
    // ruta fija de brecha comercial, `descomposicionDeBrecha`, CAU-01 y el resto del sistema): NO se reemplaza por
    // `I.rankings.cliente.no_capturada` (que incluye TODA cuenta con brecha > 0, sin el filtro de materialidad —
    // sería una SEGUNDA definición del mismo concepto, justo lo que "una sola verdad" prohíbe). El supervisor
    // aceptó el conteo "5" como correcto; lo que faltaba era declarar de qué universo son esas 5 — ver
    // `universoTexto` abajo ("cuentas con contribución no capturada").
    let posicion = null, total = null, universoEntidades = null;
    if (pr && Array.isArray(pr.juego) && pr.juego.length) {
      const idx = pr.juego.findIndex((x) => x.entidad === entidad);
      if (idx >= 0) { posicion = idx + 1; total = pr.juego.length; universoEntidades = pr.juego.map((x) => x.entidad); }
    }
    return { tipo: "comercial", entidad, idVenta, idMargen, idBench, idJuego, idCarga, posicion, total, universoEntidades, universoEje: "cliente", universoCriterio: "cuentas con contribución no capturada", universoTexto: "cuentas con contribución no capturada" };
  }
  if (tema === "cobranza") {
    const idSaldo = _idDeClave(filas, figs, entidad, "saldo_pendiente", ref);
    if (idSaldo == null) return null;
    const idVencido = _idDeClave(filas, figs, entidad, "saldo_vencido", ref);
    let posicion = null, total = null, universoEntidades = null;
    const rankingSP = _rankingCompleto(I, "cliente", "saldo_pendiente");
    if (rankingSP) {
      const idx = rankingSP.findIndex((f) => f.entidad === entidad);
      if (idx >= 0) { posicion = idx + 1; total = rankingSP.length; universoEntidades = rankingSP.map((f) => f.entidad); }
    } else {
      // respaldo declarado (ver la cabecera): solo si el pack no publica el ranking completo — no ocurre con TENANT_DEMO.
      const filasSaldo = _all(figs, /· Saldo pendiente$/i);
      const idx = filasSaldo.findIndex((f) => _entidadDe(_lab(f)) === entidad);
      if (idx >= 0) { posicion = idx + 1; total = filasSaldo.length; universoEntidades = filasSaldo.map((f) => _entidadDe(_lab(f))).filter(Boolean); }
    }
    return { tipo: "cobranza", entidad, idSaldo, idVencido, posicion, total, universoEntidades, universoEje: "cliente", universoCriterio: "clientes con saldo pendiente", universoTexto: "clientes con saldo pendiente" };
  }
  if (tema === "inventario") {
    /* MIGRACIÓN (owner 2026-09-28, §7.3·30-34, etapa 5): la parte del encargo puede pedir el tramo crítico
     * («capital_frenado», ahora «inmovilizado crítico») o la categoría amplia («capital_inmovilizado»,
     * crítico ∪ sobrestock) — son conjuntos DISTINTOS (medido: v10 X03/X50 rankeaban solo el tramo crítico
     * cuando el encargo pedía la categoría amplia, y SAM-TV55/PHI-IRON-PRO —sobrestock— faltaban del universo).
     * La clave la decide `parte.conceptos`, nunca se asume «capital_frenado» por defecto para el tema entero. */
    const claveInv = Array.isArray(conceptos) && conceptos.includes("capital_inmovilizado") ? "capital_inmovilizado" : "capital_frenado";
    const idFrenado = _idDeClave(filas, figs, entidad, claveInv, ref);
    if (idFrenado == null) return { tipo: "inventario_sin_frenado", entidad };
    const idDias = _idDeClave(filas, figs, entidad, "dias_inventario", ref);
    let posicion = null, total = null, universoEntidades = null;
    const rankingCF = _rankingCompleto(I, "sku", claveInv);
    if (rankingCF) {
      const idx = rankingCF.findIndex((f) => f.entidad === entidad);
      if (idx >= 0) { posicion = idx + 1; total = rankingCF.length; universoEntidades = rankingCF.map((f) => f.entidad); }
    } else {
      const filasFrenado = (claveInv === "capital_inmovilizado" ? _all(figs, /· Capital inmovilizado$/i) : _all(figs, /· Capital (?:frenado|inmovilizado cr[ií]tico)$/i)).filter((f) => !/^Capital (?:frenado|inmovilizado(?: cr[ií]tico)?) · total$/i.test(_lab(f)));
      const idx = filasFrenado.findIndex((f) => _entidadDe(_lab(f)) === entidad);
      if (idx >= 0) { posicion = idx + 1; total = filasFrenado.length; universoEntidades = filasFrenado.map((f) => _entidadDe(_lab(f))).filter(Boolean); }
    }
    /* CANON (owner 2026-09-29, §7.3·31/34): la categoría se dice con la FORMA de la casa de su estado (`FORMA_DE_ESTADO`) —
     * «SKU inmovilizados críticos» (= capital_frenado, la regla de rotación) o «SKU inmovilizados» (crítico ∪ sobrestock)—;
     * «frenado» es venta interrumpida y no nombra esta regla. */
    const estadoInv = claveInv === "capital_inmovilizado" ? "inmovilizado" : "inmovilizado critico";
    const universoInv = `SKU ${formaDeEstado(estadoInv).plural}`;
    return { tipo: "inventario", entidad, idFrenado, idDias, posicion, total, universoEntidades, universoEje: "sku", universoCriterio: universoInv, universoTexto: universoInv, capitalInv: formaDeEstado(estadoInv).singular };
  }
  return null;
}
/* renderiza la conclusión — números de POSICIÓN (ordinal/total) no son un hecho de la boleta, son un conteo que
 * este compositor hace sobre el índice ya construido (mismo patrón que `nClientes`/`PERIODO_TXT` en el Marco de
 * las 4 rutas fijas): se registran en `cifrasImpresas` para que la regla 1 (cero cifras desnudas) los reconozca,
 * sin fingir un id de hecho que no existe. El texto SIEMPRE declara de qué universo son el puesto y el total
 * (supervisor: «debe decir de qué universo son esas N») — nunca un número suelto sin dueño. */
function _renderConclusionEntidad(c, R, cifrasImpresas) {
  if (!c || c.tipo === "inventario_sin_frenado") return null;
  const _pos = (txt) => { cifrasImpresas.push(String(c.posicion)); cifrasImpresas.push(String(c.total)); return txt; };
  if (c.tipo === "comercial") {
    if (c.idVenta == null && c.idMargen == null) return null;
    const posTxt = c.posicion != null ? _pos(`, ${c.posicion}° de ${c.total} ${c.universoTexto}`) : "";
    const partes = [];
    if (c.idVenta != null) partes.push(`vende ${R(c.idVenta)}`);
    if (c.idMargen != null) partes.push(c.idBench != null ? `con un margen de ${R(c.idMargen)} contra el benchmark de ${R(c.idBench)}` : `con un margen de ${R(c.idMargen)}`);
    if (c.idJuego != null) partes.push(`brecha estimada ${R(c.idJuego)}`);
    if (c.idCarga != null) partes.push(`${_RCo("carga_alta")} ${R(c.idCarga)}`);   /* FAMILIA 4: el rótulo del léxico de SU concepto */
    return `${c.entidad}${posTxt}: ${partes.join(", ")}.`;
  }
  if (c.tipo === "cobranza") {
    const posTxt = c.posicion != null ? _pos(`, ${c.posicion}° de ${c.total} ${c.universoTexto}`) : "";
    const partes = [`${R(c.idSaldo)} pendientes`];
    partes.push(c.idVencido != null ? `de los cuales ${R(c.idVencido)} vencido` : "sin plazo de pago declarado — su vencido no se puede calcular");
    return `${c.entidad}${posTxt}: ${partes.join(", ")}.`;
  }
  if (c.tipo === "inventario") {
    const posTxt = c.posicion != null ? _pos(`, ${c.posicion}° de ${c.total} ${c.universoTexto}`) : "";
    const partes = [`${R(c.idFrenado)} de capital ${c.capitalInv || formaDeEstado("inmovilizado critico").singular}`];   // CANON (owner 2026-09-29, §7.3·31/34): antes «${R} frenados» — «frenado» ya no nombra esta regla
    if (c.idDias != null) partes.push(`${R(c.idDias)} de inventario`);
    return `${c.entidad}${posTxt}: ${partes.join(", ")}.`;
  }
  return null;
}
function _hechosDeConclusion(c) {
  if (!c) return [];
  return [c.idVenta, c.idMargen, c.idBench, c.idJuego, c.idCarga, c.idSaldo, c.idVencido, c.idFrenado, c.idDias].filter((x) => x != null);
}

/* (c) CORRECCIÓN DEL SUPERVISOR (2026-09-25) — «Qué más puedo calcular» con texto genérico no le sirve al LLM:
 * arma OFERTAS CONCRETAS desde lo que ESTE encargo ya tocó (entidad/eje/tema), con su cifra-gancho cuando un id
 * ya verificado la sostiene (mismo patrón que las ofertas de Knowledge — nunca un hecho nuevo, siempre uno que
 * `planes` ya declaró y `R` ya puede renderizar). Sin candidatos concretos (ej. el encargo es solo `definicion`/
 * `comparacion`/`simulacion`), cae al genérico de siempre — nunca una sección vacía. */
function _ofertasConcretas(planes, R) {
  const out = [];
  const _push = (s) => { if (s && !out.includes(s)) out.push(s); };
  for (const plan of planes) {
    if (plan.kind === "entidad") {
      for (const { entidad, conclusion } of plan.filasPorEntidad) {
        if (plan.tema === "comercial") {
          _push(conclusion && conclusion.tipo === "comercial" && conclusion.idJuego != null
            ? `${_RC("carga")} de ${entidad} frente al resto de la cartera (hoy, brecha estimada: ${R(conclusion.idJuego)})`
            : `Detalle de ${_RCo("margen")} y ${_RCo("carga")} de ${entidad}, cuenta por cuenta`);
        } else if (plan.tema === "cobranza") {
          _push(conclusion && conclusion.tipo === "cobranza" && conclusion.idVencido != null
            ? `Antigüedad del vencido de ${entidad} si se declara por tramos (hoy, vencido: ${R(conclusion.idVencido)})`
            : `Detalle del saldo de ${entidad}, por concepto`);
        } else if (plan.tema === "inventario") {
          _push(`Rotación y bodega de ${entidad}`);
        }
      }
    } else if (plan.kind === "grupo" || plan.kind === "grupoUniverso") {
      if (plan.tema === "comercial") _push(`Ranking completo por ${_RCo("no_capturada")}`);
      else if (plan.tema === "cobranza") _push(`Ranking completo por ${_RCo("saldo_vencido")}`);
      else if (plan.tema === "inventario") _push(`${_RC("capital_frenado")} por bodega`);
    } else if (plan.kind === "multitema") {
      for (const d of plan.temas) {
        if (d === "inventario") _push("El cruce por SKU entre venta e inventario");
        if (d === "cobranza") _push("La cobranza cruzada con la venta, cuenta por cuenta");
      }
    }
  }
  return out;
}

/* la entidad que "representa" un tema para una pregunta de «Para su juicio» que necesita SUJETO (nunca una
 * pregunta genérica sin nombre): la que el pedido ya nombró (entidad-plan) o, si no, la que lidera el
 * ranking/la prioridad de ese tema — nunca una entidad inventada ni la primera del índice del tenant. */
function _entidadRepresentativaDeTema(tema, planes) {
  for (const p of planes) if (p.tema === tema && p.kind === "entidad" && p.filasPorEntidad.length) return p.filasPorEntidad[0].entidad;
  for (const p of planes) if (p.kind === "multitema" && p.lideres && p.lideres[tema]) return p.lideres[tema].x.entidad;
  for (const p of planes) {
    if (p.tema !== tema) continue;
    if (p.kind === "grupo" && p.orden && p.orden.length) return p.orden[0];
    if (p.kind === "grupoUniverso" && p.miembros && p.miembros.length) return p.miembros[0];
  }
  return null;
}

/* R2/R3, GENERALIZADO A TODO EL ALCANCE (supervisor 2026-09-26, segunda vuelta, MATERIAL, carnada W79) — una
 * entidad que `buildRolesCartera` propone desde el PORTAFOLIO ENTERO solo puede nombrarse en «Para su juicio» si
 * está DENTRO del alcance que ALGUNA parte comercial declaró: nunca excluida por esa parte (`excluir`), y si esa
 * parte acotó el eje con `top`/`base`/`estados`/`no_estados`/`filtros`, solo si pertenece a ESE conjunto — misma
 * primitiva (`conjuntoDeUniverso`, notario/verificar.js) que ya usa `_planCifraGrupo`/`figsEnAlcance` para
 * recortar lo servido, nunca una segunda definición de alcance. Con top 3 «menor», Falabella (el más grande) NO
 * puede volver nombrada acá aunque `rolesCartera` la proponga por su carga — es la MISMA ley que ya protegía
 * `excluir`, generalizada a los demás campos de `CAMPOS_UNIVERSO`.
 * ENTRE PARTES el criterio es UNIÓN, no intersección (supervisor 2026-09-26, decisión explícita de la segunda
 * vuelta): «una entidad es legítima si está dentro del alcance de ALGUNA parte comercial, porque cada parte es
 * algo que el usuario pidió; exigir todas a la vez borraría entidades pedidas». DENTRO de una misma parte, sus
 * restricciones siguen combinándose TODAS juntas (una sola llamada a `conjuntoDeUniverso` con todos sus campos,
 * `_entidadEnAlcanceDeUnaParte`) — eso no cambió. */
/* RAÍZ A (supervisor 2026-09-29, bug real — 12 aserciones de v7/v9/v11, no una consecuencia de la redefinición de
 * «frenado»): tres sitios de este archivo resuelven el universo DECLARADO de una parte (`base`/`estados`/
 * `no_estados`/`filtros`/`bodega`/`union`, con o sin `top`) contra `conjuntoDeUniverso` — la MISMA primitiva que
 * usa el Notario. Cuando esa resolución no puede demostrarse (`{error}`, sin `.set` — p. ej. un `union` con una
 * rama `estados:["frenado"]` y la empresa no declaró el umbral: `notario/verificar.js:_setDeEstado` devuelve
 * `{error:"universo-no-resoluble: …"}`), la parte tiene que FALLAR CERRADO: nunca servir el conjunto CRUDO (todo
 * lo que trajo fig para los conceptos pedidos, que en la práctica casi siempre es el eje entero) como si la
 * restricción declarada no existiera — eso deshace en silencio lo que el usuario pidió (§7.3·17). Antes, dos de
 * los tres sitios (`_entidadesDelTopVerificado`, la rama sin `top` de `_planCifraGrupo`) solo miraban `R.set` para
 * decidir si HABÍA que actuar y nunca revisaban `R.error` para decidir DECLINAR — un `try/catch` no ve ese caso
 * porque `conjuntoDeUniverso` nunca lanza, siempre RETORNA `{error}` como valor normal. Único punto que decide
 * esto para los tres sitios: mismo criterio, un solo lugar. */
function _resolverConjuntoDeclarado(campos, indice, eje) {
  if (!indice) return { R: null };
  let R = null;
  try { R = conjuntoDeUniverso({ eje, ...campos }, indice, eje, ""); } catch (e) { R = { error: `error-de-conjunto: ${e && e.message ? e.message : e}` }; }
  return { R };
}
function _entidadEnAlcanceDeUnaParte(nNorm, p, I, planPorParte) {
  const alcance = alcanceDeParte(p);
  if ((alcance.excluir || []).some((x) => normalizar(x) === nNorm)) return false;
  // R-INICIATIVA-PREGUNTA-ABIERTA-SIN-ALCANCE (diagnóstico v6, ALTA) — cuando la parte YA tiene un plan compuesto
  // (`_planCifraGrupo`/`_cerrarGrupoUniverso`, `plan.orden`), ESE es el universo real que la Entrega sirve: la
  // MISMA tool call, con su `sort`/`limit` ya corregidos (`_entidadesDelTopVerificado`). Reusarlo evita repetir la
  // resolución contra `I.rankings`, que puede venir PARCIAL (solo trae las k filas que la tool pidió) — un
  // `top`/dirección «menor» sobre un ranking parcial truena en `ranking-parcial` más abajo, y ese error se leía
  // antes como «sin restricción», dejando pasar CUALQUIER entidad (W49: Falabella y Jumbo, los MÁS GRANDES, en
  // una parte que pedía justo los 3 más chicos).
  const plan = planPorParte && planPorParte.get(p.id);
  if (plan && Array.isArray(plan.orden) && plan.orden.length) return plan.orden.some((e) => normalizar(e) === nNorm);
  const eje = alcance.eje || "cliente";
  const camposDeclarados = {};
  if (alcance.base) camposDeclarados.base = alcance.base;
  if (alcance.estados) camposDeclarados.estados = alcance.estados;
  if (alcance.no_estados) camposDeclarados.no_estados = alcance.no_estados;
  if (alcance.filtros) camposDeclarados.filtros = alcance.filtros;
  if (alcance.top) camposDeclarados.top = alcance.top;
  if (Object.keys(camposDeclarados).length && I) {
    const { R } = _resolverConjuntoDeclarado(camposDeclarados, I, eje);
    if (R && R.set) return R.set.has(nNorm);
    // no se pudo verificar (p. ej. `ranking-parcial`, u otro «universo-no-resoluble»): la parte SÍ declaró una
    // restricción real y no hay cómo demostrar que la entidad quedó dentro — falla CERRADO, nunca abierto («nada
    // se sustituye por un vecino» incluye no poder demostrarlo). Este sitio ya fallaba cerrado antes de RAÍZ A
    // (arriba); ahora comparte el mismo helper que los otros dos, sin cambiar su resultado.
    return false;
  }
  return true;
}
function _entidadEnAlcanceComercial(nombre, partesComercial, I, planPorParte) {
  const nNorm = normalizar(nombre);
  if (!nNorm) return false;
  if (!partesComercial.length) return true;   // sin partes comerciales que resolver: nada que aplicar, nunca se excluye a ciegas
  // UNIÓN entre partes — decisión explícita del supervisor (ver la nota grande arriba de `_entidadEnAlcanceDeUnaParte`,
  // 2026-09-26, segunda vuelta): «una entidad es legítima si está dentro del alcance de ALGUNA parte comercial,
  // porque cada parte es algo que el usuario pidió». Eso NO cambia acá. El defecto real (R-INICIATIVA-PREGUNTA-
  // ABIERTA-SIN-ALCANCE, diagnóstico v6) no estaba en el `.some()`: estaba en `_entidadEnAlcanceDeUnaParte`, que
  // trataba «no pude verificar el universo» (`conjuntoDeUniverso` con `ranking-parcial`, p. ej.) como si fuera
  // «sin restricción» — corregido ahí, nunca acá.
  return partesComercial.some((p) => _entidadEnAlcanceDeUnaParte(nNorm, p, I, planPorParte));
}

/* un universo con `estados`/`no_estados`/`filtros` exige evaluar el ESTADO de cada entidad contra el dato real
 * (notario/estados.js aplicado a un universo completo) — un subsistema que este corte NO construye (gap declarado
 * en la cabecera) SOLO cuando no trae `top`: sin `top`, el listado es del CONJUNTO completo (K de M, sin ranking
 * — `_cerrarGrupoUniverso` abajo). CIERRE §7.3·8 (supervisor 2026-09-27, diagnóstico v7, raíz A1) — con `top`, la
 * combinación YA compone: `_planCifraGrupo`/`figsEnAlcance` (`entrega/alcance.js`) resuelven `top` combinado con
 * `estados`/`no_estados`/`filtros`/`base` en la MISMA llamada a `conjuntoDeUniverso` que ya usa el Notario, en
 * los dos sentidos de la decisión (`top.sobre`). El comentario de «corte 3c» describía un estado que el contrato
 * ya superó — `_universoNoSoportado` deja de bloquear esa combinación: hoy es, textualmente, la MISMA condición
 * que «universo por estado SIN top» (`_universoPorEstadoSinTop`), porque esa es la ÚNICA combinación que sigue
 * sin motor propio. */
const _tieneEstadoOFiltro = (u) => !!(u && ((Array.isArray(u.estados) && u.estados.length) || (Array.isArray(u.no_estados) && u.no_estados.length) || (Array.isArray(u.filtros) && u.filtros.length)));
const _universoPorEstadoSinTop = (u) => _tieneEstadoOFiltro(u) && !(u && u.top);
const _universoNoSoportado = _universoPorEstadoSinTop;
// §7.3·17 (supervisor 2026-09-27, diagnóstico v8, raíz A2) — el universo PROPIO de una parte: cualquier campo
// que recorta el eje entero (top, base, bodega, union, o estados/no_estados/filtros — con o sin top). Una parte
// con AL MENOS uno de estos declarado tiene que componerse sobre ESE universo, nunca sobre la lente de negocio
// del dominio (`_planMultiTema`), que queda reservada para la parte genuinamente sin restricción propia.
// §7.3·39(d): una EXCLUSIÓN (`excluir`) también recorta. La prueba es UNA sola, en `encargo/esquema.js`, compartida con
// `encargo/lecturasDe.js` y `entrega/verificar.js` (antes tres copias).
const _tieneUniversoPropio = universoTieneRestriccionPropia;

/* ═══ CORTE 3c · PIEZA 1 (owner 2026-09-25) — UNIVERSO POR ESTADO, con los CONJUNTOS que el Core ya calcula ═══════
 * «Sobre el nivel de carga», «bajo el benchmark», «en mora», «frenado»… no son un motor de estados nuevo: son
 * `conjuntoDeUniverso(universo, I, eje)` — LA MISMA primitiva que ya evalúa un universo tipado para el Notario v3
 * (hechos.js:_conteoTipado la llama igual, para una premisa declarada por el modelo). `I.rankings` (de
 * `datoProyectado`, ver `_indiceDelTenant` en este archivo) trae CADA entidad del eje, no solo las que la boleta
 * de este turno imprimió — así que el filtro se evalúa sobre el eje ENTERO, nunca solo sobre lo impreso. Si el
 * Core no puede resolver el universo (`U.error` — ninguna clave del eje, ranking parcial, etc.), esta parte
 * declina con el motivo REAL (nunca "no se aplica todavía"): `concepto_sin_productor` no es lo mismo que
 * "el dato no alcanza para este umbral", y el límite lo dice.
 * El conteo «K de M» entra al libro como hecho `conteo` VERIFICADO — no se afirma un número a mano: se mide con
 * `conjuntoDeUniverso` primero y se declara ESE número, así que el hecho verifica por construcción (mismo patrón
 * que `_declararUniverso` ya usa para nombrar un universo con `validarUniverso`/`nombrarUniverso`). */
function _planCifraGrupoUniverso(parte, figs, I) {
  const u = parte.universo;
  const eje = normalizarEje(u.eje || parte.eje || "cliente");
  let U = null;
  try { U = conjuntoDeUniverso(u, I, eje, ""); } catch (e) { U = { error: `error-de-conjunto: ${e && e.message ? e.message : e}` }; }
  if (!U || U.error) return { error: (U && U.error) || `universo-no-resoluble: «${JSON.stringify(u)}» no se pudo evaluar contra el dato` };
  if (!U.set) return { error: "universo-no-restringido: el universo declarado no filtra nada (equivale al eje entero) — nada que listar como grupo" };
  const total = I.tamanoDelEje(eje);
  const miembros = [...U.set].map((k) => (I.entidades.get(k) || { nombre: k }).nombre);
  // A11 (supervisor 2026-09-27, diagnóstico v8, §7.3·16 — «un universo válido puede resolver VACÍO») — antes,
  // un conjunto vacío (`U.set` existe, tamaño 0: el universo SÍ se resolvió, solo que ninguna entidad lo cumple)
  // se trataba como error y tumbaba la Entrega entera («ninguna parte se pudo componer»). La regla nueva del
  // contrato es la contraria: la parte se resuelve, declara «0 de M» y no sirve a nadie — nunca es
  // `universo_invalido`. Se deja fluir con `miembros: []`; el resto de esta función (orden, tentación,
  // `_declararConteo` con n=0) ya sostiene un grupo vacío sin cambios.
  const conceptos = parte.conceptos && parte.conceptos.length ? parte.conceptos.slice() : [];
  // orden de exhibición: por el primer concepto declarado si es una cifra medible (de mayor a menor); si no hay
  // concepto o no es medible, el orden que ya trae el conjunto (estable, sin inventar un criterio nuevo).
  const claveOrden = conceptos.find((c) => claveDeMetrica(c) && unidadDeClave(claveDeMetrica(c))) || null;
  const porEntidad = new Map();
  for (const nombre of miembros) {
    const m = new Map();
    for (const c of conceptos) { const f = _filaDe(figs, nombre, c); if (f) m.set(c, f); }
    porEntidad.set(nombre, m);
  }
  /* FAMILIA 2 (decisión 30 · §7.3·45a/49c/51b): cada miembro del universo tiene su fila en cada concepto pedido que su productor publica (la boleta del turno, la proyección o su cero de cobertura declarada); el miembro sin la cifra se DECLARA en todos los temas («sin dato de X para Y»), nunca se omite */
  const faltantes = completarGrupo({ nombres: miembros, conceptos, porEntidad, eje, I });
  // orden de exhibición: SIEMPRE de mayor a menor en `claveOrden` — un grupo filtrado por estado/umbral es, por
  // construcción, un grupo de "casos" (sobre el nivel de carga, bajo el benchmark, en mora…): el más extremo
  // primero es la convención que ya usa el resto de la casa (mesaFlujo «vencido primero», prioridadIntegrada «el
  // que más pesa primero») — nunca la polaridad de la métrica (que dice qué es "bueno", no en qué orden listar un
  // grupo de "los que fallan el criterio"). DECISIÓN DE PRESENTACIÓN, no de significado: reportada al supervisor.
  let orden = miembros.slice();
  if (claveOrden) {
    orden = miembros.slice().sort((a, b) => {
      const fa = porEntidad.get(a).get(claveOrden), fb = porEntidad.get(b).get(claveOrden);
      const va = fa && Number.isFinite(fa.raw) ? fa.raw : NaN, vb = fb && Number.isFinite(fb.raw) ? fb.raw : NaN;
      if (!Number.isFinite(va) || !Number.isFinite(vb)) return 0;
      return vb - va;
    });
  }
  // la CIFRA DE LA TENTACIÓN (pieza 2 del corte 3c) es independiente de `claveOrden` (el criterio de EXHIBICIÓN):
  // el primer concepto MONETARIO entre los declarados — sumar/participar tiene sentido en dinero, nunca en una
  // tasa («las tasas no se suman», notario/hechos.js) aunque esa tasa sea la que ordena la lista (D07: ordena por
  // «carga», la tentación es sobre «ventas»; D19: ordena y tienta sobre «no_capturada», que sí es dinero).
  const claveTentacion = conceptos.find((c) => claveDeMetrica(c) && unidadDeClave(claveDeMetrica(c)) === "money") || null;
  return { kind: "grupoUniverso", tema: parte.tema, parteId: parte.id, cierre: parte.cierre, eje, universo: u, miembros: orden, n: U.set.size, m: total, fuenteConteo: U.fuente, conceptos, claveOrden, claveTentacion, porEntidad, faltantes };
}
const normalizarEje = (e) => String(e || "cliente").trim().toLowerCase();

/* CORTE 3c · PIEZA 2 (owner 2026-09-25) — EL LÍMITE DE CANTIDAD de tentaciones precalculadas por grupo, para no
 * inflar el libro con una participación individual por cada fila de un grupo grande (D07 tiene 9 cuentas: nadie
 * necesita "la participación de CADA una sobre el total" para no tener que calcularla a mano — con el total y la
 * del primero, la tentación de sumar/repartir a mano ya queda cubierta). Constante técnica, ajustable; DECISIÓN
 * REPORTADA AL SUPERVISOR (no hay un número «correcto» en el contrato): 1 — el total del grupo, siempre, más la
 * participación de UN SOLO miembro (el primero por `claveOrden`, la exhibición ya elegida) — nunca una fila por
 * miembro. Si el owner prefiere un N mayor (ej. la participación de los primeros 3), este es el único número que
 * cambia. */
export const TENTACION_PARTICIPACION_TOP = 1;
/* declara el hecho `conteo` VERIFICADO del grupo (K de M) — `n` YA es el tamaño medido por `conjuntoDeUniverso`
 * arriba (nunca un número afirmado a mano): el hecho verifica por construcción, igual que `_declararRef` declara
 * una fig que YA existe. Mismo patrón que `_declararRef`/`_declararUniverso` de este archivo (un solo lugar que
 * empuja al array `hechos` con el contador compartido del turno). */
function _declararConteo(hechos, contador, universo, n) {
  const id = `e${++contador.n}`;
  hechos.push({ id, tipo: "conteo", conteo: { n }, de: universo });
  return id;
}
/* CORTE 3c · PIEZA 2 (owner 2026-09-25) — la SUMA de N cifras del MISMO concepto/universo/unidad (nunca dos
 * universos distintos: `notario/hechos.js:_derivada` ya rechaza una suma de dominios distintos como
 * no-verificable — «carnada con dientes», el candado no es de este archivo, se reusa). N arbitrario: `_derivada`
 * ya reduce con `raws.reduce(...)`, no hay límite de operandos en la verificación. */
function _declararSuma(hechos, contador, ids) {
  const limpios = (ids || []).filter((x) => x != null);
  if (limpios.length < 2) return null;
  const id = `e${++contador.n}`;
  hechos.push({ id, tipo: "derivada", op: "suma", de: limpios.map((x) => ({ id: x })) });
  return id;
}
/* cierra un plan «grupoUniverso»: declara el conteo K-de-M, las figs de cada miembro (una vez cada una, MISMO
 * patrón «declarar antes de imprimir») y la tentación precalculada (total + participación del primero) cuando el
 * concepto que ordena el grupo es una cifra monetaria — nunca sobre una tasa (pieza 2: «jamás se suman universos
 * distintos», y sumar % entre cuentas tampoco es una cifra de la casa). Usado por las dos formas que la pieza 1
 * cubre: `cifra` sin entidades (D07) y `lectura`/`decision` sin entidades (D14/D19). */
function _cerrarGrupoUniverso(p, figsDeP, I, hechos, contador, ref, declararRazon, declararDerivada, criterio = null) {
  const gp = _planCifraGrupoUniverso(p, figsDeP, I);
  if (gp.error) return { error: gp.error };
  const idConteo = _declararConteo(hechos, contador, gp.universo, gp.n);
  // A5 (diagnóstico v7) — capturar las figs CRUDAS del primero y segundo miembro en `claveOrden` ANTES de
  // convertir el mapa a ids (mismo patrón que `kind:"grupo"`, más abajo en este archivo): nunca una segunda
  // referencia a la fig.
  const figA0 = gp.claveOrden && gp.miembros.length > 1 ? _mapaDe(gp.porEntidad, gp.miembros[0]).get(gp.claveOrden) : null;
  const figB0 = gp.claveOrden && gp.miembros.length > 1 ? _mapaDe(gp.porEntidad, gp.miembros[1]).get(gp.claveOrden) : null;
  /* FAMILIA 1: la decisión de prioridad es de `prioridad.js`. v23: la lente que aplica al dominio ordena la prioridad del grupo (se lee antes de pasar las figs a ids). §7.3·50(a): la lista del grupo exhibe los casos de mayor a menor (y «X concentra el N %» nombra al mayor); la PRIORIDAD de una `decision` nombra a quien pide atención por la medida nombrada. Nunca corona al mejor. */
  /* §7.3·56 + 57(a)(b): la lente «crecimiento» ordena a los miembros del universo por la variación EN %, completada con la proyección para quien la boleta no la trae (en un mapa APARTE: no agrega filas a la tabla del grupo); a quien el dato no trae se le declara «sin dato de X para Y» (52b) */
  let _porEntidadPrio = gp.porEntidad;
  { const _cLente = p.cierre === "decision" ? conceptoDeLaMedidaParcial(criterio, p.tema) : null;
    if (_cLente && productorDe(_cLente, gp.eje)) {
      _porEntidadPrio = new Map([...gp.porEntidad].map(([k, m]) => [k, new Map(m)]));
      for (const n of gp.miembros) { const m = _porEntidadPrio.get(n) || new Map(); if (!m.has(_cLente)) { const f = _filaDe(figsDeP, n, _cLente); if (f && Number.isFinite(f.raw)) m.set(_cLente, f); } _porEntidadPrio.set(n, m); }
      for (const f of completarGrupo({ nombres: gp.miembros, conceptos: [_cLente], porEntidad: _porEntidadPrio, eje: gp.eje, I })) if (!gp.faltantes.some((y) => y.entidad === f.entidad && y.clave === f.clave)) gp.faltantes.push(f);
    } }
  const prio = prioridadDeParte({ criterio, tema: p.tema, cierre: p.cierre, entidades: gp.miembros, claveOrden: gp.claveOrden, valorDe: (n) => { const fg = _mapaDe(gp.porEntidad, n).get(gp.claveOrden); return fg && Number.isFinite(fg.raw) ? fg.raw : NaN; }, proyeccion: valoresDeProyeccion(I, gp.eje, gp.claveOrden), figs: figsDeP, porEntidad: _porEntidadPrio });
  alOrdenServido(prio, gp.miembros);   /* §7.3·55(c): la lista tras «ninguna cuenta queda primera» va en el orden servido (el de `miembros`, el de la tabla) */
  const { lenteGrupo, primeroAtencion } = prio;
  /* v23 (R65): un total que vale CERO no es base de ninguna participación («0 de 0» no es una razón): un grupo donde la medida vale cero para todos no tumba la Entrega, simplemente no declara participación (el cero se dice con su cifra en la fila). Se lee ANTES de pasar las figs a ids. */
  const _totalDeLaTentacionEsCero = !!(gp.claveTentacion && (() => { const fs = gp.miembros.map((n) => _mapaDe(gp.porEntidad, n).get(gp.claveTentacion)).filter((f) => f && typeof f === "object"); return fs.length > 0 && fs.every((f) => Number.isFinite(f.raw) && f.raw === 0); })());
  for (const nombre of gp.miembros) { const m = _mapaDe(gp.porEntidad, nombre); for (const [clave, fig] of m) m.set(clave, ref(fig)); }
  _declararLenteDelGrupo(lenteGrupo, ref, gp.porEntidad);   /* v23: después de pasar las figs a ids (reusa el de la tabla) */
  let idTotal = null, idShare = null;
  let idShares = [];
  if (gp.claveTentacion && gp.miembros.length >= 2 && !_totalDeLaTentacionEsCero) {
    const ids = gp.miembros.map((nombre) => _mapaDe(gp.porEntidad, nombre).get(gp.claveTentacion)).filter((x) => x != null);
    if (ids.length >= 2) {
      idTotal = _declararSuma(hechos, contador, ids);
      // el LÍMITE DE CANTIDAD (TENTACION_PARTICIPACION_TOP, pieza 2): una participación individual por MIEMBRO,
      // nunca una por fila — se corta acá, no se deja crecer con el tamaño del grupo (D07 tiene 9 cuentas).
      if (idTotal) for (const idMiembro of ids.slice(0, TENTACION_PARTICIPACION_TOP)) { const s = declararRazon(idMiembro, idTotal); if (s) idShares.push(s); }
      idShare = idShares[0] || null;
    }
  }
  // A5 (diagnóstico v7, MATERIAL) — tentación precalculada GENÉRICA: la ventaja del primero sobre el segundo en
  // la MISMA métrica que ordena el grupo (`claveOrden`), el MISMO mecanismo que ya usa `kind:"grupo"` — nunca dos
  // veces, reutilizado tal cual. `idTotal`/`idShare` (arriba) SOLO corren con un concepto MONETARIO
  // (`claveTentacion`): «días de inventario», «margen»… no tienen ese concepto y antes se quedaban sin NINGUNA
  // tentación precalculada (Y08, Y54 — `verificarEntrega` regla 6 exige razon/derivada con ≥2 dueños). Una
  // DIFERENCIA (`declararDerivada` decide pp/diferencia según la unidad) no depende de que el concepto sea
  // dinero: cierra la clase completa, no solo el caso monetario.
  const idDiffOrden = (figA0 && figB0)
    ? declararDerivada(figA0, _mapaDe(gp.porEntidad, gp.miembros[0]).get(gp.claveOrden), figB0, _mapaDe(gp.porEntidad, gp.miembros[1]).get(gp.claveOrden))
    : null;
  return { kind: "grupoUniverso", tema: p.tema, parteId: p.id, cierre: p.cierre, eje: gp.eje, universo: gp.universo, idConteo, n: gp.n, m: gp.m, fuenteConteo: gp.fuenteConteo, faltantes: gp.faltantes, miembros: gp.miembros, claveOrden: gp.claveOrden, claveTentacion: gp.claveTentacion, porEntidad: gp.porEntidad, idTotal, idShare, idShares, idDiffOrden, prioridad: prio, ...(lenteGrupo ? { lenteGrupo } : {}), ...(primeroAtencion ? { primeroAtencion } : {}) };
}

/* ═══ CORTE 3c · PIEZA 3 (owner 2026-09-25) — A QUÉ PARTE DEL ENCARGO PERTENECE UNA PREMISA ═══════════════════
 * Por el DOMINIO de su métrica o de su estado (`notario/lexico.js:dominioDeClave`, `notario/hechos.js:
 * dominioDeEstado` — las MISMAS tablas que ya usa el Notario, nunca una lista nueva ni una lectura de
 * `preguntaOriginal`). Sin dominio reconocible, o sin una parte útil de ese tema, cae en la PRIMERA parte útil —
 * el caso de casi todo el catálogo de desarrollo (una sola parte por encargo: D07/D19/D22/D23/D25/D29/D43). */
function _dominioDePremisa(p) {
  if (!p) return null;
  const tipo = String(p.tipo || "").toLowerCase();
  if (tipo === "estado") {
    const eRaw = (p.estado && typeof p.estado === "object") ? p.estado.estado : p.estado;
    const c = estadoCanon(String(eRaw || "").replace(/^\s*no[ _]+/i, "").replace(/_/g, " "));
    return dominioDeEstado(c);
  }
  const claveDe = (m) => (m != null ? claveDeMetrica(m) : null);
  const clave = claveDe(p.metrica) || claveDe(p.num && p.num.metrica) || claveDe(p.den && p.den.metrica);
  return clave ? dominioDeClave(clave) : null;
}
function _parteDePremisa(p, partesUtiles) {
  const dom = _dominioDePremisa(p);
  if (dom) { const m = partesUtiles.find((x) => x.tema === dom); if (m) return m.id; }
  return partesUtiles.length ? partesUtiles[0].id : null;
}
/* el texto canónico del veredicto — de los CAMPOS del hecho evaluado (`H.verdad`/`H.motivo`, la MISMA prosa que
 * `notario/hechos.js:textoDelLibro` ya arma para el Notario), nunca de `preguntaOriginal`: «verdadera» dice lo
 * medido, «falsa» dice lo medido MÁS la verdad con id (los hechos `_verdadDeLoFalso` ya declaró — H.derivados),
 * «no verificable» dice por qué. La CONCLUSIÓN de la parte (quién es prioridad, qué cifra manda) es del análisis
 * de arriba, no de este texto — ley «premisa-adoptada»: acá solo se declara el veredicto, nunca se decide con él. */
/* AGREGADO (supervisor, revisión de cierre del 3d / corte 3e, 2026-09-26) — `H.verdad` (notario/hechos.js) es,
 * para los hechos que pasan por el juez general (orden · relacion · grupo · conteo · variacion · estado), una
 * traza INTERNA de depuración del Notario («ranking cliente · variacion · Mercado Libre = 25.3%») — nunca prosa
 * pensada para el lector. `_textoDePremisa` la imprimía verbatim. Acá se arma un RÓTULO DE LA CASA con los
 * mismos campos que el libro ya expone y verificó — `H.evidencia` (labels REALES "Entidad · Concepto" de la
 * boleta, nunca una clave interna), `H.claves`, `H.numeros`, `H.direccion` — jamás la clave interna del ranking
 * ni el separador «·» de índice. Los hechos `ref`/`razon`/`derivada` siguen usando `H.verdad`: para ESOS tipos ya
 * es prosa de la casa (`_fmtFig`, notario/hechos.js) — esta función solo interviene donde el veredicto general
 * podía filtrar sintaxis interna. Sin evidencia suficiente para un rótulo, cae a `H.verdad`/`H.motivo` (nunca
 * deja el veredicto sin texto). */
const _VERBO_DIRECCION_PREMISA = { sube: "creció", baja: "cayó" };
/* v20 (§7.3·44a): el empate del filo de un top se dice con los empatados y el puesto compartido: «empatado con Tottus en el puesto 8» (un sujeto) o «Tottus y Paris empatan en el puesto 8» (varios) */
function _listaDeNombres(xs) { return xs.length > 1 ? `${xs.slice(0, -1).join(", ")} y ${xs[xs.length - 1]}` : String(xs[0] || ""); }
function _fraseEmpateFilo(e) {
  const otros = e.entidades.filter((x) => !e.sujetos.includes(x));
  return e.sujetos.length === 1 && otros.length ? `empatado con ${_listaDeNombres(otros)} en el puesto ${e.n}` : `${_listaDeNombres(e.entidades)} empatan en el puesto ${e.n}`;
}
function _rotuloDeLaCasaDeH(H) {
  const r = _rotuloBaseDeLaCasaDeH(H);
  const _ef = H && H.render ? H.render.empateFilo : null;
  /* v22 (S03 · S04, §7.3·39c): el empate en CERO dice su cifra con las palabras de la casa («no tiene capital inmovilizado crítico ($0)»); en plural, «no tienen»; si la oración ya dice el cero de su sujeto («no tiene … (0 días)»), no se repite */
  const _cero = _ef && _ef.cero && !/\bno tiene\b/.test(r || "") ? `; ${dichoElCero(_ef.cero.nombre, _ef.cero.texto).replace(/^no tiene\b/, _ef.sujetos.length > 1 ? "no tienen" : "no tiene")}` : "";
  return r && _ef ? `${r}, ${_fraseEmpateFilo(_ef)}${_cero}` : r;
}
function _rotuloBaseDeLaCasaDeH(H) {
  const r = _rotuloDeLaCasaLegado(H);
  if (r) return r;
  // la pertenencia de un grupo VERDADERO (decisión del supervisor 2026-09-29, v13): «<entidades> pertenece(n) a <universo en palabras de la casa>», más la referencia que el universo cita si el texto aún no la dice
  const pt = H && H.render && H.render.pertenencia;
  if (pt && pt.entidades && pt.entidades.length && pt.universo) {
    const refP = H.render.referencia && !pt.universo.includes(H.render.referencia) ? `, ${H.render.referencia}` : "";
    return `${pt.entidades.join(", ")} ${pt.entidades.length > 1 ? "pertenecen" : "pertenece"} a ${pt.universo}${refP}`;
  }
  return null;
}
function _rotuloDeLaCasaLegado(H) {
  // R-ROTULO-CONTEO-FILTRO (supervisor 2026-09-26, MATERIAL) — un `conteo` (con o sin sujeto) no tiene una fig
  // «Entidad · Concepto» propia: su `H.evidencia[0]` es un DESCRIPTOR de universo/filtro concatenado con «·»
  // (`_filtroTipado`/`_setDeEstado`, notario/verificar.js — p. ej. «en mora (saldo vencido > 0) · margen <
  // Benchmark de margen = 30.1 (8)»), la MISMA forma superficial que una fig real («Entidad · Concepto») pero
  // nunca una. El resto de esta función solo excluye el prefijo «ranking » — así que ese descriptor se leía como
  // fig, `_entidadDe` tomaba «en mora (saldo vencido > 0)» como si fuera el nombre de una entidad, y `H.numeros[0]`
  // (el CONTEO declarado, p. ej. 5) se pegaba a esa «entidad» como si fuera su cifra: «en mora (saldo vencido >
  // 0): benchmark de margen 5» — una oración que no dice nada verdadero ni verificable. `_conteoTipado`
  // (notario/hechos.js) YA arma la oración correcta desde la ESTRUCTURA del hecho — «K de M en <universo, en
  // palabras de la casa>: <miembros>» (`H.verdad`, con `nombrarUniverso` — el mismo helper que declara cualquier
  // universo tipado de la casa) — así que un `conteo` siempre cae a `H.verdad`/`H.motivo` (el fallback que esta
  // función ya usaba para «sin evidencia suficiente»), nunca a un rótulo genérico armado para `orden`/`variacion`.
  if (H.tipo === "conteo") return null;
  // DECISIÓN 37a (supervisor 2026-09-29, diagnóstico v13 — A2 + A3): la premisa de GRUPO falsa sobre una entidad dice su verdad con dueño —la entidad, su cifra de LA
  // MÉTRICA que define el universo (nunca la de otra), su puesto real si el universo es un top y, si la excluye un estado, el estado en que SÍ está—, armada por el libro
  // (`notario/hechos.js:_verdadPropiaDeGrupo`); acá solo se escribe. Sin claves internas ni el `k` del top.
  // DECISIÓN 38(a) (diagnóstico v14 · A3): el MISMO registro vale para el ORDEN y la RELACIÓN falsos —el libro arma `contra` (la otra entidad con su cifra: un comparativo o una relación dicen las DOS cifras),
  // `puesto` (el real del sujeto) y `ocupantes` (quién ocupa el puesto afirmado, con su cifra)—; una cifra 0 por ausencia (`metrica.ausente`: la entidad no pertenece al conjunto que la métrica define)
  // se dice «no tiene …», nunca «(ausente = 0)».
  // 39(c) (diagnóstico v15): UN criterio para toda métrica —un cero, medido o por ausencia del conjunto, se dice «no tiene …» junto a su cifra (`dichoElCero`, la forma de la casa en el léxico)—.
  /* §7.3·39(a) (presentación, v33 F09.q3): todo porcentaje se escribe con el formato de la casa. La cifra propia que trae un % con SIGNO y un decimal de más («-5.0%», el del productor) se dice con `formatoDeLaCasa` («-5%») cuando ese texto conserva el valor a la precisión de lo impreso; si no lo conserva se deja el impreso. Solo la forma en que se ESCRIBE: ni el valor ni el libro cambian */
  const _textoDeLaCifraPropia = (m) => {
    const t = m && m.texto != null ? String(m.texto) : "";
    if (!m || m.unidad !== "pct" || !Number.isFinite(m.raw)) return t;
    const x = /^([+\-−])\s*(\d+)(?:[.,](\d+))?\s*%$/.exec(t);
    if (!x) return t;
    const casa = formatoDeLaCasa(m.raw, "pct");
    return Math.abs(parseFloat(casa) - m.raw) <= 0.5 * Math.pow(10, -(x[3] ? x[3].length : 0)) + 1e-9 ? `${x[1] === "+" ? "+" : ""}${casa}` : t;
  };
  const _dice = (m) => (m ? (m.ausente || esCero(m.raw, m.unidad) ? dichoElCero(m.nombre, m.texto) : `${m.nombre} ${_textoDeLaCifraPropia(m)}`) : "");
  /* v18: un puesto EMPATADO dice con quién comparte el puesto (X46 · X83) */
  const _textoDelPuesto = (p, nombreM) => `puesto ${p.n} de ${p.de} al ordenar de ${p.dir === "menor" ? "menor a mayor" : "mayor a menor"} por ${nombreM}${Array.isArray(p.empatadoCon) && p.empatadoCon.length ? `, empatado con ${p.empatadoCon.length > 1 ? `${p.empatadoCon.slice(0, -1).join(", ")} y ${p.empatadoCon[p.empatadoCon.length - 1]}` : p.empatadoCon[0]}` : ""}`;
  /* v19 (Y74 · Y33): la consulta excluyó su bodega: esa es la razón, con el nombre de la bodega (sin cifra ni puesto, como la exclusión por nombre) */
  const _fraseDeVP = (vp, yaDichas = null, refGlobal = null) => {
    if (vp.excluidaPorLaConsulta) return `${vp.entidad}: fuera del universo por exclusión de la consulta`;
    if (vp.excluidaPorBodega) return `${vp.entidad}: fuera del universo por su bodega (${vp.excluidaPorBodega}), que la consulta excluye`;
    /* v20 (U62): la bodega del SKU no es la que la consulta pidió: esa es la razón (sin cifra ni puesto: el puesto de un SKU dentro del top leería como si el grupo lo incluyera) */
    if (vp.fueraPorBodegaPedida) return `${vp.entidad}: fuera del universo por su bodega (${vp.fueraPorBodegaPedida.propia}), distinta de la pedida (${vp.fueraPorBodegaPedida.pedida})`;
    const nombreM = vp.metrica ? vp.metrica.nombre : null;
    const partes = [];
    if (vp.estado) partes.push(`está ${vp.estado.texto}`);
    if (vp.metrica) partes.push(_dice(vp.metrica));
    if (vp.puesto) partes.push(_textoDelPuesto(vp.puesto, nombreM));
    /* v19 (Y10): una unión dice, por rama, la cifra de la condición que la entidad no cumple */
    if (Array.isArray(vp.otras)) for (const o of vp.otras) partes.push(_dice(o));
    /* v19 (Y14 · Y10): la referencia de LA condición que la entidad no cumple viaja en SU frase (una vez por oración), salvo que la oración ya la lleve al final (`H.render.referencia`) */
    if (vp.referencia && yaDichas) for (const r of String(vp.referencia).split(", ")) { if (!r || yaDichas.has(r) || (refGlobal && String(refGlobal).includes(r))) continue; yaDichas.add(r); partes.push(r); }
    return `${vp.entidad}: ${partes.join(", ")}`;
  };
  /* §7.3·37a (v17): una premisa de VARIOS miembros dice la verdad de CADA uno que el universo deja fuera, con su dueño */
  const vps = H.render && H.render.verdadesPropias;
  if (Array.isArray(vps) && vps.length) {
    const _yaDichas = new Set();
    const cuerpo = vps.map((x) => _fraseDeVP(x, _yaDichas, H.render.referencia)).join("; ");
    const refL = H.render.referencia && !cuerpo.includes(H.render.referencia) ? `, ${H.render.referencia}` : "";
    return `${cuerpo}${refL}`;
  }
  const vp = H.render && H.render.verdadPropia;
  /* v21 (T47, §7.3·41b): la razón de una exclusión POR BODEGA no lleva la referencia del universo dentro de la frase (la exclusión por el nombre de la entidad, tampoco, y sigue igual), pero el libro la declara (`H.render.referencia`, «piso de rotación 2.0x»): va al final, una vez, como en la premisa de VARIOS miembros (arriba) — el veredicto que cita una referencia la imprime en la misma oración */
  if (vp && vp.entidad && (vp.excluidaPorLaConsulta || vp.excluidaPorBodega || vp.fueraPorBodegaPedida)) { const fx = _fraseDeVP(vp); return (vp.excluidaPorBodega || vp.fueraPorBodegaPedida) && H.render.referencia && !fx.includes(H.render.referencia) ? `${fx}, ${H.render.referencia}` : fx; }
  if (vp && vp.entidad) {
    const nombreM = vp.metrica ? vp.metrica.nombre : null;
    const partes = [];
    if (vp.estado) partes.push(`está ${vp.estado.texto}`);
    if (vp.metrica) partes.push(_dice(vp.metrica));
    if (vp.puesto) partes.push(_textoDelPuesto(vp.puesto, nombreM));
    if (Array.isArray(vp.otras)) for (const o of vp.otras) partes.push(_dice(o));   /* v19 (Y10): una unión dice la cifra de cada rama */
    if (vp.contra && vp.contra.metrica) partes.push(`frente a ${vp.contra.entidad}: ${_dice(vp.contra.metrica)}`);
    if (Array.isArray(vp.ocupantes) && vp.ocupantes.length) partes.push(`${vp.ocupantes.length > 1 ? "los puestos afirmados los ocupan" : "el puesto afirmado lo ocupa"} ${vp.ocupantes.map((o) => (o.metrica ? `${o.entidad}: ${_dice(o.metrica)}` : o.entidad)).join(" · ")}`);
    /* v19: sin referencia del libro (una unión no la declara), la propia de la condición que falla */
    const _refDeLaCondicion = !H.render.referencia && vp.referencia ? String(vp.referencia).split(", ").filter((r) => r && !partes.some((x) => x.includes(r))) : [];
    const refP = H.render.referencia && !partes.some((x) => x.includes(H.render.referencia)) ? `, ${H.render.referencia}` : (_refDeLaCondicion.length ? `, ${_refDeLaCondicion.join(", ")}` : "");
    return `${vp.entidad}: ${partes.join(", ")}${refP}`;
  }
  // los estados de la Mesa Capital de la entidad de una premisa de ESTADO, con su nombre y con las palabras de la casa («con alerta en el archivo», nunca «crítico» a secas; decisión 34a)
  const ep = H.render && H.render.estadosPropios;
  if (ep && ep.entidad && Array.isArray(ep.estados) && ep.estados.length) return `${ep.entidad}: está ${ep.estados.map((x) => `${x.texto}${x.bodega ? ` (${x.bodega})` : ""}`).join(" · ")}`;
  // CORREGIDO (2026-09-26, medido con D29 al correr `_entrega_neutral_gate`) — cuando el hecho no vino de una
  // fig de la boleta sino de `I.rankings` (notario/verificar.js, «cae al ranking cuando la boleta no trae la
  // fig», ver la nota de `_dominioDePremisa`), `H.evidencia[0]` NO es un label "Entidad · Concepto": es el MISMO
  // placeholder interno «ranking <eje> · <clave> · <entidad>» que esta función existe para no imprimir — así que
  // NUNCA se trata como fig real. Y `H.numeros` viene vacío en ese camino (el número vive solo adentro de
  // `H.verdad`/`H.motivo`): se LEE de ahí con un lector numérico simple, nunca se inventa.
  const figCruda = (H.evidencia && H.evidencia[0]) || null;
  /* v21 (T02 · T32, §7.3·44a): la premisa de PERTENENCIA a un top sobre un empatado del filo (`H.render.empateFilo`) dice a su sujeto: una evidencia que NO es un rótulo «Entidad · Concepto» («cifras de «Carga comercial» por sku», el descriptor del ranking del que salió la cifra) no es una fig, y sin entidad delante del «·» el rótulo caía al top-3 del ranking («es correcto — MAK-COMP-AIR (6%) · LG-DRYER8KG …»), sin nombrar al sujeto, su puesto compartido ni su cifra. El sujeto sale de `H.roles`, como con el placeholder «ranking …». Fuera del filo empatado, el rótulo de siempre (el top de la casa sostiene un «es el que más» o un comparativo con las cifras de cada lado). */
  const _sujetoDelFilo = !!(H.render && H.render.empateFilo);
  const fig = figCruda && !/^ranking\s/i.test(figCruda) && (!_sujetoDelFilo || _entidadDe(figCruda)) ? figCruda : null;
  const entidad = fig ? _entidadDe(fig) : (H.roles.sujetos[0] && H.roles.sujetos[0] !== "negocio" ? H.roles.sujetos[0] : null);
  // RAÍZ A3 (supervisor 2026-09-29, diagnóstico v13): «ninguna cifra impresa con un rótulo distinto de su clave» — el número propio lleva su clave (`H.numeros[i].clave`, la que
  // el libro usó para leerlo) y el rótulo sale de ELLA, nunca de la primera clave del conjunto (`capital 12 días`: el 12 era de `dias_sin_venta`, no de `capital`).
  const _numeroPropio = (H.numeros || []).find(esCifraPropia);
  /* §7.3·49(f): una cifra conserva el rótulo de SU concepto. La fig que respalda la premisa puede ser de una clave HERMANA que la casa acepta como sinónimo y que coincide en valor («Lider · Venta (flujo)» = `venta_credito` respalda «ventas»): el rótulo es el del concepto que la premisa pide (la única clave que declara), nunca el de la fig que casualmente coincide — ventas no se rotula «venta a crédito» */
  const _clavesPedidas = [...H.claves].filter((c) => c !== "variacion" && c !== "vs_presupuesto");
  const _claveDeLaFig = fig ? _claveDeFig({ label: fig }) : null;
  const _clavePedidaUnica = H.tipo !== "variacion" && _clavesPedidas.length === 1 && _claveDeLaFig && _claveDeLaFig !== _clavesPedidas[0] && metricaPorClave(_clavesPedidas[0]) ? _clavesPedidas[0] : null;
  const clave = (_numeroPropio && _numeroPropio.clave && H.tipo !== "variacion" ? _numeroPropio.clave : null) || _clavePedidaUnica || (fig ? _claveDeLaFig : ([...H.claves].find((c) => c !== "variacion" && c !== "vs_presupuesto") || null));
  const conceptoTxt = clave ? rotuloEnOracion({ clave }) : null;   /* FAMILIA 4: el rótulo del léxico de SU concepto (una premisa sobre «ventas» nunca dice «venta a crédito», aunque coincidan en valor) */
  // EL DUEÑO DE UNA CIFRA (owner 2026-09-26, diagnóstico v4 §5, MATERIAL) — el valor SOLO sale de `H.numeros`
  // (la estructura del hecho: `notario/hechos.js` ya resuelve, para el sujeto único de un `orden` sin fig propia,
  // SU valor por `_figDe`/`valorDeRanking` — la misma fuente que arma cualquier otra cifra del libro). Antes, sin
  // `H.numeros`, un regex leía el primer «N%»/«N pp» de `H.verdad + H.motivo` — y `H.verdad` es SIEMPRE el top-3
  // del ranking con el GANADOR primero (verdadera o falsa): una premisa falsa pegaba el valor del 1.º al nombre
  // del sujeto (K13: «Samsung: margen 35.5%», 35.5% es de Makita). Cifra = valor + dueño + métrica, del LIBRO,
  // nunca de una posición dentro de una cadena de texto — sin `H.numeros`, no hay rótulo (cae a `H.verdad`/
  // `H.motivo`, que sí conservan cada número pegado a SU propio nombre).
  // RAÍZ A7 (supervisor 2026-09-29, diagnóstico v12): «la cifra propia de la entidad» es el primer número que NO es del universo ni de
  // una referencia (`esCifraPropia`, notario/hechos.js): el `k` de un `top` es el tamaño del conjunto, nunca una cifra de la entidad
  // («Sodimac: saldo vencido 2» pegaba el 2 de «los 2 de mayor» al saldo de Sodimac). Sin cifra propia no hay rótulo: cae a `H.verdad`.
  const cifraPropia = (H.numeros || []).find(esCifraPropia);
  const valor = cifraPropia ? cifraPropia.texto : null;
  if (!entidad || !valor) return null;
  // A4 (supervisor 2026-09-27, diagnóstico v8) — `H.render.referencia` (notario/hechos.js: el veredicto de un
  // `grupo` de membresía pura sobre un universo de referencia) viaja en un campo DEDICADO, nunca posicional
  // (`H.numeros[1]`): esta función arma su propio rótulo desde `H.numeros[0]` (la cifra PROPIA de la entidad) y,
  // sin este campo, la referencia recién declarada quedaría en el libro pero nunca en el texto — la MISMA regla
  // que `entrega/verificar.js` exige («el veredicto de una premisa que cita una referencia imprime el valor de
  // esa referencia en la MISMA oración»), acá cerrada para el camino que arma su propio rótulo.
  const refTxt = H.render && H.render.referencia && !valor.includes(H.render.referencia) ? `, ${H.render.referencia}` : "";
  if (H.tipo === "variacion") {
    const verbo = _VERBO_DIRECCION_PREMISA[H.direccion] || "varió";
    const periodoTxt = H.periodo === "presupuesto" ? "contra el presupuesto" : "contra el año anterior";
    return `${entidad} ${verbo} ${valor}${conceptoTxt ? ` en ${conceptoTxt}` : ""} ${periodoTxt}${refTxt}`;
  }
  if (conceptoTxt) return `${entidad}: ${esCero(cifraPropia.raw, cifraPropia.unidad) ? dichoElCero(conceptoTxt, valor) : `${conceptoTxt} ${valor}`}${refTxt}`;   // 39(c): el mismo criterio del cero en el rótulo genérico
  return null;
}
function _textoVerdadDerivada(H, libroPremisas) {
  /* §7.3·44e: cada premisa lleva UNA sola traza de su verdad: dos hechos derivados que dicen lo mismo se dicen una vez */
  return [...new Set((H.derivados || []).map((d) => { const D = libroPremisas.porId.get(d); return D ? (D.verdad || D.motivo) : null; }).filter(Boolean))].join(" · ");
}
/* §7.3·44e: la traza «La verdad: …» solo va si dice algo que la oración no dice ya: la traza que la oración contiene (la oración ES la traza) o cuyas cifras la oración ya trae (la verdad propia en palabras) es la misma verdad dicha dos veces, con la notación interna. Nunca se repite. */
function _trazaSinRepetir(cuerpo, traza) {
  const t = String(traza || "").trim();
  if (!t) return "";
  if (normalizar(String(cuerpo || "")).includes(normalizar(t))) return "";
  const cifras = t.match(/\d+(?:[.,]\d+)?/g) || [];
  if (cifras.length && cifras.every((x) => new RegExp(`(?<![\\d.,])${x.replace(/[.,]/g, "[.,]")}(?![\\d])`).test(String(cuerpo || "")))) return "";
  return t;
}
/* los `base` (nombres de conjuntos de la casa) que un universo tipado nombra, también en las ramas de una unión — campo tipado, nunca prosa */
function _basesDeUniverso(u, acc = new Set()) {
  if (!u || typeof u !== "object") return acc;
  if (typeof u.base === "string" && u.base.trim()) acc.add(u.base.trim());
  /* §7.3·39(d): un conjunto de la casa que el universo EXCLUYE («todas menos las de carga comercial alta») pone en juego el MISMO umbral que si fuera el `base`: la exclusión lo cita igual */
  if (u.excluir && typeof u.excluir === "object") for (const n of Array.isArray(u.excluir.conjuntos) ? u.excluir.conjuntos : []) if (typeof n === "string" && n.trim()) acc.add(n.trim());
  for (const v of Array.isArray(u.union) ? u.union : []) _basesDeUniverso(v, acc);
  return acc;
}
/* DECISIÓN 37b (supervisor 2026-09-29, diagnóstico v13): el veredicto de una premisa sobre un estado que DEPENDE de un umbral (rota lento, riesgo de quiebre, inmovilizado,
 * sobrestock, frenado, capital sano) imprime el VALOR del umbral con que se juzgó, en la misma oración —igual que la regla de las referencias (§7.3·12/·19)—. Los estados en
 * juego salen de los campos TIPADOS de la premisa (su universo y su `estado`), los umbrales de la tabla de datos `UMBRALES_DE_ESTADO` y el valor de `umbral(key).valor`, el
 * MISMO helper que da el origen en `marco.definiciones`. El umbral cuyo valor la oración ya dice (la referencia que el libro imprime) no se repite. Sin valor declarado
 * (p. ej. «frenado» sin umbral), no hay nada que imprimir. El ORIGEN no va acá —la oración es de la consulta—: va en el Marco. */
function _umbralesDeLaPremisa(H, consulta = null, textoYaDicho = "") {
  if (!H || H.veredicto === "no-verificable") return null;
  const estados = new Set();
  _estadosDeUniverso(H.universoTipado, estados);
  const e = H.estado ? estadoDeLaPremisa(H.estado) : null;
  if (e) estados.add(e);
  /* DECISIÓN 38(b) (supervisor 2026-09-29, diagnóstico v14): la 37(b) incluye la materialidad — el veredicto sobre «carga comercial alta» (un `base`
   * de la casa, no un estado) imprime el umbral con que se juzgó (`umbralesDeBases`, la MISMA función y el MISMO formateador que el Marco, `valorDeUmbralEnTexto`).
   * «Sobrestock» y «riesgo de quiebre» declaran solo sus propios umbrales (lectura de v12 intacta: `umbralesDeEstados`). */
  const claves = [...new Set([...umbralesDeEstados([...estados]), ...umbralesDeBases([..._basesDeUniverso(H.universoTipado)])])];
  /* §7.3·49: un umbral se da por dicho solo si su valor está en lo que la oración IMPRIME (su rótulo y la referencia del libro); el número que solo vive en la traza interna `H.verdad` no cuenta — el «techo de quiebre 20 días» faltaba en la oración de una premisa de grupo cuyo rótulo no lo decía */
  const yaDicho = [textoYaDicho, H.render && H.render.referencia].filter(Boolean).join(" ");
  const pares = [];
  for (const k of Object.keys(NOMBRE_DE_UMBRAL)) {
    if (!claves.includes(k)) continue;
    const txt = valorDeUmbralEnTexto(k, consulta);
    if (!txt) continue;
    const numero = (txt.match(/\d+(?:[.,]\d+)?/) || [])[0];
    if (numero && (yaDicho.match(/\d+(?:[.,]\d+)?/g) || []).includes(numero)) continue;
    pares.push(`${NOMBRE_DE_UMBRAL[k]} ${txt}`);
  }
  return pares.length ? `criterio aplicado: ${pares.join("; ")}` : null;
}
function _textoDePremisa(H, libroPremisas, consulta = null) {
  const _esFactualDeLaCasa = H.tipo === "ref" || H.tipo === "razon" || H.tipo === "derivada";
  let verdadCasa = _esFactualDeLaCasa ? (H.verdad || H.motivo) : (_rotuloDeLaCasaDeH(H) || H.verdad || H.motivo);
  if (!_esFactualDeLaCasa && (H.veredicto === "verdadera" || H.veredicto === "falsa")) { const um = _umbralesDeLaPremisa(H, consulta, verdadCasa); if (um) verdadCasa = `${verdadCasa}; ${um}`; }
  // CORTE 3e (owner 2026-09-26) — «Sobre lo que usted da por hecho» → «Sobre la premisa declarada por la
  // empresa» (tercera persona, ley «LA ENTREGA NO LE HABLA A NADIE»).
  // §7.3·15 (supervisor 2026-09-27) — CORREGIDO: el corte 3e cambió la persona gramatical (segunda a tercera) pero de
  // paso cambió el DUEÑO (el usuario que consulta pasó a ser «la empresa», un tercero que nunca declaró esto —
  // la premisa sale de `caso.encargo.premisas`, lo que escribió QUIEN CONSULTA en su propia pregunta). «Declarado
  // por la empresa» sigue siendo correcto SOLO para la configuración real de la empresa (el benchmark, el nivel
  // de carga — ver las apariciones de esa frase más abajo, sin tocar). Para una premisa, tercera persona con el
  // dueño correcto: «la premisa planteada en la consulta».
  if (H.veredicto === "verdadera") return `Sobre la premisa planteada en la consulta: es correcto — ${verdadCasa}.`;
  // 38(a)/39(b): con `contra` la oración ya dice las DOS cifras con su dueño, y una `cifra` falsa ya dice la suya con su dueño; la traza de la verdad derivada («La verdad: …») repetiría lo mismo con la notación interna
  if (H.veredicto === "falsa") { const vd = H.render && H.render.verdadPropia && (H.render.verdadPropia.contra || H.tipo === "cifra") ? "" : _trazaSinRepetir(verdadCasa, _textoVerdadDerivada(H, libroPremisas)); return `Sobre la premisa planteada en la consulta: no es así — ${verdadCasa}${vd ? `. La verdad: ${vd}` : ""}.`; }
  /* §7.3·52(b) (parte B, c): la ausencia del dato de una entidad se dice «sin dato de X para Y» (texto de `ausencias.js`), no con las palabras del motivo interno del Notario («sin-evidencia: la boleta no trae «X» de Y») */
  const _ausente = /^sin-evidencia: la boleta no trae «([^»]+)» de ([^.]+?)\.?$/.exec(String(H.motivo || ""));
  return `Sobre la premisa planteada en la consulta, no se pudo verificar con este dato: ${_ausente ? textoSinDato(_ausente[1], [_ausente[2]]) : H.motivo}.`;
}

/* ── PLAN «grupo» (cierre `cifra` sin entidades: listado del eje, group-by o `universo.top`) ────────────────────
 * RC-D/RC-F (diagnóstico v2, supervisor 2026-09-26, MATERIALES) — el alcance declarado (`universo.excluir`, el
 * EJE del group-by, `universo.top`) se acota EN UN SOLO PUNTO (`alcanceDeParte`/`figsEnAlcance`/`recortarATop`,
 * `entrega/alcance.js`) antes de construir el plan: (RC-F) una fig de OTRO eje (un SKU en un ranking de bodega)
 * nunca entra; (RC-D) con `top`, el listado servido es SOLO `top.k` filas con cifra propia — nunca la cola
 * completa (antes esto confiaba en que la TOOL ya recortaba, cierto para `queryMetric{limit}`, falso para
 * `cobranza`/`diagnose`/`rolesCartera`, que ignoran `limit` y devuelven el eje entero). */
// R-SORT-DIRECCION-IGNORADA, defensa en profundidad (supervisor 2026-09-26, MATERIAL, ESTRUCTURAL) — con `top`,
// `_planCifraGrupo` recibe las figs de UNA llamada de `queryMetric` que la tool YA LIMITÓ a `top.k` filas
// (`lecturasDe.js`): nunca se puede confiar en que esa selección sea el extremo que `universo.top.direccion`
// pidió — el desajuste de forma de `sort` (string vs. `{dir}`) hacía EXACTAMENTE eso, siempre, en silencio, hasta
// este mismo corte. Acá se contrasta la SELECCIÓN de la tool contra `conjuntoDeUniverso({eje, ...camposUniverso,
// top}, I, eje, "")` — LA MISMA primitiva que ya resuelve `top` para el Notario (`notario/verificar.js:_topTipado`),
// sobre el ranking de la PROYECCIÓN (`datoProyectado.rankings`, no la boleta de esta llamada — independiente de
// cuántas filas trajo la tool y de cualquier otro desajuste futuro). Si el conjunto que el Core ya sabe calcular
// no coincide con lo que la tool sirvió, se reordena desde ESOS datos — nunca desde lo que la tool decidió
// recortar — completando las figs que falten desde el resto de la evidencia del turno (`indice.figsDeMetrica`, la
// misma fuente que ya usa el índice del Notario, sin el recorte por `porParte` de `figsAcotadas`). Sin `indice` o
// sin un ranking que lo resuelva (`conjuntoDeUniverso` devuelve error, p. ej. top empatado), esta defensa
// simplemente no corre — documentado, nunca silencioso: se sirve lo que trajo la tool, igual que antes de este corte.
// CIERRE A1b (diagnóstico v7, contrato §7.3·8) — `camposUniverso` trae `base`/`estados`/`no_estados`/`filtros`/
// `union`/`bodega` (nunca `top`, que se agrega acá): la MISMA combinación que ya resolvió `figsEnAlcance` para
// `figsAcotadas` (`entrega/alcance.js`), así que este contraste usa EXACTAMENTE el mismo universo — nunca uno
// parcial (`{eje, top}` a secas ignoraba `estados`/`filtros`, y "corregía" la selección de la tool hacia el top
// sobre el eje ENTERO sin filtrar, deshaciendo en silencio el sentido «top dentro del filtro» por defecto).
// CIERRE A1 (supervisor 2026-09-27, diagnóstico v8) — `bodega` faltaba en esta lista: cuando era la ÚNICA
// restricción del universo, este recálculo la perdía y devolvía el top del eje ENTERO sin filtrar, colapsando
// los dos sentidos de `top.sobre` a la misma respuesta (ambos mal). `CAMPOS_UNIVERSO` es la lista ÚNICA de los
// campos de un universo que este recálculo (y cualquier otro que necesite el mismo contraste) tiene que copiar
// desde `alcance` — un campo nuevo de universo se agrega UNA vez acá, nunca campo por campo en cada llamador.
const CAMPOS_UNIVERSO = ["base", "estados", "no_estados", "filtros", "bodega", "union"];
// RAÍZ A7 (supervisor 2026-09-27, diagnóstico v9) — `excluir` viaja APARTE de `CAMPOS_UNIVERSO`: su forma es un
// OBJETO tipado (`{entidades, conjuntos, estados, bodega, top}`, notario/verificar.js), nunca una lista/string
// como el resto de estos campos — `alcanceDeParte` ya lo devuelve completo en `excluirCompleto` (ver
// `entrega/alcance.js`), sin tocar `alcance.excluir` (el array de NOMBRES que `figsEnAlcance` sigue usando para
// su propio filtro, un uso distinto y ya correcto). Antes, `_camposDeUniverso` nunca copiaba `excluir` — así que
// el recálculo del top VERIFICADO (`_entidadesDelTopVerificado`) y el conjunto sin `top` (más abajo) resolvían
// contra `conjuntoDeUniverso` SIN la exclusión, sirviendo entidades que el usuario pidió excluir (W75/W76/W78).
function _camposDeUniverso(alcance) {
  const campos = {};
  for (const c of CAMPOS_UNIVERSO) {
    const v = alcance && alcance[c];
    if (v == null) continue;
    if (Array.isArray(v) && !v.length) continue;
    campos[c] = v;
  }
  if (alcance && alcance.excluirCompleto) campos.excluir = alcance.excluirCompleto;
  return campos;
}
function _entidadesDelTopVerificado(entidadesDeLaToolCruda, figsAcotadas, top, eje, conceptoTop, indice, camposUniverso = {}) {
  // A1c (supervisor 2026-09-27, diagnóstico v8) — `entidadesDeLaTool` puede traer la MISMA entidad más de una
  // vez (dos filas de «rotación» para el mismo SKU en la boleta, ej. cuando dos partes del encargo piden el
  // mismo concepto y sus llamadas se mezclan en `figs`) — sin deduplicar, el camino «coincide» (abajo) devuelve
  // la lista CRUDA con sus duplicados, y `recortarATop` los cuenta como si fueran entidades distintas: un top-4
  // con solo 3 entidades únicas se mostraba con una repetida. Se deduplica ACÁ, en el único punto de entrada,
  // antes de comparar o de devolver nada.
  const entidadesDeLaTool = [...new Set(entidadesDeLaToolCruda)];
  if (!indice) return { entidades: entidadesDeLaTool, figsExtra: [], resuelto: false };
  const { R } = _resolverConjuntoDeclarado({ ...camposUniverso, top }, indice, eje);
  // RAÍZ A9 (supervisor 2026-09-27, diagnóstico v9, contrato §7.3·13) — «un ranking parcial es un problema de
  // LECTURA, no de verificación… un extremo "menor/peor/mejor" no se decide sobre un ranking incompleto»: cuando
  // `conjuntoDeUniverso` declina explícitamente con `ranking-parcial` (la proyección no trae el extremo pedido
  // para TODO el eje), la selección CRUDA de la tool (`entidadesDeLaTool`) NO es un respaldo válido — es
  // exactamente la respuesta NO VERIFICABLE que la decisión 13 prohíbe servir (W99: Bosch sale «ganador» de un
  // ranking de variación que solo trae 4 de 5 marcas). Se declina (`entidades: []`, `resuelto:false`) para que
  // `_planCifraGrupo` decline la parte entera con un límite — nunca la crudo sin verificar.
  if (R && R.error && /^ranking-parcial/.test(R.error)) {
    /* §7.3·52(b) (parte B, c): la parte declinada por un ranking incompleto dice QUIÉN no tiene dato con la forma única «sin dato de X para Y» (texto de `ausencias.js`), no un «sin evidencia» genérico */
    const m = metricaPorClave(claveDeMetrica(conceptoTop));
    let rk = null; try { rk = m && indice.rankingDe ? (indice.rankingDe(eje, m.nombre) || null) : null; } catch { rk = null; }
    const conDato = new Set(((rk && rk.r && rk.r.filas) || []).map((f) => normalizar(f.entidad)));
    const sin = conDato.size && indice.entidades ? [...indice.entidades].filter(([k, e]) => e && e.eje === eje && !conDato.has(k)).map(([, e]) => e.nombre) : [];
    return { entidades: [], figsExtra: [], resuelto: false, ...(m && sin.length ? { errorUniverso: `ranking-parcial: ${textoSinDato(m.nombre, sin)}` } : {}) };
  }
  // RAÍZ A (supervisor 2026-09-29, bug real — ver la nota grande sobre `_resolverConjuntoDeclarado`, arriba de
  // `_entidadEnAlcanceDeUnaParte`) — CUALQUIER OTRO error de resolución (p. ej. «universo-no-resoluble» de un
  // `union` con `estados:["frenado"]` sin umbral declarado) declina TAMBIÉN, con el motivo real (`errorUniverso`)
  // para que `_planCifraGrupo` lo declare como límite de negocio — antes solo `ranking-parcial` declinaba acá y
  // cualquier OTRO error caía al respaldo crudo (`entidadesDeLaTool`), sirviendo el eje sin filtrar por la
  // restricción que la parte declaró (W44 p2, Y10/Y13 p1, Y37 p2). Sin `indice`, sin `set` y sin `error` (nunca
  // ocurre hoy, pero documentado): la crudo sigue siendo el respaldo, nunca silencioso.
  if (R && R.error) return { entidades: [], figsExtra: [], resuelto: false, errorUniverso: R.error };
  if (!R || !R.set) return { entidades: entidadesDeLaTool, figsExtra: [], resuelto: false };
  const enJuegoNorm = new Set(entidadesDeLaTool.map((e) => normalizar(e)));
  const coincide = R.set.size === enJuegoNorm.size && [...R.set].every((k) => enJuegoNorm.has(k));
  // RAÍZ A9/A6 (diagnóstico v9) — `resuelto:true` marca que `R.set` es la verdad CONTRASTADA contra la
  // evidencia (nunca la selección cruda de la tool): `_planCifraGrupo` lo usa para distinguir un universo que
  // resolvió VACÍO de verdad («los 4 mayores están todos bajo el benchmark» — 0 es la respuesta correcta, no un
  // hueco de datos) de un universo que no se pudo verificar en absoluto (sin `indice`, o `conjuntoDeUniverso`
  // sin `set`) — solo el segundo caso declina con «sin evidencia».
  if (coincide) return { entidades: entidadesDeLaTool, figsExtra: [], resuelto: true, ...(R.empateEnElFilo ? { empateFilo: R.empateEnElFilo } : {}) };
  const nombres = [...R.set].map((k) => (indice.entidades && indice.entidades.get ? (indice.entidades.get(k) || { nombre: k }).nombre : k));
  // R-VARIACION-SIN-CIFRA-EN-TOP (diagnóstico v6, MEDIA) — «conocida» tiene que significar «ya trae una fig de
  // ESTE `conceptoTop»», no «ya trae CUALQUIER fig»: una entidad puede llegar con su «Venta» (otro concepto) y
  // seguir faltándole la cifra del concepto que el `top` en sí ordena (ej. `top:{metrica:"variacion"}` cuando el
  // tool solo publicó el delta en $, «· YoY» → clave `variacion_usd`, nunca el % por entidad) — con el chequeo
  // viejo (cualquier fig) esa falta nunca se detectaba, así que el backfill de abajo nunca corría para completar
  // la columna que el propio `top` pidió.
  const conocidas = new Set(_todasLasFilasDeConcepto(figsAcotadas, conceptoTop).map((x) => x.entidad).map(normalizar));
  const faltan = new Set(nombres.filter((n) => !conocidas.has(normalizar(n))).map(normalizar));
  let figsExtra = [];
  if (faltan.size && typeof indice.figsDeMetrica === "function") {
    try { figsExtra = (indice.figsDeMetrica(conceptoTop, eje) || []).filter((f) => { const e = _entidadDe(_lab(f)); return e && faltan.has(normalizar(e)); }); } catch { figsExtra = []; }
  }
  return { entidades: nombres, figsExtra, resuelto: true, ...(R.empateEnElFilo ? { empateFilo: R.empateEnElFilo } : {}) };
}
function _planCifraGrupo(parte, figs, { ejesDelTenant = {}, indice = null, direccionSinTop = null, deMayorAMenor = false, soloEntidades = null, criterio = null, foto = false } = {}) {
  if (_universoNoSoportado(parte.universo)) return null;
  const alcance = alcanceDeParte(parte);
  // BODEGA (diagnóstico v4 §3, MATERIAL) — `indice` es el mismo índice de `notario/evidencia.js` que ya arma
  // `_indiceDelTenant`: `figsEnAlcance` lo necesita para recortar los SKU de `alcance.bodega` a la bodega
  // declarada (K16: `{eje:"sku", bodega:"Valparaíso"}` servía las 11 figs del inventario completo, no las 4 de
  // Valparaíso). Sin `indice` (un llamador que no lo tenga a mano) esta mitad del recorte simplemente no corre —
  // documentado en `figsEnAlcance`, nunca silencioso.
  let figsAcotadas = figsEnAlcance(figs, alcance, { ejesDelTenant, indice });
  const eje = alcance.eje || parte.eje;
  const conceptosBase = parte.conceptos && parte.conceptos.length ? parte.conceptos.slice() : [];
  const top = alcance.top;
  const conceptoTop = top ? top.metrica : null;
  const conceptos = conceptoTop && !conceptosBase.includes(conceptoTop) ? [conceptoTop, ...conceptosBase] : conceptosBase;
  if (!conceptos.length) return null;

  // EL CONJUNTO DE ENTIDADES «EN JUEGO» (owner, ley «un top-N declara su cola» — nunca al revés: con `top`, la
  // propia llamada `queryMetric(limit:k)` YA trae SOLO esas k entidades para `conceptoTop` — nunca se completa con
  // entidades que aparecen en OTRO concepto sin top (eso sería inventar una cola que no se declaró). Sin `top`, el
  // conjunto es la unión de TODO lo que cada concepto pedido trajo, sin recorte.
  // RAÍZ A9 (supervisor 2026-09-27, diagnóstico v9) — `universoResuelto` distingue un universo que
  // `conjuntoDeUniverso` CONTRASTÓ de verdad contra la evidencia (aunque el resultado sea vacío — «los 4 mayores
  // están todos bajo el benchmark» es 0, una respuesta correcta, no un hueco) de uno que nunca se pudo verificar
  // (sin `indice`, o la primitiva sin `set`). Solo el segundo caso declina más abajo con «sin evidencia».
  // RAÍZ A (supervisor 2026-09-29) — `errorUniverso` lleva el motivo REAL cuando el universo DECLARADO de la
  // parte no se pudo resolver (nunca un «sin evidencia» genérico): `_planCifraGrupo` lo devuelve como
  // `{error: errorUniverso}` en vez de `null` para que el llamador declare el límite de negocio verdadero (ver la
  // nota grande de `_resolverConjuntoDeclarado`).
  let entidadesEnJuego, universoResuelto = false, errorUniverso = null, empateFilo = null;   /* §7.3·44a: el empate del filo del top */
  if (top) {
    const crudo = _todasLasFilasDeConcepto(figsAcotadas, conceptoTop).map((x) => x.entidad);
    // A1b — el MISMO universo que ya resolvió `figsEnAlcance` para `figsAcotadas` (base/estados/no_estados/
    // filtros/union/excluir), para que el contraste de arriba nunca discrepe con lo que ya filtró el alcance.
    const camposUniverso = _camposDeUniverso(alcance);
    const { entidades, figsExtra, resuelto, errorUniverso: errU, empateFilo: empF } = _entidadesDelTopVerificado(crudo, figsAcotadas, top, eje, conceptoTop, indice, camposUniverso);
    if (figsExtra.length) figsAcotadas = [...figsAcotadas, ...figsExtra];
    entidadesEnJuego = entidades;
    universoResuelto = resuelto;
    if (empF) empateFilo = empF;
    if (errU) errorUniverso = errU;
  }
  else {
    const v = new Set(); for (const c of conceptos) for (const { entidad } of _todasLasFilasDeConcepto(figsAcotadas, c)) v.add(entidad); entidadesEnJuego = [...v];
    // RAÍZ A8 (supervisor 2026-09-27, diagnóstico v9) — `_entidadDe` (arriba en este archivo) toma TODO lo que
    // esté antes del primer «·» como «entidad» — una fig de NEGOCIO sin entidad propia, pero cuyo rótulo usa «·»
    // como separador interno («Umbral de materialidad · % de la venta»), se cuela como si «Umbral de
    // materialidad» fuera un miembro del eje (W87.p3: eje «canal», sin universo — el eje real tiene 2 miembros,
    // «Umbral de materialidad» aparece como un tercero). Cuando el eje tiene una lista CONOCIDA y CERRADA
    // (`ejesDelTenant[eje]`, la MISMA que ya usa `figsEnAlcance`/RC-F para excluir entidades de OTRO eje), se
    // exige PERTENENCIA a esa lista — nunca «no pertenece a otro eje conocido» (denylist), que es justo lo que
    // dejaba pasar cualquier rótulo con «·» que no calzara con NINGÚN eje. Sin lista conocida (eje sin índice),
    // el comportamiento no cambia — nunca se excluye a ciegas.
    const _miembrosDelEje = ejesDelTenant && Array.isArray(ejesDelTenant[eje]) && ejesDelTenant[eje].length ? new Set(ejesDelTenant[eje].map(normalizar)) : null;
    if (_miembrosDelEje) entidadesEnJuego = entidadesEnJuego.filter((e) => _miembrosDelEje.has(normalizar(e)));
    // §7.3·17 (supervisor 2026-09-27, diagnóstico v8) — SIN `top`, esta unión solo refleja qué entidades
    // trajeron fig ESTE turno para los conceptos pedidos; el conjunto CANÓNICO de un universo con `base`/
    // `estados`/`no_estados`/`filtros`/`bodega`/`union` es el que resuelve `conjuntoDeUniverso` — la MISMA
    // primitiva que ya usa el Notario y que `_entidadesDelTopVerificado` (A1b) ya contrasta para el camino
    // `top`. Si el conjunto oficial trae MÁS miembros que los que aparecieron con fig (p. ej. «carga comercial
    // alta» son 6 cuentas, pero solo 5 trajeron «carga»/«contribución» en la boleta de este turno), se completa
    // con una fig que YA existe en la evidencia del turno (`indice.figsDeMetrica`, nunca una fig inventada) —
    // el mismo criterio de A1b, generalizado al camino sin `top`.
    const camposUniverso = _camposDeUniverso(alcance);
    if (indice && Object.keys(camposUniverso).length) {
      const { R } = _resolverConjuntoDeclarado(camposUniverso, indice, eje);
      // RAÍZ A (supervisor 2026-09-29, bug real, 12 aserciones — Y10/Y13 p1, W44 p2, Y37 p2: la clase A de la
      // clasificación) — `conjuntoDeUniverso` NUNCA lanza; un universo no-resoluble (p. ej. un `union` con
      // `estados:["frenado"]` sin umbral declarado — `_setDeEstado` en `notario/verificar.js`) vuelve como
      // `{error}`, un valor normal, no una excepción. Antes, esta rama solo miraba `R.set` (`universoResuelto =
      // !!(R && R.set)`, dos líneas más abajo en el código viejo) y el bloque que RESTRINGE `entidadesEnJuego`
      // solo corría `if (R && R.set && …)`: con `R.error` y sin `.set`, el bloque se saltaba SIN declinar y SIN
      // filtrar — `entidadesEnJuego` se quedaba con el valor CRUDO de antes (todo lo que trajo fig para los
      // conceptos pedidos, típicamente el eje ENTERO, porque casi toda métrica de este dominio tiene fig para
      // todas las entidades). El freno final (`!entidadesEnJuego.length && !universoResuelto`, más abajo) nunca
      // disparaba porque `entidadesEnJuego` no estaba vacío — la parte se servía «resuelta» con el eje completo,
      // como si `estados:["frenado"]` nunca hubiera estado en el `union`. Ahora: un `R.error` fuerza el conjunto a
      // VACÍO (nunca el crudo) y guarda el motivo real en `errorUniverso`, para que el freno de abajo dispare y
      // el llamador declare el límite de negocio verdadero — nunca el eje entero en su lugar.
      if (R && R.error) {
        entidadesEnJuego = [];
        universoResuelto = false;
        errorUniverso = R.error;
      } else {
      universoResuelto = !!(R && R.set);
      // RAÍZ A5 (SUPERVISOR, diagnóstico v10, X16) — «el conjunto CANÓNICO (`R.set`) manda siempre» (nota de
      // abajo) valía solo cuando el universo oficial era MÁS GRANDE que lo que ya trajeron las figs (`>`) — nunca
      // cuando `alcance.excluir` (p. ej. `excluir.top`, un ranking interno excluido del universo) lo deja MÁS
      // CHICO. En ese caso `entidadesEnJuego` se quedaba con el conjunto SIN excluir (lo que las figs trajeron
      // para el concepto pedido, previo a la exclusión), y el invariante de tiempo real más abajo (§7.3·17, «el
      // conjunto servido no coincide con el universo declarado») declinaba la parte ENTERA — `verificarEntrega`
      // recalculaba bien los 3 miembros (con la MISMA primitiva) pero la Entrega servía 0. Comparar por `!==`
      // (en vez de `>`) hace que el conjunto canónico también ACHIQUE `entidadesEnJuego` cuando corresponde: no
      // hace falta ninguna fig nueva para EXCLUIR un nombre, así que el mismo camino de abajo (que solo agrega
      // figs para los que FALTAN) sigue sirviendo para el caso de crecer, y ahora también resuelve el de achicar.
      if (R && R.set && R.set.size !== entidadesEnJuego.length) {
        const nombres = [...R.set].map((k) => (indice.entidades && indice.entidades.get ? (indice.entidades.get(k) || { nombre: k }).nombre : k));
        const enJuegoNorm = new Set(entidadesEnJuego.map(normalizar));
        const faltanNorm = new Set(nombres.filter((n) => !enJuegoNorm.has(normalizar(n))).map(normalizar));
        if (faltanNorm.size && typeof indice.figsDeMetrica === "function") {
          let figsExtra = [];
          for (const c of conceptos) {
            try { figsExtra = figsExtra.concat((indice.figsDeMetrica(c, eje) || []).filter((f) => { const e = _entidadDe(_lab(f)); return e && faltanNorm.has(normalizar(e)); })); } catch { /* sin figs extra para este concepto */ }
          }
          if (figsExtra.length) figsAcotadas = [...figsAcotadas, ...figsExtra];
        }
        // RAÍZ A6 (supervisor 2026-09-27, diagnóstico v9, precisa la nota de arriba) — antes, `entidadesEnJuego`
        // solo se ampliaba al conjunto OFICIAL (`nombres`) cuando `figsExtra` encontraba AL MENOS una fig para
        // completar: un miembro del `union` sin NINGUNA fig en TODA la evidencia del turno (p. ej. un cliente sin
        // ventas a crédito — «con saldo vencido» lo trae por la OTRA mitad del union, «carga comercial alta», pero
        // `mesaFlujo` nunca le arma fila porque su venta a crédito es 0) dejaba `entidadesEnJuego` MÁS CHICO que el
        // universo declarado — y el invariante de arriba (§7.3·17, «el conjunto servido tiene que ser EXACTO»)
        // declinaba la parte ENTERA con un límite, aunque las otras 6 cuentas SÍ tuvieran evidencia completa (W43).
        // El conjunto CANÓNICO (`R.set`, ya verificado contra la evidencia por `conjuntoDeUniverso` — la MISMA
        // resolución que usa el Notario) manda siempre: una entidad sin fig para el concepto pedido simplemente no
        // imprime esa fila (mismo criterio que ya protege `_mapaDe` más abajo, A2 — nunca se inventa una cifra),
        // pero SIGUE en el conjunto declarado y en el orden — nunca se declina la parte por la ausencia de UNA
        // cuenta cuando el resto del universo sí tiene evidencia.
        entidadesEnJuego = nombres;
      }
      }
    }
  }
  // A12 (supervisor 2026-09-27, diagnóstico v8), CERRADO por A7 (diagnóstico v9) — `_camposDeUniverso` ahora SÍ
  // pasa `excluir` (completo: entidades/conjuntos/estados/bodega/top, `excluirCompleto`) a `conjuntoDeUniverso`
  // dentro de `_entidadesDelTopVerificado`/la rama sin `top` de arriba — así que `entidadesEnJuego` YA sale sin
  // los excluidos en el camino verificado. Este filtro por NOMBRE queda como defensa en profundidad (el camino
  // sin `indice`, que nunca pasa por `conjuntoDeUniverso`) — nunca la única exclusión aplicada.
  if (alcance.excluir && alcance.excluir.length) {
    const excluidosNorm = new Set(alcance.excluir.map(normalizar));
    entidadesEnJuego = entidadesEnJuego.filter((e) => !excluidosNorm.has(normalizar(e)));
  }
  // RAÍZ A9 (supervisor 2026-09-27, diagnóstico v9) — un universo VERIFICADO que resuelve VACÍO («los 4 mayores
  // están todos bajo el benchmark» ⇒ 0) es una respuesta correcta, no un hueco de datos: se compone un plan con
  // `orden: []` (el render de más abajo ya sabe no imprimir nada cuando `plan.orden` está vacío — ninguna fila,
  // ninguna oración de prioridad) en vez de declinar con «sin evidencia en la boleta», que sería un límite falso
  // sobre un universo que SÍ se resolvió. Solo declina (`return null`) cuando ni siquiera se pudo verificar el
  // universo (`universoResuelto:false`) — el caso real de «sin evidencia».
  // RAÍZ A (supervisor 2026-09-29) — cuando la resolución del universo declarado FALLÓ con un motivo real
  // (`errorUniverso`, arriba), se distingue de un «sin evidencia» genérico: se devuelve `{error}` en vez de
  // `null` para que el llamador declare el límite de negocio verdadero (p. ej. «la evidencia no demuestra
  // "frenado" para ninguna entidad del eje», el caso de un umbral no declarado por la empresa).
  /* v21 (§7.3·44c): la FOTO de una `lectura`/`decision` sin universo son las cuentas que el PRODUCTOR publica (`soloEntidades`, las de su mesa), no todo lo que otra parte del mismo turno haya ensanchado en la boleta compartida */
  if (soloEntidades && soloEntidades.size) { const _solo = new Set([...soloEntidades].map(normalizar)); entidadesEnJuego = entidadesEnJuego.filter((e) => _solo.has(normalizar(e))); }
  /* CONSOLIDACIÓN, SEGUNDA VUELTA (§7.3·45a · 49c): la foto no depende de que la lectura del turno haya traído UNA fig. Si ningún productor de la boleta publicó el concepto (el margen de inventario de los SKU: solo lo publica la fila completa de cada SKU) pero
   * la proyección SÍ lo publica para el eje, la foto es el eje entero con la cifra de la proyección (medido) de cada miembro: nunca «ninguna evidencia» sobre una cifra que el dato publica. */
  if ((foto || parte.cierre === "cifra") && !top && !soloEntidades && indice && universoResuelto === false && !entidadesEnJuego.length && !errorUniverso) {
    const miembros = ejesDelTenant && Array.isArray(ejesDelTenant[eje]) ? ejesDelTenant[eje] : null;
    if (miembros && miembros.length && conceptos.some((c) => miembros.some((n) => figDeLaProyeccion(indice, n, c)))) entidadesEnJuego = miembros.slice();
  }
  if (!entidadesEnJuego.length && !universoResuelto) return errorUniverso ? { error: errorUniverso } : null;
  /* §7.3·49(c) LA FOTO: una `lectura`/`decision` sin universo ni entidades sirve el EJE ENTERO que sus conceptos sostienen (comercial e inventario; cobranza sirve las cuentas de su mesa y declara la cola). Un productor que publica menos que el eje (el capital frenado solo de los SKU con capital crítico, la brecha solo de las cuentas bajo el benchmark) NO recorta la foto: cada miembro del eje sin cifra del productor lleva su cero de cobertura declarada o el valor del ranking que la proyección publica, y lo que ningún productor trae se DECLARA (`_declararCifraFaltanteDeFoto`). \`entidadesConFig\` son las que trajeron cifra (la clave de orden se elige sobre ellas, como siempre) */
  const entidadesConFig = entidadesEnJuego.slice();
  const fotoCompletada = [];
  if (foto && !top && !soloEntidades && indice && universoResuelto === false) {
    const miembros = ejesDelTenant && Array.isArray(ejesDelTenant[eje]) ? ejesDelTenant[eje] : null;
    if (miembros && entidadesEnJuego.length) { const ya = new Set(entidadesEnJuego.map(normalizar)); for (const n of miembros) if (!ya.has(normalizar(n))) { entidadesEnJuego.push(n); fotoCompletada.push(n); } }
  }

  const porEntidad = new Map();   // nombre → Map(clave → fig)
  for (const c of conceptos) for (const { entidad, fig } of _todasLasFilasDeConcepto(figsAcotadas, c)) {
    if (!entidadesEnJuego.includes(entidad)) continue;
    if (!porEntidad.has(entidad)) porEntidad.set(entidad, new Map());
    // RAÍZ A5 (supervisor 2026-09-29, diagnóstico v12, Z61 = Y19 de v11): «el último gana» dejaba que una fig SIN crudo pisara a una
    // CON crudo de la misma clave y entidad (dos rótulos que la casa canoniza a la misma métrica: «Capital» de `queryMetric`, con
    // `raw`, y «Valor de inventario» de `tensionRead`, sin él). Sin crudo en un operando no se puede declarar la derivada de apoyo
    // (§7.3·25) y la Entrega perdía la tentación precalculada. Una fig con crudo NUNCA se reemplaza por otra sin crudo.
    { const previa = porEntidad.get(entidad).get(c); if (previa && Number.isFinite(previa.raw) && !Number.isFinite(fig.raw)) continue; }
    porEntidad.get(entidad).set(c, fig);
  }
  // RC-F, hallazgo gemelo (diagnóstico v2, reproducido con W47 ya con el filtro de eje aplicado) — «capital
  // frenado»/«capital inmovilizado» son el MISMO tool call (`inventoryStatus{focus:"frenado"}`) pero NO todo
  // concepto declarado tiene fig para TODO eje: por bodega, hoy solo «capital_frenado» trae subtotal (contrato
  // §3.3, `_FAM_CAPITAL_FRENADO`); «capital_inmovilizado» no. `conceptos[0]` a ciegas (el orden en que el usuario
  // los escribió) podía elegir un concepto SIN NINGÚN dato para este eje como `claveOrden` — la oración quedaba
  // sin cifra pegada al nombre («Valparaíso, Antofagasta» sin monto), la MISMA violación que RC-F ya reproducía
  // con el SKU intruso (oracion-hecho + tentacion-no-precalculada), solo que por una causa distinta. Se elige el
  // primer concepto DECLARADO (respetando `conceptoTop` si hay `top`) que sí tiene AL MENOS una fig entre las
  // entidades en juego — nunca un concepto inventado ni reordenado por valor, solo el primero que el eje sostiene.
  /* v20 (U06): en una `lectura`/`decision` (que no exigen orden exhibido: la 43(f) habla de la `cifra`, cuyo orden es el del PRIMER concepto pedido) se prefiere, entre los conceptos declarados que el eje sostiene, el PRIMERO que trae fig para TODAS las entidades en juego: «capital inmovilizado crítico» por bodega solo trae las dos bodegas con crítico y la línea de orden quedaba
   * «Antofagasta ($8K), Valparaíso ($25K), Santiago» (Santiago sin cifra pegada al nombre, Concepción fuera), mientras el concepto siguiente («capital») las trae a las cuatro. Sin un concepto completo, el criterio de siempre. */
  const claveOrden = conceptoTop
    /* §7.3·51(a) (segunda vuelta): la LISTA de una foto se ordena por el primer concepto pedido que su productor publica, aunque lo publique solo para algunas cuentas (el capital inmovilizado crítico solo de los SKU críticos: las demás llevan su cero de cobertura declarada); la preferencia por un concepto «completo» (v20 · U06) es de la lectura que no es foto */
    || ((parte.cierre === "cifra" || foto) ? null : conceptos.find((c) => entidadesConFig.length > 1 && entidadesConFig.every((e) => porEntidad.has(e) && porEntidad.get(e).has(c))))
    /* …y lo publique la boleta del turno o la proyección del dato (el margen de inventario de los SKU solo lo trae la proyección): la foto no salta al concepto siguiente porque la lectura no haya registrado el primero */
    || (foto ? conceptos.find((c) => entidadesConFig.some((e) => porEntidad.has(e) && porEntidad.get(e).has(c)) || (indice && ejesDelTenant && Array.isArray(ejesDelTenant[eje]) && ejesDelTenant[eje].some((n) => figDeLaProyeccion(indice, n, c)))) : null)
    || conceptos.find((c) => entidadesConFig.some((e) => porEntidad.has(e) && porEntidad.get(e).has(c))) || conceptos[0];
  /* FAMILIA 2 (§7.3·49(c) · 51(b) · 52(b)): cada miembro en juego que la boleta no trajo en la clave que ordena lleva la cifra que la proyección publica (medido, aunque valga 0) o su cero de cobertura declarada, ANTES de ordenar: la entidad sin dato no se ordena como cero (un comparador con NaN dejaba el orden sin definir) y lo que ningún productor trae se declara aparte. La fila de cada otro concepto pedido se completa abajo, sobre lo que el grupo sirve. */
  const _cLente = conceptoDeLaMedidaParcial(criterio, parte.tema);   /* §7.3·56: la medida de la lente «crecimiento» (la variación vs año anterior) se completa con la proyección antes de ordenar; quien no la tiene queda sin dato (52b) */
  if (indice && claveOrden) completarGrupo({ nombres: entidadesEnJuego, conceptos: [claveOrden, ...(_cLente && _cLente !== claveOrden && productorDe(_cLente, eje) ? [_cLente] : [])], porEntidad, eje, I: indice });
  // RAÍZ ordenServido (supervisor 2026-09-27, diagnóstico v9) — `top.direccion` acepta CUATRO valores (contrato
  // §2, `hechos.js:_ENUM.direccion`: mayor · menor · peor · mejor), pero acá solo se leía «menor» — «peor»/
  // «mejor» caían al `else` como si fueran «mayor» sin mirar la POLARIDAD de la métrica: para «recuperado»,
  // peor es MENOR (recuperó menos), no mayor (W18: el orden servido salía invertido). MISMA resolución que ya
  // usa el Notario para el mismo campo (`notario/verificar.js:_topTipado`) y `lecturasDe.js:_direccionDeTop` —
  // nunca una segunda tabla de polaridad.
  const _dirTopTxt = top ? normalizar(String(top.direccion || "mayor")) : null;
  let dirMenor;
  if (_dirTopTxt === "peor" || _dirTopTxt === "mejor") {
    const pol = (metricaPorClave(claveOrden) || {}).polaridad;
    const peorEs = pol === "mayor" ? "menor" : pol === "menor" ? "mayor" : null;
    dirMenor = peorEs ? (_dirTopTxt === "peor" ? peorEs === "menor" : peorEs === "mayor") : false;
  } else if (top) {
    dirMenor = _dirTopTxt === "menor";
  } else if (deMayorAMenor) {
    /* v21 (§7.3·44c · 43(f)): sin orden pedido, la exhibición de la FOTO —un eje completo— va de MAYOR a menor: con polaridad «menor» (vencido, días de atraso) es lo que pide ATENCIÓN primero; con «mayor» (venta, margen, recuperado) es el orden de siempre, sin invertirlo (§7.3·50a rige solo la ORACIÓN de prioridad; la lista de la foto es la de su productor, 45a) */
    dirMenor = false;
  } else if (direccionSinTop) {
    dirMenor = direccionSinTop === "menor";   // el llamador fija el sentido (el ranking de días sin venta: de MÁS a MENOS, como la vista «Días sin venta» de la cara Capital)
  } else {
    /* §7.3·43(f) (v19, lectura estrecha del supervisor): en una CIFRA sobre un eje completo, sin orden pedido, la exhibición va de MAYOR a menor. Con `polaridad: "menor"` (más es peor: días y saldo vencido) eso es lo que pide ATENCIÓN
     * primero; con `"mayor"` (venta, margen) es el orden de siempre, sin invertirlo. El tope de tamaño manda al Detalle la cola. Antes una métrica «menor» iba «mejor primero» (Jumbo 0 días al frente y Easy 270 d al Detalle). Una `lectura`/`decision`
     * NO cambia: su primera fila es «la prioridad del procedimiento» (conclusión del procedimiento, no una exhibición) y la 43(f) habla de la cifra. */
    const _pol = (metricaPorClave(claveOrden) || {}).polaridad;
    dirMenor = parte.cierre === "cifra" ? false : _pol === "menor";   /* la lista, como antes; la ORACIÓN de prioridad no la hereda (§7.3·50a: `primeroAtencion`) */
  }
  const _num = (f) => (f && Number.isFinite(f.raw) ? f.raw : NaN);
  /* v21 (T36, §7.3·43b/43f): en una métrica de COBERTURA DECLARADA (§7.3·52b: «capital inmovilizado» de la foto de inventario) la entidad SIN fig vale 0 —un hecho, no un hueco—: ordena y empata como cero (un comparador con NaN dejaba el orden sin definir y los 9 SKU en $0 sin puesto compartido) */
  const _ceroPorAusencia = !!(claveOrden && ceroPorCobertura(claveOrden, eje));
  const _valorDeOrden = (e) => { const f = porEntidad.get(e) && porEntidad.get(e).get(claveOrden); const v = _num(f); return Number.isFinite(v) ? v : (_ceroPorAusencia && !f ? 0 : NaN); };
  let orden = [...entidadesEnJuego].sort((a, b) => { const va = _valorDeOrden(a), vb = _valorDeOrden(b); if (!Number.isFinite(va) || !Number.isFinite(vb)) { if (fotoCompletada.length && Number.isFinite(va) !== Number.isFinite(vb)) return Number.isFinite(va) ? -1 : 1; return 0; } return dirMenor ? va - vb : vb - va; });   /* §7.3·49(c): en la foto completada, la entidad sin la cifra que ordena va al final (nunca revuelta entre las que sí la traen) */
  // RC-D — el recorte por `top.k`, AHORA GARANTIZADO sea cual sea la tool subyacente (idempotente: si `orden` ya
  // trae `top.k` filas, no cambia nada). `cola` viaja en el plan por si un compositor futuro quiere declararla
  // aparte — hoy la oración/tabla siguen usando solo `orden` (ya acotado) y el prefijo «El top K de M» que ya
  // declara la cola como agregado (componer.js, más abajo).
  let cola = [];
  /* §7.3·44a: un top cuyo filo cae dentro de un empate sirve a TODOS los empatados del filo (`empateFilo.servidos`): el recorte respeta esa cuenta, nunca deja fuera a uno de los empatados */
  if (top) { const r = recortarATop(orden, empateFilo && empateFilo.servidos > top.k ? { ...top, k: empateFilo.servidos } : top); orden = r.enFoco; cola = r.cola; }
  // §7.3·17 (supervisor 2026-09-27, diagnóstico v8) — `universoDecl` viaja con TODOS los campos del universo
  // declarado (antes solo `top`): `_declararUniverso` los necesita para que `entrega.universos[]` describa el
  // universo REAL de una parte `lectura`/`decision` sin entidades (no solo su `top`), y para que el invariante de
  // `entrega/verificar.js` pueda recomponer el MISMO conjunto de forma independiente.
  /* §7.3·43(b) (v19, Y02): los EMPATES del orden servido —igualdad del crudo de la cifra que ordena, la misma regla que `_ordenar` del Notario—; el puesto es el del primero del grupo dentro del orden servido (los empatados comparten el puesto). Se calcula acá, con las figs, antes de que el compositor las cambie por ids. */
  /* FAMILIA 2 (§7.3·44a «cada servido tiene fila» · 48a · 51b): cada entidad que el grupo SIRVE tiene su fila en CADA concepto pedido que su productor publica (la boleta, la proyección o su cero de cobertura declarada); la que ninguna fuente demuestra queda sin fila y se declara («sin dato de X para Y»). El top sirve también a los empatados del filo en cero. */
  const faltantes = indice ? completarGrupo({ nombres: orden, conceptos: [...conceptos, ...(_cLente && !conceptos.includes(_cLente) && productorDe(_cLente, eje) ? [_cLente] : [])], porEntidad, eje, I: indice }) : [];   /* 56: quien no tiene la variación vs año anterior se declara «sin dato de … para …» (52b) */
  const empates = [];
  if (claveOrden) {
    const grupos = [];
    for (let i = 0; i < orden.length; i++) {
      const fig = porEntidad.get(orden[i]) && porEntidad.get(orden[i]).get(claveOrden);
      const ceroAusente = !fig && _ceroPorAusencia && !top;   /* con `top` el corte puede partir el grupo en cero: no se declara un empate a medias */
      if (!ceroAusente && (!fig || !Number.isFinite(fig.raw))) continue;
      const v = ceroAusente ? 0 : fig.raw;
      const g = grupos.find((x) => x.v === v);
      if (g) g.entidades.push(orden[i]); else grupos.push({ v, n: i + 1, unit: ceroAusente ? unidadDeClave(claveOrden) : fig.unit, entidades: [orden[i]] });
    }
    for (const g of grupos) if (g.entidades.length > 1) empates.push(g);
  }
  /* FAMILIA 1: la decisión de prioridad es de `prioridad.js`. v23: la lente que aplica al dominio ordena la prioridad del grupo. §7.3·50(a): la lista del grupo es la de su productor (o el RANKING que el usuario pidió, su dirección manda); la ORACIÓN de prioridad de una `decision` nombra a quien pide atención por la medida nombrada entre los servidos: nunca corona al mejor por una tasa. */
  const prio = prioridadDeParte({ criterio, tema: parte.tema, cierre: parte.cierre, entidades: orden, claveOrden, valorDe: _valorDeOrden, proyeccion: valoresDeProyeccion(indice, eje, claveOrden), figs: figsAcotadas, porEntidad, ordenDelTop: !!conceptoTop });   /* 55(a): con `top`, la lista de la parte la ordena el concepto del top (`claveOrden` = `conceptoTop`) */
  const { lenteGrupo, primeroAtencion } = prio;
  /* §7.3·52(c) (owner, parte B · a): la foto de una lectura o decision de COBRANZA son las cuentas de la mesa EN EL ORDEN DE LA MESA (el de `facts.clientes`, que `soloEntidades` conserva), no el de un concepto. La prioridad ya se decidió con los valores (arriba) y no depende
   * del orden de la lista. Si ese orden coincide con el de la medida que ordenaba, la cabeza sigue diciendo «ordenado por X» (es verdad); si no, el orden es el de la mesa, se dice así y no hay «empate en el orden servido» (la lista no está ordenada por ninguna cifra). */
  let ordenDeLaMesa = false;
  if (foto && parte.tema === "cobranza" && soloEntidades && soloEntidades.size && !top) {
    const mesa = [...soloEntidades].filter((n) => orden.includes(n));
    if (mesa.length === orden.length) {
      const vs = mesa.map(_valorDeOrden);
      orden = mesa;
      if (vs.some((x, i) => i > 0 && !(vs[i - 1] >= x))) { ordenDeLaMesa = true; empates.length = 0; }
    }
  }
  alOrdenServido(prio, orden);   /* §7.3·55(c): con la lente en cero, «ninguna cuenta queda primera» enumera el grupo en el orden SERVIDO (el del top o el de la foto, ya fijado arriba), no en el del concepto con que se decidió */
  return { kind: "grupo", tema: parte.tema, parteId: parte.id, cierre: parte.cierre, eje, conceptos, porEntidad, orden, cola, empates, faltantes, prioridad: prio, ...(ordenDeLaMesa ? { ordenDeLaMesa: true } : {}), ...(lenteGrupo ? { lenteGrupo } : {}), ...(empateFilo && orden.length === empateFilo.servidos ? { empateFilo } : {}), ...(fotoCompletada.length ? { fotoCompletada } : {}), claveOrden, ...(primeroAtencion ? { primeroAtencion } : {}), universoDecl: { top: top || null, base: alcance.base || null, estados: alcance.estados || null, no_estados: alcance.no_estados || null, filtros: alcance.filtros || null, bodega: alcance.bodega || null, union: alcance.union || null, excluir: alcance.excluirCompleto || null, entidades: orden } };
}

/* ── PLAN «multitema» (cierre `lectura`/`decision` SIN entidades, 1..N temas: reusa `prioridadIntegrada`, LA
 * MISMA función que ya certifica `componerEntregaMultidominio` — nunca una segunda prioridad). Con un solo tema,
 * `prioridadIntegrada` sigue siendo la fuente: su «integrada» degenera al líder de ese único dominio (nunca se
 * inventa una prioridad distinta para el caso de 1 tema). ── */
// LA MATERIALIDAD NUNCA DICE «NO OCURRE» (owner, ley de materialidad de cobranza; coordinador 2026-09-27, cierre de
// R-INICIATIVA-UNIVERSO-NO-ENTIDADES / V81) — cada dominio de un universo sin señal está en uno de DOS estados,
// nunca en un tercero inventado: «bajo el piso» (el dominio SÍ tiene lectura para estas cuentas — el concepto base
// del dominio aparece en la boleta — pero ninguna alcanza la lente de materialidad que arma la prioridad) o «sin
// evaluar» (el dominio no tiene NINGUNA lectura para estas cuentas en este recorte — el concepto base ni aparece).
// Se mira el concepto BASE de cada dominio (no la lente de materialidad en sí, que es justo lo que falta) para
// decidir cuál de los dos es.
const _CONCEPTO_BASE_DOMINIO = {
  comercial: /· (?:Margen|Venta|Contribuci[oó]n no capturada|Brecha al benchmark|Carga comercial alta)$/i,
  cobranza: /· (?:Saldo pendiente|Saldo vencido|Abonado|Recuperado|Dias Vencido)$/i,
  // RECONOCEDOR TOLERANTE (owner 2026-09-28, §7.3·30-32): «Capital frenado» → «Capital inmovilizado crítico».
  inventario: /· (?:Capital (?:frenado|inmovilizado cr[ií]tico)|D[ií]as de inventario|D[ií]as sin venta)$/i,
};
/* v22 (S31 · S16, «el criterio del usuario manda» — CLAUDE.md §2 ley 4): la lente que el usuario pidió (`criterio.lente` ≠ riesgo) GOBIERNA la prioridad de una `decision` sin universo. Antes la prioridad salía SIEMPRE «por riesgo integrado» y la Entrega
 * decía «con otra lente (contribución o ventas) puede cambiar quién va primero» aunque la lente pedida fuera esa. El orden lo da la MISMA función que ya ordena «ahora por X» (`ordenPorCriterio`, `agente/prioridadIntegrada.js`); la cifra que lo sostiene
 * es una fig de la boleta (con su hecho). Sin orden posible para esa lente con estas figs, no se sustituye en silencio: `lenteNoAplica` la declara y la prioridad de riesgo integrado lo dice. */
/* §7.3·56 + 57(a)(b): la lente «crecimiento» sobre las cuentas del plan del tema (la foto del eje · las nombradas): su medida es la variación EN %, completada con la proyección para quien la boleta no la trae, y va primero la MAYOR. A quien el dato no trae no se le ordena ni se le cuenta como 0
 * (`faltantes`: se declara «sin dato de X para Y», 52b). null cuando la lente no es de esa clase, o el eje de las cuentas no es el del tema (marca, familia, canal: su grupo la decide por su propio camino), o ninguna cuenta trae la variación (se declara, 50b). */
function _prioridadPorMedidaParcialDelPlan(temas, figs, ref, lente, tema, ctx) {
  if (!ctx || !ctx.indice || !ctx.ejesDelTenant || !tema || !conceptoDeLaMedidaParcial({ lente }, tema)) return null;
  const clave = conceptoDeLaMedidaParcial({ lente }, tema);
  const eje = sujetoDeTema(tema), miembros = Array.isArray(ctx.ejesDelTenant[eje]) ? ctx.ejesDelTenant[eje] : [];
  const pedidas = Array.isArray(ctx.entidades) && ctx.entidades.length ? new Set(ctx.entidades.map(normalizar)) : null;
  const nombres = miembros.filter((n) => (!pedidas || pedidas.has(normalizar(n))) && _figsDeEntidad(figs, n).length);
  if (!nombres.length || !productorDe(clave, eje)) return null;
  const porEntidad = new Map();
  for (const n of nombres) { const f = _filaDe(figs, n, clave); porEntidad.set(n, new Map(f && Number.isFinite(f.raw) ? [[clave, f]] : [])); }
  const faltantes = completarGrupo({ nombres, conceptos: [clave], porEntidad, eje, I: ctx.indice });
  const r = prioridadPorMedidaParcial({ lente, tema, entidades: nombres, figs, porEntidad });   /* FAMILIA 1: quién va primero lo decide `prioridad.js` */
  if (!r || r.modo !== "lente" || !r.lenteGrupo.fig) return { porLente: null, faltantes };
  const fig = r.lenteGrupo.fig, id = ref(fig);
  if (id == null) return { porLente: null, faltantes };
  return { porLente: { lente, entidad: r.primero, metrica: _conceptoDeLabel(_lab(fig)), id, dominio: "comercial", temaDeLaParte: tema }, faltantes };
}
function _prioridadPorLenteDelUsuario(temas, figs, ref, lente, temasDeDecision = null, ctx = null) {
  if (!lente || lente === "riesgo" || !CRITERIOS[lente]) return { porLente: null, lenteNoAplica: null };
  { const t0 = temaDeLaParteQuePrioriza(temasDeDecision, temas);
    const r0 = _prioridadPorMedidaParcialDelPlan(temas, figs, ref, lente, t0, ctx);
    if (r0) return r0.porLente ? { porLente: r0.porLente, lenteNoAplica: null, faltantesLente: r0.faltantes } : { porLente: null, lenteNoAplica: lente, faltantesLente: r0.faltantes }; }
  const d = prioridadPorLente(temas, figs, lente, temasDeDecision);   /* FAMILIA 1: quién va primero por la lente pedida lo decide `prioridad.js`; acá solo se declara su cifra (`ref`) */
  if (d) {
    const fig = _find(figs, new RegExp(`^${_esc(d.entidad)} · ${_esc(d.metrica)}$`, "i"));
    const id = ref(fig);
    if (id != null) return { porLente: { lente: d.lente, entidad: d.entidad, metrica: d.metrica, id, dominio: d.dominio, temaDeLaParte: d.temaDeLaParte }, lenteNoAplica: null };
  }
  return { porLente: null, lenteNoAplica: lente };
}
function _planMultiTema(temas, figs, ref, declararRazon, declararDerivada, { conDecision, lente = null, temasDeDecision = null, ctx = null }) {
  const { P, top } = prioridadCruzada(figs, temas);   /* FAMILIA 1: quién va primero entre dominios lo pregunta la pieza (la misma `prioridadIntegrada` del agente) */
  if (!P || !Object.keys(P.porDominio).length) {
    // R-INICIATIVA-UNIVERSO-NO-ENTIDADES / V81 (diagnóstico v6, coordinador 2026-09-26/27) — con el universo YA
    // restringido al `top` de cada parte (`entrega/componer.js`, `figsDelGrupo`), el grupo puede genuinamente no
    // tener NINGUNA señal de riesgo (materialidad/severidad/urgencia, `agente/prioridadIntegrada.js`) en ningún
    // dominio — antes esto devolvía `null` y tumbaba TODO el turno («ninguna parte del encargo produjo evidencia
    // suficiente»), perdiendo hasta las premisas que sí verifican sobre esas mismas cuentas por otro camino. Se
    // declina SOLO la comparación de riesgo (nunca se inventa un líder fuera del universo): el plan queda con
    // `lideres`/`top` vacíos — el resto de la Entrega sigue su curso; `sinSenal` + `estadoPorDominio` dejan un
    // límite declarado EN LENGUAJE DE NEGOCIO (nunca un nombre de archivo, nunca «no tiene X» — ver la nota de
    // `_CONCEPTO_BASE_DOMINIO` arriba: «bajo el piso» o «sin evaluar», nunca un tercer «no ocurre»).
    const estadoPorDominio = {};
    for (const d of temas) { const re = _CONCEPTO_BASE_DOMINIO[d]; estadoPorDominio[d] = re && figs.some((f) => re.test(_lab(f))) ? "bajo_el_piso" : "sin_evaluar"; }
    const idBenchComercial = temas.includes("comercial") ? ref(figDelBenchmarkOficial(figs)) : null;   /* FAMILIA 3 */
    return { kind: "multitema", temas, conDecision, lideres: {}, top: null, idsIntegrada: null, idsVersus: null, idShare: null, versusLider: null, idBenchComercial, sinSenal: true, estadoPorDominio, prioridad: { modo: null, vaAntes: false } };
  }
  const idsPorClave = new Map();
  const figPorEntSenal = new Map();
  const refSenal = (dominio, entidad, lente, rotulo) => {
    const k = `${dominio}::${entidad}::${lente}`;
    if (idsPorClave.has(k)) return idsPorClave.get(k);
    const fig = _find(figs, new RegExp(`^${_esc(entidad)} · ${_esc(rotulo)}$`, "i"));
    const id = ref(fig);
    idsPorClave.set(k, id); figPorEntSenal.set(k, fig);
    return id;
  };
  const declararSenales = (dominio, x) => { const ids = {}; for (const l of ["materialidad", "severidad", "urgencia"]) if (x[l]) ids[l] = refSenal(dominio, x.entidad, l, x[l].rotulo); return ids; };
  const lideres = {};
  { const _lid = lideresPorDominio(P); for (const d of Object.keys(_lid)) lideres[d] = { x: _lid[d], ids: declararSenales(d, _lid[d]) }; }   /* FAMILIA 1: el líder de cada dominio lo decide la pieza */
  let idsIntegrada = null, idsVersus = null;
  if (top) {
    idsIntegrada = {};
    for (const d of Object.keys(top.senales)) idsIntegrada[d] = declararSenales(d, top.senales[d]);
    if (top.versus && Array.isArray(top.versus.gana) && top.versus.gana.length) {
      idsVersus = top.versus.gana.slice(0, 3).map((it) => ({ it, idA: refSenal(it.dominio, top.entidad, it.lente, it.metrica), idB: refSenal(it.dominio, top.versus.contra, it.lente, it.metrica) }));
    }
  }
  let idShare = null;
  if (lideres.cobranza && lideres.cobranza.ids.materialidad) {
    const figVencidoTotal = _find(figs, /^Saldo vencido · total$/i);
    if (figVencidoTotal && !(Number.isFinite(figVencidoTotal.raw) && figVencidoTotal.raw === 0)) { const idTotal = ref(figVencidoTotal); idShare = idTotal ? declararRazon(lideres.cobranza.ids.materialidad, idTotal) : null; }
  }
  // TENTACIÓN PRECALCULADA GENÉRICA (mecanismo 6 del plan, owner) — la ventaja del líder de un dominio sobre el
  // segundo en la MISMA lente de materialidad (mismo concepto ⇒ misma unidad, siempre segura de restar). `idShare`
  // (arriba) solo existe con cobranza; esta cubre cualquier dominio, incluido el caso de UN SOLO tema.
  let versusLider = null;
  for (const d of Object.keys(P.porDominio)) {
    const arr = P.porDominio[d];
    if (arr.length > 1 && arr[0].materialidad && arr[1].materialidad && lideres[d]) {
      const idA = lideres[d].ids.materialidad;
      const idB = refSenal(d, arr[1].entidad, "materialidad", arr[1].materialidad.rotulo);
      const figA = figPorEntSenal.get(`${d}::${arr[0].entidad}::materialidad`), figB = figPorEntSenal.get(`${d}::${arr[1].entidad}::materialidad`);
      const idDiff = declararDerivada(figA, idA, figB, idB);
      if (idDiff) { versusLider = { dominio: d, entidad: arr[0].entidad, segundo: arr[1].entidad, idDiff }; break; }
    }
  }
  const idBenchComercial = temas.includes("comercial") ? ref(figDelBenchmarkOficial(figs)) : null;   /* FAMILIA 3 */
/* §7.3·57(c): en un encargo MIXTO (dos o más temas que deciden) cada parte que decide lleva SU oración de prioridad con el nombre de su lente (52a por parte: «ventas» en comercial, «venta a crédito» en cobranza), aunque comparta entidades con otra parte; la parte donde la lente no aplica la declara (50b). Con una sola parte que decide, el camino de siempre. */
  const _temasMixtos = conDecision && lente && lente !== "riesgo" && CRITERIOS[lente] ? temasQueDecidenPorSuCuenta(temasDeDecision) : null;
  let porLente = null, lenteNoAplica = null, porLentePorParte = null, faltantesLente = [];
  if (_temasMixtos) {
    porLentePorParte = _temasMixtos.map((t) => { const r = _prioridadPorLenteDelUsuario([t], figs, ref, lente, [t], ctx); faltantesLente.push(...(r.faltantesLente || [])); return { tema: t, porLente: r.porLente || null, lenteNoAplica: r.porLente ? null : lente }; });
    porLente = (porLentePorParte.find((x) => x.porLente) || {}).porLente || null;
    lenteNoAplica = porLente ? null : lente;
    if (!porLente) porLentePorParte = null;   /* ninguna parte la aplica: se declara una vez, como siempre (`lenteNoAplica`) */
  } else if (conDecision) { const r = _prioridadPorLenteDelUsuario(temas, figs, ref, lente, temasDeDecision, ctx); porLente = r.porLente; lenteNoAplica = r.lenteNoAplica; faltantesLente = r.faltantesLente || []; }
  /* FAMILIA 1: qué oración de prioridad cruzada se dice (por la lente pedida · el criterio pedido no ordena · «riesgo» sobre un dominio · riesgo integrado) y si se sirve el «va antes que» lo decide la pieza; los renders solo redactan */
  const prioridad = { modo: modoDeLaCruzada({ top, conDecision, porLente, lenteNoAplica, lenteRiesgoPedida: lente === "riesgo", temas, lideres }), vaAntes: vaAntesQue({ top, porLente, hayVersus: !!(idsVersus && idsVersus.length) }) };
  return { kind: "multitema", temas, conDecision, temaDeLaParte: temaDeLaParteQuePrioriza(temasDeDecision, temas), lideres, top, idsIntegrada, idsVersus, idShare, versusLider, idBenchComercial, prioridad, ...(porLente ? { porLente } : {}), ...(lenteNoAplica ? { lenteNoAplica } : {}), ...(porLentePorParte ? { porLentePorParte } : {}), ...(faltantesLente.length ? { faltantesLente } : {}), ...(lente === "riesgo" ? { lenteRiesgoPedida: true } : {}) };
}

/* ── PLAN «comparacion» (2 entidades, mismo eje — `compareEntities`) ─────────────────────────────────────────── */
function _planComparacion(parte, figs, ref, declararDerivada, I = null) {
  const [a, b] = parte.entidades;
  if (!a || !b) return null;
  const figsA = _figsDeEntidad(figs, a.nombre), figsB = _figsDeEntidad(figs, b.nombre);
  const conceptosA = new Map(figsA.map((f) => [_conceptoDeLabel(_lab(f)), f]));
  // A6 (diagnóstico v7, MATERIAL) — `parte.conceptos` acota lo que el usuario pidió comparar: MISMO criterio que
  // ya respeta `_planCifraGrupo` (`conceptosBase`, más arriba) — con la lista poblada, se descarta cualquier
  // concepto fuera de ella ANTES de armar los pares; sin lista (vacía), el comportamiento no cambia (todo lo que
  // ambas entidades comparten, como antes).
  const conceptosPedidos = parte.conceptos && parte.conceptos.length ? new Set(parte.conceptos) : null;
  const pares = [];
  let sinClave = false;   /* FAMILIA 4: un par cuya cifra el léxico no conoce se declara, no se imprime con el rótulo crudo del productor */
  for (const [conceptoDelProductor, figA] of conceptosA) {
    if (conceptosPedidos && !conceptosPedidos.has(_claveDeFig(figA))) continue;
    const figB = figsB.find((f) => _conceptoDeLabel(_lab(f)) === conceptoDelProductor);
    if (!figB) continue;
    /* FAMILIA 4 (§7.3·49f · 51f): el par lleva el rótulo del léxico de SU clave («Venta a crédito» y no «Venta (flujo)»; «Venta» y no «Ventas»; «Días de inventario» y no «Cobertura (DOH)»), el mismo en la fila, en la diferencia y en la oración */
    const rot = rotuloDeLaCasa({ fig: figA });
    if (rot.sinClave) { sinClave = true; continue; }
    if (pares.some((p) => p.clave === rot.clave)) continue;   /* «la misma cifra nunca con dos rótulos»: dos figs del productor que son el mismo concepto del léxico («Cobertura (DOH)» y «Días de inventario») dan UN par */
    const concepto = rot.rotulo;
    const idA = ref(figA), idB = ref(figB);
    if (!idA || !idB) continue;
    const idDiff = declararDerivada(figA, idA, figB, idB);
    /* §7.3·39(c)/40(c) (v17, P-C): un lado que vale exactamente 0 (cantidad: dinero, días, unidades) se dice en palabras junto a su cifra, con el mismo criterio de toda superficie (`esCero`/`dichoElCero`) */
    pares.push({ concepto, idA, idB, idDiff, ceroA: esCero(figA.raw, figA.unit), ceroB: esCero(figB.raw, figB.unit), clave: rot.clave });
  }
  /* FAMILIA 2 (§7.3·51b · 52b): cada entidad comparada tiene su fila en cada concepto pedido que su productor publica (la boleta, la proyección o su cero de cobertura declarada). Un concepto que la boleta no trajo para los dos lados se completa con la misma pieza: si ambos lados lo tienen forma su par; si solo uno, su fila va sola; el lado sin dato se declara («sin dato de X para Y») */
  const sueltos = [], faltantes = [];
  if (conceptosPedidos && I) {
    const yaPar = new Set(pares.map((p) => p.clave).filter(Boolean));
    for (const c of parte.conceptos) {
      if (yaPar.has(c)) continue;
      const lados = [a, b].map((x) => ({ x, r: filasDeEntidad({ entidad: x.nombre, eje: x.eje || parte.eje, conceptos: [c], figDe: (k) => _filaDe(figs, x.nombre, k), I }) }));
      const fA = lados[0].r.filas[0], fB = lados[1].r.filas[0];
      const concepto = _labelDeClave(c) || c;
      if (fA && fB) {
        const idA = ref(fA.fig), idB = ref(fB.fig);
        if (!idA || !idB) continue;
        const idDiff = declararDerivada(fA.fig, idA, fB.fig, idB);
        pares.push({ concepto, idA, idB, idDiff, ceroA: esCero(fA.fig.raw, fA.fig.unit), ceroB: esCero(fB.fig.raw, fB.fig.unit), clave: c });
      } else {
        for (const { x, r } of lados) { const fx = r.filas[0]; if (fx) { const id = ref(fx.fig); if (id) sueltos.push({ entidad: x.nombre, concepto, id }); } else if (r.faltantes.length) faltantes.push({ entidad: x.nombre, clave: c }); }
      }
    }
  }
  if (!pares.length && !sueltos.length && !faltantes.length && !sinClave) return null;
  return { kind: "comparacion", tema: parte.tema, parteId: parte.id, a: a.nombre, b: b.nombre, pares, sueltos, faltantes, ...(sinClave ? { sinClave: [a.nombre, b.nombre] } : {}) };
}

/* CORTE 3d (owner 2026-09-26) — el CONCEPTO de negocio de un supuesto, nunca su `tipo` interno («custom» es
 * jerga del sistema, no una palabra que un dueño de negocio reconozca). El tipo YA es un concepto nombrado
 * (`config/contract/assumptionRegistry.js`, §7.1): carga/costo/price/growth/margin — un supuesto sin concepto
 * nombrable (`custom` no migrado) ya NO llega acá (`validar.js:_resolverSupuestosRaiz` lo declina antes,
 * `supuesto_mal_formado`); el `null` de abajo es defensivo, para un caso legado que no pasó por esa validación. */
/* FAMILIA 4: los conceptos que el léxico conoce (carga · costo · margen) se dicen con SU rótulo en minúscula (`rotulos.js`); «precio» y «volumen» no son conceptos del léxico y se dicen como siempre */
const _CONCEPTO_DE_SUPUESTO = { carga: `la ${rotuloEnOracion({ clave: "carga" })}`, costo: `el ${rotuloEnOracion({ clave: "costo" })}`, price: "el precio", growth: "el volumen", margin: `el ${rotuloEnOracion({ clave: "margen" })}` };
function _fraseDeSupuesto(s) {
  if (!s) return null;
  // «liberar el capital inmovilizado» (simulateCapital) es una acción SIN parámetro numérico — no hay «−1%» que
  // nombrar en prosa (el problema que motivó este corte), así que `tipo:"custom"` acá nunca fue jerga: se queda
  // como estaba (validar.js no lo retiró, ver su comentario en `_productorDeSupuesto`).
  if (s.productor === "simulateCapital") return "liberar el capital inmovilizado";
  const concepto = _CONCEPTO_DE_SUPUESTO[s.tipo];
  if (!concepto || !Number.isFinite(s.valor)) return null;
  const magnitud = Math.abs(s.valor);
  // §7.3·38(c) (diagnóstico v14): un monto se dice con el formato de la casa («$500K»), nunca con la clave interna de su unidad («500000 money»)
  const unidadTxt = s.unidad === "pp" ? (magnitud === 1 ? "1 punto" : `${magnitud} puntos`) : s.unidad === "pct" ? `${magnitud}%` : s.unidad === "money" ? formatoDeLaCasa(magnitud, "money") : `${magnitud} ${s.unidad}`;
  const verbo = s.valor > 0 ? "sube" : s.valor < 0 ? "baja" : "se mueve";
  return `${concepto} ${verbo} ${unidadTxt}`;
}
const _capitaliza = (s) => { const t = String(s || ""); return t ? t.charAt(0).toUpperCase() + t.slice(1) : t; };

/* ── PLAN «simulacion» (`simulate*` ya resuelto por `lecturasDe`/`validar.js`) — CADA hecho de la simulación
 * lleva su DUEÑO (owner 2026-09-26, error MATERIAL hallado en D27: 96 filas de clientes que la parte NUNCA pidió,
 * cifras "Base (real)"/"Resultado" sin entidad). Se organiza por BLOQUE (uno por entidad del universo pedido, más
 * un bloque "Negocio" para lo que la tool devuelve sin entidad propia — benchmark, montos agregados): CADA bloque
 * declara su `entidad`, y dentro de él se clasifican las CINCO piezas del plan (§1, ejemplo §7): base · supuesto ·
 * resultado · delta · límites. Ninguna pieza que la tool no sostenga se inventa — se declara ausente.
 *
 * UNIVERSO (§3 de la garantía) — el filtro es por ENTIDAD RESUELTA (`I.resolverEntidad`, la MISMA que ya usa
 * `notario/evidencia.js` para no confundir «Supuesto · movimiento de carga» con una entidad llamada «Supuesto»),
 * nunca por texto: toda fig cuya entidad resuelta no esté en `parte.entidades`/el alcance del supuesto se
 * DESCARTA y se cuenta (`descartadasFueraDeUniverso`) — nunca se sirve en silencio ni se pierde sin rastro.
 *
 * El SUPUESTO no es una fig: es el dato del encargo que el usuario ya declaró (`Supuesto`, procedencia
 * `supuesto_usuario`) — la casa no lo verifica contra la boleta, solo lo cita con su dueño y su concepto. */
function _planSimulacion(parte, figs, supuesto, ref, declararDerivada, I) {
  if (!figs.length || !supuesto) return null;
  const fraseSupuesto = _fraseDeSupuesto(supuesto);
  if (!fraseSupuesto) return { kind: "simulacion", tema: parte.tema, parteId: parte.id, sinConcepto: true, supuesto };

  // el universo pedido: PRIMERO la Resolucion (`parte.entidades`, ask 3 — «el plan se arma solo con las entidades
  // y el universo de la Resolucion»); si la parte no trae entidades explícitas, el alcance del propio supuesto.
  const nombresDeParte = (parte.entidades || []).map((e) => e.nombre).filter(Boolean);
  const nombrePedido = supuesto.alcance && supuesto.alcance !== "negocio" ? supuesto.alcance.nombre : null;
  const entidadesPermitidas = nombresDeParte.length ? new Set(nombresDeParte) : (nombrePedido ? new Set([nombrePedido]) : null);

  const bloquesPorEntidad = new Map();
  const negocio = { base: [], resultado: [] };
  let descartadas = 0;
  for (const f of figs) {
    const label = _lab(f);
    const partesLabel = String(label || "").split(/\s+·\s+/);
    let entidad = null, concepto = _conceptoDeLabel(label);
    if (partesLabel.length > 1 && I && typeof I.resolverEntidad === "function") {
      const e0 = I.resolverEntidad(partesLabel[0]);
      if (e0) { entidad = e0.nombre; concepto = partesLabel.slice(1).join(" · "); }
      else if (partesLabel.length === 2) {
        // convención invertida de algún composer («Lectura relativa descartada · Falabella»): la entidad real
        // queda AL FINAL — se reconoce por la MISMA resolución, nunca por una lista de rótulos a mano.
        const eN = I.resolverEntidad(partesLabel[1]);
        if (eN) { entidad = eN.nombre; concepto = partesLabel[0]; }
      }
    }
    if (entidad && entidadesPermitidas && !entidadesPermitidas.has(entidad)) { descartadas++; continue; }
    const id = ref(f);
    if (!id) continue;
    const grupo = entidad ? (bloquesPorEntidad.get(entidad) || (bloquesPorEntidad.set(entidad, { entidad, base: [], resultado: [] }), bloquesPorEntidad.get(entidad))) : negocio;
    // simulateCapital («liberar el capital inmovilizado») es una acción SIN estado "antes" que contrastar — no
    // hay un "supuesto"/"meta" en el rótulo (a diferencia de carga/costo) porque no hay una comparación base↔
    // resultado, solo el efecto de la acción — así que TODA fig de entidad de este productor ES el resultado
    // (nunca queda vacío el bloque, nunca se le pide una "base" que este productor no publica).
    const esAccionSinBase = entidad && supuesto.productor === "simulateCapital";
    if (esAccionSinBase || /supuest[oa]|meta\s*·/i.test(concepto)) grupo.resultado.push({ concepto, id, fig: f });
    else grupo.base.push({ concepto, id, fig: f });
  }

  // EMPAREJAMIENTO base↔resultado — SIEMPRE dentro del MISMO bloque (misma entidad, mismo escenario), cuando un
  // resultado y una base comparten el MISMO prefijo de concepto (ej. «Margen actual» ↔ «Margen supuesto»). Nunca
  // un par entre conceptos distintos ni entre bloques distintos (eso sería comparar entidades, un hecho
  // `comparacion` aparte, fuera de alcance porque el motor de hoy corre UN supuesto por parte — nunca dos
  // escenarios a la vez). El par es la unidad que la garantía "comparables juntas" narra («de 22,0 % a 23,0 %»,
  // owner 2026-09-26): NUNCA se sirve un "resultado" sin decir de dónde partió, cuando el dato SÍ trae esa base.
  const _normConcepto = (s) => String(s || "").replace(/\s*(actual|supuest[oa]|propuest[oa])\s*$/i, "").trim().toLowerCase();
  const _emparejar = (grupo) => {
    const pares = [], resultadoSueltos = [];
    for (const r of grupo.resultado) {
      const prefijo = _normConcepto(r.concepto);
      const b0 = grupo.base.find((x) => _normConcepto(x.concepto) === prefijo);
      if (b0) pares.push({ concepto: prefijo, base: b0, resultado: r }); else resultadoSueltos.push(r);
    }
    const idsBaseEnPares = new Set(pares.map((p) => p.base.id));
    const baseSinPar = grupo.base.filter((b) => !idsBaseEnPares.has(b.id));
    return { pares, resultadoSueltos, baseSinPar };
  };

  const bloques = [];
  for (const [, grupo] of bloquesPorEntidad) {
    if (!grupo.base.length && !grupo.resultado.length) continue;
    const { pares, resultadoSueltos, baseSinPar } = _emparejar(grupo);
    let idDelta = null, deltaConcepto = null;
    for (const p of pares) { const id = declararDerivada(p.resultado.fig, p.resultado.id, p.base.fig, p.base.id); if (id) { idDelta = id; deltaConcepto = p.concepto; break; } }
    // DECISIÓN 38(c) (diagnóstico v14, A5): un crecimiento en DINERO se simuló como volumen a precio constante; la conversión a % de la venta del período cerrado de la entidad es una cifra REAL de la
    // simulación (el `%` de volumen que la tool calculó y publicó: «<entidad> · Volumen propuesto») y la Entrega la DECLARA como supuesto (`idConversion`), nunca la esconde como jerga del motor.
    const esCrecimientoEnDinero = supuesto.tipo === "growth" && supuesto.unidad === "money" && supuesto.productor === "simulateGeneral";
    const conversion = esCrecimientoEnDinero ? baseSinPar.find((b) => _normConcepto(b.concepto) === "volumen" && b.fig && b.fig.unit === "pct") : null;
    bloques.push({ entidad: grupo.entidad, pares, resultadoSueltos, baseSinPar: conversion ? baseSinPar.filter((b) => b !== conversion) : baseSinPar, idDelta, deltaConcepto, sinDelta: !idDelta, idConversion: conversion ? conversion.id : null });
  }
  if (!bloques.length && !negocio.base.length && !negocio.resultado.length) return null;

  return { kind: "simulacion", tema: parte.tema, parteId: parte.id, supuesto, fraseSupuesto, bloques, negocio, descartadasFueraDeUniverso: descartadas, universoPedido: entidadesPermitidas ? [...entidadesPermitidas] : null };
}

/* CORTE 3e (owner 2026-09-26, «LA ENTREGA NO LE HABLA A NADIE», resuelto por el owner) — «una sola verdad por
 * concepto, dos registros de presentación»: `facts.definicion`/`facts.distingue` (de `oracle/toolRegistry.js:
 * defineConcept`, que lee `sentrix/glossary.js`) siguen en tuteo — es el registro CORRECTO de Sentrix, y esta
 * Entrega NUNCA los lee. En vez de parchear ese texto acá (lo que se intentó primero y el owner descartó: un
 * posesivo «tu»→«su» no cubre un VERBO conjugado en tú, «la referencia que definiste»), el glosario declara
 * `CONCEPT_DEFS[slug].neutra` — la MISMA definición, en tercera persona, escrita a mano para los conceptos que
 * nombraban al usuario y heredada automáticamente (mismo texto) para los que ya eran de tercero (ver el backfill
 * al pie de `CONCEPT_DEFS` en glossary.js). Esta función va a buscarla por `facts.slug` (aditivo en
 * `defineConcept`, nunca leído por el chat) — NUNCA arma texto a mano ni transforma `facts.definicion`. Sin
 * `neutra` (un concepto sin backfill, o `facts.slug` ausente porque la resolución no fue por CONCEPT_DEFS —
 * inalcanzable hoy, ver la nota de `resolveGlossary`), la definición se DECLINA (`"sin_neutra"`, el llamador la
 * declara como límite) — nunca se sirve el texto de Sentrix como si fuera neutro. */
/* ── PLAN «definicion» — sin figs, sin dígitos: `defineConcept` nunca lee la boleta (contrato §1.1). ─────────── */
function _planDefinicion(parte, facts) {
  if (!facts || !facts.es_definicion) return null;
  const c = facts.slug ? CONCEPT_DEFS[facts.slug] : null;
  const neutra = c && c.neutra;
  if (!neutra || !neutra.def) return "sin_neutra";
  return {
    kind: "definicion", tema: parte.tema, parteId: parte.id, concepto: objetivoPorMeta(neutra.aka || facts.concepto),   /* v21 (T12): el título «meta: …» se dice «objetivo: …» — la palabra de la casa (`verificarEntrega` marcaba «registro-informal» según los vecinos del título) */
    definicion: neutra.def, distingue: neutra.distingue || null,
  };
}

/* ═══ (1) CORRECCIÓN DEL SUPERVISOR (2026-09-25, error MATERIAL de CONCEPTO) — EL MARCO POR DOMINIO ═══════════════
 * Una Entrega de cobranza decía «Marco. ADI Demo, 13 clientes, foto de inventario a hoy» — cobranza NO es
 * inventario. Raíz: `figureType.js:PERIODO_TXT.hoy = "foto de inventario a hoy — no es un promedio anual"` es un
 * texto GLOBAL (usado por TODO el sistema, no solo esta Entrega) que asume que la familia "hoy" siempre es
 * inventario; es correcto para inventario y FALSO para cobranza, que también es una foto al corte (el propio
 * archivo ya lo advierte: "dias_inventario: nombre incorrecto, período correcto, NO SE TOCA" — las figs de
 * cobranza caen ahí por compatibilidad de UNIDAD, no de significado). NO se toca `figureType.js` (archivo
 * compartido por todo el sistema, un cambio ahí es una decisión de otro alcance): se generaliza al camino
 * GENERAL la MISMA solución que ya usa `componerEntregaCobranza` (la ruta fija) — nunca `periodoDeFiguras` sobre
 * figs de cobranza, siempre `facts.fechaCorte` de la propia tool `cobranza`, la fuente MÁS verificable que ya
 * usa la pestaña Flujo Comercial. Comercial/inventario siguen exactamente igual (`_periodoDelMarco`, sin tocar). */
/* §7.3·49: el agregado de cobranza («Saldo vencido · total») lleva su concepto ANTES del «·» (no hay entidad delante): se mira cada segmento del rótulo, no solo lo que sigue al primero — sin esto el total de cobranza se leía como una fig de OTRO dominio y el Marco de una Entrega solo de cobranza decía «dos marcos… foto de inventario a hoy» */
const _esFigDeCobranza = (fig) => { const partes = String(_lab(fig) || "").split("·").map((x) => x.trim()).filter(Boolean); const conceptos = [_conceptoDeLabel(_lab(fig)), ...partes]; return conceptos.some((c) => { const clave = claveDeMetrica(c); return !!clave && dominioDeClave(clave) === "cobranza"; }); };
function _fechaCorteDeCobranza(rp, plan) {
  const idx = plan && Array.isArray(plan.calls) ? plan.calls.findIndex((c) => c && c.tool === "cobranza") : -1;
  if (idx < 0) return null;
  const facts = rp && rp.results && rp.results[idx] && rp.results[idx].facts;
  return (facts && facts.fechaCorte) || null;
}
function _periodoGeneralPorDominio({ figsUsadas, temasCubiertos, rp, plan }) {
  // comercial/inventario: la MISMA fuente de siempre, pero SIN las figs de cobranza (que `periodoDeFiguras`
  // clasificaría mal — ver la cabecera de arriba).
  const figsNoCobranza = figsUsadas.filter((f) => !_esFigDeCobranza(f));
  const noCobranza = figsNoCobranza.length ? _periodoDelMarco(figsNoCobranza) : { periodo: null, faltaRango: false };
  let periodoCobranza = null;
  if (temasCubiertos.has("cobranza")) {
    const fechaCorte = _fechaCorteDeCobranza(rp, plan);
    // MISMA forma que la ruta fija de cobranza (`componerEntregaCobranza`): "foto de cobranza al {fecha}".
    if (fechaCorte) periodoCobranza = { tipo: "foto", texto: `foto de cobranza al ${fechaCorte}`, familias: ["cobranza"], rango: fechaCorte };
  }
  if (noCobranza.periodo && periodoCobranza) {
    // combinación de dos o tres marcos en una sola declaración — misma idea que `PERIODO_MIXTO_TXT`
    // (figureType.js) para comercial+inventario, generalizada acá para incluir cobranza sin tocar ese archivo.
    const partesTexto = [];
    if (noCobranza.periodo.familias.includes("anual")) partesTexto.push("la venta, el margen y la contribución son del año cerrado — los 12 meses ya ocurrieron");
    if (noCobranza.periodo.familias.includes("hoy")) partesTexto.push("el capital, el stock, la rotación y los días de inventario son la foto de inventario a hoy");
    partesTexto.push(`la cobranza es una foto al ${periodoCobranza.rango}`);
    const texto = `${partesTexto.length > 2 ? "tres marcos" : "dos marcos"} en la misma respuesta: ${partesTexto.join("; ")}. Cada cifra se declara con el suyo.`;
    return { periodo: { tipo: "mixto", texto, familias: [...noCobranza.periodo.familias, "cobranza"], rango: null }, faltaRango: noCobranza.faltaRango };
  }
  if (periodoCobranza) return { periodo: periodoCobranza, faltaRango: false };
  return noCobranza;
}

// CORTE 3d.3 (owner 2026-09-25/26) — `encargo.profundidad` ya lo valida `validar.js` (solo membresía de enum: un
// valor inválido queda en `noResuelto`, nunca bloquea el encargo — el compositor cae al default). Acá se REUSA
// la MISMA lista (`PROFUNDIDAD_VALORES`), nunca una segunda regla de qué profundidad es válida.
function _profundidadDe(resolucion) {
  const p = resolucion && resolucion.encargo && resolucion.encargo.profundidad;
  return PROFUNDIDAD_VALORES.includes(p) ? p : "completa";
}
// el título vive SOLO en la primera línea del texto ya renderizado (`**ENTREGA ADI · <título>**`, ver
// `_textoDeLaEntrega`) — nunca se duplicó en `entrega` porque hasta este corte nadie necesitaba re-renderizar un
// resultado ya armado. Extraerlo de ahí (en vez de inventar un segundo campo `entrega.titulo`) es lo mínimo para
// que `gobernarTamano` pueda volver a llamar a `_textoDeLaEntrega` con el MISMO título, incluso sobre el
// resultado ya delegado de una ruta fija.
function _tituloDeTexto(texto) {
  const m = /^\*\*ENTREGA ADI · (.+)\*\*/.exec(String(texto || "").split("\n", 1)[0] || "");
  return m ? m[1] : "Encargo";   // CORTE 3e (owner 2026-09-26) — «Su encargo» → «Encargo» (tercera persona)
}
// CORTE 3d.4 (owner 2026-09-26) — `entregaRef` determinístico: MISMO tenant + MISMA versión de datos + MISMO
// encargo canónico ⇒ MISMO ref, sin cálculo nuevo (para que «deme la fila completa de e14» se resuelva por
// identidad, no por recomputar). El "tenant" es el que el Marco ya declara (`entrega.marco.empresa`, la MISMA
// fuente que ya imprime la Entrega — nunca una segunda identidad de tenant); la "versión de datos" es el
// `scenario` activo (`config/scenarios.js` — el único versionado de datos que existe en este corte de
// desarrollo; Etapa 2/Supabase reemplazará esto por un version-id real sin tocar la forma del ref). El encargo
// se canoniza con el MISMO orden de campos que `CAMPOS_RAIZ` (esquema.js) declara — nunca el orden en que el
// llamador escribió las claves, para que dos serializaciones del MISMO encargo (distinto orden de teclas) den el
// MISMO hash.
function _encargoCanonico(encargo) {
  if (!encargo || typeof encargo !== "object") return {};
  const out = {};
  for (const campo of CAMPOS_RAIZ) if (campo in encargo) out[campo] = encargo[campo];
  return out;
}
function _entregaRefDe(tenant, scenario, encargo) {
  const canon = JSON.stringify(_encargoCanonico(encargo));
  const h = createHash("sha1").update(`${tenant || ""}|${scenario}|${canon}`).digest("hex");
  return `E:${h}`;
}
// aplica `gobernarTamano` sobre CUALQUIER resultado ya armado — la ruta general Y las 4 rutas fijas DELEGADAS
// (nunca las 4 funciones exportadas cuando se llaman DIRECTO: esas quedan byte a byte, ver la cabecera del
// archivo). Con las 4 rutas fijas de hoy (D08-D11, medidas: todas caben bajo el tope de "completa" sin recortar
// nada) esto es un no-op de TEXTO — el candado de equivalencia byte a byte (`_entrega_general_gate` sección 1)
// solo compara `.texto`, así que agregar `entrega.meta`/`entrega.detalle` acá no lo rompe.
// CORTE 3d.3 (owner 2026-09-26, ronda final) — «breve ≤ 350 en TODO, incluidos los resultados DELEGADOS»: las 4
// rutas fijas no declaran `.prioridad` (nunca se tocan) — acá, ANTES de gobernar, se marca prioridad 0 en la
// oración que YA es la conclusión del procedimiento por LEY (CLAUDE.md §2 ley 4): la que abre con «Prioridad del
// procedimiento» o «Quien más pesa en el conjunto». Un ítem que YA declara `.prioridad` (el camino general, que
// la asigna en FASE 2) se deja intacto — esto NUNCA pisa una prioridad ya explícita, solo rellena la de las
// rutas fijas, que no tienen ninguna.
// FAMILIA 1 (consolidación): «cuál es la oración de prioridad» ya no se lee de la prosa con una expresión regular: cada oración de
// prioridad que compone la Entrega lleva su MARCA ESTRUCTURAL (`_prioridad`, `prioridad.js:marcaDePrioridad`).
// CORTE 3d.3 (owner 2026-09-26, cierre de "breve") — la entidad PRIORITARIA de una Entrega es la que nombra la
// conclusión integrada (`prioridad.js:primeroDeLaConclusion`, el veredicto de `prioridadIntegrada`) — se REUSA esa MISMA oración
// para decidir, en "breve", cuál pregunta de "Para su juicio" se sirve (garantía: nunca una segunda definición de "quién va primero").
// la ORACIÓN de guía de uso genérica del Marco (fallback de `_vacia`/simulación cuando `entrega.marco.
// definiciones` no trae nada propio) — es una instrucción de CÓMO LEER la Entrega, no un hecho del negocio; en
// "breve" se retira del Marco y se declara en `detalle.notaDeUso` (nunca desaparece, cambia de sección).
const _esGuiaDeUsoGenerica = (s) => /^Cada cifra de esta Entrega viaja con su dueño/.test(String(s || ""));

// CORTE 3d.3 (owner 2026-09-26, cierre del corte; renombrado owner 2026-09-26 por `_colapso_eje_gate` C4) — «el
// tope de 8 filas es un MÁXIMO, no una garantía; si hay celdas con texto largo (rótulos de supuesto/simulación)
// que se REPITEN en cada fila, en "breve" se abrevian con el rótulo corto de la casa». Nunca cambia `f.valores`
// (la estructura de la fila queda IDÉNTICA en breve y en completa — el candado "breve ⊂ completa" compara
// `f.valores` byte a byte): es una transformación de RENDER, aplicada solo al imprimir la tabla.
// `_ROTULO_CORTO_COLUMNA` cubre las columnas que hoy repiten el MISMO valor en cada fila de una simulación
// (Simulación siempre es "Simulación declarada por usted"; Supuesto es la MISMA frase de negocio para las N
// filas del bloque) — nunca las columnas que sí varían por fila (Entidad, Métrica, Valor, Tipo).
function _supuestoCorto(fraseCompleta) {
  const s = String(fraseCompleta || "");
  if (/^liberar/i.test(s)) return "Liberar capital";
  const m = /^(?:la |el )?([a-záéíóúñ ]+?)\s+(sube|baja|se mueve)\s+(\d+(?:[.,]\d+)?)\s*(punto|puntos|%|[a-záéíóúñ]+)/i.exec(s);
  if (!m) return s;
  const concepto = _capitaliza(m[1].trim());
  const signo = /^baja$/i.test(m[2]) ? "−" : /^sube$/i.test(m[2]) ? "+" : "";
  const unidad = /^punto/i.test(m[4]) ? "pp" : m[4] === "%" ? "%" : ` ${m[4]}`;
  return `${concepto} ${signo}${m[3]}${unidad}`;
}
// «Planteada» (concuerda con «la simulación», femenino) — antes «Declarada» (y antes «Declarado»): el rótulo corto de la columna es la primera palabra de su frase completa («Simulación planteada en la consulta»,
// de la tabla única de orígenes, §7.3·58): una simulación la plantea quien consulta, no la declara la empresa.
const _ROTULO_CORTO_COLUMNA = { "Simulación": () => _capitaliza(String(etiquetaDeProcedencia(procedenciaDeSupuesto(), { genero: "f" })).split(" ")[0]), Supuesto: (v) => _supuestoCorto(v) };
function _conPrioridadDeConclusion(entrega) {
  if (!Array.isArray(entrega.respuesta) || !entrega.respuesta.length) return entrega;
  let cambio = false;
  const respuesta = entrega.respuesta.map((r) => {
    if (typeof r.prioridad === "number" || !esOracionDePrioridad(r)) return r;
    cambio = true;
    return { ...r, prioridad: 0 };
  });
  return cambio ? { ...entrega, respuesta } : entrega;
}

/* §7.3·50(d): el productor del capital inmovilizado crítico por familia (`inventoryStatus` con foco «frenado») rotula sus cifras «<familia> · Familia» —el rótulo de su eje, ningún concepto del léxico—, y la lectura del Encargo no las reconocía como el concepto que son: una premisa sobre «capital inmovilizado crítico» por familia quedaba «sin evidencia». En la boleta del ENCARGO (la copia que esta Entrega lee; la del agente no cambia) la fig lleva el rótulo de su concepto, el mismo que ya llevan las cifras por bodega de ese foco. */
function _rotularCapitalPorFamilia(figs, plan) {
  for (const f of Array.isArray(figs) ? figs : []) {
    if (!f || !f.origin || f.origin.tool !== "inventoryStatus" || !/ · Familia$/.test(String(f.label || ""))) continue;
    const c = plan && Array.isArray(plan.calls) ? plan.calls[Number(String(f.origin.callId).slice(1))] : null;
    if (c && c.args && c.args.focus === "frenado") f.label = String(f.label).replace(/ · Familia$/, ` · ${rotuloDeLaCasa({ clave: "capital_frenado" }).rotulo}`);   /* FAMILIA 4: el rótulo del léxico de SU concepto («Capital inmovilizado crítico»), no uno escrito acá */
  }
}
function _conTamanoGobernado(resultado, resolucion) {
  if (!resultado || !resultado.ok || !resultado.entrega) return resultado;
  const profundidad = _profundidadDe(resolucion);
  const titulo = _tituloDeTexto(resultado.texto);
  const entregaConPrioridad = _conPrioridadDeConclusion(resultado.entrega);
  const { entrega: entregaGob, detalle, meta, texto } = gobernarTamano(entregaConPrioridad, profundidad, _textoDeLaEntrega, titulo);
  const encargoCrudo = resolucion && resolucion.encargo;
  const comoPedirlo = encargoCrudo ? { ..._encargoCanonico(encargoCrudo), profundidad: "completa" } : null;
  // NOTA DE USO (owner 2026-09-26, cierre del corte) — dos fuentes posibles, combinadas en un ARRAY (nunca se
  // pisan): la libertad narrativa de una simulación en bloques (siempre que haya bloques, cualquier profundidad)
  // y la guía de uso genérica del Marco («Cada cifra…»), que en "breve" se retira del Marco y se declara acá —
  // la MISMA condición que `_textoDeLaEntrega` usa para omitirla del render (nunca dos criterios distintos).
  // CORTE 3e (owner 2026-09-26, «LA ENTREGA NO LE HABLA A NADIE», ley 1) — la nota de uso SIEMPRE declara que la
  // Entrega va en tercera persona y que el trato es del LLM anfitrión, no de ADI: «adapte» (imperativo de usted)
  // se dirige al NARRADOR que lee esta Entrega, nunca al lector final de la respuesta que ese narrador escriba —
  // el mismo registro que ya usa la nota de la libertad narrativa de abajo («Narre con libertad…»). Sin esto, un
  // narrador podría leer «declarado por la empresa» y suponer que ADI no sabe tratar de tú/usted, en vez de
  // entender que la composición es a propósito neutra para que él (el narrador) decida el trato con su usuario.
  const notas = ["Esta Entrega no se dirige al usuario; adapte el trato a su conversación."];
  if (entregaGob._simulacionConBloques) notas.push("Narre con libertad; nombre la simulación o la entidad solo cuando una cifra salga de su bloque o se compare con otra.");
  if (profundidad === "breve" && (entregaGob.marco.definiciones || []).some(_esGuiaDeUsoGenerica)) notas.push("Cada cifra de esta Entrega viaja con su dueño, su período y su origen; universos distintos nunca se suman.");
  // CORTE 3d (owner 2026-09-26, garantía §3 de la simulación) — `descartadasFueraDeUniverso`: cuántas figs
  // descartó `_planSimulacion` por pertenecer a una entidad que la parte NO pidió (nunca servidas, nunca
  // silenciadas del todo: el conteo queda en `meta`). `0` cuando la Entrega no tiene ninguna simulación.
  const entrega = {
    ...entregaGob,
    detalle: { ...(detalle || {}), comoPedirlo, ...(notas.length ? { notaDeUso: notas } : {}) },
    meta: { ...meta, entregaRef: _entregaRefDe(entregaGob.marco && entregaGob.marco.empresa, ESCENARIO_INICIAL, encargoCrudo), descartadasFueraDeUniverso: resultado.entrega._simulacionDescartadas || 0, descartadasJergaInterna: resultado.entrega._simulacionDescartadasJerga || 0 },
  };
  return { ...resultado, texto, entrega };
}

/** componerEntrega(resolucion) → { texto, entrega, libro, ok, motivo }. Recibe la `Resolucion` del validador
 *  (`encargo/validar.js`), corre `lecturasDe(resolucion)` sobre el Core y arma la Entrega de siete partes para
 *  CUALQUIER encargo válido — generalización de las 4 funciones de arriba (que quedan como envolturas/fixtures
 *  de equivalencia, ver la cabecera). CERO lectura de `resolucion.encargo.preguntaOriginal` (carnada del gate). */
/* §7.3·50(c): el tope de tamaño puede no alcanzar para las entidades ENTERAS que citan las cabezas de los grupos de una `lectura`/`decision` con varias partes. Entonces la cabeza cita solo las que caben enteras —de a una menos por vuelta, nunca menos de una— y el resto queda declarado en la nota «N filas más en el detalle (mismo conjunto)» de siempre. La prueba es sobre la Entrega ya gobernada: una entidad que la cabeza cita y que tiene alguna fila en el Detalle está partida entre Cifras y Detalle. */
const _NOMBRE_DE_TEMA = (t) => _DOM_NOMBRE[t] || t;
function _cabezaPartida(resultado) {
  const e = resultado && resultado.ok && resultado.entrega;
  if (!e || !Array.isArray(e.respuesta)) return false;
  const detalle = (e.detalle && Array.isArray(e.detalle.filas)) ? e.detalle.filas : [];
  if (!detalle.length) return false;
  return e.respuesta.some((r) => r && r._entidadesCitadas && r._entidadesCitadas.nombres.some((n) => detalle.some((f) => f.valores && f.valores["Entidad / grupo"] === n && f.valores.Tema === r._entidadesCitadas.tema)));
}
/* ════════════════════════════════════════════════════════════════════════════════════════════════════════════
 * FAMILIA 5 · servirConGarantia — TODA ORACIÓN QUE SE SIRVE PASÓ SU PROPIO VERIFICADOR (consolidación, paso 2)
 * ════════════════════════════════════════════════════════════════════════════════════════════════════════════
 * «Toda oración que compone la Entrega pasa `verificarEntrega`; composer y verificador no se contradicen» (§7.3·48d · 51c) y «una oración que el verificador rechaza se retira de la Entrega y se declara el límite» (§7.3·52e).
 * Hasta acá `componerEntrega` armaba la Entrega y la devolvía sin verificarla; solo `capacidad/acciones.js:consultar` la pasaba por el verificador, y actuaba sobre UNA regla de las diecinueve (la del universo propio). Esta pieza es el ÚLTIMO PASO de
 * `componerEntrega` (el único camino por el que sale una Entrega): corre `verificarEntrega` sobre lo ya armado y gobernado, con la `resolucion` y el índice del turno.
 *   · una violación del invariante del universo propio (regla 18, §7.3·17) NO se sirve: la Entrega se declina entera, como siempre (`ok:false`);
 *   · una violación que apunta a oraciones de la Respuesta (`violacion.oraciones`: índices de `entrega.respuesta`, la ESTRUCTURA, nunca la prosa del detalle) retira esas oraciones —un bloque de simulación, entero— y declara un límite
 *     (la redacción vive en `config/contract/ausencias.js:textoOracionRetirada`); la Entrega se vuelve a pasar por el verificador (una oración retirada puede dejar a otra sin su respaldo) hasta que no quede ninguna;
 *   · lo que el verificador marca de la ESTRUCTURA (sin oración a la que apuntar) queda declarado en `entrega.verificacion.violaciones`, nunca callado.
 * La oración retirada NO viaja en la Entrega (ni en `detalle.oraciones`): `entrega.verificacion = { ok, violaciones, retiradas: [{ regla, hechos }] }` solo dice qué regla la rechazó y qué hechos citaba. */
const _RONDAS_DE_RETIRO = 4;
export function servirConGarantia(salida, resolucion) {
  if (!salida || !salida.ok || !salida.entrega) return salida;
  const profundidad = _profundidadDe(resolucion);
  const titulo = _tituloDeTexto(salida.texto);
  const indice = (salida.entrega.procedencia && salida.entrega.procedencia.libro && salida.entrega.procedencia.libro.indice) || null;
  const auditar = (s) => { try { return verificarEntrega({ texto: s.texto, entrega: s.entrega, resolucion, indice, profundidad }); } catch { return null; } };
  let actual = salida;
  let v = auditar(actual);
  if (!v) return salida;
  if (v.violaciones.some((x) => x.regla === "universo-propio-no-coincide")) return { texto: "", entrega: null, libro: salida.libro, ok: false, motivo: "el invariante del universo propio (§7.3·17) no se sostuvo tras componer la Entrega" };
  const retiradas = [];
  const limitesNuevos = [];
  for (let ronda = 0; ronda < _RONDAS_DE_RETIRO && !v.ok; ronda++) {
    const respuesta = actual.entrega.respuesta || [];
    const idx = new Set();
    const reglaDe = new Map();
    for (const x of v.violaciones) for (const i of x.oraciones || []) if (respuesta[i]) { idx.add(i); if (!reglaDe.has(i)) reglaDe.set(i, x.regla); }
    /* un bloque de simulación se retira ENTERO (un encabezado sin su cuerpo no dice nada: la misma atomicidad que `tamano.js`) */
    for (const i of [...idx]) { const b = respuesta[i]._bloqueId; if (b) respuesta.forEach((r, j) => { if (r && r._bloqueId === b) { idx.add(j); if (!reglaDe.has(j)) reglaDe.set(j, reglaDe.get(i)); } }); }
    if (!idx.size) break;
    const libros = [actual.entrega.procedencia && actual.entrega.procedencia.libro, actual.entrega.procedencia && actual.entrega.procedencia.libroPremisas, actual.entrega.procedencia && actual.entrega.procedencia.libroIniciativa].filter(Boolean);
    /* de quién hablaba la oración: las entidades que la propia oración nombra (las de su cabeza, o las dueñas de los hechos que cita y que su texto dice) */
    const sujetosDe = (r) => { const out = []; const texto = String(r.texto || ""); for (const n of (r._entidadesCitadas && r._entidadesCitadas.nombres) || []) if (n && !out.includes(n)) out.push(n); for (const id of r.hechos || []) for (const L of libros) { const h = L.porId && L.porId.get(id); const ss = h && h.roles && h.roles.sujetos; if (Array.isArray(ss)) for (const s of ss) if (s && s !== "negocio" && texto.includes(String(s)) && !out.includes(s)) out.push(s); } return out; };
    for (const i of [...idx].sort((a, b) => a - b)) {
      const r = respuesta[i];
      retiradas.push({ regla: reglaDe.get(i), hechos: [...(r.hechos || [])] });
      const t = textoOracionRetirada(sujetosDe(r));
      if (!limitesNuevos.some((l) => l.titulo === t)) limitesNuevos.push({ titulo: t, motivo: MOTIVO_ORACION_RETIRADA, _retiradaPorVerificador: true });
    }
    let entrega = { ...actual.entrega, respuesta: respuesta.filter((_, i) => !idx.has(i)) };
    /* lo que sostenía una iniciativa retirada no queda declarado como servido (regla 12), y su marca no queda colgada sin contenido */
    if (entrega.iniciativa && Array.isArray(entrega.iniciativa.ids)) {
      const citados = new Set(); for (const r of entrega.respuesta) if (r.solicitud === "iniciativa") for (const id of r.hechos || []) citados.add(id);
      const enOferta = new Set(entrega.iniciativa.ofertaIds || []);
      entrega = { ...entrega, iniciativa: { ...entrega.iniciativa, ids: entrega.iniciativa.ids.filter((id) => citados.has(id) || enOferta.has(id)) } };
    }
    if (entrega.respuesta.some((r) => r._marcaIniciativa) && !entrega.respuesta.some((r) => r._iniciativa)) entrega = { ...entrega, respuesta: entrega.respuesta.filter((r) => !r._marcaIniciativa) };
    entrega = { ...entrega, limites: [...(salida.entrega.limites || []), ...limitesNuevos] };
    const texto = _textoDeLaEntrega(entrega, titulo, profundidad);
    entrega = { ...entrega, meta: { ...(entrega.meta || {}), palabras: contarPalabras(texto), excedeTope: contarPalabras(texto) > ((entrega.meta && entrega.meta.tope) || Infinity) } };
    actual = { ...actual, texto, entrega };
    v = auditar(actual);
    if (!v) return salida;
  }
  return { ...actual, entrega: { ...actual.entrega, verificacion: { ok: v.ok, violaciones: v.violaciones.map((x) => ({ regla: x.regla, detalle: x.detalle })), retiradas } } };
}
export function componerEntrega(resolucion) {
  let r = _componerEntregaConCabeza(resolucion, 3);
  for (let n = 2; n >= 1 && _cabezaPartida(r); n--) r = _componerEntregaConCabeza(resolucion, n);
  return servirConGarantia(r, resolucion);
}
function _componerEntregaConCabeza(resolucion, nCabezaMax) {
  const canonica = _delegarRutaCanonica(resolucion);
  if (canonica) return _conTamanoGobernado(_conLimitesDeRaiz(canonica, resolucion), resolucion);

  if (!resolucion || !Array.isArray(resolucion.partes)) return _vacia("sin resolución: nada que componer");
  const partesUtiles = resolucion.partes.filter((p) => p.estado === "resuelta" || p.estado === "parcial");
  if (!partesUtiles.length) return _vacia("ningún tema del encargo quedó resuelto ni parcial: nada que componer");

  const scenario = ESCENARIO_INICIAL;
  const { plan, porParte } = lecturasDe(resolucion);
  if (!plan || !plan.calls.length) return _vacia("el encargo no generó ninguna lectura del Core");
  const rp = runPlan(plan, { scenario, maxCalls: Math.max(8, plan.calls.length), preguntaUsuario: null, registry: REGISTRO_LECTURAS });
  const figs = asignarIds((rp.ledger && rp.ledger.figs) || []);
  _rotularCapitalPorFamilia(figs, plan);
  // `defineConcept` (cierre `definicion`) NUNCA trae boleta por contrato (§1.1: prohíbe cifras) — su evidencia
  // vive en `rp.results[].facts.es_definicion`, no en `figs`. Un encargo TODO definiciones queda con `figs.length
  // === 0` legítimamente: no es «sin boleta», es la forma correcta de esa respuesta.
  if (!figs.length && !rp.results.some((r) => r.facts && r.facts.es_definicion)) return _vacia("sin boleta: el motor no produjo cifras para este encargo con los datos activos");

  // UNA PARTE SOLO PUEDE VER SUS PROPIAS FIGS (corrección del supervisor, owner 2026-09-25): `figs` es la boleta
  // MERGE de TODAS las llamadas del encargo — sin recorte, dos partes de temas distintos (ej. comercial + cobranza)
  // pueden tener figs cuyo RÓTULO, ya canonizado por el Notario (`claveDeMetrica`), casa con la MISMA clave aunque
  // vengan de tools distintas: medido con evidencia real — «Jumbo · Venta (flujo)» (de `cobranza`) canoniza HOY a
  // la clave "ventas" (igual que «Jumbo · Ventas», de `entityRecord`) porque `claveDeMetrica` recorta el
  // paréntesis final ANTES de comparar contra los sinónimos, así que nunca llega a probar «venta (flujo)» —el
  // sinónimo exacto que `venta_credito` sí declara— contra su lista. Es un defecto de canonización preexistente
  // del Notario, reportado al supervisor (no parchado acá con un matcher nuevo). La CORRECCIÓN estructural que sí
  // corresponde a este archivo: cada fig ya declara `origin.callId` (el índice de SU llamada, `ledger.js`) y
  // `porParte[parte.id]` (lecturasDe.js) YA sabe qué llamadas sirven a cada parte — se usa esa procedencia real
  // para acotar la búsqueda de cada parte a SUS PROPIAS figs, nunca al pool entero del encargo.
  const _callIdxDeCall = (call) => plan.calls.findIndex((c) => c.tool === call.tool && JSON.stringify(c.args || {}) === JSON.stringify(call.args || {}));
  const _callIdsDePartes = (parteIds) => { const ids = new Set(); for (const pid of parteIds) for (const c of (porParte[pid] || [])) { const idx = _callIdxDeCall(c); if (idx >= 0) ids.add(`c${idx}`); } return ids; };
  const _figsDeParte = (parteId) => { const ids = _callIdsDePartes([parteId]); if (!ids.size) return figs; return figs.filter((f) => f.origin && ids.has(f.origin.callId)); };
  const _figsDePartes = (parteIds) => { const ids = _callIdsDePartes(parteIds); if (!ids.size) return figs; return figs.filter((f) => f.origin && ids.has(f.origin.callId)); };
  /* v21 (§7.3·44c): la FOTO de cobranza son las cuentas que el productor publica en su lista (`facts.clientes`, las de la mesa), no todo lo que otra parte del mismo turno haya ensanchado en la boleta compartida. Los demás dominios publican el eje que sus conceptos sostienen (sin lista propia: null). */
  const _fotoDelProductor = (p) => {
    if (p.tema !== "cobranza") return null;
    const nombres = new Set();
    for (const cid of _callIdsDePartes([p.id])) { const r = rp.results[Number(cid.slice(1))]; const f = r && r.facts; if (f && f.lens === "cobranza" && Array.isArray(f.clientes)) for (const c of f.clientes) if (c && c.nombre) nombres.add(c.nombre); }
    return nombres.size ? nombres : null;
  };
  /* ensayo 4 (owner 2026-10-07): lo que la mesa dice de SU foto, de los mismos hechos de la herramienta — cuántas cuentas tiene la foto en total (las que lista + `masFilas`, las que la mesa tiene y no lista) y por qué cifra se ordena (con plazo declarado, por saldo vencido; sin plazo, por saldo pendiente: `mesaFlujo.js`). null si la herramienta no lo dijo: nunca se supone. */
  const _datosDeLaFoto = (p) => {
    if (p.tema !== "cobranza") return null;
    let total = null, sinPlazo = null;
    for (const cid of _callIdsDePartes([p.id])) { const r = rp.results[Number(cid.slice(1))]; const f = r && r.facts; if (f && f.lens === "cobranza" && Array.isArray(f.clientes) && Number.isInteger(f.masFilas)) { total = Math.max(total || 0, f.clientes.length + f.masFilas); sinPlazo = !!f.sinPlazo; } }
    return total ? { total, ordenPor: sinPlazo ? "saldo pendiente" : "saldo vencido" } : null;
  };

  const consultaDeFrenado = _consultaDeFrenado(resolucion);   // etapa 6: el umbral que planteó quien consulta (o null)
  const { I, ejesDelTenant } = _indiceDelTenant(figs, scenario, consultaDeFrenado);
  const hechos = [];
  const contador = { n: 0 };
  const figsUsadas = [];
  const ref = (fig) => { if (fig) figsUsadas.push(fig); return _declararRef(hechos, contador, fig); };
  // «las tasas no se suman ni se restan» (notario/hechos.js): una diferencia entre dos figs pct/pp exige el op
  // `pp`, nunca `diferencia` — acá se elige por la UNIDAD real de las figs, nunca a ciegas. Unidades incompatibles
  // (money vs. days, por ejemplo) no declaran nada: un delta sin sentido no se inventa (`sinDelta` lo declara).
  const declararDerivada = (figA, idA, figB, idB) => {
    if (idA == null || idB == null) return null;
    const uA = figA && figA.unit, uB = figB && figB.unit;
    const esTasa = (u) => u === "pct" || u === "pp";
    let op = null;
    if (esTasa(uA) && esTasa(uB)) op = "pp"; else if (uA && uA === uB) op = "diferencia";
    if (!op) return null;
    const id = `e${++contador.n}`;
    hechos.push({ id, tipo: "derivada", op, de: [{ id: idA }, { id: idB }] });
    return id;
  };
  const declararRazon = (idNum, idDen) => { if (idNum == null || idDen == null) return null; const id = `e${++contador.n}`; hechos.push({ id, tipo: "razon", num: { id: idNum }, den: { id: idDen }, forma: "pct" }); return id; };

  // §7.3·25 (SUPERVISOR, diagnóstico v10, raíz A1 — 46 fallas, X26/X100) — un hecho de la «tentación
  // precalculada» (mecanismo 6: la diferencia entre el primero y el segundo de un listado, o entre el líder de
  // un dominio y el segundo, que ADI arma DE APOYO para que `verificarEntrega` no marque «tentación no
  // precalculada» — NUNCA lo que el usuario pidió) se declara SOLO si sus dos operandos tienen crudo: un
  // operando reconstruido desde el texto mostrado (`evidencia.js`, `fig.crudo === false`, memoria
  // `adi-verificado-no-es-exacto`) no sostiene una resta. Antes se declaraba igual, `libroDeHechos` la marcaba
  // «no-verificable» (sin-crudo) y el chequeo de `rotos` (más abajo) tumbaba la Entrega ENTERA por una
  // comparación que nadie pidió — el candado que ya existía en cada sitio (`if (figA0 && figB0)`) cubría la fig
  // INEXISTENTE, nunca la fig SIN CRUDO. `idsTentacionOpcional` guarda los ids que SÍ se declararon por esta vía
  // (defensa en profundidad, capa 2): si de todas formas no verifican por otra causa, `rotos` los deja pasar sin
  // tumbar la Entrega, porque ninguno de estos ids se cita en ningún texto servido (son solo el insumo que
  // `verificarEntrega` exige ver en el libro). Esta guardia NUNCA se usa en `_planComparacion` (la comparación
  // que el usuario pidió) ni en la simulación base↔resultado: esas son lo pedido, no un apoyo, y si no
  // verifican la Entrega declina como corresponde.
  const idsTentacionOpcional = new Set();
  const declararDerivadaOpcional = (figA, idA, figB, idB) => {
    if ((figA && figA.crudo === false) || (figB && figB.crudo === false)) return null;
    const id = declararDerivada(figA, idA, figB, idB);
    if (id != null) idsTentacionOpcional.add(id);
    return id;
  };

  /* EL TOTAL DEL LISTADO (owner 2026-10-05, ensayo 2 — «un top-N que no declara su cola miente por omisión»; el anfitrión dijo «la venta total ronda $195M» sobre 13 cifras entregadas que suman $176.0M).
   * Cuando la Entrega sirve un LISTADO COMPLETO —sin `top`, sin universo acotado, TODAS las cuentas del eje— de una métrica ADITIVA (dinero o unidades), el libro declara UNA suma por métrica: la SUMA EXACTA de las
   * filas servidas (los mismos hechos de la tabla, nunca el total del Core ni otra fuente: reconciliada por construcción). NO se imprime: el texto de la Entrega no cambia (se registra en `entrega.cifras.totales`,
   * que no es parte de la tabla); viaja en el libro de la conversación (`E<n>.h<k>`) y en la respuesta compacta. Una métrica no aditiva (margen, %, días, razones), un listado parcial (top-N, la foto de la mesa cuando no lista todo el eje, universo acotado, un subconjunto nombrado)
   * o una cuenta sin cifra: ahí no corresponde y no se declara. Ensayo 4 (owner 2026-10-07): viaja con TODO listado completo, sea cual sea su cierre (cifra · lectura · decision) y se haya pedido por el eje, como la foto de un eje entero o NOMBRANDO a todas sus entidades. Opcional como la tentación precalculada: si no verifica, no tumba la Entrega (ningún texto lo cita). */
  const declararTotalDelListado = (plan) => {
    const u = plan && plan.universoDecl;
    if (!plan || plan.kind !== "grupo" || !u || u.top || u.base || u.estados || u.no_estados || u.filtros || u.bodega || u.union || (u.excluir && u.excluir.length)) return [];
    const miembrosDelEje = ejesDelTenant && Array.isArray(ejesDelTenant[plan.eje]) ? ejesDelTenant[plan.eje].length : 0;
    if (plan.orden.length < 2 || plan.orden.length !== miembrosDelEje) return [];   /* ensayo 4: una FOTO que lista TODO el eje también es un listado completo — decide el tamaño de lo servido contra el del eje, no el nombre del camino */
    return _totalesDeFilas(plan.orden.map((e) => _mapaDe(plan.porEntidad, e)));
  };
  /* ensayo 4 (owner 2026-10-07): el total viaja con CADA listado completo, sea cual sea el cierre (cifra · lectura · decision) y se haya pedido por el eje o NOMBRANDO a todas sus entidades.
   * `filas` = un Map clave → id por cada entidad servida. */
  function _totalesDeFilas(filas) {
    const claves = [];
    for (const mp of filas) for (const k of mp.keys()) if (!claves.includes(k)) claves.push(k);
    const out = [];
    for (const clave of claves) {
      const m = metricaPorClave(clave);
      if (!m || m.referencia || m.negocio || (m.unidad !== "money" && m.unidad !== "count")) continue;
      const ids = filas.map((mp) => mp.get(clave));
      if (ids.some((x) => x == null)) continue;                                  // una cuenta sin cifra: la suma no sería la de lo servido
      const figsDeLasFilas = ids.map((id) => { const h = hechos.find((x) => x.id === id); return h && h.tipo === "ref" ? figs.find((f) => f && f.id === h.de) : null; });
      if (figsDeLasFilas.some((f) => !f || f.crudo === false || !Number.isFinite(f.raw))) continue;   // la cifra de la proyección o sin valor exacto: no hay suma exacta
      const id = _declararSuma(hechos, contador, ids);
      if (id == null) continue;
      idsTentacionOpcional.add(id);
      out.push({ id, clave, n: ids.length });
    }
    return out;
  }
  /* el listado pedido NOMBRANDO a las entidades (`kind:"entidad"`): es completo solo si lo nombrado ES todo el eje (mismo eje, ni una de más ni una de menos); un subconjunto nombrado nunca lleva total */
  const declararTotalDeNombradas = (plan, eje) => {
    if (!plan || plan.kind !== "entidad" || !Array.isArray(plan.filasPorEntidad) || plan.filasPorEntidad.length < 2) return [];
    const miembros = ejesDelTenant && Array.isArray(ejesDelTenant[eje]) ? ejesDelTenant[eje] : [];
    const nombradas = plan.filasPorEntidad.map((x) => normalizar(x.entidad));
    if (!miembros.length || nombradas.length !== miembros.length || new Set(nombradas).size !== nombradas.length) return [];
    const delEje = new Set(miembros.map((m) => normalizar(m)));
    if (!nombradas.every((n) => delEje.has(n))) return [];
    return _totalesDeFilas(plan.filasPorEntidad.map((x) => new Map((x.filas || []).filter((f) => f.clave && f.id != null).map((f) => [f.clave, f.id]))));
  };

  // ── FASE 1 · declarar (por parte, según cierre) — nunca leer `preguntaOriginal` ──
  const planes = [];
  const limitesGap = [];
  const numerosDeLimitesGap = [];   /* v23: los números que un límite de la foto imprime («3 de 8 cuentas») son cifras de la Entrega: se declaran como impresas al armar el render */
  /* «FRENADO» SIN UMBRAL (owner 2026-09-29, cierre del inventario: «sin umbral de frenado, ADI entrega los días sin venta de cada
   * SKU, ordenados, y declara que falta el criterio»): el universo «frenado» no se puede juzgar —el VEREDICTO queda «sin
   * evaluar»—, pero el HECHO sí se entrega: los días sin venta de TODOS los SKU (la lectura `inventoryStatus{focus:
   * "dias_sin_venta"}`, la MISMA fuente que la vista «Días sin venta» de la cara Capital), de más a menos, tipados como hecho
   * histórico. Se compone con el MISMO mecanismo de un listado por eje (`_planCifraGrupo`, sin `top`, sin estados): nunca una
   * lista de «frenados», nunca «no hay frenados». Su universo se declara con id PROPIO (no es el universo «frenado» de la
   * parte, que no se resuelve) para que la regla 18 de `verificarEntrega` no lo confunda con él. Sin cifras que servir,
   * queda solo el límite. */
  const _planDiasSinVentaDeFrenado = (p) => {
    if (!_frenadoSinUmbral(p.universo, resolucion)) return null;
    const pDias = { ...p, cierre: "lectura", eje: "sku", conceptos: ["dias_sin_venta"], entidades: [], universo: _acoteDeBodega(p.universo) };   // §7.3·45(c): la bodega pedida acota el hecho
    const plan = _planCifraGrupo(pDias, _figsDeParte(p.id), { ejesDelTenant, indice: I, direccionSinTop: "mayor" });
    if (!plan || plan.error || !plan.orden.length) return null;
    for (const e of plan.orden) for (const [clave, fig] of _mapaDe(plan.porEntidad, e)) _mapaDe(plan.porEntidad, e).set(clave, ref(fig));
    plan.idUniverso = `${p.id}_dias_sin_venta`;
    return plan;
  };
  const _declinarUniverso = (p, motivo) => {
    const plan = _planDiasSinVentaDeFrenado(p);
    limitesGap.push(_limiteDeUniverso(p, motivo, resolucion, !!plan));
    /* FAMILIA 5 (segunda vuelta): el motivo del Notario puede decir cuántas entidades trae un ranking («solo trae a 4 del eje»): ese número lo imprime la Entrega en el límite, así que es una cifra impresa declarada, no una cifra desnuda */
    numerosDeLimitesGap.push(...(String(motivo || "").match(/\d+(?:[.,]\d+)?/g) || []));
    if (plan) { planes.push(plan); limitesGap.push({ _faltantesDe: plan }); }
  };
  const _limiteUniversoNoSoportado = (p) => ({ titulo: `Sobre la parte ${p.id} (${_DOM_NOMBRE[p.tema] || p.tema}), el filtro del universo no se aplica todavía en este corte`, motivo: "Filtrar por estado o por un umbral numérico exige evaluar cada entidad contra el dato real; ese motor no está construido en este corte (queda señalado para el corte 3c). Se declina esta parte en vez de servir un listado sin filtrar o adivinar el criterio." });
  // §7.3·27 (SUPERVISOR, corrige la 26b según la ley del owner de la prioridad integrada — X28) — «si en el mismo
  // eje uno de los dominios resuelve vacío, no hay nada que cruzar»: el tamaño YA VERIFICADO del universo de cada
  // parte con universo propio (el mismo número que su propia «K de M»/fila de Cifras), para que la cruzada de más
  // abajo pueda saber, SIN recalcular nada, si alguna de las partes de un grupo cruzable resolvió vacía.
  const tamanoUniversoPorParte = new Map();

  const partesLecturaDecisionSinEntidad = partesUtiles.filter((p) => ["lectura", "decision"].includes(p.cierre) && !(p.entidades && p.entidades.length));
  // CORTE 3c · pieza 1 (owner 2026-09-25): el universo-por-estado SIN `top` (D14/D19) se compone con los
  // conjuntos que el Core ya calcula (`_cerrarGrupoUniverso`, kind `grupoUniverso`).
  const partesUniversoPorEstado = partesLecturaDecisionSinEntidad.filter((p) => _universoPorEstadoSinTop(p.universo));
  for (const p of partesUniversoPorEstado) {
    const r = _cerrarGrupoUniverso(p, _figsDeParte(p.id), I, hechos, contador, ref, declararRazon, declararDerivadaOpcional, resolucion.criterio);
    if (r.error) { _declinarUniverso(p, r.error); continue; }
    planes.push(r);
    limitesGap.push({ _faltantesDe: r });   /* FAMILIA 2: lo que falta se declara al armar los límites */
    tamanoUniversoPorParte.set(p.id, (r.miembros || []).length);   // §7.3·27
  }
  // §7.3·17 (supervisor 2026-09-27, diagnóstico v8, raíz A2 — LA RAÍZ MÁS PELIGROSA: antes, esta parte servía
  // `ok:true` con el contenido de OTRA pregunta, sin avisar) — una parte con universo PROPIO (`top`, `base`,
  // `bodega`, `union`, o `estados`/`no_estados`/`filtros` COMBINADOS con `top`) se compone con el MISMO mecanismo
  // que ya usa `cifra` (`_planCifraGrupo`): primero el conjunto verificado contra `conjuntoDeUniverso` —la MISMA
  // resolución que usa el Notario, vía `_entidadesDelTopVerificado`—, después las cifras de lo pedido, ordenadas
  // por la métrica que la propia parte declaró (`top.metrica` o el primer concepto). Antes, CUALQUIER
  // lectura/decision sin entidades (salvo el caso estrecho de estados/filtros sin top) caía siempre a
  // `_planMultiTema`, que ordena por la LENTE DE NEGOCIO del dominio (materialidad/severidad/urgencia) — nunca
  // por lo que la parte pidió.
  // §7.3·22 (supervisor 2026-09-27, diagnóstico v9, precisa la 17 — RAÍZ A1, 100 fallas) — el límite anterior
  // (`.length === 1`) confundía «MULTIDOMINIO con varias partes» con «UN MISMO dominio con varias partes
  // lectura/decision»: un grupo con DOS O MÁS partes de un MISMO tema (ej. W01: p1 lectura + p2 decision, las
  // dos de cobranza, cada una con su propio `top`) caía entero a `_planMultiTema`, que solo sabe declarar UN
  // líder por dominio — perdía el universo propio de la SEGUNDA parte en silencio (cambio silencioso, CLAUDE.md
  // §5). Ahora TODA parte lectura/decision con universo propio compone por `_planCifraGrupo`, sea cual sea el
  // número de partes o de dominios del grupo — nunca solo cuando es la única candidata. El camino V81
  // (MULTIDOMINIO real, 2+ temas DISTINTOS, cada uno con una única parte) sigue funcionando: más abajo, la
  // prioridad CRUZADA entre esos dominios se AGREGA aparte, sobre la unión de estos mismos universos —
  // `_planMultiTema` deja de ser la fuente de CONTENIDO de estas partes y pasa a ser SOLO su agregador cruzado.
  const _candidatasSinEstadoSinTop = partesLecturaDecisionSinEntidad.filter((p) => !_universoPorEstadoSinTop(p.universo));
  const partesUniversoPropio = _candidatasSinEstadoSinTop.filter((p) => _tieneUniversoPropio(p.universo));
  for (const p of partesUniversoPropio) {
    // el mismo fallback de conceptos que ya usa RC8 más abajo (línea ~2570): sin `conceptos` declarados y sin
    // `top.metrica` que aporte uno, se listan todos los del tema con productor en este eje — nunca un concepto
    // inventado ni una segunda tabla.
    let pParaGrupo = p;
    if (!(p.conceptos && p.conceptos.length) && !(p.universo && p.universo.top && p.universo.top.metrica)) {
      const metricasDelTema = (dominioPorId(p.tema) && dominioPorId(p.tema).metricas) || [];
      const conceptosConProductor = metricasDelTema.filter((c) => productorDe(c, p.eje));
      if (conceptosConProductor.length) pParaGrupo = { ...p, conceptos: conceptosConProductor };
    }
    const plan = _planCifraGrupo(pParaGrupo, _figsDeParte(p.id), { ejesDelTenant, indice: I, criterio: resolucion.criterio });
    if (!plan || plan.error) {
      // INVARIANTE QUE FALLA CERRADO (§7.3·17): sin evidencia para el universo declarado, la parte se declina
      // con un límite — nunca se sirve otra respuesta (la lente de negocio del dominio) en su lugar.
      // RAÍZ A (supervisor 2026-09-29) — `plan.error` (distinto de `null`) trae el motivo REAL de por qué el
      // universo declarado no se pudo resolver (p. ej. un umbral de «frenado» que la empresa no declaró) — se
      // declara ESE motivo, el mismo criterio y el mismo título que ya usa el camino hermano de `_cerrarGrupoUniverso`
      // para el mismo tipo de falla (universo por estado SIN `top`, más arriba en este archivo).
      if (plan && plan.error) {
        _declinarUniverso(p, plan.error);
      } else {
        limitesGap.push({ titulo: `Sobre la parte ${p.id} (${_DOM_NOMBRE[p.tema] || p.tema}), el universo declarado no encontró evidencia en la boleta`, motivo: "El conjunto se resolvió, pero ninguna fig de este turno trae las cifras pedidas para esas entidades — se declina en vez de servir con otro alcance." });
      }
      continue;
    }
    // tentación precalculada (mecanismo 6) + declaración de las figs: mismo patrón que `cifra`/RC8, más abajo.
    const figA0 = plan.orden.length > 1 ? _mapaDe(plan.porEntidad, plan.orden[0]).get(plan.claveOrden) : null;
    const figB0 = plan.orden.length > 1 ? _mapaDe(plan.porEntidad, plan.orden[1]).get(plan.claveOrden) : null;
    for (const e of plan.orden) for (const [clave, fig] of _mapaDe(plan.porEntidad, e)) _mapaDe(plan.porEntidad, e).set(clave, ref(fig));
    if (figA0 && figB0) plan.idDiffOrden = declararDerivadaOpcional(figA0, _mapaDe(plan.porEntidad, plan.orden[0]).get(plan.claveOrden), figB0, _mapaDe(plan.porEntidad, plan.orden[1]).get(plan.claveOrden));
    _declararLenteDelGrupo(plan.lenteGrupo, ref, plan.porEntidad);   /* v23 */
    planes.push(plan);
    limitesGap.push({ _faltantesDe: plan });   /* FAMILIA 2 */
    tamanoUniversoPorParte.set(p.id, (plan.orden || []).length);   // §7.3·27
  }
  const partesSinEntidadLecturaDecision = _candidatasSinEstadoSinTop.filter((p) => !partesUniversoPropio.includes(p));
  const partesYaAgrupadas = new Set([...partesSinEntidadLecturaDecision, ...partesUniversoPropio, ...partesUniversoPorEstado].map((p) => p.id));
  if (partesSinEntidadLecturaDecision.length) {
    /* CONSOLIDACIÓN, SEGUNDA VUELTA (el eje es de la parte · §7.3·51e): el plan del TEMA (`_planMultiTema`: quién más pesa, la prioridad del procedimiento) es el del eje por defecto del dominio —los SKU en inventario, las
     * cuentas en comercial y cobranza—. Una parte con EJE EXPLÍCITO (una lectura de inventario por BODEGA) NO entra a él: su prioridad es la de su propio grupo (`_planCifraGrupo`, más abajo). Antes entraba, y la Entrega
     * servía «quien más pesa es LG-DRYER8KG» (un SKU) y «por riesgo integrado: LG-DRYER8KG» sobre un grupo de bodegas. */
    const _ejeExplicitoDeParte = (p) => !!(p.eje && p.eje !== sujetoDeTema(p.tema));
    const partesDelPlanDelTema = partesSinEntidadLecturaDecision.filter((p) => !_ejeExplicitoDeParte(p));
    const temas = [...new Set(partesDelPlanDelTema.map((p) => p.tema))];
    const conDecision = partesDelPlanDelTema.some((p) => p.cierre === "decision");
    // R2 (diagnóstico v2, supervisor 2026-09-26 — MATERIAL: la entidad EXCLUIDA por el usuario volvía como
    // protagonista) — `universo.excluir` es un alcance declarado POR PARTE; se acota ANTES de fusionar (cada
    // parte puede excluir algo distinto) con la MISMA pieza central que usa el resto de este corte
    // (`alcanceDeParte`/`figsEnAlcance`, `entrega/alcance.js`) — nunca una segunda lectura de `universo.excluir`.
    // SOLO se filtra por ENTIDAD EXCLUIDA acá, nunca por eje (`eje: null` apaga esa mitad de `figsEnAlcance`): este
    // grupo mezcla lectura/decision de eje POR DEFECTO (`ParteResuelta.eje` siempre trae el sujeto del tema aunque
    // el usuario no haya escrito uno — contrato §4d) con la «foto completa» de inventario, que el contrato de
    // dominios sirve A PROPÓSITO en dos formas (SKU + subtotal por bodega, `contratoDeDominios.js`) — filtrar por
    // eje acá borraría esa foto completa. El filtro por eje (RC-F) es de `_planCifraGrupo`, donde el eje SÍ es la
    // dimensión que la llamada al Core pidió explícitamente.
    // R-INICIATIVA-UNIVERSO-NO-ENTIDADES / V81 (diagnóstico v6, ALTA, cerrado del todo — coordinador 2026-09-26) —
    // una `decision`/`lectura` SIN entidades (1..N temas → `_planMultiTema`) tiene que restringirse por el `top`
    // de su propia parte — una `decision` de «los 3 clientes de menor venta» no puede seguir calculando «quien
    // más pesa» sobre los 13, nombrando a Falabella/Lider (el extremo opuesto exacto de lo pedido). El primer
    // intento de este arreglo (revertido) dejaba la Entrega SIN evidencia porque `cobranza()` recortaba su
    // boleta a un TOP 8 por deuda — nunca traía a Unimarc/ABC/Hites (las 3 de MENOR venta) para empezar; ESE
    // hueco se cerró en `lecturasDe.js` (`universoRequerido` en la llamada de cobranza de este mismo grupo).
    // CIERRE A1b (diagnóstico v7, contrato §7.3·8) — `top` YA NO se resuelve acá aparte: `figsEnAlcance`
    // (`entrega/alcance.js`) recorta por `top` combinado con `base`/`estados`/`no_estados`/`filtros` EN LA MISMA
    // llamada a `conjuntoDeUniverso` que ya usa el Notario, respetando `top.sobre` en los dos sentidos — un
    // segundo filtro acá (antes: siempre «top sobre el eje entero», ignorando `estados`/`filtros` y el sentido
    // por defecto) deshacía en silencio el sentido «top dentro del filtro». Sin `indice` o si el universo no se
    // puede resolver, `figsEnAlcance` no restringe — mismo criterio de «nunca excluir a ciegas» de siempre.
    const figsDelGrupo = partesDelPlanDelTema.flatMap((p) => figsEnAlcance(_figsDeParte(p.id), { ...alcanceDeParte(p), eje: null }, { indice: I }));
    const plan = partesDelPlanDelTema.length ? _planMultiTema(temas, figsDelGrupo, ref, declararRazon, declararDerivadaOpcional, { conDecision, lente: lenteIdDelCriterio(resolucion.criterio), temasDeDecision: [...new Set(partesDelPlanDelTema.filter((p) => p.cierre === "decision").map((p) => p.tema))], ctx: { indice: I, ejesDelTenant } }) : null;   /* 55(b): el nombre de la lente es de la PARTE que decide, no del encargo · 56/57: el contexto para completar la variación de cada cuenta con la proyección */
    if (plan) { plan.partesIds = partesDelPlanDelTema.map((p) => p.id); planes.push(plan); }
    /* §7.3·57(b): a quien el dato no trae la variación vs año anterior se le declara «sin dato de X para Y» (52b) en ESTE camino: con conceptos, la foto de la parte ya lo declara; sin conceptos (la prioridad del tema sola), lo declara el plan */
    if (plan && plan.faltantesLente && plan.faltantesLente.length && !partesDelPlanDelTema.some((p) => p.conceptos && p.conceptos.length)) { const _pL = partesDelPlanDelTema.find((p) => p.tema === "comercial") || partesDelPlanDelTema[0]; limitesGap.push({ _faltantesDe: { _servido: true, parteId: _pL.id, tema: _pL.tema, eje: sujetoDeTema(_pL.tema), faltantes: plan.faltantesLente, sinCifra: [], orden: [], miembros: [] } }); }
    /* v20 (U06 · U42, §7.3·13 «la lectura TRAE el ranking completo del eje que la parte nombra»): el listado por el eje EXPLÍCITO (RC8, abajo) solo corría cuando `_planMultiTema` no armaba nada. Una lectura de inventario con eje `bodega` SIEMPRE
     * arma plan (la foto por SKU), así que el eje que la parte pidió se ignoraba en silencio: el ranking de las cuatro bodegas ni se servía. El plan del tema conserva su lugar (la foto del procedimiento) y el eje pedido se SIRVE además, por el mismo
     * camino «grupo por eje» de `cifra`; sin plan del tema, todo sigue igual que antes (fallback y «no se pudo componer»). */
    /* v23 (R18, §7.3·46e): un concepto que la parte DECLARA y que la lectura del turno no publicó para alguna cuenta de la foto no se omite en silencio, sea cual sea el eje de la foto (el del tema o uno explícito): se declara qué cuentas quedan sin esa cifra (nunca se rellena con otra). Una sola definición para los dos caminos. */
    const _declararCifraFaltanteDeFoto = (p, planF) => { planF._formaFoto = true; limitesGap.push({ _faltantesDe: planF }); };   /* FAMILIA 2: el concepto que falta a una cuenta de la foto lo declara `servidas.js` (la misma forma de siempre, «la foto no trae X de A, B (n de N cuentas)») DESPUÉS de saber qué se imprime */
    {
      const hayPlanDelGrupo = !!plan;
      // RC8 (owner, diagnostico.md §RC8, punto 2 — «LA GRIETA DE UN SOLO TEMA CON EJE EXPLÍCITO», documentada en
      // lecturasDe.js:230-239 y cerrada solo a medias): `_planMultiTema` está pensado para "cartera entera con
      // el sujeto por defecto" — con un solo tema y un eje EXPLÍCITO (ej. "el margen por marca") no arma nada, y
      // sin este fallback la parte caía sin plan NI límite: "ninguna parte del encargo produjo evidencia
      // suficiente para componer la Entrega". Mismo camino "grupo por eje" que `cifra` YA usa (`_planCifraGrupo`,
      // más abajo): un listado por el eje pedido, por cada parte del grupo con un eje explícito propio (distinto
      // del sujeto por defecto del tema) — nunca se inventa un eje que la parte no declaró.
      let huboFallback = false;
      const servidasPorEjeExplicito = new Set(), declaradasSinDato = new Set();
      for (const p of partesSinEntidadLecturaDecision) {
        if (!(p.eje && p.eje !== sujetoDeTema(p.tema))) continue;
        // `_planCifraGrupo` solo lista `parte.conceptos` (los VALIDADOS, §1: vacío = "lo que el procedimiento del
        // tema sirva" — el mismo contrato que ya resolvió el punto 1 de RC8 en `lecturasDe.js`). Sin conceptos
        // declarados se usa el MISMO criterio ahí (todos los del tema con productor en este eje), nunca una
        // segunda tabla ni un concepto inventado.
        let pParaGrupo = p;
        if (!(p.conceptos && p.conceptos.length)) {
          const metricasDelTema = (dominioPorId(p.tema) && dominioPorId(p.tema).metricas) || [];
          const conceptosConProductor = metricasDelTema.filter((c) => productorDe(c, p.eje));
          if (!conceptosConProductor.length) continue;
          pParaGrupo = { ...p, conceptos: conceptosConProductor };
        }
        const planG = _planCifraGrupo(pParaGrupo, _figsDeParte(p.id), { ejesDelTenant, indice: I, criterio: resolucion.criterio, foto: true, deMayorAMenor: true });   /* segunda vuelta: la foto por un eje explícito se exhibe como la del eje por defecto (§7.3·44c · 50a): de MAYOR a menor, aunque el concepto sea de los que «más es peor» (un capital inmovilizado crítico que lista primero los ceros esconde al que pesa) */
        // RAÍZ A (supervisor 2026-09-29) — `plan.error` (universo declarado no-resoluble) se trata igual que
        // `null` en este fallback: mismo comportamiento de siempre (la parte no entra a este camino, cae más
        // abajo a su propio «no se pudo componer»), solo que ahora nunca se le pasa un objeto `{error}` a código
        // que espera un plan con `.orden`.
        if (!planG || planG.error) continue;
        // R-COBRANZA-TOP8-SIN-COLA-MENOR (diagnóstico v6, defensa en profundidad, ALTA): «una Entrega nunca
        // revienta» — una entidad de `orden` puede quedar sin NINGÚN concepto en `porEntidad` (ninguna fig
        // publicada para ella en toda la parte), y `.get(entidad)` devuelve `undefined`. Antes, el `.get()`
        // siguiente tumbaba TODA la función con una excepción no capturada — se perdía la Entrega ENTERA por una
        // sola cuenta sin dato, en vez de perder solo la tentación precalculada (mecanismo 6, opcional) de esa
        // fila. `_mapaDe` (guarda de archivo, A2) nunca inventa una fig: solo evita el `.get()` sobre `undefined`.
        const figA0 = planG.orden.length > 1 ? _mapaDe(planG.porEntidad, planG.orden[0]).get(planG.claveOrden) : null;
        const figB0 = planG.orden.length > 1 ? _mapaDe(planG.porEntidad, planG.orden[1]).get(planG.claveOrden) : null;
        for (const e of planG.orden) for (const [clave, fig] of _mapaDe(planG.porEntidad, e)) _mapaDe(planG.porEntidad, e).set(clave, ref(fig));
        if (figA0 && figB0) planG.idDiffOrden = declararDerivadaOpcional(figA0, _mapaDe(planG.porEntidad, planG.orden[0]).get(planG.claveOrden), figB0, _mapaDe(planG.porEntidad, planG.orden[1]).get(planG.claveOrden));
        /* v23 (R18): el eje explícito es la foto del productor (sujeto distinto del tema): declara la cifra pedida que a alguna cuenta le falta, como en cliente y sku*/
        _declararCifraFaltanteDeFoto(p, planG, p.eje);
        _declararLenteDelGrupo(planG.lenteGrupo, ref, planG.porEntidad);   /* v23 */
        { const _tt = declararTotalDelListado(planG); if (_tt.length) planG.totalesDelListado = _tt; }   /* ensayo 4: el total viaja con CADA listado completo, también el de una lectura/decision por un eje explícito */
        planes.push(planG);
        partesYaAgrupadas.add(p.id);
        huboFallback = true;
        servidasPorEjeExplicito.add(p.id);
      }
      /* v21 (T15–T19 · T28 · T40 · T99, §7.3·44c, decisión del supervisor): una `lectura`/`decision` SIN universo ni entidades sirve su FOTO completa —el universo que el PRODUCTOR publica (cobranza: las cuentas de su mesa; inventario y comercial: el eje que sus conceptos sostienen), con su orden— y la prioridad del procedimiento ENCIMA (el plan del tema, arriba). Antes servía solo al líder y a su rival (2 o 3 entidades) y el Entrega hablaba del «conjunto» y de «toda la cartera» sin mostrarlo: declaraba una foto mayor que la servida. El universo se declara con el id de la parte (lo servido ES lo declarado); el eje explícito ya lo sirvió el fallback de arriba. */
      let huboFoto = false;
      for (const p of partesSinEntidadLecturaDecision) {
        if (p.eje && p.eje !== sujetoDeTema(p.tema)) continue;
        /* la foto se sirve con los conceptos que la parte DECLARA; una parte sin conceptos (el «lo que el procedimiento del tema sirva» del contrato §1) sirve la prioridad del procedimiento, el plan del tema de arriba: listar cada cuenta con todas las métricas del dominio no es lo pedido y pasaba el tope de tamaño (`_iniciativa_gate`: lo pedido byte-idéntico con la iniciativa encendida o apagada) */
        if (!(p.conceptos && p.conceptos.length)) continue;
        const planF = _planCifraGrupo(p, _figsDeParte(p.id), { ejesDelTenant, indice: I, deMayorAMenor: true, soloEntidades: _fotoDelProductor(p), foto: true });
        if (!planF || planF.error || !planF.orden.length) continue;
        const figA0F = planF.orden.length > 1 ? _mapaDe(planF.porEntidad, planF.orden[0]).get(planF.claveOrden) : null;
        const figB0F = planF.orden.length > 1 ? _mapaDe(planF.porEntidad, planF.orden[1]).get(planF.claveOrden) : null;
        for (const e of planF.orden) for (const [clave, fig] of _mapaDe(planF.porEntidad, e)) _mapaDe(planF.porEntidad, e).set(clave, ref(fig));
        if (figA0F && figB0F) planF.idDiffOrden = declararDerivadaOpcional(figA0F, _mapaDe(planF.porEntidad, planF.orden[0]).get(planF.claveOrden), figB0F, _mapaDe(planF.porEntidad, planF.orden[1]).get(planF.claveOrden));
        planF.esFoto = true; planF.idUniverso = p.id; planF.fotoDatos = _datosDeLaFoto(p);
        /* v22 (S31): un concepto que la parte DECLARA y que la lectura del turno no publicó para alguna cuenta de la foto no se omite en silencio: se declara qué cuentas quedan sin esa cifra (nunca se rellena con otra). */
        _declararCifraFaltanteDeFoto(p, planF, sujetoDeTema(p.tema));
        { const _tt = declararTotalDelListado(planF); if (_tt.length) planF.totalesDelListado = _tt; }   /* ensayo 4: una foto que lista TODO el eje es un listado completo y lleva su total; la que lista menos (la mesa de cobranza de 8) no */
        planes.push(planF);
        huboFoto = true;
      }
      /* CONSOLIDACIÓN, SEGUNDA VUELTA: una parte con EJE EXPLÍCITO ya no entra al plan del tema (que servía a otro eje). Si su propio grupo tampoco se pudo armar —ninguna lectura trajo cifra de lo que pide por ese eje—, no queda callada ni sale una Entrega vacía: se declara con la forma de siempre («sin dato de X para A, B», §7.3·52b), para cada miembro del eje. */
      for (const p of partesSinEntidadLecturaDecision) {
        if (!_ejeExplicitoDeParte(p) || servidasPorEjeExplicito.has(p.id) || !(p.conceptos && p.conceptos.length)) continue;
        const miembros = ejesDelTenant && Array.isArray(ejesDelTenant[p.eje]) ? ejesDelTenant[p.eje] : [];
        if (!miembros.length) continue;
        const faltantes = []; for (const c of p.conceptos) for (const m of miembros) faltantes.push({ entidad: m, clave: c });
        limitesGap.push({ _faltantesDe: { _servido: true, parteId: p.id, tema: p.tema, eje: p.eje, faltantes, sinCifra: [], orden: [], miembros: [] } });
        declaradasSinDato.add(p.id);
      }
      if (!huboFallback && !huboFoto && !hayPlanDelGrupo) for (const p of partesSinEntidadLecturaDecision) { if (!declaradasSinDato.has(p.id)) partesYaAgrupadas.delete(p.id); }   // sin evidencia suficiente: cada parte cae en su propio "no se pudo componer" abajo
    }
  }
  // §7.3·22 (supervisor 2026-09-27, diagnóstico v9) — la prioridad CRUZADA entre dominios se AGREGA aparte,
  // nunca reemplaza el contenido de cada parte (ya servido arriba por `_planCifraGrupo`). Solo aplica cuando el
  // grupo de partes con universo propio abarca 2+ TEMAS DISTINTOS — un cruce real de dominios (el caso V81: una
  // parte comercial + una de cobranza, cada una con su propio `top`), nunca el mismo dominio repartido en varias
  // partes (eso ya lo cierra `_planCifraGrupo` arriba, por parte, sin agregador). La unión de figs es la MISMA
  // fórmula `figsEnAlcance`/`alcanceDeParte` que ya usaba V81 antes de esta corrección — cada parte acotada a SU
  // propio alcance, nunca al pool entero del grupo.
  // §7.3·24 (SUPERVISOR, diagnóstico v10, precisa la 22 — RAÍZ A2b, 7 fallas directas, X38) — solo las `decision`
  // con universo propio participan de la cruzada; una `lectura` no tiene sentido en una PRIORIDAD («qué atender
  // primero» no es una pregunta que se le haga a un listado informativo — el propio SELLO nunca incluye una
  // `lectura` en `esperado.prioridadCruzada.partes`). Antes, `partesUniversoPropio` (arriba, §7.3·17) mezclaba
  // `lectura`+`decision` sin distinguir el cierre Y EXCLUÍA a las `decision` cuyo universo es SOLO estados (sin
  // `top`, `partesUniversoPorEstado` arriba: esas se cierran por `_cerrarGrupoUniverso`, un camino aparte que
  // nunca alimentaba este agregador) — un grupo de partes completamente distinto al que el SELLO mide (X38:
  // colaba dos `lectura` y dejaba afuera la única `decision` de inventario). `partesParaCruzada` corrige las dos
  // cosas: solo `decision`, de CUALQUIERA de los dos caminos que declaran universo propio.
  const partesParaCruzada = [...partesUniversoPropio, ...partesUniversoPorEstado].filter((p) => p.cierre === "decision");
  const temasUniversoPropio = [...new Set(partesParaCruzada.map((p) => p.tema))];
  if (temasUniversoPropio.length >= 2) {
    // §7.3·24 (RAÍZ A2a) precisada por §7.3·26 (SUPERVISOR, catálogo v11, encargo del coordinador 2026-09-27) —
    // la cruzada se cruza en la CLAVE REAL compartida (ley de la prioridad integrada: señal por señal en el
    // cliente; los SKU van aparte — y también comparten clave real entre sí, decisión 26b). Con una FORMA MIXTA
    // (2+ ejes en el mismo grupo de partes con universo propio), cada EJE que reúna 2+ TEMAS distintos cruza por
    // su cuenta (un ganador en la unión de SUS universos); las decisions cuyo eje queda solo (ningún otro tema lo
    // comparte) NO entran en ninguna cruzada — se declara que quedan fuera, cada una con su propia prioridad ya
    // servida arriba (`_planCifraGrupo`/`_cerrarGrupoUniverso`). Si NINGÚN eje reúne 2+ temas (el caso puro de la
    // decisión 24: ejes todos distintos, uno por tema), no hay ninguna clave compartida en absoluto y se declara
    // el límite general. La elegibilidad depende de los EJES PEDIDOS, nunca del resultado en tiempo real (26c):
    // agrupar por `p.eje` ANTES de mirar si algún universo resolvió vacío o se declinó.
    const gruposPorEje = new Map();
    for (const p of partesParaCruzada) {
      const eje = normalizar(p.eje || sujetoDeTema(p.tema) || "");
      if (!gruposPorEje.has(eje)) gruposPorEje.set(eje, []);
      gruposPorEje.get(eje).push(p);
    }
    // §7.3·27 (SUPERVISOR, corrige la 26b — «la prioridad integrada del procedimiento se define señal por señal
    // EN EL CLIENTE, y los SKU van aparte», CLAUDE.md) — dos decisions que comparten eje SKU NUNCA cruzan entre
    // sí, aunque compartan clave real: se declara que no se establece una prioridad entre esos dominios (igual
    // que un eje distinto), cada una conserva la suya. Eso es DISTINTO de «sin clave real en común» (el grupo
    // de abajo, `gruposUnTema`): acá SÍ hay 2+ temas en el mismo eje, la ley simplemente los excluye de cruzar.
    const entradasPorEje = [...gruposPorEje.entries()];
    const gruposCruzables = entradasPorEje.filter(([eje, ps]) => eje !== "sku" && new Set(ps.map((p) => p.tema)).size >= 2).map(([, ps]) => ps);
    const gruposSkuDosTemas = entradasPorEje.filter(([eje, ps]) => eje === "sku" && new Set(ps.map((p) => p.tema)).size >= 2).map(([, ps]) => ps);
    const gruposUnTema = entradasPorEje.filter(([, ps]) => new Set(ps.map((p) => p.tema)).size < 2).map(([, ps]) => ps);
    if (!gruposCruzables.length && !gruposSkuDosTemas.length) {
      // decisión 24 pura: cada eje trae un único tema — sin clave compartida en NINGÚN par, no hay cruzada posible.
      const nombresDom = temasUniversoPropio.map((d) => { const n = _DOM_NOMBRE[d] || d; return n.charAt(0).toUpperCase() + n.slice(1); });
      const porEje = temasUniversoPropio.map((d) => { const pd = partesParaCruzada.find((p) => p.tema === d); const eje = (pd && (pd.eje || sujetoDeTema(pd.tema))) || d; return `${_DOM_NOMBRE[d] || d}: por ${eje}`; });
      limitesGap.push({ titulo: `Sobre ${nombresDom.join(" y ")}, no se establece una prioridad entre dominios para las cuentas pedidas`, motivo: `Se miden sobre ejes distintos (${porEje.join(" · ")}); cada parte conserva su propia prioridad dentro de su universo.` });
    } else {
      for (const partesGrupo of gruposCruzables) {
        // §7.3·27, segunda cláusula — «si en el mismo eje uno de los dominios resuelve vacío, no hay nada que
        // cruzar… y no hace falta declarar nada» (X28: cobranza resuelve 0 de 13 — comercial no tiene con quién
        // cruzar). La elegibilidad para ENTRAR al grupo sigue siendo por eje pedido (26c, sin cambios); esto solo
        // decide si ESE grupo, ya elegible, declara algo — nunca afecta a otros grupos ni a la prioridad propia de
        // cada parte (ya servida arriba, `_planCifraGrupo`/`_cerrarGrupoUniverso`).
        if (partesGrupo.some((p) => tamanoUniversoPorParte.get(p.id) === 0)) continue;
        const temasGrupo = [...new Set(partesGrupo.map((p) => p.tema))];
        const figsDelGrupoCruce = partesGrupo.flatMap((p) => figsEnAlcance(_figsDeParte(p.id), { ...alcanceDeParte(p), eje: null }, { indice: I }));
        const planCruce = _planMultiTema(temasGrupo, figsDelGrupoCruce, ref, declararRazon, declararDerivadaOpcional, { conDecision: true });   /* v22: la prioridad CRUZADA entre dominios sigue siendo la de riesgo integrado (la lente de un solo dominio ordena DENTRO de cada parte); la lente gobierna la `decision` sin universo */
        // `_soloAgregado` (ver el render de `kind:"multitema"`, más abajo): estas partes YA tienen su contenido
        // propio (filas + «Prioridad del procedimiento dentro de este grupo») — este plan SOLO aporta la
        // prioridad cruzada y el límite «sin señal», nunca la línea «quien más pesa» por dominio.
        if (planCruce) { planCruce.partesIds = partesGrupo.map((p) => p.id); planCruce._soloAgregado = true; planes.push(planCruce); }
      }
      if (gruposSkuDosTemas.length) {
        // §7.3·27, primera cláusula — dos (o más) decisions de SKU nunca cruzan entre sí: se declara, nunca en
        // silencio (a diferencia de la segunda cláusula, acá SÍ hay clave real compartida — el SKU — la ley
        // simplemente reserva la prioridad integrada para el cliente), y cada una conserva la suya.
        for (const partesGrupo of gruposSkuDosTemas) {
          const nombresDom = [...new Set(partesGrupo.map((p) => p.tema))].map((d) => { const n = _DOM_NOMBRE[d] || d; return n.charAt(0).toUpperCase() + n.slice(1); });
          limitesGap.push({ titulo: `Sobre ${nombresDom.join(" y ")}, no se establece una prioridad entre dominios para las cuentas pedidas`, motivo: "La prioridad integrada del procedimiento se define señal por señal en el cliente; entre dos decisions de SKU no se cruza — cada una conserva su propia prioridad dentro de su universo." });
        }
      }
      if (gruposUnTema.length) {
        // §7.3·26a — forma MIXTA: las partes de un eje que quedó solo NO entran en la(s) cruzada(s) de arriba;
        // se declara, nunca en silencio, y cada una conserva su propia prioridad (ya servida arriba).
        const nombresExcluidos = [...new Set(gruposUnTema.flatMap((ps) => ps).map((p) => { const n = _DOM_NOMBRE[p.tema] || p.tema; return n.charAt(0).toUpperCase() + n.slice(1); }))];
        limitesGap.push({ titulo: `Sobre ${nombresExcluidos.join(" y ")}, esa parte no entra en la prioridad cruzada de este grupo`, motivo: "Su eje no lo comparte ninguna otra decision del grupo — sin clave real en común no se cruza; conserva su propia prioridad, ya servida dentro de su universo." });
      }
    }
  }
  for (const p of partesUtiles) {
    if (partesYaAgrupadas.has(p.id)) continue;
    const figsDeP = _figsDeParte(p.id);
    if (p.cierre === "cifra" || ((p.cierre === "lectura" || p.cierre === "decision") && p.entidades && p.entidades.length)) {
      if (p.entidades && p.entidades.length) {
        const sinCifra = [];
        const plan = _planCifraEntidad(p, figsDeP, ref, I, declararDerivadaOpcional, sinCifra, resolucion.criterio);
        if (plan) { const _tt = declararTotalDeNombradas(plan, (plan.filasPorEntidad[0] && plan.filasPorEntidad[0].eje) || sujetoDeTema(p.tema)); if (_tt.length) plan.totalesDelListado = _tt; }   /* ensayo 4: nombrar a TODAS las entidades del eje es pedir el listado completo: lleva su total */
        if (plan) planes.push(plan);
        /* §7.3·49(b): una `decision` con entidades NOMBRADAS decide entre ellas. Además de la conclusión de cada una, la Entrega da la prioridad del grupo de las pedidas —por la lente que el usuario pidió (si aplica a su dominio) o, sin lente, por la de ADI, nombrada—: el mismo plan de prioridad que sirve una decisión sin entidades, pero sobre las figs de ESTAS entidades (nunca sobre la cartera). Una lente que no las ordena se declara (47a · 47d), como en cualquier grupo */
        if (plan && p.cierre === "decision" && plan.filasPorEntidad && plan.filasPorEntidad.length >= 2) {
          const _nombradas = new Set(plan.filasPorEntidad.map((x) => normalizar(x.entidad)));
          const _figsNombradas = figsDeP.filter((f) => { const en = _entidadDe(_lab(f)); return !en || _nombradas.has(normalizar(en)); });
          const mp = _planMultiTema([p.tema], _figsNombradas, ref, declararRazon, declararDerivadaOpcional, { conDecision: true, lente: lenteIdDelCriterio(resolucion.criterio), temasDeDecision: [p.tema], ctx: { indice: I, ejesDelTenant, entidades: plan.filasPorEntidad.map((x) => x.entidad) } });   /* 57(b): la lente «crecimiento» ordena entre LAS NOMBRADAS, por la variación en % de cada una */
          /* una lente que aplica pero cuya medida no distingue a nadie entre las pedidas (todo en cero o empatadas) se declara en el grupo de las pedidas (47a): el plan de señales no corona a la primera de la lista */
          const _noDistingue = !!(plan.prioridadEntre && plan.prioridadEntre.lenteGrupo && plan.prioridadEntre.lenteGrupo.modo === "sin-discrimina");
          if (mp && !_noDistingue && !mp.sinSenal && (mp.top || mp.porLente || Object.keys(mp.lideres || {}).length)) { mp.partesIds = [p.id]; mp._entreNombradas = true; plan._prioridadPorSenales = true; planes.push(mp); }
          if (!plan._prioridadPorSenales && plan.prioridadEntre) _declararLenteDelGrupo(plan.prioridadEntre.lenteGrupo, ref, plan.prioridadEntre.porEntidadId);   /* la medida de la lente se declara solo si la prioridad se sirve por este camino */
        }
        if (plan) limitesGap.push({ _faltantesDe: plan });   /* FAMILIA 2: lo que falta se declara DESPUÉS de saber qué se imprime (`servidas.js:declararLoQueFalta`, al armar los límites): un límite nunca niega una cifra que la Entrega imprime */
        if (plan && plan.sinClave && plan.sinClave.length) limitesGap.push(_limiteDeFigSinClave(p, plan.sinClave));   /* FAMILIA 4 (§7.3·52e): una fig sin clave en el léxico se declara */
      }
      else if (p.cierre === "cifra") {
        // CORTE 3c · pieza 1 (D07): universo por estado/filtro SIN `top` — el mismo camino que arriba, para el
        // cierre `cifra`.
        if (_universoPorEstadoSinTop(p.universo)) {
          const r = _cerrarGrupoUniverso(p, figsDeP, I, hechos, contador, ref, declararRazon, declararDerivadaOpcional, resolucion.criterio);
          if (r.error) { _declinarUniverso(p, r.error); continue; }
          planes.push(r);
          limitesGap.push({ _faltantesDe: r });   /* FAMILIA 2 */
          continue;
        }
        if (_universoNoSoportado(p.universo)) { limitesGap.push(_limiteUniversoNoSoportado(p)); continue; }
        const plan = _planCifraGrupo(p, figsDeP, { ejesDelTenant, indice: I });
        // RAÍZ A6 (SUPERVISOR, diagnóstico v10, cierre de la Raíz A9/v9 — X75) — antes, sin `plan` (por ejemplo un
        // `top` sobre un ranking parcial, que `_planCifraGrupo` declina devolviendo `null`, línea ~2133) esta
        // parte `cifra` desaparecía SIN RASTRO: nunca un límite, nunca una fila, nunca una oración — el mismo
        // «cambio silencioso» que CLAUDE.md §5 prohíbe y que el camino hermano de `lectura`/`decision` con
        // universo propio (más arriba, `partesUniversoPropio`) ya declara con un límite. «Declina honestamente
        // cuenta como éxito» (CLAUDE.md §5): se avisa, nunca se calla.
        // RAÍZ A (supervisor 2026-09-29) — `plan.error` (universo declarado no-resoluble, p. ej. un `union` con
        // «frenado» sin umbral) se declara con SU motivo real, no el genérico de «sin evidencia» — mismo criterio
        // que el sitio hermano de `lectura`/`decision`, arriba.
        if (plan && plan.error) { _declinarUniverso(p, plan.error); }
        else if (!plan) { limitesGap.push({ titulo: `Sobre la parte ${p.id} (${_DOM_NOMBRE[p.tema] || p.tema}), el universo declarado no encontró evidencia en la boleta`, motivo: "El conjunto se resolvió parcialmente o no se pudo verificar contra la evidencia de este turno — se declina en vez de servir con otro alcance o sobre un ranking incompleto." }); }
        else {
          // tentación precalculada (mecanismo 6): la diferencia entre el primero y el segundo del listado, en la
          // MISMA métrica que ordena — se captura el fig ANTES de convertir el mapa a ids (unit-aware), y se
          // declara DESPUÉS con los mismos ids que ya va a imprimir la tabla (nunca una segunda referencia a la fig).
          // R-COBRANZA-TOP8-SIN-COLA-MENOR (diagnóstico v6, defensa en profundidad, ALTA) — «una Entrega nunca
          // revienta»: `_mapaDe` evita el `.get()` sobre `undefined` cuando una entidad de `orden` no trajo NINGÚN
          // concepto en `porEntidad` (misma nota que el fallback de arriba; `_mapaDe` es la guarda de archivo, A2).
          const figA0 = plan.orden.length > 1 ? _mapaDe(plan.porEntidad, plan.orden[0]).get(plan.claveOrden) : null;
          const figB0 = plan.orden.length > 1 ? _mapaDe(plan.porEntidad, plan.orden[1]).get(plan.claveOrden) : null;
          for (const e of plan.orden) for (const [clave, fig] of _mapaDe(plan.porEntidad, e)) _mapaDe(plan.porEntidad, e).set(clave, ref(fig));
          if (figA0 && figB0) plan.idDiffOrden = declararDerivadaOpcional(figA0, _mapaDe(plan.porEntidad, plan.orden[0]).get(plan.claveOrden), figB0, _mapaDe(plan.porEntidad, plan.orden[1]).get(plan.claveOrden));
          { const _tt = declararTotalDelListado(plan); if (_tt.length) plan.totalesDelListado = _tt; }   /* el total del listado COMPLETO de una métrica aditiva: al libro, no al texto */
          planes.push(plan);
          limitesGap.push({ _faltantesDe: plan });   /* FAMILIA 2 */
        }
      }
    } else if (p.cierre === "comparacion") {
      const plan = _planComparacion(p, figsDeP, ref, declararDerivada, I); if (plan) { planes.push(plan); limitesGap.push({ _faltantesDe: plan }); if (plan.sinClave) limitesGap.push(_limiteDeFigSinClave(p, plan.sinClave)); }   /* FAMILIA 2 · FAMILIA 4 (una cifra que el léxico no conoce se declara) */
    } else if (p.cierre === "simulacion") {
      // el/los id(s) que ESTA parte cita viven en `Parte.supuestos` del encargo CRUDO (`resolucion.encargo.partes`),
      // no en `ParteResuelta` (§1.1 del contrato: campo estructurado que `validarEncargo` no reproyecta — el mismo
      // que ya lee `lecturasDe.js`). Se toma el PRIMER supuesto citado que sí resolvió (con productor): nunca se
      // sustituye por uno que la parte no citó.
      const crudaP = ((resolucion.encargo && resolucion.encargo.partes) || []).find((x) => x && x.id === p.id);
      const citados = crudaP && Array.isArray(crudaP.supuestos) ? crudaP.supuestos : [];
      const supuesto = citados.map((sid) => (resolucion.supuestos || []).find((s) => s.id === sid)).find(Boolean) || null;
      const planS = _planSimulacion(p, figsDeP, supuesto, ref, declararDerivada, I);
      if (planS) planes.push(planS);
    } else if (p.cierre === "definicion") {
      // la call de ESTA parte es SIEMPRE una sola (`_pasosDefinicion`, lecturasDe.js) — se ubica por su índice
      // real en `plan.calls` (mismo mecanismo de procedencia que `_figsDeParte`), nunca "el primer resultado con
      // es_definicion" del turno entero (eso mezclaba partes cuando había más de una `definicion` en un encargo).
      const idxs = [..._callIdsDePartes([p.id])].map((cid) => Number(cid.slice(1)));
      /* v21 (T14, §7.3·44b): el fallback «cualquier definición del turno» es SOLO para una parte sin llamada propia hallada (defensivo). Con llamada propia que devolvió `facts: null` (un concepto sin definición curada, «peso_costo») la parte NO toma la definición de OTRA parte (servía «en juego» dos veces y ningún límite): cae al límite «definición no disponible». */
      const facts = idxs.map((i) => rp.results[i] && rp.results[i].facts).find((f) => f && f.es_definicion && f.concepto)
        || (idxs.length ? null : rp.results.map((r) => r.facts).find((f) => f && f.es_definicion && f.concepto));   // sin índice hallado (defensivo): no se pierde la única definición del turno
      const plan = _planDefinicion(p, facts);
      // CORTE 3e (owner 2026-09-26) — «declina, no adivina»: sin `neutra` para este concepto, la parte se declara
      // como límite (la MISMA disciplina que `_universoNoSoportado` unas líneas arriba), nunca se sirve el texto
      // de Sentrix (tuteo) como si fuera de la Entrega.
      if (plan === "sin_neutra") limitesGap.push({ titulo: `Sobre la parte ${p.id}, la definición de «${facts.concepto}» no está disponible en este registro`, motivo: "Esta definición todavía no tiene una redacción en tercera persona para la Entrega — se declina en vez de servir el texto de Sentrix, que está en segunda persona." });
      else if (plan) planes.push(plan);
      /* v20 (U34, «declina, no adivina»): el concepto que el validador ACEPTA (una clave de métrica, `markup`) pero que `defineConcept` no tiene curado devuelve `facts: null`: la parte quedaba `resuelta` y NO se servía ni se declaraba (un cambio silencioso; con otras partes, la definición pedida desaparecía sin rastro). Se declara el límite, con el mismo título del camino hermano. */
      else {
        const crudaDef = ((resolucion.encargo && resolucion.encargo.partes) || []).find((x) => x && x.id === p.id);
        const conceptoDef = String((crudaDef && crudaDef.concepto) || p.id).replace(/_/g, " ");   /* v21: en palabras, nunca la clave interna con guion bajo («peso_costo» → «peso costo») */
        limitesGap.push({ titulo: `Sobre la parte ${p.id}, la definición de «${conceptoDef}» no está disponible en este registro`, motivo: "Este concepto todavía no tiene una definición curada para la Entrega — se declina en vez de inventarla." });
      }
    }
  }
  // §7.3·29 (SUPERVISOR, 2026-09-28 — ley «declinar honestamente cuenta como éxito», X75) — si TODAS las partes
  // resueltas se declinaron AL COMPONER (ranking incompleto, universo que no coincide…), `limitesGap` ya trae un
  // límite por parte, en lenguaje de negocio, con su motivo. La Entrega YA NO sale vacía por eso: se deja que el
  // resto de esta función siga con `planes:[]` — el marco se arma igual (línea ~3571), las premisas se verifican
  // igual (línea ~3121) y `limitesGap` se vuelca a `entrega.limites` más abajo (línea ~3720) — así que el
  // resultado final es `ok:true`, sin ganador servido y con el límite de cada parte declarado. `ok:false` queda
  // reservado para una raíz inválida o un error interno: SOLO cuando ninguna parte dejó ni un plan NI un límite
  // (`limitesGap` también vacío) no hay ninguna razón de negocio que declarar — ahí sí es un vacío genuino.
  if (!planes.length && !limitesGap.length) return _vacia("ninguna parte del encargo produjo evidencia suficiente para componer la Entrega");

  // «comparables viajan juntas» (mecanismo 3 del plan): cualquier plan comercial puede citar «brecha»/«benchmark»
  // en su prosa (carga alta, brecha al benchmark, contribución no capturada…) — el Marco declara la referencia
  // UNA vez, ANTES de saber si el texto la va a necesitar (se declara igual, sin costo: `ref()` de un hecho que
  // no se imprime no rompe nada). Mismo patrón que ya usan las 4 rutas fijas y la ruta multidominio de arriba.
  /* v24 (Q09, §7.3·44b): una DEFINICIÓN comercial sola no es un Marco comercial (§1.1: sin cifras): su plan no pone en juego el benchmark ni el período del año cerrado */
  const idBenchComercialGlobal = planes.some(planPoneElBenchmark) ? ref(figDelBenchmarkOficial(figs)) : null;   /* FAMILIA 3: qué plan pone en juego el benchmark y cuál es su fig lo decide `referencias.js` */
  // CORTE 3c · pieza 1 — un `grupoUniverso` comercial puede nombrar «benchmark»/«nivel de carga» en el texto de su
  // universo (`nombrarUniverso`, vía `_fmtUmbral`): declararlo acá, ANTES de imprimir, es el mismo patrón que la
  // línea de arriba — un `ref()` de un hecho que el texto termina no usando no rompe nada.

  // TENTACIÓN PRECALCULADA CRUZADA (supervisor 2026-09-27, diagnóstico v9 · raíces A10/A11 — W22/W30/W51) — el
  // mecanismo 6 ya declara la derivada/razón DENTRO de un plan cuando esa parte trae ≥2 entidades explícitas o un
  // universo con ≥2 miembros que comparten `claveOrden` (`_planCifraEntidad`, `_planCifraGrupo`,
  // `_cerrarGrupoUniverso`, arriba). Pero un GRUPO de varias partes de UNA sola entidad cada una (W30: p1 → La
  // Polar top k:1, p2 → Easy top k:1 — cada plan por separado nunca ve a las dos entidades juntas) o un universo
  // cuyos dos miembros solo comparten un concepto DISTINTO del que ordena el top (W51: p1 trae SAM-TV55/
  // LG-AIR9000 pero solo "capital" tiene fig para las dos — "dias_sin_venta", el `claveOrden`, ausente por
  // "ausente vale cero" — así que el mecanismo interno, que solo mira `claveOrden`, no encuentra par) puede
  // terminar con ≥2 DUEÑOS DISTINTOS en la Entrega sin que NINGÚN plan, por sí solo, haya visto a los dos juntos
  // con una clave en común. `verificarEntrega` («tentacion-no-precalculada») cuenta los dueños de la TABLA FINAL,
  // no por parte — así que acá, ANTES de verificar el libro (`libroDeHechos`, la línea de abajo: un hecho
  // agregado DESPUÉS de esa llamada nunca entra al libro devuelto), se repite el MISMO mecanismo sobre TODOS los
  // planes ya construidos: se listan sus tríos (dueño, clave, id — los mismos ids que cada plan YA declaró con
  // `ref()`) y se busca la clave común entre las DOS PRIMERAS filas de dueños distintos, en el orden en que los
  // planes se construyeron. `declararDerivada` (la única función que ya decide pp/diferencia por unidad, nunca
  // una segunda) solo necesita la UNIDAD de esa clave (`unidadDeClave`, la misma tabla de `lexico.js` que ya usa
  // todo este archivo) — nunca la fig cruda, que a esta altura ya está convertida a id dentro de cada plan.
  const _triplesDePlan = (plan) => {
    const out = [];
    if (plan.kind === "entidad") { for (const e of plan.filasPorEntidad || []) for (const f of e.filas || []) if (f.id != null && f.clave) out.push({ dueno: e.entidad, clave: f.clave, id: f.id }); }
    else if (plan.kind === "grupo" || plan.kind === "grupoUniverso") {
      const nombres = plan.kind === "grupoUniverso" ? (plan.miembros || []) : (plan.orden || []);
      for (const nombre of nombres) for (const [clave, id] of _mapaDe(plan.porEntidad, nombre)) if (id != null && clave) out.push({ dueno: nombre, clave, id });
    }
    return out;
  };
  const _tentacionCruzada = () => {
  if (hechos.some((h) => h.tipo === "razon" || h.tipo === "derivada")) return;
  {
    const _todosTriples = planes.flatMap(_triplesDePlan);
    if (new Set(_todosTriples.map((t) => t.dueno)).size > 1) {
      /* FAMILIA 5 (§7.3·48d): el par es el PRIMERO que algún dueño forma con otro que comparte su clave, no solo el de la primera fila (el verificador pide la tentación cuando CUALQUIER par de dueños comparte un concepto: Lider y Hites comparten «margen» aunque la primera fila de Lider sea otra). Con la primera fila emparejada el par es el de siempre */
      let primera = null, segunda = null;
      /* los operandos son cifras citadas tal cual (`ref` o `cifra`): una cifra que otro hecho CALCULÓ («Contribución» derivada de venta y margen) no es operando de una diferencia */
      const _tipoDe = (t) => { const h = hechos.find((x) => x.id === t.id); return h ? h.tipo : null; };
      const _paresQueNoVerificaron = _tentacionCruzada._fallidos || (_tentacionCruzada._fallidos = new Set());
      /* con crudo propio primero (`ref`: la fig de la boleta); la `cifra` de la proyección solo si no hay un par de `ref` */
      for (const tipos of [["ref"], ["ref", "cifra"]]) {
        const _citadas = _todosTriples.filter((t) => tipos.includes(_tipoDe(t)));
        for (const a of _citadas) { const b = _citadas.find((t) => t.dueno !== a.dueno && t.clave === a.clave && !_paresQueNoVerificaron.has(`${a.id}|${t.id}`)); if (b) { primera = a; segunda = b; break; } }
        if (primera) break;
      }
      const unidad = primera ? unidadDeClave(primera.clave) : null;
      // §7.3·25 (mecanismo 6, apoyo) — misma guardia que el resto de este archivo: `declararDerivadaOpcional`
      // marca el id como opcional (capa 2, `rotos` más abajo); estos operandos son sintéticos (`{unit}`, sin
      // `crudo` propio porque a esta altura solo queda el id ya `ref()`ado, no la fig) — no bloquean por crudo,
      // pero SÍ quedan protegidos si `libroDeHechos` los marca no-verificables por otra causa.
      if (segunda && unidad) declararDerivadaOpcional({ unit: unidad }, primera.id, { unit: unidad }, segunda.id);
    }
  }
  };
  _tentacionCruzada();

  let libro = libroDeHechos(hechos, { indice: I });
  /* FAMILIA 5 (§7.3·48d): la tentación de apoyo que un plan declaró y NO verificó se retira del libro (abajo) y dejaría a la Entrega con ≥2 dueños y ninguna tentación precalculada: se reintenta UNA vez con el par transversal (sin la que no verificó) antes de dar el libro por cerrado */
  { const _fallidas = libro.hechos.filter((h) => !h.ok && idsTentacionOpcional.has(h.id));
    if (_fallidas.length && !libro.hechos.some((h) => h.ok && (h.tipo === "razon" || h.tipo === "derivada"))) {
      for (const h of _fallidas) { const i = hechos.findIndex((x) => x.id === h.id); const crudo = i >= 0 ? hechos[i] : null; if (i >= 0) hechos.splice(i, 1); idsTentacionOpcional.delete(h.id); if (crudo && Array.isArray(crudo.de) && crudo.de.length === 2) (_tentacionCruzada._fallidos || (_tentacionCruzada._fallidos = new Set())).add(`${crudo.de[0].id}|${crudo.de[1].id}`); }
      _tentacionCruzada();
      libro = libroDeHechos(hechos, { indice: I });
    } }
  // §7.3·25 (SUPERVISOR, diagnóstico v10, raíz A1) — un hecho OPCIONAL (`idsTentacionOpcional`, la tentación
  // precalculada de apoyo, arriba) que no verifica NUNCA tumba la Entrega: se retira en silencio de `rotos` — no
  // se cita en ningún texto servido (ver la nota junto a `declararDerivadaOpcional`), así que dejarlo fuera de
  // `rotos` no deja un hueco en la prosa. Solo lo que se va a IMPRIMIR (todo lo demás: `_planComparacion`, la
  // simulación base↔resultado, cualquier `ref`/cifra pedida) sigue exigiendo verificar para no tumbar cerrado.
  const rotos = libro.hechos.filter((h) => !h.ok && !idsTentacionOpcional.has(h.id));
  if (rotos.length) return { texto: "", entrega: null, libro, ok: false, motivo: `${rotos.length} hecho(s) no verificaron: ${rotos.map((h) => `${h.id} (${h.motivo})`).join(" · ")}` };
  // §7.3·25, cont. — «se retira en silencio DEL LIBRO»: un hecho opcional roto no solo se excluye de `rotos`
  // (arriba, para no tumbar la Entrega); también se saca de `libro.hechos`/`libro.porId` ACÁ, antes de que nadie
  // más lo lea — `verificarEntrega` regla 9 («autoverificacion») audita el libro completo por su cuenta (defensa
  // en profundidad, no pasa por `rotos`) y marcaría el mismo hecho roto otra vez si se quedara adentro. Ninguna
  // parte de la Entrega cita estos ids (ver la nota de `declararDerivadaOpcional`), así que retirarlos no deja un
  // hueco: `libro` sigue siendo el mismo objeto en toda la función, así que el retiro es visible en todo lo que
  // sigue (`_procedenciaDeFila`, `R()`, `entrega.procedencia.libro`).
  for (const h of libro.hechos) { if (!h.ok && idsTentacionOpcional.has(h.id)) libro.porId.delete(h.id); }
  libro.hechos = libro.hechos.filter((h) => h.ok || !idsTentacionOpcional.has(h.id));

  // ═══ CORTE 3d.1 (owner 2026-09-25) — LA INICIATIVA DE CFO. Se declara y verifica en SU PROPIO libro, con SU
  // PROPIO prefijo de id (`i*`, asignado por `iniciativa.js` — nunca comparte contador con `e*`): lo pedido de
  // arriba (`hechos`/`contador`/`libro`/`rotos`) queda INTACTO, se calcule o no la iniciativa (candado §A.6). Un
  // hecho de iniciativa que no verifica no se sirve y no tumba la Entrega (`iniciativaNoVerificada`, abajo); el
  // texto se arma más adelante, junto a `cifrasImpresas`, para que la regla «cero cifras desnudas» lo audite igual.
  const _iniciativaFlagCruda = resolucion.encargo && resolucion.encargo.iniciativa;
  const iniciativaOn = INICIATIVA_VALORES.includes(_iniciativaFlagCruda) ? _iniciativaFlagCruda !== "ninguna" : true;   // default "completa"; un valor inválido ya quedó declarado en noResuelto (validar.js)
  // R1 (diagnóstico v2, supervisor 2026-09-26) — `eje` viaja acá SOLO para que `iniciativa.js` pueda distinguir
  // «cartera entera» de «un eje explícito distinto del sujeto del tema» (`alcanceDeParte`, `entrega/alcance.js`):
  // antes este resumen no traía el campo, así que `iniciativa.js` no podía verlo aunque `ParteResuelta.eje` ya lo
  // tuviera resuelto — ver la nota en `iniciativa.js:_tieneLecturaDeCarteraEntera`.
  // R-INICIATIVA-UNIVERSO-NO-ENTIDADES (diagnóstico v6, ALTA): una parte puede acotar su alcance con `universo`
  // (p.ej. `top:{...}`) SIN nombrar `entidades` una por una — el guardia de "cartera entera" de `iniciativa.js`
  // (`_tieneLecturaDeCarteraEntera`) YA sabe que un `universo` declarado no es cartera entera, pero el guardia
  // HERMANO que acota la oración integrada (`entidadesNombradas`, mismo archivo) solo miraba `entidades` — un
  // hueco justo para este patrón nuevo de la etapa 1 (`universo.top` como forma primaria de acotar una
  // `decision`/`lectura`, sin nombrar clientes uno por uno). Se resuelve el universo ACÁ (mismo `conjuntoDeUniverso`
  // que ya usa el resto del compositor) y se le pasan los nombres resultantes a `iniciativa.js` como si fueran
  // `entidades` declaradas — `p.universo` sigue viajando intacto, así que el guardia de "cartera entera" no cambia.
  const partesParaIniciativa = partesUtiles.map((p) => {
    let nombres = (p.entidades || []).map((e) => e.nombre);
    if (!nombres.length && p.universo && typeof p.universo === "object") {
      const ejeU = normalizar(p.universo.eje || p.eje || "") || null;
      try {
        const U = conjuntoDeUniverso(p.universo, I, ejeU, "");
        if (U && U.set) nombres = [...U.set].map((k) => (I.entidades.get(k) || { nombre: k }).nombre);
      } catch { /* universo no resoluble acá: se deja sin nombres — el guardia de cartera entera ya excluye la parte igual */ }
    }
    return { tema: p.tema, cierre: p.cierre, conceptos: (p.conceptos || []).length, entidades: nombres, universo: p.universo || null, eje: p.eje || null };
  });
  const yaTieneIntegrada = planes.some((pl) => pl.kind === "multitema");
  const { hechos: hechosIniciativa, candidatos: candidatosIniciativa } = calcularIniciativa({
    figs, partes: partesParaIniciativa, iniciativaOn, yaTieneIntegrada,
  });
  const libroIniciativa = hechosIniciativa.length ? libroDeHechos(hechosIniciativa, { indice: I }) : null;
  const iniciativaVerificada = [];
  const iniciativaNoVerificada = [];
  for (const c of candidatosIniciativa) {
    const okIni = !!libroIniciativa && c.hechos.every((id) => { const h = libroIniciativa.porId.get(id); return h && h.ok; });
    if (okIni) iniciativaVerificada.push(c);
    else {
      const primero = libroIniciativa && c.hechos.map((id) => libroIniciativa.porId.get(id)).find((h) => h && !h.ok);
      iniciativaNoVerificada.push({ id: c.catalogo, motivo: (primero && primero.motivo) || "hecho de iniciativa no verificado" });
    }
  }
  // ═══ (b) LA INICIATIVA NUNCA REPITE LO PEDIDO (supervisor, revisión de calidad 2026-09-25) — «un hecho de
  // iniciativa cuyo contenido (clave, entidad, valor, universo) ya está servido como pedido NO se sirve otra
  // vez». Se compara por FIRMA — tipo de operación + el/los FIG(s) subyacente(s) (nunca el texto, nunca el id de
  // hecho, que vive en libros distintos): dos hechos que citan LOS MISMOS figs con la MISMA operación (razón o
  // derivada) son el MISMO contenido, aunque uno lo haya declarado el pedido y el otro la iniciativa. Solo mira
  // un nivel (el operando directo de una razón/derivada es siempre un `ref` en este catálogo — nunca una
  // derivada anidada), que es exactamente la forma de todos los candidatos de `iniciativa.js` hoy.
  const _porIdPedidoRaw = new Map(hechos.map((h) => [h.id, h]));
  const _figDeHechoPedido = (id) => { const h = _porIdPedidoRaw.get(id); return h && h.tipo === "ref" ? h.de : null; };
  const _firmaDeHecho = (h, figDe) => {
    if (!h) return null;
    if (h.tipo === "razon") { const n = figDe(h.num && h.num.id), d = figDe(h.den && h.den.id); return (n != null && d != null) ? `razon:${n}/${d}` : null; }
    if (h.tipo === "derivada") { const ids = (h.de || []).map((x) => figDe(x && x.id)); return ids.every((x) => x != null) ? `derivada:${h.op}:${[...ids].sort().join(",")}` : null; }
    return null;
  };
  const _firmasPedido = new Set();
  for (const h of hechos) { const f = _firmaDeHecho(h, _figDeHechoPedido); if (f) _firmasPedido.add(f); }
  const _porIdIniciativaRaw = new Map(hechosIniciativa.map((h) => [h.id, h]));
  const _figDeHechoIniciativa = (id) => { const h = _porIdIniciativaRaw.get(id); return h && h.tipo === "ref" ? h.de : null; };
  const iniciativaSinDuplicar = iniciativaVerificada.filter((c) => {
    const firmas = c.hechos.map((id) => _firmaDeHecho(_porIdIniciativaRaw.get(id), _figDeHechoIniciativa)).filter(Boolean);
    return !firmas.some((f) => _firmasPedido.has(f));
  });

  // ── FASE 2 · renderizar (SOLO desde `R(id)`, nunca un número a mano) ──
  const entrega = crearEntrega();
  const cifrasImpresas = [...numerosDeLimitesGap];
  const R = (id) => { const v = renderDe(libro, id); if (v != null) cifrasImpresas.push(v); return v; };
  // CORTE 3d (owner 2026-09-26) — una simulación tiene su PROPIA forma de tabla (Entidad · Simulación · Supuesto ·
  // Métrica · Valor · Tipo, garantía §2 de la simulación): «la fila es indivisible», no cabe en las columnas
  // genéricas de arriba (que no declaran de qué simulación/supuesto sale un valor). Hoy NINGÚN caso del catálogo
  // mezcla `simulacion` con otro cierre en el MISMO encargo (`_simulacion_dueno_gate.mjs` lo prueba) — si algún
  // día un encargo mezclara los dos, esta rama seguiría siendo la correcta para la tabla ENTERA solo cuando TODO
  // el encargo es simulación; mezclar de verdad dos formas de tabla en una queda fuera de este corte (se
  // reportaría, no se improvisa una tercera forma). Columna "Simulación" (antes "Escenario", retirado owner
  // 2026-09-26 — `_colapso_eje_gate` C4: el CONCEPTO visible «escenario» murió, «simulación» es la palabra en
  // TODO texto emitido; el campo estructural sigue llamándose `escenarioId` internamente, eso no es texto).
  const _esSoloSimulacion = planes.length > 0 && planes.every((p) => p.kind === "simulacion");
  entrega.cifras.columnas = _esSoloSimulacion
    ? ["Entidad", "Simulación", "Supuesto", "Métrica", "Valor", "Tipo"]
    : ["Entidad / grupo", "Tema", "Métrica", "Valor", "Tipo"];
  const temasCubiertos = new Set();
  // §7.3·29 (SUPERVISOR, 2026-09-28) — con `planes:[]` (TODAS las partes resueltas se declinaron al componer,
  // el camino que abrió la decisión 29), el loop de abajo («for (const plan of planes)») nunca corre, así que
  // `temasCubiertos` quedaría vacío aunque el encargo SÍ pedía esos temas — la Entrega compone `ok:true` con un
  // límite por parte, pero el Marco/`entrega.temasCubiertos` tienen que seguir declarando QUÉ se intentó
  // responder (X75 lo mide: `temasCubiertos: ["comercial"]` aunque las dos partes se hayan declinado). Se
  // declaran los temas de las partes ÚTILES (resuelta/parcial) directamente — nunca inventa un tema que el
  // encargo no pidió, y no cambia nada cuando SÍ hay planes (ese caso ya declara su tema en el loop de abajo).
  if (!planes.length) for (const p of partesUtiles) if (p.tema) temasCubiertos.add(p.tema);
  // ETAPA 6 (owner 2026-09-29, §7.3·35): una fila cuya cifra es un HECHO HISTÓRICO (días sin venta, unidades del período,
  // última venta) lo declara en la propia fila — naturaleza + ventana + límite, leídos del `tipo` de la fig que el hecho
  // referencia (nunca de un texto). Las demás filas no traen esos campos.
  const _histDeHecho = (id) => { const h = hechos.find((x) => x.id === id); const g = h && h.tipo === "ref" ? figs.find((f) => f.id === h.de) : null; const t = g && g.tipo; return t && t.naturaleza === "historico" ? { naturaleza: t.naturaleza, ventana: t.ventana, limite: t.limite } : null; };
  /* FAMILIA 2 (§7.3·52b): cada cifra lleva su ORIGEN. Las que completa `servidas.js` (la fila de la proyección o el cero de cobertura declarada de su fuente) lo traen en `contador.origenes`: el cero de COBERTURA lo dice en su «Tipo» y con su porqué («cobertura declarada: no figura entre los SKU inmovilizados críticos»), y la fila del concepto de otro dominio lleva el tema SUYO. */
  const _fila = (entidad, tema, etiqueta, id) => {
    const procedencia = _procedenciaDeFila(libro, [id]);
    const o = contador.origenes && contador.origenes.get(id);
    const cobertura = !!(o && o.origen === ORIGEN.COBERTURA);
    const temaFila = (o && o.clave && dominioDeClave(o.clave)) || temaDeLaFila(etiqueta, tema);   /* FAMILIA 5 (estándar de los cuatro puntos): el tema de la fila es el del dominio de SU cifra («Venta a crédito» es de cobranza aunque la pida la lente «ventas» de una parte comercial) */
    /* FAMILIA 4: la fila de Cifras la construye `rotulos.js:filaDeCifra` (el ÚNICO constructor); el rótulo (`etiqueta`) llega de la pieza, nunca escrito a mano */
    return filaDeCifra({ entidad, tema: _DOM_NOMBRE[temaFila] || temaFila, rotulo: etiqueta, valor: R(id), tipo: cobertura ? `cobertura declarada: ${o.porQue}` : _textoDeTipo(procedencia), id, procedencia, origen: (procedencia === "medido" || cobertura) ? (cobertura ? ORIGEN.COBERTURA : ORIGEN.MEDIDO) : null, extra: _histDeHecho(id) });
  };

  // ═══ CORTE 3c · PIEZA 3 (owner 2026-09-25) — VEREDICTO DE PREMISAS ═══════════════════════════════════════════
  // `resolucion.premisas` ya pasó `validarHecho` (validar.js): son hechos bien FORMADOS, no verificados. Se
  // juzgan ACÁ contra lo medido, con el MISMO `libroDeHechos` que verifica cada hecho de esta Entrega — nunca una
  // segunda verdad. Libro APARTE (`libroPremisas`, nunca mezclado con `libro`/`rotos` de arriba): una premisa
  // falsa es información legítima para declarar, no un hecho roto del compositor — mezclarla en `libro` tumbaría
  // la Entrega entera por algo que EL USUARIO afirmó, no ADI. La conclusión de cada parte (arriba, FASE 1) NUNCA
  // lee esto: se calcula sobre lo medido, y el veredicto de la premisa solo se ANUNCIA (ley «premisa-adoptada»,
  // CLAUDE.md §2: «la conclusión es del procedimiento, no del narrador» — acá, no de la premisa).
  const premisasCrudas = Array.isArray(resolucion.premisas) ? resolucion.premisas : [];
  const libroPremisas = premisasCrudas.length ? libroDeHechos(premisasCrudas, { indice: I }) : null;
  if (libroPremisas) {
    const premisasPorParte = new Map();
    for (const p of premisasCrudas) {
      const H = libroPremisas.porId.get(String(p.id));
      if (!H) continue;
      const parteId = _parteDePremisa(p, partesUtiles);
      if (!parteId) continue;
      if (!premisasPorParte.has(parteId)) premisasPorParte.set(parteId, []);
      premisasPorParte.get(parteId).push(H);
      // regla 1 de verificarEntrega («cero cifras desnudas»): la cifra que `_textoDePremisa` va a imprimir sale
      // literal de `H.verdad`/`H.motivo`/el `verdad` de sus derivados — se registra ACÁ (mismo patrón que `R(id)`
      // sobre el libro principal, pero este libro es OTRO: no hay un `R` que lo haga solo).
      // RC1 (owner, diagnostico.md §RC1): ese comentario asumía que ESO es lo que `_textoDePremisa` siempre
      // imprime — falso para una premisa `cifra` (H.tipo distinto de ref/razon/derivada): ahí
      // `_rotuloDeLaCasaDeH(H)` fabrica un string NUEVO con el VALOR RECLAMADO por el usuario (p.ej. «Tottus:
      // margen 32%», el 32% es lo que el usuario afirmó, tomado de H.numeros — no de H.verdad/H.motivo). Sin
      // registrar ESE rótulo, `verificarEntrega` lo veía como una cifra desnuda (regla 1) y tumbaba una Entrega
      // por lo demás bien compuesta. Se agrega el mismo rótulo que `_textoDePremisa` realmente usa (null cuando
      // no aplica — hechos ref/razon/derivada ya quedan cubiertos por H.verdad arriba).
      for (const s of [H.verdad, H.motivo, _rotuloDeLaCasaDeH(H), _umbralesDeLaPremisa(H, consultaDeFrenado), ...(H.derivados || []).map((d) => { const D = libroPremisas.porId.get(d); return D && (D.verdad || D.motivo); })]) if (s) cifrasImpresas.push(s);
    }
    // se abre por el orden de las PARTES del encargo (determinístico, nunca el orden en que el usuario escribió
    // las premisas): «la Entrega abre la parte correspondiente» — una premisa, una vez, en la parte que le toca.
    for (const p of partesUtiles) {
      const items = premisasPorParte.get(p.id);
      if (!items || !items.length) continue;
      for (const H of items) entrega.respuesta.push({ texto: _textoDePremisa(H, libroPremisas, consultaDeFrenado), hechos: [H.id], _premisa: true });
    }
  }

  /* §7.3·49(g): las entidades que la cabeza de un grupo cita tienen su fila protegida en Cifras (doble colocación) y el corte NUNCA parte una entidad: todas sus filas van con ella. El tope de filas de la profundidad se reparte entre los grupos (tema y eje; dos partes del mismo tema y eje son una misma entidad: sus filas se suman): cada grupo cita al menos una entidad ENTERA y, con lo que sobra, más (máximo tres), de a una por grupo. Con tres o más grupos en «breve» son una (la regla de la v24) */
  let _cuotasDeCabeza = null;
  const _nCabezaDe = (plan) => {
    if (!_cuotasDeCabeza) {
      const grupos = planes.filter((pl) => pl.kind === "grupo");
      const claveG = (pl) => `${pl.tema}:${pl.eje}`;
      const filasPor = new Map();
      for (const pl of grupos) filasPor.set(claveG(pl), (filasPor.get(claveG(pl)) || 0) + Math.max(1, (pl.conceptos || []).length));
      const tope = _profundidadDe(resolucion) === "breve" ? FILAS_BREVE_MAX : FILAS_COMPLETA_MAX;
      const n = new Map([...filasPor.keys()].map((k) => [k, 1]));
      let usadas = [...filasPor.values()].reduce((a, b) => a + b, 0);
      for (let cambio = true; cambio;) { cambio = false; for (const [k, r] of filasPor) if (n.get(k) < 3 && usadas + r <= tope) { n.set(k, n.get(k) + 1); usadas += r; cambio = true; } }
      _cuotasDeCabeza = { n, claveG };
    }
    return Math.min(nCabezaMax, _cuotasDeCabeza.n.get(_cuotasDeCabeza.claveG(plan)) || 1);   /* §7.3·50(c): `nCabezaMax` baja cuando el tope de tamaño no alcanza para las entidades enteras que cita la cabeza (`componerEntrega`) */
  };
  for (const plan of planes) {
    if (plan.kind === "entidad") {
      plan._servido = true;
      /* ensayo 4: el total del listado completo pedido NOMBRANDO a todas las entidades del eje (`declararTotalDeNombradas`): igual que el del listado por eje, no se imprime; queda en `entrega.cifras.totales` para el libro y la respuesta compacta */
      if (plan.totalesDelListado && plan.totalesDelListado.length) {
        const _ejeN = (plan.filasPorEntidad[0] && plan.filasPorEntidad[0].eje) || sujetoDeTema(plan.tema);
        const _totN = plan.totalesDelListado.map((t) => ({ hecho: t.id, entidad: `Total del listado completo (${conteoDeEje(_ejeN, t.n).texto})`, eje: _ejeN, metrica: rotuloDeLaCasa({ clave: t.clave }).rotulo, valor: renderDe(libro, t.id), procedencia: "derivado", tema: plan.tema }));
        entrega.cifras.totales = [...(entrega.cifras.totales || []), ..._totN];
      }
      // (a) CORRECCIÓN DEL SUPERVISOR (2026-09-25) — «una lectura/decision sobre una entidad abre con la
      // CONCLUSIÓN del procedimiento, no con un volcado». Cifras SIEMPRE recibe la lista completa (una fila por
      // fig, deduplicada por clave); la Respuesta abre con la conclusión (`_construirConclusionEntidad`,
      // declarada en la fase 1) cuando el cierre es `lectura`/`decision` y la conclusión pudo armarse — si no
      // (cierre `cifra`, o datos insuficientes para una conclusión), sigue el listado de siempre.
      for (const { entidad, eje, filas, conclusion } of plan.filasPorEntidad) {
        if (!filas.length) continue;
        temasCubiertos.add(plan.tema);
        for (const f of filas) entrega.cifras.filas.push(_fila(entidad, plan.tema, f.etiqueta, f.id));
        let texto = null, hechosRespuesta = null;
        if (plan.cierre === "lectura" || plan.cierre === "decision") texto = _renderConclusionEntidad(conclusion, R, cifrasImpresas);
        if (texto) hechosRespuesta = _hechosDeConclusion(conclusion);
        else {
          // el recorte de "en $" (`_sinSufijoDolar`) es SOLO acá, al pegar rótulo+valor en una oración — la
          // tabla de Cifras de arriba usa `f.etiqueta` tal cual (canónico, ver la nota de `_planCifraEntidad`).
          const frases = filas.slice(0, 5).map((f) => `${_sinSufijoDolar(f.etiqueta).toLowerCase()} ${R(f.id)}`);
          texto = `${entidad}: ${frases.join(", ")}.`;
          hechosRespuesta = filas.map((f) => f.id);
        }
        entrega.respuesta.push({ texto, hechos: hechosRespuesta });
        _declararUniverso(entrega, I, { id: `${plan.parteId}_${entidad}`, eje: eje || "cliente", entidades: [entidad] });
        // (2) CORRECCIÓN DEL SUPERVISOR (2026-09-25, error MATERIAL de universo) — el puesto que la conclusión
        // declara («N° de M...») tiene que tener un universo VERIFICABLE: se declara acá, con TODAS las
        // entidades del ranking completo (nunca solo el top-k) — el candado del gate compara el denominador
        // contra `entrega.universos[x].entidades.length`.
        if (conclusion && conclusion.universoEntidades && conclusion.universoEntidades.length) {
          _declararUniverso(entrega, I, { id: `${plan.parteId}_${entidad}_ranking`, eje: conclusion.universoEje || "cliente", entidades: conclusion.universoEntidades, criterio: conclusion.universoCriterio, soloRanking: true });
        }
      }
      /* §7.3·49(b): la prioridad entre las entidades pedidas cuando no la sirve el plan de señales de riesgo (ver `_planCifraEntidad`): la misma oración de prioridad de un grupo, con la lente que de verdad ordenó, la medida propia nombrada, o la declaración de que la lente pedida no las ordena */
      if (plan.prioridadEntre && !plan._prioridadPorSenales) {
        const pe = plan.prioridadEntre, lg = pe.lenteGrupo;
        const idDe = (e, c) => (pe.porEntidadId.get(e) || new Map()).get(c);
        temasCubiertos.add(plan.tema);
        if (lg) for (const x of lg.filasExtra || []) entrega.cifras.filas.push(_fila(x.entidad, plan.tema, x.concepto, x.id));
        const prio = pe.prioridad;   /* FAMILIA 1: la decisión (modo · primero · qué se nombra) es de `prioridad.js`; acá solo se redacta */
        if (prio.modo === "lente") entrega.respuesta.push({ texto: `Prioridad del procedimiento dentro de este grupo, por ${lg.nombreVisible}: ${prio.primero}, con ${R(lg.idFig)} en ${lg.concepto}.`, hechos: [lg.idFig], _prioridad: _marcaGrupo(prio.primero) });
        else if (prio.modo === "sin-primero") entrega.respuesta.push({ ..._oracionLenteSinPrimero(lg, R, _listaDeNombres, ""), hechos: [...(lg.motivo === "sin-medida" ? pe.orden.map((e) => idDe(e, pe.claveOrden)).filter((x) => x != null) : [lg.idCero, lg.idEmpate].filter((x) => x != null))], _prioridad: _marcaGrupo(null) });
        else {
          const lenteTxt = resolucion.criterio ? _porLista(prio.nombra) : (_labelDeClave(pe.claveOrden) || "").toLowerCase();
          const _primeroPe = prio.primero;   /* §7.3·50(a) */
          const idPrimero = idDe(_primeroPe, pe.claveOrden);
          if (lenteTxt && idPrimero != null) entrega.respuesta.push({ texto: `Prioridad del procedimiento dentro de este grupo, por ${lenteTxt}: ${_primeroPe}, con ${R(idPrimero)} en ${(_labelDeClave(pe.claveOrden) || "").toLowerCase()}.`, hechos: [idPrimero], _prioridad: _marcaGrupo(_primeroPe) });
        }
      }
    } else if (plan.kind === "grupo") {
      // §7.3·17 (supervisor 2026-09-27, diagnóstico v8) — EL INVARIANTE EN TIEMPO REAL, no solo auditado después.
      // Antes, `entrega/verificar.js` regla 18 recalculaba esto mismo pero SOLO cuando el llamador le pasaba
      // `resolucion`/`indice` a mano — ningún camino real lo hacía, así que una `lectura`/`decision` con universo
      // propio podía servir `ok:true` con un conjunto distinto al que resuelve su propio universo, sin que nada lo
      // frenara (la raíz A2 del diagnóstico v8). ÚNICO LUGAR donde se aplica la DECISIÓN de declinar: se recalcula
      // el conjunto con la MISMA primitiva que usa el Notario (`conjuntoDeUniverso`, ya importada arriba) y, si el
      // conjunto que este plan va a servir (`plan.orden`) no coincide, la parte se declina ACÁ — nunca llega a
      // imprimir una fila de Cifras ni una oración de Respuesta. `verificarEntrega` (regla 18) sigue existiendo
      // como defensa en profundidad para quien la llame con `resolucion`/`indice` (los gates, la medición): audita
      // el mismo invariante con la misma función, nunca una segunda definición de "coincide".
      if ((plan.cierre === "lectura" || plan.cierre === "decision") && !plan.esFoto) {
        const uCheq = { eje: plan.eje, top: plan.universoDecl.top, base: plan.universoDecl.base, estados: plan.universoDecl.estados, no_estados: plan.universoDecl.no_estados, filtros: plan.universoDecl.filtros, bodega: plan.universoDecl.bodega, union: plan.universoDecl.union, excluir: plan.universoDecl.excluir };
        let Rchk = null;
        try { Rchk = conjuntoDeUniverso(uCheq, I, plan.eje, ""); } catch { Rchk = null; }
        if (Rchk && Rchk.set) {
          const servidas = new Set(plan.orden.map((n) => normalizar(n)));
          const fueraDelConjunto = [...servidas].filter((n) => !Rchk.set.has(n));
          // sin `top` no hay cola que declarar: lo servido tiene que ser EXACTO, ni de más ni de menos — mismo
          // criterio que ya usa `verificarEntrega` regla 18 (nunca una segunda ley).
          const tamanoNoCoincide = !plan.universoDecl.top && servidas.size !== Rchk.set.size;
          if (fueraDelConjunto.length || tamanoNoCoincide) {
            limitesGap.push({ titulo: `Sobre la parte ${plan.parteId} (${_DOM_NOMBRE[plan.tema] || plan.tema}), el conjunto servido no coincide con el universo declarado`, motivo: "El universo de esta parte se resolvió contra un conjunto distinto al que terminó sirviendo — se declina en vez de responder con el contenido de otra pregunta." });
            continue;
          }
        }
      }
      temasCubiertos.add(plan.tema);
      plan._servido = true;
      // A2 (diagnóstico v7, MATERIAL) — `_mapaDe` (guarda de archivo) evita el `.get()` sobre `undefined`: una
      // entidad de `plan.orden` puede llegar sin NINGUNA fig en `porEntidad` (el top verificado la agregó, pero
      // ninguna fig llegó para ella) — antes esto reventaba la Entrega ENTERA (Y26: "m is not iterable").
      for (const entidad of plan.orden) {
        const m = _mapaDe(plan.porEntidad, entidad);
        for (const [clave, id] of m) { if (id == null) continue; entrega.cifras.filas.push(_fila(entidad, plan.tema, rotuloDeLaCasa({ clave }).rotulo, id)); }
      }
      /* el total del listado completo (`declararTotalDelListado`): NO es una fila de la tabla ni se imprime; solo queda en `entrega.cifras.totales` para el libro y la respuesta compacta. `renderDe` directo: no cuenta como cifra impresa. */
      if (plan.totalesDelListado && plan.totalesDelListado.length) {
        const _nTot = plan.totalesDelListado[0].n;
        const _tot = plan.totalesDelListado.map((t) => ({ hecho: t.id, entidad: `Total del listado completo (${conteoDeEje(plan.eje, _nTot).texto})`, eje: plan.eje, metrica: rotuloDeLaCasa({ clave: t.clave }).rotulo, valor: renderDe(libro, t.id), procedencia: "derivado", tema: plan.tema }));
        entrega.cifras.totales = [...(entrega.cifras.totales || []), ..._tot];
      }
      /* v24 (barrido familia iii · composer ↔ verificador): en «breve» con TRES o más partes de grupo la cabeza de cada una cita UNA cifra (no tres): las cifras que las oraciones citan son filas protegidas de la tabla y el tope de filas de «breve» (8) las desbordaba (`verificarEntrega`: «filas-sobre-el-tope»). Con menos partes o en «completa» la cabeza es la de siempre. */
      /* §7.3·49(g): las entidades que la cabeza cita tienen su fila protegida en Cifras (doble colocación) y el corte NUNCA parte una entidad: todas sus filas van con ella. Con el tope de filas de la profundidad repartido entre las partes de grupo, la cabeza cita las entidades cuyas filas ENTERAS caben en la cuota de su parte (máximo tres; al menos una). Con tres o más partes en «breve» son una (la regla de la v24); una sola parte de dos conceptos cita tres */
      const _nCabeza = _nCabezaDe(plan);
      const cabeza = plan.orden.slice(0, _nCabeza).map((e) => { const id = _mapaDe(plan.porEntidad, e).get(plan.claveOrden); return id != null ? `${e} (${R(id)})` : e; }).join(", ");
      const idsCabeza = plan.orden.flatMap((e) => [..._mapaDe(plan.porEntidad, e).values()]).filter((v) => v != null);
      // «un top-N declara su cola» (ley del owner): con `universo.top`, el tamaño TOTAL del eje sale del mismo
      // índice que ya usan las 4 rutas fijas (`ejesDelTenant`) — nunca un número a mano; sin `top`, el listado YA
      // es el eje completo (no hay cola que declarar).
      const totalEje = ejesDelTenant[plan.eje] ? ejesDelTenant[plan.eje].length : null;
      /* §7.3·44a: un top cuyo filo cae DENTRO de un empate sirve a TODOS los empatados y lo declara: «El top 8 de 13 cliente, con 9 por el empate del filo (Tottus y Paris empatan en el puesto 8)». Nunca elige a uno ni declina el top. */
      const _empF = plan.empateFilo || null;
      const _nombresEmpF = _empF ? plan.orden.filter((e) => _empF.entidades.includes(normalizar(e))) : [];
      const _declaraEmpF = !!(_empF && _nombresEmpF.length > 1 && plan.universoDecl.top && totalEje != null);
      /* v21 (§7.3·44c): la foto de un productor con lista propia (la mesa de cobranza) que NO es todo el eje declara su cola: «la foto de cobranza (8 de 13 cuentas)», nunca un listado que parezca la cartera entera */
      const _fotoConCola = !!(plan.esFoto && totalEje != null && plan.orden.length < totalEje);
      /* ensayo 4 (owner 2026-10-07 · el anfitrión leyó «la foto de cobranza (8 de 12 cuentas)» como «la foto trae 8 de las 12 cuentas… no sé si faltan datos»: ADI no decía QUÉ eran el 8 y el 12). La cola dice, de cada caso, lo que es verdad —sin insinuar que falta un dato—:
       *  · la foto tiene N cuentas (lo dice la herramienta: las que lista + las que tiene y no lista) y esta lista MUESTRA k de ellas: «se muestran 8 de las 12 cuentas de la foto de cobranza» (las otras existen en la foto; se piden por nombre o con un listado propio);
       *  · la foto trae EXACTAMENTE las k que se listan y el eje tiene más: esas son todas las que figuran en la foto, las demás no figuran en ella;
       *  · la herramienta no dijo cuántas tiene la foto: el denominador es el del eje, como siempre (nunca se inventa el de la foto). */
      const _colaDeLaFoto = (() => {
        if (!_fotoConCola) return { texto: "", total: null };
        const dom = _DOM_NOMBRE[plan.tema] || plan.tema, k = plan.orden.length, fd = plan.fotoDatos || null;
        if (fd && fd.total <= k) return { texto: `se muestran las ${conteoDeEje(plan.eje, k).texto} que trae la foto de ${dom} (de ${conteoDeEje(plan.eje, totalEje).texto}); las demás no figuran en ella`, total: null };
        const N = fd ? fd.total : totalEje;
        return { texto: `se muestran ${k} de las ${conteoDeEje(plan.eje, N).texto} de la foto de ${dom}`, total: N };
      })();
      /* el orden de la mesa NO es el de la cifra que se muestra: se dice por cuál se ordena (la herramienta lo sabe: con plazo declarado, por saldo vencido; sin plazo, por saldo pendiente) */
      const _ordenDeLaMesaTxt = plan.ordenDeLaMesa ? (plan.fotoDatos ? `en el orden de la mesa (de mayor a menor ${plan.fotoDatos.ordenPor}), con` : "en el orden de la mesa, con") : "ordenado por";
      /* §7.3·39(c) · 46(f) (parte B, b): el empate del filo cuya cifra es 0 dice el cero en palabras de negocio junto a su cifra («no tienen días sin venta (0 días)»), la misma forma de la premisa de pertenencia; las cantidades solo (dinero, días, unidades) */
      const _unidadEmp = plan.claveOrden ? unidadDeClave(plan.claveOrden) : null;
      const _ceroEmpF = _declaraEmpF && _empF.valor === 0 && esCero(0, _unidadEmp)
        ? `; ${dichoElCero(String(_labelDeClave(plan.claveOrden) || plan.claveOrden).toLowerCase(), _unidadEmp === "money" ? "$0" : _unidadEmp === "days" ? diasEnPalabras(0) : "0").replace(/^no tiene\b/, "no tienen")}`
        : "";
      const prefijo = plan.universoDecl.top && totalEje != null
        ? `El top ${plan.universoDecl.top.k} de ${totalEje} ${plan.eje}${_declaraEmpF ? `, que sirve ${plan.orden.length} por el empate del filo (${_listaDeNombres(_nombresEmpF)} empatan en el puesto ${_empF.puesto}${_ceroEmpF})` : ""}`
        : _fotoConCola ? `Por ${plan.eje}, ${_colaDeLaFoto.texto}` : `Por ${plan.eje}`;
      if (_fotoConCola) { cifrasImpresas.push(String(plan.orden.length)); cifrasImpresas.push(String(totalEje)); if (_colaDeLaFoto.total != null) cifrasImpresas.push(String(_colaDeLaFoto.total)); }
      if (plan.universoDecl.top && totalEje != null) { cifrasImpresas.push(String(totalEje)); cifrasImpresas.push(String(plan.universoDecl.top.k)); if (_declaraEmpF) { cifrasImpresas.push(String(plan.orden.length)); cifrasImpresas.push(String(_empF.puesto)); } }
      /* §7.3·43(b) (v19, Y02): un orden servido con EMPATE declara el puesto compartido y quiénes lo comparten (`plan.empates`, calculado sobre el crudo al armar el plan). Va en la MISMA oración del orden: no agrega una oración
       * con hechos propios (que la protección cruzada de `tamano.js` leería como cifras a servir y movería filas de lugar); las cifras de los empatados ya viajan en esta oración y en la tabla. */
      const _listaDe = (xs) => (xs.length > 1 ? `${xs.slice(0, -1).join(", ")} y ${xs[xs.length - 1]}` : xs[0]);
      /* el empate del filo ya se dijo arriba (con su puesto): no se repite en esta línea */
      const _empatesPorDecir = plan.claveOrden && Array.isArray(plan.empates) ? plan.empates.filter((g) => !(_declaraEmpF && g.entidades.length === _nombresEmpF.length && g.entidades.every((e) => _nombresEmpF.includes(e)))) : [];
      const empateTxt = _empatesPorDecir.length
        ? ` Empate en el orden servido: ${_empatesPorDecir.map((g) => { cifrasImpresas.push(String(g.n)); return `puesto ${g.n} compartido por ${_listaDe(g.entidades)}`; }).join("; ")}.`
        : "";
      /* v21 (T100, §7.3·43b/44a): la oración que DECLARA un empate —el del filo («sirve 6 por el empate…») o el del orden servido («puesto 4 compartido por…»)— es un negativo obligatorio como una premisa: el tope de tamaño no la retira (`prioridad: 0`); antes, en un encargo de tres partes, iba al Detalle y el orden servido quedaba con el empate sin decir. La FOTO (sin universo propio) conserva la prioridad de siempre: el empate de sus ceros no desplaza a las lecturas por dominio */
      entrega.respuesta.push({ texto: `${prefijo}, ${_ordenDeLaMesaTxt} ${_labelDeClave(plan.claveOrden) || plan.claveOrden}: ${cabeza}.${empateTxt}`, hechos: idsCabeza, _entidadesCitadas: { tema: _NOMBRE_DE_TEMA(plan.tema), nombres: plan.orden.slice(0, _nCabeza) }, ...((_declaraEmpF || (empateTxt && !plan.esFoto) || _fotoConCola) ? { prioridad: 0 } : {}) });   /* v24 (Q13, §7.3·45a): la cola de la foto («8 de 13 cuentas») se declara también en «breve»: el tope de tamaño no la retira */
      // §7.3·17 (supervisor 2026-09-27, diagnóstico v8) — una `decision` sobre un universo propio calcula la
      // prioridad del procedimiento DENTRO de ese universo (nunca fuera, nunca con la lente de negocio del
      // dominio entero): el MISMO texto que ya usa el plan `grupoUniverso` unas líneas más abajo, aplicado acá
      // porque una parte con `top`/`base`/`bodega`/`union` propio ahora compone por ESTE camino («grupo»), no
      // por `_planMultiTema`. La cifra que sostiene «el primero» es la MISMA que ya ordenó el grupo (`claveOrden`,
      // ya declarada y renderizada arriba — nunca una segunda referencia).
      if (plan.cierre === "decision" && resolucion.criterio && plan.orden.length && !plan.esFoto) {
        const prio = plan.prioridad;   /* FAMILIA 1: la decisión (modo · primero · qué se nombra) es de `prioridad.js`; acá solo se redacta */
        const lenteTxt = _porLista(prio.nombra);   /* §7.3·46(d): la lente que de verdad ordenó la lista */
        const _primeroPrioridad = prio.primero;   /* §7.3·50(a): el de la prioridad, no el del ranking pedido */
        const idPrimero = plan.claveOrden ? _mapaDe(plan.porEntidad, _primeroPrioridad).get(plan.claveOrden) : null;
        /* v23: la lente que APLICA al dominio ordena la prioridad del grupo con su propia medida; si no distingue a nadie se declara, sin coronar a la primera de la lista */
        if (plan.lenteGrupo) for (const x of plan.lenteGrupo.filasExtra || []) entrega.cifras.filas.push(_fila(x.entidad, plan.tema, x.concepto, x.id));   /* la cifra de la lente que no era un concepto de la tabla también se pone en la tabla */
        if (prio.modo === "lente") { const idL = plan.lenteGrupo.idFig; entrega.respuesta.push({ texto: `Prioridad del procedimiento dentro de este grupo, por ${plan.lenteGrupo.nombreVisible}: ${prio.primero}, con ${R(idL)} en ${plan.lenteGrupo.concepto}.`, hechos: [idL], _prioridad: _marcaGrupo(prio.primero) }); }
        else if (prio.modo === "sin-primero") entrega.respuesta.push({ ..._oracionLenteSinPrimero(plan.lenteGrupo, R, _listaDeNombres, `; la lista se ordenó por ${(_labelDeClave(plan.claveOrden) || plan.claveOrden || "").toLowerCase()}: ${cabeza}`), hechos: [...(plan.lenteGrupo.motivo === "sin-medida" ? idsCabeza : [plan.lenteGrupo.idCero, plan.lenteGrupo.idEmpate].filter((x) => x != null))], _prioridad: _marcaGrupo(null) });
        else if (lenteTxt && idPrimero != null) entrega.respuesta.push({ texto: `Prioridad del procedimiento dentro de este grupo, por ${lenteTxt}: ${_primeroPrioridad}, con ${R(idPrimero)} en ${(plan.claveOrden ? _labelDeClave(plan.claveOrden) : lenteTxt).toLowerCase()}.`, hechos: [idPrimero], _prioridad: _marcaGrupo(_primeroPrioridad) });
        // §7.3 (SUPERVISOR, residual del diagnóstico v10 — X03.p3/X12.p1/X23.p3) — «la oración de prioridad
        // dentro del universo falta en kind "grupo" cuando la clave no tiene fig propia por entidad» (el ranking
        // SÍ llegó — `plan.orden[0]` es el ganador real, ya listado en «El top K de M» arriba — pero esa entidad
        // no publicó una fig propia para `claveOrden`, así que `idPrimero` es null). Antes, sin cifra propia, la
        // oración se omitía del todo y `prioridadEnUniverso` (que solo mira si ALGUNA oración del patrón nombra a
        // alguien de `deben`) terminaba atribuyéndole a esta parte la oración de OTRA parte del mismo encargo.
        // Mismo mecanismo que ya usa `kind:"grupoUniverso"` unas líneas más abajo (su rama `else if (lenteTxt)`,
        // que declara sin cifra propia, apoyada en el universo ya declarado) — extendido acá, no duplicado: se
        // apoya en el MISMO universo y las MISMAS cifras («El top K de M…», `idsCabeza`) que la oración de arriba
        // ya declaró, nunca una cifra nueva ni inventada.
        // El nombre va AL FINAL de la oración, a propósito: `verificarEntrega` (regla «dueño de cifra») le exige a
        // TODO número pegado DESPUÉS de un dueño nombrado que sea SUYO, y «2 de 13» son parámetros del universo
        // (top·tamaño del eje), no una cifra de `plan.orden[0]` — poniéndolos antes del nombre (como ya hace la
        // oración «El top K de M» de arriba) esa regla nunca los mira como si fueran de esta entidad.
        else if (lenteTxt && idsCabeza.length) entrega.respuesta.push({ texto: `Prioridad del procedimiento dentro de este grupo, por ${lenteTxt}: ${prefijo.charAt(0).toLowerCase()}${prefijo.slice(1)}, ordenado por ${(_labelDeClave(plan.claveOrden) || plan.claveOrden || lenteTxt).toLowerCase()}, lo encabeza ${_primeroPrioridad}.`, hechos: idsCabeza, _prioridad: _marcaGrupo(_primeroPrioridad) });
      }
      _declararUniverso(entrega, I, { id: plan.idUniverso || plan.parteId, eje: plan.eje, top: plan.universoDecl.top, base: plan.universoDecl.base, estados: plan.universoDecl.estados, no_estados: plan.universoDecl.no_estados, filtros: plan.universoDecl.filtros, excluir: plan.universoDecl.excluir, bodega: plan.universoDecl.bodega, union: plan.universoDecl.union, entidades: plan.orden });
    } else if (plan.kind === "comparacion") {
      temasCubiertos.add(plan.tema);
      plan._servido = true;
      for (const p of plan.pares) {
        entrega.cifras.filas.push(_fila(plan.a, plan.tema, p.concepto, p.idA));
        entrega.cifras.filas.push(_fila(plan.b, plan.tema, p.concepto, p.idB));
        if (p.idDiff) entrega.cifras.filas.push(_fila(`${plan.a} − ${plan.b}`, plan.tema, rotuloDeDiferencia({ clave: p.clave }), p.idDiff));   /* FAMILIA 4: «Diferencia · » + el rótulo del léxico del par */
      }
      for (const x of plan.sueltos || []) entrega.cifras.filas.push(_fila(x.entidad, plan.tema, x.concepto, x.id));   /* FAMILIA 2: la fila de un lado sin par */
      const _ladoCmp = (concepto, id, cero) => (cero ? dichoElCero(concepto.toLowerCase(), R(id)) : R(id));
      const frases = plan.pares.slice(0, 4).map((p) => `en ${rotuloEnOracion({ clave: p.clave })}, ${plan.a} ${_ladoCmp(p.concepto, p.idA, p.ceroA)} contra ${plan.b} ${_ladoCmp(p.concepto, p.idB, p.ceroB)}`);
      if (plan.pares.length) entrega.respuesta.push({ texto: `Comparando ${plan.a} y ${plan.b}: ${frases.join("; ")}.`, hechos: plan.pares.flatMap((p) => [p.idA, p.idB]) });
      _declararUniverso(entrega, I, { id: plan.parteId, eje: (resolucion.partes.find((p) => p.id === plan.parteId) || {}).eje || "cliente", entidades: [plan.a, plan.b] });
    } else if (plan.kind === "simulacion") {
      temasCubiertos.add(plan.tema);
      if (plan.sinConcepto) {
        // supuesto sin concepto de negocio nombrable — no debería llegar acá (validar.js ya lo declina antes),
        // defensivo: se declina la parte en vez de imprimir el tipo interno del sistema («custom») en prosa.
        limitesGap.push({ titulo: `Sobre la parte ${plan.parteId} (${_DOM_NOMBRE[plan.tema] || plan.tema}), el supuesto no declara un concepto de negocio`, motivo: "El tipo del supuesto no tiene un nombre de negocio en el registro (carga, costo, precio, volumen o margen) — se declina en vez de imprimir el tipo interno del sistema." });
      } else {
        // SIMULACIÓN Y SUPUESTO (garantía §1/§2, owner 2026-09-26; renombrado owner 2026-09-26 por
        // `_colapso_eje_gate` C4 — «el CONCEPTO visible "escenario" murió», ley 2026-08-07: el dato es UNA sola
        // realidad, Simulate v2 queda porque el "¿qué pasa si…?" es una pregunta del usuario, NUNCA un mundo
        // alterno permanente con nombre propio). En texto EMITIDO (prosa, encabezados, columnas y celdas) la
        // palabra es SIEMPRE «simulación» — «escenario» solo puede seguir viviendo en identificadores
        // ESTRUCTURALES que nunca se imprimen (`escenarioId`, `plan.supuesto.id`), nunca en una variable cuyo
        // VALOR se compone en el texto servido (por eso esta variable ya no se llama `escenarioTxt`). Hoy el
        // motor corre UN supuesto por parte, así que "simulación" y "supuesto" comparten identidad
        // (`plan.supuesto.id`): son dos campos DISTINTOS en la tabla (nunca se funden en uno) porque un motor
        // futuro con variantes múltiples los separaría sin cambiar esta forma. El rótulo es SIEMPRE el concepto
        // de negocio (`plan.fraseSupuesto`) — nunca «custom».
        // CORTE 3e (owner 2026-09-26) — «declarada por usted» → «declarada por la empresa» (tercera persona).
        // ETAPA 2 · BLOQUE 3 (owner 2026-10-03, decisión §7.3·58) — esa frase era FALSA: el supuesto de una simulación sale del encargo (lo planteó quien consulta), no de una declaración de la empresa.
        // El origen sale de la función única (`procedenciaDeSupuesto`: planteado en la consulta) y la frase de la tabla única, en femenino por «simulación»; nunca escrita a mano.
        const simulacionTxt = `Simulación ${etiquetaDeProcedencia(procedenciaDeSupuesto(), { genero: "f" })}`;
        const supuestoTxt = _capitaliza(plan.fraseSupuesto);
        const _valorSupuesto = plan.supuesto.unidad === "money" ? formatoDeLaCasa(Math.abs(plan.supuesto.valor), "money") : `${Math.abs(plan.supuesto.valor)}${plan.supuesto.unidad === "pct" ? "%" : plan.supuesto.unidad === "pp" ? " puntos" : ` ${plan.supuesto.unidad}`}`;
        cifrasImpresas.push(_valorSupuesto);

        // `prioridad` (opcional, default 0 — "Negocio" nunca se recorta: es el contexto compartido de TODOS los
        // bloques) — cuando se pasa, iguala la del bloque dueño de la fila (misma prioridad explícita que sus
        // oraciones, ver más abajo), para que `gobernarTamano` recorte fila+oración del mismo bloque JUNTAS.
        const _filaSim = (entidadTxt, etiqueta, id, prioridad = 0) => {
          const procedencia = _procedenciaDeFila(libro, [id]);
          // §7.3·39(e): en una Entrega MIXTA (la simulación comparte tabla con otro cierre) la tabla es la genérica —Entidad / grupo · Tema · Métrica · Valor · Tipo—: cada fila lleva SU dueño y su tema, y el
          // rótulo de la métrica dice de qué simulación y supuesto es (la fila sigue siendo indivisible). Con SOLO simulación, la tabla propia de siempre (sin cambio).
          const _valoresFila = _esSoloSimulacion
            ? { Entidad: entidadTxt, "Simulación": simulacionTxt, Supuesto: supuestoTxt, Métrica: rotuloDeSimulacion(etiqueta), Valor: R(id), Tipo: _textoDeTipo(procedencia) }   /* FAMILIA 4: el rótulo de la simulación es el de su productor (ningún artículo del contrato lo cubre) y pasa por `rotulos.js` sin cambio */
            : { "Entidad / grupo": entidadTxt, "Tema": _DOM_NOMBRE[plan.tema] || plan.tema, "Métrica": `${rotuloDeSimulacion(etiqueta)} (simulación: ${String(supuestoTxt).charAt(0).toLowerCase()}${String(supuestoTxt).slice(1)})`, "Valor": R(id), "Tipo": _textoDeTipo(procedencia) };
          return { valores: _valoresFila, hechos: [id], procedencia, entidad: entidadTxt === "Negocio" ? "negocio" : entidadTxt, escenarioId: plan.supuesto.id, supuestoId: plan.supuesto.id, prioridad };
        };

        // LÉXICO DE LA CASA (owner 2026-09-26, ronda final del corte) — la tabla de una simulación sirve SOLO
        // filas con PAPEL DE NEGOCIO: la REFERENCIA (benchmark/umbral declarado — UNA vez por concepto, nunca
        // repetida entre "Negocio" y una entidad), los PARES base↔resultado, el IMPACTO en $ (liberado/
        // comprometido, por entidad) y el DELTA. Todo lo demás — «Lectura relativa descartada», «movimiento de
        // carga» (duplica la columna Supuesto), un «total» agregado que duplica el impacto de la única entidad en
        // alcance — es jerga interna del motor: no le dice nada al LLM y puede inducirlo a error. Se descarta y
        // se cuenta en `meta.descartadasJergaInterna`, nunca se sirve.
        // la CLAVE de dedup es por CONCEPTO CANÓNICO, no por texto exacto — «Benchmark» y «Benchmark de margen»
        // son la MISMA referencia con dos redacciones (dos composers distintos la nombran distinto); si se
        // dedupara por texto exacto, la variante corta se colaría como si fuera otra referencia (el defecto
        // medido: D27 servía "Benchmark de margen" en Negocio Y "Benchmark" en Falabella, duplicados).
        const _ES_IMPACTO_SIM = (c) => /^(liberad[oa]|comprometid[oa]|liberable)$/i.test(String(c || "").trim());
        const _CLAVE_REFERENCIA_SIM = (c) => {
          const s = String(c || "").trim().toLowerCase();
          if (/^benchmark\b/.test(s)) return "benchmark";
          if (/^rotaci[oó]n m[ií]nima$/.test(s)) return "rotacion_minima";
          if (/^cobertura m[aá]xima$/.test(s)) return "cobertura_maxima";
          return null;
        };
        const _referenciasServidas = new Set();   // clave canónica → ya se sirvió una vez
        const _referenciaServible = (item) => {
          const clave = _CLAVE_REFERENCIA_SIM(item.concepto);
          if (!clave || _referenciasServidas.has(clave)) return false;
          _referenciasServidas.add(clave);
          return true;
        };
        let descartadasJergaInterna = 0;

        // NEGOCIO — SOLO la(s) referencia(s) (benchmark, umbrales de la política): el resto (montos agregados,
        // el supuesto repetido) es jerga interna. SIEMPRE prioridad 0: es el contexto de todos los bloques.
        const negocioServible = [...plan.negocio.base, ...plan.negocio.resultado].filter((item) => {
          const ok = _referenciaServible(item);
          if (!ok) descartadasJergaInterna++;
          return ok;
        });
        for (const item of negocioServible) entrega.cifras.filas.push(_filaSim("Negocio", item.concepto, item.id));

        // léxico DE ARTÍCULOS para «comparables juntas» (owner 2026-09-26) — género gramatical de los conceptos
        // que hoy nombran los productores de simulación; por defecto "el" (más frecuente en el léxico de la casa).
        const _GENERO_CONCEPTO = { margen: "el", carga: "la", costo: "el", "contribución": "la", venta: "la", volumen: "el", precio: "el" };
        const _articulo = (concepto) => _GENERO_CONCEPTO[String(concepto || "").toLowerCase()] || "el";

        // BLOQUES — uno por entidad del universo pedido. Garantía §2/§(ii): el encabezado nombra ENTIDAD +
        // ESCENARIO + SUPUESTO una sola vez; el cuerpo del bloque hereda ese alcance y no lo repite — el LLM narra
        // con libertad dentro del bloque, y solo vuelve a nombrar la entidad si cita algo de OTRO bloque.
        if (plan.bloques.length) entrega._simulacionConBloques = true;
        for (const [i, bloque] of plan.bloques.entries()) {
          const bloqueId = `sim_${plan.parteId}_${i}`;
          // FILAS — pares (base + resultado, ambos con papel de negocio), resultados sueltos (sin base que
          // contrastar — ej. simulateCapital), impacto/referencia entre lo que quedó sin par; el resto se descarta.
          for (const p of bloque.pares) {
            entrega.cifras.filas.push(_filaSim(bloque.entidad, p.base.concepto, p.base.id, i));
            entrega.cifras.filas.push(_filaSim(bloque.entidad, p.resultado.concepto, p.resultado.id, i));
          }
          for (const r of bloque.resultadoSueltos) entrega.cifras.filas.push(_filaSim(bloque.entidad, r.concepto, r.id, i));
          for (const b of bloque.baseSinPar) {
            if (_ES_IMPACTO_SIM(b.concepto) || _referenciaServible(b)) entrega.cifras.filas.push(_filaSim(bloque.entidad, b.concepto, b.id, i));
            else descartadasJergaInterna++;
          }
          if (bloque.idDelta) entrega.cifras.filas.push(_filaSim(bloque.entidad, `Delta · ${_capitaliza(bloque.deltaConcepto)}`, bloque.idDelta, i));
          // 38(c): la conversión del monto a % de la venta del período cerrado (citada en el encabezado) va también en la tabla — un hecho citado en la respuesta no puede faltar en Cifras (regla de doble colocación)
          if (bloque.idConversion) entrega.cifras.filas.push(_filaSim(bloque.entidad, "Volumen equivalente al crecimiento en dinero, a precio constante", bloque.idConversion, i));

          // ENCABEZADO — cita un hecho REAL y SERVIDO (la referencia si existe; si no, el primer par o resultado
          // suelto del bloque) para que la regla «oración con cifra» (verificar.js regla 2) se cumpla sin
          // depender de una fig de jerga interna que ya no se sirve.
          const hechosEncabezado = negocioServible[0] ? [negocioServible[0].id]
            : bloque.pares[0] ? [bloque.pares[0].resultado.id]
            : bloque.resultadoSueltos[0] ? [bloque.resultadoSueltos[0].id]
            : bloque.baseSinPar.slice(0, 1).map((b) => b.id);
          const _fraseTieneCifra = /\d/.test(plan.fraseSupuesto);
          const _citaValor = !_fraseTieneCifra && hechosEncabezado.length ? ` (${R(hechosEncabezado[0])})` : "";
          // CORTE 3d.3 (owner 2026-09-26) — PRIORIDAD EXPLÍCITA: el encabezado y el cuerpo de un MISMO bloque
          // comparten la MISMA `.prioridad` (el índice del bloque — el primero es 0, «la conclusión», nunca
          // recortable) para que `entrega/tamano.js:gobernarTamano` los trate como una unidad ATÓMICA: un bloque
          // se sirve entero o se recorta entero a `detalle`, nunca un encabezado huérfano sin su resultado (el
          // defecto medido al gobernar D27 con el fallback por índice, antes de esta prioridad explícita).
          // el encabezado nombra la pieza por lo que ES — «simulación» (owner 2026-09-26, `_colapso_eje_gate`
          // C4) — nunca «escenario declarado por usted»: «Falabella — simulación: la carga comercial baja 1
          // punto», no un mundo alterno con nombre propio, la pregunta «¿qué pasa si…?» del usuario.
          // 38(c): la conversión del monto a % de la venta del período cerrado se declara EN el encabezado, como parte del supuesto («a precio constante»)
          const _conversion = bloque.idConversion ? `, que equivale a ${R(bloque.idConversion)} de su venta del año cerrado, a precio constante` : "";
          entrega.respuesta.push({
            texto: `${bloque.entidad} — simulación: ${plan.fraseSupuesto}${_conversion}${_citaValor}.`,
            hechos: bloque.idConversion ? [...hechosEncabezado, bloque.idConversion] : hechosEncabezado, _bloqueId: bloqueId, _bloqueEncabezado: true, _simulacion: true, prioridad: i,
            _bloqueMeta: { entidad: bloque.entidad, escenarioId: plan.supuesto.id, supuestoId: plan.supuesto.id },
          });

          // CUERPO — COMPARABLES JUNTAS (ley del plan LLMBusiness, owner 2026-09-26): cada resultado viaja con SU
          // base, en la MISMA cláusula («el margen pasaría de 22,0 % a 23,0 %»), nunca «margen supuesto» como
          // sujeto suelto sin decir desde dónde. El delta se pega al par que lo trae, entre paréntesis. Los
          // resultados sin base propia (simulateCapital) caen a «concepto pasaría a valor», la única forma que el
          // dato sostiene cuando no hay un "antes" que contrastar.
          const frasesPares = bloque.pares.map((p, pi) => {
            const art = _articulo(p.concepto);
            const esDelta = bloque.idDelta && p.concepto === bloque.deltaConcepto;
            const baseTxt = R(p.base.id), resultadoTxt = R(p.resultado.id);
            // AGREGADO (supervisor, revisión de cierre del 3d, 2026-09-26) — un par base↔resultado IDÉNTICO nunca
            // se narra «de X a X» (afirma un cambio que el dato no sostiene): se declara «se mantiene en X».
            const sinCambio = baseTxt != null && baseTxt === resultadoTxt;
            const rango = sinCambio
              ? `se mantiene en ${resultadoTxt}${esDelta ? ` (${R(bloque.idDelta)})` : ""}`
              : `de ${baseTxt} a ${resultadoTxt}${esDelta ? ` (${R(bloque.idDelta)})` : ""}`;
            if (sinCambio) return pi === 0 ? `${art} ${p.concepto} ${rango}` : `${art} ${p.concepto}, ${rango}`;
            return pi === 0 ? `${art} ${p.concepto} pasaría ${rango}` : `${art} ${p.concepto}, ${rango}`;
          });
          const frasesSueltas = bloque.resultadoSueltos.map((r) => `${r.concepto.toLowerCase()} pasaría a ${R(r.id)}`);
          const cuerpoPartes = [...frasesPares, ...frasesSueltas];
          const textoCuerpo = cuerpoPartes.length ? `${_capitaliza(cuerpoPartes.join("; "))}.` : "No hay una cifra propia de esta simulación.";
          entrega.respuesta.push({
            texto: textoCuerpo,
            hechos: [...bloque.pares.flatMap((p) => [p.base.id, p.resultado.id]), ...bloque.resultadoSueltos.map((r) => r.id), bloque.idDelta].filter(Boolean),
            _bloqueId: bloqueId, _simulacion: true, prioridad: i,
          });
          if (bloque.sinDelta) entrega.limites.push({ titulo: `El delta contra lo real no se pudo aislar como cifra propia (${bloque.entidad})`, motivo: "La simulación no publicó una cifra 'base' con el mismo concepto que el resultado: se declara la base y el resultado por separado, sin restar a mano." });
        }
        // CORTE 3e (owner 2026-09-26) — «lo declaró usted» → «lo declaró la empresa».
        entrega.limites.push({ titulo: "Esta simulación es un resultado hipotético, no lo que ya ocurrió", motivo: `El supuesto fue ${etiquetaDeProcedencia(procedenciaDeSupuesto())}; ADI calcula el efecto sobre el dato real, pero no afirma que vaya a pasar.` });
        if (plan.descartadasFueraDeUniverso) entrega._simulacionDescartadas = (entrega._simulacionDescartadas || 0) + plan.descartadasFueraDeUniverso;
        if (descartadasJergaInterna) entrega._simulacionDescartadasJerga = (entrega._simulacionDescartadasJerga || 0) + descartadasJergaInterna;
        // el universo pedido de ESTA simulación, para que `verificar.js` regla 14 audite «ninguna fila fuera del
        // universo pedido» SIN depender de que el llamador acuerde pasarle `partes` (que ya tiene otro dueño:
        // regla 11, cobertura de dominios, con una forma de parte distinta — nunca se comparten los dos usos).
        if (plan.universoPedido) entrega._simulacionUniverso = [...(entrega._simulacionUniverso || []), ...plan.universoPedido];
        // CASO Y81 (SUPERVISOR, diagnóstico v11, tarea 2 — «la parte declara el universo de sus entidades, igual
        // que las demás partes con entidades puntuales») — `kind:"simulacion"` era el ÚNICO tipo de plan que
        // nunca llamaba a `_declararUniverso` (a diferencia de "entidad"/"grupo"/"comparacion"/"grupoUniverso"/
        // "multitema", que sí se declaran — ver la nota en `kind:"multitema"` más abajo). Mientras el encargo es
        // SOLO simulación (`_esSoloSimulacion`, más abajo), la ausencia pasaba inadvertida porque la regla 15 de
        // `verificar.js` (`alcance-fuera-de-parte`) se EXCLUYE a sí misma para la tabla de simulación (columnas
        // "Simulación"+"Supuesto") y delega en su propio candado (regla 14(d), contra `entrega._simulacionUniverso`,
        // ya poblado arriba). Pero un encargo MIXTO (esta simulación + una parte de otro dominio, ej. inventario)
        // usa las columnas GENÉRICAS de Cifras — la regla 15 SÍ corre, y sin esta declaración una entidad puntual
        // simulada (SAM-TV55) tenía cifra propia sin que NINGUNA parte del encargo autorizara su alcance: la fila
        // era correcta, el candado de alcance no tenía cómo saberlo. Se declara con el MISMO mecanismo que
        // cualquier otra parte de entidad puntual — solo cuando la simulación restringe a entidades nombradas
        // (`plan.universoPedido`); una simulación de cartera entera (sin entidad, todo "Negocio") no necesita
        // autorizar nada — esas filas ya están exentas (regla 15, verificar.js, dueño "Negocio").
        if (plan.universoPedido && plan.universoPedido.length) {
          const parteSim = (resolucion.partes || []).find((pp) => pp.id === plan.parteId);
          _declararUniverso(entrega, I, { id: plan.parteId, eje: (parteSim && parteSim.eje) || "cliente", entidades: plan.universoPedido });
        }
      }
    } else if (plan.kind === "definicion") {
      temasCubiertos.add(plan.tema);
      const texto = `${plan.concepto}: ${plan.definicion}${plan.distingue ? ` ${plan.distingue}` : ""}`;
      for (const c of cifrasEnTexto(texto)) cifrasImpresas.push(c);   /* FAMILIA 5 (§7.3·48d): una definición nunca lee la boleta (§1.1): las cifras de su prosa («de cada $1 de venta») son de la definición, la unidad con que se explica el concepto, no una medición desnuda; se declaran con el mismo escáner de la regla 1 */
      entrega.respuesta.push({ texto, hechos: [], _definicion: true });
    } else if (plan.kind === "grupoUniverso") {
      // CORTE 3c · pieza 1 — EL GRUPO ES EL HECHO `conteo` (K de M, ya verificado): la Respuesta y las Cifras solo
      // RENDERIZAN lo que ese hecho ya declaró, nunca listan un miembro que el conteo no cuenta.
      temasCubiertos.add(plan.tema);
      plan._servido = true;
      const kTxt = R(plan.idConteo), mTxt = renderDe(libro, plan.idConteo, "m"), uTxt = renderDe(libro, plan.idConteo, "universo");
      if (mTxt != null) cifrasImpresas.push(mTxt);
      if (uTxt != null) cifrasImpresas.push(uTxt);   /* FAMILIA 5 (§7.3·48d): el universo se imprime tal como lo escribió el hecho `conteo` ya verificado, con el valor de cada condición («con venta a crédito de al menos $1K»): sus cifras son del hecho, no desnudas */
      const claveTentTxt = plan.claveTentacion ? _labelDeClave(plan.claveTentacion) : null;
      const tentacion = plan.idTotal ? ` En conjunto, ${claveTentTxt ? _sinSufijoDolar(claveTentTxt).toLowerCase() : "el total"} suma ${R(plan.idTotal)}${plan.idShare ? `; ${plan.miembros[0]} concentra el ${R(plan.idShare)}` : ""}.` : "";
      const texto = `Sobre ${_DOM_NOMBRE[plan.tema] || plan.tema}: hay ${kTxt}${mTxt ? ` de ${mTxt}` : ""} en ${uTxt || "el universo declarado"}${plan.miembros.length ? `: ${plan.miembros.join(", ")}` : ""}.${tentacion}`;
      entrega.respuesta.push({ texto, hechos: [plan.idConteo, plan.idTotal, plan.idShare].filter(Boolean) });
      // A2 (diagnóstico v7): `_mapaDe` (guarda de archivo), mismo criterio que `kind:"grupo"` más arriba.
      for (const nombre of plan.miembros) {
        const m = _mapaDe(plan.porEntidad, nombre);
        for (const [clave, id] of m) { if (id == null) continue; entrega.cifras.filas.push(_fila(nombre, plan.tema, rotuloDeLaCasa({ clave }).rotulo, id)); }
      }
      if (plan.idTotal) {
        const procedenciaTotal = _procedenciaDeFila(libro, [plan.idTotal]);
        entrega.cifras.filas.push({ valores: { "Entidad / grupo": `Total (${plan.n} ${plan.eje})`, "Tema": _DOM_NOMBRE[plan.tema] || plan.tema, "Métrica": claveTentTxt || "", "Valor": R(plan.idTotal), "Tipo": _textoDeTipo(procedenciaTotal, { subtotal: true }) }, hechos: [plan.idTotal], procedencia: procedenciaTotal });
      }
      // decision (D19): la conclusión sale del análisis — el criterio ya resuelto por `validarEncargo` (nunca
      // una premisa del usuario) decide quién abre la fila; la cifra que sostiene «el primero» es la MISMA que
      // ya ordenó el grupo (`claveOrden`, ya declarada y renderizada arriba — nunca una segunda referencia).
      if (plan.cierre === "decision" && resolucion.criterio && plan.miembros.length) {
        const prio = plan.prioridad;   /* FAMILIA 1: la decisión (modo · primero · qué se nombra) es de `prioridad.js`; acá solo se redacta */
        const lenteTxt = _porLista(prio.nombra);   /* §7.3·46(d): la lente que de verdad ordenó la lista */
        const _primeroPrioridad = prio.primero;   /* §7.3·50(a): el de la prioridad (quien pide atención), no el primero de la lista */
        const idPrimero = plan.claveOrden ? _mapaDe(plan.porEntidad, _primeroPrioridad).get(plan.claveOrden) : null;
        /* v23: la lente que APLICA al dominio ordena la prioridad del grupo con su propia medida; si no distingue a nadie se declara, sin coronar a la primera de la lista */
        if (plan.lenteGrupo) for (const x of plan.lenteGrupo.filasExtra || []) entrega.cifras.filas.push(_fila(x.entidad, plan.tema, x.concepto, x.id));   /* la cifra de la lente que no era un concepto de la tabla también se pone en la tabla */
        if (prio.modo === "lente") { const idL = plan.lenteGrupo.idFig; entrega.respuesta.push({ texto: `Prioridad del procedimiento dentro de este grupo, por ${plan.lenteGrupo.nombreVisible}: ${prio.primero}, con ${R(idL)} en ${plan.lenteGrupo.concepto}.`, hechos: [plan.idConteo, idL], _prioridad: _marcaGrupo(prio.primero) }); }
        else if (prio.modo === "sin-primero") { const o = _oracionLenteSinPrimero(plan.lenteGrupo, R, _listaDeNombres, ` (${kTxt} de ${mTxt} en ${uTxt})`); entrega.respuesta.push({ texto: o.texto, hechos: [plan.idConteo, ...o.hechos], _prioridad: _marcaGrupo(null) }); }
        else if (lenteTxt && idPrimero != null) entrega.respuesta.push({ texto: `Prioridad del procedimiento dentro de este grupo, por ${lenteTxt}: ${_primeroPrioridad}, con ${R(idPrimero)} en ${(plan.claveOrden ? _labelDeClave(plan.claveOrden) : lenteTxt).toLowerCase()}.`, hechos: [plan.idConteo, idPrimero], _prioridad: _marcaGrupo(_primeroPrioridad) });
        else if (lenteTxt) entrega.respuesta.push({ texto: `Prioridad del procedimiento dentro de este grupo, por ${lenteTxt}: ${_primeroPrioridad} (${kTxt} de ${mTxt} en ${uTxt}).`, hechos: [plan.idConteo], _prioridad: _marcaGrupo(_primeroPrioridad) });
      }
      _declararUniverso(entrega, I, { id: plan.parteId, eje: plan.eje, top: (plan.universo && plan.universo.top) || null, base: (plan.universo && plan.universo.base) || null, filtros: (plan.universo && plan.universo.filtros) || null, excluir: (plan.universo && plan.universo.excluir) || null, estados: (plan.universo && plan.universo.estados) || null, no_estados: (plan.universo && plan.universo.no_estados) || null, entidades: plan.miembros });
    } else if (plan.kind === "multitema") {
      // R-INICIATIVA-UNIVERSO-NO-ENTIDADES / V81 (diagnóstico v6, coordinador 2026-09-26/27) — un plan degradado
      // (`_planMultiTema` sin señal de riesgo en el universo restringido) no dice nada por sí solo: se declara
      // como límite, nunca como silencio — «declina honestamente cuenta como éxito» (CLAUDE.md §5). EN LENGUAJE
      // DE NEGOCIO, sin nombrar ningún archivo, y SIN afirmar un negativo que la boleta no prueba (ley de
      // materialidad del owner: señal · bajo el piso · sin evaluar — jamás «no ocurre»/«no tiene X»; una cuenta con
      // una señal chica bajo el piso SIGUE teniendo esa cifra, solo que no alcanza para priorizar).
      if (plan.sinSenal) {
        const nombresDom = plan.temas.map((d) => { const n = _DOM_NOMBRE[d] || d; return n.charAt(0).toUpperCase() + n.slice(1); });
        const sinEvaluar = plan.temas.filter((d) => plan.estadoPorDominio && plan.estadoPorDominio[d] === "sin_evaluar");
        const bajoPiso = plan.temas.filter((d) => !sinEvaluar.includes(d));
        const partesMotivo = [];
        if (bajoPiso.length) partesMotivo.push("Ninguna de ellas supera el piso de materialidad en los criterios de prioridad.");
        for (const d of sinEvaluar) { const n = _DOM_NOMBRE[d] || d; partesMotivo.push(`${n.charAt(0).toUpperCase() + n.slice(1)}: sin evaluar — el dato no trae esa lectura para estas cuentas en este recorte.`); }
        limitesGap.push({ titulo: `Sobre ${nombresDom.join(" y ")}, no se establece una prioridad entre dominios para las cuentas pedidas`, motivo: partesMotivo.join(" ") });
      }
      const frase = (dominio, lente, ids) => (ids && ids[lente]) ? LENTES[dominio][lente].como(R(ids[lente])) : null;
      const filasVistas = new Set();   // dedup: idsIntegrada/idsVersus pueden repetir la MISMA señal que ya declaró `lideres` (mismo id, cacheado en `_planMultiTema`)
      // CANDADO DE ALCANCE (diagnóstico v2, supervisor 2026-09-26, punto 2) — «la conclusión del procedimiento: la
      // prioridad integrada nombra a quien va primero, SOLO si la parte es de cartera entera» es la ley que
      // autoriza estas filas (el líder de cada dominio, el ganador de la integrada, el rival del «va antes que»):
      // ninguna la traía registrada en `entrega.universos` (a diferencia de TODOS los demás `kind` de plan, que sí
      // se declaran) — se acumulan acá y se declaran una vez, abajo, para que `verificarEntrega` pueda auditarlas
      // igual que a cualquier otra fila (nunca una excepción por AUSENCIA de universo, que es justo el hueco que
      // dejaba pasar R1/R2 sin que nada lo viera venir).
      const entidadesMultitema = new Set();
      const _filaDedup = (entidad, dominio, etiqueta, id) => { entidadesMultitema.add(entidad); const k = `${dominio}::${entidad}::${id}`; if (filasVistas.has(k)) return; filasVistas.add(k); entrega.cifras.filas.push(_fila(entidad, dominio, etiqueta, id)); };
      // CORTE 3d.3 (owner 2026-09-26) — PRIORIDAD EXPLÍCITA (ley: «se recorta por la prioridad del procedimiento,
      // nunca por el orden de aparición»): la CONCLUSIÓN INTEGRADA («Prioridad del procedimiento…», el veredicto
      // de `prioridadIntegrada`, CLAUDE.md §2 ley 4) es SIEMPRE prioridad 0 — la única que `gobernarTamano` nunca
      // puede recortar, aunque no sea la primera oración escrita. Las lecturas POR DOMINIO (una por tema, antes de
      // la integrada) llevan prioridad 1..N en el orden en que el procedimiento las declaró (`plan.temas`); las
      // menciones adicionales (comparativo «va antes que», concentración de cobranza) van DESPUÉS de todas —
      // son apoyo, no la conclusión ni las lecturas por dominio.
      // §7.3·22 (supervisor 2026-09-27, diagnóstico v9) — `_soloAgregado` marca el plan cruzado que se agrega
      // ENCIMA de partes que ya tienen su propio contenido (`_planCifraGrupo`, arriba): la línea «en {dominio},
      // quien más pesa es…» duplicaría lo que esas partes ya sirvieron con su propio universo — se omite SOLO
      // acá; la prioridad cruzada («Prioridad del procedimiento, por riesgo integrado…», más abajo) y el límite
      // «sin señal» SÍ se agregan siempre, sea `_soloAgregado` o no.
      let _ultimaLineaDeDominio = null;
      if (!plan._soloAgregado) for (const [di, d] of plan.temas.entries()) {
        temasCubiertos.add(d);
        const L = plan.lideres[d];
        if (!L) continue;
        const partesFrase = ["materialidad", "severidad", "urgencia"].map((l) => frase(d, l, L.ids)).filter(Boolean);
        // tentación precalculada (mecanismo 6): la ventaja del líder sobre el segundo, cuando este dominio es el
        // que la trae (ver `versusLider` en `_planMultiTema`) — la MISMA fila que ya se declaró, citada acá.
        const vs = plan.versusLider && plan.versusLider.dominio === d ? plan.versusLider : null;
        const claveVs = vs ? [vs.idDiff] : [];
        const clausulaVs = vs ? ` — ${R(vs.idDiff)} más que ${vs.segundo}` : "";
        /* §7.3·57(c): en un encargo mixto, la parte de este dominio donde la lente pedida no aplica la declara (50b), con la misma cláusula de siempre */
        const _noAplicaAqui = plan.porLentePorParte && plan.porLentePorParte.find((x) => x.tema === d && x.lenteNoAplica);
        const _declLenteParte = _noAplicaAqui ? ` El criterio pedido (${nombreVisibleDeLente(_noAplicaAqui.lenteNoAplica, d) || _noAplicaAqui.lenteNoAplica}) no ordena este conjunto con la evidencia disponible: esta es la lectura de riesgo integrado del procedimiento.` : "";
        const _itemDominio = { texto: `En ${_DOM_NOMBRE[d]}, quien más pesa es ${L.x.entidad}: ${partesFrase.join(", ")}${clausulaVs}.${_declLenteParte}`, hechos: [...Object.values(L.ids).filter(Boolean), ...claveVs], prioridad: di + 1 };
        entrega.respuesta.push(_itemDominio);
        _ultimaLineaDeDominio = _itemDominio;
        for (const [lente, id] of Object.entries(L.ids)) if (id != null) _filaDedup(L.x.entidad, d, rotuloDeSenal(LENTES[d][lente].nombre), id);   /* FAMILIA 4 (§7.3·52e): las filas de la tabla de señales conservan el rótulo de su señal */
        if (vs) _filaDedup(`${vs.entidad} − ${vs.segundo}`, d, rotuloDeDiferenciaDeSenal("materialidad"), vs.idDiff);
      }
      if (plan._soloAgregado) for (const d of plan.temas) temasCubiertos.add(d);
      /* v24 (barrido familia ii · §7.3·46d + 47): un conjunto SIN prioridad cruzada (un solo dominio de SKU: «los SKU van aparte», `plan.top` nulo) también respeta el criterio del usuario: la lente que APLICA al dominio se nombra con su cifra («por capital: …»); la que no lo ordena se DECLARA (nunca se ignora en silencio) — la misma declaración de la prioridad cruzada */
      if (!plan.top && plan.conDecision) {
        /* FAMILIA 1: qué oración se dice lo decide `prioridad.js:modoDeLaCruzada` (`plan.prioridad.modo`); acá solo se redacta. §7.3·52(a): en cobranza «ventas» se dice «venta a crédito» */
        const _nomLente0 = (id, tema = (plan.temaDeLaParte || null)) => nombreVisibleDeLente(id, tema) || id;   /* 55(b): el nombre de la lente es de la parte que decide */
        if (plan.prioridad.modo === "por-lente") {
          /* §7.3·57(c): una oración por parte que decide (cada una con el nombre de SU lente); con una sola parte, la de siempre */
          for (const PL of (plan.porLentePorParte ? plan.porLentePorParte.map((x) => x.porLente).filter(Boolean) : [plan.porLente])) {
            /* FAMILIA 4 (§7.3·49f · 52a): la medida de la lente se rotula con el rótulo del léxico de SU concepto («Venta a crédito», «Variación vs año anterior»), en la oración y en la fila; nunca el del productor («Venta (flujo)», «YoY») */
            entrega.respuesta.push({ texto: `Prioridad del procedimiento, por ${_nomLente0(PL.lente, PL.temaDeLaParte || PL.dominio)}: ${PL.entidad}, con ${R(PL.id)} en ${rotuloEnOracion({ concepto: PL.metrica })}.`, hechos: [PL.id], prioridad: 0, _prioridad: marcaDePrioridad(ALCANCE_DE_PRIORIDAD.DOMINIO, PL.entidad) });
            _filaDedup(PL.entidad, PL.dominio, rotuloDeLaCasa({ concepto: PL.metrica }).rotulo, PL.id);
          }
        } else if (plan.prioridad.modo === "lente-no-aplica" && _ultimaLineaDeDominio) {
          _ultimaLineaDeDominio.texto = `${_ultimaLineaDeDominio.texto} El criterio pedido (${_nomLente0(plan.lenteNoAplica)}) no ordena este conjunto con la evidencia disponible: esta es la lectura de riesgo integrado del procedimiento.`;
        } else if (plan.prioridad.modo === "riesgo-pedido") {
          /* el «riesgo integrado» que el usuario pidió sobre UN dominio (sin prioridad cruzada) se dice como tal, con las mismas cifras del líder del dominio */
          const d0 = plan.temas[0], L0 = plan.lideres[d0];
          const partes0 = ["materialidad", "severidad", "urgencia"].map((l) => frase(d0, l, L0.ids)).filter(Boolean);
          if (partes0.length) entrega.respuesta.push({ texto: `Prioridad del procedimiento, por riesgo integrado: ${L0.x.entidad} (${_DOM_NOMBRE[d0]}: ${partes0.join("; ")}).`, hechos: Object.values(L0.ids).filter(Boolean), prioridad: 0, _prioridad: marcaDePrioridad(ALCANCE_DE_PRIORIDAD.DOMINIO, L0.x.entidad) });
        }
      }
      if (plan.top && plan.idsIntegrada) {
        const partesTop = [];
        for (const d of Object.keys(plan.idsIntegrada)) for (const l of ["materialidad", "severidad", "urgencia"]) { const t = frase(d, l, plan.idsIntegrada[d]); if (t) partesTop.push(`${_DOM_NOMBRE[d]}: ${t}`); for (const [ll, id] of Object.entries(plan.idsIntegrada[d])) if (id != null) _filaDedup(plan.top.entidad, d, rotuloDeSenal(LENTES[d][ll].nombre), id); }
        const coincide = plan.top.dominios.length > 1 ? ` — coincide en ${plan.top.dominios.map((dd) => _DOM_NOMBRE[dd]).join(" y ")}` : "";
        const prefijoDecision = plan.conDecision ? "Prioridad del procedimiento" : "Quien más pesa en el conjunto";
        // «con otra lente cambia quién va primero» (decision, criterio declarado) — CLÁUSULA de la MISMA oración,
        // no una oración aparte: una oración sin cifra propia rompe la regla «dueño + métrica + valor» del plan.
        /* v22 (S31 · S16): la lente que el usuario pidió gobierna la prioridad — «el criterio del usuario manda». Con `porLente` la oración es la de esa lente (cifra con su hecho) y NO se dice «por riesgo integrado» ni «con otra lente cambia»;
         * sin orden posible para esa lente, la prioridad de riesgo integrado DECLARA que el criterio pedido no se pudo aplicar (nunca lo sustituye en silencio). */
        const _nomLente = (id, tema = (plan.temaDeLaParte || null)) => nombreVisibleDeLente(id, tema) || id;   /* §7.3·52(a) + 55(b): «venta a crédito» solo en una parte de cobranza; el nombre es de la parte que decide, no del encargo */
        const cierreLente = !plan.conDecision ? "" : plan.lenteNoAplica ? ` El criterio pedido (${_nomLente(plan.lenteNoAplica)}) no ordena este conjunto con la evidencia disponible: esta es la lectura de riesgo integrado del procedimiento.` : " Con otra lente (por ejemplo, contribución o ventas) puede cambiar quién va primero: esta es la lectura de riesgo integrado del procedimiento.";
        if (plan.prioridad.modo === "por-lente") {
          for (const PL of (plan.porLentePorParte ? plan.porLentePorParte.map((x) => x.porLente).filter(Boolean) : [plan.porLente])) {   /* §7.3·57(c): una oración por parte que decide */
            entrega.respuesta.push({ texto: `${prefijoDecision}, por ${_nomLente(PL.lente, PL.temaDeLaParte || PL.dominio)}: ${PL.entidad}, con ${R(PL.id)} en ${rotuloEnOracion({ concepto: PL.metrica })}.`, hechos: [PL.id], prioridad: 0, _prioridad: marcaDePrioridad(ALCANCE_DE_PRIORIDAD.CRUZADA, PL.entidad) });   /* FAMILIA 4: el rótulo del léxico de la medida de la lente (en la oración y en la fila) */
            _filaDedup(PL.entidad, PL.dominio, rotuloDeLaCasa({ concepto: PL.metrica }).rotulo, PL.id);
          }
        } else entrega.respuesta.push({ texto: `${prefijoDecision}, por riesgo integrado: ${plan.top.entidad}${coincide} (${partesTop.join("; ")}).${cierreLente}`, hechos: Object.values(plan.idsIntegrada).flatMap((o) => Object.values(o)).filter(Boolean), prioridad: 0, _prioridad: marcaDePrioridad(ALCANCE_DE_PRIORIDAD.CRUZADA, plan.top.entidad) });
      }
      if (plan.prioridad.vaAntes) {   /* el «va antes que» es del riesgo integrado: solo se sirve si la lente pedida pone primero a la MISMA cuenta (nunca se contradice) */
        const comparativos = plan.idsVersus.map(({ it, idA, idB }) => `${it.nombre} (${R(idA)} contra ${R(idB)})`).join(", ");
        for (const { it, idA, idB } of plan.idsVersus) { _filaDedup(plan.top.entidad, it.dominio, rotuloDeSenal(it.nombre || it.metrica), idA); _filaDedup(plan.top.versus.contra, it.dominio, rotuloDeSenal(it.nombre || it.metrica), idB); }
        entrega.respuesta.push({ texto: `${plan.top.entidad} va antes que ${plan.top.versus.contra}: es peor en ${comparativos}.`, hechos: plan.idsVersus.flatMap((x) => [x.idA, x.idB]).filter(Boolean), prioridad: plan.temas.length + 1 });
      }
      if (plan.lideres.cobranza && plan.idShare) {
        _filaDedup(plan.lideres.cobranza.x.entidad, "cobranza", rotuloDeConcentracion(LENTES.cobranza.materialidad.nombre), plan.idShare);   /* FAMILIA 4 (52e): la concentración de la señal de materialidad de cobranza («Participación del vencido total») */
        entrega.respuesta.push({ texto: `De lo vencido en toda la cartera, ${plan.lideres.cobranza.x.entidad} concentra el ${R(plan.idShare)}.`, hechos: [plan.idShare], prioridad: plan.temas.length + 2 });
      }
      // CORTE 3e (owner 2026-09-26) — «declarado por usted» → «declarado por la empresa».
      if (plan.idBenchComercial) entrega.marco.referenciaDeclarada = entrega.marco.referenciaDeclarada || { texto: textoDeBenchmark(R(plan.idBenchComercial), { calificador: "comercial" }), hechoId: plan.idBenchComercial };   /* FAMILIA 3: la frase del benchmark oficial es de `referencias.js` */
      if (entidadesMultitema.size) _declararUniverso(entrega, I, { id: `${plan.partesIds ? plan.partesIds.join("_") : "multitema"}_prioridad`, eje: "cliente", entidades: [...entidadesMultitema], criterio: "prioridad integrada por señales — materialidad, severidad y urgencia entre los dominios que comparten cliente, nunca por suma de montos" });
      // §7.3·22 (supervisor 2026-09-27, diagnóstico v9, precisa la 17 — cierra la raíz A1) — antes, acá se
      // declaraba OTRA VEZ el universo de cada parte de `plan.partesIds` con universo propio (§7.3·17, tarea 3,
      // 2026-09-27), porque esas partes NUNCA pasaban por `_planCifraGrupo` (el `.length === 1` de arriba las
      // excluía). Ahora TODA parte con universo propio compone por `_planCifraGrupo`, que ya declara su universo
      // ORDENADO (`plan.orden`, línea de `_declararUniverso` dentro de `kind:"grupo"`, arriba) — nunca `[...Set]`
      // sin orden, que era la raíz de 11 de las 13 fallas de `ordenServido` de la medición v9. El parche sobra:
      // `plan.partesIds`, acá, ya solo puede traer partes SIN universo propio (`partesSinEntidadLecturaDecision`)
      // o partes `_soloAgregado` que YA se declararon arriba — declararlas de nuevo sería un registro duplicado.
    }
  }
  entrega.respuesta = entrega.respuesta.filter((r) => r.hechos.length || r._definicion);
  // §7.3·29 (2026-09-29): sin oración pero con límites por parte (todas declinadas al componer), la Entrega sale igual.
  if (!entrega.respuesta.length && !limitesGap.length) return _vacia("ninguna parte produjo una oración con evidencia — nada que servir");

  // ═══ CORTE 3d.1 — RENDER de la iniciativa (candado i: se anexa DESPUÉS de todo lo pedido, nunca insertada en
  // medio — lo pedido queda byte-idéntico esté la iniciativa encendida o no). `Riniciativa` renderiza contra
  // `libroIniciativa` (nunca `libro`, el de arriba — un id `i*` no existe ahí) pero empuja a la MISMA
  // `cifrasImpresas` que ya audita la regla «cero cifras desnudas» (verificar.js regla 1). ──
  const idsIniciativaUsados = [];
  const ofertaIdsIniciativa = [];
  const _ofertasIniciativaTexto = [];   // se funde en `entrega.queMasPuedoCalcular.puedo` más abajo — ese campo se REASIGNA entero al final de esta función, así que empujar acá se perdería.
  if (iniciativaSinDuplicar.length) {
    const Riniciativa = (id) => { const v = libroIniciativa ? renderDe(libroIniciativa, id) : null; if (v != null) cifrasImpresas.push(v); return v; };
    const principales = iniciativaSinDuplicar.filter((c) => c.nivel === "principal");
    const ofertas = iniciativaSinDuplicar.filter((c) => c.nivel === "oferta");
    if (principales.length) {
      entrega.respuesta.push({ texto: "", hechos: [], _marcaIniciativa: true });
      for (const c of principales) {
        entrega.respuesta.push({ texto: c.render(Riniciativa), hechos: c.hechos, solicitud: "iniciativa", _iniciativa: true });
        idsIniciativaUsados.push(...c.hechos);
      }
    }
    for (const c of ofertas) {
      _ofertasIniciativaTexto.push(`▹ ${c.render(Riniciativa)}`);
      idsIniciativaUsados.push(...c.hechos);
      ofertaIdsIniciativa.push(...c.hechos);
    }
  }

  // ── MARCO, LÍMITES (noResuelto + ausencias), REFERENCIA DEL OFICIO, QUÉ MÁS PUEDO CALCULAR ──
  const nClientes = ejesDelTenant.cliente ? ejesDelTenant.cliente.length : null;
  // (1) CORRECCIÓN DEL SUPERVISOR (2026-09-25) — el marco por dominio: cobranza NUNCA se declara "inventario"
  // (ver la cabecera de `_periodoGeneralPorDominio`, arriba).
  const { periodo } = _periodoGeneralPorDominio({ figsUsadas, temasCubiertos, rp, plan });
  const { empresaNombre, perfil } = _identidadDelTenant();
  entrega.marco = {
    ...entrega.marco,
    empresa: empresaNombre, periodo,
    universo: nClientes != null ? `${nClientes} clientes` : null,
    moneda: "$",
    definiciones: entrega.marco.definiciones && entrega.marco.definiciones.length ? entrega.marco.definiciones : ["Cada cifra de esta Entrega viaja con su dueño, su período y su origen; universos distintos nunca se suman."],
    perfil,
  };
  if (nClientes != null) cifrasImpresas.push(`${nClientes} clientes`);
  if (periodo && periodo.texto) cifrasImpresas.push(periodo.texto);
  // LA PROCEDENCIA DE LOS UMBRALES (owner 2026-09-28 §7.3·32b · supervisor 2026-09-29 §7.3·36b, diagnóstico v12 raíz A1 — «ningún
  // veredicto debe esconder de dónde proviene su criterio»): los estados que ESTA Entrega usa —en el universo de cada parte, en
  // el de cada premisa, en el estado de una premisa y en el capital que un concepto sirve— salen de los campos tipados
  // (`_estadosDeUniverso`, `estadoDeLaPremisa`, `ESTADO_DE_CONCEPTO`); los umbrales que sostienen esos estados, de la tabla de
  // DATOS `UMBRALES_DE_ESTADO` (notario/estados.js, junto a `FORMA_DE_ESTADO`); y la cláusula de cada uno —con su origen, el de
  // `umbral().origen`— del helper único de `businessPolicy.js`. Una oración por familia (inventario · venta frenada) en `marco.definiciones`, una cláusula por umbral
  // junto a su nombre, sin dígitos (las cifras van en la tabla con su hecho). El umbral de frenado planteado en la consulta
  // sigue declarándose además en `referenciaDeclarada`; aquí solo se nombra su origen, «planteado en la consulta».
  /* FAMILIA 3 (cierre dentro del compositor): LA PROCEDENCIA DE LOS UMBRALES la decide `referencias.js:procedenciaDeLosUmbrales` (los estados en juego, los conjuntos de la casa que dependen de un umbral —§7.3·40a · 36b— y el origen de cada uno); acá solo se pone en el Marco y se registra el VALOR de cada umbral que la cláusula imprime en `cifrasImpresas` (regla 1, cero cifras desnudas) */
  {
    const pu = procedenciaDeLosUmbrales({ partesUtiles, premisas: resolucion.premisas, consultaDeFrenado, estadosDeUniverso: _estadosDeUniverso, basesDeUniverso: _basesDeUniverso });
    if (pu.definiciones.length) entrega.marco.definiciones = [...entrega.marco.definiciones, ...pu.definiciones];
    for (const v of pu.cifras) cifrasImpresas.push(v);
  }
  // ETAPA 6 (§7.3·35) — lo histórico que esta Entrega sirve viaja TIPADO en el Marco: naturaleza, ventana (el período o
  // los días hasta la fecha de corte) y el límite «describe lo que pasó; no es un pronóstico», del `tipo` de las figs
  // servidas (`historiaDeFiguras`). Se imprime siempre (`_textoDeHistoricos`), no depende de la profundidad.
  { const historia = historiaDeFiguras(figsUsadas); if (historia) entrega.marco.historicos = historia; }
  /* FAMILIA 3 (cierre dentro del compositor): LA REFERENCIA OFICIAL EN EL MARCO la decide `referencias.js:referenciaDelMarco` — antes cuatro bloques de este archivo decidían cada uno por su cuenta (§7.3·40d · 41b · 42b · 42d · 43e · 49d): (1) el benchmark de la fig que viaja
   * en la boleta (`idBenchComercialGlobal`); (2) la oficial de cada conjunto que un filtro con `ref` cita, TODAS; (3) el benchmark cuando una parte comercial se sirve, un `base`/`excluir` lo nombra o una premisa habla de la brecha (la misma fuente que juzga el margen, `benchmarkOf`);
   * (4) el nivel de carga declarado. La pieza devuelve el campo único `referenciaDeclarada` y las cifras declaradas sin hecho (regla 1, cero cifras desnudas); acá solo se ponen en la Entrega. El texto es el de siempre. */
  {
    const rm = referenciaDelMarco({ ya: entrega.marco.referenciaDeclarada, idBenchGlobal: idBenchComercialGlobal, R, partesUtiles, premisas: resolucion.premisas, libroPremisas, I, basesDeUniverso: _basesDeUniverso });
    entrega.marco.referenciaDeclarada = rm.referenciaDeclarada;
    for (const c of rm.cifras) cifrasImpresas.push(c);
  }

  // FAMILIA 3 (consolidación, paso 2) — LA REFERENCIA DE LA CONSULTA (§7.3·12/·19/·49a/·52e): UNA pieza (`entrega/referencias.js`) decide qué referencias de la consulta están en juego, en qué conjunto y eje, qué partes cubren y qué daría el
  // conjunto con ellas, AL LADO de la oficial; nunca la reemplaza (el Marco la lleva aparte) y un error de evidencia se declara. Este archivo solo pone en la Entrega lo que la pieza devuelve.
  {
    const rc = referenciasDeLaConsulta({ resolucion, partesUtiles, I, scenario, consultaDeFrenado, basesDeUniverso: _basesDeUniverso, indiceDelTenant: _indiceDelTenant, dominioNombre: (t) => _DOM_NOMBRE[t] || t, listaDeNombres: _listaDeNombres });
    for (const n of rc.cifras) cifrasImpresas.push(n);
    if (rc.marcoOperativa) entrega.marco.referenciaDeclarada = entrega.marco.referenciaDeclarada ? { ...entrega.marco.referenciaDeclarada, texto: `${entrega.marco.referenciaDeclarada.texto} ${rc.marcoOperativa}` } : { texto: rc.marcoOperativa, hechoId: null };
    for (const l of rc.limites) entrega.limites.push(l);
  }

  /* FAMILIA 2: los marcadores de «lo que falta» (puestos al armar cada plan, en su lugar) se resuelven AHORA, con la Entrega ya impresa: la pieza declara lo que ninguna fuente demuestra y NUNCA lo que la Entrega imprime */
  const limitesGapFinal = limitesGap.flatMap((l) => {
    if (!l || !l._faltantesDe) return [l];
    const d = declararLoQueFalta(l._faltantesDe, entrega, { dominioNombre: (t) => _DOM_NOMBRE[t] || t, conteoDeEje, listaDeNombres: _listaDeNombres });
    for (const n of d.numeros) cifrasImpresas.push(n);
    return d.limites;
  });
  entrega.limites = [..._limitesDeclarados(resolucion, temasCubiertos), ...limitesGapFinal, ...entrega.limites];
  { const lp = _limitePerfilIncompleto(perfil); if (lp) entrega.limites.push(lp); }
  // (d) CORRECCIÓN DEL SUPERVISOR (2026-09-25) — «toda Entrega que sirve cobranza declara que el dato no trae
  // la antigüedad del vencido por tramos» (ya decidido; sale de `ausencias.js`, nunca de la pieza CAU-01 en
  // borrador). Solo en el camino GENERAL: las 4 rutas fijas quedan byte a byte, sin tocar.
  if (temasCubiertos.has("cobranza")) { const la = _limiteDeAusencia("sin_antiguedad_vencido"); if (la) entrega.limites.push(la); }

  // entidades del USUARIO (ley «pertinencia por encargo», owner 2026-09-24): salen de `resolucion`, NUNCA del texto.
  const entidadesDelUsuario = [...new Set(partesUtiles.flatMap((p) => (p.entidades || []).map((e) => e.nombre)))];
  const entidadesEnRespuesta = [...new Set(planes.flatMap((p) => {
    if (p.kind === "entidad") return p.filasPorEntidad.map((f) => f.entidad);
    if (p.kind === "grupo") return p.orden.slice(0, 2);
    if (p.kind === "comparacion") return [p.a, p.b];
    if (p.kind === "multitema") return Object.values(p.lideres).map((L) => L.x.entidad);
    return [];
  }))];
  // CORTE 3d.2 — `encargoDeLaTabla` reemplaza `pregunta: ""` por el objeto tipado: la pertinencia se decide por
  // la FORMA del encargo (temas/métricas/prioridad/sujeto), nunca por una cadena de texto vacía ni por prosa.
  const encargoDeLaTabla = construirEncargoDeLaTabla(partesUtiles, { criterio: resolucion.criterio });
  const _refOficio = referenciaDelOficioConOfertas({ perfil, pregunta: "", entidadesEnRespuesta, entidadesDeLaPregunta: entidadesDelUsuario, scenario, encargo: encargoDeLaTabla });
  entrega.referenciaDelOficio = _refOficio.salida;
  _coherenciaConLaCapa(entrega, { conocimientoActivo: undefined, perfil });

  // (c) CORRECCIÓN DEL SUPERVISOR (2026-09-25) — ofertas CONCRETAS del catálogo de este encargo (entidad/eje/
  // tema con su cifra-gancho cuando existe), nunca solo el genérico "Otro corte..." (se conserva como ÚLTIMO
  // recurso, si el encargo no dejó ningún candidato concreto — nunca una sección vacía).
  const ofertasConcretas = _ofertasConcretas(planes, R);
  if (!ofertasConcretas.length) ofertasConcretas.push("Otro corte del mismo encargo (por entidad, por eje, comparado o simulado)");
  entrega.queMasPuedoCalcular = { puedo: [..._ofertasTexto(_refOficio.ofertas), ...ofertasConcretas, ..._ofertasIniciativaTexto], noPuedo: ["Lo que el dato no trae (ver «Lo que no se puede concluir»)"] };

  // (c) CORRECCIÓN DEL SUPERVISOR (2026-09-25) — «Para su juicio» se llena con lo que YA EXISTE, nunca queda
  // vacía sin razón: la pregunta al dueño de `rolesCartera` (la MISMA que ya arma la ruta fija de brecha
  // comercial) y las hipótesis con su apoyo (carga comercial, cuando la conclusión de una entidad la trajo).
  // Un dominio sin entidad representativa NO fuerza una pregunta sin sujeto — se omite, no se inventa a quién
  // preguntarle (`_entidadRepresentativaDeTema` declina en vez de adivinar).
  entrega.paraSuJuicio = [];
  // `buildRolesCartera` pregunta por HASTA DOS cuentas del PORTAFOLIO ENTERO (las de mayor volumen con brecha —
  // rolesCartera.js:candidatos), sin relación con lo que ESTE encargo pidió: nombrarlas en un `cifra` de UNA
  // entidad puntual (ej. "cuánto le vendimos a Jumbo") filtraría cuentas prohibidas por el contrato de
  // pertinencia (medido: D01/D05 del catálogo). Se limita a cuando comercial ES una lectura de CARTERA —
  // multitema, o un grupo/ranking por CLIENTE — nunca cuando el encargo es puntual sobre una entidad o sobre
  // otro eje (marca/familia/etc., donde "cartera de clientes" no aplica).
  const _comercialEsDeCartera = planes.some((p) => (p.kind === "multitema" && p.temas.includes("comercial"))
    || ((p.kind === "grupo" || p.kind === "grupoUniverso") && p.tema === "comercial" && p.eje === "cliente"));
  if (temasCubiertos.has("comercial") && _comercialEsDeCartera) {
    let rolesGeneral = null;
    try { rolesGeneral = buildRolesCartera(scenario); } catch { rolesGeneral = null; }
    // R2/R3, GENERALIZADO A TODO EL ALCANCE (diagnóstico v2 y v5, supervisor 2026-09-26 — MATERIAL, hallado al
    // reproducir W20 y W79): `buildRolesCartera` corre sobre el PORTAFOLIO ENTERO, ajeno a cualquier alcance que
    // el encargo haya declarado — no solo `universo.excluir` (la primera versión de esta ley), sino también
    // `top`/`base`/`estados`/`no_estados`/`filtros` (`_entidadEnAlcanceComercial`, abajo, con la MISMA primitiva
    // `conjuntoDeUniverso` que ya usa el compositor y el Notario). Sin este filtro, W79 («los 3 clientes más
    // chicos por venta») podía nombrar a Falabella y Jumbo —los MÁS GRANDES, fuera del top-3 pedido— en la
    // pregunta al dueño de «Para su juicio»: nunca con cifra propia (`_preguntaAbiertaComercial` no imprime una),
    // pero el nombre solo ya viola «nada se sustituye por un vecino». Se filtra por NOMBRE, nunca se reconstruye
    // `rolesCartera` con un universo nuevo: es la salida de siempre, con las entidades fuera de alcance retiradas
    // de la única lista que este compositor lee (`preguntaAlDueno.entidades`).
    const partesComercial = partesUtiles.filter((p) => p.tema === "comercial");
    // el plan YA compuesto de cada parte (cuando trae `orden`, kind grupo/grupoUniverso): la fuente que
    // `_entidadEnAlcanceDeUnaParte` prefiere sobre repetir la resolución contra `I.rankings` (ver su nota).
    const planPorParte = new Map(planes.filter((pl) => pl.parteId != null && Array.isArray(pl.orden)).map((pl) => [pl.parteId, pl]));
    if (rolesGeneral && rolesGeneral.preguntaAlDueno) {
      const entsFiltradas = (rolesGeneral.preguntaAlDueno.entidades || []).filter((e) => _entidadEnAlcanceComercial(e, partesComercial, I, planPorParte));
      rolesGeneral = entsFiltradas.length === (rolesGeneral.preguntaAlDueno.entidades || []).length ? rolesGeneral
        : { ...rolesGeneral, preguntaAlDueno: entsFiltradas.length ? { ...rolesGeneral.preguntaAlDueno, entidades: entsFiltradas } : null };
    }
    // CORTE 3e (owner 2026-09-26) — antes: `Solo usted puede responder: …` (segunda persona).
    let pa = _preguntaAbiertaComercial(rolesGeneral, perfil);
    // R3 (supervisor 2026-09-26, segunda vuelta) — si NINGUNA entidad del portafolio entero sobrevivió al
    // alcance declarado, no se sirve una pregunta sin sujeto dentro del alcance ni se cae en silencio: se ofrece
    // la pregunta derivada del hueco sobre la entidad que la Entrega YA sirvió (`_entidadRepresentativaDeTema`,
    // la cabeza de la lista YA acotada por `_planCifraGrupo`/`figsEnAlcance` — nunca una entidad nueva ni ajena
    // al alcance, carnada W79: con top 3 «menor», la representativa es Unimarc, no Falabella).
    if (!pa) { const rep = _entidadRepresentativaDeTema("comercial", planes); if (rep) pa = _preguntaAbiertaComercial({ hay: true, preguntaAlDueno: { entidades: [rep] } }, perfil); }
    if (pa) entrega.paraSuJuicio.push(pa);
  }
  if (temasCubiertos.has("comercial")) {
    for (const p of planes) {
      if (p.kind !== "entidad" || p.tema !== "comercial") continue;
      for (const { entidad, conclusion } of p.filasPorEntidad) {
        if (conclusion && conclusion.tipo === "comercial" && conclusion.idCarga != null) {
          entrega.paraSuJuicio.push({ texto: `Hipótesis no demostrada: parte de la brecha de ${entidad} está en la carga comercial (apoyo: ${R(conclusion.idCarga)} de carga comercial alta medida en esa cuenta).`, hechos: [conclusion.idCarga] });
        }
      }
    }
  }
  if (temasCubiertos.has("inventario")) {
    const entidadInv = _entidadRepresentativaDeTema("inventario", planes);
    // CORTE 3e (owner 2026-09-26) — antes: `Solo usted puede responder: ¿qué pasó con …?` (segunda persona).
    /* La pregunta afirma «esté inmovilizado»: solo se hace sobre un SKU que LO ESTÁ (el conjunto de la casa, la MISMA primitiva
     * del Notario). Con el ranking de días sin venta de TODOS los SKU (cierre del inventario, owner 2026-09-29) la cabeza de la
     * lista puede ser un SKU que vendió hoy y no está inmovilizado: preguntar por qué lo está sería afirmar algo falso. */
    const _esInmovilizado = (sku) => { try { const Rz = conjuntoDeUniverso({ eje: "sku", estados: ["inmovilizado"] }, I, "sku", ""); return !!(Rz && Rz.set && Rz.set.has(normalizar(sku))); } catch { return false; } };
    { const pa = entidadInv && _esInmovilizado(entidadInv) ? _preguntaAbiertaInventario(entidadInv, perfil) : null; if (pa) entrega.paraSuJuicio.push(pa); }
  }
  if (temasCubiertos.has("cobranza")) {
    const entidadCob = _entidadRepresentativaDeTema("cobranza", planes);
    // CORTE 3e (owner 2026-09-26) — antes: `Solo usted puede responder: la deuda de …?` (segunda persona).
    /* §7.3·42(e) (diagnóstico v18): «¿plazo pactado o atraso real?» presupone mora: solo se pregunta por una cuenta que ESTÁ en mora
     * (el estado de la casa, la MISMA primitiva del Notario, como `_esInmovilizado` en inventario). Una cuenta al día no se pregunta. */
    const _estaEnMora = (cli) => { try { const Rz = conjuntoDeUniverso({ eje: "cliente", estados: ["en mora"] }, I, "cliente", ""); return !!(Rz && Rz.set && Rz.set.has(normalizar(cli))); } catch { return false; } };
    { const pa = entidadCob && _estaEnMora(entidadCob) ? _preguntaAbiertaCobranza(entidadCob, perfil) : null; if (pa) entrega.paraSuJuicio.push(pa); }
  }

  // (e) CORRECCIÓN DEL SUPERVISOR (2026-09-25) — unidades abreviadas fuera de la tabla de Cifras: "269d" → "269
  // días" SOLO en la prosa (Respuesta/Para su juicio) del camino GENERAL — la tabla de Cifras y las 4 rutas
  // fijas (que arman su propio texto, nunca por acá) no se tocan. El número YA está registrado en
  // `cifrasImpresas` (vía `R`, antes de esta transformación de texto): la regla 1 lo sigue reconociendo porque
  // compara por SUBCADENA ("269".includes en "269d").
  const _desabreviarDias = (t) => String(t || "").replace(/\b(\d+(?:[.,]\d+)?)d\b/g, (_, n) => diasEnPalabras(n));   // singular/plural de la casa (lexico.js): «1 día», «68 días»
  entrega.respuesta = entrega.respuesta.map((r) => ({ ...r, texto: _desabreviarDias(r.texto) }));
  entrega.paraSuJuicio = entrega.paraSuJuicio.map((p) => ({ ...p, texto: _desabreviarDias(p.texto) }));

  entrega.temasCubiertos = [...temasCubiertos];
  // CORTE 3d.1 (owner 2026-09-25) — la traza estructural de la iniciativa: `ids` (verificados y SERVIDOS, en
  // Respuesta o en la oferta — «una señal nunca desaparece»), `ofertaIds` (subconjunto que salió como oferta,
  // no como texto principal), `calls` (llamadas ➕ usadas — siempre 0 en este corte, ver la cabecera de
  // `iniciativa.js`) y `on` (el interruptor efectivo, ya resuelto del encargo). `detalle.iniciativaNoVerificada`
  // es DONDE van los hechos de iniciativa que no verificaron: no se sirven y no tumban la Entrega, pero tampoco
  // desaparecen sin rastro.
  entrega.iniciativa = { ids: idsIniciativaUsados, ofertaIds: ofertaIdsIniciativa, calls: 0, on: iniciativaOn };
  // `detalle.notaDeUso` (libertad narrativa de la simulación en bloques + guía de uso genérica del Marco en
  // "breve") se arma DESPUÉS, en `_conTamanoGobernado` — es la única función que conoce la `profundidad` final,
  // y la MISMA condición decide qué se omite del render Y qué se declara acá (nunca dos criterios distintos).
  entrega.detalle = { iniciativaNoVerificada };
  // `libroPremisas`/`libroIniciativa` son campos ADITIVOS (corte 3c pieza 3 / corte 3d.1): ninguno reemplaza
  // `libro` (el que `verificarEntrega` audita con la regla 9) — son los libros APARTE, para que un gate o el
  // owner puedan auditar su veredicto sin tener que reconstruirlo.
  entrega.procedencia = { libro, cifrasImpresas, libroPremisas, libroIniciativa };

  /* FAMILIA 5 (§7.3·40b · 52e): una cifra se escribe UNA vez — la medida de la lente o el concepto que dos partes piden, que la tabla ya traía, no sale como una fila más (la fila que queda cita los hechos de las dos) */
  entrega.cifras.filas = unaFilaPorCifra(entrega.cifras.filas);
  // CORTE 3e (owner 2026-09-26) — «Su encargo» → «Encargo» (ley 1, textual: «"Encargo" (no "Su encargo")»).
  const texto = _textoDeLaEntrega(entrega, "Encargo");
  return _conTamanoGobernado({ texto, entrega, libro, ok: true, motivo: "" }, resolucion);
}

/* ── el markdown, en el orden de las siete partes (plan §1) — puro texto, ninguna cifra nueva se escribe acá:
 * todo lo que aparece ya pasó por `R(id)` arriba y vive en `entrega.*`. `titulo` es lo único que cambia entre
 * rutas (era literal «¿Dónde deja de ganar?» hasta la TAREA 3 — generalizado para que la segunda ruta no
 * herede el título de la primera). ── */
// CORTE 3e (owner 2026-09-26) — «¿Dónde deja de ganar?» → «¿Dónde la empresa deja de ganar?»: sujeto omitido con
// verbo en 3ª persona es ambiguo entre «usted» (trato formal) y «la empresa»; con el sujeto explícito, no lo es.
function _textoDeLaEntrega(entrega, titulo = "¿Dónde la empresa deja de ganar?", profundidad = "completa") {
  const _breve = profundidad === "breve";
  const L = [];
  L.push(`**ENTREGA ADI · ${titulo}**`);
  L.push("");
  const m = entrega.marco;
  const periodoTxt = m.periodo ? m.periodo.texto : null;
  // TAREA 3 (owner 2026-09-23): `PERIODO_MIXTO_TXT` (el marco de dos familias, ver figureType.js) ya termina en
  // punto — la ruta multidominio es la primera en llegar acá con un período mixto. Sin este chequeo la cabecera
  // salía "…con el suyo.. Esta Entrega…" (doble punto). Nunca se le quita el punto al texto: se evita duplicarlo.
  // TAREA 4 (owner 2026-09-23): el nombre del tenant activo abre el Marco, como en el ejemplo del plan §7
  // («Distribuidora Demo, acumulado enero–agosto 2026, 14 clientes…») — antes `m.empresa` no se imprimía nunca.
  const cabezaMarco = [m.empresa, m.universo, periodoTxt].filter(Boolean).join(", ");
  // BREVE (owner 2026-09-26, cierre del corte) — la guía de uso genérica («Cada cifra de esta Entrega viaja con
  // su dueño…») es una instrucción de LECTURA, no un hecho: se retira del Marco (va a `detalle.notaDeUso`,
  // `_conTamanoGobernado` la declara). Si además queda MÁS de una explicación (el Marco de varios dominios: cada
  // dominio con su propio párrafo de por qué no se consolidan) se omiten todas — `cabezaMarco` ya nombra los
  // dominios con su período (`periodoTxt`, `figureType.js`, no se toca); la forma compacta de "breve" es esa
  // cabecera sola, sin las explicaciones. La estructura sigue completa: `entrega.marco.definiciones` no cambia,
  // solo el RENDER — se recupera entero con `profundidad:"completa"`.
  // LA PROCEDENCIA DE LOS UMBRALES (§7.3·32b/·36b) se ve SIEMPRE, también en «breve»: no es una explicación de lectura sino de
  // dónde viene el criterio de un veredicto — no cuenta para el «más de una explicación» que compacta el Marco, y se imprime
  // aparte (así tampoco desplaza a la nota de cola que el gobernador de tamaño agrega como definición).
  const _esProcedenciaDeCriterio = esProcedenciaDeCriterio;
  const _defSinGuia = (m.definiciones || []).filter((s) => !_esGuiaDeUsoGenerica(s) && !_esProcedenciaDeCriterio(s));
  const _procedenciaTxt = (m.definiciones || []).filter(_esProcedenciaDeCriterio).join(" ");
  const defTxt = _breve ? [_defSinGuia.length <= 1 ? _defSinGuia.join(" ") : "", _procedenciaTxt].filter(Boolean).join(" ") : m.definiciones.join(" ");
  const _cabezaConPunto = cabezaMarco ? (cabezaMarco + (/[.!?]\s*$/.test(cabezaMarco) ? "" : ".")) : "";
  // sin espacios dobles cuando `defTxt` queda vacío (breve, con más de una explicación retirada): se arma por
  // PARTES no vacías, nunca por concatenación de plantilla con huecos.
  L.push(`**Marco.** ${[_cabezaConPunto, defTxt, m.referenciaDeclarada ? m.referenciaDeclarada.texto : "", _textoDeHistoricos(m.historicos)].filter(Boolean).join(" ")}`.trim());
  L.push("");
  // §7.3·29 (2026-09-29): una Entrega cuyas partes se declinaron TODAS no trae oraciones ni filas — no se imprimen las
  // secciones «Respuesta» y «Cifras» vacías (un encabezado sin contenido); lo que no se pudo responder va en «Lo que no se
  // puede concluir».
  const _soloLimites = !entrega.respuesta.length && !entrega.cifras.filas.length;
  if (!_soloLimites) {
  L.push("**Respuesta.**");
  // CORTE 3d.1 (owner 2026-09-25) — la iniciativa de CFO se distingue de lo pedido en TRES capas (§A.5): la
  // marca de texto de la casa (`MARCA_INICIATIVA`, una constante — el owner la cambia sin tocar código), el
  // glifo `▹` (vs. `▸` de lo pedido) y el campo estructural `solicitud:"iniciativa"` (ver `entrega.respuesta[i]`).
  // Sin iniciativa (encargo apagado o catálogo vacío) NINGUNA oración trae `_marcaIniciativa`/`_iniciativa`, así
  // que este bloque es un no-op — byte a byte lo mismo que antes del corte.
  for (const r of entrega.respuesta) {
    if (r._marcaIniciativa) { L.push(`**${MARCA_INICIATIVA}**`); continue; }
    L.push(`${r._iniciativa ? "▹" : "▸"} ${r.texto}`);
  }
  L.push("");
  L.push(`**Cifras.**`);
  L.push(`| ${entrega.cifras.columnas.join(" | ")} |`);
  L.push(`|${entrega.cifras.columnas.map(() => "---").join("|")}|`);
  for (const f of entrega.cifras.filas) L.push(`| ${entrega.cifras.columnas.map((c) => { const v = f.valores[c] || ""; return _breve && _ROTULO_CORTO_COLUMNA[c] ? _ROTULO_CORTO_COLUMNA[c](v) : v; }).join(" | ")} |`);
  L.push("");
  }
  L.push("**Lo que no se puede concluir con estos datos.**");
  // BREVE (owner 2026-09-26, ronda final del corte) — el límite sale con su TÍTULO (la negativa misma: sigue
  // siendo el hallazgo completo, nunca una prohibición recortada) y el MOTIVO queda en `entrega.limites` —
  // completo siempre, «la estructura sigue completa»; se recupera pidiendo `profundidad:"completa"`
  // (`detalle.comoPedirlo`). Nunca se pierde: es el motivo el que se compacta en el TEXTO, no el límite mismo.
  for (const lim of entrega.limites) L.push(_breve ? `- **${lim.titulo}.**` : `- **${lim.titulo}.** ${lim.motivo}`);
  L.push("");
  // BREVE — «Referencia del oficio» vacía imprime SIEMPRE la misma línea genérica, que solo apunta de vuelta a
  // un límite ya declarado arriba («ver «Lo que no se puede concluir»»): en "breve" esa sección entera es
  // redundante y se omite (encabezado incluido). Con contenido real (Business Knowledge activo) NUNCA se omite.
  if (!(_breve && !entrega.referenciaDelOficio.length)) {
    // CORTE 3e (owner 2026-09-26) — «un objetivo tuyo» → «un objetivo de la empresa» (tercera persona).
    L.push("**Referencia del oficio** (general, no es un dato ni un objetivo de la empresa).");
    if (entrega.referenciaDelOficio.length) for (const r of entrega.referenciaDelOficio) L.push(`- ${r.texto}`);
    else L.push("- Sin conocimiento del sector cargado todavía (ver «Lo que no se puede concluir»).");
    L.push("");
  }
  // (c) CORRECCIÓN DEL SUPERVISOR (2026-09-25) — «una sección sin contenido no se imprime»: las 4 rutas fijas
  // SIEMPRE dejan `paraSuJuicio` con ≥1 ítem (verificado); esta condición es un no-op para ellas y solo actúa
  // en el camino general cuando de verdad no hay nada que preguntar.
  if (entrega.paraSuJuicio.length) {
    // CORTE 3e (owner 2026-09-26) — «Para su juicio» lleva «su» de trato (posesivo de segunda persona formal):
    // se renombra a un título neutro, sin cambiar qué contiene la sección (preguntas abiertas + hipótesis).
    L.push("**Preguntas abiertas y supuestos a validar.**");
    // BREVE — UNA sola pregunta abierta: la de MAYOR PRIORIDAD del procedimiento (la del dominio/entidad que la
    // conclusión integrada ya nombró como primero — `primeroDeLaConclusion` (prioridad.js), la MISMA fuente que decide
    // quién abre el procedimiento, nunca una segunda definición de "quién va primero"). Las demás NO desaparecen:
    // siguen completas en `entrega.paraSuJuicio` (estructura completa siempre) y la sección cierra con el conteo.
    let items = entrega.paraSuJuicio;
    let notaResto = "";
    if (_breve && items.length > 1) {
      const entidadPrioritaria = primeroDeLaConclusion(entrega);
      let idx = entidadPrioritaria ? items.findIndex((p) => p.texto.includes(entidadPrioritaria)) : -1;
      if (idx < 0) idx = 0;
      const resto = items.length - 1;
      notaResto = ` (+${resto} pregunta${resto === 1 ? "" : "s"} en el detalle)`;
      items = [items[idx]];
    }
    // CORTE 3e — una PREGUNTA ABIERTA (`_preguntaAbierta`, `preguntaAbierta.js`) es un BLOQUE de varias líneas con
    // rótulos propios («**Pregunta abierta:**», «**Función sugerida…**», …): se imprime tal cual, sin viñeta «- »
    // (que aplastaría el bloque en una sola línea). Una hipótesis simple (`_textoDePremisa`/carga comercial)
    // sigue siendo una oración con viñeta, como siempre.
    // BREVE (owner 2026-09-26, hallazgo D11 al medir el catálogo: el bloque completo de una pregunta abierta
    // sobre el tope de 350) — mismo principio que ya usan `limites` (título sin motivo, recuperable con
    // `profundidad:"completa"`): en breve se sirve SOLO la línea «Pregunta abierta», nunca «Función sugerida»/
    // «Dónde…»/«Qué cambia» — la estructura sigue completa (`entrega.paraSuJuicio` no cambia), solo el TEXTO.
    for (const p of items) {
      if (p._preguntaAbierta) {
        const lineas = String(p.texto).split("\n");
        if (_breve) { L.push(`${lineas[0]}${notaResto}`); }
        else { for (const linea of lineas) L.push(linea); }
        L.push("");
      } else {
        L.push(`- ${p.texto}${notaResto}`);
      }
    }
    L.push("");
  }
  // BREVE — «solo el RÓTULO corto de la primera oferta, sin paréntesis ni cláusulas»: se corta en el primer "("
  // o "—" (los dos separadores que este archivo usa para colgar la cláusula explicativa de una oferta). El texto
  // completo sigue en `entrega.queMasPuedoCalcular.puedo` (estructura completa) y se recupera con `comoPedirlo`.
  const _rotuloCorto = (s) => String(s || "").split(/\s*[(—]/)[0].trim();
  const _puedoTxt = _breve && entrega.queMasPuedoCalcular.puedo.length ? _rotuloCorto(entrega.queMasPuedoCalcular.puedo[0]) : entrega.queMasPuedoCalcular.puedo.join(" · ");
  L.push("**Qué más puedo calcular.** " + _puedoTxt + ". **No puedo:** " + entrega.queMasPuedoCalcular.noPuedo.join(" · ") + ".");
  return L.join("\n");
}
