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
import { PRINCIPIOS_ARCO, PRINCIPIOS_FORMA, PRINCIPIOS_RUTEO, vetosDeContrato } from "./src/adi/agente/contratoAgente.js";
import { mapaDelDato } from "./src/adi/agente/mapaDelDato.js";   // [9] · la vara y el límite de bodega, declarados
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
  // la reafirmación se endureció con la palabra del owner (2026-08-31): el nombre es SOLO la forma de trato
  ok(/Es SOLO la forma de trato: el registro sigue siendo ejecutivo y formal/.test(lineaDeNombre()),
    "…y la línea REAFIRMA el registro, jamás lo negocia");

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
  /* R8 (2026-08-31) · UNA EXCEPCIÓN DECLARADA, no una relajación: el t5 del examen 2 dice «escenarios» y fue
   * aceptado ANTES del colapso del eje — hoy el criterio es binario (cero «escenario» en pantalla) y el propio
   * narrador natural lo reescribiría. El récord del examen no se edita; la excepción se declara con su regla
   * exacta, y si el texto dejara de vetear (la regla se aflojó) la excepción quedaría estéril y ESO también
   * se caza. */
  const EXENTOS = { "_examen2_consolidado.json t5": "lexico-escenario" };
  const noExentas = vetadas.filter((v) => !EXENTOS[v]);
  ok(noExentas.length === 0, "cero vetos sobre lo aceptado — sin falsos positivos estrenados", noExentas.join(", "));
  ok(vetadas.some((v) => EXENTOS[v]), "…y la excepción declarada (t5 pre-colapso) SIGUE vetando — si esto falla, la regla se aflojó o el récord cambió");
}

/* ═══ 5b · R8 · EL LÉXICO DE SUPERFICIE CAZA LAS FUGAS MEDIDAS (verbatim del examen) ══════════════════════════ */
H("5b · R8: cada fuga que llegó a pantalla en el examen, hoy vetada");
{
  const caza = (texto, regla, etiqueta) => {
    const v = vetosDeContrato(texto);
    ok(v.some((x) => x.regla === regla), `${etiqueta} → ${regla}`, JSON.stringify(v.map((x) => x.regla)));
  };
  caza("O si prefieres que simule el escenario donde Falabella efectivamente tuviera 30% de margen.", "lexico-escenario", "T25 · «simule el escenario»");
  caza("Ese $194K es un dato de tensión, no de volumen.", "lexico-tension", "T9 · «dato de tensión»");
  caza("No tengo la serie mensual desagregada (la herramienta de histórico por entidad está bloqueada).", "lexico-herramienta", "T9-T12 · «la herramienta … bloqueada»");
  caza("Con eso puedo tirarte la cifra limpia. ¿Me das esos tres datos?", "lexico-tirar", "T9 · «tirarte la cifra»");
  caza("Necesito exactamente 2 variables distintas — precio (precioLista) y volumen, cada una con su % de cambio.", "identificador-interno", "T2 · «precioLista» verbatim");
  caza("El plan pide inventoryStatus antes de responder.", "identificador-interno", "nombre de tool camelCase");
  // y lo LEGÍTIMO pasa: la familia real del pack, la palabra común que también nombra una tool, el registro sano
  ok(vetosDeContrato("La familia Herramientas concentra $18K de venta en el período.").length === 0,
    "«la familia Herramientas» (entidad real del pack ferretero) pasa LIMPIA — jamás se reescribe un nombre");
  ok(vetosDeContrato("Sí se puede calcular: 4 de los 5 SKU explican el 85.7%.").length === 0,
    "«calcular» (palabra común que también es nombre de tool) pasa — solo se veta el camelCase reconocible");
  ok(vetosDeContrato("Te traigo la cifra verificada del período y la trabajamos juntos.").length === 0,
    "el registro sano pasa sin vetos");
}

/* ═══ 5d · EL REGISTRO NO SE NEGOCIA POR PREFERENCIA (owner 2026-08-31, tras la corrida 3) ════════════════════
 * «No quiero que use esas cosas, que use el NOMBRE de usuario… ahora es ejecutivo» (textual). El apodo había
 * arrastrado el registro a once turnos VISIBLES. Los nueve casos de abajo son verbatim del expediente. */
