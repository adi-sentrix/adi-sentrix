/* === _continuidad_gate.mjs · LA CONTINUIDAD FACTUAL DE ADI (Etapa 2 · Carril B · owner 2026-09-25/26) ═══════════
 * Ejercita `src/adi/continuidad/{almacen,empresa,libro,estadoVigente,retomar}.js` con el adaptador EN MEMORIA
 * (`crearAlmacenEnMemoria`) — el mismo contrato que un futuro `crearAlmacenSupabase` cumpliría, nunca la base
 * real (`almacenSupabase.js` NO se importa acá, regla del repo).
 *
 * Lo que este candado prueba, ley por ley:
 *   · mismo aporte/encargo dos veces → mismos ids (determinismo, nunca azar)
 *   · versión de datos cambiada a mitad de conversación → se declara (evento + línea)
 *   · el anfitrión no devuelve el conversacionId → libro nuevo, memoria de empresa INTACTA
 *   · tope de 16 KB del libro → se recorta lo más viejo, NUNCA premisas ni criterio vigente
 *   · turno sin evento → cero texto de continuidad; turno con evento → UNA línea
 *   · una premisa falsa queda guardada CON su veredicto
 *   · un declarado frente a un "medido" (simulado) → los DOS quedan, nunca se pisan en silencio
 *   · la confirmación NUNCA cambia el origen
 *
 * CERO llamadas a un LLM, cero red: todo determinístico. Solo por `npm run gates:offline` (o
 * `node --import ./scripts/offline-guard.mjs _continuidad_gate.mjs`). */
import { crearAlmacenEnMemoria } from "./src/adi/continuidad/almacen.js";
import {
  CLASES_HECHO_EMPRESA, ORIGENES_HECHO_EMPRESA, ESTADOS_HECHO_EMPRESA, SELLOS_DOCUMENTO,
  claveDeHecho, declararHecho, confirmarHecho, retirarHecho, omitirCampo, yaFueOmitido,
  leerVigentes, leerHistoria, migrarLegado, memoriaDeEmpresa, hechoDePerfilCampo,
} from "./src/adi/continuidad/empresa.js";
import {
  VERSION_LIBRO, LIBRO_TOPE_BYTES, ENTREGAS_TOPE, SUPUESTOS_VIVOS_TOPE, tamanoBytes,
  emitirConversacionId, libroNuevo, detectarCambioVersion, registrarEntrega, actualizarCriterio,
  agregarSupuestoVivo, retirarSupuestoVivo, registrarPremisa, registrarOfertaEnPie, limpiarOfertasEnPie,
  registrarHechoAportado, recortarATope, DERIVACIONES_TOPE, registrarDerivacion, derivacionesDe,
} from "./src/adi/continuidad/libro.js";
import {
  ESTADO_VIGENTE_TOPE_BYTES, ESTADO_VIGENTE_TOPE_TEXTO, TIPOS_DE_EVENTO,
  estadoVigenteDe, estadoVigenteTextoCorto, eventosDeContinuidad, lineaDeContinuidad,
} from "./src/adi/continuidad/estadoVigente.js";
import { retomar } from "./src/adi/continuidad/retomar.js";

let PASS = 0, FAIL = 0;
const ok = (c, m, extra = "") => { if (c) { PASS++; console.log("  ✓ " + m); } else { FAIL++; console.log("  ✗ " + m + (extra ? "\n      " + extra : "")); } };
const H = (t) => console.log(`\n${t}`);
const TENANT = "bonanza";

/* ═══ 1 · EL VOCABULARIO ═══ */
H("1 · el vocabulario de la memoria de empresa y del libro");
ok(CLASES_HECHO_EMPRESA.join(",") === "perfil,criterio,hecho,documento", "las cuatro clases del hecho de empresa");
ok(ORIGENES_HECHO_EMPRESA.join(",") === "declarado,documento", "esta memoria SOLO admite declarado·documento (nunca medido·supuesto)");
ok(ESTADOS_HECHO_EMPRESA.join(",") === "pendiente,vigente,retirado,omitido", "los cuatro estados del ciclo de vida");
ok(SELLOS_DOCUMENTO.join(",") === "extraido,confirmado,verificado", "los tres sellos de un documento (REVISIÓN 3 §4)");
ok(VERSION_LIBRO === "libro/v1", "el libro se versiona");
ok(LIBRO_TOPE_BYTES === 16384 && ENTREGAS_TOPE === 12 && SUPUESTOS_VIVOS_TOPE === 3, "los topes del diseño v2 §B/§F: 16KB · 12 Entregas · 3 supuestos vivos");
ok(TIPOS_DE_EVENTO.length === 5 && TIPOS_DE_EVENTO.includes("datos_cambiaron") && TIPOS_DE_EVENTO.includes("supuesto_vivo_afecta"), "los cinco eventos de continuidad, ni uno más (REVISIÓN 3 §3)");

