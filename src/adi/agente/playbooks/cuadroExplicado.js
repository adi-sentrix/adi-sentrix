/* === src/adi/agente/playbooks/cuadroExplicado.js · EXPLICAR EL CUADRO, EL MISMO PARA TODAS LAS CARAS =========
 *
 * LA ESPECIFICACIÓN DEL OWNER, en tres entregas del mismo día (2026-09-08), cada una corrigiendo la anterior:
 *
 *   1 · EL ANCLA — «El botón no manda solo texto. Manda el ancla completa del cuadro que el usuario está
 *       viendo… ADI debe responder ese cuadro, no una pregunta libre ni un ranking genérico. Hazlo transversal
 *       para todas las caras, no parche por cuadro.»
 *   2 · INTERPRETAR — «"Que ADI lo explique" no debe repetir el cuadro… el botón debe usar el cuadro como
 *       evidencia, no como texto a recitar. Objetivo: que el usuario entienda algo que no veía solo mirándolo.»
 *   3 · EL RESUMEN EJECUTIVO POR COLUMNA — «tienes participación, tienes venta y contribución, tienes el
 *       margen, año anterior y presupuesto si existe — no todos tendrán ese dato. En la participación podrías
 *       decirme breve qué está pasando, lo mismo con el resto, explicarme caídas: lo que debe entenderse es un
 *       RESUMEN EJECUTIVO de esa tabla. Y si el usuario quiere profundizar debes seguir: te podría decir
 *       "profundiza en la contribución, o en la participación".»
 *
 * ── QUÉ LO ABRE ───────────────────────────────────────────────────────────────────────────────────────────
 * (a) EL CLICK: `ctx.cuadro` — el canal explícito, consumido una vez. El AMBIENTE jamás lo abre: sigue
 *     publicado mientras la Mesa está abierta, y abrirlo por ambiente haría que la siguiente pregunta escrita
 *     a mano se respondiera como un botón. Un click, un turno.
 * (b) LA PROFUNDIZACIÓN: «profundiza en la contribución» en el turno SIGUIENTE. El ancla del click queda en la
 *     memoria del hilo (`mem.cuadroAbierto`, lo escribe el bucle al cerrar un turno de cuadro) y SOLO una
 *     pregunta con forma de profundización la reabre — nunca una pregunta libre: la memoria desambigua, no
 *     secuestra. Caduca a las 8 entradas de hilo, el mismo criterio del contexto de pantalla.
 *
 * ── POR QUÉ NO ES UN PARCHE POR CUADRO ────────────────────────────────────────────────────────────────────
 * Cero ramas por componente. El manifiesto declara la identidad; `lecturaDeCuadro` trae cifras (con el crudo
 * del builder al lado), señales y textos; y acá vive UNA explicación por FORMA (tabla · barra · serie · kpi) y
 * UNA por COLUMNA para profundizar. Un cuadro nuevo queda explicado el día que se declara.
 *
 * ── CÓMO SE INTERPRETA SIN CALCULAR ───────────────────────────────────────────────────────────────────────
 * Tres materiales, ninguno aritmético:
 *   · las SEÑALES que el módulo ya puso en cada fila (quién cae, quién está bajo el benchmark, quién crítico);
 *   · el ORDEN: ordenar filas por el crudo QUE EL BUILDER PUBLICA y leer posiciones («Jumbo deja más
 *     contribución que Lider, vendiendo menos») — se comparan dos cifras autorizadas, no se crea ninguna;
 *   · los TEXTOS del propio módulo. Los conteos de cada grupo de señal viajan autorizados en la boleta.
 * Empates del redondeo no se leen como diferencias: dos crudos iguales no autorizan un «más que».
 *
 * ── LA PRECEDENCIA ────────────────────────────────────────────────────────────────────────────────────────
 * Va DESPUÉS de `ask-de-cuadro` en el registro: las cuatro formas de Capital conservan su anclaje pulido y
 * gateado. Éste toma todo lo demás.
 *
 * PURO · determinístico · sin red. Cifras VERBATIM de la lectura del módulo: selecciona y ordena, jamás suma. */
import { lecturaDeCuadro } from "../../sentrix/lecturaDeCuadro.js";
import { getTenantId } from "../../../data/tenantStore.js";
import { VIEW_MANIFEST } from "../../sentrix/viewManifest.js";
import { variante } from "../variacion.js";

const _esc = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/* ── LA PROFUNDIZACIÓN · qué columna pide el usuario ───────────────────────────────────────────────────────
 * LÉXICO y cerrado, como todo detector de playbook: un verbo de profundizar + el nombre de una columna del
 * vocabulario de la casa. Sin verbo no abre (una pregunta libre sobre margen es de otro playbook); sin columna
 * tampoco (profundizar «en Falabella» es de la ficha, no de acá). */
