/* === _perfil_conversando_gate.mjs · EL PERFIL SE COMPLETA CONVERSANDO (Etapa 2, bloque 2 · owner 2026-09-25, offline) ===
 * LEY DEL OWNER (2026-09-25, aprobada; no se reabre): el perfil de la EMPRESA se completa conversando con el LLM anfitrión —misma
 * taxonomía y significados ya aprobados—; ADI pregunta solo lo necesario, de forma natural, lo recuerda en la empresa y no
 * vuelve a preguntar sin motivo; sin perfil el Core funciona igual; falla cerrado: nunca inventa un sector. Y la de siempre:
 * «la comprensión del lenguaje es del LLM». ADI no reconoce frases: dice QUÉ falta (estructurado), ofrece la pregunta con las
 * opciones válidas de la taxonomía, valida el valor TIPADO que el anfitrión devuelve y lo guarda con origen «declarado».
 * La confirmación es un sello aparte y no cambia el origen.
 *
 * LO QUE ESTE CANDADO PRUEBA (cada control tiene su CARNADA: una versión del código de ANTES, o con el defecto, que el
 * control TIENE que marcar — un control que no muerde a su carnada no mide nada):
 *   §1  los rótulos y las opciones SALEN de la taxonomía (ninguna opción escrita aparte; ningún código sin rótulo);
 *       tercera persona y registro de la casa en lo que ve la persona.
 *   §2  `necesitaPerfil`: qué campos hacen falta para lo que se pidió, y solo esos (una pieza FIRMADA y pertinente decide con
 *       su alcance; lo ya declarado la descarta; lo omitido la deja sin aplicar y se declara). Si no falta nada, no pide nada.
 *   §3  LA PRUEBA DE ACEPTACIÓN, POR LA PUERTA (sin LLM, cero red): el guion fijo del owner —empresa sin perfil que pide algo
 *       que necesita el sector → UNA pregunta con sus opciones → el anfitrión devuelve un valor tipado → se guarda
 *       «declarado» → la Entrega lo usa; repetir la consulta no vuelve a preguntar; omitir se respeta y declara la
 *       limitación; un valor inválido se rechaza con las opciones y no se guarda nada; reinicio (la base del bloque 1): el
 *       perfil sigue; sin perfil, lo que no lo necesita funciona igual y no pregunta; tres empresas intercaladas sin cruce.
 *       Corre contra el código real sobre la memoria durable (doble de Supabase) y sobre la memoria del proceso.
 *   §4  LAS CARNADAS del guion: el código de antes (el perfil se rechazaba) y nueve defectos (repite la pregunta, pregunta lo
 *       que no hace falta, inventa un valor, origen equivocado, guarda el perfil como «hecho», mezcla empresas, la Entrega no lee el perfil, no declara la limitación, ignora la omisión): el guion TIENE que ponerse rojo en cada una.
 *   §5  CONVERSACIONES AL AZAR (semilla fija) contra un modelo independiente: nunca pregunta dos veces lo ya respondido u
 *       omitido, siempre pregunta lo que hace falta, nunca un valor fuera de la taxonomía, el origen siempre «declarado»,
 *       cero cruce entre empresas. Las mismas cuatro carnadas.
 *   §6  la descripción de la herramienta dice lo que el sistema hace; la cadena de la puerta sigue sin `node:*`.
 *
 * CERO llamadas a un LLM · CERO red. Solo por `npm run gates:offline` o
 * `node --import ./scripts/offline-guard.mjs _perfil_conversando_gate.mjs`. */
import fs from "node:fs";
import { crearAcciones } from "./src/adi/capacidad/acciones.js";
import { crearAlmacenEnMemoria } from "./src/adi/continuidad/almacen.js";
import * as EMP from "./src/adi/continuidad/empresa.js";
import * as PC from "./src/adi/capacidad/perfilConversando.js";
import { MCP_TOOLS, construirOpenApi } from "./src/adi/capacidad/puerta.js";
import { TAXONOMIA_PERFIL, SECTORES_CON_TIPO_PRODUCTO } from "./src/config/contract/taxonomiaPerfil.js";
import { PIEZAS_CONOCIMIENTO } from "./src/adi/conocimiento/piezas.js";
import { PREDICADOS_CERRADOS } from "./src/adi/conocimiento/predicados.js";
import { crearAzar } from "./scripts/doble-supabase-continuidad.mjs";
import { crearLlamadorPuerta } from "./scripts/guion-continuidad.mjs";
import { armarEntornoDoble, packDeEmpresa, importarPuertaFresca } from "./scripts/guion-continuidad-doble.mjs";

let pass = 0, fail = 0;
const fails = [];
const ok = (c, m, extra = "") => { if (c) { pass++; } else { fail++; fails.push(m + (extra ? " — " + extra : "")); console.log("  ✗ " + m + (extra ? "\n      " + extra : "")); } };
const H = (t) => console.log(`\n${t}`);
const SEMILLA = 20261003;
/* ═══ EL CATÁLOGO DE ESTE CANDADO (Etapa 2, bloque 6 · owner 2026-10-04) ═══════════════════════════════════════════════════════════════
 * Este candado prueba la MECÁNICA de la conversación (preguntar una vez, recordar, omitir, confirmar, no cruzar empresas) sobre un catálogo en el que las piezas firmadas
 * DEPENDEN de sector y modelo comercial —el alcance heredado del lote v0—. La clasificación REAL (PRI-04 universal, CAU-01 localizada por modelo comercial) cambió lo que el
 * catálogo real pregunta, y la certifica `_universal_localizado_gate`; aquí se inyecta el catálogo con el alcance de antes para no mezclar las dos pruebas. */
