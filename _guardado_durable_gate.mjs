/* === _guardado_durable_gate.mjs · EL GUARDADO DURABLE DE LA CONTINUIDAD (Etapa 2, bloque 1 · owner 2026-10-02, offline) ===
 * La memoria de empresa y el libro de conversación tienen que SOBREVIVIR a un reinicio y NO mezclar empresas. Este
 * candado prueba tres defectos que el inventario de la Etapa 2 destapó, SIN red y sin tocar Supabase (las migraciones
 * 012-015 no están aplicadas): la base se simula con `scripts/doble-supabase-continuidad.mjs` (un transporte de
 * PostgREST con latencia aleatoria de semilla fija) y TODO el código bajo prueba es el de producción — la puerta
 * (`capacidad/puerta.js`), las cuatro acciones, `empresa.js`, `libro.js` y el adaptador REAL `almacenSupabase.js`.
 *
 *   D1 · el almacén de Supabase era asíncrono y quien lo usaba, síncrono (`.filter is not a function`): ahora hay UNA
 *        interfaz, asíncrona, para la memoria y para la base, y todo consumidor la espera. Una lectura que FALLA ya no
 *        se confunde con «no existe» (antes un error de red hacía abrir un libro vacío y pisar el real).
 *   D2 · al volverse asíncronas las acciones, la base queda FUERA del tramo entre `initTenant` y el cálculo del Core:
 *        leer → tramo síncrono (`conTenantActivo`) → salir → escribir. Dos empresas atendidas a la vez no se mezclan.
 *   D3 · los hilos del Complemento (título vacío, cero mensajes) no aparecen en el Historial de la app: lo decide un
 *        dato ESTRUCTURAL —el origen del hilo, sellado por la base—, no un filtro por título vacío.
 *
 * CADA CONTROL TIENE SU CARNADA: una versión del código de ANTES (el almacén asíncrono usado como síncrono; el orden
 * `initTenant → await → Core`; leer sin distinguir «no existe» de «falló»; guardar sin candado por conversación; la
 * memoria del proceso como si fuera durable; el Historial sin la condición de origen; un pase cruzado) que el control
 * TIENE que marcar. Un control que no muerde a su carnada no mide nada.
 *
 * LA PRUEBA DE ACEPTACIÓN (§5): el guion del owner —empresa A y B intercaladas turno a turno, con las MISMAS entidades y
 * cifras distintas; consultar → aportar contexto declarado → confirmar → consultar; REINICIO REAL (un proceso nuevo de
 * Node; solo sobrevive la base); retomar A y retomar B idénticas a lo entregado, con huellas sha256 iguales y cero
 * mezcla— más cientos de conversaciones intercaladas al azar (§6).
 *
 * CERO llamadas a un LLM · CERO red. Solo por `npm run gates:offline` o
 * `node --import ./scripts/offline-guard.mjs _guardado_durable_gate.mjs`. */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { initTenant, getTenantData } from "./src/data/tenantStore.js";
import { esTenantVacio } from "./src/data/tenantEmpty.js";
import { validarEncargo } from "./src/adi/encargo/validar.js";
import { componerEntrega } from "./src/adi/entrega/componer.js";
import { crearAcciones } from "./src/adi/capacidad/acciones.js";
import { conTenantActivo } from "./src/adi/capacidad/aislamiento.js";
import { crearAlmacenEnMemoria, verificarAlmacen, ErrorDeAlmacen, esErrorDeAlmacen } from "./src/adi/continuidad/almacen.js";
import * as EMP from "./src/adi/continuidad/empresa.js";
import { libroNuevo, registrarEntrega, ORIGEN_LIBRO, expandirLibro, comprimirLibro } from "./src/adi/continuidad/libro.js";
import { colasAbiertas } from "./src/adi/continuidad/serializar.js";
import { crearAlmacenSupabase } from "./src/adi/continuidad/almacenSupabase.js";
import { crearClienteRest } from "./src/data/supabaseRest.js";
import { emitirPase } from "./src/data/paseTenant.js";
import { makeAccessCode } from "./src/adi/llm/accessToken.js";
import { guardarConversacion, listarConversaciones, leerConversacion } from "./src/ingesta/persistirCarga.server.js";
import { crearSupabaseFalso, crearAzar } from "./scripts/doble-supabase-continuidad.mjs";
import * as G from "./scripts/guion-continuidad.mjs";
import { armarEntornoDoble, packDeEmpresa, importarPuertaFresca, EMPRESAS_DEL_GUION, SECRETO_JWT, SECRETO_TOKEN, URL_DOBLE, APIKEY_DOBLE } from "./scripts/guion-continuidad-doble.mjs";

let pass = 0, fail = 0;
const fails = [];
const ok = (c, m, extra = "") => { if (c) { pass++; } else { fail++; fails.push(m + (extra ? " — " + extra : "")); console.log("  ✗ " + m + (extra ? "\n      " + extra : "")); } };
const H = (t) => console.log(`\n${t}`);
const SEMILLA = 20261002;

/* ── el reloj de las acciones: determinista (la hora real no entra al candado) ─────────────────────────────────── */
let _tick = 0;
const relojDeGate = () => new Date(Date.UTC(2026, 9, 2, 12, 0, 0) + (++_tick) * 1000).toISOString();

/* ── seis empresas con LAS MISMAS entidades y cifras distintas ──────────────────────────────────────────────────── */
const EMPRESAS = [
  { id: "e1", nombre: "Comercial Alfa", factor: 1, version: 1 }, { id: "e2", nombre: "Comercial Beta", factor: 2.5, version: 2 },
  { id: "e3", nombre: "Comercial Gamma", factor: 0.4, version: 3 }, { id: "e4", nombre: "Comercial Delta", factor: 3.7, version: 4 },
  { id: "e5", nombre: "Comercial Épsilon", factor: 0.65, version: 5 }, { id: "e6", nombre: "Comercial Zeta", factor: 5.3, version: 6 },
].map((E) => ({ ...E, etiqueta: `ref-${E.id}` }));
const ENTIDADES = ["Jumbo", "Falabella", "Lider", "Sodimac", "Tottus"];

async function crearHarness({ empresas = EMPRESAS, migraciones = ["015"], modoListado = "015", latenciaMaxMs = 3, semilla = SEMILLA, planes = {} } = {}) {
  const db = crearSupabaseFalso({
    secretoJwt: SECRETO_JWT, semilla, latenciaMaxMs, migraciones, modoListado,
    tenants: empresas.map((E) => ({ id: E.id, nombre: E.nombre, plan: planes[E.id] || "pro", version: E.version, sello: { nota: `carga ${E.version}` }, pack: packDeEmpresa(E) })),
  });
  const cliente = crearClienteRest({ url: URL_DOBLE, apikey: APIKEY_DOBLE, transporte: db.transporte });
  const almacenDe = async (idEmpresa, paseDe = idEmpresa) => {
    const p = await emitirPase({ tenantId: paseDe, secreto: SECRETO_JWT });
    return crearAlmacenSupabase({ url: URL_DOBLE, apikey: APIKEY_DOBLE, pase: p.pase, transporte: db.transporte });
  };
  const tenantDe = (E) => ({ id: E.id, nombre: E.nombre, dataset: JSON.parse(JSON.stringify(db.packServido(E.id))), version: E.version, sello: db.versionDe(E.id).sello });
  /* UNA acción POR PEDIDO, con el almacén de ESA empresa — igual que `puerta.js` */
  const accionesDe = async (E, { fabrica = null } = {}) => crearAcciones({ continuidad: fabrica ? await fabrica(E) : await almacenDe(E.id), ahora: relojDeGate });
  return { db, cliente, almacenDe, tenantDe, accionesDe, empresas };
}

/* lo esperado de cada empresa/entidad, calculado SECUENCIALMENTE, sin concurrencia y sin base (el oráculo) */
const hOraculo = await crearHarness({ latenciaMaxMs: 0 });
const ESPERADO = {};
for (const E of EMPRESAS) {
  ESPERADO[E.id] = {};
  const acc = crearAcciones({ continuidad: crearAlmacenEnMemoria(), ahora: relojDeGate });
  for (const ent of ENTIDADES) {
    const r = G.resumirConsulta(await acc.consultar({ tenant: hOraculo.tenantDe(E), encargo: G.encargoDeVentas(ent) }));
    ESPERADO[E.id][ent] = { empresa: r.empresa, valor: r.cifras[0] && r.cifras[0].valor };
  }
}
/* lo que identifica a cada empresa DENTRO DE UN TEXTO: su nombre y su centinela. Las cifras no se buscan como subcadena
 * (un «$6.8M» de una empresa puede coincidir por casualidad con otra cifra —una contribución, un total— del texto de
 * otra): se controlan ESTRUCTURALMENTE, contra el conjunto de cifras que ESA empresa recibió. */
const MARCADORES = Object.fromEntries(EMPRESAS.map((E) => [E.id, [E.nombre, E.etiqueta]]));
const CIFRAS = Object.fromEntries(EMPRESAS.map((E) => [E.id, new Set(ENTIDADES.map((e) => ESPERADO[E.id][e].valor))]));
const cifrasAjenasEnLibros = (db) => {
  const v = [];
  for (const E of EMPRESAS) for (const c of db.filasDeEmpresa(E.id).conversaciones) for (const en of ((c.estado && expandirLibro(c.estado).entregas) || [])) for (const x of (en.hechos || [])) if (!CIFRAS[E.id].has(x.valor)) v.push({ empresa: E.id, hilo: c.hilo_id, cifra: x.valor });
  return v;
};
{
  H("0 · el campo de prueba: seis empresas con las MISMAS entidades y NINGUNA cifra en común");
  const todas = EMPRESAS.flatMap((E) => ENTIDADES.map((e) => ESPERADO[E.id][e].valor));
  ok(todas.every(Boolean) && new Set(todas).size === todas.length, `las ${todas.length} cifras (6 empresas × ${ENTIDADES.length} entidades) son todas distintas: una mezcla siempre se ve`, JSON.stringify(todas));
  ok(EMPRESAS.every((E) => ENTIDADES.every((e) => ESPERADO[E.id][e].empresa === E.nombre)), "cada Entrega nombra a SU empresa en el Marco");
}

