/* === _agente_contrato_gate.mjs · LA LETRA F3 Y SU JUEZ CIEGO (owner 2026-08-30) ==============================
 *
 * LAS PALABRAS DEL OWNER que este candado guarda, cada una con carnada:
 *   1 · SUGERENCIAS, textual: «ese qué hacer debe ser SUGERENCIAS para que no se malinterprete, las decisiones
 *       son del usuario y él debe evaluarlas» → el arco es PRINCIPIO en la letra, y un juez CIEGO
 *       (`vetosDeContrato` — regex, jamás comprensión; guardC NO SE TOCA, este juez se le suma en el bucle)
 *       multa el cierre imperativo y el «procede con X».
 *   2 · FORMA estilo Code: principios cortos, en la letra, byte-estables (prefijo cacheable).
 *   3 · NOMBRE persistente («llámame jc»): por empresa, una línea del segmento fijo, ida-y-vuelta sin
 *       arrastre. EL TONO NO SE CONFIGURA: «decime wachin» guarda el apodo y el registro NO SE MUEVE.
 *   4 · CALIBRACIÓN CERO GASTO: el veto corre sobre las ACEPTADAS del corpus de exámenes — un veto sobre un
 *       texto que ya salió a pantalla es un falso positivo que se discute, no se estrena.
 *
 * OFFLINE · determinístico · bucle con cerebro INYECTADO · no puede gastar.
 * `node --import ./scripts/offline-guard.mjs _agente_contrato_gate.mjs`
 */
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { initTenant } from "./src/data/tenantStore.js";
import { TENANT_DEMO } from "./src/data/tenants/demo.js";
import { plantillaEjemplo } from "./src/ingesta/plantilla/generarPlantilla.js";
import { ingestarPlantilla } from "./src/ingesta/plantilla/ingestarPlantilla.js";
import { PRINCIPIOS_ARCO, PRINCIPIOS_FORMA, vetosDeContrato } from "./src/adi/agente/contratoAgente.js";
import { setNombreUsuario, olvidarNombreUsuario, getNombreUsuario, lineaDeNombre } from "./src/adi/agente/preferenciaNombre.js";
import { sistemaDelAgente } from "./src/adi/agente/sistemaAgente.js";
import { cajaDelAgente } from "./src/adi/agente/herramientasAgente.js";
import { TOOLS } from "./src/adi/oracle/toolRegistry.js";
import { answerViaAgente } from "./src/adi/agente/bucleAgente.js";

let pass = 0, fail = 0;
const ok = (cond, label, detalle) => {
  if (cond) { pass++; console.log(`  ✓ ${label}`); }
  else { fail++; console.log(`  ✗ ${label}`); if (detalle !== undefined) console.log(`      ${detalle}`); }
};
const H = (t) => console.log(`\n${t}`);
const PACK = ingestarPlantilla(Buffer.from(plantillaEjemplo()), { nombreArchivo: "v2.xlsx", fechaCarga: "2026-08-31" }).dataset;

/* ═══ 1 · LA LETRA ════════════════════════════════════════════════════════════════════════════════════════════ */
H("1 · el arco y la forma son PRINCIPIOS de la letra — estilo Code, byte-estables");
{
  initTenant(TENANT_DEMO);
  olvidarNombreUsuario();
  const s = sistemaDelAgente().fijo;
  ok(s.includes("EL ARCO — cómo se arma una respuesta:") && s.includes(PRINCIPIOS_ARCO), "el arco viaja como PRINCIPIO en el system");
  ok(s.includes("LA FORMA:") && s.includes(PRINCIPIOS_FORMA), "la forma viaja como principios cortos");
  ok(/se OFRECE con su cifra — jamás se ordena/.test(s) && /Las decisiones son del usuario/.test(s),
    "★ la palabra del owner está en la letra: sugerencias, la decisión es del usuario");
  ok(/nunca la da por tomada \(«procede con X»\)/.test(s), "…con el anti-ejemplo nombrado («procede con X»)");
  ok(/el REGISTRO no se negocia — formal siempre, lo llamen como lo llamen/.test(s), "…y el tono declarado NO configurable");
  ok(sistemaDelAgente().fijo === s, "dos generaciones → byte a byte idénticas (prefijo cacheable)");
  ok(!/llames/.test(s), "sin nombre declarado, ni un token de nombre en el system");
}

