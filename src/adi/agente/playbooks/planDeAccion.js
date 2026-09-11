/* === src/adi/agente/playbooks/planDeAccion.js · UNA COSA ESTA SEMANA, Y QUÉ MIRAR DESPUÉS ===================
 *
 * EL ENCARGO, palabra del owner (2026-09-09), última de su orden: «ADI debe convertir la lectura en una
 * secuencia concreta, pero SIN GESTIONAR POR EL USUARIO.» Y las cinco piezas que pidió, en orden:
 *   1 · primera acción · 2 · por qué esa primero · 3 · qué mirar para confirmar ·
 *   4 · segunda acción si la primera se valida · 5 · qué NO haría todavía.
 * Su formato, textual: «Esta semana haría una cosa: entrar por La Polar/Falabella. Miraría X, porque pesa Y.
 * Si se confirma Z, haría A; si no, pasaría a B. No haría C todavía porque el dato no lo sostiene.»
 * Más las tres de siempre: OFRECE, NO ORDENA · CRITERIO MARCADO · CADA CIFRA CON SU REFERENCIA.
 *
 * ⚠️ «SIN GESTIONAR» ES LA LÍNEA DE LA CASA, no una preferencia de estilo: «no somos un sistema que gestiona
 * cosas, es asesor» (CLAUDE.md §1). Por eso todo el plan va en primera persona condicional —haría, miraría,
 * entraría—: es lo que ADI haría en su lugar, no una orden ni una tarea asignada. El imperativo («llama a
 * Falabella», «renegocia ya») convierte al asesor en un sistema de tareas, y esa es la falla que el notario
 * de este playbook cobra.
 *
 * ⚠️ Y EL PASO 5 ES EL QUE LO HACE HONESTO. Un plan que solo dice qué hacer parece completo aunque esté
 * apoyado en aire; decir qué NO se hace todavía, y por qué, es lo que separa una secuencia de una lista de
 * buenas intenciones. Acá el «todavía no» sale del propio dato: el frente que pesa menos, o el que vive en
 * otro universo de dinero y no se puede sumar con el primero.
 *
 * PURO · determinístico · sin red. Cifras VERBATIM de la boleta. */

import { formaConversacional } from "../formaConversacional.js";
import { entidadNombrada, entidadesNombradas } from "./indiceEntidades.js";
import { reDeReferencia } from "../../oracle/entityRecord.js";
import { variante } from "../variacion.js";

const _val = (f) => String((f && (f.text || f.value)) || "");
const _lab = (f) => String((f && f.label) || "");
const _num = (f) => (f && Number.isFinite(f.raw) ? f.raw : NaN);
const _find = (figs, re) => (Array.isArray(figs) ? figs : []).find((f) => re.test(_lab(f))) || null;
const _all = (figs, re) => (Array.isArray(figs) ? figs : []).filter((f) => re.test(_lab(f)));
const _esc = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const _entidadDe = (l) => { const p = String(l || "").split("·").map((s) => s.trim()); return p.length >= 2 ? p[0] : null; };

const _ESCALA = { k: 1e3, m: 1e6, b: 1e9 };
const _ord = (f) => {
  const r = _num(f);
  if (Number.isFinite(r)) return r;
  const s = _val(f);
  const m = /(\d+(?:\.\d+)?)\s*([KkMmBb])?(?![A-Za-zÁÉÍÓÚÜáéíóúüÑñ])/.exec(s);
  if (!m) return NaN;
  return (/^[^\d]*-/.test(s) ? -1 : 1) * Number(m[1]) * (m[2] ? _ESCALA[m[2].toLowerCase()] : 1);
};

/* ── LOS FRENTES, con la cifra LITERAL que los ordena ──────────────────────────────────────────────────────
 * ⚠️ NO SE USA «Contribución no capturada», que es el subtotal más grande del diagnóstico y el más tentador:
 * el motor lo sella `derivada_no_reconciliada`. Un plan cuya primera acción se apoya en una cifra que el
 * propio dato declara no cerrada es un plan sin piso — y el owner fue explícito: si el dato dice que no
 * cierra, no se usa como apoyo central. Se ordena por lo que SÍ es lectura. */
