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
import { cuadroExplicado, _olvidarMemoDelCuadro } from "./src/adi/agente/playbooks/cuadroExplicado.js";
import { vetosDelPorque } from "./src/adi/agente/porque.js";   // §5k mide la ley donde vive: en la casa, no en el playbook
import { lecturaDeCuadro } from "./src/adi/sentrix/lecturaDeCuadro.js";
import { cuadroSentrix, cajaDelAgente } from "./src/adi/agente/herramientasAgente.js";
import { CONTRATOS_AGENTE } from "./src/adi/agente/catalogoAgente.js";
import { VIEW_MANIFEST, tituloDeExplicacion } from "./src/adi/sentrix/viewManifest.js";
import { builderOutFor } from "./src/adi/sentrix/viewBuilderRun.js";
import { deriveViewContext } from "./src/adi/sentrix/viewContextFrom.js";
import { buildResumenComercial } from "./src/adi/sentrix/resumenComercial.js";
import { guardC } from "./src/adi/oracle/guardC.js";
import { TOOLS } from "./src/adi/oracle/toolRegistry.js";
import { runPlan } from "./src/adi/oracle/toolRunner.js";
import { cifrasDelDato } from "./src/adi/oracle/datoProyectado.js";   // §5d · el juez de superlativos compara contra los RANKINGS DECLARADOS del dato

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

/* LOS BOTONES DE LA MESA, uno por cara. El texto que mandan es EL TÍTULO derivado del manifiesto (owner
 * 2026-09-08: «al hacer click no debería ir una pregunta sino el título de la tabla») — la intención ya no
 * viaja en la pregunta: viaja en el ancla, y por eso acá no hay una pregunta escrita a mano por botón. */
const BOTONES = [
  { cid: "comercial/01/tabla-cartera", ctrl: { todos: "0" } },
  { cid: "comercial/01/pareto-ventas", ctrl: { met: "ventas" } },
  { cid: "comercial/01/pareto-contribucion", ctrl: { met: "contribucion" } },
  { cid: "comercial/01/evolutivo-serie", ctrl: {} },
  { cid: "comercial/01/sostiene-clientes", ctrl: { eje: "cliente" } },
  { cid: "capital/01/cortes", ctrl: { corte: "bodega" } },
  { cid: "capital/01/liquidar", ctrl: {} },
  { cid: "flujo/01/tabla-saldo-clientes", ctrl: {} },
  { cid: "flujo/01/caja-mensual", ctrl: {} },
].map((b) => ({ ...b, q: tituloDeExplicacion(b.cid) }));

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
  const tCk = tituloDeExplicacion("comercial/01/pareto-ventas");
  ok(tCk === "Explicando dónde se concentra la venta", "el click manda EL TÍTULO derivado del manifiesto, no una pregunta escrita a mano", tCk);
  const pb = playbookPara(tCk, { history: [], cuadro: vc });
  ok(pb && pb.nombre === "cuadro-explicado", "el click abre el playbook del cuadro", pb && pb.nombre);
  const ent = entregableDe(pb, tCk, { cuadro: vc });
  ok(/Dónde se concentra la venta/.test(ent) && /Comercial/.test(ent) && /cliente/.test(ent) && /año cerrado/.test(ent),
    "★ 8/8 · QUÉ PREGUNTA CONCRETA DEBE EXPLICAR — el entregable NOMBRA ese cuadro, no «explica el cuadro» a secas", ent.slice(0, 140));
  const doc = doctrinaDelPlaybook(pb, tCk, { cuadro: vc });
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
  const tV = await texto("comercial/01/pareto-ventas", tituloDeExplicacion("comercial/01/pareto-ventas"), { met: "ventas" });
  const tC = await texto("comercial/01/pareto-contribucion", tituloDeExplicacion("comercial/01/pareto-contribucion"), { met: "contribucion" });
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
  const v = vetosDelPlaybook(cuadroExplicado, generico, { pregunta: tituloDeExplicacion("comercial/01/pareto-ventas"), ctx: { cuadro: vc } });
  ok(v.some((x) => x.regla === "concentracion-sin-explicar"), "★ el ranking genérico recibe MULTA del propio playbook (era el defecto que el owner midió)", JSON.stringify(v));
  ok(vetosDelPlaybook(cuadroExplicado, tV, { pregunta: tituloDeExplicacion("comercial/01/pareto-ventas"), ctx: { cuadro: vc } }).length === 0,
    "…y no se veta a sí mismo: el entregable determinístico pasa su propia lista");
}

/* ═══ 5 · EL PRESUPUESTO SE EXPLICA COMO PRESUPUESTO · interpretando, no calcando ═══════════════════════════ */
H("5 · «si el cuadro muestra presupuesto, explica presupuesto» — y aporta lo que la tabla no dice");
{
  const t = await texto("comercial/01/tabla-cartera", tituloDeExplicacion("comercial/01/tabla-cartera"), { todos: "0" });
  ok(/presupuesto/i.test(t), "★ el cuadro que compara contra presupuesto lo NOMBRA en la respuesta", t.slice(0, 160));
  const R = buildResumenComercial(ESC);
  /* la historia se mide contra las BANDERAS VIVAS del builder: quiénes caen por presupuesto y quiénes por año.
   * La respuesta tiene que nombrar a las que caen — y la EXCEPCIÓN (cae por un lado y no por el otro) es la
   * noticia que la tabla tiene y no dice: el corazón del encargo del owner. */
  const caenPre = R.cartera.filas.filter((f) => f.vsPresupuesto && f.vsPresupuesto.hay !== false && f.vsPresupuesto.dir === "baja").map((f) => f.nombre);
  const caenAnt = R.cartera.filas.filter((f) => f.vsAnterior && f.vsAnterior.hay !== false && f.vsAnterior.dir === "baja").map((f) => f.nombre);
  ok(caenPre.length >= 2 && caenPre.every((n) => t.includes(n)), `…nombrando a las ${caenPre.length} que el cuadro marca bajo presupuesto (banderas vivas del builder)`, caenPre.join(", "));
  const excepcion = caenAnt.filter((n) => !caenPre.includes(n));
  if (excepcion.length === 1) ok(t.includes(excepcion[0]), `★ y dice LA EXCEPCIÓN (${excepcion[0]}: cae contra el año y aun así cumple su plan) — información que la tabla tiene y no muestra sola`, t.slice(0, 220));
  ok(!t.includes(R.cartera.lectura), "…sin CALCAR la frase que la pantalla ya muestra bajo el cuadro (interpretar, no duplicar)", R.cartera.lectura);
}

/* ═══ 5b · INTERPRETAR, NO RECITAR (owner 2026-09-08, segunda regla) ════════════════════════════════════════ */
H("5b · «usa el cuadro como evidencia, no como texto a recitar» · 2-4 cifras, no todas las filas");
{
  const R = buildResumenComercial(ESC);
  const t = await texto("comercial/01/tabla-cartera", tituloDeExplicacion("comercial/01/tabla-cartera"), { todos: "0" });
  const nombrados = R.cartera.filas.map((f) => f.nombre).filter((n) => t.includes(n));
  /* el resumen POR DIMENSIÓN nombra filas con propósito (rango del margen, la inversión, las que caen): hasta 8
   * caben en eso — pasar de ahí es la tabla otra vez (mismo umbral que la multa cuadro-recitado) */
  ok(nombrados.length >= 1 && nombrados.length <= 8, `★ nombra ${nombrados.length} de ${R.cartera.filas.length} filas — evidencia con propósito, no la tabla otra vez`, nombrados.join(", "));
  ok(/qu[eé] pasa|implica|lectura que importa|tapa lo que cae|empezar[ií]a|mirar[ií]a|partir[ií]a/i.test(t),
    "…y dice qué implica / por dónde empezar — no solo qué hay", t.slice(0, 200));
  /* la lista notarial del playbook multa las dos formas del defecto, con carnada de texto */
  const vc5 = ancla("comercial/01/tabla-cartera", { todos: "0" });
  const recitado = R.cartera.filas.slice(0, 10).map((f) => `· ${f.nombre}: venta ${f.ventaFmt}`).join("\n");
  const vRec = vetosDelPlaybook(cuadroExplicado, `Esto muestra el cuadro:` + "\n" + recitado, { pregunta: "x", ctx: { cuadro: vc5 } });
  ok(vRec.some((x) => x.regla === "cuadro-recitado"), "★ recitar las filas recibe MULTA del propio playbook", JSON.stringify(vRec.map((x) => x.regla)));
  const vCal = vetosDelPlaybook(cuadroExplicado, `Mira: ${R.cartera.lectura} Eso es lo que hay.`, { pregunta: "x", ctx: { cuadro: vc5 } });
  ok(vCal.some((x) => x.regla === "cuadro-calcado"), "★ calcar la frase de la pantalla recibe MULTA — interpretar, no duplicar", JSON.stringify(vCal.map((x) => x.regla)));
  ok(vetosDelPlaybook(cuadroExplicado, t, { pregunta: "x", ctx: { cuadro: vc5 } }).length === 0, "…y el entregable determinístico pasa sus propias reglas");
}

