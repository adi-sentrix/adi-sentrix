/* === src/adi/capacidad/ensenar.js · UN RECHAZO ENSEÑA (ensayo 5, owner 2026-10-07 · `_ADI_DISENO_CONTRATO_ANFITRION.md` §11) ═════════════════════════════════════════════════════════
 * En el ensayo 5, 9 de 48 `consultar` se rechazaron con `universo_invalido` y `alternativas: []`: el anfitrión adivinó la forma del universo (`{"top":5}`, `{"estado":"en mora"}`, `{"marca":"Alsen"}`, `direccion:"desc"`) porque
 * el catálogo no documentaba `filtros` ni la forma de `universo`, y el rechazo decía QUÉ estaba mal pero no CUÁL era la forma válida. Dos piezas, una sola fuente (las mismas listas con las que el validador decide):
 *   · `guiaDeUniverso()` → la forma de un universo, documentada para esta empresa (campos, direcciones, operadores, estados y conjuntos por eje, ejemplos válidos): va en `catalogo.universo` de `conocerEmpresa`;
 *   · `ensenarRechazos(noResuelto, { encargo, libro })` → cada rechazo de `consultar` con ALTERNATIVAS: lo que SÍ es válido en el lugar donde falló, compacto y de esta empresa (los ejes, los estados del eje, las métricas con cifras
 *     en ese eje, los nombres de las entidades, los valores de un campo cerrado…). Solo rellena lo que viene vacío: jamás pisa las alternativas ni el detalle que ya trae el validador, y no toca la Entrega ni el Core.
 * Puro: sin I/O, sin red; lee el tenant ACTIVO (los nombres de las entidades), así que se llama dentro del tramo del Core. Ninguna cifra: describe QUÉ existe, no CUÁNTO vale. Cero `node:*`. */
import { CAMPOS_UNIVERSO, EJES_VALIDOS, DIRECCIONES_DE_TOP, SOBRE_DE_TOP } from "../notario/hechos.js";
import { estadosValidosPara } from "../notario/estados.js";
import { CONJUNTOS_DE_LA_CASA } from "../notario/conjuntosDeLaCasa.js";
import { OPS } from "../notario/lexico.js";
import { axisEntityNames, resolveCanonical } from "../oracle/entityIndex.js";
import { DOMINIOS_REGISTRO, idsActivos } from "../../config/contract/dominios.js";
import { ASSUMPTIONS } from "../../config/contract/assumptionRegistry.js";
import { CRITERIOS } from "../agente/prioridadIntegrada.js";
import {
  CAMPOS_RAIZ, CAMPOS_PARTE, CIERRES, TIPOS_DE_PREMISA, USAR_VALORES, PROFUNDIDAD_VALORES, INICIATIVA_VALORES, PARTES_MAX, SUPUESTOS_USUARIO_MAX, EJES, ejesConProductor,
} from "../encargo/esquema.js";

const _unicos = (xs) => [...new Set(xs)];
const _es = (x) => x !== null && typeof x === "object" && !Array.isArray(x);
/** hasta cuántos nombres de entidades se listan completos (= lo que un universo lista a la vista, `compacto.js:ENTIDADES_DE_UN_UNIVERSO_MAX`); de un eje mayor, cuántas son y tres ejemplos */
const NOMBRES_MAX = 40;

/** los conceptos (claves del catálogo) que tienen cifras en un eje: los que un `top.metrica` o un `filtros[].metrica` de ese eje admiten */
export function metricasDelEje(eje) {
  return _unicos(DOMINIOS_REGISTRO.filter((d) => d.estado === "activo").flatMap((d) => (Array.isArray(d.metricas) ? d.metricas : []))).filter((k) => ejesConProductor(k).includes(eje));
}
const _conjuntosDelEje = (eje) => CONJUNTOS_DE_LA_CASA.filter((c) => c.familia !== "estado" && c.eje === eje).map((c) => c.nombre);

