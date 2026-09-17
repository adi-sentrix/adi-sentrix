/* === _anclas_gate.mjs · LA PROSA ANCLADA (verdad finita · etapa E2 · owner 2026-09-17, offline) ═══════════════════════════════════════
 * «Una tabla, una lista, un párrafo o una forma nueva de decir algo no deberían crear una nueva forma de mentir.» Este gate mide anclas.js sobre
 * el libro de hechos de la pregunta integrada (tres dominios), con la boleta real del demo y cero prosa interpretada:
 *   · los ATAQUES de los escépticos del plan (§2.4) escritos con anclas —la misma mentira dicha con anclas— tienen que quedar vetados por una de
 *     las comprobaciones cerradas, y ninguna falsedad puede llegar al texto servido;
 *   · los HECHOS VERDADEROS escritos con formas distintas (tabla, tabla transpuesta, lista anidada, encabezado, «respectivamente», ordinal,
 *     «juntos», cifra en palabras, duración, variación, lectura, negación del catálogo, base posesiva, universo escrito por la casa) se sirven
 *     verdes a la primera, con los valores escritos por la casa (la medida de falsos positivos);
 *   · y el render: ningún dígito servido lo escribió el modelo (todo número del texto servido proviene de un placeholder o de una cifra verificada
 *     dentro de un ancla).
 * Solo por `npm run gates:offline` (o con el candado: node --import ./scripts/offline-guard.mjs _anclas_gate.mjs). Cero red. */
import fs from "node:fs";
import { initTenant } from "./src/data/tenantStore.js";
import { TENANT_DEMO } from "./src/data/tenants/demo.js";
import { ESCENARIO_INICIAL } from "./src/config/scenarios.js";
import { cifrasDelDato } from "./src/adi/oracle/datoProyectado.js";
import { axisEntityNames } from "./src/adi/oracle/entityIndex.js";
import { runPlan } from "./src/adi/oracle/toolRunner.js";
import { TOOLS } from "./src/adi/oracle/toolRegistry.js";
import { cajaDelAgente } from "./src/adi/agente/herramientasAgente.js";
import { playbookPara, pasosDe } from "./src/adi/agente/playbooks/registro.js";
import { partesDelEncargo, pasosDelEncargo } from "./src/adi/agente/encargoCompuesto.js";
import { dominiosDe, pasosDeDominios, unirPasosDeDominios } from "./src/adi/agente/contratoDeDominios.js";
import { indiceDeEvidencia } from "./src/adi/notario/evidencia.js";
import { libroDeHechos, asignarIds } from "./src/adi/notario/hechos.js";
import { comprobarAnclas, parsearAnclas, renderizar, CLASES_DE_VETO } from "./src/adi/notario/anclas.js";

let PASS = 0, FAIL = 0;
const ok = (c, m, extra = "") => { if (c) { PASS++; console.log("  ✓ " + m); } else { FAIL++; console.log("  ✗ " + m + (extra ? "\n      " + extra : "")); } };
const H = (t) => console.log(`\n${t}`);
initTenant(TENANT_DEMO);
const ejes = {}; for (const e of ["cliente", "sku", "marca", "familia", "bodega", "canal"]) { try { const n = axisEntityNames(e); if (n && n.length) ejes[e] = n; } catch { /* sin índice */ } }
const DATO = cifrasDelDato(ESCENARIO_INICIAL);
const CAJA = cajaDelAgente(TOOLS);
const figsDe = (pregunta) => {
  const pb = playbookPara(pregunta, {});
  const dom = (() => { try { return dominiosDe(pregunta); } catch { return { dominios: [], eje: null }; } })();
  const pasos = unirPasosDeDominios(pasosDelEncargo(partesDelEncargo(pregunta), pb ? pasosDe(pb, pregunta, {}) : [], {}), (() => { try { return pasosDeDominios(dom); } catch { return []; } })());
  const rp = runPlan({ intent: "answer", calls: pasos.map((p) => ({ tool: p.tool, args: p.args || {} })) }, { scenario: ESCENARIO_INICIAL, maxCalls: 18, preguntaUsuario: pregunta, registry: CAJA });
  return asignarIds((rp.ledger && rp.ledger.figs) || rp.ledger || []);
};
const F = JSON.parse(fs.readFileSync(new URL("./fixtures/anclas-2026-09-17.json", import.meta.url), "utf8"));
const norm = (t) => String(t || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/(\d),(\d)/g, "$1.$2").replace(/\s+/g, " ").trim();

