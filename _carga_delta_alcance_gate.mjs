/* === _carga_delta_alcance_gate.mjs · EL DELTA DECLARADO Y EL ALCANCE HEREDADO (owner 2026-08-14) ==============
 * EL DEFECTO, MEDIDO EN VIVO (corrida doble `_corrida_doble.json`, hilo H2 «el ejemplo soñado del owner»):
 *   t1 «¿Qué clientes venden mucho pero dejan poco margen?»            → ADI responde bien (Falabella, Lider,
 *                                                                        Jumbo, Sodimac).
 *   t2 «reduce en 2 puntos las acciones comerciales de esos clientes   → NINGÚN camino lo resolvió. El actual
 *       y dime si quedan sobre el benchmark»                             contestó «No tengo corrida exactamente
 *                                                                        esa hipótesis» y SUSTITUYÓ el escenario
 *                                                                        por otro (llevar la carga al target de
 *                                                                        3.5%), que no es lo que se pidió.
 *   Sustituir el escenario del usuario por otro parecido es peor que declinar: parece una respuesta.
 *
 * EL HUECO REAL: `simulateCarga` YA aceptaba `entityScope` (el alcance heredado llegaba bien), pero SOLO sabía un
 * escenario —carga → POLICY.targetCarga—, así que un «−2 puntos» no tenía forma de expresarse; y faltaba el
 * cierre que el usuario pidió: el margen resultante de cada cuenta contra el benchmark.
 *
 * LO QUE ESTE GATE FIJA, y ninguna parte depende del LLM:
 *   1 · el hilo de 2 turnos completo (PLAN mockeado): el alcance heredado llega a la tool como entityScope con
 *       las CUATRO cuentas del turno anterior — el cableado que ya existía, ahora con candado.
 *   2 · el delta se aplica a las 4 cuentas, y el margen resultante + el veredicto sobre/bajo benchmark salen
 *       cuenta por cuenta, con su brecha.
 *   3 · LA ARITMÉTICA CONTRA EL DATO CRUDO, no contra la creencia: bajar la carga Xpp sube el margen EXACTAMENTE
 *       Xpp, recomputado desde venta/costo/rebates en las 13 filas del libro de margen.
 *   4 · el sello de proyección (la respuesta nunca narra el supuesto como hecho).
 *   5 · EL MODO DE SIEMPRE INTACTO: sin `delta_pp`, la tool devuelve exactamente lo que devolvía (el escenario
 *       target, con sus mismas cifras) — es el que corre en producción.
 *   6 · EL NEGATIVO: un delta que el usuario NO declaró jamás se ejecuta (ni inventado, ni con otra magnitud,
 *       ni con el signo al revés del verbo que usó).
 *
 * @inyeccion-simulada — este gate le pasa a `answerViaOracle` sus DOS pasadas (PLAN y NARRAR) como funciones
 * locales mockeadas en este mismo archivo. No importa el gateway ni un adapter, no importa nada de `src/ui/` y no
 * contiene una salida cruda: cumple las cuatro condiciones del escape declarado en scripts/gates-offline.mjs.
 * NO carga `.env` a propósito — no lo necesita (motor puro + mocks) y así no puede gastar ni por accidente.
 */
import { answerViaOracle } from "./src/adi/oracle/answerViaOracle.js";
import { TOOLS } from "./src/adi/oracle/toolRegistry.js";
import { composeSpecSimulateCarga } from "./src/adi/specRetrieval.js";
import { guardC } from "./src/adi/oracle/guardC.js";
import { initTenant } from "./src/data/tenantStore.js";
import { TENANT_DEMO } from "./src/data/tenants/demo.js";
import { clientesMargen, clientesVentas } from "./src/data/demoData.js";

let pass = 0, fail = 0;
const ok = (cond, label) => { console.log(`  ${cond ? "✓" : "✗"} ${label}`); if (cond) pass++; else fail++; };
const section = (t) => console.log(`\n── ${t} ──`);

initTenant(TENANT_DEMO);

