/* === _fallback_por_forma_gate.mjs · LA RECUPERACIÓN DEL PRODUCTO, NO LA BUENA VOLUNTAD DEL MODELO ==============
 * (owner 2026-08-12, punto 3)
 *
 * LO QUE ESTE GATE CERTIFICA, y la distinción es el encargo entero: NO mide que un narrador bien portado produzca
 * la forma pedida. Mide qué hace el producto cuando el narrador FALLA o DESOBEDECE. Por eso el `callNarrate`
 * inyectado acá nunca coopera: devuelve tablas cuando se pidió prosa, prosa cuando se pidió tabla, listas
 * numeradas donde va una tabla, cifras inventadas, o directamente se cae. Si el turno igual sale con la forma
 * pedida y sin una cifra que el ledger no autorizó, la recuperación es del motor.
 *
 * LOS CINCO TURNOS MEDIDOS que motivan cada caso (certificación de f4f2949):
 *   E1.t3 · pidió separar probado/indicado/abierto y recibió una tabla pelada.
 *   E2.t1 y E2.t4 · la tabla correspondía, y salió sin una sola línea que la leyera.
 *   E3.t2 · pidió una tabla y recibió una lista numerada.
 *   E3.t3 · pidió prosa y recibió la MISMA tabla del turno anterior, con el sujeto cambiado.
 *
 * `node --import ./scripts/offline-guard.mjs _fallback_por_forma_gate.mjs`
 */
import { initTenant } from "./src/data/tenantStore.js";
import { TENANT_DEMO } from "./src/data/tenants/demo.js";
import { componerPorForma } from "./src/adi/oracle/narrationBlocks.js";
import { answerViaOracle } from "./src/adi/oracle/answerViaOracle.js";

initTenant(TENANT_DEMO);
let PASS = 0, FAIL = 0;
const ok = (c, m, extra = "") => { if (c) { PASS++; console.log("  ✓ " + m); } else { FAIL++; console.log("  ✗ " + m + (extra ? "\n      " + extra : "")); } };
const h = (t) => console.log(`\n${t}`);
const HAY_TABLA = /^\s*\|.*\|\s*$/m;
const LISTA_NUM = /^\s*\d+[.)]\s+/m;

/* LA BOLETA DE PRUEBA: cifras con los tres sellos, dos entidades, período y universo declarados. Es el material
 * con el que el fallback tiene que trabajar — y nada más que eso. */
const FIGS = [
  { label: "Falabella · Contribución", value: "$4.2M", raw: 4200000, unit: "money",
    tipo: { sello: "probado", periodo: "año móvil", universoEtiqueta: "venta comercial", entidad: "Falabella" } },
  { label: "Falabella · Margen", value: "22.4%", raw: 22.4, unit: "pct",
    tipo: { sello: "probado", periodo: "año móvil", universoEtiqueta: "venta comercial", entidad: "Falabella" } },
  { label: "Falabella · Brecha vs vara", value: "3.1 pts", raw: 3.1, unit: "pct",
    tipo: { sello: "indicado", periodo: "año móvil", universoEtiqueta: "venta comercial", entidad: "Falabella" } },
  { label: "Lider · Contribución", value: "$1.8M", raw: 1800000, unit: "money",
    tipo: { sello: "abierto", periodo: "año móvil", universoEtiqueta: "venta comercial", entidad: "Lider" } },
];

/* ═══ 1 · E1.t3 · PROSA QUE SEPARA PROBADO / INDICADO / ABIERTO ════════════════════════════════════════════════ */
h("1 · E1.t3 · prosa con los tres estatus separados — no una tabla pelada");
{
  const t = componerPorForma({ figs: FIGS, contentScope: "full", forma: "prosa" });
  ok(!HAY_TABLA.test(t), "no emite tabla cuando la forma pedida es prosa", t);
  ok(/demuestra/i.test(t) && /se[ñn]al apunta/i.test(t) && /no se puede cerrar/i.test(t),
    "los TRES estatus salen separados y nombrados", t);
  // el orden importa: lo probado antes que lo indicado, y lo indicado antes que lo abierto.
  ok(t.indexOf("demuestra") < t.indexOf("apunta") && t.indexOf("apunta") < t.indexOf("no se puede cerrar"),
    "y en ese orden: primero lo que el dato sostiene, después la señal, al final el límite");
  ok(/3\.1 pts/.test(t.slice(t.indexOf("apunta"), t.indexOf("no se puede cerrar"))),
    "la brecha sellada `indicado` queda EN el grupo indicado, no mezclada con lo probado", t);
}

