/* === _lecturas_gate.mjs · DEL ENCARGO A LAS LECTURAS DEL CORE — ETAPA 1 · CORTE 3a (owner 2026-09-25, offline) ═
 * Corre `src/adi/encargo/lecturasDe.js:lecturasDe` sobre los casos VÁLIDOS de `fixtures/encargos-desarrollo.json`
 * (los mismos 44 que certifica `_encargo_gate.mjs`, corte 1) y sobre pares sintéticos para el CONTRASTE del
 * `_PRODUCTOR_RESIDUAL` de `src/adi/encargo/esquema.js` (deuda declarada del corte 1). Las seis secciones:
 *   1 · cobertura — cada parte resuelta/parcial de un caso VÁLIDO produce ≥ 1 lectura; cada tema resuelto del
 *       caso aparece en el plan combinado (por tool → tema, `_temaDeCall`, la misma clasificación que usa
 *       `lecturasDe.js` para su traza — no una segunda regla de negocio).
 *   2 · las partes `no_resuelta` NUNCA generan lecturas (`porParte[id] === []`).
 *   3 · determinismo — mismo encargo (mismo tenant, misma versión de datos) ⇒ mismo plan, BYTE A BYTE.
 *   4 · CARNADA — cambiar `preguntaOriginal` no cambia el plan (nadie la lee, igual que en `validar.js`).
 *   5 · el CONTRASTE (encargo, punto 2): para cada (concepto, eje) que `esquema.js` declara CON productor, el
 *       plan real corrido contra el tenant demo (bonanza) produce ≥ 1 fig — si no, ROJO con el par nombrado.
 *       Muestreo al revés: para cada (concepto, eje) declarado SIN productor, si el Core igual produce algo, se
 *       reporta como AVISO (no rojo — puede ser un artefacto del eje-insensible de una tool sin `dimension`, ver
 *       la nota de la sección).
 *   6 · CERO red — `clasificarFuente` (scripts/clasificarGates.mjs) sobre la fuente de ESTE gate no encuentra
 *       ningún marcador de red; y el propio proceso corre bajo `--import ./scripts/offline-guard.mjs`, que mata
 *       el proceso si algo intentara salir (la garantía es el candado de runtime, esto es la doble verificación
 *       ESTÁTICA que pide el encargo).
 *
 * @inspeccion-estatica — este comentario declara el marcador que el propio texto de este archivo nombra en sus
 * docstrings (fetch/handlePlan/etc., citados como EJEMPLO de qué es un marcador — nunca se importan ni se
 * invocan). Ver `clasificarFuente` §5: (a) declara, (b) no importa el gateway, (c) no invoca nada de eso.
 *
 * CERO llamadas a un LLM · CERO red. Solo por `npm run gates:offline` o
 * `node --import ./scripts/offline-guard.mjs _lecturas_gate.mjs`. */
import fs from "node:fs";
import { initTenant } from "./src/data/tenantStore.js";
import { TENANT_DEMO } from "./src/data/tenants/demo.js";
import { validarEncargo } from "./src/adi/encargo/validar.js";
import { lecturasDe, REGISTRO_LECTURAS } from "./src/adi/encargo/lecturasDe.js";
import { runPlan } from "./src/adi/oracle/toolRunner.js";
import { EJES, ejesConProductor } from "./src/adi/encargo/esquema.js";
import { CLAVES_DE_METRICA } from "./src/adi/notario/lexico.js";
import { clasificarFuente } from "./scripts/clasificarGates.mjs";

let pass = 0, fail = 0;
const fails = [];
const ok = (c, m, extra = "") => { if (c) { pass++; } else { fail++; fails.push(m + (extra ? " — " + extra : "")); console.log("  ✗ " + m + (extra ? "\n      " + extra : "")); } };
const H = (t) => console.log(`\n${t}`);

initTenant(TENANT_DEMO);

/* la clasificación tool→tema es la MISMA que usa `lecturasDe.js` internamente para `porParte` — se copia acá
 * SOLO porque `_temaDeCall` no está exportada (es privada del módulo a propósito: es una ayuda de traza, no una
 * API pública); si `lecturasDe.js` la exportara, este gate la importaría en vez de reproducirla — se deja escrito
 * para que quien lo lea sepa que la duplicación es deliberada y acotada a esta única función chica. */
