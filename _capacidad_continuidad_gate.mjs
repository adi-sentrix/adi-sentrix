/* === _capacidad_continuidad_gate.mjs · EL HILO COMPLETO: capacidad + continuidad REAL (Etapa 3, corte 9, owner
 * 2026-09-26, offline). `_capacidad_gate.mjs` prueba las cuatro acciones con el catálogo sellado; `_continuidad_
 * gate.mjs` prueba `src/adi/continuidad/` en soledad, con hechos de fixture. Este candado es el ÚNICO que ejercita
 * las dos piezas YA CONECTADAS (`crearAcciones({continuidad})` con un almacén REAL, `src/adi/continuidad/almacen.js`)
 * a través de `consultar`/`aportarContexto`/`retomar` — el hilo que un anfitrión (Claude/ChatGPT) recorre de
 * verdad en una conversación con el Complemento.
 *
 * LO QUE SE CUBRE (encargo del supervisor, textual):
 *   1 · consultar → mismo conversacionId → la segunda Entrega reusa ids (el turno avanza, nunca se reinicia)
 *   2 · turno sin evento → cero texto de continuidad
 *   3 · cambio de versión de datos → una línea (y SOLO una)
 *   4 · aportarContexto declarado → pendiente de confirmar → confirmado (el origen NO cambia)
 *   5 · declarado contra "medido" (la boleta real) → los dos quedan visibles, ninguno pisa al otro
 *   6 · retomar → re-verificado (honesto: sin el índice de evidencia real conectado, declara el límite —
 *       nunca inventa un veredicto)
 *   7 · carnada «el LLM manda un tenant ajeno» → ignorado, tanto en `encargo.*` como en el argumento de la acción
 *   8 · carnada «un aporte sin confirmar usado como dato» → nunca en hechosAportados, siempre anunciado en
 *       pendientesDeConfirmar (owner 2026-09-26, ley «proponer es del modelo, confirmar es de la persona»)
 *
 * CERO llamadas a un LLM · CERO red · CERO ruta `/api/adi-*` (esa parte de la puerta la prueba `_puerta_gate.mjs`
 * — acá se entra por `crearAcciones` directo, sin HTTP, para que `clasificarFuente()` lo vea offline sin ambigüedad).
 * Solo por `npm run gates:offline` o `node --import ./scripts/offline-guard.mjs _capacidad_continuidad_gate.mjs`. */
import { initTenant } from "./src/data/tenantStore.js";
import { TENANT_DEMO } from "./src/data/tenants/demo.js";
import { crearAcciones } from "./src/adi/capacidad/acciones.js";
import { crearAlmacenEnMemoria } from "./src/adi/continuidad/almacen.js";

let pass = 0, fail = 0;
const fails = [];
const ok = (c, m, extra = "") => { if (c) { pass++; } else { fail++; fails.push(m + (extra ? " — " + extra : "")); console.log("  ✗ " + m + (extra ? "\n      " + extra : "")); } };
const H = (t) => console.log(`\n${t}`);

initTenant(TENANT_DEMO);
const TENANT_V1 = { id: "demo", nombre: "Distribuidora Demo", dataset: TENANT_DEMO, version: 1, sello: null };
const TENANT_V2 = { id: "demo", nombre: "Distribuidora Demo", dataset: TENANT_DEMO, version: 2, sello: null };
const ENCARGO_JUMBO_VENTAS = { version: "encargo/v1", partes: [{ id: "p1", tema: "comercial", cierre: "cifra", conceptos: ["ventas"], entidades: [{ nombre: "Jumbo" }] }] };

