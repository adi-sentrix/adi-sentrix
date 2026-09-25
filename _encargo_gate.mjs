/* === _encargo_gate.mjs · EL VALIDADOR DEL ENCARGO — CORTE 1 (owner 2026-09-25, offline) ═══════════════════════
 * Corre `fixtures/encargos-desarrollo.json` (44 casos, `_ADI_CONTRATO_ENCARGO_V1.md` §8) contra
 * `src/adi/encargo/validar.js:validarEncargo`. Los casos `decision_pendiente` se reportan aparte y NO ponen la
 * suite en rojo (el contrato §8 lo pide así: son decisiones de producto abiertas, no defectos).
 *
 * LAS CUATRO CARNADAS (contrato, encargo de la etapa):
 *   1 · `preguntaOriginal` distinta → misma Resolucion (nadie la lee).
 *   2 · una entidad inexistente nunca se resuelve a otra (nunca aparece con cifra bajo el nombre de la vecina).
 *   3 · tesorería sola → ausencia declarada con alternativa, nunca una lectura de cobranza servida en su lugar.
 *   4 · el validador no importa ningún módulo prohibido — inspección estática del import graph de
 *       `src/adi/encargo/` (dominiosDeTexto · claveDeMetrica como parser de texto · criterioDeLaPregunta ·
 *       detectors.js · intentLayer.js), y ninguna regex sobre `preguntaOriginal`/`Supuesto.cita` en su fuente.
 *
 * LOS VEREDICTOS DE PREMISAS NO SON DE ESTE CORTE (instrucción del encargo, y contrato §4 paso 4: «el veredicto
 * NO se calcula acá, lo pone la Entrega con el libro»). Este gate SOLO comprueba que la premisa quedó BIEN
 * FORMADA (`validarHecho` la aceptó y aparece en `Resolucion.premisas`) — el campo `esperado.premisas[].veredicto`
 * del fixture, y `premisasDelGate`, son la nota de contexto que dejó quien escribió el catálogo para la etapa
 * siguiente (la Entrega, con `libroDeHechos` sobre el índice real): se imprimen para quien lea la corrida, pero
 * NO se comparan acá.
 *
 * CERO llamadas a un LLM · CERO red. Solo por `npm run gates:offline` o
 * `node --import ./scripts/offline-guard.mjs _encargo_gate.mjs`. */
import fs from "node:fs";
import { initTenant } from "./src/data/tenantStore.js";
import { TENANT_DEMO } from "./src/data/tenants/demo.js";
import { validarEncargo } from "./src/adi/encargo/validar.js";
import { MOTIVOS } from "./src/adi/encargo/esquema.js";

let pass = 0, fail = 0;
const fails = [];
const ok = (c, m, extra = "") => { if (c) { pass++; } else { fail++; fails.push(m + (extra ? " — " + extra : "")); console.log("  ✗ " + m + (extra ? "\n      " + extra : "")); } };
const H = (t) => console.log(`\n${t}`);

initTenant(TENANT_DEMO);

/* ── helpers de comparación (subconjunto, no igualdad exacta — así lo pide el contrato §8) ─────────────────── */
const porId = (arr, id) => (Array.isArray(arr) ? arr.find((p) => p.id === id) : null);
const mismaAlternativa = (esperada, real) => {
  if (!real || typeof real !== "object") return false;
  return Object.keys(esperada).every((k) => JSON.stringify(real[k]) === JSON.stringify(esperada[k]));
};
const contieneAlternativa = (realAlts, esperada) => (Array.isArray(realAlts) ? realAlts : []).some((a) => mismaAlternativa(esperada, a));
const contieneNoResuelto = (R, esp) => (R.noResuelto || []).some((n) => {
  if ((esp.parte ?? null) !== (n.parte ?? null)) return false;
  if (esp.campo !== n.campo) return false;
  if (esp.motivo !== n.motivo) return false;
  if (esp.valorIncluye != null && !JSON.stringify(n.valor ?? "").includes(esp.valorIncluye)) return false;
  if (Array.isArray(esp.alternativasIncluyen) && !esp.alternativasIncluyen.every((a) => contieneAlternativa(n.alternativas, a))) return false;
  return true;
});
const limiteCubierto = (R, id) => {
  for (const p of R.partes || []) if (Array.isArray(p.ausencias) && p.ausencias.includes(id)) return true;
  for (const n of R.noResuelto || []) if (contieneAlternativa(n.alternativas, { tipo: "ausencia", id })) return true;
  return false;
};
const entidadApareceEnAlgunaParte = (R, nombre) => (R.partes || []).some((p) => (p.entidades || []).some((e) => e.nombre === nombre));
const conceptoApareceEnAlgunaParte = (R, clave) => (R.partes || []).some((p) => (p.conceptos || []).includes(clave));
const temaCubierto = (R, tema) => (R.partes || []).some((p) => p.tema === tema && (p.estado === "resuelta" || p.estado === "parcial"));

