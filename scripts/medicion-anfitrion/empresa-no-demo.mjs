/* === scripts/medicion-anfitrion/empresa-no-demo.mjs · LA EMPRESA NO-DEMO DE LA MEDICIÓN CON ANFITRIÓN ═══════════════
 * Cierre de la Etapa 2 (diseño `_ADI_DISENO_MEDICION_ANFITRION.md` §3 y §8.1). Para medir la forma C del corpus
 * («dos empresas: ninguna cifra ni nombre cruza») hace falta una segunda empresa que NO se parezca al demo ni en un
 * solo nombre. Este módulo la deriva del demo con un mapa de renombre DETERMINISTA (clientes, SKU, bodegas, marcas,
 * superfamilias) y cifras distintas, y emite DOS versiones de carga: v1 (la base) y v2 (la que cambia entre sesiones:
 * cifras distintas, una cuenta fuera del ranking, otro corte de cobranza).
 *
 * Cero red, cero LLM, cero estado global: `packRenombrado({ semilla, factor, version })` es una función pura. Reutiliza
 * la idea de `packDeEmpresa` de `scripts/guion-continuidad-doble.mjs` (partir del demo y escalar), pero con renombre
 * profundo de claves Y valores (el pack lleva nombres de cliente como CLAVES de `historialMargen`, de
 * `CLIENTES_STRATEGIC_PROFILE`, de `flujoComercial.clientes` y de `SCENARIO_TRANSFORMS`) y con los agregados
 * recalculados para que el pack siga siendo coherente consigo mismo (la suma de las cuentas = el total de la
 * cabecera): una empresa incoherente haría fallar a ADI por una razón que no es la que se mide. */
import { TENANT_DEMO, ANTERIOR_DE_MARCA_DECLARADO, CRECIMIENTO_UNIDADES_DECLARADO } from "../../src/data/tenants/demo.js";
import { objetivosDelCliente, calibrarSkus, calibrarMensual, derivarMarcasYFamilias, derivarKPIs, unidadesAntDeMarca, mayorResto } from "../../src/data/tenants/derivarEjes.js";
import { crearAzar } from "../doble-supabase-continuidad.mjs";

export const EMPRESA_NO_DEMO = Object.freeze({ id: "rioclaro", nombre: "Distribuidora Río Claro" });

/* ── el mapa de renombre: la posición en la lista del demo manda (el ranking se conserva por construcción) ───────── */
const CLIENTES_NUEVOS = [
  "Supermercados Andes del Sur", "Mayorista El Roble", "Tiendas Costa Verde", "Centro Constructor Maipo",
  "Cadena Quillay", "Bazar Cordillera", "Mercantil Pacífico", "Grandes Almacenes Bío", "Casa Lomas",
  "Hogar Mayor", "Comercial Lago Sur", "Ferretería Norte", "Tiendas Alerce",
];
const SKUS_NUEVOS = [
  "RC-0412", "RC-0377", "RC-0508", "RC-0633", "RC-0641", "RC-0415", "RC-0382", "RC-0650", "RC-0419", "RC-0512", "RC-0388", "RC-0516", "RC-0637",
];
const MARCAS_NUEVAS = ["Norvik", "Teravolt", "Alsen", "Brimar", "Kestrel"];
const BODEGAS_NUEVAS = ["Lampa", "Quilpué", "Rancagua", "Calama"];
const SUPERFAMILIAS_NUEVAS = ["Hogar y Cocina", "Frío y Lavado", "Bienestar y Aseo", "Ferretería y Obras"];

const _sinAcento = (s) => String(s).normalize("NFD").replace(/[̀-ͯ]/g, "");
const _norm = (s) => _sinAcento(s).toLowerCase().replace(/[^a-z0-9]+/g, "");

/** mapaDeRenombre(demo) → { pares: [[viejo, nuevo]…] } · ningún nombre del demo queda fuera del mapa (los toma del
 * propio pack, no de una lista escrita a mano: si el demo agrega un cliente, el gate se pone rojo). */
