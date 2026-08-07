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

console.log(`\n── _resumen_comercial_gate: ${PASS} PASS · ${FAIL} FAIL (de ${PASS + FAIL}) ──`);
process.exit(FAIL ? 1 : 0);
