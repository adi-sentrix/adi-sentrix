/* ¿Qué cifra exacta se veta en el hilo de ventas? Re-juzga los textos crudos de la mini doble. CERO red. */
import fs from "fs";
import { guardC } from "./src/adi/oracle/guardC.js";
import { cifrasDelDato } from "./src/adi/oracle/datoProyectado.js";
import { axisEntityNames } from "./src/adi/oracle/entityIndex.js";
import { parseFigures } from "./src/adi/boleta.js";
import { initTenant } from "./src/data/tenantStore.js";
import { TENANT_DEMO } from "./src/data/tenants/demo.js";
initTenant(TENANT_DEMO);
const ejes = (a) => a.flatMap((e) => { try { return axisEntityNames(e); } catch { return []; } });
const d = JSON.parse(fs.readFileSync("_corrida_doble_h1h2.json", "utf8"));
const h = d.registro[0];
const supuestos = [];
for (let i = 0; i < h.B.length; i++) {
  const t = h.B[i];
  for (const pf of parseFigures(t.q)) supuestos.push(pf.text);
  if (!t.vetos.length) { console.log(`\n✅ Q${i + 1} «${t.q}» — ${t.estado}`); continue; }
  const v = guardC(t.texto, { ledger: { figs: [] }, results: [], trace: null, question: t.q, supuestoPendiente: supuestos, datoProyectado: cifrasDelDato("actual"), entidadesDelTenant: ejes(["cliente", "sku", "marca"]), duenosDelTenant: ejes(["cliente", "sku", "marca", "familia", "bodega", "canal"]), contentScope: "full", tablePolicy: "auto" });
  console.log(`\n🔴 Q${i + 1} «${t.q}» — ${t.estado}`);
  for (const x of (v.violations || []).slice(0, 4)) console.log(`   [${x.kind}] ${String(x.detail).slice(0, 150)}`);
  // ¿en qué oración vive la cifra vetada?
  const cifra = (v.violations[0] || {}).detail || "";
  const num = String(cifra).match(/\$[\d.,]+[KMB]?|[\d.,]+\s*%/);
  if (num) for (const o of String(t.texto).split(/[.!?\n]+/)) if (o.includes(num[0])) { console.log(`   oración: «${o.trim().slice(0, 190)}»`); break; }
}
