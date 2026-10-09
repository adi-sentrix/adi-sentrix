/* === _usar_lo_declarado_gate.mjs · LA ENTREGA USA LO DECLARADO Y PUEDE CITAR UNA RESPUESTA ANTERIOR (Etapa 2, bloque 3 · owner 2026-10-03, offline) ===
 * LEYES DEL OWNER (2026-09-25, aprobadas; no se reabren): los CUATRO ORÍGENES (medido · documento · declarado · supuesto) nunca se funden; la confirmación es
 * un sello aparte y no cambia el origen; un declarado NUNCA pisa un medido. Y: «la comprensión del lenguaje es del LLM» — ADI no reconoce frases: el anfitrión
 * declara un CONCEPTO TIPADO (el id de una referencia o de una métrica de la casa) y un número; ADI valida contra tablas cerradas.
 *
 * LO QUE ESTE BLOQUE AGREGA (y solo eso; la etapa 1 —la Entrega, el contrato §7.3 1-57, `entrega/` y sus controles— no se toca): 1) lo VIGENTE (confirmado) de la
 * memoria de la empresa entra a la Entrega: un criterio es su umbral «declarado por la empresa» (el mismo mecanismo de `umbral()`), un hecho se muestra declarado
 * al lado de lo medido con su origen y la diferencia; lo pendiente NUNCA entra y lo que no tiene lugar se queda en la memoria; 2) `contexto: "E1"` se resuelve contra
 * el libro de la conversación y trae lo que esa Entrega entregó, tal cual, sin recalcarlo. Sin nada declarado y sin cita, la Entrega sale BYTE-IDÉNTICA.
 *
 * LO QUE ESTE CANDADO PRUEBA (cada control tiene su CARNADA: una versión del código de ANTES, o con el defecto, que el control TIENE que marcar):
 *   §1  las tablas: cada referencia del léxico tiene su llave de POLICY; el dinero no se compara; el vocabulario sale del léxico (nada escrito aparte).
 *   §2  lo vigente que entra y lo que no (un pendiente, un retirado, un omitido, un concepto desconocido, un criterio con entidad, un valor fuera de rango…).
 *   §3  el contraste declarado/medido (coincide · difiere · sin medido · fuera de juego · período no se estira) y la cita contra el libro (todos los motivos).
 *   §4  LA PRUEBA DE ACEPTACIÓN, POR LA PUERTA (sin LLM, cero red; el almacén falso del bloque 1): el guion fijo del owner, con reinicio.
 *   §5  LAS CARNADAS del guion: el código de antes y seis defectos (un pendiente entra · un declarado pisa un medido · sin origen · la cita trae otra cosa ·
 *       cruce entre empresas · residuo en el Core): el guion TIENE que ponerse rojo en cada una.
 *   §6  CONVERSACIONES AL AZAR (semilla fija) contra un modelo independiente: un declarado nunca pisa un medido · un pendiente nunca entra · todo declarado usado
 *       lleva su origen · la cita trae exactamente lo entregado · cero cruce entre empresas. Las mismas carnadas.
 *   §7  SIN NADA DECLARADO NI CITA, la Entrega es la de siempre (byte a byte, sobre los catálogos de la etapa 1); la carga que cambió se declara y lo citado no se recalcula;
 *       el aislamiento del Core; y las auditorías de código (ni una regex en lo declarado, ni `preguntaOriginal`, la cadena de la puerta sin `node:*`).
 *
 * CERO llamadas a un LLM · CERO red. Solo por `npm run gates:offline` o
 * `node --import ./scripts/offline-guard.mjs _usar_lo_declarado_gate.mjs`. */
import fs from "node:fs";
import { crearAcciones } from "./src/adi/capacidad/acciones.js";
import { crearAlmacenEnMemoria } from "./src/adi/continuidad/almacen.js";
import * as LD from "./src/adi/capacidad/loDeclarado.js";
import { conTenantActivo } from "./src/adi/capacidad/aislamiento.js";
import { validarEncargo } from "./src/adi/encargo/validar.js";
import { componerEntrega } from "./src/adi/entrega/componer.js";
import { resolverContexto, libroNuevo, registrarEntrega } from "./src/adi/continuidad/libro.js";
import { POLICY, POLICY_CONFIG, POLICY_DE_REFERENCIA, umbral, umbralDePerfil, conCriteriosDeEmpresa, setBenchmarkOverride, getBenchmarkOverride } from "./src/config/businessPolicy.js";
import { CLAVES_DE_METRICA } from "./src/adi/notario/lexico.js";
import { crearSupabaseFalso, crearAzar } from "./scripts/doble-supabase-continuidad.mjs";
import { crearLlamadorPuerta } from "./scripts/guion-continuidad.mjs";
import { packDeEmpresa, importarPuertaFresca, SECRETO_TOKEN, SECRETO_JWT, URL_DOBLE, APIKEY_DOBLE } from "./scripts/guion-continuidad-doble.mjs";
import { crearClienteRest } from "./src/data/supabaseRest.js";
import { makeAccessCode } from "./src/adi/llm/accessToken.js";
import { TENANT_DEMO } from "./src/data/tenants/demo.js";

