/* === src/adi/agente/playbooks/desafiarDecision.js · PLAYBOOK · EL TRADEOFF, CON CIFRA ========================
 *
 * EL ENCARGO, palabra del owner (2026-09-09), segundo de su orden de prioridad: «Sigue con desafiar
 * decisiones, manteniendo la misma regla: tradeoff con dato, no sermón ni complacencia.»
 *
 * LAS DOS FORMAS DE FALLAR ACÁ, y las nombró él:
 *   · COMPLACENCIA — «sí, buena decisión», «vas bien». Es la falla de la ruta de hipótesis otra vez, con otra
 *     cara: un juicio sin cifra que el dueño se lleva como respaldo.
 *   · SERMÓN — «deberías cuidar tu margen», «hay que ser selectivo con los descuentos». Suena a asesor y no
 *     dice nada: vale para cualquier negocio, así que no vale para el suyo.
 * Las dos se cierran con la misma exigencia: un juicio sobre una decisión viaja con LOS DOS LADOS medidos.
 *
 * ⚠️ «NO SERMÓN» NO ES «NO OPINAR». El owner quiere criterio —lo dijo cuando pidió el método del porqué: el
 * mecanismo medido primero, la lectura del asesor marcada después, y una pregunta concreta al final—. Lo que
 * no quiere es criterio SIN cifra. Así que acá ADI toma posición, y la toma sobre los dos montos.
 *
 * EL ARCO:
 *   1 · QUÉ SE ESTÁ PESANDO, en una línea, para que el dueño vea si ADI lo entendió.
 *   2 · LO QUE PONE EN JUEGO, con su cifra — el lado que la decisión sacrifica.
 *   3 · LO QUE HAY DEL OTRO LADO, con su cifra — lo que la decisión recupera. Si los dos montos son de
 *       tamaños distintos, eso SE DICE: es el punto entero del tradeoff.
 *   4 · LA PIEZA QUE TIENE ÉL Y EL DATO NO — preguntada concreta, no genérica.
 *
 * ES LA RUTA HERMANA DE `hipotesisDelUsuario`: allá el usuario afirma un HECHO y ADI lo verifica; acá pesa un
 * CURSO DE ACCIÓN y ADI le pone precio a los dos lados. Por eso comparte disciplina —repetir lo que se
 * contrasta, cifras verbatim de la boleta, el límite declarado— y cambia el arco.
 *
 * PURO · determinístico · sin red. Cifras VERBATIM de la boleta. */

import { formaConversacional } from "../formaConversacional.js";
import { entidadNombrada } from "./indiceEntidades.js";
import { variante } from "../variacion.js";

const _val = (f) => String((f && (f.text || f.value)) || "");
const _lab = (f) => String((f && f.label) || "");
const _num = (f) => (f && Number.isFinite(f.raw) ? f.raw : NaN);
const _find = (figs, re) => (Array.isArray(figs) ? figs : []).find((f) => re.test(_lab(f))) || null;
const _esc = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/* el número para comparar cuando la cifra no trae `raw` — la misma trampa que documenta `hipotesisDelUsuario`:
 * hay familias enteras publicadas sin `raw`, y la escala («$574K» vs «$2.3M») decide el orden. Se usa para
 * COMPARAR, jamás para mostrar: lo que se escribe sale verbatim de la boleta. */
const _ESCALA = { k: 1e3, m: 1e6, b: 1e9 };
const _ord = (f) => {
  const r = _num(f);
  if (Number.isFinite(r)) return r;
  const s = _val(f);
  const m = /(\d+(?:\.\d+)?)\s*([KkMmBb])?(?![A-Za-zÁÉÍÓÚÜáéíóúüÑñ])/.exec(s);
  if (!m) return NaN;
  return (/^[^\d]*-/.test(s) ? -1 : 1) * Number(m[1]) * (m[2] ? _ESCALA[m[2].toLowerCase()] : 1);
};