const _TOOLS_COBRANZA = new Set(["cobranza"]);
const _TOOLS_INVENTARIO = new Set(["inventoryStatus", "tensionRead"]);
const _TOOLS_COMERCIAL = new Set(["salesRead", "marginRead", "contributionRead", "diagnose", "rolesCartera", "trend"]);
const _METRICAS_INVENTARIO = new Set(["capital", "doh", "stock", "rotacion"]);
function _temaDeCall(call) {
  const tool = call && call.tool;
  if (_TOOLS_COBRANZA.has(tool)) return "cobranza";
  if (_TOOLS_INVENTARIO.has(tool)) return "inventario";
  if (_TOOLS_COMERCIAL.has(tool)) return "comercial";
  if (tool === "queryMetric") return _METRICAS_INVENTARIO.has(call.args && call.args.metric) ? "inventario" : "comercial";
  return null;
}

/* ═══ 1 y 2 · cobertura + partes no_resuelta ═══════════════════════════════════════════════════════════════════ */
H("1-2 · fixtures/encargos-desarrollo.json — cobertura del plan y partes no_resuelta sin lecturas");
const catalogo = JSON.parse(fs.readFileSync(new URL("./fixtures/encargos-desarrollo.json", import.meta.url)));
ok(Array.isArray(catalogo.casos) && catalogo.casos.length === catalogo._meta.conteos.total, `el catálogo trae ${catalogo.casos.length} casos (declarados: ${catalogo._meta.conteos.total})`);

/* `_meta.conteos.validos` (32) cuenta los casos SIN el título «DEFECTUOSO» — una partición por TÍTULO, no por
 * `esperado.valido`: D33/D34/D41/D43 están titulados DEFECTUOSO pero su `esperado.valido` es `true` (quedan
 * `parcial`/`resuelta` en alguna parte). Este gate necesita el corte por RESOLUCIÓN (todo caso donde `validarEncargo`
 * deja algo que leer), así que filtra por `esperado.valido === true` — un criterio distinto a propósito, no un
 * intento de reproducir el conteo del `_meta` (que ya audita `_encargo_gate.mjs` con su propio criterio, por título). */
const validos = catalogo.casos.filter((c) => c.esperado.valido === true);
console.log(`  · casos con esperado.valido === true (el corte de ESTE gate): ${validos.length} de ${catalogo.casos.length}`);

for (const caso of validos) {
  const R = validarEncargo(caso.encargo, {});
  const { plan, porParte } = lecturasDe(R);
  const decir = (c, msg, extra = "") => ok(c, `[${caso.id}] ${caso.titulo} · ${msg}`, extra);

  const temasDelPlan = new Set(plan.calls.map((c) => _temaDeCall(c)).filter(Boolean));
  for (const p of R.partes) {
    if (p.estado === "no_resuelta") {
      decir((porParte[p.id] || []).length === 0, `parte no_resuelta ${p.id} sin lecturas`, JSON.stringify(porParte[p.id]));
      continue;
    }
    // resuelta o parcial: la parte tiene AL MENOS una lectura propia, o (lectura/decision) su tema aparece en el plan combinado.
    const propias = (porParte[p.id] || []).length > 0;
    const temaCubierto = temasDelPlan.has(p.tema);
    decir(propias || temaCubierto, `parte ${p.estado} ${p.id} (${p.tema}/${p.cierre}) cubierta por el plan`, JSON.stringify({ propias: porParte[p.id], temasDelPlan: [...temasDelPlan] }));
  }
  // cada tema RESUELTO del caso (§ el encargo del corte: «el plan cubre cada parte y cada tema resuelto») aparece
  // en el plan combinado — el mismo criterio que `temaCubierto` de `_encargo_gate.mjs`, aplicado a lecturas.
  const temasResueltos = [...new Set(R.partes.filter((p) => p.estado !== "no_resuelta").map((p) => p.tema))];
  for (const tema of temasResueltos) {
    if (tema === "comercial" || tema === "inventario" || tema === "cobranza") {
      decir(temasDelPlan.has(tema) || R.partes.some((p) => p.tema === tema && (p.cierre === "definicion" || p.cierre === "comparacion" || p.cierre === "simulacion" || p.cierre === "cifra") && (porParte[p.id] || []).length), `tema resuelto «${tema}» tiene al menos una lectura en el plan`);
    }
  }
  // el plan nunca queda vacío si HAY alguna parte resuelta/parcial (una Resolucion válida siempre tiene algo que leer)
  if (R.partes.some((p) => p.estado !== "no_resuelta")) decir(plan.calls.length > 0, `el plan no queda vacío habiendo partes resueltas/parciales`);
}

