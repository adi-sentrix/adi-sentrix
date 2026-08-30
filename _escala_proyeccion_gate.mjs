/* === _escala_proyeccion_gate.mjs · LA CARPETA DE ADI EN LA ESCALA DEL PACK (owner 2026-08-30, autorizado) =====
 *
 * EL DEFECTO QUE VIGILA, medido en producción: `datoProyectado` multiplicaba TODO monto comercial ×1000 —
 * correcto para los tenants de fábrica (almacenan en miles, contrato figureType «K») y FALSO para un pack de
 * planilla (moneda cruda del archivo). El archivo decía $61.483 y la carpeta que ve el cerebro decía $61.5M:
 * ADI hablaba con cifras mil veces más grandes que las del cliente. Palabra del owner: «Si la pantalla muestra
 * $61 mil, ADI no puede leer $61 millones. Y si no hay presupuesto declarado, no puede aparecer como
 * presupuesto $0.»
 *
 * LA SALIDA: la escala se DECLARA EN EL PACK (`escalaComercial: "raw" | "K"`, vocabulario de ESCALAS del
 * contrato) y `factorComercialDe` la lee; sin declarar cae a «K» — el comportamiento de siempre. Lo ausente se
 * dice con PALABRAS: «sin presupuesto declarado» · «sin período anterior», nunca «$0 · 0.0%». Y la moneda del
 * header es la declarada del pack, no un «USD» fijo.
 *
 * ⚠️ ALCANCE DECLARADO: este candado cubre la CARPETA de ADI (proyección + KPIs del suplente). El resto de las
 * superficies que asumen ×1000 (mesa, mesaFlujo, mesaResultado, headline, resumenComercial, composers,
 * toolRegistry, specRetrieval — ~25 archivos inventariados el 2026-08-30) sigue pendiente de la decisión del
 * owner sobre dónde vive ese arreglo; cuando llegue, el criterio de cierre es que la Mesa y esta proyección
 * digan el MISMO monto para el mismo pack.
 *
 * OFFLINE · determinístico · no importa el gateway y no puede gastar.
 * `node --import ./scripts/offline-guard.mjs _escala_proyeccion_gate.mjs`
 */
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { initTenant } from "./src/data/tenantStore.js";
import { TENANT_DEMO } from "./src/data/tenants/demo.js";
import { plantillaEjemplo } from "./src/ingesta/plantilla/generarPlantilla.js";
import { ingestarPlantilla } from "./src/ingesta/plantilla/ingestarPlantilla.js";
import { proyectarDatoNegocio, kpisDelNegocio, suplenteDignoDelDato } from "./src/adi/oracle/datoProyectado.js";
import { factorComercialDe, ESCALAS } from "./src/config/contract/figureType.js";

let pass = 0, fail = 0;
const ok = (cond, label, detalle) => {
  if (cond) { pass++; console.log(`  ✓ ${label}`); }
  else { fail++; console.log(`  ✗ ${label}`); if (detalle !== undefined) console.log(`      ${detalle}`); }
};
const H = (t) => console.log(`\n${t}`);

const PACK = ingestarPlantilla(Buffer.from(plantillaEjemplo()), { nombreArchivo: "v2.xlsx", fechaCarga: "2026-08-31" }).dataset;

/* ═══ 1 · LA DECLARACIÓN ══════════════════════════════════════════════════════════════════════════════════════ */
H("1 · la escala es una DECLARACIÓN del pack, con el vocabulario del contrato");
{
  ok(PACK.escalaComercial === "raw", "el pack de planilla declara «raw»: sus montos son la moneda cruda del archivo");
  ok(TENANT_DEMO.escalaComercial === "K", "el dataset de fábrica declara «K»: almacena en miles");
  ok(factorComercialDe(PACK) === 1 && factorComercialDe(TENANT_DEMO) === 1000, "y el factor sale de esa declaración");
  ok(factorComercialDe({}) === 1000 && factorComercialDe(null) === 1000,
    "sin declarar cae a «K» — un pack viejo se comporta EXACTO como hoy, nunca deflactado en silencio");
  ok(PACK.escalaComercial in ESCALAS && TENANT_DEMO.escalaComercial in ESCALAS,
    "las dos declaraciones usan el vocabulario de ESCALAS del contrato, no una etiqueta inventada");
}