const Q1 = "¿Qué clientes venden mucho pero dejan poco margen?";
const Q2 = "reduce en 2 puntos las acciones comerciales de esos clientes y dime si quedan sobre el benchmark";
const CUATRO = ["Falabella", "Lider", "Jumbo", "Sodimac"];
// huella legible de una boleta (label=value por fig): si el modo target cambiara UNA cifra o UNA etiqueta, el
// diff dice exactamente cuál — más útil que un hash y más duro que chequear un par de campos sueltos.
const huella = (boleta) => boleta.map((f) => `${f.label}=${f.value}`).join(" | ");

// ── arnés: corre el hilo de 2 turnos con PLAN mockeado y captura los args REALES que llegaron a la tool ────────
const _origSimCarga = TOOLS.simulateCarga;
async function correrHilo(q2, argsDelPlan, { narrar } = {}) {
  const vistos = [];
  TOOLS.simulateCarga = (a) => { vistos.push(JSON.parse(JSON.stringify(a || {}))); return _origSimCarga(a); };
  try {
    const t1 = await answerViaOracle({
      text: Q1, history: [], mem: {}, scenario: "actual",
      callPlan: async () => ({ intent: "answer", mode: "default",
        calls: [{ tool: "marginRead", args: { dimension: "cliente", focus: "alto_volumen_bajo_margen" } }] }),
      callNarrate: async () => "Falabella, Lider, Jumbo y Sodimac venden mucho y dejan poco margen.",
    });
    const t2 = await answerViaOracle({
      text: q2, history: [{ role: "user", content: Q1 }, { role: "assistant", content: t1.r.text }],
      mem: t1.mem, scenario: "actual",
      callPlan: async () => ({ intent: "answer", mode: "default", calls: [{ tool: "simulateCarga", args: argsDelPlan }] }),
      callNarrate: narrar || (async () => "Bajo tu supuesto, ninguna de las cuatro cruza el benchmark."),
    });
    return { t1, t2, vistos, coerciones: (t2.r.retryTrace || {}).coerciones || [] };
  } finally { TOOLS.simulateCarga = _origSimCarga; }
}

// ══ 1 · EL HILO DE 2 TURNOS: EL ALCANCE HEREDADO LLEGA A LA TOOL ════════════════════════════════════════════
section("1 · el hilo de 2 turnos — «esos clientes» llega a la tool como entityScope");
const H = await correrHilo(Q2, { delta_pp: -2 });
const scope1 = H.t1.mem && H.t1.mem.conversationScope && H.t1.mem.conversationScope.current;
ok(scope1 && scope1.dimension === "cliente" && CUATRO.every((c) => scope1.entities.includes(c)) && scope1.entities.length === 4,
  `t1: el alcance del turno queda con las 4 cuentas — obtuvo ${JSON.stringify(scope1 && scope1.entities)}`);
ok(H.vistos.length === 1, `t2: la tool corrió UNA vez (filtrado, nunca fan-out) — obtuvo ${H.vistos.length}`);
const args2 = H.vistos[0] || {};
ok(args2.entityScope && Array.isArray(args2.entityScope.entities) && args2.entityScope.entities.length === 4
  && CUATRO.every((c) => args2.entityScope.entities.includes(c)),
  `t2: «esos clientes» llega como entityScope con las 4 del turno anterior — obtuvo ${JSON.stringify(args2.entityScope)}`);
ok(args2.delta_pp === -2, `t2: el delta declarado por el usuario llega intacto a la tool — obtuvo ${JSON.stringify(args2.delta_pp)}`);
ok(!H.coerciones.some((c) => /delta-carga/.test(c)), `t2: el delta legítimo NO se despoja — coerciones: ${JSON.stringify(H.coerciones)}`);

