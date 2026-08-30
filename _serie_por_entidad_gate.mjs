/* === _serie_por_entidad_gate.mjs · LA SERIE MENSUAL POR ENTIDAD SALE DEL ARCHIVO (owner 2026-08-30) ===========
 *
 * QUÉ VIGILA. El pack de una planilla tiraba el cruce cuenta×mes que venía en cada fila: `historialMargen` salía
 * `{}` y ADI declinaba para siempre las preguntas de período, incluso con el histórico real del cliente cargado.
 * Este candado exige las cuatro cosas que hacen que esa serie sea servible, y no una más:
 *   1 · que EXISTA, con un punto por período y por entidad (cuenta, marca, familia y SKU);
 *   2 · que RECONCILIE — el mes informado cierra EXACTO con la cifra oficial que muestra el resto del producto;
 *   3 · que SE SIRVA TAL CUAL — sin re-escalarla al total del período, que es lo que la deformaba;
 *   4 · que lo que no tiene denominador vaya en `null` y no en cero.
 * Y la contracara, que es la mitad que importa: el histórico MODELADO del dataset de fábrica sigue bloqueado.
 *
 * ⚠️ TODO CHEQUEO DE ACÁ SE PRUEBA CON CARNADA (sección 7): se fabrica una copia del módulo vivo con el defecto
 * REAL adentro y se exige que el chequeo se ponga ROJO. En este repo ya pasó tres veces que un chequeo medía la
 * prosa de su propio comentario. Un candado que no se demuestra capaz de fallar no está midiendo nada.
 *
 * OFFLINE · aritmética sobre filas sintéticas · no importa el gateway y no puede gastar.
 * `node --import ./scripts/offline-guard.mjs _serie_por_entidad_gate.mjs`
 */
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { calcularDataset } from "./src/ingesta/plantilla/motorKpi.js";
import { serieDesdePlanilla } from "./src/ingesta/plantilla/serieDesdePlanilla.js";
import { plantillaEjemplo } from "./src/ingesta/plantilla/generarPlantilla.js";
import { ingestarPlantilla } from "./src/ingesta/plantilla/ingestarPlantilla.js";
import { initTenant } from "./src/data/tenantStore.js";
import { TENANT_DEMO } from "./src/data/tenants/demo.js";
import { datasetCapability, temporalCapability, serieRealDe, esSerieDelArchivo } from "./src/adi/sentrix/capability.js";
import { buildEntityEvolution, buildEntityEvolutionComparado } from "./src/adi/sentrix/temporal.js";

let pass = 0, fail = 0;
const ok = (cond, label, detalle) => {
  if (cond) { pass++; console.log(`  ✓ ${label}`); }
  else { fail++; console.log(`  ✗ ${label}`); if (detalle !== undefined) console.log(`      ${detalle}`); }
};
const H = (t) => console.log(`\n${t}`);

/* ── EL NEGOCIO DE PRUEBA · sintético, entidades inventadas (restricción vigente del owner) ────────────────────
 * Está armado para ejercitar a propósito los casos que rompen:
 *   · TRES períodos, para que haya serie y no un par de puntos;
 *   · una cuenta que NO compró en el mes del medio (el caso del denominador que no existe);
 *   · una cuenta que aparece en un solo período;
 *   · márgenes que se mueven de verdad entre meses. */
