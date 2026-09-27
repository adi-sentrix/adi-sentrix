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
 * FUERA DE ALCANCE, a propósito (reportado, no forzado): «con capital frenado», «con saldo vencido», «bajo/sobre
 * el presupuesto» — su eje o su existencia dependen de qué figs trajo el turno (p. ej. «con capital frenado» vale
 * para el eje que la boleta haya traído: sku, bodega, marca o familia, nunca uno fijo), así que no son un
 * conocimiento verdaderamente ESTÁTICO de nombre+eje. Un `base` con esos nombres sigue sin poder declinarse en la
 * validación — se resuelve en tiempo de composición, exactamente como antes de esta decisión. */
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

/** CONJUNTOS_DE_LA_CASA → [{nombre, eje, familia}] · el catálogo ESTÁTICO completo (nombre + eje), sin membresía. */
export const CONJUNTOS_DE_LA_CASA = [..._CARGA, ..._BENCHMARK, ..._ESTADOS];

const _norm = (s) => String(s == null ? "" : s).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
const _porNombre = new Map(CONJUNTOS_DE_LA_CASA.map((c) => [_norm(c.nombre), c]));

/** conjuntoConocido(nombre) → {nombre, eje, familia} | null — busca por nombre normalizado (acentos/mayúsculas
 *  aparte). `null` significa «no es un conjunto que la casa reconozca» — no dice nada sobre si SE PUEDE resolver
 *  su membresía este turno, que sigue siendo pregunta de `_conjuntosConocidos`. */
export function conjuntoConocido(nombre) {
  return _porNombre.get(_norm(nombre)) || null;
}