function correrCaso(caso) {
  const R = validarEncargo(caso.encargo, {});
  const E = caso.esperado;
  const decir = (c, msg, extra = "") => ok(c, `[${caso.id}] ${caso.titulo} · ${msg}`, extra);

  decir(R.ok === E.valido, `valido === ${E.valido}`, `R.ok=${R.ok}`);

  for (const id of E.partes.resueltas || []) decir(porId(R.partes, id)?.estado === "resuelta", `parte ${id} resuelta`, JSON.stringify(porId(R.partes, id)));
  for (const id of E.partes.parciales || []) decir(porId(R.partes, id)?.estado === "parcial", `parte ${id} parcial`, JSON.stringify(porId(R.partes, id)));
  for (const id of E.partes.noResueltas || []) decir(porId(R.partes, id)?.estado === "no_resuelta", `parte ${id} no_resuelta`, JSON.stringify(porId(R.partes, id)));

  for (const tema of E.temasCubiertos || []) decir(temaCubierto(R, tema), `tema cubierto: ${tema}`);

  for (const e of E.entidadesResueltas || []) {
    const p = porId(R.partes, e.parte);
    const tiene = !!(p && (p.entidades || []).some((x) => x.nombre === e.nombre && x.eje === e.eje));
    decir(tiene, `entidad resuelta ${e.parte}/${e.nombre}/${e.eje}`, JSON.stringify(p && p.entidades));
  }

  for (const n of E.noResuelto || []) decir(contieneNoResuelto(R, n), `noResuelto ⊇ ${JSON.stringify(n)}`, JSON.stringify(R.noResuelto));

  if (E.criterio) decir(mismaAlternativa(E.criterio, R.criterio), `criterio ⊇ ${JSON.stringify(E.criterio)}`, JSON.stringify(R.criterio));

  if (Array.isArray(E.avisosIncluyen)) for (const tipo of E.avisosIncluyen) decir((R.avisos || []).some((a) => a.tipo === tipo), `avisos incluye «${tipo}»`, JSON.stringify(R.avisos));

  for (const s of E.supuestosResueltos || []) {
    const sr = (R.supuestos || []).find((x) => x.id === s.id);
    decir(!!sr && sr.productor === s.productor, `supuesto ${s.id} → productor ${s.productor}`, JSON.stringify(sr));
  }

  // el veredicto (verdadera/falsa) NO es de este corte (instrucción del encargo + contrato §4 paso 4): solo se
  // comprueba que la premisa quedó BIEN FORMADA — `p.veredicto` y `premisasDelGate` viajan en el fixture para la
  // etapa siguiente (la Entrega, con `libroDeHechos` sobre el índice real), y se imprimen como nota, no se comparan.
  for (const p of E.premisas || []) {
    decir((R.premisas || []).some((x) => x.id === p.id), `premisa ${p.id} bien formada (well-formed) — veredicto esperado «${p.veredicto}» es de la etapa de la Entrega, no de este corte`, caso.esperado.premisasDelGate || "");
  }

  for (const id of E.limitesEsperados || []) decir(limiteCubierto(R, id), `límite cubierto: ${id}`);

  if (E.prohibido) {
    for (const nombre of E.prohibido.entidades || []) decir(!entidadApareceEnAlgunaParte(R, nombre), `PROHIBIDO: «${nombre}» no aparece con cifra en ninguna parte`);
    for (const clave of E.prohibido.conceptos || []) decir(!conceptoApareceEnAlgunaParte(R, clave), `PROHIBIDO: «${clave}» no se imprime`);
    for (const tema of E.prohibido.temas || []) decir(!temaCubierto(R, tema), `PROHIBIDO: el tema «${tema}» no se cubre`);
  }

  return R;
}

