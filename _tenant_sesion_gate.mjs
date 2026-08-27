/* === _tenant_sesion_gate.mjs · LA EMPRESA SALE DE LA SESIÓN, NO DEL NAVEGADOR (vía 1 · 2026-08-20) ============
 *
 * La orden del owner, textual: «empresa derivada del login/sesión, nunca de un parámetro libre del navegador».
 * `_bundle_sin_datos_gate` prueba que el dato ya no viaja horneado en el paquete. Falta la otra mitad, que es la
 * que decide QUIÉN recibe QUÉ: eso vive en `src/data/tenantService.server.js` y se prueba acá.
 *
 * LAS SIETE PROPIEDADES. Cada una es un "no" que el producto tiene que sostener aunque el cliente insista:
 *   1. con la puerta armada y sin código → CERO dato (ni el demo «por las dudas»)
 *   2. con un código inventado → CERO dato (la firma HMAC es la que manda)
 *   3. con un código válido → el dato de SU empresa, y el origen declarado
 *   4. con un código firmado para otra empresa → esa otra empresa (la firma lleva la empresa adentro)
 *   5. EL ATAQUE: código de una empresa + `tenantSolicitado` de otra → se sirve la de la FIRMA, no la pedida
 *   6. el conmutador de desarrollo existe, pero lo habilita el SERVIDOR (ADI_DEV_TENANT_SWITCH), no el navegador
 *   7. si la empresa firmada no está en la build → se declara; NUNCA se cae al demo en silencio
 *
 * La 5 es la razón de ser de todo esto: un `?tenant=` que el servidor obedezca es una lista de empresas para
 * probar a mano. La 7 es la trampa cómoda — un fallback «seguro» que le serviría a alguien el dato de otro.
 * Determinístico · sin red · sin credenciales · el secret de prueba es local y no sirve fuera de este archivo.
 */
import { handleData, resolverTenantDeSesion, tenantsDisponibles } from "./src/data/tenantService.server.js";
import { makeAccessCode, parseAccessCode, verifyAccessCode } from "./src/adi/llm/accessToken.js";

let PASS = 0, FAIL = 0;
const ok = (c, m, extra = "") => { if (c) { PASS++; console.log("  ✓ " + m); } else { FAIL++; console.log("  ✗ FALLO: " + m + (extra ? "\n      " + extra : "")); } };
const H = (t) => console.log("\n" + t + "\n" + "─".repeat(Math.min(100, t.length)));

const SECRET = "secreto-solo-de-este-gate-no-sirve-en-ningun-lado";
const ENV = { ADI_TOKEN_SECRET: SECRET };
const ENV_DEV = { ...ENV, ADI_DEV_TENANT_SWITCH: "true" };

H("[0] el registro que esta build conoce");
const IDS = tenantsDisponibles();
ok(IDS.includes("demo"), `el demo está en la build (${IDS.join(", ")})`);
ok(IDS.length >= 2, `hay al menos dos empresas para poder probar la fuga entre ellas (${IDS.length})`);
const OTRO = IDS.find((i) => i !== "demo");

H("[1] con la puerta armada, sin sesión válida NO se sirve dato");
for (const [caso, body] of [["sin código", {}], ["código vacío", { access: "" }], ["código inventado", { access: "ADI-falso.falso" }], ["código con forma válida y firma falsa", { access: "ADI-eyJuIjoieCIsImUiOjF9.zzz" }]]) {
  const r = await handleData(body, ENV);
  ok(r.ok === false && !r.dataset, `${caso} → ok:false y sin dataset (motivo: "${r.motivo}")`);
}

H("[2] un código válido recibe el dato de SU empresa, con el origen declarado");
const codDemo = (await makeAccessCode("jc", 72, SECRET)).code;
{
  const r = await handleData({ access: codDemo }, ENV);
  ok(r.ok === true && r.tenantId === "demo", `código de demo → tenant "${r.tenantId}"`);
  ok(r.origen === "sesion", `el origen se declara: "${r.origen}" (no se adivina de dónde salió)`);
  ok(Array.isArray(r.dataset.clientesVentas) && r.dataset.clientesVentas.length > 0, `viene con dato real (${r.dataset.clientesVentas.length} clientes)`);
}

