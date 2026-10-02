/* === src/adi/entrega/servidas.js · LA PIEZA DE LO SERVIDO (consolidación, paso 2, FAMILIA 2: lo anunciado es lo servido) ═══════
 * «Toda entidad nombrada, anunciada o servida por un top tiene su fila en cada concepto pedido que su productor publica; si no la tiene, se
 * declara con verdad; un límite nunca niega una cifra que la misma Entrega imprime» (contrato §7.3·44(a) · 45(a) · 48(a) · 49(c) · 51(b)/(e) ·
 * 52(b)/(c)/(e)) se decide ACÁ, en un solo lugar. Hasta ahora lo decidían los planes de entidad, de grupo, de universo y de comparación de
 * `componer.js` cada uno a su manera (la boleta sola, completar solo la clave de orden, omitir en silencio al miembro sin la cifra, un límite
 * escrito antes de saber qué se imprime). Esta pieza NO agrega comportamiento nuevo salvo el que la regla exige: es la regla escrita una vez.
 * La REDACCIÓN de cada frase queda donde estaba; la única forma nueva es «sin dato de X para Y» (`config/contract/ausencias.js:textoSinDato`).
 *
 * LA REGLA DEL CERO (§7.3·52b, owner 2026-10-01) — sin excepciones. Solo hay dos ceros reales:
 *   · MEDIDO: la fuente trae la fila de la entidad y el valor es 0 (la fila del ranking de la proyección, aunque valga 0);
 *   · de COBERTURA DECLARADA: una fuente declara que cubre a todo el grupo (`config/contract/coberturaDeFuentes.js`) y la entidad, siendo del grupo,
 *     no figura en la métrica que solo publican quienes cumplen su definición: no figurar = nada, y se dice por qué.
 *   Todo lo demás es DATO AUSENTE: nunca un número, no se ordena, no se cuenta ni se suma como 0, y se declara aparte («sin dato de X para Y»).
 *   Cada cifra que la pieza completa lleva su ORIGEN: `medido` · `cobertura` (· ausente: no hay cifra).
 *
 * LO QUE LA PIEZA OFRECE (los planes de `componer.js` le preguntan a ella):
 *   · `figDeLaProyeccion(I, entidad, clave)`   la fila de una entidad en una métrica cuando la boleta del turno no la trae: del ranking de la proyección
 *                                              (medido, aunque valga 0) o su cero de cobertura declarada; la comprueba el MISMO libro que verifica la Entrega.
 *   · `filasDeEntidad({ … })`                  las filas de una entidad en cada concepto pedido (boleta · proyección · cobertura) y las claves que faltan.
 *   · `completarGrupo({ … })`                  lo mismo para cada miembro de un grupo (top · foto · universo), sobre un mapa `nombre → Map(clave → fig)`.
 *   · `declararLoQueFalta(…)`                  los límites de lo que falta, calculados DESPUÉS de saber qué se imprime: un límite que niegue algo impreso no se emite.
 *   · `origenDeLaFig` · `esFigDeCobertura`     el origen de una cifra para la fila de la tabla.
 * PURO: sin red, sin estado, sin lectura del tenant (lee el índice `I` que el compositor ya armó). */
import { libroDeHechos, formatoDeLaCasa } from "../notario/hechos.js";
import { valorDeRanking } from "../notario/verificar.js";
import { metricaPorClave, unidadDeClave, claveDeMetrica, claveExactaDeMetrica, coberturaDeLaMetrica } from "../notario/lexico.js";
import { normalizar } from "../notario/afirmacion.js";
import { productorDe } from "../encargo/esquema.js";
import { textoSinDato, MOTIVO_SIN_DATO } from "../../config/contract/ausencias.js";

export const ORIGEN = Object.freeze({ MEDIDO: "medido", COBERTURA: "cobertura", AUSENTE: "ausente" });
const _nombreDeMetrica = (clave) => (metricaPorClave(clave) || {}).nombre || clave;

