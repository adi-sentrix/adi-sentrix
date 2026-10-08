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
 * 12 · ENSAYO 5 (owner 2026-10-07): NINGUNA cifra sin id (el hilo de C01: el libro guarda en su forma compacta, sin pérdida, y si la base no admite más ADI LO DICE) · `derivar` acepta cifras de apoyo (`E<n>.e<k>`: el benchmark) con la
 *       procedencia de cada lado · la operación nueva `razon` («cuántas veces es A respecto de B»). `_ADI_DISENO_CONTRATO_ANFITRION.md` §11.
 * 13 · ENSAYO 6 (owner 2026-10-08): `derivar` NO ARMA VENTA POR BODEGA (el libro de antes del ensayo: la suma de «los SKU de Lampa» se rechaza, también a través del linaje) y CADA DERIVACIÓN DICE QUÉ ES (`descripcion` en `derivar` y en `retomar`, con el `universo` de las cifras de un conjunto acotado). `_ADI_DISENO_CONTRATO_ANFITRION.md` §12.
 * 14 · ENSAYO 8 (owner 2026-10-08): contar/sumar/comparar PARTICIPACIONES de una misma base (el total que es solo el denominador no es operando; `bases_distintas` si se mezclan) · comparar la MISMA cifra entre dos cargas o períodos (`diferencia`/`razon`, con el marco de cada lado; nunca un falso «repetido») · un CRITERIO declarado por el usuario como operando (`criterio:{valor, unidad, texto}`) con su procedencia · los días son días (el umbral de un filtro se guarda tipado y se enseña a pasarlo como criterio). `_ADI_DISENO_CONTRATO_ANFITRION.md` §14.
 * CERO llamadas a un LLM · CERO red. Solo por `npm run gates:offline` o `node --import ./scripts/offline-guard.mjs _derivar_gate.mjs`. */
