/* === _contrato_calculo_gate.mjs · EL CONTRATO ESTRUCTURADO DE CÁLCULO (owner 2026-08-14, opción 3) ============
 * «Cada cálculo que el cerebro muestre tiene que tener también una representación fija y verificable para el
 * notario: operación, inputs, fórmula, resultado, unidad y calc_id. La respuesta al usuario puede seguir siendo
 * natural; el contrato de verificación debe ser estructurado.»
 *
 * POR QUÉ EXISTE: durante cinco corridas el notario reconocía la cuenta por su FORMA de escritura, y cada corrida
 * destapaba una forma nueva. Perseguirlas no converge. Con el bloque declarado, la prosa puede escribirse como
 * se quiera —el notario ya no la lee para verificar cuentas: lee la declaración—.
 *
 * LO QUE FIJA: el bloque nunca llega a pantalla · una cuenta que cierra autoriza su resultado sin importar cómo
 * esté redactada · una cuenta que NO cierra es veto propio · una cascada encadena por calc_id · un insumo no
 * autorizado no pasa · una operación inventada no pasa. CERO red, CERO .env. */
import { guardC } from "./src/adi/oracle/guardC.js";
import { extraerCalculos, MARCA_CALCULO } from "./src/adi/oracle/narrationBlocks.js";
import { cifrasDelDato } from "./src/adi/oracle/datoProyectado.js";
import { axisEntityNames } from "./src/adi/oracle/entityIndex.js";
import { initTenant } from "./src/data/tenantStore.js";
import { TENANT_DEMO } from "./src/data/tenants/demo.js";
initTenant(TENANT_DEMO);

let pass = 0, fail = 0;
const ok = (c, m) => { console.log(`  ${c ? "✓" : "✗"} ${m}`); c ? pass++ : fail++; };
const ejes = (a) => a.flatMap((e) => { try { return axisEntityNames(e); } catch { return []; } });
const CTX = { ledger: { figs: [] }, results: [], trace: null, question: "Si subo ventas 4%, ¿qué cambia?", supuestoPendiente: ["4%"], datoProyectado: cifrasDelDato("actual"), entidadesDelTenant: ejes(["cliente", "sku", "marca"]), duenosDelTenant: ejes(["cliente", "sku", "marca", "familia", "bodega", "canal"]), contentScope: "full", tablePolicy: "auto" };
const juzgar = (t, extra = {}) => guardC(t, { ...CTX, ...extra });

console.log("── 1 · EL BLOQUE SE PARSEA Y NO LLEGA A PANTALLA ──");
const CONBLOQUE = `Las ventas del negocio subirían a $104.0M.

${MARCA_CALCULO}
id=c1 · op=aplicar_pct · inputs=$100.0M; 4% · formula=$100.0M + 4% · resultado=$104.0M · unidad=money · dueno=total`;
const ex = extraerCalculos(CONBLOQUE);
ok(ex.calculos.length === 1, `se parsea 1 cálculo (obtuvo ${ex.calculos.length})`);
ok(ex.calculos[0].id === "c1" && ex.calculos[0].op === "aplicar_pct" && ex.calculos[0].resultado === "$104.0M", "con sus campos: id, op, resultado");
ok(ex.calculos[0].inputs.length === 2 && ex.calculos[0].inputs[0] === "$100.0M", "y sus insumos separados");
ok(!ex.limpio.includes(MARCA_CALCULO) && !ex.limpio.includes("op=aplicar_pct"), "el bloque NO queda en el texto que ve el usuario");
ok(ex.limpio.includes("Las ventas del negocio subirían a $104.0M"), "la prosa se conserva intacta");
ok(extraerCalculos("Sin bloque acá.").calculos.length === 0, "sin bloque, no hay cálculos (y el texto no se toca)");

console.log("\n── 2 · LA CUENTA QUE CIERRA AUTORIZA SU RESULTADO, ESCRITA COMO SEA ──");
ok(!juzgar("Las ventas del negocio subirían a $104.0M.").ok, "sin declaración, el $104.0M muere (es el estado de siempre)");
ok(juzgar(CONBLOQUE).ok, "con la declaración que cierra, pasa");
// LA PRUEBA DE FONDO: la prosa puede estar escrita de CUALQUIER forma — es lo que esta opción compra.
for (const [nombre, prosa] of [
  ["forma coloquial", "Con ese 4%, el negocio se iría a unos $104.0M."],
  ["sin operador visible", "Las ventas totales del negocio quedarían en $104.0M el año próximo."],
  ["con la cuenta al revés", "$104.0M es lo que da el negocio aplicando tu 4%."],
]) ok(juzgar(`${prosa}\n\n${MARCA_CALCULO}\nid=c1 · op=aplicar_pct · inputs=$100.0M; 4% · formula=$100.0M + 4% · resultado=$104.0M · unidad=money · dueno=total`).ok, `${nombre}: la redacción ya no decide`);

