/* === _retomar_revalida_gate.mjs · RETOMAR UNA CONVERSACIÓN REVALIDANDO SUS CIFRAS (Etapa 2, bloque 4 · owner 2026-10-04, offline) ===
 * Días después, con datos recargados, la persona retoma el hilo y el anfitrión le dice —en UNA línea y solo si pasó algo— qué cifras de lo que ADI ya le entregó siguen
 * valiendo, cuáles cambiaron (con las dos cifras) y cuáles ya no están; lo dicho antes queda tal cual, nunca reescrito. Este candado prueba la revalidación REAL
 * (`capacidad/acciones.js:retomar` + `continuidad/revalidar.js`): volver a hacerle al Core, hoy, la misma pregunta que se le hizo entonces y comparar cifra por cifra.
 *
 * EL GUION (diseño `_ADI_DISENO_BLOQUE_4.md` §4 y §5b): un hilo de cuatro Entregas —un ranking de brecha (tabla ANCHA: una columna por cifra), las ventas de todos los
 * clientes, la cobranza de una cuenta y una simulación con un supuesto— y después `retomar` en cuatro escenarios de datos:
 *   1 · el MISMO dataset y la misma carga → todo `igual`, cero eventos, cero línea (la continuidad se siente invisible);
 *   2 · otra carga con la venta de un cliente cambiada y OTRO cliente retirado → ese cliente `cambio` (valores y diferencia exactos), el retirado `ya_no_existe`, el resto
 *       `igual`, lo derivado del supuesto `no_se_revalida`; UNA línea en tercera persona que nombra hasta 3 cambios, con «antes … ahora …», y dice cuántos más hay;
 *   3 · otra carga con OTRO período → las cifras de esa Entrega `no_comparable · otro_periodo` (con su valor de hoy y sin diferencia); la línea es solo el cambio de datos;
 *   4 · un benchmark declarado y confirmado → lo medido `igual`, las brechas `no_comparable · otra_referencia`.
 * Y la REGLA DEL OWNER para lo que la línea nombra (2026-10-04, sin materialidad ni umbrales): la prioridad que la Entrega original ya traía manda; la magnitud SOLO
 * desempata entre cifras de la MISMA prioridad y la MISMA unidad; nunca dinero contra porcentaje. Un escenario de 6 cambios lo prueba, con dos carnadas.
 *
 * CADA CONTROL TIENE SU CARNADA (rojo si no se cumple): un libro sin valor exacto ni encargo no produce ningún `igual`; un libro de otra empresa se rechaza; un `igual`
 * cuyos crudos imprimen distinto, o un `actual` en un `sin_reverificar`/`no_se_revalida`, los marca la auditoría; el libro queda BYTE A BYTE igual antes y después de
 * retomar (y nadie lo escribió); sin límite declarado cuando sí se revalidó; la línea nunca dice «yo», «te», «usted» ni una versión de carga; un cambio grande en una fila
 * de baja prioridad NO desplaza a uno de alta prioridad; dos de igual prioridad y misma unidad se desempatan por magnitud.
 *
 * CERO llamadas a un LLM · CERO red · CERO ruta del gateway. Solo por `npm run gates:offline` o
 * `node --import ./scripts/offline-guard.mjs _retomar_revalida_gate.mjs`. */
import fs from "node:fs";
import { initTenant, getTenantData } from "./src/data/tenantStore.js";
import { TENANT_DEMO } from "./src/data/tenants/demo.js";
import { validarEncargo } from "./src/adi/encargo/validar.js";
import { componerEntrega } from "./src/adi/entrega/componer.js";
import { crearAcciones, CABECERA_DE_RETOMAR } from "./src/adi/capacidad/acciones.js";
import { conTenantActivo } from "./src/adi/capacidad/aislamiento.js";
import { crearAlmacenEnMemoria, ErrorDeAlmacen } from "./src/adi/continuidad/almacen.js";
import { LIBRO_TOPE_BYTES, tamanoBytes } from "./src/adi/continuidad/libro.js";
import { cifraDeHecho, llaveDeCifra, revalidarEntrega, elegirCambiosANombrar, cifrasDeLaEntrega, ESTADOS_DE_REVALIDACION, CAMBIOS_NOMBRADOS_MAX } from "./src/adi/continuidad/revalidar.js";
import { formatoDeLaCasa } from "./src/adi/notario/hechos.js";