const _VERBO_PROFUNDIZAR = /\b(?:profundiza(?:r|me|mos)?|profundicemos|detalla(?:me)?|des[gl]osa(?:me)?|[aá]breme|ampl[ií]a(?:me)?)\b/i;
const _COLUMNAS = [
  { re: /\bparticipaci[oó]n\b|\bpeso\b/i, clave: "peso", dicho: "la participación" },
  { re: /\bcontribuci[oó]n\b/i, clave: "contribucion", dicho: "la contribución" },
  { re: /\bm[aá]rgen(?:es)?\b|\bmargen\b/i, clave: "margen", dicho: "el margen" },
  { re: /\bventas?\b/i, clave: "venta", dicho: "la venta" },
  { re: /\bpresupuesto\b/i, clave: "vsPresupuestoPct", dicho: "el presupuesto" },
  { re: /\ba[ñn]o anterior\b/i, clave: "vsAnteriorPct", dicho: "el año anterior" },
  { re: /\bca[ií]das?\b/i, clave: "_caidas", dicho: "las caídas" },
  { re: /\bvencid[oa]s?\b|\bsaldo vencido\b/i, clave: "vencido", dicho: "el saldo vencido" },
  { re: /\bsaldos?\b/i, clave: "saldo", dicho: "el saldo pendiente" },
  { re: /\babonad?os?\b/i, clave: "abonado", dicho: "lo abonado" },
  { re: /\bcapital\b/i, clave: "capital", dicho: "el capital" },
  { re: /\brotaci[oó]n\b/i, clave: "rotacion", dicho: "la rotación" },
  { re: /\bd[ií]as de inventario\b/i, clave: "doh", dicho: "los días de inventario" },
  { re: /\bacumulad[oa]\b|\b80\s?\/?\s?20\b|\bconcentraci[oó]n\b/i, clave: "acumulado", dicho: "la concentración" },
];
function _columnaPedida(q) {
  const s = String(q || "");
  if (!_VERBO_PROFUNDIZAR.test(s)) return null;
  for (const c of _COLUMNAS) if (c.re.test(s)) return c;
  return null;
}

/* ── EL ANCLA DEL TURNO ────────────────────────────────────────────────────────────────────────────────────
 * Del CLICK (`ctx.cuadro`, un ViewContext sellado) o — solo para una profundización — de la memoria del hilo
 * (`ctx.mem.cuadroAbierto`, escrita por el bucle al cerrar el turno anterior de cuadro). */
function _anclaDelClick(ctx) {
  const c = ctx && ctx.cuadro && typeof ctx.cuadro === "object" ? ctx.cuadro : null;
  if (!c) return null;
  const componentId = typeof c.componentId === "string" ? c.componentId : "";
  if (!componentId || !VIEW_MANIFEST[componentId]) return null;
  /* el contexto AMBIENTE de una vista identifica la pantalla, no una pieza: no abre explicaciones */
  if (VIEW_MANIFEST[componentId].tipo === "vista") return null;
  const controles = { ...(c.controles || {}) };
  if (c.seleccion && c.seleccion.modo === "filtro" && c.seleccion.filtro) Object.assign(controles, c.seleccion.filtro);
  if (c.filtros && typeof c.filtros === "object") Object.assign(controles, c.filtros);
  return { componentId, escenario: typeof c.escenario === "string" ? c.escenario : null, controles };
}
export const CUADRO_ABIERTO_TTL_ENTRADAS = 8;   // mismo criterio de caducidad que el contexto de pantalla
function _anclaDeMemoria(pregunta, ctx) {
  if (!_columnaPedida(pregunta)) return null;   // la memoria SOLO desambigua una profundización, jamás secuestra
  const m = ctx && ctx.mem && ctx.mem.cuadroAbierto && typeof ctx.mem.cuadroAbierto === "object" ? ctx.mem.cuadroAbierto : null;
  if (!m || typeof m.componentId !== "string" || !VIEW_MANIFEST[m.componentId]) return null;
  const largo = Array.isArray(ctx.history) ? ctx.history.length : 0;
  if (typeof m.turno === "number" && largo - m.turno > CUADRO_ABIERTO_TTL_ENTRADAS) return null;   // caducó
  return { componentId: m.componentId, escenario: null, controles: (m.controles && typeof m.controles === "object") ? { ...m.controles } : {} };
}

/** el ancla que el BUCLE persiste en la memoria del hilo al cerrar un turno de cuadro — una sola derivación. */
export function anclaDelCuadro(ctx) { return _anclaDelClick(ctx); }

/* memo de UNA ranura: en un turno, toda la cadena del playbook pide la misma lectura. */
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

