/* === _examen4_cierres_gate.mjs · LOS DOS CIERRES DEL EXAMEN 4 + LA ETIQUETA DE LOS DÍAS (owner 2026-08-16) ====
 * El Examen 4 dejó dos defectos que ningún chequeo veía, y el owner pidió cerrarlos antes de dar por graduado el
 * camino natural:
 *   (1) SUPERLATIVOS Y COMPARATIVOS DE ORDEN — «el peor», «el mayor», «el más bajo», «el principal», «el más
 *       crítico» se verifican contra el conjunto y la métrica, igual que un ranking: una clasificación también
 *       es evidencia. CASO CONTROL DEL OWNER, textual: «Falabella tiene el peor margen de los tres grandes»
 *       debe MORIR porque Lider tiene 21.5% y Falabella 22.0%.
 *   (2) JUICIO ASESOR vs HECHO — cuando ADI recomienda o prioriza, marca qué es dato duro y qué es criterio
 *       suyo, aunque no se lo pidan.
 *   (3) LA ETIQUETA DE LOS DÍAS — «días sin rotar» no existe en este dato: hay días de INVENTARIO y días SIN
 *       VENTA, y son campos distintos.
 *
 * POR QUÉ UN GATE Y NO SOLO LA CALIBRACIÓN: la calibración mide contra lo YA ESCRITO (¿cuántos falsos positivos
 *产 sobre textos buenos?). Este gate fija lo que tiene que pasar SIEMPRE, en las dos direcciones — el defecto
 * muere y su versión CORRECTA vive. Sin la segunda mitad, un chequeo que vetara todo pasaría igual de verde.
 *
 * OFFLINE · CERO GASTO: solo el muro y la carpeta. No lee `.env`, no importa el gateway ni un adapter.
 */
import { guardC } from "./src/adi/oracle/guardC.js";
import { cifrasDelDato } from "./src/adi/oracle/datoProyectado.js";
import { axisEntityNames } from "./src/adi/oracle/entityIndex.js";
import { ESCENARIO_INICIAL } from "./src/config/scenarios.js";
import { initTenant } from "./src/data/tenantStore.js";
import { TENANT_DEMO } from "./src/data/tenants/demo.js";
import { DOCTRINA_NOTARIO_NATURAL } from "./src/adi/oracle/naturalPrompt.js";
// el bloque 10 comprueba el CABLEADO de la escalera contra el código, no solo su salida
import fs from "node:fs";
import path from "path";
import { fileURLToPath } from "url";
const root = path.dirname(fileURLToPath(import.meta.url));
initTenant(TENANT_DEMO);

let pass = 0, fail = 0;
const ok = (cond, label, detalle) => {
  if (cond) { pass++; console.log(`  ✓ ${label}`); }
  else { fail++; console.log(`  ✗ FALLO: ${label}${detalle !== undefined ? ` — ${detalle}` : ""}`); }
};
const ejes = (a) => a.flatMap((e) => { try { return axisEntityNames(e); } catch { return []; } });
const CTX = {
  ledger: { figs: [] }, results: [], trace: null,
  datoProyectado: cifrasDelDato(ESCENARIO_INICIAL),
  entidadesDelTenant: ejes(["cliente", "sku", "marca"]),
  duenosDelTenant: ejes(["cliente", "sku", "marca", "familia", "bodega", "canal"]),
  contentScope: "full", tablePolicy: "auto",
};
const vetos = (texto) => (guardC(texto, CTX).violations || []).map((v) => v.kind);
const muere = (texto, kind, label) => {
  const vs = vetos(texto);
  ok(vs.includes(kind), label, `vetos obtenidos: ${vs.join(", ") || "(ninguno)"}`);
};
const vive = (texto, kind, label) => {
  const vs = vetos(texto);
  ok(!vs.includes(kind), label, `vetó «${kind}» sobre un texto correcto — falso positivo`);
};

