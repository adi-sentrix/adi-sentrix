/* === _universal_localizado_gate.mjs · UNIVERSAL / LOCALIZADO (Etapa 2, bloque 6 · owner 2026-10-04, offline) ═══════════════════════════════════════════════════════════════════════════
 * LO QUE EL OWNER APROBÓ (2026-10-04; `_ADI_DISENO_UNIVERSAL_LOCALIZADO.md` §0):
 *   · PRI-04 = UNIVERSAL («no depende del perfil»: su alcance sin dependencias); CAU-01 = LOCALIZADA por MODELO COMERCIAL (cuentas grandes / cadenas), no por sector; CAU-06 y CAU-03 = localizadas pero
 *     BORRADORES: siguen sin servirse. El bloque no activa conocimiento nuevo ni crea piezas.
 *   · MECANISMO: cada pieza exige SOLO los campos del perfil de los que depende; solo cuenta lo CONFIRMADO (lo pendiente no cuenta); si el perfil confirmado la descarta no aparece y no se dice nada.
 *   · LÍMITE cuando falta el contexto de una pieza localizada: UNA línea en la Entrega, en tercera persona, armada con datos de la pieza y del campo (no escrita a mano por pieza).
 *   · FORMULACIÓN NEUTRAL: «Criterio general, independiente del perfil de la empresa:» para lo universal y «Aplica por el {campo} declarado por la empresa:» para lo localizado servido; ambos en UNA tabla de
 *     datos (`conocimiento/alcance.js:ENCABEZADOS`) y «declarado por la empresa» sale de `ETIQUETA_ORIGEN`. «Para toda empresa» (y cualquier forma absoluta) está vetado: sobreafirma.
 *   · Una referencia general nunca dice ser criterio de la empresa. Nada de esto cambia una cifra ni una medición.
 *
 * LA CERTIFICACIÓN (cada control tiene su CARNADA: una versión del código real, mutada a propósito, que el control TIENE que poner en rojo — un control que no muerde a su carnada no mide nada). El grueso
 * vive en `certificar(impl)`: una sola batería de controles que corre sobre el código real (todo verde) y sobre CADA mutante del código real (cargado desde su fuente, con la mutación aplicada):
 *   C1  PRI-04 se sirve SIN perfil (capa encendida), con su encabezado universal.
 *   C2  CAU-01 no aparece sin modelo comercial · C3 ni con el modelo PENDIENTE · C4 ni con OTRO modelo confirmado (y nada se dice) · C5 sí con el modelo confirmado, con su encabezado localizado.
 *   C6  falta el contexto → la línea de límite está, una sola, en tercera persona.
 *   C7  una pieza localizada con encabezado universal (o al revés) es rojo — oráculo por significado sobre el TEXTO.
 *   C8  una referencia general dicha «declarado por la empresa» sin declaración es rojo.
 *   C9  «Para toda empresa» o cualquier forma absoluta en un encabezado es rojo.
 *   C10 los borradores (CAU-06, CAU-03) nunca se sirven, con ningún perfil ni encargo.
 *   C11 otra empresa nunca usa el perfil de esta.
 *   C12 la medición de cada pieza es idéntica con y sin perfil; con la capa apagada no se sirve nada.
 * Y, fuera de la batería: las cuatro rutas de `componer.js` con la capa encendida/apagada y con/sin perfil (cifras y libro idénticos), los catálogos v13–v40 byte-idénticos con la capa apagada, la línea de límite
 * armada con datos (una por campo, no por pieza), el candado de código (una sola lectura del alcance, ningún encabezado escrito a mano) y la regla nueva en `necesitaPerfil` (lo que el anfitrión pregunta = lo que la
 * Entrega declara como límite).
 *
 * CERO llamadas a un LLM · CERO red. Solo por `npm run gates:offline` o `node --import ./scripts/offline-guard.mjs _universal_localizado_gate.mjs`. */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { pathToFileURL } from "node:url";
import { initTenant } from "./src/data/tenantStore.js";
import { TENANT_DEMO } from "./src/data/tenants/demo.js";
import { ESCENARIO_INICIAL } from "./src/config/scenarios.js";
import { construirPerfilCliente, ETIQUETA_DEL_CAMPO } from "./src/config/contract/perfilCliente.js";
import { ETIQUETA_ORIGEN, ORIGEN } from "./src/config/businessPolicy.js";
import { TAXONOMIA_PERFIL } from "./src/config/contract/taxonomiaPerfil.js";
import { crearAcciones, _datasetDeLaEmpresa } from "./src/adi/capacidad/acciones.js";
import { crearAlmacenEnMemoria } from "./src/adi/continuidad/almacen.js";
import { perfilDeLasFilas, LISTA_DE_CAMPO_PERFIL } from "./src/adi/continuidad/empresa.js";
import * as LD from "./src/adi/capacidad/loDeclarado.js";
import { conTenantActivo } from "./src/adi/capacidad/aislamiento.js";
import * as PC from "./src/adi/capacidad/perfilConversando.js";
import * as ALC from "./src/adi/conocimiento/alcance.js";
import * as SEL from "./src/adi/conocimiento/seleccionar.js";
import { PIEZAS_CONOCIMIENTO, piezaPorId } from "./src/adi/conocimiento/piezas.js";
import { construirEncargoDeLaTabla } from "./src/adi/conocimiento/tablaSenales.js";
import { validarEncargo } from "./src/adi/encargo/validar.js";
import {
  componerEntrega,
  componerEntregaBrechaComercial, PREGUNTA_BRECHA_COMERCIAL,
  componerEntregaCobranza, PREGUNTA_COBRANZA,
  componerEntregaInventario, PREGUNTA_INVENTARIO,
  componerEntregaMultidominio, PREGUNTA_MULTIDOMINIO,
} from "./src/adi/entrega/componer.js";
import { ADI_CONOCIMIENTO } from "./src/config/voiceFlags.js";

