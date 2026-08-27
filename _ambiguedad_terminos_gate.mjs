/* === _ambiguedad_terminos_gate.mjs · UNA PALABRA, UN REFERENTE ================================================
 * EL CASO QUE ESTE GATE EXISTE PARA CAZAR no es el obvio —dos palabras distintas para la misma cosa, que un
 * barrido de consistencia encuentra solo— sino el INVERSO: LA MISMA PALABRA USADA PARA DOS COSAS DISTINTAS. Ese
 * se ve consistente y no lo es; un barrido ingenuo lo marca «concuerda» y pasa de largo. Es un FALSO VERDE.
 *
 * El patrón de referencia (cerrado por el owner): el dato trae `doh` y `cobertura`, los dos declarados, los dos
 * en días, distintos hasta 28 días en un mismo SKU. Un mismo término servía dos valores según por dónde entrara
 * la pregunta. La decisión es que `doh` es la única verdad y en pantalla se llama «Días de inventario».
 *
 * DOS BARRIDOS, PORQUE UNO SOLO NO ALCANZA:
 *   [EJECUCIÓN] corre los builders reales y compara las cifras que sirve cada superficie. Caza lo que el dato
 *               demuestra hoy.
 *   [CÓDIGO]    lee los archivos fuente. Hace falta porque el caso feliz NO dispara todas las ramas: en este
 *               proyecto ya hubo un texto que solo se cazó leyendo el archivo, y una etiqueta puede vivir en una
 *               rama que este dataset nunca visita.
 *
 * PURO · sin LLM · sin red · determinístico (mismo dataset → mismo resultado, siempre).
 */
import fs from "fs";
import path from "path";
import { LABEL_COLLISIONS, buildGrid, buildEntityRecord, axisHasField, fieldLabel, rawRecordFor } from "./src/adi/oracle/entityRecord.js";
import { figFor } from "./src/adi/boleta.js";
import { RANKING_EXTREMES_METRICS } from "./src/config/rankingData.js";
import { _formatMetricValue } from "./src/adi/composers/ranking.js";
import { buildCuadroMando } from "./src/adi/sentrix/cuadro.js";
import { buildCuadroCapital, buildMesaCapital, CAPITAL_ESTADOS } from "./src/adi/sentrix/mesaCapital.js";
import { buildControlRing } from "./src/adi/sentrix/control.js";
import { buildEntityKPIs } from "./src/adi/sentrix/kpis.js";
import { buildConcentration } from "./src/adi/sentrix/concentration.js";
import { rotacionPonderada } from "./src/adi/sentrix/rotacion.js";
import { resolveGlossary, METRIC_DEFS } from "./src/adi/sentrix/glossary.js";
import { applyScenarioToSkuInventario } from "./src/engine/scenarios.js";
import { skusMargen } from "./src/data/skusMargen.js";
import { diagnoseInventarioSku } from "./src/adi/diagnosis/economicDiagnosis.js";
import { initTenant } from "./src/data/tenantStore.js";
import { TENANT_DEMO } from "./src/data/tenants/demo.js";

// vía 1 (2026-08-20): el dataset se DECLARA acá. Antes se heredaba del import por defecto de tenantStore,
// que ya no existe: el store arranca en la forma vacía y el dato entra por initTenant. Ver tenantEmpty.js.
initTenant(TENANT_DEMO);

let pass = 0; const fails = [];
const ok = (cond, label, extra) => {
  if (cond) pass++; else fails.push({ label, extra: extra == null ? null : String(extra) });
  console.log(`  ${cond ? "✓" : "✗"} ${label}${cond || extra == null ? "" : `\n      → ${extra}`}`);
};
const head = (t) => console.log(`\n── ${t} ──`);
const SC = "bonanza";
const src = (p) => fs.readFileSync(path.join(process.cwd(), p), "utf8");
const inv = applyScenarioToSkuInventario(SC);

console.log("\n═══ UNA PALABRA, UN REFERENTE · candado de ambigüedad de términos ═══");

