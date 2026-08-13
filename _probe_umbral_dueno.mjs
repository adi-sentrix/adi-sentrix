/* === _probe_umbral_dueno.mjs · ENCARGO «UMBRAL DEL USUARIO + DUEÑO POR FILA» (2026-08-13) ======================
 * Reproduce OFFLINE el hallazgo VIVO del owner: «¿Cuánto capital tengo inmovilizado en inventario parado hace
 * más de 90 días?» → ADI respondió $33K (el total del criterio INTERNO del motor: estados por rotación/DOH, con
 * BOS-SANDER de 68 días adentro) presentándolo como «>90 días» — el real con diasSinVenta>90 son 2 SKU ≈ $22K
 * (LG-DRYER8KG 94d + MAK-COMP-AIR 112d, verificado contra demo.js:77/82). Y ADEMÁS atribuyó a LG-DRYER8KG cifras
 * de MAK-COMP-AIR. Dos huecos de motor, dos tareas:
 *   [1-4] T1 · suma_filtrada: filtrar+sumar con el umbral DECLARADO — bidireccional (la exacta pasa con criterio
 *         completo y sus filas; la torcida se veta), declinaciones en palabras de usuario (regla A2 del cierre).
 *   [5]   T1d · REGLA DE HONESTIDAD del camino viejo: inventoryStatus declara el umbral que NO aplica, y la
 *         declaración viaja obligatoria (ensureUmbralDeclarado).
 *   [6]   T2 · DUEÑO POR FILA en la boleta del turno (generalización de F1): el caso del owner LITERAL como
 *         regresión — cifras de MAK atribuidas a LG → veto NOMBRANDO al dueño real; bien atribuidas → pasa.
 *   [7]   T2 · ADITIVIDAD MEDIDA: boleta mono-entidad byte-idéntica con y sin la referencia de dueños; las
 *         formas legítimas (tabla · dueño en oración · eco · totales sin dueño) pasan intactas.
 * 100% OFFLINE: tools + guard puros — cero gateway, cero red.
 * Correr con el candado de red puesto:  node --import ./scripts/offline-guard.mjs _probe_umbral_dueno.mjs */
import { initTenant } from "./src/data/tenantStore.js";
import { TENANT_DEMO } from "./src/data/tenants/demo.js";
import { TOOLS } from "./src/adi/oracle/toolRegistry.js";
import { runPlan } from "./src/adi/oracle/toolRunner.js";
import { guardC } from "./src/adi/oracle/guardC.js";
import { OPERACIONES_CALCULO, ejecutarCalculo, esCalculoDelCatalogo } from "./src/adi/oracle/calculoCatalogo.js";
import { ensureUmbralDeclarado } from "./src/adi/oracle/narratePromptC.js";
import { axisEntityNames } from "./src/adi/oracle/entityIndex.js";

initTenant(TENANT_DEMO);

let PASS = 0, FAIL = 0;
const ok = (c, m, extra = "") => { if (c) { PASS++; console.log("  ✓ " + m); } else { FAIL++; console.log("  ✗ " + m + (extra ? "\n      " + String(extra).slice(0, 300) : "")); } };
const H = (t) => console.log("\n" + t);

// la regla A2 del cierre, verificable: sin identificadores con guion bajo, sin nombres de operación del catálogo,
// sin la palabra «insumos» — toda razón de declinación es texto de pantalla.
const OPS_RE = new RegExp("\\b(" + Object.keys(OPERACIONES_CALCULO).join("|") + ")\\b", "i");
const registroLimpio = (r) => !/\w_\w/.test(r) && !OPS_RE.test(r) && !/insumos?\b/i.test(r);

const DUENOS = [];
for (const eje of ["cliente", "sku", "marca", "familia", "bodega", "canal"]) for (const n of axisEntityNames(eje)) DUENOS.push(n);