H("[3] la empresa viaja DENTRO de la firma");
const codOtro = (await makeAccessCode("otro", 72, SECRET, Date.now(), OTRO)).code;
{
  const r = await handleData({ access: codOtro }, ENV);
  ok(r.ok === true && r.tenantId === OTRO, `código firmado para "${OTRO}" → tenant "${r.tenantId}"`);
  ok(r.dataset && r.dataset.id === OTRO, `el dataset servido es el suyo ("${r.dataset && r.dataset.nombre}")`);
  // compatibilidad: un código SIN empresa sigue siendo demo y su payload no cambió de forma
  ok(parseAccessCode(codDemo).tenant === "demo", "un código sin empresa declarada se lee como demo (compatibilidad hacia atrás)");
  const v = await verifyAccessCode(codDemo, SECRET);
  ok(v.ok === true && v.tenant === "demo", "verifyAccessCode devuelve la empresa YA VERIFICADA");
}

H("[4] EL ATAQUE · pedir otra empresa por parámetro no cambia nada");
{
  const r = await handleData({ access: codDemo, tenantSolicitado: OTRO }, ENV);
  ok(r.tenantId === "demo", `código de demo + tenantSolicitado="${OTRO}" → se sirve "${r.tenantId}" (manda la firma)`);
  const r2 = await handleData({ access: codOtro, tenantSolicitado: "demo" }, ENV);
  ok(r2.tenantId === OTRO, `y al revés: código de "${OTRO}" pidiendo demo → se sirve "${r2.tenantId}"`);
  const r3 = await handleData({ tenantSolicitado: OTRO }, ENV);
  ok(r3.ok === false, "sin código, pedir una empresa por parámetro tampoco abre la puerta");
}

H("[5] el conmutador de desarrollo lo habilita el SERVIDOR, no el navegador");
{
  const r = await handleData({ access: codDemo, tenantSolicitado: OTRO }, ENV_DEV);
  ok(r.tenantId === OTRO && r.origen === "dev-switch", `con ADI_DEV_TENANT_SWITCH=true sí se honra, y se declara (origen: "${r.origen}")`);
  const r2 = await handleData({ access: codDemo, tenantSolicitado: OTRO }, { ...ENV, ADI_DEV_TENANT_SWITCH: "1" });
  ok(r2.tenantId === "demo", "la variable tiene que decir exactamente \"true\" — un \"1\" no alcanza");
  const r3 = await handleData({ access: codDemo, tenantSolicitado: "empresa-que-no-existe" }, ENV_DEV);
  ok(r3.tenantId === "demo", "y aun habilitado, solo honra ids que existen en el registro");
}

H("[6] una empresa firmada que no existe se DECLARA, no cae al demo");
{
  const codFantasma = (await makeAccessCode("x", 72, SECRET, Date.now(), "empresa-fantasma")).code;
  const r = await handleData({ access: codFantasma }, ENV);
  ok(r.ok === false && !r.dataset, `→ ok:false y sin dataset (motivo: "${r.motivo}")`);
  ok(/no habilitada/.test(String(r.motivo)) && String(r.motivo).includes("empresa-fantasma"), "el motivo nombra la empresa que se pidió");
}

H("[7] sin puerta armada (dev/local) se sirve el demo, y se dice que fue sin puerta");
{
  const r = await handleData({}, {});
  ok(r.ok === true && r.tenantId === "demo" && r.origen === "sin-puerta", `→ tenant "${r.tenantId}", origen "${r.origen}"`);
  const r2 = await resolverTenantDeSesion({ tenantSolicitado: OTRO }, {});
  ok(r2.tenantId === "demo", "y ni siquiera ahí un parámetro del navegador cambia de empresa");
}

H("[8] una sesión vencida es un no, con su motivo propio");
{
  const viejo = (await makeAccessCode("jc", 1, SECRET, Date.now() - 2 * 3600 * 1000)).code;
  const r = await handleData({ access: viejo }, ENV);
  ok(r.ok === false && /vencida/.test(String(r.motivo)), `→ ok:false, motivo "${r.motivo}" (distinto de "sin sesión válida")`);
}

/* ══ VÍA 3 · 3.e (2026-08-27) · EL DATO SALE DE LA BASE, Y LA EMPRESA SIN ARCHIVO SE DECLARA ══════════
 *
 * Hasta acá `handleData` servía SIEMPRE el registro compilado. Ahora, con base configurada, sirve el pack
 * ACTIVO de esa empresa — y si no tiene ninguno, lo dice en vez de mostrarle el ejemplo como si fuera suyo.
 * Se ejerce con un cliente inyectado: sin red y sin proyecto creado. */
const ENV_BASE = { ...ENV, SUPABASE_URL: "https://x.supabase.co", SUPABASE_ANON_KEY: "publica", SUPABASE_JWT_SECRET: "firma" };
const codigoDe = async (t) => (await makeAccessCode("prueba", 72, SECRET, Date.now(), t)).code;

