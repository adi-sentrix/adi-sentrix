/* === _pase_tenant_gate.mjs · EL PASE CORTO Y EL CLIENTE DE LA BASE (vía 3 · owner 2026-08-27) ===========
 *
 * QUÉ VIGILA. Las dos piezas que hacen que RLS proteja de verdad: el pase que le dice a la base de qué empresa
 * es cada consulta, y el cliente que lo manda. Si el pase se emitiera mal —vencimiento en milisegundos, rol
 * equivocado, empresa sin validar— la base no lo aceptaría o, peor, aceptaría algo que no queríamos.
 *
 * ⚠️ EL CHEQUEO MÁS IMPORTANTE DE ESTE ARCHIVO ES EL DE LA LLAVE DE SERVICIO. Esa llave se salta RLS entera.
 * El día que alguien copie una variable de entorno de más, el muro queda de adorno y NADA falla ni se pone
 * rojo: las consultas siguen funcionando, solo que sin aislamiento. Por eso el cliente la reconoce y se niega,
 * y por eso acá se prueba que se niega.
 *
 * POR QUÉ CORRE SIN CREDENCIALES Y SIN RED. El pase se firma y se verifica en memoria, y el cliente recibe un
 * TRANSPORTE DOBLE que responde sin salir a ningún lado. No hace falta el proyecto de Supabase creado para
 * saber si estas dos piezas están bien.
 *
 * OFFLINE · criptografía local + un doble en memoria · no puede gastar. */
import { emitirPase, verificarPase, leerPaseSinVerificar, esCredencialDeServicio, ROL_PASE, TTL_PASE_S } from "./src/data/paseTenant.js";
import { crearClienteRest, clienteDesdeEntorno, baseConfigurada } from "./src/data/supabaseRest.js";
import { b64urlDeTexto, textoDeB64url, makeAccessCode } from "./src/adi/llm/accessToken.js";

let pass = 0, fail = 0;
const ok = (cond, label, detalle) => {
  if (cond) { pass++; console.log(`  ✓ ${label}`); }
  else { fail++; console.log(`  ✗ ${label}`); if (detalle) console.log(`      ${detalle}`); }
};

const SECRETO = "secreto-de-prueba-que-no-abre-nada-real";
const OTRO = "otro-secreto-distinto";
const AHORA = 1756300000000;   // fijo: un candado que dependa del reloj falla de madrugada y nadie sabe por qué
const URL_FALSA = "https://proyecto-de-prueba.supabase.co";

/** Un token con la FORMA de una llave de Supabase. No está firmado con nada real: lo que importa es el rol,
 *  que viaja en el cuerpo a la vista y es lo único que hace falta para reconocerla. */
const llaveConRol = (rol) =>
  `${b64urlDeTexto(JSON.stringify({ alg: "HS256", typ: "JWT" }))}.${b64urlDeTexto(JSON.stringify({ role: rol, iss: "supabase" }))}.firma-de-mentira`;

const LLAVE_ANON = llaveConRol("anon");
const LLAVE_SERVICIO = llaveConRol("service_role");

console.log("\n" + "=".repeat(100));
console.log("1 · EL PASE SE EMITE Y SE VERIFICA");
console.log("=".repeat(100));
{
  const e = await emitirPase({ tenantId: "demo", secreto: SECRETO, ahora: AHORA });
  ok(e.ok, "se emite un pase para una empresa válida", e.motivo);

  const v = await verificarPase(e.pase, SECRETO, AHORA);
  ok(v.ok, "…y se verifica con el mismo secreto", v.motivo);
  ok(v.tenantId === "demo", `…y trae la empresa: ${v.tenantId}`);
  ok(v.rol === ROL_PASE, `…con el rol del producto y no uno de Supabase Auth: ${v.rol}`);

  const e2 = await emitirPase({ tenantId: "  EMPRESA2  ", secreto: SECRETO, ahora: AHORA });
  ok(e2.ok && e2.tenantId === "empresa2", "la empresa se normaliza igual que en la puerta (espacios y mayúsculas)");
}

