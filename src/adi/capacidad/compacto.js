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

/* quiénes son los miembros de un universo se dice cuando es un conjunto que cabe a la vista (hasta 40 nombres); de uno mayor viaja solo cuántos son (`n`) */
export const ENTIDADES_DE_UN_UNIVERSO_MAX = 40;
export const REFERENCIA_DE_TAMANO_BYTES = 20 * 1024;   // REFERENCIA de prueba (owner), no una regla: el requisito real es que quepa limpiamente en el anfitrión sin perder información necesaria

const _soloConValor = (o) => { const r = {}; for (const [k, v] of Object.entries(o)) if (v !== null && v !== undefined) r[k] = v; return r; };
const _noVacio = (x) => (Array.isArray(x) ? x.length > 0 : x !== null && x !== undefined && x !== "" && !(typeof x === "object" && Object.keys(x).length === 0));

/* ── CONSULTAR ───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────── */
const _esc = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
/** ¿el texto imprime este valor? (límites de número: «$17.3M» no está dentro de «$117.3M» ni de «$17.35M») — y «95d» (la forma del libro) es «95 días» en el texto */
function _impreso(texto, p) {
  const formas = [p];
  const d = /^(-?\d+)d$/.exec(p);
  if (d) formas.push(`${d[1]} días`, `${d[1]} día`);
  return formas.some((f) => new RegExp(`(?<![\\w.,$-])${_esc(f)}(?![\\w]|[.,]\\d)`).test(texto));
}
const _conDigito = (s) => typeof s === "string" && /\d/.test(s);
const _enteroSuelto = (s) => /^-?\d+$/.test(String(s).trim());
/** los valores con unidad que escribe una oración de la casa («Jumbo: venta $17.3M, puesto 3 de 13…» → $17.3M): el valor impreso es lo que la casa escribió, nunca uno recalculado */
const _RX_VALOR = /-?\$?\d[\d.,]*(?:\s?(?:M|K|pp|x|d|días?)\b|%)?/g;
const _conUnidad = (p) => /[$%]|\d(?:M|K|x|d|pp)$|\s(?:días?|pp)$/.test(p);
const _hojas = (x, out = []) => { if (typeof x === "string") out.push(x); else if (Array.isArray(x)) x.forEach((y) => _hojas(y, out)); else if (x && typeof x === "object") Object.values(x).forEach((y) => _hojas(y, out)); return out; };
const _valoresDe = (txt) => (typeof txt === "string" ? (txt.match(_RX_VALOR) || []).map((x) => x.trim().replace(/[.,]+$/, "")).filter((x) => _conDigito(x) && _conUnidad(x)) : []);