/* ═══ 3 · determinismo — mismo encargo ⇒ mismo plan, byte a byte ═══════════════════════════════════════════════ */
H("3 · determinismo — mismo encargo (mismo tenant/datos) produce el MISMO plan, byte a byte");
for (const caso of validos) {
  const R1 = validarEncargo(caso.encargo, {});
  const R2 = validarEncargo(caso.encargo, {});
  const p1 = lecturasDe(R1), p2 = lecturasDe(R2);
  ok(JSON.stringify(p1.plan) === JSON.stringify(p2.plan), `[${caso.id}] dos corridas de lecturasDe(validarEncargo(mismo encargo)) ⇒ el mismo plan`);
}

/* ═══ 4 · CARNADA — preguntaOriginal viaja solo para auditoría, lecturasDe nunca la lee ═════════════════════════ */
H("4 · CARNADA — cambiar preguntaOriginal no cambia el plan de lecturas");
{
  const base = catalogo.casos.find((c) => c.id === "D11");   // el caso multitema: el que más tiene para perder si algo lee texto
  const R1 = validarEncargo(base.encargo, {});
  const plan1 = lecturasDe(R1).plan;
  const encargoMutado = { ...base.encargo, preguntaOriginal: "¿cuántos planetas tiene el sistema solar? — texto que no debería cambiar nada" };
  const R2 = validarEncargo(encargoMutado, {});
  const plan2 = lecturasDe(R2).plan;
  ok(JSON.stringify(plan1) === JSON.stringify(plan2), "★ CARNADA · cambiar preguntaOriginal (con un encargo por lo demás idéntico) no cambia el plan, byte a byte");

  // segunda vuelta de la misma carnada, con el ejemplo del contrato §6.1 (decisión con criterio y premisas)
  const D17 = catalogo.casos.find((c) => c.id === "D17");
  const RA = validarEncargo(D17.encargo, {});
  const planA = lecturasDe(RA).plan;
  const RB = validarEncargo({ ...D17.encargo, preguntaOriginal: null }, {});
  const planB = lecturasDe(RB).plan;
  ok(JSON.stringify(planA) === JSON.stringify(planB), "★ CARNADA · preguntaOriginal null vs. la del fixture — mismo plan");
}

/* ═══ 5 · EL CONTRASTE (encargo, punto 2) — la tabla escrita a mano contra lo que el Core produce de verdad ═════
 * Para cada (concepto, eje) con productor declarado en `esquema.js`, se arma una `Resolucion` SINTÉTICA (una
 * parte `cifra` resuelta a mano, sin pasar por `validarEncargo` — ES EL PROPÓSITO: contrastar la tabla, no
 * volver a validarla contra sí misma) y se corre `lecturasDe` + `runPlan` contra el tenant demo (escenario
 * `bonanza`, el canónico). Se cuentan figs totales de la boleta combinada.
 *
 * TRES FAMILIAS QUEDAN FUERA DEL MUESTREO AL REVÉS (documentado, no un olvido): `diagnose`, `cobranza`,
 * `inventoryStatus{focus:"frenado"}` y —desde el corte 3d, revisión de calidad del supervisor 2026-09-25—
 * `rolesCartera` (productor de `markup`) no reciben `dimension` en su llamada (`_callsDeConceptoEje`,
 * lecturasDe.js) — su ruteo es el MISMO sea cual sea el eje que se les pida, así que "producir algo" al pedirles
 * un eje no declarado no es evidencia de que ESE eje tenga productor: es que la tool ignora el parámetro.
 * Probarlas cruzado daría avisos sin significado (ya verificado a mano: `diagnose` con eje "sku" sigue
 * devolviendo SU ranking de clientes de siempre; `rolesCartera` con eje "sku"/"marca"/"familia"/"bodega"/"canal"
 * devuelve las MISMAS 41 figs de markup por cliente de siempre — medido al agregar `markup` a la tabla). Se
 * prueban SOLO en su eje declarado (el forward check ya las cubre). */
