/* === ingesta/materialidadColumna.js · CORTE 0b · EL MOTOR DE MATERIALIDAD DE UNA AMBIGÜEDAD DE COLUMNA =========
 *
 * Plan `_ADI_PLAN_PRODUCTO_V2.md`, Parte A §1: «ADI calcula los resultados con cada interpretación posible…
 * y pregunta solo cuando la diferencia es material». Corte del supervisor (2026-09-25): SOLO en el camino
 * heterogéneo (`ingestarLibro.js` + `mapeoDeterministico.js` + `normalizar.js`) — que hoy no tiene llamador de
 * producción — se puede cambiar comportamiento. El camino de la plantilla oficial NO se toca: un título
 * parecido sigue siendo rechazo binario (ley del owner, miles-contra-dólares).
 *
 * QUÉ HACE. Toma UNA ambigüedad que `mapeoDeterministico.proponerMapeo` ya detectó (dos columnas que reclaman el
 * mismo campo, o un encabezado indeciso entre dos campos), construye el dataset del eje con CADA candidata
 * (reusando `normalizarEje`, la misma función pura que usa el camino real), agrega venta/costo/rebates por
 * entidad y en total, deriva contribución y margen con la MISMA fórmula que cita `motorKpi.CALCULOS`
 * (`validationRules` «margen-cierra» + `metricRegistry.METRICS.contribucion.formula`) y compara.
 *
 * ⚠️ EL PISO DE MATERIALIDAD — DECISIÓN QUE SE REPORTA, NO SE DECIDE EN SILENCIO. El piso canónico del Core es
 * `pisoFocosUSD()` (`src/adi/specRetrieval.js`): 0.05 % de la venta REAL del TENANT ACTIVO
 * (`POLICY.materialidadFocoPctVenta`, vía `_loadReal(source)` → `SOURCES[source].load()` → el store del tenant
 * en memoria). Esa función NO SIRVE acá tal cual, por dos motivos verificados en el código, no supuestos:
 *   1. No es pura: lee `getTenantData()`/el tenant ACTIVO, no un dataset que se le pase. Durante una ingesta el
 *      archivo que se está evaluando TODAVÍA NO ES el tenant activo (eso pasa recién en `activarVersion`,
 *      etapa 2) — llamarla acá compararía la carga contra la venta de OTRO negocio (el que esté activo en ese
 *      momento), lo cual sería incorrecto y además no reproducible en un gate (dependería de qué tenant haya
 *      quedado activo en el proceso).
 *   2. Importar `specRetrieval.js` (el compositor central de ADI, ~2000 líneas, con sus propios imports hacia
 *      `boleta.js`, `diagnosis/`, `sentrix/`, etc.) dentro de un módulo puro de INGESTA sería acoplar una capa
 *      de bajo nivel a la capa de negocio completa — exactamente lo que este corte busca evitar (ver la cabecera
 *      de `acta/actaDeIngesta.js`).
 * NO SE INVENTA UN UMBRAL NUEVO: se reusa la MISMA constante y la MISMA fórmula que `pisoFocosUSD()` —
 * `POLICY_CONFIG.materialidadFocoPctVenta` (0.05 % por defecto, la misma referencia que decide "Carga comercial
 * alta" en toda la Mesa) — aplicada sobre la venta de ESTA carga (la única venta que existe en este momento del
 * flujo), no sobre la del tenant activo. Es el piso canónico, calculado sobre la base correcta.
 * ⚠️ REPORTADO AL SUPERVISOR (regla «si el piso no aplica, detente y repórtalo»): esta sustitución —MISMA
 * constante y fórmula, base distinta (la carga, no el tenant activo)— es la única forma en que el piso pudo
 * aplicarse acá; queda documentada para que el supervisor la confirme o la ajuste.
 *
 * PURO · sin red · sin tenant activo · sin mutar nada que reciba.
 */
import { normalizarEje } from "./normalizar.js";
import { SOURCES } from "../config/contract/sourceManifest.js";
import { POLICY_CONFIG } from "../config/businessPolicy.js";

