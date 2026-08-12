/* === api/version.js · Vercel serverless · METADATA DE DESPLIEGUE, NADA MÁS ============================
 *
 * POR QUÉ EXISTE (owner 2026-08-12): no había forma de saber qué commit corre en producción del lado server.
 * Comparar el bundle del navegador no alcanzaba por sí solo, y el panel de Vercel es una verificación manual.
 * Con esto, `curl https://app.adiai.cl/api/version` responde la pregunta en dos segundos y sin credenciales.
 *
 * QUÉ NO HACE, a propósito:
 *   · NO llama al proveedor. No importa `gatewayFetch` ni nada del gateway: no puede gastar un peso.
 *   · NO lee datos del cliente. Ni tenant, ni dato de negocio, ni nada del motor.
 *   · NO toca ADI, PLAN, prompts, guards ni Sentrix.
 *   · NO devuelve el SHA completo — sólo los 7 caracteres que se usan para identificar un commit.
 *
 * Sin `new Date()`: la hora de la request NO es la hora del despliegue, y publicarla como si lo fuera sería
 * exactamente el tipo de cifra que este proyecto no permite (un dato presentado como otro). `deploymentId`
 * identifica el despliegue de forma estable; la fecha real vive en el panel de Vercel, que es su fuente.
 *
 * Las cinco variables las inyecta Vercel sola: no hay que configurar nada.
 */
export const config = { runtime: "edge" };

const _env = (k) => {
  try { return (typeof process !== "undefined" && process.env && process.env[k]) || null; } catch { return null; }
};

export default function handler() {
  const sha = _env("VERCEL_GIT_COMMIT_SHA");
  return new Response(JSON.stringify({
    ok: true,
    service: "adi",
    commit: sha ? String(sha).slice(0, 7) : null,
    branch: _env("VERCEL_GIT_COMMIT_REF"),
    env: _env("VERCEL_ENV"),
    profile: _env("VITE_ADI_PROFILE") || "prod",
    deploymentId: _env("VERCEL_DEPLOYMENT_ID"),
  }), {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      // sin caché: una respuesta cacheada podría declarar el commit del despliegue ANTERIOR, que es justo
      // el engaño que este endpoint existe para evitar.
      "Cache-Control": "no-store, max-age=0",
    },
  });
}
