/* === _amnistia_con_insumos_gate.mjs · LA AMNISTÍA DE CÁLCULO EXIGE INSUMOS DICHOS (owner 2026-09-04) ========
 *
 * EL DEFECTO — la garantía nº 1 del owner («cero cifras inventadas») apagada de facto en los turnos ricos:
 * sobre la boleta real del turno del porqué (95 figs), «unos $780K» —0 coincidencias entre las 318 cifras del
 * dato— PASABA guardC. La raíz, aislada con matriz de densidad por el supervisor: la amnistía de cálculo
 * (_isCalc) explota combinatoriamente — con 60+ cifras en el pool y la tolerancia de redondeo, casi cualquier
 * monto de 2-3 dígitos coincide con ALGUNA resta o suma entre ~4.500 pares. Con figs≤40 vetaba; con 60+
 * amnistiaba. El datoProyectado no anulaba nada por sí mismo: solo agrandaba el pool.
 *
 * LA CIRUGÍA (dirección del supervisor, opción 1 — «una cuenta legítima tiene INSUMOS dichos; una coincidencia
 * aritmética ciega entre 4.500 pares no es una cuenta»): el par (a,b) solo amnistía si sus insumos están
 * DICHOS — como MONTOS en el propio texto («$100.0M −3%: $97.0M») o como DUEÑOS nombrados (ambas figs de
 * entidades mencionadas: «LG-DRYER8KG y LG-AIR9000 juntos representan $195K»). El nivel 2 (_isCalc2) no
 * necesitó la condición: su scope a entidades mencionadas YA es la frontera de dueños dichos.
 *
 * CALIBRADO ANTES DE TOCAR, como manda el método: con la amnistía ciega apagada del todo (el experimento
 * máximo), CERO borradores legítimos de los 230 gates cayeron — solo los 2 gates que prueban la amnistía
 * misma. La cirugía es MÁS laxa que ese apagón, así que ninguna legítima nueva puede caer; y los dos gates de
 * la amnistía (_oracle_isCalc_scope · _oracle_isCalc2) pasan enteros con sus positivos y negativos.
 *
 * OFFLINE · determinístico · cero red. `node --import ./scripts/offline-guard.mjs _amnistia_con_insumos_gate.mjs` */
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { initTenant } from "./src/data/tenantStore.js";
import { TENANT_DEMO } from "./src/data/tenants/demo.js";
import { cajaDelAgente } from "./src/adi/agente/herramientasAgente.js";
import { TOOLS } from "./src/adi/oracle/toolRegistry.js";
import { runPlan } from "./src/adi/oracle/toolRunner.js";
import { guardC } from "./src/adi/oracle/guardC.js";
import { cifrasDelDato } from "./src/adi/oracle/datoProyectado.js";
import { PLAYBOOKS, pasosDe } from "./src/adi/agente/playbooks/registro.js";

let PASS = 0, FAIL = 0;
const ok = (c, m, extra = "") => { if (c) { PASS++; console.log("  ✓ " + m); } else { FAIL++; console.log("  ✗ " + m + (extra ? "\n      " + extra : "")); } };
const H = (t) => console.log("\n" + t);

initTenant(TENANT_DEMO);
const margenEnRiesgo = PLAYBOOKS.find((p) => p.nombre === "margen-en-riesgo");
const Q = "por que estamos perdiendo margen?";
const RP = runPlan({ intent: "answer", calls: pasosDe(margenEnRiesgo, Q).map((p) => ({ tool: p.tool, args: p.args })) },
  { scenario: "bonanza", maxCalls: 8, preguntaUsuario: Q, registry: cajaDelAgente(TOOLS) });
const FIGS = (RP.ledger && RP.ledger.figs) || [];
const j = (texto, figs, conDp) => guardC(texto, { ledger: { figs }, results: RP.results || [], question: Q,
  ...(conDp ? { datoProyectado: cifrasDelDato("bonanza") } : {}), contentScope: "full", tablePolicy: "auto" });

