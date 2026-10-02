/* === src/adi/entrega/prioridad.js · LA PIEZA DE LA PRIORIDAD (consolidación, paso 2, FAMILIA 1) ═════════════════════
 * «Quién va primero y qué lente o medida se nombra» se decide ACÁ, en un solo lugar. Hasta ahora lo decidían 26 sitios
 * (componer.js: planes de grupo, renders, ruta multitema, rutas fijas; iniciativa.js; tamano.js y dos lecturas de prosa por
 * regex). Esta pieza NO agrega comportamiento: es la regla del contrato vigente (§7.3·46d · 47a/47d · 48b · 50a · 51d · 52)
 * escrita una vez. La REDACCIÓN de cada oración y su formato siguen en `componer.js`: la pieza devuelve la decisión
 * (quién · qué lente/medida · si se declara que la lente no ordena) y quien compone el texto la lee.
 *
 * LA REGLA (vigente):
 *   · 46(d) EL CRITERIO DEL USUARIO MANDA: una oración nombra SIEMPRE la lente que de verdad ordenó su lista; nunca una que
 *     no la ordenó. La lista de un grupo la ordena su `claveOrden` (la métrica del primer concepto pedido): la lente se nombra
 *     solo cuando esa clave es la suya; si no, se nombra la CLAVE y, si el usuario pidió una lente que no la ordena, se declara.
 *   · 47(a) una lente que APLICA al dominio ordena con SU medida (saldo vencido · capital inmovilizado crítico · contribución
 *     no capturada · venta); si esa medida no distingue a nadie (cero · empate · sin dato) se declara que ninguna cuenta queda
 *     primera: nunca se corona a la primera de la lista ni se cambia de criterio en silencio.
 *   · 47(d) / 48(b) / 51(d) una lente sin dominio (riesgo, crecimiento, ventas) o de OTRO dominio sobre un grupo que no ordena
 *     se DECLARA y el grupo se ordena por la medida que se nombra; «riesgo» sobre un grupo es el criterio entre dominios.
 *   · 50(a) LA PRIORIDAD PIDE ATENCIÓN: con la medida de una lente va de mayor a menor (quien más pesa); con la medida PROPIA,
 *     donde más es peor (carga, días) el mayor, una MAGNITUD (dinero o unidades) de mayor a menor, y solo una TASA o RAZÓN
 *     donde más es mejor (margen, rotación) invierte: el menor pide atención. La polaridad y la unidad son las del léxico.
 *   · 52(a) en cobranza el único dato de venta es la venta a crédito: la lente «ventas» se dice «venta a crédito». 55(b): POR PARTE — solo en una parte de cobranza; en una parte comercial se dice «ventas» y ordena por la venta del período, aunque el encargo tenga una parte de cobranza.
 *   · 55(a) (corrige la 54(c)): si el universo de la parte ya viene ordenado por venta (un top por ventas), la oración nombra la venta como lo que ordenó («por venta, el top que se pidió») y no declara «ventas no ordena este grupo»: una oración nunca dice que una medida no ordena y a la vez ordena por ella.
 *   · 52(e) un criterio que solo trae una REFERENCIA (umbral, piso, techo, benchmark) nombra la medida que ordenó y la
 *     referencia COMO TAL: una referencia no es una lente y nunca se nombra como el criterio que ordenó.
 *
 * UNA SOLA TABLA lente → medida (`MEDIDAS_DE_LENTE`): la leen esta pieza y `encargo/lecturasDe.js` (qué se LEE para ordenar).
 *
 * LA MARCA ESTRUCTURAL (`_prioridad`): toda oración de prioridad que compone la Entrega lleva `{ alcance, primero }`. Quien
 * necesita saber «cuál es la oración de prioridad» (el tamaño gobernado, la pregunta abierta de «breve») lee la marca, nunca
 * el texto con una expresión regular.
 *
 * PURO: sin red, sin estado, sin lectura del tenant. Importa solo el léxico y los criterios de la casa. */
import { CRITERIOS, LENTES, prioridadIntegrada, ordenPorCriterio } from "../agente/prioridadIntegrada.js";
import { ceroPorCobertura, metricaPorClave, claveExactaDeMetrica, dominioDeClave } from "../notario/lexico.js";
import { normalizar } from "../notario/afirmacion.js";
/* FAMILIA 4 (§7.3·49f · 51f · 52a): el rótulo de cada medida («saldo vencido», «venta a crédito», «en yoy»→«en variación vs año anterior en $») lo decide `./rotulos.js`; acá solo se le pregunta */
import { rotuloDeLaCasa, rotuloDeClave, rotuloEnOracion, conceptoDeLaFig, claveDeLaFig } from "./rotulos.js";

