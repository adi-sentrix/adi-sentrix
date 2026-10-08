/* === src/adi/capacidad/compacto.js · LO QUE VIAJA AL ANFITRIÓN: LA RESPUESTA COMPACTA (Etapa 2, medición con anfitrión · owner 2026-10-05) ═
 * Lo que bloqueó el ensayo: cada `consultar` devolvía 63–363 KB (y hasta 2 MB en los catálogos largos) al anfitrión — de una respuesta de 324 KB, el texto de la Entrega
 * pesa ~2 KB y su `json` ~320 KB (el libro de hechos con todos sus índices, los universos, la procedencia). Un anfitrión real (Claude Code, Claude.ai, ChatGPT) guarda o recorta una
 * respuesta así, y el modelo solo ve una parte: el tamaño de lo que devuelve una herramienta es un límite del anfitrión, no de ADI.
 *
 * DECISIÓN DEL OWNER (textual, resumida): «el anfitrión recibe una respuesta compacta pero completa para conversar: el texto de la Entrega, las cifras necesarias con sus identificadores,
 * la continuidad y las declaraciones relevantes. La estructura interna completa se queda dentro de ADI. No cambies cifras, Core, Notario ni garantías de verdad.» «No conviertas 20 KB
 * en una regla rígida; úsalo solo como referencia de prueba: el requisito real es que la respuesta quepa limpiamente en el anfitrión sin perder información necesaria.»
 *
 * QUÉ ES ESTE ARCHIVO: una PROYECCIÓN pura de lo que ya calculan las cuatro acciones (`acciones.js` no cambia: sigue calculando lo mismo, y el libro, la continuidad y la verificación
 * usan la estructura completa). Aquí no se calcula, no se redondea, no se reescribe: se COPIA (texto íntegro, valores impresos tal como los imprimió la casa) o se OMITE (lo interno). Es el
 * ÚLTIMO paso de la puerta (`puerta.js:_despachar`), así que el transporte MCP y el REST de GPT Actions viajan igual.
 *
 *   consultar    →  { ok, entrega: { texto (ÍNTEGRO, byte a byte), cifras, apoyo?, marco, universos?, alcance, detalle?, temasCubiertos, verificacion }, noResuelto, uso, perfil?, declarado?,
 *                    antecedentes?, continuidad, meta, advertencias? }
 *       · `cifras` = las cifras de la tabla de Cifras, UNA por cifra, con el MISMO id que el libro de la conversación les da (`E<n>.h<k>`, y `E<n>.h<k>.<j>` la j-ésima de una fila ancha):
 *         salen de la MISMA función que arma lo que el libro guarda (`_hechosDeLaEntrega` + `cifrasDeLaEntrega`), así que `retomar` las devuelve con el mismo id, entidad, métrica y valor.
 *       · `apoyo` = las demás cifras que el texto imprime (una comparación, una premisa juzgada, un dato de la iniciativa), tomadas de los libros de hechos de la Entrega — las que el
 *         compositor ya verificó —, cada una con su valor impreso, el hecho en una línea y su procedencia; su id es `E<n>.<id del hecho en la Entrega>`.
 *       · lo que NO viaja: el libro de hechos con sus índices, `procedencia`, el `json` del Marco con su perfil largo, los universos con sus listas de entidades, el crudo de cada cifra.
 *   conocerEmpresa →  el mismo objeto sin lo que es solo mecanismo (la fuente interna de cada fórmula/estado, los insumos del tamaño), sin repetir lo que dos bloques dicen igual
 *                    (período y moneda del catálogo = los de `datos`), con la forma de declarar dicha UNA vez en vez de por cada concepto.
 *   retomar        →  cada cifra con su id, sujeto, métrica, valor, origen y su revalidación (estado, antes, ahora, diferencia ya calculada); sin el crudo interno ni el campo duplicado.
 *   aportarContexto → tal cual (ya es chica).
 * Cero `node:*` (corre en `edge` como el resto de la puerta). */
import { _hechosDeLaEntrega } from "./acciones.js";
import { cifrasDeLaEntrega } from "../continuidad/revalidar.js";
import { recorrerApoyo, hechosQueYaViajan } from "./apoyo.js";

