/* === src/adi/agente/mapaDelDato.js · EL MAPA DE EXISTENCIA (ADI Agente · F2 · owner 2026-08-30) ===============
 *
 * QUÉ ES. La foto CHICA que viaja en el system del agente: qué ejes existen, qué entidades, qué métricas por
 * eje, qué períodos, y qué límites están declarados. Lo suficiente para ELEGIR herramientas sin adivinar — el
 * detalle lo trae la herramienta cuando hace falta. Reemplaza EN EL VIAJE a la proyección completa (~3.9K tok);
 * `datoProyectado` no se retira: sigue siendo la quinta fuente del muro y el insumo del suplente, client-side.
 *
 * LAS CUATRO LEYES DE ESTE MÓDULO (F1 §9, aceptadas por el owner):
 *   1 · FIEL EN LAS DOS DIRECCIONES: lo que declara existir existe en el pack, y lo que existe está declarado.
 *       Un mapa que drifea hace que el cerebro pida herramientas que no van a responder — o no pida las que sí.
 *   2 · LÍMITES SIN INVENTAR: sello de carga, presupuesto sin declarar, moneda/escala, huecos de la historia,
 *       serie por entidad bloqueada — se dicen SI el dato los tiene, y NUNCA al revés.
 *   3 · TOPE PROBADO: ≤ ~1.300 tokens (≈4.800 chars) medido en el gate sobre el demo Y sobre un pack con
 *       historia — con listas largas se TRUNCA declarando la cola («… y 487 más»), jamás en silencio.
 *   4 · DETERMINÍSTICO BYTE A BYTE: mismo pack + mismo escenario → el mismo texto exacto. El caché de prefijo
 *       del proveedor — y con él la tabla de costos del F1 — depende de esto. El ORDEN lo fija el mapa
 *       (venta oficial descendente · desempate alfabético), nunca el orden de inserción del dato.
 *
 * PURO · sin red · sin Date.now() · lee el tenant activo. */
import { getTenantData } from "../../data/tenantStore.js";
import { POLICY } from "../../config/businessPolicy.js";   // [9] · el fallback de la vara — la regla de precedencia: fila.benchmark ?? POLICY.benchmark
import { factorComercialDe } from "../../config/contract/figureType.js";
import { getSelloDeCarga } from "../../ingesta/estadoCarga.js";
import { rotuloMoneda, etiquetaSinDeclarar } from "../../config/moneda.js";
import { datasetCapability, serieRealDe, esSerieDelArchivo } from "../sentrix/capability.js";
import { alcanceDeHistoria, periodosDeHechos } from "../../ingesta/historico.js";
import { axisEntityNames } from "../oracle/entityIndex.js";   // el nombre de una entidad no es un eje (ver `_sinNombresDeEntidad`)
import { ESCENARIO_INICIAL } from "../../config/scenarios.js";   // colapso del eje: el agente lee el MISMO dato que la pantalla

/** cuántos nombres se listan por eje antes de declarar la cola — el tope de tamaño manda sobre la lista */
const MAX_NOMBRES = 12;

const _cmp = (a, b) => (b.v - a.v) || String(a.n).localeCompare(String(b.n), "es");

/** los nombres de un eje, ORDENADOS por su venta oficial (desc) y con la cola declarada. */
function _nombres(filas, campoNombre, campoValor) {
  const orden = (filas || [])
    .map((f) => ({ n: f[campoNombre], v: Number(f[campoValor]) || 0 }))
    .filter((x) => x.n)
    .sort(_cmp)
    .map((x) => x.n);
  const unicos = [...new Set(orden)];
  if (!unicos.length) return null;
  if (unicos.length <= MAX_NOMBRES) return `${unicos.length}: ${unicos.join(", ")}`;
  return `${unicos.length}: ${unicos.slice(0, MAX_NOMBRES).join(", ")} … y ${unicos.length - MAX_NOMBRES} más (pídelos con gridTable)`;
}

