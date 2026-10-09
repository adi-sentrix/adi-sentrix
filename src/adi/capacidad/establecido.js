/* === src/adi/capacidad/establecido.js · «LO ESTABLECIDO» DE LA CONVERSACIÓN: UN DIGESTO EN TODA RESPUESTA (owner 2026-10-09 · `_ADI_DISENO_ALCANCE_DE_LO_ENTREGADO.md` §2.3-§2.4) ═════════════════════════════════
 * Un digesto por conversación, que ADI mantiene y devuelve en TODA respuesta (consultar · derivar · aportarContexto · retomar · conocerEmpresa con conversación), antes de la Entrega, junto a `memoria`:
 *   universos   «E3.u1 top 3 por Saldo vencido (3 de 13)»                       qué conjuntos se entregaron y qué regla los eligió (de las Entregas anteriores a la de este turno: la de este turno el anfitrión la acaba de recibir con todo su alcance)
 *   ordenes     «E1.h1–E1.h24 y E1.h26–E1.h27 por Venta, de mayor a menor (13 de 13)» · «E2.u6 prioridad por riesgo (4 de 13)»   qué orden está establecido, y sobre cuántos
 *   extremos    «mayor Saldo vencido: Mayorista El Roble E3.h5 (sobre 13)»       quién es el extremo del eje entero (un top sin acotar), con su id
 *   relaciones  «D2 coincidencia los 3 de mayor venta × los 3 de menor margen: 2 de 3»
 *   criterios   «Benchmark de margen 30.1 % · declarado por la empresa»          los criterios vigentes, con su valor y su origen (los que no tienen valor se dicen «sin declarar»)
 *   memoria     «íntegra · 4 Entregas · 213 cifras · esta respuesta: completa»   si la memoria está entera y si ESTA respuesta trae todo (`retomar` en páginas: «página 1 de 4, faltan 173 hechos»)
 * Qué resuelve: las negaciones («no hay benchmark cargado»: la línea de criterios lo contradice en la misma respuesta de donde el anfitrión iba a contestar), las referencias a turnos anteriores («como vimos antes, Falabella es tu mayor
 * deudor»: `extremos` dice quién es el mayor y sobre cuántos; si no está, no se estableció) y la memoria incompleta. Cada línea es un hecho con id que el libro ya tiene: no se calcula nada nuevo.
 *
 * LEY DEL DIGESTO: nunca una lista PARCIAL de nombres sin su «k de N». Este digesto no lista nombres de entidades (salvo el extremo, que es UN hecho con su id): lista ids, reglas y coberturas; los nombres los trae `retomar`.
 * Cabe en 1 KB: si no cupiera, ceden primero las líneas de las Entregas más viejas, y SE DICE cuántas («+3 de Entregas anteriores: retomar las trae»). Puro salvo `criteriosVigentes()`, que se llama DENTRO del tenant activo. */
import { CRITERIOS_DECLARABLES, CRITERIO_PISO_DE_COBRANZA } from "./loDeclarado.js";
import { umbral, ADJETIVO_DE_ORIGEN, ORIGEN } from "../../config/businessPolicy.js";
import { formatoDeReferencia } from "../notario/hechos.js";
import { metricaPorClave, PLURAL_DE_EJE } from "../notario/lexico.js";
import { estadoDeLaMemoria, LIBRO_TOPE_BYTES } from "../continuidad/libro.js";
import { alcanceDeLaEntrega, textoDeSeleccion, tipoDeSeleccion } from "./alcanceEstructural.js";

export const ESTABLECIDO_TOPE_BYTES = 1024;
export const ENTREGAS_DEL_DIGESTO = 6;   /* las mismas seis que `loEntregado` del estado vigente */
const _bytes = (x) => new TextEncoder().encode(JSON.stringify(x)).length;
const _norm = (s) => String(s == null ? "" : s).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