let pass = 0, fail = 0;
const fails = [];
const ok = (c, m, extra = "") => { if (c) { pass++; } else { fail++; fails.push(m + (extra ? " — " + extra : "")); console.log("  ✗ " + m + (extra ? "\n      " + String(extra).slice(0, 700) : "")); } };
const H = (t) => console.log(`\n${t}`);
const jj = (x) => JSON.stringify(x);
const sha = (s) => crypto.createHash("sha256").update(String(s)).digest("hex").slice(0, 16);
const sinComentarios = (src) => String(src).replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`\\])\/\/[^\n]*/g, "$1");

/* ═══ LOS TEXTOS QUE EL OWNER APROBÓ — escritos AQUÍ, a mano, a propósito: el oráculo no puede leerlos del código que prueba ═══════════════════════════════════════════════════════════════════════ */
const ENC_UNIVERSAL = "Criterio general, independiente del perfil de la empresa:";
const ORIGEN_EMPRESA = ETIQUETA_ORIGEN[ORIGEN.EMPRESA];                                   // «declarado por la empresa» (la tabla única de origen)
const ENC_LOCALIZADO_MODELO = `Aplica por el modelo comercial ${ORIGEN_EMPRESA}:`;
const FRAGMENTO = {   // el comienzo del enunciado de cada pieza, en minúscula (como se sirve tras el encabezado)
  "PRI-04": "el oficio compara la participación de cada cuenta en el vencido",
  "CAU-01": "cuando una cuenta cadena está bajo el benchmark",
  "CAU-06": "cuando un sku está inmovilizado y no rota",
  "CAU-03": "cuando una cuenta cadena tiene vencido",
};
const ABSOLUTO = /\b(?:para\s+toda|toda|todas\s+las|todos\s+los|cualquier|todo)\s+(?:la\s+|las\s+|el\s+|los\s+)?(?:empresas?|organizaci\w+|negocios?|compañ\w+)\b|\bsiempre\b|\bnunca\b|\buniversal(?:es|mente)?\b|\bsin\s+excepci\w+|\ben\s+todo\s+caso\b|\bobligatori\w+/i;
const TRATO = /(?<![\wáéíóúñ])(t[uú]|tus?|ti|vos|usted(?:es)?|su\s+empresa)(?![\wáéíóúñ])/i;
const RE_LIMITE = /^Hay (?:una referencia|referencias) del oficio(?: para empresas que [^;]+)?; la empresa no ha declarado su [a-záéíóúñ ]+\.$/;
const LIMITE_CADENAS = "Hay una referencia del oficio para empresas que venden a cadenas o a pocas cuentas grandes; la empresa no ha declarado su modelo comercial.";
const esLimite = (t) => /^Hay (?:una referencia|referencias) del oficio/.test(t);
const piezaDelTexto = (t) => Object.keys(FRAGMENTO).find((id) => String(t).toLowerCase().includes(FRAGMENTO[id])) || null;

/* ═══ EL CAMPO DE PRUEBA — la memoria REAL de la empresa (aportarContexto → confirmar → lo vigente → el dataset que rige), un solo almacén, varias empresas ═══════════════════════════════════════ */
let _tick = 0;
const reloj = () => new Date(Date.UTC(2026, 9, 4, 12, 0, 0) + (++_tick) * 1000).toISOString();
const STORE = crearAlmacenEnMemoria();
const ACC = crearAcciones({ continuidad: STORE, ahora: reloj, conocimiento: { activo: true } });
const tenantDe = (id) => ({ id, dataset: TENANT_DEMO, version: "v1" });
async function declarar(tenant, campo, valor, { confirmar = true } = {}) {
  const r = await ACC.aportarContexto({ tenant, aportes: [{ clase: "perfil", concepto: campo, valor }] });
  const id = r.ok && r.resultados && r.resultados[0] ? r.resultados[0].id : null;
  if (id && confirmar) await ACC.aportarContexto({ tenant, conversacionId: r.conversacionId, confirmar: [id] });
  return { ok: Boolean(id), r };
}
async function datasetDe(tenant) {
  const filas = (await STORE.leerHechosEmpresa(tenant.id)) || [];
  return _datasetDeLaEmpresa(tenant.dataset, perfilDeLasFilas(filas), LD.clasificarLoDeclarado(filas)).dataset;
}
const T = Object.fromEntries(["vacio", "pendiente", "otro", "cadenas", "solo_sector", "servicios", "completo", "gemelo_a", "gemelo_b"].map((k) => [k, tenantDe("ul-" + k)]));
const res = [];
res.push(await declarar(T.pendiente, "modeloComercial", "cuentas_grandes", { confirmar: false }));
res.push(await declarar(T.otro, "modeloComercial", "comercios"));
res.push(await declarar(T.cadenas, "modeloComercial", "cuentas_grandes"));
res.push(await declarar(T.solo_sector, "sector", "distribucion"));
res.push(await declarar(T.servicios, "sector", "servicios")); res.push(await declarar(T.servicios, "modeloComercial", "cuentas_grandes"));
for (const [c, v] of [["sector", "distribucion"], ["tipoProducto", "durable"], ["modeloComercial", "cuentas_grandes"], ["pais", "CL"]]) res.push(await declarar(T.completo, c, v));
res.push(await declarar(T.gemelo_a, "modeloComercial", "cuentas_grandes"));   // dos empresas con el MISMO dato: solo A declara
const D = {};
for (const k of Object.keys(T)) D[k] = await datasetDe(T[k]);
const PERFIL = (d) => conTenantActivo(d, () => construirPerfilCliente(d));
const P = Object.fromEntries(Object.keys(D).map((k) => [k, PERFIL(D[k])]));

/* los tres encargos tipados (la forma que usa el camino general: nunca texto) */
const encDe = (tema, concepto) => construirEncargoDeLaTabla([{ id: "p1", tema, cierre: "lectura", conceptos: concepto ? [concepto] : [], entidades: [] }], { criterio: null });
const ENC = { com: encDe("comercial", "margen"), cob: encDe("cobranza"), inv: encDe("inventario") };
ENC.multi = construirEncargoDeLaTabla([{ id: "p1", tema: "comercial", cierre: "lectura", conceptos: ["margen"], entidades: [] }, { id: "p2", tema: "cobranza", cierre: "lectura", conceptos: [], entidades: [] }, { id: "p3", tema: "inventario", cierre: "lectura", conceptos: [], entidades: [] }], { criterio: null });

/* ═══ UN CARGADOR DE MUTANTES — el módulo real, desde su fuente, con una mutación aplicada (data: URL; sus imports relativos se vuelven absolutos o se remapean al mutante de otro módulo) ═════════ */
const A = (rel) => path.resolve(rel);
async function cargar(rel, { reemplazos = [], mapa = {} } = {}) {
  let src = fs.readFileSync(A(rel), "utf8");
  for (const [a, b] of reemplazos) { if (!src.includes(a)) throw new Error(`mutación no aplicable en ${rel}: «${a.slice(0, 60)}»`); src = src.replace(a, () => b); }
  const dir = path.dirname(A(rel));
  src = src.replace(/(from\s+)(["'])(\.{1,2}\/[^"']+)\2/g, (_m, f, _q, spec) => { const abs = path.resolve(dir, spec); return `${f}"${mapa[abs] || pathToFileURL(abs).href}"`; });
  const url = "data:text/javascript;base64," + Buffer.from(src).toString("base64");
  return { url, mod: await import(url) };
}
const R = {   // las rutas absolutas que se remapean entre mutantes
  alc: A("src/adi/conocimiento/alcance.js"), servir: A("src/adi/conocimiento/servir.js"), pc: A("src/adi/capacidad/perfilConversando.js"),
  piezas: A("src/adi/conocimiento/piezas.js"), sel: A("src/adi/conocimiento/seleccionar.js"),
};
const IMPL_REAL = { sel: SEL, alc: ALC, pc: PC, piezas: { PIEZAS_CONOCIMIENTO } };

/* ═══ LA BATERÍA — una sola, sobre el código real y sobre cada mutante ═══════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════ */
const ref = (impl, dataset, encargo, extra = {}) => conTenantActivo(dataset, () => impl.sel.referenciaDelOficioConOfertas({ perfil: construirPerfilCliente(dataset), pregunta: "", encargo, entidadesEnRespuesta: [], entidadesDeLaPregunta: [], scenario: ESCENARIO_INICIAL, activo: true, ...extra }));
const textos = (r) => r.salida.map((s) => s.texto);
const localizadas = (ts) => ts.filter((t) => /^Aplica por /.test(t));

function certificar(impl) {
  const C = {}; const det = {};
  const set = (id, cond, d = "") => { C[id] = Boolean(cond); if (!cond) det[id] = String(d).slice(0, 500); };
  // la cuadrícula: cada empresa × cada encargo, UNA vez por implementación (todos los controles leen de aquí)
  const memo = new Map();
  const G = (k, e) => { const key = k + "/" + e; if (!memo.has(key)) memo.set(key, textos(ref(impl, D[k], ENC[e]))); return memo.get(key); };
  const celdas = [];
  for (const k of Object.keys(D)) for (const e of Object.keys(ENC)) celdas.push([k, e, G(k, e)]);

  // C1 · PRI-04 universal, sin perfil
  { const ts = G("vacio", "cob");
    set("C1", ts.some((t) => t.startsWith(ENC_UNIVERSAL + " " + FRAGMENTO["PRI-04"])), jj(ts).slice(0, 300)); }

  // C2..C5 · CAU-01 (localizada por modelo comercial) con cuatro estados de la empresa
  { const ts = G("vacio", "com");
    set("C2", !ts.some((t) => piezaDelTexto(t) === "CAU-01") && localizadas(ts).length === 0, jj(ts).slice(0, 300)); }
  { const ts = G("pendiente", "com");
    set("C3", !ts.some((t) => piezaDelTexto(t) === "CAU-01") && localizadas(ts).length === 0, jj(ts).slice(0, 300)); }
  { const ts = G("otro", "com");
    set("C4", !ts.some((t) => piezaDelTexto(t) === "CAU-01") && localizadas(ts).length === 0 && !ts.some(esLimite), jj(ts).slice(0, 300)); }
  { const ts = G("cadenas", "com");
    set("C5", ts.some((t) => t.startsWith(ENC_LOCALIZADO_MODELO + " " + FRAGMENTO["CAU-01"])) && !ts.some(esLimite), jj(ts).slice(0, 300)); }

  // C6 · el límite: una línea, tercera persona, con los datos de la pieza
  for (const k of ["vacio", "pendiente", "solo_sector"]) {
    const ls = G(k, "com").filter(esLimite);
    set("C6." + k, ls.length === 1 && ls[0] === LIMITE_CADENAS && RE_LIMITE.test(ls[0]) && !TRATO.test(ls[0]), jj(ls));
  }
  { const ls = G("vacio", "multi").filter(esLimite);
    set("C6.una", ls.length === 1, "un encargo de tres temas con las piezas firmadas del catálogo: una sola línea por campo faltante · " + jj(ls)); }

  // C7 · el encabezado coincide con lo que la pieza DECLARA (oráculo leído de los datos de la pieza, no del código que sirve)
  { const malos = [];
    for (const [k, e, ts] of celdas) for (const t of ts) {
      const id = piezaDelTexto(t); if (!id) continue;
      const pz = PIEZAS_CONOCIMIENTO.find((p) => p.id === id);
      const depende = Object.values(pz.alcance).some((v) => Array.isArray(v));
      const bien = depende ? /^Aplica por [^:]+:/.test(t) && !t.startsWith(ENC_UNIVERSAL) : t.startsWith(ENC_UNIVERSAL) && !/^Aplica por /.test(t);
      if (!bien) malos.push(`${k}/${e}/${id}: ${t.slice(0, 90)}`);
    }
    set("C7", malos.length === 0, malos.slice(0, 3).join(" | ")); }

  // C8 · una referencia general NUNCA dice «declarado por la empresa» sin declaración
  { const malos = [];
    for (const [k, e, ts] of celdas) for (const t of ts) {
      if (piezaDelTexto(t) !== "PRI-04") continue;     // PRI-04 es la general; el piso NO está declarado en ninguna de estas empresas
      const m = t.match(/.{0,50}declarad[oa]s? por (?:la|tu) empresa.{0,20}/i);
      if (m) malos.push(`${k}/${e}: ${m[0]}`);
    }
    set("C8", malos.length === 0, malos.slice(0, 3).join(" | ")); }

  // C9 · ninguna forma absoluta en un encabezado: ni el universal, ni el localizado (de ningún subconjunto de campos), ni en lo servido
  { const encs = [impl.alc.ENCABEZADOS.universal];
    const campos = ["sector", "tipoProducto", "modeloComercial", "pais", "tamano"];
    for (let m = 1; m < 1 << campos.length; m++) encs.push(impl.alc.ENCABEZADOS.localizada(campos.filter((_c, i) => m & (1 << i))));
    for (const [, , ts] of celdas) for (const t of ts) { const id = piezaDelTexto(t); if (id) encs.push(t.slice(0, t.toLowerCase().indexOf(FRAGMENTO[id]))); }
    const malos = encs.filter((h) => ABSOLUTO.test(h));
    set("C9", malos.length === 0 && encs.length > 30, malos.slice(0, 2).join(" | ")); }

  // C10 · los borradores nunca se sirven (todos los perfiles × todos los encargos)
  { const malos = [];
    for (const [k, e, ts] of celdas) for (const t of ts) { const id = piezaDelTexto(t); if (id === "CAU-06" || id === "CAU-03") malos.push(`${k}/${e}/${id}`); }
    set("C10", malos.length === 0, malos.slice(0, 3).join(" | ")); }

  // C11 · otra empresa nunca usa el perfil de esta (dos empresas con el MISMO dato, alternadas; solo A declaró)
  { let malo = "";
    for (const o of [["a", "b", "a", "b"], ["b", "a", "b", "a"]]) for (const k of o) {
      const ts = textos(ref(impl, D["gemelo_" + k], ENC.com));
      const tiene = ts.some((t) => piezaDelTexto(t) === "CAU-01");
      if (k === "a" && !tiene) malo = "A debía recibir CAU-01";
      if (k === "b" && (tiene || !ts.some((t) => t === LIMITE_CADENAS))) malo = "B (no declaró) usó el perfil de A o no declaró el límite";
    }
    set("C11", !malo, malo); }

  // C12 · la medición no depende del perfil · capa apagada = nada
  { const evalSin = conTenantActivo(D.vacio, () => impl.sel._evaluarInfraestructura({ perfil: P.vacio, encargo: ENC.multi, scenario: ESCENARIO_INICIAL }));
    const evalCon = conTenantActivo(D.completo, () => impl.sel._evaluarInfraestructura({ perfil: P.completo, encargo: ENC.multi, scenario: ESCENARIO_INICIAL }));
    set("C12.medicion", evalSin.detalle.length > 20 && jj(evalSin.detalle) === jj(evalCon.detalle), "la medición (cifra, estado, referencia de cada pieza y cuenta) debe ser idéntica con y sin perfil");
    const pri = (k) => G(k, "cob").filter((t) => piezaDelTexto(t) === "PRI-04").join("\n");
    set("C12.texto", pri("vacio").length > 200 && pri("vacio") === pri("completo") && pri("vacio") === pri("cadenas"), "PRI-04 (universal): el MISMO texto, cifra por cifra, con perfil vacío, completo o parcial");
    const apagada = ["vacio", "completo", "cadenas"].map((k) => conTenantActivo(D[k], () => impl.sel.referenciaDelOficio({ perfil: P[k], pregunta: "", encargo: ENC.cob, scenario: ESCENARIO_INICIAL, activo: false })));
    set("C12.apagada", apagada.every((x) => Array.isArray(x) && x.length === 0), jj(apagada)); }
  return { C, det };
}

const FALLAS = (r) => Object.keys(r.C).filter((k) => !r.C[k]);

/* ═══ 0 · LA CLASIFICACIÓN APROBADA, EN EL CATÁLOGO REAL ═══════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════ */
H("0 · la clasificación del owner en el catálogo real: PRI-04 universal · CAU-01 localizada por modelo comercial · CAU-06 y CAU-03 localizadas y en borrador (sin piezas nuevas)");
{
  ok(PIEZAS_CONOCIMIENTO.length === 4 && jj(PIEZAS_CONOCIMIENTO.map((p) => p.id)) === jj(["CAU-01", "CAU-06", "CAU-03", "PRI-04"]), "el catálogo sigue teniendo las MISMAS cuatro piezas (el bloque no crea conocimiento nuevo)");
  const pri = piezaPorId("PRI-04"), c1 = piezaPorId("CAU-01"), c6 = piezaPorId("CAU-06"), c3 = piezaPorId("CAU-03");
  ok(ALC.esUniversal(pri) && jj(ALC.camposDeLosQueDepende(pri)) === "[]" && pri.estado === "firmada", "★ PRI-04 es UNIVERSAL: «no depende del perfil» (su alcance no tiene ninguna lista) y sigue firmada");
  ok(jj(ALC.camposDeLosQueDepende(c1)) === jj(["modeloComercial"]) && jj(ALC.listaDeAlcance(c1, "modeloComercial")) === jj(["cuentas_grandes"]) && c1.estado === "firmada", "★ CAU-01 es LOCALIZADA por MODELO COMERCIAL (cuentas grandes / cadenas), no por sector, y sigue firmada");
  ok(ALC.listaDeAlcance(c1, "sector") === null, "CAU-01 NO depende del sector (ampliación aprobada: un fabricante que vende a cadenas enfrenta lo mismo)");
  ok(!ALC.esUniversal(c6) && !ALC.esUniversal(c3) && c6.estado === "borrador" && c3.estado === "borrador" && c6.firma == null && c3.firma == null, "★ CAU-06 y CAU-03 siguen LOCALIZADAS y en BORRADOR, sin firma: no se sirven");
  ok(PIEZAS_CONOCIMIENTO.filter((p) => p.estado === "firmada").map((p) => p.id).sort().join() === "CAU-01,PRI-04", "solo dos piezas firmadas: el bloque no activa conocimiento nuevo");
  // lo que el anfitrión pregunta sale de las MISMAS dependencias
  const N = (enc, o = {}) => PC.necesitaPerfil(enc, { activo: true, ...o });
  const encPC = (tema) => ({ version: "encargo/v1", partes: [{ id: "p1", tema, cierre: "cifra", conceptos: [], entidades: [] }] });
  const nCob = N(encPC("cobranza")), nCom = N(encPC("comercial"));
  ok(nCob.necesarios.length === 0 && nCob.siguiente === null, "★ cobranza (PRI-04, universal): el anfitrión NO pregunta nada — la pieza no depende del perfil", jj(nCob));
  ok(jj(nCom.necesarios) === jj(["modeloComercial"]) && nCom.siguiente === "modeloComercial", "★ comercial (CAU-01): el anfitrión pregunta SOLO el modelo comercial (ya no el sector)", jj(nCom));
  ok(jj(N(encPC("comercial"), { conocidos: { modeloComercial: "comercios" } }).necesarios) === "[]", "con otro modelo declarado (comercios) no hace falta preguntar nada: la pieza no es de esta empresa");
}

/* ═══ 1 · EL MECANISMO (alcance.js) — verdad de la tabla de aplicabilidad, con piezas de prueba firmadas ══════════════════════════════════════════════════════════════════════════════════════════ */
H("1 · alcance.js: universal · localizada con su contexto · descartada por lo declarado (sin decir nada) · falta contexto (con límite) — y lo pendiente no cuenta");
{
  const base = piezaPorId("PRI-04");
  const TODO = { sector: "*", tipoProducto: "*", modeloComercial: "*", pais: "*", banda: "*" };
  const U = { ...base, id: "U-TEST", alcance: { ...TODO } };
  const L = { ...base, id: "L-TEST", alcance: { ...TODO, sector: ["distribucion"] } };
  const LM = { ...base, id: "LM-TEST", alcance: { ...TODO, sector: ["distribucion"], modeloComercial: ["cuentas_grandes"] } };
  const pf = (campos) => ({ campos: Object.fromEntries(Object.entries(campos).map(([k, v]) => [k, { valor: v }])) });
  const vacio = pf({}), dist = pf({ sector: "distribucion" }), serv = pf({ sector: "servicios" }), distCad = pf({ sector: "distribucion", modeloComercial: "cuentas_grandes" }), distCom = pf({ sector: "distribucion", modeloComercial: "comercios" });
  const ap = (p, perfil) => ALC.aplicaAlPerfil(p, perfil);
  ok(ap(U, vacio).aplica && ap(U, null).aplica && ap(U, serv).aplica, "★ U-TEST (universal): aplica siempre, con perfil vacío, sin perfil o con cualquiera");
  ok(!ap(L, vacio).aplica && ap(L, vacio).motivo === "falta_contexto" && jj(ap(L, vacio).campos) === '["sector"]' && !ap(L, null).aplica, "★ L-TEST (sector): sin sector declarado no aplica y dice qué le falta");
  ok(ap(L, dist).aplica && ap(L, distCad).aplica, "L-TEST con el sector declarado dentro de su lista: aplica");
  ok(!ap(L, serv).aplica && ap(L, serv).motivo === "fuera_de_alcance" && ap(L, serv).campo === "sector", "★ L-TEST con «servicios»: DESCARTADA por lo declarado (motivo propio: la Entrega no dirá nada)");
  ok(ap(LM, vacio).motivo === "falta_contexto" && jj(ap(LM, vacio).campos) === '["sector","modeloComercial"]' && jj(ap(LM, dist).campos) === '["modeloComercial"]' && ap(LM, distCad).aplica, "LM-TEST (sector + modelo): pide solo lo que falta, en orden, y aplica con los dos");
  ok(ap(LM, pf({ sector: "servicios" })).motivo === "fuera_de_alcance" && ap(LM, distCom).motivo === "fuera_de_alcance", "LM-TEST: lo que descarta manda sobre lo que falta (servicios sin modelo; comercios con sector): no es de esta empresa");
  ok(ap(L, pf({ sector: null })).motivo === "falta_contexto" && ap(L, pf({ sector: "" })).motivo === "falta_contexto", "un valor nulo o vacío no cuenta como declarado");
  // lo PENDIENTE no cuenta: por la memoria real (declarado pero sin confirmar → no llega al perfil)
  ok(P.pendiente.campos.modeloComercial.valor === null && ap(piezaPorId("CAU-01"), P.pendiente).motivo === "falta_contexto", "★ el modelo comercial PENDIENTE (dicho, sin confirmar) no cuenta: el perfil no lo trae y CAU-01 sigue faltando contexto");
  ok(P.cadenas.campos.modeloComercial.valor === "cuentas_grandes" && ap(piezaPorId("CAU-01"), P.cadenas).aplica, "y el CONFIRMADO sí: CAU-01 aplica");
  // la banda (tamaño) se deriva: si la pieza dependiera de ella, se lee de campos.tamano
  const B = { ...base, id: "B-TEST", alcance: { ...TODO, banda: ["pequena"] } };
  ok(ap(B, pf({ tamano: "pequena" })).aplica && ap(B, pf({ tamano: "grande" })).motivo === "fuera_de_alcance" && jj(ap(B, vacio).campos) === '["tamano"]', "la banda de tamaño (que se deriva, nunca se pregunta) se lee de campos.tamano");
  // una sola fuente de las dependencias: lo que el anfitrión pregunta y lo que la Entrega declara
  const idsPC = (cat, conoc) => PC.necesitaPerfil({ partes: [{ tema: "cobranza" }] }, { activo: true, catalogo: cat.map((p) => ({ ...p, estado: "firmada" })), conocidos: conoc || {} }).necesarios;
  ok(jj(idsPC([U])) === "[]" && jj(idsPC([L])) === '["sector"]' && jj(idsPC([LM])) === '["sector","modeloComercial"]' && jj(idsPC([LM], { sector: "distribucion" })) === '["modeloComercial"]', "★ `necesitaPerfil` (lo que el anfitrión pregunta) usa las MISMAS dependencias que `aplicaAlPerfil` (lo que la Entrega sirve o declara)");
}

/* ═══ 2 · EL CÓDIGO REAL — la batería entera, todo verde ═══════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════ */
H("2 · la batería de certificación sobre el código real (TENANT_DEMO, memoria real de cada empresa, las cuatro piezas del catálogo)");
const REAL = certificar(IMPL_REAL);
{
  const nombres = { C1: "★ PRI-04 se sirve SIN perfil (capa encendida), con su encabezado universal", C2: "★ CAU-01 NO aparece sin modelo comercial", C3: "★ CAU-01 NO aparece con el modelo PENDIENTE (dicho, sin confirmar)", C4: "★ CAU-01 NO aparece con OTRO modelo confirmado (comercios) y no se dice nada", C5: "★ CAU-01 SÍ aparece con el modelo confirmado, con su encabezado localizado exacto", "C6.vacio": "★ falta el contexto (empresa sin perfil): UNA línea de límite, la esperada, en tercera persona", "C6.pendiente": "★ falta el contexto (modelo pendiente): la misma línea de límite", "C6.solo_sector": "falta el contexto (solo sector declarado): la misma línea (CAU-01 no depende del sector)", "C6.una": "una línea por campo, no por pieza (encargo de tres temas)", C7: "★ ninguna pieza localizada con encabezado universal (ni al revés) en ningún perfil ni encargo", C8: "★ la referencia general nunca dice «declarado por la empresa» sin declaración", C9: "★ ningún encabezado dice «para toda empresa» ni otra forma absoluta (ni el universal, ni los localizados, ni lo servido)", C10: "★ los borradores (CAU-06, CAU-03) NUNCA se sirven (todos los perfiles × todos los encargos)", C11: "★ otra empresa nunca usa el perfil de esta (dos empresas con el mismo dato, alternadas)", "C12.medicion": "★ la medición de cada pieza y cuenta es IDÉNTICA con y sin perfil", "C12.texto": "★ PRI-04 sirve el MISMO texto con perfil vacío, parcial o completo (cifra por cifra)", "C12.apagada": "★ con la capa apagada no se sirve nada, con ningún perfil" };
  for (const [id, m] of Object.entries(nombres)) ok(REAL.C[id] === true, m, REAL.det[id] || `no se evaluó ${id}`);
}

/* ═══ 3 · LAS CARNADAS — cada defecto, puesto a propósito en el código real, tiene que ponerse rojo en el control que le toca ═══════════════════════════════════════════════════════════════════════ */
H("3 · carnadas: once mutantes del código real (cargados desde su fuente) — cada uno tiene que poner en rojo el control que le toca");
{
  const MUT = [];
  const M = async (nombre, debenFallar, spec) => { const { impl, error } = await spec().then((impl) => ({ impl })).catch((e) => ({ error: e })); MUT.push({ nombre, debenFallar, impl, error }); };

  // 1 · la vieja puerta 2 reinstalada: «sin perfil completo no se entrega nada»
  await M("la puerta 2 vieja reinstalada («perfil incompleto apaga la capa entera»)", ["C1", "C6.vacio", "C12.texto"], async () => {
    const sel = await cargar("src/adi/conocimiento/seleccionar.js", { reemplazos: [
      [`import { seleccionarConocimientoDelOficio } from`, `import { seleccionarConocimientoDelOficio, perfilAutorizaConocimiento } from`],
      [`if (!activo) return { salida: seleccionarConocimientoDelOficio(perfil), ofertas: [] };   // puerta 1 — byte-idéntico a hoy`, `if (!activo) return { salida: seleccionarConocimientoDelOficio(perfil), ofertas: [] };\n  if (!perfilAutorizaConocimiento(perfil)) return { salida: [], ofertas: [] };`],
    ] });
    return { ...IMPL_REAL, sel: sel.mod };
  });
  // 2 · el filtro por perfil retirado: lo localizado se sirve sin su contexto
  await M("la selección ya no mira el perfil (lo localizado se sirve sin su contexto)", ["C2", "C3", "C4"], async () => {
    const sel = await cargar("src/adi/conocimiento/seleccionar.js", { reemplazos: [[`    if (ap.aplica) { validas.push(pieza); continue; }`, `    validas.push(pieza); continue;`]] });
    return { ...IMPL_REAL, sel: sel.mod };
  });
  // 3 · el límite retirado
  await M("la línea de límite desaparece (la referencia que existe se calla)", ["C6.vacio", "C6.pendiente", "C11"], async () => {
    const sel = await cargar("src/adi/conocimiento/seleccionar.js", { reemplazos: [[`  salida.push(...limites);`, `  void limites;`]] });
    return { ...IMPL_REAL, sel: sel.mod };
  });
  // 4 · una pieza localizada con el encabezado universal
  await M("una pieza LOCALIZADA con el encabezado universal", ["C5", "C7"], async () => {
    const servir = await cargar("src/adi/conocimiento/servir.js", { reemplazos: [[`const enc = encabezadoDePieza(pieza).texto;`, `const enc = "Criterio general, independiente del perfil de la empresa:";`]] });
    const sel = await cargar("src/adi/conocimiento/seleccionar.js", { mapa: { [R.servir]: servir.url } });
    return { ...IMPL_REAL, sel: sel.mod };
  });
  // 5 · «Para toda empresa» en el encabezado universal
  await M("el encabezado universal dice «Para toda empresa:» (forma absoluta)", ["C1", "C7", "C9"], async () => {
    const alc = await cargar("src/adi/conocimiento/alcance.js", { reemplazos: [[`universal: "Criterio general, independiente del perfil de la empresa:",`, `universal: "Para toda empresa:",`]] });
    const servir = await cargar("src/adi/conocimiento/servir.js", { mapa: { [R.alc]: alc.url } });
    const sel = await cargar("src/adi/conocimiento/seleccionar.js", { mapa: { [R.servir]: servir.url, [R.alc]: alc.url } });
    return { ...IMPL_REAL, sel: sel.mod, alc: alc.mod };
  });
  // 6 · una referencia general que dice ser «declarado por la empresa»
  await M("la referencia general dice «declarado por la empresa» sin declaración", ["C1", "C7", "C8"], async () => {
    const alc = await cargar("src/adi/conocimiento/alcance.js", { reemplazos: [[`universal: "Criterio general, independiente del perfil de la empresa:",`, "universal: `Criterio general, ${ETIQUETA_ORIGEN[ORIGEN.EMPRESA]}:`,"]] });
    const servir = await cargar("src/adi/conocimiento/servir.js", { mapa: { [R.alc]: alc.url } });
    const sel = await cargar("src/adi/conocimiento/seleccionar.js", { mapa: { [R.servir]: servir.url, [R.alc]: alc.url } });
    return { ...IMPL_REAL, sel: sel.mod, alc: alc.mod };
  });
  // 7 · el límite en segunda persona
  await M("el límite le habla a alguien (segunda persona)", ["C6.vacio", "C6.pendiente", "C11"], async () => {
    const pc = await cargar("src/adi/capacidad/perfilConversando.js", { reemplazos: [["; la empresa no ha declarado su ${R.rotulo}.", "; usted no ha declarado su ${R.rotulo}."]], mapa: {} });
    const sel = await cargar("src/adi/conocimiento/seleccionar.js", { mapa: { [R.pc]: pc.url } });
    return { ...IMPL_REAL, sel: sel.mod, pc: pc.mod };
  });
  // 8 · lo que el perfil descarta deja un límite («no es de esta empresa» dicho como «falta contexto»)
  await M("lo descartado por lo declarado deja una línea de límite", ["C4"], async () => {
    const alc = await cargar("src/adi/conocimiento/alcance.js", { reemplazos: [[`return { aplica: false, motivo: "fuera_de_alcance", campo: c };`, `return { aplica: false, motivo: "falta_contexto", campos: [c] };`]] });
    const sel = await cargar("src/adi/conocimiento/seleccionar.js", { mapa: { [R.alc]: alc.url } });
    return { ...IMPL_REAL, sel: sel.mod, alc: alc.mod };
  });
  // 9 · un borrador se sirve
  await M("los borradores (CAU-06, CAU-03) se sirven", ["C10"], async () => {
    const sel = await cargar("src/adi/conocimiento/seleccionar.js", { reemplazos: [[`const firmadas = validas.filter((p) => p.estado === "firmada");`, `const firmadas = validas;`]] });
    return { ...IMPL_REAL, sel: sel.mod };
  });
  // 10 · PRI-04 vuelve a depender del perfil (la clasificación del owner deshecha)
  await M("PRI-04 vuelve a depender del sector y del modelo (la clasificación deshecha)", ["C1", "C12.texto"], async () => {
    const piezas = await cargar("src/adi/conocimiento/piezas.js", { reemplazos: [[`alcance: { ..._ALCANCE_UNIVERSAL },`, `alcance: { ..._ALCANCE_BASE },`]] });
    const sel = await cargar("src/adi/conocimiento/seleccionar.js", { mapa: { [R.piezas]: piezas.url } });
    return { ...IMPL_REAL, sel: sel.mod };
  });
  // 11 · CAU-01 vuelve a depender del sector (la ampliación aprobada, deshecha)
  await M("CAU-01 vuelve a depender del sector (la ampliación aprobada, deshecha)", ["C5"], async () => {
    const piezas = await cargar("src/adi/conocimiento/piezas.js", { reemplazos: [[`const _ALCANCE_CADENAS = { sector: "*",`, `const _ALCANCE_CADENAS = { sector: ["distribucion"],`]] });
    const sel = await cargar("src/adi/conocimiento/seleccionar.js", { mapa: { [R.piezas]: piezas.url } });
    return { ...IMPL_REAL, sel: sel.mod };
  });

  // control: el cargador sin mutación da exactamente lo mismo que el código real (la carnada no es un siempre-rojo)
  const selSinMutar = await cargar("src/adi/conocimiento/seleccionar.js");
  const copiaFiel = certificar({ ...IMPL_REAL, sel: selSinMutar.mod });
  ok(FALLAS(copiaFiel).length === 0, "control · el cargador de mutantes SIN mutación (seleccionar.js recargado desde su fuente) pasa toda la batería: las carnadas no son un siempre-rojo", FALLAS(copiaFiel).join(","));

  for (const m of MUT) {
    if (m.error) { ok(false, `★ CARNADA · ${m.nombre}: el mutante se cargó`, m.error && m.error.message); continue; }
    const r = certificar(m.impl);
    const rojos = FALLAS(r);
    const faltan = m.debenFallar.filter((id) => !rojos.includes(id));
    ok(rojos.length > 0 && faltan.length === 0, `★ CARNADA · ${m.nombre}: la batería se pone ROJA (${rojos.length} controles: ${rojos.slice(0, 6).join(", ")}), incluido ${m.debenFallar.join(", ")}`, `no se pusieron rojos: ${faltan.join(", ")} · rojos: ${rojos.join(", ")}`);
  }
}

