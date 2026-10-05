/* === config/contract/perfilCliente.js · EL PERFIL DEL CLIENTE (plan `_ADI_LLMBUSINESS_PLAN.md` §3, Etapa 2)
 * ═══════════════════════════════════════════════════════════════════════════════════════════════════════════
 * «El motor necesita un perfil (sector, tipo de producto, tamaño, país, modelo comercial) que se captura en la
 * ingesta. Sin perfil no se entrega nada de esta capa: falla cerrado» (plan §3). Este módulo arma ESE perfil
 * con lo que el producto ya tiene hoy — nada más — y declara explícitamente qué falta. Un campo ausente NUNCA
 * se adivina: se declara ausente, con el motivo.
 *
 * ── LO QUE SE MIDIÓ ANTES DE ESCRIBIR ESTO (owner: «medí antes de afirmar, mostrá la sonda») ──────────────────
 * Campo por campo, con archivo y línea:
 *   · SECTOR / SUBSECTOR — NO EXISTE. No hay clave en `plantilla.js:PARAMETROS` (hoja Empresa: solo
 *     empresa_id, empresa_nombre, periodo_actual, moneda — líneas 62-83), no hay pregunta en la pantalla de
 *     carga (`ui/PanelDatos.jsx`, que solo pregunta moneda si falta), no hay columna en
 *     `db/migraciones/001_esquema_base.sql` (tabla `tenants`: id, nombre, estado, created_at) y ningún tenant
 *     de fábrica (`data/tenants/demo.js`, `empresa2.js`) lo declara. Tampoco es derivable con verdad: las
 *     "familias" del dato (`SUPERFAMILIAS`) son categorías de PRODUCTO del cliente, no el rubro del cliente
 *     mismo — un distribuidor de electrodomésticos y un fabricante de electrodomésticos venden las mismas
 *     categorías de producto y son sectores distintos.
 *   · PAÍS — NO EXISTE, mismas tres fuentes revisadas (plantilla, pantalla de carga, esquema de Supabase) sin
 *     el campo. NO se deriva de la moneda: una moneda la comparten varios países (USD, EUR) y esa inferencia
 *     es exactamente la clase de suposición que `config/moneda.js` prohíbe para la moneda misma («la moneda se
 *     declara, nunca se infiere ... ni del país») — la regla corre en las dos direcciones.
 *   · MODELO COMERCIAL — NO EXISTE. Ningún campo declarado distingue distribución/retail/servicios/manufactura,
 *     y no hay señal confiable en el dato para derivarlo sin adivinar (una tabla de clientes con "canal" por
 *     fila dice CÓMO vende cada cuenta, no qué modelo de negocio tiene la empresa).
 *   · MONEDA — SÍ EXISTE, declarada por el cliente: `plantilla.js:PARAMETROS` clave "moneda" (línea 81,
 *     opcional) o, si el archivo no la trae, la pregunta de la pantalla de carga (`ui/PanelDatos.jsx`, con el
 *     mecanismo ya construido: `_probe faltaMoneda` / `datos-moneda`). Vive en `tenant.perfil.moneda` y se lee
 *     con la única función autorizada (`config/moneda.js:monedaDelNegocio` — nunca se re-lee a mano acá).
 *   · TAMAÑO — DERIVABLE EN VALOR, no en categoría. La venta anual REAL (no en miles) sale de
 *     `tenant.ventasKPI.totalActual × factorComercialDe(tenant)` (`figureType.js`, la MISMA función que ya usa
 *     todo el motor para pasar de la escala almacenada a la moneda cruda — `oracle/datoProyectado.js`,
 *     `oracle/entityRecord.js`, `oracle/toolRegistry.js`) — con la moneda de arriba. Es un HECHO medible, no
 *     una opinión. Lo que este módulo NO decide es la BANDA (qué venta anual cuenta como pyme/mediana/grande):
 *     esa es una taxonomía de producto y la frena este módulo — ver el informe de la tarea, §"decisiones
 *     frenadas".
 *
 * PURO. Sin red, sin lógica de UI, sin taxonomía inventada. `notario/hechos.js` (PROCEDENCIAS) es la fuente
 * del vocabulario de procedencia que este módulo REUSA, no reinventa: "medido" (lo declaró el cliente),
 * "derivado" (lo calculó el motor), `null` (no hay valor — nunca "estimacion_referencia"/"supuesto_usuario"/
 * "propuesta" acá, porque ningún campo de este perfil nace de una brecha, de un supuesto de simulación ni de
 * una recomendación).
 *
 * ⚠️ LA MONEDA ES LA EXCEPCIÓN, CORREGIDA POR EL SUPERVISOR (2026-09-26). Los cinco campos del camino B
 * (sector/tipoProducto/país/modeloComercial/tamanoBanda) siguen con el vocabulario de 012: "medido" = lo tipeó
 * el usuario. Para la MONEDA eso era la mezcla de procedencias que prohíbe la ley de los cuatro orígenes del
 * owner (2026-09-25): con `notario/hechos.js:ORIGENES`, "medido" significa lo que ADI MIDE sobre el dato de la
 * empresa — y la moneda nunca se mide ni se deriva, siempre la declara la empresa. Por eso, SOLO para moneda,
 * la procedencia correcta y la que este módulo escribe de ahora en más es **"declarado"** (migración 015: el
 * check de `tenants.moneda_procedencia` ya solo admite ese valor, con los `'medido'` viejos migrados). La
 * LECTURA de acá sigue aceptando el legado `'medido'` de una fila no migrada y lo trata como `'declarado'` —
 * nunca como un tercer significado.
 *
 * NO pasa por `notario/hechos.js:libroDeHechos()` — esa maquinaria verifica CIFRAS de la boleta (una `fig` con
 * `.tipo.verificabilidad`, para arbitrar sumas/restas/razones); estos son campos de IDENTIDAD del tenant, leídos
 * directo del objeto tenant, en el mismo patrón que `entrega/componer.js` ya usa para `marco.empresa` /
 * `marco.moneda`. Decisión de MECÁNICA, no de significado — documentada, no escondida.
 *
 * ── TAREA 1+2 (owner 2026-09-23, `_ADI_PERFIL_VOCABULARIOS_PROPUESTA.md`): LAS BANDAS DE TAMAÑO Y LA SIEMBRA ──
 * «subsector» se renombra a **tipoProducto** acá y en la migración 013 (la propuesta §2, nota: «el plan lo
 * llamaba subsector pero el contenido es tipo de producto» — el owner lo confirmó al usar «tipoProducto» en el
 * encargo mismo). La BANDA de tamaño deja de estar frenada: `bandaTamano.js` la calcula (venta anual ÷ tipo de
 * cambio oficial del mes de cierre, contra las bandas en US$ del criterio general de ADI —owner 2026-10-05; antes se
 * calculaba en UF y esa vía quedó desconectada de este módulo—), nunca se pregunta. El vocabulario de los cinco
 * campos (sector/tipoProducto/modeloComercial/país/tamanoBanda) vive en `taxonomiaPerfil.js` — UNA sola fuente,
 * que este módulo usa para validar cualquier código que llegue por camino B antes de darlo por bueno. */
