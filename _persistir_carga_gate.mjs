/* === _persistir_carga_gate.mjs · LA CARGA DEJA RASTRO, Y NO SE ADOPTA SOLA (vía 3 · paso 3.c) ============
 *
 * QUÉ VIGILA. El momento en que el dato de un cliente pasa de ser una variable a ser una fila. Tres cosas
 * tienen que ser ciertas a la vez y ninguna se ve mirando la pantalla:
 *
 *   1 · SIN BASE O SIN SESIÓN VERIFICADA, NO SE GUARDA — y la carga funciona igual que siempre. Es la bandera
 *       que el owner pidió: sin credenciales, el producto se comporta exactamente como antes de este frente.
 *   2 · GUARDAR NO ES ACTIVAR. La versión nace inactiva; adoptarla es del usuario. Si esto se rompiera, subir
 *       un archivo cambiaría el negocio del que ADI habla sin que nadie lo haya confirmado.
 *   3 · UN PROBLEMA DE BASE NO PUEDE ROMPER UNA CARGA VÁLIDA. El usuario hizo su parte; convertir un fallo
 *       nuestro en «archivo rechazado» sería cobrarle a él un error nuestro.
 *
 * ⚠️ POR QUÉ NO SE CAE AL DEMO. Sin la puerta armada, la sesión cae a la empresa de demostración: eso es
 * correcto para MOSTRAR y sería un desastre para GUARDAR — metería el archivo real de un cliente adentro del
 * ejemplo. La sección 2 es exactamente esa distinción.
 *
 * POR QUÉ CORRE SIN BASE Y SIN CREDENCIALES: `persistirCarga` recibe el cliente inyectado, así que se ejerce
 * contra un doble en memoria. Lo único que no se puede probar acá es que Supabase responda — y eso no es un
 * chequeo, es un despliegue.
 *
 * OFFLINE · un doble en memoria + la ingesta determinística · no puede gastar. */
import { persistirCarga, cargasPrevias, activarVersion, hashSha256 } from "./src/ingesta/persistirCarga.server.js";
import { selloDeLaLectura, confirmarSello } from "./src/ingesta/plausibilidad.js";
import { handleIngesta } from "./src/ingesta/handleIngesta.server.js";
import { crearClienteRest } from "./src/data/supabaseRest.js";
import { verificarPase } from "./src/data/paseTenant.js";
import { plantillaEjemplo } from "./src/ingesta/plantilla/generarPlantilla.js";
import { makeAccessCode } from "./src/adi/llm/accessToken.js";

let pass = 0, fail = 0;
const ok = (cond, label, detalle) => {
  if (cond) { pass++; console.log(`  ✓ ${label}`); }
  else { fail++; console.log(`  ✗ ${label}`); if (detalle !== undefined) console.log(`      ${detalle}`); }
};

const SECRETO_PUERTA = "secreto-de-puerta-de-prueba";
const ENV_CON_BASE = {
  SUPABASE_URL: "https://proyecto-de-prueba.supabase.co",
  SUPABASE_ANON_KEY: "llave-publica-de-prueba",
  SUPABASE_JWT_SECRET: "secreto-jwt-de-prueba",
  ADI_TOKEN_SECRET: SECRETO_PUERTA,
};

const DATASET = { id: "acme", nombre: "ACME", perfil: {}, skuInventario: [] };
const SELLO = { conAlarmas: true, confirmadoPorElUsuario: false, tipos: ["periodo-corto"], nota: "hay una observación sin resolver" };
const BYTES = new Uint8Array([80, 75, 3, 4, 9, 9, 9]);

/* ── EL DOBLE ────────────────────────────────────────────────────────────────────────────────────────────
 * Responde como respondería la base, y REGISTRA todo. `versionesPrevias` deja simular una empresa que ya
 * tiene historia; `falla` deja simular que una operación puntual se cae. */