/* ═══ 1 · EL PARSER Y EL RENDER ═══ */
H("1 · el parser de anclas y el render");
{
  const p = parsearAnclas("{{h1 h2: Lider debe {h2} y {h3.n}}} y {h4} ⟦h5: x⟧ {{mal}} {{h6: a {{h7: b}} c}}");
  ok(p.anclas.length === 2 && p.anclas[0].ids.join(",") === "h1,h2" && p.anclas[0].placeholders.map((x) => x.id + "." + x.campo).join(",") === "h2.valor,h3.n", "anclas con varios ids y placeholders con campo (el «}}» no se come el «}» del placeholder)");
  ok(p.sueltos.length === 1 && p.sueltos[0].id === "h4", "un placeholder suelto es su propia ancla");
  ok(p.errores.length >= 2 && p.errores.every((e) => e.kind === "ancla-mal-formada"), "lo mal formado (sin ids, anidado) se reporta y no se interpreta");
}

/* ═══ 2 · LOS CASOS ═══ */
const figs = figsDe(F.pregunta);
const I = indiceDeEvidencia({ figs, datoProyectado: DATO, ejesDelTenant: ejes });
const nombres = Object.values(ejes).flat();
const libro = libroDeHechos(F.hechos, { indice: I });
H(`2 · el libro de la pregunta integrada: ${libro.resumen.verdaderos} verdaderos · ${libro.resumen.sellados} sellados · ${libro.resumen.falsos} falsos · ${libro.resumen.noVerificables} no verificables`);
ok(libro.resumen.falsos === 0 && libro.resumen.noVerificables === 0, "todos los hechos del fixture son verdaderos o sellados", libro.texto.split("\n").filter((l) => l.startsWith("✗")).join(" | "));
let mentiras = 0, verdaderosBloqueados = 0, verdaderosTotal = 0, mentirasTotal = 0;
const porClase = {};
for (const c of F.casos) {
  const R = comprobarAnclas(c.prosa, libro, { nombres, alias: F.alias || {} });
  for (const v of R.violations) porClase[v.kind] = (porClase[v.kind] || 0) + 1;
  if (c.esperado === "verde") {
    verdaderosTotal++;
    const bien = R.ok;
    if (!bien) verdaderosBloqueados++;
    ok(bien, `${c.id} · verdadero → ${R.ok ? "verde" : R.violations.map((v) => v.kind).join(", ")}`, R.violations.map((v) => v.detail.slice(0, 160)).join("\n      "));
    for (const frag of c.servido || []) ok(norm(R.servido).includes(norm(frag)), `${c.id} · sirve «${frag}»`, `servido: ${R.servido.replace(/\n/g, " ⏎ ").slice(0, 200)}`);
  } else {
    mentirasTotal++;
    const kinds = new Set(R.violations.map((v) => v.kind));
    const bien = !R.ok && c.esperado.some((k) => kinds.has(k));
    if (R.ok) mentiras++;
    ok(bien, `${c.id} · mentira → ${R.ok ? "VERDE (¡se sirve!)" : [...kinds].join(", ")} (esperado: ${c.esperado.join(" | ")})`, R.violations.map((v) => v.detail.slice(0, 160)).join("\n      ") || `servido: ${R.servido.slice(0, 160)}`);
  }
}
H("3 · medidas");
ok(mentiras === 0, `falsedades servidas en verde: ${mentiras} de ${mentirasTotal} ataques (debe ser 0)`);
ok(verdaderosBloqueados === 0, `hechos verdaderos bloqueados por la forma: ${verdaderosBloqueados} de ${verdaderosTotal} (debe ser 0)`);
console.log(`  vetos por clase: ${Object.entries(porClase).map(([k, n]) => `${k} ${n}`).join(" · ")}`);
ok(Object.keys(porClase).every((k) => CLASES_DE_VETO.includes(k)), "todo veto es de una clase declarada");

/* ═══ 4 · NINGÚN DÍGITO SERVIDO LO ESCRIBIÓ EL MODELO ═══ */
H("4 · el render: los números del texto servido los escribe la casa");
{
  const prosa = "{{h1: Lider vende {h1}}} y {{h2: arrastra $4,6M vencidos}}; {{h14: {h14.n} de {h14.m} cuentas pasan {h14.umbral}}}.";
  const R = renderizar(prosa, libro);
  ok(R.texto === "Lider vende $17.8M y arrastra $4.6M vencidos; 3 de 13 cuentas pasan 90 días.", "placeholders y cifras dichas, en el canon de la casa", R.texto);
  ok(!R.faltantes.length, "sin placeholders sin render");
  const R2 = renderizar("{{h1: Lider vende {h1.nada}}}", libro);
  ok(R2.faltantes.length === 1, "un campo que no existe se reporta, no se inventa");
}

console.log(`\n── _anclas_gate: ${PASS} PASS · ${FAIL} FAIL (de ${PASS + FAIL}) ──`);
process.exit(FAIL ? 1 : 0);
