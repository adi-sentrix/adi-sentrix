/* === _retomar_paginado_gate.mjs · `retomar` EN PÁGINAS, CON LO IMPORTANTE PRIMERO (ensayo 12, owner 2026-10-09 · `_ADI_DISENO_ALCANCE_DE_LO_ENTREGADO.md` §4 · `_ADI_DISENO_CONTRATO_ANFITRION.md` §18) ═════════════
 * El caso rojo-primero es el REAL: ensayo 12 · hilo B01 · sesión 2 (Río Claro). El anfitrión retomó una conversación con 4 Entregas y 6 derivaciones, 213 hechos; `retomar` devolvió 235 KB con `hechos` ANTES de `resumen` y de
 * `lineaContinuidad`; el cliente guardó un archivo y el modelo vio 2 KB (de ahí «una cifra ya cambió» —eran 26 + 4 que ya no existen— y los H-leve de continuidad). La fixture `fixtures/alcance/b01-retomar-ensayo12.json` trae las
 * llamadas de la sesión 1 tal cual las emitió el anfitrión y lo que `retomar` devolvió ANTES del arreglo (235 002 B, 213 hechos). Aquí se repite el hilo contra el código de hoy y se exige:
 *   1 · ANTES (documentado): la respuesta pesaba > 100 KB y `hechos` iba antes de `resumen` — el caso reproduce el mismo libro (213 hechos, 26 cambios + 4 que ya no existen, 7 que no se revalidan).
 *   2 · AHORA, en los DOS brazos del experimento: orden fijo (memoria → [establecido] → estadoVigente → resumen → lineaContinuidad → … → cambios → entregas → hechos → pagina → uso); cada página ≤ 20 KB (la referencia de `consultar`);
 *       la página 1 trae resumen + TODOS los cambios (30) con la cifra de antes, la de ahora y la diferencia que ADI calculó; la unión de las páginas es EXACTAMENTE los 213 hechos de antes, en su orden, sin pérdida ni repetición
 *       (cada hecho idéntico al de hoy); la incompletitud se declara en dato (`pagina`, `memoria.estaRespuesta`, y en B `establecido.memoria`: «esta respuesta: página 1 de N, faltan M hechos»).
 *   3 · `pagina` y `desde` (el cursor por id) recorren lo mismo; fuera de rango y `desde` desconocido se rechazan con su razón; una conversación chica cabe en UNA página (completa: true); por la PUERTA (JSON-RPC y REST) también.
 *   4 · CARNADAS: un paginador con UN defecto (pierde un hecho, repite uno, desordena, se pasa de 20 KB, pone hechos antes de resumen, olvida un cambio, declara mal el total de páginas) pone en rojo la verificación.
 * CERO llamadas a un LLM · CERO red. Solo por `npm run gates:offline` o `node --import ./scripts/offline-guard.mjs _retomar_paginado_gate.mjs`. */
import fs from "node:fs";
import { initTenant } from "./src/data/tenantStore.js";
import { TENANT_DEMO } from "./src/data/tenants/demo.js";
import { crearAcciones } from "./src/adi/capacidad/acciones.js";
import { compactarParaAnfitrion, REFERENCIA_DE_TAMANO_BYTES } from "./src/adi/capacidad/compacto.js";
import { paginarRetomar, cambiosDe } from "./src/adi/capacidad/paginasDeRetomar.js";
import { manejarPuerta, MCP_TOOLS } from "./src/adi/capacidad/puerta.js";
import { crearAlmacenEnMemoria } from "./src/adi/continuidad/almacen.js";
import { makeAccessCode } from "./src/adi/llm/accessToken.js";
import { packRenombrado } from "./scripts/medicion-anfitrion/empresa-no-demo.mjs";
import { clasificarFuente } from "./scripts/clasificarGates.mjs";

