/* === src/adi/agente/playbooks/compararAlternativas.js · LOS DOS CAMINOS, CON PRECIO =========================
 *
 * EL ENCARGO, palabra del owner (2026-09-09), cuarto de su orden, con sus cuatro frases:
 *   «¿miro La Polar o Falabella?» · «¿qué es más urgente, margen o cobranza?» · «¿vendo más o protejo margen?»
 *   · «¿renegocio Falabella o recupero La Polar?»
 *   «ADI debe comparar los dos caminos, ponerles precio, elegir o marcar tradeoff. No responder solo una
 *    alternativa ni esconder la otra.»
 *
 * LA FALLA QUE ESTA RUTA IMPIDE es contestar la mitad de una disyuntiva. Ante «¿miro A o B?», un motor de
 * lecturas abre A —la primera que reconoce— y el dueño se queda sin lo que pidió: no pidió ver A, pidió
 * saber CUÁL. Y esconder la otra es peor que no contestar, porque parece una recomendación.
 *
 * EL ARCO:
 *   1 · LOS DOS CAMINOS, nombrados. Si ADI entendió mal cuáles son, el dueño lo ve en la primera línea.
 *   2 · EL PRECIO DE CADA UNO, con su cifra Y SU REFERENCIA (la ley del owner del mismo día): un monto solo
 *       no permite elegir. Acá el precio es lo que cada camino recupera o pone en juego.
 *   3 · ELEGIR, o MARCAR EL TRADEOFF. Las dos son respuestas legítimas y el dato decide cuál toca: cuando un
 *       precio es de otro tamaño, se elige y se dice por qué; cuando los dos caminos miden cosas distintas
 *       —o salen de universos distintos— se declara y no se finge una comparación.
 *   4 · LA PIEZA QUE TIENE ÉL, preguntada concreta.
 *
 * ⚠️ EL PRECIO SE PAGA CON CIFRAS QUE SON LECTURA. Medido en la ruta anterior: el motor sella algunos totales
 * `source: computed` —«no es una lectura del dato, es un supuesto del motor»— y el muro los voltea con razón.
 * Distinto es el EXCESO sobre un nivel declarado: es `actual`, y su sello dice que depende de que ese nivel
 * sea alcanzable. Por eso se cita SIEMPRE junto al nivel del que se mide, nunca como dinero que está ahí.
 *
 * ⚠️ Y DOS MONTOS DE UNIVERSOS DISTINTOS NUNCA VAN JUNTOS SIN DECIR DE CUÁL SALE CADA UNO (CLAUDE.md §2).
 * Comparar margen con capital de inventario es legítimo — esconder que son dos mundos, no.
 *
 * PURO · determinístico · sin red. Cifras VERBATIM de la boleta. */

import { formaConversacional } from "../formaConversacional.js";
import { entidadesNombradas } from "./indiceEntidades.js";
import { reDeReferencia } from "../../oracle/entityRecord.js";
import { variante } from "../variacion.js";

const _val = (f) => String((f && (f.text || f.value)) || "");
const _lab = (f) => String((f && f.label) || "");
const _num = (f) => (f && Number.isFinite(f.raw) ? f.raw : NaN);
const _find = (figs, re) => (Array.isArray(figs) ? figs : []).find((f) => re.test(_lab(f))) || null;
const _esc = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/* el número para COMPARAR cuando la cifra no trae `raw`, con su escala. Nunca para mostrar. */
const _ESCALA = { k: 1e3, m: 1e6, b: 1e9 };
const _ord = (f) => {
  const r = _num(f);
  if (Number.isFinite(r)) return r;
  const s = _val(f);
  const m = /(\d+(?:\.\d+)?)\s*([KkMmBb])?(?![A-Za-zÁÉÍÓÚÜáéíóúüÑñ])/.exec(s);
  if (!m) return NaN;
  return (/^[^\d]*-/.test(s) ? -1 : 1) * Number(m[1]) * (m[2] ? _ESCALA[m[2].toLowerCase()] : 1);
};