/* ── LA FORMA DE UN UNIVERSO, DOCUMENTADA (va en `catalogo.universo`) ──────────────────────────────────────────────────────────────────────────────────────────────────────────── */
/* el catálogo no lleva ninguna cifra (ni siquiera de ejemplo): lo que es un número se escribe como lo que falta poner, «<cantidad>» · «<número>» */
const _K = "<cantidad>", _N = "<número>", _UNO = "<1: un solo extremo>";
const _EJEMPLO_DE_TOP = (eje) => { const m = metricasDelEje(eje)[0]; return m ? { eje, top: { metrica: m, k: _K, direccion: DIRECCIONES_DE_TOP[0] } } : null; };
export function guiaDeUniverso() {
  const ejesConEntidades = EJES.filter((e) => axisEntityNames(e).length);
  const estados = {}, conjuntos = {};
  for (const e of ejesConEntidades) { const es = estadosValidosPara(e); if (es.length) estados[e] = es; const cs = _conjuntosDelEje(e); if (cs.length) conjuntos[e] = cs; }
  const eC = ejesConEntidades.includes("cliente") ? "cliente" : ejesConEntidades[0];
  const estadoDeC = eC && estados[eC] ? estados[eC][0] : null;
  const metricaDeFiltro = eC ? (metricasDelEje(eC).find((k) => k === "dias_vencido") || metricasDelEje(eC)[0]) : null;
  return {
    forma: "El universo de una parte acota sobre qué entidades se calcula: un texto («negocio»), una lista de nombres de entidades (se lee como las entidades de la parte: sirve exactamente esas, sin las demás del eje ni su total), o un objeto de UN eje con alguno de estos campos (todos opcionales). Los campos son exactamente estos; cualquier otro se rechaza.",
    ejes: EJES_VALIDOS.filter((e) => ejesConEntidades.includes(e)),
    campos: {
      eje: "el eje del universo (uno de «ejes»); por omisión, el de la parte",
      top: `{ metrica, k, direccion } — las k primeras por esa métrica; direccion: ${DIRECCIONES_DE_TOP.join(" · ")}; sobre?: ${SOBRE_DE_TOP.join(" · ")}; metrica: un concepto del catálogo con cifras en ese eje`,
      estados: "[estado, …] — las entidades que están en esos estados (los de «estados» para el eje); en plural y con la lista: «estado» a secas no existe",
      no_estados: "[estado, …] — las que NO están en esos estados",
      filtros: `[{ metrica, op, valor }] — metrica: un concepto con cifras en ese eje; op: ${OPS.join(" · ")}; valor: un número (con «entre»: [desde, hasta])`,
      base: "el nombre de un conjunto de la casa (los de «conjuntos» para el eje)",
      bodega: "solo con eje sku y solo para el inventario (capital, días de inventario, rotación, unidades en stock): la venta no se abre por bodega — pida la venta por cliente, marca, familia, producto o canal, o nombre los productos",
      excluir: "{ entidades?, conjuntos?, estados?, top?, bodega? } — lo que se saca del universo",
      union: "[universo, …] — varios universos del MISMO eje, cada uno restringiendo algo",
    },
    estados,
    conjuntos,
    ejemplos: [_EJEMPLO_DE_TOP(eC), estadoDeC ? { eje: eC, estados: [estadoDeC] } : null, metricaDeFiltro ? { eje: eC, filtros: [{ metrica: metricaDeFiltro, op: ">", valor: _N }] } : null].filter(Boolean),
    extremo: {
      texto: "El mayor, el menor, el que más creció o el más grave sobre el total se le pide a ADI: un top de 1 por esa métrica (direccion: mayor · menor · peor · mejor), calculado sobre el universo completo del eje. Una lista parcial (marcada «parcial» en la Entrega) no autoriza a afirmar el orden del total.",
      ejemplo: eC && metricasDelEje(eC)[0] ? { eje: eC, top: { metrica: metricasDelEje(eC)[0], k: _UNO, direccion: DIRECCIONES_DE_TOP[0] } } : null,
    },
    limite: "Un universo no se acota por la marca, la familia o el canal de otro eje (los SKU no se filtran por marca): pida el eje marca, familia o canal, o nombre las entidades. Y la venta, el margen, la contribución y las unidades vendidas no se abren por bodega: el dato no dice qué bodega despachó cada venta (la bodega solo tiene inventario).",
  };
}

/* ── LA FORMA DE UNA SIMULACIÓN, DOCUMENTADA (ensayo 8, owner 2026-10-08) ──────────────────────────────────────────────────────────────────────────────────────────────────────
 * El anfitrión probó tres veces la simulación «+10 %» (el supuesto dentro de la parte, con otro alcance, sin id) y recibió «ningún supuesto citado tiene productor» sin saber qué faltaba. La forma que el Encargo exige: el supuesto en la RAÍZ con id, y la parte lo CITA por ese id. Sin cifras:
 * el ejemplo trae «<número>» y «<nombre exacto>»; el gate lo prueba contra el validador y contra `consultar` (con un número y una cuenta reales). `tipos` = los que corren en esta empresa (el catálogo los pasa; el rechazo, los de la forma). */
