/* === ingesta/leerLibro.js · EL ARCHIVO SE LEE CON CÓDIGO, NUNCA CON UN MODELO (vía 2 · paso 1 · 2026-08-21) ====
 *
 * Devuelve las filas de un `.xlsx` o un `.csv` y nada más: ni interpreta, ni mapea, ni normaliza. Es el escalón
 * más bajo de la ingesta a propósito — leer es una operación mecánica y determinística, y tratarla como tal es lo
 * que hace que el resto sea barato: un Excel de 5.000 filas cuesta CERO tokens acá.
 *
 * SIN UNA SOLA DEPENDENCIA NUEVA, y no por purismo. Un `.xlsx` es un ZIP con XML adentro, y Node ya trae la
 * descompresión (`node:zlib`), así que leerlo no necesita red para instalar nada — que es exactamente la
 * restricción con la que arranca este paso. Cuando lleguen archivos de clientes reales hay que volver a discutirlo:
 * este lector cubre lo que un exportador normal produce (texto, números, strings compartidos, varias hojas), NO la
 * cola larga de Excel de verdad (fechas como serial con formato, celdas combinadas, fórmulas, hojas protegidas).
 * Para eso está SheetJS, y pedirlo será una decisión con su propia autorización. Acá se declara el límite en vez
 * de fingir que no existe.
 *
 * QUÉ DEVUELVE:
 *   { formato, hojas: [{ nombre, encabezados: [string], filas: [{ [encabezado]: valor }], filasCrudas: [[…]] }] }
 * Los valores salen como **string o número**, tal cual venían. Convertir unidades, resolver alias o decidir qué
 * columna es qué NO es trabajo de este archivo: eso se PROPONE en el mapeo y lo CONFIRMA un humano.
 */
import { inflateRawSync } from "node:zlib";

/* ── ZIP · lo mínimo para abrir un .xlsx ──────────────────────────────────────────────────────────────────────
 * Se recorre el DIRECTORIO CENTRAL (al final del archivo), no los encabezados locales: es el índice autoritativo
 * del ZIP y es el único lugar donde los tamaños son confiables cuando el escritor usó descriptores de datos. */
const FIRMA_EOCD = 0x06054b50, FIRMA_CENTRAL = 0x02014b50, FIRMA_LOCAL = 0x04034b50;

function abrirZip(buf) {
  // el EOCD vive en los últimos 22 bytes + comentario (máx 64K): se busca hacia atrás
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 22 - 65535); i--) {
    if (buf.readUInt32LE(i) === FIRMA_EOCD) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error("no parece un archivo .xlsx (no se encontró el índice del ZIP)");
  const nEntradas = buf.readUInt16LE(eocd + 10);
  let p = buf.readUInt32LE(eocd + 16);   // offset del directorio central

  const entradas = new Map();
  for (let i = 0; i < nEntradas; i++) {
    if (buf.readUInt32LE(p) !== FIRMA_CENTRAL) break;
    const metodo = buf.readUInt16LE(p + 10);
    const tamComprimido = buf.readUInt32LE(p + 20);
    const lenNombre = buf.readUInt16LE(p + 28), lenExtra = buf.readUInt16LE(p + 30), lenCom = buf.readUInt16LE(p + 32);
    const offsetLocal = buf.readUInt32LE(p + 42);
    const nombre = buf.toString("utf8", p + 46, p + 46 + lenNombre);
    entradas.set(nombre, { metodo, tamComprimido, offsetLocal });
    p += 46 + lenNombre + lenExtra + lenCom;
  }

  return (nombre) => {
    const e = entradas.get(nombre);
    if (!e) return null;
    if (buf.readUInt32LE(e.offsetLocal) !== FIRMA_LOCAL) throw new Error(`entrada corrupta en el ZIP: ${nombre}`);
    const lenNombre = buf.readUInt16LE(e.offsetLocal + 26), lenExtra = buf.readUInt16LE(e.offsetLocal + 28);
    const ini = e.offsetLocal + 30 + lenNombre + lenExtra;
    const datos = buf.subarray(ini, ini + e.tamComprimido);
    if (e.metodo === 0) return datos.toString("utf8");                 // guardado sin comprimir
    if (e.metodo === 8) return inflateRawSync(datos).toString("utf8"); // deflate
    throw new Error(`método de compresión no soportado (${e.metodo}) en ${nombre}`);
  };
}

/* ── XML · un lector de etiquetas mínimo, suficiente para las tres piezas de un .xlsx ───────────────────────── */
const _desescapar = (s) => String(s)
  .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'")
  .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
  .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCodePoint(parseInt(h, 16)))
  .replace(/&amp;/g, "&");   // el & va ÚLTIMO: si no, "&amp;lt;" se desescaparía dos veces

