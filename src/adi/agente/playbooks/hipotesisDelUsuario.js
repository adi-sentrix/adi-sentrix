/* === src/adi/agente/playbooks/hipotesisDelUsuario.js · PLAYBOOK · EL USUARIO PROPONE, ADI CONTRASTA ==========
 *
 * EL ENCARGO, palabra del owner (2026-09-09): «Si el usuario dice "creo que es por descuentos, ¿estoy en lo
 * correcto?" o "¿será que Lider está comprando menos?", ADI debe contrastar esa hipótesis contra el dato:
 * confirmarla, corregirla o dejarla abierta diciendo qué falta.» Y la puso PRIMERA de su lista de prioridad.
 *
 * POR QUÉ PRIMERA, medido en el censo: es la única ruta donde ADI puede afirmar algo FALSO con seguridad y
 * salir limpio. Un «sí, Lider está comprando menos» no lleva ninguna cifra, así que ningún juez del muro tiene
 * qué verificar — y el dueño se va con una creencia equivocada confirmada por su asesor. El dato dice lo
 * contrario: Lider compró $2.3M MÁS. Corregir al dueño con su propio dato es exactamente lo que un asesor hace
 * y un respondedor de tablas no.
 *
 * ES LA RUTA INVERSA DEL PORQUÉ. En el porqué, ADI mide y propone; acá el usuario propone y ADI verifica. Por
 * eso el arco es otro y está en este orden:
 *   1 · SE REPITE LA HIPÓTESIS, para que quede claro qué se está contrastando (y si ADI la entendió mal, el
 *       usuario lo ve en la primera línea en vez de discutir una respuesta a otra pregunta).
 *   2 · EL VEREDICTO CON SU CIFRA: confirma · corrige · o queda abierta. Nunca un «sí» pelado.
 *   3 · SI CORRIGE, QUÉ SÍ PASA — el dato que reemplaza a la creencia.
 *   4 · SI QUEDA ABIERTA, QUÉ FALTA para cerrarla, en términos del negocio.
 *
 * ⚠️ LO QUE ESTE PLAYBOOK NO HACE: inventar la hipótesis. Si la pregunta no dice sobre QUÉ es («¿tú qué
 * opinas?» a secas), se retira — adivinar qué quiso decir el usuario y contrastar ESO es peor que no tomar el
 * turno. Ante la duda, false: la regla de todo detector de esta casa.
 *
 * PURO · determinístico · sin red. Cifras VERBATIM de la boleta. */

import { formaConversacional } from "../formaConversacional.js";
import { entidadNombrada } from "./indiceEntidades.js";
import { reDeReferencia } from "../../oracle/entityRecord.js";   // el rótulo de la referencia se busca por el MISMO label que se publica
import { variante } from "../variacion.js";

const _val = (f) => String((f && (f.text || f.value)) || "");
const _lab = (f) => String((f && f.label) || "");
const _num = (f) => (f && Number.isFinite(f.raw) ? f.raw : NaN);
const _find = (figs, re) => (Array.isArray(figs) ? figs : []).find((f) => re.test(_lab(f))) || null;
const _all = (figs, re) => (Array.isArray(figs) ? figs : []).filter((f) => re.test(_lab(f)));
const _esc = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const _entidadDe = (label) => { const p = String(label || "").split("·").map((s) => s.trim()); return p.length >= 2 ? p[0] : null; };

/* ── EL NÚMERO PARA ORDENAR, CUANDO LA CIFRA NO TRAE `raw` ─────────────────────────────────────────────────
 * ⚠️ NO TODA CIFRA TRAE `raw`, y no es un caso raro: medido en esta misma lectura, «Lider · Valor = $2.3M» y
 * «Lider · Peso del costo = 72.9%» llegan con `raw: null` mientras sus vecinas lo traen. Un filtro por
 * `Number.isFinite(raw)` se llevaba familias enteras —el composer devolvía null y la hipótesis caía al
 * rescate con la boleta llena—, así que hay respaldo: se lee el número del texto.
 * ⚠️ Y SE LEE CON SU ESCALA. Sin ella «$574K» (574) ordenaba por encima de «$2.3M» (2.3) y la lista salía
 * al revés — el mismo error que hace que un ranking mienta con cada cifra correcta. El punto es DECIMAL en
 * esta casa, el signo puede venir antes del símbolo («-$94K»), y la letra de escala solo cuenta si no es la
 * inicial de una palabra («3 meses» no son tres millones).
 * ⚠️ ES PARA ORDENAR Y COMPARAR, NUNCA PARA MOSTRAR: lo que se escribe sale verbatim de la boleta. */