const fila = (periodo, cliente, sku, marca, sfamilia, unidades, venta, costo, acciones) => ({
  periodo, fecha: `${periodo}-15`, cliente, sku, marca, sfamilia, unidades, venta, costo, acciones,
  folio: `F-${cliente.slice(0, 3).toUpperCase()}-${periodo}`, tipoDoc: "factura", condicion: "contado",
  canal: "Mayorista", bodega: "Central", precioLista: Math.round((venta / unidades) * 1.1 * 100) / 100,
});
const VENTAS = [
  fila("2026-06", "Nortania", "AX-10", "Corvex", "Herrajes", 100, 5000, 3400, 200),
  fila("2026-06", "Sureste", "BX-20", "Delmar", "Selladores", 40, 2000, 1500, 60),
  // Nortania NO compra en julio: su mes existe, con venta 0 y sin margen posible
  fila("2026-07", "Sureste", "BX-20", "Delmar", "Selladores", 55, 2860, 2000, 100),
  fila("2026-08", "Nortania", "AX-10", "Corvex", "Herrajes", 120, 6600, 4200, 330),
  fila("2026-08", "Sureste", "BX-20", "Delmar", "Selladores", 50, 2700, 2050, 80),
  fila("2026-08", "Poniente", "AX-10", "Corvex", "Herrajes", 30, 1650, 1100, 45),
];
const PARAMS = { empresa_id: "prueba", empresa_nombre: "Negocio de prueba", periodo_actual: "2026-08-31", moneda: "CLP" };
const M = calcularDataset({ parametros: PARAMS, tablas: { Ventas: VENTAS, Inventario: [] }, fechaCarga: "2026-08-31" });
const D = M.dataset;

/* ═══ 1 · LA SERIE EXISTE, CON SU PERÍODO DECLARADO ═══════════════════════════════════════════════════════════ */
H("1 · el pack de planilla ya trae la serie mensual por entidad");
{
  const claves = Object.keys(D.historialMargen);
  ok(claves.length > 0, `historialMargen dejó de salir vacío (${claves.length} entidades)`);
  ok(["Nortania", "Sureste"].every((n) => claves.includes(n)), "las cuentas tienen serie propia", claves.join(" · "));
  ok(claves.includes("Corvex") && claves.includes("Herrajes") && claves.includes("AX-10"),
    "y también la marca, la familia y el SKU — los cuatro ejes del historial", claves.join(" · "));
  ok(claves.every((n) => esSerieDelArchivo(D.historialMargen[n])),
    "CADA punto declara el período del que se sumó: es el hecho que distingue una serie real de una modelada");
  const n = D.historialMargen["Nortania"];
  ok(n.length === 3 && n.map((p) => p.periodo).join(",") === "2026-06,2026-07,2026-08",
    "la serie cubre TODOS los períodos del archivo, también el que esa cuenta no compró",
    n.map((p) => p.periodo).join(","));
}

/* ═══ 2 · RECONCILIA CON LA CIFRA OFICIAL ═════════════════════════════════════════════════════════════════════ */
H("2 · el mes informado cierra EXACTO con la cifra que muestra el resto del producto");
{
  const enElMes = (nombre) => (D.historialMargen[nombre] || []).find((p) => p.periodo === "2026-08");
  for (const c of D.clientesVentas) {
    const p = enElMes(c.nombre);
    ok(p && p.venta === c.actual, `cuenta ${c.nombre}: la serie dice ${p ? p.venta : "—"} y clientesVentas.actual dice ${c.actual}`);
  }
  for (const [tabla, etiqueta] of [[D.marcasMargen, "marca"], [D.sfamiliasMargen, "familia"], [D.skusMargen, "SKU"]]) {
    for (const x of tabla) {
      const p = enElMes(x.nombre);
      ok(p && p.venta === x.venta, `${etiqueta} ${x.nombre}: serie ${p ? p.venta : "—"} = tabla ${x.venta}`);
    }
  }
  const cerrados = M.calculado.find((c) => c.id === "serieEntidad");
  ok(!!cerrados, "el cálculo está DECLARADO en la lista auditable, con su fórmula y su autorización");
}

/* ═══ 3 · LO QUE NO TIENE DENOMINADOR VA EN NULL, NO EN CERO ══════════════════════════════════════════════════ */
H("3 · el mes sin venta es un hecho (0), pero su margen NO EXISTE (null)");
{
  const jul = D.historialMargen["Nortania"].find((p) => p.periodo === "2026-07");
  ok(jul.venta === 0 && jul.unidades === 0 && jul.contribucion === 0,
    "venta, unidades y contribución del mes sin compras son CERO — sumas de cero filas, que es un hecho",
    JSON.stringify({ venta: jul.venta, unidades: jul.unidades, contribucion: jul.contribucion }));
  ok(jul.margen === null, "el margen % va en null: un 0% diría «marginó cero» y lo que pasó es «no vendió»", String(jul.margen));
  ok(jul.ticket === null && jul.costoMedio === null && jul.pctRebate === null,
    "ticket, costo medio y carga también: los tres necesitan un denominador que ese mes no tiene",
    JSON.stringify({ ticket: jul.ticket, costoMedio: jul.costoMedio, pctRebate: jul.pctRebate }));
  const ago = D.historialMargen["Nortania"].find((p) => p.periodo === "2026-08");
  ok(typeof ago.margen === "number" && ago.margen > 0, "y el mes que sí vendió trae su margen calculado", String(ago.margen));
}

