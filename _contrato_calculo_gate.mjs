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
id=c1 · op=aplicar_pct · inputs=$100.0M; 4% · formula=$100.0M + 4% · resultado=$104.0M · unidad=money`;
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
]) ok(juzgar(`${prosa}\n\n${MARCA_CALCULO}\nid=c1 · op=aplicar_pct · inputs=$100.0M; 4% · formula=$100.0M + 4% · resultado=$104.0M · unidad=money`).ok, `${nombre}: la redacción ya no decide`);

console.log("\n── 3 · LA CASCADA POR calc_id ──");
const CASCADA = `El negocio llegaría a $104.0M y la contribución a $26.1M.

${MARCA_CALCULO}
id=c1 · op=aplicar_pct · inputs=$100.0M; 4% · formula=$100.0M + 4% · resultado=$104.0M · unidad=money
id=c2 · op=pct_de · inputs=c1; 25.1% · formula=25.1% de $104.0M · resultado=$26.1M · unidad=money`;
ok(juzgar(CASCADA).ok, "un cálculo puede tomar como insumo el resultado de otro por su id");

console.log("\n── 4 · LOS CONTROLES NEGATIVOS ──");
const N = (nombre, texto, espera = /calculo-no-verificable/) => {
  const v = juzgar(texto);
  ok(!v.ok && espera.test(String(v.verdict)), `${nombre} → ${v.ok ? "PASÓ (mal)" : v.verdict}`);
};
N("la cuenta NO cierra", `Las ventas del negocio subirían a $121.0M.\n\n${MARCA_CALCULO}\nid=c1 · op=aplicar_pct · inputs=$100.0M; 4% · formula=$100.0M + 4% · resultado=$121.0M · unidad=money`);
N("operación inventada", `Las ventas del negocio subirían a $104.0M.\n\n${MARCA_CALCULO}\nid=c1 · op=proyectar_tendencia · inputs=$100.0M; 4% · formula=magia · resultado=$104.0M · unidad=money`);
N("insumo no autorizado", `El negocio llegaría a $312.0M.\n\n${MARCA_CALCULO}\nid=c1 · op=aplicar_pct · inputs=$300.0M; 4% · formula=$300.0M + 4% · resultado=$312.0M · unidad=money`);
N("cascada con el primer eslabón MAL", `El negocio llegaría a $121.0M y la contribución a $30.4M.\n\n${MARCA_CALCULO}\nid=c1 · op=aplicar_pct · inputs=$100.0M; 4% · formula=$100.0M + 4% · resultado=$121.0M · unidad=money\nid=c2 · op=pct_de · inputs=c1; 25.1% · formula=25.1% de $121.0M · resultado=$30.4M · unidad=money`);
// y lo que el bloque NO puede comprar: una cifra que la prosa afirma y el bloque no declara
const v = juzgar(`Las ventas del negocio subirían a $104.0M y el margen a 31.9%.\n\n${MARCA_CALCULO}\nid=c1 · op=aplicar_pct · inputs=$100.0M; 4% · formula=$100.0M + 4% · resultado=$104.0M · unidad=money`);
ok(!v.ok, "una cifra de la prosa que el bloque NO declara sigue muriendo — el bloque no es un pase general");

console.log("\n── 5 · LAS OPERACIONES DEL CONTRATO ──");
const OPS = [
  ["dividir a %", "id=c1 · op=dividir · inputs=$2.06M; $8.2M · formula=$2.06M / $8.2M · resultado=25.1% · unidad=pct", "El margen de Sodimac sobre su venta queda en 25.1%."],
  ["puntos", "id=c1 · op=puntos · inputs=22.0%; 2 · formula=22.0% + 2pp · resultado=24.0% · unidad=pct", "El margen de Falabella pasaría a 24.0%."],
  // restar va como CASCADA a propósito: sus dos insumos son resultados de cálculos previos. Un «restar» con
  // insumos sueltos sin autorizar tiene que morir — y muere: es el control «insumo no autorizado» de arriba.
  ["restar (en cascada, como en la conversación real)",
    "id=c1 · op=aplicar_pct · inputs=$100.0M; 4% · formula=$100.0M + 4% · resultado=$104.0M · unidad=money\nid=c2 · op=pct_de · inputs=c1; 25.1% · formula=25.1% de $104.0M · resultado=$26.1M · unidad=money\nid=c3 · op=restar · inputs=c1; c2 · formula=$104.0M − $26.1M · resultado=$77.9M · unidad=money",
    "El negocio llegaría a $104.0M, la contribución a $26.1M y el costo implícito sería $77.9M."],
  ["sumar", "id=c1 · op=sumar · inputs=$19.4M; $17.9M; $17.3M · formula=suma de los tres · resultado=$54.6M · unidad=money", "Entre Falabella, Lider y Jumbo suman $54.6M."],
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
  ["separador |", "id=c1 | op=aplicar_pct | inputs=$100.0M; 4% | formula=$100.0M + 4% | resultado=$104.0M | unidad=money"],
  ["dos puntos en vez de igual", "id: c1 · op: aplicar_pct · inputs: $100.0M; 4% · formula: $100.0M + 4% · resultado: $104.0M · unidad: money"],
  ["tildes y sinónimos", "id=c1 · operación=aplicar_pct · insumos=$100.0M; 4% · fórmula=$100.0M + 4% · resultado=$104.0M · unidad=money"],
  ["mayúsculas", "ID=c1 · OP=aplicar_pct · INPUTS=$100.0M; 4% · FORMULA=$100.0M + 4% · RESULTADO=$104.0M · UNIDAD=money"],
  ["viñeta y negritas", "- **id=c1** · op=aplicar_pct · inputs=$100.0M; 4% · formula=$100.0M + 4% · resultado=$104.0M · unidad=money"],
  ["insumos con coma", "id=c1 · op=aplicar_pct · inputs=$100.0M, 4% · formula=$100.0M + 4% · resultado=$104.0M · unidad=money"],
  ["comillas de código", "`id=c1 · op=aplicar_pct · inputs=$100.0M; 4% · formula=$100.0M + 4% · resultado=$104.0M · unidad=money`"],
  ["orden de campos distinto", "op=aplicar_pct · resultado=$104.0M · inputs=$100.0M; 4% · unidad=money · id=c1 · formula=$100.0M + 4%"],
  ["sin id (una sola cuenta)", "op=aplicar_pct · inputs=$100.0M; 4% · formula=$100.0M + 4% · resultado=$104.0M · unidad=money"],
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
const _detalle = (t) => String(((juzgar(t).violations || [])[0] || {}).detail || "");
const dCierra = _detalle(`El negocio llegaría a $104.0M y la contribución a $30.4M.\n\n${MARCA_CALCULO}\nid=c1 · op=aplicar_pct · inputs=$100.0M; 4% · formula=$100.0M + 4% · resultado=$104.0M · unidad=money\nid=c2 · op=pct_de · inputs=c1; 25.1% · formula=25.1% de $104.0M · resultado=$30.4M · unidad=money`);
ok(/línea «/.test(dCierra) && /id=c2/.test(dCierra), `la multa CITA la línea culpable, no el bloque entero (${dCierra.slice(0, 90)}…)`);
ok(/campo «resultado»/.test(dCierra), "…y nombra el campo: el resultado es el que no cierra");
ok(!/id=c1/.test(dCierra), "…y NO acusa a la línea que sí cerraba");
const dOp = _detalle(`Las ventas del negocio subirían a $104.0M.\n\n${MARCA_CALCULO}\nid=c1 · op=proyectar_tendencia · inputs=$100.0M; 4% · formula=magia · resultado=$104.0M · unidad=money`);
ok(/campo «op»/.test(dOp), `la operación inventada se cobra en el campo «op» (${dOp.slice(0, 70)}…)`);
const dIn = _detalle(`El negocio llegaría a $312.0M.\n\n${MARCA_CALCULO}\nid=c1 · op=aplicar_pct · inputs=$300.0M; 4% · formula=$300.0M + 4% · resultado=$312.0M · unidad=money`);
ok(/campo «inputs»/.test(dIn) && /\$300\.0M/.test(dIn), `el insumo sin autorizar se cobra en «inputs» y se lo nombra (${dIn.slice(0, 80)}…)`);
// LA LÍNEA A MEDIO ESCRIBIR: antes se descartaba en silencio y la cifra moría después como «cifra-no-autorizada»
const vMal = juzgar(`Las ventas del negocio subirían a $104.0M.\n\n${MARCA_CALCULO}\nid=c1 · inputs=$100.0M; 4% · formula=$100.0M + 4% · resultado=$104.0M · unidad=money`);
ok(!vMal.ok && /calculo-no-verificable/.test(String(vMal.verdict)), `la línea SIN op no pasa en silencio (${vMal.verdict})`);
ok(/campo «op»/.test(String((vMal.violations[0] || {}).detail || "")), "…y la multa dice que el campo que falta es «op»");
const vSinRes = juzgar(`Las ventas del negocio subirían a $104.0M.\n\n${MARCA_CALCULO}\nid=c1 · op=aplicar_pct · inputs=$100.0M; 4% · formula=$100.0M + 4%`);
ok(!vSinRes.ok && /campo «resultado»/.test(String((vSinRes.violations[0] || {}).detail || "")), "…y la línea sin resultado se cobra en «resultado»");
ok(extraerCalculos(`x\n\n${MARCA_CALCULO}\nUna frase suelta sin campos.`).malformadas.length === 0, "una frase suelta dentro del bloque NO se confunde con una línea rota");

console.log(`\n── _contrato_calculo_gate: ${pass} PASS · ${fail} FAIL (de ${pass + fail}) ──`);
process.exit(fail ? 1 : 0);
