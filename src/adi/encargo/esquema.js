/* === src/adi/encargo/esquema.js · LA FORMA DEL ENCARGO v1 (Etapa 1 · Corte 1 · owner 2026-09-25) ═══════════════
 * `_ADI_CONTRATO_ENCARGO_V1.md` es la especificación; este archivo declara SOLO forma y constantes — nada de
 * lógica de validación (eso vive en `validar.js`). Ley del owner citada en el contrato §0: «la comprensión del
 * lenguaje es del LLM»; acá no hay una sola palabra que se lea de una pregunta — todo lo que sigue son listas
 * CERRADAS (enums del propio contrato) o tablas DERIVADAS del Core (nunca copiadas a mano, salvo donde el propio
 * contrato dice que no existe una tabla declarativa y hay que leer el código — eso se documenta caso por caso).
 *
 * PURO · sin I/O · sin red · sin imports de `adi/agente/detectors.js` ni `adi/agente/intentLayer.js` ni ningún
 * reconocedor de frases (regla dura del contrato §0 y §4). */
import { DOMINIOS_REGISTRO } from "../../config/contract/dominios.js";
import { CLAVES_DE_METRICA } from "../notario/lexico.js";
import { METRICS } from "../../config/contract/metricRegistry.js";
import { CONCEPT_DEFS } from "../sentrix/glossary.js";
import { AXES as EJES_DEL_INDICE } from "../oracle/entityIndex.js";
import { BLOCKED_CROSSES } from "../../config/contract/surfaceContract.js";

/* ── topes (§3, tabla «topes») ──────────────────────────────────────────────────────────────────────────────── */
export const PARTES_MAX = 6;   // técnico, ajustable (contrato §7.7 / §7.1): 3 dominios activos × 2 cierres cabe de sobra
/* SUPUESTOS_USUARIO_MAX vive HOY en `oracle/conversationScope.js` (= 3), pero ese módulo importa
 * `entityRecord.js` + `progressiveDisclosure.js` + `conversationalContract.js` — piezas del camino conversacional
 * que el plan v2 marca «retirar» y que este validador no tiene por qué cargar en su grafo de imports (candado 4
 * del gate: «el validador no importa ningún módulo prohibido»). Es una constante NUMÉRICA, no un valor de
 * catálogo (no es un id que haya que derivar de una tabla — es un tope técnico, igual que PARTES_MAX arriba),
 * así que se declara acá con la misma cifra y se deja la nota para que no diverja en silencio si cambia allá. */
export const SUPUESTOS_USUARIO_MAX = 3;   // = conversationScope.js:SUPUESTOS_USUARIO_MAX (no importado, ver nota arriba)

/* ── enums cerrados del contrato (§1, §3) ───────────────────────────────────────────────────────────────────── */
export const CIERRES = ["cifra", "lectura", "decision", "comparacion", "simulacion", "definicion"];
export const EJES = EJES_DEL_INDICE.slice();   // = entityIndex.js:AXES → ["sku","cliente","marca","familia","bodega","canal"]
export const TIPOS_DE_PREMISA = ["cifra", "orden", "relacion", "grupo", "conteo", "variacion", "estado", "razon", "derivada"];
export const USAR_VALORES = ["medido", "declarado"];
export const PROFUNDIDAD_VALORES = ["breve", "completa"];

/* ── los campos válidos de la raíz y de una Parte (para `campo_desconocido`) ────────────────────────────────── */
export const CAMPOS_RAIZ = ["version", "conversacionId", "preguntaOriginal", "partes", "criterio", "supuestos", "premisas", "usar", "profundidad", "contexto"];
export const CAMPOS_PARTE = ["id", "tema", "cierre", "conceptos", "entidades", "eje", "universo", "periodo", "concepto", "supuestos"];

/* ── MOTIVOS (§2.1) — lista cerrada; el gate compara contra esta lista y contra el texto exacto del contrato ── */
export const MOTIVOS = [
  "version_invalida", "encargo_vacio", "partes_tope", "campo_desconocido",
  "tema_desconocido", "tema_ausente", "cierre_desconocido", "cierre_incompleto",
  "cardinalidad", "ejes_mezclados", "concepto_desconocido", "concepto_de_otro_tema",
  "concepto_sin_productor", "entidad_inexistente", "entidad_ambigua", "entidad_eje_incompatible",
  "eje_no_soportado", "cruce_bloqueado", "universo_invalido", "periodo_mal_formado",
  "periodo_no_disponible", "criterio_desconocido", "criterio_tesoreria", "supuesto_mal_formado",
  "supuesto_sin_productor", "supuesto_tope", "origen_no_admitido", "premisa_mal_formada",
  "usar_invalido", "profundidad_invalida", "contexto_no_disponible", "contexto_mal_formado",
];

/* ── CAMPOS de un NoResuelto (§2, el enum de `campo`) ───────────────────────────────────────────────────────── */
export const CAMPOS = ["version", "partes", "tema", "cierre", "concepto", "entidad", "eje", "universo", "periodo",
  "criterio", "supuesto", "premisa", "usar", "profundidad", "contexto", "raiz"];

