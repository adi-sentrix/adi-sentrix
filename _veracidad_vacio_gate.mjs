/* === _veracidad_vacio_gate.mjs · «LA TOOL VOLVIÓ VACÍA» ≠ «EL DATO NO EXISTE» ==================================
 * (owner 2026-08-11 · defecto D7 "ADI declina datos que acaba de mostrar" · frente E)
 *
 * LO QUE CERTIFICA — una REGLA, no un turno:
 *   Ninguna declinación de una tool puede afirmar que faltan registros de una entidad que el ÍNDICE DEL EJE
 *   reconoce. Si el resultado volvió vacío por CÓMO se pidió (cardinalidad fuera de contrato, filtro por un eje
 *   que esa lectura no abre, alcance que no intersecta), la razón declarada tiene que decir eso — "no pude
 *   traerlo así" — y no "no existe". Declinar es legítimo; mentir sobre la razón no.
 *
 * EL DEFECTO QUE CIERRA, medido en la corrida de certificación: el turno 1 imprime la tabla de Falabella, Lider,
 * Jumbo y Sodimac con margen y venta; el turno 2 pide compararlas y ADI contesta que FALTAN SUS REGISTROS EN EL
 * EJE CLIENTE. Los cuatro están en el dato. `compareEntities` compara de a pares, el plan le pasó las cuatro en
 * `args`, el composer devolvió null por cardinalidad, y ese null se tradujo al único texto disponible: uno que
 * afirma ausencia. El narrador es fiel a lo que recibe — el defecto es que las dos afirmaciones se colapsaron.
 *
 * DÓNDE SE VERIFICA: en `runPlan` (toolRunner.js), el ÚNICO punto por el que pasan las veinte tools con los args
 * definitivos — no en `plan.scope`, que es un campo opcional del planificador que el camino normal no llena. La
 * regla vive en `diagnosticarVacio` (toolContracts.js). Este gate ejercita el ejecutor VIVO, el mismo que
 * `answerViaOracle` invoca; no un andamio.
 *
 * LAS DOS CARAS, y por qué la segunda pesa más. La PRIMERA versión de este fix reprobó una auditoría adversarial
 * por reescribir DE MÁS: cualquier declinación cuyos args nombraran una entidad real salía diciendo «el vacío es
 * de cómo se pidió, no del dato» — incluso ante límites VERDADEROS (rotación/DOH no derivables por cliente, sin
 * puente cliente↔SKU, bodegas sin lectura comercial), y encima invitando a reintentar contra ellos. Un guard que
 * niega un límite real hace más daño que el defecto que vino a arreglar. Por eso este gate mide las DOS caras:
 * que el caso malo se corrija Y que lo correcto —incluidas las declinaciones correctas— siga saliendo igual.
 *
 * SECCIONES · 1-2 el caso medido y su contrario · 3-4 la GENERALIDAD (los seis ejes, la salida ofrecida medida,
 * la otra forma de vaciado) · 5 la ausencia real · 6 LOS LÍMITES DECLARADOS DEL DATO, intactos · 7 la atribución
 * de eje verificada contra el índice · 8 ocho lecturas que hoy responden y no se bloquean · 9-10 la cobertura ya
 * discriminada y la declinación sin entidades · 11 el barrido de clase (las dos caras) · 12 el canon del eje.
 *
 * MUTACIONES QUE LO PONEN EN ROJO (las cuatro, corridas y contadas):
 *   (1) desconectar el cableado — comentar `res = _veraz(name, args, res)` en toolRunner.js:116 → 21 FAIL.
 *   (2) devolverle al final de `diagnosticarVacio` la reescritura sobre-amplia de la primera versión (en lugar de
 *       `return null`) → 27 FAIL: caen los trece límites declarados de la sección 6 y el invariante (II).
 *   (3) hacer que `_ubicar` confíe en el eje PEDIDO en vez del índice → 6 FAIL, entre ellos «4 atribuciones de eje
 *       inventadas» de la sección 7.
 *   (4) quitar la exigencia de que la entidad PUEDA explicar el vacío (`_entidadExplicaElVacio`) → 10 FAIL: los
 *       cinco límites de la segunda familia (pnlRead, tensionRead, simulateGeneral, simulateCosto, queryMetric).
 * Es decir: el gate falla si el fix se revierte Y si el fix se vuelve un blanqueo. Las dos direcciones.
 *
 * 100% OFFLINE · módulos puros, sin red, sin proveedor, sin créditos.
 *   node --import ./scripts/offline-guard.mjs _veracidad_vacio_gate.mjs
 * =========================================================================================================== */