let pass = 0, fail = 0;
const fails = [];
const ok = (c, m, extra = "") => { if (c) { pass++; } else { fail++; fails.push(m + (extra ? " — " + extra : "")); console.log("  ✗ " + m + (extra ? "\n      " + extra : "")); } };
const H = (t) => console.log(`\n${t}`);
const jj = (x) => JSON.stringify(x);
const clon = (x) => JSON.parse(JSON.stringify(x));
const sinComentarios = (src) => String(src).replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`\\])\/\/[^\n]*/g, "$1");

initTenant(TENANT_DEMO);
const T = (dataset, version, id = "demo") => ({ id, nombre: "Distribuidora Demo", dataset, version, sello: null });
let _tick = 0;
const reloj = () => new Date(Date.UTC(2026, 9, 4, 12, 0, 0) + (++_tick) * 1000).toISOString();   // la hora real no entra al candado

/* ── los datasets: copias del demo con UN cambio cada una (la venta oficial de un cliente sale de `clientesVentas.anterior` × su crecimiento del escenario) ─────── */
const conVentas = (ds, cambios) => { const c = clon(ds); for (const [nombre, anterior] of Object.entries(cambios)) c.clientesVentas.find((x) => x.nombre === nombre).anterior = anterior; return c; };
const sinCliente = (ds, nombre) => { const c = clon(ds); for (const k of ["clientesVentas", "clientesMargen"]) c[k] = c[k].filter((x) => x.nombre !== nombre); delete c.flujoComercial.clientes[nombre]; return c; };
const conFechaDeCorte = (ds, fecha) => { const c = clon(ds); c.flujoComercial.fechaCorte = fecha; return c; };

/* ── los Encargos del hilo ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────── */
const ENC = {
  ranking: { version: "encargo/v1", partes: [{ id: "p1", tema: "comercial", cierre: "lectura" }] },   // «¿dónde deja de ganar?»: tabla ANCHA (Venta · Margen · Contribución no capturada)
  ventasTodos: { version: "encargo/v1", partes: [{ id: "p1", tema: "comercial", cierre: "cifra", conceptos: ["ventas"], universo: { eje: "cliente" } }] },
  cobranza: { version: "encargo/v1", partes: [{ id: "p1", tema: "cobranza", cierre: "cifra", conceptos: ["dias_vencido", "saldo_pendiente"], entidades: [{ nombre: "Lider", eje: "cliente" }] }] },
  simulacion: { version: "encargo/v1", partes: [{ id: "p1", tema: "comercial", cierre: "simulacion", entidades: [{ nombre: "Falabella" }], supuestos: ["s1"] }], supuestos: [{ id: "s1", tipo: "price", valor: 5, unidad: "pct", alcance: { eje: "cliente", nombre: "Falabella" }, origen: "supuesto" }] },
};
const ventasDe = (...nombres) => ({ version: "encargo/v1", partes: [{ id: "p1", tema: "comercial", cierre: "cifra", conceptos: ["ventas"], entidades: nombres.map((nombre) => ({ nombre })) }] });

/* ── la verdad de HOY, leída DIRECTO del Core (no por retomar): el oráculo contra el que se audita cada veredicto ────────────────────────────────────────── */
function verdadDeHoy(dataset, encargos) {
  const out = new Map();
  conTenantActivo(dataset, () => { encargos.forEach((enc, k) => { const s = componerEntrega(validarEncargo(enc, {})); const por = new Map(); if (s.ok) for (const Hh of s.entrega.procedencia.libro.hechos) { const c = cifraDeHecho(Hh); if (!c || c.raw == null || !c.clave) continue; const l = llaveDeCifra(c); if (!por.has(l)) por.set(l, []); por.get(l).push(c.raw); } out.set(k + 1, por); }); });
  return out;
}
const LLAVE_DE = (h) => llaveDeCifra({ tipo: h.rv.tipo, clave: h.rv.clave, dueno: h.rv.dueno, unidad: h.rv.unidad, procedencia: h.rv.procedencia });
const nDe = (id) => Number(String(id).slice(1, String(id).indexOf(".")));

/* AUDITORÍA: cada veredicto de un retomar contra el oráculo y contra las reglas duras de §2.3. Devuelve la lista de problemas (vacía = limpio). */
function auditar(ret, hoy) {
  const malos = [];
  for (const h of ret.hechos) {
    const rv = h.revalidacion, est = h.estadoReverificacion;
    if (!rv) { malos.push(`${h.id}: sin revalidación`); continue; }
    if (rv.estado !== est || !ESTADOS_DE_REVALIDACION.includes(est)) malos.push(`${h.id}: estado incoherente (${rv.estado} / ${est})`);
    if ((est === "sin_reverificar" || est === "no_se_revalida") && rv.actual !== undefined) malos.push(`${h.id}: «actual» dentro de ${est}`);
    if (est !== "cambio" && rv.diferencia !== undefined) malos.push(`${h.id}: diferencia dentro de ${est}`);
    if (est === "igual") {
      const hoyRaws = (hoy && hoy.get(nDe(h.id)) && hoy.get(nDe(h.id)).get(LLAVE_DE(h))) || [];
      if (!hoyRaws.length || hoyRaws.some((r) => formatoDeLaCasa(r, h.rv.unidad) !== formatoDeLaCasa(h.rv.raw, h.rv.unidad))) malos.push(`${h.id}: «igual» cuyos crudos no imprimen lo mismo (antes ${formatoDeLaCasa(h.rv.raw, h.rv.unidad)}, hoy ${hoyRaws.map((r) => formatoDeLaCasa(r, h.rv.unidad)).join("/")})`);
    }
    if (est === "cambio") {
      const hoyRaws = (hoy && hoy.get(nDe(h.id)) && hoy.get(nDe(h.id)).get(LLAVE_DE(h))) || [];
      if (!hoyRaws.includes(rv.actual && rv.actual.raw)) malos.push(`${h.id}: «cambio» cuyo valor de hoy no es el que da el Core`);
      if (!(rv.diferencia && rv.diferencia.valor === rv.actual.raw - rv.anterior.raw)) malos.push(`${h.id}: la diferencia no es actual − anterior`);
      if (formatoDeLaCasa(rv.actual.raw, h.rv.unidad) === formatoDeLaCasa(rv.anterior.raw, h.rv.unidad)) malos.push(`${h.id}: «cambio» que se imprime igual`);
    }
    if (est === "no_comparable" && !["otro_periodo", "otra_moneda", "otra_unidad", "otra_referencia", "otro_universo"].includes(rv.motivo)) malos.push(`${h.id}: no_comparable sin un motivo de la lista cerrada`);
    if ((est === "sin_reverificar" || est === "no_se_revalida") && !(typeof rv.motivo === "string" && rv.motivo.length > 10)) malos.push(`${h.id}: ${est} sin su motivo en palabras de negocio`);
    if (est === "igual" && (rv.actual !== undefined || rv.diferencia !== undefined)) malos.push(`${h.id}: «igual» con más que el valor anterior`);
  }
  const r = ret.resumen, suma = ESTADOS_DE_REVALIDACION.reduce((a, e) => a + r[e], 0);
  if (r.total !== ret.hechos.length || suma !== r.total) malos.push(`el resumen no cuadra con los hechos (${suma}/${r.total}/${ret.hechos.length})`);
  for (const e of ESTADOS_DE_REVALIDACION) if (r[e] !== ret.hechos.filter((h) => h.estadoReverificacion === e).length) malos.push(`resumen.${e} no es el conteo real`);
  return malos;
}
const LINEA_PROHIBIDA = /\b(yo|te|tu|tú|usted|ustedes|nosotros)\b|versi[oó]n|carga v\d|versionId|→/i;
const lineaLimpia = (l) => l === null || (typeof l === "string" && !l.includes("\n") && !LINEA_PROHIBIDA.test(l));
const cuenta = (texto, sub) => texto.split(sub).length - 1;

/* ═══ 0 · EL HILO ═══════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════ */
H("0 · el hilo de cuatro Entregas (ranking ancho · ventas de todos · cobranza · simulación) y lo que el libro conserva para revalidar");
const store = crearAlmacenEnMemoria();
const { consultar } = crearAcciones({ continuidad: store, ahora: reloj });
let escrituras = 0;
const espiado = { ...store, guardarLibro: async (...a) => { escrituras++; return store.guardarLibro(...a); } };
const { retomar } = crearAcciones({ continuidad: espiado, ahora: reloj });
const ORDEN = [ENC.ranking, ENC.ventasTodos, ENC.cobranza, ENC.simulacion];
let cid = null;
const respuestas = [];
for (const enc of ORDEN) {
  const r = await consultar({ tenant: T(TENANT_DEMO, 1), encargo: { ...enc, ...(cid ? { conversacionId: cid } : {}) } });
  if (!r.ok) console.log("   (la consulta no compuso: " + jj(r.noResuelto) + ")");
  cid = r.continuidad.conversacionId;
  respuestas.push(r);
}
ok(respuestas.every((r) => r.ok === true && r.continuidad.guardada === true), "las cuatro consultas del hilo se entregan y se guardan");
const libro0 = await store.leerLibro("demo", cid);
const bytes0 = tamanoBytes(libro0);
console.log(`   libro del hilo: ${bytes0} bytes de ${LIBRO_TOPE_BYTES} (${libro0.entregas.map((e) => `E${e.n}: ${e.hechos.length} hechos`).join(" · ")})`);
ok(libro0.entregas.length === 4 && libro0.entregas.every((e) => e.recortada === false) && bytes0 <= LIBRO_TOPE_BYTES, `★ el hilo cabe en el tope del libro sin recortar ninguna Entrega (${bytes0} de ${LIBRO_TOPE_BYTES} bytes: el tope lo exige la base, migración 015)`);
ok(libro0.empresaId === "demo" && libro0.entregas.every((e) => e.revalidable === true && e.encargo && e.referencias && e.moneda === "$"), "el libro guarda la empresa que lo abrió, y por Entrega: revalidable, el Encargo, con qué referencias se calculó y la moneda", jj({ empresaId: libro0.empresaId, e1: { r: libro0.entregas[0].revalidable, m: libro0.entregas[0].moneda } }));
ok(libro0.entregas.every((e) => !("conversacionId" in e.encargo) && !("preguntaOriginal" in e.encargo) && !("contexto" in e.encargo)) && jj(libro0.entregas[2].encargo) === jj(ENC.cobranza), "el Encargo guardado es la parte estructurada de lo que se preguntó (sin el id de la conversación, sin la pregunta original ni la cita): este libro no guarda ni una frase");
ok(libro0.entregas[0].referencias.marco === "Benchmark de margen: 30.1%, declarado por la empresa." && jj(libro0.entregas[0].referencias.criterios) === "[]", "con qué referencia se calculó: el benchmark que el Marco imprimió y ningún criterio declarado");
const hechosDelLibro = libro0.entregas.flatMap((e) => e.hechos);
ok(hechosDelLibro.every((h) => h.rv && Number.isFinite(h.rv.raw) && h.rv.clave && h.rv.unidad && h.rv.dueno && typeof h.rv.procedencia === "string" && Number.isFinite(h.rv.prioridad)), "★ cada hecho guarda su valor EXACTO, su unidad, la clave de su métrica, su dueño, su procedencia y la prioridad de su fila", jj(hechosDelLibro.find((h) => !(h.rv && Number.isFinite(h.rv.raw))) || null));
ok(hechosDelLibro.every((h) => h.rv.raw === respuestas[Number(h.id.slice(1, h.id.indexOf("."))) - 1].entrega.json.procedencia.libro.porId.get(h.ref).numeros.at(-1).raw), "★ el valor exacto guardado ES el de la Entrega entregada (el libro de hechos del Core de ese turno), cifra por cifra");
const filaAncha = libro0.entregas[0].hechos[0];
ok(filaAncha.sujeto === null && filaAncha.metrica === null && filaAncha.valor === null && filaAncha.unidad === null && filaAncha.rv.metrica === "Venta" && filaAncha.rv.mas.length === 2 && filaAncha.rv.mas.map((m) => m.metrica).join("|") === "Margen|Contribución no capturada (brecha estimada)", "una fila ANCHA (Venta · Margen · Contribución no capturada) guarda las tres cifras, cada una con la columna de la que sale; los campos de siempre de la fila no se mueven", jj(filaAncha.rv.mas && filaAncha.rv.mas.map((m) => m.metrica)));
const cifrasE1 = cifrasDeLaEntrega(libro0.entregas[0]);
ok(cifrasE1.length === 7 && cifrasE1.slice(0, 3).map((c) => c.id).join(",") === "E1.h1,E1.h1.2,E1.h1.3" && cifrasE1.every((c) => c.sujeto && c.metrica && c.rv && c.rv.mas === undefined), "cada cifra de una fila ancha sale con su propio id (`E1.h1`, `E1.h1.2`, `E1.h1.3`) y su rótulo; las filas comunes siguen siendo una cifra con el id de siempre", cifrasE1.map((c) => c.id).join(","));
const simulacion = libro0.entregas[3].hechos;
ok(simulacion.filter((h) => h.rv.deSupuesto === true).length === 5 && simulacion.filter((h) => h.rv.deSupuesto === true).every((h) => h.rv.procedencia === "derivado") && simulacion.filter((h) => !h.rv.deSupuesto).every((h) => h.rv.procedencia === "medido"), "★ lo derivado de un SUPUESTO se marca (el libro de hechos lo da por «medido» de titular: no hay otro dato que lo distinga de un derivado del motor), y lo medido de esa fila no", jj(simulacion.map((h) => [h.metrica, h.rv.deSupuesto === true])));
// la salida de `consultar` no cambia: lo nuevo vive SOLO en el libro
const sale = jj(respuestas);
ok(!sale.includes('"rv"') && !sale.includes('"revalidable"') && !sale.includes('"empresaId"') && !sale.includes('"encargo":{"version"'), "★ nada de lo nuevo sale en la respuesta de `consultar` (vive solo en el libro): su texto y su json son los de siempre");
ok(respuestas.map((r) => r.continuidad.estadoVigente.loEntregado.at(-1)).join(" | ") === "E1 · lectura · E1.h1–E1.h3 | E2 · comercial · Falabella, Lider, Jumbo, Sodimac, Tottus, Paris, Mercado Libre, Ripley, Easy, La Polar, Hites, ABC, Unimarc · cifra · E2.h1–E2.h14 | E3 · cobranza · Lider · cifra · E3.h1–E3.h2 | E4 · comercial · Falabella · simulacion · E4.h1–E4.h9", "el estado vigente (entidades y rango de hechos de cada Entrega) es el de siempre: las filas anchas no suman entidades ni hechos nuevos; el total del listado completo de E2 es UN hecho más (E2.h14) y no es una entidad", respuestas.map((r) => r.continuidad.estadoVigente.loEntregado.at(-1)).join(" | "));
const cita = await consultar({ tenant: T(TENANT_DEMO, 1), encargo: { ...ENC.cobranza, conversacionId: cid, contexto: { entregaRef: "E3" } } });
ok(cita.ok && cita.antecedentes && cita.antecedentes[0].hechos.length === 2 && cita.antecedentes[0].hechos.every((h) => !("rv" in h) && h.unidad === null && h.periodo === null), "★ citar una respuesta anterior (`contexto: E3`) trae los hechos TAL CUAL se entregaron (sin lo que el libro guarda aparte para revalidar)", jj(cita.antecedentes && cita.antecedentes[0].hechos[0]));
// esa consulta de la cita agregó una Entrega (E5): el hilo del guion es el de cuatro — se vuelve a armar uno limpio para los escenarios
const store2 = crearAlmacenEnMemoria();
const acc2 = crearAcciones({ continuidad: store2, ahora: reloj });
const espiado2 = { ...store2, guardarLibro: async (...a) => { escrituras++; return store2.guardarLibro(...a); } };
const { retomar: retomarHilo } = crearAcciones({ continuidad: espiado2, ahora: reloj });
let cid2 = null;
for (const enc of ORDEN) { const r = await acc2.consultar({ tenant: T(TENANT_DEMO, 1), encargo: { ...enc, ...(cid2 ? { conversacionId: cid2 } : {}) } }); cid2 = r.continuidad.conversacionId; }
const instantanea = async () => jj(await store2.leerLibro("demo", cid2));
const antesDeTodo = await instantanea();
escrituras = 0;
const HOY = { base: verdadDeHoy(TENANT_DEMO, ORDEN) };   // lo que da el Core HOY con el mismo dataset: el oráculo de la auditoría

/* un retomar que además VERIFICA que no tocó nada: el libro idéntico byte a byte y ninguna escritura */
async function retomarSinTocar(tenant, conversacionId = cid2, accion = retomarHilo, elStore = store2) {
  const antes = jj(await elStore.leerLibro("demo", conversacionId));
  const e0 = escrituras, t0 = getTenantData();
  const ret = await accion({ tenant, conversacionId });
  const despues = jj(await elStore.leerLibro("demo", conversacionId));
  return { ret, intacto: antes === despues && escrituras === e0, restaurado: getTenantData() === t0 };
}

/* ═══ 1 · EL MISMO DATASET, LA MISMA CARGA → TODO IGUAL, CERO LÍNEA ═══════════════════════════════════════════════════════════════════════════════════ */
H("1 · mismo dataset y misma carga → todo igual · cero eventos · cero línea (la continuidad invisible)");
{
  const { ret, intacto, restaurado } = await retomarSinTocar(T(TENANT_DEMO, 1));
  ok(ret.ok === true && ret.hechos.length === 32 && ret.resumen.total === 32, "retomar trae las 31 cifras de las cuatro Entregas (la fila ancha de E1 abre sus tres cifras) y el total del listado completo de E2 (E2.h14)", String(ret.hechos && ret.hechos.length));
  ok(ret.resumen.igual === 26 && ret.resumen.no_se_revalida === 6 && ret.hechos.find((h) => h.id === "E2.h14").estadoReverificacion === "no_se_revalida" && ret.resumen.cambio + ret.resumen.ya_no_existe + ret.resumen.no_comparable + ret.resumen.sin_reverificar === 0, "★ todo lo medido sale IGUAL (26) y lo derivado del supuesto NO SE REVALIDA (5, más el total del listado, que lo revalidan sus filas): ni un cambio ni un «no sé» donde no pasó nada", jj(ret.resumen));
  ok(ret.eventos.length === 0 && ret.lineaContinuidad === null, "★ cero eventos y cero línea: sin nada que aclarar, la continuidad no dice una palabra");
  ok(auditar(ret, HOY.base).length === 0, "la auditoría contra lo que da el Core hoy no encuentra ni un veredicto mal puesto", auditar(ret, HOY.base).join(" · "));
  ok(ret.advertencias.length === 0 && !jj(ret).includes("no re-verifica"), "★ y sin el límite declarado de antes («este corte no re-verifica…»): se revalidó de verdad, así que no hay nada que advertir");
  ok(intacto && restaurado, "★ el libro queda BYTE A BYTE igual antes y después (el pasado no se reescribe), nadie lo escribió y la empresa activa del Core se restauró");
  ok(ret.hechos.filter((h) => h.estadoReverificacion === "no_se_revalida" && !h.rv.deListado).every((h) => h.revalidacion.actual === undefined && /supuesto es de quien lo planteó/.test(h.revalidacion.motivo)), "lo derivado de un supuesto: «un supuesto es de quien lo planteó: no se revalida contra los datos», sin valor de hoy");
  { const tl = ret.hechos.find((h) => h.id === "E2.h14"); ok(tl && tl.estadoReverificacion === "no_se_revalida" && tl.revalidacion.actual === undefined && /suma de las cifras de su listado/.test(tl.revalidacion.motivo) && tl.origen === "derivado" && /total del listado completo \(13 cuentas\)/.test(tl.metrica), "★ el total del listado completo (E2.h14) NO se revalida aparte: lo dicen sus filas; retomar lo declara con su motivo y sin valor de hoy (no se afirma como vigente)", JSON.stringify(tl)); }
  ok(ret.hechos.some((h) => h.id === "E4.h1" && h.estadoReverificacion === "igual") && ret.hechos.find((h) => h.id === "E4.h1").metrica === "Venta actual", "…y lo MEDIDO de esa misma simulación (la venta actual de la que parte) sí se revalida");
  ok(ret.uso === CABECERA_DE_RETOMAR && CABECERA_DE_RETOMAR.length === 4 && Object.isFrozen(CABECERA_DE_RETOMAR) && !/boleta|\bfig\b|carga v|versi[oó]n/i.test(CABECERA_DE_RETOMAR.join(" ")), "la cabecera de uso (cuatro reglas, en palabras de negocio) viaja en cada retomar");
  ok(jj(JSON.parse(jj(ret))) === jj(ret) && jj((await retomarSinTocar(T(TENANT_DEMO, 1))).ret) === jj(ret), "la respuesta es JSON limpio y determinística: retomar dos veces da exactamente lo mismo");
  const guardadas = JSON.parse(antesDeTodo).entregas;
  ok(ret.entregas.length === 4 && ret.entregas.every((e, k) => e.n === guardadas[k].n && e.versionId === guardadas[k].versionId && e.entregadaEn === guardadas[k].entregadaEn && jj(e.periodo) === jj(guardadas[k].periodo) && jj(e.temas) === jj(guardadas[k].temas) && e.recortada === false), "lo entregado se devuelve tal cual quedó guardado (número, carga, fecha, período, temas)");
}

/* ═══ 2 · OTRA CARGA: UNA VENTA CAMBIADA Y UN CLIENTE RETIRADO ═══════════════════════════════════════════════════════════════════════════════════════ */
H("2 · otra carga (versión 2) con la venta de Lider cambiada y Unimarc retirado → cambio con valores exactos, ya_no_existe, el resto igual, UNA línea");
const DS2 = sinCliente(conVentas(TENANT_DEMO, { Lider: 14000 }), "Unimarc");
const HOY2 = { base: verdadDeHoy(DS2, ORDEN) };
{
  const { ret, intacto, restaurado } = await retomarSinTocar(T(DS2, 2));
  const por = (id) => ret.hechos.find((h) => h.id === id);
  ok(ret.ok && auditar(ret, HOY2.base).length === 0, "la auditoría contra lo que da el Core con los datos nuevos no encuentra ni un veredicto mal puesto", auditar(ret, HOY2.base).join(" · "));
  const lider = por("E2.h2");
  ok(lider.sujeto === "Lider" && lider.estadoReverificacion === "cambio" && lider.revalidacion.anterior.raw === 17843000 && lider.revalidacion.actual.raw === 16086000 && lider.revalidacion.diferencia.valor === -1757000 && lider.revalidacion.diferencia.texto === "$1.8M" && lider.revalidacion.diferencia.sentido === "baja", "★ la venta de Lider: antes $17.8M (17.843.000), ahora $16.1M (16.086.000), diferencia −$1.8M calculada por ADI", jj(lider.revalidacion));
  ok(lider.revalidacion.anterior.valor === "$17.8M" && lider.revalidacion.actual.valor === "$16.1M" && lider.revalidacion.cargaAnterior === 1 && lider.revalidacion.cargaActual === 2, "con las dos cifras tal como las imprime la casa y las dos cargas (tipadas)");
  const unimarc = por("E2.h13");
  ok(unimarc.sujeto === "Unimarc" && unimarc.estadoReverificacion === "ya_no_existe" && unimarc.revalidacion.anterior.valor === "$2.3M" && unimarc.revalidacion.actual === undefined, "★ Unimarc (retirado de los datos): ya_no_existe, con lo que se entregó y sin valor de hoy");
  ok(ret.hechos.filter((h) => h.id.startsWith("E2.") && h.id !== "E2.h2" && h.id !== "E2.h13" && h.id !== "E2.h14").every((h) => h.estadoReverificacion === "igual"), "los otros 11 clientes de esa Entrega: igual");
  const cambiaron = ret.hechos.filter((h) => h.estadoReverificacion === "cambio" || h.estadoReverificacion === "ya_no_existe");
  ok(cambiaron.every((h) => ["Lider", "Total (cuentas materiales)", "Unimarc"].includes(h.sujeto)), "lo que cambió es SOLO lo de Lider (su venta, su brecha, la cobranza de su cuenta y el total que lo incluye) y lo de Unimarc: nada más se movió", cambiaron.map((h) => `${h.id}:${h.sujeto}`).join(" "));
  ok(ret.hechos.filter((h) => h.estadoReverificacion === "no_se_revalida" && !h.rv.deListado).length === 5 && ret.hechos.filter((h) => h.id.startsWith("E4.") && h.rv.deSupuesto).every((h) => h.estadoReverificacion === "no_se_revalida"), "lo derivado del supuesto sigue «no se revalida»");
  const tipos = ret.eventos.map((e) => e.tipo);
  ok(tipos.join(",") === "datos_cambiaron,cifra_cambio", "eventos: el cambio de datos y UN evento de cifras", tipos.join(","));
  const L = ret.lineaContinuidad;
  ok(typeof L === "string" && !L.includes("\n") && lineaLimpia(L), "★ UNA línea, sin «yo», «te» ni «usted», sin versiones ni flechas de carga: tercera persona y lenguaje de negocio", L);
  const distintos = new Set(cambiaron.map((h) => `${h.sujeto}|${h.metrica}|${h.revalidacion.anterior.valor}|${h.revalidacion.actual ? h.revalidacion.actual.valor : ""}`)).size;
  ok(cuenta(L, "(antes ") === CAMBIOS_NOMBRADOS_MAX && L.includes("(antes $17.8M, ahora $16.1M)") && L.includes("venta de Lider") && L.includes(`, y ${distintos - CAMBIOS_NOMBRADOS_MAX} cambios más; el detalle está disponible`), `★ nombra TRES cambios con «antes … ahora …» y dice cuántos más hay (${distintos} distintos: «y ${distintos - CAMBIOS_NOMBRADOS_MAX} cambios más»), nunca solo el conteo`, L);
  ok(L.startsWith("los datos cambiaron desde la Entrega 4 · de lo ya entregado, con los datos actuales cambiaron: venta de Lider (antes $17.8M, ahora $16.1M), saldo pendiente de Lider (antes $9.8M, ahora $8.8M), contribución no capturada (brecha estimada) de Lider (antes $1.5M, ahora $1.4M), y "), "los tres nombrados son los de MAYOR PRIORIDAD de las Entregas originales (la fila de Lider, de arriba hacia abajo en cada tabla), la venta repetida en dos Entregas se nombra una vez", L);
  ok(!/Unimarc/.test(L.split(", y ")[0]) && ret.hechos.some((h) => h.id === "E2.h13" && h.estadoReverificacion === "ya_no_existe"), "el cliente retirado NO se nombra en la línea (su prioridad es la última de su tabla) pero sí está completo en el detalle tipado");
  ok(intacto && restaurado, "★ el libro sigue byte a byte igual y el Core quedó como estaba");
  ok(ret.advertencias.length === 0, "no hay nada que no se haya podido revalidar: sin advertencias");
}
{
  // «igual» es lo que la casa IMPRIME: una diferencia por debajo de lo impreso no es un aviso (decisión del owner, B)
  const DS2b = conVentas(TENANT_DEMO, { Lider: 15530 });
  const hoyB = verdadDeHoy(DS2b, ORDEN);
  const { ret } = await retomarSinTocar(T(DS2b, 1));
  const lider = ret.hechos.find((h) => h.id === "E2.h2");
  const crudosHoy = hoyB.get(2).get(LLAVE_DE(lider));
  ok(crudosHoy[0] !== lider.rv.raw && formatoDeLaCasa(crudosHoy[0], "money") === formatoDeLaCasa(lider.rv.raw, "money") && lider.estadoReverificacion === "igual", `★ «sigue igual» = se IMPRIME igual: la venta de Lider pasó de ${lider.rv.raw} a ${crudosHoy[0]} y la casa dice $17.8M en las dos`, jj(lider.revalidacion));
  ok(auditar(ret, hoyB).length === 0 && ret.lineaContinuidad === null, "y sin nada que decir: cero línea", `${auditar(ret, hoyB).join(" · ")} / ${ret.lineaContinuidad}`);
}

/* ═══ 3 · OTRO PERÍODO → NO COMPARABLE ═════════════════════════════════════════════════════════════════════════════════════════════════════════════ */
H("3 · otra carga con OTRO período en el Marco → la Entrega de cobranza queda no_comparable (otro_periodo), sin diferencia; la línea es solo el cambio de datos");
{
  const DS3 = conFechaDeCorte(TENANT_DEMO, "2026-09-30");
  const hoy3 = verdadDeHoy(DS3, ORDEN);
  const { ret, intacto } = await retomarSinTocar(T(DS3, 2));
  const e3 = ret.hechos.filter((h) => h.id.startsWith("E3."));
  ok(e3.length === 2 && e3.every((h) => h.estadoReverificacion === "no_comparable" && h.revalidacion.motivo === "otro_periodo"), "★ toda la Entrega de cobranza (foto al 31 ago) frente a una foto al 30 sep: no_comparable · otro_periodo, nunca «cambió»", jj(e3.map((h) => h.revalidacion.motivo)));
  ok(e3.every((h) => h.revalidacion.diferencia === undefined && h.revalidacion.actual && h.revalidacion.periodoAnterior === "foto de cobranza al 31 ago 2026" && h.revalidacion.periodoActual === "foto de cobranza al 30 sep 2026"), "trae el valor de hoy rotulado con SU período y el de entonces, y NINGUNA diferencia", jj(e3[0].revalidacion));
  ok(ret.resumen.cambio === 0 && ret.resumen.ya_no_existe === 0 && ret.resumen.no_comparable === 2 && ret.resumen.igual === 24 && auditar(ret, hoy3).length === 0, "las otras Entregas (de otro período distinto del que cambió: año cerrado) siguen igual; la auditoría contra el Core no objeta nada", jj(ret.resumen));
  ok(ret.lineaContinuidad === "los datos cambiaron desde la Entrega 4", "★ la línea es SOLO el cambio de datos: lo no comparable no genera texto", ret.lineaContinuidad);
  ok(ret.eventos.length === 1 && ret.eventos[0].tipo === "datos_cambiaron" && lineaLimpia(ret.lineaContinuidad) && intacto, "un solo evento (datos_cambiaron), línea limpia y el libro intacto");
}

/* ═══ 4 · UN BENCHMARK DECLARADO → MEDIDOS IGUAL, BRECHAS NO COMPARABLES ═══════════════════════════════════════════════════════════════════════════ */
H("4 · un benchmark declarado y confirmado (aportarContexto) → lo medido igual, las brechas no_comparable (otra_referencia): cambió la referencia, no la realidad");
{
  const { aportarContexto } = acc2;
  const ap = await aportarContexto({ tenant: T(TENANT_DEMO, 1), conversacionId: cid2, aportes: [{ clase: "criterio", concepto: "benchmark", valor: 28, unidad: "pct" }] });
  await aportarContexto({ tenant: T(TENANT_DEMO, 1), conversacionId: cid2, confirmar: [ap.resultados[0].id] });
  ok(ap.resultados[0].lugar && ap.resultados[0].lugar.enLaEntrega === true, "el benchmark declarado tiene lugar en la Entrega (es una referencia de la casa)");
  const { ret, intacto } = await retomarSinTocar(T(TENANT_DEMO, 1));
  const brechas = ret.hechos.filter((h) => h.rv.procedencia === "estimacion_referencia");
  ok(brechas.length === 3 && brechas.every((h) => h.estadoReverificacion === "no_comparable" && h.revalidacion.motivo === "otra_referencia"), "★ las brechas (estimadas contra el benchmark) quedan no_comparable · otra_referencia: la referencia con la que se calcularon cambió", jj(brechas.map((h) => [h.id, h.estadoReverificacion, h.revalidacion.motivo])));
  ok(brechas.every((h) => h.revalidacion.actual && h.revalidacion.diferencia === undefined), "con el valor de hoy y SIN diferencia (no es un cambio de la realidad, es un cambio de la referencia)");
  ok(ret.hechos.filter((h) => h.rv.procedencia !== "estimacion_referencia" && !h.rv.deSupuesto && !h.rv.deListado).every((h) => h.estadoReverificacion === "igual"), "★ lo medido sigue igual: un declarado nunca pisa un medido");
  ok(auditar(ret, verdadDeHoy(TENANT_DEMO, ORDEN)).length === 0 && ret.lineaContinuidad === null && ret.eventos.length === 0, "sin cambio de datos ni de cifras: cero línea");
  // un HECHO declarado de la misma cifra tampoco la pisa
  const decl = await aportarContexto({ tenant: T(TENANT_DEMO, 1), conversacionId: cid2, aportes: [{ clase: "hecho", concepto: "ventas", entidad: "Lider", valor: { raw: 999999999, unidad: "money", moneda: "CLP", escala: "unidad" } }] });
  await aportarContexto({ tenant: T(TENANT_DEMO, 1), conversacionId: cid2, confirmar: [decl.resultados[0].id] });
  const ret2 = (await retomarSinTocar(T(TENANT_DEMO, 1))).ret;
  ok(ret2.hechos.find((h) => h.id === "E2.h2").estadoReverificacion === "igual" && ret2.hechos.every((h) => h.revalidacion.actual === undefined || !String(h.revalidacion.actual.valor).includes("999")), "★ un hecho declarado y confirmado de la venta de Lider NO se compara con lo medido ni lo sustituye: la cifra medida sigue igual");
  ok(intacto, "el libro intacto");
}

/* ═══ 5 · SEIS CAMBIOS: LA PRIORIDAD DE LA ENTREGA ORIGINAL MANDA, LA MAGNITUD SOLO DESEMPATA ═══════════════════════════════════════════════════════════ */
H("5 · seis cambios en una Entrega → la línea nombra los TRES de mayor prioridad (no los de mayor monto) y dice «y 3 cambios más»; el detalle los trae todos");
{
  const sA = crearAlmacenEnMemoria();
  const aA = crearAcciones({ continuidad: sA, ahora: reloj });
  const r0 = await aA.consultar({ tenant: T(TENANT_DEMO, 1), encargo: ENC.ventasTodos });
  const cidA = r0.continuidad.conversacionId;
  const ORDEN_CLIENTES = r0.entrega.json.cifras.filas.map((f) => f.valores["Entidad / grupo"]);
  // de arriba hacia abajo: Lider (fila 2), Jumbo (3) y Tottus (5) cambian POCO; Mercado Libre (7) y La Polar (10) cambian MUCHO; Unimarc (13) se retira
  const DS5 = sinCliente(conVentas(TENANT_DEMO, { Lider: 15200, Jumbo: 15000, Tottus: 6000, "Mercado Libre": 2000, "La Polar": 1000 }), "Unimarc");
  const hoy5 = verdadDeHoy(DS5, [ENC.ventasTodos]);
  const retA = crearAcciones({ continuidad: { ...sA, guardarLibro: async (...a) => { escrituras++; return sA.guardarLibro(...a); } }, ahora: reloj }).retomar;
  const ret5 = (await retomarSinTocar(T(DS5, 2), cidA, retA, sA)).ret;
  const cambios = ret5.hechos.filter((h) => h.estadoReverificacion === "cambio" || h.estadoReverificacion === "ya_no_existe");
  ok(cambios.length === 6 && ret5.resumen.cambio === 5 && ret5.resumen.ya_no_existe === 1 && ret5.resumen.igual === 7, "seis cambios (cinco ventas y un cliente retirado) y siete que siguen igual", jj(ret5.resumen));
  ok(auditar(ret5, hoy5).length === 0, "la auditoría contra el Core no objeta ningún veredicto", auditar(ret5, hoy5).join(" · "));
  const mag = (h) => Math.abs(h.revalidacion.diferencia ? h.revalidacion.diferencia.valor : 0);
  const porMonto = cambios.slice().sort((a, b) => mag(b) - mag(a)).slice(0, 3).map((h) => h.sujeto);
  const L = ret5.lineaContinuidad;
  const par = (suj) => { const r = cambios.find((h) => h.sujeto === suj).revalidacion; return `venta de ${suj} (antes ${r.anterior.valor}, ahora ${r.actual.valor})`; };
  ok(porMonto.join(",") === "Mercado Libre,La Polar,Jumbo" && porMonto.join(",") !== "Lider,Jumbo,Tottus", "control: ordenar por MONTO nombraría a Mercado Libre, La Polar y Jumbo", porMonto.join(","));
  ok(L === `los datos cambiaron desde la Entrega 1 · de lo ya entregado, con los datos actuales cambiaron: ${par("Lider")}, ${par("Jumbo")}, ${par("Tottus")}, y 3 cambios más; el detalle está disponible`, "★ la línea nombra Lider, Jumbo y Tottus —las tres de MAYOR PRIORIDAD (las filas 2, 3 y 5 de la Entrega original)— aunque Mercado Libre y La Polar cambiaron muchísimo más, y dice «y 3 cambios más»", L);
  ok(!L.includes("Mercado Libre") && !L.includes("La Polar") && !L.includes("Unimarc"), "★ CARNADA · un cambio de monto grande en una fila de BAJA prioridad (Mercado Libre, La Polar) NO desplaza a uno de ALTA prioridad");
  ok(ORDEN_CLIENTES.indexOf("Lider") < ORDEN_CLIENTES.indexOf("Jumbo") && ORDEN_CLIENTES.indexOf("Jumbo") < ORDEN_CLIENTES.indexOf("Tottus") && ORDEN_CLIENTES.indexOf("Tottus") < ORDEN_CLIENTES.indexOf("Mercado Libre"), "(y las tres nombradas son, en efecto, las más arriba en la tabla de esa Entrega)", ORDEN_CLIENTES.join(", "));
  ok(cambios.map((h) => h.sujeto).sort().join(",") === "Jumbo,La Polar,Lider,Mercado Libre,Tottus,Unimarc" && cambios.every((h) => h.revalidacion.anterior.valor && (h.estadoReverificacion === "ya_no_existe" || (h.revalidacion.actual.valor && h.revalidacion.diferencia.texto))), "★ el detalle tipado trae LOS SEIS (con las dos cifras y la diferencia de cada uno): disponible para quien lo pida");
  ok(lineaLimpia(L) && cuenta(L, "(antes ") === 3, "la línea es una, limpia, y nombra exactamente tres");
}
{
  // dos cambios de IGUAL prioridad (la primera fila de cada una de dos Entregas) y MISMA unidad (dinero): se desempatan por magnitud — y al revés
  const sB = crearAlmacenEnMemoria();
  const aB = crearAcciones({ continuidad: sB, ahora: reloj });
  const e1 = await aB.consultar({ tenant: T(TENANT_DEMO, 1), encargo: ventasDe("Lider", "Jumbo") });
  const cidB = e1.continuidad.conversacionId;
  await aB.consultar({ tenant: T(TENANT_DEMO, 1), encargo: { ...ventasDe("Tottus", "Paris"), conversacionId: cidB } });
  const retB = crearAcciones({ continuidad: sB, ahora: reloj }).retomar;
  const nombrados = (l) => (l.split("cambiaron: ")[1] || "").split(", y ")[0].split("), ").map((x) => x.split(" (antes")[0]);
  const caso = async (cambios) => { const r = await retB({ tenant: T(conVentas(TENANT_DEMO, cambios), 2), conversacionId: cidB }); return { r, nombrados: nombrados(r.lineaContinuidad) }; };
  const a = await caso({ Lider: 15200, Tottus: 5000, Jumbo: 1000, Paris: 5000 });
  ok(a.r.hechos.filter((h) => h.estadoReverificacion === "cambio").length === 4 && a.nombrados.join("|") === "venta de Tottus|venta de Lider|venta de Jumbo" && /, y 1 cambio más; el detalle/.test(a.r.lineaContinuidad), "★ CARNADA · Lider y Tottus (la 1ª fila de cada Entrega: MISMA prioridad, MISMA unidad): manda la magnitud — Tottus (−$1.4M) antes que Lider (−$378K); Jumbo y Paris (la 2ª fila de cada una, prioridad menor) van después aunque Jumbo cambió −$16M, y Paris queda como «y 1 cambio más»", `${a.nombrados.join("|")} / ${a.r.lineaContinuidad}`);
  const b = await caso({ Lider: 12000, Tottus: 6000, Jumbo: 1000, Paris: 5000 });
  ok(b.nombrados.join("|") === "venta de Lider|venta de Tottus|venta de Jumbo", "y al revés: si Lider cambia más que Tottus, va primero Lider (la magnitud desempata, no el nombre ni el orden de las Entregas)", b.nombrados.join("|"));
}

/* ═══ 6 · LAS CARNADAS DEL LIBRO: SIN CRUDO, SIN ENCARGO, ANTIGUO, OTRA EMPRESA, LA BASE CAÍDA ═══════════════════════════════════════════════════════ */
H("6 · carnadas del libro: sin valor exacto o sin encargo no hay veredicto; un libro de antes del bloque se declara; un libro de otra empresa se rechaza; la base caída falla cerrado");
{
  const base = clon(JSON.parse(antesDeTodo));
  const correr = async (libro, tenant = T(TENANT_DEMO, 2), id = "demo") => { const s = crearAlmacenEnMemoria(); await s.guardarLibro(id, libro); const a = crearAcciones({ continuidad: s, ahora: reloj }); const antes = jj(await s.leerLibro(id, libro.conversacionId)); const ret = await a.retomar({ tenant, conversacionId: libro.conversacionId }); return { ret, intacto: antes === jj(await s.leerLibro(id, libro.conversacionId)) }; };

  // a · sin ENCARGO: no se puede volver a preguntar
  const sinEncargo = clon(base); for (const e of sinEncargo.entregas) delete e.encargo;
  const rA = await correr(sinEncargo);
  ok(rA.ret.ok && rA.ret.resumen.igual === 0 && rA.ret.resumen.cambio === 0 && rA.ret.resumen.sin_reverificar === 26 && rA.ret.resumen.no_se_revalida === 6, "★ CARNADA · un libro SIN el Encargo guardado: NINGÚN «igual» (ni «cambió»): las 26 cifras medidas quedan «sin revalidar»", jj(rA.ret.resumen));
  ok(rA.ret.hechos.filter((h) => h.estadoReverificacion === "sin_reverificar").every((h) => h.revalidacion.actual === undefined && /no se pudo volver a resolver/.test(h.revalidacion.motivo)) && rA.ret.advertencias.length === 1 && /26 cifras sin revalidar/.test(rA.ret.advertencias[0]), "con su motivo en palabras de negocio, sin valor de hoy, y UNA advertencia que dice cuántas y por qué", jj(rA.ret.advertencias));
  ok(rA.intacto, "el libro, intacto");

  // b · sin VALOR EXACTO: una cifra sin crudo no tiene veredicto
  const sinCrudo = clon(base); for (const e of sinCrudo.entregas) for (const h of e.hechos) { h.rv.raw = null; if (h.rv.mas) for (const m of h.rv.mas) m.raw = null; }
  const rB = await correr(sinCrudo);
  ok(rB.ret.resumen.igual === 0 && rB.ret.resumen.cambio === 0 && rB.ret.resumen.sin_reverificar === 26 && rB.ret.hechos.filter((h) => h.estadoReverificacion === "sin_reverificar").every((h) => h.revalidacion.motivo === "se entregó sin valor exacto"), "★ CARNADA · un libro SIN el valor exacto de las cifras: ningún «igual», cada una «se entregó sin valor exacto»", jj(rB.ret.resumen));

  // c · ANTERIOR a este bloque (como lo guardaba el corte 9: sin `rv`, sin `revalidable`, sin `empresaId`): se declara, no se migra
  const antiguo = clon(base); delete antiguo.empresaId; for (const e of antiguo.entregas) { delete e.revalidable; delete e.encargo; delete e.referencias; delete e.moneda; for (const h of e.hechos) delete h.rv; }
  const rC = await correr(antiguo);
  ok(rC.ret.ok && rC.ret.resumen.igual === 0 && rC.ret.resumen.cambio === 0 && rC.ret.resumen.ya_no_existe === 0, "un libro guardado ANTES del bloque: ninguna cifra sale «igual» ni «cambió»");
  ok(rC.ret.hechos.length === 28 && rC.ret.hechos.every((h) => h.estadoReverificacion === "sin_reverificar" && h.revalidacion.motivo === "esta Entrega se guardó antes de que ADI conservara el valor exacto y la pregunta"), "★ todas «sin revalidar» con el motivo «esta Entrega se guardó antes de que ADI conservara el valor exacto y la pregunta» (27 filas más el total del listado de E2: no hay filas anchas abiertas)", jj(rC.ret.resumen));
  ok(rC.ret.lineaContinuidad === "los datos cambiaron desde la Entrega 4" && rC.intacto, "el cambio de datos SÍ se declara (es del libro, no de la revalidación) y el libro viejo no se migra: queda como estaba");
  ok(rC.ret.hechos.every((h) => h.revalidacion.actual === undefined), "★ jamás un «actual» donde no se revalidó");

  // d · OTRA EMPRESA: el libro dice de quién es
  const ajeno = clon(base); ajeno.empresaId = "otra-empresa";
  const rD = await correr(ajeno);
  ok(rD.ret.ok === false && rD.ret.motivo === "esta conversación es de otra empresa" && rD.ret.hechos === undefined && rD.intacto, "★ CARNADA · un libro de OTRA empresa (aunque el almacén lo entregue) se RECHAZA con su motivo y no revela nada de él", jj(rD.ret));
  const rD2 = await retomarSinTocar(T(TENANT_DEMO, 2, "otra-empresa"), cid2);
  ok(rD2.ret.ok === false && /no existe una conversación/.test(rD2.ret.motivo) && rD2.intacto, "y otra empresa que presenta el id de esta conversación no la encuentra (el aislamiento del almacén sigue de pie)", jj(rD2.ret));

  // e · la BASE caída: falla cerrado
  const caida = { ...store2, leerHechosEmpresa: async () => { throw new ErrorDeAlmacen("leerHechosEmpresa", "la base no respondió"); } };
  const rE = await crearAcciones({ continuidad: caida, ahora: reloj }).retomar({ tenant: T(TENANT_DEMO, 2), conversacionId: cid2 });
  ok(rE.ok === false && rE.memoria === "no_disponible" && !jj(rE).includes("la base no respondió"), "con la base caída: «memoria no disponible», sin revalidar contra «lo que haya» y sin el mensaje de la base", jj(rE));
  const rF = await retomarHilo({ tenant: T(TENANT_DEMO, 2), conversacionId: "no-existe" });
  ok(rF.ok === false && /no existe una conversación/.test(rF.motivo), "una conversación que no existe se declara (no se inventa un estado vacío)");

  // f · UNA Entrega recortada por tamaño no se revalida y se dice
  const recortada = clon(base); recortada.entregas[0] = { n: 1, turno: 1, versionId: 1, temas: ["comercial"], recortada: true };
  const rG = await correr(recortada);
  ok(rG.ret.hechos.every((h) => !h.id.startsWith("E1.")) && rG.ret.advertencias.some((a) => /E1 se recortó por tamaño/.test(a)), "una Entrega recortada por el tope del libro no tiene hechos que revalidar y se declara en las advertencias");

  // g · UNA Entrega que el Core ya no puede resolver (la cuenta salió de los datos) → sin_reverificar, JAMÁS ya_no_existe
  const sH = crearAlmacenEnMemoria();
  const aH = crearAcciones({ continuidad: sH, ahora: reloj });
  const h1 = await aH.consultar({ tenant: T(TENANT_DEMO, 1), encargo: ventasDe("Lider", "Unimarc") });
  const cidH = h1.continuidad.conversacionId;
  const retH = await crearAcciones({ continuidad: sH, ahora: reloj }).retomar({ tenant: T(sinCliente(TENANT_DEMO, "Unimarc"), 2), conversacionId: cidH });
  const hU = retH.hechos.find((h) => h.sujeto === "Unimarc"), hL = retH.hechos.find((h) => h.sujeto === "Lider");
  ok(hU.estadoReverificacion === "sin_reverificar" && hU.revalidacion.motivo === "la consulta ya no se pudo responder completa con los datos actuales" && hU.revalidacion.noResuelto.some((n) => n.motivo === "entidad_inexistente") && hL.estadoReverificacion === "igual", "★ una cuenta NOMBRADA en la pregunta que ya no existe: la consulta no resolvió completa, así que «sin revalidar» con el porqué (JAMÁS «ya no existe»); la que sí está, igual", jj(hU.revalidacion));
}

/* ═══ 7 · LAS CARNADAS DE LA AUDITORÍA: UN VEREDICTO MAL PUESTO TIENE QUE PONERLA EN ROJO ═══════════════════════════════════════════════════════════════ */
H("7 · carnadas de la auditoría y de la línea: un «igual» que imprime distinto, un «actual» donde no se revalidó, una línea con «usted» o con una carga");
{
  const { ret } = await retomarSinTocar(T(DS2, 2));
  const sano = auditar(ret, HOY2.base);
  ok(sano.length === 0, "control: el resultado sano pasa la auditoría");
  const manipular = (fn) => { const c = clon(ret); fn(c); return auditar(c, HOY2.base); };
  const c1 = manipular((c) => { const h = c.hechos.find((x) => x.id === "E2.h2"); h.estadoReverificacion = "igual"; h.revalidacion = { estado: "igual", anterior: h.revalidacion.anterior }; c.resumen.cambio--; c.resumen.igual++; });
  ok(c1.some((p) => /«igual» cuyos crudos no imprimen lo mismo/.test(p)), "★ CARNADA · un «cambio» disfrazado de «igual» (los crudos imprimen $17.8M contra $16.1M): la auditoría lo marca", c1.join(" · "));
  const c2 = manipular((c) => { const h = c.hechos.find((x) => x.estadoReverificacion === "no_se_revalida") || c.hechos[0]; h.estadoReverificacion = "no_se_revalida"; h.revalidacion.estado = "no_se_revalida"; h.revalidacion.actual = { valor: "$1M", raw: 1e6, unidad: "money" }; });
  ok(c2.some((p) => /«actual» dentro de no_se_revalida/.test(p)), "★ CARNADA · un «actual» dentro de un «no se revalida»: la auditoría lo marca", c2.join(" · "));
  const c3 = manipular((c) => { const h = c.hechos.find((x) => x.id === "E2.h13") || c.hechos[0]; h.estadoReverificacion = "sin_reverificar"; h.revalidacion = { estado: "sin_reverificar", motivo: "no se pudo volver a resolver", anterior: h.revalidacion.anterior, actual: { valor: "$2.3M", raw: 2311000, unidad: "money" } }; c.resumen.ya_no_existe--; c.resumen.sin_reverificar++; });
  ok(c3.some((p) => /«actual» dentro de sin_reverificar/.test(p)), "★ CARNADA · un «actual» dentro de un «sin revalidar»: la auditoría lo marca", c3.join(" · "));
  const c4 = manipular((c) => { const h = c.hechos.find((x) => x.estadoReverificacion === "no_comparable") || c.hechos.find((x) => x.id === "E3.h2"); h.revalidacion = { ...h.revalidacion, estado: "no_comparable", motivo: "otro_periodo", diferencia: { valor: 1, texto: "$1", sentido: "sube" } }; });
  ok(c4.some((p) => /diferencia dentro de/.test(p)), "★ CARNADA · una diferencia dentro de un «no comparable»: la auditoría lo marca", c4.join(" · "));
  const c5 = manipular((c) => { c.resumen.igual += 1; });
  ok(c5.some((p) => /resumen/.test(p)), "★ CARNADA · un resumen que no cuadra con los hechos: la auditoría lo marca");
  const lineas = ["Usted tiene cambios", "yo veo que cambió la venta", "te aviso que cambió", "los datos cambiaron desde la Entrega 1: 1 → 2", "cambiaron los datos de la versión 3", "con la carga v3 cambió", "los datos cambiaron\ny además esto"];
  ok(lineas.every((l) => !lineaLimpia(l)) && lineaLimpia(ret.lineaContinuidad) && lineaLimpia(null), "★ CARNADA · una línea con «usted», «yo», «te», una flecha de carga, una versión o dos renglones la marca el control; la línea real y la ausencia de línea pasan");
  const sinLimite = { ...ret, advertencias: ["este corte no re-verifica los hechos contra la versión de datos activa"] };
  ok(/re-verifica/.test(jj(sinLimite)) && !/re-verifica/.test(jj(ret)), "★ CARNADA · el límite declarado de antes («no re-verifica») aparecería si el código volviera a ese estado: el control lo ve y la respuesta real no lo trae");
}

/* ═══ 8 · LAS REGLAS PURAS: LOS SEIS ESTADOS Y LA SELECCIÓN DE LO QUE LA LÍNEA NOMBRA ═══════════════════════════════════════════════════════════════════ */
H("8 · revalidarEntrega (los estados y sus reglas duras) y elegirCambiosANombrar (prioridad primero, magnitud solo desempata) — puras");
{
  const hecho = (id, sujeto, raw, unidad = "money", { clave = "ventas", procedencia = "medido", titular = "medido", deSupuesto = false, prioridad = 0 } = {}) => ({ id, sujeto, metrica: "Venta", valor: formatoDeLaCasa(raw, unidad), rv: { raw, unidad, clave, dueno: sujeto, procedencia, titular, tipo: "ref", prioridad, ...(deSupuesto ? { deSupuesto: true } : {}) } });
  const Hh = (id, sujeto, raw, unidad = "money", { clave = "ventas", procedencia = "medido" } = {}) => ({ id, ok: true, tipo: "ref", claves: new Set([clave]), roles: { sujetos: [sujeto] }, numeros: [{ raw, unidad }], origen: { titular: "medido" }, procedencia });
  const libroDe = (...hs) => ({ hechos: hs });
  const entrega = (hechos, extra = {}) => ({ n: 1, versionId: 1, periodo: { texto: "año cerrado", rango: null }, moneda: "$", referencias: { criterios: [], marco: "ref A" }, universos: [], revalidable: true, hechos, ...extra });
  const ctx = (libro, extra = {}) => ({ libroActual: libro, marcoActual: { periodo: { texto: "año cerrado", rango: null }, moneda: "$" }, referenciasActuales: { criterios: [], marco: "ref A" }, versionIdActual: 2, parteResuelta: true, renderDe: () => null, ...extra });
  const estadoDe = (e, c, id) => revalidarEntrega(e, c).hechos.get(id);
  const un = hecho("E1.h1", "Lider", 17843000);

  ok(estadoDe(entrega([un]), ctx(libroDe(Hh("a", "Lider", 17843000))), "E1.h1").estado === "igual" && estadoDe(entrega([un]), ctx(libroDe(Hh("a", "Lider", 17844000))), "E1.h1").estado === "igual", "igual: el mismo valor, o uno distinto que se imprime igual ($17.8M)");
  const cam = estadoDe(entrega([un]), ctx(libroDe(Hh("a", "Lider", 16086000))), "E1.h1");
  ok(cam.estado === "cambio" && cam.diferencia.valor === -1757000 && cam.diferencia.sentido === "baja" && cam.actual.raw === 16086000 && cam.cargaAnterior === 1 && cam.cargaActual === 2, "cambio: con anterior, actual, diferencia calculada y las dos cargas", jj(cam));
  const pct = estadoDe(entrega([hecho("E1.h1", "Lider", 21.5, "pct", { clave: "margen" })]), ctx(libroDe(Hh("a", "Lider", 19, "pct", { clave: "margen" }))), "E1.h1");
  ok(pct.estado === "cambio" && pct.diferencia.texto === "2.5 pp" && pct.diferencia.sentido === "baja", "la diferencia de un porcentaje se dice en puntos (no «2.5%»)", jj(pct.diferencia));
  const noEsta = estadoDe(entrega([un]), ctx(libroDe(Hh("a", "Jumbo", 1))), "E1.h1");
  ok(noEsta.estado === "ya_no_existe" && noEsta.actual === undefined, "ya_no_existe: la consulta resolvió completa hoy y la cifra no aparece");
  const incompleta = estadoDe(entrega([un]), ctx(libroDe(Hh("a", "Jumbo", 1)), { parteResuelta: false, noResuelto: [{ campo: "entidad", motivo: "entidad_inexistente", valor: "Lider" }] }), "E1.h1");
  ok(incompleta.estado === "sin_reverificar" && incompleta.actual === undefined && incompleta.noResuelto[0].valor === "Lider", "★ ya_no_existe JAMÁS si la consulta no se pudo resolver completa: sin_reverificar, con el porqué");
  const conCorte = entrega([un], { universos: [{ id: "u", eje: "cliente", top: { metrica: "no_capturada", k: 3, direccion: "mayor" }, entidades: ["Lider", "Jumbo"] }] });
  const corte = estadoDe(conCorte, ctx(libroDe(Hh("a", "Jumbo", 1))), "E1.h1");
  ok(corte.estado === "no_comparable" && corte.motivo === "otro_universo" && corte.actual === undefined && corte.diferencia === undefined, "otro_universo: una cuenta que un ranking CON CORTE seleccionaba y ya no figura no prueba que haya salido de los datos (no es «ya no existe»)", jj(corte));
  const otraMoneda = estadoDe(entrega([un]), ctx(libroDe(Hh("a", "Lider", 17843000)), { marcoActual: { periodo: { texto: "año cerrado", rango: null }, moneda: "US$" } }), "E1.h1");
  ok(otraMoneda.estado === "no_comparable" && otraMoneda.motivo === "otra_moneda" && otraMoneda.actual && otraMoneda.diferencia === undefined, "otra_moneda: no se resta dinero de monedas distintas");
  const otraUnidad = estadoDe(entrega([un]), ctx(libroDe(Hh("a", "Lider", 12, "ratio"))), "E1.h1");
  ok(otraUnidad.estado === "no_comparable" && otraUnidad.motivo === "otra_unidad" && otraUnidad.diferencia === undefined, "otra_unidad: la misma cifra hoy en otra unidad no se compara (jamás se convierte)");
  const otroPeriodo = estadoDe(entrega([un]), ctx(libroDe(Hh("a", "Lider", 1)), { marcoActual: { periodo: { texto: "año cerrado", rango: "2027" }, moneda: "$" } }), "E1.h1");
  ok(otroPeriodo.estado === "no_comparable" && otroPeriodo.motivo === "otro_periodo" && otroPeriodo.periodoActual === "año cerrado" && otroPeriodo.diferencia === undefined, "otro_periodo: nunca «cambió» entre períodos distintos");
  const brecha = hecho("E1.h1", "Lider", 1500000, "money", { clave: "no_capturada", procedencia: "estimacion_referencia" });
  const otraRef = estadoDe(entrega([brecha]), ctx(libroDe(Hh("a", "Lider", 1200000, "money", { clave: "no_capturada", procedencia: "estimacion_referencia" })), { referenciasActuales: { criterios: [{ llave: "benchmark", valor: 28, origen: "declarado" }], marco: "ref B" } }), "E1.h1");
  const medidoOtraRef = estadoDe(entrega([un]), ctx(libroDe(Hh("a", "Lider", 17843000)), { referenciasActuales: { criterios: [], marco: "ref B" } }), "E1.h1");
  ok(otraRef.estado === "no_comparable" && otraRef.motivo === "otra_referencia" && medidoOtraRef.estado === "igual", "otra_referencia: solo para lo ESTIMADO contra una referencia; lo medido no depende de ella");
  const ambigua = estadoDe(entrega([un]), ctx(libroDe(Hh("a", "Lider", 17843000), Hh("b", "Lider", 1))), "E1.h1");
  ok(ambigua.estado === "sin_reverificar" && ambigua.actual === undefined, "la misma cifra dos veces con valores distintos hoy: sin_reverificar, no se elige una");
  for (const [nombre, h] of [["un supuesto", hecho("E1.h1", "Lider", 17843000, "money", { procedencia: "supuesto_usuario" })], ["lo derivado de un supuesto", hecho("E1.h1", "Lider", 17843000, "money", { procedencia: "derivado", deSupuesto: true })], ["un declarado", hecho("E1.h1", "Lider", 17843000, "money", { titular: "declarado" })], ["un documento", hecho("E1.h1", "Lider", 17843000, "money", { titular: "documento" })]]) {
    const r = estadoDe(entrega([h]), ctx(libroDe(Hh("a", "Lider", 17843000))), "E1.h1");
    ok(r.estado === "no_se_revalida" && r.actual === undefined && typeof r.motivo === "string", `no_se_revalida: ${nombre} (aunque hoy haya una cifra con la misma llave: no se contrasta con los datos)`);
  }
  const sinRv = estadoDe(entrega([{ id: "E1.h1", sujeto: "Lider", metrica: "Venta", valor: "$17.8M" }]), ctx(libroDe(Hh("a", "Lider", 17843000))), "E1.h1");
  ok(sinRv.estado === "sin_reverificar" && sinRv.actual === undefined, "★ sin valor exacto no hay veredicto (aunque hoy exista la cifra)");
  const noRevalidable = estadoDe(entrega([un], { revalidable: false }), ctx(libroDe(Hh("a", "Lider", 17843000))), "E1.h1");
  ok(noRevalidable.estado === "sin_reverificar" && /antes de que ADI conservara/.test(noRevalidable.motivo), "una Entrega anterior al bloque: sin_reverificar, nunca igual");
  const sinCorrida = revalidarEntrega(entrega([un]), { versionIdActual: 2, renderDe: () => null }).hechos.get("E1.h1");
  ok(sinCorrida.estado === "sin_reverificar" && sinCorrida.actual === undefined, "sin una re-corrida de hoy no hay veredicto");

  // — la selección de lo que la línea nombra —
  const c = (id, prioridad, unidad, magnitud, orden, extra = {}) => ({ id, prioridad, unidad, magnitud, orden, ...extra });
  const ids = (x) => x.ordenados.map((y) => y.id).join(",");
  ok(ids(elegirCambiosANombrar([c("grande-abajo", 9, "money", 9e9, 0), c("chico-arriba", 0, "money", 1, 1)])) === "chico-arriba,grande-abajo", "★ la PRIORIDAD manda: un cambio chico en la fila de arriba va antes que uno enorme en una fila de abajo");
  ok(ids(elegirCambiosANombrar([c("a", 0, "money", 10, 0), c("b", 0, "money", 99, 1)])) === "b,a" && ids(elegirCambiosANombrar([c("a", 0, "money", 99, 0), c("b", 0, "money", 10, 1)])) === "a,b", "★ misma prioridad y misma unidad: manda la magnitud (en los dos sentidos)");
  ok(ids(elegirCambiosANombrar([c("pct", 0, "pct", 50, 0), c("dinero", 0, "money", 9e9, 1)])) === "pct,dinero" && ids(elegirCambiosANombrar([c("dinero", 0, "money", 9e9, 0), c("pct", 0, "pct", 50, 1)])) === "dinero,pct", "★ NUNCA se compara entre unidades distintas: dinero contra porcentaje no se desempata por magnitud, manda el orden de aparición");
  ok(ids(elegirCambiosANombrar([c("a", 0, "money", 5, 0), c("b", 0, "money", 5, 1), c("z", 0, "money", 5, 2)])) === "a,b,z", "empate total: el orden de aparición");
  ok(ids(elegirCambiosANombrar([c("a", null, "money", 10, 2), c("b", null, "money", 10, 0), c("c", null, "money", 10, 1)])) === "b,c,a", "sin prioridad declarada rige el orden de aparición en la tabla (el fallback de `tamano.js`)");
  ok(ids(elegirCambiosANombrar([c("quitada", 0, "money", null, 0), c("cambio", 0, "money", 50, 1)])) === "cambio,quitada", "un ya_no_existe no tiene magnitud: no gana un desempate por magnitud, va tras los que sí la tienen de su misma prioridad y unidad");
  const A = c("A", 0, "pct", 1, 1), B = c("B", 0, "money", 5, 2), C = c("C", 0, "pct", 9, 3);
  const perms = [[A, B, C], [A, C, B], [B, A, C], [B, C, A], [C, A, B], [C, B, A]].map((p) => ids(elegirCambiosANombrar(p)));
  ok(new Set(perms).size === 1, "★ el orden es TOTAL y determinístico: seis permutaciones de la misma entrada dan exactamente lo mismo (un comparador que mira unidades a medias, no)", perms.join(" | "));
  const seis = elegirCambiosANombrar([0, 1, 2, 3, 4, 5].map((k) => c(`x${k}`, k, "money", 100 - k, k)));
  ok(seis.nombrados.length === 3 && seis.adicionales === 3 && seis.ordenados.length === 6 && seis.nombrados.map((x) => x.id).join(",") === "x0,x1,x2", "hasta 3 nombrados, «y N más» con el resto, el detalle completo disponible");
  const repetida = elegirCambiosANombrar([c("a", 0, "money", 5, 0, { dedup: "venta de Lider|1|2" }), c("b", 1, "money", 5, 1, { dedup: "venta de Lider|1|2" }), c("c", 2, "money", 5, 2, { dedup: "otra" })]);
  ok(repetida.ordenados.map((x) => x.id).join(",") === "a,c" && repetida.adicionales === 0, "la misma cifra cambiada en dos Entregas se nombra UNA vez");
  ok(elegirCambiosANombrar([]).nombrados.length === 0 && elegirCambiosANombrar(null).adicionales === 0 && elegirCambiosANombrar([c("a", 0, "money", 1, 0)], { max: 0 }).adicionales === 1, "bordes: nada que nombrar, entrada vacía, max 0");
}

/* ═══ 9 · AUDITORÍAS DE CÓDIGO ═══════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════ */
H("9 · auditorías de código: retomar no escribe, ADI no reconoce frases, la cadena de la puerta sigue sin node:*");
{
  const acc = sinComentarios(fs.readFileSync("./src/adi/capacidad/acciones.js", "utf8"));
  const i0 = acc.indexOf("async function retomar("), i1 = acc.indexOf("return { conocerEmpresa, consultar, aportarContexto, retomar };");
  const cuerpo = acc.slice(i0, i1);
  ok(i0 > 0 && i1 > i0 && !/guardarLibro|registrarEntrega|guardarHechoEmpresa|actualizarHechoEmpresa/.test(cuerpo), "★ `retomar` no contiene ninguna escritura (ni al libro ni a la memoria): SOLO LEE");
  ok(/guardarLibro/.test(acc.slice(acc.indexOf("async function consultar(") , i0)) && /registrarEntrega\(/.test(acc), "control: `consultar` sí escribe el libro (el candado de arriba distingue)");
  ok(/conTenantActivo\(datasetDeHoy,/.test(cuerpo) && !/await/.test(cuerpo.slice(cuerpo.indexOf("conTenantActivo("), cuerpo.indexOf("// 3 · comparar"))), "la re-corrida entra al Core en UN solo tramo, con el dataset de hoy, y sin esperar nada adentro");
  ok(/_datasetDeLaEmpresa\(/.test(cuerpo) && /_datasetDeLaEmpresa\(/.test(acc.slice(acc.indexOf("async function consultar("), i0)), "★ `consultar` y `retomar` arman el dataset con la MISMA función (una sola verdad: si una cambia, la otra también)");
  const rev = sinComentarios(fs.readFileSync("./src/adi/continuidad/revalidar.js", "utf8")).replace(/`(?:\\[\s\S]|[^`\\])*`|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'/g, '""');
  const reconocedores = [...rev.matchAll(/(^|[=(,:?!&|;{\s])\/(?![/*])(?:\\.|\[[^\]]*\]|[^/\\\n])+\/[gimsuy]*/gm)].map((m) => m[0].trim()).concat(/new RegExp|\.match\(|\.matchAll\(|\.search\(|\.replace\(|preguntaOriginal/.test(rev) ? ["RegExp/match/replace"] : []);
  ok(reconocedores.length === 0, "★ la revalidación no lleva una sola regex ni `match`: ADI no reconoce frases — compara estructuras tipadas", jj(reconocedores));
  ok(!/node:/.test(["./src/adi/continuidad/revalidar.js", "./src/adi/continuidad/retomar.js", "./src/adi/continuidad/estadoVigente.js", "./src/adi/continuidad/libro.js"].map((p) => (fs.readFileSync(p, "utf8").match(/^\s*import\s[^;]*from\s*["'][^"']+["'];?/gm) || []).join("\n")).join("\n")), "la cadena de la puerta sigue sin `node:*` (corre en el borde)");
  ok(!/\bfetch\b|https?:\/\//.test(rev) && !/Math\.random|Date\.now|new Date/.test(rev), "revalidar.js es puro: sin red, sin reloj, sin azar");
  ok(LIBRO_TOPE_BYTES === 16384, "el tope del libro SIGUE en 16 KB: lo exige la base (migración 015: check pg_column_size(estado) <= 16384), y subirlo pide una migración nueva, no un cambio de constante");
}

console.log(`\n── _retomar_revalida_gate: PASS ${pass} · FAIL ${fail} (de ${pass + fail}) ──`);
if (fail) { console.log("\nFALLOS:"); for (const f of fails) console.log("  ✗ " + f); }
process.exit(fail ? 1 : 0);
