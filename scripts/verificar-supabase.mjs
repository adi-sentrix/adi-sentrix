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
import { crearAlmacenSupabase } from "../src/adi/continuidad/almacenSupabase.js";
import { esErrorDeAlmacen } from "../src/adi/continuidad/almacen.js";
import * as EMP from "../src/adi/continuidad/empresa.js";
import { libroNuevo, registrarEntrega, ORIGEN_LIBRO } from "../src/adi/continuidad/libro.js";
import { TAXONOMIA_PERFIL } from "../src/config/contract/taxonomiaPerfil.js";

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
   * firma falta, PostgREST contesta PGRST202; si está, contesta cualquier otra cosa, que es lo que se busca.
   *
   * ⚠️ LOS NOMBRES SON LOS QUE USA `persistirCarga`, no los que uno recuerde. PostgREST resuelve la función
   * por el CONJUNTO EXACTO de argumentos nombrados: escribir `p_pack` en vez de `p_sello` devuelve el mismo
   * PGRST202 que devolvería una migración sin correr, y ahí el chequeo deja de medir la base y pasa a medir
   * la memoria del que lo escribió. Ya pasó una vez, en la sonda que precedió a estas líneas. */
  const f = await db.llamarFuncion("adi_activar_version", {
    p_version_id: "00000000-0000-0000-0000-000000000000", p_sello: {}, p_moneda: "CLP",
    p_actor_id: null, p_actor_label: "verificación", p_actor_rol: "owner",
  }, { pase });
  const sinFirma = /PGRST202|Could not find the function/i.test(`${f.motivo || ""} ${f.detalle || ""}`);
  chequeo(!sinFirma, "adi_activar_version acepta los seis argumentos (migración 005)",
    `${f.motivo || ""} ${f.detalle || ""}`.trim().slice(0, 220));
  if (sinFirma) atrasada = "005";

  /* LA POLÍTICA DE COBRO (006) · el plazo de pago. Se la llama con un general fuera de rango: si la función
   * existe, RECHAZA con su propio mensaje —que es la respuesta que confirma que está—; si no existe, contesta
   * PGRST202. Se prueba con un valor inválido a propósito para no escribirle una política a nadie. */
  const c = await db.llamarFuncion("adi_declarar_cobro", {
    p_dias_general: 99999, p_por_cliente: {}, p_actor_id: null, p_actor_label: null, p_actor_rol: null,
  }, { pase });
  const sinCobro = /PGRST202|Could not find the function/i.test(`${c.motivo || ""} ${c.detalle || ""}`);
  chequeo(!sinCobro, "adi_declarar_cobro existe (migración 006)",
    `${c.motivo || ""} ${c.detalle || ""}`.trim().slice(0, 220));
  if (sinCobro) atrasada = "006";

  if (atrasada) {
    console.log(`\n  ⚠️ LA BASE ESTÁ ATRASADA: falta correr la migración ${atrasada}.`);
    console.log(`     Está en db/migraciones/ (el archivo que empieza con ${atrasada}) — se pega entero en el SQL Editor de Supabase.`);
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

  /* ⚠️ Y QUE NO SE HAYA QUEDADO ATRÁS, que es distinto de ser el negocio correcto y ya pasó una vez. La siembra
   * del 27 de agosto tenía el nombre bien, los 13 clientes bien y los 13 SKU bien — y le faltaba `flujoComercial`,
   * porque la pestaña se agregó después. El visitante sin código veía un demo impecable al que le faltaba una
   * cara entera, sin un error en ninguna parte. Un demo que se queda atrás es peor que uno que falta: nadie lo
   * mira dos veces. Se comparan las LLAVES, no el contenido: el pack guardado es una foto legítima de un momento
   * y sus cifras pueden diferir, pero si le falta una sección es que la siembra quedó vieja. */
  const faltantes = Object.keys(TENANT_DEMO).filter((k) => !(k in (r.dataset || {})));
  chequeo(faltantes.length === 0,
    "…y NO se quedó atrás del demo del código: no le falta ninguna sección",
    faltantes.length ? `le faltan: ${faltantes.join(" · ")} — correr \`node scripts/sembrar-demo.mjs\`` : undefined);

  const demo = await handleData({ op: "demo" }, ENV);
  chequeo(demo.ok && demo.esDemo === true, "«mirar el demo» responde el ejemplo, marcado como tal");
}

