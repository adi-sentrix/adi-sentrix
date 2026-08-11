/* === _extremo_y_total_sin_falsos_positivos_gate.mjs · GATE PERMANENTE ==========================================
 * owner 2026-08-11 (segunda pasada) — el chequeo «la respuesta se juzga como SISTEMA» (guardC 23/24) BLOQUEABA
 * RESPUESTAS CORRECTAS. Un revisor adversarial midió cuatro falsos positivos y un interruptor global; este gate
 * los fija para siempre y, sobre todo, fija LA CARA QUE IMPORTA: la batería de respuestas CORRECTAS que NO se
 * pueden bloquear.
 *
 * LA DOCTRINA QUE ESTE GATE HACE EJECUTABLE: «falso negativo antes que falso positivo». Un guard que bloquea una
 * respuesta correcta hace MÁS daño que la conducta que vino a arreglar, porque rompe turnos que hoy funcionan —
 * en este repo un `ok:false` quema los 3 intentos del narrador y cae a `composeFromLedger` (la tabla pelada).
 * Por eso cada sección trae su mitad POSITIVA, y la sección 2 es entera de respuestas correctas.
 *
 * LO QUE AFIRMA, en cinco frases:
 *   1. «mejor»/«peor» NO son «más alto»/«más bajo»: son palabras de JUICIO y no significan nada sin la dirección
 *      de la métrica. En días de inventario, capital inmovilizado, % en alerta, brecha, costo y quiebres, la mejor
 *      es la MÁS BAJA. Si la dirección no se resuelve con certeza, NO se juzga.
 *   2. Una marca sin sustantivo, en una tabla con varias columnas numéricas, sólo se marca si TODAS las columnas
 *      donde la fila tiene cifra la contradicen: la corrección no puede depender del ORDEN DE COLUMNAS.
 *   3. Cada tabla se reconcilia contra SUS filas: dos tablas correctas en una respuesta no fabrican una violación.
 *   4. En prosa compiten las cifras de la MISMA MÉTRICA, no las de la misma unidad, y sólo las que pertenecen a
 *      una entidad del turno: una vara/benchmark no le gana a nadie.
 *   5. La declaración de recorte vale para SU tabla, no apaga la reconciliación de la respuesta entera.
 *
 * Y la mitad de defecto, que sigue bloqueando: la marca escrita en la celda de la cifra, el superlativo partido en
 * dos oraciones, la lista con viñetas, y el Total de una columna de conteo que cubre más que lo mostrado.
 *
 * 100% DETERMINÍSTICO — sin LLM, sin red: se arma la boleta con `fig()` (el emisor real) y se llama a `guardC`.
 */
import { guardC } from "./src/adi/oracle/guardC.js";
import { fig, parseFigures } from "./src/adi/boleta.js";

let pass = 0, fail = 0;
const ok = (cond, label) => { console.log(`  ${cond ? "✓" : "✗"} ${label}`); if (cond) pass++; else fail++; };
const kinds = (g) => g.violations.map((v) => v.kind);
const tieneExtremo = (g) => kinds(g).includes("extremo-sin-sustento");
const tieneTotal = (g) => kinds(g).includes("total-no-reconcilia");

// autoriza TODAS las cifras del texto bajo un label dado: aísla los chequeos 23/24 de los viejos (nada puede
// rebotar por `cifra-no-autorizada`, así que un bloqueo acá sólo puede venir de lo que este gate afirma).
const ledgerDe = (texto, label) => ({ figs: parseFigures(texto).map((f) => fig(label, f.text, { unit: f.unit, raw: f.raw })) });
const corre = (texto, label, extra = {}) => guardC(texto, { ledger: ledgerDe(texto, label), results: [], question: "", ...extra });
// una tabla de 3 filas con la marca puesta en la fila `iMarcada` (0-based) de la columna de etiqueta
const tabla = (header, filas, iMarcada, marca) => [
  `| ${header.join(" | ")} |`,
  `|${header.map(() => "---").join("|")}|`,
  ...filas.map((f, i) => `| ${i === iMarcada ? `${f[0]} **${marca}**` : f[0]} | ${f.slice(1).join(" | ")} |`),
].join("\n");
// NO se compara contra ningún texto de la certificación: `marca` y `header` son parámetros, y las entidades de
// abajo (bodegas, familias, rutas) no son las del turno medido.