H("5 · el contraste del productor residual (esquema.js:_PRODUCTOR_RESIDUAL) contra el Core (demo · bonanza)");
const FAMILIAS_EJE_INSENSIBLE = new Set([
  "no_capturada", "carga_alta", "brecha", "brecha_precio_costo", "markup",
  "capital_frenado", "capital_inmovilizado", "dias_sin_venta", "margen_inventario",
  "venta_credito", "saldo_vencido", "saldo_pendiente", "saldo_por_vencer", "abonado", "recuperado", "dias_vencido",
]);
function _resolucionSintetica(dominio, clave, eje) {
  return {
    ok: true,
    encargo: { version: "encargo/v1", partes: [{ id: "p1", tema: dominio, cierre: "cifra", conceptos: [clave], eje }] },
    partes: [{ id: "p1", tema: dominio, cierre: "cifra", estado: "resuelta", conceptos: [clave], entidades: [], eje, universo: null, periodo: { tipo: "vigente" }, ausencias: [] }],
    criterio: null, supuestos: [], premisas: [], noResuelto: [], avisos: [],
  };
}
function _figsDe(dominio, clave, eje) {
  const { plan } = lecturasDe(_resolucionSintetica(dominio, clave, eje));
  const run = runPlan(plan, { registry: REGISTRO_LECTURAS, scenario: "bonanza" });
  return run.results.reduce((a, r) => a + (r.boleta || []).length, 0);
}
let paresConProductor = 0, avisosReverse = 0;
const avisosDetalle = [];
for (const m of CLAVES_DE_METRICA) {
  const clave = m.clave;
  if (clave === "participacion" || m.dominio == null) continue;   // derivada transversal, sin tema propio — fuera de este contraste (nota en lecturasDe.js)
  const declarados = ejesConProductor(clave);
  // CORRECCIÓN DEL SUPERVISOR (corte 3d, 2026-09-25, «que no se repita») — ANTES, una clave con CERO ejes
  // declarados (`[]` — sea una referencia genuina como `benchmark`, o un olvido como `markup` lo fue) se SALTABA
  // ENTERA, sin pasar ni por el forward check (nada que forward-chequear, correcto) NI por el muestreo al
  // revés — así que si el Core SÍ producía algo para una clave declarada `[]` por error, este gate nunca lo
  // veía. Ahora el reverso corre SIEMPRE (para toda clave con dominio, tenga o no ejes declarados) — es
  // exactamente el candado que habría atrapado el hueco de `markup`/`peso_costo` antes de que llegara a la
  // Entrega servida. `paresConProductor` sigue contando SOLO el forward (declarados.length puede ser 0).
  for (const eje of declarados) {
    paresConProductor++;
    const n = _figsDe(m.dominio, clave, eje);
    ok(n > 0, `productor declarado (${clave}, ${eje}) produce figs en el Core`, `dominio=${m.dominio} · figs=${n}`);
  }
  if (FAMILIAS_EJE_INSENSIBLE.has(clave)) continue;
  for (const eje of EJES) {
    if (declarados.includes(eje)) continue;
    const n = _figsDe(m.dominio, clave, eje);
    if (n > 0) { avisosReverse++; avisosDetalle.push(`(${clave}, ${eje}) → ${n} figs`); }
  }
}
console.log(`  · pares CON productor contrastados: ${paresConProductor}`);
console.log(`  · avisos del muestreo al revés (SIN productor declarado, pero el Core produjo algo): ${avisosReverse}`);
if (avisosDetalle.length) console.log(`    ${avisosDetalle.join(" · ")}`);
/* Los dos avisos esperados hoy (revisados, NO son una corrección pendiente — documentado en el reporte del
 * corte): (vs_presupuesto, sku) y (vs_presupuesto_usd, sku) — `salesRead{focus:"vs_presupuesto",dimension:"sku"}`
 * degrada honesto a SOLO los totales del negocio («Venta total»/«Presupuesto total», sin fila por SKU: el propio
 * composer lo declara en su texto — «Por SKU no tengo presupuesto propio»), y esos DOS totales no son
 * subject-attributed: `_ejeNoAbierto` no los puede juzgar (`_filasDelEje` no reconoce ningún sujeto), así que se
 * cuelan como "figs>0" aunque no haya una fila por SKU. Es un artefacto del total-siempre-presente, no un
 * productor real: la tabla queda como está (sku fuera de `vs_presupuesto`/`vs_presupuesto_usd`). */
