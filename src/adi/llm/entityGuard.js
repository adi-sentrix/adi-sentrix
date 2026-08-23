/* === src/adi/llm/entityGuard.js · ADI Core · GUARD DE ENTIDADES (familia P8 · garble de nombres) ===
 * Prueba en vivo 2026-07-09: el narrador respondió "…retener a Falcon, Jumbo y Lider" — "Falcon" NO existe en el
 * dato (corrupción de "Falabella"). El number-guard no lo caza: solo mira CIFRAS. Regla madre: el LLM narra, ADI
 * calcula — un nombre de cliente inventado es tan grave como una cifra inventada.
 *
 * Qué hace: todo token Title-Case de la narración que CASI-matchee un nombre del dato (cliente/marca/bodega)
 * pero no sea exacto → entidad corrupta → el llamador degrada al texto determinístico. Puro · sin red · sin estado.
 *
 * Cómo NO bloquear el español normal (el riesgo real del casi-match):
 *   · candidatos = solo Title-Case ("Falcon", no "falcon" ni "FALCON"): en español las palabras comunes van en
 *     minúscula a MITAD de oración → un Title-Case ahí es casi seguro nombre propio. Las siglas/códigos todo-caps
 *     (SKU "SAM-TV55", "ADI", "LG") quedan fuera del casi-match (solo cuenta el match exacto).
 *   · a INICIO de oración cualquier palabra va capitalizada → ahí corre SOLO la regla estricta de edit-distance
 *     ("Phillips"→Philips sí; prefijo tipo "Falta"→Falabella no).
 *   · la regla de prefijo exige cubrir ≥ mitad del token → "Unidades" no cae por "Unimarc" (3 < 4), "Contra" sí
 *     necesitaría stoplist… y por eso hay STOPLIST explícita de colisiones conocidas del dominio ("Pareto"↔Paris).
 *   · un Title-Case que NO se parece a ningún nombre del dato pasa intacto (Walmart/Corona los degrada el motor).
 *
 * ⚠️ EL CATÁLOGO SALE DEL TENANT ACTIVO, Y SE ARMA CUANDO SE USA (owner 2026-08-21 · vía 1 de Supabase).
 * Este guard nació en un mundo donde el dato era una CONSTANTE GLOBAL: importaba `demoData` y armaba sus tablas
 * en tiempo de import. La vía 1 cambió el modelo — la app arranca VACÍA y recién después pide al servidor el dato
 * del tenant autorizado, para que no viajen datos de otras empresas al navegador. Con eso, leer al import devuelve
 * la lista vacía y el guard queda MUDO: aprueba cualquier nombre porque no tiene contra qué compararlo.
 * Se adapta al mundo nuevo con el mismo patrón que ya usa `entityIndex`: se construye PEREZOSO en la primera
 * llamada —cuando el tenant ya está— y se tira al cambiar de tenant. Los nombres salen del ÍNDICE DE ENTIDADES
 * del tenant activo, no del demo: sin lista escrita a mano y sin respaldo al demo, que serían las dos formas de
 * volver al mundo viejo. Juzga a la empresa que está mirando, y a ninguna otra.
 */
import { axisEntityNames } from "../oracle/entityIndex.js";
import { onTenantChange } from "../../data/tenantStore.js";

// normaliza para comparar: sin acentos · lowercase ("Líder" ≡ "Lider" — la corrección ortográfica no es garble)
const _norm = (s) => String(s).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

// nombres del TENANT ACTIVO → SAFE (palabras exactas, jamás se flaggean) + ANCLAS (len>=4, contra las que se mide
// el casi-match). Tres ejes porque la narración nombra los tres; el índice los da ya canonizados por tenant.
let _cat = null;
function _construirCatalogo() {
  const nombres = [...axisEntityNames("cliente"), ...axisEntityNames("marca"), ...axisEntityNames("bodega")];
  const safe = new Set();
  const anchors = [];   // { norm, display } · display = el nombre completo del dato (para el reason)
  for (const name of nombres) {
    safe.add(_norm(name));
    for (const w of String(name).split(/\s+/)) {
      const nw = _norm(w);
      safe.add(nw);
      if (nw.length >= 4 && !anchors.some((a) => a.norm === nw)) anchors.push({ norm: nw, display: name });
    }
  }
  return { safe, anchors, sinCatalogo: nombres.length === 0 };
}
const _catalogo = () => (_cat || (_cat = _construirCatalogo()));
onTenantChange(() => { _cat = null; });   // tenant nuevo → catálogo nuevo, sin residuos del anterior

