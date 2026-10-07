/* === _derivar_gate.mjs · LA QUINTA ACCIÓN: `derivar` (Contrato del Anfitrión · owner 2026-10-05, offline) ═══════════════════════════════════════════════════════
 * Frontera del tercer contrato (Ingesta · Entrega · Anfitrión): «el LLM puede comprender, conversar y redactar libremente, pero NO puede crear nueva verdad empresarial; si necesita una cifra, total, porcentaje, conteo
 * o diferencia que ADI no le entregó, debe volver a ADI». La vía directa y barata: una DERIVACIÓN (suma · diferencia · participación · conteo) sobre ids `E<n>.h<k>` ya entregados, calculada por ADI con los CRUDOS del libro y
 * devuelta como un hecho nuevo `D<k>` (procedencia «derivado»). Diseño: `_ADI_DISENO_CONTRATO_ANFITRION.md` §2 y §7 (pasos 1–6).
 *
 * LO QUE ESTE GATE EXIGE (cada punto con su carnada, sobre el demo Y la empresa no-demo del arnés):
 *   1 · la suma de tres ventas es la suma EXACTA de los crudos (oráculo: el Core, aparte), `D1`, texto de la casa, procedencia «derivado»; la suma de las 13 es el crudo del «total del listado»; una participación sobre
 *       el total, el conteo `> 0` y `= 0` de los 13 saldos vencidos (con los ids que cumplen), la diferencia de dos % en `pp` y la de dos $ con signo; las cifras de `fueraDelTexto` ya traen id (§8.2);
 *   2 · cada código de rechazo de la tabla §2.3 con su pedido (y `promedio` NO existe);
 *   3 · idempotencia: el mismo pedido devuelve la derivación y el libro queda byte a byte igual; otra conversación → `id_inexistente`; otra empresa → `conversacion_inexistente` / `otra_empresa`;
 *   4 · `retomar`: `igual` · `cambio` (recalculado con los crudos de hoy) · `no_se_revalida` si un operando ya no existe; un hilo sin derivaciones queda idéntico;
 *   5 · falla cerrado: si GUARDAR falla → `memoria:"no_disponible"` y el libro sin la derivación; el id no se consume;
 *   6 · estático: `derivar.js` y la rama `derivar` de `acciones.js` no importan nada de `entrega/` ni `encargo/`, ni llaman `conTenantActivo`;
 *   7 · la puerta: `tools/list` con 5, REST `derivar`, OpenAPI con 5 rutas; la cabecera de uso de cuatro reglas;
 *   8 · el libro de 16 KB con el caso más grande del demo (se MIDE y se informa: las derivaciones compiten con las Entregas por esos 16 KB);
 *  11 · ENSAYO 4 (owner 2026-10-07): un `D<k>` es operando (de `sobre`, `base` y la cifra de un conteo) con su linaje; la participación suma VARIOS numeradores; cada rechazo nuevo con su pedido; `retomar` revalida en
 *       cascada (y un libro adulterado con un ciclo no cuelga); la herramienta lo dice sin crecer.
 * CERO llamadas a un LLM · CERO red. Solo por `npm run gates:offline` o `node --import ./scripts/offline-guard.mjs _derivar_gate.mjs`. */
import fs from "node:fs";
import { initTenant } from "./src/data/tenantStore.js";
import { TENANT_DEMO } from "./src/data/tenants/demo.js";
import { validarEncargo } from "./src/adi/encargo/validar.js";
import { componerEntrega } from "./src/adi/entrega/componer.js";
import { crearAcciones, CABECERA_DE_USO } from "./src/adi/capacidad/acciones.js";
import { conTenantActivo } from "./src/adi/capacidad/aislamiento.js";
import { compactarParaAnfitrion, ENTIDADES_DE_UN_UNIVERSO_MAX } from "./src/adi/capacidad/compacto.js";
import { OPERACIONES, OPERANDOS_MAX, MOTIVOS_DE_DERIVACION } from "./src/adi/capacidad/derivar.js";
import { manejarPuerta, MCP_TOOLS, construirOpenApi } from "./src/adi/capacidad/puerta.js";
import { crearAlmacenEnMemoria, ErrorDeAlmacen } from "./src/adi/continuidad/almacen.js";
import { LIBRO_TOPE_BYTES, tamanoBytes } from "./src/adi/continuidad/libro.js";
import { cifraDeHecho } from "./src/adi/continuidad/revalidar.js";
import { formatoDeLaCasa } from "./src/adi/notario/hechos.js";
import { makeAccessCode } from "./src/adi/llm/accessToken.js";
import { clasificarFuente } from "./scripts/clasificarGates.mjs";
import { packRenombrado } from "./scripts/medicion-anfitrion/empresa-no-demo.mjs";