/* ── QUÉ DECISIÓN SE ESTÁ PESANDO ─────────────────────────────────────────────────────────────────────────
 * Tres decisiones, que son las que el dato de este producto puede pesar de verdad. Una cuarta —«¿contrato dos
 * vendedores?»— tiene forma de decisión y NO tiene dato: ahí el playbook se retira, que es la regla de la casa
 * (ante la duda, false) y evita el sermón, porque un sermón es justamente lo que sale cuando no hay cifra. */
const _SOLTAR = /\bdejar de\b|\bcortar\b|\bsacar(?:la|lo|los|las)?\b|\bsalir de\b|\bno (?:seguir )?vender(?:le)?\b|\bdejar(?:la|lo)\b|\bbajarme de\b/i;
const _CEDER = /\bm[aá]s descuento\b|\bbajar(?:le)? (?:el )?precio\b|\bmejorar(?:le)? (?:las )?condiciones\b|\bdarle m[aá]s\b|\bceder(?:le)? m[aá]s\b|\bsubir(?:le)? (?:el )?rebate\b/i;
const _VOLUMEN = /\bvolumen\b|\bcrecer\b|\bvender m[aá]s\b|\bpriorizar (?:la )?venta\b|\bcrecimiento\b|\bfacturar m[aá]s\b/i;
const _PRECIO = /\bprecio[s]?\b|\bdescuento[s]?\b|\brebate[s]?\b|\bacciones comerciales\b|\blista\b/i;

/** el caso: `{ tipo, sentido, entidad }` o null si la decisión no se puede pesar con el dato que hay. */
function _caso(pregunta) {
  const q = String(pregunta || "");
  if (formaConversacional(q) !== "decision") return null;
  const ent = (() => { try { return entidadNombrada(q); } catch { return null; } })();
  /* con una cuenta nombrada, la decisión es SOBRE esa cuenta — y ahí el tradeoff es el más nítido que da el
   * dato: lo que esa cuenta aporta contra lo que su condición se lleva. */
  if (ent && ent.eje === "cliente") {
    const sentido = _SOLTAR.test(q) ? "soltar" : _CEDER.test(q) ? "ceder" : "sostener";
    return { tipo: "cuenta", sentido, entidad: ent.nombre };
  }
  if (_VOLUMEN.test(q)) return { tipo: "volumen", sentido: "sostener", entidad: null };
  if (_PRECIO.test(q)) return { tipo: "precio", sentido: _CEDER.test(q) ? "ceder" : "sostener", entidad: null };
  /* ⚠️ «¿ESTOY TOMANDO UNA MALA DECISIÓN?» — pregunta de decisión que no nombra ninguna. Retirarse la mandaba
   * a la línea genérica («cuéntame qué dato específico necesitas»), que le pide un DATO a quien está pidiendo
   * un JUICIO: exactamente el desvío que el censo encontró. No es falta de dato, es falta de objeto — así que
   * la respuesta correcta no es declinar, es preguntar cuál, y preguntarlo apoyado en lo que su cartera
   * muestra hoy. La regla del owner: la pregunta al dueño se hace concreta, nunca genérica. */
  return { tipo: "sin-anclar", sentido: "sostener", entidad: null };
}

const _PASOS = {
  cuenta: (c) => [{ tool: "entityProfile", args: { entity: c.entidad, dimension: "cliente" },
    para: "la cuenta entera: su venta y su contribución —lo que la decisión pone en juego— junto a su margen, su carga comercial y el exceso sobre el nivel declarado, que es lo que la decisión recupera" }],
  volumen: () => [
    { tool: "marginRead", args: { focus: "bajo_benchmark", dimension: "cliente" },
      para: "cuánta cartera cierra bajo el benchmark declarado y cuánto vale cerrar esa brecha: el precio que el volumen está cobrando hoy" },
    { tool: "rolesCartera", args: {},
      para: "dónde está concentrado ese margen delgado — si viene de las acciones comerciales o del precio, que son dos decisiones distintas" }],
  precio: () => [
    { tool: "marginRead", args: { focus: "causa_costo", dimension: "cliente" },
      para: "cuánto vale un punto de margen en la cartera, que es la unidad en la que se mide mover precios" },
    { tool: "rolesCartera", args: {},
      para: "la carga comercial de cada cuenta contra el nivel declarado: dónde ya se está cediendo" }],
  "sin-anclar": () => [
    { tool: "rolesCartera", args: {},
      para: "el estado de la cartera hoy, para que la pregunta de vuelta al dueño sea concreta y no un «¿cuál decisión?» al aire" }],
};

