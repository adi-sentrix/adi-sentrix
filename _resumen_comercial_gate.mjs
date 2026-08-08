/* === _resumen_comercial_gate.mjs · RESUMEN COMERCIAL · capa de datos (owner 2026-08-07) ==============
 *   [1] ALCANCE GLOBAL: se construye del negocio completo, sin recibir ninguna selección previa.
 *   [2] PLANO 80/20 dinámico y RECONCILIADO: grupo + cola = total, en ventas y en contribución.
 *   [3] DOS UNIVERSOS distintos y declarados: grupo 80% vs cuentas EN TENSIÓN (brecha material, no "bajo vara").
 *   [4] VEREDICTO con jerarquía: señal → neutral, nunca vacío, nunca causal.
 *   [5] PUENTE honesto: total = probado + abierto; costo/precio/mix quedan ABIERTOS.
 *   [6] INSIGHTS solo del grupo 80%, priorizados, con estatus de causa.
 *   [7] TOPE DEL GRÁFICO: 12 barras desktop / 8 móvil, con la línea acumulada calculada sobre TODAS las reales.
 *   [8] ESCALABILIDAD: sin hardcodeo de nombres ni cantidades; funciona con catálogos grandes.
 *   [9] CONSISTENCIA: cifras idénticas a las del cuadro (una sola verdad).
 * Cero red, cero LLM. `node _resumen_comercial_gate.mjs`
 */
import { buildResumenComercial, buildPareto } from "./src/adi/sentrix/resumenComercial.js";
import { buildCuadroMando } from "./src/adi/sentrix/cuadro.js";
import { POLICY } from "./src/config/businessPolicy.js";
import { getTenantData } from "./src/data/tenantStore.js";
const getHist = () => getTenantData()?.historialMargen || {};

let PASS = 0, FAIL = 0;
const ok = (c, m, extra = "") => { if (c) { PASS++; console.log("  ✓ " + m); } else { FAIL++; console.log("  ✗ " + m + (extra ? "\n      " + extra : "")); } };
const H = (t) => console.log("\n" + t);
const R = buildResumenComercial("actual");

H("[1] ALCANCE GLOBAL · el negocio completo, sin contaminación");
{
  ok(R && R.alcance === "negocio", `la vista se declara de alcance negocio — ${R && R.alcance}`);
  ok(buildResumenComercial.length <= 2, "la firma NO acepta una entidad seleccionada: no hay por dónde contaminarla");
  const a = JSON.stringify(buildResumenComercial("actual").veredicto);
  const b = JSON.stringify(buildResumenComercial("actual").veredicto);
  ok(a === b, "es determinística: dos construcciones dan el mismo veredicto");
  ok(R.rows.length === buildCuadroMando("cliente", "actual").rows.filter((x) => !x._total && !x._ref).length,
    `cubre TODOS los clientes del negocio — ${R.rows.length}`);
}

H("[2] PLANO 80/20 · dinámico y reconciliado");
{
  ok(R.plano.n > 0 && R.plano.n < R.rows.length, `grupo mínimo que explica ≥80% — ${R.plano.n} de ${R.rows.length} clientes (${R.plano.pct}%)`);
  ok(R.plano.pct >= 80, `el grupo alcanza o supera el 80% — ${R.plano.pct}%`);
  ok(R.plano.ventasGrupo + R.plano.ventasCola === R.total.ventas, `RECONCILIA: grupo ${R.plano.ventasGrupo}K + cola ${R.plano.ventasCola}K = total ${R.total.ventas}K`);
  ok(R.plano.colaN === R.rows.length - R.plano.n && Math.abs(R.plano.pct + R.plano.colaPct - 100) < 0.15, `la cola cierra el 100% — ${R.plano.colaN} clientes, ${R.plano.colaPct}%`);
  ok(/\d+ clientes que explican el [\d.]+% de las ventas/.test(R.plano.frase), `la frase declara X e Y dinámicos — "${R.plano.frase.slice(0, 90)}…"`);
  ok(!/\b7 clientes\b/.test(R.plano.frase.replace(String(R.plano.n), "N")), "X sale del dato, no de un 7 clavado");
  // contribución también reconcilia
  const cGrupo = R.plano.grupo.reduce((s, r) => s + (r.contribucion || 0), 0);
  const cCola = R.plano.cola.reduce((s, r) => s + (r.contribucion || 0), 0);
  ok(Math.abs(cGrupo + cCola - R.total.contribucion) <= 1, `contribución RECONCILIA: ${cGrupo}K + ${cCola}K ≈ ${R.total.contribucion}K`);
}

H("[3] DOS UNIVERSOS · grupo 80% vs cuentas en tensión");
{
  ok(R.tension.n <= R.plano.n, `las cuentas en tensión son un SUBCONJUNTO del plano — ${R.tension.n} de ${R.plano.n}`);
  ok(R.tension.lista.every((r) => R.plano.grupo.some((g) => g.name === r.name)), "ninguna cuenta en tensión viene de la cola");
  ok(R.tension.lista.every((r) => r.varaGap <= -POLICY.margenBrechaMaterial),
    `la vara es MATERIAL (${POLICY.margenBrechaMaterial} pp), no "bajo benchmark" — ${R.tension.lista.map((r) => `${r.name} ${r.varaGap}pp`).join(" · ")}`);
  const bajoVara = R.plano.grupo.filter((r) => typeof r.varaGap === "number" && r.varaGap < 0).length;
  ok(R.tension.n <= bajoVara, `hay ${bajoVara} bajo la vara pero solo ${R.tension.n} con brecha material — una diferencia chica NO cuenta`);
  ok(R.tension.enJuego === R.tension.lista.reduce((s, r) => s + (r.enJuego || 0), 0), "el monto en tensión es la suma de sus propias filas");
}

H("[3b] LOS DOS UNIVERSOS RECONCILIAN, Y LA VISTA LO DICE (owner 2026-08-07)");
{
  const c = R.tension.cartera;
  // el universo CARTERA usa el MISMO criterio de materialidad, sobre todo el negocio
  const materialCartera = R.rows.filter((r) => typeof r.varaGap === "number" && r.varaGap <= -POLICY.margenBrechaMaterial);
  ok(c.n === materialCartera.length, `la cartera material se calcula con la MISMA vara sobre todo el negocio — ${c.n} cuentas`);
  ok(c.n >= R.tension.n, `la cartera material CONTIENE al plano — ${c.n} en la cartera ⊇ ${R.tension.n} en el plano`);
  ok(R.tension.lista.every((r) => c.lista.some((x) => x.name === r.name)), "toda cuenta en tensión del plano también está en la cartera material");
  // RECONCILIACIÓN EXACTA: plano + cola = cartera, en cuentas y en plata
  ok(R.tension.n + c.colaN === c.n, `RECONCILIA en cuentas: ${R.tension.n} del plano + ${c.colaN} de la cola = ${c.n} de la cartera`);
  ok(R.tension.enJuego + c.colaEnJuego === c.enJuego, `RECONCILIA en plata: ${R.tension.enJuegoFmt} + ${c.colaEnJuegoFmt} = ${c.enJuegoFmt}`);
  ok(c.colaLista.every((r) => R.plano.cola.some((x) => x.name === r.name)), "la parte que no entra al plano está efectivamente en la cola");
  // EL PORCENTAJE ES DINÁMICO Y CORRECTO
  ok(typeof R.tension.concentraPct === "number" && Math.abs(R.tension.concentraPct - (R.tension.enJuego / c.enJuego) * 100) < 0.1,
    `el % de la oportunidad total que concentra el plano es dinámico y exacto — ${R.tension.concentraPctFmt}`);
  ok(R.tension.concentraPct <= 100.001, `nunca pasa del 100% — ${R.tension.concentraPct}`);
  // LA FRASE NOMBRA LOS DOS UNIVERSOS · nunca dos montos parecidos sueltos
  const f = R.tension.reconcilia;
  ok(!!f && /toda la cartera/i.test(f) && /plano de decisi[óo]n/i.test(f), `la frase NOMBRA los dos universos — "${f}"`);
  ok(f.includes(c.enJuegoFmt) && f.includes(R.tension.concentraPctFmt), "…y trae el monto de la cartera junto al % que el plano concentra");
  ok(c.colaN === 0 || f.includes(c.colaEnJuegoFmt), "…y declara lo que queda en la cola, para que la resta cierre a la vista");
  // el PUENTE declara SU universo (es un total distinto: incluye cuentas sin brecha material)
  ok(/toda la cartera/i.test(R.puente.universo) && /no llegan a serlo/i.test(R.puente.universo),
    `el total del puente declara su universo — "${R.puente.universo}"`);
  ok(R.puente.brechaTotal >= c.enJuego, `y es ≥ que el material, porque lo contiene — ${R.puente.brechaTotalFmt} ⊇ ${c.enJuegoFmt}`);
  ok(R.puente.materialFmt === c.enJuegoFmt && R.puente.materialN === c.n, "el puente publica la parte material con su cuenta, para que las dos cifras no queden sueltas");
  const indicado = R.puente.tramos.find((t) => t.estatus === "indicado");
  ok(R.tension.n === 0 || (indicado.detalle.includes(c.enJuegoFmt) && indicado.detalle.includes(R.tension.concentraPctFmt)),
    "el tramo INDICADO también nombra los dos universos y el % — nunca $X y $Y juntos sin decir de dónde salen");
  // LA LECTURA DE ALCANCE COMPACTA (owner 2026-08-07 · "una sola lectura de alcance"): breve, pero con los dos
  // universos nombrados igual — la brevedad no puede costar la claridad de universo.
  const rc = R.tension.reconciliaCorta;
  ok(!!rc && rc.length < R.tension.reconcilia.length, `hay una versión compacta — "${rc}"`);
  ok(/cartera completa/i.test(rc) && (/plano/i.test(rc) || c.colaN === 0), "…que sigue nombrando los dos universos");
  ok(c.n === 0 || rc.includes(c.enJuegoFmt), "…con el monto de la cartera");
  ok(c.colaN === 0 || (rc.includes(R.tension.concentraPctFmt) && rc.includes(c.colaEnJuegoFmt)), "…el % que concentra el plano y lo que queda en la cola");
}