/* `senal` es cómo ese frente suena en prosa — la usa el notario de la conclusión para ver si la primera
 * acción del texto se fue a OTRO frente que el que el procedimiento eligió. Defiende, nunca escribe. */
const _FRENTES = [
  { clave: "condiciones", re: /^Carga comercial alta · subtotal$/i, porEntidad: /· Carga comercial alta$/i,
    universo: "comercial", nombre: "las condiciones comerciales", senal: /condici[oó]n|carga comercial/i,
    accion: (n) => `entrar por ${n} y revisar su condición`,
    mirar: "si esa carga se pactó a cambio de volumen o se fue dando sola",
    noSostiene: "el dato mide cuánto se cede, no qué se negoció a cambio", siConfirma: "movería esa condición en la próxima renovación" },
  { clave: "cobro", re: /^Saldo vencido · total$/i, porEntidad: /· Saldo vencido$/i,
    universo: "comercial", nombre: "el cobro vencido", senal: /cobranza|\bcobro\b|vencid/i,
    accion: (n) => `entrar por ${n} y ordenar su cobranza`,
    mirar: "si ese vencido es de una factura en disputa o de plazo simplemente pasado",
    noSostiene: "el dato trae el saldo, no el motivo del atraso", siConfirma: "pondría esa cobranza primera en la semana" },
  { clave: "capital", re: /^Capital frenado · subtotal$/i, porEntidad: /· Capital frenado$/i,
    universo: "inventario", nombre: "el capital inmovilizado", senal: /reposici[oó]n|inventario|bodega|stock/i,
    accion: (n) => `frenar la reposición de ${n}`,
    mirar: "si ese artículo tiene una compra ya comprometida",
    noSostiene: "el dato no trae órdenes de compra ni plazos de proveedor", siConfirma: "frenaría el próximo pedido de ese artículo" },
];

const _PASOS = [
  { tool: "diagnose", args: {},
    para: "los frentes del negocio con su subtotal y con quién los concentra: es lo que ordena la secuencia, porque la primera acción se elige por tamaño medido y no por impresión" },
  { tool: "cobranza", args: {},
    para: "el saldo vencido, para que el cobro entre a la comparación con la misma unidad que los demás frentes" },
  { tool: "rolesCartera", args: {},
    para: "el nivel de carga declarado: la referencia sin la cual decir «cede mucho» es una opinión" },
];

/* ── LA ELÍPTICA NO ES DE ESTA RUTA ────────────────────────────────────────────────────────────────────────
 * ⚠️ ESTO LO PAGÓ UNA REGRESIÓN de doce combinaciones: «¿y qué harías primero?» tiene forma de acción, pero la
 * «y» dice que es la continuación de algo — su tema vive en el hilo, no en la pregunta. Contestarla con la
 * prioridad del negocio entero, después de que el usuario venía mirando cobranza o inventario, es cambiarle
 * el tema en silencio: exactamente el secuestro que la casa mide desde el examen del hilo. Ese turno tiene
 * dueño (`margen-en-riesgo` cuando el hilo es de margen) y sin hilo se declina, que es lo correcto.
 * Esta ruta atiende el pedido EXPLÍCITO de pasos: «qué hago esta semana», «por dónde empiezo». */
const _ELIPTICA = /^\s*¿?\s*y\s|\bhar[ií]as primero/i;
/* ── Y UN SUPUESTO DECLARADO TAMPOCO ES ESTA RUTA ──────────────────────────────────────────────────────────
 * ⚠️ SEGUNDA REGRESIÓN, y el repo ya la tenía escrita: «ponele que riachuelo tiene 30% de margen, qué
 * hacemos» está documentada en `contratoAgente` como el caso que una regla demasiado ancha rompe —«una regla
 * más ancha que su motivo rompe cosas que andaban»—. Tiene forma de acción, pero lo que pide es qué hacer
 * BAJO UN SUPUESTO que el dato no contiene; un plan armado sobre las cifras reales contesta otra pregunta y
 * se lleva el turno de la refutación del supuesto, que es lo correcto ahí. */
