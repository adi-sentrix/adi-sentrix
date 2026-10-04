/* === _procedencia_gate.mjs · LA PROCEDENCIA DE LO DECLARADO Y DE LO DOCUMENTAL (Etapa 2, bloque 3 · owner 2026-10-03, decisión §7.3·58, offline) ==================================
 * EL DEFECTO QUE CIERRA (verificado por el supervisor): `entrega/referencias.js` escribía «declarado por la empresa» FIJO en el benchmark, el nivel de carga y la referencia oficial, y `componer.js` escribía
 * «Simulación declarada por la empresa» (el supuesto de una simulación sale de la consulta). Con el demo era verdad —su perfil declara esos valores—; con una empresa que NO los declaró (una cargada por la
 * plantilla v2, que ya no pide políticas) era una procedencia FALSA. Ahora UNA función de origen (`businessPolicy.js:procedenciaDeLlave`) devuelve { origen, fuente, confirmado } y la frase sale de UNA tabla
 * (`ETIQUETA_ORIGEN`); ningún composer la escribe a mano.
 *
 * LAS DOS DEFINICIONES QUE SE AJUSTAN (y nada más se reclasifica): DECLARADO = un acto explícito de declaración (el perfil de la empresa, un criterio dicho en el chat y confirmado, un parámetro de la plantilla
 * oficial llenado por ella, o un valor documental que la empresa confirmó adoptar —conserva el rastro—); DOCUMENTAL = lo que dice un archivo que NO es la plantilla oficial («según <documento>», «sin confirmar»
 * si no se confirmó; lo pendiente no se usa), aunque la columna se llame «meta», «benchmark» u «objetivo».
 *
 * CRITERIO DE CIERRE DEL OWNER: «cero atribuciones falsas y sin regresiones materiales». Este candado lo mide:
 *   §1  TRES EMPRESAS sobre una muestra de los catálogos sellados v13–v40 (`fixtures/procedencia/muestra-v13-v40.json`): (1) declara todo = el demo → el texto es IDÉNTICO al de antes (hash del código de
 *       accf5ddc) salvo la frase de la simulación; (2) no declara nada → cero «declarado por la empresa» y cada referencia con «criterio general de ADI, ajustable por la empresa»; (3) declara solo algunas
 *       llaves → la atribución aparece EXACTAMENTE en esas. Un oráculo independiente (lee el TEXTO, no el código) cuenta las atribuciones falsas por empresa: deben ser 0.
 *   §2  TODOS LOS TIPOS DE REFERENCIA: benchmark, nivel de carga, los umbrales de inventario, el umbral de materialidad y la simulación.
 *   §3  UN ARCHIVO QUE NO ES LA PLANTILLA OFICIAL, con una columna «benchmark»/«meta»: nunca «declarado por la empresa»; documental confirmado → declarado con rastro; sin confirmar → no se usa.
 *   §4  EL CAMINO DEL COMPLEMENTO: pendiente → no se atribuye; confirmado → sí; otra empresa → nunca; un criterio tomado de un documento conserva su rastro.
 *   §5  EL CANDADO: un barrido que pone el gate en rojo si la frase aparece escrita como texto de salida fuera de la tabla única (ignora comentarios), y una CARNADA que reinserta la frase fija.
 *   §6  COMPARABILIDAD Y `admiteDeclarado`: un declarado y un medido se comparan solo si ADI demuestra mismo concepto, misma unidad y (dinero) misma moneda y escala; un declarado entra a un cálculo solo si el
 *       contrato de ESA métrica lo admite, con su procedencia y sin sustituir un medido. Hoy ninguna métrica lo admite.
 *   §7  EL PLAZO DE COBRO (opción A): visible en «Lo declarado» con su procedencia y citado por la pregunta abierta; ninguna cifra calculada cambia.
 *
 * CERO llamadas a un LLM · CERO red. Solo por `npm run gates:offline`. */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { initTenant } from "./src/data/tenantStore.js";
import { TENANT_DEMO } from "./src/data/tenants/demo.js";
import { validarEncargo } from "./src/adi/encargo/validar.js";
import { componerEntrega } from "./src/adi/entrega/componer.js";
import { crearAcciones } from "./src/adi/capacidad/acciones.js";
import { crearAlmacenEnMemoria } from "./src/adi/continuidad/almacen.js";
import * as BP from "./src/config/businessPolicy.js";
import * as LD from "./src/adi/capacidad/loDeclarado.js";
import * as REF from "./src/adi/entrega/referencias.js";
import { METRICS, admiteDeclarado } from "./src/config/contract/metricRegistry.js";

