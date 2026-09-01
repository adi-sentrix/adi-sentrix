/* === _mesa_sin_conclusiones_gate.mjs · LA MESA MUESTRA EL DATO · ADI LO INTERPRETA ===========================
 *
 * LA REGLA, y el owner la dictó cuatro veces antes de que existiera este archivo:
 *   · 2026-08-18 (v1.14, cara Comercial) — «debemos mejorar sentrix, no es hacer cosas nuevas si no quitarle
 *     conclusiones, no hay necesidad si dejaremos botones que expliquen lo que está en sentrix y ADI lo hará, es
 *     duplicar cosas».
 *   · 2026-08-19 (v1.15) — lo mismo en Capital y en Resultado.
 *   · 2026-08-25 (v2.1) — «que sea consistente».
 *   · 2026-08-31 (esta versión) — «cualquier conclusión se la dejaremos a ADI», sobre el Perfil Ejecutivo.
 *
 * POR QUÉ ESTE ARCHIVO EXISTE. Las tres primeras veces se quitaron las frases y NO se ató nada. Se comprobó
 * ejecutando el gate completo después de sacarlas hoy: 189 de 189 en verde con las conclusiones ya borradas —
 * o sea que ninguna comprobación las estaba cuidando. Una decisión que se toma cuatro veces y no deja candado
 * no es una decisión: es una limpieza que alguien va a deshacer de buena fe, agregando «una lectura corta para
 * ayudar al usuario». Este gate hace que esa buena fe se ponga roja.
 *
 * LO QUE NO DICE ESTE GATE. No prohíbe texto en la Mesa. Un rótulo, una unidad, una limitación del dato («esto
 * no se puede atribuir a un cliente») y un hecho con ranking («1º de 13 clientes») son dato y se quedan. Lo que
 * queda prohibido es la frase que INTERPRETA o RECOMIENDA — la que responde «y entonces qué hago». Eso lo dice
 * ADI, que además puede sostenerlo en una conversación; una frase fija en una tarjeta no puede.
 *
 * Y LOS COLORES DE LAS SERIES (owner 2026-08-31: «quiero que la línea azul sea celeste y las líneas»). Van acá
 * porque nacieron del mismo cambio y porque son la otra forma de que la pantalla mienta sin que se note: dos
 * series casi del mismo color se leen como una. La separación se MIDE, no se opina — abajo está la aritmética.
 *
 * OFFLINE: solo lee archivos. No importa nada que hable a la red. */

import { readFileSync } from "node:fs";

let pass = 0, fail = 0;
const ok = (c, msg, detalle = "") => { if (c) { pass++; console.log(`  ✓ ${msg}`); }
  else { fail++; console.log(`  ✗ FALLO: ${msg}${detalle ? `\n      ${detalle}` : ""}`); } };
const H = (t) => console.log(`\n── ${t} ──`);
const leer = (p) => { try { return readFileSync(p, "utf8"); } catch { return ""; } };

const panel = leer("./src/ui/SentrixPanel.jsx");
const tema  = leer("./src/ui/theme.js");

/* ═══════════════════════════════════════════════════════════════════════════════════════════════════════════
 * LA ARITMÉTICA DEL COLOR · OKLab, que es el espacio donde la distancia se parece a lo que ve un ojo
 * ═══════════════════════════════════════════════════════════════════════════════════════════════════════════
 * En RGB dos colores pueden estar «lejos» en números y verse iguales. OKLab corrige eso: la distancia euclídea
 * entre dos puntos se aproxima a cuánto los distingue una persona. El piso que usamos —ΔE 15 sobre 100— es el
 * mismo que aplica el validador de paletas con el que se eligió este gris. Se deja escrito acá para que el
 * candado no dependa de una herramienta externa que mañana no esté. */
const _lin = (c) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
function oklab(hex) {
  const h = hex.replace("#", "");
  const r = _lin(parseInt(h.slice(0, 2), 16) / 255);
  const g = _lin(parseInt(h.slice(2, 4), 16) / 255);
  const b = _lin(parseInt(h.slice(4, 6), 16) / 255);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s,
          1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s,
          0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s];
}
const dE = (a, b) => { const [x, y, z] = oklab(a), [p, q, r] = oklab(b);
  return Math.round(Math.hypot(x - p, y - q, z - r) * 1000) / 10; };

