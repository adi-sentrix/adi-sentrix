/* === _tipado_cifra_gate.mjs · PASO 1 · TIPADO DE CIFRA, UNIVERSO Y PROPIETARIO (owner 2026-08-09) =============
 *
 * QUÉ AFIRMA. Las decisiones 1, 2 y 7 del owner, cada una contra el dato real del tenant, sin red y sin crédito:
 *
 *   [1] EL TIPO      toda cifra emitida por una tool declara moneda, escala, período, escenario, universo,
 *                    entidad/dimensión, fuente y unidad. No un guard por ratio: el TIPO, en la raíz (`fig()`).
 *   [2] EL SELLO     probado / indicado / abierto según la definición del owner — una literal cruda NUNCA sale
 *                    `indicado`, una derivada que no reconcilia NUNCA sale `probado`, y doh/rotación/cobertura
 *                    (declaradas, no derivables) no pueden salir `probado`.
 *   [3] EL DUEÑO     ninguna cifra de una entidad puede quedar sin sujeto: el ledger etiqueta "Entidad · Concepto"
 *                    siempre que conoce la entidad, y el chequeo 12 de guardC deja de ser ciego al caso.
 *   [4] LAS DOS ORACIONES DEL OWNER (criterio de éxito literal, verificable):
 *         · "SAM-TV55 factura $13.3M y sostiene ese volumen con $13K de inventario" → RECHAZADA
 *         · "Tu negocio cerró el año en $19.4M" (siendo $19.4M un cliente)           → RECHAZADA
 *   [5] SIN REGRESIÓN  las oraciones legítimas equivalentes siguen pasando (el muro no se vuelve un tapón).
 *   [6] EL PERÍODO   (decisión 5 · hallazgo D) el marco temporal sale de la NATURALEZA de la cifra, no de la tool:
 *                    toda cifra de inventario declara la foto a hoy y NINGUNA el año cerrado; y al revés, una venta
 *                    anual no se estampa "foto a hoy" por venir dentro de una tool de inventario. Un resultado
 *                    genuinamente mixto declara LOS DOS marcos en vez de elegir uno a dedo.
 *
 *   node _tipado_cifra_gate.mjs
 */
import { fig } from "./src/adi/boleta.js";
import { runPlan } from "./src/adi/oracle/toolRunner.js";
import { guardC, periodosEsperados } from "./src/adi/oracle/guardC.js";
import { buildClaims } from "./src/adi/oracle/narrationContract.js";
import { UNIVERSOS, reconcilian, universoDe, DOMINIO_INVENTARIO, VERIFICABILIDAD_POR_EJE, ESCENARIO_BASE, ESCENARIOS_CON_TRANSFORM, ESCENARIOS_QUE_ALTERAN_TASAS, refinarPorEje, PERIODO_TXT, PERIODO_MIXTO_TXT, familiasDePeriodo } from "./src/config/contract/figureType.js";
import { applyScenarioToClientesMargen } from "./src/engine/scenarios.js";
import { SCENARIO_TRANSFORMS } from "./src/config/scenarios.js";
import { METRICS } from "./src/config/contract/metricRegistry.js";
import { SOURCES } from "./src/config/contract/sourceManifest.js";
import { skuInventario, clientesMargen, clientesVentas, marcasMargen, sfamiliasMargen } from "./src/data/demoData.js";
import { skusMargen } from "./src/data/skusMargen.js";

let PASS = 0, FAIL = 0;
const H = (t) => console.log(`\n${t}\n${"─".repeat(Math.min(112, t.length))}`);
function ok(cond, msg, extra = "") {
  if (cond) { PASS++; console.log(`  ✓ ${msg}`); }
  else { FAIL++; console.log(`  ✗ ${msg}${extra ? `\n      ${extra}` : ""}`); }
}
const run = (calls, scenario = "actual") => runPlan({ intent: "answer", calls }, { scenario });