/* ═══ 4 · LOS TEXTOS: encabezados, límite y su origen ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════ */
H("4 · los textos: los dos encabezados exactos, «declarado por la empresa» desde la tabla única de origen, el límite armado con datos (una por campo) y en tercera persona");
{
  ok(ALC.ENCABEZADOS.universal === ENC_UNIVERSAL, "★ el encabezado universal es EXACTAMENTE «Criterio general, independiente del perfil de la empresa:»", ALC.ENCABEZADOS.universal);
  ok(ALC.ENCABEZADOS.localizada(["modeloComercial"]) === ENC_LOCALIZADO_MODELO && ENC_LOCALIZADO_MODELO === "Aplica por el modelo comercial declarado por la empresa:", "★ el encabezado localizado es «Aplica por el modelo comercial declarado por la empresa:» y su frase de origen es la de ETIQUETA_ORIGEN", ALC.ENCABEZADOS.localizada(["modeloComercial"]));
  ok(ALC.ENCABEZADOS.localizada(["sector", "modeloComercial"]) === `Aplica por el sector y el modelo comercial ${ORIGEN_EMPRESA.replace(/^declarado/, "declarados")}:`, "con dos campos, el mismo encabezado concordado en plural (la frase de origen sigue saliendo de la tabla)", ALC.ENCABEZADOS.localizada(["sector", "modeloComercial"]));
  ok(!/declarad/.test(ALC.ENCABEZADOS.localizada(["tamano"])) && /tamaño/.test(ALC.ENCABEZADOS.localizada(["tamano"])), "la banda de tamaño (se calcula de los datos) NO se dice «declarada por la empresa»", ALC.ENCABEZADOS.localizada(["tamano"]));
  for (const c of ["sector", "tipoProducto", "modeloComercial", "pais"]) ok(ALC.ENCABEZADOS.localizada([c]).includes(ETIQUETA_DEL_CAMPO[c]), `el nombre del campo «${c}» sale de ETIQUETA_DEL_CAMPO («${ETIQUETA_DEL_CAMPO[c]}»)`);
  // el límite se arma con datos de la pieza y del campo
  const base = piezaPorId("CAU-01");
  const TODO = { sector: "*", tipoProducto: "*", modeloComercial: "*", pais: "*", banda: "*" };
  const conAlcance = (id, al) => ({ ...base, id, estado: "firmada", alcance: { ...TODO, ...al } });
  const linea = (campo, piezas) => PC.textoDeFaltaDeContexto(campo, piezas);
  ok(linea("modeloComercial", [base]) === LIMITE_CADENAS, "★ el límite de CAU-01 es la línea esperada, tercera persona, sin trato", linea("modeloComercial", [base]));
  ok(linea("modeloComercial", [conAlcance("X1", { modeloComercial: ["publico"] })]) === "Hay una referencia del oficio para empresas que venden al Estado o a empresas públicas; la empresa no ha declarado su modelo comercial.", "★ cambia el alcance de la pieza y cambia la línea: sale de los datos de la pieza, no escrita a mano por pieza");
  ok(linea("sector", [conAlcance("X2", { sector: ["fabricacion"] })]) === "Hay una referencia del oficio para empresas que producen lo que venden; la empresa no ha declarado su sector.", "el límite de una pieza de fabricación habla del sector");
  ok(/^Hay referencias del oficio para empresas que .*, o que .*; la empresa no ha declarado su modelo comercial\.$/.test(linea("modeloComercial", [base, conAlcance("X3", { modeloComercial: ["comercios"] })])), "dos piezas del mismo campo: plural y las dos poblaciones, en una sola línea", linea("modeloComercial", [base, conAlcance("X3", { modeloComercial: ["comercios"] })]));
  ok(/^Hay una referencia del oficio para empresas que tienen la mayor parte de su venta en Chile; la empresa no ha declarado su país\.$/.test(linea("pais", [conAlcance("X4", { pais: ["CL"] })])), "el país sale del rótulo de la taxonomía");
  ok(/tamaño/.test(linea("tamano", [conAlcance("X5", { banda: ["pequena"] })])) && !/declarado su/.test(linea("tamano", [conAlcance("X5", { banda: ["pequena"] })])), "la banda de tamaño no se «declara»: la línea dice que no se pudo calcular");
  // un campo faltante = una línea (aunque dos piezas dependan de él); dos campos faltantes = dos líneas
  const delPRI = (id, al) => ({ ...piezaPorId("PRI-04"), id, estado: "firmada", alcance: { ...TODO, ...al } });   // el cuerpo de PRI-04 (pertinente a cobranza) con alcance localizado
  const cat2 = [delPRI("Y1", { modeloComercial: ["cuentas_grandes"] }), delPRI("Y2", { modeloComercial: ["cuentas_grandes"], sector: ["distribucion"] })];
  const r2 = ref(IMPL_REAL, D.vacio, ENC.cob, { catalogo: cat2 });
  const ls2 = textos(r2).filter(esLimite);
  ok(ls2.length === 2 && ls2.some((t) => /su modelo comercial\.$/.test(t)) && ls2.some((t) => /su sector\.$/.test(t)), "★ dos piezas que dependen del mismo campo: UNA línea por campo faltante (no por pieza); un campo más, una línea más", jj(ls2));
  // las poblaciones salen de la taxonomía: cada opción del alcance (menos «ninguno») tiene su frase
  for (const c of ["sector", "tipoProducto", "modeloComercial"]) {
    const sinFrase = TAXONOMIA_PERFIL[LISTA_DE_CAMPO_PERFIL[c]].filter((cod) => cod !== "ninguno" && !(PC.ROTULOS_PERFIL[c].opciones[cod] || {}).empresasQue);
    ok(sinFrase.length === 0, `cada opción de «${c}» tiene su frase «empresas que …» (un código nuevo sin frase lo marca este control)`, sinFrase.join(","));
  }
  const frases = [];
  for (const c of ["sector", "tipoProducto", "modeloComercial"]) for (const o of Object.values(PC.ROTULOS_PERFIL[c].opciones)) if (o.empresasQue) frases.push(o.empresasQue);
  ok(frases.length > 10 && frases.every((f) => !TRATO.test(f) && !/plata|guita|vara|dormid/i.test(f)), "las frases de población van en tercera persona y en registro de la casa");
}