/* ─────────────────────────────────────────────────────────────────────────────────────────────────────────────
 * [1] EL REGISTRO DE ETIQUETAS DEL ORÁCULO · dos campos no pueden reclamar la misma etiqueta
 * Origen: `margen`/`margenPct` y `venta`/`actual` declaraban la misma etiqueta, y el mapa etiqueta→campo se
 * armaba con "gana el último escrito", en silencio.
 * ──────────────────────────────────────────────────────────────────────────────────────────────────────────── */
head("[1] registro de etiquetas del oráculo (entityRecord)");
ok(LABEL_COLLISIONS.length === 0,
  "ningún par de campos declara la MISMA etiqueta visible en la tabla F",
  LABEL_COLLISIONS.map((c) => `«${c.etiqueta}» ← ${c.campos.join(" y ")}`).join(" | "));

// las tres etiquetas del caso patrón, explícitas: si alguien las vuelve a fundir, el gate lo dice por nombre
ok(fieldLabel("margen") !== fieldLabel("margenPct"),
  "«Margen» (comercial) y el margen del inventario NO comparten etiqueta",
  `margen="${fieldLabel("margen")}" · margenPct="${fieldLabel("margenPct")}"`);
ok(fieldLabel("doh") === "Días de inventario",
  "`doh` se llama «Días de inventario» — el nombre con candado del producto",
  `doh="${fieldLabel("doh")}"`);
ok(fieldLabel("cobertura") == null,
  "el campo `cobertura` NO entra a la boleta: es un duplicado redondeado de `doh` y se declina, no se le busca nombre",
  `cobertura="${fieldLabel("cobertura")}"`);

// [CÓDIGO] el mapa etiqueta→campo no puede volver a resolver colisiones "gana el último" en silencio
const _er = src("src/adi/oracle/entityRecord.js");
ok(!/_LABEL2FIELD\s*=\s*Object\.fromEntries/.test(_er),
  "[código] `_LABEL2FIELD` no se arma con Object.fromEntries (ahí una colisión la ganaba el último, sin aviso)");
ok(/LABEL_COLLISIONS\.push/.test(_er),
  "[código] una colisión de etiquetas queda REGISTRADA, no descartada");

/* ─────────────────────────────────────────────────────────────────────────────────────────────────────────────
 * [2] EL ORDEN SELLADO ES EL ORDEN SERVIDO · o la tool declina
 * Origen: sortBy resolvía a un campo que el eje no tiene → el sort era un no-op y la tool igual sellaba
 * «descendente por X». «Los 5 clientes de mejor margen» devolvía Falabella 22% con La Polar (34%) fuera.
 * ──────────────────────────────────────────────────────────────────────────────────────────────────────────── */
head("[2] el orden que la tool SELLA es el que sirvió");
const TOKENS = ["venta", "ventas", "Ventas", "margen", "Margen", "contribucion", "Contribución", "rotacion", "stockUSD", "capital", "cobertura", "doh", "Días de inventario"];
let ordenMalo = [];
for (const dim of ["cliente", "sku", "marca", "familia"]) {
  for (const t of TOKENS) {
    const g = buildGrid(dim, { sortBy: t, limit: 20, scenario: SC });
    if (!g || g.unsupported) continue;                       // declinar es una respuesta correcta
    const campo = g.facts.sortBy;
    ok0: {
      // el sello debe nombrar la etiqueta del campo por el que REALMENTE se ordenó
      const lbl = fieldLabel(campo) || campo;
      if (!String(g.facts.orden).includes(lbl)) { ordenMalo.push(`${dim}/${JSON.stringify(t)}: sello "${g.facts.orden}" no nombra «${lbl}»`); break ok0; }
      // y las filas servidas deben estar efectivamente ordenadas por ese campo. Se compara sobre el registro CRUDO,
      // NO sobre la celda formateada: el formateador de dinero cambia de unidad según la magnitud ($4.3M / $980K),
      // así que parsear el string compararía 980 contra 4.3 y marcaría desorden donde no lo hay.
      const vals = g.facts.rows.map((r) => { const rec = rawRecordFor(dim, r.entidad, SC); return rec ? rec[campo] : null; });
      if (!axisHasField(dim, campo, SC)) { ordenMalo.push(`${dim}/${JSON.stringify(t)}: sirvió una grilla ordenada por un campo que el eje NO tiene (${campo})`); break ok0; }
      for (let i = 1; i < vals.length; i++) {
        if (Number.isFinite(vals[i]) && Number.isFinite(vals[i - 1]) && vals[i] > vals[i - 1] + 1e-9) {
          ordenMalo.push(`${dim}/${JSON.stringify(t)}: sello "${g.facts.orden}" pero el campo ${campo} va ${vals.slice(0, 6).join(" → ")}`);
          break;
        }
      }
    }
  }
}
ok(ordenMalo.length === 0, `toda grilla servida está ordenada por el campo que su sello nombra (${TOKENS.length} tokens × 4 ejes)`, ordenMalo.slice(0, 4).join(" | "));

