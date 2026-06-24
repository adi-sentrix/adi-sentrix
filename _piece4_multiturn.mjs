// Piece 4 · multi-turno post-AVISAR · un "No llego" NO debe arrastrar suffix ni envenenar el turno N+1.
import { answerADI } from "./src/adi/answerADI.js";
const M = { activeModule: "ventas" }, S = { scenario: "bonanza" };
let pass = 0, fail = 0;
const check = (label, cond, detail) => { if (cond) { pass++; console.log(`✓ ${label}`); } else { fail++; console.log(`✗ ${label}  ${detail || ""}`); } };

// 1 · El AVISAR es LIMPIO (sin suffix proactivo · sin foco/tabla · solo el mensaje)
const avisar = answerADI("contribución por canal", { ...M }, S);
check("AVISAR limpio · ruta qi_retrieval_avisar", avisar.route === "qi_retrieval_avisar", `route=${avisar.route}`);
check("AVISAR sin suffix proactivo (texto corto · solo el mensaje)", avisar.text.length < 160 && !/punto que no saliste|Un punto que|Confianza/i.test(avisar.text), `len=${avisar.text.length} «${avisar.text}»`);
check("AVISAR no thread-ea entities (context sin activeResult/lastClientList nuevos)",
  !(avisar.context && (avisar.context.activeResult || (avisar.context.lastClientList && avisar.context.lastClientList.length))),
  JSON.stringify(Object.keys(avisar.context || {})));

// 2 · El turno N+1 tras un AVISAR == el mismo turno en sesión fresca (sin contaminación)
const fresh = answerADI("margen por marca", { ...M }, S);
const afterAvisar = answerADI("margen por marca", avisar.context, S);
check("N+1 tras AVISAR byte-idéntico a fresco (no contamina)", fresh.text === afterAvisar.text,
  `fresh ${fresh.text.length} / post ${afterAvisar.text.length}`);

// 3 · Mismo control con un ACLARAR (stock) de por medio
const aclarar = answerADI("stock por marca", { ...M }, S);
check("ACLARAR limpio · ruta qi_retrieval_aclarar + opciones explícitas", aclarar.route === "qi_retrieval_aclarar" && /unidades vendidas/.test(aclarar.text) && /capital en inventario/.test(aclarar.text), `«${aclarar.text}»`);
const afterAclarar = answerADI("margen por marca", aclarar.context, S);
check("N+1 tras ACLARAR byte-idéntico a fresco", fresh.text === afterAclarar.text, `fresh ${fresh.text.length} / post ${afterAclarar.text.length}`);

// 4 · AISLAR el efecto del AVISAR: T1(APLICAR)→AVISAR→T3 debe == T1(APLICAR)→T3 (sin AVISAR).
// (T1 hila contexto legítimamente · multi-turno existente; lo que probamos es que el AVISAR es TRANSPARENTE)
const t1 = answerADI("ventas por cliente de Samsung", { ...M }, S);     // APLICAR (hila contexto)
const conAvisar = answerADI("margen por marca", answerADI("contribución por canal", t1.context, S).context, S);
const sinAvisar = answerADI("margen por marca", t1.context, S);
check("AVISAR transparente en la cadena (T1→AVISAR→T3 == T1→T3)", conAvisar.text === sinAvisar.text, `con ${conAvisar.text.length} / sin ${sinAvisar.text.length}`);

console.log(`\n── Piece 4 multi-turno post-AVISAR: ${pass} ok / ${fail} fail ──`);
process.exit(fail ? 1 : 0);
