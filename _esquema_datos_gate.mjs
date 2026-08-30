/* === _esquema_datos_gate.mjs · LO QUE LA BASE DECLARA, LEÍDO Y EXIGIDO (vía 3 · owner 2026-08-27) =======
 *
 * QUÉ VIGILA. El esquema de `db/migraciones/` es donde vive el aislamiento entre empresas. Un `create table`
 * agregado sin RLS, una política que diga `using (true)`, un `grant delete` de más o un `cascade` mal puesto
 * no rompen ninguna prueba y no se ven en una revisión rápida: simplemente apagan una garantía. Este candado
 * lee el SQL y exige las cinco propiedades que hacen que el diseño sea el diseño.
 *
 * POR QUÉ SE PUEDE PROBAR SIN BASE Y SIN CREDENCIALES: no se conecta a nada. El SQL es un texto declarativo y
 * lo que hay que garantizar de él se lee del texto. Cuando exista el proyecto, esto sigue valiendo igual.
 *
 * ⚠️ TODO CHEQUEO DE ACÁ SE PRUEBA CONTRA UNA COPIA MUTADA DEL SQL REAL (sección 8). Es la lección de la v1.3:
 * cuatro veces un chequeo mío dio verde estando ciego, y una de ellas hizo que el caso de control ni se
 * ejecutara. Un candado que no se demuestra capaz de ponerse rojo no está midiendo nada.
 *
 * OFFLINE · lee archivos y compara texto · no puede gastar. */
import { readFileSync } from "node:fs";
import { tenantLimpio } from "./src/adi/llm/accessToken.js";

let pass = 0, fail = 0;
const ok = (cond, label, detalle) => {
  if (cond) { pass++; console.log(`  ✓ ${label}`); }
  else { fail++; console.log(`  ✗ ${label}`); if (detalle) console.log(`      ${detalle}`); }
};

/* ⚠️ EL SQL SE LEE CON LOS SALTOS DE LÍNEA NORMALIZADOS, y esto no es cosmética: era la causa de un rojo.
 *
 * QUÉ PASABA. El repositorio guarda estos .sql con saltos de Unix, pero git los entrega con saltos de
 * Windows al sacarlos en Windows. Las CARNADAS de la sección 4 —las que sabotean una copia del SQL para
 * comprobar que la alarma suena— hacen ese sabotaje con un buscar-y-reemplazar de texto, y una de ellas
 * busca varias líneas seguidas. En Windows ese texto NO existe: el buscar-y-reemplazar no encontraba nada,
 * la copia salía idéntica a la original, no se le inyectaba ningún defecto, la alarma —con razón— no sonaba,
 * y la carnada se daba por fallada. El gate quedaba rojo en Windows y verde en Linux, por el mismo código.
 *
 * LO PELIGROSO NO ERA EL ROJO, ERA LO QUE ESCONDÍA: mientras esa carnada no dispara, nadie está comprobando
 * que el chequeo de políticas permisivas funcione. Un rojo permanente que todos aprenden a ignorar es peor
 * que no tenerlo, porque tapa al siguiente.
 *
 * POR QUÉ ACÁ Y NO EN LA CARNADA. Arreglar solo la que falla habría dejado la trampa armada para la próxima:
 * cualquier carnada nueva que busque dos líneas seguidas volvería a caer. Normalizando en la lectura, el
 * gate se comporta igual en las dos plataformas y el problema no puede volver. Los .sql en disco no se
 * tocan — esto solo cambia cómo los lee este gate. */
const _lf = (t) => t.replace(/\r\n/g, "\n");
const BASE = _lf(readFileSync("./db/migraciones/001_esquema_base.sql", "utf8"));
const STORAGE = _lf(readFileSync("./db/migraciones/002_storage_originales.sql", "utf8"));
const ACTIVAR = _lf(readFileSync("./db/migraciones/003_activar_version.sql", "utf8"));
const ACTOR = _lf(readFileSync("./db/migraciones/005_actor_y_roles.sql", "utf8"));

