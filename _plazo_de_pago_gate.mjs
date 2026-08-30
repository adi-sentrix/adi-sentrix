/* === _plazo_de_pago_gate.mjs · EL PLAZO ES POLÍTICA, Y EL VENCIDO NO SE INVENTA (owner 2026-08-30) ======
 *
 * LA ORDEN, textual: «Plazo de pago por cliente, con un plazo general por defecto para la empresa … Si un
 * cliente no tiene plazo propio, usa el general … Mantén el vencido en raya mientras no exista plazo
 * declarado. No mostrar cero.»
 *
 * LAS TRES COSAS QUE ESTE CANDADO NO DEJA ROMPER:
 *   1. sin plazo declarado, el vencido es NULL — nunca cero, nunca un supuesto de 30 días
 *   2. el plazo del cliente pisa al general, y sin plazo propio se usa el general
 *   3. con la política a medio llenar, el total NO se hace pasar por el del negocio entero
 *
 * OFFLINE · todo determinístico sobre la planilla de ejemplo · no puede gastar. */
import { readFileSync } from "node:fs";
import { plantillaEjemplo } from "./src/ingesta/plantilla/generarPlantilla.js";
import { ingestarPlantilla } from "./src/ingesta/plantilla/ingestarPlantilla.js";
import { initTenant } from "./src/data/tenantStore.js";
import { buildMesaFlujo } from "./src/adi/sentrix/mesaFlujo.js";
import { plazoDe, hayPlazo, politicaLimpia, diasLimpios, alcanceDeLaPolitica, frasePolitica } from "./src/config/politicaCobro.js";
import { declararCobro } from "./src/ingesta/persistirCarga.server.js";
import { handleIngesta } from "./src/ingesta/handleIngesta.server.js";

let pass = 0, fail = 0;
const ok = (cond, label, detalle) => {
  if (cond) { pass++; console.log(`  ✓ ${label}`); }
  else { fail++; console.log(`  ✗ FALLO: ${label}`); if (detalle !== undefined) console.log(`      ${detalle}`); }
};

const BASE = ingestarPlantilla(Buffer.from(plantillaEjemplo()), { nombreArchivo: "v2.xlsx", fechaCarga: "2026-08-31" }).dataset;
const conPolitica = (cobro) => {
  initTenant({ ...BASE, perfil: { ...(BASE.perfil || {}), ...(cobro === undefined ? {} : { cobro }) } });
  return buildMesaFlujo("actual");
};
const fila = (M, nombre) => M.filas.find((f) => f.nombre === nombre);
const kpiVencido = (M) => M.kpis.find((k) => k.key === "vencido");

console.log("\n" + "=".repeat(100));
console.log("1 · SIN PLAZO DECLARADO · el vencido es NULL, jamás cero");
console.log("=".repeat(100));
{
  const M = conPolitica(undefined);
  ok(M.total.vencidoK === null, "⚠️ el total va en NULL, no en cero");
  ok(M.filas.every((f) => f.vencidoK === null), "…y cada fila también");
  ok(kpiVencido(M).valor === "—", `…y la cifra de arriba muestra una raya: «${kpiVencido(M).valor}»`);
  ok(!/\$0|\b0\b/.test(kpiVencido(M).valor), "⚠️ …que NO es un cero disfrazado");
  ok(M.sinPlazo === true, "la cara declara que no tiene plazo");
  ok(M.filas.every((f) => f.diasCreditoFmt === "—"), "…y ningún cliente muestra un plazo inventado");
  /* ⚠️ EL SUPUESTO CÓMODO SERÍA 30 DÍAS. Nadie lo declaró: usarlo convertiría una política del cliente en una
   * suposición nuestra, y el número saldría con toda la autoridad de un dato. */
  ok(M.filas.every((f) => f.diasCredito === null), "⚠️ y nadie cae a un plazo por defecto de 30 días");
  ok(typeof M.porQueSinVencido === "string" && M.porQueSinVencido.length > 40,
    "…y la cara trae POR QUÉ, para poder decirlo en pantalla");
}