const _ALCANCE_V0 = { sector: ["distribucion"], tipoProducto: "*", modeloComercial: ["cuentas_grandes", "comercios"], pais: "*", banda: "*" };
const CATALOGO_V0 = PIEZAS_CONOCIMIENTO.map((p) => (p.estado === "firmada" ? { ...p, alcance: { ..._ALCANCE_V0 } } : p));
const CONOC = { activo: true, catalogo: CATALOGO_V0 };   // el conocimiento del oficio ENCENDIDO (hoy apagado en todos los perfiles): de él depende qué hace falta
const sinComentarios = (src) => String(src).replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`\\])\/\/[^\n]*/g, "$1");
const leer = (p) => fs.readFileSync(new URL(p, import.meta.url), "utf8");

let _tick = 0;
const relojDeGate = () => new Date(Date.UTC(2026, 9, 3, 12, 0, 0) + (++_tick) * 1000).toISOString();

/* el Marco de una respuesta: la COMPACTA que viaja por la puerta (`entrega.marco`, `capacidad/compacto.js`) o la completa de las acciones directas (`entrega.json.marco`, los bancos con el defecto inyectado) */
const marcoDe = (r) => (r && r.entrega ? (r.entrega.marco || (r.entrega.json && r.entrega.json.marco)) : null);

/* ── los tres encargos del campo de prueba (formas ya tipadas, las de `fixtures/encargos-desarrollo.json`) ─────────── */
const _c = (conv) => (conv ? { conversacionId: conv } : {});
const encComercial = (conv = null) => ({ version: "encargo/v1", ..._c(conv), partes: [{ id: "p1", tema: "comercial", cierre: "cifra", conceptos: ["ventas"], entidades: [{ nombre: "Jumbo" }] }] });
const encCobranza = (conv = null) => ({ version: "encargo/v1", ..._c(conv), partes: [{ id: "p1", tema: "cobranza", cierre: "cifra", conceptos: ["saldo_vencido", "dias_vencido", "saldo_pendiente"], entidades: [{ nombre: "Lider", eje: "cliente" }] }] });
const encInventario = (conv = null) => ({ version: "encargo/v1", ..._c(conv), partes: [{ id: "p1", tema: "inventario", cierre: "cifra", conceptos: ["capital"], eje: "bodega" }] });

const EMPRESAS_P = [
  { id: "alfa", nombre: "Comercial Alfa", factor: 1, version: 3 },
  { id: "beta", nombre: "Comercial Beta", factor: 2.5, version: 7 },
  { id: "gamma", nombre: "Comercial Gamma", factor: 0.4, version: 5 },
];

/* ═══ 1 · LOS RÓTULOS Y LAS OPCIONES SALEN DE LA TAXONOMÍA ═════════════════════════════════════════════════════════════ */
H("1 · los rótulos y las opciones SALEN de la taxonomía; lo que ve la persona va en tercera persona y registro de la casa");
/* el control: cada código de la taxonomía de cada campo tiene su rótulo; ningún rótulo sin código; las opciones de la pregunta
 * son EXACTAMENTE la taxonomía, en su orden. Recibe los rótulos y las preguntas para poder probarlo con una carnada. */
function verificarRotulos(rotulos, preguntas) {
  const falla = [];
  for (const campo of EMP.CAMPOS_PERFIL_DECLARABLES) {
    const lista = TAXONOMIA_PERFIL[EMP.LISTA_DE_CAMPO_PERFIL[campo]];
    const R = rotulos[campo] && rotulos[campo].opciones;
    if (!R) { falla.push(`${campo}: sin rótulos`); continue; }
    for (const cod of lista) if (!R[cod] || !R[cod].rotulo) falla.push(`${campo}/${cod}: código de la taxonomía SIN rótulo`);
    for (const cod of Object.keys(R)) if (!lista.includes(cod)) falla.push(`${campo}/${cod}: rótulo de un código que la taxonomía NO tiene`);
    const q = preguntas.find((x) => x.campo === campo);
    if (!q) { falla.push(`${campo}: sin pregunta`); continue; }
    if (JSON.stringify(q.opciones.map((o) => o.codigo)) !== JSON.stringify(lista)) falla.push(`${campo}: las opciones de la pregunta no son EXACTAMENTE la taxonomía`);
    if (!q.pregunta || !q.significado || !q.paraQue) falla.push(`${campo}: falta pregunta, significado o para qué`);
  }
  return falla;
}
{
  const preguntas = PC.preguntasDelPerfil();
  ok(verificarRotulos(PC.ROTULOS_PERFIL, preguntas).length === 0, "★ cada código de la taxonomía tiene su rótulo, ningún rótulo sobra y las opciones de cada pregunta SON la taxonomía (mismo orden)", JSON.stringify(verificarRotulos(PC.ROTULOS_PERFIL, preguntas)));
  // CARNADA · un código nuevo en la taxonomía sin rótulo / un rótulo de un código que ya no existe
  const sinUno = JSON.parse(JSON.stringify(PC.ROTULOS_PERFIL)); delete sinUno.sector.opciones.obras;
  const conSobra = JSON.parse(JSON.stringify(PC.ROTULOS_PERFIL)); conSobra.pais.opciones.ZZ = { rotulo: "Atlántida" };
  const preguntaRecortada = preguntas.map((q) => (q.campo === "sector" ? { ...q, opciones: q.opciones.slice(1) } : q));
  ok(verificarRotulos(sinUno, preguntas).some((f) => /SIN rótulo/.test(f)), "★ CARNADA · un código de la taxonomía sin rótulo lo marca el control");
  ok(verificarRotulos(conSobra, preguntas).some((f) => /NO tiene/.test(f)), "★ CARNADA · un rótulo de un código que la taxonomía no tiene lo marca el control");
  ok(verificarRotulos(PC.ROTULOS_PERFIL, preguntaRecortada).some((f) => /EXACTAMENTE/.test(f)), "★ CARNADA · una pregunta con las opciones escritas a mano (una menos) la marca el control");
  ok(JSON.stringify(preguntas.map((q) => q.campo)) === JSON.stringify(["sector", "tipoProducto", "modeloComercial", "pais"]), "las preguntas salen en el orden en que ADI las hace: sector → tipo de producto → a quién vende → país");
  const q0 = PC.preguntasDelPerfil(["pais"])[0];
  ok(PC.preguntasDelPerfil(["pais"]).length === 1 && q0.campo === "pais" && q0.omitible === true && q0.comoResponder.aporte.clase === "perfil" && q0.comoResponder.siNoQuiereResponder.omitir[0] === "pais", "la pregunta dice EXACTAMENTE cómo se responde (clase «perfil», código de la opción) y cómo se omite");
  ok(JSON.stringify(PC.preguntasDelPerfil(["tipoProducto"])[0].aplicaA) === JSON.stringify(SECTORES_CON_TIPO_PRODUCTO), "el tipo de producto declara a qué sectores aplica (los de la taxonomía)");

  // lo que ve la persona: tercera persona (la Entrega no le habla a nadie), registro de la casa, sin «frenado» con el sentido viejo
  const textos = [];
  for (const campo of EMP.CAMPOS_PERFIL_DECLARABLES) {
    const R = PC.ROTULOS_PERFIL[campo];
    textos.push(R.rotulo, R.conArticulo, R.pregunta, R.aclaracion, R.significado, R.paraQue);
    for (const o of Object.values(R.opciones)) textos.push(o.rotulo, o.significado || "");
  }
  for (const campo of EMP.CAMPOS_PERFIL_DECLARABLES) textos.push(PC.textoDeLimitacion(campo));
  const BANNED = /\b(plata|dormid[oa]s?|guita|palancas?|apr[ei]et\w*|detenid[oa]s?|varas?)\b/i;
  const TRATO = /(?<![\wáéíóúñ])(t[uú]|tus?|ti|vos|usted(?:es)?|su\s+empresa)(?![\wáéíóúñ])/i;
  ok(textos.every((t) => !BANNED.test(t)), "ningún texto del perfil usa vocabulario prohibido del registro ejecutivo", textos.filter((t) => BANNED.test(t)).join(" | "));
  ok(textos.every((t) => !TRATO.test(t)), "ningún texto del perfil le habla a nadie (ni tú, ni vos, ni usted): tercera persona; el anfitrión adapta el tono", textos.filter((t) => TRATO.test(t)).join(" | "));
  ok(textos.every((t) => !/\bfrenad[oa]s?\b/i.test(t)), "ningún texto del perfil usa «frenado» (con el canon de inventario, «frenado» es venta, no capital)");
  // CARNADA · el control de trato muerde: la misma pregunta en segunda persona
  ok(TRATO.test("¿Qué haces tú con lo que vendes?") && TRATO.test("Si su empresa vende más de una cosa") && !TRATO.test(PC.ROTULOS_PERFIL.sector.pregunta), "★ CARNADA · el control de trato marca la segunda persona y deja pasar la tercera");
}

H("1b · la memoria: la clase «perfil» solo entra por la vía del perfil (el campo es el concepto) y no se lista como un hecho");
{
  { /* (i) la vía genérica y el almacén rechazan lo que no es del perfil: un almacén vacío para estas pruebas */
  const store = crearAlmacenEnMemoria();
  const r1 = await EMP.declararHecho(store, "t1", { clase: "perfil", concepto: "sector", valor: { texto: "distribucion" } });
  const r2 = await EMP.declararHecho(store, "t1", { clase: "hecho", concepto: "perfil:sector", valor: { texto: "distribucion" } });
  const r3 = await EMP.declararHecho(store, "t1", { clase: "criterio", concepto: "Perfil:Sector", valor: { texto: "fabricacion" } });
  const r4 = await EMP.declararHecho(store, "t1", { clase: "hecho", concepto: "sector", valor: { texto: "distribucion" } });
  const r5 = await EMP.declararHecho(store, "t1", { clase: "hecho", concepto: "Tipo_Producto", valor: { texto: "vence" } });
  const r6 = await EMP.declararHecho(store, "t1", { clase: "documento", concepto: "pais", valor: { texto: "CL" }, origen: "documento", documento: { nombre: "x.pdf", tipo: "pdf", parte: "p1" } });
  ok(!r1.ok && !r2.ok && !r3.ok, "★ por la vía genérica ni la clase «perfil» ni el prefijo viejo (con mayúsculas tampoco) entran: un hecho cualquiera no se salta la validación de la taxonomía", JSON.stringify([r1, r2, r3]));
  ok(!r4.ok && !r5.ok && !r6.ok, "★ CARNADA · un «hecho» (o un documento) con el concepto de un campo de perfil —«sector», «Tipo_Producto», «pais»— se rechaza por la vía genérica", JSON.stringify([r4, r5, r6]));
  const o1 = await EMP.omitirCampo(store, "t1", { clase: "hecho", concepto: "sector" });
  const o2 = await EMP.omitirCampo(store, "t1", { clase: "perfil", concepto: "sector" });
  ok(!o1.ok && !o2.ok, "★ la omisión genérica tampoco guarda un campo de perfil (se omite por su propia vía)", JSON.stringify([o1, o2]));
  ok((await store.leerHechosEmpresa("t1")).length === 0, "y no quedó guardado nada");
  // el almacén (la base) repite la regla: un perfil guardado como «hecho», un «hecho» con concepto de perfil, o un perfil que no es «declarado», se RECHAZAN
  const fila = (extra) => ({ id: "f1", clase: "hecho", concepto: "x", eje: null, entidad: null, periodo: null, valor: { raw: null, unidad: null, texto: "distribucion" }, origen: "declarado", estado: "pendiente", declaradoEn: relojDeGate(), conversacionId: null, ...extra });
  const rechaza = async (extra) => { try { await store.guardarHechoEmpresa("t1", fila(extra)); return false; } catch (e) { return e && e.name === "ErrorDeAlmacen"; } };
  ok(await rechaza({ clase: "hecho", concepto: "perfil:sector" }) && await rechaza({ clase: "hecho", concepto: "sector" }) && await rechaza({ clase: "criterio", concepto: "pais" }) && await rechaza({ clase: "perfil", concepto: "perfil:sector" }) && await rechaza({ clase: "perfil", concepto: "moneda" }) && await rechaza({ clase: "perfil", concepto: "sector", origen: "medido" }) && await rechaza({ clase: "perfil", concepto: "sector", origen: "documento" }), "★ CARNADA · el almacén rechaza un perfil guardado como «hecho» (con o sin el prefijo viejo), un criterio con concepto de perfil, un perfil de un campo que no existe o con origen que no es «declarado»");
  let guardoBien = true; try { await store.guardarHechoEmpresa("t1", fila({ id: "f2", clase: "perfil", concepto: "sector" })); await store.guardarHechoEmpresa("t1", fila({ id: "f3", clase: "hecho", concepto: "plazo_de_cobro" })); } catch (_e) { guardoBien = false; }
  ok(guardoBien && (await store.leerHechosEmpresa("t1")).length === 2, "y lo bien formado sí entra: un perfil de un campo «declarado», y un hecho cualquiera");
  }
  /* (ii) por su propia vía, el perfil se guarda, se confirma y se lee */
  const store = crearAlmacenEnMemoria();
  const ok1 = await EMP.declararPerfilCampo(store, "t1", { campo: "sector", codigo: "distribucion" }, { conversacionId: "c1" });
  ok(ok1.ok && ok1.estado === "pendiente" && ok1.entendido.origen === "declarado" && ok1.entendido.clase === "perfil" && ok1.entendido.concepto === "sector", "por su propia vía: se guarda «declarado», pendiente, con la clase «perfil» y el campo como concepto (sin prefijo)");
  await EMP.confirmarHecho(store, "t1", ok1.id, { resolverConflicto: true });
  const mem = await EMP.memoriaDeEmpresa(store, "t1");
  ok(mem.hechos.length === 0, "la vista de «memoria de empresa» NO lista las filas de perfil como hechos (se leen validadas, con `leerPerfilDeclarado`)");
  const e = await EMP.leerPerfilDeclarado(store, "t1");
  ok(e.vigentes.sector && e.vigentes.sector.valor === "distribucion" && e.vigentes.sector.origen === "declarado" && e.vigentes.sector.confirmacion && e.vigentes.sector.confirmacion.por !== undefined, "leído: vigente, origen «declarado» y el sello de confirmación APARTE");
  // falla cerrado: una fila de perfil escrita por fuera de la puerta, con un valor que la taxonomía no tiene o con otro origen, NO se sirve
  // (el almacén «sin muro de forma» deja guardar filas que la base rechazaría: así se prueba al LECTOR, defensa en profundidad)
  const crudo = crearAlmacenEnMemoria({ sinMuroDeForma: true });
  const fx = (id, clase, concepto, texto, origen = "declarado") => ({ id, clase, concepto, eje: null, entidad: null, periodo: null, valor: { raw: null, unidad: null, texto }, origen, estado: "vigente", declaradoEn: relojDeGate(), conversacionId: null });
  await crudo.guardarHechoEmpresa("t1", fx("x1", "perfil", "pais", "Atlántida"));
  await crudo.guardarHechoEmpresa("t1", fx("x2", "perfil", "modeloComercial", "comercios", "medido"));
  await crudo.guardarHechoEmpresa("t1", fx("x3", "hecho", "sector", "distribucion"));
  await crudo.guardarHechoEmpresa("t1", fx("x4", "hecho", "perfil:sector", "fabricacion"));
  const e2 = await EMP.leerPerfilDeclarado(crudo, "t1");
  ok(!e2.vigentes.pais && !e2.vigentes.modeloComercial, "★ FALLA CERRADO: una fila con un código fuera de la taxonomía o con un origen que no es «declarado» NO cuenta (nunca se sirve un valor que la taxonomía no avala)");
  ok(!e2.vigentes.sector && Object.keys(e2.pendientes).length === 0, "★ CARNADA · un perfil guardado como «hecho» (con el campo como concepto o con el prefijo viejo) NO cuenta como perfil: solo cuenta la clase «perfil»");
  ok((await EMP.memoriaDeEmpresa(crudo, "t1")).hechos.length === 0, "y tampoco se lista entre los hechos de la memoria");
  // el valor se valida contra la taxonomía, exacto
  const V = (campo, cod, sector) => EMP.validarValorDePerfil(campo, cod, { sector });
  ok(V("sector", "distribucion").ok && !V("sector", "Distribución").ok && !V("sector", "DISTRIBUCION").ok && !V("sector", "").ok && !V("sector", 3).ok && !V("sector", null).ok && !V("pais", "cl").ok && V("pais", "CL").ok, "el valor es el CÓDIGO exacto de una opción: ni el rótulo, ni mayúsculas, ni vacío, ni un número");
  ok(!V("tipoProducto", "vence", null).ok && !V("tipoProducto", "vence", "servicios").ok && V("tipoProducto", "vence", "distribucion").ok && !V("tipoProducto", "vence", "obras").ok, "el tipo de producto exige un sector al que le aplique (regla dura de la taxonomía)");
  ok(!V("tamano", "micro").ok && !V("moneda", "CLP").ok, "el tamaño (se deriva) y la moneda (se declara al cargar) NO son campos que se declaren conversando");
  // CARNADA · la validación contra la taxonomía: una versión que acepta cualquier texto
  const validaTodo = (campo, cod) => ({ ok: typeof cod === "string" && cod.trim() !== "" });
  ok(validaTodo("sector", "Distribución").ok && !V("sector", "Distribución").ok, "★ CARNADA · una validación que acepta cualquier texto deja pasar «Distribución»; la real no");
}

/* ═══ 2 · QUÉ CAMPOS HARÍAN FALTA PARA LO QUE SE PIDIÓ ═════════════════════════════════════════════════════════════════ */
H("2 · `necesitaPerfil`: solo lo que hace falta para lo pedido; si no falta nada, no pide nada");
{
  const N = (enc, o = {}) => PC.necesitaPerfil(enc, { activo: true, catalogo: CATALOGO_V0, ...o });
  const cmp = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  ok(cmp(Object.keys(PC.TEMA_DE_PREDICADO).sort(), PREDICADOS_CERRADOS.map((p) => p.predicado).sort()), "★ candado: TODO predicado de la pertinencia tiene decidido su tema (un predicado nuevo obliga a decidirlo aquí)");
  const firmadas = PIEZAS_CONOCIMIENTO.filter((p) => p.estado === "firmada").map((p) => p.id);
  ok(firmadas.length >= 1, `hay piezas firmadas en el catálogo real (${firmadas.join(", ")}): sin ellas nada hace falta`);

  let n = N(encComercial());
  ok(cmp(n.necesarios, ["sector", "modeloComercial"]) && n.siguiente === "sector", "comercial sin nada declarado → hacen falta sector y modelo comercial; la pregunta de ahora es UNA: el sector", JSON.stringify(n));
  n = N(encCobranza());
  ok(cmp(n.necesarios, ["sector", "modeloComercial"]) && n.siguiente === "sector", "cobranza sin nada declarado → lo mismo (su pieza firmada restringe sector y modelo comercial)");
  n = N(encInventario());
  ok(n.necesarios.length === 0 && n.siguiente === null && n.limitaciones.length === 0, "★ inventario: su pieza NO está firmada → no hace falta NADA y no se pide nada", JSON.stringify(n));
  n = N(encComercial(), { conocidos: { sector: "servicios" } });
  ok(n.necesarios.length === 0 && n.siguiente === null, "un sector «servicios» DESCARTA las piezas de distribución: ya no hace falta preguntar a quién vende");
  n = N(encComercial(), { conocidos: { sector: "ninguno" } });
  ok(n.necesarios.length === 0, "«ninguna de estas» (respondido) tampoco deja nada por preguntar");
  n = N(encComercial(), { conocidos: { sector: "distribucion" } });
  ok(cmp(n.necesarios, ["modeloComercial"]) && n.siguiente === "modeloComercial", "sector distribución → falta el modelo comercial, y solo ese");
  n = N(encComercial(), { conocidos: { sector: "distribucion", modeloComercial: "comercios" } });
  ok(n.necesarios.length === 0 && n.siguiente === null, "sector y modelo declarados → no falta nada: no pide nada");
  n = N(encComercial(), { conocidos: { sector: "distribucion", modeloComercial: "consumidor" } });
  ok(n.necesarios.length === 0, "un modelo comercial «consumidor» descarta la pieza (su alcance es cuentas grandes o comercios): nada que preguntar");
  n = N(encComercial(), { omitidos: ["sector"] });
  ok(n.necesarios.length === 0 && n.siguiente === null && cmp(n.limitaciones, [{ campo: "sector" }]), "sector omitido → no se pregunta y se DECLARA la limitación (no se aplica lo que depende de él)", JSON.stringify(n));
  n = N(encComercial(), { conocidos: { sector: "distribucion" }, omitidos: ["modeloComercial"] });
  ok(n.siguiente === null && cmp(n.limitaciones, [{ campo: "modeloComercial" }]), "modelo comercial omitido → mismo trato");
  n = PC.necesitaPerfil(encComercial(), { activo: false });
  ok(n.necesarios.length === 0 && n.activo === false, "con el conocimiento del oficio APAGADO (hoy, en todos los perfiles) no hace falta nada: preguntar no serviría de nada");
  ok(N(null).necesarios.length === 0 && N({}).necesarios.length === 0 && N({ partes: [] }).necesarios.length === 0 && N({ partes: [{ id: "p1" }] }).necesarios.length === 0, "un encargo sin partes o sin tema no pide nada");
  n = N({ partes: [{ tema: "comercial" }, { tema: "cobranza" }, { tema: "inventario" }] });
  ok(cmp(n.necesarios, ["sector", "modeloComercial"]) && cmp(n.temas, ["comercial", "cobranza", "inventario"]), "un encargo de varios temas junta lo que necesita cada uno, sin repetir");
  ok(JSON.stringify(N(encComercial())) === JSON.stringify(N(encComercial())), "es determinista (puro): la misma entrada, la misma salida");

  // un catálogo sintético con una pieza que restringe tipo de producto y país: el orden y el «no antes de tener sector»
  const base = CATALOGO_V0.find((p) => p.id === "PRI-04");
  const sint = [{ ...base, id: "SINT-1", estado: "firmada", alcance: { sector: ["distribucion", "servicios"], tipoProducto: ["vence"], modeloComercial: "*", pais: ["CL"], banda: "*" } }];
  n = N(encCobranza(), { catalogo: sint });
  ok(cmp(n.necesarios, ["sector", "tipoProducto", "pais"]) && n.siguiente === "sector", "pieza que restringe sector, tipo de producto y país → se preguntan en ese orden, de a una");
  n = N(encCobranza(), { catalogo: sint, conocidos: { sector: "distribucion" } });
  ok(n.siguiente === "tipoProducto", "con el sector declarado, sigue el tipo de producto");
  n = N(encCobranza(), { catalogo: sint, conocidos: { sector: "servicios" } });
  ok(cmp(n.necesarios, ["tipoProducto", "pais"]) && n.siguiente === "pais", "el tipo de producto NO se pregunta a un sector al que no le aplica (servicios): se pregunta el país");
  n = N(encCobranza(), { catalogo: sint, conocidos: { sector: "fabricacion" } });
  ok(n.necesarios.length === 0, "un sector fuera del alcance de la pieza (fabricación) la descarta: no se pregunta nada más");
  const borrador = [{ ...base, id: "SINT-2", estado: "borrador" }];
  ok(N(encCobranza(), { catalogo: borrador }).necesarios.length === 0, "una pieza en borrador (no se sirve) no hace que se pregunte nada");
  const otroTema = [{ ...base, id: "SINT-3", estado: "firmada", pertinencia: { todo: ["sku.inmovilizado_critico"] } }];
  ok(N(encCobranza(), { catalogo: otroTema }).necesarios.length === 0 && N(encInventario(), { catalogo: otroTema }).necesarios.length === 2, "una pieza de inventario se pregunta solo cuando lo consultado es de inventario");

  // CARNADA · «pregunta todo siempre»: lo que se pregunta sin mirar lo pedido
  const necesitaTodo = () => ({ necesarios: [...EMP.CAMPOS_PERFIL_DECLARABLES], siguiente: "sector", limitaciones: [] });
  ok(necesitaTodo(encInventario()).necesarios.length === 4 && N(encInventario()).necesarios.length === 0, "★ CARNADA · una versión que pregunta los cuatro campos siempre pide lo que inventario no necesita; la real no pide nada");
}

/* ═══ 3-5 · LOS BANCOS: la puerta real (memoria durable sobre el doble de Supabase) y la puerta con el defecto inyectado ═ */
const filasDeStore = (rows) => (rows || []).filter((f) => f.clase === "perfil" || EMP.esConceptoReservadoDePerfil(f.concepto)).map((f) => ({ id: f.id, concepto: f.concepto, estado: f.estado, origen: f.origen, valor: f.valor, confirmacion: f.confirmacion || null, clase: f.clase }));

/* (a) la puerta REAL contra el doble de Supabase: lo durable (con reinicio de la base) */
async function bancoDurable({ empresas = EMPRESAS_P, latenciaMaxMs = 2, semilla = SEMILLA } = {}) {
  let ent = await armarEntornoDoble({ empresas, semilla, latenciaMaxMs });
  let llamar = crearLlamadorPuerta({ manejarPuerta: ent.manejarPuerta, env: ent.env, opciones: { cliente: ent.cliente, transporte: ent.db.transporte, conocimiento: CONOC }, codigos: ent.codigos });
  return {
    nombre: "puerta real · memoria durable (doble de Supabase)",
    llamar: (e, a, args) => llamar(e, a, args),
    async reiniciar() {
      // el «reinicio»: otro módulo de la puerta (sin su memoria) y la base cargada desde su estado — solo sobrevive la base
      ent = await armarEntornoDoble({ empresas, semilla, latenciaMaxMs, estadoJson: ent.db.exportar() });
      llamar = crearLlamadorPuerta({ manejarPuerta: ent.manejarPuerta, env: ent.env, opciones: { cliente: ent.cliente, transporte: ent.db.transporte, conocimiento: CONOC }, codigos: ent.codigos });
    },
    filas: async (e) => filasDeStore(ent.db.filasDeEmpresa(e).memoria),
  };
}

/* (b) la puerta con las acciones INYECTADAS sobre una memoria del proceso: el código real, o con un defecto (la carnada) */
async function bancoInyectado({ envolverStore = (s) => s, envolverAcciones = (a) => a, empresas = EMPRESAS_P, nombre = "puerta · memoria del proceso", sinMuro = false } = {}) {
  const ent0 = await armarEntornoDoble({ empresas, latenciaMaxMs: 0, durable: false });   // el doble solo resuelve QUIÉN es cada empresa (token → tenant)
  const store = envolverStore(crearAlmacenEnMemoria({ sinMuroDeForma: sinMuro }));
  let manejarPuerta = ent0.manejarPuerta, llamar;
  const armar = () => {
    const acc = envolverAcciones(crearAcciones({ continuidad: store, conocimiento: CONOC, ahora: relojDeGate }), store);
    llamar = crearLlamadorPuerta({ manejarPuerta, env: ent0.env, opciones: { cliente: ent0.cliente, transporte: ent0.db.transporte, acciones: acc }, codigos: ent0.codigos });
  };
  armar();
  return {
    nombre, llamar: (e, a, args) => llamar(e, a, args),
    async reiniciar() { manejarPuerta = await importarPuertaFresca(); armar(); },
    filas: async (e) => filasDeStore(await store.leerHechosEmpresa(e)),
  };
}

/* ═══ 3 · LA PRUEBA DE ACEPTACIÓN: el guion fijo, por la puerta ═══════════════════════════════════════════════════════ */
const sectores = TAXONOMIA_PERFIL.sector;
const rotuloDe = (campo, cod) => (PC.ROTULOS_PERFIL[campo].opciones[cod] || {}).rotulo;
async function guion(banco) {
  const res = [];
  const R = (id, cond, det = "") => res.push({ id, ok: Boolean(cond), det: cond ? "" : String(det).slice(0, 400) });
  const L = (e, a, args = {}) => banco.llamar(e, a, args);
  const perfilDe = (c) => marcoDe(c).perfil;
  const una = (c, campo) => Boolean(c.perfil && c.perfil.pregunta && c.perfil.pregunta.campo === campo);
  const nada = (c) => c.ok === true && c.perfil === undefined;

  // ── ALFA · el camino feliz: sin perfil → UNA pregunta → valor tipado → «declarado» → la Entrega lo usa ──────────────
  const c0 = await L("alfa", "conocerEmpresa");
  R("A0 conocer: la empresa no tiene sector y no hay nada por confirmar", c0.ok && c0.perfil.faltantes.includes("sector") && !c0.perfil.porConfirmar && !c0.perfil.omitidos, JSON.stringify(c0.perfil && c0.perfil.faltantes));
  const c1 = await L("alfa", "consultar", { encargo: encComercial() });
  const q1 = c1.perfil && c1.perfil.pregunta;
  const conv = c1.continuidad.conversacionId;
  R("A1 pide algo que necesita el sector → ofrece UNA pregunta: la del sector", c1.ok && q1 && !Array.isArray(q1) && q1.campo === "sector", JSON.stringify(c1.perfil));
  R("A1 con las opciones válidas de la taxonomía, cada una con su rótulo y la pregunta con su significado", q1 && JSON.stringify(q1.opciones.map((o) => o.codigo)) === JSON.stringify(sectores) && q1.opciones.every((o) => o.rotulo) && q1.significado && q1.paraQue);
  R("A1 se puede omitir y dice cómo responder", q1 && q1.omitible === true && q1.comoResponder.aporte.clase === "perfil" && q1.comoResponder.aporte.concepto === "sector" && q1.comoResponder.siNoQuiereResponder.omitir[0] === "sector");
  R("A1 la consulta se responde igual (la Entrega viene, con su límite de perfil incompleto)", c1.entrega && Array.isArray(c1.entrega.cifras) && perfilDe(c1).faltantes.includes("sector"));

  const a2 = await L("alfa", "aportarContexto", { conversacionId: conv, aportes: [{ clase: "perfil", concepto: "sector", valor: "distribucion" }] });
  const r2 = (a2.resultados || [])[0] || {};
  R("A2 el valor TIPADO se guarda como «declarado», pendiente de confirmar", a2.ok && r2.estado === "pendiente" && r2.paraConfirmar === true && r2.entendido && r2.entendido.origen === "declarado" && r2.entendido.valor === "distribucion", JSON.stringify(a2));
  const f2 = await banco.filas("alfa");
  R("A2 en la memoria de la empresa: una fila, origen «declarado», valor = el código", f2.length === 1 && f2[0].origen === "declarado" && f2[0].estado === "pendiente" && f2[0].valor && f2[0].valor.texto === "distribucion", JSON.stringify(f2));

  const c3 = await L("alfa", "consultar", { encargo: encComercial(conv) });
  R("A3 REPETIR la consulta NO vuelve a preguntar el sector", c3.ok && !una(c3, "sector"));
  R("A3 lo declarado figura por confirmar (con su id) y no se abre otra pregunta mientras tanto", c3.perfil && c3.perfil.porConfirmar.length === 1 && c3.perfil.porConfirmar[0].campo === "sector" && c3.perfil.porConfirmar[0].id === r2.id && c3.perfil.porConfirmar[0].valorRotulo === rotuloDe("sector", "distribucion") && c3.perfil.pregunta === null, JSON.stringify(c3.perfil));
  R("A3 mientras está pendiente la Entrega todavía NO lo usa", c3.ok && perfilDe(c3).campos.sector.valor === null);

  const a4 = await L("alfa", "aportarContexto", { conversacionId: conv, confirmar: [r2.id] });
  const f4 = await banco.filas("alfa");
  R("A4 confirmar lo hace vigente y el origen sigue «declarado» (la confirmación es un sello aparte)", a4.confirmaciones && a4.confirmaciones[0] && a4.confirmaciones[0].confirmado === true && f4.length === 1 && f4[0].estado === "vigente" && f4[0].origen === "declarado" && f4[0].confirmacion && f4[0].confirmacion.medio, JSON.stringify(f4));

  const c5 = await L("alfa", "consultar", { encargo: encComercial(conv) });
  R("A5 la Entrega USA el perfil guardado: sector «distribucion» con procedencia «declarado»", c5.ok && perfilDe(c5).campos.sector.valor === "distribucion" && perfilDe(c5).campos.sector.procedencia === "declarado", JSON.stringify(c5.ok && perfilDe(c5).campos.sector));
  R("A5 y ya no lo cuenta entre lo que falta", c5.ok && !perfilDe(c5).faltantes.includes("sector"));
  R("A5 pregunta lo siguiente que hace falta (el modelo comercial), nunca el sector otra vez", una(c5, "modeloComercial") && !una(c5, "sector"), JSON.stringify(c5.perfil && c5.perfil.pregunta && c5.perfil.pregunta.campo));
  const cc = await L("alfa", "conocerEmpresa", { conversacionId: conv });
  R("A5 conocerEmpresa ve el perfil guardado con origen «declarado»", cc.ok && cc.perfil.campos.sector.valor === "distribucion" && cc.hechosAportados.some((h) => h.concepto === "sector" && h.valor && h.valor.texto === "distribucion" && h.origen === "declarado"));

  const a6 = await L("alfa", "aportarContexto", { conversacionId: conv, aportes: [{ clase: "perfil", concepto: "modeloComercial", valor: { texto: "comercios" } }] });
  await L("alfa", "aportarContexto", { conversacionId: conv, confirmar: [(a6.resultados[0] || {}).id] });
  const c7 = await L("alfa", "consultar", { encargo: encComercial(conv) });
  R("A7 con lo necesario declarado NO pide nada (ni pregunta ni bloque)", nada(c7), JSON.stringify(c7.perfil));
  R("A7 la Entrega trae sector y modelo comercial declarados", c7.ok && perfilDe(c7).campos.modeloComercial.valor === "comercios" && perfilDe(c7).campos.modeloComercial.procedencia === "declarado" && perfilDe(c7).campos.sector.valor === "distribucion");
  const c8 = await L("alfa", "consultar", { encargo: encCobranza() });
  const c8b = await L("alfa", "consultar", { encargo: encComercial() });
  R("A8 en una conversación NUEVA tampoco repite lo ya respondido (el perfil es de la EMPRESA, no de la conversación)", nada(c8) && nada(c8b));
  const c9 = await L("alfa", "consultar", { encargo: encInventario(conv) });
  R("A9 sin pedirlo nada del perfil (inventario): funciona igual y no pregunta nada", nada(c9) && c9.entrega && c9.entrega.texto && c9.entrega.texto.length > 0, JSON.stringify(c9.perfil));
  const e9 = await L("gamma", "consultar", { encargo: encInventario() });
  R("A9b la empresa SIN perfil, con una consulta que no lo necesita: funciona igual y no pregunta nada", nada(e9) && perfilDe(e9).faltantes.includes("sector"), JSON.stringify(e9.perfil));

  // ── BETA · omitir se respeta y declara la limitación ────────────────────────────────────────────────────────────────
  const b1 = await L("beta", "consultar", { encargo: encComercial() });
  const bconv = b1.continuidad.conversacionId;
  R("B1 empresa sin perfil: ofrece el sector", una(b1, "sector"));
  const b2 = await L("beta", "aportarContexto", { conversacionId: bconv, omitir: ["sector"] });
  const fb2 = await banco.filas("beta");
  R("B2 omitir se guarda (un «omitido», sin valor) y declara QUÉ se limita", b2.ok && b2.omitidos && b2.omitidos[0] && b2.omitidos[0].ok === true && /Sin el sector declarado/.test(b2.omitidos[0].limitacion || "") && fb2.length === 1 && fb2[0].estado === "omitido" && !(fb2[0].valor && fb2[0].valor.texto), JSON.stringify([b2, fb2]));
  const b3 = await L("beta", "consultar", { encargo: encComercial(bconv) });
  R("B3 omitido: NO vuelve a preguntar el sector", b3.ok && !(b3.perfil && b3.perfil.pregunta), JSON.stringify(b3.perfil && b3.perfil.pregunta && b3.perfil.pregunta.campo));
  R("B3 la limitación queda declarada en la consulta (qué no se aplica por esa omisión)", b3.perfil && b3.perfil.limitaciones && b3.perfil.limitaciones.length === 1 && b3.perfil.limitaciones[0].campo === "sector" && /no aplica las referencias del oficio/.test(b3.perfil.limitaciones[0].texto), JSON.stringify(b3.perfil));
  R("B3 y la consulta se responde igual, con sus cifras", b3.ok && b3.entrega && Array.isArray(b3.entrega.cifras) && b3.entrega.cifras.length > 0);
  const b4 = await L("beta", "consultar", { encargo: encCobranza(bconv) });
  R("B4 sigue sin preguntar, en cualquier consulta de esa conversación, y sigue declarando la limitación", b4.ok && !(b4.perfil && b4.perfil.pregunta) && b4.perfil && b4.perfil.limitaciones.length === 1);
  const b5 = await L("beta", "consultar", { encargo: encComercial() });
  R("B5 en OTRA conversación, como esta consulta lo necesita, se vuelve a ofrecer — y lo dice (no es una pregunta nueva sin motivo)", una(b5, "sector") && /otra conversación/.test(b5.perfil.pregunta.reofrecida || ""), JSON.stringify(b5.perfil && b5.perfil.pregunta && b5.perfil.pregunta.reofrecida));
  const b6 = await L("beta", "aportarContexto", { conversacionId: bconv, aportes: [{ clase: "perfil", concepto: "sector", valor: "servicios" }] });
  await L("beta", "aportarContexto", { conversacionId: bconv, confirmar: [(b6.resultados[0] || {}).id] });
  const b6c = await L("beta", "consultar", { encargo: encComercial(bconv) });
  R("B6 declarar DESPUÉS de omitir funciona: la limitación desaparece, la Entrega usa el sector y (servicios) no hace falta preguntar a quién vende", nada(b6c) && perfilDe(b6c).campos.sector.valor === "servicios", JSON.stringify(b6c.perfil));
  const b7 = await L("beta", "aportarContexto", { conversacionId: bconv, aportes: [{ clase: "perfil", concepto: "tipoProducto", valor: "vence" }] });
  R("B7 un tipo de producto que no le aplica al sector (servicios) se rechaza", b7.ok && b7.resultados[0].estado === "rechazado" && /no aplica al sector/.test(b7.resultados[0].motivo || ""), JSON.stringify(b7.resultados));
  const b8 = await L("beta", "aportarContexto", { conversacionId: bconv, omitir: ["sector"] });
  const o8 = (b8.omitidos || [])[0] || {};
  R("B8 no se omite lo que la empresa ya declaró", b8.ok && o8.ok === false && /ya está declarado/.test(o8.motivo || ""));

  // ── GAMMA · un valor inválido se rechaza con las opciones y NUNCA se inventa ────────────────────────────────────────
  const g1 = await L("gamma", "consultar", { encargo: encComercial() });
  const gconv = g1.continuidad.conversacionId;
  const g2 = await L("gamma", "aportarContexto", { conversacionId: gconv, aportes: [{ clase: "perfil", concepto: "sector", valor: "Distribución y venta mayorista" }] });
  const x2 = (g2.resultados || [])[0] || {};
  R("V1 un rótulo no es un valor válido: se rechaza y se devuelven las opciones válidas (código y rótulo)", x2.estado === "rechazado" && Array.isArray(x2.validos) && JSON.stringify(x2.validos.map((o) => o.codigo)) === JSON.stringify(sectores) && x2.validos.every((o) => o.rotulo), JSON.stringify(g2));
  const basura = ["xyz", 123, "", { texto: "mayorista" }, ["distribucion"], "DISTRIBUCION", "distribución", { raw: 3 }];
  const g3 = await L("gamma", "aportarContexto", { conversacionId: gconv, aportes: basura.map((v) => ({ clase: "perfil", concepto: "sector", valor: v })) });
  R("V2 CUALQUIER valor fuera de la taxonomía se rechaza (texto libre, número, vacío, lista, mayúsculas, tilde)", g3.ok && g3.resultados.length === basura.length && g3.resultados.every((x) => x.estado === "rechazado"), JSON.stringify(g3.resultados.map((x) => x.estado)));
  const g4 = await L("gamma", "aportarContexto", { conversacionId: gconv, aportes: [{ clase: "perfil", concepto: "tipoProducto", valor: "vence" }, { clase: "perfil", concepto: "pais", valor: "Chile" }, { clase: "perfil", concepto: "moneda", valor: "CLP" }, { clase: "perfil", concepto: "tamano", valor: "micro" }, { clase: "hecho", concepto: "perfil:sector", valor: "distribucion" }, { clase: "hecho", concepto: "sector", valor: "distribucion" }] });
  R("V3 sin sector no hay tipo de producto; un rótulo de país no vale; moneda y tamaño no se declaran conversando; ni el prefijo viejo ni el campo de perfil como «hecho» entran por la vía genérica", g4.ok && g4.resultados.length === 6 && g4.resultados.every((x) => x.estado === "rechazado"), JSON.stringify(g4.resultados.map((x) => x.motivo && x.motivo.slice(0, 50))));
  R("V3 y el país rechazado trae SUS opciones (los países de la taxonomía)", (g4.resultados[1] || {}).validos && JSON.stringify(g4.resultados[1].validos.map((o) => o.codigo)) === JSON.stringify(TAXONOMIA_PERFIL.pais));
  R("V4 NADA se guardó: ADI no inventa ni corrige un valor", (await banco.filas("gamma")).length === 0, JSON.stringify(await banco.filas("gamma")));
  const g5 = await L("gamma", "consultar", { encargo: encComercial(gconv) });
  R("V5 y el sector sigue sin declarar: la consulta lo vuelve a necesitar (porque nunca se respondió) y la Entrega no tiene sector", una(g5, "sector") && perfilDe(g5).campos.sector.valor === null);
  const g6 = await L("gamma", "aportarContexto", { conversacionId: gconv, aportes: [{ clase: "perfil", concepto: "sector", valor: "fabricacion" }, { clase: "perfil", concepto: "tipoProducto", valor: "vence" }] });
  R("V6 un tipo de producto que calza con el sector declarado (aun pendiente) se acepta", g6.ok && g6.resultados.every((x) => x.estado === "pendiente"), JSON.stringify(g6.resultados));

  // ── ORIGEN: todo lo guardado es «declarado» y con un valor de la taxonomía ─────────────────────────────────────────
  const todas = { alfa: await banco.filas("alfa"), beta: await banco.filas("beta"), gamma: await banco.filas("gamma") };
  const lista = (f) => TAXONOMIA_PERFIL[EMP.LISTA_DE_CAMPO_PERFIL[f.concepto]] || [];
  R("O1 TODO lo guardado: origen «declarado», clase «perfil» con el campo como concepto, valor dentro de la taxonomía", Object.values(todas).flat().every((f) => f.origen === "declarado" && f.clase === "perfil" && EMP.campoDeConceptoDePerfil(f.concepto) === f.concepto &&(f.estado === "omitido" ? !(f.valor && f.valor.texto) : lista(f).includes(f.valor && f.valor.texto))), JSON.stringify(todas));
  R("O2 lo confirmado conserva su origen y trae el sello de confirmación APARTE", todas.alfa.filter((f) => f.estado === "vigente").length === 2 && todas.alfa.filter((f) => f.estado === "vigente").every((f) => f.origen === "declarado" && f.confirmacion && f.confirmacion.cuando));

  // ── REINICIO: el perfil sigue (la base del bloque 1) y no se pregunta de nuevo ─────────────────────────────────────
  await banco.reiniciar();
  const rc = await L("alfa", "conocerEmpresa", { conversacionId: conv });
  R("R1 tras el REINICIO el perfil de alfa sigue, declarado", rc.ok && rc.perfil.campos.sector.valor === "distribucion" && rc.perfil.campos.sector.procedencia === "declarado" && rc.perfil.campos.modeloComercial.valor === "comercios", JSON.stringify(rc.perfil && rc.perfil.campos));
  const rq = await L("alfa", "consultar", { encargo: encComercial() });
  R("R2 y no se pregunta de nuevo (consulta en una conversación nueva)", nada(rq) && perfilDe(rq).campos.sector.valor === "distribucion");
  const rb = await L("beta", "consultar", { encargo: encComercial(bconv) });
  R("R3 beta (servicios, tras omitir y declarar): sigue sin preguntar ni limitar", nada(rb) && perfilDe(rb).campos.sector.valor === "servicios");
  const rg = await L("gamma", "consultar", { encargo: encComercial(gconv) });
  R("R4 gamma: lo pendiente sigue pendiente (no cuenta en la Entrega) y no se vuelve a preguntar", rg.ok && rg.perfil && rg.perfil.porConfirmar.length === 2 && rg.perfil.pregunta === null && perfilDe(rg).campos.sector.valor === null, JSON.stringify(rg.perfil));
  const rb2 = await L("beta", "consultar", { encargo: encComercial(bconv) });
  R("R5 el sector omitido y luego declarado en beta NO resucita la omisión", rb2.perfil === undefined);

  // ── TRES EMPRESAS INTERCALADAS: el perfil de una nunca aparece en la otra ──────────────────────────────────────────
  let cruce = [];
  for (let ronda = 0; ronda < 3; ronda++) {
    const [x, y, z] = await Promise.all([L("alfa", "consultar", { encargo: encComercial() }), L("beta", "consultar", { encargo: encCobranza() }), L("gamma", "consultar", { encargo: encComercial() })]);
    const [kx, ky, kz] = await Promise.all([L("alfa", "conocerEmpresa"), L("beta", "conocerEmpresa"), L("gamma", "conocerEmpresa")]);
    const sec = (c) => (c.ok ? perfilDe(c).campos.sector.valor : "ERROR");
    if (sec(x) !== "distribucion") cruce.push(`alfa vio ${sec(x)}`);
    if (sec(y) !== "servicios") cruce.push(`beta vio ${sec(y)}`);
    if (sec(z) !== null) cruce.push(`gamma vio ${sec(z)}`);
    if (marcoDe(x).empresa !== "Comercial Alfa" || marcoDe(y).empresa !== "Comercial Beta" || marcoDe(z).empresa !== "Comercial Gamma") cruce.push("la Entrega nombra a otra empresa");
    if (kx.perfil.campos.sector.valor !== "distribucion" || ky.perfil.campos.sector.valor !== "servicios" || kz.perfil.campos.sector.valor !== null) cruce.push("conocerEmpresa mezcló perfiles");
    if ((kz.perfil.porConfirmar || []).length !== 2 || kx.perfil.porConfirmar || ky.perfil.porConfirmar) cruce.push("lo por confirmar de una apareció en otra");
  }
  R("X1 CERO CRUCE: tres empresas intercaladas (Entregas y conocerEmpresa, 3 rondas) — cada una ve SOLO su perfil", cruce.length === 0, cruce.join(" | "));
  const fin = { alfa: await banco.filas("alfa"), beta: await banco.filas("beta"), gamma: await banco.filas("gamma") };
  const valores = (f) => f.filter((x) => x.estado !== "omitido").map((x) => x.valor.texto).sort();
  R("X2 en la memoria, el perfil de cada empresa es SOLO el suyo", JSON.stringify(valores(fin.alfa)) === JSON.stringify(["comercios", "distribucion"]) && JSON.stringify(valores(fin.beta)) === JSON.stringify(["servicios"]) && JSON.stringify(valores(fin.gamma)) === JSON.stringify(["fabricacion", "vence"]), JSON.stringify(fin));
  return res;
}
const resumenGuion = (res) => ({ total: res.length, rojos: res.filter((r) => !r.ok) });

H("3 · LA PRUEBA DE ACEPTACIÓN por la puerta — el guion fijo (sin LLM, cero red)");
{
  const rD = resumenGuion(await guion(await bancoDurable()));
  for (const r of rD.rojos) ok(false, `[puerta real · memoria durable] ${r.id}`, r.det);
  ok(rD.rojos.length === 0 && rD.total >= 45, `★ el guion completo pasa por la puerta REAL con la memoria durable (doble de Supabase): ${rD.total} controles, ${rD.rojos.length} rojos`);
  const rM = resumenGuion(await guion(await bancoInyectado({})));
  for (const r of rM.rojos) ok(false, `[puerta · memoria del proceso] ${r.id}`, r.det);
  ok(rM.rojos.length === 0 && rM.total === rD.total, `el mismo guion pasa con la memoria del proceso (${rM.total} controles): la misma representación en las dos memorias`);
}

/* ═══ 4 · LAS CARNADAS DEL GUION ═══════════════════════════════════════════════════════════════════════════════════════ */
/* Cada defecto es un envoltorio sobre el código real (o sobre su almacén). Lo que se exige es que el guion se ponga rojo —en
 * los controles que corresponden— con cada uno. La primera es EL CÓDIGO DE ANTES: el perfil se rechazaba y nada se preguntaba. */
const CARNADAS = {
  "el código de ANTES (el perfil se rechaza, nada se pregunta ni se omite)": {
    debenFallar: ["A1", "A2", "A5", "B2", "B3"],
    acciones: (acc) => ({
      ...acc,
      consultar: async (a) => { const { perfil, ...resto } = await acc.consultar(a); return resto; },
      aportarContexto: async (a) => {
        const perfiles = (a.aportes || []).filter((x) => x && x.clase === "perfil");
        const otros = (a.aportes || []).filter((x) => !(x && x.clase === "perfil"));
        const r = await acc.aportarContexto({ ...a, aportes: otros, omitir: [] });
        return { ...r, resultados: [...perfiles.map((p) => ({ id: null, estado: "rechazado", motivo: "el perfil de la empresa se declara por su propia vía, no como un hecho de la memoria", recibido: p })), ...(r.resultados || [])] };
      },
    }),
  },
  "REPITE la pregunta (ignora lo ya respondido u omitido)": {
    debenFallar: ["A3", "B3"],
    acciones: (acc) => ({
      ...acc,
      consultar: async (a) => {
        const r = await acc.consultar(a);
        if (!r.ok || marcoDe(r).perfil.campos.sector.valor) return r;
        return { ...r, perfil: { porConfirmar: [], limitaciones: [], uso: [], ...(r.perfil || {}), pregunta: PC.preguntasDelPerfil(["sector"])[0] } };
      },
    }),
  },
  "PREGUNTA lo que lo consultado no necesita": {
    debenFallar: ["A9"],
    acciones: (acc) => ({
      ...acc,
      consultar: async (a) => {
        const r = await acc.consultar(a);
        if (!r.ok || r.perfil || marcoDe(r).perfil.campos.sector.valor) return r;
        return { ...r, perfil: { pregunta: PC.preguntasDelPerfil(["sector"])[0], porConfirmar: [], limitaciones: [], uso: [] } };
      },
    }),
  },
  "INVENTA un valor (acepta lo que no está en la taxonomía)": {
    debenFallar: ["V1", "V2", "V4"],
    sinMuro: true,   // el defecto guarda perfiles de campos que no existen (moneda, tamaño): para medir al GUION, el almacén no los rechaza
    acciones: (acc, store) => ({
      ...acc,
      aportarContexto: async (a) => {
        const r = await acc.aportarContexto(a);
        const idx = (a.aportes || []).map((x, i) => [x, i]).filter(([x]) => x && x.clase === "perfil");
        for (const [x, i] of idx) {
          if (r.resultados && r.resultados[i] && r.resultados[i].estado === "rechazado" && typeof x.valor === "string" && x.valor.trim()) {
            await store.guardarHechoEmpresa(a.tenant.id, { id: `inv${i}`, clase: "perfil", concepto: x.concepto, eje: null, entidad: null, periodo: null, valor: { raw: null, unidad: null, texto: x.valor }, origen: "declarado", estado: "vigente", declaradoEn: relojDeGate(), conversacionId: null });
            r.resultados[i] = { id: `inv${i}`, estado: "pendiente", entendido: { clase: "perfil", concepto: x.concepto, valor: x.valor, origen: "declarado" }, paraConfirmar: true };
          }
        }
        return r;
      },
    }),
  },
  "guarda con el ORIGEN equivocado («medido»)": {
    debenFallar: ["O1"],
    sinMuro: true,   // la base rechaza un perfil «medido»: para medir al GUION, el almacén de esta carnada no lo rechaza
    store: (s) => ({ ...s, guardarHechoEmpresa: (t, h) => s.guardarHechoEmpresa(t, h.clase === "perfil" ? { ...h, origen: "medido" } : h) }),
  },
  "guarda el perfil como «hecho» (la clase de ANTES, con el almacén que no lo rechaza)": {
    debenFallar: ["A5"],
    sinMuro: true,
    store: (s) => ({ ...s, guardarHechoEmpresa: (t, h) => s.guardarHechoEmpresa(t, h.clase === "perfil" ? { ...h, clase: "hecho" } : h) }),
  },
  "MEZCLA empresas (la memoria ignora de quién es cada fila)": {
    debenFallar: ["X1", "X2"],
    store: (s) => ({
      ...s,
      leerHechosEmpresa: (_t) => s.leerHechosEmpresa("todas"),
      guardarHechoEmpresa: (_t, h) => s.guardarHechoEmpresa("todas", h),
      actualizarHechoEmpresa: (_t, id, c) => s.actualizarHechoEmpresa("todas", id, c),
    }),
  },
  "la Entrega NO LEE el perfil guardado": (() => {
    const estado = { ocultar: false };
    return {
      debenFallar: ["A5", "A7", "R2"],
      store: (s) => ({ ...s, leerHechosEmpresa: async (t) => (estado.ocultar ? (await s.leerHechosEmpresa(t)).filter((h) => h.clase !== "perfil") : s.leerHechosEmpresa(t)) }),
      acciones: (acc) => ({ ...acc, consultar: async (a) => { estado.ocultar = true; try { return await acc.consultar(a); } finally { estado.ocultar = false; } } }),
    };
  })(),
  "NO DECLARA la limitación de lo omitido": {
    debenFallar: ["B2", "B3"],
    acciones: (acc) => ({
      ...acc,
      consultar: async (a) => { const r = await acc.consultar(a); return r.perfil ? { ...r, perfil: { ...r.perfil, limitaciones: [] } } : r; },
      aportarContexto: async (a) => { const r = await acc.aportarContexto(a); return r.omitidos ? { ...r, omitidos: r.omitidos.map(({ limitacion, ...o }) => o) } : r; },
    }),
  },
  "IGNORA la omisión (no la guarda)": {
    debenFallar: ["B2", "B3", "B4"],
    acciones: (acc) => ({ ...acc, aportarContexto: async (a) => acc.aportarContexto({ ...a, omitir: [] }) }),
  },
};

H("4 · las CARNADAS del guion: con cada defecto (y con el código de ANTES) el guion TIENE que ponerse rojo");
for (const [nombre, def] of Object.entries(CARNADAS)) {
  const banco = await bancoInyectado({ envolverStore: def.store || ((s) => s), envolverAcciones: def.acciones || ((a) => a), nombre, sinMuro: Boolean(def.sinMuro) });
  let res;
  try { res = await guion(banco); } catch (e) { res = [{ id: "EXCEPCIÓN", ok: false, det: String(e && e.message) }]; }
  const rojos = res.filter((r) => !r.ok).map((r) => r.id);
  const faltan = def.debenFallar.filter((p) => !rojos.some((id) => id.startsWith(p)));
  ok(rojos.length > 0 && faltan.length === 0, `★ CARNADA · ${nombre}: el guion se pone rojo (${rojos.length} controles), incluidos ${def.debenFallar.join(", ")}`, `no se pusieron rojos: ${faltan.join(", ")} · rojos: ${rojos.slice(0, 12).join(", ")}${res.some((r) => r.id === "EXCEPCIÓN") ? " · " + res.find((r) => r.id === "EXCEPCIÓN").det : ""}`);
}

/* ═══ 5 · CONVERSACIONES AL AZAR (semilla fija) contra un modelo independiente ═════════════════════════════════════════ */
H("5 · conversaciones al azar (semilla fija): nunca repite lo respondido u omitido · siempre pregunta lo que falta · nunca un valor fuera de la taxonomía · origen siempre «declarado» · cero cruce");
const campos4 = EMP.CAMPOS_PERFIL_DECLARABLES;
const taxo = (campo) => TAXONOMIA_PERFIL[EMP.LISTA_DE_CAMPO_PERFIL[campo]];
const BASURA = ["Distribución y venta mayorista", "xyz", "DISTRIBUCION", "distribución", "cl", "Chile", "mayorista", "", 7, null, ["sector"], { texto: "retail" }, { raw: 1 }, "ninguna", "comercio"];

async function correrAzar({ banco, empresas, semilla, pasos, verTodo = true }) {
  const R = crearAzar(semilla);
  const M = Object.fromEntries(empresas.map((E) => [E.id, { vig: {}, pend: {}, omit: {}, convs: [], enviados: {} }]));
  const viol = [];
  let total = 0;
  const hist = [];                                                       // la traza de lo que se hizo (para ver COMO se llegó a una violación)
  const V = (m) => { total++; if (viol.length < 25) viol.push(total === 1 ? `${m} · TRAZA: ${hist.slice(-40).join(" ; ")}` : m); };
  const temas = [["comercial", encComercial], ["cobranza", encCobranza], ["inventario", encInventario]];
  const sumar = (m, campo, v) => { (m.enviados[campo] = m.enviados[campo] || new Set()).add(v); };
  const conoceId = (m, cid) => { if (cid && !m.convs.includes(cid)) m.convs.push(cid); };
  const pv = (m, c) => m.vig[c] || (m.pend[c] && m.pend[c].valor) || null;          // el valor sabido de un campo: lo vigente o lo pendiente
  const sectorSabido = (m) => pv(m, "sector");

  /* el ORÁCULO (independiente de `necesitaPerfil`): qué pregunta corresponde y qué limitaciones quedan, según el modelo */
  function esperado(m, cid, tema) {
    const omitidoAqui = (c) => Boolean(m.omit[c] && m.omit[c].has(cid));
    const lim = [];
    let pregunta = null;
    if (tema !== "inventario") {
      const sector = pv(m, "sector");
      if (!sector) { if (omitidoAqui("sector")) lim.push("sector"); }
      else if (sector === "distribucion") {
        const modelo = pv(m, "modeloComercial");
        if (!modelo && omitidoAqui("modeloComercial")) lim.push("modeloComercial");
      }
      const hayPend = Object.keys(m.pend).length > 0;
      if (!hayPend) {
        if (!sectorSabido(m)) pregunta = omitidoAqui("sector") ? null : "sector";
        else if (m.vig.sector === "distribucion" && !m.vig.modeloComercial && !omitidoAqui("modeloComercial")) pregunta = "modeloComercial";
      }
    }
    return { pregunta, lim };
  }

  for (let i = 0; i < pasos; i++) {
    const E = R.elegir(empresas), m = M[E.id], op = R();
    const convElegida = () => (m.convs.length && R() < 0.7 ? R.elegir(m.convs) : null);
    try {
      if (op < 0.42) {                                                              // consultar
        const [tema, mk] = R.elegir(temas);
        const r = await banco.llamar(E.id, "consultar", { encargo: mk(convElegida()) });
        const cid = r.continuidad && r.continuidad.conversacionId; conoceId(m, cid);
        if (!r.ok) { V(`#${i} ${E.id}: la consulta ${tema} no se respondió`); continue; }
        const p = r.perfil && r.perfil.pregunta;
        const ex = esperado(m, cid, tema);
        hist.push(`#${i} ${E.id} consultar ${tema}`);
        if (p && Array.isArray(p)) V(`#${i} ${E.id}: más de UNA pregunta`);
        if (p && !Array.isArray(p)) {
          if (m.vig[p.campo] || m.pend[p.campo]) V(`#${i} ${E.id}: PREGUNTA REPETIDA de lo ya respondido (${p.campo})`);
          if (m.omit[p.campo] && m.omit[p.campo].has(cid)) V(`#${i} ${E.id}: PREGUNTA REPETIDA de lo omitido en esa conversación (${p.campo})`);
          if (JSON.stringify((p.opciones || []).map((o) => o.codigo)) !== JSON.stringify(taxo(p.campo))) V(`#${i} ${E.id}: las opciones de ${p.campo} no son las de la taxonomía`);
          if (tema === "inventario") V(`#${i} ${E.id}: pregunta lo que inventario no necesita`);
        }
        if ((p ? p.campo : null) !== ex.pregunta) V(`#${i} ${E.id} (${tema}): la pregunta debía ser ${ex.pregunta} y fue ${p ? p.campo : null}`);
        const lim = ((r.perfil && r.perfil.limitaciones) || []).map((l) => l.campo).sort();
        if (JSON.stringify(lim) !== JSON.stringify([...ex.lim].sort())) V(`#${i} ${E.id}: limitaciones ${JSON.stringify(lim)} ≠ esperadas ${JSON.stringify(ex.lim)}`);
        const camp = marcoDe(r).perfil.campos;
        for (const c of ["sector", "modeloComercial", "pais"]) if ((camp[c].valor || null) !== (m.vig[c] || null)) V(`#${i} ${E.id}: la Entrega trae ${c}=${camp[c].valor} y lo declarado/confirmado de ESTA empresa es ${m.vig[c] || null}`);
        for (const c of ["sector", "modeloComercial", "pais"]) if (camp[c].valor && camp[c].procedencia !== "declarado") V(`#${i} ${E.id}: ${c} con procedencia ${camp[c].procedencia} (debe ser declarado)`);
        if (marcoDe(r).empresa !== E.nombre) V(`#${i} ${E.id}: la Entrega nombra a ${marcoDe(r).empresa}`);
        const pc = ((r.perfil && r.perfil.porConfirmar) || []).map((x) => `${x.campo}:${x.valor}`).sort();
        const pe = Object.entries(m.pend).map(([c, x]) => `${c}:${x.valor}`).sort();
        if (JSON.stringify(pc) !== JSON.stringify(pe)) V(`#${i} ${E.id}: por confirmar ${JSON.stringify(pc)} ≠ ${JSON.stringify(pe)}`);
      } else if (op < 0.68) {                                                       // aportar un valor VÁLIDO
        const campo = R.elegir(campos4), valor = R.elegir(taxo(campo));
        const cid0 = convElegida();
        const r = await banco.llamar(E.id, "aportarContexto", { ...(cid0 ? { conversacionId: cid0 } : {}), aportes: [{ clase: "perfil", concepto: campo, valor }] });
        conoceId(m, r.conversacionId);
        const x = (r.resultados || [])[0] || {};
        const sectorRef = pv(m, "sector");
        const acepta = campo !== "tipoProducto" || (sectorRef && SECTORES_CON_TIPO_PRODUCTO.includes(sectorRef));
        hist.push(`#${i} ${E.id} aportar ${campo}=${valor} → ${x.estado}/${x.id}`);
        if (acepta) {
          if (m.vig[campo] === valor) { if (x.estado !== "vigente" || x.paraConfirmar) V(`#${i} ${E.id}: repetir lo ya vigente debía devolverlo vigente`); delete m.pend[campo]; }   // re-afirmar lo vigente deja sin efecto lo pendiente distinto
          else if (x.estado !== "pendiente" || !x.id) V(`#${i} ${E.id}: un valor válido (${campo}=${valor}) debía quedar pendiente: ${JSON.stringify(x)}`);
          else { m.pend[campo] = { id: x.id, valor }; sumar(m, campo, valor); }
        } else if (x.estado !== "rechazado") V(`#${i} ${E.id}: ${campo}=${valor} con sector ${sectorRef} debía rechazarse`);
      } else if (op < 0.78) {                                                       // aportar BASURA
        const campo = R.elegir(campos4), valor = R.elegir(BASURA);
        const antes = (await banco.filas(E.id)).length;
        const r = await banco.llamar(E.id, "aportarContexto", { ...(m.convs.length ? { conversacionId: R.elegir(m.convs) } : {}), aportes: [{ clase: "perfil", concepto: campo, valor }] });
        conoceId(m, r.conversacionId);
        const x = (r.resultados || [])[0] || {};
        if (x.estado !== "rechazado") V(`#${i} ${E.id}: un valor FUERA de la taxonomía (${JSON.stringify(valor)}) se aceptó`);
        else if (campo && x.validos && JSON.stringify(x.validos.map((o) => o.codigo)) !== JSON.stringify(taxo(campo))) V(`#${i} ${E.id}: el rechazo no devolvió las opciones válidas de ${campo}`);
        if ((await banco.filas(E.id)).length !== antes) V(`#${i} ${E.id}: un valor rechazado dejó una fila guardada`);
      } else if (op < 0.88) {                                                       // confirmar un pendiente
        const c = campos4.find((k) => m.pend[k] && R() < 0.8) || campos4.find((k) => m.pend[k]);
        if (!c) continue;
        const r = await banco.llamar(E.id, "aportarContexto", { ...(m.convs.length ? { conversacionId: R.elegir(m.convs) } : {}), confirmar: [m.pend[c].id] });
        conoceId(m, r.conversacionId);
        hist.push(`#${i} ${E.id} confirmar ${c}=${m.pend[c].valor} (${m.pend[c].id})`);
        if (!(r.confirmaciones && r.confirmaciones[0] && r.confirmaciones[0].confirmado)) V(`#${i} ${E.id}: no se pudo confirmar ${c}`);
        else { m.vig[c] = m.pend[c].valor; delete m.pend[c]; }
      } else if (op < 0.95) {                                                       // omitir
        const campo = R.elegir(campos4);
        const r = await banco.llamar(E.id, "aportarContexto", { ...(convElegida() ? { conversacionId: R.elegir(m.convs) } : {}), omitir: [campo] });
        conoceId(m, r.conversacionId);
        const o = (r.omitidos || [])[0] || {};
        if (m.vig[campo]) { if (o.ok !== false) V(`#${i} ${E.id}: se omitió ${campo}, que ya estaba declarado`); }
        else if (o.ok !== true || !o.limitacion) V(`#${i} ${E.id}: omitir ${campo} debía quedar guardado y declarar la limitación: ${JSON.stringify(o)}`);
        else { (m.omit[campo] = m.omit[campo] || new Set()).add(r.conversacionId); }
      } else if (op < 0.98) {                                                       // reinicio
        await banco.reiniciar();
      } else {                                                                      // conocerEmpresa: lo vigente de ESTA empresa, y nada de otra
        const r = await banco.llamar(E.id, "conocerEmpresa", {});
        const camp = r.perfil.campos;
        for (const c of ["sector", "modeloComercial", "pais"]) if ((camp[c].valor || null) !== (m.vig[c] || null)) V(`#${i} ${E.id}: conocerEmpresa trae ${c}=${camp[c].valor} y lo de ESTA empresa es ${m.vig[c] || null}`);
      }
    } catch (e) { V(`#${i} ${E.id}: EXCEPCIÓN ${String(e && e.message).slice(0, 160)}`); }
  }

  // auditoría final de lo guardado, por empresa
  for (const E of empresas) {
    const m = M[E.id];
    for (const f of await banco.filas(E.id)) {
      const campo = EMP.campoDeConceptoDePerfil(f.concepto);
      if (!campo) { V(`${E.id}: fila de perfil con un concepto que no es un campo (${f.concepto})`); continue; }
      if (f.origen !== "declarado") V(`${E.id}: ORIGEN ${f.origen} en ${f.concepto} (siempre «declarado»)`);
      if (f.clase !== "perfil") V(`${E.id}: clase ${f.clase} en ${f.concepto} (el perfil es clase «perfil»)`);
      if (f.estado === "omitido") continue;
      const v = f.valor && f.valor.texto;
      if (!taxo(campo).includes(v)) V(`${E.id}: VALOR FUERA DE LA TAXONOMÍA guardado (${campo}=${v})`);
      else if (!(m.enviados[campo] && m.enviados[campo].has(v))) V(`${E.id}: ${campo}=${v} guardado en esta empresa sin que se le haya declarado a ella (CRUCE)`);
      if (f.estado === "vigente" && !(f.confirmacion && f.confirmacion.cuando)) V(`${E.id}: vigente sin sello de confirmación (${campo})`);
    }
  }
  return { violaciones: total, muestra: viol };
}

