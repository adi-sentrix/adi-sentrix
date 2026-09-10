/* === _referencia_de_cifra_gate.mjs · UNA CIFRA QUE SOSTIENE UNA RECOMENDACIÓN TRAE SU REFERENCIA ============
 *
 * LA REGLA DEL OWNER, textual (2026-09-09): «Si ADI usa una cifra para sostener una recomendación, debe traer
 * también su referencia. No basta decir "su carga es 4.5%"; debe decir "4.5% contra nivel declarado de 3.5%".»
 *
 * DE DÓNDE SALIÓ, y por eso es ley del muro y no una nota de estilo: al pesar «¿le doy más descuento a X?»,
 * el piso determinístico decía «su carga comercial hoy va 4.5% — el espacio lo ves ahí». La cifra era
 * correcta, estaba en la boleta, y los 239 candados estaban verdes. Y aun así la frase no servía para
 * decidir: un 4.5% no es alto ni bajo hasta que se dice contra qué. Sin la referencia, «tienes espacio» era
 * una opinión con una cifra al lado.
 *
 * ⚠️ LO QUE ESTE CANDADO NO HACE es exigir referencia a TODA cifra. «Te deben $41.2M» es un hecho y se dice
 * solo. La regla cubre la cifra que hace de ARGUMENTO — la que aparece en la misma frase donde ADI empuja una
 * decisión—, porque ahí, sin vara de comparación, el dueño no puede evaluar el consejo, solo creerlo. Un
 * candado que multara toda cifra convertiría cada lectura en una tabla comparada, que es justo lo contrario
 * de lo que este producto hace.
 *
 * OFFLINE · determinístico · CERO llamadas al modelo.
 * `node --import ./scripts/offline-guard.mjs _referencia_de_cifra_gate.mjs` */
import { initTenant } from "./src/data/tenantStore.js";
import { TENANT_DEMO } from "./src/data/tenants/demo.js";
import { vetosDeReferencia } from "./src/adi/agente/referenciaDeLaCifra.js";
import { answerViaAgente } from "./src/adi/agente/bucleAgente.js";
import { ESCENARIO_INICIAL } from "./src/config/scenarios.js";
import { readFileSync } from "node:fs";

let pass = 0, fail = 0;
const ok = (cond, label, detalle) => {
  if (cond) { pass++; console.log(`  ✓ ${label}`); }
  else { fail++; console.log(`  ✗ ${label}`); if (detalle !== undefined) console.log(`      ${String(detalle).slice(0, 320)}`); }
};
const H = (t) => console.log(`\n${t}`);
const MUDO = async () => ({ tipo: "texto", texto: "" });
const ESC = ESCENARIO_INICIAL;

initTenant(TENANT_DEMO);

/* la boleta de muestra: una cifra con su referencia declarada al lado, como la publica el motor */
const FIGS = [
  { label: "Falabella · Carga comercial", value: "4.5%" },
  { label: "Nivel de carga comercial declarado", value: "3.5%" },
  { label: "Falabella · Contribución", value: "$4.3M" },
  { label: "Falabella · exceso de acciones comerciales", value: "$194K" },
  { label: "Saldo pendiente · total", value: "$41.2M" },
];
const arde = (t, sitio = "cierre") => vetosDeReferencia(t, { figs: FIGS, sitio }).length > 0;

/* ═══ 1 · ★ LA FRASE DEL DEFECTO REAL ═══════════════════════════════════════════════════════════════════════ */
H("1 · ★ la frase que originó la regla — y la misma frase arreglada");
{
  ok(arde("Su carga comercial hoy va 4.5% — el espacio lo ves ahí; la pregunta es contra qué lo cedes."),
    "★ la frase EXACTA que el owner señaló ARDE: cifra sola sosteniendo «tienes espacio»");
  ok(!arde("Su carga comercial hoy va 4.5% contra un nivel declarado de 3.5% — el espacio lo ves ahí."),
    "★ y la misma frase CON su referencia pasa limpia — que es la corrección que el owner pidió, textual");
  ok(arde("Te conviene renegociar: su carga va 4.5%."), "recomendar apoyado en una cifra suelta ARDE");
  ok(arde("Deberías revisar esa cuenta: pesa $4.3M."), "y da igual la unidad: un monto solo tampoco es alto ni bajo");
}

/* ═══ 2 · LAS FORMAS LEGÍTIMAS DE DAR LA REFERENCIA ═════════════════════════════════════════════════════════
 * Deliberadamente amplio: hay varias maneras honestas de decir contra qué, y un candado que solo aceptara una
 * obligaría a escribir todas las frases igual. */
H("2 · lo que cuenta como referencia — cuatro formas, todas legítimas");
{
  ok(!arde("Te conviene renegociar: 4.5% contra 3.5%."), "(a) una segunda cifra en la misma frase");
  ok(!arde("Te conviene renegociar: su carga va 4.5%, sobre el nivel declarado."), "(b) la palabra de comparación con su término");
  ok(!arde("Te conviene renegociar: tiene $194K de exceso sobre lo declarado."), "(c) la cifra que YA es relativa — un exceso trae su referencia por construcción");
  ok(!arde("El nivel declarado es 3.5%, contra eso se mide. Su carga va 4.5%, así que te conviene revisarla."),
    "(d) la referencia dada en la frase inmediatamente anterior");
}

