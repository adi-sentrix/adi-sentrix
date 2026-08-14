/* === _calibracion_notario.mjs · v2 — LA MATRIZ DE CALIBRACIÓN CON LAS 5 EXIGENCIAS DEL OWNER (2026-08-14)
 * «No necesitamos más piezas. Necesitamos que la calibración deje evidencia: qué pasa, qué muere, por qué
 * muere, y qué prueba demuestra que no abrimos una fuga nueva.»
 *
 * 1 · DEFINITION OF DONE — no alcanza «pasa/muere»: cada invento muere POR EL CHEQUEO CORRECTO (morir por
 *     la razón equivocada cuenta como brecha, lección del caso «meta»); cada buena pasa SIN relajar
 *     controles (la prueba: los negativos siguen muriendo + la suite completa sigue verde); ningún arreglo
 *     de falso positivo abre un falso negativo (la matriz ENTERA se corre en cada ajuste — este archivo).
 * 2 · MATRIZ EXPLÍCITA — cada caso declara: qué afirma · tipo de afirmación (cifra/estado/ranking/
 *     comparación/simulación/causalidad/recomendación/conteo/vocabulario/ambigüedad) · chequeo esperado ·
 *     esperado vs actual.
 * 3 · PARÁFRASIS — el notario resiste lenguaje natural, no frases canónicas: variantes de conteo, de
 *     benchmark/meta, de estados y de supuestos.
 * 4 · POLÍTICA DEL 2% — casos de las tres salidas (declarar interpretación · calcular ambas · preguntar);
 *     la interpretación declarada PASA, la ambigüedad material silenciosa MUERE.
 * 5 · EL GATE DE CONEXIÓN — el camino nuevo NO se conecta hasta: matriz 100% verde (positivos Y paráfrasis)
 *     + negativos muriendo por su chequeo + corrida doble de 35 preguntas que confirme mejora o empate.
 *     Cuando la matriz quede verde, este archivo se convierte en gate de la suite (hoy documenta la brecha).
 *
 * CERO red, CERO .env. */
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

/* ════ LOS CASOS · cada uno con su tipo y su chequeo esperado (exigencia 2) ════ */
const CASOS = [
  // ── POSITIVOS CONGELADOS (los 5 textos naturales de _prueba_un_cerebro.json) ──
  ...congelado.registro.map((r, i) => ({
    id: `P${i + 1}·congelado·${r.q.slice(0, 34)}`, q: r.q, texto: r.lavado, espera: "PASA",
    tipo: "respuesta completa (cifras + comparación + recomendación)",
    afirma: "las cifras de la carpeta con dueño, cuentas con fórmula, juicio asesor sobre evidencia",
  })),

  // ── PARÁFRASIS POSITIVAS (exigencia 3: lenguaje natural legítimo debe pasar) ──
  { id: "P6·paráfrasis·conteo «tres principales»", espera: "PASA", tipo: "conteo auto-enumerado",
    afirma: "un conteo que la propia respuesta enumera (3 dichos, 3 listados, todos reales)",
    q: "¿quiénes están peor?", texto: "Tus tres principales clientes bajo el benchmark de 30.1% son Lider con 21.5%, Falabella con 22.0% y Sodimac con 23.5%." },
  { id: "P7·paráfrasis·supuesto «crece 6%» con fórmula", espera: "PASA", tipo: "cálculo derivado (simulación)",
    afirma: "una derivada con su fórmula a la vista sobre dato base + supuesto del usuario",
    q: "si crece 6% qué pasa", texto: "Tus ventas totales marcan $100.0M. Con tu supuesto de +6%: $100.0M × 1.06 = $106.0M. Bajo este supuesto, generaría $6.0M adicionales — es una proyección, no un dato observado." },
  { id: "P8·política-del-2%·interpretación declarada", espera: "PASA", tipo: "ambigüedad declarada + cálculo",
    afirma: "la lectura elegida del «2%» dicha explícita, con la cuenta mostrada",
    q: "baja 2% la carga de Falabella", texto: "Interpreto ese 2% como 2 puntos porcentuales: la carga comercial de Falabella marca 4.5%, y 4.5% − 2.0pp = 2.5%. Si te referías a un 2% relativo, el resultado cambia — dime y lo recalculo." },

  // ── NEGATIVOS · deben morir POR SU chequeo (exigencia 1: la razón correcta) ──
  { id: "N1·cifra sin dueño", espera: "MUERE", tipo: "cifra", chequeoEsperado: /cifra-de-dato-sin-dueno|cifra-no-autorizada/, construido: true,
    afirma: "una cifra real de la carpeta sin su dueño en la oración",
    q: "¿cómo viene el margen?", texto: "El margen es 22.0% y no alcanza para el año." },
  { id: "N2·cifra inventada sin fórmula", espera: "MUERE", tipo: "cifra", chequeoEsperado: /cifra-no-autorizada/, construido: true,
    afirma: "una derivada sin origen mostrado",
    q: "proyecta 6% más", texto: "Con el 6% más, tus ventas llegarían a $106.0M el año próximo." },
  { id: "N3·estado inventado (4 frenados, motor dice 3)", espera: "MUERE", tipo: "estado", chequeoEsperado: /estado/, construido: false,
    afirma: "una clasificación que la carpeta no declara, con entidades reales",
    q: "¿cuánto capital frenado hay?", texto: "Tienes 4 SKU frenados en el inventario: LG-DRYER8KG, MAK-COMP-AIR, BOS-SANDER y PHI-IRON-PRO están frenados hoy." },
  { id: "N4·estado con sinónimo («bloqueados»)", espera: "MUERE", tipo: "estado", chequeoEsperado: /estado/, construido: false,
    afirma: "el mismo estado inventado dicho con otra palabra — el chequeo debe resistir sinónimos",
    q: "¿qué SKU están mal?", texto: "Tienes 4 SKU bloqueados: LG-DRYER8KG, MAK-COMP-AIR, BOS-SANDER y PHI-IRON-PRO no se mueven." },
  { id: "N5·vocabulario (meta≠benchmark), dueño nombrado", espera: "MUERE", tipo: "vocabulario", chequeoEsperado: /vocabulario|meta/, construido: false,
    afirma: "el benchmark del negocio llamado «meta» — con el dueño bien nombrado para que SOLO el vocabulario pueda matarlo",
    q: "¿cómo va la cartera?", texto: "El margen promedio de la cartera marca 25.1%, contra tu meta de margen de 30.1% — la cartera sigue bajo esa meta." },
  { id: "N6·ranking falso", espera: "MUERE", tipo: "ranking", chequeoEsperado: /ranking|orden/, construido: false,
    afirma: "un orden que la carpeta no sostiene (los tres de mayor venta reales son Falabella, Lider, Jumbo)",
    q: "¿quiénes venden más?", texto: "Tus tres clientes de mayor venta son Jumbo, Sodimac y Ripley." },
  { id: "N7·hipótesis como hecho", espera: "MUERE", tipo: "simulación narrada como hecho", chequeoEsperado: /cifra-no-autorizada|hipotesis|graduacion/, construido: true,
    afirma: "un resultado simulado prometido como hecho futuro",
    q: "simula subir ventas 4%", texto: "Al subir las ventas 4% tu contribución va a generar $26.1M el año próximo, ese es el resultado que vas a obtener." },
  { id: "N8·política-del-2%·ambigüedad silenciosa", espera: "MUERE", tipo: "ambigüedad", chequeoEsperado: /ambig/, construido: false,
    afirma: "un «2%» materialmente ambiguo aplicado sin declarar la lectura (tomó pp en silencio: 4.5−2.0=2.5)",
    q: "baja 2% la carga de Falabella", texto: "Con el 2% menos, la carga comercial de Falabella queda en 2.5%." },
];