function doble({ versionesPrevias = [], falla = {}, cargasConHash = [], versionActiva = [] } = {}) {
  const log = [];
  const cli = {
    async seleccionar(tabla, o) {
      log.push({ op: "seleccionar", tabla, ...o });
      if (falla.seleccionar === tabla) return { ok: false, motivo: "la base respondió 500" };
      if (tabla === "fact_pack_versions") {
        /* Buscar POR ID es leer una versión puntual (activar); buscar por empresa es pedir la última (guardar).
         * El doble distingue igual que la base, o si no `activarVersion` recibiría la lista equivocada. */
        return { ok: true, filas: o && o.filtros && o.filtros.id ? versionActiva : versionesPrevias };
      }
      if (tabla === "uploads") return { ok: true, filas: cargasConHash };
      return { ok: true, filas: [] };
    },
    async insertar(tabla, o) {
      log.push({ op: "insertar", tabla, ...o });
      if (falla.insertar === tabla) return { ok: false, motivo: "la base rechazó la fila" };
      const fila = Array.isArray(o.filas) ? o.filas[0] : o.filas;
      return { ok: true, filas: [{ ...fila, id: `${tabla}-id-1` }] };
    },
    async actualizar(tabla, o) {
      log.push({ op: "actualizar", tabla, ...o });
      if (falla.actualizar === tabla) return { ok: false, motivo: "la base rechazó el cambio" };
      return { ok: true, filas: [] };
    },
    async subirObjeto(bucket, ruta, bytes, o) {
      log.push({ op: "subirObjeto", bucket, ruta, bytes, ...o });
      if (falla.subirObjeto) return { ok: false, motivo: "el depósito no respondió" };
      return { ok: true, filas: [] };
    },
    async llamarFuncion(nombre, argumentos, o) {
      log.push({ op: "llamarFuncion", nombre, argumentos, ...o });
      if (falla.llamarFuncion === nombre) return { ok: false, motivo: "la base rechazó la llamada" };
      return { ok: true, filas: [{ id: argumentos.p_version_id, version: 3, activa: true }] };
    },
  };
  return { cli, log };
}

console.log("\n" + "=".repeat(100));
console.log("1 · EL DOBLE TIENE LA MISMA FORMA QUE EL CLIENTE REAL");
console.log("=".repeat(100));
{
  /* Sin esto, el doble podría quedarse atrás del cliente real y todo lo de abajo estaría probando una interfaz
   * que ya no existe — el modo más silencioso que tiene una prueba de dejar de medir. */
  const real = crearClienteRest({ url: "https://x.supabase.co", apikey: "k", transporte: async () => ({}) });
  const { cli } = doble();
  const faltan = Object.keys(real).filter((m) => typeof cli[m] !== "function");
  ok(faltan.length === 0, `el doble implementa los ${Object.keys(real).length} métodos del cliente real`, `faltan: ${faltan.join(" · ")}`);
  const sobran = Object.keys(cli).filter((m) => typeof real[m] !== "function");
  ok(sobran.length === 0, "…y ninguno de más: no se prueba contra un método inventado", `sobran: ${sobran.join(" · ")}`);
}

console.log("\n" + "=".repeat(100));
console.log("2 · SIN BASE O SIN SESIÓN VERIFICADA, NO SE GUARDA NADA");
console.log("=".repeat(100));
{
  const sinBase = await persistirCarga({ tenantId: "acme", bytes: BYTES, dataset: DATASET, env: {} });
  ok(!sinBase.guardado && /no configurada/.test(sinBase.motivo), `sin variables: «${sinBase.motivo}»`);

  const sinEmpresa = await persistirCarga({ bytes: BYTES, dataset: DATASET, env: ENV_CON_BASE, cliente: doble().cli });
  ok(!sinEmpresa.guardado && /sin sesión/.test(sinEmpresa.motivo), `sin empresa: «${sinEmpresa.motivo}»`);

  const sinSecreto = await persistirCarga({
    tenantId: "acme", bytes: BYTES, dataset: DATASET, cliente: doble().cli,
    env: { ...ENV_CON_BASE, SUPABASE_JWT_SECRET: "" },
  });
  ok(!sinSecreto.guardado && /pase/.test(sinSecreto.motivo), `sin secreto de firma: «${sinSecreto.motivo}»`);

  /* Y que ninguna de las tres haya TOCADO la base: no alcanza con devolver `guardado:false`. */
  const { cli, log } = doble();
  await persistirCarga({ bytes: BYTES, dataset: DATASET, env: ENV_CON_BASE, cliente: cli });
  ok(log.length === 0, "…y en ninguno de esos casos se escribió una sola fila");
}

