/* ¿Por qué H9 cae al suplente en la doble completa? Re-juzga los dos turnos con el contexto real del hilo. */
import fs from "fs";
import { guardC } from "./src/adi/oracle/guardC.js";
import { recitaAprobadaDe, alcanceHeredadoDe } from "./src/adi/oracle/cicloNotarial.js";
import { cifrasDelDato } from "./src/adi/oracle/datoProyectado.js";
import { axisEntityNames } from "./src/adi/oracle/entityIndex.js";
import { parseFigures } from "./src/adi/boleta.js";
import { initTenant } from "./src/data/tenantStore.js";
import { TENANT_DEMO } from "./src/data/tenants/demo.js";
initTenant(TENANT_DEMO);
const ejes = (a) => a.flatMap((e) => { try { return axisEntityNames(e); } catch { return []; } });
const ENT6 = ejes(["cliente", "sku", "marca", "familia", "bodega", "canal"]);
const CAT = {}; for (const e of ["cliente", "sku", "marca", "familia", "bodega", "canal"]) { try { const n = axisEntityNames(e); if (n.length) CAT[e] = n; } catch { } }
const d = JSON.parse(fs.readFileSync("_corrida_doble.json", "utf8"));
const h = d.registro.find((x) => x.hilo.startsWith("H9"));
const sup = [];
let recita = null, previa = null;
for (let i = 0; i < h.B.length; i++) {
  const t = h.B[i];
  for (const pf of parseFigures(t.q)) sup.push(pf.text);
  const her = alcanceHeredadoDe({ pregunta: t.q, respuestaAnterior: previa, catalogoPorEje: CAT });
  const v = guardC(t.texto, { ledger: { figs: [] }, results: [], trace: null, question: t.q, supuestoPendiente: sup, alcanceHeredado: her, recitaAprobada: recita, datoProyectado: cifrasDelDato("actual"), entidadesDelTenant: ejes(["cliente", "sku", "marca"]), duenosDelTenant: ENT6, contentScope: "full", tablePolicy: "auto" });
  console.log(`\n${v.ok ? "🟢" : "🔴"} Q${i + 1} «${t.q}» [${t.estado}]`);
  for (const x of (v.violations || []).slice(0, 3)) console.log(`   [${x.kind}] ${String(x.detail).slice(0, 130)}`);
  const num = String((v.violations[0] || {}).detail || "").match(/\$[\d.,]+[KMB]?|[\d.,]+\s*%/);
  if (num) for (const o of String(t.texto).split(/[.!?\n]+(?:\s+|$)/)) if (o.includes(num[0])) { console.log(`   oración: «${o.trim().slice(0, 200)}»`); break; }
  previa = t.texto;
  recita = recitaAprobadaDe({ textoAprobado: t.texto, catalogoEntidades: ENT6, previa: recita });
}
