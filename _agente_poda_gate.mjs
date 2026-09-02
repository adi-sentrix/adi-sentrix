/* === _agente_poda_gate.mjs · TIRAR LA ORACIÓN, NO EL TURNO (certificación 2026-09-01) =======================
 *
 * EL DEFECTO MEDIDO (T2 del escenario 1, US$0.138 de corrida): el turno TENÍA la respuesta que el owner pidió,
 * completa y correcta —«tu venta oficial del período es $100.0M. Con un crecimiento de +3.0% a 12 meses, la
 * proyección te deja en $103.0M — es decir, $3.0M adicionales»— con el trato puesto. Y el usuario recibió
 * «No pude completar la lectura». Lo que lo mató fue UNA ORACIÓN DE COLOR: «los $3.0M extra no te recuperan
 * los $4.9M… en Falabella, Lider y Jumbo», con una cifra traída de memoria cuyo dueño real es otro. La
 * reparación la reformuló («que vimos en» → «concentrada en») sin mover la atribución, y el turno entero se
 * descartó. Era todo-o-nada: arreglar el peldaño hace que el rescate rescate mejor; esto hace que NO HAYA
 * rescate.
 *
 * ⚠️ EL RIESGO ES MUTILAR, y por eso las condiciones son cuatro y acumulativas (ver `_podarOracionVetada`).
 * Medido sobre los 34 borradores vetados del corpus: se podan 22, y CERO quedan con muñón, con referencia
 * huérfana o sin su cierre. Ese cero costó dos condiciones que no estaban en la primera versión — las dos
 * salieron de la medición, no del diseño (ver los bloques 3 y 4).
 *
 * OFFLINE · determinístico · CERO llamadas al modelo · bandera ADI_AGENTE APAGADA.
 * `node --import ./scripts/offline-guard.mjs _agente_poda_gate.mjs` */
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { initTenant } from "./src/data/tenantStore.js";
import { TENANT_DEMO } from "./src/data/tenants/demo.js";
import { answerViaAgente, _podarOracionVetada } from "./src/adi/agente/bucleAgente.js";
import { recortarMunonDeOracion } from "./src/adi/oracle/guardC.js";
import { ESCENARIO_INICIAL } from "./src/config/scenarios.js";

let pass = 0, fail = 0;
const ok = (cond, label, detalle) => {
  if (cond) { pass++; console.log(`  ✓ ${label}`); }
  else { fail++; console.log(`  ✗ ${label}`); if (detalle !== undefined) console.log(`      ${detalle}`); }
};
const H = (t) => console.log(`\n${t}`);
initTenant(TENANT_DEMO);

/* el T2 de la certificación, VERBATIM del expediente */
const T2 = "Tu venta oficial del período es $100.0M. Con un crecimiento de +3.0% a 12 meses, la proyección te deja en $103.0M — es decir, $3.0M adicionales.\n\nAhora bien, JC: ese margen que hoy está en 25.1% sigue igual en la proyección si no cambia nada más. Los $3.0M extra no te recuperan los $4.9M de contribución no capturada que vimos en Falabella, Lider y Jumbo.\n\n¿Vemos cómo mueve el margen si corriges la carga en Falabella?";
/* el T4, VERBATIM: acá la oración vetada SOSTIENE la que sigue («una diferencia de $200K») */
const T4 = "Con tu venta del período de $100.0M, un +4% a 12 meses te deja en $104.0M.\n\n**Adicional generado: $4.0M.**\n\nSi los $4.0M entran a margen actual, sumas $1.0M en contribución bruta. Si los corriges a benchmark antes de crecer, sumas $1.2M — una diferencia de $200K.\n\n¿Dónde enfocas: en crecer volumen, o en corregir margen primero?";
const figsDe = (t) => (t.match(/\$\s?[\d.,]+\s?[KMB]?/g) || []).map((v) => ({ value: v.trim() }));

/* ═══ 1 · EL CASO QUE LO ORIGINÓ ════════════════════════════════════════════════════════════════════════════ */
H("1 · el T2: se va la oración de color, queda la respuesta");
{
  const p = _podarOracionVetada(T2, "cierre · «$4.9M» existe en el dato del negocio pero su dueño (Tottus/Ripley) no está nombrado", figsDe(T2));
  ok(!!p, "★ el T2 se poda", JSON.stringify(p));
  ok(!!p && p.includes("$103.0M") && p.includes("$3.0M"), "★ y la RESPUESTA sobrevive entera: la proyección que el usuario pidió", p);
  ok(!!p && !p.includes("$4.9M"), "…la cifra vetada se fue");
  ok(!!p && p.includes("JC"), "…el trato se conserva");
  ok(!!p && /¿Vemos cómo mueve el margen/.test(p), "…y el cierre también: no queda un texto sin salida");
  ok(!!p && recortarMunonDeOracion(p) === p, "…sin muñón: el texto cierra donde debe");
}

/* ═══ 2 · END-TO-END · POR EL BUCLE REAL, y volviendo a pasar el muro ═══════════════════════════════════════
 * No alcanza con que la función corte bien: el texto podado tiene que pasar el muro COMPLETO otra vez. */