/* ═══ 5c · EL RESUMEN EJECUTIVO POR DIMENSIÓN · y «profundiza en…» (owner 2026-09-08, tercera entrega) ══════ */
H("5c · «un resumen ejecutivo de esa tabla» — dimensión por dimensión, y la profundización que sigue");
{
  const R6 = buildResumenComercial(ESC);
  const vc6 = ancla("comercial/01/tabla-cartera", { todos: "0" });
  const t6 = tituloDeExplicacion("comercial/01/tabla-cartera");
  const r1 = await answerViaAgente({ text: t6, history: [], mem: {}, scenario: ESC, callAgente: MUDO, viewContext: vc6, cuadro: vc6 });
  const T1 = String(r1.r.text || "");
  /* EL ARCO del owner (cuarta entrega: su lectura escrita a mano es el estándar) — se mide por CONCEPTO
   * contra el builder vivo, jamás por rótulos de sección (la lección de siempre: forma ≠ concepto) */
  ok(/pero el crecimiento est[aá] concentrado/.test(T1), "★ abre con la TESIS — la tensión de fondo, no un dato", T1.split("\n")[0]);
  const _acum3 = (buildResumenComercial(ESC).pareto.ventas.barras[2] || {}).acumuladoPct;
  ok(_acum3 ? T1.includes(`${_acum3}%`) : true, `★ la concentración con el acumulado que publica la curva de la MISMA cara (${_acum3}%) — leído, no sumado`, T1.slice(0, 400));
  ok(/La raz[oó]n est[aá] en el margen/.test(T1), "★ vender ≠ aportar lleva SU RAZÓN (el margen que lo explica), no solo el contraste");
  ok(/margen bajo el promedio de tu cartera \(25\.1%\)/.test(T1) && /calidad del mix/.test(T1),
    "★ la calidad del MIX: dónde crece respecto del promedio de la cartera (la fila Total del cuadro)");
  ok(/merece atenci[oó]n especial/.test(T1) && /34\.0%/.test(T1) && /2\.9%/.test(T1),
    "★ el deterioro PONDERADO: la que pesa poco pero cuyo margen hace más cara cada venta perdida (La Polar, del builder vivo)");
  ok(/En s[ií]ntesis/.test(T1) && /tensiones/.test(T1), "★ y cierra con la síntesis de las tensiones + la prioridad reformulada");
  ok(/vs presupuesto/.test(T1) && /vs año anterior/.test(T1), "…y las comparaciones QUE EXISTEN en este cuadro (año anterior y presupuesto)");
  /* la INVERSIÓN venta↔contribución, medida contra el crudo vivo del builder: si existe un par invertido, el
   * resumen lo dice con las cuatro cifras — es la clase de cosa que el usuario no ve solo mirando la tabla */
  const filas6 = R6.cartera.filas;
  const hayInversion = filas6.some((a, i) => filas6.slice(i + 1).some((b) => b.contribucion > a.contribucion));
  if (hayInversion) ok(/vender m[aá]s y aportar m[aá]s/.test(T1) && /deja .* de contribuci[oó]n/.test(T1),
    "★ y dice la INVERSIÓN (deja más contribución vendiendo menos) — con cada cifra pegada a su métrica", T1.slice(0, 300));
  ok((r1.r.agente.vetos || []).length === 0, "…sin un solo veto del muro", JSON.stringify(r1.r.agente.vetos || []));
  ok(r1.mem && r1.mem.cuadroAbierto && r1.mem.cuadroAbierto.componentId === "comercial/01/tabla-cartera",
    "★ el cuadro queda ABIERTO en la memoria del hilo (dirección, jamás cifras)", JSON.stringify(r1.mem.cuadroAbierto));

  /* T2 · «profundiza en la contribución» — SIN click: el ancla viene de la memoria del hilo */
  const hist = [{ role: "user", text: t6 }, { role: "adi", text: T1 }];
  const r2 = await answerViaAgente({ text: "profundiza en la contribución", history: hist, mem: r1.mem, scenario: ESC, callAgente: MUDO });
  const T2 = String(r2.r.text || "");
  ok(/contribuci[oó]n de este cuadro/i.test(T2) && /Arriba est[aá]n/.test(T2), "★ «profundiza en la contribución» SIGUE sobre el mismo cuadro, sin click nuevo", T2.slice(0, 140));
  const topC = [...filas6].sort((a, b) => b.contribucion - a.contribucion)[0];
  ok(T2.includes(topC.nombre) && T2.includes(topC.contribucionFmt), `…con la punta real de esa columna (${topC.nombre} ${topC.contribucionFmt}, del builder vivo)`);
  /* T3 · encadenada a otra dimensión */
  const hist3 = [...hist, { role: "user", text: "profundiza en la contribución" }, { role: "adi", text: T2 }];
  const r3 = await answerViaAgente({ text: "profundiza en la participación", history: hist3, mem: r2.mem, scenario: ESC, callAgente: MUDO });
  ok(/participaci[oó]n de este cuadro/i.test(String(r3.r.text || "")), "…y encadena a otra dimensión («profundiza en la participación»)");
  /* T4 · una pregunta LIBRE con el cuadro en memoria NO se responde como cuadro (la memoria desambigua, no secuestra) */
  const r4 = await answerViaAgente({ text: "como viene mi margen?", history: hist3, mem: r2.mem, scenario: ESC, callAgente: MUDO });
  ok(!/de este cuadro, por dentro/i.test(String(r4.r.text || "")), "★ una pregunta libre con el cuadro en memoria NO se responde como cuadro");
  /* la caducidad: a las >8 entradas de hilo, la memoria del cuadro expira */
  const histViejo = Array.from({ length: 12 }, (_, i) => ({ role: i % 2 ? "adi" : "user", text: `turno ${i}` }));
  const r5 = await answerViaAgente({ text: "profundiza en la contribución", history: histViejo, mem: r1.mem, scenario: ESC, callAgente: MUDO });
  ok(!/contribuci[oó]n de este cuadro/i.test(String(r5.r.text || "")), "…y el cuadro abierto CADUCA: nueve entradas después ya no reabre solo");
}

/* ═══ 5d · LA REDACCIÓN DEL ASESOR PASA EL MURO (owner 2026-09-08, cuarta entrega) ══════════════════════════
 * «El muro debe corroborar que nada se invente… nuestro trabajo es que el muro siga siendo supervisor y que el
 * agente pueda redactar. Busca la manera sin perder calidad.» El estándar es SU texto, escrito a mano: si el
 * muro se lo veta al cerebro, el agente queda preso del entregable determinístico — que es lo que él vio. */