// colisiones conocidas español/dominio con prefijos de ancla (Pareto↔Paris · Falta↔Falabella · Hitos↔Hites ·
// Total↔Tottus · Concepto↔Concepción · Lidera↔Lider · Vale/Valor↔Valparaíso · Libera↔Libre · Único↔Unimarc ·
// Merece↔Mercado…) — palabras REALES que la narración puede capitalizar; nunca son garble.
// ⚠️ ESTA LISTA ES DE PALABRAS ESPAÑOLAS, NO DE CLIENTES — por eso no se mueve con el tenant, y está bien que no
// se mueva: son palabras comunes que la narración capitaliza y que nunca son garble. Lo que SÍ quedó afinado
// contra el catálogo del demo son los EJEMPLOS de colisión de arriba; con otra empresa pueden aparecer choques
// nuevos. El riesgo es acotado y de un solo lado: una palabra de más acá deja pasar un garble, nunca acusa a un
// nombre correcto. Si una empresa real trae una colisión propia, se agrega la palabra — no el nombre del cliente.
const _STOP = new Set([
  "falta", "faltan", "falla", "fallas", "parte", "partes", "pareto", "paridad", "para",
  "total", "totales", "hito", "hitos", "unidad", "unidades", "concepto", "conceptos", "contra", "antes",
  "lidera", "lideran", "liderando", "liderazgo", "mercaderia", "mercaderias", "mercados", "merece", "merecen",
  "vale", "valen", "valor", "valores", "libera", "liberar", "unico", "unica", "unicos", "unicas",
]);

// Levenshtein con corte temprano (los strings son cortos · se llama poco)
function _lev(a, b) {
  const m = a.length, n = b.length;
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++)
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = cur;
  }
  return prev[n];
}

const _prefixLen = (a, b) => { let i = 0; while (i < a.length && i < b.length && a[i] === b[i]) i++; return i; };

// token Title-Case no pegado a otra letra (deja fuera "SAM" de "SAM-TV55" — todo-caps — y submatches)
const _TOKEN = /(?<![A-Za-zÀ-ſ])[A-ZÁÉÍÓÚÑÜ][a-záéíóúñü]+/g;
// envoltorios que no cortan oración (comillas · paréntesis · markdown) — se pelan antes de mirar el borde.
// La raya/guion SÍ es borde: el narrador la usa como separador-encabezado ("**Falabella** — Aporta $4.3M",
// principio 7) → lo que sigue va capitalizado siendo palabra común, igual que un arranque de oración.
const _WRAP = /[\s"'“”‘’¿¡()[\]*_>]+$/;
const _BOUNDARY = /[.!?:;·…\n—-]$/;

// entityGuard(narración) → { ok } | { ok:false, token, entity, reason }
export function entityGuard(narration) {
  const { safe, anchors, sinCatalogo } = _catalogo();
  /* SIN TENANT NO SE JUZGA, Y SE DICE. Antes de la vía 1 esto no podía pasar: el dato era global. Ahora la app
   * arranca vacía, así que se declara qué hace el guard en ese hueco en vez de dejarlo al azar. NO se inventa un
   * veredicto: llamar «entidad corrupta» a un nombre que no se pudo comparar sería una acusación sin evidencia, y
   * degradaría TODA narración con una razón falsa. Se devuelve `sinCatalogo` para que quien mida lo vea.
   * En la app no ocurre — `main.jsx` monta recién cuando el dato del tenant llegó, que es lo que la vía 1 construyó. */
  if (sinCatalogo) return { ok: true, sinCatalogo: true, reason: "sin tenant activo: no hay catálogo contra el cual verificar nombres" };
  const text = String(narration == null ? "" : narration);
  for (const m of text.matchAll(_TOKEN)) {
    const tok = m[0];
    if (tok.length < 3) continue;
    const t = _norm(tok);
    if (safe.has(t) || _STOP.has(t)) continue;
    const before = text.slice(0, m.index).replace(_WRAP, "");
    const atStart = !before || _BOUNDARY.test(before);
    for (const a of anchors) {
      const th = a.norm.length >= 8 ? 2 : 1;   // estricta: casi-idéntico al nombre (typo/garble corto)
      const near =
        (Math.abs(t.length - a.norm.length) <= th && _lev(t, a.norm) <= th) ||
        (!atStart && _prefixLen(t, a.norm) >= Math.max(3, Math.ceil(t.length / 2)));   // prefijo tipo "Falcon"→Falabella
      if (near)
        return { ok: false, token: tok, entity: a.display, reason: `entidad corrupta: "${tok}" no existe en el dato — casi-matchea "${a.display}" sin ser exacta` };
    }
  }
  return { ok: true };
}