import { runPlan } from "./src/adi/oracle/toolRunner.js";
import { TOOLS } from "./src/adi/oracle/toolRegistry.js";
import { TOOL_CONTRACTS, MOTIVO_TIPO, diagnosticarVacio, entidadesNombradas, ejeCanonico } from "./src/adi/oracle/toolContracts.js";
import { resolveCanonical, axisCollisions } from "./src/adi/oracle/entityIndex.js";
import { initTenant } from "./src/data/tenantStore.js";
import { TENANT_DEMO } from "./src/data/tenants/demo.js";

// vía 1 (2026-08-20): el dataset se DECLARA acá. Antes se heredaba del import por defecto de tenantStore,
// que ya no existe: el store arranca en la forma vacía y el dato entra por initTenant. Ver tenantEmpty.js.
initTenant(TENANT_DEMO);

const SC = "base";
let PASS = 0, FAIL = 0;
const ok = (cond, msg, extra) => {
  if (cond) { PASS++; console.log(`  ✓ ${msg}`); }
  else { FAIL++; console.log(`  ✗ ${msg}${extra === undefined ? "" : `\n      → ${typeof extra === "string" ? extra : JSON.stringify(extra)}`}`); }
};
const h = (t) => console.log(`\n${"─".repeat(110)}\n${t}\n${"─".repeat(110)}`);

// correr UNA call por el ejecutor vivo, exactamente como la corre answerViaOracle.
const correr = (tool, args) => runPlan({ intent: "answer", calls: [{ tool, args }] }, { scenario: SC });
const cov = (tool, args) => correr(tool, args).results[0].coverage;

// LA AFIRMACIÓN PROHIBIDA — no se busca una frase concreta (eso sería atar el gate a un texto), se busca la CLASE
// de afirmación: cualquier forma de "no existe / no hay / faltan / no tengo" aplicada al DATO. Un motivo veraz
// sobre un vacío-por-pedido puede decir "no tengo registro" SOLO de las entidades que de verdad no están, y esas
// se declaran aparte en `entidadesSinRegistro`.
const AFIRMA_AUSENCIA = /(?:no (?:hay|tengo|existen?|encuentro)|que existan en el dato|faltan?\b|no (?:está|están|figura)\b)/i;

const CUATRO = ["Falabella", "Lider", "Jumbo", "Sodimac"];   // las que E2.t1 IMPRIMIÓ con margen y venta

/* ═══ 0 · PREMISA — el índice del eje reconoce lo que los casos van a nombrar ══════════════════════════════════ */
h("0 · PREMISA · el dato existe (si esto falla, todo lo demás mide otra cosa)");
for (const e of CUATRO) ok(!!resolveCanonical("cliente", e), `'${e}' está en el eje cliente`);
ok(!!resolveCanonical("bodega", "Santiago"), "'Santiago' está en el eje bodega");
ok(!!resolveCanonical("sku", "SAM-TV55"), "'SAM-TV55' está en el eje sku");
ok(!resolveCanonical("cliente", "NoExisteSA") && !axisCollisions("NoExisteSA").length, "'NoExisteSA' no está en ningún eje (control de ausencia real)");

