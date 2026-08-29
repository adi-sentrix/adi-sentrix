/* === ingesta/normalizar.js · DE FILAS SUELTAS A UN DATASET QUE SENTRIX ENTIENDE (vía 2 · paso 1 · 2026-08-21) ==
 *
 * Toma lo que leyó `leerLibro` + lo que propuso `mapeoDeterministico` y arma un dataset con la MISMA FORMA que
 * `tenants/demo.js` — la que el store espera y las fachadas leen. No es un formato nuevo: es el de siempre.
 *
 * LAS TRES COSAS QUE SE NIEGA A HACER, y son el valor del módulo:
 *
 * 1 · **No normaliza sin unidades confirmadas.** Aunque el contrato declare `money(K)`, alguien tiene que decir
 *     que sí. Sin `unidadesConfirmadas: true` devuelve un error bloqueante y cero filas. Es el error de
 *     miles-vs-dólares convertido en cerrojo: la unidad se declara y se confirma, jamás se deduce del rango.
 *
 * 2 · **No inventa los agregados.** `marcasMargen`, `sfamiliasMargen`, los KPI, el historial y los escenarios NO
 *     se derivan acá. En el tenant demo esos valores son LITERALES declarados —no hay una derivación oficial que
 *     copiar— y `validationRules` los trata como fuente de verdad con su propia tolerancia. Inventar una
 *     agregación sería crear una segunda verdad para las mismas cifras. Se declaran ausentes, con nombre.
 *
 * 3 · **No resuelve duplicados.** Dos filas con la misma clave y distinto valor es bloqueante: no hay forma de
 *     elegir sin inventar. Si traen el MISMO valor, se colapsa y se avisa (eso sí es un duplicado inofensivo).
 *
 * Lo que sí deriva, porque es lectura y no interpretación: los CATÁLOGOS (marcas, familias y bodegas presentes).
 * Eso no es una cifra nueva — es la lista de lo que hay en el propio dato.
 */
import { SOURCES } from "../config/contract/sourceManifest.js";
import { REQUERIDAS } from "../config/contract/ingestaColumnas.js";

/** Las llaves que un dataset de tenant tiene que traer. Sale de la forma vacía: una sola fuente de verdad. */
export const LLAVES_DATASET = [
  "id", "nombre", "perfil",
  "clientesVentas", "clientesMargen", "marcasVentas", "marcasMargen", "sfamiliasVentas", "sfamiliasMargen",
  "skuInventario", "skusMargen", "historialMargen", "CLIENTES_STRATEGIC_PROFILE",
  "ventasKPI", "margenKPI", "invKPI", "ventasMensuales",
  "SUPERFAMILIAS", "MARCAS_ALL", "SUCURSALES", "SCENARIO_TRANSFORMS",
  "clientesAlias", "clientesAmbiguos",
];

const _num = (v) => (typeof v === "number" && Number.isFinite(v) ? v : null);
const _txt = (v) => (v === null || v === undefined ? null : String(v).trim() || null);

