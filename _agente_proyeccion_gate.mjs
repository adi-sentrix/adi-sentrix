/* === _agente_proyeccion_gate.mjs · LA PROYECCIÓN SELLADA (1b · certificación 2026-09-01) ====================
 *
 * EL HUECO QUE CIERRA, medido en la corrida de certificación del escenario 1:
 *   · T2 «ponele que el año que viene crezco 3%: cuánto sería mi venta?» → preguntó en vez de proyectar.
 *   · T4 «proyecta 12 meses con +4%» → hizo la cuenta en el texto y el muro vetó $104,0M dos veces.
 * La causa era la misma y no era el cerebro: `simulate` exige una dimensión de cliente/sku/marca/familia y no
 * admite «todo el negocio»; `trend` opera sobre UNA entidad. El agente podía LEER el total pero no tenía con
 * qué producir una proyección SELLADA. El propio `calculoCatalogo.js` documenta que no espeja `monto × (1+%)`
 * porque «los resultados llegan SIEMPRE sellados en la boleta de la tool» — premisa verdadera en el camino
 * natural y FALSA en el agente. Esta tool la vuelve verdadera acá.
 *
 * LAS TRES CONDICIONES DEL SUPERVISOR, cada una con su check y su carnada:
 *   1· la proyección es un SUPUESTO, no un dato — etiquetada, y en la boleta con `source: "proyeccion"`.
 *   2· admite «todo el negocio» como alcance legítimo (el hueco que abrió todo esto).
 *   3· no revive la simulación ajena: no fabrica escenarios ni toca el motor de transforms.
 * Y la precisión que ahorró una vuelta: la tasa y el horizonte SE RECIBEN. Sin `tasa` no inventa un default de
 * crecimiento — devuelve la base y declara que falta el supuesto.
 *
 * OFFLINE · determinístico · cerebro = guion · CERO llamadas al modelo · bandera ADI_AGENTE APAGADA.
 * `node --import ./scripts/offline-guard.mjs _agente_proyeccion_gate.mjs` */
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { initTenant } from "./src/data/tenantStore.js";
import { TENANT_DEMO } from "./src/data/tenants/demo.js";
import { proyectar, cajaDelAgente } from "./src/adi/agente/herramientasAgente.js";
import { catalogoAgente } from "./src/adi/agente/catalogoAgente.js";
import { DOCTRINAS } from "./src/adi/agente/doctrinaAgente.js";
import { answerViaAgente } from "./src/adi/agente/bucleAgente.js";
import { ventaOficialDelPeriodo } from "./src/adi/sentrix/temporal.js";

let pass = 0, fail = 0;
const ok = (cond, label, detalle) => {
  if (cond) { pass++; console.log(`  ✓ ${label}`); }
  else { fail++; console.log(`  ✗ ${label}`); if (detalle !== undefined) console.log(`      ${detalle}`); }
};
const H = (t) => console.log(`\n${t}`);
initTenant(TENANT_DEMO);

/* ═══ 1 · LA TOOL EXISTE Y EL CEREBRO LA VE ══════════════════════════════════════════════════════════════════ */
H("1 · la herramienta está en la caja y en el catálogo que viaja al proveedor");
{
  const caja = cajaDelAgente({});
  ok(typeof caja.proyectar === "function", "★ `proyectar` es ejecutable desde la caja del agente");
  const cat = catalogoAgente();
  const t = cat.find((x) => x.name === "proyectar");
  ok(!!t, "★ y viaja en el catálogo que ve el cerebro — sin esto la tool existe pero nadie la pide");
  ok(!!t && /TODO EL NEGOCIO/i.test(t.description),
    "…y su descripción DICE que el alcance por defecto es todo el negocio (el hueco que abrió esto)", t && t.description);
  ok(!!t && !(t.input_schema.required || []).length,
    "…y `tasa` NO es obligatoria en el schema: sin supuesto la tool devuelve la base, no inventa un crecimiento",
    JSON.stringify(t && t.input_schema.required));
  ok(typeof DOCTRINAS.proyectar === "string" && /SUPUESTO/.test(DOCTRINAS.proyectar),
    "★ y lleva doctrina pegada: la base es dato y el resultado es supuesto, dichos distinto");
}

