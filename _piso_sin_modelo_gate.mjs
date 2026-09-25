/* === _piso_sin_modelo_gate.mjs · LA LEY DEL PISO SIN MODELO (owner 2026-09-25, `adi-piso-sin-modelo`) ══════════
 *
 * EL MANDATO, textual: «si ADI reconoce dos o más temas pedidos, debe cubrirlos todos, de forma breve y sobre la
 * entidad nombrada si corresponde. Reconocer además la intención de decidir/priorizar solo agrega el veredicto;
 * no puede ser condición para cubrir los temas.» Obligatorio: «cerrar de raíz la cifra ajena … y completar los
 * conceptos empresariales estables de tesorería.» Y: «sin modelo exijo seguridad, cobertura de lo reconocido,
 * entidad correcta y cero cambios silenciosos de concepto. La comprensión abierta del lenguaje coloquial
 * pertenece al LLM.»
 *
 * LO MEDIDO (set ciego v2, cerebro mudo, quemado — ver memoria `adi-piso-sin-modelo`/`adi-encargo-natural`):
 *   · ~11 preguntas simples caían al peldaño `limite` y servían la cifra de OTRO concepto («¿cuál es el cliente
 *     que más nos compra?» → «variación vs año anterior de Lider»).
 *   · una cuenta nombrada («La Polar») recibía la cobranza de TODA la cartera, sin ella y sin el segundo tema.
 *   · 13/24 encargos no se reconocían porque su CIERRE («tengo que decidir si…», «prepararme para…», «semáforo»,
 *     «panorama», «ranking») no estaba en el vocabulario de cierres — y la ley prohíbe perseguir ese vocabulario
 *     palabra por palabra (regla E: eso es comprensión abierta, del LLM).
 *   · «caja disponible», «flujo de caja», «capital de trabajo» cayendo al genérico «no puedo responder eso con
 *     seguridad» sin declarar la ausencia de tesorería.
 *
 * QUÉ EXIGE ESTE CANDADO (las cuatro carnadas del encargo, textuales):
 *   1 · ningún texto servido cita una cifra cuya CLAVE DE MÉTRICA no sea un concepto pedido.
 *   2 · con entidad nombrada, ninguna cifra servida es de otra entidad, ni la cartera presentada como si fuera ella.
 *   3 · ≥ 2 temas reconocidos (`dominiosDe`, activos + ausentes) → todos cubiertos, sin importar cómo cierra.
 *   4 · tesorería, sola o mezclada, siempre se declara con la línea existente — nunca el genérico sin causa.
 *
 * RONDA 2 (owner 2026-09-25, vía coordinador): «Cobranza: sin cifra verificada de Jumbo» era falso por omisión
 * — la boleta SÍ trae a Jumbo (`Con saldo pendiente y sin vencido: Jumbo $5.1M»), solo que `cobranza()` recorta
 * a 8 filas y «al día» (`notario/estados.js`: saldo vencido = 0) no es «sin dato». Dos correcciones, ADITIVAS:
 *   5 · una cuenta nombrada, con fila en `mesaFlujo` fuera del recorte de 8, SUMA su fila (`herramientasAgente.js:
 *       cobranza()` + `toolRunner.js`) — el recorte, su orden y las 8 filas de siempre no cambian.
 *   6 · sin «Saldo vencido»/«Dias Vencido» para la cuenta pero CON «Saldo pendiente», la línea dice «al día (sin
 *       vencido)» con su pendiente — o «al día, sin días de atraso» si pidió específicamente los días — nunca
 *       «sin cifra verificada» (esa frase queda solo para la cuenta genuinamente ausente del dato).
 *
 * RONDA 3 (owner 2026-09-25, vía coordinador): «cuánto le vendo A CRÉDITO a Ripley» servía «Ripley vendió
 * $4.7M» — la fig comercial «· Venta» (contado + crédito). En el demo coincide (100% crédito); con contado
 * real sería otro número: el mismo cambio silencioso de concepto que la ley prohíbe.
 *   7 · si el concepto pedido es venta A CRÉDITO, la línea usa la fig de venta a crédito (la mesa de cobranza,
 *       «· Venta a crédito» / «· Venta (flujo)»), nunca la fig comercial «· Venta»; sin esa fig, declina SOLO
 *       ese concepto.
 *
 * Cero red: cerebro MUDO (`_guion_declara.mjs`), herramientas puras, tenant demo. `node --import
 * ./scripts/offline-guard.mjs _piso_sin_modelo_gate.mjs` */
