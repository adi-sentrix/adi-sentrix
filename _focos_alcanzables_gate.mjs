/* === _focos_alcanzables_gate.mjs · UN FOCO QUE EL PLANIFICADOR NO VE NO EXISTE (owner 2026-08-12) ======
 * @inspeccion-estatica — lee `planPrompt.js` como TEXTO además de ejecutar las tools. No importa el gateway,
 * no invoca a nadie, no sale a la red; el candado de runtime se le aplica igual que a todos.
 *
 * POR QUÉ EXISTE: el owner hizo clic en «¿Qué clientes venden mucho pero dejan poco margen?» y ADI le volcó la
 * boleta cruda —«el resto de lo autorizado en este turno»— eligiendo por magnitud máxima. La lectura correcta
 * EXISTÍA y funcionaba: `marginRead{focus:"alto_volumen_bajo_margen"}` devuelve 43 cifras que cruzan volumen
 * con margen. Lo que faltaba era una línea: **el catálogo del PLAN declaraba 2 de los 7 focos**, así que el
 * planificador no podía pedir algo que nadie le nombró, y el turno caía al respaldo determinístico.
 *
 * ES LA MISMA CLASE DE DEFECTO que las dos tools que no estaban expuestas (`entityComposicion`,
 * `entityCapitalLigado`) y que el cruce cliente×SKU, vivo desde julio e invisible para el planner. Por eso el
 * gate NO verifica «alto_volumen_bajo_margen»: verifica **la clase entera**. Arreglar el caso y dejar la clase
 * abierta es lo que hizo que esto llegara a producción.
 *
 *   [1] BIYECCIÓN · todo foco que la tool RESUELVE está declarado en el catálogo del PLAN, y al revés.
 *   [2] CADA UNO RESPONDE · ninguno declarado devuelve una boleta vacía (declarar lo que no funciona es peor).
 *   [3] DISTINGUIBLES · dos focos distintos no pueden dar la misma lectura, o uno de los dos sobra.
 *   [4] EL CASO DEL OWNER · «alto_volumen_bajo_margen» cruza VENTA y MARGEN, no ordena por venta.
 *   [5] SIN JERGA INTERNA · las tres frases del respaldo no pueden salir de una lectura con foco.
 * Cero red, cero LLM. `npm run gates:offline`
 */
import { readFileSync } from "fs";
import { runPlan } from "./src/adi/oracle/toolRunner.js";

let PASS = 0, FAIL = 0;
const ok = (c, m, extra = "") => { if (c) { PASS++; console.log("  ✓ " + m); } else { FAIL++; console.log("  ✗ " + m + (extra ? "\n      " + extra : "")); } };
const H = (t) => console.log("\n" + t);

const CATALOGO = readFileSync("./src/adi/oracle/planPrompt.js", "utf8");
// Los focos que la TOOL resuelve de verdad. Fuente: marginFocus.js + specRetrieval (_MFOCUS_TITLE).
const FOCOS = ["bajo_benchmark", "alto_volumen_bajo_margen", "causa_precio", "causa_costo",
  "subir_precio", "alto_margen_subpenetrado", "palancas"];

const leer = (focus) => {
  const r = runPlan({ intent: "answer", mode: "diagnostico", calls: [{ tool: "marginRead", args: { dimension: "cliente", focus } }] }, { scenario: "bonanza" });
  return { figs: (r.ledger.figs || []), labels: (r.ledger.figs || []).map((f) => String(f.label || "")) };
};

/* DECLARADOS vs PENDIENTES (owner 2026-08-12) · el owner NO autorizó declarar los siete de una: cada foco
 * cuesta tokens en CADA llamada de PLAN, así que se declaran de a uno, con demanda probada. Lo que este gate
 * impide no es que falte un foco — es que falte EN SILENCIO. Un pendiente nombrado acá es una decisión; uno
 * que nadie escribió es el defecto que llegó a producción.
 * `causa_precio` y `causa_costo` NO se declaran a propósito: devuelven lecturas IDÉNTICAS (probado en [3]).
 * Declarar dos focos que son uno le enseñaría al planificador una distinción que el motor no hace. */
const DECLARADOS = ["bajo_benchmark", "alto_volumen_bajo_margen"];
const PENDIENTES = {
  causa_precio: "idéntico a causa_costo — decidir si son alias o si falta implementación",
  causa_costo: "idéntico a causa_precio — decidir si son alias o si falta implementación",
  subir_precio: "sin demanda probada todavía; cuesta tokens en cada llamada",
  alto_margen_subpenetrado: "sin demanda probada todavía; cuesta tokens en cada llamada",
  palancas: "sin demanda probada todavía; cuesta tokens en cada llamada",
};

