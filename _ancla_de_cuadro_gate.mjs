/* === _ancla_de_cuadro_gate.mjs · EL BOTÓN MANDA EL ANCLA, Y ADI RESPONDE ESE CUADRO ==========================
 *
 * LA PALABRA DEL OWNER (2026-09-08), textual y completa — cada frase tiene acá su chequeo:
 *   «El botón no manda solo texto. Manda el ancla completa del cuadro que el usuario está viendo. Debe incluir:
 *    cara/módulo · nombre del cuadro · métrica principal · eje o entidad · período · filtros aplicados · cifras
 *    visibles · qué pregunta concreta debe explicar. ADI debe responder ese cuadro, no una pregunta libre ni un
 *    ranking genérico. Si el cuadro muestra un 80/20, explica el 80/20. Si el cuadro muestra presupuesto,
 *    explica presupuesto. Si no existe dato suficiente para ese cuadro, debe decir exactamente qué falta.
 *    Hazlo transversal para todas las caras, no parche por cuadro.»
 *
 * LO QUE MIDE, y con qué:
 *   1 · EL ANCLA COMPLETA · los ocho campos, sobre el ancla VIVA (builder real → ViewContext sellado).
 *   2 · TRANSVERSAL DE VERDAD · el barrido del manifiesto entero, y la prueba de que no hay lista de cuadros:
 *       ni el lector ni el playbook nombran un componentId. Un cuadro nuevo queda explicado al declararse.
 *   3 · CADA BOTÓN RESPONDE SU CUADRO · contra el CUADRO VIVO: se recorre el builder y se exige que la
 *       respuesta diga SUS cifras. Si el dato cambia, cuadro y respuesta se mueven juntos o esto arde.
 *   4 · EL 80/20 SE EXPLICA COMO 80/20 · y el conmutador Ventas↔Contribución da OTRA respuesta, no la misma.
 *   5 · EL PRESUPUESTO SE EXPLICA COMO PRESUPUESTO.
 *   6 · SIN DATO, SE DICE QUÉ FALTA · y no se sirve otro corte en su lugar.
 *   7 · UN CLICK, UN TURNO · el ambiente de la vista NO abre la explicación de cuadro (si no, la pregunta
 *       siguiente escrita a mano se respondería como si fuera un botón).
 *   8 · NADA SE AFLOJA · el muro juzga el texto compuesto contra la boleta del MISMO turno, cero jerga interna.
 *   9 · EL EMISOR · todo botón «Que ADI lo explique» manda el ancla, o está DECLARADO como excepción con su
 *       razón. Un botón nuevo que se olvide del ancla pone esto rojo.
 *  10 · CARNADAS · cada garantía, probada ROJA mutando una copia del código vivo.
 *
 * OFFLINE · determinístico · cerebro = guion (MUDO) · CERO llamadas al modelo.
 * `node --import ./scripts/offline-guard.mjs _ancla_de_cuadro_gate.mjs` */
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { initTenant, getTenantId } from "./src/data/tenantStore.js";
import { TENANT_DEMO } from "./src/data/tenants/demo.js";
import { answerViaAgente } from "./src/adi/agente/bucleAgente.js";
import { playbookPara, pasosDe, obligatoriasDe, entregableDe, doctrinaDelPlaybook, vetosDelPlaybook } from "./src/adi/agente/playbooks/registro.js";
import { cuadroExplicado } from "./src/adi/agente/playbooks/cuadroExplicado.js";
import { lecturaDeCuadro } from "./src/adi/sentrix/lecturaDeCuadro.js";
import { cuadroSentrix, cajaDelAgente } from "./src/adi/agente/herramientasAgente.js";
import { CONTRATOS_AGENTE } from "./src/adi/agente/catalogoAgente.js";
import { VIEW_MANIFEST } from "./src/adi/sentrix/viewManifest.js";
import { builderOutFor } from "./src/adi/sentrix/viewBuilderRun.js";
import { deriveViewContext } from "./src/adi/sentrix/viewContextFrom.js";
import { buildResumenComercial } from "./src/adi/sentrix/resumenComercial.js";
import { guardC } from "./src/adi/oracle/guardC.js";
import { TOOLS } from "./src/adi/oracle/toolRegistry.js";
import { runPlan } from "./src/adi/oracle/toolRunner.js";