let pass = 0, fail = 0;
const ok = (c, m, extra = "") => { if (c) { pass++; } else { fail++; console.log("  ✗ " + m + (extra ? "\n      " + String(extra).slice(0, 900) : "")); } };
const H = (t) => console.log(`\n${t}`);
const bytes = (o) => Buffer.byteLength(typeof o === "string" ? o : JSON.stringify(o));
const jj = (x) => JSON.stringify(x);
const clon = (x) => JSON.parse(JSON.stringify(x));
const sinNulos = (o) => { const r = {}; for (const [k, v] of Object.entries(o)) if (v !== null && v !== undefined) r[k] = v; return r; };

const FIX = JSON.parse(fs.readFileSync(new URL("./fixtures/alcance/b01-retomar-ensayo12.json", import.meta.url), "utf8"));
const T1 = { id: "rioclaro", nombre: "Distribuidora Río Claro", dataset: packRenombrado({ version: 1 }), version: 1, sello: null };
const T2 = { ...T1, dataset: packRenombrado({ version: 2 }), version: 2 };

/* repite la sesión 1 del hilo B01 y devuelve { A, cid } */
async function sesionDeB01() {
  const A = crearAcciones({ continuidad: crearAlmacenEnMemoria() });
  let cid = null;
  for (const l of FIX.sesion1) {
    const a = JSON.parse(l.args);
    if (l.herramienta === "consultar") { const e = a.encargo || a; if (cid) e.conversacionId = cid; else delete e.conversacionId; const r = await A.consultar({ tenant: T1, encargo: e }); cid = cid || r.continuidad.conversacionId; }
    else if (l.herramienta === "derivar") await A.derivar({ tenant: T1, ...a, conversacionId: cid });
    else if (l.herramienta === "aportarContexto") await A.aportarContexto({ tenant: T1, ...a, conversacionId: cid });
  }
  return { A, cid };
}

/* los hechos de HOY (antes del arreglo) tal como viajaban: el oráculo de «la unión de las páginas es lo de siempre» */
const hechoDeAntes = (h) => sinNulos({
  id: h.id, sujeto: h.sujeto, metrica: h.metrica, valor: h.valor, origen: h.origen, ...(Array.isArray(h.sobre) ? { sobre: h.sobre } : {}), ...(h.descripcion ? { descripcion: h.descripcion } : {}), ...(h.universo ? { universo: h.universo } : {}),
  estadoReverificacion: h.estadoReverificacion, ...(h.valorNuevo != null ? { valorNuevo: h.valorNuevo } : {}),
  revalidacion: (() => { const rv = h.revalidacion; if (!rv || typeof rv !== "object") return rv; const sinCrudo = (x) => { if (!x || typeof x !== "object") return x; const { raw, unidad, ...r } = x; return r; }; const o = { ...rv }; if (rv.anterior) o.anterior = sinCrudo(rv.anterior); if (rv.actual) o.actual = sinCrudo(rv.actual); if (rv.diferencia && typeof rv.diferencia === "object") { const { valor, ...r } = rv.diferencia; o.diferencia = r; } return o; })(),
});