const _lab = (f) => String((f && f.label) || "");
const _entidadDe = (label) => { const p = String(label || "").split("·").map((s) => s.trim()); return p.length >= 2 ? p[0] : null; };
const _conceptoDeLabel = conceptoDeLaFig;
const _labelDeClave = rotuloDeClave;
const _planoDeLente = (s) => String(s).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/* ── LA TABLA lente → medida ────────────────────────────────────────────────────────────────────────────────────────
 * `tema`/`concepto`: el dominio donde la lente APLICA y el concepto cuyo productor trae su medida (lo que se LEE);
 * `nombre`: la medida dicha con palabras de la casa. «ventas» no tiene dominio propio (es la venta del período de la cuenta):
 * aplica a todo grupo de cuentas que TRAE su venta (comercial; en cobranza es la venta a crédito, 52a). */
export const MEDIDAS_DE_LENTE = {
  credito: { tema: "cobranza", concepto: "saldo_vencido", nombre: rotuloEnOracion({ clave: "saldo_vencido" }) },
  capital: { tema: "inventario", concepto: "capital_frenado", nombre: rotuloEnOracion({ clave: "capital_frenado" }) },
  contribucion: { tema: "comercial", concepto: "no_capturada", nombre: rotuloEnOracion({ clave: "no_capturada" }) },
  ventas: { tema: "comercial", concepto: "ventas", nombre: rotuloEnOracion({ clave: "ventas" }) },
  crecimiento: { tema: "comercial", concepto: "variacion", nombre: rotuloEnOracion({ clave: "variacion" }) },   /* §7.3·56 */
};
/* la señal propia de una lente SIN dominio (para reconocerla en las figs de un grupo de cuentas): «ventas» ordena con la venta que el grupo trae */
/* §7.3·56: la medida de la lente «crecimiento» es la variación contra el año anterior (en % o en $); donde el dato la publica (comercial) la lente APLICA y ordena: va primero la de mayor variación (50a). `claves`: las claves del léxico que ordenan como la lente */
const _MEDIDA_SIN_DOMINIO = {
  ventas: { re: /· Ventas?(?: \(flujo\)| a crédito)?$/i, nombre: rotuloEnOracion({ clave: "ventas" }), peor: "mayor", temas: ["comercial", "cobranza"] },
  crecimiento: { re: /· Variaci[oó]n vs a[nñ]o anterior$/i, nombre: rotuloEnOracion({ clave: "variacion" }), peor: "mayor", temas: ["comercial"], claves: ["variacion", "variacion_usd"], parcial: true },   /* `parcial`: quien no tiene la variación (una marca sin año anterior) no se ordena ni se cuenta como 0: se declara «sin dato de X para Y» (52b) y la lente ordena a los demás */
};
/* 52(a): en cobranza la venta de la cuenta es la venta A CRÉDITO; su nombre sale del léxico (nunca escrito a mano acá) */
const _ventaACredito = () => String(_labelDeClave("venta_credito")).toLowerCase();
const _esVentaDeCobranza = (id, tema) => id === "ventas" && tema === "cobranza";

/* ── LA LENTE QUE EL USUARIO PIDIÓ ──────────────────────────────────────────────────────────────────────────────────── */
/** el id de la lente que el USUARIO pidió (origen usuario, ≠ la de ADI), o null */
export const lenteIdDelCriterio = (criterio) => (criterio && criterio.origen === "usuario" && criterio.lente && CRITERIOS[criterio.lente] ? criterio.lente : null);

/** §7.3·45(e) — una lente se nombra con su NOMBRE VISIBLE (`CRITERIOS[id].nombre`), nunca con su id interno. Una lente cuyo id YA
 *  es la palabra que abre su nombre visible («riesgo» en «riesgo integrado») se dice con esa palabra. §7.3·52(a): en cobranza
 *  «ventas» se dice «venta a crédito». Solo una clave que no es lente cae a null. */
export function nombreVisibleDeLente(id, tema = null) {
  const L = CRITERIOS[id];
  if (!L || !L.nombre) return null;
  if (_esVentaDeCobranza(id, tema)) return _ventaACredito();
  const cabeza = String(L.nombre).split(/\s+/)[0];
  return _planoDeLente(cabeza) === _planoDeLente(id) ? cabeza : L.nombre;
}

