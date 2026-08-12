/* === config/contract/figureType.js · CONTRATO DE DATOS · EL TIPO DE LA CIFRA (owner 2026-08-09, decisiones 1·2) ==
 *
 * POR QUÉ EXISTE. `unit: "money"` no alcanza y el owner lo dijo con un caso: el MISMO SKU vale $10.8K en Sentrix y
 * $10.8M en el chat, y esta oración pasaba el muro entera —
 *     «SAM-TV55 factura $13.3M y sostiene ese volumen con $13K de inventario: menos de un día de cobertura»
 * — porque las dos cifras son REALES, las dos son `money`, y nada en el tipo decía que viven en dos mundos que no
 * reconcilian: la venta comercial se almacena en MILES (skusMargen.venta 13300 = $13.3M) y el inventario en DÓLARES
 * CRUDOS (skuInventario.stockUSD 12800 = $12.8K). Dividir una por otra no da cobertura: da basura.
 *
 * QUÉ DECLARA (decisión 1 — "toda cifra debe declarar moneda, escala, período, escenario, universo,
 * entidad/dimensión, fuente y unidad"). Esto NO es un guard por ratio (el owner lo rechazó explícitamente): es el
 * TIPO, en la raíz — `fig()` no puede emitir una cifra sin él, así que ninguna ruta lo puede saltear.
 *
 * QUÉ SELLA (decisión 2 — probado | indicado | abierto):
 *   PROBADO  · dato directo, o cálculo determinístico exacto RECONCILIADO con sus componentes, sin supuestos.
 *   INDICADO · estimación, distribución, afinidad, supuesto, o inferencia modelada — incluye la derivada que NO
 *              reconcilia y el campo DECLARADO por la fuente que el dato disponible no permite reconstruir.
 *   ABIERTO  · el dato no permite calcularlo ni aislar la causa.
 * Cada regla de abajo trae su EVIDENCIA MEDIDA en el comentario, y `_tipado_cifra_gate.mjs` la vuelve a medir
 * contra el dato real en cada corrida: si el dato cambia y una regla deja de ser cierta, el gate se pone rojo.
 *
 * PURO Y SIN IMPORTS. Ni datos, ni motor, ni contrato: es vocabulario declarado. Por eso `boleta.js` —que importa
 * medio mundo río abajo— lo puede importar sin abrir un ciclo. Lo que depende del EJE (que este módulo no puede
 * resolver sin el catálogo del tenant) se refina en `buildClaims`, leyendo estas MISMAS tablas. Una sola verdad.
 */

// ── MONEDA Y ESCALA ────────────────────────────────────────────────────────────────────────────────────────────
export const MONEDA_BASE = "USD";
// El FACTOR de cada escala contra el dólar real. "unit" es el $ por unidad (precio/costo medio): también crudo,
// pero no es sumable con nada — se declara aparte justamente para que nadie lo sume.
export const ESCALAS = { raw: 1, K: 1e3, M: 1e6, unit: 1 };
export const PERIODOS = ["anual", "hoy"];
export const SELLOS = ["probado", "indicado", "abierto"];
export const UNIDADES = ["money", "pct", "ratio", "days", "count", "pp"];

