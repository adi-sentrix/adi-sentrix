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

import { esConversacional } from "../formaConversacional.js";   // la forma de la pregunta manda (owner 2026-09-09)
import { previaSustantiva } from "../reformular.js";   // la última respuesta SUSTANTIVA del hilo (las reformulaciones no cambian de qué va)
import { variante } from "../variacion.js";   // el cierre varía por semilla («matar la repetición», 2026-09-03)
import { buildRolesCartera } from "../../sentrix/rolesCartera.js";   // el porqué: el papel de cada cliente y la huella de cada mecanismo
import { etiquetaDeLaCarga } from "../../../config/businessPolicy.js";
import { reDeReferencia } from "../../oracle/entityRecord.js";   // el rótulo de la referencia se busca por el MISMO label que se publica   // DE QUIÉN es el nivel de carga: jamás «tu target declarado» si el cliente no lo declaró
import { idDeCargaActiva } from "../../../ingesta/estadoCarga.js";   // DIARIO ETAPA 2: la tesis se compara contra la carga con la que se lee — una sola función, jamás dos derivaciones
import { resolveCanonical } from "../../oracle/entityIndex.js";   // la identidad canónica del cliente: una entidad se cuenta UNA vez aunque dos herramientas la citen (owner 2026-09-13)
import { declaradorDe } from "../../notario/declarar.js";   // el Notario semántico (fase 2, owner 2026-09-15): el playbook DECLARA cada hecho mientras lo escribe

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

/* ── LO QUE SE ESCRIBE SE DECLARA (Notario semántico, fase 2 · owner 2026-09-15) ──────────────────────────────
 * «El respaldo debe declarar y verificarse con el mismo estándar, no tener un camino privilegiado.» Cada línea con
 * una cifra, un orden, un conteo o una relación se guarda en una variable, se escribe y se declara con ESA línea
 * como `texto`; el juez la verifica después contra la boleta. Sin colector (`declarar` ausente) el declarador es
 * mudo y el texto queda byte-idéntico. Los universos se nombran con el vocabulario que la evidencia resuelve:
 * «los clientes de la cartera» es el eje entero; «los clientes bajo el benchmark» es el umbral del ranking de
 * margen contra la referencia — ningún número escrito a mano. */
const _U_CARTERA = "los clientes de la cartera";
const _U_BAJO = "los clientes bajo el benchmark";
const _entero = (f) => (Number.isFinite(_num(f)) ? _num(f) : parseInt(_val(f), 10));
/* el universo de un subtotal es el que su propio rótulo declara («5 cuentas materiales (de 8 bajo el benchmark)») */
const _universoDeSubtotal = (f) => { const m = /· subtotal · (.+)$/.exec(_lab(f)); return m ? m[1] : "subtotal"; };
/* un subtotal se declara como GRUPO con las entidades que su fig trae (el verificador cobra el conjunto entero);
 * si la fig no las trae, como cifra del negocio con el universo del rótulo — jamás como el total de la cartera. */
function _declararSubtotal(D, f, metrica, texto) {
  if (!f) return;
  const ents = f.grupo && Array.isArray(f.grupo.entidades) ? f.grupo.entidades.map(String) : [];
  const universo = _universoDeSubtotal(f);
  if (ents.length) D.grupo({ sujeto: ents, metrica, valor: _val(f), universo, texto });
  else D.cifra({ sujeto: "negocio", metrica, valor: _val(f), universo, texto });
}
/* «los N que más …» ES un orden top-k, y el N impreso es su k: el detector de presencia lee ese dígito como una cifra
 * suelta y ningún tipo lleva el k al canon de cifras — por eso el orden viaja con `valor` = k (el objeto entero por
 * `agregar`, porque `D.orden` no admite valor). El juez verifica el top-k con los k nombres; el valor solo cubre el dígito. */
const _ordenTopK = (D, { sujeto, metrica, k, universo, texto }) =>
  D.agregar({ tipo: "orden", sujeto, metrica, orden: { forma: "topk", k, direccion: "mayor" }, universo, valor: String(k), texto });
/* el exceso de carga de una cuenta grande («1 puntos sobre ese nivel») es una cuenta del composer sin fig: carga de la
 * cuenta menos el nivel declarado, y se declara con esa evidencia. Solo el máximo: va pegado a «puntos» y el juez lo
 * lee; el mínimo («0.3 y…») queda sin unidad en la prosa y ningún lector de cifras lo ve — declararlo sería inconsistente. */
function _declararExcesoMaximo(D, ero, C, figs, texto) {
  const grandes = ero && Array.isArray(ero.items) ? ero.items.filter((f) => f.grande && Number.isFinite(f.cargaSobre)) : [];
  const eMax = Number.isFinite(C.excesoMax) ? grandes.find((f) => f.cargaSobre === C.excesoMax) : null;
  if (!eMax) return;
  const carga = _find(figs, new RegExp(`^${_esc(eMax.entidad)} · Carga comercial$`, "i"));
  const nivel = _find(figs, reDeReferencia("pctRebate"));
  if (!carga || !nivel) return;   // sin los dos rótulos en la boleta no hay cuenta que declarar
  D.cifra({ sujeto: eMax.entidad, metrica: "exceso de carga sobre el nivel declarado", valor: `${C.excesoMax} pp`, evidencia: [_lab(carga), _lab(nivel)], texto });
}

/* ── UNA ENTIDAD, UNA FILA (owner 2026-09-13) ─────────────────────────────────────────────────────────────────
 * El encargo compuesto lee con la boleta UNIDA de varias herramientas, y dos de ellas pueden citar la misma
 * cuenta: el resumen ejecutivo trae el margen de las tres grandes y marginRead el de las trece. Medido con el
 * prompt de gerente y el cerebro caído: `bajo` traía 11 filas para 8 clientes (Lider, Falabella y Jumbo dos
 * veces) y el notario multó al ensamblador completo con «nombras 8 de los 11 clientes bajo el benchmark» —
 * un recorte que no existía. Palabra del owner: «la unión de herramientas puede repetir una misma entidad y
 * eso no debe alterar el universo contra el cual se valida un recorte». Se cuenta por la identidad canónica
 * del cliente que ya existe (`resolveCanonical`, el índice de entidades del tenant) — jamás por parecido de
 * texto; un nombre fuera del índice vale tal cual. Gana la PRIMERA aparición, que es la del procedimiento
 * (sus pasos van antes en la unión). Rige para las tres listas por entidad: márgenes (y `bajo`), contribución
 * no capturada y carga comercial alta. */
const _claveCliente = (nombre) => { try { return resolveCanonical("cliente", nombre) || String(nombre || "").trim(); } catch { return String(nombre || "").trim(); } };
const _unaPorEntidad = (lista) => {
  const vistas = new Set();
  return lista.filter((x) => { const k = _claveCliente(x.entidad); if (vistas.has(k)) return false; vistas.add(k); return true; });
};

/** lo que el playbook lee de la boleta, una sola vez y para todos sus usos (composer y lista notarial). */
export function lecturaDeMargen(figs) {
  const bench = _find(figs, /^Benchmark de margen$/i);
  const conteo = _find(figs, /clientes bajo el benchmark/i);
  const promedio = _find(figs, /^Margen promedio$/i);
  const brechaNegocio = _find(figs, /^El negocio · Brecha al benchmark$/i);   // sellada (2026-09-03): la MISMA cifra de la card de la Mesa
  const totalJuego = _find(figs, /^Contribuci[oó]n no capturada · subtotal(?: · \d+ cuentas materiales [^·]*)?$/i);
  const cargaTotal = _find(figs, /^Carga comercial alta · subtotal(?: · \d+ cuentas sobre el nivel[^·]*)?$/i);

  const margenes = _unaPorEntidad(_all(figs, /· Margen$/i).map((f) => ({ entidad: _entidadDe(_lab(f)), pct: _pct(f), fmt: _val(f) }))
    .filter((x) => x.entidad && Number.isFinite(x.pct)));
  const ventas = new Map(_all(figs, /· Venta$/i).map((f) => [_entidadDe(_lab(f)), _val(f)]));
  const juego = _unaPorEntidad(_all(figs, /· Contribuci[oó]n no capturada$/i)
    .map((f) => ({ entidad: _entidadDe(_lab(f)), usd: _num(f), fmt: _val(f) }))
    .filter((x) => x.entidad && Number.isFinite(x.usd)))
    .sort((a, b) => b.usd - a.usd);
  const carga = _unaPorEntidad(_all(figs, /· Carga comercial alta$/i)
    .map((f) => ({ entidad: _entidadDe(_lab(f)), fmt: _val(f), usd: _num(f) }))
    .filter((x) => x.entidad && Number.isFinite(x.usd)))
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
  /* las tres personas del verbo, porque el usuario tutea, vosea o pregunta en tercera: «mantienes» ·
   * «mantenés» · «mantiene». El censo encontró «mantenés lo que dijiste» sin camino por esto mismo. */
  `\\bmant(?:ien[eé]s|en[eé]s|iene)\\s+lo que dijiste${_FIN}`, `\\bsost(?:ien[eé]s|en[eé]s|iene)\\s+lo que dijiste${_FIN}`,
  `\\bvolviendo a(?:l| la)\\b`, `\\bretomando\\b`,
  `\\bcambi[oó] algo${_FIN}`, `\\bsigue en pie${_FIN}`,
].join("|"), "i");
const _TEMA_MARGEN = /\bm[aá]rgen(?:es)?\b|\bbenchmark\b|\bvara\b|\brentabilidad\b/i;
/* ── UNA SOLA RUTA POR PREGUNTA (tanda 2 post-poda, 2026-09-05) ────────────────────────────────────────────
 * `cuandoAplica` abría con el léxico elíptico y `pasos`/`componer`/`listaNotarial` re-derivaban con
 * `_PIDE_PORQUE` — dos léxicos que pueden divergir es el turno partido en dos cerebros (el molde correcto es
 * el `_caso` de askDeCuadro: una derivación, todos los puntos de entrada la consultan). La ruta:
 *   «seguimiento» → el diario ·  «porque» → los papeles (las elípticas del porqué INCLUIDAS) ·
 *   «estandar»    → la lectura completa — que es ADONDE VA «¿y qué harías primero?» a propósito: el molde
 *                   entero ya cierra priorizando con el criterio dicho (gateado en §1j), no necesita los roles. */
