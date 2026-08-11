/* === _respuesta_como_sistema_gate.mjs · GATE PERMANENTE · guardC juzga la respuesta como SISTEMA ==============
 * owner 2026-08-11 — cierra los defectos D5 («afirmar un extremo sobre una cifra que no se muestra» + «un Total
 * que no reconcilia con lo visible») y D6 («llamar total a un subtotal»), medidos en la certificación pagada.
 *
 * LO QUE ESTE GATE AFIRMA, en una frase: una respuesta se juzga como SISTEMA — toda afirmación que RELACIONA
 * cifras (una marca de extremo, un superlativo, una fila Total, una palabra de agregación) tiene que sostenerse
 * con las cifras que la MISMA respuesta muestra y con el alcance que la boleta declaró. Hasta el fix, guardC
 * validaba cada cifra AISLADA y la tabla sólo por EXISTENCIA, así que las tres formas del defecto salían con
 * ok:true / verdict:"fiel" / violations:[].
 *
 * POR QUÉ NO ES UN PARCHE A LO MEDIDO: la sección 1 corre el turno literal de la corrida pagada, pero las
 * secciones 2-4 no comparten con él ni la métrica, ni el eje, ni la tool, ni la forma. Hay casos en TABLA y en
 * PROSA PURA, con y sin fila Total, en meses / clientes / canales / bodegas, y cada bloque trae su CONTROL
 * POSITIVO — la misma estructura con la afirmación BIEN hecha, que tiene que seguir pasando. Un chequeo que
 * bloquea la marca verdadera igual que la falsa no distingue nada, y eso es lo que los controles miden.
 *
 * 100% DETERMINÍSTICO — sin LLM, sin red: se arma la boleta con `fig()` (el emisor real) y se llama a `guardC`.
 */
import { guardC } from "./src/adi/oracle/guardC.js";
import { fig, parseFigures } from "./src/adi/boleta.js";

let pass = 0, fail = 0;
const ok = (cond, label) => { console.log(`  ${cond ? "✓" : "✗"} ${label}`); if (cond) pass++; else fail++; };
const kinds = (g) => g.violations.map((v) => v.kind);
const tiene = (g, kind) => kinds(g).includes(kind);

// autoriza TODAS las cifras del texto bajo un label dado: aísla los chequeos NUEVOS de los viejos (nada puede
// rebotar por `cifra-no-autorizada`, así que un bloqueo acá sólo puede venir de lo que este gate afirma).
const ledgerDe = (texto, label) => ({ figs: parseFigures(texto).map((f) => fig(label, f.text, { unit: f.unit, raw: f.raw })) });

console.log("── 1 · EL TURNO MEDIDO (E3.t1 de la corrida pagada) — extremo sobre celda vacía + Total que no cierra ──");
{
  const t = [
    "La venta del negocio **SUPERA el presupuesto** en el año cerrado, con **$100.0M** frente a **$97.0M** presupuestados.",
    "",
    "| Mes | Este año | Año anterior | Presupuesto |",
    "|---|---:|---:|---:|",
    "| Ene | $6.8M | $6.3M | $6.5M |",
    "| Feb **← más bajo** | — | $6.0M | — |",
    "| Mar | $7.8M | $7.2M | $7.5M |",
    "| Abr | $7.4M | $6.9M | — |",
    "| May | $8.2M | $7.6M | $8.0M |",
    "| Jun | $8.7M | — | $8.4M |",
    "| Jul **← mayor caída mensual** | $8.1M | — | — |",
    "| Ago | $9.1M | — | — |",
    "| Sep | $8.6M | $7.9M | $8.5M |",
    "| Oct | $9.4M | — | $9.1M |",
    "| Nov **← más alto** | $9.8M | $9.0M | $9.5M |",
    "| Dic | $9.6M | — | $9.0M |",
    "| **Total** | **$100.0M** | **$92.9M** | **$97.0M** |",
  ].join("\n");
  const g = guardC(t, { ledger: ledgerDe(t, "Venta del negocio · mes"), results: [], question: "" });
  ok(!g.ok, `la tabla medida YA NO pasa como "fiel" — verdict: ${g.verdict}`);
  ok(tiene(g, "extremo-sin-sustento"), "«Feb ← más bajo» con la celda de la serie principal vacía → extremo-sin-sustento");
  ok(tiene(g, "total-no-reconcilia"), "Total $100.0M contra $93.5M de filas visibles → total-no-reconcilia");
  ok(!g.violations.some((v) => /Nov/.test(v.detail)), "«Nov ← más alto» ($9.8M, el máximo real de la columna) NO se marca — el chequeo lee el valor, no la marca");
  ok(!g.violations.some((v) => /Jul/.test(v.detail)), "«Jul ← mayor caída mensual» NO se marca: nombra una magnitud (un delta entre filas) que la tabla no muestra");
}

