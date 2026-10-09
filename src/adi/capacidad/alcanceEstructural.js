/* === src/adi/capacidad/alcanceEstructural.js · EL ALCANCE DE LO ENTREGADO VIAJA COMO DATO (owner 2026-10-09 · `_ADI_DISENO_ALCANCE_DE_LO_ENTREGADO.md` §2.1-§2.2) ═══════════════════════════════════════
 * La familia de errores del anfitrión en los ensayos 9-12: ADI entregó una verdad correcta y dejó IMPLÍCITO hasta dónde llega (de qué conjunto sale, cuánto cubre, qué orden tiene, qué no establece), y el modelo lo completó con lo
 * verosímil. La solución no es describirle cada forma de completarlo: es no dejar nada implícito. Cada universo y cada tabla que sale de ADI lleva cinco respuestas como CAMPOS:
 *   ¿cuánto cubre?  `cobertura` «3 de 13»          ¿qué regla eligió a estos?  `seleccion { tipo: top|filtro|estado|nombradas|completo|prioridad, … }`
 *   ¿en qué orden?  `orden` (universo) y `tablas[]`  ¿qué métrica está ordenada y cuál solo se muestra?  `metricas { <métrica>: «ordenada sobre los 13…» | «evaluada sobre los 13» | «solo de estos 3; el resto no evaluado» }`
 *   ¿qué pasa con el resto?  `resto { n, evaluado, nota? }`
 * Lo que ADI NO evaluó se dice con un valor, no con silencio: el modelo tiene un objeto que dice «no evaluado» donde antes tenía un hueco.
 *
 * ESTE ARCHIVO NO CALCULA CIFRAS NI RE-DECIDE NADA: describe, con las mismas piezas que la Entrega ya declaró (`entrega.universos[]`: eje · top · filtros · estados · excluir · base · entidades · orden · `ejeN`) y con la tabla de Cifras tal como se
 * entregó (el orden de las filas y los crudos del libro, `rv.raw`). El ORDEN de una tabla se LEE de lo servido (monótono de punta a punta por una métrica con valor para todas las filas del bloque); nunca se supone. Puro: sin `node:*`, sin Core.
 * `_alcance_estructural_gate` recomputa todo esto desde las filas del tenant (demo y Río Claro v1/v2) en los 532 encargos sellados. */
import { metricaPorClave, metricaDeClave } from "../notario/lexico.js";

const _norm = (s) => String(s == null ? "" : s).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
const _num = (x) => (typeof x === "number" && Number.isFinite(x) ? x : null);
const _esLista = (x) => Array.isArray(x) && x.length > 0;
const lista_ = _esLista;
const _sinNulos = (o) => { const r = {}; for (const [k, v] of Object.entries(o)) if (v !== null && v !== undefined) r[k] = v; return r; };

/* ── las filas de la tabla, con su entidad, su tema y sus cifras (una fila ancha trae varias) ──────────────────────────────────────────── */
function _filasDeLaTabla({ n, filas = [], hechos = [], totales = 0, filasFuera = [], desdeElLibro = false }) {
  const out = [];
  const nF = filas.length;
  const una = (f, h, idx, fuera) => {
    const v = (f && f.valores) || {};
    const rv = (h && h.rv) || null;
    const ancha = f ? (v["Métrica"] == null && v["Valor"] == null) : Boolean(rv && rv.metrica);
    const entidad = (h && h.sujeto) || (rv && rv.sujeto) || v["Entidad / grupo"] || v["Entidad"] || null;
    const ms = [];
    if (rv && ancha) {
      if (rv.metrica) ms.push({ label: rv.metrica, raw: _num(rv.raw), clave: rv.clave || null });
      for (const m of Array.isArray(rv.mas) ? rv.mas : []) if (m && m.metrica) ms.push({ label: m.metrica, raw: _num(m.raw), clave: m.clave || null });
    } else if (h && h.metrica) ms.push({ label: h.metrica, raw: rv ? _num(rv.raw) : null, clave: rv ? rv.clave || null : null });
    out.push({ idx, id: (h && h.id) || `E${n}.h${idx + 1}`, entidad, tema: v["Tema"] || null, ms, fuera });
  };
  if (desdeElLibro) { hechos.forEach((h, i) => una(null, h, i, !!(h && h.fuera))); return out; }   /* un libro guarda la tabla ya aplanada, con sus ids: sin el tema de cada fila */
  filas.forEach((f, i) => una(f, hechos[i], i, false));
  filasFuera.forEach((f, j) => una(f, hechos[nF + totales + j], nF + totales + j, true));
  return out;
}

