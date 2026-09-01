/* === _agente_bucle_gate.mjs · EL BUCLE DEL AGENTE, PROBADO CON GUIONES MALICIOSOS (F2 · owner 2026-08-30) ====
 *
 * El cerebro se INYECTA (`callAgente`): acá son GUIONES — el feliz y los que intentan romper el sistema. Lo que
 * este candado exige, en el orden del F1 §7:
 *   1 · FELIZ: una ronda de herramientas + cierre → boleta con figs → muro verde → route "agente";
 *   2 · MALICIOSO · cifra inventada → veto → UNA reparación con multa → verde reparado; si tampoco repara →
 *       escalera INVERTIDA (línea honesta con cifra verificada, JAMÁS el tablero);
 *   3 · herramienta inexistente → UNA corrección de contrato → si corrige, sigue; si insiste, quema rondas;
 *   4 · ronda infinita (el guion pide herramientas por siempre) → el TOPE corta: máx. 3 rondas + 1 cierre;
 *   5 · supuesto del usuario → entra a la boleta ETIQUETADO (`user_supuesto`) y la línea honesta NO lo puede
 *       citar como «verificado»;
 *   6 · topes de calls: 8 por ronda (cap de runPlan) y 12 por turno;
 *   7 · el respaldo de lo ya aprobado es el peldaño 2, y el genérico el último — el volcado de KPIs no existe
 *       en la escalera;
 *   8 · R2 (examen 1 del agente): la re-cita de lo aprobado — cifras que el muro YA aprobó a pantalla se
 *       re-autorizan al re-citarse; sin memoria (o con otra cifra) siguen muriendo;
 *   9 · R7 (examen 1): cada veto queda en el expediente con su sitio y su multa, y `figsEnBoleta` viaja al
 *       cerebro para que el adapter decida el tier (R-eco: escalar solo con material que reescribir);
 *   10 · R1 (examen 1): la ronda extra — el cierre o la reparación que piden una herramienta VÁLIDA la
 *        obtienen (una por turno) en vez de morir con el pedido descartado;
 *   11 · R4 (examen 1): el rescate proporcional — hasta 4 cifras verificadas del turno, la refutación del
 *        supuesto contradicho y el trato registrado, también en los peldaños.
 *
 *   12 · R6 (examen 1): leer antes de declinar — el empujón de verificación, UNO por turno;
 *   13 · R9 (examen 1): entidad×período bloqueada va al puente; con serie real, el cerebro corre;
 *   14 · lo que la CORRIDA 2 midió: P1b (la reparación nombra la cifra vetada) · P2 (reformular no dispara el
 *        empujón — 43× medido) · P3 (el hilo del cierre se poda, las cifras van todas) · P4 (la unidad del eco).
 *
 * ⚠️ CARNADAS (sección 15): cada garantía, probada ROJA mutando una copia del bucle vivo.
 *
 * OFFLINE · determinístico · cerebro = guion · la bandera ADI_AGENTE sigue APAGADA (esto prueba el módulo,
 * no lo enciende). `node --import ./scripts/offline-guard.mjs _agente_bucle_gate.mjs`
 */
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { initTenant } from "./src/data/tenantStore.js";
import { ESCENARIO_INICIAL } from "./src/config/scenarios.js";
import { cifrasDelDato } from "./src/adi/oracle/datoProyectado.js";   // la cifra de la prueba sale del DATO, jamás de un literal   // el MISMO escenario que arranca la app — medir en otro es medir otro negocio
import { TENANT_DEMO } from "./src/data/tenants/demo.js";
import { plantillaEjemplo } from "./src/ingesta/plantilla/generarPlantilla.js";
import { ingestarPlantilla } from "./src/ingesta/plantilla/ingestarPlantilla.js";
import { answerViaAgente, TECHO_ENTRADA_CIERRE_CHARS } from "./src/adi/agente/bucleAgente.js";
import { registrarSupuesto } from "./src/adi/agente/herramientasAgente.js";   // P4 · la unidad del eco
import { setNombreUsuario, olvidarNombreUsuario, getNombreUsuario } from "./src/adi/agente/preferenciaNombre.js";   // R4c · el trato en los rescates
import { PRINCIPIOS_RUTEO } from "./src/adi/agente/contratoAgente.js";   // P2(i) · la letra del ejemplo numérico
import { sistemaDelAgente } from "./src/adi/agente/sistemaAgente.js";

let pass = 0, fail = 0;
const ok = (cond, label, detalle) => {
  if (cond) { pass++; console.log(`  ✓ ${label}`); }
  else { fail++; console.log(`  ✗ ${label}`); if (detalle !== undefined) console.log(`      ${detalle}`); }
};
const H = (t) => console.log(`\n${t}`);
const PACK = ingestarPlantilla(Buffer.from(plantillaEjemplo()), { nombreArchivo: "v2.xlsx", fechaCarga: "2026-08-31" }).dataset;
const PREGUNTA = "cuanto me compro riachuelo el ultimo mes";
const TEXTO_BUENO = "Depósito Riachuelo te compró $22.560 en agosto 2026; en julio 2026 habían sido $24.029. La cuenta viene cediendo: vale mirarlo con él antes del cierre.";

/* ═══ 1 · EL GUION FELIZ ══════════════════════════════════════════════════════════════════════════════════════ */
H("1 · feliz: una ronda de herramientas + cierre → verde con boleta");
{
  initTenant(PACK);
  let llamadas = 0;
  const guion = async ({ ronda }) => {
    llamadas++;
    if (llamadas === 1) return { tipo: "herramientas", pedidos: [{ tool: "serieEntidad", args: { entity: "Depósito Riachuelo", metrica: "venta" } }] };
    return { tipo: "texto", texto: TEXTO_BUENO };
  };
  const r = await answerViaAgente({ text: PREGUNTA, history: [], mem: {}, scenario: ESCENARIO_INICIAL, callAgente: guion });
  ok(r.r.agente.estado === "verde", `el turno sale VERDE (${r.r.agente.estado})`);
  ok(llamadas === 2, `dos llamadas al cerebro: herramientas + cierre (${llamadas})`);
  ok(r.r.agente.figs === 2, `la boleta acumuló las figs de la serie (${r.r.agente.figs})`);
  ok(r.r.route === "agente" && r.r.text.includes("$22.560"), "route agente y la cifra verbatim en pantalla");
  ok(r.mem.ultimaAprobada === r.r.text, "lo aprobado queda en la memoria como último texto de verdad");
}

/* ═══ 2 · CIFRA INVENTADA → MURO ══════════════════════════════════════════════════════════════════════════════ */
H("2 · el guion malicioso inventa una cifra: veto → reparación → verde; sin reparar → escalera honesta");
{
  initTenant(PACK);
  /* ⚠️ EL GUION AHORA LEE ANTES DE HABLAR, y no es para que el gate pase. Antes afirmaba «$22.560 en agosto»
   * SIN correr una sola herramienta: un cerebro que acierta la cifra sin haberla leído sigue siendo un cerebro
   * que la inventó, y desde `cifra-sin-boleta` eso se multa (es el hueco del $800K del turno 7). El ciclo que
   * este bloque prueba —veto → UNA reparación → verde, y sin reparar la escalera honesta— no cambia: lo que
   * cambia es que el guion hace lo que haría el cerebro de verdad, leer y después narrar. */
  let reparo = 0;
  const guionRepara = async ({ ronda, attempt }) => {
    if (ronda === 1 && attempt === 0) return { tipo: "herramientas", pedidos: [{ tool: "serieEntidad", args: { entity: "Depósito Riachuelo", metrica: "venta" } }] };
    if (attempt === 1) { reparo++; return { tipo: "texto", texto: TEXTO_BUENO }; }
    return { tipo: "texto", texto: "Depósito Riachuelo te compró $99.9M el último mes — un récord histórico." };
  };
  const r1 = await answerViaAgente({ text: PREGUNTA, history: [], mem: {}, scenario: ESCENARIO_INICIAL, callAgente: guionRepara });
  ok(reparo === 1 && r1.r.agente.estado === "reparado", `la multa llegó y la reparación pasó (${r1.r.agente.estado})`);
  ok(!/99\.9M/.test(r1.r.text), "la cifra inventada jamás llega a pantalla");

  const guionTerco = async ({ ronda, attempt }) => {
    if (ronda === 1 && attempt === 0) return { tipo: "herramientas", pedidos: [{ tool: "serieEntidad", args: { entity: "Depósito Riachuelo", metrica: "venta" } }] };
    return { tipo: "texto", texto: "Depósito Riachuelo te compró $99.9M el último mes — un récord histórico." };
  };
  const r2 = await answerViaAgente({ text: PREGUNTA, history: [], mem: {}, scenario: ESCENARIO_INICIAL, callAgente: guionTerco });
  ok(r2.r.agente.estado === "limite", `terco en la mentira → escalera invertida, peldaño honesto (${r2.r.agente.estado})`);
  ok(!/99\.9M/.test(r2.r.text) && /verificado/.test(r2.r.text) && /\$2[24]\.\d{3}/.test(r2.r.text),
    "la línea honesta cita una cifra VERIFICADA de la boleta, no la inventada", r2.r.text);
  ok(r2.r.text.length < 400, `y es CORTA (${r2.r.text.length} chars) — el tablero no existe en la escalera`);
}

/* ═══ 3 · HERRAMIENTA INEXISTENTE ═════════════════════════════════════════════════════════════════════════════ */
H("3 · una herramienta que no existe recibe UNA corrección de contrato");
{
  initTenant(PACK);
  let vioCorreccion = false;
  const guion = async ({ mensajes, ronda }) => {
    if (ronda === 1) return { tipo: "herramientas", pedidos: [{ tool: "leerCorreoDelCliente", args: {} }] };
    vioCorreccion = mensajes.some((m) => /no existe/.test(m.content) && /catálogo/.test(m.content));
    if (ronda === 2) return { tipo: "herramientas", pedidos: [{ tool: "serieEntidad", args: { entity: "Depósito Riachuelo", metrica: "venta" } }] };
    return { tipo: "texto", texto: TEXTO_BUENO };
  };
  const r = await answerViaAgente({ text: PREGUNTA, history: [], mem: {}, scenario: ESCENARIO_INICIAL, callAgente: guion });
  ok(vioCorreccion, "el cerebro recibió el error de contrato con el catálogo completo");
  ok(r.r.agente.estado === "verde", "corrigió y el turno terminó verde");
}

