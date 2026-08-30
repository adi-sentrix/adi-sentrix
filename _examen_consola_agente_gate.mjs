/* === _examen_consola_agente_gate.mjs · LA CONSOLA DEL EXAMEN, AUDITABLE (R7b·[10]·R-eco del examen 1) ========
 *
 * Lo MEDIDO en la corrida 1: el sello imprimió «camino natural REAL» en un examen del AGENTE (mentía de ruta) ·
 * los 28 veredictos dijeron «vetos: ninguno» con 14 turnos reintentando por guard (post-mortem a ciegas) · la
 * escalada al tier caro fue 66% del gasto con CERO verdes, siempre con boleta vacía · un «verde» sin una sola
 * herramienta ni cifra contó igual que uno con boleta.
 *
 * TEXTUAL a propósito: la consola lee `.env` al importarse (GASTA si corre) — este gate la lee como TEXTO y
 * verifica que la instrumentación esté cableada. La conducta del bucle la prueban _agente_bucle_gate y
 * _agente_contrato_gate con guiones; esto cubre el INSTRUMENTO.
 *
 * OFFLINE · determinístico · no puede gastar.
 * `node --import ./scripts/offline-guard.mjs _examen_consola_agente_gate.mjs` */
import fs from "node:fs";

let pass = 0, fail = 0;
const ok = (cond, label, detalle) => {
  if (cond) { pass++; console.log(`  ✓ ${label}`); }
  else { fail++; console.log(`  ✗ ${label}`); if (detalle !== undefined) console.log(`      ${detalle}`); }
};

const C = fs.readFileSync("_consola_examen.mjs", "utf8").replace(/\r\n/g, "\n");
const CH = fs.readFileSync("src/ui/ChatADI.jsx", "utf8").replace(/\r\n/g, "\n");
const P = fs.readFileSync("_EXAMEN_AGENTE_PROTOCOLO.md", "utf8").replace(/\r\n/g, "\n");

console.log("\n1 · R7b: el sello del agente PRUEBA su ruta, no la declara");
ok(C.includes("camino AGENTE REAL (answerViaAgente + handleAgente con tier por paso) — probada, no declarada"),
  "la ruta del agente se imprime como probada");
ok(C.includes("answerViaAgente importado") && C.includes("las 3 herramientas del agente en el catálogo"),
  "…y las pruebas mecánicas existen (bucle importado · catálogo con las 3 propias)");
ok(C.includes('vetosDeContrato("La carga subió. Procede con la renegociación de Falabella.")'),
  "…y el juez del contrato se prueba EN VIVO en el sello");
ok(C.includes("la ruta del agente se prueba con --agente"),
  "el sello del natural ya no habla por el agente");

console.log("\n2 · R-eco + P3: el tier caro SOLO con boleta no vacía Y con el hilo bajo el techo");
ok(C.includes('const paso = (attempt > 0 || cierre) && (figsEnBoleta | 0) > 0 && _charsHilo <= TECHO_ENTRADA_CIERRE_CHARS ? "cierre" : "herramientas";'),
  "la consola condiciona la escalada a figsEnBoleta > 0 y al techo del hilo");
ok(CH.includes('const paso = (cierre || attempt > 0) && (figsEnBoleta | 0) > 0 && _charsHilo <= TECHO_ENTRADA_CIERRE_CHARS ? "cierre" : "herramientas";'),
  "el adapter de producción (_fetchAgente) aplica el MISMO criterio");
/* P3 de la corrida 2: el techo es UNA sola verdad — si consola y producción lo escribieran cada una, el día que
 * se ajuste uno el otro seguiría pagando. Los dos lo IMPORTAN del bucle. */
ok(C.includes("TECHO_ENTRADA_CIERRE_CHARS } from \"./src/adi/agente/bucleAgente.js\"") &&
   CH.includes('const { TECHO_ENTRADA_CIERRE_CHARS } = await import("../adi/agente/bucleAgente.js");'),
  "…y los dos IMPORTAN el techo del bucle: una sola verdad, no dos copias");

console.log("\n3 · R7·[10]: el veredicto cuenta lo que pasó");
ok(C.includes('intentos.filter((i) => i.motivoReintento === "guard").length'),
  "los reintentos por guard se cuentan (el «vetos: ninguno» con 14 reintentos no vuelve)");
ok(C.includes("VERDE SIN LECTURA"),
  "el verde sin herramientas/figs/re-citas queda MARCADO — no infla el criterio A");
ok(C.includes("reintentosGuard:"),
  "…y los contadores viajan al estado del examen (post-mortem gratis)");

console.log("\n4 · el protocolo de la segunda corrida existe con su gasto nombrado");
ok(P.includes("SEGUNDA CORRIDA") && P.includes("FRENO INTACTO: esta corrida NO corre sin la palabra del owner que NOMBRE el gasto."),
  "el pedido de autorización actualizado está — y el freno del gasto, intacto");
ok(P.includes("los 20 turnos REALES de los consolidados"),
  "el conteo de A quedó en los 20 turnos que existen (el 24 era estimación)");

console.log(`\n── _examen_consola_agente_gate: ${pass} PASS · ${fail} FAIL (de ${pass + fail}) ──`);
process.exit(fail ? 1 : 0);