import { initTenant } from "./src/data/tenantStore.js";
import { TENANT_DEMO } from "./src/data/tenants/demo.js";
import { ESCENARIO_INICIAL } from "./src/config/scenarios.js";
import { answerViaAgente } from "./src/adi/agente/bucleAgente.js";
import { declarando } from "./_guion_declara.mjs";
import { encargoDe } from "./src/adi/agente/partesDelEncargo.js";
import { dominiosDe } from "./src/adi/agente/contratoDeDominios.js";
import { dominiosDeTexto, DOMINIOS_REGISTRO } from "./src/config/contract/dominios.js";
import { claveDeMetrica } from "./src/adi/notario/lexico.js";
import { runPlan } from "./src/adi/oracle/toolRunner.js";
import { cajaDelAgente } from "./src/adi/agente/herramientasAgente.js";

let PASS = 0, FAIL = 0;
const ok = (c, m, extra = "") => { if (c) { PASS++; console.log("  ✓ " + m); } else { FAIL++; console.log("  ✗ " + m + (extra ? "\n      " + extra : "")); } };
const H = (t) => console.log(`\n${t}`);
initTenant(TENANT_DEMO);
const MUDO = async () => ({ tipo: "texto", texto: "", stop: "end_turn" });
const turno = async (q) => answerViaAgente({ text: q, history: [], mem: {}, scenario: ESCENARIO_INICIAL, callAgente: declarando(MUDO) });

const CUENTAS = ["Falabella", "Lider", "Jumbo", "Sodimac", "Tottus", "Paris", "Easy", "Ripley", "La Polar", "Hites", "ABC", "Unimarc", "Mercado Libre"];
const LITERALES = {};

/* ═══ 1 · CIFRA AJENA, DE RAÍZ ═══════════════════════════════════════════════════════════════════════════════════
 * el verificador NO parsea la prosa (eso sería un segundo Notario): usa el mismo registro que la casa,
 * `claveDeMetrica`, para probar que un texto conocido MALO (el literal que el owner reportó) se detecta, y que
 * los turnos reales de hoy no lo repiten. */
H("1 · cifra ajena — el texto servido no sustituye el concepto pedido por otro");
{
  /* la carnada: el literal EXACTO que reportó el owner del set ciego v2, antes de esta ley */
  const textoMaloHistorico = "Lo que tengo verificado ahora: variación vs año anterior en $ de Lider, $2.3M.";
  const claveDelTextoMalo = claveDeMetrica("variación vs año anterior en $");
  const claveEsperada = claveDeMetrica("el cliente que más nos compra");
  ok(claveDelTextoMalo === "variacion_usd" && claveEsperada === "ventas" && claveDelTextoMalo !== claveEsperada,
    "el verificador MUERDE: el literal histórico es de otra clave (variacion_usd) que la pedida (ventas)",
    `histórico=${claveDelTextoMalo} pedida=${claveEsperada}`);

  /* la cifra ajena es CITAR la variación como respuesta verificada («…de Lider, $2.3M»), no OFRECERLA como
   * alternativa disponible («también tengo Variación… ¿te abro alguno?») — eso último es la ley cumpliéndose:
   * declara qué más hay y pregunta, nunca la sirve como si fuera lo pedido. */
  const _comoRespuesta = /variaci[oó]n vs a[ñn]o anterior[^.?]*\$/i;
  const r1 = await turno("¿cuál es el cliente que más nos compra?");
  LITERALES["¿cuál es el cliente que más nos compra?"] = { estado: r1.r.agente.estado, texto: r1.r.text };
  ok(!_comoRespuesta.test(r1.r.text), "«¿cuál es el cliente que más nos compra?» no CITA variación como si fuera la respuesta (la cifra ajena histórica)", r1.r.text);
  ok(/venta/i.test(r1.r.text), "…y sí declara el concepto que entendió (venta)", r1.r.text);

  const r2 = await turno("cuanto le vendo a credito a Ripley y cuantos dias de atraso lleva");
  LITERALES["cuanto le vendo a credito a Ripley y cuantos dias de atraso lleva"] = { estado: r2.r.agente.estado, texto: r2.r.text };
  ok(!_comoRespuesta.test(r2.r.text), "Ripley: crédito no se contesta con variación (otra clave)", r2.r.text);
}