/* ═══ 4 · RONDA INFINITA → EL TOPE CORTA ══════════════════════════════════════════════════════════════════════ */
H("4 · el guion que pide herramientas por siempre no cuelga a nadie");
{
  initTenant(PACK);
  let llamadas = 0;
  const guionInfinito = async () => { llamadas++; return { tipo: "herramientas", pedidos: [{ tool: "salesRead", args: {} }] }; };
  const r = await answerViaAgente({ text: PREGUNTA, history: [], mem: {}, scenario: ESCENARIO_INICIAL, callAgente: guionInfinito });
  /* ERA 4 (3 rondas + 1 cierre). R1 del examen 1 sumó UNA ronda extra cuando el cierre pide una herramienta
   * válida (acá salesRead lo es) + su re-cierre: 5 llamadas. El tope sigue DURO — la ronda extra es una sola. */
  ok(llamadas === 5, `el tope corta en 3 rondas + cierre + ronda extra con re-cierre = 5 llamadas (${llamadas})`);
  ok(r.r.agente.rondas === 3, `rondas de herramientas: 3 (${r.r.agente.rondas})`);
  ok(["limite", "respaldo", "vacio"].includes(r.r.agente.estado), `y el turno cae a la escalera (${r.r.agente.estado})`);
  ok(typeof r.r.text === "string" && r.r.text.length > 0 && r.r.text.length < 500, "con una respuesta corta, nunca una pantalla en blanco ni un tablero");
}

/* ═══ 5 · EL SUPUESTO DEL USUARIO, ETIQUETADO ═════════════════════════════════════════════════════════════════ */
H("5 · el supuesto entra etiquetado y la línea honesta no lo blanquea");
{
  initTenant(PACK);
  const guion = async ({ ronda }) => {
    if (ronda === 1) return { tipo: "herramientas", pedidos: [{ tool: "registrarSupuesto", args: { texto: "el cliente dice que comprará el doble", cifra: 45120 } }] };
    return { tipo: "herramientas", pedidos: [{ tool: "toolInexistenteBisBis", args: {} }] };   // fuerza la escalera con SOLO el supuesto en la boleta
  };
  const r = await answerViaAgente({ text: "registra que riachuelo dice que comprará el doble", history: [], mem: {}, scenario: ESCENARIO_INICIAL, callAgente: guion });
  ok(r.r.agente.figs === 1, "el supuesto quedó en la boleta como fig");
  ok(!/verificado: Supuesto/.test(r.r.text) && !/45\.120/.test(r.r.text),
    "★ la línea honesta NO cita el supuesto como «verificado» — un supuesto no se blanquea", r.r.text);
}

/* ═══ 6 · LOS TOPES DE CALLS ══════════════════════════════════════════════════════════════════════════════════ */
H("6 · 8 calls por ronda · 12 por turno");
{
  initTenant(PACK);
  const veinte = Array.from({ length: 20 }, () => ({ tool: "salesRead", args: {} }));
  let resumen = null;
  const guion = async ({ mensajes, ronda }) => {
    if (ronda === 1) return { tipo: "herramientas", pedidos: veinte };
    resumen = mensajes.filter((m) => /HERRAMIENTAS/.test(m.content)).length;
    return { tipo: "texto", texto: "Va una lectura corta del negocio con lo disponible." };
  };
  const r = await answerViaAgente({ text: "leeme todo", history: [], mem: {}, scenario: ESCENARIO_INICIAL, callAgente: guion });
  ok(r.r.agente.calls === 8, `de 20 pedidos corrieron 8 — el cap por ronda (${r.r.agente.calls})`);

  const guionTresRondas = async ({ ronda }) => {
    if (ronda <= 3) return { tipo: "herramientas", pedidos: Array.from({ length: 8 }, () => ({ tool: "salesRead", args: {} })) };
    return { tipo: "texto", texto: "Cierro con lo disponible." };
  };
  const r2 = await answerViaAgente({ text: "leeme todo", history: [], mem: {}, scenario: ESCENARIO_INICIAL, callAgente: guionTresRondas });
  ok(r2.r.agente.calls <= 12, `el turno entero no pasa de 12 calls (${r2.r.agente.calls})`);
}

/* ═══ 7 · LOS PELDAÑOS 2 Y 3 ══════════════════════════════════════════════════════════════════════════════════ */
H("7 · respaldo de lo ya aprobado y genérico — el tablero no existe");
{
  initTenant(PACK);
  const mudo = async () => ({ tipo: "texto", texto: "" });
  const conRespaldo = await answerViaAgente({ text: "seguime con eso", history: [], mem: { ultimaAprobada: TEXTO_BUENO }, scenario: ESCENARIO_INICIAL, callAgente: mudo });
  ok(conRespaldo.r.agente.estado === "respaldo" && conRespaldo.r.text.includes("$22.560"),
    "sin herramientas ni texto, el peldaño 2 ofrece lo YA aprobado del hilo", conRespaldo.r.agente.estado);
  const sinNada = await answerViaAgente({ text: "seguime con eso", history: [], mem: {}, scenario: ESCENARIO_INICIAL, callAgente: mudo });
  ok(sinNada.r.agente.estado === "vacio" && sinNada.r.text.length > 0 && sinNada.r.text.length < 300,
    "sin nada, el genérico pelado — nunca ~12 KPIs", `${sinNada.r.agente.estado} · ${sinNada.r.text.length} chars`);

  /* R3 DEL EXAMEN 1 (2026-08-31): PERTINENCIA. T13 sirvió la respuesta de Tottus a una pregunta por Falabella
   * como «lo que ya te respondí sobre esto quedó verificado» — afirmación falsa con entidad equivocada. */
  const otraEntidad = await answerViaAgente({ text: "que hago con Ferretería Aurora?", history: [], mem: { ultimaAprobada: TEXTO_BUENO }, scenario: ESCENARIO_INICIAL, callAgente: mudo });
  ok(otraEntidad.r.agente.estado === "respaldo" && !/sobre esto quedó verificado/.test(otraEntidad.r.text)
    && /Lo último que dejamos verificado fue sobre Depósito Riachuelo/.test(otraEntidad.r.text) && otraEntidad.r.text.includes("$22.560"),
    "★ R3: pregunta por OTRA entidad → el replay viaja bajo un marco VERAZ («fue sobre Depósito Riachuelo»)", otraEntidad.r.text.slice(0, 160));

  /* T26: lo aprobado ES lo que el usuario acaba de ver → jamás la misma pantalla dos veces seguidas.
   * ⚠️ LA CONDUCTA CAMBIÓ CON C1 (corrida 3, 2026-08-31): acá el peldaño devolvía una FRASE FIJA, y esa frase
   * resultó ser la «disculpa vacía» que el owner marcó — su condición es verdadera después de CUALQUIER turno
   * aprobado, así que cuatro familias distintas recibían la misma cadena. Ahora CEDE al peldaño siguiente: la
   * garantía medida sigue siendo la misma (no repetir la pantalla), sin molde que repetir ni contagiar. */
  const repetida = await answerViaAgente({ text: "seguime con eso", history: [], mem: { ultimaAprobada: TEXTO_BUENO, recentNarrations: [TEXTO_BUENO] }, scenario: ESCENARIO_INICIAL, callAgente: mudo });
  ok(!repetida.r.text.includes("$22.560") && repetida.r.text.trim() !== TEXTO_BUENO.trim(),
    "★ R3: la pantalla que el usuario acaba de ver NO se le sirve de nuevo", repetida.r.text.slice(0, 120));
  ok(!/sigue verificado y en pie — dime qué parte profundizo/.test(repetida.r.text),
    "★ C1: y la frase de molde que producía la «disculpa vacía» ya no existe");
}

/* ═══ 8 · LA RE-CITA DE LO APROBADO (R2 del examen 1 · 2026-08-31) ════════════════════════════════════════════
 * EL DEFECTO MEDIDO: `mem.recitaAprobada` jamás se escribía en modo agente (contador 0 en los 28 turnos) — el
 * borrador de T13 re-citaba el $194K de Falabella APROBADO en T9 y el muro lo mató como «no autorizada». Raíz
 * de la mayoría de los turnos no-verdes. El cable es el MISMO del camino natural: nada nuevo que calibrar. */
/* ═══ 8b · EL PELDAÑO SIRVE LO QUE EL TURNO FUE A BUSCAR (T2, certificación 2026-09-01) ══════════════════════
 * `mandatory` nombraba DOS conceptos: en el contrato de la boleta es «hay que citarla»; este peldaño lo leía
 * como «es la mejor para rescatar». La tool `proyectar` lo dejó a la vista — la base es obligatoria (dato) y
 * la proyección no (un supuesto no se exige), las dos con razón — y ante una pregunta de proyección el peldaño
 * servía la BASE y ofrecía la respuesta: «también tengo Proyección: dime cuál abro». Enumeraba en vez de
 * servir. La separación, no la inversión: el peldaño gana su criterio (`source` de resultado) y `mandatory`
 * conserva el suyo dentro de cada grupo. */
H("8b · el rescate sirve el RESULTADO del turno, no su insumo");
{
  initTenant(TENANT_DEMO);
  // un veto NO podable (una sola oración) fuerza al peldaño a elegir qué servir
  const guion = async ({ ronda }) => (ronda === 1
    ? { tipo: "herramientas", pedidos: [{ tool: "proyectar", args: { tasa: 3, horizonte: "12 meses" } }] }
    : { tipo: "texto", texto: "Falabella creció $77.7M este año." });
  /* la pregunta NO lleva «%» a propósito: con «crezco 3%» el playbook proyección-declarada (C) toma el turno y
   * compone antes de que exista el peldaño — este bloque mide el PELDAÑO, así que la pregunta se queda sin
   * supuesto (C se retira) y el guion sigue trayendo la proyección a la boleta. Re-apuntado el 2026-09-01. */
  const r = await answerViaAgente({ text: "cuanto seria mi venta si crece el año que viene?",
    history: [], mem: {}, scenario: ESCENARIO_INICIAL, callAgente: guion });
  ok(r.r.agente.estado === "limite", `el turno cae al peldaño honesto (${r.r.agente.estado}) — el veto no es podable`);
  ok(/Proyección/.test(r.r.text) && /\$103\.0M/.test(r.r.text),
    "★ y sirve LA PROYECCIÓN, que es lo que el usuario pidió — antes servía la base y ofrecía esto", r.r.text.slice(0, 130));
  ok(!/tengo Proyección: dime cuál abro/.test(r.r.text), "…ya no la ENUMERA como alternativa: la entrega");
}

/* ═══ 8c · EL TRATO SE REGISTRA SOLO (T1, certificación 2026-09-01) ══════════════════════════════════════════
 * Medido en el expediente: `mem.nombreUsuario` quedó `undefined` en los OCHO turnos. El usuario abrió con
 * «llamame jc de ahora en adelante» y el cerebro escribió «JC,» en su prosa —lo leyó de la pregunta— pero
 * NUNCA llamó a `preferenciaNombre`, así que el playbook (determinístico) salió sin trato. El cableado estaba
 * bien; faltaba el registro. Se hace en el motor y no en la letra: una instrucción al modelo es una promesa,
 * esto es un hecho. */