/* ═══ 1 · MISMO conversacionId → LA SEGUNDA ENTREGA REUSA IDS (el turno avanza, nunca se reinicia) ═══════════════ */
H("1 · consultar dos veces con el mismo conversacionId — el turno avanza, la conversación es UNA sola");
{
  const { consultar } = crearAcciones({ continuidad: crearAlmacenEnMemoria() });

  const r1 = await consultar({ tenant: TENANT_V1, encargo: ENCARGO_JUMBO_VENTAS });
  ok(r1.ok === true, "primera consulta responde ok:true", JSON.stringify(r1.noResuelto));
  ok(r1.continuidad.nueva === true, "la primera consulta abre una conversación NUEVA (no había conversacionId)");
  ok(typeof r1.continuidad.conversacionId === "string" && r1.continuidad.conversacionId.length > 0, "conversacionId emitido");
  ok(r1.continuidad.estadoVigente.turno === 1, "estadoVigente.turno = 1 tras la primera Entrega", String(r1.continuidad.estadoVigente.turno));

  const encargo2 = { ...ENCARGO_JUMBO_VENTAS, conversacionId: r1.continuidad.conversacionId };
  const r2 = await consultar({ tenant: TENANT_V1, encargo: encargo2 });
  ok(r2.ok === true, "segunda consulta (mismo conversacionId) responde ok:true", JSON.stringify(r2.noResuelto));
  ok(r2.continuidad.nueva === false, "la segunda consulta REUSA la conversación — nunca la declara nueva");
  ok(r2.continuidad.conversacionId === r1.continuidad.conversacionId, "el conversacionId es EXACTAMENTE el mismo entre ambas Entregas");
  ok(r2.continuidad.estadoVigente.turno === 2, "estadoVigente.turno = 2: el turno AVANZA, nunca se reinicia a 1", String(r2.continuidad.estadoVigente.turno));
  ok(r2.continuidad.estadoVigente.loEntregado.length === 2 && r2.continuidad.estadoVigente.loEntregado[0].startsWith("E1") && r2.continuidad.estadoVigente.loEntregado[1].startsWith("E2"), "el libro reusa la serie de ids E1…/E2… — nunca vuelve a E1 para la segunda Entrega", JSON.stringify(r2.continuidad.estadoVigente.loEntregado));
}

/* ═══ 2 · TURNO SIN EVENTO → CERO TEXTO DE CONTINUIDAD ═══════════════════════════════════════════════════════════ */
H("2 · turno sin evento (conversación nueva, misma versión de datos) → cero texto de continuidad");
{
  const { consultar } = crearAcciones({ continuidad: crearAlmacenEnMemoria() });
  const sinContinuidad = await consultar({ tenant: TENANT_V1, encargo: { version: "encargo/v1", partes: [{ id: "p1", tema: "comercial", cierre: "cifra", conceptos: ["ventas"], entidades: [{ nombre: "Jumbo" }] }] } });
  ok(sinContinuidad.ok === true, "consulta responde ok:true", JSON.stringify(sinContinuidad.noResuelto));
  const MARCAS_DE_EVENTO = ["los datos cambiaron desde la Entrega", "ya no vale lo mismo", "ya no está en los datos vigentes", "no coincide con lo entregado", "el criterio cambió: ahora ordena por", "sigue vivo el supuesto"];
  const conMarca = MARCAS_DE_EVENTO.filter((m) => sinContinuidad.entrega.texto.includes(m));
  ok(conMarca.length === 0, "ninguna de las cinco marcas de evento aparece en el texto — LEY: sin evento, cero texto de continuidad", conMarca.join(" · "));
  // abrir una conversación no es, por sí mismo, un evento de continuidad (no está en `TIPOS_DE_EVENTO`)
  ok(sinContinuidad.continuidad.nueva === true, "la conversación SÍ es nueva (dato estructurado), pero eso no imprime nada en el texto");
}

