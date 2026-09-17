/* === _hechos_gate.mjs · EL LIBRO DE HECHOS (verdad finita · etapa E1 · owner 2026-09-17, offline) ═══════════════════════════════════
 * «La verdad se identifica, no se describe.» Este gate mide el libro de hechos (src/adi/notario/hechos.js) sobre hechos IDENTIFICADOS —sin una
 * línea de prosa— contra la boleta real del demo: refs por id, cifras por clave, órdenes y conteos con universo TIPADO (filtros con unidades de
 * tiempo, exclusiones por top-k y por bodega, estados y no-estados), razones sin lista blanca, derivadas, estados de producto (al día = vencido 0;
 * «buen pagador» exige historia → nunca demostrable; «no deja contribución» ≠ «no deja margen»), lecturas con apoyo y propuestas selladas.
 * Cada hecho trae su veredicto esperado; lo falso devuelve la verdad como hechos nuevos con id (derivados); y el render de los placeholders.
 * Solo por `npm run gates:offline` (o con el candado: node --import ./scripts/offline-guard.mjs _hechos_gate.mjs). Cero red. */
import fs from "node:fs";
import { initTenant } from "./src/data/tenantStore.js";
import { TENANT_DEMO } from "./src/data/tenants/demo.js";
import { ESCENARIO_INICIAL } from "./src/config/scenarios.js";
import { cifrasDelDato } from "./src/adi/oracle/datoProyectado.js";
import { axisEntityNames } from "./src/adi/oracle/entityIndex.js";
import { runPlan } from "./src/adi/oracle/toolRunner.js";
import { TOOLS } from "./src/adi/oracle/toolRegistry.js";
import { cajaDelAgente } from "./src/adi/agente/herramientasAgente.js";
import { playbookPara, pasosDe } from "./src/adi/agente/playbooks/registro.js";
import { partesDelEncargo, pasosDelEncargo } from "./src/adi/agente/encargoCompuesto.js";
import { dominiosDe, pasosDeDominios, unirPasosDeDominios } from "./src/adi/agente/contratoDeDominios.js";
import { indiceDeEvidencia } from "./src/adi/notario/evidencia.js";
import { libroDeHechos, asignarIds, extraerHechos, nombrarUniverso, renderDe, MARCA_HECHOS } from "./src/adi/notario/hechos.js";
import { claveDeMetrica, metricaDeClave, CLAVES_DE_METRICA, diasDe } from "./src/adi/notario/lexico.js";

let PASS = 0, FAIL = 0;
const ok = (c, m, extra = "") => { if (c) { PASS++; console.log("  ✓ " + m); } else { FAIL++; console.log("  ✗ " + m + (extra ? "\n      " + extra : "")); } };
const H = (t) => console.log(`\n${t}`);
initTenant(TENANT_DEMO);
const ejes = {}; for (const e of ["cliente", "sku", "marca", "familia", "bodega", "canal"]) { try { const n = axisEntityNames(e); if (n && n.length) ejes[e] = n; } catch { /* sin índice */ } }
const DATO = cifrasDelDato(ESCENARIO_INICIAL);
const CAJA = cajaDelAgente(TOOLS);
const figsDe = (pregunta) => {
  const pb = playbookPara(pregunta, {});
  const dom = (() => { try { return dominiosDe(pregunta); } catch { return { dominios: [], eje: null }; } })();
  const pasos = unirPasosDeDominios(pasosDelEncargo(partesDelEncargo(pregunta), pb ? pasosDe(pb, pregunta, {}) : [], {}), (() => { try { return pasosDeDominios(dom); } catch { return []; } })());
  const rp = runPlan({ intent: "answer", calls: pasos.map((p) => ({ tool: p.tool, args: p.args || {} })) }, { scenario: ESCENARIO_INICIAL, maxCalls: 18, preguntaUsuario: pregunta, registry: CAJA });
  return asignarIds((rp.ledger && rp.ledger.figs) || rp.ledger || []);
};
const F = JSON.parse(fs.readFileSync(new URL("./fixtures/hechos-tipados-2026-09-17.json", import.meta.url), "utf8"));

/* ═══ 1 · EL LÉXICO ═══ */
H("1 · el léxico como datos: claves de métrica, dominios, polaridad, tiempo");
ok(CLAVES_DE_METRICA.length >= 30, `${CLAVES_DE_METRICA.length} claves de métrica`);
ok(claveDeMetrica("Saldo vencido") === "saldo_vencido" && claveDeMetrica("deuda vencida") === "saldo_vencido" && claveDeMetrica("Venta (flujo)") === "ventas", "una métrica dicha con palabras resuelve a su clave (Saldo vencido · deuda vencida · Venta (flujo))");
ok(metricaDeClave("dias_vencido") === "Días vencido" && metricaDeClave("Margen") === "Margen", "la clave vuelve al nombre con que se busca la fig; un nombre libre pasa tal cual");
ok(diasDe(3, "meses") === 90 && diasDe(1, "trimestre") === 90 && diasDe(2, "semestres") === 360 && diasDe(1, "año") === 365, "meses · trimestre · semestre · año → días por tabla");
ok(new Set(CLAVES_DE_METRICA.map((m) => m.clave)).size === CLAVES_DE_METRICA.length, "sin claves repetidas");

