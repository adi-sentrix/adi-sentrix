/* === _access_gate.mjs · GATE del acceso demo privada (owner 2026-07-08) ===
 * Lockea el contrato del código firmado: emisión/verificación/vencimiento/manipulación + los 3 ops del handler
 * (status/check/mint) + la negación del gateway con secret activo + el modo ABIERTO sin secret (dev/backcompat).
 * Todo headless y sin red (la negación corta ANTES de tocar el proveedor). */
import { makeAccessCode, verifyAccessCode, parseAccessCode } from "./src/adi/llm/accessToken.js";
import { handleAccess, handleSpec, handleNarrate } from "./src/adi/llm/gatewayCore.js";

let pass = 0, fail = 0;
const ok = (name, cond) => { if (cond) { pass++; console.log(`  ✓ ${name}`); } else { fail++; console.log(`  ✗ ${name}`); } };

const SECRET = "gate-secret-de-prueba";
const ENV = { ADI_TOKEN_SECRET: SECRET, ADI_ADMIN_KEY: "clave-admin-gate" };

console.log("── _access_gate · códigos firmados ──");
const t0 = Date.now();
const { code, expiresAt } = await makeAccessCode("Empresa X", 72, SECRET, t0);
ok("emisión: formato ADI-… y vencimiento a 72h", /^ADI-[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(code) && expiresAt === t0 + 72 * 3600 * 1000);
const v1 = await verifyAccessCode(code, SECRET, t0 + 1000);
ok("verificación: código vigente → ok + nombre + vencimiento", v1.ok && v1.name === "Empresa X" && v1.expiresAt === expiresAt);
const v2 = await verifyAccessCode(code, SECRET, expiresAt + 1);
ok("vencimiento: pasado el plazo → reason expired (con nombre y fecha)", !v2.ok && v2.reason === "expired" && v2.name === "Empresa X");
const tam = code.slice(0, -3) + (code.endsWith("AAA") ? "BBB" : "AAA");
ok("manipulación: firma alterada → invalid", !(await verifyAccessCode(tam, SECRET, t0)).ok);
const [pl] = code.replace(/^ADI-/, "").split(".");
const forged = `ADI-${pl.slice(0, -2)}Zk.${code.split(".")[1]}`;
ok("manipulación: payload alterado (estirar el plazo) → invalid", !(await verifyAccessCode(forged, SECRET, t0)).ok);
ok("secret equivocado → invalid", !(await verifyAccessCode(code, "otro-secret", t0)).ok);
ok("basura → invalid (sin crash)", !(await verifyAccessCode("hola", SECRET)).ok && !(await verifyAccessCode(null, SECRET)).ok);
const p = parseAccessCode(code);
ok("parse cliente (sin secret): nombre + vencimiento para UX", p && p.name === "Empresa X" && p.expiresAt === expiresAt);

console.log("── handler /api/adi-access ──");
ok("status SIN secret → required:false (dev/backcompat abierto)", (await handleAccess({ op: "status" }, {})).required === false);
ok("status CON secret → required:true", (await handleAccess({ op: "status" }, ENV)).required === true);
const chk = await handleAccess({ op: "check", access: code }, ENV);
ok("check: código válido → ok + nombre", chk.ok && chk.name === "Empresa X");
const chkBad = await handleAccess({ op: "check", access: "ADI-xx.yy" }, ENV);
ok("check: código inválido → reason invalid", !chkBad.ok && chkBad.reason === "invalid");
const mintBad = await handleAccess({ op: "mint", adminKey: "equivocada", name: "Y" }, ENV);
ok("mint: adminKey equivocada → sin autorización", !mintBad.ok);
ok("mint: sin ADI_ADMIN_KEY en el server → sin autorización (nunca abierto por accidente)", !(await handleAccess({ op: "mint", adminKey: "x", name: "Y" }, { ADI_TOKEN_SECRET: SECRET })).ok);
const mint = await handleAccess({ op: "mint", adminKey: ENV.ADI_ADMIN_KEY, name: "Cliente Z", hours: 72 }, ENV);
ok("mint: con la clave del owner → emite código verificable", mint.ok && (await verifyAccessCode(mint.code, SECRET)).ok && (await verifyAccessCode(mint.code, SECRET)).name === "Cliente Z");

console.log("── negación del gateway (la protección de la key) ──");
const den1 = await handleSpec({ text: "cómo va mi margen" }, ENV);
ok("handleSpec con secret y SIN código → denied (sin tocar al proveedor)", !den1.ok && den1.access === "denied");
const den2 = await handleNarrate({ text: "hola", access: "ADI-falso.falso" }, ENV);
ok("handleNarrate con código inválido → denied", !den2.ok && den2.access === "denied");
const den3 = await handleSpec({ text: "x", access: code }, { ...ENV, LLM_PROVIDER: "openai" }).catch((e) => ({ threw: String(e && e.message) }));
ok("handleSpec con código VÁLIDO → pasa la puerta (el error posterior es del proveedor, no de acceso)", !(den3 && den3.access === "denied"));

console.log(`\n── _access_gate: PASS ${pass} · FAIL ${fail} (de ${pass + fail}) ──`);
process.exit(fail ? 1 : 0);
