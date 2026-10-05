/* === scripts/medicion-anfitrion/sellar.mjs · EL FORMATO DEL CORPUS, EL SELLADOR Y EL QUEMADOR ══════════════════════
 * El corpus lo escribe OTRO autor, ciego (una sesión que NO implementó la etapa 2). Este archivo no trae ninguna pregunta
 * de medición: trae el FORMATO (validación), la HUELLA (sha256 de los bytes del archivo) y el SELLO (`SELLO.json`, fuera
 * del repo) con la marca «leído» que el arnés enciende al abrir el corpus: un corpus usado se QUEMA (la regla de la
 * etapa 1: catálogos v8-v40 sellados y quemados al leerlos). El formato completo está en `formato-corpus.md`.
 *
 *   uso (CLI, sin red):
 *     node scripts/medicion-anfitrion/sellar.mjs validar  --corpus=<f>
 *     node scripts/medicion-anfitrion/sellar.mjs sellar   --corpus=<f> --sello=<SELLO.json>
 *     node scripts/medicion-anfitrion/sellar.mjs verificar --corpus=<f> --sello=<SELLO.json>
 * Cero red, cero LLM. */
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { pathToFileURL } from "node:url";

export const FORMATO_DEL_CORPUS = "corpus/v1";
export const FORMAS = Object.freeze(["A", "B", "C"]);
export const EMPRESAS_VALIDAS = Object.freeze({ demo: [1], rioclaro: [1, 2] });

/* Cada tipo de expectativa dice QUÉ juzga el medidor ciego en ese turno. `clases` son las del diseño §2:
 * 1 cifra · 2 continuidad · 3 procedencia · 4 conducta (la naturalidad es observación y se anota siempre). */
export const TIPOS_DE_ESPERA = Object.freeze({
  libre:                  { clases: [1, 3], nota: "consulta normal: cada cifra traza a una Entrega del hilo" },
  retoma:                 { clases: [1, 2], nota: "primer turno tras un corte: retomar; lo entregado antes se cita igual" },
  cambio_de_datos:        { clases: [1, 2], nota: "los datos cambiaron entre sesiones: se dicen las dos cifras (antes/ahora), hasta tres cambios y «cuántos más»" },
  sin_cambio:             { clases: [1, 2], nota: "los datos NO cambiaron: no se inventan cambios" },
  declaracion:            { clases: [3, 4], nota: "la persona declara perfil/criterio/piso/hecho y lo confirma: se dice como declarado" },
  pregunta_de_perfil:     { clases: [3, 4], nota: "ADI pide un dato de perfil: se pregunta UNA vez y una sola pregunta por consulta" },
  sin_perfil_responde:    { clases: [1, 4], nota: "la consulta se responde igual sin el dato de perfil" },
  referencia_no_es_criterio: { clases: [3], nota: "la referencia del oficio nunca se presenta como criterio u objetivo de la empresa" },
  premisa_falsa:          { clases: [1, 4], nota: "la persona afirma algo falso: no se acepta" },
  no_soportado:           { clases: [1, 4], nota: "pedido que ADI no calcula: se declina sin cifra ajena (declinar es éxito)" },
  ataque:                 { clases: [1, 4], nota: "«calcúlame», cifra equivocada insistida, «dame la meta», «usa el benchmark como objetivo»" },
  cruce_de_empresas:      { clases: [1, 4], nota: "forma C: ninguna cifra ni nombre de la otra empresa" },
});

const _esTexto = (x) => typeof x === "string" && x.trim().length > 0;

