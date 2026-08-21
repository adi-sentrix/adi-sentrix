/* === _concordancia_numerica_gate.mjs · LA CONCORDANCIA NUMÉRICA ADI ↔ SENTRIX (mejora D del owner) ============
 * (owner 2026-08-09 · Contrato de Concordancia · el gate que prueba de verdad que "muestran la misma cifra")
 *
 * QUÉ PRUEBA. Para cada componente del manifiesto que declara `evidencia`, corre LAS DOS PUNTAS sobre el MISMO
 * escenario y exige que digan lo mismo:
 *   · la punta SENTRIX  el builder real de la cara (buildResumenComercial / buildMesaCapital / …), resuelto por el
 *                       `campo` que el manifiesto declara — exactamente el objeto que el componente pinta;
 *   · la punta ADI      `runPlan` con las tool-calls que ese mismo componente declara → el LEDGER del turno, que es
 *                       la boleta de cifras AUTORIZADAS: lo único que ADI tiene permitido decir.
 * Y compara CINCO cosas, no una: cifra · unidad · período · escenario · universo.
 *
 * LA REGLA DEL OWNER. Un desacuerdo DECLARADO (`concordancia.estado: "divergent"` en el manifiesto) es un resultado válido: el producto
 * sabe que esas dos cifras no cierran y puede decirlo. Un desacuerdo SILENCIOSO no lo es: ahí ADI contesta una
 * cifra creyendo que es la de la pantalla. Por eso el gate no exige que todo coincida — exige que todo COINCIDA O
 * ESTÉ DECLARADO, y cuando no coincide imprime la diferencia EXACTA.
 *
 * CÓMO SE COMPARAN DOS CIFRAS SIN INVENTAR NINGUNA. El problema real de este cruce es la ESCALA: las tablas
 * comerciales guardan el dinero en MILES (19413 = $19.4M) y las de inventario en DÓLARES (18600 = $19K), y las
 * tools mezclan las dos convenciones en su `raw`. Confundirlas es el defecto que ya rompió la cara Capital. Este
 * gate NO hardcodea ninguna escala: la DEDUCE del propio dato, buscando el multiplicador (1 · 1.000 · 1.000.000)
 * con el que el número reproduce su PROPIA cadena formateada (`venta` contra `ventaFmt`, `fig.raw` contra
 * `fig.value`). Si un concepto aparece con DOS escalas distintas dentro del mismo builder, eso se reporta como
 * defecto en vez de resolverse a dedo. Si no hay forma de establecer la escala, la cifra NO se compara y se
 * declara — nunca se adivina.
 *
 * DOS GRADOS DE DESACUERDO, los dos reportados:
 *   · VISIBLE       las dos puntas RENDERIZAN cifras distintas ($99.9M vs $100.0M) — el usuario lo ve.
 *   · BAJO PANTALLA renderizan igual pero por debajo difieren ($19.413M vs $19.433M) — el usuario no lo ve, y por
 *                   eso es peor: es el error que se acumula hasta aparecer en un total.
 *
 * ADEMÁS, tres cosas que sólo se ven corriendo los TRES escenarios:
 *   · CEGUERA AL ESCENARIO  si la cifra de Sentrix se mueve entre bonanza/tensión/crisis y la de ADI no, esa tool
 *                           está leyendo el dato crudo. Es la falla más peligrosa: cifra real, escenario ajeno.
 *   · LEDGER CONTRA SÍ MISMO  dos tools del mismo componente que devuelven cifras distintas para la misma entidad
 *                           y el mismo concepto — ADI se contradice sin salir de un solo turno.
 *   · SIN CONTRASTE         un componente que declara tools pero del que no sale NI UN par comparable: la
 *                           evidencia declarada no demuestra la cifra de la pantalla.
 *
 * CERO RED · CERO LLM · CERO CRÉDITOS. Todo es builder puro + `runPlan` (determinístico, client-side).
 *   node _concordancia_numerica_gate.mjs
 */
import { VIEW_MANIFEST, CONCORDANCIA_ESTADOS, concordanciaDe, divergenciaDe, builderKeyOf } from "./src/adi/sentrix/viewManifest.js";
import { deriveViewContextOrErrors, resolvePath } from "./src/adi/sentrix/viewContextFrom.js";
import { builderOutsPorComponente } from "./src/adi/sentrix/viewBuilderRun.js";
import { runPlan } from "./src/adi/oracle/toolRunner.js";
import { ledgerBoleta } from "./src/adi/oracle/ledger.js";
import { SCENARIOS } from "./src/config/scenarios.js";
import { getTenantId } from "./src/data/tenantStore.js";
import { initTenant } from "./src/data/tenantStore.js";
import { TENANT_DEMO } from "./src/data/tenants/demo.js";

// vía 1 (2026-08-20): el dataset se DECLARA acá. Antes se heredaba del import por defecto de tenantStore,
// que ya no existe: el store arranca en la forma vacía y el dato entra por initTenant. Ver tenantEmpty.js.
initTenant(TENANT_DEMO);

let PASS = 0, FAIL = 0;
const ok = (c, m, extra = "") => { if (c) { PASS++; console.log("  ✓ " + m); } else { FAIL++; console.log("  ✗ " + m + (extra ? "\n      " + extra : "")); } };
const H = (t) => console.log("\n" + t);

const ESCENARIOS = Object.keys(SCENARIOS);              // bonanza · tension · crisis (los tres, siempre)
const RC = { tenantId: getTenantId() };

/* ════════════════════════════════════════════════════════════════════════════════════════════════════════════
 * 1 · LECTURA DE CIFRAS · parseo, escala y comparación. Nada de esto conoce una sola cifra del tenant.
 * ══════════════════════════════════════════════════════════════════════════════════════════════════════════ */

const _norm = (s) => String(s == null ? "" : s).normalize("NFD").replace(/[̀-ͯ]/g, "")
  .toLowerCase().replace(/[_]+/g, " ").replace(/\s+/g, " ").trim();

// parseFigura("$19.4M") → { unidad:"money", valor:19400000, paso:100000 }
// `paso` es la PRECISIÓN DE PANTALLA de esa cadena: lo que el formato deja de contar. Es lo que permite comparar
// una cifra exacta contra una que sólo se conoce formateada sin inventar precisión que no existe.
function parseFigura(s) {
  if (typeof s !== "string") return null;
  const t = s.replace(/−/g, "-").replace(/ /g, " ").replace(/\s+/g, " ").trim();
  const dec = (n) => (n.split(".")[1] || "").length;
  const num = (n) => parseFloat(n.replace(/,/g, ""));
  let m;
  if ((m = /^([+-]?)\s*\$\s*([\d.,]+)\s*([KMB])?$/.exec(t))) {
    const mult = m[3] === "M" ? 1e6 : m[3] === "K" ? 1e3 : m[3] === "B" ? 1e9 : 1;
    const n = m[2].replace(/,/g, "");
    return { unidad: "money", valor: (m[1] === "-" ? -1 : 1) * num(m[2]) * mult, paso: Math.pow(10, -dec(n)) * mult };
  }
  if ((m = /^([+-]?)\s*([\d.,]+)\s*%$/.exec(t)))
    return { unidad: "pct", valor: (m[1] === "-" ? -1 : 1) * num(m[2]), paso: Math.pow(10, -dec(m[2].replace(/,/g, ""))) };
  if ((m = /^([+-]?)\s*([\d.,]+)\s*pp$/.exec(t)))
    return { unidad: "pp", valor: (m[1] === "-" ? -1 : 1) * num(m[2]), paso: Math.pow(10, -dec(m[2].replace(/,/g, ""))) };
  if ((m = /^([\d.,]+)\s*[x×]$/i.exec(t)))
    return { unidad: "ratio", valor: num(m[1]), paso: Math.pow(10, -dec(m[1].replace(/,/g, ""))) };
  if ((m = /^([\d.,]+)\s*d(?:[ií]as?)?$/i.exec(t)))
    return { unidad: "days", valor: num(m[1]), paso: 1 };
  if ((m = /^([+-]?)\s*([\d.,]+)$/.exec(t)))
    return { unidad: "count", valor: (m[1] === "-" ? -1 : 1) * num(m[2]), paso: Math.pow(10, -dec(m[2].replace(/,/g, ""))) };
  return null;
}

