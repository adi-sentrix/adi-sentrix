/* === ingesta/historico.js · LA CARGA ES HISTÓRICA Y EXPLÍCITA (owner 2026-08-30) =============================
 *
 * EL DEFECTO QUE CIERRA, verificado en producción: cada carga REEMPLAZABA el pack entero. Lo único que
 * sobrevivía de una versión a la siguiente era el plazo de pago, arrastrado a mano. Si el cliente subía
 * enero-marzo y después abril-junio, enero-marzo desaparecía sin un aviso — pérdida de dato silenciosa.
 *
 * LA REGLA DEL OWNER, textual: antes de activar, ADI declara qué períodos ya existían y qué trae el archivo;
 * lo nuevo se agrega; un período que ya existe es **reemplazo explícito, no suma silenciosa** — y el default es
 * cancelar. Después de activar se declara el alcance completo, **incluidos los huecos**: un «enero a
 * septiembre» sobre una historia con agujeros miente por omisión, la misma regla del top-N sin cola.
 *
 * ⚠️ SE FUSIONAN HECHOS, NUNCA AGREGADOS. Un margen, un % de carga o un ticket promedio de dos cargas no se
 * pueden sumar: fusionarlos a nivel KPI daría un margen que no es el margen de nadie. Por eso este módulo opera
 * sobre las FILAS por período (el grano fino que el pack ahora conserva) y el pack acumulado se RECALCULA
 * entero desde ellas con el mismo motor de siempre — el margen del acumulado sale bien porque se recalcula,
 * no porque se promedie.
 *
 * PURO · sin I/O · quien persiste (persistirCarga.server) y quien pregunta (handleIngesta) lo llaman con los
 * hechos en la mano. Así los seis pasos del gate del owner se ejercen offline, sin base y sin red.
 */

const ES_PERIODO = /^\d{4}-\d{2}$/;
const NOMBRE_MES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

/** «2026-05» → «mayo 2026» · para hablar como habla la gente, no en claves. */
export function nombreDePeriodo(per) {
  if (!ES_PERIODO.test(String(per || ""))) return String(per || "");
  const [a, m] = String(per).split("-").map(Number);
  return `${NOMBRE_MES[m - 1]} ${a}`;
}
const _sinAnio = (per) => NOMBRE_MES[Number(String(per).slice(5, 7)) - 1] || String(per);
/** Lista para leer: «marzo, mayo y septiembre 2026» — con el año una sola vez si es uno solo. */
function _listaLegible(periodos) {
  if (!periodos.length) return "";
  const anios = new Set(periodos.map((p) => String(p).slice(0, 4)));
  const nombres = anios.size === 1 ? periodos.map(_sinAnio) : periodos.map(nombreDePeriodo);
  const cola = anios.size === 1 ? ` ${[...anios][0]}` : "";
  if (nombres.length === 1) return nombres[0] + cola;
  return `${nombres.slice(0, -1).join(", ")} y ${nombres[nombres.length - 1]}${cola}`;
}

/** El período de una fila de hechos: Ventas ya trae `periodo`; Abonos lo lleva en su fecha. */
const _periodoDeVenta = (v) => (ES_PERIODO.test(String(v.periodo || "")) ? String(v.periodo) : String(v.fecha || "").slice(0, 7));
const _periodoDeAbono = (a) => String(a.fecha || "").slice(0, 7);

/* periodosDeHechos({ Ventas, Abonos }) → los meses presentes en el archivo, ordenados.
 * Un mes existe si tiene AL MENOS una fila — de venta o de abono: un pago de septiembre contra una factura de
 * agosto es un hecho de septiembre, y perderlo porque «septiembre no tiene ventas» sería la misma pérdida
 * silenciosa que este módulo viene a cerrar. */
export function periodosDeHechos(hechos = {}) {
  const s = new Set();
  for (const v of hechos.Ventas || []) { const p = _periodoDeVenta(v); if (ES_PERIODO.test(p)) s.add(p); }
  for (const a of hechos.Abonos || []) { const p = _periodoDeAbono(a); if (ES_PERIODO.test(p)) s.add(p); }
  return [...s].sort();
}

/** Los huecos: meses sin ninguna fila ENTRE el primero y el último cargado. Fuera de ese rango no hay hueco —
 *  nadie prometió tener datos de antes de empezar. */