/** ¿la lente `id` es la que de verdad ORDENÓ la lista (su `claveOrden` es la señal que la lente declara)? §7.3·46(d).
 *  El atajo por el NOMBRE («ventas» ↔ Venta) vale solo para una lente SIN dominio; la medida de una lente con dominio es la
 *  que declara `LENTES` (crédito = saldo vencido · capital = capital inmovilizado crítico · contribución = contribución no
 *  capturada). La comparación usa el rótulo del léxico TAL CUAL (con su tilde): `LENTES.….re` lo trae con tilde. */
export function lenteOrdenaLaClave(id, claveOrden) {
  const L = CRITERIOS[id];
  if (!L || !claveOrden) return false;
  const label = String(_labelDeClave(claveOrden));
  const lab = _planoDeLente(label);
  if (!L.dominio && _planoDeLente(L.nombre).startsWith(lab)) return true;   // «ventas» ↔ Venta
  if (!L.dominio && _MEDIDA_SIN_DOMINIO[id] && Array.isArray(_MEDIDA_SIN_DOMINIO[id].claves) && _MEDIDA_SIN_DOMINIO[id].claves.includes(claveOrden)) return true;   // §7.3·56: «crecimiento» ↔ variación vs año anterior
  const spec = L.dominio && L.lente && LENTES[L.dominio] && LENTES[L.dominio][L.lente];
  return !!(spec && (spec.re.test(`· ${label}`) || spec.re.test(`· ${lab}`)));
}

/* ── QUIÉN PIDE ATENCIÓN (50a) ──────────────────────────────────────────────────────────────────────────────────────── */
/** true cuando el primero de la PRIORIDAD es el MENOR de la medida `claveOrden` (solo una tasa o razón donde más es mejor). */
export function atencionEsElMenor(criterio, claveOrden) {
  if (!claveOrden) return false;
  const id = criterio && criterio.lente && CRITERIOS[criterio.lente] ? criterio.lente : null;
  if (id && lenteOrdenaLaClave(id, claveOrden)) return false;   // la medida de la lente: de mayor a menor
  const m = metricaPorClave(claveOrden) || {};
  return m.polaridad === "mayor" && m.unidad !== "money" && m.unidad !== "count";   // una magnitud nunca invierte: solo la tasa o razón
}
/* el que pide atención entre `nombres` (en su orden de lista) por `claveOrden`: null cuando ya es el primero de la lista o no hay valores */
function _primeroDeAtencion(nombres, valorDe, criterio, claveOrden) {
  if (!Array.isArray(nombres) || nombres.length < 2 || !claveOrden) return null;
  const menor = atencionEsElMenor(criterio, claveOrden);
  let mejor = null, mv = NaN;
  for (const n of nombres) { const v = valorDe(n); if (!Number.isFinite(v)) continue; if (mejor == null || (menor ? v < mv : v > mv)) { mejor = n; mv = v; } }
  return mejor && mejor !== nombres[0] ? mejor : null;
}

