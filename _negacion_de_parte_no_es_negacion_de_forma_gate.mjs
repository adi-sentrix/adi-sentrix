/* === _negacion_de_parte_no_es_negacion_de_forma_gate.mjs · LA MITAD QUE FALTABA DEL EJE DE FORMA ================
 * ══ LO PRIMERO, SIN ADORNOS: LA MITAD «INEQUÍVOCA» DE LA REGLA YA NO EXISTE (E3.t3, ABIERTO) ══════════════════
 * Este gate YA NO certifica que la negación de un sustantivo INEQUÍVOCO de forma («sin la tabla», «nada de
 * tablas», «sin planillas», «nada de cuadritos») prohíba tabular. NO LO HACE. El owner retiró
 * `..._negaciones(_TABLA_N_FORMA)` de `_PROHIBE_FORMA` (progressiveDisclosure.js, 2026-08-11) y hoy esos turnos
 * resuelven `required` —si el mismo turno trae un disparador positivo— o `auto` —si no lo trae—. Nunca
 * `forbidden`. «Explicalo sin repetir la tabla: cuál fue el peor mes» recibe una tabla, y la prosa obediente se
 * rechaza con `tabla-faltante`. Es un DEFECTO REAL de la certificación (E3.t3) y está ABIERTO; abajo se mide
 * end-to-end hasta ese rechazo. No hay ninguna aserción en este archivo que lo tape.
 * POR QUÉ SE PREFIRIÓ ASÍ: esa lista producía 14 FALSOS POSITIVOS MEDIDOS de la peor clase —`tabla-no-autorizada`
 * contra una tabla que el usuario RECLAMABA porque FALTÓ («Me quedé sin la tabla mes a mes, ¿la rehacés?»)—, y
 * moverla al paso 3 salva sólo 6 de esos 14 (probado, no supuesto: `pidePresentacionTabular` reconoce el pedido en
 * 6). Es la doctrina de la casa aplicada contra el propio fix, la misma que este archivo ya declaraba abajo:
 * FALSO NEGATIVO ANTES QUE FALSO POSITIVO. El comentario completo está escrito en el src, en el hueco que dejó.
 * SEGUNDO RETIRO, MÁS CHICO Y DE OTRO ORIGEN (mismo owner, misma fecha): `_PIDE_PROSA` se acotó — «en palabras» /
 * «con palabras» SUELTAS ya no prohíben, porque convertían un pedido de REGISTRO («explicado en palabras simples»)
 * en una prohibición de FORMA y destruían la tabla pedida. Sólo prohíben con marca de EXCLUSIVIDAD («sólo en
 * palabras», «únicamente con palabras»). Afecta a UNA aserción de este gate, re-certificada abajo con su control.
 *
 * ══ POR QUÉ ESTE ARCHIVO SIGUE TENIENDO RAZÓN DE EXISTIR ══════════════════════════════════════════════════════
 * Su afirmación CENTRAL —la del título— es la del POLISÉMICO, y está intacta: negar una columna o un cuadro no
 * mata la tabla que el mismo turno pidió, y sin pedido positivo esos polisémicos siguen prohibiendo. Las secciones
 * 1, 2, 5 y la cara A de la 6 no tocan el eje retirado en ningún punto y siguen verdes enteras. Lo que se perdió
 * es la mitad «inequívoca» de la sección 3, que era el CONTRAPESO de la afirmación central, no la afirmación.
 * Ese contrapeso no desapareció: quedó la familia del VERBO negado («no me tabules», «no tabular»), que es hoy lo
 * único de `_PROHIBE_FORMA`, y sigue ganando sobre el disparador positivo — se prueba en 3-a.
 *
 * LA AFIRMACIÓN QUE ESTE GATE CERTIFICA, y es UNA sola regla con dos caras:
 *
 *   Un pedido de forma del usuario puede decir que NO — pero el motor tiene que leer CONTRA QUÉ dice que no.
 *   · Si lo negado es el VERBO `tabular` en modo cerrado (imperativo/subjuntivo/infinitivo) → es una ORDEN sobre
 *     la presentación y gana sobre todo, incluso sobre un pedido positivo co-ocurrente. [Los SUSTANTIVOS
 *     inequívocos —tabla, planilla, grilla, cuadrito— estaban acá y SE RETIRARON: ver el límite de arriba.]
 *   · Si lo negado es un sustantivo POLISÉMICO —`columna`, `cuadro`, `matriz` nombran la forma Y UNA PARTE DEL
 *     CONTENIDO de una tabla— o si lo que hay es una mención POSITIVA de la forma opuesta (la prosa), entonces
 *     sólo prohíbe cuando el mismo turno NO pidió la tabla. Si la pidió, lo negado es una PARTE (o se pidieron LAS
 *     DOS formas) y LA TABLA SE ENTREGA.
 *
 * POR QUÉ EXISTE ESTE ARCHIVO. La primera versión del eje negativo (defecto D8) metió `columnas`, `cuadros` y
 * `matriz` en la misma lista que `tabla` y le dio a la prohibición precedencia absoluta. Resultado medido
 * end-to-end: «Dame la tabla mes a mes, sin la columna de unidades» resolvía `forbidden`, al narrador le llegaba
 * `instruccion_sin_tabla=true` y guardC rechazaba con `tabla-no-autorizada` LA TABLA QUE EL TURNO PEDÍA CON TODAS
 * LAS LETRAS. Igual «Dame la tabla mes a mes y explicámelo en palabras simples». Es el defecto del owner
 * 2026-08-07 —«si el usuario pidió la tabla, la pidió»— reintroducido por el lado opuesto: un guard que bloquea
 * una respuesta correcta hace más daño que el agujero que vino a tapar.
 *
 * ASIMETRÍA DELIBERADA (doctrina de la casa: antes falso negativo que falso positivo). Ante un turno ambiguo, este
 * eje prefiere NO prohibir. Que se escape una prohibición borrosa cuesta un turno de más; prohibir una tabla
 * pedida rompe un turno que hoy funciona.
 *
 * LAS DOS CARAS SE PRUEBAN ACÁ, siempre juntas: cada sección que afirma que algo YA NO se bloquea trae al lado la
 * batería de prohibiciones REALES que SÍ se siguen bloqueando, con el mismo camino y el mismo guard.
 *
 * OFFLINE PURO: detectores puros + contrato de narración + guardC sobre texto fijo. Cero red, cero LLM, cero
 * credencial. `node --import ./scripts/offline-guard.mjs _negacion_de_parte_no_es_negacion_de_forma_gate.mjs`.
 */