export function mapaDeRenombre(demo = TENANT_DEMO) {
  const pares = [];
  const unico = (arr) => [...new Set(arr)];
  const clientes = unico(demo.clientesVentas.map((c) => c.nombre));
  const skus = unico(demo.skusMargen.map((s) => s.nombre).concat(demo.skuInventario.map((s) => s.sku)));
  const marcas = unico(demo.MARCAS_ALL.concat(demo.marcasVentas.map((m) => m.nombre)));
  const bodegas = unico(demo.skuInventario.map((s) => s.bodega).concat(demo.SUCURSALES));
  const superf = unico(demo.SUPERFAMILIAS.filter((s) => s !== "Todas").concat(demo.sfamiliasVentas.map((s) => s.nombre)));
  const tomar = (lista, nuevos, que) => {
    if (lista.length > nuevos.length) throw new Error(`empresa-no-demo: faltan nombres nuevos para ${que} (${lista.length} del demo, ${nuevos.length} disponibles)`);
    lista.forEach((v, i) => pares.push([v, nuevos[i]]));
  };
  tomar(clientes, CLIENTES_NUEVOS, "clientes");
  tomar(skus, SKUS_NUEVOS, "SKU");
  tomar(marcas, MARCAS_NUEVAS, "marcas");
  tomar(bodegas, BODEGAS_NUEVAS, "bodegas");
  tomar(superf, SUPERFAMILIAS_NUEVAS, "superfamilias");
  pares.push([demo.nombre, EMPRESA_NO_DEMO.nombre]);
  return { pares, clientes, skus, marcas, bodegas, superf };
}

/* ── el renombre profundo (claves y valores) ──────────────────────────────────────────────────────────────────── */
const _esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
function _construirReemplazo(pares) {
  const mapa = new Map();
  for (const [v, n] of pares) {
    mapa.set(v, n);
    // las variantes que el dato usa como CLAVE normalizada (`clientesAlias`, `clientesAmbiguos`) y en minúscula
    if (v.toLowerCase() !== v) mapa.set(v.toLowerCase(), n.toLowerCase());
    const ns = _norm(v);
    if (ns !== v.toLowerCase() && !mapa.has(ns)) mapa.set(ns, _norm(n));
    if (_sinAcento(v) !== v && !mapa.has(_sinAcento(v))) mapa.set(_sinAcento(v), _sinAcento(n));
  }
  const claves = [...mapa.keys()].sort((a, b) => b.length - a.length);
  // límite de palabra Unicode: «LG» no se cambia dentro de «Algo»; «Santiago» sí se cambia en «bodega Santiago»
  const re = new RegExp(`(?<![\\p{L}\\p{N}])(?:${claves.map(_esc).join("|")})(?![\\p{L}\\p{N}])`, "gu");
  return { texto: (s) => s.replace(re, (m) => mapa.get(m)), mapa };
}
function _renombrar(x, rep) {
  if (typeof x === "string") return rep.texto(x);
  if (Array.isArray(x)) return x.map((y) => _renombrar(y, rep));
  if (x && typeof x === "object") { const o = {}; for (const k of Object.keys(x)) o[rep.texto(k)] = _renombrar(x[k], rep); return o; }
  return x;
}

/* ── escalas ──────────────────────────────────────────────────────────────────────────────────────────────────── */
const _r1 = (n) => Math.round(n * 10) / 10;
const _r0 = (n) => Math.round(n);
const CAMPOS_ACTUAL = ["actual", "venta", "costo", "rebates", "contribucion", "presupuesto", "unidades", "ventaAnt", "contribucionAnt"];

function _escalarFila(fila, f, campos) { for (const c of campos) if (typeof fila[c] === "number") fila[c] = _r0(fila[c] * f); }