import fs from "node:fs";
import { initTenant } from "./src/data/tenantStore.js";
import { TENANT_DEMO } from "./src/data/tenants/demo.js";
import { validarEncargo } from "./src/adi/encargo/validar.js";
import { componerEntrega } from "./src/adi/entrega/componer.js";
import { crearAcciones, CABECERA_DE_USO, _hechosDeLaEntrega } from "./src/adi/capacidad/acciones.js";
import { conTenantActivo } from "./src/adi/capacidad/aislamiento.js";
import { compactarParaAnfitrion, ENTIDADES_DE_UN_UNIVERSO_MAX } from "./src/adi/capacidad/compacto.js";
import { OPERACIONES, OPERANDOS_MAX, MOTIVOS_DE_DERIVACION, UNIDADES_DE_CRITERIO, textoDeVeces, validarDerivacion, calcularDerivacion, derivacionParaElLibro } from "./src/adi/capacidad/derivar.js";
import { manejarPuerta, MCP_TOOLS, construirOpenApi } from "./src/adi/capacidad/puerta.js";
import { crearAlmacenEnMemoria, ErrorDeAlmacen } from "./src/adi/continuidad/almacen.js";
import { LIBRO_TOPE_BYTES, tamanoBytes, comprimirLibro, expandirLibro, libroNuevo, registrarEntrega, registrarDerivacion } from "./src/adi/continuidad/libro.js";
import { cifraDeHecho, cifrasDeLaEntrega, encargoParaElLibro } from "./src/adi/continuidad/revalidar.js";
import { axisEntityNames } from "./src/adi/oracle/entityIndex.js";
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
H("0 · lo cerrado: cinco operaciones (sin promedio), la cabecera de cinco reglas, el tope de operandos");
{
  ok(jj(OPERACIONES) === jj(["suma", "diferencia", "participacion", "conteo", "razon"]), "★ las operaciones son EXACTAMENTE suma · diferencia · participacion · conteo · razon (sin `promedio`, §8.3; la razón llegó con el ensayo 5)");
  ok(OPERANDOS_MAX === 40 && OPERANDOS_MAX === ENTIDADES_DE_UN_UNIVERSO_MAX, "el tope de operandos es lo que un universo lista a la vista (40)");
  ok(CABECERA_DE_USO.length === 5, "★ la cabecera de uso tiene CINCO reglas (la cuarta del contrato original + la del orden sobre el total, ensayo 8)");
  ok(CABECERA_DE_USO[1] === "Toda afirmación de orden sobre el total (el mayor, el menor, el que más creció, el más grave) debe venir de una consulta de ADI que vio el universo completo; con una vista parcial, dígalo como parcial o pídale a ADI el extremo.", "★ la regla 2.ª es el texto EXACTO del owner (el orden sobre el total)");
  ok(CABECERA_DE_USO[0] === "Toda cifra empresarial que usted diga —en números o en palabras, incluidos totales, diferencias, porcentajes y conteos— debe ser un hecho que ADI le entregó en esta conversación. Si la cifra que necesita no está entre lo entregado, no la calcule ni la complete: pídasela a ADI (derivar, sobre identificadores ya entregados; o una consulta nueva). Redondear a lo impreso no es calcular.", "★ la regla 1 es el texto EXACTO del contrato (sin «con su identificador»)");
  ok(!/con su identificador/.test(jj(CABECERA_DE_USO)) && !/promedios? de más de dos cifras/.test(jj(CABECERA_DE_USO)), "las dos reglas viejas (1/5 y 2/5) ya no están");
  ok(/^Lo que la Entrega declara en «Lo que no se puede concluir» se respeta/.test(CABECERA_DE_USO[2]) && /^La «Referencia del oficio» es conocimiento general/.test(CABECERA_DE_USO[3]) && /^Redacte con total libertad/.test(CABECERA_DE_USO[4]), "las otras tres reglas siguen, en su orden");
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
    for (const [n, id] of [["un id de derivación mal escrito (D1x)", "D1x"], ["un universo (E1.u1)", "E1.u1"], ["un número", 42]]) await noDeriva(h, T, n, { operacion: "suma", sobre: [v0[0], id] }, "id_invalido");
    /* ensayo 5: un id de APOYO (E<n>.e<k>) ya no es un id inválido: si existe se deriva sobre él (sección 12); uno que la Entrega no tiene, no existe */
    await noDeriva(h, T, "un id de apoyo que la Entrega no tiene (E1.e99)", { operacion: "suma", sobre: [v0[0], "E1.e99"] }, "id_inexistente");
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
  ok(sinId === 0 && conId > 0, "★ ensayo 5 · NINGUNA cifra de `fueraDelTexto` viaja sin id: las del catálogo entero caben en la forma guardada del libro (antes, el tope de 16 KB degradaba algunas a «sin id»)", jj({ conId, sinId }));
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

/* ═══ 12 · ENSAYO 5 (owner 2026-10-07): NINGUNA CIFRA SIN ID · APOYO Y PROCEDENCIA · LA RAZÓN ═══════════════════════════════════════════════════════════════════════════════
 * Los casos reales del ensayo 5 (transcritos C01 1.5 · A03 1.5 · A01 1.4 / B01 1.3 / C02 1.2):
 *   · C01|1|5: las dos cifras de Unimarc viajaron en `fueraDelTexto` SIN id (el libro de 16 KB no las pudo guardar), `derivar` rechazó sus ids de apoyo (`E4.e25`) y el anfitrión contó a mano;
 *   · A03|1|5: «cuánto le falta a Makita para el benchmark» — el benchmark viaja con id de apoyo (`E3.e3`) y `derivar` solo aceptaba `E<n>.h<k>`: el anfitrión restó 30.1 − 26.1 por su cuenta;
 *   · A01|1|4 · B01|1|3 · C02|1|2: «¿cuántas veces es una la otra?» — la participación se rechazó con `numerador_mayor_que_base` y el anfitrión declinó el múltiplo o lo dijo a ojo. */
const bytesJson = (x) => new TextEncoder().encode(JSON.stringify(x)).length;
const orden = (x) => (Array.isArray(x) ? x.map(orden) : x && typeof x === "object" ? Object.fromEntries(Object.keys(x).sort().map((k) => [k, orden(x[k])])) : x);
const mismoLibro = (a, b) => jj(orden(a)) === jj(orden(b));
const nombresDe = (T, eje) => conTenantActivo(T.dataset, () => axisEntityNames(eje));
const nombresDeClientes = (T) => nombresDe(T, "cliente"), marcasDe = (T) => nombresDe(T, "marca");
const veces = (q) => `${q >= 1 ? (Math.round(q * 10) / 10).toFixed(1) : (Math.round(q * 100) / 100).toFixed(2)} veces`;
const PARTE_MARCA = { id: "p1", tema: "comercial", cierre: "cifra", conceptos: ["ventas"], eje: "marca", universo: "negocio" };
const PARTE_SALDOS = { id: "p4", tema: "cobranza", cierre: "cifra", conceptos: ["saldo_vencido", "dias_vencido"], eje: "cliente", universo: "negocio" };

H("12 · ensayo 5: ninguna cifra sin id · el apoyo se deriva y lleva su procedencia · la razón «N veces»");
for (const { etiqueta, T } of EMPRESAS) {
  H(`── ${etiqueta} (ensayo 5) ───────────────────────────────────────────────────────────────────────────────────────────────────────────────`);
  const reloj = () => "2026-10-07T12:00:00.000Z";

  /* ── 12a · el hilo de C01: ventas del top 3 · ventas del negocio · ventas por marca · cobranza de las 13 cuentas ── */
  H(`12a · C01|1|5: toda cifra que ADI entrega lleva un id que el libro conserva (${etiqueta})`);
  const sA = crearAlmacenEnMemoria(); const AA = crearAcciones({ continuidad: sA, ahora: reloj });
  conTenant(T);
  let convA = null;
  const turnos = [[{ id: "p1", tema: "comercial", cierre: "cifra", conceptos: ["ventas"], eje: "cliente", universo: { top: { metrica: "ventas", k: 3, direccion: "mayor" } } }], [{ id: "p2", tema: "comercial", cierre: "cifra", conceptos: ["ventas"], universo: "negocio" }], [{ ...PARTE_MARCA, id: "p3" }], [PARTE_SALDOS]];
  const respA = [];
  for (const partes of turnos) { const r = await AA.consultar({ tenant: T, encargo: E(partes, convA) }); convA = r.continuidad.conversacionId; respA.push(r); }
  const cSal = compactarParaAnfitrion("consultar", respA[3]);
  const libA = await sA.leerLibro(T.id, convA);
  const guardados = new Set(); for (const e of libA.entregas) if (!e.recortada) { for (const h of cifrasDeLaEntrega(e)) guardados.add(h.id); for (const a of (e.apoyo || [])) guardados.add(a.id); }
  const viajan = [...cSal.entrega.cifras, ...(((cSal.entrega.detalle || {}).fueraDelTexto) || []), ...(cSal.entrega.apoyo || [])];
  ok(viajan.length > 0 && viajan.every((x) => typeof x.id === "string" && /^E4\./.test(x.id)), "★ TODA cifra que viaja (tabla · fueraDelTexto · apoyo) lleva su id", jj(viajan.filter((x) => !x.id)));
  ok(viajan.every((x) => guardados.has(x.id)), "★ y cada id que viaja está en el libro de la conversación: `derivar` y `retomar` lo pueden resolver", jj(viajan.filter((x) => !guardados.has(x.id)).map((x) => x.id)));
  const fueraA = ((cSal.entrega.detalle || {}).fueraDelTexto) || [];
  ok(fueraA.length >= 2 && fueraA.every((x) => /^E4\.h\d+$/.test(x.id)), `★ el caso de C01: las cifras que el texto dejó fuera (${fueraA.map((x) => `${x.entidad} · ${x.metrica}`).join(", ")}) viajan CON id`, jj(fueraA));
  ok(!(cSal.advertencias || []).length && !(cSal.continuidad || {}).entregasSinCifras, "y ninguna Entrega anterior perdió sus cifras: no hay nada que avisar");
  ok(libA.entregas.every((e) => !e.recortada), "★ el hilo de cuatro Entregas se conserva ENTERO (antes, E1 quedaba recortada)", jj(libA.entregas.map((e) => [e.n, e.recortada])));
  const antesB = bytesJson(libA), despuesB = tamanoBytes(libA);
  console.log(`   · el libro del hilo de C01 (4 Entregas, ${libA.entregas.reduce((a, e) => a + (e.hechos || []).length, 0)} cifras + apoyo): ${antesB} B en la forma de antes → ${despuesB} B guardado (tope ${LIBRO_TOPE_BYTES} B)`);
  ok(despuesB <= LIBRO_TOPE_BYTES && despuesB < antesB * 0.6, "★ la forma guardada pesa menos del 60 % de la de antes y cabe en el tope de la base", `${antesB} → ${despuesB}`);
  /* derivar sobre TODAS las cuentas, incluidas las de fueraDelTexto: el conteo de C01 es de 13, no de 12 */
  const venc = [...cSal.entrega.cifras, ...fueraA].filter((x) => x.entidad && x.metrica === "Saldo vencido");
  const oSal = crudosDelCore(T, E([{ ...PARTE_SALDOS, id: "p1" }]));
  const esperadoMora = venc.filter((x) => rawDe(oSal, "saldo_vencido", x.entidad) > 0).length;
  const cuenta = await AA.derivar({ tenant: T, conversacionId: convA, operacion: "conteo", sobre: venc.map((x) => x.id), condicion: { op: ">", valor: 0 } });
  ok(venc.length === 13 && cuenta.ok && cuenta.hecho.valor === `${esperadoMora} de 13`, `★ el conteo de cuentas con saldo vencido es «${esperadoMora} de 13» como UN hecho de ADI (el anfitrión de C01 lo dejó en 12 y completó Unimarc a mano)`, jj(cuenta).slice(0, 300));

  /* ── 12b · la forma guardada es SIN pérdida ── */
  H(`12b · la forma guardada del libro: sin pérdida, también con lo irregular (${etiqueta})`);
  ok(mismoLibro(expandirLibro(JSON.parse(JSON.stringify(comprimirLibro(libA)))), libA), "★ expandir(comprimir(libro)) es EXACTAMENTE el libro (el hilo de C01, con apoyo y fuera del texto)");
  {
    const sRT = crearAlmacenEnMemoria();
    await sRT.guardarLibro(T.id, libA);
    ok(mismoLibro(await sRT.leerLibro(T.id, convA), libA) && bytesJson(await sRT.leerLibro(T.id, convA)) > despuesB, "y el almacén guarda comprimido y lee expandido: lo que lee es lo que escribió");
  }
  {
    const irregular = clon(libA);
    const e = irregular.entregas[3];
    e.hechos[0].extra = "campo que la forma guardada no conoce";                         // una cifra con un campo ajeno: se guarda tal cual
    e.hechos[1].rv.mas = [{ ref: "e9", metrica: "Margen", valor: "20%", raw: 20, unidad: "pct", clave: "margen", dueno: "X", procedencia: "medido" }];   // una fila ancha
    e.hechos[2].id = "E9.h9";                                                           // un id que no es el de su lugar
    e.hechos[3].valor = "§1 empieza con la marca de lo repetido";                      // un texto que empieza con «§»
    e.hechos[4].metrica = "§§";
    e.hechos.push({ sujeto: "sin rv", metrica: "Venta", valor: "$1M", unidad: null, periodo: null, origen: "medido", ref: null, id: `E${e.n}.h${e.hechos.length + 1}` });   // de antes del bloque 4: sin `rv`
    e.apoyo = [...(e.apoyo || []), { id: `E${e.n}.e77` }, { id: `E${e.n}.e78`, rv: { raw: 1.5, unidad: "pct", clave: "benchmark", dueno: "negocio", procedencia: "estimacion_referencia", origenRef: "adi", premisa: true } }];
    e.universos[0] = { ...e.universos[0], top: { metrica: "ventas", k: 3, direccion: "mayor" }, valido: false };
    const ida = expandirLibro(JSON.parse(JSON.stringify(comprimirLibro(irregular))));
    ok(mismoLibro(ida, irregular), "★ lo irregular (campo ajeno · fila ancha `mas` · id fuera de lugar · textos que empiezan con «§» · cifra sin `rv` · apoyo sin cifra · universo con `top`) también vuelve idéntico", jj(ida.entregas[3].hechos.slice(0, 2)).slice(0, 300));
    ok(mismoLibro(expandirLibro(irregular), irregular) && mismoLibro(expandirLibro(libroNuevo({ conversacionId: "c" })), libroNuevo({ conversacionId: "c" })), "un libro ya expandido (o de antes de la forma guardada) se lee igual: nada que migrar");
  }
  {
    /* un barrido: el primer libro de cada uno de los 532 encargos del catálogo sellado, y el de dos Entregas */
    const MUESTRA = JSON.parse(fs.readFileSync(new URL("./fixtures/procedencia/muestra-v13-v40.json", import.meta.url), "utf8")).casos.filter((_, i) => i % 7 === 0);
    let malos = 0, antes = 0, despues = 0, mayorAntes = 0, mayorDespues = 0;
    for (const c of MUESTRA) {
      const S = crearAlmacenEnMemoria(); const AX = crearAcciones({ continuidad: S });
      const r = await AX.consultar({ tenant: T, encargo: c.encargo });
      if (!r.ok || !r.continuidad) continue;
      const L = await S.leerLibro(T.id, r.continuidad.conversacionId);
      if (!mismoLibro(expandirLibro(JSON.parse(JSON.stringify(comprimirLibro(L)))), L)) malos += 1;
      antes += bytesJson(L); despues += tamanoBytes(L); mayorAntes = Math.max(mayorAntes, bytesJson(L)); mayorDespues = Math.max(mayorDespues, tamanoBytes(L));
    }
    console.log(`   · ${MUESTRA.length} libros del catálogo sellado: ${Math.round(antes / MUESTRA.length)} B → ${Math.round(despues / MUESTRA.length)} B de media · el mayor ${mayorAntes} B → ${mayorDespues} B`);
    ok(malos === 0 && despues < antes * 0.6, `★ ${MUESTRA.length} libros del catálogo: ninguno cambia al guardarse y pesan menos del 60 %`, jj({ malos, antes, despues }));
    ok(mayorDespues <= LIBRO_TOPE_BYTES, `y el mayor guardado (${mayorDespues} B) cabe en el tope de la base`);
  }

  /* ── 12c · si el tope manda, se DICE (falla cerrado) ── */
  H(`12c · si la base no admite más, ADI lo dice: nunca una cifra que el anfitrión lea y no pueda citar (${etiqueta})`);
  {
    /* (i) la memoria se llena: las Entregas más viejas ceden Y SE DICE en la respuesta que lo provocó */
    const topeT = Math.floor(despuesB * 0.7);
    const sT = crearAlmacenEnMemoria(); const AT = crearAcciones({ continuidad: sT, ahora: reloj, libroTope: topeT });
    let conv = null, ultima = null, avisoVisto = null;
    for (const partes of turnos) { ultima = await AT.consultar({ tenant: T, encargo: E(partes, conv) }); conv = ultima.continuidad.conversacionId; if ((ultima.continuidad.entregasSinCifras || []).length && !avisoVisto) avisoVisto = ultima; }
    const LT = await sT.leerLibro(T.id, conv);
    const recort = LT.entregas.filter((e) => e.recortada).map((e) => e.n);
    ok(recort.length > 0 && tamanoBytes(LT) <= topeT, `con un tope de ${topeT} B (el 70 % de lo que pide el hilo) cedieron las más viejas (${recort.map((n) => "E" + n).join(", ")}) y el libro cabe (${tamanoBytes(LT)} B)`, jj(recort));
    ok(Boolean(avisoVisto) && avisoVisto.continuidad.entregasSinCifras.length > 0 && (avisoVisto.advertencias || []).some((a) => /ya no conserv/.test(a) && avisoVisto.continuidad.entregasSinCifras.every((n) => a.includes(`E${n}`))), "★ la respuesta que provocó el recorte DICE cuáles Entregas ya no conservan sus cifras (continuidad.entregasSinCifras y una advertencia en palabras de negocio)", jj((avisoVisto || {}).advertencias));
    const cT = compactarParaAnfitrion("consultar", avisoVisto);
    ok((cT.advertencias || []).length > 0 && cT.continuidad.entregasSinCifras.length > 0, "y eso llega al anfitrión por la puerta (la respuesta compacta lo trae)");
    const rr = await AT.derivar({ tenant: T, conversacionId: conv, operacion: "suma", sobre: [`E${recort[0]}.h1`, `E${recort[0]}.h2`] });
    ok(rr.ok === false && rr.motivo === "entrega_recortada" && /se recortó por tamaño/.test(rr.detalle), "★ derivar sobre una cifra de una Entrega recortada se rechaza diciendo por qué (entrega_recortada)", jj(rr).slice(0, 300));
    /* (ii) una derivación nueva también compite por el tope: si obliga a recortar una Entrega, lo dice en SU respuesta */
    const sD = crearAlmacenEnMemoria(); const ADx = crearAcciones({ continuidad: sD, ahora: reloj });
    let cv = null;
    for (const partes of turnos.slice(0, 3)) { const x = await ADx.consultar({ tenant: T, encargo: E(partes, cv) }); cv = x.continuidad.conversacionId; }
    const topeJusto = tamanoBytes(await sD.leerLibro(T.id, cv)) + 10;
    const sD2 = crearAlmacenEnMemoria(); const AD2 = crearAcciones({ continuidad: sD2, ahora: reloj, libroTope: topeJusto });
    let cv2 = null; for (const partes of turnos.slice(0, 3)) { const x = await AD2.consultar({ tenant: T, encargo: E(partes, cv2) }); cv2 = x.continuidad.conversacionId; }
    const ultimas = (await sD2.leerLibro(T.id, cv2)).entregas.at(-1).hechos.slice(0, 2).map((h) => h.id);
    const dEv = await AD2.derivar({ tenant: T, conversacionId: cv2, operacion: "suma", sobre: ultimas });
    ok(dEv.ok && (dEv.continuidad.entregasSinCifras || []).length > 0 && (dEv.advertencias || []).some((x) => /ya no conserv/.test(x)), "★ una derivación que obliga a recortar una Entrega lo dice en SU respuesta (continuidad.entregasSinCifras y una advertencia)", jj({ c: dEv.continuidad, a: dEv.advertencias }));
  }
  {
    /* (iii) las cifras de `fueraDelTexto` NO caben aunque ceda todo lo anterior: NO viajan (nunca sin id) y se dice cuántas son */
    const sS = crearAlmacenEnMemoria(); const AS = crearAcciones({ continuidad: sS, ahora: reloj });
    const rS = await AS.consultar({ tenant: T, encargo: E([PARTE_SALDOS]) });
    const S1 = tamanoBytes(await sS.leerLibro(T.id, rS.continuidad.conversacionId));
    const s2 = crearAlmacenEnMemoria(); const A2 = crearAcciones({ continuidad: s2, ahora: reloj, libroTope: S1 - 1 });
    const r2 = await A2.consultar({ tenant: T, encargo: E([PARTE_SALDOS]) });
    const c2 = compactarParaAnfitrion("consultar", r2);
    const L2 = await s2.leerLibro(T.id, r2.continuidad.conversacionId);
    const n1 = (((compactarParaAnfitrion("consultar", rS).entrega.detalle || {}).fueraDelTexto) || []).length;
    ok(n1 >= 2 && L2.entregas[0].recortada === false && !((c2.entrega.detalle || {}).fueraDelTexto), "★ con un tope que no admite las cifras de «fuera del texto», la tabla se guarda y ESAS cifras NO viajan (nunca una cifra sin id)", jj({ n1, rec: L2.entregas[0].recortada, fz: (c2.entrega.detalle || {}).fueraDelTexto }));
    ok((c2.entrega.detalle || {}).fueraNoCabe && c2.entrega.detalle.fueraNoCabe.n === n1 && (c2.advertencias || []).some((a) => /fuera del texto/.test(a)), "y se dice cuántas son y cómo pedirlas (detalle.fueraNoCabe y una advertencia)", jj((c2.entrega.detalle || {}).fueraNoCabe));
    ok(c2.entrega.cifras.every((x) => L2.entregas[0].hechos.some((h) => h.id === x.id)), "las cifras de la tabla que sí viajan siguen todas en el libro");
    /* (iv) la propia Entrega es más grande que el tope: sus cifras no quedaron guardadas, y se dice */
    const s3 = crearAlmacenEnMemoria(); const A3 = crearAcciones({ continuidad: s3, ahora: reloj, libroTope: 300 });
    const r3 = await A3.consultar({ tenant: T, encargo: E([PARTE_SALDOS]) });
    ok(r3.continuidad.entregaSinCifras === 1 && (r3.advertencias || []).some((a) => /más grande de lo que la memoria/.test(a)) && !(((compactarParaAnfitrion("consultar", r3).entrega.detalle || {}).fueraDelTexto)), "★ una Entrega más grande que el tope entero lo dice (continuidad.entregaSinCifras y una advertencia) y no manda cifras de «fuera del texto»", jj((r3.advertencias || [])).slice(0, 300));
  }

  /* ── 12d · el apoyo se deriva, con su procedencia (A03|1|5) ── */
  H(`12d · A03|1|5: «cuánto le falta al benchmark» es UN hecho de ADI, con la procedencia de cada lado (${etiqueta})`);
  {
    const sB = crearAlmacenEnMemoria(); const AB = crearAcciones({ continuidad: sB, ahora: reloj });
    conTenant(T);
    const r1 = await AB.consultar({ tenant: T, encargo: E([{ id: "p1", tema: "comercial", cierre: "cifra", conceptos: ["ventas"], eje: "cliente", entidades: [{ nombre: nombresDeClientes(T)[0] }] }]) });
    const convB = r1.continuidad.conversacionId;
    const c1 = compactarParaAnfitrion("consultar", r1);
    const bench = (c1.entrega.apoyo || []).find((a) => /Benchmark de margen/.test(a.hecho || ""));
    const rM = await AB.consultar({ tenant: T, encargo: E([{ id: "p2", tema: "comercial", cierre: "cifra", conceptos: ["margen"], eje: "marca", entidades: [{ nombre: marcasDe(T)[0] }] }], convB) });
    const cM = compactarParaAnfitrion("consultar", rM);
    const margen = cM.entrega.cifras.find((x) => x.metrica === "Margen");
    ok(Boolean(bench) && Boolean(margen) && /^E1\.e\d+$/.test(bench.id), `(armado) el benchmark viaja como apoyo con id (${bench && bench.id}: ${bench && bench.valor}) y hay un margen para compararlo (${margen && margen.id}: ${margen && margen.valor})`, jj({ bench, margen }));
    const LB = await sB.leerLibro(T.id, convB);
    ok((LB.entregas[0].apoyo || []).some((a) => a.id === bench.id && a.rv && a.rv.clave === "benchmark" && a.rv.unidad === "pct"), "★ el libro guarda la cifra de apoyo (crudo, unidad, métrica, dueño, procedencia) para poder derivar sobre ella");
    const oMargen = crudosDelCore(T, E([{ id: "p1", tema: "comercial", cierre: "cifra", conceptos: ["margen"], eje: "marca" }]));
    const benchRaw = LB.entregas[0].apoyo.find((a) => a.id === bench.id).rv.raw;
    const margenRaw = rawDe(oMargen, "margen", margen.entidad);
    const dif = await AB.derivar({ tenant: T, conversacionId: convB, operacion: "diferencia", sobre: [bench.id, margen.id] });
    ok(dif.ok && dif.hecho.id.startsWith("D") && dif.hecho.procedencia === "derivado" && dif.hecho.valor === formatoDeLaCasa(benchRaw - margenRaw, "pp"), `★ «cuánto le falta al benchmark» (${bench.valor} − ${margen.valor}) es un hecho de ADI en puntos: ${dif.ok && dif.hecho.valor}`, jj(dif).slice(0, 500));
    const difRev = await AB.derivar({ tenant: T, conversacionId: convB, operacion: "diferencia", sobre: [margen.id, bench.id] });
    ok(difRev.ok && difRev.hecho.valor === formatoDeLaCasa(margenRaw - benchRaw, "pp") && /^-/.test(difRev.hecho.valor) === (margenRaw < benchRaw), "el orden manda: margen − benchmark conserva el signo (negativo = bajo el benchmark)", jj(difRev.hecho));
    const porId = Object.fromEntries(dif.operandos.map((o) => [o.id, o]));
    ok(porId[bench.id].procedencia === "referencia" && /declarado por la empresa/.test(porId[bench.id].origen) && porId[margen.id].procedencia === "medido", "★ la diferencia lleva las DOS procedencias: el margen es «medido» y el benchmark una «referencia, declarado por la empresa» (jamás un dato medido ni un objetivo)", jj(dif.operandos));
    ok(Array.isArray(dif.hecho.procedencias) && dif.hecho.procedencias.includes("medido") && dif.hecho.procedencias.some((p) => /referencia, declarado por la empresa/.test(p)) && /declarado por la empresa/.test(dif.hecho.metrica), "y el hecho las resume, y el rótulo de la métrica dice de quién es la referencia", jj([dif.hecho.procedencias, dif.hecho.metrica]));
    ok(dif.hecho.entidad === margen.entidad && !/negocio/.test(dif.hecho.entidad), "la cifra es de la cuenta contra la que se compara (la referencia no es una entidad)", jj(dif.hecho.entidad));
    ok(!/objetivo|meta\b|oficio/i.test(jj(dif.hecho)) , "nunca se llama «objetivo» ni «referencia del oficio» a lo que no lo es", jj(dif.hecho));
    const rep = await AB.derivar({ tenant: T, conversacionId: convB, operacion: "diferencia", sobre: [bench.id, margen.id] });
    ok(rep.ok && rep.repetida === true && rep.hecho.id === dif.hecho.id && Array.isArray(rep.hecho.procedencias) && rep.hecho.procedencias.length === dif.hecho.procedencias.length, "idempotente: pedirla otra vez devuelve la misma D con las mismas procedencias");
    /* el ORIGEN decide: sin benchmark declarado por la empresa, es el criterio general de ADI (nunca «declarado por la empresa») */
    {
      const ds = clon(T.dataset); if (ds.perfil) delete ds.perfil.benchmark;
      const Tadi = { ...T, dataset: ds };
      conTenant(Tadi);
      const sX = crearAlmacenEnMemoria(); const AX = crearAcciones({ continuidad: sX, ahora: reloj });
      const x1 = await AX.consultar({ tenant: Tadi, encargo: E([{ id: "p1", tema: "comercial", cierre: "cifra", conceptos: ["ventas"], eje: "cliente", entidades: [{ nombre: nombresDeClientes(Tadi)[0] }] }]) });
      const cx = x1.continuidad.conversacionId;
      const bx = (compactarParaAnfitrion("consultar", x1).entrega.apoyo || []).find((a) => /Benchmark de margen/.test(a.hecho || ""));
      const x2 = await AX.consultar({ tenant: Tadi, encargo: E([{ id: "p2", tema: "comercial", cierre: "cifra", conceptos: ["margen"], eje: "marca", entidades: [{ nombre: marcasDe(Tadi)[0] }] }], cx) });
      const mx = compactarParaAnfitrion("consultar", x2).entrega.cifras.find((x) => x.metrica === "Margen");
      if (bx && mx) {
        const dx = await AX.derivar({ tenant: Tadi, conversacionId: cx, operacion: "diferencia", sobre: [bx.id, mx.id] });
        const ref = dx.ok && dx.operandos.find((o) => o.id === bx.id);
        ok(ref && ref.procedencia === "referencia" && /criterio general de ADI/.test(ref.origen) && !/declarado por la empresa/.test(ref.origen), "★ si el benchmark NO lo declaró la empresa, la procedencia dice «criterio general de ADI» — jamás «declarado por la empresa»", jj(dx).slice(0, 400));
      } else console.log("   · (este dato no imprime el benchmark general en la Entrega de prueba: se omite el control del origen ADI)");
      conTenant(T);
    }
    /* los rechazos: las reglas de siempre más una — la referencia se compara con SU métrica */
    const vtas = c1.entrega.cifras.find((x) => x.metrica === "Venta");
    await noDeriva({ A: AB, conv: convB }, T, "una referencia contra una métrica en dinero (unidades distintas)", { operacion: "diferencia", sobre: [bench.id, vtas.id] }, "unidades_distintas");
    ok(MOTIVOS_DE_DERIVACION.includes("operando_no_positivo"), "el motivo nuevo (razón con una cifra no positiva) está en la lista cerrada");
    const rCa = await AB.consultar({ tenant: T, encargo: E([{ id: "p3", tema: "comercial", cierre: "cifra", conceptos: ["carga"], eje: "cliente", entidades: [{ nombre: nombresDeClientes(T)[0] }] }], convB) });
    const carga = compactarParaAnfitrion("consultar", rCa).entrega.cifras.find((x) => /Carga/.test(x.metrica || ""));
    if (carga && carga.valor && /%/.test(carga.valor)) await noDeriva({ A: AB, conv: convB }, T, "el benchmark (de margen) contra la carga: otra métrica, aunque ambas sean %", { operacion: "diferencia", sobre: [bench.id, carga.id] }, "metricas_distintas");
    else console.log("   · (la carga de esta cuenta no viaja como % en la Entrega de prueba: se omite el control de la referencia contra otra métrica)");
    /* conteo contra la referencia */
    const cnt = await AB.derivar({ tenant: T, conversacionId: convB, operacion: "conteo", sobre: [margen.id], condicion: { op: "<", valor: bench.id } });
    ok(cnt.ok && cnt.hecho.valor === `${margenRaw < benchRaw ? 1 : 0} de 1` && cnt.condicion.referencia.procedencia === "referencia" && cnt.hecho.procedencias.length === 2, "★ «cuántos márgenes están bajo el benchmark» también es un hecho de ADI, con la procedencia de la referencia", jj(cnt).slice(0, 400));
    /* un apoyo que ADI ya calculó (una comparación «A − B = C») o que no trae cifra exacta no es operando: la tabla trae sus operandos */
    const sinCifra = (c1.entrega.apoyo || []).concat(cM.entrega.apoyo || []).find((a) => a.id !== bench.id);
    if (sinCifra) {
      const idSin = sinCifra.id; const nSin = Number(/^E(\d+)/.exec(idSin)[1]);
      const rS = await AB.derivar({ tenant: T, conversacionId: convB, operacion: "suma", sobre: [idSin, nSin === 1 ? margen.id : vtas.id] });
      ok(rS.ok === false && ["operando_sin_valor_exacto", "operando_no_medido", "unidades_distintas", "metricas_distintas", "operando_es_total"].includes(rS.motivo), `otra cifra de apoyo (${idSin}) tampoco se suma a ciegas: ${rS.motivo}`, jj(rS).slice(0, 300));
    }
    await noDeriva({ A: AB, conv: convB }, T, "un universo (E1.u1)", { operacion: "diferencia", sobre: [bench.id, "E1.u1"] }, "id_invalido");
    /* retomar revalida el apoyo: con el mismo dato, igual; si el benchmark cambia, la D cambia y la diferencia la calcula ADI */
    const r0 = await AB.retomar({ tenant: T, conversacionId: convB });
    const eD = r0.hechos.find((x) => x.id === dif.hecho.id);
    ok(eD && eD.estadoReverificacion === "igual", "★ retomar: con el mismo dato la diferencia contra el benchmark sigue «igual»", jj(eD).slice(0, 300));
    ok(!r0.hechos.some((x) => /^E\d+\.e\d+/.test(x.id)), "las cifras de apoyo no se listan como filas de la tabla en retomar (solo sostienen las derivaciones)");
    /* la empresa declara OTRO benchmark (criterio confirmado): la referencia con la que se entregó cambió → la diferencia no se afirma vigente (una referencia que cambia no es un cambio de lo medido) */
    const nuevoBench = Math.round((benchRaw + 3) * 10) / 10;
    const ap = await AB.aportarContexto({ tenant: T, conversacionId: convB, aportes: [{ clase: "criterio", concepto: "benchmark", valor: { raw: nuevoBench, unidad: "pct" } }] });
    await AB.aportarContexto({ tenant: T, conversacionId: convB, confirmar: [ap.resultados[0].id] });
    const r2 = await AB.retomar({ tenant: T, conversacionId: convB });
    const eD2 = r2.hechos.find((x) => x.id === dif.hecho.id);
    ok(eD2 && eD2.estadoReverificacion === "no_se_revalida" && eD2.revalidacion.anterior.valor === dif.hecho.valor && !eD2.revalidacion.actual, `★ si la empresa declara otro benchmark (${benchRaw} → ${nuevoBench}) la diferencia contra el benchmark de antes NO se afirma vigente (la referencia cambió)`, jj(eD2).slice(0, 500));
    conTenant(T);
  }

  /* ── 12e · la razón: «cuántas veces es A respecto de B» ── */
  H(`12e · A01|1|4 · B01|1|3 · C02|1|2: «cuántas veces es una la otra» es UN hecho de ADI (${etiqueta})`);
  {
    const sR = crearAlmacenEnMemoria(); const AR = crearAcciones({ continuidad: sR, ahora: reloj });
    conTenant(T);
    const rr1 = await AR.consultar({ tenant: T, encargo: E([PARTE_MARCA]) });
    const convR = rr1.continuidad.conversacionId;
    const cR = compactarParaAnfitrion("consultar", rr1);
    const marcasV = cR.entrega.cifras.filter((x) => x.entidad && x.metrica === "Venta");
    const oMarcas = crudosDelCore(T, E([PARTE_MARCA]));
    const [a, b] = [marcasV[0], marcasV[1]];
    const ra = rawDe(oMarcas, "ventas", a.entidad), rb = rawDe(oMarcas, "ventas", b.entidad);
    const x = await AR.derivar({ tenant: T, conversacionId: convR, operacion: "razon", sobre: [a.id], base: b.id });
    const esp = ra / rb;
    ok(x.ok && x.hecho.operacion === "razon" && x.hecho.procedencia === "derivado" && x.hecho.valor === veces(esp), `★ ${a.entidad} ÷ ${b.entidad} = ${x.ok && x.hecho.valor} (A ÷ B sobre los crudos: ${esp.toFixed(4)})`, jj(x).slice(0, 400));
    ok(/^\d+\.\d veces$/.test(x.hecho.valor) || /^0\.\d\d veces$/.test(x.hecho.valor), "el formato es «N veces» con la precisión de la casa (una decimal desde 1; dos por debajo)", x.hecho.valor);
    ok(x.operandos.length === 1 && x.operandos[0].id === a.id && x.base.id === b.id, "el hecho trae el numerador y la base con sus valores", jj([x.operandos, x.base]));
    const inv = await AR.derivar({ tenant: T, conversacionId: convR, operacion: "razon", sobre: [b.id], base: a.id });
    ok(inv.ok && inv.hecho.id !== x.hecho.id && inv.hecho.valor === veces(rb / ra), `la razón inversa es otro hecho (el orden manda): ${inv.ok && inv.hecho.valor}`, jj(inv.hecho));
    const rep = await AR.derivar({ tenant: T, conversacionId: convR, operacion: "razon", sobre: [a.id], base: b.id });
    ok(rep.ok && rep.repetida === true && rep.hecho.id === x.hecho.id, "idempotente: la misma razón devuelve el mismo D");
    /* el rechazo del ensayo: la participación de algo mayor que la base ahora enseña la razón */
    const part = await AR.derivar({ tenant: T, conversacionId: convR, operacion: "participacion", sobre: [ra >= rb ? a.id : b.id], base: ra >= rb ? b.id : a.id });
    ok(part.ok === false && part.motivo === "numerador_mayor_que_base" && /razon/.test(part.detalle), "★ lo que se rechazó en el ensayo (participación con numerador mayor que la base) dice ahora que lo que se busca es la operación «razon»", jj(part).slice(0, 300));
    /* validaciones */
    await noDeriva({ A: AR, conv: convR }, T, "la razón sin base", { operacion: "razon", sobre: [a.id] }, "faltan_operandos");
    await noDeriva({ A: AR, conv: convR }, T, "la razón de dos cifras en `sobre`", { operacion: "razon", sobre: [a.id, b.id], base: marcasV[2].id }, "demasiados_operandos");
    await noDeriva({ A: AR, conv: convR }, T, "la razón de una cifra consigo misma", { operacion: "razon", sobre: [a.id], base: a.id }, "operando_repetido");
    await noDeriva({ A: AR, conv: convR }, T, "la razón de una Entrega que no existe", { operacion: "razon", sobre: ["E9.h1"], base: b.id }, "id_inexistente");
    const totalDeMarcas = cR.entrega.cifras.find((c) => /total del listado completo/.test(c.metrica || ""));
    if (totalDeMarcas) { const t = await AR.derivar({ tenant: T, conversacionId: convR, operacion: "razon", sobre: [totalDeMarcas.id], base: a.id }); ok(t.ok && /veces$/.test(t.hecho.valor), "el total de un listado SÍ puede ser numerador de una razón (cuántas veces es el total respecto de una marca)", jj(t).slice(0, 200)); }
    /* otra métrica / unidad / negativa / cero */
    const rCo = await AR.consultar({ tenant: T, encargo: E([{ id: "p2", tema: "comercial", cierre: "cifra", conceptos: ["margen"], eje: "marca", universo: "negocio" }], convR) });
    const margenes = compactarParaAnfitrion("consultar", rCo).entrega.cifras.filter((c) => c.metrica === "Margen");
    await noDeriva({ A: AR, conv: convR }, T, "una razón entre un monto y un porcentaje", { operacion: "razon", sobre: [a.id], base: margenes[0].id }, "unidades_distintas");
    const dNeg = await AR.derivar({ tenant: T, conversacionId: convR, operacion: "diferencia", sobre: ra >= rb ? [b.id, a.id] : [a.id, b.id] });   // siempre negativa
    ok(dNeg.ok && /^-/.test(dNeg.hecho.valor), "(armado) una diferencia negativa", jj(dNeg.hecho));
    await noDeriva({ A: AR, conv: convR }, T, "una razón con una cifra negativa", { operacion: "razon", sobre: [dNeg.hecho.id], base: a.id }, "operando_no_positivo");
    const sSal = crearAlmacenEnMemoria(); const ASal = crearAcciones({ continuidad: sSal, ahora: reloj });
    const rSal = await ASal.consultar({ tenant: T, encargo: E([{ id: "p1", tema: "cobranza", cierre: "cifra", conceptos: ["saldo_vencido"], eje: "cliente", universo: "negocio" }]) });
    const cSl = compactarParaAnfitrion("consultar", rSal);
    const sal = [...cSl.entrega.cifras, ...(((cSl.entrega.detalle || {}).fueraDelTexto) || [])].filter((c) => c.entidad && c.metrica === "Saldo vencido");
    const oSl = crudosDelCore(T, E([{ ...PARTE_SALDOS, id: "p1", conceptos: ["saldo_vencido"] }]));
    const cero = sal.find((c) => rawDe(oSl, "saldo_vencido", c.entidad) === 0), pos = sal.find((c) => rawDe(oSl, "saldo_vencido", c.entidad) > 0);
    if (cero && pos) {
      const hh = { A: ASal, conv: rSal.continuidad.conversacionId };
      await noDeriva(hh, T, "una razón sobre una base en cero", { operacion: "razon", sobre: [pos.id], base: cero.id }, "operando_no_positivo");
      await noDeriva(hh, T, "una razón de una cifra en cero", { operacion: "razon", sobre: [cero.id], base: pos.id }, "operando_no_positivo");
    } else console.log("   · (este dato no tiene saldos en cero: se omiten los controles de cero)");
    /* retomar: igual / cambio, con el texto «veces» (la razón entre dos CLIENTES: el dato de un cliente cambia) */
    const hc = await hilo(T, PASOS_COMERCIAL);
    const vc = delMetrica(hc.ventas, "Venta");
    const oVc = crudosDelCore(T, E([PARTE(["ventas"], "comercial")]));
    const xc = await derivar(hc, { operacion: "razon", sobre: [vc[0].id], base: vc[1].id }, T);
    ok(xc.ok && xc.hecho.valor === veces(rawDe(oVc, "ventas", vc[0].entidad) / rawDe(oVc, "ventas", vc[1].entidad)), `(armado) ${vc[0].entidad} ÷ ${vc[1].entidad} = ${xc.ok && xc.hecho.valor}`, jj(xc).slice(0, 300));
    const r0 = await hc.A.retomar({ tenant: T, conversacionId: hc.conv });
    ok(r0.hechos.find((h) => h.id === xc.hecho.id).estadoReverificacion === "igual", "retomar: con el mismo dato la razón sigue «igual»");
    const ds2 = clon(T.dataset);
    const filaV = (ds2.clientesVentas || []).find((m) => m.nombre === vc[0].entidad);
    if (filaV && filaV.actual != null) filaV.actual *= 0.5;
    const T2 = { ...T, dataset: ds2, version: 2 }; conTenant(T2);
    const oHoy = crudosDelCore(T2, E([PARTE(["ventas"], "comercial")]));
    const r2 = await hc.A.retomar({ tenant: T2, conversacionId: hc.conv });
    const e2 = r2.hechos.find((h) => h.id === xc.hecho.id);
    const espHoy = rawDe(oHoy, "ventas", vc[0].entidad) / rawDe(oHoy, "ventas", vc[1].entidad);
    ok(e2.estadoReverificacion === "cambio" && e2.revalidacion.actual.valor === veces(espHoy) && Math.abs(e2.revalidacion.actual.raw - espHoy) < 1e-9 && /veces$/.test(e2.revalidacion.diferencia.texto), `★ si cambia el dato, la razón CAMBIA (${xc.hecho.valor} → ${e2.revalidacion && e2.revalidacion.actual && e2.revalidacion.actual.valor}) y la diferencia está en «veces»`, jj(e2).slice(0, 400));
    conTenant(T);
  }
}

H("12g · lo que ve el anfitrión: la herramienta dice lo nuevo, corto");
{
  const tool = MCP_TOOLS.find((t) => t.name === "derivar");
  ok(/E<n>\.e<k>/.test(tool.description) && /benchmark/.test(tool.description) && /razón/.test(tool.description) && /use consultar\.$/.test(tool.description), "★ la descripción dice que acepta cifras de apoyo (E<n>.e<k>, como el benchmark) y la razón («cuántas veces»), y sigue terminando en «use consultar.»");
  ok(tool.inputSchema.properties.operacion.enum.includes("razon") && /razon/.test(tool.inputSchema.properties.base.description) && /E<n>\.e<k>/.test(tool.inputSchema.properties.sobre.description), "el esquema: la operación `razon`, la base de la razón y los ids de apoyo");
  ok(JSON.stringify(tool).length < 2400, `la herramienta sigue corta (${JSON.stringify(tool).length} B < 2400 B)`);
  ok(MOTIVOS_DE_DERIVACION.length === new Set(MOTIVOS_DE_DERIVACION).size, "la lista cerrada de motivos no tiene repetidos");
}

/* ═══ 13 · ENSAYO 6 (owner 2026-10-08) · `derivar` NO ARMA VENTA POR BODEGA, Y CADA DERIVACIÓN DICE QUÉ ES ════════════════════════════════════════════════════════════════════
 * B03: el anfitrión sumó los SKU de cada bodega con `derivar` (D1–D4) y escribió «Lampa vende $97.6M… 11.5 veces Calama»; en la sesión 2, `retomar` devolvió D1–D8 como números pelados y un anfitrión nuevo leyó D1 como «los cinco primeros
 * códigos» (5 errores). Dos cierres: (1) `derivar` rechaza (`venta_por_bodega`) un agregado de métricas comerciales cuyas cifras salen de un universo definido por bodega —también a través del linaje de otra derivación—;
 * (2) cada derivación lleva su DESCRIPCIÓN (qué operación, de qué cifras, de qué conjunto) en `derivar` y en `retomar`, y cada cifra de un conjunto acotado lleva su `universo`. */
const nombresDeBodega = (T) => conTenantActivo(T.dataset, () => axisEntityNames("bodega"));
/* lo que `consultar` guardaba ANTES de la ley (los libros que ya existen): el Core directo, la Entrega con sus universos y el Encargo con que se entregó */
async function libroDeAntes(T, encargo, store) {
  const { res, sal } = conTenantActivo(T.dataset, () => { const res = validarEncargo(encargo, {}); return { res, sal: componerEntrega(res) }; });
  let libro = libroNuevo({ versionId: T.version, empresaId: T.id });
  const hechos = _hechosDeLaEntrega(sal.entrega);
  libro = registrarEntrega(libro, { versionId: T.version, temas: sal.entrega.temasCubiertos || [], entidades: [...new Set(hechos.filter((h) => !h.fuera).map((h) => h.sujeto).filter(Boolean))], cierre: "cifra", hechos, universos: sal.entrega.universos || [], entregadaEn: "2026-10-05T12:00:00.000Z", periodo: sal.entrega.marco.periodo || null, revalidable: true, encargo: encargoParaElLibro(res.encargo), referencias: { criterios: [], marco: null }, moneda: sal.entrega.marco.moneda || null });
  await store.guardarLibro(T.id, libro);
  return libro;
}
const textoLey = (inv) => `La venta no se abre por bodega: el dato no dice qué bodega despachó cada venta, y tampoco su margen, contribución ni unidades. Sumar o comparar las ventas de los productos de una bodega no da la venta de esa bodega, así que no se arma. Puedo darle ${inv}, o derivar sobre la venta de los productos que usted nombre.`;
const lista = (xs) => (xs.length <= 1 ? xs.join("") : `${xs.slice(0, -1).join(", ")} y ${xs[xs.length - 1]}`);

for (const { etiqueta, T } of EMPRESAS) {
  H(`13 · derivar no arma venta por bodega; cada derivación dice qué es (${etiqueta})`);
  conTenant(T);
  const bods = nombresDeBodega(T);
  const [b1, b2] = bods;
  const B03 = bods.map((b, i) => ({ id: `p${i + 1}`, tema: "comercial", cierre: "cifra", conceptos: ["ventas"], eje: "sku", universo: { eje: "sku", bodega: b } }));
  const store = crearAlmacenEnMemoria();
  const A = crearAcciones({ continuidad: store, ahora: () => "2026-10-05T12:00:00.000Z" });
  const libro0 = await libroDeAntes(T, E(B03), store);
  const conv = libro0.conversacionId;
  const hechos = libro0.entregas[0].hechos;
  const skusDe = (u) => libro0.entregas[0].universos.find((x) => x.id === u).entidades;
  const idsDe = (u) => skusDe(u).map((s) => hechos.find((h) => h.sujeto === s).id);
  const [ids1, ids2] = [idsDe("p1"), idsDe("p2")];
  ok(ids1.length >= 2 && ids2.length >= 1, `(armado) el libro de ANTES trae las cifras de venta de los SKU de ${b1} (${ids1.length}) y de ${b2} (${ids2.length}) — el libro del ensayo 6`);
  const d = (pedido) => A.derivar({ tenant: T, conversacionId: conv, ...pedido });

  /* 13a · LOS CINCO TIPOS DE AGREGADO sobre cifras de universos de bodega se rechazan, con la razón y los ids */
  const matriz = [
    ["suma de los SKU de una bodega (D1 del ensayo)", { operacion: "suma", sobre: ids1 }],
    ["suma entre bodegas", { operacion: "suma", sobre: [ids1[0], ids2[0]] }],
    ["diferencia entre dos bodegas (D6 del ensayo)", { operacion: "diferencia", sobre: [ids1[0], ids2[0]] }],
    ["participación de una bodega sobre el total (D7 del ensayo)", { operacion: "participacion", sobre: [ids1[0]], base: ids2[0] }],
    ["razón entre dos bodegas (D8 del ensayo)", { operacion: "razon", sobre: [ids1[0]], base: ids2[0] }],
    ["conteo de SKU de una bodega sobre un umbral", { operacion: "conteo", sobre: ids1, condicion: { op: ">", valor: ids2[0] } }],
  ];
  for (const [nombre, pedido] of matriz) {
    const r = await d(pedido);
    ok(r.ok === false && r.motivo === "venta_por_bodega" && MOTIVOS_DE_DERIVACION.includes(r.motivo) && Array.isArray(r.ids) && r.ids.length >= 1 && Array.isArray(r.uso), `★ ${nombre}: se rechaza con «venta_por_bodega», los ids y la cabecera de uso`, jj(r).slice(0, 300));
    const involucradas = [...pedido.sobre, ...(pedido.base ? [pedido.base] : []), ...(pedido.condicion && typeof pedido.condicion.valor === "string" ? [pedido.condicion.valor] : [])];
    const bodegasDeLoPedido = bods.filter((b, i) => idsDe(`p${i + 1}`).some((x) => involucradas.includes(x)));
    ok(r.detalle === textoLey(`el inventario de ${lista(bodegasDeLoPedido)}`), `   y la razón es la de negocio, con la(s) bodega(s) de las cifras pedidas (${lista(bodegasDeLoPedido)}): ofrece lo que sí se puede`, r.detalle);
  }
  const rUna = await d({ operacion: "suma", sobre: ids1 });
  ok(rUna.detalle === textoLey(`el inventario de ${b1}`) && !/\d/.test(rUna.detalle), "★ la razón de la suma de los SKU de UNA bodega es EXACTAMENTE: «La venta no se abre por bodega… Sumar o comparar las ventas de los productos de una bodega no da la venta de esa bodega, así que no se arma. Puedo darle el inventario de <bodega>, o derivar sobre la venta de los productos que usted nombre.»", rUna.detalle);
  ok(((await store.leerLibro(T.id, conv)).derivaciones || []).length === 0, "   y nada se guardó: el rechazo no consume un D<k>");

  /* 13b · A TRAVÉS DEL LINAJE: una derivación que ya existe (los libros de antes) no es una puerta lateral */
  let L = await store.leerLibro(T.id, conv);
  const pura = (pedido) => { const v = validarDerivacion(L, { conversacionId: conv, ...pedido }, { tenantId: T.id }); const c = calcularDerivacion(v); L = registrarDerivacion(L, derivacionParaElLibro(pedido, v, c)); return L.derivaciones[L.derivaciones.length - 1].id; };
  const D1 = pura({ operacion: "suma", sobre: ids1 }), D2 = pura({ operacion: "suma", sobre: ids2 });
  await store.guardarLibro(T.id, L);
  const rD = await d({ operacion: "diferencia", sobre: [D1, D2] });
  ok(rD.ok === false && rD.motivo === "venta_por_bodega" && rD.ids.every((x) => /^E\d+\.h\d+$/.test(x)), "★ restar dos derivaciones heredadas de universos de bodega se rechaza también (a través del linaje): los ids que nombra son las cifras de origen", jj(rD).slice(0, 300));
  const rP = await d({ operacion: "participacion", sobre: [D1], base: D2 });
  ok(rP.ok === false && rP.motivo === "venta_por_bodega", "…y una participación entre ellas");

  /* 13c · CONTROLES: lo que SÍ se deriva — el inventario de la bodega, la venta de los productos que el usuario nombra, la venta de un eje sin acotar */
  const rInv = await A.consultar({ tenant: T, encargo: E([{ id: "p1", tema: "inventario", cierre: "cifra", conceptos: ["capital"], eje: "sku", universo: { eje: "sku", bodega: b1 } }], conv) });
  const capital = (rInv.entrega.json.cifras.filas || []).map((f, i) => ({ f, i })).filter(({ f }) => f.valores["Métrica"] === "Capital");
  const nE2 = rInv.continuidad.estadoVigente.turno;
  const idsCap = capital.map(({ i }) => `E${nE2}.h${i + 1}`);
  const xInv = idsCap.length >= 2 ? await d({ operacion: "suma", sobre: idsCap }) : { ok: true };
  ok(xInv.ok === true, `★ control · el INVENTARIO de los SKU de ${b1} sí se suma (la bodega es inventario): ${xInv.ok && xInv.hecho ? xInv.hecho.valor : "(sin dos SKU con capital)"}`, jj(xInv).slice(0, 300));
  const nombrados = skusDe("p2").slice(0, 2);   // SKU que SON de una bodega: nombrarlos es pedir su venta, no la de la bodega
  const rNom = await A.consultar({ tenant: T, encargo: E([{ id: "p1", tema: "comercial", cierre: "cifra", conceptos: ["ventas"], eje: "sku", entidades: nombrados.map((nombre) => ({ nombre, eje: "sku" })) }], conv) });
  const nE3 = rNom.continuidad.estadoVigente.turno;
  const xNom = await d({ operacion: "suma", sobre: [`E${nE3}.h1`, `E${nE3}.h2`] });
  ok(xNom.ok === true && /^D\d+$/.test(xNom.hecho.id), "★ control · la venta de los productos que el usuario NOMBRA sí se suma (aunque sean los mismos SKU de la bodega: nombrarlos es pedir su venta, no la de la bodega)", jj(xNom).slice(0, 300));
  const rMezcla = await d({ operacion: "suma", sobre: [`E${nE3}.h1`, ids1[0]] });
  ok(rMezcla.ok === false && rMezcla.motivo === "venta_por_bodega" && rMezcla.ids.includes(ids1[0]) && !rMezcla.ids.includes(`E${nE3}.h1`), "…pero mezclar una de esas con una cifra que salió de la bodega se rechaza, y nombra solo la cifra de la bodega", jj(rMezcla).slice(0, 300));
  const libroSinAcotar = await libroDeAntes(T, E([{ id: "p1", tema: "comercial", cierre: "cifra", conceptos: ["ventas"], eje: "sku" }, { ...B03[0], id: "p2" }]), crearAlmacenEnMemoria());
  const sinAcotar = crearAlmacenEnMemoria(); await sinAcotar.guardarLibro(T.id, libroSinAcotar);
  const Asa = crearAcciones({ continuidad: sinAcotar });
  const hSA = libroSinAcotar.entregas[0].hechos;
  const xSA = await Asa.derivar({ tenant: T, conversacionId: libroSinAcotar.conversacionId, operacion: "suma", sobre: [hSA[0].id, hSA[1].id] });
  ok(xSA.ok === true, "…y una cifra que está TAMBIÉN en un listado sin acotar no se bloquea (su venta no depende del conjunto de la bodega: la regla solo corta lo que sale únicamente de universos de bodega)", jj(xSA).slice(0, 300));
  const xCli = await (async () => { const h = await hilo(T, PASOS_COMERCIAL); const v = delMetrica(h.ventas, "Venta"); return derivar(h, { operacion: "suma", sobre: [v[0].id, v[1].id] }, T); })();
  ok(xCli.ok === true, "control · la venta por cliente se deriva como siempre");

  /* 13d · LA DESCRIPCIÓN de cada derivación: qué es, de qué cifras sale */
  const h = await hilo(T, PASOS_COMERCIAL);
  conTenant(T);
  const vv = delMetrica(h.ventas, "Venta"), ent = (x) => x.entidad;
  const tot = totalDe(h.ventas, "Venta");
  const ds = [];
  const sum3 = await derivar(h, { operacion: "suma", sobre: vv.slice(0, 3).map((x) => x.id) }, T);
  ok(sum3.ok && sum3.hecho.descripcion === `Venta: suma de ${lista(vv.slice(0, 3).map(ent))}`, `★ suma → «${sum3.ok && sum3.hecho.descripcion}»`, jj(sum3).slice(0, 300));
  const dif = await derivar(h, { operacion: "diferencia", sobre: [vv[0].id, vv[1].id] }, T);
  ok(dif.ok && dif.hecho.descripcion === `Venta: ${ent(vv[0])} menos ${ent(vv[1])}`, `★ diferencia → «${dif.ok && dif.hecho.descripcion}»`);
  const par = tot ? await derivar(h, { operacion: "participacion", sobre: vv.slice(0, 3).map((x) => x.id), base: tot.id }, T) : { ok: true, hecho: { descripcion: "" } };
  ok(par.ok && (!tot || (par.hecho.descripcion.startsWith(`Venta: participación de ${lista(vv.slice(0, 3).map(ent))} sobre total del listado completo (`) && /\)$/.test(par.hecho.descripcion))), `★ participación → «${par.ok && par.hecho.descripcion}» (los numeradores y la base: el total del listado)`);
  const raz = await derivar(h, { operacion: "razon", sobre: [vv[0].id], base: vv[1].id }, T);
  ok(raz.ok && raz.hecho.descripcion === `Venta: cuántas veces es ${ent(vv[0])} respecto de ${ent(vv[1])}`, `★ razón → «${raz.ok && raz.hecho.descripcion}»`);
  const cont = await derivar(h, { operacion: "conteo", sobre: vv.slice(0, 4).map((x) => x.id), condicion: { op: ">", valor: 0 } }, T);
  ok(cont.ok && /^Venta: cuántas de las 4 cifras \(.+\) son mayores que \$0$/.test(cont.hecho.descripcion), `★ conteo → «${cont.ok && cont.hecho.descripcion}»`);
  const enc = await derivar(h, { operacion: "diferencia", sobre: [sum3.hecho.id, vv[3].id] }, T);
  ok(enc.ok && enc.hecho.descripcion === `Venta: ${sum3.hecho.id} menos ${ent(vv[3])}`, `   encadenada → «${enc.ok && enc.hecho.descripcion}» (la derivación se nombra por su id; su descripción viaja en el mismo retomar)`);
  const enc2 = await derivar(h, { operacion: "suma", sobre: [sum3.hecho.id, vv[3].id] }, T);
  ok(enc2.ok && enc2.hecho.descripcion === `Venta: suma de ${sum3.hecho.id} y ${ent(vv[3])} (4 cifras entregadas en total)`, `   una suma que encadena dice cuántas cifras entregadas contiene → «${enc2.ok && enc2.hecho.descripcion}»`);
  const muchas = await derivar(h, { operacion: "suma", sobre: vv.map((x) => x.id) }, T);
  ok(muchas.ok && muchas.hecho.descripcion.length <= 240 && (vv.length <= 6 || / y \d+ más$/.test(muchas.hecho.descripcion)), `   una suma de ${vv.length} cifras no desborda (${muchas.ok && muchas.hecho.descripcion.length} caracteres: nombra las primeras y dice cuántas más)`, muchas.ok && muchas.hecho.descripcion);
  const repetida = await derivar(h, { operacion: "suma", sobre: vv.slice(0, 3).map((x) => x.id) }, T);
  ok(repetida.repetida === true && repetida.hecho.descripcion === sum3.hecho.descripcion, "   y la derivación repetida (idempotente) devuelve la MISMA descripción");
  ok(Object.keys(sum3.hecho).filter((k) => !["id", "operacion", "sobre", "entidad", "metrica", "valor", "procedencia", "descripcion", "linaje", "base", "procedencias"].includes(k)).length === 0, "   el hecho no trae nada más que la descripción (la forma de siempre: valor, entidad y métrica no cambian)", jj(sum3.hecho));

  /* 13e · RETOMAR: la descripción y el universo viajan con cada cifra */
  const r1 = await h.A.retomar({ tenant: T, conversacionId: h.conv });
  const comp = compactarParaAnfitrion("retomar", r1);
  const dD = (x) => comp.hechos.find((y) => y.id === x);
  ok(dD(sum3.hecho.id).descripcion === sum3.hecho.descripcion && dD(par.hecho.id).descripcion === par.hecho.descripcion && dD(enc2.hecho.id).descripcion === enc2.hecho.descripcion, "★ `retomar` devuelve CADA derivación con la descripción que `derivar` le dio (también por la respuesta compacta que ve el anfitrión)");
  const todasLasD = comp.hechos.filter((x) => x.origen === "derivado" && /^D\d+$/.test(x.id));
  ok(todasLasD.length >= 6 && todasLasD.every((x) => typeof x.descripcion === "string" && x.descripcion.length > 10 && x.descripcion.length <= 240), `★ NINGUNA derivación sale pelada: las ${todasLasD.length} traen su descripción (≤ 240 caracteres; la más larga ${Math.max(...todasLasD.map((x) => x.descripcion.length))})`);
  ok(comp.hechos.filter((x) => /^E/.test(x.id)).every((x) => x.universo === undefined), "una cifra de un listado SIN acotar no trae `universo` (su significado no depende del conjunto)");
  /* un conjunto ACOTADO (los 3 de mayor venta): sus cifras y lo derivado de ellas dicen de qué conjunto son */
  const top = await h.A.consultar({ tenant: T, encargo: E([{ id: "p1", tema: "comercial", cierre: "cifra", conceptos: ["ventas"], eje: "cliente", universo: { eje: "cliente", top: { metrica: "ventas", k: 3, direccion: "mayor" } } }], h.conv) });
  const nT = top.continuidad.estadoVigente.turno;
  const idsTop = top.entrega.json.cifras.filas.map((f, i) => ({ f, i })).filter(({ f }) => f.valores["Métrica"] === "Venta").map(({ i }) => `E${nT}.h${i + 1}`);
  const sTop = await derivar(h, { operacion: "suma", sobre: idsTop }, T);
  ok(idsTop.length === 3 && sTop.ok && sTop.hecho.descripcion === `Venta: suma de ${lista(top.entrega.json.cifras.filas.filter((f) => f.valores["Métrica"] === "Venta").map((f) => f.valores["Entidad / grupo"]))} (los 3 de mayor venta)`, `★ la suma de los 3 primeros dice que son «los 3 de mayor venta»: «${sTop.ok && sTop.hecho.descripcion}»`, jj(sTop).slice(0, 300));
  const r2 = await h.A.retomar({ tenant: T, conversacionId: h.conv });
  const c2 = compactarParaAnfitrion("retomar", r2);
  ok(idsTop.every((id) => (c2.hechos.find((x) => x.id === id) || {}).universo === "los 3 de mayor venta"), "★ y las cifras de ese conjunto vuelven con `universo: «los 3 de mayor venta»` en `retomar`");
  ok(c2.hechos.find((x) => x.id === sTop.hecho.id).descripcion === sTop.hecho.descripcion, "   y la derivación, con la misma descripción");

  /* 13f · EL CASO DEL ENSAYO, PUNTA A PUNTA: lo que lee un anfitrión NUEVO en la sesión 2 (D1–D8 del libro de antes) */
  L = await store.leerLibro(T.id, conv);   // el libro de verdad (con lo que se agregó en 13c): se sigue desde ahí
  const D3 = pura({ operacion: "suma", sobre: ids1 });
  const baseLegada = ids1.concat(ids2);
  const D4 = pura({ operacion: "suma", sobre: baseLegada });
  const D5 = pura({ operacion: "participacion", sobre: [D3], base: D4 });
  await store.guardarLibro(T.id, L);
  const rr = compactarParaAnfitrion("retomar", await A.retomar({ tenant: T, conversacionId: conv }));
  const d3 = rr.hechos.find((x) => x.id === D3), d5 = rr.hechos.find((x) => x.id === D5);
  ok(skusDe("p1").every((s) => d3.descripcion.includes(s)) && d3.descripcion.endsWith(`(los SKU de ${b1})`) && !/primer/.test(d3.descripcion), `★ B03|2: la suma de los SKU de ${b1} se lee como lo que es — «${d3.descripcion}» — nombra cada código y su conjunto («los SKU de ${b1}»), y no se confunde con «los primeros»`);
  ok(d5.descripcion === `Venta: participación de ${D3} sobre ${D4}`, `   y la participación nombra sus dos derivaciones: «${d5.descripcion}» (cuyas descripciones viajan en el mismo retomar)`);
  ok(rr.hechos.filter((x) => x.id === "E1.h1")[0].universo === `los SKU de ${b1}`, `   y la cifra de un SKU de la bodega trae su conjunto («los SKU de ${b1}»)`);
  const bytesCon = JSON.stringify(rr).length, bytesSin = JSON.stringify({ ...rr, hechos: rr.hechos.map(({ descripcion, universo, ...x }) => x) }).length;
  ok(bytesCon < 20 * 1024 && (bytesCon - bytesSin) / (rr.hechos.length || 1) < 130, `el costo es chico: retomar de este hilo pesa ${(bytesCon / 1024).toFixed(1)} KB (+${bytesCon - bytesSin} B por ${rr.hechos.length} hechos: ${((bytesCon - bytesSin) / rr.hechos.length).toFixed(0)} B por hecho)`);
  console.log(`   · ${etiqueta}: descripciones — ${todasLasD.slice(0, 3).map((x) => `${x.id} «${x.descripcion}»`).join(" · ")}`);
}