let pass = 0, fail = 0;
const fails = [];
const ok = (c, m, extra = "") => { if (c) { pass++; } else { fail++; fails.push(m + (extra ? " — " + extra : "")); console.log("  ✗ " + m + (extra ? "\n      " + String(extra).slice(0, 600) : "")); } };
const H = (t) => console.log(`\n${t}`);
const jj = (x) => JSON.stringify(x);
const sha = (s) => crypto.createHash("sha256").update(String(s)).digest("hex").slice(0, 16);
const clonar = (x) => JSON.parse(JSON.stringify(x));
const sinComentarios = (src) => String(src).replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`\\])\/\/[^\n]*/g, "$1");

/* las dos frases de la simulación: la de ANTES (falsa) y la de AHORA (el origen real: lo planteó quien consulta) */
const SIM_VIEJA = "Simulación declarada por la empresa";
const SIM_NUEVA = "Simulación planteada en la consulta";
const ETQ_EMPRESA = "declarado por la empresa", ETQ_ADI = "criterio general de ADI, ajustable por la empresa";

/* ── LAS TRES EMPRESAS: el demo (declara todo su perfil) · una que no declara ninguna política (la plantilla v2: solo identidad, período y moneda) · una que declara solo algunas llaves ── */
const PERFIL_BASE = { moneda: TENANT_DEMO.perfil.moneda, costModel: TENANT_DEMO.perfil.costModel };
/* la plantilla v2 no trae benchmark por fila: una empresa que no lo declara en su perfil tampoco lo trae en su dato (el demo sí: 30.1 en cada fila, igual que su perfil) */
const sinBenchPorFila = (d) => { const o = { ...d }; for (const k of ["clientesMargen", "marcasMargen", "sfamiliasMargen", "skusMargen"]) o[k] = d[k].map((r) => { const { benchmark, ...resto } = r; return resto; }); return o; };
const DEMO_SIN_BENCH = sinBenchPorFila(TENANT_DEMO);
const EMPRESAS = {
  demo: TENANT_DEMO,
  nada: { ...DEMO_SIN_BENCH, perfil: { ...PERFIL_BASE } },
  algunas: { ...DEMO_SIN_BENCH, perfil: { ...PERFIL_BASE, benchmark: 27.5, dohMax: 90, materialidadFocoPctVenta: 0.1 } },
};
/* lo que cada empresa DECLARÓ, leído del propio perfil (independiente del resolvedor que se prueba) */
const DECLARADO = Object.fromEntries(Object.entries(EMPRESAS).map(([k, d]) => [k, new Set(Object.keys(d.perfil).filter((x) => typeof d.perfil[x] === "number"))]));
const textoDe = (dataset, encargo) => { initTenant(dataset); const r = componerEntrega(validarEncargo(encargo, {})); return r && r.ok ? r.texto : null; };

/* ── EL ORÁCULO (lee el TEXTO, no el código): qué llaves atribuye cada frase de origen ── */
const SOLO_GLOSARIO = /El criterio puede ser el declarado por la empresa o el general de ADI/g;   /* la definición del glosario (Sentrix) nombra las dos posibilidades: no atribuye ninguna */
function clavesDe(ctx) {
  const c = ctx.toLowerCase();
  const k = new Set();
  if (/criterio de inventario:?\s*$/.test(c)) { ["rotacionMin", "dohMax", "sobrestockDohMin"].forEach((x) => k.add(x)); return k; }
  if (/benchmark/.test(c)) k.add("benchmark");
  if (/nivel de carga/.test(c)) k.add("targetCarga");
  if (/rotaci/.test(c) && !/quiebre/.test(c)) k.add("rotacionMin");
  if (/quiebre/.test(c)) k.add(/techo/.test(c) ? "quiebreDohMax" : "quiebreRotMin");
  else if (/techo|cobertura|d[ií]as de inventario/.test(c)) k.add("dohMax");
  if (/sobrestock/.test(c)) k.add("sobrestockDohMin");
  if (/materialidad/.test(c)) k.add("materialidadFocoPctVenta");
  if (/frenad/.test(c)) k.add("frenadoDiasSinVenta");
  if (/simulaci[oó]n/.test(c)) k.add("SIMULACION");
  return k;
}
function atribuciones(texto) {
  const t = String(texto || "").replace(SOLO_GLOSARIO, "");
  const out = [];
  const barrer = (re, etq) => {
    re.lastIndex = 0; let m;
    while ((m = re.exec(t))) {
      const antes = t.slice(Math.max(0, m.index - 160), m.index);
      const corte = Math.max(antes.lastIndexOf(". "), antes.lastIndexOf("; "), antes.lastIndexOf("\n"), antes.lastIndexOf("| "), antes.lastIndexOf(") "));
      out.push({ etq, claves: clavesDe(antes.slice(corte + 1)), ctx: antes.slice(corte + 1).slice(-70) });
    }
  };
  barrer(/declarad[oa] por la empresa/g, "empresa");
  barrer(/general de ADI/g, "adi");
  return out;
}
/* una atribución es FALSA si dice «declarado por la empresa» de una llave que la empresa no declaró (o de una simulación), o «general de ADI» de una que SÍ declaró */
const esFalsa = (a, declarado) => (a.etq === "empresa" ? [...a.claves].some((x) => x === "SIMULACION" || !declarado.has(x)) : [...a.claves].some((x) => declarado.has(x)));

/* ═══ 1 · TRES EMPRESAS SOBRE LOS CATÁLOGOS SELLADOS v13–v40 ═══════════════════════════════════════════════════════════════════════════ */
H("1 · tres empresas sobre una muestra de los catálogos sellados v13–v40: el demo no cambia (salvo la simulación) · sin declarar nada → cero atribuciones · algunas llaves → exactamente esas");
const MUESTRA = JSON.parse(fs.readFileSync(new URL("./fixtures/procedencia/muestra-v13-v40.json", import.meta.url), "utf8")).casos;
ok(MUESTRA.length > 400 && new Set(MUESTRA.map((c) => c.id)).size === MUESTRA.length && new Set(MUESTRA.map((c) => c.id.split(":")[0])).size === 28, `la muestra trae ${MUESTRA.length} encargos únicos de los 28 catálogos sellados (v13–v40)`);
const TEXTOS = { demo: new Map(), nada: new Map(), algunas: new Map() };
for (const c of MUESTRA) for (const e of Object.keys(EMPRESAS)) TEXTOS[e].set(c.id, textoDe(EMPRESAS[e], c.encargo));
initTenant(TENANT_DEMO);
const REPORTE = {};
for (const e of Object.keys(EMPRESAS)) {
  let falsas = 0, atribs = 0, conSim = 0, nulos = 0, deLaEmpresa = new Set(), deAdi = new Set();
  const ejemplos = [];
  for (const [id, t] of TEXTOS[e]) {
    if (t == null) { nulos++; continue; }
    if (t.includes(SIM_NUEVA)) conSim++;
    for (const a of atribuciones(t)) { atribs++; if (esFalsa(a, DECLARADO[e])) { falsas++; if (ejemplos.length < 3) ejemplos.push(`${id}: ${a.etq} · ${[...a.claves]} · …${a.ctx}`); } else for (const k of a.claves) (a.etq === "empresa" ? deLaEmpresa : deAdi).add(k); }
  }
  REPORTE[e] = { falsas, atribs, conSim, nulos, deLaEmpresa: [...deLaEmpresa].sort(), deAdi: [...deAdi].sort() };
  ok(falsas === 0, `★ ${e}: CERO atribuciones falsas sobre ${TEXTOS[e].size} Entregas (${atribs} atribuciones leídas)`, ejemplos.join(" | "));
  ok(nulos < MUESTRA.length * 0.05, `${e}: la muestra compone (${nulos} sin Entrega de ${MUESTRA.length})`);
  ok(conSim > 20, `${e}: la muestra incluye simulaciones (${conSim}) y todas dicen «${SIM_NUEVA}»`);
}
console.log("  reporte:", jj(REPORTE));
/* (1) el demo: el texto es EL DE ANTES, salvo la frase de la simulación (hash del texto de accf5ddc) */
{
  const distintos = MUESTRA.filter((c) => { const t = TEXTOS.demo.get(c.id); return t == null || sha(t.split(SIM_NUEVA).join(SIM_VIEJA)) !== c.sha; });
  ok(distintos.length === 0, `★ (1) declara todo = el demo: ${MUESTRA.length - distintos.length} de ${MUESTRA.length} textos IDÉNTICOS a los de antes (salvo la frase de la simulación)`, distintos.slice(0, 4).map((c) => c.id).join(", "));
  const sinVieja = MUESTRA.every((c) => !(TEXTOS.demo.get(c.id) || "").includes(SIM_VIEJA) && !(TEXTOS.nada.get(c.id) || "").includes(SIM_VIEJA) && !(TEXTOS.algunas.get(c.id) || "").includes(SIM_VIEJA));
  ok(sinVieja, "la frase vieja de la simulación («declarada por la empresa») no sale en ninguna empresa");
  ok(["benchmark", "targetCarga", "rotacionMin", "dohMax"].every((k) => REPORTE.demo.deLaEmpresa.includes(k)), "(1) el demo atribuye a la empresa lo que su perfil declara: benchmark, nivel de carga, piso de rotación y techo de cobertura", jj(REPORTE.demo.deLaEmpresa));
}
/* (2) no declara nada: ninguna atribución a la empresa y cada referencia con el criterio general de ADI */
{
  let conEmpresa = 0;
  for (const [id, t] of TEXTOS.nada) if (t && atribuciones(t).some((a) => a.etq === "empresa")) conEmpresa++;
  ok(conEmpresa === 0 && REPORTE.nada.deLaEmpresa.length === 0, `★ (2) no declara nada: cero «${ETQ_EMPRESA}» en ${TEXTOS.nada.size} Entregas`, `${conEmpresa} textos`);
  ok(["benchmark", "targetCarga", "rotacionMin", "dohMax"].every((k) => REPORTE.nada.deAdi.includes(k)), `(2) y cada referencia dice «${ETQ_ADI}»: benchmark, nivel de carga, piso de rotación, techo de cobertura`, jj(REPORTE.nada.deAdi));
  const comp = [...TEXTOS.nada.values()].filter((t) => t && /Benchmark de margen[^\n]{0,30}: 30\.1%, criterio general de ADI, ajustable por la empresa\./.test(t)).length;
  ok(comp > 50, `(2) el texto del benchmark sin declarar es «Benchmark de margen: 30.1%, ${ETQ_ADI}.» (${comp} Entregas)`);
}
/* (3) declara solo algunas llaves: la atribución aparece EXACTAMENTE en esas */
{
  ok(["benchmark", "dohMax", "materialidadFocoPctVenta"].every((k) => REPORTE.algunas.deLaEmpresa.includes(k)) && REPORTE.algunas.deLaEmpresa.every((k) => DECLARADO.algunas.has(k)), "★ (3) declara benchmark, techo de cobertura y umbral de materialidad: la atribución aparece EXACTAMENTE en esas llaves", jj(REPORTE.algunas.deLaEmpresa));
  ok(["targetCarga", "rotacionMin"].every((k) => REPORTE.algunas.deAdi.includes(k)) && !REPORTE.algunas.deAdi.some((k) => DECLARADO.algunas.has(k)), "(3) y lo que no declaró (nivel de carga, piso de rotación) dice el criterio general de ADI — nunca al revés", jj(REPORTE.algunas.deAdi));
}
/* el oráculo MUERDE: la carnada es el defecto de antes (la frase fija) puesta sobre un texto de la empresa que no declaró */
{
  const t = [...TEXTOS.nada.values()].find((x) => x && /Benchmark de margen: 30\.1%, criterio general de ADI, ajustable por la empresa\./.test(x));
  const defectuoso = t.replace("Benchmark de margen: 30.1%, criterio general de ADI, ajustable por la empresa.", "Benchmark de margen: 30.1%, declarado por la empresa.");
  ok(atribuciones(defectuoso).some((a) => esFalsa(a, DECLARADO.nada)) && !atribuciones(t).some((a) => esFalsa(a, DECLARADO.nada)), "★ CARNADA · el oráculo marca como FALSA la frase fija de antes sobre una empresa que no declaró (y deja pasar la correcta)");
  ok(atribuciones(`| Jumbo | ${SIM_VIEJA} | x |`).some((a) => esFalsa(a, DECLARADO.demo)) && !atribuciones(`| Jumbo | ${SIM_NUEVA} | x |`).some((a) => esFalsa(a, DECLARADO.demo)), "★ CARNADA · y marca como falsa «Simulación declarada por la empresa» incluso en el demo (la simulación sale de la consulta)");
  const t3 = [...TEXTOS.algunas.values()].find((x) => x && /Nivel de carga declarado: 3\.5%, criterio general de ADI/.test(x));
  ok(!!t3 && atribuciones(t3.replace("Nivel de carga declarado: 3.5%, criterio general de ADI, ajustable por la empresa", "Nivel de carga declarado: 3.5%, declarado por la empresa")).some((a) => esFalsa(a, DECLARADO.algunas)), "★ CARNADA · atribuir a la empresa el nivel de carga que NO declaró (la empresa de algunas llaves) se marca");
}
/* por el camino del Complemento (`consultar`), la misma Entrega: sin declarar nada, el texto es el de componer directo */
{
  const acc = crearAcciones({ ahora: () => "2026-10-03T12:00:00.000Z" });
  const muestra = MUESTRA.filter((_, i) => i % 18 === 0).slice(0, 30);
  let iguales = 0, falsas = 0;
  for (const e of Object.keys(EMPRESAS)) {
    for (const c of muestra) {
      const r = await acc.consultar({ tenant: { id: e, nombre: e, dataset: EMPRESAS[e], version: "v1" }, encargo: c.encargo });
      const directo = TEXTOS[e].get(c.id);
      if (r.ok && r.entrega.texto.endsWith(directo)) iguales++;   /* `consultar` solo puede ANTEPONER la línea de continuidad (un evento de la conversación): el texto de la Entrega es el mismo */
      if (r.ok) falsas += atribuciones(r.entrega.texto).filter((a) => esFalsa(a, DECLARADO[e])).length;
    }
  }
  initTenant(TENANT_DEMO);
  ok(falsas === 0, "por `consultar` (el camino del Complemento): cero atribuciones falsas en las tres empresas", String(falsas));
  ok(iguales === muestra.length * 3, `por «consultar» el texto de la Entrega es el de componer directo (${iguales} de ${muestra.length * 3}; a lo sumo antepone la línea de continuidad, sin nada declarado ni cita)`);
}

/* ═══ 2 · TODOS LOS TIPOS DE REFERENCIA ═══════════════════════════════════════════════════════════════════════════════════════════════ */
H("2 · todos los tipos de referencia: benchmark · nivel de carga · umbrales de inventario · umbral de materialidad · simulación");
{
  /* lo esperado, calculado SOLO del perfil de cada empresa y de la config (nunca del resolvedor) */
  const esperada = (emp, llave) => (DECLARADO[emp].has(llave) ? ETQ_EMPRESA : Number.isFinite(BP.POLICY_CONFIG[llave]) ? ETQ_ADI : "sin umbral declarado");
  const LLAVES = Object.values(BP.POLICY_DE_REFERENCIA);
  ok(LLAVES.length === 6, "las seis referencias de la casa (benchmark, nivel de carga, umbral de materialidad, piso de rotación, techo de cobertura, umbral de frenado) tienen su llave");
  for (const emp of Object.keys(EMPRESAS)) {
    initTenant(EMPRESAS[emp]);
    const malas = Object.entries(BP.POLICY_DE_REFERENCIA).filter(([concepto, llave]) => BP.procedenciaDeReferencia(concepto) !== esperada(emp, llave));
    ok(malas.length === 0, `${emp}: la procedencia de cada referencia (por concepto) es la que su perfil dice`, jj(malas.map(([c]) => [c, BP.procedenciaDeReferencia(c)])));
    const malasLlave = Object.keys(BP.NOMBRE_DE_UMBRAL).filter((llave) => BP.procedenciaDeUmbral(llave) !== esperada(emp, llave));
    ok(malasLlave.length === 0, `${emp}: y la de cada umbral (inventario · frenado · materialidad), por la misma función de origen`, jj(malasLlave));
    const cl = BP.clausulasDeProcedencia(["rotacionMin", "dohMax", "sobrestockDohMin", "materialidadFocoPctVenta"]);
    ok(cl.every((x) => !x.includes(ETQ_EMPRESA) || [...DECLARADO[emp]].some((k) => x.startsWith(BP.NOMBRE_DE_UMBRAL[k]))), `${emp}: las cláusulas del Marco atribuyen a la empresa solo lo que declaró`, jj(cl));
    ok(REF.textoDeBenchmark("30.1%").endsWith(`${esperada(emp, "benchmark")}.`) && REF.textoDeBenchmark("30.1%", { calificador: "comercial", nota: "x" }).includes(`(comercial): 30.1%, ${esperada(emp, "benchmark")}. x`), `${emp}: el texto del benchmark oficial lleva su origen real`);
    ok(REF.textoDeUmbralDeMaterialidad("0.05%", "$50K").includes(`, ${esperada(emp, "materialidadFocoPctVenta")}.`) && REF.textoDeUmbralDeMaterialidad("0.05%", "$50K").startsWith(DECLARADO[emp].has("materialidadFocoPctVenta") ? "Umbral de materialidad de la empresa:" : "Umbral de materialidad:"), `${emp}: el umbral de materialidad oficial lleva su origen real`);
  }
  initTenant(TENANT_DEMO);
  ok(BP.procedenciaDeUmbral("frenadoDiasSinVenta", { frenadoDiasSinVenta: 30 }) === "planteado en la consulta" && BP.procedenciaDeUmbral("frenadoDiasSinVenta") === "sin umbral declarado" && BP.procedenciaDeLlave("frenadoDiasSinVenta", { frenadoDiasSinVenta: 30 }).origen === "consulta", "el umbral de frenado: lo planteado en la consulta conserva su frase («planteado en la consulta»); sin declarar, «sin umbral declarado» (nunca se inventa un origen)");
  /* la simulación: el origen es la consulta, en las tres empresas */
  ok(BP.etiquetaDeProcedencia(BP.procedenciaDeSupuesto(), { genero: "f" }) === "planteada en la consulta" && BP.etiquetaDeProcedencia(BP.procedenciaDeSupuesto()) === "planteado en la consulta", "la simulación: el origen del supuesto es la consulta («planteado/planteada en la consulta», la etiqueta de siempre) — no hay una taxonomía nueva de supuestos");
  /* cada tipo de referencia aparece en el corpus con su frase, en el demo (declarada) y en la que no declara (criterio de ADI) */
  const tipos = [["benchmark", /Benchmark de margen[^\n]{0,30}: [0-9.]+%, /], ["nivel de carga", /Nivel de carga declarado: [0-9.]+%, /], ["techo de cobertura", /echo de cobertura: [0-9]+ días, /], ["piso de rotación", /iso de rotación: [0-9.]+x, /], ["criterio de inventario", /Criterio de inventario — /], ["umbral de materialidad", /mbral de materialidad/]];
  for (const [nombre, re] of tipos) {
    const hayDemo = [...TEXTOS.demo.values()].some((t) => t && re.test(t)), hayNada = [...TEXTOS.nada.values()].some((t) => t && re.test(t));
    ok(hayDemo && hayNada, `el corpus ejercita «${nombre}» con el demo y con la empresa que no declara`, `${hayDemo} · ${hayNada}`);
  }
}

/* ═══ 3 · UN ARCHIVO QUE NO ES LA PLANTILLA OFICIAL: «según <documento>», nunca «declarado por la empresa» ═══════════════════════════════════ */
H("3 · documental: un valor de un archivo no oficial (columna «benchmark» o «meta») · «según <documento>» · sin confirmar no se usa · confirmado → declarado con rastro");
{
  const DOC = "Lista_proveedor.xlsx · hoja Metas · columna «meta»";
  const conDoc = (llave, valor, confirmado) => ({ ...DEMO_SIN_BENCH, perfil: (() => { const p = { ...PERFIL_BASE, [llave]: valor, procedenciaDeLlaves: { [llave]: { origen: "documento", fuente: DOC, confirmado } } }; return p; })() });
  const sinConf = conDoc("targetCarga", 4.2, false);
  initTenant(sinConf);
  const pSin = BP.procedenciaDeLlave("targetCarga");
  ok(pSin.origen === "adi" && BP.umbral("targetCarga").valor === 3.5 && BP.POLICY.targetCarga === 3.5 && !BP.cargaEsDelNegocio(), "sin confirmar, lo que dice el archivo NO se usa: rige el criterio general de ADI (3.5), no el 4.2 del documento");
  const doc = BP.documentalSinConfirmar(sinConf.perfil, "targetCarga");
  ok(doc && doc.origen === "documental" && doc.confirmado === false && doc.valor === 4.2 && BP.etiquetaDeProcedencia(doc) === `según ${DOC}, sin confirmar`, "y se puede DECIR: «según <documento>, sin confirmar» (aunque la columna se llame «meta»)", jj(doc));
  ok(!BP.etiquetaDeProcedencia(doc).includes("declarado por la empresa"), "★ nunca «declarado por la empresa» mientras no se confirme");
  ok(BP.etiquetaDeProcedencia({ origen: "documental", fuente: { tipo: "documento", detalle: "Contrato.pdf" }, confirmado: true }) === "según Contrato.pdf" && BP.etiquetaDeProcedencia({ origen: "documental", fuente: { tipo: "documento", detalle: null }, confirmado: false }) === "según un documento, sin confirmar", "la tabla dice «según <documento>» y, sin confirmar, «, sin confirmar» (y sin nombre, «un documento»)");
  /* en una Entrega real */
  const casoNivel = MUESTRA.find((c) => /Nivel de carga declarado: 3\.5%, declarado por la empresa/.test(TEXTOS.demo.get(c.id) || ""));
  const casoBench = MUESTRA.find((c) => /Benchmark de margen: 30\.1%, declarado por la empresa/.test(TEXTOS.demo.get(c.id) || ""));
  ok(!!casoNivel && !!casoBench, "la muestra trae Entregas con el nivel de carga y con el benchmark para probar con un documento");
  const t1 = textoDe(sinConf, casoNivel.encargo);
  ok(/Nivel de carga declarado: 3\.5%, criterio general de ADI, ajustable por la empresa\./.test(t1) && !/Nivel de carga declarado: 4\.2/.test(t1) && !atribuciones(t1).some((a) => a.etq === "empresa" && !a.claves.has("rotacionMin") && !a.claves.has("dohMax")), "★ la Entrega con el nivel de carga que solo dice un documento sin confirmar usa 3.5 «criterio general de ADI» y no menciona el 4.2", (t1.match(/Nivel de carga[^\n]{0,80}/) || [""])[0]);
  const conf = conDoc("targetCarga", 4.2, true);
  const t2 = textoDe(conf, casoNivel.encargo);
  ok(/Nivel de carga declarado: 4\.2%, declarado por la empresa, tomado de Lista_proveedor\.xlsx · hoja Metas · columna «meta»\./.test(t2), "★ documental CONFIRMADO → declarado, conservando el rastro («declarado por la empresa, tomado de <documento>»)", (t2.match(/Nivel de carga[^\n]{0,160}/) || [""])[0]);
  ok(BP.cargaEsDelNegocio() === true || (initTenant(conf), BP.cargaEsDelNegocio()), "y entonces sí es de la empresa: rige el 4.2");
  const confB = { ...DEMO_SIN_BENCH, perfil: { ...PERFIL_BASE, benchmark: 28, procedenciaDeLlaves: { benchmark: { origen: "documento", fuente: "Contrato_Proveedor.pdf", confirmado: true } } } };
  const sinB = { ...DEMO_SIN_BENCH, perfil: { ...PERFIL_BASE, benchmark: 28, procedenciaDeLlaves: { benchmark: { origen: "documento", fuente: "Contrato_Proveedor.pdf", confirmado: false } } } };
  ok(/Benchmark de margen: 28%, declarado por la empresa, tomado de Contrato_Proveedor\.pdf\./.test(textoDe(confB, casoBench.encargo)), "el benchmark de un contrato que la empresa confirmó: «declarado por la empresa, tomado de Contrato_Proveedor.pdf»");
  const tB = textoDe(sinB, casoBench.encargo);
  ok(/Benchmark de margen: 30\.1%, criterio general de ADI, ajustable por la empresa\./.test(tB) && !/28%/.test(tB), "y sin confirmar no entra: 30.1% «criterio general de ADI» (no el 28 % del contrato)");
  initTenant(TENANT_DEMO);
  /* la plantilla oficial y el perfil: un parámetro de la plantilla o el perfil son declaración de la empresa (la v2 no pide ninguna política: ver `plantilla.js:PARAMETROS`) */
  const conPlantilla = { ...TENANT_DEMO, perfil: { ...PERFIL_BASE, dohMax: 100, procedenciaDeLlaves: { dohMax: { origen: "plantilla", fuente: "plantilla v2 · hoja Empresa · techo_dias", confirmado: true } } } };
  initTenant(conPlantilla);
  ok(BP.procedenciaDeLlave("dohMax").origen === "empresa" && BP.procedenciaDeLlave("dohMax").fuente.tipo === "plantilla" && BP.procedenciaDeReferencia("techo_cobertura") === ETQ_EMPRESA, "un parámetro de la plantilla oficial llenado por la empresa es declarado, con su rastro (plantilla · hoja · celda)");
  initTenant(TENANT_DEMO);
  const params = fs.readFileSync(new URL("./src/config/contract/plantilla.js", import.meta.url), "utf8");
  ok(!/policyKey/.test(params.slice(params.indexOf("export const PARAMETROS"), params.indexOf("export const HOJAS"))), "hoy la plantilla v2 NO pregunta ninguna política (solo identidad, período y moneda): nada de una plantilla v2 puede ser «declarado» por ella");
}

/* ═══ 4 · EL CAMINO DEL COMPLEMENTO ═══════════════════════════════════════════════════════════════════════════════════════════════════ */
H("4 · el Complemento: declaración pendiente → no se atribuye; confirmada → sí; otra empresa → nunca; tomada de un documento → con su rastro");
{
  const acc = crearAcciones({ continuidad: crearAlmacenEnMemoria(), ahora: () => "2026-10-03T12:00:00.000Z" });
  const pack = (id) => { const d = clonar(TENANT_DEMO); d.id = id; delete d.perfil.rotacionMin; delete d.perfil.dohMax; return d; };
  const T = (id) => ({ id, nombre: id, dataset: pack(id), version: "v1" });
  const encRota = (conv = null) => ({ version: "encargo/v1", ...(conv ? { conversacionId: conv } : {}), partes: [{ id: "p1", tema: "inventario", cierre: "lectura", universo: { eje: "sku", estados: ["rota lento"] } }] });
  const clausula = (r) => ((r && r.entrega && r.entrega.json.marco.definiciones) || []).find((d) => d.startsWith("Criterio de inventario — ")) || "";
  const a1 = await acc.consultar({ tenant: T("alfa"), encargo: encRota() });
  const conv = a1.continuidad.conversacionId;
  ok(/piso de rotación: 2\.0x, criterio general de ADI, ajustable por la empresa/.test(clausula(a1)) && !/declarado por la empresa/.test(clausula(a1)), "sin declarar nada: el piso de rotación es «criterio general de ADI», sin atribución a la empresa", clausula(a1));
  const ap = await acc.aportarContexto({ tenant: T("alfa"), conversacionId: conv, aportes: [{ clase: "criterio", concepto: "piso_rotacion", valor: { raw: 1.5, unidad: "ratio" } }] });
  const id = ap.resultados[0].id;
  const a2 = await acc.consultar({ tenant: T("alfa"), encargo: encRota(conv) });
  ok(ap.resultados[0].estado === "pendiente" && a2.entrega.texto === a1.entrega.texto && a2.declarado === undefined && !/declarado por la empresa/.test(a2.entrega.texto), "★ declaración PENDIENTE: no se atribuye (el texto es el mismo y no dice «declarado por la empresa»)", clausula(a2));
  await acc.aportarContexto({ tenant: T("alfa"), conversacionId: conv, confirmar: [id] });
  const a3 = await acc.consultar({ tenant: T("alfa"), encargo: encRota(conv) });
  ok(/piso de rotación: 1\.5x, declarado por la empresa/.test(clausula(a3)) && a3.declarado && a3.declarado.criterios[0].etiquetaDeOrigen === "declarado por la empresa" && a3.declarado.criterios[0].fuente.tipo === "chat", "★ CONFIRMADA: se atribuye a la empresa (en el Marco y en el bloque estructurado, con su fuente «chat»)", clausula(a3));
  const b1 = await acc.consultar({ tenant: T("beta"), encargo: encRota() });
  ok(/piso de rotación: 2\.0x, criterio general de ADI/.test(clausula(b1)) && !/declarado por la empresa/.test(clausula(b1)) && b1.declarado === undefined, "★ OTRA EMPRESA (beta): nunca la declaración de alfa — criterio general de ADI, sin bloque «declarado»", clausula(b1));
  /* un criterio tomado de un documento: pendiente no se usa; confirmado → declarado, con el rastro */
  const g0 = await acc.consultar({ tenant: T("gamma"), encargo: encRota() });
  const convG = g0.continuidad.conversacionId;
  const apG = await acc.aportarContexto({ tenant: T("gamma"), conversacionId: convG, aportes: [{ clase: "criterio", concepto: "piso_rotacion", valor: { raw: 1.8, unidad: "ratio" }, documento: { nombre: "Lista_proveedor.xlsx", tipo: "xlsx", parte: "hoja Metas · columna meta" } }] });
  const g1 = await acc.consultar({ tenant: T("gamma"), encargo: encRota(convG) });
  ok(apG.resultados[0].estado === "pendiente" && g1.entrega.texto === g0.entrega.texto && !/declarado por la empresa|Lista_proveedor/.test(g1.entrega.texto), "★ un valor leído de un archivo y SIN confirmar no se usa ni se atribuye", clausula(g1));
  const cG = await acc.conocerEmpresa({ tenant: T("gamma"), conversacionId: convG });
  const pendDoc = cG.pendientesDeConfirmar.find((h) => h.id === apG.resultados[0].id);
  ok(!!pendDoc && pendDoc.etiquetaDeOrigen === "según Lista_proveedor.xlsx, sin confirmar" && !/declarado por la empresa/.test(pendDoc.etiquetaDeOrigen), "★ y se anuncia como DOCUMENTAL: «según Lista_proveedor.xlsx, sin confirmar» (en `conocerEmpresa`, por confirmar), nunca como declarado", jj(pendDoc));
  await acc.aportarContexto({ tenant: T("gamma"), conversacionId: convG, confirmar: [apG.resultados[0].id] });
  const g2 = await acc.consultar({ tenant: T("gamma"), encargo: encRota(convG) });
  ok(/piso de rotación: 1\.8x, declarado por la empresa, tomado de Lista_proveedor\.xlsx/.test(clausula(g2)) && g2.declarado.criterios[0].fuente.tipo === "documento" && g2.declarado.criterios[0].fuente.detalle === "Lista_proveedor.xlsx" && g2.declarado.criterios[0].etiquetaDeOrigen === "declarado por la empresa, tomado de Lista_proveedor.xlsx", "★ confirmado por la empresa, el valor del documento pasa a declarado CONSERVANDO el rastro", clausula(g2));
  const d1 = await acc.consultar({ tenant: T("delta"), encargo: encRota() });
  ok(/criterio general de ADI/.test(clausula(d1)) && !/Lista_proveedor/.test(d1.entrega.texto), "y no se filtra a otra empresa (delta)");
  initTenant(TENANT_DEMO);
}

/* ═══ 5 · EL CANDADO: la frase solo vive en la tabla única ═══════════════════════════════════════════════════════════════════════════ */
H("5 · el candado: «declarado/a por la empresa» no puede estar escrito como texto de salida fuera de la tabla única (se ignoran los comentarios) · y una carnada que lo reinserta");
{
  const FRASE = /declarad[oa] por la empresa/gi;
  const fuentes = {};
  (function recorrer(dir) { for (const f of fs.readdirSync(dir, { withFileTypes: true })) { const p = path.join(dir, f.name); if (f.isDirectory()) recorrer(p); else if (/\.(js|jsx|mjs)$/.test(f.name)) fuentes[p.replace(/\\/g, "/")] = fs.readFileSync(p, "utf8"); } })("src");
  /* los ÚNICOS sitios permitidos, con el conteo FIJADO: la tabla única, y tres textos que NO atribuyen un valor concreto (la definición del glosario nombra las dos posibilidades; el rastro de un campo del perfil «camino B» y el del piso de materialidad de cobranza son el perfil declarado por definición) */
  const PERMITIDOS = {
    "src/config/businessPolicy.js": { n: 2, por: "LA TABLA ÚNICA (ETIQUETA_ORIGEN masculino y femenino)" },
    "src/adi/sentrix/glossary.js": { n: 2, por: "la definición de «Inmovilizado»: «el criterio puede ser el declarado por la empresa o el general de ADI» (no atribuye)" },
    "src/adi/conocimiento/piezas.js": { n: 1, por: "la descripción de un insumo de Knowledge: «criterio de ADI, o declarado por la empresa» (no atribuye)" },
    "src/config/contract/perfilCliente.js": { n: 1, por: "la `fuente` de un campo del perfil declarado por la empresa (camino B): es la declaración misma" },
    "src/config/contract/pisoMaterialidadCobranza.js": { n: 1, por: "la `fuente` del ajuste que la empresa declaró en su perfil (camino B): es la declaración misma" },
  };
  const barrer = (fs_) => Object.entries(fs_).map(([ruta, src]) => ({ ruta, n: (sinComentarios(src).match(FRASE) || []).length })).filter((x) => x.n > 0 && !(PERMITIDOS[x.ruta] && PERMITIDOS[x.ruta].n === x.n));
  const sueltas = barrer(fuentes);
  ok(Object.keys(fuentes).length > 200 && sueltas.length === 0, `★ ningún composer escribe la frase a mano: ${Object.keys(fuentes).length} archivos de src/ barridos, solo los ${Object.keys(PERMITIDOS).length} sitios permitidos la contienen (con su conteo fijado)`, jj(sueltas));
  ok(Object.keys(PERMITIDOS).every((r) => fuentes[r] && (sinComentarios(fuentes[r]).match(FRASE) || []).length === PERMITIDOS[r].n), "y cada sitio permitido sigue teniendo exactamente su conteo (si desaparece o crece, hay que decidirlo)");
  /* CARNADAS: reinsertar la frase fija vieja en los tres sitios donde estaba */
  const ref = fuentes["src/adi/entrega/referencias.js"], comp = fuentes["src/adi/entrega/componer.js"];
  const c1 = barrer({ ...fuentes, "src/adi/entrega/referencias.js": ref.replace('${procedenciaDeReferencia("benchmark")}', "declarado por la empresa") });
  const c2 = barrer({ ...fuentes, "src/adi/entrega/referencias.js": ref.replace('${procedenciaDeReferencia("nivel_carga")}', "declarado por la empresa") });
  const c3 = barrer({ ...fuentes, "src/adi/entrega/referencias.js": ref.replace('const origen = procedenciaDeReferencia(ref);', 'const origen = "declarado por la empresa";') });
  const c4 = barrer({ ...fuentes, "src/adi/entrega/componer.js": comp.replace("`Simulación ${etiquetaDeProcedencia(procedenciaDeSupuesto(), { genero: \"f\" })}`", "`Simulación declarada por la empresa`") });
  ok(ref.includes('${procedenciaDeReferencia("benchmark")}') && ref.includes('${procedenciaDeReferencia("nivel_carga")}') && ref.includes("const origen = procedenciaDeReferencia(ref);") && comp.includes("`Simulación ${etiquetaDeProcedencia(procedenciaDeSupuesto(), { genero: \"f\" })}`"), "las cuatro frases de antes ahora salen de la función de origen (el código lo dice)");
  ok(c1.length === 1 && c2.length === 1 && c3.length === 1 && c4.length === 1, "★ CARNADA · reinsertar la frase fija en el benchmark, el nivel de carga, la referencia oficial o la simulación pone el candado en ROJO", jj([c1, c2, c3, c4]));
  ok(barrer({ ...fuentes, "src/adi/entrega/nuevo.js": 'export const t = (v) => `Piso: ${v}, declarado por la empresa.`;' }).length === 1 && barrer({ ...fuentes, "src/adi/entrega/nuevo.js": 'export const t = "Simulación declarada por la empresa";' }).length === 1, "★ CARNADA · y un composer NUEVO que la escriba (con comillas o plantilla) también lo pone en rojo");
  ok(barrer({ ...fuentes, "src/adi/entrega/nuevo.js": "// declarado por la empresa\n/* declarada por la empresa */\nexport const t = 1;" }).length === 0, "control: la frase en un comentario NO cuenta (es historia, no texto de salida)");
}

