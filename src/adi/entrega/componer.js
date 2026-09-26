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
import { runPlan } from "../oracle/toolRunner.js";
import { TOOLS } from "../oracle/toolRegistry.js";
import { cajaDelAgente } from "../agente/herramientasAgente.js";
import { pasosDe } from "../agente/playbooks/registro.js";
import { margenEnRiesgo, lecturaDeMargen, prioridadDe } from "../agente/playbooks/margenEnRiesgo.js";
import { cobranza } from "../agente/playbooks/cobranza.js";
import { inventarioInmovilizado } from "../agente/playbooks/asesoria.js";
import { buildRolesCartera } from "../sentrix/rolesCartera.js";
import { cifrasDelDato } from "../oracle/datoProyectado.js";
import { axisEntityNames } from "../oracle/entityIndex.js";
import { indiceDeEvidencia } from "../notario/evidencia.js";
import { libroDeHechos, asignarIds, renderDe, procedenciaDe, NOMBRE_DE_PROCEDENCIA, PROCEDENCIAS, validarUniverso, nombrarUniverso, dominioDeEstado } from "../notario/hechos.js";
import { periodoDeFiguras, reconcilian, UNIVERSOS, PERIODO_TXT } from "../../config/contract/figureType.js";
// CORTE 3c (owner 2026-09-25, piezas 1 y 3 del encargo) — `conjuntoDeUniverso` es LA MISMA primitiva que ya
// evalúa un universo tipado (estados/filtros) para el Notario v3 (`notario/hechos.js:_conteoTipado` la llama
// igual): se reusa acá para el mismo fin, nunca un motor de estados nuevo. `estadoCanon` (estados.js) traduce el
// estado de una premisa a su canon para saber a qué dominio pertenece (pieza 3).
import { conjuntoDeUniverso } from "../notario/verificar.js";
import { estadoCanon } from "../notario/estados.js";
// TAREA 3 (encargo multidominio, owner 2026-09-23) — LA MISMA hoja y LA MISMA prioridad que ya certifica el
// agente en vivo: «no escribas otra prioridad, sería una segunda verdad». Nada de esto se reescribe acá.
import { partesDelEncargo, dominiosDelEncargo } from "../agente/partesDelEncargo.js";
import { pasosDeDominios } from "../agente/contratoDeDominios.js";
import { prioridadIntegrada, LENTES } from "../agente/prioridadIntegrada.js";
import { crearEntrega } from "./esquema.js";
// CORTE 3b (Etapa 1, owner 2026-09-25, `_ADI_LLMBUSINESS_PLAN.md` §1 + `_ADI_CONTRATO_ENCARGO_V1.md`) — la Entrega
// para CUALQUIER encargo válido: `lecturasDe` (corte 3a) decide QUÉ CORRE, este archivo decide CÓMO SE ESCRIBE.
// `metricaPorClave` es la MISMA fuente que ya usa `validar.js` para juzgar conceptos — acá se usa para el otro
// sentido: clave → `nombre` (el rótulo humano, "Venta"/"Margen"/…) que las figs YA traen ("Entidad · Venta"), la
// MISMA convención que las 4 rutas fijas ya explotan a mano (`figVenta`, `figMargen`, …) — nunca una segunda tabla.
import { lecturasDe, REGISTRO_LECTURAS } from "../encargo/lecturasDe.js";
import { metricaPorClave, claveDeMetrica, dominioDeClave, unidadDeClave } from "../notario/lexico.js";
import { ausenciaPorId } from "../../config/contract/ausencias.js";   // Etapa 2 §2 (owner 2026-09-23): las ausencias del dato, declaradas UNA vez
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
function _limitePerfilIncompleto(perfil) {
  if (!perfil || perfil.completo) return null;
  const a = ausenciaPorId("perfil_cliente_incompleto");
  const titulo = (a && a.entrega && a.entrega.titulo) || "Sin perfil completo del cliente todavía";
  const campos = perfil.faltantes.map((c) => ETIQUETA_DEL_CAMPO[c] || c).join(", ");
  return { titulo, motivo: `Falta declarar o no se pudo derivar: ${campos}. Sin el perfil completo, ADI no aplica conocimiento del oficio a esta empresa aunque el catálogo lo tuviera — para no comparar contra un sector equivocado.` };
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
function _declararUniverso(entrega, I, { id, eje, top = null, base = null, filtros = null, excluir = null, periodo = null, entidades = [], criterio = null, estados = null, no_estados = null }) {
  const u = { eje };
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
  entrega.universos.push({ id, eje, base: base || null, top: top || null, filtros: filtros || null, excluir: excluir || null, estados: estados || null, no_estados: no_estados || null, periodo, entidades, criterio, texto, valido: !errorValidacion, errorValidacion });
}

/* ── el libro de hechos de este turno: declara SOLO `ref` (cita literal de una fig), `razon` y `derivada`
 * (las tentaciones precalculadas, mecanismo 6 del plan) — los tres tipos que `notario/hechos.js` verifica sin
 * necesitar un universo tipado complejo. Cada `ref` es la MISMA fig que el playbook ya prueba en producción. ── */
function _declararRef(hechos, contador, fig) {
  if (!fig || fig.id == null) return null;
  const id = `e${++contador.n}`;
  hechos.push({ id, tipo: "ref", de: fig.id });
  return id;
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
function _indiceDelTenant(figs, scenario) {
  const datoProyectado = cifrasDelDato(scenario);
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
  const top = pr.top;
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
    referenciaDeclarada: { texto: `Benchmark de margen: ${R(idBench)}, declarado por usted.`, hechoId: idBench },
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
    respuesta.push({ texto, hechos: [idsTop.juego] });
  }
  entrega.respuesta = respuesta;

  // ── CIFRAS · la tabla — la unidad que no se puede partir (mecanismo 2): dueño + venta + margen + brecha + tipo ──
  entrega.cifras.columnas = ["Cliente", "Venta", "Margen", "Contribución no capturada (brecha estimada)", "Tipo"];
  const _filaCliente = (entidad, ids) => {
    const hechosFila = [ids.venta, ids.margen, ids.juego].filter(Boolean);
    const procedencia = _procedenciaDeFila(libro, hechosFila);
    return {
      valores: { Cliente: entidad, Venta: R(ids.venta), Margen: R(ids.margen), "Contribución no capturada (brecha estimada)": R(ids.juego), Tipo: _textoDeTipo(procedencia) },
      hechos: hechosFila,
      procedencia,
    };
  };
  entrega.cifras.filas.push(_filaCliente(top.entidad, idsTop));
  if (idsSeg) entrega.cifras.filas.push(_filaCliente(segundo.entidad, idsSeg));
  if (idTotal) { const procedencia = _procedenciaDeFila(libro, [idTotal]); entrega.cifras.filas.push({
    valores: { Cliente: "Total (cuentas materiales)", Venta: "", Margen: "", "Contribución no capturada (brecha estimada)": R(idTotal), Tipo: _textoDeTipo(procedencia, { subtotal: true }) },
    hechos: [idTotal],
    procedencia,
  }); }

  // ── LO QUE NO SE PUEDE CONCLUIR · cada ausencia es un HALLAZGO con título, nunca una prohibición ni una excusa ──
  entrega.limites = [
    { titulo: "La brecha estimada no es dinero ya perdido", motivo: `Es una comparación contra el benchmark que usted declaró (${R(idBench)}); no es recuperable en su totalidad ni necesariamente.` },
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

  // ── PARA SU JUICIO · reusa las huellas con sello (probado/indicado/abierto) y la pregunta al dueño de
  // `rolesCartera` — sin introducir NINGÚN número que no esté ya verificado arriba (regla 1 del plan) ──
  let roles = null;
  try { roles = buildRolesCartera(scenario); } catch { roles = null; }
  const paraSuJuicio = [];
  if (roles && roles.hay && roles.preguntaAlDueno) {
    paraSuJuicio.push({ texto: `Solo usted puede responder: ${roles.preguntaAlDueno.texto}`, hechos: [] });
  }
  if (idsTop.carga) {
    const cTop = R(idsTop.carga);
    paraSuJuicio.push({ texto: `Hipótesis no demostrada: parte de la brecha de ${top.entidad} está en la carga comercial (apoyo: ${cTop} de carga comercial alta medida en esa cuenta).`, hechos: [idsTop.carga] });
  }
  entrega.paraSuJuicio = paraSuJuicio;

  // ── QUÉ MÁS PUEDO CALCULAR · menú por ruta + las ofertas de la capa de conocimiento (Etapa 3, owner 2026-09-24:
  // antes un menú estático sin cifras; una oferta trae una cifra-gancho YA verificada — `_ofertasTexto`) ──
  entrega.queMasPuedoCalcular = {
    puedo: [
      `Margen por producto dentro de ${top.entidad}`,
      "Carga comercial alta, cuenta por cuenta",
      "Ranking completo por contribución no capturada",
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
  const topEntidad = filasSaldo[0] ? _entidadDe(_lab(filasSaldo[0])) : null;
  const segundoEntidad = filasSaldo[1] ? _entidadDe(_lab(filasSaldo[1])) : null;
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
  entrega.cifras.columnas = ["Cliente", "Saldo pendiente", "Saldo vencido", "Tipo"];
  const _filaCliente = (entidad, ids) => {
    const hechosFila = [ids.saldo, ids.vencido].filter(Boolean);
    const procedencia = _procedenciaDeFila(libro, hechosFila);
    return {
      valores: { Cliente: entidad, "Saldo pendiente": R(ids.saldo), "Saldo vencido": ids.vencido ? R(ids.vencido) : "—", Tipo: _textoDeTipo(procedencia, { extra: ids.vencido ? null : "vencido no calculado" }) },
      hechos: hechosFila,
      procedencia,
    };
  };
  entrega.cifras.filas.push(_filaCliente(topEntidad, idsTop));
  if (idsSeg) entrega.cifras.filas.push(_filaCliente(segundoEntidad, idsSeg));
  { const hechosFila = [idSaldoTotal, idVencidoTotal].filter(Boolean); const procedencia = _procedenciaDeFila(libro, hechosFila); entrega.cifras.filas.push({
    valores: { Cliente: "Total (cartera)", "Saldo pendiente": R(idSaldoTotal), "Saldo vencido": idVencidoTotal ? R(idVencidoTotal) : "—", Tipo: _textoDeTipo(procedencia, { subtotal: true }) },
    hechos: hechosFila,
    procedencia,
  }); }

  // ── LO QUE NO SE PUEDE CONCLUIR ──
  entrega.limites = [
    { titulo: "El saldo pendiente no es una pérdida", motivo: "Es capital retenido del cliente; sería pérdida solo si se volviera incobrable, y eso no está en los datos." },
    { titulo: "La causa de la deuda no está en los datos", motivo: "Esta lectura localiza cuánto y quién debe, no explica la conducta de pago — no hay causalidad sin respaldo." },
    _limiteDeAusencia("conocimiento_sector_cobranza"),
  ];
  if (!idVencidoTotal) entrega.limites.push({ titulo: "El vencido no se puede calcular", motivo: "Su empresa no declaró un plazo de pago: sin plazo, no se puede afirmar qué parte del saldo está vencida — nunca se declara en cero. Declárelo y el vencido se calcula solo." });
  { const lp = _limitePerfilIncompleto(perfil); if (lp) entrega.limites.push(lp); }

  // ── REFERENCIA DEL OFICIO · Etapa 3 (ver la nota de la ruta 1) ──
  const _refOficio2 = referenciaDelOficioConOfertas({ perfil, pregunta, entidadesEnRespuesta: [topEntidad, ...(segundoEntidad ? [segundoEntidad] : [])], entidadesDeLaPregunta: _entidadesDeLaPregunta(pregunta), scenario, activo: conocimientoActivo, catalogo: conocimientoCatalogo });
  entrega.referenciaDelOficio = _refOficio2.salida;

  // ── PARA SU JUICIO ──
  entrega.paraSuJuicio = idVencidoTotal
    ? [{ texto: `Solo usted puede responder: la deuda de ${topEntidad}, ¿responde a un plazo pactado más largo o a que dejó de pagar a tiempo? El dato mide cuánto y desde cuándo, no por qué.`, hechos: [] }]
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

  const texto = _textoDeLaEntrega(entrega, "¿Quién le debe más?");
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
  // 1 · LA BOLETA — el mismo (único) paso que el playbook `inventario-inmovilizado` ya certifica
  const { rp, figs } = _correrPlaybook(inventarioInmovilizado, { scenario, pregunta });
  if (!figs.length) return _vacia("sin boleta: el motor no produjo cifras para esta pregunta con los datos activos");

  // 2 · EL ÍNDICE DE EVIDENCIA — el mismo helper que las dos rutas anteriores
  const { I, ejesDelTenant } = _indiceDelTenant(figs, scenario);

  // 3 · LA LECTURA — `facts.inventory` YA viene estructurado (nota 1 de arriba): no hay que parsear prosa
  const inv = rp.results[0] && rp.results[0].facts && rp.results[0].facts.inventory;
  const figTotal = _find(figs, /^Capital frenado · total$/i);
  if (!inv || !figTotal) return _vacia("sin evidencia suficiente: falta el capital frenado total de la Mesa Capital");
  const bySku = Array.isArray(inv.bySku) ? [...inv.bySku].sort((a, b) => (b.usd || 0) - (a.usd || 0)) : [];
  if (!bySku.length) return _vacia("sin evidencia suficiente: no hay SKU con capital frenado en los datos activos");
  const topSku = bySku[0], segundoSku = bySku.length > 1 ? bySku[1] : null;

  const figSkuMonto = (sku) => _find(figs, new RegExp(`^${_esc(sku)} · Capital frenado$`, "i"));
  const figSkuDias = (sku) => _find(figs, new RegExp(`^${_esc(sku)} · D[ií]as de inventario$`, "i"));
  const figSkuRot = (sku) => _find(figs, new RegExp(`^${_esc(sku)} · Rotaci[oó]n$`, "i"));
  const figSano = _find(figs, /^Estado del inventario: capital sano$/i);
  const figQuiebre = _find(figs, /^Estado del inventario: riesgo de quiebre$/i);
  const figSobrestock = _find(figs, /^Estado del inventario: sobrestock$/i);
  const figUmbralPct = _find(figs, /^Umbral de materialidad · % de la venta$/i);
  const figUmbralUsd = _find(figs, /^Umbral de materialidad · en dinero$/i);

  // 4 · EL LIBRO DE HECHOS — mismo mecanismo que las dos rutas anteriores
  const hechos = [];
  const contador = { n: 0 };
  const figsUsadas = [];
  const ref = (fig) => { if (fig) figsUsadas.push(fig); return _declararRef(hechos, contador, fig); };

  const idTotal = ref(figTotal);
  const idSano = figSano ? ref(figSano) : null;
  const idQuiebre = figQuiebre ? ref(figQuiebre) : null;
  const idSobrestock = figSobrestock ? ref(figSobrestock) : null;
  const idUmbralPct = figUmbralPct ? ref(figUmbralPct) : null;
  const idUmbralUsd = figUmbralUsd ? ref(figUmbralUsd) : null;
  const _declararSku = (s) => ({ monto: ref(figSkuMonto(s.sku)), dias: (() => { const f = figSkuDias(s.sku); return f ? ref(f) : null; })(), rot: (() => { const f = figSkuRot(s.sku); return f ? ref(f) : null; })() });
  const idsTop = _declararSku(topSku);
  const idsSeg = segundoSku ? _declararSku(segundoSku) : null;

  // la tentación precalculada (mecanismo 6 del plan): la participación del mayor SKU sobre el total frenado
  let idShare = null;
  if (idsTop.monto && idTotal) { idShare = (() => { const id = `e${++contador.n}`; hechos.push({ id, tipo: "razon", num: { id: idsTop.monto }, den: { id: idTotal }, forma: "pct" }); return id; })(); }

  const libro = libroDeHechos(hechos, { indice: I });
  const rotos = libro.hechos.filter((h) => !h.ok);
  if (rotos.length) return { texto: "", entrega: null, libro, ok: false, motivo: `${rotos.length} hecho(s) no verificaron: ${rotos.map((h) => `${h.id} (${h.motivo})`).join(" · ")}` };

  // 5 · LA ENTREGA
  const entrega = crearEntrega();
  const cifrasImpresas = [];
  const R = (id) => { const v = renderDe(libro, id); if (v != null) cifrasImpresas.push(v); return v; };

  // EL PERÍODO — SÍ se reusa `_periodoDelMarco` (nota 2 de arriba): el universo `inventario` ya declaraba
  // "hoy" correctamente antes de este incremento.
  const nBodegas = ejesDelTenant.bodega ? ejesDelTenant.bodega.length : null;
  const { periodo, faltaRango } = _periodoDelMarco(figsUsadas);
  const { empresaNombre, perfil } = _identidadDelTenant();
  entrega.marco = {
    empresa: empresaNombre,
    periodo,
    universo: nBodegas != null ? `${bySku.length} SKU frenados en ${nBodegas} bodegas` : `${bySku.length} SKU frenados`,
    moneda: "$",
    definiciones: [
      "Capital frenado = stock cuya rotación está bajo el piso o cuyos días de inventario superan el techo que declara tu política — no es todo el inventario, es el subconjunto que no está rotando.",
      "El capital frenado no se suma ni se compara con la venta comercial: son universos distintos (ver «Lo que no se puede concluir»).",
    ],
    referenciaDeclarada: (idUmbralPct && idUmbralUsd)
      ? { texto: `Umbral de materialidad de tu negocio: ${R(idUmbralPct)} de la venta (${R(idUmbralUsd)}), declarado por ti.`, hechoId: idUmbralPct }
      : null,
    perfil,
  };
  if (nBodegas != null) cifrasImpresas.push(`${bySku.length} SKU frenados en ${nBodegas} bodegas`); else cifrasImpresas.push(`${bySku.length} SKU frenados`);
  if (periodo && periodo.texto) cifrasImpresas.push(periodo.texto);

  // ── RESPUESTA ──
  const respuesta = [];
  {
    const vTotal = R(idTotal);
    const texto = `Tienes ${vTotal} de capital frenado: stock que no está rotando.`;
    respuesta.push({ texto, hechos: [idTotal] });
  }
  {
    const vMonto = R(idsTop.monto), vDias = idsTop.dias ? R(idsTop.dias) : null, vRot = idsTop.rot ? R(idsTop.rot) : null;
    const extra = [vDias ? `${vDias} de inventario` : null, vRot ? `rotación ${vRot}` : null].filter(Boolean).join(" · ");
    const texto = `El mayor es ${topSku.sku}: ${vMonto} frenados${extra ? ` (${extra})` : ""}.`;
    respuesta.push({ texto, hechos: [idsTop.monto, idsTop.dias, idsTop.rot].filter(Boolean) });
  }
  if (idsSeg) {
    const vMonto = R(idsSeg.monto), vDias = idsSeg.dias ? R(idsSeg.dias) : null;
    const texto = `El segundo es ${segundoSku.sku}: ${vMonto} frenados${vDias ? `, ${vDias} de inventario` : ""}.`;
    respuesta.push({ texto, hechos: [idsSeg.monto, idsSeg.dias].filter(Boolean) });
  }
  if (idSano || idQuiebre || idSobrestock) {
    const partes = [idSano ? `${R(idSano)} está sano` : null, idQuiebre ? `${R(idQuiebre)} en riesgo de quiebre` : null, idSobrestock ? `${R(idSobrestock)} en sobrestock` : null].filter(Boolean);
    const texto = `Del resto del inventario, ${partes.join(", ")} — estados independientes, no la causa del capital frenado.`;
    respuesta.push({ texto, hechos: [idSano, idQuiebre, idSobrestock].filter(Boolean) });
  }
  {
    const pShare = idShare ? R(idShare) : null;
    const texto = `Prioridad del procedimiento, por mayor capital frenado: abrir primero ${topSku.sku}${pShare ? `, el ${pShare} del total frenado` : ""}.`;
    respuesta.push({ texto, hechos: [idsTop.monto, idShare].filter(Boolean) });
  }
  entrega.respuesta = respuesta;

  // ── CIFRAS · una fila por SKU con capital frenado (mecanismo 2: dueño + cuánto + con qué evidencia, en la misma fila) ──
  entrega.cifras.columnas = ["SKU", "Bodega", "Capital frenado", "Días de inventario", "Rotación", "Tipo"];
  const _filaSku = (s, ids) => {
    const hechosFila = [ids.monto, ids.dias, ids.rot].filter(Boolean);
    const procedencia = _procedenciaDeFila(libro, hechosFila);
    return {
      valores: { SKU: s.sku, Bodega: s.bodega || "—", "Capital frenado": R(ids.monto), "Días de inventario": ids.dias ? R(ids.dias) : "—", "Rotación": ids.rot ? R(ids.rot) : "—", Tipo: _textoDeTipo(procedencia) },
      hechos: hechosFila,
      procedencia,
    };
  };
  entrega.cifras.filas.push(_filaSku(topSku, idsTop));
  if (idsSeg) entrega.cifras.filas.push(_filaSku(segundoSku, idsSeg));
  { const procedencia = _procedenciaDeFila(libro, [idTotal]); entrega.cifras.filas.push({
    valores: { SKU: `Total (${bySku.length} SKU frenados)`, Bodega: "", "Capital frenado": R(idTotal), "Días de inventario": "", "Rotación": "", Tipo: _textoDeTipo(procedencia, { subtotal: true }) },
    hechos: [idTotal],
    procedencia,
  }); }

  // ── LO QUE NO SE PUEDE CONCLUIR ──
  const _cruce = reconcilian("inventario", "venta_comercial");
  entrega.limites = [];
  if (_cruce.estado !== "reconciled") {
    entrega.limites.push({ titulo: "El capital frenado y la venta comercial son universos distintos", motivo: "El inventario se mide en una escala y una moneda propias, y no reconcilia con la venta comercial (contrato de datos declarado): nunca se suman ni se comparan directamente en esta Entrega." });
  }
  entrega.limites.push({ titulo: "La causa de que cada SKU esté frenado no está en los datos", motivo: "Esta lectura localiza cuánto capital y en qué SKU está frenado, no explica por qué — no hay historial de compras, lead time de proveedor ni causa de la detención en este dato." });
  const lt = rp.results[0] && rp.results[0].facts && rp.results[0].facts.limite_transferencia;
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

  // ── REFERENCIA DEL OFICIO · Etapa 3 (ver la nota de la ruta 1) — eje SKU: no hay cuentas que el usuario pueda
  // nombrar en la pregunta para este eje, `entidadesDeLaPregunta` queda vacío (comportamiento de siempre) ──
  const _refOficio3 = referenciaDelOficioConOfertas({ perfil, pregunta, entidadesEnRespuesta: [topSku.sku, ...(segundoSku ? [segundoSku.sku] : [])], entidadesDeLaPregunta: _entidadesDeLaPregunta(pregunta), scenario, activo: conocimientoActivo, catalogo: conocimientoCatalogo });
  entrega.referenciaDelOficio = _refOficio3.salida;

  // ── PARA SU JUICIO · la MISMA pregunta que ya certifica el playbook (asesoria.js) — no se redacta una nueva ──
  entrega.paraSuJuicio = [
    { texto: `Solo tú puedes responder: ¿qué pasó con esos SKU — fue una sobrecompra, un cambio de temporada, un cliente que no retiró, o un proveedor que llegó tarde? El dato mide cuánto está frenado, no por qué.`, hechos: [] },
  ];

  // ── QUÉ MÁS PUEDO CALCULAR ──
  entrega.queMasPuedoCalcular = {
    puedo: ["Capital frenado por bodega", "Capital por familia y marca", "Detalle de riesgo de quiebre y sobrestock", "Simular el efecto de liberar los SKU frenados", ..._ofertasTexto(_refOficio3.ofertas)],
    noPuedo: ["Por qué cada SKU quedó frenado (no hay historial de compras ni causa declarada)", "Si conviene transferir stock entre bodegas (ningún SKU está en más de una)"],
  };

  // TAREA 3 — el universo: los SKU citados, rankeados por capital frenado descendente (el mismo orden de `bySku`).
  _declararUniverso(entrega, I, {
    id: "inventario_prioridad", eje: "sku", top: { metrica: "capital_frenado", k: idsSeg ? 2 : 1, direccion: "mayor" },
    periodo: periodo ? periodo.tipo : null, entidades: [topSku.sku, ...(segundoSku ? [segundoSku.sku] : [])],
  });

  entrega.procedencia = { libro, cifrasImpresas };

  const texto = _textoDeLaEntrega(entrega, "¿Tienes demasiado inventario?");
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
  const P = prioridadIntegrada(figs, dominios);
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
  for (const d of Object.keys(P.porDominio)) { const x = P.porDominio[d][0]; if (x) lideres[d] = { x, ids: declararSenales(d, x) }; }

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
  const top = P.integrada[0] || null;
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
  const idBenchComercial = dominios.includes("comercial") ? ref(_find(figs, /^Benchmark de margen$/i)) : null;

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
    referenciaDeclarada: idBenchComercial ? { texto: `Benchmark de margen (comercial): ${R(idBenchComercial)}, declarado por ti. Inventario y cobranza no comparan contra un benchmark en este dato.`, hechoId: idBenchComercial } : null,
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
    respuesta.push({ texto, hechos: Object.values(idsIntegrada).flatMap((o) => Object.values(o)).filter(Boolean) });
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
  for (const fila of filasMap.values()) {
    const hechosFila = [fila.materialidad, fila.severidad, fila.urgencia].filter(Boolean);
    if (!hechosFila.length) continue;
    entrega.cifras.filas.push({
      valores: {
        Dominio: _DOM_NOMBRE[fila.dominio], Entidad: fila.entidad,
        Materialidad: fila.materialidad ? R(fila.materialidad) : "—", Severidad: fila.severidad ? R(fila.severidad) : "—", Urgencia: fila.urgencia ? R(fila.urgencia) : "—",
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
  ];
  if (faltaRango) entrega.limites.push({ titulo: "El año comercial no declara un rango de fechas calendario", motivo: "El dato confirma que la parte comercial es el año cerrado (12 meses ya ocurridos), pero el pack no trae una fecha de cierre para ese universo — a diferencia de inventario y cobranza, que sí declaran su foto al corte." });
  { const lp = _limitePerfilIncompleto(perfil); if (lp) entrega.limites.push(lp); }

  // ── REFERENCIA DEL OFICIO · Etapa 3 (ver la nota de la ruta 1) — las entidades líder de cada dominio ──
  const _refOficio4 = referenciaDelOficioConOfertas({ perfil, pregunta, entidadesEnRespuesta: [...new Set(Object.values(lideres).map((L) => L.x.entidad))], entidadesDeLaPregunta: _entidadesDeLaPregunta(pregunta), scenario, activo: conocimientoActivo, catalogo: conocimientoCatalogo });
  entrega.referenciaDelOficio = _refOficio4.salida;

  // ── PARA SU JUICIO · una pregunta por dominio, reusando el mismo texto que ya certifican las otras rutas ──
  entrega.paraSuJuicio = [];
  if (lideres.comercial) {
    let roles = null;
    try { roles = buildRolesCartera(scenario); } catch { roles = null; }
    if (roles && roles.hay && roles.preguntaAlDueno) entrega.paraSuJuicio.push({ texto: `Sobre comercial, solo tú puedes responder: ${roles.preguntaAlDueno.texto}`, hechos: [] });
  }
  if (lideres.inventario) entrega.paraSuJuicio.push({ texto: `Sobre inventario, solo tú puedes responder: ¿qué pasó con ${lideres.inventario.x.entidad} — fue una sobrecompra, un cambio de temporada, un cliente que no retiró, o un proveedor que llegó tarde? El dato mide cuánto está frenado, no por qué.`, hechos: [] });
  if (lideres.cobranza) entrega.paraSuJuicio.push({ texto: `Sobre cobranza, solo tú puedes responder: la deuda de ${lideres.cobranza.x.entidad}, ¿responde a un plazo pactado más largo o a que dejó de pagar a tiempo? El dato mide cuánto y desde cuándo, no por qué.`, hechos: [] });

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

  const texto = _textoDeLaEntrega(entrega, "¿Qué debería preocuparme primero?");
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
/* el concepto de una fig «Entidad · Concepto» (la parte después del primer «·») — para pasarlo por la
 * canonización del Notario, nunca para adivinar el rótulo a mano. */
const _conceptoDeLabel = (label) => { const p = String(label || "").split("·").map((s) => s.trim()); return p.length >= 2 ? p.slice(1).join(" · ") : String(label || ""); };
const _claveDeFig = (fig) => claveDeMetrica(_conceptoDeLabel(_lab(fig)));
const _labelDeClave = (clave) => { const m = metricaPorClave(clave); return m ? m.nombre : clave; };
const _filaDe = (figs, entidad, clave) => _figsDeEntidad(figs, entidad).find((f) => _claveDeFig(f) === clave) || null;
const _todasLasFilasDeConcepto = (figs, clave) => {
  const out = [];
  for (const f of figs) { if (_claveDeFig(f) === clave) { const e = _entidadDe(_lab(f)); if (e) out.push({ entidad: e, fig: f }); } }
  return out;
};

/* ── delegación a las 4 rutas fijas (equivalencia byte a byte) ────────────────────────────────────────────────── */
const _parteSimple = (p) => p && p.cierre === "lectura" && (!p.entidades || !p.entidades.length)
  && (!p.conceptos || !p.conceptos.length) && !p.universo && (!p.periodo || p.periodo.tipo === "vigente");
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
      limites.push({ titulo: `Sobre ${sujeto}, un ${nr.campo} pedido quedó sin resolver (${nr.motivo.replace(/_/g, " ")})`, motivo: nr.detalle || `Motivo cerrado del contrato: ${nr.motivo}.` });
    }
    const altAusencia = (nr.alternativas || []).find((a) => a.tipo === "ausencia");
    if (altAusencia) agregarAusencia(altAusencia.id);
  }
  return limites;
}

/* ── PLAN «entidad» (cierre `cifra`/`lectura`/`decision` con ≥1 entidad declarada) ──────────────────────────────
 * Declara CADA fig «entidad · concepto» que encuentra para esa entidad (filtrada a `parte.conceptos` si el
 * encargo los trajo — nunca sustituye un concepto por otro) y devuelve el plan (solo ids, sin texto: se rinde
 * en la fase 2, después de verificar el libro — el MISMO patrón de las 4 rutas fijas). */
function _planCifraEntidad(parte, figs, ref) {
  const filasPorEntidad = [];
  for (const e of parte.entidades) {
    const universo = parte.conceptos && parte.conceptos.length ? parte.conceptos : null;
    const candidatas = universo ? universo.map((c) => ({ clave: c, fig: _filaDe(figs, e.nombre, c) })).filter((x) => x.fig)
      : _figsDeEntidad(figs, e.nombre).map((f) => ({ clave: null, fig: f, etiqueta: _conceptoDeLabel(_lab(f)) }));
    const filas = candidatas.map((c) => ({ etiqueta: c.etiqueta || _labelDeClave(c.clave) || c.clave, id: ref(c.fig) })).filter((f) => f.id);
    if (filas.length) filasPorEntidad.push({ entidad: e.nombre, eje: e.eje, filas });
  }
  return { kind: "entidad", tema: parte.tema, parteId: parte.id, cierre: parte.cierre, filasPorEntidad };
}

/* un universo con `estados`/`no_estados`/`filtros` exige evaluar el ESTADO de cada entidad contra el dato real
 * (notario/estados.js aplicado a un universo completo) — un subsistema que este corte NO construye (gap declarado
 * en la cabecera). `universo.top` (el ranking) SÍ está resuelto. */
const _universoNoSoportado = (u) => !!(u && ((Array.isArray(u.estados) && u.estados.length) || (Array.isArray(u.no_estados) && u.no_estados.length) || (Array.isArray(u.filtros) && u.filtros.length)));
/* con `top` el ranking YA está resuelto (el camino de siempre, `_planCifraGrupo`/`_planMultiTema`): el gap real es
 * SOLO estados/no_estados/filtros SIN top — esa combinación es la que la pieza 1 del corte 3c resuelve abajo. */
const _universoPorEstadoSinTop = (u) => _universoNoSoportado(u) && !(u && u.top);

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
  if (!miembros.length) return { error: "universo-vacio: ninguna entidad del eje cumple el universo declarado" };
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
  return { kind: "grupoUniverso", tema: parte.tema, parteId: parte.id, cierre: parte.cierre, eje, universo: u, miembros: orden, n: U.set.size, m: total, fuenteConteo: U.fuente, conceptos, claveOrden, claveTentacion, porEntidad };
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
function _cerrarGrupoUniverso(p, figsDeP, I, hechos, contador, ref, declararRazon) {
  const gp = _planCifraGrupoUniverso(p, figsDeP, I);
  if (gp.error) return { error: gp.error };
  const idConteo = _declararConteo(hechos, contador, gp.universo, gp.n);
  for (const nombre of gp.miembros) { const m = gp.porEntidad.get(nombre); for (const [clave, fig] of m) m.set(clave, ref(fig)); }
  let idTotal = null, idShare = null;
  let idShares = [];
  if (gp.claveTentacion && gp.miembros.length >= 2) {
    const ids = gp.miembros.map((nombre) => gp.porEntidad.get(nombre).get(gp.claveTentacion)).filter((x) => x != null);
    if (ids.length >= 2) {
      idTotal = _declararSuma(hechos, contador, ids);
      // el LÍMITE DE CANTIDAD (TENTACION_PARTICIPACION_TOP, pieza 2): una participación individual por MIEMBRO,
      // nunca una por fila — se corta acá, no se deja crecer con el tamaño del grupo (D07 tiene 9 cuentas).
      if (idTotal) for (const idMiembro of ids.slice(0, TENTACION_PARTICIPACION_TOP)) { const s = declararRazon(idMiembro, idTotal); if (s) idShares.push(s); }
      idShare = idShares[0] || null;
    }
  }
  return { kind: "grupoUniverso", tema: p.tema, parteId: p.id, cierre: p.cierre, eje: gp.eje, universo: gp.universo, idConteo, n: gp.n, m: gp.m, fuenteConteo: gp.fuenteConteo, miembros: gp.miembros, claveOrden: gp.claveOrden, claveTentacion: gp.claveTentacion, porEntidad: gp.porEntidad, idTotal, idShare, idShares };
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
function _textoVerdadDerivada(H, libroPremisas) {
  return (H.derivados || []).map((d) => { const D = libroPremisas.porId.get(d); return D ? (D.verdad || D.motivo) : null; }).filter(Boolean).join(" · ");
}
function _textoDePremisa(H, libroPremisas) {
  if (H.veredicto === "verdadera") return `Sobre lo que usted da por hecho: es correcto — ${H.verdad || H.motivo}.`;
  if (H.veredicto === "falsa") { const vd = _textoVerdadDerivada(H, libroPremisas); return `Sobre lo que usted da por hecho: no es así — ${H.verdad || H.motivo}${vd ? `. La verdad: ${vd}` : ""}.`; }
  return `Sobre lo que usted da por hecho, no se pudo verificar con este dato: ${H.motivo}.`;
}

/* ── PLAN «grupo» (cierre `cifra` sin entidades: listado del eje, group-by o `universo.top`) ──────────────────── */
function _planCifraGrupo(parte, figs) {
  if (_universoNoSoportado(parte.universo)) return null;
  const eje = (parte.universo && parte.universo.eje) || parte.eje;
  const conceptosBase = parte.conceptos && parte.conceptos.length ? parte.conceptos.slice() : [];
  const top = parte.universo && parte.universo.top;
  const conceptoTop = top ? top.metrica : null;
  const conceptos = conceptoTop && !conceptosBase.includes(conceptoTop) ? [conceptoTop, ...conceptosBase] : conceptosBase;
  if (!conceptos.length) return null;

  // EL CONJUNTO DE ENTIDADES «EN JUEGO» (owner, ley «un top-N declara su cola» — nunca al revés: con `top`, la
  // propia llamada `queryMetric(limit:k)` YA trae SOLO esas k entidades para `conceptoTop` — nunca se completa con
  // entidades que aparecen en OTRO concepto sin top (eso sería inventar una cola que no se declaró). Sin `top`, el
  // conjunto es la unión de TODO lo que cada concepto pedido trajo, sin recorte.
  let entidadesEnJuego;
  if (top) entidadesEnJuego = _todasLasFilasDeConcepto(figs, conceptoTop).map((x) => x.entidad);
  else { const v = new Set(); for (const c of conceptos) for (const { entidad } of _todasLasFilasDeConcepto(figs, c)) v.add(entidad); entidadesEnJuego = [...v]; }
  if (!entidadesEnJuego.length) return null;

  const porEntidad = new Map();   // nombre → Map(clave → fig)
  for (const c of conceptos) for (const { entidad, fig } of _todasLasFilasDeConcepto(figs, c)) {
    if (!entidadesEnJuego.includes(entidad)) continue;
    if (!porEntidad.has(entidad)) porEntidad.set(entidad, new Map());
    porEntidad.get(entidad).set(c, fig);
  }
  const claveOrden = conceptoTop || conceptos[0];
  const dirMenor = top ? top.direccion === "menor" : (metricaPorClave(claveOrden) || {}).polaridad === "menor";
  const _num = (f) => (f && Number.isFinite(f.raw) ? f.raw : NaN);
  const orden = [...entidadesEnJuego].sort((a, b) => { const va = _num(porEntidad.get(a) && porEntidad.get(a).get(claveOrden)), vb = _num(porEntidad.get(b) && porEntidad.get(b).get(claveOrden)); if (!Number.isFinite(va) || !Number.isFinite(vb)) return 0; return dirMenor ? va - vb : vb - va; });
  return { kind: "grupo", tema: parte.tema, parteId: parte.id, cierre: parte.cierre, eje, conceptos, porEntidad, orden, claveOrden, universoDecl: { top: top || null, entidades: orden } };
}

/* ── PLAN «multitema» (cierre `lectura`/`decision` SIN entidades, 1..N temas: reusa `prioridadIntegrada`, LA
 * MISMA función que ya certifica `componerEntregaMultidominio` — nunca una segunda prioridad). Con un solo tema,
 * `prioridadIntegrada` sigue siendo la fuente: su «integrada» degenera al líder de ese único dominio (nunca se
 * inventa una prioridad distinta para el caso de 1 tema). ── */
function _planMultiTema(temas, figs, ref, declararRazon, declararDerivada, { conDecision }) {
  const P = prioridadIntegrada(figs, temas);
  if (!P || !Object.keys(P.porDominio).length) return null;
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
  for (const d of Object.keys(P.porDominio)) { const x = P.porDominio[d][0]; if (x) lideres[d] = { x, ids: declararSenales(d, x) }; }
  const top = P.integrada[0] || null;
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
    if (figVencidoTotal) { const idTotal = ref(figVencidoTotal); idShare = idTotal ? declararRazon(lideres.cobranza.ids.materialidad, idTotal) : null; }
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
  const idBenchComercial = temas.includes("comercial") ? ref(_find(figs, /^Benchmark de margen$/i)) : null;
  return { kind: "multitema", temas, conDecision, lideres, top, idsIntegrada, idsVersus, idShare, versusLider, idBenchComercial };
}

/* ── PLAN «comparacion» (2 entidades, mismo eje — `compareEntities`) ─────────────────────────────────────────── */
function _planComparacion(parte, figs, ref, declararDerivada) {
  const [a, b] = parte.entidades;
  if (!a || !b) return null;
  const figsA = _figsDeEntidad(figs, a.nombre), figsB = _figsDeEntidad(figs, b.nombre);
  const conceptosA = new Map(figsA.map((f) => [_conceptoDeLabel(_lab(f)), f]));
  const pares = [];
  for (const [concepto, figA] of conceptosA) {
    const figB = figsB.find((f) => _conceptoDeLabel(_lab(f)) === concepto);
    if (!figB) continue;
    const idA = ref(figA), idB = ref(figB);
    if (!idA || !idB) continue;
    const idDiff = declararDerivada(figA, idA, figB, idB);
    pares.push({ concepto, idA, idB, idDiff });
  }
  if (!pares.length) return null;
  return { kind: "comparacion", tema: parte.tema, parteId: parte.id, a: a.nombre, b: b.nombre, pares };
}

/* ── PLAN «simulacion» (`simulate*` ya resuelto por `lecturasDe`/`validar.js`: acá solo se clasifican las figs
 * que la tool devolvió en las CINCO piezas del plan (§1, ejemplo §7): base · supuesto · resultado · delta ·
 * límites. Ninguna pieza que la tool no sostenga se inventa — se declara ausente (mecanismo 7: «lo que no está en
 * los datos se dice como hallazgo, no como excusa»). El SUPUESTO no es una fig: es el dato del encargo que el
 * usuario ya declaró (`Supuesto`, procedencia `supuesto_usuario`) — la casa no lo verifica contra la boleta,
 * solo lo cita con su dueño. ── */
function _planSimulacion(parte, figs, supuesto, ref, declararDerivada) {
  if (!figs.length) return null;
  const resultado = [], base = [];
  for (const f of figs) {
    const concepto = _conceptoDeLabel(_lab(f));
    const id = ref(f);
    if (!id) continue;
    if (/supuest[oa]|meta\s*·/i.test(concepto)) resultado.push({ concepto, id, fig: f });
    else base.push({ concepto, id, fig: f });
  }
  if (!resultado.length && !base.length) return null;
  // delta: cuando resultado[0] y una base con el MISMO prefijo de concepto (ej. «Costo» ↔ «Costo supuesto») existen —
  // nunca un delta entre conceptos distintos.
  let idDelta = null;
  const _normConcepto = (s) => String(s || "").replace(/\s*(actual|supuest[oa]|propuest[oa])\s*$/i, "").trim().toLowerCase();
  if (resultado.length) {
    for (const r of resultado) {
      const prefijo = _normConcepto(r.concepto);
      const b0 = base.find((x) => _normConcepto(x.concepto) === prefijo);
      if (b0) { idDelta = declararDerivada(r.fig, r.id, b0.fig, b0.id); if (idDelta) break; }
    }
  }
  return { kind: "simulacion", tema: parte.tema, parteId: parte.id, supuesto, base, resultado, idDelta, sinDelta: !idDelta };
}

/* ── PLAN «definicion» — sin figs, sin dígitos: `defineConcept` nunca lee la boleta (contrato §1.1). ─────────── */
function _planDefinicion(parte, facts) {
  if (!facts || !facts.es_definicion) return null;
  return { kind: "definicion", tema: parte.tema, parteId: parte.id, concepto: facts.concepto, definicion: facts.definicion, distingue: facts.distingue || null };
}

/** componerEntrega(resolucion) → { texto, entrega, libro, ok, motivo }. Recibe la `Resolucion` del validador
 *  (`encargo/validar.js`), corre `lecturasDe(resolucion)` sobre el Core y arma la Entrega de siete partes para
 *  CUALQUIER encargo válido — generalización de las 4 funciones de arriba (que quedan como envolturas/fixtures
 *  de equivalencia, ver la cabecera). CERO lectura de `resolucion.encargo.preguntaOriginal` (carnada del gate). */
export function componerEntrega(resolucion) {
  const canonica = _delegarRutaCanonica(resolucion);
  if (canonica) return canonica;

  if (!resolucion || !Array.isArray(resolucion.partes)) return _vacia("sin resolución: nada que componer");
  const partesUtiles = resolucion.partes.filter((p) => p.estado === "resuelta" || p.estado === "parcial");
  if (!partesUtiles.length) return _vacia("ningún tema del encargo quedó resuelto ni parcial: nada que componer");

  const scenario = ESCENARIO_INICIAL;
  const { plan, porParte } = lecturasDe(resolucion);
  if (!plan || !plan.calls.length) return _vacia("el encargo no generó ninguna lectura del Core");
  const rp = runPlan(plan, { scenario, maxCalls: Math.max(8, plan.calls.length), preguntaUsuario: null, registry: REGISTRO_LECTURAS });
  const figs = asignarIds((rp.ledger && rp.ledger.figs) || []);
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

  const { I, ejesDelTenant } = _indiceDelTenant(figs, scenario);
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

  // ── FASE 1 · declarar (por parte, según cierre) — nunca leer `preguntaOriginal` ──
  const planes = [];
  const limitesGap = [];
  const _limiteUniversoNoSoportado = (p) => ({ titulo: `Sobre la parte ${p.id} (${_DOM_NOMBRE[p.tema] || p.tema}), el filtro del universo no se aplica todavía en este corte`, motivo: "Filtrar por estado o por un umbral numérico exige evaluar cada entidad contra el dato real; ese motor no está construido en este corte (queda señalado para el corte 3c). Se declina esta parte en vez de servir un listado sin filtrar o adivinar el criterio." });

  const partesLecturaDecisionSinEntidad = partesUtiles.filter((p) => ["lectura", "decision"].includes(p.cierre) && !(p.entidades && p.entidades.length));
  // CORTE 3c · pieza 1 (owner 2026-09-25): separa el universo-por-estado SIN `top` (D14/D19 — se compone abajo,
  // con los conjuntos que el Core ya calcula) del resto de universos no soportados (con `top` combinado con
  // estados/filtros: combinación fuera del catálogo de desarrollo, sigue declinándose como antes).
  const partesUniversoPorEstado = partesLecturaDecisionSinEntidad.filter((p) => _universoPorEstadoSinTop(p.universo));
  const partesUniversoNoSoportado = partesLecturaDecisionSinEntidad.filter((p) => _universoNoSoportado(p.universo) && !_universoPorEstadoSinTop(p.universo));
  for (const p of partesUniversoNoSoportado) limitesGap.push(_limiteUniversoNoSoportado(p));
  for (const p of partesUniversoPorEstado) {
    const r = _cerrarGrupoUniverso(p, _figsDeParte(p.id), I, hechos, contador, ref, declararRazon);
    if (r.error) { limitesGap.push({ titulo: `Sobre la parte ${p.id} (${_DOM_NOMBRE[p.tema] || p.tema}), el universo declarado no se pudo evaluar`, motivo: r.error }); continue; }
    planes.push(r);
  }
  const partesSinEntidadLecturaDecision = partesLecturaDecisionSinEntidad.filter((p) => !_universoNoSoportado(p.universo));
  const partesYaAgrupadas = new Set([...partesSinEntidadLecturaDecision, ...partesUniversoNoSoportado, ...partesUniversoPorEstado].map((p) => p.id));
  if (partesSinEntidadLecturaDecision.length) {
    const temas = [...new Set(partesSinEntidadLecturaDecision.map((p) => p.tema))];
    const conDecision = partesSinEntidadLecturaDecision.some((p) => p.cierre === "decision");
    const figsDelGrupo = _figsDePartes(partesSinEntidadLecturaDecision.map((p) => p.id));
    const plan = _planMultiTema(temas, figsDelGrupo, ref, declararRazon, declararDerivada, { conDecision });
    if (plan) { plan.partesIds = partesSinEntidadLecturaDecision.map((p) => p.id); planes.push(plan); }
    else for (const p of partesSinEntidadLecturaDecision) partesYaAgrupadas.delete(p.id);   // sin evidencia suficiente: cada parte cae en su propio "no se pudo componer" abajo
  }
  for (const p of partesUtiles) {
    if (partesYaAgrupadas.has(p.id)) continue;
    const figsDeP = _figsDeParte(p.id);
    if (p.cierre === "cifra" || ((p.cierre === "lectura" || p.cierre === "decision") && p.entidades && p.entidades.length)) {
      if (p.entidades && p.entidades.length) { const plan = _planCifraEntidad(p, figsDeP, ref); if (plan) planes.push(plan); }
      else if (p.cierre === "cifra") {
        // CORTE 3c · pieza 1 (D07): universo por estado/filtro SIN `top` — el mismo camino que arriba, para el
        // cierre `cifra`.
        if (_universoPorEstadoSinTop(p.universo)) {
          const r = _cerrarGrupoUniverso(p, figsDeP, I, hechos, contador, ref, declararRazon);
          if (r.error) { limitesGap.push({ titulo: `Sobre la parte ${p.id} (${_DOM_NOMBRE[p.tema] || p.tema}), el universo declarado no se pudo evaluar`, motivo: r.error }); continue; }
          planes.push(r);
          continue;
        }
        if (_universoNoSoportado(p.universo)) { limitesGap.push(_limiteUniversoNoSoportado(p)); continue; }
        const plan = _planCifraGrupo(p, figsDeP);
        if (plan) {
          // tentación precalculada (mecanismo 6): la diferencia entre el primero y el segundo del listado, en la
          // MISMA métrica que ordena — se captura el fig ANTES de convertir el mapa a ids (unit-aware), y se
          // declara DESPUÉS con los mismos ids que ya va a imprimir la tabla (nunca una segunda referencia a la fig).
          const figA0 = plan.orden.length > 1 ? plan.porEntidad.get(plan.orden[0]).get(plan.claveOrden) : null;
          const figB0 = plan.orden.length > 1 ? plan.porEntidad.get(plan.orden[1]).get(plan.claveOrden) : null;
          for (const e of plan.orden) for (const [clave, fig] of plan.porEntidad.get(e)) plan.porEntidad.get(e).set(clave, ref(fig));
          if (figA0 && figB0) plan.idDiffOrden = declararDerivada(figA0, plan.porEntidad.get(plan.orden[0]).get(plan.claveOrden), figB0, plan.porEntidad.get(plan.orden[1]).get(plan.claveOrden));
          planes.push(plan);
        }
      }
    } else if (p.cierre === "comparacion") {
      const plan = _planComparacion(p, figsDeP, ref, declararDerivada); if (plan) planes.push(plan);
    } else if (p.cierre === "simulacion") {
      // el/los id(s) que ESTA parte cita viven en `Parte.supuestos` del encargo CRUDO (`resolucion.encargo.partes`),
      // no en `ParteResuelta` (§1.1 del contrato: campo estructurado que `validarEncargo` no reproyecta — el mismo
      // que ya lee `lecturasDe.js`). Se toma el PRIMER supuesto citado que sí resolvió (con productor): nunca se
      // sustituye por uno que la parte no citó.
      const crudaP = ((resolucion.encargo && resolucion.encargo.partes) || []).find((x) => x && x.id === p.id);
      const citados = crudaP && Array.isArray(crudaP.supuestos) ? crudaP.supuestos : [];
      const supuesto = citados.map((sid) => (resolucion.supuestos || []).find((s) => s.id === sid)).find(Boolean) || null;
      const planS = _planSimulacion(p, figsDeP, supuesto, ref, declararDerivada);
      if (planS) planes.push(planS);
    } else if (p.cierre === "definicion") {
      // la call de ESTA parte es SIEMPRE una sola (`_pasosDefinicion`, lecturasDe.js) — se ubica por su índice
      // real en `plan.calls` (mismo mecanismo de procedencia que `_figsDeParte`), nunca "el primer resultado con
      // es_definicion" del turno entero (eso mezclaba partes cuando había más de una `definicion` en un encargo).
      const idxs = [..._callIdsDePartes([p.id])].map((cid) => Number(cid.slice(1)));
      const facts = idxs.map((i) => rp.results[i] && rp.results[i].facts).find((f) => f && f.es_definicion && f.concepto)
        || rp.results.map((r) => r.facts).find((f) => f && f.es_definicion && f.concepto);   // sin índice hallado (defensivo): no se pierde la única definición del turno
      const plan = _planDefinicion(p, facts); if (plan) planes.push(plan);
    }
  }
  if (!planes.length) {
    if (limitesGap.length) return _vacia(`ninguna parte se pudo componer: ${limitesGap.map((l) => l.titulo).join(" · ")}`);
    return _vacia("ninguna parte del encargo produjo evidencia suficiente para componer la Entrega");
  }

  // «comparables viajan juntas» (mecanismo 3 del plan): cualquier plan comercial puede citar «brecha»/«benchmark»
  // en su prosa (carga alta, brecha al benchmark, contribución no capturada…) — el Marco declara la referencia
  // UNA vez, ANTES de saber si el texto la va a necesitar (se declara igual, sin costo: `ref()` de un hecho que
  // no se imprime no rompe nada). Mismo patrón que ya usan las 4 rutas fijas y la ruta multidominio de arriba.
  const idBenchComercialGlobal = planes.some((pl) => pl.tema === "comercial" || (pl.kind === "multitema" && pl.temas.includes("comercial"))) ? ref(_find(figs, /^Benchmark de margen$/i)) : null;
  // CORTE 3c · pieza 1 — un `grupoUniverso` comercial puede nombrar «benchmark»/«nivel de carga» en el texto de su
  // universo (`nombrarUniverso`, vía `_fmtUmbral`): declararlo acá, ANTES de imprimir, es el mismo patrón que la
  // línea de arriba — un `ref()` de un hecho que el texto termina no usando no rompe nada.

  const libro = libroDeHechos(hechos, { indice: I });
  const rotos = libro.hechos.filter((h) => !h.ok);
  if (rotos.length) return { texto: "", entrega: null, libro, ok: false, motivo: `${rotos.length} hecho(s) no verificaron: ${rotos.map((h) => `${h.id} (${h.motivo})`).join(" · ")}` };

  // ── FASE 2 · renderizar (SOLO desde `R(id)`, nunca un número a mano) ──
  const entrega = crearEntrega();
  const cifrasImpresas = [];
  const R = (id) => { const v = renderDe(libro, id); if (v != null) cifrasImpresas.push(v); return v; };
  entrega.cifras.columnas = ["Entidad / grupo", "Tema", "Métrica", "Valor", "Tipo"];
  const temasCubiertos = new Set();
  const _fila = (entidad, tema, etiqueta, id) => { const procedencia = _procedenciaDeFila(libro, [id]); return { valores: { "Entidad / grupo": entidad, "Tema": _DOM_NOMBRE[tema] || tema, "Métrica": etiqueta, "Valor": R(id), "Tipo": _textoDeTipo(procedencia) }, hechos: [id], procedencia }; };

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
      for (const s of [H.verdad, H.motivo, ...(H.derivados || []).map((d) => { const D = libroPremisas.porId.get(d); return D && (D.verdad || D.motivo); })]) if (s) cifrasImpresas.push(s);
    }
    // se abre por el orden de las PARTES del encargo (determinístico, nunca el orden en que el usuario escribió
    // las premisas): «la Entrega abre la parte correspondiente» — una premisa, una vez, en la parte que le toca.
    for (const p of partesUtiles) {
      const items = premisasPorParte.get(p.id);
      if (!items || !items.length) continue;
      for (const H of items) entrega.respuesta.push({ texto: _textoDePremisa(H, libroPremisas), hechos: [H.id], _premisa: true });
    }
  }

  for (const plan of planes) {
    if (plan.kind === "entidad") {
      for (const { entidad, eje, filas } of plan.filasPorEntidad) {
        if (!filas.length) continue;
        temasCubiertos.add(plan.tema);
        for (const f of filas) entrega.cifras.filas.push(_fila(entidad, plan.tema, f.etiqueta, f.id));
        const frases = filas.slice(0, 5).map((f) => `${f.etiqueta.toLowerCase()} ${R(f.id)}`);
        const texto = `${entidad}: ${frases.join(", ")}.`;
        entrega.respuesta.push({ texto, hechos: filas.map((f) => f.id) });
        _declararUniverso(entrega, I, { id: `${plan.parteId}_${entidad}`, eje: eje || "cliente", entidades: [entidad] });
      }
    } else if (plan.kind === "grupo") {
      temasCubiertos.add(plan.tema);
      for (const entidad of plan.orden) {
        const m = plan.porEntidad.get(entidad);
        for (const [clave, id] of m) { if (id == null) continue; entrega.cifras.filas.push(_fila(entidad, plan.tema, _labelDeClave(clave) || clave, id)); }
      }
      const cabeza = plan.orden.slice(0, 3).map((e) => { const id = plan.porEntidad.get(e).get(plan.claveOrden); return id != null ? `${e} (${R(id)})` : e; }).join(", ");
      const idsCabeza = plan.orden.flatMap((e) => [...plan.porEntidad.get(e).values()]).filter((v) => v != null);
      // «un top-N declara su cola» (ley del owner): con `universo.top`, el tamaño TOTAL del eje sale del mismo
      // índice que ya usan las 4 rutas fijas (`ejesDelTenant`) — nunca un número a mano; sin `top`, el listado YA
      // es el eje completo (no hay cola que declarar).
      const totalEje = ejesDelTenant[plan.eje] ? ejesDelTenant[plan.eje].length : null;
      const prefijo = plan.universoDecl.top && totalEje != null ? `El top ${plan.universoDecl.top.k} de ${totalEje} ${plan.eje}` : `Por ${plan.eje}`;
      if (plan.universoDecl.top && totalEje != null) { cifrasImpresas.push(String(totalEje)); cifrasImpresas.push(String(plan.universoDecl.top.k)); }
      entrega.respuesta.push({ texto: `${prefijo}, ordenado por ${_labelDeClave(plan.claveOrden) || plan.claveOrden}: ${cabeza}.`, hechos: idsCabeza });
      _declararUniverso(entrega, I, { id: plan.parteId, eje: plan.eje, top: plan.universoDecl.top, entidades: plan.orden });
    } else if (plan.kind === "comparacion") {
      temasCubiertos.add(plan.tema);
      for (const p of plan.pares) {
        entrega.cifras.filas.push(_fila(plan.a, plan.tema, p.concepto, p.idA));
        entrega.cifras.filas.push(_fila(plan.b, plan.tema, p.concepto, p.idB));
        if (p.idDiff) entrega.cifras.filas.push(_fila(`${plan.a} − ${plan.b}`, plan.tema, `Diferencia · ${p.concepto}`, p.idDiff));
      }
      const frases = plan.pares.slice(0, 4).map((p) => `en ${p.concepto.toLowerCase()}, ${plan.a} ${R(p.idA)} contra ${plan.b} ${R(p.idB)}`);
      entrega.respuesta.push({ texto: `Comparando ${plan.a} y ${plan.b}: ${frases.join("; ")}.`, hechos: plan.pares.flatMap((p) => [p.idA, p.idB]) });
      _declararUniverso(entrega, I, { id: plan.parteId, eje: (resolucion.partes.find((p) => p.id === plan.parteId) || {}).eje || "cliente", entidades: [plan.a, plan.b] });
    } else if (plan.kind === "simulacion") {
      temasCubiertos.add(plan.tema);
      for (const b of plan.base) entrega.cifras.filas.push(_fila("Base (real)", plan.tema, b.concepto, b.id));
      for (const r of plan.resultado) entrega.cifras.filas.push(_fila("Resultado (con el supuesto)", plan.tema, r.concepto, r.id));
      if (plan.idDelta) entrega.cifras.filas.push(_fila("Delta", plan.tema, "Resultado − base", plan.idDelta));
      // el valor del supuesto NO es un hecho del libro (es el dato que el usuario ya declaró, procedencia
      // `supuesto_usuario` — plan §1 «de qué tipo: medido, estimado, supuesto suyo»): se registra en
      // `cifrasImpresas` igual que el período o el universo (mismo patrón que las 4 rutas fijas), para que la
      // regla «cero cifras desnudas» no lo confunda con un número sin dueño.
      const _valorSupuesto = plan.supuesto ? `${plan.supuesto.valor}${plan.supuesto.unidad === "pct" ? "%" : plan.supuesto.unidad === "pp" ? "pp" : ""}` : null;
      if (_valorSupuesto) cifrasImpresas.push(_valorSupuesto);
      const sTxt = plan.supuesto ? `${plan.supuesto.tipo} ${_valorSupuesto}${plan.supuesto.unidad !== "pct" && plan.supuesto.unidad !== "pp" ? ` ${plan.supuesto.unidad}` : ""}, declarado por usted (supuesto suyo, no medido)` : "un supuesto declarado por usted";
      const rFrases = plan.resultado.slice(0, 3).map((r) => `${r.concepto.toLowerCase()} ${R(r.id)}`);
      const texto = `Simulación — supuesto: ${sTxt}. Resultado: ${rFrases.join(", ") || "sin cifra propia de este escenario"}${plan.idDelta ? `; delta contra lo real: ${R(plan.idDelta)}` : ""}.`;
      entrega.respuesta.push({ texto, hechos: [...plan.base.map((b) => b.id), ...plan.resultado.map((r) => r.id), plan.idDelta].filter(Boolean) });
      entrega.limites.push({ titulo: "Este resultado es un escenario hipotético, no lo que ya ocurrió", motivo: "El supuesto lo declaró usted; ADI calcula el efecto sobre el dato real, pero no afirma que vaya a pasar." });
      if (plan.sinDelta) entrega.limites.push({ titulo: "El delta contra lo real no se pudo aislar como cifra propia", motivo: "La simulación no publicó una cifra 'base' con el mismo concepto que el resultado: se declara la base y el resultado por separado, sin restar a mano." });
    } else if (plan.kind === "definicion") {
      temasCubiertos.add(plan.tema);
      const texto = `${plan.concepto}: ${plan.definicion}${plan.distingue ? ` ${plan.distingue}` : ""}`;
      entrega.respuesta.push({ texto, hechos: [], _definicion: true });
    } else if (plan.kind === "grupoUniverso") {
      // CORTE 3c · pieza 1 — EL GRUPO ES EL HECHO `conteo` (K de M, ya verificado): la Respuesta y las Cifras solo
      // RENDERIZAN lo que ese hecho ya declaró, nunca listan un miembro que el conteo no cuenta.
      temasCubiertos.add(plan.tema);
      const kTxt = R(plan.idConteo), mTxt = renderDe(libro, plan.idConteo, "m"), uTxt = renderDe(libro, plan.idConteo, "universo");
      if (mTxt != null) cifrasImpresas.push(mTxt);
      const claveTentTxt = plan.claveTentacion ? _labelDeClave(plan.claveTentacion) : null;
      const tentacion = plan.idTotal ? ` En conjunto, ${claveTentTxt ? claveTentTxt.toLowerCase() : "el total"} suma ${R(plan.idTotal)}${plan.idShare ? `; ${plan.miembros[0]} concentra el ${R(plan.idShare)}` : ""}.` : "";
      const texto = `Sobre ${_DOM_NOMBRE[plan.tema] || plan.tema}: hay ${kTxt}${mTxt ? ` de ${mTxt}` : ""} en ${uTxt || "el universo declarado"}${plan.miembros.length ? `: ${plan.miembros.join(", ")}` : ""}.${tentacion}`;
      entrega.respuesta.push({ texto, hechos: [plan.idConteo, plan.idTotal, plan.idShare].filter(Boolean) });
      for (const nombre of plan.miembros) {
        const m = plan.porEntidad.get(nombre);
        for (const [clave, id] of m) { if (id == null) continue; entrega.cifras.filas.push(_fila(nombre, plan.tema, _labelDeClave(clave) || clave, id)); }
      }
      if (plan.idTotal) {
        const procedenciaTotal = _procedenciaDeFila(libro, [plan.idTotal]);
        entrega.cifras.filas.push({ valores: { "Entidad / grupo": `Total (${plan.n} ${plan.eje})`, "Tema": _DOM_NOMBRE[plan.tema] || plan.tema, "Métrica": claveTentTxt || "", "Valor": R(plan.idTotal), "Tipo": _textoDeTipo(procedenciaTotal, { subtotal: true }) }, hechos: [plan.idTotal], procedencia: procedenciaTotal });
      }
      // decision (D19): la conclusión sale del análisis — el criterio ya resuelto por `validarEncargo` (nunca
      // una premisa del usuario) decide quién abre la fila; la cifra que sostiene «el primero» es la MISMA que
      // ya ordenó el grupo (`claveOrden`, ya declarada y renderizada arriba — nunca una segunda referencia).
      if (plan.cierre === "decision" && resolucion.criterio && plan.miembros.length) {
        const lenteTxt = resolucion.criterio.lente ? (metricaPorClave(resolucion.criterio.lente) ? metricaPorClave(resolucion.criterio.lente).nombre.toLowerCase() : resolucion.criterio.lente) : (resolucion.criterio.referencia && resolucion.criterio.referencia.concepto);
        const idPrimero = plan.claveOrden ? plan.porEntidad.get(plan.miembros[0]).get(plan.claveOrden) : null;
        if (lenteTxt && idPrimero != null) entrega.respuesta.push({ texto: `Prioridad del procedimiento dentro de este grupo, por ${lenteTxt}: ${plan.miembros[0]}, con ${R(idPrimero)} en ${(plan.claveOrden ? _labelDeClave(plan.claveOrden) : lenteTxt).toLowerCase()}.`, hechos: [plan.idConteo, idPrimero] });
        else if (lenteTxt) entrega.respuesta.push({ texto: `Prioridad del procedimiento dentro de este grupo, por ${lenteTxt}: ${plan.miembros[0]} (${kTxt} de ${mTxt} en ${uTxt}).`, hechos: [plan.idConteo] });
      }
      _declararUniverso(entrega, I, { id: plan.parteId, eje: plan.eje, filtros: (plan.universo && plan.universo.filtros) || null, estados: (plan.universo && plan.universo.estados) || null, no_estados: (plan.universo && plan.universo.no_estados) || null, entidades: plan.miembros });
    } else if (plan.kind === "multitema") {
      const frase = (dominio, lente, ids) => (ids && ids[lente]) ? LENTES[dominio][lente].como(R(ids[lente])) : null;
      const filasVistas = new Set();   // dedup: idsIntegrada/idsVersus pueden repetir la MISMA señal que ya declaró `lideres` (mismo id, cacheado en `_planMultiTema`)
      const _filaDedup = (entidad, dominio, etiqueta, id) => { const k = `${dominio}::${entidad}::${id}`; if (filasVistas.has(k)) return; filasVistas.add(k); entrega.cifras.filas.push(_fila(entidad, dominio, etiqueta, id)); };
      for (const d of plan.temas) {
        temasCubiertos.add(d);
        const L = plan.lideres[d];
        if (!L) continue;
        const partesFrase = ["materialidad", "severidad", "urgencia"].map((l) => frase(d, l, L.ids)).filter(Boolean);
        // tentación precalculada (mecanismo 6): la ventaja del líder sobre el segundo, cuando este dominio es el
        // que la trae (ver `versusLider` en `_planMultiTema`) — la MISMA fila que ya se declaró, citada acá.
        const vs = plan.versusLider && plan.versusLider.dominio === d ? plan.versusLider : null;
        const claveVs = vs ? [vs.idDiff] : [];
        const clausulaVs = vs ? ` — ${R(vs.idDiff)} más que ${vs.segundo}` : "";
        entrega.respuesta.push({ texto: `En ${_DOM_NOMBRE[d]}, quien más pesa es ${L.x.entidad}: ${partesFrase.join(", ")}${clausulaVs}.`, hechos: [...Object.values(L.ids).filter(Boolean), ...claveVs] });
        for (const [lente, id] of Object.entries(L.ids)) if (id != null) _filaDedup(L.x.entidad, d, LENTES[d][lente].nombre, id);
        if (vs) _filaDedup(`${vs.entidad} − ${vs.segundo}`, d, "Diferencia · materialidad", vs.idDiff);
      }
      if (plan.top && plan.idsIntegrada) {
        const partesTop = [];
        for (const d of Object.keys(plan.idsIntegrada)) for (const l of ["materialidad", "severidad", "urgencia"]) { const t = frase(d, l, plan.idsIntegrada[d]); if (t) partesTop.push(`${_DOM_NOMBRE[d]}: ${t}`); for (const [ll, id] of Object.entries(plan.idsIntegrada[d])) if (id != null) _filaDedup(plan.top.entidad, d, LENTES[d][ll].nombre, id); }
        const coincide = plan.top.dominios.length > 1 ? ` — coincide en ${plan.top.dominios.map((dd) => _DOM_NOMBRE[dd]).join(" y ")}` : "";
        const prefijoDecision = plan.conDecision ? "Prioridad del procedimiento" : "Quien más pesa en el conjunto";
        // «con otra lente cambia quién va primero» (decision, criterio declarado) — CLÁUSULA de la MISMA oración,
        // no una oración aparte: una oración sin cifra propia rompe la regla «dueño + métrica + valor» del plan.
        const cierreLente = plan.conDecision ? " Con otra lente (por ejemplo, contribución o ventas) puede cambiar quién va primero: esta es la lectura de riesgo integrado del procedimiento." : "";
        entrega.respuesta.push({ texto: `${prefijoDecision}, por riesgo integrado: ${plan.top.entidad}${coincide} (${partesTop.join("; ")}).${cierreLente}`, hechos: Object.values(plan.idsIntegrada).flatMap((o) => Object.values(o)).filter(Boolean) });
      }
      if (plan.top && plan.idsVersus && plan.idsVersus.length) {
        const comparativos = plan.idsVersus.map(({ it, idA, idB }) => `${it.nombre} (${R(idA)} contra ${R(idB)})`).join(", ");
        for (const { it, idA, idB } of plan.idsVersus) { _filaDedup(plan.top.entidad, it.dominio, it.nombre || it.metrica, idA); _filaDedup(plan.top.versus.contra, it.dominio, it.nombre || it.metrica, idB); }
        entrega.respuesta.push({ texto: `${plan.top.entidad} va antes que ${plan.top.versus.contra}: es peor en ${comparativos}.`, hechos: plan.idsVersus.flatMap((x) => [x.idA, x.idB]).filter(Boolean) });
      }
      if (plan.lideres.cobranza && plan.idShare) {
        _filaDedup(plan.lideres.cobranza.x.entidad, "cobranza", "Participación del vencido total", plan.idShare);
        entrega.respuesta.push({ texto: `De lo vencido en toda la cartera, ${plan.lideres.cobranza.x.entidad} concentra el ${R(plan.idShare)}.`, hechos: [plan.idShare] });
      }
      if (plan.idBenchComercial) entrega.marco.referenciaDeclarada = entrega.marco.referenciaDeclarada || { texto: `Benchmark de margen (comercial): ${R(plan.idBenchComercial)}, declarado por usted.`, hechoId: plan.idBenchComercial };
    }
  }
  entrega.respuesta = entrega.respuesta.filter((r) => r.hechos.length || r._definicion);
  if (!entrega.respuesta.length) return _vacia("ninguna parte produjo una oración con evidencia — nada que servir");

  // ── MARCO, LÍMITES (noResuelto + ausencias), REFERENCIA DEL OFICIO, QUÉ MÁS PUEDO CALCULAR ──
  const nClientes = ejesDelTenant.cliente ? ejesDelTenant.cliente.length : null;
  const { periodo } = _periodoDelMarco(figsUsadas);
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
  if (idBenchComercialGlobal && !entrega.marco.referenciaDeclarada) {
    entrega.marco.referenciaDeclarada = { texto: `Benchmark de margen: ${R(idBenchComercialGlobal)}, declarado por usted.`, hechoId: idBenchComercialGlobal };
  }

  entrega.limites = [..._limitesDeclarados(resolucion, temasCubiertos), ...limitesGap, ...entrega.limites];
  { const lp = _limitePerfilIncompleto(perfil); if (lp) entrega.limites.push(lp); }

  // entidades del USUARIO (ley «pertinencia por encargo», owner 2026-09-24): salen de `resolucion`, NUNCA del texto.
  const entidadesDelUsuario = [...new Set(partesUtiles.flatMap((p) => (p.entidades || []).map((e) => e.nombre)))];
  const entidadesEnRespuesta = [...new Set(planes.flatMap((p) => {
    if (p.kind === "entidad") return p.filasPorEntidad.map((f) => f.entidad);
    if (p.kind === "grupo") return p.orden.slice(0, 2);
    if (p.kind === "comparacion") return [p.a, p.b];
    if (p.kind === "multitema") return Object.values(p.lideres).map((L) => L.x.entidad);
    return [];
  }))];
  const _refOficio = referenciaDelOficioConOfertas({ perfil, pregunta: "", entidadesEnRespuesta, entidadesDeLaPregunta: entidadesDelUsuario, scenario });
  entrega.referenciaDelOficio = _refOficio.salida;

  entrega.queMasPuedoCalcular = { puedo: [..._ofertasTexto(_refOficio.ofertas), "Otro corte del mismo encargo (por entidad, por eje, comparado o simulado)"], noPuedo: ["Lo que el dato no trae (ver «Lo que no se puede concluir»)"] };
  entrega.temasCubiertos = [...temasCubiertos];
  // `libroPremisas` es un campo ADITIVO (corte 3c, pieza 3): nunca reemplaza `libro` (el que `verificarEntrega`
  // audita con la regla 9) — es el libro APARTE de las premisas, para que un gate o el owner puedan auditar el
  // veredicto de cada una sin tener que reconstruirlo.
  entrega.procedencia = { libro, cifrasImpresas, libroPremisas };

  const texto = _textoDeLaEntrega(entrega, "Su encargo");
  return { texto, entrega, libro, ok: true, motivo: "" };
}

/* ── el markdown, en el orden de las siete partes (plan §1) — puro texto, ninguna cifra nueva se escribe acá:
 * todo lo que aparece ya pasó por `R(id)` arriba y vive en `entrega.*`. `titulo` es lo único que cambia entre
 * rutas (era literal «¿Dónde deja de ganar?» hasta la TAREA 3 — generalizado para que la segunda ruta no
 * herede el título de la primera). ── */
function _textoDeLaEntrega(entrega, titulo = "¿Dónde deja de ganar?") {
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
  L.push(`**Marco.** ${cabezaMarco}${cabezaMarco && !/[.!?]\s*$/.test(cabezaMarco) ? ". " : cabezaMarco ? " " : ""}${m.definiciones.join(" ")} ${m.referenciaDeclarada ? m.referenciaDeclarada.texto : ""}`.trim());
  L.push("");
  L.push("**Respuesta.**");
  for (const r of entrega.respuesta) L.push(`▸ ${r.texto}`);
  L.push("");
  L.push(`**Cifras.**`);
  L.push(`| ${entrega.cifras.columnas.join(" | ")} |`);
  L.push(`|${entrega.cifras.columnas.map(() => "---").join("|")}|`);
  for (const f of entrega.cifras.filas) L.push(`| ${entrega.cifras.columnas.map((c) => f.valores[c] || "").join(" | ")} |`);
  L.push("");
  L.push("**Lo que no se puede concluir con estos datos.**");
  for (const lim of entrega.limites) L.push(`- **${lim.titulo}.** ${lim.motivo}`);
  L.push("");
  L.push("**Referencia del oficio** (general, no es un dato ni un objetivo tuyo).");
  if (entrega.referenciaDelOficio.length) for (const r of entrega.referenciaDelOficio) L.push(`- ${r.texto}`);
  else L.push("- Sin conocimiento del sector cargado todavía (ver «Lo que no se puede concluir»).");
  L.push("");
  L.push("**Para su juicio.**");
  for (const p of entrega.paraSuJuicio) L.push(`- ${p.texto}`);
  L.push("");
  L.push("**Qué más puedo calcular.** " + entrega.queMasPuedoCalcular.puedo.join(" · ") + ". **No puedo:** " + entrega.queMasPuedoCalcular.noPuedo.join(" · ") + ".");
  return L.join("\n");
}