/* ── LA FILA DE UNA ENTIDAD EN UNA MÉTRICA, SEGÚN LA PROYECCIÓN ────────────────────────────────────────────────────────── */
/* la cifra SIN comprobar: la fila del ranking de la proyección (origen medido, aunque valga 0) o el cero de cobertura declarada; null = dato ausente */
function _figDeLaProyeccionSinComprobar(I, entidad, clave) {
  if (!I || !entidad || !clave) return null;
  const nombre = _nombreDeMetrica(clave);   /* el ranking de la proyección se busca por el NOMBRE de la métrica (`rankingDe`), no por su clave con guion bajo; si el nombre largo no lo ubica («Variación vs año anterior»), por la clave y los conceptos de la casa */
  let rk = null;
  for (const metrica of [nombre, String(clave).replace(/_/g, " "), ...((metricaPorClave(clave) || {}).conceptos || [])]) {
    try { rk = valorDeRanking({ sujeto: entidad, metrica }, I); } catch { rk = null; }
    if (rk) break;
  }
  const label = `${entidad} · ${nombre}`;
  if (rk && Number.isFinite(rk.raw) && rk.texto) return { _deLaProyeccion: true, origen: ORIGEN.MEDIDO, _sujeto: entidad, _clave: clave, label, value: rk.texto, raw: rk.raw, unit: rk.unidad, source: "actual" };
  const ent = I.resolverEntidad ? I.resolverEntidad(entidad) : null;
  const cob = ent ? coberturaDeLaMetrica(clave, ent.eje) : null;
  if (!cob) return null;
  const rkc = I.rankingDe ? [nombre, String(clave).replace(/_/g, " ")].map((m) => I.rankingDe(ent.eje, m)).find(Boolean) || null : null;
  const unidad = unidadDeClave(clave);
  /* el cero de cobertura vale solo sobre una fuente que la proyección PUBLICA (nunca un cero sobre lo que no se publica) y que no trae a la entidad */
  if (rkc && unidad && Array.isArray(rkc.r.filas) && rkc.r.filas.length && !rkc.r.filas.some((x) => normalizar(x.entidad) === normalizar(ent.nombre))) {
    return { _deLaProyeccion: true, origen: ORIGEN.COBERTURA, porQue: cob.porQue, fuente: cob.fuente, _sujeto: entidad, _clave: clave, label, value: formatoDeLaCasa(0, unidad), raw: 0, unit: unidad, source: "actual" };
  }
  return null;
}
/** figDeLaProyeccion(I, entidad, clave) → la fig sintética (`{ label, value, raw, unit, origen, … }`) o null. Falla CERRADO: solo se devuelve si el MISMO libro que verifica la Entrega
 *  comprueba la cifra; una cifra que no verifica tumbaría la Entrega entera, y sin la fila queda declarado el dato ausente. */
export function figDeLaProyeccion(I, entidad, clave) {
  const f = _figDeLaProyeccionSinComprobar(I, entidad, clave);
  if (!f) return null;
  try { const H = libroDeHechos([{ id: "z1", tipo: "cifra", sujeto: f._sujeto, metrica: f._clave, valor: f.value }], { indice: I }).hechos[0]; return H && H.ok && H.veredicto === "verdadera" ? f : null; } catch { return null; }
}
/* una fig se puede SERVIR si la boleta del turno la registró (tiene `id`: el libro la cita) o si es la fila de la proyección que la propia pieza declara: una fig sin id (la que trae la llamada de un top sin registrarla) no se imprime, y no puede contar como «la entidad tiene su fila» */
export const esFigServible = (fig) => !!fig && typeof fig === "object" && (fig._deLaProyeccion === true || fig.id != null);
/** el origen de una cifra de la tabla: las que completa la pieza lo traen; las de la boleta del turno son medidas */
export const origenDeLaFig = (fig) => (fig && fig.origen) || ORIGEN.MEDIDO;
export const esFigDeCobertura = (fig) => !!(fig && fig.origen === ORIGEN.COBERTURA);