function _rutaDe(pregunta) {
  const q = String(pregunta || "");
  if (_PIDE_SEGUIMIENTO.test(q)) return "seguimiento";
  /* «¿y qué harías primero?» ABRE con la prioridad (supervisor 2026-09-05, sobre el ejemplo vivo del owner:
   * «Entraría por Falabella. Una sola cosa. La acción: … Por qué primero — criterio mío: …») — jamás
   * re-servir la lectura que el usuario acaba de leer con la prioridad relegada a la cola. */
  if (new RegExp(`\\bhar[ií]as primero`, "i").test(q)) return "primero";
  if (_PIDE_PORQUE.test(q)) return "porque";
  if (_PIDE_SELLO.test(q)) return "sello";
  if (_PIDE_PORQUE_ELIPTICO.test(q)) return "porque";
  return "estandar";
}
/* ── EL PORQUÉ ELÍPTICO (T5, 2026-09-05) ───────────────────────────────────────────────────────────────────
 * «por qué pasa eso» · «cuál es la causa» · «profundiza en el porqué» · «¿y qué harías primero?» — el owner
 * las pregunta así, SIN nombrar el tema, después de una lectura. El re-censo midió que caían a `vacio` aun
 * con hilo de margen. El trato es el del seguimiento (puertas ANGOSTAS, léxicas), más una condición que el
 * seguimiento no necesitó: la ÚLTIMA lectura del hilo tiene que ser de margen — sin hilo, o con la última
 * lectura de cobranza o de inventario, la elíptica NO abre. Abrir igual sería cambiarle el tema al usuario
 * en silencio, que es un secuestro de hilo. Hoy la única tesis con porqué es la del margen (misma nota que
 * el seguimiento); el día que haya otra, esta puerta se reparte por la lectura que el hilo traiga. */
const _PIDE_PORQUE_ELIPTICO = new RegExp([
  /* «¿Por qué está pasando?» (batería en vivo de la Etapa 4, T2): la forma progresiva no entraba y el turno se iba
   * al cerebro libre; vetado dos veces, terminaba en el rescate. Con procedimiento, el porqué tiene entregable. */
  `\\bpor qu[eé] (?:pasa|est[aá] pasando|ocurre|est[aá] ocurriendo|sucede)(?: eso| esto)?\\s*\\??$`, `\\bcu[aá]l es la causa\\s*\\??$`, `\\ba qu[eé] se debe(?: eso| esto)?\\s*\\??$`,
  /* Y LA PREGUNTA DEL SELLO (batería en vivo, T7): «¿qué parte de eso puedes demostrar y qué parte no?» ES la
   * distinción probado/indicado/abierto que este porqué ya compone — y sin puerta, el cerebro la contestaba
   * dictaminando intenciones y confundiendo dueños, hasta el rescate. */
  `\\bqu[eé] (?:parte )?(?:de eso )?(?:puedes|pod[eé]s|podr[ií]as) (?:demostrar|probar|afirmar)\\b`, `\\bqu[eé] est[aá] (?:probado|demostrado)\\b`, `\\bqu[eé] es (?:hip[oó]tesis|una hip[oó]tesis)\\b`,
  `\\bprofundiza en el porqu[eé]`, `\\by qu[eé] har[ií]as primero\\s*\\??$`, `\\bqu[eé] har[ií]as primero\\s*\\??$`,
  /* LAS FORMAS DE LA PRUEBA DE CONTINUIDAD DEL OWNER (2026-09-11): «¿qué está explicando principalmente ese
   * resultado?» y «¿qué explica eso?» después de la foto del negocio —cuya tesis es el margen contra el
   * benchmark— piden exactamente este porqué. Sin esta puerta, el turno con el cerebro caído terminaba en el
   * genérico; con ella, el procedimiento del porqué tiene entregable. Misma condición que las otras: la última
   * lectura del hilo tiene que hablar de margen, o la puerta no abre. */
  `\\bqu[eé] (?:est[aá] )?explic(?:a|ando)(?: principalmente)?(?: eso| esto| ese resultado| este resultado| ese n[uú]mero)?\\s*\\??$`,
  `\\bqu[eé] lo explica\\s*\\??$`, `\\bqu[eé] hay detr[aá]s(?: de eso| de esto)?\\s*\\??$`,
].join("|"), "i");
/* ── LA LOCALIZACIÓN ELÍPTICA (mini prueba del owner, 2026-09-11) ─────────────────────────────────────────
 * «¿Qué clientes explican más eso?» después de la foto del negocio —cuya tesis es el margen bajo el
 * benchmark— pide BAJAR la tesis a la dimensión cliente: el ranking de quiénes la explican. Es la lectura
 * ESTÁNDAR de este playbook (quiénes están bajo el benchmark, cuánto deja sin capturar cada uno, a quién
 * revisar primero), y no tenía puerta: el turno iba al cerebro libre, que contestaba desde el hilo sin
 * herramientas o no contestaba — y sin herramientas no queda conjunto sellado, así que «profundiza en el
 * primero» no tenía de dónde tomar «el primero» y caía en la cuenta más saliente. Con procedimiento, el
 * ranking sale de la boleta y el conjunto que se presenta queda escrito para el ordinal que sigue.
 * Misma condición que el porqué elíptico: la última lectura del hilo tiene que ser de margen. */
const _PIDE_QUIENES_ELIPTICO = new RegExp([
  `\\bqu[eé] (?:clientes?|cuentas?) (?:lo |la )?explic(?:a|an)(?: m[aá]s| mejor)?(?: eso| esto| ese resultado| esa brecha| la brecha)?\\s*\\??$`,
  `\\bqui[eé]n(?:es)? (?:lo |la )?explic(?:a|an)(?: m[aá]s)?(?: eso| esto)?\\s*\\??$`,
  `\\ben qu[eé] (?:clientes?|cuentas?) est[aá](?: eso| esto| la brecha)?\\s*\\??$`,
  `\\bqu[eé] (?:clientes?|cuentas?) (?:concentran|pesan m[aá]s|lo cargan|cargan)(?: eso| esto| en eso| la brecha| esa brecha)?\\s*\\??$`,
  `\\bd[oó]nde est[aá] (?:eso|esa brecha|la brecha)\\s*\\??$`,
  `\\bb[aá]ja(?:lo|la|melo|mela)? a clientes?\\s*\\??$`, `\\bpor cliente\\s*\\??$`,
].join("|"), "i");
/* la última respuesta del asistente habla de margen: la palabra Y una señal de lectura (benchmark/vara/pp).
 * La ficha y la foto también la traen —su tesis abre por el margen— y ahí el porqué de la cartera ES la
 * explicación disponible; una respuesta de cobranza o de inventario no la trae, y la puerta queda cerrada. */
const _HABLA_DE_MARGEN = new RegExp(`\\bm[aá]rgen(?:es)?${_FIN}`, "i");
const _SENAL_DE_LECTURA = new RegExp(`\\bbenchmark${_FIN}|\\bpp${_FIN}|%`, "i");
function _hiloDeMargen(ctx) {
  /* la última respuesta SUSTANTIVA decide (batería en vivo de la Etapa 4, T6): tras «dámelo más corto» y dos
   * destinatarios, la última respuesta era una reformulación de dos frases sin la palabra «margen» y esta
   * puerta se cerraba — «¿qué harías primero?» se iba al cerebro libre, que cambió la prioridad. La
   * reformulación no cambia de qué va el hilo; se salta, como en el propio piso de reformular. */
  const previa = previaSustantiva(ctx && ctx.history);
  if (!previa) return false;
  /* …y las respuestas de ESTE playbook cuentan como hilo de margen aunque no digan «margen» (batería en vivo,
   * T6→T7): la prioridad —«entraría por Falabella… contribución en juego… sin capturar»— es una lectura de
   * margen por definición, y sin esto «¿qué puedes demostrar?» después de ella se iba al cerebro libre. Su
   * vocabulario propio es la firma: contribución en juego / no capturada, carga excedida, bajo el benchmark. */
  if (/contribuci[oó]n (?:en juego|no capturada)|carga excedida|sin capturar|bajo el benchmark/i.test(previa)) return true;
  return _HABLA_DE_MARGEN.test(previa) && _SENAL_DE_LECTURA.test(previa);
}
/* LA CONTRIBUCIÓN NO CAPTURADA es este playbook con otro nombre: su entregable ya dice, cliente por cliente,
 * «deja $X sin capturar» contra el benchmark declarado. El ask de la Mesa comercial lo pregunta así —«¿Cuánta
 * contribución no estoy capturando?»— y caía a `vacio` (censo, 🔴: un botón que el producto ofrece).
 * SOLO la forma de la CAPTURA, nunca «contribución» a secas: «qué clientes están perdiendo contribución» es de
 * cliente-perdiendo-contribucion, y este playbook va antes en el registro — se lo llevaría puesto. */
const _TEMA_CAPTURA = new RegExp(`\\bcontribuci[oó]n\\b[^.\\n]{0,24}\\b(?:no capturad|sin capturar${_FIN}|no (?:la )?(?:estoy |estamos )?captur)|\\bno (?:estoy|estamos) capturando${_FIN}|\\bcontribuci[oó]n perdida${_FIN}|\\bdejo de capturar${_FIN}`, "i");
/* la cartera nombrada por su ESTADO: «qué clientes están mal» · «mis peores clientes» · «los que rinden poco».
 * Exige el eje cliente + un juicio de estado; sin eso no se activa (un «mal» suelto no es una lectura). */
