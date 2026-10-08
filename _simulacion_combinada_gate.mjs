/* === _simulacion_combinada_gate.mjs · LA BATERÍA DE LA SIMULACIÓN COMBINADA (ensayo 9, owner 2026-10-09) ═════════════════════════════════════════════════════════
 * Contexto. En el ensayo 9 un sondeo offline mostró que «costo +10 % y precio +5 %» sobre Samsung daba margen 31.1 % (donde lo correcto está cerca de 20 %), que «costo» solo devolvía el costo,
 * que «costo sobre el negocio» no tenía productor y —lo que nadie había mirado— que la contribución de una simulación de marca, familia o producto se calculaba como venta − costo SIN las
 * acciones comerciales (Samsung: 27.7 % de margen donde el dato dice 23.4 %). Raíz: cada supuesto corría en SU herramienta y los resultados se pegaban. Ahora todos los supuestos de una parte
 * se aplican JUNTOS en un modelo (`engine/simulacionSupuestos.js`, herramienta `simularSupuestos`) y lo que no se puede combinar sin inventar un reparto se RECHAZA con su razón.
 *
 * Qué prueba (offline, sin LLM, sin red):
 *   1 · EL ORÁCULO NO ES EL CÓDIGO BAJO PRUEBA. El esperado sale de las TABLAS CRUDAS del tenant (`clientesVentas`/`clientesMargen`, `marcasMargen`, `sfamiliasMargen`, `skusMargen`) con una cuenta
 *      escrita acá (no importa el motor, ni `rawRecordFor`, ni el validador) y se ancla a números calculados a mano sobre filas conocidas.
 *   2 · LA BATERÍA. Desde el catálogo de `conocerEmpresa` (los tipos de supuesto que ofrece y DÓNDE corre cada uno) se enumera cada combinación de hasta 3 supuestos (el tope del Encargo) de los
 *      tipos precio · volumen (en % y en dinero) · costo · margen · carga, × cada alcance (el negocio, y una entidad de cada eje: cuenta · marca · familia · producto) × cada forma de pedirlo
 *      (con entidades nombradas —una tocada y una intacta—, sin entidades —la entidad y el TOTAL del negocio—, y mezclando negocio con una entidad) × los tenants (demo, Río Claro v1 y v2).
 *      Cada cifra simulada que sale (venta · costo · contribución · margen · carga · liberado) se compara con el oráculo, y se prueban las identidades del dato: venta = costo + acciones + contribución
 *      y margen = contribución ÷ venta.
 *   3 · EL RECHAZO ENSEÑA. Lo que no se puede combinar (ejes distintos, el resultado de otro eje, dos supuestos del mismo tipo sobre la misma entidad, un supuesto que no toca a lo pedido, un valor
 *      fuera de rango o cero, más de 3) vuelve con su razón y SIN cifras — nunca un resultado parcial que calle un supuesto. Sin modelo de costo declarado, un volumen combinado con un movimiento del
 *      costo se rechaza y un volumen solo se limita a la venta.
 *   4 · CARNADAS (rojo primero). Cada defecto del sondeo, reconstruido sobre la salida real, tiene que poner el comparador en ROJO: el costo que no entra, la contribución sin acciones, el margen
 *      que sube cuando debía bajar el costo, el supuesto que se calla, la identidad rota por $1, el tope de carga que se ignora. Y los números del ensayo, antes y después.
 * Solo por `npm run gates:offline` o `node --import ./scripts/offline-guard.mjs _simulacion_combinada_gate.mjs`. */
import { initTenant } from "./src/data/tenantStore.js";
import { TENANT_DEMO } from "./src/data/tenants/demo.js";
import { TENANT_EMPRESA2 } from "./src/data/tenants/empresa2.js";
import { packRenombrado, EMPRESA_NO_DEMO } from "./scripts/medicion-anfitrion/empresa-no-demo.mjs";
import { crearAcciones } from "./src/adi/capacidad/acciones.js";
import { crearAlmacenEnMemoria } from "./src/adi/continuidad/almacen.js";
import { construirCatalogo } from "./src/adi/capacidad/catalogo.js";
import { conTenantActivo } from "./src/adi/capacidad/aislamiento.js";
import { cifraDeHecho } from "./src/adi/continuidad/revalidar.js";
import { formatoDeLaCasa } from "./src/adi/notario/hechos.js";
import { TOOLS } from "./src/adi/oracle/toolRegistry.js";
import { simularFila, baseDeFila } from "./src/engine/simulacionSupuestos.js";

let pass = 0, fail = 0;
const fallas = [];
const ok = (c, m, extra = "") => { if (c) pass++; else { fail++; fallas.push(m); console.log(`  ✗ ${m}${extra ? "\n      " + extra : ""}`); } };
const H = (t) => console.log(`\n${t}`);

/* ═══ 1 · EL ORÁCULO: las tablas crudas del tenant y una cuenta escrita acá ═══════════════════════════════════════════════════════════════════════════════════════ */
const EJES = ["cliente", "marca", "familia", "sku"];
const TABLA = { marca: "marcasMargen", familia: "sfamiliasMargen", sku: "skusMargen" };
const escalaDe = (ds) => (ds.escalaComercial === "raw" ? 1 : 1000);
const aprox = (a, b, rel = 1e-9) => Math.abs(a - b) <= rel * Math.max(1, Math.abs(a), Math.abs(b));

/** filaCruda(ds, eje, nombre) → { V, C, R, K, carga, incl } en la escala del dato (miles). La cuenta del dato: en cuentas la venta es la OFICIAL (`clientesVentas.actual`), la contribución es venta × margen
 *  declarado y el costo es venta − contribución (incluye las acciones: `incl`); en marca, familia y producto la fila trae costo, acciones y contribución propios (el costo NO incluye las acciones). */
