/* === _forma_del_encargo_gate.mjs · ADI NO CULPA A LA ENTIDAD POR UN PROBLEMA DE FORMA + EL TOTAL NO LO CALCULA EL ANFITRIÓN (Etapa 2, ensayo 2 · owner 2026-10-05, offline) ═══
 * Lo que mostró el ensayo 2 (clasificacion.md): cuando el anfitrión pasaba `entidades: ["Jumbo","Lider"]` o `criterio: "credito"` —cadenas sueltas, no `{nombre}` ni `{lente}`—, ADI contestaba
 * `entidad_inexistente` / `criterio_desconocido` para cuentas y lentes que EXISTEN, y el anfitrión le dijo al usuario «Hites no existe como cliente». Y dio «la venta total ronda $195M» sobre 13 cifras
 * entregadas que suman $176.0M.
 *
 * LO QUE ESTE GATE EXIGE (cada punto con su carnada):
 *   1 · LA FORMA ANTES DEL VALOR (`capacidad/formaDelEncargo.js`, ANTES de `validarEncargo`; `encargo/*` no se toca):
 *       a. una cadena suelta (o una lista de cadenas) en `entidades`, una cadena en `criterio` / `conceptos` / `supuestos` se lee con su única lectura; la consulta se responde CON SUS CIFRAS — el mismo texto que
 *          con la forma canónica, en la empresa no-demo del ensayo.
 *       b. una cuenta que de verdad no existe sigue siendo `entidad_inexistente`; una lente que no existe, `criterio_desconocido` (el valor se juzga como siempre).
 *       c. una forma ininterpretable (`{eje, valor}`, un número, `{nombre: 3}`, un criterio sin lente) se declara `formato_invalido` —campo, lo que llegó, la forma esperada— y NUNCA
 *          `entidad_inexistente` ni `criterio_desconocido`; no se corre con «lo que alcanzó a leerse».
 *       d. lo bien formado pasa IDÉNTICO (misma referencia) en TODOS los encargos de los catálogos sellados v13–v40 y de `fixtures/`: las Entregas no cambian.
 *   2 · EL TOTAL (lo que SÍ está en ADI): la cabecera de uso que viaja con cada `consultar` trae la regla «no calcule por su cuenta totales ni promedios de más de dos cifras…» (por la acción y por la puerta);
 *       y el texto de la Entrega no cambia. (El total del listado NO viaja como cifra con id: hoy no existe como hecho verificado del libro — ver el informe de este corte.)
 * CERO llamadas a un LLM · CERO red. Solo por `npm run gates:offline` o `node --import ./scripts/offline-guard.mjs _forma_del_encargo_gate.mjs`. */
import fs from "node:fs";
import { initTenant } from "./src/data/tenantStore.js";
import { TENANT_DEMO } from "./src/data/tenants/demo.js";
import { crearAcciones, CABECERA_DE_USO } from "./src/adi/capacidad/acciones.js";
import { manejarPuerta } from "./src/adi/capacidad/puerta.js";
import { normalizarFormaDelEncargo } from "./src/adi/capacidad/formaDelEncargo.js";
import { MOTIVOS } from "./src/adi/encargo/esquema.js";
import { crearAlmacenEnMemoria } from "./src/adi/continuidad/almacen.js";
import { makeAccessCode } from "./src/adi/llm/accessToken.js";
import { clasificarFuente } from "./scripts/clasificarGates.mjs";
import { packRenombrado } from "./scripts/medicion-anfitrion/empresa-no-demo.mjs";

let pass = 0, fail = 0;
const ok = (c, m, extra = "") => { if (c) { pass++; } else { fail++; console.log("  ✗ " + m + (extra ? "\n      " + String(extra).slice(0, 900) : "")); } };
const H = (t) => console.log(`\n${t}`);
const clon = (x) => JSON.parse(JSON.stringify(x));
const mismo = (a, b) => JSON.stringify(a) === JSON.stringify(b);