import { resolveTablePolicy, prohibeFormaTabular, pidePresentacionTabular, pideTablaExplicita, pideDetalleTemporal, pideDetalleComposicion } from "./src/adi/oracle/progressiveDisclosure.js";
import { buildNarrationContract } from "./src/adi/oracle/narrationContract.js";
import { buildNarrateUserMessageC } from "./src/adi/oracle/narratePromptC.js";
import { guardC } from "./src/adi/oracle/guardC.js";
import { fig, parseFigures } from "./src/adi/boleta.js";

let PASS = 0, FAIL = 0;
const ok = (cond, msg) => { if (cond) { PASS++; console.log("  ok   " + msg); } else { FAIL++; console.log("  FAIL " + msg); } };
const corto = (q) => (q.length > 46 ? q.slice(0, 46) + "…" : q);

// ── material fijo del turno ────────────────────────────────────────────────────────────────────────────────────
const TABLA = ["| Mes | Venta |", "|---|---:|", "| Ene | $9.0M |", "| Feb | $6.0M |", "| Mar | $7.0M |"].join("\n");
const PROSA = "En enero vendió $9.0M, en febrero $6.0M y en marzo $7.0M.";
const LEDGER = { figs: parseFigures(TABLA + "\n" + PROSA).map((f) => fig("Venta · mes", f.text, { unit: f.unit, raw: f.raw })) };
const RESULTS = [{ tool: "trend", coverage: { supported: true }, facts: { entity: "Falabella" } }];
const PLAN = { intent: "answer", mode: "default", calls: [{ tool: "trend", entity: "Falabella" }] };
const kinds = (v) => (v.violations || []).map((x) => x.kind);