/* ═══ 2 · ENTIDAD CORRECTA ═══════════════════════════════════════════════════════════════════════════════════════
 * con una cuenta nombrada, ninguna OTRA cuenta del universo aparece en el texto servido — ni como líder de la
 * cartera puesto en su lugar, ni de ningún modo (la misma vara del `_encargo_natural_gate`, aplicada aquí a las
 * tres frases del informe). */
H("2 · entidad correcta — ninguna cuenta ajena aparece cuando hay una cuenta nombrada");
{
  const casos = [
    { q: "cuanto le vendo a credito a Ripley y cuantos dias de atraso lleva", sujeto: "Ripley" },
    { q: "che necesito saber si le sigo vendiendo a credito a La Polar o le corto, mirá cómo está su deuda y cuánto margen me deja", sujeto: "La Polar" },
    { q: "tengo que decidir si bajo el rappel a Jumbo, decime cuanto nos compra, cuanto le estamos dando de descuento y como anda pagando", sujeto: "Jumbo" },
  ];
  for (const { q, sujeto } of casos) {
    const r = await turno(q);
    LITERALES[q] = { estado: r.r.agente.estado, texto: r.r.text };
    const otras = CUENTAS.filter((n) => n !== sujeto && !sujeto.includes(n));
    const ajena = otras.find((n) => r.r.text.includes(n));
    ok(r.r.text.includes(sujeto), `[${sujeto}] la respuesta SÍ nombra a la cuenta pedida`, r.r.text);
    ok(!ajena, `[${sujeto}] ninguna cuenta ajena aparece en el texto servido`, ajena ? `apareció «${ajena}» · ${r.r.text}` : "");
  }
}

/* ═══ 3 · COBERTURA POR TEMAS, SIN IMPORTAR EL CIERRE ═══════════════════════════════════════════════════════════
 * la carnada: `encargoDe(q).cierre` se queda en el default «cifra» (el cierre no está en el vocabulario — a
 * propósito, regla E) Y `esEncargo` da `false` con la definición de siempre — el candado prueba que la
 * respuesta SERVIDA igual cubre los dos temas, por la red del piso, no por `esEncargo`. */
H("3 · cobertura por temas reconocidos — el cierre no reconocido no cuesta un tema");
{
  /* la carnada de VERDAD: una forma de cierre que el vocabulario de la casa NO reconoce como decisión ni como
   * lectura («prepárame un semáforo…» — regla E, esta ley prohíbe perseguir «semáforo» palabra por palabra) se
   * queda en el default «cifra», y con la definición de siempre `esEncargo` da `false` — sin este candado el
   * turno perdería un tema. Se prueba con la función real, no con una copia: si algún día `esEncargo` cambiara
   * de definición y esta fila empezara a dar `true`, la primera aserción avisa (dejaría de probar nada) en vez
   * de mentir que el candado sigue mordiendo. */
  const qSemaforo = "prepárame un semáforo de Sodimac con su venta y su saldo vencido";
  const eSemaforo = encargoDe(qSemaforo) || {};
  ok(eSemaforo.cierre === "cifra" && eSemaforo.esEncargo === false,
    `[carnada] «${qSemaforo.slice(0, 40)}…» — cierre no reconocido (${eSemaforo.cierre}), esEncargo=false: sin este candado el turno perdería un tema`);

  const casos = [
    { q: "tengo que decidir si bajo el rappel a Jumbo, decime cuanto nos compra, cuanto le estamos dando de descuento y como anda pagando", marcas: [/venta/i, /cobranza/i] },
    { q: qSemaforo, marcas: [/venta|vendi[oó]/i, /vencid|cobranza/i] },
  ];
  for (const { q, marcas } of casos) {
    const r = await turno(q);
    LITERALES[q] = { estado: r.r.agente.estado, texto: r.r.text };
    for (const m of marcas) ok(m.test(r.r.text), `[${q.slice(0, 40)}…] la respuesta cubre ${m}`, r.r.text);
  }
}