/** criteriosVigentes() → [{ concepto, rotulo, unidad, llave, valor|null, texto|null, origen, etiquetaDeOrigen|null }] · el valor que RIGE hoy para cada criterio declarable y de quién es, por LA MISMA función de origen que escribe el Marco de una
 *  Entrega (`businessPolicy.js:umbral`). Se llama DENTRO del tenant activo (`conTenantActivo`) y con la vara declarada ya fijada, igual que `consultar`. */
export function criteriosVigentes() {
  return [...CRITERIOS_DECLARABLES.filter((c) => c.llave), CRITERIO_PISO_DE_COBRANZA].map((c) => {
    const u = umbral(c.llave);
    const hay = Number.isFinite(u.valor) && u.origen !== ORIGEN.SIN_DECLARAR;
    return { concepto: c.concepto, rotulo: c.rotulo, unidad: c.unidad, llave: c.llave, valor: hay ? u.valor : null, texto: hay ? formatoDeReferencia(u.valor, c.unidad) : null, origen: hay ? u.origen : ORIGEN.SIN_DECLARAR, etiquetaDeOrigen: hay ? (ADJETIVO_DE_ORIGEN[u.origen] || null) : null };
  });
}
/** lo que `conocerEmpresa` agrega a cada criterio declarable: `vigente { valor, origen }` o `null` («sin declarar») */
export const vigenteDe = (c) => (c && c.valor !== null && c.valor !== undefined ? { valor: c.texto, origen: c.etiquetaDeOrigen } : null);

/* los criterios se dicen agrupados por de quién son: «declarado por la empresa: Benchmark de margen 30.1% · Piso de rotación 2.0x» */
const _lineasDeCriterios = (conValor, sinValor) => {
  const porOrigen = new Map();
  for (const c of conValor) { if (!porOrigen.has(c.etiquetaDeOrigen)) porOrigen.set(c.etiquetaDeOrigen, []); porOrigen.get(c.etiquetaDeOrigen).push(`${c.rotulo} ${c.texto}`); }
  return [...[...porOrigen].map(([o, xs]) => `${o}: ${xs.join(" · ")}`), ...(sinValor.length ? [`sin declarar: ${sinValor.map((c) => c.rotulo).join(", ")}`] : [])];
};

/** el hecho de la tabla de una Entrega que es de `entidad` y de la métrica `clave` (su id): para citar al extremo */
function _hechoDe(e, entidad, clave, etiqueta) {
  const m = metricaPorClave(clave);
  for (const h of Array.isArray(e.hechos) ? e.hechos : []) {
    if (h.fuera || h.sujeto !== entidad) continue;
    const rc = h.rv && h.rv.clave;
    if ((rc && m && _norm(rc) === _norm(m.clave)) || _norm(h.metrica) === _norm(etiqueta)) return h.id;
  }
  return null;
}

/** descripcionDeLoEntregado(entrega) → { universos: "clientes (3 de 13)", metricas: "Saldo vencido, Días vencido" } · la línea de `loEntregado` del estado vigente en el brazo B: cuántos de cuántos, qué métricas; nunca nombres sueltos */
export function descripcionDeLoEntregado(e) {
  const us = Array.isArray(e && e.universos) ? e.universos : [];
  const alc = us.length ? alcanceDeLaEntrega({ n: e.n, universos: us, hechos: e.hechos || [], desdeElLibro: true }).universos : [];
  const partes = [];
  let k = 0;
  while (k < us.length) {
    const u = us[k], a = alc[k];
    if (u.soloRanking || u.orden || !a) { k++; continue; }
    const N = Number.isInteger(u.ejeN) ? u.ejeN : null, plural = PLURAL_DE_EJE[u.eje] || `${u.eje || "entidades"}`;
    if (a.seleccion && a.seleccion.tipo === "nombradas") { let j = k, cuantos = 0; while (j < us.length && !us[j].soloRanking && tipoDeSeleccion(us[j]) === "nombradas" && us[j].eje === u.eje) { cuantos += us[j].entidades.length; j++; } partes.push(`${plural} (${N !== null ? `${cuantos} de ${N}` : cuantos})`); k = j; continue; }
    partes.push(`${plural} (${a.cobertura})`);
    k++;
  }
  const metricas = [];
  for (const h of Array.isArray(e && e.hechos) ? e.hechos : []) { const rv = (h && h.rv) || {}; if (!h || h.fuera || !(h.sujeto || rv.sujeto) || !(h.metrica || rv.metrica)) continue; for (const m of [h.metrica || rv.metrica, ...(Array.isArray(rv.mas) ? rv.mas.map((x) => x && x.metrica) : [])]) if (m && !metricas.includes(m)) metricas.push(m); }
  return { universos: partes.join(" + ") || null, metricas: metricas.length ? `${metricas.slice(0, 4).join(", ")}${metricas.length > 4 ? ` (+${metricas.length - 4} más)` : ""}` : null };
}