console.log("\n" + "=".repeat(100));
console.log("3 · CUANDO SÍ GUARDA · el orden, la forma y lo que queda escrito");
console.log("=".repeat(100));
{
  const { cli, log } = doble();
  const r = await persistirCarga({
    tenantId: "acme", bytes: BYTES, nombreArchivo: "mis-datos.xlsx", dataset: DATASET,
    sello: SELLO, plantillaVersion: "v1", env: ENV_CON_BASE, cliente: cli,
  });
  ok(r.guardado, "guarda", r.motivo);
  ok(r.version === 1, `una empresa sin historia empieza en la versión 1: ${r.version}`);

  const orden = log.map((x) => `${x.op}:${x.tabla || x.bucket}`);
  ok(orden[0] === "insertar:uploads", `primero queda el rastro del archivo: ${orden[0]}`);
  ok(orden.includes("subirObjeto:adi-originales"), "después va el original al depósito");
  ok(orden.indexOf("insertar:fact_pack_versions") > orden.indexOf("insertar:uploads"),
    `y la versión del pack al final: ${orden.join(" → ")}`);

  const up = log.find((x) => x.op === "insertar" && x.tabla === "uploads").filas;
  ok(up.hash_sha256 && /^[0-9a-f]{64}$/.test(up.hash_sha256), `el hash queda escrito: ${String(up.hash_sha256).slice(0, 16)}…`);
  ok(up.tipo === "negocio", "…con el tipo declarado desde el día uno");
  ok(up.bytes === BYTES.length, `…y el peso real del archivo: ${up.bytes}`);

  const obj = log.find((x) => x.op === "subirObjeto");
  ok(obj.ruta === "acme/uploads-id-1.xlsx",
    `⚠️ la ruta empieza por la empresa, que es lo que la política del depósito compara: ${obj.ruta}`);

  const ver = log.find((x) => x.op === "insertar" && x.tabla === "fact_pack_versions").filas;
  ok(ver.activa === false, "⚠️ LA VERSIÓN NACE INACTIVA: subir un archivo no es adoptarlo");
  ok(ver.pack === DATASET, "el pack va entero adentro de la versión");
  ok(ver.sello === SELLO, "…y el sello de plausibilidad viaja con él, no en `uploads`");
  ok(ver.sello.confirmadoPorElUsuario === false,
    "⚠️ …y SIN confirmar: el usuario todavía no decidió, y una fila no puede afirmar que sí");
  ok(ver.upload_id === "uploads-id-1", "la versión apunta al archivo que la produjo");
  ok(ver.plantilla_version === "v1", "…y deja escrita con qué versión de plantilla se leyó");

  const cierre = log.filter((x) => x.op === "actualizar" && x.tabla === "uploads");
  ok(cierre.some((x) => x.cambios.estado === "ingestado"), "y el archivo queda marcado como ingestado");
}

console.log("\n" + "=".repeat(100));
console.log("4 · EL PASE QUE SE USA LLEVA LA EMPRESA CORRECTA");
console.log("=".repeat(100));
{
  const { cli, log } = doble();
  await persistirCarga({ tenantId: "acme", bytes: BYTES, dataset: DATASET, env: ENV_CON_BASE, cliente: cli });
  const pases = [...new Set(log.map((x) => x.pase))];
  ok(pases.length === 1 && pases[0], "todas las operaciones van con un único pase");
  const v = await verificarPase(pases[0], ENV_CON_BASE.SUPABASE_JWT_SECRET);
  ok(v.ok && v.tenantId === "acme", `y ese pase dice «acme»: ${v.tenantId || v.motivo}`);

  /* Y el reverso, que es lo que hace útil al chequeo: el pase de una empresa NO verifica como el de otra. */
  const { cli: c2, log: l2 } = doble();
  await persistirCarga({ tenantId: "otra", bytes: BYTES, dataset: DATASET, env: ENV_CON_BASE, cliente: c2 });
  const v2 = await verificarPase(l2[0].pase, ENV_CON_BASE.SUPABASE_JWT_SECRET);
  ok(v2.tenantId === "otra" && v2.tenantId !== v.tenantId, "…y una carga de otra empresa lleva otro pase: distingue");
}