/* ═══ 6 · COMPARABILIDAD Y `admiteDeclarado` ══════════════════════════════════════════════════════════════════════════════════════════ */
H("6 · un declarado y un medido se comparan solo si ADI demuestra mismo concepto, unidad y (dinero) moneda y escala · un declarado entra a un cálculo solo si el contrato de ESA métrica lo admite");
{
  const C = LD.comparabilidad;
  ok(C({ concepto: "dias_vencido", unidad: "days" }, { concepto: "dias_vencido", unidad: "days" }).comparable && C({ concepto: "margen", unidad: "pct" }, { concepto: "margen", unidad: "pp" }).comparable, "mismo concepto y misma unidad sin escala (días, porcentaje, puntos): comparables");
  ok(!C({ concepto: "margen", unidad: "pct" }, { concepto: "carga", unidad: "pct" }).comparable && !C({ concepto: "margen", unidad: "pct" }, { concepto: "margen", unidad: "days" }).comparable && !C(null, { concepto: "margen", unidad: "pct" }).comparable, "otro concepto, otra unidad o un lado ausente: NO comparables");
  const din = (m, e) => ({ concepto: "ventas", unidad: "money", ...(m ? { moneda: m } : {}), ...(e ? { escala: e } : {}) });
  ok(C(din("CLP", "unidad"), din("CLP", "unidad")).comparable, "★ dinero con la MISMA moneda y la MISMA escala declaradas de los dos lados: comparable");
  ok(!C(din(), din()).comparable && !C(din("CLP"), din("CLP")).comparable && !C(din("CLP", "unidad"), din("CLP")).comparable, "★ dinero sin moneda, o con moneda pero sin escala, o con la escala declarada de un solo lado: NO comparable (la escala jamás se infiere)", jj([C(din(), din()), C(din("CLP"), din("CLP")), C(din("CLP", "unidad"), din("CLP"))]));
  ok(!C(din("CLP", "unidad"), din("USD", "unidad")).comparable && !C(din("CLP", "unidad"), din("CLP", "miles")).comparable, "★ otra moneda, u otra escala: NO comparable");
  /* con el dato de hoy el resultado es el de siempre: el dinero declarado no tiene lugar y los hechos comparables son los mismos */
  const L = LD.lugarDeAporte;
  ok(!L({ clase: "hecho", concepto: "saldo_pendiente" }).enLaEntrega && /escala/.test(L({ clase: "hecho", concepto: "saldo_pendiente" }).motivo) && LD.HECHOS_DECLARABLES.every((h) => h.unidad !== "money"), "con el dato de hoy (sin moneda ni escala declaradas) el dinero declarado queda en la memoria: el mismo resultado de siempre, ahora por la regla explícita");
  const fila = (extra) => ({ id: "m1", estado: "vigente", clase: "hecho", concepto: "saldo_pendiente", entidad: "Lider", valor: { raw: 5, unidad: "money", ...extra }, declaradoEn: "2026-10-03T00:00:00Z", confirmacion: { por: "x", cuando: "2026-10-03T00:00:00Z", medio: "chat" } });
  ok(LD.clasificarLoDeclarado([fila({})]).hechos.length === 0 && LD.clasificarLoDeclarado([fila({ moneda: "CLP" })]).hechos.length === 0 && LD.clasificarLoDeclarado([fila({ moneda: "CLP", escala: "unidad" })]).hechos.length === 1, "★ un dinero declarado entra al contraste SOLO si trae su moneda y su escala; sin ellas, no");
  /* en una Entrega real: se muestran por separado sin restar cuando lo medido no declara su moneda y escala */
  const acc = crearAcciones({ continuidad: crearAlmacenEnMemoria(), ahora: () => "2026-10-03T12:00:00.000Z" });
  const ds = clonar(TENANT_DEMO); ds.id = "alfa";
  const enc = { version: "encargo/v1", partes: [{ id: "p1", tema: "cobranza", cierre: "cifra", conceptos: ["dias_vencido", "saldo_pendiente"], entidades: [{ nombre: "Lider", eje: "cliente" }] }] };
  initTenant(ds);
  const resolucion = validarEncargo(enc, {});
  const salida = componerEntrega(resolucion);
  const libro = salida.entrega.procedencia.libro;
  const hechos = LD.clasificarLoDeclarado([fila({ moneda: "CLP", escala: "unidad" })]).hechos;
  const sin = LD.contrastarHechos({ hechos, libro, resolucion, periodos: [] });
  ok(sin.length === 1 && sin[0].estado === "no_comparable" && sin[0].diferencia === null && sin[0].medido && /moneda|escala/.test(sin[0].motivoNoComparable), "★ lo medido no declara su moneda ni su escala: las dos cifras se muestran POR SEPARADO y NO se restan (no_comparable, sin diferencia)", jj(sin.map((x) => [x.estado, x.motivoNoComparable])));
  const t = LD.textoDeLoDeclarado({ hechos: sin });
  ok(/No se comparan: .*por separado, sin restar/.test(t) && !/No coinciden|lo declarado supera|queda por debajo/.test(t), "y el texto lo dice: «No se comparan … por separado, sin restar»", t);
  const con = LD.contrastarHechos({ hechos, libro, resolucion, periodos: [], marcoDeLoMedido: { moneda: "CLP", escala: "unidad" } });
  ok(con.length === 1 && ["coincide", "difiere"].includes(con[0].estado), "y con la moneda y la escala DEMOSTRADAS de los dos lados, se contrastan (coincide o difiere, con su diferencia)", jj(con.map((x) => x.estado)));
  initTenant(TENANT_DEMO);
  /* `admiteDeclarado`: por defecto falso; hoy ninguna métrica lo permite */
  ok(Object.values(METRICS).every((m) => m.admiteDeclarado !== true) && Object.keys(METRICS).every((k) => admiteDeclarado(k) === false) && admiteDeclarado("noExiste") === false, "★ hoy NINGUNA métrica del contrato admite un declarado en su cálculo (`admiteDeclarado`, por defecto falso): el comportamiento es el de siempre");
  const decl = { valor: 28, procedencia: { origen: "empresa", fuente: { tipo: "documento", detalle: "Contrato.pdf" }, confirmado: true } };
  const I = LD.insumoDeCalculo;
  ok(I({ metrica: "margen", medido: { valor: 25 }, declarado: decl }).usa === "medido" && I({ metrica: "margen", medido: { valor: 25 }, declarado: decl }).declaradoAlLado.valor === 28, "★ con un medido, rige el medido: el declarado queda AL LADO (nunca lo sustituye en silencio)");
  ok(I({ metrica: "margen", declarado: decl }).usa === null && /no admite un declarado/.test(I({ metrica: "margen", declarado: decl }).motivo), "★ sin medido y con una métrica que NO lo admite: el declarado no entra al cálculo (y dice por qué)");
  const antes = METRICS.margen.admiteDeclarado;
  METRICS.margen.admiteDeclarado = true;
  const permitido = I({ metrica: "margen", declarado: decl }), conMedido = I({ metrica: "margen", medido: { valor: 25 }, declarado: decl });
  if (antes === undefined) delete METRICS.margen.admiteDeclarado; else METRICS.margen.admiteDeclarado = antes;
  ok(permitido.usa === "declarado" && permitido.valor === 28 && permitido.etiquetaDeOrigen === "declarado por la empresa, tomado de Contrato.pdf" && permitido.procedencia.confirmado === true, "★ si el contrato de ESA métrica lo permite explícitamente, el declarado entra al cálculo CON su procedencia a la vista", jj(permitido));
  ok(conMedido.usa === "medido" && admiteDeclarado("margen") === false, "y aun permitido, nunca sustituye a un medido; y el contrato vuelve a su valor por defecto");
  /* el texto de «usar: declarado» sigue diciendo que rige lo medido */
  const tUsar = LD.textoDeLoDeclarado({ hechos: [{ concepto: "dias_vencido", rotulo: "Días vencido", unidad: "days", entidad: "Lider", valor: 15, estado: "difiere", medido: { valor: 269, texto: "269 días" }, diferencia: { sentido: "declarado_menor", texto: "254 días" }, sello: null, procedencia: { origen: "empresa", fuente: { tipo: "chat", detalle: null }, confirmado: true } }], usar: "declarado" });
  ok(/Se pidió usar lo declarado: ADI no calcula sobre lo declarado ni lo pone en lugar de lo medido/.test(tUsar), "pedirle «usar lo declarado» sigue dejando lo medido (el texto es el de siempre)");
}