// ── LOS UNIVERSOS ──────────────────────────────────────────────────────────────────────────────────────────────
// Un UNIVERSO es el conjunto de cifras que se pueden sumar, comparar y dividir ENTRE SÍ sin mentir. Dos cifras del
// mismo universo reconcilian por construcción; dos de universos distintos sólo si está declarado abajo.
// `escala` es la del CAMPO ALMACENADO en la fuente (lo que dice sourceManifest), no la del string formateado.
export const UNIVERSOS = {
  venta_comercial: {
    etiqueta: "venta comercial", unidad: "money", moneda: MONEDA_BASE, escala: "K", periodo: "anual",
    fuentes: ["clientesVentas.actual", "clientesMargen.venta|costo|contribucion|rebates", "marcasMargen", "sfamiliasMargen", "skusMargen"],
    nota: "los montos comerciales se almacenan en MILES de dólares: Σ = 100.000 = los $100.0M que muestra Sentrix",
  },
  inventario: {
    etiqueta: "inventario", unidad: "money", moneda: MONEDA_BASE, escala: "raw", periodo: "hoy",
    fuentes: ["skuInventario.stockUSD"],
    nota: "el capital en inventario se almacena en dólares CRUDOS: Σ = 135.000 = los $135K que muestra Sentrix. Es una FOTO A HOY, nunca un año cerrado",
  },
  precio_unitario: {
    etiqueta: "precio por unidad", unidad: "money", moneda: MONEDA_BASE, escala: "unit", periodo: "anual",
    fuentes: ["clientesMargen.costoMedio|precioLista", "skusMargen.costoMedio|precioLista"],
    nota: "$ por unidad, crudos. No es sumable ni comparable contra un monto agregado",
  },
  resultado_pnl: {
    etiqueta: "resultado del negocio", unidad: "money", moneda: MONEDA_BASE, escala: "K", periodo: "anual",
    fuentes: ["pnl.js:buildPnlCascade"],
    nota: "la cascada del P&L se construye sobre la venta comercial, en la misma escala",
  },
  tasa_comercial: {
    etiqueta: "tasa comercial", unidad: "pct", moneda: null, escala: null, periodo: "anual",
    fuentes: ["margen", "pctRebate", "benchmark", "participación", "variación"],
    nota: "porcentajes del mundo comercial (margen, carga comercial, participación, variación)",
  },
  tasa_inventario: {
    etiqueta: "tasa de inventario", unidad: "pct", moneda: null, escala: null, periodo: "hoy",
    fuentes: ["skuInventario.margenPct|pctInv"], nota: "porcentajes de la foto de inventario",
  },
  rotacion: {
    etiqueta: "rotación", unidad: "ratio", moneda: null, escala: null, periodo: "hoy",
    fuentes: ["skuInventario.rotacion"], nota: "veces al año, declarada por la fuente",
  },
  dias_inventario: {
    etiqueta: "días de inventario", unidad: "days", moneda: null, escala: null, periodo: "hoy",
    fuentes: ["skuInventario.doh|cobertura|diasSinVenta"], nota: "días, declarados por la fuente",
  },
  unidades: {
    etiqueta: "unidades", unidad: "count", moneda: null, escala: null, periodo: null,
    fuentes: ["unidades", "stockUnd", "vendidoMes", "conteos de entidades"], nota: "conteos",
  },
  brecha_pp: {
    etiqueta: "brecha en puntos", unidad: "pp", moneda: null, escala: null, periodo: "anual",
    fuentes: ["benchmark − margen"], nota: "puntos porcentuales: es una DIFERENCIA, nunca un porcentaje de algo",
  },
};

// ── QUÉ RECONCILIA CON QUÉ (decisión 11: nunca `null` si hay una divergencia conocida) ─────────────────────────
// Cada par declarado trae razón VERIFICABLE. Lo que no está acá y comparte unidad, reconcilia; lo que no comparte
// unidad sale `unsupported` (no hay operación declarada entre ambos), nunca `null`.
export const DIVERGENCIAS = [
  {
    entre: ["venta_comercial", "inventario"],
    razon: "la venta comercial se almacena en MILES y el inventario en dólares CRUDOS (×1000 de diferencia de escala); además las unidades del mismo SKU difieren entre 4x y 35x entre skusMargen y skuInventario. Ninguna operación cruzada entre venta e inventario (cobertura, días, ratio, participación) cierra sobre este dato",
  },
  {
    entre: ["venta_comercial", "precio_unitario"],
    razon: "precioLista y costoMedio son $ por UNIDAD, crudos; la venta viene en miles — unidades × precio no cierra contra la venta declarada",
  },
  {
    entre: ["resultado_pnl", "inventario"],
    razon: "el P&L es del año cerrado y en miles; el inventario es la foto de hoy en dólares crudos — no hay línea del resultado que se explique con el stock",
  },
  {
    entre: ["precio_unitario", "inventario"],
    razon: "el precio unitario es del mundo comercial (miles/unidad declarada) y el stock del de inventario (unidades propias): el mismo SKU no trae la misma cantidad en las dos fuentes",
  },
];

// reconcilian(a, b) → { estado: "reconciled" | "divergent" | "unsupported", razon } · NUNCA null (decisión 11).
export function reconcilian(a, b) {
  const A = UNIVERSOS[a], B = UNIVERSOS[b];
  if (!A || !B) return { estado: "unsupported", razon: `universo no declarado: ${!A ? a : b}` };
  if (a === b) return { estado: "reconciled", razon: `mismo universo (${A.etiqueta}): misma moneda, escala y período` };
  const d = DIVERGENCIAS.find((x) => (x.entre[0] === a && x.entre[1] === b) || (x.entre[0] === b && x.entre[1] === a));
  if (d) return { estado: "divergent", razon: d.razon };
  if (A.unidad !== B.unidad) return { estado: "unsupported", razon: `unidades distintas (${A.unidad} vs ${B.unidad}): no hay operación declarada entre «${A.etiqueta}» y «${B.etiqueta}»` };
  if (A.periodo !== B.periodo) return { estado: "divergent", razon: `períodos distintos: «${A.etiqueta}» es ${A.periodo === "hoy" ? "la foto de hoy" : "del año cerrado"} y «${B.etiqueta}» ${B.periodo === "hoy" ? "la foto de hoy" : "del año cerrado"}` };
  if (A.escala !== B.escala) return { estado: "divergent", razon: `escalas distintas: «${A.etiqueta}» se almacena en ${A.escala} y «${B.etiqueta}» en ${B.escala}` };
  return { estado: "reconciled", razon: `${A.etiqueta} y ${B.etiqueta} comparten unidad, escala y período` };
}

