/* === scripts/sembrar-demo.mjs · EL DEMO ENTRA A LA BASE COMO UNA EMPRESA MÁS (vía 3 · paso 3.f) ========
 *
 * POR QUÉ NO SE DEJA EL DEMO COMO RESPALDO ESTÁTICO (decisión del owner, 2026-08-27): un solo camino de
 * código. Si el negocio de demostración se sirviera desde el registro compilado y los clientes desde la base,
 * el camino que van a usar los clientes **no se ejercería hasta el primer cliente** — y ahí es tarde para
 * descubrir que falla. Sembrándolo, cada vez que alguien abre el demo se está probando el camino real.
 *
 * ⚠️ NO USA LA LLAVE DE SERVICIO. Siembra con el pase corto del propio demo, como lo haría el producto: el
 * rol `adi_tenant` tiene permiso de insertar sus propias versiones. La llave que salta el muro no hace falta
 * ni para esto, y una llave que no se usa no se puede filtrar.
 *
 * ES IDEMPOTENTE: si el demo ya tiene una siembra activa con este mismo pack, no hace nada y lo dice.
 *
 * CÓMO SE CORRE:
 *     node scripts/sembrar-demo.mjs
 * Lee las tres variables del `.env` de la raíz o del entorno. Ninguna se imprime.
 */
import { readFileSync } from "node:fs";
import { crearClienteRest } from "../src/data/supabaseRest.js";
import { emitirPase } from "../src/data/paseTenant.js";
import { TENANT_DEMO } from "../src/data/tenants/demo.js";
import { PLANTILLA_VERSION } from "../src/config/contract/plantilla.js";