/** Todo el texto de los `<t>` de un nodo (un string compartido puede venir partido en varios `<r><t>`). */
const _textoDeNodo = (xml) => {
  const partes = [...xml.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)].map((m) => _desescapar(m[1]));
  return partes.join("");
};

/** `A12` → `{ col: 0, fila: 12 }` · la columna se decodifica en base 26 (A..Z, AA..) */
function refCelda(ref) {
  const m = /^([A-Z]+)(\d+)$/.exec(String(ref || ""));
  if (!m) return null;
  let col = 0;
  for (const ch of m[1]) col = col * 26 + (ch.charCodeAt(0) - 64);
  return { col: col - 1, fila: Number(m[2]) };
}

/* ── el .xlsx ─────────────────────────────────────────────────────────────────────────────────────────────── */
function leerXlsx(buf) {
  const leer = abrirZip(buf);

  const compartidos = [];
  const ss = leer("xl/sharedStrings.xml");
  if (ss) for (const m of ss.matchAll(/<si>([\s\S]*?)<\/si>/g)) compartidos.push(_textoDeNodo(m[1]));

  // nombre de hoja → archivo, cruzando workbook.xml con sus rels
  const wb = leer("xl/workbook.xml") || "";
  const rels = leer("xl/_rels/workbook.xml.rels") || "";
  const destinoPorId = new Map();
  for (const m of rels.matchAll(/<Relationship\b[^>]*Id="([^"]+)"[^>]*Target="([^"]+)"/g)) {
    destinoPorId.set(m[1], m[2].replace(/^\/?xl\//, "").replace(/^\//, ""));
  }
  const hojasDeclaradas = [];
  for (const m of wb.matchAll(/<sheet\b[^>]*\/?>/g)) {
    const nombre = /name="([^"]*)"/.exec(m[0]);
    const rid = /r:id="([^"]+)"/.exec(m[0]);
    hojasDeclaradas.push({
      nombre: nombre ? _desescapar(nombre[1]) : `Hoja${hojasDeclaradas.length + 1}`,
      archivo: (rid && destinoPorId.get(rid[1])) || `worksheets/sheet${hojasDeclaradas.length + 1}.xml`,
    });
  }
  if (!hojasDeclaradas.length) hojasDeclaradas.push({ nombre: "Hoja1", archivo: "worksheets/sheet1.xml" });

  const hojas = [];
  for (const h of hojasDeclaradas) {
    const xml = leer(`xl/${h.archivo}`) || leer(h.archivo);
    if (!xml) continue;
    const matriz = [];
    for (const mf of xml.matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/g)) {
      const fila = [];
      for (const mc of mf[1].matchAll(/<c\b([^>]*)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
        const attrs = mc[1] || "", cuerpo = mc[2] || "";
        const r = /r="([A-Z]+\d+)"/.exec(attrs);
        const idx = r ? (refCelda(r[1]) || {}).col : fila.length;
        const tipo = (/t="([^"]+)"/.exec(attrs) || [])[1] || "n";
        let valor = null;
        if (tipo === "s") {                                   // string compartido
          const iv = /<v>([\s\S]*?)<\/v>/.exec(cuerpo);
          valor = iv ? (compartidos[Number(iv[1])] ?? "") : "";
        } else if (tipo === "inlineStr") {
          valor = _textoDeNodo(cuerpo);
        } else if (tipo === "str") {                          // resultado de fórmula, como texto
          const iv = /<v>([\s\S]*?)<\/v>/.exec(cuerpo);
          valor = iv ? _desescapar(iv[1]) : "";
        } else if (tipo === "b") {
          const iv = /<v>([\s\S]*?)<\/v>/.exec(cuerpo);
          valor = iv ? iv[1] === "1" : null;
        } else {                                              // numérico
          const iv = /<v>([\s\S]*?)<\/v>/.exec(cuerpo);
          valor = iv ? Number(iv[1]) : null;
        }
        while (fila.length < idx) fila.push(null);            // celdas vacías salteadas por el escritor
        fila[idx] = valor;
      }
      matriz.push(fila);
    }
    hojas.push({ nombre: h.nombre, matriz });
  }
  return hojas;
}