let pass = 0, fail = 0;
const fails = [];
const ok = (c, m, extra = "") => { if (c) { pass++; } else { fail++; fails.push(m + (extra ? " — " + extra : "")); console.log("  ✗ " + m + (extra ? "\n      " + extra : "")); } };
const H = (t) => console.log(`\n${t}`);
const SEMILLA = 20261003;
const leer = (p) => fs.readFileSync(new URL(p, import.meta.url), "utf8");
const sinComentarios = (src) => String(src).replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`\\])\/\/[^\n]*/g, "$1");
const jj = (x) => JSON.stringify(x);
const cmp = (a, b) => jj(a) === jj(b);
let _tick = 0;
const relojDeGate = () => new Date(Date.UTC(2026, 9, 3, 12, 0, 0) + (++_tick) * 1000).toISOString();

/* ── las empresas del campo de prueba: el pack del demo SIN el piso de rotación ni el techo de cobertura en su perfil, para que el criterio de ADI sea el que rige
 *    (en el demo el perfil ya los declara «por la empresa») y declararlos conversando CAMBIE el origen además del valor ─────────────────────────────────────────── */
function packSinUmbrales(E) {
  const d = packDeEmpresa(E);
  d.perfil = { ...d.perfil };
  delete d.perfil.rotacionMin; delete d.perfil.dohMax;
  return d;
}
const REFS = CLAVES_DE_METRICA.filter((m) => m.referencia).map((m) => m.clave);

/* ═══ 1 · LAS TABLAS: DE DÓNDE SALE EL VOCABULARIO Y DÓNDE TIENE LUGAR CADA COSA ═══════════════════════════════════════════ */
H("1 · las tablas: cada referencia del léxico tiene su llave de POLICY; el vocabulario sale del léxico; el dinero declarado no se compara");
{
  const sinLlave = (tabla) => REFS.filter((c) => !(tabla[c] && Object.prototype.hasOwnProperty.call(POLICY_CONFIG, tabla[c])));
  ok(REFS.length === 6 && sinLlave(POLICY_DE_REFERENCIA).length === 0, "★ cada referencia de la casa (léxico, `referencia: true`) tiene su llave en `POLICY_CONFIG`: un criterio declarado no puede quedar sin lugar por un descuido", jj(sinLlave(POLICY_DE_REFERENCIA)));
  ok(sinLlave({ ...POLICY_DE_REFERENCIA, piso_rotacion: undefined }).length === 1 && sinLlave({ ...POLICY_DE_REFERENCIA, techo_cobertura: "noExiste" }).length === 1, "★ CARNADA · una referencia sin llave, o con una llave que POLICY no tiene, la marca el control");
  ok(LD.CRITERIOS_DECLARABLES.length === REFS.length && cmp(LD.CRITERIOS_DECLARABLES.map((c) => c.concepto), REFS) && LD.CRITERIOS_DECLARABLES.every((c) => c.llave === POLICY_DE_REFERENCIA[c.concepto]), "los criterios declarables SON las referencias del léxico (misma lista, mismo orden), cada una con su llave");
  ok(LD.CRITERIOS_DECLARABLES.every((c) => c.unidad === CLAVES_DE_METRICA.find((m) => m.clave === c.concepto).unidad), "y su unidad es la del léxico (nunca una unidad escrita aparte)");
  const planos = LD.HECHOS_DECLARABLES.map((h) => h.concepto);
  ok(planos.length > 5 && LD.HECHOS_DECLARABLES.every((h) => ["pct", "pp", "days", "ratio", "count"].includes(h.unidad) && h.dominio), "los hechos declarables son métricas del léxico con dominio y una unidad cuya escala no se infiere");
  ok(!planos.some((c) => REFS.includes(c)) && !planos.includes("ventas") && !planos.includes("saldo_pendiente") && !planos.includes("saldo_vencido") && !planos.includes("participacion") && planos.includes("dias_vencido") && planos.includes("margen"), "★ el DINERO (ventas, saldos, capital…) y lo que no tiene base (participación) NO se declaran con lugar; una referencia no es un hecho; los días y los porcentajes sí", jj(planos));
  const d = LD.declarable();
  ok(d.criterios.length === REFS.length + 1 && cmp(d.criterios.map((c) => c.concepto), [...REFS, "piso_materialidad_cobranza"]) && d.criterios.every((c) => c.comoDeclarar.clase === "criterio" && c.comoDeclarar.concepto === c.concepto) && d.hechos.every((h) => h.comoDeclarar.clase === "hecho") && d.uso.length === 2, "`declarable()` dice al anfitrión qué declarar y cómo (la forma exacta del aporte), sin que haya que tocar el texto de las herramientas");
  const L = LD.lugarDeAporte;
  ok(L({ clase: "criterio", concepto: "piso_rotacion" }).enLaEntrega && L({ clase: "hecho", concepto: "dias_vencido" }).enLaEntrega, "un criterio con id de referencia y un hecho con id de métrica tienen lugar en la Entrega");
  ok(!L({ clase: "criterio", concepto: "benchmark propio" }).enLaEntrega && L({ clase: "criterio", concepto: "benchmark propio" }).validos.includes("piso_rotacion"), "un criterio con otro concepto se queda en la memoria y se dice cuáles sí tienen lugar (no se rechaza)");
  ok(!L({ clase: "hecho", concepto: "saldo_pendiente" }).enLaEntrega && /escala/.test(L({ clase: "hecho", concepto: "saldo_pendiente" }).motivo) && !L({ clase: "hecho", concepto: "piso_rotacion" }).enLaEntrega && !L({ clase: "documento", concepto: "dias_vencido" }).enLaEntrega, "el dinero, una referencia dicha como hecho y un documento: sin lugar (se quedan en la memoria), con su motivo");
  /* §7.3·58 (opción A): el PLAZO DE COBRO ya tiene lugar —se muestra declarado y la pregunta abierta de cobranza lo cita—, sin cambiar ningún cálculo */
  ok(L({ clase: "hecho", concepto: "plazo_de_cobro" }).enLaEntrega && /pregunta abierta/.test(L({ clase: "hecho", concepto: "plazo_de_cobro" }).como) && /no cambia ningún cálculo/.test(L({ clase: "hecho", concepto: "plazo_de_cobro" }).como), "el plazo de cobro SÍ tiene lugar (opción A): «Lo declarado» y la pregunta abierta de cobranza, sin cambiar ningún cálculo");
}

/* ═══ 2 · LO VIGENTE QUE ENTRA Y LO QUE NO ═════════════════════════════════════════════════════════════════════════════════ */
H("2 · solo lo VIGENTE (confirmado) entra; un pendiente, un retirado o un omitido nunca; lo que no tiene lugar no se fuerza");
const fila = (o = {}) => ({ id: "f1", clase: "hecho", concepto: "dias_vencido", eje: null, entidad: "Lider", periodo: null, valor: { raw: 15, unidad: "days", texto: null }, origen: "declarado", documento: null, estado: "vigente", declaradoEn: "2026-10-03T10:00:00.000Z", confirmacion: { por: "anfitrion", cuando: "2026-10-03T10:01:00.000Z", medio: "chat-anfitrion" }, ...o });
const crit = (o = {}) => fila({ clase: "criterio", concepto: "piso_rotacion", entidad: null, valor: { raw: 1.5, unidad: "ratio", texto: null }, ...o });
{
  const C = (filas) => LD.clasificarLoDeclarado(filas);
  const v1 = C([crit(), fila()]);
  ok(v1.criterios.length === 1 && v1.criterios[0].llave === "rotacionMin" && v1.criterios[0].valor === 1.5 && v1.criterios[0].origen === "declarado" && v1.criterios[0].sello.medio === "chat-anfitrion", "un criterio vigente con lugar entra: su llave de POLICY, su valor, origen «declarado» y su sello de confirmación aparte");
  ok(v1.hechos.length === 1 && v1.hechos[0].concepto === "dias_vencido" && v1.hechos[0].valor === 15 && v1.hechos[0].origen === "declarado", "un hecho vigente comparable entra, siempre «declarado»");
  const noEntra = (f, que) => ok(C([f]).criterios.length === 0 && C([f]).hechos.length === 0, `★ NO entra: ${que}`);
  for (const estado of ["pendiente", "retirado", "omitido"]) { noEntra(crit({ estado }), `un criterio «${estado}»`); noEntra(fila({ estado }), `un hecho «${estado}»`); }
  noEntra(crit({ concepto: "benchmark propio" }), "un criterio que no es una referencia de la casa");
  noEntra(crit({ entidad: "Lider" }), "un criterio con entidad (no es de toda la empresa)");
  noEntra(crit({ periodo: "2025" }), "un criterio con período");
  noEntra(crit({ valor: { raw: 99, unidad: "ratio" } }), "un criterio fuera de rango");
  noEntra(crit({ valor: { raw: 1.5, unidad: "pct" } }), "un criterio en otra unidad");
  noEntra(crit({ valor: { raw: null, unidad: null, texto: "1.5" } }), "un criterio sin número (solo texto: ADI no lee lenguaje)");
  noEntra(fila({ concepto: "saldo_pendiente", valor: { raw: 5, unidad: "money" } }), "dinero declarado (la escala no se infiere)");
  noEntra(fila({ valor: { raw: 15, unidad: "pct" } }), "una unidad que no es la de la métrica (jamás se convierte)");
  noEntra(fila({ concepto: "concepto_que_la_casa_no_conoce" }), "un concepto que la casa no conoce");
  /* el plazo de cobro (opción A, §7.3·58) no es un hecho que se contraste con lo medido: entra aparte, en `plazos`, solo en días y vigente */
  ok(LD.clasificarLoDeclarado([fila({ concepto: "plazo_de_cobro", entidad: "Lider", valor: { raw: 45, unidad: "days" } })]).plazos.length === 1 && LD.clasificarLoDeclarado([fila({ concepto: "plazo_de_cobro", entidad: "Lider", valor: { raw: 45, unidad: "days" } })]).hechos.length === 0 && LD.clasificarLoDeclarado([fila({ concepto: "plazo_de_cobro", valor: { raw: 45, unidad: "pct" } }), fila({ concepto: "plazo_de_cobro", valor: { raw: 0, unidad: "days" } }), fila({ concepto: "plazo_de_cobro", estado: "pendiente", valor: { raw: 45, unidad: "days" } })]).plazos.length === 0, "el plazo de cobro vigente entra aparte (en `plazos`, no como hecho contrastable); en otra unidad, en cero o pendiente, no");
  noEntra(fila({ clase: "documento", origen: "documento" }), "un dato de documento (todavía sin lugar)");
  noEntra(fila({ migradoDeLegado: "diario" }), "lo legado traducido en lectura");
  ok(C([crit({ id: "a", declaradoEn: "2026-10-03T10:00:00.000Z", valor: { raw: 1.5, unidad: "ratio" } }), crit({ id: "b", declaradoEn: "2026-10-03T11:00:00.000Z", valor: { raw: 1.1, unidad: "ratio" } })]).criterios[0].valor === 1.1, "dos vigentes de la misma llave: manda el más reciente (uno solo por llave)");
  ok(C(null).criterios.length === 0 && C([]).hechos.length === 0 && C([null, 3, {}]).criterios.length === 0, "entradas vacías o torcidas: nada entra, nada revienta");
  // CARNADA · el clasificador que no mira el estado: un pendiente pasa a ser dato
  const sinEstado = (filas) => LD.clasificarLoDeclarado(filas.map((f) => ({ ...f, estado: "vigente" })));
  ok(sinEstado([crit({ estado: "pendiente" })]).criterios.length === 1 && C([crit({ estado: "pendiente" })]).criterios.length === 0, "★ CARNADA · un clasificador que no mira el estado deja entrar un pendiente; el real no");
  // validarCriterio
  const V = (o) => LD.validarCriterio({ concepto: "piso_rotacion", raw: 1.5, ...o });
  ok(V({}).ok && V({ unidad: "ratio" }).ok && !V({ raw: "x" }).ok && !V({ raw: 0 }).ok && !V({ raw: -1 }).ok && !V({ raw: 13 }).ok && !V({ unidad: "pct" }).ok && !V({ entidad: "Lider" }).ok && !V({ periodo: "2025" }).ok && !LD.validarCriterio({ concepto: "nada", raw: 1 }).ok, "validarCriterio: número en su unidad y su rango, para toda la empresa; lo demás se rechaza con su motivo");
  ok(LD.validarCriterio({ concepto: "umbral_materialidad", raw: 0.1 }).ok && !LD.validarCriterio({ concepto: "umbral_materialidad", raw: 0 }).ok && LD.validarCriterio({ concepto: "umbral_frenado", raw: 60, unidad: "days" }).ok, "las referencias sin rango propio (materialidad, frenado) piden un número mayor que cero");
}

/* ═══ 3 · EL CONTRASTE Y LA CITA, PIEZA POR PIEZA ═══════════════════════════════════════════════════════════════════════════ */
H("3 · el contraste declarado/medido y la cita contra el libro: pieza por pieza, con todos sus motivos");
{
  const medido = (o = {}) => ({ id: "e1", ok: true, tipo: "ref", claves: new Set(["dias_vencido"]), origen: { titular: "medido" }, composicion: [{ origen: "medido" }], numeros: [{ raw: 269, unidad: "days", texto: "269d" }], roles: { sujetos: ["Lider"] }, ...o });
  const libroDe = (...hs) => ({ hechos: hs });
  const resolucion = (conceptos = ["dias_vencido"], entidades = [{ nombre: "Lider" }]) => ({ partes: [{ id: "p1", estado: "resuelta", conceptos, entidades }] });
  const decl = (o = {}) => LD.clasificarLoDeclarado([fila(o)]).hechos;
  const X = (hechos, libro, res = resolucion(), periodos = []) => LD.contrastarHechos({ hechos, libro, resolucion: res, periodos });
  let r = X(decl(), libroDe(medido()));
  ok(r.length === 1 && r[0].estado === "difiere" && r[0].medido.valor === 269 && r[0].medido.origen === "medido" && r[0].medido.hecho === "e1" && r[0].origen === "declarado" && r[0].diferencia.valor === -254 && r[0].diferencia.texto === "254 días" && r[0].diferencia.sentido === "declarado_menor", "difiere: los dos con su origen, la medida con su id, y la diferencia con su signo y su palabra", jj(r));
  r = X(decl({ valor: { raw: 269, unidad: "days" } }), libroDe(medido()));
  ok(r.length === 1 && r[0].estado === "coincide" && r[0].diferencia === null, "coincide: la misma cifra a la precisión de la casa no es un choque");
  r = X(decl(), libroDe());
  ok(r.length === 1 && r[0].estado === "sin_medido" && r[0].medido === null, "pedido por la consulta y sin cifra medida en la Entrega: se muestra declarado, sin medido con qué contrastar");
  ok(X(decl(), libroDe(), resolucion(["margen"])).length === 0 && X(decl(), libroDe(), resolucion(["dias_vencido"], [{ nombre: "Jumbo" }])).length === 0, "★ fuera de juego (la consulta no pidió esa métrica o esa entidad y no hay medido): NO se muestra — se queda en la memoria");
  ok(X(decl({ entidad: "Falabella" }), libroDe(medido())).length === 0, "una entidad distinta no se contrasta con la medida de otra");
  ok(X(decl({ entidad: null }), libroDe(medido())).length === 0 && X(decl({ entidad: null }), libroDe(medido({ roles: { sujetos: [] } }))).length === 1, "sin entidad es del negocio: solo se contrasta con una cifra del negocio");
  ok(X(decl({ valor: { raw: 15, unidad: "pct" } }), libroDe(medido())).length === 0, "una unidad distinta no se contrasta (jamás se convierte)");
  ok(X(decl(), libroDe(medido({ origen: { titular: "declarado" } }))).length === 1 && X(decl(), libroDe(medido({ origen: { titular: "declarado" } })))[0].estado === "sin_medido", "solo se contrasta con una cifra de origen «medido»: un declarado nunca es «lo medido»");
  ok(X(decl({ periodo: "2025" }), libroDe(medido())).length === 0 && X(decl({ periodo: "2025" }), libroDe(medido()), resolucion(), ["2025"]).length === 1 && X(decl({ periodo: "2025" }), libroDe(medido()), resolucion(), ["2026"]).length === 0, "★ un declarado con período NO se estira a otro: solo vale si el período de la Entrega es exactamente ese");
  ok(X(decl({ entidad: "lider" }), libroDe(medido())).length === 1, "la entidad se compara sin mayúsculas ni tildes (la misma regla del resto de la casa)");
  ok(LD.textoDeLoDeclarado({ hechos: [] }) === "" && LD.textoDeLoDeclarado({ hechos: null }) === "", "sin hechos en juego no hay bloque (cero texto)");
  const t = LD.textoDeLoDeclarado({ hechos: X(decl(), libroDe(medido())) });
  ok(/^\*\*Lo declarado por la empresa y confirmado\.\*\*/.test(t) && /Lider · Días vencido: 15 días, declarado por la empresa \(confirmado el 2026-10-03\)\. Medido por ADI: 269 días\. No coinciden: lo declarado queda por debajo de lo medido por 254 días\./.test(t) && /ADI no sustituye lo medido por lo declarado/.test(t), "el texto dice los dos orígenes, la diferencia y que lo medido no se sustituye", t);
  ok(!/\b(t[uú]|tus?|ti|vos|usted(?:es)?)\b/i.test(t.replace(/\*\*[^*]*\*\*/g, "")), "y va en tercera persona (la Entrega no le habla a nadie)");

  // la cita, contra un libro armado con el código real
  let libro = libroNuevo({ conversacionId: "c1", versionId: 3 });
  libro = registrarEntrega(libro, { versionId: 3, temas: ["cobranza"], entidades: ["Lider"], cierre: "cifra", hechos: [{ sujeto: "Lider", metrica: "Días vencido", valor: "269d", unidad: null, periodo: null, origen: "medido", ref: "e1" }, { sujeto: "Lider", metrica: "Saldo pendiente", valor: "$9.8M", origen: "medido", ref: "e2" }], universos: [{ id: "p1_Lider", eje: "cliente", entidades: ["Lider"] }], entregadaEn: "2026-10-03T12:00:00.000Z", periodo: { texto: "foto" } });
  libro = registrarEntrega(libro, { versionId: 3, temas: ["inventario"], entidades: [], cierre: "lectura", hechos: [], universos: [], entregadaEn: "2026-10-03T12:05:00.000Z" });
  const RC = (id, l = libro) => resolverContexto(l, id);
  let c = RC("E1");
  ok(c.ok && c.tipo === "entrega" && c.entrega.n === 1 && c.entrega.versionId === 3 && c.entrega.entregadaEn === "2026-10-03T12:00:00.000Z" && cmp(c.hechos.map((h) => h.id), ["E1.h1", "E1.h2"]) && c.hechos[0].valor === "269d" && c.hechos[0].ref === "e1" && c.universos.length === 1, "E1: lo que esa Entrega entregó, tal cual — sus hechos con id, la versión de la carga y cuándo", jj(c));
  c = RC("E1.h2");
  ok(c.ok && c.tipo === "hecho" && c.hecho.metrica === "Saldo pendiente" && c.hecho.valor === "$9.8M" && c.entrega.versionId === 3, "E1.h2: el hecho, con su Entrega");
  c = RC("E1.u1");
  ok(c.ok && c.tipo === "universo" && c.universo.id === "p1_Lider" && cmp(c.universo.entidades, ["Lider"]), "E1.u1: el primer universo de esa Entrega (por posición: el id interno del universo no es el que se cita)", jj(c));
  const motivo = (id, l = libro) => { const x = RC(id, l); return x.ok ? "OK" : x.detalle; };
  ok(/E1 a E2.*E9 no existe/.test(motivo("E9")), "un id inexistente se declina con su motivo claro: qué Entregas sí tiene la conversación", motivo("E9"));
  ok(/E1.h99 no existe/.test(motivo("E1.h99")) && /E1.h1 a E1.h2/.test(motivo("E1.h99")) && /E2 no tiene hechos/.test(motivo("E2.h1")) && /E1.u9 no existe/.test(motivo("E1.u9")), "un hecho o un universo que esa Entrega no tiene: dice qué sí tiene", motivo("E1.h99") + " | " + motivo("E2.h1"));
  ok(/falta el conversacionId/.test(motivo("E1", null)) && /todavía no tiene ninguna Entrega/.test(motivo("E1", libroNuevo({ conversacionId: "c2" }))), "sin libro (no hay conversacionId o no existe), o con un libro vacío: motivo claro");
  const recortado = { ...libro, entregas: [{ n: 1, turno: 1, versionId: 3, temas: ["cobranza"], recortada: true }, libro.entregas[1]] };
  ok(RC("E1", recortado).ok && RC("E1", recortado).entrega.recortada === true && /se recortó por capacidad de la memoria de la conversación/.test(motivo("E1.h1", recortado)) && /Vuelva a consultarla/.test(motivo("E1.h1", recortado)), "una Entrega recortada por capacidad se cita (conserva sus temas y su carga) pero sus hechos ya no, y lo dice (ensayo 11: «se recortó por capacidad de la memoria de la conversación… vuelva a consultarla»)");
  ok(/ya no se conserva/.test(motivo("E1", { ...libro, entregas: [libro.entregas[1]] })), "una Entrega que el libro ya quitó por el tope de 12 lo dice (no «no existe»)");
  ok(!RC("zzz").ok && !RC(null).ok, "un id que no tiene la forma de una referencia no resuelve");
  // la cita no muta el libro y trae copias
  const antes = jj(libro); const c2 = RC("E1"); c2.hechos[0].valor = "otra cosa"; c2.universos[0].id = "x";
  ok(jj(libro) === antes, "la cita devuelve copias: nadie muta el libro por citarlo");
  // el validador: sin libro es la Etapa 1, con libro resuelve
  const enc = { version: "encargo/v1", partes: [{ id: "p1", tema: "cobranza", cierre: "cifra", conceptos: ["dias_vencido"], entidades: [{ nombre: "Lider" }] }], contexto: { entregaRef: "E1", hechosRef: ["E1.h1", "E9.h1", "E1x"], universoRef: "E1.u1" } };
  const [R0, R1, R2, R3] = conTenantActivo(TENANT_DEMO, () => [validarEncargo(enc, {}), validarEncargo(enc), validarEncargo(enc, { libro }), validarEncargo(enc, { libro: null })]);
  ok(jj(R0) === jj(R1) && R0.contextoResuelto === undefined && R0.noResuelto.filter((n) => n.campo === "contexto").every((n) => (n.motivo === "contexto_no_disponible" && n.detalle === "") || n.motivo === "contexto_mal_formado") && R0.noResuelto.filter((n) => n.motivo === "contexto_no_disponible").length === 4, "★ SIN libro (la Etapa 1) el validador es el de siempre, byte a byte: todo contexto «no disponible», sin detalle y sin `contextoResuelto`");
  ok(cmp(R2.contextoResuelto.map((x) => x.id), ["E1", "E1.h1", "E1.u1"]) && R2.noResuelto.filter((n) => n.campo === "contexto").length === 2 && R2.noResuelto.find((n) => n.valor === "E9.h1").motivo === "contexto_no_disponible" && /E9.h1 no existe/.test(R2.noResuelto.find((n) => n.valor === "E9.h1").detalle) && R2.noResuelto.find((n) => n.valor === "E1x").motivo === "contexto_mal_formado", "CON libro: lo que resuelve va a `contextoResuelto`, lo que no declara su motivo, y un id mal formado sigue siendo mal formado");
  ok(R2.ok === R0.ok && jj(R2.partes) === jj(R0.partes), "la cita no cambia cómo se resuelven las partes del encargo");
  ok(R3.contextoResuelto === undefined && R3.noResuelto.filter((n) => n.motivo === "contexto_no_disponible").every((n) => /falta el conversacionId/.test(n.detalle)), "con `libro: null` (la conversación no tiene libro): ninguna cita resuelve y el motivo lo dice");
  // CARNADA · una cita que no mira el id (trae siempre la primera Entrega)
  const citaCiega = (l) => resolverContexto(l, "E1");
  ok(citaCiega(libro).ok && !RC("E9").ok, "★ CARNADA · una cita que ignora el id resuelve cualquier cosa (E9 también); la real declina el que no existe");
}
/* ═══ EL ENTORNO DE LA PUERTA (el almacén falso del bloque 1: la puerta real + un doble de Supabase) ═════════════════════════════ */
const EMPRESAS = [
  { id: "alfa", nombre: "Comercial Alfa", factor: 1, version: 3 },
  { id: "beta", nombre: "Comercial Beta", factor: 2.5, version: 7 },
  { id: "gamma", nombre: "Comercial Gamma", factor: 0.4, version: 5 },
];
async function armarEntorno({ empresas = EMPRESAS, estadoJson = null, durable = true, latenciaMaxMs = 2, semilla = SEMILLA } = {}) {
  const db = crearSupabaseFalso({
    secretoJwt: SECRETO_JWT, semilla, latenciaMaxMs, migraciones: ["015"], modoListado: "015",
    tenants: estadoJson ? [] : empresas.map((E) => ({ id: E.id, nombre: E.nombre, plan: "pro", version: E.version, sello: { nota: `carga ${E.version}` }, pack: packSinUmbrales(E) })),
  });
  if (estadoJson) db.importar(estadoJson);
  const env = { ADI_COMPLEMENTO: "true", ADI_TOKEN_SECRET: SECRETO_TOKEN, ...(durable ? { ADI_MEMORIA_DURABLE: "true" } : {}), SUPABASE_URL: URL_DOBLE, SUPABASE_ANON_KEY: APIKEY_DOBLE, SUPABASE_JWT_SECRET: SECRETO_JWT };
  const cliente = crearClienteRest({ url: URL_DOBLE, apikey: APIKEY_DOBLE, transporte: db.transporte });
  const codigos = {};
  for (const E of empresas) codigos[E.id] = (await makeAccessCode("Owner", 72, SECRETO_TOKEN, Date.now(), E.id)).code;
  return { db, env, cliente, codigos, manejarPuerta: await importarPuertaFresca() };
}
/* (a) la puerta REAL contra el doble de Supabase: lo durable, con reinicio de la base */
async function bancoDurable() {
  let ent = await armarEntorno();
  let llamar = crearLlamadorPuerta({ manejarPuerta: ent.manejarPuerta, env: ent.env, opciones: { cliente: ent.cliente, transporte: ent.db.transporte }, codigos: ent.codigos });
  return {
    nombre: "puerta real · memoria durable (doble de Supabase)", durable: true,
    llamar: (e, a, args) => llamar(e, a, args),
    async reiniciar() { ent = await armarEntorno({ estadoJson: ent.db.exportar() }); llamar = crearLlamadorPuerta({ manejarPuerta: ent.manejarPuerta, env: ent.env, opciones: { cliente: ent.cliente, transporte: ent.db.transporte }, codigos: ent.codigos }); },
  };
}
/* (b) la puerta con las acciones INYECTADAS sobre una memoria del proceso: el código real, o con un defecto (la carnada) */
async function bancoProceso({ carnada = null, nombre = "puerta · memoria del proceso" } = {}) {
  const ent0 = await armarEntorno({ durable: false, latenciaMaxMs: 0 });   // el doble solo resuelve QUIÉN es cada empresa (token → tenant)
  const store = crearAlmacenEnMemoria();
  const acc = accionesDe(store, carnada);
  const llamar = crearLlamadorPuerta({ manejarPuerta: ent0.manejarPuerta, env: ent0.env, opciones: { cliente: ent0.cliente, transporte: ent0.db.transporte, acciones: acc }, codigos: ent0.codigos });
  return { nombre, durable: false, llamar: (e, a, args) => llamar(e, a, args), store };
}

/* ═══ LAS CARNADAS: el código de ANTES y los defectos, como envoltorios de la acción real ═══════════════════════════════════════ */
const OTRA = { alfa: "beta", beta: "alfa", gamma: "alfa", e1: "e2", e2: "e1", e3: "e1", e4: "e1" };
const quitarContexto = (a) => ({ ...a, encargo: a && a.encargo ? { ...a.encargo, contexto: undefined } : a.encargo });
const CARNADAS = {
  antes: { nota: "el código de ANTES: no lee lo declarado ni resuelve la cita", entrada: quitarContexto, vista: (s) => ({ ...s, leerHechosEmpresa: async () => [] }) },
  pendienteEntra: { nota: "un pendiente entra como si fuera dato", vista: (s) => ({ ...s, leerHechosEmpresa: async (t) => (await s.leerHechosEmpresa(t)).map((f) => (f.estado === "pendiente" ? { ...f, estado: "vigente" } : f)) }) },
  cruceEmpresas: { nota: "lee la memoria de OTRA empresa", vista: (s) => ({ ...s, leerHechosEmpresa: async (t) => s.leerHechosEmpresa(OTRA[t] || t) }) },
  pisaMedido: {
    nota: "un declarado pisa a un medido (sustituye la cifra medida por la declarada)",
    salida: (r) => {
      if (!(r && r.declarado && r.entrega)) return r;
      const dif = r.declarado.hechos.find((h) => h.estado === "difiere"); if (!dif) return r;
      const j = JSON.parse(JSON.stringify(r)); const antes = `${dif.medido.valor}d`;
      for (const f of j.entrega.json.cifras.filas) if (f.valores["Valor"] === antes) f.valores["Valor"] = `${dif.valor}d`;
      j.entrega.texto = j.entrega.texto.split("\n").filter((l) => !/Medido por ADI/.test(l)).join("\n").replace(`${dif.medido.valor} días`, `${dif.valor} días`);
      return j;
    },
  },
  sinOrigen: { nota: "lo declarado sale sin su origen", salida: (r) => { if (!(r && r.declarado)) return r; const j = JSON.parse(JSON.stringify(r)); const q = (o) => { if (Array.isArray(o)) o.forEach(q); else if (o && typeof o === "object") { delete o.origen; delete o.etiquetaDeOrigen; Object.values(o).forEach(q); } }; q(j.declarado); j.entrega.texto = j.entrega.texto.split("declarado por la empresa").join("registrado"); j.entrega.json.marco.definiciones = j.entrega.json.marco.definiciones.map((d) => d.split("declarado por la empresa").join("registrado")); return j; } },
  citaEquivocada: {
    nota: "la cita trae otra Entrega (la siguiente a la pedida)",
    entrada: (a) => {
      const e = a && a.encargo; if (!(e && e.contexto)) return a;
      const corre = (id) => (typeof id === "string" ? id.replace(/^E(\d+)/, (_m, n) => `E${Number(n) + 1}`) : id);
      const c = e.contexto;
      return { ...a, encargo: { ...e, contexto: { ...(c.entregaRef ? { entregaRef: corre(c.entregaRef) } : {}), ...(c.hechosRef ? { hechosRef: c.hechosRef.map(corre) } : {}), ...(c.universoRef ? { universoRef: corre(c.universoRef) } : {}) } } };
    },
  },
  residuo: { nota: "el criterio declarado queda aplicado FUERA del tramo del Core (residuo para la próxima empresa)", salida: (r) => { POLICY.rotacionMin = 1.5; setBenchmarkOverride(28); return r; } },
};
/* acciones(store, carnada) → las acciones reales; con una carnada, `consultar` corre con la vista defectuosa del almacén, la entrada o la salida alteradas */
function accionesDe(store, carnada = null, { ahora = relojDeGate, vistaBase = (s) => s } = {}) {
  const base = crearAcciones({ continuidad: vistaBase(store), ahora });
  if (!carnada) return base;
  const K = CARNADAS[carnada];
  const conVista = K.vista ? crearAcciones({ continuidad: K.vista(vistaBase(store)), ahora }) : base;
  return {
    ...base,
    async consultar(a) { const r = await conVista.consultar(K.entrada ? K.entrada(a) : a); return K.salida ? K.salida(r) : r; },
  };
}

/* ═══ 4 · LA PRUEBA DE ACEPTACIÓN: el guion fijo, por la puerta ═══════════════════════════════════════════════════════════════ */
const encRota = (conv = null, extra = {}) => ({ version: "encargo/v1", ...(conv ? { conversacionId: conv } : {}), ...extra, partes: [{ id: "p1", tema: "inventario", cierre: "lectura", universo: { eje: "sku", estados: ["rota lento"] } }] });
const encInv = (conv = null) => ({ version: "encargo/v1", ...(conv ? { conversacionId: conv } : {}), partes: [{ id: "p1", tema: "inventario", cierre: "cifra", conceptos: ["capital_inmovilizado"], eje: "sku" }] });
const encCob = (ent, conv = null, extra = {}) => ({ version: "encargo/v1", ...(conv ? { conversacionId: conv } : {}), ...extra, partes: [{ id: "p1", tema: "cobranza", cierre: "cifra", conceptos: ["dias_vencido", "saldo_pendiente"], entidades: [{ nombre: ent, eje: "cliente" }] }] });
/* lo que viaja por la puerta es la respuesta COMPACTA (`capacidad/compacto.js`): el Marco con sus definiciones (`entrega.marco`), las cifras con su id (`entrega.cifras`) y los universos con su id y su tamaño; el JSON completo es de las acciones directas */
const marcoDeC = (c) => (c && c.entrega ? (c.entrega.marco || (c.entrega.json && c.entrega.json.marco)) : null);
const clausulaDe = (c) => ((marcoDeC(c) && marcoDeC(c).definiciones) || []).find((d) => d.startsWith("Criterio de inventario — ")) || "";
const universoDe = (c) => ((c && c.entrega && (c.entrega.json ? c.entrega.json.universos : c.entrega.universos) || [])[0] || {}).entidades || [];   // la compacta dice los miembros de un universo que cabe a la vista (`universos[].entidades`)
const universoOrdenado = (c) => universoDe(c).slice().sort();
const filasDe = (c) => (c && c.entrega && c.entrega.json ? ((c.entrega.json.cifras && c.entrega.json.cifras.filas) || [])
  : ((c && c.entrega && c.entrega.cifras) || []).map((x) => ({ valores: { "Entidad / grupo": x.entidad, "Métrica": x.metrica, "Valor": x.valor, "Tipo": x.procedencia }, procedencia: x.procedencia })));   // la compacta: cada cifra con su id, entidad, métrica, valor y procedencia
const rotaMenorQue = (E, piso) => packSinUmbrales(E).skuInventario.filter((s) => s.rotacion < piso).map((s) => s.sku).sort();
const EMP = Object.fromEntries(EMPRESAS.map((E) => [E.id, E]));
const SNAPSHOT_CORE = () => jj({ rot: umbral("rotacionMin"), techo: umbral("dohMax"), bench: umbral("benchmark"), p: [POLICY.rotacionMin, POLICY.dohMax, POLICY.benchmark, POLICY.targetCarga], ov: getBenchmarkOverride() });

/* una EXCEPCIÓN del guion (un campo que falta porque la Entrega no es la esperada) es un paso en rojo, no un gate que se cae: con una carnada, eso es detectarla */
async function guion(banco) {
  const res = [];
  try { await guionDe(banco, res); }
  catch (e) { res.push({ id: `EXCEPCIÓN del guion: ${String(e && e.message).slice(0, 120)}`, ok: false, det: String(e && e.stack).split("\n").slice(0, 3).join(" | ").slice(0, 300) }); }
  return res;
}
async function guionDe(banco, res) {
  const R = (id, cond, det = "") => res.push({ id, ok: Boolean(cond), det: cond ? "" : String(det).slice(0, 500) });
  const L = (e, a, args = {}) => banco.llamar(e, a, args);
  conTenantActivo(TENANT_DEMO, () => 1);   // el estado del Core, limpio (lo que dejó una carnada anterior se barre con el `initTenant` de la salida)
  const core0 = SNAPSHOT_CORE();
  const sinResiduo = (donde) => R(`${donde} · sin residuo: fuera del tramo, el Core queda como estaba (ni el umbral ni su origen se quedan aplicados)`, SNAPSHOT_CORE() === core0, SNAPSHOT_CORE());
  const confirmar = (e, conv, ids) => L(e, "aportarContexto", { conversacionId: conv, confirmar: ids });
  const aportar = (e, conv, aportes) => L(e, "aportarContexto", { conversacionId: conv, aportes });

  // ── ALFA · el criterio: declarar → confirmar → la Entrega lo usa y lo muestra con su origen ─────────────────────────────────
  const c0 = await L("alfa", "conocerEmpresa");
  R("A0 conocerEmpresa dice qué se puede declarar con lugar: los 6 criterios del léxico (más el piso de materialidad de cobranza, bloque 5) y los hechos comparables (nada de dinero)", c0.ok && c0.declarable && cmp(c0.declarable.criterios.map((x) => x.concepto), [...REFS, "piso_materialidad_cobranza"]) && c0.declarable.hechos.length > 5 && c0.declarable.hechos.every((h) => h.unidad !== "money"), jj(c0.declarable && c0.declarable.criterios.map((x) => x.concepto)));
  const a1 = await L("alfa", "consultar", { encargo: encRota() });
  const convA = a1.continuidad.conversacionId;
  R("A1 sin declarar nada: el piso de rotación rige como «criterio general de ADI» (2.0x), sin bloque «declarado»", a1.ok && /piso de rotación: 2\.0x, criterio general de ADI/.test(clausulaDe(a1)) && a1.declarado === undefined && a1.antecedentes === undefined && cmp(universoOrdenado(a1), rotaMenorQue(EMP.alfa, 2)), clausulaDe(a1));
  sinResiduo("A1");
  const a2 = await aportar("alfa", convA, [{ clase: "criterio", concepto: "piso_rotacion", valor: { raw: 1.5, unidad: "ratio" } }]);
  const idPiso = (a2.resultados[0] || {}).id;
  R("A2 declarar el criterio: queda PENDIENTE y dice dónde se usará (y que lo muestra «declarado por la empresa» al confirmarse)", a2.ok && a2.resultados[0].estado === "pendiente" && a2.resultados[0].paraConfirmar === true && a2.resultados[0].lugar.enLaEntrega === true && /declarado por la empresa/.test(a2.resultados[0].lugar.como), jj(a2.resultados));
  const a3 = await L("alfa", "consultar", { encargo: encRota(convA) });
  R("A3 ★ SIN CONFIRMAR la Entrega NO lo usa: mismo piso de ADI, mismos SKU, mismo texto, sin bloque", a3.ok && a3.entrega.texto === a1.entrega.texto && a3.declarado === undefined && /criterio general de ADI/.test(clausulaDe(a3)), clausulaDe(a3));
  await confirmar("alfa", convA, [idPiso]);
  const a4 = await L("alfa", "consultar", { encargo: encRota(convA) });
  R("A4 confirmado: la Entrega lo USA — el Marco lo muestra «declarado por la empresa» con su valor", a4.ok && /piso de rotación: 1\.5x, declarado por la empresa/.test(clausulaDe(a4)), clausulaDe(a4));
  R("A4 y lo usa DE VERDAD: los SKU que rotan lento son los que el dato dice con ese piso (calculado aparte, del dato)", cmp(universoOrdenado(a4), rotaMenorQue(EMP.alfa, 1.5)) && !cmp(universoOrdenado(a4), universoOrdenado(a1)), jj([universoOrdenado(a4), rotaMenorQue(EMP.alfa, 1.5)]));
  const k4 = a4.declarado && a4.declarado.criterios[0];
  R("A4 el bloque estructurado dice su origen «declarado», su sello de confirmación y lo que desplazó (el criterio de ADI que regía)", k4 && k4.concepto === "piso_rotacion" && k4.valor === 1.5 && k4.origen === "declarado" && k4.etiquetaDeOrigen === "declarado por la empresa" && k4.sello && k4.sello.medio === "chat-anfitrion" && k4.desplaza && k4.desplaza.valor === 2 && k4.desplaza.origen === "adi", jj(k4));
  sinResiduo("A4");

  // ── BETA · intercalada: lo declarado por una NUNCA aparece en la otra ─────────────────────────────────────────────────────────
  const b1 = await L("beta", "consultar", { encargo: encRota() });
  const convB = b1.continuidad.conversacionId;
  R("B1 beta, intercalada con alfa: su piso es el de ADI (2.0x) — el 1.5x de alfa no aparece", b1.ok && /piso de rotación: 2\.0x, criterio general de ADI/.test(clausulaDe(b1)) && b1.declarado === undefined && !/1\.5x/.test(b1.entrega.texto), clausulaDe(b1));
  const b2 = await aportar("beta", convB, [{ clase: "criterio", concepto: "piso_rotacion", valor: { raw: 0.9, unidad: "ratio" } }]);
  await confirmar("beta", convB, [(b2.resultados[0] || {}).id]);
  const b3 = await L("beta", "consultar", { encargo: encRota(convB) });
  R("B3 beta confirma el suyo (0.9x): lo usa, con su origen, y calcula con SU dato", b3.ok && /piso de rotación: 0\.9x, declarado por la empresa/.test(clausulaDe(b3)) && cmp(universoOrdenado(b3), rotaMenorQue(EMP.beta, 0.9)), clausulaDe(b3));
  const a5 = await L("alfa", "consultar", { encargo: encRota(convA) });
  R("B4 alfa de nuevo: sigue con el SUYO (1.5x), nunca el de beta", a5.ok && /piso de rotación: 1\.5x, declarado por la empresa/.test(clausulaDe(a5)) && !/0\.9x/.test(a5.entrega.texto), clausulaDe(a5));
  const g1 = await L("gamma", "consultar", { encargo: encRota() });
  R("B5 gamma, que no declaró nada: ni el de alfa ni el de beta", g1.ok && /piso de rotación: 2\.0x, criterio general de ADI/.test(clausulaDe(g1)) && g1.declarado === undefined, clausulaDe(g1));
  sinResiduo("B");

  // ── valores que NO sirven ──────────────────────────────────────────────────────────────────────────────────────────────────────
  const x1 = await aportar("gamma", g1.continuidad.conversacionId, [
    { clase: "criterio", concepto: "piso_rotacion", valor: 99 },
    { clase: "criterio", concepto: "piso_rotacion", valor: "uno y medio" },
    { clase: "criterio", concepto: "piso_rotacion", valor: { raw: 1.5, unidad: "pct" } },
    { clase: "criterio", concepto: "piso_rotacion", entidad: "LG-DRYER8KG", valor: 1.5 },
  ]);
  R("X1 un valor fuera de rango, sin número, en otra unidad o con una entidad: se RECHAZA con su motivo y no se guarda nada", x1.ok && x1.resultados.length === 4 && x1.resultados.every((r) => r.estado === "rechazado" && r.motivo), jj(x1.resultados));
  const g2 = await L("gamma", "consultar", { encargo: encRota(g1.continuidad.conversacionId) });
  R("X2 y la Entrega de gamma no cambia", g2.ok && /2\.0x, criterio general de ADI/.test(clausulaDe(g2)));

  // ── ALFA · el hecho declarado al lado del medido ─────────────────────────────────────────────────────────────────────────────
  const sinHechos = (c) => !c.declarado || (c.declarado.hechos || []).length === 0;   // alfa ya tiene un criterio confirmado (rige en todo lo que ADI calcula): lo que NO aparece es un hecho
  const h0 =await L("alfa", "consultar", { encargo: encCob("Lider", convA) });
  const baseFilas = filasDe(h0);
  const medidoLider = (() => { const f = baseFilas.find((x) => x.valores["Métrica"] === "Días vencido"); const m = f && /(\d+)d/.exec(f.valores["Valor"]); return m ? Number(m[1]) : null; })();
  R("H0 sin declarar: la Entrega de cobranza trae lo medido (días vencido de Lider) y ningún bloque «declarado»", h0.ok && medidoLider > 100 && sinHechos(h0) && !/Lo declarado por la empresa/.test(h0.entrega.texto), String(medidoLider));
  const h1 = await aportar("alfa", convA, [{ clase: "hecho", concepto: "dias_vencido", entidad: "Lider", valor: { raw: 15, unidad: "days" } }]);
  const idDias = (h1.resultados[0] || {}).id;
  R("H1 declarar el hecho: pendiente, y dice que se mostrará al lado de lo medido sin reemplazarlo", h1.ok && h1.resultados[0].estado === "pendiente" && h1.resultados[0].lugar.enLaEntrega === true && /nunca reemplaza lo medido/.test(h1.resultados[0].lugar.como), jj(h1.resultados));
  const h2 = await L("alfa", "consultar", { encargo: encCob("Lider", convA) });
  R("H2 ★ pendiente: NO entra — la Entrega es la misma, sin una palabra de lo declarado", h2.ok && h2.entrega.texto === h0.entrega.texto && sinHechos(h2), h2.declarado && jj(h2.declarado));
  await confirmar("alfa", convA, [idDias]);
  const h3 = await L("alfa", "consultar", { encargo: encCob("Lider", convA) });
  const d3 = h3.declarado && h3.declarado.hechos[0];
  R("H3 ★ confirmado y en CHOQUE con lo medido: aparecen LOS DOS, cada uno con su origen, y se declara la diferencia", h3.ok && d3 && d3.estado === "difiere" && d3.valor === 15 && d3.origen === "declarado" && d3.etiquetaDeOrigen === "declarado por la empresa" && d3.medido.valor === medidoLider && d3.medido.origen === "medido" && d3.diferencia.valor === 15 - medidoLider, jj(d3));
  R("H3 el texto los dice: «declarado por la empresa», «Medido por ADI», «No coinciden» y la diferencia en días", new RegExp(`Lider · Días vencido: 15 días, declarado por la empresa \\(confirmado el \\d{4}-\\d{2}-\\d{2}\\)\\. Medido por ADI: ${medidoLider} días\\. No coinciden: lo declarado queda por debajo de lo medido por ${medidoLider - 15} días`).test(h3.entrega.texto), h3.entrega.texto.slice(-500));
  R("H3 ★ NUNCA se sustituye: la tabla de cifras (lo medido) es idéntica a la de antes, la fila de Lider sigue «medido»", cmp(filasDe(h3), baseFilas) && filasDe(h3).some((f) => f.valores["Métrica"] === "Días vencido" && f.valores["Tipo"] === "medido" && f.valores["Valor"] === `${medidoLider}d`));
  const h3b = await L("alfa", "consultar", { encargo: encCob("Lider", convA, { usar: "declarado" }) });
  R("H4 `usar: \"declarado\"`: ADI no calcula sobre lo declarado ni lo pone en lugar de lo medido — lo dice, y las cifras siguen siendo las medidas", h3b.ok && cmp(filasDe(h3b), baseFilas) && /Se pidió usar lo declarado: ADI no calcula sobre lo declarado/.test(h3b.entrega.texto) && h3b.declarado.usar && h3b.declarado.usar.pedido === "declarado" && h3b.declarado.usar.aplicado === "medido", h3b.entrega.texto.slice(-300));
  const h4 = await aportar("alfa", convA, [{ clase: "hecho", concepto: "dias_vencido", entidad: "Lider", valor: { raw: medidoLider, unidad: "days" } }]);
  R("H5 declarar OTRO valor sobre uno ya confirmado no lo reemplaza: queda pendiente con el conflicto, y la Entrega sigue usando el confirmado", h4.ok && h4.resultados[0].estado === "pendiente" && h4.resultados[0].conflictoCon === idDias, jj(h4.resultados));
  const h5 = await L("alfa", "consultar", { encargo: encCob("Lider", convA) });
  R("H5 (cont.) la Entrega sigue con el confirmado (15), no con el pendiente", h5.ok && h5.declarado.hechos[0].valor === 15 && h5.declarado.hechos[0].estado === "difiere");
  await confirmar("alfa", convA, [h4.resultados[0].id]);
  const h6 = await L("alfa", "consultar", { encargo: encCob("Lider", convA) });
  R("H6 confirmado el nuevo valor (igual a lo medido): «coincide con lo medido», y el origen sigue «declarado»", h6.ok && h6.declarado.hechos[0].estado === "coincide" && h6.declarado.hechos[0].origen === "declarado" && /Coincide con lo medido por ADI/.test(h6.entrega.texto), h6.entrega.texto.slice(-300));
  // lo que no tiene lugar se queda en la memoria
  const h7 = await aportar("alfa", convA, [
    { clase: "hecho", concepto: "dias_vencido", entidad: "Falabella", valor: { raw: 7, unidad: "days" } },
    { clase: "hecho", concepto: "saldo_pendiente", entidad: "Lider", valor: { raw: 5, unidad: "money" } },
    { clase: "hecho", concepto: "plazo_de_cobro", entidad: "Lider", valor: { raw: 45, unidad: "days" } },
    { clase: "criterio", concepto: "benchmark propio", valor: { raw: 28, unidad: "pct" } },
  ]);
  R("S1 el dinero y un criterio con otro concepto: se aceptan (pendientes) pero dicen en el acto que NO tienen lugar en la Entrega; el plazo de cobro SÍ lo tiene (opción A, §7.3·58): lo dice al declararlo", h7.ok && h7.resultados.length === 4 && h7.resultados[1].lugar.enLaEntrega === false && h7.resultados[2].lugar.enLaEntrega === true && /pregunta abierta/.test(h7.resultados[2].lugar.como) && h7.resultados[3].lugar.enLaEntrega === false && h7.resultados[0].lugar.enLaEntrega === true, jj(h7.resultados.map((r) => r.lugar)));
  await confirmar("alfa", convA, h7.resultados.map((r) => r.id));
  const h8 = await L("alfa", "consultar", { encargo: encCob("Lider", convA) });
  const noMenciona = !/Falabella|benchmark propio|\$5\b/.test(h8.entrega.texto.split("**Lo declarado por la empresa y confirmado.**")[1] || "");
  R("S2 ★ confirmados, NO se fuerzan: la Entrega no menciona lo que no está en juego (el de otra entidad, el dinero, el criterio sin lugar) y sigue con el hecho de Lider; el plazo de cobro de Lider SÍ se cita, porque su pregunta abierta está en la Entrega (opción A, §7.3·58)", h8.ok && noMenciona && h8.declarado.hechos.length === 1 && h8.declarado.hechos[0].entidad === "Lider" && h8.declarado.plazos && h8.declarado.plazos.length === 1 && h8.declarado.plazos[0].entidad === "Lider" && h8.declarado.plazos[0].valor === 45 && /Plazo de cobro: 45 días, declarado por la empresa/.test(h8.entrega.texto), jj(h8.declarado));
  const cE = await L("alfa", "conocerEmpresa", { conversacionId: convA });
  R("S3 y siguen en la memoria de la empresa: conocerEmpresa los ve (nada se perdió por no tener lugar)", cE.ok && ["plazo_de_cobro", "saldo_pendiente", "benchmark propio"].every((c) => cE.hechosAportados.some((x) => x.concepto === c && x.origen === "declarado")), jj(cE.hechosAportados.map((x) => x.concepto)));
  sinResiduo("H");

  // ── LA CITA: contexto E1 · E1.h2 · E2.u1 ─────────────────────────────────────────────────────────────────────────────────────
  const t1 = await L("alfa", "consultar", { encargo: encCob("Lider") });
  const convC = t1.continuidad.conversacionId;
  const t2 = await L("alfa", "consultar", { encargo: encRota(convC) });
  const rt = await L("alfa", "retomar", { conversacionId: convC });
  const esperadosE1 = filasDe(t1).map((f, k) => ({ id: `E1.h${k + 1}`, sujeto: f.valores["Entidad / grupo"], metrica: f.valores["Métrica"], valor: f.valores["Valor"], origen: f.procedencia }));   // sin `ref`: es el id interno del hecho en la Entrega (e1…), que la respuesta compacta no manda
  const elegir = (hs) => hs.map((h) => ({ id: h.id, sujeto: h.sujeto, metrica: h.metrica, valor: h.valor, origen: h.origen }));
  const t3 = await L("alfa", "consultar", { encargo: encRota(convC, { contexto: { entregaRef: "E1" } }) });
  const aE1 = t3.antecedentes && t3.antecedentes[0];
  R("C1 `contexto: \"E1\"` trae E1: sus hechos con id, TAL CUAL se entregaron (los mismos que vio quien consultó entonces)", t3.ok && aE1 && aE1.tipo === "entrega" && aE1.id === "E1" && cmp(elegir(aE1.hechos), esperadosE1) && esperadosE1.length === 2, jj(aE1 && elegir(aE1.hechos)));
  R("C2 con la versión de la carga y la fecha en que se entregó (las mismas que guardó el libro)", aE1 && aE1.entrega.versionId === EMP.alfa.version && aE1.entrega.entregadaEn === rt.entregas[0].entregadaEn && rt.entregas[0].entregadaEn && aE1.entrega.n === 1, jj(aE1 && aE1.entrega));
  R("C3 y la Entrega nueva lo usa como ANTECEDENTE, a la vista y sin recalcarlo (lo dice)", t3.ok && /\*\*Antecedente: lo que la Entrega E1 ya entregó\*\*/.test(t3.entrega.texto) && /E1\.h1 · Lider · Días vencido/.test(t3.entrega.texto) && /ADI no las recalculó/.test(t3.entrega.texto) && !t3.noResuelto.some((n) => n.campo === "contexto"), t3.entrega.texto.slice(-500));
  const t4 = await L("alfa", "consultar", { encargo: encRota(convC, { contexto: { hechosRef: ["E1.h2"] } }) });
  R("C4 `E1.h2`: ese hecho, tal cual", t4.ok && t4.antecedentes[0].tipo === "hecho" && cmp(elegir([t4.antecedentes[0].hecho]), [esperadosE1[1]]), jj(t4.antecedentes));
  const t5 = await L("alfa", "consultar", { encargo: encRota(convC, { contexto: { universoRef: "E2.u1" } }) });
  R("C5 `E2.u1`: el universo de esa Entrega, tal cual", t5.ok && t5.antecedentes[0].tipo === "universo" && cmp(t5.antecedentes[0].universo.entidades.slice().sort(), universoDe(t2)), jj(t5.antecedentes));
  const t6 = await L("alfa", "consultar", { encargo: encRota(convC, { contexto: { entregaRef: "E9" } }) });
  const n6 = (t6.noResuelto || []).find((n) => n.campo === "contexto");
  R("C6 ★ `E9` (no existe) se declina con su motivo claro; el resto de la consulta se responde igual y no se inventa nada", t6.ok && n6 && n6.valor === "E9" && n6.motivo === "contexto_no_disponible" && /E1 a E\d.*E9 no existe/.test(n6.detalle) && t6.antecedentes === undefined && !/Antecedente/.test(t6.entrega.texto), jj(n6));
  const t7 = await L("alfa", "consultar", { encargo: encRota(convC, { contexto: { hechosRef: ["E1.h99"] } }) });
  const t8 = await L("alfa", "consultar", { encargo: encRota(convC, { contexto: { entregaRef: "Entrega1" } }) });
  const t9 = await L("alfa", "consultar", { encargo: encRota(null, { contexto: { entregaRef: "E1" } }) });
  R("C7 un hecho que esa Entrega no tiene, un id mal formado y una cita SIN conversación: cada uno con su motivo", /E1\.h99 no existe/.test(((t7.noResuelto || []).find((n) => n.campo === "contexto") || {}).detalle) && ((t8.noResuelto || []).find((n) => n.campo === "contexto") || {}).motivo === "contexto_mal_formado" && /falta el conversacionId/.test(((t9.noResuelto || []).find((n) => n.campo === "contexto") || {}).detalle), jj([t7.noResuelto, t8.noResuelto, t9.noResuelto]));
  const bx = await L("beta", "consultar", { encargo: encRota(convC, { contexto: { entregaRef: "E1" } }) });
  R("C8 ★ beta presenta el conversacionId de alfa y cita su E1: no la ve (cero cruce), y nada de lo de alfa aparece", bx.ok && bx.antecedentes === undefined && (bx.noResuelto || []).some((n) => n.campo === "contexto" && n.motivo === "contexto_no_disponible") && bx.continuidad.nueva === true && !/Lider · Días vencido/.test(bx.entrega.texto) && !/1\.5x/.test(bx.entrega.texto), jj(bx.noResuelto));
  const t0b = await L("alfa", "consultar", { encargo: encRota(convC) });
  R("C9 sin cita la Entrega no lleva antecedente ni bloque (cero texto de más)", t0b.ok && t0b.antecedentes === undefined && !/Antecedente/.test(t0b.entrega.texto));
  sinResiduo("C");

  // ── EL REINICIO (solo en la memoria durable): todo sigue ───────────────────────────────────────────────────────────────────────
  if (banco.reiniciar) {
    await banco.reiniciar();
    const r1 = await L("alfa", "consultar", { encargo: encRota(convA) });
    R("D1 tras REINICIAR: alfa sigue con su criterio confirmado (1.5x «declarado por la empresa»)", r1.ok && /piso de rotación: 1\.5x, declarado por la empresa/.test(clausulaDe(r1)), clausulaDe(r1));
    const r2 = await L("beta", "consultar", { encargo: encRota(convB) });
    R("D2 y beta con el suyo (0.9x), gamma con el de ADI", r2.ok && /piso de rotación: 0\.9x, declarado por la empresa/.test(clausulaDe(r2)) && /2\.0x, criterio general de ADI/.test(clausulaDe(await L("gamma", "consultar", { encargo: encRota() }))));
    const r3 = await L("alfa", "consultar", { encargo: encRota(convC, { contexto: { entregaRef: "E1" } }) });
    R("D3 y la cita sigue resolviendo contra lo guardado: los mismos hechos de E1", r3.ok && r3.antecedentes && cmp(elegir(r3.antecedentes[0].hechos), esperadosE1), jj(r3.antecedentes && elegir(r3.antecedentes[0].hechos)));
    const r4 = await L("alfa", "consultar", { encargo: encCob("Lider", convA) });
    R("D4 y el hecho declarado sigue al lado de lo medido", r4.ok && r4.declarado && r4.declarado.hechos[0].valor === medidoLider && r4.declarado.hechos[0].estado === "coincide", jj(r4.declarado));
  }
}