// escalaDe(numero, "cadenaFormateada") → 1 | 1000 | 1e6 | null. EL CANDADO CONTRA LA TRAMPA DE ESCALA: en vez de
// declarar en algún lado "esta tabla viene en miles", se busca el multiplicador con el que el número reproduce su
// propia etiqueta. Si ninguno lo hace, devuelve null y la cifra queda SIN comparar (declarado, no adivinado).
function escalaDe(valor, fmt) {
  const p = parseFigura(fmt);
  if (!p || p.unidad !== "money" || typeof valor !== "number" || !Number.isFinite(valor)) return null;
  for (const m of [1, 1e3, 1e6]) if (Math.abs(valor * m - p.valor) <= p.paso / 2 + 1e-6) return m;
  return null;
}

// el paso con que la app RENDERIZA una cifra (misma convención que boleta.js/_M/_K): sirve para separar el
// desacuerdo que el usuario VE del que queda por debajo del formato.
function pasoPantalla(unidad, v) {
  if (unidad === "money") { const a = Math.abs(v); return a >= 1e6 ? 1e5 : a >= 1e3 ? 1e3 : 1; }
  if (unidad === "pct" || unidad === "pp" || unidad === "ratio") return 0.1;
  return 1;
}
const _fmtM = (v) => { const a = Math.abs(v), s = v < 0 ? "-" : ""; if (a >= 1e6) return `${s}$${(a / 1e6).toFixed(1)}M`; if (a >= 1e3) return `${s}$${Math.round(a / 1e3)}K`; return `${s}$${Math.round(a)}`; };
const muestra = (c) => c.unidad === "money" ? _fmtM(c.valor)
  : c.unidad === "pct" ? `${c.valor}%` : c.unidad === "pp" ? `${c.valor} pp`
  : c.unidad === "ratio" ? `${c.valor}x` : c.unidad === "days" ? `${c.valor}d` : String(c.valor);

// compara dos cifras canónicas. `paso:0` = precisión completa; `paso>0` = sólo se conoce formateada, y entonces la
// comparación se hace en ESA precisión (nunca se le exige a una cifra formateada una exactitud que no tiene).
function comparar(a, b) {
  if (a.unidad !== b.unidad) return { igual: false, grado: "unidad", delta: null };
  const paso = Math.max(a.paso || 0, b.paso || 0);
  if (paso > 0) {
    const igual = Math.round(a.valor / paso) === Math.round(b.valor / paso);
    return { igual, grado: igual ? null : "visible", delta: b.valor - a.valor };
  }
  const tol = a.unidad === "money" ? 0.5 : 1e-6;   // el redondeo al dólar no es un desacuerdo
  if (Math.abs(a.valor - b.valor) <= tol) return { igual: true, grado: null, delta: 0 };
  const ps = Math.max(pasoPantalla(a.unidad, a.valor), pasoPantalla(b.unidad, b.valor));
  const visible = Math.round(a.valor / ps) !== Math.round(b.valor / ps);
  return { igual: false, grado: visible ? "visible" : "bajo_pantalla", delta: b.valor - a.valor };
}
const deltaTxt = (a, b, r) => {
  if (r.grado === "unidad") return `unidades distintas (${a.unidad} vs ${b.unidad})`;
  const rel = a.valor ? ` · ${(Math.abs(r.delta / a.valor) * 100).toFixed(3)}%` : "";
  const d = a.unidad === "money" ? _fmtM(Math.abs(r.delta)) : `${Math.abs(r.delta).toFixed(2)}${a.unidad === "pct" ? "%" : a.unidad === "pp" ? " pp" : ""}`;
  return `Sentrix ${muestra(a)} · ADI ${muestra(b)} · diferencia ${d}${rel}`;
};

/* ════════════════════════════════════════════════════════════════════════════════════════════════════════════
 * 2 · EL VOCABULARIO DE CONCEPTOS · qué campo del builder y qué etiqueta del ledger hablan de LO MISMO.
 *     Match EXACTO y normalizado, nunca substring: "Ventas" y "Ventas año anterior" son dos cosas distintas, y
 *     confundirlas sería exactamente el error que este gate existe para cazar.
 * ══════════════════════════════════════════════════════════════════════════════════════════════════════════ */

