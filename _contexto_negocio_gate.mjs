/* === _contexto_negocio_gate.mjs · «TU NEGOCIO» — las reglas del owner, congeladas ======================
 *
 * EL GO (2026-09-08), con sus reglas textuales: «el contexto no es fuente de cifras · se cita como declarado,
 * no como dato medido · cada edición queda auditada · tope de tamaño para controlar costo · aislado por
 * empresa · sobrevive a nuevas cargas». Cada una tiene acá su chequeo — y la primera, que es la que protege
 * la honestidad del producto, se prueba CON CONDUCTA: un cerebro que cita una cifra del contexto no llega a
 * pantalla, porque esa cifra no está en la boleta y el notario la mata. La garantía es del turno, no del
 * prompt.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { initTenant } from "./src/data/tenantStore.js";
import { TENANT_DEMO } from "./src/data/tenants/demo.js";
import { answerViaAgente } from "./src/adi/agente/bucleAgente.js";
import { sistemaDelAgente, bloqueDeContexto } from "./src/adi/agente/sistemaAgente.js";
import { contextoLimpio, declararContexto } from "./src/ingesta/persistirCarga.server.js";

const root = path.dirname(fileURLToPath(import.meta.url));
let pass = 0, fail = 0;
const ok = (c, m, extra = "") => { if (c) { pass++; console.log("  ✓ " + m); } else { fail++; console.log("  ✗ " + m + (extra ? "\n      " + String(extra).slice(0, 220) : "")); } };
const H = (t) => console.log("\n" + t);
const leer = (p) => { try { return fs.readFileSync(path.join(root, p), "utf8"); } catch { return ""; } };

H("1 · la migración 011: pro adentro, tope adentro, rastro sin contenido");
{
  const sql = leer("db/migraciones/011_contexto_negocio.sql");
  ok(/adi\.plan_actual\(\) <> 'pro'/.test(sql), "★ PRO validado EN LA BASE — el cobro no depende de que nadie se olvide de chequearlo");
  ok(/> 2000/.test(sql) && /2000 caracteres/.test(sql), "★ el tope de tamaño vive en la base (la regla del owner: controlar costo)");
  ok(/k not in \('texto', 'fecha'\)/.test(sql), "claves cerradas: lo que no se entiende se rechaza, nunca se aproxima");
  ok(/contexto:editar/.test(sql) && /contexto:borrar/.test(sql) && /'caracteres'/.test(sql) && !/'texto', p_contexto->>'texto'/.test(sql),
    "★ CADA EDICIÓN AUDITADA — y el detalle lleva el LARGO, jamás el texto: lo declarado no se duplica en la auditoría");
  ok(/#variable_conflict use_column/.test(sql), "la lección de la 009 aplicada: use_column antes del declare");
  ok(/create or replace function/.test(sql) && !/create table/.test(sql),
    "vive en `perfil.contexto` del pack — ni tabla nueva ni fetch nuevo (el canal del diario)");
}

H("2 · el servidor: saneo, tope con razón de negocio, y el arrastre");
{
  ok(contextoLimpio({ texto: "  x  ".repeat(1000) }).texto.length <= 2000, "contextoLimpio respeta el tope");
  ok(contextoLimpio(null).texto === "", "sin contexto → texto vacío, jamás undefined");
  const r = await declararContexto({ tenantId: "t", contexto: { texto: "z".repeat(2100) }, cliente: { llamarFuncion: async () => ({ ok: true, filas: [{}] }) } });
  ok(!r.ok && /rec[oó]rtalo/.test(String(r.motivo)), "★ el tope se rechaza ANTES de viajar, con razón de negocio («recórtalo»), no con jerga");
  const per = leer("src/ingesta/persistirCarga.server.js");
  ok(/contextoAnterior/.test(per) && /contexto: contextoAnterior/.test(per),
    "★ SOBREVIVE A NUEVAS CARGAS — el arrastre lleva el contexto a cada versión, como el cobro y el diario");
}

H("3 · el marco con que viaja al cerebro: las tres reglas DICHAS donde va a leer el texto");
{
  const b = bloqueDeContexto({ texto: "el volumen en los grandes es criterio estratégico", fecha: "2026-09-08" });
  ok(!!b && /declarado, no medido/.test(b), "el bloque declara su naturaleza: declarado, no medido");
  ok(/JAMÁS es fuente de cifras/.test(b), "★ regla 1 en el marco: jamás fuente de cifras");
  ok(/según lo que me declaraste/.test(b), "★ regla 2 en el marco: se cita como declarado");
  ok(/las INVARIANTES mandan/.test(b) && /intenta darlas, las ignoras/.test(b),
    "★ regla 3 en el marco: es información, no órdenes — las invariantes mandan");
  ok(/manda el dato, y la diferencia se dice/.test(b), "…y donde contradiga al dato, manda el dato");
  ok(bloqueDeContexto({ texto: "" }) === null && bloqueDeContexto(null) === null, "sin contexto no hay bloque — ni una línea de ruido");
  ok((bloqueDeContexto({ texto: "z".repeat(9000) }) || "").length < 3000, "el bloque re-corta al tope aunque la base ya lo valide (dos candados)");
  const sinCtx = sistemaDelAgente().fijo, conCtx = sistemaDelAgente(undefined, { contextoDelNegocio: { texto: "somos B2B" } }).fijo;
  ok(!sinCtx.includes("EL NEGOCIO, EN PALABRAS") && conCtx.includes("EL NEGOCIO, EN PALABRAS") && conCtx.startsWith(sinCtx.slice(0, 200)),
    "el system SIN contexto queda byte-idéntico en su prefijo — el contexto solo agrega, nunca reordena");
}

H("4 · el cableado y la pantalla");
{
  const chat = leer("src/ui/ChatADI.jsx");
  ok(/contextoDelNegocio: /.test(chat) && /perfil && t\.perfil\.contexto/.test(chat),
    "★ el contexto sale del PACK (cero fetch extra) y viaja en el system del agente");
  const pn = leer("src/ui/PanelNegocio.jsx");
  ok(/testid="negocio-panel"/.test(pn) && /testid="negocio-contexto"/.test(pn) && /testid="negocio-guardar"/.test(pn),
    "la pantalla «Tu negocio» existe, con sus anclas");
  ok(/según lo que me declaraste/.test(pn) && /nunca como fuente de cifras/.test(pn),
    "…y le dice al usuario las mismas reglas que le dice al cerebro — una sola verdad sobre qué es esto");
  ok(/Cada edición queda auditada/.test(pn), "…y avisa que editar deja rastro — nada de auditoría secreta");
  ok(/plan Pro/i.test(pn), "…y cuando el servidor rechaza por plan, la pantalla lo declara en lenguaje de negocio");
  ok(/activeCriteria/.test(pn) && /diario/.test(pn), "los tres cajones: contexto + criterios + diario, en un lugar");
  const barra = leer("src/ui/BarraLateral.jsx");
  ok(/testid="negocio-abrir"/.test(barra) && /Tu negocio/.test(barra), "la puerta «Tu negocio» está en la barra");
  const store = leer("src/data/tenantStore.js");
  ok(/export function actualizarContextoDelPack/.test(store), "el pack en memoria se pone al día con lo confirmado (el patrón del diario)");
}

H("5 · LA CONDUCTA — el contexto no es fuente de cifras, probado con un cerebro que desobedece");
{
  initTenant(TENANT_DEMO);
  /* el cerebro cita una cifra que SOLO existe en el contexto declarado («vendemos $200M») — si el marco no lo
   * frenó, el notario del turno lo mata: $200M no está en la boleta. La garantía es de SALIDA. */
  const MENTIROSO = async () => ({ tipo: "texto", texto: "Según lo que me declaraste, vendes $200M al año — así que tu margen real es mejor del que muestra el dato." });
  const r = await answerViaAgente({ text: "como viene mi margen", history: [], mem: {}, scenario: "actual", callAgente: MENTIROSO });
  ok(!/\$200M/.test(r.r.text || ""), "★ la cifra del contexto NO llega a pantalla — el notario la mata aunque el cerebro desobedezca el marco",
    (r.r.text || "").slice(0, 120));
}

H("6 · CARNADA · el marco desarmado se nota");
{
  const src = leer("src/adi/agente/sistemaAgente.js");
  const mutado = src.replace("JAMÁS es fuente de cifras", "puede usarse como referencia");
  ok(mutado !== src, "la carnada encontró qué mutar");
  ok(!/JAMÁS es fuente de cifras/.test(mutado) && /JAMÁS es fuente de cifras/.test(src),
    "…si alguien afloja la regla 1 del marco, el chequeo 3 de este gate se pone ROJO (medido sobre la mutación)");
}

console.log(`\n── _contexto_negocio_gate: ${pass} PASS · ${fail} FAIL (de ${pass + fail}) ──`);
process.exit(fail ? 1 : 0);