export function guiaDeSimulacion({ tipos = null, sinTipos = false } = {}) {
  const ejesConEntidades = EJES.filter((e) => axisEntityNames(e).length);
  const eje = ejesConEntidades.includes("cliente") ? "cliente" : ejesConEntidades[0] || "cliente";
  const lista = Array.isArray(tipos) && tipos.length ? tipos : Object.entries(ASSUMPTIONS).map(([tipo, def]) => ({ tipo, nombre: def.label, unidades: def.units }));
  const growth = lista.find((t) => t.tipo === "growth") || lista[0];
  return {
    forma: "Una simulación declara su supuesto en la RAÍZ del encargo, con un id —supuestos: [{ id, tipo, valor, unidad, alcance }]—, y la parte lo CITA por ese id —cierre: \"simulacion\", supuestos: [\"s1\"]—. valor: un número; unidad: una de las del tipo; alcance: \"negocio\" o { eje, nombre } con el nombre exacto de la entidad. Un supuesto escrito dentro de la parte, o sin id, también se lee, pero esta es la forma completa. Hasta " + SUPUESTOS_USUARIO_MAX + " supuestos por encargo. Los supuestos de una parte se aplican juntos, sobre el negocio o un mismo eje; si no se pueden combinar sin inventar un reparto, la parte se rechaza con la razón.",
    ...(sinTipos ? {} : { tipos: lista.map((t) => ({ tipo: t.tipo, ...(t.nombre ? { nombre: t.nombre } : {}), unidades: t.unidades })) }),
    ejemplo: {
      version: "encargo/v1",
      supuestos: [{ id: "s1", tipo: growth ? growth.tipo : "growth", valor: _N, unidad: growth && growth.unidades ? growth.unidades[0] : "pct", alcance: { eje, nombre: "<nombre exacto>" } }],
      partes: [{ id: "p1", tema: "comercial", cierre: "simulacion", conceptos: ["ventas"], eje, entidades: ["<nombre exacto>"], supuestos: ["s1"] }],
    },
  };
}

/* ── LAS ALTERNATIVAS DE UN UNIVERSO INVÁLIDO ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────── */
const _singPlural = (k) => CAMPOS_UNIVERSO.find((c) => c !== k && (c === `${k}s` || `${c}` === `${k}es` || `${c}s` === k));
function _alternativasDeUniverso(valor, ejeDeLaParte) {
  const g = guiaDeUniverso();
  const alt = [];
  const u = _es(valor) ? valor : null;
  const eje = (u && typeof u.eje === "string" && EJES_VALIDOS.includes(u.eje) ? u.eje : null) || (EJES_VALIDOS.includes(ejeDeLaParte) ? ejeDeLaParte : null);
  const raros = u ? Object.keys(u).filter((k) => !CAMPOS_UNIVERSO.includes(k)) : [];
  for (const k of raros) {
    const parecido = _singPlural(k);
    if (parecido) alt.push({ tipo: "campo_de_universo", campo: parecido, forma: g.campos[parecido], en_lugar_de: k });
    else if (EJES.includes(k)) alt.push({ tipo: "limite", texto: g.limite, ejeSolicitado: k });
  }
  if (!u || raros.length) alt.push({ tipo: "campos_de_universo", validos: CAMPOS_UNIVERSO.slice(), forma: g.forma });
  if (u && u.eje != null && !EJES_VALIDOS.includes(u.eje)) alt.push({ tipo: "ejes", validos: g.ejes });
  if (u && u.top != null) alt.push({ tipo: "top", forma: g.campos.top, metricas: eje ? metricasDelEje(eje) : undefined, ejemplo: { top: { metrica: (eje ? metricasDelEje(eje)[0] : null) || "ventas", k: _K, direccion: DIRECCIONES_DE_TOP[0] } } });
  if (u && u.filtros != null) alt.push({ tipo: "filtros", forma: g.campos.filtros, operadores: OPS.slice(), metricas: eje ? metricasDelEje(eje) : undefined });
  for (const c of ["estados", "no_estados"]) if (u && u[c] != null) alt.push({ tipo: c, eje: eje || undefined, validos: eje ? estadosValidosPara(eje) : g.estados });
  if (u && u.base != null) alt.push({ tipo: "conjuntos", eje: eje || undefined, validos: eje ? _conjuntosDelEje(eje) : g.conjuntos });
  if (u && u.bodega != null) alt.push({ tipo: "bodegas", nota: "solo con eje sku", validas: axisEntityNames("bodega").slice(0, NOMBRES_MAX) });
  if (u && eje && u.eje != null && ejeDeLaParte && u.eje !== ejeDeLaParte) alt.push({ tipo: "eje", eje: ejeDeLaParte, nota: "el universo debe ser del mismo eje que la parte" });
  if (!alt.some((a) => a.tipo === "top" || a.tipo === "filtros")) alt.push({ tipo: "ejemplos", validos: g.ejemplos });
  return alt.map((a) => Object.fromEntries(Object.entries(a).filter(([, v]) => v !== undefined)));
}

