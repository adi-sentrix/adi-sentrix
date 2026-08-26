/* === _plausibilidad_gate.mjs · ADI LEE EL ARCHIVO ANTES DE ANALIZARLO (owner 2026-08-23) ======================
 * LA IDEA, textual: «los clientes pueden subir errores en sus datos. Nosotros no nos hacemos cargo de ellos, pero
 * sí de la interpretación. Si todo el inventario está sobre 90 días, tal vez hay un error: ADI debería detectarlo
 * y decir "acabé de leer tus datos y noto ciertas alarmas, ¿son errores?, ¿continuamos así?". Y si el usuario dice
 * que sí porque lo quiere probar, ADI debe entenderlo.» Va ANTES de la primera respuesta, decisión suya.
 *
 * QUÉ NO ES: el validador. `validarPlantilla` tiene 22 chequeos y los 22 son de FORMA. Un archivo puede pasarlos
 * todos y describir un negocio imposible. Acá no se rechaza: se LEE.
 *
 * ⚠️ EL LISTÓN ALTO ES LA MITAD DEL DISEÑO. Si avisa por todo, el usuario aprende a ignorarlo — y un candado que
 * se ignora es peor que no tenerlo. Por eso la sección 3 prueba lo que NO debe sonar, con el archivo real que
 * llenó el owner: si su planilla legítima disparara una alarma, la función estaría mal.
 *
 * OFFLINE · módulos puros · no puede gastar. */
import { leerPlausibilidad, textoDeApertura, selloDeLaLectura, PROPORCION_SOSPECHOSA, MASA_MINIMA } from "./src/ingesta/plausibilidad.js";

let pass = 0, fail = 0;
const ok = (cond, label, detalle) => {
  if (cond) { pass++; console.log(`  ✓ ${label}`); }
  else { fail++; console.log(`  ✗ FALLO: ${label}${detalle !== undefined ? ` — ${detalle}` : ""}`); }
};
const U = { dohMax: 90, rotacionMin: 2 };
const tipos = (r) => r.alarmas.map((a) => a.tipo);

/* Un negocio verosímil: siete SKU, unos rápidos y otros lentos, todos con venta. Es la forma del archivo REAL que
 * el owner llenó a mano el 2026-08-23 (7 filas de inventario, días de 15.7 a 100, 2 de 7 sobre el techo). */
const SANO = {
  skuInventario: [
    { sku: "TV-55", doh: 32, stockUnd: 35 }, { sku: "REF-500", doh: 58, stockUnd: 22 },
    { sku: "MIC-32", doh: 31.9, stockUnd: 120 }, { sku: "BAT-20V", doh: 15.7, stockUnd: 46 },
    { sku: "LAV-12", doh: 93.3, stockUnd: 28 }, { sku: "ASP-ROBOT", doh: 100, stockUnd: 40 },
    { sku: "LAV-12b", doh: 66.4, stockUnd: 31 },
  ],
  skusMargen: [
    { nombre: "TV-55", unidades: 67, venta: 57155, costo: 40000, margen: 30 },
    { nombre: "REF-500", unidades: 29, venta: 45150, costo: 32000, margen: 29 },
    { nombre: "MIC-32", unidades: 113, venta: 25340, costo: 18000, margen: 29 },
    { nombre: "BAT-20V", unidades: 142, venta: 28400, costo: 20000, margen: 30 },
    { nombre: "LAV-12", unidades: 23, venta: 21150, costo: 15000, margen: 29 },
    { nombre: "ASP-ROBOT", unidades: 46, venta: 18520, costo: 13000, margen: 30 },
    { nombre: "LAV-12b", unidades: 9, venta: 8000, costo: 5600, margen: 30 },
  ],
};
const con = (cambios) => ({ ...SANO, ...cambios });

console.log("=".repeat(100));
console.log("1 · EL CASO DEL OWNER · se cargó el stock y se olvidaron las ventas del mes");
console.log("=".repeat(100));
{
  /* Sin venta suficiente, el stock «dura» una eternidad y TODOS los SKU cruzan el techo. Ese es el patrón. */
  const r = leerPlausibilidad(con({
    skuInventario: SANO.skuInventario.map((x) => ({ ...x, doh: 1000 })),
    skusMargen: SANO.skusMargen.map((s) => ({ ...s, unidades: 1 })),
  }), { umbrales: U });
  ok(tipos(r).includes("inventario-casi-todo-sobre-el-techo"), `suena la alarma (${tipos(r).join(" · ")})`);
  const t = textoDeApertura(r, { archivo: "Ventas_agosto.xlsx" });
  ok(/Acabo de leer Ventas_agosto\.xlsx/.test(t), "el texto ABRE nombrando el archivo que acaba de leer");
  ok(/7 de 7 SKU \(100%\)/.test(t), "…dice lo OBSERVADO con cifras, no «hay anomalías»");
  ok(/90 días de inventario que declaraste/.test(t), "…y contra el umbral que declaró el NEGOCIO, no uno inventado acá");
  ok(/\?/.test(t) && /¿Es así/.test(t), "…propone la causa como PREGUNTA: es una hipótesis sobre el archivo, no un diagnóstico");
  ok(/o seguimos con estos números tal como están/.test(t), "…y ofrece las dos salidas: corregir, o seguir igual");
}

