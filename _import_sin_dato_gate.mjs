/* === _import_sin_dato_gate.mjs · NADIE DERIVA EL DATO EN TIEMPO DE IMPORT (owner 2026-08-21) ===================
 * @inspeccion-estatica · lee código fuente como TEXTO. No importa el gateway ni un adapter, no invoca a nadie, no
 * abre una salida. Nombra `gatewayFetch` porque ese archivo está en la lista de casos declarados; sin el marcador
 * quedaría LIVE y un gate que no corre no certifica nada.
 *
 * EL DEFECTO QUE PERSIGUE, y ya ocurrió una vez. La vía 1 de Supabase cambió el modelo de datos: antes los clientes
 * estaban disponibles como CONSTANTES al cargar la app; ahora la app arranca VACÍA y recién después pide al servidor
 * el dato del tenant autorizado. Las fachadas (`demoData` y compañía) son ENLACES VIVOS —`export let` que se
 * reasigna en `onTenantChange`—, así que un módulo que lee DENTRO de una función recibe el dato fresco; pero uno que
 * DERIVA algo a nivel de módulo se queda con la foto del vacío para siempre.
 *
 * Le pasó a `entityGuard.js`, y la forma en que falló es la que hay que recordar: **no se rompió, quedó MUDO**.
 * Armaba su catálogo de nombres al importarse; con el store vacío el catálogo quedó vacío, y un guard sin catálogo
 * APRUEBA TODO. Nadie se entera de que una protección dejó de proteger. Solo lo delató un gate.
 *
 * QUÉ HACE: busca sentencias a NIVEL DE MÓDULO que ya usan un nombre importado del dato. Las que están declaradas
 * abajo se conocen y se explican una por una; cualquier candidato NUEVO pone el gate en rojo. Y al revés: si una
 * declarada deja de aparecer, también — una lista que no se mantiene deja de decir la verdad.
 *
 * ⚠️ SE PRUEBA A SÍ MISMO CON UNA CARNADA. La primera versión de este barrido devolvía 0 candidatos SIEMPRE, por un
 * borde de palabra que se perdió al escribir el archivo: verde y ciego. Así que antes de creerle un solo resultado,
 * el gate corre el detector contra una COPIA del defecto real y exige que lo cace. */
import fs from "node:fs";
import path from "path";
import { fileURLToPath } from "url";

const root = path.dirname(fileURLToPath(import.meta.url));
let pass = 0, fail = 0;
const ok = (cond, label, detalle) => {
  if (cond) { pass++; console.log(`  ✓ ${label}`); }
  else { fail++; console.log(`  ✗ FALLO: ${label}${detalle !== undefined ? ` — ${detalle}` : ""}`); }
};

