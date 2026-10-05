/* === scripts/medicion-anfitrion/cliente-api.mjs · LA LLAMADA AL MODELO ANFITRIÓN POR LA MESSAGES API (vía B) ════════
 * POR QUÉ UN CLIENTE PROPIO Y NO `adapters/anthropic.js` (decisión declarada al supervisor): el adaptador del repo, en su
 * modo libre (`agente()`), APLANA los resultados de herramientas a turnos de texto «[HERRAMIENTAS]» (decisión F2: «sin
 * pareo tool_use/tool_result nativo en la v1») y su `_call` no está exportada. Un anfitrión real recibe el pareo NATIVO
 * (`tool_use` ↔ `tool_result`), y medir con el texto aplanado sería medir OTRA cosa. Tocar `src/adi/llm/adapters/*`
 * habría exigido una `agenteNativo` nueva y la palabra del owner; este cliente hace lo mismo SIN tocarlo, con las mismas
 * convenciones del adaptador (endpoint, `anthropic-version`, `ANTHROPIC_BASE_URL`, credencial por entorno, timeout) y los
 * cerrojos del repo: `exigirContador` (sin sink no sale nada) y `abrirCorridaMedida`/`telemetry.emit` (cada llamada queda en
 * el JSONL de consumo). Si el owner prefiere que el pareo viva en el adaptador, es un diff aparte y espera su palabra.
 *
 * EL TOPE ES DE ESTE ARCHIVO: ANTES de cada intento (también de cada reintento) se calcula el PEOR caso de la llamada y se le
 * pregunta al contador; si pasaría el tope, la llamada NO se hace y se devuelve `{ parado:true, reasonCode:"tope_alcanzado" }`.
 * El transporte es inyectable (`transporte(url, init)`) para que el candado ejercite todo SIN red; el predeterminado es
 * `globalThis.fetch`, que bajo `gates:offline` está bloqueado.
 * Caché de prompt: `cache_control` en el system y en el último bloque del último mensaje (prefijo estable del hilo). */
import { sha256 } from "./instruccion.mjs";
import { peorCasoUsd } from "./contador.mjs";

const VERSION_API = "2023-06-01";
const _dormir = (ms) => new Promise((r) => setTimeout(r, ms));

/** cuerpoDeLaLlamada({ modelo, system, tools, messages, maxTokens, thinking }) → el cuerpo de la Messages API (puro, hasheable). */
export function cuerpoDeLaLlamada({ modelo, system, tools, messages, maxTokens = 4096, thinking = "off" }) {
  const msgs = JSON.parse(JSON.stringify(messages));
  const ultimo = msgs[msgs.length - 1];
  if (ultimo) {
    if (typeof ultimo.content === "string") ultimo.content = [{ type: "text", text: ultimo.content }];
    const b = ultimo.content[ultimo.content.length - 1];
    if (b) b.cache_control = { type: "ephemeral" };          // el prefijo del hilo (todo lo anterior) se lee de caché
  }
  const cuerpo = {
    model: modelo, max_tokens: maxTokens,
    system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }],
    tools, messages: msgs,
  };
  if (thinking === "off") cuerpo.thinking = { type: "disabled" };   // explícito, como el adaptador del repo: el default del proveedor no decide
  return cuerpo;
}

