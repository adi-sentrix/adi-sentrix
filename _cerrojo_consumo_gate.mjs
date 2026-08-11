/* === _cerrojo_consumo_gate.mjs · EL CERROJO TÉCNICO ANTI-CONSUMO (owner 2026-08-09) ====================
 *
 * POR QUÉ EXISTE. Dos veces se gastaron créditos reales de OpenAI bajo una instrucción explícita que lo prohibía.
 * La segunda fue así: un subagente corrió `node _orden_sellado_gate.mjs` suelto creyéndolo offline. No lo es —
 * su sección 4 es un "SMOKE LLM REAL" de 8 corridas. El shell NO tenía credencial (se verificó en la propia
 * corrida) y aun así gastó, porque ese gate —y otros 40 de la raíz— se autocargan el `.env` del disco en su
 * primera línea. Orden del owner: «No vuelvas a confiar solamente en una instrucción para evitar consumo.
 * Impidelo técnicamente.»
 *
 * QUÉ SELLA ESTE GATE. Que el cerrojo siga puesto, medido CORRIENDO PROCESOS, no leyendo archivos:
 *   1 · el barrido de credenciales del runner deja el entorno limpio y no se lleva puesto lo que no es credencial
 *   2 · el hijo real que spawnea el runner NO ve ninguna credencial — ni él ni su propio hijo
 *   3 · la re-hidratación desde `.env` (el mecanismo exacto del incidente) queda muerta por los dos caminos:
 *       la escritura a `process.env` se rechaza, y el `.env` del disco se sirve sin sus líneas de credencial
 *   4 · el bloqueo de red mata de verdad: 5 sondas que INTENTAN salir mueren con exit 97, y una sexta que primero
 *       intenta DESARMAR el candado no lo consigue y muere igual
 *   5 · el clasificador estático manda a LIVE todo lo que toca el gateway, incluidos los endpoints que antes se
 *       le escapaban, y el runner no los corre
 *   6 · relajar cualquiera de las piezas pone rojo este gate
 *
 * CADA AFIRMACIÓN TIENE SU CONTROL. Una prueba que no puede fallar no prueba nada: para el entorno y para la red
 * se corre además el caso SIN candado, que tiene que dar el resultado opuesto. El control de red va contra un
 * puerto cerrado de 127.0.0.1 — nunca contra un proveedor: este gate no hace ni una llamada pagable.
 *
 * NOTA DE FORMA. Este archivo NO puede escribir literales como el nombre de la credencial de OpenAI ni los
 * marcadores del clasificador: el propio runner lee este archivo y lo mandaría a LIVE, y entonces el gate no
 * correría nunca — el candado dejaría de estar vigilado justo por vigilarse. Por eso los nombres se importan de
 * `scripts/provider-keys.mjs` y los marcadores se arman por concatenación con `lit(...)`.
 */
