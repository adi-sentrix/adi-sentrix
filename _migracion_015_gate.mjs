/* === _migracion_015_gate.mjs · LA MIGRACIÓN 015 NO DIVERGE DEL CÓDIGO (Etapa 2 · Carril B) ══════════════════════
 * `db/migraciones/015_memoria_empresa_y_conversacion.sql` es un ARCHIVO, no un hecho en la base (no se aplicó
 * contra ningún proyecto de Supabase — igual que 012/013/014). Este candado lee el `.sql` como TEXTO y lo
 * compara contra las constantes de `src/adi/continuidad/{empresa,libro}.js` y contra lo que
 * `almacenSupabase.js` asume que existe — el MISMO mecanismo que `_entrega_gate.mjs` usa entre la migración 013
 * y `taxonomiaPerfil.js`, y que `_piso_materialidad_gate.mjs` usa entre la 014 y `pisoMaterialidadCobranza.js`:
 * un `.sql` no puede importar un `.js`, así que la sincronía se vigila comparando los dos TEXTOS.
 *
 * CERO llamadas a una base, cero red: solo lee el archivo `.sql` del disco y lo compara contra módulos ya
 * importados. Solo por `npm run gates:offline` (o `node --import ./scripts/offline-guard.mjs _migracion_015_gate.mjs`). */
import { readFileSync } from "node:fs";
import { CLASES_HECHO_EMPRESA, ORIGENES_HECHO_EMPRESA, ESTADOS_HECHO_EMPRESA } from "./src/adi/continuidad/empresa.js";
import { LIBRO_TOPE_BYTES } from "./src/adi/continuidad/libro.js";

let PASS = 0, FAIL = 0;
const ok = (c, m, extra = "") => { if (c) { PASS++; console.log("  ✓ " + m); } else { FAIL++; console.log("  ✗ " + m + (extra ? "\n      " + extra : "")); } };
const H = (t) => console.log(`\n${t}`);

const sql = readFileSync(new URL("./db/migraciones/015_memoria_empresa_y_conversacion.sql", import.meta.url), "utf8");
const sqlAnterior012 = readFileSync(new URL("./db/migraciones/012_perfil_empresa.sql", import.meta.url), "utf8");
const sql009 = readFileSync(new URL("./db/migraciones/009_conversaciones.sql", import.meta.url), "utf8");

/* ═══ 1 · «UN ARCHIVO, NO UN HECHO EN LA BASE» — la misma declaración que 012/013/014 ═══ */
H("1 · la migración se declara escrita y NO aplicada, como 012/013/014");
ok(/no se aplic[oó]|NO APLICADA|no tiene autorización de gasto ni de despliegue|un paso de despliegue que esta tarea no (?:tiene|ejecuta)/i.test(sql), "el archivo dice explícitamente que no está aplicada");
ok(/idempotente/i.test(sql), "se declara idempotente, como el resto de las migraciones");