const _CARTERA_POR_ESTADO = new RegExp(`\\bclientes?\\b[^.\\n]{0,24}\\b(?:mal|flojos?|peores?|rinden poco|no rinden|d[eé]biles)${_FIN}|\\b(?:peores?|mis peores)\\s+clientes?\\b`, "i");
/* …y se cede si la pregunta nombra OTRA métrica: ahí la lectura no es de margen y tiene su propio camino */
const _OTRA_METRICA = /\bventas?\b|\brotaci[oó]n\b|\bstock\b|\bcobr|\bdeb[eo]n?\b|\bvencid|\bunidades\b|\bcaja\b/i;
const _PIDE_LECTURA = new RegExp(`\\bc[oó]mo${_FIN}|\\bqu[eé]${_FIN}|\\bqui[eé]n(?:es)?${_FIN}|\\bcu[aá]l(?:es)?${_FIN}|\\bcu[aá]nt[oa]s?${_FIN}|\\bd[oó]nde${_FIN}|\\bprioriza|\\bprioridad\\b|\\bprimero\\b|\\brevis|\\bmejor(?:ar|a)\\b|\\bbajo\\b|\\bdebajo\\b|\\briesgo\\b|\\bdame\\b|\\bmu[eé]stra|\\blista\\b|\\branking\\b`, "i");
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
function componerElSeguimiento({ figs, semilla, scenario, mem, declarar }) {
  const D = declaradorDe(declarar);
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
  const era = `La tesis que dejamos era esta: ${tesis.resumen}.`;
  p.push(era);
  /* la tesis citada nombra a «los que caen»: hoy son los N bajo el benchmark (re-medidos); «los mismos que sostienen la
   * facturación» solo se sostiene si la huella no se movió — lo corregido se cita, no se afirma */
  if (C.caen) D.conteo({ n: C.caen, predicado: "bajo el benchmark", universo: _U_CARTERA, texto: era });
  if (igual && C.mismaGente && C.grandesQueCaen) D.conteo({ n: C.grandesQueCaen, predicado: "del tramo alto bajo el benchmark", universo: _U_CARTERA, texto: era });
  /* 3 · LA RE-MEDICIÓN, NOMBRADA — se volvió a medir, no se recordó */
  const _CUENTA = ["", "una", "dos", "tres"];
  const reMedida = nombres.length
    ? `Al volver a medir: ${nombres.join(" · ")} siguen concentrando la brecha, y ${igual ? "el reparto de papeles no se movió" : "el reparto de papeles cambió"} — ${C.caen} clientes bajo el benchmark, ${C.grandesQueCaen} de ellos entre los que mueven la facturación.`
    : `Al volver a medir: ${C.caen} clientes quedan bajo el benchmark y ${C.grandesQueCaen} de ellos están entre los que mueven la facturación.`;
  p.push(reMedida);
  /* lo re-medido se declara: cuántos caen, cuántos de ellos son del tramo alto, y quiénes concentran la brecha (en dinero) */
  if (C.caen) D.conteo({ n: C.caen, predicado: "bajo el benchmark", universo: _U_CARTERA, texto: reMedida });
  if (C.grandesQueCaen) D.conteo({ n: C.grandesQueCaen, predicado: "del tramo alto bajo el benchmark", universo: _U_CARTERA, texto: reMedida });
  if (nombres.length) _ordenTopK(D, { sujeto: nombres, metrica: "Contribución no capturada", k: nombres.length, universo: _U_BAJO, texto: reMedida });
  /* 4 · LO NUEVO — qué aporta este turno aunque la tesis se sostenga (sin esto es un eco) */
  const preg = A.preguntaAlDueno;
  /* ⚠️ LAS TRES VARIANTES LLEVAN LA MARCA DE CRITERIO, y esto lo enseñó una corrida del supervisor (2026-09-05):
   * la tercera decía «Lo nuevo está en QUÉ HACER: …» —que dispara `_RECOMIENDA` en el muro— sin decir que era
   * juicio mío, y `juicio-sin-marcar` la cazó con razón. Mi gate solo la había probado con UNA semilla, así
   * que la variante rota vivía escondida hasta que otro largo de hilo la sacaba. Las tres proponen un curso de
   * acción: las tres se marcan. La lección quedó en el gate de variación, que ahora corre TODAS × varios
   * largos por el turno completo. */
  const nuevo = variante(semilla, [
    `Lo nuevo —criterio mío, no una cifra del dato— es que la decisión ya no es tocarle el precio a todos: es separar en ${_CUENTA[Math.min(3, nombres.length)] || "esas"} cuentas qué parte de la carga comercial fue deliberada y qué parte se descontroló.${preg ? ` Sigue en pie mi pregunta: ${preg.texto}` : ""}`,
    `Lo nuevo es el foco, y es criterio mío, no una cifra del dato: no un ajuste parejo de precio, sino distinguir en esas cuentas la carga deliberada de la que se escapó.${preg ? ` Y sigue abierta mi pregunta: ${preg.texto}` : ""}`,
    `Lo nuevo está en qué haría yo —criterio mío, no una cifra del dato—: en vez de mover el precio de toda la cartera, separar en esas cuentas la carga deliberada de la que no lo fue.${preg ? ` Mi pregunta sigue esperando: ${preg.texto}` : ""}`,
  ]);
  p.push(nuevo);
  D.lectura({ texto: nuevo, sello: "criterio mío" });
  return p.join("\n\n");
}

/* «¿y qué harías primero?» — LA PRIORIDAD PRIMERO, con el molde vivo del owner (2026-09-04, textual:
 * «Entraría por Falabella. Una sola cosa. La acción: … Por qué primero — criterio mío: …»). El usuario que
 * pregunta qué hacer YA leyó la lectura: re-servírsela con la prioridad en la cola es no escucharlo. Cifras
 * VERBATIM de la boleta del turno (los pasos base ya la traen); la selección es la de siempre — quien más
 * contribución deja sin capturar. */
/* LA PRIORIDAD ES DEL PROCEDIMIENTO (ley del owner 2026-09-10, aplicada acá tras la batería en vivo de la Etapa
 * 4, T6): la foto y el porqué eligieron Falabella —por contribución en juego— y ante «¿qué harías primero?» el
 * cerebro contestó «Lider, no Falabella», con otro criterio y dos prioridades a elegir. La derivación es UNA y de
 * ella comen el composer y la notarial: quién va primero se decide por contribución no capturada, verbatim. */
export function prioridadDe(figs) {
  const juego = _unaPorEntidad(_all(figs, /· Contribuci[oó]n no capturada$/i)
    .map((f) => ({ entidad: _entidadDe(_lab(f)), usd: _num(f), fmt: _val(f) }))
    .filter((x) => x.entidad && Number.isFinite(x.usd)))   // una entidad, una fila: la boleta unida repite (2026-09-13)
    .sort((a, b) => b.usd - a.usd);
  return juego.length ? { top: juego[0], juego } : null;
}
function componerLaPrioridad({ figs, semilla, declarar }) {
  const D = declaradorDe(declarar);
  /* una sola derivación: la misma que defiende la notarial (`prioridadDe`) — una verdad, no una copia */
  const pr = prioridadDe(figs);
  if (!pr) return null;
  const top = pr.top;
  const total = _find(figs, /^Contribuci[oó]n no capturada · subtotal(?: · \d+ cuentas materiales [^·]*)?$/i);
  const cargaTop = _find(figs, new RegExp(`^${_esc(top.entidad)} · Carga comercial alta$`, "i"));
  const p = [];
  const entrada = `Entraría por ${top.entidad}. Una sola cosa.`;
  p.push(entrada);
  D.lectura({ texto: entrada, sello: "criterio mío" });
  const accion = `La acción: separar en ${top.entidad} la carga comercial deliberada de la que no lo fue${cargaTop ? ` — su carga excedida es ${_val(cargaTop)}` : ""}, y decidir esa parte cuenta por cuenta.`;
  p.push(accion);
  if (cargaTop) D.cifra({ sujeto: top.entidad, metrica: "Carga comercial alta", valor: _val(cargaTop), texto: accion });
  /* EL UNIVERSO DEL SUBTOTAL SE DICE (Notario semántico, fase 2, 2026-09-15): «de $4.9M no capturados en toda la cartera» era FALSO —los $4.9M
   * son el subtotal de las 5 cuentas materiales (de 8 bajo el benchmark)— y la ley de universos consistentes (owner 2026-09-13) exige que
   * cada subtotal lleve su universo. Se lee del rótulo, nunca a mano. */
  const _figUni = total ? _find(figs, /^Contribuci[oó]n no capturada · subtotal · \d+ cuentas materiales/i) : null;   // el rótulo con el universo (la boleta trae el subtotal con y sin él)
  const _uniTotal = _figUni ? ((/subtotal · (\d+ cuentas materiales)/i.exec(_lab(_figUni)) || [])[1] || null) : null;
  const porque = `Por qué primero — criterio mío: es donde hay más contribución en juego. ${top.entidad} deja ${top.fmt} sin capturar${total ? `, de ${_val(total)} no capturados en ${_uniTotal ? `las ${_uniTotal}` : "el subtotal"}` : ""}.`;
  p.push(porque);
  /* la prioridad es un orden (el máximo de contribución no capturada entre los que caen) y su cifra; el subtotal se declara
   * con el universo que la PROSA le pone —«toda la cartera»— para que el juez lo cobre si el rótulo dice otro: el composer
   * no se tapa a sí mismo. */
  D.orden({ sujeto: top.entidad, metrica: "Contribución no capturada", forma: "max", direccion: "mayor", universo: _U_BAJO, texto: porque });
  D.cifra({ sujeto: top.entidad, metrica: "Contribución no capturada", valor: top.fmt, texto: porque });
  if (total) {
    D.cifra({ sujeto: "negocio", metrica: "Contribución no capturada", valor: _val(total), universo: _uniTotal ? `las ${_uniTotal}` : "el subtotal", texto: porque });
    D.relacion({ sujeto: top.entidad, metrica: "Contribución no capturada", forma: "parte", vs: { sujeto: "negocio", metrica: "Contribución no capturada" }, texto: porque });
  }
  p.push(variante(semilla, [
    `Cuando lo trabajes, seguimos con el siguiente de la lista.`,
    `Si quieres, te dejo armado el siguiente de la lista para después.`,
    `El siguiente de la lista queda listo para cuando cierres este.`,
  ]));
  return p.join("\n\n");
}

/* ── LA RUTA DEL SELLO (batería en vivo de la Etapa 4, T7) ─────────────────────────────────────────────────
 * «¿Qué parte de eso puedes demostrar y qué parte no?» ES la distinción probado / indicado / abierto que el
 * porqué ya compone — y sin puerta propia, el cerebro la contestaba dictaminando intenciones y confundiendo
 * dueños hasta el rescate. La ruta compone SOLO las huellas con su sello y la pregunta al dueño: es la parte
 * del porqué que la pregunta pide, con las MISMAS piezas (la línea de huella es una sola función). */
const _PIDE_SELLO = new RegExp([
  `\\bqu[eé] (?:parte )?(?:de eso )?(?:puedes|pod[eé]s|podr[ií]as) (?:demostrar|probar|afirmar)`,
  `\\bqu[eé] est[aá] (?:probado|demostrado)`, `\\bqu[eé] es (?:una )?hip[oó]tesis`, `\\bqu[eé] tienes probado`,
].join("|"), "i");
const _SELLO_EN_VOZ = {
  probado: (porque) => `esto está medido: ${porque}`,
  indicado: (porque) => `el patrón apunta ahí, sin prueba todavía: ${porque}`,
  abierto: (porque) => `esto el dato no lo prueba, queda abierto: ${porque}`,
};
/* el punto antes de «Para cerrarlo» (owner en producción, 2026-09-05: «…cliente con familia Para cerrarlo…»
 * salió pegado): las huellas vienen sin puntuación final y la costura la pone esta línea. */
function _lineaDeHuella(h) {
  const voz = _SELLO_EN_VOZ[h.sello] || ((porque) => porque);
  const dicho = voz(h.porque).trim();
  const conPunto = /[.!?…]$/.test(dicho) ? dicho : `${dicho}.`;
  return `- ${h.mecanismo} — ${h.falta ? `${conPunto} Para cerrarlo: ${h.falta}.` : dicho}`;
}
/* cada huella declara SU hecho, con la línea escrita como texto — la misma función para el porqué y para el sello:
 *   · acciones comerciales: «N de los que caen la tienen sobre el X%» es un CONTEO (bajo el benchmark Y sobre el nivel
 *     declarado, de los que caen) más la cifra del nivel;
 *   · volumen a margen bajo: presente, el conteo del papel; ausente («ningún cliente del tramo alto cae sin carga
 *     excedida»), los dos conteos que lo dicen en positivo — cuántos del tramo alto caen y cuántos de esos exceden;
 *   · precio de lista: los dos promedios de markup son GRUPOS enteros (los que caen · los sanos) y la comparación
 *     entre ellos es una relación «menor»;
 *   · mix: no hay cifra ni orden — es una lectura con el sello de la huella.
 * Lo que la huella dice en negativo sin cifra («ningún cliente bajo el benchmark supera…») no tiene conteo que declarar. */
