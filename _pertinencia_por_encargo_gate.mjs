/* === _pertinencia_por_encargo_gate.mjs · PERTINENCIA POR ENCARGO (owner 2026-09-24, diseño aprobado) ═══════════
 * Prueba el diseño de `pertinencia_por_encargo_diseno.md` (scratchpad, leído entero antes de implementar):
 *   · Sujeto = cuentas nombradas por el USUARIO (`entidadesDeLaPregunta`) + las que nombra el PROCEDIMIENTO
 *     (`entidadesEnRespuesta`). Sin nombres → sujeto abierto.
 *   · Principal = la pieza cuyo dominio ES el del encargo — bloque completo; cada cuenta del sujeto lleva línea
 *     completa, incluso bajo el piso; pregunta abierta → todas las señales del dominio completas.
 *   · Mención breve = una oración (nombre + cifra), sin encabezado ni cierre, solo sobre cuentas nombradas por
 *     el USUARIO, de una pieza de OTRO dominio.
 *   · Disponible = el resto de una pieza que no es del encargo → UNA oferta por pieza en «Qué más puedo
 *     calcular», con cifra-gancho verificada.
 *   · PRI-04 en preguntas abiertas (cambio aprobado, textual: «Sí, apruebo la regla y el cambio en preguntas
 *     abiertas.») — con sujeto abierto y encargo de cobranza, PRI-04 se sirve como principal.
 *
 * Las SEIS carnadas del diseño, en orden:
 *   1 · toda señal del turno en exactamente uno de prosa principal / mención / oferta.
 *   2 · Sodimac en la pregunta de margen (dominio comercial) NO tiene línea completa (no es sujeto, la pieza que
 *       la nombraría —PRI-04— es de otro dominio, y su compañera CAU-01 la compacta por no ser sujeto).
 *   3 · la cobranza de Lider (pregunta de solo cobranza) NO sirve el bloque de carga (CAU-01 no aparece).
 *   4 · pregunta abierta con dos dominios: las dos piezas principales, TODAS las señales completas — la
 *       cobranza NO desaparece con sujeto vacío.
 *   5 · el gancho de cada oferta verifica en el libro de hechos (mismo hechoId que ya certificó `medirPieza`).
 *   6 · `no_implica` viaja en cada mención (una vez, sin duplicar).
 *
 * CAU-01 sigue en BORRADOR (`piezas.js` — el owner no la firmó): todas las pruebas usan un CLON firmado SOLO en
 * memoria (`{ ...piezaPorId("CAU-01"), estado: "firmada", firma: {...} }`), nunca el archivo real. PRI-04 SÍ está
 * firmada de verdad — sus reglas de pertinencia se leen del catálogo real, salvo la tercera rama nueva (§9 del
 * diseño), que también viaja en `piezas.js` con el textual del owner.
 *
 * Solo por `npm run gates:offline` (o `node --import ./scripts/offline-guard.mjs _pertinencia_por_encargo_gate.mjs`). */
import { initTenant } from "./src/data/tenantStore.js";
import { TENANT_DEMO } from "./src/data/tenants/demo.js";
import { ESCENARIO_INICIAL } from "./src/config/scenarios.js";
import { construirPerfilCliente } from "./src/config/contract/perfilCliente.js";
import { PIEZAS_CONOCIMIENTO, piezaPorId } from "./src/adi/conocimiento/piezas.js";
import { referenciaDelOficioConOfertas, _evaluarInfraestructura } from "./src/adi/conocimiento/seleccionar.js";
import { resultadosCargaVsResto, resultadosPisoDeCobranza, coberturaCargaVsResto } from "./src/adi/conocimiento/medir.js";
import { construirTablaDeSenales } from "./src/adi/conocimiento/tablaSenales.js";
import { servirBloqueCargaVsResto } from "./src/adi/conocimiento/servir.js";
import {
  componerEntregaBrechaComercial,
  componerEntregaCobranza,
  componerEntregaMultidominio,
} from "./src/adi/entrega/componer.js";

let pass = 0, fail = 0;
const ok = (c, m, extra = "") => { if (c) { pass++; console.log("  ✓ " + m); } else { fail++; console.log("  ✗ " + m + (extra ? "\n      " + extra : "")); } };
const H = (t) => console.log(`\n${t}`);