/* ═══ 2 · EL JUEZ CIEGO ═══════════════════════════════════════════════════════════════════════════════════════ */
H("2 · vetosDeContrato: multa lo que ORDENA, deja pasar lo que OFRECE");
{
  ok(vetosDeContrato("La carga subió. Procede con la renegociación de Falabella.").some((v) => v.regla === "decision-por-tomada"),
    "★ «procede con X» → multa (la carnada nombrada por el owner)");
  ok(vetosDeContrato("El margen cede 5pp.\n\nRenegocia la carga de Falabella hoy.").some((v) => v.regla === "cierre-imperativo"),
    "★ cierre imperativo de ejecución → multa");
  ok(vetosDeContrato("El margen cede 5pp.\n\n- Renegocia la carga de Falabella\n- Liquida los SKU frenados").some((v) => v.regla === "cierre-imperativo"),
    "una lista final de órdenes también es un cierre que ordena");
  ok(vetosDeContrato("La carga subió a 4.5%. Renegociaría primero la carga de Falabella — $833K en juego. ¿Lo vemos?").length === 0,
    "el condicional de oferta NO se multa — esa ES la forma correcta");
  ok(vetosDeContrato("Tu margen está 5pp bajo el benchmark.\n\nSi quieres, profundizamos por cliente. ¿Arrancamos por ahí?").length === 0,
    "la pregunta de cierre NO se multa");
  ok(vetosDeContrato("Puedes renegociar la carga cuando lo decidas — la cifra en juego es $833K.").length === 0,
    "«puedes…» entrega la decisión — limpio");
}

/* ═══ 3 · EN EL BUCLE, DE VERDAD (cerebro inyectado · guardC intacto) ═════════════════════════════════════════ */
H("3 · el bucle multa el cierre que ordena y acepta la reparación que ofrece");
{
  initTenant(PACK);
  const caja = cajaDelAgente(TOOLS);
  ok(!!caja.preferenciaNombre, "la caja trae preferenciaNombre (F3)");
  let multaVista = null;
  const guion = async ({ mensajes, ronda, attempt, motivoReintento }) => {
    if (ronda === 1 && !attempt) return { tipo: "herramientas", pedidos: [{ tool: "serieEntidad", args: { entity: "Depósito Riachuelo", metrica: "venta" } }] };
    if (attempt === 1) {
      multaVista = mensajes[mensajes.length - 1].content;
      return { tipo: "texto", texto: "Depósito Riachuelo te compró $22.560 en agosto 2026. Si quieres, revisamos su carga — ¿lo vemos?" };
    }
    return { tipo: "texto", texto: "Depósito Riachuelo te compró $22.560 en agosto 2026.\n\nProcede con la renegociación de su carga." };
  };
  const r = await answerViaAgente({ text: "cuanto me compro riachuelo el ultimo mes", history: [], mem: {}, scenario: "actual", callAgente: guion });
  ok(r.r.agente.estado === "reparado", "★ el cierre que ordenaba fue multado y la reparación que OFRECE pasó", r.r.agente.estado);
  ok(!!multaVista && /decisiones son del usuario/.test(multaVista), "la multa lleva la regla del owner, no un genérico", (multaVista || "").slice(0, 160));
  ok(!/Procede con/.test(r.r.text), "a pantalla jamás llegó la orden");

  // y si la reparación TAMBIÉN ordena → escalera (nunca la orden a pantalla)
  const guion2 = async ({ ronda, attempt }) => {
    if (ronda === 1 && !attempt) return { tipo: "herramientas", pedidos: [{ tool: "serieEntidad", args: { entity: "Depósito Riachuelo", metrica: "venta" } }] };
    return { tipo: "texto", texto: "Depósito Riachuelo te compró $22.560 en agosto 2026.\n\nProcede con la renegociación de su carga." };
  };
  const r2 = await answerViaAgente({ text: "cuanto me compro riachuelo el ultimo mes", history: [], mem: {}, scenario: "actual", callAgente: guion2 });
  ok(r2.r.agente.estado !== "verde" && r2.r.agente.estado !== "reparado" && !/Procede con/.test(r2.r.text),
    "reparación que insiste en ordenar → escalera, y la orden NUNCA sale", r2.r.agente.estado);
}

