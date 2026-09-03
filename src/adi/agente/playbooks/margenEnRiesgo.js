/* === src/adi/agente/playbooks/margenEnRiesgo.js · PLAYBOOK 1 · MARGEN EN RIESGO (§11 del F1) =================
 *
 * QUÉ RESUELVE, con los casos del expediente (`_AGENTE_PUNTO_DE_PARTIDA.md`): T6 «cómo viene mi margen» salió
 * como `limite` con UNA cifra suelta («Medida · cerrar brecha al piso = $4.9M») teniendo la cartera entera en
 * la mano; el corpus tiene el mismo hueco en «qué clientes están bajo el benchmark» y «a quién reviso primero».
 * El procedimiento junta la evidencia ANTES de que exista la opción de rescatar.
 *
 * EL MÉTODO (los pasos son del playbook, no del ánimo del cerebro):
 *   1 · marginRead{focus:"bajo_benchmark", dimension:"cliente"} — quiénes están bajo la vara, con su margen y
 *       su venta, el benchmark DECLARADO del negocio, el margen promedio y el conteo.
 *   2 · diagnose{} — cuánta contribución no se captura, por cliente y en total, y dónde localiza el motor el
 *       exceso de carga comercial. Es lo que permite decir «a quién primero y con cuánto en juego» sin inventar
 *       una prioridad: el orden sale de una cifra verificada.
 *
 * LO QUE NO HACE: explicar POR QUÉ un cliente cede margen. El dato LOCALIZA (dónde está el exceso, cuánto es);
 * la causa raíz necesita evidencia que este dato no trae. Su lista notarial veta cruzar esa línea.
 *
 * PURO · determinístico · sin red. Cifras VERBATIM de la boleta: este módulo selecciona y ordena, jamás calcula. */

import { variante } from "../variacion.js";   // el cierre varía por semilla («matar la repetición», 2026-09-03)
import { buildRolesCartera } from "../../sentrix/rolesCartera.js";   // el porqué: el papel de cada cliente y la huella de cada mecanismo
import { etiquetaDeLaCarga } from "../../../config/businessPolicy.js";   // DE QUIÉN es el nivel de carga: jamás «tu target declarado» si el cliente no lo declaró

const _num = (f) => (f && Number.isFinite(f.raw) ? f.raw : NaN);
/* ⚠️ EL MOTOR SOLO PONE `raw` EN LAS FILAS DESTACADAS (medido: de los 13 clientes con margen, 5 traen `raw` y
 * 8 traen solo su valor de pantalla «26.5%»). Para SELECCIONAR quién está bajo la vara hace falta el número de
 * las trece, así que el porcentaje se lee de la cifra que el motor YA publicó. Eso no es recalcular: la cifra
 * que se cita sigue siendo la suya, verbatim; leerla para compararla es lo mismo que ordenarla. Y el candado
 * está puesto donde importa — la selección se AUTO-VERIFICA contra el conteo que el propio motor declara
 * («clientes bajo el benchmark»): si no coincide exactamente, el playbook no sirve la lista. */
const _pct = (f) => {
  const r = _num(f);
  if (Number.isFinite(r)) return r;
  const m = /^-?[\d.,]+\s*%$/.exec(String((f && (f.text || f.value)) || "").trim());
  return m ? parseFloat(m[0].replace("%", "").replace(",", ".")) : NaN;
};
const _val = (f) => String((f && (f.text || f.value)) || "");
const _lab = (f) => String((f && f.label) || "");
const _find = (figs, re) => (Array.isArray(figs) ? figs : []).find((f) => re.test(_lab(f))) || null;
const _all = (figs, re) => (Array.isArray(figs) ? figs : []).filter((f) => re.test(_lab(f)));
const _esc = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const _re = (t) => new RegExp(`\\b${_esc(t)}\\b`, "i");

/* la entidad de un label «Entidad · Concepto» — la MISMA convención de la boleta, no un parser nuevo. */
const _entidadDe = (label) => {
  const p = String(label || "").split("·").map((s) => s.trim());
  return p.length >= 2 ? p[0] : null;
};

/** lo que el playbook lee de la boleta, una sola vez y para todos sus usos (composer y lista notarial). */
export function lecturaDeMargen(figs) {
  const bench = _find(figs, /^Benchmark de margen$/i);
  const conteo = _find(figs, /clientes bajo el benchmark/i);
  const promedio = _find(figs, /^Margen promedio$/i);
  const brechaNegocio = _find(figs, /^El negocio · Brecha al benchmark$/i);   // sellada (2026-09-03): la MISMA cifra de la card de la Mesa
  const totalJuego = _find(figs, /^Contribuci[oó]n no capturada · subtotal$/i);
  const cargaTotal = _find(figs, /^Carga comercial alta · subtotal$/i);

  const margenes = _all(figs, /· Margen$/i).map((f) => ({ entidad: _entidadDe(_lab(f)), pct: _pct(f), fmt: _val(f) }))
    .filter((x) => x.entidad && Number.isFinite(x.pct));
  const ventas = new Map(_all(figs, /· Venta$/i).map((f) => [_entidadDe(_lab(f)), _val(f)]));
  const juego = _all(figs, /· Contribuci[oó]n no capturada$/i)
    .map((f) => ({ entidad: _entidadDe(_lab(f)), usd: _num(f), fmt: _val(f) }))
    .filter((x) => x.entidad && Number.isFinite(x.usd))
    .sort((a, b) => b.usd - a.usd);
  const carga = _all(figs, /· Carga comercial alta$/i)
    .map((f) => ({ entidad: _entidadDe(_lab(f)), fmt: _val(f), usd: _num(f) }))
    .filter((x) => x.entidad && Number.isFinite(x.usd))
    .sort((a, b) => b.usd - a.usd);

  const benchPct = bench ? _pct(bench) : NaN;
  const bajo = Number.isFinite(benchPct) ? margenes.filter((m) => m.pct < benchPct).sort((a, b) => a.pct - b.pct) : [];
  return { bench, benchPct, conteo, promedio, brechaNegocio, totalJuego, cargaTotal, margenes, ventas, juego, carga, bajo };
}

/* ── EL DETECTOR · determinístico y ANGOSTO ────────────────────────────────────────────────────────────────────
 * Dos condiciones a la vez: el turno habla de MARGEN (o de la vara), y pide una LECTURA de ese margen — cómo
 * viene, quiénes están bajo, a quién priorizar, cuánto falta. Sin las dos, este playbook no se activa: un
 * playbook que secuestra turnos ajenos es peor que no tenerlo. «Simula/proyecta» queda AFUERA a propósito: esa
 * ruta es de simulación (la letra de RUTEO ya la manda ahí) y el playbook no la pisa. */