const TENANT_PERFIL_COMPLETO = {
  ...TENANT_DEMO,
  perfil: {
    ...TENANT_DEMO.perfil,
    sector: { valor: "distribucion", procedencia: "medido" },
    tipoProducto: { valor: "durable", procedencia: "medido" },
    pais: { valor: "CL", procedencia: "medido" },
    modeloComercial: { valor: "cuentas_grandes", procedencia: "medido" },
  },
};
const PERFIL_COMPLETO = construirPerfilCliente(TENANT_PERFIL_COMPLETO);
initTenant(TENANT_PERFIL_COMPLETO);

const CAU01 = piezaPorId("CAU-01");
const PRI04 = piezaPorId("PRI-04");
const CAU01_FIRMADA = { ...CAU01, estado: "firmada", firma: { por: "_pertinencia_por_encargo_gate.mjs — CLON DE PRUEBA", fecha: "2026-09-24" } };
const CATALOGO = [CAU01_FIRMADA, PRI04];

const A_PREGUNTA = "¿Por qué Falabella, Lider y Jumbo están bajo el benchmark de margen?";
const A_NOMBRADAS = ["Falabella", "Lider", "Jumbo"];
const B_PREGUNTA = "¿Cómo está la cobranza de Lider?";
// la pregunta LITERAL del diseño para C ("¿Qué cuentas merecen atención primero por carga comercial y
// cobranza?") no dispara `componerEntregaMultidominio` real: `partesDelEncargo.js` (léxico existente, sin
// tocar) exige >=12 palabras y >=3 marcas interrogativas para reconocer un encargo de 2+ partes, y "carga
// comercial" nunca dispara una parte por sí sola (solo aparece en el `cubre` de la parte "porque") — ver el
// informe de la tarea, punto 5. Se usa una reformulación que SÍ dispara los dos dominios reales (comercial vía
// "porque" + cobranza), preservando la intención: sujeto abierto, dos dominios, sin nombrar ninguna cuenta.
const C_PREGUNTA = "¿Qué cuentas merecen atención primero, por qué la carga comercial pesa más en algunas, y quién me debe más en la cobranza?";

function componer(fn, pregunta) {
  return fn({ scenario: ESCENARIO_INICIAL, pregunta, conocimientoActivo: true, conocimientoCatalogo: CATALOGO });
}

