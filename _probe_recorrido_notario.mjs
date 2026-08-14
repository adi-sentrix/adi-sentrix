/* === _probe_recorrido_notario.mjs · TRES RECORRIDOS COMPLETOS DEL NOTARIO, con salida REAL (owner 2026-08-14:
 * «necesito ver el idioma interno»). CERO red, CERO .env. */
import { guardC, parseCounts } from "./src/adi/oracle/guardC.js";
import { parseFigures } from "./src/adi/boleta.js";
import { cifrasDelDato } from "./src/adi/oracle/datoProyectado.js";
import { axisEntityNames } from "./src/adi/oracle/entityIndex.js";
import { initTenant } from "./src/data/tenantStore.js";
import { TENANT_DEMO } from "./src/data/tenants/demo.js";
initTenant(TENANT_DEMO);

const CIFRAS = cifrasDelDato("actual");
const _ejes = (ejes) => { const o = []; for (const e of ejes) { try { for (const n of axisEntityNames(e)) o.push(n); } catch { } } return o.length ? o : null; };
const CTX = { ledger: { figs: [] }, results: [], trace: null, datoProyectado: CIFRAS, entidadesDelTenant: _ejes(["cliente", "sku", "marca"]), duenosDelTenant: _ejes(["cliente", "sku", "marca", "familia", "bodega", "canal"]), contentScope: "full", tablePolicy: "auto" };

const CASOS = [
  { id: "1 · LEGÍTIMA", q: "baja 2% la carga de Falabella, ¿queda sobre el benchmark?",
    texto: "Falabella vende $19.4M con margen 22.0% — 8.1 puntos bajo tu benchmark de 30.1%. Interpreto tu 2% como 2 puntos porcentuales: su carga comercial marca 4.5%, y 4.5% − 2.0pp = 2.5%. Bajo ese supuesto el margen mejoraría en la misma proporción, pero seguiría lejos del benchmark. Yo empezaría por revisar sus acciones comerciales antes que el precio — es donde está la brecha." },
  { id: "2 · INVENTADA (salida REAL de Sonnet, medida)", q: "¿Dónde tengo capital inmovilizado?",
    texto: "Capital parado, no capital total: la foto de hoy tiene $43K de $135K en inventario (32%) frenados en 4 SKU que superan el techo de 120 días o caen bajo el piso de rotación. Tus tres clientes de mayor venta son Jumbo, Sodimac y Ripley, y tu meta de margen es 30.1% — la cartera sigue bajo esa meta." },
  { id: "3 · JUICIO ASESOR + HIPÓTESIS", q: "¿qué harías tú con Lider?",
    texto: "Lider marca margen 21.5% con venta $17.9M — la brecha más ancha de tu cartera contra el benchmark de 30.1%. El dato no registra por qué su carga es alta: eso se levanta en la negociación, no en esta lectura. Mi lectura de asesor —criterio, no un dato observado—: yo negociaría las acciones comerciales de Lider antes de tocar precio, porque la brecha está ahí y no en el costo. Si eso funcionara, bajo ese supuesto la mejora iría directo a contribución — es una hipótesis a validar, no un resultado." },
];

for (const c of CASOS) {
  console.log(`\n═══════════ ${c.id} ═══════════`);
  console.log(`PREGUNTA: «${c.q}»`);
  const figs = parseFigures(c.texto).map((f) => `${f.text} [${f.unit || "?"}] canon=${f.canon}`);
  const counts = parseCounts(c.texto).map((x) => `«${x.text}» (${x.raw})`);
  console.log(`\nAFIRMACIONES-CIFRA EXTRAÍDAS (${figs.length}): ${figs.join(" · ")}`);
  console.log(`AFIRMACIONES-CONTEO (${counts.length}): ${counts.join(" · ") || "—"}`);
  const v = guardC(c.texto, { ...CTX, question: c.q });
  console.log(`\nVEREDICTO: ${v.ok ? (v.degraded ? "🟡 DEGRADADO (pasa, con reintento recomendado)" : "🟢 VERDE — fiel") : `🔴 ${v.verdict}`}`);
  for (const x of (v.violations || [])) console.log(`  ✗ [${x.kind}] ${x.detail}`);
  for (const a of (v.advisories || [])) console.log(`  ⚠ [advisory] [${a.kind}] ${String(a.detail || "").slice(0, 120)}`);
}