console.log("\n── 3 · LA CASCADA POR calc_id ──");
const CASCADA = `El negocio llegaría a $104.0M y la contribución a $26.1M.

${MARCA_CALCULO}
id=c1 · op=aplicar_pct · inputs=$100.0M; 4% · formula=$100.0M + 4% · resultado=$104.0M · unidad=money · dueno=total
id=c2 · op=pct_de · inputs=c1; 25.1% · formula=25.1% de $104.0M · resultado=$26.1M · unidad=money · dueno=total`;
ok(juzgar(CASCADA).ok, "un cálculo puede tomar como insumo el resultado de otro por su id");

console.log("\n── 4 · LOS CONTROLES NEGATIVOS ──");
const N = (nombre, texto, espera = /calculo-no-verificable/) => {
  const v = juzgar(texto);
  ok(!v.ok && espera.test(String(v.verdict)), `${nombre} → ${v.ok ? "PASÓ (mal)" : v.verdict}`);
};
N("la cuenta NO cierra", `Las ventas del negocio subirían a $121.0M.\n\n${MARCA_CALCULO}\nid=c1 · op=aplicar_pct · inputs=$100.0M; 4% · formula=$100.0M + 4% · resultado=$121.0M · unidad=money · dueno=total`);
N("operación inventada", `Las ventas del negocio subirían a $104.0M.\n\n${MARCA_CALCULO}\nid=c1 · op=proyectar_tendencia · inputs=$100.0M; 4% · formula=magia · resultado=$104.0M · unidad=money · dueno=total`);
N("insumo no autorizado", `El negocio llegaría a $312.0M.\n\n${MARCA_CALCULO}\nid=c1 · op=aplicar_pct · inputs=$300.0M; 4% · formula=$300.0M + 4% · resultado=$312.0M · unidad=money · dueno=total`);
N("cascada con el primer eslabón MAL", `El negocio llegaría a $121.0M y la contribución a $30.4M.\n\n${MARCA_CALCULO}\nid=c1 · op=aplicar_pct · inputs=$100.0M; 4% · formula=$100.0M + 4% · resultado=$121.0M · unidad=money · dueno=total\nid=c2 · op=pct_de · inputs=c1; 25.1% · formula=25.1% de $121.0M · resultado=$30.4M · unidad=money · dueno=total`);
// y lo que el bloque NO puede comprar: una cifra que la prosa afirma y el bloque no declara
const v = juzgar(`Las ventas del negocio subirían a $104.0M y el margen a 31.9%.\n\n${MARCA_CALCULO}\nid=c1 · op=aplicar_pct · inputs=$100.0M; 4% · formula=$100.0M + 4% · resultado=$104.0M · unidad=money · dueno=total`);
ok(!v.ok, "una cifra de la prosa que el bloque NO declara sigue muriendo — el bloque no es un pase general");

console.log("\n── 5 · LAS OPERACIONES DEL CONTRATO ──");
const OPS = [
  ["dividir a %", "id=c1 · op=dividir · inputs=$2.06M; $8.2M · formula=$2.06M / $8.2M · resultado=25.1% · unidad=pct · dueno=Sodimac", "El margen de Sodimac sobre su venta queda en 25.1%."],
  ["puntos", "id=c1 · op=puntos · inputs=22.0%; 2 · formula=22.0% + 2pp · resultado=24.0% · unidad=pct · dueno=Falabella", "El margen de Falabella pasaría a 24.0%."],
  // restar va como CASCADA a propósito: sus dos insumos son resultados de cálculos previos. Un «restar» con
  // insumos sueltos sin autorizar tiene que morir — y muere: es el control «insumo no autorizado» de arriba.
  ["restar (en cascada, como en la conversación real)",
    "id=c1 · op=aplicar_pct · inputs=$100.0M; 4% · formula=$100.0M + 4% · resultado=$104.0M · unidad=money · dueno=total\nid=c2 · op=pct_de · inputs=c1; 25.1% · formula=25.1% de $104.0M · resultado=$26.1M · unidad=money · dueno=total\nid=c3 · op=restar · inputs=c1; c2 · formula=$104.0M − $26.1M · resultado=$77.9M · unidad=money · dueno=total",
    "El negocio llegaría a $104.0M, la contribución a $26.1M y el costo implícito sería $77.9M."],
  ["sumar", "id=c1 · op=sumar · inputs=$19.4M; $17.9M; $17.3M · formula=suma de los tres · resultado=$54.6M · unidad=money · dueno=total", "Entre Falabella, Lider y Jumbo suman $54.6M."],
];
for (const [nombre, linea, prosa] of OPS) ok(juzgar(`${prosa}\n\n${MARCA_CALCULO}\n${linea}`).ok, `${nombre} verifica`);