H("[4] VEREDICTO · jerarquía, nunca vacío, nunca causal");
{
  ok(R.veredicto && R.veredicto.titular && R.veredicto.soporte, `el bloque NUNCA queda vacío — "${R.veredicto.titular}"`);
  ok(["senal", "neutral"].includes(R.veredicto.tipo), `declara su tipo — ${R.veredicto.tipo}`);
  ok(/El volumen crece, pero el margen no acompaña\.|El margen está bajo tu referencia\.|El negocio opera en línea/.test(R.veredicto.titular), "usa un titular de la jerarquía acordada");
  // UNA SOLA LECTURA DE ALCANCE (owner 2026-08-07): el soporte ES la declaración del plano — reemplazó a la banda
  // "Plano de decisión" y a la banda "Alcance", que decían lo mismo con otras palabras.
  ok(/^\d+ clientes explican el [\d.]+% de las ventas\. Dentro de ellos, \d+ concentran \$[\d.]+M de la brecha material\.$/.test(R.veredicto.soporte),
    `el soporte declara el alcance en UNA frase, con X, Y, N y $Z dinámicos — "${R.veredicto.soporte}"`);
  ok(R.veredicto.soporte.includes(String(R.plano.n)) && R.veredicto.soporte.includes(String(R.plano.pct)) && R.veredicto.soporte.includes(R.tension.enJuegoFmt),
    "…y esas cifras son las del plano y la tensión, no un texto paralelo");
  ok(!/debilit|deterior|dañ|causan|por culpa/i.test(R.veredicto.titular + R.veredicto.soporte),
    "NO afirma causa: dice dónde se concentra la brecha, no que esas cuentas la produzcan");
  // ⚠️ `veredicto.lectura` es null desde 2026-08-08 (repetía los 4 KPI). La garantía NO era de ese campo: es que
  // la referencia se narre como TUYA en la vista y jamás como sectorial. Se comprueba sobre los textos que quedaron.
  const _refs = [R.veredicto.soporte, R.sostiene.vistas[0].lectura, R.sostiene.nota, R.kpis[2].pie].filter(Boolean).join(" ");
  ok(/tu benchmark|tu referencia/.test(_refs) && !/sector|industria|mercado/i.test(_refs),
    "la referencia se narra como TUYA en la vista, nunca sectorial");
  ok(!/rentab/i.test(JSON.stringify(R.veredicto)), "no llama rentabilidad a un margen");
}

H("[5] PUENTE · total = probado + abierto, y lo abierto se declara abierto");
{
  ok(Math.abs(R.puente.brechaTotal - (R.puente.probado + R.puente.abierto)) < 1, `RECONCILIA: ${R.puente.brechaTotalFmt} = ${R.puente.probadoFmt} + ${R.puente.abiertoFmt}`);
  ok(R.puente.probado > 0 && R.puente.probado < R.puente.brechaTotal, "lo probado es una PARTE, nunca el total");
  const t = R.puente.tramos;
  const byEst = Object.fromEntries(t.map((x) => [x.estatus, x]));
  ok(t.length === 3 && byEst.probado && byEst.indicado && byEst.abierto, `tres tramos con estatus explícito — ${t.map((x) => x.estatus).join(" → ")}`);
  // ⚠️ PARTICIÓN vs LOCALIZACIÓN — probado + abierto = el total; el indicado es ESE MISMO dinero visto por
  // cuenta, no una tercera porción. Sin esta distinción la vista invita a sumar tres cifras que no suman.
  ok(byEst.probado.esParte === true && byEst.abierto.esParte === true && byEst.indicado.esParte === false,
    "la PARTICIÓN (probado + abierto) se distingue de la LOCALIZACIÓN (indicado)");
  ok(Math.abs(R.puente.probado + R.puente.abierto - R.puente.brechaTotal) < 1,
    `y las dos partes SUMAN el total — ${R.puente.probadoFmt} + ${R.puente.abiertoFmt} = ${R.puente.brechaTotalFmt}`);
  ok(/no es una tercera parte|no una causa ni una tercera porción/.test(byEst.indicado.detalle) || R.tension.n === 0,
    "el tramo indicado declara que NO es una tercera porción del total");
  ok(/se parte en dos/i.test(R.puente.particionNota) && /no es una tercera parte/i.test(R.puente.particionNota),
    `la nota de partición lo dice explícito — "${R.puente.particionNota}"`);
  ok(/costo de producto, precio y composición/.test(byEst.abierto.detalle) && /rutas de investigación abiertas — no causas/.test(byEst.abierto.detalle),
    "costo, precio y mix quedan ABIERTOS, nunca presentados como causas comprobadas");
  ok(/acciones comerciales/i.test(byEst.probado.titulo) && !/toda la brecha|explica la brecha/i.test(byEst.probado.detalle), "la carga comercial NO se lleva toda la brecha");
  ok(/localización comprobada, no una causa/.test(byEst.indicado.detalle) || R.tension.n === 0, "la concentración se declara localización, no causa");
}

H("[6] INSIGHTS · solo del plano, priorizados, con estatus de causa");
{
  ok(R.insights.length > 0, `hay insights — ${R.insights.length}`);
  ok(R.insights.every((i) => R.plano.grupo.some((g) => g.name === i.entidad)), "TODOS salen del grupo 80% — ninguno de la cola");
  const i0 = R.insights[0];
  for (const campo of ["entidad", "posVenta", "posMargen", "ventaFmt", "margenFmt", "brechaFmt", "enJuegoFmt", "estatusCausa", "razon"])
    ok(campo in i0, `el insight declara \`${campo}\``);
  ok(["probado", "abierto"].includes(i0.estatusCausa), `estatus de causa explícito — ${i0.estatusCausa}`);
  const scores = R.insights.map((i) => i._score);
  ok(scores.every((s, k) => k === 0 || scores[k - 1] >= s), "vienen priorizados (materialidad + deterioro + evidencia + acción)");
  ok(R.primera && R.primera.entidad === i0.entidad, `la primera profundización sugerida es la de mayor prioridad — ${R.primera.entidad}`);
  ok(R.insights.every((i) => !/revisar costo/i.test(i.razon)), "ninguno dice 'revisar costo' (el costo no está probado)");
  // FILAS DE DECISIÓN (owner 2026-08-07): acción concreta + qué falta aislar, cada una en una línea corta
  ok(R.insights.every((i) => i.accionCorta && i.faltaCorta), "cada uno trae su acción concreta y qué falta aislar, en corto");
  /* ⚠️ LA ACCIÓN SIGUE CORTA; EL PENDIENTE CRECIÓ A PROPÓSITO (owner 2026-08-08: «"falta separar costo precio",
   * ¿qué es eso? No se entiende»). Decía en tres palabras técnicas lo que hay que decir en una frase de castellano.
   * Acá la brevedad y la claridad tiran para lados opuestos y gana la claridad: un texto corto que nadie entiende
   * no es corto, es inútil. El techo sube solo para ese campo, y sigue existiendo para que no vuelva a ser un
   * párrafo. */
  ok(R.insights.every((i) => i.accionCorta.length < 90), "la acción sigue siendo una línea corta");
  ok(R.insights.every((i) => i.faltaCorta.length < 175 && !/composici[óo]n de la venta/i.test(i.faltaCorta)),
    "…y el pendiente se explica en castellano, sin la jerga de «separar composición»");
  ok(R.insights.filter((i) => i.estatusCausa === "probado").every((i) => /acciones comerciales/i.test(i.accionCorta)),
    "cuando hay causa medida, la acción nombra la palanca que SÍ está medida");
  ok(R.insights.filter((i) => i.estatusCausa === "abierto").every((i) => /aislar/i.test(i.accionCorta)),
    "cuando no la hay, la acción es ir a aislarla — no una causa inventada");
  // (el encabezado de "qué hacer primero" ya NO sale de los insights: sale del CRUCE de los dos deterioros y se
  //  verifica en la sección [9e], que es donde vive esa lógica.)
}