// ══ 2 · EL DELTA SOBRE LAS 4 CUENTAS + EL CIERRE CONTRA EL BENCHMARK ════════════════════════════════════════
section("2 · el delta se aplica a las 4 cuentas y el cierre contra el benchmark sale cuenta por cuenta");
const R = TOOLS.simulateCarga({ scenario: "actual", entityScope: { entities: CUATRO }, delta_pp: -2 });
ok(R.coverage.supported, `la tool responde el escenario pedido (no declina) — ${JSON.stringify(R.coverage)}`);
const proy = (R.facts && R.facts.proyeccionCarga) || [];
ok(proy.length === 4 && CUATRO.every((c) => proy.some((p) => p.entidad === c)),
  `la proyección trae las 4 cuentas del alcance, ni una más — obtuvo ${JSON.stringify(proy.map((p) => p.entidad))}`);
// la matriz EXACTA del ejemplo canónico de la constitución (§ «Simulación heredando alcance»)
const ESPERADO = {
  Falabella: { cargaActual: 4.5, cargaSupuesta: 2.5, margenActual: 22,   margenSupuesto: 24,   brechaPp: 6.1, sobre: false },
  Lider:     { cargaActual: 4.2, cargaSupuesta: 2.2, margenActual: 21.5, margenSupuesto: 23.5, brechaPp: 6.6, sobre: false },
  Jumbo:     { cargaActual: 3.8, cargaSupuesta: 1.8, margenActual: 24,   margenSupuesto: 26,   brechaPp: 4.1, sobre: false },
  Sodimac:   { cargaActual: 5.4, cargaSupuesta: 3.4, margenActual: 23.5, margenSupuesto: 25.5, brechaPp: 4.6, sobre: false },
};
for (const [nombre, e] of Object.entries(ESPERADO)) {
  const p = proy.find((x) => x.entidad === nombre) || {};
  ok(p.cargaActual === e.cargaActual && p.cargaSupuesta === e.cargaSupuesta && p.efectivoPp === 2
    && p.margenActual === e.margenActual && p.margenSupuesto === e.margenSupuesto
    && p.benchmark === 30.1 && p.sobreBenchmark === e.sobre && p.brechaPp === e.brechaPp,
    `${nombre}: carga ${e.cargaActual}% → ${e.cargaSupuesta}% · margen ${e.margenActual}% + 2.0pp = ${e.margenSupuesto}% · ${e.sobre ? "sobre" : "bajo"} el benchmark 30.1% por ${e.brechaPp}pp — obtuvo ${JSON.stringify(p)}`);
}
const labels = R.boleta.map((f) => f.label);
ok(CUATRO.every((c) => labels.includes(`${c} · Margen supuesto`) && labels.includes(`${c} · Brecha contra el benchmark`)),
  `la boleta autoriza el margen resultante y la brecha de CADA cuenta — obtuvo ${JSON.stringify(labels)}`);
const figMargenFal = R.boleta.find((f) => f.label === "Falabella · Margen supuesto");
ok(figMargenFal && figMargenFal.value === "24.0%" && figMargenFal.raw === 24 && figMargenFal.unit === "pct",
  `la cifra del margen resultante viaja formateada como el resto del motor («24.0%») — obtuvo ${JSON.stringify(figMargenFal && figMargenFal.value)}`);
// EL ORDEN DE LA BOLETA ES POR CONCEPTO, NO POR CUENTA — y eso NO es estética: la tabla determinística (la que
// sirve una respuesta `results_only`) corta en 12 filas. Agrupada por cuenta, Jumbo y Sodimac —que el usuario
// NOMBRÓ— no llegaban a pantalla. Este candado fija que las 12 primeras filas traen la respuesta de LAS CUATRO.
{
  const doce = labels.slice(0, 12);
  ok(CUATRO.every((c) => doce.includes(`${c} · Margen supuesto`) && doce.includes(`${c} · Brecha contra el benchmark`)),
    `las 12 primeras figs traen el margen resultante y la brecha de las 4 cuentas — obtuvo ${JSON.stringify(doce)}`);
}
const sim = (R.facts && R.facts.simulate) || {};
ok(sim.action === "carga_delta" && sim.deltaPp === -2 && sim.unidad === "pp" && sim.declaradoPor === "usuario"
  && sim.noCruzanBenchmark.length === 4 && sim.cruzanBenchmark.length === 0,
  `el veredicto agregado queda sellado en la evidencia — obtuvo ${JSON.stringify(sim)}`);