import { factorComercialDe } from "./figureType.js";
import { monedaDelNegocio } from "../moneda.js";
import { calcularBandaTamano, periodoDeclaradoDe, mesesInformadosDe, textoDeFuenteDeBanda } from "./bandaTamano.js";
import { etiquetaDeProcedencia, ORIGEN } from "../businessPolicy.js";
import { codigoValido, validarTipoProductoDeSector } from "./taxonomiaPerfil.js";

/** El nombre del origen de la banda de tamaño: «criterio general de ADI». Sale de la función única de origen de
 *  `businessPolicy.js` (`etiquetaDeProcedencia`), nunca escrito a mano; se toma solo su primer tramo porque la banda NO
 *  es «ajustable por la empresa» (se calcula, nunca se declara). Jamás «declarado por la empresa» ni «clasificación
 *  oficial» (owner 2026-10-05, bloque «tamaño general de ADI»). */
export const CRITERIO_GENERAL_DE_ADI = String(etiquetaDeProcedencia({ origen: ORIGEN.ADI })).split(",")[0];

/** Los seis campos que el plan §3 nombra, en el orden del encargo. `tipoProducto` — antes «subsector» — es el
 *  nombre que fija la propuesta §2 (tarea 2026-09-23). */
export const CAMPOS_DEL_PERFIL = ["sector", "tipoProducto", "tamano", "pais", "moneda", "modeloComercial"];

