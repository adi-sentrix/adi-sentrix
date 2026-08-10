/* === scripts/provider-keys.mjs · UNA SOLA VERDAD sobre qué es una credencial de proveedor ==============
 * (owner 2026-08-09, "el cerrojo técnico anti-consumo")
 *
 * POR QUÉ EXISTE: dos veces se gastaron créditos reales bajo una instrucción explícita de no gastarlos. La orden
 * del owner tras la segunda: «No vuelvas a confiar solamente en una instrucción para evitar consumo. Impidelo
 * técnicamente.» Un proceso SIN credencial no puede gastar aunque su código lo intente. Este archivo define qué
 * cuenta como credencial, y lo define en UN SOLO LUGAR — el candado de runtime (offline-guard.mjs), el runner
 * (gates-offline.mjs) y el gate que los sella (_cerrojo_consumo_gate.mjs) leen todos de acá. Si la lista viviera
 * copiada en tres archivos, relajar uno pasaría inadvertido; acá relajarlo pone rojo al gate.
 *
 * EL CRITERIO (dos condiciones, no una):
 *   1. el NOMBRE nombra un proveedor conocido en alguno de sus segmentos separados por "_", y
 *   2. el NOMBRE termina/contiene una forma de credencial: API_KEY | _TOKEN | _SECRET | _KEY
 * Así `ANTHROPIC_BASE_URL` (no es credencial) y `LLM_TIMEOUT_MS` (no es credencial) SOBREVIVEN — barrer de más
 * rompería gates offline legítimos sin ganar nada, y un candado que rompe cosas termina desactivado.
 *
 * Y UNA TERCERA PUERTA, por si el nombre no delata: el VALOR con forma de secreto de proveedor (`sk-…`, `sk-ant-…`,
 * `AIza…`, `hf_…`) se barre venga en la variable que venga. El incidente vino por un nombre conocido, pero una
 * credencial re-bautizada gastaría igual.
 */

// Proveedores de LLM + los secretos propios del repo que autorizan el gateway desplegado (ADI_ADMIN_KEY /
// ADI_TOKEN_SECRET viven en api/adi-access.js y src/adi/llm/gatewayCore.js: con ellos se puede emitir contra el
// gateway, que SÍ tiene key server-side — es exactamente el camino que hizo falsa la creencia "no hay key local").
export const PROVEEDORES = new Set([
  "OPENAI", "ANTHROPIC", "CLAUDE", "GEMINI", "GOOGLE", "GENAI", "VERTEX", "PALM",
  "AZURE", "AWS", "BEDROCK", "MISTRAL", "COHERE", "GROQ", "TOGETHER", "DEEPSEEK",
  "PERPLEXITY", "PPLX", "HUGGINGFACE", "HF", "REPLICATE", "FIREWORKS", "OPENROUTER",
  "XAI", "GROK", "OLLAMA", "VOYAGE", "LLM", "GATEWAY", "COPILOT", "ADI",
]);

// formas de credencial en el nombre (el patrón que pidió el owner, más `_KEY` suelto)
const FORMA_CREDENCIAL = /(API_?KEY|_TOKEN$|_TOKEN_|_SECRET$|_SECRET_|_KEY$|_KEY_)/;

// nombres declarados EN EL REPO — encontrados barriendo `process.env.*` en api/, src/, server.js, vite.config.js,
// los `_*_gate.mjs` de la raíz y `.env`/`.env.example`. Van explícitos para que ninguno dependa de que la heurística
// los adivine.
export const DECLARADAS_EN_REPO = [
  "OPENAI_API_KEY",        // src/adi/llm/adapters/openai.js · .env · .env.example
  "ANTHROPIC_API_KEY",     // src/adi/llm/adapters/anthropic.js
  "ANTHROPIC_AUTH_TOKEN",  // src/adi/llm/adapters/anthropic.js
  "ADI_ADMIN_KEY",         // src/adi/llm/gatewayCore.js (autoriza emitir códigos)
  "ADI_TOKEN_SECRET",      // api/adi-access.js (firma los códigos HMAC)
  "COPILOT_GITHUB_TOKEN",
];

// valores con forma de secreto de proveedor — la puerta que no depende del nombre
const VALOR_SOSPECHOSO = /^(sk-|sk-ant-|sk-proj-|sk-or-|gsk_|xai-|AIza[0-9A-Za-z_-]{10,}|hf_|r8_|pplx-|csk-|ghp_|github_pat_)/;

/** ¿el NOMBRE de esta variable es una credencial de proveedor? */
export function esNombreDeCredencial(nombre) {
  const n = String(nombre || "").toUpperCase();
  if (!n) return false;
  if (DECLARADAS_EN_REPO.includes(n)) return true;
  if (!FORMA_CREDENCIAL.test(n)) return false;
  return n.split("_").some((seg) => PROVEEDORES.has(seg));
}

/** ¿el VALOR tiene forma de secreto de proveedor, se llame como se llame la variable? */
export function esValorDeCredencial(valor) {
  return typeof valor === "string" && VALOR_SOSPECHOSO.test(valor.trim());
}

/** ¿esta variable (nombre + valor) no debe llegar a un proceso offline? */
export const esCredencial = (nombre, valor) => esNombreDeCredencial(nombre) || esValorDeCredencial(valor);

/**
 * Copia del entorno SIN credenciales. Devuelve la copia y los NOMBRES barridos — nunca los valores, para que el
 * reporte del runner se pueda leer y pegar sin filtrar nada.
 */
export function limpiarEntorno(env = process.env) {
  const limpio = {}, barridas = [];
  for (const [k, v] of Object.entries(env)) {
    if (esCredencial(k, v)) barridas.push(k);
    else limpio[k] = v;
  }
  return { env: limpio, barridas: barridas.sort() };
}

/** Los nombres de credencial visibles en un entorno dado (0 = limpio). Lo usa el gate para probar el barrido. */
export const credencialesVisibles = (env = process.env) =>
  Object.keys(env).filter((k) => esCredencial(k, env[k])).sort();

/** Quita de un texto tipo `.env` toda línea cuya variable sea credencial. Preserva el resto tal cual. */
export function filtrarTextoDotenv(texto) {
  return String(texto)
    .split(/\r?\n/)
    .filter((linea) => {
      const m = linea.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
      if (!m) return true;                       // comentarios y líneas en blanco quedan
      const valor = m[2].trim().replace(/^["']|["']$/g, "");
      return !esCredencial(m[1], valor);
    })
    .join("\n");
}
