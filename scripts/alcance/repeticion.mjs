/* === scripts/alcance/repeticion.mjs · LA REPETICIÓN QUE DEMUESTRA QUE EL BRAZO A ES EL DE SIEMPRE (alcance estructural · owner 2026-10-09) ═══════════════════════════════════════════════════════════
 * El experimento A/B compara dos brazos: A = las entregas de hoy, B = el producto con el alcance como dato (`src/adi/capacidad/brazo.js`, variable `ADI_ALCANCE_ESTRUCTURAL`). Para que el experimento mida lo que dice,
 * el brazo A tiene que ser BYTE IDÉNTICO a lo que ADI entregaba antes de este cambio. Esta es la prueba: se repiten (1) los 532 encargos sellados de los catálogos v13–v40 (demo, conversación nueva cada uno) y
 * (2) las llamadas GRABADAS del ensayo 12 (8 hilos, demo y Río Claro v1/v2: consultar · derivar · aportarContexto · conocerEmpresa) por la puerta compacta, y de cada respuesta —normalizados los ids de conversación y las horas,
 * que son al azar— se saca un sha256. `fixtures/alcance/brazo-a-sellos.json` guarda los sellos calculados con el ÁRBOL DEL COMMIT 3476dabd (`--raiz <árbol>`); `_alcance_estructural_gate` los vuelve a calcular con el árbol de hoy
 * en el brazo A y exige que sean los mismos. `retomar` queda fuera: su paginación es un arreglo de ADI y cambia los dos brazos.
 * Uso: node --import ./scripts/offline-guard.mjs scripts/alcance/repeticion.mjs [--raiz <árbol de código>] [--escribir]   (sin --escribir solo imprime el resumen) · OFFLINE · cero red · cero LLM. */
import fs from "node:fs";
import crypto from "node:crypto";
import { pathToFileURL, fileURLToPath } from "node:url";

const REPO = fileURLToPath(new URL("../../", import.meta.url)).replace(/[\\/]$/, "");
const sha16 = (s) => crypto.createHash("sha256").update(s).digest("hex").slice(0, 16);
const SIN_ID_AL_AZAR = (txt) => txt.replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g, "<cid>").replace(/conv-[0-9a-z]+-[0-9a-z]+/g, "<cid>").replace(/\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(\.\d+)?Z/g, "<t>");
export const selloDe = (obj) => sha16(SIN_ID_AL_AZAR(JSON.stringify(obj)));

/** cargarArbol(raiz) → los módulos del árbol de código indicado (el de hoy por defecto) */
export async function cargarArbol(raiz = REPO) {
  const im = (p) => import(pathToFileURL(`${raiz}/${p}`).href);
  const [tenantStore, demo, acciones, compacto, almacen, empresaNoDemo] = await Promise.all([
    im("src/data/tenantStore.js"), im("src/data/tenants/demo.js"), im("src/adi/capacidad/acciones.js"), im("src/adi/capacidad/compacto.js"), im("src/adi/continuidad/almacen.js"),
    import(pathToFileURL(`${raiz}/scripts/medicion-anfitrion/empresa-no-demo.mjs`).href),
  ]);
  return { raiz, initTenant: tenantStore.initTenant, TENANT_DEMO: demo.TENANT_DEMO, crearAcciones: acciones.crearAcciones, compactarParaAnfitrion: compacto.compactarParaAnfitrion, crearAlmacenEnMemoria: almacen.crearAlmacenEnMemoria, packRenombrado: empresaNoDemo.packRenombrado };
}

/** repetir532(arbol) → { [id]: sello | null } · cada encargo en una conversación nueva, respuesta compacta de `consultar` */
export async function repetir532(arbol) {
  const { initTenant, TENANT_DEMO, crearAcciones, compactarParaAnfitrion, crearAlmacenEnMemoria, raiz } = arbol;
  initTenant(TENANT_DEMO);
  const T = { id: "demo", nombre: "ADI Demo", dataset: TENANT_DEMO, version: 1, sello: null };
  const casos = JSON.parse(fs.readFileSync(`${raiz}/fixtures/procedencia/muestra-v13-v40.json`, "utf8")).casos;
  const out = {};
  for (const c of casos) {
    const r = await crearAcciones({ continuidad: crearAlmacenEnMemoria() }).consultar({ tenant: T, encargo: JSON.parse(JSON.stringify(c.encargo)) });
    out[c.id] = selloDe(compactarParaAnfitrion("consultar", r));
  }
  return out;
}