/* Qué campo del contrato guarda cada magnitud (venta/costo/rebates) PARA ESTE eje — derivado de
 * `sourceManifest.SOURCES[eje].schema`, nunca escrito a mano.
 *
 * ⚠️ NO SE DERIVA DE `metricRegistry.sourceByAxis` (primer intento, descartado con datos): la métrica
 * canónica "ventas" del contrato apunta SOLO a `clientesVentas.actual` (decisión D8, «venta oficial por
 * cliente») — `clientesMargen` NUNCA es la fuente de la métrica "ventas" para ningún eje, aunque su propio
 * schema SÍ tenga un campo `venta` (el que usa `validationRules` para comprobar que la contribución cierra).
 * Ir por `sourceByAxis` dejaba `ventas` sin campo para `clientesMargen`/`skusMargen` y toda comparación de
 * materialidad salía en $0 — medido corriendo el motor contra el fixture antes de cerrar este archivo. El
 * schema del EJE MISMO es la fuente correcta: si esta tabla tiene un campo de venta, se llama `actual` o
 * `venta` (las dos formas que ya usa el contrato, nunca una tercera inventada acá). */
function _camposDeEje(eje) {
  const schema = (SOURCES[eje] && SOURCES[eje].schema) || {};
  return {
    ventas: schema.actual ? "actual" : (schema.venta ? "venta" : null),
    costo: schema.costo ? "costo" : null,
    acciones: schema.rebates ? "rebates" : null,
  };
}

/* margen%/contribución de un grupo de filas — LA MISMA fórmula que cita `motorKpi.CALCULOS` («margen» y
 * «contribucion»: 100 − costo% − carga% · venta × margen ÷ 100, validationRules «margen-cierra» /
 * metricRegistry.METRICS.contribucion.formula), aplicada sobre los nombres de campo del contrato de INGESTA
 * (`rebates`, no `acciones` — son el mismo concepto económico, dos contratos distintos ya existentes en el
 * repo: `config/contract/plantilla.js` para la plantilla oficial, `config/contract/sourceManifest.js` para
 * este camino). No es una fórmula nueva: es la misma, sobre el otro vocabulario de campos. */
function _agregar(filas, campos) {
  const sum = (f) => filas.reduce((s, r) => s + (typeof r[f] === "number" ? r[f] : 0), 0);
  const venta = campos.ventas ? sum(campos.ventas) : 0;
  const costo = campos.costo ? sum(campos.costo) : null;
  const rebates = campos.acciones ? sum(campos.acciones) : 0;
  const margen = costo !== null && venta ? 100 - (costo / venta * 100) - (rebates / venta * 100) : null;
  const contribucion = margen !== null ? Math.round(venta * margen / 100) : null;
  return { venta: Math.round(venta), costo: costo === null ? null : Math.round(costo), rebates: Math.round(rebates), margen, contribucion };
}

/** El piso canónico (0.05 % de venta, `POLICY_CONFIG.materialidadFocoPctVenta`), aplicado sobre la venta de ESTA
 *  carga — ver la nota de cabecera sobre por qué no se llama a `specRetrieval.pisoFocosUSD()` directamente. */
export function pisoDeLaCarga(ventaTotal) {
  const pct = typeof POLICY_CONFIG.materialidadFocoPctVenta === "number" ? POLICY_CONFIG.materialidadFocoPctVenta : 0.05;
  return (typeof ventaTotal === "number" ? ventaTotal : 0) * (pct / 100);
}

/* Las OPCIONES de una ambigüedad, en forma uniforme — dos formas posibles en `mapeoDeterministico.ambiguas`:
 *   · colisión: un campo, varias columnas que lo reclaman     → { campo, columnas:[c1,c2,…] }
 *   · indecisa: una columna, varios campos posibles           → { campo:"c1 | c2", columnas:[col] }
 * En los dos casos, cada «opción» es {campo, columna}: qué campo del contrato queda asignado a qué columna del
 * archivo si esa es la interpretación correcta. */
function _opcionesDe(a) {
  if (String(a.campo || "").includes(" | ")) return a.campo.split(" | ").map((campo) => ({ campo, columna: (a.columnas || [])[0] }));
  return (a.columnas || []).map((columna) => ({ campo: a.campo, columna }));
}

/* evaluarAmbiguedad({ eje, filas, mapeoBase, ambiguedad, obligatoria }) → {
 *   candidatas: [{ etiqueta, campo, columna, totales:{venta,costo,rebates,contribucion,margen} }],
 *   deltaMax, metricaComparada, piso, material, accion:"preguntar"|"seguir_declarando",
 *   supuestoElegido: {campo,columna,motivo} | null,
 * }
 *   `filas`      — las filas CRUDAS de la hoja (`hoja.filas` de `leerLibro`, header→valor).
 *   `mapeoBase`  — el mapeo YA resuelto (`prop.mapeo`), sin el campo en disputa.
 *   `ambiguedad` — una entrada de `prop.ambiguas`.
 *   `obligatoria`— si el campo en disputa es obligatorio para este eje (`REQUERIDAS`) — decide si, siendo
 *                  material, esto sigue bloqueando la carga entera (obligatoria) o solo queda pendiente (opcional).
 */