// la forma CANÓNICA de la métrica (la que emite el planificador en las otras tools) tiene que funcionar
const gVentas = buildGrid("sku", { sortBy: "ventas", limit: 3, scenario: SC });
const gVenta = buildGrid("sku", { sortBy: "venta", limit: 3, scenario: SC });
ok(gVentas && gVenta && gVentas.facts.sortBy === gVenta.facts.sortBy,
  "«ventas» (clave canónica del sistema) y «venta» resuelven al MISMO campo",
  gVentas && gVenta ? `${gVentas.facts.sortBy} vs ${gVenta.facts.sortBy}` : "una de las dos no compuso");
const gMargenCli = buildGrid("cliente", { sortBy: "Margen", limit: 5, scenario: SC });
ok(gMargenCli && !gMargenCli.unsupported && gMargenCli.facts.sortBy === "margen",
  "en el eje cliente, «Margen» resuelve al margen comercial (el único que ese eje tiene)",
  gMargenCli && (gMargenCli.unsupported || gMargenCli.facts.sortBy));
// y un campo que el eje NO tiene se DECLINA en vez de sellar un orden falso
const gNoExiste = buildGrid("cliente", { sortBy: "rotacion", limit: 5, scenario: SC });
ok(gNoExiste && gNoExiste.unsupported,
  "una columna que el eje no mide se DECLINA (nunca una tabla con un orden que no se aplicó)",
  gNoExiste && JSON.stringify(gNoExiste.facts && gNoExiste.facts.orden));

/* ─────────────────────────────────────────────────────────────────────────────────────────────────────────────
 * [3] LA BOLETA DE UNA ENTIDAD · ninguna etiqueta autorizada dos veces, y el lector no confunde una con otra
 * Origen: «Cobertura (DOH)» 58d y «Cobertura» 30d entraban juntas y AUTORIZADAS a la misma boleta; y figFor
 * resolvía «Margen» por substring, así que devolvía «Margen de inventario» (aparece primero).
 * ──────────────────────────────────────────────────────────────────────────────────────────────────────────── */
head("[3] la boleta de una entidad · una etiqueta = una cifra");
let dupes = [], figForMalo = [];
for (const dim of ["sku", "cliente", "marca", "familia"]) {
  const g = buildGrid(dim, { limit: 50, scenario: SC });
  if (!g || g.unsupported) continue;
  for (const row of g.facts.rows) {
    const r = buildEntityRecord(dim, row.entidad, SC);
    if (!r) continue;
    const vistos = new Map();
    for (const f of r.boleta) {
      const lbl = String(f.label || "");
      if (vistos.has(lbl) && vistos.get(lbl) !== f.value) dupes.push(`${lbl}: ${vistos.get(lbl)} vs ${f.value}`);
      vistos.set(lbl, f.value);
    }
    // el token corto no puede robarle el turno a la etiqueta larga que lo contiene
    for (const token of ["Margen", "Ventas", "Contribución", "Rotación", "Días de inventario"]) {
      const exacta = r.boleta.find((f) => String(f.label).split("·").map((s) => s.trim()).includes(token));
      if (!exacta) continue;
      const hit = figFor(r.boleta, row.entidad, token);
      if (!hit || hit.label !== exacta.label) figForMalo.push(`${dim}/${row.entidad}/${token}: figFor→«${hit && hit.label}» pero existe «${exacta.label}»`);
    }
  }
}
ok(dupes.length === 0, "ninguna entidad autoriza DOS cifras distintas bajo la misma etiqueta", dupes.slice(0, 4).join(" | "));
ok(figForMalo.length === 0, "figFor devuelve la etiqueta EXACTA cuando existe (no una más larga que la contiene)", figForMalo.slice(0, 4).join(" | "));

