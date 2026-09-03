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
import { cajaDelAgente, serieEntidad, cobranza } from "./src/adi/agente/herramientasAgente.js";
import { guardC } from "./src/adi/oracle/guardC.js";                 // las carnadas de entidad×período juzgan el texto compuesto DIRECTO contra el muro
import { cifrasDelDato } from "./src/adi/oracle/datoProyectado.js";
import { axisEntityNames } from "./src/adi/oracle/entityIndex.js";
import { buildMesaEstado } from "./src/adi/sentrix/mesa.js";         // la card del margen: la brecha sellada tiene que dar SU número (una sola verdad)

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
  const fuera = ["cuanto me compro falabella el ultimo mes", "que productos dejan mas plata",
    "ponele que el margen sube 3%: cuanto seria", "simula que llevo la carga al target", "llamame jc"];
  /* «dame el inventario» dejó de estar sin dueño (T3, 2026-09-05: la lectura de inventario en fraseo natural
   * ya tiene camino). Lo que este check prueba sigue siendo lo mismo —que MARGEN no se lo lleve— así que se
   * mide contra su dueño real en vez de exigir el vacío que la mejora acaba de llenar. */
  const deOtroDueno = ["dame el inventario"];
  ok(dentro.every((q) => playbookPara(q) === margenEnRiesgo), "el detector aplica en TODO su dominio",
    dentro.filter((q) => !playbookPara(q)).join(" | "));
  ok(deOtroDueno.every((q) => playbookPara(q) !== margenEnRiesgo), "…y una lectura de inventario NO se la lleva margen",
    deOtroDueno.filter((q) => playbookPara(q) === margenEnRiesgo).join(" | "));
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
  ok(rm.r.agente.estado === "playbook" && /margen por marca, de mayor a menor:/i.test(rm.r.text) && rm.r.text.indexOf("Makita") < rm.r.text.indexOf("LG"),
    "★ marca → ordenada de mayor a menor (Makita 35.5% antes que LG 24.0%) — el motor solo pone `raw` en las destacadas", rm.r.text.slice(0, 100));
  ok(/benchmark de margen es 30\.1%/i.test(rm.r.text), "…y declara el benchmark, para que «deja más» tenga vara");
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
  /* lo que NO cubre, dicho: punto de venta sigue sin herramienta — no se promete. «Condición» dejó de estar en
   * esta lista el 2026-09-01: la herramienta `cobranza` existe desde hoy y su playbook garantiza esa pregunta
   * (ver 1e). El check se actualizó CON la herramienta, no antes: prometer primero y construir después es el
   * defecto de siempre en el otro orden. */
  ok(playbookPara("mejores y peores puntos de venta") === null,
    "★ punto de venta NO entra: ninguna herramienta declara ese eje, y prometer un eje que el motor no sirve es el defecto de siempre");
  ok(playbookPara("cuánto vendí a crédito vs contado") !== null && playbookPara("cuánto vendí a crédito vs contado").nombre === "cobranza",
    "…y «crédito vs contado» pasó de sin-garantía a cobranza — el eje tiene herramienta desde hoy");

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

/* ═══ 1e · PLAYBOOK 5 · COBRANZA — el cobro, de la misma mesa que la pestaña (owner 2026-09-01) ══════════════
 * El hueco medido: ninguna herramienta leía `flujoComercial` — «quién me debe y qué está vencido» era
 * incontestable en la completa del owner con 158 abonos cargados. La regla del owner es textual y es la que
 * este bloque defiende: el vencido sin plazo declarado es «—», JAMÁS $0. */
H("1e · cobranza: quién debe con nombre, y el vencido en raya cuando no hay plazo");
{
  const PACK = ingestarPlantilla(Buffer.from(plantillaEjemplo()), { nombreArchivo: "v2.xlsx", fechaCarga: "2026-08-31" }).dataset;
  const pbCob = PLAYBOOKS.find((p) => p.nombre === "cobranza");
  ok(!!pbCob, "★ el registro tiene el playbook del cobro");
  const T = async (q) => answerViaAgente({ text: q, history: [], mem: {}, scenario: "bonanza", callAgente: MUDO });

  // la PLANTILLA (sin plazo declarado — el caso REAL del owner)
  initTenant(PACK);
  const rd = await T("quién me debe y qué está vencido");
  ok(rd.r.agente.estado === "playbook" && /Quién te debe:/.test(rd.r.text) && /Obras del Sur: \$31K/.test(rd.r.text),
    `★ la deuda con nombre y saldo (${rd.r.agente.estado})`, rd.r.text.slice(0, 110));
  ok(/no se puede saber/.test(rd.r.text) && /no declaró plazo/.test(rd.r.text) && !/vencid[oa][^.\n]*\$\s?\d|\$\s?0/.test(rd.r.text),
    "★ LA REGLA DEL OWNER: el vencido se dice con palabras («no se puede saber… sin plazo») — ni $0 ni ninguna cifra");
  const boletaCob = cobranza({}, { scenario: "bonanza" }).boleta;
  ok(!boletaCob.some((f) => /vencido/i.test(String(f.label))), "★ y la herramienta NO emite ninguna fig de vencido sin plazo — la raya empieza en la fuente");
  const rc = await T("cuánto vendí a crédito vs contado");
  ok(rc.r.agente.estado === "playbook" && /Vendiste a crédito \$87K/.test(rc.r.text) && /contado no generan deuda/.test(rc.r.text),
    `★ crédito vs contado: la cifra declarada, sin restar un contado que el dato no trae (${rc.r.agente.estado})`, rc.r.text.slice(0, 110));

  // la PARCIAL (sin hoja Abonos): el playbook se retira y el mapa nombra la hoja — la conducta de siempre
  initTenant({ ...PACK, flujoComercial: null, avisosDeCarga: [{ tipo: "hoja-ausente", detalle: "no vino la hoja «Abonos»" }, ...(PACK.avisosDeCarga || [])] });
  const rp = await T("quién me debe y qué está vencido");
  ok(rp.r.agente.estado !== "playbook" && /Tu archivo no trae la hoja Abonos/.test(rp.r.text),
    `★ en la PARCIAL el playbook se retira sin ruido y la respuesta nombra la hoja (${rp.r.agente.estado})`, rp.r.text.slice(0, 100));

  // el DEMO (con plazo declarado): el vencido SÍ es una cifra, con quien encabeza
  initTenant(TENANT_DEMO);
  const rv = await T("quién me debe y qué está vencido");
  ok(rv.r.agente.estado === "playbook" && /\$12\.6M ya está vencido/.test(rv.r.text) && /el más pesado es Lider con \$4\.6M/.test(rv.r.text),
    `★ con plazo declarado el vencido es cifra y nombra a quien encabeza (${rv.r.agente.estado})`, rv.r.text.slice(0, 140));

  // el detector NO secuestra
  const fueraCob = ["como viene mi margen?", "ranking por canal", "qué SKU tienen capital frenado", "simula reducir 2 puntos porcentuales las acciones comerciales",
    "cuanto me compro falabella el ultimo mes", "ponele que crezco 3%: cuanto seria mi venta?"];
  ok(fueraCob.every((q) => playbookPara(q) !== pbCob), "el detector NO secuestra un turno ajeno", fueraCob.filter((q) => playbookPara(q) === pbCob).join(" | "));

  // la lista notarial, con el flujo del demo (que sí tiene clientes con saldo)
  initTenant(PACK);
  const figsCob = boletaDelPlaybook(pbCob, "bonanza", "quién me debe y qué está vencido");
  ok(vetosDelPlaybook(pbCob, "El saldo vencido es $0: nadie está en mora.", { figs: figsCob, pregunta: "quién me debe y qué está vencido" })
    .some((x) => x.regla === "vencido-inventado"), "escribir «$0 vencido» sin plazo → vencido-inventado");
  ok(vetosDelPlaybook(pbCob, "Tienes deuda pendiente considerable y conviene revisarla.", { figs: figsCob, pregunta: "quién me debe y qué está vencido" })
    .some((x) => x.regla === "deuda-sin-nombre"), "la deuda sin nombrar a nadie → deuda-sin-nombre");
  ok(vetosDelPlaybook(pbCob, "Vendiste a crédito $87K y al contado $13K.", { figs: figsCob, pregunta: "cuánto vendí a crédito vs contado" })
    .some((x) => x.regla === "contado-derivado"), "un monto de contado que el dato no declara → contado-derivado");
  ok(vetosDelPlaybook(pbCob, pbCob.componer({ figs: figsCob, pregunta: "quién me debe y qué está vencido" }), { figs: figsCob, pregunta: "quién me debe y qué está vencido" }).length === 0,
    "…y su propio entregable pasa su lista");

  /* la COMPLETA del owner, si está en esta máquina: los saldos verificados por el supervisor, del archivo real */
  const REAL = "C:/Users/jcnav/Downloads/Plantilla_ADI_v2_completa_25_clientes_ajustada.xlsx";
  if (fs.existsSync(REAL)) {
    const ing = ingestarPlantilla(fs.readFileSync(REAL), { nombreArchivo: "completa.xlsx", fechaCarga: "2026-09-01" });
    if (ing.ok) {
      initTenant(ing.dataset);
      const rr = await T("quién me debe y qué está vencido");
      ok(/\$118\.8M/.test(rr.r.text) && /\$266\.5M/.test(rr.r.text) && /Comercial Valparaiso: \$17\.7M/.test(rr.r.text),
        "★ COMPLETA DEL OWNER · saldo $118.8M de $266.5M a crédito, y Comercial Valparaiso encabeza con $17.7M", rr.r.text.slice(0, 140));
      ok(/no se puede saber/.test(rr.r.text) && !/vencid[oa][^.\n]*\$/.test(rr.r.text),
        "★ …y su vencido va con palabras: su planilla no declara plazo — el caso real, no el borde");
    }
  } else {
    console.log("      (la planilla real del owner no está en esta máquina: 2 checks de la completa no corren)");
  }
  initTenant(TENANT_DEMO);
}