/* ═══ 4 · TESORERÍA, SIEMPRE DECLARADA ═══════════════════════════════════════════════════════════════════════════ */
H("4 · tesorería — sola o mezclada, la ausencia se declara, nunca el genérico sin causa");
{
  const solas = ["cuanta plata tengo disponible en caja hoy", "cuál es mi flujo de caja este mes", "cuánto capital de trabajo tengo disponible ahora"];
  for (const q of solas) {
    const dt = dominiosDe(q);
    ok(dt.ausentes.includes("tesoreria"), `[registro] «${q}» enciende tesorería ausente`, JSON.stringify(dt));
    const r = await turno(q);
    LITERALES[q] = { estado: r.r.agente.estado, texto: r.r.text };
    ok(/tesorer[ií]a/i.test(r.r.text), `   …y la respuesta declara «Tesorería» por su nombre`, r.r.text);
    ok(/exposici[oó]n de cr[eé]dito/i.test(r.r.text), `   …y ofrece la exposición de crédito (sin llamarla caja)`, r.r.text);
    ok(!/no puedo responder eso con seguridad/i.test(r.r.text), `   …nunca el genérico sin causa`, r.r.text);
  }
  /* mezclada: tesorería + un tema real declara AMBOS */
  const rMix = await turno("dime cuánto vendí y cuánta plata tengo disponible en caja");
  LITERALES["dime cuánto vendí y cuánta plata tengo disponible en caja"] = { estado: rMix.r.agente.estado, texto: rMix.r.text };
  ok(/tesorer[ií]a/i.test(rMix.r.text), "tesorería mezclada con un tema real: la ausencia igual se declara", rMix.r.text);

  /* la carnada del registro: sin los fragmentos de esta etapa (copia del registro, nunca el real), «capital de
   * trabajo»/«flujo de caja» no encenderían tesorería como ausente — prueba de que el candado depende del
   * registro, no de una coincidencia */
  const copiaSinTrabajo = DOMINIOS_REGISTRO.map((d) => (d.id !== "tesoreria" ? d : { ...d, conceptosDeEntrada: d.conceptosDeEntrada.filter((c) => c !== "capital de trabajo") }));
  const sinCapitalDeTrabajo = dominiosDeTexto("cuánto capital de trabajo tengo disponible ahora", { registro: copiaSinTrabajo });
  ok(!sinCapitalDeTrabajo.ausentes.includes("tesoreria"), "[carnada] sin el fragmento «capital de trabajo» en el registro, la copia NO enciende tesorería — el real sí (arriba)");
}

/* ═══ 5 · EL REGISTRO ÚNICO — CARNADAS DE LOS TÉRMINOS AGREGADOS ESTA ETAPA ══════════════════════════════════════
 * «el cliente que más nos compra», «cómo anda pagando», «días de atraso» no encendían NINGÚN dominio antes de
 * esta ley (medido): con una copia del registro SIN esos fragmentos, el turno queda sin ningún tema reconocido
 * — la prueba de que el fragmento agregado es el que sostiene el reconocimiento, no una coincidencia de otra
 * palabra de la frase. */