/* el barrido de atribuciones de `_procedencia_gate` §9 incluye los encabezados nuevos: el universal nombra a la empresa para decir que el criterio NO es suyo (frase NEUTRAL, retirada de la cláusula) y el resto de la cláusula se sigue juzgando */
{
  const { atribuciones, esFalsa } = await import("./scripts/procedencia/lexicoAtribucion.mjs");
  const CLAVE = ["pisoMaterialidadCobranza"];
  const NO_ATRIBUYEN = [/plazos?\s+(?:de\s+pago\s+)?declarad[oa]s?/i];
  const t = textos(ref(IMPL_REAL, D.vacio, ENC.cob)).find((x) => piezaDelTexto(x) === "PRI-04");
  const falsas = (x) => atribuciones(x, { claves: CLAVE, excluir: NO_ATRIBUYEN }).filter((a) => esFalsa(a, new Set()));
  ok(!!t && t.startsWith(ENC_UNIVERSAL) && falsas(t).length === 0, "★ el texto real de PRI-04 con su encabezado universal (empresa sin piso declarado): CERO atribuciones falsas por significado");
  const mala = t.replace("y deber mucho.", "y deber mucho, según lo declarado por tu empresa.");
  ok(mala !== t && falsas(mala).length > 0, "★ CARNADA · una atribución falsa en la MISMA cláusula que el encabezado universal sigue marcándose (la frase neutral se retira, la cláusula no se salta)");
  ok(falsas(t.replace(ENC_UNIVERSAL, ENC_LOCALIZADO_MODELO)).length > 0, "★ CARNADA · la referencia general con el encabezado «declarado por la empresa» (sin declaración) se marca falsa");
  ok(falsas(t.replace(ENC_UNIVERSAL, "Criterio general de la empresa:")).length > 0, "★ CARNADA · y «Criterio general de la empresa:» (la referencia general dicha criterio propio) también");
}