H("4 · aceptación · el guion fijo del owner, por la PUERTA (sin LLM, cero red): memoria durable (con reinicio) y memoria del proceso");
const bancos = [await bancoDurable(), await bancoProceso()];
for (const b of bancos) {
  const res = await guion(b);
  console.log(`   ${b.nombre}: ${res.filter((r) => r.ok).length}/${res.length} pasos del guion`);
  for (const r of res) ok(r.ok, `[${b.nombre.split(" · ")[0]}] ${r.id}`, r.det);
}

/* ═══ 5 · LAS CARNADAS DEL GUION: el código de antes y los defectos — el guion TIENE que ponerse rojo en cada una ═══════════════════════════ */
H("5 · carnadas del guion: el código de ANTES y seis defectos — el guion se pone rojo en cada una");
for (const k of Object.keys(CARNADAS)) {
  const banco = await bancoProceso({ carnada: k, nombre: `puerta con la carnada «${k}»` });
  const res = await guion(banco);
  const malos = res.filter((r) => !r.ok);
  ok(malos.length > 0, `★ CARNADA «${k}» (${CARNADAS[k].nota}) · el guion la MARCA`, malos.length ? "" : "el guion pasó entero: no la detecta");
  console.log(`   «${k}»: ${malos.length} paso(s) rojos${malos.length ? ` (p. ej. ${malos.slice(0, 3).map((r) => r.id.split(" ")[0]).join(", ")})` : ""}`);
}