// ══ [1] EL TIPO ════════════════════════════════════════════════════════════════════════════════════════════════
H("[1] EL TIPO · toda cifra declara moneda, escala, período, escenario, universo, entidad/dimensión, fuente, unidad");
const CAMPOS = ["moneda", "escala", "periodo", "escenario", "universo", "entidad", "dimension", "fuente", "unidad"];
{
  const planes = [
    [{ tool: "inventoryStatus", args: { focus: "top_sellers", limit: 5 } }],
    [{ tool: "salesRead", args: { dimension: "cliente" } }],
    [{ tool: "marginRead", args: { focus: "bajo_benchmark" } }],
    [{ tool: "gridTable", args: { dimension: "cliente" } }],
    [{ tool: "inventoryStatus", args: { focus: "estado" } }],
    [{ tool: "contributionRead", args: { dimension: "cliente" } }],
  ];
  let total = 0, sinTipo = 0, incompletos = [];
  for (const p of planes) {
    const { ledger } = run(p);
    for (const f of ledger.figs) {
      total++;
      if (!f.tipo) { sinTipo++; continue; }
      const faltan = CAMPOS.filter((c) => !(c in f.tipo));
      if (faltan.length) incompletos.push(`${f.label} → faltan ${faltan.join(",")}`);
    }
  }
  ok(total > 0, `se emitieron cifras reales para tipar (${total})`);
  ok(sinTipo === 0, `las ${total} cifras traen bloque de tipo`, sinTipo ? `${sinTipo} sin .tipo` : "");
  ok(incompletos.length === 0, "ninguna cifra declara un tipo incompleto", incompletos.slice(0, 4).join(" · "));
}
{
  // el caso duro: MISMA unidad "money", DOS universos con escala distinta → el tipo tiene que distinguirlos
  const { ledger } = run([{ tool: "inventoryStatus", args: { focus: "top_sellers", limit: 5 } }]);
  const venta = ledger.figs.find((f) => /SAM-TV55 · Venta/.test(f.label));
  const stock = ledger.figs.find((f) => /SAM-TV55 · Stock/.test(f.label));
  ok(!!venta && !!stock, "el turno emite venta y stock del mismo SKU (el caso de la oración del owner)");
  if (venta && stock) {
    ok(venta.unit === "money" && stock.unit === "money", "las dos comparten unit:\"money\" — `money` no alcanza, que es el punto");
    ok(venta.tipo.universo !== stock.tipo.universo,
      `y el TIPO sí las separa: ${venta.tipo.universo} vs ${stock.tipo.universo}`,
      `${venta.tipo.universo} === ${stock.tipo.universo}`);
    const rec = reconcilian(venta.tipo.universo, stock.tipo.universo);
    ok(rec.estado === "divergent", `la divergencia está DECLARADA, no en null: ${rec.estado}`, JSON.stringify(rec));
    ok(!!rec.razon, "y con razón verificable", rec.razon || "(vacía)");
  }
}
{
  // escala: venta comercial en miles, inventario en dólares crudos — declarado, no adivinado
  ok(UNIVERSOS.venta_comercial.escala === "K", "el universo venta comercial declara escala K (miles)");
  ok(UNIVERSOS.inventario.escala === "raw", "el universo inventario declara escala raw (dólares crudos)");
  ok(UNIVERSOS.inventario.periodo === "hoy", "y su período es la foto de hoy, nunca el año cerrado");
  ok(universoDe("SAM-TV55 · Stock", "money") === "inventario", "el universo se deriva del label+unidad sin adivinar");
  // el turno de inventario corrige las etiquetas que NO hablan (y con eso, su período)
  const { ledger } = run([{ tool: "inventoryStatus", args: { focus: "frenado" } }]);
  const genericas = ledger.figs.filter((f) => /(· Familia|% del total)/i.test(f.label));
  const malTipadas = genericas.filter((f) => f.tipo.periodo !== "hoy");
  ok(genericas.length > 0, `el turno de capital emite etiquetas genéricas (${genericas.length})`);
  ok(malTipadas.length === 0, "y ninguna queda tipada como del año cerrado: el dominio del turno las corrige",
    malTipadas.slice(0, 3).map((f) => `"${f.label}"→${f.tipo.universo}/${f.tipo.periodo}`).join(" · "));
  // …sin pisar la etiqueta que SÍ habla (la venta del SKU dentro de una tool de inventario)
  const ts = run([{ tool: "inventoryStatus", args: { focus: "top_sellers", limit: 5 } }]).ledger.figs;
  const vta = ts.find((f) => /· Venta$/.test(f.label));
  ok(vta && vta.tipo.universo === "venta_comercial", "y la venta del SKU dentro de inventoryStatus sigue siendo venta comercial", vta && vta.tipo.universo);
}
{
  // EL CONTRATO NO PUEDE DECIR DOS COSAS DEL MISMO CAMPO (hallazgo D del brief)
  const esc = SOURCES.skusMargen.schema.venta;
  ok(esc === "money(K)", `sourceManifest declara skusMargen.venta como ${esc}`);
  ok(METRICS.ventas.scale.sku === "K", "y metricRegistry declara scale sku:'K' — las dos puntas dicen lo mismo");
  const suma = skusMargen.reduce((s, r) => s + (r.venta || 0), 0);
  const sumaCli = clientesVentas.reduce((s, r) => s + (r.actual || 0), 0);
  ok(suma === sumaCli, `y la escala K es la que cierra: Σ skusMargen.venta = Σ clientesVentas.actual = ${suma.toLocaleString("es-CL")} (los $100.0M de Sentrix)`);
  const inv = skuInventario.reduce((s, r) => s + (r.stockUSD || 0), 0);
  ok(SOURCES.skuInventario.schema.stockUSD === "money(raw)" && inv === 135000, `y el inventario sigue en dólares crudos: Σ = ${inv.toLocaleString("es-CL")} (los $135K de Sentrix)`);
  // la lista de métricas de inventario replicada en figureType no puede desincronizarse de metricRegistry
  const delRegistro = Object.keys(METRICS).filter((k) => METRICS[k].domain === "inventario");
  const faltan = delRegistro.filter((k) => !DOMINIO_INVENTARIO.includes(k));
  ok(faltan.length === 0, `DOMINIO_INVENTARIO cubre las métricas que metricRegistry declara de inventario (${delRegistro.join(", ")})`, faltan.join(", "));
}

