/* === src/adi/notario/hechos.js · EL LIBRO DE HECHOS DEL TURNO (verdad finita · etapas E0-E1 · owner 2026-09-17) ═══════════════════
 * «La verdad se identifica, no se describe.» Cada hecho que el modelo puede afirmar existe antes como un objeto con IDENTIDAD:
 *   · una fig de la boleta, por su id (`ref`);
 *   · una expresión tipada sobre la evidencia que la casa evalúa: cifra por clave, orden, relación, grupo, conteo, variación, estado,
 *     razón (numerador ÷ denominador, sin lista blanca), derivada (suma, diferencia, pp, variación relativa, producto), propuesta (un
 *     número del asesor, sellado) y lectura (interpretación con apoyo).
 * El universo de un orden, un conteo o un grupo es un OBJETO ({eje, base, estados, no_estados, bodega, filtros, top, excluir, union}) que
 * verificar.js evalúa con sus primitivas; la métrica es una CLAVE del léxico (lexico.js); el estado es un canon del catálogo (estados.js).
 * Nada se lee de la prosa: el libro no recibe texto, recibe hechos. Lo que la casa verifica con verificar.js sigue verificándose ahí;
 * este módulo traduce el hecho identificado a la afirmación que el verificador ya sabe juzgar, evalúa lo nuevo (razón, derivada, conteo
 * tipado), y devuelve por hecho: veredicto, verdad, roles (entidades), claves de métrica, números, estado, dominio, universo evaluado y
 * el RENDER de cada placeholder ({id}, {id.n}, {id.m}, {id.k}, {id.umbral}, {id.universo}, {id.rel}, {id.estado}, {id.base}).
 * Y la verdad de lo falso vuelve como hechos nuevos con id (h13 falso → h13a, h13b…), para que el modelo pueda usarla sin adivinar.
 * Puro: sin I/O, sin red. */
import { parseFigures } from "../boleta.js";
import { tolCalculo } from "../oracle/calculoCatalogo.js";
import { verificarAfirmaciones, conjuntoDeUniverso, valorDeRanking, valorDeReferencia, rankingDeTop, puestoDeOrden } from "./verificar.js";
import { indiceDeEvidencia, mismoValor, unidadCompatible } from "./evidencia.js";
import { normalizar, menosAscii, leerValor, direccionPorDefecto } from "./afirmacion.js";
import { parsearLineasDeBloque, MARCA_FIN } from "./declaracion.js";
import { metricaDeClave, claveDeMetrica, metricaPorClave, dominioDeClave, polaridadDeClave, unidadDeClave, periodoDe, PLURAL_DE_EJE, ARTICULO_DE_EJE, diasDe, METRICAS_DE_ESTADO, opDe, esReferencia, ceroPorCobertura, diasEnPalabras } from "./lexico.js";
import { estadoCanon, estadoDeLaCasa, complementoDe, ESTADOS_CANON, estadosEn, estadoDeclarado, ejeCompatible, COMPLEMENTO_V3, estadosValidosPara, formaDeEstado, verificarEstadoDeLaCasa, ESTADOS_PROPIOS, METRICA_DE_ESTADO } from "./estados.js";
import { referenciaDeBase, referenciaDeEstado, conjuntoConocido, estadoDeConjunto, nombreDeMetricaDeReferencia } from "./conjuntosDeLaCasa.js";   // §7.3, tarea 4 (supervisor 2026-09-27, diagnóstico v8/v9): la tabla base→referencia y estado→referencia viven en UN registro, compartida con notario/verificar.js — nunca dos tablas que puedan divergir
import { formatoPct, formatoDeUmbral } from "../../config/businessPolicy.js";   // §7.3·40(b): la forma de la casa del porcentaje, una sola definición (la comparte el valor de un umbral en pct)
import { stripLanguageLeaks } from "../llm/voiceGuard.js";   // §7.3·28 (SUPERVISOR, ley de registro del owner): ÚNICA fuente de "qué palabra está vetada del registro" — la misma que usa `_registro_gate`/`entrega/verificar.js` (regla `registro-informal`)

export const MARCA_HECHOS = "<<HECHOS>>";
/* "discrepancia" (owner 2026-09-25, ley de los cuatro orígenes: «un declarado nunca pisa un medido») NO es un
 * tipo que el modelo declare en el bloque `<<HECHOS>>`: lo EMITE el libro mismo cuando dos hechos de origen
 * distinto comparten la misma llave (concepto, entidad, eje, período, unidad) — ver el bloque al final de
 * `libroDeHechos`. Se lista acá para que `esFactual`/los gates lo reconozcan como hecho factual. */
export const TIPOS_DE_HECHO = ["ref", "cifra", "orden", "relacion", "grupo", "conteo", "variacion", "estado", "razon", "derivada", "propuesta", "lectura", "discrepancia"];
const _FACTUALES = new Set(["ref", "cifra", "orden", "relacion", "grupo", "conteo", "variacion", "estado", "razon", "derivada", "discrepancia"]);
const _es = (x) => x && typeof x === "object" && !Array.isArray(x);
const _lista = (x) => (Array.isArray(x) ? x : x == null || x === "" ? [] : [x]).map((s) => (typeof s === "string" ? s.trim() : s)).filter((s) => s !== "" && s != null);
const _u = unidadCompatible;

/* ── PROCEDENCIA DE CADA HECHO (owner 2026-09-23, Etapa 2 del plan `_ADI_LLMBUSINESS_PLAN.md` — «enriquecer el
 * libro de hechos», TAREA 1) ═══════════════════════════════════════════════════════════════════════════════════
 * De dónde viene una cifra, no cuán cierta es — un eje NUEVO y DISTINTO del que ya existe (`figureType.js`:
 * `sello` probado/indicado/abierto y `verificabilidad`, que miden CERTEZA/reconciliación). Las cinco categorías
 * son las del owner, textuales:
 *   medido               · del archivo (lectura directa, o un campo que la FUENTE declara aunque ADI no lo
 *                          reconstruya — «días de inventario» es de la fuente igual que «venta»).
 *   derivado              · calculado por el motor a partir de medidos (una suma, un total, un conteo del universo).
 *   estimacion_referencia · una BRECHA contra una referencia (benchmark/objetivo/política) — ley del owner: «una
 *                          brecha contra referencia es una ESTIMACIÓN, nunca dinero que ya se perdió».
 *   supuesto_usuario      · una cifra que el usuario aportó (un escenario/supuesto de simulación elegido por él).
 *   propuesta             · un número de una recomendación — NO es un dato de la empresa (hecho tipo `propuesta`).
 * REGLA DEL OWNER, textual: «una derivada hereda la PEOR procedencia de sus insumos» — `_peorProcedencia` abajo.
 *
 * ⚠️ DECISIÓN DE SIGNIFICADO QUE ESTE MÓDULO PROPONE Y NO CIERRA (frenada para el owner, ver el informe): el
 * ORDEN total «de la más firme a la más débil» (`PROCEDENCIAS`, el mismo array hace de escala) es una lectura
 * razonable de las cinco categorías, no una que el owner haya fijado él mismo. Si se confirma otro orden, cambia
 * SOLO acá — es la única tabla que decide «peor».
 *
 * CÓMO SE DERIVA DE LO QUE YA EXISTE (reuso, no una segunda verdad): cada fig de la boleta YA declara
 * `fig.tipo.verificabilidad` (figureType.js) sin que ningún composer tenga que declararlo aparte —
 * `_procedenciaDeFig` traduce esa clase (más `fig.cobertura`/`fig.agregado`, que ya distinguen un total/subtotal
 * de una lectura simple, y `fig.source`, que ya declara un escenario) a la procedencia. Es una traducción, no un
 * cálculo nuevo: no se vuelve a leer ninguna etiqueta con una regex propia, salvo la MISMA que ya usa
 * `figureType.js` (`VERIFICABILIDAD_POR_METRICA`, la regla «PALANCA») para reconocer una brecha contra una vara
 * — se declara acá en vez de reimportar el contrato (`notario/` no importa `config/contract/` hoy; abrir ese
 * import es una decisión de arquitectura aparte, no de esta tarea). Un gate nuevo (`_ronda_procedencia_gate` /
 * `_entrega_gate`) compara el texto contra el de `figureType.js` para que las dos copias no diverjan en silencio. */
export const PROCEDENCIAS = ["medido", "derivado", "estimacion_referencia", "supuesto_usuario", "propuesta"];
export const NOMBRE_DE_PROCEDENCIA = {
  medido: "medido", derivado: "derivado", estimacion_referencia: "estimación contra referencia",
  supuesto_usuario: "supuesto del usuario", propuesta: "propuesta",
};
/* la MISMA regex que figureType.js (VERIFICABILIDAD_POR_METRICA, la regla «PALANCA» — comentario textual: «se
 * calcula contra una vara (benchmark/target/política)»). Declarada acá (no importada) a propósito: `notario/`
 * no importa `config/contract/` en ningún archivo hoy y abrir ese ciclo es una decisión que esta tarea no toma;
 * el candado nuevo (`_entrega_gate.mjs`) verifica que el texto siga byte-igual al de la fuente. */
const _RE_PALANCA = /\b(no capturad\w*|en juego|brecha|exceso|recuperable|potencial|oportunidad|perdid\w*|detenid\w*)\b/i;
/** peorProcedencia(...ps) → la de menor firmeza entre las declaradas (ignora null/undefined); null si ninguna. */
export function peorProcedencia(...ps) {
  const vistas = ps.filter((p) => PROCEDENCIAS.includes(p));
  if (!vistas.length) return null;
  return vistas.reduce((peor, p) => (PROCEDENCIAS.indexOf(p) > PROCEDENCIAS.indexOf(peor) ? p : peor));
}
/* la procedencia de UNA fig de la boleta (una entrada del índice de evidencia: trae `.fig` —el objeto crudo que
 * `fig()` emitió, con `.tipo`—, `.cobertura` y `.agregado` —el propio índice ya distingue un total/subtotal de
 * una lectura simple, ver evidencia.js—). */
function _procedenciaDeFig(f) {
  /* ═══ ARREGLO DE RAÍZ (owner 2026-09-23, CAU-01) — «la referencia de ADI no puede salir etiquetada "medida"» ═
   * La fig «Umbral de materialidad · en dinero» (specRetrieval.js:figsUmbralFocos, el mismo piso que decide
   * "Carga comercial alta" en el detector) verificaba con procedencia "medido": su rótulo no matchea ninguna
   * regla de `VERIFICABILIDAD_POR_METRICA` (esas reconocen una BRECHA contra una vara — "no capturada", "en
   * juego", "exceso"… — no la vara misma), así que caía al default "literal" → "medido". El mismo agujero
   * afecta a CUALQUIER fig cuya métrica sea una referencia de la casa (benchmark, nivel de carga, piso de
   * rotación, techo de cobertura — `lexico.js:CLAVES_DE_METRICA`, `polaridad: "referencia"`).
   * MARCA ESTRUCTURAL, no inferencia por texto de rótulo: `lexico.js` ya declara qué claves son una referencia
   * (`referencia: true`, la MISMA lista que ya usa `polaridadDeClave`/`_dominioDeFig` para reconocer estas
   * cifras) — se reutiliza esa marca (`esReferencia`), no se agrega ninguna nueva. Toda fig cuya métrica
   * resuelve a una de esas claves sale "estimacion_referencia" (una referencia declarada por ADI o por la
   * empresa nunca es un hecho medido del archivo), ANTES de mirar `verificabilidad` — la vara no tiene tipo de
   * verificabilidad propio, es un criterio, no una lectura. */
  const claveRef = claveDeMetrica(f && f.concepto);
  if (claveRef && esReferencia(claveRef)) return "estimacion_referencia";
  const t = f && f.fig && f.fig.tipo;
  if (!t || !t.verificabilidad) return "derivado";   // sin tipo declarado (ej. la proyección de un ranking, sin
  // fig real detrás): es una lectura que YA calculó el motor sobre el dato, nunca un archivo — nunca "medido" a ciegas.
  /* SIN CRUDO, NUNCA «MEDIDO» (owner 2026-09-23 — arreglo del verificador). `fig.tipo.verificabilidad` se estampa
   * en `fig()` por el RÓTULO, sin saber si esa fig llegó con un `raw` genuino — por eso «literal»/«declarada_no_
   * verificable» pueden convivir con `f.crudo === false` (evidencia.js reparseó el texto ya redondeado porque no
   * había crudo). Cuando eso pasa, la etiqueta de la fuente miente: no es una lectura directa del archivo, es una
   * reconstrucción desde lo que la pantalla muestra — la procedencia más floja que ya existe en la escala. */
  if (f && f.crudo === false) return "derivado";
  switch (t.verificabilidad) {
    case "literal":
      // un total/subtotal declarado (cobertura o `agregado` del índice) es una SUMA del motor aunque ninguna
      // regla de `VERIFICABILIDAD_POR_METRICA` lo haya marcado — el campo que sí lo sabe es la cobertura, no el
      // texto del rótulo.
      return (f.cobertura || f.agregado) ? "derivado" : "medido";
    case "declarada_no_verificable": return "medido";   // lo declara el ARCHIVO (doh, rotación): ADI no lo reconstruye, pero no lo calculó — sigue siendo del archivo, no del motor
    case "derivada_reconciliada": return "derivado";
    case "derivada_no_reconciliada":
      // ⚠️ MEDIDO (sonda `_sonda_procedencia.mjs`, descartado): `fig.source` NO distingue hoy «un supuesto que
      // aportó el usuario» de «un cálculo determinístico del motor que no reconcilia con lo almacenado» — las
      // dos formas viajan con `source:"computed"` (ej. «Brecha al benchmark» = benchmark − margen,
      // herramientasAgente.js:398 — un cálculo del motor, no un supuesto de nadie) y la razón derivada dice
      // literalmente «supuesto DEL MOTOR», no del usuario. Clasificar por `source` habría marcado esa resta como
      // «supuesto del usuario», que es falso. Por eso «supuesto_usuario» NO se infiere acá: hoy no hay productor
      // que declare una cifra como aporte del usuario (assumptionRegistry.js lo dice de frente: la simulación
      // paramétrica «todavía NO tiene productor en el motor»). Queda declarado en `PROCEDENCIAS` para cuando lo
      // haya, y solo se alcanza por asignación explícita (ver `_operandoDeHecho`/un hecho que la declare a mano).
      if (_RE_PALANCA.test(`${t.verificabilidadRazon || ""} ${f.label || f.concepto || ""}`)) return "estimacion_referencia";   // una brecha contra una vara declarada
      return "derivado";
    case "no_calculable": return null;   // no debería llegar a imprimirse como cifra — se declara ausente, no con procedencia
    default: return "derivado";
  }
}
/* la procedencia de un OPERANDO de razón/derivada (`_operando()`): si el operando es una CONSTANTE declarada
 * (`{constante:{...}}` — owner 2026-09-23, piso de materialidad de cobranza: «crudo verificado × constante
 * declarada con su procedencia») trae su propia procedencia YA fijada, nunca se deriva de una fig que no
 * existe; si viene de OTRO hecho del libro (una derivada anidada, `_operandoDeHecho`), hereda la procedencia YA
 * calculada de ESE hecho — no se re-deriva de su fig; si viene de una fig de la boleta, se traduce con
 * `_procedenciaDeFig`. */
function _procedenciaDeOperando(op, libro) {
  if (!op) return null;
  if (op.procedenciaDeclarada !== undefined && op.procedenciaDeclarada !== null) return op.procedenciaDeclarada;
  const Hop = libro && libro.porId ? libro.porId.get(String(op.label)) : null;
  if (Hop && Hop.procedencia !== undefined) return Hop.procedencia;
  return _procedenciaDeFig(op);
}

/* ── ORÍGENES · COMPOSICIÓN · FUERZA (owner 2026-09-25, Etapa 1 corte 2 — leyes del encargo, textuales) ═══════════
 * Cuatro orígenes SIEMPRE distinguibles, del INSUMO (de dónde viene, no cuán cierto es — eje aparte de
 * `PROCEDENCIAS` arriba, que YA mezclaba origen y naturaleza; se conserva sin tocar, como LEGADO):
 *   medido     · por ADI sobre datos de la empresa (el archivo). Sin origen declarado = medido.
 *   documento  · extraído de un documento (contrato, factura…) — tres sellos que no se mezclan, REVISIÓN 3 §4:
 *                extraído (la lectura) · confirmado (el usuario avala esa lectura, fuerza condicionada, igual
 *                que un declarado) · verificado (ADI tiene el ORIGINAL y comprueba por código — SOLO este sella
 *                «verificada»). Se distingue acá con el sub-flag `verificado` de la fuente declarada.
 *   declarado  · por el usuario (una cifra que aporta, una referencia que fija).
 *   supuesto   · para un escenario (el motor de simulación).
 * La CONFIRMACIÓN (`H.confirmacion = {por, cuando, medio, sobre}`) es un sello APARTE — quién, cuándo, medio,
 * sobre qué — y NUNCA cambia el origen (un declarado confirmado sigue siendo declarado, solo que su fuerza deja
 * de depender de que el usuario no se haya equivocado sin más).
 *
 * NATURALEZA (qué operación lo produjo) es el TERCER eje, independiente: directo · derivado ·
 * estimacion_referencia · propuesta. COMPOSICIÓN es la lista COMPLETA de insumos de un hecho —cada uno con su
 * origen, su id y su rol— que NUNCA se resume («sin resumir nunca», ley del owner): a diferencia de
 * `peorProcedencia` (que colapsa una lista a un solo valor, perdiendo de vista CUÁLES insumos son cuáles), acá
 * cada insumo queda visible. FUERZA es la tercera pieza, calculada APARTE de la composición: ADI garantiza
 * SIEMPRE su aritmética, la fuerza la pone el insumo más débil — `verificada` (solo medidos, o documento
 * VERIFICADO por ADI, y con CRUDO en todos: sin crudo, nunca «verificada», la lección 36,3→36,1,
 * `adi-verificado-no-es-exacto`) · `condicionada` (algún insumo declarado, extraído o confirmado — nombra de qué
 * insumo depende, vía `composicion`) · `hipotetica` (algún supuesto — gana sobre cualquier otra combinación).
 *
 * `procedencia` (arriba) se CONSERVA como campo LEGADO: se calcula con una TABLA FIJA desde estos dos ejes
 * nuevos (origen.titular, naturaleza), para que las 4 rutas fijas de `entrega/componer.js` y todo gate que lea
 * `procedenciaDe()`/`PROCEDENCIAS`/`NOMBRE_DE_PROCEDENCIA` sigan produciendo EXACTAMENTE lo mismo. Hoy NINGÚN
 * productor declara un origen ≠ medido sobre una fig real («aportar contexto» y el motor de escenarios no
 * existen todavía — este módulo solo tiene que saber RECIBIRLOS), así que `origen.titular` es SIEMPRE "medido"
 * para todo lo existente y la tabla reconstruye el valor legado byte a byte. La ÚNICA procedencia legada con
 * origen ≠ medido que existe hoy es la constante "supuesto_usuario" de `pisoMaterialidadCobranza.js`
 * (CAU-01/PRI-04, firmadas — no se tocan): se decompone con `_naturalezaDeLegado`/`_origenDeLegado` para que su
 * combinación con otros insumos, DENTRO de una misma razón/derivada/lectura, siga reconstruyendo el mismo
 * resultado (verificado con la suite completa: `_hechos_gate`, `_entrega_gate`, `_verificador_crudo_gate`,
 * `_anclas_gate`, `_cau01_carga_resto_gate`, `_piso_materialidad_gate`, `_notario_v3_flujo_gate` — los 7 gates
 * que importan este archivo). ⚠️ DECISIÓN DE SIGNIFICADO ABIERTA (reportada, no resuelta acá): la tabla fija de
 * dos ejes no es matemáticamente equivalente al «peor de 5 categorías» plano en TODAS las combinaciones
 * teóricas (un "derivado" combinado con un "supuesto_usuario" dentro del MISMO peor-cálculo reconstruye
 * "derivado", no "supuesto_usuario") — esa combinación no es alcanzable hoy en ningún camino real del código
 * (se auditó: el único productor de "supuesto_usuario" es `pisoMaterialidadCobranzaDe`, y su constante solo se
 * combina, dentro de un mismo cálculo, con insumos "medido"); si un futuro productor la alcanza, el candado
 * `_origenes_gate.mjs` la cubre con una carnada sintética. */
export const ORIGENES = ["medido", "documento", "declarado", "supuesto"];
export const NOMBRE_DE_ORIGEN = { medido: "medido", documento: "extraído de documento", declarado: "declarado por el usuario", supuesto: "supuesto del escenario" };
/* orden de firmeza para el titular — DECISIÓN PROPUESTA, no ley (§A del diseño v2): medido > documento >
 * declarado > supuesto. Solo esta tabla decide «peor»; cambia SOLO acá si el owner confirma otro orden. */
export const ORDEN_FIRMEZA_ORIGEN = ["medido", "documento", "declarado", "supuesto"];
/** peorOrigen(...os) → el titular de menor firmeza entre los declarados (ignora null/undefined); null si ninguno. */
export function peorOrigen(...os) {
  const vistos = os.filter((o) => ORIGENES.includes(o));
  if (!vistos.length) return null;
  return vistos.reduce((peor, o) => (ORDEN_FIRMEZA_ORIGEN.indexOf(o) > ORDEN_FIRMEZA_ORIGEN.indexOf(peor) ? o : peor));
}
export const NATURALEZAS = ["directo", "derivado", "estimacion_referencia", "propuesta"];
function _peorNaturaleza(...ns) {
  const vistas = ns.filter((n) => NATURALEZAS.includes(n));
  if (!vistas.length) return null;
  return vistas.reduce((peor, n) => (NATURALEZAS.indexOf(n) > NATURALEZAS.indexOf(peor) ? n : peor));
}
export const FUERZAS = ["verificada", "condicionada", "hipotetica"];

/* la tabla fija (una función, un archivo) — §A del diseño v2, «Tabla legado»: directo+medido→medido ·
 * derivado→derivado · estimacion_referencia→estimacion_referencia · propuesta→propuesta · cualquier origen≠medido
 * con naturaleza directo→supuesto_usuario. */
export function procedenciaLegado(origenTitular, naturaleza) {
  if (naturaleza === "derivado") return "derivado";
  if (naturaleza === "estimacion_referencia") return "estimacion_referencia";
  if (naturaleza === "propuesta") return "propuesta";
  if (naturaleza === "directo") return origenTitular === "medido" ? "medido" : "supuesto_usuario";
  return null;
}
/* decompone una PROCEDENCIA LEGADA ya declarada a mano (constantes de `medir.js`/`_operandoConstante`, piezas
 * FIRMADAS que no se tocan) en los dos ejes nuevos — nunca al revés: esto es solo para que esas constantes
 * participen en `peorNaturaleza`/`peorOrigen` sin reabrir esas piezas. */
function _naturalezaDeLegado(p) { return p === "medido" || p === "supuesto_usuario" ? "directo" : (p === "derivado" || p === "estimacion_referencia" || p === "propuesta" ? p : null); }
function _origenDeLegado(p) { return p === "supuesto_usuario" ? "supuesto" : "medido"; }

/* el origen DECLARADO sobre una fig — ver el comentario grande de arriba: se cuelga sobre el objeto que `fig()`
 * devuelve (nunca por sus opts, que boleta.js no puede tocar), y `evidencia.js` lo surface como `.origen`. */
function _origenDeclaradoDeFig(f) {
  const decl = (f && f.origen) || (f && f.fig && f.fig.origen);
  if (!decl) return null;
  const bag = typeof decl === "string" ? { titular: decl } : decl;
  return bag && ORIGENES.includes(bag.titular) ? bag : null;
}
function _origenDeFigStruct(f) { const d = _origenDeclaradoDeFig(f); return d ? d.titular : "medido"; }
function _naturalezaDeFig(f) { const p = _procedenciaDeFig(f); return p == null ? null : _naturalezaDeLegado(p); }
/* mismo patrón de tres ramas que `_procedenciaDeOperando`: constante con sus ejes ya declarados (nuevos o
 * legados), hecho anterior del libro (hereda lo YA calculado) o fig de la boleta. */
function _naturalezaDeOperando(op, libro) {
  if (!op) return null;
  if (op.origenDeclarado && op.naturalezaDeclarada) return op.naturalezaDeclarada;
  if (op.procedenciaDeclarada !== undefined && op.procedenciaDeclarada !== null) return _naturalezaDeLegado(op.procedenciaDeclarada);
  const Hop = libro && libro.porId ? libro.porId.get(String(op.label)) : null;
  if (Hop && Hop.naturaleza !== undefined) return Hop.naturaleza;
  return _naturalezaDeFig(op);
}
function _origenDeOperando(op, libro) {
  if (!op) return null;
  if (op.origenDeclarado) return op.origenDeclarado;
  if (op.procedenciaDeclarada !== undefined && op.procedenciaDeclarada !== null) return _origenDeLegado(op.procedenciaDeclarada);
  const Hop = libro && libro.porId ? libro.porId.get(String(op.label)) : null;
  if (Hop && Hop.origen && Hop.origen.titular) return Hop.origen.titular;
  return _origenDeFigStruct(op);
}
const _idDeOperando = (op) => (op && op.fig && op.fig.id) || (op && op.label) || null;
const _crudoDeOperando = (op) => !(op && op.crudo === false);

/** fuerzaDeComposicion(composicion) → "verificada"|"condicionada"|"hipotetica"|null. Ley del owner, textual: «ADI
 * garantiza siempre su aritmética; la fuerza la pone el insumo más débil». null = sin insumos (propuesta: el
 * número es del asesor, no una medición) O algún insumo medido SIN CRUDO (owner 2026-09-25, corte 2b — «resuelto
 * DE RAÍZ»): «condicionada» está definida como «depende de un insumo declarado/extraído/confirmado — del
 * usuario»; una cifra medida y solo REDONDEADA por ADI no depende del usuario, así que no puede llamarse
 * condicionada — mezclaría dos clases de verdad distintas. Es la MISMA regla que ya rige razones y derivadas
 * (`_razon`/`_derivada`: sin crudo, el hecho entero sale «no-verificable»): acá, cuando el hecho SÍ verifica
 * (una cita directa que repite lo mostrado, legítima — `mismoValor`), la fuerza queda null, ninguna de las tres. */
function _fuerzaDeComposicion(composicion) {
  const cs = Array.isArray(composicion) ? composicion : [];
  if (!cs.length) return null;
  if (cs.some((c) => c.origen === "supuesto")) return "hipotetica";
  if (cs.some((c) => c.crudo === false)) return null;
  const fuerte = (c) => c.origen === "medido" || (c.origen === "documento" && c.verificado === true);
  return cs.every(fuerte) ? "verificada" : "condicionada";
}
/* aplica una composición (lista de insumos) a un hecho: fija `composicion`, `naturaleza`, `origen` (bag
 * {titular,lista,fuentes}), `fuerza` y el `procedencia` LEGADO vía la tabla fija. Un insumo trae, además de
 * {origen,id,rol}: `naturaleza` (para combinar) y opcionalmente `crudo`/`verificado`. */