console.log("═".repeat(100));
console.log("1 · SUPERLATIVOS · el caso control del owner, y su versión verdadera");
console.log("═".repeat(100));
// EL CASO CONTROL, TEXTUAL DEL OWNER. Es el defecto que salió DOS VECES a pantalla en el Examen 4, verde.
muere("Falabella tiene el peor margen de los tres grandes: 22.0%, contra 21.5% de Lider y 24.0% de Jumbo.",
  "superlativo-no-sostenido", "«Falabella tiene el peor margen de los tres grandes» MUERE (Lider está en 21.5%)");
// …y la MISMA frase, dicha bien, tiene que vivir: si no, el chequeo no distingue, solo prohíbe.
vive("Lider tiene el peor margen de los tres grandes: 21.5%, contra 22.0% de Falabella y 24.0% de Jumbo.",
  "superlativo-no-sostenido", "…y la versión VERDADERA (Lider) pasa: el chequeo distingue, no prohíbe");
// el sujeto puede venir de la oración anterior (así apareció el defecto real en el Examen 4, turno 2)
muere("El margen de Falabella es 22.0%. Es, de hecho, el margen más bajo entre los tres grandes: Lider está en 21.5% y Jumbo en 24.0%.",
  "superlativo-no-sostenido", "el sujeto heredado de la oración anterior también se verifica");
// la polaridad depende de la MÉTRICA: la peor carga comercial es la más ALTA, no la más baja
muere("Jumbo tiene la peor carga comercial de la cartera: 3.8%.", "superlativo-no-sostenido",
  "«la peor carga comercial» se resuelve como la MÁS ALTA (Easy 5.5%), no como la más baja");
vive("Easy tiene la peor carga comercial de la cartera: 5.5%.", "superlativo-no-sostenido",
  "…y quien de verdad tiene la carga más alta pasa");
// un superlativo verdadero sobre el eje entero
vive("Falabella es el cliente de mayor venta de toda la cartera: $19.4M.", "superlativo-no-sostenido",
  "«el de mayor venta de toda la cartera» es cierto y pasa");

/* ── EL SUJETO DETRÁS DEL VERBO · los dos falsos positivos del EXAMEN 5, turno 5 ──────────────────────────────
 * Costaron 3 llamadas y mandaron al suplente una respuesta que era CORRECTA. El notario leía «el que más X tiene
 * es <ENTIDAD>» y le atribuía el extremo a la entidad de la frase ANTERIOR, en vez de a la que nombra el verbo.
 * Los textos son los borradores REALES del examen, no una versión limpia. */
vive("El que más capital inmovilizado tiene entre los tres frenados es **LG-DRYER8KG**: $14K de capital.",
  "superlativo-no-sostenido", "«el que más X tiene ES <entidad>»: el sujeto va DETRÁS del verbo, y en negrita");
vive("El peor caso es MAK-COMP-AIR: 190 dias, pero solo $8K. El que mas capital inmovilizado tiene entre los tres frenados es **LG-DRYER8KG**: $14K.",
  "superlativo-no-sostenido", "…y no se le cobra a la entidad de la oración anterior");
vive("El más grave en severidad es MAK-COMP-AIR (190 días de inventario, $8K); el que más capital libera si se actúa es **LG-DRYER8KG** ($14K, 165 días de inventario).",
  "superlativo-no-sostenido", "…ni a la de la cláusula anterior: dos cláusulas en una oración siguen siendo dos sujetos");
// y el chequeo SIGUE distinguiendo: la misma forma con la entidad equivocada muere
muere("Entre LG-DRYER8KG y MAK-COMP-AIR, el que más capital inmovilizado tiene es **MAK-COMP-AIR**.",
  "superlativo-no-sostenido", "la MISMA forma con el nombre equivocado muere (LG-DRYER8KG tiene $13.6K contra $8.4K)");