/* ═══ 2 · E2.t1 y E2.t4 · LA TABLA CORRESPONDE, Y LLEVA LECTURA MÍNIMA ═════════════════════════════════════════ */
h("2 · E2.t1 / E2.t4 · tabla + lectura mínima — y «solo la tabla» la recorta");
{
  const t = componerPorForma({ figs: FIGS, contentScope: "full", forma: "tabla" });
  ok(HAY_TABLA.test(t), "emite una tabla real");
  ok(/fila de mayor magnitud/i.test(t), "…y una lectura mínima que la acompaña", t);
  ok(/Falabella · Contribución/.test(t.split("\n").pop()), "la lectura nombra la fila de mayor magnitud del ledger", t.split("\n").pop());

  // «solo la tabla»: la forma sigue siendo tabular, lo que se recorta es la lectura.
  const solo = componerPorForma({ figs: FIGS, contentScope: "data_only", forma: "tabla" });
  ok(HAY_TABLA.test(solo), "con «solo la tabla» la tabla SIGUE saliendo (el alcance no la borra)");
  ok(!/fila de mayor magnitud/i.test(solo), "…y ahí sí, sin lectura encima", solo);
}

/* ═══ 3 · E3.t2 · TABLA REAL, NO LISTA NUMERADA ═══════════════════════════════════════════════════════════════ */
h("3 · E3.t2 · una tabla es una tabla, no una lista numerada");
{
  const t = componerPorForma({ figs: FIGS, contentScope: "full", forma: "tabla" });
  ok(!LISTA_NUM.test(t), "no hay ninguna línea que empiece con «1.» o «1)»", t);
  const filas = t.split("\n").filter((l) => /^\|/.test(l));
  ok(filas.length >= FIGS.length + 2, `la tabla trae encabezado, separador y una fila por cifra (${filas.length})`);
  ok(/^\|\s*Concepto\s*\|\s*Valor\s*\|$/.test(filas[0]), "con encabezado declarado", filas[0]);
}

/* ═══ 4 · E3.t3 · PROSA SIN REPETIR TABLA Y SIN CAMBIAR DE SUJETO ══════════════════════════════════════════════ */
h("4 · E3.t3 · la prosa no repite la tabla ni se cambia de sujeto");
{
  const t = componerPorForma({ figs: FIGS, contentScope: "full", forma: "prosa" });
  ok(!HAY_TABLA.test(t), "no repite la tabla del turno anterior");
  // el sujeto es la entidad que más cifras aporta — Falabella (3) sobre Lider (1). No puede derivar al negocio.
  ok(/^Sobre Falabella/.test(t), "conserva el sujeto de la pregunta, no deriva al negocio entero", t.slice(0, 60));
  ok(!/\bel negocio\b/i.test(t), "…y no aparece «el negocio» como sujeto nuevo", t);
}

/* ═══ 5 · data_only Y solo_conclusion · LOS DOS CONTRATOS BREVES ═══════════════════════════════════════════════ */
h("5 · «solo el dato» y «solo la conclusión» — brevedad con marco, no doce filas");
{
  const d = componerPorForma({ figs: FIGS, contentScope: "data_only", forma: "auto" });
  ok(!HAY_TABLA.test(d), "data_only NO emite tabla", d);
  ok(d.split("\n").filter(Boolean).length === 1, "es UNA sola oración", d);
  ok(/Falabella/.test(d) && /\$4\.2M/.test(d), "…con la entidad y la cifra", d);
  ok(/año móvil/.test(d), "…y el PERÍODO, que es lo que impide leerla fuera de su marco", d);

  const c = componerPorForma({ figs: FIGS, contentScope: "full", forma: "solo_conclusion" });
  ok(!HAY_TABLA.test(c) && c.split("\n").filter(Boolean).length === 1, "solo_conclusion es una línea, sin tabla", c);
  ok(c.length < d.length + 40, "…y no más larga que el dato solo", c);
}

/* ═══ 6 · auto · QUÉ PASA, POR QUÉ Y QUÉ HACER — SIN INVENTAR LA CAUSA ════════════════════════════════════════ */
h("6 · auto · los tres movimientos, y la causa declarada ABIERTA en vez de inventada");
{
  const t = componerPorForma({ figs: FIGS, contentScope: "full", forma: "auto" });
  ok(/Sobre Falabella/.test(t), "(01) qué pasa, con sujeto y cifra", t.split("\n")[0]);
  ok(/no aísla la causa/i.test(t), "(02) por qué: se DECLARA que el dato no la aísla — no se inventa una", t);
  ok(/Por dónde partir/i.test(t), "(03) qué hacer primero", t);
  // la trampa que este movimiento tiene que evitar: narrar una causa que el ledger no trae.
  ok(!/se debe a|la causa es|porque el|explica por qu/i.test(t),
    "y NINGUNA fórmula causal se cuela en el texto", t);
}