/* ── 6 · LA TOLERANCIA DE FORMA (owner 2026-08-14, tras el examen 1) ──────────────────────────────────────────
 * MEDIDO: dos de cinco preguntas cayeron al suplente por `calculo-no-verificable` — con ocho entidades el
 * cerebro escribía «fórmula» con tilde, «operacion», o separaba con «|». No mentía: se le rompía la FORMA.
 * Se tolera la forma. NO se toca la verificación: cada variante se RECOMPUTA igual, y por eso cada caso
 * positivo de abajo tiene su gemelo negativo con el resultado falseado. */
console.log("\n── 6 · TOLERANCIA DE FORMA · misma cuenta escrita de otra manera ──");
const PROSA6 = "Las ventas del negocio subirían a $104.0M.";
const VARIANTES = [
  ["separador |", "id=c1 | op=aplicar_pct | inputs=$100.0M; 4% | formula=$100.0M + 4% | resultado=$104.0M | unidad=money | dueno=total"],
  ["dos puntos en vez de igual", "id: c1 · op: aplicar_pct · inputs: $100.0M; 4% · formula: $100.0M + 4% · resultado: $104.0M · unidad: money · dueno: total"],
  ["tildes y sinónimos", "id=c1 · operación=aplicar_pct · insumos=$100.0M; 4% · fórmula=$100.0M + 4% · resultado=$104.0M · unidad=money · dueno=total"],
  ["mayúsculas", "ID=c1 · OP=aplicar_pct · INPUTS=$100.0M; 4% · FORMULA=$100.0M + 4% · RESULTADO=$104.0M · UNIDAD=money · DUENO=total"],
  ["viñeta y negritas", "- **id=c1** · op=aplicar_pct · inputs=$100.0M; 4% · formula=$100.0M + 4% · resultado=$104.0M · unidad=money · dueno=total"],
  ["insumos con coma", "id=c1 · op=aplicar_pct · inputs=$100.0M, 4% · formula=$100.0M + 4% · resultado=$104.0M · unidad=money · dueno=total"],
  ["comillas de código", "`id=c1 · op=aplicar_pct · inputs=$100.0M; 4% · formula=$100.0M + 4% · resultado=$104.0M · unidad=money · dueno=total`"],
  ["orden de campos distinto", "op=aplicar_pct · resultado=$104.0M · inputs=$100.0M; 4% · unidad=money · dueno=total · id=c1 · formula=$100.0M + 4%"],
  ["sin id (una sola cuenta)", "op=aplicar_pct · inputs=$100.0M; 4% · formula=$100.0M + 4% · resultado=$104.0M · unidad=money · dueno=total"],
];
for (const [nombre, linea] of VARIANTES) {
  ok(juzgar(`${PROSA6}\n\n${MARCA_CALCULO}\n${linea}`).ok, `${nombre}: la forma ya no decide`);
  // EL GEMELO NEGATIVO: la MISMA variante con el resultado falseado tiene que morir. Tolerar la forma no puede
  // significar creerle a la cuenta.
  const falsa = linea.replace(/104\.0M/g, "121.0M");
  const vf = juzgar(`Las ventas del negocio subirían a $121.0M.\n\n${MARCA_CALCULO}\n${falsa}`);
  ok(!vf.ok && /calculo-no-verificable/.test(String(vf.verdict)), `  …y la misma variante con la cuenta FALSA muere igual (${vf.ok ? "PASÓ (mal)" : vf.verdict})`);
}
ok(extraerCalculos(`x\n\n${MARCA_CALCULO}\nid=c1 | op=aplicar_pct | inputs=$100.0M, 4% | resultado=$104.0M`).calculos[0].inputs.length === 2, "los insumos separados por coma se parten en dos");
ok(extraerCalculos(`x\n\n${MARCA_CALCULO}\nop=sumar · inputs=$1,234; $2,766 · resultado=$4,000`).calculos[0].inputs.length === 2, "…pero la coma DE MILES no parte un número en dos");

/* ── 7 · LA MULTA DICE QUÉ LÍNEA Y QUÉ CAMPO ──────────────────────────────────────────────────────────────────
 * «Si una línea falla, la multa debe decir exactamente qué línea y qué campo falló» (owner). Sin esto el
 * reintento reescribe a ciegas un bloque de doce líneas y vuelve con el mismo veto. */