/* ═══ 2 · EL DEMO, BYTE POR BYTE ══════════════════════════════════════════════════════════════════════════════ */
H("2 · el tenant de fábrica no se mueve: mismas cifras de siempre");
{
  initTenant(TENANT_DEMO);
  const t = proyectarDatoNegocio("actual");
  ok(t.includes("- Ventas totales: $100.0M (año anterior $92.9M · presupuesto $97.0M · 7.6% vs año anterior · 3.1% vs presupuesto)."),
    "la línea de KPIs del demo es byte-idéntica a la de antes del cambio");
  ok(/- Falabella — Ventas \$19\.4M \(año anterior \$17\.9M · presupuesto \$18\.9M\)/.test(t),
    "y la línea por cliente también, con su año anterior y su presupuesto en cifras");
  ok(/moneda CLP\./.test(t.split("\n")[0]),
    "el header dice la moneda DECLARADA del pack (el demo declara CLP en su perfil — el «USD» fijo le mentía)");
}

/* ═══ 3 · EL PACK DE PLANILLA, EN SU ESCALA ═══════════════════════════════════════════════════════════════════ */
H("3 · la carpeta de un pack de planilla habla en los montos del archivo");
{
  initTenant(PACK);
  const t = proyectarDatoNegocio("actual");
  const kpi = t.split("\n").find((l) => /totales:/.test(l)) || "";
  ok(/\$61K/.test(kpi), `la venta total es $61K — la del archivo ($61.483), no $61.5M`, kpi);
  ok(!/\$61\.5M/.test(t) && !/\$22\.6M/.test(t), "las cifras infladas ×1000 no aparecen en NINGUNA línea");
  ok(/Riachuelo — Ventas \$23K/.test(t), "cada cliente va con su monto real (Riachuelo $22.560 → $23K)");
  ok(/moneda CLP\./.test(t.split("\n")[0]), "y el header dice CLP, la moneda que el archivo declaró");
}

/* ═══ 4 · LO AUSENTE SE DICE CON PALABRAS ═════════════════════════════════════════════════════════════════════ */
H("4 · sin presupuesto declarado no existe un «presupuesto $0»");
{
  initTenant(PACK);
  const t = proyectarDatoNegocio("actual");
  ok(/sin presupuesto declarado/.test(t), "la línea de KPIs lo dice con palabras");
  ok(!/presupuesto \$0/.test(t), "y el «presupuesto $0» desapareció");
  ok(!/0\.0% vs presupuesto/.test(t), "…junto con el «0.0% vs presupuesto», que afirmaba una comparación contra nada");
  const riachuelo = t.split("\n").find((l) => /^- Depósito Riachuelo/.test(l)) || "";
  ok(/sin presupuesto declarado/.test(riachuelo), "también en la línea por cliente", riachuelo.slice(0, 120));

  /* Y EL CASO DEL PRIMER MES: un pack con un solo período no tiene año anterior — tampoco puede decir «$0». */
  const soloAgo = {
    ...PACK,
    ventasKPI: { ...PACK.ventasKPI, totalAnterior: null, vsAnterior: null, totalPresupuesto: null, vsPresupuesto: null },
    clientesVentas: PACK.clientesVentas.map((c) => ({ ...c, anterior: null })),
  };
  initTenant(soloAgo);
  const t1 = proyectarDatoNegocio("actual");
  const kpi1 = t1.split("\n").find((l) => /totales:/.test(l)) || "";
  ok(/sin período anterior/.test(kpi1) && !/año anterior \$0/.test(kpi1),
    "sin período anterior se dice, no se inventa un «año anterior $0»", kpi1);
}

/* ═══ 5 · EL SUPLENTE — el caso original del owner ════════════════════════════════════════════════════════════ */
H("5 · los KPIs que sirve el suplente van en la misma escala honesta");
{
  initTenant(PACK);
  const kpis = kpisDelNegocio("actual").join("\n");
  ok(/\$61K/.test(kpis) && !/\$61\.5M/.test(kpis), "el volcado del suplente dice $61K, no $61.5M");
  ok(!/presupuesto \$0/.test(kpis), "y tampoco inventa un presupuesto de cero");
  const s = suplenteDignoDelDato({ scenario: "actual" });
  ok(!/\$61\.5M/.test(s) && !/presupuesto \$0/.test(s), "el texto completo del suplente queda limpio de las dos mentiras");
}

