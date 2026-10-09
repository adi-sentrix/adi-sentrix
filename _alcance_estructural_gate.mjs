/* === _alcance_estructural_gate.mjs · EL ALCANCE DE LO ENTREGADO VIAJA COMO DATO — y es VERDAD (owner 2026-10-09 · `_ADI_DISENO_ALCANCE_DE_LO_ENTREGADO.md` · `_ADI_DISENO_CONTRATO_ANFITRION.md` §18) ═══════════════
 * La familia de errores del anfitrión en los ensayos 9-12: ADI entregó una verdad correcta y dejó IMPLÍCITO hasta dónde llega. La solución: cada lista, tabla y respuesta lleva su alcance como DATO. Este gate es lo que ADI
 * GARANTIZA de forma determinística (lo del anfitrión —que lo lea y lo use— se mide, no se garantiza):
 *   0 · EL INTERRUPTOR: `ADI_ALCANCE_ESTRUCTURAL` se lee en UN solo lugar (`src/adi/capacidad/brazo.js`); "1"/ausente = brazo B (el producto nuevo), "0" = brazo A (las entregas de hoy).
 *   1 · BRAZO A BYTE IDÉNTICO: los 532 encargos sellados y las 97 llamadas grabadas del ensayo 12 (demo y Río Claro v1/v2) repetidos en el brazo A dan los MISMOS bytes que daba el árbol del commit 3476dabd
 *       (`fixtures/alcance/brazo-a-sellos.json`, `scripts/alcance/repeticion.mjs`). Los 532 TEXTOS sellados no cambian en ningún brazo (el alcance viaja al lado del texto).
 *   2 · COMPLETITUD (brazo B): ninguna lista, tabla, índice o página sale sin su alcance: cada universo trae cobertura «k de N» + selección (lista cerrada) + resto cuando k < N + qué métricas están ordenadas y cuáles solo se muestran;
 *       cada cifra está en una tabla con su orden declarado; `establecido` viaja en TODA respuesta; el mecanismo de texto (`alcance`) ya no viaja.
 *   3 · VERACIDAD: N, k, la regla de selección, el orden declarado y qué métricas están ordenadas se comprueban contra una RECOMPUTACIÓN INDEPENDIENTE desde las filas del tenant (demo, Río Claro v1 y v2): rosters, tops, filtros,
 *       series de cada tabla — sobre los 532 encargos sellados, el corpus grabado del ensayo 12 y una batería generada por eje × métrica × forma.
 *   4 · LO ESTABLECIDO: cada línea del digesto resuelve a ids del libro y dice la verdad (cobertura, orden, extremo del eje entero, relaciones, criterios contra el perfil del tenant y el Marco de la Entrega); ≤ 1 KB; sin lista parcial de nombres.
 *   5 · SUFICIENCIA: lo que el anfitrión necesita para NO completar está en la MISMA respuesta. 6 · COMPACIDAD: consultar compacta ≤ 20 KB en los 532 en AMBOS brazos; descripciones de herramientas dentro de sus topes.
 *   7 · CARNADAS: un alcance con UN defecto (cobertura, N, selección, orden, extremo, criterio, resto) pone en rojo la verificación. 8 · `conocerEmpresa`: `vigente` de cada criterio, y cambia cuando la empresa declara.
 * CERO llamadas a un LLM · CERO red. Solo por `npm run gates:offline` o `node --import ./scripts/offline-guard.mjs _alcance_estructural_gate.mjs`. */
import fs from "node:fs";
import { initTenant } from "./src/data/tenantStore.js";
import { TENANT_DEMO } from "./src/data/tenants/demo.js";
import { crearAcciones, CABECERA_DE_USO, CABECERA_DE_USO_B, cabeceraDeUso } from "./src/adi/capacidad/acciones.js";
import { compactarParaAnfitrion } from "./src/adi/capacidad/compacto.js";
import { alcanceEstructural, brazoActual, VARIABLE_DEL_BRAZO } from "./src/adi/capacidad/brazo.js";
import { conTenantActivo } from "./src/adi/capacidad/aislamiento.js";
import { MCP_TOOLS } from "./src/adi/capacidad/puerta.js";
import { guiaDeUniverso } from "./src/adi/capacidad/ensenar.js";
import { crearAlmacenEnMemoria } from "./src/adi/continuidad/almacen.js";
import { ESTABLECIDO_TOPE_BYTES } from "./src/adi/capacidad/establecido.js";
import { buildMesaFlujo } from "./src/adi/sentrix/mesaFlujo.js";
import { packRenombrado } from "./scripts/medicion-anfitrion/empresa-no-demo.mjs";
import { cargarArbol, repetir532, repetirEnsayo12 } from "./scripts/alcance/repeticion.mjs";
import { clasificarFuente } from "./scripts/clasificarGates.mjs";

let pass = 0, fail = 0;
const ok = (c, m, extra = "") => { if (c) { pass++; } else { fail++; console.log("  ✗ " + m + (extra ? "\n      " + String(extra).slice(0, 900) : "")); } };
const H = (t) => console.log(`\n${t}`);
const bytes = (o) => Buffer.byteLength(typeof o === "string" ? o : JSON.stringify(o));
const jj = (x) => JSON.stringify(x);
const clon = (x) => JSON.parse(JSON.stringify(x));
const PREVIO = process.env[VARIABLE_DEL_BRAZO];
const brazo = (b) => { if (b === undefined) delete process.env[VARIABLE_DEL_BRAZO]; else process.env[VARIABLE_DEL_BRAZO] = b; };
const restaurar = () => brazo(PREVIO);
const lista = (x) => Array.isArray(x) && x.length > 0;

const MUESTRA = JSON.parse(fs.readFileSync(new URL("./fixtures/procedencia/muestra-v13-v40.json", import.meta.url), "utf8")).casos;
const SELLOS = JSON.parse(fs.readFileSync(new URL("./fixtures/alcance/brazo-a-sellos.json", import.meta.url), "utf8"));
const CORPUS12 = JSON.parse(fs.readFileSync(new URL("./fixtures/alcance/ensayo12-llamadas.json", import.meta.url), "utf8")).hilos;
const EMPRESAS = [
  { etiqueta: "demo", T: { id: "demo", nombre: "ADI Demo", dataset: TENANT_DEMO, version: 1, sello: null } },
  { etiqueta: "rioclaro v1", T: { id: "rioclaro", nombre: "Distribuidora Río Claro", dataset: packRenombrado({ version: 1 }), version: 1, sello: null } },
  { etiqueta: "rioclaro v2", T: { id: "rioclaro", nombre: "Distribuidora Río Claro", dataset: packRenombrado({ version: 2 }), version: 2, sello: null } },
];

/* ═══ EL ORÁCULO INDEPENDIENTE: rosters y valores directo de las TABLAS del tenant (no de la Entrega ni del Core de lectura) ═══════════════════════════════════════════════════════════════════ */
const MONEY = new Set(["ventas", "contribucion", "saldo_vencido", "saldo_pendiente", "abonado", "saldo_por_vencer"]);   /* las tablas del dato están en MILES; los filtros del encargo, en pesos */
function oraculo(T) {
  const D = T.dataset;
  const roster = {
    cliente: D.clientesVentas.map((x) => x.nombre), marca: D.marcasVentas.map((x) => x.nombre), familia: D.sfamiliasVentas.map((x) => x.nombre), sku: D.skusMargen.map((x) => x.nombre),
    bodega: [...new Set(D.skuInventario.map((x) => x.bodega))], canal: [...new Set(D.clientesVentas.map((x) => x.canal))],
  };
  const mesa = conTenantActivo(D, () => buildMesaFlujo().filas.map((f) => ({ ...f })));
  const por = (arr, campo, k = 1, nom = "nombre") => new Map(arr.map((x) => [x[nom], x[campo] * k]));
  const canalDe = new Map(D.clientesVentas.map((c) => [c.nombre, c.canal]));
  const sumaCanal = (arr, campo, k) => { const m = new Map(); for (const x of arr) { const c = canalDe.get(x.nombre); if (c) m.set(c, (m.get(c) || 0) + x[campo] * k); } return m; };
  const sumaBodega = (campo) => { const m = new Map(); for (const x of D.skuInventario) m.set(x.bodega, (m.get(x.bodega) || 0) + x[campo]); return m; };
  const tabla = {
    cliente: { ventas: () => por(D.clientesVentas, "actual", 1000), margen: () => por(D.clientesMargen, "margen"), contribucion: () => por(D.clientesMargen, "contribucion", 1000), unidades: () => por(D.clientesVentas, "unidades"),
      saldo_vencido: () => por(mesa, "vencidoK", 1000), saldo_pendiente: () => por(mesa, "saldoK", 1000), abonado: () => por(mesa, "abonadoK", 1000), saldo_por_vencer: () => por(mesa, "porVencerK", 1000), dias_vencido: () => por(mesa, "diasVencido"), recuperado: () => por(mesa, "recuperadoPct") },
    marca: { ventas: () => por(D.marcasVentas, "actual", 1000), margen: () => por(D.marcasMargen, "margen"), contribucion: () => por(D.marcasMargen, "contribucion", 1000), unidades: () => por(D.marcasVentas, "unidades") },
    familia: { ventas: () => por(D.sfamiliasVentas, "actual", 1000), margen: () => por(D.sfamiliasMargen, "margen"), contribucion: () => por(D.sfamiliasMargen, "contribucion", 1000), unidades: () => por(D.sfamiliasVentas, "unidades") },
    sku: { ventas: () => por(D.skusMargen, "venta", 1000), margen: () => por(D.skusMargen, "margen"), contribucion: () => por(D.skusMargen, "contribucion", 1000), unidades: () => por(D.skusMargen, "unidades"),
      capital: () => por(D.skuInventario, "stockUSD", 1, "sku"), dias_inventario: () => por(D.skuInventario, "doh", 1, "sku"), rotacion: () => por(D.skuInventario, "rotacion", 1, "sku"), unidades_stock: () => por(D.skuInventario, "stockUnd", 1, "sku"), dias_sin_venta: () => por(D.skuInventario, "diasSinVenta", 1, "sku") },
    canal: { ventas: () => sumaCanal(D.clientesVentas, "actual", 1000), contribucion: () => sumaCanal(D.clientesMargen, "contribucion", 1000), unidades: () => sumaCanal(D.clientesVentas, "unidades", 1) },
    bodega: { capital: () => sumaBodega("stockUSD"), unidades_stock: () => sumaBodega("stockUnd") },
  };
  return { roster, valor: (eje, clave) => { const f = tabla[eje] && tabla[eje][clave]; return f ? f() : null; }, ejeDe: (nombre) => Object.keys(roster).find((e) => roster[e].includes(nombre)) || null };
}
const cercano = (a, b) => Math.abs(a - b) <= 1e-6 * Math.max(1, Math.abs(a), Math.abs(b));
const OPS = { ">": (a, b) => a > b, "<": (a, b) => a < b, ">=": (a, b) => a >= b, "<=": (a, b) => a <= b, "=": (a, b) => cercano(a, b), "==": (a, b) => cercano(a, b) };
const TIPOS = ["top", "filtro", "estado", "nombradas", "completo", "prioridad"];

