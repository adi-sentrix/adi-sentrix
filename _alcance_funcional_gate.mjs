/* === _alcance_funcional_gate.mjs · EL CANDADO DE COMPLETITUD DE ALCANCE.JS, HECHO FUNCIONAL (Etapa 1, diagnóstico
 * v5 — supervisor 2026-09-26, offline) ═══════════════════════════════════════════════════════════════════════════
 * `src/adi/entrega/alcance.js` traía, hasta esta ronda, un candado de completitud puramente ESTÁTICO: al cargar el
 * módulo, comparaba `_CAMPOS_MANEJADOS` (una lista escrita a mano) contra `CAMPOS_UNIVERSO` (`notario/hechos.js`,
 * la única fuente) y tiraba si faltaba un nombre. Ese candado NO SIRVIÓ para cazar R-BASE-SIN-ALCANCE: `base`
 * FIGURABA en `_CAMPOS_MANEJADOS` (se exponía en `alcanceDeParte`) sin que NINGÚN código la usara para recortar —
 * el candado solo comprobaba que el CAMPO se leyera, nunca que RECORTARA lo servido. W77 lo probó con dato real:
 * `universo:{eje:"cliente", base:"carga comercial alta"}` (6 cuentas) servía las 12 cuentas del eje completo.
 *
 * Este gate reemplaza esa promesa vacía por una FUNCIONAL: por cada campo de `CAMPOS_UNIVERSO`, un caso REAL
 * (tenant demo, llamadas de verdad al Core) que demuestra que ese campo recorta lo que se sirve — no importa qué
 * pieza lo aplique (`figsEnAlcance`/`alcanceDeParte` para eje/excluir/bodega/base/union; `conjuntoDeUniverso` —
 * `notario/verificar.js`, la MISMA primitiva que ya usa `entrega/componer.js:_planCifraGrupoUniverso` para
 * estados/no_estados/filtros/top— para los campos que el compositor resuelve por ESA vía). El candado final
 * (sección 10) enumera `CAMPOS_UNIVERSO` y falla ROJO si un campo no tiene un caso real — así que un campo
 * nuevo, mañana, no puede colarse como «manejado» sin probarlo. NINGÚN campo queda de excepción: `union` (la
 * única que quedaba sin caso en la primera vuelta del diagnóstico v5) se cerró en la segunda vuelta — sección 9.
 *
 * CERO llamadas a un LLM · CERO red. Solo por `npm run gates:offline` o
 * `node --import ./scripts/offline-guard.mjs _alcance_funcional_gate.mjs`. */
import fs from "node:fs";
import { initTenant } from "./src/data/tenantStore.js";
import { TENANT_DEMO } from "./src/data/tenants/demo.js";
import { cifrasDelDato } from "./src/adi/oracle/datoProyectado.js";
import { axisEntityNames } from "./src/adi/oracle/entityIndex.js";
import { indiceDeEvidencia } from "./src/adi/notario/evidencia.js";
import { asignarIds, CAMPOS_UNIVERSO } from "./src/adi/notario/hechos.js";
import { conjuntoDeUniverso } from "./src/adi/notario/verificar.js";
import { alcanceDeParte, figsEnAlcance } from "./src/adi/entrega/alcance.js";
import { runPlan } from "./src/adi/oracle/toolRunner.js";
import { REGISTRO_LECTURAS } from "./src/adi/encargo/lecturasDe.js";
import { ESCENARIO_INICIAL } from "./src/config/scenarios.js";
import { clasificarFuente } from "./scripts/clasificarGates.mjs";

let pass = 0, fail = 0;
const fails = [];
const ok = (c, m, extra = "") => { if (c) { pass++; } else { fail++; fails.push(m + (extra ? " — " + extra : "")); console.log("  ✗ " + m + (extra ? "\n      " + extra : "")); } };
const H = (t) => console.log(`\n${t}`);

initTenant(TENANT_DEMO);
const scenario = ESCENARIO_INICIAL;
const datoProyectado = cifrasDelDato(scenario);
const EJES = ["cliente", "sku", "marca", "familia", "bodega", "canal"];
const ejesDelTenant = {};
for (const eje of EJES) { try { const n = axisEntityNames(eje); if (n && n.length) ejesDelTenant[eje] = n; } catch { /* eje sin índice en este tenant */ } }

