/* === config/businessPolicy.js · POLÍTICA DE NEGOCIO · UNA fuente de verdad ===
 * Hardening pre-lanzamiento (2026-07-02): los umbrales que ADI CITA al usuario (benchmark de margen, mejor práctica
 * y target de carga comercial) estaban re-declarados como literales en 8+ composers (crossDomain/thesis/mechanisms/
 * contribution/…). Eso era "dos verdades": si el owner movía un umbral, había que cazarlo en cada archivo y uno se
 * olvidaba → dos respuestas citando targets distintos. Ahora vive acá, UNA vez.
 *
 * F2 MULTIEMPRESA (2026-07-26): POLICY deja de ser una constante global — se RESUELVE por empresa. Tres capas,
 * siempre en este orden de precedencia:
 *   1. el CRITERIO del usuario (C.2 · "mi margen mínimo es 28%") — SIEMPRE gana · scopeado por tenant (criteria.js)
 *   2. el PERFIL del tenant (tenants/<id>.js · `perfil`) — la vara que ESTA empresa declara con su dato
 *   3. POLICY_CONFIG — el fallback de config para lo que el perfil no declara
 * `POLICY` sigue siendo EL objeto que todos leen (los ~22 importadores no se tocan): initTenant lo re-resuelve
 * (capa 2 sobre 3) y criteria.js re-aplica encima lo del usuario (capa 1) — su callback corre después porque
 * criteria importa este módulo. Resolución DEFENSIVA: solo números finitos del perfil cuentan (un perfil roto
 * cae al config, y el validador del contrato lo reporta — regla perfil-valido).
 *
 * REGLA DE PRECEDENCIA DEL DATO: `benchmark` es el FALLBACK para cuando una fila del dataset no trae su propio
 * `benchmark` — siempre preferir `fila.benchmark ?? POLICY.benchmark` (el demo trae 30.1 por fila · empresa-2, 26.0). */
import { getTenantData, onTenantChange } from "../data/tenantStore.js";

// ── CAPA 3 · el fallback de config (lo que valía como literal hasta F2 · congelado: la config no muta) ──────────────
export const POLICY_CONFIG = Object.freeze({
  benchmark: 30.1,          // margen benchmark de cartera (%) · FALLBACK · el dato lo trae por-fila
  bestPracticeCarga: 3.0,   // mejor práctica interna de carga comercial (%)
  targetCarga: 3.5,         // target operativo de carga comercial (%)
  rotacionMin: 2,           // diagnose · piso de rotación (x): por debajo, el stock se considera dormido (numérico · portable a ERP real)
  dohMax: 120,              // diagnose · techo de cobertura (días): por encima, el stock se considera dormido
  margenBrechaMaterial: 4,  // diagnose · brecha material de margen (pp bajo la vara) · UNA verdad (detector + semáforo de la Mesa/cuadro)
  // ── diagnóstico de inventario (owner 2026-07-06 · umbrales configurables) · salud de las DOS puntas: sobra y falta ──
  quiebreRotMin: 6,         // riesgo de quiebre: rotación ALTA (≥) …
  quiebreDohMax: 20,        // … y cobertura BAJA (DOH ≤ días) → se va a quedar sin stock
  sobrestockDohMin: 60,     // sobrestock: DOH entre esto y dohMax (vende, pero cobertura excesiva)
  quiebreMaterialUsd: 20000,// materialidad de la alerta de quiebre: $ mínimo para no secuestrar la respuesta con ruido
  /* PISO DE FOCOS COMERCIALES, RELATIVO A LA VENTA DEL NEGOCIO (owner 2026-08-30: «no más monto fijo pensado
   * para $100M — la fuga de 7% de un negocio chico tiene que sonar»). 0.05% de la venta total reproduce EXACTO
   * el piso histórico de $50.000 sobre el negocio de referencia de $100M: el demo no se mueve un byte, y un
   * negocio de $61 mil pasa a oír su fuga de $4.5K. Como todo umbral de POLICY, el tenant puede declarar el
   * suyo por perfil. */
  materialidadFocoPctVenta: 0.05,
  quiebreMaterialPct: 5,    // … o % del capital del foco
  /* UMBRAL DE VENTA FRENADA (owner 2026-09-28, decisión §7.3·31-32 y ·34: «inmovilizado crítico y frenado se
   * separan; frenado = venta interrumpida, medida por los días sin venta»). A diferencia de TODA otra llave de
   * esta config, esta NO lleva número: es el candado técnico contra el «60 universal» que el owner rechazó
   * (diseño §3.2 — «nunca lleva un número en config»). `_resolvePolicy()` recorre `Object.keys(POLICY_CONFIG)`
   * con `for…of`, que SÍ enumera una llave con valor `undefined` (a diferencia de una llave ausente) — así el
   * perfil del tenant la puede declarar y `umbral()` la resuelve a `sin_declarar` cuando nadie lo hizo. El gate
   * `_jerarquia_inventario_gate.mjs` verifica que esta línea nunca tenga un número. */
  frenadoDiasSinVenta: undefined,
});

