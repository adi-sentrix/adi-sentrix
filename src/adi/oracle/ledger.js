/* === src/adi/oracle/ledger.js · ARQUITECTURA C · LEDGER DE CIFRAS CON PROCEDENCIA ===
 * Fase 0 (andamio en sombra). El "oráculo verificado" reemplaza el embudo angosto: el LLM PLANEA qué datos
 * necesita, el motor los TRAE con la garantía de siempre, y el LLM NARRA sobre ellos bajo el guard.
 *
 * El LEDGER es la boleta UNIFICADA de un turno: acumula los fig() de N tool-calls, estampando cada cifra con su
 * PROCEDENCIA origin={tool, callId, scope, entityLabel}. Hoy la boleta es de UN composer one-shot; el ledger es la
 * unión de todas las llamadas del plan → habilita respuestas que componen varios datos, y la procedencia habilita
 * el guard POR-CALL-SCOPE de la Fase 2 (una cifra se valida contra la boleta de la call que NOMBRA su entidad, no
 * contra la unión — cierra el hueco "cifra real, referente inventado").
 *
 * PURO · sin estado global · sin I/O. Mismas tool-calls → mismo ledger (byte-igual · gate-testable).
 * NO importado por el pipeline vivo (Fase 0 es sombra): montarlo no cambia ninguna respuesta a clientes.
 */

import { fig } from "../boleta.js";
// EL TIPO DE LA CIFRA (owner 2026-08-09, decisión 1): el ledger es el ÚNICO punto por el que pasan todas las
// cifras de todas las calls, así que es donde se completan los campos del tipo que el composer no puede conocer
// —el escenario del turno, la tool de origen, y el DOMINIO cuando la etiqueta sola no alcanza a decirlo.
import { conDominioDelTurno, dominioDeFacts } from "../../config/contract/figureType.js";
import { simboloMoneda } from "../../config/moneda.js";

// createLedger() → ledger vacío. figs: la boleta plana acumulada (cada fig con .origin). calls: el trace por call.
export function createLedger() {
  return { figs: [], calls: [] };
}