export const desafiarDecision = {
  nombre: "desafiar-decision",

  /* ⚠️ SIN NOMBRES DE CUENTA (lo cazó `_bundle_sin_datos_gate` en la ruta anterior): son dato del pack de
   * demostración y se publicarían en el bundle. El caso de una cuenta lo prueba su gate armando el nombre
   * desde el tenant cargado — que además es lo que lo hace válido para la planilla del usuario. */
  ejemplos: [
    "¿hago bien en priorizar volumen?",
    "¿me conviene bajar precios?",
    "¿debería seguir dando estos descuentos?",
    "¿es una buena idea crecer en volumen este año?",
  ],

  cuandoAplica(pregunta) { return _caso(pregunta) !== null; },

  pasos(pregunta) {
    const c = _caso(pregunta);
    return c ? _PASOS[c.tipo](c) : [];
  },

  /* la promesa por tipo — sin ella el playbook no se activa nunca (`promesasCumplidas`, registro.js). Cada
   * una es la cifra SIN LA CUAL el tradeoff no se puede armar: si el dato no la trae, el procedimiento se
   * retira en silencio en vez de opinar sobre una decisión que no puede pesar. */
  obligatorias(pregunta) {
    const c = _caso(pregunta);
    if (!c) return [];
    if (c.tipo === "cuenta") return [/· Contribución$/i];
    if (c.tipo === "volumen") return [/^Medida · cerrar brecha al piso$/i];
    if (c.tipo === "sin-anclar") return [/^Benchmark de margen$/i];
    return [/· Medida 1pp$/i];
  },

  entregable: "PESA LA DECISIÓN con los dos lados medidos, en este orden: (1) di en una línea qué se está pesando, para que él vea si lo entendiste; (2) LO QUE PONE EN JUEGO, con su cifra — lo que la decisión sacrifica; (3) LO QUE HAY DEL OTRO LADO, con su cifra — lo que recupera; si los dos montos son de tamaños distintos, dilo, porque ES el punto; (4) la pieza que él tiene y el dato no, preguntada concreta. ⚠️ NUNCA apruebes ni desapruebes sin las dos cifras: «buena decisión» es complacencia y «deberías cuidar tu margen» es un sermón que vale para cualquier negocio, así que no vale para el suyo. Toma posición —el dueño la pide— pero tómala SOBRE los dos montos. Si el dato no alcanza para pesarla, eso se dice y no se adivina.",

  componer({ figs, pregunta, semilla } = {}) {
    const c = _caso(pregunta);
    if (!c) return null;
    const p = [];

    /* ── (a) LA DECISIÓN SOBRE UNA CUENTA · el tradeoff más nítido que da el dato ──────────────────────────── */
    if (c.tipo === "cuenta") {
      const g = (re) => _find(figs, new RegExp(`^${_esc(c.entidad)} · ${re}$`, "i"));
      const venta = g("Ventas?"), contrib = g("Contribución"), margen = g("Margen");
      const exceso = g("exceso de acciones comerciales"), acciones = g("Acciones comerciales");
      const bench = _find(figs, /^Benchmark de margen$/i);
      const ranking = g("ranking por venta");
      if (!venta || !contrib) return null;        // sin lo que pone en juego no hay tradeoff que mostrar

      p.push(`Estás pesando ${c.sentido === "soltar" ? `si soltar a ${c.entidad}` : c.sentido === "ceder" ? `si cederle más a ${c.entidad}` : `si seguir con ${c.entidad}` }. Te pongo los dos lados con cifra.`);
      p.push(`Lo que pones en juego: ${_val(venta)} de venta y ${_val(contrib)} de contribución${ranking ? ` — va ${_val(ranking)} de tu cartera por venta` : ""}.`);

      /* EL OTRO LADO. El dato distingue tres situaciones distintas, y cada una cambia la decisión: */
      const sobreBenchmark = margen && bench && Number.isFinite(_ord(margen)) && Number.isFinite(_ord(bench)) && _ord(margen) >= _ord(bench);
      if (sobreBenchmark) {
        /* la cuenta está SANA: acá ADI desafía la decisión de frente, que es lo que el owner pidió */
        p.push(`Del otro lado no hay casi nada que recuperar: su margen cierra en ${_val(margen)}, sobre el benchmark declarado de ${_val(bench)}. Esta cuenta no es tu problema de margen.`);
        p.push(`Con esas dos cifras al lado, el dato no sostiene la decisión${c.sentido === "soltar" ? ": soltarla te cuesta contribución y no te devuelve margen" : ""}.`);
      } else if (exceso && Number.isFinite(_ord(exceso)) && _ord(exceso) > 0) {
        /* el margen delgado viene de la CONDICIÓN, no de la cuenta: es negociable, y eso cambia la decisión */
        p.push(`Del otro lado: sus acciones comerciales van ${acciones ? _val(acciones) : "por sobre el nivel declarado"}, y ${_val(exceso)} de eso es exceso sobre el nivel de carga que tienes declarado${margen && bench ? `; su margen cierra en ${_val(margen)} contra un benchmark de ${_val(bench)}` : ""}.`);
        const desproporcion = Number.isFinite(_ord(contrib)) && _ord(exceso) * 3 < _ord(contrib);
        p.push(`Y ahí está el punto: lo que entregas${desproporcion ? " es de otro tamaño que" : " no es lo mismo que"} lo que recuperas. Lo que tiene delgado el margen es la CONDICIÓN, no la cuenta — y una condición se renegocia sin perder la venta.`);
      } else {
        p.push(`Del otro lado: su margen cierra en ${margen ? _val(margen) : "por debajo"}${bench ? ` contra un benchmark declarado de ${_val(bench)}` : ""}, y sus acciones comerciales están dentro del nivel que tienes declarado.`);
        p.push(`O sea el margen delgado no viene de lo que le cedes: viene del precio de lista o del mix de lo que te compra, y esta lectura no los separa.`);
      }
      /* ⚠️ CEDER ES OTRA DECISIÓN QUE SOLTAR, y merece su propia cifra: lo que se cede sale de una
       * contribución concreta, y el margen que queda antes del nivel declarado se puede nombrar sin
       * calcularlo —los dos porcentajes se ponen uno al lado del otro y el dueño ve el espacio—. */
      const carga = g("Carga comercial");
      /* ⚠️ el nivel declarado SOLO se publica cuando la cuenta lo excede (medido: aparece en la cuenta con
       * exceso y no en la que está debajo). Por eso se cita si está y se calla si no — nunca se supone. */
      const nivel = _find(figs, /^(?:Meta|Target|Nivel) de carga comercial$/i);
      if (c.sentido === "ceder" && carga) {
        p.push(`Y como lo que pesas es cederle MÁS: eso sale de esos ${_val(contrib)} de contribución. Su carga comercial hoy va ${_val(carga)}${nivel ? ` contra un nivel declarado de ${_val(nivel)}` : ""} — el espacio lo ves ahí; la pregunta es contra qué lo cedes.`);
      }
      p.push(variante(semilla, [
        `Lo que el dato no tiene y decides tú: qué te da esa cuenta además del margen. Dime eso y cierro la recomendación.`,
        `La pieza que falta es tuya: si esa condición compró algo —volumen, posición, plazo—. Dímelo y cierro la lectura.`,
        `Falta tu lado: si esas condiciones se negociaron a cambio de algo. Con eso cierro la recomendación.`,
      ]));
      return p.join("\n");
    }

    /* ── (b) PRIORIZAR VOLUMEN · el precio que el volumen está cobrando hoy ────────────────────────────────── */
    if (c.tipo === "volumen") {
      const cerrar = _find(figs, /^Medida · cerrar brecha al piso$/i);
      const conteo = _find(figs, /clientes bajo el benchmark/i);
      const bench = _find(figs, /^Benchmark de margen$/i);
      const brecha = _find(figs, /^El negocio · Brecha al benchmark$/i);
      const erosion = _find(figs, /erosión por acciones comerciales/i);
      if (!cerrar) return null;
      p.push(`Estás pesando si priorizar volumen. Te pongo los dos lados con cifra.`);
      p.push(`Lo que el volumen te cobra hoy: ${conteo ? `${_val(conteo)} clientes` : "buena parte de la cartera"} cierran bajo el benchmark declarado${bench ? ` de ${_val(bench)}` : ""}${brecha ? `, y el negocio cierra ${_val(brecha)} por debajo` : ""}. Cerrar esa brecha vale ${_val(cerrar)}.`);
      if (erosion) p.push(`Y de esos, ${_val(erosion)} ceden margen por acciones comerciales — o sea buena parte de lo que el volumen cuesta no es precio de lista, es condición negociada.`);
      p.push(`Mi lectura, y es lectura: con esa concentración, crecer en volumen sin tocar las condiciones te sale caro dos veces — el margen delgado se te multiplica por la venta nueva.`);
      p.push(variante(semilla, [
        `Lo que el dato no dice y sabes tú: si ese volumen compra posición o si se está comprando solo. Dímelo y cierro la lectura.`,
        `Falta tu lado: qué te da el volumen además de la venta. Con eso cierro la recomendación.`,
        `La pieza tuya: si el crecimiento tiene un destino —una categoría, un canal— o es parejo. Dímelo y lo aterrizo.`,
      ]));
      return p.join("\n");
    }

    /* ── (b bis) LA DECISIÓN SIN NOMBRAR · se pregunta cuál, con la cartera de hoy al lado ─────────────────── */
    if (c.tipo === "sin-anclar") {
      const erosion = _find(figs, /erosión por acciones comerciales/i);
      const sanos = _find(figs, /sobre el benchmark/i);
      const bench = _find(figs, /^Benchmark de margen$/i);
      if (!bench) return null;
      p.push(`Estás pesando una decisión, pero no me dijiste cuál — y sin saberlo te daría una opinión que sirve para cualquier negocio.`);
      p.push(`Con tu dato puedo pesar tres: seguir o soltar una cuenta · priorizar volumen · mover precios o descuentos. En las tres te pongo lo que pones en juego y lo que recuperas, cada uno con su cifra.`);
      if (erosion) p.push(`Y si sirve de pista: hoy ${_val(erosion)} de tus clientes ceden margen por acciones comerciales${sanos ? ` y ${_val(sanos)} cierran sobre el benchmark declarado de ${_val(bench)}` : ` contra un benchmark declarado de ${_val(bench)}`}. Ahí es donde una decisión tuya movería más.`);
      p.push(variante(semilla, [
        `Dime cuál de las tres es y la peso.`,
        `Nómbrame la decisión y te pongo los dos lados.`,
        `Dime sobre qué estás decidiendo y arranco por ahí.`,
      ]));
      return p.join("\n");
    }

    /* ── (c) MOVER PRECIOS O DESCUENTOS · la unidad en la que se mide la decisión ──────────────────────────── */
    const unpunto = _find(figs, /· Medida 1pp$/i);
    if (!unpunto) return null;
    const cuenta = _lab(unpunto).split("·")[0].trim();
    const bench = _find(figs, /^Benchmark de margen$/i);
    const conteo = _find(figs, /clientes bajo el benchmark/i);
    p.push(`Estás pesando ${c.sentido === "ceder" ? "ceder más en precio o descuentos" : "mover precios o descuentos"}. Te pongo la unidad de la decisión.`);
    p.push(`Un punto de margen en ${cuenta} vale ${_val(unpunto)}. Esa es la medida: cada punto que cedes o recuperas ahí pesa eso.`);
    if (conteo && bench) p.push(`Y el contexto: ${_val(conteo)} clientes ya cierran bajo el benchmark declarado de ${_val(bench)}, así que el margen que ibas a ceder ya está cedido en buena parte de la cartera.`);
    p.push(`Mi lectura, y es lectura: mover el precio parejo cobra donde ya estás delgado. Si hay que ceder, el dato dice dónde puedes y dónde no.`);
    p.push(variante(semilla, [
      `Lo que decides tú: contra qué estás cediendo — volumen, plazo, exclusividad. Dímelo y lo peso.`,
      `Falta tu lado: si el movimiento es defensivo o para ganar cuentas. Con eso cierro la recomendación.`,
      `La pieza tuya: en qué cuentas te lo están pidiendo. Dímelo y miro esas.`,
    ]));
    return p.join("\n");
  },

  listaNotarial(texto, { figs, pregunta } = {}) {
    const t = String(texto || "");
    const c = _caso(pregunta);
    if (!c || !t.trim()) return [];
    const v = [];
    const citadas = (Array.isArray(figs) ? figs : []).filter((f) => _val(f) && /\d/.test(_val(f)) && t.includes(_val(f)));
    const nCitadas = new Set(citadas.map(_val)).size;

    /* ⚠️ (1) COMPLACENCIA · el owner la nombró primero. «Sí, buena decisión» es la misma falla que confirmar
     * una hipótesis sin leer: un juicio que el dueño se lleva como respaldo y que no verificó nadie. */
    const APRUEBA = /\b(?:buena|mala) (?:decisi[oó]n|idea)\b|\bvas bien\b|\bme parece (?:bien|correcto|acertado)\b|\best[aá]s? (?:haciendo )?bien\b|\bhaces bien\b|\bs[ií](?![\wáéíóúñ])[,:]\s*(?:conviene|deber[ií]as|sigue)|\b(?:s[ií]|no)(?![\wáéíóúñ]),? (?:te )?conviene\b|\bno lo hagas\b|\byo (?:la|lo) (?:dejar[ií]a|soltar[ií]a|mantendr[ií]a)\b/i;
    /* ⚠️ (2) SERMÓN · lo que suena a asesor y vale para cualquier negocio, así que no vale para el suyo. */
    const SERMON = /\bdeber[ií]as\b|\bte recomiendo\b|\blo ideal (?:ser[ií]a|es)\b|\bes importante que\b|\bhay que\b|\bconviene que\b|\blo mejor (?:ser[ií]a|es)\b|\bte sugiero\b/i;

    if ((APRUEBA.test(t) || SERMON.test(t)) && nCitadas === 0) {
      v.push({ regla: "juicio-sin-cifra", multa: "juzgas la decisión del dueño sin una sola cifra del turno. Sin números eso es complacencia («buena decisión») o sermón («deberías cuidar tu margen»): vale para cualquier negocio, así que no vale para el suyo. Trae lo que la decisión pone en juego y lo que recupera, cada uno con su cifra." });
    } else if ((APRUEBA.test(t) || SERMON.test(t)) && nCitadas < 2) {
      /* UN SOLO LADO NO ES UN TRADEOFF: con una cifra se puede sostener cualquier cosa. */
      v.push({ regla: "decision-de-un-solo-lado", multa: "tomas posición sobre la decisión mostrando un solo lado. Una decisión tiene dos: lo que sacrifica y lo que recupera, cada uno con su cifra del turno. Con un solo número se sostiene cualquier conclusión." });
    }

    /* (3) SE DICE QUÉ SE ESTÁ PESANDO — y solo se exige si el texto está RESPONDIENDO: vetar la línea honesta
     * dejaría el turno vacío, y declinar cuenta como éxito (la lección de la ruta de hipótesis). */
    if (nCitadas > 0 && !/est[aá]s pesando|la decisi[oó]n que|lo que est[aá]s (?:pesando|evaluando|pensando)|los dos lados/i.test(t)) {
      v.push({ regla: "decision-no-repetida", multa: "no dices QUÉ decisión estás pesando. Ponla en una línea antes de los números: si la entendiste mal, el dueño tiene que poder verlo ahí y no después de leer una respuesta a otra pregunta." });
    }
    return v;
  },
};
