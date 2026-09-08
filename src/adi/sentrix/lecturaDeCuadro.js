/* === src/adi/sentrix/lecturaDeCuadro.js · LEER EL CUADRO QUE EL USUARIO ESTÁ MIRANDO ==========================
 * (owner 2026-09-08 · «el botón no manda solo texto: manda el ancla completa del cuadro»)
 *
 * LA PALABRA DEL OWNER, textual: «El botón no manda solo texto. Manda el ancla completa del cuadro que el
 * usuario está viendo. Debe incluir: cara/módulo · nombre del cuadro · métrica principal · eje o entidad ·
 * período · filtros aplicados · cifras visibles · qué pregunta concreta debe explicar. ADI debe responder ese
 * cuadro, no una pregunta libre ni un ranking genérico. Si el cuadro muestra un 80/20, explica el 80/20. Si el
 * cuadro muestra presupuesto, explica presupuesto. Si no existe dato suficiente para ese cuadro, debe decir
 * exactamente qué falta. Hazlo transversal para todas las caras, no parche por cuadro.»
 *
 * QUÉ HACE. Dado un `componentId` del manifiesto, devuelve LO QUE ESA PIEZA PINTA: su identidad declarada
 * (cara, nombre, métrica, eje, período, comparación, universo, sello) y sus CIFRAS VISIBLES — las mismas del
 * módulo, no una reconstrucción.
 *
 * ── POR QUÉ ESTO NO ES UNA SEGUNDA VERDAD, que es la pregunta que corresponde hacerse ─────────────────────
 * La regla 3 de la casa dice «cero cálculo en React: la frase y el número se arman en el MÓDULO, la vista solo
 * pinta». Ese contrato tiene una consecuencia que hasta hoy nadie había usado: **todo lo que el usuario ve en
 * pantalla ya existe formateado en la salida del builder**, con una convención estable — el campo `xFmt` junto
 * al `x` crudo. Leer los `xFmt` no es transcribir la pantalla ni recalcular: es leer la MISMA cadena que el
 * componente pinta. Acá no se calcula nada (ni una suma, ni un porcentaje, ni un orden): se selecciona.
 * Es el patrón que ya usa `cobranza`, que lee `buildMesaFlujo` —el builder de la pestaña— en vez de rehacer el
 * cobro; esto lo generaliza a cualquier cuadro declarado.
 *
 * ── TRANSVERSAL POR FORMA, NO POR CUADRO ──────────────────────────────────────────────────────────────────
 * No hay una rama por componente. Hay:
 *   · un resolvedor de FILAS que conoce las llaves con que los builders de la casa publican listas
 *     (`filas · rows · barras · series · meses · tramos · items · lista · grupos`), y
 *   · un DICCIONARIO DE CAMPOS del negocio (venta, contribución, margen, capital, saldo, días…) que traduce el
 *     nombre técnico del campo al rótulo del negocio.
 * El diccionario es lo contrario de un parche: es la aplicación literal de «una sola verdad — mismo concepto,
 * misma palabra y mismo número en toda superficie». Un campo que no está en el diccionario NO SE LEE: una
 * cifra con rótulo inventado sería peor que una cifra ausente.
 *
 * ── Y LO QUE NO PUEDE LEER, LO DICE ───────────────────────────────────────────────────────────────────────
 * Si el builder no corre, si el campo declarado no resuelve o si el cuadro no publica filas, devuelve `falta`
 * con la razón EXACTA en palabras de negocio. Es la tercera regla del owner y la regla 2 del contrato del ask
 * de cuadro: el corte que no existe se declara, no se sirve parecido.
 *
 * PURO · SIN DOM · SIN REACT · SIN RED · SIN LLM · sin cálculo.
 */
import { VIEW_MANIFEST, VISTA_LABEL, SECCION_LABEL, concordanciaDe } from "./viewManifest.js";
import { builderOutFor } from "./viewBuilderRun.js";
import { resolvePath } from "./viewContextFrom.js";
import { METRICS } from "../../config/contract/metricRegistry.js";
import { ESCENARIO_INICIAL } from "../../config/scenarios.js";

