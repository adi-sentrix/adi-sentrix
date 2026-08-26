/* === _sello_en_respuesta_gate.mjs · ADI NOMBRA EL SELLO CUANDO CORRESPONDE (owner 2026-08-25) ================
 * LA REGLA, textual: «si el usuario confirmó una observación de plausibilidad, ADI puede responder; pero no debe
 * hablar como si el dato estuviera limpio; debe mencionar el sello cuando la respuesta use una métrica afectada
 * por esa observación. No quiero que lo repita en cada frase, pero sí que aparezca cuando corresponda:
 * comparaciones, variaciones, inventario o cualquier lectura afectada.»
 *
 * ⚠️ LA MITAD DIFÍCIL ES LO QUE **NO** DEBE SELLAR. Avisar siempre es tan inútil como no avisar nunca: el usuario
 * aprende a saltarse la línea y el sello deja de significar algo. Por eso la sección 2 pesa más que la 1 —prueba
 * once respuestas reales, y seis de ellas NO deben llevar sello— y por eso existe la distinción entre NOMBRAR una
 * métrica y USARLA: «puedo ayudarte con márgenes o inventario» nombra dos y no afirma ninguna.
 *
 * ⚠️ EL CANDADO ANTI-DERIVA (sección 1) es lo que impide que esto se pudra solo: una señal de plausibilidad nueva
 * sin alcance declarado nacería MUDA —jamás se mencionaría— y nadie lo notaría, porque no hay error, solo
 * silencio. Es la misma clase de defecto que este repo ya cazó siete veces.
 *
 * OFFLINE · módulos puros + lectura de fuentes · no puede gastar. */
import { readFileSync } from "node:fs";
import { initTenant } from "./src/data/tenantStore.js";
import { TENANT_DEMO } from "./src/data/tenants/demo.js";
initTenant(TENANT_DEMO);
import { leerPlausibilidad, selloDeLaLectura, DOMINIOS_POR_ALARMA } from "./src/ingesta/plausibilidad.js";
import { dominiosDeLaRespuesta, mencionDelSello, anteponerSello, enLaCarpeta, observacionesQueAlcanzan, VOCABULARIO } from "./src/ingesta/selloEnRespuesta.js";
import { getSelloDeCarga, setCargaActiva, limpiarCarga, getArchivoActivo } from "./src/ingesta/estadoCarga.js";
import { proyectarDatoNegocio } from "./src/adi/oracle/datoProyectado.js";

let pass = 0, fail = 0;
const ok = (cond, label, detalle) => {
  if (cond) { pass++; console.log(`  ✓ ${label}`); }
  else { fail++; console.log(`  ✗ FALLO: ${label}${detalle !== undefined ? ` — ${detalle}` : ""}`); }
};
const selloDe = (tipos, confirmado = true) =>
  selloDeLaLectura({ hayAlarmas: true, alarmas: tipos.map((t) => ({ tipo: t })) }, { confirmado });

