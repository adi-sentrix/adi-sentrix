/* === _entity_index_gate.mjs · CONTRATO v2 · FASE 3 (owner 2026-08-07) ================================
 * [1] ÍNDICE por eje/tenant: existe, cubre los ejes reales, y se INVALIDA al cambiar de tenant.
 * [2] CANONICALIZACIÓN O(1): equivalente al scan histórico (no cambia resoluciones existentes).
 * [3] FUZZY EN LA ENTRADA: "Falabela" (falta una letra) propone candidatos REALES del tenant.
 * [4] COLISIONES entre ejes: se detectan y exponen en vez de resolverse en silencio.
 * [5] DESAMBIGUACIÓN: resolveEntityRef devuelve veredicto explícito (resuelto/ambiguo/sugerencia/desconocido).
 * [6] CARDINALIDAD determinística: las 4 reglas del contrato, sin prompt.
 * [7] NO REGRESIÓN: resolveEntity/guessDimension conservan su contrato histórico.
 * Cero red, cero LLM. `node _entity_index_gate.mjs`
 */
import {
  resolveCanonical, findCandidates, axisCollisions, resolveEntityRef, resolveCardinalidad,
  axisEntityNames, entityIndexStats, invalidateEntityIndex, AXES,
} from "./src/adi/oracle/entityIndex.js";
import { resolveEntity, guessDimension, guessDimensionDetallado } from "./src/adi/oracle/entityRecord.js";

let PASS = 0, FAIL = 0;
const ok = (c, m, extra = "") => { if (c) { PASS++; console.log("  ✓ " + m); } else { FAIL++; console.log("  ✗ " + m + (extra ? "\n      " + extra : "")); } };
const H = (t) => console.log("\n" + t);

H("[1] ÍNDICE por eje y tenant");
{
  const st = entityIndexStats();
  ok(st.total > 0, `el índice se construye y tiene entradas — ${st.total} nombres en ${st.ejes.length} ejes`);
  ok(st.ejes.includes("cliente") && st.ejes.includes("sku"), `cubre los ejes reales — ${JSON.stringify(st.porEje)}`);
  const gen1 = st.generation;
  invalidateEntityIndex();
  const gen2 = entityIndexStats().generation;
  ok(gen2 > gen1, `invalidar reconstruye el índice (generación ${gen1} → ${gen2}) — es lo que dispara onTenantChange`);
}

H("[2] CANONICALIZACIÓN O(1) · equivalente al scan histórico");
{
  ok(resolveCanonical("cliente", "falabella") === "Falabella", "case-insensitive: 'falabella' → 'Falabella'");
  ok(resolveCanonical("cliente", "  FALABELLA  ") === "Falabella", "trim + mayúsculas");
  ok(resolveCanonical("cliente", "Mercado Libre") === "Mercado Libre", "nombre con espacio resuelve exacto");
  ok(resolveCanonical("cliente", "NoExisteSA") === null, "inexistente → null (inequívoco, no el crudo)");
  ok(resolveCanonical("sku", "sam-tv55") === "SAM-TV55", "eje SKU también canonicaliza");
  // equivalencia con el histórico sobre TODO el catálogo real
  let iguales = 0, total = 0;
  for (const dim of ["cliente", "sku", "marca", "familia"]) {
    for (const n of axisEntityNames(dim)) {
      total++;
      if (resolveEntity(dim, n.toLowerCase()) === n) iguales++;
    }
  }
  ok(total > 0 && iguales === total, `resolveEntity resuelve el catálogo COMPLETO en minúsculas — ${iguales}/${total}`);
}

H("[3] FUZZY EN LA ENTRADA · el typo deja de morir en un decline pelado");
{
  const c = findCandidates("cliente", "Falabela");   // falta una 'l' — el caso exacto del contrato
  ok(c.length > 0 && c[0].nombre === "Falabella", `'Falabela' → propone 'Falabella' (motivo: ${c[0] && c[0].motivo})`, JSON.stringify(c));
  const c2 = findCandidates("cliente", "Falab");
  ok(c2.some((x) => x.nombre === "Falabella"), "prefijo corto 'Falab' → propone 'Falabella'", JSON.stringify(c2));
  const c3 = findCandidates("cliente", "Zzzzzqqqq");
  ok(c3.length === 0, "un nombre que no se parece a nada → sin candidatos (nunca inventa)");
  const c4 = findCandidates("cliente", "Falabella");
  ok(c4.length === 1 && c4[0].motivo === "exacto", "el nombre correcto se marca 'exacto', no 'tipeo'");
}

