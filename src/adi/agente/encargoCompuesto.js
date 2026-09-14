/* === src/adi/agente/encargoCompuesto.js · EL ENSAMBLADOR DEL ENCARGO COMPUESTO (owner 2026-09-11) =============
 *
 * EL REQUISITO DE PRODUCTO, textual: «Cuando el usuario realiza un encargo compuesto y ADI ya entendió sus partes
 * y reunió evidencia suficiente, un fallo del narrador no puede hacer que desaparezcan partes explícitamente
 * solicitadas. La respuesta de respaldo puede ser menos elegante, pero debe conservar la cobertura del encargo.»
 * Medido en su batería: el ejecutivo pidió 6 cosas y recibió 3; el causal 5 y ~3,5; el natural 5 y 0.
 *
 * Y LA GARANTÍA TRANSVERSAL (owner 2026-09-14, tras la prueba real en producción v2.28): el usuario pidió
 * Comercial + Inventario + Cobranza juntos y recibió solo margen — este ensamblador conocía únicamente partes
 * COMERCIALES y ninguna ley verificaba la cobertura. Ahora: (1) las partes viven en `partesDelEncargo.js` con su
 * DOMINIO (comercial · inventario · cobranza) y el contrato cobra la misma lista (`parte-del-encargo-omitida`, para
 * el modelo y para este peldaño); (2) «el foco ordena y jerarquiza, no elimina dominios pedidos»; (3) una sola
 * lectura: los dominios se relacionan SOLO por sus claves reales —el SKU (venta ↔ inventario, lado a lado y sin
 * sumar) y el cliente (venta ↔ cobranza, por cuenta)— y se cierra con UNA prioridad común con su criterio dicho;
 * (4) degradación segura: si el modelo cae, esto es menos elegante, nunca menos completo.
 *
 * LO QUE ES: un peldaño DETERMINÍSTICO de la escalera, solo para encargos compuestos, que compone con lo que ya
 * existe —los procedimientos, sus pasos, sus composers, la evidencia ya leída, el reformulador por audiencia,
 * el muro y la escalera—. No es un cerebro, no tiene memoria, no toca ningún composer ni el muro.
 *
 * CÓMO:
 *   1 · `partesDelEncargo(q)` reconoce las partes PEDIDAS con un léxico cerrado (jamás comprensión) y las ordena
 *       en el orden lógico de la casa: qué pasa → si es cierto → quién empuja y quién cae → por qué → quiénes →
 *       el cruce por SKU → el inventario → la cobranza → qué está demostrado → qué haría primero. Solo lo pedido; y
 *       el ensamblador se activa únicamente con DOS o más partes (condición del owner: una pregunta normal no se
 *       convierte en encargo compuesto).
 *   2 · los pasos del turno son la UNIÓN de los pasos del procedimiento activo y de cada parte (el bucle los corre
 *       ANTES del cerebro, como siempre): el modelo recibe toda la evidencia, y el piso no sale a leer.
 *   3 · cada parte se compone con SU propia boleta (los resultados de sus pasos, ya ejecutados): cada composer
 *       espera la boleta que sus pasos producen — con la boleta unida, «quiénes» devuelve vacío (medido).
 *   4 · una sola tesis y un solo criterio: el criterio lo pone la prioridad si está pedida (y se quita de las
 *       demás partes); si no, queda el primero que aparezca. Una cifra una vez: una línea cuyas cifras en dinero
 *       o porcentaje ya fueron citadas se omite (la cabecera de «quiénes» repite la de la foto: se va) — salvo
 *       en la parte «primero», la conclusión, donde la segunda aparición cambia de función (es la razón de la
 *       prioridad). Las líneas sin cifras fuertes —tesis, mecanismos, preguntas al dueño— siempre se conservan.
 *   5 · la parte que no se puede armar con la evidencia se declara en UNA línea; jamás se inventa.
 *   6 · si el encargo nombra un lector al final, cierra con la versión para ese lector: el MISMO piso de
 *       reformular, aplicado a la lectura compuesta.
 *   7 · con dos o más DOMINIOS: abre con la lectura conjunta (qué se relaciona y por qué clave), la cobranza se
 *       compone CRUZADA por cliente con la venta (misma mesa, misma cuenta), y «qué haría primero» es el cierre
 *       integrado: una sola lista ordenada —primero la cuenta donde coinciden dos dominios con clave real, después
 *       el mayor monto de cada dominio—, cada cifra con su marco y sin sumar entre dominios.
 * El texto ensamblado se juzga como cualquier peldaño (muro + contrato + notarial del procedimiento activo) y,
 * si no pasa, cede al piso simple de hoy. */
