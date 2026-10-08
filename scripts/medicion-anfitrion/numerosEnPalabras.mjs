/* === scripts/medicion-anfitrion/numerosEnPalabras.mjs · LOS NÚMEROS EN PALABRAS DEL RASTREO (Contrato del Anfitrión · owner 2026-10-05) ═════════════════════
 * `_ADI_DISENO_CONTRATO_ANFITRION.md` §3: el ensayo 3 mostró dos errores graves que el rastreo no veía porque estaban escritos con letras («Ocho de los 13…», «5 de las 9»). El contrato dice «en números o en palabras»: la
 * MEDICIÓN las lee. Es medición, no producto: ADI no lee prosa jamás; el rastreo sí, con reglas, y lo que no sabe leer —«varios», «la mayoría», «casi todos», «unos cuantos»— va al juez.
 *
 * Qué entiende (lista CERRADA):
 *   · cardinales 0–99 (cero, dos… noventa y nueve; «un/uno/una» NO: «una cuenta» no es una cifra), «cien/ciento», y las escalas «mil» y «millón/millones» («cuatro millones», «dos mil»);
 *   · con su unidad cuando la trae («ocho por ciento», «tres días», «doce puntos», «cuatro millones»): son números como los de cifras;
 *   · fracciones: SE IMPORTA la tabla de la casa (`COTAS_DE_PROPORCION`, Notario v3.1: mitad · tercio · cuarto · dos tercios · tres cuartos · casi la mitad) — no se escribe otra;
 *   · múltiplos: doble · triple · cuádruple y sus verbos (duplica, triplica…), con la misma tabla de la casa (`FRACCIONES_EN_PALABRAS`), con «casi» y «más del». El múltiplo a secas conserva ±15 % (v3.1).
 * Todo número en palabras sale con la MISMA forma que un número en cifras (`extraerNumeros`): el rastreo no tiene dos caminos. */
import { COTAS_DE_PROPORCION, FRACCIONES_EN_PALABRAS } from "../../src/adi/notario/lexico.js";

/** interruptores de ANÁLISIS (como `REGLAS` del rastreo): apagar uno muestra qué marcas vuelven. En la medición, todos encendidos. */
export const REGLAS_DE_PALABRAS = { ordinal: true, desigualdad: true };
const sinAcento = (s) => String(s).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

const ENTEROS = {
  cero: 0, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8, nueve: 9, diez: 10, once: 11, doce: 12, trece: 13, catorce: 14, quince: 15,
  dieciseis: 16, diecisiete: 17, dieciocho: 18, diecinueve: 19, veinte: 20, veintiun: 21, veintiuno: 21, veintidos: 22, veintitres: 23, veinticuatro: 24, veinticinco: 25,
  veintiseis: 26, veintisiete: 27, veintiocho: 28, veintinueve: 29,
};
const DECENAS = { treinta: 30, cuarenta: 40, cincuenta: 50, sesenta: 60, setenta: 70, ochenta: 80, noventa: 90 };
const UNIDADES_DE_COMPUESTO = { un: 1, uno: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8, nueve: 9 };

/* las palabras del texto, con su posición en el original (los acentos no cambian el largo) */
function palabrasDe(texto) {
  const out = [];
  const rx = /[\p{L}]+/gu;
  let m;
  while ((m = rx.exec(texto))) out.push({ w: sinAcento(m[0]), indice: m.index, fin: m.index + m[0].length });
  return out;
}

/* 0–99 desde la palabra i → { valor, n } | null */
function _hasta99(P, i) {
  const w = P[i] && P[i].w;
  if (!w) return null;
  if (Object.prototype.hasOwnProperty.call(ENTEROS, w)) return { valor: ENTEROS[w], n: 1 };
  if (Object.prototype.hasOwnProperty.call(DECENAS, w)) {
    if (P[i + 1] && P[i + 1].w === "y" && P[i + 2] && Object.prototype.hasOwnProperty.call(UNIDADES_DE_COMPUESTO, P[i + 2].w)) return { valor: DECENAS[w] + UNIDADES_DE_COMPUESTO[P[i + 2].w], n: 3 };
    return { valor: DECENAS[w], n: 1 };
  }
  return null;
}