console.log("\n── 2 · EXTREMO · GENERALIDAD — otro eje, otra métrica, y también SIN tabla ──");
{
  console.log("\n  ▸ 2a · ranking de CUENTAS con la celda de la magnitud marcada vacía (ni un 'mes' en toda la respuesta)");
  const t = [
    "Estas son las cuentas por contribución con su brecha contra tu benchmark.",
    "",
    "| Cuenta | Contribución | Brecha |",
    "|---|---:|---:|",
    "| Cuenta Norte | $8.2M | 3.1pp |",
    "| Cuenta Sur **← mayor brecha** | $6.4M | — |",
    "| Cuenta Este | $5.1M | 2.4pp |",
    "| Cuenta Oeste | $4.3M | 1.8pp |",
  ].join("\n");
  const g = guardC(t, { ledger: ledgerDe(t, "Cartera · contribución"), results: [], question: "" });
  ok(!g.ok && tiene(g, "extremo-sin-sustento"), `la marca «← mayor brecha» sobre una celda vacía bloquea — verdict: ${g.verdict}`);

  console.log("\n  ▸ 2b · TODAS las celdas llenas, sin fila Total: la marca está en la FILA EQUIVOCADA");
  const malo = [
    "| Cliente | Margen |",
    "|---|---:|",
    "| Falabella **← el mejor** | 22% |",
    "| Lider | 21.5% |",
    "| Jumbo | 24% |",
  ].join("\n");
  const gm = guardC(malo, { ledger: ledgerDe(malo, "Cartera · margen"), results: [], question: "" });
  ok(!gm.ok && tiene(gm, "extremo-sin-sustento"), `«Falabella ← el mejor» con 22% mientras la misma tabla muestra 24% → bloquea (verdict: ${gm.verdict})`);

  console.log("\n  ▸ 2c · CONTROL POSITIVO — la MISMA tabla con la marca en la fila correcta tiene que PASAR");
  const bueno = malo.replace("| Falabella **← el mejor** | 22% |", "| Falabella | 22% |").replace("| Jumbo | 24% |", "| Jumbo **← el mejor** | 24% |");
  const gb = guardC(bueno, { ledger: ledgerDe(bueno, "Cartera · margen"), results: [], question: "" });
  ok(gb.ok, `la marca verdadera pasa con ok=true — el guard DISTINGUE la marca cierta de la falsa (violaciones: ${JSON.stringify(kinds(gb))})`);

  console.log("\n  ▸ 2d · PROSA PURA, sin una sola tabla (la mitad del defecto que ninguna estructura tabular cubre)");
  const results3 = [{ tool: "marginRead", facts: { rows: [{ name: "Falabella" }, { name: "Lider" }, { name: "Jumbo" }] } }];
  const ledger3 = { figs: [
    fig("Falabella · Margen", "22%", { unit: "pct", raw: 22 }),
    fig("Lider · Margen", "21.5%", { unit: "pct", raw: 21.5 }),
    fig("Jumbo · Margen", "24%", { unit: "pct", raw: 24 }),
  ] };
  const pMal = "El mejor margen lo tiene Falabella con 22%, por delante de Lider con 21.5% y de Jumbo con 24%.";
  const gp = guardC(pMal, { ledger: ledger3, results: results3, question: "" });
  ok(!gp.ok && tiene(gp, "extremo-sin-sustento"), `el superlativo contradicho en prosa bloquea (verdict: ${gp.verdict})`);

  console.log("\n  ▸ 2e · CONTROL POSITIVO en prosa — el mismo superlativo, bien puesto");
  const pBien = "El mejor margen lo tiene Jumbo con 24%, por delante de Falabella con 22% y de Lider con 21.5%.";
  const gpb = guardC(pBien, { ledger: ledger3, results: results3, question: "" });
  ok(gpb.ok, `pasa con ok=true (violaciones: ${JSON.stringify(kinds(gpb))})`);

  console.log("\n  ▸ 2f · CONTROLES de falso positivo — lo que NO puede marcarse nunca");
  const orden = [
    "Te las ordeno de mayor a menor margen.",
    "",
    "| Cliente | Margen |",
    "|---|---:|",
    "| Jumbo | 24% |",
    "| Falabella | 22% |",
    "| Lider | 21.5% |",
  ].join("\n");
  const go = guardC(orden, { ledger: ledgerDe(orden, "Cartera · margen"), results: [], question: "" });
  ok(go.ok, `«de mayor a menor» es una promesa de ORDEN, no una marca de extremo — no se marca (violaciones: ${JSON.stringify(kinds(go))})`);
  const contraVara = "El mejor margen de la cartera es 22%, y está 8pp por debajo de tu benchmark de 30%.";
  const gv = guardC(contraVara, { ledger: { figs: [fig("Cartera · Margen", "22%", { unit: "pct", raw: 22 }), fig("Benchmark de margen", "30%", { unit: "pct", raw: 30 }), fig("Brecha de margen", "8pp", { unit: "pp", raw: 8 })] }, results: [], question: "" });
  ok(gv.ok, `un superlativo leído CONTRA UNA VARA (no contra pares) no se marca aunque el benchmark sea mayor (violaciones: ${JSON.stringify(kinds(gv))})`);
}