const _SUPUESTO = /\bponele que\b|\bsupongamos\b|\bpongamos que\b|\basumamos\b|\bsi (?:tuviera|fuera|creciera|subiera|bajara)\b/i;
/* ── NI UN OBJETO QUE EL DATO NO CONOCE ────────────────────────────────────────────────────────────────────
 * ⚠️ TERCERA REGRESIÓN, y la más instructiva: «que hago con Ferretería Aurora?» —una cuenta que NO está en el
 * pack— caía en la rama general y recibía el plan del negocio entero. Eso es peor que declinar: el dueño
 * preguntó por algo puntual y se lleva una respuesta que parece contestarle. Si la pregunta nombra un objeto
 * propio y el índice no lo resuelve, el turno no es de esta ruta: le toca el camino que declara que ese
 * nombre no está en el dato. */
const _NOMBRA_OBJETO = /\b(?:con|de|para|sobre)\s+[A-ZÁÉÍÓÚÑ][\wÁÉÍÓÚÑáéíóúñ.\-]*/;

/** el caso: `{ entidad }` o null. La forma la resuelve el detector único; la entidad, si la nombra. */
function _caso(pregunta) {
  const q = String(pregunta || "");
  if (formaConversacional(q) !== "accion") return null;
  if (_ELIPTICA.test(q)) return null;            // su tema está en el hilo: el turno es de otro
  if (_SUPUESTO.test(q)) return null;            // pide qué hacer bajo un supuesto: eso es de la proyección
  const ent = (() => { try { return entidadNombrada(q); } catch { return null; } })();
  /* ⚠️ NI UNA PREGUNTA SOBRE UNA CUENTA PUNTUAL, y ésta fue la corrección más limpia de las cuatro. La ruta
   * nació con una rama por cuenta —«¿qué hago con X?»— y eso competía con la FICHA, que existe justo para
   * responder por una entidad. Las dos salidas eran malas y se midieron: cuando el pack conocía el nombre,
   * esta ruta reclamaba el turno y su composer no podía cumplirlo (cayó R3 del gate del bucle); cuando no lo
   * conocía, le contestaba el plan del negocio entero a quien preguntó por algo puntual.
   * El arreglo es uno solo: EL PLAN DE ACCIÓN ES DEL NEGOCIO. El formato del owner lo dice solo —«entrar por
   * La Polar/Falabella»—: la cuenta la ELIGE ADI por tamaño medido, no la trae la pregunta. Un turno que
   * nombra un objeto es de la ficha, que va después en el registro y lo recibe entero. */
  if (ent || _NOMBRA_OBJETO.test(q)) return null;
  return { entidad: null };
}

/** los frentes presentes en la boleta, ordenados por su cifra — de mayor a menor. */
function _frentesMedidos(figs) {
  return _FRENTES
    .map((f) => { const tot = _find(figs, f.re); return tot ? { ...f, tot, v: _ord(tot) } : null; })
    .filter((x) => x && Number.isFinite(x.v))
    .sort((a, b) => b.v - a.v);
}

