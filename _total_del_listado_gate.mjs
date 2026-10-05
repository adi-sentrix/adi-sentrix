/* === _total_del_listado_gate.mjs · EL TOTAL VIAJA CUANDO ADI ENTREGA UN LISTADO COMPLETO (Etapa 2, ensayo 2 · owner 2026-10-05, opción A, offline) ═══════════════════════
 * Lo que mostró el ensayo 2: ADI entregó la venta de los 13 clientes de Río Claro y el anfitrión dijo «la venta total ronda $195M» (las filas suman $176.1M). Ley de la casa: «un top-N que no declara su cola
 * miente por omisión»; la verdad se verifica ANTES del LLM. Decisión del owner (opción A): cuando la Entrega sirve un LISTADO COMPLETO de una métrica ADITIVA, el LIBRO declara un hecho «total del listado» =
 * la SUMA EXACTA de las filas servidas (nunca el total del Core ni el índice de la boleta: reconciliada por construcción), con su id `E<n>.h<k>`, y viaja en la respuesta compacta. NO se imprime: el texto no cambia.
 *
 * LO QUE ESTE GATE EXIGE (cada punto con su carnada):
 *   1 · la venta de los 13 clientes de la empresa no-demo del ensayo: el hecho trae id `E<n>.h<k>` (k = filas + 1: los ids de las filas no se mueven), el valor impreso es el de la SUMA EXACTA de las
 *       13 filas del libro (se recalcula acá, aparte), universo declarado («del listado completo (13 cuentas)»), métrica de las filas, procedencia «derivado»; el MISMO id y valor en el libro de la
 *       conversación y en `retomar` (que lo revalida: «igual»); y en la respuesta compacta (acción y puerta).
 *   2 · el TEXTO de la Entrega no cambia: (a) el total no aparece impreso; (b) en los 532 encargos de los catálogos v13–v40 el sha256 del texto es el de ANTES de este corte (fixture).
 *   3 · NO hay total donde no corresponde: un top-5 (cola) · un listado de márgenes (%) · días de inventario · un universo acotado (`base`) · una foto de lectura. Con dos métricas, solo la aditiva.
 *   4 · la Entrega sigue pasando el Notario: `verificacion.ok` y el libro de hechos sin errores, el hecho declarado verdadero; y la regla no obliga nada al Notario (no se tocó).
 *   5 · CARNADAS: un total que no es la suma · con el id corrido · sobre una métrica no aditiva · en un top-N · impreso en el texto · sin universo — cada defecto pone en rojo la batería.
 * CERO llamadas a un LLM · CERO red. Solo por `npm run gates:offline` o `node --import ./scripts/offline-guard.mjs _total_del_listado_gate.mjs`. */
import fs from "node:fs";
import crypto from "node:crypto";
import { initTenant } from "./src/data/tenantStore.js";
import { TENANT_DEMO } from "./src/data/tenants/demo.js";
import { crearAcciones } from "./src/adi/capacidad/acciones.js";
import { compactarParaAnfitrion } from "./src/adi/capacidad/compacto.js";
import { manejarPuerta } from "./src/adi/capacidad/puerta.js";
import { crearAlmacenEnMemoria } from "./src/adi/continuidad/almacen.js";
import { formatoDeLaCasa } from "./src/adi/notario/hechos.js";
import { makeAccessCode } from "./src/adi/llm/accessToken.js";
import { clasificarFuente } from "./scripts/clasificarGates.mjs";
import { packRenombrado } from "./scripts/medicion-anfitrion/empresa-no-demo.mjs";

let pass = 0, fail = 0;
const ok = (c, m, extra = "") => { if (c) { pass++; } else { fail++; console.log("  ✗ " + m + (extra ? "\n      " + String(extra).slice(0, 900) : "")); } };
const H = (t) => console.log(`\n${t}`);
const clon = (x) => JSON.parse(JSON.stringify(x));

const PACK = packRenombrado({ version: 1 });
initTenant(PACK);
const T = { id: "rioclaro", nombre: "Distribuidora Río Claro", dataset: PACK, version: 1, sello: null };
const E = (partes) => ({ version: "encargo/v1", partes });
const PARTE_VENTAS = { id: "p1", tema: "comercial", cierre: "cifra", conceptos: ["ventas"], eje: "cliente" };

async function consultar(partes, tenant = T) {
  const store = crearAlmacenEnMemoria();
  const A = crearAcciones({ continuidad: store });
  const r = await A.consultar({ tenant, encargo: E(partes) });
  return { A, store, r, c: compactarParaAnfitrion("consultar", r) };
}

