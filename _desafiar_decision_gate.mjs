/* === _desafiar_decision_gate.mjs · EL TRADEOFF CON CIFRA ====================================================
 *
 * EL ENCARGO DEL OWNER (2026-09-09), segundo de su orden: «Sigue con desafiar decisiones, manteniendo la
 * misma regla: tradeoff con dato, no sermón ni complacencia.»
 *
 * LAS DOS FALLAS QUE ÉL NOMBRÓ, y que este archivo existe para impedir:
 *   · COMPLACENCIA — «sí, buena decisión». Un juicio sin cifra que el dueño se lleva como respaldo.
 *   · SERMÓN — «deberías cuidar tu margen». Suena a asesor y vale para cualquier negocio, así que no vale
 *     para el suyo.
 *
 * ⚠️ EL CHEQUEO QUE DE VERDAD PRUEBA LA RUTA ES §5, y no mide que ADI responda bien: mide que el VEREDICTO
 * CAMBIE con la cuenta. Un composer que dijera siempre lo mismo pasaría cualquier chequeo de forma —lleva
 * cifras, lleva dos lados, no adula— y sería una plantilla con números. Acá se le pregunta por una cuenta
 * SANA y por una cuenta cuyo margen delgado viene de la condición, y se exige que conteste distinto: en la
 * primera, que el dato no sostiene soltarla; en la segunda, que lo que tiene delgado el margen se renegocia.
 *
 * ⚠️ NADA DE NOMBRES ESCRITOS A MANO: las cuentas salen del pack cargado y se clasifican leyendo su propia
 * ficha, así el candado vale también para la planilla de un usuario.
 *
 * OFFLINE · determinístico · CERO llamadas al modelo.
 * `node --import ./scripts/offline-guard.mjs _desafiar_decision_gate.mjs` */
import { initTenant } from "./src/data/tenantStore.js";
import { TENANT_DEMO } from "./src/data/tenants/demo.js";
import { desafiarDecision as PB } from "./src/adi/agente/playbooks/desafiarDecision.js";
import { PLAYBOOKS, playbookPara, pasosDe, obligatoriasDe, promesasCumplidas } from "./src/adi/agente/playbooks/registro.js";
import { formaConversacional } from "./src/adi/agente/formaConversacional.js";
import { reDeReferencia } from "./src/adi/oracle/entityRecord.js";
import { answerViaAgente } from "./src/adi/agente/bucleAgente.js";
import { TOOLS } from "./src/adi/oracle/toolRegistry.js";
import { cajaDelAgente } from "./src/adi/agente/herramientasAgente.js";
import { runPlan } from "./src/adi/oracle/toolRunner.js";
import { ESCENARIO_INICIAL } from "./src/config/scenarios.js";

let pass = 0, fail = 0;
const ok = (cond, label, detalle) => {
  if (cond) { pass++; console.log(`  ✓ ${label}`); }
  else { fail++; console.log(`  ✗ ${label}`); if (detalle !== undefined) console.log(`      ${String(detalle).slice(0, 320)}`); }
};
const H = (t) => console.log(`\n${t}`);
const MUDO = async () => ({ tipo: "texto", texto: "" });
const ESC = ESCENARIO_INICIAL;

initTenant(TENANT_DEMO);

const CAJA = cajaDelAgente(TOOLS);
const figsDe = (pasos, pregunta) =>
  (runPlan({ intent: "answer", calls: pasos.map((s) => ({ tool: s.tool, args: s.args })) },
    { scenario: ESC, maxCalls: 8, preguntaUsuario: pregunta, registry: CAJA }).ledger || {}).figs || [];
const valDe = (f) => String((f && (f.text || f.value)) || "");
const entDe = (l) => { const p = String(l || "").split("·").map((s) => s.trim()); return p.length >= 2 ? p[0] : null; };
const numDe = (f) => { if (!f) return NaN; if (Number.isFinite(f.raw)) return f.raw;
  const m = /(\d+(?:\.\d+)?)\s*([KkMmBb])?(?![A-Za-zÁÉÍÓÚÜáéíóúüÑñ])/.exec(valDe(f));
  return m ? (/^[^\d]*-/.test(valDe(f)) ? -1 : 1) * Number(m[1]) * ({ k: 1e3, m: 1e6, b: 1e9 }[(m[2] || "").toLowerCase()] || 1) : NaN; };

