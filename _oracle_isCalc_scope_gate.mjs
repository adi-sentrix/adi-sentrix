/* === _oracle_isCalc_scope_gate.mjs · ARQUITECTURA C · GATE DE SCOPE EN _isCalc NIVEL 1 === hallazgo del re-barrido
 * de 17 turnos (owner 2026-07-29, auditoría adversarial post-fixes): _isCalc (nivel 1, guardC.js) pooleaba TODAS
 * las figs del mismo `unit` en TODO el ledger sin mirar a qué entidad pertenecen — CONFIRMADO EN VIVO: un turno
 * sobre el SKU MAK-COMP-AIR narró "renegociar la carga comercial (hoy en $194K)" — $194K NO es de MAK-COMP-AIR,
 * es la carga comercial REAL de Falabella (un CLIENTE que ni siquiera estaba en el ledger de ese turno) — pero
 * guardC la dejó pasar porque 56000 (Medida·1pp en LG-DRYER8KG) + 138600 (Medida·cerrar brecha en LG-AIR9000) ≈
 * 194600, dos SKU sin relación con lo narrado, "autorizando" el número por pura coincidencia combinatoria.
 * Fix: _isCalc ahora acota su pool a (a) figs SIN entidad reconocible en el label (totales/estructurales, siempre
 * combinables) + (b) figs de una entidad MENCIONADA en el texto — mismo principio que _isCalc2 (nivel 2), aplicado
 * acá a nivel 1. Determinístico · sin LLM (guardC() corre directo sobre el ledger REAL de marginRead).
 */
import { runPlan } from "./src/adi/oracle/toolRunner.js";
import { guardC } from "./src/adi/oracle/guardC.js";
const SC = "actual";

const { ledger, results, trace } = runPlan({ intent: "answer", calls: [{ tool: "marginRead", args: { dimension: "sku", focus: "bajo_benchmark" } }] }, { scenario: SC });

// confirmar que el ledger REAL trae las figs exactas del hallazgo (si el dato del demo cambia, este gate debe
// re-anclarse — no hardcodeamos el ledger, lo leemos del pipeline real como todos los demás gates de esta sesión)
// labels en convención "Entidad · Concepto" (owner 2026-08-02/03: antes "Medida · 1pp en X" — la entidad al final
// rompía el agrupador de tabla/lista; corregido en toolRegistry.js a "X · Medida 1pp" / "X · Medida cerrar brecha").
const oneppLGD = ledger.figs.find((f) => f.label.includes("LG-DRYER8KG · Medida 1pp"));
const brechaLGA = ledger.figs.find((f) => f.label.includes("LG-AIR9000 · Medida cerrar brecha"));

let pass = 0, fail = 0;
const ok = (cond, label) => { console.log(`  ${cond ? "✓" : "✗"} ${label}`); if (cond) pass++; else fail++; };

ok(!!oneppLGD && !!brechaLGA, "el ledger real de marginRead(sku) trae las 2 figs del hallazgo (LG-DRYER8KG 1pp + LG-AIR9000 brecha)");

if (oneppLGD && brechaLGA) {
  const suma = oneppLGD.raw + brechaLGA.raw;
  console.log(`  suma real: ${oneppLGD.raw} + ${brechaLGA.raw} = ${suma} (~$${Math.round(suma / 1000)}K)`);

  const textoMalo = `Te recomendaría renegociar la carga comercial de MAK-COMP-AIR (actualmente $${Math.round(suma / 1000)}K), ya que está por encima del target y afecta directamente tu margen.`;
  const gMalo = guardC(textoMalo, { ledger, results, trace, question: "¿qué SKU ceden más margen?" });
  ok(!gMalo.ok, `MALO — el número (suma de 2 SKU no mencionados) atribuido a MAK-COMP-AIR debe BLOQUEAR (antes pasaba en falso) → ${gMalo.ok ? "PASÓ (bug)" : "bloqueado: " + JSON.stringify(gMalo.violations)}`);

  // control: la MISMA suma, pero mencionando las 2 entidades reales dueñas de cada operando → debe AUTORIZARSE
  // (no rompemos el caso legítimo de "juntos, LG-DRYER8KG y LG-AIR9000 suman $X")
  const textoBueno = `LG-DRYER8KG y LG-AIR9000 juntos representan $${Math.round(suma / 1000)}K en oportunidad de margen.`;
  const gBueno = guardC(textoBueno, { ledger, results, trace, question: "¿qué SKU ceden más margen?" });
  const relevantViol = (gBueno.violations || []).filter((v) => v.kind === "cifra-no-autorizada");
  ok(relevantViol.length === 0, `BUENO (control) — la MISMA suma, mencionando las 2 entidades REALES dueñas → NO debe bloquear por cifra-no-autorizada (obtuvo: ${JSON.stringify(relevantViol)})`);
}

// control de regresión: el caso YA establecido de brecha de una sola entidad (benchmark − margen) sigue autorizado
{
  const panelRows = results[0].facts && results[0].facts.margin && results[0].facts.margin.panel && results[0].facts.margin.panel.rows;
  const row = Array.isArray(panelRows) ? panelRows.find((r) => typeof r.margen === "number") : null;
  if (row) {
    const bench = 30.1; // POLICY.benchmark del demo
    const brecha = +(bench - row.margen).toFixed(1);
    const texto = `${row.nombre || row.sku} tiene un margen de ${row.margen}%, ${brecha} puntos porcentuales bajo el benchmark de ${bench}%.`;
    const g = guardC(texto, { ledger, results, trace, question: "" });
    ok(g.ok, `REGRESIÓN — brecha de UNA sola entidad (benchmark−margen) sigue autorizada tras el fix de scope (obtuvo: ${g.ok ? "OK" : JSON.stringify(g.violations)})`);
  } else ok(false, "no se encontró una fila válida para el control de regresión (revisar dato demo)");
}

// control: total/estructural SIN entidad (ej. suma de dos figs "Total ·") sigue autorizado — no tiene dueño que restringir
{
  const totales = ledger.figs.filter((f) => /^Total\s*·/i.test(f.label) && f.unit === "money");
  if (totales.length >= 2) {
    const suma = totales[0].raw + totales[1].raw;
    const texto = `Entre ${totales[0].label.split("·")[1]?.trim() || "ambos"} y el otro total, juntos suman $${Math.round(Math.abs(suma) / 1000)}K.`;
    const g = guardC(texto, { ledger, results, trace, question: "" });
    const relevantViol = (g.violations || []).filter((v) => v.kind === "cifra-no-autorizada");
    console.log(`  (info) control de totales estructurales: ${relevantViol.length === 0 ? "sigue autorizado" : "bloqueado — revisar si es esperado"} — ${texto.slice(0, 80)}`);
  } else console.log("  (info) no hay 2+ figs 'Total ·' en este ledger para el control estructural — se omite (no es un fallo)");
}

console.log(`\n── _oracle_isCalc_scope_gate: ${pass} PASS · ${fail} FAIL (de ${pass + fail}) ──`);
process.exit(fail ? 1 : 0);