/* ═══ 2 · EL BLOQUE ═══ */
H("2 · el bloque <<HECHOS>> se extrae antes de la prosa y se quita");
{
  const salida = `${MARCA_HECHOS}\n{"id":"h1","tipo":"ref","de":"c1"}\n{"id":"h2","tipo":"estado","sujeto":"Jumbo","estado":"al_dia"}\n<<FIN>>\nTe va bien en venta.`;
  const x = extraerHechos(salida);
  ok(x.bloque && x.hechos.length === 2 && x.prosa === "Te va bien en venta." && !x.errores.length, "dos hechos y la prosa limpia");
  const y = extraerHechos("Sin bloque.");
  ok(!y.bloque && y.hechos === null && y.prosa === "Sin bloque.", "sin bloque: hechos = null (nunca se supone)");
}

/* ═══ 3 · LOS HECHOS TIPADOS CONTRA LA BOLETA REAL ═══ */
const acepta = (esperado, veredicto) => (esperado === "no-verdadera" ? veredicto !== "verdadera" && veredicto !== "sellada" : veredicto === esperado);
let total = 0, aciertos = 0, fnConfirmadas = 0, fpConfirmados = 0;
for (const c of F.casos) {
  H(`3 · ${c.id} · «${c.pregunta}»`);
  const figs = figsDe(c.pregunta);
  const I = indiceDeEvidencia({ figs, datoProyectado: DATO, ejesDelTenant: ejes });
  const libro = libroDeHechos(c.hechos, { indice: I });
  for (const [id, esperado] of Object.entries(c.esperado)) {
    const Hh = libro.porId.get(id);
    total++;
    const bien = !!Hh && acepta(esperado, Hh.veredicto);
    if (bien) aciertos++;
    if (!bien && Hh && esperado !== "verdadera" && esperado !== "sellada" && (Hh.veredicto === "verdadera" || Hh.veredicto === "sellada")) fnConfirmadas++;
    if (!bien && Hh && (esperado === "verdadera" || esperado === "sellada") && Hh.veredicto !== "verdadera" && Hh.veredicto !== "sellada") fpConfirmados++;
    ok(bien, `${id} [${Hh ? Hh.tipo : "?"}] esperado ${esperado} → ${Hh ? Hh.veredicto : "sin hecho"}`, Hh ? `${Hh.motivo.slice(0, 200)}${Hh.verdad ? " · " + Hh.verdad.slice(0, 120) : ""}` : "");
  }
  for (const [id, lista] of Object.entries(c.derivados || {})) for (const d of lista) { const D = libro.porId.get(d); ok(!!D && D.ok && D.derivadoDe === id, `la verdad de lo falso vuelve con id: ${d} ← ${id}`, D ? D.motivo : "no existe"); }
  for (const [id, esperado] of Object.entries(c.render || {})) {
    if (typeof esperado === "string") ok(renderDe(libro, id) === esperado, `render {${id}} = «${esperado}»`, `→ «${renderDe(libro, id)}»`);
    else for (const [campo, v] of Object.entries(esperado)) ok(renderDe(libro, id, campo) === v, `render {${id}.${campo}} = «${v}»`, `→ «${renderDe(libro, id, campo)}»`);
  }
  /* todo hecho FACTUAL trae roles y claves (lo que la etapa E2 contrasta dentro del ancla) */
  const factuales = libro.hechos.filter((x) => x.ok && /^(?:ref|cifra|orden|relacion|grupo|conteo|variacion|razon|derivada)$/.test(x.tipo));
  const conDueno = (x) => x.entidades.size || x.roles.sujetos.includes("negocio") || (x.tipo === "conteo" && x.universo && x.universo.set && x.universo.set.size === 0);   // un conteo de cero no tiene entidades
  ok(factuales.every(conDueno), `${factuales.length} hechos verdaderos con entidad o «negocio»`, factuales.filter((x) => !conDueno(x)).map((x) => x.id).join(","));
  const conClave = (x) => x.claves.size || x.estado || (x.estadosDelUniverso && x.estadosDelUniverso.size) || (x.universo && x.universo.restringido);   // un conteo por estado o por un conjunto de la casa se contrasta por ese universo, no por una métrica
  ok(factuales.filter((x) => x.tipo !== "estado").every(conClave), "…y con clave de métrica (o estado)", factuales.filter((x) => x.tipo !== "estado" && !conClave(x)).map((x) => x.id).join(","));
  ok(libro.texto.split("\n").length === libro.hechos.filter((x) => !x.derivadoDe).length, "el libro en texto: una línea por hecho del modelo");
}
H("4 · medidas");
ok(fnConfirmadas === 0, `falsedades dictadas verdaderas: ${fnConfirmadas} (debe ser 0)`);
ok(fpConfirmados === 0, `hechos verdaderos bloqueados: ${fpConfirmados} (debe ser 0)`);
console.log(`  veredictos correctos: ${aciertos}/${total}`);

