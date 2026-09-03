/* === _humo_calibracion_gate.mjs · EL MEDIDOR DEL HUMO, CALIBRADO CONTRA LO REAL (owner 2026-09-03) ==========
 *
 * La primera corrida viva del humo dio 2 FAIL sobre respuestas IMPECABLES: los criterios pedían frases del
 * composer y el cerebro respondió mejor con otras palabras — el caso 13 del patrón (medir la forma, no el
 * concepto), esta vez en el semáforo mismo. Un semáforo que da rojo sobre respuestas buenas entrena a
 * ignorarlo; el día del rojo real, nadie lo mira.
 *
 * ESTE GATE calibra los criterios NUEVOS (conducta, no cadena — viven en `_humo_criterios.mjs`, el MISMO
 * módulo que consume `_humo.mjs`: una fuente) contra el corpus REAL congelado
 * (fixtures/humo-calibracion-2026-09.json — 33 turnos de las corridas de certificación, remediciones y
 * prueba de encendido, con todos los fraseos que el cerebro produjo de verdad):
 *   · las 28 respuestas CERTIFICADAS → PASS todas (ni un falso rojo);
 *   · los 5 defectos REALES de su día (los rescates «limite», el vacío del directorio, y la pregunta de
 *     entidad de la corrida 4 — cuyo estado decía «reparado» pero cuya conducta era el defecto P1) → FAIL.
 * Y las carnadas en las dos direcciones: la conducta correcta con OTRO fraseo pasa (los dos textos vivos que
 * el medidor viejo mató, verbatim del humo de hoy); la frase certificada SIN la conducta (sin cifras, sujeto
 * dado vuelta) falla.
 *
 * OFFLINE · determinístico · cero red. `node --import ./scripts/offline-guard.mjs _humo_calibracion_gate.mjs` */
import fs from "node:fs";
import path from "node:path";
import { FAMILIAS, hayMonto, cuentaMontos } from "./_humo_criterios.mjs";

let PASS = 0, FAIL = 0;
const ok = (c, m, extra = "") => { if (c) { PASS++; console.log("  ✓ " + m); } else { FAIL++; console.log("  ✗ " + m + (extra ? "\n      " + extra : "")); } };
const H = (t) => console.log("\n" + t);

const F = JSON.parse(fs.readFileSync(path.join(process.cwd(), "fixtures", "humo-calibracion-2026-09.json"), "utf8"));
const famDe = (nombre) => FAMILIAS.find((f) => f.familia === nombre);
const veredicto = (fam, texto) => {
  const p = fam.prohibido(texto);
  if (p) return { pasa: false, motivo: `prohibido: ${p}` };
  return fam.pasa(texto) ? { pasa: true } : { pasa: false, motivo: "falta la conducta certificada" };
};

/* ═══ 1 · EL CORPUS REAL · ni un falso rojo, ni un falso verde ══════════════════════════════════════════════ */
H(`1 · los ${F.casos.length} turnos reales del expediente, contra los criterios de conducta`);
{
  let falsosRojos = 0, falsosVerdes = 0;
  for (const c of F.casos) {
    const fam = famDe(c.familia);
    if (!fam) { ok(false, `familia desconocida en el fixture: ${c.familia}`); continue; }
    const v = veredicto(fam, c.visible);
    if (c.esperado === "PASS" && !v.pasa) { falsosRojos++; console.log(`      FALSO ROJO [${c.familia}] ${v.motivo} · «${String(c.visible).slice(0, 90).replace(/\n/g, " ")}»`); }
    if (c.esperado === "FAIL" && v.pasa) { falsosVerdes++; console.log(`      FALSO VERDE [${c.familia}] «${String(c.visible).slice(0, 90).replace(/\n/g, " ")}»`); }
  }
  const nPass = F.casos.filter((c) => c.esperado === "PASS").length;
  const nFail = F.casos.length - nPass;
  ok(falsosRojos === 0, `★ las ${nPass} respuestas CERTIFICADAS dan PASS — con todos sus fraseos, cero falsos rojos`);
  ok(falsosVerdes === 0, `★ los ${nFail} defectos REALES de su día dan FAIL — el semáforo sigue viendo lo que tiene que ver`);
}

