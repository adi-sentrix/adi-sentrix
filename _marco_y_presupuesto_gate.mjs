/* === _marco_y_presupuesto_gate.mjs · NI AÑO QUE NO HAY, NI PLAN QUE NADIE DECLARÓ (owner 2026-08-29) ====
 *
 * DOS AFIRMACIONES FALSAS QUE EL PRODUCTO HACÍA SOBRE UNA PLANILLA REAL, y las dos aparecieron usándolo:
 *
 *   1. «AÑO CERRADO» estaba escrito a mano en 35 entradas del manifiesto. Era cierto para el negocio de
 *      demostración —doce meses— y falso para un archivo con julio y agosto. Y no es un rótulo: ese string
 *      viaja al contexto, a la dirección de cada cifra y a la BOLETA. Una cifra bien calculada, presentada
 *      como si cubriera un año que nadie informó.
 *   2. EL PRESUPUESTO salía «$0». Quedó fuera de la plantilla v1 por decisión del owner, así que para
 *      cualquier archivo cargado no existe nunca — y `suma([])` da cero. Cero no es «no hay»: dice que el
 *      plan del cliente era no vender, y de paso lo deja «cumpliendo» cualquier venta.
 *
 * ⚠️ LA CONDICIÓN DEL OWNER: «si el marco viaja a la boleta, que cambie completo, no solo el texto visible».
 * Por eso la sección 2 no mira la pantalla: mira lo que `manifestFor` entrega, que es de donde salen el
 * contexto y la boleta. Cambiar el rótulo y dejar el marco viejo viajando habría sido peor que no tocarlo.
 *
 * OFFLINE · módulos puros sobre datasets armados acá · no puede gastar. */
import { initTenant } from "./src/data/tenantStore.js";
import { TENANT_DEMO } from "./src/data/tenants/demo.js";
import { marcoDeVentas, resolverMarco, esMarcoDeAnio, mesesInformados, MARCO_ANIO, MARCO_PERIODO, MARCO_MES } from "./src/config/marcoPeriodo.js";
import { manifestFor, componentIds } from "./src/adi/sentrix/viewManifest.js";
import { etiquetaSinDeclarar } from "./src/config/moneda.js";

let pass = 0, fail = 0;
const ok = (cond, label, detalle) => {
  if (cond) { pass++; console.log(`  ✓ ${label}`); }
  else { fail++; console.log(`  ✗ FALLO: ${label}`); if (detalle !== undefined) console.log(`      ${detalle}`); }
};

/** Un negocio con N meses de historia, como el que produce una planilla cargada. */
const conMeses = (n) => {
  const mens = Array.from({ length: n }, (_, i) => ({ mes: `2026-${String(i + 1).padStart(2, "0")}`, actual: 100, anterior: 90 }));
  initTenant({ ...TENANT_DEMO, id: "prueba-marco", ventasMensuales: mens });
};

console.log("\n" + "=".repeat(100));
console.log("1 · EL MARCO SALE DEL DATO, NO DE UN LITERAL");
console.log("=".repeat(100));
{
  conMeses(12);
  ok(mesesInformados() === 12 && marcoDeVentas() === MARCO_ANIO, `doce meses siguen siendo «${MARCO_ANIO}»`);

  conMeses(2);
  ok(marcoDeVentas() === MARCO_PERIODO, `⚠️ dos meses NO son un año: «${marcoDeVentas()}»`);

  conMeses(1);
  ok(marcoDeVentas() === MARCO_MES, `un solo mes se nombra como tal: «${marcoDeVentas()}»`);

  conMeses(11);
  ok(marcoDeVentas() === MARCO_PERIODO, "once meses tampoco cierran un año");

  /* Sin historia con qué decidir, la afirmación MÁS CHICA. Decir «año cerrado» sin saberlo es justo lo que
   * hay que dejar de hacer. */
  initTenant({ ...TENANT_DEMO, id: "sin-historia", ventasMensuales: [] });
  ok(marcoDeVentas() === MARCO_PERIODO, "sin historia se declara período, no año: ante la duda, lo que el dato sostiene");
}