console.log("\n── 7 · LA MULTA NOMBRA LA LÍNEA Y EL CAMPO ──");
const _detalle = (t, extra = {}) => String(((juzgar(t, extra).violations || [])[0] || {}).detail || "");
const dCierra = _detalle(`El negocio llegaría a $104.0M y la contribución a $30.4M.\n\n${MARCA_CALCULO}\nid=c1 · op=aplicar_pct · inputs=$100.0M; 4% · formula=$100.0M + 4% · resultado=$104.0M · unidad=money · dueno=total\nid=c2 · op=pct_de · inputs=c1; 25.1% · formula=25.1% de $104.0M · resultado=$30.4M · unidad=money · dueno=total`);
ok(/línea «/.test(dCierra) && /id=c2/.test(dCierra), `la multa CITA la línea culpable, no el bloque entero (${dCierra.slice(0, 90)}…)`);
ok(/campo «resultado»/.test(dCierra), "…y nombra el campo: el resultado es el que no cierra");
ok(!/id=c1/.test(dCierra), "…y NO acusa a la línea que sí cerraba");
const dOp = _detalle(`Las ventas del negocio subirían a $104.0M.\n\n${MARCA_CALCULO}\nid=c1 · op=proyectar_tendencia · inputs=$100.0M; 4% · formula=magia · resultado=$104.0M · unidad=money · dueno=total`);
ok(/campo «op»/.test(dOp), `la operación inventada se cobra en el campo «op» (${dOp.slice(0, 70)}…)`);
const dIn = _detalle(`El negocio llegaría a $312.0M.\n\n${MARCA_CALCULO}\nid=c1 · op=aplicar_pct · inputs=$300.0M; 4% · formula=$300.0M + 4% · resultado=$312.0M · unidad=money · dueno=total`);
ok(/campo «inputs»/.test(dIn) && /\$300\.0M/.test(dIn), `el insumo sin autorizar se cobra en «inputs» y se lo nombra (${dIn.slice(0, 80)}…)`);
// LA LÍNEA A MEDIO ESCRIBIR: antes se descartaba en silencio y la cifra moría después como «cifra-no-autorizada»
const vMal = juzgar(`Las ventas del negocio subirían a $104.0M.\n\n${MARCA_CALCULO}\nid=c1 · inputs=$100.0M; 4% · formula=$100.0M + 4% · resultado=$104.0M · unidad=money · dueno=total`);
ok(!vMal.ok && /calculo-no-verificable/.test(String(vMal.verdict)), `la línea SIN op no pasa en silencio (${vMal.verdict})`);
ok(/campo «op»/.test(String((vMal.violations[0] || {}).detail || "")), "…y la multa dice que el campo que falta es «op»");
const vSinRes = juzgar(`Las ventas del negocio subirían a $104.0M.\n\n${MARCA_CALCULO}\nid=c1 · op=aplicar_pct · inputs=$100.0M; 4% · formula=$100.0M + 4%`);
ok(!vSinRes.ok && /campo «resultado»/.test(String((vSinRes.violations[0] || {}).detail || "")), "…y la línea sin resultado se cobra en «resultado»");
ok(extraerCalculos(`x\n\n${MARCA_CALCULO}\nUna frase suelta sin campos.`).malformadas.length === 0, "una frase suelta dentro del bloque NO se confunde con una línea rota");

/* ── 8 · LA TASA DEL DATO USADA COMO DELTA (owner 2026-08-14, examen 1 · turno 2) ──────────────────────────────
 * MEDIDO: el dato declara la carga comercial de Falabella como «4.5%». Al simular sacarla del todo, la forma
 * correcta de decirlo es «+4.5pp» — el MISMO número del dato en su papel de delta. El canon separaba pct de pp,
 * así que el insumo moría y se llevaba puestas las líneas que dependían de él (4 vetos de una sola causa).
 * NO afloja nada: el número tiene que estar autorizado igual y la cuenta se recomputa igual. */