/* ═══ 2 · DETERMINISMO — el mismo aporte dos veces → los MISMOS ids, nunca dos filas nuevas al azar ═══ */
H("2 · mismo aporte dos veces → mismo id (nunca se pisa, nunca se duplica al azar)");
{
  const store = crearAlmacenEnMemoria();
  const aporte = { clase: "hecho", concepto: "benchmark_declarado", entidad: "Jumbo", valor: { raw: 25, unidad: "pct" } };
  const r1 = await declararHecho(store, TENANT, aporte, { actorLabel: "jc" });
  const r2 = await declararHecho(store, TENANT, aporte, { actorLabel: "jc" });
  ok(r1.ok && r2.ok, "las dos declaraciones se aceptan", JSON.stringify({ r1, r2 }));
  ok(r1.id === r2.id, "★ mismo id: la segunda vez es el MISMO hecho, no uno nuevo", `r1.id=${r1.id} r2.id=${r2.id}`);
  ok(r2.duplicado === true, "la segunda declaración se marca «duplicado» (mismo valor, no hay nada nuevo)");
  // ACTUALIZADA (owner 2026-09-26, ley «proponer es del modelo, confirmar es de la persona»): `declararHecho`
  // ya NO deja nada "vigente" al nacer — este aporte, sin confirmar, sigue "pendiente". La ley que este caso
  // prueba (mismo aporte dos veces → una sola fila, nunca dos al azar) sigue intacta: se verifica sobre el
  // TOTAL de filas de esa llave, no sobre `leerVigentes` (que hoy da 0, correctamente — nada se confirmó).
  ok((await leerVigentes(store, TENANT)).length === 0 && (await store.leerHechosEmpresa(TENANT)).length === 1, "sigue habiendo UNA sola fila con esa llave (pendiente, nadie la confirmó todavía)");
}
H("2b · determinismo de los ids del libro — E<n>.h<k>, nunca al azar");
{
  const base = registrarEntrega(libroNuevo({ conversacionId: "c1", versionId: "v7" }), { versionId: "v7", temas: ["comercial"], hechos: [{ sujeto: "Jumbo", metrica: "ventas" }] });
  const otraVezDesdeElMismoPunto = registrarEntrega(libroNuevo({ conversacionId: "c1", versionId: "v7" }), { versionId: "v7", temas: ["comercial"], hechos: [{ sujeto: "Jumbo", metrica: "ventas" }] });
  ok(base.entregas[0].hechos[0].id === "E1.h1" && otraVezDesdeElMismoPunto.entregas[0].hechos[0].id === "E1.h1", "★ el MISMO estado inicial produce el MISMO id (E1.h1), nunca un uuid al azar", JSON.stringify([base.entregas[0].hechos[0].id, otraVezDesdeElMismoPunto.entregas[0].hechos[0].id]));
}

/* ═══ 3 · CAMBIO DE VERSIÓN A MITAD DE CONVERSACIÓN — se declara, nunca en silencio ═══ */
H("3 · la versión de datos cambia a mitad de la conversación: se declara (evento + línea)");
{
  let libro = libroNuevo({ conversacionId: "c2", versionId: "v7" });
  libro = registrarEntrega(libro, { versionId: "v7", temas: ["comercial"], hechos: [{ sujeto: "Jumbo", metrica: "ventas" }] });
  ok(detectarCambioVersion(libro, "v7") === null, "sin cambio real, no hay nada que declarar");
  const cambio = detectarCambioVersion(libro, "v8");
  ok(!!cambio && cambio.de === "v7" && cambio.a === "v8" && cambio.desdeTurno === 1, "detecta el cambio v7→v8 desde la Entrega 1", JSON.stringify(cambio));
  const libro2 = registrarEntrega(libro, { versionId: "v8", temas: ["comercial"], hechos: [{ sujeto: "Jumbo", metrica: "ventas" }] });
  ok(libro2.datos.cambio && libro2.datos.cambio.de === "v7" && libro2.datos.cambio.a === "v8", "el libro DECLARA el cambio en `datos.cambio`");
  ok(libro2.entregas[0].versionId === "v7" && libro2.entregas[1].versionId === "v8", "★ los ids viejos quedan con SU versión (E1 sigue en v7, E2 ya en v8)");
  const eventos = eventosDeContinuidad({ cambioVersion: libro2.datos.cambio });
  ok(eventos.length === 1 && eventos[0].tipo === "datos_cambiaron", "el evento «datos_cambiaron» se arma solo");
  const linea = lineaDeContinuidad(eventos);
  ok(typeof linea === "string" && linea.includes("v7") && linea.includes("v8") && linea.split("\n").length === 1, "★ UNA sola línea, con las dos versiones nombradas", linea);
}

