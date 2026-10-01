/* === src/adi/entrega/rotulos.js · LA PIEZA DEL RÓTULO (consolidación, paso 2, FAMILIA 4: el rótulo de cada cifra según su concepto) ═══
 * «Una cifra conserva el rótulo de SU concepto: cada concepto pedido lleva su rótulo del léxico (capital inmovilizado ≠ capital inmovilizado
 * crítico; saldo por vencer ≠ saldo pendiente; la venta a crédito se rotula «Venta a crédito»; ventas nunca se rotula «venta a crédito»,
 * aunque coincidan en valor). Las filas de la tabla de señales de la prioridad conservan el rótulo de su señal. Una fig sin clave en el
 * léxico se DECLARA, nunca se imprime con un rótulo crudo» (contrato §7.3·49(f) · 51(f) · 52(a) · 52(e)). Hasta ahora lo decidían 18 sitios
 * (planes de entidad, grupo, universo, comparación y multitema de `componer.js`, las rutas fijas, la iniciativa, la oración de prioridad
 * de `prioridad.js`): unos preguntaban al léxico, otros imprimían el rótulo CRUDO con que el productor publica la cifra («Ventas», «Dias
 * Vencido», «Venta (flujo)», «Cobertura (DOH)», «YoY»). Esta pieza NO agrega comportamiento ni frases: es la regla escrita una vez.
 * La REDACCIÓN de cada oración y su formato siguen en `componer.js`.
 *
 * LO QUE LA PIEZA OFRECE (los sitios le preguntan a ella):
 *   · `rotuloDeLaCasa({ clave | fig | label | concepto })` → `{ clave, rotulo, unidad, sinClave }`: el rótulo del léxico de la clave de esa cifra
 *     (`metricaPorClave(clave).nombre`). Para una fig se resuelve la clave como siempre (exacta, o tolerante cuando la unidad de la fig no la
 *     contradice) y para un rótulo del productor, por su concepto; la «Venta (flujo)» de cobranza es la clave `venta_credito` («Venta a
 *     crédito»), nunca `ventas` (UN RÓTULO NO PUEDE NOMBRAR DOS CAMPOS). Una fig sin clave devuelve `{ clave: null, rotulo: <el del productor>,
 *     sinClave: true }`: quien compone la DECLARA (`declaracionDeFigSinClave`, texto de `config/contract/ausencias.js`), nunca la imprime.
 *   · `rotuloDeClave(clave)` · `rotuloEnOracion(x)` · `rotuloDeDiferencia(x)`: el nombre del léxico, en minúscula para una oración y con su
 *     «Diferencia · » para la fila derivada.
 *   · `rotuloDeSenal(nombre)` · `rotuloDeConcentracion(señal)` · `rotuloDeDiferenciaDeSenal(dimension)`: las filas de la tabla de señales de la
 *     prioridad CONSERVAN el rótulo de su señal («vencido», «atraso», «distancia al benchmark»…: los nombres de `LENTES`, 52e).
 *   · `rotuloDeSimulacion(texto)`: los rótulos de la simulación son del productor de cada simulación (ningún artículo del contrato los cubre):
 *     pasan por acá sin cambio, para que TODO rótulo de una fila de Cifras salga de esta pieza.
 *   · `filaDeCifra({ entidad, tema, rotulo, valor, tipo, id, procedencia, origen?, extra? })`: el ÚNICO constructor de una fila de Cifras.
 *   · `claveDeLaFig(fig)` · `conceptoDeLaFig(label)`: la clave canónica de una fig y el concepto de su rótulo «Entidad · Concepto».
 *   · `declaracionDeFigSinClave(entidades)`: el límite de una fig que el léxico no conoce.
 * PURO: sin red, sin estado, sin lectura del tenant. Importa solo el léxico y los textos de las ausencias del contrato. */
import { metricaPorClave, claveDeMetrica, claveExactaDeMetrica, unidadDeClave } from "../notario/lexico.js";
import { textoFigSinClave, MOTIVO_FIG_SIN_CLAVE } from "../../config/contract/ausencias.js";

const _lab = (f) => String((f && f.label) || "");
/** el concepto de una fig «Entidad · Concepto» (la parte después del primer «·»); sin «·» el rótulo entero */
export const conceptoDeLaFig = (label) => { const p = String(label || "").split("·").map((s) => s.trim()); return p.length >= 2 ? p.slice(1).join(" · ") : String(label || ""); };
const _unidadPlana = (u) => (u === "pp" ? "pct" : u);

/** la clave canónica del CONCEPTO dicho con las palabras del productor (o null). La clave EXACTA (el rótulo es la clave o uno de sus conceptos) nunca se descarta; la tolerante
 *  (el sinónimo corto o la palabra dentro del rótulo) vale solo si la unidad de la fig no contradice la de la métrica (pct ≡ pp): «Venta diaria (unidades)» (`count`) casaba con «ventas» (`money`) por la palabra «venta». */