/* ═══ 6 · CARNADAS · el candado probado con el defecto adentro ════════════════════════════════════════════════ */
H("6 · CARNADA · cada chequeo se prueba capaz de ponerse rojo");
{
  const tmp = [];
  let nCarnada = 0;
  const mutar = (rel, reemplazos) => {
    const abs = path.join(process.cwd(), rel);
    let txt = fs.readFileSync(abs, "utf8").replace(/\r\n/g, "\n");   // CRLF de git en Windows: normalizar SIEMPRE
    for (const [de, a] of reemplazos) {
      const antes = txt;
      txt = txt.replace(de, a);
      if (txt === antes) return { error: `la carnada no encontró qué mutar en ${rel}` };
    }
    const destino = abs.replace(/\.js$/, `.carnada${process.pid}_${++nCarnada}.js`);   // nombre único: el caché ESM no perdona
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

  // (a) el ×1000 fijo, de vuelta — el defecto original tal cual
  await carnada("volver al ×1000 fijo de la proyección", "src/adi/oracle/datoProyectado.js",
    [[/const _moneyK = \(almacenado\) => _money\(almacenado \* factorComercialDe\(getTenantData\(\)\)\);/,
      "const _moneyK = (almacenado) => _money(almacenado * 1000);"]],
    async (Mut) => {
      initTenant(PACK);
      const t = Mut.proyectarDatoNegocio("actual");
      return /\$61\.5M/.test(t);   // el chequeo 3 lo cazaría
    });

  // (b) el default deflacionado: un pack viejo sin declaración pasaría a leerse ÷1000
  await carnada("cambiar el default de «K» a «raw»", "src/config/contract/figureType.js",
    [[/return ESCALAS\[typeof e === "string" && e in ESCALAS \? e : "K"\];/,
      'return ESCALAS[typeof e === "string" && e in ESCALAS ? e : "raw"];']],
    async (Mut) => {
      const sinDeclarar = { ...TENANT_DEMO };
      delete sinDeclarar.escalaComercial;
      return Mut.factorComercialDe(sinDeclarar) === 1;   // el chequeo 1 exige 1000
    });

  // (c) el «presupuesto $0» de vuelta
  await carnada("volver a afirmar «presupuesto $0»", "src/adi/oracle/datoProyectado.js",
    [[/_hay\(kv\.totalPresupuesto\) \? `presupuesto \$\{F\(_moneyK\(kv\.totalPresupuesto\), \[\.\.\.NEG, "presupuesto"\]\)\}` : etiquetaSinDeclarar\("presupuesto"\),/,
      '`presupuesto ${F(_moneyK(kv.totalPresupuesto || 0), [...NEG, "presupuesto"])}`,']],
    async (Mut) => {
      initTenant(PACK);
      const t = Mut.proyectarDatoNegocio("actual");
      return /presupuesto \$0/.test(t);   // el chequeo 4 lo cazaría
    });

  // (d) el pack que deja de declarar: sin la declaración, la planilla vuelve a inflarse
  await carnada("quitar la declaración del pack de planilla", "src/ingesta/plantilla/motorKpi.js",
    [[/    escalaComercial: "raw",\n/, "\n"]],
    async (Mut) => {
      const d2 = Mut.calcularDataset
        ? null
        : null;
      // la copia mutada exporta calcularDataset: se ingesta con ella y se proyecta con el módulo REAL
      const m = Mut.calcularDataset({ parametros: { empresa_id: "x", empresa_nombre: "X", periodo_actual: "2026-08-31", moneda: "CLP" },
        tablas: { Ventas: [{ periodo: "2026-08", fecha: "2026-08-15", folio: "F-1", tipoDoc: "factura", condicion: "contado", cliente: "Nortania", sku: "AX-10", marca: "Corvex", sfamilia: "Herrajes", unidades: 10, venta: 61483, costo: 40000, acciones: 100 }], Inventario: [] }, fechaCarga: "2026-08-31" });
      initTenant(m.dataset);
      const t = proyectarDatoNegocio("actual");
      return /\$61\.5M/.test(t);   // sin declarar cae a «K» y se infla — que es lo que el chequeo 3 impide
    });

  for (const f of tmp) { try { fs.unlinkSync(f); } catch { /* */ } }
}

initTenant(TENANT_DEMO);
console.log(`\n── _escala_proyeccion_gate: ${pass} PASS · ${fail} FAIL (de ${pass + fail}) ──`);
process.exit(fail ? 1 : 0);
