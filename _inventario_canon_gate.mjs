/* === _inventario_canon_gate.mjs · EL CANON VIGENTE DE INVENTARIO, JUZGADO POR EL NOTARIO (owner 2026-09-29,
 * cierre de las etapas 4-5 del rediseño) ═══════════════════════════════════════════════════════════════════════
 *
 * §7.3·34b/34d (contrato) exige pruebas NUEVAS para la definición VIGENTE de inmovilizado / inmovilizado crítico /
 * frenado — los corpus viejos de «frenado» (significado de rotación) quedan CONGELADOS aparte, como registro
 * histórico (`_ronda5_gate`, «hLG» en `fixtures/anclas-2026-09-17.json`, §7.3·34b). Este gate NO mide
 * `jerarquiaInventario()` en aislamiento — eso ya lo hace `_jerarquia_inventario_gate` (sin Notario, oráculo
 * independiente). Mide que el NOTARIO — el juez que de verdad recibe una afirmación y la contrasta contra la
 * evidencia del turno (`libroDeHechos`, `conjuntoDeUniverso`) — aprueba lo correcto y rechaza lo incorrecto sobre
 * el canon vigente, con evidencia REAL del tenant demo: el mismo `indice` que arma `_anclas_gate` (figs reales de
 * una pregunta real, corridas por el motor, + `indiceDeEvidencia`), nunca un objeto inventado a mano.
 *
 * BLOQUE (a) · EL CANON VIGENTE — hechos tipo "estado" (inmovilizado / inmovilizado crítico / «crítico» = la
 * alerta del archivo / frenado con umbral de la EMPRESA / frenado SIN umbral) y `conjuntoDeUniverso` directo (la
 * MISMA primitiva que usa el Notario para resolver un universo — `notario/verificar.js:_conteo` la llama con el
 * mismo nombre) para la intersección frenado ∩ inmovilizado.
 *
 * ⚠️ BUG REAL cazado al escribir «frenado con umbral de la EMPRESA» (cerrado acá, `notario/estados.js`, no una
 * consecuencia de la redefinición): `estados.js:verificar("frenado")` leía la KPI «Umbral de venta frenada» con
 * `_kpi(I, /^Umbral de venta frenada$/)` — un patrón con mayúscula inicial contra `conceptoNorm`, que SIEMPRE es
 * minúscula normalizada (mismo criterio que el resto de `_kpi(...)` en ese archivo: `/^piso de rotacion$/`, etc.).
 * El patrón NUNCA calzaba: «frenado» salía "no-verificable" SIEMPRE, incluso con la empresa declarando el umbral
 * en su perfil — el dato y el mecanismo de publicación (`datoProyectado.js`) estaban bien, el regex tenía el
 * `case` equivocado. Verificado que ningún gate de los 300 de `gates:offline` dependía del bug (ninguno, aparte
 * de `_jerarquia_inventario_gate` que llama `jerarquiaInventario()` directo, sin pasar por esta función, declara
 * `frenadoDiasSinVenta` en un perfil). Sección «frenado con umbral de la EMPRESA», abajo, es la carnada/prueba.
 *
 * ⚠️ `frenado con umbral de la CONSULTA` (`criterio.referencia.umbral_frenado`) — REPORTADO, NO PROBADO AQUÍ.
 * El diseño está documentado (`notario/estados.js:51`: «el umbral declarado, empresa O planteado en la consulta»;
 * `notario/conjuntosDeLaCasa.js:130`: `referenciaDeEstado("frenado") → {concepto:"umbral_frenado", ...}`) pero NO
 * está cableado: `entrega/componer.js:_REFERENCIA_FAMILIAS` (la tabla que ya declara «con la referencia planteada
 * en la consulta, serían N» para benchmark/nivel_carga/piso_rotacion, §7.3·12/·19) no tiene entrada `umbral_frenado`,
 * y `estados.js:verificar("frenado")` solo lee `I.figs` (la KPI «Umbral de venta frenada», publicada SOLO cuando
 * la EMPRESA lo declaró) — nunca `resolucion.criterio.referencia`. Repro con evidencia (offline, guardado en el
 * scratchpad de la sesión que cerró esta etapa): con `criterio.referencia:{concepto:"umbral_frenado", valor:90,
 * unidad:"days"}` y una parte `universo.estados:["frenado"]`, `componerEntrega` devuelve `ok:false` («ninguna
 * parte produjo una oración con evidencia») — la referencia de la consulta NUNCA llega a evaluarse, ni siquiera
 * declarada aparte de la oficial. Implementar ese cableado es un mecanismo nuevo (toca `_REFERENCIA_FAMILIAS` y
 * probablemente `notario/estados.js`/`notario/verificar.js`), no una prueba — se PARA y se reporta al supervisor
 * en vez de escribir una aserción que no puede pasar hoy, o de tocar el Notario sin autorización para ese cambio.
 *
 * BLOQUE (b) · LA GARANTÍA «HISTÓRICO, NO PRONÓSTICO» (§7.3·34d) — TAMBIÉN REPORTADO, NO IMPLEMENTADO.
 * El mecanismo que el contrato señala (`MODALIDAD_SRC`/el veto `modalidad-en-ancla` en `notario/anclas.js`, los
 * tipos de hecho `lectura`/`propuesta`) NO distingue pasado de futuro por el TIPO de afirmación, medido con
 * evidencia real contra el demo (repro offline, mismo scratchpad de esta etapa):
 *   (1) una predicción futura escrita como prosa LIBRE junto a un hecho correctamente anclado — el patrón
 *       realista, p. ej. «{{h1: MAK-COMP-AIR lleva {h1} días sin venta}}. Debería volver a venderse pronto.» —
 *       sale VERDE siempre: el Notario no vigila la prosa FUERA de un ancla (diseño a propósito, «prosa infinita,
 *       verdad finita», CLAUDE.md), así que una afirmación sin ancla propia no tiene ningún juez;
 *   (2) forzada DENTRO de un ancla, la predicción casi siempre se rechaza, pero por vetos AJENOS al tiempo verbal
 *       (`metrica-ajena`, `dominio-cruzado`, `sin-dueno` — la palabra «venta»/«vender» dispara un cruce de dominio
 *       contra un hecho de inventario) — y esos MISMOS vetos rechazan PAREJO una prosa histórica legítima
 *       («MAK-COMP-AIR acumula 112 días sin movimiento de venta» también sale rechazada, por «dominio-cruzado»/
 *       «metrica-ajena»): no hay discriminación real entre pasado y futuro, solo una hostilidad genérica a la
 *       palabra «venta» que castiga por igual lo verdadero y lo falso;
 *   (3) el único caso que SÍ dispara el veto pensado para esto (`modalidad-en-ancla`) fue «…debería vender» — un
 *       verbo condicional que `MODALIDAD_SRC` sí reconoce; «volverá», «recuperará», «está por», «ya le toca», «no
 *       tardará en» NO están en ese patrón (una lista de conjugaciones, no una regla semántica).
 * Construir un detector de verbos en futuro NUEVO sería exactamente la «lista de palabras prohibidas» que la
 * regla dura de esta tarea prohíbe extender — y el estándar del contrato (§7.3·34d) es explícito: SEMÁNTICO, no
 * léxico. Cerrar esto de raíz exige una decisión de diseño (por ejemplo: ¿toda prosa que toque un hecho de
 * `dias_sin_venta`/`frenado` debe vivir DENTRO de un ancla, sin excepción, para que `modalidad-en-ancla` tenga
 * jurisdicción? ¿el veto necesita separarse de los vetos de dominio para no castigar la prosa verdadera?) que le
 * toca al supervisor, no a este gate. Se PARA acá, con la evidencia de arriba.
 *
 * Solo por `npm run gates:offline` (o con el candado: node --import ./scripts/offline-guard.mjs
 * _inventario_canon_gate.mjs). Cero red. */
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
import { libroDeHechos, asignarIds } from "./src/adi/notario/hechos.js";
import { conjuntoDeUniverso } from "./src/adi/notario/verificar.js";
import { clasificarFuente } from "./scripts/clasificarGates.mjs";
import fs from "node:fs";