/* ═══ ETAPA 2 · BLOQUE 1 (guardado durable) · SECCIONES 6 Y 7 — PREPARADAS, NUNCA CORRIDAS TODAVÍA ═══════════════════
 * Las migraciones 012, 013, 014 y 015 están ESCRITAS Y NO APLICADAS (el owner las aplica en el SQL Editor, en ese orden,
 * y son idempotentes). Estas dos secciones se escribieron SIN poder llamar a la base: las ejerce, sin red, el doble de
 * `scripts/doble-supabase-continuidad.mjs` desde `_guardado_durable_gate.mjs`, pero lo que este script comprueba es lo
 * que un doble NO puede: que Postgres acepte el SQL, que el muro (RLS + `security definer`) aísle de verdad y que el
 * pase de una empresa no toque lo de otra. La 6 es SOLO LECTURA (más rechazos a propósito que no escriben nada); la 7
 * ESCRIBE en `memoria_empresa` y en `conversaciones` (append-only: deja rastro — al final imprime el SQL para limpiarlo).
 * Si falta alguna migración, la sección lo dice y la 7 se salta. Corre DESPUÉS de las secciones 0-5 (las de siempre). */

// ── 6 · LAS MIGRACIONES 011-015 · ¿están aplicadas, y dicen lo que el código cree? (solo lectura) ─────────────────
console.log("\n6 · LAS MIGRACIONES 011-015 · ¿están aplicadas y coinciden con el código? (solo lectura)");
const _txt = (r) => `${r.motivo || ""} ${r.detalle || ""}`.trim();
const _sinFuncion = (r) => /PGRST202|Could not find the function/i.test(_txt(r));
const _sinColumna = (r) => !r.ok && /does not exist|42703|PGRST204/i.test(_txt(r));
const _canon = (x) => Array.isArray(x) ? x.map(_canon) : (x && typeof x === "object" ? Object.keys(x).sort().reduce((o, k) => { o[k] = _canon(x[k]); return o; }, {}) : x);
const _iguales = (a, b) => JSON.stringify(_canon(a)) === JSON.stringify(_canon(b));
const mig = { "011": false, "012": false, "013": false, "014": false, "015": false };
{
  const r11 = await db.llamarFuncion("adi_leer_contexto", {}, { pase });
  mig["011"] = r11.ok;
  chequeo(r11.ok, "011 · «Tu negocio»: la función adi_leer_contexto existe", _txt(r11).slice(0, 200));

  const COLS_PERFIL = "sector_codigo,sector_procedencia,pais_codigo,pais_procedencia,modelo_comercial_codigo,modelo_comercial_procedencia,tamano_banda_codigo,tamano_banda_procedencia,moneda,moneda_procedencia";
  const r12 = await db.seleccionar("tenants", { pase, columnas: `id,${COLS_PERFIL}`, limite: 1 });
  mig["012"] = r12.ok;
  chequeo(r12.ok, "012 · `tenants` tiene las columnas del perfil de empresa (sector, país, modelo comercial, banda, moneda y sus procedencias)", _txt(r12).slice(0, 200));
  const tax = await db.seleccionar("perfil_taxonomia", { pase, columnas: "campo,codigo" });
  chequeo(tax.ok, "012 · la tabla `perfil_taxonomia` existe y se puede leer", _txt(tax).slice(0, 200));

  const r13 = await db.seleccionar("tenants", { pase, columnas: "id,tipo_producto_codigo,tipo_producto_procedencia", limite: 1 });
  const r13viejo = await db.seleccionar("tenants", { pase, columnas: "id,subsector_codigo", limite: 1 });
  mig["013"] = r13.ok && _sinColumna(r13viejo);
  chequeo(r13.ok, "013 · `tenants.tipo_producto_codigo` existe (el antiguo «subsector» se renombró)", _txt(r13).slice(0, 200));
  chequeo(_sinColumna(r13viejo), "013 · y `subsector_codigo` YA NO existe", r13viejo.ok ? "sigue existiendo: la 013 no corrió completa" : undefined);
  if (tax.ok) {
    for (const [campo, lista] of Object.entries(TAXONOMIA_PERFIL)) {
      const enBase = tax.filas.filter((f) => f.campo === campo).map((f) => f.codigo).sort();
      chequeo(_iguales(enBase, [...lista].sort()), `013 · la taxonomía sembrada de «${campo}» es IGUAL a la del código (${lista.length} códigos)`, `en la base: ${enBase.join(",")}`);
    }
    const ajenos = [...new Set(tax.filas.map((f) => f.campo))].filter((c) => !(c in TAXONOMIA_PERFIL));
    chequeo(ajenos.length === 0, "013 · y no sobra ningún campo en la base (p. ej. «subsector» de la 012)", ajenos.join(","));
  }
  const PERFIL_VACIO = { p_sector_codigo: null, p_sector_procedencia: null, p_tipo_producto_codigo: null, p_tipo_producto_procedencia: null, p_pais_codigo: null, p_pais_procedencia: null, p_modelo_comercial_codigo: null, p_modelo_comercial_procedencia: null, p_tamano_banda_codigo: null, p_tamano_banda_procedencia: null, p_moneda: null };
  /* RECHAZOS A PROPÓSITO: se llama con valores inválidos para que la base los rechace con SU mensaje — eso prueba que la
   * función y el trigger existen y mandan, sin escribirle un perfil a nadie. */
  const rSector = await db.llamarFuncion("adi_declarar_perfil_empresa", { ...PERFIL_VACIO, p_sector_codigo: "sector_que_no_existe" }, { pase });
  chequeo(!rSector.ok && !_sinFuncion(rSector) && /lista autorizada|taxonom/i.test(_txt(rSector)), "013 · declarar un sector fuera de la taxonomía se RECHAZA (el trigger manda)", _txt(rSector).slice(0, 220));
  const rTipo = await db.llamarFuncion("adi_declarar_perfil_empresa", { ...PERFIL_VACIO, p_sector_codigo: "servicios", p_tipo_producto_codigo: "vence" }, { pase });
  chequeo(!rTipo.ok && !_sinFuncion(rTipo), "013 · «servicios» con un tipo de producto se RECHAZA (la regla sector↔tipo es estructural)", _txt(rTipo).slice(0, 220));

  const r14 = await db.seleccionar("tenants", { pase, columnas: "id,piso_materialidad_cobranza_pct,piso_materialidad_cobranza_procedencia", limite: 1 });
  const f14 = await db.llamarFuncion("adi_declarar_piso_materialidad_cobranza", { p_pct: 5, p_procedencia: "medido" }, { pase });
  mig["014"] = r14.ok && !_sinFuncion(f14);
  chequeo(r14.ok, "014 · `tenants` tiene las columnas del piso de materialidad de cobranza", _txt(r14).slice(0, 200));
  chequeo(!f14.ok && !_sinFuncion(f14) && /0\.001|0\.10|entre/.test(_txt(f14)), "014 · declarar un piso fuera de rango (5 → 500 %) se RECHAZA con el mensaje de la función", _txt(f14).slice(0, 220));

  const mem = await db.seleccionar("memoria_empresa", { pase, columnas: "id,clase,concepto,origen,estado,declarado_en,conversacion_id,reemplaza", limite: 1 });
  const cv = await db.seleccionar("conversaciones", { pase, columnas: "hilo_id,estado", limite: 1 });
  const fAportar = await db.llamarFuncion("adi_aportar_hecho_empresa", { p_clase: "perfil", p_concepto: "x", p_eje: null, p_entidad: null, p_periodo: null, p_valor: null, p_origen: "declarado", p_documento: null, p_estado: "pendiente", p_reemplaza: null, p_conversacion_id: null, p_actor_label: null, p_actor_rol: null }, { pase });
  const UUID0 = "00000000-0000-4000-8000-000000000000";
  const fConf = await db.llamarFuncion("adi_confirmar_hecho_empresa", { p_id: UUID0, p_confirmacion: null, p_estado: null, p_reemplaza: null, p_actor_label: null, p_actor_rol: null }, { pase });
  const fRet = await db.llamarFuncion("adi_retirar_hecho_empresa", { p_id: UUID0, p_motivo: null, p_actor_label: null, p_actor_rol: null }, { pase });
  const fLeer = await db.llamarFuncion("adi_leer_memoria_empresa", {}, { pase });
  const fLeerE = await db.llamarFuncion("adi_leer_estado_conversacion", { p_hilo_id: "verificacion-no-existe" }, { pase });
  const fGuardarE = await db.llamarFuncion("adi_guardar_estado_conversacion", { p_hilo_id: "verificacion-no-objeto", p_estado: [], p_actor_id: null, p_actor_label: null, p_actor_rol: null }, { pase });
  mig["015"] = mem.ok && cv.ok && !_sinFuncion(fAportar) && fLeer.ok && fLeerE.ok;
  chequeo(mem.ok, "015 · la tabla `memoria_empresa` existe", _txt(mem).slice(0, 200));
  chequeo(cv.ok, "015 · `conversaciones.estado` (el libro de conversación) existe", _txt(cv).slice(0, 200));
  chequeo(!fAportar.ok && !_sinFuncion(fAportar) && /clase/.test(_txt(fAportar)), "015 · adi_aportar_hecho_empresa existe, admite la clase «perfil» y rechaza un perfil con un concepto que no es un campo suyo (aquí «x»)", _txt(fAportar).slice(0, 220));
  chequeo(fConf.ok && fRet.ok, "015 · adi_confirmar_hecho_empresa y adi_retirar_hecho_empresa existen (sobre un id que no existe devuelven cero filas, sin error)", `${_txt(fConf)} ${_txt(fRet)}`.slice(0, 220));
  chequeo(fLeer.ok && fLeerE.ok, "015 · adi_leer_memoria_empresa y adi_leer_estado_conversacion existen", `${_txt(fLeer)} ${_txt(fLeerE)}`.slice(0, 220));
  chequeo(!fGuardarE.ok && !_sinFuncion(fGuardarE) && /objeto/.test(_txt(fGuardarE)), "015 · adi_guardar_estado_conversacion existe y rechaza un libro que no es un objeto", _txt(fGuardarE).slice(0, 220));

  const atrasadas = Object.entries(mig).filter(([, v]) => !v).map(([k]) => k);
  if (atrasadas.length) {
    console.log(`\n  ⚠️ FALTA APLICAR: ${atrasadas.join(" · ")}. Están en db/migraciones/ y se pegan ENTERAS en el SQL Editor de Supabase, EN ORDEN (011 → 012 → 013 → 014 → 015); son idempotentes.`);
  } else {
    console.log("\n  ✓ las migraciones 011-015 están aplicadas");
  }
}