console.log("\n── 8 · UNA TASA DEL DATO ES LA MISMA CIFRA COMO NIVEL O COMO DELTA ──");
const CARGA = `Sacando por completo la carga comercial de Falabella, su margen llegaría a 26.5%.\n\n${MARCA_CALCULO}\nid=c1 · op=puntos · inputs=22.0%; 4.5pp · formula=22.0% + 4.5pp · resultado=26.5% · unidad=pp · dueno=Falabella`;
ok(juzgar(CARGA).ok, "«4.5pp» se autoriza porque el dato declara esa carga como 4.5% — mismo número, otro papel");
const dCarga = _detalle(`Sacando la carga comercial de Falabella, su margen llegaría a 30.0%.\n\n${MARCA_CALCULO}\nid=c1 · op=puntos · inputs=22.0%; 4.5pp · formula=22.0% + 4.5pp · resultado=30.0% · unidad=pp · dueno=Falabella`);
ok(/campo «resultado»/.test(dCarga) && /26\.5%/.test(dCarga), `…pero la cuenta se recomputa igual: 22.0 + 4.5 = 26.5, no 30.0 (${dCarga.slice(0, 100)}…)`);
ok(!juzgar(`El margen de Falabella llegaría a 29.7%.\n\n${MARCA_CALCULO}\nid=c1 · op=puntos · inputs=22.0%; 7.7pp · formula=22.0% + 7.7pp · resultado=29.7% · unidad=pp · dueno=Falabella`).ok,
  "…y un número que NO está en el dato no se salva por escribirlo en puntos (7.7pp muere igual)");
ok(/da 26\.5%/.test(dCarga) && !/\$/.test(dCarga.split("y declaraste")[0]), "…y la multa habla en % cuando la unidad es una tasa, no en $ (decía «da $31»)");

console.log("\n── 8b · UNA BRECHA NEGATIVA NO ES UN ESCENARIO IMPOSIBLE ──");
// el tope de viabilidad es para las operaciones que MUEVEN un nivel. Restar dos tasas para medir una distancia
// puede dar negativo con todo derecho — vetarlo era castigar la aritmética correcta de una brecha.
const BRECHA = `Ripley está 5.1 puntos por debajo del benchmark.\n\n${MARCA_CALCULO}\nid=c1 · op=restar · inputs=25.0%; 30.1% · formula=25.0% − 30.1% · resultado=-5.1pp · unidad=pct · dueno=Ripley`;
const vBrecha = juzgar(BRECHA);
ok(vBrecha.ok, `la brecha negativa de una resta pasa (obtuvo ${vBrecha.ok ? "PASA" : vBrecha.verdict})`);
// …y el tope SIGUE cazando lo que tiene que cazar: aplicar un delta mayor que el nivel disponible
// (con la pregunta que declara el supuesto: sin los 2pp del usuario el insumo muere antes, por otra razón)
const Q2PP = { question: "Reduce 2 puntos porcentuales las acciones comerciales de Mercado Libre.", supuestoPendiente: ["2pp"] };
const vTope = juzgar(`La carga de Mercado Libre quedaría en -0.2%.\n\n${MARCA_CALCULO}\nid=c1 · op=puntos · inputs=1.8%; 2pp · formula=1.8% − 2pp · resultado=-0.2% · unidad=pct · dueno=Mercado Libre`, Q2PP);
ok(!vTope.ok && vTope.verdict === "escenario-inviable", `…y recortar 2pp de una carga de 1.8% sigue siendo inviable (${vTope.verdict})`);
const vTopePP = juzgar(`La carga de Mercado Libre quedaría en -0.2%.\n\n${MARCA_CALCULO}\nid=c1 · op=puntos · inputs=1.8%; 2pp · formula=1.8% − 2pp · resultado=-0.2pp · unidad=pp · dueno=Mercado Libre`, Q2PP);
ok(!vTopePP.ok && vTopePP.verdict === "escenario-inviable", `…incluso declarado con unidad «pp», que antes se escapaba del tope (${vTopePP.verdict})`);

console.log("\n── 8c · EL DAÑO COLATERAL DE LA CASCADA SE DICE COMO LO QUE ES ──");
const dCasc = _detalle(`El margen de Falabella llegaría a 30.0% y la brecha sería 0.1pp.\n\n${MARCA_CALCULO}\nid=c1 · op=puntos · inputs=22.0%; 4.5pp · formula=22.0% + 4.5pp · resultado=30.0% · unidad=pp · dueno=Falabella\nid=c2 · op=restar · inputs=30.1%; c1 · formula=30.1% − 30.0% · resultado=0.1pp · unidad=pp · dueno=Falabella`);
const vCasc = juzgar(`El margen de Falabella llegaría a 30.0% y la brecha sería 0.1pp.\n\n${MARCA_CALCULO}\nid=c1 · op=puntos · inputs=22.0%; 4.5pp · formula=22.0% + 4.5pp · resultado=30.0% · unidad=pp · dueno=Falabella\nid=c2 · op=restar · inputs=30.1%; c1 · formula=30.1% − 30.0% · resultado=0.1pp · unidad=pp · dueno=Falabella`);
ok(/id=c1/.test(dCasc), "la multa acusa a c1, que es la línea que realmente falló");
const dSegunda = String((vCasc.violations[1] || {}).detail || "");
ok(/«c1» es una línea que falló antes/.test(dSegunda), `…y a c2 le dice que su insumo cayó, no que «c1 no es una cifra» (${dSegunda.slice(0, 110)}…)`);
ok(/corregí esa línea y esta se resuelve sola/.test(dSegunda), "…y le dice al reintento dónde arreglar de verdad");