import { resumenDelNegocio } from "./playbooks/resumenDelNegocio.js";
import { margenEnRiesgo } from "./playbooks/margenEnRiesgo.js";
import { contradiccionDeMetricas } from "./playbooks/contradiccionDeMetricas.js";
import { inventarioInmovilizado } from "./playbooks/asesoria.js";
import { cobranza } from "./playbooks/cobranza.js";
import { crucePorSku } from "./playbooks/crucePorSku.js";
import { pasosDe } from "./playbooks/registro.js";
import { pasosDeDominios, unirPasosDeDominios } from "./contratoDeDominios.js";   // la realidad de inventario para sus partes (owner 2026-09-14)
import { componerReformulacion, destinatarioDe } from "./reformular.js";
import { partesDelEncargo as _partesDeLaHoja, dominiosDelEncargo, coberturaDelEncargo, esEncargoCompuesto } from "./partesDelEncargo.js";
import { componerPrioridadIntegrada, conclusionDePrioridad } from "./prioridadIntegrada.js";   // materialidad + severidad + urgencia, señal por señal (owner 2026-09-14)
export { esEncargoCompuesto, dominiosDelEncargo, coberturaDelEncargo };

/* ── LOS PROCEDIMIENTOS DE CADA PARTE (la hoja los nombra; acá se resuelven) ─────────────────────────────────── */
const _PLAYBOOKS = {
  "resumen-del-negocio": resumenDelNegocio,
  "contradiccion-de-metricas": contradiccionDeMetricas,
  "margen-en-riesgo": margenEnRiesgo,
  "cruce-por-sku": crucePorSku,
  "inventario-inmovilizado": inventarioInmovilizado,
  "cobranza": cobranza,
};

/* ── LOS HELPERS DE LECTURA DE LA BOLETA (los mismos de los playbooks) ─────────────────────────────────────────── */
const _lab = (f) => String((f && f.label) || "");
const _val = (f) => String((f && (f.text || f.value)) || "");
const _num = (f) => {
  if (f && Number.isFinite(f.raw)) return f.raw;
  const s = _val(f).trim();
  const m = /^([+-])?\$\s?(-?[\d.,]+)\s?([KMB])?$/.exec(s);
  if (m) { const n = parseFloat(m[2].replace(",", ".")); const k = { K: 1e3, M: 1e6, B: 1e9 }[m[3]] || 1; return Number.isFinite(n) ? (m[1] === "-" ? -1 : 1) * n * k : NaN; }
  const d = /^(-?[\d.,]+)\s*d$/.exec(s);
  return d ? parseFloat(d[1]) : NaN;
};
const _find = (figs, re) => (Array.isArray(figs) ? figs : []).find((f) => re.test(_lab(f))) || null;
const _all = (figs, re) => (Array.isArray(figs) ? figs : []).filter((f) => re.test(_lab(f)));
const _entidadDe = (label) => { const p = String(label || "").split("·").map((s) => s.trim()); return p.length >= 2 ? p[0] : null; };

/* ── QUIÉN EMPUJA EL CRECIMIENTO Y QUIÉN CAE (parte «crecimiento», sin procedimiento propio hasta hoy) ──────────
 * Lee `salesRead{}` (venta contra el año anterior, por cliente): los que más suben y los que caen, con su variación.
 * No repite el total del crecimiento —la foto ya lo dice y viene de otra mesa (100.0M vs 99.9M del demo)—: los
 * nombres con su monto son lo que la pregunta pide. Sin variación por cliente en la boleta, no compone. */
