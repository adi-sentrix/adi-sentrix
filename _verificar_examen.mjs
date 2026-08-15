/* === _verificar_examen.mjs · UN VERIFICADOR POR EXAMEN, CADA UNO EN SU EJE (owner 2026-08-15) ================
 * «Los verificadores no deben mezclar clientes con marcas, familias, SKU o bodegas. Cada examen debe tener claro
 * su universo: Examen 1 clientes · Examen 2 SKU/inventario · Examen 3 períodos y ausencia de eje.»
 *
 * Reemplaza a `_verificar_examen2.mjs` y `_verificar_examen3.mjs`, que parseaban la carpeta cada uno por su
 * cuenta y me dieron CUATRO rojos falsos. Acá la lectura del dato viene de `_carpeta_por_eje.mjs` — una sola,
 * por bloque — y antes de juzgar nada se corre el AUTOCONTROL: si la carpeta no se lee sana, el verificador lo
 * dice y NO evalúa, en vez de reprobar un examen por su propio parser roto.
 *
 * USO: node _verificar_examen.mjs 1|2|3      (sobre el `_examen_estado.json` vigente)
 * PURO Y OFFLINE: cero red, cero .env, cero costo. */
import fs from "node:fs";
import { carpetaPorEje, carpetaSana } from "./_carpeta_por_eje.mjs";
import { initTenant } from "./src/data/tenantStore.js";
import { TENANT_DEMO } from "./src/data/tenants/demo.js";
initTenant(TENANT_DEMO);

const S = JSON.parse(fs.readFileSync("_examen_estado.json", "utf8"));
const T = S.turnos.map((t) => t.visible);
const C = carpetaPorEje();
const P = (b) => (b ? "✅" : "🔴");
let ok = 0, mal = 0;
const chk = (b, m) => { console.log(`  ${P(b)} ${m}`); b ? ok++ : mal++; };
const dice = (i, ...frag) => frag.every((f) => (T[i] || "").includes(f));
const M1 = (n) => `$${n.toFixed(1)}M`, K = (n) => `$${Math.round(n)}K`;
/* ⚠️ SE COMPARAN NÚMEROS, NO CADENAS (6º bug de mis verificadores, 2026-08-15): ADI escribió «$20.56M» y la
 * prueba exigía «$20.6M» — las dos son la misma cifra y la respuesta era correcta. Un verificador que impone UNA
 * forma de redondeo reprueba por estilo, no por verdad. Se acepta cualquier escritura que redondeada a SU propia
 * precisión dé el valor esperado — el mismo criterio que el muro usa con `_cierraPorRedondeo`. */
function citaMonto(texto, valorM) {
  for (const m of String(texto).matchAll(/\$([\d.,]+)\s*([MK])/gi)) {
    const n = parseFloat(m[1].replace(/,/g, "")) * (m[2].toUpperCase() === "K" ? 0.001 : 1);
    if (!Number.isFinite(n)) continue;
    const dec = (m[1].split(".")[1] || "").length;
    if (Number(valorM.toFixed(dec)) === Number(n.toFixed(dec))) return true;
  }
  return false;
}

const pena = carpetaSana(C);
if (pena.length) { console.log(`🔴 LA CARPETA NO SE LEE SANA — no evalúo:\n   ${pena.join("\n   ")}`); process.exit(1); }
console.log(`── VERIFICADOR · examen ${process.argv[2]} · escenario ${C.escenario} · carpeta ${M1(C.kpis.ventas)}`);
console.log(`   ejes: ${C.clientes.size} clientes · ${C.skuInventario.size} SKU inventario · ${C.bodegas.length} bodegas · ${C.marcas.size} marcas\n`);

