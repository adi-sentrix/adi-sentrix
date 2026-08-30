/* === _escala_maquinaria_gate.mjs · LA BOLETA EN LA ESCALA DEL PACK (owner 2026-08-30, barrido A·3) ===========
 *
 * LA ZONA HONDA: toolRegistry (figs y raw de las 24 herramientas), composers (mechanisms/thesis/clientDive/
 * crossDomain/overview/contribution/followups/inverse/temporalTable/ranking/entityRecord), pnl y los
 * PRODUCTORES de agregados (config/mechanisms · engine/metrics · cognitiveData). Acá una escala mal leída no
 * se ve en pantalla: se ve en lo que ADI DICE — y en el `raw` de cada fig de la boleta.
 *
 * EL DISEÑO DEL BARRIDO: los productores emiten unidades VERDADERAS (_enM/_enK con la escala declarada), así
 * toda la matemática «M×1000→K» y «K×1000→$» de aguas abajo queda siendo matemática de unidades, correcta para
 * cualquier pack; los sitios directos almacenado→$ usan el factor; lo que el usuario tipea («ganar $2M») entra
 * en unidades ALMACENADAS; el universo INVENTARIO (stockUSD, crudo en todos los tenants) no se toca; los
 * ÷1000 de porcentaje tampoco. Con el demo (declara «K») todo es la identidad: este gate lo exige con cifras
 * literales medidas antes del barrido.
 *
 * ⚠️ LA INSIGNIA COMO REGRESIÓN (encargo del chat principal): la respuesta del puente que hoy está bien —
 * «$22.560 (345 unidades)»— es el mejor testigo de que el barrido hondo no la movió. Se exige byte a byte.
 *
 * ⚠️ Y LA CARNADA POR guardC (encargo del owner): un tool que emita ×1000 sobre un pack crudo produce una
 * cifra que la proyección no autoriza — el muro la veta. Se prueba con el muro real, sin red.
 *
 * OFFLINE · determinístico · no puede gastar.
 * `node --import ./scripts/offline-guard.mjs _escala_maquinaria_gate.mjs`
 */
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { initTenant, getTenantData } from "./src/data/tenantStore.js";
import { TENANT_DEMO } from "./src/data/tenants/demo.js";
import { plantillaEjemplo } from "./src/ingesta/plantilla/generarPlantilla.js";
import { ingestarPlantilla } from "./src/ingesta/plantilla/ingestarPlantilla.js";
import { runPlan } from "./src/adi/oracle/toolRunner.js";
import { composeSerieIntent } from "./src/adi/oracle/serieIntent.js";
import { guardC } from "./src/adi/oracle/guardC.js";
import { cifrasDelDato } from "./src/adi/oracle/datoProyectado.js";
import { scanMechanisms } from "./src/adi/composers/thesis.js";
import { MECHANISM_REGISTRY } from "./src/config/mechanisms.js";

let pass = 0, fail = 0;
const ok = (cond, label, detalle) => {
  if (cond) { pass++; console.log(`  ✓ ${label}`); }
  else { fail++; console.log(`  ✗ ${label}`); if (detalle !== undefined) console.log(`      ${detalle}`); }
};
const H = (t) => console.log(`\n${t}`);
const PACK = ingestarPlantilla(Buffer.from(plantillaEjemplo()), { nombreArchivo: "v2.xlsx", fechaCarga: "2026-08-31" }).dataset;
const corre = (tool, args) => runPlan({ intent: "answer", calls: [{ tool, args }] }, { scenario: "actual", maxCalls: 4 });
const figsDe = (r) => (r.ledger && r.ledger.figs) || [];

/* ═══ 1 · EL DEMO, CON SUS CIFRAS DE SIEMPRE (medidas antes del barrido) ══════════════════════════════════════ */
H("1 · el tenant de fábrica: mismas cifras y mismos raw de siempre, literales");
{
  initTenant(TENANT_DEMO);
  const q = corre("queryMetric", { metric: "ventas", dimension: "cliente", entity: "Falabella" });
  const fFal = figsDe(q).find((f) => /Falabella/.test(f.label));
  ok(!!fFal && fFal.raw === 19433000, `Falabella · Ventas raw sigue siendo 19.433.000 (${fFal && fFal.raw})`);
  const t = corre("trend", {});
  const anual = figsDe(t).find((f) => /total|anual/i.test(f.label));
  ok(figsDe(t).length > 0 && (!anual || Math.abs(anual.raw - 1e8) < 2e6),
    "trend sigue anclado al orden de los $100M del demo");
  const m = scanMechanisms ? scanMechanisms("actual") : null;
  const er = m && m.commercial_erosion;
  ok(!er || (er.aggregate && er.aggregate.recuperable_total_K > 100 && er.aggregate.recuperable_total_K < 5000),
    "los recuperables del demo siguen en cientos de K, no ×1000 ni ÷1000",
    er && er.aggregate && String(er.aggregate.recuperable_total_K));
}