const _crecimiento = {
  nombre: "crecimiento",
  pasos: [{ tool: "salesRead", args: {}, para: "la venta de cada cliente contra el año anterior: quiénes suben y quiénes caen, con su variación" }],
  componer({ figs } = {}) {
    const filas = _all(figs, /· YoY$/i).map((f) => ({ entidad: _entidadDe(_lab(f)), fmt: _val(f), n: _num(f) })).filter((x) => x.entidad && Number.isFinite(x.n));
    if (filas.length < 2) return null;
    const pct = new Map(_all(figs, /· Variación vs año anterior$/i).map((f) => [_entidadDe(_lab(f)), _val(f)]));
    const suben = filas.filter((x) => x.n > 0).sort((a, b) => b.n - a.n);
    const caen = filas.filter((x) => x.n < 0).sort((a, b) => a.n - b.n);
    const linea = (x) => `- ${x.entidad} · ${x.fmt} contra el año anterior${pct.get(x.entidad) ? ` (${pct.get(x.entidad)})` : ""}`;
    const L = [];
    if (suben.length) { L.push(`Quién empuja el crecimiento — venta contra el año anterior, por cliente:`); suben.slice(0, 3).forEach((x) => L.push(linea(x))); if (suben.length > 3) L.push(`(y ${suben.length - 3} más que suben)`); }
    if (caen.length) { L.push(`Quién cae:`); caen.slice(0, 3).forEach((x) => L.push(linea(x))); }
    L.push(`Empujar la venta no es dejar contribución: eso va abajo, cuenta por cuenta.`);
    return L.join("\n");
  },
};

/* ── LAS UNIDADES VENDIDAS (parte «unidades»: un conteo del período, por cliente) ─────────────────────────────── */
const _unidades = {
  nombre: "unidades",
  pasos: [{ tool: "queryMetric", args: { metric: "unidades", dimension: "cliente" }, para: "las unidades vendidas del período por cliente" }],
  componer({ figs } = {}) {
    const filas = _all(figs, /· Unidades vendidas$/i).map((f) => ({ entidad: _entidadDe(_lab(f)), fmt: _val(f), n: _num(f) })).filter((x) => x.entidad && Number.isFinite(x.n)).sort((a, b) => b.n - a.n);
    if (filas.length < 2) return null;
    const L = [`Unidades vendidas en el período, por cliente — los que más mueven:`];
    filas.slice(0, 3).forEach((x) => L.push(`- ${x.entidad} · ${x.fmt} unidades`));
    if (filas.length > 3) L.push(`(y ${filas.length - 3} clientes más)`);
    L.push(`Mover unidades no es dejar contribución: el margen de cada cuenta va aparte.`);
    return L.join("\n");
  },
};

/* ── LA COBRANZA CRUZADA POR CLIENTE (cuando el encargo también es comercial) ───────────────────────────────────
 * La clave real entre venta y cobranza es el cliente, y las dos cifras salen de la MISMA mesa (el flujo): la venta
 * del período y el saldo al corte «se leen juntas por cuenta, no se restan entre sí» (doctrina de cruce). Los
 * principales clientes por venta, con su saldo y su vencido al lado; el vencido más pesado, con nombre. */
function _cobranzaCruzada({ figs } = {}) {
  const saldo = _find(figs, /^Saldo pendiente · total$/i);
  const vencidoTotal = _find(figs, /^Saldo vencido · total$/i);
  const ventas = _all(figs, /· Venta \(flujo\)$/i).map((f) => ({ entidad: _entidadDe(_lab(f)), venta: _val(f), n: _num(f) })).filter((x) => x.entidad && Number.isFinite(x.n)).sort((a, b) => b.n - a.n);
  if (!saldo || ventas.length < 2) return null;
  const saldos = new Map(_all(figs, /· Saldo pendiente$/i).map((f) => [_entidadDe(_lab(f)), _val(f)]));
  const vencidos = _all(figs, /· Saldo vencido$/i).map((f) => ({ entidad: _entidadDe(_lab(f)), fmt: _val(f), n: _num(f) })).filter((x) => x.entidad && Number.isFinite(x.n) && x.n > 0).sort((a, b) => b.n - a.n);
  const vencidoDe = new Map(vencidos.map((x) => [x.entidad, x.fmt]));
  const dias = new Map(_all(figs, /· Dias Vencido$/i).map((f) => [_entidadDe(_lab(f)), _val(f)]));
  const L = [`Cobranza, al corte declarado por la mesa: tienes ${_val(saldo)} por cobrar${vencidoTotal ? ` y ${_val(vencidoTotal)} ya vencidos` : ""}.`];
  L.push(`Tus principales clientes por venta, con su saldo y su vencido al lado:`);
  for (const x of ventas.slice(0, 5)) {
    const v = vencidoDe.get(x.entidad);
    L.push(`- ${x.entidad} · venta ${x.venta} · saldo ${saldos.get(x.entidad) || "—"} · ${v ? `vencido ${v}${dias.get(x.entidad) ? ` (${dias.get(x.entidad)})` : ""}` : "sin vencido"}`);
  }
  if (vencidos.length) {
    const top = vencidos[0];
    const enTop = ventas.slice(0, 5).some((x) => x.entidad === top.entidad);
    L.push(`El vencido más pesado es ${top.entidad}: ${top.fmt}${dias.get(top.entidad) ? ` a ${dias.get(top.entidad)}` : ""}${enTop ? " — y está entre tus principales clientes por venta: el riesgo de cobranza y el peso comercial coinciden en la misma cuenta" : ""}.`);
  } else if (!vencidoTotal) {
    L.push(`Qué parte está vencida no se puede saber: tu empresa no declaró plazo de pago.`);
  }
  L.push(`Por qué cada cliente debe lo que debe no está en el flujo: queda localizado, no explicado.`);
  return L.join("\n");
}

