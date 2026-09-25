/* === ingesta/acta/actaDeIngesta.js · EL ACTA DE INGESTA (CORTE 0a · 2026-09-25) ================================
 *
 * Plan vigente `_ADI_PLAN_PRODUCTO_V2.md`, Parte A §1 + Parte B §B2: «El Acta de ingesta, que ADI devuelve por
 * cada carga». Este corte la construye SOBRE LO QUE YA EXISTE, de forma ADITIVA — la ingesta de hoy
 * (`ingestarPlantilla` · `ingestarLibro`) no cambia su comportamiento ni su salida; `actaDeIngesta` es una
 * capa de lectura pura por encima de lo que esos dos caminos ya producen.
 *
 * ── LOS DOS CAMINOS QUE HOY EXISTEN, VERIFICADOS ANTES DE ESCRIBIR ESTE ARCHIVO ─────────────────────────────
 * 1. **Plantilla oficial** (`plantilla/ingestarPlantilla.js`, el camino EN PRODUCCIÓN, `handleIngesta.server.js`
 *    solo llama a este): portero estricto (`validarPlantilla`), motor de fórmulas declaradas (`motorKpi`),
 *    disponibilidad derivada del contrato (`disponibilidad.js`). Una columna fuera de contrato RECHAZA el
 *    archivo entero — no hay «columna desconocida que pasa» en este camino, por diseño.
 * 2. **Archivo heterogéneo** (`ingestarLibro.js` + `mapeoDeterministico.js` + `normalizar.js`, vía 2 · fase 1):
 *    CONSTRUIDO Y APARTADO — no lo llama ningún endpoint de producción (grep confirmado: solo se importan entre
 *    sí y desde sus propios gates). Es el camino permisivo: resuelve lo obvio (nombre exacto o sinónimo
 *    DECLARADO en `config/contract/ingestaColumnas.js`), declara lo demás como ambiguo o «sin resolver» — la
 *    lista de trabajo que más adelante propone un modelo y confirma una persona (todavía no construido; el
 *    corte 0b/siguiente). Y tiene su propio cerrojo de escala: sin `unidadesConfirmadas` no normaliza un
 *    número (bloqueo `unidades-sin-confirmar`), que es EXACTAMENTE el punto donde la escala se debe preguntar.
 *
 * `actaDeIngesta` acepta el resultado de CUALQUIERA de los dos (`{ ok, dataset, preview, ... }`) y arma la MISMA
 * forma de Acta para los dos — el tipo de carga se detecta por la FORMA del resultado (ver `_detectarTipo`),
 * nunca se le pide al llamador que lo declare a mano, para que esto no se desincronice del pipeline real.
 *
 * ── LO QUE ESTE CORTE NO HACE (CORTE 0b, con la interfaz ya declarada) ──────────────────────────────────────
 * El plan (Parte A §1): «ADI calcula los resultados con cada interpretación posible… y pregunta solo cuando la
 * diferencia es material». Ese motor —correr el cálculo con cada candidata y comparar contra el piso de
 * materialidad— NO se implementa acá. `ambiguedades[].materialidad` queda con sus tres campos en `null` a
 * propósito, y `accion` siempre resuelve a `"preguntar"` (el default seguro mientras no hay materialidad
 * medida: no se adivina cuál interpretación es la buena). Las ambigüedades reales que el corte 0b va a tener
 * que evaluar están listadas en el reporte de la entrega, no en este comentario.
 *
 * ── FUNCIÓN PURA ─────────────────────────────────────────────────────────────────────────────────────────────
 * Sin red, sin modelo, sin leer el tenant activo ni ninguna base de datos. Toma el resultado YA CALCULADO de la
 * ingesta (y, opcionalmente, lo que la empresa ya tiene guardado — `memoriaEmpresa`, la persistencia es de la
 * ETAPA 2 y acá solo se LEE lo que el llamador pase) y arma la lectura declarativa. Nada de esto decide nada
 * nuevo: todo origen, todo rótulo y toda cifra citada salen del contrato o del resultado que ya trae la ingesta.
 */