let pass = 0, fail = 0;
const ok = (c, m, extra = "") => { if (c) { pass++; } else { fail++; console.log("  ✗ " + m + (extra ? "\n      " + String(extra).slice(0, 900) : "")); } };
const H = (t) => console.log(`\n${t}`);
const clon = (x) => JSON.parse(JSON.stringify(x));
const jj = (x) => JSON.stringify(x);
const sinComentarios = (src) => String(src).replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`\\])\/\/[^\n]*/g, "$1");
const E = (partes, conv = null) => ({ version: "encargo/v1", ...(conv ? { conversacionId: conv } : {}), partes });
const PARTE = (conceptos, tema = "comercial") => ({ id: "p1", tema, cierre: "cifra", conceptos, eje: "cliente" });

const PACK = packRenombrado({ version: 1 });
const EMPRESAS = [
  { etiqueta: "demo", T: { id: "demo", nombre: "ADI Demo", dataset: TENANT_DEMO, version: 1, sello: null } },
  { etiqueta: "no-demo", T: { id: "rioclaro", nombre: "Distribuidora Río Claro", dataset: PACK, version: 1, sello: null } },
];
const conTenant = (T) => initTenant(T.dataset);

/* el ORÁCULO: los crudos directo del Core (no por el libro de la conversación ni por `derivar`) */
function crudosDelCore(T, encargo) {
  const out = new Map();
  conTenantActivo(T.dataset, () => {
    const s = componerEntrega(validarEncargo(encargo, {}));
    if (s.ok) for (const h of s.entrega.procedencia.libro.hechos) { const c = cifraDeHecho(h); if (c && c.raw != null && c.clave) out.set(`${c.clave}|${String(c.dueno).toLowerCase()}`, c.raw); }
  });
  return out;
}
const rawDe = (mapa, clave, entidad) => mapa.get(`${clave}|${String(entidad).toLowerCase()}`);

const todas = (c) => [...c.entrega.cifras, ...(((c.entrega.detalle || {}).fueraDelTexto) || [])];
const delMetrica = (c, metrica) => todas(c).filter((x) => x.entidad && x.metrica === metrica);
const totalDe = (c, metrica) => c.entrega.cifras.find((x) => new RegExp(`^${metrica} · total del listado completo`).test(x.metrica || ""));

/* UN HILO = una conversación con ADI: cada paso es una consulta (E1, E2…). El libro de una conversación pesa 16 KB como máximo (migración 015): con tres Entregas completas la más vieja se recorta —ya pasaba antes de este contrato— y
 * cada derivación suma al libro; por eso los hilos de prueba son DOS cortos (ventas+margen · saldos) y el tope se mide aparte (sección 10). `acotar` = cuántos clientes del eje (los primeros de las ventas). */
async function hilo(T, pasos, { store = crearAlmacenEnMemoria(), reloj = () => "2026-10-05T12:00:00.000Z" } = {}) {
  conTenant(T);
  const A = crearAcciones({ continuidad: store, ahora: reloj });
  let conv = null, nombres = null;
  const out = {};
  for (const [k, conceptos, tema, acotar] of pasos) {
    const parte = acotar ? { ...PARTE(conceptos, tema), eje: undefined, entidades: nombres.slice(0, acotar).map((nombre) => ({ nombre })) } : PARTE(conceptos, tema);
    const r = await A.consultar({ tenant: T, encargo: E([parte], conv) });
    conv = r.continuidad.conversacionId;
    out[k] = compactarParaAnfitrion("consultar", r);
    if (!nombres) nombres = todas(out[k]).filter((x) => x.entidad).map((x) => x.entidad).filter((v, i, a) => a.indexOf(v) === i);
  }
  return { A, store, conv, ...out };
}
const PASOS_COMERCIAL = [["ventas", ["ventas"], "comercial"], ["margen", ["margen"], "comercial", 4]];
const PASOS_SALDOS = [["saldos", ["saldo_vencido", "saldo_pendiente"], "cobranza"]];
const derivar = (h, pedido, T) => h.A.derivar({ tenant: T, conversacionId: h.conv, ...pedido });
const noDeriva = async (h, T, nombre, pedido, motivo) => {
  const r = await derivar(h, pedido, T);
  ok(r.ok === false && r.motivo === motivo && typeof r.detalle === "string" && r.detalle.length > 10 && Array.isArray(r.uso), `★ ${nombre}: se rechaza con «${motivo}», una frase de negocio y la cabecera de uso`, jj(r).slice(0, 400));
  ok(MOTIVOS_DE_DERIVACION.includes(r.motivo), `${nombre}: el código está en la lista cerrada`);
  return r;
};

/* ═══ 0 · LO CERRADO ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════ */
H("0 · lo cerrado: cuatro operaciones (sin promedio), la cabecera de cuatro reglas, el tope de operandos");
{
  ok(jj(OPERACIONES) === jj(["suma", "diferencia", "participacion", "conteo"]), "★ las operaciones son EXACTAMENTE suma · diferencia · participacion · conteo (sin `promedio`, §8.3)");
  ok(OPERANDOS_MAX === 40 && OPERANDOS_MAX === ENTIDADES_DE_UN_UNIVERSO_MAX, "el tope de operandos es lo que un universo lista a la vista (40)");
  ok(CABECERA_DE_USO.length === 4, "★ la cabecera de uso tiene CUATRO reglas");
  ok(CABECERA_DE_USO[0] === "Toda cifra empresarial que usted diga —en números o en palabras, incluidos totales, diferencias, porcentajes y conteos— debe ser un hecho que ADI le entregó en esta conversación. Si la cifra que necesita no está entre lo entregado, no la calcule ni la complete: pídasela a ADI (derivar, sobre identificadores ya entregados; o una consulta nueva). Redondear a lo impreso no es calcular.", "★ la regla 1 es el texto EXACTO del contrato (sin «con su identificador»)");
  ok(!/con su identificador/.test(jj(CABECERA_DE_USO)) && !/promedios? de más de dos cifras/.test(jj(CABECERA_DE_USO)), "las dos reglas viejas (1/5 y 2/5) ya no están");
  ok(/^Lo que la Entrega declara en «Lo que no se puede concluir» se respeta/.test(CABECERA_DE_USO[1]) && /^La «Referencia del oficio» es conocimiento general/.test(CABECERA_DE_USO[2]) && /^Redacte con total libertad/.test(CABECERA_DE_USO[3]), "las otras tres reglas siguen, en su orden");
}

/* ═══ 1-7 · POR EMPRESA ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════ */
for (const { etiqueta, T } of EMPRESAS) {
  H(`── ${etiqueta} ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────`);
  const h = await hilo(T, PASOS_COMERCIAL);       // E1 ventas (13 + total) · E2 margen de 4 clientes
  const hs = await hilo(T, PASOS_SALDOS);         // E1 saldos vencido y pendiente (13 + 13 + 2 totales; 2 cifras de `fueraDelTexto`)
  const libroDe = () => h.store.leerLibro(T.id, h.conv);
  const oVentas = crudosDelCore(T, E([PARTE(["ventas"], "comercial")]));
  const oSaldos = crudosDelCore(T, E([PARTE(["saldo_vencido", "saldo_pendiente"], "cobranza")]));
  const oMargen = crudosDelCore(T, E([PARTE(["margen"], "comercial")]));
  const ventas = delMetrica(h.ventas, "Venta"), totalVentas = totalDe(h.ventas, "Venta"), margenes = delMetrica(h.margen, "Margen");
  const vencidos = delMetrica(hs.saldos, "Saldo vencido"), pendientes = delMetrica(hs.saldos, "Saldo pendiente");

  H(`1 · las cifras del hilo y las de «fuera del texto» con id (${etiqueta})`);
  ok(ventas.length === 13 && totalVentas && vencidos.length === 13 && pendientes.length === 13 && margenes.length === 4, "los hilos traen 13 ventas con su total, 13 saldos vencidos, 13 pendientes y 4 márgenes (contando las de `fueraDelTexto`)", jj([ventas.length, !!totalVentas, vencidos.length, pendientes.length, margenes.length]));
  const idsFuera = (((hs.saldos.entrega.detalle || {}).fueraDelTexto) || []).map((x) => x.id);
  const ultimoDeLaTabla = Math.max(...hs.saldos.entrega.cifras.map((x) => Number(/\.h(\d+)/.exec(x.id)[1])));
  ok(idsFuera.length > 0 && idsFuera.every((id) => /^E1\.h\d+$/.test(id)), "★ las cifras de `fueraDelTexto` ya traen su id `E<n>.h<k>` (§8.2)", jj(idsFuera));
  ok(idsFuera.every((id) => Number(/\.h(\d+)/.exec(id)[1]) > ultimoDeLaTabla) && jj(hs.saldos.entrega.cifras.map((x) => x.id)) === jj(hs.saldos.entrega.cifras.map((_, i) => `E1.h${i + 1}`)), "★ van DESPUÉS de las filas y los totales: ningún id existente se movió", jj([idsFuera, ultimoDeLaTabla]));
  const libS = await hs.store.leerLibro(T.id, hs.conv);
  const fueraEnLibro = libS.entregas[0].hechos.filter((x) => x.fuera);
  ok(fueraEnLibro.length === idsFuera.length && fueraEnLibro.every((x) => idsFuera.includes(x.id) && x.rv && Number.isFinite(x.rv.raw)), "están en el libro de la conversación, con su `rv` (crudo y llave): se pueden derivar y retomar");
  const est = await hs.A.conocerEmpresa({ tenant: T, conversacionId: hs.conv });
  ok(!idsFuera.some((id) => jj(est.estadoVigente).includes(id)) && jj(est.estadoVigente).includes(`E1.h1–E1.h${ultimoDeLaTabla}`), "el rango de ids del estado vigente sigue siendo el de la tabla (no se mueve con `fueraDelTexto`)", jj(est.estadoVigente).slice(0, 300));

  H(`2 · suma: tres ventas = la suma exacta de los crudos (${etiqueta})`);
  {
    const tres = ventas.slice(0, 3);
    const suma = tres.reduce((a, x) => a + rawDe(oVentas, "ventas", x.entidad), 0);
    const L0 = clon(await libroDe());
    const r = await derivar(h, { operacion: "suma", sobre: tres.map((x) => x.id) }, T);
    ok(r.ok === true && r.hecho.id === "D1" && r.hecho.procedencia === "derivado" && r.hecho.operacion === "suma" && r.repetida === false, "★ la suma de 3 ventas es `D1`, procedencia «derivado», no repetida", jj(r).slice(0, 500));
    ok(r.hecho.valor === formatoDeLaCasa(suma, "money"), `★ el valor es el de la casa sobre la SUMA DE LOS CRUDOS (${formatoDeLaCasa(suma, "money")})`, r.hecho && r.hecho.valor);
    ok(jj(r.hecho.sobre) === jj(tres.map((x) => x.id)) && r.operandos.length === 3 && r.operandos.every((o, i) => o.id === tres[i].id && o.valor === tres[i].valor && o.entidad === tres[i].entidad), "los operandos viajan con su id, entidad y valor tal como se entregaron");
    ok(r.hecho.entidad === tres.map((x) => x.entidad).join(" + ") && r.hecho.metrica === "Venta · suma de 3 cifras entregadas", "la entidad nombra a los tres y la métrica dice qué es", jj(r.hecho));
    ok(jj(r.uso) === jj(CABECERA_DE_USO) && r.continuidad.guardada === true && r.continuidad.conversacionId === h.conv, "trae la cabecera de uso y la continuidad");
    const L1 = await libroDe();
    ok(L1.derivaciones.length === 1 && L1.derivaciones[0].id === "D1" && L1.derivaciones[0].resultado.raw === suma && L1.nDerivaciones === 1, "★ la derivación quedó en el libro con su crudo exacto");
    ok(jj(L1.entregas) === jj(L0.entregas) && L1.turno === L0.turno, "★ ninguna Entrega ni id `E<n>.h<k>` se movió (derivar no consume los cupos de Entregas)");
    /* «verificado no es exacto»: entre los pares de ventas, uno donde la suma de lo IMPRESO difiere de la de los crudos */
    const imp = (t) => Number(String(t).replace(/[^0-9.]/g, ""));
    let par = null;
    for (let i = 0; i < ventas.length && !par; i++) for (let j = i + 1; j < ventas.length && !par; j++) { const sCrudo = rawDe(oVentas, "ventas", ventas[i].entidad) + rawDe(oVentas, "ventas", ventas[j].entidad); if (Math.abs(imp(ventas[i].valor) + imp(ventas[j].valor) - imp(formatoDeLaCasa(sCrudo, "money"))) > 0.05) par = [ventas[i], ventas[j], sCrudo]; }
    if (par) { const r2 = await derivar(h, { operacion: "suma", sobre: [par[0].id, par[1].id] }, T); ok(r2.ok && r2.hecho.valor === formatoDeLaCasa(par[2], "money"), `★ si la suma de lo impreso (${par[0].valor} + ${par[1].valor}) difiere de la de los crudos, manda la de ADI (${formatoDeLaCasa(par[2], "money")})`, jj(r2.hecho)); }
    else console.log("   · (no hay un par de ventas donde lo impreso y los crudos difieran: se omite la prueba de «redondear no es calcular» en este dato)");
  }

  H(`2b · suma de las 13 = el crudo del «total del listado» (${etiqueta})`);
  {
    const r = await derivar(h, { operacion: "suma", sobre: ventas.map((x) => x.id) }, T);
    const lib = await libroDe();
    const crudoTotal = lib.entregas[0].hechos.find((x) => x.id === totalVentas.id).rv.raw;
    ok(r.ok && r.hecho.valor === totalVentas.valor && lib.derivaciones.find((d) => d.id === r.hecho.id).resultado.raw === crudoTotal, `★ la suma de las 13 ventas (${r.hecho && r.hecho.valor}) es EXACTAMENTE el crudo del total del listado (${totalVentas.valor})`, jj([r.hecho, crudoTotal]));
    ok(r.operandos.length === 13, "los 13 operandos viajan");
    const sumaDeSaldos = vencidos.reduce((a, x) => a + rawDe(oSaldos, "saldo_vencido", x.entidad), 0);
    const r2 = await derivar(hs, { operacion: "suma", sobre: vencidos.map((x) => x.id) }, T);
    ok(r2.ok && r2.hecho.valor === totalDe(hs.saldos, "Saldo vencido").valor && r2.hecho.valor === formatoDeLaCasa(sumaDeSaldos, "money"), `★ los 13 saldos vencidos (los de la tabla + los de «fuera del texto») suman el total del listado (${r2.hecho && r2.hecho.valor})`, jj(r2.hecho));
  }

  H(`3 · participación, conteo y diferencias (${etiqueta})`);
  {
    const num = ventas[0], den = totalVentas;
    const lib0 = await libroDe();
    const esperado = (100 * rawDe(oVentas, "ventas", num.entidad)) / lib0.entregas[0].hechos.find((x) => x.id === den.id).rv.raw;
    const r = await derivar(h, { operacion: "participacion", sobre: [num.id], base: den.id }, T);
    ok(r.ok && r.hecho.valor === formatoDeLaCasa(esperado, "pct") && r.base && r.base.id === den.id && r.base.valor === den.valor, `★ participación de ${num.entidad} sobre el total: ${formatoDeLaCasa(esperado, "pct")} (100·num/base, la escala de la casa: puntos), con su base`, jj(r).slice(0, 500));
    ok(/participación sobre/.test(r.hecho.metrica) && r.hecho.metrica.includes(den.valor), "la métrica dice la base junto a la cifra (valor + base)", r.hecho && r.hecho.metrica);
    const enLibro = (await libroDe()).derivaciones.find((d) => d.id === r.hecho.id);
    ok(enLibro.resultado.unidad === "pct" && Math.abs(enLibro.resultado.raw - esperado) < 1e-9 && esperado > 1, "guardada en puntos (21.5 ↔ «21.5%»), nunca como fracción");
    /* entre claves distintas, de una misma cuenta: vencido ÷ pendiente */
    const cuenta = vencidos.find((x) => rawDe(oSaldos, "saldo_vencido", x.entidad) > 0);
    const rp = await derivar(hs, { operacion: "participacion", sobre: [cuenta.id], base: pendientes.find((x) => x.entidad === cuenta.entidad).id }, T);
    const espP = (100 * rawDe(oSaldos, "saldo_vencido", cuenta.entidad)) / rawDe(oSaldos, "saldo_pendiente", cuenta.entidad);
    ok(rp.ok && rp.hecho.valor === formatoDeLaCasa(espP, "pct") && /Saldo vencido ÷ Saldo pendiente · participación/.test(rp.hecho.metrica), `★ vencido ÷ pendiente de ${cuenta.entidad}: ${formatoDeLaCasa(espP, "pct")}, la métrica nombra las dos (§8.4)`, jj(rp.hecho));
  }
  {
    const n1 = vencidos.filter((x) => rawDe(oSaldos, "saldo_vencido", x.entidad) > 0);
    const n0 = vencidos.filter((x) => rawDe(oSaldos, "saldo_vencido", x.entidad) === 0);
    const r = await derivar(hs, { operacion: "conteo", sobre: vencidos.map((x) => x.id), condicion: { op: ">", valor: 0 } }, T);
    ok(r.ok && r.hecho.valor === `${n1.length} de 13` && jj(r.cumplen.slice().sort()) === jj(n1.map((x) => x.id).sort()) && jj(r.noCumplen.slice().sort()) === jj(n0.map((x) => x.id).sort()), `★ conteo «vencido > 0»: ${n1.length} de 13, con los ids que cumplen y los que no (oráculo: el Core)`, jj(r).slice(0, 500));
    const r0 = await derivar(hs, { operacion: "conteo", sobre: vencidos.map((x) => x.id), condicion: { op: "=", valor: 0 } }, T);
    ok(r0.ok && r0.hecho.valor === `${n0.length} de 13` && n0.length + n1.length === 13, `★ conteo «al día = vencido 0»: ${n0.length} de 13 (y juntos suman los 13)`, jj(r0.hecho));
    const lider = ventas[1];
    const rr = await derivar(h, { operacion: "conteo", sobre: ventas.map((x) => x.id), condicion: { op: ">", valor: lider.id } }, T);
    const nMas = ventas.filter((x) => rawDe(oVentas, "ventas", x.entidad) > rawDe(oVentas, "ventas", lider.entidad)).length;
    ok(rr.ok && rr.hecho.valor === `${nMas} de 13` && rr.condicion.referencia && rr.condicion.referencia.id === lider.id, `conteo contra otra cifra entregada (${nMas} de 13 venden más que ${lider.entidad})`, jj(rr).slice(0, 400));
  }
  {
    const mA = margenes[0], mB = margenes[margenes.length - 1];
    const dif = rawDe(oMargen, "margen", mA.entidad) - rawDe(oMargen, "margen", mB.entidad);
    const r = await derivar(h, { operacion: "diferencia", sobre: [mA.id, mB.id] }, T);
    ok(r.ok && r.hecho.valor === formatoDeLaCasa(dif, "pp") && /pp$/.test(r.hecho.valor), `★ la diferencia de dos % se dice en pp (${formatoDeLaCasa(dif, "pp")})`, jj(r.hecho));
    const rneg = await derivar(h, { operacion: "diferencia", sobre: [mB.id, mA.id] }, T);
    const alReves = dif < 0 ? rneg : r, derecho = dif < 0 ? r : rneg;
    ok(dif !== 0 && rneg.ok && rneg.hecho.valor === formatoDeLaCasa(-dif, "pp") && /^-/.test(derecho.hecho.valor) && !/^-/.test(alReves.hecho.valor), "el signo se conserva (primero − segundo): al revés cambia de signo", jj([r.hecho.valor, rneg.hecho.valor]));
    const vA = ventas[0], vB = ventas[1];
    const rd = await derivar(h, { operacion: "diferencia", sobre: [vB.id, vA.id] }, T);
    const dd = rawDe(oVentas, "ventas", vB.entidad) - rawDe(oVentas, "ventas", vA.entidad);
    ok(rd.ok && rd.hecho.valor === formatoDeLaCasa(dd, "money") && /^-\$/.test(rd.hecho.valor) && rd.hecho.entidad === `${vB.entidad} − ${vA.entidad}`, `la diferencia de dos $ con signo (${formatoDeLaCasa(dd, "money")}) nombra a los dos`, jj(rd.hecho));
    const cuenta = pendientes.find((x) => rawDe(oSaldos, "saldo_pendiente", x.entidad) > rawDe(oSaldos, "saldo_vencido", x.entidad));
    const rc = await derivar(hs, { operacion: "diferencia", sobre: [cuenta.id, vencidos.find((x) => x.entidad === cuenta.entidad).id] }, T);
    ok(rc.ok && rc.hecho.metrica === "Saldo pendiente − Saldo vencido" && rc.hecho.valor === formatoDeLaCasa(rawDe(oSaldos, "saldo_pendiente", cuenta.entidad) - rawDe(oSaldos, "saldo_vencido", cuenta.entidad), "money"), "★ pendiente − vencido de una cuenta (claves distintas): la métrica nombra las dos (§8.4)", jj(rc.hecho));
    const lib0 = await libroDe();
    const rt = await derivar(h, { operacion: "diferencia", sobre: [totalVentas.id, ventas[0].id] }, T);
    ok(rt.ok && rt.hecho.valor === formatoDeLaCasa(lib0.entregas[0].hechos.find((x) => x.id === totalVentas.id).rv.raw - rawDe(oVentas, "ventas", ventas[0].entidad), "money"), "una diferencia admite el total del listado (el resto del total)", jj(rt.hecho));
  }

  H(`4 · cada código de rechazo con su pedido (${etiqueta})`);
  {
    const v0 = ventas.map((x) => x.id), m0 = margenes.map((x) => x.id);
    const sinConv = await h.A.derivar({ tenant: T, conversacionId: null, operacion: "suma", sobre: v0.slice(0, 2) });
    ok(sinConv.ok === false && sinConv.motivo === "falta_conversacion", "★ sin conversacionId: falta_conversacion");
    const noExiste = await h.A.derivar({ tenant: T, conversacionId: "no-existe-123", operacion: "suma", sobre: v0.slice(0, 2) });
    ok(noExiste.ok === false && noExiste.motivo === "conversacion_inexistente", "★ una conversación que no existe: conversacion_inexistente");
    await noDeriva(h, T, "`promedio`", { operacion: "promedio", sobre: v0.slice(0, 3) }, "operacion_desconocida");
    await noDeriva(h, T, "una suma de una sola cifra", { operacion: "suma", sobre: [v0[0]] }, "faltan_operandos");
    await noDeriva(h, T, "una participación sin base", { operacion: "participacion", sobre: [v0[0]] }, "faltan_operandos");
    await noDeriva(h, T, "una diferencia de tres cifras", { operacion: "diferencia", sobre: v0.slice(0, 3) }, "demasiados_operandos");
    await noDeriva(h, T, "41 operandos", { operacion: "suma", sobre: Array.from({ length: 41 }, (_, i) => `E1.h${i + 1}`) }, "demasiados_operandos");
    for (const [n, id] of [["un id de apoyo (E1.e5)", "E1.e5"], ["un id de derivación mal escrito (D1x)", "D1x"], ["un universo (E1.u1)", "E1.u1"], ["un número", 42]]) await noDeriva(h, T, n, { operacion: "suma", sobre: [v0[0], id] }, "id_invalido");
    /* ensayo 4: una derivación SÍ es un operando válido; una que la conversación todavía no tiene, no existe (antes: id_invalido para cualquier «D<k>») */
    await noDeriva(h, T, "una derivación que la conversación no tiene (D77)", { operacion: "suma", sobre: [v0[0], "D77"] }, "id_inexistente");
    await noDeriva(h, T, "una Entrega que no existe", { operacion: "suma", sobre: [v0[0], "E9.h1"] }, "id_inexistente");
    await noDeriva(h, T, "una cifra que no existe", { operacion: "suma", sobre: [v0[0], "E1.h99"] }, "id_inexistente");
    await noDeriva(h, T, "el mismo id dos veces", { operacion: "suma", sobre: [v0[0], v0[0]] }, "operando_repetido");
    await noDeriva(h, T, "dólares y porcentaje", { operacion: "suma", sobre: [v0[0], m0[0]] }, "unidades_distintas");
    await noDeriva(hs, T, "dos métricas de dinero", { operacion: "suma", sobre: [vencidos[0].id, pendientes[0].id] }, "metricas_distintas");
    await noDeriva(h, T, "sumar márgenes (un %)", { operacion: "suma", sobre: m0.slice(0, 2) }, "metrica_no_aditiva");
    await noDeriva(h, T, "sumar el total del listado con sus filas", { operacion: "suma", sobre: [v0[0], totalVentas.id] }, "operando_es_total");
    await noDeriva(h, T, "contar el total del listado", { operacion: "conteo", sobre: [totalVentas.id, v0[0]], condicion: { op: ">", valor: 0 } }, "operando_es_total");
    await noDeriva(hs, T, "dos métricas y dos dueños en una diferencia", { operacion: "diferencia", sobre: [vencidos[0].id, pendientes[1].id] }, "metricas_distintas");
    await noDeriva(h, T, "participación de un %", { operacion: "participacion", sobre: [m0[0]], base: m0[1] }, "unidad_no_participable");
    await noDeriva(h, T, "numerador mayor que la base", { operacion: "participacion", sobre: [v0[0]], base: v0[1] }, "numerador_mayor_que_base");
    const cero = vencidos.find((x) => rawDe(oSaldos, "saldo_vencido", x.entidad) === 0);
    await noDeriva(hs, T, "base cero", { operacion: "participacion", sobre: [vencidos.find((x) => rawDe(oSaldos, "saldo_vencido", x.entidad) > 0).id], base: cero.id }, "base_cero");
    await noDeriva(h, T, "conteo sin condición", { operacion: "conteo", sobre: v0.slice(0, 3) }, "condicion_invalida");
    await noDeriva(h, T, "conteo con un operador que no existe", { operacion: "conteo", sobre: v0.slice(0, 3), condicion: { op: "≈", valor: 0 } }, "condicion_invalida");
    await noDeriva(h, T, "conteo con un valor que no es número ni id", { operacion: "conteo", sobre: v0.slice(0, 3), condicion: { op: ">", valor: true } }, "condicion_invalida");
    await noDeriva(h, T, "conteo de dinero contra una cantidad suelta (escala ambigua)", { operacion: "conteo", sobre: v0.slice(0, 3), condicion: { op: ">", valor: 5 } }, "condicion_invalida");
    await noDeriva(hs, T, "conteo de cifras de dos métricas", { operacion: "conteo", sobre: [vencidos[0].id, pendientes[0].id], condicion: { op: ">", valor: 0 } }, "metricas_distintas");
    await noDeriva(h, T, "conteo contra una cifra de otra unidad", { operacion: "conteo", sobre: v0.slice(0, 3), condicion: { op: ">", valor: m0[0] } }, "unidades_distintas");
    await noDeriva(h, T, "conteo contra una cifra que no existe", { operacion: "conteo", sobre: v0.slice(0, 3), condicion: { op: ">", valor: "E1.h99" } }, "id_inexistente");

    /* los que exigen un libro armado a mano (se guarda alterado en un almacén aparte: un dato así no sale del Core) */
    const alterado = async (nombre, motivo, f, pedido) => {
      const s2 = crearAlmacenEnMemoria(); const A2 = crearAcciones({ continuidad: s2 });
      const L = clon(await h.store.leerLibro(T.id, h.conv)); f(L); await s2.guardarLibro(T.id, L);
      const r = await A2.derivar({ tenant: T, conversacionId: h.conv, ...pedido });
      ok(r.ok === false && r.motivo === motivo, `★ ${nombre}: «${motivo}»`, jj(r).slice(0, 300));
    };
    const hechoDe = (L, id) => L.entregas.flatMap((e) => e.hechos || []).find((x) => x.id === id);
    await alterado("una cifra sin valor exacto", "operando_sin_valor_exacto", (L) => { delete hechoDe(L, v0[0]).rv; }, { operacion: "suma", sobre: v0.slice(0, 2) });
    await alterado("una cifra de un supuesto", "operando_no_medido", (L) => { hechoDe(L, v0[0]).rv.deSupuesto = true; }, { operacion: "suma", sobre: v0.slice(0, 2) });
    await alterado("un dato declarado", "operando_no_medido", (L) => { hechoDe(L, v0[0]).rv.titular = "declarado"; }, { operacion: "suma", sobre: v0.slice(0, 2) });
    await alterado("una propuesta", "operando_no_medido", (L) => { hechoDe(L, v0[0]).rv.procedencia = "propuesta"; }, { operacion: "suma", sobre: v0.slice(0, 2) });
    await alterado("una Entrega recortada", "entrega_recortada", (L) => { const e = L.entregas[0]; L.entregas[0] = { n: e.n, turno: e.turno, versionId: e.versionId, temas: e.temas, recortada: true }; }, { operacion: "suma", sobre: v0.slice(0, 2) });
    await alterado("una participación con una cifra negativa", "operando_negativo", (L) => { hechoDe(L, v0[1]).rv.raw = -5; }, { operacion: "participacion", sobre: [v0[1]], base: v0[0] });
    await alterado("otra empresa (libro de otra empresa)", "otra_empresa", (L) => { L.empresaId = "otra-empresa"; }, { operacion: "suma", sobre: v0.slice(0, 2) });
  }
  /* «otro período / moneda / carga» entre dos Entregas de la misma métrica (dos consultas de ventas; la segunda, alterada a mano en un almacén aparte) */
  for (const [motivo, f] of [["otro_periodo", (L) => { L.entregas[1].periodo = { texto: "otro", rango: "otro" }; }], ["otra_moneda", (L) => { L.entregas[1].moneda = "USD"; }], ["otra_carga", (L) => { L.entregas[1].versionId = 77; }]]) {
    const s2 = crearAlmacenEnMemoria(); const A2 = crearAcciones({ continuidad: s2 });
    conTenant(T);
    const r1 = await A2.consultar({ tenant: T, encargo: E([PARTE(["ventas"])]) }); const conv2 = r1.continuidad.conversacionId;
    await A2.consultar({ tenant: T, encargo: E([PARTE(["ventas"])], conv2) });
    const L = clon(await s2.leerLibro(T.id, conv2)); f(L); await s2.guardarLibro(T.id, L);
    const x = await A2.derivar({ tenant: T, conversacionId: conv2, operacion: "suma", sobre: ["E1.h1", "E2.h2"] });
    ok(x.ok === false && x.motivo === motivo, `★ dos cifras de Entregas distintas con ${motivo.replace("_", " ")}: «${motivo}»`, jj(x).slice(0, 300));
    const sano = await A2.derivar({ tenant: T, conversacionId: conv2, operacion: "suma", sobre: ["E1.h1", "E1.h2"] });
    ok(sano.ok === true, "(control) las cifras de una misma Entrega se derivan igual");
  }

  H(`5 · idempotencia y aislamiento (${etiqueta})`);
  {
    const ped = { operacion: "suma", sobre: ventas.slice(0, 3).map((x) => x.id) };
    const antes = jj(await libroDe());
    const r = await derivar(h, ped, T);
    ok(r.ok && r.repetida === true && r.hecho.id === "D1", "★ el mismo pedido devuelve la derivación que ya existe (`repetida:true`, D1)", jj(r).slice(0, 300));
    ok(jj(await libroDe()) === antes, "★ …y el libro queda BYTE A BYTE igual (no se escribió)");
    const r2 = await derivar(h, { operacion: "suma", sobre: ped.sobre.slice().reverse() }, T);
    ok(r2.ok && r2.repetida === true && r2.hecho.id === "D1", "la suma no depende del orden de los operandos");
    const d1 = await derivar(h, { operacion: "diferencia", sobre: [ventas[2].id, ventas[3].id] }, T);
    const d2 = await derivar(h, { operacion: "diferencia", sobre: [ventas[3].id, ventas[2].id] }, T);
    ok(d1.ok && d2.ok && d1.hecho.id !== d2.hecho.id && d2.repetida === false, "una diferencia SÍ depende del orden (primero − segundo): son dos derivaciones");
    const ids = (await libroDe()).derivaciones.map((d) => Number(d.id.slice(1)));
    ok(ids.every((n, i) => n === ids[0] + i) && ids[0] === 1, "los ids D<k> son consecutivos y estables", jj(ids));
    /* otra conversación del mismo tenant */
    const rB = await h.A.consultar({ tenant: T, encargo: E([PARTE(["margen"])]) });
    const convB = rB.continuidad.conversacionId;
    const xB = await h.A.derivar({ tenant: T, conversacionId: convB, operacion: "suma", sobre: [ventas[0].id, "E3.h1"] });
    ok(xB.ok === false && xB.motivo === "id_inexistente", "★ otra conversación del mismo tenant: los ids de ESTE hilo no existen ahí (id_inexistente)", jj(xB).slice(0, 300));
    /* otra empresa */
    const T2 = { ...T, id: "otra-empresa-gate" };
    const xT = await h.A.derivar({ tenant: T2, conversacionId: h.conv, operacion: "suma", sobre: ped.sobre });
    ok(xT.ok === false && xT.motivo === "conversacion_inexistente", "★ otra empresa con el mismo conversacionId: el almacén la aísla (conversacion_inexistente)");
    const hojaAbierta = (() => { const libros = new Map(); return { ...crearAlmacenEnMemoria(), async leerLibro(_t, c) { return libros.has(c) ? clon(libros.get(c)) : null; }, async guardarLibro(_t, l) { libros.set(l.conversacionId, clon(l)); return l; } }; })();
    const hA = await hilo(T, [PASOS_COMERCIAL[0]], { store: hojaAbierta });
    const xO = await hA.A.derivar({ tenant: T2, conversacionId: hA.conv, operacion: "suma", sobre: [ventas[0].id, ventas[1].id] });
    ok(xO.ok === false && xO.motivo === "otra_empresa", "★ aunque un almacén ENTREGARA el libro ajeno, `derivar` lo rechaza por su propio dato (otra_empresa)", jj(xO).slice(0, 300));
    ok(!JSON.stringify(xO).includes(ventas[0].valor), "…y no devuelve ni una cifra de la otra empresa");
  }

  H(`6 · falla cerrado: si GUARDAR falla, no hay derivación ni id consumido (${etiqueta})`);
  {
    const base = crearAlmacenEnMemoria(); let cae = false, leeCae = false;
    const fragil = { ...base, async guardarLibro(t, l) { if (cae) throw new ErrorDeAlmacen("guardarLibro", "caída de gate"); return base.guardarLibro(t, l); }, async leerLibro(t, c) { if (leeCae) throw new ErrorDeAlmacen("leerLibro", "caída de gate"); return base.leerLibro(t, c); } };
    const hf = await hilo(T, [PASOS_COMERCIAL[0]], { store: fragil });
    const ped = { operacion: "suma", sobre: delMetrica(hf.ventas, "Venta").slice(0, 3).map((x) => x.id) };
    const antes = jj(await base.leerLibro(T.id, hf.conv));
    cae = true;
    const r = await hf.A.derivar({ tenant: T, conversacionId: hf.conv, ...ped });
    ok(r.ok === false && r.memoria === "no_disponible" && !r.hecho, "★ si falla GUARDAR: ok:false · memoria:«no_disponible» y NO se entrega el hecho (el id es el producto)", jj(r).slice(0, 300));
    cae = false;
    ok(jj(await base.leerLibro(T.id, hf.conv)) === antes && !(await base.leerLibro(T.id, hf.conv)).derivaciones, "★ el libro quedó sin la derivación");
    const r2 = await hf.A.derivar({ tenant: T, conversacionId: hf.conv, ...ped });
    ok(r2.ok && r2.hecho.id === "D1", "★ recuperado el almacén, el primer id sigue siendo D1 (el fallido no lo consumió)");
    leeCae = true;
    const r3 = await hf.A.derivar({ tenant: T, conversacionId: hf.conv, ...ped });
    ok(r3.ok === false && r3.memoria === "no_disponible", "si falla LEER: falla cerrado, nunca «la conversación no existe»");
  }

  H(`7 · retomar revalida las derivaciones por sus operandos (${etiqueta})`);
  {
    const hr = await hilo(T, PASOS_COMERCIAL);
    const v = delMetrica(hr.ventas, "Venta"), mg = delMetrica(hr.margen, "Margen");
    const sinD = clon(await hr.A.retomar({ tenant: T, conversacionId: hr.conv }));
    ok(!sinD.hechos.some((x) => /^D\d+$/.test(x.id)), "★ un hilo SIN derivaciones: `retomar` no trae ningún hecho D (idéntico al de siempre)");
    const sinDComp = jj(compactarParaAnfitrion("retomar", sinD));
    const dSuma = await derivar(hr, { operacion: "suma", sobre: v.slice(0, 3).map((x) => x.id) }, T);
    const dCuenta = await derivar(hr, { operacion: "conteo", sobre: mg.map((x) => x.id), condicion: { op: ">", valor: 0 } }, T);
    const r1 = await hr.A.retomar({ tenant: T, conversacionId: hr.conv });
    const hD = r1.hechos.filter((x) => /^D\d+$/.test(x.id));
    ok(hD.length === 2 && hD.every((x) => x.origen === "derivado" && x.derivada === true && x.estadoReverificacion === "igual" && x.revalidacion.estado === "igual"), "★ con el MISMO dato: las derivaciones salen en `hechos` (origen «derivado», con sus operandos) y `igual`", jj(hD).slice(0, 500));
    ok(r1.hechos.slice(0, r1.hechos.length - 2).every((x) => !/^D\d+$/.test(x.id)) && /^D\d+$/.test(r1.hechos[r1.hechos.length - 1].id), "van DESPUÉS de las Entregas");
    ok(hD[0].valor === dSuma.hecho.valor && jj(hD[0].sobre) === jj(dSuma.hecho.sobre), "con el mismo valor y los operandos de la derivación");
    ok(r1.resumen.total === sinD.resumen.total + 2 && r1.resumen.igual === sinD.resumen.igual + 2, "entran al resumen");
    ok(r1.lineaContinuidad === sinD.lineaContinuidad && jj(r1.eventos) === jj(sinD.eventos), "no agregan nada a la línea de continuidad");
    const sinLasD = jj(compactarParaAnfitrion("retomar", { ...r1, hechos: r1.hechos.filter((x) => !/^D\d+$/.test(x.id)), resumen: sinD.resumen }));
    ok(sinLasD === sinDComp, "★ quitadas las D, `retomar` es BYTE A BYTE el de un hilo sin derivaciones");
    const enc = jj(await hr.store.leerLibro(T.id, hr.conv));
    await hr.A.retomar({ tenant: T, conversacionId: hr.conv });
    ok(jj(await hr.store.leerLibro(T.id, hr.conv)) === enc, "`retomar` sigue sin escribir el libro");
    const comp = compactarParaAnfitrion("retomar", r1);
    ok(comp.hechos.filter((x) => /^D\d+$/.test(x.id)).every((x) => Array.isArray(x.sobre) && x.estadoReverificacion && x.revalidacion), "en la respuesta compacta la derivación viaja con sus operandos y su revalidación");

    /* otra carga: la venta de un operando cambió */
    const nombreOp = v[0].entidad;
    const ds2 = clon(T.dataset);
    const filaV = (ds2.clientesVentas || []).find((x) => x.nombre === nombreOp);
    if (filaV && filaV.actual != null) filaV.actual *= 0.5;   /* la venta VIGENTE (`clientesVentas.actual`): con la realidad única el cambio de `anterior` ya no mueve la venta, y esta prueba se saltaba el «cambio» sin avisar */
    const T2 = { ...T, dataset: ds2, version: 2 };
    const oAntes = crudosDelCore(T, E([PARTE(["ventas"], "comercial")]));
    const oHoy = crudosDelCore(T2, E([PARTE(["ventas"], "comercial")]));
    const cambio = rawDe(oHoy, "ventas", nombreOp) !== rawDe(oAntes, "ventas", nombreOp);
    conTenant(T2);
    const r2 = await hr.A.retomar({ tenant: T2, conversacionId: hr.conv });
    const dS = r2.hechos.find((x) => x.id === dSuma.hecho.id);
    if (cambio) {
      const nueva = v.slice(0, 3).reduce((a, x) => a + rawDe(oHoy, "ventas", x.entidad), 0);
      const rawAntes = (await hr.store.leerLibro(T.id, hr.conv)).derivaciones[0].resultado.raw;
      ok(dS.estadoReverificacion === "cambio" && dS.revalidacion.actual.valor === formatoDeLaCasa(nueva, "money") && dS.revalidacion.actual.raw === nueva && dS.revalidacion.anterior.valor === dSuma.hecho.valor, `★ si un operando cambió, la suma se RECALCULA con los crudos de hoy (${dSuma.hecho.valor} → ${formatoDeLaCasa(nueva, "money")})`, jj(dS).slice(0, 600));
      ok(dS.revalidacion.diferencia && Math.abs(dS.revalidacion.diferencia.valor - (nueva - rawAntes)) < 1e-6 && dS.valorNuevo === formatoDeLaCasa(nueva, "money"), "la diferencia la calcula ADI (actual − anterior)");
      ok(!/\bD\d/.test(r2.lineaContinuidad || ""), "la línea de continuidad nombra al operando que cambió, no a la suma");
      const mHoy = crudosDelCore(T2, E([PARTE(["margen"], "comercial")])), mAntes = crudosDelCore(T, E([PARTE(["margen"], "comercial")]));
      const margenIgual = mg.every((x) => formatoDeLaCasa(rawDe(mHoy, "margen", x.entidad), "pct") === formatoDeLaCasa(rawDe(mAntes, "margen", x.entidad), "pct"));
      const dC = r2.hechos.find((x) => x.id === dCuenta.hecho.id);
      if (margenIgual) ok(dC.estadoReverificacion === "igual", "la derivación cuyos operandos no cambiaron sigue `igual`", jj(dC).slice(0, 300));
    } else console.log("   · (el cambio de la venta no mueve la cifra en este dato: se omite el «cambio»)");
    /* un operando que ya no existe */
    const ds3 = clon(T.dataset);
    for (const k of ["clientesVentas", "clientesMargen"]) if (Array.isArray(ds3[k])) ds3[k] = ds3[k].filter((x) => x.nombre !== nombreOp);
    if (ds3.flujoComercial && ds3.flujoComercial.clientes) delete ds3.flujoComercial.clientes[nombreOp];
    const T3 = { ...T, dataset: ds3, version: 3 }; conTenant(T3);
    const r3 = await hr.A.retomar({ tenant: T3, conversacionId: hr.conv });
    const opS = r3.hechos.find((x) => x.id === v[0].id), dS3 = r3.hechos.find((x) => x.id === dSuma.hecho.id);
    ok(opS && ["ya_no_existe", "no_comparable", "sin_reverificar"].includes(opS.estadoReverificacion) && dS3.estadoReverificacion === "no_se_revalida" && /operandos no se pudo revalidar/.test(dS3.revalidacion.motivo) && dS3.valorNuevo === undefined && dS3.revalidacion.actual === undefined, `★ si un operando ya no se puede revalidar (${opS && opS.estadoReverificacion}), la derivación es «no_se_revalida» con su motivo y no se afirma vigente`, jj(dS3).slice(0, 500));
    conTenant(T);
  }
}

/* ═══ 8 · ESTÁTICO ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════ */
H("8 · estático: derivar no toca el Core");
{
  const der = sinComentarios(fs.readFileSync("src/adi/capacidad/derivar.js", "utf8"));
  const acc = sinComentarios(fs.readFileSync("src/adi/capacidad/acciones.js", "utf8"));
  const iniRama = acc.indexOf("async function derivar("), finRama = acc.indexOf("return { conocerEmpresa, consultar, aportarContexto, retomar, derivar }");
  const rama = acc.slice(iniRama, finRama);
  ok(iniRama > 0 && finRama > iniRama && rama.length > 500, "se ubicó la rama `derivar` de acciones.js");
  ok(!/from\s+["'][^"']*\/(entrega|encargo)\//.test(der) && !/node:/.test(der), "★ `derivar.js` no importa nada de `entrega/` ni de `encargo/` y no usa `node:*`");
  ok(!/conTenantActivo|validarEncargo|componerEntrega|initTenant/.test(rama) && !/conTenantActivo|validarEncargo|componerEntrega|initTenant/.test(der), "★ la rama `derivar` de acciones.js y `derivar.js` no llaman `conTenantActivo`, `validarEncargo` ni `componerEntrega`");
  ok(!/fetch\(|XMLHttpRequest|process\.env/.test(der), "`derivar.js` no hace red ni lee el entorno");
}

/* ═══ 9 · LA PUERTA ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════ */
H("9 · la puerta: cinco herramientas, REST `derivar`, OpenAPI con cinco rutas");
{
  const RUTA = "/api/" + "adi-capacidad";   /* armada por concatenación: escrita entera, el clasificador de gates la tomaría por un endpoint real */
  const SECRETO = "derivar-gate-secret";
  const ENV = { ADI_COMPLEMENTO: "true", ADI_TOKEN_SECRET: SECRETO };
  const { code } = await makeAccessCode("Owner", 72, SECRETO, Date.now(), "demo");
  const ip = (n) => ({ "content-type": "application/json", authorization: `Bearer ${code}`, "x-real-ip": `10.9.9.${n}` });
  const pedir = (path, body, n) => manejarPuerta(new Request(`http://gate.local${path}`, { method: "POST", headers: ip(n), body: JSON.stringify(body) }), ENV);
  const nombres = MCP_TOOLS.map((t) => t.name);
  ok(jj(nombres) === jj(["conocerEmpresa", "consultar", "aportarContexto", "retomar", "derivar"]) && MCP_TOOLS.length === 5, "★ `MCP_TOOLS` trae las cinco herramientas, `derivar` la quinta", jj(nombres));
  const tool = MCP_TOOLS.find((t) => t.name === "derivar");
  ok(/Calcula, verifica y devuelve como hecho nuevo/.test(tool.description) && /Úsela SIEMPRE que necesite un total/.test(tool.description) && /use consultar\.$/.test(tool.description), "la descripción es la de negocio del contrato");
  ok(jj(tool.inputSchema.required) === jj(["conversacionId", "operacion", "sobre"]) && jj(tool.inputSchema.properties.operacion.enum) === jj(OPERACIONES) && tool.inputSchema.additionalProperties === false, "el esquema: operación cerrada, sobre/base/condicion, sin campos extra");
  ok(!/compareEntities|simulateGeneral|queryMetric|toolRegistry|fig\(/i.test(JSON.stringify(tool)), "ningún mecanismo interno en su forma pública");
  const spec = construirOpenApi("http://gate.local");
  ok(Object.keys(spec.paths).length === 5 && spec.paths[`${RUTA}/derivar`] && spec.paths[`${RUTA}/derivar`].post.operationId === "derivar" && spec.paths[`${RUTA}/derivar`].post.security, "★ el OpenAPI describe las cinco rutas, `derivar` con bearer");
  conTenant(EMPRESAS[0].T);
  const rc = await (await pedir(`${RUTA}/consultar`, { encargo: E([PARTE(["ventas"])]) }, 1)).json();
  const conv = rc.continuidad.conversacionId;
  const ids = rc.entrega.cifras.filter((x) => x.entidad).slice(0, 3).map((x) => x.id);
  const rest = await (await pedir(`${RUTA}/derivar`, { conversacionId: conv, operacion: "suma", sobre: ids }, 2)).json();
  ok(rest.ok === true && rest.hecho.id === "D1" && rest.hecho.procedencia === "derivado" && jj(rest.uso) === jj(CABECERA_DE_USO), "★ REST: `derivar` por la puerta devuelve el hecho D1 con la cabecera de uso", jj(rest).slice(0, 300));
  const rpc = await (await pedir("/mcp", { jsonrpc: "2.0", id: 7, method: "tools/call", params: { name: "derivar", arguments: { conversacionId: conv, operacion: "diferencia", sobre: ids.slice(0, 2) } } }, 3)).json();
  const p = JSON.parse(rpc.result.content[0].text);
  ok(p.ok === true && p.hecho.id === "D2" && rpc.result.isError === false, "JSON-RPC: tools/call `derivar` devuelve D2 (el id sigue el libro)", jj(p).slice(0, 300));
  const mal = await (await pedir(`${RUTA}/derivar`, { conversacionId: conv, operacion: "promedio", sobre: ids }, 4)).json();
  ok(mal.ok === false && mal.motivo === "operacion_desconocida", "un rechazo sale por la puerta con su motivo");
  const rpcMal = await (await pedir("/mcp", { jsonrpc: "2.0", id: 8, method: "tools/call", params: { name: "derivar", arguments: { conversacionId: conv, operacion: "promedio", sobre: ids } } }, 5)).json();
  ok(rpcMal.result.isError === true, "…y por MCP es `isError`");
  const ajeno = await (await pedir(`${RUTA}/derivar`, { conversacionId: conv, tenant: "otra", operacion: "suma", sobre: ids }, 6)).json();
  ok(ajeno.advertencias && /tenant/.test(ajeno.advertencias[0]) && ajeno.repetida === true, "un argumento de tenant se ignora y se declara, como en las otras acciones");
}

