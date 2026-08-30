/* === _agente_doctrina_gate.mjs · LA DOCTRINA VIAJA CON SU HERRAMIENTA (F2b · §10 del F1 · owner 2026-08-30) ==
 *
 * El principio del owner: la instrucción no viaja hasta que hace falta. Sus leyes, cada una con carnada:
 *   1 · FIDELIDAD: la doctrina de una herramienta viaja SOLO en rondas que la usan — una doctrina colada sin su
 *       herramienta es instrucción impertinente (lo que este diseño existe para eliminar), y una herramienta
 *       doctrinada cuyo bloque no llegó deja al cerebro sin su regla;
 *   2 · BLOQUES BYTE-ESTABLES: dos generaciones idénticas — cero prosa por turno, cero timestamps;
 *   3 · ORDEN FIJO (alfabético): el caché del proveedor no distingue «otro orden» de «contenido nuevo»;
 *   4 · TOPE POR BLOQUE, probado (≤600 chars ≈ 160 tok);
 *   5 · REGISTRO SANO: cada llave de DOCTRINAS es una herramienta REAL del catálogo — nada fantasma.
 *
 * OFFLINE · determinístico · el bucle se ejerce con guion inyectado · no puede gastar.
 * `node --import ./scripts/offline-guard.mjs _agente_doctrina_gate.mjs`
 */
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { initTenant } from "./src/data/tenantStore.js";
import { TENANT_DEMO } from "./src/data/tenants/demo.js";
import { plantillaEjemplo } from "./src/ingesta/plantilla/generarPlantilla.js";
import { ingestarPlantilla } from "./src/ingesta/plantilla/ingestarPlantilla.js";
import { DOCTRINAS, doctrinasParaRonda, TOPE_BLOQUE_CHARS } from "./src/adi/agente/doctrinaAgente.js";
import { cajaDelAgente } from "./src/adi/agente/herramientasAgente.js";
import { TOOLS } from "./src/adi/oracle/toolRegistry.js";
import { answerViaAgente } from "./src/adi/agente/bucleAgente.js";

let pass = 0, fail = 0;
const ok = (cond, label, detalle) => {
  if (cond) { pass++; console.log(`  ✓ ${label}`); }
  else { fail++; console.log(`  ✗ ${label}`); if (detalle !== undefined) console.log(`      ${detalle}`); }
};
const H = (t) => console.log(`\n${t}`);
const PACK = ingestarPlantilla(Buffer.from(plantillaEjemplo()), { nombreArchivo: "v2.xlsx", fechaCarga: "2026-08-31" }).dataset;

/* ═══ 1 · EL REGISTRO ═════════════════════════════════════════════════════════════════════════════════════════ */
H("1 · el registro: real, acotado y estable");
{
  const caja = cajaDelAgente(TOOLS);
  const fantasmas = Object.keys(DOCTRINAS).filter((n) => !caja[n]);
  ok(fantasmas.length === 0, "cada doctrina pertenece a una herramienta REAL del catálogo", fantasmas.join(", "));
  const largos = Object.entries(DOCTRINAS).filter(([, t]) => t.length > TOPE_BLOQUE_CHARS).map(([n, t]) => `${n}:${t.length}`);
  ok(largos.length === 0, `todos los bloques respetan el tope (≤${TOPE_BLOQUE_CHARS} chars)`, largos.join(" · "));
  ok(Object.values(DOCTRINAS).every((t) => t.startsWith("DOCTRINA · ")), "cada bloque se presenta como lo que es");
  ok(doctrinasParaRonda(["serieEntidad"]) === doctrinasParaRonda(["serieEntidad"]),
    "dos generaciones → byte a byte idénticas");
}

/* ═══ 2 · FIDELIDAD Y ORDEN ═══════════════════════════════════════════════════════════════════════════════════ */
H("2 · viaja lo que se usó, en orden fijo — y nada más");
{
  const d = doctrinasParaRonda(["serieEntidad", "salesRead"]);
  ok(d.includes(DOCTRINAS.serieEntidad), "la herramienta usada trae su doctrina");
  ok(!d.includes("P&L") && !d.includes(DOCTRINAS.pnlRead), "y la doctrina del P&L NO viaja en una ronda que no lo tocó");
  ok(doctrinasParaRonda(["salesRead", "marginRead"]) === "", "una ronda sin herramientas doctrinadas no carga ni un token de doctrina");
  const ab = doctrinasParaRonda(["trend", "serieEntidad"]);
  const ba = doctrinasParaRonda(["serieEntidad", "trend"]);
  ok(ab === ba && ab.indexOf(DOCTRINAS.serieEntidad) < ab.indexOf(DOCTRINAS.trend),
    "el orden lo fija el módulo (alfabético), no el orden en que el cerebro pidió");
  ok(doctrinasParaRonda(["trend", "trend", "trend"]) === DOCTRINAS.trend, "los duplicados no repiten el bloque");
}

