/* === src/adi/agente/playbooks/cuadroExplicado.js · EXPLICAR EL CUADRO, EL MISMO PARA TODAS LAS CARAS =========
 *
 * LA ESPECIFICACIÓN DEL OWNER, textual (2026-09-08):
 *   «El botón no manda solo texto. Manda el ancla completa del cuadro que el usuario está viendo. Debe incluir:
 *    cara/módulo · nombre del cuadro · métrica principal · eje o entidad · período · filtros aplicados · cifras
 *    visibles · qué pregunta concreta debe explicar. ADI debe responder ese cuadro, no una pregunta libre ni un
 *    ranking genérico. Si el cuadro muestra un 80/20, explica el 80/20. Si el cuadro muestra presupuesto,
 *    explica presupuesto. Si no existe dato suficiente para ese cuadro, debe decir exactamente qué falta.
 *    Hazlo transversal para todas las caras, no parche por cuadro.»
 *
 * ── QUÉ LO ABRE, Y POR QUÉ ASÍ ────────────────────────────────────────────────────────────────────────────
 * NO lo abre la pregunta: la abre EL CLICK. `ctx.cuadro` es el contexto de la pieza que el usuario tocó —
 * viaja por el canal EXPLÍCITO (el que `useViewContext.ask` sembró y el chat consume UNA vez), nunca por el
 * ambiente. La distinción no es cosmética: el ambiente sigue publicado mientras la Mesa está abierta, así que
 * abrirlo por ambiente secuestraría la siguiente pregunta escrita a mano — el turno libre volvería a
 * responderse como si fuera un botón. Un click, un turno.
 *
 * ── POR QUÉ NO ES UN PARCHE POR CUADRO ────────────────────────────────────────────────────────────────────
 * No hay una rama por componente, ni una lista de ids. Hay:
 *   · el MANIFIESTO, que ya declara de cada pieza qué mide, sobre qué eje, de qué período y contra qué se
 *     compara — los seis primeros campos del ancla que el owner pidió, escritos hace un mes;
 *   · `lecturaDeCuadro`, que trae el séptimo (las cifras visibles) del MISMO módulo que pinta la pantalla;
 *   · y acá, una explicación por FORMA (tabla · barra · serie · lista · kpi · tira), que es como se agrupan de
 *     verdad. Es el mismo criterio que ya probó ser el correcto con los playbooks de forma: tres de forma
 *     cubrieron 18 de 19 preguntas donde siete de tema habrían cubierto menos.
 * Un cuadro nuevo declarado en el manifiesto queda explicado el día que se declara, sin tocar este archivo.
 *
 * ── LA PRECEDENCIA ────────────────────────────────────────────────────────────────────────────────────────
 * Va DESPUÉS de `ask-de-cuadro` en el registro, a propósito: las cuatro formas de Capital ya tienen su
 * anclaje pulido y gateado contra el cuadro vivo, y quitárselas sería cambiar por gusto algo que funciona.
 * Éste toma todo lo demás — que hasta hoy era «todo lo demás menos cuatro formas».
 *
 * PURO · determinístico · sin red. Las cifras salen VERBATIM de la lectura del módulo: selecciona y ordena por
 * el orden de la pantalla, jamás calcula.
 */
import { lecturaDeCuadro } from "../../sentrix/lecturaDeCuadro.js";
import { getTenantId } from "../../../data/tenantStore.js";
import { VIEW_MANIFEST } from "../../sentrix/viewManifest.js";
import { variante } from "../variacion.js";

const _esc = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/* ── EL ANCLA DEL TURNO ────────────────────────────────────────────────────────────────────────────────────
 * `ctx.cuadro` es el ViewContext SELLADO de la pieza tocada. De él salen la dirección (componentId), el
 * escenario que la pantalla usó de verdad y los controles activos — los «filtros aplicados» del ancla. */
function _ancla(ctx) {
  const c = ctx && ctx.cuadro && typeof ctx.cuadro === "object" ? ctx.cuadro : null;
  if (!c) return null;
  const componentId = typeof c.componentId === "string" ? c.componentId : "";
  if (!componentId || !VIEW_MANIFEST[componentId]) return null;
  /* el contexto AMBIENTE de una vista (`<vista>/otro/vista`) identifica la pantalla, no una pieza: no autoriza
   * ninguna cifra (`unidad: texto`) y no puede abrir una explicación de cuadro. */
  if (VIEW_MANIFEST[componentId].tipo === "vista") return null;
  const controles = { ...(c.controles || {}) };
  /* el corte que el usuario tiene delante puede venir como control o como selección por filtro */
  if (c.seleccion && c.seleccion.modo === "filtro" && c.seleccion.filtro) Object.assign(controles, c.seleccion.filtro);
  if (c.filtros && typeof c.filtros === "object") Object.assign(controles, c.filtros);
  return { componentId, escenario: typeof c.escenario === "string" ? c.escenario : null, controles };
}