/* ═══ 4 · EL ANFITRIÓN NO DEVUELVE EL conversacionId — libro nuevo, memoria de empresa INTACTA ═══ */
H("4 · sin conversacionId devuelto: se abre un libro nuevo y la memoria de EMPRESA no pierde nada");
{
  const store = crearAlmacenEnMemoria();
  // ACTUALIZADA (owner 2026-09-26, ley «proponer es del modelo, confirmar es de la persona»): declarar YA no
  // deja nada vigente — para probar que la memoria de EMPRESA (lo que la empresa YA SABE, confirmado) sobrevive
  // a perder el libro, este caso confirma el criterio antes de "perder" la conversación (si se dejara pendiente,
  // seguiría sin ser dato — lo probado acá es otra cosa: que lo YA CONFIRMADO no depende del libro).
  const declarado = await declararHecho(store, TENANT, { clase: "criterio", concepto: "benchmark_margen", valor: { raw: 22, unidad: "pct" } }, { actorLabel: "jc", conversacionId: "c-vieja" });
  await confirmarHecho(store, TENANT, declarado.id, { actorLabel: "jc", resolverConflicto: true });
  const antes = await leerVigentes(store, TENANT);
  ok(antes.length === 1, "la empresa ya tiene un criterio declarado (y confirmado) antes de «perder» el libro");

  // el anfitrión no trae conversacionId: se emite uno NUEVO (nunca se reconstruye desde prosa)
  const libroPerdido = libroNuevo({ versionId: "v9" });
  const libroAnterior = registrarEntrega(libroNuevo({ conversacionId: "c-vieja", versionId: "v7" }), { versionId: "v7", temas: ["comercial"] });
  ok(libroPerdido.conversacionId !== "c-vieja" && !!libroPerdido.conversacionId, "id de conversación NUEVO, distinto del anterior", libroPerdido.conversacionId);
  ok(libroPerdido.entregas.length === 0 && libroPerdido.turno === 0, "★ el libro nuevo pierde el HISTORIAL de la conversación (eso sí se pierde)");

  const despues = await leerVigentes(store, TENANT);
  ok(despues.length === 1 && despues[0].concepto === "benchmark_margen" && despues[0].valor.raw === 22, "★ la memoria de EMPRESA sigue intacta: no se perdió el criterio declarado, solo el libro");
  void libroAnterior;
}

/* ═══ 5 · TOPE DE 16 KB — se recorta lo más viejo, NUNCA premisas ni criterio vigente ═══ */
H("5 · tope de 16KB: se esqueletizan las Entregas más viejas; premisas y criterio SOBREVIVEN siempre");
{
  let libro = libroNuevo({ conversacionId: "c3", versionId: "v1" });
  libro = actualizarCriterio(libro, { lente: "riesgo", origen: "usuario", alternativa: null });
  libro = registrarPremisa(libro, { id: "q1", hecho: { tipo: "orden", sujeto: "Lider", metrica: "ventas" }, veredicto: "falsa", verdadId: "hNa1" });
  // 30 Entregas "pesadas" para forzar el tope de tamaño (y también el tope de cantidad, ENTREGAS_TOPE=12)
  for (let i = 0; i < 30; i++) {
    libro = registrarEntrega(libro, {
      versionId: "v1", temas: ["comercial", "inventario", "cobranza"], entidades: ["Jumbo", "Falabella", "Lider", "Cencosud"],
      cierre: "lectura",
      hechos: Array.from({ length: 20 }, (_, k) => ({ sujeto: `Cliente${k}`, metrica: "ventas", valor: 12345.67 + k, unidad: "money", periodo: "2025-12-31", origen: "medido" })),
      universos: [{ eje: "cliente", top: { metrica: "ventas", k: 5 } }],
    });
  }
  ok(libro.entregas.length <= ENTREGAS_TOPE, `no más de ${ENTREGAS_TOPE} Entregas activas en el arreglo (dio ${libro.entregas.length})`);
  ok(tamanoBytes(libro) <= LIBRO_TOPE_BYTES, `★ el libro entero cabe en ${LIBRO_TOPE_BYTES} bytes (dio ${tamanoBytes(libro)})`, JSON.stringify({ bytes: tamanoBytes(libro) }));
  ok(libro.premisas.length === 1 && libro.premisas[0].id === "q1" && libro.premisas[0].veredicto === "falsa", "★ la premisa SIGUE completa, con su veredicto — el recorte nunca la tocó");
  ok(libro.criterioVigente && libro.criterioVigente.valor.lente === "riesgo", "★ el criterio vigente SIGUE completo — el recorte nunca lo tocó");
  const vieja = libro.entregas.find((e) => e.recortada);
  ok(!!vieja && Array.isArray(vieja.temas) && vieja.versionId === "v1" && vieja.hechos === undefined, "una Entrega vieja quedó como esqueleto {n, temas, versionId} — sin hechos ni universos", JSON.stringify(vieja));
  const nueva = libro.entregas[libro.entregas.length - 1];
  ok(!nueva.recortada && Array.isArray(nueva.hechos) && nueva.hechos.length === 20, "la Entrega más NUEVA conserva sus hechos completos");
}
H("5b · CARNADA · un libro artificialmente enorme jamás sacrifica premisas ni criterio");
{
  let libro = libroNuevo({ conversacionId: "c3b", versionId: "v1" });
  libro = actualizarCriterio(libro, { lente: "contribucion", origen: "usuario", alternativa: "riesgo" });
  for (let i = 0; i < 20; i++) libro = registrarPremisa(libro, { id: `q${i}`, hecho: { tipo: "cifra", sujeto: `Cliente${i}` }, veredicto: i % 2 ? "falsa" : "verdadera" });
  for (let i = 0; i < 50; i++) libro = registrarEntrega(libro, { versionId: "v1", temas: ["comercial"], hechos: [{ sujeto: `X${i}`, metrica: "ventas" }] });
  const antesDeRecortar = recortarATope(libro);
  ok(antesDeRecortar.premisas.length === 20, `★ CARNADA · las 20 premisas siguen TODAS (dio ${antesDeRecortar.premisas.length}) — un recorte que las tocara reventaría acá`);
  ok(!!antesDeRecortar.criterioVigente && antesDeRecortar.criterioVigente.valor.lente === "contribucion", "★ CARNADA · el criterio vigente sigue intacto");
}