const _ESCALA = { k: 1e3, m: 1e6, b: 1e9 };
const _ord = (f) => {
  const r = _num(f);
  if (Number.isFinite(r)) return r;
  const s = _val(f);
  const m = /(\d+(?:\.\d+)?)\s*([KkMmBb])?(?![A-Za-zÁÉÍÓÚÜáéíóúüÑñ])/.exec(s);
  if (!m) return NaN;
  return (/^[^\d]*-/.test(s) ? -1 : 1) * Number(m[1]) * (m[2] ? _ESCALA[m[2].toLowerCase()] : 1);
};

/* ── QUÉ AFIRMA EL USUARIO ────────────────────────────────────────────────────────────────────────────────────
 * Tres piezas: sobre QUIÉN (una entidad, o el negocio), sobre QUÉ (la métrica), y en qué DIRECCIÓN. Sin las
 * tres no hay hipótesis que contrastar — y media hipótesis contrastada es una respuesta a otra pregunta. */
const _TEMAS = [
  { clave: "compra", re: /\bcompr[ao]|\bcompra(?:ndo|n)?\b|\bme compra\b|\bventa[s]?\b|\bvend(?:e|iendo|en)\b|\bfactura/i,
    tool: { tool: "salesRead", args: { focus: "vs_anterior", dimension: "cliente" }, para: "la venta de cada cliente contra el período comparable: quién sube y quién baja, con su cifra" } },
  { clave: "acciones", re: /\bdescuento[s]?\b|\brebate[s]?\b|\bacciones comerciales\b|\bcarga comercial\b|\bpromoci[oó]n(?:es)?\b/i,
    tool: { tool: "rolesCartera", args: {}, para: "el papel de cada cliente en el margen y la huella de cada mecanismo — entre ellos la carga comercial, que es lo que el usuario está proponiendo" } },
  /* ⚠️ `\b` NO EXISTE DESPUÉS DE VOCAL ACENTUADA en JS (la trampa de la casa, cazada por `_agente_contrato_gate`
   * en cuatro patrones de este archivo): «ó» no es carácter de palabra, así que entre «ó» y un espacio no hay
   * borde y la alternativa jamás dispara. El cierre de la casa es `(?![\wáéíóúñ])`. */
  { clave: "costo", re: /\bcosto[s]?\b|\bme cuesta\b|\bcost[oó](?![\wáéíóúñ])/i,
    tool: { tool: "marginRead", args: { focus: "causa_costo", dimension: "cliente" }, para: "quiénes ceden margen porque el costo se lleva la mayor parte de la lista" } },
  /* PRECIO va a la lectura de PRECIO, no a la de margen (corregido al medir el contraste): `precio_neto` trae
   * el precio neto después de acciones junto al realizado, y la diferencia entre ambos ES la huella que el
   * usuario está proponiendo. `causa_precio` devolvía la misma boleta que `causa_costo` — contrastar una
   * hipótesis de precio con cifras de costo es responder otra pregunta. */
  { clave: "precio", re: /\bprecio[s]?\b|\bcobr(?:o|ando|amos)\b|\blista\b/i,
    tool: { tool: "salesRead", args: { focus: "precio_neto", dimension: "cliente" }, para: "el precio neto después de acciones de cada cuenta, junto al realizado: la diferencia es lo que se cede" } },
  { clave: "margen", re: /\bmargen(?:es)?\b|\brentabilidad\b|\bdeja(?:ndo)? menos\b|\baporta\b|\bcontribuci[oó]n\b/i,
    tool: { tool: "marginRead", args: { focus: "bajo_benchmark", dimension: "cliente" }, para: "el margen de cada cliente contra el benchmark declarado" } },
];
/* la DIRECCIÓN que el usuario afirma: a la baja, al alza, o «es el problema» (que es una atribución) */
const _A_LA_BAJA = /\bmenos\b|\bbaj(?:a|ando|ó|o)(?![\wáéíóúñ])|\bcae|\bcay|\bpeor\b|\bcayendo\b|\bdesplom|\bperdiendo\b|\breduc/i;
const _AL_ALZA = /\bm[aá]s(?![\wáéíóúñ])|\bsub(?:e|iendo|ió)(?![\wáéíóúñ])|\bcrec|\bmejor\b|\baument/i;
/* «culpa» entera, no sus dos formas sueltas: la calibración trajo «la culpa es de los rebates», que no es
 * «por culpa» ni «culpa de» — el usuario atribuye con la palabra, no con la preposición. */
