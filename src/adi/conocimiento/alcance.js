/* === src/adi/conocimiento/alcance.js · UNIVERSAL / LOCALIZADO (Etapa 2, bloque 6 · owner 2026-10-04) ═════════════════
 * LA REGLA (aprobada por el owner; diseño `_ADI_DISENO_UNIVERSAL_LOCALIZADO.md` §0 y §3): cada pieza declara, campo por
 * campo, de qué contexto de la empresa depende (`alcance`: una LISTA = depende de ese campo; "*" = no depende). Universal =
 * ninguna lista («no depende del perfil»). La capa exige SOLO los campos de los que esa pieza depende, y solo cuenta lo
 * DECLARADO y CONFIRMADO (lo pendiente nunca llega al perfil: `conPerfilDeclarado` mezcla solo lo vigente).
 *
 *   · universal → se sirve siempre, con o sin perfil;
 *   · localizada, todos sus campos declarados y dentro de la lista → se sirve («aplica por …»);
 *   · localizada, un campo declarado la descarta → NO se sirve y NO se dice nada (no es de esta empresa);
 *   · localizada, le falta un campo → NO se sirve y se declara el límite una vez (`seleccionar.js`).
 *
 * UNA sola verdad: la lista de campos de los que depende una pieza la lee `necesitaPerfil` (lo que el anfitrión pregunta) y la
 * selección (lo que la Entrega sirve o declara como límite) de ESTA función — por construcción son el mismo conjunto.
 *
 * Los DOS ENCABEZADOS son datos de este archivo (una constante y una plantilla); «declarado por la empresa» sale de
 * `ETIQUETA_ORIGEN` (`businessPolicy.js`, la tabla única de origen), nunca escrito a mano. Formulación NEUTRAL (decisión del
 * owner): el encabezado universal no dice «para toda empresa» —sobreafirma—, dice que el criterio no depende del perfil.
 *
 * Puro: sin I/O, sin red, sin texto del usuario. */
import { ETIQUETA_DEL_CAMPO } from "../../config/contract/perfilCliente.js";
import { ETIQUETA_ORIGEN, ORIGEN } from "../../config/businessPolicy.js";

/** campo del perfil → su llave en el `alcance` de una pieza. `tamano` (la banda) se DERIVA de los datos: nunca se pregunta y
 *  nunca es «declarado» — si falta es porque falta la venta o la UF del período. */
export const LLAVE_DE_ALCANCE = Object.freeze({ sector: "sector", tipoProducto: "tipoProducto", modeloComercial: "modeloComercial", pais: "pais", tamano: "banda" });

/** los campos que la EMPRESA declara (los únicos que una conversación puede preguntar), en el orden en que se preguntan */
const _DECLARABLES = Object.freeze(["sector", "tipoProducto", "modeloComercial", "pais"]);
const _CAMPOS_CON_ALCANCE = Object.freeze([..._DECLARABLES, "tamano"]);

const _lista = (v) => (Array.isArray(v) ? v : null);

/** listaDeAlcance(pieza, campo) → la lista de valores que la pieza admite para ese campo del perfil, o `null` si no depende de él ("*").
 *  ÚNICO lugar que lee `pieza.alcance[...]` (el candado de `_universal_localizado_gate` barre el código: ninguna otra lectura). */
export function listaDeAlcance(pieza, campo) {
  const a = pieza && pieza.alcance;
  return a && typeof a === "object" ? _lista(a[LLAVE_DE_ALCANCE[campo]]) : null;
}
/** descartaElCampo(pieza, campo, valor) → ¿lo DECLARADO descarta la pieza? (la pieza depende del campo y el valor no está en su lista) */
export function descartaElCampo(pieza, campo, valor) {
  const l = listaDeAlcance(pieza, campo);
  return l !== null && valor != null && valor !== "" && !l.includes(valor);
}

/** camposDeLosQueDepende(pieza) → [campo] · los campos del perfil cuyo valor en `alcance` es una LISTA (en el orden de
 *  `_CAMPOS_CON_ALCANCE`). `{ soloDeclarables: true }` deja fuera la banda (la usa `necesitaPerfil`: la banda no se pregunta). */
export function camposDeLosQueDepende(pieza, { soloDeclarables = false } = {}) {
  return (soloDeclarables ? _DECLARABLES : _CAMPOS_CON_ALCANCE).filter((c) => listaDeAlcance(pieza, c) !== null);
}

/** esUniversal(pieza) → true si la pieza no depende de ningún campo del perfil */
export const esUniversal = (pieza) => camposDeLosQueDepende(pieza).length === 0;