console.log("\n" + "=".repeat(100));
console.log("2 · LA FORMA QUE LA BASE ESPERA");
console.log("=".repeat(100));
{
  const { pase } = await emitirPase({ tenantId: "demo", secreto: SECRETO, ahora: AHORA });
  const partes = pase.split(".");
  ok(partes.length === 3, "tres partes separadas por punto");

  const cab = JSON.parse(textoDeB64url(partes[0]));
  ok(cab.alg === "HS256" && cab.typ === "JWT", `cabecera HS256/JWT: ${JSON.stringify(cab)}`);

  const cuerpo = JSON.parse(textoDeB64url(partes[1]));
  ok(cuerpo.tenant_id === "demo", "el claim se llama `tenant_id` — el mismo nombre que lee `adi.tenant_actual()`");
  ok(cuerpo.role === ROL_PASE, "el claim `role` decide a qué rol se cambia PostgREST");

  /* ⚠️ SEGUNDOS, NO MILISEGUNDOS. Es la equivocación clásica de este formato, y no la caza ninguna prueba
   * funcional: con `exp` en milisegundos el pase queda válido hasta el año 57.000 y el vencimiento —que es la
   * razón de que sea CORTO— deja de existir sin que nada se rompa. */
  ok(cuerpo.iat === Math.floor(AHORA / 1000), `\`iat\` en segundos: ${cuerpo.iat}`);
  ok(cuerpo.exp === Math.floor(AHORA / 1000) + TTL_PASE_S, `\`exp\` en segundos y a ${TTL_PASE_S}s: ${cuerpo.exp}`);
  ok(String(cuerpo.exp).length === 10, "…y tiene largo de segundos (10 dígitos), no de milisegundos");
}

