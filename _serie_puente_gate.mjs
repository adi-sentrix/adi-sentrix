/* === _serie_puente_gate.mjs · EL PUENTE ENTIDAD×PERÍODO, ADOPTADO CON FECHA DE RETIRO (owner 2026-08-30) =====
 *
 * EL CASO INSIGNIA QUE CIERRA, medido: «cuánto me compró Falabella el último mes» devolvía el tablero entero
 * del negocio sin nombrar a Falabella. El camino natural no tiene tools y el interceptor que su comentario
 * prometía no existía. Este PUENTE lo atiende de forma determinística hasta que ADI AGENTE certifique — nace
 * con fecha de retiro (la herramienta `serieEntidad` del agente lo reemplaza; así está declarado en el código).
 *
 * QUÉ EXIGE:
 *   1 · la pregunta insignia se responde SIN llamar al cerebro (espía) — con serie real, las cifras EXACTAS
 *       del dataset; sin serie real, declinar CORTO nombrando el límite, jamás el tablero;
 *   2 · el borde del cliente-con-nombre-de-mes («Mayo Distribuciones») no confunde el corte: la entidad se
 *       resuelve PRIMERO, su n-grama se resta, y la prioridad es película > último > mes;
 *   3 · conservador ante la duda: causalidad, comparación, simulación, sin entidad o sin métrica → al cerebro;
 *   4 · la guardia del owner intacta: el histórico sintético del demo NUNCA presta cifras.
 *
 * ⚠️ CARNADAS (sección 6): cada afirmación se prueba ROJA mutando una copia del código vivo.
 *
 * OFFLINE · determinístico · cerebro = espía inyectado · no puede gastar.
 * `node --import ./scripts/offline-guard.mjs _serie_puente_gate.mjs`
 */
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { initTenant } from "./src/data/tenantStore.js";
import { TENANT_DEMO } from "./src/data/tenants/demo.js";
import { calcularDataset } from "./src/ingesta/plantilla/motorKpi.js";
import { composeSerieIntent, detectSerieIntent } from "./src/adi/oracle/serieIntent.js";
import { answerViaNatural } from "./src/adi/oracle/caminoNatural.js";

let pass = 0, fail = 0;
const ok = (cond, label, detalle) => {
  if (cond) { pass++; console.log(`  ✓ ${label}`); }
  else { fail++; console.log(`  ✗ ${label}`); if (detalle !== undefined) console.log(`      ${detalle}`); }
};
const H = (t) => console.log(`\n${t}`);

/* ── el negocio de prueba · sintético · incluye el cliente con nombre de mes ────────────────────────────────── */
const fila = (per, cli, venta) => ({ periodo: per, fecha: `${per}-15`, cliente: cli, sku: "AX-10", marca: "Corvex",
  sfamilia: "Herrajes", unidades: 10, venta, costo: Math.round(venta * 0.7), acciones: Math.round(venta * 0.04),
  folio: `F-${cli.slice(0, 3)}-${per}`, tipoDoc: "factura", condicion: "contado", canal: "Mayorista", bodega: "Central", precioLista: null });
const PACK = calcularDataset({
  parametros: { empresa_id: "x", empresa_nombre: "X", periodo_actual: "2026-08-31", moneda: "CLP" },
  tablas: { Ventas: [
    fila("2026-06", "Mayo Distribuciones", 4000), fila("2026-07", "Mayo Distribuciones", 5000), fila("2026-08", "Mayo Distribuciones", 6000),
    fila("2026-07", "Nortania", 2000), fila("2026-08", "Nortania", 2200),
  ], Inventario: [] }, fechaCarga: "2026-08-31",
}).dataset;

const espia = () => { let llamadas = 0; return { fn: async () => { llamadas++; throw new Error("freno del espía"); }, veces: () => llamadas }; };