H("5d · las aperturas y muletillas coloquiales se vetan — el NOMBRE queda exento");
{
  const reglas = (t) => vetosDeContrato(t).map((v) => v.regla);
  const CASOS_REALES = [
    ["T9", "wachin, acá está lo que mueve aguja:\n\n**Qué pasa:** Ocho clientes venden bajo el benchmark."],
    ["T11", "wachin, acá está: el margen promedio de la cartera es 25,1%."],
    ["T12", "wachin, acá está claro:\n\n**DATO DURO:**\n- Falabella: margen 22%"],
    ["T15", "wachin, acá está, corregido:\n\n**DATO DURO:** $33K de capital frenado."],
    ["T18", "wachin, acá está verificado:\n\n**DATO DURO — LG-DRYER8KG:**"],
    ["T23", "wachin, acá está el impacto de bajar 2 pp de carga comercial."],
    ["T26", "wachin, acá está lo que mueve aguja sin tocar precio:"],
  ];
  for (const [n, txt] of CASOS_REALES) {
    ok(reglas(txt).includes("registro-coloquial"), `★ ${n} verbatim de la corrida 3 → registro-coloquial`, JSON.stringify(reglas(txt)));
  }
  // EL NOMBRE ESTÁ EXENTO, y es el punto: el trato no es una fuga, el tono sí
  ok(vetosDeContrato("wachin, la cartera promedia 25,1% contra un benchmark de 30,1%.").length === 0,
    "★ el MISMO trato, con registro ejecutivo, pasa LIMPIO — se veta el relleno, no a quién le habla");
  ok(vetosDeContrato("jc: Benchmark de margen: 30,1%. Clientes bajo el benchmark: 8.").length === 0,
    "…y el trato en la forma del rescate («jc: …») también");
  ok(/Es SOLO la forma de trato/.test(lineaDeNombre()) === false, "sin nombre declarado, la línea sigue vacía (cero tokens)");
  setNombreUsuario("wachin");
  ok(/Es SOLO la forma de trato: el registro sigue siendo ejecutivo/.test(lineaDeNombre()),
    "con nombre, la letra que viaja al cerebro dice que NADA MÁS cambia", lineaDeNombre());
  olvidarNombreUsuario();
  // CALIBRACIÓN: ni una de estas formas aparece en el corpus del camino natural (cero falsos positivos)
  let vistos = 0; const falsos = [];
  for (const f of fs.readdirSync(".")) {
    if (!/^_examen.*consolidado\.json$/.test(f)) continue;
    try {
      const S = JSON.parse(fs.readFileSync(f, "utf8"));
      for (const [i, t] of (S.turnos || []).entries()) {
        const vis = t && typeof t.visible === "string" ? t.visible : "";
        if (!vis.trim()) continue;
        vistos++;
        if (vetosDeContrato(vis).some((v) => v.regla === "registro-coloquial")) falsos.push(`${f} t${i + 1}`);
      }
    } catch { /* ilegible */ }
  }
  ok(vistos >= 20 && falsos.length === 0,
    `cero falsos positivos de registro sobre las ${vistos} respuestas ya aceptadas`, falsos.join(", "));

  /* EL AGUJERO DEL VOSEO, cazado al calibrar lo de arriba: `\b` se define sobre [A-Za-z0-9_], así que un
   * patrón terminado en `[aá]\b` NO matchea la forma acentuada — el cierre imperativo que el owner blindó
   * estaba ciego en TODAS las formas rioplatenses, que son las que este usuario ve. */
  for (const orden of ["Ejecutá la baja de carga en Falabella", "Renegociá la carga de Falabella", "Liquidá los SKU frenados", "Implementá el ajuste de carga", "Aplicá el descuento acordado"]) {
    ok(reglas(`El margen cede 5pp.\n\n${orden}.`).includes("cierre-imperativo"), `★ voseo: «${orden.split(" ")[0]}» → cierre-imperativo`);
  }
  ok(reglas("El margen cede 5pp.\n\nProcede con la renegociación.").includes("cierre-imperativo"),
    "…y la forma sin acento sigue cazada igual (no se cambió una ceguera por otra)");
  ok(vetosDeContrato("El margen cede 5pp. Renegociaría primero la carga de Falabella — $833K en juego. ¿Lo vemos?").length === 0,
    "…y el condicional de oferta sigue limpio: se corrigió el fin de palabra, no la regla");
}