// ── 7 · LA MEMORIA DE EMPRESA Y EL LIBRO DE CONVERSACIÓN (015) · guardar, leer, confirmar, el Historial y el muro ───
console.log("\n7 · LA MEMORIA Y EL LIBRO (015) · con el adaptador REAL: guardar → leer idéntico, el Historial y el muro (ESCRIBE, append-only)");
const trazaDeVerificacion = { hilos: [], concepto: null };
if (!mig["015"]) {
  console.log("  · se salta: falta la migración 015 (ver arriba). Aplicarla y volver a correr.");
} else {
  try {
    const corrida = Date.now().toString(36);
    const CONCEPTO = `verificacion_${corrida}`;
    const HILO = `verificacion-${corrida}`, HILO2 = `verificacion-sin-origen-${corrida}`, HILO_APP = `verificacion-app-${corrida}`, HILO_VIGIA = `verificacion-vigia-${corrida}`;
    trazaDeVerificacion.hilos = [HILO, HILO2, HILO_APP, HILO_VIGIA]; trazaDeVerificacion.concepto = CONCEPTO;
    const store = crearAlmacenSupabase({ url: SUPABASE_URL, apikey: SUPABASE_ANON_KEY, pase });
    const storeAjeno = crearAlmacenSupabase({ url: SUPABASE_URL, apikey: SUPABASE_ANON_KEY, pase: paseAjeno });

    // — la memoria de empresa, con las funciones REALES de `continuidad/empresa.js` sobre el adaptador REAL —
    const aporte = { clase: "hecho", concepto: CONCEPTO, entidad: "VERIFICACION", valor: { raw: 45, unidad: "days", texto: "45 días · verificación" } };
    const a = await EMP.declararHecho(store, EMPRESA, aporte, { actorLabel: "verificación", conversacionId: HILO });
    chequeo(a.ok && a.estado === "pendiente" && a.paraConfirmar === true && /^[0-9a-f-]{36}$/.test(String(a.id)), "declarar un hecho lo guarda PENDIENTE y la base le da un uuid (proponer no es usar)", JSON.stringify(a).slice(0, 220));
    chequeo((await EMP.leerVigentes(store, EMPRESA, { concepto: CONCEPTO })).length === 0 && (await EMP.leerPendientes(store, EMPRESA, { concepto: CONCEPTO })).length === 1, "…y figura como pendiente, nunca como vigente");
    const a2 = await EMP.declararHecho(store, EMPRESA, aporte, { actorLabel: "verificación" });
    chequeo(a2.ok && a2.duplicado === true && a2.id === a.id, "declarar lo MISMO otra vez devuelve el mismo hecho (no crea otra fila)");
    const c = await EMP.confirmarHecho(store, EMPRESA, a.id, { actorLabel: "verificación", resolverConflicto: true });
    chequeo(c.ok && c.estado === "vigente" && c.entendido.origen === "declarado" && Boolean(c.entendido.confirmacion), "confirmar lo promueve a vigente, con su sello de confirmación y el origen sigue «declarado»", JSON.stringify(c).slice(0, 220));
    const b = await EMP.declararHecho(store, EMPRESA, { ...aporte, valor: { raw: 60, unidad: "days", texto: "60 días · verificación" }, reemplaza: a.id }, { actorLabel: "verificación" });
    const vigTrasProponer = await EMP.leerVigentes(store, EMPRESA, { concepto: CONCEPTO });
    chequeo(b.ok && b.estado === "pendiente" && b.conflictoCon === a.id && vigTrasProponer.length === 1 && vigTrasProponer[0].valor.raw === 45, "un valor DISTINTO queda pendiente con su conflicto y NO retira lo ya confirmado hasta que la persona confirme", JSON.stringify({ b: b.estado, vig: vigTrasProponer.map((x) => x.valor.raw) }));
    const c2 = await EMP.confirmarHecho(store, EMPRESA, b.id, { actorLabel: "verificación", resolverConflicto: true });
    const vigFinal = await EMP.leerVigentes(store, EMPRESA, { concepto: CONCEPTO });
    const hist = await EMP.leerHistoria(store, EMPRESA, { concepto: CONCEPTO });
    chequeo(c2.ok && vigFinal.length === 1 && vigFinal[0].valor.raw === 60 && hist.some((h) => h.valor.raw === 45 && h.estado === "retirado"), "confirmar el nuevo deja UNA sola vigente (60) y el viejo queda en la historia como retirado", JSON.stringify(hist.map((h) => `${h.valor.raw}:${h.estado}`)));
    const om = await EMP.omitirCampo(store, EMPRESA, { clase: "hecho", concepto: `${CONCEPTO}_omitido` }, { actorLabel: "verificación", conversacionId: HILO });
    chequeo(om.ok && (await EMP.yaFueOmitido(store, EMPRESA, { concepto: `${CONCEPTO}_omitido` }, { conversacionId: HILO })), "«prefiero no decirlo» se guarda como omitido y no se vuelve a preguntar");

    // — el libro de conversación: guardar → leer, IDÉNTICO —
    let libro = libroNuevo({ conversacionId: HILO, versionId: 1 });
    libro = registrarEntrega(libro, { versionId: 1, temas: ["comercial"], entidades: ["VERIFICACION"], cierre: "cifra", hechos: [{ sujeto: "VERIFICACION", metrica: "Venta", valor: "$1.0M", origen: "medido" }], entregadaEn: new Date().toISOString(), periodo: { tipo: "cerrado", texto: "año cerrado" } });
    await store.guardarLibro(EMPRESA, libro);
    const leido = await store.leerLibro(EMPRESA, HILO);
    chequeo(Boolean(leido) && _iguales(leido, libro), "guardar el libro y leerlo da EXACTAMENTE lo mismo (jsonb reordena las claves: la comparación es canónica)", leido ? undefined : "no volvió");
    chequeo(Boolean(leido) && leido.origen === ORIGEN_LIBRO, `el libro lleva el origen del hilo («${ORIGEN_LIBRO}»)`);
    chequeo((await store.leerLibro(EMPRESA, "verificacion-no-existe")) === null, "un libro que no existe devuelve null (no un error: «no existe» no es «falló»)");

    // — D3 · la base SELLA el origen aunque quien guarda no lo diga —
    const sinOrigen = await db.llamarFuncion("adi_guardar_estado_conversacion", { p_hilo_id: HILO2, p_estado: { version: "libro/v1", conversacionId: HILO2 }, p_actor_id: null, p_actor_label: "verificación", p_actor_rol: null }, { pase });
    chequeo(sinOrigen.ok && sinOrigen.filas[0] && sinOrigen.filas[0].estado && sinOrigen.filas[0].estado.origen === "complemento", "D3 · guardar un libro SIN origen: la base le pone `origen: complemento` ella misma", _txt(sinOrigen).slice(0, 200));

    // — D3 · el Historial de la app no ve los hilos del Complemento —
    const plan = await db.seleccionar("tenants", { pase, columnas: "id,plan", limite: 1 });
    if (plan.ok && plan.filas[0] && plan.filas[0].plan === "pro") {
      const app = await db.llamarFuncion("adi_guardar_conversacion", { p_hilo_id: HILO_APP, p_titulo: "verificación del historial", p_mensajes: [{ role: "user", text: "hola" }], p_actor_id: null, p_actor_label: "verificación", p_actor_rol: null }, { pase });
      const vigia = await db.llamarFuncion("adi_guardar_conversacion", { p_hilo_id: HILO_VIGIA, p_titulo: "", p_mensajes: [], p_actor_id: null, p_actor_label: "verificación", p_actor_rol: null }, { pase });
      chequeo(app.ok && vigia.ok, "se crean dos hilos del chat de la app (uno con título y otro recién abierto, vacío)", `${_txt(app)} ${_txt(vigia)}`.trim());
      const lista = await db.llamarFuncion("adi_listar_conversaciones", { p_limite: 200 }, { pase });
      const hilos = lista.ok ? lista.filas.map((f) => f.hilo_id) : [];
      chequeo(lista.ok && hilos.includes(HILO_APP) && hilos.includes(HILO_VIGIA), "D3 · el Historial lista los hilos de la app, incluido el vacío (no es un filtro por título vacío)", _txt(lista).slice(0, 200));
      chequeo(lista.ok && !hilos.includes(HILO) && !hilos.includes(HILO2), "★ D3 · y NO lista los hilos del Complemento (el libro): ninguna fila fantasma en el Historial de un usuario PRO");
      const abre = await db.llamarFuncion("adi_leer_conversacion", { p_hilo_id: HILO }, { pase });
      chequeo(abre.ok && abre.filas.length === 0, "D3 · el Historial tampoco puede ABRIR un hilo del Complemento");
      const encima = await db.llamarFuncion("adi_guardar_estado_conversacion", { p_hilo_id: HILO_APP, p_estado: { version: "libro/v1", conversacionId: HILO_APP }, p_actor_id: null, p_actor_label: null, p_actor_rol: null }, { pase });
      chequeo(!encima.ok && /conversación del chat de la app/.test(_txt(encima)), "D3 · guardar un libro ENCIMA de un hilo de la app se rechaza (no lo haría desaparecer del Historial)", _txt(encima).slice(0, 200));
    } else {
      console.log(`  · el Historial NO se puede verificar: la empresa «${EMPRESA}» no es plan pro (el Historial es de pago). Para probarlo: update public.tenants set plan = 'pro' where id = '${EMPRESA}';`);
    }

    // — el tope de 16 KB —
    const grande = await db.llamarFuncion("adi_guardar_estado_conversacion", { p_hilo_id: `${HILO}-grande`, p_estado: { version: "libro/v1", conversacionId: `${HILO}-grande`, relleno: "x".repeat(20000) }, p_actor_id: null, p_actor_label: null, p_actor_rol: null }, { pase });
    chequeo(!grande.ok && /16KB|tamaño|check/i.test(_txt(grande)), "un libro de más de 16 KB se rechaza (la base lo respalda aunque el código se olvide de recortar)", _txt(grande).slice(0, 200));

    // — EL MURO: lo único que un doble no puede probar —
    console.log("\n  EL MURO · un pase de OTRA empresa no alcanza esta memoria ni este libro");
    const antesFila = await store.leerHechosEmpresa(EMPRESA);
    const memAjena = await db.llamarFuncion("adi_leer_memoria_empresa", {}, { pase: paseAjeno });
    chequeo(memAjena.ok && memAjena.filas.length === 0, "⚠️ un pase ajeno lee CERO filas de la memoria de empresa", memAjena.ok ? `devolvió ${memAjena.filas.length}` : _txt(memAjena));
    const libAjeno = await db.llamarFuncion("adi_leer_estado_conversacion", { p_hilo_id: HILO }, { pase: paseAjeno });
    chequeo(libAjeno.ok && libAjeno.filas.length === 0, "⚠️ …y CERO filas del libro de esta conversación", libAjeno.ok ? `devolvió ${libAjeno.filas.length}` : _txt(libAjeno));
    const confAjena = await db.llamarFuncion("adi_confirmar_hecho_empresa", { p_id: b.id, p_confirmacion: { por: "intruso" }, p_estado: "retirado", p_reemplaza: null, p_actor_label: "intruso", p_actor_rol: null }, { pase: paseAjeno });
    const retAjena = await db.llamarFuncion("adi_retirar_hecho_empresa", { p_id: b.id, p_motivo: "intruso", p_actor_label: "intruso", p_actor_rol: null }, { pase: paseAjeno });
    const despuesFila = await store.leerHechosEmpresa(EMPRESA);
    chequeo(_iguales(antesFila, despuesFila), "⚠️ un pase ajeno NO PUEDE confirmar ni retirar un hecho de esta empresa (la memoria quedó idéntica)", `${_txt(confAjena)} · ${_txt(retAjena)}`.slice(0, 200));
    const apAjeno = await db.llamarFuncion("adi_aportar_hecho_empresa", { p_clase: "hecho", p_concepto: "intruso", p_eje: null, p_entidad: null, p_periodo: null, p_valor: null, p_origen: "declarado", p_documento: null, p_estado: "pendiente", p_reemplaza: null, p_conversacion_id: null, p_actor_label: null, p_actor_rol: null }, { pase: paseAjeno });
    chequeo(!apAjeno.ok, "⚠️ un pase de una empresa que no existe no puede ESCRIBIR memoria (la clave foránea lo rechaza)", apAjeno.ok ? "LA ESCRIBIÓ" : _txt(apAjeno).slice(0, 160));
    const gdAjeno = await db.llamarFuncion("adi_guardar_estado_conversacion", { p_hilo_id: HILO, p_estado: { version: "libro/v1", conversacionId: HILO, intruso: true }, p_actor_id: null, p_actor_label: null, p_actor_rol: null }, { pase: paseAjeno });
    const libroDespues = await store.leerLibro(EMPRESA, HILO);
    chequeo(!gdAjeno.ok && Boolean(libroDespues) && _iguales(libroDespues, libro), "⚠️ …ni guardar un libro a nombre de otra: el libro de esta empresa quedó idéntico", gdAjeno.ok ? "LO ESCRIBIÓ" : _txt(gdAjeno).slice(0, 160));
    const directo = await db.insertar("memoria_empresa", { pase, filas: { tenant_id: EMPRESA, clase: "hecho", concepto: `${CONCEPTO}_directo`, origen: "declarado", estado: "vigente" } });
    chequeo(!directo.ok, "⚠️ ni siquiera la propia empresa puede INSERTAR directo en `memoria_empresa`: solo por las funciones (no hay política de escritura)", directo.ok ? "INSERTÓ DIRECTO" : _txt(directo).slice(0, 160));
    await db.actualizar("memoria_empresa", { pase, filtros: { id: `eq.${b.id}` }, cambios: { estado: "retirado", valor: { raw: 999 } } });
    const trasUpdate = await EMP.leerHistoria(store, EMPRESA, { concepto: CONCEPTO });
    chequeo(_iguales(await store.leerHechosEmpresa(EMPRESA), despuesFila) && trasUpdate.length === hist.length, "⚠️ ni UPDATE directo: la memoria quedó idéntica (el valor de un hecho es inmutable)");
  } catch (e) {
    chequeo(false, "la sección 7 terminó con una EXCEPCIÓN (no con un control en falso)", esErrorDeAlmacen(e) ? `${e.operacion}: ${e.motivo}` : String(e && e.stack || e).slice(0, 400));
  }
  console.log("\n  Para borrar el rastro de la sección 7 (la memoria es append-only: el pase no puede borrar), en el SQL Editor:");
  console.log(`    delete from public.memoria_empresa where concepto like 'verificacion_%' and tenant_id = '${EMPRESA}';`);
  console.log(`    delete from public.conversaciones where hilo_id like 'verificacion-%' and tenant_id = '${EMPRESA}';`);
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