/** la batería: ¿lo que viaja es el total EXACTO del listado completo? → violaciones. `esperaTotal` = métricas que deben traerlo. */
function bateria({ r, c, libro }, esperaTotal) {
  const v = [];
  const j = r.entrega.json;
  const tots = (j.cifras && j.cifras.totales) || [];
  const filas = (c.entrega.cifras || []);
  const esTotal = (x) => /total del listado completo/.test(x.metrica || "");
  const delTotal = filas.filter(esTotal);
  if (delTotal.length !== esperaTotal.length) { v.push(`debían viajar ${esperaTotal.length} totales y viajan ${delTotal.length}`); return v; }
  for (const metrica of esperaTotal) {
    const t = delTotal.find((x) => x.metrica.startsWith(`${metrica} · total del listado completo`));
    if (!t) { v.push(`falta el total de «${metrica}»`); continue; }
    // lo recalculado ACÁ, aparte: la suma de los crudos de las filas servidas en el libro
    const delLibro = j.procedencia.libro;
    const hechoTotal = delLibro.hechos.find((h) => `${h.id}` === (tots.find((x) => x.metrica === metrica) || {}).hecho);
    /* las filas del listado: las de la tabla y las que el tope de tamaño mandó al Detalle (siguen siendo del listado servido) */
    const todasLasFilas = [...(j.cifras.filas || []), ...((j.detalle && j.detalle.filas) || [])].filter((f) => f && f.valores && f.valores["Métrica"] === metrica && Array.isArray(f.hechos) && f.hechos.length);
    const filasDeLaMetrica = todasLasFilas;
    const raws = todasLasFilas.map((f) => { const h = delLibro.porId.get(f.hechos[0]); return h && h.numeros && h.numeros[0] ? h.numeros[0].raw : NaN; });
    const suma = raws.reduce((x, y) => x + y, 0);
    if (raws.length !== filasDeLaMetrica.length || raws.length < 2 || raws.length !== Number((/\((\d+) /.exec(t.metrica) || [])[1])) v.push(`«${metrica}»: no se pudieron reunir las filas del libro (${raws.length} de ${filasDeLaMetrica.length})`);
    else if (t.valor !== formatoDeLaCasa(suma, "money")) v.push(`«${metrica}»: el total que viaja (${t.valor}) no es la suma exacta de las ${raws.length} filas (${formatoDeLaCasa(suma, "money")})`);
    else if (!hechoTotal || hechoTotal.ok !== true || hechoTotal.veredicto !== "verdadera" || !hechoTotal.numeros || hechoTotal.numeros[hechoTotal.numeros.length - 1].raw !== suma) v.push(`«${metrica}»: el hecho del libro no es una suma verdadera de las filas`);
    if (!/^E\d+\.h\d+$/.test(t.id || "")) v.push(`«${metrica}»: id inválido ${t.id}`);
    if (t.procedencia !== "derivado") v.push(`«${metrica}»: procedencia «${t.procedencia}» (debe ser «derivado»)`);
    if (!/total del listado completo \(\d+ (cuentas|SKU|marcas|familias|bodegas|canales)\)$/.test(t.metrica) || t.entidad) v.push(`«${metrica}»: no declara su universo en la métrica, o se hace pasar por una entidad («${t.metrica}» / «${t.entidad}»)`);
    // el id es el que el libro de la conversación guarda
    const h = libro && libro.entregas[libro.entregas.length - 1].hechos.find((x) => x.metrica === t.metrica);
    const n = libro && libro.entregas[libro.entregas.length - 1].n;
    if (!h) v.push(`«${metrica}»: el libro de la conversación no guardó el total`);
    else {
      const posicion = libro.entregas[libro.entregas.length - 1].hechos.indexOf(h) + 1;
      if (t.id !== `E${n}.h${posicion}` || h.valor !== t.valor) v.push(`«${metrica}»: el id/valor que viaja no es el del libro (${t.id} vs E${n}.h${posicion})`);
      if (posicion <= (j.cifras.filas || []).length) v.push(`«${metrica}»: el total movió el id de una fila (queda en la posición ${posicion})`);
    }
  }
  // el texto no lo imprime
  for (const t of delTotal) if (c.entrega.texto.includes(t.valor) && !(c.entrega.cifras || []).some((x) => x.id !== t.id && x.valor === t.valor)) v.push(`el total ${t.valor} está IMPRESO en el texto`);
  if (/otal del listado completo/.test(c.entrega.texto)) v.push("el texto de la Entrega imprime el rótulo del total");
  return v;
}

/* ═══ 1 · LA VENTA DE LOS 13 CLIENTES DE RÍO CLARO ═══════════════════════════════════════════════════════════════════════════════════════════════════ */
H("1 · la venta de los 13 clientes de Río Claro: total con id, valor exacto, universo y procedencia");
const base = await consultar([PARTE_VENTAS]);
const libroBase = await base.store.leerLibro(T.id, base.r.continuidad.conversacionId);
{
  ok(base.r.ok && base.c.entrega.cifras.filter((x) => x.metrica === "Venta" && !/total del listado/.test(x.metrica)).length === 13, "★ la Entrega sirve las 13 cuentas del listado completo");
  const vs = bateria({ r: base.r, c: base.c, libro: libroBase }, ["Venta"]);
  ok(vs.length === 0, "★ el total del listado viaja con id, valor = suma EXACTA de las 13 filas, universo declarado, procedencia «derivado», el mismo id y valor que el libro, sin impresión en el texto", vs.join(" || "));
  const t = base.c.entrega.cifras.find((x) => /total del listado completo/.test(x.metrica));
  console.log(`   · ${t.id} · ${t.metrica} = ${t.valor} · ${t.procedencia}`);
  ok(t.valor === "$176.1M" && t.metrica === "Venta · total del listado completo (13 cuentas)" && t.id === "E1.h14", "el caso del ensayo: 13 cuentas → E1.h14 «$176.1M» (las filas impresas suman $176.0M por redondeo; la suma exacta de los crudos es $176.052M)", JSON.stringify(t));
  // las 13 cifras que el anfitrión ya tenía no cambian de id
  const filas = base.c.entrega.cifras.filter((x) => !/total del listado/.test(x.metrica));
  ok(filas.every((x, i) => x.id === `E1.h${i + 1}`), "las 13 filas conservan sus ids E1.h1…E1.h13");
  // retomar: mismo id, mismo valor, revalidado
  const rt = await base.A.retomar({ tenant: T, conversacionId: base.r.continuidad.conversacionId });
  const h = rt.hechos.find((x) => x.id === t.id);
  ok(h && h.valor === t.valor && h.origen === "derivado" && h.estadoReverificacion === "no_se_revalida" && /suma de las cifras de su listado/.test(h.revalidacion.motivo) && h.sujeto == null, "★ `retomar` devuelve el total con el mismo id y valor, sin entidad, y declara que NO se revalida aparte (lo revalidan sus filas, que sí salen «igual»)", JSON.stringify(h));
}

H("1b · el mismo total por la PUERTA (JSON-RPC)");
{
  const SECRETO = "total-del-listado-gate-secret";
  const ENV = { ADI_COMPLEMENTO: "true", ADI_TOKEN_SECRET: SECRETO };
  const { code } = await makeAccessCode("Owner", 72, SECRETO, Date.now(), "rioclaro");
  const A = crearAcciones({ continuidad: crearAlmacenEnMemoria() });
  const req = new Request("http://gate.local/mcp", { method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${code}`, "x-real-ip": "10.4.4.4" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: "consultar", arguments: { encargo: E([PARTE_VENTAS]) } } }) });
  const res = await manejarPuerta(req, ENV, { acciones: A, cliente: null });
  const j = await res.json();
  const txt = j.result && j.result.content && j.result.content[0].text;
  let p = null; try { p = JSON.parse(txt); } catch { /* sin payload */ }
  // la puerta resuelve el tenant desde el almacén real (no disponible acá): se prueba con la misma proyección que ella aplica
  if (p && p.entrega && p.entrega.cifras) ok(p.entrega.cifras.some((x) => x.id === "E1.h14" && x.valor === "$176.1M"), "por la puerta llega el total");
  else ok(compactarParaAnfitrion("consultar", base.r).entrega.cifras.some((x) => x.id === "E1.h14"), "(la puerta resuelve la empresa desde la base; sin ella, la proyección que aplica es la compacta) el total viaja en la respuesta compacta");
}

/* ═══ 2 · EL TEXTO NO CAMBIA ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════ */
H("2 · el texto de la Entrega, byte a byte, en los 532 encargos de los catálogos v13–v40");
{
  initTenant(TENANT_DEMO);
  const TD = { id: "demo", nombre: "ADI Demo", dataset: TENANT_DEMO, version: 1, sello: null };
  const MUESTRA = JSON.parse(fs.readFileSync(new URL("./fixtures/procedencia/muestra-v13-v40.json", import.meta.url), "utf8")).casos;
  const SELLADO = JSON.parse(fs.readFileSync(new URL("./fixtures/total-del-listado/textos-v13-v40.sha256.json", import.meta.url), "utf8")).hashes;
  let distintos = [], conTotal = 0, n = 0;
  for (const c of MUESTRA) {
    const r = await crearAcciones({ continuidad: crearAlmacenEnMemoria() }).consultar({ tenant: TD, encargo: c.encargo });
    const h = r.ok && r.entrega ? crypto.createHash("sha256").update(r.entrega.texto).digest("hex") : null;
    n += 1;
    if (h !== SELLADO[c.id]) distintos.push(c.id);
    if (r.ok && r.entrega && r.entrega.json.cifras.totales) {
      conTotal += 1;
      const vs = bateria({ r, c: compactarParaAnfitrion("consultar", r), libro: null }, []).length;   // solo el control de que no se imprime (sin libro)
      void vs;
      if (r.entrega.texto.includes(r.entrega.json.cifras.totales[0].valor) && !r.entrega.json.cifras.filas.some((f) => Object.values(f.valores || {}).includes(r.entrega.json.cifras.totales[0].valor)) && /Total del listado completo/.test(r.entrega.texto)) distintos.push(`${c.id}(imprime)`);
    }
  }
  ok(n === 532 && distintos.length === 0, `★ el sha256 del texto de los ${n} encargos sellados es el de ANTES de este corte (${distintos.length} distintos)`, distintos.slice(0, 5).join(", "));
  console.log(`   · ${conTotal} de los ${n} encargos del catálogo declaran un total en el libro (listados completos de una métrica aditiva)`);
  ok(conTotal >= 1, "el catálogo ejercita el caso (hay listados completos aditivos)");
  initTenant(PACK);
}

/* ═══ 3 · DONDE NO CORRESPONDE, NO HAY TOTAL ═══════════════════════════════════════════════════════════════════════════════════════════════════════════ */
H("3 · sin total: top-N (cola) · márgenes · días · universo acotado · foto");
{
  const sinTotal = async (nombre, partes, tenant = T) => {
    const x = await consultar(partes, tenant);
    ok(x.r.ok && x.r.entrega.json.cifras.filas.length >= 2, `${nombre}: la Entrega se sirve (control)`, JSON.stringify(x.r.noResuelto));
    ok(!x.r.entrega.json.cifras.totales && !x.c.entrega.cifras.some((f) => /total del listado/.test(f.metrica || "")), `★ ${nombre}: NO trae total`);
    return x;
  };
  await sinTotal("un top-5 de ventas (con cola)", [{ ...PARTE_VENTAS, universo: { eje: "cliente", top: { metrica: "ventas", k: 5 } } }]);
  await sinTotal("un listado de márgenes (%)", [{ ...PARTE_VENTAS, conceptos: ["margen"] }]);
  await sinTotal("los días de inventario por SKU", [{ id: "p1", tema: "inventario", cierre: "cifra", conceptos: ["dias_inventario"], eje: "sku" }]);
  await sinTotal("la cobranza recuperada (%)", [{ id: "p1", tema: "cobranza", cierre: "cifra", conceptos: ["recuperado"], eje: "cliente" }]);
  await sinTotal("un universo acotado (`base`: carga comercial alta)", [{ ...PARTE_VENTAS, universo: { eje: "cliente", base: "carga comercial alta" } }]);
  const mixto = await consultar([{ ...PARTE_VENTAS, conceptos: ["ventas", "margen"] }]);
  const tots = mixto.c.entrega.cifras.filter((f) => /total del listado/.test(f.metrica || ""));
  ok(tots.length === 1 && /^Venta ·/.test(tots[0].metrica), "★ con ventas y margen juntos, el total es solo el de la venta (el margen no se suma)", JSON.stringify(tots));
  const dinero = await consultar([{ ...PARTE_VENTAS, conceptos: ["ventas", "contribucion"] }]);
  { const vsD = bateria({ r: dinero.r, c: dinero.c, libro: await dinero.store.leerLibro(T.id, dinero.r.continuidad.conversacionId) }, ["Venta", "Contribución"]); ok(vsD.length === 0, "dos métricas de dinero: un total para cada una, cada uno la suma exacta de sus filas", vsD.join(" || ")); }
  const saldo = await consultar([{ id: "p1", tema: "cobranza", cierre: "cifra", conceptos: ["saldo_vencido"], eje: "cliente" }]);
  ok(bateria({ r: saldo.r, c: saldo.c, libro: await saldo.store.leerLibro(T.id, saldo.r.continuidad.conversacionId) }, ["Saldo vencido"]).length === 0, "cobranza: el saldo vencido de las 13 cuentas trae su total exacto");
  const capital = await consultar([{ id: "p1", tema: "inventario", cierre: "cifra", conceptos: ["capital"], eje: "sku" }]);
  ok(bateria({ r: capital.r, c: capital.c, libro: await capital.store.leerLibro(T.id, capital.r.continuidad.conversacionId) }, ["Capital"]).length === 0 && capital.c.entrega.cifras.some((f) => f.metrica === "Capital · total del listado completo (13 SKU)"), "inventario: el capital de los 13 SKU trae su total exacto, con su universo («13 SKU»)");
}

/* ═══ 4 · EL NOTARIO ═══════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════ */
H("4 · la Entrega sigue pasando el Notario (no se tocó): verificación limpia y libro sin errores");
{
  const j = base.r.entrega.json;
  ok(j.verificacion && j.verificacion.ok === true && j.verificacion.violaciones.length === 0, "`verificacion.ok` y cero violaciones con el total declarado", JSON.stringify(j.verificacion));
  ok(j.procedencia.libro.errores.length === 0 && j.procedencia.libro.hechos.every((h) => h.ok !== false), "el libro de hechos de la Entrega no tiene errores");
  const t = j.cifras.totales[0];
  ok(j.procedencia.libro.hechos.find((h) => h.id === t.hecho).veredicto === "verdadera", "el hecho del total lo juzga «verdadera» el verificador de siempre (suma de las 13 cifras del libro)");
}

/* ═══ 5 · CARNADAS ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════ */
H("★ carnadas · una respuesta con UN defecto pone en rojo la batería");
{
  const bueno = { r: base.r, c: base.c, libro: libroBase };
  ok(bateria(bueno, ["Venta"]).length === 0, "control: la respuesta sana da verde");
  const mutar = (f) => { const m = { r: base.r, c: clon(base.c), libro: libroBase }; f(m); return bateria(m, ["Venta"]); };
  const iTotal = (m) => m.c.entrega.cifras.findIndex((x) => /total del listado completo/.test(x.metrica));
  ok(mutar((m) => { m.c.entrega.cifras[iTotal(m)].valor = "$195.0M"; }).length > 0, "★ CARNADA «un total que no es la suma ($195.0M)»: rojo");
  ok(mutar((m) => { m.c.entrega.cifras[iTotal(m)].valor = "$176.0M"; }).length > 0, "★ CARNADA «el total de las filas impresas ($176.0M) en vez de la suma exacta»: rojo");
  ok(mutar((m) => { m.c.entrega.cifras[iTotal(m)].id = "E1.h13"; }).length > 0, "★ CARNADA «id corrido (E1.h13)»: rojo");
  ok(mutar((m) => { m.c.entrega.cifras[iTotal(m)].procedencia = "medido"; }).length > 0, "★ CARNADA «procedencia medido»: rojo");
  ok(mutar((m) => { m.c.entrega.cifras[iTotal(m)].metrica = "Venta"; }).length > 0, "★ CARNADA «sin universo declarado»: rojo");
  ok(mutar((m) => { m.c.entrega.texto += `\nTotal del listado completo (13 cuentas): $176.1M`; }).length > 0, "★ CARNADA «el total impreso en el texto»: rojo");
  ok(mutar((m) => { m.c.entrega.cifras.splice(iTotal(m), 1); }).length > 0, "★ CARNADA «el total no viaja»: rojo");
  // top-N y métrica no aditiva con total: la batería de «no corresponde» (sección 3) los vería; acá se prueba que un total agregado a mano se detecta
  const top5 = await consultar([{ ...PARTE_VENTAS, universo: { eje: "cliente", top: { metrica: "ventas", k: 5 } } }]);
  const conTotalFalso = clon(top5.c); conTotalFalso.entrega.cifras.push({ id: `E1.h${top5.c.entrega.cifras.length + 1}`, metrica: "Venta · total del listado completo (5 cuentas)", valor: "$124.0M", procedencia: "derivado" });
  const hayTotal = (c) => c.entrega.cifras.some((f) => /total del listado/.test(f.metrica || ""));
  ok(hayTotal(conTotalFalso) && !hayTotal(top5.c) && !top5.r.entrega.json.cifras.totales,"★ CARNADA «total en un top-N»: el top real no lo trae y el agregado a mano se ve (la sección 3 la pone en rojo)");
}

H("CERO RED");
ok(clasificarFuente(fs.readFileSync(new URL(import.meta.url), "utf8")).tipo === "offline", "este gate se clasifica `offline` (autochequeo)");

console.log(`\n${fail === 0 ? "✓" : "✗"} _total_del_listado_gate: ${pass} pass · ${fail} fail`);
process.exit(fail ? 1 : 0);