/* ═══ 6 · CERO EVENTO → CERO TEXTO; CON EVENTO → UNA LÍNEA ═══ */
H("6 · un turno sin novedad no dice nada; un turno con novedad dice UNA línea");
{
  ok(eventosDeContinuidad({}).length === 0, "sin nada que declarar, cero eventos");
  ok(lineaDeContinuidad([]) === null, "★ cero eventos → línea NULA (no una cadena vacía, no un texto de relleno)");
  ok(lineaDeContinuidad(eventosDeContinuidad({})) === null, "el camino completo (armar + redactar) también da null sin eventos");

  const eventos = eventosDeContinuidad({
    cifrasReverificadas: [{ id: "E1.h1", label: "Jumbo · Ventas", estado: "cambio", valorNuevo: "$110K" }],
    premisasFalsas: [{ id: "q1", texto: "Lider es el de mayor venta" }],
    criterioCambio: { de: "riesgo", a: "contribución" },
    supuestosVivosRelevantes: [{ id: "s1", texto: "Jumbo · precio +5% (E3)" }],
  });
  ok(eventos.length === 4, `cuatro eventos distintos declarados (dio ${eventos.length})`);
  const linea = lineaDeContinuidad(eventos);
  ok(typeof linea === "string" && linea.split("\n").length === 1, "★ TODOS los eventos del turno caben en UNA sola línea (nunca una por evento)", linea);
  ok(/Ventas/.test(linea) && /Lider/.test(linea) && /contribución/.test(linea) && /precio/.test(linea), "la línea nombra las cuatro novedades", linea);
}

/* ═══ 7 · PREMISA FALSA — queda guardada CON su veredicto, nunca cambia la conclusión ═══ */
H("7 · una premisa falsa queda en el libro con su veredicto (nunca se adopta, nunca desaparece)");
{
  let libro = libroNuevo({ conversacionId: "c4", versionId: "v1" });
  libro = registrarPremisa(libro, { id: "q1", hecho: { tipo: "orden", sujeto: "Lider" }, veredicto: null });
  const estado1 = estadoVigenteDe(libro);
  ok(estado1.premisasPendientes.includes("q1"), "mientras no tiene veredicto, aparece como PENDIENTE en el estado vigente");
  libro = registrarPremisa(libro, { id: "q1", hecho: { tipo: "orden", sujeto: "Lider" }, veredicto: "falsa", verdadId: "hNa1" });
  ok(libro.premisas.length === 1 && libro.premisas[0].veredicto === "falsa" && libro.premisas[0].verdadId === "hNa1", "el veredicto se actualiza sobre la MISMA premisa (no se duplica)");
  const estado2 = estadoVigenteDe(libro);
  ok(!estado2.premisasPendientes.includes("q1"), "ya con veredicto, deja de estar «pendiente»");
}

/* ═══ 8 · UN DECLARADO FRENTE A UN «MEDIDO» — los DOS quedan, nunca se pisan en silencio ═══ */
H("8 · un declarado frente a un hecho de origen «medido» — los DOS sobreviven, ninguno se pisa");
{
  const store = crearAlmacenEnMemoria();
  // se simula lo que un futuro productor (o una migración de datos real) dejaría en la tabla: un hecho "medido"
  // — hoy `declararHecho` NUNCA produce uno (ver §9), pero la ley tiene que sostenerse igual si algo lo trajera.
  const medido = await store.guardarHechoEmpresa(TENANT, {
    id: "h-medido-1", clase: "hecho", concepto: "margen_del_periodo", entidad: "Jumbo", periodo: "2025-12",
    valor: { raw: 21.5, unidad: "pct" }, origen: "medido", documento: null, confirmacion: null,
    estado: "vigente", declaradoEn: new Date().toISOString(), actorLabel: null, conversacionId: null, reemplaza: null,
  });
  const r = await declararHecho(store, TENANT, { clase: "hecho", concepto: "margen_del_periodo", entidad: "Jumbo", periodo: "2025-12", valor: { raw: 25, unidad: "pct" } }, { actorLabel: "jc" });
  ok(r.ok && r.estado === "pendiente" && r.conflictoCon === medido.id, "★ el declarado entra «pendiente», señalando el conflicto — NUNCA pisa al medido", JSON.stringify(r));
  const todos = await store.leerHechosEmpresa(TENANT);
  const sigueMedido = todos.find((h) => h.id === medido.id);
  ok(sigueMedido && sigueMedido.estado === "vigente" && sigueMedido.valor.raw === 21.5, "★ el «medido» sigue VIGENTE, sin tocar — los DOS quedan");
  const declaradoNuevo = todos.find((h) => h.id === r.id);
  ok(declaradoNuevo && declaradoNuevo.origen === "declarado" && declaradoNuevo.valor.raw === 25, "★ el declarado nuevo TAMBIÉN queda, con su propio valor y su propio origen");
}