/* ═══ 6 · CONVERSACIONES AL AZAR, SEMILLA FIJA, CONTRA UN MODELO INDEPENDIENTE ════════════════════════════════════════════════════════ */
H("6 · conversaciones al azar (semilla fija) contra un modelo independiente: un declarado nunca pisa un medido · un pendiente nunca entra · todo declarado lleva su origen · la cita trae lo entregado · cero cruce");
const EMP_AZAR = [
  { id: "e1", nombre: "Azar Uno", factor: 1, version: 11, rot: [1.5, 1.1], techo: [90, 100], dias: [11, 480] },
  { id: "e2", nombre: "Azar Dos", factor: 2, version: 12, rot: [0.9, 0.6], techo: [130, 140], dias: [12, 481] },
  { id: "e3", nombre: "Azar Tres", factor: 0.5, version: 13, rot: [2.5, 3.5], techo: [150, 160], dias: [13, 482] },
  { id: "e4", nombre: "Azar Cuatro", factor: 3, version: 14, rot: [4.5, 5.5], techo: [170, 180], dias: [14, 483] },
];
const ENTIDADES_AZAR = ["Lider", "Falabella", "Jumbo"];
const conLatencia = (store, rng, ms) => {
  const esp = () => new Promise((r) => setTimeout(r, rng() * ms));
  const out = {};
  for (const m of Object.keys(store)) out[m] = typeof store[m] === "function" && m !== "nuevoIdHecho" ? async (...a) => { await esp(); const v = await store[m](...a); await esp(); return v; } : store[m];
  return out;
};
/* el MEDIDO de cada (empresa, entidad): una consulta limpia, sin nada declarado, contra el mismo pack */
async function medidosLimpios() {
  const out = {};
  for (const E of EMP_AZAR) {
    const acc = crearAcciones({ continuidad: crearAlmacenEnMemoria(), ahora: relojDeGate });
    const tenant = { id: E.id, nombre: E.nombre, dataset: packSinUmbrales(E), version: E.version };
    out[E.id] = {};
    for (const ent of ENTIDADES_AZAR) {
      const r = await acc.consultar({ tenant, encargo: encCob(ent) });
      const f = filasDe(r).find((x) => x.valores["Métrica"] === "Días vencido");
      out[E.id][ent] = { dias: f ? Number(/(\d+)d/.exec(f.valores["Valor"])[1]) : null, filas: filasDe(r) };
    }
  }
  return out;
}
const PISO_DEFAULT = 2, TECHO_DEFAULT = 120;
/* el modelo de la memoria (independiente del código): una llave tiene a lo más UN vigente y varios pendientes, en orden de llegada. Declarar de nuevo el MISMO valor de «la fila con la que choca» devuelve esa fila (la
 * vigente si la hay; si no, la primera pendiente); cualquier otro valor es una fila pendiente NUEVA. Devuelve false si el código contestó con otra fila de la que el modelo manda. */