/* ═══ 3 · EN EL BUCLE, DE VERDAD ══════════════════════════════════════════════════════════════════════════════ */
H("3 · la ronda del bucle lleva la doctrina pegada al resultado");
{
  initTenant(PACK);
  let mensajeRonda = null;
  const guion = async ({ mensajes, ronda }) => {
    if (ronda === 1) return { tipo: "herramientas", pedidos: [{ tool: "serieEntidad", args: { entity: "Depósito Riachuelo", metrica: "venta" } }] };
    mensajeRonda = mensajes.filter((m) => /\[HERRAMIENTAS/.test(m.content)).pop();
    return { tipo: "texto", texto: "Depósito Riachuelo te compró $22.560 en agosto 2026; en julio 2026 habían sido $24.029." };
  };
  const r = await answerViaAgente({ text: "cuanto me compro riachuelo el ultimo mes", history: [], mem: {}, scenario: "actual", callAgente: guion });
  ok(r.r.agente.estado === "verde", "el turno salió verde");
  ok(!!mensajeRonda && mensajeRonda.content.includes(DOCTRINAS.serieEntidad),
    "★ el mensaje de la ronda trae la doctrina de serieEntidad, byte-igual");
  ok(!!mensajeRonda && !mensajeRonda.content.includes(DOCTRINAS.pnlRead),
    "★ …y NO trae la del P&L: la instrucción no viajó hasta que hiciera falta");

  let mensajeRonda2 = null;
  const guion2 = async ({ mensajes, ronda }) => {
    if (ronda === 1) return { tipo: "herramientas", pedidos: [{ tool: "salesRead", args: {} }] };
    mensajeRonda2 = mensajes.filter((m) => /\[HERRAMIENTAS/.test(m.content)).pop();
    return { tipo: "texto", texto: "Va la lectura de ventas con lo disponible." };
  };
  await answerViaAgente({ text: "como vienen las ventas", history: [], mem: {}, scenario: "actual", callAgente: guion2 });
  ok(!!mensajeRonda2 && !mensajeRonda2.content.includes("DOCTRINA ·"),
    "una ronda de herramientas sin doctrina viaja limpia — cero tokens de instrucción impertinente");
}

/* ═══ 4 · CARNADAS ════════════════════════════════════════════════════════════════════════════════════════════ */
H("4 · CARNADA · cada ley, probada ROJA con el defecto adentro");
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
  const carnada = async (nombre, rel, reemplazos, prueba) => {
    const m = mutar(rel, reemplazos);
    if (m.error) return ok(false, `carnada «${nombre}»`, m.error);
    let cazada = false, detalle = "";
    try { cazada = await prueba(await import(m.url)); }
    catch (e) { detalle = `la copia mutada ni siquiera carga: ${e.message}`; }
    ok(cazada, `carnada «${nombre}» → el chequeo se pone ROJO`, detalle || "el defecto pasó DESAPERCIBIDO");
  };

  // (a) la doctrina que viaja SIN su herramienta — el defecto que el §10 existe para impedir
  await carnada("doctrina colada sin su herramienta", "src/adi/agente/doctrinaAgente.js",
    [[/  const usadas = \[\.\.\.new Set\(\(nombres \|\| \[\]\)\.filter\(\(n\) => DOCTRINAS\[n\]\)\)\]\.sort\(\(a, b\) => a\.localeCompare\(b, "es"\)\);/,
      "  const usadas = Object.keys(DOCTRINAS).sort((a, b) => a.localeCompare(b, \"es\"));"]],
    async (Mut) => Mut.doctrinasParaRonda(["serieEntidad"]).includes(Mut.DOCTRINAS.pnlRead));

  // (b) el orden por pedido en vez del orden fijo — el caché del proveedor muere en silencio
  await carnada("orden por pedido en vez de alfabético", "src/adi/agente/doctrinaAgente.js",
    [[/\.sort\(\(a, b\) => a\.localeCompare\(b, "es"\)\);/, ";"]],
    async (Mut) => Mut.doctrinasParaRonda(["trend", "serieEntidad"]) !== Mut.doctrinasParaRonda(["serieEntidad", "trend"]));

  // (c) un bloque que crece sin tope
  await carnada("bloque sin tope", "src/adi/agente/doctrinaAgente.js",
    [[/  serieEntidad: "DOCTRINA · serie por entidad:/, '  serieEntidad: "DOCTRINA · serie por entidad:' + " relleno".repeat(120) + ""]],
    async (Mut) => Object.values(Mut.DOCTRINAS).some((t) => t.length > TOPE_BLOQUE_CHARS));

  // (d) el bucle que deja de pegar la doctrina al resultado
  await carnada("el bucle sin doctrina bajo demanda", "src/adi/agente/bucleAgente.js",
    [[/    const doctrina = doctrinasParaRonda\(rp\.results\.map\(\(r\) => r\.tool\)\);/, "    const doctrina = \"\";"]],
    async (Mut) => {
      initTenant(PACK);
      let msg = null;
      const guion = async ({ mensajes, ronda }) => {
        if (ronda === 1) return { tipo: "herramientas", pedidos: [{ tool: "serieEntidad", args: { entity: "Depósito Riachuelo", metrica: "venta" } }] };
        msg = mensajes.filter((m) => /\[HERRAMIENTAS/.test(m.content)).pop();
        return { tipo: "texto", texto: "Depósito Riachuelo te compró $22.560 en agosto 2026." };
      };
      await Mut.answerViaAgente({ text: "cuanto me compro riachuelo el ultimo mes", history: [], mem: {}, scenario: "actual", callAgente: guion });
      return !!msg && !msg.content.includes("DOCTRINA ·");   // el defecto: la herramienta corrió y su regla no llegó
    });

  for (const f of tmp) { try { fs.unlinkSync(f); } catch { /* */ } }
}

initTenant(TENANT_DEMO);
console.log(`\n── _agente_doctrina_gate: ${pass} PASS · ${fail} FAIL (de ${pass + fail}) ──`);
process.exit(fail ? 1 : 0);
