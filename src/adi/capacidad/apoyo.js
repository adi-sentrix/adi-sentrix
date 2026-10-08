/* === src/adi/capacidad/apoyo.js · LAS CIFRAS DE APOYO DE UNA ENTREGA (ensayo 5, owner 2026-10-07 · `_ADI_DISENO_CONTRATO_ANFITRION.md` §11) ═══════════════════════════════════
 * Además de la tabla de Cifras, el texto de una Entrega imprime otras cifras: la referencia con la que se compara (el benchmark), una comparación, una premisa juzgada, un dato de la iniciativa. El anfitrión las
 * recibe en `apoyo`, cada una con su id `E<n>.<id del hecho>` (`compacto.js`). Hasta el ensayo 5 esas cifras no entraban al libro de la conversación, así que `derivar` las rechazaba como `id_invalido` — una cifra con
 * id que no se podía usar («cuánto le falta al benchmark»). Este módulo es la ÚNICA fuente de qué cifras son de apoyo (la usa `compacto.js` para lo que VIAJA y `acciones.js` para lo que el libro GUARDA: mismas cifras,
 * mismos ids) y de cómo se guardan: lo justo para resolver el id y revalidarlo — el crudo, la unidad, la métrica, el dueño, la procedencia y, si es una REFERENCIA de la casa, de quién es (la empresa lo declaró, o es el
 * criterio general de ADI). Una de apoyo sin cifra exacta (un conteo «6 de 13», una premisa sin número) se guarda solo como el id: ADI sabe que existe y dice por qué no se deriva.
 * Puro: sin I/O, sin red. Cero `node:*`. */
import { cifraDeHecho } from "../continuidad/revalidar.js";

/* ── qué cifras imprime el texto ─────────────────────────────────────────────────────────────────────────────────────────────────────────── */
const _esc = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
/** ¿el texto imprime este valor? (límites de número: «$17.3M» no está dentro de «$117.3M» ni de «$17.35M») — y «95d» (la forma del libro) es «95 días» en el texto */
export function textoImprime(texto, p) {
  const formas = [p];
  const d = /^(-?\d+)d$/.exec(p);
  if (d) formas.push(`${d[1]} días`, `${d[1]} día`);
  return formas.some((f) => new RegExp(`(?<![\\w.,$-])${_esc(f)}(?![\\w]|[.,]\\d)`).test(texto));
}
export const conDigito = (s) => typeof s === "string" && /\d/.test(s);
const _enteroSuelto = (s) => /^-?\d+$/.test(String(s).trim());
/** los valores con unidad que escribe una oración de la casa («Jumbo: venta $17.3M, puesto 3 de 13…» → $17.3M): el valor impreso es lo que la casa escribió, nunca uno recalculado */
const _RX_VALOR = /-?\$?\d[\d.,]*(?:\s?(?:M|K|pp|x|d|días?)\b|%)?/g;
const _conUnidad = (p) => /[$%]|\d(?:M|K|x|d|pp)$|\s(?:días?|pp)$/.test(p);
const _hojas = (x, out = []) => { if (typeof x === "string") out.push(x); else if (Array.isArray(x)) x.forEach((y) => _hojas(y, out)); else if (x && typeof x === "object") Object.values(x).forEach((y) => _hojas(y, out)); return out; };
const _valoresDe = (txt) => (typeof txt === "string" ? (txt.match(_RX_VALOR) || []).map((x) => x.trim().replace(/[.,]+$/, "")).filter((x) => conDigito(x) && _conUnidad(x)) : []);
export const soloConValor = (o) => { const r = {}; for (const [k, v] of Object.entries(o)) if (v !== null && v !== undefined) r[k] = v; return r; };

/** hechosQueYaViajan(entregaJson) → los ids de hecho de la Entrega que el anfitrión ya recibe con su PROPIO id en otro lugar: el total del listado (`cifras.totales`) y las cifras de `detalle.fueraDelTexto`. No se repiten como apoyo
 *  (antes sí: el anfitrión veía a Unimarc dos veces, como `E4.h26` y como `E4.e25`, y usaba la que no podía derivar). */