/* ═══ 10 · EL LIBRO DE 16 KB CON EL CASO MÁS GRANDE ══════════════════════════════════════════════════════════════════════════════════════════════════════ */
H("10 · el tope de 16 KB del libro con el caso más grande del demo");
{
  const T = EMPRESAS[0].T;
  conTenant(T);
  /* (a) el libro de UNA Entrega más grande del catálogo sellado, ya con las cifras de `fueraDelTexto` dentro */
  const MUESTRA = JSON.parse(fs.readFileSync(new URL("./fixtures/procedencia/muestra-v13-v40.json", import.meta.url), "utf8")).casos;
  let peor = { bytes: 0, id: null, fuera: 0, hechos: 0 }, mayorFuera = { n: 0, id: null }, recortadas = 0, conFuera = 0, conId = 0, sinId = 0, mezcla = 0;
  for (const c of MUESTRA) {
    const S = crearAlmacenEnMemoria(); const AA = crearAcciones({ continuidad: S });
    const r = await AA.consultar({ tenant: T, encargo: c.encargo });
    if (!r.ok || !r.continuidad) continue;
    const L = await S.leerLibro(T.id, r.continuidad.conversacionId);
    const e0 = L.entregas[0];
    const fz = (compactarParaAnfitrion("consultar", r).entrega.detalle || {}).fueraDelTexto;
    if (fz && fz.length) { if (fz.every((x) => /^E1\.h\d+(\.\d+)?$/.test(x.id || ""))) conId += 1; else if (fz.every((x) => x.id === undefined)) sinId += 1; else mezcla += 1; }
    if (e0.recortada) { recortadas += 1; continue; }
    const nf = e0.hechos.filter((x) => x.fuera).length;
    const b = tamanoBytes(L);
    if (b > peor.bytes) peor = { bytes: b, id: c.id, fuera: nf, hechos: e0.hechos.length };
    if (nf > mayorFuera.n) mayorFuera = { n: nf, id: c.id };
    conFuera += nf > 0 ? 1 : 0;
  }
  console.log(`   · de los ${MUESTRA.length} encargos del catálogo, ${conFuera} traen cifras de fueraDelTexto (ahora con id en el libro); el libro de UNA Entrega más grande que se conserva entera: ${peor.bytes} B (${peor.id}: ${peor.hechos} hechos, ${peor.fuera} de fueraDelTexto); la que más trae: ${mayorFuera.n} (${mayorFuera.id}); Entregas únicas que el tope recorta: ${recortadas}; con las cifras de fueraDelTexto CON id: ${conId}, SIN id por el tope: ${sinId}`);
  ok(recortadas === 0 && mezcla === 0 && conId + sinId > 0, "★ ninguna Entrega única del catálogo se recorta por las cifras nuevas: las que no caben viajan SIN id, como siempre (el tope de 16 KB manda)", jj({ recortadas, conId, sinId, mezcla }));
  ok(sinId > 0, "(control) el caso límite existe en el catálogo: hay Entregas cuyo fueraDelTexto NO cabe y degrada a «sin id»");
  ok(peor.bytes <= LIBRO_TOPE_BYTES && conFuera > 0, `★ ningún libro guardado excede ${LIBRO_TOPE_BYTES} B con las cifras de fueraDelTexto dentro (el más grande: ${peor.bytes} B)`, String(peor.bytes));
  globalThis.__recortadasConFuera = recortadas;
  /* (b) 24 derivaciones sobre las 13 ventas (13 conteos de 13 operandos + 11 sumas de 3): el libro con las derivaciones al tope */
  const store2 = crearAlmacenEnMemoria();
  const h = await hilo(T, [PASOS_COMERCIAL[0]], { store: store2 });
  const vs = delMetrica(h.ventas, "Venta");
  const antes = tamanoBytes(await store2.leerLibro(T.id, h.conv));
  const pedidos = [];
  for (let i = 0; i < 13; i++) pedidos.push({ operacion: "conteo", sobre: vs.map((x) => x.id), condicion: { op: ">", valor: vs[i].id } });
  for (let i = 0; i + 2 < 13; i++) pedidos.push({ operacion: "suma", sobre: vs.slice(i, i + 3).map((x) => x.id) });
  for (const p of pedidos) await h.A.derivar({ tenant: T, conversacionId: h.conv, ...p });
  const L = await store2.leerLibro(T.id, h.conv);
  const dMax = Math.max(...L.derivaciones.map((d) => tamanoBytes(d)));
  console.log(`   · hilo de 1 Entrega (13 ventas): ${antes} B → con ${L.derivaciones.length} derivaciones (hasta 13 operandos): ${tamanoBytes(L)} B · la derivación más grande: ${dMax} B`);
  ok(L.derivaciones.length === 24 && tamanoBytes(L) <= LIBRO_TOPE_BYTES && !L.entregas[0].recortada, "★ con las 24 derivaciones al tope el libro sigue bajo 16 KB y la Entrega no se recorta", String(tamanoBytes(L)));
  /* (c) lo que NO cabe: tres Entregas completas ya recortaban la más vieja ANTES de este contrato; las derivaciones compiten con ellas por los mismos 16 KB (se informa, no se esconde) */
  const hh = await hilo(T, [...PASOS_COMERCIAL.slice(0, 1), ...PASOS_SALDOS, ["margen2", ["margen"], "comercial"]]);
  const Lh = await hh.store.leerLibro(T.id, hh.conv);
  console.log(`   · INFORME: un hilo de TRES Entregas completas (ventas 13 · saldos 13×2 · márgenes 13) pesa ${tamanoBytes(Lh)} B y recorta ${Lh.entregas.filter((e) => e.recortada).map((e) => `E${e.n}`).join(", ") || "nada"} (sin este contrato: 12.151 B y también recortaba E1)`);
}