H("5 · el registro único — los términos nuevos son los que sostienen el reconocimiento (carnadas)");
{
  const _sinFragmento = (id, frag) => DOMINIOS_REGISTRO.map((d) => (d.id !== id ? d : { ...d, conceptosDeEntrada: d.conceptosDeEntrada.filter((c) => c !== frag) }));
  const casos = [
    /* ⚠️ «el cliente que más nos compra» por sí sola NO sirve de carnada: la palabra «cliente» YA enciende
     * comercial por su cuenta (un concepto de siempre, `"clientes?"`) — la frase de prueba tiene que aislar
     * el fragmento nuevo, sin ningún otro gatillo del registro al lado. */
    { id: "comercial", frag: "nos compra(?:n)?", texto: "cuánto nos compra", esperaDominio: "comercial" },
    { id: "cobranza", frag: "pagando", texto: "como anda pagando", esperaDominio: "cobranza" },
    { id: "cobranza", frag: "atraso", texto: "cuantos dias de atraso lleva", esperaDominio: "cobranza" },
  ];
  for (const { id, frag, texto, esperaDominio } of casos) {
    const conReal = dominiosDeTexto(texto);
    ok(conReal.dominios.includes(esperaDominio), `[registro real] «${texto}» enciende ${esperaDominio}`, JSON.stringify(conReal));
    const copia = _sinFragmento(id, frag);
    const sinFragmento = dominiosDeTexto(texto, { registro: copia });
    ok(!sinFragmento.dominios.includes(esperaDominio), `[carnada] sin «${frag}» en el registro, «${texto}» NO enciende ${esperaDominio}`, JSON.stringify(sinFragmento));
  }
}

/* ═══ 6 · «AL DÍA» NO ES «SIN CIFRA» (owner 2026-09-25, ronda 2) ═══════════════════════════════════════════════
 * la boleta trae a la cuenta pedida (con o sin el recorte de 8), y sin «Saldo vencido»/«Dias Vencido» eso es
 * la definición de la casa de «al día» — declararla como «sin cifra verificada» es falso por omisión. */
H("6 · «al día» no es «sin cifra» — la cuenta nombrada, con fila en el dato, nunca dice «sin cifra verificada»");
{
  const qRipley = "cuanto le vendo a credito a Ripley y cuantos dias de atraso lleva";
  const qJumbo = "tengo que decidir si bajo el rappel a Jumbo, decime cuanto nos compra, cuanto le estamos dando de descuento y como anda pagando";
  /* la carnada del recorte: SIN `preguntaUsuario` (el mecanismo que hace el candado 5 aditivo), Ripley — la
   * fila 9 de `mesaFlujo`, fuera del top 8 que arma la boleta (verificado: Lider…Easy con vencido, después
   * Jumbo y Mercado Libre, después recién Ripley) — no tiene NINGUNA fig en la boleta de cobranza. CON ella,
   * sí. Prueba que la fila extra depende del fix, no de una coincidencia del dato. (Jumbo, en cambio, YA está
   * en el top 8 por su propio saldo pendiente — a él no le hacía falta el fix, y por eso no sirve de carnada:
   * su cobertura correcta ya estaba antes de esta ronda; ver los casos de abajo, que sí cubren los tres.) */
  const caja = cajaDelAgente();
  const sinPregunta = runPlan({ intent: "answer", calls: [{ tool: "cobranza", args: {} }] }, { scenario: ESCENARIO_INICIAL, maxCalls: 8, registry: caja });
  const conPregunta = runPlan({ intent: "answer", calls: [{ tool: "cobranza", args: {} }] }, { scenario: ESCENARIO_INICIAL, maxCalls: 8, preguntaUsuario: qRipley, registry: caja });
  const figsSin = (sinPregunta.ledger || {}).figs || [];
  const figsCon = (conPregunta.ledger || {}).figs || [];
  ok(!figsSin.some((f) => /Ripley/i.test(f.label)), "[carnada] sin `preguntaUsuario`, Ripley NO tiene fig en la boleta de cobranza (fuera del top 8)", JSON.stringify(figsSin.map((f) => f.label)).slice(0, 200));
  ok(figsCon.some((f) => /^Ripley · Saldo pendiente$/i.test(f.label)), "[fix] CON `preguntaUsuario`, Ripley SÍ suma su «Saldo pendiente» a la boleta", JSON.stringify(figsCon.filter((f) => /Ripley/i.test(f.label)).map((f) => f.label)));
  ok(!figsCon.some((f) => /^Ripley · Saldo vencido$/i.test(f.label)), "…y sin «Saldo vencido» (vencido = 0, la definición de «al día»)");
  /* las 8 filas y su orden de siempre no cambiaron: el primer cliente de la boleta sigue siendo el mismo con y sin la pregunta */
  const _primerCliente = (figs) => { const f = figs.find((x) => / · (?:Venta|Venta a crédito|Venta \(flujo\))$/i.test(x.label)); return f ? String(f.label).split(" · ")[0] : null; };
  ok(_primerCliente(figsSin) === _primerCliente(figsCon), "[recorte intacto] el primer cliente del top 8 es el mismo con y sin `preguntaUsuario`", `${_primerCliente(figsSin)} vs ${_primerCliente(figsCon)}`);

  const casos = [
    { q: qRipley, sujeto: "Ripley", esperaAlDia: /al d[ií]a/i },
    { q: "che necesito saber si le sigo vendiendo a credito a La Polar o le corto, mirá cómo está su deuda y cuánto margen me deja", sujeto: "La Polar", esperaAlDia: /al d[ií]a/i },
    { q: qJumbo, sujeto: "Jumbo", esperaAlDia: /al d[ií]a/i },
  ];
  for (const { q, sujeto, esperaAlDia } of casos) {
    const r = await turno(q);
    LITERALES[q] = { estado: r.r.agente.estado, texto: r.r.text };
    ok(!/sin cifra verificada de/i.test(r.r.text), `[${sujeto}] la línea de cobranza nunca dice «sin cifra verificada» (tiene fila en el dato)`, r.r.text);
    ok(esperaAlDia.test(r.r.text), `[${sujeto}] …y declara «al día», la definición verificable`, r.r.text);
  }
}