import { HOJAS, PARAMETROS, columnaProhibida } from "../../config/contract/plantilla.js";
import { CALCULOS, BLOQUEADOS } from "../plantilla/motorKpi.js";
import { ausenciasDe } from "../../config/contract/ausencias.js";
import { severidadAviso } from "../../config/contract/avisoSeveridad.js";
import { monedaLimpia, MONEDAS_CONOCIDAS } from "../../config/moneda.js";
import { leerPlausibilidad } from "../plausibilidad.js";
import { umbralesDe } from "../umbrales.js";

/* ── el rótulo canónico de cada parámetro de cabecera, UNA sola vez — lo usan las preguntas de fundamentales */
const _PARAM = (clave) => PARAMETROS.find((p) => p.clave === clave) || null;

/* ¿esto es el resultado de `ingestarPlantilla` o de `ingestarLibro`? Se mira la FORMA, no se le pregunta al
 * llamador — así el Acta nunca se desincroniza si alguno de los dos caminos cambia su forma de responder.
 *   · `ingestarPlantilla` siempre trae `preview.version` (la versión de la plantilla, `v.version` de
 *     `validarPlantilla`) — hasta cuando el archivo se rechaza, porque `validarPlantilla` la identifica ANTES
 *     de mirar el resto.
 *   · `ingestarLibro` siempre trae `preview.formato` (lo que devuelve `leerLibro`: "xlsx" | "csv") — un campo
 *     que el camino de la plantilla no tiene, porque ese formato lo decide `leerLibro`, no `validarPlantilla`. */
function _detectarTipo(resultado) {
  const p = (resultado && resultado.preview) || {};
  if ("version" in p) return "negocio";        // plantilla oficial · vocabulario del plan B2 (carga.tipo)
  if ("formato" in p) return "heterogeneo";
  return "desconocido";
}

/* ═══ 1 · COLUMNAS ═══════════════════════════════════════════════════════════════════════════════════════════
 * `columnas[]`: por columna del CONTRATO (nunca del archivo — el contrato es la lista, el archivo dice si cada
 * una llegó), campo, origen, estado y unidad/escala declaradas. */