// EL CONTRASTE CON EL DEFECTO MEDIDO: el escenario del target daba bajas DESPAREJAS (1.0 / 0.7 / 0.3 / 1.9 pp).
// Si esto volviera a moverse hacia el target, esta línea lo caza.
ok(proy.every((p) => p.efectivoPp === 2),
  `todas bajan los MISMOS 2 puntos que pidió el usuario (el escenario del target bajaba 1.0/0.7/0.3/1.9) — obtuvo ${JSON.stringify(proy.map((p) => p.efectivoPp))}`);

// ══ 3 · LA ARITMÉTICA CONTRA EL DATO CRUDO ══════════════════════════════════════════════════════════════════
section("3 · carga → margen: 1:1 EXACTO, recomputado desde venta/costo/rebates (no asumido)");
{
  let exactas = 0, revisadas = 0, contribOk = 0;
  const D = 2;
  for (const m of clientesMargen) {
    if (typeof m.venta !== "number" || typeof m.costo !== "number" || typeof m.rebates !== "number") continue;
    revisadas++;
    if (Math.abs((m.venta - m.costo - m.rebates) - m.contribucion) < 1e-9) contribOk++;
    const nuevoRebate = m.rebates - (D / 100) * m.venta;
    const nuevoMargen = +(((m.venta - m.costo - nuevoRebate) / m.venta) * 100).toFixed(6);
    if (Math.abs(nuevoMargen - (m.margen + D)) < 1e-9) exactas++;
  }
  ok(revisadas === 13 && contribOk === 13, `contribución = venta − costo − rebates en las 13 filas — ${contribOk}/${revisadas}`);
  ok(exactas === revisadas && revisadas > 0,
    `bajar la carga 2pp sube el margen EXACTAMENTE 2pp en las ${revisadas} filas (recomputado desde los campos crudos) — ${exactas}/${revisadas}`);
  // LA CUENTA QUE NO SE HACE, y por qué: el $ liberado corre sobre la venta OFICIAL (clientesVentas.actual, el
  // mismo multiplicador del detector de carga desde siempre) y el efecto en puntos sobre la venta del LIBRO DE
  // MARGEN. Dividir uno por el otro daría 2.101pp donde el dato sostiene 2.000pp — una aproximación presentada
  // como resultado. Este chequeo fija que las dos bases siguen separadas y que el motor eligió la exacta.
  const fal = clientesMargen.find((m) => m.nombre === "Falabella");
  const falV = clientesVentas.find((v) => v.nombre === "Falabella");
  const pFal = proy.find((p) => p.entidad === "Falabella");
  ok(pFal.usd === Math.round((2 / 100) * falV.actual * 1000),
    `el $ del movimiento sale de la venta oficial ($${falV.actual}K), como el modo target — obtuvo ${pFal.usd}`);
  ok(Math.abs((pFal.usd / 1000 / fal.venta) * 100 - 2.101) < 0.01 && pFal.margenSupuesto === 24,
    `el margen NO se deriva dividiendo ese $ por la venta del libro de margen (daría 2.101pp): se afirma 2.0pp exactos — margen ${pFal.margenSupuesto}%`);
}