console.log("\n" + "=".repeat(100));
console.log("2 · EL PLAZO GENERAL · lo que el owner pidió como base");
console.log("=".repeat(100));
{
  const M = conPolitica({ diasGeneral: 30 });
  ok(M.total.vencidoK !== null && M.total.vencidoK > 0, `el vencido se calcula: ${M.total.vencidoFmt}`);
  ok(M.filas.every((f) => f.diasCredito === 30), "los 30 días alcanzan a TODOS los clientes");
  ok(M.filas.every((f) => f.diasCreditoFmt === "30d"), "…y la tabla lo muestra formateado desde el módulo");
  ok(M.sinPlazo === false, "la cara ya no declara que le falta el plazo");
  ok(kpiVencido(M).ask === "¿Qué saldo tengo vencido?",
    "…y la pregunta que ofrece cambia: ya no es «¿por qué no puedo verlo?»");

  /* La cuenta tiene que ser una suma de sus filas, como todo en esta casa. */
  const suma = M.filas.reduce((s, f) => s + (f.vencidoK || 0), 0);
  ok(Math.abs(M.total.vencidoK - suma) < 0.5, `el total es la suma de las filas: ${M.total.vencidoK} vs ${suma}`);
  ok(M.total.vencidoK <= M.total.saldoK + 0.5,
    `⚠️ y el vencido NUNCA supera al pendiente: ${M.total.vencidoFmt} de ${M.total.saldoFmt}`);

  /* Un plazo más largo no puede aumentar la deuda vencida: es la comprobación de que el signo va para el lado
   * correcto. Con 365 días nada del período alcanza a vencer. */
  const largo = conPolitica({ diasGeneral: 365 });
  ok(largo.total.vencidoK < M.total.vencidoK,
    `⚠️ más plazo = menos vencido: 30d → ${M.total.vencidoFmt} · 365d → ${largo.total.vencidoFmt}`);
  ok(largo.total.vencidoK === 0 && largo.total.vencidoFmt !== null,
    "…y con 365 días el vencido es CERO DECLARADO —no una raya—: eso sí se puede afirmar");
  ok(largo.filas.every((f) => f.estado === "por_vencer" || f.estado === "al_dia"),
    `…y el estado lo dice: ${[...new Set(largo.filas.map((f) => f.estado))].join(" · ")}`);
}

console.log("\n" + "=".repeat(100));
console.log("3 · EL PLAZO DEL CLIENTE PISA AL GENERAL");
console.log("=".repeat(100));
{
  const M = conPolitica({ diasGeneral: 30, porCliente: { "Obras del Sur": 90 } });
  ok(fila(M, "Obras del Sur").diasCredito === 90, "el cliente con plazo propio usa el suyo: 90d");
  ok(fila(M, "Depósito Riachuelo").diasCredito === 30, "…y el que no tiene, cae al general: 30d");
  ok(fila(M, "Obras del Sur").vencidoK === 0, "⚠️ con 90 días, Obras del Sur no debe nada vencido —cero declarado—");
  ok(fila(M, "Depósito Riachuelo").vencidoK > 0, "…y Depósito Riachuelo sí");

  const sinOverride = conPolitica({ diasGeneral: 30 });
  ok(M.total.vencidoK < sinOverride.total.vencidoK,
    `⚠️ el override CAMBIA el resultado: ${sinOverride.total.vencidoFmt} → ${M.total.vencidoFmt}`);

  /* El nombre viene de dos teclados distintos —la pantalla y la planilla—, así que se compara normalizado. */
  const conTilde = conPolitica({ porCliente: { "deposito riachuelo": 15 } });
  ok(fila(conTilde, "Depósito Riachuelo").diasCredito === 15,
    "⚠️ «deposito riachuelo» encuentra a «Depósito Riachuelo»: sin tildes ni mayúsculas es el mismo cliente");

  /* Sin general, el cliente sin plazo propio queda en raya — no hereda el de otro. */
  ok(fila(conTilde, "Obras del Sur").vencidoK === null,
    "…y el que no tiene plazo propio ni general queda en RAYA, no en cero");
}

