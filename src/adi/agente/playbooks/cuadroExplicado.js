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
const _plural = (eje) => (eje === "cliente" ? "cuentas" : eje === "sku" ? "SKU" : eje === "familia" ? "familias"
  : eje === "marca" ? "marcas" : eje === "bodega" ? "bodegas" : eje === "canal" ? "canales" : "filas");

/* ── LOS GRUPOS DE SEÑAL · el corazón de la interpretación ─────────────────────────────────────────────────
 * Se agrupan las filas por la bandera que el MÓDULO les puso (no por una cuenta propia). Lo que sale de acá es
 * lo que la tabla tiene y no dice: cuántas caen, cuáles, y si son las mismas que fallan por el otro lado. */
function _gruposDeSenal(filas) {
  const por = new Map();
  for (const f of filas) for (const s of (f.senales || [])) {
    if (!s.alerta) continue;
    if (!por.has(s.clave)) por.set(s.clave, { clave: s.clave, dice: s.dice, dicen: s.dicen || s.dice, filas: [] });
    por.get(s.clave).filas.push({ fila: f, valor: s.valor || null });
  }
  /* el orden es por CUÁNTAS filas toca, de menos a más: una señal que toca 4 de 13 es un hallazgo; una que
   * toca 11 de 13 es una condición del negocio — las dos se cuentan, pero no se cuentan igual. */
  return [...por.values()].sort((a, b) => a.filas.length - b.filas.length);
}

/** «Ripley −8.1%, La Polar −12.4%» — hasta `n` nombres, en el orden del cuadro, cada una con SU cifra.
 *  La cifra de una señal sin número (un estado) se busca en la fila: primero la columna que HABLA de ese estado
 *  («vencido» → «Saldo vencido»), y si no existe, el valor principal — así «6 en estado vencido» sale con el
 *  saldo vencido de cada una y no con una venta que confundiría. */