function _aplicarComposicion(H, composicion) {
  const cs = Array.isArray(composicion) ? composicion : [];
  H.composicion = cs.map((c) => ({ origen: c.origen || "medido", id: c.id != null ? c.id : null, rol: c.rol || "insumo" }));
  H.naturaleza = _peorNaturaleza(...cs.map((c) => c.naturaleza));
  const titular = peorOrigen(...cs.map((c) => c.origen));
  H.origen = { titular, lista: [...new Set(cs.map((c) => c.origen).filter((o) => ORIGENES.includes(o)))], fuentes: cs.map((c) => ({ origen: c.origen || "medido", ref: c.id != null ? c.id : null })) };
  H.fuerza = _fuerzaDeComposicion(cs);
  H.procedencia = procedenciaLegado(titular, H.naturaleza);
  return H;
}

/* ── ids en la boleta: cada fig recibe una identidad estable dentro del turno (por posición; idempotente) ── */
export function asignarIds(figs, prefijo = "c") {
  if (!Array.isArray(figs)) return figs;
  let n = 0;
  for (const f of figs) { n++; if (f && typeof f === "object" && !f.id) f.id = `${prefijo}${n}`; }
  return figs;
}

/* ── el bloque <<HECHOS>> … <<FIN>> de la salida del modelo (va ANTES de la prosa; se quita antes de servir) ── */
export function extraerHechos(salida) {
  const s = String(salida == null ? "" : salida);
  const i = s.indexOf(MARCA_HECHOS);
  if (i < 0) return { prosa: s.trim(), hechos: null, errores: [], bloque: false };
  const j = s.indexOf(MARCA_FIN, i + MARCA_HECHOS.length);
  const bloque = j >= 0 ? s.slice(i + MARCA_HECHOS.length, j) : s.slice(i + MARCA_HECHOS.length);
  const prosa = (s.slice(0, i) + (j >= 0 ? s.slice(j + MARCA_FIN.length) : "")).trim();
  const p = parsearLineasDeBloque(bloque);
  return { prosa, hechos: p.afirmaciones, errores: j >= 0 ? p.errores : [...p.errores, "bloque sin marca de cierre"], bloque: true };
}

/* ── formato de la casa para lo calculado (lo directo se imprime como la boleta lo trae) ── */
const _fmtMoney = (raw) => { const a = Math.abs(raw), s = raw < 0 ? "-" : ""; if (a >= 1e6) return `${s}$${(a / 1e6).toFixed(1)}M`; if (a >= 1e3) return `${s}$${Math.round(a / 1e3)}K`; return `${s}$${Math.round(a)}`; };
/* §7.3·40(b): el formato de la casa CONSERVA EL SIGNIFICADO de la cifra («0.05 %» nunca es «0.1 %»). La ÚNICA definición vive en `config/businessPolicy.js:formatoPct`, porque el valor de un umbral
 * en pct (el piso de materialidad del Marco, del veredicto y del límite) se escribe con el MISMO formateador — nunca dos copias. */
const _fmtPct = formatoPct;
export function formatoDeLaCasa(raw, unidad) {
  if (!Number.isFinite(raw)) return "";
  switch (unidad) {
    case "money": return _fmtMoney(raw);
    case "pct": return _fmtPct(raw);
    case "pp": return `${(Math.abs(raw - Math.round(raw)) < 0.05 ? String(Math.round(raw)) : raw.toFixed(1))} pp`;
    case "days": return diasEnPalabras(Math.round(raw));
    case "ratio": return `${raw.toFixed(1)}x`;
    default: return String(Math.round(raw * 100) / 100);
  }
}
/* §7.3·40(d) — un valor DECLARADO (el de una referencia de la casa —benchmark, nivel de carga, piso de rotación, techo de cobertura, umbral de frenado— o el umbral que la consulta plantea en un filtro) se escribe EXACTO, nunca con
 * el redondeo de una cifra medida: es un número declarado, no una medición. La ÚNICA función es `businessPolicy.js:formatoDeUmbral` (la misma del Marco y del criterio aplicado); acá solo se completa para las unidades sin forma
 * exacta (dinero, puntos, conteos), que siguen con el formato de la casa. El ORIGEN decide (quien llama trae una referencia o un umbral, no una medición), jamás el número. */
export const formatoDeReferencia = (raw, unidad) => (Number.isFinite(raw) ? formatoDeUmbral(raw, unidad) : null) ?? formatoDeLaCasa(raw, unidad);
/* §7.3·40(b) — UNA sola forma por cifra: un % que la boleta imprime con un decimal de más («24.0%», el `_p1` del retrieval legado) se dice con el formato de la casa («24%», el de la tabla de Cifras) SOLO si
 * ese texto conserva el valor a la precisión de lo impreso; si no lo conserva se deja el impreso. Nunca cambia el valor ni la boleta: solo la forma en que la Entrega lo ESCRIBE. Un % con signo dicho («+6.6%») se deja. */
export function textoDeLaCasa(raw, unidad, texto) {
  const t = texto == null ? "" : String(texto);
  if (unidad !== "pct" || !Number.isFinite(raw) || !t || /^\s*[+\-−]/.test(t)) return t;
  const m = /(\d+)(?:[.,](\d+))?\s*%/.exec(t);
  if (!m) return t;
  const dec = m[2] ? m[2].length : 0;
  const casa = formatoDeLaCasa(raw, "pct");
  const hv = parseFloat(casa);
  return Number.isFinite(hv) && Math.abs(hv - raw) <= 0.5 * Math.pow(10, -dec) + 1e-9 ? casa : t;
}
/* las palabras de cada estado (singular con tildes · plural · contrario) son DATOS de la casa: `estados.js:FORMA_DE_ESTADO` */
export const nombreDeEstado = (canon) => formaDeEstado(canon).singular;   // el estado dicho de UNA entidad (o tras «fuera de»); el que califica a un grupo es `formaDeEstado(canon).plural`
/* un `universo.base` que es un estado de la casa o un conjunto con nombre visible propio se imprime con SU forma, no con el identificador sin tilde */
const _nombreDeBase = (b) => { const c = conjuntoConocido(b); if (c && c.visible) return c.visible; if (c && c.precede) return `${c.precede} ${String(b)}`; const e = estadoDeclarado(b); return e ? formaDeEstado(e).plural : String(b); };
const _canonDe = (e) => estadoCanon(String(e || "").replace(/_/g, " "));
const _ESTADOS_COBRANZA = new Set(["al dia", "en mora", "sin deuda", "sin pagos", "buen pagador", "mal pagador"]);
const _ESTADOS_COMERCIAL = new Set(["sin contribucion", "sin margen"]);
/* CORTE 3c (owner 2026-09-25, pieza 3 «veredicto de premisas») — EXPORTADA (antes privada): `entrega/componer.js`
 * necesita la MISMA tabla para decidir a qué parte del encargo pertenece una premisa de tipo `estado` (¿la parte
 * de cobranza o la de inventario?), sin reimplementar el mapa canon→dominio en un segundo archivo («una sola
 * verdad»). El cuerpo no cambió: solo se agrega `export`. */
export const dominioDeEstado = (canon) => (_ESTADOS_COBRANZA.has(canon) ? "cobranza" : _ESTADOS_COMERCIAL.has(canon) ? "comercial" : ESTADOS_CANON.has(canon) ? "inventario" : null);

/* ── el nombre de un universo tipado, escrito por la casa (la plantilla de {id.universo}) ── */
const _OPS = { ">": "superior a", ">=": "de al menos", "<": "inferior a", "<=": "de hasta", "==": "igual a" };
/* A4 (supervisor 2026-09-27, diagnóstico v8) — la tabla base→(concepto de referencia, métrica natural) que un
 * `grupo` de membresía pura sobre un `universo.base` de la familia de referencia necesita para imprimir SU
 * VALOR (`valorDeReferencia`) y, en un veredicto falso, la métrica PROPIA de la entidad (`_figDe`). Vive en
 * `notario/conjuntosDeLaCasa.js:referenciaDeBase` (tarea 4 del cierre, §7.3) — el MISMO registro que usa
 * `notario/verificar.js` para que la resolución de conjuntos y el libro de hechos nunca diverjan. Un `base` que
 * no está en ese registro simplemente no dispara nada — nunca se inventa una familia nueva acá. */
const _fmtUmbral = (f, I = null) => {
  const clave = String(f.metrica || "").toLowerCase();
  const nombre = metricaDeClave(clave).toLowerCase();
  if (f.ref != null) {
    const base = `${nombre} ${_OPS[f.op] || f.op} ${metricaDeClave(f.ref).toLowerCase()}`;
    // R-ROTULO-CONTEO-FILTRO (supervisor 2026-09-26, segunda vuelta): «las comparables viajan juntas» sin
    // excepción — toda mención de una referencia (benchmark, nivel de carga, techo) imprime SU VALOR en la MISMA
    // oración, tomado de la evidencia con `valorDeReferencia` (LA MISMA resolución que `_filtroTipado`,
    // notario/verificar.js, ya usa para juzgar este mismo filtro — nunca una segunda cifra inventada). Sin `I`
    // (un llamador que no lo tenga a mano, p. ej. un placeholder `{id.umbral}` fuera de este archivo) se sirve el
    // nombre solo, como antes — documentado, nunca silencioso.
    if (I) { const r = valorDeReferencia(f.ref, I); if (r && Number.isFinite(r.raw)) return `${base}, ${formatoDeReferencia(r.raw, r.unidad || unidadDeClave(f.ref) || "pct")}`; }
    return base;
  }
  const unidad = f.unidad ? String(f.unidad) : unidadDeClave(clave) || "";
  const val = (v) => (/^(?:days|money|pct|pp|count|ratio)$/.test(unidad) ? formatoDeReferencia(+v, unidad) : `${v} ${unidad}`);   /* §7.3·40(d): el valor que la CONSULTA planteó en un filtro es declarado: exacto (dinero y conteos siguen con el formato de la casa) */
  if (f.op === "entre") { const v = Array.isArray(f.valor) ? f.valor : [f.valor, f.hasta]; return `${nombre} entre ${val(v[0])} y ${val(v[1])}`; }
  return `${nombre} ${_OPS[f.op] || "superior a"} ${val(f.valor)}`;
};
/* la forma negada de un conjunto de la casa: la que el catálogo declara (`negado`) o, si es un estado de la casa con otro nombre («con saldo vencido» = en mora), la de `FORMA_DE_ESTADO`; null si no tiene */
const _negadoDeConjunto = (n) => { const c = conjuntoConocido(n); if (c && c.negado) return c.negado; const e = estadoDeclarado(String(n)); return e ? formaDeEstado(e).negado : null; };
export function nombrarUniverso(u, I = null) {
  if (!_es(u)) return typeof u === "string" ? u : Array.isArray(u) ? u.join(", ") : "";
  const eje = normalizar(u.eje || "cliente");
  const plural = PLURAL_DE_EJE[eje] || `${eje}s`;
  const art = ARTICULO_DE_EJE[eje] || "los";
  const total = I && typeof I.tamanoDelEje === "function" ? I.tamanoDelEje(eje) : null;
  const restringido = !!(u.base && !/^todos?|todas$/i.test(String(u.base))) || _lista(u.estados).length || _lista(u.no_estados).length || u.bodega || (Array.isArray(u.filtros) && u.filtros.length) || u.top || u.excluir || (Array.isArray(u.union) && u.union.length);
  const partes = [];
  // §7.3, tarea 4 del cierre (supervisor 2026-09-27, diagnóstico v8, raíz A4) — «las comparables viajan juntas»
  // sin excepción: un `base` de la familia con referencia numérica (benchmark, nivel declarado de carga) imprime
  // SU VALOR en la misma frase, igual que ya hace `_fmtUmbral` abajo para `filtros[].ref` — MISMA función
  // (`valorDeReferencia`), MISMA tabla (`referenciaDeBase`, `notario/conjuntosDeLaCasa.js`), nunca una segunda
  // cifra inventada. Sin `I` (un llamador que no lo tenga a mano) se sirve el nombre solo, como antes.
  if (u.base && !/^todos?|todas$/i.test(String(u.base))) {
    const _baseStr = String(u.base);
    const fam = I && referenciaDeBase(_baseStr);
    const rRef = fam ? valorDeReferencia(fam.concepto, I) : null;
    if (rRef && Number.isFinite(rRef.raw)) {
      const mRef = metricaPorClave(fam.concepto);
      partes.push(`${_nombreDeBase(_baseStr)}, ${mRef ? mRef.nombre.toLowerCase() : fam.concepto} ${formatoDeReferencia(rRef.raw, rRef.unidad || "pct")}`);   // el nombre VISIBLE del conjunto (owner 2026-09-29): «con carga comercial alta», no el identificador a secas
    } else partes.push(_nombreDeBase(_baseStr));
  }
  for (const e of _lista(u.estados)) partes.push(formaDeEstado(_canonDe(e)).plural);
  for (const e of _lista(u.no_estados)) partes.push(formaDeEstado(_canonDe(e)).negado);
  /* §7.3·39(d): un conjunto de la casa que el universo EXCLUYE se dice con su forma NEGADA («los clientes sin mora», «los clientes sin carga comercial alta»), sin repetir el sustantivo del eje; el que no la tiene cae a «fuera de …» */
  const _sinNegado = [];
  if (_es(u.excluir)) for (const n of _lista(u.excluir.conjuntos)) { const neg = _negadoDeConjunto(n); if (neg) partes.push(neg); else _sinNegado.push(n); }
  if (u.bodega) partes.push(`de ${u.bodega}`);
  for (const f of Array.isArray(u.filtros) ? u.filtros : []) partes.push(`con ${_fmtUmbral(f, I)}`);
  if (u.top) { const dir = normalizar(u.top.direccion || "mayor"); partes.push(`${u.top.k} de ${dir === "menor" ? "menor" : dir === "peor" ? "peor" : dir === "mejor" ? "mejor" : "mayor"} ${metricaDeClave(u.top.metrica).toLowerCase()}`); }
  const cabeza = restringido ? `${art} ${plural}` : `${art} ${total ? total + " " : ""}${plural}`;
  let texto = partes.length ? `${cabeza} ${partes.join(" ")}` : cabeza;
  if (u.top && partes.length === 1) texto = `${art} ${partes[0]}`;
  if (u.excluir && typeof u.excluir === "object") {
    const ex = u.excluir; const fuera = [];
    for (const e of _lista(ex.entidades)) fuera.push(e);
    /* un conjunto de la casa que se excluye se dice con su forma de la casa y su sustantivo («fuera de los clientes con saldo vencido»), nunca el identificador a secas («fuera de con saldo vencido») */
    for (const n of _sinNegado) fuera.push(`${art} ${plural} ${_nombreDeBase(n)}`);
    for (const e of _lista(ex.estados)) fuera.push(formaDeEstado(_canonDe(e)).grupo);
    if (ex.bodega) fuera.push(ex.bodega);
    for (const t of _lista(ex.top)) if (_es(t)) fuera.push(`${art} ${t.k} de ${normalizar(t.direccion || "mayor") === "menor" ? "menor" : "mayor"} ${metricaDeClave(t.metrica).toLowerCase()}`);
    if (fuera.length) texto += ` fuera de ${fuera.join(" y ")}`;
  }
  if (Array.isArray(u.union) && u.union.length) {
    /* una unión SIN restricción propia («los SKU» + sus ramas) no lleva la cabeza vacía delante: «los SKU inmovilizados críticos y los SKU en riesgo de quiebre», no «los SKU y los SKU…» */
    const soloUnion = !partes.length && !u.top && !(u.excluir && typeof u.excluir === "object");
    texto = soloUnion ? u.union.map((v) => nombrarUniverso(v, I)).join(" y ") : `${texto} y ${u.union.map((v) => nombrarUniverso(v, I)).join(" y ")}`;
  }
  return texto;
}

/* ── búsqueda de figs por id o por (sujeto, clave) ── */
function _figPorId(I, id) {
  const k = String(id || "").trim();
  if (!k) return null;
  const kl = k.toLowerCase();
  const porId = I.figs.find((f) => f.fig && String(f.fig.id || "").toLowerCase() === kl) || null;
  if (porId) return porId;
  if (/^\d+$/.test(k)) { const cands = I.figs.filter((f) => f.fig && /^[a-z]+\d+$/i.test(String(f.fig.id || "")) && String(f.fig.id).replace(/^[a-z]+/i, "") === k); if (cands.length === 1) return cands[0]; }
  return I.figs.find((f) => normalizar(f.label) === normalizar(k)) || null;
}
function _figDe(I, sujeto, clave, unidad = null) {
  const nombre = metricaDeClave(clave);
  let fs = [];
  try { fs = I.buscarFigs(sujeto, nombre, { agregados: sujeto === "negocio" }); } catch { fs = []; }
  if (unidad) { const mu = fs.filter((f) => _u(f.unidad) === _u(unidad)); if (mu.length) fs = mu; }
  /* el todo del negocio: «· total» primero; nunca un subtotal si hay total */
  if (sujeto === "negocio") { fs = fs.filter((f) => !/resto de|subtotal|\(\d+ de \d+\)/.test(f.conceptoNorm + " " + normalizar(f.label || ""))); }   // el negocio nunca es un «Resto de…» ni un subtotal parcial (ronda 5, VE R01)
  if (sujeto === "negocio" && fs.length > 1) { const t = fs.find((f) => /(?:^|· )total$/.test(f.conceptoNorm)); if (t) return t; const sinParte = fs.filter((f) => !/resto de|subtotal/.test(f.conceptoNorm)); if (sinParte.length) return sinParte.find((f) => !f.agregado) || sinParte[0]; }
  if (fs.length) return fs.find((f) => !f.agregado) || fs[0];
  /* la proyección (ranking con cifra impresa o unidad sin escala ambigua) cuando la boleta no trae la fig */
  const rk = valorDeRanking({ sujeto, metrica: nombre }, I);
  if (rk) return { label: rk.label, texto: rk.texto, raw: rk.raw, unidad: rk.unidad, entidad: sujeto, concepto: nombre, conceptoNorm: normalizar(nombre), deRanking: true, fig: { id: null, value: rk.texto } };
  return null;
}
/* un operando por id de HECHO del libro (h1): la fig de su evidencia, o el hecho calculado como operando */
const _operandoDeHecho = (I, libro, id) => {
  const Hh = libro && libro.porId ? libro.porId.get(String(id)) : null;
  if (!Hh || !Hh.ok) return null;
  if (Hh.tipo === "derivada" && Hh.resultado && Number.isFinite(Hh.resultado.raw)) { const clave = [...Hh.claves][0] || null; return { label: Hh.id, texto: Hh.resultado.texto || "", raw: Hh.resultado.raw, unidad: Hh.resultado.unidad, entidad: Hh.roles.sujetos[0] || "negocio", concepto: clave ? metricaDeClave(clave) : Hh.id, conceptoNorm: normalizar(clave ? metricaDeClave(clave) : Hh.id), fig: { id: Hh.id, value: Hh.resultado.texto } }; }
  if (Array.isArray(Hh.evidencia) && Hh.evidencia.length === 1) { const f = _figPorId(I, Hh.evidencia[0]); if (f) return f; }
  const n = Hh.numeros[0]; if (!n || !Number.isFinite(n.raw)) return null;
  const clave = [...Hh.claves][0] || null;
  return { label: Hh.id, texto: Hh.render.valor || n.texto || "", raw: n.raw, unidad: n.unidad, entidad: Hh.roles.sujetos[0] || "negocio", concepto: clave ? metricaDeClave(clave) : Hh.id, conceptoNorm: normalizar(clave ? metricaDeClave(clave) : Hh.id), fig: { id: Hh.id, value: Hh.render.valor } };
};
/* un operando CONSTANTE declarado por la capa que llama, con su propia procedencia — nunca una fig, nunca el
 * hecho de un id del libro (owner 2026-09-23, piso de materialidad de cobranza: «una operación nueva mínima,
 * crudo verificado × constante declarada con su procedencia»). `c = {raw, unidad, texto, procedencia, label,
 * concepto, entidad}` — `raw`/`unidad` son los únicos campos obligatorios; el resto tiene default razonable.
 * Sirve tanto para un criterio de la casa (el piso de materialidad, `k`) como para una SUMA ya verificada por
 * OTRO llamado a `libroDeHechos` (una derivada sobre un universo de N cuentas que este operando reempaqueta
 * como un solo número con procedencia ya resuelta — ver `medir.js:_constOperando`). */
const _operandoConstante = (c) => {
  const raw = Number(c && c.raw);
  if (!Number.isFinite(raw)) return null;
  const unidad = c.unidad || "count";
  return {
    label: c.label || "constante", texto: c.texto != null ? String(c.texto) : formatoDeLaCasa(raw, unidad),
    raw, unidad, entidad: c.entidad || "negocio", concepto: c.concepto || c.label || "constante",
    conceptoNorm: normalizar(c.concepto || c.label || "constante"), crudo: true,
    procedenciaDeclarada: c.procedencia !== undefined ? c.procedencia : null,
    fig: { id: null, value: c.texto != null ? String(c.texto) : formatoDeLaCasa(raw, unidad) },
  };
};
const _operando = (I, x, libro = null) => {
  if (x == null) return null;
  if (_es(x) && x.constante) return _operandoConstante(x.constante);
  if (typeof x === "string") return _figPorId(I, x) || _operandoDeHecho(I, libro, x);
  if (_es(x)) { if (x.id) return _figPorId(I, x.id) || _operandoDeHecho(I, libro, x.id); if (x.sujeto != null && x.metrica != null) return _figDe(I, x.sujeto === "negocio" || /^(?:negocio|total)$/i.test(String(x.sujeto)) ? "negocio" : x.sujeto, x.metrica); }
  return null;
};
/* §7.3·40(d): una fig cuya métrica ES una referencia de la casa (`lexico.js`, `referencia: true` —la MISMA marca que ya decide la procedencia «estimación contra referencia»—) es un valor declarado: su texto sale EXACTO de su crudo
 * (`formatoDeUmbral`), nunca del redondeo con que la boleta la muestra. Por su ORIGEN (qué métrica es), nunca por su número; una unidad sin forma exacta (dinero) conserva el texto de siempre. */
const _textoDeReferencia = (f) => { const c = f && claveDeMetrica(f.concepto); return c && esReferencia(c) && Number.isFinite(f.raw) ? formatoDeUmbral(f.raw, f.unidad) : null; };
const _fmtFig = (f) => `${f.label} = ${_textoDeReferencia(f) || f.texto || (f.fig && f.fig.value) || formatoDeLaCasa(f.raw, f.unidad)}`;
/* tolerancia de una razón dicha: media unidad de su precisión + 0,02 puntos (la de tasas.js) */
const _tolPct = (texto) => { const m = /(\d+)(?:[.,](\d+))?\s*%/.exec(String(texto || "")); const dec = m && m[2] ? m[2].length : 0; return 0.5 / Math.pow(10, dec) + 0.02; };

/* ── el hecho evaluado ── */
function _H(id, tipo, extra = {}) {
  return { id, tipo, ok: false, veredicto: "no-verificable", motivo: "", verdad: "", evidencia: [], entidades: new Set(), roles: { sujetos: [], vs: [], miembros: [], bodega: null, num: null, den: null }, claves: new Set(), dominio: null, estado: null, polaridad: null, numeros: [], universo: null, periodo: "", render: {}, derivados: [], procedencia: null, composicion: [], naturaleza: null, origen: null, fuerza: null, confirmacion: null, ...extra };
}
const _addEnt = (H, I, nombre) => { if (!nombre || typeof nombre !== "string" || nombre === "negocio") return; const r = I.resolverEntidad(nombre); H.entidades.add(normalizar(r ? r.nombre : nombre)); };
const _addClave = (H, m) => { if (m == null || m === "") return; const c = claveDeMetrica(m) || normalizar(String(m)).replace(/\s+/g, "_"); H.claves.add(c); if (!H.dominio) H.dominio = dominioDeClave(c); if (H.polaridad == null) H.polaridad = polaridadDeClave(c); };
/* RAÍZ A7 (supervisor 2026-09-29, diagnóstico v12): un número de `H.numeros` tiene DUEÑO. `dueno:"universo"` = del conjunto u orden que la premisa declara (el umbral de su filtro, el `k` de su top o de su orden, su tamaño): NUNCA una cifra de la entidad; `dueno:"referencia"` = el valor de una referencia de la casa. Sin `dueno` es la cifra propia de la entidad (o el conteo/valor que el hecho afirma). `k` es el tamaño del top: «Sodimac: saldo vencido 2» pegaba el 2 del «los 2 de mayor» a Sodimac como si fuera su saldo. */
export const esCifraPropia = (n) => !!n && !n.dueno;
const _addNum = (H, v, unidad = null) => { const r = typeof v === "object" && v && Number.isFinite(v.raw) ? v : leerValor(v); if (r && Number.isFinite(r.raw)) H.numeros.push({ raw: r.raw, unidad: unidad || r.unidad || "count", texto: r.texto || String(v) }); };
const _dominioDeFig = (f) => { const c = claveDeMetrica(f.concepto); const d = c ? dominioDeClave(c) : null; if (d) return d; const t = normalizar((f.context || "") + " " + (f.calificador || "") + " " + (f.fig && f.fig.universo || "") + " " + (f.fig && f.fig.context || "") + " " + String(f.label || "").split(" · ").slice(1).join(" "));   /* el rótulo también dice el dominio («Medida · cerrar brecha al piso») */ if (/vencid|pendiente|abonad|recuperad|cobr|mora/.test(t)) return "cobranza"; if (/capital|frenad|inventario|stock|bodega|rotaci/.test(t)) return "inventario"; if (/venta|margen|contribuci|carga|benchmark|costo|brecha|precio|markup/.test(t)) return "comercial"; return null; };