// ══ 4 · EL SELLO DE PROYECCIÓN ═════════════════════════════════════════════════════════════════════════════
section("4 · el sello de proyección: el supuesto nunca se narra como hecho");
{
  const opener = composeSpecSimulateCarga({ scenario: "actual", entityScope: { entities: CUATRO }, deltaPp: -2 }).opener;
  ok(/resultado estimado bajo tu supuesto —una proyección, no un dato observado/i.test(opener),
    "el opener declara que es proyección estimada, no dato observado");
  // y esa marca es la que el chequeo de graduación del muro busca: el texto determinístico del modo delta pasa
  // SIN aviso. (El modo target de siempre sí lo levanta —«Es una proyección sobre el dato real» no trae ninguna
  // de las marcas que `_ASSUMPTION` reconoce—; es preexistente y queda declarado, no se toca acá.)
  ok(!(guardC(opener, { ledger: { figs: R.boleta }, results: [], trace: { calls: [{ tool: "simulateCarga", args: { delta_pp: -2 } }] }, question: Q2 }).advisories || []).some((a) => a.kind === "graduacion"),
    "el opener del modo delta pasa el chequeo de graduación del muro sin aviso");
  ok(/puntos porcentuales/i.test(opener) && /Interpreto ese movimiento/i.test(opener),
    "el opener DECLARA la interpretación elegida (la regla del 2% de la constitución)");
  ok(/no como un recorte relativo del 2% \(que dejaría esa carga en 4\.41%\)/i.test(opener),
    "y muestra la lectura descartada calculada (4.5% × 0.98 = 4.41%) — la otra mitad de la regla del 2%");
  ok(R.boleta.some((f) => f.label === "Lectura relativa descartada · Falabella" && f.value === "4.41%"),
    "esa lectura descartada viaja AUTORIZADA en la boleta (el notario puede verificarla, el narrador citarla)");
  // el chequeo de graduación de guardC ve la tool `simulateCarga` en el trace y exige marca de supuesto. Es un
  // AVISO, no un bloqueo (política mandatory-lite del muro) — se verifica como tal, que es lo que el muro promete.
  const traceSim = { calls: [{ tool: "simulateCarga", args: { delta_pp: -2 } }] };
  const gMal = guardC("Falabella queda en 24.0% de margen y Lider en 23.5%.", { ledger: { figs: R.boleta }, results: [], trace: traceSim, question: Q2 });
  ok((gMal.advisories || []).some((a) => a.kind === "graduacion" && /simulación narrada como hecho/i.test(a.detail || "")),
    `una narración SIN marca de supuesto queda marcada por graduación — ${JSON.stringify((gMal.advisories || []).map((a) => a.kind))}`);
  const gBien = guardC("Si reduces 2 puntos, Falabella quedaría en 24.0% de margen: sigue bajo el benchmark de 30.1%.", { ledger: { figs: R.boleta }, results: [], trace: traceSim, question: Q2 });
  ok(gBien.ok && !(gBien.advisories || []).some((a) => a.kind === "graduacion"),
    `la MISMA cuenta con la marca de supuesto pasa limpia — ${JSON.stringify([(gBien.violations || []).map((v) => v.kind), (gBien.advisories || []).map((a) => a.kind)])}`);
  // la cuenta a la vista, en la forma exacta que la constitución fija como caso canónico
  const gCuenta = guardC("Bajo tu supuesto, Falabella pasaría de 22.0% + 2.0pp = 24.0% — sigue bajo el benchmark de 30.1%.", { ledger: { figs: R.boleta }, results: [], trace: traceSim, question: Q2 });
  ok(gCuenta.ok, `«22.0% + 2.0pp = 24.0%» —la cuenta a la vista del caso canónico— pasa el muro — ${JSON.stringify((gCuenta.violations || []).map((v) => v.kind))}`);
}

