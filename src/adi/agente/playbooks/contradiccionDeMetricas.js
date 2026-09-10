/* === src/adi/agente/playbooks/contradiccionDeMetricas.js · PLAYBOOK · LAS DOS SON CIERTAS ===================
 *
 * EL ENCARGO, palabra del owner (2026-09-09), tercero de su orden, con sus cinco frases:
 *   «¿por qué vendo más pero gano menos?» · «¿por qué Jumbo vende menos que Lider pero aporta más?» ·
 *   «¿por qué crece la venta pero cae el margen?» · «¿por qué tengo deuda alta pero poco vencido?» ·
 *   «¿por qué inventario bajo en monto pero alto en días?»
 *   «Debe explicar la tensión entre dos métricas, no responder solo una.»
 *
 * LA FALLA QUE ESTA RUTA EXISTE PARA IMPEDIR es responder MEDIA pregunta. Un motor de lecturas, ante «vendo
 * más pero gano menos», sirve la venta —que es lo primero que sabe leer— y el dueño se queda exactamente
 * donde estaba: sabiendo que vendió más, sin entender por qué eso no llegó abajo. Media respuesta a una
 * contradicción es peor que ninguna, porque parece una respuesta.
 *
 * EL ARCO, y es distinto de las otras dos rutas:
 *   1 · LAS DOS SON CIERTAS — cada una con SU cifra. No se desmiente ninguna: el dueño no se equivocó.
 *   2 · LO QUE LAS RECONCILIA, medido. Acá está el aporte: dos métricas que se mueven al revés no son un
 *       error del dato, son dos cosas distintas midiéndose bien. Nombrar el mecanismo es la respuesta.
 *   3 · QUÉ SIGNIFICA PARA ÉL — y qué NO dice el dato, declarado.
 *   4 · LA PREGUNTA CONCRETA, que además la ley del porqué exige (estas preguntas SON «por qué»).
 *
 * ⚠️ NO SE DICE «TENSIÓN». Es la palabra del owner y se entiende, pero en superficie está prohibida
 * (`lexico-tension`, contratoAgente): es vocabulario interno. Se dice que las dos son ciertas y qué las une.
 *
 * ⚠️ Y NO SE CRUZAN UNIVERSOS. La contradicción de inventario se responde con cifras de inventario y la
 * comercial con cifras comerciales: `skusMargen` y `skuInventario` no reconcilian (CLAUDE.md §4), así que una
 * frase que los ponga juntos sería un descuadre disfrazado de hallazgo. Por eso la rama de inventario NO usa
 * `tensionRead`, que publica contribución y valor de inventario en la MISMA boleta.
 *
 * PURO · determinístico · sin red. Cifras VERBATIM de la boleta. */

import { formaConversacional } from "../formaConversacional.js";
import { entidadesNombradas } from "./indiceEntidades.js";
import { variante } from "../variacion.js";

const _val = (f) => String((f && (f.text || f.value)) || "");
const _lab = (f) => String((f && f.label) || "");
const _num = (f) => (f && Number.isFinite(f.raw) ? f.raw : NaN);
const _find = (figs, re) => (Array.isArray(figs) ? figs : []).find((f) => re.test(_lab(f))) || null;
const _all = (figs, re) => (Array.isArray(figs) ? figs : []).filter((f) => re.test(_lab(f)));
const _esc = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/* el número para COMPARAR cuando la cifra no trae `raw` — con su escala, o «$574K» pesa más que «$2.3M».
 * Se usa para comparar y ordenar, jamás para mostrar: lo que se escribe sale verbatim de la boleta. */
const _ESCALA = { k: 1e3, m: 1e6, b: 1e9 };
const _ord = (f) => {
  const r = _num(f);
  if (Number.isFinite(r)) return r;
  const s = _val(f);
  const m = /(\d+(?:\.\d+)?)\s*([KkMmBb])?(?![A-Za-zÁÉÍÓÚÜáéíóúüÑñ])/.exec(s);
  if (!m) return NaN;
  return (/^[^\d]*-/.test(s) ? -1 : 1) * Number(m[1]) * (m[2] ? _ESCALA[m[2].toLowerCase()] : 1);
};

/* ── LAS DOS MÉTRICAS QUE EL USUARIO PUSO EN CONFLICTO ─────────────────────────────────────────────────────
 * Cada tipo declara con qué se lee, y —lo que hace auditable a esta ruta— CUÁLES SON SUS DOS LADOS: las dos
 * familias de rótulo que la respuesta tiene que citar. Esa declaración es la que el notario usa para cobrar
 * la mitad faltante, que es la falla que el owner nombró. */