/* ── LAS FILAS DE UNA ENTIDAD EN CADA CONCEPTO PEDIDO ──────────────────────────────────────────────────────────────────── */
/** filasDeEntidad({ entidad, eje, conceptos, figDe, I }) → { filas: [{ clave, fig, origen }], faltantes: [clave] }
 *  Por cada concepto pedido: la fig de la boleta del turno (`figDe(clave)`), si no la fila de la proyección (medido, o su cero de cobertura declarada), si no la entidad
 *  queda SIN DATO de ese concepto —y se declara—. Solo se exige un concepto que el productor publica para ese eje (`productorDe`): el que el eje no sostiene ya lo declinó el validador. */
export function filasDeEntidad({ entidad, eje = null, conceptos = [], figDe = () => null, I = null }) {
  const filas = [], faltantes = [];
  for (const clave of Array.isArray(conceptos) ? conceptos : []) {
    const fig = figDe(clave);
    if (esFigServible(fig)) { filas.push({ clave, fig, origen: origenDeLaFig(fig) }); continue; }
    if (eje && !productorDe(clave, eje)) continue;
    const f = I ? figDeLaProyeccion(I, entidad, clave) : null;
    if (f) filas.push({ clave, fig: f, origen: f.origen }); else faltantes.push(clave);
  }
  return { filas, faltantes };
}

/** completarGrupo({ nombres, conceptos, porEntidad, eje, I, soloFaltantes }) → [{ entidad, clave }] las claves sin dato.
 *  Completa en el mapa `nombre → Map(clave → fig)` la fila de CADA miembro en CADA concepto pedido que la boleta no trajo (la proyección o su cero de cobertura); lo que ninguna fuente
 *  demuestra queda sin fila y se devuelve como faltante. El mapa existente se respeta: una fig de la boleta nunca se reemplaza. */
export function completarGrupo({ nombres, conceptos, porEntidad, eje = null, I = null }) {
  const faltantes = [];
  for (const e of nombres) {
    let m = porEntidad.get(e);
    const tiene = (c) => !!(m && m.has(c) && esFigServible(m.get(c)));
    const pendientes = (conceptos || []).filter((c) => !tiene(c));
    if (!pendientes.length) continue;
    const r = filasDeEntidad({ entidad: e, eje, conceptos: pendientes, I });
    if (r.filas.length && !m) { m = new Map(); porEntidad.set(e, m); }
    for (const x of r.filas) m.set(x.clave, x.fig);
    for (const c of r.faltantes) faltantes.push({ entidad: e, clave: c });
  }
  return faltantes;
}

/* ── LO QUE FALTA, DECLARADO DESPUÉS DE SABER QUÉ SE IMPRIME ───────────────────────────────────────────────────────────── */
const _esc = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
/** ¿la Entrega imprime una cifra de `entidad` (y, si se da, de `clave`)? Sus filas de Cifras o Detalle, o —solo sin `clave`— una oración que la nombra con su cifra
 *  («PHI-IRON-PRO: rotación 2.4x» de una premisa). Es lo que un límite NUNCA puede negar (§7.3·51b). */
function _impreso(entrega, entidad, clave = null) {
  const filas = [...((entrega.cifras && entrega.cifras.filas) || []), ...((entrega.detalle && Array.isArray(entrega.detalle.filas)) ? entrega.detalle.filas : [])];
  const dueno = (f) => { const v = f.valores || {}; return normalizar(String(v["Entidad / grupo"] != null ? v["Entidad / grupo"] : (v.Entidad != null ? v.Entidad : ""))) === normalizar(entidad); };
  const claveDe = (f) => { const m = String((f.valores || {})["Métrica"] || ""); return claveExactaDeMetrica(m) || claveDeMetrica(m) || null; };
  if (filas.some((f) => dueno(f) && (!clave || claveDe(f) === clave))) return true;
  if (clave) return false;
  const re = new RegExp(`${_esc(entidad)}(?::|, con| \\()[^.;]{0,80}\\d`);
  return (entrega.respuesta || []).some((r) => re.test(String((r && r.texto) || "")));
}