/* LA VERIFICACIÓN: devuelve la lista de violaciones (vacía = las páginas son fieles). `paginas` = las respuestas compactas en orden; `completa` = lo que retomar calculó (todos los hechos); `brazoB` = ¿hay `establecido`? */
function verificar(paginas, completa, { brazoB }) {
  const v = [];
  const todos = completa.hechos.map(hechoDeAntes);
  const de = paginas.length;
  const ORDEN = ["ok", "conversacionId", "memoria", "establecido", "estadoVigente", "resumen", "lineaContinuidad", "cambios", "entregas", "hechos", "pagina", "uso"];
  paginas.forEach((p, i) => {
    const k = i + 1;
    if (bytes(p) > REFERENCIA_DE_TAMANO_BYTES) v.push(`la página ${k} pesa ${bytes(p)} B (> ${REFERENCIA_DE_TAMANO_BYTES})`);
    const ks = Object.keys(p).filter((x) => ORDEN.includes(x));
    const idx = ks.map((x) => ORDEN.indexOf(x));
    if (idx.some((x, j) => j > 0 && x < idx[j - 1])) v.push(`la página ${k} no respeta el orden fijo: ${ks.join(" → ")}`);
    if (!p.pagina || p.pagina.k !== k || p.pagina.de !== de) v.push(`la página ${k} declara mal su lugar: ${jj(p.pagina)}`);
    else if (p.pagina.completa !== (de === 1)) v.push(`la página ${k}: «completa» es ${p.pagina.completa} y hay ${de} páginas`);
    else if (k < de && p.pagina.siguiente !== k + 1) v.push(`la página ${k} no apunta a la siguiente: ${jj(p.pagina)}`);
    else if (k === de && p.pagina.siguiente !== undefined) v.push("la última página apunta a otra");
    const faltan = todos.length - (p.hechos || []).length;
    if (!p.memoria || typeof p.memoria.estaRespuesta !== "string" || (de > 1 && !new RegExp(`página ${k} de ${de}, faltan ${faltan} hechos?`).test(p.memoria.estaRespuesta)) || (de === 1 && p.memoria.estaRespuesta !== "completa")) v.push(`la página ${k}: memoria.estaRespuesta no dice «página ${k} de ${de}, faltan ${faltan}»: ${jj(p.memoria)}`);
    if (brazoB && (!p.establecido || !String(p.establecido.memoria).endsWith(de > 1 ? `esta respuesta: página ${k} de ${de}, faltan ${faltan} hechos` : "esta respuesta: completa"))) v.push(`la página ${k}: establecido.memoria no declara lo que falta: ${p.establecido && p.establecido.memoria}`);
    if (!brazoB && p.establecido) v.push(`la página ${k} trae establecido en el brazo A`);
  });
  const p1 = paginas[0];
  for (const c of ["resumen", "lineaContinuidad", "cambios", "entregas", "estadoVigente"]) if (p1 && !(c in p1)) v.push(`la página 1 no trae «${c}»`);
  for (const p of paginas.slice(1)) for (const c of ["resumen", "lineaContinuidad", "estadoVigente", "entregas"]) if (c in p) v.push(`una página posterior repite «${c}»`);
  /* la unión = lo de siempre, en su orden, sin repetir */
  const union = paginas.flatMap((p) => p.hechos || []);
  if (union.length !== todos.length) v.push(`la unión trae ${union.length} hechos y retomar tiene ${todos.length}`);
  else union.forEach((h, i) => { if (jj(h) !== jj(todos[i])) v.push(`el hecho ${i + 1} (${h && h.id}) no es el de siempre`); });
  if (new Set(union.map((h) => h.id)).size !== union.length) v.push("hay hechos repetidos entre páginas");
  /* los cambios: todos, en la página 1, con antes · ahora · diferencia */
  const esperados = completa.hechos.filter((h) => h.estadoReverificacion === "cambio" || h.estadoReverificacion === "ya_no_existe");
  const cs = (p1 && p1.cambios) || [];
  if (cs.length !== esperados.length) v.push(`la página 1 trae ${cs.length} cambios y hay ${esperados.length}`);
  else cs.forEach((c, i) => {
    const h = esperados[i];
    if (c.id !== h.id || c.estado !== h.estadoReverificacion) v.push(`el cambio ${i + 1} no es ${h.id}`);
    else if (c.antes !== h.revalidacion.anterior.valor || (h.estadoReverificacion === "cambio" && (c.ahora !== h.revalidacion.actual.valor || !c.diferencia || !c.diferencia.startsWith(h.revalidacion.diferencia.texto)))) v.push(`el cambio ${h.id}: antes/ahora/diferencia no son los de ADI: ${jj(c)}`);
  });
  return v;
}

/* trae TODAS las páginas por `pagina` */
async function paginasPor(A, T, cid) {
  const completa = await A.retomar({ tenant: T, conversacionId: cid });
  const p1 = compactarParaAnfitrion("retomar", completa);
  const de = p1.pagina ? p1.pagina.de : 0;
  const paginas = [p1];
  for (let k = 2; k <= de; k++) paginas.push(compactarParaAnfitrion("retomar", await A.retomar({ tenant: T, conversacionId: cid, pagina: k })));
  return { completa, paginas };
}