/* ── LOS DOS CAMINOS QUE EL USUARIO PUSO EN LA BALANZA ────────────────────────────────────────────────────── */
const _MARGEN = /\bmargen(?:es)?\b|\brentabilidad\b|\bcontribuci[oó]n\b|\bprotej|\bproteger\b/i;
const _COBRANZA = /\bcobranza\b|\bcobrar\b|\bcobro\b|\bdeuda\b|\bvencid|\bmora\b|\bpor cobrar\b/i;
const _CAPITAL = /\binventario\b|\bstock\b|\bcapital\b|\bbodega[s]?\b|\bfrenado\b/i;
const _VOLUMEN = /\bvend(?:o|er)\b|\bventa[s]?\b|\bvolumen\b|\bcrecer\b|\bfacturar\b|\bcrecimiento\b/i;

const _TIPOS = {
  cuentas: {
    pasos: (c) => [
      { tool: "compareEntities", args: { entities: c.opciones, dimension: "cliente" },
        para: "las dos cuentas lado a lado en la MISMA lectura: venta, margen, contribución y carga comercial — lo que cada camino pone en juego, sin mezclar fuentes" },
      { tool: "salesRead", args: { focus: "vs_anterior", dimension: "cliente" },
        para: "el movimiento de cada una contra el período comparable: lo que una cuenta que cae dejó de comprar es el precio de recuperarla" },
      /* ⚠️ EL NIVEL DECLARADO ES UN PASO PROPIO, y lo pagó una afirmación falsa: sin él, el composer decía «no
       * cede de más» de una cuenta que cede 4.5% contra un nivel de 3.5%. `compareEntities` publica la carga
       * de cada cuenta pero NO la referencia contra la que se mide, y una carga sin su referencia no permite
       * juzgar nada — la regla del owner del mismo día. Callarse habría sido un hueco; afirmar lo contrario
       * es peor. */
      { tool: "rolesCartera", args: {},
        para: "el nivel de carga declarado del negocio: la referencia sin la cual la carga de cada cuenta no dice si cede de más o está donde debe" },
    ],
  },
  dominios: {
    pasos: [
      { tool: "diagnose", args: {},
        para: "el subtotal de cada frente —lo que se cede en acciones comerciales y el capital frenado—: el precio de atacar cada uno" },
      { tool: "cobranza", args: {},
        para: "el saldo vencido: el precio del frente de cobranza, para poder ponerlo al lado de los otros" },
    ],
  },
  estrategias: {
    pasos: [
      { tool: "salesRead", args: { focus: "vs_anterior", dimension: "cliente" },
        para: "cómo viene la venta y qué cuentas se mueven: el camino de crecer, medido" },
      { tool: "diagnose", args: {},
        para: "cuánto se está cediendo en acciones comerciales: el camino de proteger margen, medido en la misma unidad, dinero" },
      { tool: "rolesCartera", args: {},
        para: "el nivel de carga declarado y cuántas cuentas lo exceden — la referencia sin la cual un monto no permite elegir" },
    ],
  },
};

/* ── COMPARAR DOS PERÍODOS NO ES ELEGIR ENTRE DOS CAMINOS ─────────────────────────────────────────────────
 * ⚠️ ESTO SE LLEVÓ DOS TURNOS AJENOS, uno de ellos de la certificación: «Compara Q1 vs Q2 en ventas, margen y
 * contribución» y «compara marzo vs abril…» tienen forma de comparación —la tienen de verdad— y nombran
 * ventas y margen, así que caían en la rama de estrategia y recibían «los dos caminos, con precio». No es lo
 * que preguntan: comparan dos PERÍODOS, y la respuesta correcta la da `limite-honesto`, que declina porque
 * este dato no trae corte por trimestre. Un camino es algo que el dueño puede hacer; un mes no lo es. */