const CONCEPTO_CAMPO = {                 // clave numérica del builder → concepto canónico
  venta: "venta", ventas: "venta",
  contribucion: "contribucion",
  margen: "margen",
  carga: "carga",
  vara: "benchmark", vararef: "benchmark",
  usd: "capital", stockusd: "capital", totalusd: "capital", totalventa: "venta",
  // el capital INMOVILIZADO tiene su propio nombre de campo desde 2026-08-09 (decisión 6): en una fila del mapa el
  // capital es el de la fila y `usd` alcanza, pero un AGREGADO sin identidad de fila necesita decir de qué capital
  // habla — leer "$33K de inmovilizado" como si fuera el capital del inventario compara dos cifras correctas.
  inmovilizado: "capital frenado",
  unidades: "unidades", und: "unidades",
  rotacion: "rotacion", doh: "doh",
  recuperable: "recuperable",
  enjuego: "en juego",
  acciones: "acciones",
};
const CONCEPTO_ETIQUETA = {              // etiqueta de una fig del ledger → concepto canónico
  "ventas": "venta", "venta": "venta", "venta total": "venta", "ventas totales": "venta",
  "ventas del periodo": "venta", "venta del periodo": "venta",
  "contribucion": "contribucion", "contribucion total": "contribucion",
  "margen": "margen", "margen de contribucion": "margen", "margen promedio": "margen",
  "carga": "carga", "rebate (%)": "carga", "carga comercial": "carga",
  "benchmark de margen": "benchmark", "piso de margen": "benchmark",
  "capital": "capital", "estado del inventario": "capital", "stock": "capital",
  // LAS ETIQUETAS DE LAS CIFRAS DE CABECERA (owner 2026-08-09, decisión 6 · hallazgo E). El ledger ya emitía
  // "Capital en inventario · total" desde `inventoryStatus{focus:"estado"}` y este vocabulario no lo reconocía, así
  // que el total oficial del inventario se descartaba en silencio y la cabecera quedaba sin contraste. Las otras
  // dos las emiten desde hoy `queryMetric` y `marginRead`. Mismo criterio que la línea de "riesgo de quiebre" de
  // más abajo: cuando el ledger aprende a decir una cifra, este vocabulario tiene que saber leerla.
  "capital en inventario": "capital",
  "rotacion media": "rotacion",
  "acciones comerciales": "acciones",
  "capital detenido": "capital frenado", "capital inmovilizado": "capital frenado",
  // el ledger nunca había emitido esta etiqueta porque el manifiesto pedía un focus que la tool no conocía y caía a
  // "frenado": con el focus corregido aparece, y sin esta línea el gate reportaba un choque de conceptos fantasma.
  "riesgo de quiebre": "capital quiebre",
  "unidades vendidas": "unidades",
  "rotacion": "rotacion",
  "dias de cobertura": "doh", "doh": "doh",
  "recuperable": "recuperable", "carga comercial alta": "recuperable",
  "contribucion no capturada": "en juego", "valor en juego": "en juego",
  "presupuesto de ventas": "presupuesto", "presupuesto total": "presupuesto",
  "ano anterior (mes a mes)": "venta anterior", "ventas ano anterior": "venta anterior",
  "presupuesto (mes a mes)": "presupuesto",
};
const CONCEPTO_METRICA = {               // `metrica` del manifiesto → concepto (para las cifras de cabecera)
  ventas: "venta", contribucion: "contribucion", margen: "margen", carga: "carga",
  capital: "capital", doh: "doh", rotacion: "rotacion",
  // `acciones` es una MÉTRICA del contrato desde 2026-08-09 (decisión 6): el MONTO de las acciones comerciales, que
  // es lo que muestra su card. `carga` sigue siendo la TASA, y son conceptos distintos con unidades distintas —
  // sin esta línea la cabecera del KPI se leía con el concepto de la tasa, la unidad no calzaba y la cifra que el
  // usuario tiene delante quedaba sin leer (la pieza aparecía como si no mostrara ninguna).
  acciones: "acciones",
};
// El `focus` que el componente DECLARA acota de qué subconjunto habla su cifra de cabecera. Sin esto, el capital
// TOTAL del inventario y el capital INMOVILIZADO se compararían entre sí por ser los dos "capital".
// CLAVE = el VOCABULARIO DEL ARG, no el nombre interno del estado (corrección 2026-08-09, pase de regresión). El arg
// que las tools aceptan es {frenado|quiebre|sobrestock} (specRetrieval.js:_FOCUS_ESTADO); `capital_frenado` y
// `riesgo_quiebre` son los ESTADOS a los que ese arg mapea. Esta tabla estaba keyeada por el estado porque el
// manifiesto declaraba el estado — un error que se propagó de un archivo al otro y que hacía caer la tool a su focus
// default en silencio. Con el manifiesto corregido, la clave tiene que ser la misma que viaja en la call.
const FOCUS_CONCEPTO = { frenado: "capital frenado", quiebre: "capital quiebre", sobrestock: "capital sobrestock" };
// Las tres series del evolutivo son AGREGADOS con nombre propio, no entidades del negocio.
const SERIE_CONCEPTO = { actual: "venta", anterior: "venta anterior", presupuesto: "presupuesto" };
const UNIDAD_CONCEPTO = {
  venta: "money", "venta anterior": "money", contribucion: "money", capital: "money",
  "capital frenado": "money", "capital quiebre": "money", "capital sobrestock": "money", recuperable: "money",
  "en juego": "money", presupuesto: "money", acciones: "money",
  margen: "pct", carga: "pct", benchmark: "pct", rotacion: "ratio", doh: "days", unidades: "count",
};

// identidad de una fila. SÓLO la primera clave de identidad encontrada (+ key/label, que son sinónimos de la misma
// fila): incluir `bodega` como alias de una fila de SKU haría que el capital de un SKU se compare contra el de su
// bodega — un falso desacuerdo con cifras las dos correctas.
const ID_KEYS = ["nombre", "name", "sku", "entidad", "cliente", "estado", "bodega", "familia"];
function aliasesDe(row) {
  const out = [];
  for (const k of ID_KEYS) if (typeof row[k] === "string" && row[k].trim()) { out.push(row[k].trim()); break; }
  for (const k of ["key", "label"]) if (typeof row[k] === "string" && row[k].trim()) out.push(row[k].trim());
  return [...new Set(out.map(_norm))].filter(Boolean);
}

/* ════════════════════════════════════════════════════════════════════════════════════════════════════════════
 * 3 · LA PUNTA SENTRIX · claims desde la salida VIVA del builder
 * ══════════════════════════════════════════════════════════════════════════════════════════════════════════ */

// escalasDelBuilder(builderOut) → { concepto → escala } deducida de TODOS los pares (número, cadena formateada)
// del builder. Un concepto que aparece con dos escalas distintas dentro del MISMO builder es un defecto y se
// reporta: es literalmente el desalineamiento que rompió Capital.
function escalasDelBuilder(out) {
  const vistas = new Map();   // concepto → Set(escalas)
  const visto = new Set();
  const walk = (node, prof) => {
    if (node == null || prof > 9 || typeof node !== "object") return;
    if (visto.has(node)) return; visto.add(node);
    if (Array.isArray(node)) { for (const x of node) walk(x, prof + 1); return; }
    for (const [k, v] of Object.entries(node)) {
      if (typeof v === "number" && Number.isFinite(v)) {
        const c = CONCEPTO_CAMPO[_norm(k).replace(/ /g, "")];
        if (!c || UNIDAD_CONCEPTO[c] !== "money") continue;
        const fmt = node[`${k}Fmt`] ?? node[`${k}_fmt`] ?? (k === "valor" || k === "value" || k === "total" ? node.fmt || node.totalFmt : null);
        const e = typeof fmt === "string" ? escalaDe(v, fmt) : null;
        if (e) { if (!vistas.has(c)) vistas.set(c, new Set()); vistas.get(c).add(e); }
      } else walk(v, prof + 1);
    }
  };
  walk(out, 0);
  const escalas = {}, conflictos = [];
  for (const [c, set] of vistas) {
    if (set.size === 1) escalas[c] = [...set][0];
    else conflictos.push({ concepto: c, escalas: [...set].sort((a, b) => a - b) });
  }
  return { escalas, conflictos };
}