/** La forma en que cada campo se nombra en prosa (para un límite de la Entrega, nunca la clave interna cruda). */
export const ETIQUETA_DEL_CAMPO = { sector: "sector", tipoProducto: "tipo de producto", tamano: "tamaño (banda)", pais: "país", moneda: "moneda", modeloComercial: "modelo comercial" };

/* ── CAMINO B (owner 2026-09-23, `db/migraciones/012_perfil_empresa.sql`, SIN APLICAR) ────────────────────────
 * Sector, tipo de producto, país, modelo comercial y la banda de tamaño se capturan FUERA de la plantilla congelada:
 * viven en `tenants` (la fila por EMPRESA), no en el pack (la fila por archivo subido). El camino de lectura
 * es mecánico y no inventa nada: quien arma el `tenant` que le llega a este módulo (hoy `packActivo` en
 * `data/tenantService.server.js`) es responsable de MERGEAR esas columnas dentro de `tenant.perfil` con esta
 * misma forma — `{valor, procedencia}` — antes de llamar a `construirPerfilCliente`. Mientras nadie las
 * mergee (la migración sin aplicar, o un tenant fabricado a mano como TENANT_DEMO), el campo sigue
 * exactamente como declaraba antes de este cambio: ausente, con su motivo — CERO diferencia de comportamiento.
 *
 * ⚠️ CORRECCIÓN DEL SUPERVISOR (2026-09-26, segunda ronda) — LA LEY DE LOS CUATRO ORÍGENES, CAMPO POR CAMPO.
 * El owner, textual, sobre el perfil: «el perfil y la moneda son atributos persistentes de la empresa, no del
 * archivo, y ADI debe recordarlos SIN INFERIRLOS». Sector, tipo de producto, país y modelo comercial los
 * declara SIEMPRE la empresa — nunca los mide ni los deriva ADI — así que su ÚNICA procedencia válida es
 * `"declarado"`; se acepta el legado `"medido"` (012/013, antes de que la 015 corrigiera el vocabulario: ahí
 * "medido" significaba "lo tipeó el usuario") y se traduce igual — nunca `"derivado"`, que ya no es válido
 * para estos cuatro campos. La banda de tamaño es la EXCEPCIÓN INVERSA: `bandaTamano.js` la CALCULA siempre a
 * partir de la venta y el tipo de cambio del mes de cierre — «no se pregunta, se calcula» (owner 2026-09-23) — así que su única procedencia
 * válida es `"derivado"`; un legado `"medido"` para la banda representaría un ajuste manual que la ley ya no
 * admite, y NO se traduce (traducirlo a "derivado" mentiría sobre su origen) — se descarta, igual que la
 * migración 015 lo limpia en la base (nunca se re-etiqueta un origen, ley general: «nunca se reemplaza en
 * silencio» tampoco autoriza a RENOMBRAR un origen que no calza).
 *
 * `_delPerfilDeEmpresa` es la ÚNICA puerta de entrada, y valida FORMA Y VOCABULARIO (owner 2026-09-23, tarea 2:
 * antes solo validaba la forma — «la taxonomía la decide el owner, no este módulo» seguía siendo cierto el día
 * que se escribió, pero el owner YA la decidió, `taxonomiaPerfil.js`, así que dejar pasar un código inventado
 * sería el mismo hueco que un `check` sin sembrar) — un valor con procedencia inválida PARA ESE CAMPO, sin
 * `valor` de texto, o con un código que NO está en la lista cerrada del campo se trata como si no estuviera,
 * la misma defensa en profundidad que ya tiene el trigger de la base (`adi.validar_perfil_tenant()`), no la
 * primera línea de defensa. */
const _CAMPOS_SOLO_DERIVADO = new Set(["tamanoBanda"]);
/** procedenciaNormalizadaPerfilEmpresa(campo, procedenciaCruda) → "declarado" | "derivado" | null
 * La ÚNICA función que decide qué procedencia es válida para un campo del camino B, y a qué se traduce el
 * legado — exportada para que `perfilEmpresaDesdeFilaTenant` y `_delPerfilDeEmpresa` usen la MISMA regla. */
export function procedenciaNormalizadaPerfilEmpresa(campo, procedenciaCruda) {
  if (_CAMPOS_SOLO_DERIVADO.has(campo)) return procedenciaCruda === "derivado" ? "derivado" : null;
  return (procedenciaCruda === "declarado" || procedenciaCruda === "medido") ? "declarado" : null;
}
/** camelCase (como lo usa este módulo y `tenant.perfil`) → snake_case (como lo usa `taxonomiaPerfil.js` y la
 *  base, para que las dos listas sigan siendo la misma verdad sin renombrar ninguna de las dos). */