/** variaciones (v1 → v2) escritas A MANO y DECLARADAS en la ficha: el autor del corpus sabe QUÉ cambia y en qué
 * versión, nunca CUÁNTO (los números salen de las Entregas reales del hilo). Posiciones sobre la lista de clientes. */
export const CAMBIOS_V2 = Object.freeze({
  suben: [{ idx: 0, factor: 1.15 }, { idx: 2, factor: 1.09 }],
  bajan: [{ idx: 1, factor: 0.8 }, { idx: 3, factor: 0.88 }],
  sale: 4,                 // la cuenta que ya no figura en el ranking de v2
  corteCobranza: "2026-09-30",
});

/**
 * packRenombrado({ semilla, factor, version }) → pack con la forma del demo y NINGÚN nombre del demo.
 *   semilla  → PRNG del desvío por cuenta (±12 %): mismo número, mismas cifras
 *   factor   → escala general de la empresa (todas las cuentas); la v1 y la v2 comparten semilla y factor
 *   version  → 1 (carga base) | 2 (la que cambia: cifras distintas · una cuenta fuera del ranking · otro corte de cobranza)
 */
export function packRenombrado({ semilla = 20261005, factor = 1.8, version = 1, demo = TENANT_DEMO } = {}) {
  if (version !== 1 && version !== 2) throw new Error(`packRenombrado: la versión es 1 o 2 (llegó ${version})`);
  const d = JSON.parse(JSON.stringify(demo));
  const { pares, clientes } = mapaDeRenombre(demo);
  const azar = crearAzar(semilla);

  // ── 1 · LOS ÁTOMOS: cifras por cuenta = factor general × desvío propio de cada cuenta (sobre TODAS las tablas de esa cuenta)
  const porCliente = {};
  for (const c of clientes) porCliente[c] = factor * (1 + (azar() - 0.5) * 0.24);
  if (version === 2) {
    CAMBIOS_V2.suben.forEach(({ idx, factor: f }) => { porCliente[clientes[idx]] *= f; });
    CAMBIOS_V2.bajan.forEach(({ idx, factor: f }) => { porCliente[clientes[idx]] *= f; });
  }
  const totales0 = { act: d.clientesVentas.reduce((s, c) => s + c.actual, 0), ant: d.clientesVentas.reduce((s, c) => s + c.anterior, 0) };
  for (const c of d.clientesVentas) { const f = porCliente[c.nombre]; _escalarFila(c, f, ["actual", "anterior", "presupuesto", "unidades", "unidadesAnt"]); }
  for (const c of d.clientesMargen) { const f = porCliente[c.nombre]; _escalarFila(c, f, ["venta", "costo", "rebates", "contribucion", "unidades"]); }
  for (const c of clientes) for (const fila of (d.historialMargen[c] || [])) _escalarFila(fila, porCliente[c], ["venta", "ventaAnt", "contribucion", "contribucionAnt", "rebates"]);

  // ── 2 · la cuenta que sale del ranking (solo v2): desaparece de TODAS las tablas donde figura como cuenta
  let salio = null;
  if (version === 2) {
    salio = clientes[CAMBIOS_V2.sale];
    d.clientesVentas = d.clientesVentas.filter((c) => c.nombre !== salio);
    d.clientesMargen = d.clientesMargen.filter((c) => c.nombre !== salio);
    delete d.historialMargen[salio];
    delete d.CLIENTES_STRATEGIC_PROFILE[salio];
    if (d.flujoComercial && d.flujoComercial.clientes) delete d.flujoComercial.clientes[salio];
    for (const k of Object.keys(d.clientesAlias || {})) if (d.clientesAlias[k] === salio) delete d.clientesAlias[k];
    d.clientesAmbiguos = (d.clientesAmbiguos || []).filter((k) => k !== _norm(salio) && k !== salio.toLowerCase());
  }
  // las unidades de una cuenta son UNA en sus dos tablas (clientesMargen se escaló con la misma regla, pero la cuenta manda en la de ventas)
  const unidadesDe = Object.fromEntries(d.clientesVentas.map((c) => [c.nombre, c.unidades]));
  for (const c of d.clientesMargen) c.unidades = unidadesDe[c.nombre];

  // ── 3 · UNA SOLA REALIDAD (owner 2026-10-06/07, CLAUDE.md §4): lo que se escaló son los ÁTOMOS (cuentas); el resto se DERIVA con la MISMA regla del demo
  //        (`src/data/tenants/derivarEjes.js`): el SKU se calibra a los totales del cliente con UN factor por métrica (mayor resto), marca y familia = Σ SKU,
  //        la serie mensual se calibra a los mismos totales y los KPI de cabecera son la suma de las cuentas. Nada se escala fila a fila con redondeo propio.
  const o = objetivosDelCliente(d.clientesVentas, d.clientesMargen);
  d.skusMargen = calibrarSkus(d.skusMargen, o);
  const marcasDecl = Object.keys(ANTERIOR_DE_MARCA_DECLARADO), anteriorEscalado = mayorResto(marcasDecl.map((m) => ANTERIOR_DE_MARCA_DECLARADO[m].anterior), o.anterior).out;
  const anteriorDeMarca = Object.fromEntries(marcasDecl.map((m, i) => [m, { anterior: anteriorEscalado[i] }]));   // lo DECLARADO por marca, a la escala de la empresa (UN factor uniforme, mayor resto)
  const unidadesAntMarca = unidadesAntDeMarca({ skusMargen: d.skusMargen, objetivo: o.unidadesAnt, crecimiento: CRECIMIENTO_UNIDADES_DECLARADO });   // el crecimiento declarado no tiene escala: se conserva
  Object.assign(d, derivarMarcasYFamilias({ skusMargen: d.skusMargen, anteriorDeMarca, unidadesAntMarca }));
  d.ventasMensuales = calibrarMensual(d.ventasMensuales, o);
  const Tact = o.venta, Tant = o.anterior, rAct = Tact / totales0.act, rAnt = Tant / totales0.ant;
  for (const k of Object.keys(d.historialMargen)) if (!clientes.includes(k)) for (const fila of d.historialMargen[k]) { _escalarFila(fila, rAct, ["venta", "contribucion", "rebates"]); _escalarFila(fila, rAnt, ["ventaAnt", "contribucionAnt"]); }
  Object.assign(d, derivarKPIs({ clientesVentas: d.clientesVentas, clientesMargen: d.clientesMargen, margenAnterior: d.margenKPI.pctAnt }));

  // ── 4 · inventario: otra escala (una foto distinta), ratios intactos
  const fInv = factor * (version === 2 ? 1.06 : 1);
  for (const s of d.skuInventario) _escalarFila(s, fInv, ["stockUSD"]);
  for (const k of ["totalUSD", "inmovilizadoUSD", "criticoUSD", "sobrestockUSD", "riesgoUSD"]) if (typeof d.invKPI[k] === "number") d.invKPI[k] = _r0(d.invKPI[k] * fInv);

  // ── 5 · lo propio de esta empresa: su benchmark declarado y, en v2, otro corte de cobranza
  const benchmarkViejo = d.perfil.benchmark;
  d.perfil.benchmark = 28.4;
  for (const tabla of ["clientesMargen", "marcasMargen", "sfamiliasMargen", "skusMargen"]) for (const f of d[tabla]) if (f.benchmark === benchmarkViejo) f.benchmark = 28.4;
  if (version === 2 && d.flujoComercial) d.flujoComercial.fechaCorte = CAMBIOS_V2.corteCobranza;

  // ── 6 · el renombre: ningún nombre del demo sobrevive (claves ni valores, ni dentro de un texto)
  const rep = _construirReemplazo(pares);
  const out = _renombrar(d, rep);
  out.id = EMPRESA_NO_DEMO.id;
  out.nombre = EMPRESA_NO_DEMO.nombre;
  return out;
}

