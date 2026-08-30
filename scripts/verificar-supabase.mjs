/* === scripts/verificar-supabase.mjs · LA PRUEBA EN VIVO CONTRA LA BASE REAL (vía 3) ====================
 *
 * ⚠️ ESTO NO ES UN GATE Y NO LLEVA `_..._gate.mjs` EN EL NOMBRE, A PROPÓSITO. Sale a la red, así que no puede
 * vivir en la suite offline; y tampoco pertenece a la suite LIVE, que está reservada para lo que GASTA
 * CRÉDITO del proveedor. Esto no gasta un centavo: habla con Supabase, no con un modelo. Es un script que se
 * corre a mano, una vez, cuando hay proyecto.
 *
 * QUÉ PRUEBA, y es lo único que los candados no pueden: que la base ACEPTE nuestro pase y que las políticas
 * hagan lo que dicen. Todo lo demás ya está probado sin red.
 *
 * EL CHEQUEO QUE JUSTIFICA EL VIAJE es el cruce de empresas: un pase de otra empresa no puede ver ni escribir
 * las filas de esta. Eso no se puede simular con un doble — o lo hace Postgres, o no lo hace nadie.
 *
 * CÓMO SE CORRE:
 *     node scripts/verificar-supabase.mjs
 * Lee `SUPABASE_URL`, `SUPABASE_ANON_KEY` y `SUPABASE_JWT_SECRET` del entorno o del `.env` de la raíz.
 * Ninguna de las tres se imprime.
 *
 * ⚠️ DEJA RASTRO, Y ESO ES CORRECTO: no hay permiso de borrado en ninguna tabla —esa ausencia ES la garantía
 * de append-only— así que la carga de prueba queda registrada como cualquier otra. Al final se imprime el SQL
 * para limpiarla desde el panel, si se quiere.
 */
import { readFileSync } from "node:fs";
import { crearClienteRest } from "../src/data/supabaseRest.js";
import { emitirPase } from "../src/data/paseTenant.js";