H("[1] suma_filtrada EXACTA — el caso del owner: >90 días sin venta → $22K con sus 2 filas y el criterio COMPLETO");
const sf = TOOLS.calcular({ operacion: "suma_filtrada", insumos: [{ metrica: "capital" }], umbral: { metrica: "dias sin venta", operador: ">", valor: 90 }, scenario: "actual" });
{
  ok(sf.coverage.supported === true, "la cuenta ejecuta", sf.coverage.reason);
  ok(sf.facts.es_calculo === true && sf.facts.operacion === "suma_filtrada", "facts declaran la operación");
  const total = sf.boleta.find((f) => /total/i.test(f.label) && f.mandatory);
  ok(!!total && total.raw === 22000, "el total es $22K (13.6 + 8.4) — NO los $33K del criterio interno", total && `${total.label} = ${total.value}`);
  ok(!!total && /más de 90 días sin venta/.test(total.formula) && /LG-DRYER8KG/.test(total.formula) && /MAK-COMP-AIR/.test(total.formula) && /2 SKU/.test(total.formula),
    "la FÓRMULA declara el criterio completo Y las filas que lo componen", total && total.formula);
  ok(sf.facts.criterio && sf.facts.criterio.en_palabras === "más de 90 días sin venta" && sf.facts.criterio.valor === 90 && sf.facts.criterio.operador === ">",
    "facts.criterio: el umbral del usuario, estructurado y en palabras");
  ok(Array.isArray(sf.facts.filas) && sf.facts.filas.length === 2 && sf.facts.filas.map((f) => f.entidad).join(",") === "LG-DRYER8KG,MAK-COMP-AIR",
    "las filas SON parte del resultado (facts.filas)", JSON.stringify(sf.facts.filas));
  const filaLG = sf.boleta.find((f) => f.label === "LG-DRYER8KG · Capital en inventario");
  const diasLG = sf.boleta.find((f) => f.label === "LG-DRYER8KG · Días sin venta");
  ok(!!filaLG && filaLG.raw === 13600 && !!diasLG && diasLG.raw === 94, "cada fila entra a la boleta con su monto Y su valor del campo filtrado");
  const crit = sf.boleta.find((f) => /^Criterio del filtro ·/.test(f.label));
  ok(!!crit && crit.raw === 90 && crit.tipo && crit.tipo.sello === "indicado", "el umbral entra sellado INDICADO (es del usuario: se declara, no se mide)", crit && JSON.stringify(crit.tipo));
  ok(!!crit && /más de 90 días sin venta/.test(crit.context || ""), "…con el criterio completo en su contexto (el label no nombra métricas a propósito — chequeo 9)");
  ok(/nunca lo presentes como el total de otro criterio/.test(sf.facts.nota_criterio || ""), "la nota manda declarar el criterio al citar el total");
}

H("[2] BIDIRECCIONAL contra el muro — la exacta pasa; la torcida (el total del criterio interno) se veta");
{
  const base = { ledger: { figs: sf.boleta }, results: [{ tool: "calcular", ...sf }], trace: null,
    question: "¿Cuánto capital tengo inmovilizado en inventario parado hace más de 90 días?", duenosDelTenant: DUENOS };
  // «de capital» al lado de cada monto: la frase «días sin venta» dispara el vocabulario de VENTAS del chequeo 9
  // (preexistente — la palabra «venta»), y con «capital» también cerca la ventana queda ambigua → no se juzga.
  // Residual documentado en el informe; en tabla no pasa (la fila no dice «venta» en palabras).
  const bien = guardC("En SKU parados más de 90 días tienes $22K de capital: LG-DRYER8KG retiene $13.6K de capital (94 días sin venta) y MAK-COMP-AIR $8.4K de capital (112 días sin venta).", base);
  ok(bien.ok === true && bien.violations.length === 0, "la narración exacta, con criterio y filas, PASA", JSON.stringify(bien.violations));
  const torcida = guardC("Tienes $33.2K de capital parado hace más de 90 días.", base);
  ok(!torcida.ok && torcida.verdict === "cifra-no-autorizada", "el total del criterio INTERNO ($33.2K) narrado como «>90 días» se VETA (no está en esta boleta)", torcida.verdict);
  const inventada = guardC("En SKU parados más de 90 días tienes $25K.", base);
  ok(!inventada.ok && inventada.verdict === "cifra-no-autorizada", "un total torcido cualquiera ($25K) se VETA");
  // el muro NO recomputa la suma N-aria (conservador, misma razón medida que el proyectado de variacion_aplicada)
  ok(esCalculoDelCatalogo(33200, "money", [{ raw: 13600, unit: "money" }, { raw: 11200, unit: "money" }, { raw: 8400, unit: "money" }]) === false,
    "el muro NO espeja la suma de 3+ (los resultados llegan sellados en la boleta — combinatoria cerrada)");
  const dosOk = ejecutarCalculo("suma_filtrada", [{ raw: 13600, unit: "money" }, { raw: 8400, unit: "money" }]);
  ok(dosOk.ok && dosOk.resultados[0].raw === 22000, "el catálogo ejecuta la suma con aridad variable");
  const vacia = ejecutarCalculo("suma_filtrada", []);
  ok(!vacia.ok && vacia.regla === "aridad", "cero insumos declina por aridad (1+)");
  const mixta = ejecutarCalculo("suma_filtrada", [{ raw: 13600, unit: "money" }, { raw: 94, unit: "days" }]);
  ok(!mixta.ok && mixta.regla === "unidades-incompatibles", "unidades mezcladas declinan (solo montos $)");
}