// El camino COMPLETO, exactamente el de answerViaOracle.js:1826 → contrato sellado → payload de NARRAR → guardC.
function recorrido(q) {
  const tablePolicy = resolveTablePolicy({ text: q, podado: [] });
  const contrato = buildNarrationContract({ text: q, plan: PLAN, results: RESULTS, ledgerFigs: LEDGER.figs, tablePolicy });
  const raw = buildNarrateUserMessageC({ text: q, plan: PLAN, results: RESULTS, ledgerFigs: LEDGER.figs, tablePolicy });
  const payload = typeof raw === "string" ? JSON.parse(raw) : raw;
  const guard = guardC(TABLA, { ledger: LEDGER, results: RESULTS, question: q, tablePolicy });
  return { tablePolicy, sellada: contrato.politicaExtension.tablePolicy, payload, guard };
}

console.log("\n══ 1 · NEGAR UNA PARTE NO ES NEGAR LA FORMA · la tabla pedida sobrevive a la negación de una columna ══");
{
  // Los cinco objetos negados son POLISÉMICOS y en los cinco el turno ARRANCA pidiendo la tabla. Antes: forbidden.
  const casos = [
    ["Dame la tabla mes a mes, sin la columna de unidades.", "una COLUMNA de la tabla"],
    ["Quiero la tabla por marca, sin las columnas de costo.", "dos COLUMNAS de la tabla"],
    ["Armá una tabla con el mix, sin columnas de más.", "columnas SOBRANTES (sin determinante)"],
    ["Dame la tabla completa de Falabella, sin el cuadro de resumen final.", "un SUB-BLOQUE de la respuesta"],
    ["Mostrame la tabla mes a mes, sin la matriz de correlación.", "otro ARTEFACTO, no la tabla pedida"],
    ["Dame la tabla por familia, evitá las columnas de stock.", "otra familia de negación, mismo objeto polisémico"],
    ["Quiero la evolución mes a mes, nada de columnas de proyección.", "el disparador positivo es TEMPORAL, no la palabra tabla"],
  ];
  for (const [q, nota] of casos) {
    ok(pidePresentacionTabular(q), `el turno PIDE la tabla/el detalle en positivo (si no, el caso no probaría nada): «${corto(q)}»`);
    ok(!prohibeFormaTabular(q), `y negar ${nota} NO es prohibir la forma: «${corto(q)}»`);
    ok(resolveTablePolicy({ text: q, podado: [] }) === "required", `→ required, la tabla se entrega: «${corto(q)}»`);
  }
}

console.log("\n══ 2 · PEDIR LAS DOS FORMAS NO ES PROHIBIR NINGUNA · tabla + explicación en palabras ══");
{
  // «explicámelo en palabras simples» es de las maneras más comunes de pedir una explicación y no prohíbe nada.
  // Un turno que pide las DOS formas no puede perder la que pidió explícitamente.
  const casos = [
    "Dame la tabla mes a mes y explicámelo en palabras simples.",
    "Quiero la tabla de Falabella, y contámelo con palabras que entienda.",
    "Explicame en prosa qué pasa y dame además la tabla mes a mes.",
    "Armá una tabla con el mix y abajo explicámelo en texto corrido.",
    "Mostrame la evolución mes a mes y hablándolo un poco, por favor.",
  ];
  for (const q of casos) {
    ok(pidePresentacionTabular(q), `el turno pide la tabla/el detalle EN POSITIVO: «${corto(q)}»`);
    ok(!prohibeFormaTabular(q), `y la mención de la prosa NO se lee como prohibición: «${corto(q)}»`);
    ok(resolveTablePolicy({ text: q, podado: [] }) === "required", `→ required: «${corto(q)}»`);
  }
}