const _ES_EL_PROBLEMA = /\bel problema\b|\bla causa\b|\bculpa\b|\bes por\b|\bse debe a\b/i;
/* «Sodimac está creciendo» no nombra métrica: para una cuenta, crecer o caer ES su compra. Entra por un
 * SEGUNDO paso, nunca en la lista de temas — puesto ahí se llevaría «el margen está creciendo», que es del
 * tema margen y no de la compra (los temas se resuelven por orden, y compra va primero). */
const _CRECE_O_CAE = /\bcrec(?:e|iendo|i[oó])|\bva (?:mejor|peor)\b|\bse (?:desplom|cay[oó])/i;

/** el caso: `{ entidad, tema, direccion }` o null si la hipótesis no se puede identificar. */
function _caso(pregunta) {
  const q = String(pregunta || "");
  if (formaConversacional(q) !== "hipotesis") return null;
  const tema = _TEMAS.find((t) => t.re.test(q)) || (_CRECE_O_CAE.test(q) ? _TEMAS[0] : null);
  if (!tema) return null;                       // sin tema no hay nada que contrastar: se retira
  const ent = (() => { try { return entidadNombrada(q); } catch { return null; } })();
  const direccion = _ES_EL_PROBLEMA.test(q) ? "atribucion" : _A_LA_BAJA.test(q) ? "baja" : _AL_ALZA.test(q) ? "alza" : null;
  if (!direccion) return null;                  // «¿será algo con Lider?» no afirma nada verificable
  return { entidad: ent ? ent.nombre : null, eje: ent ? ent.eje : null, tema, direccion };
}

/* ── EL MOVIMIENTO DE CADA CUENTA CONTRA EL PERÍODO COMPARABLE ─────────────────────────────────────────────
 * ⚠️ `· YoY` ES UN TOP-N. Medido en la lectura `vs_anterior`: publica `· YoY` para las cinco primeras cuentas
 * y `· Valor` para TODAS —la misma cifra bajo dos etiquetas: Lider sale +$2.3M en las dos—. Leer solo el YoY
 * tenía dos consecuencias, las dos vistas en la corrida: «Sodimac está creciendo» se caía al rescate porque
 * Sodimac no está en el top, y la lista de «dónde sí pasa» se armaba sobre una cola recortada, que es mentir
 * por omisión aunque cada cifra sea correcta (CLAUDE.md §5). Se lee la unión, con el YoY mandando en su tramo. */
function _movimientos(figs) {
  const m = new Map();
  const cargar = (re) => _all(figs, re).forEach((f) => {
    const n = _entidadDe(_lab(f));
    if (!n || m.has(n)) return;
    const v = _ord(f);
    if (Number.isFinite(v)) m.set(n, { n, v, fmt: _val(f) });
  });
  cargar(/· YoY$/i);
  cargar(/· Valor$/i);
  return [...m.values()].sort((a, b) => b.v - a.v);
}

