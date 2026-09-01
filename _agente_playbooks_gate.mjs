/* === _agente_playbooks_gate.mjs · EL PLAYBOOK: LA EVIDENCIA ANTES DE LA DECISIÓN (owner 2026-08-31) =========
 *
 * LA PALABRA DEL OWNER, textual: «El agente queda OFF hasta resolver esa última conducta: responder con toda la
 * evidencia disponible antes de rescatar o pedir aclaración. Quiero trabajar eso como criterio ESTRUCTURAL,
 * idealmente apoyado en playbooks, no con prompts genéricos de "sé menos cauteloso".»
 *
 * LO QUE ESTE CANDADO EXIGE:
 *   1 · EL REGISTRO · el patrón se cumple (cuandoAplica · pasos con su para-qué · obligatorias · entregable ·
 *       componer · listaNotarial) y el detector es ANGOSTO: aplica en su dominio y NO secuestra turnos ajenos.
 *   2 · LA ACEPTACIÓN (la prueba que decide si sirve) · con el MISMO cerebro inyectado, un turno DOCUMENTADO
 *       del expediente que rescataba ahora RESPONDE — y responde con la lectura completa, no con una línea.
 *   3 · LA OTRA MITAD · pedir aclaración teniendo la evidencia recibe multa del propio playbook, y si el
 *       cerebro insiste, el entregable determinístico responde igual.
 *   4 · NO SE AFLOJA NADA · guardC intacto (el entregable pasa el muro como cualquier texto), el contrato F3
 *       sigue vetando el cierre imperativo, y el cerebro que responde bien manda sobre el determinístico.
 *   5 · LA LISTA NOTARIAL DEL PLAYBOOK · sus cuatro promesas, cada una probada, calibrada contra el corpus de
 *       exámenes (cero falsos positivos sobre texto que YA salió a pantalla) y auto-consistente (no veta su
 *       propio entregable).
 *   6 · CARNADAS · cada garantía, probada ROJA mutando una copia del código vivo.
 *
 * OFFLINE · determinístico · cerebro = guion · CERO llamadas al modelo · la bandera ADI_AGENTE sigue APAGADA.
 * `node --import ./scripts/offline-guard.mjs _agente_playbooks_gate.mjs` */
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { initTenant } from "./src/data/tenantStore.js";
import { TENANT_DEMO } from "./src/data/tenants/demo.js";
import { plantillaEjemplo } from "./src/ingesta/plantilla/generarPlantilla.js";
import { ingestarPlantilla } from "./src/ingesta/plantilla/ingestarPlantilla.js";
import { answerViaAgente } from "./src/adi/agente/bucleAgente.js";
import { PLAYBOOKS, playbookPara, pasosDe, obligatoriasDe, promesasCumplidas, doctrinaDelPlaybook, vetosDelPlaybook } from "./src/adi/agente/playbooks/registro.js";
import { margenEnRiesgo, lecturaDeMargen } from "./src/adi/agente/playbooks/margenEnRiesgo.js";
import { runPlan } from "./src/adi/oracle/toolRunner.js";
import { TOOLS } from "./src/adi/oracle/toolRegistry.js";
import { cajaDelAgente, serieEntidad } from "./src/adi/agente/herramientasAgente.js";
import { guardC } from "./src/adi/oracle/guardC.js";                 // las carnadas de entidad×período juzgan el texto compuesto DIRECTO contra el muro
import { cifrasDelDato } from "./src/adi/oracle/datoProyectado.js";
import { axisEntityNames } from "./src/adi/oracle/entityIndex.js";

let pass = 0, fail = 0;
const ok = (cond, label, detalle) => {
  if (cond) { pass++; console.log(`  ✓ ${label}`); }
  else { fail++; console.log(`  ✗ ${label}`); if (detalle !== undefined) console.log(`      ${detalle}`); }
};
const H = (t) => console.log(`\n${t}`);
const MUDO = async () => ({ tipo: "texto", texto: "" });
/* la boleta que los pasos del playbook traen, para probar composer y lista notarial sin pasar por el bucle */
// `pasos` puede ser función de la pregunta (2026-09-01): se resuelve con `pasosDe`, como en el bucle
const boletaDelPlaybook = (pb, scenario = "bonanza", pregunta = "como viene mi margen") => {
  const rp = runPlan({ intent: "answer", calls: pasosDe(pb, pregunta).map((p) => ({ tool: p.tool, args: p.args })) },
    { scenario, maxCalls: 8, preguntaUsuario: pregunta, registry: cajaDelAgente(TOOLS) });
  return (rp.ledger && rp.ledger.figs) || [];
};

/* ═══ 1 · EL REGISTRO · el patrón, y un detector que no secuestra turnos ajenos ═══════════════════════════════ */
H("1 · el registro cumple su patrón — agregar el segundo playbook es agregar su archivo");
{
  ok(Array.isArray(PLAYBOOKS) && PLAYBOOKS.length >= 1, `el registro tiene playbooks (${PLAYBOOKS.length})`);
  for (const pb of PLAYBOOKS) {
    const campos = ["nombre", "cuandoAplica", "pasos", "obligatorias", "entregable", "componer", "listaNotarial"];
    const faltan = campos.filter((c) => pb[c] === undefined || pb[c] === null);
    ok(!faltan.length, `«${pb.nombre}» declara el patrón completo`, `faltan: ${faltan.join(", ")}`);
    /* `pasos` puede ser Array o FUNCIÓN de la pregunta (2026-09-01): se resuelve con `pasosDe`, el mismo
     * resolvedor que usa el bucle. Para un playbook de forma se prueba con cada una de sus preguntas de
     * muestra (`ejemplos`), así ningún eje queda sin verificar su herramienta. */
    const muestras = Array.isArray(pb.ejemplos) && pb.ejemplos.length ? pb.ejemplos : ["como viene mi margen?"];
    /* el playbook declara en qué pack ACTIVAN sus ejemplos (`tenantDeMuestra`): entidad-por-período no tiene
     * serie real en el demo y resolvería cero pasos ahí. Se carga ese pack para verificar el patrón y se
     * restaura el demo al salir — nunca dejar el proceso en un tenant distinto al que empezó. */
    if (pb.tenantDeMuestra === "plantilla") initTenant(ingestarPlantilla(Buffer.from(plantillaEjemplo()), { nombreArchivo: "v2.xlsx", fechaCarga: "2026-08-31" }).dataset);
    else initTenant(TENANT_DEMO);
    for (const q of muestras) {
      const pasos = pasosDe(pb, q);
      ok(pasos.length > 0 && pasos.every((p) => p.tool && p.args && typeof p.para === "string" && p.para.length > 10),
        `…y cada paso declara herramienta, args y PARA QUÉ (${pasos.length} pasos${muestras.length > 1 ? ` · «${q.slice(0, 28)}»` : ""})`);
      ok(pasos.every((p) => !!cajaDelAgente(TOOLS)[p.tool]), "…y todas sus herramientas existen en la caja del agente");
    }
  }
  initTenant(TENANT_DEMO);   // de vuelta al demo: los detectores de abajo se miden ahí
  const dentro = ["como viene mi margen?", "que clientes estan bajo el benchmark", "a quien reviso primero por margen",
    "cuanto tendria que mejorar cada cliente para llegar al benchmark", "dame el ranking de margen por cliente"];
  const fuera = ["cuanto me compro falabella el ultimo mes", "dame el inventario", "que productos dejan mas plata",
    "ponele que el margen sube 3%: cuanto seria", "simula que llevo la carga al target", "llamame jc"];
  ok(dentro.every((q) => playbookPara(q) === margenEnRiesgo), "el detector aplica en TODO su dominio",
    dentro.filter((q) => !playbookPara(q)).join(" | "));
  ok(fuera.every((q) => playbookPara(q) === null), "…y NO secuestra un solo turno ajeno (simulación incluida)",
    fuera.filter((q) => playbookPara(q)).join(" | "));
  ok(/margen-en-riesgo/.test(doctrinaDelPlaybook(margenEnRiesgo)) && /La evidencia ya está en la mano/.test(doctrinaDelPlaybook(margenEnRiesgo)),
    "la doctrina que viaja al cerebro declara el MÉTODO (no un ánimo)");
  ok(doctrinaDelPlaybook(margenEnRiesgo) === doctrinaDelPlaybook(margenEnRiesgo), "…y es byte-estable (prefijo cacheable)");
}

