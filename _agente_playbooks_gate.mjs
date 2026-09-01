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
import { cajaDelAgente } from "./src/adi/agente/herramientasAgente.js";

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
    for (const q of muestras) {
      const pasos = pasosDe(pb, q);
      ok(pasos.length > 0 && pasos.every((p) => p.tool && p.args && typeof p.para === "string" && p.para.length > 10),
        `…y cada paso declara herramienta, args y PARA QUÉ (${pasos.length} pasos${muestras.length > 1 ? ` · «${q.slice(0, 28)}»` : ""})`);
      ok(pasos.every((p) => !!cajaDelAgente(TOOLS)[p.tool]), "…y todas sus herramientas existen en la caja del agente");
    }
  }
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

  for (const f of tmp) { try { fs.unlinkSync(f); } catch { /* */ } }
}

initTenant(TENANT_DEMO);
console.log(`\n── _agente_playbooks_gate: ${pass} PASS · ${fail} FAIL (de ${pass + fail}) ──`);
process.exit(fail ? 1 : 0);