/* ── «DE INVENTARIO» ES UNA MÉTRICA, «DEL INVENTARIO» ES UN UNIVERSO (mismo turno, intento 1) ─────────────────
 * «190 DÍAS DE INVENTARIO» abría la comparación a los 13 SKU enteros, así que un extremo verdadero dentro de su
 * grupo moría contra un tercero que la oración jamás nombró. */
vive("LG-DRYER8KG tiene 165 días de inventario y es el que más capital inmovilizado tiene de los tres frenados: $14K.",
  "superlativo-no-sostenido", "«días de inventario» NO declara el universo: es la etiqueta de la métrica");
muere("LG-DRYER8KG es el de peor rotación del inventario: 1.0x.",
  "superlativo-no-sostenido", "…y «DEL inventario» sí lo declara: se compara contra los 13 (MAK-COMP-AIR está en 0.8x)");

console.log("\n" + "═".repeat(100));
console.log("2 · SUPERLATIVOS · las formas que PARECEN un extremo y no lo son (los falsos positivos medidos)");
console.log("═".repeat(100));
/* Los cuatro salieron de la calibración contra los borradores guardados, ANTES de gastar una corrida. Cada uno
 * es un texto que ya había salido a pantalla y que una versión anterior del chequeo mataba sin razón. */
vive("Falabella y Lider, los dos mayores, tienen los márgenes más bajos de la cartera.", "superlativo-no-sostenido",
  "PLURAL · «los dos mayores» describe un grupo, no le atribuye el extremo a nadie");
vive("Lider tiene $17.8M de venta y la segunda peor carga comercial sobre meta.", "superlativo-no-sostenido",
  "ORDINAL · «la segunda peor» reclama el puesto 2, no el extremo");
vive("Con 8.1pp de brecha, Falabella es donde una mejora de carga comercial produce el mayor efecto en dólares.",
  "superlativo-no-sostenido", "MÉTRICA SUELTA · «el mayor efecto» no es un superlativo de la carga, aunque la nombre cerca");
vive("El máximo aplicable en ese caso es 1.8%.", "superlativo-no-sostenido",
  "«el máximo aplicable» no clasifica entidades: sin métrica pegada no hay orden que verificar");

console.log("\n" + "═".repeat(100));
console.log("3 · JUICIO ASESOR vs HECHO · se exige al recomendar, y solo al recomendar");
console.log("═".repeat(100));
muere("**Acción:** bajar la carga comercial de Falabella de 4.5% a 3.5% antes del próximo ciclo.",
  "juicio-sin-marcar", "una acción sin marcar el criterio MUERE");
vive("**Acción:** bajar la carga comercial de Falabella de 4.5% a 3.5%. Dato duro: son $194K. Criterio mío: arrancaría por ahí, no es una cifra del dato.",
  "juicio-sin-marcar", "…y la MISMA acción con «Dato duro» / «Criterio mío» pasa");
vive("El margen de Falabella es 22.0% y su carga comercial 4.5%, sobre la meta de 3.5%.",
  "juicio-sin-marcar", "una lectura que no recomienda nada no tiene criterio que separar");
muere("Prioridad 1 — Falabella y Lider. Son los dos de mayor venta y mayor brecha combinadas.",
  "juicio-sin-marcar", "una PRIORIZACIÓN también es criterio: «Prioridad 1 — …» sin marcar muere");

console.log("\n" + "═".repeat(100));
console.log("4 · LA ETIQUETA DE LOS DÍAS · dos campos, y «días sin rotar» no es ninguno");
console.log("═".repeat(100));
muere("Están frenados por rotación bajo 2.0x o más de 120 días sin rotar, en 3 SKU.", "dias-etiqueta-incorrecta",
  "«120 días sin rotar» MUERE — el techo se mide contra días de INVENTARIO (defecto real del Examen 4, turno 5)");
vive("Están frenados por rotación bajo 2.0x o más de 120 días de inventario, en 3 SKU.", "dias-etiqueta-incorrecta",
  "…y dicho con el nombre del campo, pasa");