/** el caso del turno: { ancla, L, columna } — o null si este turno no es de un cuadro. */
function _caso(pregunta, ctx, scenario) {
  const a = _anclaDelClick(ctx) || _anclaDeMemoria(pregunta, ctx);
  if (!a) return null;
  const L = _leer(a, scenario);
  /* `ok`, o el DATO no lo sostiene (`sin-modulo`/`sin-campo`): ahí se dice qué falta. Con `sin-cifras` —límite
   * del lector, no del negocio— no se abre: jamás decirle al usuario que su dato no trae algo que sí trae. */
  if (!L.ok && L.motivo !== "sin-modulo" && L.motivo !== "sin-campo") return null;
  return { ancla: a, L, columna: _columnaPedida(pregunta) };
}

/* ── LOS RÓTULOS DE LA COMPARACIÓN, en palabras de negocio ─────────────────────────────────────────────── */
const CONTRA = {
  anterior: "contra el mismo período del año anterior", presupuesto: "contra tu presupuesto",
  benchmark: "contra tu benchmark", meta: "contra tu meta", promedio_cartera: "contra el promedio de tu cartera",
  vara_usuario: "contra la referencia que declaraste", estado: "contra el estado de cada fila",
};

const _principal = (f) => (f.cifras.find((c) => c.clave === "principal") || f.cifras[0] || null);
const _cifra = (f, clave) => f.cifras.find((c) => c.clave === clave) || null;
const _texto = (L, clave) => (L.textos || []).find((t) => t.clave === clave) || null;
const _cab = (L, clave) => (L.cabecera || []).find((c) => c.clave === clave) || null;
const _plural = (eje) => (eje === "cliente" ? "cuentas" : eje === "sku" ? "SKU" : eje === "familia" ? "familias"
  : eje === "marca" ? "marcas" : eje === "bodega" ? "bodegas" : eje === "canal" ? "canales" : "filas");

/* ── LOS GRUPOS DE SEÑAL · las filas agrupadas por el veredicto del módulo ──────────────────────────────── */
function _gruposDeSenal(filas) {
  const por = new Map();
  for (const f of filas) for (const s of (f.senales || [])) {
    if (!s.alerta) continue;
    if (!por.has(s.clave)) por.set(s.clave, { clave: s.clave, dice: s.dice, dicen: s.dicen || s.dice, filas: [] });
    por.get(s.clave).filas.push({ fila: f, valor: s.valor || null });
  }
  /* de menos a más filas: la señal que toca 4 de 13 es un hallazgo; la que toca 11 es una condición */
  return [...por.values()].sort((a, b) => a.filas.length - b.filas.length);
}

/** la cifra con que se nombra a una señalada: la de la señal, o la columna que habla de ese estado, o la principal */
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

/* ── ORDENAR POR EL CRUDO DEL BUILDER · posiciones, no aritmética ───────────────────────────────────────── */
function _ordenadasPor(filas, clave) {
  const con = filas.map((f) => ({ f, c: _cifra(f, clave) })).filter((x) => x.c && typeof x.c.raw === "number");
  if (con.length < 2) return null;
  return [...con].sort((a, b) => b.c.raw - a.c.raw);
}
/** «vende menos y deja más»: el mejor par invertido entre dos columnas, con crudos DISTINTOS (un empate del
 *  redondeo no autoriza un «más que»). Devuelve { gana, pierde } o null. */
function _inversion(filas, claveOrden, claveValor) {
  const orden = _ordenadasPor(filas, claveOrden);
  if (!orden) return null;
  for (let i = 0; i < orden.length - 1; i++) {
    for (let j = i + 1; j < orden.length; j++) {
      const a = _cifra(orden[i].f, claveValor), b = _cifra(orden[j].f, claveValor);
      if (!a || !b || typeof a.raw !== "number" || typeof b.raw !== "number") continue;
      if (b.raw > a.raw && b.valor !== a.valor) return { gana: { fila: orden[j].f, v: b }, pierde: { fila: orden[i].f, v: a } };
    }
  }
  return null;
}

/** la inversión DICHA con cada cifra pegada a su métrica («con venta $17.3M deja $4.2M de contribución») —
 *  sin las ventas de las dos filas no se dice: una comparación a medias confunde más de lo que aporta. */
function _lineaDeInversion(inv, dicho) {
  const vG = _cifra(inv.gana.fila, "venta"), vP = _cifra(inv.pierde.fila, "venta");
  if (!vG || !vP) return null;
  return `${inv.gana.fila.nombre}, con venta ${vG.valor}, deja ${inv.gana.v.valor} de ${dicho.replace(/^l[ao]s? /, "")}; ${inv.pierde.fila.nombre} vende ${vP.valor} y deja ${inv.pierde.v.valor}.`;
}