console.log("\n" + "=".repeat(100));
console.log("2 · LAS OTRAS SEÑALES · cada una con su forma");
console.log("=".repeat(100));
{
  const r = leerPlausibilidad(con({ skusMargen: SANO.skusMargen.map((s) => ({ ...s, unidades: 0 })) }), { umbrales: U });
  ok(tipos(r).includes("stock-sin-ninguna-venta"), "stock sin una sola venta en el período");
}
{
  const r = leerPlausibilidad(con({ skuInventario: [{ sku: "OTRO-1", doh: 20, stockUnd: 5 }] }), { umbrales: U });
  ok(tipos(r).includes("venta-de-skus-que-no-estan-en-inventario"), "vendió SKU que no están en la hoja de inventario");
}
{
  const rotas = [...SANO.skusMargen];
  rotas[0] = { ...rotas[0], costo: 99999 };          // costo mayor que la venta
  rotas[1] = { ...rotas[1], margen: -12 };            // margen negativo
  const r = leerPlausibilidad(con({ skusMargen: rotas }), { umbrales: U });
  ok(tipos(r).includes("cifras-imposibles"), "costo mayor que la venta, o margen fuera de 0-100%");
  const a = r.alarmas.find((x) => x.tipo === "cifras-imposibles");
  ok(a.filas.length === 2, `nombra las filas concretas (${a.filas.join(", ")})`);
}
{
  /* LA SEÑAL QUE ESTUVO MUERTA UN RATO. Leía `historialMargen.filas`, que no existe —`historialMargen` es un
   * objeto—, así que jamás podía disparar: verde para siempre. Ahora el conteo lo pasa quien llama, y esto lo
   * prueba. Es exactamente el defecto que este repo lleva todo el día cazando: un cero que parece limpieza. */
  const sin = leerPlausibilidad(SANO, { umbrales: U });
  ok(!tipos(sin).includes("periodo-cargado-a-medias"), "sin el conteo por período, la señal no aplica (y no finge)");
  const con5 = leerPlausibilidad(SANO, { umbrales: U, filasPorPeriodo: { "2026-07": 2, "2026-08": 15 } });
  ok(tipos(con5).includes("periodo-cargado-a-medias"), "con el conteo, SÍ dispara: 2 filas contra 15");
  const t = textoDeApertura(con5, {});
  ok(/de la carga y no del negocio/.test(t), "…y explica por qué importa: la variación sería un artefacto");
}

console.log("\n" + "=".repeat(100));
console.log("3 · EL LISTÓN ALTO · lo que NO debe sonar, o el usuario aprende a ignorarlo");
console.log("=".repeat(100));
{
  const r = leerPlausibilidad(SANO, { umbrales: U });
  ok(!r.hayAlarmas, `el archivo REAL que llenó el owner no dispara nada (${tipos(r).join(" · ") || "cero alarmas"})`);
  ok(textoDeApertura(r, {}) === null, "…y sin alarmas no hay apertura: no se saluda con «no encontré problemas»");
}
{
  // dos SKU lentos no son una forma: son dos SKU lentos
  const chico = { skuInventario: [{ sku: "A", doh: 500 }, { sku: "B", doh: 400 }], skusMargen: [{ nombre: "A", unidades: 1 }, { nombre: "B", unidades: 1 }] };
  const r = leerPlausibilidad(chico, { umbrales: U });
  ok(!tipos(r).includes("inventario-casi-todo-sobre-el-techo"),
    `con ${chico.skuInventario.length} SKU no se diagnostica la forma del conjunto (masa mínima ${MASA_MINIMA})`);
}
{
  // algunos lentos ES un negocio: 2 de 7 no puede sonar
  const r = leerPlausibilidad(SANO, { umbrales: U });
  const sobre = SANO.skuInventario.filter((x) => x.doh > U.dohMax).length;
  ok(sobre / SANO.skuInventario.length < PROPORCION_SOSPECHOSA && !r.hayAlarmas,
    `${sobre} de ${SANO.skuInventario.length} sobre el techo es un negocio normal, no una alarma`);
}
{
  const r = leerPlausibilidad(SANO, { umbrales: {} });
  ok(!tipos(r).includes("inventario-casi-todo-sobre-el-techo"),
    "sin umbral declarado por el negocio no se inventa uno: la señal no aplica");
}

console.log("\n" + "=".repeat(100));
console.log("4 · LA ALARMA NO DESAPARECE PORQUE EL USUARIO DIJO QUE SÍ");
console.log("=".repeat(100));
/* La mitad que importa. Si ADI avisa y después presenta «$99K inmovilizado» como si nada, convirtió una
 * advertencia en una cifra confiada — lo que la proporcionalidad semántica prohíbe. El sello viaja pegado. */
{
  const r = leerPlausibilidad(con({ skuInventario: SANO.skuInventario.map((x) => ({ ...x, doh: 1000 })) }), { umbrales: U });
  const antes = selloDeLaLectura(r, { confirmado: false });
  const despues = selloDeLaLectura(r, { confirmado: true });
  ok(antes.conAlarmas === true && despues.conAlarmas === true, "el sello sigue diciendo que hubo alarmas, antes y después de confirmar");
  ok(antes.confirmadoPorElUsuario === false && despues.confirmadoPorElUsuario === true, "…y distingue si el usuario ya decidió seguir");
  ok(/confirmaste/.test(despues.nota), `la nota que acompaña a las cifras lo dice: «${despues.nota}»`);
  ok(selloDeLaLectura(leerPlausibilidad(SANO, { umbrales: U }), {}) === null, "sin alarmas no hay sello: nada que arrastrar");
}

console.log(`\n── _plausibilidad_gate: ${pass} PASS · ${fail} FAIL (de ${pass + fail}) ──`);
process.exit(fail === 0 ? 0 : 1);