/* ═══ 9 · POR CONSTRUCCIÓN, ESTA MEMORIA NUNCA PRODUCE UN «MEDIDO» ═══ */
H("9 · CARNADA · esta memoria NUNCA acepta declarar un hecho de origen «medido» o «supuesto»");
{
  const store = crearAlmacenEnMemoria();
  const r1 = await declararHecho(store, TENANT, { clase: "hecho", concepto: "x", valor: { raw: 1 }, origen: "medido" });
  const r2 = await declararHecho(store, TENANT, { clase: "hecho", concepto: "x", valor: { raw: 1 }, origen: "supuesto" });
  ok(r1.ok === false && /origen/.test(r1.motivo), "★ CARNADA · «medido» se RECHAZA de raíz", r1.motivo);
  ok(r2.ok === false && /origen/.test(r2.motivo), "★ CARNADA · «supuesto» se RECHAZA de raíz (eso es del motor de escenarios, no de la empresa)", r2.motivo);
  ok((await leerVigentes(store, TENANT)).length === 0, "nada quedó guardado de los dos intentos rechazados");
}

/* ═══ 10 · LA CONFIRMACIÓN NUNCA CAMBIA EL ORIGEN ═══ */
H("10 · confirmar un hecho declarado lo deja declarado — la confirmación es un sello aparte");
{
  const store = crearAlmacenEnMemoria();
  const r = await declararHecho(store, TENANT, { clase: "documento", concepto: "plazo_de_pago", entidad: "Jumbo", valor: { raw: 45, unidad: "days" }, origen: "documento", documento: { nombre: "Contrato Jumbo 2026", tipo: "contrato", parte: "cláusula 4", extraidoPor: "anfitrion", sello: "extraido" } });
  ok(r.ok && r.entendido.origen === "documento", "nace con origen «documento»");
  const c = await confirmarHecho(store, TENANT, r.id, { actorLabel: "jc", medio: "chat-anfitrion" });
  ok(c.ok && c.entendido.origen === "documento", "★ tras confirmar, el ORIGEN sigue siendo «documento» — nunca pasa a «medido» ni a «declarado»");
  ok(c.entendido.confirmacion && c.entendido.confirmacion.por === "jc" && c.entendido.confirmacion.medio === "chat-anfitrion", "el sello de confirmación queda completo (quién, cuándo, medio, sobre qué)");
  ok(c.entendido.valor.raw === 45, "el VALOR tampoco cambia al confirmar");
}
H("10b · confirmar resolviendo un conflicto pendiente promueve a vigente y retira al viejo");
{
  const store = crearAlmacenEnMemoria();
  const v1 = await declararHecho(store, TENANT, { clase: "criterio", concepto: "benchmark_margen", valor: { raw: 22, unidad: "pct" } });
  const v2 = await declararHecho(store, TENANT, { clase: "criterio", concepto: "benchmark_margen", valor: { raw: 25, unidad: "pct" } });
  ok(v2.estado === "pendiente" && v2.conflictoCon === v1.id, "el segundo choca con el primero: pendiente");
  const c = await confirmarHecho(store, TENANT, v2.id, { actorLabel: "jc", resolverConflicto: true });
  ok(c.ok && c.entendido.estado === "vigente" && c.entendido.origen === "declarado", "al confirmar con `resolverConflicto`, pasa a vigente — el origen SIGUE siendo declarado");
  const viejo = (await store.leerHechosEmpresa(TENANT)).find((h) => h.id === v1.id);
  ok(viejo.estado === "retirado", "el viejo queda retirado (con su historia, nunca borrado)");
  ok((await leerVigentes(store, TENANT, { concepto: "benchmark_margen" })).length === 1, "una sola vigente para esa llave, al final");
}

/* ═══ 11 · RETIRAR — nunca borra ═══ */
H("11 · retirar un hecho lo marca «retirado», nunca lo borra (queda como historia)");
{
  const store = crearAlmacenEnMemoria();
  const r = await declararHecho(store, TENANT, { clase: "hecho", concepto: "nota", valor: { texto: "algo" } });
  const ret = await retirarHecho(store, TENANT, r.id, { motivo: "ya no aplica", actorLabel: "jc" });
  ok(ret.ok && ret.entendido.estado === "retirado", "queda retirado");
  ok((await leerVigentes(store, TENANT)).length === 0, "ya no aparece entre los vigentes");
  ok((await leerHistoria(store, TENANT)).some((h) => h.id === r.id), "★ pero SIGUE en la historia — nunca desaparece");
}

