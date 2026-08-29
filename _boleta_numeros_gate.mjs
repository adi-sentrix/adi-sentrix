/* === _boleta_numeros_gate.mjs · EL SEPARADOR DECIMAL, EN LAS DOS CONVENCIONES ================================
 * Origen: auditando un rechazo de la certificación pagada apareció que el parser de la boleta borraba TODA coma
 * por considerarla separador de miles. Con eso, el castellano quedaba mal leído por diez o por mil —«8,3%» valía
 * 83% y «$1,6M» valía $16M— y el mismo reemplazo global tampoco leía «$20.000.000», que `parseFloat` daba como 20.
 *
 * POR QUÉ IMPORTA, y las dos direcciones son distintas:
 *   · leer de MENOS → el guard rechaza una cifra CORRECTA (falso positivo, reintento pagado);
 *   · leer de MÁS  → una cifra equivocada puede COINCIDIR con alguna autorizada y pasar. Ese es el peor caso: un
 *     número mal leído presentado como verdad, que es exactamente lo que todo este muro existe para impedir.
 *
 * CERO RED, CERO LLM: funciones puras de src/adi/boleta.js.
 */
import { parseNumeroLocalizado, parseFigures, guardAgainstBoleta, fig } from "./src/adi/boleta.js";
/* EL NEGOCIO SE DECLARA ACÁ (moneda · owner 2026-08-27). Este gate no cargaba ninguno porque no le hacía
 * falta: la boleta formateaba con un «$» escrito a mano. Ahora el símbolo sale de la moneda que el negocio
 * declara, así que sin negocio cargado la boleta escribe sin símbolo y deja de coincidir con el texto de
 * prueba. Es la misma migración que forzó la vía 1 cuando el store dejó de traer un dataset por defecto:
 * lo que antes se heredaba en silencio, ahora se declara. */
import { initTenant as _initTenantGate } from "./src/data/tenantStore.js";
import { TENANT_DEMO as _TENANT_DEMO_GATE } from "./src/data/tenants/demo.js";
_initTenantGate(_TENANT_DEMO_GATE);

let pass = 0, fail = 0;
const ok = (n, c, d) => { if (c) { pass++; console.log(`  OK  ${n}`); } else { fail++; console.log(`FAIL  ${n}${d ? " — " + d : ""}`); } };
const section = (t) => console.log(`\n== ${t} ==`);
const eq = (a, b) => Number.isFinite(a) && Math.abs(a - b) < 1e-9;

section("1 · LOS DOS CASOS QUE ORIGINARON ESTO");
ok("«8,3%» vale 8.3%, nunca 83%", parseFigures("8,3%")[0].canon === "pct:8.3%", JSON.stringify(parseFigures("8,3%")));
ok("«$1,6M» vale $1.6M, nunca $16M", parseFigures("$1,6M")[0].canon === "money:$1.6M", JSON.stringify(parseFigures("$1,6M")));
ok("…y canonizan IGUAL que su gemela en inglés (el guard no distingue convención)",
  parseFigures("8,3%")[0].canon === parseFigures("8.3%")[0].canon
  && parseFigures("$1,6M")[0].canon === parseFigures("$1.6M")[0].canon);

section("2 · LA REGLA, caso por caso");
const CASOS = [
  // — un solo separador —
  ["8,3", 8.3, "coma + 1 dígito ⇒ decimal"],
  ["8.3", 8.3, "punto ⇒ decimal (convención de ADI)"],
  ["0,5", 0.5, "coma decimal bajo la unidad"],
  ["12,75", 12.75, "coma + 2 dígitos ⇒ decimal"],
  ["1,600", 1600, "coma + EXACTAMENTE 3 dígitos ⇒ miles (el caso ambiguo, resuelto a la convención del producto)"],
  ["1.600", 1.6, "punto ⇒ decimal SIEMPRE, aunque sigan 3 dígitos"],
  ["874", 874, "sin separadores"],
  ["19.4", 19.4, "el formato con que ADI escribe sus propias cifras"],
  // — el mismo separador repetido ⇒ miles —
  ["20.000.000", 20000000, "puntos repetidos ⇒ miles (antes: 20)"],
  ["20,000,000", 20000000, "comas repetidas ⇒ miles"],
  ["1.234.567", 1234567, "puntos repetidos"],
  // — los dos separadores: manda el ÚLTIMO —
  ["1.234,56", 1234.56, "formato español completo"],
  ["1,234.56", 1234.56, "formato inglés completo"],
  ["1.234.567,89", 1234567.89, "español con millones"],
  ["1,234,567.89", 1234567.89, "inglés con millones"],
  ["12.345,6", 12345.6, "español, 1 decimal"],
  ["12,345.6", 12345.6, "inglés, 1 decimal"],
];
for (const [t, esperado, porQue] of CASOS) ok(`«${t}» → ${esperado} · ${porQue}`, eq(parseNumeroLocalizado(t), esperado), String(parseNumeroLocalizado(t)));