/* ═══ 7 · EL PLAZO DE COBRO (opción A) ════════════════════════════════════════════════════════════════════════════════════════════════ */
H("7 · el plazo de cobro declarado: visible en «Lo declarado» con su procedencia y citado por la pregunta abierta; ninguna cifra calculada cambia");
{
  const acc = crearAcciones({ continuidad: crearAlmacenEnMemoria(), ahora: () => "2026-10-03T12:00:00.000Z" });
  const pack = (id) => { const d = clonar(TENANT_DEMO); d.id = id; return d; };
  const T = (id) => ({ id, nombre: id, dataset: pack(id), version: "v1" });
  const encCob = (ent, conv = null) => ({ version: "encargo/v1", ...(conv ? { conversacionId: conv } : {}), partes: [{ id: "p1", tema: "cobranza", cierre: "cifra", conceptos: ["dias_vencido", "saldo_pendiente"], entidades: [{ nombre: ent, eje: "cliente" }] }] });
  const antes = await acc.consultar({ tenant: T("alfa"), encargo: encCob("Lider") });
  const conv = antes.continuidad.conversacionId;
  const pa = (antes.entrega.json.paraSuJuicio || []).find((p) => p._preguntaAbierta && p.sobre && p.sobre.metrica === "saldo vencido");
  ok(!!pa && /plazo pactado/.test(pa.pregunta), "la Entrega de cobranza de Lider trae la pregunta abierta «¿plazo pactado o atraso real?» (su punto de partida)");
  const lugar = (await acc.aportarContexto({ tenant: T("alfa"), conversacionId: conv, aportes: [{ clase: "hecho", concepto: "plazo_de_cobro", entidad: "Lider", valor: { raw: 45, unidad: "days" }, documento: { nombre: "Contrato_Lider.pdf", tipo: "pdf" } }, { clase: "hecho", concepto: "plazo_de_cobro", entidad: "Falabella", valor: { raw: 60, unidad: "days" } }] }));
  ok(lugar.resultados.every((r) => r.estado === "pendiente" && r.lugar.enLaEntrega === true && /pregunta abierta/.test(r.lugar.como) && /no cambia ningún cálculo/.test(r.lugar.como)), "al declararlo se dice dónde se usará: en «Lo declarado» y en la pregunta abierta, sin cambiar ningún cálculo");
  const pend = await acc.consultar({ tenant: T("alfa"), encargo: encCob("Lider", conv) });
  ok(pend.declarado === undefined && pend.entrega.texto === antes.entrega.texto, "★ pendiente de confirmar: no se muestra ni se cita (el texto es el mismo)");
  await acc.aportarContexto({ tenant: T("alfa"), conversacionId: conv, confirmar: lugar.resultados.map((r) => r.id) });
  const despues = await acc.consultar({ tenant: T("alfa"), encargo: encCob("Lider", conv) });
  const bloque = despues.entrega.texto.slice(antes.entrega.texto.length);
  ok(despues.entrega.texto.startsWith(antes.entrega.texto) && /\*\*Lo declarado por la empresa y confirmado\.\*\*\n- Lider · Plazo de cobro: 45 días, declarado por la empresa, tomado de Contrato_Lider\.pdf \(confirmado el \d{4}-\d{2}-\d{2}\)\. Referencia para la pregunta abierta sobre la deuda de Lider \(«¿plazo pactado o atraso real\?»\)/.test(bloque), "★ confirmado: aparece en «Lo declarado» con su procedencia (declarado por la empresa, tomado de <documento>) y dice que es referencia de la pregunta abierta de Lider", bloque);
  const p = despues.declarado && despues.declarado.plazos && despues.declarado.plazos[0];
  ok(p && p.valor === 45 && p.unidad === "days" && p.entidad === "Lider" && p.etiquetaDeOrigen === "declarado por la empresa, tomado de Contrato_Lider.pdf" && p.citadoPor.tipo === "pregunta_abierta" && p.citadoPor.pregunta === pa.pregunta && /no cambia ningún cálculo/.test(p.nota) && despues.declarado.plazos.length === 1, "y el bloque estructurado lo cita: valor, unidad, procedencia con su rastro, la pregunta abierta que lo cita y que no cambia ningún cálculo", jj(p));
  ok(jj(despues.entrega.json.cifras) === jj(antes.entrega.json.cifras) && jj(despues.entrega.json.respuesta) === jj(antes.entrega.json.respuesta) && jj(despues.entrega.json.marco) === jj(antes.entrega.json.marco) && jj(despues.noResuelto) === jj(antes.noResuelto), "★ NINGUNA cifra calculada cambia: las cifras, la respuesta y el Marco de la Entrega son los de antes de declarar el plazo");
  const ref = await acc.consultar({ tenant: T("alfa"), encargo: { version: "encargo/v1", conversacionId: conv, partes: [{ id: "p1", tema: "inventario", cierre: "lectura", universo: { eje: "sku", estados: ["rota lento"] } }] } });
  const ref0 = await acc.consultar({ tenant: T("gamma"), encargo: { version: "encargo/v1", partes: [{ id: "p1", tema: "inventario", cierre: "lectura", universo: { eje: "sku", estados: ["rota lento"] } }] } });
  ok(ref.declarado === undefined && ref.entrega.texto === ref0.entrega.texto, "un plazo declarado no aparece donde no hay una pregunta abierta de cobranza que lo cite (la Entrega de inventario es la misma)");
  const otra = await acc.consultar({ tenant: T("alfa"), encargo: encCob("Falabella", conv) });
  const paF = (otra.entrega.json.paraSuJuicio || []).find((q) => q._preguntaAbierta && q.sobre && q.sobre.metrica === "saldo vencido");
  ok(!paF || (otra.declarado && otra.declarado.plazos && otra.declarado.plazos.every((q) => q.entidad === "Falabella" && q.valor === 60)) && !/45 días|Contrato_Lider/.test(otra.entrega.texto), "el plazo de una cuenta se cita solo en SU pregunta abierta (el de Lider no aparece en la de Falabella)");
  const beta = await acc.consultar({ tenant: T("beta"), encargo: encCob("Lider") });
  ok(beta.declarado === undefined && !/45 días|Plazo de cobro|Contrato_Lider/.test(beta.entrega.texto), "★ otra empresa (beta): nunca ve el plazo de alfa");
  const neg = LD.plazosCitados({ plazos: [{ id: "n", entidad: null, valor: 30, rotulo: "Plazo de cobro", unidad: "days", procedencia: null }], entrega: { paraSuJuicio: [{ _preguntaAbierta: true, sobre: { metrica: "saldo vencido", entidad: "Paris" }, pregunta: "q" }] } });
  ok(neg.length === 1 && neg[0].citadoPor.entidad === "Paris" && LD.plazosCitados({ plazos: [{ id: "n", entidad: null, valor: 30 }], entrega: { paraSuJuicio: [] } }).length === 0, "un plazo del NEGOCIO (sin cuenta) lo cita la pregunta abierta de cualquier cuenta; sin pregunta abierta de cobranza, no hay nada que citar");
  const cd = LD.declarable();
  ok(cd.citables.length === 1 && cd.citables[0].concepto === "plazo_de_cobro" && cd.citables[0].unidad === "days", "`conocerEmpresa` dice que el plazo de cobro se puede declarar con su forma exacta (citable)");
  initTenant(TENANT_DEMO);
}

console.log(`\n── _procedencia_gate: PASS ${pass} · FAIL ${fail} (de ${pass + fail}) ──`);
if (fail) { console.log("FALLAS:\n" + fails.map((f) => " ✗ " + f).join("\n")); process.exit(1); }