/* ═══ 4 · LA SERIE SE SIRVE TAL CUAL · el defecto que medí y que este candado existe para impedir ══════════════
 * `buildEntityEvolution` re-escalaba TODA la serie para que sumara la venta del período. Sobre el histórico
 * modelado eso lo enderezaba; sobre dato real lo destruye: dos meses reales de [19.637 · 20.600] salían
 * [10.098 · 10.502] — la respuesta a «cuánto me compró el último mes», a la mitad y con cara de verificada. */
H("4 · lo que sirve temporal.js es la serie del archivo, sin re-escalar");
{
  initTenant(D);
  const ev = buildEntityEvolution("Nortania", "venta");
  const dataset = D.historialMargen["Nortania"].map((p) => p.venta);
  ok(!!ev && JSON.stringify(ev.serie) === JSON.stringify(dataset),
    "la serie servida es idéntica, punto por punto, a la del dataset",
    `servida ${JSON.stringify(ev && ev.serie)} · dataset ${JSON.stringify(dataset)}`);
  const oficial = D.clientesVentas.find((c) => c.nombre === "Nortania").actual;
  ok(!!ev && ev.serie[ev.n - 1] === oficial,
    `el último mes servido (${ev && ev.serie[ev.n - 1]}) es la venta oficial del período (${oficial})`);
  ok(!!ev && ev.serie.reduce((a, b) => a + b, 0) > oficial,
    "y la serie NO fue comprimida para sumar el total de un solo mes (el defecto medido)",
    `Σserie ${ev && ev.serie.reduce((a, b) => a + b, 0)} vs oficial ${oficial}`);
  const evC = buildEntityEvolution("Nortania", "contribucion");
  ok(!!evC && JSON.stringify(evC.serie) === JSON.stringify(D.historialMargen["Nortania"].map((p) => p.contribucion)),
    "lo mismo con contribución");
  const evM = buildEntityEvolution("Nortania", "margen");
  ok(evM === null, "y el margen de una cuenta con un mes sin venta se DECLINA en vez de rellenar ese mes", JSON.stringify(evM));
  const evMs = buildEntityEvolution("Sureste", "margen");
  ok(!!evMs && JSON.stringify(evMs.serie) === JSON.stringify(D.historialMargen["Sureste"].map((p) => p.margen)),
    "la cuenta que vendió los tres meses sí trae su margen mensual, el del archivo y no uno derivado",
    JSON.stringify(evMs && evMs.serie));
}

/* ═══ 5 · EL AÑO ANTERIOR NO SE FABRICA ═══════════════════════════════════════════════════════════════════════ */
H("5 · la curva del año anterior sale del archivo o no sale");
{
  const cmp = buildEntityEvolutionComparado("Nortania", "venta");
  ok(cmp && cmp.anterior === null,
    "con un solo año cargado NO hay curva de comparación — ni una de ceros, que es lo que salía al convertir null a número",
    JSON.stringify(cmp && cmp.anterior));

  const DOS = [
    fila("2025-08", "Nortania", "AX-10", "Corvex", "Herrajes", 90, 4200, 2900, 150),
    fila("2026-08", "Nortania", "AX-10", "Corvex", "Herrajes", 120, 6600, 4200, 330),
  ];
  const D2 = calcularDataset({ parametros: PARAMS, tablas: { Ventas: DOS, Inventario: [] }, fechaCarga: "2026-08-31" }).dataset;
  const s2 = D2.historialMargen["Nortania"];
  ok(s2.length === 2 && s2[1].ventaAnt === 4200,
    "con dos años, `ventaAnt` es el MISMO mes del año anterior, tomado del archivo", JSON.stringify(s2.map((p) => p.ventaAnt)));
  ok(s2[0].ventaAnt === null, "y el mes que no tiene homólogo queda en null, sin inventarle uno");
  ok(s2[0].mes !== s2[1].mes && /2[56]/.test(s2[0].mes),
    "el rótulo lleva el año cuando la serie cruza más de uno: dos «Ago» sin año serían indistinguibles",
    s2.map((p) => p.mes).join(" · "));
}