/* ═══ 3 · LO QUE NO DEBE ARDER ══════════════════════════════════════════════════════════════════════════════
 * Un candado que se pasa de ancho es peor que ninguno: obliga a rodeos y termina apagándose. */
H("3 · lo que NO arde — porque no es una recomendación apoyada en una cifra");
{
  ok(!arde("Te deben $41.2M."), "una lectura corriente es un hecho: se dice sola");
  ok(!arde("¿Te abro el detalle por cuenta? Su contribución va $4.3M."), "una oferta de cierre no recomienda nada");
  ok(!arde("Te conviene renegociar esa condición."), "recomendar SIN cifra es otro problema, y lo cobra otro juez");
  ok(!arde("No tengo información autorizada suficiente para responder eso."), "declinar honestamente no arde");
  ok(!arde(""), "un texto vacío no genera multas fantasma");
  ok(!arde("Su carga va 4.5% — el espacio lo ves ahí.", "linea-honesta"),
    "★ y JUZGA AL CEREBRO, NO A LOS PELDAÑOS: la línea honesta sirve textos ya juzgados, y multar al que rescata es castigar al que arregla");
  ok(!arde("Su carga va 4.5% — el espacio lo ves ahí.", "respaldo"), "…lo mismo el respaldo");
}

/* ═══ 4 · ESTÁ CABLEADA AL MURO ═════════════════════════════════════════════════════════════════════════════
 * Una ley que nadie invoca es un archivo. Se verifica en el código del bucle, no de memoria. */
H("4 · la ley está conectada al muro del agente, no solo escrita");
{
  const bucle = readFileSync(new URL("./src/adi/agente/bucleAgente.js", import.meta.url), "utf8");
  ok(/import \{ vetosDeReferencia \}/.test(bucle), "el bucle la importa");
  ok(/vetosDeReferencia\(t, \{[^}]*figs: figsTotales[^}]*sitio[^}]*\}\)/.test(bucle),
    "★ y la invoca con la boleta REAL del turno y el sitio — no con una copia ni con la boleta de otro");
  ok(/\.\.\.vRef,/.test(bucle), "…y su resultado entra a la lista de vetos que decide el turno");
}

/* ═══ 5 · LAS TRES RUTAS CONVERSACIONALES LA CUMPLEN ════════════════════════════════════════════════════════ */
H("5 · las rutas del owner pasan la ley por el camino real del agente");
{
  const PREGUNTAS = [
    ["hipótesis · acciones", "creo que es por descuentos, ¿estoy en lo correcto?"],
    ["decisión · ceder", "¿le doy más descuento a Falabella?"],
    ["decisión · volumen", "¿hago bien en priorizar volumen?"],
    ["contradicción · negocio", "¿por qué vendo más pero gano menos?"],
    ["contradicción · cobranza", "¿por qué tengo deuda alta pero poco vencido?"],
  ];
  for (const [tag, q] of PREGUNTAS) {
    const r = await answerViaAgente({ text: q, history: [], mem: {}, scenario: ESC, callAgente: MUDO });
    const vetos = ((r.r && r.r.agente && r.r.agente.vetos) || []).filter((v) => /cifra-sin-referencia/.test(String(v)));
    ok(vetos.length === 0, `«${tag}» no cae en la regla`, vetos[0]);
  }
  /* ★ Y LA QUE LA REGLA ARREGLÓ, con su referencia en pantalla */
  const r = await answerViaAgente({ text: "¿le doy más descuento a Falabella?", history: [], mem: {}, scenario: ESC, callAgente: MUDO });
  const t = String((r.r && r.r.text) || "");
  ok(/carga comercial hoy va [^\n]*contra un nivel declarado de/i.test(t),
    "★ y el turno que originó la regla trae la referencia en el texto, no solo en el candado", t.slice(0, 260));
}

/* ═══ 6 · LAS CARNADAS ══════════════════════════════════════════════════════════════════════════════════════ */
H("6 · carnadas — que el candado vea lo que dice ver");
{
  ok(arde("Yo la dejaría: su margen es 4.5%."), "carnada «yo la dejaría con una cifra sola» → ROJO");
  ok(arde("Hay que bajar eso: va 4.5%."), "carnada «hay que, con una cifra sola» → ROJO");
  ok(arde("Prioriza esa cuenta: pesa $4.3M."), "carnada «prioriza con un monto solo» → ROJO");
  /* y el punto decimal NO corta la frase — la trampa que guardC documenta con sus cifras enmascaradas */
  ok(arde("Te conviene renegociar porque su carga va 4.5% y ahí está el problema."),
    "★ carnada «el punto decimal partiendo la oración» → el candado sigue viendo la frase entera");
  /* ⚠️ EL HUECO QUE DESTAPÓ UNA CARNADA MAL ESCRITA: el consejo y su cifra separados por un punto siguen
   * siendo la misma afirmación, y así es como se escribe naturalmente. */
  ok(arde("Te conviene mirarlo. Su carga va 4.5%."),
    "★ carnada «la cifra en la frase siguiente» → ROJO: el punto no separa el consejo de su respaldo");
  ok(!arde("Te conviene mirarlo. Su carga va 4.5% contra el nivel declarado de 3.5%."),
    "…y con la referencia en esa frase siguiente, pasa limpia");
}

console.log(`\n── _referencia_de_cifra_gate: ${pass} PASS · ${fail} FAIL (de ${pass + fail}) ──`);
process.exit(fail === 0 ? 0 : 1);