console.log("\n══ 3 · LA OTRA CARA · las prohibiciones REALES se siguen bloqueando igual que antes ══");
{
  // (a) LO QUE SIGUE GANANDO sobre el disparador positivo pegado: el VERBO `tabular` negado en modo CERRADO. Es la
  // única familia que quedó viva en `_PROHIBE_FORMA` y conserva ENTERA la propiedad que este bloque certificaba —
  // la prohibición gana aunque el mismo turno traiga un pedido de tabla o de detalle. Se prueba con el disparador
  // pegado en los cuatro casos, que es lo que la hace distinta del bloque (b).
  console.log("  ·· SIGUE VALIENDO: el VERBO negado gana sobre el disparador positivo del mismo turno");
  const vivas = [
    ["Respondeme en formato narrativo, no tabular.", "«no tabular» INFINITIVO, con _PIDE_TABLA pegado"],
    ["Contame el mes a mes sin tabular.", "«sin» + INFINITIVO, con _TEMPORAL pegado"],
    ["No me tabules nada, contame nomás qué pasó mes a mes.", "«no me tabules» SUBJUNTIVO, con _TEMPORAL pegado"],
    ["Nada de tabular, hablame nomás del mes a mes.", "«nada de» + INFINITIVO, con _TEMPORAL pegado"],
  ];
  for (const [q, nota] of vivas) {
    ok(pidePresentacionTabular(q), `el disparador positivo SIGUE presente (${nota}): «${corto(q)}»`);
    ok(prohibeFormaTabular(q), `y la negación del VERBO gana igual: «${corto(q)}»`);
    ok(resolveTablePolicy({ text: q, podado: [] }) === "forbidden", `→ forbidden: «${corto(q)}»`);
  }

  /* (a-bis) RE-CERTIFICADO · EL LÍMITE ABIERTO (E3.t3) ────────────────────────────────────────────────────────
   * ESTOS SEIS CASOS AFIRMABAN «forbidden». HOY AFIRMAN `required`, QUE ES LO QUE PASA DE VERDAD. No es un
   * aflojamiento: es el VALOR EXACTO, no un «!== forbidden» que dejaría pasar cualquier cosa. Ninguno se borró.
   * LA CAUSA, medida y no adivinada: con `_negaciones(_TABLA_N_FORMA)` fuera de `_PROHIBE_FORMA`, el paso 1 de
   * `prohibeFormaTabular` ya no ve estos turnos; el paso 2 corta porque el MISMO turno trae un disparador positivo
   * (por eso se sigue afirmando que está presente: sin él el caso no probaría nada, y además explicaría el valor);
   * `resolveTablePolicy` cae en `required`. Si la lista retirada vuelve, los 18 chequeos se ponen rojos. */
  console.log("  ·· EL LÍMITE ABIERTO (E3.t3): el SUSTANTIVO inequívoco negado ya no gana — manda el positivo");
  const recertificadas = [
    ["Explicalo sin repetir la tabla: cuál fue el peor mes.", "_TEMPORAL pegado (peor mes)"],
    ["Sin tablas por favor: contame el desglose en prosa.", "_DESGLOSE pegado (desglose)"],
    ["No quiero la tabla de Falabella, explicame qué le pasa mes a mes.", "pedido de tabla Y temporal pegados"],
    ["Dame el mes a mes pero sin planillas.", "otro sustantivo inequívoco, _TEMPORAL pegado"],
    ["Quiero el desglose por familia, sin ninguna grilla.", "otro más, _DESGLOSE pegado"],
    ["Contame la evolución, nada de cuadritos.", "el diminutivo, _TEMPORAL pegado"],
  ];
  for (const [q, nota] of recertificadas) {
    ok(pidePresentacionTabular(q), `el disparador positivo SIGUE presente (${nota}) — es el que hoy gana: «${corto(q)}»`);
    ok(!prohibeFormaTabular(q), `EL LÍMITE: el detector YA NO lee la prohibición del sustantivo inequívoco: «${corto(q)}»`);
    ok(resolveTablePolicy({ text: q, podado: [] }) === "required", `→ E3.t3 ABIERTO: valor real required (no forbidden) — se entrega la tabla que el turno negó: «${corto(q)}»`);
  }
  // EL TESTIGO MÍNIMO DEL RETIRO, medido y no declarado: sustantivo INEQUÍVOCO negado, SIN el verbo `tabular`, SIN
  // ningún polisémico y SIN disparador positivo — o sea, sin ninguna de las familias que quedaron vivas y sin nada
  // que explique el valor salvo el retiro mismo. Si cualquier negación de sustantivo inequívoco volviera a
  // `_PROHIBE_FORMA`, esto deja de ser `auto`. Es el detector del regreso, separado del ruido de los otros ejes.
  ok(resolveTablePolicy({ text: "No me armes ninguna tabla, decime qué está pasando.", podado: [] }) === "auto",
    "TESTIGO DEL RETIRO: inequívoco negado y SOLO → auto (de `_PROHIBE_FORMA` sólo sobrevive la familia del verbo)");
  // (b) sustantivo POLISÉMICO negado SIN pedido positivo: sigue siendo una prohibición de forma, como siempre.
  const polisemicas = [
    "Evitá las columnas, quiero leerlo de corrido.",
    "Basta de cuadros, hablemos del negocio.",
    "Nada de columnas, contame qué está pasando.",
    "No me armes ningún cuadro, decime nomás qué está pasando.",
  ];
  for (const q of polisemicas) {
    ok(!pidePresentacionTabular(q), `no hay pedido positivo que la contradiga: «${corto(q)}»`);
    ok(resolveTablePolicy({ text: q, podado: [] }) === "forbidden", `el polisémico negado SOLO sigue prohibiendo → forbidden: «${corto(q)}»`);
  }
  // (d) EL LÍMITE DECLARADO, escrito como prueba y no como comentario. La asimetría tiene un costo conocido: un
  // turno que prohíbe con un POLISÉMICO y encima arrastra un disparador positivo se resuelve `required`, o sea la
  // prohibición se escapa. «No me armes ningún cuadro, decime nomás cómo VIENE el negocio» lleva "cómo viene",
  // que es _TEMPORAL. Se deja abierto A PROPÓSITO: cerrarlo exige decidir a favor de la prohibición en un turno
  // ambiguo, y ahí vuelve el falso positivo que este archivo existe para impedir. Un límite declarado vale más
  // que un verde apretado. Si algún día cambia, que cambie con este chequeo en rojo y no en silencio.
  const RESIDUAL = "No me armes ningún cuadro, decime nomás cómo viene el negocio.";
  ok(pidePresentacionTabular(RESIDUAL) && resolveTablePolicy({ text: RESIDUAL, podado: [] }) === "required",
    "RESIDUAL CONOCIDO: polisémico negado + disparador positivo pegado → la prohibición se escapa (falso negativo elegido)");
  // (c) la prosa pedida SOLA: sigue prohibiendo, como antes — cuando lo nombrado es la FORMA.
  for (const q of ["Contámelo en prosa.", "Prefiero prosa, gracias.", "Dame sólo texto, sin nada raro."]) {
    ok(resolveTablePolicy({ text: q, podado: [] }) === "forbidden", `pedir prosa SOLA sigue prohibiendo la tabla → forbidden: «${corto(q)}»`);
  }
  /* (c-bis) RE-CERTIFICADO · EL SEGUNDO RETIRO · «EN PALABRAS» ES REGISTRO, NO FORMA ──────────────────────────
   * ESTE CASO AFIRMABA «forbidden». HOY AFIRMA `auto`, QUE ES EL VALOR EXACTO. Causa distinta de la de arriba y
   * hay que no confundirlas: el owner ACOTÓ `_PIDE_PROSA` (2026-08-11) porque `\ben palabras\b` suelto convertía
   * un pedido de SIMPLIFICAR en una prohibición de FORMA. Medido end-to-end: «Dame el top 10 de clientes,
   * explicado en palabras simples» destruía la tabla del ranking y la reemplazaba por una línea de prosa de UNA
   * entidad — 10 redacciones de la misma familia daban las 10 forbidden, y el guard de polisemia del paso 2 no las
   * salvaba porque `pidePresentacionTabular` no reconoce «top 10» como pedido tabular. Era capacidad NUEVA que
   * rompía turnos que funcionaban, no capacidad perdida: 0/10 falsos positivos y 0/7 capacidad perdida, medido. */
  ok(resolveTablePolicy({ text: "Explicámelo en palabras simples.", podado: [] }) === "auto",
    "EL LÍMITE (2º retiro): «explicámelo en palabras simples» es REGISTRO y ya no prohíbe → auto (valor real, no forbidden)");
  ok(!prohibeFormaTabular("Dame el top 10 de clientes, explicado en palabras simples."),
    "…y el turno que lo motivó conserva su tabla: «Dame el top 10 de clientes, explicado en palabras simples» no prohíbe nada");
  // LO QUE SÍ QUEDÓ VIVO DEL MISMO EJE, y es el control que impide leer lo de arriba como «palabras nunca prohíbe»:
  // con marca de EXCLUSIVIDAD el usuario sí está eligiendo una forma sobre la otra, y ahí `_PIDE_PROSA` sigue.
  for (const q of ["Contámelo sólo en palabras.", "Explicámelo únicamente con palabras.", "Decímelo solo en palabras, sin nada más."]) {
    ok(resolveTablePolicy({ text: q, podado: [] }) === "forbidden", `pero la EXCLUSIVIDAD sigue prohibiendo → forbidden: «${corto(q)}»`);
  }
}