/* ═══ 1 · LA EMPRESA NO-DEMO DEL ENSAYO (Distribuidora Río Claro) y los casos reales de B02 / C01 / C02 / A02 ═════════════════════════════════════════════ */
const PACK = packRenombrado({ version: 1 });
initTenant(PACK);
const T = { id: "rioclaro", nombre: "Distribuidora Río Claro", dataset: PACK, version: 1, sello: null };
const CLIENTES = PACK.clientesVentas.map((c) => c.nombre);
const MARCAS = [...new Set((PACK.skusMargen || []).map((s) => s.marca).filter(Boolean))];
const E = (partes, extra = {}) => ({ version: "encargo/v1", partes, ...extra });
const consultar = async (encargo) => crearAcciones({ continuidad: crearAlmacenEnMemoria() }).consultar({ tenant: T, encargo });
const motivos = (r) => (r.noResuelto || []).map((n) => n.motivo);

/** la batería sobre un normalizador: devuelve las violaciones (vacía = cumple). Se corre sobre el real y sobre MUTANTES. */
function bateria(norm) {
  const v = [];
  const bien = E([{ id: "p1", tema: "comercial", cierre: "cifra", conceptos: ["ventas"], eje: "cliente", entidades: [{ nombre: CLIENTES[0] }, { nombre: CLIENTES[1] }] }], { criterio: { lente: "credito" } });
  const rb = norm(bien);
  if (rb.encargo !== bien || rb.formato.length || rb.avisos.length) v.push("lo bien formado no pasa idéntico");
  // (a) las cadenas sueltas se leen
  const a = norm(E([{ id: "p1", tema: "comercial", cierre: "cifra", conceptos: "ventas", eje: "cliente", entidades: [CLIENTES[0], CLIENTES[1]] }], { criterio: "credito" }));
  if (a.formato.length || !mismo(a.encargo.partes[0].entidades, [{ nombre: CLIENTES[0] }, { nombre: CLIENTES[1] }]) || !mismo(a.encargo.criterio, { lente: "credito" }) || !mismo(a.encargo.partes[0].conceptos, ["ventas"])) v.push("una cadena suelta no se lee como la forma canónica");
  const s = norm(E([{ id: "p1", tema: "comercial", cierre: "cifra", conceptos: ["ventas"], entidades: CLIENTES[3] }]));
  if (s.formato.length || !mismo(s.encargo.partes[0].entidades, [{ nombre: CLIENTES[3] }])) v.push("un nombre suelto no se lee como la lista de uno");
  // (c) lo ininterpretable es FORMATO, no inexistencia, y no corre con lo que alcanzó a leerse
  for (const [t, enc] of [
    ["{eje, valor}", E([{ id: "p1", tema: "comercial", cierre: "cifra", conceptos: ["ventas"], entidades: [{ eje: "cliente", valor: CLIENTES[0] }] }])],
    ["una buena y una ilegible", E([{ id: "p1", tema: "comercial", cierre: "cifra", conceptos: ["ventas"], entidades: [CLIENTES[0], 7] }])],
    ["{nombre: 3}", E([{ id: "p1", tema: "comercial", cierre: "cifra", conceptos: ["ventas"], entidades: [{ nombre: 3 }] }])],
    ["criterio sin lente", E([{ id: "p1", tema: "cobranza", cierre: "decision", eje: "cliente" }], { criterio: { nombre: "credito" } })],
    ["criterio numérico", E([{ id: "p1", tema: "cobranza", cierre: "decision", eje: "cliente" }], { criterio: 3 })],
    ["criterio lista", E([{ id: "p1", tema: "cobranza", cierre: "decision", eje: "cliente" }], { criterio: ["credito"] })],
  ]) {
    const r = norm(enc);
    if (r.formato.length !== 1 || r.formato[0].motivo !== "formato_invalido" || !r.formato[0].campo || !r.formato[0].esperado || !r.formato[0].detalle) v.push(`${t}: no se declara formato_invalido con campo, forma esperada y detalle`);
    else if (/inexistente|desconocido/.test(JSON.stringify(r.formato))) v.push(`${t}: la forma se declara como culpa del valor`);
  }
  return v;
}

H("1a · el normalizador real: cumple la batería");
{
  const vs = bateria(normalizarFormaDelEncargo);
  ok(vs.length === 0, "★ la batería sobre `normalizarFormaDelEncargo`: bien formado idéntico · cadenas sueltas leídas · formas ilegibles = formato_invalido", vs.join(" || "));
  const e0 = E([{ id: "p1", tema: "comercial", cierre: "cifra", conceptos: "ventas", entidades: ["Jumbo"] }], { criterio: "credito" });
  const e0c = clon(e0); normalizarFormaDelEncargo(e0);
  ok(mismo(e0, e0c), "no muta lo que le llega");
  ok(!MOTIVOS.includes("formato_invalido"), "`formato_invalido` es un motivo de la capa de la capacidad: la lista cerrada de motivos del contrato del Encargo (encargo/*, congelado) no cambia");
}