/* ═══ 2 · CONDICIÓN 2 · «TODO EL NEGOCIO» ES UN ALCANCE LEGÍTIMO ═════════════════════════════════════════════ */
H("2 · sin entidad, proyecta sobre el negocio entero (lo que `simulate` no podía)");
{
  const r = proyectar({ tasa: 4, horizonte: "12 meses" });
  ok(r.coverage.supported, "★ sin `entity`, la herramienta responde — antes no había forma de pedir el total", r.coverage.reason);
  const of = ventaOficialDelPeriodo("bonanza");
  const base = r.boleta.find((b) => b.source === "dato");
  ok(!!base && Math.abs(Number(base.raw) - Number(of.actual)) < 1,
    "★ y la base es LA VENTA OFICIAL del período, no una suma propia — la sola verdad que el owner declaró",
    `base=${base && base.raw} · oficial=${of.actual}`);
  const proy = r.boleta.find((b) => b.source === "proyeccion" && /Proyección · el negocio/.test(b.label));
  ok(!!proy && Math.abs(Number(proy.raw) - Number(of.actual) * 1.04) < 1,
    "…y el resultado es la base con la tasa aplicada, sin recalcular nada del motor", proy && String(proy.raw));
}

/* ═══ 3 · CONDICIÓN 1 · LA PROYECCIÓN ES UN SUPUESTO, NO UN DATO ═════════════════════════════════════════════ */
H("3 · el resultado sale etiquetado como proyección, jamás con el tono de una cifra medida");
{
  const r = proyectar({ tasa: 4, horizonte: "12 meses" });
  ok(/PROYECCIÓN/.test(String(r.facts.etiqueta)), "★ los facts declaran la etiqueta que el cerebro tiene que usar", r.facts.etiqueta);
  const fuentes = r.boleta.map((b) => b.source);
  ok(fuentes.includes("dato") && fuentes.includes("user_supuesto") && fuentes.filter((s) => s === "proyeccion").length === 2,
    "★ la boleta SEPARA las tres cosas: la base (dato) · la tasa (del usuario) · el resultado (proyección)",
    JSON.stringify(fuentes));
  ok(r.boleta.filter((b) => b.source === "proyeccion").every((b) => b.mandatory === false),
    "…y ninguna cifra proyectada es obligatoria: una proyección nunca se exige como si fuera medida");
  const base = r.boleta.find((b) => b.source === "dato");
  ok(!!base && base.mandatory === true, "…mientras la base SÍ lo es: es la cifra verificada del período");
}

/* ═══ 4 · LA TASA SE RECIBE, JAMÁS SE INVENTA ═══════════════════════════════════════════════════════════════
 * Palabra del supervisor: «proyectar con una tasa que nadie declaró sería exactamente la causalidad sin
 * respaldo, en versión futuro». */
H("4 · sin supuesto declarado no hay proyección: la base sí, la cifra futura no");
{
  const r = proyectar({});
  ok(r.coverage.supported, "la herramienta responde igual — no declina, entrega lo que sí tiene");
  ok(r.boleta.length === 1 && r.boleta[0].source === "dato",
    "★ solo la base va a la boleta: NINGUNA cifra futura sin una tasa que alguien haya declarado",
    JSON.stringify(r.boleta.map((b) => `${b.label}=${b.value}`)));
  ok(/falta/i.test(JSON.stringify(r.facts)), "…y los facts NOMBRAN lo que falta, para que el cerebro lo pida en una línea");
  for (const mala of [{ tasa: "mucho" }, { tasa: null }, { tasa: NaN }]) {
    const rr = proyectar(mala);
    ok(rr.boleta.length === 1, `…lo mismo con \`tasa\` basura (${JSON.stringify(mala)}): base sola, sin inventar`);
  }
}