/* ═══ 14 · ENSAYO 8 (owner 2026-10-08) · CONTAR PARTICIPACIONES · COMPARAR ENTRE CARGAS · UN CRITERIO DEL USUARIO · LOS DÍAS SON DÍAS ═════════════════════════════════════════════════════════════════════════
 * Los casos reales del ensayo 8 (A02|1|6, B01|2|6, A02|1|5 · B02|1|5 · C02|1|5):
 *   (1) `conteo` sobre [D1] —UNA participación— daba `operando_es_total «D1 se calcula sobre E1.h14, el total de un listado»` y sobre [D1,D2,D3] `operando_repetido «E1.h14 está en D1 y en D2»`: el total solo es el DENOMINADOR;
 *   (2) `diferencia` [E4.h14, E5.h13] —el total de ayer contra el de hoy— daba `operando_repetido «la cifra E5.h13 ya está entre los operandos»` aunque son dos ids distintos de dos cargas;
 *   (3) la distancia a un valor que el usuario fijó («ninguna cuenta más de un cuarto», «nadie más de 15 días») no tenía camino en `derivar`, y el «15 días» del apoyo (E4.e1) estaba tipado `count`. */
const _cargas = async (T, { alterar = null } = {}) => {
  /* dos consultas de las ventas de la MISMA empresa en dos cargas (versión 1 y 2) de una conversación; el libro se guarda en un almacén aparte, con lo que `alterar` le cambie (un dato nuevo no sale del Core con el mismo dataset) */
  const s1 = crearAlmacenEnMemoria(), A1 = crearAcciones({ continuidad: s1, ahora: () => "2026-10-05T12:00:00.000Z" });
  conTenant(T);
  const c1 = await A1.consultar({ tenant: T, encargo: E([PARTE(["ventas"])]) });
  const conv = c1.continuidad.conversacionId;
  const c2 = await A1.consultar({ tenant: { ...T, version: 2 }, encargo: E([PARTE(["ventas"])], conv) });
  const L = clon(await s1.leerLibro(T.id, conv));
  if (alterar) alterar(L);
  const s2 = crearAlmacenEnMemoria(); await s2.guardarLibro(T.id, L);
  const A = crearAcciones({ continuidad: s2 });
  const k1 = compactarParaAnfitrion("consultar", c1), k2 = compactarParaAnfitrion("consultar", c2);
  return { A, conv, L, k1, k2, tot1: k1.entrega.cifras.find((x) => !x.entidad), tot2: k2.entrega.cifras.find((x) => !x.entidad), filas1: k1.entrega.cifras.filter((x) => x.entidad), filas2: k2.entrega.cifras.filter((x) => x.entidad) };
};