H("5d · el texto que el owner escribió a mano PASA el muro — y el veneno sigue muriendo");
{
  const figsW = cuadroSentrix({ componentId: "comercial/01/tabla-cartera", scenario: ESC }).boleta;
  /* ⚠️ CON datoProyectado, SIEMPRE: el juez de superlativos verifica contra los rankings declarados de la
   * carpeta — sin ellos queda mudo y esta aceptación mediría el muro a MEDIAS (cazado: el posesivo falso
   * «pasaba» porque el juez ni corría). El arnés juzga con lo mismo que el turno real. */
  const juzgaW = (t) => (guardC(t, { ledger: { figs: figsW }, question: "x", datoProyectado: cifrasDelDato(ESC) }).violations || []);
  const TEXTO_OWNER = [
    "La cartera está creciendo, pero el crecimiento está concentrado y no todas las ventas están aportando la misma calidad de resultado.",
    "Las ventas llegan a $100.0M, +7.6% vs año anterior y +3.1% sobre presupuesto. El desempeño general es positivo, impulsado principalmente por Lider, Jumbo, Falabella y Mercado Libre.",
    "La primera señal relevante es la concentración: Falabella, Lider y Jumbo representan 54.6% de las ventas. Esto sostiene el crecimiento, pero también hace que buena parte del resultado dependa de pocas cuentas.",
    "Hay además una diferencia importante entre vender más y aportar más. Falabella vende $19.4M y genera $4.3M de contribución, mientras Jumbo, con $17.3M de venta, genera prácticamente lo mismo: $4.2M. La razón está en el margen: 24.0% en Jumbo versus 22.0% en Falabella.",
    "El crecimiento también se está produciendo principalmente en cuentas cuyo margen está por debajo del promedio de la cartera (25.1%): Falabella 22.0%, Lider 21.5% y Jumbo 24.0%.",
    "El principal foco de deterioro está en Ripley, Easy y La Polar, que caen simultáneamente contra año anterior y presupuesto. La Polar merece especial atención, porque aunque representa solo 2.9% de las ventas, tiene el margen más alto entre estas cuentas (34.0%).",
    "Yo profundizaría primero en La Polar y Ripley, y después revisaría qué está explicando el menor margen relativo de Lider y Falabella.",
  ].join("\n\n");
  ok(juzgaW(TEXTO_OWNER).length === 0, "★★ EL TEXTO DEL OWNER, verbatim con las cifras del demo, pasa el muro SIN un solo veto",
    JSON.stringify(juzgaW(TEXTO_OWNER).slice(0, 2)));
  /* las dos calibraciones que lo hicieron posible, cada una con su corpus de VENENO intacto */
  for (const [bait, motivo] of [
    ["Tu venta fue de $4.2M.", "una contribución vestida de venta (mención sin cifra que la tome)"],
    ["Falabella vende $19.4M, mientras Jumbo vende $4.2M.", "el segundo «vende» queda libre: solo tiene delante a la juzgada"],
    ["Jumbo vende $17.3M, y su venta neta fue de $4.2M.", "«y su» abre afirmación nueva — el conector no toma"],
    ["Jumbo facturó $4.2M este año.", "el pretérito acentuado que el vocabulario viejo no veía (agujero preexistente)"],
  ]) {
    ok(juzgaW(bait).some((v) => v.kind === "metrica-mal-atribuida"), `veneno muerto: «${bait.slice(0, 52)}» — ${motivo}`);
  }
  /* el posesivo singular se prueba EN EL CONTEXTO de la oración del owner (4 nombres en juego): con un solo
   * nombre en la oración la regla nunca juzgó —conjunto < 2— y exigirlo acá sería cobrarle conducta nueva */
  ok(juzgaW("Yo profundizaría primero en La Polar y Lider, y después revisaría qué está explicando el menor margen relativo de Ripley.").some((v) => v.kind === "superlativo-no-sostenido"),
    "y el posesivo SINGULAR falso sigue vetado: «el menor margen de Ripley» no es cierto (el extremo es Lider)");
  ok(juzgaW("Yo profundizaría primero en La Polar y Ripley, y después revisaría qué está explicando el menor margen relativo de Lider.").length === 0,
    "…mientras el posesivo singular VERDADERO pasa (Lider sí es el margen más bajo del cuadro)");
}

/* ═══ 5e · «¿DE DÓNDE SALE ESE 103%?» · la procedencia, y el escenario que viaja con la memoria ═════════════
 * Encontrado por el owner EN SU PANTALLA (2026-09-08): preguntó por una cifra que ADI acababa de dar y ADI
 * contestó «la saqué sin verificarla… déjame corregir» — desdiciéndose de un número que el cuadro publica y
 * que su boleta traía como obligatorio. Desdecirse de lo cierto cuesta más confianza que no haberlo dicho. */
H("5e · la pregunta por una cifra que ADI acaba de dar");
{
  const vcE = ancla("comercial/01/evolutivo-serie");
  const r1 = await answerViaAgente({ text: tituloDeExplicacion("comercial/01/evolutivo-serie"), history: [], mem: {}, scenario: ESC, callAgente: MUDO, viewContext: vcE, cuadro: vcE });
  const LE = lecturaDeCuadro("comercial/01/evolutivo-serie", { scenario: ESC });
  const cumpl = (LE.cabecera || []).find((x) => x.clave === "cumplimiento");
  ok(!!cumpl, "el cuadro del año PUBLICA el cumplimiento del presupuesto — no es una cuenta de ADI", cumpl && cumpl.valor);
  /* ⚠️ EL BOTÓN YA NO ABRE CON EL CUMPLIMIENTO — decisión del owner en la entrega siguiente (§5g): la apertura
   * lleva el GAP, que es más ejecutivo, y el cumplimiento se contesta cuando lo preguntan. Lo que este check
   * garantiza es lo que importa acá: la cifra ESTÁ AUTORIZADA en la boleta del turno, así que cuando el usuario
   * pregunte por ella ADI la tiene — que es exactamente lo que falló en la pantalla del owner. */
  const _figsEvo = cuadroSentrix({ componentId: "comercial/01/evolutivo-serie", scenario: ESC }).boleta;
  ok(_figsEvo.some((f) => f.value === cumpl.valor && f.mandatory),
    "…y viaja en la boleta del turno como fig OBLIGATORIA (aunque la apertura hoy lleve el gap)", cumpl.valor);
  /* ⚠️ EL ESCENARIO VIAJA CON LA MEMORIA. Sin él, la reapertura leía el cuadro con ESCENARIO_INICIAL —otra
   * carpeta— y devolvía OTRAS cifras: al preguntar por una cifra, ADI habría contestado con la de otro mundo. */
  ok(r1.mem.cuadroAbierto && r1.mem.cuadroAbierto.escenario === ESC,
    "★ la memoria del cuadro guarda su ESCENARIO: reabrirlo en otra carpeta sería reabrir otro cuadro", JSON.stringify(r1.mem.cuadroAbierto));
  const hist = [{ role: "user", text: "x" }, { role: "adi", text: r1.r.text }];
  const r2 = await answerViaAgente({ text: `de donde sale ese ${cumpl.valor}`, history: hist, mem: r1.mem, scenario: ESC, callAgente: MUDO });
  const T2 = String(r2.r.text || "");
  ok(/cumplimiento del presupuesto/i.test(T2) && T2.includes(cumpl.valor), "★ ADI responde QUÉ ES esa cifra y de qué cuadro sale", T2.slice(0, 150));
  ok(/no es una cuenta m[ií]a|la publica el mismo m[oó]dulo/i.test(T2), "★★ …y que la PUBLICA EL MÓDULO — jamás «déjame corregir» sobre una cifra verificada");
  ok(!/sin verificar|d[eé]jame corregir|la saqu[eé]/i.test(T2), "…sin desdecirse de lo que es cierto");
  ok((r2.r.agente.vetos || []).length === 0, "…y sin vetos del muro", JSON.stringify(r2.r.agente.vetos || []));
  const r3 = await answerViaAgente({ text: "como viene mi margen?", history: hist, mem: r1.mem, scenario: ESC, callAgente: MUDO });
  ok(!/del cuadro «El año mes a mes»/.test(String(r3.r.text || "")), "★ y una pregunta libre SIN cifra del cuadro sigue siendo libre (la memoria desambigua, no secuestra)");
}

/* ═══ 5f · MI PROPIA REGLA NO PUEDE MATAR LA LECTURA BUENA ══════════════════════════════════════════════════
 * El owner vio el piso determinístico donde esperaba al agente: la causa era `cuadro-recitado` contando
 * NOMBRES — una lectura rica menciona a las que crecen, a las que caen y a las sanas, y caía vetada. Contar
 * nombres medía la FORMA; lo que hay que impedir es servir la TABLA: filas con su cifra pegada, en fila. */
H("5f · la lectura rica del cerebro NO recibe multa — y la tabla recitada sí");
{
  const vcC = ancla("comercial/01/tabla-cartera", { todos: "0" });
  const RB = buildResumenComercial(ESC);
  const RICA = [
    "**La lectura:** Tu cartera crece $7.1M (+7.6%), pero el crecimiento no es parejo. Lider suma $2.3M, Jumbo $1.9M y Falabella $1.5M.",
    "**Dónde está el problema:** Ripley, Easy, La Polar y Unimarc caen contra el año anterior. La Polar es la que más preocupa: 2.9% de la venta, pero 34.0% de margen.",
    "**La prioridad:** es criterio mío que miraría La Polar y Ripley antes que Sodimac o Tottus, que vienen sanas.",
  ].join("\n");
  const nombresRica = RB.cartera.filas.filter((f) => RICA.includes(f.nombre)).length;
  ok(nombresRica >= 9, `la lectura de prueba nombra ${nombresRica} cuentas — la clase de riqueza que el owner pidió`);
  ok(vetosDelPlaybook(cuadroExplicado, RICA, { pregunta: "x", ctx: { cuadro: vcC } }).length === 0,
    "★★ nombrar nueve cuentas CON PROPÓSITO no es recitar: la lectura rica pasa el playbook");
  const TABLA = RB.cartera.filas.slice(0, 8).map((f) => `${f.nombre} ${f.ventaFmt}`).join(" · ");
  ok(vetosDelPlaybook(cuadroExplicado, TABLA, { pregunta: "x", ctx: { cuadro: vcC } }).some((x) => x.regla === "cuadro-recitado"),
    "★ y servir ocho filas con su cifra pegada SIGUE siendo la tabla otra vez", TABLA.slice(0, 90));
}