// ── EL OBJETO VIVO · lo que todo ADI lee (composers/detectores/semáforos) · re-resuelto en initTenant ───────────────
export const POLICY = { ...POLICY_CONFIG };

/* ══ «LLEVALO A LA META» ES UN VALOR, NO UNA PREGUNTA (owner 2026-08-11, defecto 6) ════════════════════════════
 * MEDIDO en la certificación final (E1.t4): «Si llevo sus acciones comerciales a la meta, ¿cuánto recupero?» y
 * ADI respondió «¿cuánto esperas que disminuyan las acciones comerciales (en $)?». La meta EXISTE y está acá
 * (`targetCarga`, 3,5%): preguntar por un valor que la política ya declara es hacerle repetir al usuario algo que
 * la empresa ya definió.
 * LA REFERENCIA SE RESUELVE POR MÉTRICA, y ese mapeo es el corazón del asunto: cada métrica tiene UNA referencia
 * autorizada y NO son intercambiables. Confundir el benchmark de margen (30,1%) con la meta de carga comercial
 * (3,5%) sería peor que preguntar — daría un número correcto de la política aplicado a la métrica equivocada.
 * SE DEVUELVE null CUANDO NO HAY UNA SOLA: sin métrica reconocible, o con la referencia ausente, el motor
 * pregunta. Una pregunta es barata; una referencia adivinada contamina toda la simulación. */
export const REFERENCIA_POR_METRICA = Object.freeze({
  margen:     { clave: "benchmark",    unidad: "pct",   label: "benchmark de margen" },
  carga:      { clave: "targetCarga",  unidad: "pct",   label: "meta de carga comercial" },
  rotacion:   { clave: "rotacionMin",  unidad: "ratio", label: "piso de rotación" },
  cobertura:  { clave: "dohMax",       unidad: "days",  label: "techo de cobertura" },
});

// las familias de palabras con que el usuario nombra cada métrica. Vocabulario NUESTRO y cerrado: no se infiere
// del texto libre, se reconoce. Lo que no está acá no resuelve, y por lo tanto pregunta.
const _METRICA_RE = [
  [/\bcarga comercial\b|\bacciones comerciales\b|\brebates?\b|\bdescuentos?\b/i, "carga"],
  [/\bmargen\b|\bcontribuci[oó]n\b/i, "margen"],
  [/\brotaci[oó]n\b|\bgir[oa]\b/i, "rotacion"],
  [/\bcobertura\b|\bdoh\b|\bd[ií]as de inventario\b/i, "cobertura"],
];
// «a la meta», «al objetivo», «al benchmark», «a nuestra referencia», «al nivel definido». Es una ANÁFORA a la
// política, no un número: por eso se reconoce la forma, y el VALOR sale siempre de POLICY.
// `al` es la contracción de «a el» y es la forma MÁS común de escribirlo («al benchmark», «al objetivo»): sin
// ella la anáfora no se reconocía en la mitad de los casos reales. Medido al cerrar el frente.
export const REFERENCIA_ANAFORA_RE = /\b(?:al|a|hasta(?:\s+el|\s+la)?)\s+(?:la|el|los|las|nuestr[oa]s?|su|tu)?\s*(?:meta|objetivo|benchmark|referencia|est[aá]ndar|piso|techo|target|vara|nivel\s+(?:definido|objetivo|de\s+referencia))\b/i;