/* ═══ 6 · LA GUARDIA NO BAJÓ · el histórico modelado sigue bloqueado ══════════════════════════════════════════ */
H("6 · el dataset de fábrica sigue sin película por entidad (orden del owner: «no bajamos esa guardia»)");
{
  initTenant(TENANT_DEMO);
  ok(datasetCapability().history.perEntity === false,
    "con el histórico modelado, `history.perEntity` sigue en false");
  const t = temporalCapability({ metric: "margen", entityType: "client", entity: "Falabella" });
  ok(t.perEntity && t.perEntity.status === "blocked" && /sint[eé]tico/.test(t.perEntity.reason),
    "y la razón sigue siendo la de siempre, palabra por palabra", JSON.stringify(t.perEntity));
  ok(serieRealDe("Falabella").real === false && serieRealDe("Falabella").motivo === "sin-periodo",
    "porque sus puntos no declaran período: no salieron de las filas de nadie", JSON.stringify(serieRealDe("Falabella")));

  initTenant(D);
  ok(datasetCapability().history.perEntity === true, "con la serie del archivo, la película se enciende sola");
  const propio = temporalCapability({ metric: "venta", entityType: "client", entity: "Nortania" });
  ok(propio.perEntity.status === "show" && propio.perEntity.origen === "archivo",
    "y declara de dónde sale", JSON.stringify(propio.perEntity));

  /* EL AISLAMIENTO POR EMPRESA, del lado de lo que ADI RESPONDE: una cuenta de otro negocio no puede recibir un
   * «sí» prestado porque otras entidades de ESTE pack tengan serie. */
  const ajena = temporalCapability({ metric: "venta", entityType: "client", entity: "Falabella" });
  ok(ajena.perEntity.status === "blocked" && /esta empresa/.test(ajena.perEntity.reason),
    "una entidad que este negocio no tiene se BLOQUEA con su nombre, no hereda el «sí» del vecino",
    JSON.stringify(ajena.perEntity));
  /* La cuenta que compró UNA vez en un archivo de tres meses SÍ tiene evolución — [0 · 0 · 1650] es un hecho:
   * no compraba y empezó. Lo que NO es una evolución es un archivo con UN solo período: una cifra. */
  const soloPoniente = temporalCapability({ metric: "venta", entityType: "client", entity: "Poniente" });
  ok(soloPoniente.perEntity.status === "show",
    "una cuenta que compró un solo mes de tres tiene su película: los ceros de los otros meses son hechos",
    JSON.stringify(soloPoniente.perEntity));
  const D1 = calcularDataset({ parametros: PARAMS, tablas: { Ventas: VENTAS.filter((v) => v.periodo === "2026-08"), Inventario: [] }, fechaCarga: "2026-08-31" }).dataset;
  initTenant(D1);
  ok(datasetCapability().history.perEntity === false,
    "un archivo con UN solo período no enciende la película: un punto es una cifra, no una evolución");
  const uno = temporalCapability({ metric: "venta", entityType: "client", entity: "Nortania" });
  ok(uno.perEntity.status === "blocked" && /un solo per[ií]odo/.test(uno.perEntity.reason),
    "y al preguntar por una cuenta se dice exactamente eso", JSON.stringify(uno.perEntity));
  initTenant(D);
}