/* ═══ 1 · EL CASO INSIGNIA · nunca más el tablero ═════════════════════════════════════════════════════════════ */
H("1 · «cuánto me compró Falabella el último mes» — el turno del owner, cerrado");
{
  initTenant(TENANT_DEMO);
  const e = espia();
  const r = await answerViaNatural({ text: "cuanto me compro falabella el ultimo mes", history: [], mem: {}, scenario: "actual", callNatural: e.fn });
  ok(e.veces() === 0, "el turno se responde SIN llamar al cerebro (cero gasto)");
  ok(/Falabella/.test(r.r.text), "y nombra a Falabella — lo que el tablero jamás hizo");
  ok(/no reconcilia|hist[oó]rico de muestra/.test(r.r.text), "declina por la razón verdadera: el histórico de muestra no reconcilia", r.r.text);
  ok(!/\$\d/.test(r.r.text), "declina CORTO: ni una cifra del sintético, ni un KPI del tablero", r.r.text);
  ok(r.r.text.length < 400, `y en corto de verdad (${r.r.text.length} chars, no ~12 KPIs)`);
  ok(!!r.r.sentrixAction, "con la puerta a la ficha de Falabella — se declina guiando, no con un portazo");
  ok(r.r.deterministic === true && r.r.route === "natural", "declarado determinístico, ruta natural");
}

/* ═══ 2 · CON SERIE REAL, LAS CIFRAS EXACTAS DEL DATASET ═════════════════════════════════════════════════════ */
H("2 · dato real reconciliado → la respuesta, con las cifras del archivo");
{
  initTenant(PACK);
  const r1 = composeSerieIntent({ q: "cuanto me compro Nortania el ultimo mes", scenario: "actual" });
  ok(!!r1 && r1.text === "En agosto 2026, Nortania te compró $2.200 (10 unidades). En julio 2026 habían sido $2.000: +10,0%.",
    "punto del último mes: cifra, unidades y delta EXACTOS contra el dataset", r1 && r1.text);
  const r2 = composeSerieIntent({ q: "margen de Nortania en agosto", scenario: "actual" });
  const esperado = PACK.historialMargen["Nortania"].find((p) => p.periodo === "2026-08").margen;
  const esperadoFmt = `${(+esperado).toFixed(1).replace(".", ",")}%`;   // la forma de pantalla del propio módulo
  ok(!!r2 && r2.text.includes(esperadoFmt), `el margen del mes es el del dataset (${esperadoFmt})`, r2 && r2.text);
  const r3 = composeSerieIntent({ q: "la venta de Nortania mes a mes", scenario: "actual" });
  ok(!!r3 && /Jul \$2\.000 · Ago \$2\.200/.test(r3.text) && /Total del rango: \$4\.200/.test(r3.text),
    "la película lista los meses y el total suma exacto", r3 && r3.text);
  const r4 = composeSerieIntent({ q: "cuanto me compro Nortania en mayo", scenario: "actual" });
  /* la serie de Nortania cubre TODOS los períodos del archivo (junio en cero incluido): el rango es jun-ago */
  ok(!!r4 && /De mayo no tengo filas de Nortania/.test(r4.text) && /junio 2026 a agosto 2026/.test(r4.text),
    "un mes fuera del rango declina NOMBRANDO el rango que sí hay", r4 && r4.text);
}

/* ═══ 3 · EL BORDE DEL NOMBRE DE MES ═════════════════════════════════════════════════════════════════════════ */
H("3 · «Mayo Distribuciones» no confunde el corte (el fix previo a la adopción, exigido)");
{
  initTenant(PACK);
  const a = composeSerieIntent({ q: "cuanto me compro Mayo Distribuciones el ultimo mes", scenario: "actual" });
  ok(!!a && /En agosto 2026/.test(a.text) && /\$6\.000/.test(a.text),
    "«el último mes» gana: responde AGOSTO ($6.000), no el mayo del nombre", a && a.text);
  const b = composeSerieIntent({ q: "cuánto me compró Mayo Distribuciones en julio", scenario: "actual" });
  ok(!!b && /En julio 2026/.test(b.text) && /\$5\.000/.test(b.text),
    "un mes pedido de verdad responde ESE mes, con el nombre restado de la pregunta", b && b.text);
  const c = composeSerieIntent({ q: "cuanto le vendi a Mayo Distribuciones", scenario: "actual" });
  ok(c === null, "sin período real (solo el del nombre) NO se intercepta: sigue al cerebro");
}