console.log("=".repeat(100));
console.log("1 · CANDADO ANTI-DERIVA · una señal sin alcance declarado nacería MUDA y nadie lo notaría");
console.log("=".repeat(100));
{
  /* Se provocan las CINCO señales de verdad, con datos armados para dispararlas, en vez de copiar una lista de
   * nombres a mano: una lista se desactualiza en silencio, un disparo real no. */
  const inv = Array.from({ length: 8 }, (_, i) => ({ sku: `S${i}`, doh: 900, stockUnd: 10 }));
  const provocadas = new Set();
  const juntar = (r) => r.alarmas.forEach((a) => provocadas.add(a.tipo));
  juntar(leerPlausibilidad({ skuInventario: inv, skusMargen: inv.map((x) => ({ nombre: x.sku, unidades: 0, venta: 10, costo: 5, margen: 30 })) }, { umbrales: { dohMax: 90 } }));
  juntar(leerPlausibilidad({ skuInventario: [{ sku: "OTRO", doh: 10 }], skusMargen: inv.map((x) => ({ nombre: x.sku, unidades: 5, venta: 10, costo: 5, margen: 30 })) }, { umbrales: { dohMax: 90 } }));
  juntar(leerPlausibilidad({ skuInventario: inv, skusMargen: [{ nombre: "S0", unidades: 5, venta: 10, costo: 99, margen: 30 }] }, { umbrales: { dohMax: 90 } }));
  juntar(leerPlausibilidad({ skuInventario: inv, skusMargen: inv.map((x) => ({ nombre: x.sku, unidades: 5, venta: 10, costo: 5, margen: 30 })) }, { umbrales: { dohMax: 90 }, filasPorPeriodo: { a: 2, b: 15 } }));

  ok(provocadas.size >= 5, `se dispararon ${provocadas.size} señales distintas para revisarlas de verdad`, [...provocadas].join(" · "));
  const sinAlcance = [...provocadas].filter((t) => !DOMINIOS_POR_ALARMA[t]);
  ok(sinAlcance.length === 0, "TODA señal que puede dispararse tiene su alcance declarado", sinAlcance.join(", "));
  const sinFrase = [...provocadas].filter((t) => !(DOMINIOS_POR_ALARMA[t] || {}).enUnaLinea);
  ok(sinFrase.length === 0, "…y su frase para decirla en voz alta", sinFrase.join(", "));
  const dominiosDesconocidos = Object.entries(DOMINIOS_POR_ALARMA)
    .flatMap(([t, d]) => (d.dominios || []).filter((x) => !VOCABULARIO[x]).map((x) => `${t}→${x}`));
  ok(dominiosDesconocidos.length === 0,
    "…y apunta a un dominio que el detector sabe reconocer: un alcance sin vocabulario también sería mudo",
    dominiosDesconocidos.join(", "));
}

console.log("\n" + "=".repeat(100));
console.log("2 · CUÁNDO SÍ Y CUÁNDO NO · seis de estas once respuestas NO deben llevar sello");
console.log("=".repeat(100));
{
  const s = selloDe(["periodo-cargado-a-medias", "cifras-imposibles"]);
  const casos = [
    ["una comparación con cifra", "La venta cayó 12% contra el mes anterior.", true, []],
    ["una lectura de margen", "La Polar tiene el mejor margen: 34%.", true, []],
    ["una tabla de margen", "Cliente | Margen\nLa Polar | 34%\nFalabella | 22%", true, []],
    ["una tabla en markdown", "| Cliente | Margen |\n| La Polar | 34% |", true, []],
    ["un cálculo declarado en pp", "Ahí lo tienes.", true, [{ op: "resta", unidad: "pp", linea: "id=var · op=resta · resultado=1.8 pp" }]],
    // ── y las que NO ─────────────────────────────────────────────────────────────────────────────────────────
    ["inventario, que estas observaciones NO alcanzan", "Tienes $33K inmovilizado en 3 SKU.", false, []],
    ["un menú que NOMBRA métricas sin usar ninguna", "Puedo ayudarte con ventas, márgenes o inventario. ¿Por dónde partimos?", false, []],
    ["una declinación honesta", "No tengo el historial por cliente y SKU, así que no puedo responder eso.", false, []],
    ["una pregunta de vuelta", "¿Te interesa por cliente o por marca?", false, []],
    ["una tabla de una métrica no tocada", "Cliente | Venta\nLa Polar | $3.100", false, []],
    ["un saludo", "Hola, soy ADI.", false, []],
  ];
  for (const [que, texto, esperado, calculos] of casos) {
    const sella = anteponerSello(texto, s, { calculos }) !== texto;
    ok(sella === esperado, `${esperado ? "SELLA" : "no sella"}: ${que}`);
  }
}

console.log("\n" + "=".repeat(100));
console.log("3 · SOLO LA INTERSECCIÓN · se nombra la observación que alcanza, no todas las del archivo");
console.log("=".repeat(100));
{
  const s = selloDe(["periodo-cargado-a-medias", "cifras-imposibles", "stock-sin-ninguna-venta"]);
  const m = mencionDelSello(s, { texto: "Tienes 4 SKU con 120 días de inventario." });
  ok(!!m && /stock pero ninguna venta/.test(m), `una lectura de inventario nombra la de inventario: «${m}»`);
  ok(!!m && !/filas cargadas/.test(m) && !/costo mayor/.test(m),
    "…y NO arrastra las otras dos: la letra chica completa es la que nadie lee");
  const m2 = mencionDelSello(s, { texto: "La venta cayó 12% contra el mes anterior." });
  ok(!!m2 && /filas cargadas/.test(m2) && !/stock pero ninguna venta/.test(m2),
    "y una comparación nombra la del período, tampoco las otras");
  ok(observacionesQueAlcanzan(s, []).length === 0, "sin dominios no alcanza ninguna: no se sella por las dudas");
}