/* ═══ 7 · EL CAMINO COMPLETO, DESDE EL .XLSX ══════════════════════════════════════════════════════════════════ */
H("7 · el archivo que baja el cliente, ingestado de punta a punta");
{
  const r = ingestarPlantilla(Buffer.from(plantillaEjemplo()), { nombreArchivo: "ejemplo.xlsx", fechaCarga: "2026-08-31" });
  ok(r.ok && Object.keys(r.dataset.historialMargen).length > 0,
    `el pack del .xlsx trae serie (${Object.keys(r.dataset.historialMargen).length} entidades)`);
  const malos = r.dataset.clientesVentas.filter((c) => {
    const p = (r.dataset.historialMargen[c.nombre] || []).find((x) => x.periodo === "2026-08");
    return !p || p.venta !== c.actual;
  });
  ok(malos.length === 0, "y cada cuenta del archivo cierra su mes contra su venta oficial", malos.map((m) => m.nombre).join(", "));
}

/* ═══ 8 · LO QUE NO SE PUEDE SE DECLARA ═══════════════════════════════════════════════════════════════════════ */
H("8 · lo que no reconcilia no se sirve, y lo ambiguo no se elige en silencio");
{
  // una cifra oficial adulterada: la serie del período deja de cerrar y la entidad tiene que quedarse afuera
  const oficialTorcido = new Map([["Nortania", 999999], ["Sureste", 2700]]);
  const s = serieDesdePlanilla({
    ventas: VENTAS, dimSku: new Map([["AX-10", { marca: "Corvex", sfamilia: "Herrajes" }], ["BX-20", { marca: "Delmar", sfamilia: "Selladores" }]]),
    periodos: ["2026-06", "2026-07", "2026-08"], periodoActual: "2026-08",
    bloqueMargen: (filas) => {
      const v = filas.reduce((a, r) => a + (r.venta || 0), 0), c = filas.reduce((a, r) => a + (r.costo || 0), 0);
      const ac = filas.reduce((a, r) => a + (r.acciones || 0), 0), u = filas.reduce((a, r) => a + (r.unidades || 0), 0);
      const m = v ? Math.round((100 - c / v * 100 - ac / v * 100) * 10) / 10 : 0;
      return { venta: Math.round(v), costo: Math.round(c), rebates: Math.round(ac), unidades: Math.round(u),
        contribucion: Math.round(v * m / 100), pctRebate: v ? Math.round(ac / v * 1000) / 10 : 0, margen: m,
        costoMedio: u ? Math.round(c / u * 100) / 100 : null };
    },
    oficial: oficialTorcido,
  });
  ok(!s.historial["Nortania"], "la entidad cuya serie no cierra NO se sirve");
  ok(!!s.historial["Sureste"], "…y la que sí cierra se sigue sirviendo: el cerrojo es por entidad, no apaga todo");
  const av = s.avisos.find((a) => a.tipo === "serie-no-reconcilia");
  ok(!!av && /999999/.test(av.detalle) && /Nortania/.test(av.detalle),
    "la divergencia se declara CON LAS DOS CIFRAS y con el nombre — sin eso nadie puede corregir su archivo",
    av && av.detalle);

  // el mismo nombre como cuenta y como marca: se declara, no se elige
  const CHOQUE = [
    fila("2026-07", "Corvex", "AX-10", "Corvex", "Herrajes", 10, 500, 300, 20),
    fila("2026-08", "Corvex", "AX-10", "Corvex", "Herrajes", 12, 600, 360, 24),
  ];
  const DC = calcularDataset({ parametros: PARAMS, tablas: { Ventas: CHOQUE, Inventario: [] }, fechaCarga: "2026-08-31" });
  ok(!DC.dataset.historialMargen["Corvex"], "un nombre que es a la vez cuenta y marca queda SIN serie");
  const avC = DC.avisos.find((a) => a.tipo === "nombre-en-dos-ejes");
  ok(!!avC && /Corvex/.test(avC.detalle), "y se declara cuál es y por qué", avC && avC.detalle);
}

/* ═══ 9 · CARNADAS · cada chequeo de arriba, probado ROJO con el defecto real adentro ══════════════════════════
 * Se fabrica una copia del módulo VIVO con el defecto inyectado —el mismo que estuvo en el código o el que
 * habría estado si no se lo hubiera cerrado— y se comprueba que el chequeo correspondiente falla. Una copia,
 * no una reimplementación: el defecto tiene que entrar en el código que de verdad corre. */