/* ═══ 1 · el catálogo de 44 casos ═══════════════════════════════════════════════════════════════════════════ */
H("1 · fixtures/encargos-desarrollo.json — los casos de desarrollo");
const catalogo = JSON.parse(fs.readFileSync(new URL("./fixtures/encargos-desarrollo.json", import.meta.url)));
ok(Array.isArray(catalogo.casos) && catalogo.casos.length === catalogo._meta.conteos.total, `el catálogo trae ${catalogo.casos.length} casos (declarados: ${catalogo._meta.conteos.total})`);

const pendientes = [];
for (const caso of catalogo.casos) {
  if (caso.esperado.decision_pendiente) { pendientes.push(caso); continue; }
  correrCaso(caso);
}

/* ═══ 2 · decision_pendiente — se reportan aparte, NUNCA ponen la suite en rojo (contrato §8) ═════════════════ */
H(`2 · decision_pendiente (${pendientes.length} casos) — informativo, no falla la suite`);
for (const caso of pendientes) {
  console.log(`  · [${caso.id}] ${caso.titulo}`);
  console.log(`    pendiente: ${caso.esperado.decision_pendiente}`);
  const R = validarEncargo(caso.encargo, {});
  console.log(`    R.ok=${R.ok} · partes=${JSON.stringify(R.partes.map((p) => ({ id: p.id, estado: p.estado })))}`);
}
ok(pendientes.length === catalogo._meta.conteos.decision_pendiente, `decision_pendiente declarados (${pendientes.length}) === los del _meta (${catalogo._meta.conteos.decision_pendiente})`);

/* ═══ 3 · CARNADA 1 · preguntaOriginal distinta → misma Resolucion ═════════════════════════════════════════ */
H("3 · CARNADA 1 — preguntaOriginal viaja solo para auditoría, nunca se lee");
{
  const base = catalogo.casos.find((c) => c.id === "D01");
  const R1 = validarEncargo(base.encargo, {});
  const encargoMutado = { ...base.encargo, preguntaOriginal: "¿cuál es la capital de Marte? — texto que no debería cambiar nada" };
  const R2 = validarEncargo(encargoMutado, {});
  const sinPregunta = (R) => JSON.stringify({ ...R, encargo: { ...R.encargo, preguntaOriginal: undefined } });
  ok(sinPregunta(R1) === sinPregunta(R2), "★ CARNADA · cambiar preguntaOriginal no cambia la Resolucion (todo lo demás byte a byte)");
}

/* ═══ 4 · CARNADA 2 · entidad inexistente nunca se resuelve a otra ═══════════════════════════════════════════ */
H("4 · CARNADA 2 — una entidad inexistente nunca «se parece» a otra en la salida");
{
  const encargo = { version: "encargo/v1", partes: [{ id: "p1", tema: "comercial", cierre: "cifra", conceptos: ["ventas"], entidades: [{ nombre: "Cencosud" }] }] };
  const R = validarEncargo(encargo, {});
  const p1 = porId(R.partes, "p1");
  ok(p1.estado === "no_resuelta" && (p1.entidades || []).length === 0, "★ CARNADA · «Cencosud» (inexistente) no resuelve a ninguna entidad", JSON.stringify(p1));
  const n = (R.noResuelto || []).find((x) => x.campo === "entidad");
  ok(!!n && n.motivo === "entidad_inexistente", "★ CARNADA · el motivo es entidad_inexistente, no una sustitución silenciosa");
  ok((n?.alternativas || []).every((a) => a.tipo === "entidad" && a.nombre !== "Cencosud"), "★ CARNADA · las alternativas son candidatos TIPADOS, nunca la cifra de otra cuenta servida como si fuera Cencosud");
}

/* ═══ 5 · CARNADA 3 · tesorería sola → ausencia declarada, nunca cobranza servida en su lugar ═════════════════ */
H("5 · CARNADA 3 — «caja» nunca cae a una lectura de cobranza (ley adi-caja-no-es-cobranza)");
{
  const encargo = { version: "encargo/v1", partes: [{ id: "p1", tema: "tesoreria", cierre: "lectura" }] };
  const R = validarEncargo(encargo, {});
  ok(R.ok === false, "★ CARNADA · tesorería sola: el encargo NO queda válido");
  const p1 = porId(R.partes, "p1");
  ok(p1.estado === "no_resuelta" && p1.tema === "tesoreria", "★ CARNADA · la parte queda no_resuelta con su propio tema, nunca reetiquetada «cobranza»");
  const n = (R.noResuelto || []).find((x) => x.motivo === "tema_ausente");
  ok(!!n && contieneAlternativa(n.alternativas, { tipo: "ausencia", id: "sin_datos_tesoreria" }), "★ CARNADA · la alternativa ofrecida es la ausencia tipada, con su texto — nunca una Entrega de cobranza");
}