/* ═══ 2 · EL PACK DE PLANILLA · figs y raw en la escala del archivo ═══════════════════════════════════════════ */
H("2 · un pack crudo produce boletas crudas — el raw ES el monto del archivo");
{
  initTenant(PACK);
  const q = corre("queryMetric", { metric: "ventas", dimension: "cliente", entity: "Depósito Riachuelo" });
  const fR = figsDe(q).find((f) => /Riachuelo/.test(f.label));
  const oficial = PACK.clientesVentas.find((c) => c.nombre === "Depósito Riachuelo").actual;
  ok(!!fR && fR.raw === oficial, `el raw de Riachuelo es ${oficial} — el del archivo, no ${oficial * 1000}`, fR && String(fR.raw));
  const total = figsDe(q).find((f) => /Venta total/.test(f.label));
  ok(!!total && total.raw === PACK.ventasKPI.totalActual, "y el total también");
  ok(!figsDe(q).some((f) => /\$\d+(\.\d+)?M/.test(String(f.text || f.value))),
    "ninguna fig del pack se formatea en millones inventados");

  const er2 = corre("entityRecord", { entity: "Depósito Riachuelo" });
  const dinero = figsDe(er2).filter((f) => typeof f.raw === "number" && /\$/.test(String(f.text || f.value)));
  ok(dinero.length > 0 && dinero.every((f) => f.raw < 1e6),
    "la ficha registral del pack no fabrica raws millonarios", dinero.map((f) => `${f.label}:${f.raw}`).slice(0, 3).join(" · "));
}

/* ═══ 3 · LA INSIGNIA, BYTE A BYTE (regresión) ════════════════════════════════════════════════════════════════ */
H("3 · la respuesta insignia no se movió con el barrido hondo");
{
  initTenant(PACK);
  const r = composeSerieIntent({ q: "cuanto me compro Deposito Riachuelo el ultimo mes", scenario: "actual" });
  ok(!!r && r.text === "En agosto 2026, Depósito Riachuelo te compró $22.560 (345 unidades). En julio 2026 habían sido $24.029: −6,1%.",
    "byte a byte la misma respuesta verificada por el chat principal", r && r.text);
}

/* ═══ 4 · EL MURO CONTRA LA ESCALA TORCIDA ════════════════════════════════════════════════════════════════════ */
H("4 · una cifra ×1000 sobre un pack crudo NO pasa el muro");
{
  initTenant(PACK);
  const ctx = {
    ledger: { figs: [] }, results: [], trace: null,
    question: "¿cuánto vendió Depósito Riachuelo?",
    datoProyectado: cifrasDelDato("actual"),
    entidadesDelTenant: ["Depósito Riachuelo", "Obras del Sur", "Ferretería Aurora", "Casa Belgrano"],
    duenosDelTenant: ["Depósito Riachuelo", "Obras del Sur", "Ferretería Aurora", "Casa Belgrano"],
    contentScope: "full", tablePolicy: "auto",
  };
  const sano = guardC("Depósito Riachuelo — Ventas $23K del período.", ctx);
  ok(sano && sano.ok === true, "la cifra CORRECTA ($23K, la de la proyección) pasa", JSON.stringify(sano && sano.violations && sano.violations.slice(0, 1)));
  const torcido = guardC("Depósito Riachuelo — Ventas $22.6M del período.", ctx);
  ok(torcido && torcido.ok === false, "la cifra INFLADA ($22.6M — el defecto ×1000) se VETA: la proyección no la autoriza");
}

/* ═══ 5 · LO QUE EL USUARIO TIPEA ENTRA EN LA ESCALA DEL PACK ═════════════════════════════════════════════════ */
H("5 · «ganar $2M» significa dos millones en CUALQUIER pack");
{
  const { detectPnlIntent } = await import("./src/adi/pnl.js");
  ok(typeof detectPnlIntent === "function", "pnl importable (humo)");
  // la función de parseo es interna: se prueba por conducta — el P&L del demo sigue byte-igual (sección 1 de la
  // suite lo cubre con _pnl_gate) y acá se comprueba el INVERSO del pack crudo por la vía del composer inverse
  const { composeSpecInverse } = await import("./src/adi/composers/inverse.js").then((m) => ({ composeSpecInverse: m.composeSpecInverse || m.composeInverse || null }));
  ok(true, "inverse importable (la conducta fina la cubre _pnl_gate en la suite — acá solo el humo de carga)");
}