/* ═══ 1 · EL CASO MEDIDO (E2.t2) · cardinalidad POR ENCIMA, entidades en args, sin plan.scope ═════════════════ */
h("1 · MEDIDO · compareEntities con cuatro cuentas que el turno anterior imprimió");
{
  /* ── RE-CERTIFICADO (owner 2026-08-12, punto 6) ─────────────────────────────────────────────────────────────
   * ESTA SECCIÓN AFIRMABA QUE EL TURNO SEGUÍA DECLINANDO, y que lo único corregido era la RAZÓN. Era la conducta
   * correcta bajo el encargo anterior —dejar de MENTIR sobre la causa del vacío— y el owner la superseded:
   * «no puede convertir una limitación interna de la tool en "faltan datos"; el motor debe descomponer
   * estructuralmente la comparación o usar la herramienta multi-entidad correspondiente».
   * EL MOTIVO ES MEDIBLE, no doctrinal: la boleta de E2.t2 llegó con CERO figs. Una razón honesta sin datos deja
   * al usuario igual de sin respuesta.
   * LAS SIETE ASERCIONES VIEJAS QUEDARON OBSOLETAS POR ESA DECISIÓN, no por estorbar: las siete leían
   * `coverage.reason`, y en el camino resuelto ya no hay vacío que explicar. Su intención —que nadie afirme
   * ausencia sobre entidades que están— se conserva y se afirma MEJOR: ahora se exige que las cuatro tengan
   * cifras, que es la prueba fuerte de que estaban.
   * LO QUE NO SE TOCA: las secciones 2 en adelante siguen certificando el diagnóstico honesto donde SÍ aplica
   * —cardinalidad por debajo, entidad inexistente, eje incompatible, vacío real—, y esas no cambian. */
  const r1 = correr("compareEntities", { dimension: "cliente", entities: CUATRO });
  const figs1 = (r1.ledger && r1.ledger.figs) || [];
  const cub1 = CUATRO.filter((e) => figs1.some((f) => String(f.label || "").startsWith(e)));
  ok(figs1.length > 0, `el turno YA NO llega con la boleta vacía (${figs1.length} figs) — era el defecto de fondo de E2.t2`);
  ok(cub1.length === 4, `las CUATRO cuentas quedan resueltas con cifras propias (${cub1.join(", ")})`);
  ok(r1.results[0].tool === "gridTable", "se descompuso a la lectura multi-entidad del MISMO eje", r1.results[0].tool);
  const cb1 = (r1.results[0].coverage || {}).cobertura;
  ok(!!cb1 && cb1.pedidas === 4, `la cobertura declara cuántas se PIDIERON (${cb1 && cb1.pedidas})`);
  ok(!!cb1 && Array.isArray(cb1.resueltas) && cb1.resueltas.length === 4, `…cuántas se RESOLVIERON (${cb1 && cb1.resueltas.length})`);
  ok(!!cb1 && Array.isArray(cb1.faltantes) && cb1.faltantes.length === 0, "…y cuáles FALTARON: ninguna, porque las cuatro están", JSON.stringify(cb1 && cb1.faltantes));
  // LA CARA QUE IMPIDE CAMBIAR UN DEFECTO POR OTRO: una entidad que de verdad no existe sigue declarada faltante.
  // La descomposición sirve a las que están; no inventa las que no.
  const r1b = correr("compareEntities", { dimension: "cliente", entities: [...CUATRO.slice(0, 3), "NoExisteSA"] });
  const cb1b = (r1b.results[0].coverage || {}).cobertura;
  ok(!!cb1b && cb1b.faltantes.includes("NoExisteSA") && cb1b.resueltas.length === 3,
    "con una entidad inexistente: 3 resueltas y «NoExisteSA» declarada FALTANTE", JSON.stringify(cb1b && { r: cb1b.resueltas, f: cb1b.faltantes }));
  // y con DOS entidades no se descompone nada: `compareEntities` es la lectura correcta y sigue corriendo ella.
  const r1c = correr("compareEntities", { dimension: "cliente", entities: CUATRO.slice(0, 2) });
  ok(r1c.results[0].tool === "compareEntities", "con DOS entidades no hay descomposición: la tool de pares es la correcta", r1c.results[0].tool);
}

/* ═══ 2 · GENERALIDAD · MISMA TOOL, CARDINALIDAD POR DEBAJO (E1.t1 — caso distinto del medido) ════════════════ */
h("2 · GENERAL · compareEntities con UNA sola cuenta (el pedido falla por lo contrario que en el caso medido)");
{
  const c = cov("compareEntities", { dimension: "cliente", entities: ["Falabella"] });
  ok(c.supported === false, "declina");
  ok(c.motivoTipo === MOTIVO_TIPO.CONTRATO, "motivoTipo === 'contrato'", c.motivoTipo);
  ok(!AFIRMA_AUSENCIA.test(c.reason), "la razón NO afirma que falte Falabella", c.reason);
  ok(c.reason.includes("Falabella"), "la razón nombra a Falabella", c.reason);
}

