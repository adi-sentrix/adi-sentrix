/* === scripts/generar-excel-demo.mjs · EL EXCEL SINTÉTICO, HECHO DEL DATO DEL DEMO (vía 2 · paso 1) ============
 *
 * Escribe un `.xlsx` de verdad —ZIP + XML, sin ninguna dependencia— a partir del tenant demo. Sirve para dos cosas:
 *   1. tener un archivo con el que probar la ingesta **sin pedirle nada a ningún cliente** (la regla del paso 1:
 *      solo dato demo o sintético), y
 *   2. hacer posible la prueba del ESPEJO: si el archivo sale del demo y la ingesta lo devuelve igual, entonces
 *      leer y normalizar no perdió ni deformó nada. Un ida y vuelta que cierra vale más que veinte asserts sueltos.
 *
 * A PROPÓSITO NO ES UN VOLCADO FIEL. Los encabezados están escritos como los escribiría una persona —«Cliente»,
 * «Venta del mes», «Stock valorizado»— justamente para ejercitar el mapeo por sinónimo declarado, y una columna
 * («Observaciones») no existe en el contrato para que el mapeo tenga algo que reportar como sin resolver. Un
 * fixture que calca los nombres internos probaría el camino que nunca ocurre.
 *
 * Uso:  node scripts/generar-excel-demo.mjs [destino.xlsx]
 * Determinístico · sin red · sin modelo.
 */
import { deflateRawSync } from "node:zlib";
import { writeFileSync } from "node:fs";
import { TENANT_DEMO } from "../src/data/tenants/demo.js";