/* ── 9 · EL REDONDEO DE PRESENTACIÓN (owner 2026-08-14, examen 1 · turno 3) ────────────────────────────────────
 * La cuenta daba $4,700 y la respuesta mostraba «~$5K» — como lo escribe un ejecutivo. La tolerancia del 2% lo
 * mataba. NO se afloja el umbral: se compara a la precisión que la propia cifra declara, y con tope del 10%. */
console.log("\n── 9 · EL REDONDEO DE PRESENTACIÓN NO ES UN INVENTO ──");
// (el 0.1 lo declara la pregunta: sin eso el insumo muere antes por otra razón, y el caso no probaría nada)
const Q01 = { question: "¿Cuánto vale cerrar una brecha de 0.1 puntos en Ripley?", supuestoPendiente: ["0.1%"] };
const R9 = (res, prosa) => juzgar(`${prosa}\n\n${MARCA_CALCULO}\nid=c1 · op=pct_de · inputs=0.1%; $4.7M · formula=0.1% de $4.7M · resultado=${res} · unidad=money · dueno=Ripley`, Q01);
ok(R9("$5K", "Cerrar la brecha de Ripley vale unos $5K.").ok, "«$5K» sobre una cuenta que da $4,700: el redondeo a miles se autoriza");
ok(R9("$4.7K", "Cerrar la brecha de Ripley vale $4.7K.").ok, "…y la cifra exacta también, por supuesto");
ok(!R9("$9K", "Cerrar la brecha de Ripley vale unos $9K.").ok, "…pero «$9K» sobre los mismos $4,700 muere: no es el redondeo, es otro número");
ok(!R9("$6K", "Cerrar la brecha de Ripley vale unos $6K.").ok, "…y «$6K» tampoco: $4,700 redondea a 5, no a 6");
// EL CANDADO DEL 10%: redondear a una unidad gruesa sí puede engañar. $1.4M escrito «$1M» se lleva el 29%.
const Q14 = { question: "Si el negocio recupera 1.4% de la venta total, ¿cuánto es?", supuestoPendiente: ["1.4%"] };
const GRUESO = (res) => juzgar(`El negocio recuperaría ${res}.\n\n${MARCA_CALCULO}\nid=c1 · op=pct_de · inputs=1.4%; $100.0M · formula=1.4% de $100.0M · resultado=${res} · unidad=money · dueno=total`, Q14);
ok(!GRUESO("$1M").ok, "«$1M» por una cuenta que da $1.4M NO pasa: el redondeo se lleva el 29% del valor");
ok(GRUESO("$1.4M").ok, "…y escrita como corresponde, «$1.4M», pasa");
// y el redondeo de una TASA a su propio decimal
ok(juzgar(`La brecha de Ripley es de 0.1 puntos.\n\n${MARCA_CALCULO}\nid=c1 · op=restar · inputs=25.1%; 25.0% · formula=25.1% − 25.0% · resultado=0.1pp · unidad=pp · dueno=Ripley`).ok, "una tasa redondeada a su propio decimal también cierra");

/* ── 10 · EL ERROR REPETIDO ES DE VOCABULARIO, NO DE ARITMÉTICA (owner 2026-08-14, examen 1 · turnos 1 y 3) ────
 * Dos veces el cerebro declaró «$19.4M × 8.1%» queriendo decir «el 8.1% de $19.4M». Multiplicarlos como números
 * crudos da $157M: un valor que nadie quiso decir nunca. Como hay UNA sola lectura sensata, se lee así — y la
 * cuenta se recomputa igual. Donde la lectura NO es única («aplicar_pct»), no se interpreta: se señala. */
console.log("\n── 10 · «$19.4M × 8.1%» TIENE UNA SOLA LECTURA SENSATA ──");
const Q81 = { question: "¿Cuánto suma cerrar la brecha de 8.1 puntos de Falabella?", supuestoPendiente: ["8.1%"] };
ok(juzgar(`Cerrar la brecha de Falabella sumaría $1.57M.\n\n${MARCA_CALCULO}\nid=c1 · op=multiplicar · inputs=$19.4M; 8.1% · formula=$19.4M x 8.1% · resultado=$1.57M · unidad=money · dueno=Falabella`, Q81).ok,
  "«multiplicar» sobre un monto y un porcentaje se lee como «el X% de Y»");
