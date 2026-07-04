# Despliegue de ADI — gateway LLM

ADI es un SPA (Vite/React) **+** un gateway LLM de 2 endpoints que corre **server-side** (la API key vive en el env del server, nunca en el bundle). El motor, el contrato y el number-guard corren en el **cliente**; el gateway sólo traduce texto→spec (LLM #1) y narra el output validado (LLM #2).

**Una sola lógica, tres wrappers.** La lógica vive en [`src/adi/llm/gatewayCore.js`](src/adi/llm/gatewayCore.js) (`handleSpec` / `handleNarrate`), expuesta como handler web-estándar en [`src/adi/llm/gatewayFetch.js`](src/adi/llm/gatewayFetch.js) (`Request → Response`). Cada entorno la envuelve:

| Entorno | Wrapper | Cómo |
|---|---|---|
| **Dev** | `devGateway.js` (plugin de Vite) | `npm run dev` (ya montado en `vite.config.js`) |
| **Prod · cualquier Node** | `server.js` | `npm run build && npm start` |
| **Serverless** | `gatewayFetch` directo | ver recetas abajo |

## Variables de entorno (server-side)

Copiá [`.env.example`](.env.example) → `.env` (dev, gitignoreado) o seteálas en el dashboard de la plataforma (prod):

```
LLM_PROVIDER=openai            # anthropic | openai
LLM_MODEL_PARSE=gpt-4o-mini
LLM_MODEL_NARRATE=gpt-4o-mini
OPENAI_API_KEY=...             # o ANTHROPIC_API_KEY, según el provider
PORT=8080                      # opcional (server.js)
```

> Con `ADI_LLM_ENABLED=false` (en `voiceFlags.js`) el cliente **ni llama** al gateway → demo determinística, sin key. El gateway sólo se ejerce con el flag ON.

## Receta A — Node host (Render / Railway / Fly / VPS / Docker)

```bash
npm ci
npm run build        # genera dist/
npm start            # server.js sirve dist/ + /api/adi-spec + /api/adi-narrate
```
Seteá las env vars en el panel del host. Listo. (Dockerfile: `CMD ["npm","start"]` + `EXPOSE 8080`.)

## Receta B — Vercel / Netlify (serverless functions)

**Ya incluido en el repo:** [`api/adi-spec.js`](api/adi-spec.js) + [`api/adi-narrate.js`](api/adi-narrate.js) (cada uno envuelve `gatewayFetch` en runtime `edge`) y [`vercel.json`](vercel.json) (framework `vite`). Vercel detecta el `api/` solo y sirve `dist/` estático. Conectá el repo, seteá las *Environment Variables* del proyecto (`LLM_PROVIDER`, `LLM_MODEL_PARSE`, `LLM_MODEL_NARRATE`, `OPENAI_API_KEY` · server-side, **NUNCA** `VITE_*`) y deploy → endpoints en `/api/adi-spec` y `/api/adi-narrate`. El wrapper es mínimo (idéntico en ambos):

```js
import { gatewayFetch } from "../src/adi/llm/gatewayFetch.js";
export const config = { runtime: "edge" };           // o nodejs
export default (request) => gatewayFetch(request);   // env → process.env / platform env
```
(idéntico para `api/adi-narrate.js`). La key va en las *Environment Variables* del proyecto.

## Receta C — Cloudflare Workers / Pages Functions

```js
import { gatewayFetch } from "./src/adi/llm/gatewayFetch.js";
export default { fetch: (request, env) => gatewayFetch(request, env) };
```
Cloudflare pasa `env` al handler (por eso `gatewayCore` acepta `env` inyectable). **Ojo:** los adapters leen la key de `process.env` → en Workers seteá un shim al inicio (`globalThis.process = { env }`) o mové la lectura de la key a `env`. El resto es idéntico.

## Reglas invariantes

- La **key nunca** viaja al cliente ni queda en el bundle (siempre env del server).
- El **motor sellado** no se toca (gates 16/0 · spec · struct · guard intactos).
- Si el gateway falla (sin key, timeout, JSON inválido) → `{ok:false}` → el cliente **degrada al piso determinístico** (nunca rompe).
- Reversible: sin gateway, ADI corre 100% determinístico.