/* ═══ 7 · VENTA A CRÉDITO ≠ VENTA (owner 2026-09-25, ronda 3) ═══════════════════════════════════════════════════
 * pedir la venta A CRÉDITO de una cuenta nunca puede servir la fig comercial «· Venta» (contado + crédito):
 * en el demo coinciden (100% crédito), pero son conceptos distintos y la ley prohíbe la sustitución silenciosa
 * aunque el número dé igual. */
H("7 · venta a crédito ≠ venta — pedir crédito nunca sirve la fig comercial «· Venta»");
{
  const qRipleyCredito = "cuanto le vendo a credito a Ripley y cuantos dias de atraso lleva";
  const r = await turno(qRipleyCredito);
  LITERALES[qRipleyCredito] = { estado: r.r.agente.estado, texto: r.r.text };
  ok(/vendidos a cr[eé]dito/i.test(r.r.text), "«cuánto le vendo a crédito a Ripley» declara la venta A CRÉDITO por su nombre", r.r.text);
  ok(!/Ripley vendi[oó] \$/i.test(r.r.text), "[carnada] …y NUNCA con la forma de la fig comercial «Ripley vendió $X» (esa es venta total, no a crédito)", r.r.text);

  /* la carnada directa sobre el detector: una pregunta de venta SIN «a crédito» sigue resolviendo a la fig
   * comercial de siempre — el candado no le robó la ruta al caso de todos los días. */
  const qSinCredito = "¿cuánto le vendo a Ripley y cuánto me debe?";
  const r2 = await turno(qSinCredito);
  ok(/Ripley vendi[oó] \$/i.test(r2.r.text), "[control] sin «a crédito», una pregunta de venta simple sigue usando la fig comercial de siempre", r2.r.text);
}

console.log("\n── las respuestas literales de este candado (para el informe) ──");
for (const [q, r] of Object.entries(LITERALES)) console.log(`\n[${r.estado} · ${r.texto.length} chars] ${q}\n${r.texto}`);

console.log(`\n── _piso_sin_modelo_gate: ${PASS} PASS · ${FAIL} FAIL (de ${PASS + FAIL}) ──`);
process.exit(FAIL ? 1 : 0);