function _columnasNegocio(resultado) {
  const v = resultado.preview;
  const dataset = resultado.dataset;
  const out = [];
  const porHoja = new Map((v.hojas || []).map((h) => [h.hoja, h]));
  // las ausencias YA las calculó `ingestarPlantilla` comparando contra `HOJAS` — se LEEN, no se recalculan
  // (única verdad: `dataset.avisosDeCarga`, ver ingestarPlantilla.js líneas 76-102).
  const ausenciaDe = (hoja, columnaTitulo) =>
    (dataset && dataset.avisosDeCarga || []).find((a) => a.tipo === "columna-ausente" && a.hoja === hoja && a.columna === columnaTitulo);

  for (const def of HOJAS) {
    const info = porHoja.get(def.nombre);
    const hojaAusente = !info || !info.presente || !info.filas;
    if (hojaAusente) {
      const motivo = !info || !info.presente ? `la hoja «${def.nombre}» no vino en el archivo` : `la hoja «${def.nombre}» vino sin ninguna fila`;
      for (const c of def.columnas) out.push({ hoja: def.nombre, columna: c.titulo, campo: c.campo, origen: null, estado: "pendiente", motivo });
      continue;
    }
    const traidas = new Map((info.columnas || []).map((c) => [c.campo, c]));
    for (const c of def.columnas) {
      const col = traidas.get(c.campo);
      if (!col) {
        const a = ausenciaDe(def.nombre, c.titulo);
        out.push({ hoja: def.nombre, columna: c.titulo, campo: c.campo, origen: null, estado: "pendiente",
          motivo: a ? a.detalle : `«${def.nombre}» no trae la columna "${c.titulo}"` });
        continue;
      }
      // ¿quedó vacía en TODAS las filas? Ese aviso ya lo declaró `validarPlantilla` (`columna-opcional-vacia`).
      const avisoVacia = (v.avisos || []).find((a) => a.tipo === "columna-opcional-vacia" && a.hoja === def.nombre && a.columna === c.titulo);
      const todasVacias = avisoVacia && avisoVacia.filas >= info.filas && info.filas > 0;
      out.push({ hoja: def.nombre, columna: c.titulo, campo: c.campo, origen: "plantilla",
        estado: todasVacias ? "ignorada" : "usada",
        ...(todasVacias ? { motivo: `vino vacía en las ${avisoVacia.filas} filas del archivo` } : {}),
        ...(avisoVacia && !todasVacias ? { parcial: `vacía en ${avisoVacia.filas} de ${info.filas} filas` } : {}) });
    }
    // columnas RECHAZADAS (prohibidas / con título parecido) — solo pueden aparecer cuando el archivo entero
    // se rechazó (`v.ok === false`): una columna calculada o ambigua siempre es un bloqueo en este camino.
    for (const t of info.prohibidas || []) {
      const p = columnaProhibida(t);
      out.push({ hoja: def.nombre, columna: t, campo: null, origen: null, estado: "bloqueante",
        motivo: p ? `${p.porque} — mandá ${p.enSuLugar} en su lugar` : `«${t}» no es una columna de la plantilla` });
    }
    for (const a of info.ambiguas || []) {
      out.push({ hoja: def.nombre, columna: a.vino, campo: null, origen: null, estado: "bloqueante",
        motivo: `título parecido a "${a.esperado}" pero no idéntico — no se acepta como equivalente (la lección de miles-contra-dólares)` });
    }
  }
  return out;
}

function _columnasHeterogeneo(resultado) {
  const preview = resultado.preview;
  const out = [];
  for (const h of preview.hojas || []) {
    if (!h.eje) {
      for (const enc of h.encabezados || []) {
        out.push({ hoja: h.hoja, columna: enc, campo: null, origen: null, estado: "pendiente", motivo: `hoja sin eje asignado: ${h.motivo}` });
      }
      continue;
    }
    for (const m of h.mapeo || []) {
      // "nombre exacto" y "sinónimo…" son las dos formas que YA declaró `ingestaColumnas.js` — las dos son,
      // para el vocabulario del Acta, la misma cosa: una forma que el CONTRATO reconoce, no la plantilla oficial.
      out.push({ hoja: h.hoja, columna: m.columna, campo: m.campo, origen: "sinonimo_declarado", estado: "usada", unidad: m.unidad, viaDetalle: m.via });
    }
    for (const a of h.ambiguas || []) {
      out.push({ hoja: h.hoja, columna: (a.columnas || []).join(" / ") || null, campo: (a.campo || "").includes(" | ") ? null : a.campo || null,
        origen: null, estado: "pendiente", motivo: a.motivo || `colisión sin resolver para "${a.campo}"` });
    }
    for (const enc of h.sinResolver || []) {
      out.push({ hoja: h.hoja, columna: enc, campo: null, origen: null, estado: "pendiente",
        motivo: "columna no reconocida por el contrato — pendiente de propuesta del modelo y confirmación humana (corte siguiente)" });
    }
    for (const f of h.faltantes || []) {
      out.push({ hoja: h.hoja, columna: null, campo: f.campo, origen: null, estado: "bloqueante",
        motivo: `columna obligatoria "${f.campo}" (${f.unidad || "sin unidad declarada"}) ausente para el eje ${h.eje} — el eje no existe sin ella` });
    }
  }
  return out;
}