H("★ carnadas · un normalizador con UN defecto se pone en rojo");
{
  const real = normalizarFormaDelEncargo;
  const MUTANTES = {
    "no normaliza nada (deja la cadena para el validador)": (e) => ({ encargo: e, avisos: [], formato: [] }),
    "deja fuera en silencio lo que no entiende": (e) => { const r = real(e); if (!r.formato.length) return r; const c = clon(e); for (const p of c.partes || []) if (Array.isArray(p.entidades)) p.entidades = p.entidades.filter((x) => typeof x === "string" || (x && typeof x.nombre === "string")).map((x) => (typeof x === "string" ? { nombre: x } : x)); if (!(c.criterio && (c.criterio.lente || c.criterio.referencia)) && typeof c.criterio !== "string") delete c.criterio; return { encargo: c, avisos: [], formato: [] }; },
    "adivina `valor` como el nombre": (e) => { const c = clon(e); for (const p of c.partes || []) if (Array.isArray(p.entidades)) p.entidades = p.entidades.map((x) => (x && typeof x === "object" && typeof x.valor === "string" ? { nombre: x.valor, eje: x.eje } : x)); return real(c); },
    "declara la forma ilegible como entidad inexistente": (e) => { const r = real(e); return { ...r, formato: r.formato.map((f) => ({ ...f, motivo: f.campo === "criterio" ? "criterio_desconocido" : "entidad_inexistente" })) }; },
    "reescribe lo bien formado (copia nueva)": (e) => { const r = real(e); return { ...r, encargo: clon(r.encargo) }; },
    "lee una lente suelta como otra parecida": (e) => { const r = real(e); if (r.encargo && typeof e.criterio === "string") return { ...r, encargo: { ...r.encargo, criterio: { lente: "riesgo" } } }; return r; },
  };
  for (const [nombre, mut] of Object.entries(MUTANTES)) ok(bateria(mut).length > 0, `★ CARNADA «${nombre}»: la batería se pone roja`);
}

H("1b · los casos reales del ensayo, por la acción: cadena suelta → se responde con sus cifras (el MISMO texto que con la forma canónica)");
{
  const casos = [
    ["B02 · «Jumbo»/«Lider» como lista de cadenas", { id: "p1", tema: "comercial", cierre: "cifra", conceptos: ["ventas"], eje: "cliente", entidades: [CLIENTES[2], CLIENTES[1]] }, { id: "p1", tema: "comercial", cierre: "cifra", conceptos: ["ventas"], eje: "cliente", entidades: [{ nombre: CLIENTES[2] }, { nombre: CLIENTES[1] }] }],
    ["C01 · «Hites» (una cuenta) como cadena suelta", { id: "p1", tema: "comercial", cierre: "cifra", conceptos: ["ventas"], eje: "cliente", entidades: CLIENTES[10] }, { id: "p1", tema: "comercial", cierre: "cifra", conceptos: ["ventas"], eje: "cliente", entidades: [{ nombre: CLIENTES[10] }] }],
    ["C02 · dos marcas como cadenas", { id: "p1", tema: "comercial", cierre: "cifra", conceptos: ["ventas"], eje: "marca", entidades: [MARCAS[0], MARCAS[2]] }, { id: "p1", tema: "comercial", cierre: "cifra", conceptos: ["ventas"], eje: "marca", entidades: [{ nombre: MARCAS[0] }, { nombre: MARCAS[2] }] }],
  ];
  for (const [t, suelta, canonica] of casos) {
    const rs = await consultar(E([suelta]));
    const rc = await consultar(E([canonica]));
    ok(rc.ok === true, `${t}: control · con la forma canónica ADI responde`, JSON.stringify(rc.noResuelto));
    ok(rs.ok === true && !motivos(rs).some((m) => /inexistente|desconocido/.test(m)), `★ ${t}: con la cadena suelta ADI RESPONDE (y no dice «inexistente»)`, JSON.stringify(rs.noResuelto));
    ok(rs.ok && rc.ok && Buffer.from(rs.entrega.texto).equals(Buffer.from(rc.entrega.texto)), `★ ${t}: el texto de la Entrega es el MISMO, byte a byte, que con la forma canónica`);
    ok(Array.isArray(rs.advertencias) && rs.advertencias.length >= 1 && !rc.advertencias, `${t}: ADI le dice cómo leyó la forma (advertencias) solo cuando tuvo que leerla`);
  }
  // A02/B01/C01 · criterio como cadena («credito», «riesgo», «ventas»)
  for (const lente of ["credito", "riesgo", "ventas", "contribucion"]) {
    const parte = { id: "p1", tema: "cobranza", cierre: "decision", eje: "cliente" };
    const rs = await consultar(E([parte], { criterio: lente }));
    const rc = await consultar(E([parte], { criterio: { lente } }));
    ok(rs.ok === rc.ok && !motivos(rs).includes("criterio_desconocido") && mismo(motivos(rs), motivos(rc)), `★ criterio «${lente}» como cadena: no es «criterio desconocido» (igual que {lente})`, JSON.stringify(rs.noResuelto));
    if (rs.ok && rc.ok) ok(Buffer.from(rs.entrega.texto).equals(Buffer.from(rc.entrega.texto)) && mismo(rs.meta.criterio, rc.meta.criterio), `★ criterio «${lente}» como cadena: la misma Entrega y el mismo criterio resuelto que con {lente}`);
  }
}