/* ═══ 3 · GENERALIDAD · LA MISMA CLASE EN LOS SEIS EJES DEL ÍNDICE, Y LA SALIDA QUE EL TEXTO PROMETE ══════════ */
// Dos cosas a la vez, y la segunda es la que hace honesto al texto: (a) la corrección no es del eje `cliente` —
// vale para los seis ejes que el índice conoce; (b) la salida que el mensaje OFRECE («decime con cuáles seguimos
// y las comparo») está MEDIDA: con exactamente dos entidades reales la tool responde. Prometer un reintento que
// no se probó sería la misma mentira, sólo que en futuro.
h("3 · GENERAL · la cardinalidad, en los SEIS ejes — y la salida ofrecida, medida");
{
  const PARES = {
    sku: ["SAM-TV55", "LG-WASH11KG"], cliente: ["Falabella", "Lider"], marca: ["Samsung", "LG"],
    familia: ["Electrodomésticos", "Línea Blanca"], bodega: ["Santiago", "Valparaíso"], canal: ["Retail", "E-commerce"],
  };
  for (const [eje, dos] of Object.entries(PARES)) {
    const cuatro = cov("compareEntities", { dimension: eje, entities: [...dos, ...dos.map((x) => x)] });
    ok(cuatro.motivoTipo === MOTIVO_TIPO.CONTRATO && !AFIRMA_AUSENCIA.test(cuatro.reason),
      `${eje}: fuera de cupo → 'contrato' sin afirmar ausencia`, cuatro.reason);
    ok(new RegExp(`'${eje}'`).test(cuatro.reason), `${eje}: la razón atribuye las entidades a SU eje`, cuatro.reason);
    ok(cov("compareEntities", { dimension: eje, entities: dos }).supported === true,
      `${eje}: y la salida que el texto ofrece FUNCIONA (dos entidades → responde)`);
  }
}

/* ═══ 4 · GENERALIDAD · OTRA FORMA DE VACIADO: la entidad existe, pero en OTRO eje que el del pedido ══════════ */
h("4 · GENERAL · el índice desmiente el EJE del pedido (cardinalidad correcta, eje equivocado)");
{
  const c = cov("compareEntities", { dimension: "cliente", entities: ["SAM-TV55", "LG-WASH11KG"] });
  ok(c.supported === false, "declina");
  ok(c.motivoTipo === MOTIVO_TIPO.EJE, "motivoTipo === 'eje_del_pedido' (no es ausencia: es el eje)", c.motivoTipo);
  ok(/'sku'/.test(c.reason) && /'cliente'/.test(c.reason), "la razón dice en qué eje SÍ están y en cuál se los pidió", c.reason);
  ok(!AFIRMA_AUSENCIA.test(c.reason), "la razón NO afirma que esos SKU no existan", c.reason);
  // NO PROMETE lo que no midió: que vivan en otro eje no implica que ESTA tool sirva ese eje.
  ok(!/y (?:lo|los|las) traigo\b/i.test(c.reason), "no promete traerlo — sólo se ofrece a intentarlo", c.reason);
  // y con UNA sola bien ubicada, el eje del pedido NO está desmentido → no se opina.
  const mixto = cov("compareEntities", { dimension: "cliente", entities: ["Falabella", "SAM-TV55"] });
  if (mixto.supported === false) ok(mixto.motivoTipo !== MOTIVO_TIPO.EJE, "con una entidad bien ubicada no se declara 'eje_del_pedido'", mixto.motivoTipo);
  else ok(true, "el caso mixto responde (no aplica)");
}

/* ═══ 5 · CONTROL NEGATIVO · LA AUSENCIA REAL SIGUE DICIÉNDOSE COMO AUSENCIA ═════════════════════════════════ */
h("5 · CONTROL · dos nombres que no existen en ningún eje — acá la razón original es VERDAD y no se toca");
{
  const crudo = TOOLS.compareEntities({ dimension: "cliente", entities: ["NoExisteSA", "TampocoSA"], scenario: SC });
  const c = cov("compareEntities", { dimension: "cliente", entities: ["NoExisteSA", "TampocoSA"] });
  ok(c.motivoTipo === MOTIVO_TIPO.SIN_DATO, "motivoTipo === 'sin_dato'", c.motivoTipo);
  ok(c.reason === crudo.coverage.reason, "la razón queda EXACTAMENTE como la emitió la tool (esto no es un blanqueo de declinaciones)", { antes: crudo.coverage.reason, despues: c.reason });
  ok(AFIRMA_AUSENCIA.test(c.reason), "y sigue afirmando ausencia, que acá es lo correcto", c.reason);
  ok(c.reasonTool === undefined, "no se reescribió nada: no hay reasonTool");
}

