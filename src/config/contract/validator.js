/* === config/contract/validator.js · CONTRATO DE DATOS · Paso 3 ===
 * EL VALIDADOR. Carga el manifest, corre las reglas según el MODO, agrega hallazgos por severidad y devuelve un
 * veredicto. NO toca el motor sellado — solo lee las fuentes (que el motor también lee, aparte).
 *
 * MODOS (owner):
 *  · "demo"  → OBSERVE-FIRST: corre todo, reporta todo, NUNCA bloquea la respuesta (apt=true siempre).
 *  · "ci"    → falla si hay algún blocker (apt=false → romper build/test).
 *  · "prod"  → dataset NO-APTO si falla un blocker (apt=false → no servir, mensaje seguro).
 *
 * Devuelve { mode, apt, counts, findings:{blocker,warning,info} }. `apt=false` en ci/prod significa "no confiar en
 * este dataset". En demo `apt` siempre true (pero los blockers quedan reportados como "romperían en CI"). */
import { SOURCES } from "./sourceManifest.js";
import { ENTITIES } from "./entityRegistry.js";
import { METRICS } from "./metricRegistry.js";
import { RULES, TOLERANCE } from "./validationRules.js";

export function validateDataset(mode = "demo") {
  const ctx = {
    SOURCES, ENTITIES, METRICS, TOLERANCE, mode,
    load: (name) => { try { return SOURCES[name]?.load() || []; } catch { return []; } },
  };
  const findings = { blocker: [], warning: [], info: [] };
  for (const rule of RULES) {
    if (rule.modes && !rule.modes.includes(mode)) continue;   // la regla no aplica a este modo
    let hits;
    try { hits = rule.check(ctx) || []; }
    catch (e) { findings.blocker.push({ rule: rule.id, where: "(check)", msg: `la regla crasheó: ${e.message}` }); continue; }
    for (const h of hits) (findings[rule.severity] || findings.warning).push({ rule: rule.id, ...h });
  }
  const apt = mode === "demo" ? true : findings.blocker.length === 0;
  return {
    mode, apt,
    counts: { blocker: findings.blocker.length, warning: findings.warning.length, info: findings.info.length },
    findings,
  };
}

// reporte legible (para CI / dev · en el runtime demo el consumidor decide qué hacer con el objeto)
export function formatReport(rep) {
  const L = [];
  const tag = rep.apt ? (rep.counts.blocker ? "APTO (observe-first · hay blockers que romperían en CI)" : "APTO") : "NO-APTO";
  L.push(`Contrato · modo ${rep.mode} → ${tag}`);
  L.push(`  blocker: ${rep.counts.blocker} · warning: ${rep.counts.warning} · info: ${rep.counts.info}`);
  for (const sev of ["blocker", "warning", "info"]) {
    for (const f of rep.findings[sev]) L.push(`  [${sev.toUpperCase()}] ${f.rule} · ${f.where}: ${f.msg}`);
  }
  return L.join("\n");
}