let pass = 0, fail = 0;
const ok = (cond, label, detalle) => {
  if (cond) { pass++; console.log(`  ✓ ${label}`); }
  else { fail++; console.log(`  ✗ ${label}`); if (detalle !== undefined) console.log(`      ${String(detalle).slice(0, 300)}`); }
};
const H = (t) => console.log(`\n${t}`);
const MUDO = async () => ({ tipo: "texto", texto: "" });
const ESC = "actual";
const leer = (rel) => { try { return fs.readFileSync(path.join(process.cwd(), rel), "utf8").replace(/\r\n/g, "\n"); } catch { return ""; } };
/* sin comentarios: la lección de la casa — un chequeo que lee la palabra en un comentario mide la FORMA */
const sinComentarios = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

initTenant(TENANT_DEMO);

/** el ancla VIVA de una pieza: el MISMO camino que corre en la app (builder vivo → ViewContext sellado). */
const ancla = (componentId, controles = {}) =>
  deriveViewContext(componentId, builderOutFor(componentId, ESC), { scenario: ESC, controles, tenantId: getTenantId() });
/** un turno nacido de un CLICK en esa pieza. */
const turno = (componentId, pregunta, controles = {}) => {
  const vc = ancla(componentId, controles);
  return answerViaAgente({ text: pregunta, history: [], mem: {}, scenario: ESC, callAgente: MUDO, viewContext: vc, cuadro: vc });
};
const texto = async (...a) => String((await turno(...a)).r.text || "");

/* LOS BOTONES DE LA MESA, uno por cara — la pregunta es la que el botón manda HOY (contrato congelado). */
const BOTONES = [
  { cid: "comercial/01/tabla-cartera", q: "¿Qué clientes están por debajo de su presupuesto?", ctrl: { todos: "0" } },
  { cid: "comercial/01/pareto-ventas", q: "¿Qué clientes explican el 80% de mi venta?", ctrl: { met: "ventas" } },
  { cid: "comercial/01/pareto-contribucion", q: "¿En cuántos clientes se concentra mi contribución?", ctrl: { met: "contribucion" } },
  { cid: "comercial/01/evolutivo-serie", q: "¿Cómo viene la venta mes a mes este año?", ctrl: {} },
  { cid: "comercial/01/sostiene-clientes", q: "¿Quiénes son mis principales clientes por venta?", ctrl: { eje: "cliente" } },
  { cid: "capital/01/cortes", q: "¿Cuánto capital tengo por bodega?", ctrl: { corte: "bodega" } },
  { cid: "capital/01/liquidar", q: "¿Qué SKU libero primero?", ctrl: {} },
  { cid: "flujo/01/tabla-saldo-clientes", q: "¿Qué clientes me deben más y desde cuándo?", ctrl: {} },
  { cid: "flujo/01/caja-mensual", q: "¿Cómo viene mi entrada de caja mes a mes?", ctrl: {} },
];