console.log("\n══ 4 · SUB-DISPARO · lo que sigue cerrado, y lo que el retiro volvió a abrir ══");
{
  console.log("  ·· SIGUE CERRADO: las familias que NO dependen del sustantivo inequívoco");
  const casos = [
    ["No me tabules nada.", "el verbo negado, sin sustantivo de forma"],
    ["Respondeme en formato narrativo, no tabular.", "peor: «no tabular» resolvía REQUIRED — obligado a tabular"],
    ["No hacen falta cuadros, contame el resultado.", "plural de la misma familia, sobre un polisémico sin pedido positivo"],
  ];
  for (const [q, nota] of casos) {
    ok(resolveTablePolicy({ text: q, podado: [] }) === "forbidden", `→ forbidden (${nota}): «${corto(q)}»`);
  }
  /* RE-CERTIFICADO · las tres redacciones que el retiro devolvió a `auto` ─────────────────────────────────────
   * ESTAS TRES AFIRMABAN «forbidden». HOY AFIRMAN `auto`, QUE ES EL VALOR EXACTO — y `auto`, no `required`, es el
   * dato: NO traen disparador positivo, así que la diferencia con el bloque 3-a-bis no es cosmética. Las tres
   * familias sintácticas que este bloque cerró («no hace falta …», «dejá … de lado», el diminutivo en el enum)
   * SIGUEN EXISTIENDO en `_negaciones` y siguen funcionando: lo que se retiró no fue la familia sino su
   * APLICACIÓN al sustantivo inequívoco. Se prueba al lado, con el MISMO patrón sobre un POLISÉMICO, para que se
   * vea que lo perdido es la clase de sustantivo y nada más. */
  console.log("  ·· EL LÍMITE ABIERTO (E3.t3): las mismas familias, aplicadas al sustantivo INEQUÍVOCO");
  const reabiertas = [
    ["No hace falta la tabla, contame nomás qué pasó.", "familia «no hace falta» + `tabla`", "No hacen falta cuadros, contame el resultado."],
    ["Dejá la tabla de lado y explicame el negocio.", "familia «dejá … de lado» + `tabla`", "Dejá el cuadro de lado y explicame el negocio."],
    ["Nada de cuadritos, hablame derecho.", "familia «nada de» + `cuadritos` (diminutivo inequívoco)", "Nada de cuadros, hablame derecho."],
  ];
  for (const [q, nota, gemelo] of reabiertas) {
    ok(!pidePresentacionTabular(q), `sin disparador positivo (por eso cae en auto y no en required): «${corto(q)}»`);
    ok(resolveTablePolicy({ text: q, podado: [] }) === "auto", `→ E3.t3 ABIERTO: valor real auto, no forbidden (${nota}): «${corto(q)}»`);
    ok(resolveTablePolicy({ text: gemelo, podado: [] }) === "forbidden", `…pero LA FAMILIA SIGUE VIVA: el mismo patrón sobre un POLISÉMICO sigue prohibiendo → forbidden: «${corto(gemelo)}»`);
  }
  // el peor de todos, aislado: el turno que dice "no tabular" ya no termina obligado a tabular.
  ok(pideTablaExplicita("Respondeme en formato narrativo, no tabular."), "«no tabular» sigue matcheando el detector POSITIVO (la trampa de `tabul[aá]\\w*` sigue ahí)");
  ok(resolveTablePolicy({ text: "Respondeme en formato narrativo, no tabular.", podado: [] }) !== "required", "…pero ya no gana: la prohibición se resuelve ANTES");
}

