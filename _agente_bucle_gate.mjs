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
 *       cerebro para que el adapter decida el tier (R-eco: escalar solo con material que reescribir).
 *
 * ⚠️ CARNADAS (sección 10): cada garantía, probada ROJA mutando una copia del bucle vivo.
 *
 * OFFLINE · determinístico · cerebro = guion · la bandera ADI_AGENTE sigue APAGADA (esto prueba el módulo,
 * no lo enciende). `node --import ./scripts/offline-guard.mjs _agente_bucle_gate.mjs`
 */
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { initTenant } from "./src/data/tenantStore.js";
import { TENANT_DEMO } from "./src/data/tenants/demo.js";
import { plantillaEjemplo } from "./src/ingesta/plantilla/generarPlantilla.js";
import { ingestarPlantilla } from "./src/ingesta/plantilla/ingestarPlantilla.js";
import { answerViaAgente } from "./src/adi/agente/bucleAgente.js";

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
  const r = await answerViaAgente({ text: PREGUNTA, history: [], mem: {}, scenario: "actual", callAgente: guion });
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
  let reparo = 0;
  const guionRepara = async ({ attempt }) => {
    if (attempt === 1) { reparo++; return { tipo: "texto", texto: TEXTO_BUENO }; }
    return { tipo: "texto", texto: "Depósito Riachuelo te compró $99.9M el último mes — un récord histórico." };
  };
  const r1 = await answerViaAgente({ text: PREGUNTA, history: [], mem: {}, scenario: "actual", callAgente: guionRepara });
  ok(reparo === 1 && r1.r.agente.estado === "reparado", `la multa llegó y la reparación pasó (${r1.r.agente.estado})`);
  ok(!/99\.9M/.test(r1.r.text), "la cifra inventada jamás llega a pantalla");

  const guionTerco = async ({ ronda, attempt }) => {
    if (ronda === 1 && attempt === 0) return { tipo: "herramientas", pedidos: [{ tool: "serieEntidad", args: { entity: "Depósito Riachuelo", metrica: "venta" } }] };
    return { tipo: "texto", texto: "Depósito Riachuelo te compró $99.9M el último mes — un récord histórico." };
  };
  const r2 = await answerViaAgente({ text: PREGUNTA, history: [], mem: {}, scenario: "actual", callAgente: guionTerco });
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
  const r = await answerViaAgente({ text: PREGUNTA, history: [], mem: {}, scenario: "actual", callAgente: guion });
  ok(vioCorreccion, "el cerebro recibió el error de contrato con el catálogo completo");
  ok(r.r.agente.estado === "verde", "corrigió y el turno terminó verde");
}

/* ═══ 4 · RONDA INFINITA → EL TOPE CORTA ══════════════════════════════════════════════════════════════════════ */
H("4 · el guion que pide herramientas por siempre no cuelga a nadie");
{
  initTenant(PACK);
  let llamadas = 0;
  const guionInfinito = async () => { llamadas++; return { tipo: "herramientas", pedidos: [{ tool: "salesRead", args: {} }] }; };
  const r = await answerViaAgente({ text: PREGUNTA, history: [], mem: {}, scenario: "actual", callAgente: guionInfinito });
  ok(llamadas === 4, `el tope corta en 3 rondas + 1 cierre = 4 llamadas (${llamadas})`);
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
  const r = await answerViaAgente({ text: "registra que riachuelo dice que comprará el doble", history: [], mem: {}, scenario: "actual", callAgente: guion });
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
  const r = await answerViaAgente({ text: "leeme todo", history: [], mem: {}, scenario: "actual", callAgente: guion });
  ok(r.r.agente.calls === 8, `de 20 pedidos corrieron 8 — el cap por ronda (${r.r.agente.calls})`);

  const guionTresRondas = async ({ ronda }) => {
    if (ronda <= 3) return { tipo: "herramientas", pedidos: Array.from({ length: 8 }, () => ({ tool: "salesRead", args: {} })) };
    return { tipo: "texto", texto: "Cierro con lo disponible." };
  };
  const r2 = await answerViaAgente({ text: "leeme todo", history: [], mem: {}, scenario: "actual", callAgente: guionTresRondas });
  ok(r2.r.agente.calls <= 12, `el turno entero no pasa de 12 calls (${r2.r.agente.calls})`);
}