/* quiénes son los miembros de un universo se dice cuando es un conjunto que cabe a la vista (hasta 40 nombres); de uno mayor viaja solo cuántos son (`n`) */
export const ENTIDADES_DE_UN_UNIVERSO_MAX = 40;
export const REFERENCIA_DE_TAMANO_BYTES = 20 * 1024;   // REFERENCIA de prueba (owner), no una regla: el requisito real es que quepa limpiamente en el anfitrión sin perder información necesaria

const _soloConValor = (o) => { const r = {}; for (const [k, v] of Object.entries(o)) if (v !== null && v !== undefined) r[k] = v; return r; };
const _noVacio = (x) => (Array.isArray(x) ? x.length > 0 : x !== null && x !== undefined && x !== "" && !(typeof x === "object" && Object.keys(x).length === 0));

/* ── CONSULTAR ───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────── */
/* `apoyo` = las demás cifras que el texto imprime: la fuente es `apoyo.js` (lo que viaja y lo que el libro guarda salen de la MISMA función: mismas cifras, mismos ids) */
function _apoyoDe(texto, filas, libros, n, yViajan = []) {
  return recorrerApoyo(texto, filas, libros, n, yViajan).map((x) => x.item);
}

/** el perfil del Marco en lo que importa al conversar: el valor de cada campo y su procedencia (la explicación larga de cada uno la trae `conocerEmpresa`, una vez) */
function _perfilBreve(perfil) {
  if (!perfil || typeof perfil !== "object") return null;
  const campos = {};
  for (const [k, v] of Object.entries(perfil.campos || {})) campos[k] = { valor: v && v.valor !== undefined ? v.valor : null, procedencia: v && v.procedencia !== undefined ? v.procedencia : null };   // «sin declarar» se dice (valor: null), no se calla
  return { campos, ...(Array.isArray(perfil.faltantes) ? { faltantes: perfil.faltantes } : {}), ...(perfil.completo !== undefined ? { completo: perfil.completo } : {}) };
}

const _cifraBreve = (c) => _soloConValor({ id: c.id || null, entidad: c.sujeto, metrica: c.metrica, valor: c.valor, procedencia: c.origen, ...(c.rv && c.rv.deSupuesto === true ? { supuesto: true } : {}) });

/** las cifras de la tabla de Cifras, con los ids del libro: `turno` es el número de la Entrega en la conversación (`continuidad.estadoVigente.turno`: el libro ya la registró) */
export function cifrasDeLaConsulta(entregaJson, turno) {
  const filas = (entregaJson && entregaJson.cifras && Array.isArray(entregaJson.cifras.filas)) ? entregaJson.cifras.filas : [];
  const hechos = _hechosDeLaEntrega(entregaJson, { conFueraDelTexto: false }).map((h, k) => ({ ...h, id: `E${turno}.h${k + 1}` }));   /* la tabla de la Entrega: las cifras de `detalle.fueraDelTexto` (que el libro también guarda, con id) viajan en `detalle`, no acá */
  return cifrasDeLaEntrega({ hechos }).map((c) => {
    const b = _cifraBreve(c);
    /* una fila de simulación dice el supuesto con el que se calculó (planteado en la consulta, no medido): viaja con SU cifra */
    const k = /\.h(\d+)/.exec(c.id || "");
    const v = k && filas[Number(k[1]) - 1] && filas[Number(k[1]) - 1].valores;
    return typeof (v && v["Supuesto"]) === "string" && v["Supuesto"].trim() ? { ...b, supuesto: v["Supuesto"] } : b;
  });
}

/* UNA LISTA PARCIAL SE DICE (ensayo 8, owner 2026-10-08): un universo con menos entidades que su eje (los 3 de mayor venta, unas cuentas nombradas, las que están en mora) es una vista parcial: `parcial: "k de N"`. Con ella no se afirma el orden del total (el mayor, el menor, el que más creció, el más grave): lo dice la
 * cabecera de uso y el extremo se le pide a ADI (un top de 1, `catalogo.universo.extremo`). La marca es corta a propósito: viaja en cada universo parcial. */
function _parcial(u, tamanosDeEje) {
  const N = tamanosDeEje && u && typeof u.eje === "string" ? tamanosDeEje[u.eje] : null;
  const n = u && Array.isArray(u.entidades) ? u.entidades.length : null;
  return Number.isInteger(N) && Number.isInteger(n) && n < N ? `${n} de ${N}` : null;
}