console.log("\n" + "=".repeat(100));
console.log("3 · LO QUE NO DEBE VALIDAR");
console.log("=".repeat(100));
{
  const { pase } = await emitirPase({ tenantId: "demo", secreto: SECRETO, ahora: AHORA });

  ok(!(await verificarPase(pase, OTRO, AHORA)).ok, "un pase firmado con otro secreto no vale");

  const partes = pase.split(".");
  const alterado = `${partes[0]}.${b64urlDeTexto(JSON.stringify({ role: ROL_PASE, tenant_id: "empresa2", iat: 1, exp: 9e9 }))}.${partes[2]}`;
  const va = await verificarPase(alterado, SECRETO, AHORA);
  ok(!va.ok, "cambiar la empresa del cuerpo rompe la firma: no se puede saltar de empresa a mano", va.tenantId);

  ok(!(await verificarPase(pase, SECRETO, AHORA + (TTL_PASE_S + 1) * 1000)).ok, "un pase vencido no vale");
  ok(!(await verificarPase("cualquier.cosa.rara", SECRETO, AHORA)).ok, "un texto que no es un pase no vale");
  ok(!(await verificarPase("", SECRETO, AHORA)).ok, "el vacío no vale");

  /* Un pase re-firmado con el secreto correcto pero con otro rol: la firma da bien y aun así se rechaza.
   * Sin esta comprobación, quien pudiera firmar podría pedirle a PostgREST el rol que quisiera. */
  const { firmarHmacB64u } = await import("./src/adi/llm/accessToken.js");
  const cab = b64urlDeTexto(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const cuerpoServicio = b64urlDeTexto(JSON.stringify({ role: "service_role", tenant_id: "demo", iat: 1, exp: 9e9 }));
  const firmado = `${cab}.${cuerpoServicio}.${await firmarHmacB64u(`${cab}.${cuerpoServicio}`, SECRETO)}`;
  const vr = await verificarPase(firmado, SECRETO, AHORA);
  ok(!vr.ok && vr.motivo === "rol no autorizado", "un pase bien firmado pero con otro rol se rechaza igual", vr.motivo);

  const sinSecreto = await emitirPase({ tenantId: "demo", secreto: "", ahora: AHORA });
  ok(!sinSecreto.ok, "sin secreto no se emite nada");
  const empresaMala = await emitirPase({ tenantId: "con espacio y acentó", secreto: SECRETO, ahora: AHORA });
  ok(!empresaMala.ok, "una empresa que no pasa el alfabeto no se emite");

  const codigoPuerta = (await makeAccessCode("prueba", 72, SECRETO, AHORA, "demo")).code;
  ok(!(await verificarPase(codigoPuerta, SECRETO, AHORA)).ok,
    "un código de acceso de la puerta NO es un pase de base: son dos credenciales distintas y no se confunden");
}

console.log("\n" + "=".repeat(100));
console.log("4 · LA LLAVE DE SERVICIO · el accidente que apagaría el muro en silencio");
console.log("=".repeat(100));
{
  ok(esCredencialDeServicio(LLAVE_SERVICIO), "se reconoce una llave de servicio por su rol");
  ok(!esCredencialDeServicio(LLAVE_ANON), "…y una llave pública no se confunde con ella");

  const { pase } = await emitirPase({ tenantId: "demo", secreto: SECRETO, ahora: AHORA });
  ok(!esCredencialDeServicio(pase), "…y un pase nuestro tampoco");

  let tiro = false;
  try { crearClienteRest({ url: URL_FALSA, apikey: LLAVE_SERVICIO }); } catch { tiro = true; }
  ok(tiro, "el cliente SE NIEGA A CONSTRUIRSE con la llave de servicio como apikey");

  const cli = crearClienteRest({ url: URL_FALSA, apikey: LLAVE_ANON, transporte: async () => { throw new Error("no debería llegar acá"); } });
  const r = await cli.seleccionar("fact_pack_versions", { pase: LLAVE_SERVICIO, filtros: { tenant_id: "eq.demo" } });
  ok(!r.ok, "…y se niega a usarla como pase, sin llegar a salir", r.motivo);
}

console.log("\n" + "=".repeat(100));
console.log("5 · EL CLIENTE ARMA LA CONSULTA QUE CORRESPONDE");
console.log("=".repeat(100));
{
  const visto = [];
  const responder = (estado, texto) => async (u, init) => {
    visto.push({ url: u, ...init });
    return { ok: estado >= 200 && estado < 300, status: estado, text: async () => texto };
  };

  const { pase } = await emitirPase({ tenantId: "demo", secreto: SECRETO, ahora: AHORA });
  const packDeMentira = JSON.stringify([{ pack: { id: "demo" }, sello: null, version: 3 }]);

  const cli = crearClienteRest({ url: URL_FALSA, apikey: LLAVE_ANON, transporte: responder(200, packDeMentira) });
  const r = await cli.seleccionar("fact_pack_versions", {
    pase, columnas: "pack,sello,version", filtros: { tenant_id: "eq.demo", activa: "is.true" }, limite: 1,
  });

  ok(r.ok && r.filas.length === 1, "una lectura devuelve las filas", r.motivo);
  const q = visto[0];
  ok(q.method === "GET", "…con el método correcto");
  ok(q.url.startsWith(`${URL_FALSA}/rest/v1/fact_pack_versions?`), `…contra la tabla pedida: ${q.url.slice(0, 70)}…`);
  ok(/tenant_id=eq\.demo/.test(q.url) && /activa=is\.true/.test(q.url), "…con los dos filtros en la consulta");
  ok(/select=pack%2Csello%2Cversion/.test(q.url), "…pidiendo solo las columnas necesarias");
  ok(q.headers.Authorization === `Bearer ${pase}`, "…y el pase viaja en la cabecera de autorización");
  ok(q.headers.apikey === LLAVE_ANON, "…junto con la llave pública del proyecto");

  const vacio = crearClienteRest({ url: URL_FALSA, apikey: LLAVE_ANON, transporte: responder(200, "[]") });
  const rv = await vacio.seleccionar("fact_pack_versions", { pase, filtros: { tenant_id: "eq.otra" } });
  ok(rv.ok && rv.filas.length === 0,
    "⚠️ CERO FILAS ES UN ÉXITO, NO UN ERROR: así es como falla cerrado cuando el pase no autoriza nada");

  const negado = crearClienteRest({ url: URL_FALSA, apikey: LLAVE_ANON, transporte: responder(401, "no autorizado") });
  const rn = await negado.seleccionar("uploads", { pase, filtros: { tenant_id: "eq.demo" } });
  ok(!rn.ok && rn.estado === 401, "un rechazo de la base se devuelve como `{ok:false}` y no como excepción");

  const alta = [];
  const cliAlta = crearClienteRest({
    url: URL_FALSA, apikey: LLAVE_ANON,
    transporte: async (u, init) => { alta.push({ url: u, ...init }); return { ok: true, status: 201, text: async () => "[]" }; },
  });
  await cliAlta.insertar("uploads", { pase, filas: { tenant_id: "demo", tipo: "negocio" }, devolver: true });
  ok(alta[0].method === "POST", "una inserción usa POST");
  ok(JSON.parse(alta[0].body).length === 1, "…con el cuerpo siempre como lista, aunque sea una fila");
  ok(/return=representation/.test(alta[0].headers.Prefer), "…y pide de vuelta lo insertado cuando se lo piden");
}

console.log("\n" + "=".repeat(100));
console.log("6 · LO QUE EL CLIENTE SE NIEGA A HACER");
console.log("=".repeat(100));
{
  const nunca = async () => { throw new Error("no debería salir"); };
  const cli = crearClienteRest({ url: URL_FALSA, apikey: LLAVE_ANON, transporte: nunca });
  const { pase } = await emitirPase({ tenantId: "demo", secreto: SECRETO, ahora: AHORA });

  ok(!(await cli.seleccionar("fact_pack_versions", { filtros: { tenant_id: "eq.demo" } })).ok,
    "sin pase no se consulta: no se habla con la base sin declarar de qué empresa es");
  ok(!(await cli.seleccionar("tabla; drop table", { pase })).ok, "un nombre de tabla que no es un identificador se rechaza");
  ok(!(await cli.seleccionar("uploads", { pase, filtros: { "tenant_id; --": "eq.x" } })).ok, "una columna que no es un identificador se rechaza");
  ok(!(await cli.seleccionar("uploads", { pase, filtros: { tenant_id: "raro.x" } })).ok, "un operador fuera de la lista blanca se rechaza");

  const sinFiltro = await cli.actualizar("fact_pack_versions", { pase, cambios: { activa: false } });
  ok(!sinFiltro.ok,
    "⚠️ actualizar SIN filtros se rechaza: RLS lo acotaría a la empresa, pero pisar todas las versiones de esa empresa ya sería el desastre");
  ok(!(await cli.actualizar("fact_pack_versions", { pase, filtros: { id: "eq.1" } })).ok, "actualizar sin cambios se rechaza");
}

console.log("\n" + "=".repeat(100));
console.log("7 · SIN CREDENCIALES, NO PASA NADA · la bandera que el owner pidió");
console.log("=".repeat(100));
{
  ok(clienteDesdeEntorno({}) === null, "sin variables no hay cliente: quien llama sigue con el camino de hoy");
  ok(clienteDesdeEntorno({ SUPABASE_URL: URL_FALSA }) === null, "…con la URL sola tampoco");
  ok(clienteDesdeEntorno({ SUPABASE_ANON_KEY: LLAVE_ANON }) === null, "…con la llave sola tampoco");
  ok(baseConfigurada({}) === false, "y se puede preguntar si hay base sin construir nada");
  ok(clienteDesdeEntorno({ SUPABASE_URL: URL_FALSA, SUPABASE_ANON_KEY: LLAVE_ANON }) !== null, "con las dos, sí hay cliente");

  /* Ninguna variable de este frente puede llevar el prefijo que la hornearía en el paquete del navegador. */
  const conVite = clienteDesdeEntorno({ VITE_SUPABASE_URL: URL_FALSA, VITE_SUPABASE_ANON_KEY: LLAVE_ANON });
  ok(conVite === null, "⚠️ una variable con prefijo `VITE_` NO configura la base: ese prefijo la publicaría al navegador");
}

console.log("\n" + "=".repeat(100));
console.log("8 · UN CORTE PROPIO · una base lenta no puede colgar el endpoint");
console.log("=".repeat(100));
{
  const colgado = (u, init) => new Promise((_, rechazar) => {
    init.signal.addEventListener("abort", () => { const e = new Error("cortado"); e.name = "AbortError"; rechazar(e); });
  });
  const cli = crearClienteRest({ url: URL_FALSA, apikey: LLAVE_ANON, transporte: colgado, timeoutMs: 25 });
  const { pase } = await emitirPase({ tenantId: "demo", secreto: SECRETO, ahora: AHORA });
  const r = await cli.seleccionar("uploads", { pase, filtros: { tenant_id: "eq.demo" } });
  ok(!r.ok && /no respondió/.test(r.motivo), `una base que no contesta se corta sola: «${r.motivo}»`);
}

console.log("\n" + "=".repeat(100));
console.log("9 · CARNADA · estos chequeos tienen que poder ponerse rojos");
console.log("=".repeat(100));
{
  /* Sin esto, la sección 3 entera podría estar aprobando cualquier cosa. Se comprueba que el verificador
   * DISTINGUE: acepta el bueno, rechaza cada variante mala, y no dice que sí a todo. */
  const { pase } = await emitirPase({ tenantId: "demo", secreto: SECRETO, ahora: AHORA });
  const bueno = await verificarPase(pase, SECRETO, AHORA);
  const malos = await Promise.all([
    verificarPase(pase.slice(0, -1) + (pase.slice(-1) === "A" ? "B" : "A"), SECRETO, AHORA),
    verificarPase(pase, OTRO, AHORA),
    verificarPase(pase, SECRETO, AHORA + 10 * 60 * 1000),
  ]);
  ok(bueno.ok && malos.every((m) => !m.ok),
    "el verificador acepta el pase bueno y rechaza los tres malos: distingue, no dice que sí a todo");

  /* Y que el doble de transporte de verdad OBSERVA lo que el cliente manda: si no registrara nada, la
   * sección 5 estaría comprobando un objeto vacío contra sus propias expectativas. */
  let llamadas = 0;
  const cli = crearClienteRest({
    url: URL_FALSA, apikey: LLAVE_ANON,
    transporte: async () => { llamadas++; return { ok: true, status: 200, text: async () => "[]" }; },
  });
  await cli.seleccionar("uploads", { pase, filtros: { tenant_id: "eq.demo" } });
  ok(llamadas === 1, "el doble registra exactamente una salida: lo que la sección 5 mide es real");

  /* Y el reverso del cerrojo de la llave de servicio: con una llave pública el cliente SÍ se construye. Sin
   * este control, un `crearClienteRest` que tirara siempre daría por buena la comprobación de la sección 4. */
  let construyo = true;
  try { crearClienteRest({ url: URL_FALSA, apikey: LLAVE_ANON }); } catch { construyo = false; }
  ok(construyo, "…y con una llave pública el cliente sí se construye: el cerrojo distingue, no bloquea todo");
}

console.log(`\n── _pase_tenant_gate: ${pass} PASS · ${fail} FAIL (de ${pass + fail}) ──`);
process.exit(fail === 0 ? 0 : 1);
