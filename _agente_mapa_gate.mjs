/* === _agente_mapa_gate.mjs · EL MAPA FIEL, ACOTADO Y DETERMINÍSTICO (ADI Agente · F2 · owner 2026-08-30) =====
 *
 * El mapa es lo único que el cerebro del agente ve del dato ANTES de pedir herramientas. Sus cuatro leyes,
 * cada una con carnada:
 *   1 · FIEL IDA: todo lo que declara existir, existe en el pack (una entidad fantasma hace que el cerebro
 *       pida herramientas que no van a responder);
 *   2 · FIEL VUELTA: todo eje con datos está declarado (un eje omitido hace que el cerebro no pida la
 *       herramienta que sí respondería);
 *   3 · TOPE PROBADO: ≤ 4.800 chars (~1.300 tok) medido sobre el demo, un pack con historia Y un pack de 500
 *       clientes — con listas largas se trunca DECLARANDO la cola;
 *   4 · LÍMITES SIN INVENTAR: sello de carga / sin presupuesto / serie bloqueada se dicen si el dato los
 *       tiene, y NUNCA al revés;
 *   5 · DETERMINÍSTICO BYTE A BYTE: mismo pack + escenario → mismo texto. El caché de prefijo del proveedor
 *       (y la tabla de costos del F1) dependen de esto;
 *   6 · EL ORDEN LO FIJA EL MAPA: el mismo dato en OTRO orden de inserción produce el mismo byte.
 *
 * OFFLINE · determinístico · no puede gastar.
 * `node --import ./scripts/offline-guard.mjs _agente_mapa_gate.mjs`
 */
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { initTenant } from "./src/data/tenantStore.js";
import { TENANT_DEMO } from "./src/data/tenants/demo.js";
import { plantillaEjemplo } from "./src/ingesta/plantilla/generarPlantilla.js";
import { ingestarPlantilla } from "./src/ingesta/plantilla/ingestarPlantilla.js";
import { calcularDataset } from "./src/ingesta/plantilla/motorKpi.js";
import { setCargaActiva, limpiarCarga } from "./src/ingesta/estadoCarga.js";
import { mapaDelDato } from "./src/adi/agente/mapaDelDato.js";

let pass = 0, fail = 0;
const ok = (cond, label, detalle) => {
  if (cond) { pass++; console.log(`  ✓ ${label}`); }
  else { fail++; console.log(`  ✗ ${label}`); if (detalle !== undefined) console.log(`      ${detalle}`); }
};
const H = (t) => console.log(`\n${t}`);
const TOPE_CHARS = 4800;

const PACK = ingestarPlantilla(Buffer.from(plantillaEjemplo()), { nombreArchivo: "v2.xlsx", fechaCarga: "2026-08-31" }).dataset;

// un pack GRANDE: 500 clientes, para el tope
const filas500 = [];
for (let i = 1; i <= 500; i++) {
  filas500.push({ periodo: "2026-08", fecha: "2026-08-15", cliente: `Cuenta ${String(i).padStart(3, "0")}`, sku: `SKU-${i % 40}`,
    marca: `Marca ${i % 7}`, sfamilia: `Familia ${i % 5}`, unidades: 5, venta: 1000 + i, costo: 700, acciones: 30,
    folio: `F-${i}`, tipoDoc: "factura", condicion: "contado", canal: i % 2 ? "Mayorista" : "Retail", bodega: "Central", precioLista: null });
}
const GRANDE = calcularDataset({ parametros: { empresa_id: "g", empresa_nombre: "Grande SpA", periodo_actual: "2026-08-31", moneda: "CLP" },
  tablas: { Ventas: filas500, Inventario: [] }, fechaCarga: "2026-08-31" }).dataset;

/* ── el verificador de fidelidad · parsea el mapa y lo confronta con el pack ─────────────────────────────────── */
function nombresDeclarados(mapa, eje) {
  const linea = mapa.split("\n").find((l) => l.startsWith(`- ${eje} (`));
  if (!linea) return null;
  const m = linea.match(/\((\d+): (.*?)(?: … y \d+ más.*)?\)$/);
  if (!m) return null;
  return { total: Number(m[1]), listados: m[2].split(", ").map((s) => s.trim()) };
}
function universoDe(d, eje) {
  if (eje === "cliente") return (d.clientesVentas || []).map((c) => c.nombre);
  if (eje === "sku") return (d.skusMargen || []).map((s) => s.nombre);
  if (eje === "marca") return ((d.marcasMargen && d.marcasMargen.length ? d.marcasMargen : d.marcasVentas) || []).map((x) => x.nombre);
  if (eje === "familia") return ((d.sfamiliasMargen && d.sfamiliasMargen.length ? d.sfamiliasMargen : d.sfamiliasVentas) || []).map((x) => x.nombre);
  if (eje === "bodega") return [...new Set((d.skuInventario || []).map((r) => r.bodega).filter(Boolean))];
  if (eje === "canal") return [...new Set((d.clientesVentas || []).map((r) => r.canal).filter(Boolean))];
  return [];
}
const EJES = ["cliente", "sku", "marca", "familia", "bodega", "canal"];
function fielIda(mapa, d) {   // lo declarado existe
  for (const eje of EJES) {
    const dec = nombresDeclarados(mapa, eje);
    if (!dec) continue;
    const uni = new Set(universoDe(d, eje));
    for (const n of dec.listados) if (!uni.has(n)) return { ok: false, eje, fantasma: n };
    if (dec.total !== uni.size) return { ok: false, eje, fantasma: `total declarado ${dec.total} ≠ real ${uni.size}` };
  }
  return { ok: true };
}
function fielVuelta(mapa, d) {   // lo que existe está declarado
  for (const eje of EJES) {
    const hay = universoDe(d, eje).length > 0;
    const dec = nombresDeclarados(mapa, eje);
    if (hay && !dec) return { ok: false, eje };
  }
  return { ok: true };
}