/* ── LAS LLAVES CON QUE LOS BUILDERS DE LA CASA PUBLICAN UNA LISTA ─────────────────────────────────────────
 * El orden importa: `filas` primero porque es la llave canónica; `series` va después de `meses` porque una
 * serie temporal se lee por sus meses y no por sus tres curvas. */
const LLAVES_DE_FILAS = ["filas", "rows", "barras", "meses", "tramos", "items", "lista", "grupos", "series"];
/* el nombre de una fila, en el orden en que los builders lo publican */
const LLAVES_DE_NOMBRE = ["nombre", "label", "sku", "entidad", "name", "mes", "key", "periodo"];

/* ── EL DICCIONARIO DE CAMPOS · el vocabulario del negocio, uno solo para todas las caras ──────────────────
 * clave = el campo del builder SIN el sufijo `Fmt`. valor = el rótulo con que ese concepto se nombra en toda
 * superficie (CLAUDE.md §2, «una sola verdad»). Los que no están, no se leen. */
const CAMPOS = {
  // venta y su descomposición
  venta: "Venta", ventas: "Venta", valor: "Valor", monto: "Monto", total: "Total", suma: "Total", totalVenta: "Venta total",
  contribucion: "Contribución", totalContrib: "Contribución total", margen: "Margen", costo: "Costo",
  precio: "Precio", unidades: "Unidades", ticket: "Ticket promedio",
  // participación y concentración
  peso: "Participación", pesoPct: "Participación", participacion: "Participación",
  acumulado: "Acumulado", acumuladoPct: "Acumulado", pct: "Porcentaje", pctTotal: "Participación",
  grupoPct: "Lo que explica el grupo", cubrePct: "Lo que cubre lo mostrado", cubre: "Lo que cubre lo mostrado",
  // referencias y brechas
  vara: "Benchmark", benchmark: "Benchmark", ref: "Referencia", brecha: "Brecha",
  cumplimiento: "Cumplimiento del presupuesto", presupuesto: "Presupuesto",
  // acciones comerciales (vocabulario cerrado: la TASA es «carga comercial», el MONTO son «acciones comerciales»)
  carga: "Carga comercial", acciones: "Acciones comerciales", rebate: "Acciones comerciales",
  exceso: "Exceso sobre la referencia", recuperable: "Contribución no capturada",
  // capital e inventario (registro de la casa: «inmovilizado» / «frenado», jamás «detenido»)
  capital: "Capital", usd: "Capital", stock: "Stock", stockUnd: "Unidades en stock",
  inmovilizado: "Capital frenado", detenido: "Capital frenado", frenado: "Capital frenado",
  rotacion: "Rotación", doh: "Días de inventario", diasSinVenta: "Días sin venta",
  // cobro
  abonado: "Abonado", saldo: "Saldo pendiente", vencido: "Saldo vencido", recuperado: "Recuperado",
  diasCredito: "Días de crédito", diasVencido: "Días vencido",
  // serie temporal
  totalActual: "Total del año", max: "Mes más alto", min: "Mes más bajo",
  pico: "Mes más alto", valle: "Mes más bajo", caida: "Mayor caída mes a mes",
};

/* los CONTEOS que el cuadro muestra como cifra (no llevan sufijo `Fmt` porque son enteros) */
const CONTEOS = {
  n: "Entidades en el cuadro", entidadesReales: "Entidades del universo",
  grupoN: "Entidades que hacen el grupo", colaN: "Entidades en la cola",
  blockCount: "Entidades que hacen el bloque", tope: "Filas mostradas", resto: "Filas no mostradas",
  agrupadas: "Entidades agrupadas en «otros»",
};

/* los TEXTOS del propio módulo que están EN PANTALLA — la lectura que la vista ya muestra, escrita por el
 * módulo (no por el cerebro). `pie` es la segunda línea de una card de KPI. */
const TEXTOS = ["titulo", "lectura", "nota", "criterio", "accion", "resumenTope", "notaFuente", "cruce80", "pie", "linea"];

/* las comparaciones anidadas: `{hay, montoFmt, pctFmt, dir}` — la forma con que la cartera publica sus deltas */
const COMPARADOS = { vsAnterior: "vs año anterior", vsPresupuesto: "vs presupuesto", vsAnio: "vs año anterior" };