/* ── ¿está ordenada la serie? (monótona de punta a punta; los empates valen; todo igual no es un orden) ───────────────────────────────── */
function _sentidoDe(xs) {
  if (xs.length < 2) return null;
  let baja = true, sube = true, hayCambio = false;
  for (let i = 1; i < xs.length; i++) { if (xs[i] > xs[i - 1]) { baja = false; hayCambio = true; } if (xs[i] < xs[i - 1]) { sube = false; hayCambio = true; } }
  if (!hayCambio) return null;
  return baja ? "mayor-a-menor" : sube ? "menor-a-mayor" : null;
}
const _TEXTO_DEL_SENTIDO = { "mayor-a-menor": "de mayor a menor", "menor-a-mayor": "de menor a mayor" };

/** ¿qué universos se agrupan para repartir las filas? Las cuentas NOMBRADAS de una misma parte son un universo por entidad: para la tabla son UN grupo. */
function _grupos(universos) {
  const g = [];
  universos.forEach((u, k) => {
    if (u.soloRanking) return;
    const tipo = tipoDeSeleccion(u);
    const ult = g[g.length - 1];
    if (tipo === "nombradas" && ult && ult.tipo === "nombradas" && ult.eje === u.eje) { ult.indices.push(k); for (const e of u.entidades) ult.entidades.add(e); return; }
    g.push({ tipo, eje: u.eje, indices: [k], entidades: new Set(u.entidades) });
  });
  return g;
}

/** tipoDeSeleccion(u) → "prioridad" | "top" | "filtro" | "estado" | "nombradas" | "completo" · se lee del universo declarado por la Entrega, nunca del texto */
export function tipoDeSeleccion(u) {
  if (u.orden) return "prioridad";
  if (u.top) return "top";
  const ex = u.excluir && typeof u.excluir === "object" ? u.excluir : null;
  const hayExcluir = !!(ex && (_esLista(ex.entidades) || _esLista(ex.conjuntos) || _esLista(ex.estados) || ex.bodega || (Array.isArray(ex.top) ? ex.top.length > 0 : !!ex.top)));
  const hayEstados = _esLista(u.estados) || _esLista(u.no_estados);
  if (_esLista(u.filtros) || hayExcluir || u.base || u.bodega || _esLista(u.union)) return (!_esLista(u.filtros) && !hayExcluir && !u.base && !u.bodega && !_esLista(u.union) && hayEstados) ? "estado" : "filtro";
  if (hayEstados) return "estado";
  const N = Number.isInteger(u.ejeN) ? u.ejeN : null;
  return N !== null && u.entidades.length < N ? "nombradas" : (N === null && u.entidades.length <= 1 ? "nombradas" : "completo");
}
const _acotaciones = (u) => {
  const ex = u.excluir && typeof u.excluir === "object" ? u.excluir : null;
  return [
    ...(_esLista(u.estados) || _esLista(u.no_estados) ? ["estados"] : []),
    ...(_esLista(u.filtros) ? ["filtros"] : []),
    ...(u.base ? ["base"] : []),
    ...(ex && (_esLista(ex.entidades) || _esLista(ex.conjuntos) || _esLista(ex.estados) || ex.bodega || (Array.isArray(ex.top) ? ex.top.length > 0 : !!ex.top)) ? ["excluir"] : []),
    ...(u.bodega ? ["bodega"] : []),
    ...(lista_(u.union) ? ["union"] : []),
  ];
};