function _declararHuella(D, h, texto, A, figs) {
  const C = (A && A.concurrencia) || {};
  const roles = (A && A.roles) || {};
  if (/acciones comerciales/i.test(h.mecanismo)) {
    const nivel = _find(figs, reDeReferencia("pctRebate"));
    if (nivel) D.deFig(nivel, texto);
    const ero = roles.erosion_por_acciones;
    if (h.presente && ero && ero.n) D.conteo({ n: ero.n, m: C.caen || undefined, predicado: "bajo el benchmark y sobre el nivel de carga declarado", universo: _U_BAJO, texto });
    return;
  }
  if (/volumen a margen bajo/i.test(h.mecanismo)) {
    const vol = roles.apuesta_de_volumen;
    if (h.presente && vol && vol.n) { D.conteo({ n: vol.n, predicado: vol.titulo, universo: _U_BAJO, texto }); return; }
    if (!h.presente && C.grandesQueCaen) {
      D.conteo({ n: C.grandesQueCaen, predicado: "del tramo alto bajo el benchmark", universo: _U_CARTERA, texto });
      if (C.grandesQueCaenYExcedenCarga) D.conteo({ n: C.grandesQueCaenYExcedenCarga, predicado: "del tramo alto bajo el benchmark que además exceden el nivel de carga declarado", universo: _U_CARTERA, texto });
    }
    return;
  }
  if (/precio de lista/i.test(h.mecanismo)) {
    if (!h.presente) return;   // sin la huella no hay promedio citado ni comparación que declarar
    const caen = (Array.isArray(h.caen) ? h.caen : []).map((f) => f.entidad), sanos = (Array.isArray(h.sanos) ? h.sanos : []).map((f) => f.entidad);
    if (caen.length && Number.isFinite(h.markupCaen)) D.grupo({ sujeto: caen, metrica: "Markup promedio", valor: `${h.markupCaen}%`, universo: "los que caen", texto });
    if (sanos.length && Number.isFinite(h.markupSanos)) D.grupo({ sujeto: sanos, metrica: "Markup promedio", valor: `${h.markupSanos}%`, universo: "sanos", texto });
    if (caen.length && sanos.length) D.relacion({ sujeto: { descripcion: "los que caen" }, metrica: "Markup promedio", forma: "menor", vs: { sujeto: { descripcion: "sanos" }, metrica: "Markup promedio" }, texto });
    return;
  }
  if (/mix/i.test(h.mecanismo)) D.lectura({ texto, sello: h.sello });
}
function componerElSello({ figs, semilla, scenario, mem, declarar }) {
  const D = declaradorDe(declarar);
  let A = null;
  try { A = buildRolesCartera(scenario); } catch { A = null; }
  if (!A || !A.hay || !Array.isArray(A.huellas) || !A.huellas.length) return null;
  const cuenta = _find(figs, /^Clientes · erosi[oó]n por acciones comerciales$/i);
  if (!cuenta) return null;                                   // la tool no corrió en este turno: no se inventa
  const p = [];
  const probadas = A.huellas.filter((h) => h.sello === "probado").length;
  p.push(probadas
    ? `Lo que puedo demostrar y lo que no, mecanismo por mecanismo:`
    : `Lo que el dato permite afirmar y lo que no, mecanismo por mecanismo:`);
  for (const h of A.huellas) { const l = _lineaDeHuella(h); p.push(l); _declararHuella(D, h, l, A, figs); }
  /* la intención NUNCA es demostrable: se dice, y se le pregunta al dueño — el sello de esa pregunta es suyo */
  if (A.preguntaAlDueno) {
    const _intenciones = (Array.isArray(mem && mem.intenciones) ? mem.intenciones : []).filter((x) => x && x.pregunta === "volumen_deliberado");
    const _cita = _intenciones.find((x) => Array.isArray(x.entidades) && x.entidades.some((e) => A.preguntaAlDueno.entidades.includes(e)));
    p.push(_cita
      ? `Y lo que ninguna columna prueba —la intención— ya me lo dijiste tú: «${_cita.cita}». Lo leo como decisión tuya.`
      : `Y lo que ninguna columna puede probar es la intención: ${A.preguntaAlDueno.texto} Eso lo sabes tú, no el dato.`);
  }
  return p.join("\n");
}