export function huecosDe(periodos = []) {
  if (periodos.length < 2) return [];
  const [a0, m0] = periodos[0].split("-").map(Number);
  const [a1, m1] = periodos[periodos.length - 1].split("-").map(Number);
  const tiene = new Set(periodos);
  const faltan = [];
  for (let a = a0, m = m0; a < a1 || (a === a1 && m <= m1); m === 12 ? (a++, m = 1) : m++) {
    const per = `${a}-${String(m).padStart(2, "0")}`;
    if (!tiene.has(per)) faltan.push(per);
  }
  return faltan;
}

/* alcanceDeHistoria(periodos) → { periodos, desde, hasta, faltantes, texto }
 * El texto que ADI dice DESPUÉS de activar. Con historia continua: «Ahora tengo datos desde enero hasta
 * septiembre 2026». Con agujeros, los nombra — es obligatorio, no un detalle. */
export function alcanceDeHistoria(periodos = []) {
  const ps = [...periodos].sort();
  if (!ps.length) return { periodos: [], desde: null, hasta: null, faltantes: [], texto: "No hay ningún período cargado." };
  const faltantes = huecosDe(ps);
  if (ps.length === 1) {
    return { periodos: ps, desde: ps[0], hasta: ps[0], faltantes,
      texto: `Ahora tengo datos de ${nombreDePeriodo(ps[0])}.` };
  }
  const mismoAnio = ps[0].slice(0, 4) === ps[ps.length - 1].slice(0, 4);
  const texto = faltantes.length
    ? `Tengo ${_listaLegible(ps)}; faltan ${_listaLegible(faltantes)}.`
    : `Ahora tengo datos desde ${mismoAnio ? _sinAnio(ps[0]) : nombreDePeriodo(ps[0])} hasta ${nombreDePeriodo(ps[ps.length - 1])}.`;
  return { periodos: ps, desde: ps[0], hasta: ps[ps.length - 1], faltantes, texto };
}

/* diffDeCarga({ previos, delArchivo }) → { nuevos, repetidos, resultado, texto, pideDecision }
 *
 * La declaración ANTES de activar, con las frases que pidió el owner. `resultado` es cómo quedaría la historia
 * si se activa (agregando lo nuevo y, si el usuario lo confirma, reemplazando lo repetido — el diff no decide,
 * describe). `pideDecision` es la señal para la pantalla: hay al menos un período que ya existe. */
export function diffDeCarga({ previos = [], delArchivo = [] } = {}) {
  const setPrevios = new Set(previos);
  const nuevos = delArchivo.filter((p) => !setPrevios.has(p));
  const repetidos = delArchivo.filter((p) => setPrevios.has(p));
  const resultado = [...new Set([...previos, ...delArchivo])].sort();

  let texto;
  if (!previos.length) {
    texto = `Este archivo trae ${_listaLegible(delArchivo)}. Es la primera carga de esta empresa.`;
  } else if (!repetidos.length) {
    const alcance = alcanceDeHistoria(resultado);
    const unAnio = resultado[0].slice(0, 4) === resultado[resultado.length - 1].slice(0, 4);
    const quedo = alcance.faltantes.length
      ? `quedo con ${_listaLegible(resultado)} (faltan ${_listaLegible(alcance.faltantes)})`
      : `quedo con ${unAnio ? _sinAnio(resultado[0]) : nombreDePeriodo(resultado[0])}-${nombreDePeriodo(resultado[resultado.length - 1])}`;
    texto = `Ya tenías ${_listaLegible(previos)}. Este archivo trae ${_listaLegible(nuevos)}. Si lo activas, ${nuevos.length === 1 ? "agrego ese mes" : "agrego esos meses"} y ${quedo}.`;
  } else {
    const ya = `${_listaLegible(repetidos)} ya ${repetidos.length === 1 ? "existe" : "existen"}`;
    texto = nuevos.length
      ? `Este archivo trae ${_listaLegible(delArchivo)}. ${ya[0].toUpperCase()}${ya.slice(1)}. ¿Quieres reemplazar ${_listaLegible(repetidos)} y agregar ${_listaLegible(nuevos)}, o prefieres cancelar?`
      : `Este archivo trae ${_listaLegible(delArchivo)}. ${ya[0].toUpperCase()}${ya.slice(1)}. ¿Quieres ${repetidos.length === 1 ? "reemplazar ese mes" : "reemplazar esos meses"}, o prefieres cancelar?`;
  }
  return { nuevos, repetidos, resultado, texto, pideDecision: repetidos.length > 0 };
}