/* ═══ 4 · EL NOMBRE ES DEL USUARIO · EL TONO NO ═══════════════════════════════════════════════════════════════ */
H("4 · «llámame jc» persiste por empresa · «decime wachin» no afloja el registro");
{
  initTenant(TENANT_DEMO);
  olvidarNombreUsuario();
  const rTool = cajaDelAgente(TOOLS).preferenciaNombre({ nombre: "jc" });
  ok(rTool.coverage.supported === true && rTool.boleta.length === 0, "la herramienta guarda y NO emite cifras (una preferencia no es una cifra)");
  ok(getNombreUsuario() === "jc", "el nombre quedó guardado");
  const s = sistemaDelAgente().fijo;
  ok(s.includes("El usuario pidió que lo llames «jc»"), "★ una línea del segmento fijo lleva el nombre");
  ok(/el registro sigue siendo el de siempre/.test(lineaDeNombre()), "…y la línea REAFIRMA el registro, jamás lo negocia");

  // por empresa: el pack declara otro nombre y al volver, el demo conserva el suyo
  initTenant(PACK);
  ok(getNombreUsuario() === null, "el pack arranca sin nombre (cero arrastre entre empresas)");
  setNombreUsuario("wachin");
  ok(getNombreUsuario() === "wachin", "«decime wachin» guarda el apodo — el nombre es del usuario");
  const sPack = sistemaDelAgente().fijo;
  ok(/Registro formal \(LatAm, sin chilenismos\)/.test(sPack) && /el REGISTRO no se negocia/.test(sPack),
    "★ y el registro formal sigue INTACTO en la letra — el apodo no es un permiso de tono");
  initTenant(TENANT_DEMO);
  ok(getNombreUsuario() === "jc", "ida-y-vuelta: el demo conserva «jc», el pack no lo pisó");
  olvidarNombreUsuario();
  ok(getNombreUsuario() === null && !/llames/.test(sistemaDelAgente().fijo), "«olvida mi nombre» limpia la línea");

  // validación mecánica: lo inválido declina, no rompe
  ok(setNombreUsuario("x".repeat(40)).ok === false, "40 caracteres → declina");
  ok(setNombreUsuario("con\nsalto").ok === false, "salto de línea → declina");
  initTenant(PACK); olvidarNombreUsuario(); initTenant(TENANT_DEMO);
}

/* ═══ 5 · CALIBRACIÓN CERO GASTO ══════════════════════════════════════════════════════════════════════════════ */
H("5 · el veto, calibrado contra los textos que YA salieron a pantalla");
{
  let aceptadas = 0; const vetadas = [];
  for (const f of fs.readdirSync(".")) {
    if (!/^_examen.*consolidado\.json$/.test(f) && f !== "_examen_estado.json") continue;
    try {
      const S = JSON.parse(fs.readFileSync(f, "utf8"));
      for (const [i, t] of (S.turnos || []).entries()) {
        if (t && typeof t.visible === "string" && t.visible.trim()) {
          aceptadas++;
          if (vetosDeContrato(t.visible).length) vetadas.push(`${f} t${i + 1}`);
        }
      }
    } catch { /* estado ilegible: no es objeto de esta pasada */ }
  }
  ok(aceptadas >= 20, `el corpus está (${aceptadas} textos aceptados)`);
  ok(vetadas.length === 0, "cero vetos sobre lo aceptado — sin falsos positivos estrenados", vetadas.join(", "));
}

