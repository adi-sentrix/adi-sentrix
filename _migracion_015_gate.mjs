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
import { CLASES_HECHO_EMPRESA, ORIGENES_HECHO_EMPRESA, ESTADOS_HECHO_EMPRESA, CAMPOS_PERFIL_DECLARABLES, esConceptoReservadoDePerfil } from "./src/adi/continuidad/empresa.js";
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
  /* la clase «perfil» vive acá desde el 2026-10-03 (owner, decisión 3 del bloque 2): el check SQL y la lista del código son LA MISMA, completa */
  ok(JSON.stringify([...clasesSql].sort()) === JSON.stringify([...CLASES_HECHO_EMPRESA].sort()) && clasesSql.includes("perfil"), `★ CARNADA · clases del SQL (${clasesSql.join("·")}) = CLASES_HECHO_EMPRESA (${CLASES_HECHO_EMPRESA.join("·")}), con «perfil» — si alguien cambia una lista sin la otra, esto arde`);

  const origenCheck = /check \(origen in \(([^)]+)\)\)/.exec(sql);
  const origenesSql = origenCheck ? origenCheck[1].split(",").map((s) => s.trim().replace(/'/g, "")) : [];
  ok(JSON.stringify(origenesSql) === JSON.stringify(ORIGENES_HECHO_EMPRESA), `★ CARNADA · orígenes del SQL (${origenesSql.join("·")}) = ORIGENES_HECHO_EMPRESA (${ORIGENES_HECHO_EMPRESA.join("·")})`);

  const estadoCheck = /check \(estado in \(([^)]+)\)\)/.exec(sql);
  const estadosSql = estadoCheck ? estadoCheck[1].split(",").map((s) => s.trim().replace(/'/g, "")) : [];
  ok(JSON.stringify(estadosSql) === JSON.stringify(ESTADOS_HECHO_EMPRESA), `★ CARNADA · estados del SQL (${estadosSql.join("·")}) = ESTADOS_HECHO_EMPRESA (${ESTADOS_HECHO_EMPRESA.join("·")})`);
}

/* ═══ 2b · LA CLASE «PERFIL» (owner 2026-10-03): el SQL y el código dicen LO MISMO de qué es un perfil y qué conceptos reserva ═══ */
H("2b · la clase «perfil»: los campos, el origen y los conceptos reservados del SQL = los de `empresa.js`; la función de aportar los valida; todo idempotente");
{
  const lista = (re) => { const m = re.exec(sql); return m ? m[1].split(",").map((s) => s.trim().replace(/'/g, "")) : null; };
  const camposSql = lista(/memoria_empresa_perfil_forma\s+check \(clase <> 'perfil' or \(concepto in \(([^)]+)\)/);
  ok(!!camposSql && JSON.stringify(camposSql) === JSON.stringify([...CAMPOS_PERFIL_DECLARABLES]), `★ CARNADA · los campos del check de forma (${(camposSql || []).join("·")}) = CAMPOS_PERFIL_DECLARABLES (${CAMPOS_PERFIL_DECLARABLES.join("·")})`);
  ok(/memoria_empresa_perfil_forma\s+check \(clase <> 'perfil' or \(concepto in \([^)]+\) and origen = 'declarado'\)\)/.test(sql), "el perfil es SIEMPRE «declarado» (nunca medido ni de documento)");
  const reservadosSql = lista(/memoria_empresa_perfil_reservado\s+check \(clase = 'perfil' or \(lower\(btrim\(concepto\)\) not in \(([^)]+)\)/);
  ok(!!reservadosSql && reservadosSql.every((c) => esConceptoReservadoDePerfil(c)) && reservadosSql.length === 6, `★ CARNADA · los conceptos reservados del SQL (${(reservadosSql || []).join("·")}) los reserva TODOS el código`);
  const delCodigo = ["sector", "tipoProducto", "tipo_producto", "modeloComercial", "modelo_comercial", "pais", "PAIS", "perfil:sector", "Perfil:Pais"];
  ok(delCodigo.every((c) => esConceptoReservadoDePerfil(c)) && !esConceptoReservadoDePerfil("plazo_de_cobro") && !esConceptoReservadoDePerfil("sectorial"), "y el código no reserva de más ni de menos: los cuatro campos (también en snake_case y con otras mayúsculas) y el prefijo viejo; un concepto cualquiera no");
  ok(reservadosSql && ["sector", "tipoproducto", "tipo_producto", "modelocomercial", "modelo_comercial", "pais"].every((c) => reservadosSql.includes(c)) && /lower\(btrim\(concepto\)\) not like 'perfil:%'/.test(sql), "el SQL reserva los cuatro campos (en minúscula, snake_case incluido) y el prefijo viejo `perfil:`");
  // la función de aportar valida lo mismo que los checks (con mensaje), y admite la omisión sin valor
  const fAportar = /create or replace function public\.adi_aportar_hecho_empresa[\s\S]*?\n\$\$;/.exec(sql);
  const cuerpo = fAportar ? fAportar[0] : "";
  ok(/p_clase not in \('criterio', 'hecho', 'documento', 'perfil'\)/.test(cuerpo) && /if p_clase = 'perfil' then/.test(cuerpo) && /not in \('sector', 'tipoProducto', 'modeloComercial', 'pais'\)/.test(cuerpo) && /p_origen <> 'declarado'/.test(cuerpo) && /p_estado is distinct from 'omitido'/.test(cuerpo), "`adi_aportar_hecho_empresa` admite la clase «perfil» y la valida: campo conocido, origen «declarado», código en valor.texto (la omisión no lo lleva)");
  ok(/lower\(trim\(p_concepto\)\) like 'perfil:%'/.test(cuerpo) && /es de perfil: el perfil de la empresa se declara con la clase «perfil»/.test(cuerpo), "y rechaza un criterio/hecho/documento con un concepto de perfil, diciendo cómo se declara");
  // confirmar/retirar/leer NO filtran ni validan por clase: lo que vale para un criterio vale para un perfil (se confirma, se retira, se lee)
  const resto = sql.slice(sql.indexOf("create or replace function public.adi_confirmar_hecho_empresa"), sql.indexOf("-- 3 · EL LIBRO DE CONVERSACIÓN"));
  ok(resto.length > 500 && !/\bclase\b/.test(resto.replace(/--[^\n]*/g, "")), "confirmar · retirar · leer no filtran ni validan por clase (un perfil se confirma, se retira y se lee como cualquier otra fila)");
  // idempotencia: cada constraint se suelta antes de agregarse; el check de clase lleva nombre para poder reemplazarse
  ok(["memoria_empresa_clase_check", "memoria_empresa_perfil_forma", "memoria_empresa_perfil_reservado"].every((n) => new RegExp(`drop constraint if exists ${n};\\s*\\n\\s*alter table public\\.memoria_empresa add constraint ${n}`).test(sql)), "★ idempotente: cada constraint de la clase «perfil» se suelta (if exists) antes de agregarse — correr la 015 dos veces es inocuo, y una base con el check viejo se actualiza");
  // la 015 es la ÚNICA migración que se tocó: ninguna otra menciona la clase «perfil» de memoria_empresa
  const otras = ["012_perfil_empresa.sql", "013_perfil_taxonomia_siembra.sql", "009_conversaciones.sql"].map((f) => readFileSync(new URL(`./db/migraciones/${f}`, import.meta.url), "utf8"));
  ok(otras.every((t) => !/memoria_empresa/.test(t)), "ninguna migración anterior menciona `memoria_empresa`: la clase se amplió solo en la 015");
}

/* ═══ 3 · EL TOPE DE 16KB del libro — el mismo número en el código y en el `check` de la base ═══ */
H("3 · el tope de `conversaciones.estado` es el MISMO que `libro.js:LIBRO_TOPE_BYTES`");
{
  ok(sql.includes(`pg_column_size(estado) <= ${LIBRO_TOPE_BYTES}`) || sql.includes("pg_column_size(estado) <= 16384"), `el check SQL usa ${LIBRO_TOPE_BYTES} — el MISMO literal que LIBRO_TOPE_BYTES`);
  ok(LIBRO_TOPE_BYTES === 16384, "el literal del módulo JS es 16384 (si cambia sin tocar el SQL, este candado arde)");
  ok(sql.includes("16384") && sql.match(/16384/g).length >= 2, "el número aparece más de una vez (el check de la tabla y la función de guardado — la doble validación del diseño, como 007)");
}

/* ═══ 4 · EL PERFIL — CORRECCIÓN DEL SUPERVISOR (2026-09-26, segunda ronda): CADA campo admite UN SOLO origen ═══
 * sector/tipo_producto/país/modelo_comercial: SOLO 'declarado' (la empresa los declara, ADI nunca los mide ni
 * los deriva). tamano_banda: SOLO 'derivado' (bandaTamano.js la calcula siempre, nunca se pregunta). Ninguno
 * de los cinco admite ya `'medido'` ni una combinación — la primera versión de esta migración (candado
 * anterior) solo AGREGABA 'declarado' dejando medido/derivado también admitidos; el supervisor cerró esa
 * puerta igual que ya se había cerrado para la moneda. */
H("4 · sector/tipo_producto/país/modelo_comercial admiten SOLO 'declarado'; tamano_banda SOLO 'derivado'");
{
  for (const campo of ["sector_procedencia", "tipo_producto_procedencia", "pais_procedencia", "modelo_comercial_procedencia"]) {
    ok(new RegExp(`check \\(${campo} is null or ${campo} = 'declarado'\\)`).test(sql), `«${campo}» admite ÚNICAMENTE 'declarado'`);
    ok(!new RegExp(`${campo} in \\(`).test(sql), `★ CARNADA · «${campo}» ya no es un \`in (...)\` con varias palabras — es una sola procedencia`);
  }
  ok(/check \(tamano_banda_procedencia is null or tamano_banda_procedencia = 'derivado'\)/.test(sql), "«tamano_banda_procedencia» admite ÚNICAMENTE 'derivado'");
  ok(!/tamano_banda_procedencia in \(/.test(sql), "★ CARNADA · «tamano_banda_procedencia» ya no es un `in (...)` con varias palabras");

  // migración de datos: sector/tipo_producto/país/modelo_comercial → 'declarado'; banda → limpiada, NUNCA relabeled
  for (const campo of ["sector_procedencia", "tipo_producto_procedencia", "pais_procedencia", "modelo_comercial_procedencia"]) {
    ok(new RegExp(`update public\\.tenants set ${campo}\\s*= 'declarado' where ${campo}\\s*= 'medido'`).test(sql), `★ la migración de datos de «${campo}»: todo 'medido' pasa a 'declarado'`);
  }
  ok(/update public\.tenants set tamano_banda_codigo = null, tamano_banda_procedencia = null where tamano_banda_procedencia = 'medido'/.test(sql), "★ la banda con el legado 'medido' se LIMPIA (código y procedencia a null) — nunca se relabela como 'derivado'");
  ok(!/tamano_banda_procedencia = 'derivado' where tamano_banda_procedencia = 'medido'/.test(sql), "★ CARNADA · ningún relabel directo de la banda de 'medido' a 'derivado' (mentiría sobre el origen)");
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
  ok(/sector_procedencia in \('medido', 'derivado'\)/.test(sqlAnterior012), "la 012 (histórica, sin editar) seguía admitiendo medido·derivado — la 015 es la que restringe a un solo origen por campo");
}

/* ═══ 4c · `adi_declarar_perfil_empresa` decide el origen de LOS CINCO campos del perfil, no solo la moneda ═══ */
H("4c · la función redefinida escribe 'declarado' (4 campos) o 'derivado' (banda) sin confiar en el caller");
{
  for (const [param, columna] of [
    ["p_sector_codigo", "sector_procedencia"], ["p_tipo_producto_codigo", "tipo_producto_procedencia"],
    ["p_pais_codigo", "pais_procedencia"], ["p_modelo_comercial_codigo", "modelo_comercial_procedencia"],
  ]) {
    const re = new RegExp(`${columna}\\s*=\\s*case when ${param} is not null then 'declarado' else ${columna} end`);
    ok(re.test(sql), `«${columna}» = 'declarado' cuando llega «${param}» — no el valor que el caller pasó en \`p_*_procedencia\``);
  }
  ok(/tamano_banda_procedencia\s*=\s*case when p_tamano_banda_codigo is not null then 'derivado' else tamano_banda_procedencia end/.test(sql), "«tamano_banda_procedencia» = 'derivado' cuando llega un código — nunca 'declarado'");
  ok(sql.includes("ACEPTADOS PERO IGNORADOS"), "el archivo documenta que los parámetros `p_*_procedencia` siguen existiendo (no se rompe la firma que llama `persistirCarga.server.js`) pero ya no deciden el origen");

  // la 013 (histórica, sin editar) SÍ confiaba en el parámetro — para que quede claro qué corrige la 015
  ok(/sector_procedencia\s*=\s*coalesce\(p_sector_procedencia, sector_procedencia\)/.test(readFileSync(new URL("./db/migraciones/013_perfil_taxonomia_siembra.sql", import.meta.url), "utf8")), "la 013 (histórica, sin editar) todavía confiaba en `p_sector_procedencia` tal cual — la 015 es la que deja de confiar en el caller");
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