H("[3] DECLINACIONES en palabras de usuario (regla A2) — campo inexistente · cruce de universos · corte faltante");
{
  const cruce = TOOLS.calcular({ operacion: "suma_filtrada", insumos: [{ metrica: "ventas" }], umbral: { metrica: "dias sin venta", operador: ">", valor: 90 }, scenario: "actual" });
  ok(cruce.coverage.supported === false && /universos no reconcilian/.test(cruce.coverage.reason), "sumar VENTAS con umbral de inventario declina nombrando la regla de universos", cruce.coverage.reason);
  ok(registroLimpio(cruce.coverage.reason), "…y la razón habla en palabras de usuario (sin tokens, sin nombres de operación)", cruce.coverage.reason);
  const noExiste = TOOLS.calcular({ operacion: "suma_filtrada", insumos: [{ metrica: "capital" }], umbral: { metrica: "temperatura", operador: ">", valor: 5 }, scenario: "actual" });
  ok(noExiste.coverage.supported === false && /no reconozco ese campo/.test(noExiste.coverage.reason) && registroLimpio(noExiste.coverage.reason),
    "un campo inexistente declina honesto, en palabras", noExiste.coverage.reason);
  const sinCorte = TOOLS.calcular({ operacion: "suma_filtrada", insumos: [{ metrica: "capital" }], umbral: { metrica: "dias sin venta" }, scenario: "actual" });
  ok(sinCorte.coverage.supported === false && /corte del umbral/.test(sinCorte.coverage.reason) && registroLimpio(sinCorte.coverage.reason),
    "sin corte numérico, la razón ES la pregunta (más de / menos de / al menos / hasta)", sinCorte.coverage.reason);
  const sinNada = TOOLS.calcular({ operacion: "suma_filtrada", scenario: "actual" });
  ok(sinNada.coverage.supported === false && registroLimpio(sinNada.coverage.reason), "sin campo ni umbral declina pidiendo ambos, en palabras");
}

H("[4] VARIANTES del filtro — rotación · umbral sin filas · operador en palabras");
{
  const rot = TOOLS.calcular({ operacion: "suma_filtrada", insumos: [{ metrica: "capital" }], umbral: { metrica: "rotacion", operador: "<", valor: 2 }, scenario: "actual" });
  const totalRot = rot.boleta.find((f) => f.mandatory);
  ok(rot.coverage.supported && totalRot && totalRot.raw === 33200 && /rotación bajo 2x/.test(totalRot.formula),
    "rotación bajo 2x → $33.2K (LG+BOS+MAK) con su criterio declarado", totalRot && totalRot.formula);
  const nada = TOOLS.calcular({ operacion: "suma_filtrada", insumos: [{ metrica: "capital" }], umbral: { metrica: "dias sin venta", operador: ">", valor: 300 }, scenario: "actual" });
  ok(nada.coverage.supported === true && nada.facts.filas.length === 0 && /ningún SKU cumple/.test(nada.facts.total.formula),
    "un umbral sin filas responde $0 declarando que nadie cumple (no es un error)", nada.facts.total.formula);
  const palabras = TOOLS.calcular({ operacion: "suma_filtrada", insumos: [{ metrica: "capital" }], umbral: { metrica: "dias sin venta", operador: "mas de", valor: 90 }, scenario: "actual" });
  ok(palabras.coverage.supported === true && palabras.boleta.find((f) => f.mandatory).raw === 22000, "el operador en palabras («mas de») también opera");
  const doh = TOOLS.calcular({ operacion: "suma_filtrada", insumos: [{ metrica: "capital" }], umbral: { metrica: "dias de inventario", operador: ">", valor: 100 }, scenario: "actual" });
  const totalDoh = doh.boleta.find((f) => f.mandatory);
  ok(doh.coverage.supported && totalDoh && totalDoh.raw === 33200 && /más de 100 días de inventario/.test(totalDoh.formula),
    "días de inventario > 100 → LG (165) + BOS (115) + MAK (190) = $33.2K", totalDoh && totalDoh.formula);
}

