/* === _emision_por_empresa_gate.mjs · UN CÓDIGO PARA UNA EMPRESA ABRE ESA EMPRESA (owner 2026-08-29) ====
 *
 * EL DEFECTO QUE ESTE CANDADO EXISTE PARA IMPEDIR, y es de los caros porque no rompía nada: el servidor emitía
 * con `makeAccessCode(name, hours, secret)` — **sin empresa**. La vía 1 había hecho que la empresa viajara
 * FIRMADA adentro del código, y la vía 3 le había dado a cada una su pack en Supabase: las dos cosas
 * funcionando, probadas… y **inalcanzables desde el producto**, porque no había forma de entregarle su código
 * a un cliente. Todo el que entrara, entraba al demo.
 *
 * ⚠️ Y NO SE VEÍA COMO UN DEFECTO: se veía como un código que funciona. El owner emitió dos «para prueba» y los
 * dos abrían el demo. Escribió el nombre de la empresa en el único campo que había —rotulado «nombre o
 * empresa»—, así que el error era del rótulo, no suyo. Un producto que invita a un error y después no lo
 * declara es peor que uno que no ofrece la función.
 *
 * No bloqueaba una prueba: bloqueaba el primer cliente real, que es lo que este frente vino a habilitar.
 *
 * @inspeccion-estatica · la sección 4 LEE `gatewayCore.js` como texto para comprobar que la emisión le pasa la
 * empresa. No lo importa, no invoca nada suyo y no abre un socket: el candado de runtime igual mataría el
 * proceso si lo intentara. Sin esta declaración, nombrar ese archivo dejaría al gate FUERA de la suite —
 * clasificado LIVE y sin correr nunca, que es el modo silencioso de no proteger nada.
 *
 * OFFLINE · firma HMAC local con un secreto de prueba + lectura del código fuente · no puede gastar. */
import { makeAccessCode, verifyAccessCode, parseAccessCode } from "./src/adi/llm/accessToken.js";
import { resolverTenantDeSesion } from "./src/data/tenantService.server.js";
import { readFileSync } from "node:fs";

let pass = 0, fail = 0;
const ok = (cond, label, detalle) => {
  if (cond) { pass++; console.log(`  ✓ ${label}`); }
  else { fail++; console.log(`  ✗ FALLO: ${label}`); if (detalle !== undefined) console.log(`      ${detalle}`); }
};

const SECRET = "secreto-solo-de-este-gate-no-abre-nada";
const ENV = { ADI_TOKEN_SECRET: SECRET };

console.log("\n" + "=".repeat(100));
console.log("1 · EL CASO DEL OWNER · un código para «prueba» resuelve prueba, no demo");
console.log("=".repeat(100));
{
  const { code } = await makeAccessCode("Juan Perez", 72, SECRET, Date.now(), "prueba");

  const leido = parseAccessCode(code);
  ok(leido && leido.tenant === "prueba", `el código LEE «prueba»: ${leido && leido.tenant}`);

  const v = await verifyAccessCode(code, SECRET);
  ok(v.ok && v.tenant === "prueba", `y VERIFICADO sigue diciendo «prueba»: ${v.tenant}`);
  ok(v.name === "Juan Perez", `el nombre es el nombre, separado de la empresa: «${v.name}»`);

  /* Lo que de verdad importa: qué empresa le SIRVE el producto.
   *
   * ⚠️ SE USA UNA EMPRESA DEL REGISTRO COMPILADO, y la primera versión de este chequeo no lo hacía: pedía
   * «prueba», que solo existe en Supabase. Sin base configurada `resolverTenantDeSesion` la rechaza —con toda
   * la razón, es su chequeo de «empresa no habilitada en esta build»— y el gate se ponía rojo culpando a la
   * emisión de algo que estaba bien. Lo que hay que probar acá es que la empresa FIRMADA manda; qué empresas
   * existen es otra pregunta, y la contesta la base. */
  const { code: codeE2 } = await makeAccessCode("Juan Perez", 72, SECRET, Date.now(), "empresa2");
  const r = await resolverTenantDeSesion({ access: codeE2 }, ENV);
  ok(r.ok && r.tenantId === "empresa2",
    `⚠️ y la sesión abre la empresa del código, NO el demo: ${r.tenantId}`,
    `esto es exactamente lo que fallaba: dos códigos emitidos «para prueba» abrían demo`);
}