/* ═══ 5g · EL GAP MANDA, Y EL PORCENTAJE LLEVA SU DECIMAL (owner 2026-09-08, quinta entrega) ════════════════
 * «Ojo con decir cumplimiento de 103, porque es mejor decir con un gap sobre ventas: es más ejecutivo. Y si
 *  preguntan por cumplimiento… lo redondeo en 103, prefiero al menos un decimal, es mejor.»
 * Dos reglas de presentación con consecuencia real: un gerente lee «+3.1% sobre tu presupuesto» de una;
 * «103.1% del plan» lo obliga a restar 100 de cabeza. Y un entero pelado se lee como aproximación aunque la
 * cifra esté medida. */
H("5g · el gap antes que el cumplimiento · y ningún porcentaje sin decimal");
{
  const vcE = ancla("comercial/01/evolutivo-serie");
  const LE = lecturaDeCuadro("comercial/01/evolutivo-serie", { scenario: ESC });
  const gap = (LE.cabecera || []).find((x) => x.clave === "vsPresupuesto");
  const cum = (LE.cabecera || []).find((x) => x.clave === "cumplimiento");
  ok(!!gap && !!cum, "el cuadro publica LAS DOS formas: el gap contra el presupuesto y el cumplimiento", `${gap && gap.valor} · ${cum && cum.valor}`);
  const r1 = await answerViaAgente({ text: tituloDeExplicacion("comercial/01/evolutivo-serie"), history: [], mem: {}, scenario: ESC, callAgente: MUDO, viewContext: vcE, cuadro: vcE });
  const T1 = String(r1.r.text || "");
  ok(T1.includes(gap.valor) && /sobre tu presupuesto/.test(T1), "★ la lectura abre con el GAP, no con el cumplimiento", T1.split("\n")[0]);
  ok(!/del plan\b/.test(T1), "…y el cumplimiento no ocupa el lugar del gap en la lectura de apertura");
  /* pero el cumplimiento NO se pierde: se contesta cuando lo preguntan — y ahí va con su decimal */
  const hist = [{ role: "user", text: "x" }, { role: "adi", text: T1 }];
  const r2 = await answerViaAgente({ text: "y el cumplimiento del presupuesto?", history: hist, mem: r1.mem, scenario: ESC, callAgente: MUDO });
  const T2 = String(r2.r.text || "");
  ok(T2.includes(cum.valor), "★ y si lo preguntan, se responde CON su decimal (la cifra que el cuadro publica)", T2.slice(0, 120));
  ok(!/No tengo informaci[oó]n/.test(T2), "…sin caer a «no tengo información»: la continuación elíptica («y el…») reabre el cuadro");
  /* la continuación abre SOLO con su marcador: una pregunta nueva corta que nombra una columna sigue libre */
  const r3 = await answerViaAgente({ text: "como viene mi margen?", history: hist, mem: r1.mem, scenario: ESC, callAgente: MUDO });
  ok(!/de este cuadro/.test(String(r3.r.text || "")), "★ «¿cómo viene mi margen?» —corta y con columna— NO la toma el cuadro: el marcador «y» es lo que abre");
  /* LA MULTA DEL REDONDEO, con su par legítimo */
  const pares = [[`El cumplimiento cierra en ${cum.valor.replace(/\.\d+%$/, "%")}.`, true], [`El cumplimiento cierra en ${cum.valor}.`, false], [`Vas ${gap.valor} sobre presupuesto.`, false]];
  for (const [txt, debeMultar] of pares) {
    const hay = vetosDelPlaybook(cuadroExplicado, txt, { pregunta: "x", ctx: { cuadro: vcE } }).some((x) => x.regla === "porcentaje-redondeado");
    ok(hay === debeMultar, `${debeMultar ? "★ multa" : "pasa"}: «${txt}»`);
  }
}

/* ═══ 5h · LA TABLA LA PONE SENTRIX, NO ADI (owner 2026-09-08, sexta entrega) ═══════════════════════════════
 * «La idea no es que ADI vuelva a hacer las tablas; si ese es el caso, las agregamos a Sentrix y que sea
 *  permanente. Imagina, hace dos tablas diferentes repitiendo datos: lo que el usuario quiere es entender qué
 *  ve. Ahora, se puede dar que el usuario le pida a ADI "hazme una tabla con la venta mes por mes" y podría
 *  hacerlo — pero acá está leyendo directo de Sentrix.»
 * En un turno de cuadro la tabla ESTÁ AL LADO: redibujarla sirve dos veces el mismo dato y gasta el espacio de
 * la interpretación, que es lo único que ADI aporta ahí. */
H("5h · en un turno de cuadro, ADI no redibuja la tabla");
{
  const vcC = ancla("comercial/01/tabla-cartera", { todos: "0" });
  ok(cuadroExplicado.tablaProhibida === true, "★ el playbook DECLARA que en su turno la tabla no va (el bucle la traduce a la política del muro)");
  const bucle = sinComentarios(leer("src/adi/agente/bucleAgente.js"));
  ok(/playbookActivo && playbookActivo\.tablaProhibida === true\) \? "forbidden" : "auto"/.test(bucle),
    "…y el bucle la conecta con la política que YA existía — no hizo falta una regla nueva, hacía falta cableársela");
  /* el cerebro que redibuja la tabla: no llega a pantalla */
  const CON_TABLA = async () => ({ tipo: "texto", texto: "Los 13 clientes cierran en $100.0M.\n\n| Cliente | Ventas | Margen |\n|---|---|---|\n| Falabella | $19.4M | 22.0% |\n| Lider | $17.9M | 21.5% |\n\nEs criterio mío que revises Lider primero." });
  const rT = await answerViaAgente({ text: tituloDeExplicacion("comercial/01/tabla-cartera"), history: [], mem: {}, scenario: ESC, callAgente: CON_TABLA, viewContext: vcC, cuadro: vcC });
  ok(!/\|\s*Cliente\s*\|/.test(String(rT.r.text || "")), "★★ la tabla markdown del cerebro NO llega a pantalla — el usuario ya la tiene al lado");
  ok((rT.r.agente.vetos || []).some((x) => /tabla/i.test(x)), "…y queda registrado por qué", JSON.stringify(rT.r.agente.vetos || []));
  /* y el ENTREGABLE se lo dice al cerebro antes, para que no la escriba */
  const pbT = playbookPara(tituloDeExplicacion("comercial/01/tabla-cartera"), { history: [], cuadro: vcC });
  ok(/NO ARMES UNA TABLA/.test(entregableDe(pbT, "x", { cuadro: vcC })), "…y el entregable se lo pide de entrada, no solo se lo multa después");
  /* ⚠️ NI SIQUIERA EL PISO puede escribir en forma de tabla: «Etiqueta: cifra» en líneas seguidas ES una tabla
   * escrita con dos puntos, y el detector la caza con razón. Se comprueba en TODOS los cuadros. */
  for (const b of BOTONES) {
    const t = await texto(b.cid, b.q, b.ctrl);
    const filas = t.split("\n").filter((l) => /^\s*(?:[-*·]|\d+[.)])?\s*\*{0,2}[^:—|\n]{2,48}\*{0,2}\s*(?::|—|\|)\s*\S*\d/.test(l));
    ok(filas.length < 3, `«${VIEW_MANIFEST[b.cid].label}» · el entregable determinístico escribe PROSA, no filas etiquetadas`, filas.join(" / ").slice(0, 140));
  }
}

/* ═══ 5i · «FEBRERO ES EL MES MÁS BAJO, ¿POR QUÉ?» (owner 2026-09-09, séptima entrega) ══════════════════════
 * Con el cuadro del año abierto, esa pregunta moría: ningún playbook la tomaba, y en la pantalla del owner el
 * cerebro llegó a pedir una herramienta equivocada y la declinación interna («la métrica venta no está
 * declarada para el eje cliente») salió a pantalla. «Esas cosas ya no nos deberían pasar.» La CAUSA sigue sin
 * estar en el dato — ley de la casa, se dice primero — pero la serie SÍ sostiene un hecho que cambia la
 * lectura: si el mismo mes repite el extremo contra el año anterior, apunta a estacionalidad; si no, es de
 * este año. Es ORDEN sobre los crudos del builder, ninguna cifra nueva. */