// el caso patrón, medido: doh y cobertura difieren de verdad en este dato, y solo uno entra a la boleta
const difDoh = inv.filter((s) => Math.round(s.doh) !== Math.round(s.cobertura)).length;
ok(difDoh > 0, `el dato SIGUE trayendo dos campos distintos (difieren en ${difDoh}/${inv.length} SKU): el candado hace falta, no es teórico`);
const rTv = buildEntityRecord("sku", "SAM-TV55", SC);
ok(rTv && !rTv.boleta.some((f) => /·\s*Cobertura/i.test(String(f.label))),
  "ninguna cifra de la boleta se llama «Cobertura» (la palabra retirada del producto)",
  rTv && rTv.boleta.filter((f) => /Cobertura/i.test(String(f.label))).map((f) => f.label).join(" | "));

/* ─────────────────────────────────────────────────────────────────────────────────────────────────────────────
 * [4] LA ESCALA SE DECLARA, NO SE ADIVINA · `unit:"$"` cubre miles Y dólares crudos
 * Origen: la heurística «≥1000 → M» servía $18.60M donde son $18.6K, y el inventario total salía MAYOR que la
 * venta anual — la cifra que haría PARECER que los dos universos reconcilian. Eso es una alarma, no un logro.
 * ──────────────────────────────────────────────────────────────────────────────────────────────────────────── */
head("[4] la escala de cada métrica del ranking está declarada");
const sinEscala = Object.entries(RANKING_EXTREMES_METRICS).filter(([, m]) => m.unit === "$" && m.scale !== "K" && m.scale !== "raw");
ok(sinEscala.length === 0, "toda métrica `unit:\"$\"` declara su `scale` (K = miles · raw = dólares crudos)", sinEscala.map(([k]) => k).join(", "));
ok(RANKING_EXTREMES_METRICS.stockUSD.scale === "raw", "`stockUSD` declara escala CRUDA (lo que dice sourceManifest: money(raw))");
ok(RANKING_EXTREMES_METRICS.ventas.scale === "K" && RANKING_EXTREMES_METRICS.contribucion.scale === "K",
  "ventas/contribución declaran MILES (lo que dice sourceManifest: money(K))");
// el formateador la LEE: el mismo dígito no puede rendir igual en las dos escalas
ok(_formatMetricValue(18600, "stockUSD") !== _formatMetricValue(18600, "contribucion"),
  "el formateador distingue las dos escalas para el MISMO dígito",
  `stockUSD→${_formatMetricValue(18600, "stockUSD")} · contribucion→${_formatMetricValue(18600, "contribucion")}`);