/* ═══ 1b · PLAYBOOK 2 · LECTURA POR EJE — pasos como FUNCIÓN de la pregunta (2026-09-01) ═════════════════════
 * Medido por el supervisor sobre las 28 preguntas de la certificación: 19 sin camino garantizado, agrupadas por
 * FORMA. Once son la misma pregunta con distinto eje. Con `pasos` estático hacían falta seis playbooks; con
 * `pasos(pregunta)` es uno. `cuandoAplica` sigue siendo léxico: la función elige la HERRAMIENTA según el eje que
 * el detector identificó, jamás según comprensión. */
H("1b · lectura por eje: un playbook, cinco ejes, la herramienta que sirve cada uno");
{
  initTenant(TENANT_DEMO);
  const pb = playbookPara("ranking por canal: mejores y peores");
  ok(pb && pb.nombre === "lectura-por-eje", "★ el registro tiene el playbook de forma y el detector lo encuentra");
  ok(typeof pb.pasos === "function" && typeof pb.obligatorias === "function", "★ `pasos` y `obligatorias` son funciones de la pregunta");
  // la herramienta cambia con el eje — y es la que de verdad sirve ese eje (medido con la sonda por eje)
  const herr = (q) => pasosDe(pb, q).map((p) => `${p.tool}${p.args.dimension ? ":" + p.args.dimension : ""}${p.args.metric ? "/" + p.args.metric : ""}${p.args.focus ? "#" + p.args.focus : ""}`).join("+");
  ok(herr("ranking por canal") === "queryMetric:canal/ventas", `canal → queryMetric ventas (${herr("ranking por canal")})`);
  ok(herr("qué marca deja más margen") === "marginRead:marca", `marca → marginRead (${herr("qué marca deja más margen")})`);
  ok(herr("margen por familia") === "marginRead:familia", `familia → marginRead (${herr("margen por familia")})`);
  ok(herr("capital por bodega") === "queryMetric:bodega/capital", `bodega → queryMetric capital — inventoryStatus NO toma dimension (${herr("capital por bodega")})`);
  ok(herr("qué SKU tienen capital frenado") === "inventoryStatus#frenado", `SKU frenado → inventoryStatus (${herr("qué SKU tienen capital frenado")})`);
  ok(pasosDe(pb, "como viene mi margen?").length === 0, "…y sin eje no resuelve ningún paso (esa pregunta es de margen-en-riesgo)");

  // ACEPTACIÓN por eje: el MISMO cerebro mudo, cinco preguntas del protocolo, cinco entregables
  const T = async (q) => answerViaAgente({ text: q, history: [], mem: {}, scenario: "bonanza", callAgente: MUDO });
  const rc = await T("ranking por canal: mejores y peores");
  ok(rc.r.agente.estado === "playbook" && /Retail: \$94\.4M/.test(rc.r.text) && /E-commerce: \$5\.5M/.test(rc.r.text),
    `★ canal → responde con el eje canal REAL del dato (${rc.r.agente.estado})`, rc.r.text.slice(0, 90));
  const rm = await T("qué marca deja más margen");
  ok(rm.r.agente.estado === "playbook" && /^Margen por marca, de mayor a menor:/m.test(rm.r.text) && rm.r.text.indexOf("Makita") < rm.r.text.indexOf("LG"),
    "★ marca → ordenada de mayor a menor (Makita 35.5% antes que LG 24.0%) — el motor solo pone `raw` en las destacadas", rm.r.text.slice(0, 100));
  ok(/Benchmark de margen: 30\.1%/.test(rm.r.text), "…y declara el benchmark, para que «deja más» tenga vara");
  const rf = await T("margen por familia");
  ok(rf.r.agente.estado === "playbook" && /Cuidado Personal: 26\.6%/.test(rf.r.text), `★ familia → responde (${rf.r.agente.estado})`);
  const rb = await T("capital por bodega");
  ok(rb.r.agente.estado === "playbook" && /Santiago: \$64K/.test(rb.r.text) && !/Ventas|venta/i.test(rb.r.text),
    "★ bodega → capital por bodega, SIN mezclar con venta (los dos universos)", rb.r.text.slice(0, 90));
  const rs = await T("qué SKU tienen capital frenado");
  ok(rs.r.agente.estado === "playbook" && /LG-DRYER8KG: \$14K/.test(rs.r.text) && !/Valparaíso|Antofagasta/.test(rs.r.text),
    "★ SKU frenado → solo SKU: las bodegas que la boleta trae al lado NO entran al ranking", rs.r.text.slice(0, 120));
  for (const r of [rc, rm, rf, rb, rs]) ok(r.r.agente.vetos.length === 0, `…y el entregable pasa el muro sin un veto (${r.r.agente.figs} figs)`);

  // el detector NO secuestra: ni la simulación, ni el período, ni el trato, ni la palabra suelta dentro de otra pregunta
  const fuera = ["simula que la marca LG sube 3%", "ponele que crezco 3% por canal", "cuanto me compro falabella el ultimo mes",
    "llamame jc", "como viene mi margen?", "por punto de venta, ¿quién queda bajo el plan?", "cuánto vendí a crédito"];
  ok(fuera.every((q) => playbookPara(q) !== pb), "el detector NO secuestra un turno ajeno", fuera.filter((q) => playbookPara(q) === pb).join(" | "));
  ok(playbookPara("como viene mi margen?") === margenEnRiesgo, "…y «cómo viene mi margen» sigue siendo de margen-en-riesgo: la precedencia es la del registro");
  // lo que NO cubre, dicho: punto de venta y condición no tienen herramienta — no se promete
  ok(playbookPara("mejores y peores puntos de venta") === null && playbookPara("cuánto vendí a crédito vs contado") === null,
    "★ punto de venta y condición NO entran: ninguna herramienta declara esos ejes, y prometer un eje que el motor no sirve es el defecto de siempre");

  // la lista notarial: sus dos promesas, por reglas
  const figsMarca = boletaDelPlaybook(pb, "bonanza", "qué marca deja más margen");
  const v1 = vetosDelPlaybook(pb, "Por familia, Línea Blanca lidera con 24.0%.", { figs: figsMarca, pregunta: "qué marca deja más margen" });
  ok(v1.some((x) => x.regla === "eje-cambiado"), "responder por OTRO eje del que se pidió → eje-cambiado");
  const v2 = vetosDelPlaybook(pb, "Los márgenes de tu cartera vienen ajustados y conviene revisarlos.", { figs: figsMarca, pregunta: "qué marca deja más margen" });
  ok(v2.some((x) => x.regla === "evidencia-sin-usar"), "cinco marcas en la boleta y ninguna nombrada → evidencia-sin-usar");
  ok(vetosDelPlaybook(pb, pb.componer({ figs: figsMarca, pregunta: "qué marca deja más margen" }), { figs: figsMarca, pregunta: "qué marca deja más margen" }).length === 0,
    "…y su propio entregable pasa su lista: auto-consistente");
}