/* EL CIERRE INTEGRADO vive en prioridadIntegrada.js (owner 2026-09-14): materialidad + severidad + urgencia por dominio, señal por
 * señal entre dominios, con el criterio dicho — no por «coincide en dos dominios» ni por suma de montos. */

/** las partes PEDIDAS, en el orden de la casa, con su procedimiento resuelto — [] si no es un encargo compuesto o pide menos de dos */
export function partesDelEncargo(pregunta) {
  const LOCALES = { crecimiento: _crecimiento, unidades: _unidades };
  return _partesDeLaHoja(pregunta).map((p) => (LOCALES[p.playbook] ? { ...p, playbook: null, local: LOCALES[p.playbook] } : { ...p, playbook: _PLAYBOOKS[p.playbook] || null }));
}

/** los pasos de una parte: los de su procedimiento (por su pregunta canónica) o los propios de una parte local */
const _pasosDeParte = (pt, ctx) => {
  try {
    const propios = pt.playbook ? (pasosDe(pt.playbook, pt.pregunta, ctx) || []) : ((pt.local && pt.local.pasos) || []);
    /* una parte de inventario compone con la realidad completa de su dominio (frenados, días y stock por SKU): son los
     * mismos pasos que el contrato de dominios ya corrió en el turno — sin ellos el cruce por SKU no cita los días */
    if (pt.dominio === "inventario") { const dom = pasosDeDominios({ dominios: ["inventario"], eje: null }) || []; return unirPasosDeDominios(propios, dom); }
    return propios;
  } catch { return []; }
};

/** la unión de pasos (sin duplicar por herramienta+args): los del procedimiento activo y los de cada parte */
export function pasosDelEncargo(partes, pasosBase, ctx) {
  const out = [];
  const vistos = new Set();
  const firma = (p) => `${p.tool}::${JSON.stringify(p.args || {})}`;
  for (const p of [...(pasosBase || []), ...partes.flatMap((pt) => _pasosDeParte(pt, ctx))]) {
    if (!p || !p.tool || vistos.has(firma(p))) continue;
    vistos.add(firma(p));
    out.push(p);
  }
  return out;
}

/* ── LA DOCTRINA DEL ENCARGO, para el cerebro (owner 2026-09-14) ───────────────────────────────────────────────
 * Viaja SOLO en un turno de encargo compuesto, después de las doctrinas de dominio: la lista de lo pedido, la ley de
 * cobertura («el foco ordena, no elimina»), las claves de unión válidas y el cierre integrado. El entregable del
 * procedimiento activo (por ejemplo, la ficha del cruce por SKU) es UNA parte; el entregable del turno es el encargo. */