section("3 · ADVERSARIAL · lo que NO puede romperse");
ok("un texto sin número no inventa uno", !Number.isFinite(parseNumeroLocalizado("")) && !Number.isFinite(parseNumeroLocalizado("hola")));
ok("null/undefined no revientan", !Number.isFinite(parseNumeroLocalizado(null)) && !Number.isFinite(parseNumeroLocalizado(undefined)));
ok("un separador suelto no produce un número", !Number.isFinite(parseNumeroLocalizado(",")) && !Number.isFinite(parseNumeroLocalizado(".")));
ok("el signo negativo sobrevive a la regla", parseFigures("-$1,6M")[0].canon === parseFigures("-$1.6M")[0].canon, JSON.stringify(parseFigures("-$1,6M")));
// LA DIRECCIÓN PELIGROSA: una lectura errónea que coincida con una cifra autorizada pasaría el muro.
{
  const boleta = [fig("Falabella · Venta", "$16.0M", { unit: "money", raw: 16000000 })];
  const g = guardAgainstBoleta("La venta es $1,6M.", boleta);
  ok("«$1,6M» YA NO se cuela como $16.0M autorizado (la lectura de más era el peor caso)",
    !g.ok && g.unauthorized.includes("$1,6M"), JSON.stringify(g));
}
{
  const boleta = [fig("Falabella · Margen", "83%", { unit: "pct", raw: 83 })];
  const g = guardAgainstBoleta("El margen es 8,3%.", boleta);
  ok("«8,3%» tampoco se cuela como 83% autorizado", !g.ok && g.unauthorized.includes("8,3%"), JSON.stringify(g));
}
// LA OTRA DIRECCIÓN: la cifra correcta escrita en castellano ya no se rechaza.
{
  const boleta = [fig("Falabella · Venta", "$1.6M", { unit: "money", raw: 1600000 })];
  ok("una cifra CORRECTA escrita con coma decimal ya no se rechaza", guardAgainstBoleta("Vende $1,6M.", boleta).ok);
}
{
  const boleta = [fig("Falabella · % del total", "8.3%", { unit: "pct", raw: 8.3 })];
  ok("…y lo mismo con un porcentaje", guardAgainstBoleta("Representa 8,3% del total.", boleta).ok);
}

section("4 · SIN REGRESIÓN · las unidades que ya funcionaban");
const IGUALES = [
  ["$19.4M", "money:$19.4M"], ["$874K", "money:$874K"], ["22.0%", "pct:22%"], ["-2%", "pct:-2%"],
  ["1.3x", "ratio:1.3x"], ["165d", "days:165d"], ["8.1pp", "pp:8.1pp"], ["$33K", "money:$33K"],
];
for (const [t, canon] of IGUALES) ok(`«${t}» sigue canonizando a ${canon}`, (parseFigures(t)[0] || {}).canon === canon, JSON.stringify(parseFigures(t)));
ok("una frase completa extrae todas sus cifras, como siempre",
  parseFigures("Falabella vende $19.4M con 22.0% de margen, 8.1pp bajo tu benchmark de 30.1%.").length === 4);
// el separador de miles inglés dentro de una frase real (la forma en que un LLM expande una cifra abreviada)
ok("«$19,433,000» se lee como $19.4M (miles en inglés, sin decimales)",
  parseFigures("$19,433,000")[0].canon === "money:$19.4M", JSON.stringify(parseFigures("$19,433,000")));
ok("«$19.433.000» se lee igual (miles en español)",
  parseFigures("$19.433.000")[0].canon === "money:$19.4M", JSON.stringify(parseFigures("$19.433.000")));

console.log(`\n${pass} OK · ${fail} FAIL`);
process.exit(fail ? 1 : 0);
