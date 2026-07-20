/* === _ratelimit_gate.mjs · GATE del rate-limit de op:mint en gatewayFetch (auditoría · el MEDIO) ===
 * Prueba de abuso codificada: bruteforce de mint se frena en el borde; check/status quedan libres;
 * el mint legítimo del owner funciona bajo el límite. Corre contra gatewayFetch con Requests
 * sintéticos (x-forwarded-for) y env de fixture — NO toca red ni el motor. */
import { gatewayFetch } from "./src/adi/llm/gatewayFetch.js";

const ENV = { ADI_TOKEN_SECRET: "secret-de-gate-ratelimit", ADI_ADMIN_KEY: "clave-admin-gate-ratelimit-larga", ADI_MINT_ENABLED: "true" };
let pass = 0, fail = 0;
const ok = (name, cond) => { if (cond) { pass++; console.log("  ok  " + name); } else { fail++; console.log("  FAIL " + name); } };

// la IP CONFIABLE viaja en x-real-ip (lo que Vercel setea y ipAddress() lee) · xff = header spoofeable del cliente
const req = (op, ip, extra = {}, spoofXff = null) => {
  const h = { "content-type": "application/json" };
  if (ip) h["x-real-ip"] = ip;
  if (spoofXff) h["x-forwarded-for"] = spoofXff;   // basura que un atacante inyectaría
  return new Request("http://gate.local/api/adi-access", { method: "POST", headers: h, body: JSON.stringify({ op, ...extra }) });
};

// ── 1 · mint legítimo del owner bajo el límite: funciona ──
const legit = await gatewayFetch(req("mint", "10.0.0.1", { adminKey: ENV.ADI_ADMIN_KEY, name: "Owner Gate" }), ENV);
ok("mint legítimo bajo el límite → ok:true con código", legit.status === 200 && (await legit.json()).ok === true);

// ── 2 · bruteforce desde una IP: intentos 2..5 responden (auth falla), el 6º da 429 ──
let last;
for (let i = 2; i <= 5; i++) last = await gatewayFetch(req("mint", "10.0.0.1", { adminKey: "adivinanza-" + i, name: "x" }), ENV);
ok("intentos 2..5 de la misma IP aún NO limitados (responde la auth: sin autorización)", last.status === 200 && (await last.json()).ok === false);
const sexto = await gatewayFetch(req("mint", "10.0.0.1", { adminKey: ENV.ADI_ADMIN_KEY, name: "y" }), ENV);
ok("6º intento de la MISMA IP → 429 (incluso con clave correcta: el límite manda)", sexto.status === 429);
ok("429 trae retry-after", sexto.headers.get("retry-after") === "600");

// ── 3 · otra IP sigue con su propia ventana ──
const otraIp = await gatewayFetch(req("mint", "10.0.0.2", { adminKey: ENV.ADI_ADMIN_KEY, name: "Owner Gate 2" }), ENV);
ok("IP distinta no hereda el límite → mint ok", otraIp.status === 200 && (await otraIp.json()).ok === true);

// ── 4 · check y status NO pasan por el limitador (el flujo del invitado jamás se frena) ──
let libres = true;
for (let i = 0; i < 12; i++) {
  const r = await gatewayFetch(req("check", "10.0.0.1", { access: "ADI-invalido" }), ENV);
  if (r.status !== 200) libres = false;
}
const st = await gatewayFetch(req("status", "10.0.0.1"), ENV);
ok("12 checks + status desde la IP limitada → todos 200 (check/status libres)", libres && st.status === 200);

// ── 5 · techo GLOBAL del isolate: llenarlo con IPs distintas → 429 aunque la IP sea nueva ──
for (let i = 0; i < 40; i++) await gatewayFetch(req("mint", "10.9.9." + i, { adminKey: "z", name: "w" }), ENV);
const global = await gatewayFetch(req("mint", "10.250.250.250", { adminKey: ENV.ADI_ADMIN_KEY, name: "v" }), ENV);
ok("techo global alcanzado → 429 para IP nueva (anti-botnet barato)", global.status === 429);

// ── 6 · las otras rutas del gateway no se tocan (spec responde, sin limitador) ──
const spec = await gatewayFetch(new Request("http://gate.local/api/adi-spec", { method: "POST", headers: { "content-type": "application/json" }, body: "{}" }), ENV);
ok("/api/adi-spec intacta (fuera del alcance del limitador)", spec.status !== 429);

// ── 7 · IP CONFIABLE (owner): x-forwarded-for falsificado NO evade el límite — se keyea por x-real-ip ──
// misma x-real-ip (10.7.7.7), pero el atacante rota basura en x-forwarded-for cada golpe: igual lo frena
let ultimo;
for (let i = 1; i <= 6; i++) ultimo = await gatewayFetch(req("mint", "10.7.7.7", { adminKey: "no", name: "s" }, "1.2.3." + i + ", 9.9.9.9"), ENV);
ok("xff spoofeado NO evade → 6º golpe con misma x-real-ip da 429 (keyea por IP confiable, no por header)", ultimo.status === 429);
// y sin NINGUNA IP confiable (ni x-real-ip): no se limita — no castigar a todos bajo una clave común (evita auto-DoS)
let sinIp = true;
for (let i = 0; i < 8; i++) { const r = await gatewayFetch(req("mint", null, { adminKey: "no", name: "t" }), ENV); if (r.status === 429) sinIp = false; }
ok("sin x-real-ip confiable → NO se limita (no auto-DoS de todos bajo 'sin-ip')", sinIp);

console.log(`\n_ratelimit_gate: ${pass} ok · ${fail} fail`);
process.exit(fail ? 1 : 0);