console.log("\n" + "=".repeat(100));
console.log("4 · LA POLÍTICA A MEDIO LLENAR SE DECLARA · un total sin su cola miente");
console.log("=".repeat(100));
{
  const M = conPolitica({ porCliente: { "Obras del Sur": 15 } });
  ok(M.total.vencidoK !== null, "hay vencido, porque un cliente sí tiene plazo");
  ok(M.completo === false, "…pero la cara NO se declara completa");
  ok(/1 de 2 clientes/.test(kpiVencido(M).pie),
    `⚠️ la cifra de arriba dice a cuántos cubre: «${kpiVencido(M).pie}»`);
  ok(/Depósito Riachuelo/.test(M.alcance),
    "⚠️ …y el alcance nombra a quién dejó afuera, con nombre y apellido —no «1 cliente»—");
  ok(M.politica && M.politica.sinPlazo.includes("Depósito Riachuelo"),
    "…y viaja la lista, para que la pantalla pueda ofrecerlo");

  const completa = conPolitica({ diasGeneral: 30, porCliente: { "Obras del Sur": 15 } });
  ok(completa.completo === true, "con el general puesto, la cara sí se declara completa");
  ok(!/de 2 clientes/.test(kpiVencido(completa).pie), `…y la cifra deja de aclarar: «${kpiVencido(completa).pie}»`);
}

console.log("\n" + "=".repeat(100));
console.log("5 · LO QUE NO SE ENTIENDE SE DESCARTA · nunca se aproxima");
console.log("=".repeat(100));
{
  ok(diasLimpios(9999) === null, "un plazo de cuatro dígitos es un error de tipeo, no una condición: se descarta");
  ok(diasLimpios(-5) === null, "…un negativo también");
  ok(diasLimpios("abc") === null, "…y un texto");
  ok(diasLimpios(0) === 0, "⚠️ pero CERO es válido: «paga contra entrega» es una política real");
  ok(diasLimpios("") === null && diasLimpios(null) === null, "…y vacío es SIN DECLARAR, distinto de cero");
  ok(diasLimpios(45.6) === 46, "un decimal se redondea: los días son enteros");

  const p = politicaLimpia({ diasGeneral: 9999, porCliente: { "A": 30, "B": -1, "": 20 } });
  ok(p.diasGeneral === null, "⚠️ un general ilegible NO se convierte en 30: queda sin declarar");
  ok(Object.keys(p.porCliente).length === 1 && p.porCliente.A === 30,
    `…y de los clientes solo sobrevive el válido: ${JSON.stringify(p.porCliente)}`);

  /* Y el que llama se entera: no se guarda a medias sin decirlo. */
  const r = await declararCobro({ tenantId: "acme", diasGeneral: 9999, env: {} });
  ok(r.declarada === false && /0 a 365/.test(r.motivo), `el servidor lo rechaza y explica: «${r.motivo}»`);
  const r2 = await declararCobro({ tenantId: "acme", porCliente: { "Obras": "cuando pueda" }, env: {} });
  ok(r2.declarada === false && /Obras/.test(r2.motivo), `…nombrando cuál: «${r2.motivo}»`);
  const r3 = await declararCobro({ env: {} });
  ok(r3.declarada === false && r3.sinBase === true, "sin empresa no se guarda, y se marca como esperado");
}