/* ── LA LENTE QUE APLICA AL DOMINIO DEL GRUPO (47a) ─────────────────────────────────────────────────────────────────── */
/* devuelve null cuando el camino de siempre basta (lente que no aplica al dominio, lente que ya ordenó la lista con valores distintos de cero) */
function _lenteDelGrupo(criterio, tema, cierre, entidades, figs, porEntidad, claveOrden) {
  const id = criterio && criterio.lente && CRITERIOS[criterio.lente] ? criterio.lente : null;
  if (!id || cierre !== "decision" || !Array.isArray(entidades) || !entidades.length) return null;
  const C = CRITERIOS[id];
  const spec = C.dominio === tema && C.lente && LENTES[C.dominio] ? LENTES[C.dominio][C.lente] : (!C.dominio && _MEDIDA_SIN_DOMINIO[id] && _MEDIDA_SIN_DOMINIO[id].temas.includes(tema) ? _MEDIDA_SIN_DOMINIO[id] : null);   /* la venta comercial y el inventario son universos que no reconcilian: «ventas» no ordena un grupo de SKU de inventario, se declara */
  if (!spec) return null;
  const des = C.desempate && LENTES[C.dominio][C.desempate] ? LENTES[C.dominio][C.desempate] : null;
  const medida = _esVentaDeCobranza(id, tema) ? _ventaACredito() : ((MEDIDAS_DE_LENTE[id] && MEDIDAS_DE_LENTE[id].nombre) || spec.nombre);
  const nombreVisible = nombreVisibleDeLente(id, tema);
  const base = { id, nombreVisible, medida, entidades: entidades.slice() };
  /* dónde vive la fig en el mapa del plan (entidad · clave): su id ya está en la tabla de Cifras, y se reusa (un mismo hecho no se declara dos veces: doble colocación) */
  const ubicar = (fig) => { for (const [e, m] of (porEntidad && porEntidad.entries ? porEntidad.entries() : [])) for (const [c, v] of (m && m.entries ? m.entries() : [])) if (v === fig) return { e, c }; return null; };
  const conceptoDe = (f) => rotuloEnOracion({ fig: f });   /* FAMILIA 4: «en venta a crédito», «en venta», «en variación vs año anterior en $» — el rótulo del léxico de la cifra, nunca el del productor («venta (flujo)», «ventas», «yoy») */
  const mapaDe = (n) => (porEntidad && porEntidad.get ? porEntidad.get(n) : null) || new Map();
  /* la lente YA ordenó la lista (su clave es la del grupo): solo falta no coronar a nadie cuando esa medida vale cero en todas */
  if (claveOrden && lenteOrdenaLaClave(id, claveOrden)) {
    const fs = entidades.map((e) => mapaDe(e).get(claveOrden)).filter((f) => f && typeof f === "object" && Number.isFinite(f.raw));
    const cero = ceroPorCobertura(claveOrden);   /* §7.3·52(b): solo una fuente que declara cubrir al grupo hace de la ausencia un cero */
    const todasCero = entidades.every((e) => { const f = mapaDe(e).get(claveOrden); return f && typeof f === "object" && Number.isFinite(f.raw) ? f.raw === 0 : cero; });
    if (todasCero && fs.length) return { ...base, modo: "sin-discrimina", motivo: "cero", figCero: fs[0], ubicCero: ubicar(fs[0]), concepto: conceptoDe(fs[0]) };
    return null;
  }
  /* FAMILIA 2: las cifras que el grupo SIRVE (la boleta, la proyección o el cero de cobertura declarada de `servidas.js`) viven en `porEntidad`: la medida de la lente que la Entrega imprime cuenta, y «el grupo no trae X» nunca niega lo impreso (§7.3·51b) */
  const _servidas = []; if (porEntidad && porEntidad.values) for (const mp of porEntidad.values()) if (mp && mp.values) for (const x of mp.values()) if (x && typeof x === "object" && x.label) _servidas.push(x);
  const propias = (re) => { const m = new Map(); for (const f of [...(Array.isArray(figs) ? figs : []), ..._servidas]) { const l = _lab(f); if (!re.test(l) || !Number.isFinite(f.raw)) continue; const e = _entidadDe(l); if (e && !m.has(normalizar(e))) m.set(normalizar(e), f); } return m; };
  const deLente = propias(spec.re), deDesempate = des ? propias(des.re) : new Map();
  const filas = entidades.map((e) => ({ e, f: deLente.get(normalizar(e)) || null, d: deDesempate.get(normalizar(e)) || null })).filter((x) => x.f);
  if (!filas.length && spec.parcial) return null;   /* §7.3·56: donde el dato no publica la medida para el eje de la parte (la variación vs año anterior por SKU), la lente NO aplica y se declara (50b: `nombraLaLista`) */
  if (!filas.length || (!C.dominio && !spec.parcial && filas.length !== entidades.length)) return { ...base, modo: "sin-discrimina", motivo: "sin-medida", concepto: medida };   /* una lente sin dominio solo corona si el grupo TRAE su medida en todas las cuentas */
  const mayor = spec.peor !== "menor";
  const vd = (x) => (mayor ? x.f.raw : -x.f.raw);
  filas.sort((a, b) => (vd(b) - vd(a)) || ((b.d ? b.d.raw : -Infinity) - (a.d ? a.d.raw : -Infinity)));
  const cima = filas[0];
  if (!(cima.f.raw > 0)) return { ...base, modo: "sin-discrimina", motivo: "cero", figCero: cima.f, ubicCero: ubicar(cima.f), concepto: conceptoDe(cima.f) };
  const empatadas = filas.filter((x) => x.f.raw === cima.f.raw && (x.d ? x.d.raw : null) === (cima.d ? cima.d.raw : null));
  if (empatadas.length > 1) return { ...base, modo: "sin-discrimina", motivo: "empate", empatadas: empatadas.map((x) => x.e), figEmpate: cima.f, ubicEmpate: ubicar(cima.f), concepto: conceptoDe(cima.f) };
  return { ...base, modo: "primero", primero: cima.e, fig: cima.f, ubicFig: ubicar(cima.f), concepto: conceptoDe(cima.f) };
}