let pass = 0, fail = 0;
const fails = [];
const ok = (c, m, extra = "") => { if (c) { pass++; console.log("  ✓ " + m); } else { fail++; fails.push(m); console.log("  ✗ " + m + (extra ? "\n      " + extra : "")); } };
const H = (t) => console.log(`\n${t}`);

initTenant(TENANT_DEMO);
const ejes = {};
for (const e of ["cliente", "sku", "marca", "familia", "bodega", "canal"]) { try { const n = axisEntityNames(e); if (n && n.length) ejes[e] = n; } catch { /* sin índice */ } }
const CAJA = cajaDelAgente(TOOLS);
/* el MISMO mecanismo que ya usa `_anclas_gate.mjs`: figs reales, producidas por el motor de verdad para una
 * pregunta real del demo — nunca una fig inventada a mano. */
const figsDe = (pregunta) => {
  const pb = playbookPara(pregunta, {});
  const dom = (() => { try { return dominiosDe(pregunta); } catch { return { dominios: [], eje: null }; } })();
  const pasos = unirPasosDeDominios(pasosDelEncargo(partesDelEncargo(pregunta), pb ? pasosDe(pb, pregunta, {}) : [], {}), (() => { try { return pasosDeDominios(dom); } catch { return []; } })());
  const rp = runPlan({ intent: "answer", calls: pasos.map((p) => ({ tool: p.tool, args: p.args || {} })) }, { scenario: ESCENARIO_INICIAL, maxCalls: 18, preguntaUsuario: pregunta, registry: CAJA });
  return asignarIds((rp.ledger && rp.ledger.figs) || rp.ledger || []);
};
const PREGUNTA = "¿Cuánto capital inmovilizado hay y cuáles SKU tienen la venta frenada?";
const indiceDe = () => indiceDeEvidencia({ figs: figsDe(PREGUNTA), datoProyectado: cifrasDelDato(ESCENARIO_INICIAL), ejesDelTenant: ejes });
/* «con umbral de la EMPRESA»: se declara en el PERFIL del tenant (byte a byte el mismo mecanismo que ya certifica
 * `_jerarquia_inventario_gate.mjs` para la planilla — `perfil.frenadoDiasSinVenta`), nunca `setCriterioOverride`
 * (el override CONVERSACIONAL, C.2): `datoProyectado.js:_cacheado` memoiza por `tenantId::escenario::benchmark` —
 * la clave NO incluye `frenadoDiasSinVenta`, así que un override posterior a la primera lectura no le llega sin
 * volver a llamar `initTenant`; y `initTenant` dispara `businessPolicy.js:_resolvePolicy`, que LIMPIA todo
 * `_criterioOverride` en cada cambio de tenant (línea 136 de ese archivo) — el propio candado contra que un
 * criterio de OTRA empresa sobreviva un cambio de tenant borra, de paso, el override que este gate acababa de
 * fijar. Declarar el umbral en el PERFIL de un tenant derivado (inicializado UNA vez) evita las dos trampas. */