function _compactarEntrega(entrega, turno, tamanosDeEje = null) {
  const texto = entrega.texto;
  const j = entrega.json && typeof entrega.json === "object" ? entrega.json : null;
  if (!j) return { texto };
  const filas = (j.cifras && Array.isArray(j.cifras.filas)) ? j.cifras.filas : [];
  const prov = j.procedencia || {};
  /* ensayo 4: el total del listado viaja en `cifras` con su id `E<n>.h<k>`; el hecho del libro del que sale (la suma, con todos sus sumandos escritos) no se repite además como «apoyo»: pesaba ~250 B por total y el total ya viaja en `lectura`/`decision` también.
   * Ensayo 5: lo mismo con las cifras de `fueraDelTexto` (ya viajan con su `E<n>.h<k>`): no se repiten con un segundo id que no se deriva igual. */
  const apoyo = _apoyoDe(String(texto || ""), filas, [{ libro: prov.libro }, { libro: prov.libroPremisas, premisa: true }, { libro: prov.libroIniciativa }], turno, hechosQueYaViajan(j));
  const m = j.marco || {};
  /* `definiciones` y `referencia`: los criterios con que se calculó (piso, techo, benchmark) cada uno con SU origen («declarado por la empresa» · «criterio general de ADI») — lo que la persona preguntará: «¿con qué criterio?» */
  const marco = _soloConValor({ empresa: m.empresa, periodo: m.periodo, universo: m.universo, moneda: m.moneda, definiciones: _noVacio(m.definiciones) ? m.definiciones : null, referencia: m.referenciaDeclarada && m.referenciaDeclarada.texto ? m.referenciaDeclarada.texto : null, perfil: _perfilBreve(m.perfil) });
  /* el id del universo es el que el libro le da por posición (`E<n>.u<k>`): el que una persona puede citar después con `contexto.universoRef` */
  const universos = (Array.isArray(j.universos) ? j.universos : []).map((u, k) => _soloConValor({ id: `E${turno}.u${k + 1}`, parte: u.id, eje: u.eje, texto: u.texto, n: Array.isArray(u.entidades) ? u.entidades.length : null, parcial: _parcial(u, tamanosDeEje), ...(Array.isArray(u.entidades) && u.entidades.length <= ENTIDADES_DE_UN_UNIVERSO_MAX ? { entidades: u.entidades } : {}), ...(u.valido === false ? { valido: false, errorValidacion: u.errorValidacion || null } : {}) }));
  const me = j.meta || {};
  const alcance = _soloConValor({ profundidad: me.profundidad, palabras: me.palabras, tope: me.tope, filas: me.filas, topeFilas: me.topeFilas, recortoFilas: me.recortoFilas, recortoOraciones: me.recortoOraciones, excedeTope: me.excedeTope });
  const d = j.detalle && typeof j.detalle === "object" ? j.detalle : null;
  let detalle = null;
  if (d) {
    /* cada cifra de `fueraDelTexto` lleva el id que el libro le da (§8.2 del Contrato del Anfitrión: «toda cifra que viaja al anfitrión lleva id»): van DESPUÉS de las filas y los totales de la tabla, en el orden del detalle */
    const nDeLaTabla = _hechosDeLaEntrega(j, { conFueraDelTexto: false }).length;
    /* NUNCA UNA CIFRA SIN ID (ensayo 5): si el libro no las pudo guardar ni cediendo todo lo anterior (el tope de la base: solo una Entrega enorme), NO viajan — `entrega.fueraNoCabe` lo dice `acciones.js` — y el detalle dice cuántas son y cómo pedirlas */
    const noCabe = typeof entrega.fueraNoCabe === "number" && entrega.fueraNoCabe > 0 ? entrega.fueraNoCabe : 0;
    const fuera = Array.isArray(d.filas) && d.filas.length && !noCabe
      ? cifrasDeLaEntrega({ hechos: _hechosDeLaEntrega({ cifras: { filas: d.filas }, procedencia: prov }).map((h, k) => ({ ...h, id: `E${turno}.h${nDeLaTabla + k + 1}` })) }).map((c) => _cifraBreve(c))
      : [];
    detalle = _soloConValor({
      comoPedirlo: d.comoPedirlo || null, notaDeUso: _noVacio(d.notaDeUso) ? d.notaDeUso : null,
      fueraDelTexto: fuera.length ? fuera : null, fueraNoCabe: noCabe ? { n: noCabe, nota: "no caben en la memoria de la conversación: ADI no entrega una cifra que no pueda citar después; pídalas con una consulta acotada (comoPedirlo)" } : null, oraciones: _noVacio(d.oraciones) ? d.oraciones : null, iniciativaNoVerificada: _noVacio(d.iniciativaNoVerificada) ? d.iniciativaNoVerificada : null,
    });
    if (!Object.keys(detalle).length) detalle = null;
  }
  return _soloConValor({
    texto, cifras: cifrasDeLaConsulta(j, turno), apoyo: apoyo.length ? apoyo : null, marco, universos: universos.length ? universos : null,
    alcance, detalle, temasCubiertos: j.temasCubiertos || null, verificacion: j.verificacion || null,
  });
}

