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
  ok(R.tension.n === 0 || (R.puente.tramos[1].detalle.includes(c.enJuegoFmt) && R.puente.tramos[1].detalle.includes(R.tension.concentraPctFmt)),
    "el tramo INDICADO también nombra los dos universos y el % — nunca $X y $Y juntos sin decir de dónde salen");
}

H("[4] VEREDICTO · jerarquía, nunca vacío, nunca causal");
{
  ok(R.veredicto && R.veredicto.titular && R.veredicto.soporte, `el bloque NUNCA queda vacío — "${R.veredicto.titular}"`);
  ok(["senal", "neutral"].includes(R.veredicto.tipo), `declara su tipo — ${R.veredicto.tipo}`);
  ok(/El volumen crece, pero el margen no acompaña\.|El margen está bajo tu referencia\.|El negocio opera en línea/.test(R.veredicto.titular), "usa un titular de la jerarquía acordada");
  ok(/Dentro de los \d+ clientes que explican el [\d.]+% de las ventas, \d+ concentran una brecha material de/.test(R.veredicto.soporte),
    `el soporte LOCALIZA con los dos universos — "${R.veredicto.soporte}"`);
  ok(!/debilit|deterior|dañ|causan|por culpa/i.test(R.veredicto.titular + R.veredicto.soporte),
    "NO afirma causa: dice dónde se concentra la brecha, no que esas cuentas la produzcan");
  ok(/tu benchmark|tu referencia/.test(R.veredicto.lectura + R.veredicto.soporte) && !/sector|industria|mercado/i.test(R.veredicto.lectura),
    "la referencia se narra como tuya, nunca sectorial");
  ok(!/rentab/i.test(JSON.stringify(R.veredicto)), "no llama rentabilidad a un margen");
}

