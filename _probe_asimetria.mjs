import { answerADI } from "./src/adi/answerADI.js";
import { resolveIntentLayerEarly } from "./src/adi/intentLayer.js";
const ctxs = [
  ["mínimo", {}],
  ["activeModule", { activeModule: "margenes" }],
  ["oráculo-like", { activeModule: "margenes", lastPanoramaDomain: "margenes", turnCount: 1 }],
];
for (const q of ["cómo está el margen", "cómo está el inventario", "cómo están las ventas"]) {
  console.log(`\n«${q}»`);
  for (const [label, ctx] of ctxs) {
    const r = answerADI(q, ctx, { scenario: "bonanza" });
    const early = resolveIntentLayerEarly(q, "bonanza", ctx);
    console.log(`   ctx ${label.padEnd(13)} → route ${r.route} · earlyGate fires? ${early ? "SÍ" : "no"}`);
  }
}