// ── ENRIQUECIMIENTO boleta ← facts (Fase calidad · adelanto de Fase 5) ──────────────────────────────────────────
// La boleta del composer es un SUBCONJUNTO curado; los `facts` traen TODO lo que el motor calculó (filas, DOH, gaps,
// share…). El LLM interpreta con los facts → citaba cifras REALES pero no autorizadas → guardC abstenía. Autorizar
// las cifras de los facts es SEGURO (son del motor, no inventadas): el guard sigue bloqueando derivaciones (sumas
// que NO están en facts) y mala atribución (por-call-scope). Reusa las cifras ya FORMATEADAS de los facts + usd crudo.
const _moneyE = (v) => { const a = Math.abs(v), s = v < 0 ? "-" : ""; if (a >= 1e6) return `${s}${simboloMoneda()}${(a / 1e6).toFixed(1)}M`; if (a >= 1e3) return `${s}${simboloMoneda()}${Math.round(a / 1e3)}K`; return `${s}${simboloMoneda()}${Math.round(a)}`; };
// FIX (owner 2026-08-05, hallazgo en vivo agregando variacionMensual a trend): la rama "%" NO capturaba el signo
// negativo ("-3.2%" solo matcheaba "3.2%", perdiendo el signo) — a diferencia de la rama "$" que sí lo hace
// (`-?\$...`). Una cifra de facts formateada como string negativo (ej. una variación % que cae bajo presupuesto/
// año anterior) quedaba autorizada como su valor POSITIVO — si el narrador citaba el signo real ("-3.2%"), el
// canon de la narración (guardC/boleta.js parseFigures, que SÍ captura el signo) no coincidía con el canon
// autorizado → falso "cifra-no-autorizada" en cualquier variación negativa. Mismo criterio que la rama "$", ahora
// simétrico.
const _FIGRE = /-?\$\s?\d[\d.,]*\s*[KMB]?|-?\d[\d.,]*\s*%|\d[\d.,]*\s*(?:x|×)|\b\d+\s*d(?:[ií]as?)?\b/gi;
const _unitOf = (v) => /%/.test(v) ? "pct" : /(?:×|\dx)\b/i.test(v) ? "ratio" : /\d\s*d(?:[ií]as?)?\b/i.test(v) ? "days" : "money";
// crudos → unidad por NOMBRE de clave (días/%/x · el $ se omite: la escala K/crudo es ambigua sin el formateo del composer)
const _KEYUNIT = [[/doh|d[ií]as/i, "days"], [/rotacion/i, "ratio"], [/margen|carga|benchmark|rebate|share|participaci|concentraci|cobertura|variacion|yoy|crecimiento|pct|porcentaje/i, "pct"]];
// _ENTITY_KEYS/_entityOf: de qué campo sale el nombre de la entidad de un nodo — no solo los genéricos
// (name/entidad/nombre/label), TAMBIÉN los ejes de negocio concretos que usan los composers (sku/bodega/familia/
// cliente/marca). Owner 2026-08-02: "filtra o etiqueta esas cifras por entidad y alcance... impedir cualquier
// atribución incorrecta también en prosa" — hallazgo en vivo: facts.inventory.bySku[]/byBodega[]
// (specRetrieval.js) no tienen .nombre/.name/.entidad/.label, solo .sku/.bodega — antes caían al fallback de la
// CLAVE cruda del campo ("doh"/"pct"/"rotacion"), sin decir de QUIÉN es esa cifra (podía citarse en prosa
// atribuida a la entidad equivocada, o a ninguna).
const _ENTITY_KEYS = ["name", "entidad", "nombre", "label", "sku", "bodega", "familia", "cliente", "marca"];
const _entityOf = (node) => { for (const k of _ENTITY_KEYS) if (node[k] != null && node[k] !== "") return String(node[k]); return null; };
// _humanizeKey: la CLAVE del campo numérico (antes usada tal cual como si fuera el label completo) se combina
// como "Entidad · Concepto" (misma convención que boleta.js fig(), reforzada en toda la sesión 2026-08-02) —
// nunca la entidad sola (dos campos numéricos del mismo nodo colisionarían bajo el mismo label).
const _KEYLABEL = {
  // «Días de inventario», no «Días de cobertura» (owner 2026-08-10): es el MISMO campo `doh` que entityRecord ya
  // etiqueta así, y «cobertura» es la palabra que se retiró del producto porque llegó a nombrar dos campos
  // distintos del dato. Dos nombres para una cifra autorizada es la mitad fácil del problema, pero es la mitad
  // que hace que el usuario crea que le están hablando de dos cosas.
  doh: "Días de inventario", diasSinVenta: "Días sin venta", pct: "% del total", porcentaje: "% del total",
  rotacion: "Rotación", yoy: "YoY",
  // HALLAZGO G (owner 2026-08-09) · las claves que más aparecen en los facts de los paneles, para que el segundo
  // segmento del label diga algo de negocio y no la clave cruda de un objeto ("valFmt" → "Valor").
  venta: "Venta", ventas: "Venta", val: "Valor", valFmt: "Valor", usd: "Monto", monto: "Monto",
  contribucion: "Contribución", margen: "Margen", capital: "Capital", stockUSD: "Stock", stockUnd: "Stock (unidades)",
  vendidoMes: "Vendido en el mes", ventaDiaria: "Venta diaria", markup: "Markup", costShare: "Peso del costo",
  benchmark: "Benchmark", brecha: "Brecha", pctRebate: "Carga comercial", rebates: "Acciones comerciales",
};
const _humanizeKey = (k) => _KEYLABEL[k] || k.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/^./, (c) => c.toUpperCase());
// _labelDe(entidad, clave) → la etiqueta CANÓNICA "Entidad · Concepto" (owner 2026-08-09, hallazgo G).
// EL DEFECTO QUE CIERRA: acá se etiquetaba con el nombre PELADO de la entidad ("Falabella") cuando el nodo la
// traía. Río abajo, `narrationContract._splitLabel` parte en el PRIMER " · " y define —correctamente— que un label
// SIN separador es una cifra DEL NEGOCIO, sin dueño. Resultado medido: 11 claims de marginRead y 9 de salesRead
// quedaban tipados `sujetoTipo: "negocio"` siendo de un cliente, y esta oración pasaba el muro con ok=true:
//     «Tu negocio cerró el año en $19.4M»   ($19.4M es Falabella; el negocio vende $100.0M)
// Con el separador, el claim recupera su dueño y el chequeo 12 de guardC —que juzga exactamente ese caso— lo ve.
// Sin entidad reconocible se conserva la clave sola: hay valores genuinamente globales que llegan así
// ("headlineSub", "comparacion.vs_anio_anterior") y NO deben inventarse un dueño.
const _normL = (s) => String(s == null ? "" : s).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
function _labelDe(entidad, clave) {
  const e = entidad == null ? "" : String(entidad).trim();
  const k = clave == null ? "" : String(clave).trim();
  if (!e) return k;
  if (!k || _normL(k) === _normL(e)) return e;   // la clave ES el nombre (no agrega concepto) → no se duplica
  return `${e} · ${_humanizeKey(k)}`;
}
export function enrichFromFacts(boleta, facts) {
  if (!facts || typeof facts !== "object") return boleta;
  const seen = new Set(boleta.map((f) => f.canon));
  const add = (label, tok) => {
    const v = String(tok).trim().replace(/\s+/g, " "); if (!v || v === "—") return;
    const f = fig(String(label || v), v, { unit: _unitOf(v) });
    if (seen.has(f.canon)) return; seen.add(f.canon); boleta.push(f);
  };
  /* ── UNA MATRIZ NO SE APLANA A FILAS INDISTINGUIBLES (owner 2026-08-11, punto 4) ─────────────────────────────
   * MEDIDO en E3.t3: la respuesta mostró CINCO filas «Ene» con valores distintos ($277K, $269K, $249K, $125K,
   * $705K) y la boleta traía seis figs con esa misma etiqueta. El composer NO estaba mal: emite una matriz
   * correcta —`rows[] = {label:"Ene", values:["$277K","$269K",…]}` con `cols = ["Falabella","Jumbo",…]`—. Lo que
   * fallaba era el aplanado: `walk` tomaba `label` como sujeto y le colgaba las N celdas de la fila, así que la
   * identidad de la COLUMNA (qué serie es cada valor) se perdía y quedaban cinco cifras distintas con un nombre.
   * ACÁ SE CRUZA LA MATRIZ ANTES DE APLANAR: cada celda se etiqueta «<columna> · <fila>», que es lo que la celda
   * significa de verdad. Con UNA sola columna no hay ambigüedad y se deja el comportamiento de siempre. */
  const _matriz = (t) => {
    if (!t || !Array.isArray(t.rows) || !Array.isArray(t.cols) || t.cols.length < 2) return false;
    for (const r of t.rows) {
      if (!r || !Array.isArray(r.values) || r.values.length < 2) continue;
      r.values.forEach((celda, i) => {
        const col = t.cols[i];
        if (!col || typeof celda !== "string") return;
        const mm = celda.match(_FIGRE);
        if (mm) mm.forEach((g) => add(`${col} · ${r.label}`, g));
      });
    }
    return true;
  };
  const _tablaM = facts && facts.tablaM;
  const _yaCruzada = _matriz(_tablaM);

  const walk = (node, entity, key = null) => {
    // la matriz ya se emitió con su columna: volver a caminarla la aplanaría de nuevo y reintroduciría el defecto.
    if (_yaCruzada && node === _tablaM) return;
    if (node == null) return;
    // STRING SUELTO (dentro de un array): las celdas ya formateadas de una MATRIZ viven así — tablaM.rows[].values =
    // ["$6.8M","$6.3M",…] (la serie mes a mes de `trend`). Sin esta rama se descartaban y el guard bloqueaba TODA la
    // tabla temporal (cifras REALES del motor, no autorizadas). Mismo criterio que un string en un campo con nombre.
    if (typeof node === "string") { const mm = node.match(_FIGRE); if (mm) mm.forEach((g) => add(entity || key, g)); return; }
    if (Array.isArray(node)) { node.forEach((x) => walk(x, entity, key)); return; }
    if (typeof node === "object") {
      const ent = _entityOf(node) || entity || null;
      // findings (diagnose): usd crudo. El concepto sale del propio finding (`tipo`/`concepto`/`label`) y si no
      // trae ninguno queda "Monto" — nunca el nombre pelado (hallazgo G).
      if (typeof node.usd === "number" && node.entidad) add(_labelDe(node.entidad, node.concepto || node.metrica || node.tipo || node.label || "monto"), _moneyE(node.usd));
      for (const [k, v] of Object.entries(node)) {
        if (typeof v === "string") { const mm = v.match(_FIGRE); if (mm) mm.forEach((g) => add(_labelDe(ent, k), g)); }
        else if (typeof v === "number" && Number.isFinite(v)) {
          // crudos por unidad-según-clave · SOLO días/%/x (el $ se omite por la ambigüedad de escala K/crudo)
          const ku = _KEYUNIT.find(([re]) => re.test(k));
          if (!ku) continue;
          // SIN entidad real (ni siquiera sku/bodega/familia/cliente/marca) → NO se autoriza la cifra suelta:
          // impide atribución incorrecta (owner 2026-08-02). Alcance seguro: SOLO la rama numérica — la rama de
          // texto (arriba) no se toca, porque hay valores de negocio genuinamente globales que llegan como string
          // ya formateado (ej. trend/toolRegistry.js "comparacion.vs_anio_anterior") y SÍ deben seguir autorizados
          // sin entidad — no son el mismo riesgo (vienen pre-formateados por el motor, no son doh/rotacion/pct
          // crudos de una fila de un array sin nombre).
          if (!ent) continue;
          // "pct" (owner 2026-08-03, Fase 1 eficiencia de Mini — bug de redondeo cazado en auditoría): las otras dos
          // ramas YA redondean (days → entero, ratio → 1 decimal) pero esta autorizaba el float CRUDO completo
          // (ej. "23.457893214%") — inconsistente con la convención de TODO el resto de la app (composers/
          // executiveReport.js/comparisons.js/followups.js/mechanisms.js: SIEMPRE `.toFixed(1)` para %). Mismo
          // redondeo que ya usan los demás campos de esta rama, no una regla nueva — nunca citado en la práctica
          // con el float completo (0/26 en la muestra de auditoría), así que esto es consistencia pura, no un
          // cambio de comportamiento observable.
          add(_labelDe(ent, k), ku[1] === "days" ? `${Math.round(v)}d` : ku[1] === "ratio" ? `${v.toFixed(1)}x` : `${v.toFixed(1)}%`);
        } else walk(v, ent, k);
      }
      return;
    }
  };
  walk(facts, null);
  return boleta;
}