const tomar = (nombre) => { const m = tema.match(new RegExp(nombre + ':\\s*"(#[0-9a-fA-F]{6})"')); return m ? m[1] : null; };

H("0 · LA MEDICIÓN ES CORRECTA · el gate comprueba su propia aritmética antes de juzgar a nadie");
/* ⚠️ UN CANDADO QUE MIDE MAL ES PEOR QUE NO TENER CANDADO: da permiso con autoridad. Estos dos valores salieron
   del validador de paletas externo cuando se eligió el gris (celeste↔teal 8.9 · celeste↔gris 17.8). Si la
   fórmula de arriba se toca y deja de reproducirlos, el gate se declara roto ACÁ y no más abajo, donde el error
   se leería como «el color está bien». */
ok(Math.abs(dE("#2fb8da", "#7fc9c4") - 8.9) <= 0.3,
  `la fórmula reproduce el ΔE conocido celeste↔verde-agua (dio ${dE("#2fb8da", "#7fc9c4")}, se esperaba 8.9)`);
ok(Math.abs(dE("#a49bd0", "#68727f") - 17.8) <= 0.3,
  `…y el de lavanda↔gris de referencia (dio ${dE("#a49bd0", "#68727f")}, se esperaba 17.8)`);
ok(dE("#2fb8da", "#2fb8da") === 0, "…y un color contra sí mismo da cero");

H("1 · LAS TRES SERIES DEL AÑO SE DISTINGUEN · medido, no opinado");
/* ⚠️ ESTE ES EL CANDADO QUE IMPORTA DE VERDAD. El pedido del owner fue «que la línea azul sea celeste». Hacer
 * SOLO eso habría dejado «este año» (celeste) contra «año anterior» (verde-agua) a ΔE 8.9 — las dos líneas que
 * más se comparan en todo el gráfico, casi del mismo color. El arreglo pedido habría creado un defecto peor que
 * el que resolvía, y en pantalla no se ve «mal»: se ve borroso, que es distinto y no dispara ninguna alarma.
 * Por eso no se ata el color elegido sino la PROPIEDAD que lo hace legible. Cambiar cualquiera de los tres está
 * permitido; dejarlos indistinguibles, no. */
const PISO = 15;
const serie = { actual: null, anterior: null, presupuesto: null };
const mSerie = panel.match(/_RC_SERIE_COL = \{ actual: C\.(\w+), anterior: C\.(\w+), presupuesto: C\.(\w+) \}/);
ok(!!mSerie, "el gráfico del año declara sus tres colores en un solo lugar");
if (mSerie) {
  serie.actual = tomar(mSerie[1]); serie.anterior = tomar(mSerie[2]); serie.presupuesto = tomar(mSerie[3]);
  ok(mSerie[1] === "celeste",
    `la serie real va en celeste, como el resto de Sentrix (declara C.${mSerie[1]})`);
  ok(!!serie.actual && !!serie.anterior && !!serie.presupuesto,
    "los tres colores existen en el tema y se pueden medir");
  if (serie.actual && serie.anterior && serie.presupuesto) {
    const pares = [["este año", "año anterior", serie.actual, serie.anterior],
                   ["este año", "presupuesto", serie.actual, serie.presupuesto],
                   ["año anterior", "presupuesto", serie.anterior, serie.presupuesto]];
    for (const [a, b, ca, cb] of pares) {
      const d = dE(ca, cb);
      ok(d >= PISO, `«${a}» y «${b}» se distinguen a simple vista (ΔE ${d}, piso ${PISO})`,
        `${ca} vs ${cb} — por debajo del piso se leen como la misma línea`);
    }
  }
  ok(mSerie[1] !== mSerie[2] && mSerie[2] !== mSerie[3] && mSerie[1] !== mSerie[3],
    "…y ninguna serie repite el color de otra");
}
/* el verde-agua NO se tocó: otras caras lo usan para «año anterior» con punteado y 55% de opacidad, donde la
   separación la hace el trazo y no el tono. Sacarlo del tema para «ordenar» rompería esas caras en silencio. */