/* ── el .csv ──────────────────────────────────────────────────────────────────────────────────────────────── */
function leerCsv(texto, separador = null) {
  const t = String(texto).replace(/^﻿/, "");                       // BOM de Excel
  // el separador se DETECTA contando en la primera línea, no se asume: media LatAm exporta con `;`
  const primera = t.split(/\r?\n/, 1)[0] || "";
  const sep = separador || ((primera.split(";").length > primera.split(",").length) ? ";" : ",");
  const matriz = [];
  let fila = [], campo = "", enComillas = false;
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (enComillas) {
      if (c === '"' && t[i + 1] === '"') { campo += '"'; i++; }
      else if (c === '"') enComillas = false;
      else campo += c;
      continue;
    }
    if (c === '"') { enComillas = true; continue; }
    if (c === sep) { fila.push(campo); campo = ""; continue; }
    if (c === "\n") { fila.push(campo); matriz.push(fila); fila = []; campo = ""; continue; }
    if (c === "\r") continue;
    campo += c;
  }
  if (campo.length || fila.length) { fila.push(campo); matriz.push(fila); }
  return [{ nombre: "csv", matriz, separador: sep }];
}

/** ¿el texto es un número escrito como lo escribe una planilla? Acepta miles y coma decimal, y NO adivina moneda. */
const _aNumero = (s) => {
  const t = String(s).trim();
  if (!t || !/^[-+]?[\d.,\s]+%?$/.test(t)) return null;
  const pct = t.endsWith("%");
  const cuerpo = t.replace(/%$/, "").replace(/\s/g, "");
  // último separador decide qué es decimal: "1.234,56" (LatAm) vs "1,234.56" (US)
  const ultimaComa = cuerpo.lastIndexOf(","), ultimoPunto = cuerpo.lastIndexOf(".");
  let limpio;
  if (ultimaComa > ultimoPunto) limpio = cuerpo.replace(/\./g, "").replace(",", ".");
  else if (ultimoPunto > ultimaComa) limpio = cuerpo.replace(/,/g, "");
  else limpio = cuerpo.replace(/[.,]/g, "");
  const n = Number(limpio);
  return Number.isFinite(n) ? (pct ? n : n) : null;
};

/* leerLibro(buffer|string, { nombreArchivo }) → { formato, hojas: [...] }
 * `nombreArchivo` solo se usa para elegir el lector; si no viene, se decide por el contenido (los .xlsx empiezan
 * con "PK"). Nunca se adivina el formato por el peso ni por la primera línea. */
export function leerLibro(entrada, { nombreArchivo = "" } = {}) {
  const esBuffer = typeof entrada !== "string";
  const buf = esBuffer ? Buffer.from(entrada) : null;
  const pareceZip = esBuffer && buf.length > 2 && buf[0] === 0x50 && buf[1] === 0x4b;   // "PK"
  const porNombre = /\.xlsx?$/i.test(nombreArchivo) ? "xlsx" : (/\.csv$/i.test(nombreArchivo) ? "csv" : null);
  const formato = porNombre || (pareceZip ? "xlsx" : "csv");

  const crudas = formato === "xlsx" ? leerXlsx(buf) : leerCsv(esBuffer ? buf.toString("utf8") : entrada);

  const hojas = crudas.map((h) => {
    // el encabezado es la PRIMERA fila con contenido; las vacías de arriba se saltan y se declara cuántas.
    let iEnc = h.matriz.findIndex((f) => (f || []).some((v) => v !== null && v !== undefined && String(v).trim() !== ""));
    // `matriz` va SIEMPRE: la plantilla oficial tiene una fila de ayuda arriba, así que quien la valida necesita
    // las filas crudas para leer el encabezado en la fila que el CONTRATO declara, en vez de adivinar cuál es.
    if (iEnc < 0) return { nombre: h.nombre, matriz: h.matriz, encabezados: [], filas: [], filasCrudas: [], filasVaciasArriba: h.matriz.length };
    const encabezados = (h.matriz[iEnc] || []).map((v, i) => (v === null || v === undefined || String(v).trim() === "" ? `columna_${i + 1}` : String(v).trim()));
    const filasCrudas = h.matriz.slice(iEnc + 1).filter((f) => (f || []).some((v) => v !== null && v !== undefined && String(v).trim() !== ""));
    const filas = filasCrudas.map((f) => {
      const o = {};
      encabezados.forEach((k, i) => {
        const v = (f || [])[i];
        if (v === null || v === undefined || v === "") { o[k] = null; return; }
        o[k] = typeof v === "number" || typeof v === "boolean" ? v : (_aNumero(v) ?? String(v).trim());
      });
      return o;
    });
    return { nombre: h.nombre, matriz: h.matriz, encabezados, filas, filasCrudas, filasVaciasArriba: iEnc };
  });

  return { formato, hojas };
}

export const _internos = { abrirZip, leerCsv, refCelda, _aNumero };
