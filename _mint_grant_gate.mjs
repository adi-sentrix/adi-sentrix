/* === _mint_grant_gate.mjs · GATE de la habilitación temporal de emisión (owner 2026-07-20) ===
 * Lockea el sistema de grant firmado de 10 min: apagado por defecto · solo la clave correcta habilita ·
 * mint exige grant vigente + clave · vencimiento · manipulación/reuso indebido · sin regresión en check/status.
 * Headless, sin red. ADI_MINT_ENABLED es el kill-switch MAESTRO (debe estar "true" para poder habilitar). */
import { handleAccess } from "./src/adi/llm/gatewayCore.js";
import { makeMintGrant, verifyMintGrant, makeAccessCode } from "./src/adi/llm/accessToken.js";

const SECRET = "gate-secret-mintgrant";
const KEY = "clave-admin-mintgrant";
const ENV = { ADI_TOKEN_SECRET: SECRET, ADI_ADMIN_KEY: KEY, ADI_MINT_ENABLED: "true" };   // maestro armado
const ENV_MASTER_OFF = { ADI_TOKEN_SECRET: SECRET, ADI_ADMIN_KEY: KEY };                   // maestro apagado

let pass = 0, fail = 0;
const ok = (n, c) => { if (c) { pass++; console.log("  ✓ " + n); } else { fail++; console.log("  ✗ " + n); } };
const enable = async (env = ENV, key = KEY) => handleAccess({ op: "mint_enable", adminKey: key }, env);
const mint = async (grant, env = ENV, key = KEY, extra = {}) => handleAccess({ op: "mint", adminKey: key, grant, name: "Cliente", hours: 72, ...extra }, env);

console.log("── kill-switch maestro + habilitación ──");
ok("1 · APAGADO POR DEFECTO: mint sin grant → 'emisión no habilitada'", !(await mint(undefined)).ok);
ok("1b · maestro OFF: mint_enable no entrega grant aunque la clave sea correcta", !(await enable(ENV_MASTER_OFF)).ok);
ok("2 · CLAVE INCORRECTA no puede habilitar", !(await enable(ENV, "clave-mala")).ok);
const en = await enable();
ok("3 · HABILITACIÓN VÁLIDA → grant + exp ~10 min", en.ok && typeof en.grant === "string" && en.expiresAt - Date.now() > 9 * 60 * 1000 && en.expiresAt - Date.now() <= 10 * 60 * 1000 + 1000);
ok("3b · el grant verifica como tipo mint", (await verifyMintGrant(en.grant, SECRET)).ok);

console.log("── mint dentro / fuera de la ventana ──");
const emitido = await mint(en.grant);
ok("4 · MINT DENTRO DE LA VENTANA con grant + clave → emite código", emitido.ok && /^ADI-/.test(emitido.code));
ok("4b · el código emitido es un ACCESS code válido (no un grant)", (await verifyMintGrant(emitido.code, SECRET)).reason === "invalid");
const vencido = await makeMintGrant(SECRET, -1000);   // grant ya expirado
ok("5 · RECHAZO DESPUÉS DEL VENCIMIENTO: grant expirado → mint rechazado", !(await mint(vencido.grant)).ok);

console.log("── manipulación / reuso indebido ──");
const alterado = en.grant.slice(0, -3) + (en.grant.endsWith("AAA") ? "BBB" : "AAA");
ok("6a · grant con FIRMA ALTERADA → rechazado", !(await mint(alterado)).ok);
const codeComoGrant = (await makeAccessCode("X", 72, SECRET)).code;   // un código de acceso ADI-
ok("6b · un CÓDIGO DE ACCESO usado como grant → rechazado (tipo/prefijo distinto)", !(await mint(codeComoGrant)).ok);
ok("6c · un GRANT usado como código de acceso (op:check) → inválido (no abre la puerta)", !(await handleAccess({ op: "check", access: en.grant }, ENV)).ok);
ok("6d · grant de OTRO secret → rechazado", !(await mint((await makeMintGrant("otro-secret")).grant)).ok);
ok("6e · grant válido pero SIN la clave admin → sin autorización", !(await handleAccess({ op: "mint", grant: en.grant, name: "Y" }, ENV)).ok);
ok("6f · grant válido + clave INCORRECTA → sin autorización", !(await mint(en.grant, ENV, "clave-mala")).ok);

console.log("── sin regresión ──");
ok("7a · check con maestro apagado sigue funcionando", (await handleAccess({ op: "check", access: emitido.code }, ENV_MASTER_OFF)).ok);
ok("7b · status sigue required:true", (await handleAccess({ op: "status" }, ENV)).required === true);

console.log(`\n_mint_grant_gate: PASS ${pass} · FAIL ${fail} (de ${pass + fail})`);
process.exit(fail ? 1 : 0);