H("2 · el turno completo, por el bucle: de «no pude completar» a la respuesta");
{
  const guion = async ({ ronda }) => (ronda === 1
    ? { tipo: "herramientas", pedidos: [{ tool: "proyectar", args: { tasa: 3, horizonte: "12 meses" } }] }
    : { tipo: "texto", texto: T2 });
  /* sin «%» a propósito (re-apuntado 2026-09-01): con «crezco 3%» el playbook proyección-declarada compone
   * ANTES de que el cerebro hable y la poda nunca corre. Este bloque mide LA PODA sobre el texto del cerebro,
   * así que la pregunta se queda sin supuesto (C se retira) y el guion sigue trayendo la proyección a la boleta. */
  const r = await answerViaAgente({ text: "cuanto seria mi venta si crece el año que viene?",
    history: [], mem: {}, scenario: ESCENARIO_INICIAL, callAgente: guion });
  ok(r.r.agente.estado === "podado", `★ el turno termina en «podado» (${r.r.agente.estado}) — antes: «limite»`);
  ok(/\$103\.0M/.test(r.r.text), "★ y la cifra que el usuario pidió LLEGA A PANTALLA", r.r.text.slice(0, 120));
  ok(!/No pude completar la lectura/.test(r.r.text), "…y ya no recibe «No pude completar la lectura»");
  ok(r.r.agente.vetos.length >= 2, `el expediente CONSERVA los vetos (${r.r.agente.vetos.length}) — la poda no los borra`);
}

/* ═══ 3 · LO QUE NO SE PODA · la oración que SOSTIENE lo que sigue ══════════════════════════════════════════
 * Esta condición NO estaba en la primera versión: salió de medir. Sin ella, el T4 quedaba diciendo «sumas
 * $1.2M — una diferencia de $200K» con el otro término borrado: gramatical y FALSO. */
H("3 · no se poda una oración de la que depende la siguiente");
{
  const p = _podarOracionVetada(T4, "cierre · $1.0M", figsDe(T4));
  ok(p === null, "★ el T4 NO se poda: la oración de después compara contra la cifra vetada", JSON.stringify(p));
}

/* ═══ 4 · LO QUE NO SE PODA · cuando la cifra vetada ES la respuesta ════════════════════════════════════════ */
H("4 · si lo vetado es lo que el usuario pidió, no se corta nada");
{
  const soloRespuesta = "Tu venta del período es $100.0M. Con +3% te deja en $103.0M.";
  ok(_podarOracionVetada(soloRespuesta, "cierre · $103.0M", [{ value: "$103.0M" }]) === null,
    "★ podar dejaría al turno sin la cifra que el turno leyó → no se poda");
  ok(_podarOracionVetada("Una sola oración con $4.9M adentro.", "cierre · $4.9M", figsDe(T2)) === null,
    "…y con UNA sola oración tampoco: podarla es tirar el turno");
  ok(_podarOracionVetada(T2, "cierre · no hay cifras acá", figsDe(T2)) === null,
    "…y si la multa no nombra ninguna cifra, no hay oración que señalar");
}

/* ═══ 5 · EL CORPUS · el riesgo de mutilar, medido sobre el expediente CONGELADO ════════════════════════════
 * Se aplica la poda a los borradores vetados REALES de las corridas de certificación. El número de mutiladas
 * tiene que ser cero, y si algún día deja de serlo, este check lo dice antes que un usuario.
 * ⚠️ RE-APUNTADO 2026-09-02: la primera versión leía los archivos de corrida MUTABLES del checkout principal,
 * pareando estado↔debug POR ÍNDICE. Cada corrida nueva del supervisor los sobreescribía y el corpus se volvía
 * pares Frankenstein (el borrador de un turno juzgado con la multa de otro): la selectividad dio «0 de 22» sin
 * que la poda hubiera cambiado — el corpus había muerto debajo del check, la misma enfermedad del documento
 * que envejece. Ahora el corpus está CONGELADO en fixtures/poda-corpus-2026-09.json, auto-pareado (cada caso
 * lleva el veto de SU propio turno) y commiteado: 32 borradores, de los que HOY se podan 15 — medido al
 * congelar, con el t4 de la certificación (estado real: podado) adentro. */