console.log("\n══ 5 · CONTROLES DE FALSO POSITIVO · lo que NO puede haberse movido ══");
{
  // Ninguno de estos menciona una forma negada. Si alguno se moviera, el eje estaría leyendo la ORACIÓN y no el
  // sustantivo — que es el defecto que este archivo existe para impedir.
  const neutros = [
    ["cómo va el negocio", "auto"],
    ["compará Falabella y Lider", "auto"],
    ["explicame esta tabla", "auto"],
    ["qué mide esa tabla", "auto"],
    ["no entendí lo de contribución no capturada", "auto"],
    ["la tabla que estoy viendo, qué dice", "auto"],
    ["cayó una línea de producto entera", "auto"],
    ["Dame la tabla mes a mes, sin el diagnóstico.", "required"],
    ["La tabla completa de Falabella, sin recomendación.", "required"],
    ["No, te pedí contribución, no ventas. Dame el mes a mes.", "required"],
    ["Dame la tabla mes a mes, sin las cifras de proyección.", "required"],
    ["Quiero el desglose por familia, sin el detalle de SKU.", "required"],
    // EL RECLAMO NO ES UNA ORDEN · «no tabulaste» es indicativo pasado: el usuario se queja de que FALTÓ la tabla.
    // Con un `tabul\w*` genérico detrás del "no", este turno resolvía `forbidden` y le negaba justo lo que pedía.
    ["¿Por qué no tabulaste el mes a mes?", "required"],
    ["No me tabulaste la evolución, ¿la podés poner?", "required"],
  ];
  for (const [q, esperado] of neutros) {
    ok(resolveTablePolicy({ text: q, podado: [] }) === esperado, `sigue resolviendo ${esperado}: «${corto(q)}»`);
  }
  ok(!prohibeFormaTabular("dame la tabla mes a mes, sin el diagnóstico"), "negar el CONTENIDO no toca la forma");
  ok(!prohibeFormaTabular("explicame esta tabla"), "la DEIXIS no es una prohibición");
  ok(!prohibeFormaTabular("no entendí lo de contribución no capturada"), "un «no» de comprensión no prohíbe nada");
}