/* ── LAS SEÑALES · lo que el MÓDULO ya clasificó de cada fila ──────────────────────────────────────────────
 * (owner 2026-09-08: «el botón debe usar el cuadro como evidencia, no como texto a recitar… debe explicar la
 *  historia que hay detrás: caídas, puntos altos, concentración, gaps o anomalías»)
 *
 * POR QUÉ ESTO PERMITE INTERPRETAR SIN INVENTAR. Recitar filas es fácil y es lo que el owner rechazó; contar
 * la historia parece exigir cálculo — y el cálculo en la superficie está prohibido. La salida es que **los
 * builders YA clasificaron cada fila**: `bajoBenchmark`, `critico`, `sobreMeta`, `enGrupo`, `estado`, y la
 * dirección `sube`/`baja` de cada comparación. Agrupar filas por una bandera que el módulo puso NO es calcular:
 * es leer su propio veredicto. Lo que aparece entonces —que las que caen son las mismas que quedan bajo
 * presupuesto, salvo una— es información que la tabla TIENE y no DICE, que es exactamente el encargo.
 *
 * `alerta: true` marca la señal que pide mirada. Una bandera fuera de este diccionario no se lee. */
const SENALES = {
  bajoBenchmark: { alerta: true, dice: "queda bajo el benchmark", dicen: "quedan bajo el benchmark" },
  sobreMeta: { alerta: true, dice: "carga acciones comerciales sobre tu meta", dicen: "cargan acciones comerciales sobre tu meta" },
  critico: { alerta: true, dice: "está en estado crítico", dicen: "están en estado crítico" },
  sinReferencia: { alerta: true, dice: "no tiene referencia declarada", dicen: "no tienen referencia declarada" },
  material: { alerta: false, dice: "pesa lo suficiente para mover el resultado", dicen: "pesan lo suficiente para mover el resultado" },
  enGrupo: { alerta: false, dice: "está en el grupo que sostiene la venta", dicen: "están en el grupo que sostiene la venta" },
};
/* el ESTADO con nombre propio: el módulo publica el enum y SU rótulo — se lee el rótulo, jamás el enum */
const ESTADOS = { estado: "estadoLabel", dominante: "dominanteLabel" };

const _txt = (v) => (typeof v === "string" && v.trim() ? v.trim() : null);
const _fmtDe = (k) => (k.endsWith("Fmt") ? k.slice(0, -3) : null);

/** el rótulo de negocio de un campo, o null si el diccionario no lo declara (y entonces no se lee). */
function _rotulo(clave) {
  if (Object.prototype.hasOwnProperty.call(CAMPOS, clave)) return CAMPOS[clave];
  return null;
}

/** las cifras VISIBLES de un objeto (fila o cabecera): sus `xFmt` declarados + sus comparaciones anidadas.
 *  `metrica` es el rótulo de la métrica del cuadro: lo usan las dos formas que publican su valor principal SIN
 *  nombre de campo — la barra de un Pareto (`fmt`) y la card de un KPI (`valor` ya formateado). */
function _cifrasDe(obj, metrica) {
  const out = [];
  if (!obj || typeof obj !== "object") return out;
  for (const k of Object.keys(obj)) {
    const base = _fmtDe(k);
    if (base) {
      const rot = _rotulo(base);
      const val = _txt(obj[k]);
      if (rot && val) out.push({ clave: base, label: rot, valor: val });
      continue;
    }
    /* EL VALOR PRINCIPAL SIN NOMBRE DE CAMPO. Tres formas de la casa lo publican así y las tres están en
     * pantalla: la barra de un Pareto (`fmt`, la etiqueta bajo la barra) y la card de un KPI, que según la cara
     * lo llama `valor` (Comercial, Flujo) o `value` (Capital). Se distingue del crudo por el TIPO: una cadena es
     * lo que se pinta, un número es el crudo que ordena — y ese no se lee, porque su versión visible viaja en
     * otro campo. */
    if ((k === "fmt" || k === "valor" || k === "value") && _txt(obj[k])) {
      out.push({ clave: "principal", label: metrica || "Valor", valor: _txt(obj[k]) });
      continue;
    }
    /* EL ACUMULADO DE LA CURVA · el 80/20. El módulo lo publica en puntos (`19.4`) y la vista lo pinta con su
     * signo de porcentaje («acum 19.4%»): acá se transcribe ese mismo token, no se calcula nada. */
    if (k === "acumuladoPct" && typeof obj[k] === "number" && Number.isFinite(obj[k])) {
      out.push({ clave: "acumulado", label: CAMPOS.acumulado, valor: `${obj[k]}%` });
      continue;
    }
    /* la comparación anidada: se lee su MONTO y su PORCENTAJE, que es lo que la celda pinta */
    if (COMPARADOS[k] && obj[k] && typeof obj[k] === "object" && obj[k].hay !== false) {
      const c = obj[k];
      const m = _txt(c.montoFmt), p = _txt(c.pctFmt);
      if (m) out.push({ clave: k, label: COMPARADOS[k], valor: m });
      if (p) out.push({ clave: `${k}Pct`, label: `${COMPARADOS[k]} (%)`, valor: p });
      continue;
    }
    /* el conteo entero que el cuadro muestra */
    if (CONTEOS[k] && typeof obj[k] === "number" && Number.isFinite(obj[k])) {
      out.push({ clave: k, label: CONTEOS[k], valor: String(obj[k]), conteo: true });
    }
  }
  return out;
}