console.log("\n" + "=".repeat(100));
console.log("6 · SIGUE SIENDO POLÍTICA, NO DATO · no entra por la planilla");
console.log("=".repeat(100));
{
  const { HOJAS } = await import("./src/config/contract/plantilla.js");
  const columnas = HOJAS.flatMap((h) => h.columnas.map((c) => `${h.nombre}.${c.campo}`));
  ok(!columnas.some((c) => /plazo|diascredito|dias_credito/i.test(c)),
    "⚠️ la plantilla NO pide el plazo en ninguna columna: es una decisión, no un hecho del período");

  /* ⚠️ Y SOBREVIVE A LA CARGA DEL MES SIGUIENTE. Sin esto el usuario declara sus plazos una vez, sube el
   * archivo del mes que viene y el vencido vuelve a una raya sin que nadie haya cambiado nada. */
  const fuente = readFileSync("./src/ingesta/persistirCarga.server.js", "utf8");
  ok(/cobroAnterior/.test(fuente) && /perfil.*cobro/s.test(fuente),
    "la política se arrastra a la versión nueva al subir otra planilla");
  /* Desde el histórico acumulado (2026-08-30) lo que se guarda es `packAGuardar` — el dataset CON política más
   * los hechos por período. La garantía es la misma: nace de `datasetConPolitica`, nunca del original pelado. */
  ok(/packAGuardar = hechos \? \{ \.\.\.datasetConPolitica, hechos \} : datasetConPolitica/.test(fuente)
     && /pack: packAGuardar/.test(fuente),
    "…y es ESE dataset el que se guarda, no el original sin política");

  /* La operación existe y está cableada al mismo endpoint que ya sabe quién es el usuario. */
  const h = readFileSync("./src/ingesta/handleIngesta.server.js", "utf8");
  ok(/body\.op === "plazos"/.test(h), "la pantalla puede declararlo por `op: \"plazos\"`");
  ok(/declararCobro\(/.test(h), "…y esa operación llama al escritor de verdad");
  const sinSesion = await handleIngesta({ op: "plazos", diasGeneral: 30 }, {});
  ok(sinSesion.ok === false && /sin sesión/.test(sinSesion.motivo),
    `⚠️ sin código verificado no se declara nada: «${sinSesion.motivo}»`);
}

console.log("\n" + "=".repeat(100));
console.log("7 · LAS DOS FUENTES SIGUEN DICIENDO LO MISMO");
console.log("=".repeat(100));
{
  const { TENANT_DEMO } = await import("./src/data/tenants/demo.js");
  initTenant(TENANT_DEMO);
  const D = buildMesaFlujo("actual");
  const P = conPolitica({ diasGeneral: 30 });

  const faltan = Object.keys(D).filter((k) => !(k in P));
  ok(faltan.length === 0, `la planilla trae todas las llaves del demo${faltan.length ? ` · faltan: ${faltan.join(" · ")}` : ""}`);
  const estadosD = new Set(D.filas.map((f) => f.estado));
  const estadosP = new Set(P.filas.map((f) => f.estado));
  ok([...estadosP].every((e) => ["al_dia", "por_vencer", "vencido", "pendiente"].includes(e)),
    `⚠️ los estados son el MISMO vocabulario en las dos fuentes · demo: ${[...estadosD].join(" · ")} · planilla: ${[...estadosP].join(" · ")}`);
  ok(D.filas.every((f) => typeof f.diasCreditoFmt === "string") && P.filas.every((f) => typeof f.diasCreditoFmt === "string"),
    "…y las dos formatean el plazo en el módulo");
}

console.log("\n" + "=".repeat(100));
console.log("8 · LA PANTALLA ESCRIBE LA POLÍTICA · y no calcula ni sugiere");
console.log("=".repeat(100));
{
  const panel = readFileSync("./src/ui/SentrixPanel.jsx", "utf8");
  const i = panel.indexOf("function PlazoDePago");
  const j = panel.indexOf("function MesaFlujoCara", i);
  ok(i > 0 && j > i, "el bloque para declarar el plazo existe en la cara");
  const bloque = panel.slice(i, j);

  ok(/op: "plazos"/.test(panel), "manda la declaración al servidor por la operación `plazos`");
  ok(/access: getAccessCode\(\)/.test(panel),
    "…con el código firmado: el servidor decide de qué empresa es, no el navegador");

  /* ⚠️ CERO ARITMÉTICA EN LA VISTA, igual que en el resto de la cara: si acá apareciera una resta de fechas o
   * un cálculo de días, habría dos verdades sobre el mismo vencido y ningún gate podría revisar la segunda. */
  ok(!/getTime\(\)|Math\.round\(|\.toFixed\(|_DIA/.test(bloque),
    "no calcula vencimientos ni días: eso vive en el módulo");

  /* ⚠️ Y NO PRECARGA 30 DÍAS. Un valor sugerido en un campo vacío se acepta sin leerlo, y de ahí en adelante
   * tiene la autoridad de algo que el usuario declaró. Es la misma regla que la moneda sin opción marcada. */
  ok(!/useState\((["'`])30\1\)|value=\{general \|\| ["'`]30/.test(bloque),
    "⚠️ el campo NO viene con 30 días puesto: se sugiere en el placeholder, no se declara por el usuario");
  ok(/placeholder="30"/.test(bloque), "…y el 30 aparece como ejemplo, que es lo que el owner pidió");

  /* Lo que falta se dice al lado del campo que lo arregla, con la frase del módulo. */
  ok(/F\.porQueSinVencido/.test(bloque), "muestra la razón que redacta el módulo, sin reescribirla");
  ok(/r\.cobro/.test(panel),
    "⚠️ y re-arma la cara con lo que la BASE confirmó, no con lo que el usuario tipeó");
  ok(/setPlazoTick/.test(panel), "…y vuelve a construir la cara para que el vencido aparezca al instante");
}

console.log(`\n── _plazo_de_pago_gate: ${pass} PASS · ${fail} FAIL (de ${pass + fail}) ──`);
process.exit(fail === 0 ? 0 : 1);