/* ═══ 1 · LA MATRIZ DE DENSIDAD · los inventados caen en TODA densidad, en K y en M ═════════════════════════ */
H("1 · la matriz de densidad: el monto inventado cae con 5, 60 y 95 figs, y con el dato proyectado encima");
{
  ok(FIGS.length >= 90, `la boleta del turno del porqué sigue siendo la RICA (${FIGS.length} figs) — el terreno donde la regla moría`);
  const INVENTADOS = ["$780K", "$999K", "$4.2M", "$123K"];   // dos escalas: K y M
  for (const n of [5, 60, FIGS.length]) {
    const caen = INVENTADOS.every((m) => !j(`Mi lectura: la fuga real anda por unos ${m} al año.`, FIGS.slice(0, n), false).ok);
    ok(caen, `★ con figs=${n}: los 4 montos inventados caen (antes, con 60+, pasaban 3 de 4)`);
  }
  ok(INVENTADOS.every((m) => !j(`Mi lectura: la fuga real anda por unos ${m} al año.`, FIGS, true).ok),
    "★ …y con el datoProyectado encima (el pool máximo, +318 cifras) caen IGUAL — la densidad ya no compra amnistía");
}

/* ═══ 2 · LAS CUENTAS LEGÍTIMAS · las dos formas de mostrar los insumos siguen pasando ══════════════════════ */
H("2 · la cuenta mostrada pasa: montos dichos, o dueños nombrados");
{
  ok(j("Del subtotal de $4.9M, Falabella explica $1.6M — los otros $3.3M se reparten en el resto.", FIGS, true).ok,
    "★ MONTOS DICHOS: la resta con sus dos operandos en el texto ($4.9M − $1.6M = $3.3M) sigue amnistiada");
  ok(j("La carga de Falabella es 4.5% y tu nivel de referencia 3.5%: 1.0 puntos de exceso.", FIGS, true).ok,
    "★ …y la resta de porcentajes con sus términos dichos también");
  /* dueños nombrados sin montos individuales: el caso BUENO del gate del scope, que la primera versión de la
   * cirugía mataba — se prueba en su propio gate (_oracle_isCalc_scope) y acá se declara la dependencia */
  const scopeGate = fs.readFileSync(path.join(process.cwd(), "_oracle_isCalc_scope_gate.mjs"), "utf8");
  ok(/juntos representan/.test(scopeGate),
    "★ DUEÑOS NOMBRADOS: «A y B juntos representan $X» vive probado en _oracle_isCalc_scope_gate (su caso BUENO)");
}

/* ═══ 3 · CARNADA · la amnistía ciega re-suelta deja pasar el invento ═══════════════════════════════════════
 * El monto-lotería NO se congela ($780K dependía de qué pares existieran en la boleta de ese día): se
 * CONSTRUYE del ledger vivo — la suma de dos figs ESTRUCTURALES (sin dueño nombrado en el texto) que ninguna
 * oración menciona. Eso ES la lotería por definición, con cualquier composición futura de la boleta. */
H("3 · carnada: si alguien quita la condición de insumos, el monto-lotería vuelve a pasar — y este gate lo ve");
{
  /* «estructural» = el prefijo del label NO es una entidad del tenant («Contribución no capturada · subtotal»,
   * «Medida · …»): esas figs entran SIEMPRE al pool de la amnistía porque no tienen dueño que las restrinja —
   * exactamente la población que armaba la lotería. */
  const { axisEntityNames } = await import("./src/adi/oracle/entityIndex.js");
  const entidades = new Set();
  for (const eje of ["cliente", "sku", "marca", "familia", "bodega", "canal"]) { try { for (const n of axisEntityNames(eje)) entidades.add(n.toLowerCase()); } catch { /* sin eje */ } }
  const money = FIGS.filter((f) => f.unit === "money" && Number.isFinite(f.raw)
    && !entidades.has(String(f.label).split("·")[0].trim().toLowerCase()));
  ok(money.length >= 2, `hay figs estructurales money para armar la lotería (${money.length})`);
  /* se BUSCA un par cuya suma/resta caiga hoy: un monto de la lotería puede coincidir por azar con una cifra
   * real del dato (le pasó a $9.9M en la primera versión de esta carnada) y entonces otra vía legítima lo
   * autoriza — ese no sirve de carnada. El que cae hoy y revive con la mutación es la prueba limpia. */
  let TRAMPA = null, fmt = null, parLabel = null;
  busca: for (let i = 0; i < money.length; i++) for (let k = 0; k < money.length; k++) {
    if (i === k) continue;
    for (const val of [money[i].raw + money[k].raw, money[i].raw - money[k].raw]) {
      if (!(val > 50000)) continue;
      const f = val >= 1e6 ? `$${(val / 1e6).toFixed(1)}M` : `$${Math.round(val / 1e3)}K`;
      const t = `Mi lectura: la fuga real anda por unos ${f} al año.`;
      if (!j(t, FIGS, true).ok) { TRAMPA = t; fmt = f; parLabel = `${money[i].label} ± ${money[k].label}`; break busca; }
    }
  }
  ok(!!TRAMPA, `★ HOY: ${fmt} (= ${parLabel}, jamás dichos) CAE — la coincidencia sin insumos no es una cuenta`);
  const abs = path.join(process.cwd(), "src", "adi", "oracle", "guardC.js");
  const txt = fs.readFileSync(abs, "utf8").replace(/\r\n/g, "\n");
  const m = txt.replace(
    /const _ok = \(a, b\) => !presentes\n\s+\|\| \(_presenteEnTexto\(a\.raw, unit, presentes, tol\) && _presenteEnTexto\(b\.raw, unit, presentes, tol\)\)\n\s+\|\| \(a\.conDueno && b\.conDueno\);/,
    "const _ok = () => true;   // CARNADA: la amnistía ciega, re-suelta");
  if (m === txt) { ok(false, "carnada: no encontró la condición a mutar"); }
  else {
    const destino = abs.replace(/\.js$/, `.carnada${process.pid}.js`);
    fs.writeFileSync(destino, m);
    try {
      const Mut = await import(pathToFileURL(destino).href);
      const v = Mut.guardC(TRAMPA, { ledger: { figs: FIGS }, results: RP.results || [], question: Q,
        datoProyectado: cifrasDelDato("bonanza"), contentScope: "full", tablePolicy: "auto" });
      ok(v.ok === true,
        `★ carnada «amnistía ciega re-suelta» → ${fmt} VUELVE a pasar: la condición de insumos es lo único que lo frena`);
    } catch (e) { ok(false, "carnada: la copia mutada no carga", e.message); }
    finally { try { fs.unlinkSync(destino); } catch { /* */ } }
  }
}