/* ═══ 12 · «PREFIERO NO DECIRLO» — no se vuelve a preguntar en la misma conversación ═══ */
H("12 · un campo omitido no se vuelve a preguntar en la MISMA conversación");
{
  const store = crearAlmacenEnMemoria();
  await omitirCampo(store, TENANT, { clase: "hecho", concepto: "margen_objetivo" }, { actorLabel: "jc", conversacionId: "c5" });
  ok(await yaFueOmitido(store, TENANT, { concepto: "margen_objetivo" }, { conversacionId: "c5" }), "en la misma conversación, ya fue omitido");
  ok(!(await yaFueOmitido(store, TENANT, { concepto: "margen_objetivo" }, { conversacionId: "c6" })), "en OTRA conversación, sin marca «para siempre», puede volver a preguntarse");
}

/* ═══ 13 · MIGRACIÓN EN LECTURA — diario (007) y contexto (011), sin perder nada ═══ */
H("13 · migrarLegado/memoriaDeEmpresa traducen diario y contexto sin perder nada, y no duplican lo ya migrado");
{
  const legado = {
    diario: { tesis: { clave: "volumen-jumbo", resumen: "el volumen de Jumbo es apuesta comercial, no accidente", fecha: "2026-09-01", carga: 3, origenTurno: "c-vieja" }, intenciones: [{ cita: "vamos a sostener el precio con Falabella", pregunta: "sostener precio", entidades: ["Falabella"], fecha: "2026-09-02", carga: 3 }] },
    contexto: { texto: "Empresa distribuidora de consumo masivo, foco en cuentas grandes.", fecha: "2026-08-20" },
  };
  const traducidos = migrarLegado(legado);
  ok(traducidos.length === 3, `tres hechos traducidos: tesis + 1 intención + contexto (dio ${traducidos.length})`);
  ok(traducidos.every((h) => h.origen === "declarado" && ORIGENES_HECHO_EMPRESA.includes(h.origen)), "todos entran como «declarado» (nunca medido)");
  ok(traducidos.some((h) => h.concepto === "tesis_de_la_relacion" && /Jumbo/.test(h.valor.texto)), "la tesis viaja completa");
  ok(traducidos.some((h) => h.concepto === "contexto_del_negocio" && /distribuidora/.test(h.valor.texto)), "el contexto viaja completo");

  const store = crearAlmacenEnMemoria();
  const mem1 = await memoriaDeEmpresa(store, TENANT, { legado });
  ok(mem1.hechos.length === 3, "sin nada migrado todavía, la vista unificada trae los tres del legado");

  // ahora se "migra de verdad" la tesis (una fila real en la tabla, con `migradoDeLegado`)
  await store.guardarHechoEmpresa(TENANT, { ...traducidos[0], id: "h-tesis-1" });
  const mem2 = await memoriaDeEmpresa(store, TENANT, { legado });
  ok(mem2.hechos.length === 3, "★ sigue siendo TRES (la tesis ya no se duplica: una real + dos traducidas al vuelo)");
  ok(mem2.hechos.filter((h) => h.concepto === "tesis_de_la_relacion").length === 1, "ni una tesis de más, ni una de menos");
}

/* ═══ 14 · EL PERFIL SE PLIEGA (solo lectura) SIN CONFUNDIR VOCABULARIOS ═══ */
H("14 · hechoDePerfilCampo traduce el vocabulario de `tenants` sin escribir nada");
{
  const declarado = hechoDePerfilCampo("sector", { codigo: "distribucion", procedencia: "medido" }); // 012: 'medido' = lo tipeó el usuario
  const derivado = hechoDePerfilCampo("tamano_banda", { codigo: "mediana", procedencia: "derivado" }); // 012: 'derivado' = lo calculó el motor
  ok(declarado.origen === "declarado", "«medido» de tenants (=lo declaró el usuario) se pliega como «declarado»");
  ok(derivado.origen === "medido", "«derivado» de tenants (=lo calculó el motor) se pliega como «medido» (es una medición real de ADI)");
  ok(declarado.soloLectura === true && derivado.soloLectura === true, "★ ambos vienen marcados «solo lectura»: esta función nunca persiste nada");
  ok(hechoDePerfilCampo("sector", { codigo: null }) === null, "sin código, no hay hecho que plegar");
}