function _compactarConsultar(s) {
  if (!s || typeof s !== "object") return s;
  if (!s.entrega) { const { tamanosDeEje, ...r } = s; return r; }                // sin Entrega (rechazo, nada resuelto): ya es chica
  const { entrega, tamanosDeEje, ...resto } = s;
  const ev = resto.continuidad && resto.continuidad.estadoVigente;
  const turno = ev && Number.isInteger(ev.turno) ? ev.turno : null;
  return { ok: resto.ok, entrega: _compactarEntrega(entrega, turno, tamanosDeEje), ...Object.fromEntries(Object.entries(resto).filter(([k]) => k !== "ok")) };
}

/* ── CONOCER EMPRESA ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────── */
const _mismo = (a, b) => JSON.stringify(a) === JSON.stringify(b);

function _compactarPerfil(perfil) {
  if (!perfil || typeof perfil !== "object" || !perfil.campos) return perfil;
  const campos = {};
  for (const [k, v] of Object.entries(perfil.campos)) {
    if (!v || typeof v !== "object") { campos[k] = v; continue; }
    const { insumos, ventaAnual, ...visible } = v;                                // los insumos del cálculo del tamaño son mecanismo; el valor, su procedencia y su explicación quedan
    campos[k] = { valor: null, procedencia: null, ..._soloConValor(visible) };   // «sin declarar» se dice (valor: null), no se calla
  }
  return { ...perfil, campos };
}

/** `comoDeclarar` de cada concepto sigue UNA forma por clase: se dice una vez (`formas`) y cada concepto solo trae lo suyo (`forma` = cuál); el que se salga de la forma conserva el suyo */
function _compactarDeclarable(decl) {
  if (!decl || typeof decl !== "object") return decl;
  const formas = {};
  const idDe = new Map();
  const aplicar = (lista) => (Array.isArray(lista) ? lista : []).map((it) => {
    const c = it && it.comoDeclarar;
    if (!c || typeof c !== "object" || !c.valor || typeof c.valor !== "object") return it;
    const esperada = { ...c, concepto: it.concepto, valor: { ...c.valor, unidad: it.unidad } };
    if (!_mismo(c, esperada)) return it;                                           // el concepto o la unidad no son los del item: se sale de la forma, conserva la suya
    const molde = { ...c, concepto: "<concepto>", valor: { ...c.valor, unidad: "<unidad>" } };
    const llave = JSON.stringify(molde);
    if (!idDe.has(llave)) { const id = `f${idDe.size + 1}`; idDe.set(llave, id); formas[id] = molde; }
    const { comoDeclarar, ...resto } = it;
    return { ...resto, forma: idDe.get(llave) };
  });
  const out = { ...decl };
  for (const k of ["criterios", "hechos", "citables"]) if (decl[k]) out[k] = aplicar(decl[k]);
  return { formas, ...out };
}