/* ── EL CONTRASTE POR TEMA ─────────────────────────────────────────────────────────────────────────────────
 * ⚠️ ESTO EMPEZÓ SIENDO UN VOLCADO DE ETIQUETAS —«las tres primeras cifras con dígitos, en minúscula»— y la
 * primera corrida lo dejó en evidencia dos veces: escupía «lider · medida 1pp $178K», que no le dice NADA al
 * dueño, y en la hipótesis de descuentos copiaba a la prosa la etiqueta «Target de carga», que el cerrojo
 * `lexico-meta` multa con razón (benchmark ≠ meta: las metas las fija el cliente). La lección es la de la
 * casa: una etiqueta es un nombre de columna, no una frase. Cada tema elige SUS cifras y las dice en voz de
 * negocio; la cifra viaja VERBATIM de la boleta, la palabra la ponemos nosotros.
 * Devuelve las líneas del veredicto, o null si el dato no alcanza para juzgar la hipótesis. */
function _contraste(c, figs) {
  const orden = (re, desc = true) => _all(figs, re)
    .map((f) => ({ n: _entidadDe(_lab(f)), v: _ord(f), fmt: _val(f) }))
    .filter((x) => x.n && Number.isFinite(x.v))
    .sort((a, b) => (desc ? b.v - a.v : a.v - b.v));
  /* la cola SE DECLARA (CLAUDE.md §5: un top-N que no la declara miente por omisión aunque cada cifra sea
   * correcta) — y se declara SIN contarla: el conteo sería un número escrito a mano, y encima uno falso,
   * porque la lectura ya recortó su propio top antes de llegar acá. */
  const lista = (xs, n = 3) => xs.slice(0, n).map((x) => `${x.n} ${x.fmt}`).join(" · ") + (xs.length > n ? ", y siguen otras" : "");
  const bench = _find(figs, /^Benchmark de margen$/i);
  const L = [];

  if (c.tema.clave === "acciones") {
    const cargas = orden(/· Carga comercial$/i);
    if (!cargas.length) return null;
    /* la referencia declarada se nombra por lo que ES. «Target» es la etiqueta del motor, no una palabra de
     * pantalla: el nivel de carga lo declara el cliente, y decirle «tu meta» le atribuye una que no fijó. */
    const ref = _find(figs, reDeReferencia("pctRebate"));
    const erosion = _find(figs, /erosi[oó]n por acciones comerciales/i);
    L.push(`El mecanismo existe y está medido: ${erosion ? `${_val(erosion)} clientes ceden margen por acciones comerciales` : `la carga comercial se mide cuenta por cuenta`}${ref ? `, contra un nivel de carga declarado de ${_val(ref)}` : ""}.`);
    L.push(`Donde más pesa: ${lista(cargas)}.`);
    /* ⚠️ CONFIRMAR EL MECANISMO NO ES CONFIRMAR LA CAUSA. Que la carga exista y se concentre ahí es un hecho
     * medido; que sea LA razón de lo que el dueño está viendo es una atribución que el dato no autoriza. */
    L.push(`Eso te dice dónde está la huella, no si fue la razón: el dato mide cuánto se cede, no qué se negoció a cambio. Si esas acciones compraron volumen, dímelo y cierro la lectura por ese lado.`);
    return L;
  }

  if (c.tema.clave === "costo") {
    const pesos = orden(/· Peso del costo$/i);
    if (!pesos.length) return null;
    const margenes = orden(/· Margen$/i, false);
    const top = pesos[0];
    const suMargen = margenes.find((m) => m.n === top.n);
    L.push(`El dato la sostiene donde más duele: en ${top.n} el costo se lleva ${top.fmt} de la venta${suMargen ? `, y su margen queda en ${suMargen.fmt}` : ""}${bench ? ` contra un benchmark declarado de ${_val(bench)}` : ""}.`);
    if (pesos.length > 1) L.push(`Y no es solo esa cuenta: ${lista(pesos.slice(1), 2)} cargan un peso parecido.`);
    L.push(`Lo que el dato mide es cuánto pesa el costo, no por qué pesa así. Para cerrarla necesito saber de tu lado si cambió el costo de compra o el mix de lo que se vendió.`);
    return L;
  }

  if (c.tema.clave === "precio") {
    const netos = _all(figs, /· Precio neto después de acciones$/i);
    if (!netos.length) return null;
    const par = netos.slice(0, 3).map((f) => {
      const n = _entidadDe(_lab(f));
      const real = _find(figs, new RegExp(`^${_esc(n)} · Precio realizado$`, "i"));
      return `${n} ${_val(f)}${real ? ` (lista realizada ${_val(real)})` : ""}`;
    });
    L.push(`Lo que el dato mide del precio: ${par.join(" · ")}${netos.length > 3 ? ", y siguen otras" : ""}.`);
    L.push(`La diferencia entre los dos números de cada cuenta es lo que se va en acciones comerciales — esa es la parte del precio sobre la que puedes decidir.`);
    L.push(`Lo que no puedo separar con esto es si tu lista quedó baja o si el costo subió: son dos caras de la misma fila. Dime cuál quieres mirar y abro esa.`);
    return L;
  }

  if (c.tema.clave === "margen") {
    const margenes = orden(/· Margen$/i, false);
    if (!margenes.length || !bench) return null;
    const conteo = _find(figs, /clientes bajo el benchmark/i);
    const brecha = _find(figs, /^El negocio · Brecha al benchmark$/i);
    L.push(`El dato la sostiene: ${conteo ? `${_val(conteo)} clientes` : `varias cuentas`} están bajo el benchmark declarado de ${_val(bench)}${brecha ? `, y el negocio cierra ${_val(brecha)} por debajo` : ""}.`);
    L.push(`Los más delgados: ${lista(margenes)}.`);
    L.push(`Esa es la lectura, no la causa. El margen delgado puede venir del precio o del costo, y el dato de esta lectura no los separa — dime por dónde empiezo y lo abro.`);
    return L;
  }

  /* compra sin entidad: «¿será que estamos vendiendo menos?» — el balance de la cartera contra el comparable.
   * ⚠️ SIN CONTARLAS. La primera versión abría con «2 cuentas bajan y 6 suben» y el muro la vetó con razón:
   * ese 2 y ese 6 los conté YO, no salen de ninguna cifra de la boleta. La regla de la casa no admite grados
   * —ningún número se escribe a mano— y acá además el conteo sería falso: la lectura recorta su top-N y yo
   * estaría contando la parte que me llegó. Se nombran las cuentas y cada una viaja con SU cifra. */
  const mov = _movimientos(figs);
  if (!mov.length) return null;
  const bajan = mov.filter((x) => x.v < 0).reverse();
  const suben = mov.filter((x) => x.v > 0);
  if (!bajan.length) { L.push(`No es lo que dice tu dato: contra el período comparable no hay cuentas a la baja en esta lectura. Las que más se mueven, y hacia arriba: ${lista(suben)}.`); return L; }
  L.push(`No es parejo, y esa es la parte que el total esconde. Las que bajan contra el período comparable: ${lista(bajan)}.`);
  if (suben.length) L.push(`Y al mismo tiempo suben: ${lista(suben)}.`);
  L.push(`O sea la caída está concentrada, no repartida: si vas a hacer algo, es en esas cuentas y no en el promedio.`);
  return L;
}

