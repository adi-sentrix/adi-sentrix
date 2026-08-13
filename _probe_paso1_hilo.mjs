/* === _probe_paso1_hilo.mjs · Paso 1 "ADI pierde el hilo" · A1.1 + A1.2 (2026-08-13) =====================
 * PROBE 100% OFFLINE: importa los módulos de prompt/contrato por URL file:// y NO importa el gateway ni
 * ningún adapter — ninguna ruta de código acá puede producir una llamada pagada.
 * Correr con el candado de red puesto:  node --import ./scripts/offline-guard.mjs _probe_paso1_hilo.mjs
 *
 * Qué demuestra:
 *   A1.1 · el caso real del owner (pregunta → respuesta larga con tabla de 8 clientes → "no entiendo" →
 *          "las cuentas que estan bajo benchmark, que eso?"): la tabla COMPLETA del turno anterior llega
 *          entera tanto al mensaje de PLAN como al hiloReciente de NARRAR — las 8 filas, por string.
 *          (Antes: cada turno se cortaba en 220 chars — de la respuesta de ~1.191 sobrevivía el 18,5%.)
 *   A1.2 · con un hilo enorme (20 turnos de 3.000 chars) el presupuesto acota: el hilo nunca supera
 *          presupuesto+10%, el último turno de ADI va entero, y el recorte empieza por lo más viejo.
 *   extra· prioridad invertida text||gist (un turno SOLO-gist sigue funcionando como fallback) · el resumen
 *          jamás corta a mitad de cifra.
 */
const PP = await import(new URL("./src/adi/oracle/planPrompt.js", import.meta.url).href);
const NC = await import(new URL("./src/adi/oracle/narrationContract.js", import.meta.url).href);
const HB = await import(new URL("./src/adi/oracle/hiloBudget.js", import.meta.url).href);

const { buildPlanUserMessage } = PP;
const { buildNarrationContract } = NC;
const { aplicarPresupuestoHilo, primeraOracion, PLAN_HILO_PRESUPUESTO_CHARS, NARRAR_HILO_PRESUPUESTO_CHARS, RESUMEN_TURNO_MAX_CHARS } = HB;

let PASS = 0, FAIL = 0;
const ok = (cond, msg, extra) => {
  if (cond) { PASS++; console.log(`  ✓ ${msg}`); }
  else { FAIL++; console.log(`  ✗ ${msg}${extra ? " — " + extra : ""}`); }
};

/* ── A1.1 · el caso real del owner ────────────────────────────────────────────────────────────────────── */
console.log("── A1.1 · el caso del owner: la tabla completa sobrevive al hilo ──");
const FILAS = [
  "| Falabella | 22.1% | 7.9 pp | $18.4M |",
  "| Ripley | 23.5% | 6.5 pp | $12.1M |",
  "| La Polar | 24.0% | 6.0 pp | $9.8M |",
  "| Paris | 24.8% | 5.2 pp | $8.6M |",
  "| Hites | 25.3% | 4.7 pp | $7.2M |",
  "| Corona | 26.1% | 3.9 pp | $5.9M |",
  "| Abcdin | 27.4% | 2.6 pp | $4.4M |",
  "| Sodimac | 28.9% | 1.1 pp | $3.1M |",
];
const RESPUESTA_LARGA = `Tu cartera tiene 8 cuentas operando bajo tu benchmark de 30%. Juntas dejan $1.9M de contribución no capturada en el año cerrado — no es caja que salió, es margen que dejás de capturar por operar bajo tu piso.

| Cliente | Margen | Brecha | Ventas |
|---|---|---|---|
${FILAS.join("\n")}

La presión se concentra en **Falabella**: 7.9 puntos bajo tu piso, con la venta más alta de la lista. Una causa comprobada está en sus **acciones comerciales** — hoy $2.3M de carga sobre esa cuenta. Las demás brechas son menores pero suman: entre Ripley y La Polar hay otros $0.6M en juego según el mismo cálculo autorizado del año cerrado.

Empezá por revisar los rebates y descuentos de Falabella antes de tocar precio de lista: es la acción con mayor monto comprobable hoy, y el dato del año cerrado ya la sostiene.

[[SIGUIENTE_PASO]]
¿Querés que profundice en la composición de la compra de Falabella, familia por familia?`;
console.log(`  respuesta larga reconstruida: ${RESPUESTA_LARGA.length} chars (el caso real medía 1.191)`);

const HIST_OWNER = [
  { role: "user", text: "¿qué clientes están operando bajo el benchmark?" },
  { role: "adi", text: RESPUESTA_LARGA },
  { role: "user", text: "no entiendo" },
  { role: "adi", text: "Lo digo más simple: hay 8 cuentas que te dejan menos margen que el piso que vos definiste (30%). No es plata que se fue: es margen que no estás capturando. ¿Querés que te muestre por cuál empezar?" },
];
const TXT_OWNER = "las cuentas que estan bajo benchmark, que eso?";

