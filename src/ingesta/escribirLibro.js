/* === ingesta/escribirLibro.js · ESCRIBIR UN .xlsx SIN DEPENDENCIAS (vía 2 · plantilla oficial · 2026-08-22) ====
 *
 * El gemelo de `leerLibro.js`. Pasa a `src/` —y deja de ser un utilitario de `scripts/`— porque ahora es CÓDIGO
 * DE PRODUCTO: la plantilla oficial que se le entrega al cliente se genera con esto, no se guarda como un binario
 * versionado a mano. Una plantilla que vive como archivo en el repo se desincroniza del contrato el día que
 * alguien agrega una columna; una que se GENERA del contrato no puede.
 *
 * Un `.xlsx` es un ZIP con XML adentro y `node:zlib` ya trae la compresión: cero dependencias, cero red.
 * Escribe strings compartidos (el camino común de Excel real), fechas/horas fijas para que la salida sea
 * DETERMINÍSTICA —el mismo contrato produce el mismo archivo, byte a byte, y eso lo puede probar un gate— y
 * soporta ancho de columna para que la plantilla se lea sin arrastrar bordes.
 */
import { deflateRawSync } from "node:zlib";

/* ── CRC32, que el formato ZIP exige ─────────────────────────────────────────────────────────────────────── */
const TABLA_CRC = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; }
  return t;
})();
const crc32 = (buf) => { let c = 0xffffffff; for (const b of buf) c = TABLA_CRC[(c ^ b) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };

/** ZIP mínimo (deflate) · sin marca de tiempo → mismo contenido, mismos bytes, siempre. */
export function escribirZip(entradas) {
  const locales = [], central = [];
  let offset = 0;
  for (const { nombre, contenido } of entradas) {
    const cruda = Buffer.from(contenido, "utf8");
    const comprimida = deflateRawSync(cruda);
    const nom = Buffer.from(nombre, "utf8");
    const crc = crc32(cruda);

    const lh = Buffer.alloc(30);
    lh.writeUInt32LE(0x04034b50, 0); lh.writeUInt16LE(20, 4); lh.writeUInt16LE(0, 6); lh.writeUInt16LE(8, 8);
    lh.writeUInt16LE(0, 10); lh.writeUInt16LE(0, 12);
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

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const letraCol = (i) => { let s = "", n = i + 1; while (n > 0) { const r = (n - 1) % 26; s = String.fromCharCode(65 + r) + s; n = Math.floor((n - 1) / 26); } return s; };

/* ── LOS CUATRO ESTILOS DE LA PLANTILLA (2026-08-26) ──────────────────────────────────────────────────────────
 * El owner pidió que el usuario abra el archivo y sepa qué hacer: «marca en amarillo los campos obligatorios» y
 * «deja un comentario en cada campo». Ambas cosas necesitan estilos, que este escritor no tenía.
 *
 * ⚠️ LOS DOS PRIMEROS RELLENOS NO SE PUEDEN SALTAR: el formato exige que el índice 0 sea `none` y el 1 sea
 * `gray125`. Si el amarillo se pone en el índice 0, Excel abre el archivo pidiendo repararlo — y una plantilla
 * que arranca con un cartel de error es peor que una sin color. */
export const ESTILO = { NORMAL: 0, OBLIGATORIA: 1, OPCIONAL: 2, AYUDA: 3, TITULO: 4 };

const STYLES_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
  `<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">` +
  `<fonts count="4">` +
    `<font><sz val="11"/><name val="Calibri"/></font>` +
    `<font><b/><sz val="11"/><name val="Calibri"/></font>` +
    `<font><i/><sz val="9"/><color rgb="FF7F7F7F"/><name val="Calibri"/></font>` +
    `<font><b/><sz val="12"/><name val="Calibri"/></font>` +
  `</fonts>` +
  `<fills count="3">` +
    `<fill><patternFill patternType="none"/></fill>` +
    `<fill><patternFill patternType="gray125"/></fill>` +
    `<fill><patternFill patternType="solid"><fgColor rgb="FFFFE699"/><bgColor indexed="64"/></patternFill></fill>` +
  `</fills>` +
  `<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>` +
  `<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>` +
  `<cellXfs count="5">` +
    `<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>` +
    `<xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/>` +
    `<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/>` +
    `<xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>` +
    `<xf numFmtId="0" fontId="3" fillId="0" borderId="0" xfId="0" applyFont="1"/>` +
  `</cellXfs>` +
  `<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>` +
  `</styleSheet>`;

/* construirXlsx(hojas) → Buffer
 *   hojas: [{ nombre, filas: [[celda,…],…], anchos?: [n,…] }]
 * Los valores `number` van como número; el resto, como string compartido. `null`/`""` deja la celda vacía —
 * importante en una plantilla vacía: una celda con `""` y una celda sin escribir se ven igual pero no lo son. */
export function construirXlsx(hojas) {
  const compartidos = [], idxCompartido = new Map();
  const idDe = (s) => { if (!idxCompartido.has(s)) { idxCompartido.set(s, compartidos.length); compartidos.push(s); } return idxCompartido.get(s); };

  const xmlHojas = hojas.map(({ filas, anchos }) => {
    const cols = (anchos && anchos.length)
      ? `<cols>${anchos.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join("")}</cols>`
      : "";
    const cuerpo = filas.map((fila, iF) => {
      const celdas = (fila || []).map((v, iC) => {
        const ref = `${letraCol(iC)}${iF + 1}`;
        /* Una celda puede venir como valor pelado o como { v, s } con su estilo. El estilo es lo que permite
         * pintar de amarillo los campos obligatorios — sin eso la plantilla no puede decirle al usuario qué
         * tiene que llenar sin que lea un manual aparte (owner 2026-08-26). */
        const val = (v && typeof v === "object" && "v" in v) ? v.v : v;
        const est = (v && typeof v === "object" && v.s) ? ` s="${v.s}"` : "";
        if (val === null || val === undefined || val === "") return est ? `<c r="${ref}"${est}/>` : "";
        if (typeof val === "number") return Number.isFinite(val) ? `<c r="${ref}"${est}><v>${val}</v></c>` : "";
        return `<c r="${ref}"${est} t="s"><v>${idDe(String(val))}</v></c>`;
      }).join("");
      return `<row r="${iF + 1}">${celdas}</row>`;
    }).join("");
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">${cols}<sheetData>${cuerpo}</sheetData></worksheet>`;
  });

  const sharedStrings = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="${compartidos.length}" uniqueCount="${compartidos.length}">${compartidos.map((s) => `<si><t xml:space="preserve">${esc(s)}</t></si>`).join("")}</sst>`;

  const entradas = [
    { nombre: "[Content_Types].xml", contenido: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>${hojas.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join("")}<Override PartName="/xl/sharedStrings.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>` },
    { nombre: "_rels/.rels", contenido: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>` },
    { nombre: "xl/workbook.xml", contenido: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${hojas.map((h, i) => `<sheet name="${esc(h.nombre)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join("")}</sheets></workbook>` },
    { nombre: "xl/_rels/workbook.xml.rels", contenido: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${hojas.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join("")}<Relationship Id="rIdSS" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/sharedStrings" Target="sharedStrings.xml"/><Relationship Id="rIdST" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>` },
    { nombre: "xl/sharedStrings.xml", contenido: sharedStrings },
    { nombre: "xl/styles.xml", contenido: STYLES_XML },
    ...xmlHojas.map((x, i) => ({ nombre: `xl/worksheets/sheet${i + 1}.xml`, contenido: x })),
  ];
  return escribirZip(entradas);
}