const _ESCALAS = { mil: 1e3, millon: 1e6, millones: 1e6 };
const _SUSTANTIVOS_DE_CONTEO = new Set(["unidades", "clientes", "cuentas", "skus", "sku", "productos", "bodegas", "marcas", "familias", "facturas", "proveedores", "casos"]);

/** extraerNumerosEnPalabras(texto) → tokens con la MISMA forma que `rastreo.mjs:extraerNumeros` ({crudo, indice, fin, unidad, candidatos:[{valor, unc}], dolar, sufijo, sinUnidad}) + `enPalabras:true` y `valorEntero`.
 *  «ocho» → count (sin unidad) · «ocho por ciento» → pct · «tres días» → days · «doce puntos» → pp · «cuatro millones» / «dos mil» → money (o count si siguen «unidades», «clientes»…). */
export function extraerNumerosEnPalabras(texto) {
  const P = palabrasDe(String(texto || ""));
  const out = [];
  for (let i = 0; i < P.length; i++) {
    let valor = null, n = 0;
    if (P[i].w === "cien" || P[i].w === "ciento") {
      valor = 100; n = 1;
      if (P[i].w === "ciento") { const r = _hasta99(P, i + 1); if (r) { valor = 100 + r.valor; n = 1 + r.n; } }
    } else {
      const r = _hasta99(P, i);
      if (!r) continue;
      valor = r.valor; n = r.n;
    }
    // una escala: «cuatro millones», «dos mil» (y «dos mil quinientos»: la parte menor se suma)
    let escala = 1, j = i + n;
    if (P[j] && Object.prototype.hasOwnProperty.call(_ESCALAS, P[j].w)) { escala = _ESCALAS[P[j].w]; valor *= escala; n += 1; j += 1; }
    const sig = P[j] ? P[j].w : "", sig2 = P[j + 1] ? P[j + 1].w : "";
    let unidad = "count", saltar = 0, sinUnidad = true;
    if (sig === "por" && sig2 === "ciento") { unidad = "pct"; saltar = 2; sinUnidad = false; }
    else if (sig === "dias" || sig === "dia") { unidad = "days"; saltar = 1; sinUnidad = false; }
    else if (sig === "puntos" || sig === "punto") { unidad = "pp"; saltar = (sig2 === "porcentuales" || sig2 === "porcentual") ? 2 : 1; sinUnidad = false; }
    else if (escala > 1) { unidad = _SUSTANTIVOS_DE_CONTEO.has(sig) ? "count" : "money"; sinUnidad = false; }
    const fin = P[j + saltar - 1] ? P[j + saltar - 1].fin : P[i + n - 1].fin;
    const uncEscala = escala > 1 ? 0.5 * escala : 0.5;
    out.push({
      crudo: String(texto).slice(P[i].indice, fin).trim(), indice: P[i].indice, fin, unidad, candidatos: [{ valor, unc: uncEscala }],
      dolar: false, sufijo: null, sinUnidad, enPalabras: true, valorEntero: valor,
    });
    i += n + saltar - 1;
  }
  return out;
}

/* ═══ FRACCIONES Y MÚLTIPLOS ═══════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════ */
/* de la tabla de la casa solo las cotas NUMÉRICAS: «la mayoría», «casi todos», «unos cuantos», «un puñado» son léxico subjetivo y van al juez (decisión del diseño §3) */
const _COTAS_NUMERICAS = COTAS_DE_PROPORCION.filter((c) => /^(la mitad|casi la mitad|un tercio|dos tercios|un cuarto|tres cuartos)\b/.test(c.nombre));
const _FACTOR = { doble: FRACCIONES_EN_PALABRAS.doble, triple: FRACCIONES_EN_PALABRAS.triple, cuadruple: FRACCIONES_EN_PALABRAS.cuadruple };
const _VERBO_DE_MULTIPLO = /^(duplic|triplic|cuadruplic)/;