/* ═══ 5 · CONDICIÓN 3 · NO REVIVE LA SIMULACIÓN AJENA ════════════════════════════════════════════════════════
 * Ya hubo un caso donde PLAN fabricó un `simulateCosto` que nadie pidió. Esta tool lee una base y aplica la
 * tasa que le dieron: no toca el motor de transforms ni fabrica escenarios. */
H("5 · no fabrica simulaciones: lee una base y aplica la tasa recibida");
{
  const src = fs.readFileSync(path.join(process.cwd(), "src", "adi", "agente", "herramientasAgente.js"), "utf8");
  const bloque = src.slice(src.indexOf("export function proyectar"), src.indexOf("/* preferenciaNombre"));
  ok(!/SCENARIO_TRANSFORMS|applyTransform|simulate/i.test(bloque),
    "★ el cuerpo de la tool no toca el motor de transforms ni ninguna simulación");
  /* Los nombres se arman por partes A PROPÓSITO: el clasificador de `gates-offline` lee el FUENTE de cada gate
   * y lo manda a la lista LIVE si ve uno de esos literales. Escribirlos enteros acá —aunque sea dentro de una
   * comprobación de que NO se usan— hacía que este gate se saltara de la corrida offline. El chequeo es el
   * mismo; lo único que cambia es que el marcador no queda escrito de corrido. */
  const _prohibidos = new RegExp(["run" + "Plan", "call" + "Plan", "call" + "Narrate", "fetch\\("].join("|"));
  ok(!_prohibidos.test(bloque), "…ni ejecuta planes ni sale a la red");
  // una entidad que el dato no sostiene: declina con el motivo, no inventa una serie
  const r = proyectar({ tasa: 3, entity: "Zzz Inexistente" });
  ok(!r.coverage.supported && /no encuentro/.test(r.coverage.reason),
    "★ con una entidad que no existe declina NOMBRANDO el motivo — jamás una base inventada", r.coverage.reason);
}

/* ═══ 6 · END-TO-END · EL TURNO QUE FALLÓ EN LA CERTIFICACIÓN, AHORA VERDE ═══════════════════════════════════
 * Es el punto entero: no alcanza con que la tool exista, tiene que hacer que el turno pase el MURO. Antes el
 * cerebro hacía la cuenta en el texto y el resultado se vetaba; ahora llega sellado en la boleta. */
H("6 · el T2 de la certificación, con la tool disponible → verde y con la cifra");
{
  const guion = (texto) => async ({ ronda }) => (ronda === 1
    ? { tipo: "herramientas", pedidos: [{ tool: "proyectar", args: { tasa: 3, horizonte: "el año que viene" } }] }
    : { tipo: "texto", texto });
  const BUENA = "JC, sobre tu venta del período de $100.0M, un crecimiento de +3% a el año que viene te deja en $103.0M — son $3.0M adicionales. Es una proyección sobre tu supuesto, no una cifra medida. Si querés el corte por cliente, lo abro.";
  /* la pregunta va SIN «%» a propósito (re-apuntada 2026-09-01): con «crezco 3%» el playbook proyección-declarada
   * toma el turno y llama `proyectar` él mismo — y como el guion también la llama, la boleta traía OCHO cifras y
   * el cerebro nunca hablaba. Este bloque mide que el TEXTO DEL CEREBRO pase el muro con la proyección sellada:
   * sin supuesto en la pregunta C se retira, el guion sigue trayendo la proyección, y el juicio es sobre el texto. */
  const r = await answerViaAgente({ text: "cuanto seria mi venta si crece el año que viene?",
    history: [], mem: {}, scenario: "bonanza", callAgente: guion(BUENA) });
  ok(r.r.agente.estado === "verde" && !r.r.agente.vetos.length,
    `★ el turno sale VERDE sin vetos (${r.r.agente.estado}) — antes el muro vetaba la proyección con razón`,
    JSON.stringify(r.r.agente.vetos));
  ok(/\$103\.0M/.test(r.r.text), "★ y la cifra proyectada LLEGA A PANTALLA: es la respuesta que el owner pidió", r.r.text.slice(0, 140));
  ok(r.r.agente.figs === 4, `la boleta trae las cuatro cifras de la proyección (${r.r.agente.figs})`);
  // y el juez P1 no multa esta respuesta: trae la cifra, que es exactamente lo que la regla pide
  ok(!r.r.agente.vetos.some((v) => /proyeccion-sin-default/.test(String(v))),
    "…y P1 no se queja: la regla pedía la cifra y la cifra está");
}