function filaCruda(ds, eje, nombre) {
  if (eje === "cliente") {
    const v = ds.clientesVentas.find((x) => x.nombre === nombre), m = ds.clientesMargen.find((x) => x.nombre === nombre);
    const V = v.actual, K = Math.round(V * (m.margen / 100)), R = Math.round(V * (m.pctRebate / 100));
    return { V, C: V - K, R, K, carga: m.pctRebate, incl: true };
  }
  const r = ds[TABLA[eje]].find((x) => x.nombre === nombre);
  return { V: r.venta, C: r.costo, R: r.rebates, K: r.contribucion, carga: r.pctRebate, incl: false };
}
const nombresDe = (ds, eje) => (eje === "cliente" ? ds.clientesVentas.map((x) => x.nombre) : ds[TABLA[eje]].map((x) => x.nombre));

/** unaEntidad(ds, fila, supuestos, ventaDelAlcance) → los números simulados de UNA entidad con los supuestos que la tocan (la cuenta, escrita de nuevo: factores en vez de deltas) */
function simularCrudo(f, aplic, fx, ventaDelAlcance) {
  let p = 0, g = 0, c = 0, dm = 0, dc = 0;
  for (const s of aplic) {
    if (s.tipo === "price") p = s.valor / 100;
    else if (s.tipo === "growth") g = (s.unidad === "money" ? (s.valor / (ventaDelAlcance(s) * fx)) : s.valor / 100);
    else if (s.tipo === "costo") c = s.valor / 100;
    else if (s.tipo === "margin") dm = s.valor / 100;
    else if (s.tipo === "carga") dc = s.valor / 100;
  }
  const costoProductos = f.incl ? f.C - f.R : f.C;                 // el costo SIN acciones comerciales
  const residuo = f.V - costoProductos - f.R - f.K;                  // el redondeo de la propia fila: constante
  const V1 = f.V * (1 + p) * (1 + g);
  const productos1 = costoProductos * (1 + g) * (1 + c) - dm * V1;
  const acciones1 = Math.max(0, f.R * (1 + g) + dc * V1);
  const K1 = V1 - productos1 - acciones1 - residuo;
  const C1 = f.incl ? productos1 + acciones1 : productos1;
  return { V0: f.V, C0: f.C, K0: f.K, R0: f.R, V1, C1, K1, R1: acciones1, residuo, libera: f.R * (1 + g) - acciones1, carga0: f.carga };
}

/** esperado({ ds, eje, universo, conTotal, supuestos }) → Map nombre → números · aplica a cada entidad los supuestos que la tocan; el total del negocio suma TODAS las filas del eje */
function esperado({ ds, eje, universo, conTotal, supuestos }) {
  const fx = escalaDe(ds);
  const todas = nombresDe(ds, eje);
  const Vtotal = todas.reduce((s, n) => s + filaCruda(ds, eje, n).V, 0);
  const ventaDelAlcance = (s) => (s.alcance === "negocio" ? Vtotal : filaCruda(ds, s.alcance.eje, s.alcance.nombre).V);
  const tocan = (n) => supuestos.filter((s) => s.alcance === "negocio" || (s.alcance.eje === eje && s.alcance.nombre === n));
  const out = new Map();
  for (const n of universo) out.set(n, { ...simularCrudo(filaCruda(ds, eje, n), tocan(n), fx, ventaDelAlcance), aplicables: tocan(n) });
  if (conTotal) {
    const filas = todas.map((n) => simularCrudo(filaCruda(ds, eje, n), tocan(n), fx, ventaDelAlcance));
    const t = { V0: 0, C0: 0, K0: 0, R0: 0, V1: 0, C1: 0, K1: 0, R1: 0, residuo: 0, libera: 0 };
    for (const r of filas) for (const k of Object.keys(t)) t[k] += r[k];
    out.set("Negocio", { ...t, carga0: null, aplicables: supuestos, esTotal: true });
  }
  return out;
}

/* ═══ 2 · LA SALIDA DE ADI: las cifras de la Entrega, con su valor exacto del libro y su valor impreso ═════════════════════════════════════════════════════════════ */
function leerSalida(r) {
  const j = r && r.entrega && r.entrega.json;
  const libro = j && j.procedencia && j.procedencia.libro;
  const porEntidad = new Map();
  if (!j || !libro || !j.cifras) return porEntidad;
  /* la tabla de Cifras y lo que el gobierno de tamaño dejó en el detalle (las mismas filas, otro lugar: una simulación de varias entidades no cabe entera en la tabla) */
  for (const f of [...(j.cifras.filas || []), ...((j.detalle && j.detalle.filas) || [])]) {
    const v = f.valores || {};
    const H0 = libro.porId.get((f.hechos || [])[0]);
    const c = H0 ? cifraDeHecho(H0) : null;
    if (!v.Entidad || !v["Métrica"] || !c || /^Benchmark/.test(v["Métrica"])) continue;   // la referencia (benchmark) es del negocio, no una entidad simulada
    if (!porEntidad.has(v.Entidad)) porEntidad.set(v.Entidad, { supuesto: v.Supuesto, m: {} });
    porEntidad.get(v.Entidad).m[v["Métrica"]] = { raw: c.raw, valor: v.Valor };
  }
  return porEntidad;
}
const resolucionImpresa = (raw, valor) => {
  // el valor impreso es la cifra a la precisión de lo impreso (la tabla redondea): $33.2M ↔ 33.2e6 ± 0.05e6 · 20.1% ↔ ± 0.05
  const t = String(valor);
  const num = parseFloat(t.replace(/[^0-9.\-]/g, ""));
  if (!Number.isFinite(num)) return false;
  if (/%$/.test(t)) return Math.abs(num - raw) <= 0.0501;
  const mult = /M$/.test(t) ? 1e6 : /K$/.test(t) ? 1e3 : 1;
  const signo = /^-/.test(t) ? -1 : 1;
  const dec = (t.match(/\.(\d+)/) || [, ""])[1].length;
  return Math.abs(signo * Math.abs(num) * mult - raw) <= 0.5 * Math.pow(10, -dec) * mult * 1.0001 + 1e-6;
};