console.log("\n" + "=".repeat(100));
console.log("2 · EL MARCO CAMBIA COMPLETO · lo que viaja al contexto y a la boleta");
console.log("=".repeat(100));
{
  /* Esta es la condición del owner. `manifestFor` es el único acceso a una entrada del manifiesto, así que
   * lo que devuelve ES lo que llega a la dirección de la cifra y a la boleta. */
  conMeses(2);
  const conAnio = componentIds().filter((id) => {
    const e = manifestFor(id);
    return e && /a[nñ]o cerrado|año completo|12 meses del año/i.test(String(e.periodo || ""));
  });
  ok(conAnio.length === 0,
    `⚠️ con dos meses cargados NINGUNA entrada del manifiesto sigue afirmando un año (quedaban ${conAnio.length})`,
    conAnio.slice(0, 5).join(" · "));

  conMeses(12);
  const conAnio12 = componentIds().filter((id) => {
    const e = manifestFor(id);
    return e && /a[nñ]o cerrado/i.test(String(e.periodo || ""));
  });
  ok(conAnio12.length > 20, `…y con doce meses vuelven a decirlo, que es la verdad (${conAnio12.length} entradas)`);

  /* El inventario NO se toca: es una foto del stock, no un acumulado. Confundirlos ya fue un defecto real. */
  conMeses(2);
  const fotos = componentIds().filter((id) => /foto de inventario a hoy/i.test(String((manifestFor(id) || {}).periodo || "")));
  ok(fotos.length > 10, `la foto de inventario queda intacta (${fotos.length} entradas): no es un período acumulado`);

  /* Y la aclaración que acompaña al marco se conserva: se cambia lo que afirma el año, no la frase entera. */
  ok(resolverMarco("año cerrado · dato base, sin escenario") === `${MARCO_PERIODO} · dato base, sin escenario`,
    `la aclaración sobrevive al cambio de marco: «${resolverMarco("año cerrado · dato base, sin escenario")}»`);
  ok(resolverMarco("foto de inventario a hoy") === "foto de inventario a hoy", "…y lo que no afirma un año pasa intacto");
}

console.log("\n" + "=".repeat(100));
console.log("3 · EL PRESUPUESTO QUE NADIE DECLARÓ NO ES CERO");
console.log("=".repeat(100));
{
  const { composeResumenComercial } = await import("./src/adi/sentrix/resumenComercial.js").then((m) => ({
    composeResumenComercial: m.composeResumenComercial || null,
  })).catch(() => ({ composeResumenComercial: null }));

  /* La función que arma las series es interna; lo que se puede ejercer sin montar la vista entera es la regla
   * que la gobierna. Se comprueba el texto declarado y que NO sea un monto. */
  const texto = etiquetaSinDeclarar("presupuesto");
  ok(texto === "sin presupuesto declarado", `el texto es el que pidió el owner: «${texto}»`);
  ok(!/\d/.test(texto), "…y no contiene ninguna cifra: no se puede confundir con un monto");
  ok(!/\$|0/.test(texto), "…ni un símbolo ni un cero: «$0» es la afirmación que se está cerrando");

  /* Y que el código de la serie distinga DECLARADO de CERO, que es la trampa: un archivo sin presupuesto
   * produce una serie de ceros, y tratarla como plan declarado es exactamente el defecto. */
  const fs = await import("node:fs");
  const src = fs.readFileSync("./src/adi/sentrix/resumenComercial.js", "utf8");
  ok(/hayPresupuesto\s*=\s*Array\.isArray\(presupuesto\)\s*&&\s*presupuesto\.some/.test(src),
    "la serie distingue «declarado» de «una serie de ceros»");
  ok(/declarado: false[\s\S]{0,200}etiquetaSinDeclarar|etiquetaSinDeclarar[\s\S]{0,200}declarado: false/.test(src),
    "…y cuando no está declarado lo dice, en vez de formatear un cero");
  ok(/total: null, totalFmt: etiquetaSinDeclarar/.test(src),
    "⚠️ …y suelta el número: si el total siguiera ahí, cualquier consumidor que no mire `declarado` pintaría el cero igual");
}

console.log("\n" + "=".repeat(100));
console.log("4 · CARNADA · los chequeos tienen que poder ponerse rojos");
console.log("=".repeat(100));
{
  /* Si `resolverMarco` devolviera siempre lo mismo, la sección 2 estaría verde y ciega. */
  conMeses(2);
  const corto = resolverMarco("año cerrado");
  conMeses(12);
  const largo = resolverMarco("año cerrado");
  ok(corto !== largo, `el mismo literal se resuelve distinto según el dato: «${corto}» ≠ «${largo}»`);
  ok(largo === MARCO_ANIO && corto === MARCO_PERIODO, "…y cada uno al que corresponde: distingue, no cambia por cambiar");

  ok(esMarcoDeAnio("año cerrado") && !esMarcoDeAnio(MARCO_PERIODO) && !esMarcoDeAnio(MARCO_MES),
    "y `esMarcoDeAnio` separa los tres casos, que es lo que usa el narrador para elegir la frase");

  initTenant(TENANT_DEMO);   // el store se devuelve a su estado: no se contamina a nadie
}

console.log(`\n── _marco_y_presupuesto_gate: ${pass} PASS · ${fail} FAIL (de ${pass + fail}) ──`);
process.exit(fail === 0 ? 0 : 1);