/* ═══ 2 · LAS DOS RESPUESTAS VIVAS QUE EL MEDIDOR VIEJO MATÓ (humo 2026-09-03, verbatim) ════════════════════ */
H("2 · la conducta correcta con OTRO fraseo pasa — los dos falsos rojos de la corrida viva, ahora verdes");
{
  const cobranzaViva = "Al 31 de agosto de 2026, tienes $41.2M en saldo pendiente de cobro, con $12.6M vencido.\n\nLos dos saldos más críticos: Lider: $9.8M en saldo, de los cuales $4.6M están vencidos, con 269 días de antigüedad — recuperación del 45%.\n\nQué hacer primero (esto es criterio mío, no una instrucción del dato): priorizar la gestión de Lider.";
  ok(veredicto(famDe("cobranza"), cobranzaViva).pasa,
    "★ la cobranza del cerebro vivo (sin «Te deben:») PASA — la conducta está: saldo con cifra y vencido con cifra");
  const proyeccionViva = "Con un crecimiento del 3% a 12 meses, tu venta proyectada sería $103.0M — $3.0M adicionales sobre tu base de $100.0M. Eso es el supuesto que declaraste aplicado sobre la venta oficial del período.";
  ok(veredicto(famDe("proyección declarada"), proyeccionViva).pasa,
    "★ la proyección del cerebro vivo (sin la frase del composer) PASA — cifra proyectada + supuesto atribuido");
  // y dos fraseos más que el composer jamás diría — el conjunto de formas es conceptual, no una lista
  ok(veredicto(famDe("proyección declarada"), "Si mantienes ese 3%, venderías $76,4M en los próximos 12 meses — $2,2M más que tu base.").pasa,
    "…y el condicional puro («venderías») también: el tiempo verbal ES la marca de hipótesis");
  ok(veredicto(famDe("margen (el playbook fundador)"), "Tu margen viene 8.6 puntos por debajo del plan: 15 de tus clientes no llegan a la referencia del 30.1%.").pasa,
    "…y el margen contra «el plan»/«la referencia» (sin la palabra benchmark) también pasa");
}

/* ═══ 3 · LA OTRA DIRECCIÓN · la frase certificada SIN la conducta, falla ═══════════════════════════════════ */
H("3 · la cáscara sin conducta falla — el criterio no se engaña con la frase");
{
  ok(!veredicto(famDe("cobranza"), "Te deben: varios clientes, ya te contaré. El vencido después lo vemos.").pasa,
    "★ «Te deben:» SIN una sola cifra → FAIL: la frase del composer no compra el veredicto");
  ok(!veredicto(famDe("proyección declarada"), "Es una proyección sobre el supuesto que declaraste, no una cifra medida.").pasa,
    "★ el sello SIN la cifra proyectada → FAIL: la garantía sin el contenido no es la conducta");
  ok(!veredicto(famDe("síntesis ejecutiva"), "1 · Riesgo de margen. 2 · Riesgo de inventario. 3 · Riesgo de cobro.").pasa,
    "★ tres riesgos SIN montos → FAIL: numerar opiniones no es una síntesis");
  const v = veredicto(famDe("cobranza"), "Saldo pendiente: $118.8M. El vencido es $0: nadie está en mora.");
  ok(!v.pasa && /\$0|owner/.test(String(v.motivo)),
    "★ el vencido en $0 → FAIL por prohibido: la regla del owner también vive en el semáforo");
  ok(!veredicto(famDe("límite honesto"), "No pude completar la lectura que pediste. Lo que sí tengo verificado: Este año = $8.3M. De este mismo turno también tengo Valor: dime cuál abro.").pasa,
    "★ el menú de labels → FAIL por prohibido, en cualquier familia");
}

/* ═══ 4 · EL CABLEADO · el humo consume ESTOS criterios, no una copia ═══════════════════════════════════════ */
H("4 · una sola fuente: el humo importa el módulo que este gate calibra");
{
  const humo = fs.readFileSync(path.join(process.cwd(), "_humo.mjs"), "utf8");
  ok(/from "\.\/_humo_criterios\.mjs"/.test(humo), "★ _humo.mjs importa _humo_criterios.mjs — si divergieran, este gate calibraría un espejo");
  ok(!/pasa:\s*\//.test(humo), "…y no le quedó ningún criterio regex propio adentro");
  ok(FAMILIAS.length === 6 && FAMILIAS.every((f) => typeof f.pasa === "function" && typeof f.prohibido === "function" && typeof f.pregunta === "function"),
    "las 6 familias declaran pregunta, pasa y prohibido como funciones de conducta");
  ok(hayMonto("$41.2M") && hayMonto("5.007.016") && hayMonto("$76,4M") && !hayMonto("en 2026 hubo ventas") && cuentaMontos("$1M y $2M") === 2,
    "el lector de montos ve todas las formas reales ($41.2M · 5.007.016 · $76,4M) y no cuenta años sueltos");
}

console.log(`\n── _humo_calibracion_gate: ${PASS} PASS · ${FAIL} FAIL (de ${PASS + FAIL}) ──`);
process.exit(FAIL ? 1 : 0);