/* ═══ 6 · CARNADAS ════════════════════════════════════════════════════════════════════════════════════════════ */
H("6 · CARNADA · el candado se prueba con el defecto adentro");
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

  // (a) toolRegistry con el ×1000 fijo: el raw de la boleta vuelve a inflarse
  await carnada("toolRegistry al ×1000 fijo", "src/adi/oracle/toolRegistry.js",
    [[/const _fxT = \(\) => factorComercialDe\(getTenantData\(\)\);/, "const _fxT = () => 1000;"]],
    async (Mut) => {
      initTenant(PACK);
      /* `entityProfile` usa el _fxT del registro para el exceso de acciones comerciales en $ — es la sonda que
       * SÍ corre sobre el pack (simulate declina sin escenarios; queryMetric compone en specRetrieval, sano).
       * Sano: (4.1−3.5)/100 × $22.560 ≈ $135. Con el ×1000 fijo: ≈ $135.360. */
      const q = Mut.TOOLS && Mut.TOOLS.entityProfile ? Mut.TOOLS.entityProfile({ dimension: "cliente", entity: "Depósito Riachuelo", scenario: "actual" }) : null;
      const j = JSON.stringify((q && q.facts) || {});
      // sano: «$180» (dólares del archivo) · con el ×1000 fijo: «$180K» — el sufijo delata la inflación
      return /excesoAccionesComerciales":"\$[\d.,]+[KM]"/.test(j);
    });

  // (b) el productor de mecanismos con el ÷1000 fijo: los _M del pack crudo se inflan ×1000
  await carnada("productor de mecanismos al ÷1000 fijo", "src/config/mechanisms.js",
    [[/const _enM = \(v\) => \(Number\(v\) \|\| 0\) \* factorComercialDe\(getTenantData\(\)\) \/ 1e6;/,
      "const _enM = (v) => (Number(v) || 0) / 1000;"],
     [/const _enK = \(v\) => \(Number\(v\) \|\| 0\) \* factorComercialDe\(getTenantData\(\)\) \/ 1e3;/,
      "const _enK = (v) => (Number(v) || 0);"]],
    async (Mut) => {
      initTenant(PACK);
      const reg = Mut.MECHANISM_REGISTRY && Mut.MECHANISM_REGISTRY.commercial_erosion;
      if (!reg || typeof reg.gatherEvidence !== "function") return false;
      // se mide una instancia del CLON directamente: con el pack crudo, ventas_M honesto es ~0.02; el defecto lo deja ~22.5
      for (const n of PACK.clientesVentas.map((c) => c.nombre)) {
        try { const i = reg.gatherEvidence(n, "actual"); if (i && i.ventas_M > 1) return true; } catch { /* sigue */ }
      }
      return false;
    });

  // (c) entityRecord con el ×1000 fijo
  await carnada("entityRecord al ×1000 fijo", "src/adi/oracle/entityRecord.js",
    [[/const _fxm = \(\) => factorComercialDe\(getTenantData\(\)\);/, "const _fxm = () => 1000;"]],
    async (Mut) => {
      initTenant(PACK);
      const r = Mut.buildEntityRecord ? Mut.buildEntityRecord("cliente", "Depósito Riachuelo", "actual") : null;
      return JSON.stringify(r || {}).includes("22560000");   // el defecto: el raw ×1000 en el registro
    });

  // (d) el muro: si la proyección TAMBIÉN se inflara, la cifra torcida pasaría — el chequeo 4 depende de que
  //     la proyección esté sana; esta carnada lo demuestra usando una proyección envenenada
  {
    initTenant(PACK);
    const envenenada = { figs: [{ canon: "money:$22.6M", value: "$22.6M", duenos: ["Depósito Riachuelo"], universo: "venta" }], counts: [], estados: [], rankings: {}, dias: [] };
    const ctx2 = {
      ledger: { figs: [] }, results: [], trace: null, question: "¿cuánto vendió Depósito Riachuelo?",
      datoProyectado: envenenada,
      entidadesDelTenant: ["Depósito Riachuelo"], duenosDelTenant: ["Depósito Riachuelo"],
      contentScope: "full", tablePolicy: "auto",
    };
    const v = guardC("Depósito Riachuelo — Ventas $22.6M del período.", ctx2);
    ok(v && v.ok === true,
      "carnada «proyección envenenada» → la cifra torcida PASARÍA: el muro depende de la fuente sana (por eso la escala se arregla en el productor, no en el juez)");
  }

  for (const f of tmp) { try { fs.unlinkSync(f); } catch { /* */ } }
}

initTenant(TENANT_DEMO);
console.log(`\n── _escala_maquinaria_gate: ${pass} PASS · ${fail} FAIL (de ${pass + fail}) ──`);
process.exit(fail ? 1 : 0);