/* utilidades de control */
const sinComentarios = (src) => String(src).replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`\\])\/\/[^\n]*/g, "$1");
const leer = (p) => fs.readFileSync(new URL(p, import.meta.url), "utf8");

/* ═══ 1 · D1 · UNA INTERFAZ DE ALMACÉN, ASÍNCRONA, PARA LA MEMORIA Y PARA SUPABASE ═══════════════════════════════════ */
H("1 · D1 · una sola interfaz de almacén, asíncrona: la memoria y Supabase la cumplen igual y los consumidores la esperan");
{
  const h = await crearHarness({ latenciaMaxMs: 1 });
  const mem = crearAlmacenEnMemoria(), sup = await h.almacenDe("e1");
  ok(verificarAlmacen(mem).ok && verificarAlmacen(sup).ok, "el almacén en memoria y el de Supabase traen los MISMOS métodos de la interfaz");
  ok(verificarAlmacen({ leerLibro() {} }).ok === false && verificarAlmacen({ leerLibro() {} }).faltan.length === 5, "un objeto a medias NO es un almacén (faltan 5)");
  for (const [n, s] of [["memoria", mem], ["supabase", sup]]) {
    const p1 = s.leerHechosEmpresa("e1"), p2 = s.leerLibro("e1", "no-existe");
    ok(p1 instanceof Promise && p2 instanceof Promise, `${n}: leer DEVUELVE UNA PROMESA (la interfaz es asíncrona, no solo la de la base)`);
    await Promise.all([p1, p2]);
  }

  /* la MISMA batería contra los dos almacenes → el mismo resultado (ids aparte) */
  async function bateria(store, tid) {
    const T = [];
    const a = await EMP.declararHecho(store, tid, { clase: "hecho", concepto: "plazo", entidad: "Jumbo", valor: { raw: 45, unidad: "days" } }, { actorLabel: "t", conversacionId: "c1" });
    T.push(["declarar", a.ok, a.estado, a.paraConfirmar]);
    const a2 = await EMP.declararHecho(store, tid, { clase: "hecho", concepto: "plazo", entidad: "Jumbo", valor: { raw: 45, unidad: "days" } });
    T.push(["mismo valor → duplicado, mismo id", a2.duplicado === true, a2.id === a.id]);
    T.push(["vigentes antes de confirmar", (await EMP.leerVigentes(store, tid)).length, (await EMP.leerPendientes(store, tid)).length]);
    const c = await EMP.confirmarHecho(store, tid, a.id, { actorLabel: "jc", resolverConflicto: true });
    T.push(["confirmar", c.ok, c.estado, c.entendido.origen, Boolean(c.entendido.confirmacion && c.entendido.confirmacion.por)]);
    const b = await EMP.declararHecho(store, tid, { clase: "hecho", concepto: "plazo", entidad: "Jumbo", valor: { raw: 60, unidad: "days" }, reemplaza: a.id });
    T.push(["valor distinto → pendiente con conflicto, no pisa", b.estado, b.conflictoCon === a.id, b.paraConfirmar]);
    const vigTrasProponer = await EMP.leerVigentes(store, tid, { concepto: "plazo" });
    T.push(["proponer NO retira lo confirmado (hasta confirmar)", vigTrasProponer.length, vigTrasProponer[0] && vigTrasProponer[0].valor.raw]);
    const c2 = await EMP.confirmarHecho(store, tid, b.id, { actorLabel: "jc", resolverConflicto: true });
    T.push(["confirmar el nuevo", c2.ok, c2.estado]);
    const vig2 = await EMP.leerVigentes(store, tid, { concepto: "plazo" });
    T.push(["una sola vigente, la nueva", vig2.length, vig2[0] && vig2[0].valor.raw]);
    const hist = await EMP.leerHistoria(store, tid, { concepto: "plazo" });
    T.push(["historia", hist.map((x) => `${x.valor.raw}:${x.estado}`).sort()]);
    const r = await EMP.retirarHecho(store, tid, vig2[0].id, { motivo: "ya no aplica", actorLabel: "jc" });
    T.push(["retirar", r.ok, (await EMP.leerVigentes(store, tid)).length, (await EMP.leerHistoria(store, tid)).length]);
    const om = await EMP.omitirCampo(store, tid, { clase: "hecho", concepto: "margen_objetivo" }, { conversacionId: "c9" });
    T.push(["omitir", om.ok, await EMP.yaFueOmitido(store, tid, { concepto: "margen_objetivo" }, { conversacionId: "c9" }), await EMP.yaFueOmitido(store, tid, { concepto: "margen_objetivo" }, { conversacionId: "otra" })]);
    const m = await EMP.memoriaDeEmpresa(store, tid, { legado: { contexto: { texto: "distribuidora", fecha: "2026-08-20" } } });
    T.push(["memoria única con lo legado", m.hechos.map((x) => x.concepto).sort()]);
    const rechazo = await EMP.declararHecho(store, tid, { clase: "hecho", concepto: "x", valor: { raw: 1 }, origen: "medido" });
    T.push(["origen medido rechazado", rechazo.ok]);
    // el libro
    let libro = libroNuevo({ conversacionId: `cv-${tid}`, versionId: 9 });
    libro = registrarEntrega(libro, { versionId: 9, temas: ["comercial"], entidades: ["Jumbo"], cierre: "cifra", hechos: [{ sujeto: "Jumbo", metrica: "Venta", valor: "$1M", origen: "medido" }], entregadaEn: "2026-10-02T12:00:00.000Z", periodo: { tipo: "cerrado", texto: "año cerrado" } });
    await store.guardarLibro(tid, libro);
    const leido = await store.leerLibro(tid, `cv-${tid}`);
    T.push(["libro: guardar → leer idéntico", G.iguales(leido, libro), leido.origen]);
    T.push(["libro inexistente → null", await store.leerLibro(tid, "no-existe-nunca")]);
    return T;
  }
  const tMem = await bateria(mem, "e1"), tSup = await bateria(await h.almacenDe("e2"), "e2");
  ok(JSON.stringify(tMem) === JSON.stringify(tSup), "★ la MISMA batería (declarar · duplicar · confirmar · proponer sin pisar · retirar · omitir · memoria única · libro) da el MISMO resultado en memoria y en Supabase", JSON.stringify({ mem: tMem, sup: tSup }));
  // el libro de una empresa NO lo abre otra aunque presente su conversacionId
  ok((await mem.leerLibro("e2", "cv-e1")) === null && (await (await h.almacenDe("e1")).leerLibro("e1", "cv-e2")) === null, "el libro de una empresa no lo abre otra con su conversacionId — en memoria (llave por empresa) ni en Supabase (el pase)");

  /* EL PERFIL (clase «perfil», owner 2026-10-03): la MISMA batería contra memoria y Supabase → el mismo resultado; y la base
   * (el doble, que repite los checks de la 015) RECHAZA lo que no sea un perfil bien formado: un perfil guardado como «hecho»
   * y un «hecho» con concepto de perfil. */
  async function bateriaPerfil(store, tid) {
    const T = [];
    const d = await EMP.declararPerfilCampo(store, tid, { campo: "sector", codigo: "distribucion" }, { actorLabel: "t", conversacionId: "c1" });
    T.push(["declarar el sector", d.ok, d.estado, d.paraConfirmar, d.entendido.clase, d.entendido.concepto, d.entendido.origen]);
    const d2 = await EMP.declararPerfilCampo(store, tid, { campo: "sector", codigo: "distribucion" }, { conversacionId: "c1" });
    T.push(["mismo valor → duplicado, mismo id", d2.duplicado === true, d2.id === d.id]);
    T.push(["pendiente: no es vigente", Object.keys((await EMP.leerPerfilDeclarado(store, tid)).vigentes), Object.keys((await EMP.leerPerfilDeclarado(store, tid)).pendientes)]);
    const c = await EMP.confirmarHecho(store, tid, d.id, { actorLabel: "jc", resolverConflicto: true });
    const e1 = await EMP.leerPerfilDeclarado(store, tid);
    T.push(["confirmar → vigente, declarado, con sello", c.ok, e1.vigentes.sector && e1.vigentes.sector.valor, e1.vigentes.sector && e1.vigentes.sector.origen, Boolean(e1.vigentes.sector && e1.vigentes.sector.confirmacion && e1.vigentes.sector.confirmacion.por)]);
    const tipo = await EMP.declararPerfilCampo(store, tid, { campo: "tipoProducto", codigo: "vence" }, {});
    const fuera = await EMP.declararPerfilCampo(store, tid, { campo: "pais", codigo: "Chile" }, {});
    T.push(["tipo de producto con el sector declarado · un país fuera de la taxonomía se rechaza", tipo.ok, fuera.ok, Array.isArray(fuera.validos)]);
    const o = await EMP.omitirPerfilCampo(store, tid, "pais", { conversacionId: "c9" });
    const o2 = await EMP.omitirPerfilCampo(store, tid, "pais", { conversacionId: "c9" });
    T.push(["omitir el país: una vez; la segunda es la misma omisión", o.ok, o2.duplicado === true, Object.keys((await EMP.leerPerfilDeclarado(store, tid)).omitidos)]);
    const nuevo = await EMP.declararPerfilCampo(store, tid, { campo: "sector", codigo: "fabricacion" }, {});
    T.push(["otro sector: pendiente con conflicto, no pisa lo confirmado", nuevo.estado, nuevo.conflictoCon === d.id, (await EMP.leerPerfilDeclarado(store, tid)).vigentes.sector.valor]);
    T.push(["la memoria de empresa NO lo lista como hechos", (await EMP.memoriaDeEmpresa(store, tid)).hechos.length]);
    return T;
  }
  const pMem = await bateriaPerfil(crearAlmacenEnMemoria(), "e5"), pSup = await bateriaPerfil(await h.almacenDe("e5"), "e5");
  ok(JSON.stringify(pMem) === JSON.stringify(pSup) && pMem[0][1] === true, "★ el PERFIL (declarar · duplicar · confirmar · taxonomía · omitir · conflicto) da el MISMO resultado en memoria y en Supabase", JSON.stringify({ mem: pMem, sup: pSup }).slice(0, 700));
  const filasPerfil = h.db.filasDeEmpresa("e5").memoria;
  ok(filasPerfil.length > 0 && filasPerfil.every((f) => f.clase === "perfil" && ["sector", "tipoProducto", "modeloComercial", "pais"].includes(f.concepto) && f.origen === "declarado"), "en la base: TODA fila del perfil es clase «perfil», con el campo como concepto (sin prefijo) y origen «declarado»", JSON.stringify(filasPerfil.map((f) => [f.clase, f.concepto, f.origen])));
  {
    const sup2 = await h.almacenDe("e5");
    const fila = (extra) => ({ clase: "perfil", concepto: "sector", eje: null, entidad: null, periodo: null, valor: { raw: null, unidad: null, texto: "distribucion" }, origen: "declarado", documento: null, estado: "pendiente", conversacionId: null, ...extra });
    const rechazada = async (extra) => { try { await sup2.guardarHechoEmpresa("e5", fila(extra)); return false; } catch (e) { return esErrorDeAlmacen(e); } };
    const antes = h.db.filasDeEmpresa("e5").memoria.length;
    ok(await rechazada({ clase: "hecho" }) && await rechazada({ clase: "hecho", concepto: "perfil:sector" }) && await rechazada({ clase: "criterio", concepto: "Tipo_Producto" }) && await rechazada({ clase: "documento", concepto: "pais", origen: "documento", documento: { nombre: "x", tipo: "pdf", parte: "1" } }), "★ CARNADA · la base rechaza un perfil guardado como «hecho» y un «hecho»/criterio/documento con el concepto de un campo de perfil (con o sin el prefijo viejo, con otras mayúsculas o en snake_case)");
    ok(await rechazada({ concepto: "moneda" }) && await rechazada({ concepto: "perfil:sector" }) && await rechazada({ origen: "documento", documento: { nombre: "x", tipo: "pdf", parte: "1" } }) && await rechazada({ valor: null }) && await rechazada({ valor: { raw: 3, unidad: null, texto: null } }), "★ CARNADA · la base rechaza un perfil de un campo que no existe, el que no es «declarado» y el que no trae el código de la opción");
    ok(!(await rechazada({ estado: "omitido", valor: null })), "pero admite la omisión de un campo del perfil (sin valor)");
    ok(h.db.filasDeEmpresa("e5").memoria.length === antes + 1, "y de todo lo rechazado NO quedó nada guardado (solo la omisión que sí entra)");
  }

  /* CARNADA D1-a · el consumidor ANTIGUO (síncrono) contra el almacén asíncrono */
  const consumidorAntiguo = (store, t) => store.leerHechosEmpresa(t).filter((x) => x.estado === "vigente");
  let tipoError = null;
  try { consumidorAntiguo(mem, "e1"); } catch (e) { tipoError = e && e.constructor && e.constructor.name; }
  ok(tipoError === "TypeError", "★ CARNADA D1 · usar el almacén asíncrono como síncrono revienta (`.filter is not a function`) — exactamente el defecto que el inventario probó", String(tipoError));
  let leyendo = null; try { leyendo = consumidorAntiguo(sup, "e1"); } catch { leyendo = "lanzó"; }
  ok(leyendo === "lanzó", "★ CARNADA D1 · y lo mismo contra el adaptador REAL de Supabase");

  /* CARNADA D1-b · una llamada del consumidor SIN await (auditoría estática del código de producción) */
  const auditarAwait = (src) => {
    const s = sinComentarios(src), v = [];
    for (const m of s.matchAll(/\bstore\.(leerHechosEmpresa|guardarHechoEmpresa|actualizarHechoEmpresa|leerLibro|guardarLibro)\(/g)) {
      const antes = s.slice(Math.max(0, m.index - 24), m.index), contexto = s.slice(Math.max(0, m.index - 260), m.index);
      if (/await\s*\(?\s*$/.test(antes) || (/\?\s*$/.test(antes) && /Promise\.all\(\[/.test(contexto))) continue;
      v.push(m[0] + " @" + m.index);
    }
    for (const m of s.matchAll(/(?<!function\s)(?<![\w.])(leerVigentes|leerHistoria|leerPendientes|declararHecho|confirmarHecho|retirarHecho|omitirCampo|yaFueOmitido|memoriaDeEmpresa)\(store/g)) {
      const antes = s.slice(Math.max(0, m.index - 24), m.index), contexto = s.slice(Math.max(0, m.index - 260), m.index);
      if (/await\s*\(?\s*$/.test(antes) || (/[\[,]\s*$/.test(antes) && /Promise\.all\(\[/.test(contexto))) continue;
      v.push(m[0] + " @" + m.index);
    }
    return v;
  };
  const srcAcc = leer("./src/adi/capacidad/acciones.js"), srcEmp = leer("./src/adi/continuidad/empresa.js");
  ok(auditarAwait(srcAcc).length === 0 && auditarAwait(srcEmp).length === 0, "TODA llamada al almacén (y a las funciones de `empresa.js` que lo usan) en las acciones y en `empresa.js` está esperada con `await`", JSON.stringify([...auditarAwait(srcAcc), ...auditarAwait(srcEmp)]));
  ok(auditarAwait(srcAcc.replace("await store.guardarLibro(tenantId, libro);", "store.guardarLibro(tenantId, libro);")).length >= 1, "★ CARNADA D1 · si a una llamada al almacén se le quita el `await`, la auditoría la marca");
  ok(auditarAwait(srcEmp.replace("const todosLosHechos = (await store.leerHechosEmpresa(tenantId)) || [];", "const todosLosHechos = store.leerHechosEmpresa(tenantId) || [];")).length >= 1, "★ CARNADA D1 · y en `empresa.js` también");
}

/* ═══ 2 · LA FALLA SE VE: «NO PUDE LEER» NUNCA ES «NO EXISTE» ═══════════════════════════════════════════════════════ */
H("2 · la falla de la base se declara: ninguna lectura que falla se confunde con «no existe» (y no se pisa lo guardado)");
{
  const h = await crearHarness({ latenciaMaxMs: 1 });
  const E = EMPRESAS[0], tenant = h.tenantDe(E);
  let acc = await h.accionesDe(E);
  const r1 = await acc.consultar({ tenant, encargo: G.encargoDeVentas("Jumbo") });
  const cid = r1.continuidad.conversacionId;
  await (await h.accionesDe(E)).consultar({ tenant, encargo: G.encargoDeVentas("Falabella", cid) });
  const filaLibro = () => h.db.filasDeEmpresa(E.id).conversaciones.find((c) => c.hilo_id === cid);
  const huellaLibro = () => G.huella(filaLibro().estado);
  const antes = huellaLibro();
  ok(filaLibro().estado.entregas.length === 2 && filaLibro().estado.origen === ORIGEN_LIBRO, "el libro guardado tiene sus dos Entregas y el origen del hilo (complemento)");

  const sup = await h.almacenDe(E.id);
  h.db.desconectar(true);
  let e1 = null, e2 = null;
  try { await sup.leerHechosEmpresa(E.id); } catch (e) { e1 = e; }
  try { await sup.leerLibro(E.id, cid); } catch (e) { e2 = e; }
  ok(esErrorDeAlmacen(e1) && esErrorDeAlmacen(e2), "★ con la base caída, leer memoria y leer el libro LANZAN `ErrorDeAlmacen` (antes devolvían `[]` y `null`: «no hay nada»)", `${e1 && e1.name} · ${e2 && e2.name}`);
  const a0 = await h.accionesDe(E);
  const sal = await Promise.all([a0.conocerEmpresa({ tenant, conversacionId: cid }), a0.retomar({ tenant, conversacionId: cid }), a0.aportarContexto({ tenant, conversacionId: cid, aportes: [{ clase: "hecho", concepto: "x", valor: 1 }] }), a0.consultar({ tenant, encargo: G.encargoDeVentas("Lider", cid) })]);
  ok(sal.every((s) => s.ok === false && s.memoria === "no_disponible" && /memoria de la empresa no está disponible/.test(s.motivo)), "con la base caída, las CUATRO acciones responden «memoria no disponible» (falla cerrado) en palabras de negocio", JSON.stringify(sal.map((s) => [s.ok, s.memoria])));
  ok(!JSON.stringify(sal).includes("503") && !JSON.stringify(sal).includes("doble.invalid"), "y el aviso no filtra detalles de la base");
  h.db.desconectar(false);
  ok(huellaLibro() === antes, "★ lo guardado NO se tocó mientras la base estuvo caída");

  // una lectura que falla UNA vez no se vuelve «libro nuevo con el mismo id» encima del real
  h.db.inyectarFalla({ fn: "adi_leer_estado_conversacion", restantes: 1, status: 503 });
  const rF = await (await h.accionesDe(E)).aportarContexto({ tenant, conversacionId: cid, aportes: [{ clase: "hecho", concepto: "x", valor: 1 }] });
  ok(rF.ok === false && rF.memoria === "no_disponible", "una lectura del libro que falla una vez → «memoria no disponible», no «libro nuevo»");
  ok(huellaLibro() === antes && filaLibro().estado.entregas.length === 2, "★ y el libro real quedó INTACTO (con sus dos Entregas)");
  const rOk = await (await h.accionesDe(E)).aportarContexto({ tenant, conversacionId: cid, aportes: [{ clase: "hecho", concepto: "x", valor: 1 }] });
  ok(rOk.ok === true && filaLibro().estado.entregas.length === 2, "reintentar sobre la base sana funciona y conserva las Entregas");

  /* CARNADA D1-c · el adaptador de ANTES: un error de lectura se tragaba como «no existe» */
  const tragaErrores = (real) => new Proxy(real, { get: (t, k) => (k === "leerLibro" ? async (...a) => { try { return await t.leerLibro(...a); } catch { return null; } } : t[k]) });
  const hC = await crearHarness({ latenciaMaxMs: 1 });
  const tC = hC.tenantDe(E);
  const ac = await hC.accionesDe(E);
  const c1 = await ac.consultar({ tenant: tC, encargo: G.encargoDeVentas("Jumbo") });
  const cidC = c1.continuidad.conversacionId;
  await (await hC.accionesDe(E)).consultar({ tenant: tC, encargo: G.encargoDeVentas("Falabella", cidC) });
  const huellaC = () => G.huella(hC.db.filasDeEmpresa(E.id).conversaciones.find((c) => c.hilo_id === cidC).estado);
  const antesC = huellaC();
  hC.db.inyectarFalla({ fn: "adi_leer_estado_conversacion", restantes: 1, status: 503 });
  const acTraga = await hC.accionesDe(E, { fabrica: async (X) => tragaErrores(await hC.almacenDe(X.id)) });
  await acTraga.aportarContexto({ tenant: tC, conversacionId: cidC, aportes: [{ clase: "hecho", concepto: "x", valor: 1 }] });
  ok(huellaC() !== antesC, "★ CARNADA D1 · con el almacén que traga el error, una falla transitoria BORRA las Entregas del libro (lo que el contrato de falla evita) — el control lo ve");

  // si lo ÚNICO que falla es guardar, la Entrega (verdadera) se entrega y se declara que no quedó guardada
  h.db.inyectarFalla({ fn: "adi_guardar_estado_conversacion", restantes: 1, status: 503 });
  const nAntes = h.db.filasDeEmpresa(E.id).conversaciones.length;
  const rG = await (await h.accionesDe(E)).consultar({ tenant, encargo: G.encargoDeVentas("Tottus") });
  ok(rG.ok === true && rG.continuidad.guardada === false && /no se pudo guardar/.test(rG.continuidad.motivoNoGuardada) && h.db.filasDeEmpresa(E.id).conversaciones.length === nAntes, "si SOLO falla guardar: la Entrega se entrega y se DECLARA `continuidad.guardada:false` con su motivo — nunca se finge una continuidad que no existe", JSON.stringify(rG.continuidad));
  const rH = G.resumirConsulta(rG);
  ok(rH.cifras[0] && rH.cifras[0].valor === ESPERADO[E.id].Tottus.valor, "y la cifra de esa Entrega es la verdadera de la empresa");

  // migración 015 sin aplicar → 404 → «no disponible», sin romper
  const hSin = await crearHarness({ migraciones: [], latenciaMaxMs: 0 });
  const accSin = await hSin.accionesDe(E);
  const rSin = await accSin.conocerEmpresa({ tenant: hSin.tenantDe(E) });
  ok(rSin.ok === false && rSin.memoria === "no_disponible", "con la migración 015 SIN aplicar, la acción responde «memoria no disponible» y no revienta");
  let e404 = null; try { await (await hSin.almacenDe(E.id)).leerHechosEmpresa(E.id); } catch (e) { e404 = e; }
  ok(esErrorDeAlmacen(e404) && e404.estado === 404, "y el error del almacén lleva el estado 404 de la base (la función no existe)", String(e404 && e404.estado));

  // un libro NUNCA se escribe encima de un hilo del chat de la app (lo haría desaparecer del Historial)
  const cliH = h.cliente;
  const pase = (await emitirPase({ tenantId: E.id, secreto: SECRETO_JWT })).pase;
  await cliH.llamarFuncion("adi_guardar_conversacion", { p_hilo_id: "hilo-de-la-app", p_titulo: "ventas", p_mensajes: [{ role: "user", text: "ventas" }] }, { pase });
  const rApp = await (await h.accionesDe(E)).aportarContexto({ tenant, conversacionId: "hilo-de-la-app", aportes: [{ clase: "hecho", concepto: "y", valor: 2 }] });
  const filaApp = h.db.filasDeEmpresa(E.id).conversaciones.find((c) => c.hilo_id === "hilo-de-la-app");
  ok(rApp.ok === false && rApp.memoria === "no_disponible" && filaApp.estado.origen === undefined && filaApp.mensajes.length === 1, "★ un conversacionId que es un hilo del chat de la app NO se pisa con un libro: la base lo rechaza y el hilo queda intacto");
}

/* ═══ 3 · D2 · LA BASE FUERA DEL TRAMO DEL CORE: DOS EMPRESAS A LA VEZ NO SE MEZCLAN ════════════════════════════════ */
H("3 · D2 · leer → tramo síncrono (initTenant + Core) → salir → escribir: dos empresas atendidas a la vez no se mezclan");
{
  const ds = (E) => packDeEmpresa(E);
  initTenant(null);
  ok(esTenantVacio(getTenantData()), "arranque limpio: ninguna empresa activa");
  const vistoDentro = conTenantActivo(ds(EMPRESAS[0]), () => getTenantData().id);
  ok(vistoDentro === "e1" && esTenantVacio(getTenantData()), "`conTenantActivo` activa la empresa dentro del tramo y RESTAURA lo que había al salir");
  initTenant(ds(EMPRESAS[2]));
  conTenantActivo(ds(EMPRESAS[1]), () => 1);
  ok(getTenantData().id === "e3", "y restaura la empresa que estaba activa ANTES (no la vacía a ciegas)");
  initTenant(null);
  let m1 = null; try { conTenantActivo(ds(EMPRESAS[0]), async () => 1); } catch (e) { m1 = e.message; }
  ok(/síncrono/.test(String(m1)) && esTenantVacio(getTenantData()), "★ un tramo ASÍNCRONO (un `await` adentro) se rechaza — y aun lanzando, restaura");
  let m2 = null; try { conTenantActivo(ds(EMPRESAS[0]), () => { initTenant(ds(EMPRESAS[1])); return 1; }); } catch (e) { m2 = e.message; }
  ok(/cambió/.test(String(m2)) && esTenantVacio(getTenantData()), "★ si la empresa activa cambia DURANTE el tramo, el resultado no se entrega");
  let m3 = null; try { conTenantActivo(null, () => 1); } catch (e) { m3 = e.message; }
  ok(/falta el dataset/.test(String(m3)), "sin dataset, ni entra");

  /* auditoría estática del código de producción: el tramo del Core no espera nada */
  const auditarAislamiento = (src) => {
    const s = sinComentarios(src), v = [];
    if (/(^|[^.\w])initTenant\(/.test(s)) v.push("`initTenant(` llamado directo en acciones.js (solo `conTenantActivo` puede fijar la empresa)");
    for (const m of s.matchAll(/conTenantActivo\(/g)) {
      let i = m.index + m[0].length, nivel = 1;
      while (i < s.length && nivel > 0) { const c = s[i++]; if (c === "(") nivel++; else if (c === ")") nivel--; }
      if (/\bawait\b/.test(s.slice(m.index, i))) v.push("hay un `await` DENTRO del tramo de `conTenantActivo(...)`");
    }
    if (!/conTenantActivo\(/.test(s)) v.push("las acciones no usan `conTenantActivo`");
    return v;
  };
  const srcAcc = leer("./src/adi/capacidad/acciones.js");
  ok(auditarAislamiento(srcAcc).length === 0, "acciones.js: ninguna llamada directa a `initTenant` y NINGÚN `await` dentro de un tramo `conTenantActivo`", JSON.stringify(auditarAislamiento(srcAcc)));
  ok(auditarAislamiento(srcAcc.replace("resolucion = validarEncargo(ley.encargo, { libro: libroLeido });", "resolucion = (await store.leerLibro(tenantId, \"x\"), validarEncargo(ley.encargo, { libro: libroLeido }));")).some((x) => /await/.test(x)), "★ CARNADA D2 · si alguien le pone un `await` al tramo del Core, la auditoría lo marca");
  ok(auditarAislamiento(srcAcc.replace("async function consultar({ tenant, encargo } = {}) {", "async function consultar({ tenant, encargo } = {}) { initTenant(tenant.dataset);")).some((x) => /initTenant/.test(x)), "★ CARNADA D2 · y si vuelve a llamar `initTenant` directo, también");

  /* el CONTROL funcional: llamadas concurrentes de empresas distintas, con latencia aleatoria de semilla fija */
  const h = await crearHarness({ latenciaMaxMs: 3 });
  async function controlDeAislamiento(consultarFn, { oleadas, ancho, semilla }) {
    const rng = crearAzar(semilla), violaciones = [];
    let llamadas = 0;
    for (let o = 0; o < oleadas; o++) {
      const lote = Array.from({ length: ancho }, () => ({ E: rng.elegir(EMPRESAS), ent: rng.elegir(ENTIDADES) }));
      await Promise.all(lote.map(async ({ E, ent }) => {
        llamadas++;
        const r = await consultarFn(E, ent);
        const esp = ESPERADO[E.id][ent];
        if (r.empresa !== esp.empresa) violaciones.push({ E: E.id, ent, causa: "empresa", obtuvo: r.empresa });
        else if ((r.cifras[0] && r.cifras[0].valor) !== esp.valor) violaciones.push({ E: E.id, ent, causa: "cifra", obtuvo: r.cifras[0] && r.cifras[0].valor, esperaba: esp.valor });
      }));
    }
    return { violaciones, llamadas };
  }
  const consultarReal = async (E, ent) => G.resumirConsulta(await (await h.accionesDe(E)).consultar({ tenant: h.tenantDe(E), encargo: G.encargoDeVentas(ent) }));
  initTenant(null);
  const real = await controlDeAislamiento(consultarReal, { oleadas: 8, ancho: 12, semilla: SEMILLA + 1 });
  ok(real.llamadas === 96 && real.violaciones.length === 0, `★ ${real.llamadas} consultas INTERCALADAS de 6 empresas con latencia aleatoria: cero cifras ni nombres cruzados`, JSON.stringify(real.violaciones.slice(0, 3)));
  ok(esTenantVacio(getTenantData()), "★ y al terminar NO queda ninguna empresa activa en el Core (ningún residuo que otra llamada pueda leer)");

  /* CARNADA D2 · el orden de ANTES: initTenant → await a la base → Core */
  const consultarSinAislamiento = async (E, ent) => {
    const tenant = h.tenantDe(E), store = await h.almacenDe(E.id);
    initTenant(tenant.dataset);                                   // ← fija la empresa…
    await store.leerLibro(E.id, "conversacion-inexistente");      // …cede el turno a la base…
    const resolucion = validarEncargo(G.encargoDeVentas(ent), {}); // …y recién calcula
    const salida = componerEntrega(resolucion);
    return G.resumirConsulta({ ok: salida.ok, entrega: { json: salida.entrega, texto: salida.texto }, continuidad: null });
  };
  initTenant(null);
  const mala = await controlDeAislamiento(consultarSinAislamiento, { oleadas: 3, ancho: 12, semilla: SEMILLA + 2 });
  ok(mala.violaciones.length >= 6, `★ CARNADA D2 · con el orden de ANTES (initTenant → await → Core) el control ve ${mala.violaciones.length} de ${mala.llamadas} respuestas con cifras o nombre de OTRA empresa`, JSON.stringify(mala.violaciones.slice(0, 2)));
  ok(!esTenantVacio(getTenantData()), "★ CARNADA D2 · y ese orden deja una empresa ACTIVA colgada al terminar (el residuo)");
  initTenant(null);
}

/* ═══ 4 · NO SE PIERDE UNA ENTREGA NI SE DUPLICA UN HECHO CON LLAMADAS CRUZADAS ═════════════════════════════════════ */
H("4 · llamadas cruzadas de la misma conversación o empresa: ninguna Entrega se pierde y ningún hecho se duplica");
{
  const h = await crearHarness({ latenciaMaxMs: 3 });
  const E = EMPRESAS[2], tenant = h.tenantDe(E);
  const r1 = await (await h.accionesDe(E)).consultar({ tenant, encargo: G.encargoDeVentas("Jumbo") });
  const cid = r1.continuidad.conversacionId;
  const N = 5;
  const res = await Promise.all(ENTIDADES.slice(0, N).map(async (ent) => (await h.accionesDe(E)).consultar({ tenant: h.tenantDe(E), encargo: G.encargoDeVentas(ent, cid) })));
  const libro = expandirLibro(h.db.filasDeEmpresa(E.id).conversaciones.find((c) => c.hilo_id === cid).estado);   // la base guarda la forma compacta del libro (`libro.js:comprimirLibro`): se lee expandida, como la lee el almacén
  const turnos = res.map((r) => r.continuidad.estadoVigente.turno).sort((a, b) => a - b);
  ok(res.every((r) => r.ok), `${N} consultas SIMULTÁNEAS de la misma conversación responden bien`);
  ok(JSON.stringify(turnos) === JSON.stringify([2, 3, 4, 5, 6]) && libro.entregas.length === N + 1, "★ cada una tomó SU turno (2…6) y el libro guardó las seis Entregas — ninguna se perdió", JSON.stringify({ turnos, entregas: libro.entregas.length }));
  ok(new Set(libro.entregas.flatMap((e) => e.hechos.map((x) => x.id))).size === N + 1, "y los ids de los hechos (E1.h1…E6.h1) son todos distintos");
  await new Promise((r) => setTimeout(r, 5));
  ok(colasAbiertas() === 0, "las colas por conversación quedan vacías (sin fugas)");

  /* CARNADA · leer-calcular-guardar SIN candado: se pisan */
  const hC = await crearHarness({ latenciaMaxMs: 3 });
  const sinCandado = async (E2, cidX) => {
    const st = await hC.almacenDe(E2.id);
    const l = await st.leerLibro(E2.id, cidX);
    const nuevo = registrarEntrega(l, { versionId: 1, temas: ["comercial"], hechos: [{ sujeto: "x", metrica: "y", valor: "1" }] });
    await st.guardarLibro(E2.id, nuevo);
  };
  const stI = await hC.almacenDe(E.id);
  await stI.guardarLibro(E.id, libroNuevo({ conversacionId: "cv-c", versionId: 1 }));
  await Promise.all(Array.from({ length: N }, () => sinCandado(E, "cv-c")));
  const perdidas = N - (await stI.leerLibro(E.id, "cv-c")).entregas.length;
  ok(perdidas > 0, `★ CARNADA · sin candado por conversación, ${N} escrituras cruzadas pierden ${perdidas} Entrega(s) — el control lo ve`);

  /* el mismo aporte declarado cinco veces A LA VEZ → una sola fila */
  const aporte = { clase: "hecho", concepto: "dato_repetido", entidad: "Jumbo", valor: { raw: 30, unidad: "days", texto: "30 días · ref-e3" } };
  const rr = await Promise.all(Array.from({ length: N }, async () => (await h.accionesDe(E)).aportarContexto({ tenant, aportes: [aporte] })));
  const filas = h.db.filasDeEmpresa(E.id).memoria.filter((f) => f.concepto === "dato_repetido");
  ok(rr.every((r) => r.ok) && filas.length === 1, `★ el mismo aporte declarado ${N} veces a la vez deja UNA sola fila (no ${N})`, String(filas.length));
  const hD = await crearHarness({ latenciaMaxMs: 3 });
  await Promise.all(Array.from({ length: N }, async () => EMP.declararHecho(await hD.almacenDe(E.id), E.id, aporte, { actorLabel: "t" })));
  const dupl = hD.db.filasDeEmpresa(E.id).memoria.filter((f) => f.concepto === "dato_repetido").length;
  ok(dupl > 1, `★ CARNADA · sin el candado por empresa, el mismo aporte simultáneo deja ${dupl} filas — el control lo ve`);
}

/* ═══ 5 · LA PRUEBA DE ACEPTACIÓN: guardar → REINICIAR → leer, idéntico ══════════════════════════════════════════════ */
H("5 · aceptación · el guion del owner por la PUERTA: A y B intercaladas → reinicio REAL → retomar A y B idénticas, sin mezcla");
let hijoOk = false;
{
  const ent = await armarEntornoDoble({ semilla: SEMILLA + 3 });
  const antes = await G.faseAntes({ llamar: ent.llamar, empresas: EMPRESAS_DEL_GUION, leerHuellas: ent.leerHuellas });
  ok(ent.llamar.llamadas() >= 14, `el guion corrió ${ent.llamar.llamadas()} llamadas por la puerta (MCP), turno a turno y con A y B a la vez`);
  ok(ent.db.metricas.porFuncion.adi_guardar_estado_conversacion >= 6 && ent.db.metricas.porFuncion.adi_aportar_hecho_empresa >= 4, "todo se guardó en la base (libro y memoria), no en la memoria del proceso");

  // — A · reinicio en el mismo proceso: otra instancia del módulo de la puerta, otra base cargada del estado —
  const estadoJson = ent.db.exportar();
  const ent2 = await armarEntornoDoble({ estadoJson });
  const despuesA = await G.faseDespues({ llamar: ent2.llamar, empresas: EMPRESAS_DEL_GUION, antes, leerHuellas: ent2.leerHuellas });
  const cmpA = G.compararAntesDespues({ antes, despues: despuesA, empresas: EMPRESAS_DEL_GUION });
  ok(cmpA.checks.every((c) => c.ok), `★ reinicio de módulos: los ${cmpA.checks.length} controles del guion (Entregas, cifras, ids, fecha y versión de carga, declarado con su origen, huellas, no mezcla) pasan`, JSON.stringify(cmpA.checks.filter((c) => !c.ok).map((c) => c.label)));

  // — B · reinicio REAL: un proceso nuevo de Node; lo único en común es el archivo con la base —
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "adi-guion-"));
  try {
    const fEstado = path.join(dir, "estado.json"), fAntes = path.join(dir, "antes.json"), fSalida = path.join(dir, "salida.json");
    fs.writeFileSync(fEstado, estadoJson); fs.writeFileSync(fAntes, JSON.stringify(antes));
    const hijo = spawnSync(process.execPath, [...process.execArgv, fileURLToPath(new URL("./scripts/guion-continuidad-hijo.mjs", import.meta.url)), `--estado=${fEstado}`, `--antes=${fAntes}`, `--salida=${fSalida}`], { encoding: "utf8", timeout: 180000 });
    ok(hijo.status === 0 && fs.existsSync(fSalida), "el proceso hijo (el «servidor reiniciado») terminó bien", `${hijo.status} ${String(hijo.stderr || "").slice(0, 400)}`);
    if (hijo.status === 0 && fs.existsSync(fSalida)) {
      const salida = JSON.parse(fs.readFileSync(fSalida, "utf8"));
      ok(salida.pid !== process.pid && salida.pid > 0, `★ es OTRO proceso (pid ${salida.pid} ≠ ${process.pid}): ninguna variable ni módulo en común, solo la base`);
      const cmpB = G.compararAntesDespues({ antes, despues: salida.despues, empresas: EMPRESAS_DEL_GUION });
      ok(cmpB.checks.every((c) => c.ok), `★ REINICIO REAL: los ${cmpB.checks.length} controles pasan (E1 y E2 idénticas, declarado intacto, huellas iguales, cero mezcla)`, JSON.stringify(cmpB.checks.filter((c) => !c.ok)));
      hijoOk = cmpB.checks.every((c) => c.ok);
      // los marcadores de cada empresa no aparecen en lo que ve la otra, ni antes ni después
      ok(cmpB.violaciones.length === 0 && Object.keys(cmpB.marcadores).length === 2, "el control de no mezcla sobre el guion: 0 violaciones", JSON.stringify(cmpB.violaciones));
      const linea = G.transcritoLadoALado({ antes, despues: salida.despues, empresas: EMPRESAS_DEL_GUION });
      ok(linea.length > 20 && !linea.some((l) => /DISTINTO/.test(l)), "el transcrito de antes y después, lado a lado, no tiene una sola fila distinta");
      console.log("      " + linea.filter((l) => /HUELLA|EMPRESA/.test(l)).join("\n      "));
    }
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }

  // — la huella es SENSIBLE: tocar un dato guardado la cambia y el control lo ve —
  const alterado = JSON.parse(estadoJson);
  const fila = alterado.conversaciones.find((c) => c.estado && c.estado.entregas && c.estado.entregas.length);
  { const L = expandirLibro(fila.estado); L.entregas[0].hechos[0].valor = "$999.9M"; fila.estado = comprimirLibro(L); }   // el libro se guarda en su forma compacta: se altera expandido y se vuelve a guardar igual
  const ent3 = await armarEntornoDoble({ estadoJson: JSON.stringify(alterado) });
  const despuesAlterado = await G.faseDespues({ llamar: ent3.llamar, empresas: EMPRESAS_DEL_GUION, antes, leerHuellas: ent3.leerHuellas });
  const cmpAlt = G.compararAntesDespues({ antes, despues: despuesAlterado, empresas: EMPRESAS_DEL_GUION });
  ok(cmpAlt.checks.some((c) => !c.ok && /HUELLA del libro/.test(c.label)) && cmpAlt.checks.some((c) => !c.ok && /hechos/.test(c.label)), "★ CARNADA · si UNA cifra guardada cambia después del reinicio, la huella del libro y la comparación de hechos lo marcan");

  // — CARNADA · la memoria del proceso como si fuera durable: el reinicio la pierde (lo que había antes de este bloque) —
  const sinDurable = await armarEntornoDoble({ semilla: SEMILLA + 4, durable: false });
  const antesP = await G.faseAntes({ llamar: sinDurable.llamar, empresas: EMPRESAS_DEL_GUION, leerHuellas: sinDurable.leerHuellas });
  const reiniciada = await armarEntornoDoble({ estadoJson: sinDurable.db.exportar(), durable: false });
  const despuesP = await G.faseDespues({ llamar: reiniciada.llamar, empresas: EMPRESAS_DEL_GUION, antes: antesP, leerHuellas: reiniciada.leerHuellas });
  const cmpP = G.compararAntesDespues({ antes: antesP, despues: despuesP, empresas: EMPRESAS_DEL_GUION });
  ok(despuesP.porEmpresa.alfa.retomar.ok === false && cmpP.checks.some((c) => !c.ok && /retomar encuentra/.test(c.label)) && cmpP.checks.filter((c) => !c.ok).length >= 6, `★ CARNADA · con la memoria DEL PROCESO (la bandera durable apagada) el reinicio PIERDE la conversación: retomar no la encuentra y el guion marca ${cmpP.checks.filter((c) => !c.ok).length} controles rojos`);
}

/* ═══ 6 · CIENTOS DE CONVERSACIONES INTERCALADAS AL AZAR, SEMILLA FIJA ═══════════════════════════════════════════════ */
H("6 · cientos de conversaciones de seis empresas, intercaladas al azar con latencia aleatoria: ningún dato cruzado");
async function correrMasivo({ h, nConv, semilla, ventana, fabrica = null }) {
  const rng = crearAzar(semilla), violaciones = [], errores = [];
  /* TODO el azar del PLAN se sortea de antemano (semilla fija): empresa, pasos y entidades de cada conversación */
  const convs = Array.from({ length: nConv }, (_, n) => {
    const E = rng.elegir(EMPRESAS), largo = 2 + rng.entero(3);
    const abre = rng.entero(2) ? "consultar" : "aportar";
    const pasos = [{ que: abre, ent: rng.elegir(ENTIDADES) }, ...Array.from({ length: largo - 1 }, () => ({ que: rng.elegir(["consultar", "consultar", "aportar", "confirmar", "retomar", "conocer"]), ent: rng.elegir(ENTIDADES) }))];
    return { n, E, pasos, i: 0, enCurso: false, id: null, turno: 0, k: 0, pendientes: [], vigentes: [], aportesTotal: 0, entregas: 0 };
  });
  const chk = (E, donde, r) => { for (const v of G.controlDeNoMezcla({ textos: [{ empresa: E.id, donde, texto: JSON.stringify(r) }], marcadores: MARCADORES })) violaciones.push(v); };
  async function paso(c) {
    const E = c.E, tenant = h.tenantDe(E), acc = await h.accionesDe(E, { fabrica });
    let { que, ent } = c.pasos[c.i];
    if ((que === "retomar" && !c.id) || (que === "confirmar" && !c.pendientes.length)) que = "aportar";   // sin conversación o sin pendiente: se aporta
    if (que === "consultar") {
      const r = await acc.consultar({ tenant, encargo: G.encargoDeVentas(ent, c.id) });
      const s = G.resumirConsulta(r);
      if (!r.ok || s.empresa !== E.nombre || !s.cifras[0] || s.cifras[0].valor !== ESPERADO[E.id][ent].valor || !s.cifras.every((f) => CIFRAS[E.id].has(f.valor))) violaciones.push({ E: E.id, donde: "consultar", causa: "cifra o empresa", obtuvo: s.empresa + " " + (s.cifras[0] && s.cifras[0].valor) });
      if (c.id && (s.conversacionId !== c.id || r.continuidad.nueva || s.turno !== c.turno + 1)) violaciones.push({ E: E.id, donde: "consultar", causa: "continuidad", turno: s.turno, esperaba: c.turno + 1 });
      if (!r.continuidad.guardada) violaciones.push({ E: E.id, donde: "consultar", causa: "no se guardó" });
      c.id = s.conversacionId; c.turno = s.turno; c.entregas++;
      chk(E, "consultar", r);
    } else if (que === "aportar") {
      return paso_aportar(c, acc, tenant, ent);
    } else if (que === "confirmar") {
      const id = c.pendientes.shift();
      const r = await acc.aportarContexto({ tenant, conversacionId: c.id, aportes: [], confirmar: [id] });
      if (!r.ok || !r.confirmaciones[0].confirmado) violaciones.push({ E: E.id, donde: "confirmar", causa: "no confirmó" });
      c.vigentes.push(id); chk(E, "confirmar", r);
    } else if (que === "retomar") {
      const r = await acc.retomar({ tenant, conversacionId: c.id });
      if (!r.ok || r.entregas.length !== Math.min(c.entregas, 12) || !r.hechos.every((x) => CIFRAS[E.id].has(x.valor))) violaciones.push({ E: E.id, donde: "retomar", causa: "entregas o cifras ajenas", obtuvo: r.entregas && r.entregas.length, esperaba: Math.min(c.entregas, 12) });
      chk(E, "retomar", r);
    } else {
      const r = await acc.conocerEmpresa({ tenant, conversacionId: c.id });
      if (!r.ok || r.empresa.nombre !== E.nombre || r.hechosAportados.filter((x) => !x.soloLectura && /ref-/.test(JSON.stringify(x.valor))).some((x) => !JSON.stringify(x.valor).includes(E.etiqueta))) violaciones.push({ E: E.id, donde: "conocer", causa: "empresa o hechos de otra" });
      if (c.id && (!r.estadoVigente || r.estadoVigente.conversacionId !== c.id)) violaciones.push({ E: E.id, donde: "conocer", causa: "estado vigente de otra conversación" });
      chk(E, "conocer", r);
    }
  }
  async function paso_aportar(c, acc, tenant, ent) {
    const E = c.E, k = ++c.k;
    const ap = { clase: "hecho", concepto: `dato_${E.id}_${c.n}_${k}`, entidad: ent, valor: { raw: 10 * k, unidad: "days", texto: `${10 * k} días · ${E.etiqueta}` } };
    const r = await acc.aportarContexto({ tenant, conversacionId: c.id, aportes: [ap] });
    if (!r.ok || r.resultados[0].estado !== "pendiente") violaciones.push({ E: E.id, donde: "aportar", causa: "no quedó pendiente", r: JSON.stringify(r).slice(0, 120) });
    else { c.pendientes.push(r.resultados[0].id); c.aportesTotal++; }
    if (c.id && r.conversacionId !== c.id) violaciones.push({ E: E.id, donde: "aportar", causa: "otra conversación" });
    c.id = r.conversacionId; chk(E, "aportar", r);
  }
  // planificador: ventana de llamadas en vuelo, orden de arranque al azar (semilla fija)
  const enVuelo = new Set();
  const disponibles = () => convs.filter((c) => !c.enCurso && c.i < c.pasos.length);
  let pasosHechos = 0, maxVuelo = 0;
  while (disponibles().length || enVuelo.size) {
    while (enVuelo.size < ventana && disponibles().length) {
      const c = rng.elegir(disponibles());
      c.enCurso = true;
      const p = paso(c).catch((e) => { errores.push(`${c.E.id}#${c.n}: ${e && e.message}`); }).then(() => { c.enCurso = false; c.i++; pasosHechos++; enVuelo.delete(p); });
      enVuelo.add(p); maxVuelo = Math.max(maxVuelo, enVuelo.size);
    }
    if (enVuelo.size) await Promise.race(enVuelo);
  }
  return { convs, violaciones, errores, pasosHechos, maxVuelo };
}
{
  const h = await crearHarness({ latenciaMaxMs: 3 });
  initTenant(null);
  const t0 = Date.now();
  const M = await correrMasivo({ h, nConv: 240, semilla: SEMILLA + 5, ventana: 24 });
  const abiertas = M.convs.filter((c) => c.id);
  ok(M.errores.length === 0, `ninguna llamada reventó (${M.errores.length} errores)`, M.errores.slice(0, 3).join(" | "));
  ok(abiertas.length >= 200 && M.pasosHechos >= 500 && M.maxVuelo >= 12, `${abiertas.length} conversaciones, ${M.pasosHechos} llamadas, hasta ${M.maxVuelo} en vuelo a la vez (${((Date.now() - t0) / 1000).toFixed(0)} s)`);
  ok(new Set(M.convs.map((c) => c.E.id)).size === 6, "las seis empresas participaron");
  ok(M.violaciones.length === 0, `★ ${M.pasosHechos} respuestas: ni una cifra, nombre, centinela ni dato declarado de otra empresa; cada Entrega con SU turno y SU cifra`, JSON.stringify(M.violaciones.slice(0, 3)));
  ok(esTenantVacio(getTenantData()), "y ninguna empresa quedó activa en el Core");

  // lo GUARDADO por empresa: solo lo suyo
  let cruces = [];
  for (const E of EMPRESAS) {
    const f = h.db.filasDeEmpresa(E.id), texto = JSON.stringify(f);
    cruces.push(...G.controlDeNoMezcla({ textos: [{ empresa: E.id, donde: "lo guardado", texto }], marcadores: MARCADORES }));
    const suyas = new Set(M.convs.filter((c) => c.E.id === E.id && c.id).map((c) => c.id));
    const guardadas = new Set(f.conversaciones.map((c) => c.hilo_id));
    if (suyas.size !== guardadas.size || [...suyas].some((x) => !guardadas.has(x))) cruces.push({ E: E.id, causa: "las conversaciones guardadas no son exactamente las de la empresa" });
    if (f.memoria.some((x) => x.conversacion_id && !suyas.has(x.conversacion_id))) cruces.push({ E: E.id, causa: "un hecho aportado desde una conversación de otra empresa" });
  }
  cruces.push(...cifrasAjenasEnLibros(h.db));
  ok(cruces.length === 0, "★ lo GUARDADO a nombre de cada empresa (libros y memoria) no contiene ni un nombre ni un centinela de otra ni una cifra que no recibió, y sus conversaciones son EXACTAMENTE las suyas", JSON.stringify(cruces.slice(0, 3)));

  // el REINICIO: la base se recarga en objetos nuevos y cada conversación vuelve idéntica
  const retomarTodo = async (hh) => {
    const out = {};
    for (const c of abiertas) { const r = await (await hh.accionesDe(c.E)).retomar({ tenant: hh.tenantDe(c.E), conversacionId: c.id }); out[c.id] = G.huella(G.resumirRetomar(r)); }
    return out;
  };
  const huellasEmpresa = async (hh) => { const o = {}; for (const E of EMPRESAS) { const st = await hh.almacenDe(E.id); o[E.id] = { memoria: G.huella(await st.leerHechosEmpresa(E.id)) }; } return o; };
  const retAntes = await retomarTodo(h), memAntes = await huellasEmpresa(h);
  const h2 = await crearHarness({ latenciaMaxMs: 3, semilla: SEMILLA + 6 });
  h2.db.importar(h.db.exportar());
  const retDespues = await retomarTodo(h2), memDespues = await huellasEmpresa(h2);
  const distintas = Object.keys(retAntes).filter((id) => retAntes[id] !== retDespues[id]);
  ok(Object.keys(retAntes).length === abiertas.length && distintas.length === 0, `★ REINICIO: las ${abiertas.length} conversaciones vuelven IDÉNTICAS (huella sha256 de su retomar) y la memoria de las 6 empresas también`, `${distintas.length} distintas`);
  ok(JSON.stringify(memAntes) === JSON.stringify(memDespues), "las huellas de la memoria de cada empresa son iguales antes y después");
  const solo = (hh, id) => G.huella(hh.db.filasDeEmpresa(id));
  ok(EMPRESAS.every((E) => solo(h, E.id) === solo(h2, E.id)), "y las filas guardadas de cada empresa (libros y memoria) son idénticas, byte a byte en forma canónica");

  /* CARNADA · un pase cruzado (la empresa e2 guarda con el pase de e1): el control de lo guardado lo ve */
  const hL = await crearHarness({ latenciaMaxMs: 2 });
  const ML = await correrMasivo({ h: hL, nConv: 24, semilla: SEMILLA + 7, ventana: 8, fabrica: async (E) => hL.almacenDe(E.id, E.id === "e2" ? "e1" : E.id) });
  let crucesL = [];
  for (const E of EMPRESAS) crucesL.push(...G.controlDeNoMezcla({ textos: [{ empresa: E.id, donde: "lo guardado", texto: JSON.stringify(hL.db.filasDeEmpresa(E.id)) }], marcadores: MARCADORES }));
  crucesL.push(...cifrasAjenasEnLibros(hL.db));
  ok(ML.violaciones.length + crucesL.length > 0, `★ CARNADA · si una empresa guarda con el pase de OTRA, el control ve ${ML.violaciones.length + crucesL.length} mezclas (respuestas y filas)`);
  initTenant(null);

  /* CARNADA · el almacén en memoria de ANTES indexaba el libro solo por conversación: una empresa abría el libro de otra */
  const memAntigua = () => { const L = new Map(); return { async leerLibro(_t, id) { return L.get(id) || null; }, async guardarLibro(_t, libro) { L.set(libro.conversacionId, libro); return libro; } }; };
  const am = memAntigua(); await am.guardarLibro("e1", libroNuevo({ conversacionId: "cv-ajena" }));
  ok((await am.leerLibro("e2", "cv-ajena")) !== null && (await crearAlmacenEnMemoria().leerLibro("e2", "cv-ajena")) === null, "★ CARNADA · el almacén que indexa el libro solo por conversación deja que e2 lea el de e1 — el de producción no");
}

