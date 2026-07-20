/* === src/adi/llm/accessToken.js · ACCESO DEMO · códigos firmados con vencimiento (sin base de datos) ===
 * El código de acceso ES el login de la demo privada: `ADI-{payload}.{firma}` donde payload = {n: nombre, e: vencimiento}
 * y la firma es HMAC-SHA256 con el secret del SERVER (ADI_TOKEN_SECRET). Stateless a propósito: no hay DB que
 * administrar — el código lleva su vencimiento adentro y la firma impide fabricarlo o estirarlo. Se emite cuando
 * alguien solicita la demo (3 días por default) y muere solo. Platform-neutral: Web Crypto (browser · edge · Node 18+).
 * El CLIENTE solo parsea (nombre/vencimiento para UX) — verificar SIEMPRE es del server (el secret jamás sale de ahí). */

const _te = new TextEncoder();

// base64url sin padding (btoa/atob existen en browser, edge y Node 16+)
const _b64u = (bytes) => btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const _b64uToStr = (s) => atob(s.replace(/-/g, "+").replace(/_/g, "/"));

async function _hmac(payloadB64u, secret) {
  const key = await globalThis.crypto.subtle.importKey("raw", _te.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await globalThis.crypto.subtle.sign("HMAC", key, _te.encode(payloadB64u));
  return _b64u(sig);
}

// Emite un código: nombre + horas de vigencia (default 72 = 3 días) → `ADI-{payload}.{firma}`
export async function makeAccessCode(name, hours = 72, secret, now = Date.now()) {
  if (!secret) throw new Error("makeAccessCode: falta el secret");
  const payload = _b64u(_te.encode(JSON.stringify({ n: String(name || "invitado").slice(0, 40), e: now + hours * 3600 * 1000 })));
  const sig = await _hmac(payload, secret);
  return { code: `ADI-${payload}.${sig}`, expiresAt: now + hours * 3600 * 1000 };
}

// Parse SIN verificar (para UX del cliente: saludo + "vence el …"). Nunca alcanza para entrar: el server verifica.
export function parseAccessCode(code) {
  try {
    const m = String(code || "").trim().match(/^ADI-([A-Za-z0-9_-]+)\.([A-Za-z0-9_-]+)$/);
    if (!m) return null;
    const p = JSON.parse(_b64uToStr(m[1]));
    if (!p || typeof p.e !== "number") return null;
    return { name: String(p.n || "invitado"), expiresAt: p.e };
  } catch { return null; }
}

// Verificación REAL (server-side): firma + vencimiento → {ok, name, expiresAt} | {ok:false, reason, …}
export async function verifyAccessCode(code, secret, now = Date.now()) {
  if (!secret) return { ok: false, reason: "invalid" };
  const m = String(code || "").trim().match(/^ADI-([A-Za-z0-9_-]+)\.([A-Za-z0-9_-]+)$/);
  if (!m) return { ok: false, reason: "invalid" };
  const expected = await _hmac(m[1], secret);
  if (!_ctEq(expected, m[2])) return { ok: false, reason: "invalid" };
  const parsed = parseAccessCode(code);
  if (!parsed) return { ok: false, reason: "invalid" };
  if (now > parsed.expiresAt) return { ok: false, reason: "expired", name: parsed.name, expiresAt: parsed.expiresAt };
  return { ok: true, name: parsed.name, expiresAt: parsed.expiresAt };
}

// Comparación en TIEMPO CONSTANTE (cierra el LOW de timing del audit): no corta al primer byte distinto.
// Exportada para reusar en la validación de la clave admin del gateway.
export function constantTimeEqual(a, b) {
  const A = _te.encode(String(a)), B = _te.encode(String(b));
  if (A.length !== B.length) return false;
  let d = 0;
  for (let i = 0; i < A.length; i++) d |= A[i] ^ B[i];
  return d === 0;
}
const _ctEq = constantTimeEqual;

// ── AUTORIZACIÓN TEMPORAL DE EMISIÓN (mint grant · owner 2026-07-20) ──────────────────────────────────────────────
// Firmado como los códigos, pero con prefijo MINT- y tipo "mint" → NO intercambiable con un código de acceso (ADI-).
// Habilita op:mint por una ventana corta (10 min) sin tocar variables de Vercel. Vive solo en memoria del cliente.
export async function makeMintGrant(secret, ttlMs = 10 * 60 * 1000, now = Date.now()) {
  if (!secret) throw new Error("makeMintGrant: falta el secret");
  const payload = _b64u(_te.encode(JSON.stringify({ t: "mint", exp: now + ttlMs })));
  const sig = await _hmac(payload, secret);
  return { grant: `MINT-${payload}.${sig}`, expiresAt: now + ttlMs };
}

export async function verifyMintGrant(grant, secret, now = Date.now()) {
  if (!secret) return { ok: false, reason: "invalid" };
  const m = String(grant || "").trim().match(/^MINT-([A-Za-z0-9_-]+)\.([A-Za-z0-9_-]+)$/);
  if (!m) return { ok: false, reason: "invalid" };
  const expected = await _hmac(m[1], secret);
  if (!_ctEq(expected, m[2])) return { ok: false, reason: "invalid" };       // firma
  let p; try { p = JSON.parse(_b64uToStr(m[1])); } catch { return { ok: false, reason: "invalid" }; }
  if (!p || p.t !== "mint") return { ok: false, reason: "invalid" };          // tipo: no confundible con código de acceso
  if (typeof p.exp !== "number" || now > p.exp) return { ok: false, reason: "expired" };
  return { ok: true, expiresAt: p.exp };
}