/** verificarCaso({ ds, eje, universo, conTotal, supuestos, salida }) → string[] · cada diferencia entre lo que ADI publicó y el oráculo, y cada identidad rota */
function verificarCaso({ ds, eje, universo, conTotal, supuestos, salida }) {
  const v = [];
  const fx = escalaDe(ds);
  const E = esperado({ ds, eje, universo, conTotal, supuestos });
  const esperadas = [...E.keys()];
  const publicadas = [...salida.keys()];
  if (JSON.stringify([...esperadas].sort()) !== JSON.stringify([...publicadas].sort())) v.push(`las entidades publicadas (${publicadas.join(", ")}) no son las pedidas (${esperadas.join(", ")})`);
  for (const [n, e] of E) {
    const s = salida.get(n);
    if (!s) continue;
    const m = s.m;
    const dinero = (met, esp) => { const x = m[met]; if (!x) v.push(`${n}: falta «${met}»`); else { if (!aprox(x.raw, esp * fx, 1e-9)) v.push(`${n}: ${met} = ${x.raw} y el oráculo dice ${esp * fx}`); if (!resolucionImpresa(x.raw, x.valor)) v.push(`${n}: ${met} impreso «${x.valor}» no es su cifra exacta ${x.raw}`); } };
    dinero("Venta actual", e.V0); dinero("Venta supuesta", e.V1);
    dinero("Costo actual", e.C0); dinero("Costo supuesto", e.C1);
    dinero("Contribución actual", e.K0); dinero("Contribución supuesta", e.K1);
    const pct = (met, esp, tol) => { const x = m[met]; if (!x) v.push(`${n}: falta «${met}»`); else { if (Math.abs(x.raw - esp) > tol) v.push(`${n}: ${met} = ${x.raw} y el oráculo dice ${esp}`); if (!resolucionImpresa(x.raw, x.valor)) v.push(`${n}: ${met} impreso «${x.valor}» no es ${x.raw}`); } };
    pct("Margen actual", (100 * e.K0) / e.V0, 0.0501); pct("Margen supuesto", (100 * e.K1) / e.V1, 0.0501);
    /* LAS IDENTIDADES, sobre lo PUBLICADO: venta = costo + acciones + contribución (el costo de la cuenta ya trae las acciones) y margen = contribución ÷ venta */
    if (m["Venta supuesta"] && m["Costo supuesto"] && m["Contribución supuesta"]) {
      const acciones1 = e.R1 * fx;
      const inclu = n !== "Negocio" ? filaCruda(ds, eje, n).incl : filaCruda(ds, eje, nombresDe(ds, eje)[0]).incl;
      const resid = m["Venta supuesta"].raw - m["Costo supuesto"].raw - (inclu ? 0 : acciones1) - m["Contribución supuesta"].raw;
      if (Math.abs(resid - e.residuo * fx) > 1e-6 * Math.max(1, m["Venta supuesta"].raw)) v.push(`${n}: venta ≠ costo + acciones + contribución (sobra ${resid - e.residuo * fx})`);
      const marg = (100 * m["Contribución supuesta"].raw) / m["Venta supuesta"].raw;
      if (m["Margen supuesto"] && Math.abs(m["Margen supuesto"].raw - marg) > 0.0501) v.push(`${n}: margen publicado ${m["Margen supuesto"].raw} ≠ contribución ÷ venta ${marg.toFixed(3)}`);
    }
    /* la carga y lo liberado, solo si algún supuesto de carga toca a esta entidad */
    if (e.aplicables.some((x) => x.tipo === "carga")) {
      const c0 = e.esTotal ? (100 * e.R0) / e.V0 : e.carga0;
      const c1 = (100 * e.R1) / e.V1;
      const x0 = m["Carga actual"], x1 = m["Carga supuesta"];
      if (!x0 || !x1) v.push(`${n}: falta la carga actual/supuesta`);
      else {
        if (Math.abs(x0.raw - c0) > 0.101) v.push(`${n}: carga actual ${x0.raw} y el dato dice ${c0.toFixed(3)}`);
        if (Math.abs(x1.raw - c1) > 0.101) v.push(`${n}: carga supuesta ${x1.raw} y el oráculo dice ${c1.toFixed(3)}`);
      }
      const lib = m["Liberado"] || m["Comprometido"];
      if (Math.abs(e.libera) > 1e-9) { if (!lib) v.push(`${n}: falta lo liberado/comprometido`); else if (!aprox(lib.raw, Math.abs(e.libera) * fx, 1e-9)) v.push(`${n}: ${m["Liberado"] ? "liberado" : "comprometido"} = ${lib.raw} y el oráculo dice ${Math.abs(e.libera) * fx}`); }
    } else if (m["Carga supuesta"]) v.push(`${n}: publica una carga supuesta sin que ningún supuesto de carga lo toque`);
    /* la entidad que ningún supuesto toca no cambia nada */
    if (e.aplicables.length === 0 && !e.esTotal) {
      for (const k of ["Venta", "Costo", "Contribución", "Margen"]) if (m[`${k} actual`] && m[`${k} supuest${k === "Margen" ? "o" : "a"}`] && m[`${k} actual`].raw !== m[`${k} supuest${k === "Margen" ? "o" : "a"}`].raw) v.push(`${n}: ningún supuesto la toca y su ${k.toLowerCase()} cambió`);
    }
    /* el supuesto que el bloque dice es exactamente el que la toca: su magnitud está en la columna y los que no la tocan, no */
    const dicho = String(s.supuesto || "");
    for (const x of supuestos) {
      const mag = x.unidad === "money" ? formatoDeLaCasa(Math.abs(x.valor), "money") : String(Math.abs(x.valor));
      const toca = e.aplicables.includes(x);
      const nombreTipo = { price: "precio", growth: "volumen", costo: "costo", margin: "margen", carga: "carga" }[x.tipo];
      const aparece = new RegExp(`${nombreTipo}[^,y]*?${mag.replace(/[.$]/g, "\\$&")}`, "i").test(dicho);
      if (toca && !aparece) v.push(`${n}: el supuesto dice «${dicho}» y no nombra ${nombreTipo} ${mag} que sí la toca`);
      if (!toca && aparece && e.aplicables.length > 0) v.push(`${n}: el supuesto dice «${dicho}» e incluye ${nombreTipo} ${mag} que NO la toca`);
    }
  }
  return v;
}