/* ═══ 1 · TODA SEÑAL DEL TURNO EN EXACTAMENTE UNO DE PROSA PRINCIPAL / MENCIÓN / OFERTA ═══ */
H("1 · toda señal del turno aparece en exactamente uno de prosa principal, mención u oferta (pregunta A)");
{
  const { entrega } = componer(componerEntregaBrechaComercial, A_PREGUNTA);
  const { salida, ofertas } = referenciaDelOficioConOfertas({ perfil: PERFIL_COMPLETO, pregunta: A_PREGUNTA, entidadesEnRespuesta: A_NOMBRADAS, entidadesDeLaPregunta: A_NOMBRADAS, scenario: ESCENARIO_INICIAL, activo: true, catalogo: CATALOGO });
  ok(!!entrega, "la Entrega A compone");
  const textoProsa = salida.map((s) => s.texto).join("\n");

  // control independiente: el UNIVERSO COMPLETO de señales de CADA pieza este turno (nunca adivinado) — la misma
  // fuente que usa el bloque/oferta (`resultadosCargaVsResto`/`resultadosPisoDeCobranza`), no el subconjunto que
  // `evaluarPertinencia` enciende con `entidadesEnRespuesta` (que solo mira las cuentas ya nombradas).
  const tablaControl1 = construirTablaDeSenales({ scenario: ESCENARIO_INICIAL, pregunta: A_PREGUNTA, entidadesEnRespuesta: A_NOMBRADAS, entidadesDeLaPregunta: A_NOMBRADAS });
  const { porEntidad: porEntidadCAU01_1 } = resultadosCargaVsResto(CAU01_FIRMADA, tablaControl1);
  const { porEntidad: porEntidadPRI04_1 } = resultadosPisoDeCobranza(PRI04, tablaControl1);
  const señalesCAU01 = [...porEntidadCAU01_1].filter(([, m]) => m.estado === "senal").map(([e]) => e);
  const señalesPRI04 = [...porEntidadPRI04_1].filter(([, m]) => m.estado === "senal").map(([e]) => e);
  ok(señalesCAU01.length >= 2, `control · CAU-01 tiene ${señalesCAU01.length} señal(es) este turno (universo completo): ${señalesCAU01.join(", ")}`);
  ok(señalesPRI04.length >= 2, `control · PRI-04 tiene ${señalesPRI04.length} señal(es) este turno (universo completo): ${señalesPRI04.join(", ")}`);

  // CAU-01 es principal (domina comercial): sus señales van en la prosa (línea completa o compacta), nunca en oferta
  const ofertaComercial = (ofertas || []).find((o) => o.dominio === "comercial");
  ok(!ofertaComercial, "★ CAU-01 es principal este turno: no hay oferta de comercial (sus señales ya están en la prosa)");
  for (const e of señalesCAU01) {
    const enProsa = textoProsa.includes(`${e}:`) || textoProsa.includes(`${e} ($`) || textoProsa.includes(`${e} (`);
    ok(enProsa, `★ CARNADA · la señal de CAU-01 "${e}" aparece en la prosa principal (línea completa o compacta)`, textoProsa);
  }

  // PRI-04 NO es principal (dominio cobranza, pregunta de margen): sus señales están en mención (Lider, nombrada
  // por el usuario) O en la oferta (las demás) — nunca en la prosa principal ni en las dos partes a la vez.
  const ofertaCobranza = (ofertas || []).find((o) => o.dominio === "cobranza");
  ok(!!ofertaCobranza, "★ hay una oferta de cobranza (PRI-04 no es principal este turno)");
  const mencionPRI04 = salida.find((s) => /pesa más en el vencido/.test(s.texto));
  ok(!!mencionPRI04, "★ hay una mención de PRI-04 (Lider, nombrada por el usuario)");
  ok(!!mencionPRI04 && mencionPRI04.texto.includes("Lider"), "★ CARNADA · Lider (única señal nombrada por el usuario) tiene su DETALLE individual en la mención", mencionPRI04 && mencionPRI04.texto);
  for (const e of señalesPRI04) {
    if (e === "Lider") continue;   // Lider ya se probó arriba, con detalle propio en la mención
    ok(!mencionPRI04.texto.includes(e), `★ CARNADA · la señal de PRI-04 "${e}" (no nombrada por el usuario) NO tiene detalle individual en la mención`, mencionPRI04.texto);
  }
  // la oferta es el resumen ESTRUCTURAL de la pieza completa (documento §5): el conteo (`cola.n`) tiene que ser
  // el universo real de señales (5 — Lider incluida, ver la nota del builder: el conteo es un resumen, no una
  // repetición del detalle) — nunca un número inventado ni recortado a mano.
  ok(!!ofertaCobranza && ofertaCobranza.cola && ofertaCobranza.cola.n === señalesPRI04.length, `★ CARNADA · la oferta de cobranza cuenta EXACTAMENTE las ${señalesPRI04.length} señales reales de PRI-04 este turno (dio ${ofertaCobranza && ofertaCobranza.cola && ofertaCobranza.cola.n})`, JSON.stringify(ofertaCobranza));
}

