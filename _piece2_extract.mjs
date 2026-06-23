// Piece 2 · correctitud de extracción · filtros + dimensión por sustracción + nombrado-no-resuelto.
import { queryInterpreter, extractFilterPredicate, computeEffectiveDims } from "./src/adi/composers/qiRetrieval.js";
import { normalizeText } from "./src/adi/helpers.js";

function analyze(q) {
  const qi = queryInterpreter(q, "bonanza", null);          // isRetrieval, dimensions, limit (flag-independiente)
  const fp = extractFilterPredicate(q);
  const dimsEff = computeEffectiveDims(qi.dimensions || [], normalizeText(q));
  const f = {};
  for (const k of ["marcas", "sfamilias", "clientes", "skus"]) if (fp.filtros[k].length) f[k] = fp.filtros[k];
  return {
    isRetrieval: qi.isRetrieval, limit: qi.limit,
    filtros: f, dimsEff, dimCount: dimsEff.length,
    unresolved: fp.unresolvedFilters.map(u => u.axis),
    unsupported: fp.unsupportedSignals.map(u => u.kind),
    stock: fp.ambiguousStock,
  };
}
const norm = (o) => JSON.stringify(o);
const subset = (got, exp) => Object.keys(exp).every(k => norm(got[k]) === norm(exp[k]));

// [n, query, expected-subset]
const CASES = [
  [1,  "ventas por cliente de Samsung",                          { filtros:{marcas:["Samsung"]}, dimsEff:["cliente"], dimCount:1, unresolved:[], unsupported:[] }],
  [2,  "margen por SKU de Bosch",                                { filtros:{marcas:["Bosch"]}, dimsEff:["sku"], dimCount:1 }],
  [3,  "contribución por cliente de la familia Cuidado Personal",{ filtros:{sfamilias:["Cuidado Personal"]}, dimsEff:["cliente"], dimCount:1, unresolved:[] }],
  [4,  "ventas por SKU de la familia Línea Blanca",              { filtros:{sfamilias:["Línea Blanca"]}, dimsEff:["sku"], dimCount:1 }],
  [5,  "margen por marca de la familia Electrodomésticos",       { filtros:{sfamilias:["Electrodomésticos"]}, dimsEff:["marca"], dimCount:1 }],
  [6,  "carga comercial por cliente de LG",                      { filtros:{marcas:["LG"]}, dimsEff:["cliente"], dimCount:1 }],
  [7,  "margen por SKU de Samsung en Electrodomésticos",         { filtros:{marcas:["Samsung"],sfamilias:["Electrodomésticos"]}, dimsEff:["sku"], dimCount:1 }],
  [8,  "top 3 clientes por ventas de Philips",                   { filtros:{marcas:["Philips"]}, dimsEff:["cliente"], dimCount:1, limit:3 }],
  [9,  "participación por cliente de Bosch",                     { filtros:{marcas:["Bosch"]}, dimsEff:["cliente"], dimCount:1 }],
  [13, "contribución por canal",                                 { filtros:{}, dimsEff:["canal"], dimCount:1, unsupported:["canal"] }],
  [16, "rotación por marca",                                     { filtros:{}, dimsEff:["marca"], dimCount:1 }],
  [17, "cruzá ventas por familia y por canal",                   { filtros:{}, dimsEff:["familia","canal"], dimCount:2, unsupported:["canal"] }],
  [19, "DOH por bodega",                                         { filtros:{}, dimsEff:["sucursal"], dimCount:1 }],
  [22, "stock por marca",                                        { filtros:{}, dimsEff:["marca"], dimCount:1, stock:true }],
  [26, "margen por marca",                                       { filtros:{}, dimsEff:["marca"], dimCount:1, unresolved:[], unsupported:[] }],
  [27, "top 3 familias por contribución",                        { filtros:{}, dimsEff:["familia"], dimCount:1, limit:3 }],
  [28, "ventas y margen por cliente",                            { filtros:{}, dimsEff:["cliente"], dimCount:1 }],
  [29, "ventas por marca de estos 3 clientes",                   { filtros:{}, dimsEff:["marca"], dimCount:1, unsupported:["deictico"] }],
  [30, "ventas por cliente de Makita",                           { filtros:{marcas:["Makita"]}, dimsEff:["cliente"], dimCount:1, unresolved:[] }],
  ["U1","ventas por cliente de materiales",                      { filtros:{}, dimsEff:["cliente"], dimCount:1, unresolved:["sfamilia"] }],
  ["U2","margen por cliente de marca Acme",                      { filtros:{}, dimsEff:["cliente"], dimCount:1, unresolved:["marca"] }],
];
let pass = 0, fail = 0;
console.log("#    filtros / dimsEff / dimCount / unresolved / unsupported / stock");
for (const [n, q, exp] of CASES) {
  const g = analyze(q);
  const ok = subset(g, exp);
  if (ok) pass++; else fail++;
  const fstr = Object.keys(g.filtros).length ? Object.entries(g.filtros).map(([k,v])=>`${k}=${v.join("/")}`).join(",") : "—";
  console.log(`${ok?"✓":"✗"} #${String(n).padEnd(3)} «${q}»`);
  console.log(`     filtros[${fstr}] dimsEff[${g.dimsEff.join(",")}] n=${g.dimCount} unres[${g.unresolved.join(",")||"—"}] unsup[${g.unsupported.join(",")||"—"}] stock=${g.stock}${g.limit?` lim=${g.limit}`:""}`);
  if (!ok) console.log(`     ✗ esperado: ${JSON.stringify(exp)}`);
}
console.log(`\n── Piece 2 extracción: ${pass} ok / ${fail} fail ──`);
process.exit(fail ? 1 : 0);