/* ═══ 1-2 · FIDELIDAD EN LAS DOS DIRECCIONES ══════════════════════════════════════════════════════════════════ */
H("1 · fiel IDA y VUELTA sobre los tres packs");
for (const [nombre, d] of [["demo", TENANT_DEMO], ["planilla", PACK], ["grande(500)", GRANDE]]) {
  initTenant(d);
  const mapa = mapaDelDato("actual");
  const ida = fielIda(mapa, d);
  ok(ida.ok, `${nombre}: todo lo declarado existe`, JSON.stringify(ida));
  const vuelta = fielVuelta(mapa, d);
  ok(vuelta.ok, `${nombre}: todo lo que existe está declarado`, JSON.stringify(vuelta));
}

/* ═══ 3 · EL TOPE, PROBADO SOBRE EL CASO GORDO ════════════════════════════════════════════════════════════════ */
H("3 · el tope de tamaño se cumple truncando con la cola declarada");
{
  for (const [nombre, d] of [["demo", TENANT_DEMO], ["planilla", PACK], ["grande(500)", GRANDE]]) {
    initTenant(d);
    const mapa = mapaDelDato("actual");
    ok(mapa.length <= TOPE_CHARS, `${nombre}: ${mapa.length} chars ≤ ${TOPE_CHARS} (~${Math.round(mapa.length / 3.7)} tok)`);
  }
  initTenant(GRANDE);
  const m = mapaDelDato("actual");
  ok(/… y \d+ más \(pídelos con gridTable\)/.test(m), "la cola del pack de 500 se DECLARA, no se corta en silencio");
  const dec = nombresDeclarados(m, "cliente");
  ok(!!dec && dec.total === 500, "y el total real (500) viaja aunque la lista se trunque", JSON.stringify(dec && dec.total));
}

/* ═══ 4 · LÍMITES DEL DATO, NUNCA INVENTADOS ══════════════════════════════════════════════════════════════════ */
H("4 · los límites se dicen si existen — y jamás al revés");
{
  initTenant(PACK);
  let m = mapaDelDato("actual");
  ok(/sin presupuesto declarado/.test(m), "pack sin presupuesto → el mapa lo dice");
  ok(/REAL RECONCILIADA/.test(m) && /serieEntidad/.test(m), "la serie real del pack se ofrece con su herramienta");
  initTenant(TENANT_DEMO);
  m = mapaDelDato("actual");
  ok(!/sin presupuesto declarado/.test(m), "demo con presupuesto → el mapa NO inventa el límite");
  ok(/BLOQUEADA/.test(m) && /no reconcilia/.test(m), "y su serie por entidad se declara BLOQUEADA con la razón");
  ok(!/sello de carga/.test(m), "sin sello vigente, el mapa no lo nombra");
  setCargaActiva({ conAlarmas: true, confirmadoPorElUsuario: true, tipos: ["periodo-corto"] }, { nombre: "x.xlsx", empresa: "X" });
  m = mapaDelDato("actual");
  ok(/sello de carga vigente \(periodo-corto\)/.test(m), "con sello vigente, el mapa lo declara con sus tipos", m.split("\n").pop());
  limpiarCarga();
}

/* ═══ 5-6 · DETERMINISMO BYTE A BYTE ══════════════════════════════════════════════════════════════════════════ */
H("5 · mismo pack → mismos bytes · el orden lo fija el mapa, no el dato");
{
  initTenant(PACK);
  const a = mapaDelDato("actual"), b = mapaDelDato("actual");
  ok(a === b, "dos generaciones seguidas: idénticas byte a byte");
  /* el MISMO dato con otro orden de inserción: arrays al revés y el historial re-armado en otro orden de llaves */
  const alReves = {
    ...PACK,
    clientesVentas: [...PACK.clientesVentas].reverse(),
    skusMargen: [...PACK.skusMargen].reverse(),
    marcasMargen: [...PACK.marcasMargen].reverse(),
    sfamiliasMargen: [...PACK.sfamiliasMargen].reverse(),
    skuInventario: [...PACK.skuInventario].reverse(),
    historialMargen: Object.fromEntries(Object.entries(PACK.historialMargen).reverse()),
  };
  initTenant(alReves);
  const c = mapaDelDato("actual");
  ok(c === a, "el mismo dato en OTRO orden de inserción produce el MISMO byte — el caché del proveedor sobrevive");
  initTenant(PACK);
}