const _VENTA = /\bventa[s]?\b|\bvendo\b|\bvend[eií]|\bfactur|\bcrec|\bvolumen\b|\bingreso[s]?\b/i;
const _GANANCIA = /\bmargen(?:es)?\b|\bgano\b|\bganancia[s]?\b|\butilidad\b|\bcontribuci[oó]n\b|\baporta\b|\brentabilidad\b/i;
const _COBRANZA = /\bdeuda\b|\bpendiente[s]?\b|\bpor cobrar\b|\bvencid[oa]s?\b|\bmora\b|\bcobranza\b|\bme deben\b|\babonad/i;
const _INVENTARIO = /\binventario\b|\bstock\b|\bd[ií]as\b|\brotaci[oó]n\b|\bbodega[s]?\b|\bcapital frenado\b/i;

const _TIPOS = {
  /* ⚠️ LA RAMA DEL NEGOCIO SE ARMÓ DOS VECES, y la primera la volteó el muro con razón. Nació leyendo
   * `trend ventas` y citando «$100.0M contra $92.9M del año anterior» — y esas dos cifras el motor las sella
   * `source: computed · derivada_no_reconciliada`: son un total que el propio dato declara que no cierra (es
   * la familia del descuadre conocido del año anterior). El muro vetó el turno entero y tenía razón: un
   * asesor no sostiene una lectura sobre un total que su fuente no reconcilia.
   * Lo mismo con «Margen máximo/mínimo», que también son computed.
   * Se rehízo entera sobre cifras LITERALES: la variación de la venta que publica `salesRead`, la SERIE
   * mensual de margen (los meses sí son lectura; sus máximos y mínimos no) y la carga comercial alta del
   * diagnóstico. Misma contradicción, contada con cifras que se pueden verificar una por una. */
  negocio: {
    pasos: [
      { tool: "salesRead", args: { focus: "vs_anterior", dimension: "cliente" }, para: "la variación de la venta contra el período comparable y el movimiento de cada cuenta: el lado que dice «vendo más», con cifras que son lectura y no un total derivado" },
      { tool: "trend", args: { metric: "margen" }, para: "el margen mes a mes: el otro lado, «gano menos», con su recorrido — la serie es lectura, y muestra la caída sin necesitar un promedio" },
      { tool: "diagnose", args: {}, para: "cuánta carga comercial va sobre el nivel declarado: el mecanismo medido que reconcilia las dos mitades" },
    ],
    lados: [/^headline$|· YoY$/i, /^(?:Ene|Feb|Mar|Abr|May|Jun|Jul|Ago|Sep|Oct|Nov|Dic)$/i],
  },
  cuentas: {
    pasos: (c) => [{ tool: "compareEntities", args: { entities: c.entidades, dimension: "cliente" },
      para: "las dos cuentas lado a lado en la misma lectura: venta, margen, contribución y carga comercial — las dos mitades de la contradicción y su mecanismo, sin mezclar fuentes" }],
    lados: [/· Ventas?$/i, /· Contribución$/i],
  },
  cobranza: {
    pasos: [{ tool: "cobranza", args: {},
      para: "el saldo pendiente y el vencido, que son las dos mitades: cuánto te deben y cuánto de eso ya se pasó de plazo" }],
    lados: [/^Saldo pendiente · total$/i, /^Saldo vencido · total$/i],
  },
  inventario: {
    pasos: [
      { tool: "inventoryStatus", args: {}, para: "el capital frenado: el lado del monto, en dinero" },
      { tool: "queryMetric", args: { metric: "doh", dimension: "sku" }, para: "los días de inventario por SKU: el lado del tiempo, que es el que el monto no muestra" },
    ],
    lados: [/^Capital frenado · total$|^Estado del inventario: capital frenado$/i, /\(DOH\)$|d[ií]as de inventario$/i],
  },
};

/** el caso: `{ tipo, entidades }` o null si la contradicción no se puede resolver con el dato que hay. */
function _caso(pregunta) {
  const q = String(pregunta || "");
  if (formaConversacional(q) !== "contradiccion") return null;
  /* DOS CUENTAS NOMBRADAS mandan sobre el tema: «Jumbo vende menos que Lider pero aporta más» es una
   * contradicción ENTRE ELLAS, y responderla con el total del negocio sería cambiarle la pregunta. */
  const ents = (() => { try { return entidadesNombradas(q, "cliente"); } catch { return []; } })();
  if (ents.length >= 2) return { tipo: "cuentas", entidades: ents.slice(0, 2).map((e) => e.nombre) };
  if (_COBRANZA.test(q)) return { tipo: "cobranza", entidades: [] };
  if (_INVENTARIO.test(q)) return { tipo: "inventario", entidades: [] };
  if (_VENTA.test(q) && _GANANCIA.test(q)) return { tipo: "negocio", entidades: [] };
  return null;      // forma de contradicción sin dos métricas identificables: se retira
}