/* ═══ 1c · PLAYBOOK 3 · ENTIDAD × PERÍODO — la pregunta insignia del owner (2026-09-01) ══════════════════════
 * «cuánto me compró Falabella el último mes» tenía dos caminos y un hueco: serie BLOQUEADA → el puente declina
 * con la razón (cubierto); serie REAL → «el cerebro corre con su herramienta», sin garantía. Este playbook
 * cierra el segundo con EL MISMO detector del puente: complementarios por construcción. En el DEMO no se
 * activa nunca (13 clientes «sin-periodo»); se activa en el pack de la PLANTILLA, la forma de un cliente real. */
H("1c · entidad × período: un detector para las tres piezas, y el entregable con su delta declarado");
{
  const PACK = ingestarPlantilla(Buffer.from(plantillaEjemplo()), { nombreArchivo: "v2.xlsx", fechaCarga: "2026-08-31" }).dataset;
  initTenant(PACK);
  const pb = playbookPara("cuánto me compró Depósito Riachuelo el último mes");
  ok(pb && pb.nombre === "entidad-por-periodo", "★ con serie REAL, el playbook toma la pregunta insignia", pb && pb.nombre);
  ok(playbookPara("cuánto me compró Depósito Riachuelo el último mes") !== lecturaPorEjePb(),
    "★ y lectura-por-eje NO la secuestra por la palabra «Depósito» del nombre — un nombre de entidad no es un eje");
  const T = async (q) => answerViaAgente({ text: q, history: [], mem: {}, scenario: "bonanza", callAgente: MUDO });
  const ru = await T("cuánto me compró Depósito Riachuelo el último mes");
  ok(ru.r.agente.estado === "playbook" && /te compró \$22\.560 en agosto 2026; en julio 2026 habían sido \$24\.029/.test(ru.r.text),
    `★ «último mes» → el mes con su cifra Y el anterior con la suya (${ru.r.agente.estado})`, ru.r.text.slice(0, 120));
  ok(/-6\.1% contra el mes anterior/.test(ru.r.text) && ru.r.agente.vetos.length === 0,
    "★ y el delta pasa el muro: va DECLARADO en [[CALCULO]] con inputs (nuevo; viejo), signo ASCII y dueño — los tres, medidos, hacían falta");
  const rp = await T("muéstrame la venta de Depósito Riachuelo mes a mes");
  ok(rp.r.agente.estado === "playbook" && /julio 2026: \$24\.029/.test(rp.r.text) && /agosto 2026: \$22\.560/.test(rp.r.text),
    `★ «mes a mes» → cada mes con su cifra (${rp.r.agente.estado})`);
  const rj = await T("cuánto me compró Depósito Riachuelo en julio");
  ok(rj.r.agente.estado === "playbook" && /en julio 2026: venta de \$24\.029/.test(rj.r.text), `★ «en julio» → ese mes, ese monto (${rj.r.agente.estado})`);
  // la lista notarial
  const figs = boletaDelPlaybook(pb, "bonanza", "cuánto me compró Depósito Riachuelo el último mes");
  const Q = "cuánto me compró Depósito Riachuelo el último mes";
  ok(vetosDelPlaybook(pb, "Depósito Riachuelo te compró $24.029 en julio 2026.", { figs, pregunta: Q }).some((x) => x.regla === "mes-equivocado"),
    "responder julio cuando el último mes es agosto → mes-equivocado");
  ok(vetosDelPlaybook(pb, "En agosto 2026 la compra fue de $22.560.", { figs, pregunta: Q }).some((x) => x.regla === "entidad-ausente"),
    "la cifra sin el nombre de la entidad → entidad-ausente");
  ok(vetosDelPlaybook(pb, pb.componer({ figs, pregunta: Q }), { figs, pregunta: Q }).length === 0, "…y su propio entregable pasa su lista");
  // en el DEMO no hay serie real: el playbook NO aplica y el puente sigue mandando — complementarios, jamás rivales
  initTenant(TENANT_DEMO);
  ok(playbookPara("cuánto me compró Falabella el último mes") === null, "★ en el demo (serie de muestra) el playbook se retira: ese caso es del puente");
  const rd = await T("cuánto me compró Falabella el último mes");
  ok(rd.r.agente.estado === "puente", `…y el turno sigue yendo al puente (${rd.r.agente.estado})`);
}
function lecturaPorEjePb() { return PLAYBOOKS.find((p) => p.nombre === "lectura-por-eje") || null; }

/* ═══ 1d · PLAYBOOK 4 · PROYECCIÓN DECLARADA — los tres turnos binarios de la certificación (2026-09-01) ═════
 * T2 preguntó en vez de proyectar · T4 hizo la cuenta en prosa y el muro la vetó · T5 pidió un `simulate` que el
 * motor no tiene y salió vacío. Los tres tenían herramienta y ninguno camino garantizado. El detector de la
 * forma «venta» es EL MISMO del juez P1 (exportado del contrato): si P1 multa «no proyectaste», este playbook es
 * el que proyecta — un detector, dos usos. La forma «carga» va a `simulateCarga{delta_pp}`. */