/* ── CRC32, el que exige el formato ZIP ───────────────────────────────────────────────────────────────────── */
const TABLA_CRC = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; }
  return t;
})();
const crc32 = (buf) => { let c = 0xffffffff; for (const b of buf) c = TABLA_CRC[(c ^ b) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };

/* ── ZIP mínimo (deflate) ─────────────────────────────────────────────────────────────────────────────────── */
function escribirZip(entradas) {
  const locales = [], central = [];
  let offset = 0;
  for (const { nombre, contenido } of entradas) {
    const cruda = Buffer.from(contenido, "utf8");
    const comprimida = deflateRawSync(cruda);
    const nom = Buffer.from(nombre, "utf8");
    const crc = crc32(cruda);

    const lh = Buffer.alloc(30);
    lh.writeUInt32LE(0x04034b50, 0); lh.writeUInt16LE(20, 4); lh.writeUInt16LE(0, 6); lh.writeUInt16LE(8, 8);
    lh.writeUInt16LE(0, 10); lh.writeUInt16LE(0, 12);                        // hora/fecha fijas → salida determinística
    lh.writeUInt32LE(crc, 14); lh.writeUInt32LE(comprimida.length, 18); lh.writeUInt32LE(cruda.length, 22);
    lh.writeUInt16LE(nom.length, 26); lh.writeUInt16LE(0, 28);
    locales.push(lh, nom, comprimida);

    const ch = Buffer.alloc(46);
    ch.writeUInt32LE(0x02014b50, 0); ch.writeUInt16LE(20, 4); ch.writeUInt16LE(20, 6); ch.writeUInt16LE(0, 8);
    ch.writeUInt16LE(8, 10); ch.writeUInt16LE(0, 12); ch.writeUInt16LE(0, 14);
    ch.writeUInt32LE(crc, 16); ch.writeUInt32LE(comprimida.length, 20); ch.writeUInt32LE(cruda.length, 24);
    ch.writeUInt16LE(nom.length, 28); ch.writeUInt16LE(0, 30); ch.writeUInt16LE(0, 32);
    ch.writeUInt16LE(0, 34); ch.writeUInt16LE(0, 36); ch.writeUInt32LE(0, 38); ch.writeUInt32LE(offset, 42);
    central.push(ch, nom);

    offset += lh.length + nom.length + comprimida.length;
  }
  const cuerpoCentral = Buffer.concat(central);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(entradas.length, 8); eocd.writeUInt16LE(entradas.length, 10);
  eocd.writeUInt32LE(cuerpoCentral.length, 12); eocd.writeUInt32LE(offset, 16);
  return Buffer.concat([...locales, cuerpoCentral, eocd]);
}

/* ── XLSX ─────────────────────────────────────────────────────────────────────────────────────────────────── */
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const letraCol = (i) => { let s = "", n = i + 1; while (n > 0) { const r = (n - 1) % 26; s = String.fromCharCode(65 + r) + s; n = Math.floor((n - 1) / 26); } return s; };

/** Arma un `.xlsx` a partir de `[{ nombre, filas: [[celda,…],…] }]`. Exportado para que un gate pueda fabricar
 *  libros sintéticos con las entidades que quiera, sin sacar dato de ningún tenant. */
export function construirXlsx(hojas) {
  const compartidos = [], idxCompartido = new Map();
  const idDe = (s) => { if (!idxCompartido.has(s)) { idxCompartido.set(s, compartidos.length); compartidos.push(s); } return idxCompartido.get(s); };

  const xmlHojas = hojas.map(({ filas }) => {
    const cuerpo = filas.map((fila, iF) => {
      const celdas = fila.map((v, iC) => {
        const ref = `${letraCol(iC)}${iF + 1}`;
        if (v === null || v === undefined || v === "") return "";
        if (typeof v === "number") return `<c r="${ref}"><v>${v}</v></c>`;
        return `<c r="${ref}" t="s"><v>${idDe(String(v))}</v></c>`;
      }).join("");
      return `<row r="${iF + 1}">${celdas}</row>`;
    }).join("");
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${cuerpo}</sheetData></worksheet>`;
  });

  const sharedStrings = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="${compartidos.length}" uniqueCount="${compartidos.length}">${compartidos.map((s) => `<si><t xml:space="preserve">${esc(s)}</t></si>`).join("")}</sst>`;

  const entradas = [
    { nombre: "[Content_Types].xml", contenido: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>${hojas.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join("")}<Override PartName="/xl/sharedStrings.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml"/></Types>` },
    { nombre: "_rels/.rels", contenido: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>` },
    { nombre: "xl/workbook.xml", contenido: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${hojas.map((h, i) => `<sheet name="${esc(h.nombre)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join("")}</sheets></workbook>` },
    { nombre: "xl/_rels/workbook.xml.rels", contenido: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${hojas.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join("")}<Relationship Id="rIdSS" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/sharedStrings" Target="sharedStrings.xml"/></Relationships>` },
    { nombre: "xl/sharedStrings.xml", contenido: sharedStrings },
    ...xmlHojas.map((x, i) => ({ nombre: `xl/worksheets/sheet${i + 1}.xml`, contenido: x })),
  ];
  return escribirZip(entradas);
}

/* ── las tres hojas, con encabezados «de persona» ─────────────────────────────────────────────────────────── */
export function hojasDelDemo(tenant = TENANT_DEMO) {
  const cv = tenant.clientesVentas, cm = tenant.clientesMargen, si = tenant.skuInventario, sm = tenant.skusMargen;
  const margenPorNombre = new Map(cm.map((r) => [r.nombre, r]));

  const clientes = [
    ["Cliente", "Canal", "Marca", "Familia", "Venta del mes", "Periodo anterior", "Presupuesto", "Cantidad", "Cantidad anterior", "Rebate %", "Observaciones"],
    ...cv.map((r) => {
      const m = margenPorNombre.get(r.nombre) || {};
      return [r.nombre, r.canal ?? null, m.marca ?? null, m.sfamilia ?? null, r.actual, r.anterior, r.presupuesto, r.unidades, r.unidadesAnt, r.pctRebate, null];
    }),
  ];

  const margen = [
    ["Cuenta", "Marca", "Familia", "Ventas", "Costo de venta", "Rebates", "Utilidad bruta", "Rebate %", "Margen %", "Referencia", "Cantidad", "Costo unitario", "Precio lista"],
    ...cm.map((r) => [r.nombre, r.marca, r.sfamilia, r.venta, r.costo, r.rebates, r.contribucion, r.pctRebate, r.margen, r.benchmark, r.unidades, r.costoMedio, r.precioLista]),
  ];

  const inventario = [
    ["Código SKU", "Bodega", "Marca", "Familia", "Stock valorizado", "Stock unidades", "Rotación", "Días de inventario", "Cobertura días", "Margen %", "Días sin venta", "Vendido mes", "Venta diaria", "Estado", "Semáforo"],
    ...si.map((r) => [r.sku, r.bodega, r.marca, r.sfamilia, r.stockUSD, r.stockUnd, r.rotacion, r.doh, r.cobertura, r.margenPct, r.diasSinVenta, r.vendidoMes, r.ventaDiaria, r.estado, r.alerta]),
  ];

  const productos = [
    ["Producto", "Marca", "Familia", "Ventas", "Costo de venta", "Rebates", "Utilidad bruta", "Rebate %", "Margen %", "Referencia", "Cantidad", "Costo unitario", "Precio lista"],
    ...sm.map((r) => [r.nombre, r.marca, r.sfamilia, r.venta, r.costo, r.rebates, r.contribucion, r.pctRebate, r.margen, r.benchmark, r.unidades, r.costoMedio, r.precioLista]),
  ];

  return [
    { nombre: "Clientes", filas: clientes },
    { nombre: "Margen por cuenta", filas: margen },
    { nombre: "Inventario", filas: inventario },
    { nombre: "Productos", filas: productos },
  ];
}

/** El `.xlsx` sintético como Buffer — lo usa el gate sin escribir a disco. */
export const excelDemoBuffer = (tenant = TENANT_DEMO) => construirXlsx(hojasDelDemo(tenant));

// Ejecutado directamente: escribe el archivo (para mirarlo en Excel de verdad).
if (process.argv[1] && process.argv[1].endsWith("generar-excel-demo.mjs")) {
  const destino = process.argv[2] || "_ejemplo_ingesta_demo.xlsx";
  const buf = excelDemoBuffer();
  writeFileSync(destino, buf);
  console.log(`✅ ${destino} · ${(buf.length / 1024).toFixed(1)} KB · ${hojasDelDemo().length} hojas, hechas del tenant demo`);
}
