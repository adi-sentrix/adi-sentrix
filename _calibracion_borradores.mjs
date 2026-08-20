/* === _calibracion_borradores.mjs · CALIBRAR LOS CHEQUEOS NUEVOS CONTRA LO YA MEDIDO (owner 2026-08-15) =======
 * «No quiero seguir gastando llamadas corrigiendo falsos positivos sobre la marcha. Necesito que el examen mida
 * ADI, no el ruido de reglas recién agregadas.»
 *
 * EL CORPUS ESTÁ EN DISCO Y ES GRATIS. Dos poblaciones con expectativa OPUESTA, que es lo que hace útil la pasada:
 *   · ACEPTADAS — los textos que SALIERON A PANTALLA en los exámenes (verde o reparado). Un veto NUEVO sobre uno
 *     de estos es candidato a falso positivo: alguien ya los dio por buenos y el usuario los leyó.
 *   · RECHAZADAS — los borradores que el muro rechazó, guardados en los expedientes. Acá el veto debería ser real.
 * No es una prueba de pasa/falla: es un INFORME para decidir qué chequeo aflojar y por qué. Cada caso sale con su
 * cláusula, para poder juzgarlo sin abrir el archivo.
 *
 * PURO Y OFFLINE: importa el muro y la carpeta, nada más. No lee `.env`, no importa el gateway ni ningún adapter,
 * no puede gastar. Corre con `node _calibracion_borradores.mjs`. */
import fs from "node:fs";
import { guardC } from "./src/adi/oracle/guardC.js";
import { cifrasDelDato } from "./src/adi/oracle/datoProyectado.js";
import { axisEntityNames } from "./src/adi/oracle/entityIndex.js";
import { ESCENARIO_INICIAL } from "./src/config/scenarios.js";
import { initTenant } from "./src/data/tenantStore.js";
import { TENANT_DEMO } from "./src/data/tenants/demo.js";
initTenant(TENANT_DEMO);

const ejes = (a) => a.flatMap((e) => { try { return axisEntityNames(e); } catch { return []; } });
const CTX = {
  ledger: { figs: [] }, results: [], trace: null,
  datoProyectado: cifrasDelDato(ESCENARIO_INICIAL),
  entidadesDelTenant: ejes(["cliente", "sku", "marca"]),
  duenosDelTenant: ejes(["cliente", "sku", "marca", "familia", "bodega", "canal"]),
  contentScope: "full", tablePolicy: "auto",
};
// LOS SEIS CHEQUEOS NUEVOS (2026-08-14/15). El resto del muro no se juzga acá: lleva meses calibrado.
const NUEVOS = new Set(["comparacion-cruzada", "etiqueta-ambigua", "ranking-sin-cola", "estado-no-declarado",
  "cifra-calculada-mal-atribuida", "calculo-no-verificable",
  // LOS TRES DEL EXAMEN 4 (owner 2026-08-16) · se calibran ANTES de gastar otra corrida.
  // ⚠️ OJO AL LEER EL INFORME: para estos tres, un veto sobre una ACEPTADA no es automáticamente un falso
  // positivo. Los textos del Examen 4 entraron al corpus CON el defecto adentro (el «peor margen» de Falabella
  // salió a pantalla), así que ahí el veto es exactamente el objetivo. Lo que hay que mirar es si el veto cae
  // sobre un texto de los exámenes 1-3, que son los que se dieron por buenos ANTES de que existiera la regla.
  "superlativo-no-sostenido", "juicio-sin-marcar", "dias-etiqueta-incorrecta",
  // el del resumen (owner 2026-08-16): un total del conjunto que ADI sumó y no declaró
  "total-sin-declarar"]);

const corpus = [];
for (const f of fs.readdirSync(".")) {
  if (/^_examen.*\.json$/.test(f) && !/debug/.test(f)) {
    try {
      const S = JSON.parse(fs.readFileSync(f, "utf8"));
      for (const [i, t] of (S.turnos || []).entries()) {
        if (t && typeof t.visible === "string" && t.visible.trim() && t.estado !== "suplente" && t.estado !== "vacio") {
          corpus.push({ origen: `${f} · turno ${i + 1}`, clase: "ACEPTADA", q: t.q || "", texto: t.visible });
        }
      }
    } catch { /* archivo de estado ilegible: se ignora, no es el objeto de esta pasada */ }
  }
  if (/^_examen_debug_t\d+\.json$/.test(f)) {
    try {
      const D = JSON.parse(fs.readFileSync(f, "utf8"));
      for (const it of (D.intentos || [])) {
        if (it && typeof it.borrador === "string" && it.borrador.trim()) {
          corpus.push({ origen: `${f} · intento ${it.intento}`, clase: "RECHAZADA", q: D.q || "", texto: it.borrador });
        }
      }
    } catch { }
  }
}

const _clausula = (texto, aguja) => {
  for (const c of String(texto).split(/[.!?\n;]+/)) if (aguja && c.includes(aguja)) return c.trim().slice(0, 150);
  return "";
};
const conteo = new Map();
const casos = { ACEPTADA: [], RECHAZADA: [] };
for (const item of corpus) {
  const v = guardC(item.texto, { ...CTX, question: item.q });
  for (const x of (v.violations || [])) {
    if (!NUEVOS.has(x.kind)) continue;
    conteo.set(`${item.clase}·${x.kind}`, (conteo.get(`${item.clase}·${x.kind}`) || 0) + 1);
    casos[item.clase].push({ origen: item.origen, kind: x.kind, detail: String(x.detail).slice(0, 165), texto: item.texto });
  }
}

console.log(`═══ CALIBRACIÓN · ${corpus.length} textos guardados (${corpus.filter((c) => c.clase === "ACEPTADA").length} aceptadas · ${corpus.filter((c) => c.clase === "RECHAZADA").length} rechazadas) · escenario ${ESCENARIO_INICIAL}\n`);
console.log("── CONTEO POR CHEQUEO ──");
for (const [k, n] of [...conteo.entries()].sort()) console.log(`  ${String(n).padStart(3)}  ${k}`);

console.log("\n\n═══ LO QUE IMPORTA · vetos sobre textos que YA SALIERON A PANTALLA (candidatos a falso positivo)");
if (!casos.ACEPTADA.length) console.log("  (ninguno — los seis chequeos no tocan nada de lo ya aceptado)");
for (const c of casos.ACEPTADA) {
  const aguja = (c.detail.match(/«([^»]+)»/) || [])[1];
  console.log(`\n  [${c.kind}] ${c.origen}`);
  console.log(`    multa   : ${c.detail}`);
  const cl = _clausula(c.texto, aguja);
  if (cl) console.log(`    cláusula: «${cl}»`);
}

console.log("\n\n═══ CONTROL · vetos sobre borradores RECHAZADOS (deberían ser reales)");
const porTipo = new Map();
for (const c of casos.RECHAZADA) porTipo.set(c.kind, (porTipo.get(c.kind) || 0) + 1);
for (const [k, n] of [...porTipo.entries()].sort()) console.log(`  ${String(n).padStart(3)}  ${k}`);