/* ═══ 7 · D3 · EL HISTORIAL DE LA APP NO VE LOS HILOS DEL COMPLEMENTO ════════════════════════════════════════════════ */
H("7 · D3 · los hilos del Complemento no aparecen en el Historial de la app: lo decide el ORIGEN del hilo, no un título vacío");
{
  const h = await crearHarness({ latenciaMaxMs: 1 });
  const E = EMPRESAS[0], tenant = h.tenantDe(E);
  const env = { SUPABASE_JWT_SECRET: SECRETO_JWT };
  const pase = (await emitirPase({ tenantId: E.id, secreto: SECRETO_JWT })).pase;
  const acc = await h.accionesDe(E);
  const rComp1 = await acc.consultar({ tenant, encargo: G.encargoDeVentas("Jumbo") });
  const rComp2 = await (await h.accionesDe(E)).aportarContexto({ tenant, aportes: [{ clase: "hecho", concepto: "plazo_de_cobro", valor: 45 }] });
  const idsComplemento = [rComp1.continuidad.conversacionId, rComp2.conversacionId];
  await guardarConversacion({ tenantId: E.id, hilo: "hilo-app-1", mensajes: [{ role: "user", text: "¿cómo van las ventas?" }, { role: "adi", text: "Van bien." }], env, cliente: h.cliente });
  await h.cliente.llamarFuncion("adi_guardar_conversacion", { p_hilo_id: "hilo-app-vigia", p_titulo: "", p_mensajes: [] }, { pase });   // un hilo recién abierto de la app: título vacío, cero mensajes

  const filas = h.db.filasDeEmpresa(E.id).conversaciones;
  const delComplemento = filas.filter((c) => idsComplemento.includes(c.hilo_id));
  ok(delComplemento.length === 2 && delComplemento.every((c) => c.titulo === "" && c.mensajes.length === 0), "los hilos del Complemento se guardan con título vacío y cero mensajes (el caso que producía filas fantasma)");
  ok(delComplemento.every((c) => c.estado.origen === "complemento") && filas.filter((c) => !idsComplemento.includes(c.hilo_id)).every((c) => !c.estado.origen), "★ y llevan el ORIGEN del hilo (`complemento`), sellado por la base; los hilos de la app no lo llevan");
  ok(libroNuevo().origen === ORIGEN_LIBRO && ORIGEN_LIBRO === "complemento", "el libro nuevo trae su origen");

  const lista = await listarConversaciones({ tenantId: E.id, env, cliente: h.cliente });
  const hilos = lista.conversaciones.map((c) => c.hilo).sort();
  ok(lista.ok && JSON.stringify(hilos) === JSON.stringify(["hilo-app-1", "hilo-app-vigia"]), "★ el Historial de la app (usuario PRO) lista SOLO los hilos de la app", JSON.stringify(hilos));
  ok(lista.conversaciones.some((c) => c.hilo === "hilo-app-vigia" && c.titulo === "" && c.mensajes === 0), "★ y un hilo de la app vacío (título vacío, cero mensajes) SIGUE apareciendo: no es un filtro por título vacío");
  const abre = await leerConversacion({ tenantId: E.id, hilo: idsComplemento[0], env, cliente: h.cliente });
  ok(abre.ok === false, "el Historial tampoco puede ABRIR un hilo del Complemento");
  const ret = await (await h.accionesDe(E)).retomar({ tenant, conversacionId: idsComplemento[0] });
  ok(ret.ok === true && ret.entregas.length === 1, "pero el Complemento SÍ lo retoma (el libro sigue ahí)");
  const retApp = await (await h.accionesDe(E)).retomar({ tenant, conversacionId: "hilo-app-1" });
  ok(retApp.ok === false, "y un hilo de la app NO es un libro: retomar no lo encuentra");

  /* CARNADA D3 · la lista de ANTES (010), sin la condición de origen: filas fantasma */
  const hV = await crearHarness({ latenciaMaxMs: 1, modoListado: "010" });
  const tV = hV.tenantDe(E), pV = (await emitirPase({ tenantId: E.id, secreto: SECRETO_JWT })).pase;
  const rv = await (await hV.accionesDe(E)).consultar({ tenant: tV, encargo: G.encargoDeVentas("Jumbo") });
  await hV.cliente.llamarFuncion("adi_guardar_conversacion", { p_hilo_id: "hilo-app-vigia", p_titulo: "", p_mensajes: [] }, { pase: pV });
  const listaV = await listarConversaciones({ tenantId: E.id, env, cliente: hV.cliente });
  const fantasmas = listaV.conversaciones.filter((c) => c.hilo === rv.continuidad.conversacionId && c.titulo === "" && c.mensajes === 0);
  ok(fantasmas.length === 1, "★ CARNADA D3 · con la lista de ANTES (sin condición de origen) el hilo del Complemento aparece en el Historial como una fila vacía — el control lo ve");
  // plan gratis: el Historial no existe (nada que ocultar)
  const hG = await crearHarness({ latenciaMaxMs: 0, planes: { e1: "gratis" } });
  await (await hG.accionesDe(E)).consultar({ tenant: hG.tenantDe(E), encargo: G.encargoDeVentas("Jumbo") });
  ok((await listarConversaciones({ tenantId: E.id, env, cliente: hG.cliente })).conversaciones.length === 0, "un usuario sin plan pro no ve Historial, haya o no hilos del Complemento");

  /* la migración 015 (el SQL) dice lo mismo que el doble — se lee como TEXTO */
  const sql = leer("./db/migraciones/015_memoria_empresa_y_conversacion.sql");
  const cuerpo = (nombre, texto) => { const m = new RegExp(`create or replace function public\\.${nombre}\\([\\s\\S]*?\\$\\$;`).exec(texto); return m ? m[0] : ""; };
  const auditarSql = (texto) => {
    const v = [];
    for (const f of ["adi_listar_conversaciones", "adi_leer_conversacion"]) {
      const c = cuerpo(f, texto);
      if (!c) { v.push(`${f}: no está redefinida en la 015`); continue; }
      if (!/coalesce\(c\.estado\s*->>\s*'origen',\s*'app'\)\s*=\s*'app'/.test(c)) v.push(`${f}: falta la condición de ORIGEN`);
      if (/c\.titulo\s*(<>|!=|=)\s*''|length\(\s*c\.titulo|c\.titulo\s+is\s+not\s+null|jsonb_array_length\(c\.mensajes\)\s*(>|<>|!=|=)/i.test(c)) v.push(`${f}: filtra por TÍTULO vacío o por conteo de mensajes`);
    }
    if (!/jsonb_set\(p_estado,\s*'\{origen\}',\s*to_jsonb\('complemento'::text\)\)/.test(cuerpo("adi_guardar_estado_conversacion", texto))) v.push("adi_guardar_estado_conversacion: la base no SELLA el origen");
    if (!/c\.estado\s*->>\s*'origen'\s*=\s*'complemento'/.test(cuerpo("adi_leer_estado_conversacion", texto))) v.push("adi_leer_estado_conversacion: no exige que sea un libro");
    if (/add column[^;]*\borigen\b/i.test(texto)) v.push("agrega una COLUMNA `origen` (eso es una migración que decide el owner)");
    return v;
  };
  ok(auditarSql(sql).length === 0, "★ la migración 015 (el SQL) filtra el Historial por el ORIGEN, sella el origen al guardar, exige un libro al leerlo, no filtra por título ni por mensajes y no agrega columnas", JSON.stringify(auditarSql(sql)));
  ok(auditarSql(sql.replace("and coalesce(c.estado ->> 'origen', 'app') = 'app'   -- los hilos del Complemento no son del Historial de la app", "and c.titulo <> ''")).length >= 2, "★ CARNADA D3 · un filtro por título vacío en lugar del origen: el auditor marca la falta de origen Y el filtro por título");
  ok(auditarSql(sql.replace(/jsonb_set\(p_estado,\s*'\{origen\}',\s*to_jsonb\('complemento'::text\)\)/, "p_estado")).some((x) => /SELLA/.test(x)), "★ CARNADA D3 · si la base deja de sellar el origen, el auditor lo marca");
  ok(auditarSql(sql + "\nalter table public.conversaciones add column origen text;").some((x) => /COLUMNA/.test(x)), "★ y si alguien agrega una columna nueva sin decisión del owner, también");
}

/* ═══ 8 · LA PUERTA: la bandera, la base por pedido y el estado de hoy ═══════════════════════════════════════════════ */
H("8 · la puerta arma el almacén POR PEDIDO con el pase de la empresa; sin la bandera durable sigue como hoy");
{
  const { manejarPuerta } = await import(new URL("./src/adi/capacidad/puerta.js", import.meta.url).href + "?puerta8=1");
  const h = await crearHarness({ latenciaMaxMs: 1 });
  const ENV_BASE = { ADI_COMPLEMENTO: "true", ADI_TOKEN_SECRET: SECRETO_TOKEN, SUPABASE_URL: URL_DOBLE, SUPABASE_ANON_KEY: APIKEY_DOBLE, SUPABASE_JWT_SECRET: SECRETO_JWT };
  const codigo = (await makeAccessCode("Owner", 72, SECRETO_TOKEN, Date.now(), "e1")).code;
  const E = EMPRESAS[0];
  const llamar = (env, opciones, accion, args, ip) => G.crearLlamadorPuerta({ manejarPuerta, env, opciones, codigos: { e1: codigo }, base: `http://puerta.local/${ip}` })("e1", accion, args);
  // sin ADI_MEMORIA_DURABLE: la memoria del proceso (el estado de hoy); la base NO recibe nada de memoria
  const a = await llamar(ENV_BASE, { cliente: h.cliente, transporte: h.db.transporte }, "aportarContexto", { aportes: [{ clase: "hecho", concepto: "p", valor: 1 }] });
  const b = await llamar(ENV_BASE, { cliente: h.cliente, transporte: h.db.transporte }, "retomar", { conversacionId: a.conversacionId });
  ok(a.ok === true && b.ok === true && !h.db.metricas.porFuncion.adi_aportar_hecho_empresa && !h.db.metricas.porFuncion.adi_guardar_estado_conversacion, "SIN `ADI_MEMORIA_DURABLE` la puerta sigue como hoy: memoria del proceso, la base de memoria NO se toca");
  // con la bandera, sin base configurada → falla cerrado, no cae en silencio a la memoria del proceso
  const ENV_SIN_BASE = { ADI_COMPLEMENTO: "true", ADI_TOKEN_SECRET: SECRETO_TOKEN, ADI_MEMORIA_DURABLE: "true" };
  const { code: codDemo } = await makeAccessCode("Owner", 72, SECRETO_TOKEN, Date.now(), "demo");
  const resSinBase = await manejarPuerta(new Request("http://puerta.local/x", { method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${codDemo}`, "x-real-ip": "10.9.9.1" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: "conocerEmpresa", arguments: {} } }) }), ENV_SIN_BASE);
  const jSinBase = await resSinBase.json();
  ok(jSinBase.ok === false && jSinBase.memoria === "no_disponible" && /base no está configurada/.test(jSinBase.motivo), "con la bandera durable y SIN base configurada, la puerta falla CERRADO (no cae en silencio a la memoria del proceso)", JSON.stringify(jSinBase));
  // con la bandera y la 015 sin aplicar
  const hSin = await crearHarness({ migraciones: [], latenciaMaxMs: 0 });
  const ENV_DURABLE = { ...ENV_BASE, ADI_MEMORIA_DURABLE: "true" };
  const sinMig = await llamar(ENV_DURABLE, { cliente: hSin.cliente, transporte: hSin.db.transporte }, "conocerEmpresa", {}, "sinmig");
  ok(sinMig.ok === false && sinMig.memoria === "no_disponible", "con la bandera y la migración 015 SIN aplicar: «memoria no disponible», sin romper");
  // con la bandera y todo en orden: la base de memoria recibe las llamadas, siempre con el pase de SU empresa
  const c = await llamar(ENV_DURABLE, { cliente: h.cliente, transporte: h.db.transporte }, "aportarContexto", { aportes: [{ clase: "hecho", concepto: "q", valor: 2 }] }, "durable");
  const filas = h.db.filasDeEmpresa("e1");
  ok(c.ok === true && filas.memoria.some((f) => f.concepto === "q") && h.db.llamadas.filter((x) => /memoria|estado/.test(x.fn)).every((x) => x.tenant === "e1"), "con la bandera, lo aportado queda en la BASE de e1 y toda llamada de memoria viajó con el pase de e1");
  // estático: la cadena de la puerta sigue sin módulos de Node (corre en edge)
  const archivos = ["capacidad/puerta.js", "capacidad/acciones.js", "capacidad/aislamiento.js", "continuidad/almacen.js", "continuidad/almacenSupabase.js", "continuidad/empresa.js", "continuidad/libro.js", "continuidad/retomar.js", "continuidad/serializar.js"];
  const conNode = archivos.filter((f) => /from\s+["']node:/.test(sinComentarios(leer(`./src/adi/${f}`))));
  ok(conNode.length === 0, "★ ninguna pieza de la cadena de la puerta importa `node:*` (sigue corriendo en edge)", conNode.join(", "));
}

console.log(`\n── _guardado_durable_gate: PASS ${pass} · FAIL ${fail} (de ${pass + fail}) ──`);
if (fail) { console.log("\nFALLOS:"); for (const f of fails) console.log("  ✗ " + f); }
process.exit(fail ? 1 : 0);