/* ═══ 3 · CAMBIO DE VERSIÓN DE DATOS → UNA LÍNEA (y solo una) ════════════════════════════════════════════════════ */
H("3 · la versión de datos cambia entre dos turnos de la MISMA conversación → una línea de la casa, antepuesta");
{
  const { consultar } = crearAcciones({ continuidad: crearAlmacenEnMemoria() });
  const r1 = await consultar({ tenant: TENANT_V1, encargo: ENCARGO_JUMBO_VENTAS });
  ok(r1.ok === true, "primer turno (versión 1) responde ok:true");

  const encargo2 = { ...ENCARGO_JUMBO_VENTAS, conversacionId: r1.continuidad.conversacionId };
  const r2 = await consultar({ tenant: TENANT_V2, encargo: encargo2 }); // MISMO dataset, versión declarada distinta
  ok(r2.ok === true, "segundo turno (versión 2, mismo conversacionId) responde ok:true");

  const primeraLinea = r2.entrega.texto.split("\n\n")[0];
  ok(primeraLinea.includes("los datos cambiaron desde la Entrega 1"), "la primera línea del texto declara el cambio de datos", primeraLinea);
  /* lenguaje empresarial (owner 2026-10-04, bloque 4): nunca ids de carga en la línea — ni «1 → 2», ni «v2», ni «versión» */
  ok(!/→|\bv\d+\b|versi[oó]n|versionId/i.test(primeraLinea), "★ la línea de consultar no muestra ids de carga («1 → 2», «v2», «versión»)", primeraLinea);
  // UNA línea: el resto del texto (a partir del segundo párrafo) es la Entrega tal cual — no se repite el aviso
  const resto = r2.entrega.texto.split("\n\n").slice(1).join("\n\n");
  ok(!resto.includes("los datos cambiaron"), "el aviso aparece UNA sola vez, nunca repetido en el cuerpo de la Entrega", resto.slice(0, 120));
}

/* ═══ 4 · aportarContexto: declarado → pendiente de confirmar → confirmado — EL ORIGEN NO CAMBIA ═══════════════ */
H("4 · aportarContexto: un valor que choca con otro declarado queda pendiente; confirmar lo resuelve sin tocar el origen");
{
  const { aportarContexto, conocerEmpresa } = crearAcciones({ continuidad: crearAlmacenEnMemoria() });

  // ley 2026-09-26 («proponer es del modelo, confirmar es de la persona»): el PRIMER declarado también nace
  // pendiente — nada se usa como dato antes de que la persona lo confirme.
  const a1 = await aportarContexto({ tenant: TENANT_V1, aportes: [{ clase: "criterio", concepto: "benchmark_propio_margen", valor: 28, unidad: "pct" }] });
  ok(a1.ok === true && a1.resultados[0].estado === "pendiente" && a1.resultados[0].paraConfirmar === true, "★ LEY 2026-09-26 · el primer declarado TAMBIÉN nace pendiente, sin colisión ni excepción", JSON.stringify(a1.resultados[0]));

  // un segundo valor para la MISMA llave choca IGUAL mientras el primero sigue sin confirmar (la colisión se
  // compara contra vigente Y contra pendiente — así "mismo aporte dos veces" nunca duplica filas al azar).
  const a2 = await aportarContexto({ tenant: TENANT_V1, conversacionId: a1.conversacionId, aportes: [{ clase: "criterio", concepto: "benchmark_propio_margen", valor: 32, unidad: "pct" }] });
  ok(a2.resultados[0].estado === "pendiente" && a2.resultados[0].paraConfirmar === true, "un valor DISTINTO de la misma llave nunca pisa en silencio: entra pendiente", JSON.stringify(a2.resultados[0]));
  ok(a2.resultados[0].conflictoCon === a1.resultados[0].id, "el pendiente declara CONTRA QUÉ hecho choca, aunque ese otro tampoco esté confirmado todavía");

  const a3 = await aportarContexto({ tenant: TENANT_V1, conversacionId: a1.conversacionId, aportes: [], confirmar: [a2.resultados[0].id] });
  ok(a3.confirmaciones[0].confirmado === true, "confirmar por id resuelve el conflicto");

  // `conocerEmpresa`/`memoriaDeEmpresa` publican solo VIGENTES (la historia completa —incluido el retirado— es
  // responsabilidad de `leerHistoria`, que `_continuidad_gate.mjs` ya prueba a nivel de `continuidad/` puro; acá
  // se comprueba lo que esta capa expone): el ÚNICO vigente es el valor NUEVO, y su origen sigue "declarado".
  const c1 = await conocerEmpresa({ tenant: TENANT_V1, conversacionId: a1.conversacionId });
  const memoria = c1.hechosAportados.filter((h) => h.concepto === "benchmark_propio_margen");
  ok(memoria.length === 1, "conocerEmpresa publica el vigente (el retirado ya no es \"lo que la empresa declara hoy\")", String(memoria.length));
  ok(Boolean(memoria[0]) && memoria[0].valor.raw === 32 && memoria[0].estado === "vigente", "el vigente, tras confirmar, es el valor NUEVO (32)", JSON.stringify(memoria[0]));
  ok(memoria[0].origen === "declarado", "★ LEY · el origen NUNCA cambia por confirmar: sigue \"declarado\" (nunca \"medido\")", memoria[0].origen);
}