console.log("\n" + "=".repeat(100));
console.log("5 · LA VERSIÓN SIGUIENTE, Y LA CARRERA QUE GANA LA BASE");
console.log("=".repeat(100));
{
  const { cli } = doble({ versionesPrevias: [{ version: 7 }] });
  const r = await persistirCarga({ tenantId: "acme", bytes: BYTES, dataset: DATASET, env: ENV_CON_BASE, cliente: cli });
  ok(r.version === 8, `con una versión 7 previa, la nueva es la 8: ${r.version}`);

  /* Dos cargas simultáneas pueden leer el mismo máximo. La segunda choca contra `unique (tenant_id, version)`
   * y se rechaza CON MOTIVO — que es lo correcto: se pierde una carga, no se pisa la otra. */
  const { cli: c2 } = doble({ versionesPrevias: [{ version: 7 }], falla: { insertar: "fact_pack_versions" } });
  const r2 = await persistirCarga({ tenantId: "acme", bytes: BYTES, dataset: DATASET, env: ENV_CON_BASE, cliente: c2 });
  ok(!r2.guardado && /no se pudo guardar la versión/.test(r2.motivo),
    `un choque de versión se informa, no se pisa: «${r2.motivo}»`);
  ok(r2.uploadId, "…y el rastro del archivo queda igual, para saber que la carga existió");
}

console.log("\n" + "=".repeat(100));
console.log("6 · EL ORIGINAL ES DESEABLE, NO IMPRESCINDIBLE");
console.log("=".repeat(100));
{
  const { cli, log } = doble({ falla: { subirObjeto: true } });
  const r = await persistirCarga({ tenantId: "acme", bytes: BYTES, dataset: DATASET, env: ENV_CON_BASE, cliente: cli });
  ok(r.guardado, "si el depósito falla, la versión se guarda igual", r.motivo);
  ok(r.original === null, "…y se declara que no quedó original, en vez de fingir que sí");
  ok(!log.some((x) => x.op === "actualizar" && x.cambios && x.cambios.storage_path),
    "…y no se escribe una ruta que no existe");

  /* El reverso: cuando el depósito responde, la ruta SÍ se escribe. Sin esto, el chequeo de arriba pasaría
   * aunque la ruta no se guardara nunca. */
  const { cli: c2, log: l2 } = doble();
  const r2 = await persistirCarga({ tenantId: "acme", bytes: BYTES, dataset: DATASET, env: ENV_CON_BASE, cliente: c2 });
  ok(r2.original === "acme/uploads-id-1.xlsx" && l2.some((x) => x.cambios && x.cambios.storage_path),
    "…y cuando el depósito responde, la ruta queda escrita");
}

console.log("\n" + "=".repeat(100));
console.log("7 · SI FALLA EL PRIMER PASO, NO SE SIGUE");
console.log("=".repeat(100));
{
  const { cli, log } = doble({ falla: { insertar: "uploads" } });
  const r = await persistirCarga({ tenantId: "acme", bytes: BYTES, dataset: DATASET, env: ENV_CON_BASE, cliente: cli });
  ok(!r.guardado, "no se puede registrar la carga → no se guarda");
  ok(!log.some((x) => x.tabla === "fact_pack_versions"), "…y no se intenta guardar una versión huérfana");
  ok(!log.some((x) => x.op === "subirObjeto"), "…ni se sube un archivo que nadie va a poder encontrar");
  ok(Boolean(r.hash), "…pero el hash se informa igual: sirve para diagnosticar");
}