// ── EL PERÍODO SALE DE LA NATURALEZA DE LA CIFRA (owner 2026-08-09, decisión 5 · hallazgo D) ───────────────────
// LOS DOS DEFECTOS QUE CIERRA, los dos medidos:
//   · IDA    `toolRunner._PERIODO_HOY` era un Set con UNA tool ('inventoryStatus'), así que la cara Capital entera
//            salía sellada "año cerrado": `queryMetric{capital|rotacion}` y `simulateCapital` devuelven cifras que
//            SON la foto del stock (13/13 y 6/6 de sus figs tipan `inventario`/`rotacion`/`dias_inventario`) y las
//            estampaban con el marco del año cerrado.
//   · VUELTA `inventoryStatus{top_sellers}` devuelve VENTAS ANUALES (5 figs `venta_comercial`) junto al stock de
//            esos mismos SKU (5 figs `inventario`), y las estampaba TODAS "foto de inventario a hoy".
// Ninguno de los dos se arregla moviendo tools de una lista a la otra: el marco no es de la tool, es de la CIFRA —
// y el tipo ya lo declara (`UNIVERSOS[x].periodo`). Acá se lee, no se vuelve a decidir.
//
// UN RESULTADO PUEDE SER MIXTO, y entonces se DICE (decisión 11: nunca `null` si hay algo que declarar). La fila
// completa de un SKU (`entityRecord`) trae venta y margen del año cerrado JUNTO a stock, rotación y días de
// inventario de la foto de hoy: un solo marco por tool no puede ser correcto para las dos mitades. El texto mixto
// nombra los DOS marcos —así ninguna cifra queda narrada bajo el ajeno— y `familias` viaja aparte, estructurado,
// para que ningún consumidor tenga que adivinarlo con un regex sobre la frase.
export const PERIODO_TXT = {
  anual: "año cerrado — los 12 meses ya ocurrieron",
  hoy: "foto de inventario a hoy — no es un promedio anual",
};
export const PERIODO_MIXTO_TXT =
  "dos marcos en la misma respuesta: la venta, el margen y la contribución son del año cerrado — los 12 meses ya ocurrieron; el capital, el stock, la rotación y los días de inventario son la foto de inventario a hoy. Cada cifra se declara con el suyo.";
// La versión CORTA del mismo marco, para donde la frase se MUESTRA en vez de instruir al narrador (la evidencia de
// Sentrix, el alcance que persona.js recuerda en el prompt). Las de una sola familia ya son cortas y se conservan
// intactas: acá sólo hace falta que el caso mixto no pegue un párrafo donde va una etiqueta.
export const PERIODO_MIXTO_ETIQUETA = "año cerrado + foto de inventario a hoy";
// periodoEtiqueta(familias) → la etiqueta corta del marco | null si no hay familias.
export function periodoEtiqueta(familias) {
  const f = Array.isArray(familias) ? familias : [];
  if (f.length > 1) return PERIODO_MIXTO_ETIQUETA;
  return f.length === 1 ? (PERIODO_TXT[f[0]] || null) : null;
}

// normalizarPeriodo(p) → "anual" | "hoy" | null · EL CANDADO sobre lo que un composer puede poner en el tipo.
// `fig({ periodo })` es una opción abierta y un composer puede escribir ahí la FRASE en vez de la familia
// (medido: un `fig()` nuevo de la cabecera de Capital declaraba `periodo: "foto de inventario a hoy"`). Guardar esa
// frase cruda rompe todo lo que lee el marco como familia — el conteo de abajo, `reconcilian`, el gate de la
// decisión 5. Acá se acepta la familia o cualquiera de las dos frases canónicas, y lo que no se reconoce NO se
// guarda: cae al período que declara el universo, que es dato del contrato y no texto libre.
// UNA FRASE QUE NOMBRA LOS DOS MARCOS NO ES UNA FAMILIA. `PERIODO_MIXTO_TXT` contiene literalmente "año cerrado"
// Y "foto de inventario a hoy": probando "hoy" primero y devolviendo en el primer acierto, esa frase se guardaba
// como `"hoy"` a secas y la mitad anual desaparecía SIN AVISO — justo la pérdida silenciosa que este candado
// existe para impedir. Un período es de UNA familia por definición (el marco mixto se declara con `familias`, no
// con este campo), así que las dos señales juntas son una frase NO reconocible: cae al período del universo, que
// es el default seguro y ya documentado arriba. Hoy ningún composer escribe esa frase en un `fig()`; el candado
// no espera a que alguien lo haga.
export function normalizarPeriodo(p) {
  if (p == null) return null;
  const s = String(p);
  if (PERIODOS.includes(s)) return s;
  const t = s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const esHoy = /foto|a hoy\b/.test(t);
  const esAnual = /ano cerrado|12 meses|ano completo/.test(t);
  if (esHoy && esAnual) return null;   // nombra los dos marcos → no es una familia, no se adivina cuál
  if (esHoy) return "hoy";
  if (esAnual) return "anual";
  return null;
}

