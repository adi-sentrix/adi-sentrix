/* === src/adi/oracle/serieIntent.js · LA PREGUNTA CON PERÍODO LLEGA A QUIEN PUEDE RESPONDERLA (owner 2026-08-30)
 *
 * EL CASO QUE CIERRA, medido: «cuánto me compró Falabella el último mes» devolvía el tablero entero del negocio
 * sin nombrar a Falabella. La cadena: el camino natural no tiene tools, el interceptor que su comentario decía
 * que existía NO existía, y sin respuesta verificable el turno caía al suplente que vuelca ~12 KPIs.
 *
 * QUÉ ES. El interceptor determinístico de las preguntas entidad × período — mismo patrón que `fichaIntent` y
 * que el bypass de criterio: puro, sin LLM, sin red. Corre ANTES del cerebro en `answerViaNatural`:
 *   · si la serie de esa entidad es DATO REAL RECONCILIADO (serieRealDe — período declarado en cada punto y el
 *     mes informado cerrando exacto con la cifra oficial), responde con las cifras de la serie;
 *   · si no lo es, DECLINA CORTO: nombra el límite y deja una puerta — nunca el tablero.
 * Es la prioridad 2 del owner, textual: «ADI puede responder "cuánto compró Falabella el último mes" SOLO si
 * esa serie viene de dato real reconciliado», y la 3 en su mitad de ruteo: «el suplente decline corto».
 *
 * POR QUÉ NO PASA POR EL MURO. guardC verifica prosa de un modelo contra fuentes autorizadas; acá no hay modelo:
 * cada cifra ES una lectura directa del dataset, con la misma legitimidad que `answerConversational` (el piso
 * sin pago) o `composeCriteria`. La garantía no es un juicio por turno sino un candado offline
 * (`_serie_intent_gate`) que compara la composición contra el dataset cifra por cifra — y se prueba con carnada.
 *
 * CONSERVADOR ANTE LA DUDA, como `puedeResponderSinPagar`: ante un «por qué», una comparación, una simulación,
 * dos entidades o un nombre que vive en dos ejes… devuelve null y el turno sigue por el camino de siempre.
 * Un interceptor que adivina es peor que ninguno.
 */
import { getTenantData } from "../../data/tenantStore.js";
import { serieRealDe } from "../sentrix/capability.js";
import { findCandidates, axisCollisions, AXES } from "./entityIndex.js";
import { makeAddress, buildSentrixActionFromAddress } from "../sentrix/address.js";
import { fmtMonto } from "../../config/moneda.js";
import { factorComercialDe } from "../../config/contract/figureType.js";
import { nombreDePeriodo } from "../../ingesta/historico.js";
import { ESCENARIO_INICIAL } from "../../config/scenarios.js";   // colapso del eje (C5): el default de conveniencia dejaba leer OTRA carpeta que la pantalla

/* ── SEÑALES ────────────────────────────────────────────────────────────────────────────────────────────────── */

