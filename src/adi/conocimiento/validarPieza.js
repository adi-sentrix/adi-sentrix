/* === src/adi/conocimiento/validarPieza.js · EL CANDADO CONTRA EL UMBRAL DISFRAZADO DE CONOCIMIENTO (v0.2 §1, §5) ═
 * «Un validador de esquema rechaza cualquier pieza que traiga un número en su predicado. Es el candado contra
 * el umbral disfrazado de conocimiento.»
 *
 * validarPieza(pieza) → { ok, errores: [string] } — función PURA, sin conocer ningún dato de un tenant (eso lo
 * hace `evaluarPertinencia`/`medir`, después). Una pieza que no pasa ACÁ nunca llega a evaluarse: es la primera
 * puerta, antes de la pertinencia y antes de la medición.
 *
 * Reglas duras (documento §1, §5, §7):
 *   1 · campos obligatorios de toda pieza: id, tipo, alimenta, enunciado, sujeto, fuente, alcance, fecha,
 *       vigencia, no_implica, pertinencia, medicion, estado.
 *   2 · sujeto === "sector" — nunca una empresa del cliente (candado 6 del gate).
 *   3 · CERO LITERALES NUMÉRICOS en `pertinencia` ni en `efecto`/`condicion`/`contraindicacion` (candado central
 *       de esta capa): un dígito ahí es un umbral que la pieza intentó colar como si fuera conocimiento.
 *   4 · `no_implica` no puede estar vacío (una pieza sin su "no implica" es la carnada que el documento nombra).
 *   5 · `medicion` completa: `calculo` (string), `existe_en_motor` (boolean), `por_entidad` (string), `decisivo`
 *       (boolean), `no_excluye` (string, salvo cuando `decisivo` es explícitamente `false` con motivo declarado
 *       en `insumos`), `insumos` (array no vacío).
 *   6 · `estado === "borrador"` exige `firma === null` — una pieza no puede declararse a la vez borrador y
 *       firmada (inconsistencia que la propia pieza debería resolver, no algo que este validador reconcilie).
 *   7 · `pertinencia` es un árbol bien formado sobre el vocabulario cerrado (`predicados.js`) — todo/alguno/no,
 *       sin operadores fuera de esa lista. */
import { predicadoValido } from "./predicados.js";

const _CAMPOS_OBLIGATORIOS = ["id", "tipo", "alimenta", "enunciado", "sujeto", "fuente", "alcance", "fecha", "vigencia", "no_implica", "pertinencia", "medicion", "estado"];
const _ESTADOS_VALIDOS = ["borrador", "propuesta", "firmada"];
const _ALIMENTA_VALIDO = ["impacto", "prioridades", "riesgos", "causalidad", "siguiente_movimiento"];

/* ═══ EL FORMATO DE ID DE PIEZA (owner 2026-09-24, cierre de presentación de CAU-01) ═══════════════════════════
 * El propio esquema del catálogo (`piezas.js`) nombra sus piezas "CAU-01", "CAU-06", "CAU-03", "PRI-04" — 2 a 5
 * letras mayúsculas, un guion, 2 o 3 dígitos. Ese es el ÚNICO formato que este proyecto usa para un id de pieza,
 * declarado UNA vez acá — exportado para que el candado y cualquier otro archivo lo lean de la MISMA fuente,
 * nunca copiado a mano. */
export const ID_PIEZA_RE = /\b[A-Z]{2,5}-\d{2,3}\b/;

/* ★ ARREGLO DE RAÍZ (owner 2026-09-24) — «un id interno se filtró al texto del usuario» (CAU-04, una hipótesis
 * que NI SIQUIERA está sembrada en el catálogo, mencionada dentro de `medicion.no_excluye` de CAU-01). La
 * carnada anterior comparaba solo contra los ids DEL CATÁLOGO REAL — ciega a cualquier id de una pieza que no
 * esté sembrada (como CAU-04). El arreglo es ESTRUCTURAL: ningún campo de texto que `servir.js` imprime al
 * usuario (`enunciado`, `no_implica`, `medicion.no_excluye`) puede contener un token con la FORMA de un id de
 * pieza — no importa si esa pieza existe hoy en `PIEZAS_CONOCIMIENTO` o no. Una pieza así se rechaza acá, antes
 * de llegar a pertinencia/medición/servicio. */
