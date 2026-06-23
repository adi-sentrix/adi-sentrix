import { answerADI } from "./src/adi/answerADI.js";
const has = (t) => t && t.includes("no saliste a buscar");
const a = answerADI("cómo están las ventas", {}, { scenario: "bonanza" });
const b = answerADI("cuánto debe vender Falabella para aportar $1M", {}, { scenario: "bonanza" });
const c = answerADI("clientes con bajo margen", {}, { scenario: "bonanza" });
console.log("ventas  len", a.text.length, "· suffix?", has(a.text), "· route", a.route);
console.log("inversa len", b.text.length, "· suffix?", has(b.text), "(debe ser false) · route", b.route);
console.log("erosion len", c.text.length, "· ECL peso económico?", c.text.includes("peso económico"), "· materialidad?", c.text.includes("materialidad"), "· suffix?", has(c.text));
// multi-turno: el suffix se calla en el 2do turno (gate de sesión)
const t1 = answerADI("cómo están las ventas", {}, { scenario: "bonanza" });
const t2 = answerADI("cómo está el margen", t1.context, { scenario: "bonanza" });
console.log("multi-turno · turno1 suffix?", has(t1.text), "· turno2 suffix?", has(t2.text), "(debe ser false · gate sesión)");