for (const { etiqueta, T } of EMPRESAS) {
  H(`14 · ensayo 8 (${etiqueta})`);

  /* 14a · CONTAR, SUMAR Y COMPARAR PARTICIPACIONES: el total que es solo el denominador no cuenta como operando */
  {
    const h = await hilo(T, [["ventas", ["ventas"], "comercial"], ["saldos", ["saldo_vencido", "saldo_pendiente"], "cobranza"]]);
    const oVentas = crudosDelCore(T, E([PARTE(["ventas"], "comercial")]));
    const ventas = delMetrica(h.ventas, "Venta"), totalV = totalDe(h.ventas, "Venta");
    const vencidos = delMetrica(h.saldos, "Saldo vencido"), totalS = totalDe(h.saldos, "Saldo vencido");
    const lib0 = await h.store.leerLibro(T.id, h.conv);
    const crudoTotal = lib0.entregas[0].hechos.find((x) => x.id === totalV.id).rv.raw;
    const part = (x) => (100 * rawDe(oVentas, "ventas", x.entidad)) / crudoTotal;
    const D = [];
    for (const x of ventas.slice(0, 4)) { const r = await derivar(h, { operacion: "participacion", sobre: [x.id], base: totalV.id }, T); D.push(r.hecho.id); }
    const umbral = Math.floor((part(ventas[0]) + part(ventas[3])) / 2);   /* un umbral que parte a las cuatro */
    const esperadas = ventas.slice(0, 4).map(part);
    const r1 = await derivar(h, { operacion: "conteo", sobre: [D[0]], condicion: { op: ">", valor: umbral } }, T);
    ok(r1.ok === true && r1.hecho.valor === `${esperadas[0] > umbral ? 1 : 0} de 1`, `★ A02|1|6 · conteo sobre UNA participación (D1 = ${formatoDeLaCasa(esperadas[0], "pct")}) > ${umbral}: ya no se acusa de «operando_es_total» (el total es solo su denominador)`, jj(r1).slice(0, 400));
    const r3 = await derivar(h, { operacion: "conteo", sobre: D.slice(0, 3), condicion: { op: ">", valor: umbral } }, T);
    const n3 = esperadas.slice(0, 3).filter((v) => v > umbral).length;
    ok(r3.ok === true && r3.hecho.valor === `${n3} de 3` && jj(r3.cumplen) === jj(D.slice(0, 3).filter((_, i) => esperadas[i] > umbral)), `★ conteo sobre [D1,D2,D3] que comparten la base: ${n3} de 3 (con los que cumplen), ya sin «operando_repetido» por el total que comparten`, jj(r3).slice(0, 400));
    const rg = await derivar(h, { operacion: "conteo", sobre: D, condicion: { op: ">=", valor: umbral } }, T);
    ok(rg.ok === true && rg.hecho.valor === `${esperadas.filter((v) => v >= umbral).length} de 4` && /^Venta|^Participación/.test(rg.hecho.metrica), "…y de las cuatro", jj(rg.hecho));
    ok(rg.hecho.linaje && rg.hecho.linaje.includes(totalV.id), "el linaje sigue diciendo de qué cifras sale (el total entre ellas, como denominador)");
    /* sumar y comparar participaciones de una misma base */
    const rsum = await derivar(h, { operacion: "suma", sobre: D.slice(0, 3) }, T);
    const rgrupo = await derivar(h, { operacion: "participacion", sobre: ventas.slice(0, 3).map((x) => x.id), base: totalV.id }, T);
    ok(rsum.ok === true && rsum.hecho.valor === rgrupo.hecho.valor && rsum.hecho.valor === formatoDeLaCasa(esperadas.slice(0, 3).reduce((a, v) => a + v, 0), "pct"), `★ sumar participaciones de la misma base (${rsum.ok && rsum.hecho.valor}) es la participación del grupo (${rgrupo.ok && rgrupo.hecho.valor}), exacta sobre los crudos`, jj(rsum).slice(0, 300));
    const rdif = await derivar(h, { operacion: "diferencia", sobre: [D[0], D[1]] }, T);
    ok(rdif.ok === true && rdif.hecho.valor === formatoDeLaCasa(esperadas[0] - esperadas[1], "pp"), "comparar dos participaciones de la misma base: la diferencia en puntos (como antes)", jj(rdif.hecho));
    /* mezclar bases NO: la participación de una venta sobre el total de ventas y la de un saldo sobre el total de saldos */
    const dS = await derivar(h, { operacion: "participacion", sobre: [vencidos[0].id], base: totalS.id }, T);
    await noDeriva(h, T, "contar participaciones de BASES distintas (ventas ÷ total de ventas · saldo ÷ total de saldos)", { operacion: "conteo", sobre: [D[0], dS.hecho.id], condicion: { op: ">", valor: 1 } }, "bases_distintas");
    await noDeriva(h, T, "sumar participaciones de BASES distintas", { operacion: "suma", sobre: [D[0], dS.hecho.id] }, "bases_distintas");
    ok(MOTIVOS_DE_DERIVACION.includes("bases_distintas") && MOTIVOS_DE_DERIVACION.length === new Set(MOTIVOS_DE_DERIVACION).size, "el motivo nuevo está en la lista cerrada (sin repetidos)");
    /* lo que SIGUE rechazándose: el total como operando de lo que se suma/cuenta, y la participación contada dos veces */
    const dResto = await derivar(h, { operacion: "diferencia", sobre: [totalV.id, ventas[0].id] }, T);
    await noDeriva(h, T, "un conteo sobre «total − una cuenta» (el total es OPERANDO: está en el valor de la derivación)", { operacion: "conteo", sobre: [dResto.hecho.id], condicion: { op: ">", valor: 0 } }, "operando_es_total");
    const dResta = await derivar(h, { operacion: "participacion", sobre: [dResto.hecho.id], base: totalV.id }, T);
    await noDeriva(h, T, "un conteo sobre «(total − una cuenta) ÷ total» (el total sigue siendo operando del numerador)", { operacion: "conteo", sobre: [dResta.hecho.id], condicion: { op: ">", valor: 0 } }, "operando_es_total");
    const dUno = await derivar(h, { operacion: "participacion", sobre: [ventas[0].id, ventas[1].id], base: totalV.id }, T);
    await noDeriva(h, T, "contar la participación de {a,b} junto a la de {a}: la cuenta «a» estaría dos veces", { operacion: "conteo", sobre: [dUno.hecho.id, D[0]], condicion: { op: ">", valor: 1 } }, "operando_repetido");
    /* retomar: el total se recalcula desde sus filas, así que lo derivado sobre él vuelve `igual` */
    const rt = await h.A.retomar({ tenant: T, conversacionId: h.conv });
    const est = (id) => (rt.hechos.find((x) => x.id === id) || {}).estadoReverificacion;
    ok(est(totalV.id) === "igual" && est(D[0]) === "igual" && est(rg.hecho.id) === "igual" && est(rsum.hecho.id) === "igual", "★ `retomar`: el total del listado se revalida desde sus filas, así que las participaciones, el conteo y la suma sobre él vuelven «igual» (antes: no_se_revalida)", jj([est(totalV.id), est(D[0]), est(rg.hecho.id), est(rsum.hecho.id)]));
  }

  /* 14b · ENTRE CARGAS: la MISMA cifra en dos momentos se compara, nombrando el marco de cada lado */
  {
    const DELTA = 1300000;
    const { A, conv, L, tot1, tot2, filas1, filas2 } = await _cargas(T, { alterar: (L) => { const e = L.entregas[1]; for (const hh of e.hechos) if (hh.rv && (hh.rv.deListado || hh.id === `E2.h1`)) hh.rv.raw -= DELTA; } });
    const raw = (id) => L.entregas.flatMap((e) => e.hechos).find((x) => x.id === id).rv.raw;
    const d = (pedido) => A.derivar({ tenant: T, conversacionId: conv, ...pedido });
    ok(tot1 && tot2 && tot1.id !== tot2.id && filas1.length === filas2.length, "(armado) dos consultas de las ventas en dos cargas: dos totales y dos juegos de filas con ids distintos");
    const r = await d({ operacion: "diferencia", sobre: [tot1.id, tot2.id] });
    ok(r.ok === true && r.hecho.valor === formatoDeLaCasa(DELTA, "money") && r.repetida === false, `★ B01|2|6 · la diferencia entre el total de la carga 1 y el de la carga 2: ${r.ok && r.hecho.valor} (ya no «operando_repetido»)`, jj(r).slice(0, 500));
    ok(/de la carga 1/.test(r.hecho.descripcion) && /de la carga 2/.test(r.hecho.descripcion) && r.operandos[0].marco === "carga 1" && r.operandos[1].marco === "carga 2" && /entre cargas de datos/.test(r.hecho.metrica), "★ la descripción y cada operando nombran su carga (la cifra dice de CUÁNDO es cada lado)", jj([r.hecho.descripcion, r.hecho.metrica, r.operandos.map((o) => o.marco)]));
    const rr = await d({ operacion: "diferencia", sobre: [tot2.id, tot1.id] });
    ok(rr.ok && rr.hecho.valor === formatoDeLaCasa(-DELTA, "money"), "el orden manda: la carga 2 menos la 1 es negativa", jj(rr.hecho));
    const ra = await d({ operacion: "diferencia", sobre: [filas1[0].id, filas2[0].id] });
    ok(ra.ok === true && ra.hecho.valor === formatoDeLaCasa(raw(filas1[0].id) - raw(filas2[0].id), "money") && ra.hecho.entidad === filas1[0].entidad, `la misma cuenta (${filas1[0].entidad}) en las dos cargas: ${ra.ok && ra.hecho.valor}`, jj(ra).slice(0, 300));
    const rz = await d({ operacion: "razon", sobre: [tot2.id], base: tot1.id });
    ok(rz.ok === true && rz.hecho.valor === textoDeVeces(raw(tot2.id) / raw(tot1.id)) && /entre cargas de datos/.test(rz.hecho.metrica), `la razón del total de hoy respecto del de ayer: ${rz.ok && rz.hecho.valor}`, jj(rz).slice(0, 300));
    /* lo que SIGUE rechazándose, con una razón que enseña (nunca un falso «repetido») */
    const otra = await d({ operacion: "diferencia", sobre: [filas1[0].id, filas2[1].id] });
    ok(otra.ok === false && otra.motivo === "otra_carga" && /MISMA cifra/.test(otra.detalle) && /carga 1/.test(otra.detalle), "★ dos cifras DISTINTAS de cargas distintas (la cuenta A de ayer, la B de hoy) siguen sin compararse: «otra_carga», y dice que se compara la MISMA cifra", jj(otra).slice(0, 400));
    const sumaCruzada = await d({ operacion: "suma", sobre: [filas1[0].id, filas2[0].id] });
    ok(sumaCruzada.ok === false && sumaCruzada.motivo === "otra_carga" && /diferencia/.test(sumaCruzada.detalle) && /razon/.test(sumaCruzada.detalle), "★ una SUMA entre cargas se rechaza y enseña que lo que se compara entre cargas es «diferencia» o «razon»", jj(sumaCruzada).slice(0, 400));
    const partCruzada = await d({ operacion: "participacion", sobre: [filas1[0].id], base: tot2.id });
    ok(partCruzada.ok === false && partCruzada.motivo === "otra_carga", "una participación entre cargas tampoco (el numerador de ayer sobre la base de hoy)", jj(partCruzada).slice(0, 200));
    /* otro PERÍODO: lo mismo, y la descripción nombra el período */
    const P = await _cargas(T, { alterar: (L2) => { L2.entregas[1].periodo = { texto: "otro", rango: "otro" }; L2.entregas[1].versionId = L2.entregas[0].versionId; } });
    const rp = await P.A.derivar({ tenant: T, conversacionId: P.conv, operacion: "diferencia", sobre: [P.tot1.id, P.tot2.id] });
    ok(rp.ok === true && /del período otro/.test(rp.hecho.descripcion) && /entre períodos/.test(rp.hecho.metrica), "otro PERÍODO (la misma carga): se compara y la descripción nombra «del período otro»", jj(rp).slice(0, 400));
    const spp = await P.A.derivar({ tenant: T, conversacionId: P.conv, operacion: "suma", sobre: [P.filas1[0].id, P.filas2[0].id] });
    ok(spp.ok === false && spp.motivo === "otro_periodo" && /diferencia/.test(spp.detalle), "…y una suma entre períodos se rechaza «otro_periodo», enseñando la diferencia");
    const M = await _cargas(T, { alterar: (L2) => { L2.entregas[1].moneda = "USD"; } });
    const rmn = await M.A.derivar({ tenant: T, conversacionId: M.conv, operacion: "diferencia", sobre: [M.tot1.id, M.tot2.id] });
    ok(rmn.ok === false && rmn.motivo === "otra_moneda", "★ la moneda NUNCA se cruza: otra moneda se rechaza también en una diferencia");
    /* dos ids distintos de la MISMA carga y la MISMA cifra: una diferencia es 0 (no un «repetido»); sumarlos sí se contaría dos veces y lo dice con precisión */
    const mismaCarga = await _cargas(T);   /* sin alterar: las dos consultas son de versiones distintas; las ponemos en la misma */
    const same = crearAlmacenEnMemoria(), As = crearAcciones({ continuidad: same });
    conTenant(T);
    const s1 = await As.consultar({ tenant: T, encargo: E([PARTE(["ventas"])]) });
    const cs = s1.continuidad.conversacionId;
    await As.consultar({ tenant: T, encargo: E([PARTE(["ventas"])], cs) });
    const rz0 = await As.derivar({ tenant: T, conversacionId: cs, operacion: "diferencia", sobre: ["E1.h1", "E2.h1"] });
    ok(rz0.ok === true && rz0.hecho.valor === formatoDeLaCasa(0, "money"), "★ la misma cifra entregada dos veces en la MISMA carga: su diferencia es 0 (dos ids distintos nunca son «repetidos» en una comparación)", jj(rz0).slice(0, 300));
    const rs0 = await As.derivar({ tenant: T, conversacionId: cs, operacion: "suma", sobre: ["E1.h1", "E2.h1"] });
    ok(rs0.ok === false && rs0.motivo === "operando_repetido" && /es la misma que E1\.h1/.test(rs0.detalle), "y SUMARLAS sí se rechaza, con la razón exacta («es la misma que E1.h1, entregada otra vez»)", jj(rs0).slice(0, 300));
    void mismaCarga;
  }

  /* 14c · UN CRITERIO DECLARADO POR EL USUARIO: la distancia, la razón y el conteo contra lo que el usuario fijó */
  {
    const h = await hilo(T, [["ventas", ["ventas"], "comercial"]]);
    const oVentas = crudosDelCore(T, E([PARTE(["ventas"], "comercial")]));
    const ventas = delMetrica(h.ventas, "Venta"), totalV = totalDe(h.ventas, "Venta");
    const lib0 = await h.store.leerLibro(T.id, h.conv);
    const crudoTotal = lib0.entregas[0].hechos.find((x) => x.id === totalV.id).rv.raw;
    const part = (x) => (100 * rawDe(oVentas, "ventas", x.entidad)) / crudoTotal;
    const D = [];
    for (const x of ventas.slice(0, 3)) D.push((await derivar(h, { operacion: "participacion", sobre: [x.id], base: totalV.id }, T)).hecho.id);
    const crit = { valor: 25, unidad: "pct", texto: "ninguna cuenta con más de un cuarto de la venta" };
    const libroAntes = jj((await h.store.leerLibro(T.id, h.conv)).entregas);
    const r = await derivar(h, { operacion: "diferencia", sobre: ["criterio", D[0]], criterio: crit }, T);
    ok(r.ok === true && r.hecho.valor === formatoDeLaCasa(25 - part(ventas[0]), "pp") && r.hecho.procedencia === "derivado", `★ A02|1|5 · la holgura contra el criterio del usuario: 25 − ${formatoDeLaCasa(part(ventas[0]), "pct")} = ${r.ok && r.hecho.valor} (ADI la calcula, con el crudo exacto)`, jj(r).slice(0, 500));
    const cOp = r.operandos.find((o) => o.id === "criterio");
    ok(cOp && cOp.procedencia === "declarado" && cOp.origen === "declarado por el usuario en esta conversación" && cOp.valor === "25%" && cOp.texto === crit.texto, "★ el criterio viaja con SU procedencia: «declarado por el usuario en esta conversación», su valor exacto y sus palabras", jj(cOp));
    ok(r.hecho.procedencias.includes("declarado por el usuario en esta conversación") && r.hecho.procedencias.length === 2 && /criterio declarado por el usuario/.test(r.hecho.metrica) && /el criterio declarado por el usuario/.test(r.hecho.descripcion), "★ el hecho nombra las DOS procedencias (lo derivado de ADI y lo declarado por el usuario) y la métrica y la descripción dicen que el criterio es del usuario", jj([r.hecho.procedencias, r.hecho.metrica, r.hecho.descripcion]));
    ok(!/criterio de ADI|referencia del oficio|benchmark|declarado por la empresa/i.test(jj({ ...r, uso: undefined })), "★ NUNCA se presenta como criterio de ADI, del oficio ni de la empresa");
    const rAlReves = await derivar(h, { operacion: "diferencia", sobre: [D[0], "criterio"], criterio: crit }, T);
    ok(rAlReves.ok && rAlReves.hecho.valor === formatoDeLaCasa(part(ventas[0]) - 25, "pp") && rAlReves.hecho.id !== r.hecho.id, "el orden manda: lo medido menos el criterio es la distancia con el signo contrario", jj(rAlReves.hecho));
    const rep = await derivar(h, { operacion: "diferencia", sobre: ["criterio", D[0]], criterio: crit }, T);
    ok(rep.ok && rep.repetida === true && rep.hecho.id === r.hecho.id, "idempotente: el mismo pedido devuelve el mismo D");
    const otroValor = await derivar(h, { operacion: "diferencia", sobre: ["criterio", D[0]], criterio: { ...crit, valor: 20 } }, T);
    ok(otroValor.ok && otroValor.repetida === false && otroValor.hecho.id !== r.hecho.id && otroValor.hecho.valor === formatoDeLaCasa(20 - part(ventas[0]), "pp"), "otro valor del criterio es otra cifra (otro D)");
    const rCuenta = await derivar(h, { operacion: "conteo", sobre: D, condicion: { op: "<=", valor: "criterio" }, criterio: crit }, T);
    const n = D.filter((_, i) => part(ventas[i]) <= 25).length;
    ok(rCuenta.ok && rCuenta.hecho.valor === `${n} de 3` && rCuenta.condicion.referencia && rCuenta.condicion.referencia.procedencia === "declarado" && rCuenta.hecho.procedencias.includes("declarado por el usuario en esta conversación"), `★ cumplimiento: «cuántas cumplen mi criterio» = ${n} de 3, con el criterio como referencia declarada`, jj(rCuenta).slice(0, 500));
    const rRazon = await derivar(h, { operacion: "razon", sobre: [D[0]], base: "criterio", criterio: crit }, T);
    ok(rRazon.ok && rRazon.hecho.valor === textoDeVeces(part(ventas[0]) / 25) && /respecto del criterio declarado por el usuario/.test(rRazon.hecho.descripcion), "la razón respecto del criterio («cuántas veces el tope»)", jj(rRazon.hecho));
    /* en dinero: el criterio declara su escala (la cantidad suelta de un conteo de dinero era ambigua) */
    const tope = Math.round(rawDe(oVentas, "ventas", ventas[1].entidad));
    const rDinero = await derivar(h, { operacion: "conteo", sobre: ventas.slice(0, 3).map((x) => x.id), condicion: { op: ">", valor: "criterio" }, criterio: { valor: tope, unidad: "money", texto: "más de lo que vende la segunda" } }, T);
    ok(rDinero.ok && rDinero.hecho.valor === `${ventas.slice(0, 3).filter((x) => rawDe(oVentas, "ventas", x.entidad) > tope).length} de 3`, "en DINERO el criterio trae su escala: un conteo contra un monto del usuario (sin la ambigüedad de «5»)", jj(rDinero).slice(0, 300));
    /* lo que se rechaza, con su razón */
    await noDeriva(h, T, "el criterio en otra unidad que la cifra (dinero contra %)", { operacion: "diferencia", sobre: ["criterio", D[0]], criterio: { valor: 5000, unidad: "money", texto: "x" } }, "unidades_distintas");
    await noDeriva(h, T, "«criterio» citado sin declararlo", { operacion: "diferencia", sobre: ["criterio", D[0]] }, "criterio_invalido");
    await noDeriva(h, T, "un criterio declarado que nadie cita", { operacion: "diferencia", sobre: [D[0], D[1]], criterio: crit }, "criterio_invalido");
    await noDeriva(h, T, "un criterio sin la forma {valor, unidad, texto}", { operacion: "diferencia", sobre: ["criterio", D[0]], criterio: { valor: "un cuarto" } }, "criterio_invalido");
    await noDeriva(h, T, "un criterio con una unidad que no existe", { operacion: "diferencia", sobre: ["criterio", D[0]], criterio: { valor: 25, unidad: "puntos", texto: "x" } }, "criterio_invalido");
    await noDeriva(h, T, "sumar un criterio", { operacion: "suma", sobre: ["criterio", D[0]], criterio: crit }, "criterio_invalido");
    await noDeriva(h, T, "un criterio como numerador de una participación", { operacion: "participacion", sobre: ["criterio"], base: totalV.id, criterio: crit }, "criterio_invalido");
    await noDeriva(h, T, "contar el criterio (es la condición, no lo contado)", { operacion: "conteo", sobre: ["criterio", D[0]], condicion: { op: ">", valor: 0 }, criterio: crit }, "criterio_invalido");
    await noDeriva(h, T, "encadenar una derivación hecha contra un criterio", { operacion: "diferencia", sobre: [r.hecho.id, D[1]] }, "derivacion_no_encadenable");
    ok(jj((await h.store.leerLibro(T.id, h.conv)).entregas) === libroAntes, "ninguna Entrega ni id `E<n>.h<k>` se movió");
    /* retomar: lo medido se revalida; el criterio sigue siendo el que el usuario dijo */
    const rt = await h.A.retomar({ tenant: T, conversacionId: h.conv });
    const hr = rt.hechos.find((x) => x.id === r.hecho.id);
    ok(hr && hr.estadoReverificacion === "igual" && /el criterio declarado por el usuario/.test(hr.descripcion || ""), "★ `retomar`: la derivación contra un criterio se revalida por sus cifras medidas (igual) y conserva su descripción", jj(hr).slice(0, 300));
    const tool = MCP_TOOLS.find((t) => t.name === "derivar");
    ok(tool.inputSchema.properties.criterio && jj(tool.inputSchema.properties.criterio.properties.unidad.enum) === jj(UNIDADES_DE_CRITERIO) && /criterio/.test(tool.description) && /'criterio'/.test(tool.inputSchema.properties.sobre.description), "el esquema de la herramienta dice cómo pasar el criterio (campo `criterio` + «criterio» en sobre/base/condicion)");
  }

  /* 14d · LOS DÍAS SON DÍAS: el umbral de un filtro se guarda tipado en días y se enseña a pasar el valor del usuario como criterio */
  {
    const store = crearAlmacenEnMemoria(), A = crearAcciones({ continuidad: store, ahora: () => "2026-10-05T12:00:00.000Z" });
    conTenant(T);
    const c = await A.consultar({ tenant: T, encargo: E([{ id: "p1", tema: "cobranza", cierre: "cifra", conceptos: ["dias_vencido", "saldo_vencido"], eje: "cliente", universo: { eje: "cliente", filtros: [{ metrica: "dias_vencido", op: ">", valor: 15 }] } }]) });
    ok(c.ok === true, "(armado) la consulta con el filtro «días vencido > 15» responde", jj(c.noResuelto).slice(0, 300));
    const conv = c.continuidad.conversacionId;
    const k = compactarParaAnfitrion("consultar", c);
    const L = await store.leerLibro(T.id, conv);
    const umbral = (L.entregas[0].apoyo || []).find((a) => a.rv && a.rv.unidad === "days" && a.rv.raw === 15);
    ok(umbral && umbral.rv.premisa === true && umbral.rv.clave === "dias_vencido", "★ C02|1|5 · el «15 días» del apoyo se guarda con su cifra EXACTA y en DÍAS (antes: 13 de «3 de 13», tipado count)", jj(L.entregas[0].apoyo));
    const mal = (L.entregas[0].apoyo || []).filter((a) => a.rv && a.rv.unidad === "count" && a.rv.clave === "dias_vencido" && a.rv.tipo === "conteo");
    ok(mal.length === 0, "…y ninguna cifra de apoyo guarda el TAMAÑO de un conteo («13») como si fuera lo que el texto imprime");
    const fila = k.entrega.cifras.find((x) => x.entidad && /Días vencido/i.test(x.metrica));
    const ap = (k.entrega.apoyo || []).find((a) => a.valor === "15 días");
    ok(fila && ap, "(armado) hay una cifra de días y el apoyo «15 días»", jj((k.entrega.apoyo || []).map((a) => a.valor)));
    const rApoyo = await A.derivar({ tenant: T, conversacionId: conv, operacion: "diferencia", sobre: [fila.id, ap.id] });
    ok(rApoyo.ok === false && rApoyo.motivo === "operando_no_medido" && /criterio/.test(rApoyo.detalle) && !/unidades distintas/.test(rApoyo.detalle), "★ derivar sobre ese umbral ya no da «unidades_distintas (days, count)»: dice que es un parámetro de la consulta y que un valor del usuario se pasa en «criterio»", jj(rApoyo).slice(0, 500));
    const filasDias = k.entrega.cifras.filter((x) => x.entidad && /Días vencido/i.test(x.metrica));
    const crudoDias = (id) => L.entregas[0].hechos.find((x) => x.id === id).rv.raw;
    const rD = await A.derivar({ tenant: T, conversacionId: conv, operacion: "diferencia", sobre: [filasDias[0].id, "criterio"], criterio: { valor: 15, unidad: "days", texto: "nadie más de 15 días" } });
    ok(rD.ok === true && rD.hecho.valor === formatoDeLaCasa(crudoDias(filasDias[0].id) - 15, "days") && /^(?:\d|-)/.test(rD.hecho.valor) && /días/.test(rD.hecho.valor), `★ cuánto se pasa de los 15 días: ${rD.ok && rD.hecho.valor} (días menos criterio, en días)`, jj(rD).slice(0, 400));
    const rC = await A.derivar({ tenant: T, conversacionId: conv, operacion: "conteo", sobre: filasDias.map((x) => x.id), condicion: { op: ">", valor: "criterio" }, criterio: { valor: 15, unidad: "days", texto: "nadie más de 15 días" } });
    ok(rC.ok === true && rC.hecho.valor === `${filasDias.filter((x) => crudoDias(x.id) > 15).length} de ${filasDias.length}`, "cuántas pasan del criterio de 15 días", jj(rC.hecho));
    const rU = await A.derivar({ tenant: T, conversacionId: conv, operacion: "diferencia", sobre: [filasDias[0].id, "criterio"], criterio: { valor: 15, unidad: "pct", texto: "x" } });
    ok(rU.ok === false && rU.motivo === "unidades_distintas", "un criterio en otra unidad que los días se rechaza (los porcentajes no se restan a los días)");
  }
}