/* mapaDelDato(scenario) → el texto del mapa. Determinístico: mismo tenant+dato → mismos bytes.
 * COLAPSO DEL EJE (2026-08-30): el encabezado decía «· escenario actual» — el concepto muerto colándose en la
 * superficie NUEVA (y con el valor NO declarado «actual», distinto del que corre la pantalla: dos carpetas).
 * El único mundo no se etiqueta; el default pasa a la base real declarada para que agente y pantalla lean el
 * MISMO dato. El parámetro queda: es la ranura por la que el sustrato de simulación viaja a las herramientas. */
export function mapaDelDato(scenario = ESCENARIO_INICIAL) {
  const d = getTenantData() || {};
  const L = [];

  const moneda = rotuloMoneda(d);
  const escala = d.escalaComercial === "raw" ? "moneda cruda del archivo" : "miles";
  L.push(`MAPA DEL DATO — ${d.nombre || d.id || "negocio"} · moneda ${moneda || "sin declarar"} · montos comerciales en ${escala}.`);

  /* ── ejes y entidades · SOLO los que el pack trae ─────────────────────────────────────────────────────── */
  const ejes = [
    ["cliente", _nombres(d.clientesVentas, "nombre", "actual")],
    ["sku", _nombres(d.skusMargen, "nombre", "venta")],
    ["marca", _nombres(d.marcasMargen && d.marcasMargen.length ? d.marcasMargen : d.marcasVentas, "nombre", d.marcasMargen && d.marcasMargen.length ? "venta" : "actual")],
    ["familia", _nombres(d.sfamiliasMargen && d.sfamiliasMargen.length ? d.sfamiliasMargen : d.sfamiliasVentas, "nombre", d.sfamiliasMargen && d.sfamiliasMargen.length ? "venta" : "actual")],
    ["bodega", (() => {
      const b = [...new Set((d.skuInventario || []).map((r) => r.bodega).filter(Boolean))].sort((a, z) => String(a).localeCompare(String(z), "es"));
      return b.length ? `${b.length}: ${b.join(", ")}` : null;
    })()],
    ["canal", (() => {
      const c = [...new Set((d.clientesVentas || []).map((r) => r.canal).filter(Boolean))].sort((a, z) => String(a).localeCompare(String(z), "es"));
      return c.length ? `${c.length}: ${c.join(", ")}` : null;
    })()],
  ];
  L.push("EJES:");
  for (const [eje, txt] of ejes) if (txt) L.push(`- ${eje} (${txt})`);
  const sinEje = ejes.filter(([, txt]) => !txt).map(([e]) => e);
  if (sinEje.length) L.push(`- sin datos en: ${sinEje.join(", ")}`);

  /* ── métricas por eje · lo que de verdad se puede pedir ───────────────────────────────────────────────── */
  L.push("MÉTRICAS: cliente → ventas · margen · contribución · carga comercial" +
    ((d.skusMargen || []).length ? " | sku → venta · margen · contribución" : "") +
    ((d.skuInventario || []).length ? " | inventario → capital · rotación · días (por SKU y bodega)" : ""));

  /* ── [9] del examen 1 (2026-08-31) · BENCHMARK ≠ PROMEDIO. T3 respondió OTRA pregunta: usó el benchmark
   * (30.1%) donde el usuario pidió el margen medio de la cartera (25.1%) — la equivalencia está prohibida.
   * La vara es DECLARADA (por fila del dato, con el fallback de política — la regla de precedencia de
   * businessPolicy); el promedio es una CUENTA sobre el dato. El mapa lo dice para que el cerebro no los funda. */
  const _bs = [...new Set((d.clientesMargen || []).filter((c) => c && c.tipo === "cliente")
    .map((c) => (Number.isFinite(c.benchmark) ? c.benchmark : POLICY.benchmark)))].sort((a, b) => a - b);
  if (_bs.length) {
    L.push(`BENCHMARK de margen: ${_bs.length === 1 ? `${_bs[0]}%` : `por fila (${_bs[0]}–${_bs[_bs.length - 1]}%)`} — vara DECLARADA del negocio. NO es el promedio de la cartera: si piden el promedio, se calcula del dato.`);
  }

  /* ── períodos y series ────────────────────────────────────────────────────────────────────────────────── */
  const cap = datasetCapability();
  const global = (d.ventasMensuales || []).length;
  const hayArchivo = Object.values(d.historialMargen || {}).some((s) => esSerieDelArchivo(s));
  if (hayArchivo) {
    const conSerie = Object.keys(d.historialMargen || {}).filter((n) => serieRealDe(n).real).sort((a, z) => a.localeCompare(z, "es"));
    const pers = conSerie.length ? (d.historialMargen[conSerie[0]] || []).map((p) => p.periodo) : [];
    L.push(`SERIES: mensual por entidad REAL RECONCILIADA (${conSerie.length} entidades · ${pers.length} ${pers.length === 1 ? "mes" : "meses"}${pers.length ? `: ${pers[0]} a ${pers[pers.length - 1]}` : ""}) — herramienta serieEntidad.`);
  } else if (global) {
    L.push(`SERIES: mensual GLOBAL real (${global} meses — herramienta trend). Por entidad: BLOQUEADA (histórico de muestra, no reconcilia — se declina).`);
  } else {
    L.push("SERIES: sin serie mensual en este dato.");
  }

  /* ── la historia cargada, con sus huecos ──────────────────────────────────────────────────────────────── */
  if (d.hechos && (d.hechos.Ventas || []).length) {
    const alcance = alcanceDeHistoria(periodosDeHechos(d.hechos));
    L.push(`HISTORIA: ${alcance.texto}`);
  }

  /* ── límites declarados · los del dato, nunca inventados ──────────────────────────────────────────────── */
  const limites = [];
  const kv = d.ventasKPI || {};
  if (!(typeof kv.totalPresupuesto === "number" && Number.isFinite(kv.totalPresupuesto) && kv.totalPresupuesto !== 0)) limites.push(etiquetaSinDeclarar("presupuesto"));
  if (!(typeof kv.totalAnterior === "number" && Number.isFinite(kv.totalAnterior) && kv.totalAnterior !== 0)) limites.push("sin período anterior");
  if (!moneda) limites.push(etiquetaSinDeclarar("moneda"));
  if (!cap.crosses.atomic) limites.push("cruce cliente×SKU: solo afinidad modelada (indicado)");
  /* [9] del examen 1: T22 ofreció un «cruce cliente×bodega» que NO existe — una opción incumplible es una
   * promesa falsa. El límite es estructural (los universos comercial e inventario no reconcilian — la misma
   * barrera de la decisión 7 de la Mesa) y se declara donde el cerebro elige qué ofrecer. */
  if ((d.skuInventario || []).length) limites.push("bodega: SOLO inventario (capital · rotación · días) — sin venta ni margen comercial, y sin cruce cliente×bodega (los universos no reconcilian)");
  if (!Object.keys(d.SCENARIO_TRANSFORMS || {}).length) limites.push("sin transforms de simulación declarados");
  const sello = getSelloDeCarga();
  if (sello && (sello.conAlarmas || (Array.isArray(sello.tipos) && sello.tipos.length))) {
    limites.push(`sello de carga vigente${Array.isArray(sello.tipos) && sello.tipos.length ? ` (${[...sello.tipos].sort().join(", ")})` : ""} — nómbralo cuando la respuesta use una lectura afectada`);
  }
  if (limites.length) L.push(`LÍMITES: ${limites.join(" · ")}.`);

  /* ── LO QUE EL ARCHIVO DEL USUARIO NO TRAJO (owner 2026-08-31) ─────────────────────────────────────────────
   * DECLARA, NO INTERPRETA: se repite lo que la ingesta ya dijo, con sus palabras («Ventas no trae "punto de
   * venta"»). Las consecuencias ya las dice el mapa arriba («sin datos en: canal»); esto es la CAUSA, que es
   * lo único que permite responder «tu archivo no trae esa columna: con ella te lo abro» en vez de «no tengo
   * ese eje». Si la llave no está —packs viejos guardados antes de que existiera— no se dice NADA: ausencia
   * no es «no faltaba nada». */
  const faltas = _faltantesDeclarados(d);
  if (faltas.length) {
    L.push(`TU ARCHIVO NO TRAE (${faltas.length}): ${faltas.slice(0, 6).map((f) => f.detalle).join(" · ")}${faltas.length > 6 ? ` · … y ${faltas.length - 6} más` : ""}.`);
    L.push("Cuando pidan algo que dependa de eso, DILO con la columna o la hoja por su nombre y ofrece lo que sí está — jamás lo inventes ni te disculpes en genérico.");
  }

  return L.join("\n");
}

