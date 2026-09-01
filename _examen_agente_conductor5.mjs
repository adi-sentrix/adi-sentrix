/* === _examen_agente_conductor5.mjs · LOS TRES ESCENARIOS DE CERTIFICACIÓN (2026-09-01) ======================
 *
 * El owner autorizó **US$0.56 típico · techo US$1.68** para los 28 turnos: demo (8) · planilla COMPLETA (12) ·
 * planilla PARCIAL (8). Este archivo los corre; no decide nada.
 *
 * EL FRENO, QUE ES LA RAZÓN DE QUE ESTO SEA UN ARCHIVO Y NO TRES COMANDOS SUELTOS:
 * se frena ANTES de arrancar cada turno, reservando el PEOR turno jamás medido (US$0.2534, corrida 2 t19 —
 * un turno que cae en el ciclo de reparación cuesta 10× uno normal). Si lo que queda no paga un turno del peor
 * caso, no se arranca. El techo deja de poder superarse por diseño y no por suerte: en la corrida 3 el corte
 * miraba ENTRE turnos y se pasó a US$1.0645 sobre un techo de US$1.00.
 *
 * ⚠️ EL GASTO SE ACUMULA ENTRE ESCENARIOS. Cada escenario arranca con `--reset`, que pone `costoUSD` en cero;
 * el techo autorizado es de los TRES juntos, así que el acumulado real es `gastadoPrevio + estado.costoUSD`.
 * Leer solo el estado del escenario en curso permitiría gastar el techo tres veces.
 *
 *   node _examen_agente_conductor5.mjs            → los tres, en orden
 *   node _examen_agente_conductor5.mjs --solo 1   → un escenario (el 1 es la puerta: si sus binarios caen, no
 *                                                   se gasta en los otros dos)
 *
 * NO SE CORRE SIN LA PALABRA DEL OWNER QUE NOMBRE EL GASTO.
 */
import fs from "node:fs";
import { execFileSync } from "node:child_process";

const TECHO = 1.68;      // el autorizado por el owner para los tres escenarios
const RESERVA = 0.26;    // el peor turno jamás medido (US$0.2534), redondeado hacia arriba
/* ⚠️ LO YA GASTADO DE ESTA AUTORIZACIÓN, DECLARADO. El 2026-09-01, verificando que el agente estuviera listo,
 * `--planilla <ruta> --sello` corrió un turno completo con la ruta como pregunta (defecto del parser de la
 * consola, ya arreglado) y costó US$0.0748. Ese gasto salió del mismo permiso del owner, así que se descuenta
 * del techo: si no se descontara, el techo autorizado se superaría por esa diferencia y el freno sería una
 * cuenta que no cierra. Un gasto que no se cuenta es exactamente el que se repite. */
const GASTADO_ANTES = 0.0748;
const ESTADO = "_examen_agente_estado.json";
const LOG = "_examen_agente_certificacion_run.log";
const SOLO = (() => { const i = process.argv.indexOf("--solo"); return i > 0 ? process.argv[i + 1] : null; })();

const P = "C:/Users/jcnav/Downloads/Plantilla_ADI_v2_";
const COMPLETA = `${P}completa_25_clientes_ajustada.xlsx`;
const PARCIAL = `${P}parcial_10_clientes_ajustada.xlsx`;

/* Los turnos salen de `_EXAMEN_AGENTE_PROTOCOLO.md`, con los nombres REALES de cada archivo. Cada uno lleva su
 * PASS escrito: el veredicto se lee contra el texto, no contra la impresión que deje la respuesta. */