const _cifraDeSenal = (x) => {
  if (x.valor && /\d/.test(x.valor)) return x.valor;
  if (x.valor) {
    const c = x.fila.cifras.find((cc) => new RegExp(`\\b${_esc(x.valor)}\\b`, "i").test(cc.label));
    if (c) return c.valor;
  }
  const p0 = _principal(x.fila);
  return p0 ? p0.valor : null;
};
const _conCifra = (items, n) => items.slice(0, n).map((x) => { const v = _cifraDeSenal(x); return `${x.fila.nombre}${v ? ` ${v}` : ""}`; }).join(", ");

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
      "El usuario está MIRANDO esa pieza: el cuadro es tu EVIDENCIA, no un texto a recitar — la tabla ya está en pantalla y repetirla es ruido.",
      "Cuenta la historia que hay detrás: caídas, puntos altos, variaciones, concentración, brechas, anomalías — y sobre todo lo que las filas no dicen solas (quiénes cargan la señal, si son las mismas por los dos lados, qué tapa el total). Di qué implica para el negocio y qué mirarías primero.",
      "Cita 2 a 4 cifras clave, jamás todas las filas, y no repitas la frase que el propio cuadro ya muestra. La medida del éxito: que entienda algo que no veía solo mirando el cuadro. Si el cuadro tiene un límite declarado, nómbralo en vez de taparlo.",
    ].join(" ");
  },

  /* ── EL ENTREGABLE · INTERPRETAR, NO RECITAR (regla del owner, 2026-09-08) ────────────────────────────────
   * «El botón debe usar el cuadro como EVIDENCIA, no como texto a recitar. Debe explicar la historia que hay
   *  detrás: evolución, caídas, puntos altos, variaciones, concentración, gaps o anomalías. Debe decir qué
   *  implica para el negocio y qué mirar primero. Puede citar 2-4 cifras clave, no todas las filas. Si el
   *  cuadro ya muestra la tabla, ADI debe aportar interpretación, no duplicarla.»
   *
   * LO QUE ESO CAMBIÓ, y por qué la primera versión estaba mal: recitaba las filas al lado de la tabla que las
   * muestra. Servía la evidencia como si fuera la respuesta. Acá el orden se invierte —hallazgo, evidencia
   * corta, implicancia, por dónde empezar— y hay dos silencios deliberados:
   *   · NO se repite la frase que el módulo ya pinta bajo el cuadro (está en pantalla: repetirla es ruido);
   *   · NO se listan todas las filas: como mucho tres nombres por señal.
   * El material para interpretar sin inventar son las SEÑALES que el propio módulo puso en cada fila
   * (`bajoBenchmark`, `critico`, la dirección de cada delta): agrupar por el veredicto del módulo no es
   * calcular, y lo que aparece —que las que caen son las mismas que fallan el presupuesto, salvo una— es
   * justo lo que la tabla tiene y no dice. */
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
    const nEje = _plural(I.eje);
    const uni = _cab(L, "n") || _cab(L, "entidadesReales");
    const universo = uni && Number.isFinite(Number(uni.valor)) ? Number(uni.valor) : L.filas.length;

    /* ── 1 · EL HALLAZGO · lo que las señales del módulo dicen y la tabla no ─────────────────────────────── */
    const grupos = _gruposDeSenal(L.filas);
    const foco = grupos[0] || null;                       // la señal más ACOTADA: la que señala algo, no todo
    if (foco) {
      const cuantas = foco.filas.length;
      const mayoria = universo > 0 && cuantas / universo >= 0.66;
      const dichoFoco = cuantas === 1 ? foco.dice : foco.dicen;
      p.push(mayoria
        ? `Lo que este cuadro está diciendo: ${cuantas} de ${universo} ${nEje} ${dichoFoco} — no es un caso puntual: pasa en ${cuantas === universo ? "todas" : "casi todas"}${cuantas === universo ? ` tus ${nEje}` : ` tus ${nEje}`}.`
        : `Lo que este cuadro está diciendo: de ${universo} ${nEje}, ${cuantas} ${dichoFoco} — ${_conCifra(foco.filas, 3)}${cuantas > 3 ? ", entre otras" : ""}.`);
      /* LA COINCIDENCIA · el hallazgo que ninguna columna muestra sola: ¿las que señala una bandera son las
       * mismas que señala la otra? Y si hay excepción, la excepción es la noticia. */
      const otra = grupos.find((g) => g !== foco && g.filas.length);
      if (otra) {
        const A = new Set(foco.filas.map((x) => x.fila.nombre));
        const B = new Set(otra.filas.map((x) => x.fila.nombre));
        const comunes = [...A].filter((x) => B.has(x));
        const soloA = [...A].filter((x) => !B.has(x));
        const soloB = [...B].filter((x) => !A.has(x));
        if (comunes.length >= 2 && soloA.length <= 1) {
          if (soloA.length === 1) {
            p.push(`Y son casi las mismas que ${otra.dicen}, con una excepción: ${soloA[0]} ${foco.dice} pero no ${otra.dice}.`);
          } else if (soloB.length === 1) {
            p.push(`Y esas mismas también ${otra.dicen} — ahí se suma ${soloB[0]}, que ${otra.dice} pero no ${foco.dice}.`);
          } else if (soloB.length === 0) {
            p.push(`Y son exactamente las mismas que ${otra.dicen}: el deterioro no está repartido, está concentrado en esas ${nEje}.`);
          }
        }
      }
    }

    /* ── 2 · LA EVIDENCIA, CORTA · 2-4 cifras, según la forma del cuadro ─────────────────────────────────── */
    if (I.tipo === "barra") {
      const cruce = _texto(L, "cruce80");
      const filaCruce = cruce ? L.filas.find((f) => f.nombre === cruce.texto) : null;
      const acum = filaCruce ? _cifra(filaCruce, "acumulado") : null;
      const cola = L.filas.find((f) => /^cola\b/i.test(f.nombre));
      const primera = L.filas.find((f) => !/^cola\b/i.test(f.nombre));
      const met = I.metricaDicha || "lectura";
      if (uni && cruce) p.push(`El 80% de tu ${met} se completa en ${cruce.texto}${acum ? ` (acumulado ${acum.valor})` : ""}, de ${uni.valor} ${nEje} en total.`);
      if (primera && _principal(primera)) {
        p.push(`${primera.nombre} sola pone ${_principal(primera).valor}${cola && _principal(cola) ? `; toda la cola junta, ${_principal(cola).valor}` : ""}.`);
      }
      p.push(`Lo que implica: tu ${met || "resultado"} depende de muy pocas ${nEje}. Un movimiento arriba mueve el año; uno abajo casi no se nota.`);
    } else if (I.tipo === "serie") {
      const tot = _cab(L, "totalActual") || _cab(L, "total");
      const cum = _cab(L, "cumplimiento");
      const alto = _cab(L, "max") || _cab(L, "pico"), bajo = _cab(L, "min") || _cab(L, "valle");
      const linea = [tot ? `El período cierra en ${tot.valor}` : null, cum ? `${cum.valor} del plan` : null].filter(Boolean);
      if (linea.length) p.push(`${linea.join(", ")}.`);
      if (alto && bajo) p.push(`Entre el mes más alto (${alto.valor}) y el más bajo (${bajo.valor}) la distancia es grande: tu año no es parejo, así que planificar con el promedio te va a fallar en los dos extremos.`);
      if (L.filasLlave === "series" && L.filas.length > 1) p.push(`Las series del cuadro: ${L.filas.slice(0, 3).map((f) => `${f.nombre} ${(_principal(f) || {}).valor || ""}`.trim()).join(" · ")}.`);
    } else if (I.tipo === "kpi") {
      const v = _cab(L, "principal");
      const pie = _texto(L, "pie") || _texto(L, "linea");
      if (v) p.push(`${I.cuadro}: ${v.valor}${pie ? ` — ${pie.texto}` : ""}.`);
    } else {
      /* tabla · lista · tira: la evidencia son las DOS puntas del cuadro, no las trece filas */
      const totalCifra = (L.cabecera || []).find((x) => /^total\./.test(x.clave) && !/Pct/.test(x.clave))
        || _cab(L, "totalVenta") || _cab(L, "usd") || _cab(L, "capital") || _cab(L, "suma");
      const delta = (L.cabecera || []).find((x) => /^total\.vs.*Pct$/.test(x.clave));
      if (totalCifra) p.push(`El cuadro completo cierra en ${totalCifra.valor}${delta ? ` (${delta.valor} ${delta.label.replace(/ \(%\)| · total/g, "")})` : ""}.`);
      if (totalCifra && delta && foco) {
        p.push(`Ahí está la lectura que importa: el total se mueve para arriba mientras esas ${nEje} se mueven para abajo — lo que crece tapa lo que cae, y por eso el número de arriba no te avisa.`);
      }
      const grupo = _cab(L, "grupoPct"), grupoN = _cab(L, "grupoN");
      if (grupo && grupoN) p.push(`Y ${grupoN.valor} ${nEje} explican el ${grupo.valor} de la venta: lo que pase en ese grupo es lo que pasa en tu negocio.`);
    }

    /* ── 3 · POR DÓNDE EMPEZAR · en primera persona, y sin ordenar nada ──────────────────────────────────── */
    if (foco && foco.filas.length) {
      const primero = foco.filas[0].fila.nombre;   // la primera EN EL ORDEN DEL CUADRO: la que más pesa
      const cifraPrimero = _cifraDeSenal(foco.filas[0]);
      const conCifra = cifraPrimero ? ` (${cifraPrimero})` : "";
      p.push(variante(semilla, [
        `Por dónde empezaría yo: ${primero}${conCifra}, la de más peso entre las señaladas. ¿La abro?`,
        `Si vas a mirar una sola, miraría ${primero}${conCifra}: pesa más que el resto de las señaladas. ¿Te la abro?`,
        `Yo partiría por ${primero}${conCifra} — es la mayor de las que este cuadro marca. Dime y la abrimos.`,
      ]));
    } else {
      p.push(variante(semilla, [
        `Si quieres, te abro cualquiera de esas filas por dentro.`,
        `Dime por cuál fila seguimos y la abro.`,
        `Puedo abrirte el detalle de la que te interese.`,
      ]));
    }
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

    /* (4) EL CUADRO NO SE RECITA (owner 2026-09-08: «puede citar 2-4 cifras clave, no todas las filas… si el
     * cuadro ya muestra la tabla, ADI debe aportar interpretación, no duplicarla»). Se mide contra las FILAS
     * del propio cuadro: nombrar más de cinco es volver a servir la tabla que el usuario tiene al lado. Solo
     * aplica cuando el cuadro tiene filas de sobra — un cuadro de tres filas se puede nombrar entero. */
    const nombresTodos = (c.L.filas || []).map((f) => f.nombre).filter((n) => n && n.length >= 3);
    if (nombresTodos.length >= 8) {
      const nombrados = nombresTodos.filter((n) => new RegExp(`\\b${_esc(n)}`, "i").test(t)).length;
      if (nombrados > 5) v.push({ regla: "cuadro-recitado", multa: `nombras ${nombrados} de las ${nombresTodos.length} filas del cuadro: eso es la tabla otra vez, y la tabla ya está en pantalla. Quédate con 2-4 cifras clave y aporta la lectura que las filas no dicen solas.` });
    }

    /* (5) LO QUE LA PANTALLA YA DICE NO SE REPITE TEXTUAL. La frase del módulo está impresa bajo el cuadro;
     * copiarla es duplicar, no interpretar. Se juzga el CALCO literal (>25 caracteres), jamás la idea: decir lo
     * mismo con otras palabras y más lectura es exactamente el trabajo. */
    for (const tx of (c.L.textos || [])) {
      if (tx.clave !== "lectura" && tx.clave !== "resumenTope") continue;
      if (tx.texto && tx.texto.length > 25 && t.includes(tx.texto)) {
        v.push({ regla: "cuadro-calcado", multa: `copias textual la frase que el propio cuadro ya muestra en pantalla («${tx.texto.slice(0, 60)}…»): aporta interpretación, no duplicación.` });
        break;
      }
    }
    return v;
  },
};

/** solo para los candados: vacía el memo de una ranura entre casos. */
export function _olvidarMemoDelCuadro() { _memo = null; }