/* ═══ 5 · UN DECLARADO CONTRA UN "MEDIDO" REAL (LA BOLETA) — LOS DOS QUEDAN, NINGUNO PISA AL OTRO ════════════════
 * Límite declarado (reportado al supervisor, `_ADI_CONTINUIDAD_INTEGRACION.md` §3): plegar `memoriaDeEmpresa()`
 * como FIGS con `.origen` dentro del libro de hechos del turno —para que un declarado que choca con un medido
 * dispare el hecho `discrepancia` de `notario/hechos.js`— es trabajo de `entrega/componer.js`, CONGELADO durante
 * esta etapa. Este corte prueba lo que SÍ puede garantizar sin tocarlo: los dos caminos (`aportarContexto` para lo
 * declarado, `consultar` para lo medido) conviven — ninguno lee, borra ni sobrescribe al otro. */
H("5 · un hecho declarado y una cifra medida de la MISMA entidad/concepto conviven — ninguno pisa al otro");
{
  const { aportarContexto, consultar } = crearAcciones({ continuidad: crearAlmacenEnMemoria() });

  // lo MEDIDO — la cifra real de la boleta para Jumbo, por el camino de siempre (consultar, sin tocar componerEntrega)
  const medido = await consultar({ tenant: TENANT_V1, encargo: ENCARGO_JUMBO_VENTAS });
  ok(medido.ok === true, "la cifra medida (boleta real) se sirve normalmente");
  const filaJumbo = medido.entrega.json.cifras.filas.find((f) => f.valores["Entidad / grupo"] === "Jumbo");
  ok(Boolean(filaJumbo) && filaJumbo.procedencia === "medido", "la fila de Jumbo declara su procedencia \"medido\"", JSON.stringify(filaJumbo));

  // lo DECLARADO — el usuario aporta SU PROPIA cifra de venta para Jumbo, en la MISMA conversación. Ley
  // 2026-09-26: nace "pendiente" (nadie lo confirmó todavía) — igual conviene con el medido sin bloquearse.
  const declarado = await aportarContexto({ tenant: TENANT_V1, conversacionId: medido.continuidad.conversacionId, aportes: [{ clase: "hecho", concepto: "ventas", entidad: "Jumbo", valor: 999999999, unidad: "clp" }] });
  ok(declarado.ok === true && declarado.resultados[0].estado === "pendiente" && declarado.resultados[0].paraConfirmar === true, "el declarado se registra (pendiente de confirmar) sin que el medido lo bloquee", JSON.stringify(declarado.resultados[0]));

  // AMBOS quedan visibles y NINGUNO se alteró: el medido sigue siendo la cifra de la boleta (no el 999999999
  // declarado) y el declarado sigue etiquetado "declarado" (nunca se promovió a "medido" por coincidir de concepto).
  const medidoDeNuevo = await consultar({ tenant: TENANT_V1, encargo: { ...ENCARGO_JUMBO_VENTAS, conversacionId: medido.continuidad.conversacionId } });
  const filaJumbo2 = medidoDeNuevo.entrega.json.cifras.filas.find((f) => f.valores["Entidad / grupo"] === "Jumbo");
  ok(filaJumbo2.valores["Valor"] === filaJumbo.valores["Valor"], "el medido NO cambió: el aporte declarado no reescribió la cifra de la boleta", `${filaJumbo.valores["Valor"]} vs ${filaJumbo2.valores["Valor"]}`);
  ok(declarado.resultados[0].entendido.valor === 999999999, "el declarado conserva SU valor tal cual se aportó (999999999), no el de la boleta");
}

