/* === _ficha_texto_libre_gate.mjs · LLEGAR A LA FICHA SIN PASAR POR UN BOTÓN (owner 2026-08-12) ================
 * LA RAZÓN, textual del owner: «Sentrix es APOYO, NO REQUISITO. Si el usuario escribe desde el inicio, sin haber
 * tocado la Mesa, ADI igual tiene que entender que quiere acercarse a una entidad y abrir su ficha. Un producto
 * que solo entiende la pregunta cuando venís de un botón obliga al usuario a aprender la interfaz antes de poder
 * preguntar.»
 *
 * LO QUE HABÍA. La nota de 2026-08-12 decía que el piso determinístico no tenía ruta a la Ficha y que llegar
 * dependía de que el planificador acertara. Verificado hoy: `router.js` y `coerceChain.js` siguen sin mencionarla
 * — pero el hueco real es peor, porque el CAMINO NATURAL pasó a ser el principal y ahí `answerViaNatural`
 * devolvía `sentrixAction: null` FIJO. Desde texto libre no había ruta ninguna.
 *
 * EL PISO QUE EL OWNER DECLARÓ (sus cuatro variantes, con el tipeo incluido) es la sección 1. El resto son los
 * candados que impiden que esto se convierta en un botón que miente.
 * OFFLINE · sin LLM · sin red · no puede gastar: el detector es determinístico y el cerebro va simulado. */
import { initTenant } from "./src/data/tenantStore.js";
import { TENANT_DEMO } from "./src/data/tenants/demo.js";
import { TENANT_EMPRESA2 } from "./src/data/tenants/empresa2.js";
initTenant(TENANT_DEMO);
import { detectFichaIntent } from "./src/adi/oracle/fichaIntent.js";
import { answerViaNatural } from "./src/adi/oracle/caminoNatural.js";
import { parseAddress, resolveAddress } from "./src/adi/sentrix/address.js";
import { ESCENARIO_INICIAL } from "./src/config/scenarios.js";

let pass = 0, fail = 0;
const ok = (cond, label, detalle) => {
  if (cond) { pass++; console.log(`  ✓ ${label}`); }
  else { fail++; console.log(`  ✗ FALLO: ${label}${detalle !== undefined ? ` — ${detalle}` : ""}`); }
};

console.log("=".repeat(100));
console.log("1 · EL PISO QUE DECLARÓ EL OWNER · las cuatro variantes mínimas, con el tipeo incluido");
console.log("=".repeat(100));
for (const q of [
  "explicame falabela",                        // ← el error de tipeo va a propósito
  "qué debería revisar primero de Falabella",
  "abrí la ficha de Falabella",
  "perfil de Falabella",
]) {
  const r = detectFichaIntent(q, { escenario: ESCENARIO_INICIAL });
  ok(!!r && r.entidad === "Falabella", `«${q}» → la ficha de Falabella`, r ? `dio ${r.entidad}` : "no reconoció nada");
}

console.log("\n" + "=".repeat(100));
console.log("2 · EL BOTÓN ABRE DE VERDAD · un CTA que no lleva a ningún lado es peor que no ofrecerlo");
console.log("=".repeat(100));
/* Se recorre la cadena ENTERA, la misma que corre la app: dirección → parseAddress → resolveAddress → lo que la
 * Mesa lee para decidir qué cara abrir. La primera versión de este trabajo verificaba solo que la dirección se
 * pudiera construir, y con eso habría pasado un botón que abría la Mesa en vez de la Ficha. */
{
  const r = detectFichaIntent("explicame falabela", { escenario: ESCENARIO_INICIAL });
  const sa = r && r.sentrixAction;
  ok(!!sa && !!sa.label && !!sa.payload && !!sa.payload.address, "la acción trae etiqueta y dirección");
  const link = sa ? resolveAddress(parseAddress(sa.payload.address)) : null;
  ok(!!link && link.conocido === true, "la dirección es CONOCIDA por el manifiesto de vistas");
  ok(!!link && link.cara === "ficha", `y la cara que abre es la FICHA (${link && link.cara})`);
  ok(!!link && link.entidad === "Falabella", `con la entidad resuelta (${link && link.entidad})`);
  ok(!!sa && /Ver la ficha de Falabella/.test(sa.label), `la etiqueta la compone el producto, no este módulo: «${sa && sa.label}»`);
  ok(!!sa && sa.payload.modulo === "ficha" && Array.isArray(sa.payload.clientes),
    "el payload es el CANÓNICO (buildSentrixActionFromAddress), no uno armado a mano");
}