/* ── LAS DOS CUENTAS QUE §5 NECESITA, leídas del pack ──────────────────────────────────────────────────────
 * `sana` = margen igual o sobre el benchmark declarado · `condicion` = margen bajo el benchmark Y con exceso
 * de acciones comerciales publicado. Son las dos situaciones en que el dato manda veredictos OPUESTOS. */
const CUENTAS = (() => {
  const cartera = figsDe([{ tool: "salesRead", args: { focus: "vs_anterior", dimension: "cliente" } }], "x")
    .map((f) => entDe(f.label)).filter(Boolean);
  const nombres = [...new Set(cartera)];
  let sana = null, condicion = null;
  for (const n of nombres) {
    const figs = figsDe([{ tool: "entityProfile", args: { entity: n, dimension: "cliente" } }], "x");
    const g = (re) => figs.find((f) => re.test(f.label || "")) || null;
    const margen = g(new RegExp(`^${n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")} · Margen$`, "i"));
    const bench = g(/^Benchmark de margen$/i);
    const exceso = g(/exceso de acciones comerciales/i);
    if (!margen || !bench) continue;
    const m = numDe(margen), b = numDe(bench);
    if (!sana && Number.isFinite(m) && Number.isFinite(b) && m >= b) sana = { n, margen: valDe(margen), bench: valDe(bench) };
    if (!condicion && Number.isFinite(m) && Number.isFinite(b) && m < b && exceso && numDe(exceso) > 0) {
      /* la referencia se lee por el MISMO helper que la publica — nunca por un literal escrito acá */
      const ref = figs.find((f) => reDeReferencia("pctRebate").test(f.label || "")) || null;
      condicion = { n, exceso: valDe(exceso), margen: valDe(margen), nivel: ref ? valDe(ref) : null };
    }
    if (sana && condicion) break;
  }
  return { sana, condicion };
})();

/* ═══ 0 · EL PACK TRAE LAS DOS SITUACIONES ══════════════════════════════════════════════════════════════════ */
H("0 · el pack tiene una cuenta sana y otra con la condición cara — sin las dos, §5 no probaría nada");
ok(!!CUENTAS.sana, `hay una cuenta sobre el benchmark (${CUENTAS.sana ? `${CUENTAS.sana.n} ${CUENTAS.sana.margen} vs ${CUENTAS.sana.bench}` : "—"})`);
ok(!!CUENTAS.condicion, `hay una cuenta con exceso de acciones comerciales (${CUENTAS.condicion ? `${CUENTAS.condicion.n} ${CUENTAS.condicion.exceso}` : "—"})`);
if (!CUENTAS.sana || !CUENTAS.condicion) { console.log("\n── sin las dos cuentas no se puede medir la ruta ──"); process.exit(1); }