// familiasDePeriodo(figs) → ["anual"] | ["hoy"] | ["anual","hoy"] | []  · orden FIJO (anual primero) para que la
// declaración sea estable entre corridas. Una cifra sin marco declarado (los conteos: `unidades` no declara
// período porque un conteo hereda el marco de lo que cuenta) NO vota: no se le inventa uno.
export function familiasDePeriodo(figs) {
  const set = new Set();
  for (const f of Array.isArray(figs) ? figs : []) {
    const p = f && f.tipo && f.tipo.periodo;
    if (p === "anual" || p === "hoy") set.add(p);
  }
  return ["anual", "hoy"].filter((x) => set.has(x));
}

// periodoDeFiguras(figs) → { familias, texto } · el marco que declara un conjunto de cifras.
// `texto` es null cuando ninguna cifra declara marco — el llamador decide qué hacer con eso, acá no se rellena.
export function periodoDeFiguras(figs) {
  const familias = familiasDePeriodo(figs);
  const texto = familias.length === 2 ? PERIODO_MIXTO_TXT : familias.length === 1 ? PERIODO_TXT[familias[0]] : null;
  return { familias, texto };
}

// ── DE QUÉ UNIVERSO ES UNA CIFRA ───────────────────────────────────────────────────────────────────────────────
// Se deriva del LABEL (la convención "Entidad · Concepto" que ya usa todo el motor) más la unidad. Vocabulario
// DECLARADO, no adivinanza: el orden es de lo más específico a lo más general. Nunca devuelve null — un universo
// desconocido sería una cifra sin tipo, que es lo que la decisión 1 prohíbe.
//
// LOS TRES ORÍGENES, y por qué importan. Una etiqueta como "Valparaíso · Capital detenido" dice sola de qué mundo
// es; una como "Materiales de Construcción · Familia" o "Antofagasta · % del total" NO — y en un turno de
// inventario esas cifras SON de inventario (y por lo tanto son la foto de hoy, no el año cerrado). Por eso el
// origen viaja con el tipo: `declarado` (lo dijo el composer) · `label` (lo dice la etiqueta) · `default` (no hay
// señal). SÓLO el `default` acepta que el DOMINIO DEL TURNO lo corrija — ver `conDominioDelTurno`. Sin esa
// distinción, un dominio de turno pisaría la venta del SKU en `inventoryStatus{top_sellers}`, que es exactamente
// la confusión de universos que este módulo existe para impedir.
const _RUTAS = [
  { unidad: "money", re: /\b(capital|stock|inventario|inmovilizad\w*|detenid\w*|sobrestock|quiebre|reponer|liquidar|mercader[íi]a)\b/i, universo: "inventario", especifica: true },
  { unidad: "money", re: /\b(precio|precio lista|costo medio|costo unitario|ticket|valor unitario|por unidad)\b/i, universo: "precio_unitario", especifica: true },
  { unidad: "money", re: /\b(resultado|gastos?|ebitda|utilidad|resultado final|resultado operacional)\b/i, universo: "resultado_pnl", especifica: true },
  { unidad: "money", re: /./, universo: "venta_comercial", especifica: false },
  { unidad: "pct", re: /\b(inventario|stock|capital|rotaci[oó]n|cobertura|quiebre|sobrestock)\b/i, universo: "tasa_inventario", especifica: true },
  { unidad: "pct", re: /./, universo: "tasa_comercial", especifica: false },
  { unidad: "ratio", re: /./, universo: "rotacion", especifica: false },
  { unidad: "days", re: /./, universo: "dias_inventario", especifica: false },
  { unidad: "count", re: /./, universo: "unidades", especifica: false },
  { unidad: "pp", re: /./, universo: "brecha_pp", especifica: false },
];
// El default de cada unidad cuando el TURNO es de inventario (metricRegistry declara `domain: "inventario"` para
// capital, rotación y días de inventario — ver DOMINIO_INVENTARIO abajo).
const _DEFAULT_INVENTARIO = { money: "inventario", pct: "tasa_inventario", ratio: "rotacion", days: "dias_inventario", count: "unidades", pp: "brecha_pp" };
// Las métricas cuyo dominio declarado es inventario. Espeja `metricRegistry.METRICS[x].domain === "inventario"`;
// se replica acá —cuatro strings— para que este módulo siga sin imports, y `_tipado_cifra_gate.mjs` verifica en
// cada corrida que las dos listas coinciden: si alguien agrega una métrica de inventario allá y no acá, el gate
// se pone rojo. Declarado y verificado, no duplicado a ciegas.
export const DOMINIO_INVENTARIO = ["capital", "rotacion", "doh", "cobertura"];