/* ═══ 3 · LA ENUMERACIÓN: tipos × combinaciones × alcances × formas de pedirlo ═════════════════════════════════════════════════════════════════════════════════════ */
const VARIANTES = {
  growth: [{ tipo: "growth", unidad: "pct", valor: 4 }, { tipo: "growth", unidad: "money", valor: null }],
  price: [{ tipo: "price", unidad: "pct", valor: -2 }],
  costo: [{ tipo: "costo", unidad: "pct", valor: 6 }],
  margin: [{ tipo: "margin", unidad: "pct", valor: 1.5 }],
  carga: [{ tipo: "carga", unidad: "pp", valor: -0.4 }],
};
const TIPOS = Object.keys(VARIANTES);
function subconjuntos(max) {
  const out = [];
  const rec = (i, acc) => { if (acc.length) out.push(acc.slice()); if (acc.length === max) return; for (let j = i; j < TIPOS.length; j++) { acc.push(TIPOS[j]); rec(j + 1, acc); acc.pop(); } };
  rec(0, []);
  return out;
}
function combinaciones() {
  const out = [];
  for (const tipos of subconjuntos(3)) {
    const prod = tipos.reduce((acc, t) => acc.flatMap((a) => VARIANTES[t].map((v) => [...a, v])), [[]]);
    for (const vs of prod) out.push(vs);
  }
  return out;
}

async function bateria(etiqueta, tenant, soloFormas = null) {
  const ds = tenant.dataset;
  const A = crearAcciones({ continuidad: crearAlmacenEnMemoria() });
  const catalogo = conTenantActivo(ds, () => construirCatalogo());
  const fx = escalaDe(ds);
  /* lo que el CATÁLOGO ofrece: cada tipo comercial y dónde corre — la batería recorre ESA oferta, no una lista aparte */
  const oferta = {};
  for (const s of catalogo.supuestosAdmitidos || []) if (s.alcances && s.alcances.comercial) oferta[s.tipo] = s.alcances.comercial.slice();
  const alcancesOfrecidos = ["negocio", ...EJES];
  ok(TIPOS.every((t) => oferta[t] && alcancesOfrecidos.every((a) => oferta[t].includes(a))), `[${etiqueta}] el catálogo ofrece los cinco tipos comerciales (precio · volumen · costo · margen · carga) en el negocio y en cada eje (cuenta · marca · familia · producto)`, JSON.stringify(oferta));
  const combos = combinaciones();
  const nombres = Object.fromEntries(EJES.map((e) => [e, nombresDe(ds, e)]));
  let n = 0, malos = [], correspondencias = 0;
  const casos = [];
  const ent = (eje, i) => nombres[eje][i];
  for (const combo of combos) {
    /* formas de pedirlo */
    const formas = [];
    formas.push({ id: "negocio·total", eje: "cliente", alcance: () => "negocio", entidades: [], universo: [], conTotal: true });
    for (const eje of EJES) {
      formas.push({ id: `negocio·${eje}·entidades`, eje, alcance: () => "negocio", entidades: [ent(eje, 0), ent(eje, 1)], universo: [ent(eje, 0), ent(eje, 1)], conTotal: false });
      formas.push({ id: `${eje}·una tocada y una intacta`, eje, alcance: () => ({ eje, nombre: ent(eje, 0) }), entidades: [ent(eje, 0), ent(eje, 1)], universo: [ent(eje, 0), ent(eje, 1)], conTotal: false });
      formas.push({ id: `${eje}·entidad y total del negocio`, eje, alcance: () => ({ eje, nombre: ent(eje, 0) }), entidades: [], universo: [ent(eje, 0)], conTotal: true });
      formas.push({ id: `${eje}·entidades y el total (universo negocio)`, eje, alcance: () => ({ eje, nombre: ent(eje, 0) }), entidades: [ent(eje, 0), ent(eje, 1)], universo: [ent(eje, 0), ent(eje, 1)], conTotal: true, universoNegocio: true });
      if (combo.length > 1) formas.push({ id: `${eje}·negocio mezclado con la entidad`, eje, alcance: (i) => (i === 0 ? "negocio" : { eje, nombre: ent(eje, 0) }), entidades: [ent(eje, 0), ent(eje, 1)], universo: [ent(eje, 0), ent(eje, 1)], conTotal: false });
    }
    for (const forma of formas) {
      if (soloFormas && !soloFormas.includes(forma.id)) continue;
      const total = nombres[forma.eje].reduce((s, nm) => s + filaCruda(ds, forma.eje, nm).V, 0);
      const supuestos = combo.map((c, i) => {
        const alcance = forma.alcance(i);
        let valor = c.valor;
        if (c.unidad === "money") { const base = alcance === "negocio" ? total : filaCruda(ds, forma.eje, ent(forma.eje, 0)).V; valor = Math.round((base * fx * 0.03) / 1000) * 1000; }
        return { id: `s${i + 1}`, tipo: c.tipo, valor, unidad: c.unidad, alcance };
      });
      casos.push({ etiqueta: `${etiqueta} · ${combo.map((c) => `${c.tipo}${c.unidad === "money" ? "$" : ""}`).join("+")} · ${forma.id}`, forma, supuestos });
    }
  }
  for (const c of casos) {
    const parte = { id: "p1", tema: "comercial", cierre: "simulacion", supuestos: c.supuestos.map((s) => s.id), ...(c.forma.entidades.length ? { eje: c.forma.eje, entidades: c.forma.entidades.map((nombre) => ({ nombre, eje: c.forma.eje })) } : {}), ...(c.forma.universoNegocio ? { universo: "negocio" } : {}) };
    const r = await A.consultar({ tenant, encargo: { version: "encargo/v1", supuestos: c.supuestos, partes: [parte] } });
    n++;
    if (!(r.ok === true && (r.noResuelto || []).length === 0)) { malos.push(`${c.etiqueta}: no corrió (${(r.noResuelto || []).map((x) => x.motivo + ": " + (x.detalle || "")).join(" | ").slice(0, 200)})`); continue; }
    const salida = leerSalida(r);
    const v = verificarCaso({ ds, eje: c.forma.eje, universo: c.forma.universo, conTotal: c.forma.conTotal, supuestos: c.supuestos, salida });
    if (v.length) malos.push(`${c.etiqueta}: ${v.slice(0, 3).join(" | ")}`);
    else correspondencias += salida.size;
  }
  ok(malos.length === 0, `★ [${etiqueta}] ${n} simulaciones (${combos.length} combinaciones de 1 a 3 supuestos × ${soloFormas ? soloFormas.length : "17 a 21"} formas) → TODA cifra simulada coincide con el oráculo de las tablas y respeta venta = costo + acciones + contribución y margen = contribución ÷ venta (${correspondencias} entidades verificadas)`, malos.slice(0, 6).join("\n      "));
  return { A, tenant, ds, casos: n };
}