/* ═══ 1 · EL DETECTOR ═══════════════════════════════════════════════════════════════════════════════════════ */
H("1 · el detector — pesa decisiones, y no le quita el turno a nadie");
{
  const DEBE = [
    `¿me conviene seguir vendiendo a ${CUENTAS.condicion.n} así?`,
    `¿debería dejar de venderle a ${CUENTAS.sana.n}?`,
    `¿le doy más descuento a ${CUENTAS.sana.n}?`,
    "¿hago bien en priorizar volumen?", "¿me conviene bajar precios?", "¿estoy tomando una mala decisión?",
    "¿es una buena idea crecer en volumen este año?", "¿vale la pena seguir con estos descuentos?",
    "¿debería subir precios?",
  ];
  const NO_DEBE = [
    "¿por qué febrero es el mes más bajo?", `muéstrame la ficha de ${CUENTAS.sana.n}`, "dame los 5 clientes de mejor margen",
    "¿cuánto vendimos este año?", "explícame el cuadro", "¿qué harías primero?", `compárame ${CUENTAS.sana.n} contra ${CUENTAS.condicion.n}`,
    "¿cuál es mi margen?", `quiero ver el detalle de ${CUENTAS.condicion.n}`, `¿será que ${CUENTAS.condicion.n} está comprando menos?`,
    "creo que es por descuentos, ¿estoy en lo correcto?", "proyecta 12 meses con +4%", "¿cómo va la cobranza?",
    "qué hago esta semana", "¿qué le digo al equipo comercial?", "dame los tres pasos", "¿por qué vendo más pero gano menos?",
  ];
  const miss = DEBE.filter((q) => !PB.cuandoAplica(q));
  ok(miss.length === 0, `★ las ${DEBE.length} formas de decisión se reconocen`, miss.join(" · "));
  const fp = NO_DEBE.filter((q) => PB.cuandoAplica(q));
  ok(fp.length === 0, `★ cero falsos positivos sobre ${NO_DEBE.length} preguntas de otras rutas`, fp.join(" · "));
  ok(formaConversacional(`¿le doy más descuento a ${CUENTAS.sana.n}?`) === "decision",
    "★ «¿le doy más descuento a X?» es una decisión — la que el dueño toma más seguido, y no la veía ninguna forma");
  ok(formaConversacional("¿qué le digo al equipo comercial?") === "accion",
    "…y esa forma nueva NO se lleva el plan de acción, que pide pasos y no juicio");
}

/* ═══ 2 · LAS PROMESAS ══════════════════════════════════════════════════════════════════════════════════════ */
H("2 · cada tipo de decisión declara SU promesa — sin ella el playbook no se activa nunca");
{
  const TIPOS = [
    ["cuenta", `¿me conviene seguir vendiendo a ${CUENTAS.condicion.n} así?`],
    ["volumen", "¿hago bien en priorizar volumen?"],
    ["precio", "¿me conviene bajar precios?"],
    ["sin-anclar", "¿estoy tomando una mala decisión?"],
  ];
  for (const [tipo, q] of TIPOS) {
    const oblig = obligatoriasDe(PB, q, {});
    const figs = figsDe(pasosDe(PB, q, {}), q);
    ok(oblig.length > 0, `«${tipo}» declara promesa (${oblig.map(String).join(" ")})`);
    ok(oblig.every((re) => figs.some((f) => re.test(f.label || ""))), `…y el dato la cumple (${figs.length} cifras en boleta)`);
    ok(promesasCumplidas(PB, figs, q, {}), `…y por eso el procedimiento se activa en «${tipo}»`);
  }
  ok(obligatoriasDe(PB, "¿cuánto vendimos este año?", {}).length === 0, "y en una pregunta que no es decisión no promete nada");
}

/* ═══ 3 · EL CABLEADO ═══════════════════════════════════════════════════════════════════════════════════════ */
H("3 · el cableado — herramientas reales y precedencia");
{
  const todas = PB.ejemplos.flatMap((q) => pasosDe(PB, q, {}));
  ok(todas.length > 0 && todas.every((p) => typeof CAJA[p.tool] === "function"), `las ${todas.length} herramientas de sus pasos existen en la caja del agente`);
  ok(todas.every((p) => p.args && typeof p.para === "string" && p.para.length > 10), "…y cada paso declara args y PARA QUÉ");
  ok(PLAYBOOKS.indexOf(PB) === 1, "★ va segundo, detrás de la hipótesis: las rutas conversacionales antes que ficha y margen general");
  ok(playbookPara("¿hago bien en priorizar volumen?", { history: [], viewContext: null, cuadro: null, mem: {} }) === PB,
    "…y el registro lo elige de verdad para una decisión");
  ok(playbookPara(`¿será que ${CUENTAS.condicion.n} está comprando menos?`, { history: [], viewContext: null, cuadro: null, mem: {} }) !== PB,
    "…y NO se lleva la hipótesis, que es de la ruta hermana");
}