const PREVIO = process.env.ADI_ALCANCE_ESTRUCTURAL;
const restaurar = () => { if (PREVIO === undefined) delete process.env.ADI_ALCANCE_ESTRUCTURAL; else process.env.ADI_ALCANCE_ESTRUCTURAL = PREVIO; };

/* ═══ 1 · ANTES: el caso real ════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════ */
H("1 · ANTES · ensayo 12 · B01 sesión 2: 235 KB con `hechos` antes de `resumen` (el modelo vio 2 KB)");
{
  ok(FIX.antes.bytes > 200000 && FIX.antes.hechos === 213 && FIX.antes.ordenDeClaves.indexOf("hechos") < FIX.antes.ordenDeClaves.indexOf("resumen") && FIX.antes.ordenDeClaves.indexOf("hechos") < FIX.antes.ordenDeClaves.indexOf("lineaContinuidad"), `★ la fixture documenta el caso rojo: ${FIX.antes.bytes} B, ${FIX.antes.hechos} hechos, \`hechos\` antes de \`resumen\` y de \`lineaContinuidad\``);
  ok(FIX.antes.resumen.cambio === 26 && FIX.antes.resumen.ya_no_existe === 4 && FIX.antes.resumen.no_se_revalida === 7, "…con 26 cambios, 4 que ya no existen y 7 que no se revalidan: lo que el modelo no vio");
  const { A, cid } = await sesionDeB01();
  const completa = await A.retomar({ tenant: T2, conversacionId: cid });
  ok(completa.ok && completa.hechos.length === 213 && completa.resumen.cambio === 26 && completa.resumen.ya_no_existe === 4, "★ el hilo se reproduce contra el código de hoy: el mismo libro (213 hechos; 26 cambios; 4 ya no existen)", jj(completa.resumen));
  const todo = bytes(completa.hechos.map(hechoDeAntes));
  ok(todo > 150000, `y SIN paginar, los hechos solos pesarían ${Math.round(todo / 1024)} KB: el problema es real`, String(todo));
}

/* ═══ 2 · AHORA, en los dos brazos ═══════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════ */
const resultados = {};
for (const brazo of ["1", "0"]) {
  H(`2 · AHORA · brazo ${brazo === "1" ? "B (alcance estructural)" : "A (las entregas de hoy)"} · el hilo B01 pagina: lo importante primero, cada página ≤ 20 KB, la unión = lo de siempre`);
  process.env.ADI_ALCANCE_ESTRUCTURAL = brazo;
  const { A, cid } = await sesionDeB01();
  const { completa, paginas } = await paginasPor(A, T2, cid);
  resultados[brazo] = { A, cid, completa, paginas };
  const p1 = paginas[0];
  console.log(`   · ${paginas.length} páginas · tamaños: ${paginas.map((p) => (bytes(p) / 1024).toFixed(1)).join(" ")} KB · página 1: ${p1.hechos.length} hechos, ${p1.cambios.length} cambios`);
  ok(paginas.length > 1 && paginas.length < 40, `hay ${paginas.length} páginas (lossless: ningún hecho se acorta ni se omite)`);
  const viol = verificar(paginas, completa, { brazoB: brazo === "1" });
  ok(viol.length === 0, "★ cada página ≤ 20 KB, orden fijo, `pagina` y `memoria` honestas, la unión = los 213 hechos de siempre sin pérdida ni repetición, los 30 cambios completos en la página 1", viol.slice(0, 4).join(" || "));
  ok(p1.cambios.length === 30 && p1.cambios.filter((c) => c.estado === "ya_no_existe").length === 4 && p1.cambios.every((c) => c.estado === "ya_no_existe" || (c.ahora && c.diferencia)), "★ la página 1 dice lo que cambió: 26 cambios con la cifra de antes, la de ahora y la diferencia; 4 que ya no figuran");
  ok(p1.resumen && p1.resumen.total === 213 && /los datos cambiaron/.test(p1.lineaContinuidad), "la página 1 trae el resumen (213 hechos por estado) y la línea de continuidad ANTES de los hechos");
  ok(Object.keys(paginas[1]).filter((k) => ["ok", "conversacionId", "memoria", "establecido", "hechos", "pagina", "uso"].includes(k)).join(",") === (brazo === "1" ? "ok,conversacionId,memoria,establecido,hechos,pagina,uso" : "ok,conversacionId,memoria,hechos,pagina,uso") && paginas[1].uso && paginas[1].uso.length === p1.uso.length, "las páginas siguientes traen solo hechos (y la memoria, lo establecido, la página y las reglas de uso)");
  ok(p1.memoria.estaRespuesta === `página 1 de ${paginas.length}, faltan ${213 - p1.hechos.length} hechos` && (brazo === "0" || p1.establecido.memoria.endsWith(`esta respuesta: página 1 de ${paginas.length}, faltan ${213 - p1.hechos.length} hechos`)), "★ la incompletitud va en DATO: «esta respuesta: página 1 de N, faltan M hechos» (memoria, y en B también `establecido.memoria`)", jj(p1.memoria));
  ok(p1.uso.length === 4 && p1.uso.every((x) => typeof x === "string"), "la cabecera de `retomar` (cuatro reglas) no cambia");
}
restaurar();