// ══ [2] EL SELLO ═══════════════════════════════════════════════════════════════════════════════════════════════
H("[2] EL SELLO · probado = literal o cálculo que reconcilia · indicado = derivada que no cierra o declarada no verificable");
{
  const literal = fig("Falabella · Venta", "$19.4M", { unit: "money", raw: 19433000, fuente: "clientesVentas.actual" });
  const derivada = fig("Falabella · Valor en juego", "$1.6M", { unit: "money", raw: 1574333, formula: "venta × benchmark − contribución" });
  const derivadaOk = fig("Falabella · Venta comparada", "$1.5M", { unit: "money", raw: 1491000, formula: "actual − anterior", reconcilia: true });
  ok(literal.tipo.sello === "probado", `la literal cruda sella probado (es ${literal.tipo.sello})`);
  ok(derivada.tipo.sello === "indicado", `la derivada que NO reconcilia sella indicado (es ${derivada.tipo.sello})`);
  ok(derivadaOk.tipo.sello === "probado", "una derivada que SÍ reconcilia con sus componentes sella probado");
  const cl = buildClaims([literal, derivada, derivadaOk]);
  ok(cl[0].estatus === "probado" && cl[1].estatus === "indicado" && cl[2].estatus === "probado",
    "y el claim hereda el mismo sello que el fig (una sola verdad)",
    cl.map((c) => `${c.metrica}=${c.estatus}`).join(" · "));
}
{
  // LA INVERSIÓN DEL OWNER, sobre el dato real: la contribución del CLIENTE que el motor sirve ($4.3M) es la
  // RE-DERIVADA (venta oficial × margen, difiere del literal en 13/13 filas) → indicado. La del SKU es el literal
  // almacenado (venta × margen cierra 13/13) → probado. El sello tiene que distinguirlas.
  const cli = buildClaims(run([{ tool: "queryMetric", args: { metric: "contribucion", dimension: "cliente" } }]).ledger.figs)
    .find((c) => c.entidad === "Falabella" && /contribuci/i.test(c.metrica));
  const sku = buildClaims(run([{ tool: "queryMetric", args: { metric: "contribucion", dimension: "sku" } }]).ledger.figs)
    .find((c) => /contribuci/i.test(c.metrica));
  ok(cli && cli.estatus === "indicado", `la contribución del CLIENTE (re-derivada, ${cli && cli.valor}) sella indicado`, cli && `${cli.etiqueta}=${cli.estatus}`);
  ok(sku && sku.estatus === "probado", `la contribución del SKU (literal almacenado, ${sku && sku.valor}) sella probado`, sku && `${sku.etiqueta}=${sku.estatus}`);
  if (cli) console.log(`      razón sellada: ${String(cli.estatusRazon || "").slice(0, 150)}…`);
}
{
  // el eje inventario ya no puede sellar 100% probado: doh/rotación/cobertura son DECLARADAS, no derivables
  const { ledger } = run([{ tool: "inventoryStatus", args: { focus: "frenado" } }, { tool: "queryMetric", args: { metric: "doh", dimension: "sku" } }]);
  const claims = buildClaims(ledger.figs);
  const decl = claims.filter((c) => /cobertura|rotaci|d[ií]as de inventario|\bdoh\b/i.test(c.metrica || c.etiqueta || ""));
  ok(decl.length > 0, `el turno trae cifras de cobertura/rotación (${decl.length})`);
  const malSelladas = decl.filter((c) => c.estatus === "probado");
  ok(malSelladas.length === 0, "ninguna sale `probado`: son declaradas por la fuente, no reconstruibles del dato",
    malSelladas.slice(0, 3).map((c) => `${c.etiqueta}=${c.estatus}`).join(" · "));
  const todas = claims.length ? claims.filter((c) => c.estatus === "probado").length / claims.length : 0;
  ok(todas < 1, `y el eje inventario deja de sellar el 100% probado (${Math.round(todas * 100)}%)`);
}