const _CAMPO_A_TAXONOMIA = { sector: "sector", tipoProducto: "tipo_producto", modeloComercial: "modelo_comercial", pais: "pais", tamanoBanda: "tamano_banda" };
function _delPerfilDeEmpresa(t, campo) {
  const v = t && t.perfil && t.perfil[campo];
  if (!v || typeof v.valor !== "string" || !v.valor) return null;
  const procedencia = procedenciaNormalizadaPerfilEmpresa(campo, v.procedencia);
  if (!procedencia) return null;
  const campoTaxonomia = _CAMPO_A_TAXONOMIA[campo];
  if (campoTaxonomia && !codigoValido(campoTaxonomia, v.valor)) return null;   // código fuera de la lista → rechazado (nunca se cuela, nunca se avisa como "casi")
  return { valor: v.valor, procedencia,
    fuente: `tenant.perfil.${campo} — declarado por la empresa (camino B, fuera de la plantilla; \`db/migraciones/012_perfil_empresa.sql\`, sin aplicar)` };
}

/* perfilEmpresaDesdeFilaTenant(fila) → { campos: {...}, moneda } | null
 * El mapeo INVERSO, puro: de una fila cruda de `tenants` (columnas `<campo>_codigo` / `<campo>_procedencia`,
 * el mismo par que escribe `adi_declarar_perfil_empresa`) a la forma `{valor, procedencia}` que
 * `_delPerfilDeEmpresa` sabe leer. Vive ACÁ y no en el módulo del servidor que hace el `select`, para que el
 * nombre de cada columna se declare en un solo lugar — la misma regla anti-segunda-fuente del resto de la
 * casa. Sigue siendo PURO: recibe una fila ya leída, no la va a buscar. */
const _PARES_PERFIL_TENANT = [
  ["sector", "sector_codigo", "sector_procedencia"],
  ["tipoProducto", "tipo_producto_codigo", "tipo_producto_procedencia"],
  ["pais", "pais_codigo", "pais_procedencia"],
  ["modeloComercial", "modelo_comercial_codigo", "modelo_comercial_procedencia"],
  ["tamanoBanda", "tamano_banda_codigo", "tamano_banda_procedencia"],
];
export function perfilEmpresaDesdeFilaTenant(fila) {
  if (!fila || typeof fila !== "object") return null;
  const campos = {};
  for (const [campo, colValor, colProcedencia] of _PARES_PERFIL_TENANT) {
    const valor = fila[colValor];
    const procedencia = procedenciaNormalizadaPerfilEmpresa(campo, fila[colProcedencia]);
    if (typeof valor === "string" && valor && procedencia) {
      campos[campo] = { valor, procedencia };
    }
  }
  // ★ CORRECCIÓN DEL SUPERVISOR (2026-09-26): la única procedencia válida de la moneda es "declarado"; se acepta
  // también el legado "medido" (012/013, antes de que la 015 corrigiera el vocabulario) y se trata igual — nunca
  // "derivado" (la moneda no se infiere, ni siquiera acá). Sin columna de procedencia (una fila de antes de la
  // 012, o un tenant fabricado a mano sin ese campo) se sigue aceptando por FORMATO solo, como siempre: esta
  // función no vuelve más estricta una fila que ya funcionaba.
  const procedenciaMonedaOk = fila.moneda_procedencia == null || fila.moneda_procedencia === "declarado" || fila.moneda_procedencia === "medido";
  const moneda = typeof fila.moneda === "string" && /^[A-Z]{2,6}$/.test(fila.moneda) && procedenciaMonedaOk ? fila.moneda : null;
  if (!Object.keys(campos).length && !moneda) return null;
  return { campos, moneda };
}