/* ═══ 3 · pagina · desde · rechazos · conversación chica · la puerta ═══════════════════════════════════════════════════════════════════════════════════════════ */
H("3 · el cursor `desde`, los rechazos, una conversación chica en UNA página, y la puerta");
{
  const { A, cid, completa, paginas } = resultados["1"];
  const todos = completa.hechos.map(hechoDeAntes);
  /* desde: encadenar `siguiente.desde` recorre los 213 hechos exactamente una vez */
  let desde = "E2.h4", visto = [], pasos = 0;
  const primeroEnDesde = todos.findIndex((h) => h.id === "E2.h4");
  while (desde && pasos++ < 60) {
    const r = compactarParaAnfitrion("retomar", await A.retomar({ tenant: T2, conversacionId: cid, desde }));
    if (!r.ok) { ok(false, "desde falló", jj(r).slice(0, 200)); break; }
    if (bytes(r) > REFERENCIA_DE_TAMANO_BYTES) ok(false, `desde ${desde}: ${bytes(r)} B > 20 KB`);
    visto.push(...r.hechos);
    ok(r.pagina.desde === desde && !("cambios" in r) && !("resumen" in r), `desde ${desde}: solo hechos, desde ese id`);
    desde = r.pagina.siguiente && r.pagina.siguiente.desde;
  }
  ok(visto.length === todos.length - primeroEnDesde && visto.every((h, i) => jj(h) === jj(todos[primeroEnDesde + i])), "★ el cursor `desde` recorre del E2.h4 al último hecho una sola vez, en su orden, sin repetir", `${visto.length} vs ${todos.length - primeroEnDesde}`);
  const fuera = compactarParaAnfitrion("retomar", await A.retomar({ tenant: T2, conversacionId: cid, pagina: paginas.length + 1 }));
  ok(fuera.ok === false && fuera.motivo === "pagina_fuera_de_rango" && fuera.de === paginas.length && fuera.memoria && Array.isArray(fuera.uso), "★ una página fuera de rango se rechaza diciendo cuántas hay", jj(fuera).slice(0, 300));
  const cero = compactarParaAnfitrion("retomar", await A.retomar({ tenant: T2, conversacionId: cid, pagina: 0 }));
  ok(cero.ok === false && cero.motivo === "pagina_fuera_de_rango", "la página 0 también");
  const mal = compactarParaAnfitrion("retomar", await A.retomar({ tenant: T2, conversacionId: cid, desde: "E9.h99" }));
  ok(mal.ok === false && mal.motivo === "desde_desconocido" && mal.primero === "E1.h1", "★ un `desde` que no es un hecho de la conversación se rechaza, con el primero y el último que sí existen", jj(mal).slice(0, 300));
  /* una conversación chica: UNA página, completa */
  process.env.ADI_ALCANCE_ESTRUCTURAL = "1";
  initTenant(TENANT_DEMO);
  const TD = { id: "demo", nombre: "ADI Demo", dataset: TENANT_DEMO, version: 1, sello: null };
  const B = crearAcciones({ continuidad: crearAlmacenEnMemoria() });
  const c1 = await B.consultar({ tenant: TD, encargo: { version: "encargo/v1", partes: [{ id: "p1", tema: "comercial", cierre: "cifra", conceptos: ["ventas"], eje: "cliente", universo: { eje: "cliente", top: { metrica: "ventas", k: 3, direccion: "mayor" } } }] } });
  const chica = compactarParaAnfitrion("retomar", await B.retomar({ tenant: TD, conversacionId: c1.continuidad.conversacionId }));
  ok(chica.ok && chica.pagina.k === 1 && chica.pagina.de === 1 && chica.pagina.completa === true && chica.pagina.siguiente === undefined && chica.memoria.estaRespuesta === "completa" && Array.isArray(chica.cambios) && chica.cambios.length === 0 && chica.hechos.length >= 3, "★ una conversación chica cabe en UNA página: completa, sin siguiente, sin cambios", jj(chica.pagina));
  ok(/esta respuesta: completa$/.test(chica.establecido.memoria), "y `establecido.memoria` dice «esta respuesta: completa»");
  /* la puerta */
  const RUTA = "/api/" + "adi-capacidad";
  const SECRETO = "retomar-paginado-gate-secret";
  const ENV = { ADI_COMPLEMENTO: "true", ADI_TOKEN_SECRET: SECRETO };
  const { code } = await makeAccessCode("Owner", 72, SECRETO, Date.now(), "demo");
  const pedir = (path, body, n) => manejarPuerta(new Request(`http://gate.local${path}`, { method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${code}`, "x-real-ip": `10.9.8.${n}` }, body: JSON.stringify(body) }), ENV);
  const tool = MCP_TOOLS.find((t) => t.name === "retomar");
  ok(tool.inputSchema.properties.pagina && tool.inputSchema.properties.desde && jj(tool.inputSchema.required) === jj(["conversacionId"]) && tool.inputSchema.additionalProperties === false, "★ la herramienta `retomar` acepta `pagina` y `desde` (opcionales); `conversacionId` sigue siendo lo único obligatorio");
  const rc = await (await pedir(`${RUTA}/consultar`, { encargo: { version: "encargo/v1", partes: [{ id: "p1", tema: "comercial", cierre: "cifra", conceptos: ["ventas", "margen"], eje: "cliente" }] } }, 1)).json();
  const conv = rc.continuidad.conversacionId;
  const rest = await (await pedir(`${RUTA}/retomar`, { conversacionId: conv }, 2)).json();
  ok(rest.ok === true && rest.pagina.k === 1 && rest.pagina.de === 1 && rest.pagina.completa === true && rest.hechos.length >= 26, "★ REST: `retomar` devuelve la página 1 de 1 con sus hechos", jj(rest).slice(0, 200));
  const rpc = await (await pedir("/mcp", { jsonrpc: "2.0", id: 9, method: "tools/call", params: { name: "retomar", arguments: { conversacionId: conv, pagina: 3 } } }, 3)).json();
  const cont = JSON.parse(rpc.result.content[0].text);
  ok(rpc.result.isError === true && cont.motivo === "pagina_fuera_de_rango" && cont.de === 1, "★ JSON-RPC: pedir la página 3 de una conversación de 1 página se rechaza con su razón", jj(cont).slice(0, 200));
  restaurar();
}

/* ═══ 4 · CARNADAS: un paginador con UN defecto pone en rojo la verificación ═══════════════════════════════════════════════════════════════════════════════════════ */
H("4 · carnadas · un paginador con un defecto se pone en rojo");
{
  const { completa, paginas } = resultados["1"];
  const base = verificar(paginas, completa, { brazoB: true });
  ok(base.length === 0, "control: la verificación da verde sobre las páginas reales (la sana no se acusa)");
  const MUTANTES = {
    "pierde un hecho de la página 2": (ps) => { ps[1].hechos.pop(); },
    "repite un hecho entre la página 2 y la 3": (ps) => { ps[2].hechos.unshift(ps[1].hechos[ps[1].hechos.length - 1]); },
    "desordena dos hechos": (ps) => { const h = ps[1].hechos; [h[0], h[1]] = [h[1], h[0]]; },
    "una página pasa de 20 KB": (ps) => { ps[3].hechos.push(...clon(ps[2].hechos), ...clon(ps[1].hechos)); },
    "pone `hechos` antes de `resumen`": (ps) => { const { hechos, ...r } = ps[0]; ps[0] = { ok: r.ok, conversacionId: r.conversacionId, memoria: r.memoria, establecido: r.establecido, hechos, estadoVigente: r.estadoVigente, resumen: r.resumen, lineaContinuidad: r.lineaContinuidad, cambios: r.cambios, entregas: r.entregas, pagina: r.pagina, uso: r.uso }; },
    "olvida un cambio": (ps) => { ps[0].cambios.pop(); },
    "cambia la cifra de ahora de un cambio": (ps) => { ps[0].cambios[0] = { ...ps[0].cambios[0], ahora: "$1.0M" }; },
    "declara mal el total de páginas": (ps) => { ps[1].pagina = { ...ps[1].pagina, de: ps.length + 1 }; },
    "no dice qué le falta a la memoria": (ps) => { ps[1].memoria = { ...ps[1].memoria, estaRespuesta: "completa" }; },
    "la página 2 repite el resumen": (ps) => { ps[1].resumen = ps[0].resumen; },
    "olvida `establecido.memoria`": (ps) => { ps[2].establecido = { ...ps[2].establecido, memoria: "íntegra · 4 Entregas · 207 cifras · esta respuesta: completa" }; },
    "marca completa una respuesta que no lo es": (ps) => { ps[0].pagina = { ...ps[0].pagina, completa: true }; },
  };
  for (const [nombre, mutar] of Object.entries(MUTANTES)) {
    const ps = clon(paginas);
    mutar(ps);
    const viol = verificar(ps, completa, { brazoB: true });
    ok(viol.length > 0, `★ CARNADA «${nombre}»: la verificación se pone roja`, viol.slice(0, 2).join(" | "));
  }
  /* y el paginador mismo con un límite chico produce páginas que respetan ese límite (la regla no es el 20 KB: es «cabe») */
  const hs = completa.hechos.slice(0, 40).map((h) => ({ id: h.id, sujeto: h.sujeto, metrica: h.metrica, valor: h.valor, estadoReverificacion: "igual" }));
  const out = paginarRetomar({ cabeza: { ok: true, conversacionId: "x", estadoVigente: { turno: 1 }, resumen: {}, lineaContinuidad: null, entregas: [], uso: ["u"] }, cambios: [], hechos: hs, limite: 1500 });
  ok(out.respuesta && bytes(out.respuesta) <= 1500 && out.de > 1 && out.respuesta.pagina.siguiente === 2, "el paginador respeta cualquier límite que se le dé", String(out.de));
  ok(cambiosDe([{ id: "E1.h1", sujeto: "X", metrica: "M", valor: "$1M", estadoReverificacion: "igual" }, { id: "E1.h2", sujeto: "Y", metrica: "M", valor: "$2M", estadoReverificacion: "ya_no_existe", revalidacion: { anterior: { valor: "$2M" } } }]).length === 1, "`cambiosDe` solo toma `cambio` y `ya_no_existe`");
}

H("5 · candado");
{
  const src = fs.readFileSync(new URL("./src/adi/capacidad/paginasDeRetomar.js", import.meta.url), "utf8");
  ok(!/node:|fetch\(|process\.env|openai|anthropic/i.test(src.replace(/\/\*[\s\S]*?\*\//g, "")), "`paginasDeRetomar.js` no usa `node:*`, ni red, ni entorno, ni un modelo (corre en edge)");
  ok(clasificarFuente(fs.readFileSync(new URL(import.meta.url), "utf8")).tipo === "offline", "este gate se clasifica `offline` (autochequeo)");
}

console.log(`\n── _retomar_paginado_gate: PASS ${pass} · FAIL ${fail} (de ${pass + fail}) ──`);
process.exit(fail ? 1 : 0);