/** el nombre de una fila. Sin nombre no hay fila: una cifra sin dueño no entra a la boleta (regla de la casa). */
function _nombreDe(f) {
  if (typeof f === "string") return f.trim() || null;
  if (!f || typeof f !== "object") return null;
  for (const k of LLAVES_DE_NOMBRE) if (_txt(f[k])) return _txt(f[k]);
  return null;
}

/** las señales que el módulo puso en una fila: sus banderas declaradas, su estado y la dirección de sus deltas. */
function _senalesDe(f) {
  const out = [];
  if (!f || typeof f !== "object") return out;
  for (const k of Object.keys(SENALES)) if (f[k] === true) out.push({ clave: k, ...SENALES[k] });
  for (const [k, labelKey] of Object.entries(ESTADOS)) {
    if (typeof f[k] !== "string" || !f[k]) continue;
    /* ⚠️ EL ENUM NO VA A PANTALLA. El módulo publica el estado con SU rótulo al lado (`estadoLabel`), y ese es
     * el que se lee. Cuando no hay rótulo se acepta el enum SOLO si ya es una palabra del negocio —«vencido»—
     * y se descarta si es un identificador —«por_vencer», «riesgo_quiebre»—: el notario veta la jerga interna
     * con razón, y callar una señal es mejor que nombrarla en el idioma del sistema. */
    const rot = _txt(f[labelKey]) || (/^[a-záéíóúüñ]+$/i.test(f[k]) ? f[k] : null);
    if (!rot) continue;
    if (k === "dominante") {
      /* «dominante» NO es el estado de la fila: es el tramo donde esa fila tiene LA MAYOR PARTE de su capital.
       * Decir «la bodega está en quiebre próximo» afirmaría de más — el módulo declaró dónde se concentra. */
      out.push({ clave: "estado", alerta: true, dice: `concentra su capital en ${rot}`, dicen: `concentran su capital en ${rot}`, valor: rot });
      continue;
    }
    /* «en estado X» concuerda con cualquier género y número («6 cuentas están en estado vencido»); si el rótulo
     * ya viene con «en» («en rango»), se respeta tal cual. */
    const conEn = /^en /i.test(rot) ? rot : `en estado ${rot}`;
    out.push({ clave: "estado", alerta: true, dice: `está ${conEn}`, dicen: `están ${conEn}`, valor: rot });
  }
  /* la dirección de cada comparación: `baja` es la anomalía que el cuadro pinta en rojo */
  for (const [k, label] of Object.entries(COMPARADOS)) {
    const c = f[k];
    if (!c || typeof c !== "object" || c.hay === false || !c.dir) continue;
    const cae = c.dir === "baja" || c.dir === "cae" || c.tono === "alerta";
    out.push({ clave: k, alerta: cae, cae, dice: `${cae ? "cae" : "sube"} ${label}`, dicen: `${cae ? "caen" : "suben"} ${label}`,
      valor: _txt(c.pctFmt) || _txt(c.montoFmt) || null });
  }
  return out;
}