const EMPRESAS_AZAR = [
  { id: "pa", nombre: "Comercial Pa", factor: 1, version: 1 },
  { id: "pb", nombre: "Comercial Pb", factor: 1.7, version: 2 },
  { id: "pc", nombre: "Comercial Pc", factor: 0.6, version: 3 },
];
const bancoDirecto = async ({ envolverStore = (s) => s, envolverAcciones = (a) => a, empresas = EMPRESAS_AZAR } = {}) => {
  const store = envolverStore(crearAlmacenEnMemoria());
  const tenants = Object.fromEntries(empresas.map((E) => [E.id, { id: E.id, nombre: E.nombre, dataset: packDeEmpresa(E), version: E.version }]));
  let acc = null;
  const armar = () => { acc = envolverAcciones(crearAcciones({ continuidad: store, conocimiento: CONOC, ahora: relojDeGate }), store); };
  armar();
  return {
    async llamar(e, a, args) { const t = tenants[e]; return acc[a]({ tenant: t, ...args }); },
    async reiniciar() { armar(); },
    filas: async (e) => filasDeStore(await store.leerHechosEmpresa(e)),
  };
};
{
  const t0 = Date.now();
  const real = await correrAzar({ banco: await bancoDirecto(), empresas: EMPRESAS_AZAR, semilla: SEMILLA, pasos: 420 });
  ok(real.violaciones === 0, `★ 420 pasos al azar (3 empresas, semilla ${SEMILLA}) sobre la memoria del proceso: 0 violaciones — nunca repite lo respondido u omitido, siempre pregunta lo que falta, nunca un valor fuera de la taxonomía, origen siempre «declarado», cero cruce`, JSON.stringify(real.muestra.slice(0, 6)));
  const real2 = await correrAzar({ banco: await bancoDirecto(), empresas: EMPRESAS_AZAR, semilla: SEMILLA + 17, pasos: 300 });
  ok(real2.violaciones === 0, `★ otra semilla (${SEMILLA + 17}): 0 violaciones`, JSON.stringify(real2.muestra.slice(0, 6)));
  const durable = await bancoDurable({ empresas: EMPRESAS_AZAR, latenciaMaxMs: 2 });
  const rd = await correrAzar({ banco: durable, empresas: EMPRESAS_AZAR, semilla: SEMILLA + 5, pasos: 90 });
  ok(rd.violaciones === 0, "★ 90 pasos al azar por la puerta REAL con la memoria durable (doble de Supabase, con latencia aleatoria y reinicios de la base): 0 violaciones", JSON.stringify(rd.muestra.slice(0, 6)));

  const nombres = [
    ["REPITE la pregunta", "REPITE la pregunta (ignora lo ya respondido u omitido)"],
    ["INVENTA un valor", "INVENTA un valor (acepta lo que no está en la taxonomía)"],
    ["origen «medido»", "guarda con el ORIGEN equivocado («medido»)"],
    ["MEZCLA empresas", "MEZCLA empresas (la memoria ignora de quién es cada fila)"],
    ["pregunta lo NO necesario", "PREGUNTA lo que lo consultado no necesita"],
    ["la Entrega no lee el perfil", "la Entrega NO LEE el perfil guardado"],
    ["ignora la omisión", "IGNORA la omisión (no la guarda)"],
  ];
  for (const [rotulo, clave] of nombres) {
    const def = CARNADAS[clave];
    const r = await correrAzar({ banco: await bancoDirecto({ envolverStore: def.store || ((s) => s), envolverAcciones: def.acciones || ((a) => a) }), empresas: EMPRESAS_AZAR, semilla: SEMILLA, pasos: 200 });
    ok(r.violaciones > 0, `★ CARNADA · al azar, con el defecto «${rotulo}» el control marca ${r.violaciones} violaciones`, JSON.stringify(r.muestra.slice(0, 2)));
  }
  console.log(`   (conversaciones al azar: ${((Date.now() - t0) / 1000).toFixed(1)} s)`);
}