export const hipotesisDelUsuario = {
  nombre: "hipotesis-del-usuario",

  /* las formas del owner, para que el gate del registro verifique que el procedimiento resuelve pasos de
   * verdad y no solo que el archivo existe.
   * ⚠️ SIN NOMBRES DE CLIENTE, y lo cazó `_bundle_sin_datos_gate`: la primera versión traía «Lider» y
   * «Falabella» textuales y los metía al bundle publicado. Son nombres del pack de demostración —dato de un
   * cliente, no del producto— y el techo de esa fuga es cero por diseño. La forma se prueba igual sin ellos:
   * la entidad es opcional en este playbook, y el caso con cuenta nombrada lo cubre su propio gate armando el
   * nombre desde el tenant cargado, que además es lo que lo hace válido para la planilla del usuario. */
  ejemplos: [
    "creo que es por descuentos, ¿estoy en lo correcto?",
    "me parece que el problema es el costo, ¿tú qué ves?",
    "¿no será que el precio está muy bajo?",
    "sospecho que el margen viene cayendo, ¿lo confirmas?",
    "¿será que estamos vendiendo menos?",
  ],

  cuandoAplica(pregunta) { return _caso(pregunta) !== null; },

  pasos(pregunta) {
    const c = _caso(pregunta);
    if (!c) return [];
    /* si la hipótesis es sobre UNA cuenta y su compra, la lectura por cliente ya la trae con todas las demás
     * al lado — que es lo que permite decir «no baja: sube, y estos son los que sí bajan». */
    return [c.tema.tool];
  },

  /* ⚠️ UN PLAYBOOK SIN PROMESAS NO SE ACTIVA NUNCA, y es ley de la casa: `promesasCumplidas` devuelve false con
   * la lista vacía (registro.js). Lo aprendí midiendo: con `[]`, tres de los cuatro casos del owner corrían sus
   * herramientas —31 y 45 cifras en la boleta— y el turno igual caía al rescate, porque el composer nunca se
   * llamaba. La promesa es la que hace que el procedimiento sea auditable: si el dato no la sostiene, el
   * playbook se retira sin ruido en vez de prometer lo que no puede cumplir. */
  obligatorias(pregunta) {
    const c = _caso(pregunta);
    if (!c) return [];
    if (c.tema.clave === "compra") return [/· YoY$/i];
    if (c.tema.clave === "acciones") return [/· Carga comercial$/i];
    if (c.tema.clave === "precio") return [/· Precio neto después de acciones$/i];
    if (c.tema.clave === "costo") return [/· Peso del costo$/i];
    return [/· Margen$/i];   // margen: el margen de cada cuenta contra el benchmark es lo que sostiene el contraste
  },

  entregable: "CONTRASTA la hipótesis del usuario contra el dato, en este orden: (1) repite qué estás contrastando, en una línea, para que él vea si lo entendiste bien; (2) el VEREDICTO con su cifra —la confirmas, la corriges, o queda abierta—, jamás un «sí» o un «no» pelado; (3) si la corriges, di qué SÍ dice el dato y con qué cifra; (4) si queda abierta, di exactamente qué falta para cerrarla, en términos de su negocio. ⚠️ NUNCA confirmes ni niegues sin haber leído: una confirmación sin cifra es la peor respuesta posible — el dueño se va con una creencia equivocada respaldada por ti. Si el dato no alcanza para juzgarla, eso se dice y no se adivina.",

  componer({ figs, pregunta, semilla } = {}) {
    const c = _caso(pregunta);
    if (!c) return null;
    const p = [];

    /* ── (a) LA HIPÓTESIS SOBRE UNA CUENTA Y SU COMPRA · el caso con veredicto más limpio ─────────────────── */
    if (c.tema.clave === "compra" && c.entidad) {
      const mov = _movimientos(figs);
      const suyo = mov.find((x) => x.n === c.entidad);
      if (!suyo) return null;
      const delta = suyo.v;
      const sube = delta > 0;
      const acierta = (c.direccion === "baja" && !sube) || (c.direccion === "alza" && sube);
      p.push(`Tu hipótesis: ${c.entidad} está comprando ${c.direccion === "baja" ? "menos" : "más"}. La contrasto contra el dato.`);
      if (acierta) {
        p.push(`Es correcta: ${c.entidad} va ${suyo.fmt} contra el período comparable.`);
      } else {
        /* CORREGIR AL DUEÑO CON SU PROPIO DATO — el momento en que esto deja de ser un respondedor de tablas */
        p.push(`No es lo que dice tu dato: ${c.entidad} va ${suyo.fmt} contra el período comparable, o sea ${sube ? "te está comprando MÁS" : "te está comprando MENOS"}, al revés de lo que suponías.`);
        const otros = mov.filter((x) => x.n !== c.entidad && (sube ? x.v < 0 : x.v > 0));
        /* `mov` viene de mayor a menor. Si buscamos las que BAJAN, las negativas quedan al final y de menor a
         * mayor caída: hay que darlas vuelta para abrir por la caída más grande, que es la que él quería ver. */
        if (sube) otros.reverse();
        if (otros.length) p.push(`Donde sí pasa lo que describes: ${otros.slice(0, 3).map((x) => `${x.n} ${x.fmt}`).join(" · ")}.`);
      }
      p.push(variante(semilla, [
        `¿Quieres que abra esa cuenta por dentro para ver de dónde viene el movimiento?`,
        `Si quieres la abro por dentro y vemos qué la mueve.`,
        `Dime si la abrimos para ver el detalle.`,
      ]));
      return p.join("\n");
    }

    /* ── (b) LA ATRIBUCIÓN · «creo que es por descuentos» · «el problema es el costo» ──────────────────────── */
    if (c.direccion === "atribucion" || !c.entidad) {
      /* el verbo concuerda con el sujeto: «las acciones comerciales EXPLICAN» (lo cazó la primera corrida) */
      const T = { acciones: ["las acciones comerciales", "explican"], costo: ["el costo", "explica"], precio: ["el precio", "explica"], margen: ["el margen", "explica"], compra: ["la venta", "explica"] }[c.tema.clave];
      const cuerpo = _contraste(c, figs);
      if (!cuerpo) return null;                 // sin la medida del mecanismo no hay contraste: se retira
      p.push(`Tu hipótesis: ${T[0]} ${T[1]} lo que estás viendo. La contrasto contra el dato.`);
      p.push(...cuerpo);
      p.push(variante(semilla, [
        `¿Te abro el detalle por cuenta para ver dónde pesa más?`,
        `Si quieres lo miramos cuenta por cuenta.`,
        `Dime si vamos al detalle por cuenta.`,
      ]));
      return p.join("\n");
    }

    /* ── (c) UNA CUENTA Y OTRA MÉTRICA (margen, costo, precio) ─────────────────────────────────────────────
     * ⚠️ ACÁ ESTABA LA RESPUESTA COBARDE, y la cazó la primera corrida: decía «para juzgar si eso es menos
     * hace falta contra qué compararlo» teniendo el benchmark declarado en la misma boleta. Eso es devolverle
     * la pregunta al dueño con el dato en la mano — lo contrario de asesorar.
     * PERO «está dejando menos» es ambiguo a propósito: puede ser menos QUE EL BENCHMARK (medido) o menos QUE
     * ANTES (no está en esta lectura). Se responde lo que sí se puede y se DECLARA lo otro, en vez de elegir
     * en silencio la lectura que conviene. */
    const suMargen = _find(figs, new RegExp(`^${_esc(c.entidad)} · Margen$`, "i"));
    const bench = _find(figs, /^Benchmark de margen$/i);
    if (!suMargen || !bench) {
      const suyas = _all(figs, new RegExp(`^${_esc(c.entidad)} · `, "i")).slice(0, 3);
      if (!suyas.length) return null;
      p.push(`Tu hipótesis: ${c.entidad} está ${c.direccion === "baja" ? "dejando menos" : "mejorando"}. La contrasto contra el dato.`);
      p.push(`Lo que el dato dice de esa cuenta: ${suyas.map((f) => `${_lab(f).split("·").pop().trim().toLowerCase()} ${_val(f)}`).join(" · ")}.`);
      p.push(`Con esta lectura no puedo darte el veredicto: no trae contra qué compararla. Dime contra qué la mides y la cierro.`);
      return p.join("\n");
    }
    const mNum = _num(suMargen), bNum = _num(bench);
    const debajo = Number.isFinite(mNum) && Number.isFinite(bNum) ? mNum < bNum : null;
    const enJuego = _find(figs, new RegExp(`^${_esc(c.entidad)} · Valor en juego$`, "i"));
    p.push(`Tu hipótesis: ${c.entidad} está ${c.direccion === "baja" ? "dejando menos" : "mejorando"}. La contrasto contra el dato.`);
    if (debajo === true) {
      p.push(`Contra el benchmark declarado de ${_val(bench)}, sí: ${c.entidad} cierra en ${_val(suMargen)}${enJuego ? `, y esa diferencia vale ${_val(enJuego)}` : ""}.`);
    } else if (debajo === false) {
      p.push(`Contra el benchmark declarado de ${_val(bench)}, no: ${c.entidad} cierra en ${_val(suMargen)}, o sea está por encima de la referencia del negocio.`);
    } else {
      p.push(`Lo que el dato dice de esa cuenta: margen ${_val(suMargen)}, contra un benchmark declarado de ${_val(bench)}.`);
    }
    /* EL LÍMITE, DICHO: la comparación contra su propio pasado no está en esta lectura y no se finge. */
    p.push(`Contra su propio pasado no te lo puedo afirmar con esta lectura: mide el margen de hoy, no su historia. Si a eso te referías, dímelo y lo busco por ahí.`);
    return p.join("\n");
  },

  listaNotarial(texto, { figs, pregunta } = {}) {
    const t = String(texto || "");
    const c = _caso(pregunta);
    if (!c || !t.trim()) return [];
    const v = [];
    /* ⚠️ (1) NI SÍ NI NO SIN LEER — el defecto que hizo que esta ruta fuera la primera de la lista. Un «sí,
     * está comprando menos» no lleva cifras, así que ningún otro juez del muro tiene qué verificar: pasa
     * limpio y el dueño se va con una creencia equivocada confirmada por su asesor. Acá se exige que un
     * veredicto viaje con al menos una cifra de la boleta de ESTE turno. */
    /* ⚠️ el mismo `\b` imposible mordía acá DOS VECES —«sí,» y «…es así»—: la regla que existe para cazar el
     * «sí» pelado no veía justamente al «sí». Cerrado con `(?![\wáéíóúñ])`, como el resto de la casa. */
    const VEREDICTO = /\b(?:s[ií]|no)(?![\wáéíóúñ])[,:]|\bes (?:correcto|cierto|verdad|as[ií])(?![\wáéíóúñ])|\bconfirmo\b|\bconfirmado\b|\bestás en lo (?:correcto|cierto)\b|\bten[eé]s raz[oó]n\b|\btienes raz[oó]n\b|\bexactamente\b|\befectivamente\b|\bno es (?:correcto|cierto|as[ií])(?![\wáéíóúñ])|\bte equivocas\b/i;
    if (VEREDICTO.test(t)) {
      const citadas = (Array.isArray(figs) ? figs : []).filter((f) => _val(f) && /\d/.test(_val(f)) && t.includes(_val(f))).length;
      if (citadas === 0) {
        v.push({ regla: "confirmacion-sin-lectura", multa: "confirmas o niegas la hipótesis del usuario sin una sola cifra del turno. Un veredicto sin dato es una opinión con cara de verificación, y el dueño se queda con una creencia respaldada por ti. Trae la cifra que la sostiene o la desmiente, o di que el dato no alcanza para juzgarla." });
      }
    }
    /* (2) LA HIPÓTESIS SE REPITE: si ADI no dice qué está contrastando, el usuario no puede ver si la entendió.
     * ⚠️ PERO SOLO SI ESTÁ RESPONDIENDO. Medido en la primera corrida: esta regla multaba también a la línea
     * honesta —«no tengo información autorizada suficiente»—, y al vetarla dejaba el turno en `vacio`. Es
     * exactamente al revés de la ley de la casa: declinar honestamente cuenta como éxito. Un texto que no
     * cita ninguna cifra del turno no está contrastando nada, así que no hay hipótesis que repetir; el caso
     * peligroso —afirmar sin leer— ya lo cubre la regla (1). La multa queda para el turno que SÍ trae dato
     * pero se fue a hablar de otra cosa, que es el secuestro que este playbook existe para impedir. */
    const citaAlgo = (Array.isArray(figs) ? figs : []).some((f) => _val(f) && /\d/.test(_val(f)) && t.includes(_val(f)));
    if (citaAlgo && !/tu hip[oó]tesis|lo que (?:me )?propones|est[aá]s? (?:diciendo|planteando|suponiendo)|contrasto/i.test(t)) {
      v.push({ regla: "hipotesis-no-repetida", multa: "no dices QUÉ estás contrastando. Repite la hipótesis del usuario en una línea antes del veredicto: si la entendiste mal, tiene que poder verlo ahí y no después de leer una respuesta a otra pregunta." });
    }
    return v;
  },
};