/* ═══ 6 · RETOMAR → REVALIDADO DE VERDAD (Etapa 2, bloque 4 · owner 2026-10-04) ══════════════════════════════════════════════
 * Hasta el bloque 3 esta sección afirmaba el LÍMITE: sin el índice de evidencia real conectado, todo hecho volvía «sin_reverificar» y retomar lo
 * declaraba. El bloque 4 lo cierra: retomar le vuelve a hacer al Core, hoy, la misma pregunta que se le hizo entonces y compara cifra por cifra
 * (`continuidad/revalidar.js`). Ahora esta sección EXIGE la revalidación real — y que el límite de antes ya no se declare, porque ya no existe.
 * Los cuatro escenarios completos (otro período, benchmark declarado, cambios, priorización de lo que la línea nombra, carnadas) los prueba
 * `_retomar_revalida_gate.mjs`; acá se prueba lo que un anfitrión recorre en el hilo mínimo. */
H("6 · retomar sobre una conversación con Entregas — cada cifra REVALIDADA contra los datos de hoy (igual · cambió), sin el límite de antes");
{
  const { consultar, retomar } = crearAcciones({ continuidad: crearAlmacenEnMemoria() });
  const r1 = await consultar({ tenant: TENANT_V1, encargo: ENCARGO_JUMBO_VENTAS });
  const cid = r1.continuidad.conversacionId;
  await consultar({ tenant: TENANT_V1, encargo: { ...ENCARGO_JUMBO_VENTAS, conversacionId: cid } }); // segundo turno

  const ret = await retomar({ tenant: TENANT_V1, conversacionId: cid });
  ok(ret.ok === true, "retomar recupera la conversación", JSON.stringify(ret.motivo));
  ok(Array.isArray(ret.hechos) && ret.hechos.length > 0, "retomar trae los hechos entregados en los dos turnos", String(ret.hechos.length));
  ok(ret.hechos.every((h) => h.estadoReverificacion === "igual"), "★ REAL · con los mismos datos, TODA cifra entregada vuelve REVALIDADA como «igual» (se volvió a preguntar al Core: ya no es «sin_reverificar»)", JSON.stringify([...new Set(ret.hechos.map((h) => h.estadoReverificacion))]));
  ok(ret.resumen.total === ret.hechos.length && ret.resumen.igual === ret.hechos.length && ret.eventos.length === 0 && ret.lineaContinuidad === null, "el resumen cuadra y, sin nada que aclarar, cero línea de continuidad");
  ok(Array.isArray(ret.advertencias) && ret.advertencias.length === 0 && !JSON.stringify(ret).includes("no re-verifica"), "★ el límite de antes («este corte no re-verifica…») YA NO se declara: se revalidó de verdad, así que no hay nada que advertir", JSON.stringify(ret.advertencias));
  ok(ret.estadoVigente.turno === 2, "el estado vigente que trae retomar refleja los DOS turnos ya ocurridos");

  // una carga nueva (versión 2) con la venta de Jumbo distinta: la cifra CAMBIÓ, con las dos cifras, y una sola línea de la casa lo dice
  const datasetNuevo = JSON.parse(JSON.stringify(TENANT_DEMO));
  datasetNuevo.clientesVentas.find((c) => c.nombre === "Jumbo").actual = Math.round(14000 * 1.122);   /* una sola realidad (2026-10-06): la venta es SU actual (la tabla); se conserva la venta que este caso producía (14.000 × el 12,2 % que «bonanza» declaraba para Jumbo = $15.7M) */
  const ret2 = await retomar({ tenant: { ...TENANT_V2, dataset: datasetNuevo }, conversacionId: cid });
  const jumbo = ret2.hechos.find((h) => h.sujeto === "Jumbo" && h.estadoReverificacion === "cambio");
  ok(Boolean(jumbo) && jumbo.revalidacion.anterior.valor === "$17.3M" && jumbo.revalidacion.actual.valor === "$15.7M" && jumbo.revalidacion.diferencia.sentido === "baja", "★ REAL · con una carga nueva, la venta de Jumbo vuelve «cambio»: antes $17.3M, ahora $15.7M, la diferencia calculada por ADI", JSON.stringify(jumbo && jumbo.revalidacion));
  const sinLaLinea = (re) => !re.test(ret2.lineaContinuidad);
  ok(typeof ret2.lineaContinuidad === "string" && ret2.lineaContinuidad.split("\n").length === 1 && ret2.lineaContinuidad.includes("venta de Jumbo (antes $17.3M, ahora $15.7M)") && sinLaLinea(/\b(yo|te|usted)\b|→|versi/i), "una sola línea, en tercera persona y sin versiones de carga, dice qué cambió: «venta de Jumbo (antes $17.3M, ahora $15.7M)»", ret2.lineaContinuidad);
}