function _deFig(H, I, f, sujeto = null) {
  /* CRUDO: PARA CALCULAR, NO PARA CITAR (owner 2026-09-25, corte 2c — corrige el corte 2b). Ley vigente del
   * Notario (fase 4, ronda 2): «el valor es el comprobante a la precisión de lo impreso» — una cita que repite
   * EXACTAMENTE lo que la boleta muestra es verdadera sin más prueba, tenga o no crudo detrás. El crudo es
   * obligatorio para hacer una cuenta NUEVA sobre el número (una razón, una derivada — `_razon`/`_derivada`, sin
   * tocar: ahí SÍ se rechaza sin crudo, porque dividir/sumar un texto redondeado no es dividir/sumar el dato) —
   * nunca para rechazar la cita en sí. El corte 2b había hecho que ESTA rama («ref»/«cifra» sin valor) rechazara
   * la cita completa sin crudo (`_ronda5_gate`, RA15: «LG-DRYER8KG · Valor de inventario = $14K» sin crudo, una
   * cita correctamente redondeada de un composer de la casa, quedaba «no-verificable» y tumbaba el ancla) — eso
   * mezclaba las dos leyes. Lo que SÍ cambia sin crudo es la FUERZA (abajo, vía `_aplicarComposicion` →
   * `_fuerzaDeComposicion`): nunca «verificada», y NUNCA «condicionada» tampoco (esa palabra es para un insumo
   * declarado por el usuario, no para el redondeo de ADI) — queda null, ninguna de las tres. El veredicto sigue
   * siendo el de siempre: verdadera si coincide con lo mostrado, falsa si no. */
  H.ok = true; H.veredicto = "verdadera"; H.motivo = `fig de la boleta: ${_fmtFig(f)}`; H.verdad = _fmtFig(f); H.evidencia = [f.label];
  const s = sujeto || f.entidad || "negocio";
  H.roles.sujetos = [s]; _addEnt(H, I, s);
  const c = claveDeMetrica(f.concepto);
  if (c) H.claves.add(c); else H.claves.add(normalizar(f.concepto).replace(/\s+/g, "_"));
  H.dominio = _dominioDeFig(f); H.polaridad = c ? polaridadDeClave(c) : null;
  H.numeros.push({ raw: f.raw, unidad: f.unidad, texto: f.texto || (f.fig && f.fig.value) || "", clave: c || normalizar(f.concepto).replace(/\s+/g, "_") });
  H.render.valor = _textoDeReferencia(f) || textoDeLaCasa(f.raw, f.unidad, f.texto || (f.fig && String(f.fig.value))) || formatoDeLaCasa(f.raw, f.unidad);
  { const declarado = _origenDeclaradoDeFig(f); _aplicarComposicion(H, [{ origen: _origenDeFigStruct(f), naturaleza: _naturalezaDeFig(f), id: _idDeOperando(f), rol: "valor", crudo: f.crudo !== false, verificado: declarado && declarado.verificado === true }]); const conf = f.confirmacion || (f.fig && f.fig.confirmacion); if (conf && typeof conf === "object") H.confirmacion = conf; }
  if (f.agregado) { H.universo = { set: null, fuente: f.universoTexto || f.calificador || "", texto: f.universoTexto || "" }; H.render.universo = f.universoTexto || ""; }
  if (/anterior|pasado/.test(f.conceptoNorm) && !/variacion|vs/.test(f.conceptoNorm)) H.periodo = "anterior";
  return H;
}

/* la traducción de un hecho tipado a la afirmación que verificar.js juzga (la casa canoniza; nada se lee de la prosa) */
/* §7.3·39(b): el `valor` de una premisa `cifra` escrito como NÚMERO A SECAS (`9800`) es la cifra en la unidad de SU métrica —el léxico: dinero, días, %…—, nunca un `count`: un `count` no casa
 * con una fig de dinero y el veredicto decía «la boleta no trae X» siendo falso (la fig estaba). El texto conserva EXACTAMENTE lo escrito (la precisión de lo dicho es la del número, no un
 * redondeo de la casa: 9.900 no vale por 9.800). Una cifra ya escrita con su unidad («$9.800», «24%») no cambia; una métrica sin unidad propia o «count» tampoco. */
const _UNIDAD_ESCRITA = { money: (n) => `$${n}`, pct: (n) => `${n}%`, pp: (n) => `${n} pp`, days: (n) => `${n}d`, ratio: (n) => `${n}x` };
function _valorDeCifra(h) {
  const v = h.valor;
  const esNumero = typeof v === "number" || (typeof v === "string" && /^\s*[+-]?\d+(?:\.\d+)?\s*$/.test(v));
  if (!esNumero || normalizar(h.tipo) !== "cifra" || h.metrica == null) return v;
  const un = unidadDeClave(_claveDeMetricaDeUniverso(h.metrica));
  const escribir = _UNIDAD_ESCRITA[un];
  if (!escribir) return v;
  const raw = Number(v);
  return { raw, unidad: un, texto: escribir(String(v).trim().replace(/^\+/, "")) };
}
function _aV2(h, I) {
  const tipo = normalizar(h.tipo);
  const base = { id: h.id, tipo, texto: `«${h.id}»`, sujeto: h.sujeto, metrica: h.metrica != null ? metricaDeClave(h.metrica) : "", valor: _valorDeCifra(h), periodo: h.periodo != null ? _periodoV2(h.periodo) : "" };
  const universo = (u, sujeto) => { if (_es(u)) return u; if (Array.isArray(u)) return u; if (typeof u === "string" && u.trim() && !/^(?:todos|todas|todo)$/i.test(u.trim())) return u; const r = typeof sujeto === "string" && sujeto !== "negocio" ? I.resolverEntidad(sujeto) : (Array.isArray(sujeto) && sujeto.length ? I.resolverEntidad(sujeto[0]) : null); return { eje: r && r.eje ? r.eje : "cliente" }; };
  switch (tipo) {
    case "orden": {
      const o = _es(h.orden) ? h.orden : {};
      // R-DIRECCION (diagnóstico v3, MATERIAL): un HECHO estructurado (premisa del encargo o `<<HECHOS>>` del
      // modelo) no trae un fragmento de prosa propio que leer (`base.texto` de arriba es un placeholder, «${id}»,
      // nunca el fragmento real) — así que si no declaró `orden.direccion`, no hay ninguna palabra que
      // `resolutor.js` pueda ir a buscar. Acá SÍ se rellena con `direccionPorDefecto` (max/topk/puesto → mayor,
      // min → menor) antes de que la puerta de completitud de `afirmacion.js` lo juzgue — esa puerta conserva su
      // propio default angosto (solo max/min) para cuando SÍ hay prosa real que leer (`_resolutor_gate`, fase 1).
      const direccion = o.direccion || direccionPorDefecto(normalizar(String(o.forma || "")));
      return { ...base, orden: { forma: o.forma, k: o.k, direccion, vs: o.vs }, universo: universo(h.universo, h.sujeto) };
    }
    case "relacion": {
      const r = _es(h.relacion) ? h.relacion : {};
      const vs = _es(r.vs) ? { sujeto: r.vs.sujeto != null ? r.vs.sujeto : (r.vs.grupo != null ? r.vs.grupo : null), metrica: r.vs.metrica != null ? metricaDeClave(r.vs.metrica) : "" } : (r.vs != null ? { sujeto: r.vs, metrica: "" } : (h.vs != null ? (_es(h.vs) ? { sujeto: h.vs.sujeto != null ? h.vs.sujeto : h.vs.grupo, metrica: h.vs.metrica != null ? metricaDeClave(h.vs.metrica) : "" } : { sujeto: h.vs, metrica: "" }) : null));
      return { ...base, relacion: { forma: r.forma, k: r.k, matiz: r.matiz, vs, valor: r.valor, ...(r.suma === true || h.suma === true ? { suma: true } : {}) }, universo: typeof h.universo === "string" ? h.universo : "" };
    }
    case "grupo": {
      let miembros = _lista(h.miembros).length ? _lista(h.miembros) : (Array.isArray(h.sujeto) ? h.sujeto : []);
      const agregado = normalizar(h.agregado || "suma");
      /* sin miembros y con universo tipado («los clientes en mora»): los miembros son el conjunto */
      if (!miembros.length && (_es(h.de) || _es(h.universo))) { try { const U = conjuntoDeUniverso(_es(h.de) ? h.de : h.universo, I, (_es(h.de) ? h.de : h.universo).eje || null, ""); if (U && U.set) miembros = [...U.set].map((k) => (I.entidades.get(k) || { nombre: k }).nombre); } catch { /* sin conjunto: la declaración queda incompleta */ } }
      const metrica = agregado === "participacion" ? "Participación en la venta" : base.metrica;
      // R-GRUPO-UNIVERSO-PERDIDO (supervisor 2026-09-26, MATERIAL) — un universo TIPADO («los clientes en mora»)
      // se preserva IGUAL que en el caso "orden" (línea de arriba, el MISMO helper `universo()`): antes, esta
      // rama solo aceptaba un universo STRING (o un `de` string) y descartaba cualquier objeto tipado a `""` —
      // así que «grupo fuera del universo» (más abajo en este archivo, el chequeo que necesita `a2.universo`
      // poblado) nunca se evaluaba, y una premisa DEMOSTRABLEMENTE falsa («Jumbo está en mora», vencido $0)
      // degradaba a «no-verificable» por falta de la fig individual de Jumbo, en vez de resolverse contra el
      // CONJUNTO que el Core ya sabe calcular (mismo mecanismo que ya usa la rama "conteo" de este switch para
      // derivar los miembros de este mismo universo). `h.de` sigue aceptado como alias tipado (mismo criterio que
      // ya usa esta rama arriba, unas líneas antes, para derivar `miembros`).
      const universoGrupo = _es(h.universo) ? h.universo : (_es(h.de) ? h.de : (typeof h.universo === "string" ? h.universo : (typeof h.de === "string" ? h.de : "")));
      return { ...base, sujeto: miembros, metrica, grupo: { entidades: miembros, n: miembros.length || h.n, agregado }, universo: universo(universoGrupo, (Array.isArray(h.miembros) && h.miembros[0]) || h.sujeto) };
    }
    case "variacion": {
      const v = _es(h.variacion) ? h.variacion : {};
      return { ...base, variacion: { direccion: v.direccion, valor: v.valor != null ? v.valor : h.valor }, periodo: _periodoV2(h.periodo || v.periodo || "anterior") };
    }
    case "estado": {
      const e = _es(h.estado) ? h.estado : { estado: h.estado, bodega: h.bodega };
      return { ...base, estado: { estado: String(e.estado || "").replace(/_/g, " "), bodega: e.bodega || h.bodega || "" } };
    }
    case "conteo": {
      const c = _es(h.conteo) ? h.conteo : { n: h.n, m: h.m, predicado: h.predicado };
      return { ...base, conteo: { n: c.n, m: c.m, predicado: c.predicado || (typeof h.de === "string" ? h.de : "") }, universo: typeof h.de === "string" ? h.de : (typeof h.universo === "string" ? h.universo : ""), ...(c.predicado ? { _predicado: c.predicado } : {}) };
    }
    default: return { ...base, universo: typeof h.universo === "string" ? h.universo : "", ...(h.base != null ? { base: h.base } : {}), ...(Array.isArray(h.evidencia) ? { evidencia: h.evidencia } : {}) };
  }
}
const _periodoV2 = (p) => { const e = periodoDe(p); return e === "anterior" ? "vs año anterior" : e === "presupuesto" ? "vs presupuesto" : e === "corte" || e === "actual" ? "" : String(p || ""); };
function _juzgarV2(a2, I) {
  const R = verificarAfirmaciones([a2], { indice: I });
  const vs = R.veredictos || [];
  if (!vs.length) return { veredicto: "no-verificable", motivo: "sin veredicto", verdad: "", evidencia: [] };
  const falsa = vs.find((v) => v.veredicto === "falsa"); if (falsa) return falsa;
  const nv = vs.find((v) => v.veredicto === "no-verificable"); if (nv) return nv;
  return { ...vs[0], motivo: vs.map((v) => v.motivo).join(" · "), verdad: vs.map((v) => v.verdad).filter(Boolean).join(" · "), evidencia: [...new Set(vs.flatMap((v) => v.evidencia || []))], canonicas: R.afirmaciones };
}
const _aplica = (H, v) => { H.veredicto = v.veredicto; H.ok = v.veredicto === "verdadera" || v.veredicto === "sellada"; H.motivo = String(v.motivo || ""); H.verdad = String(v.verdad || ""); H.evidencia = Array.isArray(v.evidencia) ? v.evidencia.slice() : []; return H; };

/* ── los evaluadores nuevos ── */
/* la base con que una métrica forma una tasa de la casa (recuperado = abonado ÷ venta; vencido sobre venta; participaciones sobre el total) */
const _BASE_DE_RAZON = { abonado: "ventas", saldo_vencido: "ventas", saldo_pendiente: "ventas", saldo_por_vencer: "ventas", contribucion: "ventas", no_capturada: "ventas", carga_alta: "ventas", costo: "ventas", capital_frenado: "capital", capital_inmovilizado: "capital", unidades: "unidades", ventas: "ventas" };
/* una métrica que contiene a otra (misma entidad): sumarlas cuenta dos veces */
const _CONTIENE = { saldo_pendiente: ["saldo_vencido", "saldo_por_vencer"], capital: ["capital_frenado", "capital_inmovilizado"], ventas: ["contribucion", "costo", "no_capturada", "carga_alta"], contribucion: ["no_capturada"] };
/* comercial y cobranza comparten el universo (la venta a crédito produce el saldo); inventario es otro universo y no se relaciona por cociente ni por suma */
const _reconcilian = (a, b) => a === b || (["comercial", "cobranza"].includes(a) && ["comercial", "cobranza"].includes(b));
function _razon(H, h, I, libro = null) {
  const num = _operando(I, h.num, libro), den = _operando(I, h.den, libro);
  if (!num) return _aplica(H, { veredicto: "no-verificable", motivo: `sin-evidencia: el numerador ${JSON.stringify(h.num)} no está en la evidencia`, verdad: "", evidencia: [] });
  if (!den) return _aplica(H, { veredicto: "no-verificable", motivo: `sin-evidencia: el denominador ${JSON.stringify(h.den)} no está en la evidencia`, verdad: "", evidencia: den ? [den.label] : [] });
  /* UN OPERANDO SIN CRUDO NO DIVIDE (owner 2026-09-23 — arreglo del verificador). `crudo === false` = evidencia.js
   * no tenía `fig.raw` y reparseó el TEXTO ya redondeado para mostrar (p. ej. «$12.6M» → 12.600.000, cuando el dato
   * real podía ser 12.556.300): usarlo como operando de una razón divide un redondeo, no un dato. Leer ese mismo
   * texto para comprobar que el modelo lo repitió sigue siendo legítimo (eso pasa por `mismoValor`, no por acá) —
   * lo que se cierra es SOLO la aritmética nueva sobre un operando reconstruido. */
  if (num.crudo === false) return _aplica(H, { veredicto: "no-verificable", motivo: `sin-crudo: ${_fmtFig(num)} es una reconstrucción desde el texto mostrado (falta el valor crudo) — no se puede usar como operando de una razón`, verdad: "", evidencia: [num.label] });
  if (den.crudo === false) return _aplica(H, { veredicto: "no-verificable", motivo: `sin-crudo: ${_fmtFig(den)} es una reconstrucción desde el texto mostrado (falta el valor crudo) — no se puede usar como operando de una razón`, verdad: "", evidencia: [den.label] });
  if (_u(num.unidad) !== _u(den.unidad)) return _aplica(H, { veredicto: "no-verificable", motivo: `unidades-distintas: ${_fmtFig(num)} y ${_fmtFig(den)} no se dividen`, verdad: "", evidencia: [num.label, den.label] });
  if (!Number.isFinite(den.raw) || den.raw === 0) return _aplica(H, { veredicto: "no-verificable", motivo: `sin-evidencia: ${_fmtFig(den)} es cero`, verdad: "", evidencia: [den.label] });
  if (normalizar(num.label) === normalizar(den.label)) return _aplica(H, { veredicto: "no-verificable", motivo: "razon-vacua: la misma cifra sobre sí misma no dice nada", verdad: "", evidencia: [num.label] });
  /* una razón es aritmética: cualquier par de cifras de la misma unidad se divide (v3.1: sin lista de pares); lo que no se divide es una cifra sobre sí misma,
   * unidades distintas, o dos universos que la casa declara que NO reconcilian (inventario contra comercial/cobranza) */
  { const dn = _dominioDeFig(num), dd = _dominioDeFig(den); if (dn && dd && !_reconcilian(dn, dd)) return _aplica(H, { veredicto: "no-verificable", motivo: `universos-que-no-reconcilian: ${dn} sobre ${dd} no es una proporción de la casa`, verdad: "", evidencia: [num.label, den.label] }); }
  const q = num.raw / den.raw;
  const forma = normalizar(h.forma || (h.valor && /x\s*$|veces/i.test(String(h.valor)) ? "veces" : "pct"));
  H.roles.num = { sujeto: num.entidad || "negocio", label: num.label }; H.roles.den = { sujeto: den.entidad || "negocio", label: den.label };
  H.roles.sujetos = [num.entidad || "negocio"]; _addEnt(H, I, num.entidad); _addEnt(H, I, den.entidad);
  for (const f of [num, den]) { const c = claveDeMetrica(f.concepto); H.claves.add(c || normalizar(f.concepto).replace(/\s+/g, "_")); }
  H.dominio = _dominioDeFig(num) || _dominioDeFig(den);
  H.numeros.push({ raw: num.raw, unidad: num.unidad, texto: num.texto || "" }, { raw: den.raw, unidad: den.unidad, texto: den.texto || "" });
  const cuenta = `${_fmtFig(num)} ÷ ${_fmtFig(den)} = ${forma === "veces" ? q.toFixed(2) + "×" : _fmtPct(q * 100)}`;
  const v = h.valor != null ? leerValor(h.valor) : null;
  if (v && Number.isFinite(v.raw)) {
    const dicho = v.unidad === "pct" ? v.raw : v.unidad === "ratio" ? v.raw * 100 : (forma === "veces" ? v.raw * 100 : v.raw);
    const tol = v.unidad === "pct" || forma !== "veces" ? _tolPct(v.texto) : 5;
    /* dos lecturas: con los crudos y con lo impreso (la prosa pudo dividir cifras redondeadas) */
    const pn = _impreso(num.texto), pd = _impreso(den.texto);
    const lecturas = [q * 100]; if (pn != null && pd != null && pd !== 0) lecturas.push((pn / pd) * 100);
    if (!lecturas.some((x) => Math.abs(x - dicho) <= tol)) return _aplica(H, { veredicto: "falsa", motivo: `razon-falsa: ${cuenta}, no ${v.texto}`, verdad: cuenta, evidencia: [num.label, den.label] });
    H.numeros.push({ raw: v.raw, unidad: v.unidad, texto: v.texto });
  }
  H.render.valor = forma === "veces" ? `${(Math.round(q * 10) / 10).toFixed(1)}x` : _fmtPct(q * 100);
  /* el valor dicho y verificado se imprime con SU precisión (el canon de la casa lo lava después): «55%» sigue siendo «55%», no «55.1%» */
  if (v && Number.isFinite(v.raw)) H.render.valor = _canonTexto(v.texto);
  H.render.base = den.entidad ? `de ${den.label}` : `del ${String(den.concepto || den.label).toLowerCase()}`;
  H.numeros.push({ raw: forma === "veces" ? q : q * 100, unidad: forma === "veces" ? "ratio" : "pct", texto: H.render.valor });
  H.procedencia = peorProcedencia(_procedenciaDeOperando(num, libro), _procedenciaDeOperando(den, libro));   // «una derivada hereda la peor procedencia de sus insumos» (owner) — una razón es la misma regla con dos insumos (campo LEGADO: se sobreescribe abajo con la tabla fija, mismo resultado)
  _aplicarComposicion(H, [
    { origen: _origenDeOperando(num, libro), naturaleza: _naturalezaDeOperando(num, libro), id: _idDeOperando(num), rol: "numerador", crudo: _crudoDeOperando(num) },
    { origen: _origenDeOperando(den, libro), naturaleza: _naturalezaDeOperando(den, libro), id: _idDeOperando(den), rol: "denominador", crudo: _crudoDeOperando(den) },
  ]);
  return _aplica(H, { veredicto: "verdadera", motivo: `razon: ${cuenta}`, verdad: cuenta, evidencia: [num.label, den.label] });
}
const _impreso = (t) => { const m = /(-?\d+(?:[.,]\d+)?)\s*([kmb])?/i.exec(String(t || "").replace(/\$/g, "").replace(/\.(?=\d{3}\b)/g, "")); if (!m) return null; const v = parseFloat(m[1].replace(",", ".")); const e = m[2] ? { k: 1e3, m: 1e6, b: 1e9 }[m[2].toLowerCase()] : 1; return v * e; };

const _OP_ALIAS = { resta: "diferencia", diferencia_pp: "pp", division: "cociente", ratio: "cociente", veces: "cociente", proporcion: "cociente", total: "suma", sumar: "suma", restar: "diferencia" };
/* el ROL de cada insumo de una derivada, para la composición (nunca «operando genérico» cuando la operación ya
 * dice qué papel cumple cada número — «sin resumir nunca», ley del owner). */
function _rolesDeOperandos(op, n) {
  if (op === "suma") return Array.from({ length: n }, (_, i) => `sumando_${i + 1}`);
  if (op === "diferencia") return ["minuendo", "sustraendo"];
  if (op === "cociente") return ["numerador", "denominador"];
  if (op === "pp") return ["tasa_a", "tasa_b"];
  if (op === "variacion_relativa") return ["valor_nuevo", "valor_base"];
  if (op === "producto") return ["factor", "tasa"];
  return Array.from({ length: n }, (_, i) => `operando_${i + 1}`);
}
function _derivada(H, h, I, libro = null) {
  const op0 = normalizar(h.op || "");
  const op = _OP_ALIAS[op0] || op0;
  const ops = _lista(h.de).map((x) => _operando(I, x, libro));
  const falta = _lista(h.de)[ops.findIndex((x) => !x)];
  if (falta !== undefined) return _aplica(H, { veredicto: "no-verificable", motivo: `sin-evidencia: el operando ${JSON.stringify(falta)} no está en la evidencia`, verdad: "", evidencia: [] });
  if (ops.length < 2) return _aplica(H, { veredicto: "no-verificable", motivo: "derivada-incompleta: hacen falta al menos dos operandos", verdad: "", evidencia: [] });
  /* UN OPERANDO SIN CRUDO NO SE SUMA NI SE RESTA (owner 2026-09-23 — arreglo del verificador, mismo candado que
   * `_razon`): `crudo === false` = evidencia.js reparseó el texto ya redondeado porque `fig.raw` no existía. */
  { const sc = ops.find((f) => f.crudo === false); if (sc) return _aplica(H, { veredicto: "no-verificable", motivo: `sin-crudo: ${_fmtFig(sc)} es una reconstrucción desde el texto mostrado (falta el valor crudo) — no se puede usar como operando de una derivada`, verdad: "", evidencia: [sc.label] }); }
  for (const f of ops) { _addEnt(H, I, f.entidad); const c = claveDeMetrica(f.concepto); H.claves.add(c || normalizar(f.concepto).replace(/\s+/g, "_")); H.numeros.push({ raw: f.raw, unidad: f.unidad, texto: f.texto || "" }); }
  H.roles.sujetos = [...new Set(ops.map((f) => f.entidad || "negocio"))]; H.dominio = _dominioDeFig(ops[0]);
  const raws = ops.map((f) => f.raw), u0 = ops[0].unidad;
  let res = null, unidad = u0, cuenta = "";
  if (op === "suma" || op === "diferencia") {
    if (ops.some((f) => f.unidad === "pct" || f.unidad === "pp")) return _aplica(H, { veredicto: "no-verificable", motivo: "las tasas no se suman ni se restan (usa pp para la brecha entre dos tasas)", verdad: "", evidencia: ops.map((f) => f.label) });
    const claves = [...new Set(ops.map((f) => claveDeMetrica(f.concepto) || normalizar(f.concepto)))];
    if (claves.length > 1 && new Set(ops.map((f) => _dominioDeFig(f) || "")).size > 1) return _aplica(H, { veredicto: "no-verificable", motivo: `dominios-distintos: ${ops.map((f) => f.label).join(" y ")} no se suman`, verdad: "", evidencia: ops.map((f) => f.label) });
    const totales = ops.filter((f) => !f.entidad || f.entidad === "negocio"), partes = ops.filter((f) => f.entidad && f.entidad !== "negocio");
    if (op === "suma" && totales.length && partes.length && totales.some((t) => partes.some((p) => (claveDeMetrica(t.concepto) || "") === (claveDeMetrica(p.concepto) || "x")))) return _aplica(H, { veredicto: "no-verificable", motivo: "total-y-parte: el total ya contiene a la parte", verdad: "", evidencia: ops.map((f) => f.label) });
    /* la misma entidad, una métrica que contiene a la otra (el vencido es parte del pendiente): sumarlas cuenta dos veces */
    if (op === "suma") for (const a of ops) for (const b of ops) { if (a === b) continue; const ca = claveDeMetrica(a.concepto), cb = claveDeMetrica(b.concepto); if (ca && cb && (_CONTIENE[ca] || []).includes(cb) && normalizar(a.entidad || "negocio") === normalizar(b.entidad || "negocio")) return _aplica(H, { veredicto: "no-verificable", motivo: `parte-y-todo: ${metricaDeClave(cb)} ya está dentro de ${metricaDeClave(ca)}`, verdad: "", evidencia: ops.map((f) => f.label) }); }
  }
  if (op === "suma") { if (!ops.every((f) => _u(f.unidad) === _u(u0))) return _aplica(H, { veredicto: "no-verificable", motivo: "unidades-mezcladas", verdad: "", evidencia: ops.map((f) => f.label) }); res = raws.reduce((s, x) => s + x, 0); cuenta = ops.map(_fmtFig).join(" + "); }
  else if (op === "diferencia") { if (ops.length !== 2 || _u(ops[1].unidad) !== _u(u0)) return _aplica(H, { veredicto: "no-verificable", motivo: "diferencia: dos operandos de la misma unidad", verdad: "", evidencia: ops.map((f) => f.label) }); res = raws[0] - raws[1]; cuenta = `${_fmtFig(ops[0])} − ${_fmtFig(ops[1])}`; if (u0 === "pct") unidad = "pp"; }
  else if (op === "cociente") { if (ops.length !== 2 || raws[1] === 0) return _aplica(H, { veredicto: "no-verificable", motivo: "cociente: dos operandos, divisor ≠ 0", verdad: "", evidencia: ops.map((f) => f.label) }); if (_u(ops[0].unidad) !== _u(ops[1].unidad)) return _aplica(H, { veredicto: "no-verificable", motivo: `unidades-distintas: ${ops[0].label} (${ops[0].unidad}) no se divide por ${ops[1].label} (${ops[1].unidad})`, verdad: "", evidencia: ops.map((f) => f.label) }); const enPct = /%/.test(String(h.valor || "")) || !(h.valor != null); res = enPct ? (raws[0] / raws[1]) * 100 : raws[0] / raws[1]; unidad = enPct ? "pct" : "ratio"; cuenta = `${_fmtFig(ops[0])} ÷ ${_fmtFig(ops[1])}`; }
  else if (op === "pp") { if (ops.length !== 2 || !ops.every((f) => f.unidad === "pct" || f.unidad === "pp")) return _aplica(H, { veredicto: "no-verificable", motivo: "pp: dos tasas", verdad: "", evidencia: ops.map((f) => f.label) }); res = raws[0] - raws[1]; unidad = "pp"; cuenta = `${_fmtFig(ops[0])} − ${_fmtFig(ops[1])}`; }
  else if (op === "variacion_relativa") { if (ops.length !== 2 || raws[1] === 0) return _aplica(H, { veredicto: "no-verificable", motivo: "variación relativa: (nuevo − base) ÷ base, base ≠ 0", verdad: "", evidencia: ops.map((f) => f.label) }); res = ((raws[0] - raws[1]) / Math.abs(raws[1])) * 100; unidad = "pct"; cuenta = `(${_fmtFig(ops[0])} − ${_fmtFig(ops[1])}) ÷ ${_fmtFig(ops[1])}`; }
  else if (op === "producto") { if (ops.length !== 2) return _aplica(H, { veredicto: "no-verificable", motivo: "producto: dos operandos", verdad: "", evidencia: ops.map((f) => f.label) }); const pct = ops.find((f) => f.unidad === "pct" || f.unidad === "pp"), otro = ops.find((f) => f !== pct); if (!pct || !otro) return _aplica(H, { veredicto: "no-verificable", motivo: "producto: una cifra × una tasa (pct o pp)", verdad: "", evidencia: ops.map((f) => f.label) }); res = otro.raw * pct.raw / 100; unidad = otro.unidad; cuenta = `${_fmtFig(otro)} × ${_fmtFig(pct)}`; }
  else return _aplica(H, { veredicto: "no-verificable", motivo: `derivada: operación «${h.op}» desconocida (suma · diferencia · pp · variacion_relativa · producto)`, verdad: "", evidencia: [] });
  const verdad = `${cuenta} = ${formatoDeLaCasa(res, unidad)}`;
  const v = h.valor != null ? leerValor(h.valor) : null;
  if (v && Number.isFinite(v.raw)) {
    if (_u(v.unidad) !== _u(unidad) && !(unidad === "pp" && v.unidad === "pct")) return _aplica(H, { veredicto: "no-verificable", motivo: `unidad-distinta: la cuenta da ${formatoDeLaCasa(res, unidad)} y el valor dicho es ${v.texto}`, verdad, evidencia: ops.map((f) => f.label) });
    const dec = _decimales(v.texto), escala = /m\b/i.test(v.texto) ? 1e6 : /k\b/i.test(v.texto) ? 1e3 : 1;
    const tol = (unidad === "money" && dec > 0) ? 0.5 * Math.pow(10, -dec) * escala + 1e-9 : Math.max(tolCalculo(res, unidad === "pp" ? "pct" : unidad), 0.5 * Math.pow(10, -dec) + 1e-9);
    const conSigno = /^\s*[+\-−]/.test(String(h.valor || ""));
    /* la cuenta sobre los operandos tal como se muestran (redondeados a la precisión dicha) también vale: $4.6M + $2.5M = $7.1M */
    const redondear = (x) => (Math.round((x / escala) * Math.pow(10, dec)) / Math.pow(10, dec)) * escala;
    const resRed = op === "suma" ? raws.map(redondear).reduce((s, x) => s + x, 0) : (op === "diferencia" || op === "pp") ? redondear(raws[0]) - redondear(raws[1]) : res;
    const cerca = (r) => Math.abs(Math.abs(r) - Math.abs(v.raw)) <= tol;
    if (!cerca(res) && !cerca(resRed)) return _aplica(H, { veredicto: "falsa", motivo: `derivada-falsa: ${verdad}, no ${v.texto}`, verdad, evidencia: ops.map((f) => f.label) });
    if (op === "diferencia" && res < 0 && !conSigno && v.raw > 0 && Math.abs(res) > tol) return _aplica(H, { veredicto: "falsa", motivo: `signo: la diferencia es ${formatoDeLaCasa(res, unidad)} (negativa), no ${v.texto}`, verdad, evidencia: ops.map((f) => f.label) });
    H.numeros.push({ raw: v.raw, unidad: v.unidad, texto: v.texto });
  }
  H.render.valor = v && Number.isFinite(v.raw) ? _canonTexto(v.texto) : formatoDeLaCasa(res, unidad); H.numeros.push({ raw: res, unidad, texto: formatoDeLaCasa(res, unidad) });
  H.resultado = { raw: res, unidad, texto: formatoDeLaCasa(res, unidad) };
  H.procedencia = peorProcedencia(...ops.map((f) => _procedenciaDeOperando(f, libro)));   // «una derivada hereda la peor procedencia de sus insumos» (owner, textual) — campo LEGADO: se sobreescribe abajo con la tabla fija, mismo resultado
  { const roles = _rolesDeOperandos(op, ops.length); _aplicarComposicion(H, ops.map((f, i) => ({ origen: _origenDeOperando(f, libro), naturaleza: _naturalezaDeOperando(f, libro), id: _idDeOperando(f), rol: roles[i] || `operando_${i + 1}`, crudo: _crudoDeOperando(f) }))); }
  return _aplica(H, { veredicto: "verdadera", motivo: `derivada (${op}): ${verdad}`, verdad, evidencia: ops.map((f) => f.label) });
}
const _decimales = (t) => { const m = /\d+[.,](\d+)/.exec(String(t || "")); return m ? m[1].length : 0; };
/* el texto de una cifra dicha, en el canon de la casa (decimal con punto, sin espacio antes de % ni de pp) */
const _canonTexto = (t) => menosAscii(String(t || "")).trim().replace(/(\d),(\d)/g, "$1.$2").replace(/\s+%/g, "%").replace(/\s+pp\b/g, " pp");