export const cuadroExplicado = {
  nombre: "cuadro-explicado",

  cuandoAplica(pregunta, ctx) {
    if (!String(pregunta || "").trim()) return false;
    try { return _caso(pregunta, ctx, null) !== null; } catch { return false; }
  },

  pasos(pregunta, ctx) {
    const c = _caso(pregunta, ctx, null);
    if (!c) return [];
    const m = VIEW_MANIFEST[c.ancla.componentId];
    /* ⚠️ UN SOLO PASO, MEDIDO: sumar la `evidencia` del manifiesto puso dos figs del mismo valor y distinta
     * procedencia en la misma boleta (el total del cuadro vs el de `trend`, declarado `divergent`) y el muro
     * vetó el turno entero — la regla de la casa funcionando. Con el cuadro anclado la fuente es UNA: la que
     * el usuario mira. El cerebro conserva la caja completa para las rondas siguientes. */
    return [{
      tool: "cuadroSentrix",
      args: { componentId: c.ancla.componentId, ...(Object.keys(c.ancla.controles).length ? { controles: c.ancla.controles } : {}) },
      para: `el cuadro «${m.label}» de la cara ${c.L.identidad ? c.L.identidad.cara : m.vista} tal como está en pantalla: identidad, señales y SUS cifras, del mismo módulo que lo pinta`,
    }];
  },

  obligatorias(pregunta, ctx) {
    const c = _caso(pregunta, ctx, null);
    if (!c) return [];
    if (!c.L.ok) return [/.*/];   // el declive no promete cifras: promete la razón, y esa siempre está
    const cuadro = c.L.identidad.cuadro;
    if ((c.L.cabecera || []).length) return [new RegExp(`^${_esc(cuadro)} · `)];
    const f0 = (c.L.filas || [])[0];
    return f0 ? [new RegExp(`^${_esc(f0.nombre)} · `)] : [/.*/];
  },

  entregable(pregunta, ctx) {
    const c = _caso(pregunta, ctx, null);
    if (!c) return "la explicación del cuadro que el usuario está mirando.";
    if (!c.L.ok) {
      return `el usuario pidió «${(c.L.identidad && c.L.identidad.cuadro) || "un cuadro"}» y ese cuadro no tiene con qué responderse en esta carga: DILE EXACTAMENTE QUÉ FALTA, en una o dos líneas, y ofrécele lo que sí puedes abrirle. Jamás sirvas otro corte en su lugar.`;
    }
    const I = c.L.identidad;
    const cab = [
      `${c.columna ? `PROFUNDIZA EN ${c.columna.dicho.toUpperCase()} DEL` : "EXPLICA EL"} CUADRO «${I.cuadro}» de la cara ${I.cara}`,
      I.metricaLabel ? `mide ${String(I.metricaLabel).toLowerCase()}` : null,
      I.eje ? `por ${I.eje}` : null,
      I.periodo ? `período ${I.periodo}` : null,
      c.L.corte ? `corte activo «${c.L.corte.label}»` : null,
      I.comparacion ? (CONTRA[I.comparacion] || `contra ${I.comparacion}`) : null,
    ].filter(Boolean).join(" · ");
    if (c.columna) {
      return [
        `${cab}.`,
        `El usuario ya vio el resumen y quiere ESA dimensión por dentro: qué está pasando ahí, quiénes la mueven, quiénes la deterioran, y qué mirarías primero. Extremos y señalados con su cifra — no la columna entera recitada.`,
      ].join(" ");
    }
    return [
      `${cab}.`,
      "Entrega un RESUMEN EJECUTIVO de la tabla, dimensión por dimensión — participación, venta, contribución, margen, y las comparaciones que EXISTAN en el cuadro (año anterior, presupuesto): una línea breve por cada una diciendo qué está pasando ahí, no el dato pelado. Las columnas que este dato no trae, ni las nombres.",
      "El cuadro es tu EVIDENCIA, no un texto a recitar: la tabla ya está en pantalla. Lo tuyo es lo que las filas no dicen solas — quiénes cargan cada señal, si son los mismos por los dos lados, qué tapa el total, dónde hay una anomalía. Cierra con qué implica para el negocio y por dónde empezar.",
      "Cita pocas cifras clave por dimensión, jamás todas las filas, y no repitas la frase que el propio cuadro ya muestra. Si el usuario después pide profundizar en una dimensión («profundiza en la contribución»), sigue sobre ESTE cuadro: la herramienta cuadroSentrix te lo trae de nuevo.",
      "La medida del éxito: que entienda algo que no veía solo mirando el cuadro.",
    ].join(" ");
  },

  /* ── EL ENTREGABLE DETERMINÍSTICO · resumen ejecutivo por dimensión, o la dimensión por dentro ──────────── */
  componer({ pregunta, semilla, ctx, scenario } = {}) {
    const c = _caso(pregunta, ctx, scenario);
    if (!c) return null;
    const L = c.L;

    /* el declive honesto: el cuadro está en pantalla y el dato no lo sostiene */
    if (!L.ok) {
      const I = L.identidad || {};
      const p = [`Ese cuadro no tiene con qué responderse en esta carga: ${L.falta}`];
      if (I.cara) p.push(`Puedo abrirte lo que la cara ${I.cara} sí tiene medido, o el cuadro que quieras señalarme.`);
      return p.join("\n");
    }

    const I = L.identidad;
    const nEje = _plural(I.eje);
    const uni = _cab(L, "n") || _cab(L, "entidadesReales");
    const universo = uni && Number.isFinite(Number(uni.valor)) ? Number(uni.valor) : L.filas.length;
    const grupos = _gruposDeSenal(L.filas);

    /* ═══ LA PROFUNDIZACIÓN · una dimensión por dentro ═══════════════════════════════════════════════════ */
    if (c.columna) {
      const p = [];
      if (c.columna.clave === "_caidas") {
        const caen = grupos.filter((g) => /^vs/.test(g.clave));
        if (!caen.length) return `Este cuadro no marca ninguna caída: no trae comparación contra otro período, o ninguna fila cae.`;
        for (const g of caen) p.push(`Las que ${g.dicen}: ${_conCifra(g.filas, 5)}.`);
        const total = (L.cabecera || []).find((x) => /^total\.vs.*Pct$/.test(x.clave));
        if (total) p.push(`El total del cuadro, mientras tanto, va ${total.valor} — por eso estas caídas no se ven en el número grande.`);
        p.push(variante(semilla, [`¿Abrimos la primera?`, `Dime cuál te abro por dentro.`, `¿Seguimos por alguna de ellas?`]));
        return p.join("\n");
      }
      const orden = _ordenadasPor(L.filas, c.columna.clave);
      if (!orden) {
        const traen = [...new Set(L.filas.flatMap((f) => f.cifras.map((x) => x.label)))].slice(0, 6);
        return `Este cuadro no trae ${c.columna.dicho} como columna. Lo que sí trae: ${traen.join(" · ")}. Dime por cuál seguimos.`;
      }
      const arriba = orden.slice(0, 3), abajo = orden.slice(-2);
      p.push(`${c.columna.dicho[0].toUpperCase()}${c.columna.dicho.slice(1)} de este cuadro, por dentro:`);
      p.push(`Arriba: ${arriba.map((x) => `${x.f.nombre} ${x.c.valor}`).join(" · ")}.`);
      if (orden.length > 4) p.push(`Abajo: ${abajo.map((x) => `${x.f.nombre} ${x.c.valor}`).join(" · ")}.`);
      /* las señaladas de ESTA dimensión, si el módulo marcó alguna */
      const marcadas = grupos[0] && grupos[0].filas.filter((x) => _cifra(x.fila, c.columna.clave));
      if (marcadas && marcadas.length && grupos[0].filas.length < L.filas.length) {
        p.push(`Y de las que el cuadro marca (${grupos[0].dicen}): ${marcadas.slice(0, 3).map((x) => `${x.fila.nombre} ${(_cifra(x.fila, c.columna.clave) || {}).valor || ""}`.trim()).join(" · ")}.`);
      }
      /* ⚠️ CADA CIFRA AL LADO DE SU MÉTRICA — medido: «Jumbo deja $4.2M … vendiendo menos» hizo que el notario
       * leyera el $4.2M como VENTA (la palabra manda en la ventana) y vetara el turno. La inversión se dice con
       * las cuatro cifras, cada una pegada a su concepto; sin las ventas de ambas filas, no se dice. */
      const inv = c.columna.clave !== "venta" ? _inversion(L.filas, "venta", c.columna.clave) : null;
      const invLinea = inv && _lineaDeInversion(inv, c.columna.dicho);
      if (invLinea) p.push(`Lo que no se ve a simple vista: ${invLinea}`);
      p.push(variante(semilla, [
        `¿Sigo por alguna de estas, o te abro otra dimensión del cuadro?`,
        `Puedo abrirte una de estas cuentas, u otra dimensión del cuadro.`,
        `Dime si profundizamos en una fila o en otra columna.`,
      ]));
      return p.join("\n");
    }

    /* ═══ EL RESUMEN EJECUTIVO ═══════════════════════════════════════════════════════════════════════════ */
    const p = [];

    if (I.tipo === "barra") {
      const cruce = _texto(L, "cruce80");
      const filaCruce = cruce ? L.filas.find((f) => f.nombre === cruce.texto) : null;
      const acum = filaCruce ? _cifra(filaCruce, "acumulado") : null;
      const cola = L.filas.find((f) => /^cola\b/i.test(f.nombre));
      const primera = L.filas.find((f) => !/^cola\b/i.test(f.nombre));
      const met = I.metricaDicha || "lectura";
      if (uni && cruce) p.push(`El 80% de tu ${met} se completa en ${cruce.texto}${acum ? ` (acumulado ${acum.valor})` : ""}, de ${uni.valor} ${nEje} en total.`);
      if (primera && _principal(primera)) p.push(`${primera.nombre} sola pone ${_principal(primera).valor}${cola && _principal(cola) ? `; toda la cola junta, ${_principal(cola).valor}` : ""}.`);
      p.push(`Lo que implica: tu ${met} depende de muy pocas ${nEje}. Un movimiento arriba mueve el año; uno abajo casi no se nota.`);
      p.push(variante(semilla, [
        `Si quieres profundizar, dime en cuál — o en la concentración misma.`,
        `Puedo profundizar en cualquiera de ellas cuando digas.`,
        `Dime por cuál seguimos y la abro.`,
      ]));
      return p.join("\n");
    }

    if (I.tipo === "serie") {
      const tot = _cab(L, "totalActual") || _cab(L, "total");
      const cum = _cab(L, "cumplimiento");
      const alto = _cab(L, "max") || _cab(L, "pico"), bajo = _cab(L, "min") || _cab(L, "valle");
      const linea = [tot ? `El período cierra en ${tot.valor}` : null, cum ? `${cum.valor} del plan` : null].filter(Boolean);
      if (linea.length) p.push(`${linea.join(", ")}.`);
      const _filaDe = (cifra) => cifra && L.filas.find((f) => { const pr = _principal(f); return pr && pr.valor === cifra.valor; });
      const fAlto = _filaDe(alto), fBajo = _filaDe(bajo);
      if (alto && bajo) p.push(`Entre el mes más alto (${fAlto ? `${fAlto.nombre}, ` : ""}${alto.valor}) y el más bajo (${fBajo ? `${fBajo.nombre}, ` : ""}${bajo.valor}) la distancia es grande: tu año no es parejo, así que planificar con el promedio te va a fallar en los dos extremos.`);
      if (L.filasLlave === "series" && L.filas.length > 1) p.push(`Las series del cuadro: ${L.filas.slice(0, 3).map((f) => `${f.nombre} ${(_principal(f) || {}).valor || ""}`.trim()).join(" · ")}.`);
      p.push(variante(semilla, [
        `¿Te abro algún mes, o la serie contra el presupuesto?`,
        `Puedo profundizar en un mes puntual si quieres.`,
        `Dime dónde profundizamos.`,
      ]));
      return p.join("\n");
    }

    if (I.tipo === "kpi") {
      const v = _cab(L, "principal");
      const pie = _texto(L, "pie") || _texto(L, "linea");
      if (v) p.push(`${I.cuadro}: ${v.valor}${pie ? ` — ${pie.texto}` : ""}.`);
      p.push(variante(semilla, [`¿Lo abrimos por dentro?`, `¿Te muestro qué hay detrás de esa cifra?`, `Puedo abrirte su detalle.`]));
      return p.join("\n");
    }

    /* ── tabla · lista · tira — EL RESUMEN EJECUTIVO POR DIMENSIÓN (la tercera entrega del owner) ────────── */
    /* 1 · EL MARCO: cuántas, cuánto suma, y cómo viene el total */
    const totalCifra = (L.cabecera || []).find((x) => /^total\./.test(x.clave) && !/Pct|peso/.test(x.clave))
      || _cab(L, "totalVenta") || _cab(L, "usd") || _cab(L, "capital") || _cab(L, "suma");
    const deltaAnt = (L.cabecera || []).find((x) => x.clave === "total.vsAnteriorPct");
    const deltaPre = (L.cabecera || []).find((x) => x.clave === "total.vsPresupuestoPct");
    if (totalCifra) {
      const deltas = [deltaAnt ? `${deltaAnt.valor} vs año anterior` : null, deltaPre ? `${deltaPre.valor} vs presupuesto` : null].filter(Boolean);
      /* «$135K en total» ponía la coletilla de CONJUNTO detrás de la cifra y el muro la juzga como tal (regla
       * total-sin-declarar): una coincidencia de canon con un crudo de la carpeta le dio dueño y vetó el turno.
       * La métrica dicha después de la cifra («$135K de capital») dice lo mismo sin reclamar el conjunto. */
      const deQue = (totalCifra.label || "").replace(/s*·s*total/i, "").replace(/s*totals*/i, " ").trim().toLowerCase() || I.metricaDicha || "";
      p.push(`El marco: ${universo} ${nEje}, ${totalCifra.valor}${deQue ? ` de ${deQue}` : ""}${deltas.length ? ` (${deltas.join(" · ")})` : ""}.`);
    }

    /* 2 · PARTICIPACIÓN / CONCENTRACIÓN: qué tan repartido está */
    const grupoN = _cab(L, "grupoN"), grupoPct = _cab(L, "grupoPct");
    const cubre = _cab(L, "cubre"), tope = _cab(L, "tope");
    const primeraFila = L.filas[0], pesoPrimera = primeraFila && _cifra(primeraFila, "peso");
    if (grupoN && grupoPct) {
      p.push(`Participación: ${grupoN.valor} ${nEje} explican el ${grupoPct.valor} — lo que pase ahí es lo que le pasa a tu negocio.`);
    } else if (cubre && tope) {
      p.push(`Participación: las primeras ${tope.valor} cubren el ${cubre.valor}${pesoPrimera ? `; ${primeraFila.nombre} sola pesa ${pesoPrimera.valor}` : ""}.`);
    } else if (pesoPrimera) {
      p.push(`Participación: ${primeraFila.nombre} encabeza con ${pesoPrimera.valor} del total.`);
    }

    /* 3 · CONTRIBUCIÓN: quién deja el valor — y la inversión que la tabla no muestra sola.
     * Cada cifra pegada a su métrica (la lección del binding: «vendiendo menos» junto a un monto de
     * contribución hizo que el notario lo leyera como venta y vetara el turno entero). */
    const inv = _inversion(L.filas, "venta", "contribucion");
    const topContrib = _ordenadasPor(L.filas, "contribucion");
    if (topContrib) {
      const t0 = topContrib[0];
      const invLinea = inv && _lineaDeInversion(inv, "la contribución");
      p.push(`Contribución: la más alta la deja ${t0.f.nombre} (${t0.c.valor}).${invLinea ? ` Y hay una inversión que la tabla no muestra sola: ${invLinea}` : ""}`);
    }

    /* 4 · MARGEN: el rango de la tabla, por el crudo del builder */
    const ordenMargen = _ordenadasPor(L.filas, "margen");
    if (ordenMargen && ordenMargen.length >= 3) {
      const mMax = ordenMargen[0], mMin = ordenMargen[ordenMargen.length - 1];
      if (mMax.c.valor !== mMin.c.valor) p.push(`Margen: va de ${mMax.c.valor} (${mMax.f.nombre}) a ${mMin.c.valor} (${mMin.f.nombre}) — no todas te dejan lo mismo por peso vendido.`);
    }

    /* 5 · LAS CAÍDAS / LA SEÑAL: el hallazgo, con la coincidencia y la excepción */
    const foco = grupos[0] || null;
    if (foco) {
      const cuantas = foco.filas.length;
      const mayoria = universo > 0 && cuantas / universo >= 0.66;
      const dichoFoco = cuantas === 1 ? foco.dice : foco.dicen;
      p.push(mayoria
        ? `La señal: ${cuantas} de ${universo} ${nEje} ${dichoFoco} — no es un caso puntual: pasa en ${cuantas === universo ? "todas" : "casi todas"} tus ${nEje}.`
        : `La señal: ${cuantas} ${dichoFoco} — ${_conCifra(foco.filas, 3)}${cuantas > 3 ? ", entre otras" : ""}.`);
      const otra = grupos.find((g) => g !== foco && g.filas.length);
      if (otra) {
        const A = new Set(foco.filas.map((x) => x.fila.nombre));
        const B = new Set(otra.filas.map((x) => x.fila.nombre));
        const comunes = [...A].filter((x) => B.has(x));
        const soloA = [...A].filter((x) => !B.has(x));
        const soloB = [...B].filter((x) => !A.has(x));
        if (comunes.length >= 2 && soloA.length <= 1) {
          if (soloA.length === 1) p.push(`Y son casi las mismas que ${otra.dicen}, con una excepción: ${soloA[0]} ${foco.dice} pero no ${otra.dice}.`);
          else if (soloB.length === 1) p.push(`Y esas mismas también ${otra.dicen} — ahí se suma ${soloB[0]}, que ${otra.dice} pero no ${foco.dice}.`);
          else if (soloB.length === 0) p.push(`Y son exactamente las mismas que ${otra.dicen}: el deterioro no está repartido, está concentrado ahí.`);
        }
      }
      if (totalCifra && (deltaAnt || deltaPre) && !mayoria) {
        p.push(`El total sube mientras esas ${nEje} bajan: lo que crece arriba tapa lo que cae abajo, y por eso el número grande no te avisa.`);
      }
    }

    /* 6 · POR DÓNDE EMPEZAR — y la puerta a profundizar por dimensión */
    if (foco && foco.filas.length) {
      const primero = foco.filas[0].fila.nombre;
      const cifraPrimero = _cifraDeSenal(foco.filas[0]);
      const conCifra = cifraPrimero ? ` (${cifraPrimero})` : "";
      p.push(variante(semilla, [
        `Por dónde empezaría yo: ${primero}${conCifra}. Y si quieres una dimensión por dentro, dime «profundiza en la contribución» — o en la que te interese.`,
        `Yo partiría por ${primero}${conCifra}. También puedo profundizar en una dimensión: contribución, participación, margen — tú dices.`,
        `Si vas a mirar una sola, miraría ${primero}${conCifra}. Y puedo profundizar en cualquier columna del cuadro cuando digas.`,
      ]));
    } else {
      p.push(variante(semilla, [
        `Puedo profundizar en cualquier dimensión del cuadro — contribución, participación, margen — cuando digas.`,
        `Dime en qué dimensión profundizo, o qué fila te abro.`,
        `¿Profundizamos en alguna dimensión, o te abro una fila?`,
      ]));
    }
    return p.join("\n");
  },

  listaNotarial(texto, { pregunta, ctx } = {}) {
    const t = String(texto || "");
    if (!t.trim()) return [];
    const c = (() => { try { return _caso(pregunta, ctx, null); } catch { return null; } })();
    if (!c || !c.L.ok) return [];
    const I = c.L.identidad;
    const v = [];

    /* (1) EL ANCLAJE NO SE SUELTA: la respuesta nombra filas del cuadro o lo que el cuadro mide. */
    const nombres = (c.L.filas || []).map((f) => f.nombre).filter((n) => n && n.length >= 3);
    if (nombres.length) {
      const nombra = nombres.some((n) => new RegExp(`\\b${_esc(n)}`, "i").test(t));
      const nombraElCuadro = new RegExp(_esc(I.cuadro), "i").test(t) || (I.metricaLabel && new RegExp(`\\b${_esc(I.metricaLabel)}`, "i").test(t));
      if (!nombra && !nombraElCuadro) {
        v.push({ regla: "cuadro-desanclado", multa: `el usuario pidió el cuadro «${I.cuadro}» y tu respuesta no nombra ni una de sus filas ni lo que mide: explica ESE cuadro, no el negocio en general.` });
      }
    }

    /* (2) EL 80/20 SE EXPLICA COMO 80/20. */
    if (I.tipo === "barra" && /concentra/i.test(I.cuadro)) {
      const cruce = _texto(c.L, "cruce80");
      const diceCruce = /\b80\s?%|\b80\/20\b|concentra|acumulad/i.test(t) || (cruce && new RegExp(_esc(cruce.texto), "i").test(t));
      if (!diceCruce) v.push({ regla: "concentracion-sin-explicar", multa: "este cuadro muestra la concentración (el 80/20) y tu respuesta no la explica: di en cuántas cuentas se concentra y dónde se cruza el 80%, no solo el orden." });
    }

    /* (3) EL CUADRO NO CAMBIA DE EJE. */
    const EJES = ["cliente", "sku", "marca", "familia", "bodega", "canal"];
    if (I.eje && EJES.includes(I.eje)) {
      const otro = EJES.filter((e) => e !== I.eje).find((e) => new RegExp(`\\bpor ${e}s?\\b`, "i").test(t));
      if (otro) v.push({ regla: "cuadro-de-otro-eje", multa: `el cuadro es por ${I.eje} y tu respuesta lo lee por ${otro}: ese es otro cuadro y el usuario no lo está mirando.` });
    }

    /* (4) EL CUADRO NO SE RECITA. Un resumen ejecutivo por dimensión nombra filas CON PROPÓSITO (el rango del
     * margen, la inversión de la contribución, las que caen): hasta 8 nombres distintos caben en eso. Pasar de
     * ahí, en un cuadro de 8+ filas, es volver a servir la tabla que el usuario tiene al lado. */
    const nombresTodos = (c.L.filas || []).map((f) => f.nombre).filter((n) => n && n.length >= 3);
    if (nombresTodos.length >= 8) {
      const nombrados = nombresTodos.filter((n) => new RegExp(`\\b${_esc(n)}`, "i").test(t)).length;
      if (nombrados > 8) v.push({ regla: "cuadro-recitado", multa: `nombras ${nombrados} de las ${nombresTodos.length} filas del cuadro: eso es la tabla otra vez, y la tabla ya está en pantalla. Resume por dimensión y quédate con las filas que cargan la historia.` });
    }

    /* (5) LO QUE LA PANTALLA YA DICE NO SE REPITE TEXTUAL. */
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