console.log("\n" + "=".repeat(100));
console.log("3 · NO SECUESTRA LO QUE NO ES · una consulta de dato no es un pedido de ficha");
console.log("=".repeat(100));
for (const q of [
  "cuánto vendió Falabella",
  "dame el ranking de clientes",
  "explicame el margen de la cartera",
  "hazme un resumen ejecutivo de las dos cosas",
]) ok(!detectFichaIntent(q, { escenario: ESCENARIO_INICIAL }), `«${q}» → sin botón`);

console.log("\n" + "=".repeat(100));
console.log("4 · NUNCA LA FICHA DE OTRO · inventar una entidad es peor que no ofrecer nada");
console.log("=".repeat(100));
ok(!detectFichaIntent("explicame Acme Corp", { escenario: ESCENARIO_INICIAL }),
  "un cliente que NO existe no abre nada — ni el más parecido");
ok(!detectFichaIntent("explicame", { escenario: ESCENARIO_INICIAL }), "sin entidad, nada");
ok(!detectFichaIntent("explicame SAM-TV55", { escenario: ESCENARIO_INICIAL }),
  "un SKU tampoco: la Ficha que existe es la del CLIENTE, ofrecerla para otra cosa sería una promesa falsa");
{
  // el nombre de dos palabras le gana al de una que esté adentro
  const r = detectFichaIntent("contame de La Polar", { escenario: ESCENARIO_INICIAL });
  ok(!!r && r.entidad === "La Polar", `«La Polar» se resuelve entero, no por su segunda palabra (${r && r.entidad})`);
}

console.log("\n" + "=".repeat(100));
console.log("5 · SIGUE AL TENANT · la ficha que se ofrece es la de la empresa que está mirando");
console.log("=".repeat(100));
initTenant(TENANT_EMPRESA2);
ok(!detectFichaIntent("explicame Falabella", { escenario: ESCENARIO_INICIAL }),
  "con empresa2 activa, un cliente del demo ya NO abre ficha: no es su cliente");
{
  const r = detectFichaIntent("explicame Supermercados del Valle", { escenario: ESCENARIO_INICIAL });
  ok(!!r && r.entidad === "Supermercados del Valle", `y SUS clientes sí (${r && r.entidad})`);
}
initTenant(TENANT_DEMO);   // se devuelve el tenant declarado

console.log("\n" + "=".repeat(100));
console.log("6 · EN EL CAMINO NATURAL COMPLETO · donde antes había un null fijo");
console.log("=".repeat(100));
{
  const cerebro = async () => "Falabella aporta $19.4M de venta comercial en el año cerrado, con 22.0% de margen de venta.";
  const o = await answerViaNatural({ text: "explicame falabela", history: [], mem: {}, scenario: ESCENARIO_INICIAL, callNatural: cerebro });
  ok(!!(o && o.r && o.r.sentrixAction), "el turno sale CON la acción de ficha");
  const o2 = await answerViaNatural({ text: "cuánto vendió Falabella", history: [], mem: {}, scenario: ESCENARIO_INICIAL, callNatural: cerebro });
  ok(!(o2 && o2.r && o2.r.sentrixAction), "…y una consulta de dato sale sin ella");
}

console.log(`\n── _ficha_texto_libre_gate: ${pass} PASS · ${fail} FAIL (de ${pass + fail}) ──`);
process.exit(fail === 0 ? 0 : 1);