console.log("\n" + "=".repeat(100));
console.log("4 · LA FRASE · la que escribió el owner, y sin vocabulario prohibido");
console.log("=".repeat(100));
{
  const m = mencionDelSello(selloDe(["periodo-cargado-a-medias"]), { texto: "La venta cayó 12% contra el mes anterior." });
  ok(/^Sobre los datos que confirmaste, con la observación de que /.test(m), `abre como él la escribió: «${m}»`);
  ok(/el período anterior tiene menos filas cargadas/.test(m), "…y nombra la observación con su ejemplo textual");
  const sinConfirmar = mencionDelSello(selloDe(["periodo-cargado-a-medias"], false), { texto: "La venta cayó 12%." });
  ok(/sin resolver/.test(sinConfirmar || ""), "y si el usuario NO confirmó, lo dice distinto — no se le atribuye una decisión que no tomó");
  /* El registro ejecutivo rige también acá: la frase va en pantalla, así que pasa por las mismas prohibiciones. */
  const prohibidas = ["plata", "vara", "dormido", "guita", "palanca", "apretar"];
  const todas = Object.values(DOMINIOS_POR_ALARMA).map((d) => d.enUnaLinea).join(" ").toLowerCase();
  ok(!prohibidas.some((p) => todas.includes(p)), "ninguna frase usa vocabulario prohibido en superficie");
  ok(!/\bvos\b|\bsos\b|confirmaste vos|declaraste vos/.test(todas + " " + m), "y ninguna cae en voseo");
}

console.log("\n" + "=".repeat(100));
console.log("5 · NO SE REPITE · el cerebro ya lo dijo, o no hay nada que decir");
console.log("=".repeat(100));
{
  const s = selloDe(["periodo-cargado-a-medias"]);
  const yaDicho = "Sobre tus datos, teniendo en cuenta que el período anterior tiene menos filas cargadas, la venta cayó 12%.";
  ok(anteponerSello(yaDicho, s) === yaDicho, "si el cerebro ya nombró la observación, el cerrojo no la repite");
  const limpio = "La venta cayó 12% contra el mes anterior.";
  ok(anteponerSello(limpio, null) === limpio, "sin sello activo el texto sale intacto (el caso normal: el demo)");
  ok(mencionDelSello(null, { texto: limpio }) === null, "…y no hay mención que inventar");
  const puesto = anteponerSello(limpio, s);
  ok(puesto.split("\n\n").length === 2 && puesto.endsWith(limpio),
    "cuando sí corresponde, va UNA vez y al principio — la respuesta queda entera debajo");
}

console.log("\n" + "=".repeat(100));
console.log("6 · LA CAPA DE DOCTRINA · el cerebro recibe el sello en la carpeta, no un reto en el prompt fijo");
console.log("=".repeat(100));
{
  ok(enLaCarpeta(null) === "", "sin sello, la carpeta no dice nada: el demo no paga ni un token por esto");
  const b = enLaCarpeta(selloDe(["periodo-cargado-a-medias"]));
  ok(/OBSERVACIONES SOBRE ESTE ARCHIVO/.test(b), "con sello, la carpeta lo declara como sección propia");
  ok(/eligió seguir igual/.test(b) && /Puedes responder con ellos/.test(b),
    "…y le dice que PUEDE responder: la observación no lo paraliza");
  ok(/NO hables como si el dato estuviera limpio/.test(b), "…con la regla del owner, textual");
  ok(/no lo repitas en cada oración/.test(b), "…incluido el límite que él puso: una vez, no en cada frase");
  ok(/afecta: comparacion/.test(b), "…y el alcance de cada observación, para que no lo adivine");
}