/* ═══ 1 · EL ANCLA COMPLETA · los ocho campos que el owner enumeró ══════════════════════════════════════════ */
H("1 · el ancla completa · los ocho campos, sobre el ancla VIVA");
{
  const vc = ancla("comercial/01/pareto-ventas", { met: "ventas" });
  ok(!!vc, "la pieza tocada emite su ancla sellada (builder vivo → ViewContext)");
  const L = lecturaDeCuadro("comercial/01/pareto-ventas", { scenario: ESC, controles: { met: "ventas" } });
  const I = L.identidad || {};
  ok(I.cara === "Comercial" && I.vista === "comercial", "★ 1/8 · CARA / MÓDULO");
  ok(I.cuadro === "Dónde se concentra la venta", "★ 2/8 · NOMBRE DEL CUADRO", I.cuadro);
  ok(I.metrica === "ventas" && !!I.metricaLabel, "★ 3/8 · MÉTRICA PRINCIPAL", I.metricaLabel);
  ok(I.eje === "cliente", "★ 4/8 · EJE O ENTIDAD", I.eje);
  ok(I.periodo === "año cerrado", "★ 5/8 · PERÍODO", I.periodo);
  ok(I.controles && I.controles.met === "ventas", "★ 6/8 · FILTROS APLICADOS (el conmutador activo viaja)", JSON.stringify(I.controles));
  ok(L.ok && L.filas.length >= 5 && L.filas[0].cifras.length >= 1, "★ 7/8 · CIFRAS VISIBLES (las filas del cuadro, del mismo módulo que lo pinta)", L.n);
  const pb = playbookPara("¿Qué clientes explican el 80% de mi venta?", { history: [], cuadro: vc });
  ok(pb && pb.nombre === "cuadro-explicado", "el click abre el playbook del cuadro", pb && pb.nombre);
  const ent = entregableDe(pb, "¿Qué clientes explican el 80% de mi venta?", { cuadro: vc });
  ok(/Dónde se concentra la venta/.test(ent) && /Comercial/.test(ent) && /cliente/.test(ent) && /año cerrado/.test(ent),
    "★ 8/8 · QUÉ PREGUNTA CONCRETA DEBE EXPLICAR — el entregable NOMBRA ese cuadro, no «explica el cuadro» a secas", ent.slice(0, 140));
  const doc = doctrinaDelPlaybook(pb, "¿Qué clientes explican el 80% de mi venta?", { cuadro: vc });
  ok(/cuadroSentrix/.test(doc) && /Dónde se concentra la venta/.test(doc), "…y la doctrina que viaja al cerebro lleva el ancla, no una instrucción genérica");
}