const ESCENARIOS = [
  {
    id: "1", nombre: "DEMO · la confirmación de los cuatro arreglos", planilla: null,
    titulo: "Certificación · 1 demo",
    turnos: [
      { q: "llamame jc de ahora en adelante. como viene mi margen?", tipo: "regresión", pass: "playbook Margen en Riesgo con sus cifras + abre con «jc:» o «jc,» + registro ejecutivo" },
      { q: "ponele que el año que viene crezco 3%: cuanto seria mi venta?", tipo: "CAMBIO · P1", pass: "proyecta sobre la venta TOTAL del negocio y lo dice; NO pregunta «¿global o por cliente?»" },
      { q: "Dime cuáles son los clientes que venden mucho pero están bajo el benchmark", tipo: "regresión", pass: "tabla con cifras verbatim, registro ejecutivo" },
      { q: "Con ese total anual, proyecta 12 meses con +4% y dime cuánto genera adicional.", tipo: "CAMBIO · P1", pass: "proyecta sobre el total ya nombrado en el hilo; NO vuelve a pedir la entidad" },
      { q: "Sobre esos clientes, simula reducir 2 puntos porcentuales las acciones comerciales y dime si alguno queda sobre el benchmark.", tipo: "CAMBIO · P2", pass: "aclara SIN ejemplo numérico sobre una entidad real, o repara y entrega; NO sale vacío" },
      { q: "Compara Q1 vs Q2 en ventas, margen y contribución. Si no está en la carpeta, dilo.", tipo: "regresión", pass: "nombra lo que SÍ tiene y ofrece; NO «no tengo información autorizada suficiente»" },
      { q: "Dame una versión más dura, como si tuviera que presentarla al gerente general.", tipo: "CAMBIO · B", pass: "reformula con lo del hilo, sin salir a leer y sin la frase de molde" },
      { q: "cuanto me compro falabella el ultimo mes", tipo: "regresión", pass: "una o dos líneas con la razón verdadera y la puerta a la ficha" },
    ],
  },
  {
    id: "2", nombre: "COMPLETA · el techo del producto", planilla: COMPLETA,
    titulo: "Certificación · 2 planilla completa",
    turnos: [
      { q: "cuánto me compró Mercado Norte el último mes", tipo: "INSIGNIA", pass: "la cifra del mes CON su nombre y el delta contra el anterior — el demo declinaba acá" },
      { q: "muéstrame la venta de Mercado Norte mes a mes", tipo: "INSIGNIA", pass: "los 6 meses con sus cifras verbatim (2026-03 a 2026-08)" },
      { q: "ranking por canal: mejores y peores", tipo: "eje nuevo", pass: "usa los 7 canales REALES del archivo" },
      /* ⚠️ CRITERIO CORREGIDO POR EL SUPERVISOR (2026-09-01). El protocolo pedía «responde por punto de venta»,
       * y eso NO PUEDE aprobar: el contrato de la plantilla declara que el campo se CAPTURA pero ADI todavía no
       * analiza por él (decisión del owner 2026-08-26, `plantilla.js:126`). Un turno cuyo PASS es imposible por
       * diseño mide el protocolo, no el producto. Lo que sí se mide acá es la honestidad. */
      { q: "por punto de venta, ¿quién queda bajo el plan?", tipo: "límite honesto", pass: "dice que el archivo TRAE punto de venta pero que todavía no analiza por ese eje, y ofrece lo que sí tiene · FAIL: inventa el corte, o lo confunde con cliente/bodega, o se disculpa sin nombrarlo" },
      { q: "qué marca deja más margen", tipo: "eje nuevo", pass: "ranking por marca con cifras (Kolbe, Nordix, Vulcano, Auren, Nexo, LineaPro…)" },
      { q: "margen por familia", tipo: "eje nuevo", pass: "ranking por familia con cifras (Herramientas, Sanitarios, Electrico, Pinturas, Seguridad…)" },
      { q: "capital por bodega", tipo: "eje nuevo", pass: "capital por las 4 bodegas (Central, Norte, Sur, CD Santiago) sin mezclar con venta" },
      /* ⚠️ CRITERIO CORREGIDO. El archivo NO declara plazo de pago (es política de la app, no columna), así que
       * el vencido es incalculable POR DISEÑO y la mesa lo muestra «—· sin plazo de pago declarado». Exigir
       * «vencido con cifras» sería exigir el cero que el owner prohibió mostrar. */
      { q: "quién me debe y qué está vencido", tipo: "Abonos", pass: "deuda con cifras de la hoja Abonos (saldo ≈$118.8M sobre venta a crédito ≈$266.5M) Y declara que el vencido no se puede calcular sin plazo declarado · FAIL: muestra vencido en $0, o declina teniendo la hoja" },
      { q: "cuánto vendí a crédito vs contado", tipo: "columna condición", pass: "usa la columna condición (contado / credito) con cifras" },
      { q: "llamame jc. ¿cómo viene mi margen?", tipo: "regresión", pass: "playbook sobre SUS clientes + trato + registro ejecutivo" },
      { q: "dame los 3 riesgos para el directorio", tipo: "regresión", pass: "tres riesgos con cifras de SU negocio, no un molde" },
      { q: "compará Q1 vs Q2", tipo: "límite honesto", pass: "límite corto CON la alternativa nombrada (tiene 6 meses, no trimestres declarados)" },
    ],
  },
  {
    id: "3", nombre: "PARCIAL · la conducta con dato incompleto", planilla: PARCIAL,
    titulo: "Certificación · 3 planilla parcial",
    turnos: [
      { q: "quién me debe y qué está vencido", tipo: "nombra la pieza", pass: "«tu archivo no trae la hoja Abonos: con eso te abro…» · FAIL: disculpa genérica o vacío" },
      { q: "ranking por canal", tipo: "nombra la pieza", pass: "nombra la columna «canal» de Ventas" },
      { q: "cuánto vendí a crédito", tipo: "nombra la pieza", pass: "nombra la columna «condición» de Ventas" },
      { q: "mejores y peores puntos de venta", tipo: "nombra la pieza", pass: "nombra la columna «punto de venta» de Ventas" },
      { q: "capital por bodega", tipo: "nombra la pieza", pass: "nombra la columna «bodega» de Inventario · FAIL: inventa el corte" },
      { q: "¿cómo viene mi margen?", tipo: "NO-DEGRADACIÓN", pass: "funciona igual que con la completa — el dato incompleto no empeora lo que sí trae" },
      { q: "qué SKU tienen capital frenado", tipo: "NO-DEGRADACIÓN", pass: "responde por SKU con cifras (trae 12 filas de inventario)" },
      { q: "cuánto me compró Easy el último mes", tipo: "NO-DEGRADACIÓN", pass: "responde con la serie (las 7 obligatorias la sostienen)" },
    ],
  },
];

