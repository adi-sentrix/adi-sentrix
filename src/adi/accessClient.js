/* === src/adi/accessClient.js · ACCESO DEMO · lado CLIENTE (storage + parse para UX) ===
 * El código vive en localStorage del navegador del invitado y viaja en el body de cada llamada al gateway.
 * El cliente NUNCA verifica (no tiene el secret) — solo parsea nombre/vencimiento para saludar y avisar.
 * Denegación del server → evento "adi-access-denied" → App muestra la pantalla de acceso. */
export { parseAccessCode } from "./llm/accessToken.js";

const KEY = "adi_access_v1";

export const getAccessCode = () => { try { return localStorage.getItem(KEY) || null; } catch { return null; } };
export const setAccessCode = (code) => { try { localStorage.setItem(KEY, String(code || "").trim()); } catch { /* storage bloqueado → pedirá el código cada vez */ } };
export const clearAccessCode = () => { try { localStorage.removeItem(KEY); } catch { /* idem */ } };