const _limpiar = (s) => String(s || "").replace(/[¿?¡!.,;:()"'«»]/g, " ").replace(/\s+/g, " ").trim();

/* Lo que este interceptor NO toma, aunque nombre un mes: causalidad (el porqué no es una cifra), comparaciones
 * (dos entidades exigen el contrato de comparación), simulaciones (otro motor) y el P&L (flujo guiado propio,
 * que además ya reclamó el turno antes de llegar acá). */
/* ⚠️ SIN `\b` DESPUÉS DE UNA VOCAL ACENTUADA: el `\b` de JS es ASCII, así que «qué» no tiene frontera de
 * palabra después de la é y `\bpor\s*qu[eé]\b` NO matcheaba «por qué» — medido: una pregunta de causalidad
 * pasaba el filtro y recibía una cifra en vez de un porqué. */
const _NO_TOMAR = /por\s*qu[eé]|porqu[eé]|explica|raz[oó]n|causa|\bvs\b|versus|\bcontra\b|compar|simul|qu[eé]\s+pasa(?:r[ií]a)?\s+si|presupuesto|proyecci[oó]n|proyecta/i;

const _MESES_NOMBRE = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const _RX_MES = new RegExp(`\\b(${_MESES_NOMBRE.join("|")}|setiembre)\\b(?:\\s+(?:de\\s+|del\\s+)?(\\d{4}))?`, "i");
const _RX_ULTIMO = /(?:[uú]ltimo\s+mes|mes\s+pasado|este\s+mes|mes\s+actual)/i;
const _RX_PELICULA = /mes\s+a\s+mes|por\s+mes|cada\s+mes|mensual(?:es|mente)?|evoluci[oó]n|c[oó]mo\s+(?:viene|vino|ha\s+venido)/i;

/** la métrica que la pregunta nombra · sin señal explícita de otra cosa, una compra/venta pregunta por la venta */
function _metricaDe(q) {
  if (/margen/i.test(q)) return "margen";
  if (/contribuci[oó]n/i.test(q)) return "contribucion";
  if (/unidades|cu[aá]ntas\s+unidades/i.test(q)) return "unidades";
  if (/acciones\s+comerciales|rebates?|descuentos/i.test(q)) return "acciones";
  if (/compr[oó]|compra|vend[ií]|venta|factur[oó]|facturaci[oó]n/i.test(q)) return "venta";
  return null;
}

const _RUIDO = new Set(["de", "del", "la", "el", "los", "las", "con", "sobre", "en", "y", "a", "al", "mi", "mis",
  "me", "que", "qué", "un", "una", "mes", "meses", "ultimo", "último", "pasado", "este", "cliente", "cuenta"]);

/* la entidad de la pregunta, buscada en LOS CUATRO EJES del historial — n-gramas de más largo a más corto, la
 * misma técnica de fichaIntent. Dos entidades DISTINTAS en la frase ⇒ null (una comparación no se adivina).
 *
 * ⚠️ EL SUJETO NO SE SUSTITUYE EN SILENCIO (owner 2026-09-02, captura de PRODUCCIÓN): preguntó por «Mercado
 * Norte» y ADI declinó sobre «Mercado Libre» — cambió el cliente de la pregunta y siguió como si nada. La raíz:
 * este barrido aceptaba el candidato de un PEDAZO del nombre («Mercado», prefijo de «Mercado Libre», distancia
 * 6) cuando el nombre completo que el usuario escribió no existía. La regla del defecto: nombre pedido que no
 * existe pero comparte una palabra con uno que sí ⇒ sustitución callada — en distribución («Comercial X»,
 * «Depósito Y», «Sucursal Z») eso es la norma, no el borde.
 * LA CONDUCTA DE LA CASA, cableada: solo un match EXACTO del índice canónico resuelve; un casi-match (prefijo
 * o tipeo) SE OFRECE, jamás se asume. Y un match exacto rodeado de palabras de NOMBRE que el índice no conoce
 * («Falabella Express») tampoco resuelve: el usuario pidió algo más largo y se le dice, con la sugerencia. */
const _EJES_SERIE = ["cliente", "marca", "familia", "sku"];
/* lo que NO es parte de un nombre: interrogativos, los verbos y métricas de estas preguntas, y el léxico de
 * período que ya vive arriba. Si una palabra vecina no está acá ni en _RUIDO ni es un mes, es NOMBRE. */
const _NOMBRE_STOP = /^(?:cu[aá]nt[oa]s?|c[oó]mo|qui[eé]n(?:es)?|d[oó]nde|cu[aá]l(?:es)?|compr[oóaeé](?:n|s|mos|ron)?|vend[ií][oó]?|vend[eé](?:n|s|mos)?|venta[s]?|factur[oóa]|facturaci[oó]n|mu[eé]strame|muestra|dame|dime|decime|viene|vino|venido|evoluci[oó]n|mensual(?:es|mente)?|margen|contribuci[oó]n|unidades|acciones|comerciales|rebates?|descuentos?|hoy|ficha|serie|hist[oó]rico|historia|actual)$/i;
const _esPalabraDeNombre = (w) => {
  const lw = String(w).toLowerCase();
  return !_RUIDO.has(lw) && !_MESES_NOMBRE.includes(lw) && lw !== "setiembre" && !_NOMBRE_STOP.test(w);
};
/* el pedido COMPLETO del usuario: el n-grama del match extendido con sus vecinas de nombre contiguas */
const _extender = (palabras, i, n) => {
  let a = i, b = i + n;
  while (a > 0 && _esPalabraDeNombre(palabras[a - 1])) a--;
  while (b < palabras.length && _esPalabraDeNombre(palabras[b])) b++;
  return { frase: palabras.slice(a, b).join(" "), crecio: a < i || b > i + n };
};
function _entidadDe(q) {
  const palabras = _limpiar(q).split(" ").filter(Boolean);
  const halladas = new Map();   // nombre canónico → { eje, i, n } · SOLO matches exactos del índice
  let roce = null;              // el mejor casi-match (prefijo/tipeo) — material de sugerencia, jamás de respuesta
  for (let n = Math.min(4, palabras.length); n >= 1; n--) {
    for (let i = 0; i + n <= palabras.length; i++) {
      const frase = palabras.slice(i, i + n).join(" ");
      if (frase.length < 3) continue;
      if (palabras.slice(i, i + n).every((w) => _RUIDO.has(w.toLowerCase()))) continue;
      if (_MESES_NOMBRE.includes(frase.toLowerCase())) continue;   // «mayo» suelto es un mes antes que un nombre
      for (const eje of _EJES_SERIE) {
        const cand = findCandidates(eje, frase, { max: 2 });
        if (!cand.length) continue;
        if (cand[0].motivo === "exacto") {
          const ya = halladas.get(cand[0].nombre);
          /* se recuerda DÓNDE matcheó (i, n): el corte de período se busca en la pregunta SIN el nombre.
           * Entre dos matches exactos del mismo nombre gana el n-grama más largo — el completo, no su pedazo. */
          if (!ya || n > ya.n) halladas.set(cand[0].nombre, { eje, i, n });
        } else if (!roce || cand[0].distancia < roce.distancia || (cand[0].distancia === roce.distancia && n > roce.n)) {
          const sugerencias = cand.length > 1 && cand[0].distancia === cand[1].distancia
            ? cand.map((c) => c.nombre) : [cand[0].nombre];   // el empate se ofrece entero, no se desempata a dedo
          roce = { eje, i, n, distancia: cand[0].distancia, sugerencias };
        }
      }
    }
  }
  if (halladas.size > 1) return null;   // varias entidades reales: no se adivina
  if (halladas.size === 1) {
    const [nombre, info] = [...halladas.entries()][0];
    const ext = _extender(palabras, info.i, info.n);
    if (ext.crecio) return { noResuelve: { pedido: ext.frase, eje: info.eje, sugerencias: [nombre] } };
    return { nombre, eje: info.eje, distancia: 0, i: info.i, n: info.n, palabras };
  }
  if (roce) {
    const ext = _extender(palabras, roce.i, roce.n);
    return { noResuelve: { pedido: ext.frase, eje: roce.eje, sugerencias: [...new Set(roce.sugerencias)].slice(0, 2) } };
  }
  return null;
}

/* detectSerieIntent(q) → { entidad, eje, metrica, corte } | null · puro, sin tocar el dato.
 * corte = { tipo: "punto", mes, anio } (mes 1-12 · anio null = el más reciente) · { tipo: "ultimo" } · { tipo: "pelicula" } */
export function detectSerieIntent(pregunta) {
  const q = _limpiar(pregunta);
  if (!q || _NO_TOMAR.test(q)) return null;

  if (!_RX_PELICULA.test(q) && !_RX_ULTIMO.test(q) && !q.match(_RX_MES)) return null;   // sin corte, este módulo no existe

  const metrica = _metricaDe(q);
  if (!metrica) return null;                       // sin métrica nombrada, mejor el cerebro

  const ent = _entidadDe(q);
  if (!ent) return null;
  /* el nombre pedido NO resuelve contra el índice canónico: el puente declina NOMBRANDO lo que el usuario
   * pidió y ofreciendo el parecido — jamás lo asume. La pregunta ES de entidad×período (corte y métrica ya
   * verificados arriba), así que este intent la reclama para declinarla honesto, no la suelta al tablero. */
  if (ent.noResuelve) return { noResuelve: ent.noResuelve, metrica };

  /* HOMÓNIMO ENTRE EJES: el historial es una llave plana; un nombre que vive en dos ejes no tiene UNA serie. */
  try { const ejes = axisCollisions(ent.nombre); if (Array.isArray(ejes) && ejes.length > 1) return { ambiguo: { nombre: ent.nombre, ejes } }; } catch { /* índice mudo: sigue */ }

  /* ⚠️ EL PERÍODO SE BUSCA EN LA PREGUNTA SIN EL NOMBRE DE LA ENTIDAD, y la prioridad es película > último >
   * mes. Las dos cosas cierran el mismo borde: un cliente que se llama como un mes («Mayo Distribuciones»).
   * Sin la resta, «cuánto me compró Mayo Distribuciones en julio» leía el corte de «mayo» — el nombre— y
   * respondía otro mes; sin la prioridad, «el último mes» perdía contra el «mayo» del nombre. */
  const resto = ent.palabras.filter((_, idx) => idx < ent.i || idx >= ent.i + ent.n).join(" ");
  const pelicula = _RX_PELICULA.test(resto);
  const ultimo = _RX_ULTIMO.test(resto);
  const mes = resto.match(_RX_MES);
  if (!pelicula && !ultimo && !mes) return null;   // el único corte era el nombre: no hay pregunta de período

  const corte = pelicula ? { tipo: "pelicula" }
    : ultimo ? { tipo: "ultimo" }
    : { tipo: "punto", mes: (_MESES_NOMBRE.indexOf(mes[1].toLowerCase()) + 1) || 9, anio: mes[2] ? Number(mes[2]) : null };
  return { entidad: ent.nombre, eje: ent.eje, metrica, corte };
}

/* ── COMPOSICIÓN · cada cifra es una lectura directa del dataset ────────────────────────────────────────────── */

const _METRICA_TXT = { venta: "venta", margen: "margen", contribucion: "contribución", unidades: "unidades", acciones: "acciones comerciales" };
const _pct = (v) => `${(+v).toFixed(1).replace(".", ",")}%`;
const _delta = (v) => `${v >= 0 ? "+" : "−"}${Math.abs(+v).toFixed(1).replace(".", ",")}%`;
const _n = (v) => Math.round(v).toLocaleString("es-CL");

/** el valor de la métrica en un punto de la serie, con su forma de pantalla. null = ese mes no la tiene.
 *  Los montos van por la ESCALA DECLARADA del pack (factorComercialDe): la serie de un pack de planilla está en
 *  moneda cruda y la del histórico de fábrica en miles — el número que se muestra es el del negocio, siempre. */
function _valorEn(p, metrica, dataset) {
  const fx = factorComercialDe(dataset);
  const dinero = (v) => ({ crudo: v, fmt: fmtMonto(v * fx, { dataset }) });
  if (metrica === "venta") return dinero(p.venta);
  if (metrica === "contribucion") return dinero(p.contribucion);
  if (metrica === "unidades") return { crudo: p.unidades, fmt: `${_n(p.unidades)} unidades` };
  if (metrica === "acciones") return dinero(p.rebates);
  if (metrica === "margen") return p.margen === null ? null : { crudo: p.margen, fmt: _pct(p.margen) };
  return null;
}

/** el botón a la ficha, SOLO para el eje cliente (la única ficha que existe) — la misma máquina de fichaIntent. */
function _puertaFicha(eje, entidad, escenario) {
  if (eje !== "cliente") return null;
  try {
    const addr = makeAddress({ vista: "ficha", seccion: "otro", slug: "ficha-cliente", eje: "cliente", entidad, escenario: escenario || null });
    return addr ? buildSentrixActionFromAddress(addr) : null;
  } catch { return null; }
}

/* composeSerieIntent({ q, scenario }) → { text, sentrixAction } | null
 *
 * El contrato de honestidad, rama por rama:
 *   serie real + punto      → la cifra de ese mes, con el mes nombrado y el delta contra el anterior si existe;
 *   serie real + película   → los puntos, el rango y los extremos — solo con 2+ meses;
 *   mes fuera del rango     → se declina nombrando QUÉ rango sí hay (y si el mes es un hueco, se dice);
 *   serie no real (demo)    → declina corto: el histórico de muestra no reconcilia y no se usa. Puerta a la ficha;
 *   nombre en dos ejes      → se pregunta cuál, nunca se elige;
 *   sin serie de esa entidad→ declina con nombre. Jamás el tablero. */
export function composeSerieIntent({ q, scenario = ESCENARIO_INICIAL } = {}) {
  let det;
  try { det = detectSerieIntent(q); } catch { return null; }
  if (!det) return null;

  const dataset = getTenantData() || {};

  if (det.ambiguo) {
    const { nombre, ejes } = det.ambiguo;
    return { text: `«${nombre}» existe como ${ejes.join(" y como ")} en tus datos, y el mes a mes de cada uno es distinto. Dime a cuál te refieres y te lo doy.`, sentrixAction: null };
  }

  /* el nombre que el usuario escribió no existe en el índice: se declina CON SU nombre y el parecido SE OFRECE
   * («¿quisiste decir…?»), jamás se ejecuta — la conducta de la casa, la misma de resolveEntityRef. */
  if (det.noResuelve) {
    const { pedido, eje, sugerencias } = det.noResuelve;
    const donde = { cliente: "tus clientes", sku: "tus SKU", marca: "tus marcas", familia: "tus familias" }[eje] || "tus datos";
    const sug = (sugerencias || []).filter(Boolean);
    return {
      text: `No encuentro «${pedido}» entre ${donde}.${sug.length ? ` ¿Quisiste decir ${sug.join(" o ")}? Dime y te doy su detalle.` : " Revisa el nombre tal como figura en tu archivo."}`,
      sentrixAction: null,
    };
  }

  const { entidad, eje, metrica, corte } = det;
  const estado = serieRealDe(entidad);
  const serie = (dataset.historialMargen || {})[entidad] || null;

  /* ── SIN SERIE REAL → DECLINAR CORTO, nunca el tablero ──────────────────────────────────────────────────── */
  if (!estado.real) {
    const puerta = _puertaFicha(eje, entidad, scenario);
    if (estado.motivo === "no-reconcilia") {
      return { text: `La serie mensual de ${entidad} no cierra contra su cifra oficial del período: son dos montos del mismo negocio y no te voy a servir ninguno de los dos. Revisa las filas de ${entidad} en tu archivo.`, sentrixAction: puerta };
    }
    /* el histórico de muestra (sin período declarado) o una entidad sin serie: el mismo cierre honesto */
    return {
      text: `El detalle mes a mes de ${entidad} no está en el dato de esta empresa${estado.motivo === "sin-periodo" ? ": el histórico de muestra no reconcilia con la cifra oficial y no lo uso para responderte" : ""}. Lo que sí está verificado de ${entidad} es su lectura del período — pídemela${puerta ? " o ábrela en su ficha" : ""}.`,
      sentrixAction: puerta,
    };
  }

  /* ── SERIE REAL ─────────────────────────────────────────────────────────────────────────────────────────── */
  const nombreMetrica = _METRICA_TXT[metrica];

  if (corte.tipo === "pelicula") {
    if (serie.length < 2) {
      const p = serie[0];
      const v = _valorEn(p, metrica, dataset);
      return { text: `De ${entidad} hay un solo mes cargado (${nombreDePeriodo(p.periodo)}${v ? `: ${v.fmt} de ${nombreMetrica}` : ""}). Con un segundo mes te armo la evolución.`, sentrixAction: null };
    }
    const puntos = serie.map((p) => {
      const v = _valorEn(p, metrica, dataset);
      return `${p.mes} ${v ? v.fmt : "sin compras"}`;
    });
    const conValor = serie.map((p) => ({ p, v: _valorEn(p, metrica, dataset) })).filter((x) => x.v);
    let extremos = "";
    if (conValor.length >= 2) {
      const max = conValor.reduce((a, b) => (b.v.crudo > a.v.crudo ? b : a));
      const min = conValor.reduce((a, b) => (b.v.crudo < a.v.crudo ? b : a));
      if (max.p.periodo !== min.p.periodo) extremos = ` El mes más alto fue ${nombreDePeriodo(max.p.periodo)} (${max.v.fmt}) y el más bajo ${nombreDePeriodo(min.p.periodo)} (${min.v.fmt}).`;
    }
    const total = (metrica === "venta" || metrica === "contribucion" || metrica === "unidades" || metrica === "acciones")
      ? ` Total del rango: ${metrica === "unidades" ? _n(serie.reduce((s, p) => s + p.unidades, 0)) + " unidades" : fmtMonto(serie.reduce((s, p) => s + (_valorEn(p, metrica, dataset) || { crudo: 0 }).crudo, 0) * factorComercialDe(dataset), { dataset })}.`
      : "";
    return { text: `La ${nombreMetrica} de ${entidad}, mes a mes: ${puntos.join(" · ")}.${total}${extremos}`, sentrixAction: null };
  }

  // el punto pedido: el último del rango, o el mes nombrado (del año más reciente que lo tenga, dicho con su año)
  let punto = null;
  if (corte.tipo === "ultimo") punto = serie[serie.length - 1];
  else {
    const candidatos = serie.filter((p) => Number(p.periodo.slice(5, 7)) === corte.mes && (corte.anio === null || Number(p.periodo.slice(0, 4)) === corte.anio));
    punto = candidatos[candidatos.length - 1] || null;
  }
  if (!punto) {
    const desde = nombreDePeriodo(serie[0].periodo), hasta = nombreDePeriodo(serie[serie.length - 1].periodo);
    const pedido = `${_MESES_NOMBRE[corte.mes - 1]}${corte.anio ? ` ${corte.anio}` : ""}`;
    return { text: `De ${pedido} no tengo filas de ${entidad}: tu historia cargada va de ${desde} a ${hasta}.`, sentrixAction: null };
  }

  const v = _valorEn(punto, metrica, dataset);
  const cuando = nombreDePeriodo(punto.periodo);
  if (!v) {
    // margen de un mes sin venta: el hecho es «no compró», no un 0%
    const ultimoCon = [...serie].reverse().find((p) => p.venta > 0 && _valorEn(p, metrica, dataset));
    return { text: `En ${cuando}, ${entidad} no registró compras, así que no hay ${nombreMetrica} de ese mes.${ultimoCon ? ` Su último mes con compras fue ${nombreDePeriodo(ultimoCon.periodo)}: ${_valorEn(ultimoCon, metrica, dataset).fmt}.` : ""}`, sentrixAction: null };
  }

  // venta 0 en el mes pedido: decirlo como hecho, con el último mes con compras al lado
  if (metrica !== "margen" && v.crudo === 0) {
    const ultimoCon = [...serie].reverse().find((p) => p.venta > 0);
    return { text: `En ${cuando}, ${entidad} no registró compras.${ultimoCon ? ` Su último mes con compras fue ${nombreDePeriodo(ultimoCon.periodo)}: ${_valorEn(ultimoCon, "venta", dataset).fmt}${ultimoCon.unidades ? ` (${_n(ultimoCon.unidades)} unidades)` : ""}.` : ""}`, sentrixAction: null };
  }

  const frase = metrica === "venta"
    ? `En ${cuando}, ${entidad} te compró ${v.fmt}${punto.unidades ? ` (${_n(punto.unidades)} unidades)` : ""}.`
    : metrica === "margen"
      ? `El margen de ${entidad} en ${cuando} fue ${v.fmt}.`
      : `La ${nombreMetrica} de ${entidad} en ${cuando}: ${v.fmt}.`;

  // el mes anterior DEL RANGO, si existe y tiene la métrica: el delta es información, no adorno
  const i = serie.findIndex((p) => p.periodo === punto.periodo);
  const antes = i > 0 ? serie[i - 1] : null;
  const vAntes = antes ? _valorEn(antes, metrica, dataset) : null;
  let cola = "";
  if (vAntes && vAntes.crudo !== 0 && metrica !== "margen") {
    cola = ` En ${nombreDePeriodo(antes.periodo)} habían sido ${vAntes.fmt}: ${_delta(((v.crudo / vAntes.crudo) - 1) * 100)}.`;
  } else if (vAntes && metrica === "margen") {
    const d = +(v.crudo - vAntes.crudo).toFixed(1);
    cola = ` En ${nombreDePeriodo(antes.periodo)} había sido ${vAntes.fmt}: ${d >= 0 ? "+" : "−"}${Math.abs(d).toFixed(1).replace(".", ",")} pp.`;
  }

  return { text: frase + cola, sentrixAction: null };
}
