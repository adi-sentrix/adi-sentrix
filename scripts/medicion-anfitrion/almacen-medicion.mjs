/* === scripts/medicion-anfitrion/almacen-medicion.mjs · EL ALMACÉN AISLADO DE LA MEDICIÓN CON ANFITRIÓN ═══════════
 * Decisión del owner (2026-10-05): el almacén es un DOBLE EN MEMORIA dentro del proceso de prueba, con exportar/importar
 * entre cortes. NO se abre otro proyecto de Supabase y NO se toca la base `krng…` (probablemente es producción).
 * Pasa por el MISMO adaptador de producción (`almacenSupabase.js`) y la MISMA puerta (`capacidad/puerta.js`): lo que se
 * mide es la verdad de la prosa del anfitrión, no la base (la base real ya tiene su guion de nivel 2).
 *
 * AISLAMIENTO, probado con carnada en el gate: (1) la URL de la base es la del doble (`https://doble.invalid`, un TLD
 * que no resuelve); (2) el entorno que ve la puerta NO trae ninguna variable real de Supabase ni de proveedor; (3)
 * `assertAislado` revisa ambas cosas antes de cada corrida. Reutiliza `armarEntornoDoble` (el del guion de la etapa 2)
 * sin copiarlo: las empresas y el estado entran por sus parámetros.
 *
 *   crearEstadoInicial({ empresas }) → JSON del doble con cada empresa y su pack            (la «carga» inicial)
 *   cambiarVersion(estadoJson, { empresaId, pack, version, sello }) → JSON nuevo             (otra versión de carga: entre sesiones)
 *   abrirAlmacen({ estadoJson })   → entorno del guion + guardarEstado(ruta) / cargarEstado(ruta) / exportar()
 *   assertAislado(entorno)         → lanza si algo apunta fuera del doble */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { crearSupabaseFalso } from "../doble-supabase-continuidad.mjs";
import { armarEntornoDoble, SECRETO_JWT, URL_DOBLE } from "../guion-continuidad-doble.mjs";
import { TENANT_DEMO } from "../../src/data/tenants/demo.js";
import { packRenombrado, EMPRESA_NO_DEMO } from "./empresa-no-demo.mjs";

/** Las dos empresas de la medición. `version` es la versión de CARGA que sirve el doble (1 o 2 para la no-demo). */
export const EMPRESAS_DE_LA_MEDICION = Object.freeze([
  Object.freeze({ id: "demo", nombre: TENANT_DEMO.nombre }),
  Object.freeze({ id: EMPRESA_NO_DEMO.id, nombre: EMPRESA_NO_DEMO.nombre }),
]);

const _packDe = (id, version) => (id === "demo" ? JSON.parse(JSON.stringify(TENANT_DEMO)) : packRenombrado({ version }));

/** crearEstadoInicial({ empresas?, versiones? }) → string JSON (el doble recién cargado, sin memoria ni conversaciones).
 * `versiones`: { [empresaId]: n } · por defecto todas en 1. */
export function crearEstadoInicial({ empresas = EMPRESAS_DE_LA_MEDICION, versiones = {}, semilla = 20261005 } = {}) {
  const db = crearSupabaseFalso({
    secretoJwt: SECRETO_JWT, semilla, latenciaMaxMs: 0, migraciones: ["015"], modoListado: "015",
    tenants: empresas.map((E) => {
      const v = versiones[E.id] || 1;
      return { id: E.id, nombre: E.nombre, plan: "pro", version: v, sello: { nota: `carga ${v}` }, pack: _packDe(E.id, v) };
    }),
  });
  return db.exportar();
}

/** cambiarVersion(estadoJson, { empresaId, version }) → string JSON · la empresa pasa a servir OTRA versión de carga. La
 * memoria y las conversaciones guardadas NO se tocan: es exactamente lo que pasa en producción cuando la empresa sube un
 * archivo nuevo entre dos sesiones (los hilos viejos se retoman contra los datos de hoy). `pack` opcional (por defecto el
 * pack de esa versión para la empresa; el demo solo tiene la versión 1). */
export function cambiarVersion(estadoJson, { empresaId, version, pack = null, sello = null }) {
  const s = JSON.parse(estadoJson);
  const t = s.tenants.find((x) => x.id === empresaId);
  if (!t) throw new Error(`cambiarVersion: la empresa «${empresaId}» no está en el almacén`);
  if (!pack && empresaId === "demo" && version !== t.version) throw new Error("cambiarVersion: el demo solo tiene la versión de carga 1");
  t.pack = JSON.parse(JSON.stringify(pack || _packDe(empresaId, version)));
  t.version = version;
  t.sello = sello || { nota: `carga ${version}` };
  return JSON.stringify(s);
}

/** assertAislado(entorno) → lanza si el almacén o su entorno apuntan fuera del doble. Barrera, no confianza. */
export function assertAislado(entorno) {
  const env = (entorno && entorno.env) || {};
  if (env.SUPABASE_URL !== URL_DOBLE) throw new Error(`almacén NO aislado: SUPABASE_URL=${String(env.SUPABASE_URL).slice(0, 40)} (debe ser el doble ${URL_DOBLE})`);
  if (!/\.invalid$/.test(new URL(env.SUPABASE_URL).hostname)) throw new Error("almacén NO aislado: la base no es un host .invalid");
  const raras = Object.keys(env).filter((k) => /^(ANTHROPIC|OPENAI|CLAUDE|LLM|GATEWAY)/i.test(k) || /krng/i.test(String(env[k])));
  if (raras.length) throw new Error(`almacén NO aislado: el entorno de la puerta trae variables ajenas (${raras.join(", ")})`);
  if (/supabase\.co/i.test(JSON.stringify(env))) throw new Error("almacén NO aislado: aparece un dominio real de Supabase en el entorno de la puerta");
  return true;
}

/** abrirAlmacen({ estadoJson?, empresas? }) → el entorno del guion (db, env, llamar, leerHuellas, …) + el ciclo de cortes.
 * Sin `estadoJson`, parte de la carga inicial (todo en la versión 1). */
export async function abrirAlmacen({ estadoJson = null, empresas = EMPRESAS_DE_LA_MEDICION, durable = true } = {}) {
  const estado = estadoJson || crearEstadoInicial({ empresas });
  const ent = await armarEntornoDoble({ empresas: empresas.map((E) => ({ id: E.id, nombre: E.nombre })), estadoJson: estado, durable, latenciaMaxMs: 0 });
  assertAislado(ent);
  return {
    ...ent,
    exportar: () => ent.db.exportar(),
    guardarEstado(ruta) { mkdirSync(dirname(ruta), { recursive: true }); writeFileSync(ruta, ent.db.exportar()); return ruta; },
    cargarEstado(ruta) { ent.db.importar(readFileSync(ruta, "utf8")); return ruta; },
  };
}

/** leerEstado(ruta) → string JSON del archivo (para pasárselo a `abrirAlmacen` o a `cambiarVersion`). */
export const leerEstado = (ruta) => readFileSync(ruta, "utf8");