function componerElPorque({ figs, semilla, scenario, mem, declarar }) {
  const D = declaradorDe(declarar);
  /* 00 · ¿HAY CASO? (residual del criterio, tanda 2 post-poda 2026-09-05). Con una vara DECLARADA por el
   * usuario («mi margen mínimo es 25%») el promedio puede quedar ENCIMA — y el porqué de una pérdida que no
   * existe no se cuenta: los papeles de la cartera describen la erosión contra la vara vieja y su partición
   * deja de cuadrar (medido: la propia lista notarial vetaba «3 de 4 sin declarar el recorte» y el turno
   * caía al rescate). La rama honesta abre con la verdad del turno: no hay pérdida material a nivel negocio
   * contra TU vara; lo que sigue abierto se nombra con sus cifras de la boleta. */
  {
    const promedio0 = _find(figs, /^Margen promedio$/i);
    const bench0 = _find(figs, /^Benchmark de margen$/i);
    if (promedio0 && bench0 && Number.isFinite(_pct(promedio0)) && Number.isFinite(_pct(bench0)) && _pct(promedio0) >= _pct(bench0)) {
      const p0 = [];
      const encima = `Contra el benchmark de ${_val(bench0)} que declaraste, tu margen promedio (${_val(promedio0)}) está encima: a nivel negocio no hay una pérdida de margen que explicar.`;
      p0.push(encima);
      D.deFig(bench0, encima);
      D.deFig(promedio0, encima);
      D.relacion({ sujeto: "negocio", metrica: "Margen promedio", forma: _pct(promedio0) > _pct(bench0) ? "mayor" : "igual", vs: { sujeto: "negocio", metrica: "Benchmark de margen" }, texto: encima });
      const cuenta0 = _find(figs, /clientes bajo el benchmark/i);
      const juego0 = _find(figs, /^Contribuci[oó]n no capturada · subtotal(?: · \d+ cuentas materiales [^·]*)?$/i);
      const carga0 = _find(figs, /^Carga comercial alta · subtotal(?: · \d+ cuentas sobre el nivel[^·]*)?$/i);
      const abiertos = [];
      if (cuenta0 && juego0) abiertos.push(`${_val(cuenta0)} clientes siguen bajo esa referencia y dejan ${_val(juego0)} de contribución sin capturar`);
      if (carga0) abiertos.push(`la carga comercial alta suma ${_val(carga0)}`);
      if (abiertos.length) {
        const abierto = `Lo que sigue abierto, cuenta por cuenta: ${abiertos.join(" · ")}.`;
        p0.push(abierto);
        if (cuenta0 && juego0) { D.conteo({ n: _entero(cuenta0), predicado: "bajo el benchmark", universo: _U_CARTERA, texto: abierto }); _declararSubtotal(D, juego0, "Contribución no capturada", abierto); }
        if (carga0) _declararSubtotal(D, carga0, "Carga comercial alta", abierto);
      }
      p0.push(variante(semilla, [
        `Si quieres, te abro esa parte cliente por cliente.`,
        `¿Te abro esa parte, cliente por cliente?`,
        `La abrimos cliente por cliente cuando digas.`,
      ]));
      return p0.join("\n\n");
    }
  }
  let A = null;
  try { A = buildRolesCartera(scenario); } catch { A = null; }
  if (!A || !A.hay) return null;
  const cuenta = _find(figs, /^Clientes · erosi[oó]n por acciones comerciales$/i);
  if (!cuenta) return null;                                   // la tool no corrió en este turno: no se inventa
  const bench = _find(figs, /^Benchmark de margen$/i);
  const target = _find(figs, reDeReferencia("pctRebate"));
  const brechaDe = (e) => _find(figs, new RegExp(`^${_esc(e)} · Brecha al benchmark$`, "i"));
  const cargaDe = (e) => _find(figs, new RegExp(`^${_esc(e)} · Carga comercial$`, "i"));
  const C = A.concurrencia || {};
  const p = [];

  /* 0 · EL DIARIO HABLA PRIMERO: si este hilo ya tiene una tesis guardada, se CONFIRMA o se CORRIGE en voz
   * alta antes de re-contarla — comparando la huella MEDIDA de entonces contra la de hoy, no el recuerdo de
   * una frase. Sin tesis previa, no se dice nada: el silencio del diario es un estado válido. */
  const tesisPrevia = mem && mem.diarioTesis && mem.diarioTesis.clave === "margen-roles" ? mem.diarioTesis : null;
  if (tesisPrevia && tesisPrevia.huella) {
    /* DIARIO ETAPA 2 · LA CADUCIDAD (owner, GO 2026-09-05): la tesis persiste entre sesiones, así que ya no
     * alcanza con «este hilo». Tres casos, y en TODOS se re-mide (la huella de hoy manda — nada guardado se
     * afirma sin re-medir): (a) la carga cambió → se dice que la lectura era de la carga anterior; (b) 30+
     * días sin re-confirmar → no se AFIRMA la continuidad: se ofrece retomar, y la lectura de hoy sigue
     * sola; (c) vigente → confirmar o corregir, como siempre. */
    const h = tesisPrevia.huella;
    const igual = h.caen === (C.caen || 0) && h.grandesQueCaen === (C.grandesQueCaen || 0) && h.mismaGente === !!C.mismaGente;
    const cargaActual = (() => { try { return idDeCargaActiva(); } catch { return null; } })();
    const otraCarga = (tesisPrevia.carga || null) !== (cargaActual || null);
    const dias = tesisPrevia.fecha ? Math.floor((Date.now() - Date.parse(tesisPrevia.fecha)) / 86400000) : null;
    const vieja = Number.isFinite(dias) && dias > 30;
    /* la tesis citada nombra a «los que caen»: es el conteo de hoy bajo el benchmark (se re-midió), y si se CONFIRMA la
     * de «los mismos que sostienen la facturación», también cuántos del tramo alto caen hoy. Lo corregido no se afirma. */
    const declararDiario = (l) => {
      if (C.caen) D.conteo({ n: C.caen, predicado: "bajo el benchmark", universo: _U_CARTERA, texto: l });
      if (igual && C.mismaGente && C.grandesQueCaen) D.conteo({ n: C.grandesQueCaen, predicado: "del tramo alto bajo el benchmark", universo: _U_CARTERA, texto: l });
    };
    if (vieja) {
      p.push(`Tengo guardada una lectura del margen del ${tesisPrevia.fecha}, pero pasó más de un mes: no la doy por vigente. ¿La retomamos después de esta? Va la lectura de hoy:`);
    } else if (otraCarga) {
      const l = igual
        ? `La lectura que guardamos${tesisPrevia.fecha ? ` el ${tesisPrevia.fecha}` : ""} era de tu carga anterior — re-medida contra la de hoy, se confirma: ${tesisPrevia.resumen}.`
        : `La lectura que guardamos${tesisPrevia.fecha ? ` el ${tesisPrevia.fecha}` : ""} era de tu carga anterior y con el dato de hoy cambió (antes: ${tesisPrevia.resumen}) — lo corrijo acá.`;
      p.push(l);
      declararDiario(l);
    } else {
      const l = igual
        ? `Esto confirma la lectura que ya teníamos${tesisPrevia.fecha ? ` (guardada el ${tesisPrevia.fecha})` : " en este hilo"}: ${tesisPrevia.resumen}.`
        : `La lectura cambió respecto de lo que vimos${tesisPrevia.fecha ? ` (guardado el ${tesisPrevia.fecha})` : " en este hilo"} (antes: ${tesisPrevia.resumen}) — lo corrijo con el dato de hoy.`;
      p.push(l);
      declararDiario(l);
    }
  }

  /* 1 · LA TESIS — qué historia cuentan juntos los números (no dos problemas: uno con dos síntomas) */
  /* ⚠️ EL BENCHMARK NO COMPARTE ORACIÓN CON «la venta» (multa del muro al estrenar esto, y era CORRECTA: con
   * «bajo tu benchmark (30.1%) … sostienen la venta» el binding leía ese % como cifra de ventas). Cada cifra
   * en su oración, con su dueño — la misma lección que el vigía aprendió el día anterior. */
  const mismaGente = C.mismaGente && C.grandesQueCaen > 1;
  const tesis = mismaGente
    ? `Lo primero, y cambia la decisión: los que caen bajo tu benchmark de margen son los mismos que sostienen tu facturación. No son dos problemas —uno de margen y otro de concentración—: es uno solo con dos caras.`
    : `Lo primero: no todos los que caen bajo tu benchmark de margen caen por la misma razón, y por eso no se tratan igual.`;
  p.push(tesis);
  /* «los que caen» es un conjunto medido (los N bajo el benchmark); «los mismos que sostienen tu facturación» es el
   * conteo del tramo alto que cae — los dos se declaran como conteos, que es lo que la tesis afirma */
  if (C.caen) D.conteo({ n: C.caen, predicado: "bajo el benchmark", universo: _U_CARTERA, texto: tesis });
  if (mismaGente) D.conteo({ n: C.grandesQueCaen, predicado: "del tramo alto bajo el benchmark", universo: _U_CARTERA, texto: tesis });

  /* 2 · LOS PAPELES — la distinción que el owner pidió: estrategia vs fuga.
   * La PARTICIÓN se declara entera contra el conteo del motor antes de nombrar a nadie: así el lector ve que
   * los grupos suman el total y ninguno de los nombrados pasa por «todos» (la lista-sin-corte que este mismo
   * playbook multa — y me multó al estrenar esto: la corrección fue de redacción, no de regla). */
  const ero = A.roles.erosion_por_acciones, vol = A.roles.apuesta_de_volumen, del = A.roles.margen_delgado;
  const conteoTotal = _find(figs, /clientes bajo el benchmark/i);
  const partes = [ero, vol, del].filter((r) => r && r.n).map((r) => `${r.n} ${r.titulo}`);
  if (conteoTotal && partes.length > 1) {
    const particion = `De los ${_val(conteoTotal)} que están bajo el benchmark: ${partes.join(" · ")}. No son el mismo problema y no se tratan igual.`;
    p.push(`\n${particion}`);
    /* la partición son conteos: el total bajo el benchmark y cada papel «N de los que caen» */
    D.conteo({ n: _entero(conteoTotal), predicado: "bajo el benchmark", universo: _U_CARTERA, texto: particion });
    for (const r of [ero, vol, del]) if (r && r.n) D.conteo({ n: r.n, m: _entero(conteoTotal), predicado: r.titulo, universo: _U_BAJO, texto: particion });
  }
  if (ero && ero.n) {
    const nombres = ero.items.slice(0, 3).map((f) => {
      const b = brechaDe(f.entidad), c = cargaDe(f.entidad);
      const frag = `${f.entidad}${b ? ` (${_val(b)} bajo el benchmark${c ? `, carga ${_val(c)}` : ""})` : ""}`;
      /* cada cuenta nombrada declara sus dos cifras en su propio tramo: la brecha y la carga, con su dueño */
      if (b) D.deFig(b, frag);
      if (b && c) D.deFig(c, frag);
      return frag;
    });
    /* el CORTE se declara en cada grupo («los 3 que más pesan de los N»): nombrar algunos sin decir cuántos
     * son es la lista-sin-corte que este mismo playbook multa — y me la multó al estrenar el porqué. */
    /* SIN NEGRITAS NI REPETIR LA PARTICIÓN (Etapa 3, owner 2026-09-11: «una respuesta ejecutiva no debería parecer
     * un reporte de consultoría»): la línea anterior ya dijo cuántos pagan el margen en acciones; acá va quiénes
     * y contra qué referencia. El corte sigue declarado —«los 3 que más pesan de esos 6»— que es lo que la
     * notarial cobra. */
    const cargan = `Los que lo pagan en acciones comerciales cargan más que ${etiquetaDeLaCarga()}${target ? ` (${_val(target)})` : ""}.`;
    const corte = `Los ${nombres.length} que más pesan de esos ${_val(cuenta)}:`;
    p.push(`\n${cargan} ${corte} ${nombres.join(" · ")}. Ahí el margen no se pierde en el precio: se entrega en la negociación.`);
    /* «cargan más que el nivel» es una relación de cada cuenta del papel contra la referencia declarada, con la cifra del
     * nivel; «los 3 que más pesan de esos 6» es el top-k por venta dentro del papel (así ordena el motor de papeles) y el
     * conteo del papel. El orden se declara sobre la cabecera sola: el tramo con los nombres habla de brecha y carga. */
    if (target) {
      D.deFig(target, cargan);
      D.relacion({ sujeto: ero.items.map((f) => f.entidad), metrica: "Carga comercial", forma: "mayor", vs: { sujeto: "negocio", metrica: _lab(target) }, texto: cargan });
    }
    D.conteo({ n: ero.n, predicado: ero.titulo, universo: _U_BAJO, texto: corte });
    _ordenTopK(D, { sujeto: ero.items.slice(0, 3).map((f) => f.entidad), metrica: "Venta", k: nombres.length, universo: ero.items.map((f) => f.entidad), texto: corte });
  }
  if (vol && vol.n) {
    const volumen = `${vol.items.slice(0, 3).map((f) => f.entidad).join(" · ")} compran volumen a margen bajo con la carga dentro del nivel de referencia: eso no es fuga por carga, es precio — y puede ser una decisión tuya, volumen a cambio de rotación y liquidez.`;
    p.push(volumen);
    D.conteo({ n: vol.n, predicado: vol.titulo, universo: _U_BAJO, sujeto: vol.items.slice(0, 3).map((f) => f.entidad), texto: volumen });
  } else if (C.grandesQueCaen) {
    const grandes = `Y volumen y fuga van en la misma cuenta: los ${C.grandesQueCaen} grandes que caen cargan todos de más (entre ${C.excesoMin} y ${C.excesoMax} puntos sobre ese nivel). Por eso no se recorta la carga sin tocar a los que sostienen la facturación — ahí está la decisión difícil.`;
    p.push(grandes);
    /* «los N grandes que caen» y «cargan todos de más» son los dos conteos del tramo alto; el exceso máximo es la cuenta del composer */
    D.conteo({ n: C.grandesQueCaen, predicado: "del tramo alto bajo el benchmark", universo: _U_CARTERA, texto: grandes });
    if (C.grandesQueCaenYExcedenCarga) D.conteo({ n: C.grandesQueCaenYExcedenCarga, predicado: "del tramo alto bajo el benchmark que además exceden el nivel de carga declarado", universo: _U_CARTERA, texto: grandes });
    _declararExcesoMaximo(D, ero, C, figs, grandes);
  }
  if (del && del.n) {
    const delgado = `${del.items.slice(0, 3).map((f) => f.entidad).join(" · ")} tienen margen delgado sin carga alta ni volumen: ahí es precio de lista o mix de lo que compran.`;
    p.push(delgado);
    D.conteo({ n: del.n, predicado: del.titulo, universo: _U_BAJO, sujeto: del.items.slice(0, 3).map((f) => f.entidad), texto: delgado });
  }

  /* 3 · LAS HIPÓTESIS CON SU HUELLA — cada mecanismo, qué marca deja y cuál está en ESTE dato */
  /* ⚠️ EL SELLO SE QUEDA, LA ETIQUETA SE VA (owner 2026-09-05): vio «PROBADO/ABIERTO/INDICADO» en mayúsculas y
   * eso es vocabulario NUESTRO, no del gerente que lee. La proporcionalidad (regla 1) no se negocia — lo que
   * cambia es cómo suena: el mismo sello dicho en la lengua del negocio. La doctrina interna los sigue
   * nombrando; a pantalla salen como una frase. */
  const linea = _lineaDeHuella;
  /* ⚠️ LAS SECCIONES QUE DICEN LO MISMO SE FUNDEN (pulido del owner 2026-09-05): cuando arriba ya se contó
   * «volumen y fuga en la misma cuenta», la huella de volumen repite esa conclusión con otras palabras —y el
   * lector la lee dos veces. Una cosa se dice UNA vez; lo que se omite acá ya está dicho, no perdido. */
  const yaContada = new Set();
  if (!(vol && vol.n) && C.grandesQueCaen) yaContada.add("volumen a margen bajo");
  p.push(`\nPor qué pasa — lo que el dato permite afirmar y lo que no:`);
  for (const h of A.huellas) { if (!yaContada.has(h.mecanismo)) { const l = linea(h); p.push(l); _declararHuella(D, h, l, A, figs); } }

  /* 4 · LA REGLA DE DECISIÓN — convierte la duda en un experimento, no en una opinión */
  const regla = `La duda se resuelve así: si el exceso de carga se repite parejo en toda la cartera, es política comercial y se corrige con una regla; si cambia cliente por cliente, es negociación. Tu dato dice que va de ${C.excesoMin} a ${C.excesoMax} puntos: no es parejo.`;
  p.push(`\n${regla}`);
  _declararExcesoMaximo(D, ero, C, figs, regla);

  /* 5 · LA PREGUNTA AL DUEÑO — solo lo que ninguna columna puede saber */
  if (A.preguntaAlDueno) {
    /* DIARIO ETAPA 2: si el dueño YA respondió (su cita guardada toca alguna de las entidades en cuestión),
     * no se le vuelve a preguntar — se CITA su palabra, textual, sin interpretarla más allá de lo que dijo. */
    const _intenciones = (Array.isArray(mem && mem.intenciones) ? mem.intenciones : [])
      .filter((x) => x && x.pregunta === "volumen_deliberado" && Array.isArray(x.entidades) && x.entidades.length);
    const _citaGuardada = _intenciones.find((x) => x.entidades.some((e) => A.preguntaAlDueno.entidades.includes(e)));
    if (_citaGuardada) {
      p.push(`\nSobre ${_citaGuardada.entidades.join(" y ")} tu palabra ya está anotada${_citaGuardada.fecha ? ` (${_citaGuardada.fecha})` : ""}: «${_citaGuardada.cita}». La leo como decisión tuya — dime si cambió.`);
    } else if (_intenciones.length) {
      /* el refinamiento del supervisor (2026-09-05): la palabra dada sobre OTRA cuenta de la cartera también
       * se recuerda — se nombra lo resuelto y la pregunta queda SOLO para lo abierto. */
      const _ya = _intenciones[_intenciones.length - 1];
      p.push(`\nSobre ${_ya.entidades.join(" y ")} ya me lo declaraste («${_ya.cita}») — la duda queda en ${A.preguntaAlDueno.entidades.join(" y ")}: ${A.preguntaAlDueno.texto} El dato mide la carga comercial, no la intención.`);
    } else {
      p.push(`\n${A.preguntaAlDueno.texto} De tu respuesta depende si eso es estrategia o fuga: el dato mide la carga comercial, no la intención.`);
    }
  }

  /* 6 · EL PASO SIGUIENTE, DENTRO DE ADI — jamás «convendría reunirse» si se puede avanzar acá */
  const primero = (ero && ero.items[0]) || (vol && vol.items[0]) || null;
  if (primero) {
    const paso = variante(semilla, [
      `Yo partiría por ${primero.entidad} —criterio mío, no una cifra del dato—: es donde la carga excedida y el volumen coinciden. Pídeme su serie mes a mes y vemos desde cuándo se abrió la brecha.`,
      `Criterio mío, no una cifra del dato: empezaría por ${primero.entidad}, donde la carga excedida y el volumen coinciden. Si quieres, abro su serie mes a mes y vemos desde cuándo.`,
      `Si fuera mi decisión, entraría por ${primero.entidad} —criterio mío— porque ahí coinciden la carga excedida y el volumen. Te abro su serie mes a mes cuando digas.`,
    ]);
    p.push(paso);
    D.lectura({ texto: paso, sello: "criterio mío" });
  }
  return p.join("\n");
}