muere("MAK-COMP-AIR lleva 190 días sin venta.", "dias-etiqueta-incorrecta",
  "190d es su DÍAS DE INVENTARIO, no sus días sin venta (esos son 112d)");
vive("MAK-COMP-AIR lleva 112 días sin venta.", "dias-etiqueta-incorrecta", "…y con el número correcto, pasa");
muere("SAM-REF500L lleva 17 días sin venta.", "dias-etiqueta-incorrecta",
  "un SKU CON VENTA AL DÍA no tiene días sin venta");

console.log("\n" + "═".repeat(100));
console.log("5 · EL CONTRATO LLEGA AL CEREBRO · un chequeo que el prompt no enseña es una trampa");
console.log("═".repeat(100));
/* Los tres se pueden cumplir solo si el modelo sabe que existen. Si alguien saca la regla del prompt, el muro
 * seguiría vetando y cada turno caería al suplente sin que nadie entienda por qué: por eso se fija acá. */
ok(/UN SUPERLATIVO ES UNA CLASIFICACI[ÓO]N/.test(DOCTRINA_NOTARIO_NATURAL), "la doctrina le enseña la regla de los superlativos");
ok(/SEPARA EL DATO DURO DE TU CRITERIO/.test(DOCTRINA_NOTARIO_NATURAL), "…la de separar dato duro de criterio");
ok(/LOS DOS CAMPOS DE D[ÍI]AS NO SON EL MISMO/.test(DOCTRINA_NOTARIO_NATURAL), "…y la de los dos campos de días");


console.log("\n" + "═".repeat(100));
console.log("6 · LOS DOS HUECOS DE LA CORRIDA DE ADOPCIÓN (owner 2026-08-16)");
console.log("═".repeat(100));
/* Los dos salieron MEDIDOS de la corrida de adopción, no de una sospecha: dos turnos recomendaron bajo
 * «Qué hacer primero:» y pasaron verdes, y los superlativos del eje SKU salieron bien por mérito del cerebro
 * —el muro no tenía contra qué medirlos—. */
for (const [t, nota] of [
  ["**Qué hacer primero:** bajar la carga comercial de Falabella a 3.5%.", "el encabezado exacto que se escapaba"],
  ["Qué  hacer  primero : revisar el costo de Lider.", "…con espacios de más, igual"],
  ["**Siguiente paso:** liquidar MAK-COMP-AIR.", "siguiente paso"],
  ["SIGUIENTES PASOS: revisar la reposición.", "…en mayúsculas y plural"],
  ["**Recomendación:** llevar la carga de Sodimac a la meta.", "recomendación"],
  ["Acción sugerida: liquidar el stock de LG-DRYER8KG.", "acción sugerida"],
]) muere(t, "juicio-sin-marcar", `[${nota}] «${t.slice(0, 46)}…» exige la marca`);
vive("**Qué hacer primero:** bajar la carga de Falabella a 3.5%. Dato duro: son $194K. Criterio mío: arrancaría por ahí.",
  "juicio-sin-marcar", "…y la MISMA recomendación, marcada, pasa — el chequeo pide separar, no prohíbe recomendar");
vive("La carga comercial es la TASA (%); las **acciones comerciales** son el mismo hecho medido en dinero.",
  "juicio-sin-marcar", "una DEFINICIÓN con la palabra en negrita no es un bloque de acción");