H("[1] BIYECCIÓN · lo declarado se puede pedir · lo pendiente está NOMBRADO, no perdido");
{
  for (const f of DECLARADOS) {
    ok(CATALOGO.includes(`"${f}"`), `el catálogo del PLAN declara \`${f}\``,
      "la tool lo resuelve pero el planificador no puede nombrarlo: el turno caerá al respaldo");
  }
  for (const f of FOCOS.filter((x) => !DECLARADOS.includes(x))) {
    ok(f in PENDIENTES, `\`${f}\` está declarado como PENDIENTE con su motivo — ${PENDIENTES[f] || "SIN MOTIVO"}`,
      "un foco que la tool resuelve y que nadie declaró ni anotó es el defecto que llegó a producción");
  }
  ok(Object.keys(PENDIENTES).every((p) => FOCOS.includes(p)),
    "y ningún pendiente anotado que la tool ya no resuelva (la lista no se pudre sola)");
  // al revés: nada declarado que la tool no resuelva (prometer lo que no hay es peor que no prometerlo)
  const declarados = [...CATALOGO.matchAll(/focus:\s*"([a-z_]+)"|"([a-z_]+)"\s*\(/g)]
    .map((m) => m[1] || m[2]).filter((x) => x && /^[a-z]+(_[a-z]+)+$/.test(x));
  const fantasma = declarados.filter((d) => FOCOS.includes(d) === false && /margen|volumen|precio|costo|benchmark|palanca|penetr/.test(d));
  ok(fantasma.length === 0, `ningún foco declarado que la tool no resuelva — ${fantasma.join(", ") || "ninguno"}`);
}

H("[2] CADA UNO RESPONDE · declarar algo que devuelve vacío es peor que no declararlo");
{
  for (const f of FOCOS) {
    const { figs } = leer(f);
    ok(figs.length > 10, `\`${f}\` devuelve una lectura real — ${figs.length} cifras`);
  }
}

H("[3] DISTINGUIBLES · dos focos que dan lo mismo significan que uno sobra");
{
  const firmas = new Map();
  for (const f of FOCOS) firmas.set(f, leer(f).labels.join("|"));
  /* LA COLISIÓN CONOCIDA se declara acá y NO rompe: `causa_precio` y `causa_costo` devuelven lecturas idénticas.
   * Es un defecto real, anterior a este pase, y por eso el owner decidió NO declarar ninguno de los dos al
   * planificador hasta saber si son alias o si a uno le falta implementación. Se reporta en cada corrida para
   * que no se olvide. Lo que SÍ rompe es una colisión NUEVA: dos focos que empiezan a dar lo mismo sin que
   * nadie lo haya decidido es exactamente cómo un foco se vuelve decorativo sin que se note. */
  const CONOCIDAS = new Set(["causa_costo = causa_precio"]);
  const dup = [];
  for (const a of FOCOS) for (const b of FOCOS) if (a < b && firmas.get(a) === firmas.get(b)) dup.push(`${a} = ${b}`);
  const nuevas = dup.filter((d) => !CONOCIDAS.has(d));
  const vivas = dup.filter((d) => CONOCIDAS.has(d));
  ok(nuevas.length === 0, `ninguna colisión NUEVA entre focos — ${nuevas.join(" · ") || "ninguna"}`);
  ok(vivas.length === CONOCIDAS.size,
    `la colisión conocida sigue ahí y sigue anotada — ${vivas.join(" · ") || "SE RESOLVIÓ: sacala de CONOCIDAS y decidí si declarar los dos focos"}`);
}

H("[4] EL CASO DEL OWNER · cruza volumen y margen, NO ordena por venta");
{
  const { labels } = leer("alto_volumen_bajo_margen");
  const tieneVenta = labels.some((l) => /· Venta$/.test(l));
  const tieneMargen = labels.some((l) => /· Margen$/.test(l));
  ok(tieneVenta && tieneMargen, `la lectura trae VENTA y MARGEN de cada cuenta — venta:${tieneVenta} margen:${tieneMargen}`);
  ok(labels.some((l) => /benchmark/i.test(l)), "y la vara contra la que se compara");
  ok(labels.some((l) => /1pp/i.test(l)), "y el valor de 1pp, que es la oportunidad cuantificada (la brecha viaja en la lectura, no como etiqueta)");
  // el defecto medido: el respaldo recomendaba Falabella por ser la venta MÁS GRANDE
  const solo = leer("bajo_benchmark");
  ok(labels.join("|") !== solo.labels.join("|"), "y NO es la misma lectura que `bajo_benchmark` (si lo fuera, el foco sería decorativo)");
}

H("[5] SIN JERGA INTERNA · el vocabulario del respaldo no puede salir a superficie");
{
  const PROHIBIDO = [/el resto de lo autorizado/i, /autorizado en este turno/i, /magnitud mayor de las autorizadas/i];
  for (const f of FOCOS) {
    const txt = leer(f).labels.join(" ");
    const sucio = PROHIBIDO.filter((re) => re.test(txt));
    ok(sucio.length === 0, `\`${f}\` no emite jerga interna en sus etiquetas`);
  }
}

console.log(`\n── FOCOS ALCANZABLES · ${PASS} PASS · ${FAIL} FAIL ──`);
process.exitCode = FAIL ? 1 : 0;