import { spawnSync } from "node:child_process";
import { readFileSync, readdirSync, writeFileSync, mkdtempSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { pathToFileURL } from "node:url";
import {
  DECLARADAS_EN_REPO, limpiarEntorno, credencialesVisibles, esNombreDeCredencial, filtrarTextoDotenv,
} from "./scripts/provider-keys.mjs";

const ROOT = process.cwd();
const GUARD = pathToFileURL(join(ROOT, "scripts", "offline-guard.mjs")).href;
const PROBE = (n) => join(ROOT, "scripts", "probes", `${n}.mjs`);
const lit = (...p) => p.join("");            // ver NOTA DE FORMA en la cabecera

let pass = 0, fail = 0;
const ok = (cond, label, detalle) => { console.log(`  ${cond ? "✓" : "✗"} ${label}${cond || !detalle ? "" : `  → ${detalle}`}`); cond ? pass++ : fail++; };
const info = (t) => console.log(`    ${t}`);

// entorno ENVENENADO: todas las credenciales que el repo declara, más una que no nombra a ningún proveedor y solo
// se delata por la FORMA DEL VALOR (una credencial re-bautizada gastaría igual que una con el nombre canónico).
const VALOR_FALSO = "sk-CERROJO-FALSA-NO-SIRVE";
const NOMBRE_ANONIMO = "CREDENCIAL_SIN_NOMBRE_DE_PROVEEDOR";
const NOMBRES = [...DECLARADAS_EN_REPO, NOMBRE_ANONIMO];
const ENV_ENVENENADO = { ...process.env };
for (const n of DECLARADAS_EN_REPO) ENV_ENVENENADO[n] = VALOR_FALSO;
ENV_ENVENENADO[NOMBRE_ANONIMO] = "sk-proj-CERROJO-FALSA";

const correr = (args, { env = ENV_ENVENENADO, conCandado = true } = {}) =>
  spawnSync(process.execPath, conCandado ? ["--import", GUARD, ...args] : args, { cwd: ROOT, env, encoding: "utf8" });
const json = (r) => { try { return JSON.parse(String(r.stdout).trim().split(/\r?\n/).pop()); } catch { return null; } };

/* ══ 1 · EL BARRIDO · qué sale y, sobre todo, qué NO se lleva puesto ═══════════════════════════════════ */
console.log("── 1 · EL BARRIDO DE CREDENCIALES ──");
{
  const { env: limpio, barridas } = limpiarEntorno(ENV_ENVENENADO);
  for (const n of NOMBRES) ok(!(n in limpio), `barrida: ${n}`);
  ok(credencialesVisibles(limpio).length === 0, "el entorno limpio no deja NINGUNA credencial visible", credencialesVisibles(limpio).join(", "));
  ok(barridas.length >= NOMBRES.length, `el barrido reporta sus nombres (${barridas.length} variable(s))`);
  // el reporte del runner se imprime en consola: tiene que poder pegarse sin filtrar nada
  ok(barridas.every((n) => /^[A-Za-z_][A-Za-z0-9_]*$/.test(n)), "el reporte del barrido lista NOMBRES de variable, nunca valores", barridas.join(", "));

  // lo que NO es credencial tiene que sobrevivir: barrer de más rompe gates offline legítimos, y un candado que
  // rompe cosas termina desactivado. `LLM_PROVIDER`/`*_BASE_URL`/`LLM_TIMEOUT_MS` son configuración, no secretos.
  const CONFIG = { PATH: "x", LLM_PROVIDER: "openai", LLM_TIMEOUT_MS: "9000", LLM_MODEL_PARSE: "m", ADI_TENANT: "t", NODE_ENV: "test" };
  const sobreviven = limpiarEntorno({ ...CONFIG }).env;
  for (const k of Object.keys(CONFIG)) ok(sobreviven[k] === CONFIG[k], `sobrevive (no es credencial): ${k}`);
  ok(!esNombreDeCredencial("ANTHROPIC_BASE_URL"), "una URL base no se confunde con una credencial");
}

/* ══ 2 · EL HIJO REAL · lo que ve un proceso spawneado, medido en el proceso ═══════════════════════════ */
console.log("\n── 2 · EL ENTORNO DEL HIJO (proceso real, no simulación) ──");
{
  // CONTROL primero: sin candado y sin barrido, la sonda TIENE que ver todo. Si este control no ve nada, la
  // sonda está rota y todo lo que sigue sería un falso verde.
  const ctrl = json(correr([PROBE("env-visible"), ...NOMBRES], { conCandado: false }));
  ok(!!ctrl && ctrl.visibles.length === NOMBRES.length, `CONTROL · sin candado la sonda SÍ ve las ${NOMBRES.length} credenciales`, JSON.stringify(ctrl && ctrl.visibles));
  ok(!!ctrl && ctrl.nieto.length === NOMBRES.length, "CONTROL · y sin candado se propagan al nieto (así viajan a todos lados)");

  const bajo = json(correr([PROBE("env-visible"), ...NOMBRES]));
  ok(!!bajo && bajo.visibles.length === 0, "con el candado el hijo no ve NINGUNA credencial", JSON.stringify(bajo && bajo.visibles));
  ok(!!bajo && Object.values(bajo.directas).every((v) => v === false), "tampoco leyéndolas por nombre, una por una", JSON.stringify(bajo && bajo.directas));
  ok(!!bajo && bajo.nieto.length === 0, "ni las hereda el nieto", JSON.stringify(bajo && bajo.nieto));

  // el barrido del RUNNER se sostiene solo, sin el candado de runtime: son dos capas independientes
  const soloBarrido = json(correr([PROBE("env-visible"), ...NOMBRES], { env: limpiarEntorno(ENV_ENVENENADO).env, conCandado: false }));
  ok(!!soloBarrido && soloBarrido.visibles.length === 0, "el barrido del runner solo, sin candado, ya deja al hijo sin credenciales");
}

/* ══ 3 · LA RE-HIDRATACIÓN DESDE .env · el mecanismo exacto del incidente ══════════════════════════════ */
console.log("\n── 3 · LA RE-HIDRATACIÓN DESDE .env (lo que hacen 41 gates de la raíz en su primera línea) ──");
{
  const escr = json(correr([PROBE("env-escritura"), ...NOMBRES]));
  ok(!!escr && Object.values(escr.escritas).every((v) => v === false), "escribir una credencial en process.env NO deja nada escrito", JSON.stringify(escr && escr.escritas));
  ok(!!escr && escr.nieto.length === 0, "y lo escrito tampoco viaja al hijo");

  // el `.env` del disco: fixture propio (nunca se toca el del owner) con credenciales y con configuración
  const dir = mkdtempSync(join(tmpdir(), "cerrojo-"));
  const fixture = join(dir, ".env");
  writeFileSync(fixture, [
    "# fixture del cerrojo — valores falsos",
    ...DECLARADAS_EN_REPO.map((n) => `${n}=${VALOR_FALSO}`),
    `${NOMBRE_ANONIMO}=sk-proj-CERROJO-FALSA`,
    "LLM_PROVIDER=openai", "LLM_MODEL_PARSE=modelo-x", "VITE_ADI_PROFILE=demo",
  ].join("\n"), "utf8");

  const sinC = json(correr([PROBE("dotenv-lectura"), fixture], { conCandado: false }));
  ok(!!sinC && DECLARADAS_EN_REPO.every((n) => sinC.sync.includes(n)), "CONTROL · sin candado el .env entrega sus credenciales por los 3 caminos de lectura");

  const conC = json(correr([PROBE("dotenv-lectura"), fixture]));
  for (const via of ["sync", "buffer", "promesa"]) {
    ok(!!conC && !conC[via].some((n) => esNombreDeCredencial(n)), `con el candado, .env por ${via}: cero credenciales`, JSON.stringify(conC && conC[via]));
  }
  ok(!!conC && conC.sync.includes("LLM_PROVIDER") && conC.sync.includes("VITE_ADI_PROFILE"), "y la configuración del .env sigue llegando intacta (no se rompe el que la necesita)");
  const filtrado = filtrarTextoDotenv("# una nota\n\nLLM_PROVIDER=openai");
  ok(filtrado.includes("# una nota") && filtrado.includes("") && filtrado.includes("LLM_PROVIDER=openai"), "el filtro preserva comentarios, líneas en blanco y lo que no es credencial", JSON.stringify(filtrado));

  // el `.env` REAL del repo, servido bajo el candado: se comprueba por NOMBRE, nunca se imprime un valor.
  // EL ARCHIVO PUEDE NO EXISTIR, y eso NO es una falla: está gitignoreado, así que en un clon nuevo, en CI o en
  // un worktree no está. Desde 2026-08-11 el candado sirve un `.env` ausente como VACÍO (ver offline-guard.mjs),
  // y eso es exactamente lo que hay que certificar en ese caso: cero credenciales por ausencia, no por filtrado.
  // Afirmar «se sirve sin credenciales» contra un archivo que no existe medía el entorno, no el candado.
  const _hayEnv = existsSync(join(ROOT, ".env"));
  const real = json(correr([PROBE("dotenv-lectura"), join(ROOT, ".env")]));
  ok(!!real && !real.sync.some((n) => esNombreDeCredencial(n)),
    _hayEnv
      ? "el .env REAL del repo se sirve sin una sola credencial"
      : "sin .env en el disco, el candado lo sirve VACÍO y la lectura no trae ninguna credencial (clon nuevo / CI / worktree)",
    JSON.stringify(real && real.sync));
  info(`.env real bajo el candado entrega: ${real ? real.sync.join(", ") : "—"}`);
}

/* ══ 4 · EL BLOQUEO DE RED · probado saliendo, no leyendo ══════════════════════════════════════════════ */
console.log("\n── 4 · EL BLOQUEO DE RED (sondas que INTENTAN salir) ──");
{
  // CONTROL: la misma salida TCP contra un puerto cerrado de 127.0.0.1 — sin candado sale del proceso.
  const ctrl = correr([PROBE("control-localhost")], { conCandado: false });
  ok(ctrl.status !== 97 && /ESCAPE/.test(String(ctrl.stdout)), "CONTROL · sin candado la sonda SÍ sale del proceso (la prueba puede fallar)", `exit=${ctrl.status}`);
  const ctrlBajo = correr([PROBE("control-localhost")]);
  ok(ctrlBajo.status === 97, "y con el candado la MISMA sonda muere con exit 97", `exit=${ctrlBajo.status}`);

  for (const [sonda, via] of [["salida-fetch", "fetch"], ["salida-https", "https.request"], ["salida-http", "http.get"], ["salida-socket", "net.Socket.connect (con fetch pisado por un mock)"], ["salida-dns", "dns.lookup"]]) {
    const r = correr([PROBE(sonda)]);
    const destino = (String(r.stderr).match(/destino : (.+)/) || [])[1] || "";
    ok(r.status === 97 && !/ESCAPE/.test(String(r.stdout)), `muere con exit 97 al intentar salir por ${via}`, `exit=${r.status}`);
    if (destino) info(`${sonda} → bloqueado hacia ${destino.trim()}`);
  }

  // ¿se puede relajar? la sonda intenta desarmar el piso por asignación Y por defineProperty, y salir igual.
  const d = correr([PROBE("desarme")]);
  const linea = (String(d.stdout).match(/DESARME (.+)/) || [])[1] || "";
  const intentos = linea.split("|").map((s) => s.trim()).filter(Boolean);
  ok(intentos.length === 4 && intentos.every((i) => /BLOQUEADO/.test(i)), "los 4 intentos de DESARMAR el piso fallan", linea);
  ok(d.status === 97, "y aun habiéndolo intentado, la salida muere con exit 97", `exit=${d.status}`);
  info(linea);
}

/* ══ 5 · EL CLASIFICADOR · nada live se cuela a la corrida offline ═════════════════════════════════════ */
console.log("\n── 5 · EL CLASIFICADOR ESTÁTICO DEL RUNNER ──");
const RUNNER = readFileSync(join(ROOT, "scripts", "gates-offline.mjs"), "utf8");
{
  // marcadores exigidos, armados por concatenación (ver NOTA DE FORMA)
  const EXIGIDOS = [
    [lit("\\bfetch\\s*\\("), "fetch"],
    [lit("handle", "Plan"), "el plan del gateway"],
    [lit("handle", "Narrate"), "la narración del gateway"],
    [lit("gateway", "Core"), "el núcleo del gateway"],
    [lit("gateway", "Fetch"), "el handler del gateway"],
    [lit("/api/", "adi-"), "los endpoints del gateway"],
    // los marcadores viven como REGEX en el runner: el punto va escapado, así que se compara contra esa forma
    [lit("api\\.", "openai", "\\.com"), "el dominio del proveedor OpenAI"],
    [lit("api\\.", "anthropic", "\\.com"), "el dominio del proveedor Anthropic"],
    [lit("OPENAI", "_API_KEY"), "la credencial de OpenAI"],
    [lit("ANTHROPIC", "_API_KEY"), "la credencial de Anthropic"],
    [lit("adiai", "\\.cl"), "el dominio desplegado"],
    [lit("call", "Plan"), "la inyección del oráculo"],
  ];
  for (const [m, que] of EXIGIDOS) ok(RUNNER.includes(m), `el clasificador sigue marcando ${que}`);

  // el runner tiene que EXCLUIR lo live y CORRER lo offline con el candado y el entorno limpio
  ok(/--import/.test(RUNNER) && /offline-guard/.test(RUNNER), "los gates offline se corren con el candado precargado (--import)");
  ok(/spawn\([\s\S]{0,220}env:\s*ENV_LIMPIO/.test(RUNNER), "y se spawnean con el entorno LIMPIO, no con el heredado");
  ok(/limpiarEntorno/.test(RUNNER) && /provider-keys\.mjs/.test(RUNNER), "el barrido viene de la única fuente de verdad (provider-keys.mjs)");
  ok(/credencialesVisibles\(ENV_LIMPIO\)/.test(RUNNER) && /exit\(3\)/.test(RUNNER), "el runner COMPRUEBA su entorno limpio y aborta (exit 3) si quedó sucia");
  ok(!/for\s*\(const f of live\)[\s\S]{0,120}runOne/.test(RUNNER), "ningún gate LIVE se corre: la lista live solo se imprime");

  // clasificación independiente de los gates de la raíz, con los mismos marcadores
  const RE = [/\bfetch\s*\(/, new RegExp(lit("\\bhandle", "Plan\\b")), new RegExp(lit("\\bhandle", "Narrate")), new RegExp(lit("gateway", "(Core|Fetch)|dev", "Gateway")),
    new RegExp(lit("/api/", "adi-[a-z0-9-]+"), "i"), new RegExp(lit("adiai", "\\.cl|vercel\\.app")),
    new RegExp(lit("api\\.", "openai", "\\.com|", "OPENAI", "_API_KEY")), new RegExp(lit("api\\.", "anthropic", "\\.com|", "ANTHROPIC", "_API_KEY")),
    new RegExp(lit("\\b", "openai", "Adapter\\b|\\b", "anthropic", "Adapter\\b")), new RegExp(lit("node", ":https|", "node", ":http\\b")), new RegExp(lit("call", "Plan|call", "Narrate"))];
  const esLive = (src) => RE.some((re) => re.test(src));
  const gates = readdirSync(ROOT).filter((f) => /^_.*_gate\.mjs$/.test(f)).sort();

  const conEndpoint = gates.filter((f) => new RegExp(lit("/api/", "adi-[a-z0-9-]+"), "i").test(readFileSync(join(ROOT, f), "utf8")));
  const coladosEndpoint = conEndpoint.filter((f) => !esLive(readFileSync(join(ROOT, f), "utf8")));
  ok(coladosEndpoint.length === 0, `todo gate que menciona un endpoint del gateway queda LIVE (${conEndpoint.length} gate(s))`, coladosEndpoint.join(", "));
  info(`gates con endpoint del gateway: ${conEndpoint.join(", ") || "—"}`);

  // el gate que efectivamente gastó tiene que estar del lado LIVE, sí o sí
  const ELQUEGASTO = "_orden_sellado_gate.mjs";
  ok(esLive(readFileSync(join(ROOT, ELQUEGASTO), "utf8")), `${ELQUEGASTO} —el que gastó— clasifica LIVE`);

  const live = gates.filter((f) => esLive(readFileSync(join(ROOT, f), "utf8")));
  info(`clasificación independiente: ${gates.length} gates · ${gates.length - live.length} offline · ${live.length} live`);
}

/* ══ 6 · LA INTEGRIDAD DEL CANDADO · relajarlo tiene que doler ═════════════════════════════════════════ */
console.log("\n── 6 · INTEGRIDAD DEL CANDADO ──");
{
  const G = readFileSync(join(ROOT, "scripts", "offline-guard.mjs"), "utf8");
  ok(/writable:\s*false[\s\S]{0,40}configurable:\s*false/.test(G), "el piso de red se sella no-escribible y no-configurable");
  for (const [re, que] of [[/globalThis\.fetch\s*=/, "fetch"], [new RegExp(lit("node", ":http\\b")), "http"], [new RegExp(lit("node", ":https")), "https"], [/net\.Socket\.prototype/, "net.Socket.connect"], [new RegExp(lit("node", ":dns")), "dns"]])
    ok(re.test(G), `el candado sigue interceptando ${que}`);
  ok(/process\.exit\(97\)/.test(G), "sigue matando con exit 97 (el código que el runner cuenta como 'tocó la red')");
  ok(/process\.exit\(98\)/.test(G), "y aborta con exit 98 si detecta una credencial viva");
  ok(/Object\.defineProperty\(process,\s*["']env["']/.test(G) && /new Proxy/.test(G), "process.env queda detrás del Proxy que rechaza escribir credenciales");
  ok(/readFileSync/.test(G) && /filtrarTextoDotenv/.test(G), "y toda lectura de .env se sirve filtrada");

  const PKG = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8"));
  ok(/scripts\/gates-offline\.mjs/.test(PKG.scripts["gates:offline"] || ""), "`npm run gates:offline` sigue apuntando al runner con candado");
  ok(/scripts\/run-gates\.mjs/.test(PKG.scripts.gates || ""), "`npm run gates` sigue siendo el runner LIVE (el que cuesta) y no se confunde con el otro");
}

console.log(`\n── _cerrojo_consumo_gate: ${pass} PASS · ${fail} FAIL (de ${pass + fail}) ──`);
process.exit(fail ? 1 : 0);