/* ── LA ETIQUETA DE UNA MÉTRICA: la de la tabla si la tabla la trae (la que el anfitrión lee), si no la del léxico ─────────────────────── */
function _etiquetaDe(clave, filasDelBloque) {
  const m = metricaPorClave(clave);
  const nombre = m ? m.nombre : metricaDeClave(clave);
  for (const r of filasDelBloque) for (const x of r.ms) {
    if (x.clave && m && (x.clave === m.clave || _norm(x.clave) === _norm(m.clave))) return x.label;
    if (_norm(x.label) === _norm(nombre)) return x.label;
  }
  return nombre;
}

/** los ids de un grupo de filas como rangos contiguos: «E1.h1–E1.h24 y E1.h26–E1.h27» */
function rangoDeIds(rs) {
  const ord = [...rs].sort((x, y) => x.idx - y.idx);
  const runs = [];
  for (const r of ord) { const u = runs[runs.length - 1]; if (u && r.idx === u.fin.idx + 1) u.fin = r; else runs.push({ ini: r, fin: r }); }
  return runs.map((u) => (u.ini === u.fin ? u.ini.id : `${u.ini.id}–${u.fin.id}`)).join(" y ");
}

/** alcanceDeLaEntrega({ n, universos, filas, hechos, totales, filasFuera }) → { universos: [alcance|null por universo], tablas: [...] }
 *  `universos` = `entrega.universos` (con `ejeN`), `filas` = `cifras.filas`, `hechos` = la forma del libro (`_hechosDeLaEntrega`, con `rv.raw`), `totales` = cuántos totales de listado van entre la tabla y lo «fuera del texto», `filasFuera` = `detalle.filas`. */