/** las filas legibles de una lista: nombre + al menos una cifra visible + lo que el módulo dice de ella. */
function _leerFilas(lista, metrica) {
  const filas = [];
  for (const f of lista) {
    const nombre = _nombreDe(f);
    if (!nombre) continue;                       // cifra sin dueño no entra: la ley de la boleta
    const cifras = _cifrasDe(f, metrica);
    if (!cifras.length) continue;
    filas.push({ nombre, cifras, senales: _senalesDe(f), linea: _txt(f && f.linea) || null });
  }
  return filas;
}

/* la lista de filas del nodo + de dónde salió, o null.
 * ⚠️ SE PRUEBA LLAVE POR LLAVE HASTA QUE UNA DÉ FILAS LEGIBLES, y esa es toda la sutileza de esta función: el
 * evolutivo publica `meses` (doce cadenas: los rótulos del eje) Y `series` (las tres curvas con su total
 * formateado, que es lo que la leyenda muestra). Quedarse con la primera llave presente devolvía cero filas y
 * el cuadro se declaraba ilegible teniendo sus totales a la vista. */
function _filasDe(node, metrica) {
  if (Array.isArray(node)) return { llave: "(el campo es la lista)", filas: _leerFilas(node, metrica) };
  if (!node || typeof node !== "object") return null;
  for (const k of LLAVES_DE_FILAS) {
    if (!Array.isArray(node[k]) || !node[k].length) continue;
    const filas = _leerFilas(node[k], metrica);
    if (filas.length) return { llave: k, filas };
  }
  return null;
}

/* ── LA VISTA ACTIVA · «filtros aplicados», el 6º campo del ancla del owner ────────────────────────────────
 * Varios cuadros publican SUS cortes como `vistas[{key,label,…}]` y la pantalla muestra UNO (el corte de
 * Capital, el eje de «quién sostiene»). Cuál se está mirando lo dice el CONTROL que viajó en el contexto; sin
 * control manda el `porDefecto` que el propio módulo declara. Nunca se leen todos a la vez: eso sería
 * responder un cuadro que el usuario no tiene delante. */
function _vistaActiva(node, controles) {
  if (!node || typeof node !== "object" || !Array.isArray(node.vistas) || !node.vistas.length) return null;
  const claves = node.vistas.map((v) => v && v.key).filter(Boolean);
  const pedida = Object.values(controles || {}).map((x) => String(x)).find((x) => claves.includes(x));
  const key = pedida || (_txt(node.porDefecto) && claves.includes(node.porDefecto) ? node.porDefecto : claves[0]);
  const v = node.vistas.find((x) => x && x.key === key) || null;
  return v ? { key, label: _txt(v.label) || key, nodo: v, porControl: !!pedida } : null;
}

/* ── LA LECTURA ───────────────────────────────────────────────────────────────────────────────────────────
 * lecturaDeCuadro(componentId, { scenario, controles }) →
 *   { ok, identidad, cabecera[], filas[], textos[], limite, corte, falta }
 * `falta` (string) llega SIEMPRE que `ok` es false, y dice en palabras de negocio qué no se pudo leer. */
