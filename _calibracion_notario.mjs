/* === _calibracion_notario.mjs · LA MATRIZ DE CALIBRACIÓN DEL NOTARIO (constitución 2026-08-14, aprobada
 * como «evolución del notario y de la suite») · CERO red, CERO .env.
 *
 * Dos poblaciones contra el notario REAL en contexto de camino natural (sin boleta, sin tools; la carpeta
 * como fuente + catálogo del tenant):
 *   · POSITIVOS — las 5 respuestas naturales congeladas de _prueba_un_cerebro.json: DEBEN pasar (hoy no
 *     pasan: la matriz muestra exactamente qué falso positivo bloquea cada una).
 *   · NEGATIVOS — inventos medidos y sintéticos por categoría de la constitución: DEBEN morir. Los que hoy
 *     PASAN son los chequeos que faltan (estados · rankings · vocabulario) — la brecha, visible y numerada.
 *
 * Este arnés es el instrumento de iteración: cada arreglo del notario se corre contra la matriz entera.
 * Regla de la constitución: un ajuste que deje pasar un negativo se descarta solo. */
import fs from "fs";
import { guardC, ensureCountAuthorized } from "./src/adi/oracle/guardC.js";
import { cifrasDelDato } from "./src/adi/oracle/datoProyectado.js";
import { axisEntityNames } from "./src/adi/oracle/entityIndex.js";
import { initTenant } from "./src/data/tenantStore.js";
import { TENANT_DEMO } from "./src/data/tenants/demo.js";
initTenant(TENANT_DEMO);

const CIFRAS = cifrasDelDato("actual");
const _ejes = (ejes) => { const o = []; for (const e of ejes) { try { for (const n of axisEntityNames(e)) o.push(n); } catch { /* sin índice */ } } return o.length ? o : null; };
const ENTIDADES = _ejes(["cliente", "sku", "marca"]);
const DUENOS = _ejes(["cliente", "sku", "marca", "familia", "bodega", "canal"]);

const congelado = JSON.parse(fs.readFileSync("_prueba_un_cerebro.json", "utf8"));
const POSITIVOS = congelado.registro.map((r) => ({ id: `P·${r.q.slice(0, 42)}`, q: r.q, texto: r.lavado, espera: "PASA" }));

/* Negativos: cada uno viola UNA categoría de la constitución, con todo lo demás legítimo — así el veto (o su
 * ausencia) se adjudica a un chequeo concreto. Cifras reales del demo para no disparar el chequeo equivocado. */
const NEGATIVOS = [
  { id: "N·cifra-sin-dueño", espera: "MUERE", cubierto: true,
    q: "¿cómo viene el margen?", texto: "El margen es 22.0% y no alcanza para el año." },
  { id: "N·cifra-inventada-sin-fórmula", espera: "MUERE", cubierto: true,
    q: "proyecta 6% más", texto: "Con el 6% más, tus ventas llegarían a $106.0M el año próximo." },
  { id: "N·estado-inventado (4 frenados, motor dice 3)", espera: "MUERE", cubierto: false,
    q: "¿cuánto capital frenado hay?", texto: "Tienes 4 SKU frenados en el inventario: LG-DRYER8KG, MAK-COMP-AIR, BOS-SANDER y PHI-IRON-PRO están frenados hoy." },
  { id: "N·vocabulario (meta≠benchmark)", espera: "MUERE", cubierto: false,
    q: "¿cuál es el benchmark?", texto: "Tu meta de margen es 30.1% y la cartera está debajo de esa meta." },
  { id: "N·ranking-falso (orden que el dato no sostiene)", espera: "MUERE", cubierto: false,
    q: "¿quiénes venden más?", texto: "Tus tres clientes de mayor venta son Jumbo, Sodimac y Ripley." },
  { id: "N·hipótesis-como-hecho", espera: "MUERE", cubierto: false,
    q: "simula subir ventas 4%", texto: "Al subir las ventas 4% tu contribución va a generar $26.1M el año próximo, ese es el resultado que vas a obtener." },
];

function evaluar(caso) {
  // los MISMOS backstops que el pipeline corre antes del muro (acá: el de conteos, con boleta vacía)
  let texto = caso.texto;
  try { texto = ensureCountAuthorized(texto, { figs: [] }, []); } catch { /* el backstop jamás tumba el turno */ }
  const v = guardC(texto, {
    ledger: { figs: [] }, results: [], trace: null, question: caso.q,
    datoProyectado: CIFRAS, entidadesDelTenant: ENTIDADES, duenosDelTenant: DUENOS,
    contentScope: "full", tablePolicy: "auto",
  });
  return { ok: v.ok, verdict: v.verdict, violations: (v.violations || []).map((x) => `${x.kind}:${String(x.detail || "").slice(0, 110)}`), backstopCorrigio: texto !== caso.texto };
}

const filas = [];
console.log("╔════ MATRIZ DE CALIBRACIÓN · notario en contexto de camino natural ════╗\n");
console.log("── POSITIVOS (las 5 respuestas naturales congeladas — DEBEN pasar) ──");
for (const c of POSITIVOS) {
  const r = evaluar(c);
  const estado = r.ok ? "✅ PASA" : "❌ FALSO POSITIVO";
  filas.push({ ...c, ...r, estado });
  console.log(`${estado} · ${c.id}${r.backstopCorrigio ? " · (backstop corrigió el conteo)" : ""}`);
  if (!r.ok) for (const x of r.violations.slice(0, 3)) console.log(`     ${x}`);
}
console.log("\n── NEGATIVOS (inventos por categoría — DEBEN morir) ──");
for (const c of NEGATIVOS) {
  const r = evaluar(c);
  const murio = !r.ok;
  const estado = murio ? "✅ MUERE" : (c.cubierto ? "🔴 SE ESCAPÓ (regresión)" : "🟡 SE ESCAPA (chequeo por construir)");
  filas.push({ ...c, ...r, estado });
  console.log(`${estado} · ${c.id}${murio ? ` → ${r.verdict}` : ""}`);
}

const fp = filas.filter((f) => f.espera === "PASA" && !f.ok).length;
const gaps = filas.filter((f) => f.espera === "MUERE" && f.ok).length;
console.log(`\n╔════ BALANCE ════╗`);
console.log(`Falsos positivos a corregir (bloquean lo legítimo): ${fp}/${POSITIVOS.length}`);
console.log(`Chequeos por construir (dejan pasar inventos):      ${gaps}/${NEGATIVOS.length}`);
console.log(`El notario calibrado = ${POSITIVOS.length}/​${POSITIVOS.length} positivos pasan · ${NEGATIVOS.length}/${NEGATIVOS.length} negativos mueren.`);
fs.writeFileSync("_calibracion_notario.json", JSON.stringify({ fecha: "2026-08-14", filas }, null, 2), "utf8");
console.log(`matriz completa en _calibracion_notario.json`);
