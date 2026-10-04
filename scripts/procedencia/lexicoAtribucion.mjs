/* === scripts/procedencia/lexicoAtribucion.mjs · EL ORÁCULO DE ATRIBUCIÓN POR SIGNIFICADO (Etapa 2, bloque 3 · segunda vuelta, owner 2026-10-03, decisión §7.3·58) ═════════════
 * Atribuirle a la empresa algo que no declaró NO es solo la frase «declarado por la empresa»: es CUALQUIER forma de decir que el criterio es suyo —«declarado», «lo declaró», «que declaraste», «tienes declarado»,
 * «de la empresa», «tu benchmark», «su nivel»…— pegada a una referencia, un umbral o un supuesto. Este archivo es el ÚNICO lugar donde vive ese léxico, como DATOS (el gate y la medición lo leen; ninguna regex
 * suelta fuera de aquí). Lee el TEXTO de la Entrega, nunca el código que lo escribió: así el oráculo y el producto no pueden estar equivocados de la misma manera.
 *
 *   MARCADORES  · las formas que atribuyen (cada una con su id de forma).
 *   SUJETOS     · lo que se atribuye (referencia, umbral, supuesto) y la llave de POLICY a la que apunta (SIMULACION = un supuesto: NUNCA es de la empresa).
 *   EXCLUSIONES · lo que contiene un marcador pero NO atribuye (una negación, la ausencia declarada, una definición genérica, otra clase de «declarado»): cada una con su porqué.
 *   FORMAS_PENDIENTES · formas que SÍ atribuyen y que no se pueden cambiar sin tocar algo fuera de lo aprobado (el rótulo de la cifra es el de la boleta, el glosario de Sentrix): se cuentan aparte y se declaran.
 * Puro: sin red, sin importar nada del producto. */

const FIN = "(?![\\wáéíóúñ])";   /* fin de palabra con letras acentuadas (el \b de JS no ve «ó» como letra) */

/** las formas que atribuyen a la empresa. `patron` es el texto de una expresión regular (datos), `flags` sus banderas. */
export const MARCADORES = Object.freeze([
  { forma: "declarado", patron: "declarad[oa]s?" + FIN, flags: "gi" },                                      /* «declarado por la empresa», «nivel declarado», «piso de rotación declarado» */
  { forma: "lo_declaro", patron: "declar(?:ó|aron|aste|as)" + FIN, flags: "gi" },                           /* «lo declaró la empresa», «que la empresa declaró», «que declaraste» */
  { forma: "tienes_declarado", patron: "tienes\\s+declarad[oa]" + FIN, flags: "gi" },                      /* «tienes declarado» (la forma de trato) */
  { forma: "de_la_empresa", patron: "\\bde\\s+la\\s+empresa" + FIN, flags: "gi" },                         /* «benchmark de la empresa», «referencia de la empresa» */
  { forma: "posesivo", patron: "\\b(?:tu|tus|su|sus|nuestr[oa]s?)\\s+(?=(?:benchmark|nivel|piso|techo|umbral|referencia|meta|objetivo|supuesto)" + FIN + ")", flags: "gi" },   /* «tu benchmark», «su nivel» */
  { forma: "propio", patron: "\\b(?:benchmark|nivel|piso|techo|umbral|criterio|supuesto)\\s+propi[oa]s?" + FIN, flags: "gi" },   /* «benchmark propio» */
]);

/** lo que se atribuye: la palabra que lo nombra y la llave que designa. `SIMULACION` = un supuesto de simulación (jamás es una declaración de la empresa). */
export const SUJETOS = Object.freeze([
  { clave: "benchmark", patron: "benchmark", flags: "i" },
  { clave: "targetCarga", patron: "nivel\\s+(?:de\\s+carga|declarado|de\\s+referencia)|carga\\s+comercial\\s+alta", flags: "i" },
  { clave: "quiebreDohMax", patron: "techo\\s+de\\s+quiebre", flags: "i" },
  { clave: "quiebreRotMin", patron: "piso\\s+de\\s+quiebre", flags: "i" },
  { clave: "rotacionMin", patron: "(?<!quiebre\\s)(?:piso\\s+de\\s+rotaci[oó]n|rotaci[oó]n\\s+m[ií]nima)", flags: "i" },
  { clave: "dohMax", patron: "techo\\s+de\\s+(?:cobertura|d[ií]as)|cobertura\\s+m[aá]xima", flags: "i" },
  { clave: "sobrestockDohMin", patron: "sobrestock", flags: "i" },
  { clave: "materialidadFocoPctVenta", patron: "materialidad", flags: "i" },
  { clave: "frenadoDiasSinVenta", patron: "(?:umbral|criterio)\\s+de\\s+(?:venta\\s+)?frenad", flags: "i" },
  { clave: "SIMULACION", patron: "supuesto|simulaci[oó]n", flags: "i" },
  { clave: "REFERENCIA", patron: "referencia|umbral|criterio\\s+de\\s+inventario", flags: "i" },   /* una referencia dicha a secas: no se sabe de cuál llave, no cuenta como falsa por sí sola */
]);