/* ═══ 4 · POR EL BUCLE ══════════════════════════════════════════════════════════════════════════════════════ */
H("4 · por el camino real del agente — con el cerebro mudo, el piso solo");
const T = {};
{
  const CASOS = [
    ["sana-soltar", `¿debería dejar de venderle a ${CUENTAS.sana.n}?`],
    ["condicion-seguir", `¿me conviene seguir vendiendo a ${CUENTAS.condicion.n} así?`],
    ["ceder", `¿le doy más descuento a ${CUENTAS.condicion.n}?`],
    ["volumen", "¿hago bien en priorizar volumen?"],
    ["precio", "¿me conviene bajar precios?"],
    ["sin-anclar", "¿estoy tomando una mala decisión?"],
  ];
  for (const [tag, q] of CASOS) {
    const r = await answerViaAgente({ text: q, history: [], mem: {}, scenario: ESC, callAgente: MUDO });
    T[tag] = { q, texto: String((r.r && r.r.text) || ""), agente: (r.r && r.r.agente) || {} };
    ok(T[tag].agente.estado === "playbook", `«${tag}» lo resuelve el procedimiento (estado ${T[tag].agente.estado})`);
    ok((T[tag].agente.vetos || []).length === 0, "…sin vetos del muro", (T[tag].agente.vetos || [])[0]);
  }
}

/* ═══ 5 · ★ EL TRADEOFF · Y QUE EL VEREDICTO CAMBIE CON LA CUENTA ═══════════════════════════════════════════ */
H("5 · ★ los dos lados con cifra — y un veredicto que cambia con el dato, no una plantilla con números");
{
  const sana = T["sana-soltar"], cond = T["condicion-seguir"];
  ok(/pones en juego/i.test(sana.texto) && /pones en juego/i.test(cond.texto),
    "las dos abren por lo que la decisión SACRIFICA, con su cifra");
  ok(/no sostiene la decisi[oó]n|no es tu problema de margen/i.test(sana.texto),
    `★ con la cuenta sana DESAFÍA la decisión: soltarla cuesta contribución y no devuelve margen`, sana.texto.slice(0, 200));
  ok(sana.texto.includes(CUENTAS.sana.margen) && sana.texto.includes(CUENTAS.sana.bench),
    "…y lo sostiene con su margen contra el benchmark declarado, ambos de la boleta");
  ok(/se renegocia|es la CONDICI[OÓ]N|no la cuenta/i.test(cond.texto),
    "★ con la cuenta cara distingue CONDICIÓN de cuenta: lo que tiene delgado el margen se renegocia sin perder la venta", cond.texto.slice(0, 200));
  ok(cond.texto.includes(CUENTAS.condicion.exceso), `…y cita el exceso medido (${CUENTAS.condicion.exceso})`);
  ok(sana.texto !== cond.texto && !/no sostiene la decisi[oó]n/i.test(cond.texto),
    "★★ los dos veredictos son DISTINTOS — si fueran iguales sería una plantilla con cifras, no una lectura");
  /* la pregunta final es concreta, no genérica (la regla del método del porqué) */
  for (const [tag, t] of Object.entries(T)) {
    ok(/D[ií]me(?:lo)?|Nómbrame|decides t[uú]|Falta tu lado|La pieza/i.test(t.texto), `«${tag}» cierra pidiéndole al dueño la pieza que él tiene`);
  }
}

/* ═══ 6 · NINGÚN NÚMERO ESCRITO A MANO ══════════════════════════════════════════════════════════════════════ */
H("6 · cada número del texto sale de la boleta");
{
  for (const [tag, t] of Object.entries(T)) {
    const figs = figsDe(pasosDe(PB, t.q, {}), t.q);
    const enBoleta = new Set(figs.map(valDe).filter(Boolean));
    const sueltos = (t.texto.match(/[+-]?\$?\d[\d.,]*\s*(?:pp|%|[KMB])?/g) || [])
      .map((s) => s.trim()).filter((s) => /\d/.test(s))
      .filter((s) => !/^\d+º?$/.test(s))   // «tres», «los dos» y los ordinales sueltos no son cifras del dato
      .filter((s) => ![...enBoleta].some((v) => v === s || (v.includes(s) && /^[+-]?\$?\d[\d.,]*\s*(?:pp|%|[KMB])?$/.test(v))));
    ok(sueltos.length === 0, `«${tag}» no escribe ningún número propio`, sueltos.join(" · "));
  }
}