export function alcanceDeLaEntrega({ n, universos = [], filas = [], hechos = [], totales = 0, filasFuera = [], desdeElLibro = false, partes = [] } = {}) {
  const filasT = _filasDeLaTabla({ n, filas, hechos, totales, filasFuera, desdeElLibro });
  const grupos = _grupos(universos);

  /* 1 · LOS BLOQUES: tramos contiguos de filas del mismo tema y del mismo universo. Cada fila se asigna al universo que la pidió: el que contiene a su entidad y, si hay varios (una cuenta nombrada que también está en un top), el que pidió SU métrica
   * (los conceptos de la parte, la métrica del top, las de los filtros); si aún empatan, el que ya venía y, si no, el siguiente en el orden de las partes. Las filas de «fuera del texto» siguen a su tabla: son su continuación.
   * Una fila cuya entidad no es de ningún universo (el «Total (3 cliente)» que la tabla agrega, el «Negocio» de una referencia, una diferencia «A − B») es AGREGADA: va en el rango de ids de su tabla y no entra al orden. */
  const bloques = [];
  let actual = null;
  const parteDe = (u) => partes.find((p) => p && (p.id === u.id || String(u.id).startsWith(`${p.id}_`))) || null;
  const permitidas = grupos.map((g) => {
    const s = new Set();
    const agregar = (c) => { if (c == null) return; s.add(_norm(c)); const m = metricaPorClave(c); if (m) { s.add(_norm(m.clave)); s.add(_norm(m.nombre)); } };
    for (const k of g.indices) {
      const u = universos[k], p = parteDe(u);
      for (const c of (p && Array.isArray(p.conceptos) ? p.conceptos : [])) agregar(c);
      if (u.top) agregar(u.top.metrica);
      for (const f of Array.isArray(u.filtros) ? u.filtros : []) agregar(f.metrica);
    }
    return s;
  });
  const permite = (j, r) => r.ms.some((m) => (m.clave && permitidas[j].has(_norm(m.clave))) || permitidas[j].has(_norm(m.label)));
  const grupoDeLaFila = (r, actualGrupo, previo) => {
    const cand = grupos.map((_, j) => j).filter((j) => grupos[j].entidades.has(r.entidad));
    if (!cand.length) return -2;                                   /* agregada */
    if (cand.length === 1) return cand[0];
    const conMetrica = cand.filter((j) => permite(j, r));
    const pool = conMetrica.length ? conMetrica : cand;
    if (pool.includes(actualGrupo)) return actualGrupo;
    const despues = pool.find((j) => j > previo);
    return despues !== undefined ? despues : pool[0];
  };
  let previo = -1;
  for (const r of filasT) {
    const g = grupoDeLaFila(r, actual ? actual.grupo : -1, previo);
    if (g === -2) {
      if (!actual) { actual = { grupo: -1, tema: r.tema, filas: [], todas: [], vistos: new Set() }; bloques.push(actual); }
      actual.todas.push(r);
      continue;
    }
    const nuevo = !actual || (actual.grupo >= 0 && actual.grupo !== g) || (actual.tema && r.tema && actual.tema !== r.tema)
      || r.ms.some((m) => actual.vistos.has(`${r.entidad}|${m.label}`));
    if (nuevo) {
      actual = { grupo: g, tema: r.tema, filas: [], todas: [], vistos: new Set() };
      bloques.push(actual);
      previo = g;
    } else if (actual.grupo < 0) { actual.grupo = g; previo = g; }   /* el bloque arrancó con una fila agregada (el «Negocio» de una referencia): adopta el universo de la primera fila de entidad que llega */
    actual.filas.push(r); actual.todas.push(r);
    for (const m of r.ms) actual.vistos.add(`${r.entidad}|${m.label}`);
    if (!actual.tema && r.tema) actual.tema = r.tema;
  }

  /* 2 · EL ORDEN DE CADA BLOQUE: la primera métrica (en el orden de las columnas) con valor para todas las filas y monótona; la del top de su universo manda si la hay */
  const topDe = (b) => { const gr = b.grupo >= 0 ? grupos[b.grupo] : null; if (!gr || gr.tipo !== "top") return null; const u = universos[gr.indices[0]]; return u.top; };
  const analizar = (b) => {
    const ents = []; for (const r of b.filas) if (!ents.includes(r.entidad)) ents.push(r.entidad);
    const etiquetas = []; for (const r of b.filas) for (const m of r.ms) if (!etiquetas.includes(m.label)) etiquetas.push(m.label);
    const serie = (label) => {
      const xs = [];
      for (const e of ents) {
        const celdas = b.filas.filter((r) => r.entidad === e).flatMap((r) => r.ms.filter((m) => m.label === label));
        if (celdas.length !== 1 || celdas[0].raw === null) return null;
        xs.push(celdas[0].raw);
      }
      return xs;
    };
    const t = topDe(b);
    let clave = null, label = null, sentido = null;
    if (ents.length >= 2) {
      if (t) { const l = _etiquetaDe(t.metrica, b.filas); const xs = etiquetas.includes(l) ? serie(l) : null; const s = xs ? _sentidoDe(xs) : null; if (s) { label = l; sentido = s; clave = t.metrica; } }
      if (!label) for (const l of etiquetas) { const xs = serie(l); const s = xs ? _sentidoDe(xs) : null; if (s) { label = l; sentido = s; break; } }
    }
    return { ents, etiquetas, label, sentido, clave };
  };
  const analisis = bloques.map(analizar);

  /* 3 · LAS TABLAS: una por bloque con orden; los bloques SIN orden que van seguidos se dicen juntos (no hay nada que ordenar entre ellos, y cada métrica es «solo mostrada»: no se repite) */
  const entradas = bloques.map((b, i) => {
    const a = analisis[i];
    const gr = b.grupo >= 0 ? grupos[b.grupo] : null;
    const u0 = gr ? universos[gr.indices[0]] : null;
    const N = u0 && Number.isInteger(u0.ejeN) ? u0.ejeN : null;
    const k = a.ents.length;
    const cuantos = N !== null ? `${k} de ${N}` : `${k} ${k === 1 ? "fila" : "filas"}`;
    const nombradas = gr && gr.tipo === "nombradas";   /* las cuentas que se nombraron salen en el orden en que se pidieron: ninguna métrica las ordena (que alguna serie sea monótona es casualidad, no un orden) */
    if (nombradas) { a.label = null; a.sentido = null; }
    return { filas: b.todas, label: a.label, etiquetas: a.etiquetas, orden: a.label ? `por ${a.label}, ${_TEXTO_DEL_SENTIDO[a.sentido]} (${cuantos})` : (k < 2 ? `una sola entidad (${cuantos})` : nombradas ? `en el orden en que se pidieron, sin orden por una métrica (${cuantos})` : `sin orden por una métrica (${cuantos})`) };
  });
  const juntas = [];
  for (const e of entradas) { const u = juntas[juntas.length - 1]; if (u && !u.label && !e.label) { u.filas = u.filas.concat(e.filas); u.n += 1; } else juntas.push({ ...e, n: 1 }); }
  const tablas = juntas.map((e) => _sinNulos({
    cifras: rangoDeIds(e.filas),
    orden: e.n > 1 ? "sin orden por una métrica" : e.orden,
    ordenadaPor: e.label ? [e.label] : null,   /* sin orden: el campo no se escribe (`orden` ya lo dice y toda métrica es «solo mostrada») */
    soloMostradas: e.label && e.etiquetas.filter((l) => l !== e.label).length ? e.etiquetas.filter((l) => l !== e.label) : null,
  }));

  /* 4 · EL ALCANCE DE CADA UNIVERSO */
  const salida = universos.map((u, k) => {
    const N = Number.isInteger(u.ejeN) ? u.ejeN : null;
    const kk = u.entidades.length;
    const tipo = tipoDeSeleccion(u);
    const cobertura = N !== null ? `${kk} de ${N}` : `${kk}`;
    const resto = N !== null && kk < N ? N - kk : 0;
    const acot = _acotaciones(u);
    /* las filas (bloques) que son de este universo */
    const gi = grupos.findIndex((x) => x.indices.includes(k));
    const bs = bloques.map((b, i) => ({ b, a: analisis[i] })).filter((x) => x.b.grupo === gi && gi >= 0   );
    const todasLasFilas = bs.flatMap((x) => x.b.filas);
    const etiquetas = []; for (const r of todasLasFilas) for (const m of r.ms) if (!etiquetas.includes(m.label)) etiquetas.push(m.label);
    const solo = kk === 1 ? "solo de este; el resto no evaluado" : `solo de estos ${kk}; el resto no evaluado`;
    const sobreN = N !== null ? `evaluada sobre los ${N}` : "evaluada sobre el eje completo";
    let seleccion, orden = null, metricas = {}, restoO = null;

    if (tipo === "prioridad") {
      seleccion = { tipo, lente: u.orden };
      if (resto) restoO = { n: resto, evaluado: true, nota: /primeros de/.test(String(u.criterio || u.texto || "")) ? "solo se entregan los primeros" : "fuera de la prioridad" };
      return _sinNulos({ cobertura, seleccion, resto: restoO });
    }
    if (u.soloRanking) {
      seleccion = { tipo };
      return _sinNulos({ cobertura, seleccion });
    }
    if (tipo === "top") {
      const t = u.top;
      const a = bs.length ? bs[0].a : null;
      const label = _etiquetaDe(t.metrica, todasLasFilas);
      const sentido = a && a.label === label ? a.sentido : null;
      const dirDeclarada = _norm(t.direccion || "mayor");
      const mm = sentido ? (sentido === "mayor-a-menor" ? "mayor" : "menor") : (dirDeclarada === "menor" ? "menor" : dirDeclarada === "mayor" ? "mayor" : null);
      const dir = sentido ? _TEXTO_DEL_SENTIDO[sentido] : (mm === "menor" ? "de menor a mayor" : mm === "mayor" ? "de mayor a menor" : dirDeclarada === "peor" ? "del peor al mejor" : "del mejor al peor");
      const extremo = dirDeclarada === "peor" || dirDeclarada === "mejor" ? `el ${dirDeclarada}` : `el ${mm || "mayor"}`;
      seleccion = _sinNulos({ tipo, metrica: label, direccion: t.direccion || "mayor", k: t.k, servidos: kk !== t.k ? kk : null, acotadoPor: acot.length ? acot : null });
      orden = kk > 1 ? `por ${label}, ${dir}, entre estos ${kk}` : (acot.length ? `${label}: ${extremo} entre los que cumplen la condición` : `${label}: ${extremo} del eje`);
      for (const l of etiquetas.includes(label) ? etiquetas : [label, ...etiquetas]) {
        if (l === label) metricas[l] = acot.length ? "ordenada solo entre los que cumplen la condición; el resto no evaluado" : (N !== null && kk >= N ? sobreN.replace("evaluada", "ordenada") : `ordenada sobre los ${N !== null ? N : "del eje completo"}: el 1.º es ${extremo} del eje`);
        else metricas[l] = N !== null && kk >= N ? sobreN : solo;
      }
      if (resto) restoO = { n: resto, evaluado: false };
    } else if (tipo === "filtro" || tipo === "estado") {
      const conds = (_esLista(u.filtros) ? u.filtros : []).map((f) => _sinNulos({ metrica: _etiquetaDe(f.metrica, todasLasFilas), op: f.op, valor: f.valor !== undefined ? f.valor : null, ref: f.ref !== undefined ? f.ref : null }));
      seleccion = _sinNulos({ tipo, ...(tipo === "estado" ? { estado: [...(_esLista(u.estados) ? u.estados : []), ...(_esLista(u.no_estados) ? u.no_estados.map((x) => `no ${x}`) : [])] } : {}), condiciones: conds.length ? conds : null, acotadoPor: tipo === "filtro" && acot.filter((x) => x !== "filtros").length ? acot.filter((x) => x !== "filtros") : null });
      const filtradas = new Set(conds.map((c) => c.metrica));
      const todas = [...new Set([...filtradas, ...etiquetas])];
      for (const l of todas) metricas[l] = kk >= (N || Infinity) || filtradas.has(l) ? sobreN : solo;
      if (resto) restoO = { n: resto, evaluado: true, nota: tipo === "estado" ? "no están en ese estado" : "no cumplen la condición" };
    } else if (tipo === "nombradas") {
      seleccion = { tipo };
      for (const l of etiquetas) metricas[l] = solo;
      if (resto) restoO = { n: resto, evaluado: false };
    } else {   /* completo */
      seleccion = { tipo };
      for (const l of etiquetas) metricas[l] = sobreN;
    }
    /* cuando la lista cubre el eje entero (`k` = `N`), toda métrica está evaluada sobre los N: `completo`/`cobertura` ya lo dicen y no se repite por métrica (el orden de un top va en `orden`) */
    const cubreTodo = N !== null && kk >= N;
    return _sinNulos({ cobertura, seleccion, orden, metricas: !cubreTodo && Object.keys(metricas).length ? metricas : null, resto: restoO });
  });

  return { universos: salida, tablas };
}