export function evaluarAmbiguedad({ eje, filas, mapeoBase, ambiguedad, obligatoria = false }) {
  const fuente = SOURCES[eje];
  const opciones = _opcionesDe(ambiguedad);
  const campos = _camposDeEje(eje);

  const candidatas = opciones.map((op) => {
    const mapeoVariante = { ...mapeoBase, [op.campo]: { columna: op.columna, unidad: (fuente.schema || {})[op.campo] || null } };
    const norm = normalizarEje({ eje, filas, mapeo: mapeoVariante, unidadesConfirmadas: true });
    const filasNorm = norm.ok ? norm.filas : [];
    const totales = _agregar(filasNorm, campos);
    const porEntidad = {};
    if (norm.ok && fuente.keyField) {
      for (const f of filasNorm) {
        const k = f[fuente.keyField];
        if (k === null || k === undefined) continue;
        if (!porEntidad[k]) porEntidad[k] = [];
        porEntidad[k].push(f);
      }
    }
    const entidades = Object.fromEntries(Object.entries(porEntidad).map(([k, fs]) => [k, _agregar(fs, campos)]));
    return { etiqueta: `${op.campo} = "${op.columna}"`, campo: op.campo, columna: op.columna, ok: norm.ok, totales, entidades };
  });

  const okCandidatas = candidatas.filter((c) => c.ok);
  // metrica comparada: contribución si el eje la puede derivar (tiene costo declarado); si no, venta —
  // que SIEMPRE es comparable (es el campo obligatorio de todo eje comercial) y de todos modos vale $0 de
  // delta si la columna ambigua no afecta la venta, resolviendo honesto a "no material" en ese caso.
  const derivaContribucion = okCandidatas.some((c) => c.totales.contribucion !== null);
  const metricaComparada = derivaContribucion ? "contribucion" : "venta";

  let deltaMax = null;
  if (okCandidatas.length >= 2) {
    const valores = [okCandidatas.map((c) => c.totales[metricaComparada] ?? 0)];
    const entidadesTodas = new Set(okCandidatas.flatMap((c) => Object.keys(c.entidades)));
    for (const e of entidadesTodas) valores.push(okCandidatas.map((c) => (c.entidades[e] || {})[metricaComparada] ?? 0));
    deltaMax = Math.max(...valores.map((vs) => Math.max(...vs) - Math.min(...vs)));
  }

  // el piso se calcula sobre la venta de ESTA carga — la del primer candidato que cargó bien (si el campo en
  // disputa no es la venta misma, todos los candidatos dan la MISMA venta; si lo es, es la mejor aproximación
  // disponible sin conocer todavía la respuesta — ver la nota de cabecera).
  const ventaBase = okCandidatas.length ? okCandidatas[0].totales.venta : null;
  const piso = ventaBase !== null ? pisoDeLaCarga(ventaBase) : null;

  const evaluable = deltaMax !== null && piso !== null;
  const material = evaluable ? deltaMax > piso : null;

  // sin poder evaluar (p. ej. ninguna candidata normalizó bien) se trata como material: no se adivina.
  const accion = !evaluable || material ? "preguntar" : "seguir_declarando";

  // SUPUESTO ELEGIDO cuando NO es material: el orden declarado en el contrato (la posición de la columna en
  // `opciones`, que a su vez respeta el orden en que `mapeoDeterministico` recorrió los encabezados del
  // archivo) — es decir, LA PRIMERA COLUMNA DEL ARCHIVO entre las que reclaman el campo. Determinístico,
  // documentado, y es una de las dos reglas que autorizó el supervisor.
  const supuestoElegido = accion === "seguir_declarando" && okCandidatas.length
    ? { campo: okCandidatas[0].campo, columna: okCandidatas[0].columna, motivo: "primera columna del archivo entre las candidatas (orden de aparición) — la diferencia no es material" }
    : null;

  return { candidatas, deltaMax, metricaComparada, piso, material, accion, supuestoElegido, obligatoria };
}
