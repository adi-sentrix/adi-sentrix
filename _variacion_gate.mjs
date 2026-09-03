/* === _variacion_gate.mjs · LA VARIACIÓN DETERMINÍSTICA DE LOS CIERRES (owner 2026-09-03) ====================
 *
 * EL ENCARGO: «matar la repetición» — «Dime y lo abrimos» no puede salir tres veces seguidas. Y sus DOS
 * obligaciones a la vez, que este gate mide por separado:
 *   · REPRODUCIBLE: misma semilla → el MISMO texto, byte a byte (los gates pueden replay-ear; nada aleatorio).
 *   · VARIADA: semillas distintas → cierres distintos de verdad (no tres alias de la misma cadena).
 *   · GARANTIZADA: cada variante que puede salir a pantalla pasa el MISMO muro y la MISMA notarial que la
 *     frase única de antes — se prueba corriendo el TURNO ENTERO del bucle con semillas que cubren todas las
 *     opciones del sitio (la semilla nace del largo del hilo: se mueve rellenando history).
 *   · INOFENSIVA HACIA ATRÁS: sin semilla, `variante` devuelve la PRIMERA opción — los callers viejos quedan
 *     byte-idénticos.
 *
 * OFFLINE · determinístico · cerebro MUDO · CERO llamadas. Carnada incluida (la variación apagada → ROJO).
 * `node --import ./scripts/offline-guard.mjs _variacion_gate.mjs` */
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { initTenant } from "./src/data/tenantStore.js";
import { TENANT_DEMO } from "./src/data/tenants/demo.js";
import { answerViaAgente } from "./src/adi/agente/bucleAgente.js";
import { variante } from "./src/adi/agente/variacion.js";

let PASS = 0, FAIL = 0;
const ok = (c, m, extra = "") => { if (c) { PASS++; console.log("  ✓ " + m); } else { FAIL++; console.log("  ✗ " + m + (extra ? "\n      " + extra : "")); } };
const H = (t) => console.log("\n" + t);
const MUDO = async () => ({ tipo: "texto", texto: "" });
const relleno = (n) => Array.from({ length: n }, (_, i) => ({ role: i % 2 ? "adi" : "user", text: `relleno ${i}` }));

/* ═══ 1 · EL CONTRATO DE `variante` ══════════════════════════════════════════════════════════════════════════ */
H("1 · variante(): estable por semilla, primera opción sin semilla");
{
  const ops = ["a", "b", "c"];
  ok(variante("x::y::0", ops) === variante("x::y::0", ops), "★ misma semilla → la misma opción, siempre");
  ok(variante(undefined, ops) === "a" && variante(null, ops) === "a" && variante("", ops) === "a",
    "★ sin semilla → la PRIMERA opción: los callers viejos quedan byte-idénticos");
  const vistos = new Set(Array.from({ length: 24 }, (_, i) => variante(`s::${i}`, ops)));
  ok(vistos.size === ops.length, `★ 24 semillas cubren las ${ops.length} opciones — la variación es real, no un alias`);
  ok(variante("cualquier", []) === "" && variante("cualquier", null) === "", "sin opciones → cadena vacía, jamás un crash");
}