/* ═══ 2 · FUNDAMENTALES ══════════════════════════════════════════════════════════════════════════════════════
 * moneda, escala, período, eje de entidad. Ley del owner: moneda y escala JAMÁS se infieren — si no vienen
 * declaradas (ni en el archivo ni en lo que la empresa ya confirmó antes), se preguntan siempre. */

function _fundamentales({ tipo, resultado, memoriaEmpresa }) {
  const dataset = resultado.dataset;
  const preview = resultado.preview;

  // moneda · orden: lo que trajo ESTE archivo → lo que la empresa ya tenía declarado → nada (se pregunta)
  const monedaArchivo = dataset && dataset.perfil ? monedaLimpia(dataset.perfil.moneda) : null;
  const monedaMemoria = memoriaEmpresa ? monedaLimpia(memoriaEmpresa.moneda) : null;
  const moneda = monedaArchivo
    ? { valor: monedaArchivo, origen: "archivo" }
    : monedaMemoria
    ? { valor: monedaMemoria, origen: "memoria_empresa" }
    : { valor: null, origen: "preguntar" };

  // escala · en el camino de la plantilla el motor SIEMPRE fija "raw" (los montos son los que trae el archivo,
  // nunca miles inferidos — `motorKpi.js` línea ~417): no hay nada que preguntar, está declarada por diseño.
  // En el camino heterogéneo la escala ES el cerrojo `unidadesConfirmadas`: sin él, `normalizar.js` bloquea
  // TODO el eje con `unidades-sin-confirmar` — ese bloqueo, leído acá, ES la pregunta obligatoria de escala.
  let escala;
  if (tipo === "negocio") {
    escala = dataset ? { valor: dataset.escalaComercial, origen: "declarada_por_motor" } : { valor: null, origen: "sin_dataset" };
  } else {
    const camposSinConfirmar = [];
    for (const b of preview.bloqueos || []) if (b.tipo === "unidades-sin-confirmar") camposSinConfirmar.push(...(b.campos || []));
    for (const h of preview.hojas || []) for (const b of h.bloqueos || []) if (b.tipo === "unidades-sin-confirmar") camposSinConfirmar.push(...(b.campos || []));
    escala = camposSinConfirmar.length
      ? { valor: null, origen: "preguntar", campos: camposSinConfirmar }
      : (dataset ? { valor: dataset.escalaComercial, origen: "declarada_por_motor" } : { valor: null, origen: "sin_dataset" });
  }

  // período · lo único que el contrato pide como parámetro es la fecha de cierre; el resto (actual/anterior)
  // lo deriva el motor sumando los períodos que trajeron las filas — se lee, no se recalcula acá.
  const periodo = (preview.parametros && preview.parametros.periodo_actual) || (preview.periodos && preview.periodos.actual)
    ? { fechaCierre: (preview.parametros && preview.parametros.periodo_actual) || null,
        actual: (preview.periodos && preview.periodos.actual) || null,
        anterior: (preview.periodos && preview.periodos.anterior) || null }
    : { fechaCierre: null, actual: null, anterior: null };

  // eje de entidad · hoy el único eje primario que la plantilla declara es "cliente" (columna obligatoria de
  // Ventas); se declara presente si el dataset trae filas de cliente, ausente si no.
  const hayClientes = !!(dataset && ((dataset.clientesVentas && dataset.clientesVentas.length) || (dataset.clientesMargen && dataset.clientesMargen.length)));
  const entidadEje = hayClientes ? { valor: "cliente", origen: "declarada_por_contrato" } : { valor: null, origen: "sin_dataset" };

  return { moneda, escala, periodo, entidadEje };
}