export function claveDelConcepto(concepto, unidadDeLaFig = null) {
  const c = claveDeMetrica(concepto);
  if (!c || claveExactaDeMetrica(concepto) === c) return c;
  const uc = unidadDeClave(c);
  return uc && unidadDeLaFig && _unidadPlana(uc) !== _unidadPlana(unidadDeLaFig) ? null : c;
}
/** la clave canónica de una fig (con la unidad de la fig como contraste) o null */
export const claveDeLaFig = (fig) => claveDelConcepto(conceptoDeLaFig(_lab(fig)), fig && fig.unit);

/** el rótulo del léxico de una clave (o la clave tal cual si el léxico no la conoce) */
export const rotuloDeClave = (clave) => { const m = metricaPorClave(clave); return m ? m.nombre : clave; };

/** rotuloDeLaCasa({ clave | fig | label | concepto }) → { clave, rotulo, unidad, sinClave }
 *  `clave`: una clave del léxico · `fig`: una fig de la boleta · `label`: su rótulo «Entidad · Concepto» · `concepto`: el concepto dicho con palabras del productor. */
export function rotuloDeLaCasa(x = {}) {
  let clave = null, crudo = "", unidad = null;
  if (x.clave != null) { clave = metricaPorClave(x.clave) ? metricaPorClave(x.clave).clave : null; crudo = String(x.clave); }
  else if (x.fig) { clave = claveDeLaFig(x.fig); crudo = conceptoDeLaFig(_lab(x.fig)); unidad = x.fig.unit || null; }
  else if (x.label != null) { clave = claveDelConcepto(conceptoDeLaFig(x.label)); crudo = conceptoDeLaFig(x.label); }
  else if (x.concepto != null) { clave = claveDelConcepto(String(x.concepto)); crudo = String(x.concepto); }
  if (!clave) return { clave: null, rotulo: crudo, unidad, sinClave: true };
  return { clave, rotulo: rotuloDeClave(clave), unidad: unidadDeClave(clave), sinClave: false };
}
/** el rótulo en minúscula, para una oración («en venta a crédito», «en días de inventario») */
export const rotuloEnOracion = (x) => String(rotuloDeLaCasa(x).rotulo).toLowerCase();
/** el rótulo de la fila derivada de dos cifras del mismo concepto: «Diferencia · Días de inventario» */
export const rotuloDeDiferencia = (x) => `Diferencia · ${rotuloDeLaCasa(x).rotulo}`;

/* ── LA TABLA DE SEÑALES DE LA PRIORIDAD (52e): sus filas conservan el rótulo de su señal ───────────────────────────────────────────── */
/** el rótulo de una fila de la tabla de señales: el NOMBRE de la señal de `prioridadIntegrada.LENTES` («vencido», «atraso», «distancia al benchmark»), tal cual */
export const rotuloDeSenal = (nombre) => String(nombre);
/** la fila derivada de dos señales de una misma dimensión: «Diferencia · materialidad» */
export const rotuloDeDiferenciaDeSenal = (dimension) => `Diferencia · ${dimension}`;
/** la concentración de una señal en el total de su cartera: «Participación del vencido total» */
export const rotuloDeConcentracion = (senal) => `${rotuloDeClave("participacion")} del ${senal} total`;

/** los rótulos de la simulación son los de su productor («Margen actual», «Delta · Venta», «Liberado»): ningún artículo del contrato los cubre; pasan por la pieza sin cambio */
export const rotuloDeSimulacion = (texto) => String(texto);

/* ── LA FILA DE CIFRAS ─────────────────────────────────────────────────────────────────────────────────────────────────────────────── */
/** filaDeCifra({ entidad, tema, rotulo, valor, tipo, id, procedencia, origen?, extra? }) → la fila de la tabla de Cifras (`Entidad / grupo · Tema · Métrica · Valor · Tipo`); el
 *  rótulo es el que la pieza le dio al concepto, nunca uno escrito a mano. `origen` (medido · cobertura) y `extra` (la naturaleza histórica) viajan en la fila solo si existen. */
export function filaDeCifra({ entidad, tema, rotulo, valor, tipo, id, procedencia, origen = null, extra = null }) {
  return { valores: { "Entidad / grupo": entidad, "Tema": tema, "Métrica": rotulo, "Valor": valor, "Tipo": tipo }, hechos: [id], procedencia, ...(origen != null ? { origen } : {}), ...(extra || {}) };
}

/* ── UNA FIG SIN CLAVE EN EL LÉXICO SE DECLARA (52e) ───────────────────────────────────────────────────────────────────────────────── */
/** declaracionDeFigSinClave(entidades) → { titulo, motivo }: el límite de las cifras que el léxico no conoce (el texto vive en `config/contract/ausencias.js`) */
export const declaracionDeFigSinClave = (entidades) => ({ titulo: textoFigSinClave(entidades), motivo: MOTIVO_FIG_SIN_CLAVE });