/** Convierte una fila cruda a la fila del contrato, respetando el TIPO declarado de cada campo. */
function filaNormalizada(cruda, mapeo, schema) {
  const out = {};
  for (const [campo, m] of Object.entries(mapeo)) {
    const bruto = cruda[m.columna];
    const tipo = schema[campo] || "string";
    if (bruto === null || bruto === undefined || bruto === "") { out[campo] = null; continue; }
    if (/^string$|^enum\(/.test(tipo)) out[campo] = _txt(bruto);
    else out[campo] = _num(typeof bruto === "number" ? bruto : Number(String(bruto).replace(",", ".")));
  }
  return out;
}

/* normalizarEje({ eje, filas, mapeo, unidadesConfirmadas }) → { ok, filas, bloqueos[], avisos[] } */
export function normalizarEje({ eje, filas = [], mapeo = {}, unidadesConfirmadas = false } = {}) {
  const bloqueos = [], avisos = [];
  const fuente = SOURCES[eje];
  if (!fuente) return { ok: false, filas: [], bloqueos: [{ tipo: "eje-desconocido", detalle: eje }], avisos };

  // 1 · el cerrojo de la unidad, antes de tocar un solo número
  const conEscala = Object.entries(mapeo).filter(([c]) => fuente.schema[c] && !/^string$|^enum\(/.test(fuente.schema[c]));
  if (conEscala.length && !unidadesConfirmadas) {
    bloqueos.push({
      tipo: "unidades-sin-confirmar",
      detalle: `${conEscala.length} columnas con escala declarada esperan confirmación humana`,
      campos: conEscala.map(([c, m]) => ({ campo: c, columna: m.columna, unidad: fuente.schema[c] })),
    });
    return { ok: false, filas: [], bloqueos, avisos };
  }

  // 2 · obligatorias presentes
  for (const c of REQUERIDAS[eje] || []) {
    if (!mapeo[c]) bloqueos.push({ tipo: "columna-obligatoria-ausente", detalle: `${eje}.${c}` });
  }
  if (bloqueos.length) return { ok: false, filas: [], bloqueos, avisos };

  // 3 · filas, con la clave del contrato vigilada
  const clave = fuente.keyField;
  const porClave = new Map();
  const normalizadas = [];
  filas.forEach((cruda, i) => {
    const f = filaNormalizada(cruda, mapeo, fuente.schema);
    const k = f[clave];
    if (k === null) { avisos.push({ tipo: "fila-sin-clave", detalle: `fila ${i + 2} sin ${clave} — no entra` }); return; }
    const previa = porClave.get(k);
    if (previa) {
      const igual = JSON.stringify(previa) === JSON.stringify(f);
      if (igual) { avisos.push({ tipo: "fila-duplicada-identica", detalle: `${clave}="${k}" aparece dos veces con el mismo valor — se colapsa` }); return; }
      bloqueos.push({ tipo: "clave-duplicada-con-distinto-valor", detalle: `${clave}="${k}" aparece dos veces con valores distintos — no hay forma de elegir sin inventar` });
      return;
    }
    porClave.set(k, f);
    normalizadas.push(f);
  });
  if (bloqueos.length) return { ok: false, filas: [], bloqueos, avisos };

  // 4 · celdas vacías en filas válidas: se declaran, la fila entra igual (ADI declinará esa métrica)
  const vacíasPorCampo = {};
  for (const f of normalizadas) for (const [c, v] of Object.entries(f)) if (v === null) vacíasPorCampo[c] = (vacíasPorCampo[c] || 0) + 1;
  for (const [c, n] of Object.entries(vacíasPorCampo)) {
    avisos.push({ tipo: "celdas-vacias", detalle: `${eje}.${c}: ${n} de ${normalizadas.length} filas sin valor — ADI declinará esa métrica en esas filas` });
  }

  return { ok: true, filas: normalizadas, bloqueos, avisos };
}

/* construirDataset({ id, nombre, ejes }) → { ok, dataset, ausentes[], bloqueos[], avisos[] }
 * `ejes` = { clientesVentas: [...], skuInventario: [...], … } con las filas YA normalizadas. */
export function construirDataset({ id, nombre, ejes = {} } = {}) {
  const bloqueos = [], avisos = [], ausentes = [];
  if (!id || !/^[a-z0-9][a-z0-9_-]{0,31}$/.test(String(id))) {
    bloqueos.push({ tipo: "id-invalido", detalle: `el id del tenant debe ser minúsculas/números/guiones: "${id}"` });
  }

  const cv = ejes.clientesVentas || [], cm = ejes.clientesMargen || [];
  const si = ejes.skuInventario || [], sm = ejes.skusMargen || [];
  if (!cv.length && !cm.length && !si.length && !sm.length) {
    bloqueos.push({ tipo: "sin-datos", detalle: "ninguna hoja produjo filas: no hay negocio que leer" });
  }
  if (bloqueos.length) return { ok: false, dataset: null, ausentes, bloqueos, avisos };

  // CATÁLOGOS · lo único que se deriva, porque es la lista de lo que HAY (no una cifra nueva).
  const distintos = (arrs, campo) => [...new Set(arrs.flat().map((r) => r && r[campo]).filter(Boolean))];
  const marcas = distintos([cm, sm, si], "marca");
  const familias = distintos([cm, sm, si], "sfamilia");
  const bodegas = distintos([si], "bodega");

  // «Todas» encabeza el catálogo de familias por convención de la UI (así viene en los tenants existentes).
  const SUPERFAMILIAS = familias.length ? ["Todas", ...familias] : [];

  const dataset = {
    id: String(id),
    nombre: String(nombre || id),
    perfil: {},                    // la vara la declara el negocio, no la planilla → cae al config, declarado
    clientesVentas: cv,
    clientesMargen: cm,
    marcasVentas: [],
    marcasMargen: [],
    sfamiliasVentas: [],
    sfamiliasMargen: [],
    skuInventario: si,
    skusMargen: sm,
    historialMargen: {},
    CLIENTES_STRATEGIC_PROFILE: {},
    ventasKPI: null,
    margenKPI: null,
    invKPI: null,
    ventasMensuales: [],
    SUPERFAMILIAS,
    MARCAS_ALL: marcas,
    SUCURSALES: bodegas,
    SCENARIO_TRANSFORMS: {},
    /* FLUJO COMERCIAL · se declara AUSENTE, no se inventa. La planilla puede traer la hoja de Abonos, pero
       mientras la ingesta no la sepa leer, este negocio no tiene cara de cobro — y la llave tiene que existir
       igual: si faltara, initTenant activaria un dataset con menos llaves que el de referencia y media app se
       quedaria pintando lo anterior, sin error. Nulo es una respuesta; ausente es un agujero. */
    flujoComercial: null,
    clientesAlias: {},             // vocabulario de entrada: lo declara el negocio, no se deduce de la planilla
    clientesAmbiguos: [],
  };

  /* LO QUE FALTA, CON NOMBRE Y CON COSTO. No es una lista de TODO: es la lista de lo que ADI no va a poder
   * responder con este archivo, dicho antes de que alguien pregunte. */
  const declararAusente = (llave, que, costo) => ausentes.push({ llave, que, costo });
  if (!cv.length) declararAusente("clientesVentas", "venta por cliente del período", "sin comparar contra el período anterior ni contra presupuesto");
  if (!cm.length) declararAusente("clientesMargen", "margen y contribución por cliente", "sin margen, contribución ni carga comercial por cuenta");
  if (!si.length) declararAusente("skuInventario", "inventario por SKU", "sin capital inmovilizado, rotación ni días");
  if (!sm.length) declararAusente("skusMargen", "venta y margen por SKU", "sin ranking de productos por contribución");
  declararAusente("marcasMargen / sfamiliasMargen", "los agregados por marca y familia", "no se derivan: en los tenants existentes son valores declarados y el validador los trata como fuente de verdad");
  declararAusente("ventasKPI / margenKPI / invKPI", "los KPI de cabecera", "la Mesa no muestra totales hasta que el negocio los declare o se acuerde una derivación");
  declararAusente("historialMargen / ventasMensuales", "la serie temporal", "sin evolución mes a mes ni tendencia");
  declararAusente("SCENARIO_TRANSFORMS", "los escenarios", "sin simulación de escenarios sobre este dato");
  declararAusente("perfil", "la vara del negocio (benchmark, piso de rotación, techo de días)", "los umbrales caen al config general hasta que el negocio declare los suyos");

  return { ok: true, dataset, ausentes, bloqueos, avisos };
}
