/* === _probe_wrapper_narrate.mjs · El wrapper node de /api/adi-narrate-c invocado COMO LO INVOCA VERCEL:
 * (IncomingMessage, ServerResponse) vía un http.Server real. CERO llamadas a proveedor: el body {} no pasa
 * la puerta de acceso y el gateway responde {ok:false} ANTES de tocar cualquier adapter. Dos variantes:
 * body crudo por stream (Vercel sin parsear) y body pre-parseado (req.body objeto, como hace @vercel/node). */
import http from "http";
import handler from "./api/adi-narrate-c.js";

const server = http.createServer((req, res) => {
  if (req.headers["x-test-preparsed"] === "1") req.body = { op: "sonda" };   // emula el parseo de @vercel/node
  handler(req, res);
});
await new Promise((r) => server.listen(0, r));
const port = server.address().port;

for (const [nombre, opts] of [
  ["stream crudo", { headers: { "content-type": "application/json" }, body: "{}" }],
  ["body pre-parseado", { headers: { "content-type": "application/json", "x-test-preparsed": "1" }, body: "{}" }],
  ["GET (método inválido)", { method: "GET" }],
]) {
  const r = await fetch(`http://127.0.0.1:${port}/api/adi-narrate-c`, { method: opts.method || "POST", headers: opts.headers || {}, body: opts.body });
  const txt = await r.text();
  let json = null; try { json = JSON.parse(txt); } catch { /* no-json */ }
  const ok = json !== null && typeof json.ok === "boolean";
  console.log(`${ok ? "PASS" : "FAIL"} · ${nombre} → HTTP ${r.status} · ${txt.slice(0, 120)}`);
}
server.close();