H("8c · «llamame jc» queda registrado sin depender de que el cerebro llame la herramienta");
{
  const guionMudo = async ({ ronda }) => (ronda === 1
    ? { tipo: "herramientas", pedidos: [{ tool: "marginRead", args: { focus: "bajo_benchmark", dimension: "cliente" } }] }
    : { tipo: "texto", texto: "" });
  for (const [q, esperado] of [
    ["llamame jc de ahora en adelante. como viene mi margen?", "jc"],
    ["llámame Ana. dame el margen", "Ana"],
    ["me llamo Roberto, como viene?", "Roberto"],
    ["como viene mi margen?", null],
    /* ⚠️ «dime» NO es un trato (cazado en la sonda del playbook C): «…y dime cuánto genera» registraba «cuánto»
     * y «dime si alguno queda» registraba «si» — la respuesta salía «cuánto: Sobre tu venta…». */
    ["Con ese total anual, proyecta 12 meses con +4% y dime cuánto genera adicional.", null],
    ["simula reducir 2 puntos y dime si alguno queda sobre el benchmark", null],
  ]) {
    olvidarNombreUsuario();
    initTenant(TENANT_DEMO);
    const r = await answerViaAgente({ text: q, history: [], mem: {}, scenario: ESCENARIO_INICIAL, callAgente: guionMudo });
    const reg = getNombreUsuario();
    ok(reg === esperado, `★ «${q.slice(0, 34)}…» → trato ${JSON.stringify(esperado)} (obtuvo ${JSON.stringify(reg)})`);
    if (esperado) ok(r.mem.nombreUsuario === esperado, `…y viaja en la memoria del turno (${JSON.stringify(r.mem.nombreUsuario)})`);
  }
  // el punto de fin de oración NO es parte del nombre: «llámame Ana.» registraba «Ana.» y salía «Ana.: …»
  olvidarNombreUsuario();
  initTenant(TENANT_DEMO);
  await answerViaAgente({ text: "llámame Ana. dame el margen", history: [], mem: {}, scenario: ESCENARIO_INICIAL, callAgente: guionMudo });
  ok(getNombreUsuario() === "Ana", `★ y sin la puntuación pegada (${JSON.stringify(getNombreUsuario())}) — el trato no lleva el punto de la frase`);
  olvidarNombreUsuario();
}

H("8 · la re-cita: lo aprobado presta sus cifras al turno siguiente");
{
  /* Los MISMOS textos de _recita_aprobada_gate (el gate del cable original): $104.0M es una PROYECCIÓN
   * calculada a la vista — no vive en el dato proyectado, así que la única fuente que puede re-autorizarla
   * en el turno 2 es la re-cita. (Una cifra REAL del dato no sirve de prueba: la quinta fuente la autoriza
   * sola, con o sin memoria — la lección del refutado B-grieta-2 del expediente.) Mecánica, no literales. */
  initTenant(TENANT_DEMO);
  const Q1 = "Si subo ventas 4%, ¿qué cambia?";
  /* ⚠️ EL TURNO 1 AHORA DECLARA SU CUENTA, y no es un ajuste para que el gate pase: es la conducta que la casa
   * pide desde que existe `cifra-sin-boleta`. Antes hacía la cuenta EN PROSA con la boleta vacía, que es
   * exactamente el hueco por el que salió el $800K del turno 7 de la certificación. El camino para una cifra
   * derivada es el bloque [[CALCULO]] —el mecanismo del owner, 2026-08-14—: guardC lo RECOMPUTA y, si cierra
   * con insumos autorizados, autoriza el resultado. Medido acá: en prosa el turno cae a `vacio`; declarado
   * sale VERDE y acumula la re-cita igual. Lo que este bloque prueba —el cable de la re-cita— no cambió; lo
   * que cambió es que el vehículo ahora muestra el trabajo. */
  /* ⚠️ Y LA BASE SALE DEL DATO, NO DE UN LITERAL. Acá decía «$100.0M» escrito a mano, y funcionaba solo porque
   * el gate corría con `scenario: "actual"` — que NO es un escenario declarado (`scenarios.js:14`) y cae al
   * dato crudo. Con el escenario REAL de la app la venta total del negocio es otra, así que el literal dejaba
   * de existir y el bloque medía un negocio que el producto no sirve. Se toma la cifra TAL COMO el dato la
   * publica; el resultado de la cuenta se deriva de ella. */
  const _totalNegocio = (cifrasDelDato(ESCENARIO_INICIAL).figs || []).find((f) => /^money:/.test(String(f.canon))
    && Array.isArray(f.duenos) && f.duenos.includes("negocio") && f.duenos.includes("total")
    && !f.duenos.includes("anterior"));   // la del PERÍODO, no la del año anterior
  ok(!!_totalNegocio, "el dato publica el total del negocio con el que se arma la prueba", JSON.stringify(_totalNegocio));
  const BASE = String(_totalNegocio.value);
  const PROY = `$${((Number(BASE.replace(/[^\d.]/g, "")) * 1.04)).toFixed(1)}M`;
  const T1 = `Ventas totales del negocio: ${BASE} proyectados × 1.04 = ${PROY}. Es una proyección con tu supuesto.\n\n[[CALCULO]]\nid=c1 · op=aplicar_pct · inputs=${BASE}; 4% · formula=${BASE} + 4% · resultado=${PROY} · unidad=money\n`;
  const t1 = await answerViaAgente({ text: Q1, history: [], mem: {}, scenario: ESCENARIO_INICIAL, callAgente: async () => ({ tipo: "texto", texto: T1 }) });
  const nRecita = ((t1.mem.recitaAprobada || {}).figs || []).length;
  ok(t1.r.agente.estado === "verde" && nRecita >= 2, `el turno verde ACUMULA la re-cita (${nRecita} cifras con dueño)`);

  // turno 2: cero herramientas y boleta vacía, re-citando la proyección aprobada — el caso EXACTO de T13/T24
  const HILO = [{ role: "user", text: Q1 }, { role: "adi", text: t1.r.text }];
  const RE_OK = `Sobre las ventas totales del negocio, esa proyección de ${PROY} sigue en pie con tu supuesto.`;
  const guionRecita = async () => ({ tipo: "texto", texto: RE_OK });
  const t2 = await answerViaAgente({ text: "y entonces en cuanto quedan las ventas?", history: HILO, mem: t1.mem, scenario: ESCENARIO_INICIAL, callAgente: guionRecita });
  ok(t2.r.agente.estado === "verde" && t2.r.text.includes(PROY),
    `★ re-citar una cifra YA aprobada con boleta vacía es VERDE (${t2.r.agente.estado}) — la raíz de T13/T24, cerrada`);
  ok(t2.r.agente.recitaCifras >= 2, `y el veredicto declara la memoria que usó (${t2.r.agente.recitaCifras} cifras)`);

  // contraprueba 1: sin memoria, el MISMO texto muere — la re-cita no es un pase libre
  const t2sin = await answerViaAgente({ text: "y entonces en cuanto quedan las ventas?", history: HILO, mem: {}, scenario: ESCENARIO_INICIAL, callAgente: guionRecita });
  ok(t2sin.r.agente.estado !== "verde" && !t2sin.r.text.includes(PROY),
    `sin memoria el mismo texto NO pasa (${t2sin.r.agente.estado}) — autoriza la memoria, no la frase`);

  // contraprueba 2: una cifra que NADIE aprobó muere aunque la memoria exista
  const guionOtra = async () => ({ tipo: "texto", texto: "Sobre las ventas totales del negocio, esa proyección de $117.0M sigue en pie con tu supuesto." });
  const t3 = await answerViaAgente({ text: "y entonces?", history: HILO, mem: t1.mem, scenario: ESCENARIO_INICIAL, callAgente: guionOtra });
  ok(t3.r.agente.estado !== "verde" && !/117\.0M/.test(t3.r.text),
    "una cifra que nadie aprobó sigue muriendo — la re-cita autoriza lo aprobado, no lo parecido");
}

/* ═══ 9 · EL EXPEDIENTE VE LOS VETOS (R7 del examen 1) + figsEnBoleta AL CEREBRO (R-eco) ══════════════════════
 * EL DEFECTO MEDIDO: los 28 veredictos del examen decían «vetos: ninguno» con 14 turnos reintentando por
 * guard — el post-mortem quedó a ciegas justo donde dolía. Y la escalada de modelo en el cierre fue 66% del
 * gasto con CERO verdes: el adapter necesita saber si hay boleta antes de pagar un tier mejor. */
H("9 · cada veto con su sitio y su multa · figsEnBoleta viaja al cerebro");
{
  initTenant(PACK);
  const figsVistas = [];
  const guionTerco2 = async ({ ronda, attempt, figsEnBoleta }) => {
    figsVistas.push(figsEnBoleta);
    if (ronda === 1 && attempt === 0) return { tipo: "herramientas", pedidos: [{ tool: "serieEntidad", args: { entity: "Depósito Riachuelo", metrica: "venta" } }] };
    return { tipo: "texto", texto: "Depósito Riachuelo te compró $99.9M el último mes — un récord histórico." };
  };
  const r = await answerViaAgente({ text: PREGUNTA, history: [], mem: {}, scenario: ESCENARIO_INICIAL, callAgente: guionTerco2 });
  const vetos = r.r.agente.vetos || [];
  ok(vetos.length >= 2 && vetos.every((v) => typeof v === "string" && v.includes(" · ")),
    `los vetos quedan registrados con sitio y multa (${vetos.length})`, JSON.stringify(vetos));
  ok(vetos.some((v) => v.startsWith("cierre ·")) && vetos.some((v) => v.startsWith("reparacion ·")),
    "…nombrando el sitio: cierre y reparación", JSON.stringify(vetos));
  ok(figsVistas[0] === 0 && figsVistas[1] === 2,
    `figsEnBoleta llega al cerebro en cada llamada: ${JSON.stringify(figsVistas)} (0 antes de la ronda · 2 después)`);
}

/* ═══ 10 · LA RONDA EXTRA (R1 del examen 1 · 2026-08-31) ══════════════════════════════════════════════════════
 * EL DEFECTO MEDIDO: cuando el reintento post-veto o el cierre pedían una herramienta VÁLIDA, el pedido se
 * descartaba y el turno moría — T7 quedó VACÍO pidiendo inventoryStatus (el natural sacó verde el mismo
 * Pareto); mismo patrón en T13/T24/T26 — 11 de los 14 turnos no-verdes. UNA ronda extra por turno lo cierra. */