ok(!juzgar(`Cerrar la brecha de Falabella sumaría $157.1M.\n\n${MARCA_CALCULO}\nid=c1 · op=multiplicar · inputs=$19.4M; 8.1% · formula=$19.4M x 8.1% · resultado=$157.1M · unidad=money · dueno=Falabella`, Q81).ok,
  "…y el producto crudo ($157M), que es lo que nadie quiso decir, NO pasa");
// ACOTADO: un escalar y dos tasas siguen siendo multiplicación de verdad
ok(juzgar(`El negocio duplicado llegaría a $200.0M.\n\n${MARCA_CALCULO}\nid=c1 · op=multiplicar · inputs=$100.0M; 2 · formula=$100.0M x 2 · resultado=$200.0M · unidad=money · dueno=total`, { question: "¿Y si duplico la venta (x2)?", supuestoPendiente: ["2"] }).ok,
  "…pero «multiplicar $100.0M × 2» sigue siendo una multiplicación (el escalar no lleva marca de %)");

console.log("\n── 10b · LA MULTA SEÑALA LA OPERACIÓN QUE SÍ CERRARÍA ──");
const dPista = _detalle(`Cerrar la brecha de Falabella sumaría $1.57M.\n\n${MARCA_CALCULO}\nid=c1 · op=aplicar_pct · inputs=$19.4M; 8.1% · formula=$19.4M + 8.1% · resultado=$1.57M · unidad=money · dueno=Falabella`, Q81);
ok(/«pct_de»/.test(dPista), `con «aplicar_pct» la cuenta no cierra, y la multa nombra la que sí: pct_de (${dPista.slice(-120)})`);
ok(/corregí la operación; si no, corregí la cifra/.test(dPista), "…y lo deja como pregunta, no como orden: puede ser la cifra la equivocada");
// y NO se inventa una pista cuando no hay una sola candidata
const dSin = _detalle(`Las ventas del negocio subirían a $121.0M.\n\n${MARCA_CALCULO}\nid=c1 · op=aplicar_pct · inputs=$100.0M; 4% · formula=$100.0M + 4% · resultado=$121.0M · unidad=money · dueno=total`);
ok(!/SÍ cierra si la operación/.test(dSin), "cuando ninguna otra operación cierra, la multa no inventa una pista");

/* ── 11 · LA CIFRA CALCULADA ENTRA CON DUEÑO (owner 2026-08-14, medido EN LA APP) ──────────────────────────────
 * «Una cifra calculada no puede quedar autorizada solo como valor; debe quedar autorizada con dueño, métrica,
 * unidad y concepto, igual que una cifra de la carpeta.»
 * EL CASO QUE LO ORIGINA: ADI mostró «Lider — $17.8M en ventas». Lider vende $17.9M; los $17.8M son la venta de
 * la MARCA LG. La frase suelta moría por `cifra-de-dato-sin-dueno`; lo que la dejó pasar fue que el resultado de
 * un cálculo se adoptaba como VALOR y el chequeo de atribución dejaba de mirarlo. */
console.log("\n── 11 · EL CONTRATO EXIGE DUEÑO DEL RESULTADO ──");
const _L = (linea, prosa = "Lider vendió $17.8M en el año.", extra = {}) => juzgar(`${prosa}\n\n${MARCA_CALCULO}\n${linea}`, extra);
// los casos de simulación declaran los 2 puntos en la pregunta: sin eso el insumo muere antes, por otra razón
const QSIM = { question: "Reduce 2 puntos porcentuales las acciones comerciales de esos clientes.", supuestoPendiente: ["2pp"] };
const dSinD = _detalle(`Las ventas del negocio subirían a $104.0M.\n\n${MARCA_CALCULO}\nid=c1 · op=aplicar_pct · inputs=$100.0M; 4% · formula=$100.0M + 4% · resultado=$104.0M · unidad=money`);
ok(/campo «dueño»/.test(dSinD), `sin dueño la cuenta no autoriza nada, aunque cierre perfecta (${dSinD.slice(0, 90)}…)`);
ok(/dueno=total/.test(dSinD), "…y la multa dice cómo arreglarlo: la entidad, o «total» si es del conjunto");
const dInv = _detalle(`El negocio subiría a $104.0M.\n\n${MARCA_CALCULO}\nid=c1 · op=aplicar_pct · inputs=$100.0M; 4% · formula=$100.0M + 4% · resultado=$104.0M · unidad=money · dueno=Acme Corp`);
ok(/campo «dueño»/.test(dInv) && /Acme Corp/.test(dInv), `un dueño INVENTADO no pasa — es tan grave como inventar la cifra (${dInv.slice(0, 80)}…)`);