const _pasosDe = (c) => { const t = _TIPOS[c.tipo]; return typeof t.pasos === "function" ? t.pasos(c) : t.pasos; };

export const contradiccionDeMetricas = {
  nombre: "contradiccion-de-metricas",

  /* sin nombres de cuenta: son dato del pack y se publicarían en el bundle (lo cazó `_bundle_sin_datos_gate`
   * en la primera ruta). El caso de dos cuentas lo prueba su gate armando los nombres desde el tenant. */
  ejemplos: [
    "¿por qué vendo más pero gano menos?",
    "¿por qué crece la venta pero cae el margen?",
    "¿por qué tengo deuda alta pero poco vencido?",
    "¿por qué inventario bajo en monto pero alto en días?",
  ],

  cuandoAplica(pregunta) { return _caso(pregunta) !== null; },

  pasos(pregunta) { const c = _caso(pregunta); return c ? _pasosDe(c) : []; },

  /* la promesa es EL LADO MÁS FRÁGIL de cada contradicción: si esa cifra no llega, la respuesta sería la
   * mitad que el owner prohibió, así que el playbook se retira en vez de servirla. */
  obligatorias(pregunta) {
    const c = _caso(pregunta);
    if (!c) return [];
    return [_TIPOS[c.tipo].lados[1]];
  },

  entregable: "RESUELVE LA CONTRADICCIÓN, sin desmentir ninguna de las dos mitades: (1) di que las dos son ciertas y muestra CADA UNA con su cifra —el dueño no se equivocó, está viendo dos cosas que se miden distinto—; (2) nombra el MECANISMO que las reconcilia, con las cifras que lo sostienen: dos métricas que se mueven al revés no son un error del dato; (3) di qué significa eso para su negocio y qué NO dice el dato; (4) cierra con una pregunta concreta. ⚠️ RESPONDER UNA SOLA DE LAS DOS ES LA FALLA: servir la venta a quien preguntó por qué vende más y gana menos lo deja donde estaba, y encima parece una respuesta. ⚠️ Y no mezcles universos: la contradicción de inventario se responde con cifras de inventario, la comercial con comerciales.",

  componer({ figs, pregunta, semilla } = {}) {
    const c = _caso(pregunta);
    if (!c) return null;
    const p = [];

    /* ── (a) DOS CUENTAS · la contradicción con el mecanismo en la MISMA lectura ───────────────────────────── */
    if (c.tipo === "cuentas") {
      const [A, B] = c.entidades;
      const g = (e, re) => _find(figs, new RegExp(`^${_esc(e)} · ${re}$`, "i"));
      const vA = g(A, "Ventas?"), vB = g(B, "Ventas?");
      const cA = g(A, "Contribución"), cB = g(B, "Contribución");
      const mA = g(A, "Margen"), mB = g(B, "Margen");
      if (!vA || !vB || !cA || !cB) return null;
      p.push(`Las dos cosas son ciertas y no se contradicen. ${A} vende ${_val(vA)} contra ${_val(vB)} de ${B}, y aporta ${_val(cA)} contra ${_val(cB)}.`);
      if (mA && mB) {
        p.push(`Lo que las une está en la misma lectura: ${A} cierra ${_val(mA)} de margen y ${B} ${_val(mB)}. La diferencia de aporte no viene del tamaño de la venta, viene de la tasa a la que cada peso se convierte.`);
      } else {
        p.push(`Lo que las une es la tasa: el aporte no es la venta, es la parte de la venta que queda — y esa parte es distinta en cada cuenta.`);
      }
      const kA = g(A, "Carga comercial"), kB = g(B, "Carga comercial");
      if (kA && kB) p.push(`Y donde se ve el mecanismo: ${A} cede ${_val(kA)} de carga comercial y ${B} ${_val(kB)}.`);
      p.push(`Lo que esto significa: la cuenta más grande no es la que más te deja, así que ordenar por venta te ordena mal la atención.`);
      p.push(variante(semilla, [
        `¿Quieres que mire qué está pagando la diferencia en ${B}?`,
        `Si quieres abro ${B} por dentro y vemos de dónde sale esa diferencia.`,
        `Dime si abrimos ${B} para ver qué se está cediendo ahí.`,
      ]));
      return p.join("\n");
    }

    /* ── (b) EL NEGOCIO · «vendo más pero gano menos» ─────────────────────────────────────────────────────── */
    if (c.tipo === "negocio") {
      const crecio = _find(figs, /^headline$/i);
      const cargaAlta = _find(figs, /^Carga comercial alta · subtotal$/i);
      /* LA SERIE MENSUAL, en el orden en que la publica el motor: la caída se ve en las cifras mismas, sin
       * promediar ni resumir. Se muestran la primera, una del medio y la última — y la cola SE DECLARA. */
      const serie = _all(figs, /^(?:Ene|Feb|Mar|Abr|May|Jun|Jul|Ago|Sep|Oct|Nov|Dic)$/i);
      if (serie.length < 3) return null;
      const hitos = [serie[0], serie[Math.floor(serie.length / 2)], serie[serie.length - 1]];
      /* «sin un solo mes de recuperación» solo se dice si la serie ES monótona — se verifica, no se supone */
      const baja = serie.every((f, i) => i === 0 || !(_ord(f) > _ord(serie[i - 1])));
      p.push(`Las dos son ciertas y no se contradicen.${crecio ? ` La venta creció ${_val(crecio)} contra el período comparable.` : ""} Y el margen fue cediendo mes a mes: ${hitos.map((f) => `${_lab(f)} ${_val(f)}`).join(" · ")}${serie.length > 3 ? ", y los demás meses en la misma dirección" : ""}.`);
      /* EL MECANISMO, medido. ⚠️ Solo con cifras LITERALES: la contribución no capturada del diagnóstico es
       * `derivada_no_reconciliada` y el muro la veta —con razón—, así que el mecanismo se sostiene en la
       * carga comercial alta, que sí es lectura. */
      if (cargaAlta) {
        p.push(`Lo que las une: la venta nueva entró a un margen más delgado que la vieja. El mecanismo está medido — ${_val(cargaAlta)} de carga comercial por sobre el nivel que tienes declarado.`);
      } else {
        p.push(`Lo que las une: son dos medidas distintas. La venta cuenta pesos facturados; el margen cuenta qué parte de cada peso queda. Facturar más a una tasa más baja da exactamente esto.`);
      }
      p.push(`O sea el problema no es que vendas poco: es cuánto te queda de lo que vendes${baja ? `, y viene cediendo sin un solo mes de recuperación` : ""}. Eso se decide en las condiciones, no en el volumen.`);
      p.push(variante(semilla, [
        `Lo que el dato no dice es si ese cambio de condiciones fue decidido o se fue dando. ¿Hubo una negociación grande en el período?`,
        `Falta tu lado: si esas condiciones se pactaron a cambio de volumen. Dímelo y cierro la lectura.`,
        `¿Hubo campaña, cambio de lista o una negociación fuerte en el período? Con eso cierro el porqué.`,
      ]));
      return p.join("\n");
    }

    /* ── (c) COBRANZA · «deuda alta pero poco vencido» ────────────────────────────────────────────────────── */
    if (c.tipo === "cobranza") {
      const pend = _find(figs, /^Saldo pendiente · total$/i), venc = _find(figs, /^Saldo vencido · total$/i);
      const venta = _find(figs, /^Venta del período \(flujo\)$/i), abon = _find(figs, /^Abonado · total$/i);
      if (!pend || !venc) return null;
      p.push(`Las dos son ciertas y no se contradicen: te deben ${_val(pend)} y de eso está vencido ${_val(venc)}.`);
      /* la comparación es entre DOS CIFRAS DE LA BOLETA — no se escribe ningún número nuevo */
      const mayoriaAlDia = Number.isFinite(_ord(pend)) && Number.isFinite(_ord(venc)) && _ord(venc) * 2 < _ord(pend);
      p.push(mayoriaAlDia
        ? `Lo que las une: la mayor parte de esa deuda todavía está dentro de plazo. No es mora, es plazo que estás financiando tú.`
        : `Lo que las une: buena parte de esa deuda ya se pasó de plazo, así que acá sí hay un problema de cobro y no solo de financiamiento.`);
      if (venta && abon) p.push(`El contexto: sobre ${_val(venta)} de venta del período llevas ${_val(abon)} abonados.`);
      p.push(mayoriaAlDia
        ? `Lo que esto significa: el asunto no es cobrar más rápido, es cuánto plazo estás dando — y el plazo es una condición comercial, no un problema de cobranza.`
        : `Lo que esto significa: el asunto sí es de cobro, y conviene mirarlo por cuenta antes que por total.`);
      p.push(variante(semilla, [
        `¿Te abro quiénes concentran el vencido?`,
        `Si quieres vemos qué cuentas cargan ese vencido.`,
        `Dime si lo abrimos por cuenta y miramos dónde se junta.`,
      ]));
      return p.join("\n");
    }

    /* ── (d) INVENTARIO · «bajo en monto pero alto en días» ───────────────────────────────────────────────── */
    const frenado = _find(figs, /^Capital frenado · total$|^Estado del inventario: capital frenado$/i);
    const dias = _all(figs, /\(DOH\)$|d[ií]as de inventario$/i)
      .map((f) => ({ n: _lab(f).split("·")[0].trim(), v: _ord(f), fmt: _val(f) }))
      .filter((x) => x.n && Number.isFinite(x.v)).sort((a, b) => b.v - a.v);
    if (!dias.length) return null;
    p.push(`Las dos son ciertas, y miden cosas distintas.${frenado ? ` En dinero el capital frenado pesa ${_val(frenado)}.` : ""} En tiempo pesa mucho más: ${dias.slice(0, 3).map((x) => `${x.n} ${x.fmt}`).join(" · ")}${dias.length > 3 ? ", y siguen otros" : ""}.`);
    p.push(`Lo que las une: son artículos de precio bajo que rotan lento. Poco dinero inmovilizado mucho tiempo sigue siendo poco dinero — por eso el monto no te alarma.`);
    p.push(`Lo que esto significa: el problema no es el capital, es la compra. Esos días dicen que se compró más de lo que ese artículo vende, y si se repite el pedido, el monto deja de ser chico.`);
    p.push(variante(semilla, [
      `¿Quieres que mire cuáles de esos conviene no reponer?`,
      `Si quieres vemos artículo por artículo cuáles frenar.`,
      `Dime si lo abrimos por artículo y miramos la compra.`,
    ]));
    return p.join("\n");
  },

  listaNotarial(texto, { figs, pregunta } = {}) {
    const t = String(texto || "");
    const c = _caso(pregunta);
    if (!c || !t.trim()) return [];
    const v = [];
    const citaDe = (re) => _all(figs, re).some((f) => _val(f) && /\d/.test(_val(f)) && t.includes(_val(f)));
    const [ladoA, ladoB] = _TIPOS[c.tipo].lados;
    const a = citaDe(ladoA), b = citaDe(ladoB);

    /* ⚠️ (1) LA MITAD FALTANTE · la falla que el owner nombró: «debe explicar la tensión entre dos métricas,
     * no responder solo una». Servir la venta a quien preguntó por qué vende más y gana menos lo deja donde
     * estaba, y encima parece una respuesta. Solo se cobra si el texto YA está respondiendo con cifras: una
     * declinación honesta no debe multarse (la lección de la ruta de hipótesis). */
    if ((a || b) && !(a && b)) {
      v.push({ regla: "media-contradiccion", multa: `respondes una sola de las dos métricas que el usuario puso en conflicto. Trae la otra con su cifra: una contradicción se resuelve mostrando que las DOS son ciertas y diciendo qué las une, no eligiendo la mitad que sabes leer.` });
    }
    /* (2) SIN MECANISMO no hay resolución: dos cifras juntas siguen siendo dos cifras */
    if (a && b && !/lo que las une|no se contradicen|se explica|el mecanismo|miden cosas distintas|viene de la tasa/i.test(t)) {
      v.push({ regla: "contradiccion-sin-mecanismo", multa: "muestras las dos cifras pero no dices qué las reconcilia. Poner los dos números juntos no resuelve nada: el aporte es nombrar el mecanismo por el que las dos pueden ser ciertas a la vez." });
    }
    /* (3) NO SE DESMIENTE AL DUEÑO: su contradicción es real, no un error de lectura suyo */
    if (/no es (?:cierto|correcto|as[ií])(?![\wáéíóúñ])|est[aá]s (?:equivocad|confundid)|te confundes|en realidad no/i.test(t)) {
      v.push({ regla: "contradiccion-desmentida", multa: "estás desmintiendo al dueño. Las dos mitades que vio son ciertas —por eso preguntó—: el trabajo es explicar cómo conviven, no decirle que se equivocó." });
    }
    return v;
  },
};