/** nombresDelDemo(demo) → todos los nombres propios del demo que no pueden aparecer en la empresa no-demo (para el gate
 * y para el control de cruces del informe). Incluye las variantes en minúscula y sin acento. */
export function nombresDelDemo(demo = TENANT_DEMO) {
  const { pares } = mapaDeRenombre(demo);
  const s = new Set();
  for (const [v] of pares) { s.add(v); s.add(v.toLowerCase()); s.add(_sinAcento(v)); }
  s.add("ADI Demo");
  return [...s];
}

/** ¿queda algún nombre del demo dentro de `valor`? → lista de los que quedan (vacía = limpio). Límite de palabra. */
export function nombresDelDemoEn(valor, demo = TENANT_DEMO) {
  const texto = typeof valor === "string" ? valor : JSON.stringify(valor);
  return nombresDelDemo(demo).filter((n) => new RegExp(`(?<![\\p{L}\\p{N}])${_esc(n)}(?![\\p{L}\\p{N}])`, "u").test(texto));
}

/** nombresDeLaEmpresaNoDemo() → los nombres propios de la empresa no-demo (para detectar cruces en la prosa). */
export function nombresDeLaEmpresaNoDemo() {
  return [EMPRESA_NO_DEMO.nombre, ...CLIENTES_NUEVOS, ...SKUS_NUEVOS, ...MARCAS_NUEVAS, ...BODEGAS_NUEVAS, ...SUPERFAMILIAS_NUEVAS];
}