H("10 · la ronda extra: el cierre que pide una herramienta válida la obtiene");
{
  initTenant(PACK);
  // (a) el espejo de T7 — la REPARACIÓN pide la herramienta: se ejecuta y el re-cierre sale con cifra verificada
  let llamadasA = 0;
  const guionT7 = async ({ attempt, figsEnBoleta }) => {
    llamadasA++;
    if (attempt === 0) return { tipo: "texto", texto: "Depósito Riachuelo te compró $99.9M el último mes — un récord histórico." };
    if (figsEnBoleta === 0) return { tipo: "herramientas", pedidos: [{ tool: "serieEntidad", args: { entity: "Depósito Riachuelo", metrica: "venta" } }] };
    return { tipo: "texto", texto: TEXTO_BUENO };
  };
  const ra = await answerViaAgente({ text: PREGUNTA, history: [], mem: {}, scenario: ESCENARIO_INICIAL, callAgente: guionT7 });
  ok(ra.r.agente.estado === "reparado" && /22\.560/.test(ra.r.text),
    `★ la reparación pidió la herramienta, corrió, y el re-cierre salió con la cifra VERIFICADA (${ra.r.agente.estado})`);
  ok(llamadasA === 3 && ra.r.agente.figs === 2, `3 llamadas (cierre + reparación + re-cierre) y la boleta llena (${llamadasA} · ${ra.r.agente.figs} figs)`);

  // (b) el cierre FORZADO pide la herramienta: mismo derecho, misma ronda extra
  let llamadasB = 0;
  const guionCierre = async ({ cierre, figsEnBoleta }) => {
    llamadasB++;
    if (!cierre) return { tipo: "herramientas", pedidos: [] };   // quema las 3 rondas sin pedir nada
    if (figsEnBoleta === 0) return { tipo: "herramientas", pedidos: [{ tool: "serieEntidad", args: { entity: "Depósito Riachuelo", metrica: "venta" } }] };
    return { tipo: "texto", texto: TEXTO_BUENO };
  };
  const rb = await answerViaAgente({ text: PREGUNTA, history: [], mem: {}, scenario: ESCENARIO_INICIAL, callAgente: guionCierre });
  ok(rb.r.agente.estado === "verde" && /22\.560/.test(rb.r.text),
    `el cierre forzado que pide una herramienta válida la obtiene y cierra verde (${rb.r.agente.estado})`);
  ok(llamadasB === 5, `3 rondas vacías + cierre + re-cierre = 5 llamadas (${llamadasB})`);

  // contraprueba: la ronda extra es UNA — un guion que pide herramientas por siempre en el cierre no la repite
  let llamadasC = 0;
  const guionInsaciable = async ({ cierre }) => {
    llamadasC++;
    if (!cierre) return { tipo: "herramientas", pedidos: [] };
    return { tipo: "herramientas", pedidos: [{ tool: "serieEntidad", args: { entity: "Depósito Riachuelo", metrica: "venta" } }] };
  };
  const rc = await answerViaAgente({ text: PREGUNTA, history: [], mem: {}, scenario: ESCENARIO_INICIAL, callAgente: guionInsaciable });
  ok(llamadasC === 5 && rc.r.agente.estado === "limite",
    `insaciable: la extra corre UNA vez y el turno cae a la línea honesta con lo leído (${llamadasC} llamadas · ${rc.r.agente.estado})`);
}

/* ═══ 11 · EL RESCATE PROPORCIONAL (R4 del examen 1 · 2026-08-31) ═════════════════════════════════════════════
 * LO MEDIDO: T4 sirvió UNA cifra donde el suplente natural servía el tablero; la corrección 30%→22.0% de T5
 * existía en los borradores y nunca llegó (el usuario quedó creyendo el 30%); el trato registrado (jc) jamás
 * apareció en pantalla (T14/T15). El tablero de KPIs sigue FUERA de la escalera (decisión del owner intacta):
 * la proporcionalidad viene de lo que ESTE turno verificó, no de un volcado. */
H("11 · R4: el rescate proporcional — cifras del turno, refutación y trato");
{
  initTenant(PACK);
  const tercoSerie = async ({ ronda, attempt }) => {
    if (ronda === 1 && attempt === 0) return { tipo: "herramientas", pedidos: [{ tool: "serieEntidad", args: { entity: "Depósito Riachuelo", metrica: "venta" } }] };
    return { tipo: "texto", texto: "Depósito Riachuelo te compró $99.9M el último mes — un récord histórico." };
  };
  /* P1a DE LA CORRIDA 2 (2026-08-31) · R4a SE REVIERTE, MEDIDO: el empaquetado de 4 cifras en una oración le
   * dio al binding semántico del muro varias cifras que atribuir y el propio rescate se vetó — T2 registró
   * `linea-honesta · «$4.9M» narrado como margen, pero pertenece a costo/ventas`, tercer peldaño de la cascada
   * que terminó en VACÍO. Un rescate que no sale no es proporcional: es nada. Vuelve a UNA cifra (la conducta
   * de la corrida 1, que pasaba). La refutación de R4b se CONSERVA — se prueba abajo. */
  const rA = await answerViaAgente({ text: PREGUNTA, history: [], mem: {}, scenario: ESCENARIO_INICIAL, callAgente: tercoSerie });
  const _cifrasRescate = (rA.r.text.match(/\$[\d.]+/g) || []).length;
  ok(rA.r.agente.estado === "limite" && _cifrasRescate === 1 && /verificado/.test(rA.r.text),
    `★ P1a: la línea honesta sirve UNA cifra verificada (${_cifrasRescate}) — el paquete que se auto-vetaba murió`, rA.r.text.slice(0, 200));
  ok(rA.r.text.length < 400, `y sigue corta (${rA.r.text.length} chars) — el rescate que sale vale más que el que se veta`);

  // R4b · el supuesto contradicho se refuta EN el rescate (el 30%→22.0% perdido de T5)
  const guionSup = async ({ ronda, attempt }) => {
    if (ronda === 1 && attempt === 0) return { tipo: "herramientas", pedidos: [
      { tool: "registrarSupuesto", args: { texto: "Depósito Riachuelo margen 30%", cifra: 30, unidad: "pct" } },
      { tool: "serieEntidad", args: { entity: "Depósito Riachuelo", metrica: "margen" } },
    ] };
    return { tipo: "texto", texto: "Depósito Riachuelo opera con margen 45% — récord absoluto." };
  };
  const rB = await answerViaAgente({ text: "ponele que riachuelo tiene 30% de margen, que hacemos?", history: [], mem: {}, scenario: ESCENARIO_INICIAL, callAgente: guionSup });
  ok(rB.r.agente.estado === "limite" && /El supuesto que registraste no coincide con lo verificado/.test(rB.r.text) && /21\.5%/.test(rB.r.text),
    "★ R4b: la refutación del supuesto llega con la cifra real del dato", rB.r.text.slice(0, 260));
  ok(!/45%/.test(rB.r.text) && !/= 30\.0%/.test(rB.r.text), "…sin la cifra inventada y sin blanquear el 30% como verificado");

  // R4c · el trato registrado viaja también en los peldaños (T14: «jc» jamás apareció)
  setNombreUsuario("jc");
  const rC = await answerViaAgente({ text: "seguime con eso", history: [], mem: { ultimaAprobada: TEXTO_BUENO }, scenario: ESCENARIO_INICIAL, callAgente: async () => ({ tipo: "texto", texto: "" }) });
  const rD = await answerViaAgente({ text: PREGUNTA, history: [], mem: {}, scenario: ESCENARIO_INICIAL, callAgente: tercoSerie });
  olvidarNombreUsuario();
  ok(rC.r.agente.estado === "respaldo" && /(^|\n)jc: /.test(rC.r.text),
    "★ R4c: el respaldo saluda con el trato registrado («jc: …»)", rC.r.text.slice(0, 90));
  ok(rD.r.agente.estado === "limite" && /(^|\n)jc: /.test(rD.r.text), "…y la línea honesta también");
}

/* ═══ 12 · LEER ANTES DE DECLINAR (R6 del examen 1 · 2026-08-31) ══════════════════════════════════════════════
 * LO MEDIDO: T20 afirmó una limitación FALSA («sin 24 meses no puedo» — el dato trae el año anterior) con 0
 * herramientas y quedó verde; T16 dijo «no tengo tu venta total» cuando executiveSummary la trae; en 24-28
 * pidió permiso conversacional para lecturas internas 4 turnos seguidos. Declinar sin boleta es opinar. */
H("12 · el empujón de R6: declinar sin haber leído recibe UNA chance de verificar");
{
  initTenant(PACK);
  // (a) el espejo de T16/T20: declina en ronda 1 sin herramientas → empujón → lee → responde con cifra
  let vioNudge = false, llamadasA = 0;
  const guionT20 = async ({ mensajes, ronda }) => {
    llamadasA++;
    vioNudge = vioNudge || mensajes.some((m) => /VERIFICA — pide ahora/.test(m.content));
    if (ronda === 1 && !vioNudge) return { tipo: "texto", texto: "No tengo el dato de tu venta total consolidada, así que no puedo comparar." };
    if (!vioNudge) return { tipo: "texto", texto: "cierro" };
    if (ronda === 2) return { tipo: "herramientas", pedidos: [{ tool: "serieEntidad", args: { entity: "Depósito Riachuelo", metrica: "venta" } }] };
    return { tipo: "texto", texto: TEXTO_BUENO };
  };
  const ra = await answerViaAgente({ text: "compara mi venta contra el año pasado", history: [], mem: {}, scenario: ESCENARIO_INICIAL, callAgente: guionT20 });
  ok(vioNudge, "★ R6: la declinación sin lectura recibió el empujón del motor");
  ok(ra.r.agente.estado === "verde" && ra.r.agente.figs === 2 && /22\.560/.test(ra.r.text),
    `…y el turno terminó VERDE con boleta llena (${ra.r.agente.estado} · ${ra.r.agente.figs} figs)`);

  // (b) el límite DECLARADO del mapa no recibe empujón: declinar directo ES la conducta (bloque B)
  let llamadasB = 0;
  const guionMapa = async () => { llamadasB++; return { tipo: "texto", texto: "El detalle mensual por cliente no está disponible: la serie no reconcilia contra la cifra oficial del período. Lo que sí tengo verificado es el consolidado — pídemelo y lo trabajamos." }; };
  const rb = await answerViaAgente({ text: "cuanto me compro riachuelo mes a mes?", history: [], mem: {}, scenario: ESCENARIO_INICIAL, callAgente: guionMapa });
  ok(llamadasB === 1, `«no reconcilia» (el límite del mapa) pasa directo, sin empujón ni segunda llamada (${llamadasB})`);

  // (c) una respuesta CON contenido en ronda 1 tampoco lo recibe (el empujón es para declinaciones sin boleta)
  let llamadasC = 0;
  const guionResponde = async () => { llamadasC++; return { tipo: "texto", texto: "Ventas totales del negocio: $61K en el período. La cuenta grande es Depósito Riachuelo." }; };
  const rc = await answerViaAgente({ text: "cuanto vendi?", history: [], mem: {}, scenario: ESCENARIO_INICIAL, callAgente: guionResponde });
  ok(llamadasC === 1, `responder con contenido no dispara el empujón (${llamadasC} llamada)`);

  // (d) el empujón es UNO: el guion que declina por siempre no entra en bucle
  let llamadasD = 0;
  const guionNecio = async () => { llamadasD++; return { tipo: "texto", texto: "No puedo responder eso con lo que tengo disponible." }; };
  const rd = await answerViaAgente({ text: "compara mi venta contra el año pasado", history: [], mem: {}, scenario: ESCENARIO_INICIAL, callAgente: guionNecio });
  ok(llamadasD === 2 && typeof rd.r.text === "string" && rd.r.text.length > 0,
    `el necio recibe UN empujón y su segunda declinación se acepta (${llamadasD} llamadas)`);

  /* [10] DEL EXAMEN 1 · EL CONTEO HONESTO: T8 papagayeó la plantilla de rescate y se contó VERDE (el mismo
   * texto en T6 fue «limite» — infló la tasa del criterio A). El muro no lo veta (la cifra era verdadera con
   * dueño — refutado T-transversal-5); la ETIQUETA se corrige: eso ES un rescate. */
  initTenant(TENANT_DEMO);
  /* ⚠️ LA CIFRA DE ESTE ECO SE ACTUALIZÓ EL 2026-09-01, y el texto histórico queda acá para que no se pierda.
   * EL VERBATIM DEL T8 DEL EXAMEN 1 era, palabra por palabra:
   *   «No pude completar la lectura que pediste con la calidad que corresponde. Lo que sí tengo verificado:
   *    las ventas totales del negocio suman $99.9M. Dime por dónde quieres que siga y lo trabajo sobre lo
   *    disponible.»
   * POR QUÉ CAMBIÓ: el owner declaró que el total del negocio es el que muestra la pantalla, así que la quinta
   * fuente dejó de publicar $99.9M con ese concepto y el muro empezó a vetar ese texto. Medido: con $99.9M el
   * turno cae a `vacio` con dos vetos, y entonces NUNCA LLEGA AL CONTEO — que es justamente lo que este bloque
   * vigila. La cifra es el vehículo que lleva el eco hasta el punto de conteo; lo medido es cómo se CUENTA.
   * Un check que ya no alcanza el sitio que vigila conserva un texto y pierde la garantía.
   * Y sale del DATO, no de un literal: si mañana el total vuelve a cambiar, este bloque lo sigue. */
  const _totalHoy = (cifrasDelDato(ESCENARIO_INICIAL).figs || []).find((x) => /^money:/.test(String(x.canon))
    && Array.isArray(x.duenos) && x.duenos.includes("negocio") && x.duenos.includes("total")
    && !x.duenos.includes("anterior") && !x.duenos.includes("presupuesto"));
  const ECO = `No pude completar la lectura que pediste con la calidad que corresponde. Lo que sí tengo verificado: las ventas totales del negocio suman ${_totalHoy.value}. Dime por dónde quieres que siga y lo trabajo sobre lo disponible.`;
  const re2 = await answerViaAgente({ text: "dame la foto del negocio", history: [], mem: {}, scenario: ESCENARIO_INICIAL, callAgente: async () => ({ tipo: "texto", texto: ECO }) });
  ok(re2.r.agente.estado === "limite" && re2.r.text.includes(_totalHoy.value),
    `★ [10]: el eco de la plantilla APRUEBA el muro pero se CUENTA como límite (${re2.r.agente.estado}) — el T8 del examen`);
  ok(!re2.mem.ultimaAprobada, "…y NO se vuelve `ultimaAprobada`: el respaldo jamás re-ofrece un rescate como respuesta de verdad");
}