H("[5] REGLA DE HONESTIDAD del camino viejo — inventoryStatus declara el umbral que NO aplica");
{
  const PREG = "¿Cuánto capital tengo inmovilizado en inventario parado hace más de 90 días?";
  const out = runPlan({ intent: "answer", calls: [{ tool: "inventoryStatus", args: {} }] }, { scenario: "actual", preguntaUsuario: PREG });
  const inv = out.results[0];
  ok(inv.coverage.supported === true && !!inv.facts.umbral_no_aplicado, "la pregunta del owner (literal) dispara la declaración", JSON.stringify(inv.facts.umbral_no_aplicado || null));
  ok(inv.facts.umbral_no_aplicado.dias === 90 && /no está aplicado/.test(inv.facts.umbral_no_aplicado.declaracion) && /90 días/.test(inv.facts.umbral_no_aplicado.declaracion),
    "…con el corte citado (eco de la pregunta) y la declaración lista para pantalla", inv.facts.umbral_no_aplicado.declaracion);
  ok(/NUNCA presentes estos totales/.test(inv.facts.umbral_no_aplicado.nota), "…y la nota instruye al narrador (doctrina en facts, como la transferencia C1)");
  // el backstop: la declaración se ANTEPONE si el narrador no la dijo; no toca lo ya declarado; sin resultados no hace nada
  const texto = "Tienes $33.2K de capital inmovilizado en 3 SKU sin rotar.";
  const conDecl = ensureUmbralDeclarado(texto, out.results);
  ok(conDecl.startsWith("Ojo con el criterio:") && conDecl.includes(texto), "ensureUmbralDeclarado ANTEPONE la declaración (el criterio va primero)");
  ok(ensureUmbralDeclarado(conDecl, out.results) === conDecl, "…idempotente (no la duplica)");
  ok(ensureUmbralDeclarado("El criterio del motor son los estados; el umbral pedido no está aplicado. Detalle: $33.2K.", out.results).startsWith("El criterio"),
    "…y un texto que YA declara no se toca");
  ok(ensureUmbralDeclarado(texto, []) === texto, "sin declaración pendiente, byte-idéntico");
  // sin umbral en la pregunta → byte-idéntico a hoy (la key NO existe)
  const sinU = runPlan({ intent: "answer", calls: [{ tool: "inventoryStatus", args: {} }] }, { scenario: "actual", preguntaUsuario: "¿dónde está detenido mi capital?" });
  ok(!("umbral_no_aplicado" in (sinU.results[0].facts || {})), "una pregunta SIN umbral no agrega nada (aditivo)");
  // focus stale SÍ aplica el umbral → nada que declarar
  const stale = runPlan({ intent: "answer", calls: [{ tool: "inventoryStatus", args: { focus: "stale", staleDays: 90 } }] }, { scenario: "actual", preguntaUsuario: PREG });
  ok(stale.results[0].coverage.supported === true && !("umbral_no_aplicado" in (stale.results[0].facts || {})),
    "focus=stale APLICA el corte (diasSinVenta>90) → sin declaración: el criterio ES el pedido");
  const totalStale = stale.results[0].boleta.find((f) => /total/i.test(f.label) && f.mandatory);
  ok(!!totalStale && totalStale.raw === 22000, "…y su total ES $22K (la verdad del umbral, por la vía vieja también)", totalStale && totalStale.value);
}