/* ═══ 5 · LA ENTREGA: cifras, libro y mediciones idénticos (cuatro rutas, capa encendida/apagada, con/sin perfil) ═══════════════════════════════════════════════════════════════════════════════════ */
H("5 · las cuatro rutas de componer.js: cifras y libro idénticos con la capa encendida/apagada y con/sin perfil; lo único que cambia es «Referencia del oficio»");
{
  /* con la capa ENCENDIDA dos límites de `componer.js` cambian de redacción o se retiran (opción A del owner; §9 los certifica): se enmascaran en las dos corridas */
  const LIMITES_DE_LA_CAPA = ["Sin perfil completo del cliente todavía", "Sin conocimiento del sector cargado todavía"];
  const sinLimitesDeLaCapa = (t) => LIMITES_DE_LA_CAPA.reduce((x, ti) => x.split("\n").filter((ln) => !ln.startsWith(`- **${ti}.**`)).join("\n"), t);
  const enmascarar = (Rx) => JSON.stringify({
    ok: Rx.ok,
    texto: sinLimitesDeLaCapa(Rx.texto)
      .replace(/\*\*Referencia del oficio\*\*[\s\S]*?(?=\n\*\*Preguntas abiertas y supuestos a validar)/, "**Referencia del oficio** [omitido]\n\n")
      .replace(/\*\*Qué más puedo calcular\.\*\*[\s\S]*$/, "**Qué más puedo calcular.** [omitido]"),
    entrega: (({ referenciaDelOficio: _r, queMasPuedoCalcular: _q, limites: _l, ...resto }) => ({ ...resto, limites: (_l || []).filter((l) => !LIMITES_DE_LA_CAPA.includes(l.titulo)) }))(Rx.entrega),
  });
  const rutas = [
    ["BrechaComercial", componerEntregaBrechaComercial, PREGUNTA_BRECHA_COMERCIAL], ["Cobranza", componerEntregaCobranza, PREGUNTA_COBRANZA],
    ["Inventario", componerEntregaInventario, PREGUNTA_INVENTARIO], ["Multidominio", componerEntregaMultidominio, PREGUNTA_MULTIDOMINIO],
  ];
  const sinPerfil = D.vacio, conPerfil = D.completo;
  let cifrasPorRuta = 0;
  for (const [n, fn, pregunta] of rutas) {
    const corrida = (d, activo) => conTenantActivo(d, () => fn({ scenario: ESCENARIO_INICIAL, pregunta, conocimientoActivo: activo }));
    const sOff = corrida(sinPerfil, false), sOn = corrida(sinPerfil, true), cOff = corrida(conPerfil, false), cOn = corrida(conPerfil, true);
    ok(sOff.ok && sOn.ok && cOff.ok && cOn.ok, `${n}: compone en las cuatro combinaciones (capa apagada/encendida × sin/con perfil)`);
    ok(enmascarar(sOff) === enmascarar(sOn) && enmascarar(cOff) === enmascarar(cOn), `★ ${n}: con la capa encendida la Entrega es BYTE-IDÉNTICA a la apagada fuera de «Referencia del oficio» (con y sin perfil)`);
    const nucleo = (x) => jj({ cifras: x.entrega.cifras, respuesta: x.entrega.respuesta, universos: x.entrega.universos, libro: x.libro });
    ok(nucleo(sOff) === nucleo(sOn) && nucleo(sOn) === nucleo(cOff) && nucleo(cOff) === nucleo(cOn) && nucleo(sOff).length > 500, `★ ${n}: las CIFRAS, la respuesta, los universos y el LIBRO de hechos son idénticos en las cuatro combinaciones`, `${nucleo(sOff).length}`);
    ok(sOff.entrega.referenciaDelOficio.length === 0 && cOff.entrega.referenciaDelOficio.length === 0, `${n}: con la capa APAGADA la referencia del oficio es [] (con y sin perfil: byte-idéntico a hoy)`);
    ok(sOn.entrega.referenciaDelOficio.every((r) => !/^Aplica por /.test(r.texto)), `${n}: con la capa encendida y SIN perfil no sale ninguna referencia localizada`);
    if (n === "Cobranza") ok(sOn.entrega.referenciaDelOficio.some((r) => r.texto.startsWith(ENC_UNIVERSAL)) && cOn.entrega.referenciaDelOficio.some((r) => r.texto.startsWith(ENC_UNIVERSAL)), "★ Cobranza con la capa encendida: PRI-04 se sirve con y SIN perfil (la capa ya no se apaga entera)");
    cifrasPorRuta++;
  }
  ok(cifrasPorRuta === 4, "las cuatro rutas certificadas");
  initTenant(TENANT_DEMO);
}