console.log("── 1 · LOS CUATRO FALSOS POSITIVOS MEDIDOS · cada uno bloqueaba una respuesta CORRECTA ──");
{
  console.log("\n  ▸ 1a · «la mejor» sobre una métrica donde MENOS ES MEJOR (días de inventario)");
  const t = tabla(["Bodega", "Días de inventario"], [["Valparaíso", "30d"], ["Antofagasta", "95d"], ["Concepción", "140d"]], 0, "← la mejor");
  const g = corre(t, "DOH · bodega");
  ok(g.ok, `30d ES la mejor cobertura: pasa con ok=true (violaciones: ${JSON.stringify(kinds(g))})`);

  console.log("\n  ▸ 1b · marca CIERTA sobre la 2da columna numérica; la 1ra la contradice");
  const t2 = [
    "Así viene la venta contra el año anterior.",
    "",
    "| Mes | Año anterior | Este año |",
    "|---|---:|---:|",
    "| Ene | $9.0M | $6.8M |",
    "| Feb | $6.0M | $7.8M |",
    "| Mar **← más alto** | $7.0M | $9.4M |",
  ].join("\n");
  const g2 = corre(t2, "Venta · mes");
  ok(g2.ok, `«Mar ← más alto» es cierto en «Este año»: la corrección NO depende del orden de columnas (violaciones: ${JSON.stringify(kinds(g2))})`);

  console.log("\n  ▸ 1c · DOS tablas correctas en una respuesta (el parser se tragaba la segunda)");
  const t3 = [
    "Venta por canal:",
    "",
    "| Canal | Venta |",
    "|---|---:|",
    "| Retail | $10.0M |",
    "| Institucional | $12.0M |",
    "| E-commerce | $16.0M |",
    "",
    "Capital detenido por bodega:",
    "",
    "| Bodega | Capital |",
    "|---|---:|",
    "| Valparaíso | $25K |",
    "| Antofagasta | $8K |",
    "| Concepción | $12K |",
    "| **Total** | **$45K** |",
  ].join("\n");
  const g3 = corre(t3, "Mixto");
  ok(g3.ok, `el Total de la 2da tabla cierra con SUS filas ($45K = 25+8+12): ninguna violación (violaciones: ${JSON.stringify(kinds(g3))})`);

  console.log("\n  ▸ 1d · superlativo CORRECTO en prosa con una cifra de OTRA métrica y la misma unidad");
  const results3 = [{ tool: "marginRead", facts: { rows: [{ name: "Falabella" }, { name: "Lider" }, { name: "Jumbo" }] } }];
  const ledger3 = { figs: [
    fig("Falabella · Margen", "22%", { unit: "pct", raw: 22 }),
    fig("Lider · Margen", "21.5%", { unit: "pct", raw: 21.5 }),
    fig("Jumbo · Margen", "24%", { unit: "pct", raw: 24 }),
    fig("Falabella · Participación", "41%", { unit: "pct", raw: 41 }),
  ] };
  const p = "El mejor margen lo tiene Jumbo con 24%, por delante de Falabella con 22% (que concentra el 41% de participación) y de Lider con 21.5%.";
  const g4 = guardC(p, { ledger: ledger3, results: results3, question: "" });
  ok(!tieneExtremo(g4), `una participación de 41% (otra métrica, misma unit) ya no le gana al margen (violaciones: ${JSON.stringify(kinds(g4))})`);
}