/* ═══ 7 · CARNADA · «el LLM manda un tenant ajeno» → IGNORADO, en el encargo Y en el aporte ═══════════════════════ */
H("7 · CARNADA · un tenant/tenantId colado en encargo.* o en aportes.* se ignora — el tenant SOLO sale del parámetro inyectado");
{
  const { consultar, aportarContexto } = crearAcciones({ continuidad: crearAlmacenEnMemoria() });

  // el LLM (o un adversario) agrega campos de tenant DENTRO del encargo tipado. `validarEncargo` ya rechaza
  // cualquier clave que no esté en `CAMPOS_RAIZ` (§4·0 del contrato: "version · partes · claves desconocidas — si
  // falla, PARA") — así que el intento ni siquiera llega a resolver una parte, mucho menos a cambiar de tenant:
  // se declara `campo_desconocido`, nunca se usa para decidir de qué empresa es la respuesta.
  const encargoConTenantAjeno = { ...ENCARGO_JUMBO_VENTAS, tenant: "empresa-ajena", tenantId: "otra-empresa-000", empresa: "Falabella Corp" };
  const rAjeno = await consultar({ tenant: TENANT_V1, encargo: encargoConTenantAjeno });
  ok(rAjeno.ok === false, "un encargo con campos de tenant colados se RECHAZA entero (esquema de la raíz) — no se cuela ni se usa", JSON.stringify(rAjeno.noResuelto));
  const motivos = (rAjeno.noResuelto || []).map((n) => n.motivo);
  ok(["tenant", "tenantId", "empresa"].every((k) => (rAjeno.noResuelto || []).some((n) => n.valor === k && n.motivo === "campo_desconocido")), "las tres claves ajenas quedan declaradas como \"campo_desconocido\", una por una", JSON.stringify(rAjeno.noResuelto));
  ok(!motivos.some((m) => /empresa-ajena|otra-empresa-000|Falabella/.test(JSON.stringify(rAjeno))), "el rechazo no repite el valor ajeno como si fuera válido (declara la CLAVE, no adopta el valor)");

  // el MISMO encargo, sin los campos colados, sirve la Entrega normal del tenant INYECTADO (demo, con Jumbo) —
  // la prueba de que lo único que decide la empresa servida es el parámetro `tenant`, nunca el encargo.
  const rLimpio = await consultar({ tenant: TENANT_V1, encargo: ENCARGO_JUMBO_VENTAS });
  ok(rLimpio.ok === true && rLimpio.entrega.texto.includes("Jumbo"), "sin los campos ajenos, el mismo encargo sirve la Entrega del tenant inyectado (demo, con Jumbo)");

  // un tenant colado DENTRO de un aporte (forma libre, sin el esquema estricto del encargo) tampoco se lee: sigue
  // sin existir un solo lugar de `acciones.js` que acepte "de qué empresa es esto" desde el cuerpo de la llamada.
  const aporteConTenantAjeno = await aportarContexto({ tenant: TENANT_V1, aportes: [{ clase: "hecho", concepto: "acuerdo_verbal", valor: "60 días", tenant: "empresa-ajena", tenantId: "otra-empresa-000" }] });
  ok(aporteConTenantAjeno.ok === true && aporteConTenantAjeno.resultados[0].estado !== "rechazado", "aportarContexto también ignora un tenant colado dentro de un aporte — declara el hecho igual", JSON.stringify(aporteConTenantAjeno.resultados[0]));
}