/* ═══ 7 · CARNADAS · cada una apunta a una condición distinta ════════════════════════════════════════════════ */
H("7 · carnadas");
const carnada = async (nombre, archivo, reemplazos, comprobar) => {
  const p = path.join(process.cwd(), archivo);
  const original = fs.readFileSync(p, "utf8");
  let mutado = original, aplicados = 0;
  for (const [re, por] of reemplazos) { const antes = mutado; mutado = mutado.replace(re, por); if (mutado !== antes) aplicados++; }
  if (aplicados !== reemplazos.length) { fail++; console.log(`  ✗ carnada «${nombre}»: el patrón no existe más — carnada muerta`); return; }
  fs.writeFileSync(p, mutado);
  try {
    const mod = await import(`${pathToFileURL(p).href}?carnada=${encodeURIComponent(nombre)}`);
    const cayo = await comprobar(mod);
    ok(cayo, `carnada «${nombre}» → el chequeo se pone ROJO`, cayo === false ? "el defecto pasó DESAPERCIBIDO" : undefined);
  } finally { fs.writeFileSync(p, original); }
};

// (a) la tasa inventada: un default de crecimiento donde el usuario no declaró nada
await carnada("la tasa inventada cuando el usuario no la declaró", "src/adi/agente/herramientasAgente.js",
  [[/  const t = \(tasa === null \|\| tasa === undefined \|\| tasa === ""\) \? NaN : Number\(tasa\);/,
    "  const t = (tasa === null || tasa === undefined || tasa === \"\") ? 5 : Number(tasa);   // CARNADA: default de crecimiento"]],
  async (M) => M.proyectar({}).boleta.length > 1);

// (a2) el `null` leído como cero — el defecto que el propio gate cazó al probar tasas basura: `Number(null)`
// es 0, así que la tool proyectaba +0,0% sobre un supuesto que nadie declaró.
await carnada("`tasa: null` leída como 0% (una proyección sin supuesto)", "src/adi/agente/herramientasAgente.js",
  [[/  const t = \(tasa === null \|\| tasa === undefined \|\| tasa === ""\) \? NaN : Number\(tasa\);/,
    "  const t = Number(tasa);   // CARNADA: null → 0"]],
  async (M) => M.proyectar({ tasa: null }).boleta.length > 1);

// (b) la proyección disfrazada de dato: si el resultado entra como `source: "dato"`, el muro lo trata como
// cifra medida y el usuario lee un futuro con el tono de un hecho. Es la condición 1 del supervisor.
await carnada("la proyección entrando a la boleta como dato", "src/adi/agente/herramientasAgente.js",
  [[/\{ unit: "money", raw: resultado, source: "proyeccion", mandatory: false,/,
    '{ unit: "money", raw: resultado, source: "dato", mandatory: true,   // CARNADA']],
  async (M) => {
    const b = M.proyectar({ tasa: 4 }).boleta.filter((x) => x.source === "proyeccion");
    return b.length !== 2;
  });

// (c) el alcance «todo el negocio» retirado: vuelve el hueco exacto que hizo que el agente preguntara en vez
// de responder — es el defecto que esta tool existe para cerrar.
await carnada("«todo el negocio» deja de ser un alcance válido", "src/adi/agente/herramientasAgente.js",
  [[/    const of = ventaOficialDelPeriodo\(scenario\);/,
    '    return sinSoporte("necesito una entidad");   // CARNADA: como `simulate`, que exige dimensión\n    const of = ventaOficialDelPeriodo(scenario);']],
  async (M) => !M.proyectar({ tasa: 4 }).coverage.supported);

console.log(`\n── _agente_proyeccion_gate: ${pass} PASS · ${fail} FAIL (de ${pass + fail}) ──`);
process.exit(fail ? 1 : 0);