/* ═══ 13 · EL PUENTE EN MODO AGENTE (R9 del examen 1 · 2026-08-31) ════════════════════════════════════════════
 * LO MEDIDO (bloque B): las 4 variantes declinaron honestas PERO en 8-11 líneas con menú; T9 divergió con un
 * cuestionario que prometía una cifra que el bloqueo hace imposible; las 4 expusieron el instrumento. El
 * puente resuelve el MISMO caso en 1-2 líneas — y con serie real el cerebro sigue siendo agente. */
H("13 · entidad×período bloqueada → el puente; con serie real, el cerebro");
{
  // (a) DEMO (serie sintética que no reconcilia): el puente responde SOLO, en una línea, sin cerebro
  initTenant(TENANT_DEMO);
  let llamadasA = 0;
  const espia = async () => { llamadasA++; return { tipo: "texto", texto: "no debería llegar acá" }; };
  const ra = await answerViaAgente({ text: "cuanto me compro falabella el ultimo mes", history: [], mem: {}, scenario: "bonanza", callAgente: espia });
  ok(ra.r.agente.estado === "puente" && llamadasA === 0 && ra.r.deterministic === true,
    `★ R9: la serie bloqueada va al puente — 0 llamadas al cerebro (${ra.r.agente.estado})`);
  ok(/no reconcilia con la cifra oficial/.test(ra.r.text) && /ficha/.test(ra.r.text),
    "la razón es la VERDADERA y la puerta es REAL (la ficha) — sin cuestionario, sin promesa imposible");
  ok(ra.r.text.split("\n").filter((l) => l.trim()).length <= 2 && !/la herramienta/i.test(ra.r.text),
    `y son 1-2 líneas sin el instrumento expuesto (${ra.r.text.split("\n").filter((l) => l.trim()).length})`);

  // (b) PACK (serie real reconciliada): el cerebro corre con su herramienta — cero sobre-intercepción
  initTenant(PACK);
  let llamadasB = 0;
  const guionFeliz = async ({ ronda }) => {
    llamadasB++;
    if (ronda === 1) return { tipo: "herramientas", pedidos: [{ tool: "serieEntidad", args: { entity: "Depósito Riachuelo", metrica: "venta" } }] };
    return { tipo: "texto", texto: TEXTO_BUENO };
  };
  const rb = await answerViaAgente({ text: PREGUNTA, history: [], mem: {}, scenario: ESCENARIO_INICIAL, callAgente: guionFeliz });
  ok(llamadasB === 2 && rb.r.agente.estado === "verde",
    `con serie REAL el agente sigue siendo agente (${llamadasB} llamadas · ${rb.r.agente.estado})`);
}

/* ═══ 14 · LO QUE LA CORRIDA 2 MIDIÓ (P1b · P2 · P3 · P4 · 2026-08-31) ════════════════════════════════════════
 * La corrida 2 salió PEOR (19/28, verdes 14→2) y el expediente —legible gracias a R7— dijo por qué: una cascada
 * de falsos positivos de atribución que terminó en 4 vacíos, un empujón que se cobró 43× en re-narraciones, y
 * un cierre que re-paga la boleta entera en cada intento (78% del gasto). guardC NO se toca: se corrigen la
 * forma del rescate, la instrucción de la reparación, el ruteo del empujón y el peso del hilo. */
H("14 · P1b: la reparación nombra la cifra vetada — no repite la frase entera");
{
  initTenant(PACK);
  let multaVista = null;
  const guionVeta = async ({ mensajes, attempt }) => {
    if (attempt === 0) return { tipo: "texto", texto: "Depósito Riachuelo te compró $99.9M el último mes — un récord histórico." };
    multaVista = mensajes[mensajes.length - 1].content;
    return { tipo: "texto", texto: "No tengo esa cifra verificada." };
  };
  await answerViaAgente({ text: PREGUNTA, history: [], mem: {}, scenario: ESCENARIO_INICIAL, callAgente: guionVeta });
  ok(!!multaVista && /Lo rechazado es esta cifra: \$99\.9M/.test(multaVista),
    "★ P1b: el reintento recibe LA cifra rechazada, nombrada", (multaVista || "").slice(0, 220));
  ok(/Reescribe SOLO la oración que la contiene/.test(multaVista || "") && /Repetir la misma frase recibe el mismo rechazo/.test(multaVista || ""),
    "…con la instrucción quirúrgica y el aviso de que repetir no sirve (el T2 de la corrida 2)");
}

H("14b · P2: reformular lo ya dicho NO dispara el empujón (43× medido)");
{
  initTenant(PACK);
  const _declina = async () => ({ tipo: "texto", texto: "No puedo darte esa versión sin cruzar antes el dato verificado." });
  let n1 = 0;
  const g1 = async (a) => { n1++; return _declina(a); };
  const rRe = await answerViaAgente({ text: "dame una versión más dura, como si tuviera que presentarla al gerente", history: [], mem: {}, scenario: ESCENARIO_INICIAL, callAgente: g1 });
  ok(n1 === 1, `★ P2: la re-narración responde en UNA llamada (${n1}) — sin empujón`, rRe.r.agente.estado);
  let n2 = 0;
  const g2 = async (a) => { n2++; return _declina(a); };
  await answerViaAgente({ text: "compara mi venta contra el año pasado", history: [], mem: {}, scenario: ESCENARIO_INICIAL, callAgente: g2 });
  ok(n2 === 2, `…y una pregunta de DATO sigue recibiendo el empujón de R6 (${n2} llamadas) — la mejora no se perdió`);
  let n3 = 0;
  const g3 = async (a) => { n3++; return _declina(a); };
  await answerViaAgente({ text: "hazme un resumen ejecutivo para el directorio", history: [], mem: {}, scenario: ESCENARIO_INICIAL, callAgente: g3 });
  ok(n3 === 2, `…y «resumen ejecutivo» NO es re-narración: es lectura nueva, y se empuja (${n3} llamadas)`);
}

H("14c · P3: el hilo que viaja al cierre se poda — las cifras citables van TODAS");
{
  initTenant(TENANT_DEMO);
  const hilos = [];
  const guionGrid = async ({ mensajes, ronda }) => {
    hilos.push(mensajes.reduce((n, m) => n + String(m.content || "").length, 0));
    if (ronda === 1) return { tipo: "herramientas", pedidos: [{ tool: "gridTable", args: { dimension: "sku" } }] };
    return { tipo: "texto", texto: "La cartera de SKU está leída; dime por dónde profundizamos." };
  };
  const rG = await answerViaAgente({ text: "dame la tabla completa por sku", history: [], mem: {}, scenario: "bonanza", callAgente: guionGrid });
  ok(hilos[1] > 0 && hilos[1] < 20000,
    `★ P3: tras una lectura grande el hilo queda en ${hilos[1]} chars (sin poda eran ~24.400 — medido −36%)`);
  ok(rG.r.agente.figs === 263, `y la boleta viaja ENTERA al muro (${rG.r.agente.figs} figs) — se poda el hilo, no la verificación`);
  ok(TECHO_ENTRADA_CIERRE_CHARS === 28000, "el techo del cierre caro es UNA sola verdad, exportada del bucle");
}

H("14d · P4: la unidad del eco del supuesto la dice el usuario ($ y % no se cruzan)");
{
  initTenant(TENANT_DEMO);
  const sup = registrarSupuesto({ texto: "Falabella tiene 30% de margen", cifra: 30 });   // sin declarar unidad: el default era money
  ok(sup.boleta[0].value === "30.0%" && sup.boleta[0].unit === "pct",
    `★ P4: «30%» en el texto → el eco dice 30.0%, no $30 (${sup.boleta[0].value})`);
  const supM = registrarSupuesto({ texto: "el cliente promete comprar $45.000 este mes", cifra: 45000 });
  ok(supM.boleta[0].unit === "money", "…y «$45.000» sigue siendo dinero");
  const supDecl = registrarSupuesto({ texto: "sube tres puntos", cifra: 3, unidad: "pct" });
  ok(supDecl.boleta[0].unit === "pct", "…y sin símbolo en el texto, manda lo declarado por el cerebro");
}

/* ═══ 14e · P2 · LA REPARACIÓN QUE PUEDE ARREGLARSE, SE ESCALA (corrida 4 · owner 2026-08-31) ════════════════
 * T10 murió así: el cerebro aclaró una ambigüedad real con un EJEMPLO numérico sobre una entidad real («ej: si
 * Falabella tiene 1% de carga hoy…»), el muro vetó ese «1%» —con razón—, la reparación fue al tier barato
 * porque la boleta estaba vacía (R-eco) y el modelo chico devolvió el MISMO texto: lo único que cambió entre
 * los dos intentos fue «te referís» → «te refieres», que es el lavado de voseo, no una corrección.
 * (i) la letra: aclarar en palabras o con cifra verificada, nunca con un ejemplo inventado sobre una entidad.
 * (ii) el tier: si la multa NOMBRA una cifra, corregir es reescribir una oración — eso sí lo arregla un modelo
 *      mejor. Medido sobre la corrida 4: 2 escaladas nuevas en 28 turnos (T10 y T18). */