/* ⚠️ EL FIN DE PALABRA CUANDO LA PALABRA TERMINA EN ACENTO — la trampa que cazó el barrido de
 * `_agente_contrato_gate` §5g, y acá había TRES casos vivos: `\b` se define sobre [A-Za-z0-9_], así que
 * `qu[eé]\b` NO veía «qué» (con tilde, que es como se escribe), `supon(?:e|é)\b` NO veía «suponé» y
 * `la causa (?:es|está)\b` NO veía «está». `_FIN` es el cierre que sí cuenta vocales acentuadas y ñ. */
const _FIN = "(?![a-záéíóúüñ])";
/* ⚠️ EL DETECTOR DEL PORQUÉ mide el CONCEPTO, no una frase (el caso 13 del patrón de la casa): «por qué» con y
 * sin tilde y pegado o separado, «a qué se debe», «qué lo explica», «cuál es la causa/razón/motivo»,
 * «profundiza». Sin `\b` delante de vocal acentuada (el `\b` imposible, §5g del contrato). */
const _PIDE_PORQUE = new RegExp(`\\bpor\\s?qu[eé]${_FIN}|\\bporqu[eé]${_FIN}|\\ba qu[eé] se debe${_FIN}|\\bqu[eé] lo explica${_FIN}|\\b(?:cu[aá]l es la|la) (?:causa|raz[oó]n|explicaci[oó]n)\\b|\\bmotivo\\b|\\bprofundiz|\\bexplic[aá]${_FIN}|\\bexpl[ií]came${_FIN}`, "i");
/* ⚠️ EL SEGUIMIENTO (owner 2026-09-05): la pregunta que refiere a la LECTURA PREVIA en vez de pedir una nueva.
 * No nombra el tema —«¿cambia tu lectura?» no dice «margen»— así que el detector no puede exigirlo; a cambio es
 * ANGOSTO y léxico, y los excluyentes de siempre (otro eje, otro período, simulación) lo siguen frenando. Hoy
 * la única tesis que el diario guarda es la del margen; el día que haya otra, esto se reparte por `clave`. */
const _PIDE_SEGUIMIENTO = new RegExp([
  `\\bcambia (?:tu|la) lectura${_FIN}`, `\\bcambi[oó] (?:tu|la) lectura${_FIN}`,
  `\\bsigue igual${_FIN}`, `\\bsigue siendo (?:as[ií]|igual)${_FIN}`, `\\bse mantiene${_FIN}`,
  `\\bmantien[eé]s lo que dijiste${_FIN}`, `\\bsostien[eé]s lo que dijiste${_FIN}`,
  `\\bvolviendo a(?:l| la)\\b`, `\\bretomando\\b`,
  `\\bcambi[oó] algo${_FIN}`, `\\bsigue en pie${_FIN}`,
].join("|"), "i");
const _TEMA_MARGEN = /\bm[aá]rgen(?:es)?\b|\bbenchmark\b|\bvara\b|\brentabilidad\b/i;
const _PIDE_LECTURA = new RegExp(`\\bc[oó]mo${_FIN}|\\bqu[eé]${_FIN}|\\bqui[eé]n(?:es)?${_FIN}|\\bcu[aá]l(?:es)?${_FIN}|\\bcu[aá]nto${_FIN}|\\bd[oó]nde${_FIN}|\\bprioriza|\\bprioridad\\b|\\bprimero\\b|\\brevis|\\bmejor(?:ar|a)\\b|\\bbajo\\b|\\bdebajo\\b|\\briesgo\\b|\\bdame\\b|\\bmu[eé]stra|\\blista\\b|\\branking\\b`, "i");
/* ⚠️ LO QUE QUEDA AFUERA, Y POR QUÉ (calibrado contra el corpus de exámenes, cero gasto — cazó tres casos):
 *   · simulación/proyección — esa ruta es de simulateGeneral y la letra de RUTEO ya la manda ahí;
 *   · OTRO EJE — este playbook lee el margen POR CLIENTE. «Ranking de SKU por peor rotación cruzado con
 *     margen» (examen 2 t4) y «ranking de puntos de venta» (examen 3 t4) NO son suyos: activarse ahí cargaba
 *     la cartera de clientes para responder de inventario, y su lista notarial juzgaba texto de otro dominio;
 *   · OTRO PERÍODO — «compara Q1 vs Q2 en ventas, margen y contribución» (examen 3 t1) es una pregunta de
 *     corte temporal; el dato no lo sostiene y el camino honesto es declinar, no traer la foto anual.
 * Un playbook que se activa de más es peor que no tenerlo: secuestra el turno Y le aplica promesas ajenas. */
const _FUERA = new RegExp(`\\bsimul|\\bproyect|\\bqu[eé] pasa si\\b|\\bpon[eé]le que\\b|\\bsupon(?:e|é|gamos)${_FIN}|\\bsku\\b|\\bproducto`, "i");
/* el eje de ESTE playbook es CLIENTE. Cualquier otro eje nombrado lo deja afuera — incluido el que el dato no
 * tiene: «ranking de puntos de venta… no mezcles clientes con puntos de venta» (examen 3 t4) se responde
 * declinando que ese eje no existe, y un playbook de clientes ahí es exactamente la mezcla que el usuario pidió
 * evitar. Equivocarse hacia AFUERA es barato: el turno sigue por el camino de siempre. */
const _OTRO_EJE = /\brotaci[oó]n\b|\binventario\b|\bstock\b|\bbodega|\bpunto[s]? de venta\b|\bsucursal|\btienda|\bcanal(?:es)?\b|\bfamilia|\bmarca[s]?\b|\bcategor[ií]a/i;
/* ⚠️ `\b[uú]ltimo mes` ES EL `\b` IMPOSIBLE EN ESPEJO (cazado 2026-09-01 midiendo el agente entero: un solo
 * sitio, éste). `\b` se define sobre [A-Za-z0-9_]; entre el espacio y la «ú» de «el último» no hay frontera,
 * así que la alternativa acentuada jamás matcheaba: /\b[uú]ltimo mes\b/.test("el último mes") === false. Media
 * ciega: cazaba «ultimo» y no «último». Sin daño visible porque el bucle resuelve entidad×período ANTES de los
 * playbooks — pero un candado que solo funciona con la ortografía equivocada es un adorno. Sin `\b` delante;
 * la frontera de atrás con `_FIN`, como el resto del archivo. */
const _OTRO_PERIODO = new RegExp(`\\bq[1-4]\\b|\\btrimestr|\\bmensual\\b|\\bmes a mes\\b|[uú]ltimo mes${_FIN}|\\bsemestr`, "i");