/* ═══ 7 · CARNADAS ════════════════════════════════════════════════════════════════════════════════════════════ */
H("6 · CARNADA · cada ley, probada ROJA con el defecto adentro");
{
  const tmp = [];
  let nCarnada = 0;
  const mutar = (rel, reemplazos) => {
    const abs = path.join(process.cwd(), rel);
    let txt = fs.readFileSync(abs, "utf8").replace(/\r\n/g, "\n");
    for (const [de, a] of reemplazos) {
      const antes = txt;
      txt = txt.replace(de, a);
      if (txt === antes) return { error: `la carnada no encontró qué mutar en ${rel}` };
    }
    const destino = abs.replace(/\.js$/, `.carnada${process.pid}_${++nCarnada}.js`);
    fs.writeFileSync(destino, txt);
    tmp.push(destino);
    return { url: pathToFileURL(destino).href };
  };
  const carnada = async (nombre, reemplazos, prueba) => {
    const m = mutar("src/adi/agente/mapaDelDato.js", reemplazos);
    if (m.error) return ok(false, `carnada «${nombre}»`, m.error);
    let cazada = false, detalle = "";
    try { cazada = await prueba(await import(m.url)); }
    catch (e) { detalle = `la copia mutada ni siquiera carga: ${e.message}`; }
    ok(cazada, `carnada «${nombre}» → el chequeo se pone ROJO`, detalle || "el defecto pasó DESAPERCIBIDO");
  };

  // (a) una entidad fantasma en el mapa → la fidelidad IDA la caza
  await carnada("entidad fantasma declarada",
    [[/L\.push\("EJES:"\);/, 'L.push("EJES:");\n  if (ejes[0][1]) ejes[0][1] = ejes[0][1].replace(/: /, ": Entidad Fantasma SA, ");']],
    async (Mut) => { initTenant(PACK); return fielIda(Mut.mapaDelDato("actual"), PACK).ok === false; });

  // (b) un eje con datos, omitido → la fidelidad VUELTA lo caza
  await carnada("eje con datos omitido del mapa",
    [[/    \["marca", _nombres\(/, '    ["marca", null && _nombres(']],
    async (Mut) => { initTenant(PACK); return fielVuelta(Mut.mapaDelDato("actual"), PACK).ok === false; });

  // (c) sin truncado, el pack de 500 revienta el tope
  await carnada("lista sin truncar (adiós tope)",
    [[/const MAX_NOMBRES = 12;/, "const MAX_NOMBRES = 100000;"]],
    async (Mut) => { initTenant(GRANDE); return Mut.mapaDelDato("actual").length > TOPE_CHARS; });

  // (d) el sello vigente, callado → el chequeo de límites lo caza
  await carnada("sello de carga silenciado",
    [[/  if \(sello && \(sello\.conAlarmas \|\| \(Array\.isArray\(sello\.tipos\) && sello\.tipos\.length\)\)\) \{[\s\S]*?\n  \}\n/, "\n"]],
    async (Mut) => {
      initTenant(TENANT_DEMO);
      setCargaActiva({ conAlarmas: true, confirmadoPorElUsuario: true, tipos: ["periodo-corto"] }, { nombre: "x.xlsx", empresa: "X" });
      const mudo = !/sello de carga/.test(Mut.mapaDelDato("actual"));
      limpiarCarga();
      return mudo;
    });

  // (e) el orden de inserción mandando → el determinismo por orden lo caza
  await carnada("orden de inserción en vez de orden fijado",
    [[/    \.sort\(_cmp\)\n/, "\n"]],
    async (Mut) => {
      initTenant(PACK);
      const a = Mut.mapaDelDato("actual");
      initTenant({ ...PACK, clientesVentas: [...PACK.clientesVentas].reverse(), skusMargen: [...PACK.skusMargen].reverse() });
      const b = Mut.mapaDelDato("actual");
      initTenant(PACK);
      return a !== b;   // el defecto: el byte depende de cómo vino el dato → el caché del proveedor muere en silencio
    });

  // (f) un timestamp en el mapa → el determinismo puro lo caza
  await carnada("un timestamp colado",
    [[/return L\.join\("\\n"\);/, 'return L.join("\\n") + "\\ngenerado:" + Math.random();']],
    async (Mut) => { initTenant(PACK); return Mut.mapaDelDato("actual") !== Mut.mapaDelDato("actual"); });

  for (const f of tmp) { try { fs.unlinkSync(f); } catch { /* */ } }
}

limpiarCarga();
initTenant(TENANT_DEMO);
console.log(`\n── _agente_mapa_gate: ${pass} PASS · ${fail} FAIL (de ${pass + fail}) ──`);
process.exit(fail ? 1 : 0);