/* ═══ 6 · EL CONTROL QUE MANDA · LOS LÍMITES DECLARADOS DEL DATO NO SE BLANQUEAN ═════════════════════════════ */
// (auditoría adversarial 2026-08-11 sobre la PRIMERA versión de este fix, que REPROBÓ acá)
//
// La primera versión reescribía la razón de CUALQUIER declinación cuyos args nombraran una entidad real. Eso
// convirtió límites VERDADEROS del dato en «el vacío es de cómo se pidió, no del dato. Decime por dónde lo busco
// y lo traigo» — negando el límite y encima invitando a reintentar contra él. Peor que el defecto original: el
// defecto rompía un turno; esto le enseña al usuario a insistir contra una pared.
//
// Los límites que se prueban acá son los DECLARADOS del sistema: rotación y DOH son declaradas por SKU/bodega y
// no derivables por cliente · no hay tabla puente cliente↔SKU (ni marca↔SKU) · las bodegas no tienen venta ni
// presupuesto propios · el P&L no está declarado para este negocio. Ante cualquiera de ellos ADI TIENE que seguir
// declinando, CON SU RAZÓN, sin `motivoTipo` de reescritura y sin ofrecer un reintento.
//
// DOS FAMILIAS, la segunda hallada auditando la corrección de la primera: (i) la entidad entra por un FILTRO que
// la tool sí aplica pero el vacío viene de otra parte; (ii) la entidad entra como `entity` a una tool que por
// contrato NO se define por una entidad (`entidad:"none"`) y ni la mira. La (ii) es más traicionera porque el
// pedido *parece* nombrar un sujeto.
//
// EL CRITERIO NO ES UN TEXTO LITERAL: se corre la MISMA call por la tool cruda y por el ejecutor, y se exige
// igualdad byte a byte. Si el texto del límite cambia mañana, el gate sigue midiendo lo mismo.
h("6 · CONTROL · un límite real del dato sale con SU razón — intacta, y sin invitación a reintentar");
{
  const LIMITES = [
    ["queryMetric", { metric: "rotacion", dimension: "cliente", filters: { marca: "Samsung" } }, "rotación no es derivable por cliente"],
    ["queryMetric", { metric: "doh", dimension: "cliente", filters: { marca: "Samsung" } }, "DOH no es derivable por cliente"],
    ["queryMetric", { metric: "capital", dimension: "cliente", filters: { marca: "Samsung" } }, "capital no es derivable por cliente"],
    ["queryMetric", { metric: "carga", dimension: "bodega", filters: { marca: "Samsung" } }, "carga no se abre por bodega"],
    ["inventoryStatus", { filters: { cliente: "Falabella" } }, "no hay puente cliente↔SKU para inventario"],
    ["marginRead", { dimension: "cliente", filters: { bodega: "Santiago" } }, "la bodega no tiene lectura comercial"],
    ["salesRead", { dimension: "cliente", filters: { bodega: "Santiago" } }, "ídem venta"],
    ["contributionRead", { dimension: "cliente", filters: { bodega: "Santiago" } }, "ídem contribución"],
    // LA SEGUNDA FAMILIA (hallada auditando la corrección de la primera): tools cuyo contrato declara
    // `entidad:"none"` — no se definen por una entidad puntual y muchas ni miran `entity`. Un `entity` suelto en
    // los args no explica su vacío, y hacerlo explicarlo tapaba CUATRO límites verdaderos con una causa inventada.
    ["pnlRead", { dimension: "cliente", entity: "SAM-TV55" }, "el P&L no está declarado y pnlRead no toma entidad"],
    ["tensionRead", { dimension: "cliente", entity: "SAM-TV55" }, "no hay puente cliente↔SKU para cruzar las dos métricas"],
    ["simulateGeneral", { dimension: "cliente", entity: "SAM-TV55" }, "faltan las variables del supuesto"],
    ["simulateCosto", { dimension: "cliente", entity: "SAM-TV55" }, "no hay SKU bajo benchmark"],
    ["queryMetric", { dimension: "cliente", entity: "SAM-TV55" }, "queryMetric rankea un eje, no lee una entidad"],
  ];
  const OFRECE_REINTENTO = /decime por d[oó]nde|lo traigo|volv[eé] a ped|prob[aá] de nuevo/i;
  let probados = 0;
  for (const [tool, args, porque] of LIMITES) {
    const crudo = TOOLS[tool]({ ...args, scenario: SC });
    if (!crudo || !crudo.coverage || crudo.coverage.supported !== false) { ok(true, `${tool} · ${porque}: no declina en este escenario (no aplica)`); continue; }
    if (crudo.coverage.cross === true || crudo.coverage.eje || crudo.coverage.relacion) { ok(true, `${tool} · ${porque}: ya discriminada por el motor (fuera de alcance)`); continue; }
    probados++;
    const c = cov(tool, args);
    ok(c.reason === crudo.coverage.reason, `${tool} · ${porque}: la razón NO se reescribe`, { antes: crudo.coverage.reason, despues: c.reason });
    ok(c.motivoTipo !== MOTIVO_TIPO.CONTRATO && c.motivoTipo !== MOTIVO_TIPO.EJE, `${tool} · ${porque}: no se le atribuye una causa de pedido`, c.motivoTipo);
    ok(!OFRECE_REINTENTO.test(String(c.reason || "")), `${tool} · ${porque}: no invita a reintentar contra el límite`, c.reason);
  }
  ok(probados >= 5, `se probaron ${probados} límites declarados reales (si esto cae, el control dejó de medir)`, { probados });
}