// ══ 5 · EL MODO DE SIEMPRE, INTACTO ════════════════════════════════════════════════════════════════════════
section("5 · el modo «al target» de siempre (el que corre en producción) queda byte-idéntico");
{
  const T = TOOLS.simulateCarga({ scenario: "actual" });
  ok(T.coverage.supported && T.boleta.some((f) => f.label === "Target de carga" && f.value === "3.5%"),
    "sin delta_pp la tool sigue simulando «carga → target», con su fig de target");
  ok(T.facts.simulate && T.facts.simulate.action === "carga_target" && T.facts.simulate.target === 3.5,
    `el sello de la simulación sigue siendo carga_target — obtuvo ${JSON.stringify(T.facts.simulate)}`);
  const rec = T.boleta.find((f) => f.label === "Recuperable · total");
  ok(rec && rec.raw === 655663 && rec.mandatory === true,
    `el recuperable del eje entero no se movió ($655.663 en «actual») — obtuvo ${JSON.stringify(rec && rec.raw)}`);
  ok(!T.facts.proyeccionCarga, "el modo target no emite el detalle del modo delta (nada nuevo se cuela en su forma)");
  // LA HUELLA COMPLETA de la boleta del modo target, congelada. Verificada byte-a-byte contra `HEAD` (2f4d83a)
  // sobre 24 combinaciones (4 escenarios × {sin args · filters.cliente · filters.marca · filters.familia ·
  // entityScope de 2 · entityScope de 4}): idénticas. Esta línea es el candado permanente de esa igualdad.
  const HUELLA_TARGET_ACTUAL = "Target de carga=3.5% | Recuperable · total=$656K | Falabella · Recuperable=$194K | Sodimac · Recuperable=$156K | Lider · Recuperable=$125K";
  ok(huella(T.boleta) === HUELLA_TARGET_ACTUAL,
    `la boleta ENTERA del modo target no se movió — obtuvo:\n      ${huella(T.boleta)}\n      esperaba:\n      ${HUELLA_TARGET_ACTUAL}`);
  ok(/llevar la carga comercial a tu target \(3\.5%\)/.test(composeSpecSimulateCarga({ scenario: "actual" }).opener),
    "y el texto del modo target sigue diciendo lo mismo");
  // acotado por entityScope, el modo target sigue dando el subtotal de las cuentas del alcance (Etapa 2)
  const TS = TOOLS.simulateCarga({ scenario: "actual", entityScope: { entities: ["Falabella", "Sodimac"] } });
  ok(TS.coverage.supported && TS.boleta.find((f) => f.label === "Recuperable · total").raw === 349997,
    `el modo target con entityScope sigue acotando al subtotal de las 2 cuentas ($349.997) — obtuvo ${JSON.stringify(TS.boleta.find((f) => f.label === "Recuperable · total").raw)}`);
  // y en los otros dos escenarios, por si alguien tocara la aritmética del detector
  for (const [esc, esperado] of [["tension", 1332104], ["crisis", 2259527], ["bonanza", 654953]]) {
    const TE = TOOLS.simulateCarga({ scenario: esc });
    const r = TE.boleta.find((f) => f.label === "Recuperable · total");
    ok(r && r.raw === esperado, `escenario ${esc}: recuperable total sin cambio (${esperado}) — obtuvo ${JSON.stringify(r && r.raw)}`);
  }
}

// ══ 6 · EL NEGATIVO: UN DELTA NO DECLARADO JAMÁS SE EJECUTA ════════════════════════════════════════════════
section("6 · el negativo — un delta que el usuario NO declaró nunca corre");
{
  const N1 = await correrHilo("¿y si bajamos las acciones comerciales de esos clientes?", { delta_pp: -2 });
  ok(N1.vistos[0] && N1.vistos[0].delta_pp === undefined && N1.coerciones.some((c) => /delta-carga-no-declarado/.test(c)),
    `PLAN inventa −2 sin que el turno diga ninguna magnitud → se despoja y cae al modo target — args ${JSON.stringify(N1.vistos[0])} · ${JSON.stringify(N1.coerciones)}`);
  const N2 = await correrHilo("reduce en 2 puntos las acciones comerciales de esos clientes", { delta_pp: -5 });
  ok(N2.vistos[0] && N2.vistos[0].delta_pp === undefined && N2.coerciones.some((c) => /delta-carga-no-declarado\(-5\)/.test(c)),
    `el usuario dijo 2 y PLAN mandó 5 → la magnitud ajena se despoja — args ${JSON.stringify(N2.vistos[0])}`);
  const N3 = await correrHilo("reduce en 2 puntos las acciones comerciales de esos clientes", { delta_pp: 2 });
  ok(N3.vistos[0] && N3.vistos[0].delta_pp === -2 && N3.coerciones.some((c) => /delta-carga-signo/.test(c)),
    `«reduce» con delta positivo → se corrige el SIGNO por el verbo del usuario, no se invierte el escenario — args ${JSON.stringify(N3.vistos[0])}`);
  const N4 = await correrHilo("reduce en dos puntos las acciones comerciales de esos clientes", { delta_pp: -2 });
  ok(N4.vistos[0] && N4.vistos[0].delta_pp === -2 && !N4.coerciones.some((c) => /delta-carga/.test(c)),
    `«dos puntos» escrito en letras también respalda el delta — args ${JSON.stringify(N4.vistos[0])}`);
  const N5 = await correrHilo("de esos clientes, ¿cuáles tienen 2 rebates activos?", { delta_pp: -2 });
  ok(N5.vistos[0] && N5.vistos[0].delta_pp === undefined,
    `un «2» que NO es una magnitud de movimiento (sin puntos/pp/%) no autoriza nada — args ${JSON.stringify(N5.vistos[0])}`);
  // fuera de rango: DECLINA con motivo, nunca recorta en silencio ni cae al target
  const F = TOOLS.simulateCarga({ scenario: "actual", delta_pp: -40 });
  ok(!F.coverage.supported && /fuera del rango operable/.test(F.coverage.reason),
    `un delta absurdo declina declarando el motivo — ${JSON.stringify(F.coverage)}`);
  const Z = TOOLS.simulateCarga({ scenario: "actual", delta_pp: 0 });
  ok(!Z.coverage.supported && /0 puntos/.test(Z.coverage.reason), `un delta de 0 declina en vez de correr el target — ${JSON.stringify(Z.coverage)}`);
}