/* resolverReferencia({ texto, metrica }) → { valor, unidad, label, clave } | null
 * `metrica` explícita gana sobre lo que se infiera del texto: el llamador suele saber de qué se está hablando
 * (la simulación pendiente, por ejemplo, sabe qué campo le falta) y esa certeza vale más que un reconocimiento. */
export function resolverReferencia({ texto = "", metrica = null } = {}) {
  const t = String(texto || "");
  let clave = metrica && REFERENCIA_POR_METRICA[metrica] ? metrica : null;
  if (!clave) {
    const hits = _METRICA_RE.filter(([re]) => re.test(t)).map(([, k]) => k);
    const unicas = [...new Set(hits)];
    if (unicas.length !== 1) return null;   // ninguna o varias → el motor pregunta, no adivina
    clave = unicas[0];
  }
  const ref = REFERENCIA_POR_METRICA[clave];
  const valor = ref ? POLICY[ref.clave] : null;
  if (valor == null || !Number.isFinite(Number(valor))) return null;
  return { valor: Number(valor), unidad: ref.unidad, label: ref.label, clave: ref.clave, metrica: clave };
}

// ── CRITERIO DEL OWNER (C.2 · 2026-07-07) · "mi piso de margen es 28%, no el estándar" ──────────────────────────────
// El usuario puede fijar SU vara ("recordá que mi margen mínimo es 28%") → override del benchmark en el PUNTO ÚNICO:
// pisa tanto el default resuelto (perfil/config) como el benchmark embebido por-fila. null = sin criterio →
// precedencia original intacta (byte-exacto · los gates corren en default). Scopeado por tenant vía criteria.js.
let _benchmarkOverride = null;
export const setBenchmarkOverride = (v) => { _benchmarkOverride = (typeof v === "number" && isFinite(v)) ? v : null; };
export const getBenchmarkOverride = () => _benchmarkOverride;

/* registro GENERALIZADO del override de conversación (C.2), por policyKey — misma mecánica que `_benchmarkOverride`
 * de arriba, pero para TODA llave de POLICY_CONFIG (owner 2026-09-28, §7.3·32: la procedencia de un umbral no se
 * resuelve solo para `benchmark`). Declarado ACÁ, antes de `_resolvePolicy`, para que el reset de tenant (abajo)
 * lo pueda limpiar sin depender de que el resto del archivo ya se haya evaluado. `criteria.js` lo registra al
 * aplicar/olvidar un criterio — es el ÚNICO escritor; `umbral()` (más abajo) es el único lector. */
const _criterioOverride = {};   // { [policyKey]: valor } vigente en conversación, SOLO del tenant activo
export const setCriterioOverride = (policyKey, v) => {
  if (typeof v === "number" && isFinite(v)) _criterioOverride[policyKey] = v;
  else delete _criterioOverride[policyKey];
};
export const criterioOverrideDe = (policyKey) => _criterioOverride[policyKey];
const _clearCriterioOverrides = () => { for (const k of Object.keys(_criterioOverride)) delete _criterioOverride[k]; };

// ── CAPA 2 · resolución del perfil del tenant (defensiva: solo números finitos) ─────────────────────────────────────
const _perfilVal = (key) => {
  const p = getTenantData() && getTenantData().perfil;
  const v = p ? p[key] : undefined;
  return (typeof v === "number" && isFinite(v)) ? v : undefined;
};
// el default VIGENTE de una llave (perfil del tenant ?? config) — lo que "olvidá el criterio" restaura (criteria.js)
export const tenantPolicyDefault = (key) => { const v = _perfilVal(key); return v !== undefined ? v : POLICY_CONFIG[key]; };