/* fusionarHechos({ previos, delArchivo, reemplazar }) → { ok, hechos, reemplazados, agregados } | { ok:false, motivo, sinDecision }
 *
 * La fusión, período por período y SOLO de hechos:
 *   · un período que no existía se AGREGA con sus filas;
 *   · un período que ya existe SOLO se toca si viene nombrado en `reemplazar` — entonces sus filas anteriores
 *     salen TODAS y entran las del archivo. Nombrado y no traído por el archivo es un error del llamador;
 *   · un período repetido que NO está en `reemplazar` corta la fusión entera: acá no se decide por el usuario,
 *     y fusionar «lo demás» dejaría activada una historia distinta de la que la pantalla describió.
 *
 * El INVENTARIO no es un período: es una foto. La del archivo nuevo manda si viene; si no viene, se conserva la
 * anterior con su fecha (`inventarioDe`), para que la pantalla pueda decir de cuándo es el stock del que habla.
 * Los PARÁMETROS son los del archivo nuevo — es la declaración más reciente del negocio. */
export function fusionarHechos({ previos = null, delArchivo = {}, reemplazar = [] } = {}) {
  const pedidos = new Set((reemplazar || []).map(String));
  const persPrevios = previos ? periodosDeHechos(previos) : [];
  const persArchivo = periodosDeHechos(delArchivo);
  const setPrevios = new Set(persPrevios);
  const setArchivo = new Set(persArchivo);

  const repetidos = persArchivo.filter((p) => setPrevios.has(p));
  const sinDecision = repetidos.filter((p) => !pedidos.has(p));
  if (sinDecision.length) {
    return { ok: false, sinDecision,
      motivo: `${_listaLegible(sinDecision)} ya ${sinDecision.length === 1 ? "existe" : "existen"} y no se dijo qué hacer: reemplazar es una decisión explícita, no un default. No se activó nada.` };
  }
  const fantasmas = [...pedidos].filter((p) => !setArchivo.has(p));
  if (fantasmas.length) {
    return { ok: false, motivo: `se pidió reemplazar ${_listaLegible(fantasmas)} pero el archivo no ${fantasmas.length === 1 ? "trae ese período" : "trae esos períodos"}.` };
  }

  // lo previo entra salvo que su período se reemplace; lo del archivo entra entero
  const vive = (per) => !(pedidos.has(per) && setArchivo.has(per));
  const Ventas = [
    ...((previos && previos.Ventas) || []).filter((v) => vive(_periodoDeVenta(v))),
    ...(delArchivo.Ventas || []),
  ];
  const Abonos = [
    ...((previos && previos.Abonos) || []).filter((a) => vive(_periodoDeAbono(a))),
    ...(delArchivo.Abonos || []),
  ];
  const traeInventario = (delArchivo.Inventario || []).length > 0;
  const Inventario = traeInventario ? delArchivo.Inventario : ((previos && previos.Inventario) || []);
  const inventarioDe = traeInventario
    ? (delArchivo.fechaCarga || null)
    : ((previos && previos.inventarioDe) || (previos && previos.fechaCarga) || null);

  return {
    ok: true,
    hechos: {
      parametros: delArchivo.parametros || (previos && previos.parametros) || {},
      fechaCarga: delArchivo.fechaCarga || null,
      inventarioDe,
      Ventas, Inventario, Abonos,
    },
    agregados: persArchivo.filter((p) => !setPrevios.has(p)),
    reemplazados: repetidos,
  };
}

/** El período que la historia informa: el ÚLTIMO con ventas. Re-subir un mes viejo corregido no puede volver
 *  «el período» de la Mesa a ese mes — el negocio sigue viviendo en el más reciente. */
export function periodoInformadoDe(hechos = {}) {
  const conVenta = new Set((hechos.Ventas || []).map(_periodoDeVenta).filter((p) => ES_PERIODO.test(p)));
  const todos = [...conVenta].sort();
  return todos[todos.length - 1] || null;
}