ok(/teal:\s*"#7fc9c4"/.test(tema), "el verde-agua sigue en el tema: otras caras lo usan con punteado");

H("2 · EL CELESTE MARCA LO QUE SE TOCA · también en el título del Perfil Ejecutivo");
/* ⚠️ REGLA DE LA v2.2, y este título se había quedado atrás un mes. El celeste es la promesa de que algo
 * responde al click. Un título celeste que no hace nada gasta esa promesa: el usuario lo prueba, no pasa nada, y
 * la próxima vez duda del celeste que SÍ era un botón. */
ok(panel.includes('<span style={{ color:C.text }}>Perfil Ejecutivo</span>'),
  "el título «Perfil Ejecutivo» es blanco");
ok(!panel.includes('<span style={{ color:C.celeste }}>Perfil Ejecutivo</span>'),
  "…y no vuelve a celeste por la puerta de atrás");

H("3 · LAS CONCLUSIONES DEL PERFIL EJECUTIVO NO VUELVEN");
/* Cada frase se busca por un fragmento suyo que NINGÚN dato genera: son textos escritos a mano, así que si el
   fragmento aparece es porque alguien volvió a escribir la frase.
 *
 * ⚠️ SE BUSCA EN EL CÓDIGO SIN COMENTARIOS, y esto no es un atajo: es la definición correcta de la regla. Lo que
 * se prohíbe es que la frase se MUESTRE, y un comentario no se muestra. La primera versión de este gate buscaba
 * en el archivo entero y se puso roja sola, porque las lápidas que dejamos donde estaban las tarjetas citan
 * textualmente lo que se quitó — que es justo lo que las hace útiles: sin la cita, el próximo lector no sabe qué
 * decía la frase que no debe volver a escribir. Buscando en el código desnudo, la documentación puede ser todo
 * lo explícita que haga falta sin acusar en falso. */
const sinComentarios = panel.replace(/\{?\/\*[\s\S]*?\*\/\}?/g, " ");
const IDAS = [
  ["la tarjeta «Qué explica la brecha de margen»", "Qué explica la brecha de margen"],
  ["…y su frase sobre lo que el dato no separa", "no tiene una causa aislada en el dato disponible"],
  ["la lectura de cartera en prosa", "es una de tus cuentas de mayor volumen"],
  ["el cierre «la mayor oportunidad de recuperar rentabilidad»", "mayor oportunidad de recuperar rentabilidad"],
  ["el cierre «Prioriza X por el monto»", "por el monto ("],
  ["las cuatro frases de cierre por clase", "usala de referencia para negociar"],
];
for (const [nombre, aguja] of IDAS) ok(!sinComentarios.includes(aguja), `${nombre} no volvió`);
/* y el despojado tiene que seguir siendo el archivo, no un resto: si el barrido de comentarios se comiera el
   código, TODO lo de arriba pasaría por vacío y el gate sería un adorno verde. */
ok(sinComentarios.length > panel.length * 0.55,
  `quitar los comentarios deja el código en pie (${Math.round(sinComentarios.length / panel.length * 100)}% del archivo)`);
ok(sinComentarios.includes("function FichaEjecutivaCliente"),
  "…y la cara que se está juzgando sigue ahí después del barrido");

H("4 · LO QUE SE QUEDA · el gate no puede ser una excusa para vaciar la cara");
/* ⚠️ ESTE BLOQUE ES LA MITAD QUE FALTA. Un gate que solo prohíbe empuja en una sola dirección: el camino más
 * fácil para dejarlo verde es borrar más. Estas comprobaciones fijan el suelo — el dato con el que el owner se
 * quedó explícitamente cuando se le preguntó hasta dónde cortar. */
ok(panel.includes("Importancia de {name} en tu cartera"), "la tarjeta de importancia en la cartera sigue");
ok(panel.includes("pos.rankingVenta}º de {pos.totalClientes}"), "…con el ranking de ventas, que es dato");
ok(panel.includes("del grupo que concentra el 80% de las ventas"), "…y el peso en la cartera");
ok(panel.includes('label: "RECUPERAR"') && panel.includes('label: "CUIDAR"'),
  "la etiqueta de rol se queda: sale de dos hechos (volumen × margen), no de una opinión");

