/* === src/adi/llm/gatewayCore.js · GATEWAY LLM · handlers PLATFORM-NEUTRAL (una sola fuente de verdad) ===
 * La lógica de los DOS pasos del LLM, SIN acoplarse a Vite ni a ninguna plataforma:
 *   · handleSpec    · LLM #1 · texto → spec canónico (adapter.parse)
 *   · handleNarrate · LLM #2 · output validado → narración (adapter.narrate)
 * Cada entorno (dev Vite · server Node · función serverless) es un WRAPPER delgado que llama a estos handlers.
 *
 * REGLA: la key vive en el env del SERVER (process.env) · JAMÁS en el cliente ni en el bundle. El motor ADI y el
 * number-guard corren en el CLIENTE (answerADIFromSpec + pickNarratedText local) → este gateway sólo habla con el
 * proveedor. NO toca el motor sellado. Si algo falla → {ok:false} y el cliente degrada al piso determinístico.
 */
import { buildContractMenu, buildParseUserMessage } from "./contractMenu.js";
import { buildSpecTool } from "./specTool.js";
import { buildNarrateSystem } from "./narratePrompt.js";
import { getAdapter } from "./providerAdapter.js";
import { verifyAccessCode, makeAccessCode } from "./accessToken.js";

// config del proveedor desde el env (en dev el .env se carga a process.env · en prod lo setea la plataforma).
// `env` inyectable para runtimes que no exponen process.env global (ej. Cloudflare Workers) · default process.env.
function _env(env) {
  return env || (typeof process !== "undefined" ? process.env : {}) || {};
}
function _config(env) {
  const e = _env(env);
  const provider = e.LLM_PROVIDER || "anthropic";
  const model = e.LLM_MODEL_PARSE || e.OPENAI_MODEL || e.ANTHROPIC_MODEL || "gpt-4o-mini";
  const narrateModel = e.LLM_MODEL_NARRATE || model;
  return { provider, model, narrateModel };
}

// ── ACCESO DEMO PRIVADA (owner 2026-07-08) ──────────────────────────────────────────────────────────────────────
// Con ADI_TOKEN_SECRET seteado, TODA llamada al LLM exige un código firmado vigente (body.access) — es lo que
// protege la key del proveedor cuando el link circula. Sin secret → gateway abierto (dev/backcompat intactos).
// La denegación viaja como {ok:false, access:"denied"} → el cliente muestra la pantalla de acceso (no rompe el piso).
async function _access(accessCode, env) {
  const secret = _env(env).ADI_TOKEN_SECRET;
  if (!secret) return { ok: true, open: true };
  const r = await verifyAccessCode(accessCode, secret);
  return r.ok ? { ok: true } : { ok: false, reason: r.reason, expiresAt: r.expiresAt || null };
}

// /api/adi-access · status (¿la demo exige código?) · check (validar un código) · mint (emitir uno · solo admin)
export async function handleAccess(body = {}, env) {
  const e = _env(env);
  const secret = e.ADI_TOKEN_SECRET || "";
  const op = body.op || "status";
  if (op === "status") return { ok: true, required: !!secret };
  if (op === "check") {
    if (!secret) return { ok: true, required: false };
    const r = await verifyAccessCode(body.access, secret);
    return r.ok
      ? { ok: true, required: true, name: r.name, expiresAt: r.expiresAt }
      : { ok: false, required: true, reason: r.reason, expiresAt: r.expiresAt || null };
  }
  if (op === "mint") {
    // KILL-SWITCH FAIL-CLOSED (owner 2026-07-20): la emisión de códigos está APAGADA salvo ADI_MINT_ENABLED==="true".
    // Ausente/false/cualquier-otro → bloqueado, ANTES de tocar la clave admin (menos superficie: ni se compara).
    // El owner la enciende solo mientras emite y la vuelve a apagar. check/status/validación/LLM no se tocan.
    if (String(e.ADI_MINT_ENABLED) !== "true") return { ok: false, error: "emisión deshabilitada" };
    const adminKey = e.ADI_ADMIN_KEY;
    if (!secret || !adminKey || !body.adminKey || body.adminKey !== adminKey) return { ok: false, error: "sin autorización" };
    const name = String(body.name || "").trim().slice(0, 40) || "invitado";
    // invitados: 1h a 14 días (default 3) · OWNER (owner:true — intención explícita con la MISMA clave admin):
    // hasta 1 año, para no re-emitir su propio acceso cada 3 días (owner 2026-07-10) sin estirar el techo de invitados.
    const cap = body.owner === true ? 24 * 366 : 24 * 14;
    const hours = Math.min(Math.max(Number(body.hours) || 72, 1), cap);
    const { code, expiresAt } = await makeAccessCode(name, hours, secret);
    return { ok: true, code, expiresAt, name };
  }
  return { ok: false, error: "op desconocida" };
}

// LLM #1 · texto (+ contexto de conversación) → spec · devuelve {ok, spec, usage} | {ok:false, error}
// El `context` (conversationContext · turnos + última evidencia) viaja al LLM #1 vía buildParseUserMessage → clasifica
// turn_type y resuelve referencias. El motor/seam sigue validando; el contexto NO habilita saltar guards.
export async function handleSpec({ text, context, access } = {}, env) {
  const acc = await _access(access, env);
  if (!acc.ok) return { ok: false, access: "denied", reason: acc.reason, error: "acceso requerido" };
  if (!text || typeof text !== "string") return { ok: false, error: "sin texto" };
  const { provider, model } = _config(env);
  const userMessage = buildParseUserMessage(context, text);
  const { spec, usage } = await getAdapter(provider).parse(userMessage, { system: buildContractMenu(), tool: buildSpecTool(), model });
  return { ok: true, spec, usage };
}

// LLM #2 · output validado → narración · el number-guard corre en el CLIENTE (si falla → texto determinístico)
export async function handleNarrate({ text, evidence, access } = {}, env) {
  const acc = await _access(access, env);
  if (!acc.ok) return { ok: false, access: "denied", reason: acc.reason, error: "acceso requerido" };
  if (!text || typeof text !== "string") return { ok: false, error: "sin texto" };
  const { provider, narrateModel } = _config(env);
  const system = buildNarrateSystem(evidence);   // general vs simulación (evidence.transform) · provider-neutral
  const { text: narration, usage } = await getAdapter(provider).narrate({ text, evidence }, { model: narrateModel, system });
  return { ok: true, narration, usage };
}

// path → handler (para los wrappers que enrutan por URL)
export const GATEWAY_ROUTES = {
  "/api/adi-spec": handleSpec,
  "/api/adi-narrate": handleNarrate,
  "/api/adi-access": handleAccess,   // demo privada · status/check/mint (owner 2026-07-08)
};
