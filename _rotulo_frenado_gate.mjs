/* === _rotulo_frenado_gate.mjs · EL RÓTULO DICE LO QUE LA CIFRA ES (R5 del examen 1 del agente · 2026-08-31) ===
 *
 * EL DEFECTO MEDIDO (T6/T8 del examen, en pantalla): «Capital inmovilizado · total = $33K». El $33K es el
 * subconjunto FRENADO (3 SKU: rotación bajo el piso o DOH sobre el techo); el capital inmovilizado AMPLIO
 * (estado ≠ Activo) es OTRA cifra — $56K en 5 SKU. La pantalla subdeclaraba el inmovilizado en 41% con la
 * palabra cruzada. La distinción es del owner desde el Examen 2, está declarada en datoProyectado («todo
 * frenado está inmovilizado, pero no todo inmovilizado está frenado — usá la palabra que corresponde a la
 * cifra que estés citando») y el notario la exige.
 *
 * EL FIX, en el origen (una sola verdad): `_ESTADO_LABEL.capital_frenado` = «capital frenado» — la vara con la
 * que se autoriza y se atribuye es también lo que se lee (La Poda F2). El binding semántico del hallazgo
 * 2026-08-09 dice por qué importa: la etiqueta equivocada AUTORIZA la afirmación equivocada.
 *
 * QUEDA VIVO-CON-PREGUNTA (para el owner, NO se toca acá): la cara/diagnóstico «Capital inmovilizado» de la
 * Mesa (decisiones 6/13 del 2026-08-09, ANTERIORES a la distinción) pinta dólares del detector frenado.
 *
 * OFFLINE · determinístico · no puede gastar.
 * `node --import ./scripts/offline-guard.mjs _rotulo_frenado_gate.mjs` */
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { initTenant, getTenantData } from "./src/data/tenantStore.js";
import { TENANT_DEMO } from "./src/data/tenants/demo.js";
import { TOOLS } from "./src/adi/oracle/toolRegistry.js";
import { ESCENARIO_INICIAL } from "./src/config/scenarios.js";

let pass = 0, fail = 0;
const ok = (cond, label, detalle) => {
  if (cond) { pass++; console.log(`  ✓ ${label}`); }
  else { fail++; console.log(`  ✗ ${label}`); if (detalle !== undefined) console.log(`      ${detalle}`); }
};
const H = (t) => console.log(`\n${t}`);

/* ═══ 1 · LA FIG DEL TOTAL DICE FRENADO, Y ES EL FRENADO ═════════════════════════════════════════════════════ */
H("1 · la herramienta de inventario rotula el $33K como lo que es");
initTenant(TENANT_DEMO);
const R = TOOLS.inventoryStatus({ scenario: ESCENARIO_INICIAL });
const bol = R.boleta || [];
{
  const figTotal = bol.find((f) => f.label === "Capital frenado · total");
  ok(!!figTotal && figTotal.mandatory === true && figTotal.value === "$33K",
    "la fig obligatoria del foco: «Capital frenado · total = $33K»", JSON.stringify(bol.slice(0, 2).map((f) => f.label)));
  const d = getTenantData();
  const amplio = (d.skuInventario || []).filter((s) => s.estado !== "Activo").reduce((a, s) => a + (s.stockUSD || 0), 0);
  ok(figTotal && amplio > figTotal.raw,
    `y el inmovilizado AMPLIO es OTRA cifra, mayor (${amplio} > ${figTotal && figTotal.raw}) — la palabra ya no la tapa`);
  ok(!bol.some((f) => /^Capital inmovilizado · total$/.test(f.label)), "el rótulo cruzado no existe más en la boleta");
  ok(bol.some((f) => f.label === "Valparaíso · Capital frenado"),
    "las etiquetas por bodega siguen al foco («Valparaíso · Capital frenado»)", JSON.stringify(bol.map((f) => f.label).slice(0, 6)));
  const est = R.facts && R.facts.inventory && (R.facts.inventory.estados || []).find((e) => e.estado === "capital_frenado");
  ok(!!est && est.label === "capital frenado", "la punta del estado también («capital frenado»)", est && est.label);
}

/* ═══ 2 · LA PROSA DE LA RAMA DECLARA EL SUBCONJUNTO ═════════════════════════════════════════════════════════ */
H("2 · la prosa dice frenado y declara la relación con el inmovilizado");
{
  const titulo = R.facts && R.facts.inventory && R.facts.inventory.title;
  ok(titulo === "Capital frenado · dónde está frenado tu capital", "el título del bloque", titulo);
  // texto plano de la rama (definición, no mención): la línea que ataba el $ al rótulo amplio ya no existe
  const src = fs.readFileSync(path.join(process.cwd(), "src", "adi", "specRetrieval.js"), "utf8");
  ok(src.includes("de capital frenado en ${skus.length} SKU sin rotar (el subconjunto crítico de tu capital inmovilizado)"),
    "la línea 1 ata la cifra a «capital frenado» y declara la relación");
  ok(!src.includes("de capital inmovilizado en ${skus.length} SKU"),
    "…y la forma cruzada vieja no vive en el archivo");
  const conv = fs.readFileSync(path.join(process.cwd(), "src", "adi", "conversation.js"), "utf8");
  ok(conv.includes('fig("Capital frenado · total"') && !conv.includes('fig("Capital inmovilizado · total"'),
    "el follow-up de continuidad (conversation.js) rotula igual — misma cifra, misma palabra");
}

/* ═══ 3 · CARNADA · el rótulo cruzado de vuelta → ROJO ═══════════════════════════════════════════════════════ */
H("3 · CARNADA · la copia con el rótulo viejo se caza");
{
  const abs = path.join(process.cwd(), "src", "adi", "specRetrieval.js");
  let txt = fs.readFileSync(abs, "utf8").replace(/\r\n/g, "\n");
  const de = 'const _ESTADO_LABEL = { capital_frenado: "capital frenado",';
  const a = 'const _ESTADO_LABEL = { capital_frenado: "capital inmovilizado",';
  if (!txt.includes(de)) { ok(false, "carnada «rótulo cruzado»", "no encontré qué mutar"); }
  else {
    const destino = abs.replace(/\.js$/, `.carnada${process.pid}_1.js`);
    fs.writeFileSync(destino, txt.replace(de, a));
    let cazada = false, detalle = "";
    try {
      const Mut = await import(pathToFileURL(destino).href);
      const r2 = Mut.composeSpecInventory({ filters: {}, scenario: ESCENARIO_INICIAL, focus: "frenado" });
      const b2 = (r2.evidence && r2.evidence.boleta) || [];
      // el defecto: la etiqueta de bodega vuelve a decir «inmovilizado» sobre dólares frenados
      cazada = b2.some((f) => /· Capital inmovilizado$/.test(f.label));
    } catch (e) { detalle = `la copia mutada ni siquiera carga: ${e.message}`; }
    try { fs.unlinkSync(destino); } catch { /* */ }
    ok(cazada, "carnada «rótulo cruzado de vuelta» → el chequeo se pone ROJO", detalle || "el defecto pasó DESAPERCIBIDO");
  }
}

console.log(`\n── _rotulo_frenado_gate: ${pass} PASS · ${fail} FAIL (de ${pass + fail}) ──`);
process.exit(fail ? 1 : 0);
