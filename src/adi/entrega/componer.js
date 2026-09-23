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
import { libroDeHechos, asignarIds, renderDe } from "../notario/hechos.js";
import { periodoDeFiguras, reconcilian, UNIVERSOS, PERIODO_TXT } from "../../config/contract/figureType.js";
// TAREA 3 (encargo multidominio, owner 2026-09-23) — LA MISMA hoja y LA MISMA prioridad que ya certifica el
// agente en vivo: «no escribas otra prioridad, sería una segunda verdad». Nada de esto se reescribe acá.
import { partesDelEncargo, dominiosDelEncargo } from "../agente/partesDelEncargo.js";
import { pasosDeDominios } from "../agente/contratoDeDominios.js";
import { prioridadIntegrada, LENTES } from "../agente/prioridadIntegrada.js";
import { crearEntrega } from "./esquema.js";

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

export function componerEntregaBrechaComercial({ scenario = ESCENARIO_INICIAL, pregunta = PREGUNTA_BRECHA_COMERCIAL } = {}) {
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
  entrega.marco = {
    empresa: null,   // el nombre del cliente no viaja en la boleta de este playbook — no se inventa
    periodo,         // HECHO verificable (figureType.UNIVERSOS · periodoDeFiguras) — nunca texto suelto
    universo: nClientes != null ? `${nClientes} clientes` : null,
    moneda: "$",     // el símbolo que la boleta ya imprime — la escala nunca se declara (regla de la casa)
    definiciones: ["Margen = contribución sobre venta neta.", "La brecha estimada es la diferencia contra el benchmark declarado, no dinero ya perdido."],
    referenciaDeclarada: { texto: `Benchmark de margen: ${R(idBench)}, declarado por usted.`, hechoId: idBench },
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
  const _filaCliente = (entidad, ids) => ({
    valores: { Cliente: entidad, Venta: R(ids.venta), Margen: R(ids.margen), "Contribución no capturada (brecha estimada)": R(ids.juego), Tipo: "medido / brecha estimada" },
    hechos: [ids.venta, ids.margen, ids.juego].filter(Boolean),
  });
  entrega.cifras.filas.push(_filaCliente(top.entidad, idsTop));
  if (idsSeg) entrega.cifras.filas.push(_filaCliente(segundo.entidad, idsSeg));
  if (idTotal) entrega.cifras.filas.push({
    valores: { Cliente: "Total (cuentas materiales)", Venta: "", Margen: "", "Contribución no capturada (brecha estimada)": R(idTotal), Tipo: "subtotal" },
    hechos: [idTotal],
  });

  // ── LO QUE NO SE PUEDE CONCLUIR · cada ausencia es un HALLAZGO con título, nunca una prohibición ni una excusa ──
  entrega.limites = [
    { titulo: "La brecha estimada no es dinero ya perdido", motivo: `Es una comparación contra el benchmark que usted declaró (${R(idBench)}); no es recuperable en su totalidad ni necesariamente.` },
    { titulo: `La causa de que ${top.entidad} esté bajo el benchmark no está en los datos`, motivo: "Esta lectura localiza dónde está la brecha, no explica por qué — no hay causalidad sin respaldo." },
    { titulo: "No hay serie mensual de margen por cliente en este dato", motivo: `No se puede afirmar que el margen de ${top.entidad} venga subiendo, bajando o se mantenga: solo que está en el valor de este corte.` },
    { titulo: "Sin conocimiento del sector cargado todavía", motivo: "El Business Knowledge (benchmarks del sector) todavía no está construido: esta Entrega compara solo contra el benchmark que usted declaró, no contra el sector." },
  ];
  // El Marco YA declara el período con verdad (tipo "cerrado", año cerrado — ver `_periodoDelMarco`); lo único
  // que el pack no sostiene es el RANGO calendario (fecha de inicio/fin). Se declara como límite, no se inventa
  // una fecha — ver la nota de `_periodoDelMarco` sobre el hueco de ingesta exacto.
  if (faltaRango) entrega.limites.push({ titulo: "El período no declara un rango de fechas calendario", motivo: "El dato confirma que es el año cerrado (12 meses ya ocurridos), pero el pack no trae una fecha de cierre para el universo comercial — a diferencia de la cobranza, que sí la declara (flujoComercial.fechaCorte). No se afirma un mes ni un año." });

  // ── REFERENCIA DEL OFICIO · vacía en este corte a propósito (ver el límite de arriba) — no se inventa contenido
  entrega.referenciaDelOficio = [];

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

  // ── QUÉ MÁS PUEDO CALCULAR · menú sin cifras (no necesita verificación numérica) ──
  entrega.queMasPuedoCalcular = {
    puedo: [
      `Margen por producto dentro de ${top.entidad}`,
      "Carga comercial alta, cuenta por cuenta",
      "Ranking completo por contribución no capturada",
      "Simular un cambio de carga o de precio en la cuenta prioritaria",
    ],
    noPuedo: ["Quién dejó de comprar qué (no hay historial cliente×SKU)", "La causa exacta de la brecha (el dato localiza, no explica)"],
  };

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
export function componerEntregaCobranza({ scenario = ESCENARIO_INICIAL, pregunta = PREGUNTA_COBRANZA } = {}) {
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
  entrega.marco = {
    empresa: null,
    periodo,
    universo: nClientes != null ? `${nClientes} clientes` : null,
    moneda: "$",
    definiciones: ["Saldo pendiente = venta a crédito menos lo ya abonado.", "El saldo vencido es la parte del saldo pendiente que ya superó su plazo de pago; sin plazo declarado no se calcula — nunca se declara en cero."],
    referenciaDeclarada: null,   // cobranza no compara contra un benchmark — no se inventa uno (regla 4 generalizada)
  };
  if (nClientes != null) cifrasImpresas.push(`${nClientes} clientes`);
  if (periodo && periodo.texto) cifrasImpresas.push(periodo.texto);

  // ── RESPUESTA ──
  const respuesta = [];
  {
    const vSaldo = R(idSaldoTotal), vVenta = idVentaTotal ? R(idVentaTotal) : null, vAbonado = idAbonadoTotal ? R(idAbonadoTotal) : null;
    const esCredito = /a crédito/i.test(_lab(figVentaTotal));
    const texto = vVenta && vAbonado
      ? `Tiene ${vSaldo} por cobrar, de una venta${esCredito ? " a crédito" : ""} de ${vVenta} — ya le abonaron ${vAbonado}.`
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
  const _filaCliente = (entidad, ids) => ({
    valores: { Cliente: entidad, "Saldo pendiente": R(ids.saldo), "Saldo vencido": ids.vencido ? R(ids.vencido) : "—", Tipo: ids.vencido ? "medido" : "medido / vencido no calculado" },
    hechos: [ids.saldo, ids.vencido].filter(Boolean),
  });
  entrega.cifras.filas.push(_filaCliente(topEntidad, idsTop));
  if (idsSeg) entrega.cifras.filas.push(_filaCliente(segundoEntidad, idsSeg));
  entrega.cifras.filas.push({
    valores: { Cliente: "Total (cartera)", "Saldo pendiente": R(idSaldoTotal), "Saldo vencido": idVencidoTotal ? R(idVencidoTotal) : "—", Tipo: "subtotal" },
    hechos: [idSaldoTotal, idVencidoTotal].filter(Boolean),
  });

  // ── LO QUE NO SE PUEDE CONCLUIR ──
  entrega.limites = [
    { titulo: "El saldo pendiente no es una pérdida", motivo: "Es capital retenido del cliente; sería pérdida solo si se volviera incobrable, y eso no está en los datos." },
    { titulo: "La causa de la deuda no está en los datos", motivo: "Esta lectura localiza cuánto y quién debe, no explica la conducta de pago — no hay causalidad sin respaldo." },
    { titulo: "Sin conocimiento del sector cargado todavía", motivo: "El Business Knowledge (referencias del sector sobre plazos y mora) todavía no está construido." },
  ];
  if (!idVencidoTotal) entrega.limites.push({ titulo: "El vencido no se puede calcular", motivo: "Su empresa no declaró un plazo de pago: sin plazo, no se puede afirmar qué parte del saldo está vencida — nunca se declara en cero. Declárelo y el vencido se calcula solo." });

  // ── REFERENCIA DEL OFICIO · vacía a propósito (mismo motivo que la ruta 1) ──
  entrega.referenciaDelOficio = [];

  // ── PARA SU JUICIO ──
  entrega.paraSuJuicio = idVencidoTotal
    ? [{ texto: `Solo usted puede responder: la deuda de ${topEntidad}, ¿responde a un plazo pactado más largo o a que dejó de pagar a tiempo? El dato mide cuánto y desde cuándo, no por qué.`, hechos: [] }]
    : [{ texto: "Declarar el plazo de pago de cada cliente permite calcular el vencido automáticamente, sin volver a cargar el archivo.", hechos: [] }];

  // ── QUÉ MÁS PUEDO CALCULAR ──
  entrega.queMasPuedoCalcular = {
    puedo: ["Deuda vencida por antigüedad", "Cuánto se vendió a crédito contra al contado", "Ranking completo de deudores"],
    noPuedo: ["Por qué un cliente dejó de pagar a tiempo (el dato mide cuánto, no por qué)", "Riesgo de que la deuda se vuelva incobrable (no hay historial de mora)"],
  };

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
export function componerEntregaInventario({ scenario = ESCENARIO_INICIAL, pregunta = PREGUNTA_INVENTARIO } = {}) {
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
  entrega.marco = {
    empresa: null,
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
  const _filaSku = (s, ids) => ({
    valores: { SKU: s.sku, Bodega: s.bodega || "—", "Capital frenado": R(ids.monto), "Días de inventario": ids.dias ? R(ids.dias) : "—", "Rotación": ids.rot ? R(ids.rot) : "—", Tipo: "medido" },
    hechos: [ids.monto, ids.dias, ids.rot].filter(Boolean),
  });
  entrega.cifras.filas.push(_filaSku(topSku, idsTop));
  if (idsSeg) entrega.cifras.filas.push(_filaSku(segundoSku, idsSeg));
  entrega.cifras.filas.push({
    valores: { SKU: `Total (${bySku.length} SKU frenados)`, Bodega: "", "Capital frenado": R(idTotal), "Días de inventario": "", "Rotación": "", Tipo: "subtotal" },
    hechos: [idTotal],
  });

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
  entrega.limites.push({ titulo: "Sin conocimiento del sector cargado todavía", motivo: "El Business Knowledge (referencias del sector sobre rotación e inventario) todavía no está construido: esta Entrega compara solo contra el umbral de materialidad que tú declaraste, no contra el sector." });
  if (faltaRango) entrega.limites.push({ titulo: "El período no declara una fecha de corte para el inventario", motivo: "El dato confirma que es una foto de inventario a hoy, pero el pack no trae una fecha de corte declarada para este universo — a diferencia de la cobranza, que sí la declara (flujoComercial.fechaCorte). No se afirma una fecha." });

  // ── REFERENCIA DEL OFICIO · vacía a propósito (mismo motivo que las dos rutas anteriores) ──
  entrega.referenciaDelOficio = [];

  // ── PARA SU JUICIO · la MISMA pregunta que ya certifica el playbook (asesoria.js) — no se redacta una nueva ──
  entrega.paraSuJuicio = [
    { texto: `Solo tú puedes responder: ¿qué pasó con esos SKU — fue una sobrecompra, un cambio de temporada, un cliente que no retiró, o un proveedor que llegó tarde? El dato mide cuánto está frenado, no por qué.`, hechos: [] },
  ];

  // ── QUÉ MÁS PUEDO CALCULAR ──
  entrega.queMasPuedoCalcular = {
    puedo: ["Capital frenado por bodega", "Capital por familia y marca", "Detalle de riesgo de quiebre y sobrestock", "Simular el efecto de liberar los SKU frenados"],
    noPuedo: ["Por qué cada SKU quedó frenado (no hay historial de compras ni causa declarada)", "Si conviene transferir stock entre bodegas (ningún SKU está en más de una)"],
  };

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
export function componerEntregaMultidominio({ scenario = ESCENARIO_INICIAL, pregunta = PREGUNTA_MULTIDOMINIO } = {}) {
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
  entrega.marco = {
    empresa: null,
    periodo,
    universo: `${dominios.length} dominios (${domTxt})`,
    moneda: "$",
    definiciones: [
      "Esta Entrega cruza comercial, inventario y cobranza: cada dominio aporta su propia cifra, con su propio universo y su propio marco temporal — nunca se consolidan en un total único.",
      "La prioridad integrada compara señal por señal dentro de cada dominio y entre los dominios que comparten cliente; nunca suma montos de dominios distintos.",
    ],
    referenciaDeclarada: idBenchComercial ? { texto: `Benchmark de margen (comercial): ${R(idBenchComercial)}, declarado por ti. Inventario y cobranza no comparan contra un benchmark en este dato.`, hechoId: idBenchComercial } : null,
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
    });
  }

  // ── LO QUE NO SE PUEDE CONCLUIR ──
  entrega.limites = [
    { titulo: "Los tres dominios no se consolidan en un total único", motivo: "Comercial, inventario y cobranza se miden en escalas y marcos temporales propios y no reconcilian entre sí (contrato de datos declarado): cada cifra de esta Entrega queda con su propio dominio, nunca sumada con la de otro." },
    { titulo: "La causa de estas señales no está en los datos", motivo: "Esta lectura localiza dónde pesa más cada dominio y quién concentra más de uno, no explica por qué — no hay causalidad sin respaldo." },
    { titulo: "Sin conocimiento del sector cargado todavía", motivo: "El Business Knowledge (referencias del sector) todavía no está construido: esta prioridad compara solo contra lo que cada dominio ya declara, no contra el sector." },
  ];
  if (faltaRango) entrega.limites.push({ titulo: "El año comercial no declara un rango de fechas calendario", motivo: "El dato confirma que la parte comercial es el año cerrado (12 meses ya ocurridos), pero el pack no trae una fecha de cierre para ese universo — a diferencia de inventario y cobranza, que sí declaran su foto al corte." });

  // ── REFERENCIA DEL OFICIO · vacía a propósito (mismo motivo que las otras tres rutas) ──
  entrega.referenciaDelOficio = [];

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
    puedo: ["El detalle de cada dominio por separado (comercial, inventario o cobranza)", "El cruce por SKU entre venta e inventario", "La cobranza cruzada con la venta, cuenta por cuenta", "Reordenar la prioridad con otro criterio (ventas, contribución, capital)"],
    noPuedo: ["Por qué pasa cada cosa que esta prioridad localiza (el dato mide qué y cuánto, no por qué)", "Un total único de los tres dominios (no reconcilian entre sí)"],
  };

  entrega.procedencia = { libro, cifrasImpresas };

  const texto = _textoDeLaEntrega(entrega, "¿Qué debería preocuparme primero?");
  return { texto, entrega, libro, ok: true, motivo: "", partes, dominios };
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
  const cabezaMarco = [m.universo, periodoTxt].filter(Boolean).join(", ");
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
