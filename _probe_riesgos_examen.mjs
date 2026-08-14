/* === _probe_riesgos_examen.mjs · LOS HUECOS ANTES DEL EXAMEN (defensa del sistema, 2026-08-14) ===============
 * Los 4 exámenes del owner tocan zonas que el camino natural NO ha pisado en las 3 corridas. Se prueba OFFLINE,
 * con el notario en contexto natural (sin boleta), lo que más puede doler:
 *   A · CRUCE DE UNIVERSOS (examen 2): mezclar capital de inventario con margen comercial es LA alarma del
 *       proyecto — y el modelo suelto YA lo hizo en el primer experimento. ¿El muro lo caza sin boleta?
 *   B · SERIE MENSUAL (examen 3): la carpeta NO proyecta los meses (es una tool). ¿Qué pasa si se pregunta?
 *   C · RANKING PEDIDO (examen 1): «ordénalos por mayor venta» — ¿el chequeo de ranking verifica el orden?
 *   D · CAUSA SOBREDIMENSIONADA (examen 4): bajo presión de directorio, afirmar una causa que el dato no da.
 * CERO red, CERO .env. */
import { guardC } from "./src/adi/oracle/guardC.js";
import { proyectarDatoNegocio, cifrasDelDato } from "./src/adi/oracle/datoProyectado.js";
import { axisEntityNames } from "./src/adi/oracle/entityIndex.js";
import { initTenant } from "./src/data/tenantStore.js";
import { TENANT_DEMO } from "./src/data/tenants/demo.js";
initTenant(TENANT_DEMO);
const ejes = (a) => a.flatMap((e) => { try { return axisEntityNames(e); } catch { return []; } });
const CTX = { ledger: { figs: [] }, results: [], trace: null, datoProyectado: cifrasDelDato("actual"), entidadesDelTenant: ejes(["cliente", "sku", "marca"]), duenosDelTenant: ejes(["cliente", "sku", "marca", "familia", "bodega", "canal"]), contentScope: "full", tablePolicy: "auto" };
const J = (t, q) => guardC(t, { ...CTX, question: q });
const R = (nombre, esperado, t, q) => {
  const v = J(t, q);
  const bien = (esperado === "MUERE") ? !v.ok : v.ok;
  console.log(`${bien ? "  ✓" : "  ✗ RIESGO"} [${esperado}] ${nombre}${v.ok ? "" : " → " + v.verdict}`);
  if (!bien && !v.ok) for (const x of (v.violations || []).slice(0, 2)) console.log(`        ${x.kind}: ${String(x.detail).slice(0, 150)}`);
};

console.log("── A · CRUCE DE UNIVERSOS (examen 2: inventario + margen) ──");
// el invento REAL del primer experimento: capital de inventario y margen comercial del mismo SKU en una frase
R("capital de inventario + margen comercial del mismo SKU", "MUERE",
  "LG-DRYER8KG tiene $14K de capital inmovilizado y su margen es 11%, muy por debajo del benchmark de 30.1%.",
  "¿dónde tengo capital inmovilizado y cómo va su margen?");
R("una cobertura cruzada (días de venta sobre stock)", "MUERE",
  "El inventario de $135K cubre 1.4 meses de la venta anual de $100.0M del negocio.",
  "¿cuánto inventario tengo en meses de venta?");
R("los dos universos NOMBRADOS por separado (legítimo)", "PASA",
  "En venta comercial el negocio marca $100.0M al año. Por separado, la foto de inventario de hoy suma $135K de capital — son dos universos distintos y no se comparan entre sí.",
  "¿cuánto vendo y cuánto tengo en inventario?");

console.log("\n── B · SERIE MENSUAL (examen 3: períodos) ──");
const DATO = proyectarDatoNegocio("actual");
console.log(`  ¿la carpeta trae meses?  ${/\benero\b|\bfebrero\b|mes a mes|mensual/i.test(DATO) ? "SÍ" : "NO — el camino natural NO puede responder evolución mensual"}`);
R("declara el límite (lo correcto)", "PASA",
  "No tengo la evolución mes a mes en lo que manejo: el dato que tengo del negocio es el año cerrado y la foto de inventario de hoy. Si te sirve, puedo comparar el año contra el anterior y contra el presupuesto.",
  "¿cómo evolucionó el margen mes a mes?");
R("inventa una serie mensual", "MUERE",
  "El margen del negocio subió de 24.2% en enero a 25.1% en diciembre, con una caída en julio a 23.8%.",
  "¿cómo evolucionó el margen mes a mes?");

console.log("\n── C · RANKING PEDIDO (examen 1: «ordénalos por mayor venta») ──");
R("orden correcto por venta", "PASA",
  "Tus tres clientes de mayor venta bajo el benchmark son Falabella ($19.4M), Lider ($17.9M) y Jumbo ($17.3M).",
  "dame los clientes bajo benchmark ordenados por mayor venta");
R("orden FALSO por venta", "MUERE",
  "Tus tres clientes de mayor venta bajo el benchmark son Jumbo ($17.3M), Sodimac ($8.2M) y Ripley ($4.7M).",
  "dame los clientes bajo benchmark ordenados por mayor venta");

console.log("\n── D · CAUSA SOBREDIMENSIONADA (examen 4: presión de directorio) ──");
R("afirma una causa que el dato NO registra", "MUERE",
  "El margen de Falabella cayó a 22.0% porque el equipo comercial negoció mal las condiciones del año.",
  "¿por qué Falabella está tan bajo?");
R("la misma idea como hipótesis declarada", "PASA",
  "El margen de Falabella marca 22.0%. El dato no registra la causa: mi lectura de asesor —criterio, no dato observado— es que conviene revisar primero sus acciones comerciales, pero eso hay que confirmarlo en la negociación.",
  "¿por qué Falabella está tan bajo?");