// universoConOrigen(label, unit, dominio) → { universo, origen: "label" | "default" }
export function universoConOrigen(label, unit, dominio = null) {
  const s = String(label == null ? "" : label);
  const u = String(unit || "money");
  for (const r of _RUTAS) if (r.unidad === u && r.especifica && r.re.test(s)) return { universo: r.universo, origen: "label" };
  if (dominio === "inventario" && _DEFAULT_INVENTARIO[u]) return { universo: _DEFAULT_INVENTARIO[u], origen: "default" };
  for (const r of _RUTAS) if (r.unidad === u && !r.especifica) return { universo: r.universo, origen: "default" };
  return { universo: "venta_comercial", origen: "default" };   // unidad fuera del vocabulario: el default del negocio
}
export function universoDe(label, unit, dominio = null) { return universoConOrigen(label, unit, dominio).universo; }

// dominioDeFacts(facts) → "inventario" | null · el DOMINIO del turno, leído de lo que la tool YA declara
// (`facts.lens` / `facts.metrica`, que son la salida canonicalizada del motor). No adivina: si la tool no declara
// ninguna de las dos cosas, no hay dominio y el default del negocio queda como está.
export function dominioDeFacts(facts) {
  if (!facts || typeof facts !== "object") return null;
  if (facts.lens === "inventory") return "inventario";
  if (typeof facts.metrica === "string" && DOMINIO_INVENTARIO.includes(facts.metrica)) return "inventario";
  return null;
}

// conDominioDelTurno(tipo, label, dominio) → el mismo tipo, con el universo corregido SÓLO si venía por `default`.
// Un universo `declarado` por el composer o deducido del `label` es más específico que el dominio del turno y
// nunca se pisa. Devuelve la MISMA referencia cuando no hay nada que corregir (cero costo en el caso normal).
export function conDominioDelTurno(tipo, label, dominio) {
  if (!tipo || !dominio || tipo.universoOrigen !== "default") return tipo;
  const { universo, origen } = universoConOrigen(label, tipo.unidad, dominio);
  if (universo === tipo.universo) return tipo;
  const U = UNIVERSOS[universo];
  return { ...tipo, universo, universoEtiqueta: U.etiqueta, universoOrigen: origen, moneda: U.moneda, escala: U.escala, periodo: U.periodo };
}

// ── VERIFICABILIDAD · CÓMO SE COMPRUEBA ESA CIFRA (base del sello, decisión 2) ─────────────────────────────────
// Clases:
//   literal                    · lectura directa del campo almacenado                         → probado
//   derivada_reconciliada      · cuenta del motor que CIERRA contra sus componentes           → probado
//   derivada_no_reconciliada   · cuenta del motor que NO cierra, o depende de una vara/supuesto → indicado
//   declarada_no_verificable   · la fuente la declara y el dato disponible no la reconstruye  → indicado
//   no_calculable              · no se puede calcular ni aislar                               → abierto
export const CLASES_VERIFICABILIDAD = {
  literal: "probado", derivada_reconciliada: "probado",
  derivada_no_reconciliada: "indicado", declarada_no_verificable: "indicado", no_calculable: "abierto",
};