/* ═══ 11 · ENCADENAR DERIVACIONES Y AGRUPAR NUMERADORES (ensayo 4 · owner 2026-10-07) ═══════════════════════════════════════════════════════════════════════════════
 * Los casos reales del ensayo 4 (transcritos A01 s1 t2 y t4 · C01 s1 t5 · C02 s1 t2): el anfitrión pidió `participacion` con un `D<k>` como base o como numerador (rechazado: `id_invalido`) y quiso «los 3 primeros sobre el total»
 * (un solo numerador permitido), así que calculó él. Ahora: un operando puede ser una derivación anterior (con su LINAJE: las cifras entregadas de las que sale), y una participación suma varios numeradores. Fail-closed intacto. */
H("11 · encadenar derivaciones (D sobre D) y participación de varios numeradores");
for (const { etiqueta, T } of EMPRESAS) {
  H(`── ${etiqueta} (encadenar y agrupar) ───────────────────────────────────────────────────────────────────────────────────────────────────`);
  const h = await hilo(T, PASOS_COMERCIAL);
  const hs = await hilo(T, PASOS_SALDOS);
  const oVentas = crudosDelCore(T, E([PARTE(["ventas"], "comercial")]));
  const ventas = delMetrica(h.ventas, "Venta"), totalVentas = totalDe(h.ventas, "Venta"), margenes = delMetrica(h.margen, "Margen");
  const vencidos = delMetrica(hs.saldos, "Saldo vencido"), pendientes = delMetrica(hs.saldos, "Saldo pendiente");
  const libroDe = () => h.store.leerLibro(T.id, h.conv);
  const crudo = (x) => rawDe(oVentas, "ventas", x.entidad);
  const suma = (xs) => xs.reduce((a, x) => a + crudo(x), 0);
  const lib0 = await libroDe();
  const crudoTotal = lib0.entregas[0].hechos.find((x) => x.id === totalVentas.id).rv.raw;
  const tres = ventas.slice(0, 3), otras3 = ventas.slice(3, 6);
  const ids = (xs) => xs.map((x) => x.id);

  H(`11a · «los 3 primeros sobre el total» es UN hecho de ADI: participación con tres numeradores (${etiqueta})`);
  const espParticipacion = (100 * suma(tres)) / crudoTotal;
  const rm = await derivar(h, { operacion: "participacion", sobre: ids(tres), base: totalVentas.id }, T);
  ok(rm.ok === true && rm.hecho.operacion === "participacion" && rm.hecho.valor === formatoDeLaCasa(espParticipacion, "pct") && rm.operandos.length === 3 && rm.base && rm.base.id === totalVentas.id, `★ participación de 3 numeradores sobre el total del listado: ${formatoDeLaCasa(espParticipacion, "pct")} (100·Σ/total, con los crudos), con sus tres operandos y su base`, jj(rm).slice(0, 500));
  ok(rm.hecho.entidad === tres.map((x) => x.entidad).join(" + ") && /participación de 3 cifras entregadas sobre/.test(rm.hecho.metrica) && rm.hecho.metrica.includes(totalVentas.valor), "la entidad nombra a los tres y la métrica dice que son tres cifras sobre qué base (valor + base)", jj(rm.hecho));
  const enLibro = (await libroDe()).derivaciones.find((d) => d.id === rm.hecho.id);
  ok(enLibro.resultado.unidad === "pct" && Math.abs(enLibro.resultado.raw - espParticipacion) < 1e-9 && !("linaje" in enLibro), "guardada en puntos, con el crudo exacto; sin linaje (es de cifras entregadas, no encadenada)");
  const rmRev = await derivar(h, { operacion: "participacion", sobre: ids(tres).reverse(), base: totalVentas.id }, T);
  ok(rmRev.ok && rmRev.repetida === true && rmRev.hecho.id === rm.hecho.id, "★ idempotente y sin depender del orden de los numeradores (repetida:true, el mismo D)");
  const r1 = await derivar(h, { operacion: "participacion", sobre: [tres[0].id], base: totalVentas.id }, T);
  ok(r1.ok && r1.hecho.valor === formatoDeLaCasa((100 * crudo(tres[0])) / crudoTotal, "pct") && !/participación de/.test(r1.hecho.metrica), "(control) con UN numerador la participación es la de siempre, con su rótulo de siempre", jj(r1.hecho));
  const rAll = await derivar(h, { operacion: "participacion", sobre: ids(ventas), base: totalVentas.id }, T);
  ok(rAll.ok && rAll.hecho.valor === formatoDeLaCasa(100, "pct"), "las 13 sobre su total son el 100 % (la suma de los numeradores puede IGUALAR a la base)", jj(rAll.hecho));

  H(`11b · una derivación es operando de otra: D sobre D, con linaje (${etiqueta})`);
  const dS = await derivar(h, { operacion: "suma", sobre: ids(tres) }, T);
  const dP = await derivar(h, { operacion: "participacion", sobre: [dS.hecho.id], base: totalVentas.id }, T);
  ok(dP.ok === true && dP.hecho.valor === rm.hecho.valor && dP.hecho.valor === formatoDeLaCasa(espParticipacion, "pct"), `★ la participación de la SUMA (${dS.hecho.id}, como numerador) sobre el total es la MISMA cifra que la de los tres numeradores (${rm.hecho.valor})`, jj(dP).slice(0, 500));
  ok(dP.operandos.length === 1 && dP.operandos[0].id === dS.hecho.id && dP.operandos[0].procedencia === "derivado" && jj(dP.operandos[0].derivaDe) === jj(ids(tres)) && dP.operandos[0].valor === dS.hecho.valor, "el operando D viaja con su valor y de qué cifras sale (procedencia «derivado», derivaDe)", jj(dP.operandos));
  ok(jj(dP.hecho.linaje.slice().sort()) === jj([...ids(tres), totalVentas.id].sort()), "★ el hecho trae su LINAJE completo: las cifras entregadas de las que sale (operandos y base)", jj(dP.hecho.linaje));
  const dP2 = await derivar(h, { operacion: "participacion", sobre: [dS.hecho.id], base: totalVentas.id }, T);
  ok(dP2.ok && dP2.repetida === true && dP2.hecho.id === dP.hecho.id, "idempotente también con operandos D");
  const dS2 = await derivar(h, { operacion: "suma", sobre: ids(otras3) }, T);
  const dDif = await derivar(h, { operacion: "diferencia", sobre: [dS.hecho.id, dS2.hecho.id] }, T);
  ok(dDif.ok && dDif.hecho.valor === formatoDeLaCasa(suma(tres) - suma(otras3), "money") && jj(dDif.hecho.linaje.slice().sort()) === jj([...ids(tres), ...ids(otras3)].sort()), `★ la diferencia de DOS derivaciones (${dDif.hecho && dDif.hecho.valor}) usa los crudos de las seis cifras y trae el linaje de las seis`, jj(dDif).slice(0, 500));
  const dSuma6 = await derivar(h, { operacion: "suma", sobre: [dS.hecho.id, dS2.hecho.id] }, T);
  ok(dSuma6.ok && dSuma6.hecho.valor === formatoDeLaCasa(suma([...tres, ...otras3]), "money"), "la suma de dos sumas disjuntas es la suma de las seis", jj(dSuma6.hecho));
  const dShare = await derivar(h, { operacion: "participacion", sobre: [dS.hecho.id], base: dSuma6.hecho.id }, T);
  ok(dShare.ok && dShare.hecho.valor === formatoDeLaCasa((100 * suma(tres)) / suma([...tres, ...otras3]), "pct"), "una derivación también es BASE de una participación (los 3 primeros sobre los 6)", jj(dShare.hecho));
  const dResto = await derivar(h, { operacion: "diferencia", sobre: [totalVentas.id, tres[0].id] }, T);
  const dRestoP = await derivar(h, { operacion: "participacion", sobre: [dResto.hecho.id], base: totalVentas.id }, T);
  ok(dRestoP.ok && dRestoP.hecho.valor === formatoDeLaCasa((100 * (crudoTotal - crudo(tres[0]))) / crudoTotal, "pct"), "★ el total del listado SÍ es la base de una participación (y una derivación que sale de él, su numerador): operando_es_total solo rige en sumas y conteos", jj(dRestoP).slice(0, 300));
  const dRestoDif = await derivar(h, { operacion: "diferencia", sobre: [dS.hecho.id, tres[0].id] }, T);
  ok(dRestoDif.ok && dRestoDif.hecho.valor === formatoDeLaCasa(suma(tres) - crudo(tres[0]), "money"), "una diferencia admite una derivación y una de sus propias cifras (el resto del grupo)", jj(dRestoDif.hecho));
  /* ningún D se refiere a un id posterior: sin ciclos por construcción */
  const L1 = await libroDe();
  const k = (id) => Number(String(id).slice(1));
  ok(L1.derivaciones.every((d) => [...d.sobre, ...(d.base ? [d.base] : []), ...(d.condicion && typeof d.condicion.valor === "string" ? [d.condicion.valor] : [])].filter((x) => /^D\d+$/.test(x)).every((x) => k(x) < k(d.id))), "★ cada derivación solo se refiere a derivaciones ANTERIORES (un ciclo es imposible por construcción)");
  const pedidoAutorreferido = await derivar(h, { operacion: "suma", sobre: [`D${(L1.nDerivaciones || 0) + 1}`, tres[0].id] }, T);
  ok(pedidoAutorreferido.ok === false && pedidoAutorreferido.motivo === "id_inexistente", "…y pedir una derivación que todavía no existe (el id que se asignaría ahora) se rechaza: id_inexistente", jj(pedidoAutorreferido).slice(0, 300));

  H(`11c · cada rechazo del encadenado y de los varios numeradores, con su pedido (${etiqueta})`);
  await noDeriva(h, T, "una derivación que no existe (D99)", { operacion: "suma", sobre: [dS.hecho.id, "D99"] }, "id_inexistente");
  await noDeriva(h, T, "«D» mal escrito (D1x)", { operacion: "suma", sobre: [dS.hecho.id, "D1x"] }, "id_invalido");
  await noDeriva(h, T, "una derivación y una de sus propias cifras en una suma (se contaría dos veces)", { operacion: "suma", sobre: [dS.hecho.id, tres[1].id] }, "operando_repetido");
  await noDeriva(h, T, "dos derivaciones que comparten una cifra en una suma", { operacion: "suma", sobre: [dS.hecho.id, (await derivar(h, { operacion: "suma", sobre: [tres[2].id, otras3[0].id] }, T)).hecho.id] }, "operando_repetido");
  await noDeriva(h, T, "una derivación y el total del listado en una suma", { operacion: "suma", sobre: [dS.hecho.id, totalVentas.id] }, "operando_es_total");
  await noDeriva(h, T, "una derivación que SALE del total (el resto) en una suma", { operacion: "suma", sobre: [dResto.hecho.id, ventas[1].id] }, "operando_es_total");
  await noDeriva(h, T, "el total del listado entre los varios numeradores", { operacion: "participacion", sobre: [ventas[0].id, totalVentas.id], base: ventas[1].id }, "operando_es_total");
  await noDeriva(h, T, "el mismo numerador dos veces", { operacion: "participacion", sobre: [ventas[0].id, ventas[0].id], base: totalVentas.id }, "operando_repetido");
  await noDeriva(h, T, "un numerador y una derivación que ya lo contiene", { operacion: "participacion", sobre: [dS.hecho.id, tres[1].id], base: totalVentas.id }, "operando_repetido");
  await noDeriva(h, T, "numeradores que suman MÁS que la base", { operacion: "participacion", sobre: ids(ventas.slice(0, 5)), base: ventas[5].id }, "numerador_mayor_que_base");
  await noDeriva(hs, T, "numeradores de varias métricas (vencido y pendiente)", { operacion: "participacion", sobre: [vencidos[0].id, pendientes[1].id], base: pendientes[2].id }, "metricas_distintas");
  await noDeriva(h, T, "varios numeradores que son porcentajes (no aditivos)", { operacion: "participacion", sobre: ids(margenes.slice(0, 2)), base: margenes[2].id }, "metrica_no_aditiva");
  await noDeriva(h, T, "varios numeradores contra una base de otra unidad", { operacion: "participacion", sobre: ids(tres), base: margenes[0].id }, "unidades_distintas");
  await noDeriva(h, T, "un solo numerador mayor que la base (como siempre)", { operacion: "participacion", sobre: [ventas[0].id], base: ventas[1].id }, "numerador_mayor_que_base");
  const dCuenta = await derivar(h, { operacion: "conteo", sobre: ids(ventas), condicion: { op: ">", valor: 0 } }, T);
  await noDeriva(h, T, "un conteo como numerador (5 de 13 no es una cantidad que se divida)", { operacion: "participacion", sobre: [dCuenta.hecho.id], base: totalVentas.id }, "derivacion_no_encadenable");
  await noDeriva(h, T, "un conteo dentro de una suma", { operacion: "suma", sobre: [dCuenta.hecho.id, dS.hecho.id] }, "derivacion_no_encadenable");
  const ctaMix = vencidos[0].entidad;
  const dMix = await derivar(hs, { operacion: "diferencia", sobre: [pendientes.find((x) => x.entidad === ctaMix).id, vencidos[0].id] }, T);
  await noDeriva(hs, T, "una derivación de dos métricas distintas (sin métrica única) dentro de una suma", { operacion: "suma", sobre: [dMix.hecho.id, pendientes[1].id] }, "metricas_distintas");
  /* money vs number ≠ 0 y el resto de lo de siempre siguen */
  await noDeriva(h, T, "(de siempre) conteo de dinero contra una cantidad suelta", { operacion: "conteo", sobre: ids(tres), condicion: { op: ">", valor: 5 } }, "condicion_invalida");
  const cDer = await derivar(h, { operacion: "conteo", sobre: [dS.hecho.id, dS2.hecho.id], condicion: { op: ">", valor: dSuma6.hecho.id } }, T);
  ok(cDer.ok && cDer.hecho.valor === "0 de 2", "un conteo puede comparar derivaciones contra otra derivación (ninguna de las dos sumas supera a la de las seis)", jj(cDer.hecho));
  /* otro período / moneda / carga a través del linaje: dos Entregas de la misma métrica, una derivación de cada una */
  for (const [motivo, f] of [["otro_periodo", (L) => { L.entregas[1].periodo = { texto: "otro", rango: "otro" }; }], ["otra_moneda", (L) => { L.entregas[1].moneda = "USD"; }], ["otra_carga", (L) => { L.entregas[1].versionId = 77; }]]) {
    const s2 = crearAlmacenEnMemoria(); const A2 = crearAcciones({ continuidad: s2 });
    conTenant(T);
    const c1 = await A2.consultar({ tenant: T, encargo: E([PARTE(["ventas"])]) }); const conv2 = c1.continuidad.conversacionId;
    await A2.consultar({ tenant: T, encargo: E([PARTE(["ventas"])], conv2) });
    const dA = await A2.derivar({ tenant: T, conversacionId: conv2, operacion: "suma", sobre: ["E1.h1", "E1.h2"] });
    const dB = await A2.derivar({ tenant: T, conversacionId: conv2, operacion: "suma", sobre: ["E2.h3", "E2.h4"] });
    const L = clon(await s2.leerLibro(T.id, conv2)); f(L); await s2.guardarLibro(T.id, L);
    const x = await A2.derivar({ tenant: T, conversacionId: conv2, operacion: "suma", sobre: [dA.hecho.id, dB.hecho.id] });
    ok(x.ok === false && x.motivo === motivo, `★ dos derivaciones cuyo LINAJE es de Entregas con ${motivo.replace("_", " ")}: «${motivo}»`, jj(x).slice(0, 300));
  }

  H(`11d · retomar revalida en CASCADA: si cambia una cifra, cambian la D y la D que sale de ella (${etiqueta})`);
  {
    const hr = await hilo(T, PASOS_COMERCIAL);
    const v = delMetrica(hr.ventas, "Venta");
    const dA = await derivar(hr, { operacion: "suma", sobre: ids(v.slice(0, 3)) }, T);
    const dB = await derivar(hr, { operacion: "diferencia", sobre: [dA.hecho.id, v[3].id] }, T);
    const dE = await derivar(hr, { operacion: "suma", sobre: ids(v.slice(0, 4)) }, T);
    const dC = await derivar(hr, { operacion: "participacion", sobre: [dA.hecho.id], base: dE.hecho.id }, T);
    ok(dA.ok && dB.ok && dC.ok, "(armado) D sobre cifras, D sobre D y una participación D ÷ D", jj([dA.hecho, dB.hecho, dC.hecho || dC]).slice(0, 400));
    const r0 = await hr.A.retomar({ tenant: T, conversacionId: hr.conv });
    const est = (r, id) => r.hechos.find((x) => x.id === id);
    ok([dA, dB, dC].every((d) => est(r0, d.hecho.id).estadoReverificacion === "igual"), "★ con el MISMO dato: las tres (incluidas las encadenadas) son «igual»", jj([dA, dB, dC].map((d) => est(r0, d.hecho.id).estadoReverificacion)));
    /* la venta de un operando cambia */
    const nombreOp = v[0].entidad;
    const ds2 = clon(T.dataset);
    const filaV = (ds2.clientesVentas || []).find((x) => x.nombre === nombreOp);
    if (filaV && filaV.actual != null) filaV.actual *= 0.5;   /* la venta VIGENTE del cliente (`clientesVentas.actual`, la única fuente): con la realidad única la venta ya no sale de `anterior` */
    const T2 = { ...T, dataset: ds2, version: 2 };
    const oHoy = crudosDelCore(T2, E([PARTE(["ventas"], "comercial")]));
    const cambio = rawDe(oHoy, "ventas", nombreOp) !== rawDe(oVentas, "ventas", nombreOp);
    conTenant(T2);
    const r2 = await hr.A.retomar({ tenant: T2, conversacionId: hr.conv });
    if (cambio) {
      const hoy = (x) => rawDe(oHoy, "ventas", x.entidad);
      const sumaHoy = v.slice(0, 3).reduce((a, x) => a + hoy(x), 0);
      const eA = est(r2, dA.hecho.id), eB = est(r2, dB.hecho.id);
      ok(eA.estadoReverificacion === "cambio" && eA.revalidacion.actual.raw === sumaHoy, "la D de abajo cambia (se recalcula con los crudos de hoy)", jj(eA).slice(0, 400));
      ok(eB.estadoReverificacion === "cambio" && eB.revalidacion.actual.valor === formatoDeLaCasa(sumaHoy - hoy(v[3]), "money") && eB.revalidacion.anterior.valor === dB.hecho.valor, `★ la D que sale de ella CAMBIA en cascada: ${dB.hecho.valor} → ${formatoDeLaCasa(sumaHoy - hoy(v[3]), "money")} (anterior, actual y diferencia los calcula ADI)`, jj(eB).slice(0, 500));
      ok(eB.revalidacion.diferencia && Math.abs(eB.revalidacion.diferencia.valor - ((sumaHoy - hoy(v[3])) - (v.slice(0, 3).reduce((a, x) => a + crudo(x), 0) - crudo(v[3])))) < 1e-6, "la diferencia de la cascada = actual − anterior");
      ok(!/\bD\d/.test(r2.lineaContinuidad || ""), "la línea de continuidad no nombra derivaciones (nombra la cifra que cambió)");
    } else console.log("   · (el cambio de la venta no mueve la cifra en este dato: se omite el «cambio» en cascada)");
    /* el operando de abajo ya no existe → toda la cadena deja de afirmarse vigente */
    const ds3 = clon(T.dataset);
    for (const kk of ["clientesVentas", "clientesMargen"]) if (Array.isArray(ds3[kk])) ds3[kk] = ds3[kk].filter((x) => x.nombre !== nombreOp);
    if (ds3.flujoComercial && ds3.flujoComercial.clientes) delete ds3.flujoComercial.clientes[nombreOp];
    const T3 = { ...T, dataset: ds3, version: 3 }; conTenant(T3);
    const r3 = await hr.A.retomar({ tenant: T3, conversacionId: hr.conv });
    ok([dA, dB, dC].every((d) => est(r3, d.hecho.id).estadoReverificacion === "no_se_revalida" && est(r3, d.hecho.id).valorNuevo === undefined && est(r3, d.hecho.id).revalidacion.actual === undefined), "★ si una cifra de la base de la cadena ya no se puede revalidar, TODA la cadena queda «no_se_revalida» (falla cerrado, sin valor nuevo)", jj([dA, dB, dC].map((d) => est(r3, d.hecho.id).estadoReverificacion)));
    conTenant(T);
    /* un libro adulterado con un ciclo (D1 ↔ D2) no cuelga la revalidación ni afirma nada */
    const sc = crearAlmacenEnMemoria(); const Ac = crearAcciones({ continuidad: sc });
    const cc = await Ac.consultar({ tenant: T, encargo: E([PARTE(["ventas"])]) }); const convC = cc.continuidad.conversacionId;
    await Ac.derivar({ tenant: T, conversacionId: convC, operacion: "suma", sobre: ["E1.h1", "E1.h2"] });
    await Ac.derivar({ tenant: T, conversacionId: convC, operacion: "diferencia", sobre: ["E1.h3", "E1.h4"] });
    const Lc = clon(await sc.leerLibro(T.id, convC));
    Lc.derivaciones[0].sobre = ["D2", "E1.h2"]; Lc.derivaciones[1].sobre = ["D1", "E1.h4"];
    await sc.guardarLibro(T.id, Lc);
    const rc = await Ac.retomar({ tenant: T, conversacionId: convC });
    ok(["D1", "D2"].every((id) => { const x = rc.hechos.find((y) => y.id === id); return x && x.estadoReverificacion !== "igual" && x.estadoReverificacion !== "cambio"; }), "★ un libro adulterado con un CICLO (D1 ↔ D2) termina y no afirma nada vigente", jj(rc.hechos.filter((x) => /^D/.test(x.id)).map((x) => [x.id, x.estadoReverificacion])));
  }
}