/* ═══ 7 · LOS PELDAÑOS 2 Y 3 ══════════════════════════════════════════════════════════════════════════════════ */
H("7 · respaldo de lo ya aprobado y genérico — el tablero no existe");
{
  initTenant(PACK);
  const mudo = async () => ({ tipo: "texto", texto: "" });
  const conRespaldo = await answerViaAgente({ text: "seguime con eso", history: [], mem: { ultimaAprobada: TEXTO_BUENO }, scenario: "actual", callAgente: mudo });
  ok(conRespaldo.r.agente.estado === "respaldo" && conRespaldo.r.text.includes("$22.560"),
    "sin herramientas ni texto, el peldaño 2 ofrece lo YA aprobado del hilo", conRespaldo.r.agente.estado);
  const sinNada = await answerViaAgente({ text: "seguime con eso", history: [], mem: {}, scenario: "actual", callAgente: mudo });
  ok(sinNada.r.agente.estado === "vacio" && sinNada.r.text.length > 0 && sinNada.r.text.length < 300,
    "sin nada, el genérico pelado — nunca ~12 KPIs", `${sinNada.r.agente.estado} · ${sinNada.r.text.length} chars`);
}

/* ═══ 8 · LA RE-CITA DE LO APROBADO (R2 del examen 1 · 2026-08-31) ════════════════════════════════════════════
 * EL DEFECTO MEDIDO: `mem.recitaAprobada` jamás se escribía en modo agente (contador 0 en los 28 turnos) — el
 * borrador de T13 re-citaba el $194K de Falabella APROBADO en T9 y el muro lo mató como «no autorizada». Raíz
 * de la mayoría de los turnos no-verdes. El cable es el MISMO del camino natural: nada nuevo que calibrar. */
H("8 · la re-cita: lo aprobado presta sus cifras al turno siguiente");
{
  /* Los MISMOS textos de _recita_aprobada_gate (el gate del cable original): $104.0M es una PROYECCIÓN
   * calculada a la vista — no vive en el dato proyectado, así que la única fuente que puede re-autorizarla
   * en el turno 2 es la re-cita. (Una cifra REAL del dato no sirve de prueba: la quinta fuente la autoriza
   * sola, con o sin memoria — la lección del refutado B-grieta-2 del expediente.) Mecánica, no literales. */
  initTenant(TENANT_DEMO);
  const Q1 = "Si subo ventas 4%, ¿qué cambia?";
  const T1 = "Ventas totales del negocio: $100.0M proyectados × 1.04 = $104.0M. Es una proyección con tu supuesto.";
  const t1 = await answerViaAgente({ text: Q1, history: [], mem: {}, scenario: "actual", callAgente: async () => ({ tipo: "texto", texto: T1 }) });
  const nRecita = ((t1.mem.recitaAprobada || {}).figs || []).length;
  ok(t1.r.agente.estado === "verde" && nRecita >= 2, `el turno verde ACUMULA la re-cita (${nRecita} cifras con dueño)`);

  // turno 2: cero herramientas y boleta vacía, re-citando la proyección aprobada — el caso EXACTO de T13/T24
  const HILO = [{ role: "user", text: Q1 }, { role: "adi", text: t1.r.text }];
  const RE_OK = "Sobre las ventas totales del negocio, esa proyección de $104.0M sigue en pie con tu supuesto.";
  const guionRecita = async () => ({ tipo: "texto", texto: RE_OK });
  const t2 = await answerViaAgente({ text: "y entonces en cuanto quedan las ventas?", history: HILO, mem: t1.mem, scenario: "actual", callAgente: guionRecita });
  ok(t2.r.agente.estado === "verde" && /104\.0M/.test(t2.r.text),
    `★ re-citar una cifra YA aprobada con boleta vacía es VERDE (${t2.r.agente.estado}) — la raíz de T13/T24, cerrada`);
  ok(t2.r.agente.recitaCifras >= 2, `y el veredicto declara la memoria que usó (${t2.r.agente.recitaCifras} cifras)`);

  // contraprueba 1: sin memoria, el MISMO texto muere — la re-cita no es un pase libre
  const t2sin = await answerViaAgente({ text: "y entonces en cuanto quedan las ventas?", history: HILO, mem: {}, scenario: "actual", callAgente: guionRecita });
  ok(t2sin.r.agente.estado !== "verde" && !/104\.0M/.test(t2sin.r.text),
    `sin memoria el mismo texto NO pasa (${t2sin.r.agente.estado}) — autoriza la memoria, no la frase`);

  // contraprueba 2: una cifra que NADIE aprobó muere aunque la memoria exista
  const guionOtra = async () => ({ tipo: "texto", texto: "Sobre las ventas totales del negocio, esa proyección de $117.0M sigue en pie con tu supuesto." });
  const t3 = await answerViaAgente({ text: "y entonces?", history: HILO, mem: t1.mem, scenario: "actual", callAgente: guionOtra });
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
  const r = await answerViaAgente({ text: PREGUNTA, history: [], mem: {}, scenario: "actual", callAgente: guionTerco2 });
  const vetos = r.r.agente.vetos || [];
  ok(vetos.length >= 2 && vetos.every((v) => typeof v === "string" && v.includes(" · ")),
    `los vetos quedan registrados con sitio y multa (${vetos.length})`, JSON.stringify(vetos));
  ok(vetos.some((v) => v.startsWith("cierre ·")) && vetos.some((v) => v.startsWith("reparacion ·")),
    "…nombrando el sitio: cierre y reparación", JSON.stringify(vetos));
  ok(figsVistas[0] === 0 && figsVistas[1] === 2,
    `figsEnBoleta llega al cerebro en cada llamada: ${JSON.stringify(figsVistas)} (0 antes de la ronda · 2 después)`);
}

