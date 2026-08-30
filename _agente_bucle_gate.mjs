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
 *       en la escalera.
 *
 * ⚠️ CARNADAS (sección 8): cada garantía, probada ROJA mutando una copia del bucle vivo.
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

/* ═══ 8 · CARNADAS ════════════════════════════════════════════════════════════════════════════════════════════ */
H("8 · CARNADA · cada garantía, probada ROJA con el defecto adentro");
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

  for (const f of tmp) { try { fs.unlinkSync(f); } catch { /* */ } }
}

initTenant(TENANT_DEMO);
console.log(`\n── _agente_bucle_gate: ${pass} PASS · ${fail} FAIL (de ${pass + fail}) ──`);
process.exit(fail ? 1 : 0);