/** construirPerfilCliente(tenant) → { empresa: {id, nombre}, campos: {...}, faltantes: [...], completo } */
export function construirPerfilCliente(tenant) {
  const t = tenant || {};
  const monedaCod = monedaDelNegocio(t);   // "CLP" | null — NUNCA inferida (config/moneda.js, ley del owner)

  // TAMAÑO — el valor (venta anual real) se deriva; la BANDA se CALCULA siempre (propuesta §3, textual: «no se
  // pregunta, se calcula») con `bandaTamano.js` — venta anual ÷ tipo de cambio oficial del mes de cierre,
  // contra las bandas en US$ del criterio general de ADI (owner 2026-10-05; la UF ya no interviene). ★ CORREGIDO (supervisor, 2026-09-26): la puerta de un "ajuste humano manual" de la
  // banda (antes, un valor de camino B con procedencia "medido") queda CERRADA — la ley del owner dice que el
  // perfil "no se infiere", y la banda es la excepción inversa: ADI la calcula, la empresa nunca la declara.
  // `procedenciaNormalizadaPerfilEmpresa("tamanoBanda", ...)` ya no admite "medido" para este campo (SOLO
  // "derivado"), así que `_delPerfilDeEmpresa` nunca devuelve un valor manual acá — `bandaManual` queda
  // siempre `null` y la banda SIEMPRE se calcula. Se deja la forma condicional (en vez de borrar la rama) para
  // que quede documentado qué existía y por qué se cerró, no para dejar una puerta abierta de hecho.
  const ventasKPI = t.ventasKPI || null;
  const tieneVenta = ventasKPI && typeof ventasKPI.totalActual === "number" && Number.isFinite(ventasKPI.totalActual);
  const ventaAnual = tieneVenta ? Math.round(ventasKPI.totalActual * factorComercialDe(t)) : null;
  const bandaDeEmpresa = _delPerfilDeEmpresa(t, "tamanoBanda");
  const bandaManual = bandaDeEmpresa && bandaDeEmpresa.procedencia === "medido" ? bandaDeEmpresa : null;
  const periodoDeclarado = periodoDeclaradoDe(t);
  const bandaCalculada = bandaManual ? null : calcularBandaTamano({
    ventaAnual, moneda: monedaCod, periodo: periodoDeclarado, mesesInformados: mesesInformadosDe(t),
  });
  const tamano = bandaManual
    ? { valor: bandaManual.valor, procedencia: bandaManual.procedencia, fuente: bandaManual.fuente,
        ventaAnual: ventaAnual != null ? { valor: ventaAnual, moneda: monedaCod, procedencia: "derivado", fuente: "tenant.ventasKPI.totalActual × factorComercialDe(tenant)" } : { valor: null, moneda: null, procedencia: null, motivo: "el tenant no trae ventasKPI.totalActual" } }
    : {
        valor: bandaCalculada.banda,
        procedencia: bandaCalculada.procedencia,
        fuente: bandaCalculada.banda ? textoDeFuenteDeBanda(bandaCalculada, CRITERIO_GENERAL_DE_ADI) : null,
        ...(bandaCalculada.banda ? {} : { motivo: bandaCalculada.motivo }),
        insumos: bandaCalculada.insumos,
        ventaAnual: ventaAnual != null
          ? { valor: ventaAnual, moneda: monedaCod, procedencia: "derivado", fuente: "tenant.ventasKPI.totalActual × factorComercialDe(tenant) — ingesta/plantilla/motorKpi.js + config/contract/figureType.js" }
          : { valor: null, moneda: null, procedencia: null, motivo: "el tenant no trae ventasKPI.totalActual" },
      };

  const sectorCampo = _delPerfilDeEmpresa(t, "sector");
  const tipoProductoCrudo = _delPerfilDeEmpresa(t, "tipoProducto");
  // TAREA 3 · candado: tipoProducto no nulo con sector servicios/obras (o sin sector) → rechazado. La validación
  // cruzada vive en `taxonomiaPerfil.js` (una sola regla, la misma que el trigger de la base aplicará) — acá se
  // APLICA, no se reinventa.
  const _validacionTipoProducto = validarTipoProductoDeSector(sectorCampo ? sectorCampo.valor : null, tipoProductoCrudo ? tipoProductoCrudo.valor : null);
  const tipoProductoCampo = (tipoProductoCrudo && _validacionTipoProducto.ok) ? tipoProductoCrudo : null;

  const campos = {
    sector: sectorCampo || {
      valor: null, procedencia: null, fuente: null,
      motivo: "no se declara en la plantilla (hoja Empresa) ni en la pantalla de carga, y no hay un campo del dato del que derivarlo sin adivinar",
    },
    tipoProducto: tipoProductoCampo || {
      valor: null, procedencia: null, fuente: null,
      motivo: (tipoProductoCrudo && !_validacionTipoProducto.ok)
        ? `declarado pero rechazado: ${_validacionTipoProducto.motivo}`
        : "mismo hueco que sector, con más detalle — depende de que exista sector primero, y solo aplica a distribución, fabricación y minorista",
    },
    tamano,
    pais: _delPerfilDeEmpresa(t, "pais") || {
      valor: null, procedencia: null, fuente: null,
      motivo: "no se declara en la plantilla ni en la pantalla de carga; no se deriva de la moneda (varios países comparten moneda — la misma ley que prohíbe inferir la moneda corre también en esta dirección)",
    },
    moneda: monedaCod
      // ★ CORREGIDO (supervisor, 2026-09-26): "declarado", no "medido" — la moneda siempre la declara la
      // empresa (por el archivo o por la pantalla de carga), nunca la mide ADI ni la deriva el motor; con la
      // ley de los cuatro orígenes, "medido" es lo que ADI mide sobre el dato, no lo que la empresa declara.
      ? { valor: monedaCod, procedencia: "declarado", fuente: "tenant.perfil.moneda — hoja Empresa (config/contract/plantilla.js:PARAMETROS clave \"moneda\") o la pantalla de carga si el archivo no la trae (ui/PanelDatos.jsx), o heredada de una carga anterior de la misma empresa (camino B, `tenants.moneda`)" }
      : { valor: null, procedencia: null, fuente: null, motivo: "el cliente todavía no la declaró (ni en el archivo ni en la pantalla de carga, ni en una carga anterior de esta empresa)" },
    modeloComercial: _delPerfilDeEmpresa(t, "modeloComercial") || {
      valor: null, procedencia: null, fuente: null,
      motivo: "no se declara en la plantilla ni en la pantalla de carga, y no hay un campo del dato del que derivarlo sin adivinar (el canal por cliente dice cómo vende CADA cuenta, no el modelo de negocio de la empresa)",
    },
  };

  // "Completo" mira el campo que un catálogo necesitaría para EMPAREJAR (la banda de tamaño, no el número de
  // venta anual crudo) — un número solo no dice si esta empresa es grande o chica sin una banda declarada.
  const faltantes = CAMPOS_DEL_PERFIL.filter((c) => (campos[c] ? campos[c].valor : null) == null);
  const completo = faltantes.length === 0;

  return { empresa: { id: t.id || null, nombre: t.nombre || null }, campos, faltantes, completo };
}