function aceptarDeclaracion(m, v, idDevuelto) {
  const choca = m.vig ? { id: m.vig.id, valor: m.vig.valor } : (m.pend.size ? (([id, valor]) => ({ id, valor }))([...m.pend.entries()][0]) : null);
  if (choca && choca.valor === v) return idDevuelto === choca.id;
  m.pend.set(idDevuelto, v);
  return true;
}
async function correrAzar({ semilla, nOps, carnada = null }) {
  const rng = crearAzar(semilla);
  conTenantActivo(TENANT_DEMO, () => 1);   // el estado del Core, limpio: lo que dejó una carnada anterior se barre con el `initTenant` de la salida
  const core0 = SNAPSHOT_CORE();
  const medidos = await medidosLimpios();
  const store = crearAlmacenEnMemoria();
  const violaciones = [];
  const V = (E, op, causa, det = "") => { if (violaciones.length < 40) violaciones.push({ E: E.id, op, causa, det: String(det).slice(0, 240) }); };
  let consultas = 0, conCita = 0, conDeclarado = 0;
  /* TODO el azar del plan se sortea de antemano (semilla fija): cada empresa tiene su cadena de operaciones (en orden) y las cadenas corren intercaladas */
  const planes = EMP_AZAR.map((E) => ({ E, ops: Array.from({ length: nOps }, () => rng.elegir(["crit", "crit", "crit", "critMal", "conf", "conf", "conf", "hecho", "hecho", "hecho", "sinLugar", "inv", "inv", "inv", "inv", "cob", "cob", "cob", "cob", "cita", "cita", "rota"])), sub: crearAzar(semilla + E.id.charCodeAt(1)) }));
  async function cadena({ E, ops, sub }) {
    const acc = accionesDe(conLatencia(store, sub, 2), carnada, { vistaBase: (s) => s });
    const accDeclarar = crearAcciones({ continuidad: conLatencia(store, sub, 2), ahora: relojDeGate });   // declarar/confirmar siempre con el código real: lo que se prueba es lo que la Entrega hace con lo guardado
    const tenant = { id: E.id, nombre: E.nombre, dataset: packSinUmbrales(E), version: E.version };
    const modelo = { crit: { piso_rotacion: { vig: null, pend: new Map() }, techo_cobertura: { vig: null, pend: new Map() } }, hec: Object.fromEntries(ENTIDADES_AZAR.map((e) => [e, { vig: null, pend: new Map() }])) };
    const convs = [0, 1, 2].map(() => ({ id: null, turnos: [] }));   // lo que cada Entrega entregó, tal cual (para verificar la cita)
    const valoresDe = { piso_rotacion: E.rot, techo_cobertura: E.techo };
    const pendientesDe = () => [...Object.values(modelo.crit).flatMap((k) => [...k.pend.entries()].map(([id]) => ({ id, tipo: "crit" }))), ...Object.values(modelo.hec).flatMap((h) => [...h.pend.entries()].map(([id]) => ({ id, tipo: "hec" })))];
    const declarar = async (cv, aportes) => { const r = await accDeclarar.aportarContexto({ tenant, conversacionId: cv.id, aportes }); if (r.conversacionId) cv.id = r.conversacionId; return r; };
    for (const op of ops) {
      const cv = sub.elegir(convs); const idRng = sub;   // el azar de la cadena sale SOLO de su propio generador: el orden de las otras cadenas no lo mueve
      if (op === "crit") {
        const key = idRng.elegir(["piso_rotacion", "techo_cobertura"]); const v = idRng.elegir(valoresDe[key]);
        const r = await declarar(cv, [{ clase: "criterio", concepto: key, valor: { raw: v, unidad: key === "piso_rotacion" ? "ratio" : "days" } }]);
        const x = r.resultados && r.resultados[0];
        if (!x || x.estado === "rechazado" || !x.lugar || !x.lugar.enLaEntrega) { V(E, op, "no aceptó un criterio válido", jj(r.resultados)); continue; }
        const m = modelo.crit[key];
        if (!aceptarDeclaracion(m, v, x.id)) V(E, op, "el mismo valor ya declarado debía devolver la misma fila");
      } else if (op === "critMal") {
        const r = await declarar(cv, [idRng.elegir([{ clase: "criterio", concepto: "piso_rotacion", valor: 99 }, { clase: "criterio", concepto: "techo_cobertura", valor: 5 }, { clase: "criterio", concepto: "piso_rotacion", valor: "x" }])]);
        if (!(r.resultados && r.resultados[0] && r.resultados[0].estado === "rechazado")) V(E, op, "aceptó un criterio inválido", jj(r.resultados));
      } else if (op === "hecho") {
        const ent = idRng.elegir(ENTIDADES_AZAR); const v = idRng.elegir(E.dias);
        const r = await declarar(cv, [{ clase: "hecho", concepto: "dias_vencido", entidad: ent, valor: { raw: v, unidad: "days" } }]);
        const x = r.resultados && r.resultados[0];
        if (!x || x.estado === "rechazado") { V(E, op, "no aceptó un hecho válido", jj(r.resultados)); continue; }
        const m = modelo.hec[ent];
        if (!aceptarDeclaracion(m, v, x.id)) V(E, op, "el mismo hecho ya declarado debía devolver la misma fila");
      } else if (op === "sinLugar") {
        const r = await declarar(cv, [idRng.elegir([{ clase: "hecho", concepto: "saldo_pendiente", entidad: "Lider", valor: { raw: 7, unidad: "money" } }, { clase: "hecho", concepto: "concepto_que_la_casa_no_conoce", entidad: "Jumbo", valor: { raw: 45, unidad: "days" } }, { clase: "criterio", concepto: "benchmark propio", valor: { raw: 28, unidad: "pct" } }])]);
        const x = r.resultados && r.resultados[0];
        if (x && x.id) { if (!x.lugar || x.lugar.enLaEntrega !== false) V(E, op, "lo que no tiene lugar debía decirlo"); const rc = await accDeclarar.aportarContexto({ tenant, conversacionId: cv.id, confirmar: [x.id] }); if (!(rc.confirmaciones && rc.confirmaciones[0].confirmado)) V(E, op, "no pudo confirmar lo sin lugar"); }
      } else if (op === "conf") {
        const ps = pendientesDe(); if (!ps.length) continue;
        const p = idRng.elegir(ps);
        const rc = await accDeclarar.aportarContexto({ tenant, conversacionId: cv.id, confirmar: [p.id] });
        if (!(rc.confirmaciones && rc.confirmaciones[0].confirmado)) { V(E, op, "no confirmó", jj(rc)); continue; }
        if (p.tipo === "crit") { for (const [k, m] of Object.entries(modelo.crit)) if (m.pend.has(p.id)) { m.vig = { id: p.id, valor: m.pend.get(p.id) }; m.pend.clear(); } }
        else for (const [, m] of Object.entries(modelo.hec)) if (m.pend.has(p.id)) { m.vig = { id: p.id, valor: m.pend.get(p.id) }; m.pend.clear(); }
      } else if (op === "inv" || op === "rota") {
        consultas++;
        const r = await acc.consultar({ tenant, encargo: op === "inv" ? encInv(cv.id) : encRota(cv.id) });
        if (r.continuidad && r.continuidad.conversacionId) cv.id = r.continuidad.conversacionId;
        if (SNAPSHOT_CORE() !== core0) V(E, op, "queda un criterio aplicado fuera del tramo del Core (residuo para la próxima empresa)", SNAPSHOT_CORE() + " vs " + core0);
        if (!r.ok) { V(E, op, "la consulta no salió", jj(r.noResuelto)); continue; }
        const piso = modelo.crit.piso_rotacion.vig ? modelo.crit.piso_rotacion.vig.valor : PISO_DEFAULT;
        const techo = modelo.crit.techo_cobertura.vig ? modelo.crit.techo_cobertura.vig.valor : TECHO_DEFAULT;
        const cl = clausulaDe(r);
        const origenP = modelo.crit.piso_rotacion.vig ? "declarado por la empresa" : "criterio general de ADI, ajustable por la empresa";
        const origenT = modelo.crit.techo_cobertura.vig ? "declarado por la empresa" : "criterio general de ADI, ajustable por la empresa";
        const fmtP = Number.isInteger(piso) ? `${piso}.0` : String(piso);
        if (!cl.includes(`piso de rotación: ${fmtP}x, ${origenP}`)) V(E, op, "el piso de rotación no es el esperado (valor u origen)", `esperaba ${fmtP}x ${origenP} | ${cl}`);
        if (op === "inv" && !cl.includes(`techo de días de inventario: ${techo} días, ${origenT}`)) V(E, op, "el techo de cobertura no es el esperado (valor u origen)", `esperaba ${techo} días ${origenT} | ${cl}`);
        if (op === "rota" && !cmp(universoOrdenado(r), rotaMenorQue(E, piso))) V(E, op, "los SKU que rotan lento no salen con el piso esperado", jj([universoDe(r), rotaMenorQue(E, piso)]));
        // todo declarado usado lleva su origen: la lista estructurada son EXACTAMENTE los criterios vigentes, cada uno con su origen y su sello
        const vigs = Object.entries(modelo.crit).filter(([, m]) => m.vig).map(([k, m]) => ({ k, v: m.vig.valor }));
        const lista = (r.declarado && r.declarado.criterios) || [];
        if (lista.length !== vigs.length || !vigs.every((x) => lista.some((c) => c.concepto === x.k && c.valor === x.v && c.origen === "declarado" && c.etiquetaDeOrigen === "declarado por la empresa" && c.sello && c.sello.medio))) V(E, op, "lo declarado aplicado no es exactamente lo vigente, con su origen", jj(lista.map((c) => [c.concepto, c.valor, c.origen])));
        if (vigs.length) conDeclarado++;
        if (!vigs.length && r.declarado !== undefined) V(E, op, "hay bloque «declarado» sin nada vigente (¿entró un pendiente?)", jj(r.declarado));
        for (const k of [].concat(valoresDe.piso_rotacion, valoresDe.techo_cobertura)) { /* cruce: el valor de OTRA empresa jamás aparece como el de esta */ }
        for (const O of EMP_AZAR) if (O.id !== E.id) for (const v of [...O.rot, ...O.techo]) { const t = `${Number.isInteger(v) && v < 20 ? v + ".0" : v}x, declarado`; const t2 = `${v} días, declarado`; if (cl.includes(t) || cl.includes(t2)) V(E, op, `aparece lo declarado por otra empresa (${O.id}: ${v})`, cl); }
        convs.find((c) => c.id === cv.id).turnos.push({ filas: filasDe(r), universos: (r.entrega.json.universos || []).map((u) => u.entidades) });
      } else if (op === "cob") {
        consultas++;
        const ent = idRng.elegir(ENTIDADES_AZAR);
        const r = await acc.consultar({ tenant, encargo: encCob(ent, cv.id) });
        if (r.continuidad && r.continuidad.conversacionId) cv.id = r.continuidad.conversacionId;
        if (SNAPSHOT_CORE() !== core0) V(E, op, "queda un criterio aplicado fuera del tramo del Core (residuo para la próxima empresa)", SNAPSHOT_CORE() + " vs " + core0);
        if (!r.ok) { V(E, op, "la consulta no salió", jj(r.noResuelto)); continue; }
        const med = medidos[E.id][ent];
        // un declarado NUNCA pisa un medido: la tabla de lo medido es idéntica a la limpia
        if (!cmp(filasDe(r), med.filas)) V(E, op, "la tabla de cifras (lo medido) cambió: un declarado pisó a un medido", jj(filasDe(r)).slice(0, 160));
        const vig = modelo.hec[ent].vig;
        const hs = (r.declarado && r.declarado.hechos) || [];
        const textoDecl = (r.entrega.texto.split("**Lo declarado por la empresa y confirmado.**")[1] || "");
        if (!vig) {
          if (hs.length || textoDecl) V(E, op, "aparece un hecho declarado sin ninguno vigente para esa entidad (¿entró un pendiente?)", jj(hs));
        } else {
          conDeclarado++;
          const d = hs[0];
          const estado = vig.valor === med.dias ? "coincide" : "difiere";
          if (hs.length !== 1 || !d || d.valor !== vig.valor || d.estado !== estado || d.origen !== "declarado" || d.etiquetaDeOrigen !== "declarado por la empresa" || !d.sello || !d.medido || d.medido.valor !== med.dias || d.medido.origen !== "medido") V(E, op, "el hecho declarado no es el vigente, o no lleva su origen, o no trae el medido de al lado", jj(d));
          if (!textoDecl.includes(`${ent} · Días vencido: ${vig.valor} días, declarado por la empresa`) || !textoDecl.includes(`Medido por ADI: ${med.dias} días`)) V(E, op, "el texto no dice los dos orígenes", textoDecl.slice(0, 200));
          if (estado === "difiere" && !textoDecl.includes(`${Math.abs(vig.valor - med.dias)} días`)) V(E, op, "no declara la diferencia", textoDecl.slice(0, 200));
        }
        // cero cruce: el valor declarado de otra empresa no aparece
        for (const O of EMP_AZAR) if (O.id !== E.id) for (const v of O.dias) if (textoDecl.includes(`${ent} · Días vencido: ${v} días`)) V(E, op, `aparece lo declarado por otra empresa (${O.id}: ${v})`);
        convs.find((c) => c.id === cv.id).turnos.push({ filas: filasDe(r), universos: (r.entrega.json.universos || []).map((u) => u.entidades) });
      } else if (op === "cita") {
        const candidatas = convs.filter((c) => c.id && c.turnos.length);
        if (!candidatas.length) continue;
        const conv = sub.elegir(candidatas);
        consultas++; conCita++;
        const minN = Math.max(1, conv.turnos.length - 11);   // el libro conserva las últimas 12 Entregas: las más viejas ya no se citan
        const n = minN + idRng.entero(conv.turnos.length - minN + 1);
        const tipo = idRng.elegir(["entrega", "hecho", "universo"]);
        const T = conv.turnos[n - 1];
        const esperaH = T.filas.map((f, k) => ({ id: `E${n}.h${k + 1}`, sujeto: f.valores["Entidad / grupo"], metrica: f.valores["Métrica"], valor: f.valores["Valor"], origen: f.procedencia }));   // sin `ref`: es el id interno del hecho en la Entrega (e1…), que la respuesta compacta no manda
        let contexto, esperado = null;
        if (tipo === "entrega") { contexto = { entregaRef: `E${n}` }; esperado = { tipo: "entrega" }; }
        else if (tipo === "hecho" && esperaH.length) { const k = 1 + idRng.entero(esperaH.length); contexto = { hechosRef: [`E${n}.h${k}`] }; esperado = { tipo: "hecho", h: esperaH[k - 1] }; }
        else if (tipo === "universo" && T.universos.length) { contexto = { universoRef: `E${n}.u1` }; esperado = { tipo: "universo", u: T.universos[0] }; }
        else { contexto = { entregaRef: `E${n + 50}` }; esperado = { tipo: "inexistente" }; }
        const r = await acc.consultar({ tenant, encargo: encRota(conv.id, { contexto }) });
        if (r.continuidad && r.continuidad.conversacionId) conv.id = r.continuidad.conversacionId;
        if (!r.ok) { V(E, op, "la consulta con cita no salió", jj(r.noResuelto)); continue; }
        const a = r.antecedentes && r.antecedentes[0];
        const el = (xs) => xs.map((h) => ({ id: h.id, sujeto: h.sujeto, metrica: h.metrica, valor: h.valor, origen: h.origen }));
        if (esperado.tipo === "inexistente") { if (a || !(r.noResuelto || []).some((x) => x.campo === "contexto" && x.motivo === "contexto_no_disponible")) V(E, op, "una cita inexistente debía declinarse con su motivo y no traer nada", jj(r.noResuelto)); }
        else if (esperado.tipo === "entrega") { if (!a || a.tipo !== "entrega" || a.entrega.n !== n || !cmp(el(a.hechos), esperaH) || a.entrega.versionId !== E.version) V(E, op, "la cita no trae exactamente lo entregado", jj(a && el(a.hechos))); }
        else if (esperado.tipo === "hecho") { if (!a || a.tipo !== "hecho" || !cmp(el([a.hecho]), [esperado.h])) V(E, op, "el hecho citado no es el entregado", jj(a && a.hecho)); }
        else if (!a || a.tipo !== "universo" || !cmp(a.universo.entidades, esperado.u)) V(E, op, "el universo citado no es el entregado", jj(a && a.universo && a.universo.entidades));
        if (a && a.entrega && !r.entrega.texto.includes(`E${n} ya entregó`)) V(E, op, "la cita no figura a la vista en la Entrega");
        convs.find((c) => c.id === conv.id).turnos.push({ filas: filasDe(r), universos: (r.entrega.json.universos || []).map((u) => u.entidades) });
      }
    }
    // al final: lo guardado es lo del modelo (la memoria de la empresa sin cruce): sus vigentes y pendientes
    const filas = await store.leerHechosEmpresa(E.id);
    const vigC = filas.filter((f) => f.estado === "vigente" && f.clase === "criterio" && (f.concepto === "piso_rotacion" || f.concepto === "techo_cobertura"));
    for (const [k, m] of Object.entries(modelo.crit)) { const f = vigC.filter((x) => x.concepto === k); if ((m.vig ? 1 : 0) !== f.length || (m.vig && f[0].valor.raw !== m.vig.valor)) V(E, "fin", `lo guardado de ${k} no es el del modelo`, jj(f.map((x) => x.valor))); }
    for (const O of EMP_AZAR) if (O.id !== E.id) { const ajeno = filas.some((f) => (f.concepto === "dias_vencido" && O.dias.includes(f.valor && f.valor.raw) && f.entidad)); if (ajeno) V(E, "fin", `la memoria de ${E.id} trae un dato de ${O.id}`); }
  }
  await Promise.all(planes.map((p) => cadena(p).catch((e) => V(p.E, "EXCEPCIÓN", String(e && e.message).slice(0, 120), String(e && e.stack).split("\n").slice(0, 3).join(" | ")))));
  return { violaciones, consultas, conCita, conDeclarado };
}