if (process.argv[2] === "1") {
  console.log("EXAMEN 1 · EJE: CLIENTES (marcas, familias y SKU NO entran acá)");
  const bajo = [...C.clientes.entries()].filter(([, d]) => d.margen < C.kpis.benchmark).sort((a, b) => b[1].venta - a[1].venta);
  chk(dice(0, `${bajo.length} de`, `${C.clientes.size}`), `«${bajo.length} de ${C.clientes.size}» clientes bajo el benchmark de ${C.kpis.benchmark}%`);
  let filas = 0;
  for (const [n, d] of bajo) {
    const brecha = +(C.kpis.benchmark - d.margen).toFixed(1);
    if (dice(0, n, M1(d.venta), `${d.margen.toFixed(1)}%`) && (T[0].includes(`${brecha}pp`) || T[0].includes(`${brecha} pp`))) filas++;
  }
  chk(filas === bajo.length, `las ${bajo.length} filas con venta, margen y brecha exactas (${filas}/${bajo.length})`);
  const suma = bajo.reduce((a, [, d]) => a + d.venta, 0);
  chk(citaMonto(T[0], suma), `la suma de los ${bajo.length} = ${M1(suma)}`);
  const sobre = [...C.clientes.entries()].filter(([, d]) => d.margen >= C.kpis.benchmark);
  chk(sobre.every(([n]) => dice(0, n)), `declara la cola: nombra los ${sobre.length} que superan el benchmark`);
  /* ⚠️ EL TURNO SE BUSCA POR CONTENIDO, NUNCA POR ÍNDICE (5º bug de mis verificadores, 2026-08-15): esta
   * comprobación estaba clavada en `T[1]` porque una vez corrí solo las preguntas 1 y 5. Al correr el examen
   * completo, la 5 pasó a ser `T[4]` y el verificador reprobó una respuesta correcta. Un verificador que depende
   * del orden en que se corrieron las preguntas no verifica: adivina. */
  const f = C.clientes.get("Falabella");
  const iPremisa = S.turnos.findIndex((t) => /margen 30%/i.test(t.q || ""));
  if (iPremisa >= 0) {
    console.log(`\n  P5 · premisa falsa + proyección (turno ${iPremisa + 1})`);
    const t5 = T[iPremisa];
    chk(/no 30%|es 22\.0%|no es 30|22\.0%, no/i.test(t5), "corrige la premisa falsa del 30%");
    chk(citaMonto(t5, f.venta * 1.06), `venta +6% ≈ ${M1(f.venta * 1.06)} (acepta cualquier redondeo correcto)`);
    chk(/proyecci|supuesto/i.test(t5), "sella la proyección como supuesto");
  }
} else if (process.argv[2] === "2") {
  console.log("EXAMEN 2 · EJE: SKU DE INVENTARIO (clientes y SKU comerciales NO entran acá)");
  const inm = [...C.skuInventario.entries()].filter(([, d]) => d.estado.toLowerCase() !== "activo");
  const fre = [...C.skuInventario.entries()].filter(([, d]) => d.rotacion < C.kpis.pisoRotacion || d.doh > C.kpis.techoDias);
  const capI = inm.reduce((a, [, d]) => a + d.capital, 0), capF = fre.reduce((a, [, d]) => a + d.capital, 0);
  chk(dice(0, `${inm.length}`, K(capI)) && dice(0, `${fre.length}`, K(capF)), `inmovilizado ${inm.length}/${K(capI)} y frenado ${fre.length}/${K(capF)}, separados`);
  const noCriticos = inm.filter(([n]) => !fre.some(([m]) => m === n)).map(([n]) => n);
  /* ⚠️ LA NEGACIÓN NO ES ATRIBUCIÓN (7º bug de mis verificadores, 2026-08-15): «SAM-TV55 y PHI-IRON-PRO son
   * inmovilizados pero NO frenados todavía» es CORRECTO, y esta comprobación lo marcaba en rojo. El muro ya había
   * aprendido esta lección hace horas; mi verificador no. Se reusa el mismo criterio: una mención precedida de
   * negación no atribuye, y la ventana es la CLÁUSULA. */
  const atribuyeFrenado = (t, n) => {
    for (const c of String(t || "").split(/[.!?\n;]+/)) {
      if (!new RegExp(`\\b${n}\\b`, "i").test(c)) continue;
      for (const m of c.matchAll(/frenad[oa]s?/gi)) {
        const antes = c.slice(Math.max(0, m.index - 22), m.index);
        if (!/\b(?:no|sin|tampoco|nunca|a[uú]n\s+no|todav[ií]a\s+no)\s+(?:est[aá]\w*\s+|es\s+|son\s+)?$|\bni\s+$/i.test(antes)) return true;
      }
    }
    return false;
  };
  const malDicho = noCriticos.filter((n) => T.some((t) => atribuyeFrenado(t, n)));
  chk(malDicho.length === 0, `ningún SKU inmovilizado-no-crítico llamado «frenado»${malDicho.length ? " — " + malDicho.join(", ") : ""}`);
  const q4 = T[3] || "";
  const orden = [...C.skuInventario.entries()].sort((a, b) => a[1].rotacion - b[1].rotacion);
  const mostrados = orden.filter(([n]) => q4.includes(n));
  chk(mostrados.length === orden.length || /\d+ de \d+|top \d+/i.test(q4), `el ranking muestra ${mostrados.length} de ${orden.length} y declara su alcance`);
  let filas = 0;
  for (const [n, d] of orden) if (q4.includes(n) && q4.includes(`${d.rotacion.toFixed(1)}x`) && q4.includes(`${d.margenInv.toFixed(1)}%`)) filas++;
  chk(filas === mostrados.length, `cada fila del ranking coincide con el dato (${filas}/${mostrados.length})`);
  chk(!/margen de inventario[^.\n;]{0,80}benchmark|benchmark[^.\n;]{0,80}margen de inventario/i.test(T.join("\n")), "no compara margen de inventario contra el benchmark comercial");
  const q5 = T[4] || "";
  chk(/no (?:se )?puede|no puedo|sin inventar|no tengo|faltan/i.test(q5), "Q5 declara que no puede estimar el impacto comercial");
  chk(!/venta perdida (?:sería|es|de \$)/i.test(q5), "…sin poner una cifra de venta perdida");
} else if (process.argv[2] === "3") {
  console.log("EXAMEN 3 · EJE: PERÍODOS y AUSENCIA DE EJE (el «punto de venta» no existe en este dato)");
  chk(/no tengo|no hay|no está/i.test(T[0] || "") && !/Q1[^.\n]{0,30}\$[\d.]+M/i.test(T[0] || ""), "Q1: declara que no hay apertura trimestral y no inventa cifras de Q1/Q2");
  chk(dice(1, M1(C.kpis.ventas), M1(C.kpis.ventasAnterior), `${C.kpis.vsAnterior}%`), `Q2: ${M1(C.kpis.ventas)} vs ${M1(C.kpis.ventasAnterior)} (+${C.kpis.vsAnterior}%)`);
  chk(/no puedo comparar|no está en la carpeta|no tengo/i.test(T[1] || ""), "Q2: declara que el margen del año anterior NO existe");
  const proy = +(C.kpis.ventas * 1.04).toFixed(1);
  chk(citaMonto(T[2] || "", proy), `Q3: proyección ${M1(proy)} = ${M1(C.kpis.ventas)} + 4%`);
  chk(/simulaci|supuesto|no un hecho/i.test(T[2] || ""), "Q3: sellada como proyección");
  chk(/no tengo|no existe|no puedo inventar/i.test(T[3] || ""), "Q4: declara que «punto de venta» no existe como eje");
  chk(/client/i.test(T[3] || "") && /bodega/i.test(T[3] || ""), `Q4: nombra los ejes que SÍ existen (${C.clientes.size} clientes · ${C.bodegas.length} bodegas)`);
  const q5 = T[4] || "";
  chk(/Falabella/.test(q5) && /Lider/.test(q5), "Q5: normaliza los typos «falabela» y «lider»");
  chk(/ambigu|2pp|puntos porcentuales/i.test(q5), "Q5: declara la ambigüedad del «2%» antes de calcular");
  const fa = C.clientes.get("Falabella"), li = C.clientes.get("Lider");
  chk(dice(5 - 1, `${fa.carga}%`, `${li.carga}%`), `Q5: cargas correctas (Falabella ${fa.carga}% · Lider ${li.carga}%)`);
} else { console.log("uso: node _verificar_examen.mjs 1|2|3"); process.exit(1); }

console.log(`\n── ${ok} ✅ · ${mal} 🔴 ──`);
process.exit(mal ? 1 : 0);
