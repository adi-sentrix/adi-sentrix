/* === src/adi/notario/conjuntosDeLaCasa.js · EL CATÁLOGO ESTÁTICO DE CONJUNTOS DE LA CASA (§7.3·11) ═══════════════
 * Decisión del coordinador (2026-09-26, completando §7.3·11 del contrato): separa DOS cosas que antes vivían
 * juntas — (a) SABER qué conjuntos existen, con su NOMBRE y su EJE, que es conocimiento ESTÁTICO de la casa (no
 * depende de ninguna fig del turno, solo de qué vocabulario reconoce el producto); y (b) saber QUIÉNES son
 * MIEMBROS de un conjunto, que sí requiere las figs/rankings del turno. Este archivo es SOLO (a).
 *
 * (b) sigue siendo, exactamente como antes, responsabilidad de `notario/verificar.js:_conjuntosConocidos` — ese
 * archivo NO cambia su lógica de resolución de membresía; solo deja de declarar sus nombres a mano y los toma de
 * acá (import de las constantes de la familia CARGA; la familia BENCHMARK y ESTADO se leen de `CONJUNTOS_DE_LA_CASA`
 * más abajo, mismo criterio). `encargo/validar.js` usa `conjuntoConocido(nombre)` para declinar, EN LA VALIDACIÓN
 * (antes de correr ninguna tool), un `universo.base` que no es ningún conjunto de la casa («clientes grandes») o
 * que es un conjunto de OTRO eje («carga comercial alta» —de cliente— con `eje:"sku"`) — sin necesitar resolver
 * membresía para eso, que es justo lo que (a) hace posible.
 *
 * FAMILIAS:
 *   · "carga"      — el detector de brecha comercial (`oracle/datoProyectado.js:descomposicionDeBrecha`), resoluble
 *                     SIN figs del turno (solo tenant + escenario) — importa estas MISMAS constantes como clave de
 *                     `conjuntos{}`, para que el nombre nunca diverja entre los dos archivos.
 *   · "benchmark"  — depende de que el turno haya publicado una fig «Benchmark de margen» para que
 *                     `_conjuntosConocidos` calcule membresía (decisión de diseño de ese archivo, sin cambiar); el
 *                     NOMBRE es estático, la MEMBRESÍA no.
 *   · "estado"     — un estado de la casa (`notario/estados.js:definicionesDeEstados`) citado como `universo.base`
 *                     (el camino normal es `universo.estados`, pero `_conjuntosConocidos` también resuelve el
 *                     nombre del estado como `base` — se declara acá con el MISMO eje que ya declara `estados.js`,
 *                     nunca una segunda tabla).
 *
 * §7.3·16 (decisión del supervisor 2026-09-27): los conjuntos de la casa cuyo eje se conoce DE ANTEMANO van TODOS acá,
 * también los que dependen del ESTADO de cada entidad — «con saldo vencido» (cliente, cobranza: el saldo vencido
 * de una CUENTA) y «con capital frenado» (SKU, la Mesa Capital: el capital frenado de un PRODUCTO) tienen un eje
 * fijo por lo que MIDEN, no por lo que trajo la boleta de un turno cualquiera. Un nombre que no está en este
 * registro es inválido — no hay una lista aparte de «dejar pasar» en `encargo/validar.js`.
 *
 * FUERA DE ALCANCE, a propósito (reportado, no forzado): «bajo/sobre el presupuesto» — depende de qué figs trajo
 * el turno (el plan es un dato del pack, no siempre publicado), así que no es un conocimiento verdaderamente
 * ESTÁTICO todavía. Un `base` con ese nombre sigue sin poder declinarse en la validación — se resuelve en tiempo
 * de composición, igual que antes de esta decisión. */
import { definicionesDeEstados } from "./estados.js";

/* la familia CARGA: constantes, para que `oracle/datoProyectado.js` y `notario/verificar.js` usen la MISMA clave */
export const NOMBRE_CARGA_ALTA = "carga comercial alta";
export const NOMBRE_SOBRE_NIVEL_CARGA = "sobre el nivel declarado de carga";
const _CARGA = [
  { nombre: NOMBRE_CARGA_ALTA, eje: "cliente", familia: "carga" },
  { nombre: NOMBRE_SOBRE_NIVEL_CARGA, eje: "cliente", familia: "carga" },
];

/* la familia BENCHMARK: mismos nombres exactos que ya declara `notario/verificar.js:_conjuntosConocidos` */
const _BENCHMARK = [
  { nombre: "bajo el benchmark", eje: "cliente", familia: "benchmark" },
  { nombre: "sobre el benchmark", eje: "cliente", familia: "benchmark" },
  { nombre: "margen supuesto sobre el benchmark", eje: "cliente", familia: "benchmark" },
  { nombre: "margen supuesto bajo el benchmark", eje: "cliente", familia: "benchmark" },
  { nombre: "SKU bajo el benchmark", eje: "sku", familia: "benchmark" },
  { nombre: "SKU sobre el benchmark", eje: "sku", familia: "benchmark" },
];