/* ═══ 6 · CATÁLOGOS SELLADOS v13–v40, CAPA APAGADA — byte-idénticos ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════ */
H("6 · catálogos sellados v13–v40 con la capa apagada: el texto de cada Entrega es el de siempre (el mismo hash que certifica `_procedencia_gate`)");
{
  ok(ADI_CONOCIMIENTO === false, "la capa está APAGADA bajo Node (en todos los perfiles): nada de este bloque cambia lo que se sirve hoy");
  const MUESTRA = JSON.parse(fs.readFileSync(new URL("./fixtures/procedencia/muestra-v13-v40.json", import.meta.url), "utf8")).casos;
  const SIM_VIEJA = "Simulación declarada por la empresa", SIM_NUEVA = "Simulación planteada en la consulta";
  const SUP_VIEJA = "El supuesto lo declaró la empresa;", SUP_NUEVA = "El supuesto fue planteado en la consulta;";
  const alAntes = (t) => String(t).split(SIM_NUEVA).join(SIM_VIEJA).split(SUP_NUEVA).join(SUP_VIEJA).split("Nivel de referencia de carga").join("Nivel de carga declarado").split("nivel de referencia de carga").join("nivel de carga declarado");
  const FIJADOS = new Set(["v22:S12", "v21:T12", "v31:H12", "v21:T18"]);   // los cuatro textos del demo que difieren a propósito, pinneados por `_procedencia_gate` §1 (glosario neutral y tope de palabras)
  initTenant(TENANT_DEMO);
  const distintos = MUESTRA.filter((c) => { const r = componerEntrega(validarEncargo(c.encargo, {})); const t = r && r.ok ? r.texto : null; return t == null || sha(alAntes(t)) !== c.sha; });
  const inesperados = distintos.filter((c) => !FIJADOS.has(c.id));
  ok(MUESTRA.length > 400 && inesperados.length === 0 && distintos.length <= FIJADOS.size, `★ ${MUESTRA.length - distintos.length} de ${MUESTRA.length} Entregas de los 28 catálogos sellados son IDÉNTICAS a las de antes (los ${distintos.length} que difieren son los fijados por _procedencia_gate)`, inesperados.slice(0, 4).map((c) => c.id).join(", "));
}