/* ── QUÉ SE NOMBRA DESPUÉS DE «por» CUANDO LA LENTE NO CORONÓ (46d · 47d · 48b · 52e) ────────────────────────────────────
 * Devuelve la DECISIÓN, nunca la frase:
 *   { tipo: "lente",      nombre }                         la lente que de verdad ordenó la lista (o la que el criterio trae sin clave de orden)
 *   { tipo: "nombre",     texto }                          una clave que no es lente (un nombre de la casa)
 *   { tipo: "medida",     clave, declara: null | {…} }     la clave de orden; `declara` = la lente pedida que NO ordena este grupo; `porElTop: true` (55a) = la lista la ordenó el top por ventas que se pidió
 *   { tipo: "referencia", clave, referencia }              52(e): un criterio que solo trae una REFERENCIA nombra la medida que ordenó y la referencia como tal
 *   null                                                   el criterio no trae nada que nombrar (no hay oración) */
export function nombraLaLista(criterio, tema, claveOrden, { ordenDelTop = false } = {}) {
  if (!criterio) return null;
  const id = criterio.lente && CRITERIOS[criterio.lente] ? criterio.lente : null;
  if (!id || !claveOrden) {
    if (criterio.lente) {   // una lente que no es de la casa, o sin clave de orden: lo de siempre
      const v = nombreVisibleDeLente(criterio.lente, tema);
      if (v) return { tipo: "lente", nombre: v };
      const m = metricaPorClave(criterio.lente);
      return { tipo: "nombre", texto: m ? m.nombre.toLowerCase() : criterio.lente };
    }
    const c = criterio.referencia && criterio.referencia.concepto;   // una REFERENCIA (umbral, piso, techo, benchmark): no es una lente (52e)
    if (!c) return null;
    const m = metricaPorClave(c);
    return { tipo: "referencia", clave: claveOrden || null, referencia: m ? m.nombre.toLowerCase() : c };
  }
  const L = CRITERIOS[id];
  /* v24 (Q44, §7.3·47e + 46d): el «riesgo integrado» que el USUARIO pidió es el criterio ENTRE dominios: dentro de un grupo de una parte no ordena, y eso se DECLARA */
  if (id === "riesgo" && criterio.origen === "usuario" && !lenteOrdenaLaClave(id, claveOrden)) return { tipo: "medida", clave: claveOrden, declara: { nombre: nombreVisibleDeLente(id, tema), entreDominios: true, dominio: null } };
  /* §7.3·55(a) (corrige la 54(c)): si el universo de la parte YA viene ordenado por venta (un top por ventas que pidió el usuario), lo que ordenó la lista ES la venta: la oración lo nombra así («por venta, el top que se pidió») y NO declara «ventas no ordena este grupo»
   * (una oración nunca dice que una medida no ordena y a la vez ordena por ella). El inventario por SKU no publica la venta: la lente «ventas» no es la que ordenó, el top sí. Sin ese top, la 50(b) rige: la lente se declara. */
  if (id === "ventas" && tema === "inventario" && ordenDelTop && lenteOrdenaLaClave(id, claveOrden)) return { tipo: "medida", clave: claveOrden, declara: null, porElTop: true };
  /* §7.3·54(c): la 50(b) vale en TODOS los caminos — la lente «ventas» sobre una parte de INVENTARIO sin ese top se declara y no ordena */
  const _ventasSobreInventario = id === "ventas" && tema === "inventario";
  if (id !== "riesgo" && (_ventasSobreInventario || (L.dominio !== tema && !lenteOrdenaLaClave(id, claveOrden)))) return { tipo: "medida", clave: claveOrden, declara: { nombre: nombreVisibleDeLente(id, tema), entreDominios: false, dominio: L.dominio || null } };
  return lenteOrdenaLaClave(id, claveOrden) ? { tipo: "lente", nombre: nombreVisibleDeLente(id, tema) } : { tipo: "medida", clave: claveOrden, declara: null };
}

/* ═══ LA PIEZA ═════════════════════════════════════════════════════════════════════════════════════════════════════════
 * prioridadDeParte({ criterio, tema, cierre, entidades, claveOrden, valorDe, proyeccion, figs, porEntidad }) → la decisión de prioridad
 * de UNA parte (o de un grupo cualquiera) sobre `entidades`, nombradas en el orden de su lista:
 *   modo      "lente"        la medida de la lente que APLICA ordenó y coronó a alguien (`primero`)
 *             "sin-primero"  la lente que aplica no distingue a nadie (cero · empate · sin dato): ninguna cuenta queda primera
 *             "propia"       el grupo se ordena por su medida propia: `primero` pide atención por esa medida (50a)
 *   primero   quién va primero en la oración de prioridad (null si modo "sin-primero" o sin entidades)
 *   lenteGrupo      el detalle de la lente que aplica (id, nombre visible, medida, motivo, figs) o null — el compositor declara sus cifras
 *   primeroAtencion el que pide atención cuando NO es el primero de la lista (50a), o null
 *   nombra    qué se nombra tras «por» en modo "propia" (ver `nombraLaLista`)
 *   ordenDelTop (entrada, 55a)  la lista de la parte la ordenó el top que el usuario pidió (el universo YA viene ordenado por esa medida)
 * `valorDe(nombre)` → el número de la medida `claveOrden` de esa entidad (NaN si no lo trae); `proyeccion` (opcional, `valoresDeProyeccion`) → los
 * mismos valores según la proyección del dato, para cuando las figs del turno no los traen todos. `cierre` ≠ "decision" no prioriza. */
