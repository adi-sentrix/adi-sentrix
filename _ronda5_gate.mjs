/* === _ronda5_gate.mjs · EL BANCO DE LA RONDA 5 COMO CANDADO (Notario v3.1 «cada palabra tiene dueño» · owner 2026-09-17, offline) ═══════════
 * Los 888 casos de la ronda 5 (UltraCode, fuera de muestra: comercial · cobranza · inventario · cruces · verdaderos · flujo · respaldo · hechos ·
 * respaldo_casa) corren por `_ronda5_banco.mjs`. Este gate corre el banco entero en los canales rápidos (hechos: 440 veredictos · casa: 46 ataques)
 * y una muestra estratificada fija de los canales de turno (1 de cada 4 casos) y exige:
 *   1 · canal 1 (el libro): 0 falsos que salen verdaderos · 0 verdaderos bloqueados;
 *   2 · respaldo (la casa): 0 falsedades servidas · 0 verdaderos bloqueados;
 *   3 · turno (el modelo): 0 falsedades servidas fuera de las DIVERGENCIAS ACEPTADAS (decisiones de producto documentadas en
 *       `_NOTARIO_V31_PROPUESTA.md` §6), y los verdaderos verdes a la primera no bajan del piso medido.
 * Solo por `npm run gates:offline` (o con el candado: node --import ./scripts/offline-guard.mjs _ronda5_gate.mjs). Cero red. */
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { execFileSync } from "node:child_process";

let PASS = 0, FAIL = 0;
const ok = (c, m, extra = "") => { if (c) { PASS++; console.log("  ✓ " + m); } else { FAIL++; console.log("  ✗ " + m + (extra ? "\n      " + extra : "")); } };

/* divergencias aceptadas (producto): la fila «Total» de una tabla suma lo que la tabla muestra */
const ACEPTADAS = new Set(["A37 · fila «Total» con un grupo parcial (grupo con valor, cabecera sin palabra de estado)"]);
const PISO_VERDES = 0.5;   // verdaderos verdes a la primera, muestra 1/4 (medido 2026-09-22: 60 %)

const salida = path.join(os.tmpdir(), `ronda5_gate_${process.pid}.json`);
const args = ["--import", "./scripts/offline-guard.mjs", "_ronda5_banco.mjs", salida, "--cada", "4"];
let out = "";
try { out = execFileSync(process.execPath, args, { cwd: process.cwd(), encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], maxBuffer: 64 * 1024 * 1024 }); }
catch (e) { out = String((e && e.stdout) || "") + String((e && e.stderr) || ""); }
const R = fs.existsSync(salida) ? JSON.parse(fs.readFileSync(salida, "utf8")) : null;
try { fs.unlinkSync(salida); } catch { /* nada */ }
console.log(out.split("\n").filter((l) => /RONDA 5|TOTAL turno|hechos \(canal 1\)|casa \(respaldo\)|ataques/.test(l)).join("\n"));

console.log("\n1 · el libro (canal 1)");
const M = (R && R.medidas) || {};
ok(!!R, "el banco corrió y dejó su detalle", out.slice(-600));
ok(M.hechos && (M.hechos.falsosQueSalenVerdaderos || 0) === 0, `hechos falsos que salen verdaderos: ${M.hechos ? M.hechos.falsosQueSalenVerdaderos || 0 : "?"} (debe ser 0)`);
ok(M.hechos && (M.hechos.verdaderosBloqueados || 0) === 0, `hechos verdaderos bloqueados: ${M.hechos ? M.hechos.verdaderosBloqueados || 0 : "?"} (debe ser 0)`);
ok(M.hechos && (M.hechos.hechos || 0) >= 400, `hechos con veredicto esperado: ${M.hechos ? M.hechos.hechos || 0 : 0} (≥ 400)`);

console.log("\n2 · la casa (respaldo)");
ok(M.casa && (M.casa.falsedadesServidas || 0) === 0, `falsedades servidas por la casa: ${M.casa ? M.casa.falsedadesServidas || 0 : "?"} (debe ser 0)`);
ok(M.casa && (M.casa.verdaderosBloqueados || 0) === 0, `verdaderos de la casa bloqueados: ${M.casa ? M.casa.verdaderosBloqueados || 0 : "?"} (debe ser 0)`);

console.log("\n3 · el turno (muestra 1/4)");
const D = (R && R.detalle) || [];
const rompen = D.filter((c) => c.ROMPE && c.angulo !== "hechos" && c.angulo !== "casa" && !ACEPTADAS.has(String(c.id)));
ok(rompen.length === 0, `falsedades servidas en el turno fuera de las aceptadas: ${rompen.length} (debe ser 0)`, rompen.map((c) => `${c.angulo} · ${String(c.id).slice(0, 60)} · ${JSON.stringify(c.servidas)}`).join("\n      "));
const T = ["comercial", "cobranza", "inventario", "cruces", "verdaderos", "flujo", "respaldo"].map((a) => M[a] || {});
const verdaderos = T.reduce((s, m) => s + (m.verdaderos || 0), 0), verdes = T.reduce((s, m) => s + (m.verdesALaPrimera || 0), 0);
ok(verdaderos > 0 && verdes / verdaderos >= PISO_VERDES, `verdaderos verdes a la primera: ${verdes}/${verdaderos} = ${verdaderos ? (100 * verdes / verdaderos).toFixed(1) : "?"} % (piso ${PISO_VERDES * 100} %)`);
const errores = D.filter((c) => c.error);
ok(errores.length === 0, `casos con error de ejecución: ${errores.length} (debe ser 0)`, errores.slice(0, 5).map((c) => c.id + " · " + c.error).join("\n      "));

console.log(`\n── _ronda5_gate: ${PASS} PASS · ${FAIL} FAIL (de ${PASS + FAIL}) ──`);
process.exit(FAIL ? 1 : 0);