/* ── LAS ENTIDADES DE UN EJE ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────── */
const _entidadesDe = (eje) => { const ns = axisEntityNames(eje); return { tipo: "entidades_del_eje", eje, n: ns.length, ...(ns.length <= NOMBRES_MAX ? { nombres: ns.slice() } : { ejemplos: ns.slice(0, 3) }) }; };

/* ── LA VENTA NO SE ABRE POR BODEGA (ensayo 6, owner 2026-10-08): lo que SÍ se puede ──────────────────────────────────────────────────────────────────────────────────────────────── */
/* el inventario de esa bodega (con las métricas que el dato publica por bodega), la venta de los productos que el usuario nombre (los conceptos pedidos que tienen cifras por SKU) y los ejes donde la venta sí se abre */
function _alternativasDeVentaPorBodega(nr) {
  const todas = axisEntityNames("bodega");
  const pedidas = (Array.isArray(nr.bodegas) ? nr.bodegas : []).map((n) => resolveCanonical("bodega", n)).filter(Boolean);
  const pedidos = (Array.isArray(nr.conceptos) ? nr.conceptos : []).filter((k) => ejesConProductor(k).includes("sku"));
  return [
    { tipo: "inventario_por_bodega", tema: "inventario", eje: "bodega", conceptos: metricasDelEje("bodega"), bodegas: _unicos(pedidas.length ? pedidas : todas).slice(0, NOMBRES_MAX), nota: "el inventario sí se abre por bodega" },
    { tipo: "venta_por_producto", tema: "comercial", eje: "sku", conceptos: pedidos.length ? pedidos : ["ventas"], nota: "nombre los productos (entidades con eje sku) o pida el eje sku entero, sin bodega" },
    { tipo: "ejes_de_la_venta", validos: EJES.filter((e) => ejesConProductor("ventas").includes(e)) },
  ];
}