/** repetirEnsayo12(arbol) → [{ hilo, sesion, i, herramienta, sello }] · las llamadas grabadas, una conversación por sesión (las de la sesión 2 que apuntan a una conversación de la 1 se ligan por el id grabado) */
export async function repetirEnsayo12(arbol, { sinRetomar = true, alRepetir = null } = {}) {
  const { crearAcciones, compactarParaAnfitrion, crearAlmacenEnMemoria, packRenombrado, TENANT_DEMO, raiz } = arbol;
  const F = JSON.parse(fs.readFileSync(`${REPO}/fixtures/alcance/ensayo12-llamadas.json`, "utf8")).hilos;
  const out = [];
  for (const [hilo, H] of Object.entries(F)) {
    const A = crearAcciones({ continuidad: crearAlmacenEnMemoria() });
    const ligar = new Map();   /* id grabado → id de esta repetición */
    for (const S of H.sesiones) {
      const T = H.empresa === "demo" ? { id: "demo", nombre: "ADI Demo", dataset: TENANT_DEMO, version: S.version, sello: null } : { id: "rioclaro", nombre: "Distribuidora Río Claro", dataset: packRenombrado({ version: S.version }), version: S.version, sello: null };
      let cidSesion = null;
      for (let i = 0; i < S.llamadas.length; i++) {
        const l = S.llamadas[i];
        const a = JSON.parse(typeof l.args === "string" ? l.args : JSON.stringify(l.args || {}));
        let r;
        const cidDe = (g) => (g && ligar.has(g) ? ligar.get(g) : g);
        if (l.herramienta === "conocerEmpresa") r = await A.conocerEmpresa({ tenant: T, conversacionId: a.conversacionId ? cidDe(a.conversacionId) : null });
        else if (l.herramienta === "consultar") {
          const e = a.encargo || a;
          if (e.conversacionId) e.conversacionId = cidDe(e.conversacionId); else if (cidSesion) e.conversacionId = cidSesion;
          r = await A.consultar({ tenant: T, encargo: e });
          const nuevo = r && r.continuidad && r.continuidad.conversacionId;
          if (nuevo && !cidSesion) cidSesion = nuevo;
          if (nuevo && l.cid) ligar.set(l.cid, nuevo);
        } else if (l.herramienta === "aportarContexto") r = await A.aportarContexto({ tenant: T, conversacionId: cidDe(a.conversacionId) || cidSesion, aportes: a.aportes || [], confirmar: a.confirmar || [], omitir: a.omitir || [] });
        else if (l.herramienta === "derivar") r = await A.derivar({ tenant: T, conversacionId: cidDe(a.conversacionId) || cidSesion, operacion: a.operacion, sobre: a.sobre, base: a.base ?? undefined, condicion: a.condicion ?? undefined, criterio: a.criterio ?? undefined, eje: a.eje, a: a.a, b: a.b });
        else if (l.herramienta === "retomar") { if (sinRetomar) continue; r = await A.retomar({ tenant: T, conversacionId: cidDe(a.conversacionId) }); }
        else continue;
        const viaja = compactarParaAnfitrion(l.herramienta, r);
        if (alRepetir) alRepetir({ hilo, sesion: S.n, i, herramienta: l.herramienta, viaja });
        out.push({ hilo, sesion: S.n, i, herramienta: l.herramienta, sello: selloDe(viaja) });
      }
    }
  }
  return out;
}

/* ── ejecución directa: calcular (y, con --escribir, guardar) los sellos del árbol indicado ── */
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const iR = process.argv.indexOf("--raiz");
  const raiz = iR > 0 ? process.argv[iR + 1].replace(/[\\/]$/, "") : REPO;
  const arbol = await cargarArbol(raiz);
  const s532 = await repetir532(arbol);
  const e12 = await repetirEnsayo12(arbol);
  console.log(`árbol: ${raiz} · 532: ${Object.keys(s532).length} sellos · ensayo 12: ${e12.length} llamadas selladas`);
  if (process.argv.includes("--escribir")) {
    const destino = `${REPO}/fixtures/alcance/brazo-a-sellos.json`;
    fs.writeFileSync(destino, JSON.stringify({ nota: "Sellos (sha256 de 16 hex del JSON compacto, ids de conversación normalizados) de las respuestas de la puerta compacta del BRAZO A = ADI antes del alcance estructural, calculados con el árbol del commit 3476dabd: los 532 encargos sellados (demo, conversación nueva) y las llamadas grabadas del ensayo 12 (sin `retomar`, que se pagina en los dos brazos). `_alcance_estructural_gate` exige que el brazo A de hoy los reproduzca.", arbol: "3476dabd", e532: s532, ensayo12: e12 }) + "\n");
    console.log("✓ escrito", destino);
  }
}