function _conteoTipado(H, h, I) {
  const u = _es(h.de) ? h.de : (_es(h.universo) ? h.universo : null);
  if (!u) return null;   // sin universo tipado: lo juzga el verificador de siempre
  const c = _es(h.conteo) ? h.conteo : { n: h.n, m: h.m };
  H.universoTipado = u;   // el universo tal como se declaró: las anclas leen su eje y su exclusión
  H.procedencia = "derivado";   // un conteo sobre el universo es SIEMPRE un cálculo del motor (contar entidades), nunca una lectura directa de un archivo — campo LEGADO: se sobreescribe abajo con la tabla fija, mismo resultado
  const n = Number.isFinite(+c.n) ? +c.n : NaN;
  const U = conjuntoDeUniverso(u, I, u.eje || null, "");
  _aplicarComposicion(H, [{ origen: "medido", naturaleza: "derivado", id: (typeof U.fuente === "string" ? U.fuente : null), rol: "universo_evaluado", crudo: true }]);
  if (U.error) return _aplica(H, { veredicto: "no-verificable", motivo: U.error, verdad: "", evidencia: [] });
  const eje = normalizar(u.eje || "cliente");
  const total = I.tamanoDelEje(eje);
  const set = U.set || new Set([...I.entidades].filter(([, e]) => e.eje === eje).map(([k]) => k));
  /* el «de M» es el tamaño del universo REALMENTE contado (decisión del supervisor 2026-09-29, colateral 3 de v13, Z40): el eje, la base, y la BODEGA cuando el universo la nombra
   * (`bodega` o `excluir.bodega`) — «3 de 4 en los SKU sin venta de Valparaíso», no «3 de 13» (los 13 son del eje entero, no de la bodega contada) */
  const _alcance = { eje };
  if (u.base && !/^todos?|todas$/i.test(String(u.base))) _alcance.base = u.base;
  if (u.bodega) _alcance.bodega = u.bodega;
  if (_es(u.excluir) && u.excluir.bodega) _alcance.excluir = { bodega: u.excluir.bodega };
  const mBase = Object.keys(_alcance).length > 1 ? ((() => { try { return conjuntoDeUniverso(_alcance, I, eje, "").set; } catch { return null; } })() || new Set()).size : (total || set.size);
  /* los «de M» admisibles: el eje entero, la base, el conjunto por estados y la base con estados (la cadena antes de filtros, top y exclusiones) */
  const mAdmisibles = new Set([mBase, total].filter((x) => Number.isFinite(x) && x > 0));
  { const tam = (uu) => { try { const S = conjuntoDeUniverso(uu, I, eje, ""); return S && S.set ? S.set.size : null; } catch { return null; } };
    const tieneEst = _lista(u.estados).length || _lista(u.no_estados).length;
    const masRestriccion = (Array.isArray(u.filtros) && u.filtros.length) || u.top || u.bodega || u.excluir;   // el «de M» por estados vale solo si algo más restringe: «6 de 6 en mora» es vacuo
    if (tieneEst && masRestriccion) { const s1 = tam({ eje, estados: u.estados, no_estados: u.no_estados }); if (s1) mAdmisibles.add(s1); if (u.base) { const s2 = tam({ eje, base: u.base, estados: u.estados, no_estados: u.no_estados }); if (s2) mAdmisibles.add(s2); } }
    if (u.bodega) { const s3 = tam({ eje, bodega: u.bodega }); if (s3) mAdmisibles.add(s3); }
    /* v24 (Q63, §7.3·46c «el de M admisible de un conteo es cualquier eslabón de la cadena del universo de la premisa»): la cadena sigue base/bodega → estados → filtros → top → excluir; el universo ANTES de la exclusión («los 5 de más venta» = 5 → «sin SAM-TV55» = 4) y el anterior al top (el de los filtros) son eslabones de la cadena, no solo el eje, la base y los estados */
    { const _sin = (omitir) => { const v = { ...u }; for (const c of omitir) delete v[c]; return v; };
      const _tieneExcluir = _es(u.excluir) && Object.values(u.excluir).some((x) => (Array.isArray(x) ? x.length : x != null && x !== ""));
      if (_tieneExcluir) { const s5 = tam(_sin(["excluir"])); if (s5) mAdmisibles.add(s5); }
      if (Array.isArray(u.filtros) && u.filtros.length && (u.top || _tieneExcluir)) { const s4 = tam(_sin(["top", "excluir"])); if (s4) mAdmisibles.add(s4); } }
    // §7.3·10 del contrato (decisión del supervisor, 2026-09-26): con `top.sobre:"eje"` el top se toma SOBRE EL EJE
    // ENTERO, ANTES que estados/filtros («de los 5 de menor venta [global], cuántos en mora») — ese top-k es
    // entonces la restricción PREVIA de la cadena, exactamente el mismo rol que ya cumple `base` arriba, así que
    // su tamaño (`top.k`) es un «de M» admisible. Con el sentido por defecto (`sobre` ausente o "filtro") el top
    // corre DENTRO de lo ya filtrado por estados — ahí `k` no es una restricción previa, ya lo captura `mBase`/
    // `mAdmisibles` de arriba, así que no se agrega nada nuevo (nunca cambia el comportamiento de hoy).
    if (u.top && normalizar(u.top.sobre) === "eje" && _entero(u.top.k) && +u.top.k > 0) mAdmisibles.add(+u.top.k);
    /* §7.3·54(a) LOS ESLABONES DE UN CONTEO: la cadena tiene un eslabón por CADA restricción, en el orden de `_conjuntoTipado` —el eje entero, la base, CADA estado, CADA filtro, el top, la exclusión— y el universo FINAL
     * también es un eslabón. Un «de M» es admisible si M es el tamaño de cualquiera de ellos: los filtros no son un solo eslabón y «n de n» sobre el universo final es verdadero. */
    /* §7.3·57(d) (extiende la 54a): la BODEGA, CADA no_estado y CADA RAMA de una unión también son eslabones de la cadena. La cadena de una restricción sigue el orden de `_conjuntoTipado` (base · cada estado · cada no_estado · la bodega · cada filtro · el top · la exclusión); una unión suma, tras todo eso, el tamaño de CADA rama (sola y con su propia cadena de restricciones) y el de la unión acumulada rama a rama. */
    { const _cadenaDe = (uu) => { const acum = { eje }; const sumar = (campo, valor) => { acum[campo] = valor; const s = tam({ ...acum }); if (s) mAdmisibles.add(s); };
        if (uu.base && !/^todos?|todas$/i.test(String(uu.base))) sumar("base", uu.base);
        const _est = _lista(uu.estados); for (let i = 0; i < _est.length; i++) sumar("estados", _est.slice(0, i + 1));
        const _noEst = _lista(uu.no_estados); for (let i = 0; i < _noEst.length; i++) sumar("no_estados", _noEst.slice(0, i + 1));
        if (uu.bodega) sumar("bodega", uu.bodega);
        const _fil = Array.isArray(uu.filtros) ? uu.filtros : []; for (let i = 0; i < _fil.length; i++) sumar("filtros", _fil.slice(0, i + 1));
        if (uu.top) sumar("top", uu.top);
        if (uu.excluir) sumar("excluir", uu.excluir);
        /* la bodega acota el eje como una base: con estados o no_estados también es un eslabón ANTES de ellos («el eje acotado por la bodega», B40 de v37); el universo final es el mismo */
        if (uu.bodega && (_lista(uu.estados).length || _lista(uu.no_estados).length)) {
          const a2 = { eje }; const sumar2 = (campo, valor) => { a2[campo] = valor; const s = tam({ ...a2 }); if (s) mAdmisibles.add(s); };
          if (uu.base && !/^todos?|todas$/i.test(String(uu.base))) sumar2("base", uu.base);
          sumar2("bodega", uu.bodega);
          const e2 = _lista(uu.estados); for (let i = 0; i < e2.length; i++) sumar2("estados", e2.slice(0, i + 1));
          const n2 = _lista(uu.no_estados); for (let i = 0; i < n2.length; i++) sumar2("no_estados", n2.slice(0, i + 1));
          const f2 = Array.isArray(uu.filtros) ? uu.filtros : []; for (let i = 0; i < f2.length; i++) sumar2("filtros", f2.slice(0, i + 1));
          if (uu.top) sumar2("top", uu.top);
          if (uu.excluir) sumar2("excluir", uu.excluir);
        } };
      _cadenaDe(u);
      if (Array.isArray(u.union) && u.union.length) {
        const raiz = { ...u }; delete raiz.union;
        u.union.forEach((v, i) => {
          if (_es(v)) { const rama = { ...v }; delete rama.union; _cadenaDe(rama); const s1 = tam({ ...rama, eje }); if (s1) mAdmisibles.add(s1); }
          const s2 = tam({ ...raiz, union: u.union.slice(0, i + 1) }); if (s2) mAdmisibles.add(s2);
        });
      }
      if (set.size > 0) mAdmisibles.add(set.size); }
  }
  const mDicho = c.m != null && Number.isFinite(+c.m) ? +c.m : null;
  /* v22 (S17 · S18 · S21, §7.3·44d): cuando el «de M» que la consulta dijo NO es de la cadena del universo (falsa solo por el M), la verdad propia imprime el M MÁS AJUSTADO de esa cadena que aún supere al conteo —el mismo que una premisa verdadera de este universo diría—, nunca el eje entero
   * ni un «5 de 5» vacuo: antes la Entrega decía «3 de 7» en la premisa verdadera y «3 de 13» en la falsa, sobre el MISMO universo. */
  const _kDelTopSobreEje = u.top && normalizar(u.top.sobre) === "eje" && _entero(u.top.k) ? +u.top.k : null;   /* el `k` de un top SOBRE EL EJE es un «de M» admisible, pero es el tamaño del RESULTADO de una restricción, no una población de la cadena: no se elige como el M de la verdad propia */
  const _mMasAjustado = (() => { const may = [...mAdmisibles].filter((x) => x > set.size && x !== _kDelTopSobreEje).sort((a, b) => a - b); return may.length ? may[0] : mBase; })();
  const mRender = mDicho != null ? (mAdmisibles.has(mDicho) ? mDicho : _mMasAjustado) : mBase;
  H.universo = { set, fuente: U.fuente, texto: nombrarUniverso(u, I), restringido: !!U.set };
  H.render.universo = H.universo.texto; H.render.n = String(set.size); H.render.m = String(mRender);
  for (const k of set) H.entidades.add(k);
  H.roles.miembros = [...set].map((k) => (I.entidades.get(k) || { nombre: k }).nombre);
  { const nombrados = _lista(h.sujeto).map((x) => { const r = I.resolverEntidad(x); return normalizar(r ? r.nombre : x); }); const fuera = nombrados.filter((k) => !set.has(k)); if (fuera.length) return _aplica(H, { veredicto: "falsa", motivo: `fuera-del-conjunto: ${fuera.map((k) => (I.entidades.get(k) || { nombre: k }).nombre).join(", ")} no está en «${nombrarUniverso(u, I)}»`, verdad: `${nombrarUniverso(u, I)}: ${H.roles.miembros.join(", ")}`, evidencia: [U.fuente].filter(Boolean) }); }
  // §7.3 (SUPERVISOR, residual del diagnóstico v10 — X34: «Sodimac: saldo por vencer 5000000», un umbral de
  // filtro impreso crudo) — el UMBRAL del filtro es una cifra CALCULADA de la casa (viaja en `H.numeros`, se
  // imprime en la oración de la premisa), no «lo directo tal como llegó»: se formatea con `formatoDeLaCasa`
  // (la MISMA función que ya usa este archivo para cualquier otro número calculado, línea ~1005), nunca
  // `String(f.valor)` a secas — antes el número crudo de la consulta (`5000000`) llegaba tal cual al texto.
  for (const f of Array.isArray(u.filtros) ? u.filtros : []) { _addClave(H, f.metrica); if (f.valor != null && !Array.isArray(f.valor)) { const unidad = f.unidad && !/^(?:days|money|pct|pp|count|ratio)$/.test(String(f.unidad)) ? "days" : (f.unidad || unidadDeClave(f.metrica) || "count"); const raw = f.unidad && !/^(?:days|money|pct|pp|count|ratio)$/.test(String(f.unidad)) ? diasDe(f.valor, f.unidad) : +f.valor; H.numeros.push({ raw: +f.valor, unidad: unidad === "days" && raw !== +f.valor ? "count" : unidad, texto: formatoDeReferencia(+f.valor, unidad === "days" && raw !== +f.valor ? "count" : unidad) || String(f.valor), dueno: "universo" }); if (raw != null && raw !== +f.valor) H.numeros.push({ raw, unidad: "days", texto: `${raw} días`, dueno: "universo" }); H.render.umbral = _fmtUmbral(f).replace(/^.*?(?:superior a|de al menos|inferior a|de hasta|igual a|entre)\s+/, ""); } }
  if (u.top) { _addClave(H, u.top.metrica); H.numeros.push({ raw: +u.top.k, unidad: "count", texto: String(u.top.k), dueno: "universo" }); H.render.k = String(u.top.k); }
  for (const e of [..._lista(u.estados), ..._lista(u.no_estados), ..._lista(u.excluir && u.excluir.estados)]) { const c = _canonDe(e); H.estado = H.estado || c; H.estadosDelUniverso = H.estadosDelUniverso || new Set(); H.estadosDelUniverso.add(c); if (!H.dominio) H.dominio = dominioDeEstado(c); }
  H.numeros.push({ raw: set.size, unidad: "count", texto: String(set.size), dueno: "universo" }, { raw: mBase, unidad: "count", texto: String(mBase), dueno: "universo" });
  /* v20 (§7.3·44d): el «de M» que se dice es el tamaño del universo de la PREMISA (`mRender`: el «de M» admisible que la consulta planteó), no el de otra base («3 de 4» donde la consulta dijo «3 de 4», nunca «3 de 5») */
  if (mRender !== mBase && Number.isFinite(mRender)) H.numeros.push({ raw: mRender, unidad: "count", texto: String(mRender), dueno: "universo" });
  const lista = H.roles.miembros.join(", ");
  let verdad = `${set.size}${mRender ? " de " + mRender : ""} en ${H.universo.texto}${lista ? ": " + lista : ""}`;
  // A4, GENERALIZACIÓN A `conteo` (supervisor 2026-09-27, diagnóstico v9, RAÍZ A4 — precisa el bloque gemelo de
  // `grupo`/`estado`, más abajo en este archivo) — un conteo sobre un universo de REFERENCIA (`base`/`estados`
  // citando «rota bien»/«rota lento», «bajo/sobre el benchmark», etc.) imprime el VALOR de esa referencia en la
  // MISMA oración del veredicto (§7.3·12/·19) — `_conteoTipado` devuelve ACÁ, antes de llegar al bloque genérico
  // que ya lo hacía para `grupo`, así que sin esto un conteo quedaba sin la cifra. La MISMA tabla
  // `referenciaDeBase`/`referenciaDeEstado`, la MISMA función `valorDeReferencia`/`formatoDeLaCasa` — nunca una
  // segunda cifra inventada; una sola referencia por oración (la primera que calce), nunca varias acumuladas.
  // §7.3·19 (SUPERVISOR, residual del diagnóstico v10 — X48: «rota bien ∪ rota lento», sin el piso de rotación
  // en el mismo tramo) — un `union` trae sus propios `base`/`estados`/`no_estados` DENTRO de cada miembro (nunca
  // al nivel de `u`): antes este barrido solo miraba `u.base`/`u.estados`/`u.no_estados` de la RAÍZ, así que un
  // conteo sobre un universo declarado como `union` (nunca como `base`/`estados` a secas) no encontraba ninguna
  // referencia que citar, aunque sus miembros SÍ nombren una (piso de rotación, vía «rota bien»/«rota lento»).
  /* §7.3·39(d): la exclusión por conjunto o estado de la casa cita la MISMA referencia que si fuera el `base` («todas menos las de carga comercial alta» dice el nivel de carga) */
  for (const nCrudo of [u.base, ..._lista(u.estados), ..._lista(u.no_estados), ...(_es(u.excluir) ? [..._lista(u.excluir.conjuntos), ..._lista(u.excluir.estados)] : []), ...(Array.isArray(u.union) ? u.union.flatMap((v) => (_es(v) ? [v.base, ..._lista(v.estados), ..._lista(v.no_estados)] : [])) : [])].filter(Boolean)) {
    const fam = referenciaDeBase(String(nCrudo)) || referenciaDeEstado(_canonDe(nCrudo));
    if (!fam) continue;
    const rRef = valorDeReferencia(fam.concepto, I);
    if (!rRef || !Number.isFinite(rRef.raw)) continue;
    const mRef = metricaPorClave(fam.concepto);
    const valTxt = formatoDeReferencia(rRef.raw, rRef.unidad || "pct");
    if (verdad.includes(valTxt)) break;
    verdad = `${verdad}, ${mRef ? mRef.nombre.toLowerCase() : fam.concepto} ${valTxt}`;
    break;
  }
  if (!Number.isFinite(n)) return _aplica(H, { veredicto: "verdadera", motivo: `conteo tipado: ${verdad}`, verdad, evidencia: [U.fuente] });
  if (n !== set.size) return _aplica(H, { veredicto: "falsa", motivo: `conteo-falso: son ${verdad}, no ${n}`, verdad, evidencia: [U.fuente] });
  if (mDicho != null && !mAdmisibles.has(mDicho)) return _aplica(H, { veredicto: "falsa", motivo: `universo-falso: son ${set.size} de ${[...mAdmisibles].join(" o de ")}, no de ${c.m}`, verdad, evidencia: [U.fuente] });
  return _aplica(H, { veredicto: "verdadera", motivo: `conteo tipado: ${verdad}`, verdad, evidencia: [U.fuente] });
}

/* ── la verdad de lo falso, con id: el complemento del estado y las cifras que la evidencia citó ── */
function _verdadDeLoFalso(H, h, I, libro) {
  const out = [];
  const nuevo = (suf, tipo, extra) => { const id = `${H.id}${suf}`; if (libro.porId.has(id)) return null; return { id, tipo, ...extra }; };
  if (H.tipo === "estado" && H.estado) {
    const comp = complementoDe(H.estado) || COMPLEMENTO_V3[H.estado] || null;
    if (comp) { const n = nuevo("a", "estado", { sujeto: H.roles.sujetos[0], estado: comp }); if (n) out.push(n); }
  }
  let k = 0;
  for (const label of H.evidencia || []) {
    const f = I.figs.find((g) => normalizar(g.label) === normalizar(label));
    if (!f || !Number.isFinite(f.raw)) continue;
    const n = nuevo(String.fromCharCode(98 + k), "ref", { de: f.fig && f.fig.id ? f.fig.id : f.label }); if (n) { out.push(n); k++; }
  }
  return out;
}

/* ── VALIDACIÓN DE ESQUEMA (v3.1 · pieza 2): el hecho tipado tiene la forma que el protocolo enseña, o no entra al libro ── */
const _ENUM = { orden_forma: ["max", "min", "puesto", "topk", "comparativo"], direccion: ["mayor", "menor", "peor", "mejor"], relacion_forma: ["veces", "fraccion", "parte", "mayor", "menor", "igual", "diferencia"], variacion_dir: ["sube", "baja"], agregado: ["suma", "participacion", "promedio"], op: ["suma", "diferencia", "cociente", "pp", "resta", "diferencia_pp", "division", "ratio", "producto", "variacion_relativa", "veces", "proporcion", "total", "sumar", "restar"], sobre: ["filtro", "eje"] };   // top.sobre (contrato §7.3·8): "filtro" (default, dentro de estados/filtros ya aplicados) · "eje" (sobre el eje entero)
const _entero = (x) => Number.isFinite(+x) && Math.floor(+x) === +x;
const _esNegado = (e) => /^\s*no[ _]+\S/i.test(String(e == null ? "" : e));
const _sinNo = (e) => (typeof e === "string" ? e.replace(/^\s*no[ _]+/i, "") : e);
/* un universo escrito que nombra un estado («clientes al día», «SKU sin venta», «cuentas no en mora») se resuelve como universo tipado */
const _EJE_DE_SUSTANTIVO = { cliente: "cliente", clientes: "cliente", cuenta: "cliente", cuentas: "cliente", sku: "sku", skus: "sku", producto: "sku", productos: "sku", marca: "marca", marcas: "marca", familia: "familia", familias: "familia", bodega: "bodega", bodegas: "bodega", canal: "canal", canales: "canal" };
function _universoDeTexto(s) {
  const m = /^(?:los|las|tus|mis|sus|todos\s+los|todas\s+las)?\s*(?:\d+\s+)?([a-z]+)\s+(?:que\s+est[aá]n\s+|que\s+)?(.+)$/i.exec(normalizar(String(s || "")).trim());
  if (!m) return null;
  const eje = _EJE_DE_SUSTANTIVO[m[1]]; if (!eje) return null;
  const resto = m[2].trim();
  const c = estadoDeclarado(resto); if (c) return { eje, estados: [c] };
  const neg = /^(?:no|sin)\s+(.+)$/.exec(resto); if (neg) { const c2 = estadoDeclarado(neg[1]); if (c2) return { eje, no_estados: [c2] }; }
  return null;
}
const _ejeDeEntidad = (I, nombre) => { try { const r = I.resolverEntidad(nombre); return r ? r.eje : null; } catch { return null; } };
/* CAMPOS_UNIVERSO — los ÚNICOS campos que un universo tipado puede declarar (§7 del comentario de cabecera). UNA
 * SOLA FUENTE (owner 2026-09-26, diagnóstico v4 §3): antes esta lista vivía SOLO dentro de `validarUniverso`, y
 * `entrega/alcance.js:alcanceDeParte` (el compositor que recorta las figs al alcance declarado) traía su PROPIA
 * lectura parcial de estos mismos campos, sin `bodega` — el caso real: una `cifra` acotada a `{eje:"sku",
 * bodega:"Valparaíso"}` servía el inventario COMPLETO porque el compositor nunca leyó ese campo. `alcance.js`
 * importa esta constante (nunca copia la lista) y trae un candado de completitud: si mañana este arreglo gana un
 * campo, el que no lo maneje se entera al cargar el módulo, no en producción. */