/* ═══ 10 · CARNADAS ═══════════════════════════════════════════════════════════════════════════════════════════ */
H("10 · CARNADA · cada garantía, probada ROJA con el defecto adentro");
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
      const r = await Mut.answerViaAgente({ text: PREGUNTA, history: [], mem: {}, scenario: "actual", callAgente: guionTerco });
      return /99\.9M/.test(r.r.text);
    });

  // (b) sin tope de rondas: el guion infinito se dispara — se caza contando llamadas
  await carnada("tope de rondas quitado",
    [[/const TOPE_RONDAS = 3;/, "const TOPE_RONDAS = 60;"]],
    async (Mut) => {
      initTenant(PACK);
      let n = 0;
      const inf = async () => { n++; if (n > 40) return { tipo: "texto", texto: "me rindo" }; return { tipo: "herramientas", pedidos: [{ tool: "salesRead", args: {} }] }; };
      await Mut.answerViaAgente({ text: PREGUNTA, history: [], mem: {}, scenario: "actual", callAgente: inf });
      return n > 10;   // sano: 4 llamadas exactas
    });

  // (c) la línea honesta sin verificar por el muro
  await carnada("peldaño 1 sin juzgar",
    [[/  const candidato = partes\.join\(" "\);\n  if \(typeof juzgar !== "function"\) return candidato;\n  try \{ const v = juzgar\(candidato\); return v && v\.ok \? candidato : null; \} catch \{ return null; \}/,
      '  const candidato = partes.join(" ");\n  return candidato;']],
    async (Mut) => {
      // el texto del peldaño se adopta AUNQUE el muro lo rechazara: se demuestra con un juzgar espía en el sano
      // — acá alcanza con probar que el mutado NO llama al juez: se inyecta un guion terco y se compara flujo
      initTenant(PACK);
      const r = await Mut.answerViaAgente({ text: PREGUNTA, history: [], mem: {}, scenario: "actual", callAgente: guionTerco });
      // en el mutado el peldaño 1 se adopta SIEMPRE (sin veto posible); la señal medible: estado limite con texto
      // idéntico al candidato aunque contenga una fig con dueño de otro (no construible acá) — se mide lo directo:
      return r.r.agente.estado === "limite" && /verificado/.test(r.r.text);
    });

  // (d) el supuesto blanqueado como «verificado»
  await carnada("peldaño 1 citando supuestos",
    [[/  const verificadas = figs\.filter\(\(f\) => f\.source !== "user_supuesto"\);\n  const fig = verificadas\.find\(\(f\) => f\.mandatory\) \|\| verificadas\.find\(\(f\) => f\.label && \(f\.text \|\| f\.value\)\) \|\| null;/,
      "  const fig = figs.find((f) => f.mandatory) || figs.find((f) => f.label && (f.text || f.value)) || null;"]],
    async (Mut) => {
      initTenant(PACK);
      const guion = async ({ ronda }) => {
        if (ronda === 1) return { tipo: "herramientas", pedidos: [{ tool: "registrarSupuesto", args: { texto: "el cliente dice que comprará el doble", cifra: 45120 } }] };
        return { tipo: "herramientas", pedidos: [{ tool: "zzz", args: {} }] };
      };
      const r = await Mut.answerViaAgente({ text: "registra eso", history: [], mem: {}, scenario: "actual", callAgente: guion });
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
      await Mut.answerViaAgente({ text: PREGUNTA, history: [], mem: {}, scenario: "actual", callAgente: necio });
      return correcciones > 1;   // sano: exactamente UNA corrección en todo el turno
    });

  // (f) R2 · la re-cita desconectada del muro: el turno 2 que re-cita lo aprobado vuelve a morir
  const Q1_C = "Si subo ventas 4%, ¿qué cambia?";
  const T1_C = "Ventas totales del negocio: $100.0M proyectados × 1.04 = $104.0M. Es una proyección con tu supuesto.";
  await carnada("re-cita sin cablear al muro (la regresión del examen 1)",
    [[/    recitaAprobada: recita,   \/\/ R2: cifras aprobadas a pantalla en turnos previos — el muro las re-autoriza con su dueño\n/, ""]],
    async (Mut) => {
      initTenant(TENANT_DEMO);
      const t1 = await Mut.answerViaAgente({ text: Q1_C, history: [], mem: {}, scenario: "actual", callAgente: async () => ({ tipo: "texto", texto: T1_C }) });
      const g2 = async () => ({ tipo: "texto", texto: "Sobre las ventas totales del negocio, esa proyección de $104.0M sigue en pie con tu supuesto." });
      const t2 = await Mut.answerViaAgente({ text: "y entonces en cuanto quedan las ventas?", history: [{ role: "user", text: Q1_C }, { role: "adi", text: t1.r.text }], mem: t1.mem, scenario: "actual", callAgente: g2 });
      return t2.r.agente.estado !== "verde";   // el defecto: la re-cita legítima vuelve a morir
    });

  // (g) R2 · la memoria que no se escribe: el turno aprobado no acumula nada
  await carnada("re-cita sin escribir en la memoria",
    [[/    const recitaNueva = recitaAprobadaDe\(\{ textoAprobado: pantalla, catalogoEntidades: duenosTenant \|\| \[\], previa: recita \}\);\n    if \(recitaNueva\) memOut\.recitaAprobada = recitaNueva;\n/, ""]],
    async (Mut) => {
      initTenant(TENANT_DEMO);
      const t1 = await Mut.answerViaAgente({ text: Q1_C, history: [], mem: {}, scenario: "actual", callAgente: async () => ({ tipo: "texto", texto: T1_C }) });
      return t1.r.agente.estado === "verde" && !t1.mem.recitaAprobada;   // el defecto: verde sin memoria — el contador 0 del examen
    });

  // (h) R7 · el expediente ciego: los vetos del guard no se registran
  await carnada("vetos del guard sin registrar",
    [[/      vetosDelTurno\.push\(`\$\{sitio\} · \$\{String\(_multaDe\(v\)\)\.split\("\\n"\)\[0\]\.slice\(0, 180\)\}`\);\n/, ""]],
    async (Mut) => {
      initTenant(PACK);
      const r = await Mut.answerViaAgente({ text: PREGUNTA, history: [], mem: {}, scenario: "actual", callAgente: guionTerco });
      return (r.r.agente.vetos || []).length === 0;   // el defecto: turno vetado con «vetos: ninguno»
    });

  for (const f of tmp) { try { fs.unlinkSync(f); } catch { /* */ } }
}

initTenant(TENANT_DEMO);
console.log(`\n── _agente_bucle_gate: ${pass} PASS · ${fail} FAIL (de ${pass + fail}) ──`);
process.exit(fail ? 1 : 0);