H("1c · el valor se sigue juzgando como siempre: lo que no existe, no existe");
{
  const parte = (entidades) => ({ id: "p1", tema: "comercial", cierre: "cifra", conceptos: ["ventas"], eje: "cliente", entidades });
  const r1 = await consultar(E([parte(["Cliente Que No Existe SpA"])]));
  ok(r1.ok === false && motivos(r1).includes("entidad_inexistente") && !motivos(r1).includes("formato_invalido"), "★ una cuenta que de verdad no existe (cadena suelta) sigue siendo `entidad_inexistente`", JSON.stringify(r1.noResuelto));
  const r2 = await consultar(E([parte([{ nombre: "Cliente Que No Existe SpA" }])]));
  ok(r2.ok === false && motivos(r2).includes("entidad_inexistente"), "y con la forma canónica, igual");
  const r3 = await consultar(E([parte([CLIENTES[0], "Cliente Que No Existe SpA"])]));
  ok(motivos(r3).filter((m) => m === "entidad_inexistente").length === 1 && r3.noResuelto.every((n) => n.valor && n.valor.nombre !== CLIENTES[0]), "una cuenta que existe junto a una que no: solo la que no existe se declara inexistente", JSON.stringify(r3.noResuelto));
  const r4 = await consultar(E([{ id: "p1", tema: "cobranza", cierre: "decision", eje: "cliente" }], { criterio: "rentabilidad_inventada" }));
  ok(motivos(r4).includes("criterio_desconocido") && !motivos(r4).includes("formato_invalido"), "★ una lente que de verdad no existe (cadena suelta) sigue siendo `criterio_desconocido`", JSON.stringify(r4.noResuelto));
  const r5 = await consultar(E([{ id: "p1", tema: "cobranza", cierre: "decision", eje: "cliente" }], { criterio: "caja" }));
  ok(motivos(r5).includes("criterio_desconocido"), "«caja» (tesorería) sigue siendo criterio desconocido con su salida, como con {lente}");
}

H("1d · una forma ininterpretable es FORMATO: dice el campo, lo que llegó y la forma esperada — nunca «la entidad no existe»");
{
  const casos = [
    ["{eje, valor} en lugar de {nombre}", E([{ id: "p1", tema: "comercial", cierre: "cifra", conceptos: ["ventas"], entidades: [{ eje: "cliente", valor: CLIENTES[0] }, { eje: "cliente", valor: CLIENTES[1] }] }]), "entidad"],
    ["un número como entidad", E([{ id: "p1", tema: "comercial", cierre: "cifra", conceptos: ["ventas"], eje: "cliente", entidades: [CLIENTES[0], 12] }]), "entidad"],
    ["criterio sin lente ni referencia", E([{ id: "p1", tema: "cobranza", cierre: "decision", eje: "cliente" }], { criterio: { nombre: "credito" } }), "criterio"],
  ];
  for (const [t, enc, campo] of casos) {
    const r = await consultar(enc);
    const n = (r.noResuelto || [])[0] || {};
    ok(r.ok === false && r.entrega === null && r.noResuelto.length === 1 && n.motivo === "formato_invalido" && n.campo === campo && n.esperado && n.detalle && n.valor, `★ ${t}: motivo «formato_invalido», campo «${campo}», lo que llegó y la forma esperada`, JSON.stringify(r.noResuelto));
    ok(!/entidad_inexistente|criterio_desconocido|no existe/i.test(JSON.stringify(r.noResuelto)), `★ ${t}: no culpa a la entidad ni a la lente`);
    ok(Array.isArray(r.uso) && r.uso.length === CABECERA_DE_USO.length, `${t}: la cabecera de uso viaja igual`);
  }
}