H("1d · proyección declarada: la evidencia se calcula antes y llega sellada");
{
  initTenant(TENANT_DEMO);
  const pbC = PLAYBOOKS.find((p) => p.nombre === "proyeccion-declarada");
  ok(!!pbC, "★ el registro tiene el playbook de proyección");
  const T = async (q) => answerViaAgente({ text: q, history: [], mem: {}, scenario: "bonanza", callAgente: MUDO });
  const T2 = "ponele que el año que viene crezco 3%: cuanto seria mi venta?";
  const T4 = "Con ese total anual, proyecta 12 meses con +4% y dime cuánto genera adicional.";
  const T5 = "Sobre esos clientes, simula reducir 2 puntos porcentuales las acciones comerciales y dime si alguno queda sobre el benchmark.";
  ok(playbookPara(T2) === pbC && playbookPara(T4) === pbC && playbookPara(T5) === pbC, "★ los tres turnos verbatim de la certificación tienen playbook");
  const herr = (q) => pasosDe(pbC, q).map((p) => `${p.tool}${p.args.delta_pp != null ? "#" + p.args.delta_pp : ""}${p.args.tasa != null ? "#" + p.args.tasa + "%" : ""}${p.args.horizonte ? "@" + p.args.horizonte : ""}`).join("+");
  ok(herr(T2) === "proyectar#3%@12 meses", `T2 → proyectar con la tasa Y el horizonte LEÍDOS de la pregunta («año que viene» = 12 meses) (${herr(T2)})`);
  ok(herr(T4) === "proyectar#4%@12 meses", `T4 → proyectar +4% a 12 meses (${herr(T4)})`);
  ok(herr(T5) === "simulateCarga#-2", `T5 → simulateCarga con delta_pp NEGATIVO: «reducir» baja (${herr(T5)})`);
  const r2 = await T(T2);
  ok(r2.r.agente.estado === "playbook" && /\$100\.0M/.test(r2.r.text) && /\$103\.0M/.test(r2.r.text) && r2.r.agente.vetos.length === 0,
    `★ T2 → base y proyección, sellada, cero vetos (${r2.r.agente.estado}) — antes preguntaba «¿global o por cliente?»`, r2.r.text.slice(0, 100));
  ok(/proyección/i.test(r2.r.text) && /no una cifra medida/.test(r2.r.text), "…y se NOMBRA como proyección: jamás con el tono de un dato");
  const r4 = await T(T4);
  ok(r4.r.agente.estado === "playbook" && /\$104\.0M/.test(r4.r.text) && /Adicional generado: \$4\.0M/.test(r4.r.text),
    `★ T4 → $104.0M y el adicional, sin vetar (${r4.r.agente.estado}) — antes el muro vetaba la cuenta en prosa`);
  ok(!/^(?:cuánto|si):/.test(r4.r.text), "★ y sin el trato falso «cuánto:» — «dime cuánto» NO es «llámame X»", r4.r.text.slice(0, 40));
  const r5 = await T(T5);
  ok(r5.r.agente.estado === "playbook" && /Quedan sobre el benchmark 6 de 13/.test(r5.r.text) && /La Polar: margen supuesto 36\.0%/.test(r5.r.text),
    `★ T5 → quiénes quedan sobre el benchmark con −2pp, del motor (${r5.r.agente.estado}) — antes salía vacío`, r5.r.text.slice(0, 120));
  ok(!/Falabella: margen supuesto/.test(r5.r.text) && /quedan por debajo/.test(r5.r.text),
    "…Falabella (24.0%) NO figura arriba, y se dice quiénes quedan por debajo: la respuesta completa, y lo que el chequeo de estados del muro reconoce");
  ok(r5.r.agente.vetos.length === 0, "…cero vetos");
  // el detector: el MISMO de P1, con sus salidas — otra medida, entidad nombrada, simulación de otra cosa
  ok(playbookPara("ponele que riachuelo tiene 30% de margen, que hacemos?") !== pbC, "el supuesto sobre OTRA medida no es una proyección de venta (como en P1)");
  ok(playbookPara("proyecta +4% sobre la venta de Falabella") !== pbC, "…con una entidad nombrada, «esa manda»: no es sobre el total");
  ok(playbookPara("como viene mi margen?") === margenEnRiesgo && playbookPara("ranking por canal") === lecturaPorEjePb(), "…y no toca lo de los otros playbooks");
  // la lista notarial
  const figs5 = boletaDelPlaybook(pbC, "bonanza", T5);
  ok(vetosDelPlaybook(pbC, "Quedan sobre el benchmark: Falabella y La Polar.", { figs: figs5, pregunta: T5 }).some((x) => x.regla === "sobre-benchmark-falso"),
    "afirmar que Falabella queda sobre el benchmark (24.0% < 30.1%) → sobre-benchmark-falso");
  ok(vetosDelPlaybook(pbC, "Tu venta queda en $103.0M el año que viene.", { figs: boletaDelPlaybook(pbC, "bonanza", T2), pregunta: T2 }).some((x) => x.regla === "proyeccion-sin-etiqueta"),
    "una proyección dicha como hecho → proyeccion-sin-etiqueta");
  ok(vetosDelPlaybook(pbC, pbC.componer({ figs: figs5, pregunta: T5 }), { figs: figs5, pregunta: T5 }).length === 0, "…y su propio entregable pasa su lista");
}

/* ═══ 2 · LA ACEPTACIÓN · el turno documentado que rescataba, ahora RESPONDE ══════════════════════════════════
 * T6 del expediente (`_AGENTE_PUNTO_DE_PARTIDA.md`), verbatim: «llamame jc de ahora en adelante. como viene mi
 * margen?» salió `limite` con UNA cifra suelta teniendo la cartera entera en la boleta. Mismo cerebro (uno que
 * no logra componer), misma pregunta: con el playbook el turno responde la pregunta. */
H("2 · ★ ACEPTACIÓN · el caso T6 del expediente deja de rescatar");
{
  initTenant(TENANT_DEMO);
  const T6 = "llamame jc de ahora en adelante. como viene mi margen?";
  const r = await answerViaAgente({ text: T6, history: [], mem: {}, scenario: "bonanza", callAgente: MUDO });
  ok(r.r.agente.estado === "playbook", `el turno YA NO rescata: estado «${r.r.agente.estado}» (era «limite»)`);
  ok(!/No pude completar la lectura/.test(r.r.text), "★ y en pantalla no queda una línea de disculpa");
  ok(/Clientes bajo el benchmark: 8/.test(r.r.text) && /Benchmark de margen: 30\.1%/.test(r.r.text),
    "★ responde la pregunta: la vara y cuántos están bajo ella", r.r.text.slice(0, 120));
  ok(/Falabella/.test(r.r.text) && /\$1\.6M/.test(r.r.text) && /Contribución no capturada · subtotal: \$4\.9M/.test(r.r.text),
    "★ con a quién revisar primero y cuánto hay en juego (total y por cliente)");
  ok(r.r.agente.calls === 2 && r.r.agente.figs > 40, `la evidencia se juntó ANTES de decidir (${r.r.agente.calls} herramientas · ${r.r.agente.figs} figs)`);
  // el contraste honesto: sin el playbook, el MISMO cerebro y la misma pregunta caen al rescate de una línea
  const sinPb = await answerViaAgente({ text: "y el inventario como esta?", history: [], mem: {}, scenario: "bonanza", callAgente: MUDO });
  ok(sinPb.r.agente.estado !== "playbook" && sinPb.r.agente.calls === 0,
    `contraste: un turno sin playbook con el MISMO cerebro no lee nada y no responde (${sinPb.r.agente.estado})`);
}