console.log("\n" + "=".repeat(100));
console.log("2 · COMPATIBILIDAD · lo emitido antes sigue valiendo, y sigue siendo demo");
console.log("=".repeat(100));
{
  /* La condición del owner. Un código sin empresa tiene que quedar BYTE-IDÉNTICO al histórico: si el payload
   * cambiara de forma, todos los códigos ya repartidos dejarían de verificar. */
  /* ⚠️ ESTE BLOQUE TENÍA BOMBA DE TIEMPO (cazada 2026-09-01). Emitía el código con una fecha CONGELADA
   * (1788000000000 = 29-ago-2026 10:40) y después lo VERIFICABA contra el reloj real. El código vive 72 h, así
   * que el gate estuvo verde hasta las 10:40 del 1-sep y se puso rojo a las 10:41 — sin que nadie tocara una
   * línea del producto. Dos horas de diagnóstico buscando una rotura de aislamiento de datos que no existía.
   *
   * LA CAUSA DE FONDO: el bloque mezclaba dos cosas que necesitan tiempos distintos. La FORMA del payload se
   * mide con fecha congelada —es lo único que hace comparables dos códigos byte a byte—, pero la CONDUCTA
   * (verificar, resolver la sesión) necesita un código vigente. Se separan: cada mitad con el tiempo que le
   * corresponde. `resolverTenantDeSesion` no recibe `now`, así que su código tiene que nacer vigente. */
  const CONGELADA = 1788000000000;   // solo para comparar FORMA, jamás para verificar
  const sin = await makeAccessCode("invitado", 72, SECRET, CONGELADA);
  const conDemo = await makeAccessCode("invitado", 72, SECRET, CONGELADA, "demo");
  ok(sin.code === conDemo.code,
    "pedir «demo» explícitamente da el MISMO código que no pedir nada: el payload no cambia de forma");

  const vigente = await makeAccessCode("invitado", 72, SECRET, Date.now());
  const v = await verifyAccessCode(vigente.code, SECRET);
  ok(v.ok && v.tenant === "demo", `un código sin empresa se resuelve como demo: ${v.tenant}`);
  const r = await resolverTenantDeSesion({ access: vigente.code }, ENV);
  ok(r.ok && r.tenantId === "demo", "…y la sesión abre el demo, como siempre");

  /* Y que la fecha congelada siga sirviendo para lo suyo: un código vencido NO entra. Sin este chequeo,
   * cambiar la constante de arriba por `Date.now()` haría pasar todo el bloque sin medir el vencimiento. */
  const vencido = await verifyAccessCode(sin.code, SECRET);
  ok(!vencido.ok && vencido.reason === "expired",
    `el código de fecha congelada YA venció y se rechaza: ${vencido.reason}`);

  /* Y el payload no lleva el campo cuando no hace falta — es lo que hace que sea byte-idéntico. */
  const cuerpo = JSON.parse(Buffer.from(sin.code.split(".")[0].slice(4).replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8"));
  ok(!("t" in cuerpo), `el campo de empresa NO se escribe cuando es demo: ${JSON.stringify(cuerpo)}`);
}

console.log("\n" + "=".repeat(100));
console.log("3 · LO QUE NO SE FIRMA · un identificador inválido no se cuela");
console.log("=".repeat(100));
{
  for (const malo of ["Empresa X", "PRUEBA!", "  ", "con espacio", "acentuadá", "a".repeat(40)]) {
    const { code, tenant } = await makeAccessCode("x", 72, SECRET, Date.now(), malo);
    const v = await verifyAccessCode(code, SECRET);
    ok(tenant === "demo" && v.tenant === "demo",
      `«${malo}» no se firma como empresa: cae a demo en vez de emitir un código que nadie puede usar`);
  }
  /* Y el que sí es válido, se firma. Sin esto lo de arriba pasaría aunque la función rechazara todo. */
  const bueno = await makeAccessCode("x", 72, SECRET, Date.now(), "  ACME-2  ");
  ok(bueno.tenant === "acme-2", `un id válido se normaliza y se firma: «${bueno.tenant}»`);
}

console.log("\n" + "=".repeat(100));
console.log("4 · QUE EL PRODUCTO LO USE · la emisión tiene que PASAR la empresa");
console.log("=".repeat(100));
{
  /* ⚠️ ESTA SECCIÓN ES LA QUE HABRÍA CAZADO EL DEFECTO. Todo lo de arriba ya funcionaba antes: `makeAccessCode`
   * SIEMPRE supo firmar la empresa. Lo que faltaba era que alguien se la pasara. Un candado que solo probara la
   * primitiva habría estado verde durante todo el tiempo que el producto fue incapaz de emitir un código real. */
  const core = readFileSync("./src/adi/llm/gatewayCore.js", "utf8");
  /* `[^)]*` no servía: el cuarto argumento es `Date.now()` y tiene un paréntesis adentro, así que la regex
   * cortaba antes de llegar a la empresa y el chequeo se ponía rojo con el código correcto. */
  ok(/makeAccessCode\([\s\S]{0,80}?tenant/.test(core),
    "el servidor le pasa la empresa a `makeAccessCode` al emitir",
    (core.match(/makeAccessCode\([\s\S]{0,80}?\);/) || [""])[0]);
  ok(/tenantLimpio\(\s*body\.tenant\s*\)/.test(core),
    "…y la limpia antes de firmarla, en vez de firmar lo que llegue");

  const gate = readFileSync("./src/ui/AccessGate.jsx", "utf8");
  ok(/tenant:\s*tenant\.trim\(\)/.test(gate), "la pantalla de emisión MANDA la empresa al servidor");
  ok(/const \[tenant, setTenant\]/.test(gate), "…y tiene su propio campo, separado del nombre");
  ok(!/Para quién \(nombre o empresa\)/.test(gate),
    "⚠️ y el rótulo ya no invita a escribir la empresa en el campo del nombre: ese error lo cometió el owner por culpa del rótulo");
}

console.log("\n" + "=".repeat(100));
console.log("5 · CARNADA · el chequeo tiene que poder ponerse rojo");
console.log("=".repeat(100));
{
  /* Se reproduce la llamada VIEJA —sin empresa— y se comprueba que produce exactamente el defecto que el owner
   * vio: un código que dice «prueba» en el nombre y abre el demo. */
  const comoAntes = await makeAccessCode("empresa2", 72, SECRET);
  const r = await resolverTenantDeSesion({ access: comoAntes.code }, ENV);
  ok(r.tenantId === "demo",
    "emitiendo como antes (sin empresa) el código abre DEMO aunque el NOMBRE diga otra cosa — el defecto era real");

  const ahora = await makeAccessCode("Juan Perez", 72, SECRET, Date.now(), "empresa2");
  const r2 = await resolverTenantDeSesion({ access: ahora.code }, ENV);
  ok(r2.tenantId === "empresa2" && r2.tenantId !== r.tenantId,
    "…y emitiendo con empresa abre esa empresa: los dos caminos dan distinto, así que esto mide algo");

  /* ⚠️ LA MUTACIÓN TIENE QUE GOLPEAR LA LLAMADA, NO EL IMPORT. `makeAccessCode` aparece primero en la línea de
   * imports, así que un reemplazo genérico la tocaba a ella y dejaba la llamada intacta: la carnada no
   * simulaba nada y se ponía roja. Se apunta a la llamada por su forma completa. */
  const core = readFileSync("./src/adi/llm/gatewayCore.js", "utf8");
  const roto = core.replace(/await makeAccessCode\([^;]*\);/, "await makeAccessCode(name, hours, secret);");
  ok(roto !== core, "la carnada encuentra la llamada real que hay que romper");
  ok(!/await makeAccessCode\([^;]*tenant/.test(roto),
    "y volver a la llamada vieja pondría roja la sección 4");
}

console.log(`\n── _emision_por_empresa_gate: ${pass} PASS · ${fail} FAIL (de ${pass + fail}) ──`);
process.exit(fail === 0 ? 0 : 1);