H("1e · lo bien formado no cambia: en los 532 encargos de los catálogos sellados y en todos los encargos de fixtures/ el normalizador devuelve el MISMO objeto");
{
  const MUESTRA = JSON.parse(fs.readFileSync(new URL("./fixtures/procedencia/muestra-v13-v40.json", import.meta.url), "utf8")).casos;
  const cambian = MUESTRA.filter((c) => { const r = normalizarFormaDelEncargo(c.encargo); return r.encargo !== c.encargo || r.formato.length || r.avisos.length; });
  ok(MUESTRA.length === 532 && cambian.length === 0, `★ los ${MUESTRA.length} encargos sellados v13–v40 pasan IDÉNTICOS (las Entregas no cambian): ${cambian.length} cambian`, cambian.slice(0, 3).map((c) => c.id).join(", "));
  const todos = [];
  const rec = (o, f) => { if (Array.isArray(o)) o.forEach((x) => rec(x, f)); else if (o && typeof o === "object") { if (o.version === "encargo/v1" && Array.isArray(o.partes)) todos.push({ f, e: o }); for (const v of Object.values(o)) rec(v, f); } };
  for (const f of fs.readdirSync("fixtures", { recursive: true })) if (String(f).endsWith(".json") && !String(f).startsWith("medicion-anfitrion")) { try { rec(JSON.parse(fs.readFileSync(`fixtures/${f}`, "utf8")), f); } catch { /* no es JSON de encargos */ } }
  const cambianF = todos.filter(({ e }) => { const r = normalizarFormaDelEncargo(e); return r.encargo !== e || r.formato.length || r.avisos.length; });
  ok(todos.length > 500 && cambianF.length === 0, `★ los ${todos.length} encargos de fixtures/ (catálogos y casos) pasan idénticos`, cambianF.slice(0, 3).map((c) => c.f).join(", "));
  // y la Entrega de un encargo bien formado, por la acción, es la de siempre (misma referencia → mismo camino): una muestra de 25 contra el demo
  initTenant(TENANT_DEMO);
  const TD = { id: "demo", nombre: "ADI Demo", dataset: TENANT_DEMO, version: 1, sello: null };
  let iguales = 0, n = 0;
  for (const c of MUESTRA.filter((_, i) => i % 21 === 0)) {
    const A = crearAcciones({ continuidad: crearAlmacenEnMemoria() });
    const r = await A.consultar({ tenant: TD, encargo: c.encargo });
    n += 1; if (!r.advertencias) iguales += 1;
  }
  ok(n >= 25 && iguales === n, `en ${n} consultas del catálogo por la acción no aparece ninguna advertencia de forma (nada se reinterpretó)`);
  initTenant(PACK);
}