/* ═══ 3 · LA OTRA MITAD · pedir aclaración con la evidencia en la mano ════════════════════════════════════════ */
H("3 · pedir aclaración teniendo la evidencia: multa, y el entregable responde igual");
{
  initTenant(TENANT_DEMO);
  const pregunton = async () => ({ tipo: "texto", texto: "¿Sobre cuál entidad quieres que mire el margen: el total del negocio, un cliente, o una familia?" });
  const r = await answerViaAgente({ text: "como viene mi margen?", history: [], mem: {}, scenario: "bonanza", callAgente: pregunton });
  ok((r.r.agente.vetos || []).some((v) => /evidencia-sin-usar/.test(v)), "★ la aclaración con evidencia disponible recibe multa del playbook",
    JSON.stringify(r.r.agente.vetos));
  ok(r.r.agente.estado === "playbook" && /Clientes bajo el benchmark: 8/.test(r.r.text),
    "…y como el cerebro insiste, el entregable determinístico responde la pregunta");
  ok(!/¿Sobre cuál entidad/.test(r.r.text), "la pregunta vacía jamás llega a pantalla");
}

/* ═══ 4 · NO SE AFLOJA NADA ══════════════════════════════════════════════════════════════════════════════════ */
H("4 · el muro, el contrato y el cerebro bueno: todo sigue mandando");
{
  initTenant(TENANT_DEMO);
  const bueno = async () => ({ tipo: "texto", texto: "Tu margen promedio de cartera es 25.1% contra un benchmark de 30.1%. Hay 8 clientes bajo el benchmark.\n\nFalabella es el de mayor contribución no capturada: $1.6M. Si quieres, lo abrimos primero." });
  const rB = await answerViaAgente({ text: "como viene mi margen?", history: [], mem: {}, scenario: "bonanza", callAgente: bueno });
  ok(rB.r.agente.estado === "verde" && rB.r.text.startsWith("Tu margen promedio"),
    "el cerebro que responde bien MANDA — el determinístico no lo pisa", rB.r.agente.estado);

  const inventa = async () => ({ tipo: "texto", texto: "Tu margen de cartera es 25.1% y la brecha vale $88.8M este año." });
  const rI = await answerViaAgente({ text: "como viene mi margen?", history: [], mem: {}, scenario: "bonanza", callAgente: inventa });
  ok(!/88\.8M/.test(rI.r.text), "★ guardC intacto: la cifra inventada NO llega a pantalla ni con playbook activo");

  const ordena = async () => ({ tipo: "texto", texto: "Margen promedio de la cartera: 25.1%. Benchmark de margen: 30.1%.\n\nRenegocia la carga de Falabella hoy." });
  const rO = await answerViaAgente({ text: "como viene mi margen?", history: [], mem: {}, scenario: "bonanza", callAgente: ordena });
  ok(!/Renegocia la carga/.test(rO.r.text) && (rO.r.agente.vetos || []).some((v) => /cierre-imperativo/.test(v)),
    "el contrato F3 sigue vetando el cierre que ORDENA (la decisión es del usuario)");

  // el playbook no promete lo que el dato no sostiene: en un pack sin vara declarada se retira sin ruido
  const PACK = ingestarPlantilla(Buffer.from(plantillaEjemplo()), { nombreArchivo: "v2.xlsx", fechaCarga: "2026-08-31" }).dataset;
  initTenant(PACK);
  const figsPack = boletaDelPlaybook(margenEnRiesgo, "actual");
  const cumple = promesasCumplidas(margenEnRiesgo, figsPack);
  const compuesto = margenEnRiesgo.componer({ figs: figsPack });
  ok(!cumple || (compuesto === null) || /Benchmark de margen/.test(compuesto),
    "en otro dato: o cumple sus promesas y compone, o se retira — nunca promete lo que no puede");
  initTenant(TENANT_DEMO);
}

/* ═══ 5 · LA LISTA NOTARIAL DEL PLAYBOOK · sus cuatro promesas ════════════════════════════════════════════════ */
H("5 · las promesas del playbook, chequeadas por reglas (nunca por comprensión)");
{
  initTenant(TENANT_DEMO);
  const figs = boletaDelPlaybook(margenEnRiesgo);
  const L = lecturaDeMargen(figs);
  const veto = (t) => vetosDelPlaybook(margenEnRiesgo, t, { figs }).map((v) => v.regla);

  ok(L.bajo.length === 8 && L.conteo.raw === 8,
    `la lista bajo el benchmark es la que el dato sostiene: ${L.bajo.length} y reconcilia con el conteo del motor (${L.conteo.raw})`);
  ok(veto("No pude armar esa lectura. ¿Cuál cliente quieres mirar?").includes("evidencia-sin-usar"),
    "★ 1 · declinar o preguntar sin usar la evidencia → multa");
  ok(veto("Lider está en 21.5% y Falabella en 22.0%, ambos bajo el benchmark de 30.1%.").includes("lista-sin-corte"),
    "★ 2 · nombrar 2 de los 8 sin declarar el recorte → multa");
  ok(!veto("Lider 21.5% y Falabella 22.0% son 2 de los 8 bajo el benchmark de 30.1%.").includes("lista-sin-corte"),
    "…y declarando «2 de los 8», pasa limpio");
  ok(veto("Falabella tiene $1.6M y Lider $1.5M de contribución no capturada. Empiezo por Lider.").includes("orden-no-aplicado"),
    "★ 3 · proponer empezar por quien NO es el mayor en juego → multa");
  ok(!veto("Falabella tiene $1.6M y Lider $1.5M de contribución no capturada. Empiezo por Falabella.").includes("orden-no-aplicado"),
    "…y el orden correcto pasa limpio");
  ok(veto("El benchmark es 30.1%. Lider cede margen porque su equipo comercial negocia mal.").includes("causa-sin-respaldo"),
    "★ 4 · afirmar una causa que el dato no declara → multa (localizar ≠ explicar)");
  ok(!veto("El benchmark es 30.1%. La brecha de Lider se concentra donde el motor localiza carga comercial alta.").includes("causa-sin-respaldo"),
    "…y localizar con el mecanismo declarado, pasa");

  // AUTO-CONSISTENCIA: el entregable del propio playbook no puede disparar su propia lista
  const propio = margenEnRiesgo.componer({ figs });
  ok(vetosDelPlaybook(margenEnRiesgo, propio, { figs }).length === 0,
    "el entregable del playbook NO dispara su propia lista notarial", JSON.stringify(veto(propio)));

  /* CALIBRACIÓN CERO GASTO (la regla de la casa): la lista corre sobre las respuestas que YA salieron a
   * pantalla en los exámenes. Un veto sobre texto aceptado es un falso positivo — se afina antes de estrenar. */
  let aceptadas = 0; const falsos = [];
  for (const f of fs.readdirSync(".")) {
    if (!/^_examen.*consolidado\.json$/.test(f)) continue;
    try {
      const S = JSON.parse(fs.readFileSync(f, "utf8"));
      for (const [i, t] of (S.turnos || []).entries()) {
        const vis = t && typeof t.visible === "string" ? t.visible : "";
        if (!vis.trim() || !margenEnRiesgo.cuandoAplica(String(t.q || ""))) continue;   // solo el dominio del playbook
        aceptadas++;
        const v = vetosDelPlaybook(margenEnRiesgo, vis, { figs });
        if (v.length) falsos.push(`${f} t${i + 1}: ${v.map((x) => x.regla).join(",")}`);
      }
    } catch { /* estado ilegible */ }
  }
  ok(aceptadas >= 1, `el corpus aporta ${aceptadas} respuesta(s) aceptada(s) del dominio del playbook`);
  ok(falsos.length === 0, "cero falsos positivos sobre lo que YA salió a pantalla", falsos.join(" | "));
}