H("14e · P2: la letra del ejemplo numérico y la escalada de un veto reparable");
{
  initTenant(PACK);
  ok(/nunca con un ejemplo numérico inventado sobre una entidad real/.test(PRINCIPIOS_RUTEO),
    "★ (i) la letra prohíbe el ejemplo numérico sobre una entidad real");
  const fijo = sistemaDelAgente("actual").fijo;
  ok(/nunca con un ejemplo numérico inventado sobre una entidad real/.test(fijo), "…y viaja en el system del agente");

  // (ii) la señal llega al adapter SOLO cuando la multa nombra una cifra
  const vistas = [];
  const guionT10 = async ({ attempt, figsEnBoleta, vetoConCifra }) => {
    vistas.push({ attempt, figsEnBoleta, vetoConCifra: !!vetoConCifra });
    return { tipo: "texto", texto: "Necesito aclarar el alcance: ¿te refieres a bajar la carga 2 puntos (ej: si Depósito Riachuelo tiene 1% hoy, quedaría en −1%) o a reducirla un 2% relativo?" };
  };
  /* «dos puntos» en letras a propósito (re-apuntado 2026-09-01): con «2 puntos» el playbook C toma el turno y
   * simula antes de que el cerebro hable — este bloque mide la SEÑAL DEL TIER en la reparación, así que la
   * pregunta se queda sin cifra (C se retira) y la multa sigue nombrando el «1%» del guion. */
  const r = await answerViaAgente({ text: "simula bajar la carga comercial dos puntos", history: [], mem: {}, scenario: ESCENARIO_INICIAL, callAgente: guionT10 });
  const rep = vistas.find((v) => v.attempt > 0);
  ok(!!rep && rep.figsEnBoleta === 0 && rep.vetoConCifra === true,
    "★ (ii) con boleta vacía pero multa que nombra una cifra, la reparación pide el tier bueno", JSON.stringify(vistas));
  ok((r.r.agente.vetos || []).some((v) => /^cierre · /.test(v)), "el veto quedó registrado con su sitio", JSON.stringify(r.r.agente.vetos));

  // y el caso que R-eco vino a cortar SIGUE cortado: sin cifra en la multa, no se escala
  const vistas2 = [];
  const guionSinCifra = async ({ attempt, figsEnBoleta, vetoConCifra }) => {
    vistas2.push({ attempt, vetoConCifra: !!vetoConCifra });
    return { tipo: "texto", texto: "Procede con la renegociación de la carga." };   // veto del contrato: sin cifras
  };
  await answerViaAgente({ text: "que hago con riachuelo", history: [], mem: {}, scenario: ESCENARIO_INICIAL, callAgente: guionSinCifra });
  const rep2 = vistas2.find((v) => v.attempt > 0);
  ok(!!rep2 && rep2.vetoConCifra === false,
    "…y un veto SIN cifra (el cierre imperativo) no escala: el gasto estéril de la corrida 2 sigue cortado", JSON.stringify(vistas2));
}