/** lo que contiene un marcador pero NO atribuye. Cada exclusión dice por qué; se aplica sobre la CLÁUSULA entera. */
export const EXCLUSIONES = Object.freeze([
  { id: "negacion", porque: "negar la atribución no es atribuir («no es un dato ni un objetivo de la empresa»)", patron: "(?:\\bno|\\bni)\\s+(?:es|son|ha|han)" + FIN + "[^.;]{0,50}(?:de\\s+la\\s+empresa|declarad[oa]s?)" + FIN, flags: "i" },
  { id: "ausencia", porque: "decir que NO hay declaración es lo contrario de atribuir («sin umbral declarado», «la empresa no ha declarado»)", patron: "\\bsin\\s+(?:\\w+\\s+){0,3}declarad[oa]s?" + FIN + "|\\bno\\s+(?:ha|han|se)\\s+declarad[oa]s?" + FIN + "|\\bno\\s+declar(?:ó|aron|a)" + FIN + "|\\bsin\\s+declarar" + FIN, flags: "i" },
  { id: "glosario_generico", porque: "la definición del glosario nombra las DOS posibilidades («puede ser el declarado por la empresa o el general de ADI»)", patron: "puede\\s+ser\\s+el\\s+declarado\\s+por\\s+la\\s+empresa\\s+o\\s+el\\s+general", flags: "i" },
  { id: "umbral_con_su_origen", porque: "«el umbral declarado» seguido de su origen explícito nombra el concepto y dice de dónde sale («sobre el umbral declarado, criterio general de ADI»)", patron: "umbral\\s+declarado\\s*(?:\\(empresa\\s+o\\s+consulta\\)|,\\s*(?:declarado|criterio\\s+general|planteado|sin\\s+umbral))", flags: "i" },
  { id: "cobertura_de_fuentes", porque: "«cobertura declarada» es la cobertura de la fuente de una cifra, no una referencia de la empresa", patron: "cobertura\\s+declarada", flags: "i" },
  { id: "otro_declarado", porque: "«universo/premisa/ausencia/parte declarada» es lo que la Entrega o el encargo declaran, no una referencia de la empresa", patron: "(?:universo|premisa|ausencia|parte|conjunto|hueco|l[ií]mite|concepto)\\s+declarad[oa]|\\bse\\s+declara|\\bdeclara\\s+que|declarad[oa]\\s+(?:aparte|en\\s+el\\s+Marco|en\\s+esta)", flags: "i" },
]);

/** formas que SÍ atribuyen y que no se corrigen en esta vuelta (se cuentan aparte y se declaran): su porqué y quién decide. */
export const FORMAS_PENDIENTES = Object.freeze([
  { id: "rotulo_de_cifra", porque: "«Nivel de carga declarado» es el RÓTULO de la cifra en la boleta (y el nombre de la métrica en el léxico): cambiarlo cambia la boleta del agente y el casado del Notario", patron: "nivel\\s+de\\s+carga\\s+declarad[oa]" + FIN, flags: "i", reemplazo: "nivel de carga" },
  { id: "glosario_sentrix", porque: "el glosario de Sentrix (fuera de alcance de esta vuelta) dice «la referencia declarada», «la referencia que la empresa declaró para este análisis», «objetivo declarado», «umbrales declarados»", patron: "la\\s+referencia\\s+declarada\\s*:|cuando\\s+est[aá]\\s+declarada|es\\s+la\\s+referencia\\s+que\\s+la\\s+empresa\\s+declar[oó]\\s+para\\s+este\\s+an[aá]lisis|su\\s+referencia\\s+declarada|una\\s+referencia\\s+declarada,\\s+no\\s+observada|valor\\s+objetivo\\s+declarado|conviven\\s+dos\\s+umbrales\\s+declarados", flags: "i", reemplazo: " " },
]);

/** las formas FIJAS que atribuyen a la empresa y que ya no se escriben a mano en ningún composer: solo viven en la tabla única (`businessPolicy.js:NOMBRES_SEGUN_ORIGEN`, ETIQUETA_ORIGEN). El barrido del gate pone en rojo si reaparecen en `src/` fuera de ahí. */
export const FRASES_FIJAS = Object.freeze([
  "lo declaró la empresa", "benchmark de la empresa", "benchmark que la empresa declaró", "techo de cobertura de la empresa", "piso de rotación declarado", "umbral de venta frenada declarado",
]);

const reDe = (d, extra = "") => new RegExp(d.patron, [...new Set((d.flags + extra).split(""))].join(""));
const SUJ = SUJETOS.map((d) => ({ clave: d.clave, re: reDe(d) }));
const EXC = EXCLUSIONES.map((d) => ({ id: d.id, re: reDe(d) }));
const REFERENCIA_A_SECAS = SUJ.find((s) => s.clave === "REFERENCIA").re;