{
  const t0 = Date.now();
  const base = await correrAzar({ semilla: SEMILLA, nOps: 60 });
  console.log(`   azar · 4 empresas × 60 operaciones intercaladas: ${base.consultas} consultas (${base.conCita} con cita, ${base.conDeclarado} con lo declarado en juego) en ${((Date.now() - t0) / 1000).toFixed(1)}s`);
  ok(base.consultas > 100 && base.conCita > 10 && base.conDeclarado > 30, "el azar ejercita de verdad lo declarado y la cita (no corre en vacío)", jj(base));
  ok(base.violaciones.length === 0, "★ AZAR · un declarado nunca pisa un medido, un pendiente nunca entra, todo declarado usado lleva su origen, la cita trae exactamente lo entregado y no hay cruce entre empresas", jj(base.violaciones.slice(0, 5)));
  const otra = await correrAzar({ semilla: SEMILLA + 77, nOps: 40 });
  ok(otra.violaciones.length === 0 && otra.consultas > 30 && otra.conDeclarado > 5, "★ AZAR · con otra semilla, lo mismo", jj({ v: otra.violaciones.slice(0, 5), consultas: otra.consultas, conDeclarado: otra.conDeclarado }));
  for (const k of Object.keys(CARNADAS)) {
    const c = await correrAzar({ semilla: SEMILLA, nOps: 40, carnada: k });
    ok(c.violaciones.length > 0, `★ CARNADA AZAR «${k}» (${CARNADAS[k].nota}) · el control al azar la MARCA`, c.violaciones.length ? "" : "el control al azar pasó entero: no la detecta");
    console.log(`   «${k}»: ${c.violaciones.length} violación(es)${c.violaciones[0] ? ` — ${c.violaciones[0].causa}` : ""}`);
  }
}