H("5i · el elemento nombrado — el porqué honesto, con el hecho que la serie sí sostiene");
{
  const CID = "comercial/01/evolutivo-serie";
  const LE = lecturaDeCuadro(CID, { scenario: ESC });
  ok(LE.patronAnual && LE.patronAnual.mesMin && typeof LE.patronAnual.minSeRepite === "boolean",
    "el lector calcula el PATRÓN ANUAL sobre los crudos del builder (mes extremo, y si se repite en la otra serie)", JSON.stringify(LE.patronAnual));
  const vcE = ancla(CID);
  const r1 = await answerViaAgente({ text: tituloDeExplicacion(CID), history: [], mem: {}, scenario: ESC, callAgente: MUDO, viewContext: vcE, cuadro: vcE });
  const hist = [{ role: "user", text: "x" }, { role: "adi", text: r1.r.text }];
  const r2 = await answerViaAgente({ text: "febrero es el mes mas bajo, por que?", history: hist, mem: r1.mem, scenario: ESC, callAgente: MUDO });
  const T2 = String(r2.r.text || "");
  ok(!/No tengo informaci[oó]n|no est[aá] declarada/.test(T2) && r2.r.agente.estado !== "vacio",
    "★★ la pregunta del owner YA NO cae a «no tengo información» ni a una declinación de herramienta", `${r2.r.agente.estado} · ${T2.slice(0, 100)}`);
  const cMin = (LE.cabecera || []).find((x) => x.clave === "min");
  ok(/piso del año/.test(T2) && !!cMin && T2.includes(cMin.valor),
    "…y responde con la cifra que el cuadro publica (el piso, del builder vivo)", T2.split("\n")[0]);
  ok(/no est[aá] probado|no est[aá] en este dato/.test(T2) && /hip[oó]tesis|criterio m[ií]o/i.test(T2),
    "★ la ley sigue en pie con la forma nueva: lo que no está medido va como HIPÓTESIS y se declara no probado — jamás como hecho", T2);
  ok(LE.patronAnual.minSeRepite ? /tambi[eé]n fue el (?:piso|m[aá]s bajo)/.test(T2) && /estacionalidad/.test(T2) : /otro mes/i.test(T2),
    "★ …más el HECHO que la serie sí sostiene: extremo repetido → estacionalidad; extremo nuevo → de este año", T2.slice(0, 260));
  ok((r2.r.agente.vetos || []).length === 0, "…y el muro no tuvo nada que podar", JSON.stringify(r2.r.agente.vetos || []));
  /* un mes que NO es extremo se ubica sin drama — Y ANCLADO: sin las cifras de los extremos al lado, el propio
   * veto de desanclaje mataba la respuesta y el turno caía al rescate (medido con «y julio, ¿por qué?») */
  const r3 = await answerViaAgente({ text: "y julio, por que esta ahi?", history: hist, mem: r1.mem, scenario: ESC, callAgente: MUDO });
  const T3 = String(r3.r.text || "");
  ok(/no es ni el pico ni el piso/.test(T3) && r3.r.agente.estado === "playbook",
    "un mes que no es extremo se dice sin drama —con los extremos y sus cifras al lado— y el turno NO cae al rescate", `${r3.r.agente.estado} · ${T3.split("\n")[0]}`);
  /* NO-SECUESTRO: la puerta del elemento exige que el CUADRO ABIERTO lo nombre */
  const rC = await turno("comercial/01/tabla-cartera", tituloDeExplicacion("comercial/01/tabla-cartera"), { todos: "0" });
  const histC = [{ role: "user", text: "x" }, { role: "adi", text: rC.r.text }];
  const pbX = playbookPara("febrero es el mes mas bajo, por que?", { history: histC, mem: rC.mem });
  ok(!pbX || pbX.nombre !== "cuadro-explicado",
    "★ con la CARTERA abierta —que no nombra meses— «febrero» no la secuestra: el elemento tiene que ser DEL cuadro", pbX && pbX.nombre);
  const pbN = playbookPara("febrero es el mes mas bajo, por que?", { history: [], mem: {} });
  ok(!pbN || pbN.nombre !== "cuadro-explicado", "…y sin cuadro en la memoria, tampoco: un turno libre sigue siendo libre");
  /* la FILA nombrada con «por qué»: su cifra, sus señales, y la misma ley */
  const rF = await answerViaAgente({ text: "y ripley por que cae?", history: histC, mem: rC.mem, scenario: ESC, callAgente: MUDO });
  const TF = String(rF.r.text || "");
  ok(/Ripley/.test(TF) && /no est[aá] en este cuadro/.test(TF) && /cae/.test(TF),
    "una FILA nombrada responde con su cifra y sus señales — y la misma ley del porqué", TF.split("\n")[0]);
  /* el cerebro recibe lo mismo que el piso: el patrón en facts, y la doctrina del porqué con hipótesis MARCADAS */
  const figsE = cuadroSentrix({ componentId: CID, scenario: ESC });
  ok(figsE.facts && figsE.facts.patronAnual && typeof figsE.facts.patronAnual.minSeRepite === "boolean",
    "la herramienta expone el patrón anual en facts — meses y booleanos, cero cifras nuevas");
  const entPQ = entregableDe(cuadroExplicado, "febrero es el mes mas bajo, por que?", { history: hist, mem: r1.mem });
  ok(/TRES PASOS/.test(entPQ) && /HIPÓTESIS, MARCADA/i.test(entPQ) && /patronAnual/.test(entPQ),
    "★ y al cerebro se le pide el porqué de asesor: la ley primero, hipótesis marcadas como criterio, el patrón si viene, y la verificación concreta");
}

/* ═══ 5j · EL MES POR DENTRO (owner 2026-09-09, octava entrega — sobre la séptima, el mismo día) ═════════════
 * «El mes más bajo fue porque hubo un incremento en acciones comerciales, aumentó el costo, bajó la
 *  contribución porque ganamos volumen pero perdimos margen… esas son las cosas que debemos saber, y eso SÍ
 *  está en los datos.» Y es cierto: la hoja Ventas trae fecha, costo, unidades y acciones por fila — la ingesta
 *  las suma por mes, el demo las declara igual, y el builder publica cada mes POR DENTRO anclado a la formación
 *  del margen de su propia cara. El porqué INTERNO (qué componente se movió) se afirma con cifras; el detonante
 *  de fondo sigue sin estar en el dato, y se sigue diciendo. */