console.log("\n── 2 · LA BATERÍA QUE MANDA · RESPUESTAS CORRECTAS QUE NO SE PUEDEN BLOQUEAR ──");
{
  console.log("\n  ▸ 2a · LA FAMILIA MENOS-ES-MEJOR, seis métricas del producto, todas con la marca BIEN puesta");
  const menosEsMejor = [
    [["Bodega", "Capital inmovilizado"], [["Valparaíso", "$8K"], ["Antofagasta", "$25K"], ["Concepción", "$40K"]], 0, "← la mejor", "Capital · bodega"],
    [["Familia", "% de SKU en alerta"], [["TV", "4%"], ["Audio", "18%"], ["Línea blanca", "31%"]], 0, "← la mejor", "Alerta · familia"],
    [["Cuenta", "Brecha contra benchmark"], [["Cuenta Norte", "1.2pp"], ["Cuenta Sur", "3.4pp"], ["Cuenta Este", "7.9pp"]], 2, "← la peor", "Brecha · cuenta"],
    [["Proveedor", "Costo unitario"], [["Proveedor A", "$12K"], ["Proveedor B", "$19K"], ["Proveedor C", "$26K"]], 0, "← el mejor", "Costo · proveedor"],
    [["Ruta", "Quiebres del mes"], [["Ruta Norte", "3d"], ["Ruta Centro", "11d"], ["Ruta Sur", "26d"]], 2, "← la peor", "Quiebre · ruta"],
    [["Bodega", "Días de inventario"], [["Valparaíso", "30d"], ["Antofagasta", "95d"], ["Concepción", "140d"]], 2, "← la peor", "DOH · bodega"],
  ];
  for (const [h, filas, i, marca, label] of menosEsMejor) {
    const g = corre(tabla(h, filas, i, marca), label);
    ok(!tieneExtremo(g), `«${h[1]}» · «${marca}» en ${filas[i][0]} (${filas[i][1]}) NO se marca — menos es mejor (violaciones: ${JSON.stringify(kinds(g))})`);
  }

  console.log("\n  ▸ 2b · LA FAMILIA MÁS-ES-MEJOR, con la marca BIEN puesta (el otro lado de la misma regla)");
  const masEsMejor = [
    [["Cliente", "Margen"], [["Falabella", "22%"], ["Lider", "21.5%"], ["Jumbo", "24%"]], 2, "← el mejor", "Cartera · margen"],
    [["Canal", "Venta"], [["Retail", "$10.0M"], ["Institucional", "$12.0M"], ["E-commerce", "$16.0M"]], 2, "← la mejor", "Venta · canal"],
    [["Bodega", "Rotación"], [["Valparaíso", "1.2x"], ["Antofagasta", "2.8x"], ["Concepción", "4.1x"]], 2, "← la mejor", "Rotación · bodega"],
    [["Familia", "Contribución"], [["TV", "$3.0M"], ["Audio", "$5.0M"], ["Línea blanca", "$9.0M"]], 0, "← la peor", "Contribución · familia"],
  ];
  for (const [h, filas, i, marca, label] of masEsMejor) {
    const g = corre(tabla(h, filas, i, marca), label);
    ok(!tieneExtremo(g), `«${h[1]}» · «${marca}» en ${filas[i][0]} (${filas[i][1]}) NO se marca (violaciones: ${JSON.stringify(kinds(g))})`);
  }

  console.log("\n  ▸ 2c · LA DIRECCIÓN QUE NO SE RESUELVE NO SE JUZGA (límite declarado, no cobertura silenciosa)");
  const amb = corre(tabla(["Local", "Ticket promedio"], [["Local A", "$12K"], ["Local B", "$19K"], ["Local C", "$26K"]], 0, "← el mejor"), "Ticket · local");
  ok(amb.ok, `«el mejor ticket promedio» no tiene lado declarado en el repo → NO se juzga, ni a favor ni en contra (violaciones: ${JSON.stringify(kinds(amb))})`);
  const amb2 = corre(tabla(["Cuenta", "Brecha de margen"], [["Cuenta Norte", "1.2pp"], ["Cuenta Sur", "3.4pp"], ["Cuenta Este", "7.9pp"]], 0, "← la mejor"), "Brecha · cuenta");
  ok(amb2.ok, `«brecha DE MARGEN» mezcla una métrica de cada signo → dirección ambigua → NO se juzga (violaciones: ${JSON.stringify(kinds(amb2))})`);

  // ── EL HUECO ESTRUCTURAL QUE ESTA SECCIÓN TENÍA, Y QUE UN REVISOR MIDIÓ ────────────────────────────────────
  // Hasta acá, TODOS los controles positivos de la sección 2 usaban métricas que están EN el diccionario de
  // dirección (`_DIR_POR_METRICA`) o en su vocabulario extra. O sea: la batería certificaba LAS ENTRADAS DE LA
  // TABLA, no LA REGLA. Por construcción no podía descubrir el defecto que después se midió — que una clave
  // AUSENTE del diccionario no quedaba «sin firmar» sino FIRMADA AL REVÉS, porque la etiqueta de una métrica de
  // PÉRDIDA lleva adentro el nombre de una métrica positiva. Un gate que sólo prueba las claves que el diccionario
  // ya tiene mide el diccionario, no el guard. Los bloques 2c-bis y 2e existen para cerrar eso: métricas que NO
  // están declaradas en ningún lado, y métricas cuya palabra base está declarada CON EL SIGNO CONTRARIO al que la
  // etiqueta completa significa.
  console.log("\n  ▸ 2c-bis · MÉTRICAS FUERA DEL DICCIONARIO · la regla, no las entradas: sin lado declarado NO se juzga");
  const fueraDelDiccionario = [
    [["Local", "Tiempo de reposición"], [["Local A", "2d"], ["Local B", "9d"], ["Local C", "21d"]], 0, "← el mejor", "Reposición · local"],
    [["Ruta", "Ocupación de camión"], [["Ruta Norte", "41%"], ["Ruta Centro", "68%"], ["Ruta Sur", "92%"]], 2, "← la mejor", "Ocupación · ruta"],
    [["Cuenta", "Antigüedad de la relación"], [["Cuenta Norte", "2x"], ["Cuenta Sur", "5x"], ["Cuenta Este", "9x"]], 0, "← la mejor", "Antigüedad · cuenta"],
    [["Bodega", "Temperatura promedio"], [["Bodega A", "$3K"], ["Bodega B", "$7K"], ["Bodega C", "$15K"]], 1, "← la mejor", "Temperatura · bodega"],
    [["Familia", "Índice de surtido"], [["TV", "1.2x"], ["Audio", "3.4x"], ["Línea blanca", "7.9x"]], 1, "← el mejor", "Surtido · familia"],
  ];
  for (const [h, filas, i, marca, label] of fueraDelDiccionario) {
    const g = corre(tabla(h, filas, i, marca), label);
    ok(g.ok, `«${h[1]}» no está en NINGÚN diccionario de dirección: «${marca}» en ${filas[i][1]} NO se juzga —ni a favor ni en contra— aunque no sea el extremo (violaciones: ${JSON.stringify(kinds(g))})`);
  }
  console.log("\n     y el CONTRASTE que prueba que la abstención es POR LA DIRECCIÓN y no porque el chequeo esté muerto:");
  const magFuera = corre(tabla(["Local", "Tiempo de reposición"], [["Local A", "2d"], ["Local B", "9d"], ["Local C", "21d"]], 0, "← el mayor"), "Reposición · local");
  ok(tieneExtremo(magFuera), "sobre la MISMA métrica desconocida, «← el mayor» (MAGNITUD, que se lee sola) sobre 2d contra 21d SÍ bloquea");

  console.log("\n  ▸ 2d · OTRAS FORMAS CORRECTAS que el fix anterior o el nuevo podrían romper");
  const dosTablasConTotal = [
    "Venta por canal:",
    "",
    "| Canal | Venta |",
    "|---|---:|",
    "| Retail | $10.0M |",
    "| Institucional | $12.0M |",
    "| E-commerce | $16.0M |",
    "| **Total** | **$38.0M** |",
    "",
    "Capital por bodega:",
    "",
    "| Bodega | Capital |",
    "|---|---:|",
    "| Valparaíso | $25K |",
    "| Antofagasta | $8K |",
    "| Concepción | $12K |",
    "| **Total** | **$45K** |",
  ].join("\n");
  ok(corre(dosTablasConTotal, "Mixto").ok, "dos tablas, las DOS con Total y las dos cerrando: pasa entera");

  const marcaEnCelda = [
    "| Canal | Venta |",
    "|---|---:|",
    "| Retail | $10.0M |",
    "| Institucional | $12.0M |",
    "| E-commerce | $16.0M **← el mayor** |",
  ].join("\n");
  ok(corre(marcaEnCelda, "Venta · canal").ok, "la marca escrita en la celda de la cifra, y CIERTA, sigue pasando (el fix no castiga la forma, juzga la afirmación)");

  const conteoDedup = [
    "| Bodega | SKU en alerta |",
    "|---|---:|",
    "| Valparaíso | 12 |",
    "| Antofagasta | 8 |",
    "| Concepción | 5 |",
    "| **Total** | **20** |",
  ].join("\n");
  ok(corre(conteoDedup, "SKU · bodega").ok, "un conteo de entidades DISTINTAS puede dar MENOS que la suma de las partes (el mismo SKU en dos bodegas): total 20 < 25 NO se marca");

  const listaCorrecta = ["Tu cartera por margen:", "- Jumbo 24% ← el mejor", "- Falabella 22%", "- Lider 21.5%"].join("\n");
  const gLista = guardC(listaCorrecta, { ledger: { figs: [
    fig("Jumbo · Margen", "24%", { unit: "pct", raw: 24 }),
    fig("Falabella · Margen", "22%", { unit: "pct", raw: 22 }),
    fig("Lider · Margen", "21.5%", { unit: "pct", raw: 21.5 }),
  ] }, results: [], question: "" });
  ok(!tieneExtremo(gLista), `la MISMA lista con la marca en el ítem correcto pasa (violaciones: ${JSON.stringify(kinds(gLista))})`);

  const listaMenosEsMejor = ["Días de inventario por bodega:", "- Valparaíso 30d ← la mejor", "- Antofagasta 95d", "- Concepción 140d"].join("\n");
  ok(!tieneExtremo(corre(listaMenosEsMejor, "DOH · bodega")), "la lista de la familia menos-es-mejor con la marca bien puesta tampoco se bloquea");

  const comparativo = ["Tu cartera por margen:", "- Falabella 22%, menor que tu benchmark", "- Lider 21.5%", "- Jumbo 24%"].join("\n");
  ok(!tieneExtremo(corre(comparativo, "Cartera · margen")), "«menor QUE el benchmark» es un COMPARATIVO contra una vara, no una marca de extremo: no se juzga");

  const prosaContraVara = "El mejor margen de la cartera es 22%, y está 8pp por debajo de tu benchmark de 30%.";
  ok(guardC(prosaContraVara, { ledger: { figs: [
    fig("Cartera · Margen", "22%", { unit: "pct", raw: 22 }),
    fig("Benchmark de margen", "30%", { unit: "pct", raw: 30 }),
    fig("Brecha de margen", "8pp", { unit: "pp", raw: 8 }),
  ] }, results: [], question: "" }).ok, "un superlativo leído contra una VARA (que no le pertenece a ninguna entidad) sigue sin marcarse");
}