function _apoyoDe(texto, filas, libros, n) {
  const enFilas = new Set();
  for (const f of filas) for (const id of (Array.isArray(f && f.hechos) ? f.hechos : [])) enFilas.add(id);
  const out = [];
  const vistos = new Set();
  for (const { libro, premisa } of libros) {
    for (const H of (libro && Array.isArray(libro.hechos) ? libro.hechos : [])) {
      if (!H || (!premisa && enFilas.has(H.id))) continue;
      const render = H.render && typeof H.render === "object" ? H.render : {};
      const candidatos = [render.valor, ...(Array.isArray(H.numeros) ? H.numeros.map((x) => x && x.texto) : []), ..._valoresDe(H.verdad), ..._hojas(render).flatMap(_valoresDe)].filter((s) => _conDigito(s) && !_enteroSuelto(s));
      const encontrados = [...new Set(candidatos)].filter((p) => _impreso(texto, p));
      let valor = encontrados.join(" · ");
      if (!valor && render.n != null && render.m != null && _impreso(texto, `${render.n} de ${render.m}`)) valor = `${render.n} de ${render.m}`;
      if (!valor) continue;
      const sujetos = H.roles && Array.isArray(H.roles.sujetos) ? H.roles.sujetos.filter(Boolean) : [];
      const hecho = typeof H.verdad === "string" ? H.verdad : null;
      const clave = `${valor}|${hecho}|${premisa ? 1 : 0}`;
      if (vistos.has(clave)) continue;
      vistos.add(clave);
      out.push(_soloConValor({
        id: `E${n}.${H.id}`, valor, hecho, ...(sujetos.length ? { entidad: sujetos.join(", ") } : {}),
        procedencia: H.procedencia || null, ...(premisa ? { premisa: true, veredicto: H.veredicto || null } : {}),
      }));
    }
  }
  return out;
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

function _compactarEntrega(entrega, turno) {
  const texto = entrega.texto;
  const j = entrega.json && typeof entrega.json === "object" ? entrega.json : null;
  if (!j) return { texto };
  const filas = (j.cifras && Array.isArray(j.cifras.filas)) ? j.cifras.filas : [];
  const prov = j.procedencia || {};
  const apoyo = _apoyoDe(String(texto || ""), filas, [{ libro: prov.libro }, { libro: prov.libroPremisas, premisa: true }, { libro: prov.libroIniciativa }], turno);
  const m = j.marco || {};
  /* `definiciones` y `referencia`: los criterios con que se calculó (piso, techo, benchmark) cada uno con SU origen («declarado por la empresa» · «criterio general de ADI») — lo que la persona preguntará: «¿con qué criterio?» */
  const marco = _soloConValor({ empresa: m.empresa, periodo: m.periodo, universo: m.universo, moneda: m.moneda, definiciones: _noVacio(m.definiciones) ? m.definiciones : null, referencia: m.referenciaDeclarada && m.referenciaDeclarada.texto ? m.referenciaDeclarada.texto : null, perfil: _perfilBreve(m.perfil) });
  /* el id del universo es el que el libro le da por posición (`E<n>.u<k>`): el que una persona puede citar después con `contexto.universoRef` */
  const universos = (Array.isArray(j.universos) ? j.universos : []).map((u, k) => _soloConValor({ id: `E${turno}.u${k + 1}`, parte: u.id, eje: u.eje, texto: u.texto, n: Array.isArray(u.entidades) ? u.entidades.length : null, ...(Array.isArray(u.entidades) && u.entidades.length <= ENTIDADES_DE_UN_UNIVERSO_MAX ? { entidades: u.entidades } : {}), ...(u.valido === false ? { valido: false, errorValidacion: u.errorValidacion || null } : {}) }));
  const me = j.meta || {};
  const alcance = _soloConValor({ profundidad: me.profundidad, palabras: me.palabras, tope: me.tope, filas: me.filas, topeFilas: me.topeFilas, recortoFilas: me.recortoFilas, recortoOraciones: me.recortoOraciones, excedeTope: me.excedeTope });
  const d = j.detalle && typeof j.detalle === "object" ? j.detalle : null;
  let detalle = null;
  if (d) {
    /* cada cifra de `fueraDelTexto` lleva el id que el libro le da (§8.2 del Contrato del Anfitrión: «toda cifra que viaja al anfitrión lleva id»): van DESPUÉS de las filas y los totales de la tabla, en el orden del detalle */
    const nDeLaTabla = _hechosDeLaEntrega(j, { conFueraDelTexto: false }).length;
    /* si el libro no las pudo guardar (el tope de 16 KB), viajan como siempre —sin id—: `entrega.fueraSinId` lo dice `acciones.js` */
    const fuera = Array.isArray(d.filas) && d.filas.length
      ? (entrega.fueraSinId === true
        ? cifrasDeLaEntrega({ hechos: _hechosDeLaEntrega({ cifras: { filas: d.filas }, procedencia: prov }) }).map((c) => { const { id, ...resto } = _cifraBreve(c); return resto; })
        : cifrasDeLaEntrega({ hechos: _hechosDeLaEntrega({ cifras: { filas: d.filas }, procedencia: prov }).map((h, k) => ({ ...h, id: `E${turno}.h${nDeLaTabla + k + 1}` })) }).map((c) => _cifraBreve(c)))
      : [];
    detalle = _soloConValor({
      comoPedirlo: d.comoPedirlo || null, notaDeUso: _noVacio(d.notaDeUso) ? d.notaDeUso : null,
      fueraDelTexto: fuera.length ? fuera : null, oraciones: _noVacio(d.oraciones) ? d.oraciones : null, iniciativaNoVerificada: _noVacio(d.iniciativaNoVerificada) ? d.iniciativaNoVerificada : null,
    });
    if (!Object.keys(detalle).length) detalle = null;
  }
  return _soloConValor({
    texto, cifras: cifrasDeLaConsulta(j, turno), apoyo: apoyo.length ? apoyo : null, marco, universos: universos.length ? universos : null,
    alcance, detalle, temasCubiertos: j.temasCubiertos || null, verificacion: j.verificacion || null,
  });
}

function _compactarConsultar(s) {
  if (!s || typeof s !== "object" || !s.entrega) return s;                       // sin Entrega (rechazo, nada resuelto): ya es chica
  const { entrega, ...resto } = s;
  const ev = resto.continuidad && resto.continuidad.estadoVigente;
  const turno = ev && Number.isInteger(ev.turno) ? ev.turno : null;
  return { ok: resto.ok, entrega: _compactarEntrega(entrega, turno), ...Object.fromEntries(Object.entries(resto).filter(([k]) => k !== "ok")) };
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
    id: h.id, sujeto: h.sujeto, metrica: h.metrica, valor: h.valor, origen: h.origen, ...(Array.isArray(h.sobre) ? { sobre: h.sobre } : {}),
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