{
  // LA EVIDENCIA DEL SELLO, RE-MEDIDA sobre el dato real. Las reglas de figureType.js no son opinión: cada una
  // afirma un hecho del dataset. Si el dato cambia y el hecho deja de ser cierto, esto se pone rojo y la regla
  // tiene que revisarse — nunca queda una razón escrita que ya no describe nada.
  const cerca = (a, b, tol) => Math.abs(a - b) <= tol;
  const n = skuInventario.length;
  const dohOk = skuInventario.filter((r) => r.ventaDiaria > 0 && cerca(r.stockUnd / r.ventaDiaria, r.doh, Math.max(1, r.doh * 0.05))).length;
  const rotOk = skuInventario.filter((r) => r.doh > 0 && cerca(365 / r.doh, r.rotacion, Math.max(0.2, r.rotacion * 0.05))).length;
  ok(dohOk <= 3, `días de inventario NO es derivable: stock ÷ venta diaria cierra en ${dohOk} de ${n} filas`);
  ok(rotOk === 0, `rotación NO es derivable: 365 ÷ días cierra en ${rotOk} de ${n} filas`);
  const cvBy = Object.fromEntries(clientesVentas.map((v) => [v.nombre, v.actual]));
  const difCli = clientesMargen.filter((c) => !cerca(Math.round((cvBy[c.nombre] ?? c.venta) * c.margen / 100), c.contribucion, Math.max(1, Math.abs(c.contribucion) * 0.01))).length;
  ok(difCli === clientesMargen.length, `la contribución servida del cliente difiere del literal en ${difCli} de ${clientesMargen.length} filas — por eso es indicada`);
  const cierra = (rows) => rows.filter((r) => cerca(r.venta * r.margen / 100, r.contribucion, Math.max(1, Math.abs(r.contribucion) * 0.01))).length;
  ok(cierra(skusMargen) === skusMargen.length && cierra(marcasMargen) === marcasMargen.length && cierra(sfamiliasMargen) === sfamiliasMargen.length,
    `y en sku/marca/familia el literal SÍ cierra (${cierra(skusMargen)}/${skusMargen.length} · ${cierra(marcasMargen)}/${marcasMargen.length} · ${cierra(sfamiliasMargen)}/${sfamiliasMargen.length})`);
  const ejes = [...new Set(VERIFICABILIDAD_POR_EJE.flatMap((r) => [...r.ejes, ...(r.ejesSoloConEscenario || [])]))].sort();
  ok(ejes.join(",") === "canal,cliente,familia", `el refinamiento por eje se limita a los ejes re-derivados por el motor (${ejes.join(", ")})`);
  // La lista espejada de escenarios con transformación tiene que coincidir con SCENARIO_TRANSFORMS (mismo criterio
  // que DOMINIO_INVENTARIO: se replica para no romper la pureza del módulo, y se VERIFICA acá en cada corrida).
  const conTransform = Object.keys(SCENARIO_TRANSFORMS).filter((k) => SCENARIO_TRANSFORMS[k] && SCENARIO_TRANSFORMS[k].clientes).sort();
  ok(conTransform.join(",") === [...ESCENARIOS_CON_TRANSFORM].sort().join(","),
    `ESCENARIOS_CON_TRANSFORM espeja SCENARIO_TRANSFORMS (${conTransform.join(", ")})`,
    `contrato=${ESCENARIOS_CON_TRANSFORM.join(",")} vs motor=${conTransform.join(",")}`);
  ok(!SCENARIO_TRANSFORMS[ESCENARIO_BASE], `«${ESCENARIO_BASE}» no trae transformación: los agregados por familia son el literal`);
  // Y el subconjunto que mueve las TASAS, derivado del propio transform (bonanza declara las claves en CERO).
  const alteran = Object.keys(SCENARIO_TRANSFORMS)
    .filter((k) => Object.values((SCENARIO_TRANSFORMS[k] && SCENARIO_TRANSFORMS[k].clientes) || {}).some((c) => c && (c.marginErosion || c.rebateDelta)))
    .sort();
  ok(alteran.join(",") === [...ESCENARIOS_QUE_ALTERAN_TASAS].sort().join(","),
    `ESCENARIOS_QUE_ALTERAN_TASAS espeja los transforms con erosión/delta reales (${alteran.join(", ")})`,
    `contrato=${ESCENARIOS_QUE_ALTERAN_TASAS.join(",")} vs motor=${alteran.join(",")}`);
}

{
  // LA REGLA POR EJE NO PUEDE BARRER DE MÁS (owner decisión 2: "una cifra literal NO debe quedar indicado si es
  // dato real"). Estos tres conceptos caen bajo el `re` de las reglas de monto pero NO son el monto re-derivado:
  // se mide que el motor no los mueve en NINGÚN escenario y que, por lo tanto, no se sellan indicado.
  const lit = Object.fromEntries(clientesMargen.map((c) => [c.nombre, c]));
  const noSeMueve = (campo) => [ESCENARIO_BASE, ...ESCENARIOS_CON_TRANSFORM].every((esc) =>
    applyScenarioToClientesMargen(esc).every((s) => {
      const l = lit[s.nombre];
      return !l || Math.abs((s[campo] || 0) - (l[campo] || 0)) <= Math.max(0.01, Math.abs(l[campo] || 0) * 0.005);
    }));
  ok(noSeMueve("costoMedio") && noSeMueve("precioLista"),
    "costoMedio y precioLista son literales en los 4 escenarios (el motor no los toca)");
  const casos = [
    ["Costo medio unitario", "money", "precio_unitario"],
    ["Peso del costo", "pct", "tasa_comercial"],
  ];
  const malos = casos.filter(([c, unidad, universo]) =>
    [ESCENARIO_BASE, ...ESCENARIOS_CON_TRANSFORM].some((esc) => refinarPorEje(`Falabella · ${c}`, "cliente", esc, { unidad, universo })));
  ok(malos.length === 0,
    "y no quedan sellados `indicado` por caer bajo el `re` del costo: siguen probados en los 4 escenarios",
    malos.map((m) => m[0]).join(", "));
  // el monto SÍ sigue cayendo bajo la regla (la corrección no la desactivó)
  ok(!!refinarPorEje("Falabella · Costo", "cliente", ESCENARIO_BASE, { unidad: "money", universo: "venta_comercial" }),
    "y el MONTO del costo del cliente sigue sellándose indicado (la regla no se desactivó)");
}