/** el tipo de selección que la Entrega declaró, con las reglas del diseño (§2.1), reescrito aquí: independiente de `alcanceEstructural.js` */
function tipoEsperado(u, N) {
  if (u.orden) return "prioridad";
  if (u.top) return "top";
  const ex = u.excluir && typeof u.excluir === "object" ? u.excluir : null;
  const hayEx = !!(ex && (lista(ex.entidades) || lista(ex.conjuntos) || lista(ex.estados) || ex.bodega || (Array.isArray(ex.top) ? ex.top.length > 0 : !!ex.top)));
  if (lista(u.filtros) || hayEx || u.base || u.bodega || lista(u.union)) return "filtro";
  if (lista(u.estados) || lista(u.no_estados)) return "estado";
  return u.entidades.length < N ? "nombradas" : "completo";
}

/** rangos «E1.h1–E1.h24 y E1.h26» → los ids */
function idsDe(rango) {
  const out = [];
  for (const tramo of String(rango).split(" y ")) {
    const m = /^E(\d+)\.h(\d+)(?:–E\d+\.h(\d+))?$/.exec(tramo.trim());
    if (!m) return null;
    for (let k = Number(m[2]); k <= Number(m[3] || m[2]); k++) out.push(`E${m[1]}.h${k}`);
  }
  return out;
}
const sentidoDe = (xs) => { if (xs.length < 2) return null; let baja = true, sube = true, cambio = false; for (let i = 1; i < xs.length; i++) { if (xs[i] > xs[i - 1] + 1e-9) { baja = false; cambio = true; } if (xs[i] < xs[i - 1] - 1e-9) { sube = false; cambio = true; } } return !cambio ? null : baja ? "mayor-a-menor" : sube ? "menor-a-mayor" : "desordenada"; };

/* ═══ LA VERIFICACIÓN DE UNA CONSULTA (brazo B) — devuelve la lista de violaciones; vacía = el alcance que viaja es completo y VERDAD ═════════════════════════════════════════════════════════════ */
function verificarConsulta({ r, c, libro, O, nivel = {}, encargo = null }) {
  const v = [];
  const e = c && c.entrega;
  if (!e) return ["la respuesta compacta no trae `entrega`"];
  const json = r.entrega.json;
  const n = c.continuidad.estadoVigente.turno;
  const eEntrega = libro.entregas.find((x) => x.n === n);
  /* 2 · COMPLETITUD */
  if ("alcance" in e) v.push("el mecanismo de texto (`alcance`) sigue viajando");
  const meta = json.meta || {};
  const recortado = meta.recortoFilas > 0 || meta.recortoOraciones > 0 || meta.excedeTope === true;
  if (recortado !== Boolean(e.recorte)) v.push(`\`recorte\` ${e.recorte ? "viaja sin que se haya recortado nada" : "falta y se recortó"}`);
  if (!c.establecido || typeof c.establecido.memoria !== "string") v.push("la respuesta no trae `establecido`");
  else if (bytes(c.establecido) > ESTABLECIDO_TOPE_BYTES) v.push(`establecido pesa ${bytes(c.establecido)} B`);
  if (jj(c.uso) !== jj(CABECERA_DE_USO_B) || c.uso.length !== 4) v.push("la cabecera no es la de cuatro reglas");
  const universos = e.universos || [];
  const ordenadas = new Set(json.universos.filter((u) => u.orden).map((u) => u.id));
  json.universos.forEach((u, i) => {
    const id = `E${n}.u${i + 1}`;
    const cu = universos.find((x) => x.id === id);
    if (!u.orden && ordenadas.has(`${u.id}_orden`)) { if (cu) v.push(`${id}: el conjunto sin orden de una prioridad ordenada sigue viajando`); return; }
    if (!cu) { v.push(`${id}: el universo no viaja`); return; }
    const N = O.roster[u.eje] ? O.roster[u.eje].length : null;
    const k = u.entidades.length;
    if ("n" in cu || "parcial" in cu) v.push(`${id}: viajan \`n\`/\`parcial\` además de \`cobertura\``);
    /* 3 · VERACIDAD: N (del roster del tenant), k (lo servido), la regla de selección, el resto */
    if (N === null) { v.push(`${id}: el eje «${u.eje}» no tiene roster en el tenant`); return; }
    if (cu.cobertura !== `${k} de ${N}`) { v.push(`${id}: cobertura «${cu.cobertura}» y es ${k} de ${N}`); return; }
    if (u.ejeN !== undefined && u.ejeN !== N) v.push(`${id}: ejeN ${u.ejeN} ≠ roster ${N}`);
    const s = cu.seleccion;
    if (!s || !TIPOS.includes(s.tipo)) { v.push(`${id}: selección fuera de la lista cerrada: ${jj(s)}`); return; }
    const pu = ((encargo && encargo.partes) || []).find((q) => q.id === u.id || String(u.id).startsWith(`${q.id}_`));   /* la bodega y la unión que la parte declaró: el universo declarado no las guardaba */
    const esperado = tipoEsperado({ ...u, ejeN: N, ...(pu && pu.universo && pu.universo.bodega ? { bodega: pu.universo.bodega } : {}), ...(pu && pu.universo && lista(pu.universo.union) ? { union: pu.universo.union } : {}) }, N);
    if (s.tipo !== esperado) v.push(`${id}: selección «${s.tipo}» y la Entrega declaró «${esperado}»`);
    if (s.tipo === "top") {
      if (s.k !== u.top.k || String(s.direccion) !== String(u.top.direccion || "mayor") || typeof s.metrica !== "string") v.push(`${id}: el top no es el declarado: ${jj(s)}`);
      if ((s.servidos !== undefined) !== (k !== u.top.k)) v.push(`${id}: \`servidos\` mal: ${jj(s)}`);
    }
    if (s.tipo === "filtro" && lista(u.filtros)) {
      const cs = s.condiciones || [];
      if (cs.length !== u.filtros.length || cs.some((q, j) => q.op !== u.filtros[j].op || (q.valor ?? null) !== (u.filtros[j].valor ?? null) || (q.ref ?? null) !== (u.filtros[j].ref ?? null))) v.push(`${id}: las condiciones no son las del filtro: ${jj(cs)}`);
    }
    /* el resto */
    if (k < N && !u.soloRanking && !cu.resto && s.tipo !== "prioridad") v.push(`${id}: k < N y no trae \`resto\``);
    if (k < N && s.tipo === "prioridad" && !cu.resto) v.push(`${id}: la prioridad cubre ${k} de ${N} y no dice qué pasa con el resto`);
    if (k >= N && cu.resto) v.push(`${id}: k = N y trae \`resto\``);
    if (cu.resto) {
      const evaluadoEsperado = s.tipo === "filtro" || s.tipo === "estado" || s.tipo === "prioridad";
      if (cu.resto.n !== N - k || cu.resto.evaluado !== evaluadoEsperado) v.push(`${id}: resto ${jj(cu.resto)} y era {n:${N - k}, evaluado:${evaluadoEsperado}}`);
    }
    /* qué métricas están ordenadas y cuáles solo se muestran */
    if (u.soloRanking || s.tipo === "prioridad") { if (cu.metricas) v.push(`${id}: un universo sin cifras propias trae \`metricas\``); }
    else if (k >= N) { if (cu.metricas) v.push(`${id}: cubre el eje entero y repite \`metricas\``); }
    else if (k === 0) { /* sin entidades no hay filas: no hay métrica que repartir (un filtro puede decir igual que su métrica se evaluó sobre los N) */ }
    else if (!cu.metricas || !Object.keys(cu.metricas).length) v.push(`${id}: k < N y no dice qué métricas están ordenadas, evaluadas o solo mostradas`);
    else {
      const solo = k === 1 ? "^solo de este; el resto no evaluado$" : `^solo de estos ${k}; el resto no evaluado$`;
      const sobre = new RegExp(`^evaluada sobre los ${N}$`);
      const ord = new RegExp(`^ordenada sobre los ${N}: el 1\\.º es (el mayor|el menor|el peor|el mejor) del eje$`);
      const ordAc = /^ordenada solo entre los que cumplen la condición; el resto no evaluado$/;
      const filtradas = new Set(((s.condiciones) || []).map((q) => q.metrica));
      for (const [m, t] of Object.entries(cu.metricas)) {
        const esTop = s.tipo === "top" && m === s.metrica;
        const buena = esTop ? (s.acotadoPor ? ordAc.test(t) : ord.test(t)) : (filtradas.has(m) ? sobre.test(t) : new RegExp(solo).test(t));
        if (!buena) v.push(`${id}: la métrica «${m}» dice «${t}» y no corresponde`);
      }
      if (s.tipo === "top" && !(s.metrica in cu.metricas)) v.push(`${id}: la métrica del orden no está en \`metricas\``);
    }
    /* el top contra la recomputación independiente (solo si el top no está acotado por otra condición) */
    if (s.tipo === "top" && !s.acotadoPor && ["mayor", "menor"].includes(String(u.top.direccion || "mayor"))) {
      const vals = O.valor(u.eje, u.top.metrica);
      if (vals) {
        nivel.topsVerificados = (nivel.topsVerificados || 0) + 1;
        const dir = String(u.top.direccion || "mayor");
        const orden = [...vals].filter(([nom]) => O.roster[u.eje].includes(nom)).sort((a, b) => (dir === "mayor" ? b[1] - a[1] : a[1] - b[1]));
        const todos = u.entidades.every((x) => vals.has(x)) && orden.length === N;
        const prefijo = todos && u.entidades.every((x, j) => cercano(vals.get(x), orden[j][1]));
        const corte = orden[k - 1] ? orden[k - 1][1] : null;
        const completoCorte = todos && orden.filter(([, val]) => (dir === "mayor" ? val > corte + 1e-6 : val < corte - 1e-6)).every(([nom]) => u.entidades.includes(nom));
        if (!prefijo || !completoCorte || k < u.top.k) v.push(`${id}: el top declarado (${dir} ${u.top.metrica} ${u.top.k}) NO es el de la recomputación independiente: ${jj(u.entidades)} vs ${jj(orden.slice(0, k).map((x) => x[0]))}`);
        const dichaDir = /de menor a mayor/.test(cu.orden || "") ? "menor" : /de mayor a menor/.test(cu.orden || "") ? "mayor" : null;
        if (k > 1 && dichaDir !== dir) v.push(`${id}: el orden dice «${cu.orden}» y el top es ${dir}`);
      } else nivel.topsSinOraculo = (nivel.topsSinOraculo || 0) + 1;
    }
    /* el filtro contra la recomputación independiente (solo el filtro puro: sin estados, bases ni exclusiones) */
    if (s.tipo === "filtro" && !s.acotadoPor && lista(u.filtros) && u.filtros.every((q) => typeof q.valor === "number" && OPS[q.op] && O.valor(u.eje, q.metrica))) {
      nivel.filtrosVerificados = (nivel.filtrosVerificados || 0) + 1;
      const mapas = u.filtros.map((q) => O.valor(u.eje, q.metrica));
      const esperadoSet = O.roster[u.eje].filter((nom) => u.filtros.every((q, j) => mapas[j].has(nom) && OPS[q.op](mapas[j].get(nom), q.valor)));
      if (jj([...esperadoSet].sort()) !== jj([...u.entidades].sort())) v.push(`${id}: el filtro NO da lo que la recomputación independiente: ${jj(u.entidades)} vs ${jj(esperadoSet)}`);
    }
  });
  /* tablas: cubren cada cifra de la tabla (y lo «fuera del texto») exactamente una vez; el orden declarado es verdad */
  const tablas = e.tablas || [];
  const totalesDelListado = (x) => /total del listado completo/.test(x.metrica || "");
  const esperadosIds = [...e.cifras.filter((x) => !totalesDelListado(x)).map((x) => x.id), ...(((e.detalle || {}).fueraDelTexto) || []).filter((x) => x.id).map((x) => x.id)];
  const cubiertos = [];
  const hechoPorId = new Map((eEntrega.hechos || []).map((h) => [h.id, h]));
  for (const t of tablas) {
    const ids = idsDe(t.cifras);
    if (!ids) { v.push(`tabla: rango ilegible «${t.cifras}»`); continue; }
    cubiertos.push(...ids);
    if (typeof t.orden !== "string" || !Array.isArray(t.ordenadaPor || [])) v.push(`tabla ${t.cifras}: sin \`orden\``);
    const ordenada = lista(t.ordenadaPor);
    if (!ordenada && t.soloMostradas) v.push(`tabla ${t.cifras}: sin orden y repite \`soloMostradas\``);
    if (ordenada) {
      const label = t.ordenadaPor[0];
      const m = /^por (.+), (de mayor a menor|de menor a mayor) \((\d+ de \d+|\d+ filas?)\)$/.exec(t.orden);
      if (!m || m[1] !== label) { v.push(`tabla ${t.cifras}: el orden dice «${t.orden}» y ordenadaPor es ${jj(t.ordenadaPor)}`); continue; }
      /* la serie de ESA métrica, por entidad, en el orden de las filas, desde los crudos que el libro guardó */
      const ents = [], serie = new Map();
      let clave = null;
      for (const id of ids) {
        const h = hechoPorId.get(id); if (!h) continue;
        const rv = h.rv || {};
        const celdas = rv.metrica ? [{ l: rv.metrica, raw: rv.raw, clave: rv.clave }, ...(rv.mas || []).map((x) => ({ l: x.metrica, raw: x.raw, clave: x.clave }))] : [{ l: h.metrica, raw: rv.raw, clave: rv.clave }];
        const sujeto = h.sujeto || rv.sujeto;
        const cel = celdas.find((x) => x.l === label);
        if (!sujeto || !cel || !O.ejeDe(sujeto)) continue;   /* el «Total (6 cliente)» que la tabla agrega no es una entidad: no entra al orden */
        if (!ents.includes(sujeto)) ents.push(sujeto);
        serie.set(sujeto, cel.raw); clave = cel.clave;
      }
      const xs = ents.map((x) => serie.get(x));
      const dirReal = sentidoDe(xs);
      if (xs.length < 2 || dirReal !== (m[2] === "de mayor a menor" ? "mayor-a-menor" : "menor-a-mayor")) v.push(`tabla ${t.cifras}: «${t.orden}» y la serie servida es ${jj(xs)} (${dirReal})`);
      else {
        nivel.tablasOrdenadas = (nivel.tablasOrdenadas || 0) + 1;
        const eje = O.ejeDe(ents[0]);
        const vals = eje && clave ? O.valor(eje, clave) : null;
        if (vals && ents.every((x) => vals.has(x))) {
          nivel.tablasConOraculo = (nivel.tablasConOraculo || 0) + 1;
          const ys = ents.map((x) => vals.get(x));
          if (sentidoDe(ys) !== dirReal) v.push(`tabla ${t.cifras}: ordenada por ${label} ${m[2]} y la recomputación independiente da ${jj(ys)}`);
        }
      }
      if (lista(t.soloMostradas) && t.soloMostradas.includes(label)) v.push(`tabla ${t.cifras}: «${label}» está ordenada Y solo mostrada`);
    }
  }
  if (jj([...cubiertos].sort()) !== jj([...esperadosIds].sort())) v.push(`las tablas no cubren cada cifra exactamente una vez: cubren ${cubiertos.length} y hay ${esperadosIds.length} (${esperadosIds.filter((x) => !cubiertos.includes(x)).slice(0, 4).join(",")} sin tabla; ${cubiertos.filter((x, j) => cubiertos.indexOf(x) !== j).slice(0, 4).join(",")} repetidas)`);
  /* 5 · SUFICIENCIA: cada métrica que se muestra tiene su cobertura dicha en ESTA respuesta */
  const etiquetas = [...new Set(e.cifras.filter((x) => x.entidad && O.ejeDe(x.entidad) && !totalesDelListado(x)).map((x) => x.metrica))];
  for (const l of etiquetas) {
    const dicha = universos.some((u) => (u.metricas && l in u.metricas) || (u.cobertura && /^(\d+) de \1$/.test(u.cobertura)) || (u.seleccion && u.seleccion.tipo === "prioridad"));
    if (!dicha) v.push(`la métrica «${l}» se muestra y ningún universo de esta respuesta dice qué cobertura tiene`);
  }
  return v;
}