function evaluar(caso) {
  let texto = caso.texto;
  try { texto = ensureCountAuthorized(texto, { figs: [] }, []); } catch { /* el backstop jamás tumba el turno */ }
  const v = guardC(texto, {
    ledger: { figs: [] }, results: [], trace: null, question: caso.q,
    datoProyectado: CIFRAS, entidadesDelTenant: ENTIDADES, duenosDelTenant: DUENOS,
    contentScope: "full", tablePolicy: "auto",
  });
  return { ok: v.ok, verdict: v.verdict, violations: (v.violations || []).map((x) => `${x.kind}:${String(x.detail || "").slice(0, 100)}`) };
}

const filas = [];
console.log("╔════ MATRIZ v2 · exigencias 1-4 del owner ════╗");
for (const c of CASOS) {
  const r = evaluar(c);
  let estado;
  if (c.espera === "PASA") estado = r.ok ? "✅ PASA" : "❌ FALSO POSITIVO";
  else if (!r.ok) {
    const correcta = c.chequeoEsperado && c.chequeoEsperado.test(String(r.verdict || ""));
    estado = correcta ? "✅ MUERE por su chequeo" : "🟠 MUERE POR LA RAZÓN EQUIVOCADA";
  } else estado = c.construido ? "🔴 SE ESCAPÓ (regresión)" : "🟡 SE ESCAPA (chequeo por construir)";
  filas.push({ ...c, chequeoEsperado: c.chequeoEsperado ? String(c.chequeoEsperado) : null, resultado: r, estado });
  console.log(`\n${estado} · ${c.id}`);
  console.log(`   afirma: ${c.afirma}`);
  console.log(`   tipo: ${c.tipo}${c.chequeoEsperado ? ` · debe morir por: ${c.chequeoEsperado}` : ""}`);
  if (!r.ok) console.log(`   murió por: ${r.verdict} → ${r.violations[0] || ""}`);
}

const pos = filas.filter((f) => f.espera === "PASA");
const neg = filas.filter((f) => f.espera === "MUERE");
const fp = pos.filter((f) => f.estado.includes("FALSO")).length;
const bien = neg.filter((f) => f.estado.includes("por su chequeo")).length;
const mal = neg.filter((f) => f.estado.includes("EQUIVOCADA")).length;
const gap = neg.filter((f) => f.estado.includes("por construir")).length;
const reg = neg.filter((f) => f.estado.includes("regresión")).length;
console.log(`\n╔════ DEFINITION OF DONE (exigencia 1) ════╗`);
console.log(`Positivos que pasan:            ${pos.length - fp}/${pos.length}  (falsos positivos: ${fp})`);
console.log(`Negativos por SU chequeo:       ${bien}/${neg.length}  (razón equivocada: ${mal} · por construir: ${gap} · regresiones: ${reg})`);
console.log(`DONE = ${pos.length}/${pos.length} pasan · ${neg.length}/${neg.length} mueren por su chequeo · suite completa verde.`);
console.log(`Exigencia 5: el camino nuevo NO se conecta hasta DONE + corrida doble de 35 preguntas que confirme mejora o empate.`);
fs.writeFileSync("_calibracion_notario.json", JSON.stringify({ fecha: "2026-08-14", version: 2, filas }, null, 2), "utf8");
console.log(`matriz completa en _calibracion_notario.json`);
