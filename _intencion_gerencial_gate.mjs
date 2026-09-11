/* === _intencion_gerencial_gate.mjs · LA INTENCIÓN NO SE LEE EN EL DATO =====================================
 *
 * LA LEY, palabra del owner (2026-09-10, revisando su prueba de continuidad): «el dato puede no respaldar esa
 * hipótesis, pero no debería inferir intención gerencial».
 *
 * LO QUE VIO EN SU PANTALLA: «Volumen a margen bajo como apuesta deliberada — descartado por el dato».
 *
 * EL DEFECTO, dicho con precisión, porque el filo importa: el dato SÍ puede descartar un PATRÓN —que la carga
 * esté dentro del nivel de referencia, que el margen bajo venga del precio y no del rebate—. Lo que no puede
 * es dictaminar si alguien lo hizo A PROPÓSITO. «Deliberada» describe una cabeza, no una fila. Presentarlo
 * como algo que el dato confirma o descarta le entrega al dueño una conclusión sobre su propia gente con cara
 * de medición.
 *
 * ⚠️ Y LA MITAD QUE NO SE VETA ES TAN IMPORTANTE COMO LA QUE SÍ. Preguntarle al dueño por su intención es el
 * método del porqué de esta casa (medir · marcar la hipótesis · preguntar). Razonar en condicional, declarar
 * el límite y CONTRASTAR las dos posibilidades («separar qué parte fue deliberada y qué parte se descontroló»)
 * son prosa correcta que el producto ya escribe. Una regla que muerde prosa buena se termina apagando: por eso
 * el corpus de abajo trae las frases REALES del composer de margen entre las que deben salir limpias.
 *
 * DÓNDE VIVE: en `vetosDeRegistro` (contratoAgente), el juez COMPARTIDO — una regla, un archivo. La ley ya
 * existía dentro de un playbook (`margen-en-riesgo`, su lista notarial), y por eso el owner la vio fallar: el
 * turno que escribió la frase no era de ese playbook. Acá vale para los dos caminos y para todas las rutas.
 *
 * OFFLINE · determinístico · CERO llamadas al modelo.
 * `node --import ./scripts/offline-guard.mjs _intencion_gerencial_gate.mjs` */
import { readFileSync } from "node:fs";
import { vetosDeRegistro, vetosDeContrato } from "./src/adi/agente/contratoAgente.js";

let pass = 0, fail = 0;
const ok = (cond, label, detalle) => {
  if (cond) { pass++; console.log(`  ✓ ${label}`); }
  else { fail++; console.log(`  ✗ ${label}`); if (detalle !== undefined) console.log(`      ${String(detalle).slice(0, 300)}`); }
};
const H = (t) => console.log(`\n${t}`);
const arde = (t) => vetosDeRegistro(t, {}).some((v) => v.regla === "intencion-inferida");

/* ═══ 1 · ★★ LA FRASE DE SU PANTALLA ════════════════════════════════════════════════════════════════════════ */
H("1 · ★★ la frase exacta que el owner marcó");
ok(arde("3. Volumen a margen bajo como apuesta deliberada — descartado por el dato."),
  "★★ «apuesta deliberada — descartado por el dato» ARDE: el dato descarta patrones, no intenciones");
ok(arde("Volumen a margen bajo como apuesta deliberada — descartada por el dato. No es el caso: Lider excede la carga."),
  "★★ …y también con la frase entera del turno, tal como salió");

/* ═══ 2 · EL DICTAMEN, EN SUS FORMAS ════════════════════════════════════════════════════════════════════════ */
H("2 · dictaminar una intención — afirmarla, confirmarla o descartarla — arde siempre");
const DEBE_ARDER = [
  "Es una decisión deliberada de la gerencia comercial.",
  "El dato descarta que sea intencional.",
  "Queda claro que fue a propósito.",
  "Hubo una apuesta deliberada por volumen.",
  "Fue premeditado: la carga se dio para sostener el volumen.",
  "El patrón confirma que la política fue consciente.",
  "Es evidente que fue adrede.",
  "Son decisiones deliberadas, no descuidos.",
  /* la intención NEGADA (batería en vivo de la Etapa 4, corrida 3 — «¿Cómo va?»): negar que fue estrategia es leer la misma cabeza */
  "Las acciones comerciales se están comiendo la contribución — no es que vendan barato por estrategia de volumen.",
  "No es una apuesta tuya de volumen: la carga simplemente se descontroló.",
  "No fue una decisión comercial, fue descuido.",
];
for (const t of DEBE_ARDER) ok(arde(t), `arde · «${t.slice(0, 62)}»`);