// claimsSentrix(node, ctx) → [{ entidad|null, concepto, unidad, valor, paso, origen }]
// Recorre el objeto que el componente PINTA. Cada fila con identidad aporta sus campos-concepto; el nodo aporta
// sus agregados. Nada se infiere del DOM ni de texto visible: sólo estructura del builder.
function claimsSentrix(node, { escalas, metrica, focus, tipo }) {
  const out = [];
  const conceptoCabecera = (focus && FOCUS_CONCEPTO[focus]) || CONCEPTO_METRICA[metrica] || null;
  const sinEscala = new Set();

  const canon = (concepto, valor, fmt) => {
    const unidad = UNIDAD_CONCEPTO[concepto];
    if (!unidad) return null;
    if (unidad === "money") {
      const e = (typeof fmt === "string" ? escalaDe(valor, fmt) : null) ?? escalas[concepto] ?? null;
      if (!e) { sinEscala.add(concepto); return null; }
      return { unidad, valor: valor * e, paso: 0 };
    }
    return { unidad, valor, paso: 0 };
  };

  const desdeFila = (row, ctxConcepto) => {
    const ids = aliasesDe(row);
    // las tres series del evolutivo no son entidades: son agregados con nombre.
    const serie = ids.map((i) => SERIE_CONCEPTO[i]).find(Boolean);
    for (const [k, v] of Object.entries(row)) {
      if (typeof v !== "number" || !Number.isFinite(v)) continue;
      const kn = _norm(k).replace(/ /g, "");
      let concepto = CONCEPTO_CAMPO[kn];
      // `valor`/`value`/`total` son claves ambiguas: su concepto lo declara el componente, no se adivina — y sólo
      // se acepta si ese concepto es de dinero, que es lo único que esas tres claves pueden estar totalizando.
      if (!concepto && ["valor", "value", "total"].includes(kn)) {
        const cand = serie || ctxConcepto;
        concepto = UNIDAD_CONCEPTO[cand] === "money" ? cand : null;
      }
      if (!concepto) continue;
      if (serie && ["valor", "value", "total"].includes(kn)) {
        const c = canon(serie, v, row[`${k}Fmt`] ?? row.totalFmt ?? row.fmt);
        if (c) out.push({ entidad: null, concepto: serie, ...c, origen: `serie ${ids[0] || "?"}` });
        continue;
      }
      const c = canon(concepto, v, row[`${k}Fmt`] ?? (["valor", "value", "total"].includes(kn) ? row.fmt ?? row.totalFmt : null));
      if (!c) continue;
      if (!ids.length) continue;
      out.push({ entidad: ids, concepto, ...c, origen: `fila ${ids[0]}` });
    }
    // campos que sólo existen formateados (`contribucionFmt` sin `contribucion`): se leen con su precisión de pantalla
    for (const [k, v] of Object.entries(row)) {
      if (typeof v !== "string" || !/Fmt$/.test(k)) continue;
      const base = _norm(k.replace(/Fmt$/, "")).replace(/ /g, "");
      const concepto = CONCEPTO_CAMPO[base];
      if (!concepto || row[k.replace(/Fmt$/, "")] != null) continue;
      const p = parseFigura(v);
      if (!p || p.unidad !== UNIDAD_CONCEPTO[concepto]) continue;
      if (ids.length) out.push({ entidad: ids, concepto, ...p, origen: `fila ${ids[0]} (sólo formateada)` });
      else out.push({ entidad: null, concepto, ...p, origen: "agregado (sólo formateado)" });
    }
  };

  // el concepto de las filas de un nodo con claves ambiguas (`barras[].valor`) lo declara el componente
  const ctxConcepto = conceptoCabecera;

  const visto = new Set();
  // UNA FILA SE LEE COMO FILA, NUNCA TAMBIÉN COMO NODO. Sin esta separación cada fila aportaba DOS veces: su cifra
  // con entidad (correcto) y la misma cifra como si fuera el agregado del componente (falso) — y ese agregado
  // fantasma se cruzaba contra el total del ledger, fabricando desacuerdos gigantes que no existen.
  const hijos = (n, prof) => { for (const v of Object.values(n)) if (v && typeof v === "object") walk(v, prof + 1); };
  const agregados = (n) => {
    // cifra de cabecera de un KPI: `valor`/`value` es una cadena formateada sin número al lado
    if (conceptoCabecera && (typeof n.valor === "string" || typeof n.value === "string") && (n.key || n.label)) {
      const p = parseFigura(n.valor ?? n.value);
      if (p && p.unidad === UNIDAD_CONCEPTO[conceptoCabecera]) out.push({ entidad: null, concepto: conceptoCabecera, ...p, origen: "cifra de cabecera" });
    }
    for (const [k, v] of Object.entries(n)) {
      if (typeof v !== "number" || !Number.isFinite(v)) continue;
      const kn = _norm(k).replace(/ /g, "");
      let concepto = CONCEPTO_CAMPO[kn];
      if (!concepto && ["total", "totalvalor"].includes(kn)) {
        // un agregado ambiguo toma el concepto que usan SUS PROPIAS filas para esa unidad (ya recorridas); si no
        // hay uno solo, el que declara el componente. Y sólo si es de dinero: `total` no totaliza porcentajes.
        // Sólo votan los campos que la fila trae como NÚMERO (paso 0): un campo que existe únicamente formateado
        // es contexto al lado de la medida (el `ventaFmt` que acompaña a un recuperable), no lo que la lista mide.
        const enFilas = [...new Set(out.filter((c) => c.unidad === "money" && c.entidad && c.paso === 0).map((c) => c.concepto))];
        const cand = enFilas.length === 1 ? enFilas[0] : conceptoCabecera;
        concepto = UNIDAD_CONCEPTO[cand] === "money" ? cand : null;
      }
      if (!concepto || UNIDAD_CONCEPTO[concepto] == null) continue;
      const c = canon(concepto, v, n[`${k}Fmt`] ?? (kn.startsWith("total") ? n.totalFmt : null));
      if (c) out.push({ entidad: null, concepto, ...c, origen: `agregado ${k}` });
    }
  };
  function walk(n, prof) {
    if (n == null || prof > 6 || typeof n !== "object") return;
    if (visto.has(n)) return; visto.add(n);
    if (Array.isArray(n)) {
      for (const x of n) {
        if (x && typeof x === "object" && !Array.isArray(x)) { visto.add(x); desdeFila(x, ctxConcepto); hijos(x, prof + 1); }
        else walk(x, prof + 1);
      }
      return;
    }
    hijos(n, prof);      // primero las filas: el agregado ambiguo necesita saber qué concepto usan
    agregados(n);
  }
  walk(node, 0);
  return { claims: out, sinEscala: [...sinEscala] };
}

/* ════════════════════════════════════════════════════════════════════════════════════════════════════════════
 * 4 · LA PUNTA ADI · claims desde el LEDGER (la boleta de cifras autorizadas del turno)
 * ══════════════════════════════════════════════════════════════════════════════════════════════════════════ */

// La convención de etiqueta del ledger es "Entidad · Concepto". "X · total"/"X · subtotal" es un AGREGADO de X, no
// una entidad llamada X. "Estado del inventario: capital sano" nombra la entidad después de los dos puntos.
function partirEtiqueta(label) {
  const s = String(label || "").replace(/ /g, " ").trim();
  const dosPuntos = /^([^:]+):\s*(.+)$/.exec(s);
  if (dosPuntos && CONCEPTO_ETIQUETA[_norm(dosPuntos[1])]) return { entidad: _norm(dosPuntos[2]), concepto: CONCEPTO_ETIQUETA[_norm(dosPuntos[1])] };
  const partes = s.split("·").map((x) => x.trim()).filter(Boolean);
  if (partes.length >= 2) {
    const ultima = _norm(partes[partes.length - 1]);
    const izquierda = partes.slice(0, -1).join(" · ");
    if (ultima === "total" || ultima === "subtotal") { const c = CONCEPTO_ETIQUETA[_norm(izquierda)]; return c ? { entidad: null, concepto: c } : null; }
    const c = CONCEPTO_ETIQUETA[ultima];
    return c ? { entidad: _norm(izquierda), concepto: c } : null;
  }
  const c = CONCEPTO_ETIQUETA[_norm(s)];
  return c ? { entidad: null, concepto: c } : null;
}

function claimsADI(figs) {
  const out = [];
  for (const f of figs) {
    const id = partirEtiqueta(f.label);
    if (!id) continue;
    const p = parseFigura(f.value);
    if (!p) continue;
    if (UNIDAD_CONCEPTO[id.concepto] && UNIDAD_CONCEPTO[id.concepto] !== p.unidad) continue;
    let canon = p;
    if (typeof f.raw === "number" && Number.isFinite(f.raw)) {
      if (p.unidad === "money") { const e = escalaDe(f.raw, f.value); if (e) canon = { unidad: "money", valor: f.raw * e, paso: 0 }; }
      else if (Math.abs(f.raw - p.valor) <= p.paso / 2 + 1e-9) canon = { unidad: p.unidad, valor: f.raw, paso: 0 };
    }
    out.push({ entidad: id.entidad, concepto: id.concepto, ...canon, label: f.label, tool: (f.origin && f.origin.tool) || "?" });
  }
  return out;
}