console.log("\n── 3 · EL INTERRUPTOR GLOBAL · la declaración de recorte vale para SU tabla, no para la respuesta ──");
{
  const base = [
    "| Canal | Venta |",
    "|---|---:|",
    "| Retail | $10.0M |",
    "| Institucional | $12.0M |",
    "| E-commerce | $16.0M |",
    "| **Total** | **$50.0M** |",
  ].join("\n");
  ok(tieneTotal(corre("Cierre al 1 de 2026.\n\n" + base, "Venta · canal")), "una FECHA («1 de 2026») ya no apaga la reconciliación: el Total falso sigue bloqueando");
  ok(tieneTotal(corre(base + "\nUn canal quedó sin dato este mes.", "Venta · canal")), "«sin dato» suelto ya no apaga la reconciliación");
  ok(tieneTotal(corre("Los subtotales por familia se ven abajo.\n\n" + base, "Venta · canal")), "la palabra «subtotal» en la intro ya no apaga la reconciliación");

  console.log("\n  ▸ CONTROLES — el recorte que SÍ está declarado tiene que seguir pasando");
  ok(corre(base + "\nSon los 3 principales de 12 canales; el resto suma $12.0M.", "Venta · canal").ok, "«los 3 principales de 12 · el resto suma $12.0M» sigue siendo salida válida");
  // se afirma la AUSENCIA de `total-no-reconcilia`, no `ok`: «top 3» dispara además `conteo-no-autorizado`
  // (chequeo 2, ajeno a esto — el conteo no está en la boleta de este caso armado a mano).
  ok(!tieneTotal(corre("Te muestro el top 3 de canales; el total cubre los 12.\n\n" + base, "Venta · canal")), "«top 3» declarado antes de la tabla sigue eximiendo al Total");
  const conSubtotalEnFila = base.replace("| **Total** | **$50.0M** |", "| **Total (subtotal de la familia)** | **$50.0M** |");
  ok(corre(conSubtotalEnFila, "Venta · canal").ok, "la fila que se declara SUBTOTAL en su propia celda sigue exenta");

  console.log("\n  ▸ Y la declaración de UNA tabla no absuelve a la OTRA");
  const dos = [
    "Venta por canal — son los 3 principales de 12; el resto suma $12.0M.",
    "",
    "| Canal | Venta |",
    "|---|---:|",
    "| Retail | $10.0M |",
    "| Institucional | $12.0M |",
    "| E-commerce | $16.0M |",
    "| **Total** | **$50.0M** |",
    "",
    "Capital por bodega:",
    "",
    "| Bodega | Capital |",
    "|---|---:|",
    "| Valparaíso | $25K |",
    "| Antofagasta | $8K |",
    "| Concepción | $12K |",
    "| **Total** | **$95K** |",
  ].join("\n");
  const gd = corre(dos, "Mixto");
  ok(tieneTotal(gd) && gd.violations.some((v) => /\$95K/.test(v.detail)), "el Total falso de la SEGUNDA tabla bloquea aunque la PRIMERA declare su recorte");
  ok(!gd.violations.some((v) => /\$50\.0M/.test(v.detail)), "…y la primera, que declaró el recorte, sigue exenta");
}

