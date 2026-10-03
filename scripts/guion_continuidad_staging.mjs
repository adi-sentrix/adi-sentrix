/* === scripts/guion_continuidad_staging.mjs · EL GUION DE ACEPTACIÓN CONTRA SUPABASE REAL DE STAGING (nivel 2) ═══
 * Etapa 2, bloque 1 (owner 2026-10-02). El MISMO guion que corre el candado `_guardado_durable_gate.mjs` contra un doble
 * (nivel 1, sin red), ahora contra la BASE REAL de staging, con un reinicio de proceso REAL:
 *   1. «ANTES» — este proceso llama a la PUERTA del Complemento (`capacidad/puerta.js`, `manejarPuerta`, con la memoria
 *      durable encendida) como lo haría un anfitrión: empresas A y B intercaladas turno a turno — conocerEmpresa ·
 *      consultar (Entrega E1) · aportarContexto (plazo de cobro declarado + un criterio sin confirmar) · confirmar el
 *      plazo · consultar (Entrega E2). Guarda el transcrito y las huellas (sha256) del libro y de la memoria de cada una.
 *   2. REINICIO REAL — lanza OTRO proceso de Node de este mismo archivo (`--fase=despues`): no comparte con el primero ni
 *      una variable ni un módulo. Lo único que sobrevive es la base.
 *   3. «DESPUÉS» — el proceso nuevo retoma A y B y vuelve a leer lo guardado.
 *   4. Imprime el transcrito de antes y después, lado a lado, con las huellas, y el veredicto de cada control: E1 y E2
 *      idénticas (cifras, ids, fecha y versión de carga), lo declarado intacto con su origen, y NADA de la otra empresa.
 *
 * ⚠️ ESTE SCRIPT SALE A LA RED Y ESCRIBE EN LA BASE (no gasta crédito de ningún modelo: no llama a ningún LLM). NO LO CORRE
 * NINGÚN GATE NI NINGÚN AGENTE: lo corre el owner, a mano, UNA VEZ aplicadas las migraciones 012-015 en STAGING (nunca en
 * producción). Por eso exige `--confirmo-staging` y muestra a qué proyecto va a hablar antes de tocar nada.
 *
 * QUÉ NECESITA (en el `.env` de la raíz o en el entorno; ninguna se imprime):
 *   SUPABASE_URL · SUPABASE_ANON_KEY · SUPABASE_JWT_SECRET   (las mismas tres de `verificar-supabase.mjs`, las de STAGING)
 * (`ADI_TOKEN_SECRET` NO hace falta: la puerta corre dentro de este script y firma sus propios códigos de acceso.)
 * Y dos empresas de staging con datos cargados (`tenants` + una versión activa): `demo` (sembrada con `node
 * scripts/sembrar-demo.mjs`) y una segunda (`node scripts/sembrar-demo.mjs prueba`). Si las dos traen el MISMO pack, las
 * cifras serán iguales y la no-mezcla se apoya en el nombre de cada empresa y en la marca única de cada dato declarado.
 *
 * CÓMO SE CORRE:
 *     node scripts/guion_continuidad_staging.mjs --confirmo-staging                       (empresas «demo» y «prueba»)
 *     node scripts/guion_continuidad_staging.mjs --confirmo-staging --empresas=demo,otra   (otras dos empresas de staging)
 * Sale con 0 si TODOS los controles pasan, con 1 si alguno falla, con 2 si falta algo antes de empezar.
 *
 * DEJA RASTRO, Y ESO ES CORRECTO: la memoria de empresa es append-only (no hay permiso de borrado). Al final imprime el SQL
 * para limpiar, desde el panel de Supabase, lo que esta corrida escribió. Cada corrida usa un `periodo` propio en sus
 * datos declarados, así que no se confunde con las anteriores. */