H("[7] TOPE DEL GRÁFICO · 12 desktop / 8 móvil, línea acumulada REAL");
{
  const desk = buildPareto(R.plano, "ventas", { maxEntidades: 10 });
  const mob = buildPareto(R.plano, "ventas", { maxEntidades: 6 });
  ok(desk.barras.length <= 12, `desktop ≤ 12 barras — ${desk.barras.length}`);
  ok(mob.barras.length <= 8, `móvil ≤ 8 barras — ${mob.barras.length}`);
  ok(desk.entidadesReales === R.rows.length, `la línea se calcula sobre TODAS las entidades reales — ${desk.entidadesReales}`);
  ok(desk.cruce80 && R.rows.some((r) => r.name === desk.cruce80), `el cruce del 80% es una entidad real — ${desk.cruce80}`);
  const suma = desk.barras.reduce((s, b) => s + b.valor, 0);
  ok(Math.abs(suma - desk.total) < 1, `las barras (con agregados) suman el total — ${suma} vs ${desk.total}`);
  ok(desk.barras[desk.barras.length - 1].acumuladoPct === 100 || !R.plano.colaN, "la última barra cierra en 100%");
  // caso sintético: cabeza grande → aparece "resto de la cabeza" y el tope se respeta igual
  const grande = { grupo: Array.from({ length: 40 }, (_, i) => ({ name: `C${i}`, ventas: 100 - i, contribucion: 20 })), cola: [{ name: "z", ventas: 5, contribucion: 1 }] };
  const g = buildPareto(grande, "ventas", { maxEntidades: 10 });
  ok(g.barras.length === 12 && g.barras.some((b) => b.tipo === "resto-cabeza") && g.barras.some((b) => b.tipo === "cola"),
    `40 clientes → 12 barras: 10 entidades + resto de cabeza + cola — ${g.barras.map((b) => b.tipo).join(",")}`);
  ok(g.agrupadas === 30, `declara cuántas agrupó — ${g.agrupadas}`);
  const gm = buildPareto(grande, "ventas", { maxEntidades: 6 });
  ok(gm.barras.length === 8, `móvil con 40 clientes → 8 barras — ${gm.barras.length}`);
  ok(Math.abs(g.barras.reduce((s, b) => s + b.valor, 0) - g.total) < 1, "y agrupar NO altera la aritmética");
}