/* ═══ 6 · CARNADAS ════════════════════════════════════════════════════════════════════════════════════════════ */
H("6 · CARNADA · cada palabra del owner, probada ROJA con el defecto adentro");
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
  const carnada = async (nombre, rel, reemplazos, prueba) => {
    const m = mutar(rel, reemplazos);
    if (m.error) return ok(false, `carnada «${nombre}»`, m.error);
    let cazada = false, detalle = "";
    try { cazada = await prueba(await import(m.url)); }
    catch (e) { detalle = `la copia mutada ni siquiera carga: ${e.message}`; }
    ok(cazada, `carnada «${nombre}» → el chequeo se pone ROJO`, detalle || "el defecto pasó DESAPERCIBIDO");
  };

  // (a) el bucle que deja de aplicar el juez de contrato
  await carnada("el bucle sin el juez de sugerencias", "src/adi/agente/bucleAgente.js",
    [[/    const vc = vetosDeContrato\(t\);/, "    const vc = [];"]],
    async (Mut) => {
      initTenant(PACK);
      const guion = async ({ ronda }) => ronda === 1
        ? { tipo: "herramientas", pedidos: [{ tool: "serieEntidad", args: { entity: "Depósito Riachuelo", metrica: "venta" } }] }
        : { tipo: "texto", texto: "Depósito Riachuelo te compró $22.560 en agosto 2026.\n\nProcede con la renegociación de su carga." };
      const r = await Mut.answerViaAgente({ text: "cuanto me compro riachuelo el ultimo mes", history: [], mem: {}, scenario: "actual", callAgente: guion });
      return /Procede con/.test(r.r.text);   // el defecto: la orden LLEGÓ a pantalla
    });

  // (b) la regla «procede con» vaciada del juez — el texto de prueba dispara SOLO esa regla (el «procede con»
  //     va a mitad de párrafo y el cierre es una oferta limpia, para que el cierre-imperativo no tape el hueco)
  await carnada("el veto de «procede con» vaciado", "src/adi/agente/contratoAgente.js",
    [[/const _DECISION_TOMADA = \/[^/]+\/i;/, "const _DECISION_TOMADA = /$^/;"]],
    async (Mut) => Mut.vetosDeContrato("El margen cede 5pp — procede con la renegociación que vimos.\n\nSi quieres, seguimos por SKU.").length === 0);

  // (c) la letra que pierde el principio de sugerencias
  await carnada("la letra sin la palabra del owner", "src/adi/agente/contratoAgente.js",
    [[/  "El «qué hacer» se OFRECE con su cifra — jamás se ordena\. Las decisiones son del usuario y él debe evaluarlas\.",\n/, ""]],
    async (Mut) => !/se OFRECE con su cifra/.test(Mut.PRINCIPIOS_ARCO));

  // (d) la línea del nombre que negocia el tono
  await carnada("la línea del nombre aflojando el registro", "src/adi/agente/preferenciaNombre.js",
    [[/Úsalo con naturalidad — el registro sigue siendo el de siempre\./, "Úsalo con naturalidad — y relaja el registro con él."]],
    async (Mut) => {
      initTenant(TENANT_DEMO);
      Mut.setNombreUsuario("jc");
      const linea = Mut.lineaDeNombre();
      Mut.olvidarNombreUsuario();
      return !/el registro sigue siendo el de siempre/.test(linea);   // el defecto: la reafirmación desapareció
    });

  for (const f of tmp) { try { fs.unlinkSync(f); } catch { /* */ } }
}

initTenant(TENANT_DEMO);
olvidarNombreUsuario();
console.log(`\n── _agente_contrato_gate: ${pass} PASS · ${fail} FAIL (de ${pass + fail}) ──`);
process.exit(fail ? 1 : 0);