const _CAMPOS_DE_TEXTO_SERVIDO = ["enunciado", "no_implica"];
function _tieneIdDePieza(texto) {
  return typeof texto === "string" && ID_PIEZA_RE.test(texto);
}

/* un dígito ASCII en cualquier parte del JSON de un nodo — ni en un predicado, ni en un valor de composición.
 * `pieza.version`, `pieza.fecha`, `pieza.vigencia`, `pieza.alcance` viven FUERA de `pertinencia`/`efecto` y no
 * se escanean acá (una fecha o una versión no son un umbral de negocio). */
const _tieneDigito = (nodo) => /\d/.test(JSON.stringify(nodo == null ? "" : nodo));

/* el árbol de pertinencia usa solo el vocabulario cerrado y los tres operadores de composición — nada más. */
function _predicadosDelArbol(nodo, out) {
  if (typeof nodo === "string") { out.push(nodo); return; }
  if (!nodo || typeof nodo !== "object" || Array.isArray(nodo)) return;
  const claves = Object.keys(nodo);
  const permitidas = claves.every((k) => k === "todo" || k === "alguno" || k === "no");
  if (!permitidas) out.push(`__operador_no_permitido__:${claves.join(",")}`);
  if (Array.isArray(nodo.todo)) for (const h of nodo.todo) _predicadosDelArbol(h, out);
  if (Array.isArray(nodo.alguno)) for (const h of nodo.alguno) _predicadosDelArbol(h, out);
  if (nodo.no != null) _predicadosDelArbol(nodo.no, out);
}

/** validarPieza(pieza, { entidadesConocidas } = {}) → { ok, errores }
 *  `entidadesConocidas` (opcional): nombres reales de un tenant (clientes/SKU) — permite al llamador (el gate)
 *  comprobar la regla "el sujeto del enunciado es el sector, nunca una empresa del cliente" con datos reales;
 *  sin ella, esta función sigue siendo válida (no rechaza por eso). */