const TENANT_DEMO_FRENADO_60 = { ...TENANT_DEMO, perfil: { ...TENANT_DEMO.perfil, frenadoDiasSinVenta: 60 } };
const indiceConUmbralEmpresa60 = () => { initTenant(TENANT_DEMO_FRENADO_60); return indiceDeEvidencia({ figs: figsDe(PREGUNTA), datoProyectado: cifrasDelDato(ESCENARIO_INICIAL), ejesDelTenant: ejes }); };
const volverAlDemo = () => initTenant(TENANT_DEMO);

/* helper: declara UN hecho "estado" y lee su veredicto del libro */
const veredictoEstado = (I, sujeto, estado) => {
  const libro = libroDeHechos([{ id: "h1", tipo: "estado", sujeto, estado }], { indice: I });
  return libro.hechos[0];
};

/* ── BLOQUE (a) · EL CANON VIGENTE, verificado con la evidencia real del demo (sin umbral de frenado declarado) ── */
H("(a) · inmovilizado (4 SKU: LG-DRYER8KG, BOS-SANDER, PHI-IRON-PRO, MAK-COMP-AIR) — verdadero y falso");
{
  const I = indiceDe();
  const v1 = veredictoEstado(I, "LG-DRYER8KG", "inmovilizado");
  ok(v1.veredicto === "verdadera", "LG-DRYER8KG (miembro real) → verdadera", JSON.stringify(v1));
  const v2 = veredictoEstado(I, "PHI-IRON-PRO", "inmovilizado");
  ok(v2.veredicto === "verdadera", "PHI-IRON-PRO (sobrestock, también inmovilizado) → verdadera", JSON.stringify(v2));
  const v3 = veredictoEstado(I, "SAM-REF500L", "inmovilizado");
  ok(v3.veredicto === "falsa", "SAM-REF500L (riesgo de quiebre, NO inmovilizado) → falsa", JSON.stringify(v3));
  const v4 = veredictoEstado(I, "SAM-TV55", "inmovilizado");
  ok(v4.veredicto === "falsa", "SAM-TV55 (capital sano, NO inmovilizado) → falsa", JSON.stringify(v4));
}