console.log("\n" + "═".repeat(100));
console.log("7 · SUPERLATIVOS DEL EJE SKU · con su ranking declarado, en las dos direcciones");
console.log("═".repeat(100));
for (const [esperado, t, nota] of [
  ["muere", "LG-DRYER8KG es el SKU de peor rotación del inventario: 1.0x.", "MAK-COMP-AIR rota 0.8x"],
  ["vive", "MAK-COMP-AIR es el SKU de peor rotación del inventario: 0.8x.", "es cierto"],
  ["muere", "BOS-SANDER es el SKU con más días de inventario de todos: 115d.", "MAK-COMP-AIR tiene 190d"],
  ["vive", "MAK-COMP-AIR es el SKU con más días de inventario de todos: 190d.", "es cierto"],
  ["muere", "SAM-TV55 es el SKU con más días sin venta de todos: 12d.", "MAK-COMP-AIR lleva 112d"],
  ["vive", "MAK-COMP-AIR es el SKU con más días sin venta de todos: 112d.", "es cierto"],
  ["muere", "BOS-SANDER es el SKU con más capital inmovilizado del inventario: $11K.", "LG-DRYER8KG tiene $14K"],
  ["vive", "LG-DRYER8KG es el SKU con más capital inmovilizado del inventario: $14K.", "es cierto"],
  ["muere", "SAM-TV55 tiene el peor margen de inventario de todos: 19.0%.", "MAK-COMP-AIR está en 8.0%"],
  ["vive", "MAK-COMP-AIR tiene el peor margen de inventario de todos: 8.0%.", "es cierto"],
]) (esperado === "muere" ? muere : vive)(t, "superlativo-no-sostenido", `[SKU] «${t.slice(0, 52)}…» ${esperado === "muere" ? "MUERE" : "pasa"} — ${nota}`);
/* UN RANKING SIN LADO MALO NO RESUELVE «EL PEOR». Más capital no es peor capital: SAM-REF500L es el SKU de más
 * capital ($19K) y rota 9.8x. Por eso `capital` se declara con peorEs null y el capital con lado malo es otro
 * ranking, sobre otro universo: los SKU cuyo estado no es Activo. */
vive("SAM-REF500L es el SKU con mayor capital del inventario: $19K.", "superlativo-no-sostenido",
  "«el de mayor capital» es cierto y pasa");
vive("SAM-REF500L es el SKU con peor capital del inventario: $19K.", "superlativo-no-sostenido",
  "…y «el peor capital» no se juzga: ese ranking no tiene lado malo declarado");

console.log("\n" + "═".repeat(100));
console.log("8 · CADA RANKING SE DECLARA ENTERO · universo · dirección · empate · campo fuente");
console.log("═".repeat(100));
{
  const R = CTX.datoProyectado.rankings;
  ok(!!R.sku, "el eje SKU tiene rankings declarados (era el hueco: sus superlativos no se verificaban contra nada)");
  const esperados = ["capital", "capital_inmovilizado", "rotacion", "dias_inventario", "dias_sin_venta", "margen_inventario"];
  for (const k of esperados) ok(!!(R.sku && R.sku[k]), `sku · ${k} declarado`);
  let completos = 0, filas = 0;
  for (const [eje, ms] of Object.entries(R)) {
    for (const [k, d] of Object.entries(ms)) {
      const bien = typeof d.universo === "string" && d.universo.length > 8
        && (d.direccion === "mayor" || d.direccion === "menor")
        && (d.peorEs === "mayor" || d.peorEs === "menor" || d.peorEs === null)
        && typeof d.empate === "string" && d.empate.length > 20
        && typeof d.campo === "string" && d.campo.includes(".")
        && Array.isArray(d.terminos) && d.terminos.length
        && Array.isArray(d.filas);
      ok(bien, `${eje}·${k} declara universo · dirección · empate · campo fuente · términos`,
        JSON.stringify({ universo: d.universo, direccion: d.direccion, peorEs: d.peorEs, campo: d.campo }));
      if (bien) completos++;
      filas += d.filas.length;
    }
  }
  console.log(`  · ${completos} rankings declarados completos · ${filas} filas en total`);
  // NO HAY RANKING DE «COBERTURA», y es deliberado: CLAUDE.md §4 la resolvió POR ELIMINACIÓN (duplicado
  // redondeado de `doh`). Declararlo sería reponer el término que el owner sacó del producto.
  ok(!Object.values(R).some((ms) => Object.keys(ms).some((k) => /cobertura/i.test(k))),
    "…y NINGÚN ranking se llama «cobertura»: se dice días de inventario, y sale de `doh`");
}