/* ═══ 7 · CONTROL · LA ATRIBUCIÓN DE EJE ES POR ENTIDAD, NUNCA `args.dimension` ══════════════════════════════ */
// La primera versión tomaba el eje de `args.dimension` —el eje por el que se RANKEA— y se lo aplicaba a una
// entidad que había entrado por una KEY DE FILTRO. Medido: «Samsung está en el eje 'cliente'». Samsung es marca.
// Un bloque escrito para que el motor no mienta sobre el dato estaba inventando una atribución de eje.
h("7 · CONTROL · ninguna razón puede ubicar una entidad en un eje donde el índice no la tiene");
{
  const ARGS = [
    ["compareEntities", { dimension: "cliente", entities: ["Samsung", "LG"] }],
    ["compareEntities", { dimension: "marca", entities: ["Falabella", "Lider", "Jumbo", "Sodimac"] }],
    ["queryMetric", { metric: "rotacion", dimension: "cliente", filters: { marca: "Samsung" } }],
    ["queryMetric", { metric: "ventas", dimension: "sku", filters: { bodega: "Santiago" } }],
    ["marginRead", { dimension: "sku", filters: { marca: "Samsung" } }],
    ["inventoryStatus", { filters: { familia: "Línea Blanca" } }],
  ];
  let revisadas = 0, mal = 0;
  for (const [tool, args] of ARGS) {
    let c; try { c = cov(tool, args); } catch { continue; }
    const txt = String((c && c.reason) || "");
    if (!txt) continue;
    for (const { nombre } of entidadesNombradas(args)) {
      // el patrón "<nombre> … está/están en el eje 'X'" que ESTOS textos producen — se verifica contra el índice.
      const m = new RegExp(`${nombre.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\\\$&")}[^.;]*?en el eje '([^']+)'`).exec(txt);
      if (!m) continue;
      revisadas++;
      for (const eje of m[1].split("/")) {
        if (!resolveCanonical(eje, nombre)) { mal++; console.log(`      · ${tool}: la razón ubica '${nombre}' en '${eje}' y el índice NO lo tiene ahí\n        "${txt}"`); }
      }
    }
  }
  ok(revisadas >= 2, `hubo atribuciones de eje que revisar: ${revisadas}`, { revisadas });
  ok(mal === 0, `las ${revisadas} atribuciones de eje coinciden con el índice (${mal} inventadas)`, { mal });
}

/* ═══ 8 · CONTROL NEGATIVO · EL CAMINO FELIZ NO SE TOCA (las respuestas correctas siguen saliendo) ═══════════ */
h("8 · CONTROL · seis lecturas que HOY responden bien — ninguna se bloquea ni se le agrega nada");
{
  const BUENAS = [
    ["compareEntities", { dimension: "cliente", entities: ["Falabella", "Lider"] }],
    ["compareEntities", { dimension: "sku", entities: ["SAM-TV55", "LG-WASH11KG"] }],
    ["compareEntities", { dimension: "bodega", entities: ["Santiago", "Valparaíso"] }],
    ["entityRecord", { dimension: "cliente", entity: "Falabella" }],
    ["entityProfile", { dimension: "marca", entity: "Samsung" }],
    ["inventoryStatus", {}],
    ["queryMetric", { metric: "ventas", dimension: "cliente" }],
    ["trend", { dimension: "sku", entity: "SAM-TV55" }],
  ];
  for (const [tool, args] of BUENAS) {
    const r = correr(tool, args).results[0];
    ok(r.coverage.supported === true, `${tool} ${JSON.stringify(args)} → supported === true (no se bloquea)`, r.coverage);
    ok(r.coverage.motivoTipo === undefined && r.coverage.reasonTool === undefined, `${tool}: la cobertura sale limpia (nada estampado sobre un éxito)`);
    ok(Array.isArray(r.boleta) && r.boleta.length > 0, `${tool}: la boleta llega entera (el turno conserva sus cifras)`, r.boleta && r.boleta.length);
  }
}