/* memo de UNA ranura: en un turno, `cuandoAplica`, `pasos`, `obligatorias`, `componer` y la lista notarial
 * piden la misma lectura. Correr el builder cinco veces sería gratis en corrección y caro en tiempo. */
let _memo = null;
function _leer(ancla, scenario) {
  const esc = ancla.escenario || scenario || null;
  const tid = (() => { try { return getTenantId(); } catch { return null; } })();
  const key = `${tid}|${ancla.componentId}|${esc}|${JSON.stringify(ancla.controles)}`;
  if (_memo && _memo.key === key) return _memo.val;
  const val = lecturaDeCuadro(ancla.componentId, { scenario: esc || undefined, controles: ancla.controles });
  _memo = { key, val };
  return val;
}

/** el caso del turno: { ancla, L } — o null si este turno no nació de un click en un cuadro explicable. */
function _caso(ctx, scenario) {
  const a = _ancla(ctx);
  if (!a) return null;
  const L = _leer(a, scenario);
  /* SE ABRE CUANDO SE PUEDE EXPLICAR (`ok`) O CUANDO EL DATO NO LO SOSTIENE (`sin-modulo`/`sin-campo`): ahí la
   * respuesta correcta es DECIR QUÉ FALTA, que es la tercera regla del owner. Con `sin-cifras` —la pieza pinta
   * números pero no los publica en forma citable— el playbook NO se abre: ese es un límite del lector, no del
   * negocio, y declararlo como límite del dato sería mentirle al usuario sobre su propia carga. */
  if (!L.ok && L.motivo !== "sin-modulo" && L.motivo !== "sin-campo") return null;
  return { ancla: a, L };
}

/* ── LOS RÓTULOS DE LA COMPARACIÓN, en palabras de negocio ─────────────────────────────────────────────── */
const CONTRA = {
  anterior: "contra el mismo período del año anterior", presupuesto: "contra tu presupuesto",
  benchmark: "contra tu benchmark", meta: "contra tu meta", promedio_cartera: "contra el promedio de tu cartera",
  vara_usuario: "contra la referencia que declaraste", estado: "contra el estado de cada fila",
};

/** la primera cifra de una fila (la que la pantalla muestra como su valor principal) */
const _principal = (f) => (f.cifras.find((c) => c.clave === "principal") || f.cifras[0] || null);
const _cifra = (f, clave) => f.cifras.find((c) => c.clave === clave) || null;
const _texto = (L, clave) => (L.textos || []).find((t) => t.clave === clave) || null;
const _cab = (L, clave) => (L.cabecera || []).find((c) => c.clave === clave) || null;

/** «Falabella $19.4M · Lider $17.9M · …» — el orden es el de la pantalla, jamás uno propio. */
const _listaCorta = (filas, n) => filas.slice(0, n).map((f) => {
  const p = _principal(f);
  return p ? `${f.nombre} ${p.valor}` : f.nombre;
}).join(" · ");