export function prioridadDeParte({ criterio = null, tema = null, cierre = "decision", entidades = [], claveOrden = null, valorDe = null, proyeccion = null, figs = [], porEntidad = null, ordenDelTop = false } = {}) {
  const lenteGrupo = _lenteDelGrupo(criterio, tema, cierre, entidades, figs, porEntidad, claveOrden);
  /* 50(a): quien pide atención se decide con los valores de la medida. Cuando las figs del turno no traen el valor crudo de TODAS las entidades (una tasa como la variación, que la boleta no publica con su crudo), se decide con la proyección del dato —los mismos valores, de una sola fuente—: sin valores NO se corona a la primera de la lista (un MEJOR por una tasa). Nunca se mezclan dos escalas: o todas por las figs, o todas por la proyección. */
  let vd = valorDe;
  if (typeof valorDe === "function" && proyeccion instanceof Map && Array.isArray(entidades) && entidades.length >= 2 && !entidades.every((n) => Number.isFinite(valorDe(n))) && entidades.every((n) => proyeccion.has(normalizar(n)))) vd = (n) => proyeccion.get(normalizar(n));
  const primeroAtencion = cierre === "decision" && typeof vd === "function" ? _primeroDeAtencion(entidades, vd, criterio, claveOrden) : null;
  const nombra = criterio ? nombraLaLista(criterio, tema, claveOrden, { ordenDelTop }) : null;
  const modo = lenteGrupo ? (lenteGrupo.modo === "primero" ? "lente" : "sin-primero") : "propia";
  const primero = modo === "lente" ? lenteGrupo.primero : modo === "sin-primero" ? null : (primeroAtencion || (entidades && entidades.length ? entidades[0] : null));
  return { modo, primero, lenteGrupo, primeroAtencion, nombra };
}

/** §7.3·55(c): tras «ninguna cuenta queda primera» la lista (el grupo, o los empatados) conserva el orden del universo SERVIDO —el del top, el de las entidades en el orden en que se nombraron o el de la foto— y nunca el que usó la pieza para decidir quién pide atención
 *  (que ordena por el primer concepto pedido). Reordena en el lugar el detalle `lenteGrupo` de una decisión `sin-discrimina` (`entidades` y `empatadas`); quien no está en el orden servido queda al final, en su orden. Sin lente que no distingue, no toca nada. Devuelve `prio`. */
export function alOrdenServido(prio, ordenServido) {
  const lg = prio && prio.lenteGrupo;
  if (!lg || lg.modo !== "sin-discrimina" || !Array.isArray(ordenServido) || !ordenServido.length) return prio;
  const pos = new Map(); ordenServido.forEach((n, i) => { const k = normalizar(n); if (!pos.has(k)) pos.set(k, i); });
  const clave = (n) => (pos.has(normalizar(n)) ? pos.get(normalizar(n)) : Infinity);
  const porServido = (xs) => xs.slice().sort((a, b) => { const ka = clave(a), kb = clave(b); return ka === kb ? 0 : ka < kb ? -1 : 1; });
  if (Array.isArray(lg.entidades)) lg.entidades = porServido(lg.entidades);
  if (Array.isArray(lg.empatadas)) lg.empatadas = porServido(lg.empatadas);
  return prio;
}

/** los valores de la medida `claveOrden` en el eje `eje` según la PROYECCIÓN del dato (`I.rankingDe`): `Map(nombre normalizado → valor)` o null si la proyección no publica ese ranking */
export function valoresDeProyeccion(I, eje, claveOrden) {
  if (!I || !eje || !claveOrden) return null;
  const nombre = (metricaPorClave(claveOrden) || {}).nombre || claveOrden;
  /* el ranking de la proyección por la clave de la métrica; si el eje lo publica con otra clave, por el nombre de la métrica (`rankingDe`) */
  let r = I.rankings && I.rankings[eje] && I.rankings[eje][claveOrden] ? I.rankings[eje][claveOrden] : null;
  if (!r && typeof I.rankingDe === "function") { try { const rk = I.rankingDe(eje, nombre); r = rk && rk.r ? rk.r : null; } catch { r = null; } }
  if (!r || !Array.isArray(r.filas)) return null;
  const m = new Map();
  for (const f of r.filas) if (f && Number.isFinite(f.valor)) m.set(normalizar(f.entidad), f.valor);
  return m;
}