/* ── EL ENTREGABLE DEL PORQUÉ (owner 2026-09-04) ───────────────────────────────────────────────────────────
 * Su alineamiento, textual: «hay clientes que venden mucho pero erosionan margen, unos apuntan a volumen,
 * otros tienen mejor costo… puede ser una decisión gerencial apuntar a volumen y perder un poco de margen
 * pero eso da rotación, movimiento, liquidez… pero hay otros clientes que bajan el margen por demasiadas
 * acciones comerciales». Este peldaño lo arma sin cerebro: la ESTRUCTURA la lee del motor de papeles (leer el
 * motor no es calcular — la misma técnica de `pisoFocosUSD()` en asesoría) y las CIFRAS salen verbatim de la
 * boleta, como siempre. Si la boleta no trae los papeles, devuelve null y el turno sigue su camino. */
/* ── EL DIARIO DE LA TESIS · paso 1 del diario de la relación (owner 2026-09-04, GO del supervisor) ─────────
 * La tesis que ADI se jugó queda en la MEMORIA DEL HILO (`mem.diarioTesis` — el mismo canal por el que ya
 * persisten el trato y la última aprobada; cero servidor, el corte conservador aprobado), y en el próximo
 * turno del porqué ADI la CONFIRMA o la CORRIGE en voz alta: «esto confirma lo que vimos» / «la lectura
 * cambió y lo corrijo». La huella que se compara es MEDIDA (la concurrencia del motor de papeles), no el
 * recuerdo de una frase: confirmar una tesis es re-medirla, no repetirla. */
export function diarioDeTesis(scenario) {
  let A = null;
  try { A = buildRolesCartera(scenario); } catch { A = null; }
  if (!A || !A.hay) return null;
  const C = A.concurrencia || {};
  return {
    clave: "margen-roles",
    huella: { caen: C.caen || 0, grandesQueCaen: C.grandesQueCaen || 0, mismaGente: !!C.mismaGente },
    resumen: C.mismaGente && C.grandesQueCaen > 1
      ? "los que caen bajo el benchmark son los mismos que sostienen la facturación"
      : "los que caen bajo el benchmark caen por razones distintas",
  };
}

/* ── EL SEGUIMIENTO · «¿cambia tu lectura?» (owner 2026-09-05, señal de producción) ────────────────────────
 * Su redacción esperada, que es la especificación de este composer:
 *   «No cambia la lectura: el margen sigue presionado por los mismos clientes grandes que sostienen la venta.
 *    La tesis era margen bajo + concentración + carga comercial en las mismas cuentas. Al volver a medir,
 *    Falabella/Lider/Jumbo siguen concentrando la brecha. Lo nuevo es que la decisión no es subir precio a
 *    todos, sino revisar si la carga comercial fue apuesta deliberada o descontrol.»
 * El molde tiene CUATRO piezas y las cuatro son obligatorias: veredicto (no cambia / cambió) · qué ERA la
 * tesis · la RE-MEDICIÓN nombrada (se vuelve a medir de verdad, no se recuerda una frase) · y «lo nuevo es»
 * — porque un seguimiento sin novedad declarada suena a eco. Sin tesis en el hilo, se dice y se arma la
 * lectura completa: fingir que se recuerda sería la peor versión de un diario. */
function componerElSeguimiento({ figs, semilla, scenario, mem }) {
  const tesis = mem && mem.diarioTesis && mem.diarioTesis.clave === "margen-roles" ? mem.diarioTesis : null;
  if (!tesis || !tesis.huella) return null;                    // sin tesis: el caller arma la lectura completa
  let A = null;
  try { A = buildRolesCartera(scenario); } catch { A = null; }
  if (!A || !A.hay) return null;
  const C = A.concurrencia || {};
  const h = tesis.huella;
  const igual = h.caen === (C.caen || 0) && h.grandesQueCaen === (C.grandesQueCaen || 0) && h.mismaGente === !!C.mismaGente;
  const ero = A.roles && A.roles.erosion_por_acciones;
  const nombres = ero && ero.n ? ero.items.slice(0, 3).map((f) => f.entidad) : [];
  const p = [];

  /* 1 · EL VEREDICTO, primero — es lo que la pregunta pide */
  p.push(igual
    ? `No cambia la lectura: el margen sigue presionado por las mismas cuentas grandes que sostienen tu facturación.`
    : `Sí cambia, y por eso vale la pena que preguntes: la medición de hoy ya no dice lo mismo que la de antes en este hilo.`);
  /* 2 · QUÉ ERA la tesis — el diario habla de lo suyo, con la frase que se guardó */
  p.push(`La tesis que dejamos era esta: ${tesis.resumen}.`);
  /* 3 · LA RE-MEDICIÓN, NOMBRADA — se volvió a medir, no se recordó */
  const _CUENTA = ["", "una", "dos", "tres"];
  p.push(nombres.length
    ? `Al volver a medir: ${nombres.join(" · ")} siguen concentrando la brecha, y ${igual ? "el reparto de papeles no se movió" : "el reparto de papeles cambió"} — ${C.caen} clientes bajo el benchmark, ${C.grandesQueCaen} de ellos entre los que mueven la facturación.`
    : `Al volver a medir: ${C.caen} clientes quedan bajo el benchmark y ${C.grandesQueCaen} de ellos están entre los que mueven la facturación.`);
  /* 4 · LO NUEVO — qué aporta este turno aunque la tesis se sostenga (sin esto es un eco) */
  const preg = A.preguntaAlDueno;
  p.push(variante(semilla, [
    `Lo nuevo es que la decisión ya no es tocarle el precio a todos: es separar en ${_CUENTA[Math.min(3, nombres.length)] || "esas"} cuentas qué parte de la carga comercial fue deliberada y qué parte se descontroló.${preg ? ` Sigue en pie mi pregunta: ${preg.texto}` : ""}`,
    `Lo nuevo es el foco: no un ajuste parejo de precio, sino distinguir en esas cuentas la carga deliberada de la que se escapó.${preg ? ` Y sigue abierta mi pregunta: ${preg.texto}` : ""}`,
    `Lo nuevo está en qué hacer: en vez de mover el precio de toda la cartera, separar en esas cuentas la carga deliberada de la que no lo fue.${preg ? ` Mi pregunta sigue esperando: ${preg.texto}` : ""}`,
  ]));
  return p.join("\n\n");
}