/* ═══ 4 · CONSERVADOR ANTE LA DUDA ═══════════════════════════════════════════════════════════════════════════ */
H("4 · lo que no es una lectura de serie sigue al cerebro");
{
  initTenant(TENANT_DEMO);
  for (const q of [
    "por qué me compró menos Falabella el último mes",
    "por que bajo el margen de Lider en julio",
    "compara Falabella y Lider en julio",
    "que pasa si Falabella me compra 10% mas el proximo mes",
    "cuanto vendi el ultimo mes",
    "como esta Falabella",
  ]) ok(detectSerieIntent(q) === null || composeSerieIntent({ q, scenario: "actual" }) === null, `no toma: «${q.slice(0, 52)}»`);
  const e = espia();
  try { await answerViaNatural({ text: "como esta mi margen", history: [], mem: {}, scenario: "actual", callNatural: e.fn }); } catch { /* el freno del espía */ }
  ok(e.veces() === 1, "y una pregunta normal SÍ llega al cerebro (la integración no se comió el turno)");
}

/* ═══ 5 · LA GUARDIA Y LA AMBIGÜEDAD ═════════════════════════════════════════════════════════════════════════ */
H("5 · lo que no se puede afirmar, se declara");
{
  // serie adulterada: la entidad existe pero su serie no cierra → se dice, sin servir ninguno de los dos montos
  const torcido = { ...PACK, historialMargen: { ...PACK.historialMargen, Nortania: PACK.historialMargen["Nortania"].map((p) => ({ ...p, venta: p.venta + 7 })) } };
  initTenant(torcido);
  const r = composeSerieIntent({ q: "cuanto me compro Nortania el ultimo mes", scenario: "actual" });
  ok(!!r && /no cierra contra su cifra oficial/.test(r.text) && !/\$2\.2/.test(r.text),
    "serie que no reconcilia → declina nombrando la divergencia, sin citar ningún monto", r && r.text);
  initTenant(PACK);
}