export const margenEnRiesgo = {
  nombre: "margen-en-riesgo",
  /* responde POR EL NEGOCIO ENTERO: si la pregunta nombra una entidad del índice, el registro lo retira
   * ANTES de consultarlo (propiedad aplicada una vez en playbookPara — tanda 2 post-poda, 2026-09-05). */
  respondePorElNegocio: true,
  diarioDeTesis,   // el diario de la tesis (paso 1): el bucle la guarda en la memoria del hilo al aprobar el turno del porqué

  cuandoAplica(pregunta, ctx) {
    const q = String(pregunta || "");
    if (_FUERA.test(q) || _OTRO_EJE.test(q) || _OTRO_PERIODO.test(q)) return false;
    /* el SEGUIMIENTO entra sin nombrar el tema: refiere a la lectura previa, y esa lectura es la de acá */
    if (_PIDE_SEGUIMIENTO.test(q)) return true;
    /* el PORQUÉ ELÍPTICO entra solo si la última lectura del hilo fue de margen (ver arriba): sin hilo — los
     * gates de siempre no lo pasan — o con la última de otro tema, la puerta queda cerrada y no roba nada. */
    if (_PIDE_PORQUE_ELIPTICO.test(q) && _hiloDeMargen(ctx)) return true;
    /* la LOCALIZACIÓN elíptica («¿qué clientes explican más eso?») entra con la misma condición: baja la tesis
     * de margen del hilo a la dimensión cliente, por la ruta estándar (el ranking de quiénes la explican) */
    if (_PIDE_QUIENES_ELIPTICO.test(q) && _hiloDeMargen(ctx)) return true;
    /* ⚠️ LA FORMA DE LA PREGUNTA MANDA (owner 2026-09-09, textual): «Margen general solo debe ganar cuando la
     * pregunta es de margen general, NO cuando margen aparece dentro de una comparación o tradeoff.»
     * Medido: «¿qué es más urgente, margen o cobranza?» y «¿vendo más o protejo margen?» recibían la lectura de
     * la cartera y una prioridad ENTRE CLIENTES —cuando el usuario pedía elegir entre ÁREAS— y la cobranza,
     * cuyo playbook también aplica, no se leía nunca.
     * ⚠️ VA DESPUÉS DE LAS DOS PUERTAS DE SEGUIMIENTO, y no por orden estético: puesta antes, se llevaba
     * puesto «¿y qué harías primero?» tras una lectura de margen —que es la CONTINUACIÓN legítima de este
     * mismo playbook, no un secuestro— y el gate de playbooks lo cazó al instante. La regla del owner es que
     * el margen no gane una conversación AJENA; su propia continuación sigue siendo suya. */
    if (esConversacional(q)) return false;
    if (_TEMA_MARGEN.test(q) && _PIDE_LECTURA.test(q)) return true;
    if (_TEMA_CAPTURA.test(q) && _PIDE_LECTURA.test(q)) return true;
    /* ── EL LÉXICO CORTO (censo T1, 2026-09-05) ────────────────────────────────────────────────────────────
     * El detector pedía una frase más larga que la que la gente escribe. Dos formas medidas en el censo:
     *   · ELÍPTICA — «y el margen?» · «necesito ver márgenes»: el tema está y el verbo de lectura no. Vale
     *     solo si la pregunta es CORTA y no nombra otra cosa: en una frase larga, el margen mencionado al
     *     pasar no es el pedido (ahí el detector viejo acierta y este no se mete).
     *   · LA CARTERA POR SU ESTADO — «qué clientes están mal» · «mis peores clientes por margen»: el tema es
     *     el margen aunque la palabra no aparezca sola. Se exige el eje CLIENTE y un juicio de estado, y se
     *     cede ante otra métrica nombrada (venta, rotación) para no robarle el turno a quien le toca. */
    if (_TEMA_MARGEN.test(q) && q.trim().split(/\s+/).length <= 5) return true;
    if (_CARTERA_POR_ESTADO.test(q) && !_OTRA_METRICA.test(q)) return true;
    return false;
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
    if (_rutaDe(pregunta) === "estandar" || _rutaDe(pregunta) === "primero") return base;   // la prioridad usa la evidencia base; los roles son del porqué/seguimiento/sello
    return [...base, { tool: "rolesCartera", args: {},
      para: "el PAPEL de cada cliente (fuga por acciones · volumen a margen bajo · margen delgado · sano) y la huella de cada mecanismo con su sello — la evidencia para razonar el porqué sin inventarlo" }];
  },

  /* las figs que este playbook PROMETE. Si el dato de un tenant no las sostiene, el playbook no promete nada y
   * se retira: sin vara declarada o sin conteo, «quiénes están bajo el benchmark» no tiene respuesta honesta. */
  obligatorias: [/^Benchmark de margen$/i, /clientes bajo el benchmark/i],

  /* ── LAS CONCLUSIONES DEL PROCEDIMIENTO, DICHAS AL CEREBRO (owner 2026-09-13) ─────────────────────────────────
   * Tres problemas de producto, medidos en vivo: la prioridad cambiaba entre Falabella y Líder según el criterio
   * espontáneo del narrador; el subtotal de $4.9M se narraba «en los ocho clientes» (son cinco); y el markup de una
   * cuenta se comparaba con el margen de otra. El notario cobra los tres, pero cobrar es la red: la conclusión se
   * declara ANTES de escribir, con la misma derivación que usa el composer (`prioridadDe`, `lecturaDeMargen`). */
  conclusiones(figs) {
    const L = lecturaDeMargen(figs);
    const pr = prioridadDe(figs);
    const lineas = ["CONCLUSIONES DEL PROCEDIMIENTO (no las cambies; tu criterio va después, como alternativa):"];
    if (pr && pr.top) {
      const otras = pr.juego.slice(1, 3).map((x) => `${x.entidad} (${x.fmt})`).join(", ");
      lineas.push(`- Prioridad oficial: ${pr.top.entidad} — criterio del procedimiento: mayor contribución no capturada (${pr.top.fmt}${otras ? `; siguen ${otras}` : ""}). La primera acción es sobre ${pr.top.entidad}. Si otro criterio (brecha mayor, causa probada) te lleva a otra cuenta, preséntalo DESPUÉS como alternativa secundaria, nunca como «por dónde entraría primero».`);
    }
    if (L.totalJuego) {
      const mNM = /·\s*(\d+)\s+(?:cuentas?|clientes?)\s+materiales\s*\(de\s+(\d+)\s+bajo/i.exec(_lab(L.totalJuego));
      lineas.push(mNM
        ? `- ${_val(L.totalJuego)} de contribución no capturada = el subtotal de las ${mNM[1]} cuentas materiales bajo el benchmark (de ${mNM[2]} que están bajo él). Una sola definición: cítalo siempre así («las ${mNM[1]} cuentas materiales»); no lo narres como el de las ${mNM[2]}, ni como la cartera entera.`
        : `- ${_val(L.totalJuego)} de contribución no capturada es un SUBTOTAL: cítalo con su universo, no como el total de la cartera.`);
    }
    /* la naturaleza de cada cifra y las comparaciones válidas (owner 2026-09-13, cuatro requisitos de producto) */
    if (L.totalJuego) lineas.push(`- ${_val(L.totalJuego)} es una brecha ESTIMADA contra el benchmark —lo que sumarían esas cuentas si llegaran al benchmark—, no dinero que ya se perdió ni caja: dilo como «brecha estimada» o «contribución no capturada», nunca «ya se dejó de capturar» ni «no es teórico».`);
    /* UNIVERSOS CONSISTENTES Y LA PARTICIÓN MEDIDA (owner 2026-09-13, corrida en vivo): «de los $4.9M, $655K» mezclaba dos
     * universos. El cerebro recibe cada subtotal con su universo y la partición que sí cabe dentro de la brecha. */
    const _cargaMat = _find(figs, /^Carga comercial alta · subtotal · \d+ cuentas materiales/i), _restoMat = _find(figs, /^Brecha por precio y costo · subtotal · \d+ cuentas materiales/i);
    if (L.cargaTotal) {
      const _uC = /· subtotal · (.+)$/.exec(_lab(L.cargaTotal));
      lineas.push(`- ${_val(L.cargaTotal)} es contribución cedida en acciones comerciales por sobre el nivel de referencia${_uC ? ` en ${_uC[1]} — su universo, que NO es el de la brecha de las cuentas materiales: nunca lo presentes como parte de ella («de eso», «de los cuales»)` : ""}: no es caja, flujo ni efectivo. Conserva esa naturaleza y ese universo al citarlo.`);
    }
    if (L.totalJuego && _cargaMat && _restoMat) lineas.push(`- La partición MEDIDA de ${_val(L.totalJuego)} (las mismas cuentas materiales): ${_val(_cargaMat)} corresponden al efecto de la carga sobre el nivel declarado y ${_val(_restoMat)} al componente precio y costo. Úsala cuando expliques la brecha —«de eso, ${_val(_cargaMat)} es carga y el resto, ${_val(_restoMat)}, precio y costo»— y con esas dos cifras sí puedes decir cuál pesa más. «Precio y costo» es un componente conjunto: el dato no separa cuánto es precio y cuánto costo, no lo separes tú.`);
    const mkCaen = _find(figs, /^Markup promedio · los que caen$/i), mkSanos = _find(figs, /^Markup promedio · sanos$/i);
    lineas.push(mkCaen && mkSanos
      ? `- Comparaciones: solo entre métricas equivalentes (margen con margen, markup con markup, carga con carga). El markup de los sanos SÍ está en la boleta: si comparas el precio de lista de los que caen con el de los sanos, cita los dos lados en la misma oración (markup promedio ${_val(mkCaen)} los que caen contra ${_val(mkSanos)} los sanos) — y sigue siendo una huella INDICADA, no probada.`
      : "- Comparaciones: solo entre métricas equivalentes (margen con margen, markup con markup, carga con carga). El markup de los sanos NO está en esta boleta: no afirmes que los que caen tienen el precio más pegado al costo que los sanos — ni en el cuerpo ni en el cierre.");
    lineas.push("- No hay comparación histórica del margen en este turno: el margen no «cae», no «se deteriora» y la venta no «pierde calidad»; está bajo el benchmark, que es lo medido. Lo que se recupera de la carga comercial es contribución, no capital.");
    /* lo descartado, lo indicado, lo abierto y lo que cambió en el tiempo (owner 2026-09-13, tres cuestiones transversales) */
    lineas.push("- Ganar más o menos es una comparación en el tiempo de contribución, resultado o margen, y este turno no la tiene: no digas «no ganamos más», «ganamos menos» ni «no estamos mejorando». Di «vendes más; si ganas más no se puede saber con este dato».");
    const _mkBajo = mkCaen && mkSanos && Number.isFinite(_num(mkCaen)) && Number.isFinite(_num(mkSanos)) && _num(mkCaen) < _num(mkSanos);
    lineas.push(`- Cada mecanismo lleva el sello del procedimiento: carga comercial ${L.cargaTotal ? "PROBADA (hay cuentas bajo el benchmark con carga sobre el nivel de referencia)" : "según su huella"}; precio de lista ${_mkBajo ? `INDICADO (markup promedio ${_val(mkCaen)} en los que caen contra ${_val(mkSanos)} en los sanos)` : "con el sello de su huella"}; mix ABIERTO (el dato no cruza cliente con familia). Un mecanismo indicado o abierto NO se descarta: nada de «no es precio ni mix» ni «apunta a carga, no a precio» — se nombra el probado y los otros quedan con su sello.`);
    lineas.push("- «Se deterioró» / «deterioro» afirma un movimiento en el tiempo: sin serie ni variación de eso en la boleta no se usa, ni como hipótesis ni como alternativa («negociación que se deterioró» → «negociación que quedó bajo la referencia»).");
    /* describir lo demostrado sin causalidad ni jerarquía causal (owner 2026-09-13, corrida 6) */
    lineas.push("- Lo demostrado se describe sin agregarle causa ni jerarquía: los que están sobre el benchmark solo tienen eso probado (no «con mejor costo», no «gracias a su mix»); y un mecanismo probado es eso —existe, tiene huella—, no «la causa dominante» ni «principal»: este turno no mide qué parte del efecto explica cada mecanismo. Di «un mecanismo probado» o «la huella más clara».");
    return lineas.length > 1 ? lineas.join("\n") : "";
  },

  /* EL ENTREGABLE ES DE LA RUTA, no del playbook (densidad ejecutiva, owner 2026-09-11). Medido en su batería en
   * vivo: ante «¿qué harías primero?» el cerebro recibía el entregable de siempre —«qué clientes están bajo el
   * benchmark… total y por cliente»— y obedecía: volcó los 8 clientes que nadie pidió. Y el porqué recibía el
   * mismo pedido de lista y salió en ~520 palabras con cinco subtítulos. Cada ruta pide SU entregable; la
   * lectura completa sigue siendo la de la ruta estándar, y el detalle se abre cuando lo piden. */
  entregable(pregunta) {
    switch (_rutaDe(pregunta)) {
      case "primero":
        return "por dónde entrar PRIMERO —una sola cuenta— y por qué esa: la contribución no capturada que concentra, con su cifra y contra el total. Sin recorrer la cartera: el ranking ya lo vio, y si lo quiere lo pide. La acción se OFRECE; jamás se ordena.";
      case "porque":
        return "por qué pasa, en prosa: la tesis en una frase; qué está medido, qué es patrón y qué queda abierto —cada mecanismo con su huella, dicho en lengua de negocio, sin etiquetas—; la pregunta al dueño sobre la intención (el dato no la mide); y por dónde entrarías, marcado como criterio tuyo. Los dos o tres que más pesan, con su cifra, alcanzan: la cartera cuenta por cuenta se abre cuando la pidan.";
      case "sello":
        return "qué parte está medida, qué parte es patrón y qué parte queda abierta, mecanismo por mecanismo, y lo que ninguna columna prueba —la intención—, que se le pregunta al dueño. Sin volver a contar la lectura entera.";
      case "seguimiento":
        return "si la lectura que este hilo ya dejó se confirma o cambia, re-midiendo: qué cambió y qué no, con su cifra, y qué harías con eso — ofrecido.";
      default:
        return "qué clientes están bajo el benchmark (con su margen y su venta), cuánta contribución no se captura —total y por cliente— y a quién conviene revisar primero, con su cifra. Las acciones se OFRECEN para que el usuario las evalúe; jamás se ordenan.";
    }
  },

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
  componer({ figs, semilla, pregunta, scenario, mem, declarar } = {}) {
    /* EL COLECTOR DEL NOTARIO viaja a cada ruta: lo que cada una escribe, lo declara ella misma (sin colector, mudo) */
    const D = declaradorDe(declarar);
    /* EL PORQUÉ TIENE SU PROPIO ENTREGABLE (owner 2026-09-04). Cuando la pregunta pide la causa y los pasos
     * trajeron los papeles, el peldaño determinístico RAZONA en vez de repetir dónde y cuánto — que es
     * exactamente el defecto que el owner encontró en producción. Si los papeles no están (la tool no corrió),
     * cae al entregable de siempre sin ruido. */
    /* EL SEGUIMIENTO va primero: «¿cambia tu lectura?» pide comparar contra la tesis del hilo, no una lectura
     * nueva. Con tesis → confirma o corrige RE-MIDIENDO; sin tesis → lo dice y arma el porqué completo, que es
     * lo honesto: un diario que finge recordar es peor que no tenerlo. */
    if (_rutaDe(pregunta) === "seguimiento") {
      const seg = componerElSeguimiento({ figs, semilla, scenario, mem, declarar: D });
      if (seg) return seg;
      const nuevo = componerElPorque({ figs, semilla, scenario, mem, declarar: D });
      if (nuevo) return `No tenemos una lectura previa en este hilo, así que te la armo ahora.\n\n${nuevo}`;
    }
    if (_rutaDe(pregunta) === "primero") {
      const prioridad = componerLaPrioridad({ figs, semilla, declarar: D });
      if (prioridad) return prioridad;
      /* sin la evidencia de la prioridad (diagnose no corrió), la lectura completa sigue siendo respuesta */
    }
    if (_rutaDe(pregunta) === "sello") {
      const sello = componerElSello({ figs, semilla, scenario, mem, declarar: D });
      if (sello) return sello;
    }
    if (_rutaDe(pregunta) === "porque") {
      const porque = componerElPorque({ figs, semilla, scenario, mem, declarar: D });
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
    const apertura = `${abre} ${_val(L.conteo)} de tus clientes están bajo esa referencia.`;
    partes.push(apertura);
    /* la apertura declara sus cifras del negocio (promedio, brecha sellada, benchmark) y el conteo bajo el benchmark */
    if (L.promedio) D.deFig(L.promedio, apertura);
    if (L.promedio && L.brechaNegocio) D.deFig(L.brechaNegocio, apertura);
    D.deFig(L.bench, apertura);
    D.conteo({ n: nDeclarado, predicado: "bajo el benchmark", universo: _U_CARTERA, texto: apertura });

    if (top.length) {
      /* EL UNIVERSO DE LA LISTA ES EL DE LAS CUENTAS MATERIALES (Notario semántico, fase 2, 2026-09-15): «los 3 de los 8 que más pesan» afirmaba los
       * tres mayores gaps entre los 8 bajo el benchmark; la lista es la de las materiales (gap ≥ pp mínimos y ≥ piso) —en el demo coincide, en un
       * pack no (una cuenta no material por pp puede dejar más)—. Se dice el universo del rótulo del subtotal, nunca a mano. */
      const _mat = /·\s*(\d+)\s+(?:cuentas?|clientes?)\s+materiales/i.exec(_lab(L.totalJuego)) ? +(/·\s*(\d+)\s+(?:cuentas?|clientes?)\s+materiales/i.exec(_lab(L.totalJuego))[1]) : null;
      const cabecera = _mat
        ? `Donde más contribución dejas sin capturar — los ${top.length} que más pesan de las ${_mat} cuentas materiales (de ${_val(L.conteo)} bajo el benchmark):`
        : `Donde más contribución dejas sin capturar — los ${top.length} de los ${_val(L.conteo)} que más pesan:`;
      partes.push(`\n${cabecera}`);
      /* la cabecera es un orden top-k de contribución no capturada entre los que caen; el «8» es el conteo de la boleta, y se declara acá también
       * porque el ensamblador del encargo no lleva la línea de arriba que lo declara */
      if (_mat && L.conteo) D.deFig(L.conteo, cabecera);
      _ordenTopK(D, { sujeto: top.map((t) => t.entidad), metrica: "Contribución no capturada", k: top.length, universo: _mat ? `las ${_mat} cuentas materiales` : `los ${_val(L.conteo)} clientes bajo el benchmark`, texto: cabecera });   // el universo con su tamaño (el «8» de la cabecera es el del orden o del subtotal)
      for (const t of top) {
        const m = L.bajo.find((b) => b.entidad === t.entidad);
        const venta = L.ventas.get(t.entidad);
        const fila = `- ${t.entidad} · deja ${t.fmt} sin capturar${m ? ` · margen ${m.fmt}` : ""}${venta ? ` · venta ${venta}` : ""}`;
        partes.push(fila);
        /* una línea por cliente, y cada cifra de la línea con su dueño: contribución no capturada, margen y venta */
        D.cifra({ sujeto: t.entidad, metrica: "Contribución no capturada", valor: t.fmt, texto: fila });
        if (m) D.cifra({ sujeto: t.entidad, metrica: "Margen", valor: m.fmt, texto: fila });
        if (venta) D.cifra({ sujeto: t.entidad, metrica: "Venta", valor: venta, texto: fila });
      }
    }
    // «En total: …» moría en el muro, Y CON RAZÓN: la fig es el SUBTOTAL de los focos del detector, no el
    // total del universo — la voz lo atribuye a su dueño (el motor) en vez de totalizarlo.
    /* «que el motor detecta» era voz de motor (Etapa 3, owner 2026-09-11): la cifra sigue siendo el subtotal de
     * los focos —no el total del universo— y la frase lo dice por su alcance («entre los que caen»), no por
     * quién la calculó. */
    /* ⚠️ «no capturada» y no «sin capturar»: el muro lee «capturar» como verbo de CIERRE y, con «carga comercial»
     * en la línea siguiente, vetaba el subtotal como brecha adjudicada a una palanca (medido al reescribir). */
    /* el subtotal se declara con el conjunto que su rótulo trae (las cuentas materiales de las que caen): es lo que
     * la cifra ES, y el juez lo cobraría si se declarara como el total de los que caen o de la cartera */
    if (L.totalJuego) {
      const suma = `Entre los que caen, la contribución no capturada suma ${_val(L.totalJuego)}.`;
      partes.push(`\n${suma}`);
      _declararSubtotal(D, L.totalJuego, "Contribución no capturada", suma);
    }
    if (L.cargaTotal) {
      const c0 = L.carga[0];
      const donde = `Dónde está: en carga comercial alta, ${_val(L.cargaTotal)}${c0 ? ` — la más pesada es la de ${c0.entidad} (${c0.fmt})` : ""}.`;
      partes.push(donde);
      _declararSubtotal(D, L.cargaTotal, "Carga comercial alta", donde);
      /* «la más pesada» es el máximo entre las cuentas cuya carga alta la boleta trae como cifra — ese es el universo que
       * el composer ordenó (la lista, no un número): si la boleta trajera la de otra cuenta con otro rótulo, no la vería */
      if (c0) {
        D.orden({ sujeto: c0.entidad, metrica: "Carga comercial alta", forma: "max", direccion: "mayor", universo: L.carga.map((x) => x.entidad), texto: donde });
        D.cifra({ sujeto: c0.entidad, metrica: "Carga comercial alta", valor: c0.fmt, texto: donde });
      }
    }
    /* el cierre VARÍA (owner 2026-09-03, «matar la repetición») — determinístico por semilla, y toda variante
     * conserva las anclas: nombra la entidad, declara el criterio («contribución en juego») y OFRECE. */
    if (top.length) {
      const cierre = variante(semilla, [
        `\n¿Lo abrimos por ${top[0].entidad}? Es donde hay más contribución en juego.`,
        `\nSi te parece, empiezo por ${top[0].entidad}: es donde hay más contribución en juego.`,
        `\nDonde hay más contribución en juego es ${top[0].entidad} — ¿lo abrimos?`,
      ]);
      partes.push(cierre);
      /* «donde hay más contribución en juego» es el máximo de contribución no capturada entre los que caen — un orden, no una opinión */
      D.orden({ sujeto: top[0].entidad, metrica: "Contribución no capturada", forma: "max", direccion: "mayor", universo: _U_BAJO, texto: cierre.trim() });
    }
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
    /* ⚠️ EL `\b` IMPOSIBLE, VIVO EN ESTA REGLA DESDE QUE NACIÓ (lo destapó el barrido del §5g al arreglarle su
     * propio hueco, 2026-09-05): `(?:cu[aá]l(?:es)?|qu[eé]|qui[eé]n(?:es)?)\b` — la alternativa «qu[eé]»
     * termina en clase con «é», y `\b` no cierra ahí. O sea que esta regla veía «que» y NO «qué», que es como
     * se escribe la pregunta que existe para cazar. Media ciega desde el día uno, sin daño visible porque el
     * resto del patrón la cubría de casualidad. Cierra con `_FIN`, el lookahead que sí cuenta acentos. */
    const pideDefinir = new RegExp(`¿[^?]{0,90}\\b(?:cu[aá]l(?:es)?|qu[eé]|qui[eé]n(?:es)?)${_FIN}[^?]*\\?|necesito que me digas|dime (?:si|cu[aá]l|qu[eé])|aclar[ae]mos|clarifiquemos`, "i").test(t);
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
      /* + LA PREGUNTA ABIERTA DEL MODELO (prompt de gerente, 2026-09-13): «Queda abierto si el volumen en Falabella
       * y Jumbo es una apuesta deliberada… o una fuga que se dejó crecer; esa respuesta la tiene el negocio, no el
       * dato» ardía por «es una apuesta deliberada» — la subordinada arranca en «si el volumen», no en «si eso». Un
       * «queda/sigue abierto si» y un «esa respuesta la tiene el negocio/dueño» son la conducta correcta, verbatim. */
      const _DUDA = /\bsi\s+(?:eso|ese|esa|esto|es|fue|son|fueron|el|la|los|las|un|una)\b|\bno s[ée] si\b|\bno puedo saber\b|\bel dato no (?:sabe|mide|dice)\b|\bhabr[íi]a que (?:confirmar|preguntar)\b|\bdepende de\b|\b(?:queda|sigue|est[aá]) abiert[oa]\b|\bno est[aá] cerrad[oa]\b|\b(?:esa|esta|la) respuesta la tiene el (?:negocio|due[ñn]o)\b/i;
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
    /* ── LA PRIORIDAD ES DEL PROCEDIMIENTO (ley del owner 2026-09-10, cableada tras la batería en vivo de la
     * Etapa 4, T6): la foto y el porqué habían elegido Falabella —por contribución en juego— y ante «¿qué
     * harías primero?» el cerebro contestó «Lider, no Falabella», con otro criterio y dos prioridades a elegir.
     * El referente y la conclusión no cambian de un turno al otro porque el narrador prefiera otro criterio:
     * la primera acción es la que deriva `prioridadDe` (la misma que escribe el composer). Se cobra si el texto
     * abre poniendo primero a OTRA cuenta del ranking, o dice «X, no Y» con Y = la elegida. */
    if (_rutaDe(pregunta) === "primero") {
      const pr = prioridadDe(figs);
      if (pr && pr.top && pr.juego.length > 1) {
        const top = pr.top.entidad;
        const otras = pr.juego.slice(1).map((x) => x.entidad);
        const _re = (n) => n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const primeraOracion = (t.split(/(?<=[.!?])\s+/)[0] || "");
        const abreConOtra = otras.find((o) => new RegExp(`^\\s*(?:\\*\\*)?${_re(o)}\\b`, "i").test(primeraOracion) || new RegExp(`\\b(?:entrar[ií]a|partir[ií]a|empezar[ií]a|arrancar[ií]a) por (?:la |el )?${_re(o)}\\b`, "i").test(primeraOracion));
        const niegaLaElegida = new RegExp(`\\b(?:no|en vez de|antes que) (?:por )?${_re(top)}\\b`, "i").test(primeraOracion);
        if ((abreConOtra && !new RegExp(`\\b${_re(top)}\\b`, "i").test(primeraOracion)) || niegaLaElegida) {
          v.push({ regla: "conclusion-cambiada",
            multa: `pones primero a ${abreConOtra || "otra cuenta"} y el procedimiento eligió ${top} —es donde hay más contribución en juego, y es lo que este hilo ya dijo—. La conclusión es del procedimiento, no del narrador: puedes explicar por qué ${top} va primero, no cambiar la prioridad ni ofrecer dos.` });
        }
      }
    }
    /* ── LA PRIORIDAD ES ESTABLE, EN CUALQUIER RUTA (owner 2026-09-13): «la recomendación principal no puede cambiar
     * entre Falabella y Líder según el criterio espontáneo del narrador. ADI debe tener una prioridad oficial y
     * conservarla. Si existe otro criterio válido, puede mostrarse como alternativa secundaria, no reemplazarla.»
     * La regla de arriba solo miraba la ruta «primero» y su primera oración; en el encargo compuesto el modelo puso
     * «Por dónde entraría yo primero: Líder — brecha mayor, causa probada» con la prioridad del procedimiento
     * (Falabella, más contribución en juego) relegada. Acá se busca la PRIMERA frase de prioridad del texto entero
     * —«entraría/partiría/empezaría/arrancaría por X», «primero: X», «prioridad: X», «X primero», «revisar X primero»,
     * «renegociar … con X primero»— y la cuenta que nombra tiene que ser la del procedimiento. Un criterio distinto
     * se admite DESPUÉS, como alternativa. Los nombres se comparan sin tildes (el modelo escribe «Líder»). */
    {
      const pr = prioridadDe(figs);
      if (pr && pr.top && pr.juego.length > 1 && !v.some((x) => x.regla === "conclusion-cambiada")) {
        const _sinTilde = (s) => String(s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        const tt = _sinTilde(t).replace(/\*\*/g, "");
        const cuentas = pr.juego.map((x) => x.entidad);
        const alt = cuentas.map((n) => _sinTilde(n).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|");
        const _PRIORIDAD = new RegExp(`(?:\\b(?:entrar[ií]a|partir[ií]a|empezar[ií]a|arrancar[ií]a|entro|parto|empiezo|arranco)\\b(?:\\s+yo)?(?:\\s+primero)?\\s+(?:por|con)\\s+(?:la\\s+|el\\s+)?(${alt})\\b|\\b(?:primero|prioridad|prioritari[oa]|primera acci[oó]n)\\s*[:—-]\\s*(${alt})\\b|\\b(?:revisar(?:[ií]a)?|renegociar(?:[ií]a)?|tocar(?:[ií]a)?|abrir(?:[ií]a)?)\\b[^.;\\n]{0,40}?\\b(?:con|a|en)?\\s*(${alt})\\s+primero\\b|\\b(${alt})\\s+primero\\b)`, "i");
        const m = _PRIORIDAD.exec(tt);
        const nombrada = m ? (m[1] || m[2] || m[3] || m[4]) : null;
        const topSinTilde = _sinTilde(pr.top.entidad);
        if (nombrada && _sinTilde(nombrada).toLowerCase() !== topSinTilde.toLowerCase()) {
          const oficial = cuentas.find((n) => _sinTilde(n).toLowerCase() === topSinTilde.toLowerCase()) || pr.top.entidad;
          const real = cuentas.find((n) => _sinTilde(n).toLowerCase() === _sinTilde(nombrada).toLowerCase()) || nombrada;
          v.push({ regla: "conclusion-cambiada",
            multa: `la primera acción que propones es ${real}, y la prioridad del procedimiento es ${oficial} —es donde hay más contribución en juego (${pr.top.fmt}) y es la que este análisis ya fijó—. La prioridad oficial se conserva: entra por ${oficial}; si tu criterio (brecha, causa probada) apunta a ${real}, muéstralo DESPUÉS como alternativa secundaria, nunca como primera acción.` });
        }
      }
    }
    if (_rutaDe(pregunta) === "porque" || _rutaDe(pregunta) === "primero") {
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
    /* EL PORQUÉ DE UN CRITERIO NO ES UNA CAUSA DEL NEGOCIO (corrida 3 del prompt de gerente, 2026-09-13): «elegí
     * Falabella porque concentra más dinero en pesos, no porque el dato lo ordene así» explica la elección del asesor
     * —marcada como criterio— y esta regla la cobraba como causalidad sin respaldo. La regla cobra el «porque» que
     * explica el RESULTADO; el «porque» de una elección declarada en primera persona queda fuera. */
    const _PORQUE_DE_CRITERIO = /(?<![\wáéíóúñ])(?:eleg[ií]|elijo|prefiero|prioriz[oé]|entrar[ií]a|partir[ií]a|empezar[ií]a|arrancar[ií]a|lo pongo primero|criterio m[ií]o|lectura m[ií]a|no porque el dato)(?![\wáéíóúñ])/i;   // lookarounds de la casa, nunca `` junto a una vocal acentuada
    for (const oracion of t.split(/[.!?\n]+/)) {
      if (!new RegExp(`\\bporque\\b|\\bse debe a\\b|\\bla causa (?:es|está)${_FIN}|\\bes consecuencia de\\b|\\bexplica por qu[eé]${_FIN}`, "i").test(oracion)) continue;
      if (_PORQUE_DE_CRITERIO.test(oracion)) continue;
      if (!MECANISMOS.test(oracion) && !CIFRA.test(oracion)) {
        v.push({ regla: "causa-sin-respaldo",
          multa: "afirmas una causa que el dato no declara: este playbook LOCALIZA (dónde está el exceso y cuánto es); para el porqué hace falta evidencia que este dato no trae. Reformula como localización o di que la causa no está medida." });
        break;
      }
    }
    return v;
  },
};