console.log("\n" + "═".repeat(100));
console.log("9 · UN TOTAL DEL CONJUNTO SE DECLARA · el defecto que llegó a pantalla en producción");
console.log("═".repeat(100));
/* EL CASO REAL (reproducción del 2026-08-16 sobre v1.0, expediente `_repro_resumen_v10*.json`): el titular de
 * un resumen decía «Margen — brecha de $4.16M en la cartera». ADI sumó tres de los OCHO clientes bajo benchmark
 * que él mismo acababa de contar, no declaró la suma, y el muro la dejó pasar. La brecha real de la cartera es
 * $5.37M: el titular se comió $1.21M. */
muere("**1. Margen — brecha de $4.16M en la cartera**", "total-sin-declarar",
  "«brecha de $4.16M en la cartera» MUERE — es una suma propia, sin declarar, con alcance de conjunto");
vive("**1. Margen — brecha de $4.16M en la cartera**\n\n[[CALCULO]]\nid=c1 · op=sumar · inputs=$1.57M; $1.53M; $1.06M · formula=$1.57M + $1.53M + $1.06M · resultado=$4.16M · unidad=money · dueno=total",
  "total-sin-declarar", "…y la MISMA cifra declarada como cuenta, pasa: el chequeo pide declarar, no callar");
vive("Vendiste $99.9M en toda la cartera, con $25.0M de contribución.", "total-sin-declarar",
  "un total que SÍ es del conjunto en la carpeta pasa");
vive("Tu capital inmovilizado en la cartera es $56K en 5 SKU.", "total-sin-declarar",
  "…y un KPI del conjunto, también");
/* LOS TRES FALSOS POSITIVOS MEDIDOS mientras se calibraba este chequeo. Cada uno es texto que YA salió a
 * pantalla y que una versión anterior mataba: por eso el alcance se exige PEGADO y DETRÁS de la cifra. */
vive("Es el cliente de mayor venta de la cartera —$19.4M— y el peor margen entre los tres grandes.",
  "total-sin-declarar", "APOSICIÓN · «de la cartera» es el alcance del superlativo, no del monto de Falabella");
vive("| Falabella | $19.4M | 22.0% | -8.1pp | 4.5% | $1.57M |", "total-sin-declarar",
  "FILA DE TABLA · una celda no afirma ningún total");
vive("MAK-COMP-AIR generó $1.7M en ventas con $135K de contribución y 7.9% de margen — el margen de venta más bajo de toda la cartera.",
  "total-sin-declarar", "ALCANCE DEL SUPERLATIVO · el monto es del SKU, «de toda la cartera» califica al margen");
ok(/UN TOTAL DEL CONJUNTO ES UNA CUENTA/.test(DOCTRINA_NOTARIO_NATURAL), "…y la doctrina se lo enseña al cerebro");