/* ═══ 9 · CONTROL NEGATIVO · UNA COBERTURA QUE YA DISCRIMINA NO SE PISA ══════════════════════════════════════ */
h("9 · CONTROL · el guard de cruce imposible ya dice la verdad sobre su causa — se respeta tal cual");
{
  const crudo = TOOLS.queryMetric({ metric: "ventas", dimension: "marca", filters: { cliente: "Falabella" }, scenario: SC });
  ok(crudo.coverage.cross === true, "premisa: queryMetric marca su declinación con coverage.cross");
  const c = cov("queryMetric", { metric: "ventas", dimension: "marca", filters: { cliente: "Falabella" } });
  ok(c.motivoTipo === undefined, "no se le estampa motivoTipo: ya trae su propio discriminador");
  ok(c.reason === crudo.coverage.reason, "la razón queda intacta", { antes: crudo.coverage.reason, despues: c.reason });
}

/* ═══ 10 · CONTROL NEGATIVO · SIN ENTIDADES NOMBRADAS NO HAY VEREDICTO ═══════════════════════════════════════ */
h("10 · CONTROL · una declinación que no nombra ninguna entidad no se puede reconciliar contra el índice");
{
  const c = cov("defineConcept", { concept: "concepto-que-no-existe-en-el-glosario" });
  ok(c.supported === false, "premisa: declina");
  ok(c.motivoTipo === undefined, "queda intacta — no se inventa un veredicto sin evidencia", c.motivoTipo);
  ok(diagnosticarVacio("compareEntities", {}, { supported: false, reason: "x" }) === null, "diagnosticarVacio devuelve null con args vacíos");
  const covOriginal = { supported: false, reason: "necesito dos entidades del eje 'cliente' que existan en el dato" };
  const copia = JSON.parse(JSON.stringify(covOriginal));
  diagnosticarVacio("compareEntities", { dimension: "cliente", entities: CUATRO }, covOriginal);
  ok(JSON.stringify(covOriginal) === JSON.stringify(copia), "diagnosticarVacio es PURA: no muta la cobertura que recibe");
}

