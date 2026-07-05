/* === _boleta_gate.mjs · ADI Core · GATE de la BOLETA + guard v2 (boleta-aware) ===
 * (1) los composers emiten boleta bien formada (value == cifras del texto · campos reservados para simulate);
 * (2) guardAgainstBoleta bloquea drift de unidad/escala, ratio garbleado, invento y obligatoria faltante; pasa verbatim;
 * (3) numberGuard rutea a la boleta cuando existe, y al v1 cuando no (retrocompatible). */
import { composeSpecDiagnose, composeSpecCompare } from "./src/adi/specRetrieval.js";
import { fig, guardAgainstBoleta } from "./src/adi/boleta.js";
import { numberGuard, pickNarratedText } from "./src/adi/llm/numberGuard.js";

let pass = 0, fail = 0;
const ok = (name, cond) => { if (cond) { pass++; console.log("  ✓ " + name); } else { fail++; console.log("  ✗ " + name); } };

// ── 1 · composers emiten boleta de primera clase ────────────────────────────
const diag = composeSpecDiagnose({ filters: {}, scenario: "bonanza" });
ok("1 · diagnose emite evidence.boleta no vacía", !!(diag && Array.isArray(diag.evidence.boleta) && diag.evidence.boleta.length));
ok("2 · figuras con value/unit/mandatory + campos reservados source/formula/context",
  diag.evidence.boleta.every((f) => f.value && f.unit && "mandatory" in f && f.source === "actual" && "formula" in f && "context" in f));
ok("3 · cada value de la boleta aparece VERBATIM en el texto (una sola verdad)",
  diag.evidence.boleta.every((f) => diag.opener.includes(f.value)));
ok("4 · diagnose tiene al menos una figura mandatory (subtotal)", diag.evidence.boleta.some((f) => f.mandatory));

const cmp = composeSpecCompare({ dimension: "marca", entities: ["Samsung", "LG"], scenario: "bonanza" });
ok("5 · compare (si compone) emite boleta con values en el texto",
  !cmp || (Array.isArray(cmp.evidence.boleta) && cmp.evidence.boleta.length > 0 && cmp.evidence.boleta.every((f) => cmp.opener.includes(f.value))));

// ── 2 · guard v2 · casos adversariales (boleta sintética con money + ratio + pct) ──
const bol = [
  fig("Samsung venta", "$31.6K", { unit: "money", raw: 31600, mandatory: true }),
  fig("LG venta", "$24.6K", { unit: "money", raw: 24600 }),
  fig("Ratio venta", "1.3x", { unit: "ratio", raw: 1.3 }),
  fig("Samsung margen", "24.2%", { unit: "pct", raw: 24.2 }),
];
ok("6 · narración VERBATIM pasa",
  guardAgainstBoleta("Samsung vendió $31.6K contra $24.6K de LG, una relación de 1.3x; su margen es 24.2%.", bol).ok);
ok("7 · ratio garbleado '13 veces' (boleta 1.3x) BLOQUEA",
  !guardAgainstBoleta("Samsung supera a LG por una relación de 13 veces.", bol).ok);
ok("8 · drift de escala $31.6M (boleta $31.6K) BLOQUEA",
  !guardAgainstBoleta("Samsung vendió $31.6M contra $24.6K de LG; margen 24.2%; relación 1.3x.", bol).ok);
ok("9 · cifra inventada $99.9K BLOQUEA",
  !guardAgainstBoleta("Samsung vendió $31.6K y proyecta $99.9K; $24.6K LG; 1.3x; 24.2%.", bol).ok);
ok("10 · obligatoria faltante ($31.6K) BLOQUEA",
  !guardAgainstBoleta("LG vendió $24.6K con 24.2% de margen, relación 1.3x.", bol).ok);
ok("11 · pct drift 24.2% -> 42.2% BLOQUEA",
  !guardAgainstBoleta("Samsung venta $31.6K, margen 42.2%, relación 1.3x.", bol).ok);

// ── 3 · numberGuard rutea correctamente ─────────────────────────────────────
const withBoleta = { text: "det", evidence: { boleta: bol } };
ok("12 · pickNarratedText usa la boleta (bloquea '13 veces' → cae a determinístico)",
  pickNarratedText(withBoleta, "relación de 13 veces").narrated === false);
ok("13 · pickNarratedText verbatim con boleta narra",
  pickNarratedText(withBoleta, "Samsung $31.6K vs LG $24.6K, relación 1.3x, margen 24.2%").narrated === true);
ok("14 · la boleta atrapa unit-drift ($31.6M) que el v1 (solo dígitos) NO ve",
  pickNarratedText(withBoleta, "Samsung $31.6M vs $24.6K de LG, relación 1.3x, margen 24.2%").narrated === false
  && numberGuard("Samsung $31.6M vs $24.6K de LG, relación 1.3x, margen 24.2%", withBoleta).ok === true);
const noBoleta = { text: "Falabella cede $1.6M.", evidence: null };
ok("15 · sin boleta, numberGuard v1 intacto (autoriza $1.6M del texto)", numberGuard("Falabella cede $1.6M.", noBoleta).ok);
ok("16 · sin boleta, numberGuard v1 bloquea inventada $9.9M", !numberGuard("Falabella cede $9.9M.", noBoleta).ok);

console.log(`\n── boleta-gate: ${pass} PASS · ${fail} FAIL ──`);
process.exit(fail ? 1 : 0);