// POR MÉTRICA (independiente del eje) · cada regla con su evidencia MEDIDA sobre el tenant demo.
export const VERIFICABILIDAD_POR_METRICA = [
  {
    re: /\b(d[ií]as de inventario|d[ií]as de cobertura|cobertura|DOH|d[ií]as sin venta)\b/i,
    clase: "declarada_no_verificable",
    razon: "«días de inventario» es un campo DECLARADO por la fuente (skuInventario.doh): reconstruirlo desde stock ÷ venta diaria cierra en 3 de 13 filas, y `cobertura` es OTRO campo declarado que coincide con `doh` en 5 de 13. No es derivable del dato disponible",
  },
  {
    re: /\brotaci[oó]n\b/i,
    clase: "declarada_no_verificable",
    razon: "la rotación es un campo DECLARADO por la fuente (skuInventario.rotacion): 365 ÷ días de inventario cierra en 0 de 13 filas. No es derivable del dato disponible",
  },
  {
    re: /\b(no capturad\w*|en juego|brecha|exceso|recuperable|potencial|oportunidad|perdid\w*|detenid\w*)\b/i,
    clase: "derivada_no_reconciliada",
    razon: "es una PALANCA: se calcula contra una vara (benchmark/target/política), no se lee de ninguna fuente — depende del supuesto de que esa vara es alcanzable",
  },
];

// ── CUÁNDO LA RE-DERIVACIÓN DEPENDE DEL ESCENARIO ──────────────────────────────────────────────────────────────
// No todos los ejes re-derivan igual, y el escenario decide (owner 2026-08-09, decisión 2 · corregido tras medir
// eje × escenario, no sólo «actual»):
//   · cliente y canal   → `applyScenarioToClientesMargen` re-deriva SIEMPRE, incluso sin transformación: el
//                         comentario del propio motor lo dice ("ahora aplicada siempre, no solo con transform")
//                         y se mide — la contribución servida difiere del literal en 13/13 filas también en «actual».
//   · familia           → `applyScenarioToSfamiliasMargen` abre con `if (!SCENARIO_TRANSFORMS[id]?.clientes)
//                         return sfamiliasMargen`: en «actual» sirve el LITERAL, tal cual está almacenado, y
//                         cierra 4/4. Sellarla `indicado` ahí era marcar como estimación un dato real — justo lo
//                         que la decisión 2 prohíbe ("una cifra literal NO debe quedar indicado si es dato real").
//   · marca y sku       → scenario-BLIND por contrato (`sourceManifest.scenarioLoad = null`, y
//                         `metricRegistry.scenarioAware.marca/sku = false`): sirven el literal en los cuatro
//                         escenarios. Medido con la tool real, no con la función de transformación suelta —
//                         `applyScenarioToMarcasMargen` existe pero la ruta de recuperación no la usa.
export const ESCENARIO_BASE = "actual";
// Espeja las claves de `SCENARIO_TRANSFORMS` (config/scenarios.js) que traen transformación de clientes — las
// mismas que hacen que los agregados por familia dejen de ser el literal. Se replica acá —tres strings— para que
// este módulo siga SIN IMPORTS (boleta.js lo importa río arriba); `_tipado_cifra_gate.mjs` verifica en cada
// corrida que las dos listas coinciden, igual que con DOMINIO_INVENTARIO. Declarado y verificado, no a ciegas.
export const ESCENARIOS_CON_TRANSFORM = ["bonanza", "tension", "crisis"];
// Y el subconjunto que además mueve las TASAS (margen %, % de acciones comerciales). No es el mismo conjunto:
// «bonanza» declara las claves `marginErosion`/`rebateDelta` pero en CERO, así que el margen y el % de acciones
// comerciales que sirve son EXACTAMENTE los almacenados (medido: 0/13 filas difieren). Esa diferencia importa —
// sellar esas tasas `indicado` en bonanza sería marcar como estimación un dato que no se movió. El gate verifica
// esta lista derivándola del propio SCENARIO_TRANSFORMS.
export const ESCENARIOS_QUE_ALTERAN_TASAS = ["tension", "crisis"];
// escenarioReDeriva(escenario) → ¿este escenario hace que los agregados dejen de ser el literal almacenado?
// `null` (la cifra no declara escenario) devuelve true: sin saberlo, el sello honesto es el que NO sobre-afirma.
export function escenarioReDeriva(escenario) {
  if (escenario == null) return true;
  return escenario !== ESCENARIO_BASE && ESCENARIOS_CON_TRANSFORM.includes(String(escenario));
}
// escenarioAlteraTasas(escenario) → ¿este escenario mueve margen % y % de acciones comerciales?
export function escenarioAlteraTasas(escenario) {
  if (escenario == null) return true;
  return ESCENARIOS_QUE_ALTERAN_TASAS.includes(String(escenario));
}