// misma forma que `entidadDeLabel` (default de `figsEnAlcance`, alcance.js): solo una fig «Entidad · Concepto»
// tiene entidad — un total/agregado sin «·» (p. ej. «Venta total») NO es una entidad y se descarta acá, nunca se
// cuenta como si fuera una cuenta o un SKU de más. Un agregado CON «·» pero sin entidad («Capital en inventario ·
// total») también se descarta — la MISMA ambigüedad de forma que R-ROTULO-CONTEO-FILTRO cerró en `componer.js`:
// un «·» no siempre separa «Entidad · Concepto».
const _ent = (label) => {
  const s = String(label || "");
  if (/·\s*(?:total|subtotal|promedio)\s*$/i.test(s)) return null;
  const p = s.split("·").map((x) => x.trim());
  return p.length >= 2 ? p[0] : null;
};
const _entidades = (figs) => new Set(figs.map((f) => _ent(f.label)).filter(Boolean));
function correr(calls) {
  const rp = runPlan({ intent: "gate", calls }, { scenario, maxCalls: 8, registry: REGISTRO_LECTURAS });
  return asignarIds((rp.ledger && rp.ledger.figs) || []);
}
const indiceDe = (figs) => indiceDeEvidencia({ figs, datoProyectado, ejesDelTenant });

const CUBIERTOS = new Set();
const caso = (campo, fn) => { CUBIERTOS.add(campo); fn(); };

/* ═══ 1 · eje — figsEnAlcance retira las figs de un eje AJENO ═══════════════════════════════════════════════════ */
H("1 · eje — un SKU no aparece en un recorte declarado por cliente");
caso("eje", () => {
  const mezcla = [...correr([{ tool: "queryMetric", args: { metric: "ventas", dimension: "cliente" } }]),
    ...correr([{ tool: "queryMetric", args: { metric: "capital", dimension: "sku" } }])];
  ok(mezcla.some((f) => _ent(f.label) === "SAM-TV55") && mezcla.some((f) => _ent(f.label) === "Falabella"), "sanity: el caso mezcla dos ejes de verdad");
  const alcance = alcanceDeParte({ tema: "comercial", entidades: [], universo: { eje: "cliente" }, eje: "cliente" });
  const recortadas = figsEnAlcance(mezcla, alcance, { ejesDelTenant });
  const entidades = _entidades(recortadas);
  ok(!entidades.has("SAM-TV55") && entidades.has("Falabella"), "eje: un SKU queda fuera de un recorte por cliente", [...entidades].join(", "));
});

/* ═══ 2 · excluir — la entidad excluida no vuelve ════════════════════════════════════════════════════════════════ */
H("2 · excluir — la entidad excluida no aparece, las demás sí");
caso("excluir", () => {
  const figs = correr([{ tool: "queryMetric", args: { metric: "ventas", dimension: "cliente" } }]);
  const alcance = alcanceDeParte({ tema: "comercial", entidades: [], universo: { eje: "cliente", excluir: { entidades: ["Falabella"] } }, eje: "cliente" });
  const recortadas = figsEnAlcance(figs, alcance, { ejesDelTenant });
  const entidades = _entidades(recortadas);
  ok(!entidades.has("Falabella") && entidades.has("Jumbo") && entidades.size === _entidades(figs).size - 1, "excluir: exactamente la entidad declarada queda fuera", [...entidades].join(", "));
});

/* ═══ 3 · bodega — solo los SKU de la bodega declarada (K16) ═════════════════════════════════════════════════════ */
H("3 · bodega — «Valparaíso» sirve solo sus SKU, nunca el inventario completo (K16)");
caso("bodega", () => {
  const figs = correr([{ tool: "queryMetric", args: { metric: "capital", dimension: "sku" } }]);
  const I = indiceDe(figs);
  const alcance = alcanceDeParte({ tema: "inventario", entidades: [], universo: { eje: "sku", bodega: "Valparaíso" }, eje: "sku" });
  const recortadas = figsEnAlcance(figs, alcance, { ejesDelTenant, indice: I });
  const entidades = _entidades(recortadas);
  const esperadas = new Set(["LG-DRYER8KG", "BOS-SANDER", "SAM-MICRO32L", "PHI-HAIR-PRO"]);
  ok(entidades.size > 0 && entidades.size < figs.length, "bodega: el recorte es un subconjunto propio (no el inventario completo)", `${entidades.size} de ${figs.length}`);
  ok([...entidades].every((e) => esperadas.has(e)), "bodega: ningún SKU de OTRA bodega se cuela en Valparaíso", [...entidades].join(", "));
});

/* ═══ 4 · base — «carga comercial alta» sirve solo esas 6 cuentas (carnada W77, R-BASE-SIN-ALCANCE) ══════════════ */
H("4 · base — «carga comercial alta» sirve solo esas 6 cuentas, nunca el eje entero (carnada W77)");
caso("base", () => {
  const figs = correr([{ tool: "queryMetric", args: { metric: "ventas", dimension: "cliente" } }]);
  const I = indiceDe(figs);
  const alcance = alcanceDeParte({ tema: "comercial", entidades: [], universo: { eje: "cliente", base: "carga comercial alta" }, eje: "cliente" });
  const recortadas = figsEnAlcance(figs, alcance, { ejesDelTenant, indice: I });
  const entidades = _entidades(recortadas);
  const esperadas = new Set(["Falabella", "Jumbo", "Lider", "Sodimac", "Ripley", "Easy"]);
  ok(entidades.size === esperadas.size && [...entidades].every((e) => esperadas.has(e)), "base: exactamente las 6 cuentas de «carga comercial alta»", [...entidades].join(", "));
});

