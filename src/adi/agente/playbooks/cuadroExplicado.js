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
import { esPorQue } from "../porque.js";   // la ley del porqué, transversal

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
  { re: /\bcumplimiento\b/i, clave: "cumplimiento", dicho: "el cumplimiento del presupuesto" },
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
/* LA CONTINUACIÓN ELÍPTICA · «¿y el cumplimiento del presupuesto?» (owner 2026-09-08: «si preguntan por
 * cumplimiento…»). Abrir por «pregunta corta que nombra una columna» habría secuestrado turnos libres —«¿cómo
 * viene mi margen?» son cuatro palabras y nombra una columna—. El marcador inequívoco es la conjunción de
 * apertura: nadie empieza una pregunta NUEVA con «y». Con eso alcanza, y no se adivina nada. */
const _ABRE_CONTINUANDO = /^\s*[¿¡]?\s*y\s+(?:el|la|los|las|qu[eé]|c[oó]mo|cu[aá]l)?\s*/i;
function _columnaPedida(q) {
  const s = String(q || "");
  if (!_VERBO_PROFUNDIZAR.test(s) && !_ABRE_CONTINUANDO.test(s)) return null;
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
/* ── LA PREGUNTA POR UNA CIFRA QUE ADI ACABA DE DAR (owner 2026-09-08, encontrado en su pantalla) ──────────
 * «¿De dónde sale ese 103%?» — y ADI contestó «esa cifra la saqué sin verificarla», DESDICIÉNDOSE de un número
 * que el cuadro publica y que su propia boleta traía como obligatorio. La causa no fue el muro: fue que ese
 * turno YA NO TENÍA el cuadro. El click se consume en su turno, y «de dónde sale» no era forma de
 * profundización — el cerebro quedó sin la boleta y prefirió retractarse. Desdecirse de una cifra correcta
 * cuesta más confianza que no haberla dicho.
 *
 * El criterio para reabrir es determinístico y no secuestra nada: la pregunta CITA UNA CIFRA que el cuadro
 * abierto publica. Si el usuario nombra un número que está en ese cuadro, habla de ese cuadro. Se pide además
 * que sea CORTA o que traiga marca de procedencia («de dónde», «cómo sale», «por qué», «qué es ese»): una
 * consulta larga que de paso mencione una cifra sigue siendo un turno libre. */
/* ⚠️ SIN `\b` PEGADO A UNA VOCAL ACENTUADA — la lección que el proyecto ya pagó dos veces y que
 * `_agente_contrato_gate` barre: `\bqu[eé]` no casa «qué» porque entre el espacio y la q… casa, pero
 * `qu[eé]\b` NO cierra tras la é (no hay borde `\w`), y `\b[uú]ltimo` nunca abre. Se usa el lookaround
 * explícito, que sí funciona con acentos. */
const _RE_PROCEDENCIA = /(?:^|[^\wáéíóúüñ])(?:de d[oó]nde|c[oó]mo (?:sale|calcul|lleg|obt)|por qu[eé]|qu[eé] es (?:ese|esa|este|esta)|explica(?:me)? (?:ese|esa|el|la))(?![\wáéíóúüñ])/i;
function _cifraCitada(pregunta, L) {
  const q = String(pregunta || "");
  if (!L || !L.ok) return null;
  if (q.length > 140 && !_RE_PROCEDENCIA.test(q)) return null;
  const todas = [...(L.cabecera || []), ...(L.filas || []).flatMap((f) => (f.cifras || []).map((c) => ({ ...c, fila: f.nombre })))];
  /* el match va por el TOKEN VISIBLE y con frontera: «3.1%» no puede encontrarse dentro de «103.1%» */
  for (const c of todas) {
    if (!c.valor || !/\d/.test(c.valor)) continue;
    if (new RegExp(`(?<![\\d.,])${_esc(c.valor)}`, "i").test(q)) return c;
  }
  return null;
}

/* ── EL ELEMENTO NOMBRADO · «febrero es el mes más bajo, ¿por qué?» (owner 2026-09-09, en su pantalla) ──────
 * Con el cuadro del año abierto, esa pregunta caía a «no tengo información» — o peor: el cerebro pedía una
 * herramienta equivocada y la declinación («la métrica venta no está declarada para el eje cliente») salía a
 * pantalla. «Febrero» no es una cifra ni una columna: es un ELEMENTO del cuadro — una fila, o un mes que la
 * lectura del propio módulo nombra. Si el usuario nombra un elemento del cuadro abierto, habla de ese cuadro.
 * Los meses se resuelven con la tabla de la casa (el módulo escribe «Feb»; el usuario, «febrero»). */
const _MESES = [["ene", "enero"], ["feb", "febrero"], ["mar", "marzo"], ["abr", "abril"], ["may", "mayo"],
  ["jun", "junio"], ["jul", "julio"], ["ago", "agosto"], ["sep", "septiembre"], ["oct", "octubre"],
  ["nov", "noviembre"], ["dic", "diciembre"]];
function _elementoCitado(pregunta, L) {
  const q = String(pregunta || "").toLowerCase();
  if (!L || !L.ok) return null;
  for (const f of (L.filas || [])) {
    if (f.nombre && f.nombre.length >= 3 && q.includes(f.nombre.toLowerCase())) return { tipo: "fila", nombre: f.nombre, fila: f };
  }
  /* un mes cuenta como elemento SOLO si el propio cuadro lo nombra. La fuente primera es EL EJE del cuadro
   * (`mesesDelCuadro`: las etiquetas que la pantalla pinta — con eso «abril» es citable aunque ningún texto lo
   * mencione, porque el cuadro lo nombra con su barra); el corpus de lectura queda de respaldo. */
  const corpus = [
    (L.mesesDelCuadro || []).join(" "),
    (L.textos || []).map((t) => t.texto).join(" "),
    (L.filas || []).map((f) => f.nombre).join(" "),
  ].join(" ").toLowerCase();
  for (const [abr, completo] of _MESES) {
    if (!new RegExp(`\\b${abr}`, "i").test(corpus)) continue;
    if (new RegExp(`\\b(?:${completo}|${abr})\\b`, "i").test(q)) return { tipo: "mes", nombre: completo, abr };
  }
  return null;
}
const _PIDE_PORQUE = esPorQue;   // ⚠️ UN SOLO DETECTOR EN LA CASA (owner 2026-09-09): el del módulo de la ley. Tener el propio era tener dos léxicos que podían discrepar sobre la misma frase.

export const CUADRO_ABIERTO_TTL_ENTRADAS = 8;   // mismo criterio de caducidad que el contexto de pantalla
function _anclaDeMemoria(pregunta, ctx) {
  const m = ctx && ctx.mem && ctx.mem.cuadroAbierto && typeof ctx.mem.cuadroAbierto === "object" ? ctx.mem.cuadroAbierto : null;
  if (!m || typeof m.componentId !== "string" || !VIEW_MANIFEST[m.componentId]) return null;
  const largo = Array.isArray(ctx.history) ? ctx.history.length : 0;
  if (typeof m.turno === "number" && largo - m.turno > CUADRO_ABIERTO_TTL_ENTRADAS) return null;   // caducó
  /* ⚠️ EL ESCENARIO VIAJA EN LA MEMORIA, y esto se descubrió midiendo: sin él, la reapertura leía el cuadro con
   * `ESCENARIO_INICIAL` —otra carpeta— y devolvía OTRAS CIFRAS ($99.9M y 103.0% en vez de $100.0M y 103.1%).
   * Es decir: al preguntar por una cifra, ADI habría contestado con la de otro mundo. Una pieza sin su
   * escenario es una pieza de otro cuadro, exactamente lo que todo este contrato existe para impedir. */
  const ancla = { componentId: m.componentId, escenario: typeof m.escenario === "string" ? m.escenario : null,
    controles: (m.controles && typeof m.controles === "object") ? { ...m.controles } : {} };
  /* TRES puertas, las tres determinísticas: la profundización por columna, la pregunta por una cifra que ese
   * cuadro publica, y el ELEMENTO nombrado (una fila, o un mes que la lectura del cuadro nombra). Sin una de
   * las tres, la memoria no abre nada — un turno libre sigue siendo libre. */
  if (_columnaPedida(pregunta)) return ancla;
  const L0 = _leer(ancla, null);
  if (_cifraCitada(pregunta, L0)) return ancla;
  if (_elementoCitado(pregunta, L0)) return ancla;
  return null;
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
  const columna = _columnaPedida(pregunta);
  const citada = columna ? null : _cifraCitada(pregunta, L);
  const elemento = columna || citada ? null : _elementoCitado(pregunta, L);
  return { ancla: a, L, columna, citada, elemento, porQue: _PIDE_PORQUE(pregunta) };
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
const _grupoDe = (grupos, claves) => grupos.find((g) => claves.includes(g.clave)) || null;
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

  /* ── LA TABLA LA PONE SENTRIX (owner 2026-09-08) ────────────────────────────────────────────────────────
   * «La idea no es que ADI vuelva a hacer las tablas; si ese es el caso, las agregamos a Sentrix y que sea
   * permanente. Imagina, hace dos tablas diferentes repitiendo datos: lo que el usuario quiere es entender
   * qué ve.» En un turno de cuadro la tabla está AL LADO, en pantalla. Redibujarla gasta el espacio de la
   * interpretación —lo único que ADI aporta ahí— y encima obliga al usuario a comparar dos versiones del
   * mismo dato. El bucle traduce esta bandera a la política del muro, que ya existía.
   * ⚠️ Es de ESTE turno, no una prohibición general: si el usuario pide «hazme una tabla con la venta mes por
   * mes», ese turno no nace de un cuadro y ADI puede hacerla. */
  tablaProhibida: true,

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
    if (c.elemento || c.porQue) {
      return [
        `${cab}.`,
        `El usuario pregunta por ${c.elemento ? `«${c.elemento.nombre}»` : "un porqué"} de ese cuadro. RESPONDE EN TRES PASOS, EN ESTE ORDEN — es el método de la casa para todo porqué de un mes o de una caída:`,
        `(1) EL MECANISMO MEDIDO DEL NEGOCIO, PRIMERO. Lee mesPorDentro en los resultados (unidades, contribución, margen y acciones comerciales de cada mes contra su año, anclados a la formación del margen) y di QUÉ SE MOVIÓ —volumen, margen o acciones comerciales— CON LAS CIFRAS QUE LO SOSTIENEN. Si afirmas «fue volumen y no margen ni acciones», tienes que mostrar las tres: el volumen del mes contra el promedio, el margen del mes contra el del año y la carga de acciones contra la del año. Ejemplo del dueño: «Febrero fue bajo principalmente por volumen: tuvo 360 unidades, bajo el promedio del año; el margen se mantuvo cerca del promedio y las acciones comerciales no saltaron.» Una conclusión sin sus cifras es una opinión con cara de medición, y se veta.`,
        `(2) DESPUÉS TU HIPÓTESIS, MARCADA. Ejemplo del dueño: «Mi hipótesis es que puede haber estacionalidad, porque febrero también fue bajo el año anterior. Pero eso no está probado solo con este dato.» Tu criterio de mundo ES un aporte y se espera — pero va rotulado y hablando del NEGOCIO DEL USUARIO. PROHIBIDO afirmar cómo se comporta un sector, una industria o un mercado («el sector históricamente cae en febrero», «los clientes retail típicamente reducen compras»): no tienes fuente para eso y llega al lector como estadística. Sin fuente declarada, no se dice.`,
        `(3) CIERRA PREGUNTÁNDOLE AL DUEÑO, CONCRETO. No necesitas saberlo todo: lo que falta lo sabe él, y consultarlo bien es la asesoría. Ejemplo del dueño: «¿Febrero suele ser un mes bajo en tu negocio, o ese año pasó algo puntual con clientes grandes, stock o campañas?» Con opciones y nombrando cosas de su negocio —campaña, quiebre de stock, un cliente grande, una negociación, el calendario—. «¿Seguimos?» o «¿te lo abro?» NO son esa pregunta y se vetan.`,
        `El hecho que la serie sí sostiene entra en el paso 2 como señal, no como causa (patronAnual: un extremo que SE REPITE contra el año anterior apunta a estacionalidad; uno nuevo, a algo de este año).`,
      ].join(" ");
    }
    /* el ARCO es el que el owner escribió a mano (2026-09-08) — su texto es el estándar de esta entrega */
    return [
      `${cab}.`,
      "Entrega una LECTURA EJECUTIVA de la tabla, con este arco: (1) la TESIS en una línea — la tensión de fondo, no un dato; (2) el desempeño y QUIÉN lo impulsa; (3) la concentración y qué implica depender de pocas cuentas; (4) la diferencia entre vender más y aportar más, CON su razón (el margen que la explica) y tu juicio de asesor; (5) la calidad del mix — dónde está creciendo respecto del promedio; (6) el deterioro PONDERADO: quiénes caen, y cuál importa más aunque pese poco, porque su margen hace más cara cada venta perdida; (7) una síntesis con las tensiones de fondo y la prioridad reformulada; (8) por dónde profundizarías primero, con tu criterio dicho.",
      "Usa solo las dimensiones que EXISTEN en este cuadro (año anterior y presupuesto pueden no venir: las ausentes ni las nombres). El cuadro es tu EVIDENCIA, no un texto a recitar — la tabla ya está en pantalla; lo tuyo es lo que las filas no dicen solas. Pocas cifras clave por idea, jamás todas las filas, y no repitas la frase que el propio cuadro ya muestra.",
      "NO ARMES UNA TABLA: la tabla ya está en pantalla, al lado de tu respuesta. Repetirla es servir dos veces el mismo dato y gastar el espacio de lo único que aportas, que es la interpretación. Escribe en prosa.",
      "Si el usuario después pide profundizar en una dimensión («profundiza en la contribución»), sigue sobre ESTE cuadro: la herramienta cuadroSentrix te lo trae de nuevo.",
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

    /* ═══ LA PROCEDENCIA · «¿de dónde sale ese 103%?» ════════════════════════════════════════════════════
     * La respuesta correcta es la más simple: esa cifra la publica el cuadro, no la calculó ADI. Y se ofrecen
     * las OTRAS cifras del mismo cuadro para que el usuario vea el marco del que sale. Nunca «déjame corregir»
     * sobre un número verificado: desdecirse de lo cierto cuesta más confianza que no haberlo dicho. */
    if (c.citada) {
      const q = c.citada;
      const otras = (L.cabecera || []).filter((x) => x.valor !== q.valor).slice(0, 3);
      const p = [
        `${q.valor} es ${q.fila ? `${q.label.toLowerCase()} de ${q.fila}` : q.label.toLowerCase()}, del cuadro «${I.cuadro}» de la cara ${I.cara}${I.periodo ? ` (${I.periodo})` : ""}.`,
        `No es una cuenta mía: la publica el mismo módulo que pinta ese cuadro, y es la cifra que estás viendo en pantalla.`,
      ];
      if (otras.length) p.push(`En ese mismo cuadro conviven ${otras.map((x) => `${x.label.toLowerCase()} ${x.valor}`).join(" · ")}.`);
      p.push(variante(semilla, [
        `¿Quieres que abra esa dimensión por dentro?`,
        `Dime si profundizo en esa columna del cuadro.`,
        `Puedo abrirte lo que hay detrás de esa cifra.`,
      ]));
      return p.join("\n");
    }

    /* ═══ EL ELEMENTO NOMBRADO · «febrero es el mes más bajo, ¿por qué?» ═════════════════════════════════
     * La CAUSA no está en el dato — ley de la casa, y se dice. Pero hay un hecho que la serie SÍ sostiene y
     * que cambia la lectura: si el mismo mes fue también el extremo del año anterior, el patrón SE REPITE
     * (huele a estacionalidad del negocio); si no, es de este año. Es un hecho de ORDEN sobre los crudos del
     * builder — ninguna cifra nueva. La hipótesis fina (feriados, días hábiles, tu ciclo) la razona el
     * cerebro con su marca de criterio; el piso entrega el hecho y la puerta. */
    if (c.elemento) {
      const el = c.elemento;
      const p = [];
      if (el.tipo === "mes" && (L.patronAnual || L.porDentro)) {
        const pa = L.patronAnual;
        const esMin = !!(pa && pa.mesMin && el.abr && pa.mesMin.toLowerCase().startsWith(el.abr));
        const esMax = !!(pa && pa.mesMax && el.abr && pa.mesMax.toLowerCase().startsWith(el.abr));
        const cifra = esMin ? _cab(L, "min") : esMax ? _cab(L, "max") : null;
        /* EL MES POR DENTRO (owner 2026-09-09): «el mes más bajo fue porque hubo un incremento en acciones
         * comerciales… bajó la contribución porque ganamos volumen pero perdimos margen. Esas son las cosas que
         * debemos saber, y eso SÍ está en los datos.» Cuando el builder publica los hechos del mes (unidades,
         * contribución, margen, acciones — anclados a la formación del margen de la misma cara), el porqué
         * INTERNO se lee de ahí: qué componente se movió. La causa EXTERNA (calendario, un cliente que compró
         * distinto) sigue sin estar, y se dice. La lectura es por UMBRAL DECLARADO, no por olfato. */
        const pd0 = L.porDentro;
        const pd = pd0 && Array.isArray(pd0.meses)
          ? pd0.meses.find((m) => m && m.mes && el.abr && String(m.mes).toLowerCase().startsWith(el.abr)) : null;
        const EN_LINEA_PP = 0.8;   // a menos de 0.8pp del año, el componente «acompaña»
        const _num = (v) => (typeof v === "number" && Number.isFinite(v) ? v : null);
        const mgMes = pd && _num(pd.margenPct), mgAnio = pd0 && _num(pd0.margenAnioPct);
        const cgMes = pd && _num(pd.cargaPct), cgAnio = pd0 && _num(pd0.cargaAnioPct);
        const mgBajo = mgMes != null && mgAnio != null && mgAnio - mgMes >= EN_LINEA_PP;
        const mgAlto = mgMes != null && mgAnio != null && mgMes - mgAnio >= EN_LINEA_PP;
        const cgAlta = cgMes != null && cgAnio != null && cgMes - cgAnio >= EN_LINEA_PP;
        const volBajo = !!(pd && (pd.esUnidadesMin || (pd0.unidadesProm && pd.unidades < pd0.unidadesProm)));
        /* ── EL MÉTODO DEL PORQUÉ · TRES PASOS, EN ESTE ORDEN (owner 2026-09-09, novena entrega) ───────────
         * «No quiero prohibir que ADI mezcle criterio de mundo; eso es aporte. Pero debe hacerlo con método:
         *  (1) primero el mecanismo MEDIDO del negocio, (2) después la hipótesis del asesor, marcada,
         *  (3) después una pregunta para corroborar con el usuario. ADI no necesita saber todo: si falta
         *  contexto, debe consultar bien al usuario para cerrar la lectura. Eso es asesoría: medir, proponer
         *  hipótesis y validar con el dueño.»
         * Y su condición dura: «si afirma "fue volumen y no margen/acciones", debe MOSTRAR las cifras que
         * sostienen esa lectura». Por eso cada mecanismo de acá viaja con las suyas — el mes contra su año,
         * las tres componentes nombradas. La pregunta del paso 3 apunta a lo que el dato NO tiene y el dueño SÍ
         * sabe (calendario, un cliente grande, stock, una campaña): concreta, con opciones, nunca «¿seguimos?». */
        const _prom = pd0 && Number.isFinite(pd0.unidadesProm) ? pd0.unidadesProm : null;
        const _uds = pd ? `${pd.unidades} unidades${_prom ? ` contra un promedio de ${_prom} en el año` : ""}` : null;
        const _mgVs = pd && pd0 ? `${pd.margenFmt} contra ${pd0.margenAnioFmt} del año` : null;
        const _cgVs = pd && pd0 ? `${pd.cargaFmt} contra ${pd0.cargaAnioFmt}` : null;
        /* PASO 1 · el mecanismo medido, con TODAS las cifras que lo sostienen — nunca la conclusión sola */
        const mecanismo = (() => {
          if (!pd || !pd0) return null;
          if (mgBajo && cgAlta) return `Ese mes cediste margen: las acciones comerciales subieron a ${_cgVs} (${pd.accionesFmt} en total) y el margen quedó en ${_mgVs}, con ${_uds}.`;
          if (mgBajo && pd.esUnidadesMax) return `Ganaste volumen y cediste margen: ${_uds}, con el margen en ${_mgVs} y las acciones comerciales en ${_cgVs} (${pd.accionesFmt}).`;
          if (mgBajo) return `El margen del mes quedó bajo el del año (${_mgVs}) sin que las acciones comerciales se movieran (${_cgVs}): la diferencia vive en el costo o en la mezcla de lo que vendiste, y este cuadro no los separa.`;
          if (mgAlto || (esMax && (pd.esMargenMax || pd.esCargaMin))) return `Y fue bien ganado: el margen quedó en ${_mgVs}${pd.esMargenMax ? " —el mejor del año—" : ""}, con las acciones comerciales en ${_cgVs}${pd.esCargaMin ? " —la carga más baja del año—" : ""}, sobre ${_uds}.`;
          if (volBajo) return `Fue por volumen: ${_uds}. El margen se mantuvo en línea (${_mgVs}) y las acciones comerciales no saltaron (${_cgVs}), así que no es margen cedido ni una entrega comercial puntual.`;
          return `Por dentro: ${_uds}, contribución ${pd.contribucionFmt} (margen ${_mgVs}) y ${pd.accionesFmt} en acciones comerciales (${_cgVs}).`;
        })();
        /* PASO 2 · la hipótesis del asesor, SIEMPRE marcada — y solo sobre el negocio del usuario, jamás una
         * afirmación sobre «el sector» (el owner la vetó: sin fuente declarada, esa frase no se dice) */
        const _comparable = pa ? (/anterior/i.test(pa.serieComparable) ? "el año anterior" : pa.serieComparable) : null;
        const seRepite = pa ? (esMin ? pa.minSeRepite : esMax ? pa.maxSeRepite : false) : false;
        const hipotesis = !pa ? null : (esMin || esMax)
          ? (seRepite
            ? `Mi hipótesis es que hay estacionalidad, porque ${el.nombre} también fue el ${esMin ? "más bajo" : "más alto"} ${_comparable === "el año anterior" ? "el año anterior" : `en ${_comparable}`}. Con este dato solo no está probado: la repetición es una señal, no la causa.`
            : `Mi hipótesis es que esto es de este año y no un patrón: ${_comparable === "el año anterior" ? "el año anterior" : _comparable} el ${esMin ? "piso" : "pico"} fue otro mes. Con este dato solo no está probado.`)
          : null;
        /* PASO 3 · la pregunta concreta al dueño — pide el contexto que el dato no tiene, con opciones */
        const pregunta = (() => {
          const M = el.nombre;
          if (pd && mgBajo && cgAlta) return `¿Esa entrega extra de ${M} fue una negociación puntual con un cliente grande, una campaña planificada, o una corrección de precios?`;
          if (pd && mgBajo && pd.esUnidadesMax) return `¿Ese volumen de ${M} se compró con una promoción declarada, o fue una negociación puntual con un cliente grande?`;
          if (esMax) return `¿Qué hiciste distinto en ${M}: mejor mezcla de productos, menos descuento negociado, o un cliente que compró más caro?`;
          if (seRepite) return `¿${M[0].toUpperCase()}${M.slice(1)} suele ser un mes bajo en tu negocio, o ese año pasó algo puntual con clientes grandes, stock o campañas?`;
          return `¿Qué cambió en ${M}: un cliente grande que no compró, un quiebre de stock, o una campaña que no salió?`;
        })();
        if (esMin || esMax) {
          p.push(`${el.nombre[0].toUpperCase()}${el.nombre.slice(1)} es el ${esMin ? "piso" : "pico"} del año${cifra ? ` (${cifra.valor})` : ""}.`);
          if (mecanismo) p.push(mecanismo);
          else if (c.porQue) p.push(`El porqué exacto no está en este dato: la serie muestra cuánto se vendió cada mes, no qué lo causó.`);
          if (hipotesis) p.push(hipotesis);
          p.push(pregunta);
          return p.join("\n");
        }
        /* un mes que no es extremo: se dice qué lugar ocupa sin inventarle drama — CON las cifras de los
         * extremos, que es lo que ubica al mes (y sin ellas la respuesta quedaba desanclada del cuadro:
         * el propio veto (1) la mataba y el turno caía al rescate — medido con «y julio, ¿por qué?»).
         * El método de tres pasos es el mismo: mecanismo medido → hipótesis marcada → pregunta concreta. */
        const cMax = _cab(L, "max"), cMin = _cab(L, "min");
        const extremos = pa ? ` — esos son ${pa.mesMax || "?"}${cMax ? ` (${cMax.valor})` : ""} y ${pa.mesMin || "?"}${cMin ? ` (${cMin.valor})` : ""}` : "";
        p.push(`${el.nombre[0].toUpperCase()}${el.nombre.slice(1)} no es ni el pico ni el piso de tu año${extremos}.`);
        if (mecanismo) p.push(pd && (pd.esMargenMin || pd.esCargaMax || pd.esUnidadesMax) ? `Pero por dentro sí tiene historia. ${mecanismo}` : mecanismo);
        if (c.porQue) p.push(`${pd ? "El detonante de fondo" : "Y el porqué de cada mes"} no está en este dato: ${pd ? "eso lo sabes tú, y con eso cierro la lectura" : "la serie trae el cuánto, no la causa"}.`);
        p.push(pregunta);
        return p.join("\n");
      }
      /* una FILA nombrada (que ningún playbook anterior tomó) · MISMO MÉTODO DE TRES PASOS: lo medido con sus
       * cifras → lo que este cuadro NO puede sostener → la pregunta concreta al dueño. Para una fila la
       * «hipótesis» honesta es corta: el cuadro localiza dónde pasa, no por qué — así que el peso cae en la
       * pregunta, que es justamente donde el dueño tiene lo que falta. */
      if (el.fila) {
        const pr = _principal(el.fila);
        const otras = (el.fila.cifras || []).filter((x) => x !== pr && x.valor && /\d/.test(x.valor)).slice(0, 2);
        const dichos = (el.fila.senales || []).filter((s) => s.alerta).map((s) => s.dice);
        p.push(`${el.nombre}${pr ? `: ${pr.label.toLowerCase()} ${pr.valor}` : ""}${dichos.length ? ` — ${dichos.slice(0, 2).join(", y ")}` : ""}.`);
        if (otras.length) p.push(`Lo que el cuadro mide de esa cuenta: ${otras.map((x) => `${x.label.toLowerCase()} ${x.valor}`).join(" · ")}.`);
        if (c.porQue) p.push(`Por qué se mueve así no está en este cuadro: localiza dónde pasa, no la causa. Eso lo sabes tú.`);
        p.push(`¿Qué pasó con ${el.nombre}: te compró menos por precio, cambió su mezcla de productos, hubo un quiebre de stock, o entró un competidor?`);
        return p.join("\n");
      }
    }

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
        /* LA DIMENSIÓN PUEDE SER DEL CUADRO ENTERO, NO DE SUS FILAS: el cumplimiento del presupuesto, el total,
         * el universo. Antes se declinaba («este cuadro no trae esa columna») teniendo la cifra en la cabecera
         * — declinar con el dato en la mano es el peor de los errores honestos. */
        const enCabecera = (L.cabecera || []).find((x) => x.clave === c.columna.clave);
        if (enCabecera) {
          const otras = (L.cabecera || []).filter((x) => x.clave !== enCabecera.clave).slice(0, 3);
          const p2 = [`${c.columna.dicho[0].toUpperCase()}${c.columna.dicho.slice(1)} de este cuadro: ${enCabecera.valor}.`];
          if (otras.length) p2.push(`Con el marco al lado — ${otras.map((x) => `${x.label.toLowerCase()} ${x.valor}`).join(" · ")}.`);
          p2.push(variante(semilla, [`¿Seguimos por alguna de esas?`, `Dime cuál abro.`, `Puedo abrirte cualquiera de ellas.`]));
          return p2.join("\n");
        }
        const traen = [...new Set([...(L.cabecera || []), ...L.filas.flatMap((f) => f.cifras)].map((x) => x.label))].slice(0, 6);
        return `Este cuadro no trae ${c.columna.dicho}. Lo que sí trae: ${traen.join(" · ")}. Dime por cuál seguimos.`;
      }
      const arriba = orden.slice(0, 3), abajo = orden.slice(-2);
      p.push(`Así viene ${c.columna.dicho} de este cuadro por dentro.`);
      p.push(`Arriba están ${arriba.map((x) => `${x.f.nombre} con ${x.c.valor}`).join(", ")}.`);
      if (orden.length > 4) p.push(`Abajo quedan ${abajo.map((x) => `${x.f.nombre} con ${x.c.valor}`).join(", ")}.`);
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
      /* EL GAP MANDA SOBRE EL CUMPLIMIENTO (owner 2026-09-08): «es mejor decir un gap sobre ventas que un
       * cumplimiento de 103 — es más ejecutivo». Un gerente lee «+3.0% sobre tu presupuesto» de una; «103.0%
       * del plan» lo obliga a restar 100 en la cabeza. El cumplimiento no se pierde: se contesta cuando lo
       * preguntan, y ahí va con su decimal. */
      const gapPre = _cab(L, "vsPresupuesto");
      const linea = [
        tot ? `El período cierra en ${tot.valor}` : null,
        gapPre ? `${gapPre.valor} sobre tu presupuesto` : (cum ? `${cum.valor} del plan` : null),
      ].filter(Boolean);
      if (linea.length) p.push(`${linea.join(", ")}.`);
      const _filaDe = (cifra) => cifra && L.filas.find((f) => { const pr = _principal(f); return pr && pr.valor === cifra.valor; });
      const fAlto = _filaDe(alto), fBajo = _filaDe(bajo);
      if (alto && bajo) p.push(`Entre el mes más alto (${fAlto ? `${fAlto.nombre}, ` : ""}${alto.valor}) y el más bajo (${fBajo ? `${fBajo.nombre}, ` : ""}${bajo.valor}) la distancia es grande: tu año no es parejo, así que planificar con el promedio te va a fallar en los dos extremos.`);
      if (L.filasLlave === "series" && L.filas.length > 1) p.push(`Las tres series cierran en ${L.filas.slice(0, 3).map((f) => `${f.nombre} ${(_principal(f) || {}).valor || ""}`.trim()).join(" · ")}.`);
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

    /* ── tabla · lista · tira — LA LECTURA EJECUTIVA ────────────────────────────────────────────────────────
     * El owner escribió a mano la lectura que quería (2026-09-08) y esta rama la persigue pieza por pieza:
     * tesis → desempeño y quién lo impulsa → concentración → vender ≠ aportar (CON su razón) → la calidad del
     * mix → el deterioro PONDERADO por margen → síntesis → por dónde profundizar.
     *
     * Su frase clave, la que cambió el criterio: «La Polar merece especial atención, porque aunque representa
     * solo 2.9% de las ventas, tiene el margen más alto entre estas cuentas (34.0%). Perder venta ahí es más
     * costoso para la rentabilidad de lo que su tamaño comercial podría sugerir.» Antes yo priorizaba por
     * TAMAÑO —«la mayor de las que caen»—, que es el criterio ingenuo: el que importa es cuánto cuesta perder
     * ese peso de venta, y eso lo dice el margen. Las dos varas se ofrecen, cada una con su nombre.
     *
     * Todo sale de SELECCIONAR y ORDENAR por crudos que el módulo publica, y de COMPARAR dos cifras
     * autorizadas. Ni una suma: el acumulado del top-3 lo publica la curva de concentración de la misma cara. */
    const _fmtDe = (f, clave) => { const c = _cifra(f, clave); return c ? c.valor : null; };
    const totalFila = (L.cabecera || []).find((x) => /^total\./.test(x.clave) && !/Pct|peso/.test(x.clave))
      || _cab(L, "totalVenta") || _cab(L, "usd") || _cab(L, "capital") || _cab(L, "suma");
    const deltaAnt = (L.cabecera || []).find((x) => x.clave === "total.vsAnteriorPct");
    const deltaPre = (L.cabecera || []).find((x) => x.clave === "total.vsPresupuestoPct");
    const margenMedio = (L.cabecera || []).find((x) => x.clave === "total.margen");
    const met = I.metricaDicha || "venta";

    /* quién IMPULSA · las que más suman contra el período anterior (orden por el crudo del módulo) */
    const impulsan = (_ordenadasPor(L.filas, "vsAnterior") || []).filter((x) => typeof x.c.raw === "number" && x.c.raw > 0);
    /* quiénes CAEN · por señal del módulo, y ordenadas por MARGEN: la de arriba es la más cara de perder */
    const gCaen = _grupoDe(grupos, ["vsAnterior", "vsAnio"]) || _grupoDe(grupos, ["vsPresupuesto"]);
    const caen = gCaen ? gCaen.filas.map((x) => x.fila) : [];
    const caenPorMargen = _ordenadasPor(caen, "margen");
    const gPre = _grupoDe(grupos, ["vsPresupuesto"]);
    const dobles = gPre && gCaen && gPre !== gCaen
      ? gPre.filas.map((x) => x.fila.nombre).filter((n) => caen.some((f) => f.nombre === n)) : [];

    /* ── 1 · LA TESIS · la tensión, en una línea ─────────────────────────────────────────────────────────── */
    const crece = deltaAnt && !/^-|^−/.test(deltaAnt.valor);
    const hayConcentracion = !!(L.concentracion && L.concentracion.length >= 3);
    const hayCalidad = !!(caenPorMargen && margenMedio && caenPorMargen[0] && _cifra(caenPorMargen[0].f, "margen"));
    if (totalFila && deltaAnt) {
      const cabezaTesis = crece ? "Tu cartera está creciendo" : "Tu cartera está cayendo";
      const colaTesis = hayConcentracion && hayCalidad
        ? `, pero el ${crece ? "crecimiento" : "movimiento"} está concentrado y no todas las ventas te están dejando la misma calidad de resultado.`
        : hayConcentracion ? `, pero el ${crece ? "crecimiento" : "movimiento"} está concentrado en muy pocas cuentas.`
        : hayCalidad ? `, pero no todas las ventas te están dejando la misma calidad de resultado.` : ".";
      p.push(`${cabezaTesis}${colaTesis}`);
    }

    /* ── 2 · EL DESEMPEÑO · el total, y quién lo empuja ──────────────────────────────────────────────────── */
    if (totalFila) {
      const deQue = (totalFila.label || "").replace(/\s*·\s*total/i, "").replace(/\s*total\s*/i, " ").trim().toLowerCase() || met;
      const deltas = [deltaAnt ? `${deltaAnt.valor} vs año anterior` : null, deltaPre ? `${deltaPre.valor} vs presupuesto` : null].filter(Boolean);
      p.push(deltas.length
        ? `La ${deQue} llega a ${totalFila.valor} (${deltas.join(" · ")})${impulsan.length ? `, empujada sobre todo por ${impulsan.slice(0, 3).map((x) => `${x.f.nombre} ${x.c.valor}`).join(", ")}` : ""}.`
        : `Tus ${universo} ${nEje} suman ${totalFila.valor}${deQue ? ` de ${deQue}` : ""}.`);
    }

    /* ── 3 · LA CONCENTRACIÓN · el acumulado que publica la curva de la misma cara ───────────────────────── */
    if (L.concentracion && L.concentracion.length >= 3) {
      const tres = L.concentracion.slice(0, 3);
      p.push(`La primera señal es la concentración: ${tres.map((x) => x.nombre).join(", ")} acumulan el ${tres[2].acumulado} de la ${met}. Eso sostiene el crecimiento, y también hace que buena parte de tu resultado dependa de muy pocas cuentas.`);
    } else {
      const grupoN = _cab(L, "grupoN"), grupoPct = _cab(L, "grupoPct");
      if (grupoN && grupoPct) p.push(`La primera señal es la concentración: ${grupoN.valor} ${nEje} explican el ${grupoPct.valor} — lo que pase ahí es lo que le pasa a tu negocio.`);
    }

    /* ── 4 · VENDER ≠ APORTAR · la inversión, con SU RAZÓN ───────────────────────────────────────────────── */
    const inv = _inversion(L.filas, "venta", "contribucion");
    if (inv) {
      const vG = _fmtDe(inv.gana.fila, "venta"), vP = _fmtDe(inv.pierde.fila, "venta");
      const mG = _fmtDe(inv.gana.fila, "margen"), mP = _fmtDe(inv.pierde.fila, "margen");
      if (vG && vP) {
        p.push(`Hay una diferencia entre vender más y aportar más: ${inv.pierde.fila.nombre} vende ${vP} y deja ${inv.pierde.v.valor} de contribución, mientras ${inv.gana.fila.nombre}, con ${vG} de venta, deja ${inv.gana.v.valor}.${mG && mP ? ` La razón está en el margen: ${mG} contra ${mP}.` : ""}`);
        if (mG && mP) p.push(`Yo no miraría solo quién vende más: ${inv.gana.fila.nombre} convierte mejor cada peso vendido en resultado.`);
      }
    }

    /* ── 5 · LA CALIDAD DEL MIX · dónde está creciendo, contra el margen de la cartera ───────────────────── */
    if (margenMedio && impulsan.length >= 2) {
      const mediaRaw = typeof margenMedio.raw === "number" ? margenMedio.raw : parseFloat(String(margenMedio.valor).replace(",", "."));
      const bajoMedia = impulsan.slice(0, 3).map((x) => ({ f: x.f, m: _cifra(x.f, "margen") }))
        .filter((x) => x.m && typeof x.m.raw === "number" && Number.isFinite(mediaRaw) && x.m.raw < mediaRaw);
      if (bajoMedia.length >= 2) {
        p.push(`Y ese crecimiento está viniendo sobre todo de cuentas con margen bajo el promedio de tu cartera (${margenMedio.valor}): ${bajoMedia.map((x) => `${x.f.nombre} ${x.m.valor}`).join(", ")}. Estás expandiendo venta más rápido de lo que mejora la calidad del mix.`);
      }
    }

    /* ── 6 · EL DETERIORO, PONDERADO POR MARGEN ─────────────────────────────────────────────────────────── */
    if (caenPorMargen && caenPorMargen.length) {
      const nombresCaen = caen.map((f) => f.nombre);
      const soloUnLado = nombresCaen.filter((n) => !dobles.includes(n));
      p.push(dobles.length >= 2
        ? `El foco de deterioro está en ${dobles.slice(0, 4).join(", ")}, que caen a la vez contra el año anterior y contra tu presupuesto${soloUnLado.length === 1 ? ` — y se suma ${soloUnLado[0]}, que cae solo contra el año` : soloUnLado.length > 1 ? ` — y se suman ${soloUnLado.slice(0, 3).join(", ")}` : ""}.`
        : `El foco de deterioro está en ${nombresCaen.slice(0, 4).join(", ")}.`);
      const cara = caenPorMargen[0];
      const mCara = _cifra(cara.f, "margen"), pCara = _cifra(cara.f, "peso");
      if (mCara && (!margenMedio || typeof margenMedio.raw !== "number" || mCara.raw > margenMedio.raw)) {
        p.push(`Pero no todas pesan igual: ${cara.f.nombre} merece atención especial porque${pCara ? `, aunque es solo el ${pCara.valor} de tu venta,` : ""} tiene el margen más alto entre las que caen (${mCara.valor}). Perder venta ahí te cuesta más rentabilidad de lo que su tamaño sugiere.`);
      }
    }

    /* ── 6b · LA SEÑAL DE ESTADO, cuando el cuadro no compara contra nada (el corte de Capital, Qué liquidar,
     * el saldo del Flujo): lo que el módulo marcó — crítico, vencido, dónde se concentra el capital — con su
     * mayoría dicha como mayoría y sus nombradas con su cifra. Sin esto, la rama ejecutiva dejaba mudos a los
     * cuadros sin deltas (medido: «El capital por corte» respondía dos líneas sin una sola fila). */
    if ((!caenPorMargen || !caenPorMargen.length) && grupos[0] && grupos[0].filas.length) {
      const g0 = grupos[0];
      const cuantas0 = g0.filas.length;
      const mayoria0 = universo > 0 && cuantas0 / universo >= 0.66;
      const dicho0 = cuantas0 === 1 ? g0.dice : g0.dicen;
      p.push(mayoria0
        ? `Este cuadro marca que ${cuantas0} de ${universo} ${nEje} ${dicho0} — no es un caso puntual: pasa en ${cuantas0 === universo ? "todas" : "casi todas"} tus ${nEje}.`
        : `Este cuadro marca ${cuantas0} que ${dicho0} — ${_conCifra(g0.filas, 3)}${cuantas0 > 3 ? ", entre otras" : ""}.`);
    }

    /* ── 7 · LA SÍNTESIS Y LA PRIORIDAD ─────────────────────────────────────────────────────────────────── */
    if (hayConcentracion && hayCalidad && caenPorMargen && caenPorMargen.length) {
      p.push(`En síntesis: el negocio está sano en crecimiento, pero hay dos tensiones debajo del total — dependencia de pocas cuentas grandes, y deterioro justo en las de mejor margen. La prioridad no es vender más: es proteger las que hoy sostienen el volumen y recuperar donde cada peso vendido deja más.`);
    } else if (totalFila && caenPorMargen && caenPorMargen.length) {
      p.push(`En síntesis: el total no te avisa de lo que está pasando debajo — lo que crece arriba tapa lo que cae abajo.`);
    }

    /* ── 8 · POR DÓNDE PROFUNDIZAR · las dos varas, cada una con su nombre ───────────────────────────────── */
    if ((!caenPorMargen || !caenPorMargen.length) && grupos[0] && grupos[0].filas.length) {
      const primero0 = grupos[0].filas[0];
      const cifra0 = _cifraDeSenal(primero0);
      p.push(variante(semilla, [
        `Por dónde empezaría yo: ${primero0.fila.nombre}${cifra0 ? ` (${cifra0})` : ""}, la de más peso entre las marcadas. ¿La abro?`,
        `Yo partiría por ${primero0.fila.nombre}${cifra0 ? ` (${cifra0})` : ""} — es la mayor de las que este cuadro marca. Dime y la abrimos.`,
        `Si vas a mirar una sola, miraría ${primero0.fila.nombre}${cifra0 ? ` (${cifra0})` : ""}. Y puedo profundizar en cualquier columna del cuadro.`,
      ]));
    } else if (caenPorMargen && caenPorMargen.length) {
      const porMargen = caenPorMargen[0].f.nombre;
      const porTamano = (_ordenadasPor(caen, "venta") || [])[0];
      const segundo = porTamano && porTamano.f.nombre !== porMargen ? porTamano.f.nombre : null;
      p.push(variante(semilla, [
        `Yo profundizaría primero en ${porMargen}${segundo ? ` y ${segundo}` : ""}: la primera por lo que cuesta su margen, ${segundo ? "la segunda por lo que pesa su venta" : ""}. Y puedo abrirte cualquier columna del cuadro cuando digas.`,
        `Por dónde empezaría: ${porMargen}${segundo ? `, y después ${segundo}` : ""} — una por margen, ${segundo ? "otra por tamaño" : ""}. Dime si prefieres que profundice en una dimensión (contribución, participación, margen).`,
        `Si vas a mirar dos, miraría ${porMargen}${segundo ? ` y ${segundo}` : ""}. También puedo profundizar en una columna entera del cuadro.`,
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
      /* CITAR SUS CIFRAS TAMBIÉN ES ESTAR ANCLADO — falso positivo medido en el cuadro del año: sus «filas» son
       * las tres series («Este año», «Año anterior», «Presupuesto»), y una lectura que habla de meses y montos
       * no nombra ninguna. Estaba vetando una respuesta que citaba TRES cifras del propio cuadro. El anclaje se
       * demuestra con la evidencia usada, no solo con los rótulos de las filas. */
      /* ⚠️ Y EL MES POR DENTRO TAMBIÉN ES «SUS CIFRAS» (owner 2026-09-09): al pedir que el mecanismo viaje con
       * su respaldo, la respuesta correcta se apoya en unidades/margen/carga del mes — que el builder publica
       * y la boleta autoriza, pero que este veto no miraba. Sin esto, exigir las cifras del mes y a la vez
       * vetar por citarlas: la casa contra sí misma. Medido con «fue por volumen: 360 unidades…». */
      const _delMesPorDentro = (c.L.porDentro && Array.isArray(c.L.porDentro.meses))
        ? [...c.L.porDentro.meses.flatMap((m) => [m.contribucionFmt, m.margenFmt, m.accionesFmt, m.cargaFmt, String(m.unidades)]),
           c.L.porDentro.margenAnioFmt, c.L.porDentro.cargaAnioFmt, String(c.L.porDentro.unidadesProm)]
        : [];
      const citaSusCifras = [
        ...[...(c.L.cabecera || []), ...(c.L.filas || []).flatMap((f) => f.cifras || [])].map((x) => x.valor),
        ..._delMesPorDentro,
      ].filter((val) => val && /\d/.test(val) && t.includes(val)).length >= 2;
      if (!nombra && !nombraElCuadro && !citaSusCifras) {
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

    /* (4) EL CUADRO NO SE RECITA — Y CONTAR NOMBRES ERA LA MEDIDA EQUIVOCADA (owner 2026-09-08, medido en su
     * pantalla). Con el umbral por NOMBRES, una lectura ejecutiva rica —que menciona a las que crecen, a las
     * que caen y a las sanas, nueve cuentas con propósito— caía vetada, y el turno se iba al piso. Era mi
     * propia regla matando exactamente la respuesta que el owner pidió.
     *
     * Lo que hay que impedir no es NOMBRAR: es volver a servir la TABLA. Y una tabla se reconoce porque cada
     * fila viene con su cifra pegada, una tras otra. Se cuentan las filas cuyo nombre aparece a ≤40 caracteres
     * de su propio valor principal: mencionar «Ripley, Easy y La Polar caen» no cuenta; «Falabella $19.4M ·
     * Lider $17.8M · Jumbo $17.3M · Sodimac $8.2M…» sí. Más de seve así, en un cuadro de 8+ filas, es la tabla. */
    const nombresTodos = (c.L.filas || []).map((f) => f.nombre).filter((n) => n && n.length >= 3);
    if (nombresTodos.length >= 8) {
      const conSuCifra = (c.L.filas || []).filter((f) => {
        if (!f.nombre || f.nombre.length < 3) return false;
        const pr = _principal(f);
        if (!pr || !pr.valor) return false;
        const iN = t.toLowerCase().indexOf(f.nombre.toLowerCase());
        if (iN < 0) return false;
        const iV = t.indexOf(pr.valor, iN);
        return iV >= 0 && iV - (iN + f.nombre.length) <= 40;
      }).length;
      if (conSuCifra > 6) v.push({ regla: "cuadro-recitado", multa: `sirves ${conSuCifra} de las ${nombresTodos.length} filas con su cifra pegada: eso es la tabla otra vez, y la tabla ya está en pantalla. Nombra las filas que cargan la historia, no la columna entera.` });
    }

    /* (4b) EL PORCENTAJE NO SE REDONDEA A ENTERO (owner 2026-09-08: «102% lo redondeo en 103, prefiero al
     * menos un decimal, es mejor»). El módulo publica «103.0%» y el cerebro escribió «103%»: el muro lo dejó
     * pasar porque el VALOR es el mismo —y para el muro lo es—, pero en pantalla un entero suelto lee como
     * aproximación y le quita precisión a una cifra que está medida. Se exige citarla como el cuadro la
     * publica. Se juzga solo el caso inequívoco: el cuadro publica `N.d%` y el texto trae `N%` pelado. */
    const _todasLasCifras = [...(c.L.cabecera || []), ...(c.L.filas || []).flatMap((f) => f.cifras || [])];
    for (const cif of _todasLasCifras) {
      const m = /^([+-−]?\d+)\.(\d+)%$/.exec(String(cif.valor || ""));
      if (!m) continue;
      /* ⚠️ SOLO CUANDO SE PIERDE INFORMACIÓN (decimal ≠ 0) — y esto se aprendió rompiéndolo en producción.
       * La primera versión multaba TODO entero: el cuadro publica «22.0%» y el cerebro escribía «22%» → multa,
       * dos veces, y el turno salía podado o caía a «no tengo información». Pero es que SENTRIX MISMO muestra
       * «22%» en esa columna cuando el decimal es cero: yo le estaba exigiendo a ADI una precisión que la
       * pantalla no usa, y castigando prosa que copia lo que el usuario ve.
       * Lo que el owner pidió sigue en pie y es lo único que se multa: «103.1%» escrito «103%» SÍ pierde —el
       * entero esconde de qué lado del 103 está—, y eso arde. «22.0%» escrito «22%» no esconde nada. */
      if (Number(m[2]) === 0) continue;
      const entero = `${m[1]}%`;
      if (new RegExp(`(?<![\\d.,])${_esc(entero)}(?!\\.\\d)`).test(t) && !t.includes(cif.valor)) {
        v.push({ regla: "porcentaje-redondeado", multa: `escribes «${entero}» donde el cuadro publica «${cif.valor}»: ahí se pierde el decimal, y el entero pelado esconde de qué lado del número está la cifra real.` });
        break;
      }
    }

    /* (5) LO QUE LA PANTALLA YA DICE NO SE REPITE TEXTUAL. */
    for (const tx of (c.L.textos || [])) {
      if (tx.clave !== "lectura" && tx.clave !== "resumenTope") continue;
      if (tx.texto && tx.texto.length > 25 && t.includes(tx.texto)) {
        v.push({ regla: "cuadro-calcado", multa: `copias textual la frase que el propio cuadro ya muestra en pantalla («${tx.texto.slice(0, 60)}…»): aporta interpretación, no duplicación.` });
        break;
      }
    }

    /* ── EL MÉTODO DEL PORQUÉ VIVE EN LA CASA, NO ACÁ (owner 2026-09-09, décima entrega) ────────────────────
     * «No quiero que el método del porqué dependa de venir desde un cuadro.» Las tres reglas nacieron en este
     * playbook —es donde apareció el defecto— y AL DÍA SIGUIENTE se mudaron a `src/adi/agente/porque.js`, que
     * el bucle aplica a TODO turno causal: con playbook o sin él, desde un cuadro, una ficha o el chat libre.
     * Acá no queda una copia: dos jueces con la misma regla sobre la misma oración es el turno partido en dos
     * cerebros que esta casa ya prohibió, y el que se olvidara de calibrar mataría respuestas correctas.
     * Lo que este playbook sigue juzgando es lo SUYO: el anclaje al cuadro, el 80/20, el eje, la recitación,
     * el calco y el decimal — las promesas de ESTE procedimiento. */
    return v;
  },
};

/** solo para los candados: vacía el memo de una ranura entre casos. */
export function _olvidarMemoDelCuadro() { _memo = null; }