/* ═══ 2 · SODIMAC (margen) NO TIENE LÍNEA COMPLETA ═══ */
H("2 · Sodimac en la pregunta de margen no tiene línea completa (ni en CAU-01 ni en PRI-04)");
{
  const { salida } = referenciaDelOficioConOfertas({ perfil: PERFIL_COMPLETO, pregunta: A_PREGUNTA, entidadesEnRespuesta: A_NOMBRADAS, entidadesDeLaPregunta: A_NOMBRADAS, scenario: ESCENARIO_INICIAL, activo: true, catalogo: CATALOGO });
  const texto = salida.map((s) => s.texto).join("\n");
  ok(texto.includes("Sodimac"), "control · Sodimac SÍ aparece en algún lado (nunca oculta)");
  ok(!/Sodimac: [\d.]+% de su venta en carga comercial/.test(texto), "★ CARNADA · Sodimac NO tiene línea completa de CAU-01 (no es sujeto de la pregunta de margen)");
  ok(!/Sodimac: [\d.]+% del vencido contra/.test(texto), "★ CARNADA · Sodimac NO tiene línea completa de PRI-04 (no es sujeto, y PRI-04 no es principal)");
  ok(/Sodimac \(\$/.test(texto), "★ Sodimac aparece compactada por nombre y monto (línea «también supera…»)");
}

/* ═══ 3 · COBRANZA DE LIDER NO SIRVE EL BLOQUE DE CARGA ═══ */
H("3 · la cobranza de Lider no sirve el bloque de carga (CAU-01 no aparece)");
{
  const { entrega } = componer(componerEntregaCobranza, B_PREGUNTA);
  ok(!!entrega, "la Entrega B compone");
  const texto = entrega.referenciaDelOficio.map((s) => s.texto).join("\n");
  ok(!/cuando una cuenta cadena está bajo el benchmark de margen/.test(texto), "★ CARNADA · el bloque de CAU-01 (encabezado propio) NO aparece en la cobranza de Lider");
  ok(!/[\d.]+% de su venta en carga comercial contra/.test(texto), "★ CARNADA · ninguna línea completa de carga comercial aparece en la cobranza de Lider");
  const ofertaComercial = entrega.queMasPuedoCalcular.puedo.find((s) => /carga comercial contra el resto/.test(s));
  ok(!!ofertaComercial, "★ la carga comercial SÍ aparece, pero como oferta en «Qué más puedo calcular»", JSON.stringify(entrega.queMasPuedoCalcular.puedo));
}

/* ═══ 4 · PREGUNTA ABIERTA, DOS DOMINIOS: LAS DOS PIEZAS PRINCIPALES, LA COBRANZA NO DESAPARECE ═══ */
H("4 · pregunta abierta con dos dominios: las dos piezas principales, TODAS LAS SEÑALES completas (no todas las cuentas)");
{
  const { entrega, ok: entregaOk, motivo } = componer(componerEntregaMultidominio, C_PREGUNTA);
  ok(entregaOk, "la Entrega C (multidominio, abierta) compone", motivo);
  if (entregaOk) {
    const texto = entrega.referenciaDelOficio.map((s) => s.texto).join("\n");
    ok(/cuando una cuenta cadena está bajo el benchmark de margen/.test(texto), "★ CAU-01 se sirve como bloque principal (comercial es uno de los dos dominios pedidos)");
    ok(/el oficio compara la participación de cada cuenta en el vencido/.test(texto), "★ CARNADA · PRI-04 (cobranza) se sirve como bloque principal — la cobranza NO desaparece con sujeto vacío");
    // ★ owner 2026-09-24 (corrección tras revisión) — «pregunta abierta → todas las SEÑALES completas» (no
    // todas las cuentas). Las señales llevan línea completa; las cuentas BAJO EL PISO van agrupadas (con nombre
    // y monto la que tiene exceso, agrupada la que carga/pesa menos) — nunca individuales, aunque el
    // procedimiento las haya nombrado para OTRO dominio (Lider en carga, Falabella en cobranza).
    const señalesCAU01_C = ["Falabella", "Sodimac"];
    const bajoPisoCAU01_C = ["Jumbo", "Lider", "Tottus", "Paris", "Mercado Libre", "Ripley"];
    const señalesPRI04_C = ["Lider", "Sodimac", "Tottus", "Paris", "Easy"];
    const bajoPisoPRI04_C = ["Falabella"];
    for (const e of señalesCAU01_C) ok(new RegExp(`${e}: [\\d.]+% de su venta en carga comercial`).test(texto), `★ ${e} (señal de carga) tiene línea completa de CAU-01`, texto);
    for (const e of señalesPRI04_C) ok(new RegExp(`${e}: [\\d.]+% del vencido contra`).test(texto), `★ ${e} (señal de cobranza) tiene línea completa de PRI-04`, texto);
    // ★ cada lista de "bajo el piso" se prueba SOLO contra el patrón de SU PROPIA pieza (Falabella es señal de
    // CAU-01 pero bajo el piso de PRI-04, y viceversa con Tottus/Paris — cruzar las listas probaría lo contrario
    // de lo que mide cada pieza).
    for (const e of bajoPisoCAU01_C) ok(!new RegExp(`${e}: [\\d.]+% de su venta en carga comercial`).test(texto), `★ CARNADA · ${e} (bajo el piso de CAU-01) NO tiene línea completa de CAU-01, aunque el procedimiento la haya nombrado para otro dominio`, texto);
    for (const e of bajoPisoPRI04_C) ok(!new RegExp(`${e}: [\\d.]+% del vencido contra`).test(texto), `★ CARNADA · ${e} (bajo el piso de PRI-04) NO tiene línea completa de PRI-04, aunque el procedimiento la haya nombrado para otro dominio`, texto);
    ok(/Bajo el piso de ADI: /.test(texto), "★ las cuentas bajo el piso, fuera de la línea completa, van agrupadas por nombre y monto (como antes)");
    ok(!/También superan|Fuera de la nombrada|Fuera de las nombradas/.test(texto), "★ ninguna SEÑAL queda compactada (sujeto abierto: todas las señales completas)");
    ok(entrega.queMasPuedoCalcular.puedo.every((s) => !/cuentas superan el piso/.test(s)), "★ sin ofertas de CAU-01/PRI-04 (las dos son principales este turno — bullet 5 del diseño: nunca una oferta de una pieza principal)", JSON.stringify(entrega.queMasPuedoCalcular.puedo));
  }
}

/* ═══ 5 · EL GANCHO DE CADA OFERTA VERIFICA EN EL LIBRO (MISMO hechoId QUE medirPieza) ═══ */
H("5 · el gancho de cada oferta verifica en el libro de hechos (hechoId real, no inventado)");
{
  const { ofertas } = referenciaDelOficioConOfertas({ perfil: PERFIL_COMPLETO, pregunta: B_PREGUNTA, entidadesEnRespuesta: ["Lider", "Falabella"], entidadesDeLaPregunta: ["Lider"], scenario: ESCENARIO_INICIAL, activo: true, catalogo: CATALOGO });
  const ofertaComercial = (ofertas || []).find((o) => o.dominio === "comercial");
  ok(!!ofertaComercial, "hay una oferta de comercial (CAU-01 no es principal en la cobranza de Lider)");
  if (ofertaComercial) {
    ok(!!ofertaComercial.gancho, "★ la oferta trae un gancho", JSON.stringify(ofertaComercial));
    ok(!!ofertaComercial.gancho.hechoId, "★ CARNADA · el gancho trae un hechoId (no null)", JSON.stringify(ofertaComercial.gancho));
    ok(!!ofertaComercial.gancho.texto, "★ el gancho trae texto (la cifra verificada)", JSON.stringify(ofertaComercial.gancho));
    // control cruzado: el MISMO hechoId aparece en la traza de medirPieza para CAU-01 este turno (el gancho no
    // es un número que esta capa haya inventado por su cuenta — es el mismo hecho que ya verificó libroDeHechos).
    const { detalle } = _evaluarInfraestructura({ catalogo: CATALOGO, scenario: ESCENARIO_INICIAL, pregunta: B_PREGUNTA, entidadesEnRespuesta: ["Lider", "Falabella"], entidadesDeLaPregunta: ["Lider"], perfil: PERFIL_COMPLETO });
    const idsCAU01 = detalle.filter((d) => d.piezaId === "CAU-01" && d.cifra).map((d) => d.cifra.id);
    ok(idsCAU01.includes(ofertaComercial.gancho.hechoId), `★ CARNADA · el hechoId del gancho ("${ofertaComercial.gancho.hechoId}") es uno de los hechos que medirPieza YA verificó para CAU-01 este turno`, JSON.stringify(idsCAU01));
  }
}

/* ═══ 6 · "no_implica" VIAJA EN CADA MENCIÓN (una vez, sin duplicar) ═══ */
H("6 · no_implica viaja en cada mención, exactamente una vez");
{
  const { salida } = referenciaDelOficioConOfertas({ perfil: PERFIL_COMPLETO, pregunta: A_PREGUNTA, entidadesEnRespuesta: A_NOMBRADAS, entidadesDeLaPregunta: A_NOMBRADAS, scenario: ESCENARIO_INICIAL, activo: true, catalogo: CATALOGO });
  const mencionPRI04 = salida.find((s) => /pesa más en el vencido/.test(s.texto));
  ok(!!mencionPRI04, "la mención de PRI-04 se sirvió");
  if (mencionPRI04) {
    const nVeces = (mencionPRI04.texto.match(/No implica que la cuenta sea mala pagadora/g) || []).length;
    ok(nVeces === 1, `★ CARNADA · "no_implica" de PRI-04 aparece EXACTAMENTE una vez en la mención (dio ${nVeces})`, mencionPRI04.texto);
    ok(!/Esto no excluye/.test(mencionPRI04.texto), "★ la mención no concatena medicion.no_excluye aparte (misma regla que el bloque)");
  }
  // control negativo: sin ninguna cuenta nombrada por el usuario, no hay mención (y por lo tanto no hay
  // no_implica de mención que contar) — no es un siempre-presente.
  const { salida: salidaSinNombrar } = referenciaDelOficioConOfertas({ perfil: PERFIL_COMPLETO, pregunta: A_PREGUNTA, entidadesEnRespuesta: [], entidadesDeLaPregunta: [], scenario: ESCENARIO_INICIAL, activo: true, catalogo: CATALOGO });
  const mencionSinNombrar = salidaSinNombrar.find((s) => /pesa más en el vencido/.test(s.texto));
  ok(!mencionSinNombrar, "control negativo · sin ninguna cuenta nombrada por el usuario, la mención de PRI-04 no se sirve (nadie calificó)");
}

/* ═══ 7 · CARNADA NUEVA (owner 2026-09-24, segunda revisión) — «en una pregunta abierta, ninguna cuenta bajo el
 * piso lleva línea completa» ═══════════════════════════════════════════════════════════════════════════════════
 * Unitaria sobre `servirBloqueCargaVsResto` directo (copia de argumentos, nunca el archivo): con `abierta:true`
 * y un `sujeto` que INCLUYE una cuenta bajo el piso (Lider, para forzar el caso límite — sujeto de OTRO dominio
 * que coincide con una cuenta bajo el piso de esta pieza), esa cuenta sigue sin línea individual: la regla de
 * "abierta" prevalece sobre la de "sujeto" para bajo-piso. Control positivo: con `abierta:false` y el MISMO
 * sujeto, Lider SÍ individualiza (la regla de sujeto vuelve a regir cuando la pregunta no es abierta). */
H("7 · CARNADA · en una pregunta abierta, ninguna cuenta bajo el piso lleva línea completa (ni siquiera si es sujeto de otro dominio)");
{
  const tabla7 = construirTablaDeSenales({ scenario: ESCENARIO_INICIAL, pregunta: A_PREGUNTA, entidadesEnRespuesta: A_NOMBRADAS, entidadesDeLaPregunta: A_NOMBRADAS });
  const { porEntidad: porEntidad7 } = resultadosCargaVsResto(CAU01_FIRMADA, tabla7);
  const cierre7 = coberturaCargaVsResto(tabla7);
  const sujetoConLider = new Set(["Lider"]);   // Lider es bajo_piso en CAU-01 (carga) — sujeto de OTRO dominio (cobranza) en el ejemplo real

  const bloqueAbierta = servirBloqueCargaVsResto(CAU01_FIRMADA, porEntidad7, cierre7.texto, { sujeto: sujetoConLider, abierta: true });
  ok(!!bloqueAbierta, "el bloque (abierta:true) se sirvió");
  if (bloqueAbierta) {
    ok(!/Lider: [\d.]+% de su venta en carga comercial/.test(bloqueAbierta.texto), "★ CARNADA · con abierta:true, Lider (bajo el piso, sujeto de OTRO dominio) NO lleva línea completa", bloqueAbierta.texto);
    ok(/Bajo el piso de ADI: Lider/.test(bloqueAbierta.texto), "★ Lider aparece agrupada en la línea de «bajo el piso», con su monto", bloqueAbierta.texto);
  }

  // control positivo: el MISMO sujeto, pero SIN pregunta abierta — ahí sí rige "cada cuenta del sujeto lleva
  // línea completa, incluso bajo el piso" (la regla de A/B, confirmada correcta).
  const bloqueCerrada = servirBloqueCargaVsResto(CAU01_FIRMADA, porEntidad7, cierre7.texto, { sujeto: sujetoConLider, abierta: false });
  ok(!!bloqueCerrada, "el bloque (abierta:false) se sirvió");
  if (bloqueCerrada) {
    ok(/Lider: [\d.]+% de su venta en carga comercial/.test(bloqueCerrada.texto), "control positivo · con abierta:false, Lider (del sujeto) SÍ lleva línea completa — la regla de sujeto sigue viva fuera de «abierta»", bloqueCerrada.texto);
  }
}

console.log(`\n── _pertinencia_por_encargo_gate: PASS ${pass} · FAIL ${fail} (de ${pass + fail}) ──`);
process.exit(fail ? 1 : 0);