/* ═══ 3 · AMBIGÜEDADES ═══════════════════════════════════════════════════════════════════════════════════════
 * La ESTRUCTURA completa del pseudo-JSON del plan (B2), poblada con lo que el pipeline YA detecta como ambiguo.
 *
 * ⚠️ EL MOTOR DE MATERIALIDAD (CORTE 0b, 2026-09-25) SOLO CORRE EN EL CAMINO HETEROGÉNEO — autorización explícita
 * del supervisor: el camino de la plantilla oficial NO se toca (un título parecido a "Venta" sigue siendo
 * rechazo binario, ley del owner sobre miles-contra-dólares). Por eso `_ambiguedadNegocio` sigue con
 * `materialidad` en `null` y `accion:"preguntar"` fijo — es la MISMA función de la etapa anterior, sin cambios.
 * `_ambiguedadHeterogeneo` ahora LEE el resultado real que `ingestarLibro.js` ya calculó (`a.materialidad`,
 * `evaluarAmbiguedad` de `materialidadColumna.js`) — el Acta no vuelve a correr el motor, solo lo reporta. */

function _ambiguedadNegocio(h, a, i) {
  return {
    id: `amb-negocio-${i}`, campo: null, hoja: h.hoja,
    candidatas: [
      { interpretacion: `la columna se llama "${a.vino}", literal (no es un título del contrato)`, resultados: [] },
      { interpretacion: `se trata como "${a.esperado}" (el título oficial más parecido)`, resultados: [] },
    ],
    materialidad: { deltaMax: null, piso: null, material: null },   // el camino negocio NO evalúa materialidad — decisión del owner, no de este corte
    accion: "preguntar",
    supuestoElegido: null,
    pregunta: {
      texto: `«${h.hoja}» trae la columna "${a.vino}": ¿es lo mismo que "${a.esperado}" o es otra cosa?`,
      opciones: [`es "${a.esperado}"`, "es otra columna — corregí el título en el archivo y volvé a subirlo"],
    },
  };
}

const _money = (v) => (typeof v === "number" ? `$${Math.round(v).toLocaleString("es-CL")}` : "—");

function _ambiguedadHeterogeneo(h, a, i) {
  const columnas = a.columnas || [];
  const m = a.materialidad;   // null si no se pudo evaluar (unidades sin confirmar) — ver evaluarAmbiguedad

  // candidatas CON resultados reales cuando el motor corrió; sin él, la interfaz queda igual que antes
  // (interpretación sin resultados) — el pipeline no inventa una cifra que no calculó.
  const candidatas = m
    ? m.candidatas.map((c) => ({
        interpretacion: c.etiqueta,
        resultados: [{ metrica: m.metricaComparada, valor: c.totales[m.metricaComparada] },
                     { metrica: "venta", valor: c.totales.venta }].filter((r) => r.valor !== null),
      }))
    : (columnas.length
        ? columnas.map((col) => ({ interpretacion: `"${col}" es la columna de ${a.campo}`, resultados: [] }))
        : [{ interpretacion: a.motivo || `colisión sin resolver en "${h.hoja}"`, resultados: [] }]);

  // el texto de la pregunta lleva las CIFRAS de cada candidata cuando existen (requisito del supervisor,
  // corte 0b·(a)) — construido a partir de datos ya calculados, no redacción libre sobre negocio.
  const conCifras = m && m.candidatas.some((c) => c.totales[m.metricaComparada] !== null);
  const texto = conCifras
    ? `«${h.hoja}»: "${a.campo}" es ambiguo entre ${m.candidatas.length} columnas y la diferencia en ${m.metricaComparada} es material (${_money(m.deltaMax)}, piso ${_money(m.piso)}) — ${m.candidatas.map((c) => `${c.etiqueta} → ${_money(c.totales[m.metricaComparada])}`).join(" · ")}. ¿cuál es la correcta?`
    : (a.motivo || `«${h.hoja}»: columna ambigua para "${a.campo}"`);

  return {
    id: `amb-heterogeneo-${i}`, campo: (a.campo || "").includes(" | ") ? null : a.campo || null, hoja: h.hoja,
    candidatas,
    materialidad: m ? { deltaMax: m.deltaMax, piso: m.piso, material: m.material, metricaComparada: m.metricaComparada } : { deltaMax: null, piso: null, material: null },
    accion: "preguntar",   // solo llegan acá las que NO se resolvieron solas — las no-materiales ya se resolvieron en ingestarLibro.js
    supuestoElegido: null,
    pregunta: { texto, opciones: columnas.length ? columnas.map((col) => `usar "${col}" para ${a.campo}`) : ["decidir a mano"] },
  };
}

