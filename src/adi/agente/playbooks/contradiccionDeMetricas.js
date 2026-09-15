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
import { declaradorDe } from "../../notario/declarar.js";   // el Notario semántico (fase 2): el composer declara mientras escribe

const _val = (f) => String((f && (f.text || f.value)) || "");
const _lab = (f) => String((f && f.label) || "");
const _num = (f) => (f && Number.isFinite(f.raw) ? f.raw : NaN);
const _find = (figs, re) => (Array.isArray(figs) ? figs : []).find((f) => re.test(_lab(f))) || null;
const _all = (figs, re) => (Array.isArray(figs) ? figs : []).filter((f) => re.test(_lab(f)));
const _esc = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
/* el universo de un subtotal, para declararlo: el tramo del rótulo que lo nombra («6 cuentas sobre el nivel declarado (…)») o,
 * sin ese tramo, el tamaño del grupo que la fig trae — un subtotal declarado sin su conjunto no es verificable */
const _universoDe = (f) => { const m = /· subtotal · (.+)$/i.exec(_lab(f)); if (m) return m[1]; const n = f && f.grupo && Number.isFinite(+f.grupo.n) ? +f.grupo.n : null; return n != null ? `${n} cuentas` : undefined; };

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
  multidominio: true,   // compone su parte aunque la pregunta haga participar a dos dominios (contrato de dominios, owner 2026-09-14)

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

  /* Con el colector `declarar` (Notario semántico, fase 2) el composer DECLARA cada hecho mientras lo escribe: las cifras con su
   * dueño y su rótulo, los comparativos con sus dos lados, la relación entre las dos cifras que reconcilia la contradicción, el
   * estado de los artículos nombrados; y sella como lectura lo que es interpretación. Sin colector, `D` es mudo y el texto es el
   * mismo byte a byte. Cada línea (o el tramo que afirma) se guarda en una variable para que el `texto` declarado sea literal. */
  componer({ figs, pregunta, semilla, declarar } = {}) {
    const D = declaradorDe(declarar);
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
      /* las cuatro cifras, cada par sobre SU tramo: la venta con «vende», la contribución con «aporta» (que no es vocabulario de
       * métrica para el juez, y sobre la línea entera la contribución chocaría con «ventas») */
      const tVenta = `${A} vende ${_val(vA)} contra ${_val(vB)} de ${B}`, tAporta = `y aporta ${_val(cA)} contra ${_val(cB)}`;
      p.push(`Las dos cosas son ciertas y no se contradicen. ${tVenta}, ${tAporta}.`);
      D.deFig(vA, tVenta); D.deFig(vB, tVenta); D.deFig(cA, tAporta); D.deFig(cB, tAporta);
      if (mA && mB) {
        const l2 = `Lo que las une está en la misma lectura: ${A} cierra ${_val(mA)} de margen y ${B} ${_val(mB)}.`;
        const l2b = `La diferencia de aporte no viene del tamaño de la venta, viene de la tasa a la que cada peso se convierte.`;
        p.push(`${l2} ${l2b}`);
        D.deFig(mA, l2); D.deFig(mB, l2);
        D.lectura({ texto: l2b, sello: "indicado" });
      } else {
        const l2 = `Lo que las une es la tasa: el aporte no es la venta, es la parte de la venta que queda — y esa parte es distinta en cada cuenta.`;
        p.push(l2);
        D.lectura({ texto: l2, sello: "indicado" });
      }
      const kA = g(A, "Carga comercial"), kB = g(B, "Carga comercial");
      if (kA && kB) { const l3 = `Y donde se ve el mecanismo: ${A} cede ${_val(kA)} de carga comercial y ${B} ${_val(kB)}.`; p.push(l3); D.deFig(kA, l3); D.deFig(kB, l3); }
      const l4 = `la cuenta más grande no es la que más te deja`;
      p.push(`Lo que esto significa: ${l4}, así que ordenar por venta te ordena mal la atención.`);
      /* «la más grande» es la que más vende de las dos; «no es la que más te deja» dice que la OTRA aporta más: dos comparativos.
       * Se declaran tal como la frase los afirma — si las dos fueran la misma cuenta, la frase sería falsa y el Notario lo vería. */
      const grande = _ord(vA) >= _ord(vB) ? A : B, chica = grande === A ? B : A;
      D.orden({ sujeto: grande, metrica: "Ventas", forma: "comparativo", direccion: "mayor", vs: chica, texto: l4 });
      D.orden({ sujeto: chica, metrica: "Contribución", forma: "comparativo", direccion: "mayor", vs: grande, texto: l4 });
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
      const cargaAlta = _find(figs, /^Carga comercial alta · subtotal(?: · \d+ cuentas sobre el nivel[^·]*)?$/i);
      /* LA SERIE MENSUAL, en el orden en que la publica el motor: la caída se ve en las cifras mismas, sin
       * promediar ni resumir. Se muestran la primera, una del medio y la última — y la cola SE DECLARA. */
      const serie = _all(figs, /^(?:Ene|Feb|Mar|Abr|May|Jun|Jul|Ago|Sep|Oct|Nov|Dic)$/i);
      if (serie.length < 3) return null;
      const hitos = [serie[0], serie[Math.floor(serie.length / 2)], serie[serie.length - 1]];
      /* «sin un solo mes de recuperación» solo se dice si la serie ES monótona — se verifica, no se supone */
      const baja = serie.every((f, i) => i === 0 || !(_ord(f) > _ord(serie[i - 1])));
      const tCrecio = crecio ? `La venta creció ${_val(crecio)} contra el período comparable.` : "";
      const tSerie = `Y el margen fue cediendo mes a mes: ${hitos.map((f) => `${_lab(f)} ${_val(f)}`).join(" · ")}${serie.length > 3 ? ", y los demás meses en la misma dirección" : ""}.`;
      p.push(`Las dos son ciertas y no se contradicen.${crecio ? ` ${tCrecio}` : ""} ${tSerie}`);
      /* la variación de la venta del negocio: `salesRead` la publica como `headline` (sin rótulo de concepto), así que la
       * declaración dice lo que la frase afirma —la venta sube contra el año anterior— y el Notario juzga con lo que hay */
      if (crecio) D.variacion({ sujeto: "negocio", metrica: "Ventas", direccion: "sube", valor: _val(crecio), texto: tCrecio });
      for (const f of hitos) D.deFig(f, tSerie);   // los tres meses citados, cifra por cifra (el rótulo de cada uno es el mes)
      /* «fue cediendo»: cada hito citado queda por debajo del anterior — la relación entre dos cifras de la boleta, sin promediar */
      const cede = (f, prev, texto) => D.relacion({ sujeto: "negocio", metrica: _lab(f), forma: _ord(f) < _ord(prev) ? "menor" : "igual", vs: { sujeto: "negocio", metrica: _lab(prev) }, texto });
      hitos.slice(1).forEach((f, i) => cede(f, hitos[i], tSerie));
      /* EL MECANISMO, medido. ⚠️ Solo con cifras LITERALES: la contribución no capturada del diagnóstico es
       * `derivada_no_reconciliada` y el muro la veta —con razón—, así que el mecanismo se sostiene en la
       * carga comercial alta, que sí es lectura. */
      const ultimo = serie[serie.length - 1];
      if (cargaAlta) {
        const l2 = `Lo que las une: la venta nueva entró a un margen más delgado que la vieja.`;
        const l2b = `El mecanismo está medido — ${_val(cargaAlta)} de carga comercial por sobre el nivel que tienes declarado.`;
        p.push(`${l2} ${l2b}`);
        /* «un margen más delgado»: el hecho detrás de la frase es la serie — el margen del último mes contra el del primero */
        D.relacion({ sujeto: "negocio", metrica: _lab(ultimo), forma: "menor", vs: { sujeto: "negocio", metrica: _lab(serie[0]) }, texto: l2 });
        D.deFig(cargaAlta, l2b, { universo: _universoDe(cargaAlta) });
      } else {
        const l2 = `Lo que las une: son dos medidas distintas. La venta cuenta pesos facturados; el margen cuenta qué parte de cada peso queda.`;
        const l2b = `Facturar más a una tasa más baja da exactamente esto.`;
        p.push(`${l2} ${l2b}`);
        D.lectura({ texto: l2, sello: "indicado" });
        D.relacion({ sujeto: "negocio", metrica: _lab(ultimo), forma: "menor", vs: { sujeto: "negocio", metrica: _lab(serie[0]) }, texto: l2b });
      }
      const l3 = `O sea el problema no es que vendas poco: es cuánto te queda de lo que vendes`;
      const tBaja = `y viene cediendo sin un solo mes de recuperación`;
      const l3b = `Eso se decide en las condiciones, no en el volumen.`;
      p.push(`${l3}${baja ? `, ${tBaja}` : ""}. ${l3b}`);
      D.lectura({ texto: l3, sello: "indicado" });
      /* «sin un solo mes de recuperación» es la serie entera, mes contra mes anterior: se declara par por par, que es lo que se verificó */
      if (baja) serie.slice(1).forEach((f, i) => cede(f, serie[i], tBaja));
      D.lectura({ texto: l3b, sello: "criterio mío" });
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
      const l1 = `Las dos son ciertas y no se contradicen: te deben ${_val(pend)} y de eso está vencido ${_val(venc)}.`;
      p.push(l1);
      D.deFig(pend, l1, { universo: "total" }); D.deFig(venc, l1, { universo: "total" });
      D.relacion({ sujeto: "negocio", metrica: "Saldo vencido", forma: "parte", vs: { sujeto: "negocio", metrica: "Saldo pendiente" }, texto: l1 });   // «de eso»: el vencido es parte del pendiente
      /* la comparación es entre DOS CIFRAS DE LA BOLETA — no se escribe ningún número nuevo */
      const mayoriaAlDia = Number.isFinite(_ord(pend)) && Number.isFinite(_ord(venc)) && _ord(venc) * 2 < _ord(pend);
      const l2 = mayoriaAlDia
        ? `Lo que las une: la mayor parte de esa deuda todavía está dentro de plazo. No es mora, es plazo que estás financiando tú.`
        : `Lo que las une: buena parte de esa deuda ya se pasó de plazo, así que acá sí hay un problema de cobro y no solo de financiamiento.`;
      p.push(l2);
      /* la misma comparación que eligió la frase: «la mayor parte dentro de plazo» = el vencido es menos de la mitad del pendiente;
       * «buena parte pasada de plazo» = el vencido es parte del pendiente, sin cociente dicho */
      if (mayoriaAlDia) D.relacion({ sujeto: "negocio", metrica: "Saldo vencido", forma: "fraccion", k: 0.5, matiz: "menos de", vs: { sujeto: "negocio", metrica: "Saldo pendiente" }, texto: l2 });
      else D.relacion({ sujeto: "negocio", metrica: "Saldo vencido", forma: "parte", vs: { sujeto: "negocio", metrica: "Saldo pendiente" }, texto: l2 });
      if (venta && abon) { const l3 = `El contexto: sobre ${_val(venta)} de venta del período llevas ${_val(abon)} abonados.`; p.push(l3); D.deFig(venta, l3); D.deFig(abon, l3, { universo: "total" }); }
      const l4 = mayoriaAlDia
        ? `Lo que esto significa: el asunto no es cobrar más rápido, es cuánto plazo estás dando — y el plazo es una condición comercial, no un problema de cobranza.`
        : `Lo que esto significa: el asunto sí es de cobro, y conviene mirarlo por cuenta antes que por total.`;
      p.push(l4);
      D.lectura({ texto: l4, sello: "criterio mío" });
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
      .map((f) => ({ n: _lab(f).split("·")[0].trim(), v: _ord(f), fmt: _val(f), f }))
      .filter((x) => x.n && Number.isFinite(x.v)).sort((a, b) => b.v - a.v);
    if (!dias.length) return null;
    const top = dias.slice(0, 3);
    const tFrenado = frenado ? `En dinero el capital frenado pesa ${_val(frenado)}.` : "";
    const tDias = `En tiempo pesa mucho más: ${top.map((x) => `${x.n} ${x.fmt}`).join(" · ")}${dias.length > 3 ? ", y siguen otros" : ""}.`;
    p.push(`Las dos son ciertas, y miden cosas distintas.${frenado ? ` ${tFrenado}` : ""} ${tDias}`);
    if (frenado) D.deFig(frenado, tFrenado, { universo: "total" });
    /* los tres que se nombran son los de MÁS días entre los SKU con días publicados: un orden top-k, y cada cifra con su dueño */
    D.orden({ sujeto: top.map((x) => x.n), metrica: "Días de inventario", forma: "topk", k: top.length, direccion: "mayor", universo: `los ${new Set(dias.map((x) => x.n)).size} SKU`, texto: tDias });
    for (const x of top) D.deFig(x.f, tDias);
    const l2 = `Lo que las une: son artículos de precio bajo que rotan lento.`;
    const l2b = `Poco dinero inmovilizado mucho tiempo sigue siendo poco dinero — por eso el monto no te alarma.`;
    p.push(`${l2} ${l2b}`);
    D.lectura({ texto: l2, sello: "indicado" });
    D.estado({ sujeto: top.map((x) => x.n), estado: "inmovilizado", texto: l2b });   // «dinero inmovilizado»: el estado declarado de los artículos nombrados
    const l3 = `Lo que esto significa: el problema no es el capital, es la compra. Esos días dicen que se compró más de lo que ese artículo vende, y si se repite el pedido, el monto deja de ser chico.`;
    p.push(l3);
    D.lectura({ texto: l3, sello: "indicado" });
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