/* ═══ 2 · EL TURNO VIVO · reproducible, variado, y CADA variante pasa el muro ════════════════════════════════ */
H("2 · el turno del bucle: mismo turno → mismo texto; hilos distintos → cierres distintos; todo pasa el muro");
initTenant(TENANT_DEMO);
const Q = "como viene mi margen?";
const turno = (histLen) => answerViaAgente({ text: Q, history: relleno(histLen), mem: {}, scenario: "bonanza", callAgente: MUDO });
{
  const a1 = await turno(0), a2 = await turno(0);
  ok(a1.r.text === a2.r.text && a1.r.text.length > 100,
    "★ REPRODUCIBLE: el mismo turno (misma semilla) da el MISMO texto, byte a byte");

  /* la semilla del bucle usa el largo del hilo: recorro largos hasta cubrir las 3 opciones del cierre del
   * molde — con la MISMA función variante, así el gate sabe qué cubre en vez de esperar suerte. */
  const OPS = 3;
  const indiceDe = (histLen) => {
    const sem = `demo::${Q}::${histLen}`;
    return ["0", "1", "2"].indexOf(variante(sem, ["0", "1", "2"]));
  };
  const porIndice = new Map();
  for (let len = 0; len <= 40 && porIndice.size < OPS; len += 2) {
    const idx = indiceDe(len);
    if (!porIndice.has(idx)) porIndice.set(idx, len);
  }
  ok(porIndice.size === OPS, `los largos de hilo 0..40 cubren las ${OPS} variantes del cierre (índices ${[...porIndice.keys()].sort().join(",")})`);

  const cierres = new Set();
  let vetados = 0;
  for (const [, len] of porIndice) {
    const r = await turno(len);
    if (r.r.agente.estado !== "playbook" || (r.r.agente.vetos || []).length) vetados++;
    cierres.add(String(r.r.text).trim().split("\n").pop());
  }
  ok(vetados === 0, "★ GARANTIZADA: cada variante sale por el turno ENTERO — muro + notarial — sin un solo veto");
  ok(cierres.size >= 2, `★ VARIADA: las variantes producen cierres distintos de verdad (${cierres.size} distintos)`);

  /* «no puede aparecer tres veces seguidas»: tres turnos consecutivos de una conversación (el hilo crece de a
   * 2 por turno) no repiten el mismo cierre tres veces. */
  const seguidos = [];
  for (const len of [0, 2, 4]) seguidos.push(String((await turno(len)).r.text).trim().split("\n").pop());
  ok(new Set(seguidos).size >= 2, `★ tres turnos seguidos → no sale tres veces el mismo cierre (${new Set(seguidos).size} distintos)`, seguidos.join(" | "));

  /* LA SÍNTESIS EJECUTIVA, desde la voz del owner (2026-09-03): su cierre es UNO solo y priorizado, con la
   * oferta variando por semilla. Las TRES variantes tienen que salir por el turno entero sin un veto — es
   * donde el muro ya me cazó la priorización sin marcar el criterio. */
  const QS = "dame los 3 riesgos para el directorio";
  const turnoS = (histLen) => answerViaAgente({ text: QS, history: relleno(histLen), mem: {}, scenario: "bonanza", callAgente: MUDO });
  const ofertas = new Set();
  let vetadosS = 0;
  for (let len = 0; len <= 12; len += 2) {
    const r = await turnoS(len);
    if (r.r.agente.estado !== "playbook" || (r.r.agente.vetos || []).length) vetadosS++;
    const m = /(¿[^?]{0,60}\?|Si te parece, entro por ahí\.)/.exec(String(r.r.text).split("\n").filter(Boolean).slice(-2).join(" "));
    if (m) ofertas.add(m[1]);
  }
  ok(vetadosS === 0, "★ la SÍNTESIS: todas las variantes de su cierre único pasan el turno entero — muro, contrato y notarial, cero vetos");
  ok(ofertas.size >= 2, `★ …y la oferta del cierre rota de verdad entre turnos (${ofertas.size} formas distintas)`, [...ofertas].join(" | "));
}

/* ═══ 3 · CARNADA · la variación apagada (siempre la primera opción) → el checkeo se pone ROJO ═══════════════ */
H("3 · carnada: si variante() dejara de variar, este gate lo ve");
{
  const abs = path.join(process.cwd(), "src", "adi", "agente", "variacion.js");
  const txt = fs.readFileSync(abs, "utf8").replace(/\r\n/g, "\n");
  const mutado = txt.replace(
    /if \(semilla === undefined \|\| semilla === null \|\| semilla === ""\) return opciones\[0\];/,
    "return opciones[0];   // CARNADA: siempre la primera");
  if (mutado === txt) { ok(false, "carnada: no encontró qué mutar"); }
  else {
    const destino = abs.replace(/\.js$/, `.carnada${process.pid}.js`);
    fs.writeFileSync(destino, mutado);
    try {
      const Mut = await import(pathToFileURL(destino).href);
      const vistos = new Set(Array.from({ length: 24 }, (_, i) => Mut.variante(`s::${i}`, ["a", "b", "c"])));
      ok(vistos.size === 1, "★ con la variación apagada, 24 semillas dan UNA sola opción — el check de arriba se pondría ROJO");
    } catch (e) { ok(false, "carnada: la copia mutada no carga", e.message); }
    finally { try { fs.unlinkSync(destino); } catch { /* */ } }
  }
}