/* ═══ 1f · LOS 4 DE ASESORÍA — cliente perdiendo · inventario inmovilizado · caída de ventas · precio ════════
 * (owner 2026-09-01) Las tres leyes del encargo, cada una probada: 01 QUÉ · 02 DÓNDE (localiza, jamás causas)
 * · 03 QUÉ HACER PRIMERO (ofrece, jamás ordena); detector léxico CONSERVADOR con no-secuestro medido contra
 * las preguntas que los gates existentes ejercitan; y la MATERIALIDAD del piso relativo mandando sobre el
 * entregable (declarada cuando deja algo afuera). Medidos contra el DEMO acá y contra la COMPLETA del owner
 * al final del bloque (condicional al archivo, como §1e). */
H("1f · los 4 de asesoría: QUÉ · DÓNDE · QUÉ HACER PRIMERO, con la materialidad mandando");
{
  const nombres = PLAYBOOKS.map((p) => p.nombre);
  ok(["cliente-perdiendo-contribucion", "inventario-inmovilizado", "lectura-de-ventas", "oportunidad-de-precio"].every((n) => nombres.includes(n)),
    "★ los cuatro están en el registro", nombres.join(", "));

  // LA GUARDIA DE NO-SECUESTRO: las preguntas que los gates existentes ejercitan siguen con su dueño de siempre.
  initTenant(TENANT_DEMO);
  const GUARDIA = [
    ["qué clientes están bajo el benchmark", "margen-en-riesgo"], ["¿cómo viene mi margen?", "margen-en-riesgo"],
    ["ranking por canal: mejores y peores", "lectura-por-eje"], ["qué SKU tienen capital frenado", "lectura-por-eje"],
    ["capital por bodega", "lectura-por-eje"], ["qué marca deja más margen", "lectura-por-eje"],
    ["ponele que el año que viene crezco 3%: cuanto seria mi venta?", "proyeccion-declarada"],
    ["quién me debe y qué está vencido", "cobranza"], ["cuánto vendí a crédito vs contado", "cobranza"],
  ];
  const rotas = GUARDIA.filter(([q, esp]) => (playbookPara(q) || {}).nombre !== esp);
  ok(rotas.length === 0, "★ NO-SECUESTRO · las 9 preguntas de los gates existentes siguen con su dueño de siempre",
    rotas.map(([q, esp]) => `«${q}» era ${esp} → ${(playbookPara(q) || {}).nombre || "(nada)"}`).join(" | "));
  const NUEVAS = [
    ["qué clientes estoy perdiendo", "cliente-perdiendo-contribucion"], ["dónde estoy perdiendo contribución", "cliente-perdiendo-contribucion"],
    ["qué hago con el inventario inmovilizado", "inventario-inmovilizado"], ["cómo libero el capital frenado", "inventario-inmovilizado"],
    ["por qué cayeron mis ventas", "lectura-de-ventas"], ["se me está cayendo la venta, ¿dónde?", "lectura-de-ventas"],
    ["dónde tengo oportunidad de precio", "oportunidad-de-precio"], ["qué precios debería revisar", "oportunidad-de-precio"],
  ];
  const perdidas = NUEVAS.filter(([q, esp]) => (playbookPara(q) || {}).nombre !== esp);
  ok(perdidas.length === 0, "…y las preguntas de asesoría encuentran su playbook (8 formas)",
    perdidas.map(([q]) => q).join(" | "));
  ok(playbookPara("por punto de venta, ¿quién queda bajo el plan?") === null,
    "…y «bajo el plan» NO es una caída: «punto de venta» contiene «venta» y «bajo» — la trampa medida que el detector esquiva");

  // E2E EN EL DEMO, por el bucle entero (muro incluido) — escenario declarado: "actual", el de la pantalla.
  const T = async (q) => answerViaAgente({ text: q, history: [], mem: {}, scenario: "actual", callAgente: MUDO });
  const ra = await T("qué clientes estoy perdiendo");
  ok(ra.r.agente.estado === "playbook" && /La Polar · -\$417K contra el año anterior/.test(ra.r.text) && /Ripley · -\$414K/.test(ra.r.text),
    `★ A · quiénes caen, cada uno con su cifra YoY (${ra.r.agente.estado})`, ra.r.text.slice(0, 120));
  // (ancla común de TODAS las variantes del cierre — la oferta varía por semilla desde 2026-09-03)
  ok(/por qué se cae no está en este dato/.test(ra.r.text) && /la serie mensual de La Polar/.test(ra.r.text),
    "…02 LOCALIZA sin causas y 03 OFRECE abrir al que más cae");
  const rb = await T("qué hago con el inventario inmovilizado");
  ok(rb.r.agente.estado === "playbook" && /\$33K de capital inmovilizado/.test(rb.r.text) && /capital frenado \$14K/.test(rb.r.text),
    `★ B · el total y cada SKU con el monto pegado a su concepto (${rb.r.agente.estado})`, rb.r.text.slice(0, 120));
  ok(/bajo el 0,05% de tu venta: \$50K/.test(rb.r.text) && /no es tu incendio de hoy/.test(rb.r.text),
    "★ B · MATERIALIDAD: $33K está bajo el piso relativo y el entregable LO DICE con el umbral declarado");
  ok(/Si igual quieres verlo/.test(rb.r.text) && !/ten[eé]s que|hay que|liquid[aá]/i.test(rb.r.text),
    "…y el 03 sigue ofreciendo (nunca ordenando) aun cuando no es material");
  const rc2 = await T("se me está cayendo la venta, ¿dónde?");
  ok(rc2.r.agente.estado === "playbook" && /7\.6%/.test(rc2.r.text) && /NO viene cayendo/.test(rc2.r.text),
    `★ C · el veredicto es del DATO, no del nombre del playbook: en el demo la venta sube y lo dice (${rc2.r.agente.estado})`, rc2.r.text.slice(0, 120));
  ok(/La Polar · -\$417K/.test(rc2.r.text) && /Los que más suben: Lider \+\$2\.3M/.test(rc2.r.text),
    "…y localiza igual: los que caen (materiales) y los que más suben, cada uno con su cifra");
  const rd2 = await T("dónde tengo oportunidad de precio");
  ok(rd2.r.agente.estado === "playbook" && /12 SKU venden por debajo/.test(rd2.r.text) && /MAK-COMP-AIR · margen de venta 7\.9%/.test(rd2.r.text),
    `★ D · los peores por margen DE VENTA (el muro exige decir cuál margen) (${rd2.r.agente.estado})`, rd2.r.text.slice(0, 120));
  ok(/esta lectura publica el margen de 10 de los 12/.test(rd2.r.text),
    "★ D · el CORTE declarado contra lo publicado: el panel trae 10 de los 12 — se dice, no se finge completitud");
  // (ancla común de TODAS las variantes del cierre — la oferta varía por semilla desde 2026-09-03)
  ok(/no está en esta lectura: no lo afirmo/.test(rd2.r.text) && /antes de tocar ningún precio/i.test(rd2.r.text),
    "…y no culpa al precio sin driver: ofrece abrir la estructura");

  // LA LISTA NOTARIAL DE CADA UNO: la mentira multada, la frase legítima intacta, y el propio entregable limpio.
  const pbA = PLAYBOOKS.find((p) => p.nombre === "cliente-perdiendo-contribucion");
  const pbB = PLAYBOOKS.find((p) => p.nombre === "inventario-inmovilizado");
  const pbC = PLAYBOOKS.find((p) => p.nombre === "lectura-de-ventas");
  const pbD = PLAYBOOKS.find((p) => p.nombre === "oportunidad-de-precio");
  const figsA = boletaDelPlaybook(pbA, "actual", "qué clientes estoy perdiendo");
  ok(vetosDelPlaybook(pbA, "La Polar cae porque su comprador nos bajó el share.", { figs: figsA }).some((x) => x.regla === "causa-sin-respaldo"),
    "A · la causa inventada se multa (localizar no es explicar)");
  ok(vetosDelPlaybook(pbA, "Empiezo por Ripley para revisar la caída.", { figs: figsA }).some((x) => x.regla === "prioridad-muda"),
    "A · la prioridad muda se multa (Ripley no es el que más cae y no se declara criterio)");
  ok(!vetosDelPlaybook(pbA, "Empiezo por Ripley: prefiero su cuenta por criterio comercial, aunque el que más cae es La Polar.", { figs: figsA }).some((x) => x.regla === "prioridad-muda"),
    "…y la prioridad CON criterio declarado no se multa");
  const figsB = boletaDelPlaybook(pbB, "actual", "qué hago con el inventario inmovilizado");
  ok(vetosDelPlaybook(pbB, "Liquidá LG-DRYER8KG ya mismo: hay que sacárselo de encima.", { figs: figsB }).some((x) => x.regla === "accion-ordenada"),
    "B · la orden se multa (el 03 ofrece, jamás ordena)");
  ok(!vetosDelPlaybook(pbB, "Si quieres, una opción es liquidarlo; dime y lo vemos.", { figs: figsB }).some((x) => x.regla === "accion-ordenada"),
    "…y la MISMA acción ofrecida no se multa");
  const figsCpos = [{ label: "headline", value: "7.6%", raw: 7.6 }];
  const figsCneg = [{ label: "headline", value: "-40.5%", raw: -40.5 }];
  ok(pbC.listaNotarial("Tus ventas caen fuerte este año.", { figs: figsCpos }).some((x) => x.regla === "caida-inventada"),
    "C · decir «caen» cuando la lectura publicada sube se multa contra el signo del dato");
  ok(pbC.listaNotarial("Tus ventas no caen, vienen sanas.", { figs: figsCneg }).some((x) => x.regla === "alza-inventada"),
    "C · …y decir «no caen» cuando la lectura publicada baja, también (las dos direcciones)");
  const figsD = boletaDelPlaybook(pbD, "actual", "dónde tengo oportunidad de precio");
  ok(vetosDelPlaybook(pbD, "El precio de MAK-COMP-AIR está muy bajo, por eso pierde.", { figs: figsD }).some((x) => x.regla === "precio-culpado-sin-driver"),
    "D · culpar al precio sin driver se multa (puede ser costo)");
  ok(!vetosDelPlaybook(pbD, "En MAK-COMP-AIR el driver que declara el dato es el costo de su estructura.", { figs: figsD }).some((x) => x.regla === "precio-culpado-sin-driver"),
    "…y nombrar el driver del dato no se multa");
  for (const [pb, figs, q] of [[pbA, figsA, "qué clientes estoy perdiendo"], [pbB, figsB, "qué hago con el inventario inmovilizado"], [pbD, figsD, "dónde tengo oportunidad de precio"]]) {
    const propio = pb.componer({ figs, pregunta: q });
    ok(typeof propio === "string" && vetosDelPlaybook(pb, propio, { figs, pregunta: q }).length === 0,
      `${pb.nombre} · su propio entregable pasa su propia lista notarial (auto-consistencia)`);
  }

  // LA COMPLETA DEL OWNER (condicional al archivo, como §1e): los cuatro sobre el dato real.
  const REAL2 = "C:/Users/jcnav/Downloads/Plantilla_ADI_v2_completa_25_clientes_ajustada.xlsx";
  if (fs.existsSync(REAL2)) {
    const ing2 = ingestarPlantilla(fs.readFileSync(REAL2), { nombreArchivo: "completa.xlsx", fechaCarga: "2026-09-01" });
    if (ing2.ok && ing2.dataset) {
      initTenant(ing2.dataset);
      const ca = await T("qué clientes estoy perdiendo");
      ok(/Comercial Valparaiso · -\$11\.0M/.test(ca.r.text) && /Bazar Centro · -\$10\.6M/.test(ca.r.text),
        "★ COMPLETA · A: los dos que caen de verdad, con sus cifras", ca.r.text.slice(0, 120));
      const cb = await T("qué hago con el inventario inmovilizado");
      ok(/\$38\.1M/.test(cb.r.text) && /ELE-CAB25/.test(cb.r.text) && /el único con capital frenado/.test(cb.r.text),
        "★ COMPLETA · B: $38.1M en ELE-CAB25, nombrado como el único");
      const cc = await T("se me está cayendo la venta, ¿dónde?");
      ok(/-40\.5%/.test(cc.r.text) && /viene por debajo/.test(cc.r.text),
        "★ COMPLETA · C: la caída real (-40.5%) dicha con la cifra publicada");
      const cd = await T("dónde tengo oportunidad de precio");
      ok(/ELE-CAB25 · margen de venta 19\.8%/.test(cd.r.text) && /3 SKU venden por debajo/.test(cd.r.text),
        "★ COMPLETA · D: el peor margen real primero, reconciliado con el conteo (3 de 3)");
      ok(!/\$937\.8M/.test(cd.r.text),
        "★ COMPLETA · D NO cita la «Medida cerrar brecha» rota (1000× la venta del SKU — defecto medido y reportado): una medida mayor que la venta del propio SKU no sale a pantalla");
    }
  } else {
    console.log("      (la planilla real del owner no está en esta máquina: 5 checks de la completa no corren)");
  }
  initTenant(TENANT_DEMO);
}