/* ═══ 3 · ★ LO QUE NO SE VETA · preguntar · condicionar · declarar el límite · contrastar ══════════════════ */
H("3 · ★ la prosa correcta sale limpia — la mitad que hace útil a la regla");
const NO_DEBE_ARDER = [
  ["preguntar (el método del porqué)", "¿el volumen de esos tres a este margen es una apuesta tuya de rotación y liquidez, o se les fue de las manos en la negociación?"],
  ["preguntar, corto", "¿Fue adrede o se dio solo?"],
  ["condicionar", "Si fuera estrategia de rotación, esperaría carga dentro del nivel de referencia con margen bajo por precio o mix."],
  ["declarar el límite", "El dato no dice si fue deliberado: mide cuánto se cede, no qué se negoció a cambio."],
  ["declarar el límite (2)", "No puedo saber si fue una decisión deliberada; eso lo sabes tú."],
  ["marcar la hipótesis", "Puede ser una decisión tuya: volumen a cambio de rotación y liquidez."],
  ["describir el patrón", "Volumen a margen bajo: la carga excede el nivel en los cuatro, así que el patrón no es de rotación."],
  ["el dato no respalda el PATRÓN", "3. Volumen a margen bajo — el dato no lo respalda: Lider excede la carga, igual que las otras dos grandes."],
  ["contraste · composer de margen", "Lo nuevo —criterio mío, no una cifra del dato— es que la decisión ya no es tocarle el precio a todos: es separar en esas cuentas qué parte de la carga comercial fue deliberada y qué parte se descontroló."],
  ["contraste · composer (2)", "Lo nuevo es el foco: no un ajuste parejo de precio, sino distinguir en esas cuentas la carga deliberada de la que se escapó."],
  ["contraste · composer (3)", "La acción: separar en Lider la carga comercial deliberada de la que no lo fue — su carga excedida es $125K, y decidir esa parte cuenta por cuenta."],
  ["citar lo que el dueño DIJO", "Sobre Falabella y Jumbo tu palabra ya está anotada (2026-09-10): «el volumen de Lider es apuesta mía». La leo como decisión tuya — dime si cambió."],
  ["«consciente» sobre ADI misma", "Es una lectura consciente de que faltan datos."],
  ["la condición del composer (estrategia o fuga)", "De tu respuesta depende si eso es estrategia o fuga: el dato mide la carga comercial, no la intención."],
  ["negar el PATRÓN, no la intención", "No es un problema de precio: la carga excede el nivel en los cuatro."],
  ["preguntar en negativo", "¿No fue una decisión tuya de volumen? Dímelo y lo anoto."],
];
for (const [q, t] of NO_DEBE_ARDER) ok(!arde(t), `limpia · ${q}`, t.slice(0, 120));

/* ═══ 4 · LA CARNADA · si la regla se vacía, esto tiene que ponerse rojo ════════════════════════════════════ */
H("4 · la carnada: con la regla apagada, el defecto pasaría");
{
  const src = readFileSync(new URL("./src/adi/agente/contratoAgente.js", import.meta.url), "utf8");
  ok(/const _INTENCION = /.test(src) && /intencion-inferida/.test(src),
    "la regla está escrita en el juez compartido, no en un playbook suelto");
  /* la carnada de verdad: se muta el fuente en memoria y se comprueba que el chequeo de §1 daría ✗.
   * ⚠️ `/(?!)/` y no `/$^/`: con bandera `m`, `$^` matchea en cada salto de línea — la trampa de la casa. */
  const mutado = src.replace(/const _RE_DICTAMEN = new RegExp\([^;]+;/, "const _RE_DICTAMEN = /(?!)/;");
  ok(mutado !== src, "…y la carnada de verdad muta el fuente (si no, este bloque no probaría nada)");
  const url = "data:text/javascript;base64," + Buffer.from(mutado.replace(/from "\.\.\/\.\.\//g, `from "${new URL("./src/", import.meta.url).href}`).replace(/from "\.\//g, `from "${new URL("./src/adi/agente/", import.meta.url).href}`), "utf8").toString("base64");
  let ardeMutado = null;
  try {
    const m = await import(url);
    ardeMutado = m.vetosDeRegistro("3. Volumen a margen bajo como apuesta deliberada — descartado por el dato.", {}).some((v) => v.regla === "intencion-inferida");
  } catch (e) { ardeMutado = `no se pudo cargar el mutado: ${String(e.message).slice(0, 90)}`; }
  ok(ardeMutado === false, "★ con el dictamen vaciado, la frase del owner PASARÍA — el chequeo de §1 daría ✗, que es lo que un candado debe hacer", ardeMutado);
}

/* ═══ 5 · CABLEADO · la ley viaja por los dos caminos ═══════════════════════════════════════════════════════ */
H("5 · una regla, un archivo — y llega a los dos caminos");
{
  const FRASE = "Es una decisión deliberada de la gerencia comercial.";
  ok(vetosDeContrato(FRASE, {}).some((v) => v.regla === "intencion-inferida"),
    "★ el contrato del agente la hereda (delega en el juez compartido, no tiene copia)");
  const oraculo = readFileSync(new URL("./src/adi/oracle/answerViaOracle.js", import.meta.url), "utf8");
  ok(/vetosDeRegistro/.test(oraculo),
    "★ y el oráculo aplica el MISMO juez: la red de respaldo no puede tener otra ley (owner 2026-09-10)");
}

console.log(`\n══ ${pass} PASS · ${fail} FAIL ══`);
process.exit(fail ? 1 : 0);