function _compactarCatalogo(cat, datos) {
  if (!cat || typeof cat !== "object") return cat;
  const out = {};
  for (const [k, v] of Object.entries(cat)) {
    if (k === "periodos" && datos && _mismo(v, datos.periodo)) continue;           // lo dice `datos.periodo`
    if (k === "moneda" && datos && v === datos.moneda) continue;                    // lo dice `datos.moneda`
    if (k === "temas" && Array.isArray(v)) {
      out.temas = v.map((t) => ({ ...t, conceptos: (t.conceptos || []).map((c) => { const { referencia, negocio, ejes, ...r } = c; return { ...r, ...(referencia ? { referencia: true } : {}), ...(negocio ? { negocio: true } : {}), ...(Array.isArray(ejes) && ejes.length ? { ejes } : {}) }; }) }));
      continue;
    }
    if ((k === "definiciones" || k === "estados") && Array.isArray(v)) { out[k] = v.map((x) => { const { fuente, ...r } = x || {}; return _soloConValor(r); }); continue; }   // la fuente es el nombre interno del mecanismo
    if (k === "conceptosDeDefinicion" && Array.isArray(v) && v.every((x) => x && typeof x.id === "string" && typeof x.rotulo === "string" && Object.keys(x).length === 2)) {   // id → rótulo (o los rótulos, cuando un mismo id se pide con dos)
      const m = {};
      for (const x of v) m[x.id] = m[x.id] === undefined ? x.rotulo : [].concat(m[x.id], x.rotulo);
      out[k] = m; continue;
    }
    out[k] = v;
  }
  return out;
}

function _compactarConocer(s) {
  if (!s || typeof s !== "object" || s.ok === false) return s;
  const out = { ...s };
  if (s.perfil) out.perfil = _compactarPerfil(s.perfil);
  if (s.catalogo) {
    out.catalogo = _compactarCatalogo(s.catalogo, s.datos);
    if (out.catalogo && s.empresa && _mismo(out.catalogo.empresa, s.empresa)) { const { empresa, ...r } = out.catalogo; out.catalogo = r; }
  }
  if (s.declarable) out.declarable = _compactarDeclarable(s.declarable);
  return out;
}

/* ── RETOMAR ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────── */
const _sinCrudo = (x) => { if (!x || typeof x !== "object") return x; const { raw, unidad, ...r } = x; return r; };
function _compactarRevalidacion(rv) {
  if (!rv || typeof rv !== "object") return rv;
  const out = { ...rv };
  if (rv.anterior) out.anterior = _sinCrudo(rv.anterior);
  if (rv.actual) out.actual = _sinCrudo(rv.actual);
  if (rv.diferencia && typeof rv.diferencia === "object") { const { valor, ...r } = rv.diferencia; out.diferencia = r; }   // el valor crudo de la diferencia no se imprime: la que se dice es `texto`
  return out;
}
function _compactarRetomar(s) {
  if (!s || typeof s !== "object" || s.ok === false) return s;
  const hechos = (Array.isArray(s.hechos) ? s.hechos : []).map((h) => _soloConValor({
    id: h.id, sujeto: h.sujeto, metrica: h.metrica, valor: h.valor, origen: h.origen, ...(Array.isArray(h.sobre) ? { sobre: h.sobre } : {}), ...(h.descripcion ? { descripcion: h.descripcion } : {}), ...(h.universo ? { universo: h.universo } : {}),
    estadoReverificacion: h.estadoReverificacion, ...(h.valorNuevo != null ? { valorNuevo: h.valorNuevo } : {}), revalidacion: _compactarRevalidacion(h.revalidacion),
  }));
  const entregas = (Array.isArray(s.entregas) ? s.entregas : []).map((e) => _soloConValor(Object.fromEntries(Object.entries(e || {}).map(([k, v]) => [k, Array.isArray(v) && !v.length ? null : v]))));
  return { ...s, hechos, entregas };
}

/** compactarParaAnfitrion(accion, salida) → la respuesta que viaja al anfitrión (las cuatro acciones). Pura: no muta `salida`. */
export function compactarParaAnfitrion(accion, salida) {
  if (accion === "consultar") return _compactarConsultar(salida);
  if (accion === "conocerEmpresa") return _compactarConocer(salida);
  if (accion === "retomar") return _compactarRetomar(salida);
  if (accion === "derivar") return salida;                                         // la derivación ya sale en su forma de anfitrión (un hecho, sus operandos, el uso): viaja tal cual
  return salida;                                                                   // aportarContexto: ya es chica, viaja tal cual
}