/* ═══ 1g · LOS 2 DE LA CERTIFICACIÓN — límite honesto con alternativa · síntesis ejecutiva (owner 2026-09-02) ═
 * Los 4 fallos de toda la certificación eran 2 conductas. Acá se certifican las dos, con los turnos VERBATIM
 * de la evidencia y en los tres mundos: el límite se declara con la razón EXACTA del dataset activo (razones
 * DISTINTAS del mismo límite en completa vs parcial), la alternativa va nombrada con su eje (jamás el menú de
 * labels internos), y los 3 riesgos del directorio salen por materialidad — sin inventar el que falta. */
H("1g · certificación: el límite honesto con alternativa, y los 3 riesgos del directorio");
{
  const nombres2 = PLAYBOOKS.map((p) => p.nombre);
  ok(nombres2.includes("limite-honesto") && nombres2.includes("sintesis-ejecutiva"), "★ los dos están en el registro");
  const T = async (q) => answerViaAgente({ text: q, history: [], mem: {}, scenario: "actual", callAgente: MUDO });

  // DEMO T6 · «Compara Q1 vs Q2…» — el turno que salía con el menú de labels internos
  initTenant(TENANT_DEMO);
  const rq = await T("Compara Q1 vs Q2 en ventas, margen y contribución. Si no está en la carpeta, dilo.");
  ok(rq.r.agente.estado === "playbook" && /no trae un corte por trimestre/.test(rq.r.text) && /no la invento/.test(rq.r.text),
    `★ T6 · el corte por trimestre se declina con su razón, sin inventar la suma de meses (${rq.r.agente.estado})`, rq.r.text.slice(0, 110));
  ok(/lectura por CLIENTE contra el año anterior/.test(rq.r.text) && /7\.6%/.test(rq.r.text) && !/dime cu[aá]l abro/.test(rq.r.text),
    "★ …y la alternativa va NOMBRADA con su eje y su cifra — el menú de labels internos no vuelve");
  // DEMO · los 3 riesgos — con 2 materiales, se dice el número verdadero
  const rr2 = await T("dame los 3 riesgos para el directorio");
  /* (re-apuntado a CONDUCTA 2026-09-03, tras la voz ejecutiva del owner: este check medía la FORMA —«2 riesgos
   * materiales» y «no invento el que falta»— y esa segunda frase era justamente el defecto DEFENSIVO que él
   * marcó en producción. La conducta certificada es: dice el número VERDADERO de materiales, declara el
   * umbral en algún lado, y NO se disculpa.) */
  ok(rr2.r.agente.estado === "playbook" && /\bdos riesgos materiales\b|\b2 riesgos materiales\b/.test(rr2.r.text)
    && /0,05% de tu venta|umbral de materialidad/.test(rr2.r.text) && !/no invento|no puedo/i.test(rr2.r.text),
    `★ riesgos DEMO · el dato sostiene 2 materiales y LO DICE con el umbral, sin inventar el tercero (${rr2.r.agente.estado})`, rr2.r.text.slice(0, 110));
  ok(/1 · Contribución no capturada: \$4\.9M — encabeza Falabella con \$1\.6M/.test(rr2.r.text),
    "…QUÉ con cifra verbatim y DÓNDE con dueño, uno por oración");
  /* la CONDUCTA, no la cadena: el cierre OFRECE (pregunta o «si te parece/si quieres») y no ordena. Y desde la
   * voz ejecutiva del owner el cierre es UNO solo, priorizado — no uno por foco (con 3 focos serían 3). */
  const _ofertas = (rr2.r.text.match(/¿[^?]{0,80}\?|si (?:quieres|te parece)/gi) || []).length;
  ok(_ofertas >= 1 && _ofertas <= 2 && !/ten[eé]s que|hay que\b|proced[ea]\b/i.test(rr2.r.text),
    `…y el cierre OFRECE una vez (${_ofertas}), jamás ordena — el cierre por foco no escala`);
  ok(/criterio m[íi]o|dato duro|no sale del dato/i.test(rr2.r.text),
    "…y la PRIORIDAD se marca como criterio del asesor, no como orden del dato (la regla `juicio-sin-marcar` del muro)");

  /* ── LA VOZ EJECUTIVA DEL OWNER (2026-09-03 · primer hallazgo de uso real), congelada como conducta ──────
   * Sus tres defectos de forma, cada uno con su candado; y el ESCALADO que pidió (1 y 3 focos), medido con
   * boletas sintéticas porque el demo solo sostiene 2 focos materiales. */
  ok(!/no invento el que falta|no puedo/i.test(rr2.r.text) && /dejar[íi]a el resto como monitoreo/i.test(rr2.r.text),
    "★ VOZ 1 · el límite es CRITERIO («dejaría el resto como monitoreo»), no un descargo — la defensiva que el owner marcó no vuelve");
  ok(!/^\s*(?:Veo|Los 3)[^\n]*0,05%/.test(rr2.r.text) && /0,05% de tu venta/.test(rr2.r.text),
    "★ VOZ 2 · el umbral NO abre la respuesta pero SIGUE presente (proporcionalidad entera, en frase de negocio al final)");
  {
    const _fg = (label, text, raw) => ({ label, text, value: text, raw, unit: "money" });
    const UNO = [_fg("Contribución no capturada · subtotal", "$4.9M", 4900000), _fg("Falabella · Contribución no capturada", "$1.6M", 1600000)];
    const TRES_MISMA = [...UNO,
      _fg("Carga comercial alta · subtotal", "$655K", 655000), _fg("Falabella · Carga comercial alta", "$194K", 194000),
      _fg("Capital frenado · subtotal", "$38.1M", 38100000), _fg("ELE-CAB25 · Capital frenado", "$12.0M", 12000000)];
    const TRES_DISTINTAS = [...UNO,
      _fg("Carga comercial alta · subtotal", "$655K", 655000), _fg("Sodimac · Carga comercial alta", "$194K", 194000),
      _fg("Capital frenado · subtotal", "$38.1M", 38100000), _fg("ELE-CAB25 · Capital frenado", "$12.0M", 12000000)];
    const _pbSint = PLAYBOOKS.find((x) => x.nombre === "sintesis-ejecutiva");
    const t1 = _pbSint.componer({ figs: UNO, semilla: "s::1" });
    ok(/Veo un riesgo material\b/.test(t1) && !/los materiales|riesgos materiales/.test(t1),
      "★ ESCALA A UNO: dice «un riesgo material» — nunca el plural ni «los materiales»", String(t1).split("\n")[0]);
    const t3 = _pbSint.componer({ figs: TRES_MISMA, semilla: "s::1" });
    const cierres3 = (String(t3).match(/Empezar[íi]a por/g) || []).length;
    ok(cierres3 === 1 && /concentra dos de los tres focos/.test(t3),
      `★ ESCALA A TRES: UN solo cierre (${cierres3}) y la prioridad se justifica con el HECHO de la boleta — la entidad que concentra dos focos (la clave del owner)`);
    const t3b = _pbSint.componer({ figs: TRES_DISTINTAS, semilla: "s::1" });
    ok(/Empezar[íi]a por ELE-CAB25/.test(t3b) && /foco más pesado/.test(t3b),
      "…y si NINGUNA entidad repite, manda el foco más pesado y se DICE el criterio — nunca una prioridad muda");
    /* NO CONTRADECIR AL VIGÍA: cuando nada pasa el piso, la síntesis se RETIRA (null) — el vigía es quien
     * dice «sin focos materiales» con su umbral. Dos superficies, una sola verdad sobre el silencio. */
    const BAJO_PISO = [_fg("Contribución no capturada · subtotal", "$1K", 1000), _fg("Falabella · Contribución no capturada", "$1K", 1000)];
    ok(_pbSint.componer({ figs: BAJO_PISO, semilla: "s::1" }) === null,
      "★ con TODO bajo el piso la síntesis se retira (null) — no contradice al vigía, que es quien declara el silencio con su umbral");
  }
  // «versión más dura» NO es de este playbook: re-narración (medido 43× más caro con el empujón)
  ok(playbookPara("Dame una versión más dura, como si tuviera que presentarla al gerente general.") === null,
    "★ «versión más dura» queda FUERA a propósito: es re-narración del hilo, no una síntesis nueva");

  // COMPLETA (fábrica + el estado que la planilla real del owner SÍ declara) vs PARCIAL: razones DISTINTAS
  const FAB2 = ingestarPlantilla(Buffer.from(plantillaEjemplo()), { nombreArchivo: "v2.xlsx", fechaCarga: "2026-08-31" }).dataset;
  initTenant({ ...FAB2, guardadoSinAnalizar: [{ campo: "punto de venta", filas: 118, distintos: 4 }] });
  const rg = await T("por punto de venta, ¿quién queda bajo el plan?");
  ok(rg.r.agente.estado === "playbook" && /SÍ trae punto de venta \(118 filas con 4 valores distintos\)/.test(rg.r.text) && /todavía no analiza por ese eje/.test(rg.r.text),
    `★ COMPLETA T4 · la razón es la del dato: capturado SIN analizar, con sus filas y valores (${rg.r.agente.estado})`, rg.r.text.slice(0, 120));
  const PARCIAL2 = { ...FAB2, avisosDeCarga: [{ tipo: "columna-vacia", detalle: '"punto de venta" quedó vacía en todas las filas' }, ...(FAB2.avisosDeCarga || [])], guardadoSinAnalizar: [] };
  initTenant(PARCIAL2);
  const rp2 = await T("mejores y peores puntos de venta");
  ok(rp2.r.agente.estado === "playbook" && /no trae la columna «punto de venta»/.test(rp2.r.text),
    `★ PARCIAL T4 · la razón es OTRA: la columna vino vacía — el mismo límite, dos verdades distintas (${rp2.r.agente.estado})`, rp2.r.text.slice(0, 120));
  ok(!/SÍ trae punto de venta/.test(rp2.r.text) && /SÍ trae punto de venta/.test(rg.r.text),
    "★ …y las dos respuestas NO se confunden: cada mundo dice SU razón (la condición del encargo)");
  // en el DEMO nadie declara nada sobre punto de venta: el playbook se retira — no inventa límites
  initTenant(TENANT_DEMO);
  ok(playbookPara("por punto de venta, ¿quién queda bajo el plan?") === null,
    "★ en el DEMO (sin declaración del dato) el playbook se RETIRA: inventar «no existe» sin declaración sería el mismo pecado");

  // el cableado del guardado: la ingesta ahora lleva la MISMA cuenta del preview en el dataset (una verdad)
  const conPdv = ingestarPlantilla(Buffer.from(plantillaEjemplo()), { nombreArchivo: "v2.xlsx", fechaCarga: "2026-08-31" });
  ok(Array.isArray(conPdv.dataset.guardadoSinAnalizar),
    "★ el dataset lleva `guardadoSinAnalizar` (antes moría en el preview y el agente no podía decir el límite)");

  // las listas notariales de los dos, mentira multada y frase legítima intacta
  const pbL = PLAYBOOKS.find((p) => p.nombre === "limite-honesto");
  const pbS = PLAYBOOKS.find((p) => p.nombre === "sintesis-ejecutiva");
  const qPdv = "por punto de venta, ¿quién queda bajo el plan?";
  ok(vetosDelPlaybook(pbL, "Los clientes bajo el benchmark son Obras del Sur y Casa Belgrano.", { figs: [], pregunta: qPdv }).some((x) => x.regla === "eje-servido-a-escondidas"),
    "L · responder por clientes SIN nombrar jamás el eje pedido se multa (la conducta T4 exacta)");
  ok(!vetosDelPlaybook(pbL, "El corte por punto de venta no está disponible; por cliente sí tengo la lectura.", { figs: [], pregunta: qPdv }).some((x) => x.regla === "eje-servido-a-escondidas"),
    "…y nombrar el límite antes de la alternativa no se multa");
  ok(vetosDelPlaybook(pbL, "De este mismo turno también tengo Este año y Valor: dime cuál abro.", { figs: [], pregunta: qPdv }).some((x) => x.regla === "menu-de-labels"),
    "L · el menú de labels internos se multa (el rescate medido en T6/T11)");
  ok(vetosDelPlaybook(pbS, "1 · El margen viene flojo y hay que mirarlo.\n2 · Riesgo de inventario: $38.1M.", { figs: [] }).some((x) => x.regla === "riesgo-sin-cifra"),
    "S · un riesgo enumerado sin cifra se multa (opinión con número de orden)");
  ok(vetosDelPlaybook(pbS, "1 · riesgo $1M.\n2 · riesgo $2M.\n3 · riesgo $3M.\n4 · riesgo $4M.", { figs: [] }).some((x) => x.regla === "sintesis-inflada"),
    "S · cuatro riesgos numerados se multan: la síntesis es EXACTAMENTE 3");

  // LA PLANILLA REAL DEL OWNER (condicional): los DOS turnos de su certificación, verbatim
  const REAL3 = "C:/Users/jcnav/Downloads/Plantilla_ADI_v2_completa_25_clientes_ajustada.xlsx";
  if (fs.existsSync(REAL3)) {
    const ing3 = ingestarPlantilla(fs.readFileSync(REAL3), { nombreArchivo: "completa.xlsx", fechaCarga: "2026-08-31" });
    if (ing3.ok && ing3.dataset) {
      initTenant(ing3.dataset);
      const cr = await T("por punto de venta, ¿quién queda bajo el plan?");
      ok(cr.r.agente.estado === "playbook" && /150 filas con 5 valores distintos/.test(cr.r.text) && /todavía no analiza/.test(cr.r.text),
        "★ REAL T4 · su planilla declara el guardado (150 filas · 5 valores) y ADI ahora LO DICE", cr.r.text.slice(0, 120));
      const cs = await T("dame los 3 riesgos para el directorio");
      ok(cs.r.agente.estado === "playbook" && /Los 3 riesgos, por materialidad:/.test(cs.r.text)
        && /-40\.5%[^\n]{0,50}año anterior/.test(cs.r.text) && /Capital frenado en inventario: \$38\.1M/.test(cs.r.text) && /encabeza ELE-CAB25/.test(cs.r.text),
        "★ REAL T11 · los 3 riesgos con sus cifras: la venta cayendo primero, el capital frenado localizado", cs.r.text.slice(0, 140));
    }
  } else {
    console.log("      (la planilla real del owner no está en esta máquina: 2 checks de la certificación no corren)");
  }
  initTenant(TENANT_DEMO);
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
  // (conducta, no frase — desde la voz humana 2026-09-03: el 8 con su «bajo» y el benchmark con su %)
  ok(/\b8\b[^\n]{0,60}bajo (?:esa referencia|el benchmark)/i.test(r.r.text) && /(?:benchmark|referencia)[^\n]{0,60}30\.1%|30\.1%[^\n]{0,60}benchmark/i.test(r.r.text),
    "★ responde la pregunta: la vara y cuántos están bajo ella", r.r.text.slice(0, 120));
  ok(/Falabella/.test(r.r.text) && /\$1\.6M/.test(r.r.text) && /(?:sin capturar|no capturada)[^\n]{0,60}\$4\.9M|\$4\.9M[^\n]{0,60}(?:sin capturar|no capturada)/i.test(r.r.text),
    "★ con a quién revisar primero y cuánto hay en juego (subtotal y por cliente)");
  ok(r.r.agente.calls === 2 && r.r.agente.figs > 40, `la evidencia se juntó ANTES de decidir (${r.r.agente.calls} herramientas · ${r.r.agente.figs} figs)`);
  // el contraste honesto: sin el playbook, el MISMO cerebro y la misma pregunta caen al rescate de una línea
  /* re-apuntado (T3, 2026-09-05): el contraste usaba «y el inventario como esta?», que dejó de ser un hueco
   * al cerrarse la lectura de inventario. Ahora usa un hueco DEL DATO —el lead time de proveedor, que la
   * carpeta no trae y ningún playbook puede inventar— para que cerrar rutas no vuelva a mover este check. */
  const sinPb = await answerViaAgente({ text: "cual es el lead time de mis proveedores", history: [], mem: {}, scenario: "bonanza", callAgente: MUDO });
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
  ok(r.r.agente.estado === "playbook" && /\b8\b[^\n]{0,60}bajo (?:esa referencia|el benchmark)/i.test(r.r.text),
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
  ok(!cumple || (compuesto === null) || /benchmark/i.test(compuesto),
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

  /* 5 · LA BRECHA DEL NEGOCIO CIERRA CON SUS DOS TÉRMINOS (owner 2026-09-03 · el defecto vivo del 8,6):
   * producción abrió con la brecha de LIDER (8,6 pp) puesta como brecha del negocio, mientras la card de la
   * Mesa decía 5,0. La primera oración es verbatim del turno defectuoso. */
  const VIVO_86 = "Tu margen está 8,6 puntos por debajo del benchmark — el 25,1% promedio contra el 30,1% que el negocio declara como referencia. Eso se traduce en $4,9M de contribución no capturada.";
  ok(veto(VIVO_86).includes("brecha-del-negocio-no-cierra"),
    "★ 5 · la brecha de LIDER (8,6) presentada como brecha del negocio → multa (el defecto vivo, verbatim)");
  ok(veto("JC, tu margen viene 8.6 puntos por debajo del benchmark — y eso te cuesta $4,9M.").includes("brecha-del-negocio-no-cierra"),
    "…también con punto decimal (el punto de «8.6» no corta la oración — la trampa medida acá mismo)");
  ok(!veto("Tu margen promedio está 5,0 pp bajo el benchmark (30,1%): la cartera rinde 25,1%.").includes("brecha-del-negocio-no-cierra"),
    "…y la brecha CORRECTA del negocio (5,0 = 30,1 − 25,1) pasa limpia");
  ok(!veto("Lider es el más lejos: 21,5% de margen, 8,6 puntos por debajo del benchmark.").includes("brecha-del-negocio-no-cierra"),
    "…y la brecha DE LIDER con su nombre en la oración es legítima — no se toca");
  // LA CIFRA SELLADA Y LA CARD, UNA VERDAD: la boleta trae la brecha del negocio derivada con dueño, y da
  // EXACTAMENTE el número de la card de la Mesa (mesa.js) — la ley del encargo: «si existe, se usa ESA».
  const figBrecha = figs.find((f) => /^El negocio · Brecha al benchmark$/.test(String(f.label || "")));
  ok(!!figBrecha && Number.isFinite(figBrecha.raw),
    "la boleta del playbook trae «El negocio · Brecha al benchmark» sellada (source: computed, dueño: el negocio)");
  const cardMargen = String(((buildMesaEstado("bonanza") || {}).estados || {}).margen ? buildMesaEstado("bonanza").estados.margen.linea : "");
  const mCard = /^([\d.,]+) pp bajo/.exec(cardMargen);
  ok(!!figBrecha && !!mCard && Number(figBrecha.raw) === parseFloat(mCard[1].replace(",", ".")),
    `una sola verdad: la fig sellada (${figBrecha ? figBrecha.raw : "?"} pp) = la card de la Mesa («${cardMargen}»)`);

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

/* ═══ 1h · T3 · LA LECTURA DE VENTAS, EL PLAN Y EL INVENTARIO EN FRASEO NATURAL ══════════════════════════════
 * El censo (2026-09-04) midió 15 fraseos de esta familia y 14 caían a `vacio` — entre ellos TRES ask de la
 * Mesa comercial, o sea botones que el producto ofrece. Lo que faltaba no era motor: era dejar entrar la
 * pregunta neutra («cómo van las ventas»), la del plan («contra el presupuesto») y la del inventario dicho en
 * castellano. Cada línea de acá es la que el usuario ve, no una paráfrasis. */
H("1h · T3 · ventas neutra, contra el plan, la serie y el inventario en fraseo natural");
{
  initTenant(TENANT_DEMO);
  const texto = async (q) => String((await answerViaAgente({ text: q, history: [], mem: {}, scenario: "bonanza", callAgente: MUDO })).r.text || "");

  /* ── la lectura NEUTRA: sin señal de caída, el asesor abre con la lectura y no con un desmentido ── */
  const NEUTRAS = ["cómo van las ventas", "la venta cómo viene", "cuánto vendimos", "cómo viene la venta", "cuánto facturamos"];
  ok(NEUTRAS.every((q) => (playbookPara(q) || {}).nombre === "lectura-de-ventas"),
    `las ${NEUTRAS.length} formas neutras tienen camino garantizado`,
    NEUTRAS.filter((q) => (playbookPara(q) || {}).nombre !== "lectura-de-ventas").join(" | "));
  const tN = await texto("cómo van las ventas");
  ok(/Tu venta del per[ií]odo viene en \$100\.0M y viene creciendo contra el a[ñn]o anterior: 7\.6% sobre los \$92\.9M del a[ñn]o pasado\./.test(tN),
    "★ la línea que ve el usuario: el total, la dirección y su referencia — las tres cifras del dato", tN.slice(0, 130));
  ok(!/NO viene cayendo/i.test(tN), "…y NO desmiente una caída que nadie afirmó (esa frase es del caso «por qué caen»)");
  /* el guion largo delante de un porcentaje se leía como signo menos: se mide que la dirección esté DICHA */
  ok(/viene creciendo|viene cayendo/.test(tN) && !/viene en \$100\.0M — 7\.6%/.test(tN),
    "…y la dirección va en palabras, no en un guion que se confunde con un menos");

  /* ── el caso CAÍDA no se movió: la pregunta que afirma la caída sigue recibiendo su desmentido ── */
  const tC = await texto("por qué caen las ventas");
  ok(/Tu venta NO viene cayendo: la lectura del per[ií]odo contra el a[ñn]o anterior es 7\.6%\./.test(tC),
    "el caso «por qué caen» conserva su apertura de siempre (cero regresión)", tC.slice(0, 100));

  /* ── CONTRA EL PLAN: el ask de pantalla, con la referencia nombrada una sola vez ── */
  const tP = await texto("¿Cómo van las ventas contra el presupuesto?");
  ok((playbookPara("¿Cómo van las ventas contra el presupuesto?") || {}).nombre === "lectura-de-ventas",
    "el ask «contra el presupuesto» tiene camino (era 🔴 del censo: un botón sin respuesta)");
  ok(/por encima del presupuesto comprometido — 3\.1% en la lectura del per[ií]odo\./.test(tP),
    "★ y responde contra el PLAN, con la cifra del plan", tP.slice(0, 120));
  ok(/contra su presupuesto/.test(tP) && !/contra el a[ñn]o anterior/.test(tP),
    "…sin mezclar universos: si la lectura es contra el plan, ninguna línea dice «año anterior»");

  /* ── LA SERIE MES A MES: se declina lo que no se puede dictar y se da lo que sí ── */
  const tS = await texto("como viene la venta mes a mes");
  ok(/El mes a mes no te lo puedo dictar ac[aá]/.test(tS) && /se ve en el cuadro de la Mesa/.test(tS),
    "★ la serie global declara por qué no la dicta y dónde se ve", tS.slice(0, 120));
  ok(/\$100\.0M/.test(tS), "…y aun así entrega la lectura del período, que sí es del dato");

  /* ── EL INVENTARIO EN CASTELLANO, con el recorte declarado cuando el usuario no lo pidió ── */
  const INV = ["cómo está el inventario", "qué stock no rota", "capital inmovilizado", "qué tengo frenado"];
  ok(INV.every((q) => (playbookPara(q) || {}).nombre === "lectura-por-eje"),
    "el inventario en fraseo natural tiene camino en sus cuatro formas",
    INV.filter((q) => !playbookPara(q)).join(" | "));
  const tI = await texto("cómo está el inventario");
  ok(/De tu inventario, lo que este dato publica es el capital que qued[oó] frenado — no una foto del stock completo\./.test(tI),
    "★ quien pregunta por el inventario entero recibe el recorte DECLARADO en la primera línea", tI.slice(0, 130));
  const tF = await texto("capital inmovilizado");
  ok(!/no una foto del stock completo/.test(tF),
    "…y quien YA pidió lo inmovilizado no recibe una aclaración que no le hace falta");

  /* ── LOS DOS ASK QUE FALTABAN, cada uno a su dueño ── */
  ok((playbookPara("¿Cuánta contribución no estoy capturando?") || {}).nombre === "margen-en-riesgo",
    "«¿Cuánta contribución no estoy capturando?» es margen en riesgo dicho con otras palabras");
  ok(/deja \$1\.6M sin capturar/.test(await texto("¿Cuánta contribución no estoy capturando?")),
    "…y responde con la contribución no capturada, cliente por cliente");
  const tQ = await texto("¿Quiénes son mis principales clientes por venta?");
  ok((playbookPara("¿Quiénes son mis principales clientes por venta?") || {}).nombre === "lectura-por-eje"
    && /Así viene tu venta por cliente, de mayor a menor:/.test(tQ) && /Falabella: \$19\.4M/.test(tQ),
    "★ y el ranking de clientes por venta sale ordenado y con su cifra", tQ.slice(0, 90));

  /* ── EL NO-SECUESTRO, que es lo caro: siete controles que NO pueden cambiar de dueño ── */
  const AJENOS = [
    ["cómo va el negocio", "resumen-del-negocio"],
    ["cómo está el margen", "margen-en-riesgo"],
    ["qué clientes están mal", "margen-en-riesgo"],
    ["cuánto me compró Falabella", "entidad-por-periodo"],
    ["quiénes están perdiendo contribución", "cliente-perdiendo-contribucion"],
    ["capital por bodega", "lectura-por-eje"],
    ["quién me debe y qué está vencido", "cobranza"],
  ];
  ok(AJENOS.every(([q, n]) => (playbookPara(q) || {}).nombre === n),
    "…y NINGÚN turno ajeno cambió de dueño con los detectores nuevos",
    AJENOS.filter(([q, n]) => (playbookPara(q) || {}).nombre !== n).map(([q]) => q).join(" | "));
  /* el que más duele: la venta DE ALGUIEN no es la venta del negocio */
  ok((playbookPara("cómo van las ventas de Falabella") || {}).nombre !== "lectura-de-ventas",
    "★ «cómo van las ventas de Falabella» NO se la lleva la lectura del negocio: nombra a alguien");
  /* y el que se esquivó a propósito: días de inventario es otra cifra, no el capital frenado */
  ok((playbookPara("cuántos días de inventario tengo") || {}).nombre !== "lectura-por-eje"
    || !/Capital frenado/i.test(await texto("cuántos días de inventario tengo")),
    "…y «días de inventario» no recibe capital frenado en su lugar");
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
      return typeof t === "string" && /\b8 de tus clientes están bajo/.test(t) && Mut.lecturaDeMargen(figs).bajo.length !== 8;
    });

  // (e) la regla de la conducta del owner, vaciada: preguntar con la evidencia en la mano pasa sin multa
  await carnada("regla «evidencia-sin-usar» vaciada", "src/adi/agente/playbooks/margenEnRiesgo.js",
    [[/    if \(!citaAlguna && \(pideDefinir \|\| declina\)\) \{/, "    if (false) {"]],
    async (Mut) => {
      initTenant(TENANT_DEMO);
      const figs = boletaDelPlaybook(margenEnRiesgo);
      return Mut.margenEnRiesgo.listaNotarial("No pude armar esa lectura. ¿Cuál cliente quieres mirar?", { figs }).length === 0;
    });

  // (e2) la regla de la brecha del negocio, vaciada: el 8,6 de Lider vestido de negocio pasa sin multa
  await carnada("regla «brecha-del-negocio-no-cierra» vaciada", "src/adi/agente/playbooks/margenEnRiesgo.js",
    [[/          if \(Math\.abs\(declarada - brechaReal\) > 0\.15\) \{/, "          if (false) {"]],
    async (Mut) => {
      initTenant(TENANT_DEMO);
      const figs = boletaDelPlaybook(margenEnRiesgo);
      const vivo = "Tu margen está 8,6 puntos por debajo del benchmark — el 25,1% promedio contra el 30,1% que el negocio declara como referencia.";
      return margenEnRiesgo.listaNotarial(vivo, { figs }).some((x) => x.regla === "brecha-del-negocio-no-cierra")
        && Mut.margenEnRiesgo.listaNotarial(vivo, { figs }).every((x) => x.regla !== "brecha-del-negocio-no-cierra");
    });

  // (g) la muestra envejecida: el composer cambia y el documento del owner sigue diciendo lo viejo
  await carnada("muestra desactualizada (documento que envejece en silencio)", "src/adi/agente/playbooks/margenEnRiesgo.js",
    [[/de tus clientes están bajo esa referencia\./, "de tus clientes están bajo esa marca de agua."]],
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
    /* (re-apuntada 2026-09-05: el detector creció con el léxico corto del censo — la carnada muta la línea que
     *  hoy decide el caso general; lo que mide es lo mismo, que un TEMA abierto de par en par secuestre) */
    [[/    if \(_TEMA_MARGEN\.test\(q\) && _PIDE_LECTURA\.test\(q\)\) return true;/, "    return true;"]],
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
    /* re-apuntada (T3, 2026-09-05): la guarda se partió en dos —la simulación por un lado, la forma de pedir
     * por otro, ahora con la pregunta corta— y la carnada muta la mitad que retira las simulaciones, que es
     * lo que este candado vigila. */
    [[/  if \(_FUERA\.test\(q\)\) return null;/, "  if (false) return null;   // CARNADA: la simulación deja de retirarse"]],
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
  // (re-apuntada 2026-09-02: el positivo va SIN signo desde que el «+» también rompía el parser — la carnada
  // muta el signo NEGATIVO al «−» tipográfico, que es el caso que siempre cazó)
  await carnada("el signo del delta con el «−» tipográfico", "src/adi/agente/playbooks/entidadPorPeriodo.js",
    [[/const signo = pct >= 0 \? "" : "-";/, 'const signo = pct >= 0 ? "" : "\\u2212";']],
    async (Mut) => !_juzgaDirecto(_componeB(Mut)).ok);
  // (H) `_caso` sin exigir serie REAL: el playbook reclama también la bloqueada y compite con el puente
  await carnada("entidad×período reclama la serie bloqueada (compite con el puente)", "src/adi/agente/playbooks/entidadPorPeriodo.js",
    /* (re-apuntada 2026-09-05: el playbook ahora SÍ toma la serie bloqueada, pero SOLO en la forma que el
     *  puente no puede ver —la entidad sin período— y para declinar honesto. La carnada muta la guarda que
     *  mantiene esa separación: sin ella, reclama también la forma CON período y le pisa el turno al puente,
     *  que es exactamente lo que este candado existe para impedir.) */
    [[/  if \(sinPeriodo\) return \{ \.\.\.det, sinSerie: true, motivoSerie: \(estado && estado\.motivo\) \|\| null \};/,
      "  return { ...det, sinSerie: true };   // CARNADA: reclama también la que es del puente"]],
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

  /* ── LAS DE COBRANZA ────────────────────────────────────────────────────────────────────────────────────── */
  const PACK_COB = ingestarPlantilla(Buffer.from(plantillaEjemplo()), { nombreArchivo: "v2.xlsx", fechaCarga: "2026-08-31" }).dataset;
  // (M) LA REGLA DEL OWNER, mutada en la HERRAMIENTA: sin plazo, emitir «Saldo vencido · total = $0». El check
  //     «ninguna fig de vencido sin plazo» y el candado del composer existen para exactamente esto.
  await carnada("la herramienta emite un vencido de $0 sin plazo declarado", "src/adi/agente/herramientasAgente.js",
    [[/  const vencidoCalculable = !!\(kX && kX\.valor && kX\.valor !== "—"\);/,
      '  const vencidoCalculable = true; if (kX && kX.valor === "—") kX.valor = "$0";   // CARNADA: el cero inventado']],
    async (Mut) => {
      initTenant(PACK_COB);
      const b = Mut.cobranza({}, { scenario: "bonanza" }).boleta;
      return b.some((f) => /vencido/i.test(String(f.label)));   // el defecto: la fig de vencido existe sin plazo
    });
  // (N) la regla «vencido-inventado» vaciada: «$0 vencido» vuelve a pasar la lista notarial
  await carnada("«$0 vencido» deja de multarse", "src/adi/agente/playbooks/cobranza.js",
    [[/    if \(!hayVencidoCalculado && \/vencid/, "    if (false && /vencid"]],
    async (Mut) => {
      initTenant(PACK_COB);
      const figs = boletaDelPlaybook(Mut.cobranza, "bonanza", "quién me debe y qué está vencido");
      return !Mut.cobranza.listaNotarial("El saldo vencido es $0: nadie está en mora.", { figs, pregunta: "quién me debe y qué está vencido" })
        .some((x) => x.regla === "vencido-inventado");
    });
  // (O) `_FUERA` vaciado: «capital frenado» —que no es deuda de nadie— queda secuestrado por el cobro
  await carnada("cobranza secuestra el capital frenado del inventario", "src/adi/agente/playbooks/cobranza.js",
    [[/  if \(!q\.trim\(\) \|\| _FUERA\.test\(q\)\) return null;/, "  if (!q.trim()) return null;   // CARNADA"]],
    async (Mut) => Mut.cobranza.cuandoAplica("qué SKU tienen capital frenado y cuánta plata vencida hay ahí"));

  /* ── LOS 4 DE ASESORÍA (owner 2026-09-01) · la carnada de no-secuestro obligatoria de CADA uno, más las dos
   * promesas nuevas (el veredicto contra el signo del dato, y la medida rota que no sale a pantalla). ── */
  // (P) C sin su _FUERA: secuestra una pregunta de período puntual que su lectura (YoY del período) no responde
  await carnada("caída-de-ventas secuestra el período puntual («el último mes»)", "src/adi/agente/playbooks/asesoria.js",
    /* re-apuntada (T3, 2026-09-05): `cuandoAplica` delega en `_casoVentas`, y es ahí donde vive la guarda que
     * mantiene fuera el período puntual. Se muta la línea que ahora la sostiene. */
    [[/  if \(_SIMULA\.test\(q\) \|\| _DEUDA\.test\(q\) \|\| _C_FUERA\.test\(q\)\) return null;/, "  if (_SIMULA.test(q) || _DEUDA.test(q)) return null;   // CARNADA"]],
    async (Mut) => Mut.lecturaDeVentas.cuandoAplica("cuánto cayó la venta el último mes")
      && !PLAYBOOKS.find((p) => p.nombre === "lectura-de-ventas").cuandoAplica("cuánto cayó la venta el último mes"));
  // (Q) B sin exigir la señal de asesoría: le roba a lectura-por-eje su pregunta de siempre
  await carnada("inventario-inmovilizado le roba a lectura-por-eje el «qué SKU tienen capital frenado»", "src/adi/agente/playbooks/asesoria.js",
    [[/return _B_TEMA\.test\(q\) && _B_ESTADO\.test\(q\) && _B_ASESORIA\.test\(q\);/, "return _B_TEMA.test(q) && _B_ESTADO.test(q);   // CARNADA"]],
    async (Mut) => Mut.inventarioInmovilizado.cuandoAplica("qué SKU tienen capital frenado")
      && !PLAYBOOKS.find((p) => p.nombre === "inventario-inmovilizado").cuandoAplica("qué SKU tienen capital frenado"));
  // (R) D sin su _FUERA: se mete con el eje cliente, que no es suyo
  await carnada("oportunidad-de-precio se mete con el eje cliente", "src/adi/agente/playbooks/asesoria.js",
    [[/if \(_SIMULA\.test\(q\) \|\| _DEUDA\.test\(q\) \|\| _D_FUERA\.test\(q\)\) return false;/, "if (_SIMULA.test(q) || _DEUDA.test(q)) return false;   // CARNADA"]],
    async (Mut) => Mut.oportunidadDePrecio.cuandoAplica("a qué clientes conviene subir los precios")
      && !PLAYBOOKS.find((p) => p.nombre === "oportunidad-de-precio").cuandoAplica("a qué clientes conviene subir los precios"));
  // (S) A sin retirarse ante entidad×período: compite con el puente por su pregunta
  await carnada("cliente-perdiendo compite con el puente por la entidad×período", "src/adi/agente/playbooks/asesoria.js",
    [[/    if \(detectSerieIntent\(q\)\) return false;   \/\/ «cuánto cayó Falabella el último mes» es del puente/, "    // CARNADA: sin el retiro"]],
    async (Mut) => {
      initTenant(TENANT_DEMO);   // serieIntent resuelve entidades DEL TENANT: «Falabella» existe en el demo, no en el pack del cobro
      const q = "el cliente Falabella viene cayendo: ¿cuánto le vendí el último mes?";   // serieIntent la reclama (medido)
      return Mut.clientePerdiendoContribucion.cuandoAplica(q)
        && !PLAYBOOKS.find((p) => p.nombre === "cliente-perdiendo-contribucion").cuandoAplica(q);
    });
  // (T) la regla «caida-inventada» vaciada: decir «caen» con la lectura publicada subiendo deja de multarse
  await carnada("«tus ventas caen» con el dato subiendo deja de multarse", "src/adi/agente/playbooks/asesoria.js",
    [[/      if \(diceCae && !caeDato\) v\.push\(\{ regla: "caida-inventada"/, "      if (false) v.push({ regla: \"caida-inventada\""]],
    async (Mut) => !Mut.lecturaDeVentas.listaNotarial("Tus ventas caen fuerte este año.", { figs: [{ label: "headline", value: "7.6%", raw: 7.6 }] })
      .some((x) => x.regla === "caida-inventada"));
  // (U) el guardián de la medida rota desarmado: la «Medida cerrar brecha» 1000× la venta saldría a pantalla
  await carnada("la Medida 1000× la venta del SKU sale a pantalla", "src/adi/agente/playbooks/asesoria.js",
    [[/      const medidaOk = mf && vf && Number\.isFinite\(_num\(mf\)\) && Number\.isFinite\(_num\(vf\)\) && _num\(mf\) <= _num\(vf\);/, "      const medidaOk = !!mf;   // CARNADA"]],
    async (Mut) => {
      const figs = [
        { label: "Benchmark de margen", value: "30.1%", raw: 30.1 }, { label: "SKU bajo el benchmark", value: "1", raw: 1 },
        { label: "ELE-CAB25 · Margen", value: "19.8%", raw: 19.8 }, { label: "ELE-CAB25 · Venta", value: "$9.1M", raw: 9100000 },
        { label: "ELE-CAB25 · Medida cerrar brecha", value: "$937.8M", raw: 937800000 },
      ];
      const conCarnada = Mut.oportunidadDePrecio.componer({ figs, pregunta: "dónde tengo oportunidad de precio" });
      const real = PLAYBOOKS.find((p) => p.nombre === "oportunidad-de-precio").componer({ figs, pregunta: "dónde tengo oportunidad de precio" });
      return /\$937\.8M/.test(String(conCarnada)) && !/\$937\.8M/.test(String(real));
    });

  /* ── LOS 2 DE LA CERTIFICACIÓN (owner 2026-09-02) · no-secuestro en las DOS direcciones + sus promesas ── */
  // (V) el límite sin el cruce con el estado del dato: en el DEMO (donde nadie declara nada) inventaría el límite
  await carnada("limite-honesto inventa un límite que el dato no declara", "src/adi/agente/playbooks/limiteHonesto.js",
    [[/    if \(_PDV\.test\(q\)\) return _estadoPdv\(q\) !== null;      \/\/ solo si el DATO declara el límite; en el demo se retira/, "    if (_PDV.test(q)) return true;   // CARNADA"]],
    async (Mut) => {
      initTenant(TENANT_DEMO);
      const q = "por punto de venta, ¿quién queda bajo el plan?";
      return Mut.limiteHonesto.cuandoAplica(q) && !PLAYBOOKS.find((p) => p.nombre === "limite-honesto").cuandoAplica(q);
    });
  // (W) la trampa en la dirección INVERSA: el detector ensanchado con «venta» le roba a caída-de-ventas su turno
  await carnada("limite-honesto secuestra la caída de ventas (detector ancho)", "src/adi/agente/playbooks/limiteHonesto.js",
    [[/const _TRIM = \/\\bq\[1-4\]\\s\*\(\?:vs\\\.\?\|contra\|y\|-\)\\s\*q\[1-4\]\\b\|\\btrimestre\[s\]\?\\b\|\\btrimestral\(\?:es\)\?\\b\/i;/,
      "const _TRIM = /\\bq[1-4]\\s*(?:vs\\.?|contra|y|-)\\s*q[1-4]\\b|\\btrimestre[s]?\\b|\\btrimestral(?:es)?\\b|\\bventa[s]?\\b/i;   // CARNADA"]],
    async (Mut) => {
      const q = "se me está cayendo la venta, ¿dónde?";
      return Mut.limiteHonesto.cuandoAplica(q) && !PLAYBOOKS.find((p) => p.nombre === "limite-honesto").cuandoAplica(q);
    });
  // (X) la regla del menú de labels vaciada: el rescate de T6/T11 volvería a pasar sin multa
  await carnada("el menú de labels internos deja de multarse", "src/adi/agente/playbooks/limiteHonesto.js",
    [[/      v\.push\(\{ regla: "menu-de-labels",/, "      false && v.push({ regla: \"menu-de-labels\","]],
    async (Mut) => !Mut.limiteHonesto.listaNotarial("De este mismo turno también tengo Este año y Valor: dime cuál abro.", { figs: [], pregunta: "compara Q1 vs Q2" })
      .some((x) => x.regla === "menu-de-labels"));
  // (Y) «exactamente 3» vaciado: cinco riesgos numerados pasarían como síntesis
  await carnada("la síntesis inflada (4+ riesgos) deja de multarse", "src/adi/agente/playbooks/sintesisEjecutiva.js",
    [[/    if \(enumerados\.length > 3\) \{/, "    if (false) {"]],
    async (Mut) => !Mut.sintesisEjecutiva.listaNotarial("1 · riesgo $1M.\n2 · riesgo $2M.\n3 · riesgo $3M.\n4 · riesgo $4M.", { figs: [] })
      .some((x) => x.regla === "sintesis-inflada"));

  /* ── LAS DE T3 (2026-09-05) ─────────────────────────────────────────────────────────────────────────────── */
  // (V) la lectura de ventas sin su guardia de entidad: contesta el total del negocio a quien preguntó por una cuenta
  await carnada("la lectura de ventas se lleva «las ventas de Falabella»", "src/adi/agente/playbooks/asesoria.js",
    [[/  if \(nombraEntidad\(q\)\) return null;/, "  // CARNADA: el guardia anti-secuestro, desarmado"]],
    async (Mut) => { initTenant(TENANT_DEMO); return Mut.lecturaDeVentas.cuandoAplica("cómo van las ventas de Falabella"); });

  // (W) el recorte del inventario deja de declararse: un ranking de lo frenado se lee como si fuera todo el stock
  await carnada("el inventario recortado se sirve como si fuera el stock entero", "src/adi/agente/playbooks/lecturaPorEje.js",
    [[/      partes\.push\(`De tu inventario, lo que este dato publica es el capital que quedó frenado — no una foto del stock completo\.`\);/,
      "      /* CARNADA: el recorte se calla */"]],
    async (Mut) => {
      initTenant(TENANT_DEMO);
      const FIGS = [
        { label: "LG-DRYER8KG · Capital frenado", value: "$14K", raw: 13600 },
        { label: "BOS-SANDER · Capital frenado", value: "$11K", raw: 11000 },
        { label: "LG-DRYER8KG · Rotación", value: "1" }, { label: "BOS-SANDER · Rotación", value: "2" },
      ];
      const t = String(Mut.lecturaPorEje.componer({ figs: FIGS, pregunta: "cómo está el inventario" }) || "");
      /* el composer TIENE que haber respondido: si devolvió vacío, la carnada no probó nada y debe fallar */
      return /capital frenado por SKU/i.test(t) && !/no una foto del stock completo/.test(t);
    });

  // (X) el eje cliente sin exigir la métrica: «mis clientes» a secas se convierte en un ranking de venta
  await carnada("el eje cliente se activa sin que la pregunta diga por cuál métrica", "src/adi/agente/playbooks/lecturaPorEje.js",
    [[/  \{ eje: "cliente", re: new RegExp\(`[^`]+`, "i"\),/, '  { eje: "cliente", re: /\\bclientes?\\b/i,   // CARNADA: le alcanza con la palabra']],
    async (Mut) => { initTenant(TENANT_DEMO); return Mut.lecturaPorEje.cuandoAplica("qué clientes están mal"); });
  initTenant(TENANT_DEMO);

  for (const f of tmp) { try { fs.unlinkSync(f); } catch { /* */ } }
}

initTenant(TENANT_DEMO);
console.log(`\n── _agente_playbooks_gate: ${pass} PASS · ${fail} FAIL (de ${pass + fail}) ──`);
process.exit(fail ? 1 : 0);