function _resolvePolicy() {
  for (const k of Object.keys(POLICY_CONFIG)) POLICY[k] = tenantPolicyDefault(k);
  setBenchmarkOverride(null);   // la vara del usuario NO arrastra entre empresas — criteria.js re-aplica la del tenant activo
  _clearCriterioOverrides();    // idem, generalizado: ningún criterio de conversación de OTRA empresa sobrevive el cambio de tenant
}
_resolvePolicy();                 // al evaluar el módulo: resuelve el tenant activo (demo perfil == config → byte-idéntico)
onTenantChange(_resolvePolicy);   // en cada initTenant: perfil nuevo primero; criteria.js (registrado después) re-aplica C.2 encima

// helper: el benchmark de una entidad — el CRITERIO del usuario manda; si no hay, el dato por-fila; si no, POLICY.
export const benchmarkOf = (entity) => (_benchmarkOverride != null ? _benchmarkOverride : (entity && typeof entity.benchmark === "number" ? entity.benchmark : POLICY.benchmark));

// ── PROCEDENCIA DE LA REFERENCIA (Regla de Proporcionalidad Semántica, owner 2026-08-07) ───────────────────────
// Las TRES capas que resuelve `benchmarkOf` son INTERNAS de la empresa: (1) el criterio que el usuario fijó (C.2),
// (2) el `benchmark` por fila del dataset del tenant, (3) `POLICY.benchmark` del PERFIL. Ninguna viene de una
// fuente sectorial. Por eso la referencia se narra como "tu benchmark" / "tu referencia" / "la meta definida para
// tu negocio", y NUNCA como "estándar del sector", "promedio del mercado" ni "referencia de la industria".
//
// ESTO NO ES UNA OPINIÓN, ES EL ESTADO DEL PRODUCTO: `SECTORAL_BENCHMARKS` existe declarado en
// src/config/scenarios.js pero NO se importa en ninguna parte de `src/` (solo en los monolitos archivados), y sus
// propios comentarios lo marcan `[DERIVADO n=6 SKU]` / `[ASUNCIÓN U.A]` — o sea, derivado del mismo dato demo.
// Mientras eso siga así, "externa_sector" NO se puede producir y toda afirmación sectorial es no autorizada.
// El día que exista una fuente externa real, se cambia ACÁ (una verdad) y el resto del sistema la respeta solo.
/* ── ¿DE QUIÉN ES LA VARA? (owner 2026-08-26) ────────────────────────────────────────────────────────────────
 * Hasta hoy esto era una CONSTANTE —`"interna_empresa"`— y era cierto: el benchmark se le pedía al cliente en la
 * plantilla, así que las tres capas que resuelve `benchmarkOf` eran suyas. Al sacar las políticas de la plantilla
 * v1.6 para reducir fricción, apareció una cuarta posibilidad: que la vara sea LA NUESTRA.
 *
 * ⚠️ LA ORDEN DEL OWNER, textual: «no quiero que la referencia general parezca una meta del cliente». Un negocio
 * que nunca declaró un 30,1% no puede leer «estás 8 puntos bajo TU benchmark»: eso le atribuye un objetivo que no
 * fijó, y encima lo hace sonar como un incumplimiento propio. Es la misma familia de defecto que la regla 1 del
 * proyecto —afirmar más de lo que la evidencia autoriza—, aplicada a de quién es el criterio.
 *
 * POR ESO ES UNA FUNCIÓN Y NO UNA CONSTANTE: depende del tenant activo, y cambia cuando el usuario sube su
 * archivo. Vive acá, al lado de `benchmarkOf`, porque quien resuelve el valor tiene que resolver también de dónde
 * salió — si la procedencia se calculara en otro módulo, habría dos verdades sobre la misma cifra.
 *
 * EL CRITERIO DE CONVERSACIÓN CUENTA COMO PROPIO: si el usuario dijo «mi meta es 32%», esa vara es suya aunque no
 * venga del archivo. */
export const referenciaEsDelNegocio = () =>
  _benchmarkOverride != null || _perfilVal("benchmark") !== undefined;