H("[8] ESCALABILIDAD · sin hardcodeo");
{
  const src = (await import("node:fs")).readFileSync("src/adi/sentrix/resumenComercial.js", "utf8");
  for (const n of ["Falabella", "Lider", "Jumbo", "Sodimac", "Mercado Libre"]) ok(!src.includes(n), `el módulo NO menciona "${n}"`);
  // solo el CÓDIGO: el comentario de cabecera dice literalmente «nunca "7 de 13"» para explicar la regla, y la
  // primera versión de esta aserción se cazaba a sí misma leyendo esa explicación.
  const codigo = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  ok(!/\b(7|13)\b/.test(codigo), "no hay 7 ni 13 clavados en el código");
  ok(/concentracion\(/.test(src) && /POLICY\.margenBrechaMaterial/.test(src) && /POLICY\.targetCarga/.test(src),
    "usa el 80/20, la brecha material y la meta de carga DEL MOTOR — cero umbral nuevo");
  ok(/getTenantData/.test(src), "la variación sale del tenant activo, no del dataset demo");
  ok(!/0\.8[^0-9]/.test(src.replace(/umbral/g, "")) || /concentracion\(/.test(src), "el 80% es el de `concentracion`, no un literal propio");
}

H("[9] CONSISTENCIA · una sola verdad con el cuadro");
{
  const c = buildCuadroMando("cliente", "actual");
  ok(R.total.ventas === c.total.ventas && R.total.contribucion === c.total.contribucion, `totales idénticos al cuadro — ${R.total.ventas}K / ${R.total.contribucion}K`);
  const f = R.rows[0], cf = c.rows.find((x) => x.name === f.name);
  ok(f.enJuego === cf.enJuego && f.margen === cf.margen, `las filas son las MISMAS del cuadro (${f.name}: ${f.margen}% · ${f.enJuego})`);
  ok(R.insights.every((i) => { const row = R.rows.find((r) => r.name === i.entidad); return i.enJuego === row.enJuego; }), "el 'en juego' del insight es el mismo de su fila");
  ok(R.cuadro === c || R.cuadro.rows.length === c.rows.length, "la tabla completa sigue disponible como evidencia opcional");
}

H("[9a] UNA SOLA VERDAD POR FILA · cada % cierra con sus propios montos (owner 2026-08-07)");
{
  // ⚠️ EL DEFECTO QUE ESTO SELLA, cazado por el owner en vivo: la tabla de clientes mostraba Sodimac con 5.1% de
  // acciones comerciales y el bloque de abajo con 5.4%. Dos cifras del MISMO concepto — y eso, como dijo, destruye
  // la confianza en todo lo demás. La causa estaba en el dato: `applyScenarioToClientesMargen` re-derivaba
  // contribución y costo a la venta oficial pero dejaba `rebates` anclado a la venta vieja, así que
  // `rebates/venta` nunca daba el `pctRebate` declarado. Desde acá, TODO % de una fila tiene que cerrar con sus
  // propios montos, en los TRES escenarios: si vuelve a divergir, este gate lo caza antes que el owner.
  for (const esc of ["bonanza", "actual", "crisis"]) {
    const c = buildCuadroMando("cliente", esc);
    const malCarga = c.rows.filter((r) => typeof r.carga === "number" && Math.abs((r.acciones / r.ventas) * 100 - r.carga) > 0.06);
    const malMargen = c.rows.filter((r) => typeof r.margen === "number" && Math.abs((r.contribucion / r.ventas) * 100 - r.margen) > 0.06);
    ok(malCarga.length === 0, `[${esc}] acciones ÷ venta === la carga declarada, en las ${c.rows.length} filas${malCarga.length ? ` — divergen: ${malCarga.map((r) => `${r.name} ${((r.acciones / r.ventas) * 100).toFixed(2)}% vs ${r.carga}%`).join(" · ")}` : ""}`);
    ok(malMargen.length === 0, `[${esc}] contribución ÷ venta === el margen declarado, en las ${c.rows.length} filas`);
    // …y el total no es otra cosa: es la suma de las filas
    ok(Math.abs(c.rows.reduce((s, r) => s + (r.acciones || 0), 0) - c.total.acciones) < 1, `[${esc}] el total de acciones es la suma de las filas — ${c.total.acciones}K`);
    ok(Math.abs((c.total.acciones / c.total.ventas) * 100 - c.rows.reduce((s, r) => s + r.acciones, 0) / c.rows.reduce((s, r) => s + r.ventas, 0) * 100) < 0.02,
      `[${esc}] y el % del negocio sale de esos mismos montos — ${((c.total.acciones / c.total.ventas) * 100).toFixed(2)}%`);
  }
  // la vista consume UNA sola de esas cifras: el % que muestra la tabla de "quién sostiene" es el mismo que usa
  // el bloque de acciones comerciales
  const vCli = R.sostiene.vistas.find((v) => v.key === "cliente");
  for (const f of vCli.filas) {
    const row = R.rows.find((r) => r.name === f.nombre);
    ok(Math.abs(f.carga - row.carga) < 0.06, `${f.nombre}: la tabla y el dato dicen la MISMA carga — ${f.cargaFmt} / ${row.carga}%`);
  }
  const acc = R.deterioro.margen.acciones;
  for (const f of acc.referencias[0].filas) {
    const enTabla = vCli.filas.find((x) => x.nombre === f.nombre);
    ok(enTabla && Math.abs(enTabla.carga - f.carga) < 0.06, `${f.nombre}: el bloque de acciones y la tabla dicen lo MISMO — ${f.cargaFmt} / ${enTabla && enTabla.cargaFmt}`);
  }
}

H("[9b] QUIÉN SOSTIENE EL NEGOCIO · el 80% de cada eje, con su fuente declarada (owner 2026-08-07)");
{
  const S = R.sostiene;
  ok(!!S && S.vistas.length >= 2, `hay perspectivas del negocio — ${S && S.vistas.map((v) => v.key).join(" · ")}`);
  ok(S.vistas[0].key === "cliente" && S.vistas.some((v) => v.key === "familia"),
    "CLIENTES y FAMILIAS son las dos vistas que pidió el owner, con clientes por defecto");
  ok(S.vistas.some((v) => v.key === "sku") && S.vistas.some((v) => v.key === "canal"),
    "SKU y CANALES viven en el MISMO selector — no duplican pantalla");
  ok(S.columnas.map((c) => c.key).join(",") === "nombre,peso,venta,contribucion,margen,brecha,acciones",
    `siete columnas — ${S.columnas.map((c) => c.label).join(" · ")}`);
  ok(!S.columnas.some((c) => /rotaci/i.test(c.label)), "sin rotación: es del inventario, no de estos ejes");
  // LA LIMITACIÓN DECLARADA · el corte que se pidió y el dato no sostiene
  ok(/punto de venta no hay corte/i.test(S.limitacion) && /inventario, no venta/i.test(S.limitacion),
    `la limitación se declara en vez de inventar el corte — "${S.limitacion}"`);
  ok(!S.vistas.some((v) => /punto de venta|sucursal/i.test(v.label)), "…y no se ofrece un eje que no existe");
  for (const v of S.vistas) {
    ok(v.grupoN > 0 && v.grupoN <= v.n, `${v.label}: grupo 80% de ${v.grupoN} sobre ${v.n}`);
    ok(v.grupoPct >= 80 || v.grupoN === v.n, `${v.label}: el grupo alcanza el 80% — ${v.grupoPctFmt}`);
    ok(v.grupoN + v.colaN === v.n, `${v.label}: grupo + cola = total (${v.grupoN} + ${v.colaN} = ${v.n})`);
    ok(v.filas.filter((f) => f.enGrupo).length === v.grupoN, `${v.label}: las filas del grupo están marcadas`);
    ok(v.filas.every((f, i) => i === 0 || v.filas[i - 1].venta >= f.venta), `${v.label}: ordenadas por venta`);
    const suma = v.filas.reduce((s, f) => s + f.pesoPct, 0);
    ok(Math.abs(suma - 100) < 0.6, `${v.label}: los pesos cubren el corte — ${suma.toFixed(1)}%`);
    ok(v.filas.every((f) => f.varaFmt && typeof f.brecha === "number"), `${v.label}: cada fila trae su REFERENCIA y su brecha`);
    ok(v.filas.every((f) => f.material === (f.brecha <= -POLICY.margenBrechaMaterial)), `${v.label}: el resalte sigue la brecha material (${POLICY.margenBrechaMaterial} pp)`);
    ok(v.filas.every((f) => f.sobreMeta === (typeof f.carga === "number" && f.carga > POLICY.targetCarga)), `${v.label}: y las acciones comerciales, tu meta de ${POLICY.targetCarga}%`);
    // LA CALIDAD DEL DATO · cada eje dice si cierra con la venta oficial, y si no, cuánto
    ok(typeof v.reconcilia === "boolean" && !!v.notaFuente, `${v.label}: declara si concilia (${v.reconcilia}) y de dónde sale`);
    if (v.reconcilia) ok(Math.abs(v.totalVenta - R.total.ventas) / R.total.ventas < 0.001, `${v.label}: dice que concilia y ES cierto — ${v.totalVentaFmt}`);
    else ok(/de diferencia/.test(v.notaFuente) && /sin reescalar/.test(v.notaFuente),
      `${v.label}: dice cuánto NO cierra y que los márgenes no se tocaron — ${v.totalVentaFmt}`);
    ok(!!v.lectura && !/porque|se debe a|culpa/i.test(v.lectura), `${v.label}: la lectura localiza, no atribuye`);
    // SIN NOMBRES EN LA LECTURA (owner 2026-08-08): la tabla los nombra fila por fila y los pinta; repetirlos
    // arriba es decir dos veces lo mismo. La lectura aporta lo que la tabla NO da de un vistazo: cuántos ceden
    // y en qué rango. Se verifica contra los nombres REALES del corte, no contra una lista fija.
    const nombrados = v.filas.filter((f) => v.lectura.includes(f.nombre)).map((f) => f.nombre);
    ok(nombrados.length === 0, `${v.label}: la lectura NO nombra entidades — la tabla ya las nombra`, nombrados.join(", "));
    const nMat = v.filas.filter((f) => f.material && f.enGrupo).length;
    if (nMat > 0) ok(v.grupoN === 1 ? /, y queda /.test(v.lectura) : new RegExp(`^${nMat} de `).test(v.lectura),
      `${v.label}: dice CUÁNTOS ceden sin nombrarlos — "${v.lectura.slice(0, 74)}…"`);
    // CONCORDANCIA · un grupo de uno no puede decir "1 canal sostienen la venta": es la clase de detalle que
    // hace dudar de todo lo demás de la pantalla
    ok(v.grupoN === 1 ? / sostiene la venta/.test(v.lectura) : / sostienen la venta/.test(v.lectura),
      `${v.label}: el verbo concuerda con el grupo de ${v.grupoN}`);
  }
  // clientes y canales agrupan las MISMAS filas → cierran exacto por construcción
  for (const k of ["cliente", "canal"]) {
    const v = S.vistas.find((x) => x.key === k);
    if (v) ok(v.reconcilia && v.totalVenta === R.total.ventas, `${v.label}: agrupa las mismas filas del cuadro → cierra exacto (${v.totalVentaFmt})`);
  }
}

H("[9c] DÓNDE SE FRENA LA VENTA · solo contra una referencia AUTORIZADA (owner 2026-08-07)");
{
  const d = R.deterioro;
  ok(!!d && d.venta.referencias.length === 2, "dos referencias declaradas para la venta");
  const ppto = d.venta.referencias.find((x) => x.key === "presupuesto");
  const ant = d.venta.referencias.find((x) => x.key === "anterior");
  ok(!!ppto && !!ant, "presupuesto y período comparable");
  // EL PRESUPUESTO existe por cliente y NO permite descomponer precio/volumen (declara monto, no unidades)
  ok(ppto.descomponible === false, "contra el PRESUPUESTO no se ofrece precio/volumen: declara monto, no unidades");
  ok(/declara monto y no unidades/i.test(ppto.nota) && /no existe por familia/i.test(ppto.nota),
    `…y la nota explica por qué, y que el presupuesto no existe por familia — "${ppto.nota.slice(0, 90)}…"`);
  ok(ppto.filas.every((f) => !f.pv), "ninguna fila del presupuesto trae descomposición");
  // EL AÑO ANTERIOR sí trae unidades → la descomposición existe Y CIERRA EXACTA
  ok(ant.descomponible === true, "contra el AÑO ANTERIOR sí: trae venta y unidades");
  const conPV = ant.filas.filter((f) => f.pv);
  ok(ant.n === 0 || conPV.length > 0, `hay descomposición donde el dato la sostiene — ${conPV.length} de ${ant.n}`);
  ok(conPV.every((f) => f.pv.cierra), "volumen + precio = la diferencia, EXACTO en todas");
  ok(conPV.every((f) => ["volumen", "precio"].includes(f.pv.dominante)), "cada una declara cuál efecto pesa más");
  ok(/es aritmética, no una causa/i.test(ant.nota) || /Es aritmética, no una causa/.test(ant.nota),
    "la nota aclara que separar los efectos es aritmética, no una causa");
  // las dos listas ordenan por lo que falta, y la cifra cierra con su propia lista
  for (const r of [ppto, ant]) {
    ok(r.filas.every((f, i) => i === 0 || r.filas[i - 1].falta >= f.falta), `${r.label}: ordenadas por lo que falta`);
    ok(Math.abs(r.filas.reduce((s, f) => s + f.falta, 0) - r.faltaTotal) < 1, `${r.label}: el total es la suma de sus filas — ${r.faltaTotalFmt}`);
    ok(r.filas.every((f) => f.actual < f.referencia), `${r.label}: solo entran las que están por debajo`);
    ok(!!r.insight, `${r.label}: cierra con un insight — "${r.insight.slice(0, 80)}…"`);
  }
  ok(ppto.n === 0 || /por debajo de tu presupuesto/.test(ppto.insight), "el insight del presupuesto nombra su referencia");
  ok(ant.n === 0 || /del año anterior/.test(ant.insight), "y el del período comparable, la suya");
}

H("[9d] DÓNDE SE DILUYE EL MARGEN · bajo tu benchmark, con lo probado y lo abierto");
{
  const m = R.deterioro.margen;
  const material = R.rows.filter((r) => typeof r.varaGap === "number" && r.varaGap <= -POLICY.margenBrechaMaterial);
  ok(m.n === material.length, `las cuentas bajo tu benchmark son las del detector — ${m.n}`);
  ok(m.filas.every((f, i) => i === 0 || m.filas[i - 1].enJuego >= f.enJuego), "ordenadas por lo que está en juego");
  ok(Math.abs(m.enJuegoTotal - material.reduce((s, r) => s + (r.enJuego || 0), 0)) < 1, `el total es la suma de sus filas — ${m.enJuegoFmt}`);
  ok(m.filas.every((f) => f.estatus === (f.probado > 0 ? "probado" : "abierto")), "el estatus de cada fila sigue si hay o no causa medida");
  ok(m.filas.filter((f) => f.estatus === "probado").every((f) => f.sobreMeta && f.excesoFmt),
    "lo PROBADO es siempre el exceso medido de acciones comerciales sobre la meta");
  ok(!!m.insight && /contribución en juego/.test(m.insight), `cierra con un insight — "${m.insight.slice(0, 80)}…"`);
  ok(!/porque|se debe a/i.test(m.insight), "…que localiza, no atribuye");
  ok(/necesita aislarse entre costo, precio y composición/.test(m.insight) || m.n === 0,
    "…y declara qué queda abierto");
}

H("[9d2] LAS DOS CAUSAS DEL MARGEN · acciones comerciales y costo contra precio (owner 2026-08-07)");
{
  const a = R.deterioro.margen.acciones, c = R.deterioro.margen.costoPrecio;
  // ── A · ACCIONES COMERCIALES · contra DOS varas ──
  ok(!!a && a.referencias.length === 2, "las acciones comerciales se miden contra dos varas");
  const prom = a.referencias.find((x) => x.key === "promedio"), meta = a.referencias.find((x) => x.key === "meta");
  ok(!!prom && !!meta, "el promedio de tu cartera y tu meta declarada");
  // EL PROMEDIO ES PONDERADO (acciones ÷ venta del negocio), no el promedio simple de los %
  const tV = R.rows.reduce((s, r) => s + (r.ventas || 0), 0), tA = R.rows.reduce((s, r) => s + (r.acciones || 0), 0);
  ok(Math.abs(a.promedio - (tA / tV) * 100) < 0.011, `el promedio es PONDERADO por venta, no simple — ${a.promedioFmt}`);
  ok(a.meta === POLICY.targetCarga, `la meta es la del motor — ${a.metaFmt}`);
  for (const r of [prom, meta]) {
    const ref = r.key === "promedio" ? a.promedio : a.meta;
    const esperado = R.rows.filter((x) => typeof x.carga === "number" && x.carga > ref);
    ok(r.n === esperado.length, `${r.label}: ${r.n} cuentas por encima de ${r.refFmt}`);
    ok(r.filas.every((f) => f.exceso > 0), "…y todas las listadas entregan de más, ninguna de menos");
    const suma = r.filas.reduce((s, f) => s + f.recuperable, 0);
    ok(Math.abs(suma - r.total) < 1, `el recuperable es la suma de sus filas — ${r.totalFmt}`);
    // el recuperable de cada fila = exceso × su venta. Aritmética directa, sin factor inventado.
    ok(r.filas.every((f) => { const row = R.rows.find((x) => x.name === f.nombre); return Math.abs(f.recuperable - (f.exceso / 100) * row.ventas * 1000) < 1; }),
      `${r.label}: cada recuperable es exceso × venta de esa cuenta`);
    ok(r.filas.every((f, i) => i === 0 || r.filas[i - 1].recuperable >= f.recuperable), "…ordenadas por lo que vale cerrarlas");
    ok(!!r.nota, "…y la vara explica qué pregunta responde");
  }
  ok(meta.total >= prom.total || a.meta >= a.promedio, "la vara más exigente recupera más (o la meta ya está sobre el promedio)");
  ok(prom.n === 0 || /promedio de tu cartera|tu promedio/.test(a.lectura), `la lectura nombra el promedio — "${a.lectura.slice(0, 90)}…"`);
  ok(prom.n === 0 || (a.lectura.includes(prom.totalFmt) && a.lectura.includes(meta.totalFmt)), "…y da las DOS cifras, para que el owner elija su ambición");

  // ── B · COSTO CONTRA PRECIO · la variación, no el nivel ──
  ok(!!c, "hay lectura de costo contra precio");
  ok(c.n === R.rows.filter((r) => (getHist()[r.name] || []).length >= 2).length || c.n > 0, `${c.n} cuentas con serie mensual`);
  ok(!!c.desde && !!c.hasta && c.desde !== c.hasta, `compara de punta a punta del período — ${c.desde} → ${c.hasta}`);
  ok(c.filas.every((f) => typeof f.dCostoPct === "number" && typeof f.dPrecioPct === "number"), "cada cuenta declara cómo se movió su costo y su precio");
  ok(c.filas.every((f) => f.comprime === (f.efectoUni < 0)), "«comprime» = el margen por unidad se achicó, no un umbral suelto");
  // el efecto = (Δmargen unitario) × unidades. Verificable contra la serie cruda.
  ok(c.filas.every((f) => { const row = R.rows.find((x) => x.name === f.nombre); return Math.abs(f.efecto - f.efectoUni * (row.unidades || 0) * 1000) < 1; }),
    "el monto es el cambio de margen unitario por las unidades del período");
  ok(c.filas.every((f, i) => i === 0 || c.filas[i - 1].efecto <= f.efecto), "ordenadas: lo que más comprime, primero");
  // ⚠️ EL ESTATUS: es una VARIACIÓN de dos series propias, no el margen contable — va indicado, nunca probado
  ok(c.estatus === "indicado", `el efecto va INDICADO, no probado — ${c.estatus}`);
  ok(/variaci[óo]n/i.test(c.nota) && /no su nivel|no cierra/i.test(c.nota),
    "…y la nota explica por qué: el nivel no reconcilia, la variación sí");
  // la lectura dice la VERDAD del período, sin dramatizar ni inventar un problema que no hay
  ok(c.comprimenN > 0 ? /se comprimió/.test(c.lectura) : /no se comprimió|no estás perdiendo margen/.test(c.lectura),
    `la lectura sigue al dato — ${c.comprimenN} de ${c.n} comprimen: "${c.lectura.slice(0, 95)}…"`);
  ok(!/porque|se debe a|culpa/i.test(c.lectura), "…y describe el movimiento, no lo explica");
}

H("[9d3] EL OTRO LADO DEL PROMEDIO · los que entregan MENOS (owner 2026-08-07)");
{
  const a = R.deterioro.margen.acciones, b = a.bajo;
  ok(!!b, "el otro lado del promedio existe");
  const esperado = R.rows.filter((r) => typeof r.carga === "number" && r.carga < a.promedio);
  ok(b.n === esperado.length, `son los que entregan MENOS que el promedio — ${b.n} de ${R.rows.length}`);
  ok(b.n + a.referencias[0].n <= R.rows.length, "los dos lados no se superponen: o estás por encima o por debajo");
  ok(b.filas.every((f) => f.carga < a.promedio), "toda fila del otro lado entrega menos que el promedio");
  ok(b.filas.every((f, i) => i === 0 || b.filas[i - 1].holgura >= f.holgura), "ordenados por cuánta holgura tienen");
  // ⚠️ LA TRAMPA QUE ESTO EVITA: llevarlos al promedio sería ENTREGARLES MÁS, no capturar plata.
  ok(!("recuperable" in (b.filas[0] || {})) && !("totalFmt" in b),
    "NO se les calcula un 'recuperable': llevarlos al promedio sería darles más, no capturar");
  ok(/No son plata a capturar/.test(b.lectura) && /entregarles más/.test(b.lectura),
    `y la lectura lo dice explícito — "${b.lectura.slice(0, 90)}…"`);
  ok(/prueba/.test(b.lectura), "…y declara para qué SÍ sirven: son la prueba de que se puede vender entregando menos");
  ok(b.estatus === "abierto", `por qué operan más bajo queda ABIERTO — ${b.estatus}`);
  ok(b.filas.length === 0 || (b.menorNombre && b.menorFmt), `nombra al que menos entrega — ${b.menorNombre} ${b.menorFmt}`);
}

H("[9d4] VENDEN MUCHO PERO DEJAN POCO · la brecha partida en sus dos términos (owner 2026-08-07)");
{
  const q = R.deterioro.margen.porQue;
  ok(!!q, "el análisis existe");
  // el universo: los del grupo 80% (venden mucho) con margen bajo el promedio de la cartera
  const esperado = R.rows.filter((r) => R.plano.grupo.some((g) => g.name === r.name) && r.margen < q.margenProm);
  ok(q.n === esperado.length, `son los del grupo 80% bajo el promedio de margen (${q.margenPromFmt}) — ${q.n} de ${R.plano.n}`);
  ok(q.filas.every((f, i) => i === 0 || q.filas[i - 1].brecha <= f.brecha), "la peor brecha va primero");
  // ⚠️ LA ARITMÉTICA · la brecha se parte en DOS términos que suman EXACTO, sin residuo
  ok(q.filas.every((f) => f.cierra), "acciones + precio/costo = la brecha, EXACTO en todas");
  for (const f of q.filas) {
    const row = R.rows.find((x) => x.name === f.nombre);
    ok(Math.abs(f.brecha - (row.margen - q.margenProm)) < 0.02, `${f.nombre}: la brecha es su margen contra el promedio — ${f.brechaFmt}`);
    ok(Math.abs(f.efCarga - (parseFloat(q.cargaPromFmt) - row.carga)) < 0.02, `${f.nombre}: el término de acciones sale de su carga medida (${f.cargaFmt})`);
    ok(f.dominante === (Math.abs(f.efCarga) >= Math.abs(f.efCosto) ? "acciones" : "precio/costo"), `${f.nombre}: el término dominante es el de mayor peso — ${f.dominante}`);
  }
  // los dos diagnósticos son DISTINTOS y la vista los distingue
  ok(new Set(q.filas.map((f) => f.dominante)).size >= 1, `cada cuenta declara qué término pesa más — ${q.filas.map((f) => `${f.nombre}:${f.dominante}`).join(" · ")}`);
  ok(q.filas.filter((f) => f.dominante === "acciones").every((f) => /lo que le entregás/.test(f.lectura)),
    "cuando pesa el descuento, la lectura lo dice y da su carga contra la de la cartera");
  ok(q.filas.filter((f) => f.dominante === "precio/costo").every((f) => /no el descuento/i.test(f.lectura)),
    "cuando NO pesa el descuento, la lectura lo descarta explícitamente");
  // el CONTEXTO unitario separa "vende más barato" de "compra más caro"
  const conCtx = q.filas.filter((f) => f.contexto);
  ok(conCtx.length > 0, `hay contexto de precio y costo por unidad — ${conCtx.length} de ${q.n}`);
  ok(conCtx.every((f) => /vende .*(más caro|más barato)/i.test(f.contexto) && /compra .*(más caro|más barato)|costo por unidad/i.test(f.contexto)),
    "…que dice si vende más caro o más barato Y si su costo unitario es más alto o más bajo");
  ok(q.tickPromFmt !== "—" && q.costoUniPromFmt !== "—", `contra el promedio PONDERADO de la cartera — ticket ${q.tickPromFmt} · costo ${q.costoUniPromFmt}`);
  // PROPORCIONALIDAD: nunca se afirma que el costo ES la causa
  ok(q.estatus === "indicado", `el análisis va INDICADO — ${q.estatus}`);
  ok(q.filas.every((f) => !/su costo es el problema|por culpa|se debe a/i.test(f.lectura)), "ninguna lectura afirma que el costo sea la causa");
  ok(!q.filas.some((f) => f.dominante === "precio/costo") || /[Ff]alta separar cuánto es precio/.test(q.nota),
    "…y donde pesa el término de precio/costo, declara qué falta separar");
  ok(/causas distintas|dos problemas distintos/.test(q.lectura), `la lectura global cierra con la consecuencia — "${q.lectura.slice(-60)}"`);
}

H("[9e] QUÉ HACER PRIMERO · el cruce de los dos deterioros (owner 2026-08-07)");
{
  const P = R.prioridades, d = R.deterioro;
  ok(!!P, "hay prioridades");
  const bajoV = new Set(d.venta.referencias.find((x) => x.key === "presupuesto").filas.map((f) => f.nombre));
  const bajoM = new Set(d.margen.filas.map((f) => f.nombre));
  const esperado = (n) => (bajoV.has(n) && bajoM.has(n) ? "proteger" : bajoM.has(n) ? "recuperarMargen" : bajoV.has(n) ? "recuperarVenta" : null);
  // el cruce es EXACTO: cada cuenta cae donde su combinación de hechos manda
  for (const g of P.grupos) for (const f of g.filas)
    ok(esperado(f.entidad) === g.key, `${f.entidad} → ${g.key} (bajo venta: ${bajoV.has(f.entidad)} · bajo margen: ${bajoM.has(f.entidad)})`);
  const clasificadas = P.grupos.reduce((s, g) => s + g.filas.length, 0);
  const debieran = R.rows.filter((r) => esperado(r.name)).length;
  ok(clasificadas === debieran, `TODAS las cuentas con algún deterioro quedan clasificadas — ${clasificadas} de ${debieran}`);
  ok(P.grupos.every((g) => g.filas.every((f, i) => i === 0 || g.filas[i - 1].impacto >= f.impacto)), "dentro de cada grupo, ordenadas por impacto");
  // EL ERROR PELIGROSO · el grupo "proteger" va PRIMERO y su porqué es explícito
  const prot = P.grupos.find((g) => g.key === "proteger");
  if (prot) {
    ok(P.grupos[0].key === "proteger", "el grupo peligroso va PRIMERO");
    ok(prot.filas.every((f) => bajoV.has(f.entidad) && bajoM.has(f.entidad)), "y solo tiene cuentas que están bajo AMBOS deterioros");
    // EL AVISO DEL ERROR MÁS CARO, UNA SOLA VEZ (owner 2026-08-08 · "hay mucho texto"): vivía en el encabezado Y
    // en el porqué del grupo, palabra por palabra, a cinco centímetros de distancia. Ahora el gate exige que esté
    // EXACTAMENTE una vez: cero lo pierde, dos lo diluyen — y donde tiene que estar es arriba, que es lo primero
    // que se lee del bloque.
    const _aviso = (t) => (/agranda la brecha en vez de cerrarla/.test(t || "") ? 1 : 0);
    ok(_aviso(P.encabezado) === 1, "el encabezado advierte el error más caro: descontar donde el margen ya cede");
    ok(_aviso(P.encabezado) + _aviso(prot.porQue) === 1, "…y lo dice UNA sola vez: repetirlo a cinco centímetros lo diluye");
    ok(!!prot.porQue && prot.porQue.length > 20, `el grupo peligroso igual declara su porqué — "${prot.porQue}"`);
  } else {
    ok(!/agranda la brecha/.test(P.encabezado), "sin cuentas en el grupo peligroso, el encabezado NO advierte de un riesgo que no hay");
  }
  /* ── LA ACCIÓN Y EL PENDIENTE, UNA VEZ POR GRUPO (owner 2026-08-08) ────────────────────────────────────────
   * "En la lista de recuperar margen todas dicen lo mismo, revisar acciones comerciales etc. Es mejor un título,
   * dejar los clientes y con el pp que operan y lo que se recuperaría." Las cuatro filas repetían la MISMA frase
   * salvo por dos números: 40 palabras para encontrar 2 cifras. */
  for (const g of P.grupos) {
    const verbos = new Set(g.filas.map((f) => (f.accionCorta || "").split(":")[0].trim()));
    ok(verbos.size !== 1 || !!g.accionTitulo,
      `${g.label}: cuando todas comparten la acción, sube al título — "${g.accionTitulo}"`);
    ok(!g.accionTitulo || !/\d/.test(g.accionTitulo),
      `${g.label}: el título es el VERBO, sin el número que distingue a cada fila — "${g.accionTitulo}"`);
    const faltas = new Set(g.filas.map((f) => f.faltaCorta));
    ok(faltas.size !== 1 || g.faltaComun === [...faltas][0],
      `${g.label}: el pendiente también sube, una sola vez`);
    // Y CADA FILA CONSERVA LO QUE LA DISTINGUE: sin esto, "resumir" habría sido "borrar"
    ok(g.filas.every((f) => (f.cifras || []).length > 0),
      `${g.label}: ninguna fila queda sin una cifra propia que la justifique`);
    /* ⚠️ UNA SOLA REFERENCIA POR FILA (owner 2026-08-08: "¿cuál meta? No hables de metas"). Al pasar del target al
     * promedio de la cartera, la acción heredada del insight seguía midiendo contra la meta: Falabella mostraba
     * "entrega 1.0 pp de más" al lado de un "+0.42 pp sobre el promedio". Dos números del MISMO concepto en la
     * misma fila — el defecto de [9a] otra vez, ahora en el texto. El gate lo cierra: si la fila nombra un pp en
     * su acción, tiene que ser EL MISMO que muestra su cifra. */
    for (const f of g.filas) {
      ok(!/\bmeta\b/i.test(`${f.accionCorta} ${(f.cifras || []).map((c) => c.etiqueta).join(" ")}`),
        `${g.label} · ${f.entidad}: no habla de metas — la referencia es el promedio de su cartera`);
      const enAccion = (f.accionCorta.match(/([\d.]+) pp/) || [])[1];
      const enCifra = ((f.cifras || []).map((c) => c.valor).join(" ").match(/\+([\d.]+) pp/) || [])[1];
      ok(!enAccion || !enCifra || enAccion === enCifra,
        `${g.label} · ${f.entidad}: el pp de la acción y el de la cifra son el MISMO — ${enAccion} / ${enCifra}`);
    }
  }
  ok(P.grupos.every((g) => !!g.criterio && !!g.porQue), "cada grupo declara su criterio y su porqué");
  ok(P.grupos.every((g) => g.filas.every((f) => !!f.accionCorta && !!f.faltaCorta)), "cada fila trae su acción y qué falta aislar");
  const nombres = new Set(R.rows.map((r) => r.name));
  ok(P.grupos.every((g) => g.filas.every((f) => nombres.has(f.entidad))), "toda fila es una cuenta REAL");
}


H("[10] EL AÑO MES A MES · tres series que RECONCILIAN (owner 2026-08-07)");
{
  const e = R.evolutivo;
  ok(!!e && Array.isArray(e.series) && e.series.length === 3, `las TRES series están — ${e && e.series.map((s) => s.key).join(" · ")}`);
  ok(e.series.map((s) => s.key).join(",") === "actual,anterior,presupuesto", "este año · año anterior · presupuesto, en ese orden");
  // LA RECONCILIACIÓN QUE PEDÍA EL OWNER: el cierre del gráfico ES el total del negocio, no otro número parecido
  ok(e.totalActual === R.total.ventas, `el total del evolutivo ES el del negocio — ${e.totalActualFmt} === ${R.total.ventas}K`);
  ok(e.series[0].totalFmt === R.kpis[0].valor, `…y por lo tanto el MISMO que muestra el KPI de ventas — ${e.series[0].totalFmt}`);
  for (const s of e.series) {
    const suma = s.valores.reduce((a, v) => a + v, 0);
    ok(suma === s.total, `la serie "${s.key}" suma exactamente su total declarado — ${suma} === ${s.total}`);
    ok(s.valores.length === e.meses.length, `…y tiene un valor por mes (${s.valores.length})`);
  }
  ok(e.series[0].anclada && e.series[1].anclada && !e.series[2].anclada,
    "este año y el anterior se anclan a la venta oficial; el presupuesto NO — y se declara");
  ok(e.series[2].estatus === "indicado" && e.series[0].estatus === "probado",
    `el presupuesto es un plan (indicado), la venta real es dato (probado)`);
  ok(/no se ancla/i.test(e.series[2].nota) && /no existe presupuesto por cliente/i.test(e.series[2].nota), "la serie sin anclar explica POR QUÉ no se ancla");
  ok(/cierran con el KPI|anclad/i.test(e.nota) && /plan/i.test(e.nota), "la nota del bloque declara el anclaje y qué serie NO lo tiene");
  ok(typeof e.vsAnteriorPct === "number" && Math.abs(e.vsAnteriorPct - ((e.series[0].total - e.series[1].total) / e.series[1].total) * 100) < 0.06,
    `la variación se recalcula sobre las series ancladas — ${e.vsAnteriorFmt}`);
  ok(e.lectura.includes(e.maxMes) && e.lectura.includes(e.minMes), `la lectura nombra el mes más alto y el más bajo — ${e.maxMes} / ${e.minMes}`);
  ok(!/porque|debido a|causa/i.test(e.lectura), "la lectura DESCRIBE el movimiento del año, no lo explica (eso es el bloque 02)");
  // el defecto que esto cerró: la variación salía del tenant CRUDO, ajena al escenario
  const crisis = buildResumenComercial("crisis");
  ok(crisis.evolutivo.totalActual === crisis.total.ventas, `en crisis también reconcilia — ${crisis.evolutivo.totalActualFmt}`);
  ok(crisis.evolutivo.vsAnteriorPct < 0, `y la variación sigue al escenario, no al dato crudo — crisis: ${crisis.evolutivo.vsAnteriorFmt}`);
  ok(crisis.kpis[0].pie.includes(crisis.evolutivo.vsAnteriorFmt.replace("+", "")), "el pie del KPI y el evolutivo cuentan la MISMA variación");
}

H("[12] CÓMO SE FORMA EL MARGEN · la identidad, con el estatus de cada línea");
{
  const f = R.formacion;
  ok(!!f && f.lineas.length === 4, "cuatro líneas: venta · costo conciliado · acciones comerciales · contribución");
  ok(/Venta − Costo conciliado − Acciones comerciales = Contribución/.test(f.identidad), `la identidad se declara — "${f.identidad}"`);
  ok(f.cierra === true, "y CIERRA exacto sobre los totales del negocio");
  const by = Object.fromEntries(f.lineas.map((l) => [l.key, l]));
  ok(by.venta.montoFmt === R.kpis[0].valor, `la venta es la MISMA del KPI — ${by.venta.montoFmt}`);
  ok(by.contribucion.montoFmt === R.kpis[1].valor, `la contribución también — ${by.contribucion.montoFmt}`);
  ok(by.acciones.montoFmt === R.kpis[3].valor, `y las acciones comerciales — ${by.acciones.montoFmt}`);
  // EL PUNTO EPISTÉMICO: el costo NO está medido
  ok(by.costo.estatus === "indicado", `el costo se declara INDICADO — ${by.costo.estatus}`);
  ok(by.venta.estatus === "probado" && by.acciones.estatus === "probado" && by.contribucion.estatus === "probado", "las otras tres son dato medido (probado)");
  ok(/por diferencia/.test(by.costo.nota) && /nunca se afirma como causa/.test(by.costo.nota), `la nota del costo explica por qué no es una causa — "${by.costo.nota.slice(0, 80)}…"`);
  ok(/conciliado/i.test(by.costo.label), "hasta el nombre de la línea lo dice: costo CONCILIADO, no costo medido");
  ok(!/revisar costo|el costo explica|por estructura de costo/i.test(JSON.stringify(f)), "en ningún lado se presenta el costo como causa comprobada");
  // la aritmética, contra las cifras del cuadro
  const venta = R.total.ventas, contrib = R.total.contribucion, acc = R.total.acciones;
  ok(Math.abs((venta - contrib - acc) - (venta * (parseFloat(by.costo.pctFmt) / 100))) < venta * 0.001,
    `el % del costo sale de la misma resta — ${by.costo.pctFmt} de ${by.venta.montoFmt}`);
  ok(f.lectura.includes(by.costo.pctFmt) && f.lectura.includes(by.contribucion.pctFmt), `la lectura reparte el 100% de la venta — "${f.lectura}"`);
}

/* ── [13] LA CARTERA DE UNA SOLA MIRADA (owner 2026-08-08) ─────────────────────────────────────────────────────
 * "La lista completa de clientes, puede ser un top 10 con botón de ver todos: venta, participación, contribución,
 * margen, gap vs año anterior, gap vs ppto." Lo que este gate protege NO es que la tabla exista, sino que sus dos
 * gaps salgan de la MISMA venta que la propia tabla muestra, y que el total sea la suma de sus filas y no una cifra
 * traída de otra tabla. Es la misma clase de defecto que [9a]: dos caminos para un mismo concepto. */
H("[13] LA CARTERA · una sola mirada, y las dos referencias declaradas");
{
  const K = R.cartera;
  ok(!!K && K.filas.length === R.rows.length, `están TODAS las cuentas del negocio, no una muestra — ${K && K.filas.length} de ${R.rows.length}`);
  ok(K.columnas.map((c) => c.key).join(",") === "nombre,peso,venta,contribucion,margen,vsAnterior,vsPresupuesto",
    `las siete columnas que pidió el owner, en su orden — ${K.columnas.map((c) => c.label).join(" · ")}`);
  ok(K.tope === Math.min(10, K.filas.length) && K.resto === K.filas.length - K.tope,
    `el corte por defecto es el top ${K.tope}, con ${K.resto} en la cartera completa`);
  ok(/cartera completa \(\d+\)/.test(K.verTodosLabel), `y el botón declara cuántas hay detrás — "${K.verTodosLabel}"`);
  ok(K.resto > 0 ? K.resumenTope.includes(K.cubreFmt) : true, `dice qué % de la venta cubre lo que se ve — ${K.cubreFmt}`);
  // ORDEN: por venta descendente, sin excepción
  ok(K.filas.every((f, i) => i === 0 || K.filas[i - 1].venta >= f.venta), "las filas van por venta descendente");

  for (const sc of ["bonanza", "actual", "crisis"]) {
    const S = buildResumenComercial(sc), C = S.cartera;
    // LA VENTA DE LA FILA ES LA OFICIAL · la misma del cuadro, cliente por cliente
    const oficial = new Map(S.rows.map((r) => [r.name, r.ventas || 0]));
    const desalineadas = C.filas.filter((f) => Math.abs(f.venta - (oficial.get(f.nombre) || 0)) > 0.5);
    ok(desalineadas.length === 0, `[${sc}] cada fila muestra la venta OFICIAL de su cliente — 0 desalineadas de ${C.filas.length}`);
    // PARTICIPACIÓN Y TOTAL · la tabla cierra con el KPI de arriba
    const sv = C.filas.reduce((s, f) => s + f.venta, 0);
    ok(Math.abs(sv - S.total.ventas) < 0.5, `[${sc}] la venta de las filas suma el total del negocio — ${sv} = ${S.total.ventas}`);
    ok(C.total.ventaFmt === S.kpis[0].valor, `[${sc}] el total de la tabla ES el KPI de ventas — ${C.total.ventaFmt}`);
    ok(C.total.contribucionFmt === S.kpis[1].valor, `[${sc}] y su contribución también — ${C.total.contribucionFmt}`);
    ok(Math.abs(C.filas.reduce((s, f) => s + f.pesoPct, 0) - 100) < 0.3, `[${sc}] la participación reparte el 100% de la venta`);
    // CADA GAP SALE DE LA VENTA DE SU PROPIA FILA · la trampa de [9a], cerrada acá también
    const malGap = C.filas.filter((f) => {
      for (const g of [f.vsAnterior, f.vsPresupuesto]) {
        if (!g.hay) continue;
        if (Math.abs((f.venta - g.base) - g.monto) > 0.5) return true;
        if (Math.abs(+((g.monto / g.base) * 100).toFixed(1) - g.pct) > 0.05) return true;
      }
      return false;
    });
    ok(malGap.length === 0, `[${sc}] los dos gaps se calculan contra la venta de SU fila — 0 divergencias de ${C.filas.length}`);
    // EL TOTAL ES LA SUMA DE LAS FILAS, no un número de otra tabla
    const gA = C.filas.reduce((s, f) => s + (f.vsAnterior.hay ? f.vsAnterior.monto : 0), 0);
    const gP = C.filas.reduce((s, f) => s + (f.vsPresupuesto.hay ? f.vsPresupuesto.monto : 0), 0);
    ok(Math.abs(gA - C.total.vsAnterior.monto) < 0.5, `[${sc}] el gap total vs año anterior es la suma de las filas — ${Math.round(gA)}`);
    ok(Math.abs(gP - C.total.vsPresupuesto.monto) < 0.5, `[${sc}] y el gap total vs presupuesto también — ${Math.round(gP)}`);
    // Y COINCIDE CON EL PIE DEL KPI · el mismo % que ya declara la card de ventas
    const pieKpi = (S.kpis[0].pie.match(/-?[\d.]+%/) || [])[0];
    ok(pieKpi ? Math.abs(parseFloat(pieKpi) - C.total.vsAnterior.pct) < 0.15 : true,
      `[${sc}] el % del total coincide con el pie del KPI de ventas — ${C.total.vsAnterior.pctFmt} vs ${pieKpi}`);
    // LA FLECHA NUNCA CONTRADICE AL SIGNO · si el módulo dice "sube", el monto es positivo
    const flechaMiente = C.filas.concat([C.total]).filter((f) =>
      [f.vsAnterior, f.vsPresupuesto].some((g) => g.hay && ((g.dir === "sube" && g.monto < 0) || (g.dir === "baja" && g.monto > 0))));
    ok(flechaMiente.length === 0, `[${sc}] la dirección de la flecha nunca contradice el signo del monto`);
    // NI UN SOLO NOMBRE HARDCODEADO en los textos que la vista pinta
    ok(!/Falabella|Lider|Jumbo|Sodimac|Tottus|Paris|Mercado Libre/.test(`${C.lectura} ${C.resumenTope} ${C.nota}`),
      `[${sc}] los textos del bloque no nombran clientes fijos: salen del dato`);
  }

  // LAS DOS REFERENCIAS NO VALEN LO MISMO, y el sello lo dice
  const cA = R.cartera.columnas.find((c) => c.key === "vsAnterior");
  const cP = R.cartera.columnas.find((c) => c.key === "vsPresupuesto");
  ok(cA.estatus === "probado", `el año anterior va PROBADO: es dato cerrado — ${cA.estatus}`);
  ok(cP.estatus === "indicado", `el presupuesto va INDICADO: es un plan declarado, no una medición — ${cP.estatus}`);
  ok(/plan que declaraste/.test(R.cartera.nota) && /dato cerrado/.test(R.cartera.nota),
    "y la nota explica la diferencia en palabras, no solo con un color");
  ok(/venta oficial por cliente/i.test(R.cartera.nota) && R.cartera.nota.includes(R.kpis[0].valor),
    `la nota declara el universo y lo ancla al KPI — ${R.kpis[0].valor}`);
  // ⚠️ Y HABLA COMO EL PRODUCTO, NO COMO NOSOTROS (owner 2026-08-08: "ese cuadro es como interno nuestro").
  // Ningún término del andamiaje interno puede aparecer en texto que el usuario lee.
  const jerga = /escenario|reescrib|conciliad|reconcili|de otra tabla|hardcode|módulo|dataset|tenant/i;
  const visibles = [R.cartera.nota, R.cartera.notaAngosta, R.cartera.lectura, R.cartera.resumenTope];
  ok(visibles.every((t) => !jerga.test(t)), "los textos del bloque no usan jerga interna",
    visibles.filter((t) => jerga.test(t)).join(" | "));
  ok(R.cartera.nota.length < 260, `la nota es una nota, no un descargo — ${R.cartera.nota.length} caracteres`);
  // LA LECTURA DESCRIBE, NO ATRIBUYE: puede decir cuántas caen, jamás por qué
  ok(!/porque|debido a|causad|explica por/i.test(R.cartera.lectura), `la lectura no atribuye causa — "${R.cartera.lectura}"`);
  // EL ESCENARIO NO REESCRIBE EL PASADO: anterior y presupuesto son los mismos en los tres
  const bases = ["bonanza", "actual", "crisis"].map((sc) => {
    const C = buildResumenComercial(sc).cartera;
    return `${Math.round(C.total.vsAnterior.base)}/${Math.round(C.total.vsPresupuesto.base)}`;
  });
  ok(bases[0] === bases[1] && bases[1] === bases[2],
    `ningún escenario reescribe el año anterior ni el presupuesto — ${bases[0]} en los tres`);
  // Y EN CRISIS LA TABLA LO DICE: no puede quedar en verde un año que cae
  {
    const C = buildResumenComercial("crisis").cartera;
    ok(C.total.vsAnterior.dir === "baja" && C.total.vsAnterior.tono === "alerta",
      `en crisis el total cae y se declara como caída — ${C.total.vsAnterior.pctFmt}`);
    ok(C.filas.filter((f) => f.vsAnterior.dir === "baja").length > C.filas.length / 2,
      "y la mayoría de las cuentas cae con él: la tabla sigue al escenario, no al tenant crudo");
  }
}

/* ── [14] ECONOMÍA DEL TEXTO (owner 2026-08-08) ────────────────────────────────────────────────────────────────
 * "Hay mucho texto, eso puede marear al usuario. Conclusiones más cortas; si queda con dudas preguntará. Directo,
 * preciso, que se entienda fácil."
 *
 * Un techo por texto, no un total: el total se puede cumplir dejando un párrafo y borrando cinco etiquetas. Lo que
 * se protege es que NINGUNA conclusión suelta se vuelva un párrafo. Los números salen de lo que hoy mide cada una
 * con holgura, así que un texto que crece un 20% todavía pasa y uno que se duplica no. El detalle profundo no se
 * pierde: vive en los InfoDot, que se abren cuando el usuario los pide — que es exactamente lo que el owner dijo.
 */
H("[14] ECONOMÍA DEL TEXTO · conclusiones cortas, el detalle en el InfoDot");
{
  const techo = (ruta, t, max) => ok(typeof t === "string" && t.length <= max,
    `${ruta} ≤ ${max} — ${typeof t === "string" ? t.length : "?"}`, typeof t === "string" ? t : String(t));
  const d = R.deterioro, v = R.sostiene.vistas[0];
  techo("veredicto.soporte", R.veredicto.soporte, 130);
  techo("tension.reconciliaCorta", R.tension.reconciliaCorta, 110);
  techo("cartera.lectura", R.cartera.lectura, 110);
  techo("cartera.resumenTope", R.cartera.resumenTope, 80);
  techo("cartera.nota", R.cartera.nota, 180);
  techo("cartera.notaAngosta", R.cartera.notaAngosta, 70);
  techo("evolutivo.lectura", R.evolutivo.lectura, 130);
  techo("evolutivo.nota", R.evolutivo.nota, 110);
  techo("pareto.ventas.nota", R.pareto.ventas.nota, 80);
  techo("sostiene[0].lectura", v.lectura, 130);
  techo("sostiene[0].notaFuente", v.notaFuente, 200);
  techo("sostiene.nota", R.sostiene.nota, 120);
  techo("acciones.lectura", d.margen.acciones.lectura, 150);
  techo("acciones.bajo.lectura", d.margen.acciones.bajo.lectura, 190);
  techo("costoPrecio.lectura", d.margen.costoPrecio.lectura, 200);
  techo("costoPrecio.nota", d.margen.costoPrecio.nota, 90);
  techo("porQue.lectura", d.margen.porQue.lectura, 230);
  techo("porQue.nota", d.margen.porQue.nota, 90);
  techo("prioridades.encabezado", R.prioridades.encabezado, 160);
  // LAS FILAS SE MULTIPLICAN: una frase de 300 caracteres en cuatro filas son 1200 de una sola sentada. Por eso
  // llevan el techo más bajo de la vista, y se mide la PEOR, no el promedio.
  const peorFila = d.margen.porQue.filas.reduce((m, f) => Math.max(m, (f.lectura || "").length), 0);
  ok(peorFila <= 120, `la fila más larga de "venden mucho pero dejan poco" ≤ 120 — ${peorFila}`);
  for (const g of R.prioridades.grupos) {
    techo(`grupo[${g.key}].criterio`, g.criterio, 90);
    techo(`grupo[${g.key}].porQue`, g.porQue, 70);
  }
  // Y NADA DE ESTO PUEDE HABERSE LOGRADO BORRANDO LA CONCLUSIÓN: cada texto sigue diciendo algo
  const vacios = [R.cartera.lectura, R.evolutivo.lectura, v.lectura, d.margen.acciones.lectura,
    d.margen.costoPrecio.lectura, d.margen.porQue.lectura, R.prioridades.encabezado].filter((t) => !t || t.length < 25);
  ok(vacios.length === 0, "…y ninguna quedó vacía por recortar: todas siguen afirmando algo");
  // LA CIFRA QUE EL BLOQUE APORTA SIGUE EN SU LECTURA · recortar no puede llevarse el dato
  ok(R.cartera.lectura.includes(String(R.cartera.filas.filter((f) => f.vsPresupuesto.dir === "baja").length)),
    "la cartera sigue diciendo cuántas cuentas quedan bajo presupuesto");
  ok(d.margen.acciones.lectura.includes(d.margen.acciones.referencias[0].totalFmt),
    `las acciones comerciales siguen diciendo lo recuperable — ${d.margen.acciones.referencias[0].totalFmt}`);
  ok(R.evolutivo.lectura.includes(R.evolutivo.maxMes) && R.evolutivo.lectura.includes(R.evolutivo.minMes),
    `el evolutivo sigue nombrando el mes más alto y el más bajo — ${R.evolutivo.maxMes} / ${R.evolutivo.minMes}`);
  // LA LECTURA DE RESPALDO DEL VEREDICTO SE ELIMINÓ: repetía los cuatro KPI que van justo abajo
  ok(!R.veredicto.lectura, "la lectura de respaldo del veredicto ya no existe: era la copia literal de los 4 KPI");
}

console.log(`\n── _resumen_comercial_gate: ${PASS} PASS · ${FAIL} FAIL (de ${PASS + FAIL}) ──`);
process.exit(FAIL ? 1 : 0);