/* ═══ 15 · RETOMAR — hechos re-verificados, sin recomponer prosa; sin verificador, falla CERRADO ═══ */
H("15 · retomar: hechos con id, re-verificados contra la versión activa — nunca se inventa un veredicto");
{
  let libro = libroNuevo({ conversacionId: "c7", versionId: "v7" });
  libro = registrarEntrega(libro, { versionId: "v7", temas: ["comercial"], hechos: [{ sujeto: "Jumbo", metrica: "ventas", valor: 100000, unidad: "money" }, { sujeto: "Falabella", metrica: "ventas", valor: 50000, unidad: "money" }] });

  const sinVerificador = retomar(libro, { versionIdActual: "v7" });
  ok(sinVerificador.hechos.every((h) => h.estadoReverificacion === "sin_reverificar"), "★ sin verificador inyectado, TODO queda «sin_reverificar» — nunca se adivina «igual»");
  ok(sinVerificador.eventos.length === 0 && sinVerificador.lineaContinuidad === null, "sin cambio de versión y sin verificador, no hay evento que declarar todavía");

  const reverificar = (h) => {
    if (h.sujeto === "Jumbo") return { estado: "cambio", valorNuevo: "$110K" };
    if (h.sujeto === "Falabella") return { estado: "ya_no_existe" };
    return { estado: "igual" };
  };
  const conVerificador = retomar(libro, { versionIdActual: "v8", reverificar });
  ok(conVerificador.hechos.find((h) => h.sujeto === "Jumbo").estadoReverificacion === "cambio", "Jumbo: cambió, con su valor nuevo");
  ok(conVerificador.hechos.find((h) => h.sujeto === "Falabella").estadoReverificacion === "ya_no_existe", "Falabella: ya no existe en la versión activa");
  ok(conVerificador.eventos.some((e) => e.tipo === "datos_cambiaron") && conVerificador.eventos.filter((e) => e.tipo === "cifra_cambio").length === 2, "eventos: el cambio de versión + las DOS cifras que cambiaron");
  ok(typeof conVerificador.lineaContinuidad === "string" && conVerificador.lineaContinuidad.split("\n").length === 1, "★ todo en UNA línea", conVerificador.lineaContinuidad);
  ok(conVerificador.estadoVigente.conversacionId === "c7", "el estado vigente viaja junto al retomar");
}

/* ═══ 16 · TAMAÑOS — estado vigente ≤2KB, texto corto ≤900 caracteres ═══ */
H("16 · el estado vigente cabe en 2KB y su síntesis en 900 caracteres, aun con un libro grande");
{
  let libro = libroNuevo({ conversacionId: "c8", versionId: "v1" });
  libro = actualizarCriterio(libro, { lente: "riesgo", origen: "usuario" });
  for (let i = 0; i < 3; i++) libro = agregarSupuestoVivo(libro, { id: `s${i}`, concepto: "precio", delta: 5, unidad: "pct", alcance: { nombre: `Cliente${i}` } });
  for (let i = 0; i < 12; i++) libro = registrarEntrega(libro, { versionId: "v1", temas: ["comercial", "inventario"], entidades: [`Cliente${i}`], cierre: "lectura", hechos: [{ sujeto: `Cliente${i}`, metrica: "ventas" }] });
  const ev = estadoVigenteDe(libro, { versionIdActual: "v1" });
  ok(new TextEncoder().encode(JSON.stringify(ev)).length <= ESTADO_VIGENTE_TOPE_BYTES, `estado vigente ≤ ${ESTADO_VIGENTE_TOPE_BYTES} bytes`, JSON.stringify(ev).length);
  const texto = estadoVigenteTextoCorto(ev);
  ok(texto.length <= ESTADO_VIGENTE_TOPE_TEXTO, `síntesis en texto ≤ ${ESTADO_VIGENTE_TOPE_TEXTO} caracteres (dio ${texto.length})`);
  ok(ev.supuestosVivos.length === 3, "los 3 supuestos vivos siguen visibles en el estado vigente");
}

/* ═══ 17 · SUPUESTOS VIVOS — tope 3, FIFO; y se pueden retirar explícitamente ═══ */
H("17 · supuestos vivos: tope 3, el más nuevo primero; retirar es explícito");
{
  let libro = libroNuevo({ conversacionId: "c9" });
  for (let i = 0; i < 5; i++) libro = agregarSupuestoVivo(libro, { id: `s${i}`, concepto: "precio", delta: i, unidad: "pct" });
  ok(libro.supuestosVivos.length === SUPUESTOS_VIVOS_TOPE, `nunca más de ${SUPUESTOS_VIVOS_TOPE} (dio ${libro.supuestosVivos.length})`);
  ok(libro.supuestosVivos[0].id === "s4", "el más nuevo queda primero");
  ok(!libro.supuestosVivos.some((s) => s.id === "s0" || s.id === "s1"), "los dos más viejos se cayeron (FIFO)");
  const sinS4 = retirarSupuestoVivo(libro, "s4");
  ok(!sinS4.supuestosVivos.some((s) => s.id === "s4"), "retirar uno explícito lo saca aunque sea el más nuevo");
}