/* ═══ 8 · CARNADA · «un aporte sin confirmar usado como dato» → ROJO (owner 2026-09-26) ═══════════════════════════
 * La ley del corte: «un dato declarado o leído de un documento se devuelve para confirmar ANTES de usarlo».
 * Esta carnada prueba las dos caras: (a) un pendiente NUNCA aparece en `hechosAportados` de `conocerEmpresa`
 * (lo único que cuenta como "lo que la empresa ya sabe"); (b) SÍ aparece, aparte, en `pendientesDeConfirmar`,
 * anunciado como pendiente — nunca desaparece en silencio, nunca se confunde con dato. Si `hechosAportados`
 * alguna vez incluyera un pendiente, o `pendientesDeConfirmar` lo escondiera, esta sección se pone roja. */
H("8 · CARNADA · un aporte sin confirmar jamás cuenta como dato — solo aparece anunciado como pendiente");
{
  const { aportarContexto, conocerEmpresa } = crearAcciones({ continuidad: crearAlmacenEnMemoria() });

  const a1 = await aportarContexto({ tenant: TENANT_V1, aportes: [{ clase: "hecho", concepto: "plazo_de_pago_pactado", entidad: "Jumbo", valor: 90, unidad: "days" }] });
  ok(a1.ok === true && a1.resultados[0].estado === "pendiente", "el aporte nace pendiente (nadie lo confirmó)", JSON.stringify(a1.resultados[0]));

  const c1 = await conocerEmpresa({ tenant: TENANT_V1, conversacionId: a1.conversacionId });
  ok(!c1.hechosAportados.some((h) => h.concepto === "plazo_de_pago_pactado"), "★ CARNADA · el pendiente NUNCA aparece en hechosAportados (nunca cuenta como dato)", JSON.stringify(c1.hechosAportados.filter((h) => h.concepto === "plazo_de_pago_pactado")));
  ok(c1.pendientesDeConfirmar.some((h) => h.id === a1.resultados[0].id && h.concepto === "plazo_de_pago_pactado" && h.estado === "pendiente"), "el pendiente SÍ aparece, aparte, anunciado como \"pendiente de confirmar\" — nunca se esconde", JSON.stringify(c1.pendientesDeConfirmar));

  // confirmarlo lo mueve de una lista a la otra — recién ahí cuenta como dato
  const a2 = await aportarContexto({ tenant: TENANT_V1, conversacionId: a1.conversacionId, aportes: [], confirmar: [a1.resultados[0].id] });
  ok(a2.confirmaciones[0].confirmado === true, "confirmar promueve el pendiente");
  const c2 = await conocerEmpresa({ tenant: TENANT_V1, conversacionId: a1.conversacionId });
  ok(c2.hechosAportados.some((h) => h.concepto === "plazo_de_pago_pactado" && h.estado === "vigente"), "recién CONFIRMADO, el hecho pasa a hechosAportados (ahora sí cuenta como dato)", JSON.stringify(c2.hechosAportados.filter((h) => h.concepto === "plazo_de_pago_pactado")));
  ok(!c2.pendientesDeConfirmar.some((h) => h.concepto === "plazo_de_pago_pactado"), "y deja de aparecer en pendientesDeConfirmar (ya no hay nada que confirmar)");
}

console.log(`\n── _capacidad_continuidad_gate: PASS ${pass} · FAIL ${fail} (de ${pass + fail}) ──`);
if (fail) { console.log("\nFALLOS:"); for (const f of fails) console.log("  ✗ " + f); }
process.exit(fail ? 1 : 0);