const log = (s) => { fs.appendFileSync(LOG, s + "\n"); console.log(s); };
const consola = (args) => execFileSync("node", ["_consola_examen.mjs", "--agente", ...args], { encoding: "utf8", timeout: 240000 });
const leerCosto = () => { try { return JSON.parse(fs.readFileSync(ESTADO, "utf8")).costoUSD || 0; } catch { return null; } };

const aCorrer = SOLO ? ESCENARIOS.filter((e) => e.id === SOLO) : ESCENARIOS;
const total = aCorrer.reduce((n, e) => n + e.turnos.length, 0);
fs.writeFileSync(LOG, `CERTIFICACIÓN DEL AGENTE · ${aCorrer.length} escenario(s) · ${total} turnos\n` +
  `techo autorizado US$${TECHO} · reserva por turno US$${RESERVA} (el peor turno jamás medido)\n\n`);

let gastadoPrevio = GASTADO_ANTES, frenado = false;
for (const esc of aCorrer) {
  if (frenado) break;
  log(`\n${"═".repeat(92)}\n███ ESCENARIO ${esc.id} · ${esc.nombre}\n${"═".repeat(92)}`);
  const base = esc.planilla ? ["--planilla", esc.planilla] : [];
  if (esc.planilla && !fs.existsSync(esc.planilla)) { log(`✗ no encuentro la planilla: ${esc.planilla}`); break; }
  log(consola([...base, "--reset", "--titulo", esc.titulo]));
  log(consola([...base, "--sello"]));

  for (const [i, t] of esc.turnos.entries()) {
    const acum = gastadoPrevio + (leerCosto() || 0);
    if (acum + RESERVA > TECHO) {
      log(`\n■ FRENO PREVENTIVO: acumulado US$${acum.toFixed(4)} + reserva US$${RESERVA} > techo US$${TECHO}.`);
      log(`   No se arranca el turno ${i + 1}/${esc.turnos.length} del escenario ${esc.id} — el techo NO se supera.`);
      frenado = true; break;
    }
    log(`\n────── ESCENARIO ${esc.id} · TURNO ${i + 1}/${esc.turnos.length} · ${t.tipo} ──────`);
    log(`» ${t.q}`);
    log(`  PASS: ${t.pass}`);
    try { log(consola([...base, "--frenar-en-vacia", t.q])); }
    catch (e) { log(`✗ TURNO CON ERROR: ${String(e.message || e).slice(0, 300)}`); log(String(e.stdout || "").slice(-900)); }
    const c = leerCosto();
    if (c === null) { log("   [estado ilegible — freno por precaución]"); frenado = true; break; }
    log(`   [escenario: US$${c.toFixed(4)} · TOTAL: US$${(gastadoPrevio + c).toFixed(4)} de US$${TECHO}]`);
  }

  const cFinal = leerCosto() || 0;
  gastadoPrevio += cFinal;
  const archivo = `_examen_agente_estado_escenario${esc.id}.json`;
  try { fs.copyFileSync(ESTADO, archivo); log(`\n  · expediente del escenario ${esc.id} guardado en ${archivo} (US$${cFinal.toFixed(4)})`); } catch {}
}
log(`\n${"═".repeat(92)}\n══ FIN · costo total US$${gastadoPrevio.toFixed(4)} de US$${TECHO} autorizados ══\n${"═".repeat(92)}`);