function _ambiguedades({ tipo, resultado }) {
  const out = [];
  let i = 0;
  const preview = resultado.preview;
  for (const h of preview.hojas || []) {
    for (const a of h.ambiguas || []) {
      i += 1;
      out.push(tipo === "negocio" ? _ambiguedadNegocio(h, a, i) : _ambiguedadHeterogeneo(h, a, i));
    }
  }
  return out;
}

/* ═══ 4 · CAPACIDADES ════════════════════════════════════════════════════════════════════════════════════════
 * Derivadas de `CALCULOS`/`BLOQUEADOS` (camino de la plantilla, la lista auditable de `motorKpi.js`) o de
 * `disponibilidadSentrix` (camino heterogéneo, que no corre el motor — deriva de `metricRegistry.sourceByAxis`,
 * la misma fuente que declara `disponibilidad.js`). Nunca una lista escrita a mano acá. */

function _capacidades({ tipo, resultado }) {
  const dataset = resultado.dataset;
  const disp = resultado.preview.disponibilidad || null;

  let calculables, bloqueadas;
  if (tipo === "negocio") {
    calculables = CALCULOS; bloqueadas = BLOQUEADOS;
  } else {
    const metricas = (disp && disp.metricas) || [];
    calculables = metricas.filter((m) => m.disponible).map((m) => ({ id: m.clave, que: `${m.metrica} @ ${m.eje}`, fuente: `metricRegistry.sourceByAxis (${m.source}.${m.field})` }));
    bloqueadas = metricas.filter((m) => !m.disponible).map((m) => ({ id: m.clave, que: `${m.metrica} @ ${m.eje}`, porque: m.motivo, paraAbrirlo: `declarar la columna correspondiente a "${m.field}" de "${m.source}" en el archivo` }));
  }

  const dominios = [];
  if (dataset) {
    if ((dataset.clientesVentas && dataset.clientesVentas.length) || (dataset.clientesMargen && dataset.clientesMargen.length)) dominios.push("comercial");
    if (dataset.skuInventario && dataset.skuInventario.length) dominios.push("inventario");
    if (dataset.flujoComercial) dominios.push("cobranza");
  }

  return { calculables, bloqueadas, caras: (disp && disp.caras) || [], ausencias: ausenciasDe(dominios) };
}

/* ═══ 5 · CALIDAD ════════════════════════════════════════════════════════════════════════════════════════════
 * Hallazgos con severidad, señales de plausibilidad (como preguntas, nunca como afirmaciones) y la
 * compatibilidad entre universos que ya midió `motorKpi.js` sobre ESTE archivo (owner 2026-09-14). */

// Clasificación de severidad: los BLOQUEOS son siempre "blocker" (rechazan la carga entera — es definitorio,
// no una lectura). Los AVISOS se clasifican con la tabla DECLARADA `severidadAviso` de
// `config/contract/avisoSeveridad.js` (corrección del supervisor 2026-09-25: antes era un regex sobre el
// `tipo`, que caía a "info" en silencio ante una forma nueva — ahora un `tipo` sin entrada HACE FALLAR, no
// se adivina).