/* ═══ 6 · LA DESCRIPCIÓN DE LA HERRAMIENTA DICE LO QUE EL SISTEMA HACE · LA CADENA DE LA PUERTA SIGUE SIN `node:*` ═════ */
H("6 · la descripción de la herramienta dice lo que el sistema hace; la cadena de la puerta sigue sin `node:*`");
{
  const tool = MCP_TOOLS.find((t) => t.name === "aportarContexto");
  /* el control: la descripción dice lo que el sistema REALMENTE hace — perfil con el código de una opción, omitir, confirmar
   * (pendiente → vigente), «declarado»; y NO afirma un cruce con lo medido que el sistema no hace (límite declarado). */
  const diceLoReal = (d) => /perfil/.test(d) && /CÓDIGO de la opción/.test(d) && /omitir/.test(d) && /confirmar/.test(d) && /PENDIENTE/.test(d) && /declarado/i.test(d) && /se rechaza/.test(d) && !/dato medido/.test(d);
  ok(diceLoReal(tool.description), "★ la descripción de aportarContexto dice lo que el sistema hace (perfil con el código de la opción, omitir, confirmar, pendiente, declarado) y ya no afirma un cruce con lo medido que no existe", tool.description.slice(0, 200));
  const descripcionDeAntes = "Registra lo que el usuario declaró por su cuenta — su perfil (sector, tipo de producto, país, modelo comercial), un criterio propio, un hecho de negocio, o un dato extraído de un documento que el usuario compartió. NUNCA se usa para cifras que ADI ya calcula: eso se pide con consultar. Un aporte que choca con un dato medido queda declarado, no reemplaza lo medido.";
  ok(!diceLoReal(descripcionDeAntes), "★ CARNADA · la descripción de ANTES (anunciaba el perfil que el código rechazaba y un cruce con lo medido) la marca el control");
  const props = tool.inputSchema.properties;
  ok(props.omitir && JSON.stringify(props.omitir.items.enum) === JSON.stringify([...campos4]), "el esquema trae `omitir`, con exactamente los campos del perfil que se declaran");
  const consultar = MCP_TOOLS.find((t) => t.name === "consultar");
  ok(/«perfil»/.test(consultar.description) && /UNA pregunta/.test(consultar.description), "consultar avisa que puede traer el bloque «perfil» con UNA pregunta");
  const oa = construirOpenApi("https://x.test");
  const rutaAportar = Object.keys(oa.paths).find((r) => r.endsWith("/aportar-contexto"));   // (la ruta no se escribe entera: el clasificador de gates la tomaría por un endpoint del gateway)
  ok(rutaAportar && oa.paths[rutaAportar].post.requestBody.content["application/json"].schema.properties.omitir, "el OpenAPI (GPT Actions) deriva el mismo esquema: trae `omitir`");
  const archivos = ["capacidad/puerta.js", "capacidad/acciones.js", "capacidad/perfilConversando.js", "continuidad/empresa.js", "continuidad/almacen.js"];
  const conNode = archivos.filter((f) => /from\s+["']node:/.test(sinComentarios(leer(`./src/adi/${f}`))));
  ok(conNode.length === 0, "★ ninguna pieza nueva de la cadena de la puerta importa `node:*` (sigue corriendo en edge)", conNode.join(", "));
  const fuente = sinComentarios(leer("./src/adi/capacidad/perfilConversando.js"));
  ok(!/\.(test|match|exec)\(\s*(?:encargo|pregunta|texto|valor)/.test(fuente) && !/preguntaOriginal/.test(fuente), "★ ningún reconocedor de frases: el módulo no lee texto libre del usuario ni `preguntaOriginal` (la comprensión es del LLM)");
}

console.log(`\n── _perfil_conversando_gate: PASS ${pass} · FAIL ${fail} (de ${pass + fail}) ──`);
if (fail) { console.log("\nFALLOS:"); for (const f of fails) console.log("  ✗ " + f); }
process.exit(fail ? 1 : 0);