/* ═══ 3b · EL CONTEXTO REAL · el bucle entero con un cerebro MENTIROSO (refuerzo del supervisor) ═════════════
 * La matriz de arriba juzga guardC DIRECTO — y una sonda con el contexto mal armado mide otra cosa (le pasó
 * al propio supervisor: sin `entidadesDelTenant`, el pool se abría entero y los inventos "pasaban" en su
 * arnés). Este caso es inmune a ese artefacto: corre `answerViaAgente` de punta a punta con un cerebro que
 * MIENTE, en cuatro familias — incluidas dos cuyas boletas traen figs SIN dueño de entidad, que entran al
 * pool aunque haya scoping. Si un refactor futuro deja de pasar el contexto en un invocador, la matriz
 * directa no lo ve; el mentiroso sí. La garantía se prueba donde el owner la vive: en pantalla. */
H("3b · el cerebro mentiroso por el bucle entero: ninguna mentira llega a pantalla");
{
  const { answerViaAgente } = await import("./src/adi/agente/bucleAgente.js");
  const TURNOS = [
    ["por que estamos perdiendo margen?", "Mi lectura: la fuga real anda por unos $780K al año, y ahí pondría el foco."],
    ["cuanto me cuesta la carga de Falabella?", "La carga comercial de Falabella te está costando unos $780K al año."],
    ["como viene la venta mes a mes?", "La venta viene estable, con un pico de $780K en el mejor mes."],
    ["cuanto vendi este año?", "Este año vendiste $780K por encima del plan."],
  ];
  for (const [q, mentira] of TURNOS) {
    const mentiroso = async () => ({ tipo: "texto", texto: mentira });
    const r = await answerViaAgente({ text: q, history: [], mem: {}, scenario: "bonanza", callAgente: mentiroso });
    ok(!/780/.test(String(r.r.text || "")),
      `★ «${q.slice(0, 38)}» → el $780K inventado NO llega a pantalla (${r.r.agente.estado})`,
      String(r.r.text || "").slice(0, 90));
  }
}

/* ═══ 4 · LAS CAPAS SE QUEDAN · monto-fuera-de-boleta no se retiró aunque el muro sanara ════════════════════ */
H("4 · capas, no reemplazos: la regla del playbook sigue viva debajo del muro sano");
{
  const pb = fs.readFileSync(path.join(process.cwd(), "src", "adi", "agente", "playbooks", "margenEnRiesgo.js"), "utf8");
  ok(/monto-fuera-de-boleta/.test(pb),
    "★ `monto-fuera-de-boleta` sigue en la lista notarial del playbook — la capa local no se retira porque la global sane");
}

console.log(`\n── _amnistia_con_insumos_gate: ${PASS} PASS · ${FAIL} FAIL (de ${PASS + FAIL}) ──`);
process.exit(FAIL ? 1 : 0);