{
  // EL SELLO POR EJE × ESCENARIO, MEDIDO PUNTA A PUNTA (owner 2026-08-09 · corrección tras la verificación
  // adversarial: la tabla anterior sellaba `familia` indicado en los CUATRO escenarios, pero en «actual» el motor
  // sirve el literal — un dato real marcado como estimación, que es lo que la decisión 2 prohíbe de frente).
  // No se lee la tabla: se corre la tool, se sella, y se compara contra el literal almacenado.
  const money = (v) => { const a = Math.abs(v), s = v < 0 ? "-" : ""; if (a >= 1e6) return `${s}$${(a / 1e6).toFixed(1)}M`; if (a >= 1e3) return `${s}$${Math.round(a / 1e3)}K`; return `${s}$${Math.round(a)}`; };
  const LIT = {
    cliente: Object.fromEntries(clientesMargen.map((c) => [c.nombre, c])),
    marca: Object.fromEntries(marcasMargen.map((c) => [c.nombre, c])),
    familia: Object.fromEntries(sfamiliasMargen.map((c) => [c.nombre, c])),
    sku: Object.fromEntries(skusMargen.map((c) => [c.nombre, c])),
  };
  const malas = [];
  for (const eje of ["cliente", "marca", "familia", "sku"]) {
    for (const esc of [ESCENARIO_BASE, ...ESCENARIOS_CON_TRANSFORM]) {
      const { ledger } = run([{ tool: "contributionRead", args: { dimension: eje } }], esc);
      const claims = buildClaims(ledger.figs).filter((c) => c.entidad && /contribuci/i.test(String(c.metrica || "")));
      let dif = 0, tot = 0; const sellos = new Set();
      for (const c of claims) {
        const l = LIT[eje][c.entidad]; if (!l) continue;
        tot++; sellos.add(c.estatus);
        if (money(l.contribucion * 1000) !== c.valor) dif++;
      }
      if (!tot) continue;
      const debe = dif === 0 ? "probado" : "indicado";
      const sella = [...sellos].join("+");
      if (sella !== debe) malas.push(`contribución@${eje}[${esc}] sirve ${dif === 0 ? "el LITERAL" : "una RE-DERIVADA"} (${dif}/${tot} difieren) → debería ${debe}, sella ${sella}`);
    }
  }
  ok(malas.length === 0, "el sello coincide con el dato en los 4 ejes × 4 escenarios: literal→probado, re-derivada→indicado", malas.join("\n      "));
}

// ══ [3] EL DUEÑO ═══════════════════════════════════════════════════════════════════════════════════════════════
H("[3] EL DUEÑO · toda cifra conserva sujeto y dimensión (hallazgo G · ledger.js sin separador)");
{
  const PELADO = /^(Falabella|Lider|Sodimac|Jumbo|Ripley|Paris|Tottus|Easy|Mercado Libre|La Polar|ABC|Unimarc)$/i;
  let pelados = [], huerfanas = [];
  for (const p of [[{ tool: "marginRead", args: { focus: "bajo_benchmark" } }], [{ tool: "salesRead", args: { dimension: "cliente" } }],
                   [{ tool: "contributionRead", args: { dimension: "cliente" } }], [{ tool: "diagnose", args: {} }]]) {
    const { ledger } = run(p);
    pelados = pelados.concat(ledger.figs.filter((f) => PELADO.test(String(f.label || "").trim())));
    huerfanas = huerfanas.concat(buildClaims(ledger.figs).filter((c) => c.sujetoTipo !== "entidad" && PELADO.test(String(c.metrica || "").trim())));
  }
  // una cifra cuyo label es el nombre PELADO de un cliente se leía como cifra DEL NEGOCIO (hallazgo G)
  ok(pelados.length === 0, "ningún fig del ledger queda etiquetado con el nombre pelado, sin concepto",
    pelados.slice(0, 3).map((f) => `"${f.label}"=${f.value}`).join(" · "));
  ok(huerfanas.length === 0, "y ningún claim de un cliente queda tipado como sujeto NEGOCIO",
    huerfanas.slice(0, 3).map((c) => `${c.etiqueta}=${c.valor}`).join(" · "));
}
{
  // el chequeo 12 no puede depender de que el label venga bien formado: se prueba con el label roto a propósito
  const roto = [fig("Falabella", "$19.4M", { unit: "money", raw: 19400000 })];
  const claims = buildClaims(roto);
  const c = claims[0];
  ok(c.entidad === "Falabella" || c.sujetoTipo === "entidad",
    `con el label PELADO el claim igual reconoce su dueño (entidad=${c.entidad} · sujetoTipo=${c.sujetoTipo})`);
}