export function doctrinaDelEncargo(partes, dominios = [], figs = null) {
  if (!Array.isArray(partes) || partes.length < 2) return "";
  const doms = dominios && dominios.length ? dominios : dominiosDelEncargo(partes);
  const L = [`[ENCARGO COMPUESTO — no es el usuario] El usuario pidió ${partes.length} cosas${doms.length >= 2 ? ` en ${doms.length} dominios (${doms.join(" + ")})` : ""}, y LA RESPUESTA LAS CUBRE TODAS — el foco ordena y jerarquiza, no elimina una parte pedida:`];
  for (const p of partes) L.push(`- ${p.nombre}${p.pregunta && String(p.pregunta).length <= 80 ? ` (${p.pregunta})` : ""}`);
  if (doms.length >= 2) {
    L.push(`Una sola lectura, no informes separados: relaciona los dominios SOLO por sus claves reales — por SKU (venta y contribución del período frente a stock, días y capital de la foto: lado a lado, sin sumar ni derivar cobertura) y por cliente (la venta del período junto al saldo y el vencido al corte, por cuenta). Cliente ↔ inventario y bodega ↔ venta no existen en este archivo: no las construyas.`);
    L.push(`Cierra con la prioridad: la de cada dominio y la integrada del negocio, con el criterio dicho — materialidad (cuánto está en juego), severidad (distancia a la referencia declarada) y urgencia (la señal de tiempo) dentro de cada dominio; entre dominios, señal por señal, sin sumar ni comparar montos de dominios distintos; coincidir en dos dominios agrava, no decide.`);
  }
  /* la conclusión del procedimiento sobre la prioridad viaja ANTES de escribir (ley de la casa: la conclusión es del
   * procedimiento, el cerebro la explica) — solo cuando el encargo pidió la prioridad y hay señales en la boleta */
  if (figs && (partes.some((p) => p.clave === "primero") || doms.length >= 2)) {   // con varios dominios, la prioridad del procedimiento viaja siempre
    const c = (() => { try { return conclusionDePrioridad(figs, doms); } catch { return ""; } })();
    if (c) L.push(c);
  }
  L.push(`Lo que el dato no trae para una parte se dice en una línea; ninguna parte desaparece. El entregable del procedimiento activo es UNA de las partes; el entregable del turno es el encargo completo.`);
  return L.join("\n");
}

/* ── UNA SOLA TESIS Y UN SOLO CRITERIO · UNA CIFRA UNA VEZ ─────────────────────────────────────────────────── */
/* el criterio Y la oferta de cierre de cada composer («¿lo abrimos por…?», «pídeme su serie…»): son la misma
 * cosa —la puerta al siguiente paso— y en una lectura compuesta va una sola */
const _CRITERIO = /\b(?:entrar[ií]a por|empezar[ií]a por|partir[ií]a por|arrancar[ií]a por|criterio m[ií]o|si fuera mi decisi[oó]n|si te parece, empiezo|si quieres, sigo|cuando digas|te abro su serie|mi recomendaci[oó]n|yo mirar[ií]a primero|lo abrimos|p[ií]deme su serie|te dejo armado|el siguiente de la lista|donde hay m[aá]s contribuci[oó]n en juego es|dime y (?:lo|la) (?:abrimos|traigo)|si igual quieres verlo|si quieres, abrimos|empiezo por)\b/i;
/* una viñeta es una unidad de evidencia (una huella con su sello, una cuenta con su cifra): no se poda por repetir */
const _ES_VINETA = /^\s*(?:[-·•]|\d{1,2}[.)])\s+/;
const _CIFRA_FUERTE = /\$\s?[\d.,]+\s?[KMB]?|[\d.,]+\s*%/g;
const _cifrasDe = (l) => (String(l).match(_CIFRA_FUERTE) || []).map((c) => c.replace(/\s+/g, ""));

/**
 * componerEncargo({ partes, leer, scenario, mem, semilla, pregunta }) → texto | null
 *   `leer(pasos)` → figs: la boleta de ESA parte, con los resultados de sus pasos (ya ejecutados en el turno).
 */