/* Un doble mínimo: `empresa` es lo que devuelve `tenants`; `activa` lo que devuelve `adi_version_activa()`. */
function baseFalsa({ empresa = [{ id: "demo", nombre: "Desde la base" }], activa = [] } = {}) {
  return {
    async seleccionar() { return { ok: true, filas: empresa }; },
    async llamarFuncion() { return { ok: true, filas: activa }; },
    async insertar() { return { ok: true, filas: [] }; },
    async actualizar() { return { ok: true, filas: [] }; },
    async subirObjeto() { return { ok: true, filas: [] }; },
  };
}

H("[6] con base configurada, el dato viene de la base y no del bundle");
{
  const PACK = { id: "demo", nombre: "Pack guardado", perfil: {} };

  const r = await handleData({ access: await codigoDe("demo") }, ENV_BASE,
    { cliente: baseFalsa({ activa: [{ id: "v1", version: 4, pack: PACK, sello: { conAlarmas: true } }] }) });
  ok(r.ok && r.origen === "guardado", `sirve el pack guardado (origen: ${r.origen})`);
  ok(r.dataset === PACK, "…y el dataset es el de la base, no el del registro compilado");
  ok(r.sello && r.sello.conAlarmas === true,
    "⚠️ el sello de plausibilidad vuelve CON el pack: la observación sobrevive a recargar la página");
  ok(r.version === 4, `…junto con qué versión es: ${r.version}`);

  H("[7] la empresa existe y todavía no subió nada");
  const s = await handleData({ access: await codigoDe("demo") }, ENV_BASE, { cliente: baseFalsa({ activa: [] }) });
  ok(s.ok === true && s.sinDatos === true, "⚠️ NO es un error: es un estado legítimo del negocio (ok:true + sinDatos)");
  ok(!s.dataset, "⚠️ …y NO viaja ni una fila: nunca el ejemplo disfrazado de dato suyo");
  ok(s.mensaje === "Todavía no hay datos cargados para esta empresa. Puedes subir una planilla o mirar el demo.",
    `…con la frase que decidió el owner, textual: «${s.mensaje}»`);

  H("[8] una empresa que la base no conoce");
  const d = await handleData({ access: await codigoDe("demo") }, ENV_BASE, { cliente: baseFalsa({ empresa: [] }) });
  ok(d.ok === false && !d.dataset, `se declara y no se sirve nada (motivo: "${d.motivo}")`);

  H("[9] «mirar el demo» · el segundo camino que ofrece ese aviso");
  const dm = await handleData({ op: "demo", access: await codigoDe("demo") }, ENV_BASE);
  ok(dm.ok && dm.esDemo === true && dm.origen === "demo-explicito", `sirve el ejemplo, marcado como tal (${dm.origen})`);
  ok(dm.tenantId === "demo", "…siempre el demo y nada más: no es un selector de empresa");
  /* ⚠️ el chequeo que cierra la puerta: pedir «demo» desde otra empresa NO devuelve la de esa empresa. */
  const dmOtro = await handleData({ op: "demo", access: await codigoDe(OTRO) }, ENV_BASE);
  ok(dmOtro.tenantId === "demo" && dmOtro.dataset && dmOtro.dataset.id === "demo",
    `⚠️ y pedido desde «${OTRO}» sigue devolviendo el demo, nunca la empresa de la sesión`);

  H("[10] sin base configurada, todo se comporta como antes de la vía 3");
  const viejo = await handleData({ access: await codigoDe("demo") }, ENV);
  ok(viejo.ok && viejo.dataset && !viejo.sinDatos, `el registro compilado, como siempre (origen: ${viejo.origen})`);
  ok(viejo.dataset !== PACK, "…y no el pack de la base: la bandera de verdad separa los dos caminos");

  H("[11] CARNADA · el doble tiene que poder cambiar la respuesta");
  const c = await handleData({ access: await codigoDe("demo") }, ENV_BASE,
    { cliente: baseFalsa({ activa: [{ id: "v9", version: 9, pack: { id: "otro" } }] }) });
  ok(c.version === 9 && c.dataset.id === "otro",
    "cambiando lo que responde la base cambia lo que sirve `handleData`: lo de arriba mide algo real");
}

console.log(`\n${FAIL === 0 ? "✅" : "❌"} _tenant_sesion_gate · ${PASS} ok · ${FAIL} fallas`);
process.exit(FAIL === 0 ? 0 : 1);
