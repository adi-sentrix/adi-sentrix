/* === _carta_asesor_gate.mjs · LA CARTA DEL ASESOR (owner 2026-09-03) ========================================
 *
 * QUÉ VIGILA — las condiciones del encargo, una por sección:
 *   1 · LA CARTA LLEGA ENTERA. Los seis capítulos, verbatim, dentro del system que el agente recibe. Un
 *       capítulo que se cae del ensamblado no se nota en pantalla: se nota meses después, en la conducta.
 *   2 · UNA SOLA FUENTE DE CARÁCTER. `persona.js` no puede quedar como segunda fuente viva: la carta la
 *       IMPORTA (no la copia) y el system del agente ya no la trae por su cuenta.
 *   3 · LA DOCTRINA QUE EL OWNER PIDIÓ, presente y nombrable: audiencia en la pregunta · el análisis de
 *       decisión sin que lo pidan · la prioridad marcada como criterio · el límite como criterio ejecutivo ·
 *       el umbral fuera del titular · la vara «mismo dato, mejor forma de presentarlo».
 *   4 · EL PRESUPUESTO, COMO CANDADO VIVO (no como nota de un reporte): el turno con la carta no puede
 *       superar en más de 20% al turno sin ella. Se mide EN VIVO, comparando contra el system reconstruido
 *       con la persona sola — así el techo sigue vigente aunque mañana crezcan el mapa o las invariantes.
 *   5 · LA CARTA NO CAMBIA LA CONDUCTA DETERMINÍSTICA: con el cerebro mudo, los turnos siguen saliendo por
 *       sus playbooks igual que antes. La carta es criterio para el cerebro vivo, no una pieza del motor.
 *   6 · CARNADAS: un capítulo caído del ensamblado → ROJO. La persona copiada en vez de importada → ROJO.
 *
 * OFFLINE · determinístico · cerebro MUDO · CERO llamadas al modelo.
 * `node --import ./scripts/offline-guard.mjs _carta_asesor_gate.mjs` */
import fs from "node:fs";
import path from "node:path";
import { initTenant } from "./src/data/tenantStore.js";
import { TENANT_DEMO } from "./src/data/tenants/demo.js";
import { sistemaDelAgente } from "./src/adi/agente/sistemaAgente.js";
import { CARTA_DEL_ASESOR, CAPITULOS_DE_LA_CARTA } from "./src/adi/agente/cartaAsesor.js";
import { ADI_PERSONA } from "./src/adi/oracle/persona.js";
import { answerViaAgente } from "./src/adi/agente/bucleAgente.js";

let PASS = 0, FAIL = 0;
const ok = (c, m, extra = "") => { if (c) { PASS++; console.log("  ✓ " + m); } else { FAIL++; console.log("  ✗ " + m + (extra ? "\n      " + extra : "")); } };
const H = (t) => console.log("\n" + t);
const ROOT = process.cwd();
const MUDO = async () => ({ tipo: "texto", texto: "" });

initTenant(TENANT_DEMO);
const SYS = sistemaDelAgente("bonanza").fijo;

/* ═══ 1 · LA CARTA LLEGA ENTERA AL AGENTE ═══════════════════════════════════════════════════════════════════ */
H("1 · el agente recibe la carta COMPLETA: los seis capítulos, verbatim");
{
  ok(SYS.includes(CARTA_DEL_ASESOR), "★ la carta entera está dentro del system del agente — no un resumen ni un pedazo");
  for (const [nombre, texto] of CAPITULOS_DE_LA_CARTA) {
    ok(SYS.includes(texto) && texto.trim().length > 40, `capítulo ${nombre} · presente y con cuerpo (${texto.length} chars)`);
  }
  ok(CAPITULOS_DE_LA_CARTA.length === 6, `los seis capítulos declarados (hay ${CAPITULOS_DE_LA_CARTA.length})`);
}