/* ═══ 6 · CARNADA 4 · el import graph de src/adi/encargo/ no toca ningún módulo prohibido ══════════════════════
 * Inspección ESTÁTICA de texto fuente (nunca ejecuta nada del grafo): ni `dominiosDeTexto`, ni `claveDeMetrica`
 * usado sobre `preguntaOriginal`/`.cita`, ni `criterioDeLaPregunta`, ni un import de `detectors.js`/
 * `intentLayer.js`, ni una regex construida sobre esos dos campos. */
H("6 · CARNADA 4 — el validador no importa ningún módulo prohibido (§4)");
{
  const archivos = ["./src/adi/encargo/esquema.js", "./src/adi/encargo/validar.js"];
  for (const ruta of archivos) {
    const src = fs.readFileSync(new URL(ruta, import.meta.url), "utf8");
    // inspección de las líneas `import { ... } from "..."` — NO del texto de los comentarios (esta misma
    // cabecera del gate y de validar.js NOMBRAN los símbolos prohibidos para documentar la ley que obedecen;
    // lo que importa es si el import graph los TRAE, no si el archivo los menciona en prosa).
    const lineasImport = (src.match(/^\s*import\s*\{[^}]*\}\s*from\s*["'][^"']+["'];?\s*$/gm) || []).join("\n");
    ok(!/\bdominiosDeTexto\b/.test(lineasImport), `${ruta} · no importa dominiosDeTexto`);
    ok(!/\bcriterioDeLaPregunta\b/.test(lineasImport), `${ruta} · no importa criterioDeLaPregunta`);
    ok(!/\bclaveDeMetrica\b/.test(lineasImport), `${ruta} · no importa claveDeMetrica`);
    ok(!/from\s+["'][^"']*\/detectors\.js["']/.test(lineasImport), `${ruta} · no importa detectors.js`);
    ok(!/from\s+["'][^"']*\/intentLayer\.js["']/.test(lineasImport), `${ruta} · no importa intentLayer.js`);
    // ninguna regex del ARCHIVO (fuera de comentarios de documentación) se construye sobre preguntaOriginal/.cita:
    // se buscan usos de esos campos seguidos de .test/.match/.exec o dentro de un new RegExp(...), en líneas de
    // código (las que no empiezan con `//` ni ` *`, el prefijo de los bloques /* */ de este repo).
    const lineasDeCodigo = src.split("\n").filter((l) => !/^\s*(\*|\/\/)/.test(l)).join("\n");
    ok(!/preguntaOriginal[^\n]*\.(test|match|exec)\(|new RegExp\([^)]*preguntaOriginal/.test(lineasDeCodigo), `${ruta} · ninguna regex corre sobre preguntaOriginal`);
    ok(!/\.cita\b[^\n]*\.(test|match|exec)\(/.test(lineasDeCodigo), `${ruta} · ninguna regex corre sobre Supuesto.cita`);
  }
}

/* ═══ 7 · MOTIVOS — lista cerrada: todo lo que produjo la corrida es un motivo declarado en el contrato ═══════ */
H("7 · MOTIVOS — todo lo emitido por la corrida pertenece a la lista cerrada del contrato §2.1");
{
  const usados = new Set();
  for (const caso of catalogo.casos) {
    const R = validarEncargo(caso.encargo, {});
    for (const n of R.noResuelto || []) usados.add(n.motivo);
  }
  const fueraDeLista = [...usados].filter((m) => !MOTIVOS.includes(m));
  ok(fueraDeLista.length === 0, "todos los motivos emitidos están en MOTIVOS (esquema.js)", fueraDeLista.join(", "));
  console.log(`  · motivos ejercitados por el catálogo (${usados.size} de ${MOTIVOS.length}): ${[...usados].sort().join(" · ")}`);
}

console.log(`\n── _encargo_gate: PASS ${pass} · FAIL ${fail} (de ${pass + fail}) ──`);
if (fail) { console.log("\nFALLOS:"); for (const f of fails) console.log("  ✗ " + f); }
process.exit(fail ? 1 : 0);