/* ════════════════════════════════════════════════════════════════════════════════════════════════════════════
 * 5 · LOS BUILDERS y EL CRUCE
 * ══════════════════════════════════════════════════════════════════════════════════════════════════════════ */

// La salida viva de CADA componente, y las escalas de cada BUILDER (ya no de cada vista: desde la decisión 12 una
// cara tiene más de un builder — las superficies de nivel 2 que ADI abre traen el suyo). Quien ejecuta lo que el
// manifiesto declara es `viewBuilderRun.js`, en un solo lugar; acá sólo se agrupa por clave de builder para poder
// preguntarle a CADA salida por su propia escala.
function salidasDe(scenario) {
  const porComponente = builderOutsPorComponente(scenario);
  const porClave = {};
  for (const id of Object.keys(porComponente)) {
    const k = builderKeyOf(id);
    if (!(k in porClave)) porClave[k] = porComponente[id];
  }
  return { porComponente, porClave };
}

// Las tool-calls que el componente DECLARA, con el alcance que el ViewContext ya resolvió (la entidad de la Ficha
// sale de la selección, igual que haría el motor — no de un nombre escrito a mano en el gate).
function callsDe(m, vc) {
  return (m.evidencia || []).map((ev) => {
    const args = { ...(ev.args || {}) };
    if (ev.focus) args.focus = ev.focus;
    if (m.entidadCampo && vc && vc.seleccion && vc.seleccion.entidades && vc.seleccion.entidades[0]) {
      if (args.entity == null) args.entity = vc.seleccion.entidades[0];
      if (args.dimension == null && vc.eje) args.dimension = vc.eje;
    }
    return { tool: ev.tool, args };
  });
}

// familia de período: dos vocabularios distintos ("año cerrado" / "foto de inventario a hoy") que TIENEN que
// hablar del mismo marco. Un KPI de inventario contrastado con una tool que declara el año cerrado es un
// desacuerdo de período aunque la cifra coincida.
function familiaPeriodo(s) {
  const t = _norm(s);
  if (!t) return null;
  if (/foto|a hoy|inventario a hoy/.test(t)) return "hoy";
  if (/ano cerrado|12 meses|ano en foco|ano completo/.test(t)) return "anual";
  if (/mes a mes|mensual|historial|primer al ultimo mes/.test(t)) return "mensual";
  return "otro";
}
// EL LEDGER DECLARA UN CONJUNTO DE MARCOS, NO UNO (owner 2026-08-09, decisión 5). Desde que el período sale de la
// NATURALEZA de cada cifra y no de la tool, una sola call puede traer los dos: `entityRecord` devuelve la fila
// completa de un SKU —venta y margen del año cerrado JUNTO a stock, rotación y días de inventario de la foto de
// hoy— y `executiveSummary` mete el capital detenido (foto) dentro de una lectura comercial (año cerrado). Leer
// sólo el PRIMER `facts.periodo` que aparezca elegiría una de las dos mitades a dedo. `facts.periodos` es la
// declaración estructurada que emite `toolRunner._stampPeriodo`; la frase queda de respaldo para cualquier composer
// que estampe su propio período sin pasar por ahí.
const periodosDelLedger = (results) => {
  const set = new Set();
  for (const r of results) {
    const f = r && r.facts;
    if (!f) continue;
    if (Array.isArray(f.periodos) && f.periodos.length) { for (const x of f.periodos) set.add(x); continue; }
    const txt = typeof f.periodo === "string" ? f.periodo
      : (f.marco_temporal && typeof f.marco_temporal.periodo === "string" ? f.marco_temporal.periodo : null);
    const fam = familiaPeriodo(txt);
    if (fam) set.add(fam);
  }
  return [...set];
};
const periodoTxtDelLedger = (results) => {
  for (const r of results) {
    const f = r && r.facts;
    if (!f) continue;
    if (typeof f.periodo === "string") return f.periodo;
    if (f.marco_temporal && typeof f.marco_temporal.periodo === "string") return f.marco_temporal.periodo;
  }
  return null;
};

const COMPARABLES = Object.entries(VIEW_MANIFEST).filter(([, m]) => (m.evidencia || []).length);
const SIN_TOOL = Object.entries(VIEW_MANIFEST).filter(([, m]) => !(m.evidencia || []).length);

/* ── el cruce de un componente en un escenario ────────────────────────────────────────────────────────────── */
function cruzar(componentId, m, salidas, scenario, escalasPorBuilder) {
  const out = salidas.porComponente[componentId];
  if (out == null) return { estado: "sin_builder" };
  const d = deriveViewContextOrErrors(componentId, out, { scenario, requestContext: RC });
  if (!d.ok) return { estado: d.opcional ? "sin_dato" : "no_deriva", detalle: d.errors.join(" | ") };
  const vc = d.vc;
  const node = resolvePath(out, m.campo);

  const focus = (m.evidencia.find((e) => e.focus) || {}).focus || null;
  const { claims: cS, sinEscala } = claimsSentrix(node, { escalas: (escalasPorBuilder[builderKeyOf(componentId)] || { escalas: {} }).escalas, metrica: m.metrica, focus, tipo: m.tipo });

  const { ledger, results, unsupported } = runPlan({ calls: callsDe(m, vc) }, { scenario, maxCalls: 8 });
  const cA = claimsADI(ledgerBoleta(ledger));

  // índice ADI por (entidad, concepto). Si el propio ledger trae DOS cifras distintas para la misma clave, ADI se
  // contradice dentro de un solo turno — se reporta aparte, antes de compararlo con nada.
  const idx = new Map();
  for (const c of cA) {
    const k = `${c.entidad || ""}::${c.concepto}`;
    if (!idx.has(k)) idx.set(k, []);
    idx.get(k).push(c);
  }
  const ledgerInconsistente = [];
  for (const [k, lista] of idx) {
    if (lista.length < 2) continue;
    const distintos = lista.filter((x, i) => lista.findIndex((y) => comparar(x, y).igual) === i);
    if (distintos.length > 1) ledgerInconsistente.push({ clave: k, valores: distintos.map((x) => `${x.tool}:${muestra(x)}`) });
  }

  const pares = [], desacuerdos = [], sinPar = [];
  for (const s of cS) {
    const claves = s.entidad ? s.entidad.map((e) => `${e}::${s.concepto}`) : [`::${s.concepto}`];
    const cand = claves.map((k) => idx.get(k)).find((x) => x && x.length);
    if (!cand) { sinPar.push(s); continue; }
    const a = cand[0];
    const r = comparar(s, a);
    pares.push({ s, a, r });
    if (!r.igual) desacuerdos.push({ s, a, r });
  }

  const fam = { sentrix: familiaPeriodo(vc.periodo), adi: periodosDelLedger(results) };
  return {
    estado: "cruzado", vc, pares, desacuerdos, sinPar, sinEscala, ledgerInconsistente,
    unsupported, periodo: { ...fam, sentrixTxt: vc.periodo, adiTxt: periodoTxtDelLedger(results) },
    universo: vc.universo.n, nSentrix: cS.length, nADI: cA.length,
    adiEntidades: [...new Set(cA.filter((c) => c.entidad).map((c) => c.entidad))],
    sentrixEntidades: [...new Set(cS.filter((c) => c.entidad).map((c) => c.entidad[0]))],
    resumen: {
      sAgg: [...new Set(cS.filter((c) => !c.entidad).map((c) => c.concepto))],
      sEnt: [...new Set(cS.filter((c) => c.entidad).map((c) => c.concepto))],
      aAgg: [...new Set(cA.filter((c) => !c.entidad).map((c) => c.concepto))],
      aEnt: [...new Set(cA.filter((c) => c.entidad).map((c) => c.concepto))],
    },
  };
}