console.log("\n══ 6 · END-TO-END · el daño se medía en guardC, así que acá se mide en guardC ══");
{
  // CARA A · la tabla pedida con una PARTE negada, o pedida junto con una explicación: LLEGA AL USUARIO.
  const buenos = [
    "Dame la tabla mes a mes, sin la columna de unidades.",
    "Dame la tabla mes a mes y explicámelo en palabras simples.",
    "Mostrame la tabla de Falabella, sin el cuadro de resumen final.",
    "Quiero la tabla por marca, sin las columnas de costo.",
  ];
  for (const q of buenos) {
    const r = recorrido(q);
    ok(r.tablePolicy === "required", `tablePolicy=required: «${corto(q)}»`);
    ok(r.sellada === "required", "…y el contrato la sella así (la política no se pierde en el camino)");
    ok(!r.payload.instruccion_sin_tabla, "…al narrador NO le llega la orden de no tabular");
    ok(!!r.payload.instruccion_tabla, "…le llega la orden de tabular, que es lo que el turno pidió");
    ok(!kinds(r.guard).includes("tabla-no-autorizada"), `…y guardC NO bloquea la tabla pedida: «${corto(q)}»`);
    ok(r.guard.ok, "…la respuesta tabulada pasa el guard entera");
  }
  // CARA B · el mismo recorrido, con una prohibición REAL DE LAS QUE QUEDARON VIVAS: se bloquea igual que antes.
  const malos = [
    "No me tabules nada, decime qué pasó mes a mes.",
    "Contámelo en prosa.",
  ];
  for (const q of malos) {
    const r = recorrido(q);
    ok(r.tablePolicy === "forbidden", `tablePolicy=forbidden: «${corto(q)}»`);
    ok(r.sellada === "forbidden", "…sellada en el contrato");
    ok(!!r.payload.instruccion_sin_tabla && !r.payload.instruccion_tabla, "…al narrador le llega la prohibición y NO la orden contraria");
    ok(kinds(r.guard).includes("tabla-no-autorizada"), `…y guardC BLOQUEA la tabla que el usuario prohibió: «${corto(q)}»`);
  }
  /* CARA C · RE-CERTIFICADO · EL LÍMITE ABIERTO, MEDIDO HASTA EL FINAL DEL CAMINO ─────────────────────────────
   * ESTOS DOS ESTABAN EN `malos` Y AFIRMABAN «forbidden» + `tabla-no-autorizada`. Hoy afirman el recorrido REAL,
   * eslabón por eslabón y en el valor exacto. Se dejan acá —en vez de borrarlos— justamente porque el daño de
   * E3.t3 no se ve en el detector: se ve al final. El usuario dijo «sin tabla», el narrador recibe la orden de
   * TABULAR, guardC deja pasar la tabla que el turno prohibió, y —la parte cara— si el narrador OBEDECIERA al
   * usuario y respondiera en prosa, guardC lo rechazaría con `tabla-faltante`. Eso último es la medida honesta
   * del defecto abierto y está afirmado como tal, no escondido en un comentario. */
  const abiertos = [
    ["Explicalo sin repetir la tabla: cuál fue el peor mes.", "_TEMPORAL pegado (peor mes)"],
    ["Nada de tablas, contame cómo viene el negocio.", "_TEMPORAL pegado (cómo viene)"],
  ];
  for (const [q, nota] of abiertos) {
    const r = recorrido(q);
    ok(r.tablePolicy === "required", `E3.t3 ABIERTO · tablePolicy=required (valor real, no forbidden) — gana ${nota}: «${corto(q)}»`);
    ok(r.sellada === "required", "…y el contrato sella ESE valor: el defecto no se corrige más adelante en el camino");
    ok(!r.payload.instruccion_sin_tabla && !!r.payload.instruccion_tabla, "…al narrador le llega la orden de TABULAR, o sea lo contrario de lo que pidió el usuario");
    ok(!kinds(r.guard).includes("tabla-no-autorizada") && r.guard.ok, `…y guardC deja pasar entera la tabla que el turno negó: «${corto(q)}»`);
    const vProsa = guardC(PROSA, { ledger: LEDGER, results: RESULTS, question: q, tablePolicy: r.tablePolicy });
    ok(kinds(vProsa).includes("tabla-faltante"), "…y LA PARTE CARA: si el narrador obedeciera al usuario, guardC le cobraría `tabla-faltante` a la prosa obediente");
  }
  // Y EL CONTROL QUE CIERRA LA PINZA: bajo `required`, la prosa obediente sí se rechaza — o sea, el `required` de
  // la cara A no es un valor decorativo, es el que hace que la tabla sea obligatoria.
  const rMixto = recorrido("Dame la tabla mes a mes y explicámelo en palabras simples.");
  const vProsa = guardC(PROSA, { ledger: LEDGER, results: RESULTS, question: "Dame la tabla mes a mes y explicámelo en palabras simples.", tablePolicy: rMixto.tablePolicy });
  ok(kinds(vProsa).includes("tabla-faltante"), "bajo el `required` recuperado, responder SIN tabla un turno que la pidió sigue siendo un incumplimiento");
}

console.log(`\n${PASS} ok · ${FAIL} fallos`);
process.exit(FAIL ? 1 : 0);