/* ═══ 5 · EL NOMBRADOR DE UNIVERSOS ═══ */
H("5 · el universo lo escribe la casa");
{
  const figs = figsDe("¿Cómo viene mi cobranza y quién me debe más?");
  const I = indiceDeEvidencia({ figs, datoProyectado: DATO, ejesDelTenant: ejes });
  ok(nombrarUniverso({ eje: "cliente" }, I) === "los 13 clientes", "el eje entero con su tamaño");
  ok(nombrarUniverso({ eje: "cliente", excluir: { top: { metrica: "ventas", k: 3 } } }, I) === "los clientes fuera de los 3 de mayor venta", "exclusión por top-k");
  ok(nombrarUniverso({ eje: "cliente", no_estados: ["en_mora"], filtros: [{ metrica: "margen", op: "<", ref: "benchmark" }] }, I) === "los clientes sin mora con margen inferior a benchmark de margen", "sin mora + bajo el benchmark");
  ok(nombrarUniverso({ eje: "sku", excluir: { bodega: "Santiago" } }, I) === "los SKU fuera de Santiago", "SKU fuera de una bodega");
  ok(nombrarUniverso({ eje: "cliente", filtros: [{ metrica: "dias_vencido", op: ">", valor: 1, unidad: "trimestre" }] }, I) === "los clientes con días vencido superior a 1 trimestre", "umbral en trimestres, escrito como se pidió");
}

/* ═══ 6 · CARNADAS ═══ */
H("6 · CARNADA · el libro no adivina");
{
  const figs = figsDe("¿Cómo viene mi cobranza y quién me debe más?");
  const I = indiceDeEvidencia({ figs, datoProyectado: DATO, ejesDelTenant: ejes });
  const libro = libroDeHechos([
    { id: "a", tipo: "ref", de: "c9999" },
    { id: "b", tipo: "orden", sujeto: "Lider", metrica: "saldo_pendiente", orden: { forma: "max" }, universo: { eje: "cliente", base: "los grandes de siempre" } },
    { id: "c", tipo: "conteo", n: 3, de: { eje: "cliente", filtros: [{ metrica: "dias_vencido", op: ">", valor: 1, unidad: "lustros" }] } },
    { id: "d", tipo: "estado", sujeto: "Lider", estado: "urgente" },
    { id: "e", tipo: "razon", num: { sujeto: "Lider", metrica: "saldo_pendiente" }, den: { sujeto: "Lider", metrica: "dias_vencido" } },
    { id: "f", tipo: "cifra", sujeto: "Nadie S.A.", metrica: "ventas" },
    { id: "a", tipo: "ref", de: "c1" },
  ], { indice: I });
  const v = (id) => libro.hechos.find((x) => x.id === id);
  ok(v("a").veredicto === "no-verificable" && /ref-desconocida/.test(v("a").motivo), "una ref a un id que no existe no es un hecho");
  ok(v("b").veredicto === "no-verificable" && /no es un conjunto/.test(v("b").motivo), "una base que la evidencia no identifica no se resuelve");
  ok(v("c").veredicto === "no-verificable" && /unidad «lustros»/.test(v("c").motivo), "una unidad de tiempo fuera de la tabla no se adivina");
  ok(v("d").veredicto === "no-verificable" && /estado-desconocido/.test(v("d").motivo), "un estado sin definición en la casa no se verifica");
  ok(v("e").veredicto === "no-verificable" && /unidades-distintas/.test(v("e").motivo), "una razón entre unidades distintas no se calcula");
  ok(v("f").veredicto === "no-verificable", "una entidad que no es del tenant no tiene cifra");
  ok(libro.hechos.filter((x) => x.id === "a").length === 2 && libro.errores.some((e) => /id-repetido/.test(e)), "un id repetido se anota y no pisa al primero");
}

console.log(`\n── _hechos_gate: ${PASS} PASS · ${FAIL} FAIL (de ${PASS + FAIL}) ──`);
process.exit(FAIL ? 1 : 0);