export const cuadroExplicado = {
  nombre: "cuadro-explicado",

  cuandoAplica(pregunta, ctx) {
    if (!String(pregunta || "").trim()) return false;
    try { return _caso(ctx, null) !== null; } catch { return false; }
  },

  pasos(pregunta, ctx) {
    const c = _caso(ctx, null);
    if (!c) return [];
    const m = VIEW_MANIFEST[c.ancla.componentId];
    /* ⚠️ UN SOLO PASO, Y ESO ES UNA DECISIÓN, NO UNA OMISIÓN. La primera versión sumaba acá la `evidencia` que
     * el manifiesto declara para la pieza («qué tools la demuestran»), para que el cerebro pudiera ir más allá
     * de la lectura literal. Salió ROJA en la medición, y por la razón correcta: en el cuadro del año mes a mes
     * quedaron DOS figs con el mismo valor y distinta procedencia —el total del cuadro (medido) y el de
     * `trend` (derivado, que el propio manifiesto declara `divergent` contra la pantalla por el anclaje)— y el
     * muro vetó el turno entero. No es un falso positivo: es la regla de la casa funcionando («dos montos del
     * mismo concepto de universos distintos jamás van juntos sin decir de cuál sale cada uno»).
     * Con el cuadro anclado la respuesta correcta es UNA sola fuente: la que el usuario tiene delante. El
     * cerebro conserva la caja completa y puede pedir más herramientas en la ronda siguiente si la conversación
     * lo lleva ahí — eso ya pasa por el muro como cualquier lectura. */
    return [{
      tool: "cuadroSentrix",
      args: { componentId: c.ancla.componentId, ...(Object.keys(c.ancla.controles).length ? { controles: c.ancla.controles } : {}) },
      para: `el cuadro «${m.label}» de la cara ${c.L.identidad ? c.L.identidad.cara : m.vista} tal como está en pantalla: qué mide, sobre qué eje, de qué período, con qué filtros — y SUS cifras, del mismo módulo que lo pinta`,
    }];
  },

  /* la promesa: la cabecera del cuadro (su identidad ya trae cifras) o, si el dato no lo sostiene, nada que
   * prometer — y ahí el composer responde igual, declarando qué falta. */
  obligatorias(pregunta, ctx) {
    const c = _caso(ctx, null);
    if (!c) return [];
    if (!c.L.ok) return [/.*/];   // el declive no promete cifras: promete la razón, y esa siempre está
    const cuadro = c.L.identidad.cuadro;
    if ((c.L.cabecera || []).length) return [new RegExp(`^${_esc(cuadro)} · `)];
    const f0 = (c.L.filas || [])[0];
    return f0 ? [new RegExp(`^${_esc(f0.nombre)} · `)] : [/.*/];
  },

  entregable(pregunta, ctx) {
    const c = _caso(ctx, null);
    if (!c) return "la explicación del cuadro que el usuario está mirando.";
    if (!c.L.ok) {
      return `el usuario tocó «${(c.L.identidad && c.L.identidad.cuadro) || "un cuadro"}» y ese cuadro no tiene con qué responderse en esta carga: DILE EXACTAMENTE QUÉ FALTA, en una o dos líneas, y ofrécele lo que sí puedes abrirle. Jamás sirvas otro corte en su lugar.`;
    }
    const I = c.L.identidad;
    const partes = [
      `EXPLICA EL CUADRO «${I.cuadro}» de la cara ${I.cara}${I.movimiento ? ` (${I.movimiento})` : ""}`,
      I.metricaLabel ? `mide ${String(I.metricaLabel).toLowerCase()}` : null,
      I.eje ? `por ${I.eje}` : null,
      I.periodo ? `del ${I.periodo}` : null,
      c.L.corte ? `en el corte «${c.L.corte.label}», que es el que el usuario tiene activo` : null,
      I.comparacion ? (CONTRA[I.comparacion] || `contra ${I.comparacion}`) : null,
    ].filter(Boolean);
    return [
      `${partes.join(" · ")}.`,
      "El usuario está MIRANDO esa pieza: responde lo que ella muestra, con SUS cifras — no el ranking del negocio, no otro eje, no otro período.",
      "Di qué se ve, qué significa para su negocio y qué decisión sale de ahí. Si el cuadro tiene un límite declarado, nómbralo en vez de taparlo.",
    ].join(" ");
  },

  componer({ pregunta, semilla, ctx, scenario } = {}) {
    const c = _caso(ctx, scenario);
    if (!c) return null;
    const L = c.L;

    /* ── EL DECLIVE HONESTO: el cuadro está en pantalla y el dato no lo sostiene ─────────────────────────── */
    if (!L.ok) {
      const I = L.identidad || {};
      const p = [`Ese cuadro no tiene con qué responderse en esta carga: ${L.falta}`];
      if (I.cara) p.push(`Puedo abrirte lo que la cara ${I.cara} sí tiene medido, o el cuadro que quieras señalarme.`);
      return p.join("\n");
    }

    const I = L.identidad;
    const p = [];

    /* 1 · QUÉ ES ESTE CUADRO — la identidad, en una línea de negocio.
     * El artículo del período sale de su propia forma: los períodos de la casa se escriben de las dos maneras
     * («año cerrado» pide «del», «12 meses del año en foco» pide «de los») y una sola plantilla producía
     * «del 12 meses». Es prosa, no dato: se resuelve mirando el texto, no adivinando el concepto. */
    const _periodo = I.periodo ? `${/^\d/.test(I.periodo) ? "de los" : "del"} ${I.periodo}` : null;
    const ident = [
      `${I.cuadro}`,
      I.metricaLabel ? `mide ${String(I.metricaLabel).toLowerCase()}` : null,
      I.eje && I.eje !== "tiempo" ? `por ${I.eje}` : (I.eje === "tiempo" ? "mes a mes" : null),
      _periodo,
    ].filter(Boolean);
    const contra = I.comparacion ? ` ${CONTRA[I.comparacion] || `contra ${I.comparacion}`}` : "";
    const corte = L.corte ? `, en el corte «${L.corte.label}»` : "";
    p.push(`El cuadro que tienes delante —${ident.join(", ")}${contra}${corte}— dice esto:`);

    /* 2 · LO QUE EL PROPIO CUADRO YA DICE (la frase del módulo, citada textual).
     * En un cuadro de concentración la `nota` del módulo ES la frase del cruce («El 80% se alcanza en X») y la
     * línea de más abajo la dice completa, con el universo: servir las dos sería decir lo mismo dos veces. */
    const _notaEsElCruce = I.tipo === "barra" && !!_texto(L, "cruce80");
    const lect = _texto(L, "lectura") || _texto(L, "pie") || _texto(L, "linea") || (_notaEsElCruce ? null : _texto(L, "nota"));
    if (lect) p.push(lect.texto);

    /* 3 · LAS CIFRAS, por FORMA. El orden es el de la pantalla. */
    if (I.tipo === "barra") {
      /* EL 80/20, explicado como 80/20: dónde se cruza, con qué acumulado, y qué queda en la cola. */
      const uni = _cab(L, "entidadesReales") || _cab(L, "n");
      const cruce = _texto(L, "cruce80");
      /* la fila del cruce puede NO estar entre las barras dibujadas (el gráfico acota para que se lea y la
       * curva se calcula con todas): entonces se dice dónde cruza sin inventarle un acumulado que no se pintó */
      const filaCruce = cruce ? L.filas.find((f) => f.nombre === cruce.texto) : null;
      const acum = filaCruce ? _cifra(filaCruce, "acumulado") : null;
      if (uni && cruce) {
        p.push(`De ${uni.valor} ${I.eje === "cliente" ? "clientes" : `${I.eje}s`}, el 80% se alcanza en ${cruce.texto}${acum ? `: ahí el acumulado llega a ${acum.valor}` : ""}.`);
      }
      const cabeza = L.filas.filter((f) => _cifra(f, "acumulado"));
      if (cabeza.length) p.push(`En orden: ${_listaCorta(cabeza, 8)}.`);
      const cola = L.filas.find((f) => /^cola\b/i.test(f.nombre));
      if (cola) { const pc = _principal(cola); if (pc) p.push(`${cola.nombre} suma ${pc.valor}.`); }
    } else if (I.tipo === "serie") {
      const tot = _cab(L, "totalActual") || _cab(L, "total");
      const mx = _cab(L, "max"), mn = _cab(L, "min"), cum = _cab(L, "cumplimiento");
      /* si el módulo YA dijo los extremos en su lectura, no se repiten: el owner lo pidió textual («aparece
       * mucha lectura»), y repetir la misma cifra dos veces en cinco líneas es exactamente eso. */
      const yaDijoExtremos = !!lect && mx && mn && lect.texto.includes(mx.valor) && lect.texto.includes(mn.valor);
      const linea = [
        tot ? `El período cierra en ${tot.valor}` : null,
        !yaDijoExtremos && mx ? `el mes más alto marca ${mx.valor}` : null,
        !yaDijoExtremos && mn ? `el más bajo ${mn.valor}` : null,
        cum ? `y el cumplimiento del presupuesto queda en ${cum.valor}` : null,
      ].filter(Boolean);
      if (linea.length) p.push(`${linea.join(", ")}.`);
      if (L.filas.length) p.push(`Las series del cuadro: ${_listaCorta(L.filas, 4)}.`);
    } else if (I.tipo === "kpi") {
      const v = _cab(L, "principal");
      if (v) p.push(`${I.cuadro}: ${v.valor}.`);
    } else {
      /* tabla · lista · tira · veredicto — las filas con sus conceptos, en el orden del cuadro */
      const top = L.filas.slice(0, 5);
      for (const f of top) {
        const cifras = f.cifras.slice(0, 4).map((x) => `${x.label.toLowerCase()} ${x.valor}`).join(" · ");
        p.push(`· ${f.nombre}: ${cifras}${f.linea ? ` — ${f.linea}` : ""}`);
      }
      if (L.filas.length > top.length) p.push(`(y ${L.filas.length - top.length} filas más en el cuadro)`);
      const tot = _cab(L, "totalVenta") || _cab(L, "total") || _cab(L, "capital");
      if (tot) p.push(`El total del cuadro: ${tot.valor}.`);
    }

    /* ⚠️ EL LÍMITE DECLARADO NO SE IMPRIME ACÁ, y también es una decisión medida. La primera versión sacaba a
     * pantalla los `campos` del manifiesto —«Lo que este cuadro no demuestra: grupoN, colaN»— y el notario la
     * vetó con razón: son nombres internos del sistema, y a pantalla van palabras del negocio. El límite no se
     * pierde: viaja al cerebro en `facts.limite` de la herramienta y en el entregable, que le pide nombrarlo
     * en sus palabras. El entregable determinístico calla antes que hablar en jerga. */

    /* 5 · LA PUERTA — qué se puede abrir desde acá */
    p.push(variante(semilla, [
      `Si quieres, te abro cualquiera de esas filas por dentro.`,
      `Dime por cuál fila seguimos y la abro.`,
      `Puedo abrirte el detalle de la que te interese.`,
    ]));
    return p.join("\n");
  },

  listaNotarial(texto, { pregunta, ctx } = {}) {
    const t = String(texto || "");
    if (!t.trim()) return [];
    const c = (() => { try { return _caso(ctx, null); } catch { return null; } })();
    if (!c || !c.L.ok) return [];
    const I = c.L.identidad;
    const v = [];

    /* (1) EL ANCLAJE NO SE SUELTA. Un turno de cuadro que no nombra ni una fila ni el sujeto del cuadro está
     * respondiendo otra cosa — es el defecto exacto que el owner midió: el botón del 80/20 devolvía un ranking
     * del negocio. Se mide contra los NOMBRES del propio cuadro, no contra una palabra clave. */
    const nombres = (c.L.filas || []).map((f) => f.nombre).filter((n) => n && n.length >= 3);
    if (nombres.length) {
      const nombra = nombres.some((n) => new RegExp(`\\b${_esc(n)}`, "i").test(t));
      const nombraElCuadro = new RegExp(_esc(I.cuadro), "i").test(t) || (I.metricaLabel && new RegExp(`\\b${_esc(I.metricaLabel)}`, "i").test(t));
      if (!nombra && !nombraElCuadro) {
        v.push({ regla: "cuadro-desanclado", multa: `el usuario tocó el cuadro «${I.cuadro}» y tu respuesta no nombra ni una de sus filas ni lo que mide: explica ESE cuadro, no el negocio en general.` });
      }
    }

    /* (2) EL 80/20 SE EXPLICA COMO 80/20. Palabra del owner: «si el cuadro muestra un 80/20, explica el 80/20».
     * Un cuadro de concentración respondido como lista ordenada no honra el click: la lista ya está en
     * pantalla; lo que el usuario no ve es en cuántos se concentra y dónde se cruza. */
    if (I.tipo === "barra" && /concentra/i.test(I.cuadro)) {
      const cruce = _texto(c.L, "cruce80");
      const diceCruce = /\b80\s?%|\b80\/20\b|concentra|acumulad/i.test(t) || (cruce && new RegExp(_esc(cruce.texto), "i").test(t));
      if (!diceCruce) v.push({ regla: "concentracion-sin-explicar", multa: "este cuadro muestra la concentración (el 80/20) y tu respuesta no la explica: di en cuántas cuentas se concentra y dónde se cruza el 80%, no solo el orden." });
    }

    /* (3) EL CUADRO NO CAMBIA DE PERÍODO NI DE EJE. Si la respuesta declara un eje que no es el del cuadro,
     * está respondiendo otra pieza. Se mide solo contra los ejes del contrato, jamás por comprensión. */
    const EJES = ["cliente", "sku", "marca", "familia", "bodega", "canal"];
    if (I.eje && EJES.includes(I.eje)) {
      const otro = EJES.filter((e) => e !== I.eje).find((e) => new RegExp(`\\bpor ${e}s?\\b`, "i").test(t));
      if (otro) v.push({ regla: "cuadro-de-otro-eje", multa: `el cuadro es por ${I.eje} y tu respuesta lo lee por ${otro}: ese es otro cuadro y el usuario no lo está mirando.` });
    }
    return v;
  },
};

/** solo para los candados: vacía el memo de una ranura entre casos. */
export function _olvidarMemoDelCuadro() { _memo = null; }