console.log("\n── 3 · TOTAL QUE NO RECONCILIA — dos universos distintos del medido, más sus controles ──");
{
  const canal = [
    "Así se ve la venta por canal en el año cerrado.",
    "",
    "| Canal | Venta |",
    "|---|---:|",
    "| Retail | $10.0M |",
    "| Institucional | $12.0M |",
    "| E-commerce | $16.0M |",
    "| **Total** | **$50.0M** |",
  ].join("\n");
  const gc = guardC(canal, { ledger: ledgerDe(canal, "Venta · canal"), results: [], question: "" });
  ok(!gc.ok && tiene(gc, "total-no-reconcilia"), `Total $50.0M sobre filas que suman $38.0M → bloquea (verdict: ${gc.verdict})`);

  const bodega = [
    "| Bodega | Capital detenido |",
    "|---|---:|",
    "| Valparaíso | $25K |",
    "| Antofagasta | $8K |",
    "| Concepción | $12K |",
    "| **Total** | $95K |",
  ].join("\n");
  const gbo = guardC(bodega, { ledger: ledgerDe(bodega, "Capital · bodega"), results: [], question: "" });
  ok(!gbo.ok && tiene(gbo, "total-no-reconcilia"), `otra métrica y otro eje (capital por bodega): $95K contra $45K visibles → bloquea (verdict: ${gbo.verdict})`);

  console.log("\n  ▸ CONTROLES — un total honesto, un recorte declarado, una columna no aditiva y el redondeo");
  const cierra = canal.replace("**$50.0M**", "**$38.0M**");
  ok(guardC(cierra, { ledger: ledgerDe(cierra, "Venta · canal"), results: [], question: "" }).ok, "el MISMO cuadro con el Total que sí cierra pasa con ok=true");

  const declarado = canal + "\nSon los 3 principales de 12 canales; el resto suma $12.0M.";
  ok(guardC(declarado, { ledger: ledgerDe(declarado, "Venta · canal"), results: [], question: "" }).ok, "un total legítimamente PARCIAL que declara el recorte («3 de 12 · el resto suma $12.0M») pasa — la salida válida se acepta");

  const pct = [
    "| Cliente | Margen |",
    "|---|---:|",
    "| Falabella | 22% |",
    "| Lider | 21% |",
    "| Jumbo | 24% |",
    "| **Total** | 22.5% |",
  ].join("\n");
  ok(guardC(pct, { ledger: ledgerDe(pct, "Cartera · margen"), results: [], question: "" }).ok, "una columna de % NUNCA se suma (su «Total» es el ponderado) — no se marca");

  const redondeo = [
    "| Mes | Venta |",
    "|---|---:|",
    "| Ene | $6.8M |",
    "| Feb | $7.8M |",
    "| Mar | $7.4M |",
    "| Abr | $8.2M |",
    "| May | $8.7M |",
    "| Jun | $8.1M |",
    "| Jul | $9.1M |",
    "| Ago | $8.6M |",
    "| Sep | $9.4M |",
    "| Oct | $9.8M |",
    "| Nov | $9.6M |",
    "| **Total** | **$93.6M** |",
  ].join("\n");
  ok(guardC(redondeo, { ledger: ledgerDe(redondeo, "Venta · mes"), results: [], question: "" }).ok, "11 celdas redondeadas a $0.1M contra un total redondeado ($93.6M vs $93.5M exactos) pasan — la tolerancia es proporcional a las filas");
}