H("[4] COLISIONES entre ejes · dejan de resolverse en silencio");
{
  const cli = axisCollisions("Falabella");
  ok(cli.length === 1 && cli[0].dimension === "cliente", "un nombre de un solo eje → sin colisión");
  const det = guessDimensionDetallado("Falabella");
  ok(det.dimension === "cliente" && det.colision === false, "guessDimensionDetallado reporta colision:false cuando no la hay");
  // colisión SINTÉTICA: un nombre que exista en dos ejes a la vez no está en el dato demo, así que se verifica el
  // MECANISMO (que axisCollisions junte TODOS los ejes) usando un nombre real de cada eje.
  const todos = AXES.map((d) => ({ d, n: axisEntityNames(d)[0] })).filter((x) => x.n);
  ok(todos.length >= 3, `hay al menos 3 ejes con catálogo para poder detectar colisiones — ${todos.map((x) => x.d).join(",")}`);
  const porEje = todos.every((x) => axisCollisions(x.n).some((h) => h.dimension === x.d));
  ok(porEje, "cada nombre real es hallado en SU eje por axisCollisions (base de la detección de homónimos)");
}

H("[5] DESAMBIGUACIÓN · veredicto explícito, nunca un nombre a secas");
{
  const r1 = resolveEntityRef("Falabella");
  ok(r1.estado === "resuelto" && r1.dimension === "cliente" && r1.nombre === "Falabella", `existe → resuelto — ${JSON.stringify(r1)}`);
  const r2 = resolveEntityRef("Falabela");
  ok(r2.estado === "sugerencia" && r2.candidatos.some((c) => c.nombre === "Falabella"), `typo → sugerencia con candidatos — ${JSON.stringify(r2)}`);
  const r3 = resolveEntityRef("Zzzzzqqqq");
  ok(r3.estado === "desconocido", "no existe y nada se le parece → desconocido (decline honesto)");
  const r4 = resolveEntityRef("Falabela", { dimension: "cliente" });
  ok(r4.estado === "sugerencia" && r4.dimension === "cliente", "con eje declarado, la sugerencia se acota a ese eje");
  const r5 = resolveEntityRef("");
  ok(r5.estado === "desconocido", "vacío → desconocido, sin explotar");
}

H("[6] CARDINALIDAD determinística · las 4 reglas del contrato, sin prompt");
{
  const a = resolveCardinalidad({ entidades: ["Falabella"], metricas: [] });
  ok(a.forma === "perfil", "1 entidad SIN métrica → perfil");
  const b = resolveCardinalidad({ entidades: ["Falabella"], metricas: ["margen"] });
  ok(b.forma === "puntual", "1 entidad CON métrica → puntual");
  const c = resolveCardinalidad({ entidades: ["Falabella", "Lider"], metricas: [] });
  ok(c.forma === "comparacion", "2+ entidades → comparación");
  const d = resolveCardinalidad({ entidades: [], metricas: ["margen"], alcanceConversacional: ["Falabella"] });
  ok(d.forma === "puntual" && d.origenAlcance === "conversacional", "métrica sin entidad + alcance heredado → puntual sobre ese alcance");
  const e = resolveCardinalidad({ entidades: [], metricas: ["margen"] });
  ok(e.forma === "negocio" && e.origenAlcance === "negocio", "métrica sin entidad y sin alcance → el negocio");
  const f = resolveCardinalidad({ entidades: [], metricas: ["margen"], alcanceConversacional: ["Falabella", "Lider"] });
  ok(f.forma === "comparacion" && f.origenAlcance === "conversacional", "métrica + 2 heredadas → comparación");
  const g = resolveCardinalidad({});
  ok(g.forma === "negocio", "sin nada → el negocio (nunca explota)");
}

H("[7] NO REGRESIÓN · el contrato histórico de resolveEntity/guessDimension no cambia");
{
  ok(resolveEntity("cliente", "NoExisteSA") === "NoExisteSA", "sin match sigue devolviendo el CRUDO (el caller declina honesto)");
  ok(resolveEntity("cliente", null) === null, "null pasa igual");
  ok(guessDimension("Falabella") === "cliente", "guessDimension sigue resolviendo el eje correcto");
  ok(guessDimension("SAM-TV55") === "sku", "guessDimension resuelve SKU");
  ok(guessDimension("Zzzzzqqqq") === null, "guessDimension sigue devolviendo null para lo inexistente");
}

console.log(`\n── _entity_index_gate: ${PASS} PASS · ${FAIL} FAIL (de ${PASS + FAIL}) ──`);
process.exit(FAIL ? 1 : 0);