H("5 · sobre el corpus congelado del expediente: ninguna respuesta queda mutilada");
{
  const HUERFANA = /\b(es[eoa]s?|aquell[oa]s?)\s+(cifra|monto|clientes?|puntos?)\b|\bes[oa]\s+(mismo|misma)\b/i;
  const cierreFinal = (s) => /[?¿][^?]*$/.test(String(s).trim().split(/\n/).slice(-1)[0] || "");
  const F = JSON.parse(fs.readFileSync(path.join(process.cwd(), "fixtures", "poda-corpus-2026-09.json"), "utf8"));
  let vistos = 0, podados = 0; const malos = [];
  for (const c of F.casos) {
    vistos++;
    const p = _podarOracionVetada(c.borrador, c.multa, figsDe(c.borrador));
    if (!p) continue;
    podados++;
    const problemas = [];
    if (recortarMunonDeOracion(p) !== p) problemas.push("muñón");
    if (HUERFANA.test(p) && !HUERFANA.test(c.borrador)) problemas.push("huérfana");
    if (cierreFinal(c.borrador) && !cierreFinal(p)) problemas.push("sin cierre");
    if (problemas.length) malos.push(`${c.t} ${problemas.join("+")}`);
  }
  console.log(`      corpus congelado: ${vistos} borradores vetados · se podan ${podados}`);
  ok(malos.length === 0, `★ CERO respuestas mutiladas de ${podados} podas`, malos.join(" · "));
  ok(podados > 0 && podados < vistos, `★ y la poda es SELECTIVA: ${podados} de ${vistos} — ni todas ni ninguna`);
  /* ⚠️ EL T4 «PODADO» NO SE RE-PODA DESDE ESTE FIXTURE, y no es un hueco: los vetos que el registro guarda son
   * ETIQUETAS RECORTADAS («reparacion · 4.9x»), no la multa completa que viajó en vivo — y la poda decide con
   * la multa completa. Medido: con la etiqueta corta (y aun con la boleta real de gridTable) este par no poda.
   * La prueba VIVA del t4 está donde corresponde: el replay de `_certificacion_congelada_gate` re-ejecuta el
   * turno entero con el cerebro del expediente y la multa real en vuelo, y exige el rastro «poda · …» — con
   * carnada que revierte la poda y lo pone rojo. Acá el corpus mide lo que el corpus sabe medir: mutilaciones
   * (cero) y selectividad. */
}

/* ═══ 6 · CARNADAS ═════════════════════════════════════════════════════════════════════════════════════════ */
H("6 · carnadas");
const carnada = async (nombre, reemplazos, comprobar) => {
  const p = path.join(process.cwd(), "src/adi/agente/bucleAgente.js");
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

// (a) EL DEFECTO ORIGINAL: sin poda, el T2 vuelve a tirar la respuesta entera.
await carnada("la poda desconectada (el todo-o-nada de vuelta)",
  [[/      if \(!aprobado && t2\.trim\(\) && v2 && !v2\.ok\) \{/, "      if (false) {"]],
  async (M) => {
    initTenant(TENANT_DEMO);
    const guion = async ({ ronda }) => (ronda === 1
      ? { tipo: "herramientas", pedidos: [{ tool: "proyectar", args: { tasa: 3, horizonte: "12 meses" } }] }
      : { tipo: "texto", texto: T2 });
    // sin «%», como el bloque 2: con supuesto el playbook C compone y la poda nunca corre
    const r = await M.answerViaAgente({ text: "cuanto seria mi venta si crece el año que viene?",
      history: [], mem: {}, scenario: ESCENARIO_INICIAL, callAgente: guion });
    /* ⚠️ ESTA COMPROBACIÓN EXIGÍA que sin poda la cifra NO llegara a pantalla, y dejó de distinguir en cuanto
     * se arregló el peldaño: ahora el rescate TAMBIÉN sirve «$103.0M», porque aprendió a servir el resultado
     * del turno en vez de la base. La carnada seguía roja por casualidad y habría quedado verde sin medir.
     * Lo que separa los dos mundos no es la cifra: es si el usuario recibe LA RESPUESTA o un rescate. */
    return r.r.agente.estado !== "podado" && /No pude completar la lectura/.test(String(r.r.text || ""));
  });

// (b) la condición que salió de MEDIR: sin ella el T4 queda afirmando una diferencia contra un término borrado.
await carnada("podar aunque la oración siguiente dependa de la vetada",
  [[/  if \(_COMPARA\.test\(posteriores\)\) return null;/, "  // CARNADA: la dependencia deja de importar"]],
  async (M) => M._podarOracionVetada(T4, "cierre · $1.0M", figsDe(T4)) !== null);

// (c) sin la condición de que la respuesta sobreviva, se poda hasta dejar al turno sin lo que leyó.
await carnada("podar sin exigir que la respuesta sobreviva",
  [[/  const sobrevive = deLaBoleta\.some\(\(v\) => _norm\(podado\)\.includes\(v\)\);/, "  const sobrevive = true;   // CARNADA"]],
  async (M) => M._podarOracionVetada("Tu venta del período es $100.0M. Con +3% te deja en $103.0M.", "cierre · $103.0M", [{ value: "$103.0M" }]) !== null);

// (d) sin tope, media respuesta vetada se poda igual — eso ya no es una frase de color.
await carnada("podar sin tope (media respuesta se va)",
  [[/  if \(!ofensoras\.length \|\| ofensoras\.length > TOPE_PODA\) return null;/, "  if (!ofensoras.length) return null;   // CARNADA"]],
  async (M) => {
    const muchas = "Falabella cede $1.1M. Lider cede $1.1M. Jumbo cede $1.1M. Tottus cede $1.1M. Y tu venta es $100.0M.";
    return M._podarOracionVetada(muchas, "cierre · $1.1M", [{ value: "$100.0M" }]) !== null;
  });

console.log(`\n── _agente_poda_gate: ${pass} PASS · ${fail} FAIL (de ${pass + fail}) ──`);
process.exit(fail ? 1 : 0);