H("9 · CARNADA · cada chequeo se prueba capaz de ponerse rojo");
{
  const tmp = [];
  let nCarnada = 0;
  const mutar = (rel, reemplazos) => {
    const abs = path.join(process.cwd(), rel);
    /* ⚠️ SALTOS NORMALIZADOS ANTES DE MUTAR — la lección de _esquema_datos_gate, repetida acá porque volvió a
     * pasar: git entrega estos .js con saltos de Windows, la carnada busca un patrón multilínea con \n, no
     * encuentra nada, la copia sale SIN defecto y la alarma —con razón— no suena. El gate quedaba rojo en
     * Windows y verde en Linux por el mismo código. A JavaScript los saltos le dan igual. */
    let txt = fs.readFileSync(abs, "utf8").replace(/\r\n/g, "\n");
    for (const [de, a] of reemplazos) {
      const antes = txt;
      txt = txt.replace(de, a);
      if (txt === antes) return { error: `la carnada no encontró qué mutar en ${rel}` };
    }
    /* ⚠️ NOMBRE ÚNICO POR CARNADA, no por proceso. Dos carnadas del mismo módulo con el mismo nombre de archivo
     * son LA MISMA URL para el caché de ESM: la segunda importaba el módulo de la primera, con el defecto
     * equivocado adentro, y su chequeo «no cazaba nada» — medía a otra. */
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

  // (a) el ancla que aplastaba la serie real, de vuelta en su lugar
  await carnada("re-escalar la serie del archivo al total del período", "src/adi/sentrix/temporal.js",
    [[/  if \(delArchivo\) \{\n    const oficial = metric[\s\S]*?\n  \}\n/, "\n"]],
    async (Mut) => {
      initTenant(D);
      const ev = Mut.buildEntityEvolution("Nortania", "venta");
      const real = D.historialMargen["Nortania"].map((p) => p.venta);
      return !!ev && JSON.stringify(ev.serie) !== JSON.stringify(real);
    });

  // (b) servir la serie que no cierra con la cifra oficial
  await carnada("servir una serie que no reconcilia", "src/ingesta/plantilla/serieDesdePlanilla.js",
    [[/    if \(punto\.venta !== cifra\) \{[\s\S]*?\n    \}\n/, "\n"]],
    async (Mut) => {
      const r = Mut.serieDesdePlanilla({
        ventas: VENTAS, dimSku: new Map([["AX-10", { marca: "Corvex", sfamilia: "Herrajes" }], ["BX-20", { marca: "Delmar", sfamilia: "Selladores" }]]),
        periodos: ["2026-06", "2026-07", "2026-08"], periodoActual: "2026-08",
        bloqueMargen: (filas) => ({ venta: Math.round(filas.reduce((a, r2) => a + (r2.venta || 0), 0)), costo: 0, rebates: 0, unidades: 0, contribucion: 0, pctRebate: 0, margen: 0, costoMedio: null }),
        oficial: new Map([["Nortania", 999999]]),
      });
      return !!r.historial["Nortania"];   // el defecto: la sirve igual
    });

  // (c) un 0% donde no hay denominador
  await carnada("poner 0% de margen en el mes sin venta", "src/ingesta/plantilla/serieDesdePlanilla.js",
    [[/margen: hayVenta \? b\.margen : null,/, "margen: b.margen,"]],
    async (Mut) => {
      const r = Mut.serieDesdePlanilla({
        ventas: VENTAS, dimSku: new Map([["AX-10", { marca: "Corvex", sfamilia: "Herrajes" }], ["BX-20", { marca: "Delmar", sfamilia: "Selladores" }]]),
        periodos: ["2026-06", "2026-07", "2026-08"], periodoActual: "2026-08",
        bloqueMargen: (filas) => {
          const v = filas.reduce((a, x) => a + (x.venta || 0), 0);
          return { venta: Math.round(v), costo: 0, rebates: 0, unidades: 0, contribucion: 0, pctRebate: 0, margen: v ? 30 : 0, costoMedio: null };
        },
        oficial: new Map([["Nortania", 6600]]),
      });
      const jul = (r.historial["Nortania"] || []).find((p) => p.periodo === "2026-07");
      return !!jul && jul.margen === 0;   // el defecto: dice «marginó cero» donde no vendió
    });

  /* (d) la colisión de nombres tiene DOS defensas — el salto de ambiguos y la reconciliación (la fila doblada
   * no cierra contra la oficial) — así que se prueban por separado: quitar solo el salto no basta para colar
   * la serie, y una carnada que «no caza» por eso estaría midiendo la defensa equivocada. */
  const bmStub = (filas) => ({ venta: Math.round(filas.reduce((a, x) => a + (x.venta || 0), 0)), costo: 0, rebates: 0, unidades: 0, contribucion: 0, pctRebate: 0, margen: 0, costoMedio: null });
  const argsChoque = (oficial) => ({
    ventas: [fila("2026-08", "Corvex", "AX-10", "Corvex", "Herrajes", 12, 600, 360, 24)],
    dimSku: new Map([["AX-10", { marca: "Corvex", sfamilia: "Herrajes" }]]),
    periodos: ["2026-08"], periodoActual: "2026-08", bloqueMargen: bmStub, oficial,
  });
  await carnada("callar la colisión de nombres (sin aviso)", "src/ingesta/plantilla/serieDesdePlanilla.js",
    [[/      avisos\.push\(\{ tipo: "nombre-en-dos-ejes", nombre,\n.*\n/, "\n"]],
    async (Mut) => {
      const r = Mut.serieDesdePlanilla(argsChoque(new Map([["Corvex", 600]])));
      return !r.avisos.some((a) => a.tipo === "nombre-en-dos-ejes");   // el defecto: excluye sin decir por qué
    });
  await carnada("servir la serie de un nombre en dos ejes (las dos defensas caídas)", "src/ingesta/plantilla/serieDesdePlanilla.js",
    [[/    if \(ambiguos\.has\(nombre\)\) continue;\n/, ""],
     [/    if \(punto\.venta !== cifra\) \{[\s\S]*?\n    \}\n/, "\n"]],
    async (Mut) => {
      const r = Mut.serieDesdePlanilla(argsChoque(new Map([["Corvex", 600]])));
      return !!r.historial["Corvex"];   // el defecto: sirve una serie que no se sabe de quién es (y doblada)
    });

  // (e) la curva de ceros del año anterior
  await carnada("dibujar el año anterior como una curva de ceros", "src/adi/sentrix/temporal.js",
    [[/      const serie = H\.map\(\(x\) => x\.ventaAnt\);\n      if \(serie\.every\(\(v\) => typeof v === "number" && Number\.isFinite\(v\)\)\)/,
      '      const serie = H.map((x) => Number(x.ventaAnt));\n      if (serie.every(Number.isFinite))']],
    async (Mut) => {
      initTenant(D);
      const cmp = Mut.buildEntityEvolutionComparado("Nortania", "venta");
      return !!(cmp && cmp.anterior && cmp.anterior.serie.every((v) => v === 0));
    });

  // (f) encender la película sin comprobar que la serie cierra
  await carnada("encender la película sin verificar el cierre", "src/adi/sentrix/capability.js",
    [[/  if \(!serie\.some\(\(p\) => p\.venta === oficial\)\) return \{ real: false, motivo: "no-reconcilia", n: serie\.length \};\n/, ""]],
    async (Mut) => {
      const torcido = { ...D, historialMargen: { ...D.historialMargen, Nortania: D.historialMargen["Nortania"].map((p) => ({ ...p, venta: p.venta + 7 })) } };
      initTenant(torcido);
      const r = Mut.serieRealDe("Nortania");
      initTenant(D);
      return r.real === true;   // el defecto: la da por real aunque no cierre con nada
    });

  for (const f of tmp) { try { fs.unlinkSync(f); } catch { /* */ } }
}

initTenant(TENANT_DEMO);
console.log(`\n── _serie_por_entidad_gate: ${pass} PASS · ${fail} FAIL (de ${pass + fail}) ──`);
process.exit(fail ? 1 : 0);