/** aplicaAlPerfil(pieza, perfil) → { aplica, motivo?, campo?|campos? }
 *  `perfil` = lo que devuelve `construirPerfilCliente` (`perfil.campos[c].valor`, ya filtrado por procedencia válida), o nada.
 *   · `{ aplica: true }` — universal, o todos sus campos están declarados y dentro de la lista;
 *   · `{ aplica: false, motivo: "fuera_de_alcance", campo }` — un campo declarado la descarta (no se sirve; no se dice nada);
 *   · `{ aplica: false, motivo: "falta_contexto", campos }` — le falta al menos un campo del que depende (no se sirve; se declara el límite).
 *  Lo que descarta manda sobre lo que falta: una pieza que ya no es de esta empresa no deja ningún límite. */
export function aplicaAlPerfil(pieza, perfil) {
  const deps = camposDeLosQueDepende(pieza);
  if (!deps.length) return { aplica: true };
  const campos = (perfil && perfil.campos) || {};
  const valor = (c) => { const v = campos[c] && campos[c].valor; return typeof v === "string" && v ? v : null; };
  for (const c of deps) {
    const v = valor(c);
    if (descartaElCampo(pieza, c, v)) return { aplica: false, motivo: "fuera_de_alcance", campo: c };
  }
  const faltan = deps.filter((c) => valor(c) === null);
  return faltan.length ? { aplica: false, motivo: "falta_contexto", campos: faltan } : { aplica: true };
}

/* ═══ LOS DOS ENCABEZADOS (una sola tabla de datos) ═══════════════════════════════════════════════════════════════════ */
/** ENCABEZADOS · la ÚNICA tabla de los textos que dicen a qué empresas aplica una pieza.
 *  `universal` — una constante (decisión del owner 2026-10-04: neutral; «Para toda empresa» sobreafirma).
 *  `localizada(campos)` — «Aplica por {el campo} {declarado por la empresa}»: el nombre del campo sale de `ETIQUETA_DEL_CAMPO` y la
 *  frase de origen de `ETIQUETA_ORIGEN` (concordada en plural si son varios campos). La banda se DERIVA de los datos: no es «declarada»,
 *  así que se nombra aparte, sin atribuirla a la empresa. Todos los campos con alcance son masculinos («el»). */
const _EL = (c) => `el ${ETIQUETA_DEL_CAMPO[c]}`;
const _Y = (xs) => (xs.length <= 1 ? (xs[0] || "") : `${xs.slice(0, -1).join(", ")} y ${xs[xs.length - 1]}`);
export const ENCABEZADOS = Object.freeze({
  universal: "Criterio general, independiente del perfil de la empresa:",
  localizada(campos) {
    const declarados = campos.filter((c) => c !== "tamano").map(_EL);
    const derivados = campos.filter((c) => c === "tamano").map((c) => `${_EL(c)} de la empresa`);
    const origen = ETIQUETA_ORIGEN[ORIGEN.EMPRESA];                                    // «declarado por la empresa»
    const origenPl = origen.replace(/^declarado\b/, "declarados");                     // la misma frase, concordada en plural
    const partes = [];
    if (declarados.length) partes.push(`${_Y(declarados)} ${declarados.length > 1 ? origenPl : origen}`);
    if (derivados.length) partes.push(_Y(derivados));
    return `Aplica por ${_Y(partes)}:`;
  },
});

/** encabezadoDePieza(pieza) → { universal, texto } · el encabezado que corresponde a lo que la pieza DECLARA de sí misma (su alcance),
 *  nunca a lo que se sirva: una pieza localizada jamás lleva el universal y una universal jamás nombra un campo. */
export function encabezadoDePieza(pieza) {
  const deps = camposDeLosQueDepende(pieza);
  return deps.length ? { universal: false, texto: ENCABEZADOS.localizada(deps) } : { universal: true, texto: ENCABEZADOS.universal };
}

/** textoDePerfilIncompletoConCapa(faltantes) → el motivo del límite «Sin perfil completo del cliente todavía» cuando la capa de conocimiento está ACTIVA (Etapa 2, bloque 6): dice la regla vigente —solo queda sin
 *  aplicar lo que depende de lo que falta— en vez de la ley vieja («sin el perfil completo ADI no aplica conocimiento del oficio»). Los campos salen de `ETIQUETA_DEL_CAMPO`. */
export function textoDePerfilIncompletoConCapa(faltantes) {
  const campos = (Array.isArray(faltantes) ? faltantes : []).map((c) => ETIQUETA_DEL_CAMPO[c] || c).join(", ");
  return `Falta declarar o no se pudo derivar: ${campos}. Solo quedan sin aplicar las referencias del oficio que dependen de lo que falta (cada una lo declara en «Referencia del oficio»); las que no dependen del perfil se aplican igual.`;
}