export const CAMPOS_UNIVERSO = ["eje", "base", "estados", "no_estados", "bodega", "filtros", "top", "excluir", "union"];
/* §7.3·28 (SUPERVISOR, ley de registro del owner: «la Entrega nunca repite una palabra de la lista de registro
 * prohibida, aunque venga de lo que escribió quien consulta») — un estado sin reconocer (`estadoDeclarado`
 * devuelve null) puede traer, sin culpa, una palabra vetada del registro ejecutivo («dormido», «plata»… X97: un
 * hecho tipo "estado" con estado:"dormido"). Antes, el mensaje citaba `e` TAL CUAL («estado-desconocido: «${e}»
 * …»), y esa cita viajaba intacta hasta `entrega/componer.js:_limitesDeclarados` (`nr.detalle`) — el propio
 * guard de voz (`stripLanguageLeaks`, la MISMA fuente que usa `_registro_gate`/`entrega/verificar.js` para la
 * regla `registro-informal`) la detectaba DESPUÉS y tumbaba la Entrega ENTERA, en vez de nunca haberla dejado
 * entrar. Fuera de la lista, se sigue citando literal (§1.3: «se escribe con su nombre exacto» no cambia);
 * dentro de la lista, se nombra el campo y se ofrecen los estados válidos de la casa — nunca se traduce la
 * palabra (entender el lenguaje es del LLM, CLAUDE.md). */
const _esPalabraDeRegistroProhibida = (s) => { const t = String(s == null ? "" : s); try { return stripLanguageLeaks(t) !== t; } catch { return false; } };
const _mensajeEstadoDesconocido = (e, eje, campo = "estados") => _esPalabraDeRegistroProhibida(e)
  ? `estado-desconocido: el campo «${campo}» trae una palabra que el registro de la casa no usa; los estados válidos son: ${estadosValidosPara(eje).join(", ")}`
  : `estado-desconocido: «${e}» (se escribe con su nombre exacto)`;
export function validarUniverso(u, I, sujeto = null) {
  if (u == null || typeof u === "string") return null;
  if (Array.isArray(u)) return u.every((x) => typeof x === "string" && x.trim()) ? null : "una lista de universo trae nombres de entidades";
  if (!_es(u)) return "el universo es un objeto, un texto o una lista de entidades";
  const raras = Object.keys(u).filter((k) => !CAMPOS_UNIVERSO.includes(k)); if (raras.length) return `universo con campos desconocidos: ${raras.join(", ")}`;
  const eje = normalizar(u.eje || "cliente");
  if (!EJES_VALIDOS.includes(eje)) return `eje desconocido «${u.eje}»`;
  if (I && typeof I.tamanoDelEje === "function" && !I.tamanoDelEje(eje)) return `eje-sin-entidades: la evidencia no trae ${PLURAL_DE_EJE[eje] || eje + "s"}`;
  for (const [campoEstado, listaEstado] of [["estados", _lista(u.estados)], ["no_estados", _lista(u.no_estados)]]) { for (const e of listaEstado) { const c = estadoDeclarado(e); if (!c) return _mensajeEstadoDesconocido(e, eje, campoEstado); const def = estadoDeLaCasa(c); if (!ejeCompatible(def, eje)) return `el estado «${e}» es de ${def.eje}, no de ${eje}`; } }
  if (u.bodega != null && eje !== "sku") return "la bodega solo restringe SKU";
  if (u.filtros != null) { if (!Array.isArray(u.filtros)) return "filtros es una lista"; for (const f of u.filtros) { if (!_es(f) || !f.metrica) return "cada filtro es {metrica, op, valor, unidad}"; const op = opDe(f.op); if (!op) return `op desconocido «${f.op}»`; if (op === "entre") { const v = Array.isArray(f.valor) ? f.valor : [f.valor, f.hasta]; if (!Number.isFinite(+v[0]) || !Number.isFinite(+v[1]) || +v[0] > +v[1]) return "«entre» necesita [desde, hasta] con desde ≤ hasta"; } else if (f.ref == null && !Number.isFinite(+String(f.valor).replace(",", "."))) return `el filtro de ${f.metrica} necesita un valor numérico`; } }
  if (u.top != null) { if (!_es(u.top) || !u.top.metrica) return "top es {metrica, k, direccion}"; if (!_entero(u.top.k) || +u.top.k < 1) return "top.k es un entero ≥ 1"; if (u.top.direccion && !_ENUM.direccion.includes(normalizar(u.top.direccion))) return `direccion desconocida «${u.top.direccion}»`; if (u.top.sobre != null && !_ENUM.sobre.includes(normalizar(u.top.sobre))) return `top.sobre desconocido «${u.top.sobre}» (filtro · eje)`; }
  if (u.excluir != null) { if (!_es(u.excluir)) return "excluir es un objeto"; const rarasX = Object.keys(u.excluir).filter((k) => !["entidades", "conjuntos", "estados", "top", "bodega"].includes(k)); if (rarasX.length) return `excluir con campos desconocidos: ${rarasX.join(", ")}`; if (u.excluir.bodega != null && eje !== "sku") return "la exclusión por bodega solo aplica a SKU"; for (const e of _lista(u.excluir.estados)) { if (!estadoDeclarado(e)) return `estado-desconocido: «${e}»`; } for (const t of _lista(u.excluir.top)) { if (!_es(t) || !t.metrica || !_entero(t.k) || +t.k < 1) return "excluir.top es {metrica, k} con k entero ≥ 1"; } }
  if (u.union != null) { if (!Array.isArray(u.union) || !u.union.every(_es)) return "union es una lista de universos"; for (const v of u.union) { const e = validarUniverso(v, I); if (e) return e; if (!["base", "estados", "no_estados", "bodega", "filtros", "top", "excluir"].some((k) => v[k] != null)) return "una unión con el eje entero no restringe nada"; if (v.eje && normalizar(v.eje) !== eje) return `una unión mezcla ejes (${eje} y ${normalizar(v.eje)})`; } }
  { const est = _lista(u.estados).map((e) => estadoDeclarado(e)).filter(Boolean), noEst = _lista(u.no_estados).map((e) => estadoDeclarado(e)).filter(Boolean), exEst = _lista(u.excluir && u.excluir.estados).map((e) => estadoDeclarado(e)).filter(Boolean);
    if (est.some((c) => noEst.includes(c) || exEst.includes(c))) return "el universo pide y excluye el mismo estado";
    if (est.some((c) => est.includes((complementoDe(c) || COMPLEMENTO_V3[c])))) return "estados contradictorios en el mismo universo";
    if (exEst.some((c) => exEst.includes((complementoDe(c) || COMPLEMENTO_V3[c])))) return "excluir un estado y su complemento deja el eje vacío";
    if (noEst.some((c) => noEst.includes((complementoDe(c) || COMPLEMENTO_V3[c])))) return "quitar un estado y su complemento deja el eje vacío";
    const total = typeof I.tamanoDelEje === "function" ? I.tamanoDelEje(eje) : null;
    for (const t of _lista(u.excluir && u.excluir.top)) if (_es(t) && total && +t.k >= total) return `excluir los ${t.k} de mayor/menor es excluir el eje entero (${total})`;
    for (const e of _lista(u.excluir && u.excluir.entidades)) { const es = _ejeDeEntidad(I, e); if (es && es !== eje) return `«${e}» es de ${es} y el universo es de ${eje}`; } }
  if (u.filtros != null) for (const f of u.filtros) { const c = _claveEstricta(f.metrica); if (!c) return `la métrica «${f.metrica}» del filtro no es una clave de la casa`; const um = unidadDeClave(c); const uf = f.unidad ? String(f.unidad).toLowerCase() : null; if (uf && um && !_unidadCompatibleEstricta(uf, um)) return `unidad «${uf}» no es la de ${c} (${um})`; if (f.ref != null) { const rc = _refDeLaCasa(f.ref); if (rc) { if (!rc.familia.test(c)) return `referencia-ajena: ${rc.nombre} no es la referencia de ${c}`; } else { const cr = _claveEstricta(f.ref); if (!cr) return `la referencia «${f.ref}» no es una referencia ni una clave de la casa`; if (dominioDeClave(cr) && dominioDeClave(c) && dominioDeClave(cr) !== dominioDeClave(c)) return `la referencia ${cr} es de ${dominioDeClave(cr)} y la métrica ${c} de ${dominioDeClave(c)}`; if (unidadDeClave(cr) && um && !_unidadCompatibleEstricta(unidadDeClave(cr), um)) return `la referencia ${cr} (${unidadDeClave(cr)}) no se compara con ${c} (${um})`; } } }
  if (sujeto && typeof sujeto === "string" && sujeto !== "negocio") { const es = _ejeDeEntidad(I, sujeto); if (es && es !== eje) return `el sujeto «${sujeto}» es de ${es} y el universo es de ${eje}`; }
  return null;
}
const EJES_VALIDOS = ["cliente", "sku", "marca", "familia", "bodega", "canal", "mes"];
const _GENERICAS = new Set(["deuda", "saldo", "deuda total", "saldos", "monto", "cifra", "valor"]);
const _claveEstricta = (m) => { const s = normalizar(String(m || "")); if (!s || _GENERICAS.has(s)) return null; const k = claveDeMetrica(m); return k && metricaPorClave(k) ? k : null; };
/* las referencias de la casa y la familia de métricas que comparan: una referencia de otra familia no es un filtro */
const _REF_DE_LA_CASA = [
  { re: /^benchmark(?:[ _]de[ _]margen)?$|^margen[ _]benchmark$/, familia: /^margen/, nombre: "benchmark" },
  { re: /^nivel[ _](?:de[ _])?carga(?:[ _]declarad[oa])?$|^carga[ _]declarada$/, familia: /^carga/, nombre: "nivel_carga" },
  { re: /^umbral(?:[ _]de)?[ _]materialidad$|^materialidad$/, familia: /^(?:ventas|contribucion|no_capturada|brecha|saldo_|abonado|carga_alta)/, nombre: "umbral_materialidad" },
  { re: /^piso(?:[ _]de)?[ _]rotacion$/, familia: /^rotacion/, nombre: "piso_rotacion" },
  { re: /^techo(?:[ _]de)?[ _]cobertura$/, familia: /^(?:dias_inventario|cobertura)/, nombre: "techo_cobertura" },
];
const _refDeLaCasa = (ref) => { const s = normalizar(String(ref || "")).trim(); return _REF_DE_LA_CASA.find((r) => r.re.test(s)) || null; };
const _unidadCompatibleEstricta = (a, b) => { const A = String(a || "").toLowerCase(), B = String(b || "").toLowerCase(); if (A === B) return true; if ((A === "pct" && B === "pp") || (A === "pp" && B === "pct")) return false; const t = /^(?:days|dias|dia|d|semanas?|meses|mes|trimestres?|semestres?|anos?|años?)$/; if (t.test(A) && t.test(B)) return true; return unidadCompatible(A) === unidadCompatible(B); };
export function validarHecho(h, I) {
  const tipo = normalizar(h.tipo);
  const repetidos = (xs) => { const v = xs.map((x) => normalizar(typeof x === "string" ? x : JSON.stringify(x))); return new Set(v).size !== v.length; };
  if (tipo === "orden") { const o = _es(h.orden) ? h.orden : {}; if (!_ENUM.orden_forma.includes(normalizar(o.forma || ""))) return `orden.forma desconocida «${o.forma}»`; if ((normalizar(o.forma) === "min" && normalizar(o.direccion || "") === "mayor") || (normalizar(o.forma) === "max" && normalizar(o.direccion || "") === "menor")) return "forma y dirección contradictorias (min es menor, max es mayor)"; if (/^(?:puesto|topk)$/.test(normalizar(o.forma)) && (!_entero(o.k) || +o.k < 1)) return "orden.k es un entero ≥ 1"; if (o.direccion && !_ENUM.direccion.includes(normalizar(o.direccion))) return `orden.direccion desconocida «${o.direccion}»`; if (Array.isArray(h.sujeto) && repetidos(h.sujeto)) return "sujetos repetidos"; return validarUniverso(h.universo, I, Array.isArray(h.sujeto) ? h.sujeto[0] : h.sujeto); }
  if (tipo === "relacion") { const r = _es(h.relacion) ? h.relacion : {}; if (!_ENUM.relacion_forma.includes(normalizar(r.forma || ""))) return `relacion.forma desconocida «${r.forma}»`; if (Array.isArray(h.sujeto) && repetidos(h.sujeto)) return "sujetos repetidos"; if (_es(r.vs) && Array.isArray(r.vs.grupo) && repetidos(r.vs.grupo)) return "comparados repetidos"; if (r.k != null && !(Number.isFinite(+r.k) && +r.k > 0)) return "relacion.k es un número > 0"; return null; }
  // §1.3 del contrato (supervisor 2026-09-27, diagnóstico v9, hallazgo del autor del catálogo) — un `conteo` SIN
  // `de`/`universo` quedaba aceptado: `validarUniverso(undefined, I)` devuelve `null` (ningún error) cuando el
  // campo ni siquiera se declaró — nunca declinaba con «esquema mal formado». Pero un conteo («K de M») no tiene
  // sentido sin decir DE QUÉ conjunto — el contrato lo exige como campo del hecho tipado (§1.3: «de/universo
  // tipado»), la MISMA ley que ya hace obligatorio el universo en `grupo`/`orden` (líneas de arriba, esta misma
  // función). Se sigue el contrato: sin universo, el conteo está mal formado.
  if (tipo === "conteo") { const c = _es(h.conteo) ? h.conteo : h; if (!_entero(c.n) || +c.n < 0) return "conteo.n es un entero ≥ 0"; if (c.m != null && (!_entero(c.m) || +c.m < +c.n)) return "conteo.m es un entero ≥ n"; if (h.de == null && h.universo == null) return "conteo.de (o universo) es obligatorio: un conteo sin universo no dice de qué conjunto"; return validarUniverso(h.de != null ? h.de : h.universo, I); }
  if (tipo === "variacion") { const v = _es(h.variacion) ? h.variacion : {}; if (v.direccion && !_ENUM.variacion_dir.includes(normalizar(v.direccion))) return `variacion.direccion desconocida «${v.direccion}»`; if (h.periodo && !/^(?:anterior|presupuesto|actual)$/.test(periodoDe(h.periodo))) return `periodo desconocido «${h.periodo}»`; return null; }
  if (tipo === "estado") { const e = _sinNo(_es(h.estado) ? h.estado.estado : h.estado); const sujetosEstado = _lista(h.sujeto); const ejeEstadoGuess = sujetosEstado.map((s) => _ejeDeEntidad(I, s)).find(Boolean) || null; const c = estadoDeclarado(e); if (!c) return _mensajeEstadoDesconocido(e, ejeEstadoGuess, "estado"); const def = estadoDeLaCasa(c); const sujetos = sujetosEstado; for (const s of sujetos) { const es = _ejeDeEntidad(I, s); if (es && !ejeCompatible(def, es)) return `el estado «${e}» es de ${def.eje} y «${s}» es de ${es}`; } const bodega = _es(h.estado) ? h.estado.bodega : h.bodega; if (bodega && sujetos.some((s) => _ejeDeEntidad(I, s) && _ejeDeEntidad(I, s) !== "sku")) return "la bodega solo acompaña a un SKU"; return null; }
  if (tipo === "razon") { if (h.valor != null) { const v = leerValor(h.valor); if (v && Number.isFinite(v.raw) && (!/^(?:pct|ratio|count)$/.test(v.unidad || "count") || /(?:unidades?|d[ií]as?|\$|\bpp\b|puntos|k\b|m\b)/i.test(String(h.valor)))) return `una razón es una proporción: «${h.valor}» no es un porcentaje ni un cociente`; } const nk = _es(h.num) && h.num.metrica != null ? _claveEstricta(h.num.metrica) : null, dk = _es(h.den) && h.den.metrica != null ? _claveEstricta(h.den.metrica) : null; if (_es(h.num) && h.num.metrica != null && !nk) return `la métrica «${h.num.metrica}» del numerador no es una clave de la casa`; if (_es(h.den) && h.den.metrica != null && !dk) return `la métrica «${h.den.metrica}» del denominador no es una clave de la casa`; if (nk && dk && unidadDeClave(nk) && unidadDeClave(dk) && !_unidadCompatibleEstricta(unidadDeClave(nk), unidadDeClave(dk))) return `unidades-distintas: ${nk} (${unidadDeClave(nk)}) no se divide por ${dk} (${unidadDeClave(dk)})`; return null; }
  if (tipo === "derivada") { const op = normalizar(h.op || ""); if (!_ENUM.op.includes(op)) return `derivada.op desconocida «${h.op}»`; const de = _lista(h.de); if (de.length < 2) return "derivada.de necesita al menos dos operandos"; if (repetidos(de)) return "operandos repetidos"; return null; }
  if (tipo === "grupo") { const m = _lista(h.miembros).length ? _lista(h.miembros) : _lista(h.sujeto); if (repetidos(m)) return "miembros repetidos"; { const ejesM = [...new Set(m.map((x) => _ejeDeEntidad(I, x)).filter(Boolean))]; if (ejesM.length > 1) return `miembros de ejes distintos (${ejesM.join(", ")}) no forman un grupo`; } if (h.agregado && !_ENUM.agregado.includes(normalizar(h.agregado))) return `agregado desconocido «${h.agregado}»`; return validarUniverso(h.universo, I); }
  if (tipo === "cifra") { if (h.universo != null && typeof h.universo !== "string") { const e = validarUniverso(h.universo, I, h.sujeto); if (e) return e; } return null; }
  return null;
}

/* ═══ LA VERDAD PROPIA DE UNA ENTIDAD (decisión 37a, supervisor 2026-09-29, diagnóstico v13 — A2 + A3) ═══════════════════════════════════════════════
 * Cuando una premisa de GRUPO sobre UNA entidad sale falsa, la oración que la Entrega imprime tiene que decir la verdad con su DUEÑO: quién es la entidad, su cifra PROPIA de
 * la métrica que define el universo (nunca la de otra métrica: «capital 12 días» era el 12 de sus días sin venta), su PUESTO real cuando el universo es un top (o una exclusión por
 * top), y —si el universo la excluye por un estado de la Mesa Capital o de cobranza— el estado en que SÍ está. Antes, sin cifra en la boleta, esa oración caía a la traza de
 * depuración del Notario («estados «capital sano»», «capital_frenado > $0 (2)», «los 1 de mayor»): sin dueño, con claves internas y con el `k` del top.
 * Se arma UNA vez, acá, desde la ESTRUCTURA del universo tipado y las mismas primitivas del Notario (`conjuntoDeUniverso` para los estados, `rankingDeTop` para el puesto,
 * `_figDe`/`valorDeRanking` para la cifra): `H.render.verdadPropia`; `entrega/componer.js:_rotuloDeLaCasaDeH` solo la escribe. Sin nada que decir con certeza, devuelve null y
 * quien pregunta cae al texto de siempre — nunca inventa. */
function _clausulasDeEstado(u, acc = []) {
  if (!_es(u)) return acc;
  for (const e of _lista(u.estados)) { const c = estadoDeclarado(String(e).replace(/_/g, " ")) || _canonDe(e); if (ESTADOS_CANON.has(c)) acc.push({ canon: c, modo: "en" }); }
  if (typeof u.base === "string") { const c = estadoDeclarado(u.base) || estadoDeConjunto(u.base); if (c && ESTADOS_CANON.has(c)) acc.push({ canon: c, modo: "en" }); }   /* §7.3·40(a) (v17): un conjunto que ES un estado también como BASE */
  for (const e of _lista(u.no_estados)) { const c = estadoDeclarado(String(e).replace(/_/g, " ")) || _canonDe(e); if (ESTADOS_CANON.has(c)) acc.push({ canon: c, modo: "no" }); }
  if (_es(u.excluir)) for (const e of _lista(u.excluir.estados)) { const c = estadoDeclarado(String(e).replace(/_/g, " ")) || _canonDe(e); if (ESTADOS_CANON.has(c)) acc.push({ canon: c, modo: "excluir" }); }
  /* §7.3·39(d): un conjunto de la casa que ES un estado con otro nombre («con saldo vencido» = en mora) y se EXCLUYE dice en qué estado SÍ está la entidad; el mismo `estadoDeclarado` que resuelve un `base` (sin tabla aparte) */
  if (_es(u.excluir)) for (const n of _lista(u.excluir.conjuntos)) { const c = estadoDeclarado(String(n)) || estadoDeConjunto(n); if (c && ESTADOS_CANON.has(c)) acc.push({ canon: c, modo: "excluir" }); }
  for (const v of _lista(u.union)) _clausulasDeEstado(v, acc);
  return acc;
}
function _primerFiltroDe(u) {
  if (!_es(u)) return null;
  const f = (Array.isArray(u.filtros) ? u.filtros : []).find((x) => _es(x) && x.metrica);
  if (f) return f;
  for (const v of _lista(u.union)) { const g = _primerFiltroDe(v); if (g) return g; }
  return null;
}
const _claveDeMetricaDeUniverso = (m) => claveDeMetrica(m) || normalizar(String(m || "")).replace(/\s+/g, "_");
/* la cifra propia de la entidad en una métrica: su fig de la boleta (impresa como la boleta la trae) o, sin ella, la del ranking de la proyección con el formato de la casa;
 * en una métrica cuya fuente DECLARA cubrir a su grupo (`coberturaDeFuentes.js`, §7.3·52b) que la proyección no publica para ella, cero de cobertura declarada (no un hueco); sin ninguna de las dos, dato ausente */
function _cifraPropia(I, nombre, clave) {
  /* §7.3·13/·40: el margen de VENTA del SKU vive SOLO en el ranking estático `I.rankings.sku.margen_venta` (no está en el léxico: el SKU tiene dos márgenes y la casa exige la etiqueta completa) — se lee por su nombre exacto */
  if (clave === "margen_venta") {
    const ent = I.resolverEntidad(nombre);
    const Rk = ent && I.rankings && I.rankings[ent.eje] ? I.rankings[ent.eje].margen_venta : null;
    const fila = Rk && Array.isArray(Rk.filas) ? Rk.filas.find((x) => normalizar(x.entidad) === normalizar(ent.nombre)) : null;
    if (fila && Number.isFinite(+fila.valor)) return { raw: +fila.valor, unidad: "pct", texto: formatoDeLaCasa(+fila.valor, "pct") };
  }
  const f = _figDe(I, nombre, clave);
  /* el dinero se dice con el formato de la casa (`$13K`), no como lo escribió el emisor de la boleta (`$12800`): una sola redacción para la misma cifra (colateral del diagnóstico v13); el porcentaje también (§7.3·40b) */
  if (f && Number.isFinite(f.raw)) return { raw: f.raw, unidad: f.unidad, texto: f.unidad === "money" ? formatoDeLaCasa(f.raw, "money") : textoDeLaCasa(f.raw, f.unidad, f.texto || (f.fig && String(f.fig.value))) || formatoDeLaCasa(f.raw, f.unidad) };
  const rk = valorDeRanking({ sujeto: nombre, metrica: clave }, I);
  if (rk && Number.isFinite(rk.raw)) return { raw: rk.raw, unidad: rk.unidad, texto: formatoDeLaCasa(rk.raw, rk.unidad) };
  /* `ausente`: el cero NO es una cifra medida sobre la entidad, es que no pertenece al conjunto que la métrica define (§7.3·38a: se dice en palabras de negocio, nunca «(ausente = 0)») */
  if (ceroPorCobertura(clave, (I.resolverEntidad && I.resolverEntidad(nombre) || {}).eje || null)) { const un = unidadDeClave(clave) || "money"; return { raw: 0, unidad: un, texto: formatoDeLaCasa(0, un), ausente: true }; }
  return null;
}
/* DECISIÓN 38(a) (supervisor 2026-09-29, diagnóstico v14 · A3): la 37(a) vale para TODA premisa falsa, en el MISMO registro que el grupo (`H.render.verdadPropia`; `componer.js` solo lo escribe).
 * ORDEN: la entidad, su cifra propia de la métrica pedida, su PUESTO real (`puestoDeOrden`, la misma cuenta que `_orden`) y quién ocupa el puesto afirmado con su cifra; en un comparativo, las
 * dos cifras. RELACIÓN: las dos cifras con su dueño. Una cifra 0 por ausencia lleva `ausente` (se dice «no tiene …»). Nunca claves internas ni el `k` del top como cifra. */
function _metricaPropia(I, nombre, clave) {
  const cifra = clave ? _cifraPropia(I, nombre, clave) : null;
  if (!cifra) return null;
  const m = metricaPorClave(clave);
  return { clave, nombre: (m ? m.nombre : (nombreDeMetricaDeReferencia(clave) || metricaDeClave(clave))).toLowerCase(), raw: cifra.raw, unidad: cifra.unidad, texto: cifra.texto, ...(cifra.ausente ? { ausente: true } : {}) };
}
/* v20 (§7.3·44a): una premisa de PERTENENCIA a un top cuyo filo cae DENTRO de un empate, sobre un empatado del filo, es verdadera y DECLARA el empate: `{ n (el puesto compartido), sujetos, entidades (todos los empatados del filo) }`.
 * Del `orden` topk (la cuenta de `puestoDeOrden`, la misma que el veredicto) y del `grupo` sobre un universo con `top` (`empateEnElFilo` de `conjuntoDeUniverso`, la misma cuenta que eligió al conjunto). Sin empate en el filo: null (un empate dentro del top no se declara: el corte no lo parte). */