console.log("\n── 4 · LA MITAD DE DEFECTO · lo que el revisor evadía y ahora bloquea ──");
{
  const enCelda = [
    "| Cliente | Margen |",
    "|---|---:|",
    "| Falabella | 22% **← el mejor** |",
    "| Lider | 21.5% |",
    "| Jumbo | 24% |",
  ].join("\n");
  ok(tieneExtremo(corre(enCelda, "Cartera · margen")), "la marca movida a la celda de la CIFRA (misma mentira, otra columna) ya no evade");

  const alRevés = tabla(["Bodega", "Días de inventario"], [["Valparaíso", "30d"], ["Antofagasta", "95d"], ["Concepción", "140d"]], 2, "← la mejor");
  ok(tieneExtremo(corre(alRevés, "DOH · bodega")), "«← la mejor» sobre 140d de cobertura SÍ bloquea: la dirección se LEE, no se ignora");
  const margenAlRevés = tabla(["Cliente", "Margen"], [["Falabella", "22%"], ["Lider", "21.5%"], ["Jumbo", "24%"]], 1, "← el mejor");
  ok(tieneExtremo(corre(margenAlRevés, "Cartera · margen")), "«← el mejor» sobre el margen MÁS BAJO sigue bloqueando");

  const results3 = [{ tool: "marginRead", facts: { rows: [{ name: "Falabella" }, { name: "Lider" }, { name: "Jumbo" }] } }];
  const ledger3 = { figs: [
    fig("Falabella · Margen", "22%", { unit: "pct", raw: 22 }),
    fig("Lider · Margen", "21.5%", { unit: "pct", raw: 21.5 }),
    fig("Jumbo · Margen", "24%", { unit: "pct", raw: 24 }),
  ] };
  const partido = "El mejor margen lo tiene Falabella con 22%. Detrás vienen Lider con 21.5% y Jumbo con 24%.";
  ok(tieneExtremo(guardC(partido, { ledger: ledger3, results: results3, question: "" })), "el superlativo partido en DOS oraciones ya no evade: se juzga por párrafo");

  const lista = ["Tu cartera por margen:", "- Falabella 22% ← el mejor", "- Lider 21.5%", "- Jumbo 24%"].join("\n");
  ok(tieneExtremo(guardC(lista, { ledger: ledger3, results: results3, question: "" })), "la LISTA CON VIÑETAS —ni tabla ni oración— ahora tiene chequeo");

  const unidades = [
    "| Bodega | Unidades |",
    "|---|---:|",
    "| Valparaíso | 1200 unidades |",
    "| Antofagasta | 800 unidades |",
    "| Concepción | 500 unidades |",
    "| **Total** | **9000 unidades** |",
  ].join("\n");
  ok(tieneTotal(corre(unidades, "Unidades · bodega")), "un Total de 9000 unidades contra 2500 visibles bloquea (el conteo también es aditivo)");
  const sku = [
    "| Bodega | SKU en alerta |",
    "|---|---:|",
    "| Valparaíso | 12 |",
    "| Antofagasta | 8 |",
    "| Concepción | 5 |",
    "| **Total** | **90** |",
  ].join("\n");
  ok(tieneTotal(corre(sku, "SKU · bodega")), "un Total de 90 SKU contra 25 visibles bloquea");
}