/* Las tablas que este frente declara. Escritas acá a mano A PROPÓSITO: si alguien agrega una tabla al SQL y
 * no la agrega a esta lista, la sección 1 lo caza. Descubrirlas del propio SQL haría que el candado aprobara
 * automáticamente cualquier tabla nueva, que es justo lo que no queremos. */
const TABLAS = ["tenants", "memberships", "uploads", "fact_pack_versions"];

/* La única que se acota por `id` en vez de `tenant_id`, porque ELLA es la empresa. La excepción se declara
 * acá y en un solo lugar; cualquier otra tabla sin `tenant_id` es un defecto. */
const ACOTADA_POR_ID = new Set(["tenants"]);

// ── lectores de SQL ────────────────────────────────────────────────────────────────────────────────────
function bloqueDeTabla(sql, nombre) {
  const i = sql.indexOf(`create table if not exists public.${nombre} (`);
  if (i < 0) return null;
  const j = sql.indexOf("\n);", i);
  return j < 0 ? null : sql.slice(i, j);
}

function politicasDe(sql, nombre) {
  const out = [];
  const re = new RegExp(`create policy\\s+(\\w+)\\s+on\\s+public\\.${nombre}\\b`, "g");
  let m;
  while ((m = re.exec(sql))) {
    const j = sql.indexOf(";", m.index);
    out.push({ nombre: m[1], cuerpo: sql.slice(m.index, j < 0 ? sql.length : j) });
  }
  return out;
}

/* Devuelve la lista de hallazgos. Es UNA FUNCIÓN PURA sobre el texto para que la sección 8 pueda correrla
 * contra copias mutadas y comprobar que cada chequeo sabe ponerse rojo. */