/* ═══ 4 · EL RECHAZO QUE ENSEÑA ═══════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════ */
async function rechazos(etiqueta, tenant) {
  const ds = tenant.dataset;
  const A = crearAcciones({ continuidad: crearAlmacenEnMemoria() });
  const nm = Object.fromEntries(EJES.map((e) => [e, nombresDe(ds, e)]));
  const C = (supuestos, partes) => A.consultar({ tenant, encargo: { version: "encargo/v1", supuestos, partes } });
  const P = (sup, ents, eje) => ({ id: "p1", tema: "comercial", cierre: "simulacion", supuestos: sup, ...(ents ? { eje, entidades: ents.map((nombre) => ({ nombre, eje })) } : {}) });
  const sinCifras = (r) => !r.entrega || !String(r.entrega.texto || "").match(/Venta supuesta|La venta (pasaría|se mantiene)/);
  const casos = [
    ["ejes distintos (marca y cuenta) sin cruce", [{ id: "s1", tipo: "price", valor: 2, unidad: "pct", alcance: { eje: "marca", nombre: nm.marca[0] } }, { id: "s2", tipo: "costo", valor: 3, unidad: "pct", alcance: { eje: "cliente", nombre: nm.cliente[0] } }], P(["s1", "s2"]), /ejes distintos/],
    ["el resultado es de otro eje que el supuesto", [{ id: "s1", tipo: "price", valor: 2, unidad: "pct", alcance: { eje: "marca", nombre: nm.marca[0] } }], P(["s1"], [nm.cliente[0]], "cliente"), /no tiene el cruce/],
    ["dos supuestos del mismo tipo sobre la misma entidad (negocio y la entidad)", [{ id: "s1", tipo: "growth", valor: 2, unidad: "pct", alcance: "negocio" }, { id: "s2", tipo: "growth", valor: 3, unidad: "pct", alcance: { eje: "cliente", nombre: nm.cliente[0] } }], P(["s1", "s2"], [nm.cliente[0]], "cliente"), /misma entidad/],
    ["dos supuestos del mismo tipo sobre la misma entidad (dos veces la entidad)", [{ id: "s1", tipo: "price", valor: 2, unidad: "pct", alcance: { eje: "marca", nombre: nm.marca[0] } }, { id: "s2", tipo: "price", valor: 3, unidad: "pct", alcance: { eje: "marca", nombre: nm.marca[0] } }], P(["s1", "s2"]), /misma entidad/],
    ["un supuesto que no toca a lo pedido", [{ id: "s1", tipo: "growth", valor: 2, unidad: "pct", alcance: { eje: "cliente", nombre: nm.cliente[1] } }], P(["s1"], [nm.cliente[0]], "cliente"), /no toca a ninguna/],
    ["precio fuera de rango", [{ id: "s1", tipo: "price", valor: 80, unidad: "pct", alcance: "negocio" }], P(["s1"]), /no es un supuesto operable/],
    ["carga fuera de rango", [{ id: "s1", tipo: "carga", valor: -25, unidad: "pp", alcance: "negocio" }], P(["s1"]), /no es un supuesto operable/],
    ["margen fuera de rango", [{ id: "s1", tipo: "margin", valor: 30, unidad: "pct", alcance: "negocio" }], P(["s1"]), /no es un supuesto operable/],
    ["un supuesto que no mueve nada (0)", [{ id: "s1", tipo: "costo", valor: 0, unidad: "pct", alcance: "negocio" }], P(["s1"]), /no mueve nada/],
    ["un crecimiento en dinero que equivale a más de la mitad de la venta", [{ id: "s1", tipo: "growth", valor: Math.round(nm.cliente.reduce((s, x) => s + filaCruda(ds, "cliente", x).V, 0) * escalaDe(ds) * 0.8), unidad: "money", alcance: "negocio" }], P(["s1"]), /equivale a \+80% de volumen/],
  ];
  for (const [nombre, sup, parte, rx] of casos) {
    const r = await C(sup, [parte]);
    const motivos = (r.noResuelto || []).map((x) => `${x.motivo}: ${x.detalle || ""}`).join(" | ");
    const rechazado = r.ok === false || (r.noResuelto || []).length > 0;
    ok(rechazado && sinCifras(r) && (!rx || rx.test(motivos)), `[${etiqueta}] se rechaza SIN cifras y con su razón: ${nombre}`, motivos.slice(0, 260) || JSON.stringify(r).slice(0, 200));
  }
  /* más de tres supuestos: el conjunto entero se rechaza (el tope del Encargo) y ninguna simulación corre «con los primeros» */
  const cuatro = ["price", "costo", "carga", "margin"].map((t, i) => ({ id: `s${i + 1}`, tipo: t, valor: t === "carga" ? -0.4 : 1, unidad: t === "carga" ? "pp" : "pct", alcance: "negocio" }));
  const r4 = await C(cuatro, [P(["s1", "s2", "s3", "s4"])]);
  ok(r4.ok === false && sinCifras(r4) && (r4.noResuelto || []).some((x) => x.motivo === "supuesto_tope"), `[${etiqueta}] cuatro supuestos: el tope del Encargo rechaza el conjunto entero, no corre con los tres primeros`);
}