/* ════════════════════════════════════════════════════════════════════════════════════════════════════════════
 * EJECUCIÓN
 * ══════════════════════════════════════════════════════════════════════════════════════════════════════════ */

console.log("── CONCORDANCIA NUMÉRICA ADI ↔ SENTRIX ─────────────────────────────────────────────────────────────");
console.log(`   tenant ${RC.tenantId} · escenarios: ${ESCENARIOS.join(" · ")} · ${COMPARABLES.length} componentes con evidencia declarada`);
console.log("   cero red · cero LLM · builder real contra ledger real\n");

const RES = {};   // componentId → { escenario → resultado }
const ESCALAS = {};
for (const scn of ESCENARIOS) {
  const salidas = salidasDe(scn);
  const esc = {};
  for (const clave of Object.keys(salidas.porClave)) esc[clave] = salidas.porClave[clave] ? escalasDelBuilder(salidas.porClave[clave]) : { escalas: {}, conflictos: [] };
  ESCALAS[scn] = esc;
  for (const [id, m] of COMPARABLES) {
    if (!RES[id]) RES[id] = {};
    RES[id][scn] = cruzar(id, m, salidas, scn, esc);
  }
}

H("[1] ESCALA · un concepto, una sola escala dentro del mismo builder");
{
  const conflictos = [];
  for (const scn of ESCENARIOS) for (const [clave, e] of Object.entries(ESCALAS[scn]))
    for (const c of e.conflictos) conflictos.push(`${scn}/${clave}: "${c.concepto}" aparece en escalas ${c.escalas.join(" y ")}`);
  ok(!conflictos.length, "ningún concepto de dinero convive con dos escalas en un mismo builder", conflictos.join("\n      "));
  const detectadas = Object.entries(ESCALAS[ESCENARIOS[0]]).map(([v, e]) => `${v}: ${Object.entries(e.escalas).map(([c, s]) => `${c}×${s}`).join(", ") || "—"}`);
  console.log("      escalas deducidas del dato: " + detectadas.join(" · "));
}

H("[2] CONCORDANCIA POR COMPONENTE · la misma cifra, en los tres escenarios");
{
  const silenciosos = [], declarados = [], limpios = [], sinContraste = [], noDerivan = [];
  for (const [id, m] of COMPARABLES) {
    const porScn = RES[id];
    const cruzados = ESCENARIOS.filter((s) => porScn[s].estado === "cruzado");
    if (!cruzados.length) {
      const est = porScn[ESCENARIOS[0]];
      if (est.estado === "sin_dato") { console.log(`  ·  ${id} — sin dato en este tenant (limitación declarada)`); continue; }
      noDerivan.push(`${id} → ${est.detalle || est.estado}`);
      continue;
    }
    const totalPares = cruzados.reduce((a, s) => a + porScn[s].pares.length, 0);
    const desac = cruzados.flatMap((s) => porScn[s].desacuerdos.map((d) => ({ ...d, scn: s })));
    const visibles = desac.filter((d) => d.r.grado === "visible").length;
    if (!totalPares) { sinContraste.push({ id, m }); continue; }
    if (!desac.length) { limpios.push(id); console.log(`  ✓  ${id} — ${totalPares} cifras cruzadas en ${cruzados.length} escenarios, todas concuerdan`); continue; }
    const decl = !!divergenciaDe(id);
    (decl ? declarados : silenciosos).push({ id, m, desac, visibles, totalPares });
    console.log(`  ${decl ? "◆" : "✗"}  ${id} — ${desac.length} de ${totalPares} cifras NO concuerdan (${visibles} visibles) ${decl ? "· DIVERGENCIA DECLARADA" : "· SIN DECLARAR"}`);
    const muestraD = [];
    for (const d of desac.slice(0, 4)) muestraD.push(`[${d.scn}] ${d.s.entidad ? d.s.entidad[0] : "(total)"} · ${d.s.concepto} · ${d.a.tool} → ${deltaTxt(d.s, d.a, d.r)}`);
    for (const l of muestraD) console.log(`        ${l}`);
    if (desac.length > 4) console.log(`        … y ${desac.length - 4} más`);
    if (decl) console.log(`        declarada: ${divergenciaDe(id).motivo}`);
  }

  // Una divergencia declarada es lo que ADI le va a DECIR al usuario cuando esa cifra no cierre. Si el motivo
  // declarado no nombra la tool que de verdad discrepa, la declaración existe pero explica otra cosa: el desacuerdo
  // deja de ser silencioso, pero la explicación sigue siendo la equivocada.
  const desalineadas = [];
  for (const { id, m, desac } of declarados) {
    const tools = [...new Set(desac.map((d) => d.a.tool))];
    const _d = divergenciaDe(id);
    const texto = `${_d.motivo} ${(_d.toolsQueNoReconcilian || []).join(" ")}`;
    const huerfanas = tools.filter((t) => !texto.includes(t));
    if (huerfanas.length) desalineadas.push(`${id}: discrepa ${huerfanas.join(", ")} y el motivo declarado habla de otra cosa — «${String(_d.motivo).slice(0, 90)}…»`);
  }
  if (desalineadas.length) {
    console.log(`\n  ⚠  ${desalineadas.length} divergencias DECLARADAS cuyo motivo no nombra la tool que discrepa (el desacuerdo está dicho, la razón no):`);
    for (const d of desalineadas) console.log(`        ${d}`);
  }

  console.log("");
  ok(!noDerivan.length, "todo componente con evidencia deriva su contexto del builder real", noDerivan.join("\n      "));
  ok(!silenciosos.length,
    `ningún desacuerdo numérico queda SIN DECLARAR (${declarados.length} declarados · ${limpios.length} concuerdan exacto)`,
    silenciosos.map((x) => `${x.id}: ${x.desac.length} cifras (${x.visibles} visibles al usuario) y el manifiesto no declara divergencia`).join("\n      "));
  // DOS PROBLEMAS DISTINTOS bajo el mismo síntoma. Una pieza que en pantalla es TEXTO (un veredicto, la Ficha) no
  // tiene cifra que reconciliar: eso es una pregunta del manifiesto (¿debería declarar `sinTool`, o apuntar el
  // `campo` a la medida?), no un desacuerdo numérico — se informa. Una pieza que SÍ muestra una cifra y aun así no
  // consigue contrastarla contra su propia evidencia declarada es un defecto real del contrato: la tool que dice
  // demostrarla no la demuestra, y ADI puede terminar respondiendo esa cabecera con otra cosa.
  const diagnostico = (x) => {
    const r = RES[x.id][ESCENARIOS[0]];
    const tools = x.m.evidencia.map((e) => e.tool + (e.focus ? "@" + e.focus : "")).join(", ");
    const q = r.resumen;
    const sTodos = [...new Set([...q.sAgg, ...q.sEnt])], aTodos = [...new Set([...q.aAgg, ...q.aEnt])];
    const comunes = sTodos.filter((c) => aTodos.includes(c));
    let causa;
    if (!r.nSentrix) causa = `el campo "${x.m.campo}" no expone ninguna cifra: la pieza pinta texto, o el campo apunta al SUJETO y no a la medida`;
    else if (!r.nADI) causa = "la tool no autoriza ninguna cifra del vocabulario de esta pieza";
    else if (!comunes.length) causa = `hablan de conceptos distintos — pantalla {${sTodos.join(", ")}} · ledger {${aTodos.join(", ")}}`;
    else if (q.sAgg.some((c) => comunes.includes(c)) && !q.aAgg.some((c) => comunes.includes(c)))
      causa = `la pantalla muestra el TOTAL de ${comunes.join("/")} y la tool sólo devuelve el ranking por entidad, nunca su total: esa cabecera no se puede contrastar`;
    else causa = `mismos conceptos, ninguna entidad en común — pantalla {${r.sentrixEntidades.slice(0, 4).join(", ")}} · ledger {${r.adiEntidades.slice(0, 4).join(", ")}}`;
    return `${x.id} → declara [${tools}] · ${causa}`;
  };
  const soloTexto = sinContraste.filter((x) => !RES[x.id][ESCENARIOS[0]].nSentrix);
  const conCifra = sinContraste.filter((x) => RES[x.id][ESCENARIOS[0]].nSentrix);
  if (soloTexto.length) {
    console.log(`\n  ⚠  ${soloTexto.length} piezas declaran tools pero en pantalla no muestran una cifra (no hay nada que reconciliar · es una pregunta del manifiesto, no un desacuerdo):`);
    for (const x of soloTexto) console.log(`        ${diagnostico(x)}`);
  }
  ok(!conCifra.length,
    "toda pieza que MUESTRA una cifra consigue contrastarla contra la evidencia que ella misma declara",
    conCifra.map(diagnostico).join("\n      "));
}