// POR MÉTRICA × EJE · lo que este módulo NO puede resolver solo (necesita el catálogo del tenant para saber el eje).
// Lo aplica `buildClaims`, que ya resuelve el eje real de cada entidad con el índice O(1) de Fase 3.
//   `ejes`                 → el motor re-deriva SIEMPRE, en cualquier escenario.
//   `ejesSoloConEscenario` → sólo re-deriva cuando el escenario trae transformación (ver escenarioReDeriva).
//   `unidades`/`universos` → A QUÉ CIFRAS habla la regla. Sin esto, el `re` de la etiqueta barría de más:
//        · «Costo medio unitario» es `costoMedio`, que pasa por el motor SIN TOCAR en los 4 escenarios
//          (medido 0/13) — es del universo `precio_unitario`, no del monto re-derivado;
//        · «Peso del costo» es costoMedio ÷ precioLista, un cociente exacto entre DOS literales que no se
//          mueven nunca — reconcilia con sus componentes por construcción;
//        · «Margen de contribución» y «Rebate (%)» son TASAS, y las gobierna la regla de tasas de abajo.
//      Las tres reglas de monto hablan del MONTO del mundo comercial: unidad money y universo venta_comercial.
export const VERIFICABILIDAD_POR_EJE = [
  {
    re: /\bcontribuci[oó]n\b/i, ejes: ["cliente", "canal"], ejesSoloConEscenario: ["familia"],
    unidades: ["money"], universos: ["venta_comercial", "resultado_pnl"],
    clase: "derivada_no_reconciliada",
    razon: "el motor RE-DERIVA la contribución del cliente como venta oficial × margen en TODOS los escenarios, incluido «actual» (applyScenarioToClientesMargen): difiere del literal almacenado en 13 de 13 filas — Falabella $4.3M servido contra $4.1M almacenado (5,0%)",
    razonEscenario: "en este escenario la contribución por familia se re-agrega desde los clientes ya re-derivados (applyScenarioToSfamiliasMargen): difiere del literal almacenado en 4 de 4 filas. En «actual» ese mismo campo se sirve literal y por eso ahí sí es probado",
  },
  {
    re: /\bcosto\b/i, ejes: ["cliente", "canal"], ejesSoloConEscenario: ["familia"],
    unidades: ["money"], universos: ["venta_comercial", "resultado_pnl"],
    clase: "derivada_no_reconciliada",
    razon: "el costo del cliente se re-deriva como venta oficial − contribución re-derivada; no es el costo almacenado",
    razonEscenario: "en este escenario el costo por familia se re-agrega desde los clientes ya re-derivados; en «actual» se sirve el costo almacenado",
  },
  {
    re: /\b(acciones comerciales|rebates?)\b/i, ejes: ["cliente", "canal"], ejesSoloConEscenario: ["familia"],
    unidades: ["money"], universos: ["venta_comercial", "resultado_pnl"],
    clase: "derivada_no_reconciliada",
    razon: "el monto de acciones comerciales se re-deriva como venta oficial × % declarado; el monto almacenado se descarta para que `rebates ÷ venta = pctRebate` cierre exacto",
    razonEscenario: "en este escenario las acciones comerciales por familia se re-agregan desde los clientes ya re-derivados; en «actual» se sirve el monto almacenado",
  },
  // LAS TASAS · margen % y % de acciones comerciales. No las toca la reconciliación con la venta oficial (medido:
  // 0/13 filas difieren en «actual» y en «bonanza»); las mueve SÓLO el escenario que declara erosión de margen o
  // delta de rebate — y ahí sí son un supuesto del escenario, no una lectura. Por eso van con su propia condición.
  {
    re: /(margen de contribuci[oó]n|rebates?\s*\(%\)|carga comercial|% de acciones comerciales)/i,
    ejes: [], ejesSoloConEscenario: ["cliente", "canal", "familia"], porTasas: true,
    unidades: ["pct"],
    clase: "derivada_no_reconciliada",
    razon: "en este escenario la tasa es un SUPUESTO declarado (erosión de margen / delta de acciones comerciales), no la tasa almacenada",
  },
];

// verificabilidadDe(label, unit, {formula, source, reconcilia, declarada}) → { clase, razon }
// Precedencia: lo que el composer DECLARA explícito gana sobre la tabla; la tabla gana sobre el default.
export function verificabilidadDe(label, unit, { formula = null, source = "actual", reconcilia = null, declarada = false } = {}) {
  const s = String(label == null ? "" : label);
  if (declarada === true) return { clase: "declarada_no_verificable", razon: "la fuente la declara y el dato disponible no la reconstruye" };
  if (source && source !== "actual") return { clase: "derivada_no_reconciliada", razon: `la cifra es ${source}: no es una lectura del dato, es un supuesto del motor` };
  if (formula) {
    return reconcilia === true
      ? { clase: "derivada_reconciliada", razon: `cálculo determinístico que cierra contra sus componentes (${formula})` }
      : { clase: "derivada_no_reconciliada", razon: `cálculo del motor (${formula}) sin reconciliación declarada contra sus componentes` };
  }
  const m = VERIFICABILIDAD_POR_METRICA.find((r) => r.re.test(s));
  if (m) return { clase: m.clase, razon: m.razon };
  return { clase: "literal", razon: "lectura directa del campo almacenado en la fuente" };
}