/* LA DESIGUALDAD ESTRICTA (owner 2026-10-07, ensayos 4-5): «Makita vende MENOS QUE LA MITAD de Bosch», «Jumbo vende MÁS QUE EL DOBLE que Sodimac» no dicen «es la mitad» ni «es el doble»: dicen que el sujeto queda por debajo / por encima del valor nominal.
 * Un modificador antes de la fracción o del múltiplo la vuelve desigualdad (`desigualdad: "menor"|"mayor"`, `nominal`): se juzga contra el nominal, EN EL SENTIDO del sujeto (la cuenta que la oración nombra antes) sobre la base (la que nombra después), no como el rango
 * simétrico de «es la mitad». */
const _NOMINAL_DE_FRACCION = [[/^dos tercios/, 2 / 3], [/^tres cuartos/, 0.75], [/(^| )la mitad/, 0.5], [/(^| )(un|el) tercio|tercera parte/, 1 / 3], [/(^| )(un|el) cuarto|cuarta parte/, 0.25]];
const _nominalDe = (nombre) => { const n = String(nombre).replace(/\s*\(.*$/, ""); const x = _NOMINAL_DE_FRACCION.find(([rx]) => rx.test(n)); return x ? x[1] : null; };
/** el modificador de desigualdad que precede a la palabra i: { sentido:"menor"|"mayor", desde } | null · «menos que/de/del», «más que/de/del», «por debajo de», «por encima de», «bajo», «sobre», «inferior a», «superior a» */
function _desigualdadAntes(P, i) {
  const w = (k) => (P[k] ? P[k].w : "");
  if (["que", "de", "del"].includes(w(i - 1)) && w(i - 2) === "menos") return { sentido: "menor", desde: i - 2 };
  if (["que", "de", "del"].includes(w(i - 1)) && w(i - 2) === "mas") return { sentido: "mayor", desde: i - 2 };
  if (w(i - 1) === "de" && w(i - 2) === "debajo" && w(i - 3) === "por") return { sentido: "menor", desde: i - 3 };
  if (w(i - 1) === "de" && w(i - 2) === "encima" && w(i - 3) === "por") return { sentido: "mayor", desde: i - 3 };
  if (w(i - 1) === "a" && w(i - 2) === "inferior") return { sentido: "menor", desde: i - 2 };
  if (w(i - 1) === "a" && w(i - 2) === "superior") return { sentido: "mayor", desde: i - 2 };
  if (w(i - 1) === "bajo") return { sentido: "menor", desde: i - 1 };
  if (w(i - 1) === "sobre") return { sentido: "mayor", desde: i - 1 };
  return null;
}

/** relacionesEnPalabras(texto) → [{ frase, tipo:"fraccion"|"multiplo", lo, hi, nombre, indice, fin, desigualdad?, nominal?, indiceNucleo, finNucleo }] · la relación dicha con letras («la mitad», «tres cuartos», «el doble», «casi duplica»), con el rango que le fija la casa
 *  (para una fracción, la razón menor/mayor; para un múltiplo, la razón mayor/menor). «el cuarto» a secas es un ORDINAL («el cuarto, Sodimac»), no la fracción 1/4: la fracción es «un cuarto» o «el cuarto de la/del …». */
export function relacionesEnPalabras(texto) {
  const P = palabrasDe(String(texto || ""));
  const out = [];
  const original = String(texto || "");
  /* fracciones: ventanas de 1 a 4 palabras contra la tabla importada (cada regex de la tabla es de la frase entera) */
  for (let i = 0; i < P.length; i++) {
    for (let largo = 4; largo >= 1; largo--) {
      if (!P[i + largo - 1]) continue;
      const frase = original.slice(P[i].indice, P[i + largo - 1].fin);
      const cota = _COTAS_NUMERICAS.find((c) => c.re.test(frase.trim().replace(/\s+/g, " ")));
      if (cota) {
        /* «el cuarto»: ordinal salvo que siga «de la / de lo / del» (el cuarto de la venta); «el cuarto de los 13 clientes» es de nuevo el puesto */
        const sigue = P[i + largo], sigue2 = P[i + largo + 1];
        if (REGLAS_DE_PALABRAS.ordinal && /^el\s+cuarto$/i.test(frase.trim()) && !(sigue && (sigue.w === "del" || (sigue.w === "de" && sigue2 && ["la", "lo"].includes(sigue2.w))))) {
          /* se devuelve MARCADA como ordinal (no como fracción): quien juzga la descarta, pero conserva su lugar en la numeración de las afirmaciones (los ids de una revisión humana no se corren) */
          out.push({ frase, tipo: "ordinal", ordinal: true, lo: 0, hi: 0, nombre: "el cuarto (ordinal)", indice: P[i].indice, fin: P[i + largo - 1].fin, indiceNucleo: P[i].indice, finNucleo: P[i + largo - 1].fin });
          i += largo - 1; break;
        }
        const des = REGLAS_DE_PALABRAS.desigualdad && !/^casi/i.test(cota.nombre) ? _desigualdadAntes(P, i) : null;
        const nominal = des ? _nominalDe(cota.nombre) : null;
        const ini = des && nominal != null ? P[des.desde].indice : P[i].indice;
        out.push({ frase: original.slice(ini, P[i + largo - 1].fin), tipo: "fraccion", lo: cota.lo, hi: cota.hi, nombre: cota.nombre, indice: ini, fin: P[i + largo - 1].fin, indiceNucleo: P[i].indice, finNucleo: P[i + largo - 1].fin, ...(des && nominal != null ? { desigualdad: des.sentido, nominal } : {}) });
        i += largo - 1; break;
      }
    }
  }
  /* múltiplos: «el doble», «casi el doble», «más del doble», «triple», «duplica», «casi triplica» */
  for (let i = 0; i < P.length; i++) {
    const w = P[i].w;
    let factor = null, ini = i, fin = P[i].fin;
    if (Object.prototype.hasOwnProperty.call(_FACTOR, w)) factor = _FACTOR[w];
    else if (_VERBO_DE_MULTIPLO.test(w)) factor = w.startsWith("duplic") ? _FACTOR.doble : w.startsWith("triplic") ? _FACTOR.triple : _FACTOR.cuadruple;
    if (factor == null) continue;
    let modo = "exacto";
    const p1 = P[i - 1] && P[i - 1].w, p2 = P[i - 2] && P[i - 2].w, p3 = P[i - 3] && P[i - 3].w;
    if (p1 === "casi" || (p1 === "el" && p2 === "casi")) { modo = "casi"; ini = p1 === "casi" ? i - 1 : i - 2; }
    else if (p1 === "del" && p2 === "mas") { modo = "mas_del"; ini = i - 2; }
    else if (REGLAS_DE_PALABRAS.desigualdad && p1 === "el" && ["que", "de"].includes(p2) && p3 === "mas") { modo = "mas_del"; ini = i - 3; }       // «más que el doble»
    else if (REGLAS_DE_PALABRAS.desigualdad && p1 === "del" && p2 === "menos") { modo = "menos_del"; ini = i - 2; }
    else if (REGLAS_DE_PALABRAS.desigualdad && p1 === "el" && ["que", "de"].includes(p2) && p3 === "menos") { modo = "menos_del"; ini = i - 3; }
    const lo = modo === "casi" ? 0.9 * factor : modo === "mas_del" ? factor : modo === "menos_del" ? 0 : 0.85 * factor;
    const hi = modo === "casi" ? factor : modo === "mas_del" ? Infinity : modo === "menos_del" ? factor : 1.15 * factor;
    const prefijo = modo === "casi" ? "casi " : modo === "mas_del" ? "más del " : modo === "menos_del" ? "menos del " : "";
    out.push({ frase: original.slice(P[ini].indice, fin), tipo: "multiplo", lo, hi, nombre: prefijo + w, indice: P[ini].indice, fin, indiceNucleo: P[i].indice, finNucleo: fin, ...(modo === "mas_del" || modo === "menos_del" ? { desigualdad: modo === "mas_del" ? "mayor" : "menor", nominal: factor } : {}) });
  }
  return out;
}