/** perfilAutorizaConocimiento(perfil) → boolean — la ley dura del plan §3, textual: «sin perfil no se entrega
 *  nada de esta capa: falla cerrado». Con cualquier campo del perfil faltante, la respuesta es `false` — sin
 *  excepciones ni "casi completo". */
export function perfilAutorizaConocimiento(perfil) {
  return Boolean(perfil && perfil.completo === true);
}

/** EL CATÁLOGO — Etapa 3 del plan («Knowledge v0», horas del owner y el socio). NO construido todavía: vacío,
 *  real, no un placeholder con forma de contenido. Cuando exista, cada ítem declarará a qué perfil aplica —
 *  esa forma (los nueve campos del plan §3) es una decisión de producto que esta tarea no toma. */
export const CATALOGO_CONOCIMIENTO_DEL_OFICIO = [];

/** seleccionarConocimientoDelOficio(perfil, catalogo) → los ítems del catálogo que esta Entrega puede citar.
 *  EL ENGANCHE, probado con el catálogo vacío (owner, textual: «dejá el enganche listo y probado con el
 *  catálogo vacío»): con perfil incompleto da SIEMPRE `[]`, sin que importe qué traiga `catalogo` — el candado
 *  no confía en que el catálogo esté vacío hoy, confía en el perfil completo primero. El día que la Etapa 3
 *  llene el catálogo, ESTA función sigue siendo el único lugar que decide si algo se usa; el EMPAREJAMIENTO por
 *  contenido (qué cuenta como "calce" con el perfil) es trabajo de esa etapa, no de este corte — hoy, con
 *  perfil completo, se limita a devolver el catálogo tal cual (que está vacío). */
export function seleccionarConocimientoDelOficio(perfil, catalogo = CATALOGO_CONOCIMIENTO_DEL_OFICIO) {
  if (!perfilAutorizaConocimiento(perfil)) return [];
  return Array.isArray(catalogo) ? catalogo : [];
}