export function hechosQueYaViajan(entregaJson) {
  const j = entregaJson && typeof entregaJson === "object" ? entregaJson : {};
  const totales = (j.cifras && Array.isArray(j.cifras.totales) ? j.cifras.totales : []).map((t) => t && t.hecho).filter(Boolean);
  const fuera = (j.detalle && Array.isArray(j.detalle.filas) ? j.detalle.filas : []).flatMap((f) => (Array.isArray(f && f.hechos) ? f.hechos : []));
  return [...totales, ...fuera];
}

/** recorrerApoyo(texto, filas, libros, n, yViajan) → [{ item, H, premisa }] · las demás cifras que el texto imprime, tomadas de los libros de hechos de la Entrega (las que el compositor ya verificó), cada una con su
 *  valor impreso, el hecho en una línea y su procedencia; su id es `E<n>.<id del hecho en la Entrega>`. `H` es el hecho del libro del que sale (para guardar su cifra exacta). */
export function recorrerApoyo(texto, filas, libros, n, yViajan = []) {
  const enFilas = new Set(yViajan);   /* lo que ya viaja con su propio id en `cifras` (el total del listado) no se repite como apoyo */
  for (const f of filas) for (const id of (Array.isArray(f && f.hechos) ? f.hechos : [])) enFilas.add(id);
  const out = [];
  const vistos = new Set();
  for (const { libro, premisa } of libros) {
    for (const H of (libro && Array.isArray(libro.hechos) ? libro.hechos : [])) {
      if (!H || (!premisa && enFilas.has(H.id))) continue;
      const render = H.render && typeof H.render === "object" ? H.render : {};
      const candidatos = [render.valor, ...(Array.isArray(H.numeros) ? H.numeros.map((x) => x && x.texto) : []), ..._valoresDe(H.verdad), ..._hojas(render).flatMap(_valoresDe)].filter((s) => conDigito(s) && !_enteroSuelto(s));
      const encontrados = [...new Set(candidatos)].filter((p) => textoImprime(texto, p));
      let valor = encontrados.join(" · ");
      if (!valor && render.n != null && render.m != null && textoImprime(texto, `${render.n} de ${render.m}`)) valor = `${render.n} de ${render.m}`;
      if (!valor) continue;
      const sujetos = H.roles && Array.isArray(H.roles.sujetos) ? H.roles.sujetos.filter(Boolean) : [];
      const hecho = typeof H.verdad === "string" ? H.verdad : null;
      const clave = `${valor}|${hecho}|${premisa ? 1 : 0}`;
      if (vistos.has(clave)) continue;
      vistos.add(clave);
      out.push({
        H, premisa: Boolean(premisa),
        item: soloConValor({
          id: `E${n}.${H.id}`, valor, hecho, ...(sujetos.length ? { entidad: sujetos.join(", ") } : {}),
          procedencia: H.procedencia || null, ...(premisa ? { premisa: true, veredicto: H.veredicto || null } : {}),
        }),
      });
    }
  }
  return out;
}

/* ── lo que el libro guarda de ellas ─────────────────────────────────────────────────────────────────────────────────────────────────────── */
/* LA CIFRA EXACTA DE UNA CIFRA DE APOYO (ensayo 8, owner 2026-10-08): la cifra que el libro guarda tiene que ser la que el texto IMPRIME. `cifraDeHecho` toma la ÚLTIMA cifra del hecho —en «3 de 13 en los clientes con días vencido superior a 15 días» eso es 13, un conteo—
 * y el apoyo imprimía «15 días»: la cifra vivía como `E1.e1`, tipada `count`, y una diferencia con días daba `unidades_distintas`. Ahora: si lo impreso es UN número del hecho (el umbral de un filtro, «15 días»), se guarda ESE, con su unidad (los días son días); un conteo impreso «3 de 13» no es una cifra sobre la
 * que se derive. El umbral de un filtro es un PARÁMETRO de la consulta, no una medición: se marca `premisa` (no se deriva sobre él; un valor que el usuario fijó se pasa a `derivar` como «criterio»). */