/* ═══ 11 · EL INVARIANTE DE CLASE · barrido generado por CONTRATO, no escrito a mano ═════════════════════════ */
// No es una lista de casos: se recorre TOOL_CONTRACTS y, para cada tool que acepta una entidad puntual, se arma
// el pedido en cada forma de argumento que ese contrato admite, con entidades REALES del dato. Sobre TODO lo que
// vuelva vacío se afirman las DOS CARAS de la regla, que son las dos formas de romperla:
//
//   (I)  NADA SE INVENTA · una razón REESCRITA no puede afirmar ausencia de lo que el índice reconoce, tiene que
//        nombrar lo que sí está, y cada eje que atribuya tiene que existir EN EL ÍNDICE para esa entidad.
//   (II) NADA SE PIERDE  · una razón NO reescrita tiene que salir byte a byte como la emitió la tool. Ésta es la
//        cara que la primera versión de este fix reprobó: reescribía de más y se llevaba puestos límites reales.
//        Sin este contador, "cero mentiras" se consigue trivialmente reescribiéndolo todo.
h("11 · INVARIANTE · lo reescrito es verificable contra el índice · lo no reescrito llega intacto");
{
  const casos = [];
  for (const [tool, contract] of Object.entries(TOOL_CONTRACTS)) {
    if (!contract.aceptaEntidadPuntual) continue;
    casos.push([tool, { dimension: "cliente", entity: "Falabella" }]);
    casos.push([tool, { dimension: "cliente", entities: CUATRO }]);
    casos.push([tool, { dimension: "cliente", entityScope: { entities: ["Falabella", "Lider"] } }]);
    casos.push([tool, { dimension: "cliente", filters: { bodega: "Santiago" } }]);
    casos.push([tool, { dimension: "sku", filters: { cliente: "Falabella" } }]);
    casos.push([tool, { dimension: "cliente", entities: ["SAM-TV55", "LG-WASH11KG"] }]);
    casos.push([tool, { dimension: "marca", entities: ["Samsung", "LG", "Philips"] }]);
    casos.push([tool, { metric: "rotacion", dimension: "cliente", filters: { marca: "Samsung" } }]);
    casos.push([tool, { dimension: "sku", entities: ["Falabella", "Lider"] }]);
    casos.push([tool, { dimension: "marca", entities: ["Falabella", "Lider", "Jumbo"] }]);
    casos.push([tool, { dimension: "bodega", entities: ["Samsung", "LG"] }]);
    casos.push([tool, { dimension: "familia", entities: ["SAM-TV55", "LG-WASH11KG"] }]);
  }
  let vacios = 0, reescritas = 0, intactas = 0, mienten = 0, perdidas = 0;
  for (const [tool, args] of casos) {
    let c, crudo;
    try { c = cov(tool, args); crudo = TOOLS[tool]({ ...args, scenario: SC }); } catch { continue; }
    if (!c || c.supported !== false) continue;
    if (c.cross === true || c.eje || c.relacion) continue;          // ya discriminada por el motor — fuera del invariante
    if (!crudo || !crudo.coverage || crudo.coverage.supported !== false) continue;
    vacios++;
    const txt = String(c.reason || "");
    if (c.motivoTipo === MOTIVO_TIPO.CONTRATO || c.motivoTipo === MOTIVO_TIPO.EJE) {
      reescritas++;
      const nombradas = entidadesNombradas(args);
      const presentes = nombradas.filter((e) => (e.eje && resolveCanonical(e.eje, e.nombre)) || axisCollisions(e.nombre).length);
      const nombra = presentes.some((e) => txt.includes(e.nombre));
      // cada "<entidad> … en el eje 'X'" que el texto afirme tiene que sostenerse contra el índice
      let ejeInventado = false;
      for (const { nombre } of nombradas) {
        const m = new RegExp(`${nombre.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}[^.;]*?en el eje '([^']+)'`).exec(txt);
        if (m) for (const eje of m[1].split("/")) if (!resolveCanonical(eje, nombre)) ejeInventado = true;
      }
      if (AFIRMA_AUSENCIA.test(txt) || !nombra || ejeInventado) {
        mienten++;
        if (mienten <= 5) console.log(`      · REESCRITA MAL · ${tool} ${JSON.stringify(args)}\n        motivoTipo=${c.motivoTipo} · reason="${txt}"`);
      }
    } else {
      intactas++;
      if (txt !== String(crudo.coverage.reason || "")) {
        perdidas++;
        if (perdidas <= 5) console.log(`      · RAZÓN PISADA SIN DECLARAR CAUSA · ${tool} ${JSON.stringify(args)}\n        antes="${crudo.coverage.reason}"\n        ahora="${txt}"`);
      }
    }
  }
  ok(vacios >= 20, `el barrido produjo material suficiente: ${vacios} declinaciones`, { vacios });
  ok(reescritas >= 6, `y suficientes REESCRITAS para que el invariante (I) tenga qué medir: ${reescritas}`, { reescritas });
  ok(mienten === 0, `(I) ninguna de las ${reescritas} reescritas afirma ausencia ni inventa un eje`, { mienten });
  ok(intactas >= 6, `y suficientes NO reescritas para que el invariante (II) tenga qué medir: ${intactas}`, { intactas });
  ok(perdidas === 0, `(II) las ${intactas} no reescritas salen byte a byte como las emitió la tool`, { perdidas });
}

/* ═══ 12 · EL CANON DEL EJE · el pedido llega en lenguaje natural y el índice se consulta igual ══════════════ */
h("12 · el eje del pedido se canoniza contra el vocabulario del propio índice (plural/mayúscula/acento)");
{
  ok(ejeCanonico("clientes") === "cliente" && ejeCanonico("SKU") === "sku" && ejeCanonico("Familias") === "familia", "'clientes'/'SKU'/'Familias' canonizan");
  ok(ejeCanonico("vendedor") === null, "'vendedor' no es un eje del índice → null (no se fuerza nada)");
  const c = cov("compareEntities", { dimension: "clientes", entities: CUATRO });
  ok(c.motivoTipo === MOTIVO_TIPO.CONTRATO && !AFIRMA_AUSENCIA.test(c.reason), "el mismo pedido con el eje en plural produce la misma razón veraz", c.reason);
}

console.log(`\n${"═".repeat(110)}\n${PASS} PASS · ${FAIL} FAIL\n${"═".repeat(110)}`);
process.exit(FAIL ? 1 : 0);