/* ═══ 2 · TRANSVERSAL DE VERDAD · sin lista de cuadros ══════════════════════════════════════════════════════ */
H("2 · transversal · el manifiesto entero, y CERO ramas por cuadro");
{
  const ids = Object.keys(VIEW_MANIFEST);
  const legibles = ids.filter((id) => lecturaDeCuadro(id, { scenario: ESC }).ok);
  ok(legibles.length >= 30, `el lector explica ${legibles.length} de ${ids.length} piezas declaradas — sin una rama por pieza`);
  const caras = new Set(legibles.map((id) => VIEW_MANIFEST[id].vista));
  for (const cara of ["comercial", "capital", "flujo"]) ok(caras.has(cara), `…y llega a la cara ${cara} (transversal, no una cara)`);
  /* LA PRUEBA DE QUE NO ES UN PARCHE: ni el lector ni el playbook nombran un componentId. Si mañana alguien
   * resuelve un cuadro con un `if (componentId === "…")`, esto arde — que es justo lo que el owner prohibió. */
  const src = sinComentarios(leer("src/adi/sentrix/lecturaDeCuadro.js")) + sinComentarios(leer("src/adi/agente/playbooks/cuadroExplicado.js"));
  ok(!/["'][a-z]+\/(?:01|02|03|otro)\/[a-z-]+["']/.test(src), "★ NI UNA rama por cuadro: el código no nombra un solo componentId", (src.match(/["'][a-z]+\/(?:01|02|03|otro)\/[a-z-]+["']/) || [])[0]);
  ok(!/buildResumenComercial|buildMesaCapital|buildMesaFlujo/.test(src), "…ni un builder por nombre: la pieza se resuelve por su declaración");
  ok(CONTRATOS_AGENTE.cuadroSentrix && Array.isArray(CONTRATOS_AGENTE.cuadroSentrix.inputsObligatorios) && CONTRATOS_AGENTE.cuadroSentrix.inputsObligatorios.includes("componentId"),
    "la herramienta está en el catálogo con su input obligatorio (sin dirección no adivina un cuadro)");
  ok(!!cajaDelAgente(TOOLS).cuadroSentrix, "…y en la caja que ejecuta el turno");
}

/* ═══ 3 · CADA BOTÓN RESPONDE SU CUADRO · contra el cuadro VIVO ═════════════════════════════════════════════ */
H("3 · cada botón responde SU cuadro · medido contra el builder vivo");
for (const b of BOTONES) {
  const L = lecturaDeCuadro(b.cid, { scenario: ESC, controles: b.ctrl });
  const t = await texto(b.cid, b.q, b.ctrl);
  const pb = playbookPara(b.q, { history: [], cuadro: ancla(b.cid, b.ctrl) });
  ok(pb && (pb.nombre === "cuadro-explicado" || pb.nombre === "ask-de-cuadro"),
    `«${VIEW_MANIFEST[b.cid].label}» · el click tiene dueño (${pb ? pb.nombre : "NINGUNO"})`);
  ok(t.trim().length > 0 && !/No tengo información autorizada suficiente/i.test(t),
    `…y RESPONDE (ya no cae a «no tengo información suficiente»)`, t.slice(0, 120));
  /* EL ANCLAJE VIVO: la respuesta cita cifras DEL CUADRO — se recorre el builder y se exige que estén */
  if (L.ok && pb && pb.nombre === "cuadro-explicado") {
    const suyas = [...L.cabecera, ...L.filas.flatMap((f) => f.cifras)].map((c) => c.valor);
    const citadas = suyas.filter((v) => t.includes(v));
    ok(citadas.length >= 3, `…con las cifras DE ESE cuadro (${citadas.length} del builder vivo aparecen en la respuesta)`, t.slice(0, 140));
    const nombres = L.filas.map((f) => f.nombre).filter((n) => n.length >= 3);
    ok(!nombres.length || nombres.some((n) => t.includes(n)), "…y nombrando sus propias filas, no otro corte");
  }
}

/* ═══ 4 · EL 80/20 SE EXPLICA COMO 80/20 · y el conmutador cambia la respuesta ══════════════════════════════ */
H("4 · el 80/20 · «si el cuadro muestra un 80/20, explica el 80/20»");
{
  const R = buildResumenComercial(ESC);
  const tV = await texto("comercial/01/pareto-ventas", "¿Qué clientes explican el 80% de mi venta?", { met: "ventas" });
  const tC = await texto("comercial/01/pareto-contribucion", "¿En cuántos clientes se concentra mi contribución?", { met: "contribucion" });
  ok(/\b80\s?%/.test(tV), "★ la respuesta del Pareto EXPLICA el 80%, no sirve un ranking", tV.slice(0, 140));
  ok(tV.includes(R.pareto.ventas.cruce80), `…y dice DÓNDE se cruza (${R.pareto.ventas.cruce80}, del cuadro vivo)`, tV.slice(0, 140));
  ok(tV.includes(String(R.pareto.ventas.entidadesReales)), `…y sobre cuántos (${R.pareto.ventas.entidadesReales}: el universo, no las barras dibujadas)`);
  ok(tC.includes(R.pareto.contribucion.cruce80), `★ y en CONTRIBUCIÓN cruza en otro (${R.pareto.contribucion.cruce80}) — «si el usuario cambia a contribución, debe explicarlo también»`, tC.slice(0, 140));
  ok(tV !== tC, "…las dos respuestas son DISTINTAS: el conmutador cambia el cuadro, y con él la explicación");
  /* la cifra del cuadro de contribución no es la del de ventas: universos distintos jamás se mezclan */
  const bV = (R.pareto.ventas.barras[0] || {}).fmt, bC = (R.pareto.contribucion.barras[0] || {}).fmt;
  ok(tC.includes(bC) && !tC.includes(bV), "…y la respuesta de contribución cita SU cifra, jamás la de la venta", `${bC} vs ${bV}`);
  /* la lista notarial lo exige: un 80/20 respondido como orden simple recibe multa */
  const vc = ancla("comercial/01/pareto-ventas", { met: "ventas" });
  const generico = "Así viene tu venta por cliente, de mayor a menor:\n- Falabella: $19.4M\n- Lider: $17.9M";
  const v = vetosDelPlaybook(cuadroExplicado, generico, { pregunta: "¿Qué clientes explican el 80% de mi venta?", ctx: { cuadro: vc } });
  ok(v.some((x) => x.regla === "concentracion-sin-explicar"), "★ el ranking genérico recibe MULTA del propio playbook (era el defecto que el owner midió)", JSON.stringify(v));
  ok(vetosDelPlaybook(cuadroExplicado, tV, { pregunta: "¿Qué clientes explican el 80% de mi venta?", ctx: { cuadro: vc } }).length === 0,
    "…y no se veta a sí mismo: el entregable determinístico pasa su propia lista");
}

/* ═══ 5 · EL PRESUPUESTO SE EXPLICA COMO PRESUPUESTO ════════════════════════════════════════════════════════ */
H("5 · «si el cuadro muestra presupuesto, explica presupuesto»");
{
  const t = await texto("comercial/01/tabla-cartera", "¿Qué clientes están por debajo de su presupuesto?", { todos: "0" });
  ok(/presupuesto/i.test(t), "★ el cuadro que compara contra presupuesto lo NOMBRA en la respuesta", t.slice(0, 160));
  const R = buildResumenComercial(ESC);
  ok(t.includes(R.cartera.lectura) || /bajo su presupuesto/i.test(t), "…con la lectura que el propio cuadro publica", R.cartera.lectura);
}

/* ═══ 6 · SIN DATO, SE DICE QUÉ FALTA ═══════════════════════════════════════════════════════════════════════ */
H("6 · «si no existe dato suficiente para ese cuadro, debe decir exactamente qué falta»");
{
  /* ⚠️ SE MIDE PIEZA POR PIEZA, NO POR TURNO, Y ESO SE DESCUBRIÓ MIDIENDO: cuando el dato no sostiene un cuadro,
   * el EMISOR tampoco emite ancla (`deriveViewContext` exige que el campo declarado resuelva), así que por la
   * app ese click no llega con dirección y el turno es libre — y en pantalla ese cuadro ni siquiera está: el
   * Resultado muestra su estado vacío. La defensa igual tiene que existir, porque el caso real es el tenant
   * cuya carga PIERDE una pieza que otra carga sí traía; ahí el ancla existe y el contenido no. Se prueba
   * exactamente eso: con la dirección en la mano y el contenido ausente. */
  const L = lecturaDeCuadro("resultado/01/cuadro", { scenario: ESC });
  ok(!L.ok && L.motivo === "sin-campo", "el cuadro del Resultado no tiene dato en esta carga (el P&L no está armado)", L.motivo);
  ok(/no trae|opcional|no publicó/i.test(String(L.falta || "")), "…y la razón dice QUÉ falta, en palabras de negocio", L.falta);
  const r = cuadroSentrix({ componentId: "resultado/01/cuadro", scenario: ESC });
  ok(r.coverage.supported === false && r.coverage.reason === L.falta && !r.boleta.length,
    "★ la herramienta declina con ESA razón y sin una sola cifra (el string va a pantalla y al prompt)", r.coverage.reason);
  const ctxFalta = { cuadro: { componentId: "resultado/01/cuadro", controles: {} } };
  ok(cuadroExplicado.cuandoAplica("¿Cómo viene mi resultado por entidad?", ctxFalta) === true,
    "…y el playbook SÍ abre: decir qué falta es responder, no callarse");
  const t = String(cuadroExplicado.componer({ pregunta: "¿Cómo viene mi resultado por entidad?", semilla: "s", ctx: ctxFalta, scenario: ESC }) || "");
  ok(/no trae|opcional|no publicó/i.test(t), "★ y el entregable DICE qué falta", t.slice(0, 200));
  ok(!/Falabella|Lider|Jumbo/.test(t), "…y NO sirve otro corte en su lugar (un cuadro respondido con otro es peor que un límite honesto)", t.slice(0, 200));
  ok(/Resultado/.test(t), "…nombrando la cara desde la que se preguntó, para que el usuario sepa de qué se le habla");
  /* el límite del LECTOR no se disfraza de límite del dato: con `sin-cifras` el playbook no abre */
  const sinCifras = lecturaDeCuadro("comercial/otro/cuadro-mando", { scenario: ESC });
  ok(!sinCifras.ok && sinCifras.motivo === "sin-cifras", "una pieza que pinta números pero no los publica citables se marca como límite MÍO, no del dato", sinCifras.motivo);
  ok(cuadroExplicado.cuandoAplica("explicame esto", { cuadro: ancla("comercial/otro/cuadro-mando") }) === false,
    "★ …y ahí el playbook NO abre: jamás decirle al usuario que su dato no trae algo que sí trae");
}

/* ═══ 7 · UN CLICK, UN TURNO ════════════════════════════════════════════════════════════════════════════════ */
H("7 · un click, un turno · el ambiente de la vista no abre la explicación de cuadro");
{
  const vc = ancla("comercial/01/pareto-ventas", { met: "ventas" });
  ok(cuadroExplicado.cuandoAplica("¿Qué clientes explican el 80% de mi venta?", { cuadro: vc }) === true, "con el ancla del click, abre");
  ok(cuadroExplicado.cuandoAplica("¿Qué clientes explican el 80% de mi venta?", { viewContext: vc }) === false,
    "★ con el contexto AMBIENTE (sin click) NO abre — si no, la pregunta siguiente escrita a mano se respondería como un botón");
  ok(cuadroExplicado.cuandoAplica("como viene mi margen", {}) === false, "sin ancla, no toma ningún turno libre");
  const vista = ancla("comercial/otro/vista");
  ok(!vista || cuadroExplicado.cuandoAplica("explicame esto", { cuadro: vista }) === false,
    "…y el contexto de la VISTA entera tampoco: identifica la pantalla, no autoriza ninguna cifra");
  /* y el canal está cableado de punta a punta: la UI manda el explícito, no el ambiente */
  const chat = sinComentarios(leer("src/ui/ChatADI.jsx"));
  ok(/cuadro: viewContext \|\| null/.test(chat), "★ la UI manda por el canal del cuadro SOLO el click del turno (el ambiente queda fuera)");
  const bucle = sinComentarios(leer("src/adi/agente/bucleAgente.js"));
  ok(/const ctxTurno = \{ history, viewContext, cuadro \}/.test(bucle), "…y el bucle lo pasa entero a la cadena del playbook");
}

/* ═══ 8 · NADA SE AFLOJA · el muro juzga lo compuesto ═══════════════════════════════════════════════════════ */
/* ⚠️ LA BOLETA SE RECONSTRUYE CON `runPlan` SOBRE LOS PASOS DEL PLAYBOOK, no se saca del expediente del turno:
 * `r.evidence` del agente no publica el ledger, así que juzgar con eso era juzgar contra una boleta VACÍA — y
 * todo salía rojo por culpa del arnés, no del producto. Es el patrón del gate de playbooks, y la lección de la
 * casa otra vez: cuando todo se pone rojo a la vez, sospechar del instrumento antes que del sistema. */
H("8 · el muro intacto · el entregable pasa guardC contra la boleta que sus pasos traen");
for (const b of BOTONES.slice(0, 6)) {
  const r = await turno(b.cid, b.q, b.ctrl);
  const t = String(r.r.text || "");
  const ag = r.r.agente || {};
  if (!t.trim()) { ok(false, `«${VIEW_MANIFEST[b.cid].label}» · el turno respondió`, "(vacío)"); continue; }
  ok(!(ag.vetos || []).length && ag.estado !== "limite", `«${VIEW_MANIFEST[b.cid].label}» · el turno sale SIN vetos del muro (estado ${ag.estado})`, JSON.stringify(ag.vetos || []));
  const vcB = ancla(b.cid, b.ctrl);
  const pb = playbookPara(b.q, { history: [], cuadro: vcB });
  const rp = runPlan({ intent: "answer", calls: pasosDe(pb, b.q, { history: [], cuadro: vcB }).map((p) => ({ tool: p.tool, args: p.args })) },
    { scenario: ESC, maxCalls: 8, preguntaUsuario: b.q, registry: cajaDelAgente(TOOLS) });
  const g = guardC(t, { ledger: { figs: (rp.ledger && rp.ledger.figs) || [] }, question: b.q });
  ok(g.ok !== false, `…y el muro lo confirma por su cuenta contra la boleta de sus pasos`, JSON.stringify((g.violations || []).slice(0, 3)));
  ok(!/componentId|grupoN|colaN|entidadesReales|acumuladoPct|[a-z]+\/(?:01|02|03)\//.test(t),
    `…y sin una sola palabra de jerga interna en pantalla`, (t.match(/componentId|grupoN|colaN|entidadesReales|acumuladoPct/) || [])[0]);
  ok(!/\b(plata|vara|dormido|guita|palanca|apretar)\b/i.test(t), "…y en registro ejecutivo");
}

/* ═══ 9 · EL EMISOR · todo botón manda el ancla ═════════════════════════════════════════════════════════════ */
H("9 · el emisor · «el botón no manda solo texto»");
{
  const P = leer("src/ui/SentrixPanel.jsx");
  const lineas = P.split("\n");
  /* LAS EXCEPCIONES SE DECLARAN ACÁ, CON SU RAZÓN — y son parte del candado: mientras estén, están a la vista.
   * Las dos son superficies de NIVEL 2 (lo que ADI abre al responder), no cuadros de la Mesa, y ninguna está
   * declarada en el manifiesto como pieza con contenido citable: anclarlas es trabajo propio, no un olvido. */
  const EXCEPCIONES = [
    { marca: "CapitalDrill", razon: "la tabla de drill de Capital no está declarada en el manifiesto: anclarla pide entrada nueva + emisor propio" },
    { marca: "MesaPareto", razon: "el Pareto del Cuadro cambia de universo con la selección (negocio · posición · composición): son tres piezas, no una" },
  ];
  /* ⚠️ SE BUSCA LA LLAMADA AL BOTÓN, NO LA FRASE: el archivo cita «Que ADI lo explique» dentro de comentarios
   * (la palabra del owner, conservada donde se aplicó) y contarlos como botones era medir la FORMA — el defecto
   * que esta casa persigue. Un botón de verdad es una llamada a `_btnADI(...)` o `_link(...)`. */
  const conBoton = [];
  lineas.forEach((ln, i) => { if (/Que ADI lo explique/.test(ln) && /_btnADI\(|_link\(/.test(ln)) conBoton.push({ n: i + 1, ln }); });
  ok(conBoton.length >= 6, `hay ${conBoton.length} botones «Que ADI lo explique» en la Mesa`);
  let anclados = 0, exceptuados = 0, sueltos = [];
  for (const b of conBoton) {
    /* un botón anclado llama a un `ask` que salió del hook (askX / _askX / vX.ask), nunca a `onAsk` pelado */
    if (/\bask[A-Z_a-z]*\(|_ask[A-Za-z]*\)|\bask\)/.test(b.ln) && !/onAsk\(/.test(b.ln)) { anclados++; continue; }
    const ctx = lineas.slice(Math.max(0, b.n - 260), b.n).join("\n");
    const exc = EXCEPCIONES.find((e) => new RegExp(`function ${e.marca}\\b`).test(ctx));
    if (exc) { exceptuados++; continue; }
    sueltos.push(b.n);
  }
  ok(sueltos.length === 0, `★ todo botón manda el ancla (${anclados} anclados · ${exceptuados} excepción declarada) — uno nuevo que se olvide pone esto rojo`, `líneas sueltas: ${sueltos.join(", ")}`);
  ok(exceptuados === EXCEPCIONES.length, `…y las ${EXCEPCIONES.length} excepciones siguen siendo exactamente las declaradas, con su razón escrita`, `${exceptuados}`);
}

/* ═══ 10 · CARNADAS ═════════════════════════════════════════════════════════════════════════════════════════ */
H("10 · carnadas · cada garantía, probada ROJA sobre una copia mutada del código vivo");
{
  const tmp = []; let n = 0;
  const mutar = (rel, reemplazos) => {
    const abs = path.join(process.cwd(), rel);
    let txt = fs.readFileSync(abs, "utf8").replace(/\r\n/g, "\n");
    for (const [de, a] of reemplazos) {
      const antes = txt;
      txt = txt.replace(de, a);
      if (txt === antes) return { error: `la carnada no encontró qué mutar en ${rel}` };
    }
    const destino = abs.replace(/\.js$/, `.carnada${process.pid}_${++n}.js`);
    fs.writeFileSync(destino, txt);
    tmp.push(destino);
    return { url: pathToFileURL(destino).href };
  };
  const carnada = async (nombre, rel, reemplazos, prueba) => {
    const m = mutar(rel, reemplazos);
    if (m.error) return ok(false, `carnada «${nombre}»`, m.error);
    let cazada = false, detalle = "";
    try { cazada = await prueba(await import(m.url)); }
    catch (e) { detalle = `la copia mutada ni siquiera carga: ${e.message}`; }
    ok(cazada, `carnada «${nombre}» → el chequeo se pone ROJO`, detalle || "el defecto pasó DESAPERCIBIDO");
  };

  // (a) el ancla del click se pierde en el bucle → el botón vuelve a responder una pregunta libre
  await carnada("el ancla no llega al playbook", "src/adi/agente/bucleAgente.js",
    [[/const ctxTurno = \{ history, viewContext, cuadro \};/, "const ctxTurno = { history, viewContext };"]],
    async (Mut) => {
      initTenant(TENANT_DEMO);
      const vc = ancla("comercial/01/pareto-ventas", { met: "ventas" });
      const r = await Mut.answerViaAgente({ text: "¿Qué clientes explican el 80% de mi venta?", history: [], mem: {}, scenario: ESC, callAgente: MUDO, viewContext: vc, cuadro: vc });
      return !/\b80\s?%/.test(String(r.r.text || ""));   // el defecto: vuelve el ranking sin el 80/20
    });

  // (b) el ambiente abre la explicación → la pregunta siguiente escrita a mano se responde como un botón
  await carnada("el ambiente abre el cuadro (un click contamina el turno siguiente)", "src/adi/agente/playbooks/cuadroExplicado.js",
    [[/const c = ctx && ctx\.cuadro && typeof ctx\.cuadro === "object" \? ctx\.cuadro : null;/,
      'const c = (ctx && (ctx.cuadro || ctx.viewContext)) && typeof (ctx.cuadro || ctx.viewContext) === "object" ? (ctx.cuadro || ctx.viewContext) : null;']],
    async (Mut) => {
      initTenant(TENANT_DEMO);
      const vc = ancla("comercial/01/pareto-ventas", { met: "ventas" });
      return Mut.cuadroExplicado.cuandoAplica("como viene mi margen", { viewContext: vc }) === true;
    });

  // (c) el lector deja de anclar por módulo y adivina el corte → la respuesta deja de ser la del cuadro
  await carnada("el corte activo se ignora (se responde otro cuadro del mismo cuadro)", "src/adi/sentrix/lecturaDeCuadro.js",
    [[/const pedida = Object\.values\(controles \|\| \{\}\)\.map\(\(x\) => String\(x\)\)\.find\(\(x\) => claves\.includes\(x\)\);/,
      "const pedida = null;"]],
    async (Mut) => {
      initTenant(TENANT_DEMO);
      const L = Mut.lecturaDeCuadro("capital/01/cortes", { scenario: ESC, controles: { corte: "familia" } });
      return !!L.ok && L.corte && L.corte.key !== "familia";   // el defecto: sirve el corte por defecto, no el que el usuario mira
    });

  // (d) la herramienta inventa cuando el cuadro no tiene dato, en vez de decir qué falta
  await carnada("el cuadro sin dato deja de declarar su falta", "src/adi/agente/herramientasAgente.js",
    [[/  const L = lecturaDeCuadro\(componentId, \{ scenario, controles \}\);\n  if \(!L\.ok\) return sinSoporte\(L\.falta\);/,
      "  const L = lecturaDeCuadro(componentId, { scenario, controles });\n  if (!L.ok) return sinSoporte(\"no pude leer el cuadro\");"]],
    async (Mut) => {
      initTenant(TENANT_DEMO);
      const r = Mut.cuadroSentrix({ componentId: "resultado/01/cuadro", scenario: ESC });
      return !/no trae|opcional/i.test(String(r.coverage.reason || ""));   // el defecto: una razón genérica, sin decir QUÉ falta
    });

  for (const f of tmp) { try { fs.unlinkSync(f); } catch { /* limpieza best-effort */ } }
}

console.log(`\n── _ancla_de_cuadro_gate: ${pass} PASS · ${fail} FAIL (de ${pass + fail}) ──`);
process.exit(fail ? 1 : 0);