/* ═══ 5e · EL TRATO PERSISTE POR LA MEMORIA DEL TURNO (la causa real del rescate sin nombre) ═════════════════
 * MEDIDO (no supuesto): `preferenciaNombre` guarda en el módulo + localStorage, y la consola del examen corre
 * UN PROCESO POR TURNO sin localStorage — el nombre registrado se perdía al terminar ese proceso. Por eso el
 * trato solo aparecía cuando el cerebro volvía a llamar la herramienta en el MISMO turno (T6 sí, T7 no), y lo
 * que parecía «el apodo persiste once turnos» era el modelo copiándolo del hilo. */
H("5e · el trato viaja en `mem`: sobrevive al turno siguiente aunque el proceso sea nuevo");
{
  initTenant(PACK);
  olvidarNombreUsuario();
  const mudo = async () => ({ tipo: "texto", texto: "" });
  const guionRegistra = async ({ ronda }) => (ronda === 1
    ? { tipo: "herramientas", pedidos: [{ tool: "preferenciaNombre", args: { nombre: "wachin" } }, { tool: "serieEntidad", args: { entity: "Depósito Riachuelo", metrica: "venta" } }] }
    : { tipo: "texto", texto: "" });
  const t1 = await answerViaAgente({ text: "mejor decime wachin. y el inventario como esta?", history: [], mem: {}, scenario: "actual", callAgente: guionRegistra });
  ok(/^wachin: /.test(t1.r.text), "el turno que registra el apodo ya lo usa en su rescate", t1.r.text.slice(0, 60));
  ok(t1.mem.nombreUsuario === "wachin", "★ y el trato queda en la memoria del turno, no solo en el módulo");

  olvidarNombreUsuario();   // simula el PROCESO NUEVO del turno siguiente en la consola (sin localStorage)
  const t2 = await answerViaAgente({ text: "y el margen?", history: [], mem: t1.mem, scenario: "actual", callAgente: mudo });
  ok(/^wachin: /.test(t2.r.text),
    "★ el turno siguiente —proceso nuevo, módulo vacío— recupera el trato desde `mem`", t2.r.text.slice(0, 60));
  olvidarNombreUsuario();
  const t3 = await answerViaAgente({ text: "y el margen?", history: [], mem: {}, scenario: "actual", callAgente: mudo });
  ok(!/^wachin: /.test(t3.r.text), "…y sin memoria no se inventa un trato que el usuario no pidió");
}