// recordCall(ledger, meta, result) → estampa cada fig del result con su procedencia y lo acumula.
//   meta   = { tool, callId, scope, args }  (scope = el eje/alcance de la call · base del guard por-call-scope)
//   result = { facts, boleta:fig[], coverage }  (contrato uniforme de una tool-oráculo)
// entityLabel se toma del label de la fig (donde el composer ya pone la entidad: "Falabella · Margen") — semilla
// del binding cifra↔entidad que la Fase 2 usa para validar la atribución.
export function recordCall(ledger, { tool, callId, scope = null, args = null } = {}, result, boletaYaTipada = null) {
  // `boletaYaTipada`: la MISMA boleta que produce `tiparBoleta`, cuando el llamador ya la calculó (toolRunner la
  // necesita ANTES de grabar para poder derivar el período de la NATURALEZA de las cifras — decisión 5). Se reusa
  // en vez de recalcularla: dos pasadas de `enrichFromFacts` sobre los mismos facts sería trabajo duplicado y, peor,
  // una segunda implementación del tipado conviviendo con esta.
  const stamped = Array.isArray(boletaYaTipada) ? boletaYaTipada : tiparBoleta({ tool, callId, scope, args }, result);
  ledger.figs.push(...stamped);
  ledger.calls.push({
    tool, callId, scope, args: args || null,
    coverage: (result && result.coverage) || null,
    figCount: stamped.length,
  });
  return ledger;
}