/* ═══ 0 · EL INTERRUPTOR ═══════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════ */
H("0 · el interruptor: UN solo lugar, `ADI_ALCANCE_ESTRUCTURAL`, brazo B por defecto");
{
  brazo(undefined); ok(alcanceEstructural() === true && brazoActual() === "B", "★ sin variable: brazo B (el producto nuevo)");
  brazo("1"); ok(alcanceEstructural() === true && brazoActual() === "B", "«1» = brazo B");
  brazo("0"); ok(alcanceEstructural() === false && brazoActual() === "A" && cabeceraDeUso() === CABECERA_DE_USO, "★ «0» = brazo A: las cinco reglas de siempre");
  brazo("0 "); ok(alcanceEstructural() === false, "(el espacio no cambia el brazo)");
  brazo("basura"); ok(alcanceEstructural() === true, "cualquier valor que no sea «0» es el brazo B");
  brazo("1"); ok(cabeceraDeUso() === CABECERA_DE_USO_B && CABECERA_DE_USO_B.length === 4 && CABECERA_DE_USO.length === 5, "★ B = cuatro reglas · A = cinco");
  ok(CABECERA_DE_USO_B[0] === "Toda cifra, orden, extremo, relación o conjunto que usted afirme debe ser un hecho que ADI le entregó (con su alcance) o estar en lo establecido de esta conversación. Lo que ADI marca como no evaluado no se completa: pídalo (consultar, derivar) o dígalo como no evaluado.", "★ la regla fundida es el texto EXACTO del diseño (§2.5)");
  ok(CABECERA_DE_USO_B.slice(1).every((t, i) => t === CABECERA_DE_USO[i + 2]), "las otras tres (hallazgos negativos · referencia del oficio · libertad de redacción) no cambian una letra");
  const regla = bytes(CABECERA_DE_USO), reglaB = bytes(CABECERA_DE_USO_B);
  console.log(`   · cabecera de uso: A ${regla} B (5 reglas) · B ${reglaB} B (4 reglas) · ahorro ${regla - reglaB} B por respuesta`);
  ok(reglaB < regla - 300, "★ la cabecera de cuatro reglas pesa al menos 300 B menos");
  /* un solo lugar: ningún otro módulo de src/ lee la variable */
  const lee = [];
  const barrer = (dir) => { for (const f of fs.readdirSync(dir, { withFileTypes: true })) { const p = `${dir}/${f.name}`; if (f.isDirectory()) barrer(p); else if (/\.(js|jsx|mjs)$/.test(f.name) && fs.readFileSync(p, "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`\\])\/\/[^\n]*/g, "$1").includes("ADI_ALCANCE_ESTRUCTURAL")) lee.push(p); } };
  barrer("src");
  ok(lee.length === 1 && lee[0].endsWith("capacidad/brazo.js"), "★ la variable se lee en UN solo archivo (`src/adi/capacidad/brazo.js`)", lee.join(", "));
  const srcBrazo = fs.readFileSync("src/adi/capacidad/brazo.js", "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`\\])\/\/[^\n]*/g, "$1");
  ok(!/node:/.test(srcBrazo) && /typeof process/.test(srcBrazo), "`brazo.js` no usa `node:*` (corre en edge) y no revienta sin `process`");
}

/* ═══ 1 · EL BRAZO A ES BYTE IDÉNTICO A LO DE ANTES ═══════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════ */
H("1 · BRAZO A · los 532 y el ensayo 12 grabado, repetidos en el brazo A, dan los bytes del árbol del commit 3476dabd");
{
  brazo("0");
  const arbol = await cargarArbol(process.cwd());
  const s532 = await repetir532(arbol);
  const dif = Object.keys(SELLOS.e532).filter((id) => SELLOS.e532[id] !== s532[id]);
  ok(Object.keys(SELLOS.e532).length === 532 && dif.length === 0, `★ los 532 encargos sellados: la respuesta compacta del brazo A es idéntica byte a byte a la de siempre (${532 - dif.length} de 532)`, dif.slice(0, 6).join(" "));
  const e12 = await repetirEnsayo12(arbol);
  const dif12 = e12.filter((x, i) => !SELLOS.ensayo12[i] || SELLOS.ensayo12[i].sello !== x.sello || SELLOS.ensayo12[i].herramienta !== x.herramienta);
  ok(e12.length === SELLOS.ensayo12.length && e12.length >= 90 && dif12.length === 0, `★ las ${e12.length} llamadas grabadas del ensayo 12 (consultar · derivar · aportarContexto · conocerEmpresa; demo y Río Claro v1/v2): idénticas a las de siempre (${e12.length - dif12.length} de ${e12.length})`, jj(dif12.slice(0, 3)));
  ok(new Set(e12.map((x) => x.herramienta)).size === 4, "…y cubren las cuatro acciones que no cambian de forma (retomar se pagina en los dos brazos)");
  /* los 532 TEXTOS sellados no cambian en NINGÚN brazo (el alcance viaja al lado del texto) */
  const sellos = JSON.parse(fs.readFileSync(new URL("./fixtures/total-del-listado/textos-v13-v40.sha256.json", import.meta.url), "utf8")).hashes;
  const crypto = await import("node:crypto");
  let iguales = 0, total = 0, malos = [];
  for (const b of ["0", "1"]) {
    brazo(b);
    for (const caso of MUESTRA.filter((_, i) => i % 7 === 0)) {
      const r = await crearAcciones({ continuidad: crearAlmacenEnMemoria() }).consultar({ tenant: EMPRESAS[0].T, encargo: clon(caso.encargo) });
      const h = r.ok && r.entrega ? crypto.createHash("sha256").update(String(r.entrega.texto)).digest("hex") : null;
      total++; if (h === sellos[caso.id]) iguales++; else malos.push(`${b}:${caso.id}`);
    }
  }
  ok(iguales === total, `★ el TEXTO de la Entrega sellado (sha256) es el mismo en los dos brazos (${iguales} de ${total} repeticiones, 1 de cada 7 de los 532 por brazo; el barrido entero de los 532 textos lo hace \`_una_sola_realidad_gate\` en el brazo por defecto)`, malos.slice(0, 5).join(" "));
}

/* ═══ 2-3 · COMPLETITUD Y VERACIDAD · los 532 encargos (demo) en el brazo B ═══════════════════════════════════════════════════════════════════════════════════════════════════════════ */
H("2-3 · BRAZO B · los 532 encargos sellados: alcance completo y verdadero contra la recomputación independiente");
const nivel532 = {};
{
  brazo("1");
  initTenant(TENANT_DEMO);
  const T = EMPRESAS[0].T, O = oraculo(T);
  const viol = [];
  const tam = [];
  let universos = 0, tablas = 0, conEstablecido = 0, ejecutadas = 0;
  for (const caso of MUESTRA) {
    const store = crearAlmacenEnMemoria();
    const A = crearAcciones({ continuidad: store });
    const r = await A.consultar({ tenant: T, encargo: clon(caso.encargo) });
    const c = compactarParaAnfitrion("consultar", r);
    tam.push([bytes(c), caso.id]);
    if (!r.ok) continue;
    ejecutadas++;
    const libro = await store.leerLibro(T.id, r.continuidad.conversacionId);
    const vv = verificarConsulta({ r, c, libro, O, nivel: nivel532, encargo: caso.encargo });
    if (vv.length) viol.push(`${caso.id}: ${vv.slice(0, 3).join(" ; ")}`);
    universos += (c.entrega.universos || []).length; tablas += (c.entrega.tablas || []).length; if (c.establecido) conEstablecido++;
  }
  ok(ejecutadas > 400 && viol.length === 0, `★ en las ${ejecutadas} Entregas de los 532 encargos: cobertura, selección, resto, métricas ordenadas/solo mostradas, tablas y establecido son COMPLETOS y VERDAD (${viol.length} con defectos)`, viol.slice(0, 3).join(" || "));
  console.log(`   · ${universos} universos y ${tablas} tablas verificados · ${nivel532.topsVerificados || 0} tops y ${nivel532.filtrosVerificados || 0} filtros recomputados de forma independiente desde las filas del tenant (${nivel532.topsSinOraculo || 0} tops de métricas sin tabla cruda propia: se verifica cobertura y regla, no el orden) · ${nivel532.tablasOrdenadas || 0} tablas con orden declarado (${nivel532.tablasConOraculo || 0} contra el oráculo)`);
  ok((nivel532.topsVerificados || 0) >= 40 && (nivel532.filtrosVerificados || 0) >= 4 && (nivel532.tablasOrdenadas || 0) >= 100, "el oráculo independiente cubre una parte real del catálogo (≥ 40 tops, ≥ 4 filtros puros —los demás llevan estados, bases o referencias que el oráculo no rehace—, ≥ 100 tablas ordenadas); la batería generada (3b) rehace ≥ 20 filtros más");
  ok(conEstablecido === ejecutadas, "★ `establecido` viaja en TODA consulta resuelta");
  tam.sort((a, b) => a[0] - b[0]);
  console.log(`   · consultar compacta, brazo B: mediana ${(tam[tam.length >> 1][0] / 1024).toFixed(1)} KB · p90 ${(tam[Math.floor(tam.length * 0.9)][0] / 1024).toFixed(1)} KB · MÁXIMO ${tam[tam.length - 1][0]} B (${tam[tam.length - 1][1]})`);
  ok(tam[tam.length - 1][0] <= 20 * 1024, `★ COMPACIDAD (B): consultar compacta ≤ 20 KB (20 480 B) en los ${tam.length} encargos; máximo ${tam[tam.length - 1][0]} B`, tam.slice(-3).map((x) => x.join("@")).join(" "));
  /* el brazo A: la misma referencia */
  brazo("0");
  const tamA = [];
  for (const caso of MUESTRA) { const r = await crearAcciones({ continuidad: crearAlmacenEnMemoria() }).consultar({ tenant: T, encargo: clon(caso.encargo) }); tamA.push([bytes(compactarParaAnfitrion("consultar", r)), caso.id]); }
  tamA.sort((a, b) => a[0] - b[0]);
  console.log(`   · consultar compacta, brazo A: mediana ${(tamA[tamA.length >> 1][0] / 1024).toFixed(1)} KB · MÁXIMO ${tamA[tamA.length - 1][0]} B (${tamA[tamA.length - 1][1]})`);
  ok(tamA[tamA.length - 1][0] <= 20 * 1024, `★ COMPACIDAD (A): consultar compacta ≤ 20 KB en los ${tamA.length} encargos; máximo ${tamA[tamA.length - 1][0]} B`);
  /* y lo que pagó el alcance: el brazo B no engorda la mediana más de lo que ahorra la cabecera de cuatro reglas */
  ok(tam[tam.length >> 1][0] - tamA[tamA.length >> 1][0] < 800, `la mediana del brazo B crece menos de 800 B respecto de la del A (${tam[tam.length >> 1][0] - tamA[tamA.length >> 1][0]} B)`);
}

/* ═══ 3b · LA BATERÍA GENERADA · eje × métrica × forma, en demo y Río Claro v1/v2 ═════════════════════════════════════════════════════════════════════════════════════════════════════════ */
H("3b · BRAZO B · batería generada (eje × métrica × forma) contra el oráculo independiente, en demo y Río Claro v1/v2");
const PARES = [   /* (tema, eje, métricas pedidas, métrica que ordena) */
  ["comercial", "cliente", ["ventas", "margen"], "ventas"], ["comercial", "cliente", ["ventas", "margen", "contribucion"], "margen"], ["cobranza", "cliente", ["saldo_vencido", "dias_vencido", "saldo_pendiente"], "saldo_vencido"], ["cobranza", "cliente", ["dias_vencido", "saldo_vencido"], "dias_vencido"],
  ["comercial", "marca", ["ventas", "margen"], "ventas"], ["comercial", "marca", ["margen", "contribucion"], "margen"], ["comercial", "familia", ["ventas", "contribucion"], "contribucion"],
  ["comercial", "sku", ["ventas", "margen"], "margen"], ["inventario", "sku", ["capital", "dias_inventario", "rotacion"], "capital"], ["inventario", "sku", ["dias_inventario", "capital"], "dias_inventario"], ["inventario", "bodega", ["capital", "unidades_stock"], "capital"],
  ["comercial", "canal", ["ventas", "contribucion"], "ventas"],
];
{
  brazo("1");
  const nivelB = {};
  const viol = [];
  let corridas = 0, conAlgo = 0;
  for (const { etiqueta, T } of EMPRESAS) {
    initTenant(T.dataset);
    const O = oraculo(T);
    for (const [tema, eje, conceptos, ordena] of PARES) {
      const N = O.roster[eje].length;
      const base = { id: "p1", tema, cierre: "cifra", conceptos, eje };
      const formas = [
        ["completo", { universo: { eje } }],
        ["top 1 mayor", { universo: { eje, top: { metrica: ordena, k: 1, direccion: "mayor" } } }],
        ["top 3 mayor", { universo: { eje, top: { metrica: ordena, k: Math.min(3, N - 1), direccion: "mayor" } } }],
        ["top 2 menor", { universo: { eje, top: { metrica: ordena, k: 2, direccion: "menor" } } }],
        ["nombradas", { entidades: O.roster[eje].slice(0, 2).map((nombre) => ({ nombre })) }],
      ];
      const vals = O.valor(eje, ordena);
      if (vals) { const ord = [...vals.values()].sort((a, b) => a - b); const med = ord[ord.length >> 1]; formas.push(["filtro > mediana", { universo: { eje, filtros: [{ metrica: ordena, op: ">", valor: med }] } }]); }
      for (const [forma, extra] of formas) {
        const store = crearAlmacenEnMemoria();
        const A = crearAcciones({ continuidad: store });
        const r = await A.consultar({ tenant: T, encargo: { version: "encargo/v1", partes: [{ ...base, ...extra }] } });
        corridas++;
        if (!r.ok) continue;
        conAlgo++;
        const c = compactarParaAnfitrion("consultar", r);
        const libro = await store.leerLibro(T.id, r.continuidad.conversacionId);
        const vv = verificarConsulta({ r, c, libro, O, nivel: nivelB, encargo: { version: "encargo/v1", partes: [{ ...base, ...extra }] } });
        if (vv.length) viol.push(`${etiqueta} ${eje}/${ordena}/${forma}: ${vv.slice(0, 2).join(" ; ")}`);
      }
    }
  }
  ok(conAlgo >= 150 && viol.length === 0, `★ ${conAlgo} consultas generadas (de ${corridas}) en 3 empresas: el alcance es completo y verdadero`, viol.slice(0, 4).join(" || "));
  console.log(`   · ${nivelB.topsVerificados || 0} tops, ${nivelB.filtrosVerificados || 0} filtros y ${nivelB.tablasConOraculo || 0} tablas ordenadas recomputadas de forma independiente`);
  ok((nivelB.topsVerificados || 0) >= 80 && (nivelB.filtrosVerificados || 0) >= 20 && (nivelB.tablasConOraculo || 0) >= 50, "la batería recomputa de forma independiente ≥ 80 tops, ≥ 20 filtros y ≥ 50 tablas ordenadas");
  /* los 532 sellados se repiten sobre Río Claro v1 y v2: el alcance es completo y verdadero también ahí (los nombres cambian, no las formas) */
  let nRC = 0; const violRC = [];
  for (const { etiqueta, T } of EMPRESAS.slice(1)) {
    initTenant(T.dataset);
    const O = oraculo(T);
    for (const caso of MUESTRA.filter((_, i) => i % 5 === 0)) {
      const store = crearAlmacenEnMemoria();
      const A = crearAcciones({ continuidad: store });
      const e = clon(caso.encargo);
      const r = await A.consultar({ tenant: T, encargo: e });
      if (!r.ok) continue;
      nRC++;
      const c = compactarParaAnfitrion("consultar", r);
      const libro = await store.leerLibro(T.id, r.continuidad.conversacionId);
      const vv = verificarConsulta({ r, c, libro, O, nivel: {}, encargo: e });
      if (vv.length) violRC.push(`${etiqueta} ${caso.id}: ${vv.slice(0, 2).join(" ; ")}`);
    }
  }
  ok(nRC > 100 && violRC.length === 0, `★ ${nRC} de los 532 encargos repetidos sobre Río Claro v1 y v2 (nombres y cifras distintos): alcance completo y verdadero`, violRC.slice(0, 3).join(" || "));
  initTenant(TENANT_DEMO);
}

/* ═══ 4 · LO ESTABLECIDO · una conversación entera, en demo y Río Claro, con cada acción ══════════════════════════════════════════════════════════════════════════════════════════════════ */
H("4 · LO ESTABLECIDO · en toda respuesta de una conversación (consultar · derivar · aportarContexto · retomar · conocerEmpresa): cada línea resuelve al libro y dice la verdad");
function verificarEstablecido({ est, libro, O, T, conMarco = null, etiqueta, cabecera = false }) {
  const v = [];
  if (!est) return [`${etiqueta}: no trae establecido`];
  if (bytes(est) > ESTABLECIDO_TOPE_BYTES) v.push(`${etiqueta}: pesa ${bytes(est)} B (> ${ESTABLECIDO_TOPE_BYTES})`);
  const extra = Object.keys(est).filter((k) => !["universos", "ordenes", "extremos", "relaciones", "criterios", "memoria"].includes(k));
  if (extra.length) v.push(`${etiqueta}: campos desconocidos ${extra.join(",")}`);
  const entregas = new Map(libro.entregas.filter((x) => !x.recortada).map((x) => [x.n, x]));
  const universoDe = (id) => { const m = /^E(\d+)\.u(\d+)$/.exec(id); const e = m && entregas.get(Number(m[1])); return e && e.universos[Number(m[2]) - 1] ? { e, u: e.universos[Number(m[2]) - 1] } : null; };
  /* LEY DEL DIGESTO: ninguna lista parcial de nombres (solo el extremo, que es UN hecho con su id) */
  const nombres = Object.values(O.roster).flat();
  for (const k of ["universos", "ordenes", "relaciones", "criterios"]) for (const l of est[k] || []) if (nombres.some((nom) => nom.length > 3 && l.includes(nom))) v.push(`${etiqueta}: ${k} lista un nombre de entidad («${l}»): una lista parcial de nombres sin su «k de N»`);
  for (const l of est.universos || []) {
    const m = /^(E\d+\.u\d+)(?:–E\d+\.u(\d+))? (.+) \((\d+) de (\d+)( cada una)?\)$/.exec(l);
    if (m) {
      const x = universoDe(m[1]);
      if (!x) { v.push(`${etiqueta}: «${l}» no resuelve a un universo del libro`); continue; }
      const N = O.roster[x.u.eje] ? O.roster[x.u.eje].length : null;
      if (!m[6] && (Number(m[4]) !== x.u.entidades.length || Number(m[5]) !== N)) v.push(`${etiqueta}: «${l}» y el libro dice ${x.u.entidades.length} de ${N}`);
      const t = tipoEsperado({ ...x.u, ejeN: N }, N);
      const prefijo = { top: /^top \d+/, filtro: /^filtro /, estado: /^estado /, nombradas: /^nombradas$/, completo: /^completo$/ }[t];
      if (!prefijo || !prefijo.test(m[3])) v.push(`${etiqueta}: «${l}» y la regla del libro es «${t}»`);
    } else if (!/^\+\d+ de Entregas anteriores: retomar las trae$/.test(l)) v.push(`${etiqueta}: línea de universos ilegible «${l}»`);
  }
  for (const l of est.ordenes || []) {
    const m = /^(E\d+\.h\d+(?:–E\d+\.h\d+)?(?: y E\d+\.h\d+(?:–E\d+\.h\d+)?)*) por (.+), (de mayor a menor|de menor a mayor) \((\d+) de (\d+)\)$/.exec(l);
    const p = /^(E\d+\.u\d+) prioridad por (.+) \((\d+) de (\d+)\)$/.exec(l);
    if (m) {
      const ids = idsDe(m[1]); const n = Number(/^E(\d+)/.exec(m[1])[1]);
      const e = entregas.get(n); const porId = new Map(((e && e.hechos) || []).map((h) => [h.id, h]));
      if (!ids || !e || !ids.every((id) => porId.has(id))) { v.push(`${etiqueta}: «${l}» no resuelve a hechos del libro`); continue; }
      const ents = [], ser = new Map();
      for (const id of ids) { const h = porId.get(id), rv = h.rv || {}; const cel = (rv.metrica ? [{ l: rv.metrica, raw: rv.raw }, ...(rv.mas || []).map((q) => ({ l: q.metrica, raw: q.raw }))] : [{ l: h.metrica, raw: rv.raw }]).find((q) => q.l === m[2]); const s = h.sujeto || rv.sujeto; if (s && cel && O.ejeDe(s)) { if (!ents.includes(s)) ents.push(s); ser.set(s, cel.raw); } }
      const dir = sentidoDe(ents.map((x) => ser.get(x)));
      if (dir !== (m[3] === "de mayor a menor" ? "mayor-a-menor" : "menor-a-mayor")) v.push(`${etiqueta}: «${l}» y la serie del libro es ${dir}`);
      if (ents.length !== Number(m[4])) v.push(`${etiqueta}: «${l}» y son ${ents.length} entidades`);
    } else if (p) {
      const x = universoDe(p[1]);
      if (!x || !x.u.orden || x.u.entidades.length !== Number(p[3])) v.push(`${etiqueta}: «${l}» no es una prioridad del libro con ${p[3]} puestos`);
    } else if (!/^\+\d+ de Entregas anteriores: retomar las trae$/.test(l)) v.push(`${etiqueta}: línea de órdenes ilegible «${l}»`);
  }
  for (const l of est.extremos || []) {
    const m = /^(mayor|menor|peor|mejor) (.+): (.+?)(?: (E\d+\.h\d+))? \(sobre (\d+)\)$/.exec(l);
    if (!m) { if (!/^\+\d+ de Entregas anteriores: retomar las trae$/.test(l)) v.push(`${etiqueta}: línea de extremos ilegible «${l}»`); continue; }
    if (m[4]) {
      const n = Number(/^E(\d+)/.exec(m[4])[1]); const h = (entregas.get(n) || { hechos: [] }).hechos.find((q) => q.id === m[4]);
      if (!h || h.sujeto !== m[3]) { v.push(`${etiqueta}: «${l}»: ese id no es de ${m[3]} en el libro`); continue; }
      /* el extremo del EJE ENTERO contra la recomputación independiente */
      const clave = (h.rv || {}).clave, eje = O.ejeDe(m[3]);
      const vals = eje && clave ? O.valor(eje, clave) : null;
      if (vals && (m[1] === "mayor" || m[1] === "menor")) {
        const val = vals.get(m[3]); const todos = [...vals.values()];
        const mejor = m[1] === "mayor" ? Math.max(...todos) : Math.min(...todos);
        if (!cercano(val, mejor) || Number(m[5]) !== O.roster[eje].length) v.push(`${etiqueta}: «${l}» y el ${m[1]} del eje entero (${O.roster[eje].length}) es ${mejor} (esa entidad tiene ${val})`);
        else v.push.apply(v, []);
      }
    } else if (!O.ejeDe(m[3])) v.push(`${etiqueta}: «${l}»: ${m[3]} no es una entidad del tenant`);
  }
  for (const l of est.relaciones || []) {
    const m = /^(D\d+) coincidencia .+: (\d+ de \d+)$/.exec(l);
    const d = m && (libro.derivaciones || []).find((q) => q.id === m[1]);
    if (!d || d.operacion !== "coincidencia" || d.resultado.texto !== m[2]) v.push(`${etiqueta}: «${l}» no es una coincidencia del libro con ese resultado`);
  }
  /* los criterios: contra el perfil del tenant (y lo que la empresa declaró) y contra el Marco de la Entrega */
  const perfil = T.dataset.perfil || {};
  const lineas = est.criterios || [];
  const dicho = new Map();
  for (const l of lineas) {
    const m = /^(declarado por la empresa|general de ADI|planteado en la consulta): (.+)$/.exec(l);
    if (m) for (const par of m[2].split(" · ")) { const q = /^(.+?) (-?[\d.,]+)(%| días|x| pp|[A-Za-z]*)$/.exec(par); if (q) dicho.set(q[1], { valor: Number(q[2].replace(",", ".")), origen: m[1], texto: par }); }
    else if (!/^sin declarar: /.test(l)) v.push(`${etiqueta}: línea de criterios ilegible «${l}»`);
  }
  const ESPERADO = [["Benchmark de margen", "benchmark"], ["Nivel de referencia de carga", "targetCarga"], ["Piso de rotación", "rotacionMin"], ["Techo de cobertura", "dohMax"]];
  for (const [rotulo, llave] of ESPERADO) {
    const d = dicho.get(rotulo);
    if (typeof perfil[llave] === "number") {
      if (!d || d.origen !== "declarado por la empresa" || !cercano(d.valor, perfil[llave])) v.push(`${etiqueta}: «${rotulo}» debe ser ${perfil[llave]} declarado por la empresa (perfil del tenant): dice ${d && d.texto} / ${d && d.origen}`);
    } else if (d && d.origen === "declarado por la empresa" && !cabecera) v.push(`${etiqueta}: «${rotulo}» figura declarado por la empresa y el perfil del tenant no lo trae`);
  }
  if (conMarco) {   /* el Marco de la Entrega imprime «Benchmark de margen: 30.1%, declarado por la empresa.»: es el MISMO valor y el mismo origen */
    const m = /^(.+?): (-?[\d.,]+)%?(?:, | )(declarado por la empresa|criterio general de ADI[^.]*)\.?$/.exec(String(conMarco));
    if (m) { const d = dicho.get(m[1]); if (!d || !cercano(d.valor, Number(m[2].replace(",", "."))) || (d.origen === "declarado por la empresa") !== (m[3] === "declarado por la empresa")) v.push(`${etiqueta}: el Marco dice «${conMarco}» y establecido dice ${d && d.texto} (${d && d.origen})`); }
    else v.push(`${etiqueta}: no pude leer el Marco «${conMarco}»`);
  }
  /* la memoria */
  const vivas = libro.entregas.filter((x) => !x.recortada);
  const m = /^(íntegra|recortada \(.*\)) · (\d+) Entregas? · (\d+) cifras · esta respuesta: (completa|página \d+ de \d+, faltan \d+ hechos?)$/.exec(est.memoria || "");
  if (!m || Number(m[2]) !== vivas.length || Number(m[3]) !== vivas.reduce((a, x) => a + x.hechos.length, 0)) v.push(`${etiqueta}: memoria «${est.memoria}» y el libro tiene ${vivas.length} Entregas / ${vivas.reduce((a, x) => a + x.hechos.length, 0)} cifras`);
  return v;
}
const escenarios = {};
{
  brazo("1");
  const violE = [];
  let respuestas = 0, conExtremo = 0, conRelacion = 0, conOrdenes = 0, conUniversos = 0;
  for (const { etiqueta, T } of EMPRESAS) {
    initTenant(T.dataset);
    const O = oraculo(T);
    const store = crearAlmacenEnMemoria();
    const A = crearAcciones({ continuidad: store });
    const eje = "cliente";
    const E = (...partes) => ({ version: "encargo/v1", partes: partes.map((p, i) => ({ id: `p${i + 1}`, ...p })) });
    let cid = null, Tvig = T;   /* `Tvig`: el tenant con lo que la empresa lleva declarado (cambia cuando confirma un criterio) */
    const registrar = async (que, r, c) => {
      const conv = cid || (r.continuidad && r.continuidad.conversacionId) || r.conversacionId; cid = cid || conv;
      const libro = await store.leerLibro(T.id, conv);
      const est = c.establecido;
      respuestas++;
      if (est) { if (est.extremos) conExtremo++; if (est.relaciones) conRelacion++; if (est.ordenes) conOrdenes++; if (est.universos) conUniversos++; }
      const marco = c.entrega && c.entrega.marco ? c.entrega.marco.referencia : null;
      const vv = verificarEstablecido({ est, libro, O, T: Tvig, conMarco: marco, etiqueta: `${etiqueta} · ${que}` });
      if (vv.length) violE.push(...vv);
      escenarios[`${etiqueta}|${que}`] = { r, c, libro };
      return libro;
    };
    const paso = async (que, encargo) => { const r = await A.consultar({ tenant: T, encargo: cid ? { ...encargo, conversacionId: cid } : encargo }); const c = compactarParaAnfitrion("consultar", r); await registrar(que, r, c); return { r, c }; };
    const a1 = await paso("consultar top 3 saldo vencido", E({ tema: "cobranza", cierre: "cifra", conceptos: ["saldo_vencido", "dias_vencido", "saldo_pendiente"], eje, universo: { eje, top: { metrica: "saldo_vencido", k: 3, direccion: "mayor" } } }));
    const a2 = await paso("consultar filtro días > 90", E({ tema: "cobranza", cierre: "cifra", conceptos: ["dias_vencido", "saldo_vencido"], eje, universo: { eje, filtros: [{ metrica: "dias_vencido", op: ">", valor: 90 }] } }));
    const a3 = await paso("consultar completo ventas+margen", E({ tema: "comercial", cierre: "cifra", conceptos: ["ventas", "margen"], eje, universo: { eje } }));
    const a4 = await paso("consultar el mayor por venta (extremo)", E({ tema: "comercial", cierre: "cifra", conceptos: ["ventas", "margen"], eje, universo: { eje, top: { metrica: "ventas", k: 1, direccion: "mayor" } } }));
    const a5 = await paso("consultar nombradas", E({ tema: "comercial", cierre: "cifra", conceptos: ["ventas"], eje, entidades: O.roster.cliente.slice(0, 2).map((nombre) => ({ nombre })) }));
    /* derivar: una coincidencia entre dos órdenes y una suma */
    const d1 = await A.derivar({ tenant: T, conversacionId: cid, operacion: "coincidencia", eje, a: { metrica: "ventas", direccion: "mayor", k: 3 }, b: { metrica: "saldo_vencido", direccion: "mayor", k: 3 } });
    await registrar("derivar coincidencia", d1, compactarParaAnfitrion("derivar", d1));
    const ids = a1.c.entrega.cifras.filter((x) => x.entidad).slice(0, 2).map((x) => x.id);
    const d2 = await A.derivar({ tenant: T, conversacionId: cid, operacion: "suma", sobre: ids });
    await registrar("derivar suma", d2, compactarParaAnfitrion("derivar", d2));
    const d3 = await A.derivar({ tenant: T, conversacionId: cid, operacion: "suma", sobre: ["E9.h99"] });
    await registrar("derivar rechazado", d3, compactarParaAnfitrion("derivar", d3));
    /* aportarContexto: el benchmark propio, confirmado: los criterios del digesto cambian */
    const ap = await A.aportarContexto({ tenant: T, conversacionId: cid, aportes: [{ clase: "criterio", concepto: "benchmark", valor: 28, unidad: "pct" }] });
    const idAporte = (ap.resultados || []).find((x) => x.id) && ap.resultados.find((x) => x.id).id;
    const ap2 = await A.aportarContexto({ tenant: T, conversacionId: cid, confirmar: idAporte ? [idAporte] : [] });
    const cAp2 = compactarParaAnfitrion("aportarContexto", ap2);
    ok(idAporte && ap2.ok && /Benchmark de margen 28%/.test((cAp2.establecido.criterios || []).join(" ")) && /declarado por la empresa: .*Benchmark de margen 28%/.test((cAp2.establecido.criterios || []).join(" ")), `★ (${etiqueta}) aportarContexto confirmado: el digesto de ESA respuesta ya dice «Benchmark de margen 28% · declarado por la empresa»`, jj(cAp2.establecido && cAp2.establecido.criterios));
    const Tdecl = { ...T, dataset: { ...T.dataset, perfil: { ...(T.dataset.perfil || {}), benchmark: 28 } } };
    Tvig = Tdecl;
    const libroAp = await store.leerLibro(T.id, cid);
    const vAp = verificarEstablecido({ est: cAp2.establecido, libro: libroAp, O, T: Tdecl, etiqueta: `${etiqueta} · aportarContexto`, cabecera: true });
    if (vAp.length) violE.push(...vAp);
    respuestas++;
    /* la consulta siguiente: el Marco imprime el benchmark declarado y el digesto lo repite */
    const a6 = await paso("consultar margen con el benchmark declarado", E({ tema: "comercial", cierre: "cifra", conceptos: ["margen"], eje, universo: { eje, top: { metrica: "margen", k: 3, direccion: "menor" } } }));
    ok(/28/.test(a6.c.entrega.marco.referencia || "") && /declarado por la empresa/.test(a6.c.entrega.marco.referencia || "") && /Benchmark de margen 28%/.test((a6.c.establecido.criterios || []).join(" ")), `★ (${etiqueta}) el Marco de la Entrega y lo establecido dicen lo mismo del benchmark (28 %, declarado por la empresa)`, `${a6.c.entrega.marco.referencia} | ${jj(a6.c.establecido.criterios)}`);
    /* retomar (página 1) y conocerEmpresa con conversación */
    const rr = await A.retomar({ tenant: T, conversacionId: cid });
    await registrar("retomar", rr, compactarParaAnfitrion("retomar", rr));
    const ce = await A.conocerEmpresa({ tenant: T, conversacionId: cid });
    await registrar("conocerEmpresa con conversación", ce, compactarParaAnfitrion("conocerEmpresa", ce));
    escenarios[`${etiqueta}|cid`] = cid;
  }
  ok(violE.length === 0, `★ en las ${respuestas} respuestas de las conversaciones (3 empresas × consultar · derivar · aportarContexto · retomar · conocerEmpresa): cada línea de lo establecido resuelve al libro y dice la verdad`, violE.slice(0, 4).join(" || "));
  ok(conUniversos > 0 && conExtremo > 0 && conRelacion > 0 && conOrdenes > 0, `el digesto cubrió las cinco clases de línea (universos ${conUniversos} · órdenes ${conOrdenes} · extremos ${conExtremo} · relaciones ${conRelacion})`);
  /* TODA acción trae `establecido` cuando hay libro */
  const claves = Object.keys(escenarios).filter((k) => !k.endsWith("|cid"));
  ok(claves.every((k) => escenarios[k].c.establecido), "★ `establecido` viaja en TODA respuesta con libro: consultar · derivar (también el rechazo y la coincidencia) · aportarContexto · retomar · conocerEmpresa");
  const orden = (c) => Object.keys(c).filter((k) => ["ok", "memoria", "establecido", "entrega"].includes(k)).join(",");
  ok(orden(escenarios["demo|consultar top 3 saldo vencido"].c) === "ok,memoria,establecido,entrega", "en `consultar` el digesto va junto a `memoria` y ANTES de la Entrega");
  const ex = escenarios["demo|consultar el mayor por venta (extremo)"].c.establecido;
  ok((ex.extremos || []).some((l) => /^mayor Venta: Falabella E\d+\.h\d+ \(sobre 13\)$/.test(l)),"★ el extremo del eje entero con su id: «mayor Venta: Falabella E4.h1 (sobre 13)»", jj(ex));
  const ex2 = escenarios["demo|derivar suma"].c.establecido;
  ok(!!ex2.extremos && ex2.relaciones && ex2.relaciones.length === 1 && /^D1 coincidencia los 3 de mayor venta × los 3 de mayor saldo vencido: \d de 3$/.test(ex2.relaciones[0]), "la coincidencia pedida queda establecida: «D1 coincidencia … : k de 3»", jj(ex2.relaciones));
  const dd = escenarios["demo|derivar rechazado"].c;
  ok(dd.ok === false && dd.establecido && dd.memoria, "un `derivar` rechazado también trae lo establecido");
  /* el digesto no engorda sin tope: una conversación larga queda en 1 KB y dice cuánto cedió */
  const store = crearAlmacenEnMemoria(); const A = crearAcciones({ continuidad: store });
  initTenant(TENANT_DEMO);
  let cid = null, ultimo = null;
  for (let i = 0; i < 9; i++) { const r = await A.consultar({ tenant: EMPRESAS[0].T, encargo: { version: "encargo/v1", ...(cid ? { conversacionId: cid } : {}), partes: [{ id: "p1", tema: "comercial", cierre: "cifra", conceptos: ["ventas", "margen"], eje: "cliente", universo: { eje: "cliente", top: { metrica: i % 2 ? "margen" : "ventas", k: 2 + (i % 3), direccion: "mayor" } } }] } }); cid = cid || r.continuidad.conversacionId; ultimo = compactarParaAnfitrion("consultar", r); }
  ok(bytes(ultimo.establecido) <= ESTABLECIDO_TOPE_BYTES && /^\+\d+ de Entregas anteriores: retomar las trae$/.test((ultimo.establecido.universos || ultimo.establecido.extremos || [])[0] || ""), `★ con 9 Entregas el digesto sigue ≤ 1 KB (${bytes(ultimo.establecido)} B) y DICE cuánto cedió («+k de Entregas anteriores»): nunca una lista parcial en silencio`, jj(ultimo.establecido));
  const memo = ultimo.establecido.memoria;
  ok(/íntegra · 9 Entregas · \d+ cifras · esta respuesta: completa/.test(memo), "…y la memoria cuenta TODAS las Entregas que conserva, no solo las del digesto", memo);
}

/* ═══ 5 · SUFICIENCIA Y RETOMAR ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════ */
H("5 · suficiencia: en la MISMA respuesta está lo que el anfitrión necesita para no completar (el caso C02|1|6 y A02|1|5)");
{
  brazo("1");
  const { c } = escenarios["rioclaro v1|consultar top 3 saldo vencido"];
  const u = c.entrega.universos[0];
  ok(u.cobertura === "3 de 13" && u.seleccion.tipo === "top" && u.metricas["Días vencido"] === "solo de estos 3; el resto no evaluado" && u.metricas["Saldo vencido"].startsWith("ordenada sobre los 13") && u.resto.n === 10 && u.resto.evaluado === false, "★ C02|1|6: los 3 de mayor saldo vencido dicen que los DÍAS son «solo de estos 3; el resto no evaluado» y que 10 no se evaluaron — en la misma respuesta", jj(u));
  const f = escenarios["rioclaro v1|consultar filtro días > 90"].c;
  const uf = f.entrega.universos[0];
  ok(uf.seleccion.tipo === "filtro" && uf.metricas["Días vencido"] === "evaluada sobre los 13" && uf.metricas["Saldo vencido"] === "solo de estos 3; el resto no evaluado" && uf.resto.evaluado === true, "★ B01 2.7: el filtro días > 90 es «evaluado sobre los 13»; el saldo vencido de los otros NO está evaluado — «los que sí tienen vencido» queda sin base", jj(uf));
  const t = escenarios["demo|consultar completo ventas+margen"].c;
  ok(t.entrega.tablas.length === 1 && lista(t.entrega.tablas[0].ordenadaPor) && t.entrega.tablas[0].ordenadaPor[0] === "Venta" && t.entrega.tablas[0].soloMostradas.join() === "Margen" && /13 de 13/.test(t.entrega.tablas[0].orden), "★ 10·A01 1.6 / 12·B01 1.5: la tabla completa está ordenada por Venta; el Margen es «solo mostrada»: la relación entre los dos órdenes NO está evaluada", jj(t.entrega.tablas));
  const crit = escenarios["demo|consultar top 3 saldo vencido"].c.establecido.criterios.join(" ");
  ok(/Benchmark de margen 30\.1%/.test(crit), "★ 12·A02 1.5 («hoy no hay ningún benchmark cargado»): la respuesta trae el benchmark de margen 30.1 % con su origen aunque la conversación nunca consultó margen", crit);
  const r = escenarios["demo|retomar"].c;
  ok(r.pagina && r.establecido.memoria.endsWith(r.pagina.completa ? "esta respuesta: completa" : `página ${r.pagina.k} de ${r.pagina.de}, faltan ${r.memoria.estaRespuesta.match(/faltan (\d+)/)[1]} hechos`), "`retomar`: la incompletitud de la respuesta va en `establecido.memoria` y en `memoria.estaRespuesta`");
}

/* ═══ 6 · LAS HERRAMIENTAS NO CRECEN ═══════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════ */
H("6 · las descripciones de las herramientas no crecen (el mecanismo vive en las respuestas)");
{
  const tool = (n) => MCP_TOOLS.find((t) => t.name === n);
  const tD = jj(tool("derivar")).length, tC = jj(tool("consultar")).length, g = jj(guiaDeUniverso()).length;
  console.log(`   · derivar ${tD}/2400 B · consultar ${tC} B · catalogo.universo ${g}/3500 B · retomar ${jj(tool("retomar")).length} B`);
  ok(tD < 2400 && tD <= 2393, `★ \`derivar\` no crece (${tD} B ≤ 2393; tope 2400)`);
  ok(tC <= 2231, `★ \`consultar\` no crece (${tC} B ≤ 2231)`);
  ok(g < 3500 && g <= 3486, `★ \`catalogo.universo\` no crece (${g} B ≤ 3486; tope 3500)`);
}

/* ═══ 7 · CARNADAS ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════ */
H("7 · carnadas · un alcance con UN defecto se pone en rojo");
{
  brazo("1");
  const T = EMPRESAS[0].T; initTenant(TENANT_DEMO); const O = oraculo(T);
  const store = crearAlmacenEnMemoria(); const A = crearAcciones({ continuidad: store });
  const E = (p) => ({ version: "encargo/v1", partes: [{ id: "p1", ...p }] });
  const casos = {};
  for (const [nombre, p] of Object.entries({
    top: { tema: "cobranza", cierre: "cifra", conceptos: ["saldo_vencido", "dias_vencido", "saldo_pendiente"], eje: "cliente", universo: { eje: "cliente", top: { metrica: "saldo_vencido", k: 3, direccion: "mayor" } } },
    filtro: { tema: "cobranza", cierre: "cifra", conceptos: ["dias_vencido", "saldo_vencido"], eje: "cliente", universo: { eje: "cliente", filtros: [{ metrica: "dias_vencido", op: ">", valor: 90 }] } },
    completo: { tema: "comercial", cierre: "cifra", conceptos: ["ventas", "margen"], eje: "cliente", universo: { eje: "cliente" } },
  })) {
    const r = await A.consultar({ tenant: T, encargo: E(p) });
    const c = compactarParaAnfitrion("consultar", r);
    casos[nombre] = { r, c, libro: await store.leerLibro(T.id, r.continuidad.conversacionId) };
    ok(verificarConsulta({ ...casos[nombre], O }).length === 0, `control: el alcance real de «${nombre}» pasa la verificación (lo sano no se acusa)`);
  }
  const MUT = {
    "cobertura con k de más (4 de 13)": ["top", (c) => { c.entrega.universos[0].cobertura = "4 de 13"; }],
    "N equivocado (3 de 12)": ["top", (c) => { c.entrega.universos[0].cobertura = "3 de 12"; }],
    "selección que no es la declarada (filtro)": ["top", (c) => { c.entrega.universos[0].seleccion = { tipo: "filtro" }; }],
    "selección fuera de la lista cerrada": ["top", (c) => { c.entrega.universos[0].seleccion = { tipo: "casi-top" }; }],
    "k del top equivocado": ["top", (c) => { c.entrega.universos[0].seleccion.k = 5; }],
    "olvida el resto": ["top", (c) => { delete c.entrega.universos[0].resto; }],
    "el resto de un top dice «evaluado»": ["top", (c) => { c.entrega.universos[0].resto.evaluado = true; }],
    "el resto cuenta mal (9 en vez de 10)": ["top", (c) => { c.entrega.universos[0].resto.n = 9; }],
    "dice ordenada una métrica que solo se muestra": ["top", (c) => { c.entrega.universos[0].metricas["Días vencido"] = c.entrega.universos[0].metricas["Saldo vencido"]; }],
    "olvida decir qué métrica está solo mostrada": ["top", (c) => { delete c.entrega.universos[0].metricas; }],
    "«solo de estos 5» (k mal)": ["top", (c) => { c.entrega.universos[0].metricas["Días vencido"] = "solo de estos 5; el resto no evaluado"; }],
    "dirección del orden invertida": ["top", (c) => { c.entrega.universos[0].orden = c.entrega.universos[0].orden.replace("de mayor a menor", "de menor a mayor"); }],
    "la métrica de un filtro dicha «solo de estos»": ["filtro", (c) => { c.entrega.universos[0].metricas["Días vencido"] = "solo de estos 3; el resto no evaluado"; }],
    "el resto de un filtro dicho «no evaluado»": ["filtro", (c) => { c.entrega.universos[0].resto.evaluado = false; }],
    "la condición del filtro cambia (> 100)": ["filtro", (c) => { c.entrega.universos[0].seleccion.condiciones[0].valor = 100; }],
    "tabla ordenada por la métrica equivocada": ["completo", (c) => { c.entrega.tablas[0] = { ...c.entrega.tablas[0], orden: c.entrega.tablas[0].orden.replace("Venta", "Margen"), ordenadaPor: ["Margen"], soloMostradas: ["Venta"] }; }],
    "tabla con la dirección invertida": ["completo", (c) => { c.entrega.tablas[0].orden = c.entrega.tablas[0].orden.replace("de mayor a menor", "de menor a mayor"); }],
    "tabla que deja una cifra sin cubrir": ["completo", (c) => { c.entrega.tablas[0].cifras = c.entrega.tablas[0].cifras.replace(/E(\d+)\.h24/, "E$1.h23"); }],
    "vuelve `n` y `parcial`": ["top", (c) => { c.entrega.universos[0].n = 3; c.entrega.universos[0].parcial = "3 de 13"; }],
    "vuelve el mecanismo de texto (`alcance`)": ["top", (c) => { c.entrega.alcance = { profundidad: "completa" }; }],
    "olvida `establecido`": ["top", (c) => { delete c.establecido; }],
    "la cabecera vuelve a cinco reglas": ["top", (c) => { c.uso = [...CABECERA_DE_USO]; }],
    "`metricas` repetido en un universo completo": ["completo", (c) => { c.entrega.universos[0].metricas = { Venta: "evaluada sobre los 13" }; }],
  };
  for (const [nombre, [donde, mutar]] of Object.entries(MUT)) {
    const base = casos[donde];
    const c = clon(base.c); mutar(c);
    const viol = verificarConsulta({ r: base.r, c, libro: base.libro, O });
    ok(viol.length > 0, `★ CARNADA «${nombre}»: la verificación se pone roja`, viol.slice(0, 1).join(""));
  }
  /* establecido: líneas falsas */
  const base = escenarios["demo|derivar suma"];
  const arma = (f) => { const est = clon(base.c.establecido); f(est); return verificarEstablecido({ est, libro: base.libro, O, T: EMPRESAS[0].T, etiqueta: "carnada" }); };
  ok(arma(() => {}).length === 0, "control: el digesto real pasa");
  for (const [nombre, f] of Object.entries({
    "un universo con cobertura equivocada": (e) => { e.universos[0] = e.universos[0].replace(/\((\d+) de/, "(9 de"); },
    "un universo que no existe en el libro": (e) => { e.universos.push("E9.u1 completo (13 de 13)"); },
    "una lista parcial de nombres": (e) => { e.universos.push("E1.u1 completo (13 de 13) con Falabella y Lider"); },
    "un extremo que no es el del eje": (e) => { e.extremos = ["mayor Venta: Jumbo E4.h1 (sobre 13)"]; },
    "un extremo sobre N equivocado": (e) => { e.extremos = ["mayor Venta: Falabella E4.h1 (sobre 12)"]; },
    "una relación que no existe": (e) => { e.relaciones = ["D7 coincidencia los 3 de mayor venta × los 3 de menor margen: 2 de 3"]; },
    "una relación con otro resultado": (e) => { e.relaciones = [e.relaciones[0].replace(/: \d de 3$/, ": 0 de 3")]; },
    "un benchmark que no es el del perfil": (e) => { e.criterios = e.criterios.map((l) => l.replace("30.1%", "25%")); },
    "un criterio declarado por la empresa presentado como general de ADI": (e) => { e.criterios = e.criterios.map((l) => l.replace(/^declarado por la empresa: /, "general de ADI: ")); },
    "una memoria que cuenta mal": (e) => { e.memoria = e.memoria.replace(/· \d+ Entregas?/, "· 1 Entrega"); },
    "un orden con la dirección invertida": (e) => { e.ordenes = e.ordenes.map((l) => l.replace("de mayor a menor", "de menor a mayor")); },
    "pasa de 1 KB": (e) => { e.universos = Array.from({ length: 30 }, (_, i) => `E1.u${i + 1} completo (13 de 13)`); },
  })) {
    const viol = arma(f);
    ok(viol.length > 0, `★ CARNADA «${nombre}»: la verificación de lo establecido se pone roja`, viol.slice(0, 1).join(""));
  }
}

/* ═══ 8 · conocerEmpresa: el valor VIGENTE de cada criterio ═══════════════════════════════════════════════════════════════════════════════════════════════════════════════════════ */
H("8 · conocerEmpresa: `vigente` (valor y origen) de cada criterio declarable, y cambia cuando la empresa declara");
{
  brazo("1");
  for (const { etiqueta, T } of EMPRESAS.slice(0, 2)) {
    initTenant(T.dataset);
    const A = crearAcciones({ continuidad: crearAlmacenEnMemoria() });
    const ce = compactarParaAnfitrion("conocerEmpresa", await A.conocerEmpresa({ tenant: T }));
    const cs = ce.declarable.criterios;
    const bm = cs.find((x) => x.concepto === "benchmark");
    const P = T.dataset.perfil || {};
    ok(bm && bm.vigente && bm.vigente.valor === `${P.benchmark}%` && bm.vigente.origen === "declarado por la empresa", `★ (${etiqueta}) benchmark: vigente «${P.benchmark}%» · declarado por la empresa — antes `+"solo traía rótulo, unidad y rango", jj(bm));
    ok(cs.every((x) => "vigente" in x), `(${etiqueta}) TODO criterio declarable trae \`vigente\` (con valor y origen, o null si la empresa no lo declaró)`);
    const sinDecl = cs.filter((x) => x.vigente === null).map((x) => x.concepto);
    const techo = cs.find((x) => x.concepto === "techo_cobertura");
    ok(techo && techo.vigente && /120/.test(techo.vigente.valor), `(${etiqueta}) techo de cobertura vigente ${techo && techo.vigente && techo.vigente.valor}`, jj(techo));
    console.log(`   · (${etiqueta}) criterios sin declarar: ${sinDecl.join(", ") || "ninguno"} · sin conversación: ${"establecido" in ce ? "trae establecido" : "no trae establecido (no hay libro)"}`);
    ok(!("establecido" in ce), `(${etiqueta}) sin conversación no hay libro: \`conocerEmpresa\` no trae \`establecido\``);
  }
  /* una empresa sin benchmark declarado: vigente es el criterio general de ADI, o null */
  const sinBm = { ...EMPRESAS[0].T, dataset: { ...TENANT_DEMO, perfil: { ...TENANT_DEMO.perfil, benchmark: undefined } } };
  initTenant(sinBm.dataset);
  const ce2 = compactarParaAnfitrion("conocerEmpresa", await crearAcciones({ continuidad: crearAlmacenEnMemoria() }).conocerEmpresa({ tenant: sinBm }));
  const b2 = ce2.declarable.criterios.find((x) => x.concepto === "benchmark");
  ok(b2 && (b2.vigente === null || /general de ADI/.test(b2.vigente.origen)), "una empresa que no declaró el benchmark: `vigente` es null o el criterio general de ADI (nunca «declarado por la empresa»)", jj(b2));
  initTenant(TENANT_DEMO);
}

/* ═══ 9 · CANDADO ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════ */
H("9 · candado");
{
  const sinCom = (f) => fs.readFileSync(f, "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`\\])\/\/[^\n]*/g, "$1");
  for (const f of ["src/adi/capacidad/alcanceEstructural.js", "src/adi/capacidad/establecido.js", "src/adi/capacidad/paginasDeRetomar.js", "src/adi/capacidad/brazo.js"]) ok(!/node:|fetch\(|XMLHttpRequest|openai|anthropic|gateway/i.test(sinCom(f)), `\`${f.split("/").pop()}\` no usa \`node:*\`, ni red, ni un modelo (corre en edge)`);
  ok(!/\.alcance\b/.test(sinCom("src/adi/capacidad/alcanceEstructural.js")), "(el módulo de alcance no depende de las palabras del mecanismo de texto)");
  ok(clasificarFuente(fs.readFileSync(new URL(import.meta.url), "utf8")).tipo === "offline", "este gate se clasifica `offline` (autochequeo)");
}
restaurar();

console.log(`\n── _alcance_estructural_gate: PASS ${pass} · FAIL ${fail} (de ${pass + fail}) ──`);
process.exit(fail ? 1 : 0);