/* ═══ 7 · EL NOTARIO · COMPLACENCIA Y SERMÓN ════════════════════════════════════════════════════════════════ */
H("7 · su lista notarial — las dos fallas que el owner nombró");
{
  const q = `¿debería dejar de venderle a ${CUENTAS.sana.n}?`;
  const figs = figsDe(pasosDe(PB, q, {}), q);
  const reglas = (texto) => PB.listaNotarial(texto, { figs, pregunta: q }).map((v) => v.regla);
  const dosCifras = figs.filter((f) => /\d/.test(valDe(f))).slice(0, 2).map(valDe);

  ok(reglas("Sí, es una buena decisión.").includes("juicio-sin-cifra"), "★ COMPLACENCIA sin cifra ARDE — «buena decisión» es un respaldo que nadie verificó");
  ok(reglas("Deberías cuidar tu margen y ser selectivo con los descuentos.").includes("juicio-sin-cifra"),
    "★ SERMÓN sin cifra ARDE — vale para cualquier negocio, así que no vale para el suyo");
  ok(reglas(`Deberías revisarlo: su contribución va ${dosCifras[0]}.`).includes("decision-de-un-solo-lado"),
    "★ un solo lado ARDE — con una cifra se sostiene cualquier conclusión");
  ok(reglas(`Estás pesando si soltarla. Pones en juego ${dosCifras[0]} y del otro lado ${dosCifras[1]}.`).length === 0,
    "…y el mismo juicio CON los dos lados pasa limpio");
  /* ⚠️ DECIR LO MISMO DOS VECES (owner 2026-09-10, mirando producción): esta ruta contestó en quince líneas
   * contra las cuatro a seis de las demás, y dentro de esas quince daba las MISMAS tres cifras dos veces —una
   * en prosa y otra en lista—. El umbral se midió contra el piso determinístico de las cinco rutas. */
  {
    const relleno = Array.from({ length: 9 }, (_, i) => `Línea de relleno ${i} con ${dosCifras[0]} otra vez.`);
    const largo = [`Estás pesando si soltarla.`, ...relleno].join(String.fromCharCode(10));
    ok(reglas(largo).includes("decision-repetida"),
      "★ una respuesta de quince líneas ARDE: los cuatro puntos caben en seis, y el resto es lo mismo dicho dos veces");
  }
  for (const [tag, t] of Object.entries(T)) {
    const n = t.texto.split(String.fromCharCode(10)).map((x) => x.trim()).filter(Boolean).length;
    ok(n <= 8, `«${tag}» cabe en el ancho del procedimiento (${n} líneas)`);
  }
  ok(reglas("No tengo información autorizada suficiente para responder eso con el alcance pedido.").length === 0,
    "★ declinar honestamente NO arde — vetar la línea honesta dejaría el turno vacío");
  ok(reglas("").length === 0, "y un texto vacío no genera multas fantasma");
  ok(reglas(`Pones en juego ${dosCifras[0]} y recuperas ${dosCifras[1]}.`).includes("decision-no-repetida"),
    "responder con cifras sin decir qué decisión se pesa ARDE");
}

/* ═══ 8 · EL REGISTRO ═══════════════════════════════════════════════════════════════════════════════════════
 * El motor publica rótulos con palabras que en pantalla están prohibidas («Meta de carga comercial»). Una
 * etiqueta es un nombre de columna: la prosa no la hereda. */