/* ── conceptos válidos para `definicion` (§3, tabla «conceptos de definición»): CONCEPT_DEFS ∪ CLAVES_DE_METRICA,
 * exactamente como dice el contrato §1.1 («id de CONCEPT_DEFS o clave de CLAVES_DE_METRICA») — se DERIVA de los
 * dos catálogos reales, nunca se copia la lista. */
const _clavesDeMetricaIds = new Set(CLAVES_DE_METRICA.map((m) => m.clave));
const _conceptDefsIds = new Set(Object.keys(CONCEPT_DEFS));
export function conceptoDeDefinicionValido(concepto) {
  return typeof concepto === "string" && (_clavesDeMetricaIds.has(concepto) || _conceptDefsIds.has(concepto));
}

/* ── el productor por (concepto, eje) — §3.3. El implementador la GENERA desde el código: para los conceptos que
 * SÍ tienen una fuente declarativa (`metricRegistry.js:METRICS`), los ejes con productor salen de
 * `METRICS[x].sourceByAxis` (nunca se copian a mano). Para los conceptos que el Core sirve por un camino
 * PROCEDURAL —el detector de brecha (`specRetrieval.js:diagnose`/`descomposicionDeBrecha`, solo por cliente),
 * `mesaFlujo.js` (cobranza, solo por cliente), `mesaCapital.js`/`inventoryStatus{frenado}` (capital_frenado/
 * capital_inmovilizado/dias_sin_venta/margen_inventario, solo SKU y sus agregados) y `marginRead`
 * (markup/peso_costo) — no existe una tabla declarativa que leer: el contrato §3.3 ya deja escrito que esto se
 * verificó LEYENDO esos archivos, y es la tabla residual de abajo, con la MISMA fuente citada ahí. */
const _CLAVE_A_METRICA = {
  ventas: "ventas", margen: "margen", contribucion: "contribucion", costo: "costo", unidades: "unidades",
  carga: "carga", capital: "capital", rotacion: "rotacion",
  dias_inventario: "doh",       // lexico usa "dias_inventario"; metricRegistry usa "doh" — mismo campo, dos nombres
  unidades_stock: "stock",      // idem: "unidades_stock" (léxico) ↔ "stock" (metricRegistry)
};
const _PRODUCTOR_RESIDUAL = {
  // el detector de brecha comercial (diagnose/descomposicionDeBrecha): SOLO por cliente
  no_capturada: ["cliente"], carga_alta: ["cliente"], brecha: ["cliente"], brecha_precio_costo: ["cliente"],
  // mesaCapital.js / inventoryStatus{frenado}: sku, bodega y su agregado por familia (NO marca, a diferencia de la métrica «capital» del registro)
  capital_frenado: ["sku", "bodega", "familia"], capital_inmovilizado: ["sku", "bodega", "familia"],
  dias_sin_venta: ["sku"], margen_inventario: ["sku"],
  /* CORREGIDO (Etapa 1 · Corte 3a, owner 2026-09-25, con evidencia): el contrato §3.3 declaraba `marginRead
   * (causa_precio/causa_costo)` como productor de markup/peso_costo por cliente·sku·marca·familia. Contrastado
   * contra el Core (`_lecturas_gate.mjs` §5): `specRetrieval.js` SÍ calcula `_markup`/`_costShare` en los focos
   * `causa_precio`/`causa_costo`/`subir_precio`, pero SOLO los usa para ORDENAR filas y para la PROSA («markup
   * 12.3%» dentro de `lines`) — ningún `fig()` de todo el archivo (ni de `entityRecord.js`) lleva la etiqueta
   * «Markup» ni «Peso del costo» (grep confirmado: cero resultados). No hay una cifra AUTORIZADA que citar: hoy
   * ningún cierre `cifra` puede servir markup/peso_costo sin inventar un número. `[]` en las dos, en TODOS los
   * ejes, hasta que `specRetrieval.js` publique el fig (entonces se corrige acá, no se restaura a mano). */
  markup: [], peso_costo: [],
  // salesRead (vs_anterior): sku NO (skusMargen no trae anterior)
  variacion: ["cliente", "marca", "familia", "canal"], variacion_usd: ["cliente", "marca", "familia", "canal"],
  ventas_anterior: ["cliente", "marca", "familia", "canal"],
  /* CORREGIDO (Etapa 1 · Corte 3a, con evidencia): el contrato §3.3 declaraba «marca/familia/sku NO». Contrastado:
   * `specRetrieval.js` (`salesRead{focus:"vs_presupuesto"}`) SÍ trae presupuesto real por marca/familia/canal
   * (`_pptoByDim`, con figs por entidad — verificado: «LG · vs ppto», «Línea Blanca · vs ppto», «Retail · vs
   * ppto», valores reales del demo) — SOLO por SKU declina de verdad (la propia tool lo declara: «Por SKU no
   * tengo presupuesto propio — sólo por cliente»), y por bodega declina también (`_ejeNoAbierto`: el dato no baja
   * a ese eje). `["cliente", "marca", "familia", "canal"]`, sku y bodega quedan fuera. */
  vs_presupuesto: ["cliente", "marca", "familia", "canal"], vs_presupuesto_usd: ["cliente", "marca", "familia", "canal"],
  // mesaFlujo.js (flujoComercial): SOLO cliente — marca/familia/sku/canal/bodega ⇒ concepto_sin_productor
  venta_credito: ["cliente"], saldo_vencido: ["cliente"], saldo_pendiente: ["cliente"], saldo_por_vencer: ["cliente"],
  abonado: ["cliente"], recuperado: ["cliente"], dias_vencido: ["cliente"],
  // referencias de la POLICY/perfil (benchmark, nivel_carga, umbral_materialidad, piso_rotacion, techo_cobertura):
  // «se citan, no se ordenan» (contrato §3.3) — ningún eje de entidad las produce como cifra puntual.
  benchmark: [], nivel_carga: [], umbral_materialidad: [], piso_rotacion: [], techo_cobertura: [],
  // margen_promedio es un escalar del negocio (lexico.js: negocio:true) — sin eje de entidad propio.
  margen_promedio: [],
};
/* participación (dominio null en el léxico): tentación derivada, válida en cualquier eje activo — nunca falla por eje. */
const _PARTICIPACION = "participacion";