// ══ [4] LAS DOS ORACIONES DEL OWNER ════════════════════════════════════════════════════════════════════════════
H("[4] LAS DOS ORACIONES · el criterio de éxito literal del owner");
{
  const { ledger, results } = run([{ tool: "inventoryStatus", args: { focus: "top_sellers", limit: 5 } }]);
  const texto = "SAM-TV55 factura $13.3M y sostiene ese volumen con $13K de inventario: menos de un día de cobertura.";
  const v = guardC(texto, { ledger, results, question: "¿Cómo está SAM-TV55?" });
  ok(!v.ok, `RECHAZADA: «${texto.slice(0, 62)}…»`, `ok=${v.ok} verdict=${v.verdict}`);
  console.log(`      veredicto: ${v.verdict}${v.violations.length ? ` — ${v.violations[0].detail}` : ""}`);
}
{
  // marginRead es la tool que produce el caso REAL: Falabella $19.4M etiquetado con el nombre pelado (11 claims)
  const { ledger, results } = run([{ tool: "marginRead", args: { focus: "bajo_benchmark" } }]);
  const texto = "Tu negocio cerró el año en $19.4M.";
  const v = guardC(texto, { ledger, results, question: "¿Cómo cerró el negocio?" });
  ok(!v.ok, `RECHAZADA: «${texto}»`, `ok=${v.ok} verdict=${v.verdict}`);
  console.log(`      veredicto: ${v.verdict}${v.violations.length ? ` — ${v.violations[0].detail}` : ""}`);
}

// ══ [5] SIN REGRESIÓN ══════════════════════════════════════════════════════════════════════════════════════════
H("[5] SIN REGRESIÓN · la oración honesta equivalente sigue pasando");
{
  const { ledger, results } = run([{ tool: "inventoryStatus", args: { focus: "top_sellers", limit: 5 } }]);
  const texto = "SAM-TV55 es tu SKU de mayor venta del año, con $13.3M facturados.";
  const v = guardC(texto, { ledger, results, question: "¿Cuál es mi SKU que más vende?" });
  ok(v.ok, "la venta del SKU, sola y con su dueño, pasa", `${v.verdict} — ${(v.violations[0] || {}).detail || ""}`);
}
{
  const { ledger, results } = run([{ tool: "inventoryStatus", args: { focus: "top_sellers", limit: 5 } }]);
  const texto = "SAM-TV55 tiene $13K de inventario a hoy.";
  const v = guardC(texto, { ledger, results, question: "¿Cuánto stock tiene SAM-TV55?" });
  ok(v.ok, "el stock del SKU, solo y con su dueño, pasa", `${v.verdict} — ${(v.violations[0] || {}).detail || ""}`);
}
{
  const { ledger, results } = run([{ tool: "marginRead", args: { focus: "bajo_benchmark" } }]);
  const texto = "Falabella cerró el año en $19.4M.";
  const v = guardC(texto, { ledger, results, question: "¿Cuánto vendió Falabella?" });
  ok(v.ok, "la misma cifra CON su dueño nombrado pasa", `${v.verdict} — ${(v.violations[0] || {}).detail || ""}`);
}
{
  const { ledger, results } = run([{ tool: "salesRead", args: { dimension: "cliente" } }]);
  const texto = "Tu negocio cerró el año en $100.0M.";
  const v = guardC(texto, { ledger, results, question: "¿Cómo cerró el negocio?" });
  ok(v.ok, "y el TOTAL real del negocio narrado como el negocio pasa", `${v.verdict} — ${(v.violations[0] || {}).detail || ""}`);
}
{
  // el texto SELLADO del propio composer (enumeración sin construcción relacional) tiene que seguir narrable
  const { ledger, results } = run([{ tool: "inventoryStatus", args: { focus: "top_sellers", limit: 5 } }]);
  const texto = "SAM-TV55: vende $13.3M — stock 18 unidades ($13K).";
  const v = guardC(texto, { ledger, results, question: "Los SKU que más venden con su inventario" });
  ok(v.ok, "la enumeración del composer (sin relación entre las dos cifras) NO se bloquea", `${v.verdict} — ${(v.violations[0] || {}).detail || ""}`);
}