console.log("\n── 5 · NO-REGRESIÓN · lo que el fix original ya protegía sigue en pie ──");
{
  const celdaVacia = [
    "| Mes | Este año | Año anterior |",
    "|---|---:|---:|",
    "| Ene | $6.8M | $6.3M |",
    "| Feb **← más bajo** | — | $6.0M |",
    "| Mar | $7.8M | $7.2M |",
    "| Abr | $7.4M | $6.9M |",
  ].join("\n");
  ok(tieneExtremo(corre(celdaVacia, "Venta · mes")), "el extremo marcado sobre una celda VACÍA de la serie principal sigue bloqueando");

  const totalFalso = [
    "| Familia | Venta |",
    "|---|---:|",
    "| TV | $10.0M |",
    "| Audio | $12.0M |",
    "| Línea blanca | $16.0M |",
    "| **Total** | **$50.0M** |",
  ].join("\n");
  ok(tieneTotal(corre(totalFalso, "Venta · familia")), "el Total que no reconcilia sigue bloqueando");

  const pctNoSuma = [
    "| Cliente | Margen |",
    "|---|---:|",
    "| Falabella | 22% |",
    "| Lider | 21% |",
    "| Jumbo | 24% |",
    "| **Total** | 22.5% |",
  ].join("\n");
  ok(corre(pctNoSuma, "Cartera · margen").ok, "una columna de % NUNCA se suma: su «Total» es el ponderado");

  const ordenPrometido = [
    "Te las ordeno de mayor a menor margen.",
    "",
    "| Cliente | Margen |",
    "|---|---:|",
    "| Jumbo | 24% |",
    "| Falabella | 22% |",
    "| Lider | 21.5% |",
  ].join("\n");
  ok(corre(ordenPrometido, "Cartera · margen").ok, "«de mayor a menor» es una promesa de ORDEN, no una marca de extremo");

  ok(corre("La venta del negocio cerró el año en $93.5M. El presupuesto era $97.0M.", "Venta del negocio").ok, "prosa sin marcas, sin tabla y sin totales no se ve afectada");
}

/* ═══════════════════════════════════════════════════════════════════════════════════════════════════════════════
 * 6 · LOS CUATRO FALSOS POSITIVOS DE LA SEGUNDA REVISIÓN
 * Un segundo revisor adversarial midió cuatro clases de respuesta CORRECTA que este mismo chequeo bloqueaba, cada
 * una atribuida con un comparador PRE (guardC de la base 2b062cc) vs POST (árbol) sobre el MISMO input: PRE
 * ok=true → POST ok=false. Acá queda cada una fijada con SU caso correcto, y al lado el control que prueba que el
 * chequeo no se murió para conseguirlo.
 * ═══════════════════════════════════════════════════════════════════════════════════════════════════════════════ */