/** los avisos de carga que el dataset trae, o [] si el pack es viejo y no los registró (ausencia ≠ nada). */
function _faltantesDeclarados(d) {
  const a = d && d.avisosDeCarga;
  return Array.isArray(a) ? a.filter((x) => x && x.detalle) : [];
}

/* ── QUÉ HABILITA LO QUE FALTA · el mapeo DECLARADO (no inferido) ──────────────────────────────────────────────
 * Relaciona una pregunta con la pieza del archivo que la haría posible, para que el rescate pueda nombrarla.
 * Es una tabla, no una inteligencia: cada fila dice qué falta, qué preguntas toca y qué se abriría con ella.
 * `dice` sale del aviso de la ingesta cuando existe; acá vive solo el vínculo. */
/* ⚠️ EL ORDEN ES PARTE DE LA REGLA: gana la primera que aplica, así que **la hoja va antes que su columna**.
 * Si la hoja Inventario vino vacía no falta «la columna bodega»: falta el inventario entero, y decir lo primero
 * sería mandar al usuario a arreglar lo que no es. */
const _QUE_HABILITA = [
  { falta: /hoja «?Abonos/i, toca: /\bcobr|\bdeb[eo]\b|\bdeuda|vencid|\bpag[oó]|cuenta corriente|\bmora\b|flujo comercial/i,
    pieza: "la hoja Abonos", abre: "quién te debe y qué está vencido" },
  /* HUECO CAZADO POR EL SUPERVISOR sobre la planilla REAL del owner (2026-08-31): la regla de bodega busca la
   * COLUMNA, y en su parcial la hoja Inventario vino sin una sola fila — ningún patrón la matcheaba, así que
   * «capital por bodega» volvía a la disculpa sin nombre. La hoja vacía es el caso NORMAL, no el raro: la
   * plantilla oficial se descarga con las cuatro hojas adentro, así que nadie las borra — las deja en blanco. */
  { falta: /hoja «?Inventario/i, toca: /\binventario\b|\bstock\b|\bcapital\b|rotaci[oó]n|frenad|inmoviliz|\bbodega|\bdep[oó]sito[s]?\b|d[ií]as de inventario|\bquiebre/i,
    pieza: "la hoja Inventario", abre: "el capital, la rotación y los días de tu inventario" },
  /* ⚠️ EL PLURAL CUENTA: «ranking de puntoS de venta» es la forma en que se pregunta de verdad —es el turno
   * textual del escenario 3— y el singular pelado no lo veía. Cazado por el propio gate al probar con la
   * pregunta real en vez de con la que yo había imaginado. Misma familia que el `\b` acentuado: la regla medía
   * UNA forma de escribir, no el concepto. */
  { falta: /"punto de venta"/i, toca: /punto[s]? de venta|sucursal|\btienda|\blocal(?:es)?\b/i,
    pieza: "la columna «punto de venta» de Ventas", abre: "el corte por punto de venta" },
  { falta: /"condici[oó]n"/i, toca: /cr[eé]dito|contado|condici[oó]n de venta/i,
    pieza: "la columna «condición» de Ventas", abre: "la venta a crédito" },
  { falta: /"canal"/i, toca: /\bcanal(?:es)?\b/i, pieza: "la columna «canal» de Ventas", abre: "el corte por canal" },
  { falta: /"marca"/i, toca: /\bmarca[s]?\b/i, pieza: "la columna «marca» de Ventas", abre: "el corte por marca" },
  { falta: /"familia"/i, toca: /\bfamilia|\bcategor[ií]a/i, pieza: "la columna «familia» de Ventas", abre: "el corte por familia" },
  { falta: /"bodega"/i, toca: /\bbodega|\bdep[oó]sito[s]?\b|\balmac[eé]n/i, pieza: "la columna «bodega» de Inventario", abre: "el capital por bodega" },
];