/* ═══ 2 · `memoria_empresa` — el vocabulario coincide BYTE A BYTE con empresa.js ═══ */
H("2 · el check de `memoria_empresa` usa EXACTAMENTE el vocabulario de `continuidad/empresa.js`");
{
  const claseCheck = /check \(clase in \(([^)]+)\)\)/.exec(sql);
  ok(!!claseCheck, "el check de `clase` existe", sql.slice(0, 200));
  const clasesSql = claseCheck ? claseCheck[1].split(",").map((s) => s.trim().replace(/'/g, "")) : [];
  ok(JSON.stringify(clasesSql) === JSON.stringify(CLASES_HECHO_EMPRESA.filter((c) => c !== "perfil")), `★ CARNADA · clases del SQL (${clasesSql.join("·")}) = CLASES_HECHO_EMPRESA sin "perfil" (${CLASES_HECHO_EMPRESA.filter((c) => c !== "perfil").join("·")}) — si alguien cambia una lista sin la otra, esto arde`);

  const origenCheck = /check \(origen in \(([^)]+)\)\)/.exec(sql);
  const origenesSql = origenCheck ? origenCheck[1].split(",").map((s) => s.trim().replace(/'/g, "")) : [];
  ok(JSON.stringify(origenesSql) === JSON.stringify(ORIGENES_HECHO_EMPRESA), `★ CARNADA · orígenes del SQL (${origenesSql.join("·")}) = ORIGENES_HECHO_EMPRESA (${ORIGENES_HECHO_EMPRESA.join("·")})`);

  const estadoCheck = /check \(estado in \(([^)]+)\)\)/.exec(sql);
  const estadosSql = estadoCheck ? estadoCheck[1].split(",").map((s) => s.trim().replace(/'/g, "")) : [];
  ok(JSON.stringify(estadosSql) === JSON.stringify(ESTADOS_HECHO_EMPRESA), `★ CARNADA · estados del SQL (${estadosSql.join("·")}) = ESTADOS_HECHO_EMPRESA (${ESTADOS_HECHO_EMPRESA.join("·")})`);
}

/* ═══ 3 · EL TOPE DE 16KB del libro — el mismo número en el código y en el `check` de la base ═══ */
H("3 · el tope de `conversaciones.estado` es el MISMO que `libro.js:LIBRO_TOPE_BYTES`");
{
  ok(sql.includes(`pg_column_size(estado) <= ${LIBRO_TOPE_BYTES}`) || sql.includes("pg_column_size(estado) <= 16384"), `el check SQL usa ${LIBRO_TOPE_BYTES} — el MISMO literal que LIBRO_TOPE_BYTES`);
  ok(LIBRO_TOPE_BYTES === 16384, "el literal del módulo JS es 16384 (si cambia sin tocar el SQL, este candado arde)");
  ok(sql.includes("16384") && sql.match(/16384/g).length >= 2, "el número aparece más de una vez (el check de la tabla y la función de guardado — la doble validación del diseño, como 007)");
}

/* ═══ 4 · EL PERFIL — «declarado» se agrega a los CINCO checks de procedencia ═══ */
H("4 · `'declarado'` entra en los cinco checks de procedencia del perfil");
{
  const camposConDeclarado = ["sector_procedencia", "tipo_producto_procedencia", "pais_procedencia", "modelo_comercial_procedencia", "tamano_banda_procedencia"];
  for (const campo of camposConDeclarado) {
    const re = new RegExp(`check \\(${campo} is null or ${campo} in \\('medido', 'derivado', 'declarado'\\)\\)`);
    ok(re.test(sql), `«${campo}» admite ahora medido·derivado·declarado`);
  }
}

/* ═══ 4b · LA MONEDA — CORRECCIÓN DEL SUPERVISOR (2026-09-26): admite SOLO 'declarado', nunca 'medido'/'derivado' ═══ */
H("4b · `moneda_procedencia` pasa a admitir SOLO 'declarado' (nunca 'medido' ni 'derivado'); se migran los datos");
{
  ok(/check \(moneda_procedencia is null or moneda_procedencia = 'declarado'\)/.test(sql), "el check de `moneda_procedencia` admite ÚNICAMENTE 'declarado'");
  ok(!/check \(moneda_procedencia is null or moneda_procedencia = 'medido'\)/.test(sql), "★ CARNADA · el check viejo (SOLO 'medido') ya no está — se reemplazó, no se duplicó");
  ok(!/moneda_procedencia in \([^)]*'derivado'/.test(sql), "★ CARNADA · «derivado» NUNCA entra al check de `moneda_procedencia` — la moneda no se infiere, ni con la palabra corregida");
  ok(/update public\.tenants set moneda_procedencia = 'declarado' where moneda_procedencia = 'medido'/.test(sql), "★ la migración de DATOS existe: todo 'medido' persistido pasa a 'declarado', con su porqué en el comentario de al lado");
  ok(/moneda_procedencia\s*=\s*case when v_moneda is not null then 'declarado' else moneda_procedencia end/.test(sql), "`adi_declarar_perfil_empresa` (redefinida en la 015) escribe 'declarado' de ahora en más, no 'medido'");
  ok(/moneda_procedencia\s*=\s*case when v_moneda is not null then 'medido' else moneda_procedencia end/.test(sqlAnterior012), "la función de la 012 (histórica, sin editar) seguía escribiendo 'medido' — la 015 es la que la corrige, con `create or replace` (patrón de 013 sobre 012)");

  // los cinco checks de 012 admitían SOLO medido|derivado — se prueba que la 012 (sin tocar) sigue así, para que
  // quede claro que el cambio de vocabulario es responsabilidad de la 015 y no una edición retroactiva de la 012.
  ok(/sector_procedencia in \('medido', 'derivado'\)/.test(sqlAnterior012), "la 012 (histórica, sin editar) seguía admitiendo solo medido·derivado — la 015 es la que amplía");
}

/* ═══ 5 · LOS NOMBRES DE FUNCIÓN que `almacenSupabase.js` asume — existen en el SQL ═══ */
H("5 · las funciones RPC que `almacenSupabase.js` llama existen, con el nombre exacto, en la migración 015");
{
  const funciones = [
    "adi_aportar_hecho_empresa", "adi_confirmar_hecho_empresa", "adi_retirar_hecho_empresa",
    "adi_leer_memoria_empresa", "adi_leer_estado_conversacion", "adi_guardar_estado_conversacion",
  ];
  const fuenteAlmacen = readFileSync(new URL("./src/adi/continuidad/almacenSupabase.js", import.meta.url), "utf8");
  for (const f of funciones) {
    ok(new RegExp(`create or replace function public\\.${f}\\(`).test(sql), `«${f}» está declarada en la migración`);
    ok(fuenteAlmacen.includes(f), `«${f}» es exactamente la que llama \`almacenSupabase.js\` (sin alias, sin renombrar)`);
  }
}

/* ═══ 6 · LA TABLA NUEVA ES UNA SOLA (memoria_empresa) — NO se crea `libro_conversacion` ═══ */
H("6 · NO se crea una tabla `libro_conversacion` — el libro vive en `conversaciones.estado` (ley del owner 2026-09-26)");
ok(!/create table[^;]*libro_conversacion/i.test(sql), "★ CARNADA · ninguna tabla nueva llamada «libro_conversacion»");
ok(sql.includes("alter table public.conversaciones add column if not exists estado jsonb"), "el libro entra como COLUMNA nueva de `conversaciones` (009), no como tabla");
ok(sql009.includes("create table if not exists public.conversaciones"), "la tabla que se extiende es la MISMA que ya existe desde la 009 (no una homónima nueva)");

/* ═══ 7 · SEGURIDAD — RLS activado, escritura SOLO por funciones `security definer` (patrón 012/014) ═══ */
H("7 · `memoria_empresa` queda bajo RLS y su escritura pasa SOLO por funciones `security definer`");
ok(sql.includes("alter table public.memoria_empresa enable row level security"), "RLS activado en la tabla nueva");
ok(!/for insert[\s\S]{0,120}memoria_empresa/i.test(sql) && !/for update[\s\S]{0,120}memoria_empresa/i.test(sql), "sin política de INSERT/UPDATE directa: solo SELECT + funciones definer (como `tenants`, 012/014)");
for (const fnEscritura of ["adi_aportar_hecho_empresa", "adi_confirmar_hecho_empresa", "adi_retirar_hecho_empresa"]) {
  const bloque = new RegExp(`create or replace function public\\.${fnEscritura}\\([\\s\\S]{0,900}?security (invoker|definer)`).exec(sql);
  ok(!!bloque && bloque[1] === "definer", `«${fnEscritura}» es \`security definer\` (patrón de 012/014)`, bloque && bloque[0]);
}

console.log(`\n── _migracion_015_gate: ${PASS} PASS · ${FAIL} FAIL (de ${PASS + FAIL}) ──`);
if (FAIL > 0) process.exit(1);
