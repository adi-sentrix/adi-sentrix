/* === scripts/guion-continuidad-doble.mjs · EL ENTORNO DEL GUION CONTRA EL DOBLE DE SUPABASE (sin red) ═══════════
 * Arma, para el candado `_guardado_durable_gate.mjs` y para su proceso hijo (`guion-continuidad-hijo.mjs`), todo lo
 * que el guion necesita: las empresas de prueba (mismo catálogo de entidades, cifras DISTINTAS), el doble de la base,
 * la PUERTA real del Complemento (`capacidad/puerta.js`, con la memoria durable encendida) y el lector de huellas
 * que usa el MISMO adaptador de producción (`almacenSupabase.js`). Cero red: el transporte es el del doble. */
import { crearSupabaseFalso } from "./doble-supabase-continuidad.mjs";
import { crearLlamadorPuerta, huella } from "./guion-continuidad.mjs";
import { crearClienteRest } from "../src/data/supabaseRest.js";
import { crearAlmacenSupabase } from "../src/adi/continuidad/almacenSupabase.js";
import { emitirPase } from "../src/data/paseTenant.js";
import { makeAccessCode } from "../src/adi/llm/accessToken.js";
import { TENANT_DEMO } from "../src/data/tenants/demo.js";

export const SECRETO_TOKEN = "secreto-de-gate-guardado-durable-no-real";
export const SECRETO_JWT = "secreto-jwt-del-doble-guardado-durable-no-real-0123456789";
export const URL_DOBLE = "https://doble.invalid";
export const APIKEY_DOBLE = "anon-del-doble";

/* Las dos empresas del guion del owner: MISMAS entidades (Jumbo, Falabella…), distintas cifras, distinto nombre, distinta
 * versión de carga y distinto dato declarado — para que una mezcla se vea. `factor` escala la venta de cada cliente. */
export const EMPRESAS_DEL_GUION = [
  { id: "alfa", nombre: "Comercial Alfa", factor: 1, version: 3, etiqueta: "ref-alfa-7f3a", entidadE1: "Jumbo", entidadE2: "Falabella", plazoDias: 45, benchmarkPct: 28 },
  { id: "beta", nombre: "Comercial Beta", factor: 2.5, version: 7, etiqueta: "ref-beta-c91e", entidadE1: "Jumbo", entidadE2: "Falabella", plazoDias: 60, benchmarkPct: 31 },
];

/** packDeEmpresa({ id, nombre, factor }) → un pack con la forma del demo y las ventas por cliente escaladas. */
export function packDeEmpresa({ id, nombre, factor }) {
  const d = JSON.parse(JSON.stringify(TENANT_DEMO));
  d.id = id; d.nombre = nombre;
  for (const c of d.clientesVentas) { c.actual = Math.round(c.actual * factor); c.anterior = Math.round(c.anterior * factor); }
  return d;
}

const URL_PUERTA = new URL("../src/adi/capacidad/puerta.js", import.meta.url).href;
let _reinicios = 0;

/** importarPuertaFresca() → manejarPuerta de una instancia NUEVA del módulo (sin el rate limit ni la memoria del
 * proceso de la anterior): el «reinicio» dentro de un mismo proceso. El reinicio REAL (otro proceso) lo hace el hijo. */
export async function importarPuertaFresca() {
  _reinicios += 1;
  const m = await import(`${URL_PUERTA}?reinicio=${_reinicios}`);
  return m.manejarPuerta;
}

/** armarEntornoDoble({ empresas?, estadoJson?, semilla?, latenciaMaxMs?, migraciones?, modoListado? }) */
export async function armarEntornoDoble({ empresas = EMPRESAS_DEL_GUION, estadoJson = null, semilla = 20261002, latenciaMaxMs = 3, migraciones = ["015"], modoListado = "015", durable = true } = {}) {
  const db = crearSupabaseFalso({
    secretoJwt: SECRETO_JWT, semilla, latenciaMaxMs, migraciones, modoListado,
    tenants: estadoJson ? [] : empresas.map((E) => ({ id: E.id, nombre: E.nombre, plan: "pro", version: E.version, sello: { nota: `carga ${E.version}` }, pack: packDeEmpresa(E) })),
  });
  if (estadoJson) db.importar(estadoJson);

  const env = {
    ADI_COMPLEMENTO: "true", ADI_TOKEN_SECRET: SECRETO_TOKEN, ...(durable ? { ADI_MEMORIA_DURABLE: "true" } : {}),
    SUPABASE_URL: URL_DOBLE, SUPABASE_ANON_KEY: APIKEY_DOBLE, SUPABASE_JWT_SECRET: SECRETO_JWT,
  };
  const cliente = crearClienteRest({ url: URL_DOBLE, apikey: APIKEY_DOBLE, transporte: db.transporte });
  const codigos = {};
  for (const E of empresas) codigos[E.id] = (await makeAccessCode("Owner", 72, SECRETO_TOKEN, Date.now(), E.id)).code;

  const manejarPuerta = await importarPuertaFresca();
  const llamar = crearLlamadorPuerta({ manejarPuerta, env, opciones: { cliente, transporte: db.transporte }, codigos });

  /* lo guardado, leído por el MISMO adaptador que usa producción, con el pase de ESA empresa */
  async function almacenDe(empresaId) {
    const p = await emitirPase({ tenantId: empresaId, secreto: SECRETO_JWT });
    return crearAlmacenSupabase({ url: URL_DOBLE, apikey: APIKEY_DOBLE, pase: p.pase, transporte: db.transporte });
  }
  async function leerHuellas(empresaId, conversacionId) {
    const store = await almacenDe(empresaId);
    return { libro: huella(await store.leerLibro(empresaId, conversacionId)), memoria: huella(await store.leerHechosEmpresa(empresaId)) };
  }
  return { db, env, cliente, codigos, manejarPuerta, llamar, leerHuellas, almacenDe, empresas };
}