/** "interna_empresa" cuando la vara la puso el negocio · "general_adi" cuando es la referencia nuestra. */
export const procedenciaDeLaReferencia = () => (referenciaEsDelNegocio() ? "interna_empresa" : "general_adi");

/** Cómo se NOMBRA la vara en pantalla y en la prosa. Una sola redacción para todas las superficies: si cada una
 *  inventa la suya, la mitad va a seguir diciendo «tu benchmark» el día que deje de serlo. */
export const etiquetaDeLaReferencia = () =>
  (referenciaEsDelNegocio() ? "tu benchmark" : "la referencia general de ADI");

/* ── LA MISMA DOCTRINA, PARA LA CARGA COMERCIAL (owner 2026-09-04, defecto cazado por el supervisor) ─────────
 * El análisis del porqué decía «tu target declarado (3.5%)» — y ese 3,5% vive SOLO en `POLICY_CONFIG`: la
 * plantilla no tiene ningún campo para que el cliente lo declare. Es EXACTAMENTE la clase que el owner cerró
 * en agosto con el benchmark: «no quiero que la referencia general parezca una meta del cliente». La
 * infraestructura del valor ya estaba (POLICY resuelve `perfil.targetCarga` si algún día llega); lo que
 * faltaba era decir DE QUIÉN es. Se resuelve igual que la vara y en el mismo archivo, por la misma razón:
 * quien resuelve el valor resuelve la procedencia, o hay dos verdades sobre la misma cifra.
 *
 * ⚠️ REGISTRO: en superficie no se dice «target» (anglicismo) ni «vara» (prohibida). Se dice «nivel de
 * referencia de carga comercial». */
export const cargaEsDelNegocio = () => _perfilVal("targetCarga") !== undefined;

/** "interna_empresa" si el negocio declaró su nivel de carga · "general_adi" si es el nuestro. */
export const procedenciaDeLaCarga = () => (cargaEsDelNegocio() ? "interna_empresa" : "general_adi");

/** Cómo se NOMBRA el nivel de carga en pantalla y en prosa — una sola redacción para todas las superficies. */
export const etiquetaDeLaCarga = () =>
  (cargaEsDelNegocio() ? "tu nivel de carga comercial declarado" : "el nivel de referencia de carga comercial que uso");

/* ── LA MISMA DOCTRINA, PARA EL PISO DE MATERIALIDAD DE FOCOS (owner 2026-09-23, CAU-01) ───────────────────────
 * `materialidadFocoPctVenta` (0.05% de la venta real) es el mismo piso que ya decide "Carga comercial alta" en
 * el detector (`specRetrieval.js:pisoFocosUSD`/`figsUmbralFocos`) — un umbral de POLICY como `targetCarga`, así
 * que se resuelve igual y en el mismo archivo: quien resuelve el valor resuelve de quién es. */
export const materialidadFocoEsDelNegocio = () => _perfilVal("materialidadFocoPctVenta") !== undefined;

/** La frase corta que declara el límite cuando la vara es nuestra, o "" cuando es del negocio. */
export const notaDeLaReferencia = () =>
  (referenciaEsDelNegocio() ? "" : "es la referencia general de ADI, no una meta que tu negocio haya declarado");

/** @deprecated Se conserva por compatibilidad con `narrationContract`; usa `procedenciaDeLaReferencia()`. */
export const REFERENCIA_PROCEDENCIA = "interna_empresa";   // "interna_empresa" | "externa_sector"

// Etiquetas de MÉTRICA que son una REFERENCIA (no una medición del negocio). Se declaran acá, junto al único
// resolvedor (`benchmarkOf`), para que la procedencia no se adivine con un regex esparcido por los composers.
// Los emisores usan estas etiquetas literales: toolRegistry.js (boleta del perfil/margen), entityRecord.js
// (REFS.margen.label) y conversation.js (enumeración) — una sola convención de nombre, ya vigente.
export const METRICAS_DE_REFERENCIA = ["Benchmark de margen"];