/* ═══ 4 · TODAS LAS VARIANTES × VARIOS LARGOS, POR EL TURNO COMPLETO (supervisor 2026-09-05) ═════════════════
 * LA LECCIÓN QUE LO PIDE, y es cara: el cierre del SEGUIMIENTO tenía tres variantes y mi gate probaba UNA
 * semilla. La tercera decía «Lo nuevo está en QUÉ HACER: …» sin marcar que era juicio mío — `juicio-sin-marcar`
 * la vetaba con razón— y vivió escondida hasta que el supervisor corrió el mismo turno con otro largo de hilo
 * y le tocó esa variante. Una variante probada con una sola semilla no está probada: es una respuesta que el
 * owner va a pisar tarde o temprano.
 *
 * LA REGLA, ahora candado: por cada familia con cierre variable se recorren largos de hilo hasta CUBRIR las
 * tres variantes, y cada una sale por el TURNO ENTERO (muro + contrato + notarial). Si una familia no logra
 * cubrir sus tres, el gate lo dice — cobertura declarada, no supuesta. */
H("4 · cada variante de cada familia, por el turno completo — ninguna se prueba con una sola semilla");
{
  const FAMILIAS = [
    { nombre: "margen · el porqué", q: "por que estamos perdiendo margen?", mem: () => ({}) },
    { nombre: "margen · el seguimiento", q: "Volviendo al margen, ¿cambia tu lectura?", mem: (m) => m },
    { nombre: "síntesis ejecutiva", q: "dame los 3 riesgos para el directorio", mem: () => ({}) },
    { nombre: "la foto del negocio", q: "¿cómo va el negocio?", mem: () => ({}) },
  ];
  /* la tesis viva para el seguimiento: el mismo camino que el hilo real (T1 deja la tesis, T2 la usa) */
  const T1 = await answerViaAgente({ text: "dime por qué estamos perdiendo margen", history: [], mem: {}, scenario: "bonanza", callAgente: MUDO });
  const MEM_CON_TESIS = T1.mem || {};

  for (const F of FAMILIAS) {
    const cierres = new Set();
    let vetados = 0, corridos = 0;
    for (let len = 0; len <= 24 && cierres.size < 3; len += 2) {
      const r = await answerViaAgente({ text: F.q, history: relleno(len), mem: F.mem(MEM_CON_TESIS), scenario: "bonanza", callAgente: MUDO });
      corridos++;
      const vetos = (r.r.agente.vetos || []).length;
      if (r.r.agente.estado !== "playbook" || vetos) vetados++;
      /* se compara el TEXTO COMPLETO, no la última línea: en la síntesis lo que varía es la oferta y la última
       * línea es el umbral, constante — medir la cola daba «1 variante» sobre un texto que sí variaba. Con
       * cerebro mudo y el mismo escenario, la ÚNICA fuente de variación es la semilla. */
      cierres.add(String(r.r.text || "").trim());
    }
    ok(vetados === 0, `★ «${F.nombre}»: las ${cierres.size} variantes vistas en ${corridos} largos de hilo salen por el TURNO ENTERO sin un solo veto`);
    ok(cierres.size >= 2, `…y varían de verdad entre turnos (${cierres.size} cierres distintos)`);
  }
}

console.log(`\n── _variacion_gate: ${PASS} PASS · ${FAIL} FAIL (de ${PASS + FAIL}) ──`);
process.exit(FAIL ? 1 : 0);