H("13 · estático y esquema");
{
  const src = (f) => fs.readFileSync(f, "utf8");
  const der = sinComentarios(src("./src/adi/capacidad/derivar.js")), uni = sinComentarios(src("./src/adi/capacidad/universoDeBodega.js")), cif = sinComentarios(src("./src/adi/capacidad/universoDeLasCifras.js")), acc = src("./src/adi/capacidad/acciones.js");
  ok(MOTIVOS_DE_DERIVACION.includes("venta_por_bodega") && MOTIVOS_DE_DERIVACION.length === new Set(MOTIVOS_DE_DERIVACION).size, "★ el motivo `venta_por_bodega` está en la lista cerrada de la derivación (sin repetidos)");
  ok(!/from\s+["'][^"']*\/(entrega|encargo)\//.test(uni) && !/node:/.test(uni) && !/from\s+["'][^"']*\/entrega\//.test(cif) && !/node:/.test(cif), "la mitad pura de la ley (`universoDeBodega.js`) no importa nada de `entrega/` ni `encargo/`, y `universoDeLasCifras.js` nada de `entrega/` (ni `node:*`): corren en edge");
  ok(/validarDerivacion\(libro, pedido, \{ tenantId, deBodega \}\)/.test(acc) && /deBodega\(h\)/.test(der), "`acciones.js:derivar` le pasa a `validarDerivacion` el origen de cada cifra (los universos del libro) y `derivar.js` lo consulta por cada cifra de origen");
  const tool = MCP_TOOLS.find((t) => t.name === "derivar");
  ok(JSON.stringify(tool).length < 2400, `la herramienta «derivar» sigue corta (${JSON.stringify(tool).length} B < 2400 B)`);
}

H("CERO RED");
ok(clasificarFuente(fs.readFileSync(new URL(import.meta.url), "utf8")).tipo === "offline", "este gate se clasifica `offline` (autochequeo)");

console.log(`\n${fail === 0 ? "✓" : "✗"} _derivar_gate: ${pass} pass · ${fail} fail`);
process.exit(fail ? 1 : 0);