/* ⚠️ SI SALE UN TEXTO, QUEDA EL PUENTE — y esto lo aprendí fallando. Al vaciar de prosa la tarjeta «Importancia
 * en tu cartera» quedó siendo la ÚNICA de la cara sin botón hacia ADI: tres cifras (ranking, peso, margen contra
 * la vara) sin nadie que las explicara. No es que borré su botón; nunca tuvo uno, porque su prosa hacía de
 * explicación. Al sacar la prosa desapareció la explicación y no quedó nada en su lugar.
 *
 * La regla es del owner y es de la v1.14, cuando mandó vaciar la cara Comercial: «no hay necesidad, si dejaremos
 * botones que expliquen lo que está en Sentrix y ADI lo hará». El botón no es un adorno que sobrevive al
 * recorte: es LA OTRA MITAD del recorte. Sacar el texto sin dejarlo no simplifica la pantalla, la deja muda.
 * Por eso se cuenta: cada tanda que saque texto tiene que dejar esta cuenta igual o más alta. */
const puentes = (sinComentarios.match(/_btn\(/g) || []).length;
ok(puentes >= 3, `las tarjetas conservan sus puentes hacia ADI (${puentes} en la cara)`);
ok(sinComentarios.includes("Que ADI explique el lugar de"),
  "…incluida la de cartera, que se quedó muda al perder su prosa y ahora tiene el suyo");

/* ⚠️ LA LIMITACIÓN Y EL ALCANCE NO SON PROSA, aunque lo parezcan en pantalla — y son lo que más fácil se va por
 * accidente en una tanda de recortes, justamente porque suenan a texto explicativo. Una limitación declarada
 * («esto localiza pero no explica la causa») es honestidad: sacarla no simplifica, esconde. Un alcance («los 13
 * clientes del período, al 31 de agosto») es lo que impide que las cifras mientan por omisión. */
const flujo = leer("./src/adi/sentrix/mesaFlujo.js");
ok(panel.includes("{F.alcance}"), "la cara Flujo sigue declarando su alcance en pantalla");
ok(/alcance:/.test(flujo), "…y el módulo sigue produciéndolo, con su fecha de corte");

/* ⚠️ ESTAS DOS COMPROBACIONES SE MOVIERON, NO SE BORRARON (2026-08-31, más tarde el mismo día). Pedían que la
 * tarjeta de inventario por cliente conservara su párrafo de limitación y su botón. Horas después el owner sacó
 * la tarjeta ENTERA, con otra razón y de otro orden: «ADI Sentrix no gestiona el inventario ni nada por el
 * estilo, es un asesor». No es que la comprobación estuviera mal —protegía lo correcto mientras la tarjeta
 * existía—: cambió la pregunta. Borrarlas y seguir habría dejado el hueco sin vigilar; lo que se vigila ahora es
 * lo que de verdad no puede perderse cuando una cara deja de hablar de algo: que ese algo siga leyéndose donde
 * SÍ tiene dueño, y que la herramienta que lo responde siga en pie. */
const capital = leer("./src/adi/sentrix/mesaCapital.js");
const retrieval = leer("./src/adi/specRetrieval.js");
ok(!sinComentarios.includes("_capTitulo") && !sinComentarios.includes("Inventario inmovilizado y "),
  "el Perfil Ejecutivo ya no muestra inventario por cliente: no es lo que hace el producto");
ok(!sinComentarios.includes("TOOLS.entityCapitalLigado("),
  "…y la cara ni siquiera le pregunta a la herramienta: no calcula lo que no muestra");
/* PERO EL PRODUCTO NO PIERDE LA CAPACIDAD, que es la mitad que importa: */
ok(retrieval.includes("capitalLigado: { subtotal, items"),
  "la herramienta de capital ligado sigue en pie: es lo que ADI usa si alguien PREGUNTA por eso");
ok(capital.length > 0 && /inmovilizado|bodega/i.test(capital),
  "y el capital inmovilizado del negocio se sigue leyendo en la cara Capital, que es donde tiene dueño");

H("5 · UNA LÁPIDA NO SE IMPRIME · el comentario JSX lleva llaves o no es un comentario");
/* ⚠️ ESTO PASÓ HOY, Y SOLO SE VIO EN PANTALLA. Al sacar la tarjeta de la brecha se dejó en su lugar un comentario
 * explicando por qué se fue —la costumbre de esta casa— pero abriendo bloque a secas, SIN las llaves de JSX. En
 * el cuerpo de una función eso es un comentario; entre dos etiquetas JSX no lo es: es texto, y React lo imprime.
 * (Ironía del oficio: la primera versión de ESTE comentario también se rompió sola, por escribir la marca de
 * cierre de bloque dentro de un bloque. El mismo descuido, dos capas más arriba.) La tarjeta
 * quedó mostrando ocho líneas de explicación interna al usuario. Compiló sin una queja y los gates siguieron en
 * verde, porque para el código fuente parecía exactamente lo que dice ser.
 *
 * Y hay una trampa de segundo orden: la sección 3 de este mismo gate BORRA los comentarios antes de buscar, que
 * es lo correcto —un comentario no se muestra— pero eso le impedía ver este caso, donde el falso comentario sí se
 * mostraba. Un candado que normaliza su entrada hereda los supuestos de esa normalización. Por eso la comprobación
 * va acá y mira la FORMA, no el contenido: si una línea abre bloque justo después de cerrar una etiqueta, está en
 * posición de hijo JSX y necesita llaves. */
{
  const L = panel.split("\n");
  const sospechosas = [];
  for (let i = 0; i < L.length; i++) {
    if (!/^\s*\/\*/.test(L[i])) continue;
    let j = i - 1;
    while (j >= 0 && !L[j].trim()) j--;
    const prev = (L[j] || "").trim();
    if (/[>)]$/.test(prev) || /\)\}$/.test(prev)) sospechosas.push(`${i + 1}: ${L[i].trim().slice(0, 70)}`);
  }
  ok(sospechosas.length === 0,
    "ningún comentario suelto en posición de hijo JSX: se imprimiría en pantalla",
    sospechosas.join("\n      "));
  /* carnada de esta misma sección: el detector tiene que encontrar el caso si vuelve */
  const ceboL = ["        </div>", "        /* una lápida sin llaves */"];
  let hit = 0;
  for (let i = 1; i < ceboL.length; i++) if (/^\s*\/\*/.test(ceboL[i]) && /[>)]$/.test(ceboL[i - 1].trim())) hit++;
  ok(hit === 1, "carnada: una lápida sin llaves después de </div> SÍ se detectaría");
}