export function validarPieza(pieza, { entidadesConocidas = [] } = {}) {
  const errores = [];
  const err = (m) => errores.push(m);

  if (!pieza || typeof pieza !== "object") return { ok: false, errores: ["la pieza no es un objeto"] };

  for (const campo of _CAMPOS_OBLIGATORIOS) if (!(campo in pieza) || pieza[campo] == null || pieza[campo] === "") err(`falta el campo obligatorio "${campo}"`);
  if (errores.length) return { ok: false, errores };   // sin los campos base, no tiene sentido seguir validando

  if (pieza.sujeto !== "sector") err(`sujeto debe ser "sector" (llegó "${pieza.sujeto}") — la pieza describe al oficio, no a una empresa del cliente`);
  if (!_ESTADOS_VALIDOS.includes(pieza.estado)) err(`estado "${pieza.estado}" no está en la lista válida (${_ESTADOS_VALIDOS.join(" · ")})`);
  if (pieza.estado === "borrador" && pieza.firma != null) err(`una pieza en estado "borrador" no puede traer firma (llegó ${JSON.stringify(pieza.firma)})`);
  if (pieza.estado !== "borrador" && !pieza.firma) err(`una pieza que no es "borrador" necesita firma declarada`);
  if (!_ALIMENTA_VALIDO.includes(pieza.alimenta)) err(`alimenta "${pieza.alimenta}" no está en la lista válida (${_ALIMENTA_VALIDO.join(" · ")})`);
  if (typeof pieza.no_implica !== "string" || !pieza.no_implica.trim()) err('no_implica no puede estar vacío — cada pieza servida declara lo que su medición NO prueba');

  // ★ NINGÚN ID DE PIEZA EN UN CAMPO QUE SE SIRVE AL USUARIO (owner 2026-09-24) — estructural, por FORMA
  // (`ID_PIEZA_RE`), no por lista de ids conocidos: atrapa también un id de una pieza que ni siquiera está
  // sembrada en el catálogo (el caso real: "CAU-04" dentro de `medicion.no_excluye` de CAU-01).
  for (const campo of _CAMPOS_DE_TEXTO_SERVIDO) {
    if (_tieneIdDePieza(pieza[campo])) err(`${campo} contiene un token con forma de id de pieza (${ID_PIEZA_RE.exec(pieza[campo])[0]}) — ningún id interno del catálogo puede llegar al texto que lee el usuario`);
  }
  if (pieza.medicion && _tieneIdDePieza(pieza.medicion.no_excluye)) err(`medicion.no_excluye contiene un token con forma de id de pieza (${ID_PIEZA_RE.exec(pieza.medicion.no_excluye)[0]}) — ningún id interno del catálogo puede llegar al texto que lee el usuario`);

  // CERO LITERALES NUMÉRICOS en pertinencia/efecto/condicion/contraindicacion — el candado central
  if (_tieneDigito(pieza.pertinencia)) err("pertinencia trae un literal numérico — la pieza no puede definir un umbral, solo leer el veredicto del motor");
  if ("efecto" in pieza && _tieneDigito(pieza.efecto)) err("efecto trae un literal numérico");
  if ("condicion" in pieza && typeof pieza.condicion === "object" && _tieneDigito(pieza.condicion)) err("condicion trae un literal numérico");
  if ("contraindicacion" in pieza && _tieneDigito(pieza.contraindicacion)) err("contraindicacion trae un literal numérico");

  // el árbol de pertinencia: solo el vocabulario cerrado, solo los tres operadores
  const predicados = [];
  _predicadosDelArbol(pieza.pertinencia, predicados);
  if (!predicados.length) err("pertinencia no declara ningún predicado evaluable");
  for (const p of predicados) {
    if (p.startsWith("__operador_no_permitido__")) { err(`pertinencia usa un operador fuera de todo/alguno/no (${p.replace("__operador_no_permitido__:", "")})`); continue; }
    if (!predicadoValido(p)) err(`pertinencia usa un predicado fuera del vocabulario cerrado: "${p}"`);
  }

  // medicion: la forma mínima
  const m = pieza.medicion;
  if (!m || typeof m !== "object") { err("medicion no es un objeto"); }
  else {
    if (typeof m.calculo !== "string" || !m.calculo.trim()) err("medicion.calculo debe nombrar el cálculo (string)");
    if (typeof m.existe_en_motor !== "boolean") err("medicion.existe_en_motor debe ser boolean (true/false), nunca omitido");
    if (typeof m.por_entidad !== "string" || !m.por_entidad.trim()) err("medicion.por_entidad debe declarar el eje (cuenta/sku/…)");
    if (typeof m.decisivo !== "boolean") err("medicion.decisivo debe ser boolean — gobierna si la pieza puede decir «no ocurre»");
    if (!Array.isArray(m.insumos) || !m.insumos.length) err("medicion.insumos debe listar qué necesita el cálculo (al menos uno)");
    if (m.decisivo === true && (typeof m.no_excluye !== "string" || !m.no_excluye.trim())) err('medicion.no_excluye es obligatorio cuando decisivo=true — hasta un "ocurre" decisivo declara qué no excluye');
  }

  // opcional: el sujeto del enunciado no nombra una empresa real del cliente
  if (entidadesConocidas && entidadesConocidas.length && typeof pieza.enunciado === "string") {
    const nombrada = entidadesConocidas.find((e) => e && pieza.enunciado.includes(e));
    if (nombrada) err(`enunciado nombra una entidad del tenant ("${nombrada}") — el sujeto de la pieza es el sector, nunca una empresa del cliente`);
  }

  return { ok: errores.length === 0, errores };
}

/** piezasValidas(piezas, opts) → { validas: [...], invalidas: [{ pieza, errores }] } */
export function piezasValidas(piezas, opts = {}) {
  const validas = [], invalidas = [];
  for (const p of Array.isArray(piezas) ? piezas : []) {
    const r = validarPieza(p, opts);
    if (r.ok) validas.push(p); else invalidas.push({ pieza: p, errores: r.errores });
  }
  return { validas, invalidas };
}