// ── COST MODEL (owner 2026-07-31, #56 "simulate v2") ── declaración EXPLÍCITA de cómo se comporta el costo del
// tenant — sin esto, simulateGeneral (toolRegistry.js) no puede calcular margen/contribución bajo un supuesto de
// precio+volumen, solo ventas (degrade honesto, nunca inventa el modelo). NO es numérico → resolución PROPIA,
// AFUERA del loop genérico de `_resolvePolicy` de arriba (que exige `typeof==="number"`, ver `_perfilVal`) — no se
// toca esa función para no arriesgar los ~22 importadores que ya dependen de su comportamiento byte-exacto.
// Default HONESTO: `null` (no autorizado) — ningún tenant lo declara salvo que su PERFIL lo traiga explícito.
const _COST_MODEL_TIPOS = new Set(["variable_total"]);
let _costModelOverride = null;   // C.2-style: override puntual del usuario ("asumamos costo variable") — no re-pregunta cada turno
export const setCostModelOverride = (v) => { _costModelOverride = (v && _COST_MODEL_TIPOS.has(v.tipo)) ? v : null; };
export const getCostModelOverride = () => _costModelOverride;
function _resolveCostModel() {
  const p = getTenantData() && getTenantData().perfil;
  const fromPerfil = (p && p.costModel && _COST_MODEL_TIPOS.has(p.costModel.tipo)) ? p.costModel : null;
  POLICY.costModel = fromPerfil;
  _costModelOverride = null;   // no arrastra entre tenants, mismo criterio que _benchmarkOverride
}
_resolveCostModel();
onTenantChange(_resolveCostModel);
// costModelOf() → el modelo EFECTIVO (criterio del usuario > perfil del tenant > sin autorizar), mismo orden de
// precedencia que benchmarkOf().
export const costModelOf = () => (_costModelOverride != null ? _costModelOverride : POLICY.costModel);

/* ══ PROCEDENCIA DE LOS UMBRALES (owner 2026-09-28 · decisión §7.3·32: «ningún veredicto debe esconder de dónde
 * proviene su criterio») ═══════════════════════════════════════════════════════════════════════════════════════
 * Hasta hoy el ORIGEN de una llave de POLICY se sabía llave por llave y a mano (`referenciaEsDelNegocio`,
 * `cargaEsDelNegocio`, `materialidadFocoEsDelNegocio`, todas con el mismo criterio `_perfilVal(key) !== undefined`
 * repetido tres veces) y NO existía en absoluto para `rotacionMin`/`dohMax`/`sobrestockDohMin`/`quiebre*`: la Mesa
 * Capital decía «según tu benchmark» aunque el umbral fuera el de ADI (diseño §3.1, `DISENO.md` de inventario).
 *
 * `umbral(key, consulta)` es la ÚNICA función de origen para TODA llave de POLICY_CONFIG, en el mismo orden de
 * precedencia que ya resuelve `_resolvePolicy`/`benchmarkOf`, con dos capas nuevas antes:
 *   1. `consulta?.[key]` numérico       → "consulta"      (el encargo: vale para ESA pregunta — §7.3·32(a))
 *   2. override de conversación (C.2)   → "empresa"       (doctrina vigente: «el criterio de conversación cuenta
 *                                                            como propio» — :147-148 arriba)
 *   3. `_perfilVal(key) !== undefined`  → "empresa"       (el perfil que ESTA empresa declaró con su dato)
 *   4. `Number.isFinite(POLICY_CONFIG[key])` → "adi"      (el criterio general de ADI, ajustable por la empresa)
 *   5. si no                            → "sin_declarar"  (nadie lo declaró — nunca se inventa un número)
 *
 * EL PASO 2 SIN IMPORT CIRCULAR: `criteria.js` YA importa este módulo (para `POLICY`/`setBenchmarkOverride`/
 * `tenantPolicyDefault`); si `businessPolicy.js` importara de vuelta `criteria.js` para leer su `_active`, el
 * ciclo rompería el orden de evaluación de los módulos. La solución (ya usada acá mismo para `benchmark` vía
 * `_benchmarkOverride`/`setBenchmarkOverride`) es que el override VIVA en este archivo: `criteria.js` lo
 * REGISTRA (generalización de `setBenchmarkOverride` a cualquier llave, misma mecánica) y `umbral()` lo LEE sin
 * necesitar importar nada de `criteria.js`. Es el camino que el diseño deja como alternativa a exportar
 * `criterioActivoDe(policyKey)` desde `criteria.js` — se prefiere este por no crear el ciclo.
 *
 * Alcance de esta etapa (sin consumidores todavía, diseño §8.1): ESTA función y `umbralesDeInventario()` son la
 * fuente única para `jerarquiaInventario()` (economicDiagnosis.js). Las tres funciones legadas de arriba
 * (`referenciaEsDelNegocio`, `cargaEsDelNegocio`, `materialidadFocoEsDelNegocio`) NO se tocan en esta etapa —
 * convertirlas en alias de `umbral(key).origen === "empresa"` cambiaría el comportamiento de `cargaEsDelNegocio`
 * para un tenant con override de conversación de `target_carga` (hoy esa función solo mira el perfil, no C.2; ver
 * diseño §3.2 «pasan a ser alias…») y esta etapa declara explícitamente «sin consumidores: la suite no se mueve».
 * Se deja para la etapa que las consuma, con el owner al tanto (informe de esta etapa). */