/* ═══ 5 · top — «los 3 más chicos» sirve los 3 más chicos (carnada W79, R-SORT-DIRECCION-IGNORADA) ═══════════════ */
H("5 · top — «menor» sirve los 3 clientes MÁS CHICOS, nunca los más grandes (carnada W79)");
caso("top", () => {
  const figs = correr([{ tool: "queryMetric", args: { metric: "ventas", dimension: "cliente", sort: { dir: "asc" }, limit: 3 } }]);
  const entidades = _entidades(figs);
  const esperadas = new Set(["Unimarc", "ABC", "Hites"]);
  ok(entidades.size === 3 && [...entidades].every((e) => esperadas.has(e)), "top «menor»: los 3 servidos son los 3 más chicos del eje", [...entidades].join(", "));
  // el mismo conjunto, resuelto por la primitiva del Notario (`conjuntoDeUniverso`, `_topTipado`) — la que la
  // defensa en profundidad de `_planCifraGrupo` usa para nunca confiar a ciegas en la tool.
  const I = indiceDe(correr([{ tool: "queryMetric", args: { metric: "ventas", dimension: "cliente" } }]));
  const R = conjuntoDeUniverso({ eje: "cliente", top: { metrica: "ventas", k: 3, direccion: "menor" } }, I, "cliente", "");
  ok(R && R.set && R.set.size === 3 && [...R.set].every((k) => esperadas.has((I.entidades.get(k) || {}).nombre)), "top: `conjuntoDeUniverso` (la defensa en profundidad) resuelve el mismo top-3", R && R.fuente);
});

/* ═══ 6 · estados — «en mora» recorta a un subconjunto propio del eje ═══════════════════════════════════════════ */
H("6 · estados — «en mora» recorta a un subconjunto propio del eje cliente");
caso("estados", () => {
  const figs = correr([{ tool: "cobranza", args: {} }]);
  const I = indiceDe(figs);
  const R = conjuntoDeUniverso({ eje: "cliente", estados: ["en mora"] }, I, "cliente", "");
  ok(!!(R && R.set && R.set.size > 0 && R.set.size < ejesDelTenant.cliente.length), "estados: «en mora» es un subconjunto propio, ni vacío ni el eje entero", R && (R.error || `${R.set && R.set.size} de ${ejesDelTenant.cliente.length}`));
});

/* ═══ 7 · no_estados — el complemento exacto de «en mora» ═══════════════════════════════════════════════════════ */
H("7 · no_estados — el complemento EXACTO de «en mora», sin superposición");
caso("no_estados", () => {
  const figs = correr([{ tool: "cobranza", args: {} }]);
  const I = indiceDe(figs);
  const Rmora = conjuntoDeUniverso({ eje: "cliente", estados: ["en mora"] }, I, "cliente", "");
  const Rsana = conjuntoDeUniverso({ eje: "cliente", no_estados: ["en mora"] }, I, "cliente", "");
  const total = ejesDelTenant.cliente.length;
  ok(!!(Rmora && Rmora.set && Rsana && Rsana.set), "no_estados: ambos conjuntos resuelven contra la evidencia", JSON.stringify({ mora: Rmora && Rmora.error, sana: Rsana && Rsana.error }));
  if (Rmora && Rmora.set && Rsana && Rsana.set) {
    ok(Rsana.set.size === total - Rmora.set.size, "no_estados: tamaño = eje entero − «en mora»", `${Rsana.set.size} vs ${total - Rmora.set.size}`);
    ok(![...Rsana.set].some((k) => Rmora.set.has(k)), "no_estados: cero superposición con «en mora»");
  }
});

/* ═══ 8 · filtros — «margen bajo el benchmark» recorta a un subconjunto propio ═══════════════════════════════════ */
H("8 · filtros — «margen < benchmark» recorta a un subconjunto propio del eje cliente");
caso("filtros", () => {
  const figs = correr([
    { tool: "marginRead", args: { focus: "bajo_benchmark", dimension: "cliente" } },
    { tool: "queryMetric", args: { metric: "margen", dimension: "cliente" } },
  ]);
  const I = indiceDe(figs);
  const R = conjuntoDeUniverso({ eje: "cliente", filtros: [{ metrica: "margen", op: "<", ref: "benchmark" }] }, I, "cliente", "");
  ok(!!(R && R.set && R.set.size > 0 && R.set.size < ejesDelTenant.cliente.length), "filtros: «margen < benchmark» es un subconjunto propio, ni vacío ni el eje entero", R && (R.error || `${R.set && R.set.size} de ${ejesDelTenant.cliente.length}`));
});