/* ── EL PUENTE CON LA CONVERSACIÓN ─────────────────────────────────────────────────────────────────────────
 * ⚠️ LO PIDIÓ EL OWNER MIRANDO LA PANTALLA DE PRODUCCIÓN (v2.22): venía cuatro preguntas hablando de dos
 * cuentas y de margen, preguntó «qué hago esta semana», y ADI abrió por cobranza y otra cuenta sin decir una
 * palabra de lo que acababa de mirar. La prioridad estaba BIEN —a nivel negocio el cobro vencido pesa varias
 * veces las condiciones— pero sin el puente parece que cambió de tema.
 * ⚠️ Y NO ES VOLVER A LEER EL HILO PARA CAMBIARLE EL TEMA, que es lo contrario de lo que la casa protege: el
 * plan SIGUE eligiendo por tamaño medido, y el hilo solo se NOMBRA. Reconocer de dónde viene la conversación
 * y sostener igual la prioridad es lo que hace un asesor; lo que no hace es fingir que la charla no existió.
 * Se leen solo los turnos del USUARIO —lo que él dijo, no lo que ADI respondió— y solo para nombrarlos. */
function _cuentasDelHilo(ctx) {
  const hist = (ctx && Array.isArray(ctx.history)) ? ctx.history : [];
  const nombres = [];
  for (const h of hist.slice(-8)) {
    if (!h || h.role !== "user" || typeof h.text !== "string") continue;
    let ents = [];
    try { ents = entidadesNombradas(h.text, "cliente") || []; } catch { ents = []; }
    for (const e of ents) if (!nombres.includes(e.nombre)) nombres.push(e.nombre);
  }
  return nombres.slice(-2);
}

/** quién concentra un frente: el primero de su lista por entidad, con su cifra y la del que le sigue. */
function _quienLoConcentra(figs, frente) {
  const xs = _all(figs, frente.porEntidad)
    .map((f) => ({ n: _entidadDe(_lab(f)), v: _ord(f), fmt: _val(f) }))
    .filter((x) => x.n && Number.isFinite(x.v))
    .sort((a, b) => b.v - a.v);
  return xs.length ? { primero: xs[0], segundo: xs[1] || null, cola: xs.length > 2 } : null;
}

/* ── LA PRIMERA ACCIÓN ES DEL PROCEDIMIENTO, NO DEL NARRADOR (ley del owner, 2026-09-10) ───────────────────
 * El frente que abre la semana y la cuenta por la que se entra se derivan UNA vez acá, y de esta función
 * comen los dos lados: `componer` la escribe y `listaNotarial` la defiende. El narrador puede explicar el
 * plan más corto, más simple o para otro lector; lo que no puede es cambiarle la primera acción — ni el
 * frente ni su dueño —, porque esa elección salió de las cifras medidas, no de su redacción. */
function _primeraAccion(figs) {
  const frentes = _frentesMedidos(figs);
  if (!frentes.length) return null;
  const uno = frentes[0];
  const quien = _quienLoConcentra(figs, uno);
  if (!quien) return null;
  return { tipo: "primera-accion", frente: uno, entrada: quien.primero.n, frentes, quien };
}

/** LA CONCLUSIÓN del procedimiento para esta pregunta con esta boleta — o null si la ruta no aplica. */
export function conclusionDe(figs, pregunta) {
  return _caso(pregunta) ? _primeraAccion(figs) : null;
}

/* darla por sin urgencia también es cambiarla — la misma forma que el veto de comparar, con las mismas razones */
const _NIEGA = (n) => new RegExp(
  `${_esc(n)}[^.\\n]{0,60}?\\b(?:no (?:necesita|requiere|urge|corre prisa|amerita)|no es (?:la |lo )?(?:prioridad|urgente|urgencia)|puede esperar)`, "i");

