/* === scripts/clasificarGates.mjs · EL CLASIFICADOR, EN UN SOLO LUGAR (owner 2026-09-01) =====================
 *
 * POR QUÉ EXISTE ESTE ARCHIVO. Esta lógica vivía dentro de `gates-offline.mjs`, que es un script que CORRE la
 * suite al importarse — así que nadie más podía consultarla sin disparar 219 procesos. El candado que vigila
 * qué gates quedaron fuera de la corrida (`_gates_en_la_corrida_gate.mjs`) necesita exactamente esta
 * clasificación, y la única alternativa era copiarla: un SEGUNDO clasificador que puede divergir del primero
 * sin que nadie se entere. La regla de la casa vale también para esto — se comparte la fuente, no se duplica.
 *
 * AUTORIZACIÓN DEL OWNER, textual (2026-09-01): «Autorizo reorganizar el candado de consumo si es necesario,
 * siempre que no cambie su conducta: debe seguir impidiendo gasto accidental.»
 * SE MOVIÓ SIN CAMBIAR UNA COMA de la lógica: los mismos marcadores, los mismos dos escapes, el mismo orden y
 * las mismas condiciones — verificado archivo por archivo (277 gates, tipo Y motivo idénticos) contra la
 * clasificación vieja el día de la extracción. Desde entonces lo vigilan `_cerrojo_consumo_gate.mjs` y
 * `_gates_offline_gate.mjs`: leen ESTE texto, ejercitan ESTA función y muerden si un marcador desaparece o si
 * una mutación clasifica mal un LIVE como offline. `gates-offline.mjs` importa de acá y decide exactamente lo
 * mismo que decidía; el triple candado del runner (estático · de credencial · de runtime) queda intacto.
 *
 * ⚠️ ESTE ARCHIVO VIVE EN scripts/ Y NO SE ESCANEA (el clasificador solo lee `_*_gate.mjs` de la raíz): puede
 * nombrar sus propios marcadores sin condenarse. Un gate de la raíz NO puede — esa asimetría es deliberada. */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