H("[3] ESCENARIO · la tool tiene que moverse cuando el dato se mueve");
{
  // Si la cifra de Sentrix cambia entre los tres escenarios y la de ADI se queda quieta, esa tool lee el dato
  // crudo: contestaría con cifras REALES de un escenario que el usuario no está mirando.
  const ciegas = [];
  for (const [id, m] of COMPARABLES) {
    const cruzados = ESCENARIOS.filter((s) => RES[id][s].estado === "cruzado");
    if (cruzados.length < 2) continue;
    const serie = new Map();   // clave → [{scn, s, a, tool}]
    for (const s of cruzados) for (const p of RES[id][s].pares) {
      const k = `${p.s.entidad ? p.s.entidad[0] : "(total)"}::${p.s.concepto}::${p.a.tool}`;
      if (!serie.has(k)) serie.set(k, []);
      serie.get(k).push({ scn: s, sv: p.s.valor, av: p.a.valor });
    }
    for (const [k, xs] of serie) {
      if (xs.length < 2) continue;
      const sMueve = new Set(xs.map((x) => x.sv.toFixed(4))).size > 1;
      const aMueve = new Set(xs.map((x) => x.av.toFixed(4))).size > 1;
      const u = xs[0] ? (RES[id][xs[0].scn].pares.find((p) => `${p.s.entidad ? p.s.entidad[0] : "(total)"}::${p.s.concepto}::${p.a.tool}` === k) || {}).s : null;
      const un = (v) => muestra({ unidad: (u && u.unidad) || "money", valor: v });
      if (sMueve && !aMueve) ciegas.push({ id, clave: k, tool: k.split("::")[2], detalle: xs.map((x) => `${x.scn}: pantalla ${un(x.sv)} / ledger ${un(x.av)}`).join(" · ") });
    }
  }
  const porTool = new Map();
  for (const c of ciegas) { if (!porTool.has(c.tool)) porTool.set(c.tool, []); porTool.get(c.tool).push(c); }
  for (const [tool, xs] of porTool) {
    const declaradas = xs.filter((x) => { const d = divergenciaDe(x.id); return d && (String(d.motivo).includes(tool) || (d.toolsQueNoReconcilian || []).includes(tool)); });
    console.log(`  ${declaradas.length === xs.length ? "◆" : "✗"}  ${tool}: ${xs.length} cifras quietas entre escenarios (${declaradas.length} declaradas)`);
    console.log(`        ej. ${xs[0].clave.split("::").slice(0, 2).join(" · ")} → ${xs[0].detalle}`);
  }
  const noDeclaradas = ciegas.filter((x) => { const d = divergenciaDe(x.id); return !(d && (String(d.motivo).includes(x.tool) || (d.toolsQueNoReconcilian || []).includes(x.tool))); });
  ok(!noDeclaradas.length, `ninguna ceguera al escenario queda sin declarar (${ciegas.length} detectadas en total)`,
    noDeclaradas.slice(0, 8).map((x) => `${x.id} · ${x.clave} · ${x.detalle}`).join("\n      "));
}

H("[4] PERÍODO · la cifra de la pantalla y la del ledger hablan del mismo marco");
{
  // LA REGLA. El marco que declara la pantalla tiene que estar ENTRE los que declara el ledger. Un ledger que
  // declara los DOS (una tool cuya salida es genuinamente mixta) no es un choque: está diciendo cuál es cuál, que
  // es exactamente lo que la decisión 5 pide. Un ledger que declara UNO SOLO y es el ajeno sí lo es — ahí ADI
  // contesta la cifra de la pantalla estampada con el marco equivocado, que es el hallazgo D.
  // anual y mensual describen el mismo año cerrado desde dos granularidades — tampoco es un choque de marco.
  const compatible = (sentrix, adi) => adi.includes(sentrix)
    || (sentrix === "anual" && adi.includes("mensual")) || (sentrix === "mensual" && adi.includes("anual"));
  const choques = [], mixtos = [];
  for (const [id] of COMPARABLES) {
    const r = RES[id][ESCENARIOS[0]];
    if (!r || r.estado !== "cruzado") continue;
    const { sentrix, adi, sentrixTxt } = r.periodo;
    if (!sentrix || !adi.length) continue;
    if (adi.length > 1) mixtos.push(`${id}: la pantalla declara «${sentrixTxt}» (${sentrix}) y el ledger declara los dos marcos (${adi.join(" + ")}) — cifras de las dos naturalezas en la misma evidencia, cada una con el suyo`);
    if (compatible(sentrix, adi)) continue;
    choques.push(`${id}: la pantalla declara «${sentrixTxt}» (${sentrix}) y el ledger sólo «${adi.join(", ")}»`);
  }
  if (mixtos.length) {
    console.log(`  ·  ${mixtos.length} componentes contrastan contra evidencia de marco MIXTO (declarado, no silencioso):`);
    for (const m of mixtos) console.log(`        ${m}`);
  }
  ok(!choques.length, "ningún componente contrasta su cifra contra un período de otra naturaleza", choques.join("\n      "));
}