/* ═══ 7 · SIN NADA DECLARADO NI CITA, LA ENTREGA ES LA DE SIEMPRE · el Core sin residuo · las auditorías de código ═══════════════════════ */
H("7 · sin nada declarado ni cita la Entrega sale BYTE-IDÉNTICA; la carga que cambió se declara y lo citado no se recalcula; el aislamiento; las auditorías");
{
  const catalogo = JSON.parse(leer("./fixtures/consolidacion/catalogos-v13-v28.json"));
  const casos = (catalogo.casos || catalogo).filter((c) => c && c.encargo);
  const muestra = casos.filter((_, i) => i % Math.max(1, Math.floor(casos.length / 45)) === 0).slice(0, 45);
  const acc = crearAcciones({ continuidad: crearAlmacenEnMemoria(), ahora: relojDeGate });
  const tenant = { id: "demo", nombre: "ADI Demo", dataset: TENANT_DEMO, version: 1 };
  /* la capa de las acciones antepone UNA línea de la casa solo ante un evento de continuidad (p. ej. una premisa que no coincide con lo entregado): es de antes de este bloque. Lo que se compara es la Entrega:
   * el texto del Core, entero y sin nada agregado después, y su JSON. */
  const igualAlCore = (via, core) => via === core || via.endsWith(`\n\n${core}`);
  let iguales = 0, distintos = [], conExtra = [];
  for (const c of muestra) {
    const directo = conTenantActivo(TENANT_DEMO, () => { const R = validarEncargo(c.encargo, {}); const s = componerEntrega(R); return { ok: s.ok, texto: s.ok ? s.texto : "", json: s.ok ? jj(s.entrega) : "" }; });
    const viaAccion = await acc.consultar({ tenant, encargo: c.encargo });
    if (viaAccion.declarado !== undefined || viaAccion.antecedentes !== undefined) conExtra.push(c.id);
    const mismo = Boolean(viaAccion.ok) === Boolean(directo.ok) && (!directo.ok || (igualAlCore(viaAccion.entrega.texto, directo.texto) && jj(viaAccion.entrega.json) === directo.json));
    if (mismo) iguales++; else distintos.push(c.id);
  }
  ok(muestra.length >= 40 && distintos.length === 0 && conExtra.length === 0, `★ SIN nada declarado ni cita, la Entrega de ${muestra.length} encargos de los catálogos de la etapa 1 es BYTE-IDÉNTICA a la que compone el Core directo (texto y JSON), sin bloque ni antecedente`, jj({ distintos, conExtra }));
  // CARNADA · una acción que agrega el bloque aunque no haya nada declarado
  const accDefectuosa = { consultar: async (a) => { const r = await acc.consultar(a); return r.ok ? { ...r, entrega: { ...r.entrega, texto: r.entrega.texto + "\n\n**Lo declarado por la empresa y confirmado.**\n- nada" } } : r; } };
  const rd = await accDefectuosa.consultar({ tenant, encargo: muestra[0].encargo });
  const dd = conTenantActivo(TENANT_DEMO, () => componerEntrega(validarEncargo(muestra[0].encargo, {})));
  ok(rd.ok && !igualAlCore(rd.entrega.texto, dd.texto), "★ CARNADA · una acción que agrega texto aunque no haya nada declarado no sale idéntica: el control la marca");
  // `usar` sin nada declarado tampoco cambia la Entrega
  const encU = { ...muestra[0].encargo, usar: "declarado" };
  const ru = await acc.consultar({ tenant, encargo: encU });
  const du = conTenantActivo(TENANT_DEMO, () => componerEntrega(validarEncargo(encU, {})));
  ok(ru.ok === du.ok && (!du.ok || (igualAlCore(ru.entrega.texto, du.texto) && ru.declarado === undefined)), "`usar: \"declarado\"` sin nada declarado no cambia la Entrega");

  // la carga que cambió: lo citado NO se recalcula (se muestra lo entregado entonces), y se declara que la carga es otra
  const store2 = crearAlmacenEnMemoria();
  const acc2 = crearAcciones({ continuidad: store2, ahora: relojDeGate });
  const T1 = { id: "alfa", nombre: "Comercial Alfa", dataset: packSinUmbrales(EMP.alfa), version: "carga-1" };
  const T2 = { id: "alfa", nombre: "Comercial Alfa", dataset: packSinUmbrales({ ...EMP.alfa, factor: 4 }), version: "carga-2" };
  const encV = (conv = null, extra = {}) => ({ version: "encargo/v1", ...(conv ? { conversacionId: conv } : {}), ...extra, partes: [{ id: "p1", tema: "comercial", cierre: "cifra", conceptos: ["ventas"], entidades: [{ nombre: "Jumbo" }] }] });
  const v1 = await acc2.consultar({ tenant: T1, encargo: encV() });
  const conv = v1.continuidad.conversacionId;
  const v2 = await acc2.consultar({ tenant: T2, encargo: encV(conv, { contexto: { entregaRef: "E1" } }) });
  const ventas1 = filasDe(v1)[0].valores["Valor"], ventas2 = filasDe(v2)[0].valores["Valor"];
  ok(ventas1 !== ventas2 && v2.antecedentes[0].hechos[0].valor === ventas1 && v2.antecedentes[0].entrega.versionId === "carga-1" && v2.antecedentes[0].cargaCambio === true && v2.antecedentes[0].cargaActual === "carga-2", "★ la carga cambió: lo citado trae lo que se entregó con la carga ANTERIOR (no se recalculó) y se declara que la activa es otra", jj([ventas1, ventas2, v2.antecedentes[0].hechos[0].valor]));
  ok(/La carga activa ahora es carga-2: esas cifras no se volvieron a verificar contra ella/.test(v2.entrega.texto) && v2.entrega.texto.includes(ventas2), "y la Entrega nueva dice la cifra de AHORA por su lado y avisa que la citada no se re-verificó (eso es del bloque 4)");

  // el aislamiento del Core: aplicar un criterio dentro del tramo no deja nada aplicado fuera, ni siquiera si el tramo falla
  const antes = SNAPSHOT_CORE();
  const packA = packSinUmbrales(EMP.alfa);
  const perfilAntes = jj(packA.perfil);
  const sin = conCriteriosDeEmpresa(packA, {});
  const con = conCriteriosDeEmpresa(packA, { rotacionMin: 1.5, benchmark: 28, noEsLlave: 3, dohMax: "x", targetCarga: NaN });
  ok(sin.dataset === packA && sin.aplicados.length === 0 && conCriteriosDeEmpresa(packA, null).dataset === packA, "sin criterios que agregar es EL MISMO dataset (cero diferencia con lo de antes)");
  ok(con.dataset !== packA && con.dataset.perfil.rotacionMin === 1.5 && con.dataset.perfil.benchmark === 28 && con.aplicados.length === 2 && jj(packA.perfil) === perfilAntes && packA.perfil.rotacionMin === undefined, "con criterios: una COPIA con esos valores en el perfil (nunca muta el original); una llave ajena, un valor que no es número o NaN se ignoran");
  ok(con.aplicados[0].llave === "rotacionMin" && con.aplicados[0].desplaza.valor === 2 && con.aplicados[0].desplaza.origen === "adi" && conCriteriosDeEmpresa(TENANT_DEMO, { rotacionMin: 1.5 }).aplicados[0].desplaza.origen === "empresa", "y dice lo que desplazó, con su origen: el criterio de ADI en una empresa que no declaró su piso, lo declarado por la empresa en el demo (cuyo perfil lo trae)");
  const dentro = conTenantActivo(con.dataset, () => ({ u: umbral("rotacionMin"), b: umbral("benchmark"), p: POLICY.rotacionMin }));
  ok(dentro.u.valor === 1.5 && dentro.u.origen === "empresa" && dentro.b.valor === 28 && dentro.b.origen === "empresa" && dentro.p === 1.5, "★ dentro del tramo `umbral()` dice el valor y el origen «empresa» (= «declarado por la empresa») por la regla de siempre, y POLICY lo ve igual: UN solo valor para todo el Core");
  ok(SNAPSHOT_CORE() === antes, "★ lo aplicado se limpia al salir del tramo (el criterio de una empresa no queda para la siguiente)");
  try { conTenantActivo(con.dataset, () => { setBenchmarkOverride(28); throw new Error("falla del tramo"); }); } catch (_e) { /* a propósito */ }
  ok(SNAPSHOT_CORE() === antes, "y aunque el tramo falle (ni siquiera la vara del benchmark queda aplicada)");
  umbralDePerfil({ rotacionMin: 1.5 }, "rotacionMin");
  ok(jj(umbralDePerfil({ rotacionMin: 1.5 }, "rotacionMin")) === jj({ valor: 1.5, origen: "empresa" }) && jj(umbralDePerfil({}, "rotacionMin")) === jj({ valor: 2, origen: "adi" }) && jj(umbralDePerfil(null, "frenadoDiasSinVenta")) === jj({ valor: null, origen: "sin_declarar" }) && jj(conTenantActivo(packA, () => umbral("rotacionMin"))) === jj(umbralDePerfil(packA.perfil, "rotacionMin")), "`umbralDePerfil` es la regla del perfil de `umbral()` (la llama él): empresa → criterio de ADI → sin declarar");
  // CARNADA · el criterio aplicado FUERA del tramo (el mecanismo viejo) deja residuo
  conTenantActivo(packA, () => 1);
  POLICY.rotacionMin = 1.5; setBenchmarkOverride(28);
  const sucio = SNAPSHOT_CORE() !== antes;
  conTenantActivo(packA, () => 1);   // el siguiente `initTenant` lo limpia
  ok(sucio && SNAPSHOT_CORE() === antes, "★ CARNADA · fijar un criterio FUERA del tramo deja residuo (el control lo ve) y solo el siguiente `initTenant` lo limpia");

  // ── auditorías de código ────────────────────────────────────────────────────────────────────────────────────────────────────────
  const srcLD = sinComentarios(leer("./src/adi/capacidad/loDeclarado.js")).replace(/`(?:\\[\s\S]|[^`\\])*`|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'/g, '""');
  const reconocedores = (s) => [...s.matchAll(/(^|[=(,:?!&|;{\s])\/(?![/*])(?:\\.|\[[^\]]*\]|[^/\\\n])+\/[gimsuy]*/gm)].map((m) => m[0].trim()).concat(/new RegExp|\.match\(|\.matchAll\(|\.search\(|preguntaOriginal|\.cita\b/.test(s) ? ["RegExp/match/preguntaOriginal"] : []);
  ok(reconocedores(srcLD).length === 0, "★ lo declarado no lleva ni una regex, ni `match`, ni `preguntaOriginal`: ADI no reconoce frases — decide con tablas cerradas", jj(reconocedores(srcLD)));
  ok(reconocedores(srcLD + "\nconst x = /plazo de cobro/i.test(v.texto);").length > 0, "★ CARNADA · un reconocedor de frases escrito en ese archivo lo marca el control");
  const srcAcc = sinComentarios(leer("./src/adi/capacidad/acciones.js"));
  const leeLaPregunta = (s) => /preguntaOriginal|\.cita\b/.test(s);
  ok(!leeLaPregunta(srcAcc) && !leeLaPregunta(sinComentarios(leer("./src/adi/continuidad/libro.js"))), "ni `acciones.js` ni el libro leen la pregunta original ni la cita de un supuesto");
  ok(leeLaPregunta(srcAcc + "\nconst q = encargo.preguntaOriginal;"), "★ CARNADA · una acción que lee la pregunta original la marca el control");
  const imports = (p) => (leer(p).match(/^\s*import\s[^;]*from\s*["'][^"']+["'];?/gm) || []).join("\n");
  ok(!/node:/.test(imports("./src/adi/capacidad/loDeclarado.js") + imports("./src/adi/continuidad/libro.js") + imports("./src/adi/encargo/validar.js") + imports("./src/adi/capacidad/acciones.js")), "la cadena de la puerta sigue sin `node:*` (corre en el borde, como el resto del gateway)");
  /* los criterios entran al PERFIL de la empresa ANTES del tramo (el Core los resuelve en `initTenant`: un solo valor para todo) y el tramo recibe ESE dataset; la vara del benchmark se fija
   * dentro del tramo; y el tramo no espera nada */
  const tramoDe = (s) => { const i = s.indexOf("conTenantActivo(dataset,"); if (i < 0) return null; let j = i + "conTenantActivo(".length, nivel = 1; while (j < s.length && nivel > 0) { const c = s[j++]; if (c === "(") nivel++; else if (c === ")") nivel--; } return { i, tramo: s.slice(i, j) }; };
  const criteriosBienEntrados = (s) => { const t = tramoDe(s); const k = s.indexOf("= conCriteriosDeEmpresa("); return !!t && k > -1 && k < t.i && /setBenchmarkOverride\(/.test(t.tramo) && !/\bawait\b/.test(t.tramo); };
  ok(criteriosBienEntrados(srcAcc), "★ los criterios entran al perfil ANTES del tramo del Core, el tramo recibe ESE dataset, fija la vara del benchmark y sigue sin ningún `await`");
  ok(!criteriosBienEntrados(srcAcc.replace("conTenantActivo(dataset,", "conTenantActivo(datasetConPerfil,")) && !criteriosBienEntrados(srcAcc.replace("setBenchmarkOverride(benchmarkDeclarado.valor);", "await 0; setBenchmarkOverride(benchmarkDeclarado.valor);")) && !criteriosBienEntrados(srcAcc.split("= conCriteriosDeEmpresa(").join("= otraCosa(")), "★ CARNADA · un tramo que no recibe el dataset con los criterios, que espera algo adentro, o criterios que ya no pasan por `conCriteriosDeEmpresa`, lo marca la auditoría");
}

console.log(`\n── _usar_lo_declarado_gate: PASS ${pass} · FAIL ${fail} (de ${pass + fail}) ──`);
if (fail) { console.log("FALLAS:\n" + fails.map((f) => " ✗ " + f).join("\n")); process.exit(1); }