const _PERIODO = /\bQ[1-4]\b|\btrimestre[s]?\b|\bsemestre[s]?\b|\bene(?:ro)?\b|\bfeb(?:rero)?\b|\bmar(?:zo)?\b|\babr(?:il)?\b|\bmay(?:o)?\b|\bjun(?:io)?\b|\bjul(?:io)?\b|\bago(?:sto)?\b|\bsep(?:tiembre)?\b|\boct(?:ubre)?\b|\bnov(?:iembre)?\b|\bdic(?:iembre)?\b|\baño (?:pasado|anterior)\b|\bmes (?:pasado|anterior)\b/i;
const _COMPARA_PERIODOS = (q) => (String(q).match(new RegExp(_PERIODO.source, "gi")) || []).length >= 2;

/** el caso: `{ tipo, opciones }` o null si la disyuntiva no se puede pesar con el dato que hay. */
function _caso(pregunta) {
  const q = String(pregunta || "");
  if (formaConversacional(q) !== "comparar") return null;
  if (_COMPARA_PERIODOS(q)) return null;         // dos períodos no son dos caminos: el turno es de otro
  /* DOS CUENTAS NOMBRADAS mandan: «¿renegocio A o recupero B?» es una disyuntiva ENTRE ELLAS */
  const ents = (() => { try { return entidadesNombradas(q, "cliente"); } catch { return []; } })();
  if (ents.length >= 2) return { tipo: "cuentas", opciones: ents.slice(0, 2).map((e) => e.nombre) };
  /* DOS FRENTES del negocio: margen · cobranza · capital */
  const frentes = [];
  if (_MARGEN.test(q)) frentes.push("margen");
  if (_COBRANZA.test(q)) frentes.push("cobranza");
  if (_CAPITAL.test(q)) frentes.push("capital");
  if (frentes.length >= 2) return { tipo: "dominios", opciones: frentes.slice(0, 2) };
  /* CRECER vs PROTEGER: la disyuntiva de estrategia, que no nombra frentes sino direcciones */
  if (_VOLUMEN.test(q) && _MARGEN.test(q)) return { tipo: "estrategias", opciones: ["volumen", "margen"] };
  return null;                                   // disyuntiva sin dos caminos identificables: se retira
}

const _pasosDe = (c) => { const t = _TIPOS[c.tipo]; return typeof t.pasos === "function" ? t.pasos(c) : t.pasos; };

/* el precio de cada frente, con el rótulo por el que se lee y la palabra con que se nombra en pantalla */
const _PRECIO_FRENTE = {
  margen: { re: /^Carga comercial alta · subtotal$/i, nombre: "el margen", que: "es lo que se está cediendo en acciones comerciales por sobre el nivel que tienes declarado" },
  cobranza: { re: /^Saldo vencido · total$/i, nombre: "la cobranza", que: "es lo que ya se pasó de plazo, del total que te deben" },
  capital: { re: /^Capital frenado · subtotal$|^Capital frenado · total$/i, nombre: "el capital en inventario", que: "es lo que está inmovilizado en bodega" },
};

/* ── LA CONCLUSIÓN ES DEL PROCEDIMIENTO, NO DEL NARRADOR (ley del owner, 2026-09-10) ───────────────────────
 * La elección —cuál camino va primero, o que el dato no elige— se deriva UNA vez acá, y de estas funciones
 * comen los dos lados: `componer` la escribe y `listaNotarial` la defiende. No es una copia del criterio: es
 * el criterio. El narrador puede explicarla, resumirla o adaptarla al destinatario; lo que no puede es elegir
 * el otro camino, dar por resuelto el elegido, ni inventar una elección donde el dato no eligió. La falla se
 * vio en la pantalla del owner el mismo día: el camino de respaldo recomendó renegociar la cuenta descartada
 * y dio por sana justo la que el procedimiento había elegido — misma boleta, conclusión opuesta. */