export function componerEncargo({ partes, leer, scenario, mem, semilla, pregunta } = {}) {
  if (!Array.isArray(partes) || partes.length < 2 || typeof leer !== "function") return null;
  /* el porqué ya contiene el sello (sus huellas con su sello): si piden los dos, va uno */
  const activas = partes.some((p) => p.clave === "porque") ? partes.filter((p) => p.clave !== "sello") : partes;
  const doms0 = dominiosDelEncargo(activas);
  /* «en un encargo multidominio que pide una sola lectura del negocio, ADI debe terminar siempre con una prioridad integrada,
   * aunque el usuario no use literalmente “prioridad”» (owner 2026-09-14): con dos o más dominios el cierre va siempre, y
   * ningún criterio de una parte sola («Yo miraría primero Falabella —criterio mío—») sobrevive presentado como global */
  const hayPrimero = activas.some((p) => p.clave === "primero") || doms0.length >= 2;
  const doms = dominiosDelEncargo(activas);
  const multi = doms.length >= 2;
  const bloques = [];
  const citadas = new Set();
  const lecturas = new Map();   // dominio → figs leídas (para el cierre integrado)
  let criterioVisto = false;
  let compuestas = 0;
  for (const parte of activas) {
    let texto = null;
    let figs = [];
    try {
      figs = leer(_pasosDeParte(parte, {}) || []) || [];
      if (multi && parte.clave === "primero") texto = null;   // en varios dominios el cierre es integrado (abajo), no el «primero» comercial
      else if (multi && parte.clave === "cobranza" && doms.includes("comercial")) texto = _cobranzaCruzada({ figs });
      else texto = parte.playbook ? parte.playbook.componer({ figs, pregunta: parte.pregunta, semilla, scenario, mem }) : parte.local.componer({ figs, pregunta: parte.pregunta, semilla, scenario, mem });
    } catch { texto = null; }
    if (figs.length) lecturas.set(parte.dominio, [...(lecturas.get(parte.dominio) || []), ...figs]);
    if (multi && parte.clave === "primero") continue;
    if (!texto || !String(texto).trim()) {
      bloques.push(`Sobre ${parte.nombre} no pude armar la lectura con lo leído en este turno.`);
      continue;
    }
    compuestas++;
    const lineas = String(texto).split("\n");
    const salida = [];
    lineas.forEach((l) => {
      const linea = l.trimEnd();
      if (!linea.trim()) { salida.push(""); return; }
      const esCriterio = _CRITERIO.test(linea);
      if (esCriterio) {
        /* el criterio lo pone la prioridad si está pedida; si no, el primero que aparezca */
        if (parte.clave !== "primero" && (hayPrimero || criterioVisto)) return;
        criterioVisto = true;
      }
      const cifras = _cifrasDe(linea);
      if (cifras.length && parte.clave !== "primero" && !_ES_VINETA.test(linea) && cifras.every((c) => citadas.has(c))) return;   // solo repite lo ya citado: se omite
      for (const c of cifras) citadas.add(c);
      salida.push(linea);
    });
    bloques.push(salida.join("\n").replace(/\n{3,}/g, "\n\n").trim());
  }
  if (multi && hayPrimero) {
    /* la prioridad lee la realidad de cada dominio (los mismos pasos del contrato de dominios, ya corridos en el turno):
     * las señales de las tres lentes viven en esa boleta, no en la de cada parte */
    /* dominio por dominio: `leer` corre con el tope de una ronda (8 llamadas) y los tres dominios juntos lo exceden — medido:
     * el cierre salía solo con el comercial y la cobranza y el inventario desaparecían de la prioridad */
    const figsDom = doms.flatMap((d) => { try { return leer(pasosDeDominios({ dominios: [d], eje: null }) || []) || []; } catch { return []; } });
    const cierre = (() => { try { return componerPrioridadIntegrada(figsDom.length ? figsDom : [...lecturas.values()].flat(), doms); } catch { return null; } })();
    if (cierre) { bloques.push(cierre); compuestas++; }
    else bloques.push(`Sobre qué haría primero no pude armar la lectura con lo leído en este turno.`);
  }
  if (compuestas < 2) return null;   // con una sola parte armada no hay encargo compuesto que garantizar: cede al piso simple
  if (multi) {
    /* la lectura conjunta abre: qué se relaciona y por qué clave — sin cifras, para no comerse las de las partes */
    const claves = [];
    if (doms.includes("comercial") && doms.includes("inventario")) claves.push("por SKU (venta e inventario, lado a lado)");
    if (doms.includes("comercial") && doms.includes("cobranza")) claves.push("por cliente (venta y cobranza, por cuenta)");
    bloques.unshift(`Lectura conjunta de ${doms.join(", ").replace(/, ([^,]*)$/, " y $1")}${claves.length ? ` — relacionados ${claves.join(" y ")}` : ""}${doms.includes("inventario") && doms.includes("cobranza") ? "; inventario y cobranza no comparten clave en este archivo" : ""}. Cada cifra con su marco.`);
  }
  let cuerpo = bloques.join("\n\n");
  /* la versión para el lector, al final — el mismo piso de reformular sobre la lectura compuesta */
  const lector = (() => { try { return destinatarioDe(pregunta); } catch { return null; } })();
  if (lector) {
    let version = null;
    try { version = componerReformulacion(cuerpo, { pregunta: `para ${lector}` }); } catch { version = null; }
    if (version) cuerpo = `${cuerpo}\n\n${version}`;
  }
  return cuerpo;
}