H("5j · el mes por dentro — el porqué interno se lee del dato, anclado a la formación del margen");
{
  const CID = "comercial/01/evolutivo-serie";
  const RB = buildResumenComercial(ESC);
  const pd0 = RB.evolutivo && RB.evolutivo.porDentro;
  ok(!!pd0 && Array.isArray(pd0.meses) && pd0.meses.length === 12,
    "el builder publica los 12 meses por dentro (unidades · contribución · margen · acciones)", pd0 && pd0.meses && pd0.meses.length);
  const sum = (f) => pd0.meses.reduce((x, m) => x + (Number(m[f]) || 0), 0);
  const fContrib = (RB.formacion.lineas.find((l) => l.key === "contribucion") || {}).montoFmt;
  const fAcc = (RB.formacion.lineas.find((l) => l.key === "acciones") || {}).montoFmt;
  ok(Math.abs(sum("contribucion") - Number(RB.total.contribucion)) < 1 && Math.abs(sum("acciones") - Number(RB.total.acciones)) < 1,
    `★★ los meses CIERRAN EXACTO con la formación del margen de la misma cara (contribución ${fContrib} · acciones ${fAcc}) — una sola verdad`,
    `Σcontrib ${sum("contribucion")} vs ${RB.total.contribucion} · Σacc ${sum("acciones")} vs ${RB.total.acciones}`);
  /* el turno del owner: «¿por qué febrero es el mes más bajo?» — ahora con el mes por dentro */
  const vcE = ancla(CID);
  const LE = lecturaDeCuadro(CID, { scenario: ESC });
  const r1 = await answerViaAgente({ text: tituloDeExplicacion(CID), history: [], mem: {}, scenario: ESC, callAgente: MUDO, viewContext: vcE, cuadro: vcE });
  const hist = [{ role: "user", text: "x" }, { role: "adi", text: r1.r.text }];
  const r2 = await answerViaAgente({ text: "febrero es el mes más bajo, ¿por qué?", history: hist, mem: r1.mem, scenario: ESC, callAgente: MUDO });
  const T2 = String(r2.r.text || "");
  const feb = LE.porDentro.meses.find((m) => /^feb/i.test(m.mes));
  ok(!!feb && T2.includes(String(feb.unidades)) && T2.includes(String(LE.porDentro.unidadesProm)) && T2.includes(feb.margenFmt)
    && T2.includes(LE.porDentro.margenAnioFmt) && T2.includes(feb.cargaFmt) && T2.includes(LE.porDentro.cargaAnioFmt),
    "★★ el mecanismo viaja CON LAS CIFRAS QUE LO SOSTIENEN: volumen contra el promedio, margen contra el del año, carga contra la del año", T2.slice(0, 260));
  if (feb && feb.esUnidadesMin && typeof feb.margenPct === "number" && typeof LE.porDentro.margenAnioPct === "number"
      && Math.abs(feb.margenPct - LE.porDentro.margenAnioPct) < 0.8)
    ok(/por volumen/.test(T2) && /se mantuvo en l[ií]nea/.test(T2) && /no saltaron/.test(T2),
      "★ …y la LECTURA sale por umbral declarado: «fue por volumen; el margen se mantuvo en línea y las acciones no saltaron» — el ejemplo del owner, con respaldo", T2);
  ok(/\?/.test(T2.trim().split("\n").pop() || ""), "…y el turno CIERRA PREGUNTÁNDOLE al dueño, que es donde vive el detonante", T2.trim().split("\n").pop());
  ok((r2.r.agente.vetos || []).length === 0, "…con el muro sin nada que podar (cada cifra del mes está en la boleta)", JSON.stringify(r2.r.agente.vetos || []));
  /* julio: el mes que el owner señaló como «la venta fue evolucionando, ¿por qué?» — su historia interna */
  const r3 = await answerViaAgente({ text: "y julio, por que esta ahi?", history: hist, mem: r1.mem, scenario: ESC, callAgente: MUDO });
  const T3 = String(r3.r.text || "");
  const jul = LE.porDentro.meses.find((m) => /^jul/i.test(m.mes));
  if (jul && (jul.esMargenMin || jul.esCargaMax))
    ok(/por dentro s[ií] tiene historia/.test(T3) && T3.includes(jul.margenFmt),
      "★ un mes no extremo CON historia interna la cuenta: el margen más bajo / la carga más alta, con sus cifras", T3.slice(0, 220));
  ok((r3.r.agente.vetos || []).length === 0, "…también sin vetos", JSON.stringify(r3.r.agente.vetos || []));
  /* la boleta autoriza TODOS los meses: el turno no sabe cuál va a nombrar el usuario */
  const figsE = cuadroSentrix({ componentId: CID, scenario: ESC });
  const labels = (figsE.boleta || []).map((f) => String(f.label || ""));
  ok(labels.some((l) => /Feb · contribución/.test(l)) && labels.some((l) => /Jul · margen/.test(l)) && labels.some((l) => /margen del año/.test(l)),
    "la herramienta pone los 12 meses por dentro EN LA BOLETA — una cifra del mes citada sin autorización moriría con el dato al lado");
  ok(figsE.facts && figsE.facts.mesPorDentro && Array.isArray(figsE.facts.mesPorDentro.meses),
    "…y el cerebro recibe mesPorDentro en facts");
  const entPD = entregableDe(cuadroExplicado, "febrero es el mes mas bajo, por que?", { history: hist, mem: r1.mem });
  ok(/mesPorDentro/.test(entPD) && /MECANISMO MEDIDO DEL NEGOCIO, PRIMERO/.test(entPD),
    "★ …con la doctrina: el mecanismo medido va PRIMERO y con sus cifras; el detonante se marca y se pregunta");
  /* la ingesta real suma las mismas columnas por período — la fila de venta ya las trae */
  const motor = sinComentarios(leer("src/ingesta/plantilla/motorKpi.js"));
  ok(/unidades: Math\.round\(_sum\(delMes, \(r\) => r\.unidades\)\)/.test(motor) && /costo: Math\.round\(_sum\(delMes, \(r\) => r\.costo\)\)/.test(motor) && /acciones: Math\.round\(_sum\(delMes, \(r\) => r\.acciones\)\)/.test(motor),
    "el archivo real del cliente alimenta lo mismo: la ingesta suma costo, unidades y acciones POR MES desde las filas de la hoja Ventas");
}

/* ═══ 5k · EL MÉTODO DEL PORQUÉ (owner 2026-09-09, novena entrega — tras ver la v2.20 en su pantalla) ═══════
 * «No quiero prohibir que ADI mezcle criterio de mundo; eso es aporte. Pero debe hacerlo con MÉTODO. Orden
 *  esperado: (1) primero el mecanismo medido del negocio; (2) después la hipótesis del asesor, marcada;
 *  (3) después una pregunta para corroborar con el usuario. ADI no necesita saber todo. Si falta contexto,
 *  debe consultar bien al usuario para cerrar la lectura. Eso es asesoría: medir, proponer hipótesis y validar
 *  con el dueño. Además: si afirma "fue volumen y no margen/acciones", debe mostrar las cifras que sostienen
 *  esa lectura · evitar frases sectoriales fuertes como "el sector históricamente cae" salvo que haya fuente o
 *  contexto declarado · las preguntas al usuario deben ser concretas, no genéricas.»
 * Lo que lo disparó: en producción, ADI escribió «los clientes retail típicamente reducen compras después de
 * enero» y «el sector electrodomésticos y línea blanca históricamente cae en febrero» — con el rótulo «criterio
 * mío» puesto, pero sin fuente y con la conclusión medida («el volumen cayó») sin mostrar UNA cifra. */
