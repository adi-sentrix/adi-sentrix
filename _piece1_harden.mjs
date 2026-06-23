// Piece 1 · gate del endurecimiento de extractores (strict vs loose).
import { detectAllFamiliesInText, detectAllClientsInText } from "./src/adi/router.js";
import { detectClientInText } from "./src/adi/detectors.js";
const S = { strict: true };
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);
let pass = 0, fail = 0;
function check(label, got, want) {
  const ok = eq(got, want);
  if (ok) pass++; else fail++;
  console.log(`${ok ? "✓" : "✗ FAIL"}  ${label}  → ${JSON.stringify(got)}${ok ? "" : "  (esperado " + JSON.stringify(want) + ")"}`);
}
console.log("── FAMILIAS · strict mata over-match, preserva legítimos ──");
check("strict 'necesito materiales para la obra'", detectAllFamiliesInText("necesito materiales para la obra", S), []);
check("strict 'materiales de oficina'",            detectAllFamiliesInText("materiales de oficina", S), []);
check("strict 'de la familia Materiales de Construcción'", detectAllFamiliesInText("de la familia Materiales de Construcción", S), ["Materiales de Construcción"]);
check("strict 'de la familia Cuidado Personal'",   detectAllFamiliesInText("ventas por cliente de la familia Cuidado Personal", S), ["Cuidado Personal"]);
check("strict 'de la familia Línea Blanca'",       detectAllFamiliesInText("ventas por SKU de la familia Línea Blanca", S), ["Línea Blanca"]);
check("strict 'en Electrodomésticos'",             detectAllFamiliesInText("margen por SKU de Samsung en Electrodomésticos", S), ["Electrodomésticos"]);
check("strict 'de electro'",                       detectAllFamiliesInText("ventas de electro", S), ["Electrodomésticos"]);
console.log("── FAMILIAS · loose (default) byte-idéntico al piso ──");
check("loose 'materiales' (piso)",                 detectAllFamiliesInText("necesito materiales"), ["Materiales de Construcción"]);
check("loose 'electro' (piso)",                    detectAllFamiliesInText("electro"), ["Electrodomésticos"]);
console.log("── CLIENTES · strict exige conector para ambiguas (abc/easy/paris) ──");
check("strict 'el abc del margen'",                detectClientInText("el abc del margen", S), null);
check("strict 'ventas de ABC'",                    detectClientInText("ventas de ABC", S), "ABC");
check("strict 'cliente Easy'",                     detectClientInText("cliente Easy", S), "Easy");
check("strict 'easy' suelto",                      detectClientInText("easy", S), null);
check("strict 'paris' suelto",                     detectClientInText("paris", S), null);
check("strict 'de Paris'",                         detectClientInText("ventas de Paris", S), "Paris");
check("strict 'de Falabella' (no ambigua)",        detectClientInText("ventas de Falabella", S), "Falabella");
check("strict all 'Falabella y Jumbo'",            detectAllClientsInText("Falabella y Jumbo", S), ["Falabella", "Jumbo"]);
console.log("── CLIENTES · loose (default) byte-idéntico al piso ──");
check("loose 'el abc' (piso)",                     detectClientInText("el abc del margen"), "ABC");
check("loose 'easy' (piso)",                       detectClientInText("easy"), "Easy");
console.log(`\n── Piece 1 probe: ${pass} ok / ${fail} fail ──`);
process.exit(fail ? 1 : 0);