/* ═══ 5 · SIN MODELO DE COSTO DECLARADO ═══════════════════════════════════════════════════════════════════════════════════════════════════════════════════════ */
async function sinModeloDeCosto() {
  const T2 = { id: "empresa2", nombre: "Empresa 2", dataset: TENANT_EMPRESA2, version: 1, sello: null };
  const A = crearAcciones({ continuidad: crearAlmacenEnMemoria() });
  const nombre = TENANT_EMPRESA2.clientesVentas[0].nombre;
  const P = { id: "p1", tema: "comercial", cierre: "simulacion", supuestos: ["s1"], eje: "cliente", entidades: [{ nombre, eje: "cliente" }] };
  const sup = (tipo, valor, unidad = "pct") => ({ id: "s1", tipo, valor, unidad, alcance: { eje: "cliente", nombre } });
  const rPrecio = await A.consultar({ tenant: T2, encargo: { version: "encargo/v1", supuestos: [sup("price", 3)], partes: [P] } });
  ok(rPrecio.ok === true && /Contribución supuesta/.test(rPrecio.entrega.texto), "[sin modelo de costo] un cambio de precio NO necesita el modelo (el costo no se mueve con el precio): se calcula completo");
  const rVol = await A.consultar({ tenant: T2, encargo: { version: "encargo/v1", supuestos: [sup("growth", 4)], partes: [P] } });
  ok(rVol.ok === true && /Venta supuesta/.test(rVol.entrega.texto) && !/Costo supuesto|Contribución supuesta|Margen supuesto/.test(rVol.entrega.texto), "[sin modelo de costo] un cambio de volumen solo se limita a la VENTA (degrade honesto): ni costo, ni contribución, ni margen inventados");
  const rMix = await A.consultar({ tenant: T2, encargo: { version: "encargo/v1", supuestos: [sup("growth", 4), { ...sup("costo", 5), id: "s2" }], partes: [{ ...P, supuestos: ["s1", "s2"] }] } });
  ok(rMix.ok === false && !/Contribución supuesta|Costo supuesto/.test(String((rMix.entrega || {}).texto || "")) && (rMix.noResuelto || []).some((x) => /no declaró cómo escala su costo con el volumen/.test(x.detalle || "")), "[sin modelo de costo] volumen + costo no se combina sin un modelo declarado: se rechaza con su razón y no hay contribución ni costo inventados", JSON.stringify(rMix.noResuelto).slice(0, 300));
}

/* ═══ 6 · LOS NÚMEROS DEL ENSAYO, A MANO, ANTES Y DESPUÉS ═════════════════════════════════════════════════════════════════════════════════════════════════════ */
async function numerosDelEnsayo() {
  const T = { id: "demo", nombre: "ADI Demo", dataset: TENANT_DEMO, version: 1, sello: null };
  const A = crearAcciones({ continuidad: crearAlmacenEnMemoria() });
  const S = (id, tipo, valor, alcance = { eje: "marca", nombre: "Samsung" }) => ({ id, tipo, valor, unidad: "pct", alcance });
  const P = (ids, ents = [{ nombre: "Samsung", eje: "marca" }]) => ({ id: "p1", tema: "comercial", cierre: "simulacion", supuestos: ids, ...(ents ? { eje: "marca", entidades: ents } : {}) });
  /* Samsung, a mano (miles): venta 31.600 · costo 22.854 · acciones 1.367 · contribución 7.379 → 31.600 = 22.854 + 1.367 + 7.379.
   * precio +5 % y costo +10 %: venta 33.180 · costo 25.139,4 · acciones 1.367 → contribución 33.180 − 25.139,4 − 1.367 = 6.673,6 → margen 20,1 % (el sondeo daba 31,1 %). */
  const r = await A.consultar({ tenant: T, encargo: { version: "encargo/v1", supuestos: [S("s1", "price", 5), S("s2", "costo", 10)], partes: [P(["s1", "s2"])] } });
  const m = leerSalida(r).get("Samsung").m;
  ok(m["Venta supuesta"].raw === 33180000 && aprox(m["Costo supuesto"].raw, 25139400, 1e-9) && aprox(m["Contribución supuesta"].raw, 6673600, 1e-9) && m["Margen supuesto"].raw === 20.1, "★ ensayo 9 · precio +5 % y costo +10 % sobre Samsung: venta $33.180K, costo $25.139K, contribución $6.674K, margen 20.1 % (el sondeo daba 31.1 %: ignoraba el costo)", JSON.stringify(m));
  ok(m["Margen actual"].raw === 23.4 && m["Contribución actual"].raw === 7379000, "★ el margen ACTUAL de la simulación es el del dato (23.4 %), no 27.7 % (venta − costo sin acciones) ni 23.4 % «según el orden de los supuestos»");
  /* el orden de los supuestos no cambia nada */
  const r2 = await A.consultar({ tenant: T, encargo: { version: "encargo/v1", supuestos: [S("s1", "costo", 10), S("s2", "price", 5)], partes: [P(["s1", "s2"])] } });
  const m2 = leerSalida(r2).get("Samsung").m;
  ok(JSON.stringify(Object.fromEntries(Object.entries(m).map(([k, x]) => [k, x.raw]))) === JSON.stringify(Object.fromEntries(Object.entries(m2).map(([k, x]) => [k, x.raw]))), "★ el ORDEN de los supuestos no cambia ninguna cifra (antes «Margen actual» salía 23.4 % o 27.7 % según el orden)");
  /* costo +10 % solo: ahora trae contribución y margen (antes devolvía únicamente el costo) */
  const rc = await A.consultar({ tenant: T, encargo: { version: "encargo/v1", supuestos: [S("s1", "costo", 10)], partes: [P(["s1"])] } });
  const mc = leerSalida(rc).get("Samsung").m;
  ok(aprox(mc["Contribución supuesta"].raw, 7379000 - 2285400, 1e-9) && mc["Margen supuesto"].raw === 16.1 && mc["Venta supuesta"].raw === 31600000, "★ ensayo 9 · costo +10 % solo: contribución $5.094K y margen 16.1 % (antes: solo «El costo pasaría de $22.9M a $25.1M»)");
  /* costo +10 % sobre el negocio: antes supuesto_sin_productor */
  const rn = await A.consultar({ tenant: T, encargo: { version: "encargo/v1", supuestos: [{ id: "s1", tipo: "costo", valor: 10, unidad: "pct", alcance: "negocio" }], partes: [{ id: "p1", tema: "comercial", cierre: "simulacion", supuestos: ["s1"] }] } });
  const mn = leerSalida(rn).get("Negocio");
  ok(rn.ok === true && mn && mn.m["Venta supuesta"].raw === 100000000 && aprox(mn.m["Contribución supuesta"].raw, 25057000 - 7086800, 1e-9), "★ ensayo 9 · costo +10 % sobre el negocio: corre (antes «supuesto_sin_productor»): contribución $25.057K − 10 % del costo sin acciones ($70.868K) = $17.970K", JSON.stringify(mn));
  /* B02 2.4: crecer 10 % en Línea Blanca → la venta total del negocio con el supuesto */
  const rb = await A.consultar({ tenant: T, encargo: { version: "encargo/v1", supuestos: [{ id: "s1", tipo: "growth", valor: 10, unidad: "pct", alcance: { eje: "familia", nombre: "Línea Blanca" } }], partes: [{ id: "p1", tema: "comercial", cierre: "simulacion", conceptos: ["ventas"], eje: "familia", supuestos: ["s1"] }] } });
  const sb = leerSalida(rb);
  ok(aprox(sb.get("Línea Blanca").m["Venta supuesta"].raw, 27060000) && aprox(sb.get("Negocio").m["Venta supuesta"].raw, 102460000), "★ ensayo 9 (B02 2.4) · +10 % en Línea Blanca: la venta del negocio con el supuesto es $102.460K = 100.000 + 2.460 — ADI la entrega, el anfitrión no la calcula");
  /* la herramienta del oráculo y del agente (simulateGeneral) comparte la corrección: Samsung ya no sale con 27.7 % */
  const g = TOOLS.simulateGeneral({ dimension: "marca", entity: "Samsung", variableA: { campo: "precioLista", delta_pct: 5 }, variableB: { campo: "unidades", delta_pct: 0.0001 } });
  const gm = Object.fromEntries(g.boleta.map((f) => [f.label, f.raw]));
  ok(g.facts.margenActual === "23.4%" && gm["Samsung · Contribución actual"] === 7379000, "★ simulateGeneral (oráculo/agente) sobre una marca: margen actual 23.4 % y contribución $7.379K (antes 27.7 % y $8.7M: venta − costo sin acciones)", JSON.stringify(g.facts).slice(0, 300));
}