H("11e · lo que ve el anfitrión: el esquema de la herramienta lo dice, corto");
{
  const tool = MCP_TOOLS.find((t) => t.name === "derivar");
  ok(/derivaciones que ADI ya le devolvió \(D<k>\)/.test(tool.description) && /encadenar/.test(tool.description) && /use consultar\.$/.test(tool.description), "★ la descripción dice que acepta D<k> y que se encadenan, y sigue terminando en «use consultar.»", tool.description);
  ok(/D<k>/.test(tool.inputSchema.properties.sobre.description) && /varias de la misma métrica/.test(tool.inputSchema.properties.sobre.description) && /una o varias cifras sobre una base/.test(tool.inputSchema.properties.operacion.description), "el esquema de «sobre» y de «operacion» dicen los dos permisos nuevos (D<k> y varios numeradores)");
  ok(MOTIVOS_DE_DERIVACION.includes("derivacion_no_encadenable") && MOTIVOS_DE_DERIVACION.length === new Set(MOTIVOS_DE_DERIVACION).size, "el motivo nuevo está en la lista cerrada (sin repetidos)");
  ok(JSON.stringify(tool).length < 2400, `la herramienta sigue corta (${JSON.stringify(tool).length} B): dice lo nuevo sin crecer`);
}

H("CERO RED");
ok(clasificarFuente(fs.readFileSync(new URL(import.meta.url), "utf8")).tipo === "offline", "este gate se clasifica `offline` (autochequeo)");

console.log(`\n${fail === 0 ? "✓" : "✗"} _derivar_gate: ${pass} pass · ${fail} fail`);
process.exit(fail ? 1 : 0);