console.log("\n" + "=".repeat(100));
console.log("8 · EL HASH ES UN SHA-256 DE VERDAD");
console.log("=".repeat(100));
{
  /* Contra el vector conocido del vacío. Un hash «propio» que nadie puede reproducir no sirve para auditar. */
  const vacio = await hashSha256(new Uint8Array());
  ok(vacio === "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    `el sha-256 del vacío coincide con el vector conocido: ${vacio.slice(0, 16)}…`);
  const a = await hashSha256(new Uint8Array([1, 2, 3]));
  const b = await hashSha256(new Uint8Array([1, 2, 4]));
  ok(a !== b, "…y dos archivos distintos dan hashes distintos");
}

console.log("\n" + "=".repeat(100));
console.log("9 · «ESTE ARCHIVO YA LO SUBISTE» · avisa, no bloquea");
console.log("=".repeat(100));
{
  const hash = await hashSha256(BYTES);
  const conPrevia = doble({ cargasConHash: [{ created_at: "2026-08-12T10:00:00Z" }] });
  const r = await cargasPrevias({ tenantId: "acme", hash, env: ENV_CON_BASE, cliente: conPrevia.cli });
  ok(r.hubo && r.cuando === "2026-08-12", `avisa con la fecha: ${r.cuando}`);

  const sinPrevia = doble();
  const r2 = await cargasPrevias({ tenantId: "acme", hash, env: ENV_CON_BASE, cliente: sinPrevia.cli });
  ok(!r2.hubo, "…y no avisa cuando el archivo es nuevo: distingue");

  /* Y lo que importa: haber subido el mismo archivo antes NO impide subirlo de nuevo. */
  const { cli } = doble({ cargasConHash: [{ created_at: "2026-08-12T10:00:00Z" }] });
  const g = await persistirCarga({ tenantId: "acme", bytes: BYTES, dataset: DATASET, env: ENV_CON_BASE, cliente: cli });
  ok(g.guardado, "⚠️ y repetir un archivo NO bloquea la carga: el hash audita, no veta");
}

console.log("\n" + "=".repeat(100));
console.log("10 · LA INGESTA COMPLETA · sin credenciales se comporta exactamente como antes");
console.log("=".repeat(100));
{
  const archivo = Buffer.from(plantillaEjemplo()).toString("base64");

  /* Sin nada configurado: es el producto de hoy, tal cual. */
  const hoy = await handleIngesta({ archivo, nombre: "ejemplo.xlsx" }, {});
  ok(hoy.ok, "la carga funciona sin base configurada", hoy.motivo);
  ok(hoy.preview && hoy.dataset, "…y devuelve preview y dataset como siempre");
  ok(hoy.persistencia && hoy.persistencia.guardado === false, "…declarando que no guardó");

  /* Con la puerta armada y un código válido, PERO sin base: prueba que el camino llega hasta el intento — es
   * decir, que el código se verificó, que salió la empresa y que se llamó a guardar. */
  const { code } = await makeAccessCode("prueba", 72, SECRETO_PUERTA, Date.now(), "acme");
  const conCodigo = await handleIngesta({ archivo, nombre: "ejemplo.xlsx", access: code },
    { ADI_TOKEN_SECRET: SECRETO_PUERTA });
  ok(conCodigo.ok, "con código válido la carga sigue funcionando");
  ok(/no configurada/.test(conCodigo.persistencia.motivo),
    `⚠️ el código se verificó y se llegó a intentar guardar: «${conCodigo.persistencia.motivo}»`);

  /* Con la puerta armada pero SIN código: no se guarda, y el motivo lo dice. */
  const sinCodigo = await handleIngesta({ archivo, nombre: "ejemplo.xlsx" }, { ADI_TOKEN_SECRET: SECRETO_PUERTA });
  ok(/sin sesión/.test(sinCodigo.persistencia.motivo), `sin código no se guarda: «${sinCodigo.persistencia.motivo}»`);

  /* ⚠️ Y EL CASO QUE IMPORTA: sin la puerta armada, la sesión cae al demo para MOSTRAR — pero no se guarda ahí.
   * Un archivo real de un cliente adentro del negocio de ejemplo sería el peor resultado posible. */
  const sinPuerta = await handleIngesta({ archivo, nombre: "ejemplo.xlsx", access: code }, {});
  ok(/sin sesión/.test(sinPuerta.persistencia.motivo),
    `sin puerta armada NO se guarda en el demo: «${sinPuerta.persistencia.motivo}»`);

  /* Un código de OTRO secreto no sirve: la empresa sale de lo verificado, no de lo que el navegador afirme. */
  const ajeno = await makeAccessCode("intruso", 72, "otro-secreto-cualquiera", Date.now(), "acme");
  const conAjeno = await handleIngesta({ archivo, nombre: "ejemplo.xlsx", access: ajeno.code },
    { ADI_TOKEN_SECRET: SECRETO_PUERTA });
  ok(/sin sesión/.test(conAjeno.persistencia.motivo), "un código firmado con otro secreto no habilita a guardar");
}

console.log("\n" + "=".repeat(100));
console.log("11 · ACTIVAR · confirmar y adoptar son el mismo acto (3.d)");
console.log("=".repeat(100));
{
  const SIN_CONFIRMAR = { conAlarmas: true, confirmadoPorElUsuario: false, tipos: ["a", "b"], observaciones: [], nota: "hay 2 observaciones sin resolver sobre este archivo" };
  const { cli, log } = doble({ versionActiva: [{ sello: SIN_CONFIRMAR }] });
  const r = await activarVersion({ tenantId: "acme", versionId: "v-1", env: ENV_CON_BASE, cliente: cli });
  ok(r.activada, "activa la versión", r.motivo);
  ok(r.version === 3, `y devuelve qué versión quedó activa: ${r.version}`);

  const llamada = log.find((x) => x.op === "llamarFuncion");
  ok(llamada && llamada.nombre === "adi_activar_version",
    "⚠️ pasa por la función de la base, no por dos escrituras sueltas: apagar y encender son una transacción");
  ok(llamada.argumentos.p_version_id === "v-1", "…con la versión que se pidió");
  ok(llamada.argumentos.p_sello.confirmadoPorElUsuario === true,
    "⚠️ y el sello pasa a CONFIRMADO en el mismo acto: no queda una versión activa que diga que nadie la asumió");
  ok(/confirmaste/.test(llamada.argumentos.p_sello.nota), `…con la nota reescrita: «${llamada.argumentos.p_sello.nota}»`);

  /* El sello sale de la fila GUARDADA, no de lo que mande el navegador. */
  const leyo = log.find((x) => x.op === "seleccionar" && x.tabla === "fact_pack_versions");
  ok(leyo && leyo.filtros.id === "eq.v-1", "lee el sello guardado antes de confirmarlo, en vez de aceptar el que le pasen");

  ok(!(await activarVersion({ versionId: "v-1", env: ENV_CON_BASE, cliente: doble().cli })).activada, "sin empresa no activa");
  ok(!(await activarVersion({ tenantId: "acme", env: ENV_CON_BASE, cliente: doble().cli })).activada, "sin versión no activa");
  ok(!(await activarVersion({ tenantId: "acme", versionId: "v-1", env: {} })).activada, "sin base no activa");

  const ajena = await activarVersion({ tenantId: "acme", versionId: "de-otra", env: ENV_CON_BASE, cliente: doble().cli });
  ok(!ajena.activada && /no existe para esta empresa/.test(ajena.motivo),
    `⚠️ una versión que el pase no alcanza no se activa: «${ajena.motivo}» — RLS la hace invisible, no hace falta compararla a mano`);

  const rota = doble({ versionActiva: [{ sello: SIN_CONFIRMAR }], falla: { llamarFuncion: "adi_activar_version" } });
  const r2 = await activarVersion({ tenantId: "acme", versionId: "v-1", env: ENV_CON_BASE, cliente: rota.cli });
  ok(!r2.activada && /no se pudo activar/.test(r2.motivo), `si la base rechaza, se informa: «${r2.motivo}»`);
}

console.log("\n" + "=".repeat(100));
console.log("12 · UNA SOLA REDACCIÓN DEL SELLO · el defecto que este producto persigue");
console.log("=".repeat(100));
{
  /* ⚠️ ESTE ES EL CHEQUEO MÁS IMPORTANTE DE LA SECCIÓN ANTERIOR. Al confirmar ya no hay `lectura` a mano —solo
   * el sello guardado—, así que había dos formas de llegar al mismo texto: redactarlo de nuevo, o derivarlo.
   * Redactarlo de nuevo habría creado DOS VERDADES sobre el mismo hallazgo, que es exactamente el defecto que
   * este producto trata como falla en todas sus superficies. Acá se comprueba que los dos caminos coinciden. */
  const casos = [
    { hayAlarmas: true, alarmas: [{ tipo: "periodo-corto" }] },
    { hayAlarmas: true, alarmas: [{ tipo: "periodo-corto" }, { tipo: "inventario-sobre-techo" }] },
    { hayAlarmas: true, alarmas: [{ tipo: "a" }, { tipo: "b" }, { tipo: "c" }] },
  ];
  for (const l of casos) {
    const directo = selloDeLaLectura(l, { confirmado: true });
    const derivado = confirmarSello(selloDeLaLectura(l, { confirmado: false }));
    ok(JSON.stringify(directo) === JSON.stringify(derivado),
      `con ${l.alarmas.length} observación(es), confirmar el sello guardado da EXACTAMENTE lo mismo que redactarlo de cero`,
      `directo:  ${JSON.stringify(directo)}\n      derivado: ${JSON.stringify(derivado)}`);
  }
  ok(confirmarSello(null) === null, "un sello vacío no se inventa: sin alarmas no hay nada que asumir");
  ok(confirmarSello(selloDeLaLectura({ hayAlarmas: false }, {})) === null, "…y una lectura sin alarmas tampoco");
}

console.log("\n" + "=".repeat(100));
console.log("13 · ACTIVAR POR EL ENDPOINT · la mitad que le toca a la pantalla");
console.log("=".repeat(100));
{
  const sinSesion = await handleIngesta({ op: "activar", versionId: "v-1" }, { ADI_TOKEN_SECRET: SECRETO_PUERTA });
  ok(!sinSesion.ok && /sin sesión/.test(sinSesion.motivo), `sin código no se activa: «${sinSesion.motivo}»`);

  const { code } = await makeAccessCode("prueba", 72, SECRETO_PUERTA, Date.now(), "acme");
  const sinBase = await handleIngesta({ op: "activar", versionId: "v-1", access: code }, { ADI_TOKEN_SECRET: SECRETO_PUERTA });
  ok(!sinBase.ok && /no configurada/.test(sinBase.motivo),
    `⚠️ con código válido se llega hasta el intento: «${sinBase.motivo}»`);

  /* Y que activar NO sea una puerta para leer otra cosa: la op solo hace eso. */
  ok(sinBase.op === "activar" && !sinBase.dataset && !sinBase.preview,
    "la respuesta de activar no arrastra dataset ni preview: hace una cosa sola");
}

console.log("\n" + "=".repeat(100));
console.log("14 · CARNADA · estos chequeos tienen que poder ponerse rojos");
console.log("=".repeat(100));
{
  /* El chequeo del «nace inactiva» solo vale si el doble registraría un `true`. Se fuerza el caso contrario
   * insertando a mano por el mismo camino y comprobando que el doble lo vería. */
  const { cli, log } = doble();
  await cli.insertar("fact_pack_versions", { pase: "x", filas: { activa: true } });
  ok(log[0].filas.activa === true,
    "el doble registra `activa` tal como se lo pasan: si el código guardara activo, la sección 3 lo vería");

  /* Y que la ingesta de verdad LLAMA a guardar: si no lo hiciera, todas las secciones de arriba probarían un
   * módulo que nadie usa. Se comprueba con el motivo, que solo puede venir de `persistirCarga`. */
  const archivo = Buffer.from(plantillaEjemplo()).toString("base64");
  const { code } = await makeAccessCode("prueba", 72, SECRETO_PUERTA, Date.now(), "acme");
  const r = await handleIngesta({ archivo, nombre: "e.xlsx", access: code }, { ADI_TOKEN_SECRET: SECRETO_PUERTA });
  const solo = await persistirCarga({ tenantId: "acme", bytes: new Uint8Array([1]), dataset: DATASET, env: {} });
  ok(r.persistencia.motivo === solo.motivo,
    `el motivo que devuelve la ingesta viene de `.concat(`\`persistirCarga\`: «${r.persistencia.motivo}»`));

  /* Y el control de que el guardado no es un «sí» automático: con base y sesión, guarda; sin ellas, no. */
  const { cli: c2 } = doble();
  const bueno = await persistirCarga({ tenantId: "acme", bytes: BYTES, dataset: DATASET, env: ENV_CON_BASE, cliente: c2 });
  ok(bueno.guardado && !solo.guardado, "guarda cuando corresponde y no cuando no: distingue, no dice que sí a todo");
}

console.log(`\n── _persistir_carga_gate: ${pass} PASS · ${fail} FAIL (de ${pass + fail}) ──`);
process.exit(fail === 0 ? 0 : 1);