console.log("\n── 4 · ALCANCE PROMOVIDO — un subtotal narrado como el total del universo ──");
{
  const sub = (label, valor, raw) => ({ figs: [fig(label, valor, { unit: "money", raw })] });

  const gMed = guardC("La contribución no capturada total asciende a $4.9M contra tu benchmark.", { ledger: sub("Contribución no capturada · subtotal", "$4.9M", 4949142), results: [], question: "" });
  ok(!gMed.ok && tiene(gMed, "alcance-promovido"), `el caso medido (D6): «· subtotal» narrado como «total» → bloquea (verdict: ${gMed.verdict})`);

  const gCap = guardC("Todo tu inventario acumula $33K de capital detenido.", { ledger: sub("Capital detenido · subtotal", "$33K", 33000), results: [], question: "" });
  ok(!gCap.ok && tiene(gCap, "alcance-promovido"), `otra tool y otra métrica (capital de inventario): «todo tu inventario» sobre un subtotal → bloquea (verdict: ${gCap.verdict})`);

  const gCarga = guardC("La carga comercial total del negocio llega a $656K.", { ledger: sub("Carga comercial alta · subtotal", "$656K", 656000), results: [], question: "" });
  ok(!gCarga.ok && tiene(gCarga, "alcance-promovido"), `tercer universo (carga comercial): «total del negocio» sobre un subtotal → bloquea (verdict: ${gCarga.verdict})`);

  console.log("\n  ▸ CONTROLES — el alcance honesto, la colisión de canon y el total-denominador");
  // el conteo «5» va como fig de la boleta: si no, el control rebota por `conteo-no-autorizado` (chequeo 2) y
  // mediría otra cosa — lo que acá se afirma es que el ALCANCE declarado deja pasar la palabra «total».
  const gHon = guardC("La contribución no capturada de las 5 cuentas materiales suma $4.9M; el total de la cartera bajo benchmark es mayor.", { ledger: { figs: [
    fig("Contribución no capturada · subtotal", "$4.9M", { unit: "money", raw: 4949142 }),
    fig("Cuentas materiales", "5", { unit: "count", raw: 5 }),
  ] }, results: [], question: "" });
  ok(gHon.ok, `nombrar el recorte («de las 5 cuentas») deja pasar la misma cifra y la misma palabra «total» (violaciones: ${JSON.stringify(kinds(gHon))})`);

  const gColision = guardC("La contribución total del negocio es $4.9M.", { ledger: { figs: [
    fig("Contribución no capturada · subtotal", "$4.9M", { unit: "money", raw: 4949142 }),
    fig("Contribución · total", "$4.9M", { unit: "money", raw: 4900000 }),
  ] }, results: [], question: "" });
  ok(gColision.ok, `COLISIÓN DE CANON: si otra fig con el MISMO valor declara alcance total, la cita tiene lectura honesta y no se juzga (violaciones: ${JSON.stringify(kinds(gColision))})`);

  const gDenom = guardC("Los $4.9M de contribución no capturada son parte del total de $25.0M de contribución del negocio.", { ledger: { figs: [
    fig("Contribución no capturada · subtotal", "$4.9M", { unit: "money", raw: 4949142 }),
    fig("Contribución · total", "$25.0M", { unit: "money", raw: 25000000 }),
  ] }, results: [], question: "" });
  ok(gDenom.ok, `el total usado como DENOMINADOR («parte del total de $25.0M») no es promoción de alcance (violaciones: ${JSON.stringify(kinds(gDenom))})`);
}

console.log("\n── 5 · NO-REGRESIÓN — una respuesta bien armada sigue pasando entera ──");
{
  const buena = [
    "La venta del negocio cerró el año en $93.5M, por debajo del presupuesto.",
    "",
    "| Mes | Este año |",
    "|---|---:|",
    "| Ene | $6.8M |",
    "| Feb **← más bajo** | $6.0M |",
    "| Mar | $7.8M |",
    "| Abr **← más alto** | $9.8M |",
    "| **Total** | **$30.4M** |",
  ].join("\n");
  const g = guardC(buena, { ledger: ledgerDe(buena, "Venta del negocio · mes"), results: [], question: "" });
  ok(g.ok, `marcas correctas + Total que reconcilia → ok=true, verdict "${g.verdict}" (violaciones: ${JSON.stringify(kinds(g))})`);
  const sinNada = "La venta del negocio cerró el año en $93.5M. El presupuesto era $97.0M.";
  ok(guardC(sinNada, { ledger: ledgerDe(sinNada, "Venta del negocio"), results: [], question: "" }).ok, "prosa sin marcas, sin tabla y sin subtotales no se ve afectada");
}

console.log(`\n── _respuesta_como_sistema_gate: ${pass} PASS · ${fail} FAIL (de ${pass + fail}) ──`);
process.exit(fail ? 1 : 0);