const planMsg = buildPlanUserMessage(HIST_OWNER, TXT_OWNER);
ok(FILAS.every((f) => planMsg.includes(f)), "PLAN recibe las 8 filas de la tabla, verbatim");
ok(planMsg.includes(RESPUESTA_LARGA), "PLAN recibe la respuesta larga ENTERA (prosa + tabla + cierre)");
ok(planMsg.includes(`Turno actual del usuario: «${TXT_OWNER}»`), "y el turno actual viaja completo por su canal");

const contrato = buildNarrationContract({
  text: TXT_OWNER,
  plan: { intent: "answer", mode: "clarify", calls: [] },
  results: [], ledgerFigs: [], mem: {}, history: HIST_OWNER, pref: null, scenario: "actual",
});
const hilo = contrato.hiloReciente;
const dichoADI = hilo.filter((m) => m.quien === "ADI").map((m) => m.dijo).join("\n");
ok(FILAS.every((f) => dichoADI.includes(f)), "hiloReciente de NARRAR trae las 8 filas de la tabla, verbatim");
ok(hilo.some((m) => m.dijo === RESPUESTA_LARGA), "la respuesta larga viaja ENTERA como un turno del hilo");
ok(hilo.length === 4, `la ventana por cantidad no cambió: slice(-4) → ${hilo.length} turnos`);

/* ── A1.2 · el presupuesto acota un hilo enorme ───────────────────────────────────────────────────────── */
console.log("\n── A1.2 · hilo enorme: 20 turnos de 3.000 chars ──");
const turno3000 = (i, role) => {
  const frase = `Turno ${i} (${role}): la lectura del período cerró en $${i}.${i}M con margen ${20 + (i % 9)}.${i % 10}% sobre el benchmark declarado. `;
  let s = "";
  while (s.length < 3000) s += frase;
  return s.slice(0, 3000);
};
const HIST_20 = Array.from({ length: 20 }, (_, i) => ({ role: i % 2 === 0 ? "user" : "adi", text: turno3000(i + 1, i % 2 === 0 ? "user" : "adi") }));

for (const [nombre, ventana, presupuesto] of [["PLAN", 8, PLAN_HILO_PRESUPUESTO_CHARS], ["NARRAR", 4, NARRAR_HILO_PRESUPUESTO_CHARS]]) {
  const win = HIST_20.slice(-ventana);
  const res = aplicarPresupuestoHilo(win, presupuesto);
  const total = res.reduce((a, m) => a + m.dijo.length, 0);
  const iUltimoAdi = (() => { for (let i = win.length - 1; i >= 0; i--) if (win[i].role !== "user") return i; return -1; })();
  console.log(`  ${nombre}: ventana ${ventana} turnos · presupuesto ${presupuesto} · hilo resultante ${total} chars · enteros ${res.filter((m) => m.completo).length}/${res.length}`);
  ok(total <= presupuesto * 1.1, `${nombre}: el hilo nunca supera presupuesto+10% (${total} ≤ ${Math.round(presupuesto * 1.1)})`);
  ok(res[iUltimoAdi].completo && res[iUltimoAdi].dijo.length === 3000, `${nombre}: el último turno de ADI va ENTERO (3.000 chars)`);
  ok(!res[0].completo && res[0].dijo.endsWith("…") && res[0].dijo.length <= RESUMEN_TURNO_MAX_CHARS + 1,
    `${nombre}: el recorte empezó por lo más viejo (turno 1 resumido a ${res[0].dijo.length} chars + "…")`);
  const primerEntero = res.findIndex((m) => m.completo);
  ok(primerEntero >= 0 && res.slice(primerEntero).every((m) => m.completo),
    `${nombre}: los turnos enteros son un tramo contiguo al FINAL del hilo (lo que se resume es lo más viejo)`);
}

/* ── extra · fallback gist y frontera de cifra ────────────────────────────────────────────────────────── */
console.log("\n── extra · fallback gist-only + resumen que no corta cifras ──");
const soloGist = aplicarPresupuestoHilo([{ role: "adi", gist: "resumen viejo del turno" }], 100);
ok(soloGist[0].dijo === "resumen viejo del turno", "un turno SOLO-gist (gates/callers viejos) sigue usando gist como fallback");
const conAmbos = aplicarPresupuestoHilo([{ role: "adi", text: "el texto completo manda", gist: "el gist ya no pisa al texto" }], 100);
ok(conAmbos[0].dijo === "el texto completo manda", "con text Y gist, gana el TEXTO (prioridad invertida: text || gist)");
const r1 = primeraOracion("El margen quedó en 22.1% sobre $4.207.331 en ventas del año cerrado. Después de eso viene el detalle por familia.");
ok(r1 === "El margen quedó en 22.1% sobre $4.207.331 en ventas del año cerrado.…",
  'la primera oración respeta "22.1%" y "$4.207.331" (el punto entre dígitos NO corta)', JSON.stringify(r1));
const r2 = primeraOracion("una sola frase corta sin punto final");
ok(r2 === "una sola frase corta sin punto final", "un turno de una sola frase corta va entero, sin «…»");

console.log(`\n── _probe_paso1_hilo: ${PASS} PASS · ${FAIL} FAIL ──`);
process.exit(FAIL ? 1 : 0);