/* ═══ 15 · CARNADAS ═══════════════════════════════════════════════════════════════════════════════════════════ */
H("15 · CARNADA · cada garantía, probada ROJA con el defecto adentro");
{
  const tmp = [];
  let nCarnada = 0;
  const mutar = (rel, reemplazos) => {
    const abs = path.join(process.cwd(), rel);
    let txt = fs.readFileSync(abs, "utf8").replace(/\r\n/g, "\n");
    for (const [de, a] of reemplazos) {
      const antes = txt;
      txt = txt.replace(de, a);
      if (txt === antes) return { error: `la carnada no encontró qué mutar en ${rel}` };
    }
    const destino = abs.replace(/\.js$/, `.carnada${process.pid}_${++nCarnada}.js`);
    fs.writeFileSync(destino, txt);
    tmp.push(destino);
    return { url: pathToFileURL(destino).href };
  };
  const carnada = async (nombre, reemplazos, prueba) => {
    const m = mutar("src/adi/agente/bucleAgente.js", reemplazos);
    if (m.error) return ok(false, `carnada «${nombre}»`, m.error);
    let cazada = false, detalle = "";
    try { cazada = await prueba(await import(m.url)); }
    catch (e) { detalle = `la copia mutada ni siquiera carga: ${e.message}`; }
    ok(cazada, `carnada «${nombre}» → el chequeo se pone ROJO`, detalle || "el defecto pasó DESAPERCIBIDO");
  };
  const guionTerco = async ({ ronda, attempt }) => {
    if (ronda === 1 && attempt === 0) return { tipo: "herramientas", pedidos: [{ tool: "serieEntidad", args: { entity: "Depósito Riachuelo", metrica: "venta" } }] };
    return { tipo: "texto", texto: "Depósito Riachuelo te compró $99.9M el último mes — un récord histórico." };
  };

  // (a) sin muro: la cifra inventada llega a pantalla
  await carnada("adoptar el texto sin juzgar",
    [[/    const v1 = juzgar\(lavado\);\n    if \(v1 && v1\.ok\)/, "    const v1 = { ok: true };\n    if (v1 && v1.ok)"]],
    async (Mut) => {
      initTenant(PACK);
      const r = await Mut.answerViaAgente({ text: PREGUNTA, history: [], mem: {}, scenario: ESCENARIO_INICIAL, callAgente: guionTerco });
      return /99\.9M/.test(r.r.text);
    });

  // (b) sin tope de rondas: el guion infinito se dispara — se caza contando llamadas
  await carnada("tope de rondas quitado",
    [[/const TOPE_RONDAS = 3;/, "const TOPE_RONDAS = 60;"]],
    async (Mut) => {
      initTenant(PACK);
      let n = 0;
      const inf = async () => { n++; if (n > 40) return { tipo: "texto", texto: "me rindo" }; return { tipo: "herramientas", pedidos: [{ tool: "salesRead", args: {} }] }; };
      await Mut.answerViaAgente({ text: PREGUNTA, history: [], mem: {}, scenario: ESCENARIO_INICIAL, callAgente: inf });
      return n > 10;   // sano: 4 llamadas exactas
    });

  // (c) la línea honesta sin verificar por el muro
  await carnada("peldaño 1 sin juzgar",
    // (el sitio creció con C3: el peldaño ahora prueba varias cifras; sin juez adopta la primera sin verificar)
    [[/  const _pasa = \(t\) => \{\n    if \(typeof juzgar !== "function"\) return true;\n    try \{ const v = juzgar\(t\); return !!\(v && v\.ok\); \} catch \{ return false; \}\n  \};/,
      "  const _pasa = () => true;"]],
    async (Mut) => {
      // el texto del peldaño se adopta AUNQUE el muro lo rechazara: se demuestra con un juzgar espía en el sano
      // — acá alcanza con probar que el mutado NO llama al juez: se inyecta un guion terco y se compara flujo
      initTenant(PACK);
      const r = await Mut.answerViaAgente({ text: PREGUNTA, history: [], mem: {}, scenario: ESCENARIO_INICIAL, callAgente: guionTerco });
      // en el mutado el peldaño 1 se adopta SIEMPRE (sin veto posible); la señal medible: estado limite con texto
      // idéntico al candidato aunque contenga una fig con dueño de otro (no construible acá) — se mide lo directo:
      return r.r.agente.estado === "limite" && /verificado/.test(r.r.text);
    });

  // (d) el supuesto blanqueado como «verificado»
  await carnada("peldaño 1 citando supuestos",
    [[/  const verificadas = figs\.filter\(\(f\) => f\.source !== "user_supuesto" && f\.label && \(f\.text \|\| f\.value\)\);/,
      "  const verificadas = figs.filter((f) => f.label && (f.text || f.value));"]],
    async (Mut) => {
      initTenant(PACK);
      const guion = async ({ ronda }) => {
        if (ronda === 1) return { tipo: "herramientas", pedidos: [{ tool: "registrarSupuesto", args: { texto: "el cliente dice que comprará el doble", cifra: 45120 } }] };
        return { tipo: "herramientas", pedidos: [{ tool: "zzz", args: {} }] };
      };
      const r = await Mut.answerViaAgente({ text: "registra eso", history: [], mem: {}, scenario: ESCENARIO_INICIAL, callAgente: guion });
      return /Supuesto del usuario/.test(r.r.text) && /verificado/.test(r.r.text);   // el defecto: blanqueo
    });

  // (e) la corrección de contrato infinita: sano = el cerebro la ve UNA vez; mutado = una por ronda
  await carnada("corrección de herramienta desconocida sin límite",
    [[/if \(desconocidas\.length && !correccionUsada\) \{/, "if (desconocidas.length) {"]],
    async (Mut) => {
      initTenant(PACK);
      let correcciones = 0;
      const necio = async ({ mensajes }) => {
        correcciones = mensajes.filter((m) => /no existe/.test(m.content) && /catálogo/.test(m.content)).length;
        return { tipo: "herramientas", pedidos: [{ tool: "noExiste", args: {} }] };
      };
      await Mut.answerViaAgente({ text: PREGUNTA, history: [], mem: {}, scenario: ESCENARIO_INICIAL, callAgente: necio });
      return correcciones > 1;   // sano: exactamente UNA corrección en todo el turno
    });

  // (f) R2 · la re-cita desconectada del muro: el turno 2 que re-cita lo aprobado vuelve a morir
  const Q1_C = "Si subo ventas 4%, ¿qué cambia?";
  /* el MISMO texto del bloque 8, con su cuenta declarada: sin el [[CALCULO]] el turno ya no llega a verde
   * (`cifra-sin-boleta`) y la carnada dejaba de medir lo suyo — una carnada que no llega al sitio no prueba
   * nada. Y sus cifras salen del DATO, por lo mismo: un literal acá volvería a atar la carnada a un escenario
   * que el producto no sirve. */
  /* ⚠️ SE CALCULA CON EL TENANT YA CARGADO, no antes. Primero lo puse acá afuera y la carnada dejó de cazar:
   * a esta altura del gate el tenant activo es `PACK` (lo dejó un bloque anterior), así que la cifra salía de
   * un dato y la prueba corría con otro. Una cifra del dato solo es «del dato» si se lee del dato que está
   * cargado en ese momento. */
  const _delNegocio = () => {
    const f = (cifrasDelDato(ESCENARIO_INICIAL).figs || []).find((x) => /^money:/.test(String(x.canon))
      && Array.isArray(x.duenos) && x.duenos.includes("negocio") && x.duenos.includes("total")
      && !x.duenos.includes("anterior"));   // la del PERÍODO, no la del año anterior
    const base = String(f.value);
    const proy = `$${(Number(base.replace(/[^\d.]/g, "")) * 1.04).toFixed(1)}M`;
    return { base, proy,
      t1: `Ventas totales del negocio: ${base} proyectados × 1.04 = ${proy}. Es una proyección con tu supuesto.\n\n[[CALCULO]]\nid=c1 · op=aplicar_pct · inputs=${base}; 4% · formula=${base} + 4% · resultado=${proy} · unidad=money\n` };
  };
  await carnada("re-cita sin cablear al muro (la regresión del examen 1)",
    [[/    recitaAprobada: recita,   \/\/ R2: cifras aprobadas a pantalla en turnos previos — el muro las re-autoriza con su dueño\n/, ""]],
    async (Mut) => {
      initTenant(TENANT_DEMO);
      const D = _delNegocio();
      const t1 = await Mut.answerViaAgente({ text: Q1_C, history: [], mem: {}, scenario: ESCENARIO_INICIAL, callAgente: async () => ({ tipo: "texto", texto: D.t1 }) });
      const g2 = async () => ({ tipo: "texto", texto: `Sobre las ventas totales del negocio, esa proyección de ${D.proy} sigue en pie con tu supuesto.` });
      const t2 = await Mut.answerViaAgente({ text: "y entonces en cuanto quedan las ventas?", history: [{ role: "user", text: Q1_C }, { role: "adi", text: t1.r.text }], mem: t1.mem, scenario: ESCENARIO_INICIAL, callAgente: g2 });
      return t2.r.agente.estado !== "verde";   // el defecto: la re-cita legítima vuelve a morir
    });

  // (g) R2 · la memoria que no se escribe: el turno aprobado no acumula nada
  await carnada("re-cita sin escribir en la memoria",
    [[/    const recitaNueva = recitaAprobadaDe\(\{ textoAprobado: pantalla, catalogoEntidades: duenosTenant \|\| \[\], previa: recita \}\);\n    if \(recitaNueva\) memOut\.recitaAprobada = recitaNueva;\n/, ""]],
    async (Mut) => {
      initTenant(TENANT_DEMO);
      const t1 = await Mut.answerViaAgente({ text: Q1_C, history: [], mem: {}, scenario: ESCENARIO_INICIAL, callAgente: async () => ({ tipo: "texto", texto: _delNegocio().t1 }) });
      return t1.r.agente.estado === "verde" && !t1.mem.recitaAprobada;   // el defecto: verde sin memoria — el contador 0 del examen
    });

  /* (8b) el peldaño vuelve a ordenar SOLO por `mandatory`: ante una proyección sirve la base y ofrece la
   * respuesta. Es el defecto exacto del T2 — enumerar en vez de servir. */
  await carnada("el peldaño vuelve a elegir por `mandatory` (enumera en vez de servir)",
    [[/    \.\.\.verificadas\.filter\(\(f\) => _esResultado\(f\) && f\.mandatory\),\n    \.\.\.verificadas\.filter\(\(f\) => _esResultado\(f\) && !f\.mandatory\),\n    \.\.\.verificadas\.filter\(\(f\) => !_esResultado\(f\) && f\.mandatory\),\n    \.\.\.verificadas\.filter\(\(f\) => !_esResultado\(f\) && !f\.mandatory\),\n/,
      "    ...verificadas.filter((f) => f.mandatory),\n    ...verificadas.filter((f) => !f.mandatory),\n"]],
    async (Mut) => {
      initTenant(TENANT_DEMO);
      const g = async ({ ronda }) => (ronda === 1
        ? { tipo: "herramientas", pedidos: [{ tool: "proyectar", args: { tasa: 3, horizonte: "12 meses" } }] }
        : { tipo: "texto", texto: "Falabella creció $77.7M este año." });
      // sin «%», como el bloque 8b: con supuesto el playbook C compone y el peldaño nunca corre
      const r = await Mut.answerViaAgente({ text: "cuanto seria mi venta si crece el año que viene?",
        history: [], mem: {}, scenario: ESCENARIO_INICIAL, callAgente: g });
      return /Venta del período/.test(r.r.text) && /tengo Proyección/.test(r.r.text);   // el defecto: sirve el insumo y ofrece la respuesta
    });

  /* (8c) el registro del trato retirado: «llamame jc» vuelve a depender de que el cerebro llame la herramienta,
   * y el playbook determinístico vuelve a salir sin nombre — el T1 de la certificación. */
  await carnada("el trato vuelve a depender de que el cerebro lo registre",
    [[/    if \(_trato\) \{ try \{ setNombreUsuario\(_trato\); \} catch \{ \/\* un trato inválido no rompe el turno \*\/ \} \}/,
      "    if (false) { setNombreUsuario(_trato); }   // CARNADA"]],
    async (Mut) => {
      olvidarNombreUsuario();
      initTenant(TENANT_DEMO);
      const g = async ({ ronda }) => (ronda === 1
        ? { tipo: "herramientas", pedidos: [{ tool: "marginRead", args: { focus: "bajo_benchmark", dimension: "cliente" } }] }
        : { tipo: "texto", texto: "" });
      const r = await Mut.answerViaAgente({ text: "llamame jc de ahora en adelante. como viene mi margen?",
        history: [], mem: {}, scenario: ESCENARIO_INICIAL, callAgente: g });
      const sinTrato = !getNombreUsuario() && !r.mem.nombreUsuario && !/^jc:/.test(String(r.r.text || ""));
      olvidarNombreUsuario();
      return sinTrato;   // el defecto: el owner pidió que lo llamen jc y el turno sale sin nombre
    });

  // (i) R1 · la ronda extra muerta: el pedido válido del cierre vuelve a descartarse (el vacío de T7)
  await carnada("ronda extra descartada (la muerte de T7)",
    [[/    if \(rondaExtraUsada \|\| !res \|\| res\.tipo !== "herramientas" \|\| !Array\.isArray\(res\.pedidos\)\) return null;/,
      "    return null;\n    if (rondaExtraUsada || !res || res.tipo !== \"herramientas\" || !Array.isArray(res.pedidos)) return null;"]],
    async (Mut) => {
      initTenant(PACK);
      const guionT7c = async ({ attempt, figsEnBoleta }) => {
        if (attempt === 0) return { tipo: "texto", texto: "Depósito Riachuelo te compró $99.9M el último mes — un récord histórico." };
        if (figsEnBoleta === 0) return { tipo: "herramientas", pedidos: [{ tool: "serieEntidad", args: { entity: "Depósito Riachuelo", metrica: "venta" } }] };
        return { tipo: "texto", texto: TEXTO_BUENO };
      };
      const r = await Mut.answerViaAgente({ text: PREGUNTA, history: [], mem: {}, scenario: ESCENARIO_INICIAL, callAgente: guionT7c });
      return r.r.agente.estado !== "reparado" && r.r.agente.figs === 0;   // el defecto: el pedido se tiró y el turno murió sin leer
    });

  // (q) P1b · la multa sin la cifra: el reintento reformula a ciegas y cosecha el mismo veto (el T2 de la corrida 2)
  await carnada("multa sin la cifra rechazada",
    [[/const _CIFRA_EN_MULTA = \/[^\n]+\/gi;/, "const _CIFRA_EN_MULTA = /$^/g;"]],
    async (Mut) => {
      initTenant(PACK);
      let multa = null;
      const g = async ({ mensajes, attempt }) => {
        if (attempt === 0) return { tipo: "texto", texto: "Depósito Riachuelo te compró $99.9M el último mes — un récord histórico." };
        multa = mensajes[mensajes.length - 1].content;
        return { tipo: "texto", texto: "No tengo esa cifra verificada." };
      };
      await Mut.answerViaAgente({ text: PREGUNTA, history: [], mem: {}, scenario: ESCENARIO_INICIAL, callAgente: g });
      return !!multa && !/Lo rechazado es/.test(multa);   // el defecto: «reescribe todo» sin decir qué
    });

  // (r) P2 · el empujón sin la exclusión de re-narración: vuelven las 5 llamadas por reformular (43×)
  await carnada("empujón sobre una re-narración",
    [[/  const esRenarracion = _RE_RENARRACION\.test\(q\);/, "  const esRenarracion = false;"]],
    async (Mut) => {
      initTenant(PACK);
      let n = 0;
      const g = async () => { n++; return { tipo: "texto", texto: "No puedo darte esa versión sin cruzar antes el dato verificado." }; };
      await Mut.answerViaAgente({ text: "dame una versión más dura, como si tuviera que presentarla al gerente", history: [], mem: {}, scenario: ESCENARIO_INICIAL, callAgente: g });
      return n > 1;   // el defecto: reformular vuelve a pagar una ronda extra
    });

  // (s) P3 · la poda quitada: el hilo del cierre vuelve a llevar la tabla entera
  await carnada("hilo sin podar (el cierre re-paga la boleta)",
    [[/const TOPE_RESULTADO_CHARS = 6000;/, "const TOPE_RESULTADO_CHARS = 1e9;"]],
    async (Mut) => {
      initTenant(TENANT_DEMO);
      const hilos = [];
      const g = async ({ mensajes, ronda }) => {
        hilos.push(mensajes.reduce((n, m) => n + String(m.content || "").length, 0));
        if (ronda === 1) return { tipo: "herramientas", pedidos: [{ tool: "gridTable", args: { dimension: "sku" } }] };
        return { tipo: "texto", texto: "Leído; dime por dónde seguimos." };
      };
      await Mut.answerViaAgente({ text: "dame la tabla completa por sku", history: [], mem: {}, scenario: "bonanza", callAgente: g });
      return hilos[1] > 20000;   // el defecto: ~24.400 chars re-pagados en cada llamada
    });

  // (p) [10] · el relabel quitado: el eco de plantilla vuelve a contarse verde (el T8 del examen)
  await carnada("eco de plantilla contado como verde",
    [[/  if \(aprobado && typeof final === "string" && \/\^No pude \(\?:completar\|armar\) la lectura\/\.test\(final\.trim\(\)\)\) \{\n    estado = "limite";\n  \}/,
      "  if (false) { estado = \"limite\"; }"]],
    async (Mut) => {
      initTenant(TENANT_DEMO);
      // la cifra sale del DATO, igual que en el bloque [10]: con la vieja el eco muere en el muro y la carnada
      // no llega al conteo que quiere medir — dejaría de cazar sin decirlo.
      const _t = (cifrasDelDato(ESCENARIO_INICIAL).figs || []).find((x) => /^money:/.test(String(x.canon))
        && Array.isArray(x.duenos) && x.duenos.includes("negocio") && x.duenos.includes("total")
        && !x.duenos.includes("anterior") && !x.duenos.includes("presupuesto"));
      const ECO2 = `No pude completar la lectura que pediste con la calidad que corresponde. Lo que sí tengo verificado: las ventas totales del negocio suman ${_t.value}. Dime por dónde quieres que siga y lo trabajo sobre lo disponible.`;
      const r = await Mut.answerViaAgente({ text: "dame la foto del negocio", history: [], mem: {}, scenario: ESCENARIO_INICIAL, callAgente: async () => ({ tipo: "texto", texto: ECO2 }) });
      return r.r.agente.estado === "verde";   // el defecto: la no-respuesta infla el conteo
    });

  // (u) P2(ii) · la señal del veto reparable apagada: T10 vuelve a repararse con el modelo chico
  await carnada("veto reparable sin escalar (el T10 de la corrida 4)",
    [[/      const vetoConCifra = _cifrasDeMulta\(multa\)\.length > 0;/, "      const vetoConCifra = false;"]],
    async (Mut) => {
      initTenant(PACK);
      const vistas = [];
      const g = async ({ attempt, vetoConCifra }) => {
        vistas.push({ attempt, vetoConCifra: !!vetoConCifra });
        return { tipo: "texto", texto: "¿Te refieres a bajar la carga 2 puntos (ej: si Depósito Riachuelo tiene 1% hoy, quedaría en −1%) o a un 2% relativo?" };
      };
      await Mut.answerViaAgente({ text: "simula reducir 2 puntos la carga comercial", history: [], mem: {}, scenario: ESCENARIO_INICIAL, callAgente: g });
      const rep = vistas.find((v) => v.attempt > 0);
      return !!rep && rep.vetoConCifra === false;   // el defecto: la reparación va al tier barato y repite
    });

  // (o) R9 · el puente desconectado: la serie bloqueada vuelve al cerebro (la lotería de T9)
  await carnada("puente de serie bloqueada desconectado",
    [[/    const det = \(\(\) => \{ try \{ return detectSerieIntent\(q\); \} catch \{ return null; \} \}\)\(\);/,
      "    const det = null;"]],
    async (Mut) => {
      initTenant(TENANT_DEMO);
      let llamadas = 0;
      const g = async () => { llamadas++; return { tipo: "texto", texto: "El consolidado anual de Falabella está verificado — pídemelo y lo vemos juntos." }; };
      await Mut.answerViaAgente({ text: "cuanto me compro falabella el ultimo mes", history: [], mem: {}, scenario: "bonanza", callAgente: g });
      return llamadas > 0;   // el defecto: la pregunta bloqueada volvió a la lotería del cerebro
    });

  // (n) R6 · el empujón quitado: la limitación falsa vuelve a salir verde sin leer (T20)
  await carnada("declinar sin leer, sin empujón (el T20 del examen)",
    [[/      if \(calls === 0 && !nudgeUsado && !esRenarracion && _RE_DECLINA_SIN_LEER\.test\(res\.texto\) && !\/no reconcilia\/i\.test\(res\.texto\)\) \{/,
      "      if (false) {"]],
    async (Mut) => {
      initTenant(PACK);
      let llamadas = 0;
      const g = async () => { llamadas++; return { tipo: "texto", texto: "No tengo el dato de tu venta total consolidada, así que no puedo comparar." }; };
      const r = await Mut.answerViaAgente({ text: "compara mi venta contra el año pasado", history: [], mem: {}, scenario: ESCENARIO_INICIAL, callAgente: g });
      return llamadas === 1 && r.r.agente.figs === 0;   // el defecto: la declinación sin boleta pasó sin verificar
    });

  // (k) P1a · el empaquetado de vuelta: el rescate junta cifras en una oración y se expone al veto de atribución
  /* (con C3 el peldaño PRUEBA varias cifras pero SIRVE UNA — el defecto se reinstala donde haría daño: en el
   * armador, apilando cifras en la misma oración, que es lo que expone al veto de atribución de proximidad) */
  await carnada("rescate empaquetado (el auto-veto de T2)",
    [[/    fig \? `Lo que sí tengo verificado: \$\{fig\.label\} = \$\{fig\.text \|\| fig\.value\}\.` : null,/,
      "    fig ? \"Lo que sí tengo verificado: \" + candidatas.slice(0, 4).map((x) => x.label + \" = \" + (x.text || x.value)).join(\"; \") + \".\" : null,"]],
    async (Mut) => {
      initTenant(PACK);
      const terco2 = async ({ ronda, attempt }) => {
        if (ronda === 1 && attempt === 0) return { tipo: "herramientas", pedidos: [{ tool: "serieEntidad", args: { entity: "Depósito Riachuelo", metrica: "venta" } }] };
        return { tipo: "texto", texto: "Depósito Riachuelo te compró $99.9M el último mes — un récord histórico." };
      };
      const r = await Mut.answerViaAgente({ text: PREGUNTA, history: [], mem: {}, scenario: ESCENARIO_INICIAL, callAgente: terco2 });
      return (r.r.text.match(/\$[\d.]+/g) || []).length > 1;   // el defecto: el paquete vuelve (y con él la exposición al veto)
    });

  // (l) R4b · la refutación quitada: el supuesto contradicho queda sin refutar (el 30% de T5 otra vez)
  await carnada("refutación del supuesto quitada",
    [[/        refutacion = `El supuesto que registraste no coincide con lo verificado: \$\{contra\.label\} = \$\{contra\.text \|\| contra\.value\}\.`;/,
      "        refutacion = null;"]],
    async (Mut) => {
      initTenant(PACK);
      const g = async ({ ronda, attempt }) => {
        if (ronda === 1 && attempt === 0) return { tipo: "herramientas", pedidos: [
          { tool: "registrarSupuesto", args: { texto: "Depósito Riachuelo margen 30%", cifra: 30, unidad: "pct" } },
          { tool: "serieEntidad", args: { entity: "Depósito Riachuelo", metrica: "margen" } },
        ] };
        return { tipo: "texto", texto: "Depósito Riachuelo opera con margen 45% — récord absoluto." };
      };
      const r = await Mut.answerViaAgente({ text: "ponele que riachuelo tiene 30% de margen, que hacemos?", history: [], mem: {}, scenario: ESCENARIO_INICIAL, callAgente: g });
      return r.r.agente.estado === "limite" && !/no coincide con lo verificado/.test(r.r.text);   // el defecto: sin refutar
    });

  // (m2) el trato que no viaja en `mem`: el turno siguiente (proceso nuevo, sin localStorage) lo pierde
  await carnada("trato sin persistir en la memoria del turno",
    [[/  \{ const _trato = getNombreUsuario\(\); if \(_trato\) memOut\.nombreUsuario = _trato; \}.*\n/, ""]],
    async (Mut) => {
      initTenant(PACK);
      setNombreUsuario("wachin");
      const t1 = await Mut.answerViaAgente({ text: "y el margen?", history: [], mem: {}, scenario: ESCENARIO_INICIAL, callAgente: async () => ({ tipo: "texto", texto: "" }) });
      olvidarNombreUsuario();   // el proceso nuevo del turno siguiente
      const t2 = await Mut.answerViaAgente({ text: "y el inventario?", history: [], mem: t1.mem, scenario: ESCENARIO_INICIAL, callAgente: async () => ({ tipo: "texto", texto: "" }) });
      olvidarNombreUsuario();
      return !/^wachin: /.test(t2.r.text);   // el defecto: el trato se perdió entre turnos
    });

  // (m) R4c · el trato quitado de los rescates: «jc» vuelve a no llegar jamás (T14)
  await carnada("trato ausente en los rescates",
    [[/    const trato = getNombreUsuario\(\);/, "    const trato = null;"]],
    async (Mut) => {
      initTenant(PACK);
      setNombreUsuario("jc");
      const r = await Mut.answerViaAgente({ text: "seguime con eso", history: [], mem: { ultimaAprobada: TEXTO_BUENO }, scenario: ESCENARIO_INICIAL, callAgente: async () => ({ tipo: "texto", texto: "" }) });
      olvidarNombreUsuario();
      return r.r.agente.estado === "respaldo" && !/(^|\n)jc: /.test(r.r.text);   // el defecto: el trato no viaja
    });

  // (j) R3 · la pertinencia quitada del peldaño vivo: el marco vuelve a mentir la entidad (unidad, caminoNatural)
  {
    const m = mutar("src/adi/oracle/caminoNatural.js",
      [[/  if \(entQ\.length && !entQ\.some\(\(n\) => _re\(n\)\.test\(previa\)\)\) pertinente = false;/, "  if (false) pertinente = false;"],
       [/    pertinente = !nombrados\.length \|\| enPrevia >= Math\.ceil\(nombrados\.length \/ 2\);/, "    pertinente = true;"]]);
    if (m.error) ok(false, "carnada «respaldo sin pertinencia»", m.error);
    else {
      let cazada = false, detalle = "";
      try {
        const Mut = await import(m.url);
        const texto = Mut._respaldoDeLoYaAprobado({ ultimaAprobada: TEXTO_BUENO }, null,
          { pregunta: "que hago con Ferretería Aurora?", entidades: ["Depósito Riachuelo", "Ferretería Aurora"], recienMostrado: null });
        cazada = typeof texto === "string" && /sobre esto quedó verificado/.test(texto);   // el defecto: T13 de vuelta
      } catch (e) { detalle = `la copia mutada ni siquiera carga: ${e.message}`; }
      ok(cazada, "carnada «respaldo sin pertinencia (el T13 del examen)» → el chequeo se pone ROJO", detalle || "el defecto pasó DESAPERCIBIDO");
    }
  }

  // (h) R7 · el expediente ciego: los vetos del guard no se registran
  await carnada("vetos del guard sin registrar",
    [[/      vetosDelTurno\.push\(`\$\{sitio\} · \$\{String\(_multaDe\(v\)\)\.split\("\\n"\)\[0\]\.slice\(0, 180\)\}`\);\n/, ""]],
    async (Mut) => {
      initTenant(PACK);
      const r = await Mut.answerViaAgente({ text: PREGUNTA, history: [], mem: {}, scenario: ESCENARIO_INICIAL, callAgente: guionTerco });
      return (r.r.agente.vetos || []).length === 0;   // el defecto: turno vetado con «vetos: ninguno»
    });

  // (t) P4 · la unidad del eco leída del argumento y no del usuario: «30%» vuelve a salir como «$30»
  {
    const abs = path.join(process.cwd(), "src", "adi", "agente", "herramientasAgente.js");
    const txt = fs.readFileSync(abs, "utf8").replace(/\r\n/g, "\n");
    const de = '  const u = _unidadDelTexto(texto, v) || unidad || "money";';
    if (!txt.includes(de)) ok(false, "carnada «unidad del eco desde el argumento»", "no encontré qué mutar");
    else {
      const destino = abs.replace(/\.js$/, `.carnada${process.pid}_p4.js`);
      fs.writeFileSync(destino, txt.replace(de, '  const u = unidad || "money";'));
      let cazada = false, detalle = "";
      try {
        const Mut = await import(pathToFileURL(destino).href);
        initTenant(TENANT_DEMO);
        const s = Mut.registrarSupuesto({ texto: "Falabella tiene 30% de margen", cifra: 30 });
        cazada = /^\$/.test(String(s.boleta[0].value));   // el defecto: el % del usuario ecoado como dinero
      } catch (e) { detalle = `la copia mutada ni siquiera carga: ${e.message}`; }
      try { fs.unlinkSync(destino); } catch { /* */ }
      ok(cazada, "carnada «unidad del eco desde el argumento (el «$30» de T17)» → el chequeo se pone ROJO", detalle || "el defecto pasó DESAPERCIBIDO");
    }
  }

  for (const f of tmp) { try { fs.unlinkSync(f); } catch { /* */ } }
}

initTenant(TENANT_DEMO);
console.log(`\n── _agente_bucle_gate: ${pass} PASS · ${fail} FAIL (de ${pass + fail}) ──`);
process.exit(fail ? 1 : 0);