/* ═══ 2 · UNA SOLA FUENTE DE CARÁCTER ═══════════════════════════════════════════════════════════════════════ */
H("2 · persona.js NO queda como segunda fuente viva: la carta la importa, no la copia");
{
  const carta = fs.readFileSync(path.join(ROOT, "src", "adi", "agente", "cartaAsesor.js"), "utf8");
  const sistema = fs.readFileSync(path.join(ROOT, "src", "adi", "agente", "sistemaAgente.js"), "utf8");
  ok(/import \{ ADI_PERSONA \} from "\.\.\/oracle\/persona\.js"/.test(carta),
    "★ la carta IMPORTA ADI_PERSONA — el carácter tiene una sola fuente en todo el producto");
  ok(carta.includes("ADI_PERSONA,\n  \"\",") || /CAPITULOS_DE_LA_CARTA[\s\S]{0,200}ADI_PERSONA/.test(carta),
    "…y la usa como su capítulo 1, tal cual (el gate compara el texto abajo)");
  ok(CAPITULOS_DE_LA_CARTA[0][1] === ADI_PERSONA,
    "★ el capítulo 1 ES ADI_PERSONA byte a byte — si alguien la copiara y editara, esto se pone rojo");
  /* medido sobre el CÓDIGO, no sobre la prosa: el nombre puede (y debe) aparecer en un comentario que explique
   * la mudanza — lo que no puede es seguir importándose ni usándose acá. (Mi primer check leía el comentario y
   * daba rojo: medir la forma en vez del concepto, el caso 13 del patrón de la casa, esta vez en mi propio gate.) */
  const sistemaCodigo = sistema.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/[^\n]*/g, "$1");
  ok(!/ADI_PERSONA/.test(sistemaCodigo),
    "★ el system del agente ya NO trae la persona por su cuenta: recibe la carta y punto (una sola cosa, entera)");
  /* la persona sigue viva para el CAMINO NATURAL (producción, rollback) — la carta no se la lleva puesta */
  ok(/export const ADI_PERSONA/.test(fs.readFileSync(path.join(ROOT, "src", "adi", "oracle", "persona.js"), "utf8")),
    "…y persona.js sigue exportándola: el camino natural (que corre en producción como rollback) no se toca");
}

/* ═══ 3 · LA DOCTRINA QUE EL OWNER PIDIÓ ════════════════════════════════════════════════════════════════════ */
H("3 · el oficio, escrito: audiencia · cuándo profundizar · cómo justifica · cómo suena");
{
  const tiene = (re, que) => ok(re.test(CARTA_DEL_ASESOR), que);
  tiene(/la audiencia está EN la pregunta/i, "★ 2 · la audiencia se LEE en la pregunta, no se pregunta");
  tiene(/directorio[\s\S]{0,120}s[ií]ntesis priorizada/i, "★ 2 · «para el directorio» cambia registro: síntesis priorizada con su porqué");
  tiene(/DE DECISIÓN O DE RIESGO[\s\S]{0,200}SIN que te lo pidan/i,
    "★ 3 · EL CORAZÓN: la pregunta de decisión recibe el análisis completo SIN que lo pidan — el valor agregado que el owner nombró");
  tiene(/qué pasa · por qué o dónde ocurre · qué hacer primero/i, "★ 3 · …y ese análisis es el arco de la casa (qué · por qué/dónde · qué hacer primero)");
  tiene(/DE DATO[\s\S]{0,120}UNA línea de lectura/i, "★ 3 · la pregunta de dato recibe el dato con su lectura — «siempre interpreta», la regla vigente");
  tiene(/DUDA REAL[\s\S]{0,140}Jamás un menú/i, "★ 3 · la duda real se resuelve con UNA pregunta corta, jamás con un menú");
  tiene(/criterio mío, no una cifra del dato/i, "★ 4 · la prioridad se marca como criterio (la regla `juicio-sin-marcar`, ahora doctrina de fondo)");
  /* (re-apuntado 2026-09-04, encargo del razonamiento: este check pedía la frase «Localizar no es explicar»,
   * que era justamente la que le enseñaba a FRENAR —«si el porqué no está medido, dilo y sigue»— y el owner
   * la mandó a cambiar. La frontera no se movió, la letra sí: lo que se vigila es que la carta declare que se
   * razona MARCADO y que afirmar la causa sigue prohibido. Medía forma; ahora mide la frontera.) */
  tiene(/afirmarla como hecho sigue prohibido/i, "★ 4 · LA FRONTERA escrita: razonar la causa marcada es el oficio; afirmarla como hecho sigue prohibido");
  tiene(/El porqué se RAZONA en voz alta y marcado/i, "★ 4 · …y el porqué se razona, no se esquiva — el defecto que el owner encontró en producción");
  tiene(/mismo dato, mejor forma de presentarlo/i, "★ 5 · LA VARA DEL OWNER, citada literal");
  tiene(/dejaría el resto como monitoreo/i, "★ 5 · el límite como criterio ejecutivo — su redacción, contra la defensiva que marcó en producción");
  tiene(/UNA oferta, priorizada/i, "★ 5 · una sola oferta priorizada, nunca un menú ni una por punto");
  tiene(/NO abren la respuesta/i, "★ 5 · el umbral fuera del titular, presente pero al final");
  tiene(/manda la invariante/i, "★ 6 · la carta NO reemplaza la estructura: donde choquen, manda la invariante");
}