/** FICHA para el autor ciego del corpus: SOLO nombres y la estructura de los cambios — nunca una cifra. */
export function fichaParaElAutor(demo = TENANT_DEMO) {
  const { clientes } = mapaDeRenombre(demo);
  const nuevoDe = new Map(mapaDeRenombre(demo).pares);
  return {
    aviso: "Esta ficha dice QUÉ nombres existen y QUÉ cambia entre la versión 1 y la 2. No trae cifras: las cifras salen de las Entregas reales de cada hilo.",
    empresas: [
      { id: "demo", nombre: demo.nombre, clientes, skus: demo.skusMargen.map((s) => s.nombre), marcas: demo.MARCAS_ALL, bodegas: demo.SUCURSALES, superfamilias: demo.SUPERFAMILIAS.filter((s) => s !== "Todas"), versiones: [1] },
      {
        id: EMPRESA_NO_DEMO.id, nombre: EMPRESA_NO_DEMO.nombre,
        clientes: clientes.map((c) => nuevoDe.get(c)), skus: demo.skusMargen.map((s) => nuevoDe.get(s.nombre)),
        marcas: demo.MARCAS_ALL.map((m) => nuevoDe.get(m)), bodegas: demo.SUCURSALES.map((b) => nuevoDe.get(b)), superfamilias: demo.SUPERFAMILIAS.filter((s) => s !== "Todas").map((s) => nuevoDe.get(s)),
        versiones: [1, 2],
        cambiosDeLaVersion2: {
          cifrasDistintas: "las ventas de varias cuentas suben y de otras bajan (el autor decide en qué hilo se retoma con la versión 2; no se le dice cuáles ni cuánto)",
          cuentaFueraDelRanking: nuevoDe.get(clientes[CAMBIOS_V2.sale]),
          otroCorteDeCobranza: `la fecha de corte de la cobranza pasa a ${CAMBIOS_V2.corteCobranza}`,
        },
      },
    ],
  };
}

// CLI: node scripts/medicion-anfitrion/empresa-no-demo.mjs --ficha   (lo que lee el autor ciego del corpus: nombres y estructura, ninguna cifra)
import { pathToFileURL } from "node:url";
if (process.argv.includes("--ficha") && process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) console.log(JSON.stringify(fichaParaElAutor(), null, 2));