/* ═══ 7 · LA MUESTRA NO MIENTE ═══════════════════════════════════════════════════════════════════════════════
 * `_PLAYBOOK_MARGEN_MUESTRA.md` existe para que el owner vea el playbook sin encender nada. Un documento que
 * muestra texto GENERADO envejece en silencio: si el composer cambia, la muestra sigue diciendo lo viejo y el
 * owner decide sobre algo que ya no existe. Acá se ata al código vivo y al récord del expediente. */
H("7 · la muestra para el owner dice lo que el código dice hoy");
{
  const MU = fs.readFileSync("_PLAYBOOK_MARGEN_MUESTRA.md", "utf8").replace(/\r\n/g, "\n");
  initTenant(TENANT_DEMO);
  const r = await answerViaAgente({ text: "como viene mi margen?", history: [], mem: {}, scenario: "bonanza", callAgente: MUDO });
  const vivo = String(r.r.text || "").trim();
  ok(vivo.length > 100 && MU.includes(vivo), "el entregable de la muestra es el que el código produce HOY, línea por línea",
    vivo.slice(0, 90));
  const EXP = fs.readFileSync("_AGENTE_PUNTO_DE_PARTIDA.md", "utf8").replace(/\r\n/g, "\n");
  const vieja = "jc: No pude completar la lectura que pediste con la calidad que corresponde. Lo que sí tengo verificado: Medida · cerrar brecha al piso = $4.9M.";
  ok(EXP.includes(vieja.slice(0, 120)), "la respuesta «antes» que cita la muestra es verbatim del expediente (T6), no una paráfrasis");
  ok(MU.includes(vieja.split(" Dime")[0].slice(0, 100)), "…y la muestra la reproduce igual");
  ok(/cero gasto|Cero gasto/i.test(MU) && /bandera `ADI_AGENTE` sigue apagada/i.test(MU),
    "la muestra declara lo que es: offline, sin gasto y sin encender la bandera");
}