/* ═══ 7 · CARNADAS ═══════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════ */
async function carnadas() {
  const T = { id: "demo", nombre: "ADI Demo", dataset: TENANT_DEMO, version: 1, sello: null };
  const ds = TENANT_DEMO;
  const A = crearAcciones({ continuidad: crearAlmacenEnMemoria() });
  const al = { eje: "marca", nombre: "Samsung" };
  const S = (id, tipo, valor, unidad = "pct", alcance = al) => ({ id, tipo, valor, unidad, alcance });
  const P = (ids) => ({ id: "p1", tema: "comercial", cierre: "simulacion", supuestos: ids, eje: "marca", entidades: [{ nombre: "Samsung", eje: "marca" }] });
  const correr = async (supuestos, ids) => leerSalida(await A.consultar({ tenant: T, encargo: { version: "encargo/v1", supuestos, partes: [P(ids)] } }));
  const base = { ds, eje: "marca", universo: ["Samsung"], conTotal: false };
  const completo = [S("s1", "price", 5), S("s2", "costo", 10), S("s3", "carga", -1, "pp")];
  const buena = await correr(completo, ["s1", "s2", "s3"]);
  ok(verificarCaso({ ...base, supuestos: completo, salida: buena }).length === 0, "(control) la salida real de precio + costo + carga pasa el comparador");
  const clon = (s) => new Map([...s].map(([k, v]) => [k, { supuesto: v.supuesto, m: Object.fromEntries(Object.entries(v.m).map(([a, b]) => [a, { ...b }])) }]));
  const rojo = (nombre, salida, supuestos = completo) => ok(verificarCaso({ ...base, supuestos, salida }).length > 0, `CARNADA «${nombre}» → el comparador se pone ROJO`);
  /* 1 · el costo no entra (el sondeo: costo + precio daba el margen del precio) */
  rojo("el costo +10 % no entra en la contribución ni el margen (sondeo del ensayo 9)", await correr([S("s1", "price", 5), S("s3", "carga", -1, "pp")], ["s1", "s3"]));
  /* 2 · la contribución como venta − costo SIN acciones (el defecto de simulateGeneral en marca/familia/producto) */
  { const s = clon(buena); const m = s.get("Samsung").m; m["Contribución supuesta"].raw = m["Venta supuesta"].raw - m["Costo supuesto"].raw; m["Margen supuesto"].raw = +((100 * m["Contribución supuesta"].raw) / m["Venta supuesta"].raw).toFixed(1); rojo("contribución = venta − costo sin las acciones comerciales (Samsung 27.7 % donde el dato dice 23.4 %)", s); }
  /* 3 · el margen actual del sondeo, 27.7 % */
  { const s = clon(buena); s.get("Samsung").m["Margen actual"].raw = 27.7; rojo("«Margen actual» 27.7 % (según el orden de los supuestos)", s); }
  /* 4 · el supuesto que se calla (se calcula con dos de tres) */
  rojo("el supuesto de carga se calla (precio + costo en lugar de precio + costo + carga)", await correr([S("s1", "price", 5), S("s2", "costo", 10)], ["s1", "s2"]));
  /* 5 · el margen de un supuesto «margen» que sube el costo en vez de bajarlo */
  { const s1 = [S("s1", "margin", 2)]; const buenaM = await correr(s1, ["s1"]); ok(verificarCaso({ ...base, supuestos: s1, salida: buenaM }).length === 0, "(control) margen +2 puntos pasa el comparador");
    const s = clon(buenaM); const m = s.get("Samsung").m; m["Costo supuesto"].raw = m["Costo actual"].raw * 1.02; m["Contribución supuesta"].raw = m["Contribución actual"].raw - 0.02 * m["Costo actual"].raw; m["Margen supuesto"].raw = +((100 * m["Contribución supuesta"].raw) / m["Venta supuesta"].raw).toFixed(1);
    rojo("«el margen sube 2» interpretado como costo +2 % (la contribución baja)", s, s1); }
  /* 6 · la identidad rota por $1 */
  { const s = clon(buena); s.get("Samsung").m["Contribución supuesta"].raw += 1; rojo("la contribución supuesta se corre $1 (venta = costo + acciones + contribución se rompe)", s); }
  /* 7 · una cifra impresa que no es la exacta */
  { const s = clon(buena); s.get("Samsung").m["Venta supuesta"].valor = "$33.9M"; rojo("la venta impresa $33.9M no es su cifra exacta $33.18M", s); }
  /* 8 · el tope de carga ignorado: el negocio baja 6 puntos y las cuentas de carga menor no pueden quedar negativas */
  { const sup = [{ id: "s1", tipo: "carga", valor: -6, unidad: "pp", alcance: "negocio" }];
    const rr = await A.consultar({ tenant: T, encargo: { version: "encargo/v1", supuestos: sup, partes: [{ id: "p1", tema: "comercial", cierre: "simulacion", supuestos: ["s1"] }] } });
    const salida = leerSalida(rr); const c = { ds, eje: "cliente", universo: [], conTotal: true, supuestos: sup };
    ok(verificarCaso({ ...c, salida }).length === 0 && salida.get("Negocio").m["Carga supuesta"].raw === 0 && /no puede quedar negativa/i.test(rr.entrega.texto), "el tope de carga: bajar 6 puntos con cargas de 1.8 a 5.5 deja la carga en 0 (nunca negativa) y la Entrega lo declara");
    const s = clon(salida); s.get("Negocio").m["Carga supuesta"].raw = -1.9; rojo("la carga queda NEGATIVA (el tope en cero se ignora)", s, sup);
    /* el comparador toma el negocio con su universo */
    const okTotal = verificarCaso({ ...c, salida: s }).length > 0; ok(okTotal, "   (y la carnada del tope se evalúa sobre el total del negocio)"); }
  /* 9 · el oráculo ve una entidad de más (un resultado que mezcla entidades no pedidas) */
  { const s = clon(buena); s.set("LG", { supuesto: "x", m: { "Venta actual": { raw: 1, valor: "$1" } } }); rojo("el resultado trae una entidad que nadie pidió (LG)", s); }
  /* 10 · el modelo, directo: un costo que queda negativo se declina, no se publica */
  const fila = baseDeFila({ venta: 1000, costo: 100, rebates: 50, contribucion: 850 });
  ok(simularFila(fila, { margin: 20 }).ok === false, "el modelo: un margen +20 puntos que dejaría el costo de los productos negativo se DECLINA (no se publica una contribución imposible)");
  ok(simularFila(fila, { costo: 10, price: 5 }).ok === true && simularFila(fila, { costo: 10, price: 5 }).K1 !== simularFila(fila, { price: 5 }).K1, "el modelo: el costo +10 % SÍ mueve la contribución cuando se combina con el precio");
}