// refinarPorEje(label, eje, escenario) → la regla que aplica cuando el eje YA está resuelto | null si ninguna.
// El ESCENARIO importa: hay ejes que el motor re-deriva siempre y otros sólo bajo transformación (ver arriba).
// `unidad`/`universo` son los del TIPO de la cifra (boleta.js). Se pasan cuando se conocen; omitirlos mantiene el
// comportamiento anterior, así que ningún call-site queda obligado a cambiar.
export function refinarPorEje(label, eje, escenario = null, { unidad = null, universo = null } = {}) {
  if (!eje) return null;
  const s = String(label == null ? "" : label);
  for (const r of VERIFICABILIDAD_POR_EJE) {
    if (!r.re.test(s)) continue;
    if (unidad && r.unidades && !r.unidades.includes(unidad)) continue;
    if (universo && r.universos && !r.universos.includes(universo)) continue;
    if (r.ejes.includes(eje)) return r;
    if ((r.ejesSoloConEscenario || []).includes(eje)) {
      const aplica = r.porTasas ? escenarioAlteraTasas(escenario) : escenarioReDeriva(escenario);
      if (aplica) return r.razonEscenario ? { ...r, razon: r.razonEscenario } : r;
    }
  }
  return null;
}

// selloDe(clase) → probado | indicado | abierto
export function selloDe(clase) { return CLASES_VERIFICABILIDAD[clase] || "probado"; }

// ── EL TIPO COMPLETO ───────────────────────────────────────────────────────────────────────────────────────────
// `_SEP` es la MISMA convención "Entidad · Concepto" de boleta.js/specRetrieval.js/ledger.js/narrationContract.js.
const _SEP = " · ";
function _entidadDeLabel(label) {
  const s = String(label == null ? "" : label);
  const i = s.indexOf(_SEP);
  return i < 0 ? null : (s.slice(0, i).trim() || null);
}

// deriveFigureType(fig-ish) → el bloque `tipo` de una cifra. Todo campo que el composer declara se respeta; lo que
// no declara se DERIVA del contrato — nunca queda vacío por olvido, que es exactamente lo que decisión 1 prohíbe.
export function deriveFigureType({
  label, unit = "money", source = "actual", formula = null,
  moneda, escala, periodo, escenario = null, universo, entidad, dimension = null, fuente = null,
  sello = null, reconcilia = null, declarada = false, verificabilidadRazon = null,
} = {}) {
  const declarado = universo && UNIVERSOS[universo];
  const resuelto = declarado ? { universo, origen: "declarado" } : universoConOrigen(label, unit);
  const uni = resuelto.universo;
  const U = UNIVERSOS[uni];
  const v = verificabilidadDe(label, unit, { formula, source, reconcilia, declarada });
  const selloFinal = SELLOS.includes(sello) ? sello : selloDe(v.clase);
  return {
    unidad: unit,
    moneda: moneda !== undefined ? moneda : U.moneda,
    escala: escala !== undefined ? escala : U.escala,
    // el marco SIEMPRE es una de las familias declaradas: lo que el composer escriba se normaliza, y si no se
    // reconoce manda el período del universo (ver normalizarPeriodo).
    periodo: periodo !== undefined ? (normalizarPeriodo(periodo) || U.periodo) : U.periodo,
    escenario: escenario || null,
    universo: uni,
    universoEtiqueta: U.etiqueta,
    universoOrigen: resuelto.origen,
    entidad: entidad !== undefined ? entidad : _entidadDeLabel(label),
    dimension: dimension || null,
    fuente: fuente || null,
    sello: selloFinal,
    verificabilidad: v.clase,
    // LA RAZÓN TAMBIÉN SE RESPETA SI EL COMPOSER LA DECLARA (owner 2026-08-12). Era la única excepción a la regla
    // que este archivo declara en su propia cabecera —«todo campo que el composer declara se respeta»—: la clase se
    // derivaba bien pero la razón salía siempre genérica («es un supuesto del motor»), y el narrador recibía un
    // estatus sin saber DE QUÉ es la estimación. Una afinidad de surtido y un promedio ponderado son las dos
    // `derivada_no_reconciliada` y no se narran igual.
    verificabilidadRazon: verificabilidadRazon || v.razon,
  };
}
