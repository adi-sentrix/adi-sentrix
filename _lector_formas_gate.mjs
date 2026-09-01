/* === _lector_formas_gate.mjs · EL LECTOR MIDE EL CONCEPTO, NO LA FORMA DE ESCRIBIRLO (2026-09-01) ===========
 *
 * POR QUÉ EXISTE. El owner llenó las dos planillas de la certificación y ADI las rechazó con la peor frase
 * posible: *«el archivo no trae la hoja Empresa — descargá la plantilla oficial»*. El archivo traía la hoja
 * Empresa, y las otras tres, y 150 filas de ventas. El defecto era nuestro: el lector buscaba `<sheet>` y el
 * archivo decía `<x:sheet>` — el mismo documento, la misma norma OOXML, otra FORMA de escribirlo.
 *
 * Es el séptimo caso del MISMO patrón en este proyecto: un chequeo que mide cómo está escrito algo en vez de
 * qué dice. Por eso este candado no prueba «que el archivo del owner cargue» —eso sería memorizar un caso—
 * sino la propiedad general: **el mismo libro escrito de dos formas legales tiene que leerse igual.**
 *
 * LAS TRES FORMAS QUE ROMPÍAN, las tres encontradas en un archivo real:
 *   1 · prefijo de espacio de nombres  ·  `<x:row>` en vez de `<row>`
 *   2 · orden de atributos             ·  `Type Target Id` en vez de `Id … Target` en los rels
 *   3 · fila vacía autocerrada         ·  `<row r="2"/>` — el lector la salteaba y CORRÍA todo hacia arriba
 *
 * CON CARNADA. Cada sección corre además el patrón VIEJO contra el mismo archivo y exige que falle. Un
 * chequeo que no se puede poner rojo no está midiendo nada.
 *
 * Sin red, sin credenciales, sin `.env`: construye sus propios .xlsx en memoria.
 */
import { leerLibro } from "./src/ingesta/leerLibro.js";
import { ingestarPlantilla } from "./src/ingesta/plantilla/ingestarPlantilla.js";
import { plantillaEjemplo, datosEjemplo } from "./src/ingesta/plantilla/generarPlantilla.js";
import { construirXlsx } from "./src/ingesta/escribirLibro.js";
import { HOJAS, PARAMETROS, MARCA_PLANTILLA, HOJA_EMPRESA } from "./src/config/contract/plantilla.js";

let pass = 0, fail = 0;
const ok = (cond, titulo, detalle = "") => {
  if (cond) { pass++; console.log(`  ✓ ${titulo}`); }
  else { fail++; console.log(`  ✗ ${titulo}${detalle ? `\n      ${detalle}` : ""}`); }
};

/* ── un .xlsx de verdad, armado acá · entradas SIN comprimir (método 0), que el lector soporta ────────────── */
function zip(entradas) {
  const locales = [], centrales = [];
  let offset = 0;
  for (const e of entradas) {
    const nom = Buffer.from(e.nombre, "utf8"), dat = Buffer.from(e.texto, "utf8");
    const loc = Buffer.alloc(30 + nom.length);
    loc.writeUInt32LE(0x04034b50, 0); loc.writeUInt16LE(20, 4);
    loc.writeUInt32LE(dat.length, 18); loc.writeUInt32LE(dat.length, 22);
    loc.writeUInt16LE(nom.length, 26); nom.copy(loc, 30);
    const cen = Buffer.alloc(46 + nom.length);
    cen.writeUInt32LE(0x02014b50, 0); cen.writeUInt16LE(20, 4); cen.writeUInt16LE(20, 6);
    cen.writeUInt32LE(dat.length, 20); cen.writeUInt32LE(dat.length, 24);
    cen.writeUInt16LE(nom.length, 28); cen.writeUInt32LE(offset, 42); nom.copy(cen, 46);
    locales.push(loc, dat); centrales.push(cen);
    offset += loc.length + dat.length;
  }
  const cuerpo = Buffer.concat(locales), dir = Buffer.concat(centrales);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(entradas.length, 8); eocd.writeUInt16LE(entradas.length, 10);
  eocd.writeUInt32LE(dir.length, 12); eocd.writeUInt32LE(cuerpo.length, 16);
  return Buffer.concat([cuerpo, dir, eocd]);
}

/* El MISMO libro, escrito de dos formas legales. `p` es el prefijo ("" o "x:"); `relsIdPrimero` invierte el
 * orden de los atributos. La hoja trae a propósito una fila vacía en el medio (renglón 2), escrita autocerrada
 * cuando hay prefijo — que es como la escriben los generadores que producen esa forma. */