// ══ [6] EL PERÍODO SALE DE LA NATURALEZA DE LA CIFRA ═══════════════════════════════════════════════════════════
// Decisión 5 · hallazgo D. La regla vieja era una lista de TOOLS (`_PERIODO_HOY = new Set(["inventoryStatus"])`).
// Cada afirmación de acá se vuelve a MEDIR sobre el dato real en cada corrida: si una tool cambia lo que devuelve,
// el gate se pone rojo en vez de seguir afirmando algo que dejó de ser cierto.
H("[6] EL PERÍODO · el marco temporal es de la CIFRA, no de la tool que la produjo (decisión 5 · hallazgo D)");
{
  // (a) LA IDA · la cara Capital entera salía "año cerrado" porque su evidencia no es `inventoryStatus`.
  const CAPITAL = [
    ["queryMetric{capital,sku}", [{ tool: "queryMetric", args: { metric: "capital", dimension: "sku" } }]],
    ["queryMetric{capital,bodega}", [{ tool: "queryMetric", args: { metric: "capital", dimension: "bodega" } }]],
    ["queryMetric{rotacion,sku}", [{ tool: "queryMetric", args: { metric: "rotacion", dimension: "sku" } }]],
    ["simulateCapital{}", [{ tool: "simulateCapital", args: {} }]],
  ];
  for (const [nombre, calls] of CAPITAL) {
    const { ledger, results } = run(calls);
    const fams = familiasDePeriodo(ledger.figs);
    const f = results[0].facts || {};
    ok(fams.length === 1 && fams[0] === "hoy" && f.periodo === PERIODO_TXT.hoy,
      `${nombre}: sus ${ledger.figs.length} cifras son la foto del stock y el resultado lo declara así`,
      `familias=${JSON.stringify(fams)} · periodo="${f.periodo}"`);
    ok(!/a[nñ]o cerrado/i.test(f.periodo || ""), `${nombre}: ninguna cifra de inventario queda estampada "año cerrado"`, f.periodo || "(sin período)");
  }
}
{
  // (b) LA VUELTA, el defecto sutil · `inventoryStatus{top_sellers}` devuelve VENTAS ANUALES. Antes salían las 10
  // cifras estampadas "foto de inventario a hoy" sólo porque la tool estaba en la lista de snapshot.
  const { ledger, results } = run([{ tool: "inventoryStatus", args: { focus: "top_sellers", limit: 5 } }]);
  const ventas = ledger.figs.filter((f) => /· Venta$/.test(f.label));
  const stocks = ledger.figs.filter((f) => /· Stock$/.test(f.label));
  ok(ventas.length > 0 && stocks.length > 0, `el foco devuelve las dos naturalezas juntas (${ventas.length} ventas · ${stocks.length} stocks)`);
  ok(ventas.every((f) => f.tipo.periodo === "anual"), "la VENTA del SKU declara el año cerrado aunque la tool sea de inventario",
    ventas.filter((f) => f.tipo.periodo !== "anual").map((f) => `${f.label}→${f.tipo.periodo}`).join(" · "));
  ok(stocks.every((f) => f.tipo.periodo === "hoy"), "y el STOCK del mismo SKU declara la foto de hoy",
    stocks.filter((f) => f.tipo.periodo !== "hoy").map((f) => `${f.label}→${f.tipo.periodo}`).join(" · "));
  const f = results[0].facts || {};
  ok(Array.isArray(f.periodos) && f.periodos.length === 2,
    "y el resultado NO elige uno a dedo: declara los dos marcos", JSON.stringify(f.periodos));
  ok(/a[nñ]o cerrado/i.test(f.periodo || "") && /foto de inventario a hoy/i.test(f.periodo || ""),
    "la frase que lee el narrador nombra los dos, no uno", f.periodo || "(sin período)");
  ok(JSON.stringify(periodosEsperados(results)) === JSON.stringify(["anual", "hoy"]),
    "y la garantía de declaración (periodosEsperados) recibe los dos, no pierde uno en un regex", JSON.stringify(periodosEsperados(results)));
}
{
  // (c) SIN REGRESIÓN · lo comercial sigue siendo el año cerrado, con la frase canónica EXACTA de siempre, y las
  // dos exclusiones del contrato (trend trae su propio marco · defineConcept no es numérico) siguen intactas.
  const g = run([{ tool: "gridTable", args: { dimension: "cliente", limit: 5 } }]);
  ok(g.results[0].facts.periodo === PERIODO_TXT.anual, "gridTable{cliente} sigue declarando exactamente la frase anual de siempre", g.results[0].facts.periodo);
  const s = run([{ tool: "salesRead", args: { dimension: "cliente" } }]);
  ok(familiasDePeriodo(s.ledger.figs).join() === "anual", "salesRead: todas sus cifras son del año cerrado", JSON.stringify(familiasDePeriodo(s.ledger.figs)));
  const t = run([{ tool: "trend", args: { metric: "ventas", period: "mes a mes" } }]);
  ok(t.results[0].facts.periodo === undefined && !!t.results[0].facts.marco_temporal, "trend conserva su marco_temporal propio: no se pisa");
  const d = run([{ tool: "defineConcept", args: { concept: "margen" } }]);
  ok(d.results[0].facts.periodo === undefined, "defineConcept no es numérico: sigue sin período");
}
{
  // (d) LA REGLA VIEJA, medida al lado de la nueva · reproducimos `_PERIODO_HOY = new Set(["inventoryStatus"])`
  // acá mismo (no lee el motor: es la regla anterior escrita a mano) y contamos en cuántas tools daba el marco
  // EQUIVOCADO. Si algún día ese número baja a 0 por otra vía, este bloque lo dice en vez de quedarse mudo.
  const VIEJA = (tool) => (tool === "inventoryStatus" ? "hoy" : "anual");
  const CASOS = [
    ["queryMetric", [{ tool: "queryMetric", args: { metric: "capital", dimension: "sku" } }]],
    ["queryMetric", [{ tool: "queryMetric", args: { metric: "rotacion", dimension: "sku" } }]],
    ["queryMetric", [{ tool: "queryMetric", args: { metric: "capital", dimension: "bodega" } }]],
    ["simulateCapital", [{ tool: "simulateCapital", args: {} }]],
    ["inventoryStatus", [{ tool: "inventoryStatus", args: { focus: "top_sellers", limit: 5 } }]],
    ["entityRecord", [{ tool: "entityRecord", args: { dimension: "sku", entity: "SAM-TV55" } }]],
  ];
  const corregidos = [];
  for (const [tool, calls] of CASOS) {
    const { ledger } = run(calls);
    const fams = familiasDePeriodo(ledger.figs);
    const vieja = VIEJA(tool);
    // la regla vieja fallaba si el marco que estampaba no era el ÚNICO que las cifras declaran
    if (!(fams.length === 1 && fams[0] === vieja)) corregidos.push(`${tool}${JSON.stringify(calls[0].args)}: la tool decía "${vieja}" · las cifras dicen ${JSON.stringify(fams)}`);
  }
  ok(corregidos.length >= 5, `la regla por TOOL estampaba el marco equivocado en ${corregidos.length} de ${CASOS.length} casos medidos — todos corregidos por el tipo`,
    corregidos.join("\n      "));
  for (const c of corregidos) console.log(`      · ${c}`);
}
{
  // (e) LA DECISIÓN 5, LITERAL · "toda cifra de inventario declara foto de inventario a hoy, NUNCA año cerrado".
  // Barrido sobre todas las tools que tocan inventario, en los cuatro escenarios.
  const PLANES = [
    [{ tool: "inventoryStatus", args: { focus: "frenado" } }],
    [{ tool: "inventoryStatus", args: { focus: "quiebre" } }],
    [{ tool: "inventoryStatus", args: { focus: "sobrestock" } }],
    [{ tool: "inventoryStatus", args: { focus: "estado" } }],
    [{ tool: "queryMetric", args: { metric: "capital", dimension: "sku" } }],
    [{ tool: "queryMetric", args: { metric: "doh", dimension: "sku" } }],
    [{ tool: "simulateCapital", args: {} }],
    [{ tool: "entityRecord", args: { dimension: "sku", entity: "SAM-TV55" } }],
  ];
  const INVENTARIO = new Set(["inventario", "tasa_inventario", "rotacion", "dias_inventario"]);
  const malas = [];
  let contadas = 0;
  for (const esc of [ESCENARIO_BASE, ...ESCENARIOS_CON_TRANSFORM]) for (const p of PLANES) {
    for (const f of run(p, esc).ledger.figs) {
      if (!f.tipo || !INVENTARIO.has(f.tipo.universo)) continue;
      contadas++;
      if (f.tipo.periodo !== "hoy") malas.push(`[${esc}] "${f.label}" (${f.tipo.universo}) → ${f.tipo.periodo}`);
    }
  }
  ok(contadas > 0, `hay cifras de inventario que medir (${contadas} en 4 escenarios × ${PLANES.length} planes)`);
  ok(malas.length === 0, "TODAS declaran la foto de inventario a hoy · ninguna el año cerrado (decisión 5, literal)", malas.slice(0, 4).join("\n      "));
}
{
  // (f) EL CANDADO SOBRE EL COMPOSER · `fig({periodo})` es una opción abierta y un composer puede escribir ahí la
  // FRASE en vez de la familia. Cazado en vivo: un fig() de la cabecera de Capital declaraba
  // `periodo: "foto de inventario a hoy"` y el marco quedaba guardado como texto libre — invisible para todo lo
  // que lee la familia. El tipo lo normaliza; lo que no reconoce cae al período del universo, nunca al texto crudo.
  const casos = [
    ["la familia, tal cual", { periodo: "hoy" }, "hoy"],
    ["la frase canónica de la foto", { periodo: PERIODO_TXT.hoy }, "hoy"],
    ["la frase canónica anual sobre una cifra de inventario", { periodo: PERIODO_TXT.anual }, "anual"],
    ["una frase inventada → manda el universo, no el texto", { periodo: "cuando sea" }, "hoy"],
    ["sin declarar → el universo", {}, "hoy"],
    // LA FRASE MIXTA NO ES UNA FAMILIA. Contiene literalmente "año cerrado" Y "foto de inventario a hoy": una
    // normalización que devuelve en el primer acierto la guarda como una sola de las dos y pierde la otra sin
    // avisar. Un `periodo` es de UNA familia (el marco mixto se declara con `familias`), así que las dos señales
    // juntas son texto no reconocible → cae al período del universo, el mismo default que cualquier otra frase.
    ["la frase MIXTA no elige una mitad → cae al universo", { periodo: PERIODO_MIXTO_TXT }, "hoy"],
    ["la frase MIXTA sobre una cifra ANUAL tampoco elige", { periodo: PERIODO_MIXTO_TXT, universo: "venta_comercial" }, "anual"],
  ];
  const malos = casos.filter(([, opts, esperado]) => fig("Bodega Central · Capital detenido", "$33K", { unit: "money", ...opts }).tipo.periodo !== esperado);
  ok(malos.length === 0, "el período que emite `fig()` es SIEMPRE una familia declarada, escriba lo que escriba el composer",
    malos.map(([n, opts, e]) => `${n}: esperaba ${e}, dio "${fig("Bodega Central · Capital detenido", "$33K", { unit: "money", ...opts }).tipo.periodo}"`).join(" · "));
}

console.log(`\n${"─".repeat(112)}`);
console.log(`${FAIL === 0 ? "✓" : "✗"} TIPADO DE CIFRA · ${PASS} pasaron · ${FAIL} fallaron`);
process.exit(FAIL === 0 ? 0 : 1);