/* CLAVES que el contrato §3.3 marca «cliente NO (BLOCKED_CROSSES)»: pedir esa métrica por cliente exige conocer
 * qué SKU compra cada cliente — exactamente el cruce cliente×SKU que `surfaceContract.js:BLOCKED_CROSSES`
 * declara sin granularidad atómica. Se cita el registro real (no se reinventa la razón). */
const _CRUCE_BLOQUEADO_CLAVES = new Set(["capital", "unidades_stock"]);
const _CRUCE_CLIENTE_SKU = BLOCKED_CROSSES.find((c) => Array.isArray(c.cross) && c.cross.includes("cliente") && c.cross.includes("sku")) || null;

/** ejesConProductor(clave) → la lista de ejes donde ESA clave tiene productor en el Core hoy (puede ser []). */
export function ejesConProductor(clave) {
  if (clave === _PARTICIPACION) return EJES.slice();
  const m = _CLAVE_A_METRICA[clave];
  if (m && METRICS[m]) return Object.keys(METRICS[m].sourceByAxis || {});
  if (Object.prototype.hasOwnProperty.call(_PRODUCTOR_RESIDUAL, clave)) return _PRODUCTOR_RESIDUAL[clave].slice();
  return [];
}

/** metricaCoreDe(clave) → la clave de `metricRegistry.js:METRICS` que sirve esta clave del léxico (§3.3), o null si
 *  la clave no tiene fuente DECLARATIVA (las del camino procedural — `_PRODUCTOR_RESIDUAL` arriba — no tienen una
 *  métrica de `METRICS` que las nombre; su tool sale de otra tabla, en `lecturasDe.js`, Corte 3a). Aditivo para ese
 *  corte: REUSA `_CLAVE_A_METRICA` (nunca la copia) — es el mismo mapa que ya resuelve `ejesConProductor`, solo que
 *  antes no exponía el NOMBRE de la métrica, solo si tenía o no productor por eje. */
export function metricaCoreDe(clave) {
  return _CLAVE_A_METRICA[clave] || null;
}

/** cruceBloqueadoDe(clave, eje) → el registro de BLOCKED_CROSSES que aplica, o null si ese (clave, eje) no es un
 *  cruce bloqueado (es simplemente `concepto_sin_productor`, sin la razón estructural del cruce). */
export function cruceBloqueadoDe(clave, eje) {
  return (_CRUCE_BLOQUEADO_CLAVES.has(clave) && eje === "cliente") ? _CRUCE_CLIENTE_SKU : null;
}

/** productorDe(clave, eje) → true si esa (clave, eje) tiene productor en el Core (§3.3). */
export function productorDe(clave, eje) {
  return ejesConProductor(clave).includes(eje);
}

/* ── el sujeto por defecto de cada tema (§4d: «default: DOMINIOS_REGISTRO[tema].sujeto») ───────────────────── */
export function sujetoDeTema(tema) {
  const d = DOMINIOS_REGISTRO.find((x) => x.id === tema);
  return d ? d.sujeto : null;
}

/* ── constructores de las formas de salida (§2), sin ninguna lógica: solo la forma ─────────────────────────── */
export function nuevoNoResuelto({ parte = null, campo, valor, motivo, detalle = "", alternativas = [] }) {
  return { parte, campo, valor, motivo, detalle, alternativas: alternativas || [] };
}
export function nuevoAviso(tipo, detalle = "", parte = null) {
  return { tipo, detalle, parte };
}
export function resolucionVacia(encargo) {
  return { ok: false, encargo, partes: [], criterio: null, supuestos: [], premisas: [], noResuelto: [], avisos: [] };
}