// tiparBoleta(meta, result) → las figs de UNA call, enriquecidas desde sus facts y con el TIPO completo + la
// procedencia. Es EXACTAMENTE lo que el ledger graba; se exporta para que `toolRunner` pueda leer el tipo de las
// cifras antes de estamparlas —el período sale de la naturaleza de la cifra, y esa naturaleza vive en el tipo— sin
// abrir una segunda transformación en paralelo.
export function tiparBoleta({ tool, callId, scope = null, args = null } = {}, result) {
  const base = (result && Array.isArray(result.boleta)) ? result.boleta.slice() : [];
  // enriquece con las cifras REALES de los facts que la boleta curada no cubría (baja abstenciones · guardC intacto)
  const boleta = enrichFromFacts(base, result && result.facts);
  // EL TIPO SE COMPLETA ACÁ (decisión 1, owner 2026-08-09). Dos campos del tipo NO los puede saber el composer
  // porque no son suyos, son DEL TURNO: el ESCENARIO con el que corrió la tool y la FUENTE (qué tool trajo la
  // cifra). El ledger es el único punto por el que pasan TODAS las cifras de TODAS las calls — estamparlos acá es
  // lo que garantiza que ninguna quede sin declararlos, sin tocar un solo composer. Lo que el composer SÍ declaró
  // (un escenario de simulación, una fuente más precisa) manda: nunca se pisa.
  const escenarioDelTurno = (args && args.scenario) || null;
  // `dimension` SÓLO del arg homónimo: `scope` puede traer una ENTIDAD ("Falabella") y no un eje, y estampar eso
  // como dimensión sería exactamente la mala tipificación que este paso corrige. El eje real de cada cifra lo
  // resuelve `buildClaims` contra el catálogo del tenant.
  const dimDelTurno = (args && typeof args.dimension === "string" && args.dimension) || null;
  // EL DOMINIO DEL TURNO, leído de lo que la tool ya declara (facts.lens/facts.metrica). Corrige SÓLO las cifras
  // cuya etiqueta no da ninguna señal de mundo: "Antofagasta · % del total" y "Materiales de Construcción ·
  // Familia" son inventario en un turno de capital, y por lo tanto la FOTO DE HOY — sin esto quedaban tipadas como
  // venta comercial del año cerrado. Nunca pisa una etiqueta que sí habla ("SAM-TV55 · Venta" sigue siendo venta
  // aunque la tool sea inventoryStatus, que es justo el caso de `top_sellers`).
  const dominioDelTurno = dominioDeFacts(result && result.facts);
  return boleta.map((f) => ({
    ...f,
    ...(f && f.tipo ? {
      tipo: {
        ...conDominioDelTurno(f.tipo, f.label, dominioDelTurno),
        escenario: f.tipo.escenario || escenarioDelTurno,
        fuente: f.tipo.fuente || tool || null,
        dimension: f.tipo.dimension || dimDelTurno,
      },
    } : {}),
    origin: { tool, callId, scope, entityLabel: (f && f.label) || null },
  }));
}

// ledgerBoleta(ledger) → la boleta plana del turno (unión de todas las calls). Compat directo con
// guardAgainstBoleta(narración, boleta) del guard actual: el ledger es un drop-in de la boleta one-shot.
export function ledgerBoleta(ledger) {
  return (ledger && Array.isArray(ledger.figs)) ? ledger.figs : [];
}

// figsForEntity(ledger, entidad) → las figs cuya call NOMBRA esa entidad en su label (match por token, no substring
// de 3 chars). Base del guard POR-CALL-SCOPE de la Fase 2 — acá se deja lista la consulta, aún NO se aplica en vivo.
export function figsForEntity(ledger, entidad) {
  const n = String(entidad == null ? "" : entidad).trim().toLowerCase();
  if (n.length < 3) return [];
  return ledgerBoleta(ledger).filter((f) => {
    const lbl = String((f.origin && f.origin.entityLabel) || f.label || "").toLowerCase();
    return lbl.includes(n);   // Fase 2 endurecerá a match de token; en Fase 0 solo alimenta el diagnóstico
  });
}