function _empateFiloDeOrden(h, I) {
  const o = _es(h.orden) ? h.orden : {};
  if (normalizar(String(o.forma || "")) !== "topk" || !_entero(o.k)) return null;
  const sujeto = _sujetoUnico(h.sujeto);
  const ent = sujeto ? I.resolverEntidad(sujeto) : null;
  if (!ent) return null;
  let po = null; try { po = puestoDeOrden(_aV2(h, I), I); } catch { po = null; }
  if (!po || !Array.isArray(po.empatadoCon) || !po.empatadoCon.length) return null;
  const k = +o.k;
  if (!(po.n <= k && po.n + po.empatadoCon.length > k)) return null;
  /* v24 (Q05, §7.3·44a + 46f): la pertenencia del empatado lleva SU cifra propia de la métrica del top (o su cero, en palabras de negocio y con su cifra, medido o por ausencia) aunque la boleta no publique una fig para él: sin ella el rótulo caía a la traza del ranking («Valparaíso ($25K) · Antofagasta ($8K) · Santiago (0)») sin decir el empate */
  const mp = _metricaPropia(I, ent.nombre, _claveDeMetricaDeUniverso(h.metrica));
  return { n: po.n, sujetos: [ent.nombre], entidades: [ent.nombre, ...po.empatadoCon], ...(mp ? { propia: { nombre: mp.nombre, texto: mp.texto, raw: mp.raw, unidad: mp.unidad, ...(mp.ausente ? { ausente: true } : {}) } } : {}), ...(mp && mp.raw === 0 ? { cero: { nombre: mp.nombre, texto: mp.texto } } : {}) };
}
function _empateFiloDeGrupo(h, I, nombres) {
  const u = _es(h.universo) ? h.universo : null;
  if (!u || !u.top) return null;
  let U = null; try { U = conjuntoDeUniverso(u, I, u.eje || null, ""); } catch { U = null; }
  const e = U && U.empateEnElFilo;
  if (!e || !Array.isArray(e.nombres)) return null;
  const propios = nombres.filter((n) => e.nombres.some((x) => normalizar(x) === normalizar(n)));
  /* v22 (S03 · S04, §7.3·39c «un cero se dice junto a su cifra, medido o por ausencia del conjunto»): si el empate del filo es en CERO, la pertenencia lo dice con su cifra: «no tiene capital inmovilizado crítico ($0)» — sin ella, el «pertenece a los 4 de mayor …» leía como si el empatado tuviera algo. */
  let cero = null;
  if (propios.length && e.valor === 0) { const mp = _metricaPropia(I, propios[0], _claveDeMetricaDeUniverso(u.top.metrica)); if (mp && mp.raw === 0) cero = { nombre: mp.nombre, texto: mp.texto }; }
  return propios.length ? { n: e.puesto, sujetos: propios, entidades: e.nombres, ...(cero ? { cero } : {}) } : null;
}
const _sujetoUnico = (s) => { const x = Array.isArray(s) ? (s.length === 1 ? s[0] : null) : s; return typeof x === "string" && x !== "negocio" ? x : null; };
function _verdadPropiaDeOrden(h, H, I) {
  const sujeto = _sujetoUnico(h.sujeto);
  const ent = sujeto ? I.resolverEntidad(sujeto) : null;
  if (!ent) return null;
  const clave = _claveDeMetricaDeUniverso(h.metrica);
  const metrica = _metricaPropia(I, ent.nombre, clave);
  if (!metrica) return null;
  const o = _es(h.orden) ? h.orden : {};
  const base = { entidad: ent.nombre, eje: normalizar(ent.eje || ""), estado: null, metrica, puesto: null };
  if (normalizar(String(o.forma || "")) === "comparativo") {
    const vs = _sujetoUnico(o.vs) ? I.resolverEntidad(o.vs) : null;
    const mv = vs ? _metricaPropia(I, vs.nombre, clave) : null;
    return mv ? { ...base, contra: { entidad: vs.nombre, metrica: mv } } : null;
  }
  let po = null;
  try { po = puestoDeOrden(_aV2(h, I), I); } catch { po = null; }
  if (!po) return base;
  const ocupantes = po.afirmado.filter((n) => normalizar(n) !== normalizar(ent.nombre)).map((n) => ({ entidad: n, metrica: _metricaPropia(I, n, clave) }));
  return { ...base, puesto: { n: po.n, de: po.de, dir: po.dir, ...(Array.isArray(po.empatadoCon) && po.empatadoCon.length ? { empatadoCon: po.empatadoCon } : {}) }, ...(ocupantes.length ? { ocupantes } : {}) };
}
/* §7.3·37a/38a/39(b): la premisa `cifra` FALSA dice la entidad con SU cifra en ESA clave —en el mismo registro que el orden y la relación—, nunca la cifra errónea del usuario */
function _verdadPropiaDeCifra(h, H, I) {
  const sujeto = _sujetoUnico(h.sujeto);
  const ent = sujeto ? I.resolverEntidad(sujeto) : null;
  if (!ent) return null;
  const metrica = _metricaPropia(I, ent.nombre, _claveDeMetricaDeUniverso(h.metrica));
  return metrica ? { entidad: ent.nombre, eje: normalizar(ent.eje || ""), estado: null, metrica, puesto: null } : null;
}
function _verdadPropiaDeRelacion(h, H, I) {
  const r = _es(h.relacion) ? h.relacion : {};
  const sujeto = _sujetoUnico(h.sujeto);
  const vsCrudo = r.vs != null ? r.vs : h.vs;   // el mismo alias que `_aV2`
  const vsSujeto = _sujetoUnico(_es(vsCrudo) ? (vsCrudo.sujeto != null ? vsCrudo.sujeto : vsCrudo.grupo) : vsCrudo);
  const a = sujeto ? I.resolverEntidad(sujeto) : null, b = vsSujeto ? I.resolverEntidad(vsSujeto) : null;
  if (!a || !b) return null;
  const clave = _claveDeMetricaDeUniverso(h.metrica);
  const claveB = _es(vsCrudo) && vsCrudo.metrica ? _claveDeMetricaDeUniverso(vsCrudo.metrica) : clave;
  const ma = _metricaPropia(I, a.nombre, clave), mb = _metricaPropia(I, b.nombre, claveB);
  if (!ma || !mb) return null;
  return { entidad: a.nombre, eje: normalizar(a.eje || ""), estado: null, metrica: ma, puesto: null, contra: { entidad: b.nombre, metrica: mb } };
}
/* §7.3·37a/40a (diagnóstico v17): la verdad propia de UN miembro que el universo deja fuera. Se separa de `_verdadPropiaDeGrupo` para que una premisa de VARIOS miembros diga la verdad de CADA uno que falla
 * (antes, con más de un sujeto devolvía null y el veredicto caía a la traza del Notario: «fuera de carga comercial alta…» sin entidad ni cifra). */
/* v19 (Y74 · Y33): un SKU que el universo deja fuera porque la consulta EXCLUYE su bodega (`excluir.bodega`) dice esa bodega —la razón—, sin cifra ni puesto (una cifra suya de otra métrica leería como si el universo la incluyera: la misma
 * razón que la exclusión por nombre). Solo si la bodega ES lo que la deja fuera: entra en el universo SIN la exclusión de bodega y sale con ella. Devuelve el nombre de la bodega (la de la entidad, entre las excluidas) o null. */
function _excluidaPorBodega(u, ent, key, eje, I) {
  if (!_es(u.excluir)) return null;
  const bodegas = _lista(u.excluir.bodega).map((b) => String(b)).filter(Boolean);
  if (!bodegas.length) return null;
  const ex = { ...u.excluir }; delete ex.bodega;
  const uSin = { ...u }; if (Object.keys(ex).length) uSin.excluir = ex; else delete uSin.excluir;
  let A = null, B = null;
  try { A = conjuntoDeUniverso(uSin, I, eje, ""); B = conjuntoDeUniverso(u, I, eje, ""); } catch { return null; }
  if (!A || A.error || !B || B.error || !B.set) return null;
  if (A.set && !A.set.has(key)) return null;
  if (B.set.has(key)) return null;
  let propias = new Set(); try { propias = new Set((I.estadosDe(ent.nombre) || []).map((x) => normalizar(x && x.bodega ? x.bodega : "")).filter(Boolean)); } catch { propias = new Set(); }
  const dela = bodegas.filter((b) => propias.has(normalizar(b)));
  return (dela.length ? dela : bodegas).join(" y ");
}
/* v20 (U62, §7.3·37a): el mismo caso con la bodega PEDIDA (`universo.bodega`: «los de Santiago»): un SKU que entra al universo sin la condición de bodega y sale con ella lo deja fuera SU bodega, y esa es la razón real. Sin esto la verdad decía «capital $14K, puesto 3 de 13»
 * del SKU que la 41(c) no cubre —su puesto está DENTRO del top, no fuera—, y leía como si el grupo lo incluyera. Devuelve { propia, pedida } o null. */
function _fueraPorBodegaPedida(u, ent, key, eje, I) {
  const pedidas = _lista(u.bodega).map((b) => String(b)).filter(Boolean);
  if (!pedidas.length) return null;
  const uSin = { ...u }; delete uSin.bodega;
  let A = null, B = null;
  try { A = conjuntoDeUniverso(uSin, I, eje, ""); B = conjuntoDeUniverso(u, I, eje, ""); } catch { return null; }
  /* v22 (S67): sin nada más que la bodega, el universo sin ella es el EJE ENTERO (`set: null`): toda entidad del eje entra, y la deja fuera su bodega. Antes `!A.set` devolvía null y la verdad caía a «en Antofagasta.» sin entidad ni bodega propia. */
  if (!A || A.error || !B || B.error || !B.set) return null;
  if ((A.set && !A.set.has(key)) || B.set.has(key)) return null;
  let propias = []; try { propias = [...new Set((I.estadosDe(ent.nombre) || []).map((x) => (x && x.bodega ? String(x.bodega) : "")).filter(Boolean))]; } catch { propias = []; }
  if (!propias.length) return null;
  return { propia: propias.join(" y "), pedida: pedidas.join(" y ") };
}
/* v19: el texto de la referencia de la casa que un conjunto o un filtro pone en juego («benchmark de margen 30.1%»): la misma tabla y la misma función que el veredicto (`valorDeReferencia` / `formatoDeReferencia`), nunca una segunda cifra */
function _textoDeReferenciaDeCasa(concepto, I) {
  if (!concepto) return null;
  const r = valorDeReferencia(concepto, I);
  if (!r || !Number.isFinite(r.raw)) return null;
  const m = metricaPorClave(concepto);
  return `${m ? m.nombre.toLowerCase() : concepto} ${formatoDeReferencia(r.raw, r.unidad || unidadDeClave(concepto) || "pct")}`;
}
/* v19 (Y10 · Y11 · Y14 · Y41, §7.3·37a): LA razón por la que un miembro queda fuera de UN universo simple —la condición que la entidad NO cumple, con la métrica de ESA condición—. Antes, la métrica salía de una precedencia fija
 * (top > exclusión > primer filtro > conjunto > base > estado) que nombraba una condición que la entidad SÍ cumple: el top cuando el que la sacó fue el estado (Y41: «capital $19K» de un SKU que vendió al corte), el primer filtro
 * aunque lo pasara (Y14: «carga 3.9 %» de una cuenta que sale por el benchmark) o la base que sí cumplía (Y11: «margen 22 %» de un SKU que sale por rotar bien). Se evalúa cada condición contra la entidad con las MISMAS primitivas del
 * Notario (`conjuntoDeUniverso`, `rankingDeTop`); la que falla decide. Sin nada evaluable cae a la precedencia de siempre. */
function _razonDeMiembro(u, ent, key, eje, I) {
  // (1) los estados del universo que la entidad NO cumple (fuera de un «en», dentro de un «no» o de una exclusión)
  const falla = [];
  const clausulas = _clausulasDeEstado(u);
  for (const c of clausulas) {
    let S = null; try { S = conjuntoDeUniverso({ eje, estados: [c.canon] }, I, eje, ""); } catch { S = null; }
    if (!S || S.error || !S.set) continue;
    if (c.modo === "en" ? !S.set.has(key) : S.set.has(key)) falla.push(c);
  }
  // (2) su estado PROPIO, cuando el estado que falló es de los que se explican diciendo en cuál SÍ está (Mesa Capital · cobranza)
  const fam = ESTADOS_PROPIOS[eje];
  let estado = null;
  if (fam && falla.some((c) => fam.familia.includes(c.canon))) {
    if (eje === "sku") { const propios = I.estadosDe(ent.nombre).map((x) => estadoCanon(x.estado)); const c = fam.orden.find((x) => propios.includes(x)); if (c) estado = { canon: c, texto: formaDeEstado(c).singular }; }
    else for (const c of fam.orden) { let r = null; try { r = verificarEstadoDeLaCasa(c, I, ent.nombre); } catch { r = null; } if (r && typeof r === "object" && r.ok) { estado = { canon: c, texto: formaDeEstado(c).singular }; break; } }
  }
  // (3) la métrica que define el universo: la de la condición que la entidad NO cumple
  const exTop = _es(u.excluir) ? _lista(u.excluir.top).find((t) => _es(t) && t.metrica) : null;
  const filtros = (Array.isArray(u.filtros) ? u.filtros : []).filter((x) => _es(x) && x.metrica);
  /* el filtro que la entidad NO pasa (v19): cada uno contra el eje, con la misma primitiva; si ninguno es evaluable, el primero de siempre */
  let fF = null, fFSinEvaluar = null;
  for (const f of filtros) {
    let S = null; try { S = conjuntoDeUniverso({ eje, filtros: [f] }, I, eje, ""); } catch { S = null; }
    if (!S || S.error || !S.set) { if (!fFSinEvaluar) fFSinEvaluar = f; continue; }
    if (!S.set.has(key)) { fF = f; break; }
  }
  if (!fF && fFSinEvaluar) fF = fFSinEvaluar;
  if (!fF && !filtros.length) fF = _primerFiltroDe(u);   /* filtros dentro de una unión: el de siempre */
  const fBase = typeof u.base === "string" ? referenciaDeBase(u.base) : null;
  /* §7.3·40(a) (diagnóstico v16): un conjunto con REFERENCIA numérica que el universo EXCLUYE (o exige como base) y que la entidad NO cumple es el que la deja fuera: su métrica es la de esa referencia
   * («carga comercial alta» → su carga; «SKU bajo el benchmark» → su margen de venta), no la de otro conjunto que la entidad sí cumple */
  let fRef = null, baseSinEvaluar = false;
  {
    const cands = [];
    if (typeof u.base === "string") { const fam2 = referenciaDeBase(u.base); if (fam2) cands.push({ fam: fam2, modo: "en", nombre: u.base }); }
    if (_es(u.excluir)) for (const n of _lista(u.excluir.conjuntos)) { const fam2 = referenciaDeBase(String(n)); if (fam2) cands.push({ fam: fam2, modo: "excluir", nombre: String(n) }); }
    for (const c of cands) {
      let S = null; try { S = conjuntoDeUniverso({ eje, base: c.nombre }, I, eje, ""); } catch { S = null; }
      if (!S || S.error || !S.set) { baseSinEvaluar = true; continue; }
      if (c.modo === "en" ? !S.set.has(key) : S.set.has(key)) { fRef = c.fam; break; }
    }
  }
  /* §7.3·40(a) (diagnóstico v17): con `top` y un conjunto excluido, si la entidad ESTÁ dentro del top el top NO la dejó fuera: la dejó fuera el conjunto, y la verdad es la cifra del conjunto (su carga, su margen), sin un «puesto 4 de 13» que
   * leería como si la premisa fuera cierta. Fuera del top, el puesto sigue siendo la razón verdadera. */
  const rkTop = u.top ? rankingDeTop(u, I, eje) : null;
  const iTop = rkTop ? rkTop.orden.indexOf(key) : -1;
  const dentroDelTop = !!(rkTop && iTop >= 0 && rkTop.k != null && iTop + 1 <= rkTop.k);
  /* v19 (Y41): el top se calcula DENTRO del conjunto ya filtrado (§7.3·8): una entidad que no está en ese ranking no la sacó el top sino la condición previa (estado, base, filtro, bodega) */
  const preTop = ["base", "estados", "no_estados", "bodega", "filtros"].some((c) => u[c] != null);
  const fueraPorLaCondicionPrevia = !!(u.top && rkTop && iTop < 0 && preTop && normalizar(u.top.sobre) !== "eje");
  let clave = null, refConcepto = null;
  let dentroDelExTop = false;
  if (exTop && !u.top) { let ST = null; try { ST = conjuntoDeUniverso({ eje, top: { metrica: exTop.metrica, k: exTop.k, ...(exTop.direccion ? { direccion: exTop.direccion } : {}), sobre: "eje" } }, I, eje, ""); } catch { ST = null; } dentroDelExTop = !!(ST && !ST.error && ST.set && ST.set.has(key)); }
  else dentroDelExTop = !!exTop;   /* con `top` propio y `excluir.top`, la precedencia de siempre no cambia */
  /* v21 (T46, §7.3·41c): con `top` SOBRE EL EJE y un ESTADO que la entidad no cumple («de las 3 que más venden, las al día»), si ESTÁ dentro del top el top NO la dejó fuera: la dejó fuera el estado, y su verdad es la cifra de ese estado («está en mora, saldo vencido $2.5M»), sin un «venta $19.4M, puesto 1 de 13» que leería como si estuviera adentro. Es la misma razón que ya rige para un conjunto con referencia (arriba) */
  const _estadoQueFalla = falla.find((c) => METRICA_DE_ESTADO[c.canon]);
  if (fRef && dentroDelTop) { clave = fRef.metrica; refConcepto = fRef.concepto; }
  else if (dentroDelTop && _estadoQueFalla && !fF) { clave = METRICA_DE_ESTADO[_estadoQueFalla.canon]; }
  else if (u.top && u.top.metrica && !fueraPorLaCondicionPrevia) clave = _claveDeMetricaDeUniverso(u.top.metrica);
  else if (exTop && dentroDelExTop) clave = _claveDeMetricaDeUniverso(exTop.metrica);   /* v22 (S42): el `excluir.top` es la razón SOLO si la entidad ESTÁ en ese top (sobre el eje entero); si no, la deja fuera otra condición (la base, el filtro, el estado) y esa es la cifra */
  else if (fF) { clave = _claveDeMetricaDeUniverso(fF.metrica); if (fF.ref) refConcepto = fF.ref; }
  else if (fRef) { clave = fRef.metrica; refConcepto = fRef.concepto; }   /* el conjunto que la deja fuera antes que la base que sí cumple (v17: «base carga alta» + «excluir bajo el benchmark») */
  else if (fBase && baseSinEvaluar) { clave = fBase.metrica; refConcepto = fBase.concepto; }   /* v19: la base solo si no se pudo evaluar: una base que la entidad SÍ cumple no es lo que la deja fuera */
  else { const c = (falla.length ? falla : clausulas).find((x) => METRICA_DE_ESTADO[x.canon]); if (c) clave = METRICA_DE_ESTADO[c.canon]; }
  const cifra = clave ? _cifraPropia(I, ent.nombre, clave) : null;
  const m = clave ? metricaPorClave(clave) : null;
  const metrica = cifra ? { clave, nombre: (m ? m.nombre : (nombreDeMetricaDeReferencia(clave) || metricaDeClave(clave))).toLowerCase(), raw: cifra.raw, unidad: cifra.unidad, texto: cifra.texto } : null;
  // (4) su PUESTO en el ranking que el top ordena, en la dirección del top (solo si es miembro de ese ranking; nunca el `k`)
  let puesto = null;
  /* v18 (X46 · X83): los EMPATES comparten el puesto (la misma regla que `_ordenar` para el orden: el puesto de un empatado es el del primero de su grupo) y se DICEN: «puesto 4 de 6 …, empatado con Falabella y Paris». Antes, la posición dentro de la lista ordenada
   * (un desempate que el usuario no puede ver) decía «puesto 5 de 6» para una cuenta empatada en 4-6. El valor de cada fila es el de `_topTipado` (la misma cuenta que eligió al conjunto). */
  if (metrica && (u.top || exTop)) {
    const rk = rankingDeTop(u, I, eje);
    if (rk && rk.clave === clave) {
      const i = rk.orden.indexOf(key);
      if (i >= 0) {
        puesto = { n: i + 1, de: rk.orden.length, dir: rk.dir };
        const filas = Array.isArray(rk.filas) ? rk.filas : [];
        const propia = filas.find((x) => x && x.entidad === key);
        const iguales = propia && Number.isFinite(propia.raw) ? filas.filter((x) => x && x.raw === propia.raw) : [];
        if (iguales.length > 1) puesto = { n: filas.indexOf(iguales[0]) + 1, de: rk.orden.length, dir: rk.dir, empatadoCon: iguales.filter((x) => x.entidad !== key).map((x) => x.nombre || x.entidad) };
      }
    }
  }
  if (!metrica && !estado) return null;
  const referencia = refConcepto ? _textoDeReferenciaDeCasa(refConcepto, I) : null;
  return { entidad: ent.nombre, eje, estado, metrica, puesto, ...(referencia ? { referencia } : {}) };
}
function _verdadPropiaDeMiembro(u, nombre, I) {
  const ent = I.resolverEntidad(nombre);
  if (!ent) return null;
  const eje = normalizar(ent.eje || u.eje || "");
  const key = normalizar(ent.nombre);
  // (0) la CONSULTA la excluyó por su nombre (`excluir.entidades`): esa es la razón, sin cifra ni puesto (una cifra suya de otra métrica leería como si el universo la incluyera)
  if (_es(u.excluir) && _lista(u.excluir.entidades).some((n) => { const r = I.resolverEntidad(String(n)); return normalizar(r ? r.nombre : String(n)) === key; })) return { entidad: ent.nombre, eje, estado: null, metrica: null, puesto: null, excluidaPorLaConsulta: true };
  // (0b) v19: la CONSULTA excluyó su bodega: esa es la razón (con el nombre de la bodega)
  { const b = _excluidaPorBodega(u, ent, key, eje, I); if (b) return { entidad: ent.nombre, eje, estado: null, metrica: null, puesto: null, excluidaPorBodega: b }; }
  // (0c) v20: la CONSULTA pidió una bodega y la del SKU es otra: esa es la razón (con su bodega y la pedida)
  { const b = _fueraPorBodegaPedida(u, ent, key, eje, I); if (b) return { entidad: ent.nombre, eje, estado: null, metrica: null, puesto: null, fueraPorBodegaPedida: b }; }
  /* v19 (Y10): una UNIÓN pura («sobre el benchmark O sobre el nivel declarado de carga») deja fuera a quien no cumple NINGUNA rama: la verdad dice, por cada rama, la cifra de la condición que falla y su referencia (antes no decía nada y caía a la traza del Notario) */
  const ramas = _lista(u.union).filter(_es);
  if (ramas.length && !["base", "estados", "no_estados", "bodega", "top"].some((c) => u[c] != null) && !(Array.isArray(u.filtros) && u.filtros.length)) {
    const rs = [];
    for (const v of ramas) { const r = _razonDeMiembro({ ...v, eje: v.eje || u.eje }, ent, key, eje, I); if (r) rs.push(r); }
    if (!rs.length) return null;
    /* el estado PROPIO de la entidad (la rama de estado lo trae: «está al día») no se pierde aunque la primera rama sea un conjunto */
    const estadoUnion = rs.map((r) => r.estado).find(Boolean) || null;
    const cabeza = { ...rs[0], estado: rs[0].estado || estadoUnion };
    const claves = new Set(cabeza.metrica ? [cabeza.metrica.clave] : []);
    const otras = [];
    const refs = [];
    for (const r of rs) {
      if (r.metrica && !claves.has(r.metrica.clave)) { claves.add(r.metrica.clave); otras.push(r.metrica); }
      if (r.referencia && !refs.includes(r.referencia)) refs.push(r.referencia);
    }
    return { ...cabeza, ...(otras.length ? { otras } : {}), ...(refs.length ? { referencia: refs.join(", ") } : {}) };
  }
  return _razonDeMiembro(u, ent, key, eje, I);
}
function _verdadPropiaDeGrupo(h, H, I) {
  const u = h.universo;
  if (!_es(u) || !H.roles.sujetos.length || H.roles.sujetos.includes("negocio")) return null;
  if (H.roles.sujetos.length === 1) return _verdadPropiaDeMiembro(u, H.roles.sujetos[0], I);
  /* varios miembros: cada uno que el universo deja fuera dice SU verdad con su dueño (los que sí están dentro no se nombran) */
  const ej = normalizar(u.eje || "");
  let S = null; try { S = conjuntoDeUniverso(u, I, ej, ""); } catch { S = null; }
  if (!S || S.error || !S.set) return null;
  const lista = [];
  for (const nombre of H.roles.sujetos) {
    const ent = I.resolverEntidad(nombre);
    if (!ent || S.set.has(normalizar(ent.nombre))) continue;
    const vp = _verdadPropiaDeMiembro(u, nombre, I);
    if (vp) lista.push(vp); else return null;   /* una verdad que no se puede decir con dueño → cae al texto de siempre, nunca a medias */
  }
  return lista.length ? { lista } : null;
}
/* los estados propios de una entidad SKU (con su bodega) cuando la premisa es de ESTADO de la Mesa Capital: el veredicto los dice con el nombre de la entidad (diagnóstico v13, colateral 1) */
function _estadosPropiosDePremisa(H, I) {
  if (H.tipo !== "estado" || H.roles.sujetos.length !== 1 || H.roles.sujetos[0] === "negocio" || !H.estado) return null;
  const ent = I.resolverEntidad(H.roles.sujetos[0]);
  if (!ent || ent.eje !== "sku") return null;
  const def = estadoDeLaCasa(H.estado);
  if (!def || typeof def.verificar === "function") return null;   // los estados con definición propia traen su cifra y su dueño en `H.verdad`
  const propios = I.estadosDe(ent.nombre).filter((x) => ESTADOS_PROPIOS.sku.familia.includes(estadoCanon(x.estado)));
  if (!propios.length) return null;
  return { entidad: ent.nombre, estados: propios.map((x) => { const c = estadoCanon(x.estado); return { canon: c, texto: formaDeEstado(c).singular, bodega: x.bodega || null }; }) };
}