function _calidad({ tipo, resultado }) {
  const dataset = resultado.dataset;
  const preview = resultado.preview;
  const bloqueos = preview.bloqueos || [];
  const avisos = preview.avisos || [];

  const hallazgos = [
    ...bloqueos.map((b) => ({ severidad: "blocker", tipo: b.tipo, detalle: b.detalle, hoja: b.hoja || null })),
    ...avisos.map((a) => ({ severidad: severidadAviso(a.tipo), tipo: a.tipo, detalle: a.detalle, hoja: a.hoja || null })),
  ];

  // plausibilidad · SOLO en el camino de la plantilla (`handleIngesta.server.js` es hoy el único llamador, y
  // ahora los dos comparten la misma derivación de umbrales vía `ingesta/umbrales.js` — corrección del
  // supervisor 2026-09-25: antes estaba duplicada acá y en el endpoint).
  let plausibilidad = [];
  if (tipo === "negocio" && dataset) {
    const lectura = leerPlausibilidad(dataset, { umbrales: umbralesDe(dataset), filasPorPeriodo: preview.periodos ? preview.periodos.filas : null });
    plausibilidad = lectura.alarmas.map((al) => ({ señal: al.que, cifras: al.filas, pregunta: al.probable }));
  }

  return { hallazgos, plausibilidad, compatibilidad: (dataset && dataset.compatibilidad) || null };
}

/* ═══ 6 · MEMORIA DE EMPRESA (propuesta) ═════════════════════════════════════════════════════════════════════
 * Lo que ESTA carga propone guardar para no volver a preguntar. Solo la PROPUESTA — persistir es de la etapa 2
 * (`persistirCarga.server.js` ya hace algo parecido para moneda, vía `db/migraciones/012_perfil_empresa.sql`,
 * sin aplicar; acá no se escribe nada, se declara qué convendría guardar). Moneda y escala son los dos
 * fundamentales que hoy tienen un mecanismo real de venir declarados. `mapeoColumna` (CORTE 0b, 2026-09-25):
 * cuando el motor de materialidad resolvió una ambigüedad SOLO porque la diferencia no era material, ese
 * supuesto se propone como memoria — así una carga futura con el mismo archivo/plantilla del cliente no vuelve
 * a evaluar la misma colisión (requisito explícito del supervisor: «el supuesto queda en el acta y en
 * memoriaEmpresa como propuesta»). `mapeoCodigo` (propuesta del MODELO sobre columnas `sinResolver`) sigue sin
 * mecanismo — corte siguiente. */
function _memoriaEmpresa({ tipo, resultado, memoriaEmpresa, fundamentales }) {
  const out = [];
  if (fundamentales.moneda.origen === "archivo" && (!memoriaEmpresa || monedaLimpia(memoriaEmpresa.moneda) !== fundamentales.moneda.valor)) {
    out.push({ clase: "moneda", valor: fundamentales.moneda.valor, origen: "archivo", confirmacion: "pendiente", vigencia: null });
  }
  if (tipo === "heterogeneo" && fundamentales.escala.origen === "declarada_por_motor") {
    out.push({ clase: "escala", valor: fundamentales.escala.valor, origen: "usuario_confirmo_unidades", confirmacion: "confirmada", vigencia: null });
  }
  if (tipo === "heterogeneo") {
    for (const h of (resultado.preview.hojas || [])) {
      for (const a of (h.resueltasPorMaterialidad || [])) {
        if (!a.materialidad || !a.materialidad.supuestoElegido) continue;
        const s = a.materialidad.supuestoElegido;
        out.push({ clase: "mapeoColumna", valor: { eje: h.eje, campo: s.campo, columna: s.columna },
          origen: "materialidad_no_material", confirmacion: "propuesta", vigencia: null,
          motivo: `diferencia ${a.materialidad.metricaComparada} entre candidatas: ${a.materialidad.deltaMax} (piso ${a.materialidad.piso})` });
      }
    }
  }
  return out;
}

/* ═══ 7 · PREGUNTAS ══════════════════════════════════════════════════════════════════════════════════════════
 * Ítems ESTRUCTURADOS, canal `pantalla`|`llm`. El texto, cuando lo hay, es un rótulo del contrato — nunca
 * redacción libre de este módulo. Dos fuentes: los fundamentales sin declarar, y las ambigüedades cuya `accion`
 * quedó en `"preguntar"` (todas, mientras el corte 0b no mida materialidad). */