/* ── LA PRIORIDAD CRUZADA ENTRE DOMINIOS (la de `prioridadIntegrada`, el procedimiento del agente) ──────────────────────
 * Una sola función pregunta quién va primero entre dominios; el compositor, las rutas fijas y la iniciativa leen su resultado. */
export function prioridadCruzada(figs, temas) {
  const P = prioridadIntegrada(figs, temas);
  const top = P && Array.isArray(P.integrada) ? (P.integrada[0] || null) : null;
  return { P, top };
}
/** el líder de cada dominio (el que más pesa DENTRO del dominio, por su lente de materialidad): `{ dominio: señales de la cuenta líder }` */
export function lideresPorDominio(P) {
  const out = {};
  for (const d of Object.keys((P && P.porDominio) || {})) { const x = P.porDominio[d][0]; if (x) out[d] = x; }
  return out;
}
/** §7.3·55(b) (precisa la 52(a)): el nombre de la lente «ventas» es POR PARTE, nunca por encargo. La oración de prioridad de un plan que reúne varias partes es la de las partes que DECIDEN: con una parte comercial
 *  la lente ordena por la venta del período y se dice «ventas» (aunque el encargo tenga una parte de cobranza); «venta a crédito» se dice solo cuando la parte que decide es de COBRANZA. Devuelve el tema de esa parte (comercial · cobranza, los dominios donde la lente «ventas» aplica) o null
 *  (ninguna parte que decide es de cuentas: el nombre sigue al dominio de la medida con que se ordenó, como siempre). */
export function temaDeLaParteQuePrioriza(temasDeDecision, temas) {
  const d = (Array.isArray(temasDeDecision) && temasDeDecision.length ? temasDeDecision : Array.isArray(temas) ? temas : []).filter(Boolean);
  return d.includes("comercial") ? "comercial" : d.includes("cobranza") ? "cobranza" : null;
}
/** quién va primero por la lente que el USUARIO pidió (47a/46d: `ordenPorCriterio`, la misma función que ordena «ahora por X»):
 *  `{ lente, entidad, metrica, dominio, temaDeLaParte }` o null cuando esa lente no puede ordenar estas figs (se declara, nunca se sustituye).
 *  `temasDeDecision` (55b): los temas de las partes `decision` del plan, de donde sale el nombre de la lente. */
export function prioridadPorLente(temas, figs, lente, temasDeDecision = null) {
  if (!lente || lente === "riesgo" || !CRITERIOS[lente]) return null;
  const temaDeLaParte = CRITERIOS[lente].dominio || temaDeLaParteQuePrioriza(temasDeDecision, temas);
  const _ordenar = (fs) => { try { return ordenPorCriterio(fs, temas, lente); } catch { return null; } };
  const _cabeza = (O) => { const p = O && Array.isArray(O.lista) ? O.lista[0] : null; const c = p && Array.isArray(p.cifras) ? p.cifras[0] : null; return p && c && c.metrica ? { primero: p, c0: c } : null; };
  /* 55(b): en una parte COMERCIAL la lente «ventas» ordena por la venta del período, no por la venta a crédito de la mesa de cobranza (el productor prefiere la de la mesa cuando el plan trae las dos): la medida de la lente es la de SU parte; sin la venta de la parte
   * la lente no ordena (se declara), nunca se ordena una parte comercial por la venta a crédito diciendo «ventas» */
  const K = _cabeza(_ordenar(lente === "ventas" && temaDeLaParte === "comercial" ? (Array.isArray(figs) ? figs : []).filter((f) => claveDeLaFig(f) !== "venta_credito") : figs));
  if (!K) return null;
  const { primero, c0 } = K;
  if (rotuloDeLaCasa({ concepto: c0.metrica }).sinClave) return null;   /* FAMILIA 4 (52e): una medida que el léxico no conoce no se imprime con el rótulo crudo del productor: la lente no ordena (se declara) */
  /* `temaDeLaParte`: el tema de la PARTE a la que pertenece la oración (55b) — con él se NOMBRA la lente («venta a crédito» solo en cobranza, 52a); sin parte que decida, el dominio de la MEDIDA con que ordenó; `dominio` es el de siempre (la fila de la tabla) */
  const claveMedida = claveExactaDeMetrica(c0.metrica);
  return { lente, entidad: primero.entidad, metrica: c0.metrica, dominio: CRITERIOS[lente].dominio || (temas.includes("comercial") ? "comercial" : temas[0]), temaDeLaParte: temaDeLaParte || (claveMedida && dominioDeClave(claveMedida)) || null };
}
/** §7.3·56: el concepto de la medida de una lente sin dominio que el dato publica POR CUENTA y no para todas (la variación contra el año anterior de la lente «crecimiento»): el grupo la completa con la proyección ANTES de ordenar (quien el dato no trae queda
 *  sin dato, 52b) y la oración de la lente ordena a los demás. null para toda otra lente o tema. */