// ══ 7 · EL PISO EN CERO, DECLARADO ═════════════════════════════════════════════════════════════════════════
section("7 · una carga no puede quedar negativa — el tope se aplica y se DECLARA");
{
  const P = composeSpecSimulateCarga({ scenario: "actual", deltaPp: -3 });
  const ml = P.evidence.proyeccionCarga.find((x) => x.entidad === "Mercado Libre");
  ok(ml && ml.cargaActual === 1.8 && ml.cargaSupuesta === 0 && ml.efectivoPp === 1.8 && ml.margenSupuesto === 30.8,
    `Mercado Libre (carga 1.8%) topa en 0: la baja efectiva es 1.8pp, no 3 — obtuvo ${JSON.stringify(ml)}`);
  ok(P.evidence.simulate.topados.includes("Mercado Libre"), "la cuenta topada queda sellada en la evidencia");
  ok(/la baja efectiva es de 1\.8pp, no 3/.test(P.opener) && /no puede quedar negativa/.test(P.opener),
    "y el opener lo DICE — el tope nunca se aplica en silencio");
  // y el universo del modo delta NO es el del detector: incluye cuentas bajo el target y bajo el piso de $50K
  ok(P.evidence.proyeccionCarga.some((x) => x.cargaActual < 3.5),
    "el modo delta alcanza cuentas BAJO el target (el detector las excluye) — el alcance del usuario no se recorta");
  // el detector también corta por materialidad ($50K por cuenta): con un delta chico las cuentas chicas caen
  // bajo ese piso y el modo delta las sigue trayendo — si no, la cuenta que el usuario nombró desaparecería.
  const P1 = composeSpecSimulateCarga({ scenario: "actual", deltaPp: -1 });
  const chico = P1.evidence.proyeccionCarga.find((x) => x.usd < 50000);
  ok(!!chico, `y alcanza cuentas bajo el piso de materialidad de $50K del detector — ej. ${chico && chico.entidad} $${chico && chico.usd}`);
  const D1 = composeSpecSimulateCarga({ scenario: "actual", entityScope: { entities: ["Unimarc"] }, deltaPp: -1 });
  ok(D1 && !D1.unsupported && D1.evidence.proyeccionCarga.length === 1 && D1.evidence.proyeccionCarga[0].entidad === "Unimarc",
    `una sola cuenta chica y con carga BAJO el target (Unimarc 3.0%) igual responde — obtuvo ${JSON.stringify(D1 && D1.evidence && D1.evidence.proyeccionCarga)}`);
}

console.log(`\n${fail === 0 ? "✅" : "❌"} _carga_delta_alcance_gate · ${pass} PASS · ${fail} FAIL`);
process.exit(fail === 0 ? 0 : 1);
