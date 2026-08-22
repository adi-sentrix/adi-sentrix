/* === _prompts_sin_voseo_gate.mjs · NO LE ENSEÑAMOS A ADI A HABLAR EN VOSEO (owner 2026-08-21) =================
 * EL HALLAZGO. `_registro_gate` y el lavador de `voiceGuard` cuidan la SALIDA: si el modelo escribe «resolvé», se
 * corrige antes de la pantalla. Pero los textos que le ENSEÑAN a hablar estaban escritos en voseo — la persona, la
 * doctrina, el contrato conversacional, el narrador legado y, la peor, las MULTAS del notario, que se le mandan
 * justo antes de pedirle que reescriba la respuesta entera. La red corría detrás de una fuente que nunca se apagó.
 * Se apagó (322 formas en tres pasadas); este gate la mantiene apagada.
 *
 * ⚠️ POR QUÉ NO ALCANZA EL INVENTARIO DE `voiceGuard`. La primera versión de este gate usaba `detectVoseo` (246
 * formas declaradas) y daba VERDE con 80 formas de voseo todavía adentro: el inventario no conoce la cola larga
 * («JERARQUIZÁ», «tabulá», «Encabezá»…). Por eso acá el criterio es por TERMINACIÓN —toda palabra que acaba en
 * vocal acentuada— con dos listas declaradas de excepciones. Es un detector más ancho que la lista, no otra lista.
 *
 * ⚠️ Y NO TODO LO QUE ESTÁ EN UN PROMPT ES UNA INSTRUCCIÓN. Varios textos son EJEMPLOS DE LO QUE ESCRIBE EL
 * USUARIO — «"dale, seguí"», «"te pedí ventas, no margen"», «"no entendí"» — y el usuario escribe en voseo. Ese
 * vocabulario de ENTRADA es contrato suyo (CLAUDE.md §3): corregirlo dejaría a ADI sin reconocer la frase más
 * común con la que un cliente pide seguir. Van en la lista B, declaradas y con motivo.
 *
 * SOLO DENTRO DE CADENAS: un comentario en voseo no llega al modelo, y varios son citas TEXTUALES del owner —
 * corregirle la gramática a una cita es falsificar el registro. Y un patrón detector como
 * `(?:hay |tenés )?espacio para optimizar` TIENE que seguir en voseo: recorta esa muletilla de lo que escribe el
 * modelo. Como vive en un literal de expresión regular y no en una cadena, queda fuera solo.
 *
 * SE PRUEBA A SÍ MISMO. Un contador que devuelve cero porque está roto se ve idéntico a uno que devuelve cero
 * porque está limpio — hoy pasó dos veces en este repo. OFFLINE · lee texto · no puede gastar. */
import fs from "node:fs";
import path from "path";
import { fileURLToPath } from "url";

const root = path.dirname(fileURLToPath(import.meta.url));
let pass = 0, fail = 0;
const ok = (cond, label, detalle) => {
  if (cond) { pass++; console.log(`  ✓ ${label}`); }
  else { fail++; console.log(`  ✗ FALLO: ${label}${detalle !== undefined ? ` — ${detalle}` : ""}`); }
};

const PROMPTS = [
  "src/adi/oracle/persona.js",                 // el carácter de ADI · va en TODO system del camino natural
  "src/adi/oracle/naturalPrompt.js",           // la doctrina y el contrato de cálculo
  "src/adi/oracle/guardC.js",                  // las MULTAS: lo que el modelo lee antes de reescribir
  "src/adi/oracle/narratePromptC.js",          // narrador del camino legado
  "src/adi/oracle/conversationalContract.js",  // los 7 modos
];

/* LISTA A · español legítimo que termina en vocal acentuada y NO es voseo. */
const LEGITIMAS = new Set(["está", "estás", "esté", "estés", "después", "además", "jamás", "revés", "inglés",
  "aquí", "allí", "ahí", "así", "demás", "quizás", "también", "según", "él", "más", "sé", "té", "dé"]);
/* LISTA B · voseo DELIBERADO: son ejemplos de lo que escribe el USUARIO, no órdenes a ADI. */
const VOCABULARIO_DEL_USUARIO = new Map([
  ["seguí", "«dale, seguí» — la forma más común con la que un cliente pide continuar"],
  ["pedí", "«te pedí ventas, no margen» — ejemplo de corrección del usuario"],
  ["entendí", "«no entendí» — ejemplo de confusión del usuario"],
]);