ok(!/M`?;?\s*$/.test("") && !/\$\$\{\(value\/1000\)\.toFixed\(2\)\}M/.test(src("src/adi/composers/ranking.js")),
  "[código] la heurística «≥1000 → M» ya no decide la escala en composers/ranking.js");
ok(/spec\.scale/.test(src("src/adi/composers/ranking.js")) && /RANKING_EXTREMES_METRICS/.test(src("src/adi/narrativeLayer.js")),
  "[código] los DOS formateadores del ranking (composer y capa narrativa) leen la escala declarada");
// LA ALARMA: el capital total del inventario NUNCA puede leerse como millones de venta comercial
const capTotal = inv.reduce((a, s) => a + s.stockUSD, 0);
const ventaTotal = skusMargen.reduce((a, s) => a + s.venta, 0) * 1000;
ok(_formatMetricValue(capTotal, "stockUSD") === "$135K" || !/M$/.test(_formatMetricValue(capTotal, "stockUSD")),
  "el capital total NO se sirve en millones (sería mayor que la venta anual del negocio: reconciliación falsa)",
  `capital=${_formatMetricValue(capTotal, "stockUSD")} · venta anual=$${(ventaTotal / 1e6).toFixed(1)}M`);

/* ─────────────────────────────────────────────────────────────────────────────────────────────────────────────
 * [5] SENTRIX · una etiqueta visible = una regla
 * ──────────────────────────────────────────────────────────────────────────────────────────────────────────── */
head("[5] las etiquetas de Sentrix");
const cuadros = { cliente: buildCuadroMando("cliente", SC), sku: buildCuadroMando("sku", SC), marca: buildCuadroMando("marca", SC), bodega: buildCuadroMando("bodega", SC) };

// 5a · «Inmovilizado» es del DETECTOR. La regla de alerta operativa mide otra cosa y se llama distinto.
const reglaAlerta = inv.filter((x) => (x.alerta && x.alerta !== "ok") || x.rotacion < 2).reduce((a, x) => a + x.stockUSD, 0);
const reglaDetector = inv.filter((x) => diagnoseInventarioSku(x) === "capital_frenado").reduce((a, x) => a + x.stockUSD, 0);
ok(reglaAlerta !== reglaDetector, `las dos reglas SIGUEN dando distinto ($${reglaAlerta} vs $${reglaDetector}): el candado hace falta`);
const colsAlerta = [cuadros.bodega.columns.find((c) => c.key === "inmovilizado"), cuadros.bodega.columns.find((c) => c.key === "inmovPct"),
  (buildControlRing("bodega", "Santiago", SC).columns || []).find((c) => c.key === "inmovilizado")];
for (const c of colsAlerta) {
  ok(c && !/inmoviliz/i.test(c.label), `la columna de la regla de alerta NO se llama «inmovilizado» (es «${c && c.label}»)`, c && c.label);
}
const kpisB = buildEntityKPIs("bodega", "Santiago", SC);
ok(!kpisB.some((k) => /inmoviliz/i.test(k.label)), "ningún KPI de bodega usa la palabra «inmovilizado» para la regla de alerta",
  kpisB.filter((k) => /inmoviliz/i.test(k.label)).map((k) => k.label).join(" | "));
const kpiCap = (buildMesaCapital(SC).kpis || []).find((k) => /inmovilizado/i.test(k.label || ""));
ok(kpiCap != null, "la cara Capital SÍ conserva la palabra: es el dueño del concepto");
// y el glosario no puede contradecirse consigo mismo sobre esa palabra
const gInm = resolveGlossary("Inmovilizado");
ok(gInm && /detector|rotaci/i.test(gInm.def) && /detector|rotaci/i.test(METRIC_DEFS["Inmovilizado"] || ""),
  "glosario: la definición de métrica y la de concepto de «Inmovilizado» describen la MISMA regla (el detector)",
  `concepto="${gInm && gInm.def.slice(0, 60)}" · métrica="${(METRIC_DEFS["Inmovilizado"] || "").slice(0, 60)}"`);

// 5b · «En juego $» nombraba dos universos (contribución del año vs capital de hoy)
const enJuegoLbl = (d) => (cuadros[d].columns.find((c) => c.key === "enJuego") || {}).label;
ok(enJuegoLbl("cliente") !== enJuegoLbl("bodega"),
  "la columna del asesor NO comparte etiqueta entre el eje de contribución y el de capital",
  `cliente="${enJuegoLbl("cliente")}" · bodega="${enJuegoLbl("bodega")}"`);
ok(cuadros.cliente.total.enJuego > 100 * cuadros.bodega.total.enJuego,
  `los dos montos SIGUEN siendo de universos distintos ($${cuadros.cliente.total.enJuego} vs $${cuadros.bodega.total.enJuego}): el candado hace falta`);
ok(!/const _EN_JUEGO\s*=/.test(src("src/adi/sentrix/cuadro.js")),
  "[código] ya no hay UNA constante de columna compartida por las cuatro dimensiones");

// 5c · «vs prom»: el eje bodega mide otra cosa Y con el signo invertido
const gapLbl = (d) => (cuadros[d].columns.find((c) => c.key === "gap") || {}).label;
ok(gapLbl("bodega") !== gapLbl("cliente"),
  "el «vs prom» del eje bodega (signo invertido, sobre % en alerta) NO comparte etiqueta con el de margen",
  `bodega="${gapLbl("bodega")}" · cliente="${gapLbl("cliente")}"`);
let sinDef = [];
for (const d of Object.keys(cuadros)) for (const c of cuadros[d].columns) {
  if (!c.defKey) continue;
  if (!resolveGlossary(c.defKey)) sinDef.push(`${d}/${c.defKey}`);
  if (!resolveGlossary(c.label)) sinDef.push(`${d}/label:${c.label}`);
}
ok(sinDef.length === 0, "toda columna del Cuadro que declara defKey resuelve en el glosario, por defKey y por etiqueta visible", sinDef.join(" | "));
// la "i" de «vs prom» describe el promedio SIMPLE, que es el que la columna usa (antes decía «ponderado por venta»)
const gVsProm = resolveGlossary("vs prom");
ok(gVsProm && /simple/i.test(gVsProm.def) && !/^.*ponderado por venta.*$/i.test(gVsProm.def.split(".")[0]),
  "«vs prom» se explica como el promedio SIMPLE — que es con el que está calculado",
  gVsProm && gVsProm.def.slice(0, 90));
ok(Math.abs(cuadros.cliente.avg.margen - cuadros.cliente.total.margen) > 0.05,
  `el simple y el ponderado SIGUEN sin coincidir (${cuadros.cliente.avg.margen}% vs ${cuadros.cliente.total.margen}%): el candado hace falta`);

// 5d · «Estado»: los dos ejes de la cara Capital hablan el mismo vocabulario
const ccSku = buildCuadroCapital("sku", SC), ccBod = buildCuadroCapital("bodega", SC);
const estadosValidos = new Set(Object.keys(CAPITAL_ESTADOS));
const fueraVocab = [...ccSku.rows, ...ccBod.rows].filter((r) => !estadosValidos.has(r.estado));
ok(fueraVocab.length === 0, "los dos ejes del Cuadro de Capital usan el MISMO vocabulario de estados", fueraVocab.map((r) => `${r.name}:${r.estado}`).join(", "));
const estadoSkuDe = {}; for (const r of ccSku.rows) estadoSkuDe[r.name] = r.estado;
const RANK = { capital_frenado: 0, riesgo_quiebre: 1, sobrestock: 2, capital_sano: 3 };
let bodegaIncoherente = [];
for (const b of ccBod.rows) {
  const sus = inv.filter((x) => x.bodega === b.name).map((x) => estadoSkuDe[x.sku]).filter(Boolean);
  const peor = sus.slice().sort((a, c) => RANK[a] - RANK[c])[0];
  if (peor !== b.estado) bodegaIncoherente.push(`${b.name}: la bodega dice «${b.estado}» y su peor SKU es «${peor}»`);
}
ok(bodegaIncoherente.length === 0, "el estado de una bodega concuerda con el de sus SKU (nada de «en rango» sobre capital en quiebre)", bodegaIncoherente.join(" | "));

// 5e · «Rotación»: una sola rotación media del negocio
const rotOficial = rotacionPonderada(inv);
ok(cuadros.bodega.total.rotacion === rotOficial && cuadros.sku.total.rotacion === rotOficial,
  "la fila Total del Cuadro publica LA rotación del producto (ponderada por capital), en los dos ejes",
  `bodega=${cuadros.bodega.total.rotacion} · sku=${cuadros.sku.total.rotacion} · oficial=${rotOficial}`);

// 5f · «Margen»: ninguna columna de Sentrix llamada exactamente «Margen» se alimenta del universo inventario
const colCapital = (ccSku.columns || []).concat(buildMesaCapital(SC).drill ? Object.values(buildMesaCapital(SC).drill).flatMap((d) => d.columnas || []) : []);
const margenInvMalRotulado = colCapital.filter((c) => c && c.key === "margenPct" && String(c.label).trim() === "Margen");
ok(margenInvMalRotulado.length === 0, "ninguna columna alimentada por `margenPct` se rotula «Margen» a secas (es otro universo que el margen comercial)",
  margenInvMalRotulado.map((c) => c.label).join(" | "));

/* ─────────────────────────────────────────────────────────────────────────────────────────────────────────────
 * [6] LA MISMA CIFRA POR DOS SUPERFICIES · el Perfil Ejecutivo contra el Pareto y contra el motor
 * Origen: el Perfil Ejecutivo del SKU leía miles como dólares crudos ($13.3K vs $13.3M) y hacía CERRAR dos universos que
 * no reconcilian: 9 de 13 SKU se leían como «inmoviliza más capital del que vende en un año».
 * ──────────────────────────────────────────────────────────────────────────────────────────────────────────── */
head("[6] la misma cifra por dos superficies");
const par = buildConcentration("sku", SC, "ventas");
const parBy = new Map(par.bars.map((b) => [b.name, b.value]));
let escalaMala = [];
for (const s of skusMargen) {
  const k = buildEntityKPIs("sku", s.nombre, SC);
  const v = (k.find((x) => x.label === "Ventas") || {}).value;
  const esperado = "$" + (parBy.get(s.nombre) / 1000).toFixed(1) + "M";
  if (v !== esperado) escalaMala.push(`${s.nombre}: Ficha ${v} · Pareto ${esperado}`);
}
ok(escalaMala.length === 0, `la venta de un SKU se lee IGUAL en el Perfil Ejecutivo y en el Pareto (${skusMargen.length} SKU)`, escalaMala.slice(0, 4).join(" | "));
// LA ALARMA del owner: si el capital de un SKU quedara por encima de su venta anual, los dos universos habrían "cerrado"
let cierreFalso = [];
for (const s of skusMargen) {
  const i = inv.find((x) => x.sku === s.nombre); if (!i) continue;
  if (i.stockUSD > s.venta * 1000) cierreFalso.push(`${s.nombre}: capital $${i.stockUSD} > venta $${s.venta * 1000}`);
}
ok(cierreFalso.length === 0, "ningún SKU se lee como «inmoviliza más capital del que vende en un año» (sería una reconciliación falsa)", cierreFalso.slice(0, 4).join(" | "));

/* ─────────────────────────────────────────────────────────────────────────────────────────────────────────────
 * [7] BARRIDO DE CÓDIGO · el texto que este dataset no dispara
 * En este proyecto ya hubo un texto que solo se cazó leyendo el archivo. Acá se afirma sobre la FUENTE, no
 * sobre la corrida: una rama que el caso feliz nunca visita igual queda cubierta.
 * ──────────────────────────────────────────────────────────────────────────────────────────────────────────── */
head("[7] barrido de código · lo que la ejecución no toca");
const _cd = src("src/adi/composers/crossDomain.js");
// la rama que filtra por targetCarga no puede atribuir su monto a la mejor práctica interna
const bloqueFuga = _cd.slice(_cd.indexOf('archetype === "fuga_distribuida"'), _cd.indexOf('archetype === "calidad_crecimiento"'));
ok(/meta operativa de carga/.test(bloqueFuga) && !/con carga comercial sobre la mejor práctica interna/.test(bloqueFuga),
  "[código] la lectura de fuga distribuida nombra la MISMA vara con la que filtra y valoriza (la meta operativa)");
ok(/sobre la mejor práctica interna \(\$\{bestPractice/.test(_cd) || /mejor práctica interna \(\$\{bestPractice\.toFixed/.test(_cd),
  "[código] el gap que se mide contra la mejor práctica interna la NOMBRA con su cifra (no dice «referencia» a secas)");
const _fu = src("src/adi/composers/followups.js");
ok(!/el promedio de la cartera|promedio interno de la cartera/.test(_fu.split("\n").filter((l) => !/^\s*\/\//.test(l)).join("\n")),
  "[código] followups no llama «el promedio de la cartera» a una media SIMPLE (el glosario reserva ese nombre para el ponderado)");
// la palabra retirada no puede volver a emitirse como etiqueta de cifra autorizada
for (const f of ["src/adi/oracle/entityRecord.js", "src/adi/oracle/ledger.js"]) {
  const t = src(f).split("\n").filter((l) => !/^\s*(\/\/|\*)/.test(l)).join("\n");
  ok(!/"(Cobertura|Días de cobertura|Cobertura \(DOH\))"/.test(t), `[código] ${path.basename(f)} no emite «Cobertura» como etiqueta de cifra`);
}
// EL DETECTOR Y LA REGLA DE ALERTA NO PUEDEN VOLVER A COMPARTIR NOMBRE. La palabra «inmovilizado» sí puede
// aparecer en estos archivos —la columna del asesor publica el monto DEL DETECTOR y ése es su nombre correcto—, así
// que la afirmación no puede ser «la palabra no está»: es que la REGLA de alerta (alerta ≠ ok O rotación < 2) no se
// llame así. Se busca el predicado literal y se exige que el identificador que lo nombra no diga «inmoviliz».
for (const f of ["src/adi/sentrix/cuadro.js", "src/adi/sentrix/control.js", "src/adi/sentrix/kpis.js"]) {
  const t = src(f);
  const decls = [...t.matchAll(/(?:const|let)\s+(\w+)\s*=\s*\(x\)\s*=>\s*\(x\.alerta[^\n]*x\.rotacion\s*<\s*2/g)].map((m) => m[1]);
  ok(decls.length > 0, `[código] ${path.basename(f)} declara la regla de alerta con un nombre propio`, `encontradas: ${decls.length}`);
  const malNombradas = decls.filter((n) => /inmoviliz/i.test(n));
  ok(malNombradas.length === 0, `[código] ${path.basename(f)}: la regla de alerta NO se llama «inmovilizado» (esa palabra es del detector)`, malNombradas.join(", "));
  // y ninguna etiqueta que salga de esa regla puede usar la palabra
  const etiquetasAlerta = [...t.matchAll(/label:\s*"([^"]*[Ii]nmovilizado[^"]*)"[^\n]*?(?:inmovCap|inmovPct|key:\s*"inmov)/g)].map((m) => m[1]);
  ok(etiquetasAlerta.length === 0, `[código] ${path.basename(f)}: ninguna etiqueta alimentada por la regla de alerta dice «inmovilizado»`, etiquetasAlerta.join(" | "));
}
// el límite que el dato no cierra tiene que estar DECLARADO, no comentado
const _conc = src("src/adi/sentrix/concentration.js");
ok(/limite:\s*_limite\(/.test(_conc), "[código] el Pareto DEVUELVE su límite (para que la pantalla pueda declararlo), no solo lo comenta");
ok(/con\.limite/.test(src("src/ui/SentrixPanel.jsx")), "[código] la pantalla RENDERIZA ese límite");
ok(!/SUMA EXACTO la cifra del cuadro/.test(src("src/ui/SentrixPanel.jsx")),
  "[código] el «i» del Pareto ya no afirma un cierre exacto que en dos ejes no se cumple");

/* ── resumen ────────────────────────────────────────────────────────────────────────────────────────────── */
const total = pass + fails.length;
console.log(`\n${pass}/${total} chequeos correctos${fails.length ? ` · ${fails.length} FALLA(S)` : " ✓"}`);
if (fails.length) for (const f of fails) console.log(`  ✗ ${f.label}${f.extra ? ` → ${f.extra}` : ""}`);
console.log(`── _ambiguedad_terminos_gate: ${pass} PASS · ${fails.length} FAIL (de ${total}) ──`);
process.exit(fails.length ? 1 : 0);