function componerElPorque({ figs, semilla, scenario, mem }) {
  let A = null;
  try { A = buildRolesCartera(scenario); } catch { A = null; }
  if (!A || !A.hay) return null;
  const cuenta = _find(figs, /^Clientes · erosi[oó]n por acciones comerciales$/i);
  if (!cuenta) return null;                                   // la tool no corrió en este turno: no se inventa
  const bench = _find(figs, /^Benchmark de margen$/i);
  const target = _find(figs, /^Target de carga$/i);
  const brechaDe = (e) => _find(figs, new RegExp(`^${_esc(e)} · Brecha al benchmark$`, "i"));
  const cargaDe = (e) => _find(figs, new RegExp(`^${_esc(e)} · Carga comercial$`, "i"));
  const C = A.concurrencia || {};
  const p = [];

  /* 0 · EL DIARIO HABLA PRIMERO: si este hilo ya tiene una tesis guardada, se CONFIRMA o se CORRIGE en voz
   * alta antes de re-contarla — comparando la huella MEDIDA de entonces contra la de hoy, no el recuerdo de
   * una frase. Sin tesis previa, no se dice nada: el silencio del diario es un estado válido. */
  const tesisPrevia = mem && mem.diarioTesis && mem.diarioTesis.clave === "margen-roles" ? mem.diarioTesis : null;
  if (tesisPrevia && tesisPrevia.huella) {
    const h = tesisPrevia.huella;
    const igual = h.caen === (C.caen || 0) && h.grandesQueCaen === (C.grandesQueCaen || 0) && h.mismaGente === !!C.mismaGente;
    p.push(igual
      ? `Esto confirma la lectura que ya teníamos en este hilo: ${tesisPrevia.resumen}.`
      : `La lectura cambió respecto de lo que vimos en este hilo (antes: ${tesisPrevia.resumen}) — lo corrijo con el dato de hoy.`);
  }

  /* 1 · LA TESIS — qué historia cuentan juntos los números (no dos problemas: uno con dos síntomas) */
  /* ⚠️ EL BENCHMARK NO COMPARTE ORACIÓN CON «la venta» (multa del muro al estrenar esto, y era CORRECTA: con
   * «bajo tu benchmark (30.1%) … sostienen la venta» el binding leía ese % como cifra de ventas). Cada cifra
   * en su oración, con su dueño — la misma lección que el vigía aprendió el día anterior. */
  p.push(C.mismaGente && C.grandesQueCaen > 1
    ? `Lo primero, y cambia la decisión: los que caen bajo tu benchmark de margen son los mismos que sostienen tu facturación. No son dos problemas —uno de margen y otro de concentración—: es uno solo con dos caras.`
    : `Lo primero: no todos los que caen bajo tu benchmark de margen caen por la misma razón, y por eso no se tratan igual.`);

  /* 2 · LOS PAPELES — la distinción que el owner pidió: estrategia vs fuga.
   * La PARTICIÓN se declara entera contra el conteo del motor antes de nombrar a nadie: así el lector ve que
   * los grupos suman el total y ninguno de los nombrados pasa por «todos» (la lista-sin-corte que este mismo
   * playbook multa — y me multó al estrenar esto: la corrección fue de redacción, no de regla). */
  const ero = A.roles.erosion_por_acciones, vol = A.roles.apuesta_de_volumen, del = A.roles.margen_delgado;
  const conteoTotal = _find(figs, /clientes bajo el benchmark/i);
  const partes = [ero, vol, del].filter((r) => r && r.n).map((r) => `${r.n} ${r.titulo}`);
  if (conteoTotal && partes.length > 1) {
    p.push(`\nDe los ${_val(conteoTotal)} que están bajo el benchmark: ${partes.join(" · ")}. No son el mismo problema y no se tratan igual.`);
  }
  if (ero && ero.n) {
    const nombres = ero.items.slice(0, 3).map((f) => {
      const b = brechaDe(f.entidad), c = cargaDe(f.entidad);
      return `${f.entidad}${b ? ` (${_val(b)} bajo el benchmark${c ? `, carga ${_val(c)}` : ""})` : ""}`;
    });
    /* el CORTE se declara en cada grupo («los 3 que más pesan de los N»): nombrar algunos sin decir cuántos
     * son es la lista-sin-corte que este mismo playbook multa — y me la multó al estrenar el porqué. */
    p.push(`\n**Los que pagan el margen en acciones comerciales.** ${_val(cuenta)} de tus clientes están bajo el benchmark Y además cargan más acciones comerciales que ${etiquetaDeLaCarga()}${target ? ` (${_val(target)})` : ""}. Los ${nombres.length} que más pesan de esos ${_val(cuenta)}: ${nombres.join(" · ")}. Acá el margen no se pierde en el precio: se entrega en la negociación comercial.`);
  }
  if (vol && vol.n) {
    p.push(`\n**Los que compran volumen a margen bajo.** ${vol.items.slice(0, 3).map((f) => f.entidad).join(" · ")}: margen bajo el benchmark pero con la carga dentro del nivel de referencia. Eso ya no es fuga por carga — es precio. Puede ser una decisión tuya: volumen a cambio de rotación y liquidez.`);
  } else if (C.grandesQueCaen) {
    p.push(`\n**Volumen y fuga, en la misma cuenta.** En tu dato no hay un solo cliente grande que caiga SIN exceder el nivel de referencia de carga: los ${C.grandesQueCaen} que mueven la venta y caen, todos cargan de más (entre ${C.excesoMin} y ${C.excesoMax} puntos sobre ese nivel). Por eso no se puede recortar la carga sin tocar a los que sostienen la facturación — ahí está la decisión difícil.`);
  }
  if (del && del.n) {
    p.push(`\n**Los de margen delgado sin carga alta ni volumen.** ${del.items.slice(0, 3).map((f) => f.entidad).join(" · ")}: ni pagan carga de más ni mueven volumen. Ahí el margen es precio de lista o mix de lo que compran.`);
  }

  /* 3 · LAS HIPÓTESIS CON SU HUELLA — cada mecanismo, qué marca deja y cuál está en ESTE dato */
  const linea = (h) => `- ${h.mecanismo} · ${h.sello.toUpperCase()}: ${h.porque}${h.falta ? ` Para cerrarlo: ${h.falta}.` : ""}`;
  p.push(`\n**Por qué pasa, con lo que el dato permite afirmar y lo que no:**`);
  for (const h of A.huellas) p.push(linea(h));

  /* 4 · LA REGLA DE DECISIÓN — convierte la duda en un experimento, no en una opinión */
  p.push(`\n**Cómo se resuelve la duda:** si el exceso de carga se repite parejo en toda la cartera, es política comercial y se corrige con una regla; si cambia cliente por cliente, es negociación y se corrige cuenta por cuenta. Tu dato dice que el exceso va de ${C.excesoMin} a ${C.excesoMax} puntos: no es parejo.`);

  /* 5 · LA PREGUNTA AL DUEÑO — solo lo que ninguna columna puede saber */
  if (A.preguntaAlDueno) p.push(`\n${A.preguntaAlDueno.texto} De tu respuesta depende si eso es estrategia o fuga: el dato mide la carga comercial, no la intención.`);

  /* 6 · EL PASO SIGUIENTE, DENTRO DE ADI — jamás «convendría reunirse» si se puede avanzar acá */
  const primero = (ero && ero.items[0]) || (vol && vol.items[0]) || null;
  if (primero) {
    p.push(variante(semilla, [
      `Yo partiría por ${primero.entidad} —criterio mío, no una cifra del dato—: es donde la carga excedida y el volumen coinciden. Pídeme su serie mes a mes y vemos desde cuándo se abrió la brecha.`,
      `Criterio mío, no una cifra del dato: empezaría por ${primero.entidad}, donde la carga excedida y el volumen coinciden. Si quieres, abro su serie mes a mes y vemos desde cuándo.`,
      `Si fuera mi decisión, entraría por ${primero.entidad} —criterio mío— porque ahí coinciden la carga excedida y el volumen. Te abro su serie mes a mes cuando digas.`,
    ]));
  }
  return p.join("\n");
}