/* ═══ CORRIDA ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════ */
H("1 · LA BATERÍA · cada combinación × alcance × forma × tenant contra el oráculo de las tablas");
const TENANTS = [
  ["demo", { id: "demo", nombre: "ADI Demo", dataset: TENANT_DEMO, version: 1, sello: null }],
  ["Río Claro v1", { id: EMPRESA_NO_DEMO.id, nombre: EMPRESA_NO_DEMO.nombre, dataset: packRenombrado({ version: 1 }), version: 1, sello: null }],
  ["Río Claro v2", { id: EMPRESA_NO_DEMO.id, nombre: EMPRESA_NO_DEMO.nombre, dataset: packRenombrado({ version: 2 }), version: 2, sello: null }],
];
let totalCasos = 0;
/* demo y Río Claro v1: TODAS las formas · Río Claro v2 (la carga que cambia entre sesiones): cuatro formas representativas — el tiempo de un gate también es un costo */
const FORMAS_DE_V2 = ["negocio·total", "cliente·entidades y el total (universo negocio)", "cliente·una tocada y una intacta", "marca·entidad y total del negocio", "sku·negocio mezclado con la entidad", "familia·una tocada y una intacta"];
for (const [etiqueta, tenant] of TENANTS) { initTenant(tenant.dataset); const r = await bateria(etiqueta, tenant, etiqueta === "Río Claro v2" ? FORMAS_DE_V2 : null); totalCasos += r.casos; }
console.log(`   · ${totalCasos} simulaciones corridas contra el oráculo en ${TENANTS.length} empresas`);

H("2 · EL RECHAZO ENSEÑA · lo que no se puede combinar vuelve con su razón y sin cifras");
for (const [etiqueta, tenant] of TENANTS.slice(0, 2)) { initTenant(tenant.dataset); await rechazos(etiqueta, tenant); }

H("3 · SIN MODELO DE COSTO DECLARADO (empresa2)");
await sinModeloDeCosto();

H("4 · LOS NÚMEROS DEL ENSAYO 9, A MANO");
initTenant(TENANT_DEMO);
await numerosDelEnsayo();

H("5 · CARNADAS · cada defecto del sondeo reconstruido pone el comparador en rojo");
initTenant(TENANT_DEMO);
await carnadas();

console.log(`\n── _simulacion_combinada_gate: PASS ${pass} · FAIL ${fail} (de ${pass + fail}) ──`);
if (fail) { console.log("\nFALLAS:"); for (const f of fallas) console.log("  - " + f); process.exit(1); }