function _ladosDeCuentas(opciones, figs) {
  const [A, B] = opciones;
  const g = (e, re) => _find(figs, new RegExp(`^${_esc(e)} · ${re}$`, "i"));
  const nivel = _find(figs, reDeReferencia("pctRebate"));
  const lado = (e) => {
    const contrib = g(e, "Contribución"), carga = g(e, "Carga comercial"), yoy = g(e, "YoY"), margen = g(e, "Margen");
    if (!contrib) return null;
    /* el precio: si la cuenta CAE, recuperarla vale lo que dejó de comprar; si CEDE de más, renegociarla
     * vale volver al nivel declarado. Las dos cosas se dicen con su referencia al lado. */
    const cae = yoy && Number.isFinite(_ord(yoy)) && _ord(yoy) < 0;
    const cede = carga && nivel && Number.isFinite(_ord(carga)) && Number.isFinite(_ord(nivel)) && _ord(carga) > _ord(nivel);
    /* ⚠️ SIN LA REFERENCIA NO SE AFIRMA NADA. La primera versión decía «no cede de más» cuando el nivel
     * declarado no venía en la boleta — y la cuenta sí cedía. Una carga sin su referencia no autoriza
     * ninguna de las dos conclusiones: se dice la cifra y se declara que falta contra qué medirla. */
    const precio = cae ? `viene ${_val(yoy)} contra el período comparable, así que recuperarla es recuperar eso`
      : cede ? `cede ${_val(carga)} de carga comercial contra un nivel declarado de ${_val(nivel)}, y ahí está lo que una renegociación devuelve`
      : (carga && nivel) ? `no cae, y su carga va ${_val(carga)} dentro del nivel declarado de ${_val(nivel)}${margen ? `, con el margen en ${_val(margen)}` : ""}: no hay un monto suelto que recuperar`
      : carga ? `no cae, y cede ${_val(carga)} de carga comercial — pero esta lectura no trae el nivel contra el que se mide, así que no te puedo decir si eso es mucho o poco`
      : `no cae contra el período comparable${margen ? `, y su margen cierra en ${_val(margen)}` : ""}`;
    return { e, contrib, texto: `${e} aporta ${_val(contrib)} hoy, y ${precio}.`, urgencia: cae ? Math.abs(_ord(yoy)) : cede ? _ord(carga) - _ord(nivel) : 0, cae, cede };
  };
  const la = lado(A), lb = lado(B);
  return la && lb ? { la, lb } : null;
}
/* la decisión, con el MISMO orden de evaluación que siempre tuvo el composer */
function _eleccionDeCuentas(la, lb) {
  if (la.cae !== lb.cae && (la.cae || lb.cae)) {
    const cayendo = la.cae ? la : lb, otro = la.cae ? lb : la;
    return { regla: "se-esta-yendo", cayendo, otro, eleccion: [cayendo.e], descartada: [otro.e] };
  }
  if (la.cede && lb.cede) {
    const mayor = la.urgencia >= lb.urgencia ? la : lb, menor = la.urgencia >= lb.urgencia ? lb : la;
    return { regla: "cede-mas", mayor, eleccion: [mayor.e], descartada: [menor.e] };
  }
  return { regla: "empate", eleccion: null, descartada: null, opciones: [la.e, lb.e] };
}
function _ladosDeDominios(opciones, figs) {
  const lados = opciones.map((k) => {
    const d = _PRECIO_FRENTE[k];
    const f = _find(figs, d.re);
    return f ? { k, d, f, v: _ord(f) } : null;
  });
  return lados.some((x) => !x) ? null : lados;
}
/* las palabras con que cada frente puede aparecer en prosa — para DEFENDER la elección, nunca para mostrarla */
const _FORMAS_FRENTE = {
  margen: ["el margen", "las condiciones"],
  cobranza: ["la cobranza", "el cobro"],
  capital: ["el capital en inventario", "el capital frenado", "el inventario"],
};
function _eleccionDeDominios(x, y) {
  const mayor = x.v >= y.v ? x : y, menor = x.v >= y.v ? y : x;
  if (Number.isFinite(x.v) && Number.isFinite(y.v) && mayor.v >= menor.v * 2) {
    return { regla: "tamano", mayor, eleccion: _FORMAS_FRENTE[mayor.k], descartada: _FORMAS_FRENTE[menor.k] };
  }
  return { regla: "empate", mayor, eleccion: null, descartada: null, opciones: [..._FORMAS_FRENTE[x.k], ..._FORMAS_FRENTE[y.k]] };
}
/* crecer vs proteger no es empate y el porqué está escrito en el composer: crecer sobre una condición cara
 * multiplica la fuga. La elección es fija; lo variable es la cifra que la sostiene. */