export const margenEnRiesgo = {
  nombre: "margen-en-riesgo",
  diarioDeTesis,   // el diario de la tesis (paso 1): el bucle la guarda en la memoria del hilo al aprobar el turno del porqué

  cuandoAplica(pregunta) {
    const q = String(pregunta || "");
    if (_FUERA.test(q) || _OTRO_EJE.test(q) || _OTRO_PERIODO.test(q)) return false;
    /* el SEGUIMIENTO entra sin nombrar el tema: refiere a la lectura previa, y esa lectura es la de acá */
    if (_PIDE_SEGUIMIENTO.test(q)) return true;
    return _TEMA_MARGEN.test(q) && _PIDE_LECTURA.test(q);
  },

  /* LOS PASOS SON FUNCIÓN DE LA PREGUNTA (owner 2026-09-04): el turno que pregunta CÓMO viene el margen paga
   * dos lecturas; el que pregunta POR QUÉ suma la tercera —`rolesCartera`, el papel de cada cliente y la huella
   * de cada mecanismo— porque sin ella el cerebro no tiene con qué razonar el porqué y termina repitiendo
   * dónde y cuánto (el defecto que el owner encontró en producción). El que no pregunta el porqué no la paga:
   * la evidencia cara viaja solo cuando hace falta, igual que la doctrina. */
  pasos(pregunta) {
    const base = [
      { tool: "marginRead", args: { focus: "bajo_benchmark", dimension: "cliente" },
        para: "quiénes están bajo el benchmark, con su margen y su venta, más el benchmark declarado, el margen promedio y el conteo" },
      { tool: "diagnose", args: {},
        para: "cuánta contribución no se captura —por cliente y en total— y dónde localiza el motor el exceso de carga comercial" },
    ];
    /* el SEGUIMIENTO también la paga: re-medir es el punto — y sus conteos tienen que estar en la boleta de
     * ESTE turno, no en el recuerdo del anterior, o el muro los vetaría con razón. */
    if (!_PIDE_PORQUE.test(String(pregunta || "")) && !_PIDE_SEGUIMIENTO.test(String(pregunta || ""))) return base;
    return [...base, { tool: "rolesCartera", args: {},
      para: "el PAPEL de cada cliente (fuga por acciones · volumen a margen bajo · margen delgado · sano) y la huella de cada mecanismo con su sello — la evidencia para razonar el porqué sin inventarlo" }];
  },

  /* las figs que este playbook PROMETE. Si el dato de un tenant no las sostiene, el playbook no promete nada y
   * se retira: sin vara declarada o sin conteo, «quiénes están bajo el benchmark» no tiene respuesta honesta. */
  obligatorias: [/^Benchmark de margen$/i, /clientes bajo el benchmark/i],

  entregable: "qué clientes están bajo el benchmark (con su margen y su venta), cuánta contribución no se captura —total y por cliente— y a quién conviene revisar primero, con su cifra. Las acciones se OFRECEN para que el usuario las evalúe; jamás se ordenan.",

  /* ── EL ENTREGABLE DETERMINÍSTICO · el peldaño que responde cuando el cerebro no pudo ────────────────────────
   * Cifras VERBATIM de la boleta. Una línea por cliente A PROPÓSITO: apilar varias cifras en una sola oración
   * es lo que expuso al rescate al veto de atribución (P1a de la corrida 2) — cada cifra viaja con su dueño en
   * su propia oración. Se AUTO-VERIFICA contra el conteo del motor: si la lista que arma no reconcilia con
   * «clientes bajo el benchmark», no sirve nada y cede al peldaño siguiente.
   *
   * LA VOZ (owner 2026-09-03, «la voz humana en los textos determinísticos»): escribe como un asesor, no como
   * un ledger — sin perder un byte de garantía. Las mismas cifras con los mismos dueños, PERO además cumpliendo
   * los candados que este mismo frente estrenó: la brecha del negocio sale de la fig SELLADA («El negocio ·
   * Brecha al benchmark» — la cifra de la card) y solo si la boleta la trae; «margen promedio» y «benchmark»
   * se nombran con su palabra al lado de su % (las anclas léxicas del humo); el recorte se declara («3 de los
   * 8»); la prioridad nombra su criterio. Cercanía sí, adulación no: si el margen viene mal, se dice derecho. */
  componer({ figs, semilla, pregunta, scenario, mem } = {}) {
    /* EL PORQUÉ TIENE SU PROPIO ENTREGABLE (owner 2026-09-04). Cuando la pregunta pide la causa y los pasos
     * trajeron los papeles, el peldaño determinístico RAZONA en vez de repetir dónde y cuánto — que es
     * exactamente el defecto que el owner encontró en producción. Si los papeles no están (la tool no corrió),
     * cae al entregable de siempre sin ruido. */
    /* EL SEGUIMIENTO va primero: «¿cambia tu lectura?» pide comparar contra la tesis del hilo, no una lectura
     * nueva. Con tesis → confirma o corrige RE-MIDIENDO; sin tesis → lo dice y arma el porqué completo, que es
     * lo honesto: un diario que finge recordar es peor que no tenerlo. */
    if (_PIDE_SEGUIMIENTO.test(String(pregunta || ""))) {
      const seg = componerElSeguimiento({ figs, semilla, scenario, mem });
      if (seg) return seg;
      const nuevo = componerElPorque({ figs, semilla, scenario, mem });
      if (nuevo) return `No tenemos una lectura previa en este hilo, así que te la armo ahora.\n\n${nuevo}`;
    }
    if (_PIDE_PORQUE.test(String(pregunta || ""))) {
      const porque = componerElPorque({ figs, semilla, scenario, mem });
      if (porque) return porque;
    }
    const L = lecturaDeMargen(figs);
    if (!L.bench || !L.conteo || !L.bajo.length) return null;
    const nDeclarado = _num(L.conteo);
    if (!Number.isFinite(nDeclarado) || L.bajo.length !== nDeclarado) return null;   // la selección no reconcilia: no se sirve

    const top = L.juego.slice(0, 3);
    const partes = [];
    const abre = L.promedio
      ? (L.brechaNegocio
        ? `Tu margen promedio viene en ${_val(L.promedio)} — ${_val(L.brechaNegocio)} bajo el benchmark que declaraste (${_val(L.bench)}).`
        : `Tu margen promedio viene en ${_val(L.promedio)}, contra el benchmark de ${_val(L.bench)} que declaraste.`)
      : `Tu benchmark declarado es ${_val(L.bench)}.`;
    partes.push(`${abre} ${_val(L.conteo)} de tus clientes están bajo esa referencia.`);

    if (top.length) {
      partes.push(`\nDonde más contribución dejas sin capturar — los ${top.length} de los ${_val(L.conteo)} que más pesan:`);
      for (const t of top) {
        const m = L.bajo.find((b) => b.entidad === t.entidad);
        const venta = L.ventas.get(t.entidad);
        partes.push(`- ${t.entidad} · deja ${t.fmt} sin capturar${m ? ` · margen ${m.fmt}` : ""}${venta ? ` · venta ${venta}` : ""}`);
      }
    }
    // «En total: …» moría en el muro, Y CON RAZÓN: la fig es el SUBTOTAL de los focos del detector, no el
    // total del universo — la voz lo atribuye a su dueño (el motor) en vez de totalizarlo.
    if (L.totalJuego) partes.push(`\nLa contribución sin capturar que el motor detecta suma ${_val(L.totalJuego)}.`);
    if (L.cargaTotal) {
      const c0 = L.carga[0];
      partes.push(`Dónde lo localiza el motor: carga comercial alta por ${_val(L.cargaTotal)}${c0 ? ` — la más pesada es la de ${c0.entidad} (${c0.fmt})` : ""}.`);
    }
    /* el cierre VARÍA (owner 2026-09-03, «matar la repetición») — determinístico por semilla, y toda variante
     * conserva las anclas: nombra la entidad, declara el criterio («contribución en juego») y OFRECE. */
    if (top.length) partes.push(variante(semilla, [
      `\n¿Lo abrimos por ${top[0].entidad}? Es donde hay más contribución en juego.`,
      `\nSi te parece, empiezo por ${top[0].entidad}: es donde hay más contribución en juego.`,
      `\nDonde hay más contribución en juego es ${top[0].entidad} — ¿lo abrimos?`,
    ]));
    return partes.join("\n");
  },

  /* ── LA LISTA NOTARIAL DEL PLAYBOOK · chequeos MECÁNICOS de SUS promesas ─────────────────────────────────────
   * Se SUMA al muro (guardC intacto) y solo corre cuando el playbook está activo y trajo sus obligatorias.
   * El notario crece por REGLAS, nunca por comprensión: cada una compara texto contra la boleta. */
  listaNotarial(texto, { figs, pregunta } = {}) {
    const t = String(texto || "");
    if (!t.trim()) return [];
    const L = lecturaDeMargen(figs);
    const v = [];

    /* 1 · LA CONDUCTA DEL OWNER, hecha regla: con la evidencia en la mano, no se pide aclaración ni se declina.
     * Se dispara solo si el texto NO trae ninguna de las cifras del playbook Y encima pide definir o declina. */
    const cifrasClave = [L.bench, L.conteo, L.promedio, L.totalJuego].filter(Boolean).map((f) => _val(f));
    const citaAlguna = cifrasClave.some((c) => c && t.includes(c));
    /* «pedir que el usuario defina» = una pregunta de ELECCIÓN antes de responder. Se busca el interrogativo
     * DENTRO de la pregunta (no pegado al «¿»): en la corrida 3 el turno decía «¿Sobre cuál entidad…?» y un
     * patrón anclado al signo lo dejaba pasar. El cierre-oferta del contrato F3 («¿lo vemos por ahí?»,
     * «¿arrancamos?») NO trae interrogativo de elección y sigue siendo legítimo — como debe ser. */
    const pideDefinir = /¿[^?]{0,90}\b(?:cu[aá]l(?:es)?|qu[eé]|qui[eé]n(?:es)?)\b[^?]*\?|necesito que me digas|dime (?:si|cu[aá]l|qu[eé])|aclar[ae]mos|clarifiquemos/i.test(t);
    const declina = /\bno (?:pude|puedo|tengo|dispongo)\b/i.test(t);
    if (!citaAlguna && (pideDefinir || declina)) {
      v.push({ regla: "evidencia-sin-usar",
        multa: "el procedimiento ya trajo la evidencia de este turno (benchmark, cuántos clientes están bajo el benchmark y cuánta contribución no se captura) y tu respuesta no la usa: responde con esas cifras antes de pedir una aclaración o declinar." });
    }

    /* 2 · La lista enumerada tiene que declarar su corte: nombrar 2+ de los que están bajo la vara sin decir
     * «N de M» es un top-N presentado como si fuera todo (la regla de la casa sobre top-N).
     * ACOTADA AL ROL (calibración): solo cuando el texto los presenta COMO la lista de bajo-la-vara. Nombrar a
     * dos clientes al pasar —«Lider está en 21.5% y Jumbo en 24.0%, entre los tres grandes» (examen 4 t2)— no
     * es presentar una lista recortada, y multarlo sería vetar prosa legítima que ya salió a pantalla. */
    const _ROL_BAJO = /bajo (?:el|la) (?:benchmark|vara|referencia)|por debajo (?:del|de la)|bajo la referencia|no (?:llegan|alcanzan) (?:al|a la)/i;
    const nombradosBajo = L.bajo.filter((b) => _re(b.entidad).test(t)).length;
    const declaraCorte = new RegExp(`\\bde (?:los |las )?${L.bajo.length}\\b|\\bde un total\\b|\\btop\\s*\\d|\\bprimeros\\b|\\blos ${L.bajo.length}\\b|\\bentre los\\b|\\blos (?:dos|tres|cuatro|cinco) (?:m[aá]s|grandes|primeros|mayores)\\b`, "i").test(t);
    if (_ROL_BAJO.test(t) && L.bajo.length > 3 && nombradosBajo >= 2 && nombradosBajo < L.bajo.length && !declaraCorte) {
      v.push({ regla: "lista-sin-corte",
        multa: `nombras ${nombradosBajo} de los ${L.bajo.length} clientes bajo el benchmark sin declarar que es un recorte: di «${nombradosBajo} de ${L.bajo.length}» o nómbralos a todos.` });
    }

    /* 3 · EL ORDEN DECLARADO TIENE QUE SER EL APLICADO. La promesa NO es «mi métrica es la única»: es que la
     * prioridad no salga de la nada. Si el texto DECLARA su criterio con su cifra —«empieza por Lider: cerrar
     * sus 3.6pp suma $641K, el mayor impacto en $ de los cinco» (examen 1 t3, aceptado)— eso es exactamente
     * la promesa cumplida, aunque ordene por otra métrica que la del playbook. La multa es para la prioridad
     * MUDA: proponer a alguien que no es el mayor por la cifra del procedimiento y no decir por qué. */
    const mPrim = /(?:empiez[oa]|empez[aá]|empezar[ií]a|arranco|arrancar[ií]a|primero|prioridad|priorizar[ií]a)\s+(?:por|con|es|:)?\s*([A-ZÁÉÍÓÚÑ][\wÁÉÍÓÚÑáéíóúñ .'-]{2,30})/i.exec(t);
    if (mPrim && L.juego.length) {
      const propuesto = L.juego.find((j) => _re(j.entidad).test(mPrim[1]));
      const citados = L.juego.filter((j) => _re(j.entidad).test(t));
      const declaraCriterio = /\bel (?:mayor|m[aá]s alto|de mayor)\b|\bmayor impacto\b|\bel que m[aá]s\b|\bpor(?:que)? (?:tiene|es) el\b|\bcriterio\b|\bordenad[oa] por\b|\bpor su\b/i.test(t);
      if (propuesto && citados.length > 1 && citados[0].entidad !== propuesto.entidad && !declaraCriterio) {
        v.push({ regla: "orden-no-aplicado",
          multa: `propones empezar por ${propuesto.entidad}, pero entre los que nombras el de mayor contribución no capturada es ${citados[0].entidad} (${citados[0].fmt}): ordena por la cifra o di con qué criterio priorizas.` });
      }
    }

    /* 4 · LOCALIZAR ≠ EXPLICAR: una afirmación causal solo vale si se apoya en algo del dato — el mecanismo que
     * el motor declara, o una cifra (que el muro ya verificó). Lo que se veta es la causa INVENTADA, del tipo
     * «cede margen porque su equipo negocia mal»: ninguna cifra, ningún mecanismo, pura atribución. Una
     * justificación anclada en cifras —«porque juntos explican $1.24M de los $1.57M» (examen 1 t3, aceptado)—
     * NO es una causa inventada y no se multa: el dato la sostiene. */
    /* ⚠️ «margen» y «venta» NO entran acá: son el TEMA del playbook, así que casi toda oración causal de este
     * dominio los nombra —incluida la que hay que vetar («cede margen porque su equipo negocia mal»)— y la
     * regla quedaría muerta. Lo que sostiene una causa es el mecanismo declarado por el motor o una cifra. */
    /* 5 · LA BRECHA DEL NEGOCIO TIENE QUE CERRAR CON SUS DOS TÉRMINOS (owner 2026-09-03, defecto vivo cazado
     * por el supervisor verificando el humo): el cerebro abrió con «tu margen está 8,6 puntos por debajo del
     * benchmark» — y 8,6 es la brecha de LIDER (su propia tabla lo decía al lado); la del negocio es 5,0
     * (30,1 − 25,1). La pantalla del owner decía 5.0: dos verdades del mismo concepto. Sobrevivió a todo
     * porque el 8,6 EXISTE en la boleta (es de Lider) y la atribución no lo cazó en esa oración. La regla es
     * aritmética y quirúrgica: una brecha en pp atribuida AL NEGOCIO (la oración trae señal de negocio y NO
     * nombra a ningún cliente — la fila «Lider · –8,6 pp» es legítima y no se toca) tiene que cerrar con
     * benchmark − promedio de la boleta, tolerancia de redondeo. */
    const _BRECHA_PP = /(\d+(?:[.,]\d+)?)\s*(?:pp\b|puntos?(?:\s+porcentuales)?)\s*(?:por\s+debajo|bajo|abajo)/i;
    const _DEL_NEGOCIO = /tu margen|margen (?:promedio|de la cartera|general)|la cartera|el negocio|\bpromedio\b/i;
    if (Number.isFinite(L.benchPct) && L.promedio) {
      const promPct = _pct(L.promedio);
      if (Number.isFinite(promPct)) {
        const brechaReal = L.benchPct - promPct;
        /* el punto decimal NO corta la oración (medido acá mismo: «8.6 puntos por debajo» quedaba partido en
         * «…8» / «6 puntos por debajo…» y la señal de negocio moría en el otro fragmento — la variante con
         * coma multaba y la de punto pasaba limpia). El punto solo corta si NO le sigue un dígito. */
        for (const oracion of t.split(/[!?\n]+|\.(?!\d)/)) {
          const m = _BRECHA_PP.exec(oracion);
          if (!m) continue;
          if (!_DEL_NEGOCIO.test(oracion)) continue;                            // sin señal de negocio, no es esta regla
          if (L.margenes.some((x) => _re(x.entidad).test(oracion))) continue;   // nombra un cliente: es SU brecha, no la del negocio
          const declarada = parseFloat(m[1].replace(",", "."));
          if (Math.abs(declarada - brechaReal) > 0.15) {
            v.push({ regla: "brecha-del-negocio-no-cierra",
              multa: `declaras que el margen del negocio está ${m[1]} pp por debajo del benchmark, pero benchmark (${_val(L.bench)}) menos margen promedio (${_val(L.promedio)}) da ${brechaReal.toFixed(1)} pp — esa cifra es la brecha de OTRA cosa (probablemente un cliente): usa la del negocio o atribúyela a su dueño.` });
            break;
          }
        }
      }
    }

    /* ⚠️ REAPUNTADA AL CONCEPTO (owner 2026-09-04, calibrando el corpus del porqué): esta lista exigía la
     * cadena literal «carga comercial» y multó «porque ahí coinciden la carga excedida y el volumen» —
     * una oración que nombra EXACTAMENTE el mecanismo que el motor mide (`pctRebate` contra el target). Era
     * medir la forma en vez del concepto: el caso 13 del patrón, dentro de mi propia regla. Ahora entran los
     * mecanismos MEDIDOS con sus nombres reales (la carga en cualquiera de sus formas, las acciones
     * comerciales, el markup/precio de lista contra el costo, el volumen del tramo alto). Lo que sigue
     * cayendo —y su carnada lo prueba— es la causa que no nombra ningún mecanismo medido: «cede margen porque
     * su equipo negocia mal». */
    /* ── LAS TRES REGLAS DEL RAZONAMIENTO (owner 2026-09-04) ──────────────────────────────────────────────
     * Nacieron del ANTI-CORPUS que el supervisor exigió antes que el código: escritas las trampas con el tono
     * de asesor bien puesto, TRES pasaron el muro. Enseñarle a ADI a razonar el porqué abre puertas nuevas, y
     * estas son sus cerraduras. El riesgo no era que el notario multara de más: era que el tono seguro le
     * hiciera pasar una mentira. */

    /* 6 · UNA HIPÓTESIS NO SE VUELVE CERTEZA EN LA ORACIÓN SIGUIENTE. La trampa: «Podría ser el mix. Ese mix
     * explica la brecha de 6.1 puntos de Jumbo». Abre marcado y cierra afirmando — el disfraz más peligroso,
     * porque la marca de honestidad está puesta y aun así la conclusión se sirve como probada. */
    const _MARCA_HIP = /\b(?:puede|pueden|podr[íi]a(?:n)?|quiz[áa]s?|tal vez|probablemente|posiblemente|hip[oó]tesis|sospecho|mi hip[oó]tesis)\b/i;
    const _AFIRMA_CAUSA = /\b(?:explica|explican|es lo que causa|es la causa|confirma que|demuestra que|por eso (?:cae|baja|pierde))\b/i;
    const _MECANISMO_NOMBRADO = /\bmix\b|\bcarga\b|acciones comerciales|\brebate|\bprecio\b|\bcosto\b|\bvolumen\b|\bdescuento/i;
    {
      const oraciones = t.split(/(?<=[.!?])\s+|\n+/).filter((o) => o.trim());
      for (let i = 0; i < oraciones.length; i++) {
        if (!(_MARCA_HIP.test(oraciones[i]) && _MECANISMO_NOMBRADO.test(oraciones[i]))) continue;
        const mecanismo = (oraciones[i].match(_MECANISMO_NOMBRADO) || [])[0];
        for (const sig of oraciones.slice(i + 1, i + 3)) {
          if (_AFIRMA_CAUSA.test(sig) && new RegExp(_esc(mecanismo), "i").test(sig) && !_MARCA_HIP.test(sig)) {
            v.push({ regla: "hipotesis-vuelta-certeza",
              multa: `abres «${mecanismo}» como hipótesis y en la oración siguiente la tratas como explicación probada: una hipótesis marcada obliga a seguir marcada, o el marcador es decorativo. Di qué la confirmaría, no que ya explica.` });
            break;
          }
        }
        if (v.some((x) => x.regla === "hipotesis-vuelta-certeza")) break;
      }
    }

    /* 7 · LA INTENCIÓN DEL DUEÑO NO ESTÁ EN NINGUNA COLUMNA. La trampa: «Falabella y Jumbo son tu apuesta de
     * volumen deliberada… no hay nada que corregir ahí». El dato mide la carga, no el propósito: eso se
     * PREGUNTA (y el módulo de papeles emite la pregunta), jamás se declara. Se multa la afirmación; la
     * pregunta y la posibilidad marcada pasan limpias — que es justo la conducta que el owner pidió. */
    const _AFIRMA_INTENCION = /\b(?:es|son|fue|fueron)\s+(?:tu|su|una)\s+(?:apuesta|decisi[oó]n|estrategia)\s+(?:deliberada|consciente|gerencial|tuya|comercial)?|\bdecidiste\b|\blo hiciste a prop[oó]sito\b/i;
    for (const oracion of t.split(/(?<=[.!?])\s+|\n+/)) {
      if (!_AFIRMA_INTENCION.test(oracion)) continue;
      /* ⚠️ AFINADA EN LA MISMA CALIBRACIÓN: la primera versión multó «Lo que el dato no sabe: SI ese volumen
       * a ese margen fue una decisión tuya» — una subordinada de DUDA, que es justo la conducta correcta.
       * Distinguir afirmación de duda es el trabajo de la regla; medir solo el verbo era medir la forma. */
      const _DUDA = /\bsi\s+(?:eso|ese|esa|esto|es|fue|son|fueron)\b|\bno s[ée] si\b|\bno puedo saber\b|\bel dato no (?:sabe|mide|dice)\b|\bhabr[íi]a que (?:confirmar|preguntar)\b|\bdepende de\b/i;
      if (/[¿?]/.test(oracion) || _MARCA_HIP.test(oracion) || _DUDA.test(oracion)
        || /\bme dijiste\b|\bseg[uú]n me confirmaste\b|\bcomo me contaste\b/i.test(oracion)) continue;
      v.push({ regla: "intencion-declarada",
        multa: "declaras como hecho una INTENCIÓN del dueño (que ese volumen o ese margen es una apuesta deliberada) y eso no está en ninguna columna del dato: se pregunta, o se cita porque él ya lo dijo. El dato mide la carga comercial, no el propósito." });
      break;
    }

    /* 8 · EN EL ANÁLISIS DEL PORQUÉ, TODO MONTO SALE DE LA BOLETA DE ESTE TURNO. Defensa propia, medida: con
     * el `datoProyectado` puesto, el muro dejó pasar «te está costando unos $780K» — un monto que NO existe
     * en el dato (verificado: 0 coincidencias en las 318 cifras del negocio). El hueco es del muro y está
     * reportado; esta regla cierra la puerta en el territorio del playbook, que es el mío. */
    if (_PIDE_PORQUE.test(String(pregunta || ""))) {
      const montosBoleta = new Set(_all(figs, /./).map((f) => _val(f).replace(/\s+/g, "")));
      for (const m of t.match(/\$\s?[\d.,]+\s?[KMB]?/g) || []) {
        if (!montosBoleta.has(m.replace(/\s+/g, ""))) {
          v.push({ regla: "monto-fuera-de-boleta",
            multa: `citas ${m} y ese monto no está en la evidencia de este turno: en un análisis del porqué toda cifra sale de la boleta, con su dueño. Un marcador de criterio («mi lectura») no autoriza un número.` });
          break;
        }
      }
    }

    const MECANISMOS = /carga(?:\s+(?:comercial|sobre|alta|del?))?\b|acciones comerciales|rebate|contribuci[oó]n no capturada|capital frenado|peso del costo|\bcosto\b|\bmarkup\b|precio de lista|\bmix\b|benchmark|volumen/i;
    // el «%» sin `\b` detrás (ver la nota de _CIFRA_EN_MULTA en bucleAgente): con `\b` esta regla no veía
    // NINGÚN porcentaje, y en este playbook casi toda cifra que ancla una causa es un margen.
    const CIFRA = /\$\s?[\d.,]+\s?[KMB]?|[\d.,]+\s*%|[\d.,]+\s*(?:pp|x)\b/;
    for (const oracion of t.split(/[.!?\n]+/)) {
      if (!new RegExp(`\\bporque\\b|\\bse debe a\\b|\\bla causa (?:es|está)${_FIN}|\\bes consecuencia de\\b|\\bexplica por qu[eé]${_FIN}`, "i").test(oracion)) continue;
      if (!MECANISMOS.test(oracion) && !CIFRA.test(oracion)) {
        v.push({ regla: "causa-sin-respaldo",
          multa: "afirmas una causa que el dato no declara: este playbook LOCALIZA (dónde está el exceso y cuánto es); para el porqué hace falta evidencia que este dato no trae. Reformula como localización o di que la causa no está medida." });
        break;
      }
    }
    return v;
  },
};