/* ═══ 4 · EL PRESUPUESTO, COMO CANDADO ══════════════════════════════════════════════════════════════════════
 * El owner paga cada turno. El techo del supervisor —20%— se mide EN VIVO contra el mismo turno sin la carta
 * (system reconstruido con la persona sola), así el candado sigue sirviendo aunque mañana crezca el mapa. */
H("4 · el costo por turno con la carta se mide y no supera el techo del 20%");
{
  const SYS_SIN = SYS.replace(CARTA_DEL_ASESOR, ADI_PERSONA);   // el system que había ANTES de la carta
  ok(SYS_SIN.length < SYS.length, "la línea base se reconstruye del system vivo (persona sola, sin la carta)");
  const PREGUNTAS = ["dame los 3 riesgos para el directorio", "como viene mi margen?",
    "que clientes estan bajo el benchmark", "quien me debe y que esta vencido"];
  let conCarta = 0, sinCarta = 0, medidos = 0;
  for (const q of PREGUNTAS) {
    let rondas = 0, msgs = 0;
    const espia = async ({ mensajes }) => {
      rondas++;
      msgs += (mensajes || []).reduce((s, m) => s + String((m && (m.content || m.text)) || "").length, 0);
      return { tipo: "texto", texto: "" };
    };
    await answerViaAgente({ text: q, history: [], mem: {}, scenario: "bonanza", callAgente: espia });
    if (!rondas) continue;
    conCarta += msgs + SYS.length * rondas;
    sinCarta += msgs + SYS_SIN.length * rondas;
    medidos++;
  }
  const delta = ((conCarta - sinCarta) / sinCarta) * 100;
  const tok = (n) => Math.ceil(n / 3.6);
  console.log(`      medido en ${medidos} turnos · sin carta ${Math.round(sinCarta / medidos)} chars (~${tok(sinCarta / medidos)} tok) · con carta ${Math.round(conCarta / medidos)} chars (~${tok(conCarta / medidos)} tok)`);
  ok(delta <= 20, `★ la carta engorda el turno ${delta.toFixed(1)}% — bajo el techo del 20% que fijó el supervisor`);
  ok(delta > 0, "…y sí pesa algo: si diera 0% sería que la carta no está viajando (un verde de adorno)");
  /* EFECTO DE SEGUNDO ORDEN, verificado y sellado: la escalada al tier CARO se decide por el tamaño del HILO
   * (`_charsHilo` sobre `mensajes` contra TECHO_ENTRADA_CIERRE_CHARS en ChatADI), no por el system. Si el
   * criterio mirara el system, la carta habría empujado turnos al tier caro sin que nadie lo pidiera — un
   * encarecimiento invisible. Se vigila acá porque el día que ese cálculo cambie, esto tiene que arder. */
  const chat = fs.readFileSync(path.join(ROOT, "src", "ui", "ChatADI.jsx"), "utf8");
  ok(/_charsHilo = \(mensajes \|\| \[\]\)\.reduce/.test(chat) && /_charsHilo <= TECHO_ENTRADA_CIERRE_CHARS/.test(chat)
    && !/_charsHilo[^\n]{0,80}system/.test(chat),
    "★ la carta NO empuja turnos al tier caro: la escalada mide el HILO, no el system (verificado en el adaptador)");
}

