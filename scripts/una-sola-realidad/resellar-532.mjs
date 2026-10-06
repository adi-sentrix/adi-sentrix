/* === scripts/una-sola-realidad/resellar-532.mjs · RE-SELLA LOS 532 ENCARGOS DE LOS CATÁLOGOS v13–v40 CONTRA EL DATO VIGENTE (owner 2026-10-06, diseño §6.5) ====
 * Los 532 textos se sellaron con el dato de entonces (sha por caso en `fixtures/procedencia/muestra-v13-v40.json` y sha256 completo en `fixtures/total-del-listado/textos-v13-v40.sha256.json`).
 * Con las tablas como realidad, 222 cambian; DESPUÉS de refrescar las premisas (scripts/una-sola-realidad/refrescar-premisas.mjs) el sello se re-fija sobre el texto vigente. Lo que prueba
 * que el cambio es solo el permitido NO es este script: es `_una_sola_realidad_gate` §5, que compara cada texto con el TEXTO VIEJO archivado
 * (fixtures/una-sola-realidad/textos-v13-v40-antes.json.gz) y exige: idéntico · solo cifras · solo premisas · o un caso LISTADO por id con su causa de diseño.
 * Hace tres cosas, y solo estas: (1) re-sella el `sha` de cada caso (el hash de `alAntes(texto)` que usan _procedencia/_tamano_general/_universal_localizado), (2) re-sella el sha256 completo del
 * texto en `textos-v13-v40.sha256.json` (_total_del_listado §2), (3) con `--archivar-antes <json de id→texto>` guarda el texto VIEJO (una sola vez, desde el árbol del commit 98ad5c03).
 * OFFLINE · cero red · cero LLM.
 * uso: node --import ./scripts/offline-guard.mjs scripts/una-sola-realidad/resellar-532.mjs [--escribir] */
import fs from "node:fs";
import zlib from "node:zlib";
import crypto from "node:crypto";
import { initTenant } from "../../src/data/tenantStore.js";
import { TENANT_DEMO } from "../../src/data/tenants/demo.js";
import { crearAcciones } from "../../src/adi/capacidad/acciones.js";
import { crearAlmacenEnMemoria } from "../../src/adi/continuidad/almacen.js";
import { validarEncargo } from "../../src/adi/encargo/validar.js";
import { componerEntrega } from "../../src/adi/entrega/componer.js";

const R = (p) => new URL(p, import.meta.url);
const ESCRIBIR = process.argv.includes("--escribir");
const iAntes = process.argv.indexOf("--archivar-antes");
const SIM_VIEJA = "Simulación declarada por la empresa", SIM_NUEVA = "Simulación planteada en la consulta";
const SUP_VIEJA = "El supuesto lo declaró la empresa;", SUP_NUEVA = "El supuesto fue planteado en la consulta;";
const alAntes = (t) => String(t).split(SIM_NUEVA).join(SIM_VIEJA).split(SUP_NUEVA).join(SUP_VIEJA).split("Nivel de referencia de carga").join("Nivel de carga declarado").split("nivel de referencia de carga").join("nivel de carga declarado");
const sha16 = (s) => crypto.createHash("sha256").update(String(s)).digest("hex").slice(0, 16);
const sha256 = (s) => crypto.createHash("sha256").update(String(s)).digest("hex");

const FIX = R("../../fixtures/procedencia/muestra-v13-v40.json"), SEAL = R("../../fixtures/total-del-listado/textos-v13-v40.sha256.json");
const F = JSON.parse(fs.readFileSync(FIX, "utf8")), S = JSON.parse(fs.readFileSync(SEAL, "utf8"));
initTenant(TENANT_DEMO);
const TD = { id: "demo", nombre: "ADI Demo", dataset: TENANT_DEMO, version: 1, sello: null };
const nuevos = {}, shaCaso = {}, hashes = {};
for (const c of F.casos) {
  const r = await crearAcciones({ continuidad: crearAlmacenEnMemoria() }).consultar({ tenant: TD, encargo: c.encargo });
  const t = r && r.ok && r.entrega ? r.entrega.texto : null;
  hashes[c.id] = t != null ? sha256(t) : null;
  const t2 = componerEntrega(validarEncargo(c.encargo, {}));
  shaCaso[c.id] = t2 && t2.ok ? sha16(alAntes(t2.texto)) : null;
  nuevos[c.id] = t;
}
const cambianSha = F.casos.filter((c) => c.sha !== shaCaso[c.id]).length, cambianHash = Object.keys(hashes).filter((id) => S.hashes[id] !== hashes[id]).length;
console.log(`casos: ${F.casos.length} · sha de caso que cambian: ${cambianSha} · sha256 completo que cambian: ${cambianHash}`);
if (iAntes > 0) {
  const antes = JSON.parse(fs.readFileSync(process.argv[iAntes + 1], "utf8"));
  const texto = Object.fromEntries(Object.entries(antes.casos || antes).map(([id, v]) => [id, typeof v === "string" ? v : v.texto]));
  const dir = R("../../fixtures/una-sola-realidad/");
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(new URL("textos-v13-v40-antes.json.gz", dir), zlib.gzipSync(Buffer.from(JSON.stringify({ nota: "Texto de la Entrega de cada uno de los 532 encargos v13–v40 (demo, conversación nueva) tal como lo componía el árbol del commit 98ad5c03, ANTES de la realidad única (owner 2026-10-06). Es la evidencia contra la que `_una_sola_realidad_gate` §5 demuestra que el cambio es solo el permitido. Su sha256 por caso es el sello viejo (textos-v13-v40.sha256.antes.json).", textos: texto }), "utf8"), { level: 9 }));
  const sello = Object.fromEntries(Object.entries(texto).map(([id, t]) => [id, t != null ? sha256(t) : null]));
  fs.writeFileSync(new URL("textos-v13-v40.sha256.antes.json", dir), JSON.stringify({ nota: "Sello VIEJO (sha256 del texto de cada encargo v13–v40 en el commit 98ad5c03). Es el contenido que tenía fixtures/total-del-listado/textos-v13-v40.sha256.json antes de la realidad única; se conserva para demostrar que textos-v13-v40-antes.json.gz es exactamente lo que se selló.", hashes: sello }, null, 1) + "\n", "utf8");
  console.log("✓ archivado el texto viejo y su sello en fixtures/una-sola-realidad/");
}
if (ESCRIBIR) {
  for (const c of F.casos) c.sha = shaCaso[c.id];
  F.nota = String(F.nota || "").replace(/\s*\[Re-sellado[^\]]*\]/, "") + " [Re-sellado (owner 2026-10-06, una sola realidad): los `sha` son los del texto vigente tras refrescar las premisas; la prueba de que el cambio es solo cifras · premisas · casos listados es `_una_sola_realidad_gate` §5.]";
  fs.writeFileSync(FIX, JSON.stringify(F), "utf8");
  S.nota = "sha256 del TEXTO de la Entrega de cada encargo de los catálogos v13–v40 (demo, conversación nueva) con el dato vigente (UNA SOLA REALIDAD, owner 2026-10-06: las tablas del tenant son la realidad). Re-sellado desde el sello de ANTES del libro que declara el total del listado (2026-10-05), que se conserva en fixtures/una-sola-realidad/textos-v13-v40.sha256.antes.json; `_una_sola_realidad_gate` §5 demuestra que la diferencia es solo cifras, premisas y casos listados por id. null = el encargo se declina.";
  S.hashes = hashes;
  fs.writeFileSync(SEAL, JSON.stringify(S) + "\n", "utf8");
  console.log("✓ re-sellado");
}