/* ═══ 9 · union — «en mora» UNIDO a «carga comercial alta» recorta a la unión, ni un conjunto solo ni el eje
 * entero (supervisor 2026-09-26, segunda vuelta: cierre del hueco reportado en la primera) ═══════════════════════
 * `union` es ADITIVA sobre lo que YA restringió `estados` (`notario/verificar.js:_conjuntoTipado`): «en mora»
 * sola son 6 cuentas (Falabella, Jumbo, Lider, Sodimac, Tottus, Paris); unida a «carga comercial alta» (Falabella,
 * Jumbo, Lider, Sodimac, Ripley, Easy) da la UNIÓN de ambas — 8 de las 13, ni las 6 de un solo conjunto ni el eje
 * entero — probando que `union` REALMENTE amplía (Ripley/Easy entran sin estar en mora) y REALMENTE recorta
 * (Tottus/Paris quedan dentro por «en mora», pero Mercado Libre/La Polar/Hites/ABC/Unimarc quedan fuera de los
 * dos). */
H("9 · union — «en mora» ∪ «carga comercial alta» = 8 de 13, ni un conjunto solo ni el eje entero");
caso("union", () => {
  const figs = correr([{ tool: "queryMetric", args: { metric: "ventas", dimension: "cliente" } }, { tool: "cobranza", args: {} }]);
  const I = indiceDe(figs);
  const universo = { eje: "cliente", estados: ["en mora"], union: [{ base: "carga comercial alta" }] };
  const alcance = alcanceDeParte({ tema: "comercial", entidades: [], universo, eje: "cliente" });
  const recortadas = figsEnAlcance(figs, alcance, { ejesDelTenant, indice: I });
  const entidades = _entidades(recortadas);
  const esperadas = new Set(["Falabella", "Jumbo", "Lider", "Sodimac", "Tottus", "Paris", "Ripley", "Easy"]);
  ok(entidades.size === esperadas.size && [...entidades].every((e) => esperadas.has(e)), "union: exactamente la unión de «en mora» y «carga comercial alta» (8 de 13)", [...entidades].join(", "));
  ok(entidades.has("Ripley") && entidades.has("Easy"), "union: AMPLÍA — Ripley y Easy entran por la unión aunque no están en mora");
  ok(!entidades.has("Mercado Libre") && !entidades.has("La Polar"), "union: sigue siendo un recorte — cuentas fuera de ambos conjuntos no aparecen");
  // la misma resolución vía `conjuntoDeUniverso` a secas (sin pasar por `figsEnAlcance`), para que el candado
  // funcional cubra la primitiva Y el punto de aplicación en un solo caso.
  const R = conjuntoDeUniverso(universo, I, "cliente", "");
  ok(R && R.set && R.set.size === esperadas.size, "union: `conjuntoDeUniverso` resuelve el mismo conjunto de 8", R && (R.error || R.set.size));
});

/* ═══ 10 · EL CANDADO — cada campo de CAMPOS_UNIVERSO tiene un caso real, sin excepciones ═══════════════════════ */
H("10 · candado de completitud FUNCIONAL — reemplaza la lista estática de alcance.js");
const faltantes = CAMPOS_UNIVERSO.filter((c) => !CUBIERTOS.has(c));
ok(faltantes.length === 0, "cada campo de CAMPOS_UNIVERSO tiene un caso funcional — ninguna excepción", faltantes.join(", "));
ok(CAMPOS_UNIVERSO.every((c) => CUBIERTOS.has(c)) && [...CUBIERTOS].every((c) => CAMPOS_UNIVERSO.includes(c)), "los casos de este gate y CAMPOS_UNIVERSO son la MISMA lista (nada de más, nada de menos)");

/* ═══ 11 · CERO red ═══════════════════════════════════════════════════════════════════════════════════════════ */
H("11 · CERO red — clasificarFuente(este gate) === offline");
{
  const propioSrc = fs.readFileSync(new URL(import.meta.url), "utf8");
  const c = clasificarFuente(propioSrc);
  ok(c.tipo === "offline", "clasificarFuente(_alcance_funcional_gate.mjs) === offline", JSON.stringify(c));
}

console.log(`\n── _alcance_funcional_gate: PASS ${pass} · FAIL ${fail} (de ${pass + fail}) ──`);
if (fail) { console.log("\nFALLOS:"); for (const f of fails) console.log("  ✗ " + f); }
process.exit(fail ? 1 : 0);