H("5k · el método del porqué — medir con cifras · hipotetizar marcado · preguntarle al dueño");
{
  const CID = "comercial/01/evolutivo-serie";
  const LE = lecturaDeCuadro(CID, { scenario: ESC });
  const vcE = ancla(CID);
  const r1 = await answerViaAgente({ text: tituloDeExplicacion(CID), history: [], mem: {}, scenario: ESC, callAgente: MUDO, viewContext: vcE, cuadro: vcE });
  const hist = [{ role: "user", text: "x" }, { role: "adi", text: r1.r.text }];
  const feb = LE.porDentro.meses.find((m) => /^feb/i.test(m.mes));
  const r2 = await answerViaAgente({ text: "por que febrero es el mas bajo", history: hist, mem: r1.mem, scenario: ESC, callAgente: MUDO });
  const L2 = String(r2.r.text || "").trim().split("\n").map((x) => x.trim()).filter(Boolean);
  /* LOS TRES PASOS, EN ORDEN — se verifica la POSICIÓN, no solo la presencia */
  const iMec = L2.findIndex((l) => /por volumen|cediste margen|ganaste volumen|bien ganado|margen del mes/i.test(l));
  const iHip = L2.findIndex((l) => /mi hip[oó]tesis/i.test(l));
  const iPre = L2.findIndex((l) => /\?$/.test(l));
  ok(iMec > 0 && iHip > iMec && iPre > iHip,
    "★★ los tres pasos SALEN EN EL ORDEN del owner: mecanismo medido → hipótesis marcada → pregunta al dueño",
    `mecanismo:${iMec} hipótesis:${iHip} pregunta:${iPre}`);
  /* (1) el mecanismo NO se afirma sin las cifras que lo sostienen — las tres componentes del ejemplo del owner */
  ok(L2[iMec].includes(String(feb.unidades)) && L2[iMec].includes(String(LE.porDentro.unidadesProm))
    && L2[iMec].includes(feb.margenFmt) && L2[iMec].includes(LE.porDentro.margenAnioFmt)
    && L2[iMec].includes(feb.cargaFmt) && L2[iMec].includes(LE.porDentro.cargaAnioFmt),
    "★ (1) «fue por volumen y no margen ni acciones» viaja con LAS TRES componentes y su referencia del año", L2[iMec]);
  /* (2) la hipótesis se declara no probada — y habla del negocio del usuario, no de un sector */
  ok(/no est[aá] probado/i.test(L2[iHip]) && /estacionalidad|de este año/i.test(L2[iHip]),
    "★ (2) la hipótesis va MARCADA y declarada no probada con este dato", L2[iHip]);
  /* (3) la pregunta es concreta: nombra cosas del negocio, no «¿seguimos?» */
  ok(/campañ|stock|cliente|precio|negociaci|promoci|mezcla|mes bajo/i.test(L2[iPre]) && !/^¿seguimos|^¿te (?:lo )?abro/i.test(L2[iPre]),
    "★ (3) la pregunta al dueño es CONCRETA y con opciones — no una oferta de navegación", L2[iPre]);
  ok((r2.r.agente.vetos || []).length === 0, "…y el turno pasa el muro entero", JSON.stringify(r2.r.agente.vetos || []));
  /* el método vale para TODO mes, no solo el del ejemplo: pico, mes intermedio con historia y fila del cuadro */
  for (const q of ["y noviembre, que hicimos bien?", "por que diciembre no rinde igual?", "y julio, por que cayo tanto?"]) {
    const rr = await answerViaAgente({ text: q, history: hist, mem: r1.mem, scenario: ESC, callAgente: MUDO });
    const T = String(rr.r.text || "").trim();
    ok(/\?$/.test(T) && /\d/.test(T) && (rr.r.agente.vetos || []).length === 0,
      `«${q}» · mide con cifras y cierra preguntando`, T.split("\n").pop());
  }
  const rC = await turno("comercial/01/tabla-cartera", tituloDeExplicacion("comercial/01/tabla-cartera"), { todos: "0" });
  const histC = [{ role: "user", text: "x" }, { role: "adi", text: rC.r.text }];
  const rF = await answerViaAgente({ text: "y ripley por que cae?", history: histC, mem: rC.mem, scenario: ESC, callAgente: MUDO });
  const TF = String(rF.r.text || "").trim();
  ok(/no est[aá] en este cuadro/.test(TF) && /\?$/.test(TF) && /stock|precio|mezcla|competidor/i.test(TF),
    "★ y una FILA que cae sigue el mismo método: lo medido, el límite del cuadro, y la pregunta concreta al dueño", TF.split("\n").pop());

  /* ── LOS TRES VETOS, con el TEXTO REAL que salió en la pantalla del owner ────────────────────────────────
   * No es un veneno inventado: es lo que ADI escribió en producción el 2026-09-09, copiado de su captura. */
  const memE = { cuadroAbierto: { componentId: CID, escenario: ESC, controles: {}, turno: 2 } };
  const ctxE = { history: [{}, {}], mem: memE };
  /* ⚠️ EL JUEZ ES EL MÓDULO DE LA CASA (owner 2026-09-09, décima entrega): las tres reglas salieron del
   * playbook del cuadro y viven en `porque.js`, que el bucle aplica a TODO turno causal. Este gate las mide
   * donde están ahora — con la misma boleta del cuadro y los mismos textos. */
  const _figsDelCuadro = cuadroSentrix({ componentId: CID, scenario: ESC }).boleta;
  const _resultsDelCuadro = [{ facts: cuadroSentrix({ componentId: CID, scenario: ESC }).facts }];
  const juzgar = (txt) => vetosDelPorque(txt, { pregunta: "por que febrero es el mas bajo", figs: _figsDelCuadro, results: _resultsDelCuadro, sitio: "cierre" }).map((x) => x.regla);
  const REAL_DE_PRODUCCION = [
    "Febrero cierra en $6.5M, el mes más bajo del año — y ese patrón se repite: febrero fue el mes más bajo también el año anterior.",
    "Qué pasó en febrero: El volumen cayó. No es margen cedido ni una acción comercial puntual — es una caída de venta mes a mes que el año anterior mostró igual.",
    "Por qué ocurre — criterio mío, no en el dato: Febrero es post-verano: los clientes retail típicamente reducen compras después de enero. El sector electrodomésticos y línea blanca históricamente cae en febrero.",
    "Qué verificar para confirmar: Si es estacionalidad pura, debería verse igual en TODOS los clientes y SKU ese mes.",
  ].join("\n");
  const vReal = juzgar(REAL_DE_PRODUCCION);
  ok(vReal.includes("mecanismo-sin-cifras"), "★★ el texto REAL de producción arde por afirmar «el volumen cayó, no es margen» SIN UNA CIFRA que lo sostenga", JSON.stringify(vReal));
  ok(vReal.includes("sectorial-sin-fuente"), "★★ …y por «el sector históricamente cae en febrero»: eso necesita fuente, y el rótulo «criterio mío» no la reemplaza");
  ok(vReal.includes("porque-sin-pregunta"), "★★ …y por cerrar sin preguntarle nada al dueño: el detonante lo sabe él");
  /* y el mismo texto, corregido con el método, pasa limpio */
  const CON_METODO = [
    "Febrero es el piso del año ($6.5M).",
    `Fue por volumen: ${feb.unidades} unidades contra un promedio de ${LE.porDentro.unidadesProm} en el año. El margen se mantuvo en línea (${feb.margenFmt} contra ${LE.porDentro.margenAnioFmt}) y las acciones comerciales no saltaron (${feb.cargaFmt} contra ${LE.porDentro.cargaAnioFmt}).`,
    "Mi hipótesis es que hay estacionalidad, porque febrero también fue el más bajo el año anterior. Con este dato solo no está probado.",
    "¿Febrero suele ser un mes bajo en tu negocio, o ese año pasó algo puntual con clientes grandes, stock o campañas?",
  ].join("\n");
  ok(juzgar(CON_METODO).length === 0, "★★ el MISMO texto con el método pasa limpio — la regla no prohíbe redactar, exige respaldar", JSON.stringify(juzgar(CON_METODO)));
  /* el criterio de mundo SOBRE EL NEGOCIO DEL USUARIO sigue siendo bienvenido: eso es el aporte, no se veta */
  const HIPOTESIS_LEGITIMA = `Febrero es el piso del año ($6.5M). Fue por volumen: ${feb.unidades} unidades contra ${LE.porDentro.unidadesProm} de promedio, con el margen en ${feb.margenFmt} contra ${LE.porDentro.margenAnioFmt}. Mi hipótesis, y es criterio mío, es que tu calendario comercial concentra la compra en otros meses. ¿Sueles hacer campañas en febrero, o tus clientes grandes compran menos ese mes?`;
  ok(juzgar(HIPOTESIS_LEGITIMA).length === 0, "★ y la hipótesis de mundo SOBRE SU NEGOCIO no se toca: «eso es aporte» — lo vetado es la estadística de sector sin fuente", JSON.stringify(juzgar(HIPOTESIS_LEGITIMA)));
  ok(juzgar(`Febrero es el piso ($6.5M): ${feb.unidades} unidades contra ${LE.porDentro.unidadesProm}, margen ${feb.margenFmt} contra ${LE.porDentro.margenAnioFmt}. La industria suele caer en febrero. ¿Hubo campañas o un quiebre de stock?`).includes("sectorial-sin-fuente"),
    "…y la forma suave también arde: «la industria suele caer» es la misma afirmación sin fuente");
  ok(juzgar(`Febrero es el piso del año ($6.5M). Fue por volumen: ${feb.unidades} unidades contra ${LE.porDentro.unidadesProm} de promedio, margen ${feb.margenFmt} contra ${LE.porDentro.margenAnioFmt}. ¿Seguimos por otra parte del cuadro?`).includes("porque-sin-pregunta"),
    "…y «¿seguimos?» no cuenta como preguntar: la pregunta tiene que pedir el contexto que falta");
  /* una LECTURA normal del cuadro no es un porqué: las tres reglas no la tocan */
  ok(vetosDelPorque("El período cierra en $100.0M, +3.1% sobre tu presupuesto. Entre el mes más alto ($9.8M) y el más bajo ($6.5M) la distancia es grande.", { pregunta: tituloDeExplicacion(CID), figs: _figsDelCuadro, results: _resultsDelCuadro, sitio: "cierre" }).length === 0,
    "★ y la lectura normal del cuadro sigue intacta: el método rige el PORQUÉ, no toda respuesta");
  _olvidarMemoDelCuadro();
  /* la doctrina del cerebro lleva los tres pasos con los ejemplos del owner */
  const ent = entregableDe(cuadroExplicado, "por que febrero es el mas bajo", { history: hist, mem: r1.mem });
  ok(/TRES PASOS/.test(ent) && /MECANISMO MEDIDO DEL NEGOCIO, PRIMERO/.test(ent) && /HIPÓTESIS, MARCADA/.test(ent) && /CIERRA PREGUNTÁNDOLE AL DUEÑO/.test(ent),
    "★ el cerebro recibe el método completo, en orden");
  ok(/PROHIBIDO afirmar cómo se comporta un sector/.test(ent) && /360 unidades/.test(ent) && /suele ser un mes bajo en tu negocio/.test(ent),
    "…con la prohibición del sector y los EJEMPLOS TEXTUALES del owner como estándar");
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
  /* desde 2026-09-11 el ctx lleva además el REFERENTE resuelto por el scope canónico (ver bucleAgente): el
   * literal crece, la promesa es la misma — el ctx viaja ENTERO a la cadena del playbook */
  ok(/const ctxTurno = \{ history, viewContext, cuadro, mem: memIn, referente \}/.test(bucle), "…y el bucle lo pasa entero a la cadena del playbook — con la memoria del hilo para la profundización");
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
    /* un botón anclado llama a `explicar` (el TÍTULO derivado, owner 2026-09-08) o a un `ask` del hook
     * (askX / _askX / vX.ask) — nunca a `onAsk` pelado. «explicar» es el nombre de la función del hook; el
     * label del botón dice «explique», así que el patrón no se engaña con el texto visible. */
    if (/\b_?(?:ask|explicar)[A-Za-z]*\s*\(|_?(?:ask|explicar)[A-Za-z]*\)/.test(b.ln) && !/onAsk\(/.test(b.ln)) { anclados++; continue; }
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
    [[/const ctxTurno = \{ history, viewContext, cuadro, mem: memIn, referente \};/, "const ctxTurno = { history, viewContext, mem: memIn, referente };"]],
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

  // (e) la multa de recitación desarmada → volver a servir la tabla deja de arder
  await carnada("la multa de recitación desarmada (la tabla vuelve a recitarse)", "src/adi/agente/playbooks/cuadroExplicado.js",
    [[/if \(conSuCifra > 6\) v\.push\(\{ regla: "cuadro-recitado"/, 'if (false) v.push({ regla: "cuadro-recitado"']],
    async (Mut) => {
      initTenant(TENANT_DEMO);
      const vcM = ancla("comercial/01/tabla-cartera", { todos: "0" });
      const RB = buildResumenComercial(ESC);
      const bait = "Esto muestra el cuadro: " + RB.cartera.filas.slice(0, 10).map((f) => `${f.nombre} ${f.ventaFmt}`).join(" · ") + ".";
      const v = Mut.cuadroExplicado.listaNotarial(bait, { pregunta: "x", ctx: { cuadro: vcM } });
      return !v.some((x) => x.regla === "cuadro-recitado");
    });
  // (f) la multa de calco desarmada → copiar la frase de la pantalla deja de arder
  await carnada("la multa de calco desarmada (la pantalla se repite textual)", "src/adi/agente/playbooks/cuadroExplicado.js",
    [[/v\.push\(\{ regla: "cuadro-calcado"/, 'void ({ regla: "cuadro-calcado"']],
    async (Mut) => {
      initTenant(TENANT_DEMO);
      const vcM = ancla("comercial/01/tabla-cartera", { todos: "0" });
      const RB = buildResumenComercial(ESC);
      const v = Mut.cuadroExplicado.listaNotarial(`Mira: ${RB.cartera.lectura} Eso es lo que hay.`, { pregunta: "x", ctx: { cuadro: vcM } });
      return !v.some((x) => x.regla === "cuadro-calcado");
    });

  // (g) la mención tomada apagada → el texto del owner vuelve a vetarse (el agente queda preso del piso)
  await carnada("la calibración de la mención tomada, apagada (la redacción del asesor vuelve a morir)", "src/adi/oracle/guardC.js",
    /* ⚠️ LAS DEFENSAS SON DOS desde la calibración de la distancia atributiva (2026-09-08): la mención tomada
     * y el tope de 25 caracteres entre la métrica y la cifra. Quitar una sola ya NO revive el falso positivo —
     * eso es el sistema siendo más robusto, no una carnada rota. Se quitan las dos, y ahí la redacción del
     * asesor vuelve a morir, que es lo que esta carnada existe para demostrar. */
    [[/function _todasLasMencionesTomadas\(\{ text, masked, lo, hi, unica, idxJuzgada, finJuzgada, owners \}\) \{/,
      "function _todasLasMencionesTomadas({ text, masked, lo, hi, unica, idxJuzgada, finJuzgada, owners }) { return false;   // CARNADA"],
     [/if \(_dist > 25\) continue;/, "if (false) continue;   // CARNADA"]],
    async (Mut) => {
      initTenant(TENANT_DEMO);
      const figsM = cuadroSentrix({ componentId: "comercial/01/tabla-cartera", scenario: ESC }).boleta;
      const v = Mut.guardC("Falabella vende $19.4M y genera $4.3M de contribución, mientras Jumbo, con $17.3M de venta, genera prácticamente lo mismo: $4.2M.", { ledger: { figs: figsM }, question: "x", datoProyectado: cifrasDelDato(ESC) });
      return v.ok === false && JSON.stringify(v.violations).includes("narrado como");
    });
  // (h) el posesivo del superlativo, quitado → «de Lider y Falabella» vuelve a cobrársele a la vecina
  await carnada("el posesivo del superlativo, quitado (el grupo vuelve a adivinarse)", "src/adi/oracle/guardC.js",
    [[/if \(posesivo && posesivo\.grupo\) continue;/, "if (false) continue;   // CARNADA"]],
    async (Mut) => {
      initTenant(TENANT_DEMO);
      const figsM = cuadroSentrix({ componentId: "comercial/01/tabla-cartera", scenario: ESC }).boleta;
      const v = Mut.guardC("Yo profundizaría primero en La Polar y Ripley, y después revisaría qué está explicando el menor margen relativo de Lider y Falabella.", { ledger: { figs: figsM }, question: "x", datoProyectado: cifrasDelDato(ESC) });
      return v.ok === false && JSON.stringify(v.violations).includes("superlativo");
    });

  // (i) la puerta del elemento, quitada → «febrero es el mes más bajo, ¿por qué?» vuelve a morir en el vacío
  await carnada("la puerta del elemento, quitada (la pregunta del owner vuelve a caer al vacío)", "src/adi/agente/playbooks/cuadroExplicado.js",
    [[/if \(_elementoCitado\(pregunta, L0\)\) return ancla;/, ""]],
    async (Mut) => {
      initTenant(TENANT_DEMO);
      const mem = { cuadroAbierto: { componentId: "comercial/01/evolutivo-serie", escenario: ESC, controles: {}, turno: 2 } };
      return Mut.cuadroExplicado.cuandoAplica("febrero es el mes mas bajo, por que?", { history: [{}, {}], mem }) !== true;
    });

  // (j) el ancla del mes por dentro, suelta → la contribución mensual deriva y deja de cerrar con la formación
  await carnada("el mes por dentro pierde su ancla (los meses ya no cierran con la formación del margen)", "src/adi/sentrix/resumenComercial.js",
    [[/const contribM = Number\.isFinite\(contribT\) && contribT > 0 \? anchorSerie\(rawContrib, contribT\) : rawContrib;/,
      "const contribM = rawContrib.map((v) => Math.round(v * 1.05));"]],
    async (Mut) => {
      initTenant(TENANT_DEMO);
      const RB = Mut.buildResumenComercial(ESC);
      const pd = RB && RB.evolutivo && RB.evolutivo.porDentro;
      if (!pd) return false;
      const s = pd.meses.reduce((x, m) => x + (Number(m.contribucion) || 0), 0);
      return Math.abs(s - Number(RB.total.contribucion)) >= 1;   // el defecto: dos verdades de contribución en la misma cara
    });

  // (k) el método del porqué, desarmado → vuelve a pantalla el texto que el owner rechazó en producción
  await carnada("las tres reglas del método, apagadas (vuelve el porqué sin cifras, con sector y sin pregunta)", "src/adi/agente/porque.js",
    [[/if \(!esPorQue\(pregunta\)\) return \[\];/, "if (true) return [];   // CARNADA"]],
    async (Mut) => {
      initTenant(TENANT_DEMO);
      const figsM = cuadroSentrix({ componentId: "comercial/01/evolutivo-serie", scenario: ESC });
      const REAL = "Febrero cierra en $6.5M, el mes más bajo del año. El volumen cayó. No es margen cedido ni una acción comercial puntual.\nCriterio mío: el sector electrodomésticos históricamente cae en febrero.";
      const v = Mut.vetosDelPorque(REAL, { pregunta: "por que febrero es el mas bajo", figs: figsM.boleta, results: [{ facts: figsM.facts }], sitio: "cierre" });
      return !v.some((x) => /mecanismo-sin-cifras|sectorial-sin-fuente|porque-sin-pregunta/.test(x.regla));
    });

  for (const f of tmp) { try { fs.unlinkSync(f); } catch { /* limpieza best-effort */ } }
}

console.log(`\n── _ancla_de_cuadro_gate: ${pass} PASS · ${fail} FAIL (de ${pass + fail}) ──`);
process.exit(fail ? 1 : 0);