// ── marcadores de red. Cada uno es una forma REAL de salir a internet desde un gate de este repo.
// `handlePlan`/`handleNarrateC` son funciones LOCALES del gateway, pero las dos terminan llamando al proveedor:
// mencionarlas es señal suficiente de que el gate es live. El candado de runtime igual las atraparía.
const LIVE = [
  [/\bfetch\s*\(/, "fetch("],
  [/\bhandlePlan\b/, "handlePlan"],
  [/\bhandleNarrateC\b/, "handleNarrateC"],
  [/\bhandleNarrate\b/, "handleNarrate"],
  [/gatewayCore/, "gatewayCore"],
  // CUALQUIER endpoint del gateway, no solo plan/narrate (owner 2026-08-09): antes esto decía `adi-(plan|narrate)`
  // y dejaba pasar como offline a los gates que tocan `/api/adi-spec` y `/api/adi-access` — y `adi-spec` es
  // exactamente la ruta por la que la UI pide una lectura al LLM. Ver el reporte del cerrojo.
  [/\/api\/adi-[a-z0-9-]+/i, "endpoint /api/adi-*"],
  [/\bgatewayFetch\b|\bdevGateway\b/, "gateway (gatewayFetch/devGateway)"],
  [/adiai\.cl|vercel\.app/, "dominio desplegado"],
  [/api\.openai\.com|OPENAI_API_KEY/, "proveedor/credencial (OpenAI)"],
  [/api\.anthropic\.com|ANTHROPIC_API_KEY|ANTHROPIC_AUTH_TOKEN/, "proveedor/credencial (Anthropic)"],
  [/\bopenaiAdapter\b|\banthropicAdapter\b|adapters\/(openai|anthropic)/, "adapter de proveedor"],
  [/node:https|node:http\b|require\(["']https?["']\)/, "cliente http crudo"],
  [/from\s+["'](node-fetch|axios|undici)["']|require\(["'](node-fetch|axios|undici)["']\)/, "cliente http de librería"],
  [/callPlan|callNarrate/, "callPlan/callNarrate (inyección del oráculo)"],
];

// NO es marcador: que un gate se autocargue el `.env`. 41 gates lo hacen y la mayoría son determinísticos —
// marcarlos LIVE perdería cobertura real sin ganar seguridad, porque el candado de runtime ya les sirve el `.env`
// sin credenciales y les rechaza la escritura. Se neutraliza, no se excluye.

/** clasificarFuente(src) → { tipo: "offline" } | { tipo: "live", motivo }
 *  La decisión sobre UN fuente, con las mismas condiciones y en el mismo orden que siempre tuvo el runner. */
export function clasificarFuente(src) {
  const hit = LIVE.find(([re]) => re.test(src));
  // INSPECCIÓN ESTÁTICA (owner 2026-08-10) · escape ESTRECHO y por archivo, nunca una relajación global del
  // clasificador. Un gate que LEE código fuente como texto (para certificar que el cableado existe) menciona
  // inevitablemente los símbolos del gateway y queda marcado LIVE — y un gate que no corre no certifica nada.
  // Las tres condiciones son acumulativas y se verifican acá, no se confía en la declaración:
  //   (a) declara el marcador en su cabecera,  (b) NO importa nada del gateway ni del adapter,
  //   (c) NO invoca a nadie: ni fetch, ni handlePlan/handleNarrateC, ni callPlan/callNarrate.
  // El candado de RUNTIME sigue aplicándose igual (--import offline-guard): si este escape se usara mal, el
  // proceso muere con exit 97 antes de tocar la red. Esto solo devuelve el gate a la suite; no lo desprotege.
  const declara = /@inspeccion-estatica/.test(src);
  const importaGateway = /^\s*import[^\n]*from\s+["'][^"']*(gatewayCore|providerAdapter|adapters\/)/m.test(src);
  const invoca = /\b(handlePlan|handleNarrateC|handleNarrate|callPlan|callNarrate)\s*\(/.test(src) || /\bfetch\s*\(/.test(src);
  if (hit && declara && !importaGateway && !invoca) return { tipo: "offline" };
  // ── INYECCIÓN SIMULADA (owner 2026-08-10, Contrato v1.2) · el SEGUNDO escape, con la misma disciplina ────────
  // EL PROBLEMA QUE CIERRA: `answerViaOracle` no sabe hablar con ningún proveedor — recibe las dos pasadas como
  // argumentos (`callPlan`/`callNarrate`). Un gate que se las pasa a mano ejercita el motor ENTERO sin abrir un
  // socket, pero nombra esos dos símbolos y queda LIVE. Resultado hasta hoy: ~20 gates de oráculo —los únicos que
  // miden el COSTO REAL de un turno y la memoria que ve el narrador— quedaban fuera de la suite y solo corrían a
  // mano. Un gate que hay que acordarse de correr no es una garantía.
  // CUATRO CONDICIONES ACUMULATIVAS, todas verificadas acá — la declaración nunca alcanza sola:
  //   (a) declara el marcador,
  //   (b) NO importa el gateway ni un adapter (los únicos módulos del repo que hablan con un proveedor),
  //   (c) NO contiene `fetch(` — ninguna salida cruda,
  //   (d) NO importa nada de `src/ui/` : ahí viven `_fetchPlanC`/`_fetchNarrateC`, las ÚNICAS implementaciones
  //       reales de esas dos funciones. Sin (d), un gate podría declarar el marcador y pasar las de producción.
  // Y el candado de RUNTIME se aplica igual: si este escape se usara mal, el proceso muere con exit 97 antes de
  // abrir el socket y el runner sale con exit 2 denunciando la clasificación. El scan clasifica; el candado
  // garantiza — la misma doctrina que el runner declara desde su cabecera.
  const declaraInyeccion = /@inyeccion-simulada/.test(src);
  const importaUI = /^\s*import[^\n]*from\s+["'][^"']*(src\/ui\/|\/ui\/[A-Za-z])/m.test(src);
  const salidaCruda = /\bfetch\s*\(/.test(src);
  if (hit && declaraInyeccion && !importaGateway && !importaUI && !salidaCruda) return { tipo: "offline" };
  if (hit) return { tipo: "live", motivo: hit[1] };
  return { tipo: "offline" };
}

/** clasificarGates(root) → { archivos, offline: [file], live: [{ file, motivo }] }
 *  Mismo recorrido que tenía `gates-offline.mjs`: todos los `_*_gate.mjs` de la raíz, ordenados; un archivo
 *  ilegible se trata como live («nunca correrlo a ciegas»), igual que siempre. */
export function clasificarGates(root) {
  const archivos = readdirSync(root).filter((f) => /^_.*_gate\.mjs$/.test(f)).sort();
  const offline = [], live = [];
  for (const f of archivos) {
    let src = "";
    try { src = readFileSync(join(root, f), "utf8"); } catch { /* ilegible → tratarlo como live, nunca correrlo a ciegas */ live.push({ file: f, motivo: "no se pudo leer" }); continue; }
    const c = clasificarFuente(src);
    if (c.tipo === "live") live.push({ file: f, motivo: c.motivo });
    else offline.push(f);
  }
  return { archivos, offline, live };
}