/** las llaves a las que apunta un fragmento, por sus SUJETOS (SIMULACION si habla de un supuesto/simulación; las tres de inventario si dice «criterio de inventario» sin un sujeto más preciso) */
export function clavesDe(fragmento) {
  const k = new Set();
  const c = String(fragmento || "");
  for (const s of SUJ) if (s.clave !== "REFERENCIA" && s.re.test(c)) k.add(s.clave);
  if (k.has("quiebreDohMax") || k.has("quiebreRotMin")) { k.delete("dohMax"); k.delete("rotacionMin"); }
  if (!k.size && /criterio\s+de\s+inventario/i.test(c)) ["rotacionMin", "dohMax", "sobrestockDohMin"].forEach((x) => k.add(x));
  if (!k.size && REFERENCIA_A_SECAS.test(c)) k.add("REFERENCIA");
  return k;
}
/** clavesCercanas(fragmento) → la llave del sujeto MÁS CERCANO al final del fragmento (el que la marca califica: «…en sobrestock con esa referencia (contra 9 con el techo de cobertura de la empresa)» es del techo, no del sobrestock) */
export function clavesCercanas(fragmento) {
  const c = String(fragmento || "");
  let mejor = -1; const k = new Set();
  for (const s of SUJ) {
    if (s.clave === "REFERENCIA") continue;
    const g = new RegExp(s.re.source, s.re.flags.includes("g") ? s.re.flags : s.re.flags + "g"); let m, fin = -1;
    while ((m = g.exec(c))) fin = m.index + m[0].length;
    if (fin > mejor) { mejor = fin; k.clear(); k.add(s.clave); } else if (fin === mejor && fin >= 0) k.add(s.clave);
  }
  if (k.has("quiebreDohMax") || k.has("quiebreRotMin")) { k.delete("dohMax"); k.delete("rotacionMin"); }
  return k.size ? k : clavesDe(c);
}
/* el texto partido en cláusulas (punto, punto y coma, salto de línea, barra de tabla, paréntesis que cierra) */
const clausulas = (texto) => String(texto || "").split(/(?<=[.;])\s|\n|\||(?<=\))\s/).map((x) => x.trim()).filter(Boolean);
/* el sujeto va ANTES de la marca («el techo de cobertura de la empresa»); solo el posesivo lo trae después («tu benchmark») */
const ventana = (cl, idx, largo, despues = 0) => cl.slice(Math.max(0, idx - 70), idx + largo + despues);

/** atribuciones(texto) → [{ forma, claves, clausula, tipo: "empresa"|"adi"|"pendiente" }]
 *  `empresa` = algún marcador pegado a un sujeto, sin exclusión; `adi` = dice «general de ADI» junto a una llave (para el control inverso); `pendiente` = una forma declarada pendiente (se cuenta aparte). */
export function atribuciones(texto) {
  const out = [];
  for (const cl0 of clausulas(texto)) {
    /* lo que es una forma pendiente se cuenta aparte y se RETIRA de la cláusula: el resto se juzga por sí mismo */
    let cl = cl0;
    for (const p of FORMAS_PENDIENTES) {
      if (reDe(p).test(cl)) { out.push({ forma: p.id, claves: clavesDe(cl0), clausula: cl0.slice(0, 160), tipo: "pendiente" }); cl = cl.replace(reDe(p, "g"), p.reemplazo || " "); }
    }
    let m;
    const gAdi = /general de ADI/gi;
    while ((m = gAdi.exec(cl0))) { const k = clavesCercanas(ventana(cl0, m.index, m[0].length)); if (k.size) out.push({ forma: "general_de_adi", claves: k, clausula: cl0.slice(0, 160), tipo: "adi" }); }
    if (EXC.some((e) => e.re.test(cl))) continue;
    for (const mk of MARCADORES) {
      const r = reDe(mk, "g");
      while ((m = r.exec(cl))) {
        const k = (mk.forma === "posesivo" ? clavesDe : clavesCercanas)(ventana(cl, m.index, m[0].length, mk.forma === "posesivo" ? 25 : 0));
        if (k.size) out.push({ forma: mk.forma, claves: k, clausula: cl.slice(0, 160), tipo: "empresa" });
      }
    }
  }
  return out;
}

/** esFalsa(a, declarado:Set) → ¿esta atribución es falsa? Una atribución A LA EMPRESA lo es si apunta a un supuesto o a una llave que la empresa no declaró; «general de ADI» lo es si apunta a una llave que SÍ declaró. */
export function esFalsa(a, declarado) {
  if (a.tipo === "empresa") return [...a.claves].some((x) => x === "SIMULACION" || (x !== "REFERENCIA" && !declarado.has(x)));
  if (a.tipo === "adi") return [...a.claves].some((x) => declarado.has(x));
  return false;
}