function libro({ p = "", relsIdPrimero = true } = {}) {
  const ns = p ? ` xmlns:${p.slice(0, -1)}="http://schemas.openxmlformats.org/spreadsheetml/2006/main"` : "";
  const t = (n) => `${p}${n}`;
  const rel = (id, target, tipo) => relsIdPrimero
    ? `<Relationship Id="${id}" Type="${tipo}" Target="${target}"/>`
    : `<Relationship Type="${tipo}" Target="${target}" Id="${id}"/>`;
  const TIPO_HOJA = "http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet";
  const TIPO_SS = "http://schemas.openxmlformats.org/officeDocument/2006/relationships/sharedStrings";
  const celda = (ref, i) => `<${t("c")} r="${ref}" t="s"><${t("v")}>${i}</${t("v")}></${t("c")}>`;
  const hoja = [
    `<?xml version="1.0"?><${t("worksheet")}${ns}><${t("sheetData")}>`,
    `<${t("row")} r="1">${celda("A1", 0)}${celda("B1", 1)}</${t("row")}>`,
    p ? `<${t("row")} r="2"/>` : `<${t("row")} r="2"></${t("row")}>`,          // la fila vacía del medio
    `<${t("row")} r="3">${celda("A3", 2)}${celda("B3", 3)}</${t("row")}>`,
    `</${t("sheetData")}></${t("worksheet")}>`,
  ].join("");
  const textos = ["cliente", "venta", "Falabella", "1000"];
  return zip([
    { nombre: "xl/workbook.xml",
      texto: `<?xml version="1.0"?><${t("workbook")}${ns}><${t("sheets")}><${t("sheet")} name="Ventas" sheetId="1" r:id="R1" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"/></${t("sheets")}></${t("workbook")}>` },
    { nombre: "xl/_rels/workbook.xml.rels",
      texto: `<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${rel("R2", "/xl/sharedStrings.xml", TIPO_SS)}${rel("R1", "/xl/worksheets/sheet1.xml", TIPO_HOJA)}</Relationships>` },
    { nombre: "xl/sharedStrings.xml",
      texto: `<?xml version="1.0"?><${t("sst")}${ns}>${textos.map((s) => `<${t("si")}><${t("t")} xml:space="preserve">${s}</${t("t")}></${t("si")}>`).join("")}</${t("sst")}>` },
    { nombre: "xl/worksheets/sheet1.xml", texto: hoja },
  ]);
}

const forma = (b) => {
  const L = leerLibro(b, { nombreArchivo: "x.xlsx" });
  return JSON.stringify(L.hojas.map((h) => ({ nombre: h.nombre, matriz: h.matriz })));
};

console.log("\n══ 1 · EL PREFIJO DE ESPACIO DE NOMBRES ══════════════════════════════════════════════════");
const llano = forma(libro({ p: "" }));
const prefijado = forma(libro({ p: "x:" }));
ok(llano.includes("Ventas") && llano.includes("Falabella"), "el libro llano se lee (control: la prueba mide algo)");
ok(llano === prefijado, "el MISMO libro con prefijo `x:` se lee IGUAL — hoja, filas y celdas",
  `llano=${llano.slice(0, 120)}\n      prefijado=${prefijado.slice(0, 120)}`);

/* CARNADA · el patrón viejo, tal cual estaba, contra el archivo prefijado. Si esto NO falla, la sección de
 * arriba se estaría aprobando sola y habría que desconfiar de ella. */
const xmlPrefijado = `<x:workbook><x:sheets><x:sheet name="Ventas" r:id="R1"/></x:sheets></x:workbook>`;
ok([...xmlPrefijado.matchAll(/<sheet\b[^>]*\/?>/g)].length === 0,
  "CARNADA · el patrón viejo `<sheet…>` es ciego al prefijo (por eso el archivo del owner salía vacío)");
ok([...xmlPrefijado.matchAll(new RegExp("<(?:[A-Za-z_][\\w.\\-]*:)?sheet\\b[^>]*/?>", "g"))].length === 1,
  "CARNADA · el patrón nuevo sí lo ve");

console.log("\n══ 2 · EL ORDEN DE LOS ATRIBUTOS EN LOS RELS ═════════════════════════════════════════════");
const idPrimero = forma(libro({ p: "", relsIdPrimero: true }));
const idUltimo = forma(libro({ p: "", relsIdPrimero: false }));
ok(idPrimero === idUltimo, "`Type Target Id` se lee igual que `Id Type Target` — el orden no significa nada en XML",
  `idPrimero=${idPrimero.slice(0, 120)}\n      idUltimo=${idUltimo.slice(0, 120)}`);