export const ORIGEN = Object.freeze({ EMPRESA: "empresa", ADI: "adi", CONSULTA: "consulta", SIN_DECLARAR: "sin_declarar" });

/** Cómo se NOMBRA cada origen en superficie — una sola redacción para toda la casa (pantalla, indicador, Entrega). */
export const ETIQUETA_ORIGEN = Object.freeze({
  [ORIGEN.EMPRESA]: "declarado por la empresa",
  [ORIGEN.ADI]: "criterio general de ADI, ajustable por la empresa",
  [ORIGEN.CONSULTA]: "planteado en la consulta",
  [ORIGEN.SIN_DECLARAR]: "sin umbral declarado",
});

/** umbral(key, consulta?) → { valor: number|null, origen: ORIGEN.* } — la única resolución de origen de la casa.
 *  (`setCriterioOverride`/`criterioOverrideDe` viven arriba, junto a `_benchmarkOverride`, para que `_resolvePolicy`
 *  los pueda limpiar en el reset de tenant sin depender del orden de evaluación del archivo.) */
export function umbral(key, consulta = null) {
  const deConsulta = consulta && typeof consulta[key] === "number" && isFinite(consulta[key]) ? consulta[key] : undefined;
  if (deConsulta !== undefined) return { valor: deConsulta, origen: ORIGEN.CONSULTA };
  const deConversacion = criterioOverrideDe(key);
  if (deConversacion !== undefined) return { valor: deConversacion, origen: ORIGEN.EMPRESA };
  const dePerfil = _perfilVal(key);
  if (dePerfil !== undefined) return { valor: dePerfil, origen: ORIGEN.EMPRESA };
  const deConfig = POLICY_CONFIG[key];
  if (Number.isFinite(deConfig)) return { valor: deConfig, origen: ORIGEN.ADI };
  return { valor: null, origen: ORIGEN.SIN_DECLARAR };
}

/** Los seis umbrales de inventario, cada uno con su valor y su origen — la fuente única que lee
 *  `jerarquiaInventario()` (economicDiagnosis.js, diseño §2). Sin `consulta`, resuelve perfil/config como hoy. */
export const umbralesDeInventario = (consulta = null) => ({
  rotacionMin: umbral("rotacionMin", consulta),
  dohMax: umbral("dohMax", consulta),
  sobrestockDohMin: umbral("sobrestockDohMin", consulta),
  quiebreRotMin: umbral("quiebreRotMin", consulta),
  quiebreDohMax: umbral("quiebreDohMax", consulta),
  frenadoDiasSinVenta: umbral("frenadoDiasSinVenta", consulta),
});