// ── el entorno ────────────────────────────────────────────────────────────────────────────────────────
try {
  for (const ln of readFileSync(".env", "utf8").split(/\r?\n/)) {
    const m = ln.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
} catch { /* sin .env: se usan las variables del entorno */ }

const { SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_JWT_SECRET } = process.env;
const faltan = ["SUPABASE_URL", "SUPABASE_ANON_KEY", "SUPABASE_JWT_SECRET"].filter((k) => !process.env[k]);
if (faltan.length) {
  console.log(`\n✗ faltan variables: ${faltan.join(" · ")}`);
  console.log("  Ponelas en el archivo `.env` de la raíz (está fuera de git) o en el entorno, y volvé a correr.\n");
  process.exit(2);
}

const EMPRESA = process.argv[2] || "demo";
const AJENA = "empresa-que-no-es";

let ok = 0, mal = 0;
const chequeo = (cond, label, detalle) => {
  if (cond) { ok++; console.log(`  ✓ ${label}`); }
  else { mal++; console.log(`  ✗ ${label}`); if (detalle !== undefined) console.log(`      ${detalle}`); }
};

const db = crearClienteRest({ url: SUPABASE_URL, apikey: SUPABASE_ANON_KEY });
const paseDe = async (t) => (await emitirPase({ tenantId: t, secreto: SUPABASE_JWT_SECRET, ttlSegundos: 600 })).pase;

const pase = await paseDe(EMPRESA);
const paseAjeno = await paseDe(AJENA);

console.log(`\n════ VERIFICACIÓN EN VIVO · empresa «${EMPRESA}» ════`);
console.log(`  proyecto: ${SUPABASE_URL.replace(/^https:\/\//, "").split(".")[0]}…supabase.co\n`);

// ── 0 · ¿la base está al día con las migraciones que este código necesita? ────────────────────────────
/* ⚠️ ESTO VA PRIMERO, y aprendido a la mala. El código empezó a mandar las columnas de actor (quién subió,
 * quién activó) antes de que la migración 005 estuviera corrida en el proyecto: la base contestaba «column
 * does not exist» y toda la carga fallaba: no degradaba, no avisaba distinto, fallaba. Preguntarle a la base
 * qué versión del esquema tiene, ANTES de probar nada, convierte media hora de desconcierto en una línea.
 *
 * Se pregunta por lo que cada migración CREA, no por su nombre: no hay tabla de migraciones que mentir. */
console.log("0 · EL ESQUEMA · ¿la base tiene lo que este código le va a pedir?");
{
  const NECESITA = [
    { mig: "005", que: "uploads · quién subió", tabla: "uploads", columnas: "id,subido_por,subido_por_label,subido_por_rol" },
    { mig: "005", que: "fact_pack_versions · quién creó", tabla: "fact_pack_versions", columnas: "id,creado_por,creado_por_label,creado_por_rol" },
    { mig: "005", que: "fact_pack_versions · quién activó y cuándo", tabla: "fact_pack_versions", columnas: "id,activada_en,activada_por,activada_por_label,activada_por_rol" },
  ];
  let atrasada = null;
  for (const n of NECESITA) {
    const r = await db.seleccionar(n.tabla, { pase, columnas: n.columnas, limite: 1 });
    chequeo(r.ok, `${n.que} (migración ${n.mig})`, `${r.motivo || ""} ${r.detalle || ""}`.trim());
    if (!r.ok && /does not exist|42703/i.test(`${r.motivo} ${r.detalle}`)) atrasada = n.mig;
  }
  /* LA FIRMA DE LA FUNCIÓN · con seis argumentos desde la 005. Se la llama con un id que no existe: si la
   * firma falta, PostgREST contesta PGRST202; si está, contesta cualquier otra cosa, que es lo que se busca. */
  const f = await db.llamarFuncion("adi_activar_version", {
    p_version_id: "00000000-0000-0000-0000-000000000000", p_pack: {}, p_moneda: "CLP",
    p_actor_id: null, p_actor_label: "verificación", p_actor_rol: "owner",
  }, { pase });
  const sinFirma = /PGRST202|Could not find the function/i.test(`${f.motivo || ""} ${f.detalle || ""}`);
  chequeo(!sinFirma, "adi_activar_version acepta los seis argumentos (migración 005)",
    `${f.motivo || ""} ${f.detalle || ""}`.trim().slice(0, 220));
  if (sinFirma) atrasada = "005";

  if (atrasada) {
    console.log(`\n  ⚠️ LA BASE ESTÁ ATRASADA: falta correr la migración ${atrasada}.`);
    console.log(`     Está en db/migraciones/${atrasada}_actor_y_roles.sql — se pega entera en el SQL Editor de Supabase.`);
    console.log("     Hasta que se corra, subir una planilla FALLA. Se frena acá, porque todo lo de abajo mentiría.\n");
    process.exit(1);
  }
}

// ── 1 · ¿la base acepta nuestro pase? ─────────────────────────────────────────────────────────────────
console.log("\n1 · EL PASE · ¿lo acepta PostgREST?");
{
  const r = await db.seleccionar("tenants", { pase, columnas: "id,nombre" });
  chequeo(r.ok, "la base acepta el pase firmado con el secreto JWT del proyecto",
    `${r.motivo || ""} ${r.detalle || ""}`.trim());
  if (!r.ok) {
    console.log("\n  ⚠️ Si dice 401 o «JWSError», el proyecto no firma con HS256 y el pase necesita otro formato.");
    console.log("     Es un ajuste acotado, no un rediseño. Frená acá y avisá.\n");
    process.exit(1);
  }
  chequeo(r.filas.length === 1 && r.filas[0].id === EMPRESA,
    `y devuelve exactamente su empresa: ${r.filas.map((x) => x.id).join(" · ") || "ninguna"}`,
    `si viene vacío, falta sembrar la empresa: insert into public.tenants (id, nombre) values ('${EMPRESA}', '…');`);
  if (!r.filas.length) process.exit(1);
}

// ── 2 · EL CRUCE DE EMPRESAS · lo único que no se puede simular ───────────────────────────────────────
console.log("\n2 · EL MURO · un pase ajeno no alcanza este dato");
{
  const r = await db.seleccionar("tenants", { pase: paseAjeno, columnas: "id" });
  chequeo(r.ok && r.filas.length === 0,
    "⚠️ un pase de otra empresa lee CERO filas — no las de esta", `devolvió ${r.filas ? r.filas.length : "?"} filas`);

  const v = await db.seleccionar("fact_pack_versions", { pase: paseAjeno, columnas: "id,tenant_id" });
  chequeo(v.ok && v.filas.length === 0, "…y cero versiones de pack", `devolvió ${v.filas ? v.filas.length : "?"}`);

  /* EL CHEQUEO MÁS IMPORTANTE DE TODO EL SCRIPT: escribir para OTRA empresa tiene que ser imposible, no
   * improbable. Si esto pasara, todo el diseño del pase corto sería decorativo. */
  const w = await db.insertar("uploads", {
    pase: paseAjeno,
    filas: { tenant_id: EMPRESA, tipo: "negocio", nombre_archivo: "intento.xlsx",
      hash_sha256: "0".repeat(64), bytes: 1, estado: "recibido" },
  });
  chequeo(!w.ok, "⚠️ y NO PUEDE ESCRIBIR una fila a nombre de esta empresa: la política la rechaza",
    w.ok ? "LA ESCRIBIÓ — el muro no está haciendo su trabajo" : `rechazada: ${w.motivo}`);
}

/* ⚠️ QUÉ ESTABA ACTIVO ANTES DE TOCAR NADA. La sección 4 activa una versión de prueba, y activar es
 * justamente lo que DESACTIVA la anterior: sin esto, correr la verificación deja a la empresa sirviendo un
 * pack de mentira. Pasó de verdad —el demo quedó respondiendo `{verificacion:true}` y la sección 5 lo cazó—
 * y es el defecto más feo posible en una herramienta de comprobación: romper aquello que viene a comprobar. */
const previa = await db.llamarFuncion("adi_version_activa", {}, { pase });
const activaAntes = previa.ok && previa.filas.length ? previa.filas[0].id : null;

// ── 3 · el camino completo ────────────────────────────────────────────────────────────────────────────
console.log("\n3 · EL CAMINO COMPLETO · guardar, subir el original, activar");
let uploadId = null, versionId = null;
{
  const alta = await db.insertar("uploads", {
    pase, devolver: true,
    filas: { tenant_id: EMPRESA, tipo: "negocio", nombre_archivo: "verificacion.xlsx",
      hash_sha256: "a".repeat(64), bytes: 7, estado: "recibido" },
  });
  chequeo(alta.ok && alta.filas.length === 1, "registra la carga", `${alta.motivo || ""} ${alta.detalle || ""}`.trim());
  if (!alta.ok) process.exit(1);
  uploadId = alta.filas[0].id;

  const ruta = `${EMPRESA}/${uploadId}.xlsx`;
  const sub = await db.subirObjeto("adi-originales", ruta, new Uint8Array([80, 75, 3, 4, 0, 0, 0]), { pase });
  chequeo(sub.ok, `sube el original al depósito privado: ${ruta}`, `${sub.motivo || ""} ${sub.detalle || ""}`.trim());

  const ult = await db.seleccionar("fact_pack_versions", {
    pase, columnas: "version", filtros: { tenant_id: `eq.${EMPRESA}` }, orden: "version.desc", limite: 1,
  });
  const version = (ult.filas && ult.filas.length ? Number(ult.filas[0].version) : 0) + 1;

  const ver = await db.insertar("fact_pack_versions", {
    pase, devolver: true,
    filas: { tenant_id: EMPRESA, upload_id: uploadId, version, plantilla_version: "verificacion",
      pack: { verificacion: true, cuando: "script" },
      sello: { conAlarmas: true, confirmadoPorElUsuario: false, tipos: ["prueba"], observaciones: [], nota: "de prueba" },
      activa: false },
  });
  chequeo(ver.ok && ver.filas.length === 1, `guarda la versión ${version}`, `${ver.motivo || ""} ${ver.detalle || ""}`.trim());
  if (!ver.ok) process.exit(1);
  versionId = ver.filas[0].id;
  chequeo(ver.filas[0].activa === false, "⚠️ y nace INACTIVA: guardar no es adoptar");
}

// ── 4 · activar, y la garantía de una sola ────────────────────────────────────────────────────────────
console.log("\n4 · ACTIVAR · una sola versión activa, garantizada por la base");
{
  const r = await db.llamarFuncion("adi_activar_version", {
    p_version_id: versionId,
    p_sello: { conAlarmas: true, confirmadoPorElUsuario: true, tipos: ["prueba"], observaciones: [], nota: "confirmado" },
  }, { pase });
  chequeo(r.ok && r.filas.length === 1 && r.filas[0].activa === true, "la función activa la versión",
    `${r.motivo || ""} ${r.detalle || ""}`.trim());

  const activas = await db.seleccionar("fact_pack_versions", {
    pase, columnas: "id,version,sello", filtros: { tenant_id: `eq.${EMPRESA}`, activa: "is.true" },
  });
  chequeo(activas.ok && activas.filas.length === 1,
    `⚠️ hay EXACTAMENTE una versión activa: ${activas.filas ? activas.filas.length : "?"}`);
  chequeo(activas.ok && activas.filas[0] && activas.filas[0].sello
    && activas.filas[0].sello.confirmadoPorElUsuario === true,
    "…y su sello quedó confirmado en el mismo acto");

  const porFuncion = await db.llamarFuncion("adi_version_activa", {}, { pase });
  chequeo(porFuncion.ok && porFuncion.filas.length === 1 && porFuncion.filas[0].id === versionId,
    "y `adi_version_activa()` devuelve esa misma");

  /* Que el pase ajeno no pueda activar lo de esta empresa. La función corre con los permisos de quien llama,
   * así que la versión simplemente no existe para él. */
  const intruso = await db.llamarFuncion("adi_activar_version", { p_version_id: versionId }, { pase: paseAjeno });
  chequeo(!intruso.ok, "⚠️ un pase ajeno NO puede activar esta versión", intruso.ok ? "LA ACTIVÓ" : `rechazado: ${intruso.motivo}`);
}

// ── DEVOLVER LAS COSAS A SU LUGAR, ANTES DE MEDIR EL PRODUCTO ─────────────────────────────────────────
console.log("\n4b · RESTAURAR · la verificación no puede dejar rota a la empresa que verifica");
{
  if (activaAntes && activaAntes !== versionId) {
    const r = await db.llamarFuncion("adi_activar_version", { p_version_id: activaAntes }, { pase });
    chequeo(r.ok, "vuelve a quedar activa la versión que estaba antes de esta prueba",
      `${r.motivo || ""} ${r.detalle || ""}`.trim());
  } else if (!activaAntes) {
    /* No había ninguna activa: dejar activa la de prueba sería inventarle datos a la empresa. Se apaga.
     * Que no se pueda desactivar sin activar otra es correcto —ese es el trabajo de la función—, así que acá
     * se hace con un update directo, que el pase sí permite sobre las filas de su propia empresa. */
    const r = await db.actualizar("fact_pack_versions", {
      pase, filtros: { id: `eq.${versionId}` }, cambios: { activa: false },
    });
    chequeo(r.ok, "no había ninguna activa antes: la de prueba se apaga y la empresa vuelve a «sin datos»", r.motivo);
  } else {
    chequeo(true, "no hubo nada que restaurar");
  }
}

// ── 5 · la cadena completa del producto ───────────────────────────────────────────────────────────────
console.log("\n5 · EL PRODUCTO · lo que `handleData` le entrega de verdad al navegador");
{
  /* Los candados prueban esto con un doble en memoria. Acá se prueba contra la base real: es la diferencia
   * entre «el código hace lo que dice» y «el producto sirve el dato guardado». */
  const { handleData } = await import("../src/data/tenantService.server.js");
  const ENV = { SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_JWT_SECRET };

  const r = await handleData({}, ENV);
  chequeo(r.ok && r.origen === "guardado",
    `sirve el pack GUARDADO en la base, no el del bundle (origen: ${r.origen})`, r.motivo);
  chequeo(Boolean(r.dataset) && Array.isArray(r.dataset.clientesVentas) && r.dataset.clientesVentas.length > 0,
    `…con dato real adentro: ${r.dataset && r.dataset.clientesVentas ? r.dataset.clientesVentas.length : 0} clientes`);

  /* Y que sea el mismo negocio, no cualquier cosa que haya quedado dando vueltas. */
  const { TENANT_DEMO } = await import("../src/data/tenants/demo.js");
  chequeo(r.dataset && r.dataset.id === TENANT_DEMO.id && r.dataset.nombre === TENANT_DEMO.nombre,
    `…y es el negocio que se sembró: ${r.dataset && r.dataset.nombre}`);

  const demo = await handleData({ op: "demo" }, ENV);
  chequeo(demo.ok && demo.esDemo === true, "«mirar el demo» responde el ejemplo, marcado como tal");
}

// ── cierre ────────────────────────────────────────────────────────────────────────────────────────────
console.log(`\n── verificación en vivo: ${ok} OK · ${mal} FALLA (de ${ok + mal}) ──`);
if (uploadId) {
  console.log("\nPara borrar el rastro de esta prueba, en el SQL Editor:");
  console.log(`  delete from public.fact_pack_versions where plantilla_version = 'verificacion';`);
  console.log(`  delete from public.uploads where nombre_archivo = 'verificacion.xlsx';`);
}
console.log("");
process.exit(mal === 0 ? 0 : 1);