const relTargetPrimero = `<Relationship Type="t" Target="/xl/worksheets/sheet1.xml" Id="R1"/>`;
ok(!/<Relationship\b[^>]*Id="([^"]+)"[^>]*Target="([^"]+)"/.test(relTargetPrimero),
  "CARNADA · el patrón viejo exigía Id ANTES de Target y no encontraba ninguna relación");

console.log("\n══ 3 · LA FILA VACÍA NO CORRE LAS DEMÁS ══════════════════════════════════════════════════");
const H = leerLibro(libro({ p: "x:" }), { nombreArchivo: "x.xlsx" }).hojas[0];
ok(H.matriz.length === 3, `la hoja conserva sus 3 renglones (leyó ${H.matriz.length})`);
ok(!(H.matriz[1] || []).length, "el renglón 2 sigue vacío");
ok(H.matriz[2] && H.matriz[2][0] === "Falabella",
  `el dato del renglón 3 SIGUE en el renglón 3 (leyó ${JSON.stringify(H.matriz[2])})`);
const soloPares = [...`<x:row r="1"><x:c/></x:row><x:row r="2"/><x:row r="3"><x:c/></x:row>`
  .matchAll(new RegExp("<(?:[A-Za-z_][\\w.\\-]*:)?row\\b[^>]*>([\\s\\S]*?)</(?:[A-Za-z_][\\w.\\-]*:)?row>", "g"))];
ok(soloPares.length === 2,
  "CARNADA · el patrón viejo salteaba la fila autocerrada — 2 de 3, y el dato subía un renglón");

console.log("\n══ 4 · LA HOJA OPCIONAL VACÍA SE DECLARA COMO LO QUE ES ══════════════════════════════════");
/* La plantilla oficial se descarga CON las cuatro hojas dentro. Quien no lleva cuenta corriente no borra la
 * hoja Abonos: la deja en blanco. Si sólo se declarara la hoja AUSENTE, el caso normal —el de todos los
 * clientes reales— no registraría faltante y ADI volvería a la disculpa sin nombre. */
const ej = ingestarPlantilla(plantillaEjemplo(), { nombreArchivo: "ejemplo.xlsx" });
ok(ej.ok, "control · el ejemplo oficial sigue cargando (no se rompió nada aguas arriba)");
const abonosDelEjemplo = (ej.dataset.avisosDeCarga || []).filter((a) => /Abonos/i.test(a.detalle));
ok(!abonosDelEjemplo.some((a) => a.tipo === "hoja-vacia"),
  "el ejemplo TRAE Abonos con filas, así que no se lo declara vacío (no se avisa de más)");

/* Y ahora el caso que importa: el mismo libro sin una sola fila de abonos. Se construye vaciando la hoja del
 * ejemplo oficial, para que el resto del archivo sea idéntico y la única diferencia medida sea esa. */
const d = datosEjemplo();
const filasDe = { Ventas: d.ventas, Inventario: d.inventario, Abonos: [] };   // ← Abonos EN BLANCO
const sinAbonos = construirXlsx([
  { nombre: HOJA_EMPRESA, filas: [[MARCA_PLANTILLA], [], [],
    ...PARAMETROS.flatMap((p) => [[p.etiqueta, d.parametros[p.clave] ?? null], []])], anchos: [52, 30] },
  ...HOJAS.map((h) => ({ nombre: h.nombre,
    filas: [[h.que], [], [], h.columnas.map((c) => c.titulo),
      ...(filasDe[h.nombre] || []).map((f) => h.columnas.map((c) => f[c.campo] ?? null))],
    anchos: h.columnas.map(() => 18) })),
]);
const r = ingestarPlantilla(sinAbonos, { nombreArchivo: "sin-abonos.xlsx" });
ok(r.ok, "el archivo con Abonos en blanco CARGA IGUAL — la hoja es opcional y sigue siéndolo");
const faltan = r.dataset.avisosDeCarga || [];
ok(faltan.some((a) => a.tipo === "hoja-vacia" && /Abonos/i.test(a.detalle)),
  "queda registrado que Abonos vino sin filas",
  `avisos: ${faltan.map((a) => a.tipo).join(", ")}`);

console.log(`\n${fail === 0 ? "✅" : "❌"} _lector_formas_gate · ${pass} PASS · ${fail} FAIL\n`);
process.exit(fail === 0 ? 0 : 1);