/* ── LAS LÍNEAS DE «LO ESTABLECIDO» (el digesto es de la misma fuente: nunca una segunda descripción) ─────────────────────────────────── */
/** textoDeSeleccion(alc) → «top 3 por Saldo vencido» · «filtro Días vencido > 90» · «estado en mora» · «nombradas» · «completo» · «prioridad por riesgo» */
export function textoDeSeleccion(alc) {
  const s = alc && alc.seleccion;
  if (!s) return "";
  if (s.tipo === "top") return `top ${s.k}${s.servidos ? ` (${s.servidos} con empate)` : ""} por ${s.metrica}${_norm(s.direccion) === "menor" ? " (menor)" : _norm(s.direccion) === "peor" ? " (peor)" : _norm(s.direccion) === "mejor" ? " (mejor)" : ""}${s.acotadoPor ? ` entre los acotados por ${s.acotadoPor.join(" y ")}` : ""}`;
  if (s.tipo === "filtro") return `filtro ${(s.condiciones || []).map((c) => `${c.metrica} ${c.op} ${c.valor != null ? c.valor : c.ref}`).join(" y ")}${s.acotadoPor ? `${s.condiciones ? " y " : ""}acotado por ${s.acotadoPor.join(" y ")}` : ""}`.trim();
  if (s.tipo === "estado") return `estado ${(s.estado || []).join(" y ")}${(s.condiciones || []).length ? ` con ${s.condiciones.map((c) => `${c.metrica} ${c.op} ${c.valor != null ? c.valor : c.ref}`).join(" y ")}` : ""}`;
  if (s.tipo === "prioridad") return `prioridad por ${s.lente}`;
  return s.tipo;
}