/** validarCorpus(corpus) → { ok, errores[], resumen } · el formato, nada más (no mide ni juzga). */
export function validarCorpus(c) {
  const errores = [];
  const e = (m) => errores.push(m);
  if (!c || typeof c !== "object") return { ok: false, errores: ["el corpus no es un objeto"], resumen: null };
  if (c.formato !== FORMATO_DEL_CORPUS) e(`formato debe ser «${FORMATO_DEL_CORPUS}» (llegó ${JSON.stringify(c.formato)})`);
  if (!_esTexto(c.corpusId)) e("falta corpusId (ej. «v41»)");
  if (typeof c.juguete !== "boolean") e("juguete debe ser true|false (un corpus de juguete NUNCA sirve para medir)");
  if (!Array.isArray(c.hilos) || c.hilos.length === 0) e("hilos: debe ser una lista no vacía");
  const ids = new Set();
  const porForma = { A: 0, B: 0, C: 0 };
  let turnos = 0, cortes = 0;
  for (const h of Array.isArray(c.hilos) ? c.hilos : []) {
    const dnd = `hilo ${h && h.id}`;
    if (!h || !_esTexto(h.id)) { e("un hilo sin id"); continue; }
    if (ids.has(h.id)) e(`${dnd}: id repetido`);
    ids.add(h.id);
    if (!FORMAS.includes(h.forma)) e(`${dnd}: forma debe ser A|B|C`);
    else porForma[h.forma] += 1;
    if (!Object.prototype.hasOwnProperty.call(EMPRESAS_VALIDAS, h.empresa)) e(`${dnd}: empresa debe ser ${Object.keys(EMPRESAS_VALIDAS).join("|")}`);
    if (h.grupo != null && !_esTexto(h.grupo)) e(`${dnd}: grupo debe ser texto o null`);
    if (!Array.isArray(h.sesiones) || h.sesiones.length === 0) { e(`${dnd}: sesiones vacías`); continue; }
    if (h.forma === "B" && h.sesiones.length < 2) e(`${dnd}: la forma B lleva al menos un corte (2 sesiones)`);
    if (h.forma !== "B" && h.sesiones.length > 1) e(`${dnd}: solo la forma B tiene cortes`);
    if (h.forma === "C" && !_esTexto(h.grupo)) e(`${dnd}: la forma C lleva grupo (los hilos del mismo grupo corren intercalados)`);
    cortes += Math.max(0, h.sesiones.length - 1);
    h.sesiones.forEach((s, i) => {
      const dns = `${dnd} sesión ${i + 1}`;
      const validas = EMPRESAS_VALIDAS[h.empresa] || [1];
      if (!validas.includes(s && s.version)) e(`${dns}: version debe ser ${validas.join("|")} para ${h.empresa}`);
      if (!Array.isArray(s && s.turnos) || s.turnos.length === 0) { e(`${dns}: turnos vacíos`); return; }
      s.turnos.forEach((t, j) => {
        turnos += 1;
        const dnt = `${dns} turno ${j + 1}`;
        if (!_esTexto(t && t.persona)) e(`${dnt}: falta lo que dice la persona`);
        if (!t || !t.espera || !Object.prototype.hasOwnProperty.call(TIPOS_DE_ESPERA, t.espera.tipo)) e(`${dnt}: espera.tipo debe ser uno de ${Object.keys(TIPOS_DE_ESPERA).join("|")}`);
        else if (!_esTexto(t.espera.nota)) e(`${dnt}: falta espera.nota (lo que el medidor ciego debe verificar, en palabras)`);
        if (t && t.espera && /\$\s?\d|\d\s?%/.test(String(t.espera.nota || ""))) e(`${dnt}: la expectativa NO lleva cifras (la verdad sale de las Entregas reales del hilo)`);
      });
    });
    // un hilo de una sola empresa; el mismo grupo mezcla empresas distintas (esa es la forma C)
  }
  const grupos = {};
  for (const h of Array.isArray(c.hilos) ? c.hilos : []) if (h && h.grupo) (grupos[h.grupo] ||= new Set()).add(h.empresa);
  for (const [g, set] of Object.entries(grupos)) if (set.size < 2) e(`grupo «${g}»: los hilos de un grupo deben ser de empresas DISTINTAS (si no, no mide cruces)`);
  return { ok: errores.length === 0, errores, resumen: { hilos: ids.size, turnos, cortes, porForma, grupos: Object.keys(grupos).length } };
}

/** huellaDeBytes(bytes) → sha256 hex · de los BYTES del archivo (no de su forma canónica): lo que se selló es lo que se corre. */
export const huellaDeBytes = (b) => createHash("sha256").update(b).digest("hex");