export function crearClienteApi({ modelo, env = {}, transporte = null, contador, exigir = null, telemetria = null, maxTokens = 4096, thinking = "off", maxReintentos = 3, esperar = _dormir, timeoutMs = 120000, base = null }) {
  if (!contador) throw new Error("cliente-api: falta el contador (sin contador no hay llamada)");
  const hacer = transporte || ((url, init) => globalThis.fetch(url, init));
  const raiz = String(base || env.ANTHROPIC_BASE_URL || "https://api.anthropic.com").replace(/\/+$/, "");
  const endpoint = `${raiz}/v1/messages`;
  let n = 0;

  const _cabeceras = () => {
    const h = { "content-type": "application/json", "anthropic-version": VERSION_API };
    if (env.ANTHROPIC_API_KEY) h["x-api-key"] = env.ANTHROPIC_API_KEY;
    if (env.ANTHROPIC_AUTH_TOKEN) h.authorization = `Bearer ${env.ANTHROPIC_AUTH_TOKEN}`;
    return h;
  };

  async function llamar({ system, tools, messages }) {
    const cuerpo = cuerpoDeLaLlamada({ modelo, system, tools, messages, maxTokens, thinking });
    const texto = JSON.stringify(cuerpo);
    const cuerpoHash = sha256(texto);
    const peor = peorCasoUsd({ modelo, caracteres: texto.length, maxTokens });
    for (let intento = 0; intento <= maxReintentos; intento++) {
      // ── LOS DOS CERROJOS, ANTES de que nada salga ────────────────────────────────────────────────────────
      if (exigir) { const ex = exigir(); if (!ex.ok) return { ok: false, parado: true, reasonCode: ex.reasonCode || "sin_contador", motivo: ex.mensaje || "sin contador" }; }
      const p = contador.antesDeLlamar(peor);
      if (!p.ok) return { ok: false, parado: true, reasonCode: p.reasonCode, motivo: p.motivo };

      n += 1;
      const t0 = Date.now();
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), timeoutMs);
      let res;
      try {
        res = await hacer(endpoint, { method: "POST", headers: _cabeceras(), body: texto, signal: ctrl.signal });
      } catch (e) {
        clearTimeout(timer);
        // salió y no volvió: pudo facturarse. Peor caso, declarado como sin conteo.
        contador.llamadaSinConteo({ modelo, peorCaso: peor });
        if (telemetria) telemetria({ proveedor: "anthropic", modelo, etapa: "agente", intento, resultado: "error", reasonCode: "network_error", latencia_ms: Date.now() - t0, consumo: "contado" });
        if (intento >= maxReintentos) return { ok: false, motivo: `sin respuesta del proveedor tras ${intento + 1} intentos: ${String(e && e.message).slice(0, 120)}`, cuerpoHash };
        await esperar(Math.min(30000, 2000 * 2 ** intento));
        continue;
      }
      clearTimeout(timer);
      if (!res.ok) {
        const status = res.status;
        const cuerpoError = String(await res.text()).slice(0, 300);
        if (telemetria) telemetria({ proveedor: "anthropic", modelo, etapa: "agente", intento, resultado: status === 429 ? "rate_limited" : "error", latencia_ms: Date.now() - t0, consumo: null });
        if ((status === 429 || status === 529 || status >= 500) && intento < maxReintentos) {
          const ra = Number(res.headers && typeof res.headers.get === "function" ? res.headers.get("retry-after") : 0);
          await esperar(ra > 0 ? ra * 1000 : Math.min(30000, 2000 * 2 ** intento));
          continue;                                              // una respuesta de error del proveedor no genera nada que cobrar
        }
        return { ok: false, motivo: `HTTP ${status}: ${cuerpoError}`, status, cuerpoHash };
      }
      let data;
      try { data = await res.json(); } catch (e) {
        contador.llamadaSinConteo({ modelo, peorCaso: peor });
        return { ok: false, motivo: `respuesta ilegible del proveedor: ${String(e && e.message).slice(0, 100)}`, cuerpoHash };
      }
      const uso = data && data.usage ? data.usage : null;
      const modeloEfectivo = (data && data.model) || modelo;
      const r = contador.despuesDeLlamar({ modelo: modeloEfectivo, uso, peorCaso: peor });
      if (telemetria) telemetria({
        proveedor: "anthropic", modelo: modeloEfectivo, etapa: "agente", intento, resultado: "ok", latencia_ms: Date.now() - t0,
        tokens_in: uso ? (Number(uso.input_tokens || 0) + Number(uso.cache_read_input_tokens || 0) + Number(uso.cache_creation_input_tokens || 0)) : null,
        tokens_in_cache: uso && typeof uso.cache_read_input_tokens === "number" ? uso.cache_read_input_tokens : null,
        tokens_out: uso ? uso.output_tokens : null, consumo: "contado",
      });
      return { ok: true, content: Array.isArray(data.content) ? data.content : [], stop_reason: data.stop_reason || null, uso, modeloEfectivo, costoUsd: r.usd, cuerpoHash };
    }
    return { ok: false, motivo: "sin respuesta" };
  }
  return { llamar, llamadas: () => n, endpoint };
}