console.log("\n" + "═".repeat(100));
console.log("10 · EL ESCALÓN QUE FALTABA EN LA ESCALERA DEL SUPLENTE (owner 2026-08-21)");
console.log("═".repeat(100));
/* EL DEFECTO, visto por el owner en producción: pidió «hazme un resumen ejecutivo de las dos cosas que te he
 * preguntado» después de DOS respuestas buenas, y el turno cayó al suplente — que le devolvió los KPIs
 * generales del negocio. Arriba, en la misma conversación, había dos lecturas ya aprobadas, y el respaldo las
 * tiró para empezar de cero desde la carpeta.
 * EL ESCALÓN ofrece lo que ESA conversación ya validó, y lo ofrece VERBATIM: un texto que el muro aprobó vuelve
 * a pasar por construcción, mientras que resumirlo sería reintentar justo lo que acaba de fallar. */
{
  const marco = (previa) => [
    "No pude armar la lectura nueva con la calidad que corresponde. Lo que ya te respondí sobre esto quedó verificado y sigue en pie:",
    "", previa.trim(), "",
    "Dime qué parte de esto necesitas y lo trabajo sobre esas mismas cifras.",
  ].join("\n");
  // una respuesta como las que ADI produce bajo las reglas vigentes
  const VIGENTE = "Tu capital inmovilizado es $56K en 5 SKU, y de ahí $33K están frenados en 3 SKU: rotación bajo el piso de 2.0x o días de inventario sobre el techo de 120d.\n\nLG-DRYER8KG concentra $14K con rotación 1.0x y 165 días de inventario. MAK-COMP-AIR suma $8K con rotación 0.8x y 190 días de inventario.";
  ok(guardC(VIGENTE, CTX).ok, "la respuesta anterior, sola, pasa el muro (es el punto de partida del escalón)");
  ok(guardC(marco(VIGENTE), CTX).ok,
    "…y envuelta en el marco del respaldo TAMBIÉN pasa: el escalón se puede ofrecer sin inventar nada");
  // el marco no agrega cifras: es lo que lo hace seguro por construcción
  const soloMarco = marco("").replace(/\n+/g, " ").trim();
  ok(!/\d/.test(soloMarco.replace(/1\.1|2\.0/g, "")), "el marco NO trae ni una cifra propia: todo lo que afirma es la respuesta vieja");
  // y si el texto viejo NO pasa el muro de hoy, el escalón cede — nunca fuerza una respuesta vetada a pantalla
  const VIEJA_CON_DEFECTO = "Están frenados por rotación bajo 2.0x o más de 120 días sin rotar, en 3 SKU.";
  ok(!guardC(marco(VIEJA_CON_DEFECTO), CTX).ok,
    "una respuesta vieja que hoy tendría un defecto NO se ofrece: el escalón cede al peldaño siguiente");
  // el cableado: el escalón va ANTES de la carpeta, no en vez de ella
  const cn = fs.readFileSync(path.join(root, "src", "adi", "oracle", "caminoNatural.js"), "utf8");
  ok(/_respaldoDeLoYaAprobado\(memIn, juzgar\) \|\| suplenteDignoDelDato\(/.test(cn),
    "en la escalera, el escalón nuevo va PRIMERO y la carpeta queda de respaldo — no se reemplaza nada");
  /* ⚠️ EL DEFECTO QUE EL EXAMEN 5 CAZÓ EN ESTE MISMO ESCALÓN, a los veinte minutos de escribirlo: leía
   * `recentNarrations`, donde también vive el RESPALDO del turno anterior. Resultado medido: el turno 2
   * devolvió el respaldo del turno 1 anidado dentro del suyo, y encima lo presentó como «quedó verificado».
   * Ahora lee `ultimaAprobada`, que el camino natural marca SOLO cuando el notario aprobó y NO fue respaldo. */
  ok(/memIn.ultimaAprobada/.test(cn), "el escalón lee la última APROBADA, no la última MOSTRADA");
  ok(!/memIn.recentNarrations/.test(cn.slice(cn.indexOf("_respaldoDeLoYaAprobado"), cn.indexOf("export async function"))),
    "…y ya no mira `recentNarrations`: ahí también vive el respaldo, y ofrecerlo como verificado sería mentir");
  ok(cn.includes("res.aprobado && !suplenteDigno) memOut.ultimaAprobada"),
    "y `ultimaAprobada` se marca SOLO si el muro aprobó y el turno no fue respaldo");
  ok(/juzgar\(candidato\)/.test(cn), "…y el escalón se JUZGA como cualquier otro peldaño, sin relajar el muro");
}
console.log(`\n── _examen4_cierres_gate: ${pass} PASS · ${fail} FAIL (de ${pass + fail}) ──`);
process.exit(fail === 0 ? 0 : 1);