import { readFileSync, writeFileSync, mkdtempSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { manejarPuerta } from "../src/adi/capacidad/puerta.js";
import { crearClienteRest } from "../src/data/supabaseRest.js";
import { crearAlmacenSupabase } from "../src/adi/continuidad/almacenSupabase.js";
import { emitirPase } from "../src/data/paseTenant.js";
import { makeAccessCode } from "../src/adi/llm/accessToken.js";
import { faseAntes, faseDespues, compararAntesDespues, transcritoLadoALado, crearLlamadorPuerta, huella } from "./guion-continuidad.mjs";

// ── el entorno (el `.env` de la raíz; lo que ya esté en el entorno manda) ───────────────────────────────────────
try {
  for (const ln of readFileSync(".env", "utf8").split(/\r?\n/)) {
    const m = ln.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
} catch { /* sin .env: se usan las variables del entorno */ }

const arg = (n) => { const a = process.argv.find((x) => x.startsWith(`--${n}=`)); return a ? a.slice(n.length + 3) : null; };
const flag = (n) => process.argv.includes(`--${n}`);
const FASE = arg("fase") || "todo";
const IDS = (arg("empresas") || "demo,prueba").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
const CORRIDA = arg("corrida") || new Date().toISOString().replace(/[-:T.Z]/g, "").slice(0, 14);   // identifica ESTA corrida (el `periodo` de sus datos)

const { SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_JWT_SECRET } = process.env;
/* la puerta corre ACÁ ADENTRO y firma y verifica sus propios códigos de acceso: sirve cualquier secreto, el mismo en los dos
 * procesos. Si no hay `ADI_TOKEN_SECRET`, se deriva de la corrida (el hijo recibe `--corrida` y llega al mismo valor). */
const ADI_TOKEN_SECRET = process.env.ADI_TOKEN_SECRET || `guion-staging-${CORRIDA}`;
const faltan = ["SUPABASE_URL", "SUPABASE_ANON_KEY", "SUPABASE_JWT_SECRET"].filter((k) => !process.env[k]);
if (faltan.length) {
  console.log(`\n✗ faltan variables: ${faltan.join(" · ")}`);
  console.log("  Ponlas en el archivo `.env` de la raíz (está fuera de git) o en el entorno, y vuelve a correr.\n");
  process.exit(2);
}
if (IDS.length !== 2 || IDS[0] === IDS[1]) { console.log("\n✗ hacen falta DOS empresas distintas: --empresas=a,b\n"); process.exit(2); }
const proyecto = SUPABASE_URL.replace(/^https:\/\//, "").split(".")[0];

/* las dos empresas del guion: MISMAS entidades (Jumbo, Falabella), distinto dato declarado, marca única por corrida */
const EMPRESAS = IDS.map((id, i) => ({
  id, etiqueta: `ref-${id}-${CORRIDA}`, periodo: `guion-${CORRIDA}`, entidadE1: "Jumbo", entidadE2: "Falabella",
  plazoDias: i === 0 ? 45 : 60, benchmarkPct: i === 0 ? 28 : 31,
}));

const ENV_PUERTA = { ADI_COMPLEMENTO: "true", ADI_MEMORIA_DURABLE: "true", ADI_TOKEN_SECRET, SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_JWT_SECRET };

/* el llamador de la puerta con un código de acceso por empresa, y el lector de huellas con el MISMO adaptador de producción */
async function armar() {
  const codigos = {};
  for (const E of EMPRESAS) codigos[E.id] = (await makeAccessCode("Guion staging", 1, ADI_TOKEN_SECRET, Date.now(), E.id)).code;
  const llamar = crearLlamadorPuerta({ manejarPuerta, env: ENV_PUERTA, codigos });
  async function leerHuellas(empresaId, conversacionId) {
    const p = await emitirPase({ tenantId: empresaId, secreto: SUPABASE_JWT_SECRET });
    const store = crearAlmacenSupabase({ url: SUPABASE_URL, apikey: SUPABASE_ANON_KEY, pase: p.pase });
    return { libro: huella(await store.leerLibro(empresaId, conversacionId)), memoria: huella(await store.leerHechosEmpresa(empresaId)) };
  }
  return { llamar, leerHuellas };
}

// ═══ FASE «DESPUÉS» (el proceso nuevo) ═══════════════════════════════════════════════════════════════════════════
if (FASE === "despues") {
  const antes = JSON.parse(readFileSync(arg("antes"), "utf8"));
  const { llamar, leerHuellas } = await armar();
  const despues = await faseDespues({ llamar, empresas: EMPRESAS, antes, leerHuellas });
  writeFileSync(arg("salida"), JSON.stringify({ pid: process.pid, despues }));
  process.exit(0);
}

// ═══ FASE «TODO» (el orquestador) ════════════════════════════════════════════════════════════════════════════════
if (!flag("confirmo-staging")) {
  console.log(`\n⚠️  Este script ESCRIBE en la base de «${proyecto}» (memoria de empresa y conversaciones de ${IDS.join(" y ")}).`);
  console.log("   Tiene que ser STAGING, nunca producción, y con las migraciones 012-015 aplicadas.");
  console.log("   Si es staging, vuelve a correr con --confirmo-staging\n");
  process.exit(2);
}

console.log(`\n════ GUION DE CONTINUIDAD · staging «${proyecto}» · empresas ${IDS.join(" y ")} · corrida ${CORRIDA} ════`);

// ── precondiciones (solo lectura): la base responde, las dos empresas existen y la migración 015 está aplicada ──────
{
  const db = crearClienteRest({ url: SUPABASE_URL, apikey: SUPABASE_ANON_KEY });
  let atrasada = false;
  for (const E of EMPRESAS) {
    const p = await emitirPase({ tenantId: E.id, secreto: SUPABASE_JWT_SECRET });
    const t = await db.seleccionar("tenants", { pase: p.pase, columnas: "id,nombre" });
    if (!t.ok || !t.filas.length) { console.log(`✗ la empresa «${E.id}» no existe en la base (${t.motivo || "sin filas"}).`); process.exit(2); }
    const v = await db.llamarFuncion("adi_version_activa", {}, { pase: p.pase });
    if (!v.ok || !v.filas.length) { console.log(`✗ «${E.id}» no tiene una versión de datos activa. Se siembra con: node scripts/sembrar-demo.mjs ${E.id}`); process.exit(2); }
    const m = await db.llamarFuncion("adi_leer_memoria_empresa", {}, { pase: p.pase });
    if (!m.ok) { atrasada = true; console.log(`✗ «${E.id}»: la memoria de empresa no responde (${m.motivo} ${m.detalle || ""}). ¿Está aplicada la migración 015?`); }
    else console.log(`  ✓ «${E.id}» existe (${t.filas[0].nombre}), tiene datos activos (versión ${v.filas[0].version}) y la memoria de empresa responde`);
  }
  if (atrasada) { console.log("\n  Se frena acá: sin la migración 015 la continuidad no puede ser durable. Pasos en el informe del bloque 1.\n"); process.exit(2); }
}

const dir = mkdtempSync(join(tmpdir(), "adi-guion-staging-"));
let codigoSalida = 1;
try {
  // ── 1 · ANTES ──────────────────────────────────────────────────────────────────────────────────────────────────
  console.log("\n1 · ANTES · el guion por la puerta, A y B intercaladas turno a turno");
  const { llamar, leerHuellas } = await armar();
  const antes = await faseAntes({ llamar, empresas: EMPRESAS, leerHuellas });
  for (const E of EMPRESAS) console.log(`  · ${E.id}: ${antes.porEmpresa[E.id].turnos.join(" → ")} (conversación ${antes.porEmpresa[E.id].conversacionId})`);
  console.log(`  ${llamar.llamadas()} llamadas por la puerta · E2 NO usa todavía lo declarado (eso es el bloque 3): el dato queda guardado con su origen`);

  // ── 2 · REINICIO REAL ──────────────────────────────────────────────────────────────────────────────────────────
  console.log("\n2 · REINICIO REAL · otro proceso de Node; solo sobrevive la base");
  const fAntes = join(dir, "antes.json"), fSalida = join(dir, "despues.json");
  writeFileSync(fAntes, JSON.stringify(antes));
  const hijo = spawnSync(process.execPath, [fileURLToPath(import.meta.url), "--fase=despues", `--empresas=${IDS.join(",")}`, `--corrida=${CORRIDA}`, `--antes=${fAntes}`, `--salida=${fSalida}`], { encoding: "utf8", timeout: 300000, stdio: ["ignore", "pipe", "pipe"] });
  if (hijo.status !== 0 || !existsSync(fSalida)) { console.log(`✗ el proceso nuevo falló (${hijo.status}): ${String(hijo.stderr || "").slice(0, 600)}`); process.exit(1); }
  const salida = JSON.parse(readFileSync(fSalida, "utf8"));
  console.log(`  proceso original pid ${process.pid} · proceso reiniciado pid ${salida.pid} ${salida.pid !== process.pid ? "(distintos ✓)" : "(¡el MISMO! ✗)"}`);

  // ── 3 · DESPUÉS + 4 · EL VEREDICTO ─────────────────────────────────────────────────────────────────────────────
  console.log("\n3 · ANTES y DESPUÉS, lado a lado");
  for (const l of transcritoLadoALado({ antes, despues: salida.despues, empresas: EMPRESAS })) console.log(l);
  const cmp = compararAntesDespues({ antes, despues: salida.despues, empresas: EMPRESAS });
  console.log("\n4 · LOS CONTROLES");
  for (const c of cmp.checks) console.log(`  ${c.ok ? "✓" : "✗"} ${c.label}${c.ok ? "" : `\n      ${String(c.detalle).slice(0, 300)}`}`);
  const mal = cmp.checks.filter((c) => !c.ok).length;
  const iguales = EMPRESAS.every((E) => antes.porEmpresa[E.id].e1.empresa === antes.porEmpresa[EMPRESAS[0].id].e1.empresa);
  if (iguales) console.log("\n  ⚠️ las dos empresas se llaman igual en el Marco: la no-mezcla se apoya SOLO en la marca única de cada dato declarado. Conviene que `tenants.nombre` sea distinto.");
  console.log(`\n── guion de continuidad en staging: ${cmp.checks.length - mal} OK · ${mal} FALLA (de ${cmp.checks.length}) · ${salida.pid !== process.pid ? "reinicio real" : "SIN reinicio real"} ──`);

  // ── el rastro ──────────────────────────────────────────────────────────────────────────────────────────────────
  const hilos = EMPRESAS.map((E) => `'${antes.porEmpresa[E.id].conversacionId}'`).join(", ");
  console.log("\nPara borrar el rastro de esta corrida, en el SQL Editor de Supabase (con el rol del panel, no con el pase):");
  console.log(`  delete from public.memoria_empresa where conversacion_id in (${hilos});`);
  console.log(`  delete from public.conversaciones where hilo_id in (${hilos});`);
  codigoSalida = mal === 0 && salida.pid !== process.pid ? 0 : 1;
} finally {
  rmSync(dir, { recursive: true, force: true });
}
process.exit(codigoSalida);