/* ═══ 6 · CARNADAS ═══════════════════════════════════════════════════════════════════════════════════════════ */
H("6 · CARNADA · cada garantía, probada ROJA con el defecto adentro");
{
  const tmp = [];
  let n = 0;
  const mutar = (rel, reemplazos) => {
    const abs = path.join(process.cwd(), rel);
    let txt = fs.readFileSync(abs, "utf8").replace(/\r\n/g, "\n");
    for (const [de, a] of reemplazos) {
      const antes = txt;
      txt = txt.replace(de, a);
      if (txt === antes) return { error: `la carnada no encontró qué mutar en ${rel}` };
    }
    const destino = abs.replace(/\.js$/, `.carnada${process.pid}_${++n}.js`);
    fs.writeFileSync(destino, txt);
    tmp.push(destino);
    return { url: pathToFileURL(destino).href };
  };
  const carnada = async (nombre, rel, reemplazos, prueba) => {
    const m = mutar(rel, reemplazos);
    if (m.error) return ok(false, `carnada «${nombre}»`, m.error);
    let cazada = false, detalle = "";
    try { cazada = await prueba(await import(m.url)); }
    catch (e) { detalle = `la copia mutada ni siquiera carga: ${e.message}`; }
    ok(cazada, `carnada «${nombre}» → el chequeo se pone ROJO`, detalle || "el defecto pasó DESAPERCIBIDO");
  };

  // (a) el playbook desconectado del bucle: el turno de aceptación vuelve a rescatar
  await carnada("playbook desconectado del bucle", "src/adi/agente/bucleAgente.js",
    [[/  const playbook = \(\(\) => \{ try \{ return playbookPara\(q\); \} catch \{ return null; \} \}\)\(\);/,
      "  const playbook = null;"]],
    async (Mut) => {
      initTenant(TENANT_DEMO);
      const r = await Mut.answerViaAgente({ text: "llamame jc de ahora en adelante. como viene mi margen?", history: [], mem: {}, scenario: "bonanza", callAgente: MUDO });
      return r.r.agente.estado !== "playbook" && r.r.agente.calls === 0;   // el defecto: sin evidencia y sin respuesta
    });

  // (b) los pasos NO se ejecutan antes: el cerebro decide a ciegas (el corazón del encargo)
  await carnada("evidencia NO precargada (el cerebro decide a ciegas)", "src/adi/agente/bucleAgente.js",
    // (re-apuntada 2026-09-01: los pasos ahora se resuelven con `pasosDe` — el sitio cambió de nombre, la carnada mide lo mismo)
    [[/    if \(_rondaDeHerramientas\(_pasosPb\.map\(\(p\) => \(\{ tool: p\.tool, args: p\.args \|\| \{\} \}\)\), mensajes\)\) \{/,
      "    if (false) {"]],
    async (Mut) => {
      initTenant(TENANT_DEMO);
      const r = await Mut.answerViaAgente({ text: "como viene mi margen?", history: [], mem: {}, scenario: "bonanza", callAgente: MUDO });
      return r.r.agente.figs === 0 && r.r.agente.estado !== "playbook";
    });

  // (c) el peldaño del entregable quitado: con el cerebro mudo vuelve la línea de disculpa
  await carnada("entregable del playbook fuera de la escalera", "src/adi/agente/bucleAgente.js",
    [[/  if \(final === null && playbookActivo && typeof playbookActivo\.componer === "function"\) \{/,
      "  if (false) {"]],
    async (Mut) => {
      initTenant(TENANT_DEMO);
      const r = await Mut.answerViaAgente({ text: "como viene mi margen?", history: [], mem: {}, scenario: "bonanza", callAgente: MUDO });
      return /No pude completar la lectura/.test(r.r.text);   // el defecto: la conducta del expediente, de vuelta
    });

  // (d) la auto-verificación del composer quitada: serviría una lista que no reconcilia con el conteo del motor
  await carnada("composer sin auto-verificación contra el conteo", "src/adi/agente/playbooks/margenEnRiesgo.js",
    [[/    if \(!Number\.isFinite\(nDeclarado\) \|\| L\.bajo\.length !== nDeclarado\) return null;/, "    void nDeclarado;"],
     [/  const bajo = Number\.isFinite\(benchPct\) \? margenes\.filter\(\(m\) => m\.pct < benchPct\)\.sort\(\(a, b\) => a\.pct - b\.pct\) : \[\];/,
      "  const bajo = Number.isFinite(benchPct) ? margenes.filter((m) => m.pct < benchPct).slice(0, 3).sort((a, b) => a.pct - b.pct) : [];"]],
    async (Mut) => {
      initTenant(TENANT_DEMO);
      const figs = boletaDelPlaybook(margenEnRiesgo);
      const t = Mut.margenEnRiesgo.componer({ figs });
      return typeof t === "string" && /Clientes bajo el benchmark: 8/.test(t) && Mut.lecturaDeMargen(figs).bajo.length !== 8;
    });

  // (e) la regla de la conducta del owner, vaciada: preguntar con la evidencia en la mano pasa sin multa
  await carnada("regla «evidencia-sin-usar» vaciada", "src/adi/agente/playbooks/margenEnRiesgo.js",
    [[/    if \(!citaAlguna && \(pideDefinir \|\| declina\)\) \{/, "    if (false) {"]],
    async (Mut) => {
      initTenant(TENANT_DEMO);
      const figs = boletaDelPlaybook(margenEnRiesgo);
      return Mut.margenEnRiesgo.listaNotarial("No pude armar esa lectura. ¿Cuál cliente quieres mirar?", { figs }).length === 0;
    });

  // (g) la muestra envejecida: el composer cambia y el documento del owner sigue diciendo lo viejo
  await carnada("muestra desactualizada (documento que envejece en silencio)", "src/adi/agente/playbooks/margenEnRiesgo.js",
    [[/Clientes bajo el benchmark: \$\{_val\(L\.conteo\)\}\./, "Clientes bajo la vara: ${_val(L.conteo)}."]],
    async (Mut) => {
      initTenant(TENANT_DEMO);
      const figs = boletaDelPlaybook(Mut.margenEnRiesgo);
      const nuevo = Mut.margenEnRiesgo.componer({ figs });
      const MU = fs.readFileSync("_PLAYBOOK_MARGEN_MUESTRA.md", "utf8").replace(/\r\n/g, "\n");
      return typeof nuevo === "string" && !MU.includes(nuevo.trim());   // el defecto: la muestra ya no dice lo que el código dice
    });

  // (f) el detector ancho: el playbook secuestra turnos que no le tocan
  //     (la pregunta de prueba pasa los excluyentes de eje/período a propósito: lo que se caza es el detector
  //      de TEMA abierto de par en par, no el filtro de afuera — «llámame jc» no habla de margen ni pide lectura)
  await carnada("detector ancho (secuestra turnos ajenos)", "src/adi/agente/playbooks/margenEnRiesgo.js",
    [[/    return _TEMA_MARGEN\.test\(q\) && _PIDE_LECTURA\.test\(q\);/, "    return true;"]],
    async (Mut) => Mut.margenEnRiesgo.cuandoAplica("llamame jc de ahora en adelante"));

  /* ── LAS DEL PLAYBOOK DE FORMA (lectura por eje) ──────────────────────────────────────────────────────────
   * (A · la OBLIGATORIA del supervisor) · `pasos` como función que pide una herramienta INEXISTENTE. Lo que
   * tiene que pasar: el playbook se retira, el turno no rompe. Lo que este candado ve: el invariante de la
   * sección 1 —cada paso resuelto nombra una herramienta de la caja— se pone ROJO sobre la copia mutada, y el
   * detector sigue reclamando el turno (o sea: sin ese invariante, prometería con una herramienta fantasma).
   * El «no rompe el turno» lo garantiza `_rondaDeHerramientas` del bucle, que devuelve false ante una tool
   * desconocida y deja el turno seguir su camino de siempre — es la misma rama que ya cubre R1. */
  await carnada("pasos(pregunta) pide una herramienta que no existe", "src/adi/agente/playbooks/lecturaPorEje.js",
    [[/    pasos: \[\{ tool: "queryMetric", args: \{ metric: "ventas", dimension: "canal" \}/, '    pasos: [{ tool: "noExiste", args: { metric: "ventas", dimension: "canal" }']],
    async (Mut) => {
      const q = "ranking por canal";
      const pasos = Mut.lecturaPorEje.pasos(q);
      const reclama = Mut.lecturaPorEje.cuandoAplica(q);
      return reclama && pasos.length > 0 && !pasos.every((p) => !!cajaDelAgente(TOOLS)[p.tool]);
    });

  // (B) el filtro de SKU retirado: las bodegas vuelven al ranking de «SKU frenado»
  await carnada("SKU frenado con las bodegas adentro", "src/adi/agente/playbooks/lecturaPorEje.js",
    [[/      \.filter\(\(x\) => x\.entidad && x\.fmt && \(!esSku \|\| esSku\.has\(x\.entidad\)\)\);/, "      .filter((x) => x.entidad && x.fmt);"]],
    async (Mut) => {
      const figs = boletaDelPlaybook(Mut.lecturaPorEje, "bonanza", "qué SKU tienen capital frenado");
      return /Valparaíso|Antofagasta/.test(String(Mut.lecturaPorEje.componer({ figs, pregunta: "qué SKU tienen capital frenado" }) || ""));
    });

  // (C) el número leído solo de `raw`: marca vuelve a salir SIN ordenar (el motor no pone raw en todas)
  await carnada("el ranking por marca sin ordenar (raw solo en las destacadas)", "src/adi/agente/playbooks/lecturaPorEje.js",
    [[/  if \(f && Number\.isFinite\(f\.raw\)\) return f\.raw;\n  const s = String/, "  return (f && Number.isFinite(f.raw)) ? f.raw : NaN;\n  const s = String"]],
    async (Mut) => {
      const figs = boletaDelPlaybook(Mut.lecturaPorEje, "bonanza", "qué marca deja más margen");
      const t = String(Mut.lecturaPorEje.componer({ figs, pregunta: "qué marca deja más margen" }) || "");
      return !/de mayor a menor/.test(t) || t.indexOf("Makita") > t.indexOf("LG");
    });

  // (D) `_FUERA` vaciado: una simulación que nombra un eje queda secuestrada por la lectura
  await carnada("lectura por eje secuestra una simulación", "src/adi/agente/playbooks/lecturaPorEje.js",
    [[/  if \(_FUERA\.test\(q\) \|\| !_PIDE_LECTURA\.test\(q\)\) return null;/, "  if (!_PIDE_LECTURA.test(q)) return null;"]],
    async (Mut) => Mut.lecturaPorEje.cuandoAplica("simula que la marca LG sube 3%: cuánto margen deja"));

  /* ── LAS DE ENTIDAD × PERÍODO ───────────────────────────────────────────────────────────────────────────────
   * La carnada no puede meter el módulo mutado en el registro del bucle, así que el texto que compone la copia
   * se juzga DIRECTO contra guardC con el MISMO contexto que el bucle arma en la plantilla (boleta de la
   * herramienta, dueños del tenant, dato proyectado). Es el muro real, no una imitación. Los tres defectos de
   * abajo los cometí yo en la primera versión y los cazó la sonda, uno por uno: por eso son carnada. */
  const PACK_B = ingestarPlantilla(Buffer.from(plantillaEjemplo()), { nombreArchivo: "v2.xlsx", fechaCarga: "2026-08-31" }).dataset;
  const QB = "cuánto me compró Depósito Riachuelo el último mes";
  const _juzgaDirecto = (texto) => {
    initTenant(PACK_B);
    const figs = serieEntidad({ entity: "Depósito Riachuelo", metrica: "venta" }, { scenario: "bonanza" }).boleta;
    const duenos = []; for (const e of ["cliente", "sku", "marca", "familia", "bodega", "canal"]) { try { duenos.push(...axisEntityNames(e)); } catch { /* */ } }
    const v = guardC(String(texto || ""), { ledger: { figs }, results: [], trace: null, question: QB, supuestoPendiente: [],
      recitaAprobada: null, datoProyectado: cifrasDelDato("bonanza"), entidadesDelTenant: duenos, duenosDelTenant: duenos, contentScope: "full", tablePolicy: "auto" });
    return { ok: !!(v && v.ok), figs };
  };
  const _componeB = (Mut) => { initTenant(PACK_B); const figs = serieEntidad({ entity: "Depósito Riachuelo", metrica: "venta" }, { scenario: "bonanza" }).boleta; return Mut.entidadPorPeriodo.componer({ figs, pregunta: QB }); };

  // (E) los inputs al revés (viejo; nuevo): el muro recompone +6.5% contra −6.1% y veta
  await carnada("el delta con los inputs al revés (viejo; nuevo)", "src/adi/agente/playbooks/entidadPorPeriodo.js",
    [[/inputs=\$\{u\.fmt\}; \$\{a\.fmt\}/, "inputs=${a.fmt}; ${u.fmt}"]],
    async (Mut) => !_juzgaDirecto(_componeB(Mut)).ok);
  // (F) sin dueño: la cuenta cierra pero no declara de quién es, y el muro la rechaza igual
  await carnada("el delta sin dueño declarado", "src/adi/agente/playbooks/entidadPorPeriodo.js",
    [[/ · dueno=\$\{d\.entidad\}\\n`\);/, "\\n`);"]],
    async (Mut) => !_juzgaDirecto(_componeB(Mut)).ok);
  // (G) el signo tipográfico «−» (U+2212): el `_num` del muro solo lee `-` ASCII y el resultado no se parsea
  await carnada("el signo del delta con el «−» tipográfico", "src/adi/agente/playbooks/entidadPorPeriodo.js",
    [[/const signo = pct >= 0 \? "\+" : "-";/, 'const signo = pct >= 0 ? "+" : "\\u2212";']],
    async (Mut) => !_juzgaDirecto(_componeB(Mut)).ok);
  // (H) `_caso` sin exigir serie REAL: el playbook reclama también la bloqueada y compite con el puente
  await carnada("entidad×período reclama la serie bloqueada (compite con el puente)", "src/adi/agente/playbooks/entidadPorPeriodo.js",
    [[/  if \(!estado \|\| !estado\.real\) return null;/, "  // CARNADA: la serie bloqueada también"]],
    async (Mut) => { initTenant(TENANT_DEMO); return Mut.entidadPorPeriodo.cuandoAplica("cuánto me compró Falabella el último mes"); });

  /* ── LAS DE PROYECCIÓN DECLARADA ────────────────────────────────────────────────────────────────────────── */
  const T5C = "Sobre esos clientes, simula reducir 2 puntos porcentuales las acciones comerciales y dime si alguno queda sobre el benchmark.";
  const _juzgaC = (texto) => {
    initTenant(TENANT_DEMO);
    const rp = runPlan({ intent: "answer", calls: [{ tool: "simulateCarga", args: { dimension: "cliente", delta_pp: -2 } }] }, { scenario: "bonanza", registry: cajaDelAgente(TOOLS) });
    const figs = (rp.ledger && rp.ledger.figs) || [];
    const duenos = []; for (const e of ["cliente", "sku", "marca", "familia", "bodega", "canal"]) { try { duenos.push(...axisEntityNames(e)); } catch { /* */ } }
    const v = guardC(String(texto || ""), { ledger: { figs }, results: rp.results || [], trace: null, question: T5C, supuestoPendiente: [], recitaAprobada: null,
      datoProyectado: cifrasDelDato("bonanza"), entidadesDelTenant: duenos, duenosDelTenant: duenos, contentScope: "full", tablePolicy: "auto" });
    return { ok: !!(v && v.ok), figs };
  };
  // (I) el horizonte INVENTADO: sin horizonte en la pregunta, el playbook no puede ponerle uno — sería un supuesto que nadie declaró
  await carnada("el horizonte se inventa cuando la pregunta no lo trae", "src/adi/agente/playbooks/proyeccionDeclarada.js",
    [[/  return null;\n\};\n\/\* la tasa: el porcentaje de la pregunta/, '  return "12 meses";   // CARNADA\n};\n/* la tasa: el porcentaje de la pregunta']],
    async (Mut) => { initTenant(TENANT_DEMO); const p = Mut.proyeccionDeclarada.pasos("proyecta con +4% y dime cuánto genera"); return !!(p[0] && p[0].args.horizonte); });
  // (J) «reducir» que no baja: el signo del delta se pierde y la simulación mueve la carga hacia ARRIBA
  await carnada("«reducir 2pp» simula +2pp (el signo perdido)", "src/adi/agente/playbooks/proyeccionDeclarada.js",
    [[/    const delta = _BAJA\.test\(q\) \? -Math\.abs\(n\) : Math\.abs\(n\);/, "    const delta = Math.abs(n);   // CARNADA"]],
    async (Mut) => { initTenant(TENANT_DEMO); const p = Mut.proyeccionDeclarada.pasos(T5C); return !!(p[0] && p[0].args.delta_pp > 0); });
  // (K) sin la línea de «quiénes quedan por debajo»: el chequeo de estados del muro veta el entregable (medido)
  await carnada("el entregable de carga sin decir quiénes quedan por debajo", "src/adi/agente/playbooks/proyeccionDeclarada.js",
    [[/      const bajo = sup\.filter\(\(x\) => x\.pct < vara\);\n      if \(bajo\.length\) partes\.push\(/, "      const bajo = [];   // CARNADA\n      if (bajo.length) partes.push("]],
    async (Mut) => { const { figs } = _juzgaC(""); return !_juzgaC(Mut.proyeccionDeclarada.componer({ figs, pregunta: T5C })).ok; });
  // (L) sin «esa manda»: una proyección sobre UNA entidad queda secuestrada como si fuera sobre el total
  await carnada("proyección sobre una entidad tomada como si fuera sobre el total", "src/adi/agente/playbooks/proyeccionDeclarada.js",
    [[/ && !_nombraEntidad\(q\)\) \{/, ") {   // CARNADA"]],
    async (Mut) => { initTenant(TENANT_DEMO); return Mut.proyeccionDeclarada.cuandoAplica("proyecta +4% sobre la venta de Falabella"); });
  initTenant(TENANT_DEMO);

  for (const f of tmp) { try { fs.unlinkSync(f); } catch { /* */ } }
}

initTenant(TENANT_DEMO);
console.log(`\n── _agente_playbooks_gate: ${pass} PASS · ${fail} FAIL (de ${pass + fail}) ──`);
process.exit(fail ? 1 : 0);