/* ═══ 2 · LA CABECERA DE USO TRAE LA REGLA DEL TOTAL ══════════════════════════════════════════════════════════════════════════════════════════════════ */
H("2 · la cabecera de uso (instrucción previa al anfitrión): UNA regla del contrato — toda cifra empresarial es un hecho entregado por ADI (Contrato del Anfitrión, cabecera de cuatro reglas)");
{
  const REGLA = "Toda cifra empresarial que usted diga —en números o en palabras, incluidos totales, diferencias, porcentajes y conteos— debe ser un hecho que ADI le entregó en esta conversación. Si la cifra que necesita no está entre lo entregado, no la calcule ni la complete: pídasela a ADI (derivar, sobre identificadores ya entregados; o una consulta nueva). Redondear a lo impreso no es calcular.";
  ok(CABECERA_DE_USO[0] === REGLA && CABECERA_DE_USO.length === 4, "★ `CABECERA_DE_USO` trae la regla del contrato en `[0]` (las reglas 1/5 y 2/5 se fundieron: cabecera de cuatro)", JSON.stringify(CABECERA_DE_USO));
  ok(/^Lo que la Entrega declara en «Lo que no se puede concluir»/.test(CABECERA_DE_USO[1]) && /Redacte con total libertad/.test(CABECERA_DE_USO[CABECERA_DE_USO.length - 1]), "las reglas que ya tenía conservan su texto y la libertad de redacción sigue cerrando la cabecera");
  const r = await consultar(E([{ id: "p1", tema: "comercial", cierre: "cifra", conceptos: ["ventas"], eje: "cliente" }]));
  ok(r.ok && r.uso.includes(REGLA), "★ cada `consultar` la trae en `uso`");
  // por la puerta real (JSON-RPC y REST): lo que llega al anfitrión
  const SECRETO = "forma-del-encargo-gate-secret";
  const ENV = { ADI_COMPLEMENTO: "true", ADI_TOKEN_SECRET: SECRETO };
  const { code } = await makeAccessCode("Owner", 72, SECRETO, Date.now(), "demo");
  const TENANT_PUERTA = { id: "demo", nombre: "ADI Demo", dataset: TENANT_DEMO, version: 1, sello: null };
  initTenant(TENANT_DEMO);
  const acc = crearAcciones({ continuidad: crearAlmacenEnMemoria() });
  const cuerpoRpc = (args) => JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: "consultar", arguments: args } });
  let ip = 0;
  const llamar = async (args) => {
    const req = new Request("http://gate.local/mcp", { method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${code}`, "x-real-ip": `10.9.9.${++ip}` }, body: cuerpoRpc(args) });
    const res = await manejarPuerta(req, ENV, { acciones: acc });
    const j = await res.json();
    return JSON.parse(j.result.content[0].text);
  };
  const ok1 = await llamar({ encargo: E([{ id: "p1", tema: "comercial", cierre: "cifra", conceptos: ["ventas"], eje: "cliente", entidades: ["Jumbo", "Lider"] }]) });
  ok(ok1.ok === true && ok1.uso.includes(REGLA) && Array.isArray(ok1.entrega.cifras) && ok1.entrega.cifras.length >= 2 && !JSON.stringify(ok1.noResuelto || []).includes("inexistente"), "★ por la PUERTA (JSON-RPC): «Jumbo»/«Lider» como cadenas llegan con sus cifras y la regla del total en `uso`", JSON.stringify(ok1.noResuelto));
  const mal1 = await llamar({ encargo: E([{ id: "p1", tema: "comercial", cierre: "cifra", conceptos: ["ventas"], entidades: [{ eje: "cliente", valor: "Jumbo" }] }]) });
  ok(mal1.ok === false && mal1.noResuelto[0].motivo === "formato_invalido" && mal1.uso.includes(REGLA), "★ por la PUERTA: una forma ininterpretable llega como `formato_invalido`, con la regla en `uso`", JSON.stringify(mal1.noResuelto));
  const ref = await crearAcciones({ continuidad: crearAlmacenEnMemoria() }).consultar({ tenant: TENANT_PUERTA, encargo: E([{ id: "p1", tema: "comercial", cierre: "cifra", conceptos: ["ventas"], eje: "cliente", entidades: [{ nombre: "Jumbo" }, { nombre: "Lider" }] }]) });
  ok(ok1.entrega && ref.ok && Buffer.from(ok1.entrega.texto).equals(Buffer.from(ref.entrega.texto)), "★ el texto de la Entrega que llega por la puerta es el mismo, byte a byte, que con la forma canónica");
}

H("CERO RED");
{
  const fuente = fs.readFileSync(new URL("./src/adi/capacidad/formaDelEncargo.js", import.meta.url), "utf8");
  const sinComentarios = fuente.replace(/\/\*[\s\S]*?\*\//g, "");
  ok(!/\bimport\b/.test(sinComentarios) && !sinComentarios.includes(["node", ":"].join("")), "`formaDelEncargo.js` no importa nada (ni `node:*` ni el gateway): corre en edge como el resto de la puerta");
  ok(clasificarFuente(fs.readFileSync(new URL(import.meta.url), "utf8")).tipo === "offline", "este gate se clasifica `offline` (autochequeo)");
}

console.log(`\n${fail === 0 ? "✓" : "✗"} _forma_del_encargo_gate: ${pass} pass · ${fail} fail`);
process.exit(fail ? 1 : 0);