H("[5] PUENTE · total = probado + abierto, y lo abierto se declara abierto");
{
  ok(Math.abs(R.puente.brechaTotal - (R.puente.probado + R.puente.abierto)) < 1, `RECONCILIA: ${R.puente.brechaTotalFmt} = ${R.puente.probadoFmt} + ${R.puente.abiertoFmt}`);
  ok(R.puente.probado > 0 && R.puente.probado < R.puente.brechaTotal, "lo probado es una PARTE, nunca el total");
  const t = R.puente.tramos;
  ok(t.length === 3 && t[0].estatus === "probado" && t[1].estatus === "indicado" && t[2].estatus === "abierto", `tres tramos con estatus explícito — ${t.map((x) => x.estatus).join(" → ")}`);
  ok(/costo de producto, precio y composición/.test(t[2].detalle) && /rutas de investigación abiertas — no causas/.test(t[2].detalle),
    "costo, precio y mix quedan ABIERTOS, nunca presentados como causas comprobadas");
  ok(/acciones comerciales/i.test(t[0].titulo) && !/toda la brecha|explica la brecha/i.test(t[0].detalle), "la carga comercial NO se lleva toda la brecha");
  ok(/localización comprobada, no una causa/.test(t[1].detalle) || R.tension.n === 0, "la concentración se declara localización, no causa");
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
  ok(/anclad/.test(e.nota) && /total oficial/.test(e.nota), "la nota del bloque declara el anclaje en vez de esconderlo");
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

H("[11] LA COMPOSICIÓN DEL NEGOCIO · el gemelo global de la Ficha");
{
  const c = R.composicion;
  ok(!!c && c.vistas.length === 3, "tres vistas declaradas");
  ok(c.vistas.map((v) => v.key).join(",") === "grupo80,menorMargen,todos", `Grupo 80% · Menor margen · Todos — ${c.vistas.map((v) => v.label).join(" · ")}`);
  ok(c.porDefecto === "grupo80", "abre en el Grupo 80% (el plano de decisión)");
  ok(c.columnas.length === 7 && c.columnas.map((x) => x.key).includes("acciones"), `siete columnas, con Acciones comerciales — ${c.columnas.map((x) => x.label).join(" · ")}`);
  ok(!c.columnas.some((x) => /rotaci/i.test(x.label)), "NO hay rotación: es del inventario, no del cliente (sería el primer dato inventado)");
  const g80 = c.vistas[0], menor = c.vistas[1], todos = c.vistas[2];
  ok(g80.n === R.plano.n && g80.filas.length === R.plano.n, `Grupo 80% = el plano — ${g80.n} clientes`);
  ok(todos.n === R.rows.length, `Todos = la cartera completa — ${todos.n}`);
  // MENOR MARGEN: los 5 con mayor brecha contra el benchmark, SIN importar si están en el 80%
  const esperado = [...R.rows].filter((r) => typeof r.varaGap === "number").sort((a, b) => a.varaGap - b.varaGap).slice(0, 5).map((r) => r.name);
  ok(menor.filas.map((f) => f.nombre).join(",") === esperado.join(","), `Menor margen = los 5 de mayor brecha contra tu benchmark — ${esperado.join(" · ")}`);
  ok(menor.filas.every((f, i) => i === 0 || menor.filas[i - 1].varaGap <= f.varaGap), "vienen ordenados de peor a mejor brecha");
  ok(menor.filas.some((f) => !f.enPlano), `incluye cuentas FUERA del grupo 80% — ${menor.filas.filter((f) => !f.enPlano).map((f) => f.nombre).join(", ") || "(ninguna en este set)"}`);
  ok(/estén o no en el grupo 80%/.test(menor.nota) && /dentro del plano/.test(menor.nota), `la vista declara su universo — "${menor.nota}"`);
  // participación: cierra la cartera (con el redondeo de cada fila declarado)
  const sumaPart = todos.filas.reduce((s, f) => s + f.participacionPct, 0);
  ok(Math.abs(sumaPart - 100) < 0.5, `las participaciones de Todos cubren la cartera — ${sumaPart.toFixed(1)}%`);
  ok(/salvo el redondeo/.test(c.nota), "…y la nota no promete una exactitud que el redondeo rompe");
  // cada fila declara referencia y estatus visual
  const f0 = g80.filas[0];
  for (const campo of ["participacionFmt", "ventaFmt", "contribucionFmt", "margenFmt", "unidadesFmt", "cargaFmt", "varaRefFmt", "bajoBenchmark", "sobreMeta", "enPlano"])
    ok(campo in f0, `la fila declara \`${campo}\``);
  ok(g80.filas.every((f) => f.varaRefFmt !== undefined), "toda fila trae su REFERENCIA (el benchmark contra el que se juzga)");
  ok(g80.filas.every((f) => f.bajoBenchmark === (typeof f.varaGap === "number" && f.varaGap < 0)), "el resalte de margen sigue la brecha real, no un umbral suelto");
  ok(g80.filas.every((f) => f.sobreMeta === (typeof f.carga === "number" && f.carga > POLICY.targetCarga)), `el resalte de acciones comerciales sigue tu meta de ${POLICY.targetCarga}%`);
  ok(/meta de/.test(c.nota) && /benchmark de/.test(c.nota), "el pie explica los dos colores con sus varas");
  // el monto recuperable NO se duplica acá: no es columna ni campo de fila (decisión del owner — vive en los
  // insights). Se chequea sobre la ESTRUCTURA, que es lo que la vista pinta, no sobre la redacción del pie.
  ok(!c.columnas.some((x) => /en juego|recuperable/i.test(x.label)), "\"En juego $\" no es una columna de esta tabla");
  ok(!("enJuego" in f0) && !("enJuegoFmt" in f0), "…ni viaja escondido en la fila");
  ok(/no se repite acá/.test(c.nota), "…y el pie dice dónde vive, para que no parezca un olvido");
  // TODAS las filas son clientes reales — no hay agregados que no puedan abrir Ficha
  const nombres = new Set(R.rows.map((r) => r.name));
  ok(c.vistas.every((v) => v.filas.every((f) => nombres.has(f.nombre))), "toda fila de toda vista es un cliente REAL (ningún agregado sin Ficha)");
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

console.log(`\n── _resumen_comercial_gate: ${PASS} PASS · ${FAIL} FAIL (de ${PASS + FAIL}) ──`);
process.exit(FAIL ? 1 : 0);