H("[6] DUEÑO POR FILA — el caso del owner LITERAL como regresión (boleta real de inventoryStatus)");
const inv6 = TOOLS.inventoryStatus({ scenario: "actual" });
const base6 = { ledger: { figs: inv6.boleta }, results: [{ tool: "inventoryStatus", ...inv6 }], trace: null,
  question: "¿dónde está detenido mi capital?", duenosDelTenant: DUENOS };
{
  const mal = guardC("El más crítico es LG-DRYER8KG, que retiene $8.4K de capital detenido. También están MAK-COMP-AIR y BOS-SANDER.", base6);
  ok(!mal.ok && mal.verdict === "cifra-de-boleta-sin-dueno", "la cifra de MAK pegada a LG se VETA — aunque MAK aparezca en otra oración (el hueco del chequeo 10)", mal.verdict);
  ok(/MAK-COMP-AIR/.test((mal.violations[0] || {}).detail || ""), "…y el veto NOMBRA al dueño real", (mal.violations[0] || {}).detail);
  const bien = guardC("MAK-COMP-AIR retiene $8.4K de capital detenido. LG-DRYER8KG es el de más capital ($13.6K).", base6);
  ok(bien.ok === true, "bien atribuidas, las mismas cifras PASAN", JSON.stringify(bien.violations));
  // LA REGLA SELLADA (aditividad medida — la suite completa corrió ANTES de sellarla): se veta SOLO la
  // atribución ACTIVA. La cifra suelta y la anáfora («Su margen…») pasan HOY por la primera fuente y siguen
  // pasando — mis-atribución REAL o nada. F1 sí veta la suelta: diferencia de fuente, documentada en guardC.
  const suelta = guardC("Hay $8.4K parados que conviene liquidar ya.", base6);
  ok(suelta.ok === true, "la cifra SUELTA (sin entidad en la oración) sigue pasando — hoy pasa y la aditividad manda", suelta.verdict);
  const anafora = guardC("MAK-COMP-AIR es el más frío del inventario. Su capital detenido es $8.4K.", base6);
  ok(anafora.ok === true, "la anáfora legítima (dueño en la oración ANTERIOR) pasa — el patrón real del producto", JSON.stringify(anafora.violations));
  // colisión de canon (F1 §3): $8.4K tiene DOS dueños legítimos (MAK y su bodega Antofagasta) — cualquiera valida
  const bodega = guardC("En Antofagasta hay $8.4K de capital detenido.", base6);
  ok(bodega.ok === true, "un valor con dos dueños legítimos valida con CUALQUIERA (Antofagasta = subtotal de bodega)", JSON.stringify(bodega.violations));
  // el ECO libera: si el usuario nombró la cifra, re-citarla conserva su estatus de siempre
  const eco = guardC("Los $8.4K que preguntas corresponden a MAK-COMP-AIR, en Antofagasta.", { ...base6, question: "¿de qué es el 8.4K?" });
  ok(eco.ok === true, "el eco de la pregunta conserva su estatus (no exige dueño)");
  // la boleta anterior (1b) también conserva su estatus de eco
  const b1b = guardC("Los $8.4K que te mostré recién son de este grupo.", { ...base6, boletaAnterior: { figs: [{ value: "$8.4K" }], counts: [] } });
  ok(b1b.ok === true, "la re-cita vía boleta anterior (1b) tampoco cambia — su tradeoff es conocido y queda igual");
}

H("[7] ADITIVIDAD MEDIDA — mono-entidad byte-idéntica · formas legítimas intactas");
{
  // una boleta de UNA entidad: no hay con qué confundirse → el índice ni se construye
  const perfil = TOOLS.entityRecord({ dimension: "cliente", entity: "Falabella", scenario: "actual" });
  const narr = "Falabella vendió $19.4M con margen 22.0%.";
  const args = { ledger: { figs: perfil.boleta }, results: [{ tool: "entityRecord", ...perfil }], trace: null, question: "" };
  const sinRef = guardC(narr, args);
  const conRef = guardC(narr, { ...args, duenosDelTenant: DUENOS });
  ok(JSON.stringify(sinRef) === JSON.stringify(conRef), "boleta mono-entidad: el veredicto es BYTE-IDÉNTICO con y sin la referencia de dueños");
  ok(conRef.ok === true, "…y pasa, como siempre", JSON.stringify(conRef.violations));
  // multi-dueño, formas legítimas: la tabla lleva el dueño en la misma línea; el total no tiene dueño y no exige
  const margen = TOOLS.marginRead({ dimension: "cliente", scenario: "actual" });
  const baseM = { ledger: { figs: margen.boleta }, results: [{ tool: "marginRead", ...margen }], trace: null, question: "margen por cliente", duenosDelTenant: DUENOS };
  const tabla = guardC("| Cliente | Margen |\n|---|---:|\n| Lider | 21.5% |\n| Falabella | 22.0% |\n| Sodimac | 23.5% |", baseM);
  ok(tabla.ok === true, "una tabla lleva el dueño en la misma línea → pasa", JSON.stringify(tabla.violations));
  const prosa = guardC("El más lejos del piso es Lider, con margen 21.5%; Falabella está en 22.0%.", baseM);
  ok(prosa.ok === true, "la prosa con dueño al lado pasa", JSON.stringify(prosa.violations));
  const totales = guardC("Tienes $33.2K de capital inmovilizado en 3 SKU sin rotar. Se concentra en Valparaíso ($24.8K, 75%).", base6);
  ok(totales.ok === true, "totales y subtotales sin dueño-entidad no exigen nada (labels sin entidad = libres)", JSON.stringify(totales.violations));
  const medida = guardC("Liberar LG-DRYER8KG y MAK-COMP-AIR devuelve $22K a caja.", base6);
  ok(medida.ok === true, "la Medida (label sin entidad) tampoco exige — byte-idéntica a hoy", JSON.stringify(medida.violations));
}

console.log(`\n── _probe_umbral_dueno: ${PASS} PASS · ${FAIL} FAIL ──`);
process.exit(FAIL ? 1 : 0);
