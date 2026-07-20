/* === _access_gate.mjs · GATE del acceso demo privada (owner 2026-07-08) ===
 * Lockea el contrato del código firmado: emisión/verificación/vencimiento/manipulación + los 3 ops del handler
 * (status/check/mint) + la negación del gateway con secret activo + el modo ABIERTO sin secret (dev/backcompat).
 * Todo headless y sin red (la negación corta ANTES de tocar el proveedor). */
import { makeAccessCode, verifyAccessCode, parseAccessCode } from "./src/adi/llm/accessToken.js";
import { handleAccess, handleSpec, handleNarrate } from "./src/adi/llm/gatewayCore.js";

let pass = 0, fail = 0;
const ok = (name, cond) => { if (cond) { pass++; console.log(`  ✓ ${name}`); } else { fail++; console.log(`  ✗ ${name}`); } };

const SECRET = "gate-secret-de-prueba";
// ADI_MINT_ENABLED:"true" para los tests de emisión — refleja el estado "encendido para emitir" (owner 2026-07-20)
const ENV = { ADI_TOKEN_SECRET: SECRET, ADI_ADMIN_KEY: "clave-admin-gate", ADI_MINT_ENABLED: "true" };

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
// la emisión ahora exige un GRANT temporal (op:mint_enable) además de la clave (owner 2026-07-20)
const GRANT = (await handleAccess({ op: "mint_enable", adminKey: ENV.ADI_ADMIN_KEY }, ENV)).grant;
const mintBad = await handleAccess({ op: "mint", adminKey: "equivocada", grant: GRANT, name: "Y" }, ENV);
ok("mint: adminKey equivocada → sin autorización", !mintBad.ok);
ok("mint: sin ADI_ADMIN_KEY en el server → sin autorización (nunca abierto por accidente)", !(await handleAccess({ op: "mint", adminKey: "x", grant: GRANT, name: "Y" }, { ADI_TOKEN_SECRET: SECRET, ADI_MINT_ENABLED: "true" })).ok);
const mint = await handleAccess({ op: "mint", adminKey: ENV.ADI_ADMIN_KEY, grant: GRANT, name: "Cliente Z", hours: 72 }, ENV);
ok("mint: con grant + clave del owner → emite código verificable", mint.ok && (await verifyAccessCode(mint.code, SECRET)).ok && (await verifyAccessCode(mint.code, SECRET)).name === "Cliente Z");
// ACCESO DE OWNER (2026-07-10: "que no me pida el código cada vez") · owner:true con la MISMA clave → hasta 1 año;
// el techo de INVITADOS queda intacto (pedir 365 días sin owner:true → recorta a 14).
const mintOwner = await handleAccess({ op: "mint", adminKey: ENV.ADI_ADMIN_KEY, grant: GRANT, name: "Owner", hours: 24 * 365, owner: true }, ENV);
ok("mint owner: 1 año permitido y verificable", mintOwner.ok && mintOwner.expiresAt - Date.now() > 300 * 24 * 3600 * 1000 && (await verifyAccessCode(mintOwner.code, SECRET)).ok);
const mintCap = await handleAccess({ op: "mint", adminKey: ENV.ADI_ADMIN_KEY, grant: GRANT, name: "Invitado L", hours: 24 * 365 }, ENV);
ok("mint invitado: pedir 365 días SIN owner:true → recorta al techo de 14", mintCap.ok && mintCap.expiresAt - Date.now() <= 14 * 24 * 3600 * 1000 + 60000);
ok("mint owner: SIN la clave admin → sin autorización (owner:true no abre nada solo)", !(await handleAccess({ op: "mint", adminKey: "equivocada", grant: GRANT, owner: true, hours: 24 * 365 }, ENV)).ok);

console.log("── kill-switch MAESTRO ADI_MINT_ENABLED (emergencia · owner 2026-07-20) ──");
const ENV_OFF = { ADI_TOKEN_SECRET: SECRET, ADI_ADMIN_KEY: "clave-admin-gate" };   // sin ADI_MINT_ENABLED = maestro apagado
ok("maestro AUSENTE → mint_enable NO entrega grant (nadie puede habilitar)", !(await handleAccess({ op: "mint_enable", adminKey: "clave-admin-gate" }, ENV_OFF)).ok);
ok("maestro='false' → mint_enable bloqueado", !(await handleAccess({ op: "mint_enable", adminKey: "clave-admin-gate" }, { ...ENV_OFF, ADI_MINT_ENABLED: "false" })).ok);
ok("maestro='1' (no exactamente 'true') → mint_enable bloqueado (solo 'true' arma)", !(await handleAccess({ op: "mint_enable", adminKey: "clave-admin-gate" }, { ...ENV_OFF, ADI_MINT_ENABLED: "1" })).ok);
ok("maestro AUSENTE → mint bloqueado aun con clave correcta (fail-closed)", !(await handleAccess({ op: "mint", adminKey: "clave-admin-gate", grant: GRANT, name: "Z" }, ENV_OFF)).ok);
ok("maestro='true' pero SIN grant → 'emisión no habilitada' (el toggle ya no es el interruptor operativo)", !(await handleAccess({ op: "mint", adminKey: "clave-admin-gate", name: "Z" }, ENV)).ok);
ok("con maestro apagado, check SIGUE funcionando (validación de códigos intacta)", (await handleAccess({ op: "check", access: code }, ENV_OFF)).ok);
ok("con maestro apagado, status SIGUE required:true (la puerta no se afecta)", (await handleAccess({ op: "status" }, ENV_OFF)).required === true);

console.log("── negación del gateway (la protección de la key) ──");
const den1 = await handleSpec({ text: "cómo va mi margen" }, ENV);
ok("handleSpec con secret y SIN código → denied (sin tocar al proveedor)", !den1.ok && den1.access === "denied");
const den2 = await handleNarrate({ text: "hola", access: "ADI-falso.falso" }, ENV);
ok("handleNarrate con código inválido → denied", !den2.ok && den2.access === "denied");
const den3 = await handleSpec({ text: "x", access: code }, { ...ENV, LLM_PROVIDER: "openai" }).catch((e) => ({ threw: String(e && e.message) }));
ok("handleSpec con código VÁLIDO → pasa la puerta (el error posterior es del proveedor, no de acceso)", !(den3 && den3.access === "denied"));

console.log(`\n── _access_gate: PASS ${pass} · FAIL ${fail} (de ${pass + fail}) ──`);
process.exit(fail ? 1 : 0);