console.log("\n── 6 · LOS CUATRO FALSOS POSITIVOS MEDIDOS EN LA SEGUNDA REVISIÓN ──");
{
  console.log("\n  ▸ 6a · FP-1 · LA MÉTRICA DE PÉRDIDA YA NO SE FIRMA AL REVÉS (es el vocabulario central del producto)");
  // Cada una lleva ADENTRO el nombre de una métrica POSITIVA del diccionario (contribución/venta/margen), así que
  // la dirección no quedaba «sin resolver» —la rama segura— sino RESUELTA AL REVÉS. La marca está en la fila que
  // DE VERDAD es la mejor (el valor más bajo: perder menos es mejor), o sea son ocho respuestas CORRECTAS.
  const perdida = [
    [["Cuenta", "Contribución no capturada"], ["$120K", "$480K", "$910K"], "← la mejor", "ontology.js:75 · toolRegistry.js:442 · fue la cifra principal de la certificación"],
    [["Cuenta", "Gap de contribución"], ["$120K", "$480K", "$910K"], "← la mejor", "ontology.js:76"],
    [["Cuenta", "Contribución dejada"], ["$120K", "$480K", "$910K"], "← la mejor", "ontology.js:75"],
    [["SKU", "Días sin venta"], ["3d", "41d", "96d"], "← el mejor", "routerData.js:279 · sinónimo DECLARADO de DOH"],
    [["Bodega", "Venta perdida"], ["$40K", "$180K", "$310K"], "← la mejor", "mesaCapital.js:10"],
    [["Bodega", "Venta en riesgo"], ["$40K", "$180K", "$310K"], "← la mejor", "mismo molde"],
    [["Cliente", "Margen perdido"], ["1.2%", "4.8%", "9.1%"], "← el mejor", "mismo molde"],
    [["Cliente", "Margen sin capturar"], ["1.2%", "4.8%", "9.1%"], "← el mejor", "ontology.js:77 «sin captura de margen»"],
  ];
  for (const [h, vals, marca, fuente] of perdida) {
    const t = tabla(h, [["Alfa", vals[0]], ["Beta", vals[1]], ["Gamma", vals[2]]], 0, marca);
    const g = corre(t, `${h[1]} · entidad`);
    ok(g.ok, `«${h[1]}» · «${marca}» sobre ${vals[0]} (el MENOR, que es el mejor) pasa — ${fuente} (violaciones: ${JSON.stringify(kinds(g))})`);
  }
  console.log("\n     la misma inversión vivía en las TRES estructuras, no sólo en la tabla:");
  const lp = { figs: [
    fig("Alfa · Contribución no capturada", "$120K", { unit: "money", raw: 120000 }),
    fig("Beta · Contribución no capturada", "$480K", { unit: "money", raw: 480000 }),
    fig("Gamma · Contribución no capturada", "$910K", { unit: "money", raw: 910000 }),
  ] };
  const rp = [{ tool: "diagnose", facts: { rows: [{ name: "Alfa" }, { name: "Beta" }, { name: "Gamma" }] } }];
  const prosaPerdida = "La mejor contribución no capturada la tiene Alfa con $120K, mientras Beta llega a $480K y Gamma a $910K.";
  ok(guardC(prosaPerdida, { ledger: lp, results: rp, question: "" }).ok, "PROSA · la misma afirmación correcta pasa (el sustantivo llega recortado a «contribución no», así que la pérdida se lee del párrafo y del LEDGER)");
  const listaPerdida = ["Contribución no capturada por cuenta:", "- Alfa $120K ← la mejor", "- Beta $480K", "- Gamma $910K"].join("\n");
  ok(guardC(listaPerdida, { ledger: lp, results: rp, question: "" }).ok, "LISTA · la misma afirmación correcta pasa");

  console.log("\n     CONTROLES — la abstención es sólo sobre el JUICIO, y sólo por la pérdida:");
  const magPerdida = tabla(["Cuenta", "Contribución no capturada"], [["Alfa", "$120K"], ["Beta", "$480K"], ["Gamma", "$910K"]], 0, "← la mayor");
  ok(tieneExtremo(corre(magPerdida, "Contribución no capturada · cuenta")), "«← la MAYOR» sobre $120K teniendo $910K a la vista SIGUE bloqueando: la magnitud se lee sola, no necesita saber la dirección");
  const contribSinPerdida = tabla(["Familia", "Contribución"], [["TV", "$3.0M"], ["Audio", "$5.0M"], ["Línea blanca", "$9.0M"]], 0, "← la mejor");
  ok(tieneExtremo(corre(contribSinPerdida, "Contribución · familia")), "y la MISMA palabra base SIN el modificador de pérdida («Contribución» a secas) sigue firmando +1 y bloqueando la marca falsa");
  // EL COSTO ACEPTADO, ESCRITO Y EJECUTABLE (límite (f)): sobre una métrica de pérdida el JUICIO no se juzga, así
  // que una marca de juicio FALSA tampoco se marca. Se abstiene en vez de invertir porque ningún regex puede
  // decidir con certeza si «recuperación de venta perdida» es la pérdida o su reverso, y una inversión equivocada
  // vuelve a bloquear una respuesta correcta. Falso negativo antes que falso positivo.
  const juicioFalsoEnPerdida = tabla(["Cuenta", "Contribución no capturada"], [["Alfa", "$120K"], ["Beta", "$480K"], ["Gamma", "$910K"]], 2, "← la mejor");
  ok(corre(juicioFalsoEnPerdida, "Contribución no capturada · cuenta").ok, "LÍMITE DECLARADO (f): «← la mejor» sobre $910K —que es FALSO— tampoco se marca. Sobre una métrica de pérdida el juicio NO se juzga: es el costo aceptado de no invertir a ciegas");

  console.log("\n  ▸ 6b · FP-2 · EL CANDADO DE RIVALES DE LA LISTA, ALINEADO CON EL DE LA PROSA");
  const resultsL = [{ tool: "marginRead", facts: { rows: [{ name: "Falabella" }, { name: "Lider" }, { name: "Jumbo" }] } }];
  const ledgerMixto = { figs: [
    fig("Jumbo · Margen", "24%", { unit: "pct", raw: 24 }),
    fig("Falabella · Participación", "41%", { unit: "pct", raw: 41 }),
    fig("Lider · Participación", "30%", { unit: "pct", raw: 30 }),
  ] };
  const listaMixta = ["Lo que hay que mirar del mes:", "- Margen de Jumbo: 24% ← el mejor", "- Falabella concentra el 41%", "- Lider aporta el 30%"].join("\n");
  const gMix = guardC(listaMixta, { ledger: ledgerMixto, results: resultsL, question: "" });
  ok(gMix.ok, `una PARTICIPACIÓN de 41% (otra métrica, misma unidad) ya no le gana al margen EN LA LISTA — era el FP-4 de prosa mudado a la superficie nueva (violaciones: ${JSON.stringify(kinds(gMix))})`);
  const prosaMixta = "El mejor margen lo tiene Jumbo con 24%. Falabella concentra el 41% y Lider aporta el 30%.";
  ok(guardC(prosaMixta, { ledger: ledgerMixto, results: resultsL, question: "" }).ok, "…y la MISMA afirmación en prosa sigue pasando: las dos superficies juzgan ahora con la misma regla");
  const listaSinLedger = ["Focos del mes:", "- Capital inmovilizado en Valparaíso: $8K ← la mejor bodega", "- Contribución no capturada de Falabella: $120K", "- Costo de la merma de Concepción: $310K"].join("\n");
  ok(corre(listaSinLedger, "Mixto").ok, "una lista de TRES métricas distintas cuyas cifras el ledger no sabe atar queda AFUERA de la comparación (igual que en prosa), no adentro");
  console.log("\n     CONTROL — con los rivales de la MISMA métrica, la lista sigue bloqueando:");
  const ledgerHomog = { figs: [
    fig("Falabella · Margen", "22%", { unit: "pct", raw: 22 }),
    fig("Lider · Margen", "21.5%", { unit: "pct", raw: 21.5 }),
    fig("Jumbo · Margen", "24%", { unit: "pct", raw: 24 }),
  ] };
  const listaFalsa = ["Tu cartera por margen:", "- Falabella 22% ← el mejor", "- Lider 21.5%", "- Jumbo 24%"].join("\n");
  ok(tieneExtremo(guardC(listaFalsa, { ledger: ledgerHomog, results: resultsL, question: "" })), "«← el mejor» sobre 22% con 24% en la misma lista y la misma métrica sigue bloqueando");

  console.log("\n  ▸ 6c · FP-3 · UNA CASCADA DE RESTA NO ES UNA SUMA (el límite por cantidad de filas no la protegía)");
  const pnl = [
    "| Concepto | Monto |", "|---|---:|",
    "| Venta | $50.0M |", "| Costo | $30.0M |", "| Carga comercial | $8.0M |", "| **Total** | **$12.0M** |",
  ].join("\n");
  ok(corre(pnl, "P&L").ok, "el P&L de la casa (pnl.js:894 · Venta − Costo − Carga = Resultado): 50 − 30 − 8 = 12, la fila final es una RESTA y ya no se reconcilia como suma");
  const pnlEtiqueta = pnl.replace("| **Total** | **$12.0M** |", "| **Total resultado comercial** | **$12.0M** |");
  ok(corre(pnlEtiqueta, "P&L").ok, "la misma cascada con la etiqueta REAL del producto («Total resultado comercial») también pasa — por la aritmética Y por el neteo declarado en la etiqueta");
  const ventaNeta = [
    "Cómo se arma la venta neta:", "",
    "| Concepto | Monto |", "|---|---:|",
    "| Venta bruta | $50.0M |", "| Devoluciones | $2.0M |", "| Descuentos | $6.0M |", "| **Total venta neta** | **$42.0M** |",
  ].join("\n");
  // se afirma la AUSENCIA de `total-no-reconcilia`, no `ok`: la fila «Descuentos» es vocabulario de CARGA y este
  // ledger armado a mano rotula TODAS las cifras como «Venta neta», así que rebota por `metrica-mal-atribuida`
  // (chequeo 9, preexistente y ajeno a esto — verificado PRE=POST contra la base).
  ok(!tieneTotal(corre(ventaNeta, "Venta neta")), "otro neteo del mismo molde (bruta − devoluciones − descuentos = neta): 50 − 2 − 6 = 42, ya no se reconcilia como suma");
  console.log("\n     CONTROL — la cascada cuyo neteo NO da, y la suma falsa de siempre, siguen bloqueando:");
  const pnlFalso = pnl.replace("**$12.0M**", "**$20.0M**");
  ok(tieneTotal(corre(pnlFalso, "P&L")), "la MISMA forma con $20.0M —que no es ni la suma ($88.0M) ni la resta ($12.0M)— sigue bloqueando: la exención es aritmética, no por la forma");
  const sumaFalsa = [
    "| Familia | Venta |", "|---|---:|",
    "| TV | $10.0M |", "| Audio | $12.0M |", "| Línea blanca | $16.0M |", "| **Total** | **$50.0M** |",
  ].join("\n");
  ok(tieneTotal(corre(sumaFalsa, "Venta · familia")), "y una tabla de partes homogéneas con el Total inflado sigue bloqueando");

  console.log("\n  ▸ 6d · FP-4 · UN KPI QUE EMPIEZA CON «TOTAL» NO ES UNA FILA DE RECONCILIACIÓN");
  const kpi = [
    "| Segmento | Cantidad de clientes |", "|---|---:|",
    "| Total de clientes | 500 |", "| Activos | 320 |", "| Nuevos | 45 |", "| En riesgo | 60 |",
  ].join("\n");
  ok(corre(kpi, "Clientes").ok, "«Total de clientes» ENCABEZA la tabla y abajo van subconjuntos SOLAPADOS: 320+45+60 no tiene por qué dar 500 — una fila que reconcilia CIERRA la tabla, no la abre");
  console.log("\n     CONTROL — la fila Total que sí cierra la tabla sigue reconciliando:");
  const conteoInflado = [
    "| Segmento | Cantidad de clientes |", "|---|---:|",
    "| Activos | 320 |", "| Nuevos | 45 |", "| En riesgo | 60 |", "| **Total de clientes** | **900** |",
  ].join("\n");
  ok(tieneTotal(corre(conteoInflado, "Clientes")), "las MISMAS filas con el Total ABAJO y en 900 contra 425 visibles siguen bloqueando");
}

console.log(`\n── _extremo_y_total_sin_falsos_positivos_gate: ${pass} PASS · ${fail} FAIL (de ${pass + fail}) ──`);
process.exit(fail ? 1 : 0);