export const planDeAccion = {
  nombre: "plan-de-accion",

  ejemplos: [
    "qué hago esta semana",
    "por dónde empiezo",
    "dame los tres pasos",
    "qué le digo al equipo comercial",
  ],

  cuandoAplica(pregunta) { return _caso(pregunta) !== null; },

  pasos(pregunta) { return _caso(pregunta) ? _PASOS : []; },

  /* la promesa es el frente que ordena la secuencia: sin una cifra literal que diga por dónde empezar, un
   * plan es una lista de buenas intenciones — y el playbook se retira en vez de improvisar el orden. */
  obligatorias(pregunta) {
    return _caso(pregunta) ? [/^Carga comercial alta · subtotal$|^Saldo vencido · total$|^Capital frenado · subtotal$/i] : [];
  },

  entregable: "CONVIERTE LA LECTURA EN UNA SECUENCIA, sin gestionar por él. Las cinco piezas, en este orden: (1) LA PRIMERA ACCIÓN, una sola, nombrando por dónde entrar; (2) POR QUÉ ESA PRIMERO, con su cifra y contra qué se compara, y si es criterio tuyo, dilo; (3) QUÉ MIRAR PARA CONFIRMAR — la pieza que él tiene y el dato no; (4) LA SEGUNDA ACCIÓN si eso se confirma, y la alternativa si no; (5) QUÉ NO HARÍAS TODAVÍA, y por qué el dato no lo sostiene. ⚠️ OFRECE, NO ORDENES: todo en primera persona condicional —«haría», «miraría», «entraría»—, jamás en imperativo. ADI asesora, no gestiona: un «llama a Falabella» convierte al asesor en un sistema de tareas. ⚠️ Y no apoyes la primera acción en una cifra que el dato declare no reconciliada.",

  componer({ figs, pregunta, semilla, ctx } = {}) {
    const c = _caso(pregunta);
    if (!c) return null;
    /* la primera acción sale de la MISMA función que defiende el notario (ley del 2026-09-10) */
    const pa = _primeraAccion(figs);
    const frentes = pa ? pa.frentes : _frentesMedidos(figs);
    if (!frentes.length) return null;
    const nivel = _find(figs, reDeReferencia("pctRebate"));
    const p = [];

    /* ── (a) EL PLAN SOBRE UNA CUENTA NOMBRADA ─────────────────────────────────────────────────────────────
     * Si el dueño ya eligió por dónde, la secuencia es sobre ESA cuenta: elegirle otra sería no escucharlo. */
    if (c.entidad) {
      const suyo = frentes.map((f) => {
        const propio = _all(figs, f.porEntidad).find((x) => _entidadDe(_lab(x)) === c.entidad);
        return propio ? { f, propio, v: _ord(propio) } : null;
      }).filter(Boolean).sort((a, b) => b.v - a.v);
      if (!suyo.length) return null;
      const [primero, ...resto] = suyo;
      p.push(`Esta semana haría una cosa con ${c.entidad}: ${primero.f.accion(c.entidad)}.`);
      p.push(`Por qué esa primero: es donde esa cuenta pesa —${_val(primero.propio)}${resto.length ? ` contra ${_val(resto[0].propio)} del otro frente` : ` de ${_val(primero.f.tot)} que suma ese frente en toda la cartera`}—. Y es criterio mío: prefiero entrar por lo que ya está medido antes que por lo que habría que salir a averiguar.`);
      p.push(`Qué miraría para confirmar: ${primero.f.mirar}. Eso no está en el dato — ${primero.f.noSostiene}.`);
      p.push(resto.length
        ? `Si se confirma, ${primero.f.siConfirma}; si resulta que no, pasaría al otro frente de esa cuenta (${_val(resto[0].propio)}) en vez de insistir ahí.`
        : `Si se confirma, ${primero.f.siConfirma}; si no, no insistiría por ese lado y lo miraría desde la cartera completa.`);
      p.push(`Lo que NO haría todavía: darle un objetivo al equipo sobre esta cuenta. ${primero.f.noSostiene[0].toUpperCase()}${primero.f.noSostiene.slice(1)}, así que un objetivo fijado hoy se apoyaría en la mitad de la historia.`);
      p.push(variante(semilla, [
        `¿Te preparo el detalle de ${c.entidad} para esa conversación?`,
        `Si quieres armo la ficha de ${c.entidad} para que entres con las cifras.`,
        `Dime si te dejo el detalle listo para hablar con ${c.entidad}.`,
      ]));
      return p.join("\n");
    }

    /* ── (b) EL PLAN DEL NEGOCIO · la secuencia se ordena por lo que está medido ───────────────────────────── */
    if (!pa) return null;
    const { frente: uno, quien, entrada } = pa;
    const dos = frentes[1];

    /* 1 · LA PRIMERA ACCIÓN — una sola, y el owner insistió en eso: «haría una cosa» */
    /* EL PUENTE, cuando la conversación venía de otro lado. Va PRIMERO y en una línea: reconoce de dónde
     * viene la charla y sostiene igual la prioridad medida — no la cambia. Si el hilo no nombró cuentas, o
     * nombró justo la que sale elegida, no hay puente que tender y no se dice nada. */
    const delHilo = _cuentasDelHilo(ctx).filter((n) => n !== entrada);
    if (delHilo.length) {
      p.push(`Veníamos mirando ${delHilo.join(" y ")}. Mirando el negocio entero la semana no arranca ahí, y te digo por qué.`);
    }
    p.push(`Esta semana haría una cosa: ${uno.accion(entrada)}.`);
    /* 2 · POR QUÉ ESA PRIMERO — la cifra CON su referencia, y el criterio marcado como criterio */
    /* ⚠️ CADA CIFRA CON EL NOMBRE DE SU DUEÑO AL LADO, y lo cazó el guardia de entidades en la primera
     * corrida: la frase decía «ahí se concentra $4.6M de $12.6M» con la entidad nombrada una línea antes, y
     * esa cifra es de una cuenta puntual. Una cifra huérfana en una frase donde hay otro monto se lee como si
     * fuera del otro — es el defecto de atribución que el muro existe para impedir. */
    p.push(`Por qué esa primero: ${quien.primero.n} concentra ${quien.primero.fmt} de ${_val(uno.tot)} que suma ${uno.nombre} en toda la cartera${quien.segundo ? `, y le sigue ${quien.segundo.n} con ${quien.segundo.fmt}` : ""}${nivel && uno.clave === "condiciones" ? ` — todo eso medido por sobre el nivel de carga de ${_val(nivel)} que tienes declarado` : ""}. Y es criterio mío, no del dato: entro por la que concentra, porque una conversación bien preparada rinde más que tres apuradas.`);
    /* 3 · QUÉ MIRAR PARA CONFIRMAR — la pieza que él tiene */
    p.push(`Qué miraría para confirmar: ${uno.mirar}. Eso no lo tengo — ${uno.noSostiene}, y lo sabes tú o tu equipo comercial.`);
    /* 4 · LA SEGUNDA ACCIÓN, condicionada a lo anterior */
    p.push(quien.segundo
      ? `Si se confirma que no hubo nada a cambio, seguiría por ${quien.segundo.n} con la misma conversación. Si resulta que no, no insistiría por ahí: pasaría a ${dos ? dos.nombre : "el frente que siga por tamaño"}${dos ? ` (${_val(dos.tot)})` : ""}.`
      : `Si se confirma, repetiría la conversación con las que siguen en esa lista. Si no, pasaría a ${dos ? `${dos.nombre} (${_val(dos.tot)})` : "el frente que siga por tamaño"}.`);
    /* 5 · QUÉ NO HARÍA TODAVÍA — y la razón sale del dato, no de una opinión */
    const ultimo = frentes[frentes.length - 1];
    if (ultimo && ultimo.clave !== uno.clave) {
      const otroMundo = ultimo.universo !== uno.universo;
      /* la referencia se nombra por lo que ES —«contra los $12.6M del cobro vencido»—, no por su lugar en el
       * texto: «el frente de arriba» le pide al dueño que cuente párrafos para entender contra qué se compara. */
      p.push(`Lo que NO haría todavía: mover ${ultimo.nombre}. Pesa ${_val(ultimo.tot)} contra los ${_val(uno.tot)} de${/^(?:el|la|las|los) /.test(uno.nombre) ? uno.nombre.replace(/^el /, "l ").replace(/^(la|las|los) /, " $1 ") : ` ${uno.nombre}`}${otroMundo ? `, y encima es otro dinero —ese sale del inventario y el primero de la venta comercial, que en este dato no cierran entre sí, así que se ordenan por urgencia y no se suman—` : ""}. Gastar la semana ahí es gastarla en lo chico.`);
    } else {
      p.push(`Lo que NO haría todavía: repartir la semana en varios frentes. Con una sola cifra medida por delante, abrir tres conversaciones a la vez es quedarse sin ninguna cerrada.`);
    }
    p.push(variante(semilla, [
      `¿Te preparo el detalle de ${entrada} para esa conversación?`,
      `Si quieres armo la ficha de ${entrada} y entras con las cifras en la mano.`,
      `Dime si te dejo listo el detalle de ${entrada}.`,
    ]));
    return p.join("\n");
  },

  listaNotarial(texto, { figs, pregunta } = {}) {
    const t = String(texto || "");
    const c = _caso(pregunta);
    if (!c || !t.trim()) return [];
    const v = [];
    const cita = (Array.isArray(figs) ? figs : []).some((f) => _val(f) && /\d/.test(_val(f)) && t.includes(_val(f)));
    if (!cita) return v;                         // sin cifras no está dando un plan: declinar no se multa

    /* ⚠️ (1) LAS CINCO PIEZAS DEL OWNER. Un plan al que le falta una parece completo igual, y esa es la
     * trampa: el que falta casi siempre es el 5, el «todavía no» — justo el que lo hace honesto. */
    const PIEZAS = [
      ["la primera acción", /esta semana har[ií]a|una cosa:|entrar[ií]a por|primero har[ií]a/i],
      ["por qué esa primero", /por qu[eé] esa primero|porque (?:ah[ií]|pesa|se concentra)|ah[ií] se concentra/i],
      ["qué mirar para confirmar", /qu[eé] mirar[ií]a|para confirmar|miraría/i],
      ["la segunda acción si se confirma", /si se confirma|si resulta|si no,|pasar[ií]a a|seguir[ií]a por/i],
      ["qué NO harías todavía", /no har[ií]a todav[ií]a|todav[ií]a no har[ií]a/i],
    ];
    const faltan = PIEZAS.filter(([, re]) => !re.test(t)).map(([n]) => n);
    if (faltan.length) {
      v.push({ regla: "plan-incompleto", multa: `al plan le faltan piezas: ${faltan.join(" · ")}. El owner pidió las cinco, en orden — y la que más se cae es la última: decir qué NO harías todavía, y por qué el dato no lo sostiene, es lo que separa una secuencia de una lista de buenas intenciones.` });
    }
    /* ⚠️ (2) OFRECE, NO ORDENA · ADI asesora, no gestiona (CLAUDE.md §1) */
    /* ⚠️ EL IMPERATIVO SE ANCLA AL ARRANQUE DE LA CLÁUSULA, y lo pagó un falso positivo mío: en español la
     * tercera persona y el imperativo se escriben igual —«la lista CORTA de la semana» no ordena cortar nada—,
     * así que un patrón suelto multa prosa correcta. Se exige que el verbo abra la cláusula, que es donde una
     * orden vive de verdad. «corta» y «arregla» salieron de la lista: son adjetivo y verbo corriente antes
     * que orden, y una regla que muerde prosa buena se termina apagando. */
    /* ⚠️ y el cierre es `(?![\wáéíóúñ])`, no `\b`: tras la «á» de «llamá» el `\b` de JS no existe — la trampa
     * de la casa, que en este archivo mordió a la primera. */
    const ORDENA = /(?:^|[.;:—]\s*|\by\s+)(?:llama|llamá|habla|hablá|renegocia|revisa|manda|env[ií]a|exige|pide|convoca|implementa|ejecuta)(?![\wáéíóúñ])(?!r)|\bdebes\b|\btienes que\b|\bhay que\b/i;
    const m = ORDENA.exec(t);
    if (m) {
      v.push({ regla: "plan-que-ordena", multa: `escribes «${m[0]}»: eso es una orden, y ADI asesora, no gestiona. El plan va en primera persona condicional —«haría», «miraría», «entraría»—, que es lo que tú harías en su lugar. Un imperativo convierte al asesor en un sistema de tareas.` });
    }
    /* (3) EL CRITERIO SE MARCA como criterio — lo que es juicio no puede pasar por lectura del dato */
    if (!/criterio m[ií]o|es criterio|yo (?:entrar[ií]a|har[ií]a|prefiero)|prefiero/i.test(t)) {
      v.push({ regla: "plan-sin-criterio-marcado", multa: "el orden que propones es un juicio tuyo y no lo dices. Marca cuál parte es criterio —«es criterio mío», «prefiero»— para que el dueño sepa qué le está diciendo el dato y qué se lo estás diciendo tú." });
    }
    /* ⚠️ (4) LA PRIMERA ACCIÓN ES DEL PROCEDIMIENTO, NO DEL NARRADOR (ley del owner, 2026-09-10). Se busca la
     * cláusula donde el texto declara su primera acción y se verifica que sea LA MISMA que derivó el
     * procedimiento — mismo frente, mismo dueño. Si el texto no declara ninguna, ya lo multó (1) por pieza
     * faltante y acá no se adivina. La derivación es la del composer (`_primeraAccion`): una verdad. */
    const pa = _primeraAccion(figs);
    if (pa) {
      const m1 = /(?:esta semana har[ií]a|una cosa:|primero har[ií]a|entrar[ií]a por)[^.\n]*/i.exec(t);
      const reEntrada = new RegExp(_esc(pa.entrada).replace(/\s+/g, "\\s+"), "i");
      if (m1 && !reEntrada.test(m1[0])) {
        /* ⚠️ los candidatos a «otro dueño» son las cuentas MEDIDAS EN ALGÚN FRENTE — no todo lo que tenga un
         * «·» en el rótulo: «Contribución no capturada · subtotal» partido por el punto medio parece una
         * entidad y no lo es, y una lista sucia acá es un falso positivo esperando su turno. */
        const entidades = [...new Set(_FRENTES.flatMap((f) => _all(figs, f.porEntidad).map((x) => _entidadDe(_lab(x)))).filter(Boolean))];
        const otra = entidades.find((n) => n !== pa.entrada && new RegExp(`(?:^|[^\\wáéíóúñ])${_esc(n)}(?![\\wáéíóúñ])`, "i").test(m1[0]));
        const otroFrente = _FRENTES.find((f) => f.clave !== pa.frente.clave && f.senal.test(m1[0]));
        if (otra || otroFrente) {
          v.push({ regla: "conclusion-cambiada", multa: `tu primera acción arranca por ${otra ? `«${otra}»` : otroFrente.nombre}, y el procedimiento eligió ${pa.frente.accion(pa.entrada)} con las cifras de esta boleta. La conclusión es del procedimiento, no del narrador: puedes explicar el plan para quien te lo pidieron, no cambiarle la primera acción.` });
        } else if (!reEntrada.test(t)) {
          v.push({ regla: "conclusion-cambiada", multa: `la primera acción quedó sin su dueño: el procedimiento eligió entrar por ${pa.entrada} con las cifras de esta boleta y tu plan no lo nombra. Adaptar el plan no es cambiarle el sujeto a la primera acción.` });
        }
      }
      if (_NIEGA(pa.entrada).test(t)) {
        v.push({ regla: "conclusion-cambiada", multa: `dices que ${pa.entrada} no corre prisa, y es justamente por donde el procedimiento entra primero con las cifras de esta boleta. La conclusión es del procedimiento, no del narrador: la primera acción no se da vuelta al redactarla.` });
      }
    }
    return v;
  },
};