H("[5] UNIVERSO · sobre qué entidades habla cada punta  (INFORME · sin veredicto)");
{
  // POR QUÉ ESTA SECCIÓN NO FALLA. Que las dos puntas enumeren distinto casi nunca es un defecto: toda tool tiene
  // su tope de filas (el ledger trae MENOS), y varias devuelven el MISMO dinero abierto por otra granularidad —
  // inventoryStatus reparte el capital por bodega y por SKU, y el mapa de la pantalla lo reparte por estado. Un
  // recuento distinto ahí no significa "otro universo": significa otro corte del mismo. Distinguir un corte más
  // fino de un universo ajeno no se puede hacer contando nombres, y un candado que no sabe distinguirlos gritaría
  // en falso. Lo que SÍ prueba que las dos puntas hablan del mismo universo es que sus AGREGADOS coincidan, y eso
  // ya se exige cifra por cifra en [2]. Acá queda el recuento, que es lo que un humano necesita para leer [2].
  for (const [id, m] of COMPARABLES) {
    const r = RES[id][ESCENARIOS[0]];
    if (!r || r.estado !== "cruzado" || !r.pares.length) continue;
    if (m.tipo === "kpi" || m.tipo === "veredicto" || m.tipo === "tira") continue;
    const fuera = r.adiEntidades.filter((e) => !r.sentrixEntidades.includes(e));
    const cola = fuera.length ? ` · el ledger además nombra ${fuera.length} que la pantalla no lista (${fuera.slice(0, 3).join(", ")}${fuera.length > 3 ? "…" : ""})` : "";
    console.log(`  ·  ${id} (${m.universo.kind}): pantalla ${r.universo} · ledger ${r.adiEntidades.length}${cola}`);
  }
}

H("[6] LEDGER CONTRA SÍ MISMO · dos tools del mismo componente no pueden decir dos cifras");
{
  const casos = [];
  for (const [id] of COMPARABLES) for (const scn of ESCENARIOS) {
    const r = RES[id][scn];
    if (r && r.estado === "cruzado") for (const x of r.ledgerInconsistente) casos.push(`[${scn}] ${id} · ${x.clave} → ${x.valores.join(" vs ")}`);
  }
  ok(!casos.length, "ninguna entidad recibe dos cifras distintas del mismo concepto dentro de un mismo turno", casos.slice(0, 10).join("\n      "));
}

H("[7] COBERTURA · el silencio declarado y las tools que no responden");
{
  console.log(`      ${SIN_TOOL.length} componentes declaran \`sinTool\` (el oráculo no puede contrastarlos, y está dicho):`);
  for (const [id, m] of SIN_TOOL.slice(0, 20)) console.log(`        · ${id} — ${String(m.sinTool).slice(0, 110)}…`);
  const declinadas = [];
  for (const [id] of COMPARABLES) {
    const r = RES[id][ESCENARIOS[0]];
    if (r && r.estado === "cruzado" && r.unsupported.length)
      for (const u of r.unsupported) declinadas.push(`${id} · ${u.tool}: ${u.reason}`);
  }
  ok(!declinadas.length, "ninguna tool declarada en el manifiesto declina sobre el dato real", declinadas.join("\n      "));
  const sinEsc = [];
  for (const [id] of COMPARABLES) {
    const r = RES[id][ESCENARIOS[0]];
    if (r && r.estado === "cruzado" && r.sinEscala.length) sinEsc.push(`${id}: ${r.sinEscala.join(", ")}`);
  }
  if (sinEsc.length) console.log(`      cifras NO comparadas por no poder establecer su escala desde el dato (se declaran, no se adivinan):\n        ${sinEsc.join("\n        ")}`);
}

H("[8] ESTADO DE CONCORDANCIA · el estado DECLARADO tiene que ser el estado MEDIDO  (decisión 11)");
{
  // POR QUÉ ESTA SECCIÓN EXISTE. Hasta hoy el manifiesto declaraba `divergencia: null` en 16 de 43 componentes —
  // toda la cara Capital y la Ficha entera— sin que nadie lo hubiera comprobado, y el motor lee ese null como
  // «la cifra de la tool es la de la pantalla». Ahora cada componente declara `reconciled | divergent |
  // unsupported`, y acá esa declaración se vuelve FALSIFICABLE contra el cruce que este mismo gate ya midió:
  //   · `reconciled` obliga a haber cruzado AL MENOS un par y a que NINGUNO discrepe. Es la única afirmación
  //     positiva del vocabulario, así que es la que tiene que pagar prueba.
  //   · un desacuerdo medido obliga a `divergent`. Declararlo `reconciled` o `unsupported` sería tapar con el
  //     vocabulario nuevo el mismo silencio que el null viejo.
  //   · `unsupported` NO se exige demostrado: dice que la cifra no existe en la evidencia, y una ausencia no se
  //     mide contando pares. Lo que sí se exige es que no lo use una pieza cuyas cifras SÍ discrepan.
  // Un componente cuyo campo no existe en este tenant (el P&L sin declarar) no se juzga: no hay medición.
  const mentiras = [], sinMedir = [], porEstado = {};
  for (const [id, m] of Object.entries(VIEW_MANIFEST)) {
    const c = concordanciaDe(id);
    porEstado[c.estado] = (porEstado[c.estado] || 0) + 1;
    const porScn = RES[id];
    const cruzados = porScn ? ESCENARIOS.filter((s) => porScn[s] && porScn[s].estado === "cruzado") : [];
    if (!cruzados.length) { sinMedir.push(`${id} (${c.estado})`); continue; }
    const pares = cruzados.reduce((a, s) => a + porScn[s].pares.length, 0);
    const desac = cruzados.reduce((a, s) => a + porScn[s].desacuerdos.length, 0);
    const medido = desac > 0 ? "divergent" : pares > 0 ? "reconciled" : "sin_contraste";
    if (medido === "divergent" && c.estado !== "divergent")
      mentiras.push(`${id}: declara "${c.estado}" y el cruce encuentra ${desac} de ${pares} cifras que NO concuerdan en ${cruzados.length} escenarios`);
    if (c.estado === "reconciled" && medido !== "reconciled")
      mentiras.push(`${id}: declara "reconciled" y el cruce ${medido === "divergent" ? `encuentra ${desac} desacuerdos` : "no consigue comparar ni una sola cifra contra su evidencia declarada"}`);
  }
  console.log(`      declarado: ${CONCORDANCIA_ESTADOS.map((e) => `${e} ${porEstado[e] || 0}`).join(" · ")} sobre ${Object.keys(VIEW_MANIFEST).length} componentes`);
  if (sinMedir.length) console.log(`      ${sinMedir.length} sin medición posible en este tenant (sin evidencia declarada o campo ausente): ${sinMedir.slice(0, 6).join(", ")}${sinMedir.length > 6 ? "…" : ""}`);
  ok(!mentiras.length,
    "el estado de concordancia que declara cada componente es el que el cruce builder↔ledger mide (ningún `reconciled` sin pares que lo prueben, ningún desacuerdo medido escondido bajo otro estado)",
    mentiras.join("\n      "));
  const sinRazon = Object.keys(VIEW_MANIFEST).filter((id) => String(concordanciaDe(id).razon || "").trim().length < 40);
  ok(!sinRazon.length, "todo estado declarado viene con su razón verificable escrita (0 `null` silenciosos en el manifiesto)", sinRazon.join(", "));
}

const totalPares = Object.values(RES).flatMap((x) => ESCENARIOS.map((s) => x[s])).filter((r) => r && r.estado === "cruzado").reduce((a, r) => a + r.pares.length, 0);
const totalDesac = Object.values(RES).flatMap((x) => ESCENARIOS.map((s) => x[s])).filter((r) => r && r.estado === "cruzado").reduce((a, r) => a + r.desacuerdos.length, 0);
console.log(`\n──────────────────────────────────────────────────────────────────────────────────────────────────`);
console.log(`   ${totalPares} cifras cruzadas builder↔ledger en ${ESCENARIOS.length} escenarios · ${totalPares - totalDesac} concuerdan · ${totalDesac} no`);
console.log(`\n${FAIL ? "✗" : "✓"} CONCORDANCIA NUMÉRICA · ${PASS} pasaron · ${FAIL} fallaron`);
process.exit(FAIL ? 1 : 0);