H("8 · el registro — la prosa no hereda las palabras internas del motor");
{
  const PROHIBIDAS = /\b(?:meta|target)s?\b|\bvara\b|\bpalanca\b|\bplata\b|\bdormido\b|\bapretar\b|\bguita\b|\bdetenido\b/i;
  for (const [tag, t] of Object.entries(T)) {
    ok(!PROHIBIDAS.test(t.texto), `«${tag}» no usa vocabulario prohibido`, (t.texto.match(PROHIBIDAS) || [])[0]);
  }
  ok(/nivel (?:de carga )?declarado|benchmark declarado|que tienes declarado/i.test(T["condicion-seguir"].texto),
    "★ y la referencia se nombra «declarada», nunca como una meta que le pusimos nosotros");
  /* ⚠️ EL CHEQUEO QUE FALTABA, y lo pagó caro: este playbook buscaba el nivel declarado con un literal escrito
   * a mano. El arreglo de rótulos lo renombró, el `_find` devolvió null y la frase se CALLÓ — sin un solo
   * gate en rojo, porque ningún chequeo miraba que esa cifra estuviera. Una frase que desaparece en silencio
   * es peor que una que falla: nadie la extraña. Se exige el VALOR, leído por el mismo helper que lo publica. */
  ok(CUENTAS.condicion.nivel !== null, `el pack publica el nivel de carga declarado para la cuenta que lo excede (${CUENTAS.condicion.nivel})`);
  ok(T["ceder"].texto.includes(CUENTAS.condicion.nivel),
    `★ y al pesar «cederle más» la respuesta CITA ese nivel (${CUENTAS.condicion.nivel}) — sin él, «tienes espacio» es una opinión`,
    T["ceder"].texto.slice(0, 240));
}

/* ═══ 9 · LA DECISIÓN SIN NOMBRAR ═══════════════════════════════════════════════════════════════════════════
 * «¿Estoy tomando una mala decisión?» caía a la línea genérica —«cuéntame qué dato específico necesitas»—,
 * que le pide un DATO a quien está pidiendo un JUICIO. No es falta de dato: es falta de objeto. */
H("9 · la decisión sin nombrar — se pregunta CUÁL, y se pregunta concreto");
{
  const t = T["sin-anclar"].texto;
  ok(/no me dijiste cu[aá]l|cu[aá]l de las tres/i.test(t), "★ dice que falta saber CUÁL decisión, en vez de declinar por falta de dato", t.slice(0, 160));
  ok(/seguir o soltar una cuenta/i.test(t) && /volumen/i.test(t) && /precios?/i.test(t),
    "…y ofrece las tres que su dato sí puede pesar, nombradas");
  ok(!/qu[eé] dato (?:espec[ií]fico )?necesitas/i.test(t), "★ y NO le pide un dato a quien está pidiendo un juicio");
}

/* ═══ 10 · LAS CARNADAS ═════════════════════════════════════════════════════════════════════════════════════ */
H("10 · carnadas — si el chequeo no se pone rojo, no está mirando");
{
  const q = `¿me conviene seguir vendiendo a ${CUENTAS.condicion.n} así?`;
  const figs = figsDe(pasosDe(PB, q, {}), q);
  const reglas = (texto) => PB.listaNotarial(texto, { figs, pregunta: q }).map((v) => v.regla);
  ok(reglas("Me parece bien lo que estás haciendo.").length > 0, "carnada «adular sin cifra» → el notario se pone ROJO");
  ok(reglas("Te recomiendo ser más selectivo.").length > 0, "carnada «recomendar sin medir» → el notario se pone ROJO");
  ok(PB.componer({ figs: [], pregunta: q, semilla: 1 }) === null, "★ carnada «boleta vacía» → el composer se RETIRA, no opina");
  ok(PB.componer({ figs, pregunta: "¿cuánto vendimos este año?", semilla: 1 }) === null,
    "carnada «pregunta que no es decisión» → el composer se RETIRA aunque tenga la boleta llena");
}

console.log(`\n── _desafiar_decision_gate: ${pass} PASS · ${fail} FAIL (de ${pass + fail}) ──`);
process.exit(fail === 0 ? 0 : 1);