ok(avisosReverse <= 2, `el muestreo al revés no trae correcciones nuevas sin revisar (esperados ≤ 2, los dos totales de vs_presupuesto/sku ya evaluados y aceptados)`, avisosDetalle.join(" · "));

/* ═══ 6 · CARNADA — `direccion:"peor"/"mejor"` de `universo.top` se traduce con la POLARIDAD REAL de la métrica
 * (supervisor 2026-09-26, segunda vuelta, R-DIRECCION-PEOR-MEJOR) — antes, cualquier valor distinto de "menor"
 * (incluidos "peor"/"mejor", los dos del contrato §2 que este gate no cazaba) caía a `desc` como si fuera
 * "mayor", sin mirar si MENOS es mejor para esa métrica. `_direccionDeTop` (lecturasDe.js) ahora usa
 * `polaridadDeClave` (notario/lexico.js, la MISMA fuente que ya usa el Notario para lo mismo,
 * `notario/verificar.js:_topTipado`) — dos polaridades reales del catálogo: `margen` (mayor=mejor, dominio
 * comercial) y `carga` (menor=mejor, dominio comercial — cobranza no sirve para este caso: `p.tema==="cobranza"`
 * devuelve por `mesaFlujo` antes de llegar a la rama `universo.top`, nunca por `queryMetric`). ═══════════════════ */
H("6 · direccion peor/mejor — se traduce con la polaridad real de la métrica, en las dos polaridades");
function _resolucionConTop(dominio, clave, eje, direccion) {
  const universo = { eje, top: { metrica: clave, k: 3, direccion } };
  return {
    ok: true,
    encargo: { version: "encargo/v1", partes: [{ id: "p1", tema: dominio, cierre: "cifra", conceptos: [], eje, universo }] },
    partes: [{ id: "p1", tema: dominio, cierre: "cifra", estado: "resuelta", conceptos: [], entidades: [], eje, universo, periodo: { tipo: "vigente" }, ausencias: [] }],
    criterio: null, supuestos: [], premisas: [], noResuelto: [], avisos: [],
  };
}
function _sortDirDeTop(dominio, clave, eje, direccion) {
  const { plan } = lecturasDe(_resolucionConTop(dominio, clave, eje, direccion));
  const call = plan.calls.find((c) => c.tool === "queryMetric" && c.args && c.args.sort);
  return call && call.args.sort && call.args.sort.dir;
}
ok(_sortDirDeTop("comercial", "margen", "cliente", "peor") === "asc", "margen (polaridad mayor): «peor» = menor margen → sort asc", _sortDirDeTop("comercial", "margen", "cliente", "peor"));
ok(_sortDirDeTop("comercial", "margen", "cliente", "mejor") === "desc", "margen (polaridad mayor): «mejor» = mayor margen → sort desc", _sortDirDeTop("comercial", "margen", "cliente", "mejor"));
ok(_sortDirDeTop("comercial", "carga", "cliente", "peor") === "desc", "carga (polaridad menor): «peor» = mayor carga → sort desc", _sortDirDeTop("comercial", "carga", "cliente", "peor"));
ok(_sortDirDeTop("comercial", "carga", "cliente", "mejor") === "asc", "carga (polaridad menor): «mejor» = menor carga → sort asc", _sortDirDeTop("comercial", "carga", "cliente", "mejor"));
// control: "menor"/"mayor" literales no cambian — sin regresión de R-SORT-DIRECCION-IGNORADA (primera vuelta)
ok(_sortDirDeTop("comercial", "margen", "cliente", "menor") === "asc", "control: direccion=«menor» sigue siendo asc");
ok(_sortDirDeTop("comercial", "margen", "cliente", "mayor") === "desc", "control: direccion=«mayor» sigue siendo desc");

/* ═══ 7 · CERO red — inspección estática de la fuente de ESTE gate ══════════════════════════════════════════════ */
H("7 · CERO red — clasificarFuente(este gate) === offline");
{
  const propioSrc = fs.readFileSync(new URL(import.meta.url), "utf8");
  const c = clasificarFuente(propioSrc);
  ok(c.tipo === "offline", "clasificarFuente(_lecturas_gate.mjs) === offline", JSON.stringify(c));
}

console.log(`\n── _lecturas_gate: PASS ${pass} · FAIL ${fail} (de ${pass + fail}) ──`);
if (fail) { console.log("\nFALLOS:"); for (const f of fails) console.log("  ✗ " + f); }
process.exit(fail ? 1 : 0);