H("(a) · inmovilizado crítico (3 SKU: LG-DRYER8KG, BOS-SANDER, MAK-COMP-AIR) — verdadero y falso");
{
  const I = indiceDe();
  const v1 = veredictoEstado(I, "LG-DRYER8KG", "inmovilizado critico");
  ok(v1.veredicto === "verdadera", "LG-DRYER8KG (miembro real de inmovilizado crítico) → verdadera", JSON.stringify(v1));
  const v2 = veredictoEstado(I, "BOS-SANDER", "inmovilizado critico");
  ok(v2.veredicto === "verdadera", "BOS-SANDER (miembro real de inmovilizado crítico) → verdadera", JSON.stringify(v2));
  const v3 = veredictoEstado(I, "PHI-IRON-PRO", "inmovilizado critico");
  ok(v3.veredicto === "falsa", "PHI-IRON-PRO (inmovilizado, pero SOLO sobrestock — no crítico) → falsa", JSON.stringify(v3));
  const v4 = veredictoEstado(I, "SAM-TV55", "inmovilizado critico");
  ok(v4.veredicto === "falsa", "SAM-TV55 (capital sano — no crítico) → falsa", JSON.stringify(v4));
}

H("(a) · «crítico» = la alerta del archivo (distinta de «inmovilizado crítico», §7.3·34a) — verdadero y falso");
{
  const I = indiceDe();
  // LG-DRYER8KG y MAK-COMP-AIR traen alerta:"crit" en el archivo del demo (verificado contra TENANT_DEMO.skuInventario).
  const v1 = veredictoEstado(I, "MAK-COMP-AIR", "critico");
  ok(v1.veredicto === "verdadera", "MAK-COMP-AIR (alerta:\"crit\" del archivo) → verdadera", JSON.stringify(v1));
  // BOS-SANDER es inmovilizado crítico (capital_frenado) pero su alerta de archivo es "warn", no "crit": los dos
  // canones («inmovilizado critico» vs. «critico» a secas) son conjuntos DISTINTOS, exactamente la ley §7.3·34a.
  const v2 = veredictoEstado(I, "BOS-SANDER", "critico");
  ok(v2.veredicto === "falsa", "BOS-SANDER (inmovilizado crítico POR ROTACIÓN, pero alerta:\"warn\" del archivo) → falsa — los dos canones no son el mismo conjunto", JSON.stringify(v2));
}

H("(a) · frenado con umbral de la EMPRESA (frenadoDiasSinVenta:60 declarado en el perfil) — verdadero y falso");
{
  const I = indiceConUmbralEmpresa60();
  const v1 = veredictoEstado(I, "LG-DRYER8KG", "frenado");
  ok(v1.veredicto === "verdadera", "LG-DRYER8KG (94 días sin venta ≥ 60 declarados por la empresa) → verdadera", JSON.stringify(v1));
  const v2 = veredictoEstado(I, "PHI-IRON-PRO", "frenado");
  ok(v2.veredicto === "falsa", "PHI-IRON-PRO (35 días sin venta < 60 declarados por la empresa) → falsa", JSON.stringify(v2));
  volverAlDemo();
}