/* ═══ 7 · EL CÓDIGO: una sola lectura del alcance y ningún encabezado escrito a mano ═════════════════════════════════════════════════════════════════════════════════════════════════════════════ */
H("7 · candado de código: `pieza.alcance[...]` se lee en UN solo lugar · ningún encabezado escrito fuera de la tabla · «Para toda empresa» no existe en `src/`");
{
  const fuentes = {};
  (function recorrer(dir) { for (const f of fs.readdirSync(dir, { withFileTypes: true })) { const p = path.join(dir, f.name); if (f.isDirectory()) recorrer(p); else if (/\.(js|jsx|mjs)$/.test(f.name)) fuentes[p.replace(/\\/g, "/")] = fs.readFileSync(p, "utf8"); } })("src");
  const barrer = (fs_, re, permitidas) => Object.entries(fs_).filter(([r]) => !permitidas.includes(r)).filter(([, s]) => re.test(sinComentarios(s))).map(([r]) => r);
  const RE_LECTURA = /\.alcance\s*\[|Array\.isArray\(\s*[\w$.]*\balcance\b|\balcance\s*\[\s*(?:LLAVE|["'`](?:sector|tipoProducto|modeloComercial|pais|banda))/;
  const permitidas = ["src/adi/conocimiento/alcance.js"];
  ok(Object.keys(fuentes).length > 200 && barrer(fuentes, RE_LECTURA, permitidas).length === 0, "★ `pieza.alcance[...]` se lee SOLO en `conocimiento/alcance.js` (la lista de campos de los que depende una pieza tiene una sola fuente)", jj(barrer(fuentes, RE_LECTURA, permitidas)));
  ok(RE_LECTURA.test(sinComentarios("const f = (pieza) => Array.isArray(pieza.alcance[\"sector\"]);")) && barrer({ ...fuentes, "src/adi/conocimiento/nuevo.js": "export const x = (p) => p.alcance[\"sector\"].includes(1);" }, RE_LECTURA, permitidas).length === 1, "★ CARNADA · una segunda lectura del alcance fuera de alcance.js pone el candado en ROJO");
  const FRASES = /Criterio general, independiente|Aplica por el|Aplica por \$\{|Para toda empresa|Para todas las empresas/i;
  const sitiosFrase = Object.entries(fuentes).filter(([, s]) => FRASES.test(sinComentarios(s))).map(([r]) => r).sort();
  ok(jj(sitiosFrase) === jj(["src/adi/conocimiento/alcance.js"]), "★ los encabezados viven en UN solo archivo (la tabla de `alcance.js`): ningún composer los escribe a mano, y «Para toda empresa» no existe en el código", jj(sitiosFrase));
  ok(Object.keys({ ...fuentes, "src/adi/conocimiento/nuevo.js": "export const h = 'Para toda empresa:';" }).filter((r) => FRASES.test(sinComentarios(({ ...fuentes, "src/adi/conocimiento/nuevo.js": "export const h = 'Para toda empresa:';" })[r]))).length === 2, "★ CARNADA · un encabezado «Para toda empresa:» escrito en cualquier archivo pone el candado en ROJO");
  const alc = sinComentarios(fuentes["src/adi/conocimiento/alcance.js"]);
  ok(/ETIQUETA_ORIGEN\[ORIGEN\.EMPRESA\]/.test(alc) && !/declarad[oa]s? por la empresa/i.test(alc), "★ «declarado por la empresa» sale de `ETIQUETA_ORIGEN` en alcance.js: la frase no está escrita a mano (el barrido de `_procedencia_gate` §5 la cuida en todo `src/`)");
  ok(!/^\s*(?:let|var)\s/m.test(alc), "alcance.js no guarda estado de módulo (otra empresa nunca ve el perfil de esta: las funciones reciben el perfil por parámetro)");
}

/* ═══ 8 · LA REGLA NUEVA EN EL CANDADO VIEJO — «sin perfil completo no se entrega nada» ya no existe ═══════════════════════════════════════════════════════════════════════════════════════════════ */
H("8 · la ley vieja («sin perfil completo no se entrega nada») ya no gobierna esta capa; `perfilAutorizaConocimiento` solo queda para el camino de la bandera apagada");
{
  const sel = sinComentarios(fs.readFileSync("src/adi/conocimiento/seleccionar.js", "utf8"));
  ok(!/perfilAutorizaConocimiento/.test(sel), "★ `seleccionar.js` ya no consulta `perfilAutorizaConocimiento` (la puerta del perfil completo se retiró)");
  ok(P.vacio.completo === false && P.completo.completo === true, "control · el perfil vacío está incompleto y el de la empresa completa está completo (los dos casos que la ley vieja distinguía)");
  const sinPerfilServido = textos(ref(IMPL_REAL, D.vacio, ENC.cob)).length > 0;
  ok(sinPerfilServido, "★ con perfil INCOMPLETO y la capa encendida, la capa ya NO queda muda: sirve lo universal");
}

/* ═══ 9 · LA ENTREGA DICE LA VERDAD DE LA REGLA NUEVA — solo con la capa ACTIVA (opción A del owner, frontera estricta) ═══════════════════════════════════════════════════════════════════════════════ */
H("9 · `componer.js` con la capa ACTIVA: ninguna frase dice que no se aplica conocimiento del oficio cuando se sirvió · con la capa APAGADA: byte-idéntico al HEAD c621516e");
{
  const TENANT_C = { ...TENANT_DEMO, perfil: { ...TENANT_DEMO.perfil, sector: { valor: "distribucion", procedencia: "declarado" }, tipoProducto: { valor: "durable", procedencia: "declarado" }, pais: { valor: "CL", procedencia: "declarado" }, modeloComercial: { valor: "cuentas_grandes", procedencia: "declarado" } } };
  /* sha256 (16) de JSON.stringify(resultado entero: texto + entrega + libro) de cada ruta con la capa APAGADA, medido con el `componer.js` del HEAD c621516e (ANTES de este ajuste). Si cambia un byte con la capa apagada, esto arde.
   * ⚠️ BLOQUE «TAMAÑO GENERAL DE ADI» (owner 2026-10-05): la banda de tamaño ya no se calcula con la UF sino en US$ con el tipo de cambio del mes de cierre, y el perfil que viaja en `entrega.marco.perfil`
   * trae la TRAZA de esa banda (`campos.tamano.fuente` + `campos.tamano.insumos`) con otro contenido. Esa traza es lo ÚNICO que cambia (verificado con el HEAD en un worktree: el diff estructural de las
   * ocho salidas completas son exactamente esos dos campos —ni el texto, ni las cifras, ni el libro, ni el resto del perfil—). Por eso el hash se toma con ESA traza neutralizada (la banda y su procedencia
   * SÍ cuentan) y los PIN son los hashes del HEAD c621516e re-medidos con la misma neutralización: los de antes, byte a byte, salvo la traza. */
  const sinTrazaDeBanda = (R) => { const c = JSON.parse(JSON.stringify(R)); const t = c && c.entrega && c.entrega.marco && c.entrega.marco.perfil && c.entrega.marco.perfil.campos && c.entrega.marco.perfil.campos.tamano; if (t) { t.fuente = null; t.insumos = null; } return c; };
  const PIN = {
    /* CIFRAS FIJADAS DEL DEMO, RE-FIJADAS (una sola realidad, owner 2026-10-06, diseño §6.5 ii): los ocho hashes llevan las cifras de las TABLAS corregidas (§2 a–d) y los dos efectos de diseño sobre el libro (Makita ahora tiene variación vs año anterior → una fila más en rankings.marca.variacion; la variación de La Polar y la de Ripley cambian de orden en la fila YoY: «cede más» es La Polar). Medido con el árbol del HEAD (98ad5c03) contra el actual, las ocho salidas completas: fuera de las cifras, lo único que cambia es eso (la fila de Makita y el intercambio Ripley↔La Polar en las cifras YoY del libro). */
    /* MARCA Y FAMILIA = LA SUMA DE SUS SKU (owner 2026-10-06, §2-bis): los ocho hashes se RE-FIJAN otra vez. Medido contra el árbol del commit cd16580a (mismas ocho salidas, capa apagada): fuera de las cifras lo único que cambia es el ORDEN de las dos primeras filas de cada ranking de marca del libro (Philips pasa a la primera: la tabla de marca se sirve ordenada por contribución). */
    /* ENSAYO 11 (owner 2026-10-09): los dos hashes de Multidominio se RE-FIJAN. Causa ÚNICA, medida: la ruta fija declara además el universo `prioridad_integrada_orden` (la prioridad entera, en su orden: `soloRanking`, no autoriza cifras de nadie). Quitado ese universo de la salida, el hash es EXACTAMENTE el de antes (demo b8064d4586ffa260 · completo ded2566fca2289f7): el texto, las cifras y el libro no cambian un byte. */
    demo: { BrechaComercial: "7a7d0d3fe6764e44", Cobranza: "8b005a18dff8d5b9", Inventario: "ac8180f388cfe6fe", Multidominio: "6f8f33a7cead3633" },
    completo: { BrechaComercial: "74e68edb85b73f40", Cobranza: "d9598a6c263bfe9c", Inventario: "bbf0fd917a969059", Multidominio: "ccd22da711518d47" },
  };
  const EMP = { demo: TENANT_DEMO, completo: TENANT_C };
  const FALSA = /no aplica conocimiento del oficio|todavía no está construido|Sin conocimiento del sector cargado|aunque el catálogo lo tuviera/i;
  const certificarComposer = (mod) => {
    const C = {}, det = {};
    const set = (id, c, d = "") => { C[id] = Boolean(c); if (!c) det[id] = String(d).slice(0, 400); };
    const rutas = { BrechaComercial: [mod.componerEntregaBrechaComercial, PREGUNTA_BRECHA_COMERCIAL], Cobranza: [mod.componerEntregaCobranza, PREGUNTA_COBRANZA], Inventario: [mod.componerEntregaInventario, PREGUNTA_INVENTARIO], Multidominio: [mod.componerEntregaMultidominio, PREGUNTA_MULTIDOMINIO] };
    // capa APAGADA: byte-idéntico al HEAD (explícita y por defecto, que bajo Node es apagada)
    { const malas = [];
      for (const [e, T] of Object.entries(EMP)) for (const [r, [fn, p]] of Object.entries(rutas)) {
        const h1 = sha(JSON.stringify(sinTrazaDeBanda(conTenantActivo(T, () => fn({ pregunta: p, conocimientoActivo: false })))));
        const h2 = sha(JSON.stringify(sinTrazaDeBanda(conTenantActivo(T, () => fn({ pregunta: p })))));
        if (h1 !== PIN[e][r] || h2 !== PIN[e][r]) malas.push(`${e}/${r}`);
      }
      set("OFF", malas.length === 0, malas.join(",")); }
    // capa ACTIVA, empresa sin perfil: PRI-04 servida (Cobranza, Multidominio) → ninguna frase afirma que no hay conocimiento / que no se aplica
    { const malas = [];
      for (const r of ["Cobranza", "Multidominio"]) {
        const [fn, p] = rutas[r];
        const R = conTenantActivo(TENANT_DEMO, () => fn({ pregunta: p, conocimientoActivo: true }));
        const sirvio = R.entrega.referenciaDelOficio.some((x) => x.texto.startsWith(ENC_UNIVERSAL));
        const todo = R.texto + "\n" + JSON.stringify(R.entrega.limites);
        if (!sirvio) malas.push(`${r}: PRI-04 no se sirvió`);
        if (FALSA.test(todo)) malas.push(`${r}: ${(todo.match(FALSA) || [""])[0]}`);
      }
      set("ON.sirvio", malas.length === 0, malas.join(" | ")); }
    // el límite de perfil incompleto, con la capa activa, es el de la regla nueva (sale de `alcance.js`, desde ETIQUETA_DEL_CAMPO)
    { const malas = [];
      for (const [r, [fn, p]] of Object.entries(rutas)) {
        const R = conTenantActivo(TENANT_DEMO, () => fn({ pregunta: p, conocimientoActivo: true }));
        const lim = R.entrega.limites.find((l) => l.titulo === "Sin perfil completo del cliente todavía");
        const esperado = ALC.textoDePerfilIncompletoConCapa(P.vacio.faltantes);
        if (!lim || lim.motivo !== esperado || /no aplica conocimiento del oficio/i.test(lim.motivo)) malas.push(r);
      }
      set("ON.perfil", malas.length === 0, malas.join(",")); }
    // capa activa pero NADA del conocimiento corresponde (Inventario: sección vacía): lo que sigue siendo verdad se conserva
    { const R = conTenantActivo(TENANT_DEMO, () => rutas.Inventario[0]({ pregunta: PREGUNTA_INVENTARIO, conocimientoActivo: true }));
      set("ON.vacia", R.entrega.referenciaDelOficio.length === 0 && R.entrega.limites.some((l) => l.titulo === "Sin conocimiento del sector cargado todavía"), "Inventario con la sección vacía conserva su límite verdadero"); }
    return { C, det };
  };
  const REAL = certificarComposer({ componerEntregaBrechaComercial, componerEntregaCobranza, componerEntregaInventario, componerEntregaMultidominio });
  const nombres = {
    OFF: "★ capa APAGADA: las cuatro rutas (con y sin perfil, con la bandera explícita y por defecto) son BYTE-IDÉNTICAS al HEAD c621516e — texto, estructura y libro",
    "ON.sirvio": "★ capa ACTIVA sin perfil + PRI-04 servida (Cobranza, Multidominio): ninguna frase dice que no se aplica conocimiento del oficio ni que no hay conocimiento cargado",
    "ON.perfil": "★ capa ACTIVA: «Sin perfil completo del cliente todavía» dice la regla nueva (texto de `alcance.js`, sin la ley vieja) en las cuatro rutas",
    "ON.vacia": "capa ACTIVA con la sección vacía (nada del conocimiento corresponde): el límite que sigue siendo verdad se conserva",
  };
  for (const [id, m] of Object.entries(nombres)) ok(REAL.C[id] === true, m, REAL.det[id] || "");
  // carnadas sobre `componer.js` real mutado
  const mutar = async (reemplazo) => (await cargar("src/adi/entrega/componer.js", { reemplazos: [reemplazo] })).mod;
  const mA = certificarComposer(await mutar([`if (!_capaActiva(conocimientoActivo)) return;`, `return;`]));
  ok(!mA.C["ON.sirvio"] && !mA.C["ON.perfil"] && mA.C.OFF, "★ CARNADA · si la Entrega conserva las frases de la ley vieja con la capa activa («Sin conocimiento del sector cargado todavía», «ADI no aplica conocimiento del oficio…») el gate se pone ROJO");
  const mB = certificarComposer(await mutar([`if (!_capaActiva(conocimientoActivo)) return;`, ``]));
  ok(!mB.C.OFF, "★ CARNADA · si el ajuste actúa con la capa APAGADA (un byte distinto en cualquier ruta) el gate se pone ROJO");
  const srcC = sinComentarios(fs.readFileSync("src/adi/entrega/componer.js", "utf8"));
  ok((srcC.match(/^\s+_coherenciaConLaCapa\(entrega,/gm) || []).length === 5 && /if \(!_capaActiva\(conocimientoActivo\)\) return;/.test(srcC), "las cinco rutas (las cuatro fijas y el camino general) pasan por el ajuste, y el ajuste sale de inmediato con la capa apagada");
  ok(!/Solo quedan sin aplicar|textoDePerfilIncompletoConCapa/.test(srcC.replace(/textoDePerfilIncompletoConCapa/g, "")) , "el texto de la regla nueva NO está duplicado en `componer.js`: sale de `alcance.js`");
  initTenant(TENANT_DEMO);
}

console.log(`\n── _universal_localizado_gate: PASS ${pass} · FAIL ${fail} (de ${pass + fail}) ──`);
if (fail) { console.log("FALLAS:\n" + fails.map((f) => " ✗ " + f).join("\n")); process.exit(1); }