const _ELECCION_ESTRATEGIAS = { regla: "condicion-primero", eleccion: ["proteger margen", "la condición"], descartada: ["el volumen", "vender más", "crecer"] };

/** LA CONCLUSIÓN del procedimiento para esta pregunta con esta boleta — o null si la ruta no aplica o el dato
 *  no alcanza. `eleccion`/`descartada` traen las formas con que ese camino se nombra en prosa; `eleccion:
 *  null` significa que EL DATO NO ELIGIÓ, y eso también es una conclusión que el narrador no puede pisar. */
export function conclusionDe(figs, pregunta) {
  const c = _caso(pregunta);
  if (!c) return null;
  if (c.tipo === "cuentas") {
    const d = _ladosDeCuentas(c.opciones, figs);
    return d ? { tipo: "cuentas", ..._eleccionDeCuentas(d.la, d.lb) } : null;
  }
  if (c.tipo === "dominios") {
    const lados = _ladosDeDominios(c.opciones, figs);
    return lados ? { tipo: "dominios", ..._eleccionDeDominios(lados[0], lados[1]) } : null;
  }
  return _find(figs, /^Carga comercial alta · subtotal$/i) ? { tipo: "estrategias", ..._ELECCION_ESTRATEGIAS } : null;
}

/* cómo se ve, en prosa, ELEGIR un camino o DARLO POR RESUELTO. Verbos de elección anclados al nombre; nada de
 * cazar la palabra suelta, que es como nacen los falsos positivos que apagan reglas. */
const _ELIGE = (n) => new RegExp(
  `(?:yo entrar[ií]a por|entrar[ií]a por|empezar[ií]a (?:por|con)|empieza (?:por|con)|partir[ií]a por|la prioridad es|priorizar[ií]a|me quedo con|atacar[ií]a)\\s+(?:la |el |las |los )?${_esc(n)}(?![\\wáéíóúñ])` +
  `|(?:^|[.:;\\n]\\s*)(?:la |el )?${_esc(n)}\\s+primero(?![\\wáéíóúñ])`, "i");
const _NIEGA = (n) => new RegExp(
  `${_esc(n)}[^.\\n]{0,60}?\\b(?:no (?:necesita|requiere|urge|corre prisa|amerita)|no es (?:la |lo )?(?:prioridad|urgente|urgencia)|puede esperar)`, "i");