/* ═══ 18 · OFERTAS EN PIE Y HECHOS APORTADOS — referencias, nunca copias ═══ */
H("18 · ofertas en pie y hechos aportados son referencias, sin duplicar");
{
  let libro = libroNuevo({ conversacionId: "c10" });
  libro = registrarOfertaEnPie(libro, { texto: "el cruce por SKU entre venta e inventario", encargoSugerido: { partes: [{ tema: "inventario", cierre: "lectura" }] } });
  ok(libro.ofertasEnPie.length === 1, "la oferta queda registrada");
  libro = limpiarOfertasEnPie(libro);
  ok(libro.ofertasEnPie.length === 0, "se limpia cuando el turno siguiente ya no la repite");
  libro = registrarHechoAportado(libro, "h-abc-1");
  libro = registrarHechoAportado(libro, "h-abc-1");
  ok(libro.hechosAportados.length === 1, "el mismo id aportado dos veces no se duplica");
}

/* ═══ 19 · LAS DERIVACIONES DEL LIBRO (Contrato del Anfitrión, paso 1 · owner 2026-10-05) ═══ */
H("19 · derivaciones `D<k>`: ids estables tras el recorte, aditivas y sin tocar al libro de siempre");
{
  ok(DERIVACIONES_TOPE === 24, "el tope de derivaciones es 24");
  let libro = libroNuevo({ conversacionId: "c-der" });
  ok(!("derivaciones" in libro) && !("nDerivaciones" in libro), "★ un libro nuevo NO trae el campo (un libro sin derivaciones es el de siempre)");
  ok(derivacionesDe(libro).length === 0 && derivacionesDe(null).length === 0, "derivacionesDe de un libro sin el campo es vacío");
  libro = registrarEntrega(libro, { versionId: "v1", temas: ["comercial"], hechos: [{ sujeto: "A", metrica: "Venta", valor: "$1M" }] });
  const antes = JSON.stringify(libro);
  ok(JSON.stringify(recortarATope(libro)) === antes, "★ recortarATope de un libro sin derivaciones es byte-idéntico");
  libro = registrarDerivacion(libro, { operacion: "suma", sobre: ["E1.h1", "E1.h2"], resultado: { raw: 3, unidad: "money", clave: "ventas", texto: "$3" } });
  ok(libro.derivaciones.length === 1 && libro.derivaciones[0].id === "D1" && libro.nDerivaciones === 1 && libro.derivaciones[0].turno === 1, "la primera derivación es D1, con el turno vigente");
  ok(libro.turno === 1 && libro.entregas.length === 1 && libro.entregas[0].hechos[0].id === "E1.h1", "★ derivar no avanza el turno ni mueve ningún E<n>.h<k>");
  for (let i = 0; i < 30; i++) libro = registrarDerivacion(libro, { operacion: "suma", sobre: ["E1.h1", "E1.h2"], resultado: { raw: i, unidad: "money", clave: "ventas", texto: `$${i}` } });
  ok(libro.derivaciones.length === DERIVACIONES_TOPE && libro.derivaciones[0].id === "D8" && libro.derivaciones[libro.derivaciones.length - 1].id === "D31", "★ pasado el tope se quita la más vieja y los ids siguen: quedan D8…D31", libro.derivaciones.map((d) => d.id).join(","));
  libro = registrarDerivacion(libro, { operacion: "suma", sobre: ["E1.h1", "E1.h2"], resultado: { raw: 1, unidad: "money", clave: "ventas", texto: "$1" } });
  ok(libro.derivaciones[libro.derivaciones.length - 1].id === "D32" && libro.nDerivaciones === 32, "★ un id jamás se reutiliza aunque se haya recortado");
  /* un libro guardado antes (sin contador) arranca de lo que tenga */
  const viejo = { ...libroNuevo({ conversacionId: "c-viejo" }), derivaciones: [{ id: "D1" }, { id: "D2" }] };
  ok(registrarDerivacion(viejo, { operacion: "suma", sobre: [] }).derivaciones[2].id === "D3", "sin contador, el id sigue de lo que el libro ya tiene");
  /* el tope de bytes: las derivaciones más viejas ceden, la más nueva queda */
  let grande = libroNuevo({ conversacionId: "c-grande" });
  for (let i = 0; i < 24; i++) grande = registrarDerivacion(grande, { operacion: "suma", sobre: ["E1.h1"], entidad: `${i}-${"x".repeat(1200)}`, resultado: { raw: i } });   // textos DISTINTOS: la forma guardada escribe una sola vez lo repetido (`comprimirLibro`), así que 24 iguales ya no llenan los 16 KB
  ok(tamanoBytes(grande) <= LIBRO_TOPE_BYTES && grande.derivaciones[grande.derivaciones.length - 1].id === "D24" && grande.derivaciones.length < 24, "★ si el libro excede 16 KB ceden las derivaciones más viejas y la más nueva se conserva", `${tamanoBytes(grande)} B · ${grande.derivaciones.length}`);
  ok(grande.premisas.length === 0 && grande.criterioVigente === null, "(control) las premisas y el criterio no se tocan");
}

console.log(`\n── _continuidad_gate: ${PASS} PASS · ${FAIL} FAIL (de ${PASS + FAIL}) ──`);
if (FAIL > 0) process.exit(1);