/* ═══ 5c · [9] DEL EXAMEN 1 · LOS REFUERZOS DE RUTEO Y DEL MAPA, CABLEADOS ════════════════════════════════════ */
H("5c · [9]: los tres desvíos medidos tienen letra, y el mapa distingue la vara del promedio");
{
  ok(/simulación — jamás por el resumen ejecutivo/.test(PRINCIPIOS_RUTEO), "T21 · la proyección rutea a simulación (letra)");
  ok(/ejecuta el cálculo ETIQUETADO con la interpretación declarada/.test(PRINCIPIOS_RUTEO), "T23 · el cálculo pre-autorizado se ejecuta, no se frena (letra)");
  ok(/solo ofrece cortes que el dato sostiene/.test(PRINCIPIOS_RUTEO), "T22 · el menú no promete lo incumplible (letra)");
  const fijo = sistemaDelAgente("actual").fijo;
  ok(/RUTEO Y CÁLCULO:/.test(fijo) && /jamás por el resumen ejecutivo/.test(fijo), "…y la letra VIAJA en el system del agente");
  initTenant(TENANT_DEMO);
  const mapa = mapaDelDato("bonanza");
  ok(/BENCHMARK de margen: 30\.1% — vara DECLARADA del negocio\. NO es el promedio de la cartera/.test(mapa),
    "T3 · el mapa declara la vara Y que NO es el promedio (30.1% del demo, por fila)");
  ok(/sin cruce cliente×bodega \(los universos no reconcilian\)/.test(mapa),
    "T22 · el mapa declara el límite estructural de bodega");
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
  // (el sitio de la mutación creció al sumarse la lista notarial de los playbooks al MISMO juez — la carnada
  //  sigue midiendo lo mismo: sin el juez de contrato, la orden llega a pantalla)
  await carnada("el bucle sin el juez de sugerencias", "src/adi/agente/bucleAgente.js",
    [[/    const vc = \[\.\.\.vetosDeContrato\(t\), \.\.\.\(playbookActivo \? vetosDelPlaybook\(playbookActivo, t, \{ figs: figsTotales \}\) : \[\]\)\];/, "    const vc = [];"]],
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

  // (b2) R8 · el veto de «escenario» vaciado: la fuga BINARIA del examen (T25) vuelve a pasar desapercibida
  await carnada("el léxico de escenario vaciado", "src/adi/agente/contratoAgente.js",
    [[/\{ re: \/\\bescenarios\?\\b\/i, regla: "lexico-escenario",/, '{ re: /$^/, regla: "lexico-escenario",']],
    async (Mut) => Mut.vetosDeContrato("O si prefieres que simule el escenario donde Falabella tuviera 30% de margen.").length === 0);

  // (b3) R8 · los identificadores internos sin filtro camelCase: «calcular» del corpus vuelve a caer
  await carnada("identificadores sin el filtro camelCase", "src/adi/agente/contratoAgente.js",
    [[/    \.filter\(\(n\) => \/\[A-Z\]\/\.test\(n\.slice\(1\)\)\);/, "    ;"]],
    async (Mut) => Mut.vetosDeContrato("Sí se puede calcular: 4 de los 5 SKU explican el 85.7%.").some((x) => x.regla === "identificador-interno"));

  // (b4) registro · la familia coloquial vaciada: los siete «acá está» de la corrida 3 vuelven a pantalla
  await carnada("registro coloquial sin vigilar", "src/adi/agente/contratoAgente.js",
    [[/  \{ re: new RegExp\(`\\\\b\(\?:ac\[aá\]\|aqu\[ií\]\)/, '  { re: new RegExp(`$^(?:ac[aá]|aqu[ií])']],
    async (Mut) => Mut.vetosDeContrato("wachin, acá está claro:\n\n**DATO DURO:** Falabella margen 22%.").length === 0);

  // (b5) el fin de palabra sin las vocales acentuadas: vuelve el agujero del voseo (medido en este juez)
  await carnada("fin de palabra ciego al acento (el agujero del voseo)", "src/adi/agente/contratoAgente.js",
    [[/const _FIN = "\(\?!\[a-záéíóúüñ\]\)";/, 'const _FIN = "\\\\b";']],
    async (Mut) => {
      const sinAcento = Mut.vetosDeContrato("El margen cede 5pp.\n\nProcede con la renegociación.").some((v) => v.regla === "cierre-imperativo");
      const conAcento = Mut.vetosDeContrato("El margen cede 5pp.\n\nRenegociá la carga de Falabella.").some((v) => v.regla === "cierre-imperativo");
      return sinAcento && !conAcento;   // el defecto: caza la forma sin acento y es ciego a la acentuada
    });

  // (c2) [9] · la letra de ruteo que pierde el desvío de T21 (proyección → simulación)
  await carnada("la letra de ruteo sin el desvío de la proyección", "src/adi/agente/contratoAgente.js",
    [[/  "Una proyección pedida \(«proyecta \+4%», «qué pasa si sube X»\) va por las herramientas de simulación — jamás por el resumen ejecutivo\.",\n/, ""]],
    async (Mut) => !/jamás por el resumen ejecutivo/.test(Mut.PRINCIPIOS_RUTEO));

  // (c) la letra que pierde el principio de sugerencias
  await carnada("la letra sin la palabra del owner", "src/adi/agente/contratoAgente.js",
    [[/  "El «qué hacer» se OFRECE con su cifra — jamás se ordena\. Las decisiones son del usuario y él debe evaluarlas\.",\n/, ""]],
    async (Mut) => !/se OFRECE con su cifra/.test(Mut.PRINCIPIOS_ARCO));

  // (d) la línea del nombre que negocia el tono
  await carnada("la línea del nombre aflojando el registro", "src/adi/agente/preferenciaNombre.js",
    [[/Es SOLO la forma de trato: el registro sigue siendo ejecutivo y formal — nada de aperturas ni muletillas coloquiales por tener su nombre\./,
      "Úsalo con naturalidad — y relaja el registro con él."]],
    async (Mut) => {
      initTenant(TENANT_DEMO);
      Mut.setNombreUsuario("jc");
      const linea = Mut.lineaDeNombre();
      Mut.olvidarNombreUsuario();
      return !/el registro sigue siendo ejecutivo y formal/.test(linea);   // el defecto: la reafirmación desapareció
    });

  for (const f of tmp) { try { fs.unlinkSync(f); } catch { /* */ } }
}

initTenant(TENANT_DEMO);
olvidarNombreUsuario();
console.log(`\n── _agente_contrato_gate: ${pass} PASS · ${fail} FAIL (de ${pass + fail}) ──`);
process.exit(fail ? 1 : 0);