function _preguntas({ fundamentales, ambiguedades }) {
  const out = [];
  if (fundamentales.moneda.origen === "preguntar") {
    const p = _PARAM("moneda");
    out.push({ id: "preg-moneda", campo: "moneda", porQue: p ? p.ayuda : "la moneda de los montos no está declarada",
      opciones: MONEDAS_CONOCIDAS, canal: "pantalla" });
  }
  if (fundamentales.escala.origen === "preguntar") {
    out.push({ id: "preg-escala", campo: "escala", porQue: "las columnas con unidad declarada (dinero, ratio) esperan que una persona confirme que la unidad es la del contrato antes de convertir un solo número — la lección de miles-contra-dólares",
      opciones: (fundamentales.escala.campos || []).map((c) => `${c.columna} → ${c.campo} (${c.unidad})`), canal: "pantalla" });
  }
  for (const a of ambiguedades) {
    if (a.accion !== "preguntar") continue;
    out.push({ id: a.id, campo: a.campo, porQue: a.pregunta.texto, opciones: a.pregunta.opciones, canal: "pantalla" });
  }
  return out;
}

/* ═══ LA FUNCIÓN ═════════════════════════════════════════════════════════════════════════════════════════════
 * actaDeIngesta(resultadoDeLaCarga, { memoriaEmpresa, id, fuenteArchivo } = {}) → ActaDeIngesta
 *
 *   `resultadoDeLaCarga` — lo que devuelve `ingestarPlantilla(archivo, opts)` o `ingestarLibro(archivo, opts)`:
 *     `{ ok, dataset, preview, ... }`. Con `ok:false` el Acta se arma igual (dataset es null): columnas y
 *     hallazgos siguen siendo información real, y es la que el usuario necesita para corregir el archivo.
 *   `memoriaEmpresa` — opcional, lo que la empresa YA tiene declarado (hoy solo `moneda` tiene un mecanismo
 *     real de venir de una carga anterior — ver `persistirCarga.server.js:monedaTenant`). Sin esto, el Acta
 *     igual funciona: simplemente no puede evitar la pregunta que la memoria habría evitado.
 *   `id` — opcional, el id de la carga si el llamador ya lo tiene (la persistencia real es de la etapa 2).
 */
export function actaDeIngesta(resultadoDeLaCarga, { memoriaEmpresa = null, id = null } = {}) {
  const resultado = resultadoDeLaCarga || {};
  const tipo = _detectarTipo(resultado);
  const preview = resultado.preview || {};

  const columnas = tipo === "negocio" ? _columnasNegocio(resultado) : tipo === "heterogeneo" ? _columnasHeterogeneo(resultado) : [];
  const fundamentales = _fundamentales({ tipo, resultado, memoriaEmpresa });
  const ambiguedades = _ambiguedades({ tipo, resultado });
  const capacidades = _capacidades({ tipo, resultado });
  const calidad = _calidad({ tipo, resultado });
  const memoriaPropuesta = _memoriaEmpresa({ tipo, resultado, memoriaEmpresa, fundamentales });
  const preguntas = _preguntas({ fundamentales, ambiguedades });

  return {
    carga: {
      id,
      tipo,   // "negocio" | "heterogeneo" — el vocabulario del plan B2 (el archivo de referencia es una
              // clasificación de la PANTALLA de carga, no algo que el resultado de la ingesta declare)
      fuente: { archivo: preview.archivo || null, hojas: (preview.hojas || []).map((h) => h.hoja) },
      version: preview.version || null,
    },
    columnas,
    fundamentales,
    ambiguedades,
    capacidades,
    calidad,
    memoriaEmpresa: memoriaPropuesta,
    preguntas,
  };
}