/** establecidoDe(libro, { criterios?, actual? }) → el digesto (≤ 1 KB) o null si no hay libro. `actual` = el número de la Entrega de ESTE turno (sus universos y su tabla no se repiten: el anfitrión los acaba de recibir con todo su alcance). */
export function establecidoDe(libro, { criterios = null, actual = null, tope = LIBRO_TOPE_BYTES, reserva = 0 } = {}) {   /* `reserva`: bytes que la respuesta le agregará después a `memoria` («esta respuesta: página 1 de 15, faltan 199 hechos» en `retomar`) */
  if (!libro || typeof libro !== "object") return null;
  const todasLasVivas = (libro.entregas || []).filter((e) => e && !e.recortada);
  const vivas = todasLasVivas.slice(-ENTREGAS_DEL_DIGESTO);   /* las líneas del digesto son de las últimas seis; la memoria cuenta todas las que conserva */
  const universos = [], ordenes = [], extremos = [];   /* cada elemento: { n, texto } (n = la Entrega, para ceder primero lo más viejo) */
  for (const e of vivas) {
    const us = Array.isArray(e.universos) ? e.universos : [];
    const alc = us.length ? alcanceDeLaEntrega({ n: e.n, universos: us, hechos: e.hechos || [], desdeElLibro: true }).universos : [];
    /* universos: las cuentas nombradas de una parte son un universo por entidad; para el digesto, una línea */
    let k = 0;
    while (k < us.length) {
      const u = us[k], a = alc[k];
      if (!a || !a.seleccion) { k++; continue; }
      const id = `E${e.n}.u${k + 1}`;
      if (u.soloRanking) { k++; continue; }
      if (a.seleccion.tipo === "prioridad") { if (e.n !== actual) ordenes.push({ n: e.n, texto: `${id} prioridad por ${a.seleccion.lente} (${a.cobertura})` }); k++; continue; }
      if (a.seleccion.tipo === "nombradas") {
        let j = k; while (j + 1 < us.length && !us[j + 1].soloRanking && tipoDeSeleccion(us[j + 1]) === "nombradas" && us[j + 1].eje === u.eje) j++;
        if (e.n !== actual) universos.push({ n: e.n, texto: `${j > k ? `${id}–E${e.n}.u${j + 1}` : id} nombradas (${a.cobertura}${j > k ? " cada una" : ""})` });
        k = j + 1; continue;
      }
      if (e.n !== actual) universos.push({ n: e.n, texto: `${id} ${textoDeSeleccion(a)} (${a.cobertura})` });
      /* el extremo del eje ENTERO: el primero de un top sin acotar que cubre el eje por esa métrica */
      if (a.seleccion.tipo === "top" && !a.seleccion.acotadoPor && u.entidades.length >= 1 && Number.isInteger(u.ejeN)) {
        const dir = _norm(a.seleccion.direccion || "mayor");
        const hid = _hechoDe(e, u.entidades[0], u.top.metrica, a.seleccion.metrica);
        extremos.push({ n: e.n, texto: `${dir} ${a.seleccion.metrica}: ${u.entidades[0]}${hid ? ` ${hid}` : ""} (sobre ${u.ejeN})` });
      }
      k++;
    }
    if (e.n !== actual) for (const t of Array.isArray(e.tablas) ? e.tablas : []) if (t.ordenadaPor && t.ordenadaPor.length) ordenes.push({ n: e.n, texto: `${t.cifras} ${t.orden}` });
  }
  const relaciones = (libro.derivaciones || []).filter((d) => d && d.operacion === "coincidencia" && d.coincidencia && d.coincidencia.a && d.coincidencia.b)
    .map((d) => ({ n: 0, texto: `${d.id} coincidencia ${d.coincidencia.a.texto} × ${d.coincidencia.b.texto}: ${d.resultado && d.resultado.texto}` })).slice(-4);
  const lista = Array.isArray(criterios) ? criterios : [];
  const conValor = lista.filter((c) => c.valor !== null && c.valor !== undefined), sinValor = lista.filter((c) => c.valor === null || c.valor === undefined);
  const criteriosL = _lineasDeCriterios(conValor, sinValor);

  const mem = estadoDeLaMemoria(libro, { tope });
  const nCifras = todasLasVivas.reduce((a, e) => a + (Array.isArray(e.hechos) ? e.hechos.length : 0), 0);
  const memoriaTxt = `${mem && mem.estado === "recortada" ? `recortada (${(mem.recortadas || []).map((r) => r.entrega).join(", ") || "derivaciones"})` : "íntegra"} · ${todasLasVivas.length} ${todasLasVivas.length === 1 ? "Entrega" : "Entregas"} · ${nCifras} cifras · esta respuesta: completa`;

  /* cabe en 1 KB: ceden primero las líneas de las Entregas más viejas, y se dice cuántas (nunca una lista parcial sin decirlo) */
  const arma = (cedidas) => {
    const cortar = (xs, nombre) => { const c = cedidas[nombre] || 0; const resto = xs.slice(c).map((x) => x.texto); return c ? [`+${c} de Entregas anteriores: retomar las trae`, ...resto] : resto; };
    const o = {
      ...(universos.length ? { universos: cortar(universos, "universos") } : {}),
      ...(ordenes.length ? { ordenes: cortar(ordenes, "ordenes") } : {}),
      ...(extremos.length ? { extremos: cortar(extremos, "extremos") } : {}),
      ...(relaciones.length ? { relaciones: relaciones.map((x) => x.texto) } : {}),
      ...(criteriosL.length ? { criterios: criteriosL } : {}),
      memoria: memoriaTxt,
    };
    for (const k of Object.keys(o)) if (Array.isArray(o[k]) && !o[k].length) delete o[k];
    return o;
  };
  const cedidas = { universos: 0, ordenes: 0, extremos: 0 };
  let o = arma(cedidas);
  const orden = ["universos", "ordenes", "extremos"], fuentes = { universos, ordenes, extremos };
  let vueltas = 0;
  const TOPE = ESTABLECIDO_TOPE_BYTES - reserva;
  while (_bytes(o) > TOPE && vueltas++ < 200) {
    const candidata = orden.filter((k) => fuentes[k].length > cedidas[k]).sort((a, b) => (fuentes[b].length - cedidas[b]) - (fuentes[a].length - cedidas[a]))[0];
    if (!candidata) break;
    cedidas[candidata] += 1;
    o = arma(cedidas);
  }
  /* si aun así no cabe, los criterios generales de ADI (los que la empresa no declaró) se dicen en una sola línea: lo declarado por la empresa y lo que la empresa consultó siguen completos */
  if (_bytes(o) > TOPE && conValor.some((c) => c.origen !== ORIGEN.EMPRESA)) {
    const generales = conValor.filter((c) => c.origen !== ORIGEN.EMPRESA), propios = conValor.filter((c) => c.origen === ORIGEN.EMPRESA);
    o = { ...o, criterios: [..._lineasDeCriterios(propios, []), `${generales.length} criterios generales de ADI (conocerEmpresa los trae)`, ...(sinValor.length ? [`sin declarar: ${sinValor.map((c) => c.rotulo).join(", ")}`] : [])] };
  }
  return o;
}