/* ═══ 7 · LO QUE EL FALLBACK NUNCA HACE ═══════════════════════════════════════════════════════════════════════ */
h("7 · ninguna cifra nueva, ningún recálculo");
{
  const autorizadas = new Set(FIGS.map((f) => f.value));
  const CIFRA_RE = /\$[\d.,]+[MK]?|\d+[.,]\d+\s*(?:%|pts)|\d+%/g;
  for (const forma of ["prosa", "tabla", "auto", "solo_conclusion"]) {
    const t = componerPorForma({ figs: FIGS, contentScope: "full", forma }) || "";
    const emitidas = [...new Set(t.match(CIFRA_RE) || [])];
    const nuevas = emitidas.filter((v) => !autorizadas.has(v));
    ok(!nuevas.length, `forma «${forma}»: toda cifra emitida sale VERBATIM del ledger`, nuevas.join(", "));
  }
  ok(componerPorForma({ figs: [], contentScope: "full", forma: "prosa" }) === null,
    "sin figs no compone nada — deja que el caller dé el mensaje honesto de ausencia");
}

/* ═══ 8 · EL NARRADOR DESOBEDECE · LA PRUEBA DE VERDAD ════════════════════════════════════════════════════════ */
h("8 · con un narrador que falla o desobedece, el turno igual sale con la forma pedida");
{
  const PLAN = {
    intent: "answer", mode: "analisis",
    pref: { contentScope: "full", outputForm: "prosa" },
    calls: [{ tool: "entityRecord", args: { dimension: "cliente", entity: "Falabella" } }],
  };
  // TRES DESOBEDIENCIAS DISTINTAS, ninguna cooperativa:
  const DESOBEDIENTES = {
    "devuelve una TABLA donde se pidió prosa": () => "[[DATOS]]\n| Concepto | Valor |\n|---|---|\n| Falabella · Contribución | $4.2M |",
    "inventa una cifra que el ledger no autorizó": () => "[[DATOS]]\nFalabella contribuye $99.9M este año.",
    "se cae con una excepción": () => { throw new Error("proveedor caído"); },
  };
  for (const [queHace, callNarrate] of Object.entries(DESOBEDIENTES)) {
    let out = null, exc = null;
    try {
      out = await answerViaOracle({
        text: "¿Cómo viene Falabella? Separá lo probado de lo indicado.",
        history: [], mem: {}, scenario: "actual",
        callPlan: async () => PLAN,
        callNarrate: async (...a) => callNarrate(...a),
      });
    } catch (e) { exc = e; }
    const r = out && out.r;
    const texto = r ? String(r.text || r.answer || r.respuesta || "") : "";
    ok(!exc, `el narrador ${queHace} → el motor NO propaga la excepción`, exc && exc.message);
    // LA ASERCIÓN QUE NO PUEDE PASAR EN VACÍO: sin texto, las dos de abajo darían verde por no encontrar nada que
    // objetar. Se exige primero que HAYA respuesta, y sólo entonces las otras dos significan algo.
    ok(texto.length > 0, `…y el turno igual produce respuesta (${texto.length} car.)`, JSON.stringify(out).slice(0, 200));
    if (texto.length > 0) {
      ok(!HAY_TABLA.test(texto), "…con la forma PEDIDA (prosa), no la que el narrador quiso", texto.slice(0, 200));
      ok(!/99\.9M/.test(texto), "…y sin la cifra inventada", texto.slice(0, 200));
      /* LA ASERCIÓN QUE ATRAPÓ EL DEFECTO DE VERDAD. «No hay tabla» pasa en verde sobre una respuesta VACÍA, y eso
       * fue exactamente lo que este gate devolvió en su primera corrida: con el narrador que emite tabla donde se
       * pidió prosa, el turno salía con «(Datos del año cerrado.)» — 24 caracteres de puro pie declarativo, cero
       * cifras. Formalmente cumplía la forma; no respondía nada. Cumplir la forma se mide por lo que QUEDA, no por
       * lo que se borró. */
      const _ES_PIE = /^\(?\s*(?:alcance|datos del|foto de inventario|supuesto)\b/i;
      const cuerpo = texto.split(/\n{2,}/).map((s) => s.trim()).filter(Boolean).filter((s) => !_ES_PIE.test(s));
      ok(cuerpo.length > 0, "…y con CUERPO, no sólo el pie declarativo que sobrevive a la poda", texto);
      ok(/\$[\d.]+M|\d+\.\d+%/.test(cuerpo.join(" ")), "…que además conserva al menos una cifra del ledger", cuerpo.join(" ").slice(0, 160));
    }
  }
}

console.log(`\n── _fallback_por_forma_gate: ${PASS} PASS · ${FAIL} FAIL (de ${PASS + FAIL}) ──`);
process.exit(FAIL ? 1 : 0);