/* las palabras que NOMBRAN un eje en este mapa — las mismas que disparan las reglas de arriba. Un nombre de
 * entidad que es EXACTAMENTE una de estas no se tapa: ver el porqué en `_sinNombresDeEntidad`. */
const _PALABRAS_DE_EJE = new Set(["canal", "canales", "bodega", "bodegas", "deposito", "depositos", "depósito",
  "depósitos", "almacen", "almacén", "marca", "marcas", "familia", "familias", "categoria", "categoría",
  "inventario", "stock", "capital", "sucursal", "sucursales", "tienda", "tiendas", "local", "locales",
  "punto de venta", "puntos de venta", "abonos", "ventas"]);
const _norm = (s) => String(s || "").trim().toLowerCase();

/** la pregunta sin los nombres de las entidades del tenant — para que «Depósito Riachuelo» (un cliente) no se
 *  lea como el eje bodega. Se tapan solo las que de verdad aparecen; sin catálogo, la pregunta va tal cual. */
function _sinNombresDeEntidad(q) {
  let t = q;
  for (const eje of ["cliente", "sku", "marca", "familia", "bodega", "canal"]) {
    let nombres = [];
    try { nombres = axisEntityNames(eje) || []; } catch { continue; }
    for (const n of nombres) {
      if (!n || String(n).length < 4) continue;   // un nombre de 3 letras taparía media pregunta
      /* ⚠️ EL TAPADO CURABA DE MÁS (medido con control, 2026-09-01): una entidad llamada EXACTAMENTE como el
       * eje —una marca «Canal», una bodega «Bodega»— borraba de la pregunta la palabra que la regla necesita,
       * y «ranking por canal» dejaba de nombrar la pieza. Falla SILENCIOSA: ADI volvía a la disculpa y nada se
       * ponía rojo. Un nombre que ES la palabra del eje no desambigua nada —no distingue «la marca Canal» de
       * «el eje canal»—, así que taparlo solo puede quitar señal. El trade-off es consciente: con una entidad
       * homónima preferimos un falso positivo VISIBLE («tu archivo no trae la columna canal») antes que un
       * silencio. «Depósito Riachuelo» no entra acá: no es la palabra, la contiene, y se sigue tapando.
       * ⚠️ LÍMITE DECLARADO, no defecto: «Almacén Central» escrito por el usuario SIN ser entidad del tenant
       * se sigue leyendo como el eje. Ninguna regla determinística puede saber que ahí es un nombre propio. */
      if (_PALABRAS_DE_EJE.has(_norm(n))) continue;
      const re = new RegExp(String(n).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi");
      if (re.test(t)) t = t.replace(re, " ");
    }
  }
  return t;
}

/** faltanteQueToca(pregunta) → { pieza, abre } de lo que el archivo NO trajo y esta pregunta necesita, o null.
 *  Determinístico y conservador: si el dato no registró faltantes, o ninguno toca la pregunta, devuelve null. */
export function faltanteQueToca(pregunta) {
  const q = String(pregunta || "");
  if (!q.trim()) return null;
  const faltas = _faltantesDeclarados(getTenantData());
  if (!faltas.length) return null;
  /* ⚠️ EL NOMBRE DE UNA ENTIDAD NO ES UN EJE (medido 2026-09-01 sobre la parcial corregida): el cliente
   * «Depósito Riachuelo» hacía que «cuánto me compró Depósito Riachuelo el último mes» disparara la regla de
   * BODEGA —la palabra «depósito»— y ADI respondía «tu archivo no trae la columna bodega» a una pregunta sobre
   * un cliente. En distribución esos nombres son la norma («Depósito X», «Almacén Y»), así que el falso
   * positivo no era raro: era esperable. Las entidades del tenant se TAPAN antes de evaluar — la pregunta se
   * lee sin ellas, y solo entonces las palabras que quedan pueden nombrar un eje. */
  const qLimpia = _sinNombresDeEntidad(q);
  for (const regla of _QUE_HABILITA) {
    if (!regla.toca.test(qLimpia)) continue;
    if (faltas.some((f) => regla.falta.test(f.detalle))) return { pieza: regla.pieza, abre: regla.abre };
  }
  return null;
}