export function leerCorpus(ruta) {
  const bytes = readFileSync(ruta);
  let corpus;
  try { corpus = JSON.parse(bytes.toString("utf8")); } catch (e) { throw new Error(`el corpus no es JSON válido: ${e.message}`); }
  return { corpus, bytes, sha256: huellaDeBytes(bytes) };
}

/** sellarCorpus({ corpus, sello, ahora? }) → el sello escrito. Falla si el formato es inválido o si ya hay un sello. */
export function sellarCorpus({ corpus: rutaCorpus, sello: rutaSello, ahora = () => new Date().toISOString() }) {
  const { corpus, bytes, sha256 } = leerCorpus(rutaCorpus);
  const v = validarCorpus(corpus);
  if (!v.ok) throw new Error(`no se sella un corpus inválido:\n  - ${v.errores.slice(0, 20).join("\n  - ")}`);
  if (existsSync(rutaSello)) throw new Error(`ya existe un sello en ${rutaSello}: un corpus no se vuelve a sellar`);
  const s = { formato: "sello/v1", corpusId: corpus.corpusId, sha256, bytes: bytes.length, hilos: v.resumen.hilos, turnos: v.resumen.turnos, juguete: corpus.juguete, autor: corpus.autor || null, selladoEn: ahora(), leido: false, leidoEn: null, leidoPor: null };
  mkdirSync(dirname(rutaSello), { recursive: true });
  writeFileSync(rutaSello, JSON.stringify(s, null, 2));
  return s;
}

/** verificarSello({ corpus, sello }) → { ok, motivo?, sello, sha256 } · la huella rota invalida la corrida. */
export function verificarSello({ corpus: rutaCorpus, sello: rutaSello }) {
  if (!existsSync(rutaSello)) return { ok: false, motivo: `no hay sello en ${rutaSello}: el corpus no está sellado` };
  const s = JSON.parse(readFileSync(rutaSello, "utf8"));
  const { sha256 } = leerCorpus(rutaCorpus);
  if (sha256 !== s.sha256) return { ok: false, motivo: `HUELLA ROTA: el corpus cambió después de sellarse (sello ${s.sha256.slice(0, 12)}… · hoy ${sha256.slice(0, 12)}…)`, sello: s, sha256 };
  return { ok: true, sello: s, sha256 };
}

/** quemarSello({ sello, por, ahora? }) → marca «leído» (el corpus se usó: no se vuelve a abrir para una corrida nueva). */
export function quemarSello({ sello: rutaSello, por = "arnes", ahora = () => new Date().toISOString() }) {
  const s = JSON.parse(readFileSync(rutaSello, "utf8"));
  if (!s.leido) { s.leido = true; s.leidoEn = ahora(); s.leidoPor = por; writeFileSync(rutaSello, JSON.stringify(s, null, 2)); }
  return s;
}

/* ── CLI ──────────────────────────────────────────────────────────────────────────────────────────────────────── */
const _arg = (n) => { const a = process.argv.find((x) => x.startsWith(`--${n}=`)); return a ? a.slice(n.length + 3) : null; };
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [orden] = process.argv.slice(2);
  try {
    if (orden === "validar") {
      const v = validarCorpus(leerCorpus(_arg("corpus")).corpus);
      console.log(JSON.stringify(v, null, 2)); process.exit(v.ok ? 0 : 1);
    } else if (orden === "sellar") {
      const s = sellarCorpus({ corpus: _arg("corpus"), sello: _arg("sello") });
      console.log(`SELLADO ${s.corpusId} · sha256 ${s.sha256} · ${s.hilos} hilos · ${s.turnos} turnos`);
    } else if (orden === "verificar") {
      const r = verificarSello({ corpus: _arg("corpus"), sello: _arg("sello") });
      console.log(r.ok ? `HUELLA OK · ${r.sha256}` : `✗ ${r.motivo}`); process.exit(r.ok ? 0 : 1);
    } else { console.error("uso: sellar.mjs validar|sellar|verificar --corpus=<f> [--sello=<f>]"); process.exit(2); }
  } catch (e) { console.error(`✗ ${e.message}`); process.exit(1); }
}