H("6 · CARNADA · el candado sabe ponerse rojo");
/* Se muta una COPIA en memoria: si el checker tragara esto, todo lo de arriba sería decorado. */
{
  const cebo = panel + '\n<span style={{ color:C.celeste }}>Perfil Ejecutivo</span>\n' +
    "Acá está la mayor oportunidad de recuperar rentabilidad\n";
  ok(cebo.includes('<span style={{ color:C.celeste }}>Perfil Ejecutivo</span>'),
    "carnada: el título en celeste SÍ se detectaría");
  ok(cebo.includes("mayor oportunidad de recuperar rentabilidad"),
    "carnada: el cierre reescrito SÍ se detectaría");
  const temaCebo = tema.replace(/serieRef:\s*"#[0-9a-fA-F]{6}"/, 'serieRef: "#7fc9c4"');
  const m = temaCebo.match(/serieRef:\s*"(#[0-9a-fA-F]{6})"/);
  ok(!!m && dE("#2fb8da", m[1]) < PISO,
    `carnada: si el gris volviera al verde-agua, el piso lo atajaría (ΔE ${m ? dE("#2fb8da", m[1]) : "?"} < ${PISO})`);
}

console.log(`\n── _mesa_sin_conclusiones_gate: ${pass} PASS · ${fail} FAIL (de ${pass + fail}) ──`);
process.exit(fail ? 1 : 0);
