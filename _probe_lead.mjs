import { answerADI } from "./src/adi/answerADI.js";
const S = { scenario: "bonanza" };
const show = (q) => { const r = answerADI(q, {}, S); console.log(`«${q}» [${r.route}] len ${r.text ? r.text.length : 0}\n   head: ${r.text ? r.text.split("\n")[0].slice(0, 80) : "(null)"}`); };
show("clientes con bajo margen");      // erosión · debe llevar lead "N cuentas Tier 1 están aportando volumen..."
show("cómo está Lider");               // client_dive · lead "Lider es la cuenta..."
show("cómo están las ventas");         // early_gate · SIN lead (no intent)
show("cómo viene Makita");             // brand · sin template → sin lead (debe seguir PARIDAD)
show("Santiago vs Valparaíso");        // warehouse · sin template → sin lead