export function conceptoDeLaMedidaParcial(criterio, tema) {
  const id = criterio && criterio.lente && CRITERIOS[criterio.lente] ? criterio.lente : null;
  const s = id && !CRITERIOS[id].dominio ? _MEDIDA_SIN_DOMINIO[id] : null;
  return s && s.parcial && s.temas.includes(tema) && MEDIDAS_DE_LENTE[id] ? MEDIDAS_DE_LENTE[id].concepto : null;
}
/** el MODO de la prioridad cruzada de un plan multitema (48b · 51d): qué oración se dice.
 *    "por-lente"        la lente que el usuario pidió ordenó (`porLente`)
 *    "lente-no-aplica"  el criterio pedido no ordena este conjunto: se declara y sigue la lectura de riesgo integrado
 *    "riesgo-pedido"    «riesgo» pedido sobre UN dominio (sin prioridad cruzada)
 *    "integrada"        la prioridad de riesgo integrado entre dominios
 *    null               no hay oración de prioridad cruzada */
export function modoDeLaCruzada({ top, conDecision, porLente, lenteNoAplica, lenteRiesgoPedida, temas, lideres }) {
  if (porLente) return "por-lente";   // `porLente` solo existe con `conDecision`
  if (top) return "integrada";
  if (!conDecision) return null;
  if (lenteNoAplica) return "lente-no-aplica";
  if (lenteRiesgoPedida && Array.isArray(temas) && temas.length === 1 && lideres && lideres[temas[0]]) return "riesgo-pedido";
  return null;
}

/** el «X va antes que Y» es del riesgo integrado: solo se sirve si la lente pedida pone primero a la MISMA cuenta (nunca se contradice) */
export const vaAntesQue = ({ top, porLente, hayVersus }) => !!(top && (!porLente || porLente.entidad === top.entidad) && hayVersus);

/* ── QUIÉN VA PRIMERO POR UNA MEDIDA (rutas fijas e iniciativa: el productor trae los valores, la pieza decide el primero) ─ */
/** primeroPorMedida({ tema, claveOrden, entidades, valorDe, criterio? }) → el nombre de quien pide atención por esa medida,
 *  o null sin entidades. Es `prioridadDeParte` sin lente: la misma regla de la 50(a), una sola. */
export function primeroPorMedida({ tema = null, claveOrden, entidades, valorDe, criterio = null }) {
  const d = prioridadDeParte({ criterio, tema, cierre: "decision", entidades, claveOrden, valorDe });
  return d.primero;
}

/* ── LA MARCA ESTRUCTURAL de una oración de prioridad ──────────────────────────────────────────────────────────────────
 * `alcance`: "grupo" (dentro de un grupo de una parte) · "dominio" (la cartera de un dominio) · "cruzada" (entre dominios).
 * Lo que antes se reconocía con tres expresiones regulares sobre la prosa. */
export const ALCANCE_DE_PRIORIDAD = { GRUPO: "grupo", DOMINIO: "dominio", CRUZADA: "cruzada" };
export const marcaDePrioridad = (alcance, primero = null) => ({ alcance, primero: primero == null ? null : String(primero) });
/** ¿esta oración de la Respuesta es la prioridad (la conclusión) del procedimiento? */
export const esOracionDePrioridad = (r) => !!(r && r._prioridad);
/** la entidad PRIORITARIA de una Entrega para decidir qué pregunta abierta se sirve en «breve»: la que nombra la PRIMERA oración
 *  de prioridad cuando esa oración no es la de un grupo (la de un grupo no decide la pregunta del conjunto: es la regla de hoy). */
export function primeroDeLaConclusion(entrega) {
  const r = (entrega && Array.isArray(entrega.respuesta) ? entrega.respuesta : []).find(esOracionDePrioridad);
  if (!r || r._prioridad.alcance === ALCANCE_DE_PRIORIDAD.GRUPO) return null;
  return r._prioridad.primero || null;
}