try {
  for (const ln of readFileSync(".env", "utf8").split(/\r?\n/)) {
    const m = ln.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
} catch { /* sin .env: se usan las variables del entorno */ }

const { SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_JWT_SECRET } = process.env;
const faltan = ["SUPABASE_URL", "SUPABASE_ANON_KEY", "SUPABASE_JWT_SECRET"].filter((k) => !process.env[k]);
if (faltan.length) {
  console.log(`\n✗ faltan variables: ${faltan.join(" · ")}\n`);
  process.exit(2);
}

const EMPRESA = TENANT_DEMO.id || "demo";
const MARCA = "siembra-demo";

const db = crearClienteRest({ url: SUPABASE_URL, apikey: SUPABASE_ANON_KEY });
const p = await emitirPase({ tenantId: EMPRESA, secreto: SUPABASE_JWT_SECRET, ttlSegundos: 600 });
if (!p.ok) { console.log(`\n✗ no se pudo emitir el pase: ${p.motivo}\n`); process.exit(1); }
const pase = p.pase;

const pesoKb = Math.round(JSON.stringify(TENANT_DEMO).length / 1024);
console.log(`\n════ SIEMBRA DEL DEMO · empresa «${EMPRESA}» · ${pesoKb} KB ════\n`);

// ── ¿la empresa existe? ───────────────────────────────────────────────────────────────────────────────
const emp = await db.seleccionar("tenants", { pase, columnas: "id,nombre" });
if (!emp.ok) { console.log(`✗ la base no respondió: ${emp.motivo}\n`); process.exit(1); }
if (!emp.filas.length) {
  console.log(`✗ la empresa «${EMPRESA}» no existe en la base. En el SQL Editor:`);
  console.log(`    insert into public.tenants (id, nombre) values ('${EMPRESA}', '${TENANT_DEMO.nombre || "Demo"}');\n`);
  process.exit(1);
}
console.log(`  ✓ la empresa existe: ${emp.filas[0].nombre}`);

/* ⚠️ COMPARAR EL CONTENIDO, NO EL TEXTO. `jsonb` **no preserva el orden de las claves**: las reordena al
 * guardarlas. Comparar con `JSON.stringify` da distinto aunque no falte ni sobre nada — la primera versión de
 * la comprobación del final decía «lo que volvió NO coincide» con el pack perfectamente intacto. El ORDEN de
 * los arreglos sí se preserva, que es lo que importa acá: los rankings y las series son arreglos.
 *
 * Se define ACÁ ARRIBA porque ahora la usan las dos cosas: decidir si hay que resembrar y comprobar el viaje
 * de ida y vuelta. */
const canonico = (x) => {
  if (Array.isArray(x)) return x.map(canonico);
  if (x && typeof x === "object") {
    return Object.keys(x).sort().reduce((o, k) => { o[k] = canonico(x[k]); return o; }, {});
  }
  return x;
};
const mismoPack = (a, b) => Boolean(a) && JSON.stringify(canonico(a)) === JSON.stringify(canonico(b));

// ── ¿ya está sembrada, y con ESTE pack? ───────────────────────────────────────────────────────────────
/* ⚠️ LA PREGUNTA NO ES «¿HAY UNA SIEMBRA?» SINO «¿ES LA DE HOY?», y la diferencia costó la vitrina pública.
 * Este script decidía por EXISTENCIA: encontraba la siembra del 27 de agosto, la reactivaba y anunciaba éxito.
 * Pero el demo del código había ganado `flujoComercial` después de esa fecha, así que el visitante sin código
 * veía «ADI Demo» correcto en todo… menos que la pestaña Flujo Comercial no existía para él. Sin un error, sin
 * un aviso: el script decía que todo estaba bien.
 *
 * Un demo que se queda atrás es peor que uno que falta, porque nadie lo va a mirar dos veces.
 *
 * Se busca la siembra esté activa o no —si solo se mirara la activa, encontrar el demo apagado llevaría a
 * duplicar el mismo pack versión tras versión— y se compara el CONTENIDO con el de hoy. */
const ya = await db.seleccionar("fact_pack_versions", {
  pase, columnas: "id,version,activa,pack",
  filtros: { tenant_id: `eq.${EMPRESA}`, plantilla_version: `eq.${MARCA}` }, orden: "version.desc", limite: 1,
});
if (ya.ok && ya.filas.length) {
  const f = ya.filas[0];
  if (!mismoPack(f.pack, TENANT_DEMO)) {
    const guardadas = Object.keys(f.pack || {});
    const nuevas = Object.keys(TENANT_DEMO).filter((k) => !guardadas.includes(k));
    console.log(`  · la siembra guardada (versión ${f.version}) es VIEJA: el demo del código cambió desde entonces`);
    if (nuevas.length) console.log(`      le faltan: ${nuevas.join(" · ")}`);
    console.log("  · se siembra una versión nueva en vez de reactivar la vieja");
    /* y se sigue de largo al bloque de sembrar: append-only, la vieja queda en el historial */
  } else if (f.activa === true) {
    console.log(`  ✓ ya estaba sembrada y activa con este mismo pack (versión ${f.version}): no se toca nada\n`);
    process.exit(0);
  } else {
    console.log(`  · la siembra existe (versión ${f.version}), es la de hoy y está apagada: se reactiva en vez de duplicarla`);
    const r = await db.llamarFuncion("adi_activar_version", { p_version_id: f.id }, { pase });
    if (!r.ok) { console.log(`  ✗ no se pudo reactivar: ${r.motivo} ${r.detalle || ""}\n`); process.exit(1); }
    console.log(`  ✓ reactivada · ahora es la versión de la que ADI habla\n`);
    process.exit(0);
  }
}

// ── sembrar ───────────────────────────────────────────────────────────────────────────────────────────
const ult = await db.seleccionar("fact_pack_versions", {
  pase, columnas: "version", filtros: { tenant_id: `eq.${EMPRESA}` }, orden: "version.desc", limite: 1,
});
const version = (ult.filas && ult.filas.length ? Number(ult.filas[0].version) : 0) + 1;

/* SIN `upload_id` Y SIN SELLO, y las dos ausencias son honestas: este pack no vino de un archivo que alguien
 * subió, así que no hay original que guardar ni observaciones de plausibilidad que asumir. Inventarle un
 * archivo de origen sería escribir en la base una historia que no ocurrió. */
const alta = await db.insertar("fact_pack_versions", {
  pase, devolver: true,
  filas: { tenant_id: EMPRESA, version, pack: TENANT_DEMO, sello: null, plantilla_version: MARCA, activa: false },
});
if (!alta.ok || !alta.filas.length) {
  console.log(`  ✗ no se pudo guardar: ${alta.motivo} ${alta.detalle || ""}\n`);
  process.exit(1);
}
console.log(`  ✓ pack guardado como versión ${version}`);

const act = await db.llamarFuncion("adi_activar_version", { p_version_id: alta.filas[0].id }, { pase });
if (!act.ok || !act.filas.length) {
  console.log(`  ✗ guardó pero no se pudo activar: ${act.motivo} ${act.detalle || ""}\n`);
  process.exit(1);
}
console.log(`  ✓ activada · ahora es la versión de la que ADI habla`);

// ── comprobación: lo que quedó guardado es lo que se mandó ─────────────────────────────────────────────
/* Usa la misma comparación por contenido de más arriba: `jsonb` reordena las claves al guardarlas, así que
 * medir el texto diría «no coincide» con el pack perfectamente intacto. */
const leido = await db.llamarFuncion("adi_version_activa", {}, { pase });
const vuelto = leido.ok && leido.filas.length ? leido.filas[0].pack : null;
const igual = mismoPack(vuelto, TENANT_DEMO);
console.log(igual
  ? `  ✓ y al leerlo de vuelta el contenido es idéntico: el viaje de ida y vuelta no pierde nada`
  : `  ✗ lo que volvió NO coincide con lo que se mandó — revisar antes de seguir`);

console.log("");
process.exit(igual ? 0 : 1);