/* ═══ 6 · CARNADAS ═══════════════════════════════════════════════════════════════════════════════════════════ */
H("6 · CARNADA · cada afirmación, probada ROJA con el defecto adentro");
{
  const tmp = [];
  let nCarnada = 0;
  const mutar = (rel, reemplazos) => {
    const abs = path.join(process.cwd(), rel);
    let txt = fs.readFileSync(abs, "utf8").replace(/\r\n/g, "\n");   // CRLF de Windows: normalizar SIEMPRE
    for (const [de, a] of reemplazos) {
      const antes = txt;
      txt = txt.replace(de, a);
      if (txt === antes) return { error: `la carnada no encontró qué mutar en ${rel}` };
    }
    const destino = abs.replace(/\.js$/, `.carnada${process.pid}_${++nCarnada}.js`);   // nombre único: caché ESM
    fs.writeFileSync(destino, txt);
    tmp.push(destino);
    return { url: pathToFileURL(destino).href };
  };
  const carnada = async (nombre, rel, reemplazos, prueba) => {
    const m = mutar(rel, reemplazos);
    if (m.error) return ok(false, `carnada «${nombre}»`, m.error);
    let cazada = false, detalle = "";
    try { cazada = await prueba(await import(m.url)); }
    catch (e) { detalle = `la copia mutada ni siquiera carga: ${e.message}`; }
    ok(cazada, `carnada «${nombre}» → el chequeo se pone ROJO`, detalle || "el defecto pasó DESAPERCIBIDO");
  };

  // (a) sin la resta del nombre: el corte se lee del nombre del cliente
  await carnada("buscar el período SIN restar el nombre", "src/adi/oracle/serieIntent.js",
    [[/  const resto = ent\.palabras\.filter\(\(_, idx\) => idx < ent\.i \|\| idx >= ent\.i \+ ent\.n\)\.join\(" "\);/,
      "  const resto = ent.palabras.join(\" \");"]],
    async (Mut) => {
      initTenant(PACK);
      const r = Mut.composeSerieIntent({ q: "cuánto me compró Mayo Distribuciones en julio", scenario: "actual" });
      return !!r && !/En julio 2026/.test(r.text);   // el defecto: lee «mayo» del nombre
    });

  // (b) con la prioridad vieja (mes gana a último): «el último mes» pierde contra el nombre
  await carnada("prioridad mes > último", "src/adi/oracle/serieIntent.js",
    [[/  const corte = pelicula \? \{ tipo: "pelicula" \}\n    : ultimo \? \{ tipo: "ultimo" \}\n    : \{ tipo: "punto", mes: /,
      '  const corte = pelicula ? { tipo: "pelicula" }\n    : mes ? { tipo: "punto", mes: (_MESES_NOMBRE.indexOf(mes[1].toLowerCase()) + 1) || 9, anio: mes[2] ? Number(mes[2]) : null }\n    : ultimo ? { tipo: "ultimo" }\n    : { tipo: "punto", mes: ']],
    async (Mut) => {
      initTenant(PACK);
      // sin la resta este caso no distingue: se arma uno donde el nombre trae mes Y la pregunta pide último
      const r = Mut.composeSerieIntent({ q: "cuanto me compro Mayo Distribuciones el ultimo mes de mayo", scenario: "actual" });
      return !!r && !/En agosto 2026/.test(r.text);
    });

  // (c) sin el filtro de causalidad: un «por qué» recibe una cifra en vez de un porqué
  await carnada("tomar preguntas de causalidad", "src/adi/oracle/serieIntent.js",
    [[/const _NO_TOMAR = \/por\\s\*qu\[eé\]\|porqu\[eé\]\|explica\|raz\[oó\]n\|causa\|/, "const _NO_TOMAR = /"]],
    async (Mut) => {
      initTenant(PACK);
      const r = Mut.composeSerieIntent({ q: "por que Nortania me compro menos el ultimo mes", scenario: "actual" });
      return !!r;   // el defecto: contesta la cifra a una pregunta de causa
    });

  // (d) LA GUARDIA DEL OWNER: servir la serie aunque no sea real — el sintético del demo prestaría cifras
  await carnada("servir cifras del histórico sintético", "src/adi/oracle/serieIntent.js",
    [[/  if \(!estado\.real\) \{[\s\S]*?\n  \}\n\n  \/\* ── SERIE REAL/,
      "  /* ── SERIE REAL"]],
    async (Mut) => {
      initTenant(TENANT_DEMO);
      let r = null;
      try { r = Mut.composeSerieIntent({ q: "cuanto me compro falabella el ultimo mes", scenario: "actual" }); } catch { return true; }
      return !!r && /\$\d/.test(r.text || "");   // el defecto: una cifra del sintético en pantalla
    });

  // (e) la integración quitada: la pregunta insignia vuelve a caer al cerebro (y de ahí, al suplente)
  await carnada("answerViaNatural sin el puente", "src/adi/oracle/caminoNatural.js",
    [[/  const serieR = composeSerieIntent\(\{ q, scenario \}\);\n  if \(serieR && serieR\.text\) \{[\s\S]*?\n  \}\n/, "\n"]],
    async (Mut) => {
      initTenant(TENANT_DEMO);
      const e = espia();
      try { await Mut.answerViaNatural({ text: "cuanto me compro falabella el ultimo mes", history: [], mem: {}, scenario: "actual", callNatural: e.fn }); } catch { /* espía */ }
      return e.veces() > 0;   // el defecto: el cerebro (pagado) recibe el turno
    });

  // (f) una cifra torcida en la composición: el chequeo de exactitud la caza
  await carnada("componer con la cifra equivocada", "src/adi/oracle/serieIntent.js",
    [[/  const dinero = \(v\) => \(\{ crudo: v, fmt: fmtMonto\(v \* fx, \{ dataset \}\) \}\);/,
      "  const dinero = (v) => ({ crudo: v, fmt: fmtMonto(v * 2 * fx, { dataset }) });"]],
    async (Mut) => {
      initTenant(PACK);
      const r = Mut.composeSerieIntent({ q: "cuanto me compro Nortania el ultimo mes", scenario: "actual" });
      return !!r && !/\$2\.200/.test(r.text);   // la sección 2 exige el monto exacto del dataset
    });

  for (const f of tmp) { try { fs.unlinkSync(f); } catch { /* */ } }
}

initTenant(TENANT_DEMO);
console.log(`\n── _serie_puente_gate: ${pass} PASS · ${fail} FAIL (de ${pass + fail}) ──`);
process.exit(fail ? 1 : 0);