H("(a) · frenado SIN umbral declarado — SIEMPRE no-verificable (nunca verdadera ni falsa, §7.3·32a)");
{
  const I = indiceDe();   // el demo, sin override: nadie declaró frenadoDiasSinVenta
  const v1 = veredictoEstado(I, "LG-DRYER8KG", "frenado");
  ok(v1.veredicto === "no-verificable", "LG-DRYER8KG (94 días, sin umbral) → no-verificable, nunca \"verdadera\"", JSON.stringify(v1));
  const v2 = veredictoEstado(I, "SAM-TV55", "frenado");
  ok(v2.veredicto === "no-verificable", "SAM-TV55 (12 días, sin umbral) → no-verificable, nunca \"falsa\" (un umbral inventado sería una verdad ADI, prohibida)", JSON.stringify(v2));
}

H("(a) · la intersección frenado ∩ inmovilizado — medida con conjuntoDeUniverso (la MISMA primitiva del Notario), nunca asumida");
{
  const I = indiceConUmbralEmpresa60();
  // frenado(60) = {LG-DRYER8KG, BOS-SANDER, MAK-COMP-AIR} (3) · inmovilizado = {esos 3} ∪ {PHI-IRON-PRO} (4) →
  // la intersección son los mismos 3 (verificado contra jerarquiaInventario en _jerarquia_inventario_gate).
  const R = conjuntoDeUniverso({ eje: "sku", estados: ["frenado", "inmovilizado"] }, I, "sku", "");
  ok(!!(R && R.set), "la intersección resuelve (conjuntoDeUniverso trae .set, no un {error})", JSON.stringify(R && R.error));
  if (R && R.set) {
    const esperado = ["bos-sander", "lg-dryer8kg", "mak-comp-air"];
    ok(R.set.size === 3, `la intersección son 3 SKU (obtenido: ${R.set.size})`, [...R.set].join(", "));
    ok(JSON.stringify([...R.set].sort()) === JSON.stringify(esperado), "la intersección es EXACTAMENTE {LG-DRYER8KG, BOS-SANDER, MAK-COMP-AIR} — no un cálculo distinto", [...R.set].sort().join(", "));
    ok(!R.set.has("phi-iron-pro"), "PHI-IRON-PRO (inmovilizado, sobrestock, NO frenado con este umbral) queda FUERA de la intersección", [...R.set].join(", "));
  }
  volverAlDemo();
}

/* ── CARNADAS · el gate tiene que arder con afirmaciones deliberadamente rotas sobre el canon (el candado tiene dientes) ── */
H("(a) · CARNADAS — el gate detecta una afirmación falsa sobre el canon (no solo confirma lo esperado)");
{
  const I = indiceDe();   // sin umbral de frenado
  const carnadaFalsa = veredictoEstado(I, "SAM-REF500L", "inmovilizado");
  ok(carnadaFalsa.veredicto !== "verdadera", "CARNADA · SAM-REF500L NO es inmovilizado — si esto saliera \"verdadera\", el candado no tiene dientes", JSON.stringify(carnadaFalsa));
  const carnadaCritico = veredictoEstado(I, "SAM-MICRO32L", "inmovilizado critico");
  ok(carnadaCritico.veredicto !== "verdadera", "CARNADA · SAM-MICRO32L (capital sano) NO es inmovilizado crítico", JSON.stringify(carnadaCritico));
  const I60 = indiceConUmbralEmpresa60();
  const carnadaFrenadoSano = veredictoEstado(I60, "SAM-TV55", "frenado");
  ok(carnadaFrenadoSano.veredicto !== "verdadera", "CARNADA · SAM-TV55 (12 días, bajo el umbral de 60) NO está frenado", JSON.stringify(carnadaFrenadoSano));
  volverAlDemo();
}

H("CERO llamadas a un LLM · CERO red — solo por npm run gates:offline");
{
  const fuente = fs.readFileSync("./_inventario_canon_gate.mjs", "utf8");
  const c = clasificarFuente(fuente);
  ok(c.tipo === "offline", "clasificarFuente(_inventario_canon_gate.mjs) === offline", JSON.stringify(c));
}

console.log(`\n── _inventario_canon_gate: PASS ${pass} · FAIL ${fail} (de ${pass + fail}) ──`);
if (fail) console.log(fails.map((f) => `  ✗ ${f}`).join("\n"));
process.exit(fail ? 1 : 0);