function revisar(base, storage) {
  const h = [];
  const anotar = (clave, cond, detalle) => h.push({ clave, ok: Boolean(cond), detalle });

  for (const t of TABLAS) {
    const bloque = bloqueDeTabla(base, t);
    anotar(`${t}:existe`, bloque);
    if (!bloque) continue;

    anotar(`${t}:acotada`,
      ACOTADA_POR_ID.has(t) ? /^\s*id\s+text\s+primary key/m.test(bloque) : /\btenant_id\b/.test(bloque));

    anotar(`${t}:rls`, new RegExp(`alter table public\\.${t}\\s+enable row level security`).test(base));
    anotar(`${t}:force`, new RegExp(`alter table public\\.${t}\\s+force\\s+row level security`).test(base));

    const pols = politicasDe(base, t);
    anotar(`${t}:tiene-politica`, pols.length > 0);
    for (const p of pols) {
      anotar(`${t}:politica-por-pase:${p.nombre}`, /adi\.tenant_actual\(\)/.test(p.cuerpo));
      anotar(`${t}:politica-sin-true:${p.nombre}`, !/\b(using|with check)\s*\(\s*true\s*\)/i.test(p.cuerpo));
    }

    // idempotencia: cada política se recrea, así que tiene que soltarse antes
    for (const p of pols) {
      anotar(`${t}:politica-idempotente:${p.nombre}`,
        new RegExp(`drop policy if exists\\s+${p.nombre}\\s+on public\\.${t}`).test(base));
    }
  }

  // ── la garantía de una sola versión activa ──
  anotar("una-sola-activa",
    /create unique index[\s\S]{0,80}on public\.fact_pack_versions\s*\(tenant_id\)\s*where activa/.test(base));

  // ── append-only: ningún permiso de borrado, en ninguna tabla ──
  const grants = base.match(/^grant\s+[^;]*;/gm) || [];
  anotar("sin-permiso-de-borrado", !grants.some((g) => /\bdelete\b/i.test(g)),
    grants.filter((g) => /\bdelete\b/i.test(g)).join(" · "));

  /* ⚠️ UNA POLÍTICA NO DA PERMISO: FILTRA EL QUE YA HAY. Esta comprobación nació de un defecto real — el
   * depósito de originales tenía sus dos políticas perfectas y el rol no podía ni tocar el esquema, así que
   * subir un archivo moría con «permission denied». Desde el SQL las dos cosas se ven igual de bien; la
   * diferencia solo aparece al ejecutarlo. Por eso ahora se exige que toda tabla con política tenga grant. */
  for (const t of TABLAS) {
    if (!politicasDe(base, t).length) continue;
    anotar(`${t}:con-permiso`, grants.some((g) => new RegExp(`\\bpublic\\.${t}\\b`).test(g)),
      "tiene política pero ningún grant: el rol no puede ni tocar la tabla");
  }

  // ── el pack sobrevive al archivo que lo produjo ──
  const fpv = bloqueDeTabla(base, "fact_pack_versions") || "";
  anotar("upload-no-arrastra-el-pack", /upload_id[\s\S]{0,120}on delete set null/.test(fpv));
  anotar("upload-nunca-cascade", !/upload_id[\s\S]{0,120}on delete cascade/.test(fpv));

  // ── compatibilidad hacia adelante: las columnas de persona nacen ahora, y NULAS ──
  for (const [t, col] of [["memberships", "user_id"], ["uploads", "subido_por"], ["fact_pack_versions", "creado_por"]]) {
    const b = bloqueDeTabla(base, t) || "";
    const linea = (b.split("\n").find((l) => new RegExp(`^\\s*${col}\\b`).test(l)) || "");
    anotar(`persona:${t}.${col}:existe`, Boolean(linea));
    anotar(`persona:${t}.${col}:nula`, Boolean(linea) && !/not null/i.test(linea), linea.trim());
  }

  // ── la falla cerrada del claim ──
  anotar("claim-falla-cerrada", /create or replace function adi\.tenant_actual\(\)[\s\S]*?exception when others then[\s\S]*?return null/.test(base));

  // ── idempotencia de tablas e índices ──
  const creaTablas = base.match(/^create table\s+(?!if not exists)/gm) || [];
  anotar("tablas-idempotentes", creaTablas.length === 0);
  const creaIndices = base.match(/^create (unique )?index\s+(?!if not exists)/gm) || [];
  anotar("indices-idempotentes", creaIndices.length === 0);

  // ── el depósito de originales ──
  anotar("bucket-privado", /insert into storage\.buckets[\s\S]{0,160}false\s*\)/.test(storage));
  anotar("bucket-por-pase", (storage.match(/adi\.tenant_actual\(\)/g) || []).length >= 2);
  anotar("bucket-sin-borrado", !/create policy[\s\S]{0,200}\bfor delete\b/.test(storage));

  /* El mismo defecto que arriba, en el depósito: acá es donde se manifestó primero. */
  anotar("storage:esquema-alcanzable", /grant\s+usage\s+on schema storage\s+to adi_tenant/i.test(storage),
    "sin `usage` sobre el esquema, la política del depósito no llega a evaluarse nunca");
  anotar("storage:objetos-con-permiso", /grant\s+select,\s*insert\s+on storage\.objects\s+to adi_tenant/i.test(storage));
  anotar("storage:sin-permiso-de-borrado",
    !(storage.match(/^grant\s+[^;]*;/gmi) || []).some((g) => /\bdelete\b/i.test(g)));

  // ── ninguna credencial, en ningún archivo ──
  for (const [nombre, txt] of [["001", base], ["002", storage]]) {
    anotar(`sin-credencial:${nombre}:jwt`, !/\beyJ[A-Za-z0-9_-]{10,}/.test(txt));
    anotar(`sin-credencial:${nombre}:cadena-larga`, !/['"][A-Za-z0-9+/_-]{40,}['"]/.test(txt));
    anotar(`sin-credencial:${nombre}:conexion`, !/postgres(ql)?:\/\/[^\s]*:[^\s]*@/.test(txt));
  }

  return h;
}

const rojos = (hs) => hs.filter((x) => !x.ok).map((x) => x.clave);

console.log("\n" + "=".repeat(100));
console.log("1 · EL SQL REAL · todo lo que el diseño promete tiene que estar escrito");
console.log("=".repeat(100));
{
  const h = revisar(BASE, STORAGE);
  const malos = h.filter((x) => !x.ok);
  for (const x of h.filter((x) => x.ok)) pass++;
  for (const x of malos) { fail++; console.log(`  ✗ ${x.clave}${x.detalle ? ` — ${x.detalle}` : ""}`); }
  console.log(`  ✓ ${h.length - malos.length} propiedades del esquema verificadas sobre el SQL real`);
}

console.log("\n" + "=".repeat(100));
console.log("2 · EL ALFABETO DEL ID · la base y la puerta tienen que hablar del mismo valor");
console.log("=".repeat(100));
{
  /* La empresa viaja firmada dentro del código de acceso y `tenantLimpio()` decide cuál es válida. Si el
   * `check` de la tabla admitiera algo distinto, habría ids que la puerta firma y la base rechaza —o peor,
   * al revés. Se comprueba ejerciendo los dos, no comparando dos textos de regex.
   *
   * ⚠️ SON DOS PROPIEDADES DISTINTAS Y HAY QUE MEDIRLAS POR SEPARADO, porque `tenantLimpio()` NORMALIZA antes
   * de validar (recorta y baja a minúsculas) y el `check` de la base se aplica al valor ya guardado. Comparar
   * el valor CRUDO contra el `check` compara dos cosas que nunca se encuentran: a la base llega la salida de
   * la puerta, no su entrada. */
  const m = BASE.match(/id\s+text primary key check \(id ~ '([^']+)'\)/);
  ok(Boolean(m), "el SQL declara el alfabeto del id de empresa");
  if (m) {
    const enLaBase = new RegExp(m[1]);

    /* 1 · LA QUE IMPORTA: todo lo que la puerta produce, la base lo acepta. Si esto se rompiera, habría
     * sesiones legítimamente firmadas cuya empresa no se puede ni guardar. */
    const entradas = ["demo", "empresa2", "mi-empresa_1", "  EMPRESA2  ", "MAYUS", "Con-Mayus_9"];
    const producidos = entradas.map(tenantLimpio).filter(Boolean);
    const rechazados = producidos.filter((v) => !enLaBase.test(v));
    ok(producidos.length === entradas.length && rechazados.length === 0,
      `los ${producidos.length} ids que la puerta produce entran en la base`,
      `la base rechaza: ${rechazados.join(" · ")}`);

    /* 2 · Y LA BASE NO ES MÁS LAXA: lo que la puerta jamás produciría, la base tampoco lo admite. Sin esto,
     * un id escrito a mano en la base podría existir sin que ninguna sesión pueda alcanzarlo nunca. */
    const imposibles = ["", "MAYUS", "  demo  ", "-empieza-guion", "a".repeat(40), "con espacio", "acentuadó", "punto.medio"];
    const coladas = imposibles.filter((c) => enLaBase.test(c));
    ok(coladas.length === 0,
      `los ${imposibles.length} valores que la puerta nunca produce tampoco entran en la base`,
      `se colaron: ${coladas.join(" · ")}`);
  }
}

console.log("\n" + "=".repeat(100));
console.log("3 · LAS FUNCIONES · el muro no se puede saltar por adentro");
console.log("=".repeat(100));
{
  /* ⚠️ EL CHEQUEO QUE IMPORTA ES EL DE `security definer`. Una función marcada así corre con los permisos de
   * QUIEN LA ESCRIBIÓ, no de quien la llama — y entonces RLS deja de aplicarse adentro. Sería una puerta al
   * costado del muro, abierta desde el propio esquema y sin que nada se vea distinto desde afuera. */
  const fns = ACTIVAR.match(/create or replace function public\.(\w+)/g) || [];
  ok(fns.length >= 2, `la migración declara ${fns.length} funciones`);

  ok(!/security\s+definer/i.test(ACTIVAR),
    "⚠️ ninguna función es `security definer`: RLS sigue aplicándose adentro");
  ok((ACTIVAR.match(/security\s+invoker/gi) || []).length >= 2,
    "…y las dos declaran `security invoker` explícitamente, en vez de confiar en el default");

  ok(!/create or replace function adi\.\w+\s*\([^)]*\)[\s\S]{0,200}returns table/.test(ACTIVAR),
    "viven en `public` y no en `adi`: PostgREST solo expone los esquemas configurados");

  for (const f of ["adi_activar_version", "adi_version_activa"]) {
    ok(new RegExp(`grant execute on function public\\.${f}\\(`).test(ACTIVAR), `\`${f}\` se le concede al rol del producto`);
  }

  /* Apagar la anterior TIENE que ir antes de encender la nueva: el índice único parcial rechaza el estado
   * intermedio con dos activas. Es un orden que la base impone, no una preferencia. */
  const apaga = ACTIVAR.indexOf("set activa = false");
  const enciende = ACTIVAR.indexOf("set activa = true");
  ok(apaga > 0 && enciende > apaga,
    "se apaga la anterior ANTES de encender la nueva: al revés, el índice de una sola activa lo rechaza");

  ok(/raise exception/.test(ACTIVAR),
    "una versión que el pase no alcanza termina en error, no en un silencio que parezca éxito");
  ok(/coalesce\(p_sello/.test(ACTIVAR),
    "activar sin sello no borra el que ya está guardado");
}

console.log("\n" + "=".repeat(100));
console.log("4 · CARNADA · cada chequeo tiene que poder ponerse rojo");
console.log("=".repeat(100));
{
  /* Se muta una COPIA del SQL real con el defecto exacto que el chequeo dice prevenir, y se exige que
   * aparezca esa clave entre los rojos. Sin esto, todo lo de arriba podría estar verde y ciego. */
  const carnadas = [
    ["uploads:rls", BASE.replace("alter table public.uploads            enable row level security;", ""), STORAGE,
      "una tabla sin RLS"],
    ["uploads:politica-sin-true:uploads_del_pase",
      BASE.replace("using      (tenant_id = adi.tenant_actual())\n  with check (tenant_id = adi.tenant_actual());\n\ncreate policy fact_pack_versions_del_pase",
        "using      (true)\n  with check (true);\n\ncreate policy fact_pack_versions_del_pase"), STORAGE,
      "una política que deja pasar todo"],
    ["una-sola-activa", BASE.replace(/create unique index if not exists fact_pack_una_sola_activa[\s\S]*?;/, ""), STORAGE,
      "sin el índice que impide dos versiones activas"],
    ["sin-permiso-de-borrado", BASE + "\ngrant delete on public.fact_pack_versions to adi_tenant;\n", STORAGE,
      "un permiso de borrado que rompe el append-only"],
    ["upload-nunca-cascade", BASE.replace("references public.uploads(id) on delete set null", "references public.uploads(id) on delete cascade"), STORAGE,
      "un cascade que borraría el pack junto con el archivo"],
    ["persona:memberships.user_id:nula", BASE.replace("  user_id     uuid,", "  user_id     uuid not null,"), STORAGE,
      "una columna de persona obligatoria hoy, que impediría sembrar sin cuentas"],
    ["claim-falla-cerrada", BASE.replace(/exception when others then\s*\n\s*return null;/, ""), STORAGE,
      "el claim sin falla cerrada"],
    ["sin-credencial:001:jwt", BASE + "\n-- eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9ejemplo\n", STORAGE,
      "una credencial pegada en el SQL"],
    ["bucket-privado", STORAGE ? BASE : BASE, STORAGE.replace("'adi-originales', false)", "'adi-originales', true)"),
      "el depósito de originales marcado como público"],
    /* ⚠️ LA CARNADA DEL DEFECTO REAL: es exactamente el SQL que corrió en la base y falló en vivo. */
    ["storage:esquema-alcanzable", BASE, STORAGE.replace(/grant\s+usage\s+on schema storage[^;]*;/i, ""),
      "una política de depósito sin permiso sobre el esquema — el defecto que la verificación en vivo encontró"],
    ["uploads:con-permiso", BASE.replace(/^grant select, insert, update on public\.uploads.*$/m, ""), STORAGE,
      "una tabla con política y sin ningún grant: cerradura sin llave"],
  ];

  for (const [clave, b, s, queSimula] of carnadas) {
    const r = rojos(revisar(b, s));
    ok(r.includes(clave), `se pone rojo ante ${queSimula}`, `esperaba «${clave}» entre los rojos; hubo: ${r.join(" · ") || "ninguno"}`);
  }

  /* Y el control que hace que la carnada signifique algo: el SQL real NO tiene ninguno de esos rojos. */
  ok(rojos(revisar(BASE, STORAGE)).length === 0, "…y el SQL real no dispara ninguno de ellos");
}

console.log("\n" + "=".repeat(100));
console.log("5 · EL ACTOR · quién hizo qué, antes de que existan las personas");
console.log("=".repeat(100));
{
  /* LA ORDEN DEL OWNER (2026-08-30): «que lo que se haga ahora no lo bloquee» cuando lleguen los usuarios
   * reales. La prueba no es que el campo exista —eso es fácil— sino que exista en las TRES acciones sensibles
   * y que NINGUNA sea obligatoria: si lo fueran, hoy no se podría guardar nada, porque no hay cuentas todavía.
   * Un esquema que exige lo que aún no existe no está preparado para el futuro: está roto en el presente. */
  const CAMPOS = [
    "subido_por_label", "subido_por_rol",
    "creado_por_label", "creado_por_rol",
    "activada_en", "activada_por", "activada_por_label", "activada_por_rol",
  ];
  for (const c of CAMPOS) {
    ok(new RegExp(`add column if not exists\\s+${c}\\b`).test(ACTOR), `se registra «${c}»`);
  }
  /* Los dos que ya venían del esquema base, para que la lista esté completa y no parezca que faltan. */
  ok(/^\s*subido_por\s+uuid/m.test(bloqueDeTabla(BASE, "uploads") || ""), "…y «subido_por», que ya venía del esquema base");
  ok(/^\s*creado_por\s+uuid/m.test(bloqueDeTabla(BASE, "fact_pack_versions") || ""), "…y «creado_por», ídem");

  ok(!/add column if not exists\s+\w+\s+\w+\s+not null/i.test(ACTOR),
    "⚠️ ninguna columna de actor es obligatoria: hoy no hay cuentas, y exigirla frenaría toda carga");

  /* ACTIVAR es la acción más sensible —decide de qué datos habla ADI para toda la empresa, y fija la moneda—
   * y era la ÚNICA sin rastro: la fila cambiaba de estado y no quedaba quién ni cuándo. */
  ok(/activada_en\s*=\s*now\(\)/.test(ACTOR),
    "⚠️ activar deja su marca de tiempo, y la pone la BASE — no el cliente, que podría mentirla");
  ok(/p_actor_id/.test(ACTOR) && /p_actor_label/.test(ACTOR) && /p_actor_rol/.test(ACTOR),
    "…y la función de activar recibe al actor completo");

  for (const r of ["owner", "admin", "editor", "viewer"]) {
    ok(new RegExp(`'${r}'`).test(ACTOR), `el rol «${r}» está declarado`);
  }
  ok(/alter column rol set default 'viewer'/.test(ACTOR),
    "⚠️ el rol por defecto es el MENOS privilegiado: uno otorgado por descuido no puede romper nada");
  ok(/check \(rol in \('owner', 'admin', 'editor', 'viewer'\)\)/.test(ACTOR),
    "…y el vocabulario viejo (admin/usuario) quedó reemplazado, no conviviendo");

  /* Carnada · estos chequeos tienen que poder ponerse rojos. */
  const sinCampo = ACTOR.replace("add column if not exists subido_por_label text;", "");
  ok(!/add column if not exists\s+subido_por_label\b/.test(sinCampo),
    "quitarle un campo de actor a la migración pondría rojo lo de arriba");
  const obligado = ACTOR.replace("add column if not exists subido_por_label text;",
    "add column if not exists subido_por_label text not null;");
  ok(/add column if not exists\s+\w+\s+\w+\s+not null/i.test(obligado),
    "…y volverlo obligatorio también");
}

console.log(`\n── _esquema_datos_gate: ${pass} PASS · ${fail} FAIL (de ${pass + fail}) ──`);
process.exit(fail === 0 ? 0 : 1);