export const compararAlternativas = {
  nombre: "comparar-alternativas",

  /* sin nombres de cuenta: son dato del pack y se publicarían en el bundle. El caso de dos cuentas lo prueba
   * su gate armando los nombres desde el tenant cargado. */
  ejemplos: [
    "¿qué es más urgente, margen o cobranza?",
    "¿vendo más o protejo margen?",
    "¿ataco el margen o el capital frenado?",
  ],

  cuandoAplica(pregunta) { return _caso(pregunta) !== null; },

  pasos(pregunta) { const c = _caso(pregunta); return c ? _pasosDe(c) : []; },

  /* la promesa es EL PRECIO: sin poder ponerle cifra a los dos caminos, la respuesta sería una opinión sobre
   * cuál conviene — que es exactamente lo que el owner no quiere. El playbook se retira. */
  obligatorias(pregunta) {
    const c = _caso(pregunta);
    if (!c) return [];
    if (c.tipo === "cuentas") return [/· Contribución$/i];
    if (c.tipo === "dominios") return [_PRECIO_FRENTE[c.opciones[0]].re, _PRECIO_FRENTE[c.opciones[1]].re];
    return [/^Carga comercial alta · subtotal$/i];
  },

  entregable: "COMPARA LOS DOS CAMINOS, sin esconder ninguno: (1) nómbralos, para que el dueño vea si entendiste cuáles son; (2) PONLE PRECIO A CADA UNO, con su cifra y SU REFERENCIA —un monto solo no permite elegir—; (3) ELIGE o MARCA EL TRADEOFF: si un precio es de otro tamaño, elige y di por qué; si los dos miden cosas distintas o salen de universos distintos, dilo y no finjas una comparación; (4) cierra pidiendo la pieza que él tiene. ⚠️ RESPONDER UNA SOLA ALTERNATIVA ES LA FALLA: él no pidió ver A, pidió saber cuál. Y esconder la otra es peor que no contestar, porque parece una recomendación. ⚠️ Si los dos montos vienen de universos distintos, di de cuál sale cada uno.",

  componer({ figs, pregunta, semilla } = {}) {
    const c = _caso(pregunta);
    if (!c) return null;
    const p = [];

    /* ── (a) DOS CUENTAS · cada camino vale lo que esa cuenta recupera ───────────────────────────────────────
     * la lectura de cada lado y LA ELECCIÓN salen de las mismas funciones que alimentan a `conclusionDe`: el
     * notario de abajo defiende exactamente lo que acá se escribe, no una copia (ley del 2026-09-10). */
    if (c.tipo === "cuentas") {
      const d = _ladosDeCuentas(c.opciones, figs);
      if (!d) return null;
      const { la, lb } = d;
      p.push(`Los dos caminos, con precio.`);
      p.push(`· ${la.texto}`);
      p.push(`· ${lb.texto}`);
      /* ELEGIR o MARCAR EL TRADEOFF — y la diferencia la decide el dato, no una plantilla */
      const con = _eleccionDeCuentas(la, lb);
      if (con.regla === "se-esta-yendo") {
        const { cayendo, otro } = con;
        p.push(`No son la misma decisión: ${cayendo.e} se está yendo y ${otro.e} está entregando margen. Lo que se va no vuelve solo; lo que se entrega lo entregas tú cada vez que renuevas la condición.`);
        p.push(`Yo entraría por ${cayendo.e}: una cuenta que cae tiene una ventana, una condición cara sigue ahí la semana que viene.`);
      } else if (con.regla === "cede-mas") {
        p.push(`Los dos son el mismo tipo de decisión —condición cara— así que se ordenan por tamaño: ${con.mayor.e} primero.`);
      } else {
        p.push(`Con estas cifras los dos caminos pesan parecido, así que la elección no la decide el dato: la decide qué relación quieres sostener.`);
      }
      p.push(variante(semilla, [
        `Lo que el dato no tiene y decides tú: con cuál tienes conversación abierta. Dímelo y aterrizo el movimiento.`,
        `Falta tu lado: dónde tienes hoy la puerta abierta para hablar. Con eso cierro la recomendación.`,
        `Dime con cuál puedes sentarte esta semana y lo aterrizo.`,
      ]));
      return p.join("\n");
    }

    /* ── (b) DOS FRENTES DEL NEGOCIO · margen · cobranza · capital ─────────────────────────────────────────── */
    if (c.tipo === "dominios") {
      const lados = _ladosDeDominios(c.opciones, figs);
      if (!lados) return null;
      const [x, y] = lados;
      p.push(`Los dos frentes, con precio.`);
      p.push(`· ${x.d.nombre[0].toUpperCase()}${x.d.nombre.slice(1)}: ${_val(x.f)} — ${x.d.que}.`);
      p.push(`· ${y.d.nombre[0].toUpperCase()}${y.d.nombre.slice(1)}: ${_val(y.f)} — ${y.d.que}.`);
      /* ⚠️ DOS MONTOS DE UNIVERSOS DISTINTOS NO VAN JUNTOS SIN DECLARARLO (CLAUDE.md §2) */
      const cruzaUniverso = c.opciones.includes("capital") && c.opciones.some((k) => k !== "capital");
      if (cruzaUniverso) {
        p.push(`⚠️ Y no son el mismo dinero: uno sale de tu venta comercial y el otro del inventario en bodega, que en este dato son dos mundos que no cierran entre sí. Se pueden ordenar por urgencia, no sumar.`);
      }
      const con = _eleccionDeDominios(x, y);
      if (con.regla === "tamano") {
        p.push(`Por tamaño no hay empate: ${con.mayor.d.nombre} pesa varias veces lo otro, así que ahí es donde una hora tuya rinde más.`);
      } else {
        p.push(`Los dos pesan parecido, así que el tamaño no elige: elige el que puedas mover más rápido, y eso lo sabes tú mejor que el dato.`);
      }
      p.push(variante(semilla, [
        `¿Te abro el que elijas por dentro, para ver dónde se concentra?`,
        `Dime cuál abrimos y vemos quién lo concentra.`,
        `Si quieres entro por uno y te muestro dónde está el grueso.`,
      ]));
      return p.join("\n");
    }

    /* ── (c) CRECER vs PROTEGER · la disyuntiva de estrategia ──────────────────────────────────────────────── */
    const crecio = _find(figs, /^headline$/i);
    const cargaAlta = _find(figs, /^Carga comercial alta · subtotal$/i);
    const nivel = _find(figs, reDeReferencia("pctRebate"));
    const excedenNivel = _find(figs, /exceden el .*carga|erosión por acciones comerciales/i);
    if (!cargaAlta) return null;
    p.push(`Los dos caminos, con precio.`);
    p.push(`· Vender más: la venta ${crecio ? `ya viene ${_val(crecio)} contra el período comparable` : "viene creciendo"}, así que el camino está abierto — pero cada peso nuevo entra a la condición que tengas puesta hoy.`);
    p.push(`· Proteger margen: hay ${_val(cargaAlta)} cediéndose en acciones comerciales por sobre ${nivel ? `el nivel de ${_val(nivel)} que tienes declarado` : "el nivel que tienes declarado"}${excedenNivel ? `, repartidos en ${_val(excedenNivel)} cuentas` : ""}. Eso se recupera sin vender un peso más.`);
    p.push(`No es un empate y por eso elijo: crecer sobre una condición cara multiplica la fuga, porque la venta nueva entra al mismo margen delgado. Primero la condición, después el volumen — en ese orden el crecimiento sí llega abajo.`);
    p.push(variante(semilla, [
      `Lo que decides tú: si hay un compromiso de crecimiento que no se puede mover este año. Dímelo y lo peso.`,
      `Falta tu lado: si el volumen tiene un plazo comprometido. Con eso ajusto el orden.`,
      `Dime si el crecimiento tiene fecha comprometida y reordeno.`,
    ]));
    return p.join("\n");
  },

  listaNotarial(texto, { figs, pregunta } = {}) {
    const t = String(texto || "");
    const c = _caso(pregunta);
    if (!c || !t.trim()) return [];
    const v = [];
    const citadas = (Array.isArray(figs) ? figs : []).filter((f) => _val(f) && /\d/.test(_val(f)) && t.includes(_val(f)));

    /* ⚠️ (1) LA ALTERNATIVA ESCONDIDA · la falla que el owner nombró: «no responder solo una alternativa ni
     * esconder la otra». Solo se cobra si el texto YA está respondiendo con cifras — declinar no se multa. */
    if (citadas.length) {
      const nombres = c.tipo === "cuentas" ? c.opciones
        : c.tipo === "dominios" ? c.opciones.map((k) => _PRECIO_FRENTE[k].nombre.replace(/^el |^la /, ""))
        : ["vender", "margen"];
      const faltan = nombres.filter((n) => !new RegExp(_esc(n).replace(/\s+/g, "\\s+"), "i").test(t));
      if (faltan.length) {
        v.push({ regla: "alternativa-escondida", multa: `respondes por un solo camino: falta ${faltan.join(" y ")}. El usuario no pidió ver una alternativa, pidió saber CUÁL — y mostrar una sola parece una recomendación sin serlo. Nombra los dos y ponle precio a cada uno.` });
      }
    }
    /* (2) SIN PRECIO no hay comparación: dos nombres sin cifra son una opinión con formato de análisis */
    if (citadas.length === 1) {
      v.push({ regla: "comparacion-sin-precio", multa: "comparas dos caminos con una sola cifra. Cada uno necesita la suya: con un solo número se sostiene cualquiera de las dos conclusiones, y el dueño no puede verificar la elección." });
    }
    /* (3) NI ELIGE NI MARCA EL TRADEOFF — el owner pidió una de las dos, no un resumen que deja la pelota */
    if (citadas.length >= 2 && !/yo entrar[ií]a|primero\b|no son la misma|no son el mismo|pesan parecido|no hay empate|por eso elijo|se ordenan por|no elige/i.test(t)) {
      v.push({ regla: "comparacion-sin-cierre", multa: "pusiste los dos caminos y no dijiste nada. El owner pidió elegir o marcar el tradeoff: si un precio es de otro tamaño, elige y di por qué; si miden cosas distintas, dilo. Dejar los dos montos y callarse es devolverle la pregunta." });
    }
    /* ⚠️ (4) LA CONCLUSIÓN ES DEL PROCEDIMIENTO, NO DEL NARRADOR (ley del owner, 2026-09-10). El narrador
     * puede explicar la elección con otras palabras, más corta o para otro lector; no puede elegir el otro
     * camino, dar por resuelto el elegido, ni inventar una elección donde el dato no eligió. La derivación es
     * LA MISMA que escribe el composer (`conclusionDe`): no hay dos criterios que puedan discrepar. Solo se
     * cobra sobre un texto que ya responde con cifras — declinar no se multa, como en (1). */
    if (citadas.length) {
      const con = conclusionDe(figs, pregunta);
      if (con && con.eleccion) {
        const negada = con.eleccion.find((n) => _NIEGA(n).test(t));
        if (negada) {
          v.push({ regla: "conclusion-cambiada", multa: `das por resuelto o sin urgencia «${negada}», y es justamente el camino que el procedimiento eligió con las cifras de esta boleta. La conclusión es del procedimiento, no del narrador: explícala como quieras, pero la elección no se invierte. Vuelve a la elección medida y su porqué.` });
        }
        const otra = !negada && (con.descartada || []).find((n) => _ELIGE(n).test(t));
        if (otra) {
          v.push({ regla: "conclusion-cambiada", multa: `pones primero «${otra}», y el procedimiento eligió el otro camino con las cifras de esta boleta. La conclusión es del procedimiento, no del narrador: puedes decirla más corta o para otro lector, no darla vuelta.` });
        }
      } else if (con && con.opciones) {
        const inventada = con.opciones.find((n) => _ELIGE(n).test(t));
        if (inventada) {
          v.push({ regla: "conclusion-cambiada", multa: `eliges «${inventada}» y el dato no eligió: con estas cifras los caminos pesan parecido, y ESA es la conclusión del procedimiento. Decir que la elección es del dueño no es quedarse corto — inventarle una elección al dato sí es pasarse.` });
        }
      }
    }
    return v;
  },
};