function _cifraDeApoyo(H, item) {
  const impreso = String(item && item.valor != null ? item.valor : "");
  if (/^\d+ de \d+$/.test(impreso)) return { c: null, parametro: false };
  const numeros = H && Array.isArray(H.numeros) ? H.numeros : [];
  if (impreso && !impreso.includes(" · ")) {
    const n = numeros.find((x) => x && x.texto === impreso);
    if (n && n !== numeros[numeros.length - 1]) return { c: cifraDeHecho({ ...H, numeros: [n] }), parametro: n.dueno === "universo" };
  }
  return { c: cifraDeHecho(H), parametro: false };
}

/** apoyoParaElLibro(recorrido, { origenDeReferencia }) → [{ id, rv? }] · una entrada por cifra de apoyo que viaja. Con cifra exacta (un único valor medido o una referencia): `rv` compacto, como el de la tabla
 *  (`titular:"medido"` y `tipo:"ref"` no se escriben) y, si es una REFERENCIA de la casa, `origenRef` (de quién es). Un resultado que ADI ya calculó (`tipo` derivada: «A − B = C») NO es una cifra sobre la que se
 *  derive: la tabla trae sus dos operandos con id — se guarda solo el id. Las premisas llevan `premisa:true` (no son una medición). `origenDeReferencia`: clave de la referencia → su origen (`ORIGEN.*`), resuelto
 *  por quien llama con la misma función de origen de la casa (`businessPolicy.js:procedenciaDeLlave`) dentro del tramo del Core. */
export function apoyoParaElLibro(recorrido, { origenDeReferencia = {} } = {}) {
  const out = [];
  for (const { item, H, premisa } of Array.isArray(recorrido) ? recorrido : []) {
    const { c, parametro } = _cifraDeApoyo(H, item);
    const exacta = c && Number.isFinite(c.raw) && c.clave && c.unidad && c.dueno && c.procedencia && c.tipo !== "derivada";
    if (!exacta) { out.push({ id: item.id }); continue; }
    out.push({
      id: item.id,
      rv: {
        raw: c.raw, unidad: c.unidad, clave: c.clave, dueno: c.dueno,
        ...(c.titular && c.titular !== "medido" ? { titular: c.titular } : {}),
        procedencia: c.procedencia,
        ...(c.tipo && c.tipo !== "ref" ? { tipo: c.tipo } : {}),
        ...(origenDeReferencia[c.clave] ? { origenRef: origenDeReferencia[c.clave] } : {}),
        ...(premisa || parametro ? { premisa: true } : {}),
      },
    });
  }
  return out;
}

/** cifrasDeApoyo(entrega) → [cifra] · las cifras de apoyo de una Entrega del libro que ADI puede resolver (las que guardaron su cifra exacta), con la MISMA forma que `revalidar.js:cifrasDeLaEntrega`:
 *  `{ id, sujeto, metrica, valor, rv }` — así `derivar` y la revalidación las tratan como a cualquier otra cifra. `metrica` es el nombre de la clave en el léxico de la casa (lo pone quien llama). */
export function cifrasDeApoyo(entrega, { nombreDeClave = (k) => k, formato = null } = {}) {
  const out = [];
  for (const a of (entrega && Array.isArray(entrega.apoyo) ? entrega.apoyo : [])) {
    if (!a || typeof a.id !== "string" || !a.rv || typeof a.rv !== "object") continue;
    const v = { titular: "medido", tipo: "ref", ...a.rv };
    out.push({ id: a.id, apoyo: true, sujeto: v.dueno != null ? v.dueno : null, metrica: nombreDeClave(v.clave), valor: formato ? formato(v.raw, v.unidad) : null, rv: v });
  }
  return out;
}