export function lecturaDeCuadro(componentId, { scenario = ESCENARIO_INICIAL, controles = null, builderOut = null } = {}) {
  const id = String(componentId || "");
  const m = VIEW_MANIFEST[id];
  if (!m) return { ok: false, motivo: "sin-declarar", falta: `no tengo declarado el cuadro «${id}»: no puedo responder por una pieza que no está en el contrato de pantalla.` };

  const identidad = {
    componentId: id,
    vista: m.vista, cara: VISTA_LABEL[m.vista] || m.vista,
    seccion: m.seccion, movimiento: SECCION_LABEL[`${m.vista}/${m.seccion}`] || null,
    cuadro: m.label, tipo: m.tipo,
    metrica: m.metrica || null,
    metricaLabel: (m.metrica && METRICS[m.metrica] && METRICS[m.metrica].label) || m.metrica || null,
    /* la métrica DICHA («tu venta», no «tu Ventas»): el nombre con que la prosa la nombra, del vocabulario
     * cerrado de la casa — «acciones comerciales» es el monto y «carga comercial» la tasa, nunca al revés */
    metricaDicha: ({ ventas: "venta", contribucion: "contribución", margen: "margen", capital: "capital",
      acciones: "acciones comerciales", carga: "carga comercial" })[m.metrica]
      || ((m.metrica && METRICS[m.metrica] && METRICS[m.metrica].label) || m.metrica || "lectura").toLowerCase(),
    eje: m.eje || null,
    periodo: m.periodo || null,
    comparacion: m.comparacion || null,
    universo: (m.universo && m.universo.label) || null,
    controles: controles && typeof controles === "object" ? { ...controles } : {},
  };
  /* EL LÍMITE DECLARADO de esta pieza: qué de lo que muestra NO tiene respaldo en el motor, con su razón
   * verificable. Es lo que hace posible «decir exactamente qué falta» sin inventar el faltante. */
  const conc = concordanciaDe(m) || null;
  const limite = conc ? { estado: conc.estado, campos: conc.campos || [], razon: conc.razon || null } : null;

  const out = builderOut || builderOutFor(id, scenario);
  if (!out) return { ok: false, motivo: "sin-modulo", identidad, limite, falta: `el cuadro «${m.label}» no se puede reconstruir con este dato: su módulo (${m.vista}) no devolvió nada para este período.` };

  let node = resolvePath(out, m.campo);
  if (node === undefined || node === null) {
    return { ok: false, motivo: "sin-campo", identidad, limite,
      falta: m.campoOpcional
        ? `este dato no trae «${m.label}»: es una pieza opcional del cuadro de ${identidad.cara} y esta carga no la publica.`
        : `el cuadro «${m.label}» no publicó su contenido en esta construcción: no tengo sus cifras para explicarlo.` };
  }

  /* el corte que el usuario tiene delante */
  const va = _vistaActiva(node, controles);
  let corte = null;
  if (va) { node = va.nodo; corte = { key: va.key, label: va.label, porControl: va.porControl }; }

  const cabecera = _cifrasDe(node, identidad.metricaLabel);
  /* LA FILA TOTAL, que vive AL LADO de las filas y no dentro: es la que dice cómo cierra el cuadro completo, y
   * sin ella la explicación pierde el marco (la cartera crece +7.5% mientras cuatro cuentas caen). */
  if (node.total && typeof node.total === "object") {
    for (const c of _cifrasDe(node.total, identidad.metricaLabel)) cabecera.push({ ...c, clave: `total.${c.clave}`, label: `${c.label} · total` });
  }
  const textos = TEXTOS.map((k) => ({ clave: k, texto: _txt(node[k]) })).filter((x) => x.texto);

  const fl = _filasDe(node, identidad.metricaLabel);
  const filas = fl ? fl.filas : [];

  /* ⚠️ «SIN CIFRAS» ES UN LÍMITE MÍO, NO DEL DATO — y por eso lleva un motivo propio. Los dos de arriba
   * (`sin-modulo`, `sin-campo`) son del DATO: la pieza no existe en esta carga, y eso se le DICE al usuario
   * («exactamente qué falta», la regla del owner). Éste es otro animal: la pieza está y pinta números, pero
   * los publica de una forma que este lector no sabe transcribir. Confundirlos haría que ADI le dijera al
   * usuario que su dato no trae algo que sí trae — una limitación mía disfrazada de límite del negocio, que
   * es la peor clase de mentira honesta. Quien consume esto declina los del dato y se retira en el mío. */
  if (!cabecera.length && !filas.length) {
    return { ok: false, motivo: "sin-cifras", identidad, limite, corte, textos,
      falta: `el cuadro «${m.label}» no publica sus cifras en una forma que yo pueda citar verbatim.` };
  }

  return { ok: true, identidad, cabecera, filas, textos, limite, corte, filasLlave: fl ? fl.llave : null, n: filas.length };
}

/** los componentes que ESTE dato sabe leer — lo consume el gate para barrer el manifiesto entero. */
export function cuadrosLegibles(scenario = ESCENARIO_INICIAL) {
  return Object.keys(VIEW_MANIFEST).filter((id) => {
    try { return lecturaDeCuadro(id, { scenario }).ok; } catch { return false; }
  });
}

export { CAMPOS as CAMPOS_DEL_CUADRO, CONTEOS as CONTEOS_DEL_CUADRO };