/** declararLoQueFalta(plan, entrega, { dominioNombre, conteoDeEje, listaDeNombres }) → { limites: [{ titulo, motivo }], numeros: [string] }
 *  `plan.faltantes` = [{ entidad, clave }] las claves sin dato de un miembro servido; `plan.sinCifra` = [nombre] las entidades NOMBRADAS sin ninguna cifra; `plan._formaFoto` (la foto de un productor) + `plan.orden` (o `plan.miembros`); `plan._servido` = el plan se imprimió.
 *    · una entidad nombrada sin NINGUNA cifra → «no se pudo servir la cifra de X» (la forma de siempre) — salvo que la Entrega la imprima por otro lado;
 *    · el concepto que falta a una parte de la FOTO → «sin dato de M para A, B (n de N cuentas)» (52b: la forma única, más la cuenta de la foto);
 *    · cualquier otro miembro sin la cifra de un concepto pedido → «sin dato de M para A, B» (la forma nueva, §7.3·52b; la decisión 30 rige en todos los temas).
 *  Nunca se declara como faltante lo que la Entrega imprime. */
export function declararLoQueFalta(plan, entrega, { dominioNombre = (t) => t, conteoDeEje = null, listaDeNombres = null } = {}) {
  const limites = [], numeros = [];
  if (!plan || !plan._servido) return { limites, numeros };
  const lista = listaDeNombres || ((xs) => (xs.length > 1 ? `${xs.slice(0, -1).join(", ")} y ${xs[xs.length - 1]}` : String(xs[0] || "")));
  const parte = `Sobre la parte ${plan.parteId} (${dominioNombre(plan.tema)})`;
  for (const nombre of plan.sinCifra || []) {
    if (_impreso(entrega, nombre)) continue;
    limites.push({ titulo: `${parte}, no se pudo servir la cifra de ${nombre}`, motivo: `La lectura de este turno no trajo ninguna cifra de ${nombre} para lo pedido: se declara en vez de omitirla. No se sustituye por otra cuenta.` });
  }
  const porClave = new Map();
  const sinNada = new Set((plan.sinCifra || []).map(normalizar));   /* la entidad sin NINGUNA cifra ya se declaró entera arriba */
  for (const { entidad, clave } of plan.faltantes || []) { if (sinNada.has(normalizar(entidad)) || _impreso(entrega, entidad, clave)) continue; if (!porClave.has(clave)) porClave.set(clave, []); porClave.get(clave).push(entidad); }
  const orden = Array.isArray(plan.orden) ? plan.orden : (Array.isArray(plan.miembros) ? plan.miembros : []);
  const esFoto = !!(plan._formaFoto || plan.esFoto);
  for (const [clave, sin] of porClave) {
    const conFila = orden.filter((e) => !sin.includes(e) && _impreso(entrega, e, clave));
    if (esFoto && conFila.length && conteoDeEje) {
      numeros.push(String(sin.length), String(orden.length));
      /* §7.3·52(b) (parte B): la ausencia se dice SIEMPRE «sin dato de X para Y» (el texto de `ausencias.js`); la foto agrega solo cuántas de las cuentas del eje quedan sin la cifra */
      limites.push({ titulo: `${parte}, ${textoSinDato(_nombreDeMetrica(clave), sin)} (${sin.length} de ${conteoDeEje(plan.eje, orden.length).texto})`, motivo: MOTIVO_SIN_DATO });
    } else {
      limites.push({ titulo: `${parte}, ${textoSinDato(_nombreDeMetrica(clave), sin)}`, motivo: MOTIVO_SIN_DATO });
    }
  }
  return { limites, numeros };
}