console.log("\n── 11b · EL CASO MEDIDO: la cifra de LG puesta en Lider ──");
// $17.3M es de Jumbo y 3.0% es un umbral de la casa: la cuenta cierra en $17.8M, pero no es de Lider.
const vAjeno = _L("id=c1 · op=aplicar_pct · inputs=$17.3M; 3.0% · formula=$17.3M + 3.0% · resultado=$17.8M · unidad=money · dueno=Lider");
ok(!vAjeno.ok, `la cuenta que cierra pero se declara de otro NO pasa (${vAjeno.ok ? "PASÓ (mal)" : vAjeno.verdict})`);
ok(/insumos son de Jumbo/.test(String((vAjeno.violations[0] || {}).detail || "")), "…y la multa dice de quién SON los insumos, que es lo que delata el número ajeno");
// …y con dueño de verdad, la misma cuenta pasa: los insumos de Jumbo dan una cifra de Jumbo
ok(_L("id=c1 · op=aplicar_pct · inputs=$17.3M; 3.0% · formula=$17.3M + 3.0% · resultado=$17.8M · unidad=money · dueno=Jumbo", "Jumbo llegaría a $17.8M con ese ajuste.").ok,
  "la MISMA cuenta declarada de Jumbo (de quien son los insumos) sí pasa");

console.log("\n── 11c · EL DUEÑO SE VERIFICA CONTRA LA PROSA ──");
ok(_L("id=c1 · op=puntos · inputs=22.0%; 2pp · formula=22.0% + 2pp · resultado=24.0% · unidad=pp · dueno=Falabella", "El margen de Falabella pasaría a 24.0%.", QSIM).ok,
  "el dueño declarado nombrado junto a la cifra: pasa");
const vLejos = _L("id=c1 · op=puntos · inputs=22.0%; 2pp · formula=22.0% + 2pp · resultado=24.0% · unidad=pp · dueno=Falabella", "El margen simulado quedaría en 24.0%.", QSIM);
ok(!vLejos.ok && /cifra-calculada-mal-atribuida/.test(String(vLejos.verdict)), `el dueño declarado que NO aparece en la oración: muere (${vLejos.verdict})`);
// EL FALSO POSITIVO QUE HUBO QUE EVITAR: 24.0% es el margen REAL de Jumbo. Una simulación de Falabella que da esa
// misma cifra es legítima — lo que manda es de dónde salen los insumos, no que dos números coincidan.
ok(_L("id=c1 · op=puntos · inputs=22.0%; 2pp · formula=22.0% + 2pp · resultado=24.0% · unidad=pp · dueno=Falabella", "Con el recorte, Falabella llegaría a 24.0% — el mismo margen que hoy tiene Jumbo.", QSIM).ok,
  "una simulación cuyo resultado coincide con la cifra real de OTRA entidad no se veta por parecerse");

console.log("\n── 11d · EL AGREGADO NO SE CUELGA DE UNA ENTIDAD ──");
const AGG = "id=c1 · op=sumar · inputs=$19.4M; $17.9M; $17.3M · formula=suma de los tres · resultado=$54.6M · unidad=money · dueno=total";
ok(juzgar(`Entre Falabella, Lider y Jumbo suman $54.6M.\n\n${MARCA_CALCULO}\n${AGG}`).ok,
  "el conjunto ENUMERADO (tres entidades alrededor) es legítimo: eso es el agregado, no una atribución");
const vCuelga = juzgar(`Falabella concentra $54.6M de venta.\n\n${MARCA_CALCULO}\n${AGG}`);
ok(!vCuelga.ok && /cifra-calculada-mal-atribuida/.test(String(vCuelga.verdict)), `el agregado colgado de UNA entidad muere (${vCuelga.verdict})`);
ok(/Falabella/.test(String((vCuelga.violations[0] || {}).detail || "")), "…y la multa nombra de quién quedó colgado");
ok(juzgar(`El negocio suma $54.6M entre sus tres mayores cuentas.\n\n${MARCA_CALCULO}\n${AGG}`).ok,
  "…y el mismo agregado sin entidad pegada pasa");

console.log(`\n── _contrato_calculo_gate: ${pass} PASS · ${fail} FAIL (de ${pass + fail}) ──`);
process.exit(fail ? 1 : 0);