/** libroDeHechos(hechos, ctx) → { hechos: [H], porId: Map, errores, resumen, texto } · ctx = { indice } | { figs, datoProyectado, ejesDelTenant } */
export function libroDeHechos(hechos, ctx = {}) {
  const I = ctx.indice || indiceDeEvidencia({ figs: ctx.figs || [], datoProyectado: ctx.datoProyectado || null, ejesDelTenant: ctx.ejesDelTenant || null });
  const libro = { hechos: [], porId: new Map(), errores: [], indice: I };
  const cola = (Array.isArray(hechos) ? hechos : []).map((h, i) => (h && typeof h === "object" ? { ...h, id: String(h.id || `h${i + 1}`) } : null)).filter(Boolean);
  const evaluar = (h) => {
    const tipo = normalizar(h.tipo);
    const H = _H(h.id, tipo);
    if (libro.porId.has(h.id)) { H.motivo = `id-repetido: «${h.id}» ya existe en el libro`; libro.errores.push(H.motivo); return H; }
    if (!TIPOS_DE_HECHO.includes(tipo)) { H.motivo = `tipo desconocido «${h.tipo}» (${TIPOS_DE_HECHO.join(" · ")})`; return H; }
    /* el contrato tipado se valida ANTES de evaluar: lo mal formado no se adivina (ronda 5, R13) */
    { const e = validarHecho(h, I); if (e) { H.motivo = `esquema: ${e}`; return H; } }
    try {
      if (tipo === "ref") {
        const f = _figPorId(I, h.de != null ? h.de : h.ref);
        if (!f) { H.motivo = `ref-desconocida: «${h.de != null ? h.de : h.ref}» no es una fig de la boleta de este turno`; return H; }
        return _deFig(H, I, f);
      }
      if (tipo === "propuesta") {
        const v = leerValor(h.valor);
        if (!v || !Number.isFinite(v.raw)) { H.motivo = "propuesta sin valor"; return H; }
        H.ok = true; H.veredicto = "sellada"; H.motivo = "propuesta del asesor (criterio mío): no se juzga contra la boleta"; H.render.valor = v.texto; H.numeros.push({ raw: v.raw, unidad: v.unidad, texto: v.texto });
        H.procedencia = "propuesta";   // un número de una recomendación — NUNCA un dato de la empresa (owner, Etapa 2)
        /* sin insumos: el número es del asesor, no una medición — la fuerza (verificada/condicionada/hipotetica)
         * no aplica; la naturaleza sí es "propuesta" y la tabla fija reconstruye el mismo LEGADO de la línea de arriba. */
        H.composicion = []; H.naturaleza = "propuesta"; H.origen = { titular: "medido", lista: [], fuentes: [] }; H.fuerza = null;
        if (h.de != null) _addClave(H, h.de); if (h.sujeto) { H.roles.sujetos = [h.sujeto]; _addEnt(H, I, h.sujeto); }
        return H;
      }
      if (tipo === "lectura") {
        const apoyo = _lista(h.apoyo);
        const faltan = apoyo.filter((id) => !libro.porId.has(String(id)));
        H.roles.apoyo = apoyo.map(String);
        if (faltan.length) { H.motivo = `apoyo-desconocido: ${faltan.join(", ")} no está en el libro`; return H; }
        const falsos = apoyo.filter((id) => libro.porId.get(String(id)) && !libro.porId.get(String(id)).ok);
        if (falsos.length) { H.motivo = `apoyo-falso: la lectura se apoya en ${falsos.join(", ")}, que no es verdadero`; return H; }
        for (const id of apoyo) { const A = libro.porId.get(String(id)); for (const e of A.entidades) H.entidades.add(e); for (const c of A.claves) H.claves.add(c); if (!H.dominio) H.dominio = A.dominio; }
        H.ok = true; H.veredicto = "sellada"; H.motivo = `lectura con sello «${h.sello || "criterio mío"}»${apoyo.length ? " · apoyo " + apoyo.join(", ") : ""}`; H.sello = h.sello || "criterio mío";
        H.procedencia = peorProcedencia(...apoyo.map((id) => { const A = libro.porId.get(String(id)); return A ? A.procedencia : null; }));   // una lectura hereda la peor procedencia de lo que la apoya; sin apoyo, null (interpretación libre — no hay cifra que fechar) — campo LEGADO: se sobreescribe abajo con la tabla fija, mismo resultado
        /* la composición de una lectura es la de TODO lo que la apoya, concatenada (nunca resumida): cada insumo
         * de cada hecho de apoyo, con su rol original más el id del apoyo que lo trajo. */
        _aplicarComposicion(H, apoyo.flatMap((id) => { const A = libro.porId.get(String(id)); return A && Array.isArray(A.composicion) ? A.composicion.map((c) => ({ ...c, rol: `${c.rol} (${id})` })) : []; }));
        return H;
      }
      if (tipo === "razon") return _razon(H, h, I, libro);
      if (tipo === "derivada") return _derivada(H, h, I, libro);
      if (tipo === "conteo" && typeof h.de === "string") { const t = _universoDeTexto(h.de); if (t) h = { ...h, de: t }; }
      if (tipo === "conteo") { const R = _conteoTipado(H, h, I); if (R) return R; }
      if (tipo === "cifra" && (h.valor == null || h.valor === "")) {
        /* la cifra identificada por (sujeto, clave) sin valor: la fig de la boleta o la proyección */
        const sujeto = h.sujeto === "negocio" || /^(?:negocio|total)$/i.test(String(h.sujeto || "")) ? "negocio" : h.sujeto;
        const f = _figDe(I, sujeto, h.metrica, h.unidad || null);
        if (!f) { H.motivo = `sin-evidencia: la boleta no trae «${metricaDeClave(h.metrica)}» de ${sujeto}`; H.roles.sujetos = [sujeto]; _addEnt(H, I, sujeto); _addClave(H, h.metrica); return H; }
        if (h.unidad && !_unidadCompatibleEstricta(String(h.unidad), f.unidad || "count")) { H.motivo = `unidad-declarada: ${f.label} viene en ${f.unidad || "count"}, no en ${h.unidad}`; H.roles.sujetos = [sujeto]; _addEnt(H, I, sujeto); _addClave(H, h.metrica); H.evidencia = [f.label]; return H; }
        return _deFig(H, I, f, sujeto);
      }
      /* lo demás lo juzga verificar.js con la afirmación traducida */
      const negado = tipo === "estado" && _esNegado(_es(h.estado) ? h.estado.estado : h.estado);
      const a2 = _aV2(negado ? { ...h, estado: _es(h.estado) ? { ...h.estado, estado: _sinNo(h.estado.estado) } : _sinNo(h.estado) } : h, I);
      const v = _juzgarV2(a2, I);
      if (negado) { if (v.veredicto === "verdadera") { v.veredicto = "falsa"; v.motivo = `negacion-falsa: sí está «${a2.estado.estado}» (${v.verdad || v.motivo})`; } else if (v.veredicto === "falsa") { v.veredicto = "verdadera"; v.motivo = `no está «${a2.estado.estado}»: ${v.verdad || v.motivo}`; } }
      _aplica(H, v);
      /* la procedencia de orden/relacion/grupo/conteo/variacion/estado/cifra-con-valor: la peor entre las figs que
       * la evidencia citó (`v.evidencia`, labels) — el mismo mecanismo que `_deFig`/`_razon`/`_derivada`, aplicado
       * a lo que ya resolvió `verificar.js` en vez de reabrir un camino nuevo. */
      if (H.evidencia && H.evidencia.length) {
        const figsEv = H.evidencia.map((l) => I.figs.find((g) => normalizar(g.label) === normalizar(l))).filter(Boolean);
        if (figsEv.length) {
          H.procedencia = peorProcedencia(...figsEv.map(_procedenciaDeFig));   // campo LEGADO: se sobreescribe abajo con la tabla fija, mismo resultado
          _aplicarComposicion(H, figsEv.map((f) => ({ origen: _origenDeFigStruct(f), naturaleza: _naturalezaDeFig(f), id: _idDeOperando(f), rol: f.concepto || f.label || "evidencia", crudo: f.crudo !== false })));
        }
        /* v24: una `cifra` que el libro comprobó contra el RANKING de la proyección (sin fig en la boleta) es un valor MEDIDO del dato; su cero por ausencia («ausente = 0», el conjunto que la métrica define no la trae) es DERIVADO. Sin esto la fila de la tabla decía «sin procedencia declarada» */
        else if (tipo === "cifra" && v.veredicto === "verdadera" && H.evidencia.some((l) => /^ranking /i.test(String(l)))) {
          const ause = /\(ausente = 0\)/.test(H.evidencia.join(" "));
          _aplicarComposicion(H, [{ origen: "medido", naturaleza: ause ? "derivado" : "directo", id: null, rol: "valor", crudo: true }]);
        }
      }
      /* roles, claves, números y render desde el hecho identificado (no desde ninguna prosa) */
      const sujetos = Array.isArray(a2.sujeto) ? a2.sujeto : (a2.sujeto != null ? [a2.sujeto] : []);
      H.roles.sujetos = sujetos.map(String); for (const s of sujetos) _addEnt(H, I, typeof s === "string" ? s : null);
      if (h.metrica != null) _addClave(H, h.metrica);
      if (a2.orden && a2.orden.vs) { H.roles.vs = [String(a2.orden.vs)]; _addEnt(H, I, String(a2.orden.vs)); }
      if (a2.relacion && a2.relacion.vs) { const vsS = _lista(a2.relacion.vs.sujeto); H.roles.vs = vsS.map(String); for (const s of vsS) _addEnt(H, I, typeof s === "string" ? s : null); if (a2.relacion.vs.metrica) _addClave(H, a2.relacion.vs.metrica); }
      if (a2.grupo) { H.roles.miembros = _lista(a2.grupo.entidades).map(String); for (const s of H.roles.miembros) _addEnt(H, I, s); }
      if (a2.estado) { H.estado = _canonDe(a2.estado.estado); H.roles.bodega = a2.estado.bodega || null; if (a2.estado.bodega) _addEnt(H, I, a2.estado.bodega); H.dominio = H.dominio || dominioDeEstado(H.estado); H.render.estado = nombreDeEstado(H.estado); }
      if (a2.valor != null) {
        _addNum(H, a2.valor);
        /* 39(b): el número a secas se JUZGA con su precisión exacta (`_valorDeCifra`) pero se DICE con el formato de la casa («$10K»), igual que la misma cifra en toda superficie */
        const nv = H.numeros[H.numeros.length - 1];
        if (nv && _valorDeCifra(h) !== h.valor) nv.texto = formatoDeLaCasa(nv.raw, nv.unidad) || nv.texto;
      }
      if (a2.relacion) { if (a2.relacion.valor != null) _addNum(H, a2.relacion.valor); if (Number.isFinite(+a2.relacion.k)) { H.numeros.push({ raw: +a2.relacion.k, unidad: "ratio", texto: String(a2.relacion.k) }); H.render.k = String(a2.relacion.k); } H.render.rel = _renderRelacion(a2, I); H.matiz = a2.relacion.matiz || ""; H.direccion = a2.relacion.forma; }
      if (a2.orden) { H.forma = normalizar(String(a2.orden.forma || "")); if (Number.isFinite(+a2.orden.k)) { H.numeros.push({ raw: +a2.orden.k, unidad: "count", texto: String(a2.orden.k), dueno: "universo" }); H.render.k = String(a2.orden.k); } H.direccion = a2.orden.direccion || direccionPorDefecto(a2.orden.forma);   /* UNA SOLA definición (R-DIRECCION, diagnóstico v3): afirmacion.js:direccionPorDefecto — antes esta línea y la puerta de completitud de afirmacion.js discrepaban (acá ya trataba topk=mayor, allá solo max/min) */ H.forma = a2.orden.forma; }
      if (a2.variacion) { if (a2.variacion.valor != null) _addNum(H, a2.variacion.valor); H.direccion = a2.variacion.direccion; H.periodo = periodoDe(h.periodo || "anterior"); H.claves.add(H.periodo === "presupuesto" ? "vs_presupuesto" : "variacion"); }
      if (a2.conteo) { H.numeros.push({ raw: +a2.conteo.n, unidad: "count", texto: String(a2.conteo.n) }); H.render.n = String(a2.conteo.n); if (a2.conteo.m != null) { H.numeros.push({ raw: +a2.conteo.m, unidad: "count", texto: String(a2.conteo.m) }); H.render.m = String(a2.conteo.m); } }
      if (a2.periodo && !H.periodo) H.periodo = periodoDe(a2.periodo);
      /* el universo evaluado (tipado o texto) y su nombre para {id.universo} */
      const u = a2.universo;
      if (_es(u) || (typeof u === "string" && u.trim() && (tipo === "orden" || tipo === "grupo" || tipo === "conteo"))) {
        let U = null; try { U = conjuntoDeUniverso(u, I, _es(u) ? u.eje || null : null, a2.metrica); } catch { U = null; }
        H.universo = { set: U && U.set ? U.set : null, fuente: U ? (U.fuente || U.error || "") : "", texto: nombrarUniverso(u, I), restringido: _es(u) ? !!(U && U.set) : true };
        if (_es(u)) H.universoTipado = u;   // el universo tal como se declaró (las anclas leen su exclusión)
        /* un universo escrito como texto («los clientes con saldo vencido», «las 5 marcas»): publica sus estados y solo restringe si no es el eje entero */
        if (typeof u === "string") {
          for (const e of estadosEn(u)) { const c = _canonDe(typeof e === "string" ? e : (e && (e.canon || e.estado)) || ""); if (c && ESTADOS_CANON.has(c)) { H.estadosDelUniverso = H.estadosDelUniverso || new Set(); H.estadosDelUniverso.add(c); } }
          const ejeU = (() => { const s0 = H.roles.sujetos.find((x) => x !== "negocio"); const ent = s0 && I.entidades ? I.entidades.get(normalizar(s0)) : null; return (ent && ent.eje) || (typeof I.ejeDe === "function" ? I.ejeDe(s0) : null) || null; })();
          const total = ejeU && typeof I.tamanoDelEje === "function" ? I.tamanoDelEje(ejeU) : null;
          if (U && U.set && total && U.set.size >= total) H.universo.restringido = false;
          const mEje = /^(?:todos\s+los|todas\s+las|los|las|tus|sus|mis)\s+(?:(\d+)\s+)?(?:clientes?|skus?|marcas?|familias?|bodegas?|canales?)(?:\s+(?:de\s+(?:la|tu|su)\s+cartera|del\s+negocio|de\s+la\s+empresa))?$/i.exec(normalizar(u).trim());
          if (mEje && (!mEje[1] || !total || +mEje[1] >= total)) H.universo.restringido = false;
        }
        /* un conteo con predicado de estado («frenados», «en mora») afirma ese estado: lo lleva con sus métricas y su dominio */
        if (tipo === "conteo" && typeof a2._predicado === "string") {
          for (const c of estadosEn(a2._predicado)) { if (!ESTADOS_CANON.has(c)) continue; H.estado = H.estado || c; H.estadosDelUniverso = H.estadosDelUniverso || new Set(); H.estadosDelUniverso.add(c); for (const k of METRICAS_DE_ESTADO[c] || []) H.claves.add(k); if (!H.dominio) H.dominio = dominioDeEstado(c); }
        }
        H.render.universo = H.universo.texto;
        // el mismo umbral formateado que su gemelo de `_conteoTipado` (arriba, ~línea 724, X34) — un filtro sobre
        // un `orden`/`grupo` tipado imprime igual, nunca crudo.
        // CORREGIDO (supervisor 2026-09-28, diagnóstico v11, Y10/Y17) — `u.top.k` (el tamaño del universo, p. ej.
        // «el de más contribución SOBRE EL BENCHMARK» con `top:{k:1}`) se empujaba a `H.numeros` para CUALQUIER
        // tipo con `_es(u)`, incluido `orden`: para un `orden` de UN sujeto (q2/q3), `a2.orden.k` (línea ~962) no
        // existe (`forma:"max"` no declara `k`), así que este push quedaba como `H.numeros[0]` — el rescate
        // genérico (línea ~1096, «EL DUEÑO DE UNA CIFRA») que busca la cifra PROPIA del sujeto (su contribución,
        // su margen) solo corre `si !H.numeros.length`, y con el `k` del universo ya adentro, nunca se ejecutaba:
        // `_rotuloDeLaCasaDeH` (componer.js) imprimía «Easy: contribución 1» (el `k`=1 del top, no los $ de Easy).
        // Para `grupo`/`conteo` este número SÍ hace falta (su gemelo de `_conteoTipado`, citado arriba, lo declara
        // igual) — se acota el chequeo a excluir SOLO `orden`, sin tocar los otros dos tipos ni ninguna otra rama.
        if (_es(u)) { for (const f of Array.isArray(u.filtros) ? u.filtros : []) { _addClave(H, f.metrica); if (f.valor != null && !Array.isArray(f.valor)) { const enDias = f.unidad && !/^(?:days|money|pct|pp|count|ratio)$/.test(String(f.unidad)); H.numeros.push({ raw: +f.valor, unidad: enDias ? "count" : (f.unidad || unidadDeClave(f.metrica) || "count"), texto: formatoDeReferencia(+f.valor, enDias ? "count" : (f.unidad || unidadDeClave(f.metrica) || "count")) || String(f.valor), dueno: "universo" }); if (enDias) { const d = diasDe(f.valor, f.unidad); if (d != null) H.numeros.push({ raw: d, unidad: "days", texto: `${d} días`, dueno: "universo" }); } H.render.umbral = _fmtUmbral(f).replace(/^.*?(?:superior a|de al menos|inferior a|de hasta|igual a|entre)\s+/, ""); } } if (u.top) { _addClave(H, u.top.metrica); if (tipo !== "orden") H.numeros.push({ raw: +u.top.k, unidad: "count", texto: String(u.top.k), dueno: "universo" }); } for (const e of [..._lista(u.estados), ..._lista(u.no_estados), ..._lista(u.excluir && u.excluir.estados)]) { H.estadosDelUniverso = H.estadosDelUniverso || new Set(); H.estadosDelUniverso.add(_canonDe(e)); }
          // §7.3, tarea 4 (segunda tanda): un `union` trae sus propios filtros DENTRO de cada miembro — declaran
          // su clave acá, con el MISMO `_addClave` de arriba, para que el rescate de la referencia (más abajo, el
          // bloque «GENERALIZACIÓN A filtros[].ref») sepa qué métrica reporta la entidad también en este caso.
          if (Array.isArray(u.union)) for (const v of u.union) if (_es(v)) for (const f of Array.isArray(v.filtros) ? v.filtros : []) _addClave(H, f.metrica);
        }
      }
      if (tipo === "cifra" && v.veredicto === "verdadera") { const f = (v.evidencia || []).map((l) => I.figs.find((g) => normalizar(g.label) === normalizar(l))).find(Boolean); if (f) { H.render.valor = _textoDeReferencia(f) || textoDeLaCasa(f.raw, f.unidad, f.texto || (f.fig && String(f.fig.value)) || ""); if (!H.dominio) H.dominio = _dominioDeFig(f); } if (!H.render.valor && a2.valor && a2.valor.texto) H.render.valor = a2.valor.texto; }
      if (tipo === "grupo") { const gv = leerValor(a2.valor); if (gv && gv.texto) H.render.valor = _canonTexto(gv.texto); }
      // A4 (v7 «A4a», generalizada por el supervisor 2026-09-27, diagnóstico v8, §7.3 «las comparables viajan
      // juntas», entrega/verificar.js) — un grupo de MEMBRESÍA PURA (sin valor declarado: `afirmacion.js` ya no
      // exige metrica/valor para esta forma) sobre un universo de REFERENCIA («bajo/sobre el benchmark», «sobre
      // el nivel declarado de carga», «carga comercial alta») tiene que imprimir el VALOR de esa referencia en
      // la MISMA oración del veredicto — VERDADERO o FALSO, sin excepción (`_conteoTipado`, más abajo en este
      // archivo, ya lo hace para los filtros con `ref`, vía `_fmtUmbral`/`valorDeReferencia`; acá se cierra el
      // mismo hueco para `base`, con la MISMA función, nunca una segunda cifra inventada). `_FAMILIA_DE_BASE`
      // es la tabla base→(concepto de referencia, métrica natural) — antes solo cubría benchmark; ahora también
      // nivel_carga (§7.3·19). Con un veredicto FALSO y ninguna métrica propia ya medida (un `grupo` sin
      // `filtros`/`metrica` declarados, como «Tottus no está en carga comercial alta»), se rescata la cifra
      // PROPIA de la entidad en la métrica natural de la familia (la MISMA regla que el rescate genérico de más
      // abajo, línea ~964, aplicado acá porque ese rescate corre DESPUÉS de este bloque y ya encontraría
      // `H.claves` vacío) — nunca una segunda fuente de verdad, la fig real de la boleta.
      if (tipo === "grupo" && _es(h.universo) && typeof h.universo.base === "string") {
        const _baseStr = h.universo.base.trim();
        const fam = referenciaDeBase(_baseStr);
        if (fam) {
          const rRef = valorDeReferencia(fam.concepto, I);
          if (rRef && Number.isFinite(rRef.raw)) {
            const mRef = metricaPorClave(fam.concepto);
            const valTxt = formatoDeReferencia(rRef.raw, rRef.unidad || "pct");
            const refTxt = `${mRef ? mRef.nombre.toLowerCase() : fam.concepto} ${valTxt}`;
            if (!H.numeros.some((n) => n.texto === valTxt)) {
              H.verdad = `${H.verdad || ""}${H.verdad ? ", " : ""}${refTxt}`;
              H.numeros.push({ raw: rRef.raw, unidad: rRef.unidad || "pct", texto: valTxt, dueno: "referencia" });
            }
            // `H.render.referencia` (campo dedicado, no posicional) — `_rotuloDeLaCasaDeH` (entrega/componer.js)
            // lo lee para no perder esta cifra cuando SÍ arma un rótulo propio para la entidad (con su propia
            // métrica medida) — sin este campo, ese camino solo imprime `H.numeros[0]` y la referencia recién
            // declarada quedaba en el libro pero nunca en el texto.
            H.render.referencia = refTxt;
            if (!H.ok && H.roles.sujetos.length === 1 && H.roles.sujetos[0] !== "negocio" && ![...H.claves].some((c) => c === fam.metrica)) {
              const _fProp = _figDe(I, H.roles.sujetos[0], fam.metrica);
              if (_fProp) { H.numeros.unshift({ raw: _fProp.raw, unidad: _fProp.unidad, texto: textoDeLaCasa(_fProp.raw, _fProp.unidad, _fProp.texto || ""), clave: fam.metrica }); H.claves.add(fam.metrica); }
            }
          }
        }
      }
      // CORREGIDO (supervisor 2026-09-28, diagnóstico v11, Y10/Y17) — la ley §7.3·12/·19 («toda referencia
      // declarada imprime su valor en la MISMA oración… vale también para el universo de una PREMISA») cerraba
      // el hueco de `base` solo para `grupo` (bloque de arriba); un `orden` de un sujeto («Easy tiene la mayor
      // contribución ENTRE LOS QUE ESTÁN SOBRE EL BENCHMARK») con el MISMO universo (`base:"sobre el
      // benchmark"`) nunca declaraba `H.render.referencia`, así que la premisa quedaba verdadera pero sin el
      // 30.1% del benchmark en el texto. Se declara SOLO `H.render.referencia` — nunca se toca `H.verdad` ni
      // `H.numeros` (ese `push`/`unshift` es del camino de `grupo`, donde el rescate genérico de abajo, línea
      // ~964, no corre para el mismo tipo; para `orden` SÍ corre, y es la fuente correcta del valor PROPIO del
      // sujeto en `H.numeros[0]` — anteponer acá la referencia lo desplazaría, la RAÍZ exacta del defecto
      // gemelo que ya cerró la nota de arriba, «línea ~1096, DELIBERADAMENTE DESPUÉS»). Misma tabla
      // `referenciaDeBase`, misma función `valorDeReferencia`/`formatoDeLaCasa` — nunca una segunda cifra.
      if (tipo === "orden" && _es(h.universo) && typeof h.universo.base === "string" && !H.render.referencia) {
        const famO = referenciaDeBase(h.universo.base.trim());
        if (famO) {
          const rRefO = valorDeReferencia(famO.concepto, I);
          if (rRefO && Number.isFinite(rRefO.raw)) {
            const mRefO = metricaPorClave(famO.concepto);
            const valTxtO = formatoDeReferencia(rRefO.raw, rRefO.unidad || "pct");
            H.render.referencia = `${mRefO ? mRefO.nombre.toLowerCase() : famO.concepto} ${valTxtO}`;
          }
        }
      }
      // §7.3·39(d)/·40(a) (diagnóstico v16) — un universo SOLO-EXCLUIR que nombra el conjunto de una referencia («todas menos las sobre el benchmark») en una premisa de ORDEN, RELACIÓN o CIFRA imprime el
      // valor de esa referencia en la MISMA oración, igual que el `base` (bloque de arriba) y el `grupo` (bloque de abajo): solo `H.render.referencia`, con la misma tabla y la misma función.
      if ((tipo === "orden" || tipo === "relacion" || tipo === "cifra") && _es(h.universo) && _es(h.universo.excluir)) {
        for (const nEx of _lista(h.universo.excluir.conjuntos)) {
          const famX = referenciaDeBase(String(nEx));
          if (!famX) continue;
          const rRefX = valorDeReferencia(famX.concepto, I);
          if (!rRefX || !Number.isFinite(rRefX.raw)) continue;
          const mRefX = metricaPorClave(famX.concepto);
          const refTxtX = `${mRefX ? mRefX.nombre.toLowerCase() : famX.concepto} ${formatoDeReferencia(rRefX.raw, rRefX.unidad || "pct")}`;
          if (!(H.render.referencia && H.render.referencia.includes(refTxtX))) H.render.referencia = H.render.referencia ? `${H.render.referencia}, ${refTxtX}` : refTxtX;
        }
      }
      // v19 (Y24 · Y27, §7.3·12/·19/·42d): un universo con un FILTRO que cita una referencia de la casa (`filtros[].ref`, también en las ramas de una unión) en una premisa de ORDEN, RELACIÓN o CIFRA imprime el valor de esa referencia en la MISMA oración —
      // igual que el `base` y el `excluir` de arriba—: antes solo lo hacía el grupo de un sujeto (más abajo) y la premisa verdadera («Easy es la que más vende entre las que alcanzan el benchmark») quedaba sin el 30.1 %. Solo `H.render.referencia`, con la misma función.
      if ((tipo === "orden" || tipo === "relacion" || tipo === "cifra") && _es(h.universo)) {
        const _filtrosRef = (u) => (_es(u) ? [...(Array.isArray(u.filtros) ? u.filtros : []), ..._lista(u.union).flatMap(_filtrosRef)] : []).filter((f) => _es(f) && f.ref);
        for (const f of _filtrosRef(h.universo)) {
          const refTxtF = _textoDeReferenciaDeCasa(String(f.ref).trim(), I);
          if (!refTxtF) continue;
          if (!(H.render.referencia && H.render.referencia.includes(refTxtF))) H.render.referencia = H.render.referencia ? `${H.render.referencia}, ${refTxtF}` : refTxtF;
        }
      }
      // A4, GENERALIZACIÓN A ESTADOS/EXCLUIR (supervisor 2026-09-27, diagnóstico v9, RAÍZ A4 — precisa el bloque
      // de arriba) — el mecanismo de arriba solo cubría `universo.base` (string); nunca `universo.estados`/
      // `no_estados` cuando el ESTADO en sí mismo cita una referencia numérica («rota bien»/«rota lento» citan el
      // piso de rotación de la POLICY, `estados.js`), NI `universo.excluir.conjuntos`/`.estados` (W76: «top 4
      // venta, excluir bajo el benchmark» — la exclusión TAMBIÉN cita una referencia numérica y también tiene que
      // imprimir su valor). Sin este bloque, `_setDeEstado`/`_conjuntoTipado` (notario/verificar.js) arman el
      // veredicto con SU `fuente` — la definición ESTÁTICA, nunca el valor real — así que la oración del
      // veredicto quedaba sin la cifra (§7.3·12/·19: «vale también para el universo de una PREMISA»). Cubre
      // `grupo` (pertenencia y exclusión) Y `estado` (afirmación directa) — la MISMA tabla `referenciaDeBase`/
      // `referenciaDeEstado`, la MISMA función `valorDeReferencia`/`formatoDeLaCasa`, nunca una segunda cifra.
      const _nombresDeLaAfirmacion = tipo === "grupo" && _es(h.universo)
        ? [..._lista(h.universo.estados), ..._lista(h.universo.no_estados), ..._lista(h.universo.excluir && h.universo.excluir.conjuntos), ..._lista(h.universo.excluir && h.universo.excluir.estados)]
        : (tipo === "estado" && H.estado ? [H.estado] : []);
      for (const _eCrudo of _nombresDeLaAfirmacion) {
        const famE = referenciaDeBase(String(_eCrudo)) || referenciaDeEstado(_canonDe(_eCrudo));
        if (!famE) continue;
        const rRefE = valorDeReferencia(famE.concepto, I);
        if (!rRefE || !Number.isFinite(rRefE.raw)) continue;
        const mRefE = metricaPorClave(famE.concepto);
        const valTxtE = formatoDeReferencia(rRefE.raw, rRefE.unidad || "pct");
        const refTxtE = `${mRefE ? mRefE.nombre.toLowerCase() : famE.concepto} ${valTxtE}`;
        // tipo "estado" (verify.js:_estado) YA puede traer el valor en `H.verdad` (estados.js declara el piso a la
        // MISMA precisión, `.toFixed(1)`, ronda A4) — solo se agrega si NINGUNA de las dos formas (H.numeros o
        // H.verdad ya escrito) lo tiene, para no duplicar la referencia en la misma oración.
        if (!H.numeros.some((n) => n.texto === valTxtE) && !(H.verdad || "").includes(valTxtE)) {
          H.verdad = `${H.verdad || ""}${H.verdad ? ", " : ""}${refTxtE}`;
          H.numeros.push({ raw: rRefE.raw, unidad: rRefE.unidad || "pct", texto: valTxtE, dueno: "referencia" });
        }
        if (!(H.render.referencia && H.render.referencia.includes(refTxtE))) H.render.referencia = H.render.referencia ? `${H.render.referencia}, ${refTxtE}` : refTxtE;   /* sin repetir la que el `base` ya dijo */
        if (!H.ok && H.roles.sujetos.length === 1 && H.roles.sujetos[0] !== "negocio" && ![...H.claves].some((c) => c === famE.metrica)) {
          const _fPropE = _figDe(I, H.roles.sujetos[0], famE.metrica);
          if (_fPropE) { H.numeros.unshift({ raw: _fPropE.raw, unidad: _fPropE.unidad, texto: textoDeLaCasa(_fPropE.raw, _fPropE.unidad, _fPropE.texto || ""), clave: famE.metrica }); H.claves.add(famE.metrica); }
        }
      }
      /* un grupo con universo tipado: cada miembro pertenece al universo, o el grupo es falso */
      if (tipo === "grupo" && _es(h.universo) && H.ok) { let U = null; try { U = conjuntoDeUniverso(h.universo, I, h.universo.eje || null, ""); } catch { U = null; } const miembros = (_lista(h.miembros).length ? _lista(h.miembros) : _lista(h.sujeto)).map((x) => { const r = I.resolverEntidad(x); return normalizar(r ? r.nombre : x); }); if (U && U.set) { const fuera = miembros.filter((k) => !U.set.has(k)); if (fuera.length) _aplica(H, { veredicto: "falsa", motivo: `fuera-del-universo: ${fuera.map((k) => (I.entidades.get(k) || { nombre: k }).nombre).join(", ")} no pertenece a «${nombrarUniverso(h.universo, I)}»`, verdad: `${nombrarUniverso(h.universo, I)}: ${[...U.set].map((k) => (I.entidades.get(k) || { nombre: k }).nombre).join(", ")}`, evidencia: H.evidencia }); } else if (U && U.error) _aplica(H, { veredicto: "no-verificable", motivo: U.error, verdad: "", evidencia: [] }); }
      /* la unidad declarada tiene que ser la de la fig; pp dicho por % (o al revés) es otra cifra; el signo de una variación es su dirección */
      if ((tipo === "cifra" || tipo === "variacion") && H.ok) {
        const f = (v.evidencia || []).map((l) => I.figs.find((g) => normalizar(g.label) === normalizar(l))).find(Boolean);
        const vd = h.valor != null ? leerValor(h.valor) : (tipo === "variacion" && _es(h.variacion) && h.variacion.valor != null ? leerValor(h.variacion.valor) : null);
        if (f && h.unidad && !_unidadCompatibleEstricta(String(h.unidad), f.unidad || "count")) _aplica(H, { veredicto: "no-verificable", motivo: `unidad-declarada: ${f.label} viene en ${f.unidad}, no en ${h.unidad}`, verdad: _fmtFig(f), evidencia: [f.label] });
        else if (f && vd && Number.isFinite(vd.raw) && ((vd.unidad === "pp" && f.unidad === "pct") || (vd.unidad === "pct" && f.unidad === "pp")) && /pp|puntos|%/i.test(String(h.valor != null ? h.valor : (h.variacion && h.variacion.valor)))) _aplica(H, { veredicto: "falsa", motivo: `unidad: ${f.label} es ${f.unidad === "pct" ? "un porcentaje" : "puntos"}, no ${vd.texto}`, verdad: _fmtFig(f), evidencia: [f.label] });
        else if (tipo === "variacion" && vd && Number.isFinite(vd.raw) && /^[+\-−]/.test(String(h.variacion && h.variacion.valor || "").trim()) && H.direccion && ((H.direccion === "sube" && vd.raw < 0) || (H.direccion === "baja" && vd.raw > 0))) _aplica(H, { veredicto: "falsa", motivo: `signo: «${vd.texto}» contradice la dirección «${H.direccion}»`, verdad: f ? _fmtFig(f) : "", evidencia: f ? [f.label] : [] });
      }
      if (tipo === "variacion") { const f = (v.evidencia || []).map((l) => I.figs.find((g) => normalizar(g.label) === normalizar(l))).find(Boolean); H.render.valor = a2.variacion && a2.variacion.valor && a2.variacion.valor.texto ? _canonTexto(a2.variacion.valor.texto) : (f ? (f.texto || (f.fig && String(f.fig.value)) || "") : ""); if (f && !H.numeros.length) H.numeros.push({ raw: f.raw, unidad: f.unidad, texto: f.texto || "" }); }
      // EL DUEÑO DE UNA CIFRA (owner 2026-09-26, diagnóstico v4 §5, MATERIAL) — cuando la evidencia de un hecho
      // que pasó por el juez general (orden · relacion · grupo · conteo · variacion · estado) es el RANKING de la
      // proyección y no una fig de la boleta, `H.evidencia[0]` es el placeholder interno «ranking <eje> · <clave>
      // · <universo>» (verificar.js), nunca una fig real: `H.numeros` queda vacío porque los bloques de arriba
      // solo lo llenan buscando ESE label entre las figs reales (`I.figs.find`), y esa búsqueda no puede
      // encontrar un label que nunca fue una fig. Sin número propio, `componer.js:_rotuloDeLaCasaDeH` no tenía
      // de dónde sacar un valor sin leer la prosa de depuración (`H.verdad`, que en un `orden` con más de una
      // entidad citada como evidencia SIEMPRE nombra al GANADOR primero, verdadero o falso — la raíz de K13:
      // «Samsung: margen 35.5%» cuando 35.5% es de Makita) — y sin ESTE rescate, un `variacion` en la misma
      // situación (D29: «ranking cliente · variacion · Mercado Libre = 25.3%») dejaba `_rotuloDeLaCasaDeH` sin
      // valor y filtraba esa MISMA prosa de depuración VERBATIM al texto servido. Arreglo DE RAÍZ, general para
      // cualquier tipo: el número que la casa puede imprimir para EL SUJETO sale de SU PROPIA fig o, sin ella,
      // del mismo ranking que ya verificó `verificar.js` (`_figDe`/`valorDeRanking`, la MISMA fuente que arma
      // cualquier otra cifra del libro) — nunca de una posición dentro de una cadena de texto. Solo con un
      // sujeto único (con varios sujetos —`topk`, un `grupo` de miembros, un `relacion` con `vs` de más de uno—
      // la cifra de cada uno la arma su propio camino, no este rescate genérico).
      if ((!H.numeros.length || ((tipo === "grupo" || tipo === "orden") && !H.numeros.some(esCifraPropia))) && H.roles.sujetos.length === 1 && H.roles.sujetos[0] !== "negocio") {
        const _sujetoRescate = H.roles.sujetos[0];
        let _fSujeto = null, _claveRescate = null;
        if (tipo === "variacion") {
          // la VARIACIÓN es su propia métrica (lexico.js: clave «variacion», «Variación vs año anterior») — NUNCA
          // el metric BASE del hecho (`h.metrica`, ej. «ventas»): ese declara contra qué concepto varió (sirve
          // para el «en venta» del rótulo, en `componer.js`), pero el NÚMERO que hay que imprimir es el de la
          // variación, no el total de ventas — mismo camino que `verificar.js:_variacion` ya usa para este mismo
          // cierre de brecha (`_delRanking({ metrica: "variacion" })`, exportado como `valorDeRanking`).
          _claveRescate = "variacion";
          _fSujeto = _figDe(I, _sujetoRescate, "variacion");
          if (!_fSujeto) { const _rk = valorDeRanking({ sujeto: _sujetoRescate, metrica: "variacion" }, I); if (_rk) _fSujeto = { raw: _rk.raw, unidad: _rk.unidad, texto: _rk.texto, fig: { value: _rk.texto } }; }
        } else {
          const _claveSujeto = [...H.claves].find((c) => c !== "variacion" && c !== "vs_presupuesto") || null;
          _claveRescate = _claveSujeto;
          _fSujeto = _claveSujeto ? _figDe(I, _sujetoRescate, _claveSujeto) : null;
          // un `grupo`/`orden` cuya métrica no se publica como fig por entidad (p. ej. `capital_inmovilizado`, solo ranking) trae la cifra PROPIA del
          // mismo ranking que ya verificó `verificar.js` (`valorDeRanking`), como la variación arriba — nunca el `k` de su top (A7).
          if (!_fSujeto && _claveSujeto && (tipo === "grupo" || tipo === "orden")) { const _rk = valorDeRanking({ sujeto: _sujetoRescate, metrica: _claveSujeto }, I); if (_rk && Number.isFinite(_rk.raw)) _fSujeto = { raw: _rk.raw, unidad: _rk.unidad, texto: _rk.texto, fig: { value: _rk.texto } }; }
        }
        if (_fSujeto) H.numeros.push({ raw: _fSujeto.raw, unidad: _fSujeto.unidad, texto: _fSujeto.texto || (_fSujeto.fig && String(_fSujeto.fig.value)) || "", ...(_claveRescate ? { clave: _claveRescate } : {}) });
      }
      // §7.3, tarea 4 del cierre (supervisor 2026-09-27, diagnóstico v8, raíz A4, segunda tanda) —
      // GENERALIZACIÓN A `filtros[].ref`: el mismo hueco que ya cerró el bloque de `base` (arriba, «A4») también
      // existe cuando el universo de un `grupo` no declara `base` sino un `filtro` con `ref` («rotación < piso de
      // rotación», «margen < benchmark», «días de inventario > techo de cobertura») — la métrica del filtro es,
      // precisamente, la que este rescate genérico (arriba) acaba de reportar como cifra PROPIA de la entidad
      // (`H.numeros[0]`, ya resuelta al llegar acá — DELIBERADAMENTE DESPUÉS del rescate genérico, nunca antes:
      // un intento anterior que corría este bloque ANTES dejaba `H.numeros[0]` con el valor de la REFERENCIA en
      // vez del de la entidad, porque el rescate de arriba solo corre `!H.numeros.length` — «se pisa la cifra
      // propia», la misma clase de defecto que este cierre existe para cerrar). Nunca pisa una referencia de
      // `base` ya encontrada más arriba (métrica distinta: se listan las dos, sin duplicar). MISMA guarda que el
      // rescate genérico de arriba — un SOLO sujeto: con varios (`H.roles.sujetos.length > 1`, ej. dos SKU que sí
      // pertenecen al universo), `_rotuloDeLaCasaDeH` no arma un rótulo por-entidad y esta cifra no tiene a quién
      // pegarse sin inventar un dueño — cae a `H.verdad`, sin tocar `H.numeros`.
      if (tipo === "grupo" && _es(h.universo) && H.roles.sujetos.length === 1 && H.roles.sujetos[0] !== "negocio") {
        const _filtrosDeGrupo = Array.isArray(h.universo.filtros) ? h.universo.filtros
          : (Array.isArray(h.universo.union) ? h.universo.union.flatMap((v) => (_es(v) && Array.isArray(v.filtros)) ? v.filtros : []) : []);
        for (const f of _filtrosDeGrupo) {
          if (!f || !f.ref || !f.metrica || !H.claves.has(String(f.metrica))) continue;
          const rRef = valorDeReferencia(f.ref, I);
          if (!rRef || !Number.isFinite(rRef.raw)) continue;
          const mRef = metricaPorClave(f.ref);
          const valTxt = formatoDeReferencia(rRef.raw, rRef.unidad || "pct");
          if (H.render.referencia && H.render.referencia.includes(valTxt)) continue;   // ya declarada (misma cifra)
          const refTxt2 = `${mRef ? mRef.nombre.toLowerCase() : f.ref} ${valTxt}`;
          H.render.referencia = H.render.referencia ? `${H.render.referencia}, ${refTxt2}` : refTxt2;
          if (!H.numeros.some((n) => n.texto === valTxt)) H.numeros.push({ raw: rRef.raw, unidad: rRef.unidad || "pct", texto: valTxt, dueno: "referencia" });
        }
      }
      return H;
    } catch (e) {
      H.veredicto = "no-verificable"; H.motivo = `error-del-libro: ${e && e.message ? e.message : e}`; return H;
    }
  };
  /* las lecturas y las propuestas se evalúan después de los hechos: su apoyo puede venir declarado más abajo */
  cola.sort((a, b) => (normalizar(a.tipo) === "lectura" ? 1 : 0) - (normalizar(b.tipo) === "lectura" ? 1 : 0));
  for (const h of cola) {
    const H = evaluar(h);
    /* decisión 37a (diagnóstico v13): la verdad PROPIA de la entidad de una premisa de grupo falsa, y los estados propios de una premisa de estado de la Mesa Capital */
    try {
      if (H.tipo === "grupo" && H.veredicto === "falsa") { const vp = _verdadPropiaDeGrupo(h, H, I); if (vp) { if (vp.lista) H.render.verdadesPropias = vp.lista; else H.render.verdadPropia = vp; } }
      /* decisión 38(a) (diagnóstico v14): el MISMO punto único para el orden y la relación falsos */
      if (H.tipo === "orden" && H.veredicto === "falsa") { const vp = _verdadPropiaDeOrden(h, H, I); if (vp) H.render.verdadPropia = vp; }
      /* §7.3·43(c) (v19): una relación juzgada —verdadera o falsa— dice la cifra de CADA lado en la oración (garantía transversal 4 de la Constitución) */
      if (H.tipo === "relacion" && (H.veredicto === "falsa" || H.veredicto === "verdadera")) { const vp = _verdadPropiaDeRelacion(h, H, I); if (vp) H.render.verdadPropia = vp; }
      if (H.tipo === "cifra" && H.veredicto === "falsa") { const vp = _verdadPropiaDeCifra(h, H, I); if (vp) H.render.verdadPropia = vp; }   // 39(b): la cifra falsa dice la verdad propia
      // decisión del supervisor 2026-09-29 (v13, misma raíz que A2): una premisa de grupo VERDADERA nombra a sus entidades y dice el universo con las palabras de la casa (`FORMA_DE_ESTADO`), nunca la traza `estados «…»`
      if (H.tipo === "grupo" && H.veredicto === "verdadera" && _es(h.universo) && H.roles.sujetos.length && !H.roles.sujetos.includes("negocio")) {
        const nombres = H.roles.sujetos.map((s) => { const r = I.resolverEntidad(s); return r ? r.nombre : s; });
        H.render.pertenencia = { entidades: nombres, universo: nombrarUniverso(h.universo, I) };
        { const ef = _empateFiloDeGrupo(h, I, nombres); if (ef) H.render.empateFilo = ef; }   // §7.3·44a
      }
      if (H.tipo === "orden" && H.veredicto === "verdadera") { const ef = _empateFiloDeOrden(h, I); if (ef) { H.render.empateFilo = ef; /* v24: la cifra PROPIA del empatado (o su cero por ausencia) es un número del hecho: sin ella el rótulo caía a la traza del ranking y el verificador atribuía su «$0» a otro empatado */ if (ef.propia && !(H.numeros || []).some(esCifraPropia)) H.numeros.push({ raw: ef.propia.raw, unidad: ef.propia.unidad, texto: ef.propia.texto, clave: _claveDeMetricaDeUniverso(h.metrica) }); } }   // §7.3·44a
      if (H.tipo === "estado" && (H.veredicto === "verdadera" || H.veredicto === "falsa")) { const ep = _estadosPropiosDePremisa(H, I); if (ep) H.render.estadosPropios = ep; }
    } catch { /* sin verdad propia el veredicto cae al texto de siempre */ }
    libro.hechos.push(H); libro.porId.set(H.id, H);
    if (!H.ok && _FACTUALES.has(H.tipo) && H.veredicto === "falsa") {
      for (const d of _verdadDeLoFalso(H, h, I, libro)) { const D = evaluar(d); if (D.ok) { D.derivadoDe = H.id; libro.hechos.push(D); libro.porId.set(D.id, D); H.derivados.push(D.id); } }
    }
  }
  /* ── UN DECLARADO NUNCA PISA UN MEDIDO (owner 2026-09-25, ley de los cuatro orígenes) ═══════════════════════════
   * Misma llave (concepto, entidad, eje, período, unidad) con DOS orígenes distintos → los DOS hechos quedan en
   * el libro (ninguno se descarta) y se emite un hecho `discrepancia` nuevo, factual, con la diferencia. Hoy
   * ningún productor declara un origen ≠ medido sobre una fig real («aportar contexto» y el motor de escenarios
   * no existen todavía), así que este bloque no encuentra pares — está listo para RECIBIRLOS, no para
   * generarlos: 0 hechos nuevos sobre cualquier libro de hoy (verificado por `_origenes_gate.mjs`). */
  { const _llaveDeHecho = (H) => {
      if (!H.ok || !_FACTUALES.has(H.tipo) || H.tipo === "discrepancia") return null;
      if (!Array.isArray(H.composicion) || H.composicion.length !== 1) return null;   // solo citas directas (una sola fig): una razón/derivada no comparte llave con un declarado suelto
      const n = H.numeros[H.numeros.length - 1];
      if (!n || !Number.isFinite(n.raw)) return null;
      const clave = [...H.claves][0] || "";
      if (!clave) return null;
      const sujeto = H.roles.sujetos[0] || "negocio";
      return `${clave}|${normalizar(sujeto)}|${H.periodo || ""}|${n.unidad || ""}`;
    };
    const porLlave = new Map();
    for (const H of libro.hechos) { const k = _llaveDeHecho(H); if (!k) continue; if (!porLlave.has(k)) porLlave.set(k, []); porLlave.get(k).push(H); }
    let dn = 0;
    for (const [, Hs] of porLlave) {
      for (let i = 0; i < Hs.length; i++) for (let j = i + 1; j < Hs.length; j++) {
        const A = Hs[i], B = Hs[j];
        if (!A.origen || !B.origen || !A.origen.titular || !B.origen.titular || A.origen.titular === B.origen.titular) continue;
        const na = A.numeros[A.numeros.length - 1], nb = B.numeros[B.numeros.length - 1];
        if (!na || !nb) continue;
        dn++;
        const id = `d${dn}`;
        if (libro.porId.has(id)) continue;
        const D = _H(id, "discrepancia", {
          ok: true, veredicto: "verdadera",
          motivo: `discrepancia: ${A.id} (${NOMBRE_DE_ORIGEN[A.origen.titular] || A.origen.titular}) dice ${na.texto || formatoDeLaCasa(na.raw, na.unidad)}, ${B.id} (${NOMBRE_DE_ORIGEN[B.origen.titular] || B.origen.titular}) dice ${nb.texto || formatoDeLaCasa(nb.raw, nb.unidad)}`,
          de: [A.id, B.id],
          diferencia: { raw: na.raw - nb.raw, unidad: na.unidad },
          entidades: new Set([...A.entidades, ...B.entidades]), claves: new Set([...A.claves, ...B.claves]),
        });
        D.verdad = D.motivo;
        libro.hechos.push(D); libro.porId.set(id, D);
      }
    }
  }
  libro.resumen = { total: libro.hechos.length, verdaderos: libro.hechos.filter((x) => x.ok && x.veredicto === "verdadera").length, sellados: libro.hechos.filter((x) => x.veredicto === "sellada").length, falsos: libro.hechos.filter((x) => x.veredicto === "falsa").length, noVerificables: libro.hechos.filter((x) => x.veredicto === "no-verificable").length, derivados: libro.hechos.filter((x) => x.derivadoDe).length };
  libro.texto = textoDelLibro(libro);
  return libro;
}
function _renderRelacion(a2, I) {
  const r = a2.relacion || {};
  const nom = (s) => (s === "negocio" ? "el negocio" : Array.isArray(s) ? s.join(" y ") : String(s || ""));
  const A = nom(a2.sujeto), B = r.vs ? nom(r.vs.sujeto) : "";
  const k = Number.isFinite(+r.k) ? +r.k : null;
  const matiz = r.matiz ? r.matiz + " " : "";
  void I;
  switch (r.forma) {
    case "veces": return `${A} ${matiz}${k === 2 ? "el doble que" : k === 3 ? "el triple que" : `${k} veces`} ${B}`;
    case "mayor": return `${A} más que ${B}`;
    case "menor": return `${A} menos que ${B}`;
    case "igual": return `${A} ${matiz || "igual que "}${B}`;
    case "fraccion": case "parte": return `${A} ${matiz}${k != null ? (k === 0.5 ? "la mitad de" : `el ${_fmtPct(k * 100)} de`) : "parte de"} ${B}`;
    case "diferencia": return `${A} ${r.valor && r.valor.texto ? r.valor.texto + " " : ""}${B ? "frente a " + B : ""}`;
    default: return "";
  }
}