/* la familia ESTADO: el mismo registro que ya usa `notario/estados.js` — nunca una segunda tabla */
const _ESTADOS = definicionesDeEstados().map((e) => ({ nombre: e.canon, eje: e.eje, familia: "estado" }));

/* §7.3·16: los conjuntos que dependen del ESTADO de cada entidad pero cuyo EJE es fijo por lo que miden —
 * `notario/verificar.js:_conjuntosConocidos` ya sabe resolver su membresía (saldo vencido > 0 · capital frenado
 * por SKU); acá solo se declara su nombre+eje, con las MISMAS constantes que ese archivo usa, para que el
 * validador pueda reconocerlos sin necesitar las figs del turno. */
export const NOMBRE_CON_SALDO_VENCIDO = "con saldo vencido";
export const NOMBRE_CON_CAPITAL_FRENADO = "con capital frenado";
const _ESTADO_DEPENDIENTE_DE_EJE_FIJO = [
  { nombre: NOMBRE_CON_SALDO_VENCIDO, eje: "cliente", familia: "estado" },
  { nombre: NOMBRE_CON_CAPITAL_FRENADO, eje: "sku", familia: "estado" },
];

/** CONJUNTOS_DE_LA_CASA → [{nombre, eje, familia}] · el catálogo ESTÁTICO completo (nombre + eje), sin membresía. */
export const CONJUNTOS_DE_LA_CASA = [..._CARGA, ..._BENCHMARK, ..._ESTADOS, ..._ESTADO_DEPENDIENTE_DE_EJE_FIJO];

const _norm = (s) => String(s == null ? "" : s).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
const _porNombre = new Map(CONJUNTOS_DE_LA_CASA.map((c) => [_norm(c.nombre), c]));

/** conjuntoConocido(nombre) → {nombre, eje, familia} | null — busca por nombre normalizado (acentos/mayúsculas
 *  aparte). `null` significa «no es un conjunto que la casa reconozca» — no dice nada sobre si SE PUEDE resolver
 *  su membresía este turno, que sigue siendo pregunta de `_conjuntosConocidos`. */
export function conjuntoConocido(nombre) {
  return _porNombre.get(_norm(nombre)) || null;
}

/* §7.3 (supervisor 2026-09-27, diagnóstico v8, tarea 4 del cierre — RAÍZ A4) — la tabla base→(concepto de
 * referencia, métrica natural) que CUALQUIER veredicto sobre un `universo.base` de la familia con referencia
 * numérica (benchmark, nivel declarado de carga) necesita para imprimir SU VALOR (`valorDeReferencia`,
 * `notario/verificar.js`) en la misma oración — «las comparables viajan juntas» sin excepción (§7.3, la ley del
 * supervisor). Vive ACÁ, no en `notario/hechos.js` ni en `notario/verificar.js` por separado, para que los DOS
 * archivos que arman el texto de un veredicto (el libro de hechos y la resolución de conjuntos) lean la MISMA
 * tabla — nunca dos que puedan divergir (el mismo principio que ya declara la cabecera de este archivo para
 * `CONJUNTOS_DE_LA_CASA`). Un `base` que no está acá simplemente no dispara nada — nunca se inventa una familia
 * nueva. */
const _REFERENCIA_DE_BASE = [
  { re: /^bajo\s+el\s+benchmark$/i, concepto: "benchmark", metrica: "margen" },
  { re: /^sobre\s+el\s+benchmark$/i, concepto: "benchmark", metrica: "margen" },
  // «SKU bajo/sobre el benchmark» (raíz A3, §7.3·13): mismo concepto de referencia, métrica de margen de venta del SKU.
  { re: /^SKU\s+bajo\s+el\s+benchmark$/i, concepto: "benchmark", metrica: "margen_venta" },
  { re: /^SKU\s+sobre\s+el\s+benchmark$/i, concepto: "benchmark", metrica: "margen_venta" },
  { re: /^sobre\s+el\s+nivel\s+declarado\s+de\s+carga$/i, concepto: "nivel_carga", metrica: "carga" },
  { re: /^carga\s+comercial\s+alta$/i, concepto: "nivel_carga", metrica: "carga" },
];
/** referenciaDeBase(nombre) → {re, concepto, metrica} | null — el concepto de referencia (para `valorDeReferencia`)
 *  y la métrica natural (para rescatar la cifra propia de una entidad) de un `universo.base` conocido, o `null`
 *  si ese `base` no pertenece a ninguna familia con referencia numérica. */
export function referenciaDeBase(nombre) {
  const s = String(nombre || "").trim();
  if (!s) return null;
  return _REFERENCIA_DE_BASE.find((f) => f.re.test(s)) || null;
}