function rangosDeCadena(s) {
  const rangos = [];
  let i = 0, estado = "codigo", ini = 0, cierre = "";
  while (i < s.length) {
    const c = s[i], d = s[i + 1];
    if (estado === "codigo") {
      if (c === "/" && d === "/") { estado = "linea"; i += 2; continue; }
      if (c === "/" && d === "*") { estado = "bloque"; i += 2; continue; }
      if (c === '"' || c === "'" || c === "`") { estado = "cadena"; cierre = c; ini = i + 1; i++; continue; }
      i++; continue;
    }
    if (estado === "linea") { if (c === "\n") estado = "codigo"; i++; continue; }
    if (estado === "bloque") { if (c === "*" && d === "/") { estado = "codigo"; i += 2; continue; } i++; continue; }
    if (c === "\\") { i += 2; continue; }
    if (c === cierre) { rangos.push([ini, i]); estado = "codigo"; i++; continue; }
    if (c === "\n" && cierre !== "`") { estado = "codigo"; i++; continue; }
    i++;
  }
  return rangos;
}

/* sospechosas(texto) → palabras que terminan en á/é/í (+s). Las que terminan en «ó» quedan fuera: son pretérito
 * de TERCERA persona («declaró», «pidió»), jamás voseo. */
function sospechosas(txt) {
  const out = [];
  for (const w of txt.split(/[^A-Za-zÀ-ÿ]+/)) {
    if (w.length < 4 || !/[áéíÁÉÍ]s?$/.test(w)) continue;
    const bajo = w.toLowerCase();
    if (LEGITIMAS.has(bajo) || VOCABULARIO_DEL_USUARIO.has(bajo)) continue;
    out.push(w);
  }
  return out;
}

console.log("=".repeat(100));
console.log("1 · EL DETECTOR FUNCIONA · un cero de un contador roto se ve igual que un cero de verdad");
console.log("=".repeat(100));
ok(sospechosas("Antes de tocar precios, resolvé qué hacer.").join() === "resolvé",
  "caza «resolvé», la forma exacta que llegó a pantalla y disparó este pase");
ok(sospechosas("Ahora JERARQUIZÁ y tabulá el resultado.").length === 2,
  "…y también la cola larga que el inventario de 246 formas NO conoce (JERARQUIZÁ · tabulá)");
ok(sospechosas("Antes de tocar precios, resuelve qué hacer.").length === 0,
  "…y NO marca la misma frase en tuteo: distingue, no prohíbe");
ok(sospechosas("Esto está listo después de todo; jamás al revés, y el cliente pidió más.").length === 0,
  "…ni el español legítimo que termina en vocal acentuada (está · después · jamás · revés · pidió)");

console.log("\n" + "=".repeat(100));
console.log("2 · CERO VOSEO EN LO QUE LE ENSEÑAMOS A ADI");
console.log("=".repeat(100));
let cadenas = 0;
const sucias = [];
for (const rel of PROMPTS) {
  const s = fs.readFileSync(path.join(root, rel), "utf8");
  let enArchivo = 0;
  for (const [a, b] of rangosDeCadena(s)) {
    const txt = s.slice(a, b);
    if (!txt.trim()) continue;
    cadenas++;
    for (const w of sospechosas(txt)) { enArchivo++; sucias.push(`${rel}: «${w}»`); }
  }
  ok(enArchivo === 0, `${rel} — sin voseo`, `${enArchivo} forma(s)`);
}
ok(sucias.length === 0, `cero formas voseantes en las ${cadenas} cadenas de los 5 archivos que guían al modelo`,
  [...new Set(sucias)].slice(0, 6).join(" | "));

console.log("\n" + "=".repeat(100));
console.log("3 · LAS EXCEPCIONES SIGUEN SIENDO CIERTAS · una lista que no se mantiene deja de decir la verdad");
console.log("=".repeat(100));
const todo = PROMPTS.map((r) => fs.readFileSync(path.join(root, r), "utf8")).join("\n");
for (const [forma, motivo] of VOCABULARIO_DEL_USUARIO) {
  ok(todo.includes(forma), `«${forma}» sigue en los prompts — ${motivo}`,
    "ya no aparece: si el ejemplo se borró, sacá la excepción de la lista");
}

console.log("\n" + "=".repeat(100));
console.log("4 · Y LA SALIDA SIGUE PROTEGIDA · apagar la fuente no reemplaza al lavador");
console.log("=".repeat(100));
/* El modelo puede producir voseo igual: lo trae de su entrenamiento, y el usuario también lo escribe. Este gate
 * NO autoriza a desarmar el lavador — lo que logra es que el lavador deje de correr contra nuestra propia doctrina. */
const vg = fs.readFileSync(path.join(root, "src", "adi", "llm", "voiceGuard.js"), "utf8");
ok(/export function stripLanguageLeaks/.test(vg), "el lavador de la SALIDA sigue en pie: apagar la fuente no lo reemplaza");
ok(fs.existsSync(path.join(root, "_registro_gate.mjs")), "…y el gate de registro que lo ejercita también");

console.log(`\n── _prompts_sin_voseo_gate: ${pass} PASS · ${fail} FAIL (de ${pass + fail}) ──`);
process.exit(fail === 0 ? 0 : 1);