/* ── LA TABLA: motivo → sus alternativas (solo cuando vienen vacías) ─────────────────────────────────────────────────────────────────────────────────────────────────────────── */
const _TEMAS = () => idsActivos();
const _lista = (tipo, clave, validos) => [{ tipo, [clave]: validos.slice() }];
function _alternativasDe(nr, { parte, libro }) {
  const eje = parte && (typeof parte.eje === "string" ? parte.eje : (_es(parte.universo) && typeof parte.universo.eje === "string" ? parte.universo.eje : null));
  switch (nr.motivo) {
    case "universo_invalido": return _alternativasDeUniverso(nr.valor, eje);
    case "entidad_inexistente": {
      const ref = _es(nr.valor) ? nr.valor : null;
      const e = (ref && typeof ref.eje === "string" && EJES.includes(ref.eje) ? ref.eje : null) || (eje && EJES.includes(eje) ? eje : null);
      return e ? [_entidadesDe(e)] : EJES.filter((x) => axisEntityNames(x).length).map(_entidadesDe);
    }
    case "concepto_desconocido": {
      const tema = parte && DOMINIOS_REGISTRO.find((d) => d.id === parte.tema);
      return [{ tipo: "conceptos", ...(tema ? { tema: tema.id } : {}), claves: tema ? (tema.metricas || []).slice() : _unicos(DOMINIOS_REGISTRO.flatMap((d) => d.metricas || [])) }];
    }
    case "campo_desconocido": return [{ tipo: "campos_de_encargo", validos: (nr.parte ? CAMPOS_PARTE : CAMPOS_RAIZ).slice() }];
    case "version_invalida": return [{ tipo: "version", valor: "encargo/v1" }];
    case "encargo_vacio": return [{ tipo: "parte", forma: "{ id, tema, cierre, conceptos?, entidades?, eje?, universo? }", temas: _TEMAS(), cierres: CIERRES.slice() }];
    case "partes_tope": return [{ tipo: "maximo", partes: PARTES_MAX }];
    case "supuesto_tope": return [{ tipo: "maximo", supuestos: SUPUESTOS_USUARIO_MAX }];
    case "origen_no_admitido": return _lista("origen", "validos", ["supuesto", "declarado"]);
    case "supuesto_mal_formado": case "supuesto_sin_productor": return [{ tipo: "supuestos_admitidos", tipos: Object.keys(ASSUMPTIONS), alcance: "\"negocio\" o { eje, nombre }" }, { tipo: "forma_de_simulacion", ...guiaDeSimulacion() }];
    case "premisa_mal_formada": return _lista("tipos_de_premisa", "validos", TIPOS_DE_PREMISA);
    case "usar_invalido": return _lista("usar", "validos", USAR_VALORES);
    case "profundidad_invalida": return _lista("profundidad", "validos", PROFUNDIDAD_VALORES);
    case "iniciativa_invalida": return _lista("iniciativa", "validos", INICIATIVA_VALORES);
    case "contexto_mal_formado": case "contexto_no_disponible": {
      const ns = libro && Array.isArray(libro.entregas) ? libro.entregas.filter((e) => e && !e.recortada).map((e) => `E${e.n}`) : [];
      return [{ tipo: "contexto", forma: "E<n> (una Entrega), E<n>.h<k> (una cifra) o E<n>.u<k> (un universo)", entregas: ns }];
    }
    case "cierre_incompleto": return parte && parte.cierre === "simulacion" && /supuesto/.test(String(nr.detalle || "")) ? [{ tipo: "forma_de_simulacion", ...guiaDeSimulacion() }] : [{ tipo: "cierres", validos: CIERRES.slice() }];
    case "cierre_desconocido": case "cardinalidad": return [{ tipo: "cierres", validos: CIERRES.slice() }];
    case "tema_desconocido": case "tema_ausente": return _lista("temas", "validos", _TEMAS());
    case "eje_no_soportado": case "ejes_mezclados": case "cruce_bloqueado": return _lista("ejes", "validos", EJES);
    case "concepto_de_otro_tema": case "concepto_sin_productor": return [{ tipo: "conceptos", claves: _unicos(DOMINIOS_REGISTRO.filter((d) => d.estado === "activo").flatMap((d) => d.metricas || [])).filter((k) => ejesConProductor(k).length) }];
    case "entidad_ambigua": case "entidad_eje_incompatible": return EJES.filter((x) => axisEntityNames(x).length).map(_entidadesDe);
    case "periodo_mal_formado": case "periodo_no_disponible": return [{ tipo: "periodo", tipos: ["vigente", "mes", "rango"], forma: "{ tipo: vigente } · { tipo: mes, valor: AAAA-MM } · { tipo: rango, valor: { desde, hasta } } (fechas AAAA-MM-DD; mes y rango solo con una entidad puntual que tenga serie real)" }];
    case "criterio_desconocido": case "criterio_tesoreria": return [{ tipo: "criterios", lentes: Object.keys(CRITERIOS) }];
    case "formato_invalido": return nr.esperado ? [{ tipo: "forma", campo: nr.campo, esperado: nr.esperado }] : [];
    case "venta_por_bodega": return _alternativasDeVentaPorBodega(nr);
    default: return [];
  }
}

/** ensenarRechazos(noResuelto, { encargo, libro }) → noResuelto con ALTERNATIVAS en cada rechazo que venía sin ellas. Copia: no muta lo que recibe. Un rechazo que ya trae alternativas queda idéntico; uno cuyo motivo no tiene tabla recibe el
 *  puntero al catálogo (nunca una lista vacía). */
export function ensenarRechazos(noResuelto, { encargo = null, libro = null } = {}) {
  const partes = encargo && Array.isArray(encargo.partes) ? encargo.partes : [];
  return (Array.isArray(noResuelto) ? noResuelto : []).map((nr) => {
    if (!nr || (Array.isArray(nr.alternativas) && nr.alternativas.length)) return nr;
    const parte = nr.parte != null ? partes.find((p) => p && p.id === nr.parte) || null : null;
    let alt = [];
    try { alt = _alternativasDe(nr, { parte, libro }); } catch { alt = []; }
    if (!alt.length) alt = [{ tipo: "catalogo", donde: "conocerEmpresa → catalogo", nota: "lo válido para esta empresa está en el catálogo (temas, conceptos, ejes, cierres, universo)" }];
    return { ...nr, alternativas: alt };
  });
}