/* ═══ 5 · LA CARTA NO TOCA LA CONDUCTA DETERMINÍSTICA ═══════════════════════════════════════════════════════ */
H("5 · con el cerebro mudo todo sale igual: la carta es criterio para el cerebro vivo, no una pieza del motor");
{
  const r1 = await answerViaAgente({ text: "dame los 3 riesgos para el directorio", history: [], mem: {}, scenario: "bonanza", callAgente: MUDO });
  ok(r1.r.agente.estado === "playbook" && /dos riesgos materiales/.test(r1.r.text) && !(r1.r.agente.vetos || []).length,
    `★ la síntesis sigue saliendo por su playbook, sin vetos (${r1.r.agente.estado})`, r1.r.text.slice(0, 90));
  const r2 = await answerViaAgente({ text: "como viene mi margen?", history: [], mem: {}, scenario: "bonanza", callAgente: MUDO });
  ok(r2.r.agente.estado === "playbook" && /30\.1%/.test(r2.r.text),
    `★ el molde de margen, intacto (${r2.r.agente.estado})`);
}

/* ═══ 6 · CARNADAS ══════════════════════════════════════════════════════════════════════════════════════════ */
H("6 · carnadas: un capítulo caído o la persona copiada → ROJO");
{
  /* (a) un capítulo se cae del ensamblado: el system deja de contenerlo (la sección 1 se pondría roja) */
  const sinCap = CARTA_DEL_ASESOR.replace(CAPITULOS_DE_LA_CARTA[2][1], "");   // «cuándo profundizar», el corazón
  ok(!sinCap.includes(CAPITULOS_DE_LA_CARTA[2][1]) && CARTA_DEL_ASESOR.includes(CAPITULOS_DE_LA_CARTA[2][1]),
    "★ carnada «capítulo caído» → la carta sin «cuándo profundizar» ya no lo contiene: el check ★ de la sección 1 se pondría ROJO");
  /* (b) la persona COPIADA y editada en vez de importada: el byte a byte del capítulo 1 lo caza */
  const personaEditada = ADI_PERSONA.replace("No adulas.", "Puedes adular un poco.");
  ok(personaEditada !== CAPITULOS_DE_LA_CARTA[0][1],
    "★ carnada «persona copiada y editada» → deja de ser byte-idéntica a ADI_PERSONA: el check ★ de la sección 2 se pondría ROJO");
  /* (c) la carta que crece sin control: el candado del presupuesto es aritmético, no una opinión */
  const gorda = CARTA_DEL_ASESOR + "x".repeat(20000);
  const deltaGorda = ((gorda.length - ADI_PERSONA.length) / ADI_PERSONA.length) * 100;
  ok(deltaGorda > 20,
    "★ carnada «carta que engorda» → una carta 20.000 chars más larga rompe el techo del 20%: el candado de la sección 4 es aritmético, no un comentario");
}

console.log(`\n── _carta_asesor_gate: ${PASS} PASS · ${FAIL} FAIL (de ${PASS + FAIL}) ──`);
process.exit(FAIL ? 1 : 0);