// ── EL DETECTOR · el borde de palabra va A MANO, no con `\b`: el escape se perdió una vez y dejó el gate ciego ──
const DATA = /from\s+["'][^"']*(?:\/data\/|\/config\/(?:routerData|scenarios|contract\/))/;
const LETRA = (c) => c !== undefined && /[A-Za-z0-9_$]/.test(c);
/* usaNombre → ¿el bloque usa este dato DE VERDAD al importarse? Dos filtros, y el segundo no es cosmético:
 *   · borde de palabra, para no confundir `clientes` con `clientesMargen`;
 *   · y la ocurrencia NO puede estar detrás de una flecha en su propia línea. `{ cliente: () => clientesMargen…, }`
 *     es un objeto de FUNCIONES: el dato se lee cuando se las llama, con el tenant ya cargado. Sin este filtro el
 *     gate marcaba dos módulos correctos (temporal.js y temporalTable.js) y habría empujado a "arreglar" lo sano. */
const usaNombre = (txt, n) => {
  for (let k = txt.indexOf(n); k >= 0; k = txt.indexOf(n, k + 1)) {
    if (LETRA(txt[k - 1]) || LETRA(txt[k + n.length])) continue;
    const desdeRenglon = txt.lastIndexOf("\n", k) + 1;
    const antes = txt.slice(desdeRenglon, k);
    if (antes.includes("=>") || /\bfunction\s*\(/.test(antes)) continue;   // cuerpo diferido: corre al llamarse
    return true;
  }
  return false;
};
const saldo = (s) => (s.match(/[([{]/g) || []).length - (s.match(/[)\]}]/g) || []).length;

function candidatos(src, etiqueta) {
  const L = src.split("\n");
  const nombres = new Set();
  for (const l of L) {
    if (!DATA.test(l) || !/^\s*import\s/.test(l)) continue;
    const m = l.match(/import\s+\{([^}]*)\}/);
    if (m) for (const n of m[1].split(",")) { const t = n.split(/\s+as\s+/).pop().trim(); if (t) nombres.add(t); }
    const d = l.match(/import\s+(\w+)\s+from/);
    if (d) nombres.add(d[1]);
  }
  const out = [];
  if (!nombres.size) return out;
  for (let i = 0; i < L.length; i++) {
    const l = L[i];
    if (/^\s*(\/\/|\*|\/\*)/.test(l)) continue;
    if (/^\s*(import|export\s+\{|export\s+\*)/.test(l)) continue;
    if (!/^(const|let|var|for|if|[A-Za-z_$])/.test(l)) continue;   // columna 0 = nivel de módulo
    if (/^(export\s+)?(async\s+)?function\b/.test(l)) continue;     // declararla no la ejecuta
    if (/=>|\bfunction\s*\(/.test(l)) continue;                     // cuerpo diferido: corre al llamarse
    let bloque = l, j = i, abre = saldo(l);
    while (abre > 0 && j + 1 < L.length && j - i < 30) { j++; bloque += "\n" + L[j]; abre += saldo(L[j]); }
    const usa = [...nombres].filter((n) => usaNombre(bloque, n));
    if (usa.length) out.push({ donde: `${etiqueta}:${i + 1}`, usa, gist: l.trim().slice(0, 90) });
    i = j;
  }
  return out;
}

console.log("=".repeat(100));
console.log("1 · LA CARNADA · el detector tiene que cazar una copia del defecto real, o no vale nada");
console.log("=".repeat(100));
const CARNADA = [
  'import { clientesMargen, marcasVentas } from "../../data/demoData.js";',
  "const _NAMES = [",
  '  ...clientesMargen.filter((c) => c.tipo === "cliente").map((c) => c.nombre),',
  "  ...marcasVentas.map((m) => m.nombre),",
  "];",
  "export function usar(x) { return _NAMES.includes(x); }",
].join("\n");
const cazada = candidatos(CARNADA, "carnada");
ok(cazada.length === 1, `caza el defecto de entityGuard tal como era (${cazada.length} candidato)`, JSON.stringify(cazada));
ok(cazada.length === 1 && cazada[0].usa.includes("clientesMargen"), "…y nombra el dato que se habría congelado");
const SANO = [
  'import { clientesMargen } from "../../data/demoData.js";',
  'import { onTenantChange } from "../../data/tenantStore.js";',
  "let _cat = null;",
  "const _catalogo = () => (_cat || (_cat = clientesMargen.map((c) => c.nombre)));",
  "onTenantChange(() => { _cat = null; });",
].join("\n");
ok(candidatos(SANO, "sano").length === 0,
  "…y NO marca la forma correcta (perezoso + onTenantChange), que es como quedó el arreglo");

console.log("\n" + "=".repeat(100));
console.log("2 · EL BARRIDO · ningún módulo nuevo deriva el dato al importarse");
console.log("=".repeat(100));
/* LOS CASOS CONOCIDOS, cada uno con su motivo. Ninguno es dato de empresa:
 *   · METRICS / ENTITIES / SOURCES son el CONTRATO declarado — iguales para todo tenant, no cambian con la empresa.
 *   · `handleData` es una función (un handler de ruta), no dato: vive en el borde del servidor a propósito.
 *   · `ESCENARIO_INICIAL` es configuración, y la línea es la declaración del componente.
 *   · `getTenantId()` en criteria/pnl se lee al import PERO los dos corrigen en `onTenantChange` (verificado). */
const DECLARADOS = new Map([
  ["src/adi/criteria.js", "lee getTenantId() al import y lo CORRIGE en onTenantChange"],
  ["src/adi/pnl.js", "ídem criteria: getTenantId() al import, corregido en onTenantChange"],
  ["src/adi/llm/gatewayFetch.js", "`handleData` es un handler de ruta, no dato de empresa"],
  ["src/adi/oracle/datoProyectado.js", "METRICS[].label: etiquetas del CONTRATO, iguales para todo tenant"],
  ["src/adi/sentrix/glossary.js", "recorre METRICS, el contrato declarado"],
  ["src/ui/App.jsx", "ESCENARIO_INICIAL es configuración; la línea es la declaración del componente"],
  /* FUERA de la lista, y lo sacó el propio gate: `src/adi/sentrix/temporal.js` y `src/adi/composers/temporalTable.js`
   * declaran sus nombres de eje como FLECHAS (`cliente: () => clientesMargen.map(…)`), o sea leen el dato al
   * llamarse y no al importarse. Estaban acá mientras el detector miraba solo la primera línea del bloque; cuando
   * aprendió a ver la flecha dejaron de aparecer, y el control de huérfanos obligó a quitarlos. Es la forma
   * CORRECTA con las fachadas de enlace vivo: no hay nada que arreglar ahí. */
]);
const raiz = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) =>
  e.isDirectory() ? raiz(path.join(d, e.name)) : (/\.(js|jsx)$/.test(e.name) ? [path.join(d, e.name)] : []));
const vistos = new Set(), nuevos = [];
for (const dir of ["src/adi", "src/ui"]) {
  for (const f of raiz(path.join(root, dir))) {
    const rel = path.relative(root, f).split(path.sep).join("/");
    for (const c of candidatos(fs.readFileSync(f, "utf8"), rel)) {
      if (DECLARADOS.has(rel)) { vistos.add(rel); continue; }
      nuevos.push(c);
    }
  }
}
ok(nuevos.length === 0, "ningún módulo NUEVO deriva el dato al importarse (revisados src/adi y src/ui)",
  nuevos.map((c) => `${c.donde} [${c.usa.join(", ")}] ${c.gist}`).join(" | "));
const huerfanos = [...DECLARADOS.keys()].filter((k) => !vistos.has(k));
ok(huerfanos.length === 0,
  `los ${DECLARADOS.size} casos declarados siguen existiendo — si uno se arregla, hay que sacarlo de la lista`,
  `ya no aparecen: ${huerfanos.join(", ")}`);

console.log("\n" + "=".repeat(100));
console.log("3 · EL AVISO QUE FALTA · el id del tenant responde «demo» aunque no haya tenant cargado");
console.log("=".repeat(100));
/* MEDIDO: con el store vacío, `tenantCargado()` dice false pero `getTenantId()` devuelve "demo" por su fallback.
 * Hoy no rompe nada —criteria y pnl corrigen en el callback— pero es la trampa exacta que hizo mudo a entityGuard:
 * una respuesta PLAUSIBLE en vez de un «todavía no sé». Se deja ANOTADO acá, sin cambiarlo: `tenantStore` es del
 * frente de datos y tocar ese default movería los 51 gates que ya se adaptaron. Cuando entre Supabase real, el
 * fallback debería ser explícito, o `tenantCargado()` obligatorio antes de leer el id. */
const store = fs.readFileSync(path.join(root, "src", "data", "tenantStore.js"), "utf8");
ok(/tenantCargado/.test(store), "el store SÍ expone `tenantCargado()` — la pregunta honesta existe");
ok(/getTenantId[^\n]*\|\|\s*"demo"/.test(store),
  "…y el id todavía cae a «demo» sin tenant: queda anotado como riesgo latente, no como falla de hoy");

console.log(`\n── _import_sin_dato_gate: ${pass} PASS · ${fail} FAIL (de ${pass + fail}) ──`);
process.exit(fail === 0 ? 0 : 1);