console.log("\n" + "=".repeat(100));
console.log("7 · EL ESTADO · el sello vive en un módulo y se limpia al volver al demo");
console.log("=".repeat(100));
{
  ok(getSelloDeCarga() === null, "de arranque no hay archivo del usuario: corre el demo");
  ok(!/OBSERVACIONES SOBRE ESTE ARCHIVO/.test(proyectarDatoNegocio("actual")),
    "…y la carpeta del demo sale limpia");
  setCargaActiva(selloDe(["periodo-cargado-a-medias"]), { nombre: "mio.xlsx", empresa: "Andina" });
  ok(!!getSelloDeCarga(), "al activar un archivo, el sello queda registrado");
  ok(getArchivoActivo().nombre === "mio.xlsx", "…junto con qué archivo es");
  ok(/OBSERVACIONES SOBRE ESTE ARCHIVO/.test(proyectarDatoNegocio("actual")),
    "…y la carpeta que viaja al cerebro lo lleva");
  limpiarCarga();
  ok(getSelloDeCarga() === null && getArchivoActivo() === null, "volver al demo lo borra");
  ok(!/OBSERVACIONES SOBRE ESTE ARCHIVO/.test(proyectarDatoNegocio("actual")),
    "…y la carpeta vuelve a salir limpia: arrastrar la observación hablaría de un archivo que ya no está activo");
}

console.log("\n" + "=".repeat(100));
console.log("8 · CABLEADO EN EL CAMINO NATURAL · y DESPUÉS del muro, que es donde corresponde");
console.log("=".repeat(100));
{
  const src = readFileSync("./src/adi/oracle/caminoNatural.js", "utf8");
  ok(/anteponerSello\(/.test(src), "el camino natural aplica el cerrojo");
  const iMuro = src.indexOf("await responderConNotario");
  const iSello = src.indexOf("anteponerSello(textoPantalla");
  ok(iMuro > 0 && iSello > iMuro,
    `va DESPUÉS del notario (${iMuro} < ${iSello}): la frase no afirma nada del negocio, no hay qué verificar`);
  ok(/anteponerSello\(textoPantalla, getSelloDeCarga\(\), \{ calculos: ex\.calculos \}\)/.test(src),
    "…y se le pasan los cálculos declarados, no solo la prosa");
  const dato = readFileSync("./src/adi/oracle/datoProyectado.js", "utf8");
  ok(/enLaCarpeta\(getSelloDeCarga\(\)\)/.test(dato), "y la carpeta suma el bloque de doctrina");
  ok(/const base = _cacheado/.test(dato),
    "…FUERA del caché: dentro serviría la observación de un archivo que ya no está activo");
  const app = readFileSync("./src/ui/App.jsx", "utf8");
  ok(/registrarCarga\(sello, quien\)/.test(app) && /limpiarCarga\(\)/.test(app),
    "y la pantalla registra y limpia por el módulo, no por un global del navegador");
  ok(!/__ADI_SELLO_CARGA__/.test(app), "…el global de apuro ya no existe");
}

console.log("\n" + "=".repeat(100));
console.log("9 · CARNADA · estos chequeos tienen que poder ponerse rojos");
console.log("=".repeat(100));
{
  /* Sin esto, todo lo de arriba podría estar verde y ciego — pasó cinco veces en este repo. Se fabrica un sello
   * con el alcance EQUIVOCADO y se comprueba que el detector lo delata en las dos direcciones. */
  const torcido = { conAlarmas: true, confirmadoPorElUsuario: true, tipos: ["x"],
    observaciones: [{ tipo: "x", dominios: ["inventario"], enUnaLinea: "una observación de inventario" }] };
  const comparacion = "La venta cayó 12% contra el mes anterior.";
  ok(anteponerSello(comparacion, torcido) === comparacion,
    "un sello cuyo alcance es inventario NO sella una comparación (si sellara, el alcance no serviría de nada)");
  const inventario = "Tienes 4 SKU con 120 días de inventario.";
  ok(anteponerSello(inventario, torcido) !== inventario,
    "…y SÍ sella una lectura de inventario: el chequeo distingue, no dice que sí a todo");
  /* Y la carnada del «usar vs nombrar»: si se le quita la cifra a una lectura, deja de sellar. */
  const s = selloDe(["cifras-imposibles"]);
  ok(anteponerSello("El margen de La Polar es 34%.", s) !== "El margen de La Polar es 34%.", "con cifra, sella");
  ok(anteponerSello("Hablemos de margen.", s) === "Hablemos de margen.",
    "…y sin cifra, no: es exactamente la distinción entre usar una métrica y nombrarla");
}

console.log(`\n── _sello_en_respuesta_gate: ${pass} PASS · ${fail} FAIL (de ${pass + fail}) ──`);
process.exit(fail === 0 ? 0 : 1);