/* ── el libro en texto para el modelo (formato fijo; «✗» trae la verdad y sus ids nuevos) ── */
export function textoDelLibro(libro) {
  const L = [];
  for (const H of libro.hechos) {
    if (H.derivadoDe) continue;
    if (H.ok) L.push(`✓ ${H.id} ${H.verdad || H.motivo}`);
    else L.push(`✗ ${H.id} — ${H.veredicto === "falsa" ? "FALSO" : "NO VERIFICABLE"}: ${H.motivo}${H.verdad && !H.motivo.includes(H.verdad) ? " · la verdad: " + H.verdad : ""}${H.derivados.length ? ` → la verdad, con id: ${H.derivados.map((d) => { const D = libro.porId.get(d); return `${d} ${D.verdad || D.motivo}`; }).join(" · ")}` : ""}. Este hecho NO existe: no lo escribas ni lo insinúes.`);
  }
  return L.join("\n");
}

/** renderDe(libro, id, campo) → el texto de un placeholder {id} / {id.n} / {id.m} / {id.k} / {id.umbral} / {id.universo} / {id.rel} / {id.estado} / {id.base} (null si no existe) */
export function renderDe(libro, id, campo = "valor") {
  const H = libro && libro.porId ? libro.porId.get(String(id)) : null;
  if (!H || !H.ok) return null;
  const c = campo || "valor";
  if (c === "valor") {
    if (H.render.valor != null) return H.render.valor;
    /* v24: una `cifra` verificada contra el ranking de la proyección (o por su cero por ausencia) no trae fig: su valor impreso es la cifra propia que el libro comprobó (`H.numeros`) */
    if (H.tipo === "cifra" && H.veredicto === "verdadera" && !H.render.estado && !H.render.n) { const n0 = (H.numeros || []).find((x) => esCifraPropia(x) && x.texto); if (n0) return n0.texto; }
    return H.render.estado || H.render.n || null;
  }
  return H.render[c] != null ? H.render[c] : null;
}

export const esFactual = (tipo) => _FACTUALES.has(normalizar(tipo));

/** procedenciaDe(libro, id) → "medido"|"derivado"|"estimacion_referencia"|"supuesto_usuario"|"propuesta"|null
 *  (null si el hecho no existe o no verificó). Etapa 2 del plan — la Entrega la lee para que el texto de la
 *  columna «Tipo» SALGA del campo, en vez de escribirse a mano por fila (owner, textual). */
export function procedenciaDe(libro, id) {
  const H = libro && libro.porId ? libro.porId.get(String(id)) : null;
  return H && H.ok ? (H.procedencia || null) : null;
}

/** origenDe(libro, id) → {titular, lista, fuentes} | null — el bag de origen del hecho (§A del diseño v2). */
export function origenDe(libro, id) {
  const H = libro && libro.porId ? libro.porId.get(String(id)) : null;
  return H && H.ok ? (H.origen || null) : null;
}
/** naturalezaDe(libro, id) → "directo"|"derivado"|"estimacion_referencia"|"propuesta"|null */
export function naturalezaDe(libro, id) {
  const H = libro && libro.porId ? libro.porId.get(String(id)) : null;
  return H && H.ok ? (H.naturaleza || null) : null;
}
/** fuerzaDe(libro, id) → "verificada"|"condicionada"|"hipotetica"|null — null si el hecho no tiene insumos (propuesta) o no verificó. */
export function fuerzaDe(libro, id) {
  const H = libro && libro.porId ? libro.porId.get(String(id)) : null;
  return H && H.ok ? (H.fuerza || null) : null;
}
/** composicionDe(libro, id) → [{origen, id, rol}] — la composición COMPLETA, nunca resumida. [] si no hay insumos o el hecho no existe. */
export function composicionDe(libro, id) {
  const H = libro && libro.porId ? libro.porId.get(String(id)) : null;
  return H && H.ok && Array.isArray(H.composicion) ? H.composicion : [];
}
/** confirmacionDe(libro, id) → {por, cuando, medio, sobre} | null — el sello aparte; NO cambia el origen. */
export function confirmacionDe(libro, id) {
  const H = libro && libro.porId ? libro.porId.get(String(id)) : null;
  return H ? (H.confirmacion || null) : null;
}
