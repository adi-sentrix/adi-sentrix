/* === _v12_correcciones_gate.mjs · LAS CORRECCIONES DEL DIAGNÓSTICO v12 (cierre de la etapa 1), CON SU CARNADA ═══════════════
 *
 * Supervisor 2026-09-29, diagnóstico de la medición ciega v12 (81 fallas: 8 del catálogo, 73 de ADI en seis raíces) más dos hallazgos
 * que el medidor no mide (A7, A8). Decisiones del owner §7.3·32(b) y §7.3·36(b/c). Cada bloque prueba la RAÍZ con un oráculo
 * independiente del código que corrige (el archivo del tenant, `umbral()`/`ETIQUETA_ORIGEN`, la proyección) y trae una CARNADA
 * (el defecto que la corrección cierra, reconstruido a mano, tiene que caer). Sin listas de frases: se mira la ESTRUCTURA de la
 * Entrega (`marco.definiciones`, `limites`, `procedencia.libroPremisas`, `respuesta`) y los campos tipados de los hechos.
 *
 *   A1 · la procedencia de cada umbral va en `marco.definiciones`, una cláusula por umbral junto a su nombre, SOLO de los estados que
 *        la Entrega usa; un helper único (`businessPolicy.js`) y una tabla estado→umbrales como datos (`estados.js`) · el origen SIGUE
 *        al perfil de la empresa (no está escrito a mano) · también en «breve».
 *   A2 · un SKU con venta al día tiene 0 días sin venta (un dato): «sin venta» y «frenado» se juzgan (falsas), no «sin evidencia».
 *   A3 · un estado dicho en una bodega que no es la del SKU es FALSO, también en los estados con verificador propio.
 *   A4 · una comparación que pide `dias_sin_venta` lo sirve (lectura del productor) y lo lleva tipado como histórico.
 *   A5 · una fig con crudo no la pisa una sin crudo de la misma clave y entidad (la tentación precalculada se declara).
 *   A6 · `techo_cobertura` entra a `_REFERENCIA_FAMILIAS`: la referencia del usuario se declara al lado, con su cifra y sus nombres.
 *   A7 · `k` es el tamaño del top, nunca una cifra de la entidad: la premisa de grupo falsa imprime la cifra PROPIA de la entidad.
 *   A8 · la frase de ausencias del umbral de materialidad dice su origen REAL (del mismo helper), no «que la empresa declaró».
 *   A10 · diagnóstico v17: verdad propia de un miembro (V-A) · par de días de una comparación en cobranza (V-B) · referencia de la consulta sobre un universo solo-excluir (V-C) ·
 *         piso de materialidad de la consulta (W27) · universos declarados (P-A) · comparación parcial (P-B) · el cero en palabras en la comparación (P-C).
 *
 * Solo por `npm run gates:offline` (o con el candado: node --import ./scripts/offline-guard.mjs _v12_correcciones_gate.mjs). Cero red. */
import { initTenant } from "./src/data/tenantStore.js";
import { TENANT_DEMO } from "./src/data/tenants/demo.js";
import { ESCENARIO_INICIAL } from "./src/config/scenarios.js";
import { cifrasDelDato } from "./src/adi/oracle/datoProyectado.js";
import { axisEntityNames } from "./src/adi/oracle/entityIndex.js";
import { indiceDeEvidencia } from "./src/adi/notario/evidencia.js";
import { libroDeHechos, formatoDeLaCasa, esCifraPropia } from "./src/adi/notario/hechos.js";
import { validarEncargo } from "./src/adi/encargo/validar.js";
import { lecturasDe } from "./src/adi/encargo/lecturasDe.js";
import { componerEntrega } from "./src/adi/entrega/componer.js";
import { verificarEntrega } from "./src/adi/entrega/verificar.js";
import { ausenciaPorId } from "./src/config/contract/ausencias.js";
import { ETIQUETA_ORIGEN, umbral, NOMBRE_DE_UMBRAL, FAMILIAS_DE_PROCEDENCIA, clausulasDeProcedencia, procedenciaDeUmbrales, procedenciaDeUmbral, esProcedenciaDeCriterio, formatoDeUmbral, setBenchmarkOverride } from "./src/config/businessPolicy.js";
import { UMBRALES_DE_ESTADO, ESTADO_DE_CONCEPTO, ESTADOS_CANON, umbralesDeEstados, estadoDeLaPremisa } from "./src/adi/notario/estados.js";
import { clasificarFuente } from "./scripts/clasificarGates.mjs";
import { TOOLS } from "./src/adi/oracle/toolRegistry.js";
import { cajaDelAgente } from "./src/adi/agente/herramientasAgente.js";
import fs from "node:fs";

let pass = 0, fail = 0;
const fails = [];
const ok = (c, m, extra = "") => { if (c) { pass++; console.log("  ✓ " + m); } else { fail++; fails.push(m); console.log("  ✗ " + m + (extra ? "\n      " + extra : "")); } };
const H = (t) => console.log(`\n${t}`);

initTenant(TENANT_DEMO);
const ejes = {};
for (const e of ["cliente", "sku", "marca", "familia", "bodega", "canal"]) { try { const n = axisEntityNames(e); if (n && n.length) ejes[e] = n; } catch { /* sin índice */ } }

const INV = (extra = {}) => ({ id: "p1", tema: "inventario", cierre: "lectura", conceptos: ["capital", "dias_inventario"], ...extra });
const entregaDe = (encargo) => { const R = validarEncargo({ version: "encargo/v1", ...encargo }, {}); return { R, E: componerEntrega(R) }; };
const definiciones = (E) => (E.entrega && E.entrega.marco && E.entrega.marco.definiciones) || [];
const procedencias = (E) => definiciones(E).filter(esProcedenciaDeCriterio);
/* el ORÁCULO de la etiqueta de un umbral: `umbral().origen` + `ETIQUETA_ORIGEN`, sin pasar por el helper que se prueba */
const etiquetaDe = (key, consulta = null) => ETIQUETA_ORIGEN[umbral(key, consulta).origen];
/* decisión del supervisor 2026-09-29, §7.3·37b: cada cláusula lleva además el VALOR con que se juzga el umbral (oráculo: `umbral().valor`, dicho «2.0x» / «120 días», sin pasar por el helper que se prueba) */
const _EN_RATIO = new Set(["rotacionMin", "quiebreRotMin"]);
const valorDe = (k, consulta = null) => { const v = umbral(k, consulta).valor; if (v == null) return null; return _EN_RATIO.has(k) ? `${v.toFixed(1)}x` : `${Math.round(v)} días`; };
const claveNombre = (k, consulta = null) => `${NOMBRE_DE_UMBRAL[k]}: ${valorDe(k, consulta) ? `${valorDe(k, consulta)}, ` : ""}${etiquetaDe(k, consulta)}`;
const indiceDe = (consulta = null) => indiceDeEvidencia({ figs: [], datoProyectado: cifrasDelDato(ESCENARIO_INICIAL, consulta), ejesDelTenant: ejes });
const veredicto = (I, h) => libroDeHechos([{ id: "h1", ...h }], { indice: I }).hechos[0].veredicto;
const TENANT_PERFIL = (perfil) => ({ ...TENANT_DEMO, perfil: { ...TENANT_DEMO.perfil, ...perfil } });

/* ═══ A1 · LA PROCEDENCIA DE LOS UMBRALES EN LA ENTREGA ═══════════════════════════════════════════════════════════════════ */
H("A1 · el helper único y la tabla estado→umbrales (datos)");
{
  ok(Object.keys(UMBRALES_DE_ESTADO).every((e) => ESTADOS_CANON.has(e)), "toda llave de UMBRALES_DE_ESTADO es un estado canónico de la casa");
  ok(Object.values(UMBRALES_DE_ESTADO).flat().every((k) => Object.prototype.hasOwnProperty.call(NOMBRE_DE_UMBRAL, k) && umbral(k).origen !== "sin_declarar" || k === "frenadoDiasSinVenta"), "todo umbral de la tabla tiene nombre en superficie y un origen resoluble");
  ok(Object.values(ESTADO_DE_CONCEPTO).every((e) => ESTADOS_CANON.has(e)), "todo concepto que sirve un estado de inventario apunta a un estado canónico");
  const pedidos = Object.values(UMBRALES_DE_ESTADO).flat();
  const enFamilias = FAMILIAS_DE_PROCEDENCIA.flatMap((f) => f.umbrales);
  ok(pedidos.every((k) => enFamilias.includes(k)), "todo umbral de la tabla pertenece a una familia de procedencia (la Entrega puede declararlo)");
  const todas = procedenciaDeUmbrales(pedidos);
  /* decisión del supervisor 2026-09-29, §7.3·37b: las oraciones de procedencia llevan el VALOR de cada umbral y ningún otro dígito */
  ok(todas.length === FAMILIAS_DE_PROCEDENCIA.length && FAMILIAS_DE_PROCEDENCIA.every((f, i) => { const esperados = f.umbrales.filter((k) => pedidos.includes(k)).map((k) => valorDe(k)).filter(Boolean).map((v) => v.match(/\d+(?:\.\d+)?/)[0]); const reales = todas[i].match(/\d+(?:\.\d+)?/g) || []; return esperados.join() === reales.join(); }), "las oraciones de procedencia llevan el valor de cada umbral (oráculo: umbral().valor) y ningún otro dígito", JSON.stringify(todas));
  ok(clausulasDeProcedencia(["dohMax", "rotacionMin", "rotacionMin"]).join("|") === [claveNombre("rotacionMin"), claveNombre("dohMax")].join("|"), "una cláusula por umbral, sin repetir y en el orden de la casa, cada una «nombre: origen»", JSON.stringify(clausulasDeProcedencia(["dohMax", "rotacionMin", "rotacionMin"])));
  ok(procedenciaDeUmbral("no_existe") === null && clausulasDeProcedencia(["no_existe"]).length === 0, "una llave desconocida no inventa un origen");
  ok(umbralesDeEstados(["inmovilizado critico"]).join() === "rotacionMin,dohMax" && !umbralesDeEstados(["en quiebre", "sin venta", "critico"]).length, "un estado sin umbral no declara umbral (en quiebre · sin venta · crítico)");
  ok(estadoDeLaPremisa("no frenado") === "frenado" && estadoDeLaPremisa("frenado") === "frenado" && estadoDeLaPremisa("urgente") === null, "el campo `estado` de una premisa («no <canon>») se lee tipado");
}

H("A1 · la Entrega del encargo declara el origen de los umbrales que SUS estados usan (una cláusula por umbral)");
{
  const { E } = entregaDe({ partes: [INV({ universo: { eje: "sku", estados: ["inmovilizado"] } })] });
  ok(E.ok === true, "el encargo de inmovilizado compone ok", E.motivo);
  const p = procedencias(E);
  const esperada = `${FAMILIAS_DE_PROCEDENCIA[0].prefijo}${["rotacionMin", "dohMax", "sobrestockDohMin"].map(claveNombre).join("; ")}.`;
  ok(p.length === 1 && p[0] === esperada, "«inmovilizado» → piso de rotación · techo de días de inventario · umbral de sobrestock, cada uno con SU origen (oráculo: umbral().origen)", JSON.stringify(p));
  ok(E.texto.includes(esperada), "la procedencia se IMPRIME en el Marco de la Entrega");
  ok(!procedencias(E).some((t) => /frenad|quiebre/i.test(t)), "solo los umbrales de los estados usados: sin frenado ni quiebre");
}
{
  const { E } = entregaDe({ partes: [INV({ universo: { eje: "sku", estados: ["sobrestock"] } })] });
  const p = procedencias(E).join(" ");
  ok(p.includes(claveNombre("sobrestockDohMin")) && p.includes(claveNombre("dohMax")) && !p.includes(NOMBRE_DE_UMBRAL.rotacionMin), "«sobrestock» → umbral de sobrestock y techo de días de inventario, NO el piso de rotación", p);
}
{
  const { E } = entregaDe({ partes: [INV({ universo: { eje: "sku", estados: ["rota lento"] } })] });
  ok(procedencias(E).join(" ") === `${FAMILIAS_DE_PROCEDENCIA[0].prefijo}${claveNombre("rotacionMin")}.`, "«rota lento» → solo el piso de rotación (§7.3·36b)", procedencias(E).join(" "));
}
{
  const { E } = entregaDe({ partes: [INV({ universo: { eje: "sku", estados: ["riesgo de quiebre"] } })] });
  const p = procedencias(E).join(" ");
  ok(p.includes(claveNombre("quiebreRotMin")) && p.includes(claveNombre("quiebreDohMax")), "«riesgo de quiebre» → su piso y su techo, cada uno con su origen (§7.3·36b)", p);
}
{
  const { E } = entregaDe({ partes: [INV({ universo: { eje: "sku" }, conceptos: ["capital_inmovilizado"] })] });
  ok(procedencias(E).length === 1 && procedencias(E)[0].includes(claveNombre("sobrestockDohMin")), "el CONCEPTO capital_inmovilizado pone en juego «inmovilizado» aunque el universo no nombre el estado", procedencias(E).join(" "));
}
{
  const { E } = entregaDe({ partes: [{ id: "p1", tema: "comercial", cierre: "lectura" }] });
  ok(E.ok === true && procedencias(E).length === 0, "una Entrega sin estados de inventario no declara umbrales de inventario (no se agrega ruido)");
}
{
  const { E } = entregaDe({ partes: [INV({ universo: { eje: "sku" }, conceptos: ["capital"] })], premisas: [{ id: "q1", tipo: "estado", sujeto: "SAM-TV55", estado: "no inmovilizado" }] });
  ok(procedencias(E).length === 1, "el estado de una PREMISA («no inmovilizado») también pone en juego sus umbrales", procedencias(E).join(" "));
}

H("A1 · «frenado»: su origen en su propia oración («planteado en la consulta» · «sin umbral declarado» · «declarado por la empresa»)");
{
  const enc = { partes: [INV({ universo: { eje: "sku", estados: ["frenado"] }, conceptos: ["dias_sin_venta"] })], criterio: { referencia: { concepto: "umbral_frenado", valor: 45, unidad: "days" } } };
  const { E } = entregaDe(enc);
  const p = procedencias(E);
  ok(p.length === 1 && p[0] === `${FAMILIAS_DE_PROCEDENCIA[1].prefijo}${claveNombre("frenadoDiasSinVenta", { frenadoDiasSinVenta: 45 })}.`, "con el umbral de la CONSULTA → «umbral de frenado: planteado en la consulta»", JSON.stringify(p));
  ok(!p.some((t) => /declarado por la empresa|criterio general de ADI/.test(t)), "el umbral de la consulta nunca se atribuye a la empresa ni a ADI");
}
{
  const { E } = entregaDe({ partes: [INV({ universo: { eje: "sku", estados: ["frenado"] }, conceptos: ["dias_sin_venta"] })] });
  ok(procedencias(E).join(" ").includes(`${NOMBRE_DE_UMBRAL.frenadoDiasSinVenta}: ${ETIQUETA_ORIGEN.sin_declarar}`), "sin umbral (ni empresa ni consulta) → «sin umbral declarado», junto al límite «sin evaluar»", procedencias(E).join(" "));
}
{
  initTenant(TENANT_PERFIL({ frenadoDiasSinVenta: 75 }));
  const { E } = entregaDe({ partes: [INV({ universo: { eje: "sku", estados: ["frenado"] }, conceptos: ["dias_sin_venta"] })] });
  ok(procedencias(E).join(" ").includes(claveNombre("frenadoDiasSinVenta")), "con el umbral en el PERFIL de la empresa → «declarado por la empresa»", procedencias(E).join(" "));
  initTenant(TENANT_DEMO);
}

H("A1 · CARNADA · el origen SIGUE al perfil (no está escrito a mano): si la empresa declara el umbral de sobrestock, la cláusula cambia");
{
  const enc = { partes: [INV({ universo: { eje: "sku", estados: ["inmovilizado"] } })] };
  const antes = procedencias(entregaDe(enc).E).join(" ");
  const cAntes = claveNombre("sobrestockDohMin");
  initTenant(TENANT_PERFIL({ sobrestockDohMin: 45 }));
  const despues = procedencias(entregaDe(enc).E).join(" ");
  ok(antes.includes(cAntes) && cAntes.endsWith(ETIQUETA_ORIGEN.adi) && despues.includes(claveNombre("sobrestockDohMin")) && claveNombre("sobrestockDohMin").includes("45 días") && claveNombre("sobrestockDohMin").endsWith(ETIQUETA_ORIGEN.empresa), "sobrestock: criterio de ADI en el demo → declarado por la empresa cuando su perfil lo declara", `${antes} || ${despues}`);
  ok(antes !== despues, "la Entrega cambia con el perfil");
  initTenant(TENANT_DEMO);
}

H("A1 · «breve»: la procedencia se ve siempre y no desplaza la nota de cola");
{
  const enc = { profundidad: "breve", partes: [INV({ universo: { eje: "sku", estados: ["inmovilizado"] } })] };
  const { E } = entregaDe(enc);
  const p = procedencias(E);
  ok(p.length === 1 && E.texto.includes(p[0]), "en profundidad «breve» la procedencia sigue impresa en el Marco", E.texto.slice(0, 400));
  const enc2 = { profundidad: "breve", partes: [{ id: "p1", tema: "inventario", cierre: "lectura", conceptos: ["dias_sin_venta", "capital"], universo: { eje: "sku" } }, INV({ id: "p2", universo: { eje: "sku", estados: ["inmovilizado"] } })] };
  const { E: E2 } = entregaDe(enc2);
  const nota = definiciones(E2).find((d) => /en el detalle \(mismo conjunto\)/.test(d));
  ok(!nota || E2.texto.includes(nota), "con la nota de cola (definición agregada por el gobernador de tamaño) ambas se imprimen en «breve»", JSON.stringify(definiciones(E2)));
}

/* ═══ A8 · LA FRASE DE AUSENCIAS DEL UMBRAL DE MATERIALIDAD ═══════════════════════════════════════════════════════════════ */
H("A8 · la frase de ausencias dice el origen REAL del umbral de materialidad (mismo helper)");
{
  const a = ausenciaPorId("conocimiento_sector_inventario");
  const et = etiquetaDe("materialidadFocoPctVenta");
  ok(a.entrega.motivo.includes(`${NOMBRE_DE_UMBRAL.materialidadFocoPctVenta} (${et})`) && a.texto.includes(`${NOMBRE_DE_UMBRAL.materialidadFocoPctVenta} (${et})`), `el motivo y el texto nombran el origen real («${et}»)`, a.entrega.motivo);
  ok(umbral("materialidadFocoPctVenta").origen !== "empresa" ? !/que la empresa declar[oó]|que declar[oó] el cliente/.test(a.entrega.motivo + a.texto) : true, "no atribuye a la empresa un umbral que no declaró");
  const { E } = entregaDe({ partes: [INV({ universo: { eje: "sku", estados: ["inmovilizado"] } })] });
  ok(E.entrega.limites.some((l) => l.motivo === a.entrega.motivo), "la Entrega sirve la MISMA frase del catálogo (una sola verdad)");
  initTenant(TENANT_PERFIL({ materialidadFocoPctVenta: 0.1 }));
  const b = ausenciaPorId("conocimiento_sector_inventario");
  ok(b.entrega.motivo.includes(`(${ETIQUETA_ORIGEN.empresa})`) && !b.entrega.motivo.includes(ETIQUETA_ORIGEN.adi), "CARNADA · si la empresa SÍ lo declara en su perfil, la frase lo dice («declarado por la empresa»)", b.entrega.motivo);
  initTenant(TENANT_DEMO);
  const c = ausenciaPorId("conocimiento_sector_inventario");
  ok(c.entrega.motivo === a.entrega.motivo, "vuelto el demo, la frase vuelve (no queda pegada al perfil anterior)");
}

/* ═══ A2 · «SIN VENTA» / «FRENADO» DE UN SKU CON VENTA AL DÍA ═════════════════════════════════════════════════════════════ */
H("A2 · un SKU con venta al día tiene 0 días sin venta: el veredicto se JUZGA (falsa), no «sin evidencia»");
{
  const dp = cifrasDelDato(ESCENARIO_INICIAL, null);
  const conVenta = Object.entries(dp.dias).filter(([, d]) => d.inventario != null && d.sinVenta === 0).map(([k]) => k);
  ok(conVenta.length > 0 && Object.values(dp.dias).every((d) => d.sinVenta === null || Number.isFinite(d.sinVenta) && d.sinVenta >= 0), "la proyección publica 0 para los SKU con venta al día (no null) y ningún negativo");
  const rk = (dp.rankings.sku.dias_sin_venta || {}).filas || [];
  ok(conVenta.every((k) => (rk.find((f) => f.entidad === k) || {}).valor === 0), "el ranking de días sin venta trae el mismo 0 (una sola verdad)");
  const I = indiceDe();
  const sku = conVenta[0];
  ok(veredicto(I, { tipo: "estado", sujeto: sku, estado: "sin venta" }) === "falsa", `${sku} (0 días) «sin venta» → FALSA`);
  const Ic = indiceDe({ frenadoDiasSinVenta: 30 });
  ok(veredicto(Ic, { tipo: "estado", sujeto: sku, estado: "frenado" }) === "falsa", `${sku} (0 días) «frenado» con umbral de la consulta → FALSA`);
  const conDias = Object.entries(dp.dias).filter(([, d]) => d.sinVenta > 30).map(([k]) => k)[0];
  ok(veredicto(Ic, { tipo: "estado", sujeto: conDias, estado: "frenado" }) === "verdadera" && veredicto(I, { tipo: "estado", sujeto: conDias, estado: "sin venta" }) === "verdadera", `${conDias} (más de 30 días) sigue siendo «sin venta» y «frenado» → verdadera`);
  ok(veredicto(I, { tipo: "estado", sujeto: sku, estado: "frenado" }) === "no-verificable", "sin umbral declarado «frenado» sigue sin verificarse (nunca un umbral inventado)");
  const { E } = entregaDe({ partes: [INV({ universo: { eje: "sku" }, conceptos: ["dias_sin_venta"] })], premisas: [{ id: "q1", tipo: "estado", sujeto: sku, estado: "sin venta" }] });
  ok(E.entrega.procedencia.libroPremisas.porId.get("q1").veredicto === "falsa", "en la Entrega, la premisa «sin venta» de un SKU con venta al día sale FALSA");
}

/* ═══ A3 · LA BODEGA DE UNA PREMISA DE ESTADO ═════════════════════════════════════════════════════════════════════════════ */
H("A3 · un estado dicho en una bodega que no es la del SKU es FALSO (también «frenado», «sin venta», «rota…»)");
{
  const dp = cifrasDelDato(ESCENARIO_INICIAL, { frenadoDiasSinVenta: 60 });
  const I = indiceDe({ frenadoDiasSinVenta: 60 });
  const conBodega = Object.entries(dp.dias).filter(([k, d]) => d.sinVenta > 60 && (dp.estados || []).some((e) => e.entidad === k && e.bodega)).map(([k]) => k)[0];
  const suya = (dp.estados || []).find((e) => e.entidad === conBodega && e.bodega).bodega;
  const otra = [...new Set((dp.estados || []).map((e) => e.bodega).filter(Boolean))].find((b) => b !== suya);
  ok(!!conBodega && !!otra, `hay un SKU frenado y otra bodega (${conBodega}: ${suya} ≠ ${otra})`);
  ok(veredicto(I, { tipo: "estado", sujeto: conBodega, estado: "frenado", bodega: suya }) === "verdadera", "«frenado» en SU bodega → verdadera");
  ok(veredicto(I, { tipo: "estado", sujeto: conBodega, estado: "frenado", bodega: otra }) === "falsa", "CARNADA · «frenado» en OTRA bodega → FALSA (antes: verdadera, la bodega se ignoraba)");
  ok(veredicto(I, { tipo: "estado", sujeto: conBodega, estado: "sin venta", bodega: otra }) === "falsa", "«sin venta» en OTRA bodega → FALSA");
  ok(veredicto(I, { tipo: "estado", sujeto: conBodega, estado: "sin venta", bodega: suya }) === "verdadera", "«sin venta» en SU bodega → verdadera");
}

/* ═══ A4 · LA COMPARACIÓN QUE PIDE dias_sin_venta ═════════════════════════════════════════════════════════════════════════ */
H("A4 · una comparación que pide `dias_sin_venta` lo sirve, tipado como histórico (antes: aceptado y callado)");
{
  const enc = { partes: [{ id: "p1", tema: "inventario", cierre: "comparacion", conceptos: ["capital", "dias_sin_venta", "rotacion"], entidades: [{ nombre: "LG-DRYER8KG" }, { nombre: "PHI-IRON-PRO" }] }] };
  const R = validarEncargo({ version: "encargo/v1", ...enc }, {});
  const L = lecturasDe(R);
  ok(L.porParte.p1.some((c) => c.tool === "inventoryStatus" && c.args && c.args.focus === "dias_sin_venta") && L.porParte.p1.some((c) => c.tool === "compareEntities"), "la lectura de la parte pide compareEntities Y el productor de días sin venta");
  const E = componerEntrega(R);
  ok(E.ok === true, "la comparación compone ok", E.motivo);
  const dp = cifrasDelDato(ESCENARIO_INICIAL, null);
  const dA = dp.dias["LG-DRYER8KG"].sinVenta, dB = dp.dias["PHI-IRON-PRO"].sinVenta;
  const frase = E.entrega.respuesta.map((r) => r.texto).join(" ");
  ok(Number.isFinite(dA) && Number.isFinite(dB) && frase.includes(`${dA} días`) && frase.includes(`${dB} días`), `la Entrega compara los días sin venta de los dos SKU (${dA} y ${dB}, oráculo: la proyección)`, frase);
  const mh = E.entrega.marco.historicos;
  ok(!!mh && mh.naturaleza === "historico" && (mh.hechos || []).some((h) => h.clave === "dias_sin_venta"), "el Marco lleva el bloque histórico con los días sin venta (naturaleza «historico», ventana y límite)", JSON.stringify(mh));
  const enc2 = { partes: [{ id: "p1", tema: "inventario", cierre: "comparacion", conceptos: ["capital", "rotacion"], entidades: [{ nombre: "LG-DRYER8KG" }, { nombre: "PHI-IRON-PRO" }] }] };
  const L2 = lecturasDe(validarEncargo({ version: "encargo/v1", ...enc2 }, {}));
  ok(!L2.porParte.p1.some((c) => c.args && c.args.focus === "dias_sin_venta"), "CONTROL · sin el concepto pedido no se agrega la lectura de días");
}

/* ═══ A5 · UNA FIG CON CRUDO NO LA PISA UNA SIN CRUDO ═════════════════════════════════════════════════════════════════════ */
H("A5 · la tentación precalculada se declara aunque otra lectura traiga el mismo concepto sin crudo (Z61)");
{
  const enc = { partes: [
    { id: "p1", tema: "comercial", cierre: "decision", conceptos: ["carga", "no_capturada"], universo: { eje: "cliente", top: { metrica: "carga", k: 1, direccion: "peor" } } },
    { id: "p2", tema: "cobranza", cierre: "decision", conceptos: ["saldo_vencido", "dias_vencido"], universo: { eje: "cliente", estados: ["en mora"], top: { metrica: "saldo_vencido", k: 1 } } },
    { id: "p3", tema: "inventario", cierre: "lectura", conceptos: ["capital", "dias_inventario"], universo: { eje: "sku", bodega: "Antofagasta" } },
    { id: "p4", tema: "comercial", cierre: "cifra", conceptos: ["margen", "ventas"], eje: "marca", universo: { eje: "marca", top: { metrica: "margen", k: 1 } } },
  ], criterio: { lente: "riesgo" } };
  const R = validarEncargo({ version: "encargo/v1", ...enc }, {});
  const E = componerEntrega(R);
  ok(E.ok === true, "el encargo de cuatro partes compone ok", E.motivo);
  const V = verificarEntrega({ texto: E.texto, entrega: E.entrega, profundidad: (E.entrega.meta && E.entrega.meta.profundidad) || "completa", resolucion: R });
  const reglas = (V.violaciones || []).map((x) => x.regla);
  ok(V.ok === true && !reglas.includes("tentacion-no-precalculada"), "`verificarEntrega` no reporta «tentación no precalculada» (CARNADA: antes de A5 la reportaba)", JSON.stringify(V.violaciones).slice(0, 400));
}

/* ═══ A6 · techo_cobertura ENTRA A LA DECISIÓN 19 ═════════════════════════════════════════════════════════════════════════ */
H("A6 · la referencia `techo_cobertura` del usuario se declara AL LADO de la oficial, con su cifra y sus nombres");
{
  const enc = { partes: [{ id: "p1", tema: "inventario", cierre: "lectura", conceptos: ["dias_inventario", "capital"], universo: { eje: "sku", filtros: [{ metrica: "dias_inventario", op: ">", ref: "techo_cobertura" }] } }], criterio: { referencia: { concepto: "techo_cobertura", valor: 100, unidad: "days" } } };
  const R = validarEncargo({ version: "encargo/v1", ...enc }, {});
  const E = componerEntrega(R);
  ok(E.ok === true, "el encargo con techo de cobertura del usuario compone ok", E.motivo);
  const dp = cifrasDelDato(ESCENARIO_INICIAL, null);
  const techo = umbral("dohMax").valor;
  const sobre = (v) => Object.entries(dp.dias).filter(([, d]) => d.inventario > v).map(([k]) => k);
  const conRef = sobre(100), oficial = sobre(techo);
  const lim = E.entrega.limites.find((l) => /referencia planteada en la consulta/i.test(l.titulo));
  ok(!!lim && lim.titulo.includes(formatoDeLaCasa(100, "days")), "hay un límite «Con la referencia planteada en la consulta (100 días)…»", JSON.stringify(E.entrega.limites.map((l) => l.titulo)));
  ok(!!lim && conRef.every((k) => lim.motivo.includes(k)) && lim.motivo.includes(`${conRef.length} SKU`) && lim.motivo.includes(`contra ${oficial.length}`), `el límite trae el conteo alternativo (${conRef.length}, oráculo: la proyección) y los NOMBRES (${conRef.join(", ")}) contra los ${oficial.length} oficiales`, lim && lim.motivo);
  ok(!!lim && /no reemplaza la referencia oficial/.test(lim.motivo), "declara que no reemplaza a la oficial ni es un objetivo de la empresa");
  ok(oficial.every((k) => E.entrega.cifras.filas.some((f) => f.valores["Entidad / grupo"] === k)), "el universo servido sigue siendo el OFICIAL (el techo de la casa)");
  const R2 = validarEncargo({ version: "encargo/v1", ...enc, criterio: undefined }, {});
  const E2 = componerEntrega(R2);
  ok(!E2.entrega.limites.some((l) => /referencia planteada en la consulta/i.test(l.titulo)), "CONTROL · sin referencia del usuario no se declara ninguna alternativa");
}

/* ═══ A7 · k NO ES UNA CIFRA DE LA ENTIDAD ════════════════════════════════════════════════════════════════════════════════ */
H("A7 · la premisa de grupo falsa imprime la cifra PROPIA de la entidad, nunca el `k` de su top");
{
  const dp = cifrasDelDato(ESCENARIO_INICIAL, null);
  const I = indiceDeEvidencia({ figs: [], datoProyectado: dp, ejesDelTenant: ejes });
  const premisa = { id: "q1", tipo: "grupo", miembros: ["Sodimac"], universo: { eje: "cliente", estados: ["en mora"], top: { metrica: "saldo_vencido", k: 2 } } };
  const libro = libroDeHechos([premisa], { indice: I });
  const Hq = libro.porId.get("q1");
  ok(Hq.veredicto === "falsa", "Sodimac fuera de los 2 de mayor saldo vencido → falsa (control)");
  const k = Hq.numeros.find((n) => n.texto === "2");
  ok(!!k && k.dueno === "universo" && !esCifraPropia(k), "el `k` del top viaja marcado como del UNIVERSO (no es cifra propia de la entidad)", JSON.stringify(Hq.numeros));
  const propia = Hq.numeros.find(esCifraPropia);
  const suyo = ((dp.rankings.cliente.saldo_vencido || {}).filas || []).find((f) => f.entidad === "Sodimac");
  ok(!!propia && !!suyo && propia.texto === suyo.texto, "el libro trae la cifra PROPIA de Sodimac, del ranking de la proyección (oráculo independiente)", JSON.stringify(Hq.numeros));
  const { E } = entregaDe({ partes: [{ id: "p2", tema: "cobranza", cierre: "cifra", conceptos: ["saldo_vencido"], universo: { eje: "cliente", estados: ["en mora"], top: { metrica: "saldo_vencido", k: 2 } } }], premisas: [premisa] });
  const oracion = (E.entrega.respuesta.find((r) => r._premisa && /no es así/.test(r.texto)) || {}).texto || "";
  const valor = suyo.texto;
  ok(oracion.includes(`Sodimac: saldo vencido ${valor}`) && !/\bSodimac: saldo vencido 2\b/.test(oracion), `la oración imprime «Sodimac: saldo vencido ${valor}» (su cifra, con su dueño), no «…vencido 2»`, oracion);
  const otras = [
    { id: "q9", tipo: "orden", sujeto: "SAM-TV55", metrica: "capital", orden: { forma: "topk", k: 3 }, universo: { eje: "sku" } },
    { id: "q8", tipo: "grupo", miembros: ["Jumbo"], universo: { eje: "cliente", base: "bajo el benchmark", top: { metrica: "ventas", k: 2 } } },
  ];
  const libro2 = libroDeHechos(otras, { indice: I });
  const H9 = libro2.porId.get("q9"), H8 = libro2.porId.get("q8");
  ok(H9.numeros.filter((n) => n.dueno).every((n) => n.dueno === "universo") && (H9.numeros.find((n) => n.texto === "3") || {}).dueno === "universo", "el `k` de un orden «topk» también es del universo, no de la entidad", JSON.stringify(H9.numeros));
  ok(!(H8.numeros.filter(esCifraPropia).some((n) => n.texto === "2")), "ningún `k` cuenta como cifra propia en un grupo sobre una base de la casa", JSON.stringify(H8.numeros));
  /* CARNADA: el defecto original reconstruido — un número sin dueño con el valor de k SÍ se tomaría como cifra propia */
  const sinDueno = [{ raw: 2, unidad: "count", texto: "2" }];
  ok(sinDueno.find(esCifraPropia) && sinDueno.find(esCifraPropia).texto === "2", "CARNADA · un número sin dueño declarado sigue contando como cifra propia (por eso el `k` tiene que llevar su marca)");
}

/* ═══ A9 · §7.3·40(d): UN UMBRAL DECLARADO SE ESCRIBE EXACTO · §7.3·40(b): UN % CHICO CONSERVA SU SIGNIFICADO ═════════════════════════════════════
 * Decisión del supervisor 2026-09-30 (diagnóstico v16, antes de la medición ciega): un umbral declarado (por la empresa, la consulta o como criterio de ADI) es un NÚMERO
 * DECLARADO, no una medición: «0.75%», «27.25%», «1.55x», nunca «0.8%», «27.3%», «1.6x». Vale en el Marco, en el veredicto de las premisas y en la referencia declarada. El
 * formato de la casa (con redondeo) sigue siendo el de las cifras MEDIDAS; la diferencia la marca el ORIGEN (`umbral()` / las referencias / la consulta), nunca el número.
 * Los oráculos son los valores declarados A MANO (el dato de entrada), sin pasar por el formateador que se prueba. */
H("A9 · un umbral declarado se escribe EXACTO en el Marco (materialidad 0.75% · piso de rotación 1.55x)");
{
  initTenant(TENANT_PERFIL({ materialidadFocoPctVenta: 0.75, rotacionMin: 1.55 }));
  const { E } = entregaDe({ partes: [{ id: "p1", tema: "comercial", cierre: "lectura", conceptos: ["carga"], universo: { eje: "cliente", base: "carga comercial alta" } }, INV({ id: "p2", universo: { eje: "sku", estados: ["rota lento"] } })] });
  const d = definiciones(E).join(" | ");
  ok(E.ok === true, "el encargo compone ok", E.motivo);
  ok(d.includes("umbral de materialidad: 0.75% de la venta") && !/0\.8%/.test(d), "materialidad declarada 0.75% → «0.75% de la venta» en marco.definiciones (nunca «0.8%»)", d);
  ok(d.includes("piso de rotación: 1.55x") && !/1\.6x/.test(d), "piso de rotación declarado 1.55x → «1.55x» en marco.definiciones (nunca «1.6x»)", d);
  ok(E.texto.includes("0.75% de la venta") && E.texto.includes("1.55x") && !/\b0\.8%|\b1\.6x/.test(E.texto), "el texto impreso de la Entrega dice los valores exactos");
  initTenant(TENANT_DEMO);
}

H("A9 · … en el VEREDICTO de las premisas («criterio aplicado» y el valor de la referencia)");
{
  initTenant(TENANT_PERFIL({ materialidadFocoPctVenta: 0.075, rotacionMin: 1.55, targetCarga: 3.75, dohMax: 127.5 }));
  const { E } = entregaDe({ partes: [INV({ universo: { eje: "sku" }, conceptos: ["capital", "dias_inventario"] })], premisas: [
    { id: "q1", tipo: "grupo", miembros: ["Easy"], universo: { eje: "cliente", base: "carga comercial alta" } },
    { id: "q2", tipo: "estado", sujeto: "SAM-TV55", estado: "inmovilizado critico" },
    { id: "q3", tipo: "estado", sujeto: "SAM-TV55", estado: "rota lento" },
  ] });
  const oraciones = E.entrega.respuesta.filter((r) => r._premisa).map((r) => r.texto);
  const t = oraciones.join("\n");
  ok(oraciones.length >= 3, "las tres premisas se juzgan", t);
  ok(t.includes("criterio aplicado: umbral de materialidad 0.075% de la venta") && !/0\.07%|0\.08%|0\.1%/.test(t), "el veredicto de «carga comercial alta» imprime el umbral de materialidad 0.075% exacto (nunca «0.07%» ni «0.08%»)", t);
  ok(t.includes("nivel de carga declarado 3.75%") && !/3\.8%/.test(t), "el veredicto imprime el nivel de carga declarado 3.75% exacto (nunca «3.8%»)", t);
  ok(t.includes("piso de rotación 1.55x") && !/1\.6x/.test(t), "el veredicto imprime el piso de rotación 1.55x exacto (nunca «1.6x»)", t);
  ok(t.includes("techo de días de inventario 127.5 días") && !/128 días/.test(t), "el veredicto imprime el techo de días 127.5 exacto (nunca «128 días»)", t);
  initTenant(TENANT_DEMO);
}

H("A9 · … y en la REFERENCIA declarada (la de la empresa y la de la consulta)");
{
  setBenchmarkOverride(27.25);
  const enc = { partes: [{ id: "p1", tema: "comercial", cierre: "lectura", conceptos: ["margen", "brecha"], universo: { eje: "cliente", base: "bajo el benchmark" } }], premisas: [{ id: "q1", tipo: "grupo", miembros: ["Falabella"], universo: { eje: "cliente", base: "bajo el benchmark" } }] };
  const { E } = entregaDe(enc);
  const ref = E.entrega.marco.referenciaDeclarada;
  ok(!!ref && ref.texto === "Benchmark de margen: 27.25%, declarado por la empresa.", "la referencia de la EMPRESA (benchmark 27.25) se declara exacta en el Marco", JSON.stringify(ref));
  const t = E.entrega.respuesta.filter((r) => r._premisa).map((r) => r.texto).join("\n");
  ok(t.includes("benchmark de margen 27.25%") && !/27\.3%/.test(t + E.texto), "el veredicto y el resto de la Entrega dicen «27.25%» (nunca «27.3%»)", t);
  setBenchmarkOverride(null);
  const { E: E2 } = entregaDe({ ...enc, criterio: { referencia: { concepto: "benchmark", valor: 25.55, unidad: "pct" } } });
  const lim = E2.entrega.limites.find((l) => /referencia planteada en la consulta/i.test(l.titulo));
  ok(!!lim && lim.titulo.includes("(25.55%)") && !/25\.6%|25\.5%/.test(lim.titulo), "la referencia del USUARIO (25.55) se declara exacta al lado de la oficial", lim && lim.titulo);
  const { E: E3 } = entregaDe({ partes: [INV({ universo: { eje: "sku", estados: ["rota lento"] } })], criterio: { referencia: { concepto: "piso_rotacion", valor: 1.55, unidad: "ratio" } } });
  const lim3 = E3.entrega.limites.find((l) => /referencia planteada en la consulta/i.test(l.titulo));
  ok(!!lim3 && lim3.titulo.includes("(1.55x)") && !/1\.6x/.test(lim3.titulo), "el piso de rotación del USUARIO (1.55x) se declara exacto", lim3 && lim3.titulo);
  const { E: E4 } = entregaDe({ partes: [INV({ universo: { eje: "sku", filtros: [{ metrica: "dias_inventario", op: ">", ref: "techo_cobertura" }] } })], criterio: { referencia: { concepto: "techo_cobertura", valor: 130.5, unidad: "days" } } });
  const lim4 = E4.entrega.limites.find((l) => /referencia planteada en la consulta/i.test(l.titulo));
  ok(!!lim4 && lim4.titulo.includes("(130.5 días)") && !/131 días/.test(lim4.titulo), "el techo de cobertura del USUARIO (130.5 días) se declara exacto", lim4 && lim4.titulo);
  const { E: E5 } = entregaDe({ partes: [{ id: "p1", tema: "comercial", cierre: "lectura", universo: { eje: "cliente", filtros: [{ metrica: "margen", op: ">", valor: 27.25, unidad: "pct" }] } }] });
  ok(E5.entrega.respuesta.some((r) => /margen superior a 27\.25%/.test(r.texto)) && !/27\.3%/.test(E5.texto), "el umbral que la CONSULTA plantea en un filtro (margen > 27.25%) se dice exacto", E5.texto.slice(0, 300));
}

H("A9 · CARNADA · declarado ≠ medido POR SU ORIGEN, no por el número (27.25 declarado = «27.25%»; 27.25 medido = «27.3%»)");
{
  ok(formatoDeUmbral(27.25, "pct") === "27.25%" && formatoDeLaCasa(27.25, "pct") === "27.3%", "el MISMO 27.25: como umbral declarado «27.25%», como cifra medida «27.3%» (el formato de la casa no cambió)");
  ok(formatoDeUmbral(0.75, "pct") === "0.75%" && formatoDeUmbral(3.75, "pct") === "3.75%" && formatoDeUmbral(1.55, "ratio") === "1.55x" && formatoDeUmbral(2, "ratio") === "2.0x" && formatoDeUmbral(120, "days") === "120 días" && formatoDeUmbral(127.5, "days") === "127.5 días", "el formateador de umbrales escribe exacto (0.75% · 3.75% · 1.55x · 2.0x · 120 días · 127.5 días)");
  ok(formatoDeUmbral(0.1 + 0.2, "pct") === "0.3%" && formatoDeUmbral(0.0075 * 100, "pct") === "0.75%", "sin el ruido de coma flotante (0.1 + 0.2 → «0.3%» · 0.0075 × 100 → «0.75%»)");
  ok(formatoDeUmbral(500000, "money") === null && formatoDeUmbral(NaN, "pct") === null, "una unidad sin forma exacta (dinero) o un valor no numérico devuelve null: se usa el formato de la casa");
  /* CARNADA: el defecto original reconstruido — un umbral redondeado con el formato de la casa NO es el declarado */
  ok(formatoDeLaCasa(0.75, "pct") !== "0.75%" && formatoDeLaCasa(1.55, "ratio") !== "1.55x", "CARNADA · pasar un umbral declarado por el formato de la casa lo redondea («0.8%», «1.6x»): eso es lo que 40(d) prohíbe");
}

H("A9 · §7.3·40(b) · un porcentaje MEDIDO chico conserva su significado (dos cifras significativas bajo 0.5 %) y de 0.5 para arriba el formato NO cambió");
{
  const casos = [[0.049, "0.049%"], [0.05, "0.05%"], [0.25, "0.25%"], [0.015, "0.015%"], [0.1, "0.1%"], [0.075, "0.075%"], [0.4, "0.4%"], [0.001, "0.001%"], [-0.049, "-0.049%"], [0, "0%"]];
  ok(casos.every(([x, e]) => formatoDeLaCasa(x, "pct") === e), "0.049 → «0.049%» · 0.05 → «0.05%» · 0.25 → «0.25%» · 0.015 → «0.015%» (sin ceros de cola, con signo)", JSON.stringify(casos.map(([x]) => formatoDeLaCasa(x, "pct"))));
  /* el ORÁCULO de «de 0.5 para arriba, como siempre»: la fórmula anterior, escrita a mano */
  const anterior = (x) => (Math.abs(x - Math.round(x)) < 0.05 ? String(Math.round(x)) : x.toFixed(1)) + "%";
  let dif = 0, n = 0;
  for (let i = -30000; i <= 30000; i++) { const x = i / 100; if (Math.abs(x) < 0.5) continue; n++; if (formatoDeLaCasa(x, "pct") !== anterior(x)) dif++; }
  for (let i = -3000; i <= 3000; i++) { const x = i / 10; if (Math.abs(x) < 0.5) continue; n++; if (formatoDeLaCasa(x, "pct") !== anterior(x)) dif++; }
  ok(n > 60000 && dif === 0, `de 0.5 a 300 (± ) el formateador queda byte-idéntico a la forma anterior (${n} valores, ${dif} distintos)`);
  /* un % medido chico en la Entrega: la fig 0.049 se dice «0.049%» */
  const I = indiceDeEvidencia({ figs: [{ label: "Falabella · Carga comercial", value: "0.05%", unit: "pct", raw: 0.049, source: "computed" }], datoProyectado: cifrasDelDato(ESCENARIO_INICIAL, null), ejesDelTenant: ejes });
  const lib = libroDeHechos([{ id: "h1", tipo: "cifra", sujeto: "Falabella", metrica: "carga", valor: "0.049%" }], { indice: I });
  const h1 = lib.hechos[0];
  const rendido = JSON.stringify(h1 && h1.render);
  ok(!!h1 && /0\.049%/.test(rendido) && !/0\.05%/.test(rendido), "una cifra MEDIDA de 0.049 % (la boleta la muestra «0.05%») se rinde «0.049%» (nunca «0.05%»)", rendido);
}

/* ═══ A10 · DIAGNÓSTICO v17 (medición ciega v17, catálogo sellado v17) ══════════════════════════════════════════════════════════════════
 * Cinco raíces de ADI, cada una con su carnada en POSITIVO (la corrección dice lo verdadero) y en NEGATIVO (el control que NO debe cambiar):
 *   V-A · la verdad propia de un miembro que el universo deja fuera dice su ENTIDAD, su cifra de la métrica del conjunto que la deja fuera y —solo fuera del top— su puesto: `base` que es un estado ·
 *         varios miembros · entidad DENTRO del top · entidad excluida por la consulta (`excluir.entidades`, sin cifra ni puesto).
 *   V-B · una comparación en cobranza no pierde el par de días vencido de una cuenta sana (ausente = cero): la boleta gana «Dias Vencido 0d» SOLO con un encargo tipado (opt-in); la del agente queda igual.
 *   V-C · la referencia que planteó la consulta sobre un universo SOLO-EXCLUIR se declara al lado de la oficial (nunca en silencio).
 *   W27 · el piso de materialidad planteado en la consulta (`umbral_materialidad`) se declara al lado del oficial, con su origen y las cuentas que daría; nunca lo reemplaza ni se ignora.
 *   P-A · `entrega.universos[]` declara el universo SERVIDO (base · excluir · top · unión), no uno más ancho.  P-B · una comparación con un concepto inválido es `parcial`.
 *   P-C · un lado de una comparación que vale 0 se dice en palabras junto a su cifra (`no tiene … (0 días)`).
 * Oráculos: los rankings de la proyección (`cifrasDelDato`) y los valores declarados a mano; nunca el helper que se prueba. */
const RK = cifrasDelDato(ESCENARIO_INICIAL, null).rankings;
const valRk = (eje, clave, ent) => { const f = RK[eje][clave].filas.find((x) => x.entidad === ent); return f ? f.valor : null; };
const oracionesDe = (E) => E.entrega.respuesta.filter((r) => r._premisa).map((r) => r.texto);
const oracionDe = (E, nombre) => oracionesDe(E).find((t) => t.includes(`${nombre}:`)) || "";

H("A10 · V-A1 · una `base` que ES un estado: la premisa de grupo falsa dice la entidad y el estado en que SÍ está (nunca «con capital inmovilizado critico» sin dueño)");
{
  const U = { eje: "sku", base: "con capital inmovilizado critico" };
  const { E } = entregaDe({ partes: [{ id: "p1", tema: "inventario", cierre: "cifra", conceptos: ["capital_frenado", "rotacion", "dias_inventario"], eje: "sku", universo: U }], premisas: [
    { id: "q1", tipo: "grupo", miembros: ["PHI-IRON-PRO"], universo: U }, { id: "q2", tipo: "grupo", miembros: ["LG-DRYER8KG"], universo: U }] });
  const f = oracionDe(E, "PHI-IRON-PRO");
  ok(E.ok === true && /PHI-IRON-PRO: está /.test(f) && !/capital inmovilizado critico[;,]/.test(f), "PHI-IRON-PRO (no es inmovilizado crítico): «PHI-IRON-PRO: está <su estado>», sin el identificador crudo del conjunto", f);
  ok(/sobrestock/.test(f), "el estado que se dice es en el que SÍ está (oráculo: sobrestock, del dato del SKU)", f);
  const v = oracionesDe(E).find((t) => /LG-DRYER8KG/.test(t)) || "";
  ok(/es correcto/.test(v) && !/no es así/.test(v), "CONTROL NEGATIVO · un SKU que SÍ es inmovilizado crítico sigue verdadero (la corrección no invierte veredictos)", v);
}

H("A10 · V-A2 · una premisa de VARIOS miembros dice la verdad de CADA uno que el universo deja fuera, con su dueño (y no nombra a los que sí están dentro)");
{
  const U = { eje: "cliente", excluir: { conjuntos: ["carga comercial alta", "bajo el benchmark"] } };
  const { E } = entregaDe({ partes: [{ id: "p1", tema: "comercial", cierre: "lectura", conceptos: ["ventas", "margen", "carga"], universo: U }], premisas: [{ id: "q1", tipo: "grupo", miembros: ["Tottus", "Ripley"], universo: U }] });
  const t = oracionesDe(E).join("\n");
  ok(t.includes(`Tottus: margen ${formatoDeLaCasa(valRk("cliente", "margen", "Tottus"), "pct")}`) && t.includes(`Ripley: carga comercial ${formatoDeLaCasa(valRk("cliente", "carga", "Ripley"), "pct")}`), "Tottus dice su margen (bajo el benchmark) y Ripley su carga (carga comercial alta): cada uno con la cifra de la métrica del conjunto que LO deja fuera", t);
  const U2 = { eje: "cliente", excluir: { conjuntos: ["carga comercial alta"] } };
  const { E: E2 } = entregaDe({ partes: [{ id: "p1", tema: "cobranza", cierre: "cifra", conceptos: ["saldo_por_vencer"], universo: { eje: "cliente", estados: ["al dia"] } }], premisas: [{ id: "q1", tipo: "grupo", miembros: ["Jumbo", "Hites"], universo: U2 }] });
  const t2 = oracionesDe(E2).join("\n");
  ok(t2.includes(`Jumbo: carga comercial ${formatoDeLaCasa(valRk("cliente", "carga", "Jumbo"), "pct")}`) && !/Hites:/.test(t2), "NEGATIVO · Jumbo (la deja fuera el conjunto) dice su carga; Hites (SÍ está en el universo) NO se nombra como si fallara", t2);
}

H("A10 · V-A3 · con `top` y un conjunto excluido: la entidad DENTRO del top dice la cifra del conjunto que la deja fuera; FUERA del top, su puesto");
{
  const U = { eje: "cliente", top: { metrica: "ventas", k: 5 }, excluir: { conjuntos: ["carga comercial alta"] } };
  const { E } = entregaDe({ partes: [{ id: "p1", tema: "comercial", cierre: "decision", conceptos: ["ventas", "contribucion", "carga"], universo: U }], criterio: { lente: "contribucion" }, premisas: [{ id: "q1", tipo: "grupo", miembros: ["Sodimac"], universo: U }] });
  const f = oracionDe(E, "Sodimac");
  ok(f.includes(`Sodimac: carga comercial ${formatoDeLaCasa(valRk("cliente", "carga", "Sodimac"), "pct")}`) && !/puesto \d+ de 13/.test(f), "Sodimac está en el top 5 por venta y la deja fuera «carga comercial alta»: dice su CARGA, sin un «puesto 4 de 13» que leería como si la premisa fuera cierta", f);
  const U2 = { eje: "cliente", top: { metrica: "ventas", k: 3 } };
  const { E: E2 } = entregaDe({ partes: [{ id: "p1", tema: "comercial", cierre: "lectura", conceptos: ["ventas"], universo: U2 }], premisas: [{ id: "q1", tipo: "grupo", miembros: ["Easy"], universo: U2 }] });
  const f2 = oracionDe(E2, "Easy");
  ok(/puesto \d+ de 13/.test(f2), "CONTROL NEGATIVO · fuera del top el PUESTO sigue siendo la razón verdadera (Easy, top 3 por venta)", f2);
  const U3 = { eje: "cliente", base: "carga comercial alta", excluir: { conjuntos: ["bajo el benchmark"] } };
  const { E: E3 } = entregaDe({ partes: [{ id: "p1", tema: "comercial", cierre: "lectura", conceptos: ["carga", "margen", "ventas"], universo: U3 }], premisas: [{ id: "q1", tipo: "grupo", miembros: ["Ripley"], universo: U3 }] });
  const f3 = oracionDe(E3, "Ripley");
  ok(f3.includes(`Ripley: margen ${formatoDeLaCasa(valRk("cliente", "margen", "Ripley"), "pct")}`), "base «carga comercial alta» que Ripley SÍ cumple + excluir «bajo el benchmark» que NO cumple: la deja fuera el segundo, y dice su MARGEN (no su carga)", f3);
}

H("A10 · V-A4 · una entidad que la CONSULTA sacó por su nombre (`excluir.entidades`) dice esa razón, sin cifra ni puesto; una excluida por un conjunto sigue con su cifra");
{
  const U = { eje: "cliente", excluir: { conjuntos: ["bajo el benchmark"], entidades: ["Unimarc"] } };
  const { E } = entregaDe({ partes: [{ id: "p1", tema: "comercial", cierre: "cifra", conceptos: ["ventas", "margen"], universo: U }], premisas: [{ id: "q1", tipo: "grupo", miembros: ["Unimarc"], universo: U }, { id: "q2", tipo: "grupo", miembros: ["Ripley"], universo: U }] });
  const u = oracionDe(E, "Unimarc"), r = oracionDe(E, "Ripley");
  ok(/Unimarc: fuera del universo por exclusión de la consulta/.test(u) && !/Unimarc:[^;.]*\d/.test(u.replace(/criterio aplicado.*/, "")), "Unimarc: «fuera del universo por exclusión de la consulta», sin cifra ni puesto (una cifra suya diría que el universo la incluye)", u);
  ok(/Ripley: margen/.test(r) && !/exclusión de la consulta/.test(r), "CONTROL NEGATIVO · Ripley (la deja fuera el CONJUNTO, no la consulta) dice su margen, no «exclusión de la consulta»", r);
}

H("A10 · V-B · una comparación en cobranza no pierde el par de días vencido de una cuenta sana (ausente = cero), dentro o fuera del top 8");
{
  const cmp = (a, b) => entregaDe({ partes: [{ id: "p1", tema: "cobranza", cierre: "comparacion", conceptos: ["saldo_vencido", "dias_vencido"], entidades: [{ nombre: a }, { nombre: b }] }] }).E;
  const E = cmp("Easy", "Unimarc");
  ok(/en dias vencido, Easy 270 días contra Unimarc/.test(E.texto) && E.entrega.cifras.filas.some((f) => f.valores["Entidad / grupo"] === "Unimarc" && /dias vencido/i.test(f.valores["Métrica"] || "")), "Easy 270 días contra Unimarc 0 días (fuera del top 8): el par SÍ sale, con la fila de Unimarc", E.texto.split("\n").find((l) => /Comparando/.test(l)));
  const sin = [];
  const ents = ["Falabella", "Lider", "Jumbo", "Easy", "Sodimac", "Ripley", "La Polar", "Unimarc", "Tottus", "Hites", "Paris"];
  for (const a of ["Jumbo", "Ripley", "La Polar"]) for (const b of ents) { if (a === b) continue; if (!/dias vencido/i.test(cmp(a, b).texto)) sin.push(`${a}~${b}`); }
  ok(sin.length === 0, "las 27 comparaciones de una cuenta sana (Jumbo —dentro del top 8—, Ripley, La Polar) contra cada otra traen su par de días", sin.join(" "));
  const caja = cajaDelAgente(TOOLS);
  const dias = (args) => ((caja.cobranza({ scenario: ESCENARIO_INICIAL, ...args }).boleta) || []).filter((x) => /Dias Vencido/.test(x.label)).map((x) => `${x.label}=${x.value}`);
  const conEncargo = dias({ entidadesRequeridas: ["Jumbo", "Unimarc"] });
  ok(conEncargo.includes("Jumbo · Dias Vencido=0d") && conEncargo.includes("Unimarc · Dias Vencido=0d"), "CON un encargo tipado (opt-in `entidadesRequeridas`) la boleta publica «Dias Vencido 0d» de la cuenta sana pedida", conEncargo.join(" | "));
  const sinEncargo = dias({}), nombrada = dias({ _preguntaUsuario: "cobro de Unimarc y Jumbo" });
  ok(!sinEncargo.some((x) => /^(Jumbo|Unimarc) /.test(x)) && !nombrada.some((x) => /^(Jumbo|Unimarc) /.test(x)) && sinEncargo.join() === nombrada.join(), "CANDADO · SIN encargo tipado (turno del agente, con o sin la cuenta nombrada en texto libre) la boleta NO gana ningún «Dias Vencido» de una cuenta sana: idéntica a la de antes", sinEncargo.join(" | "));
}

H("A10 · V-C · la referencia de la consulta sobre un universo SOLO-EXCLUIR se declara al lado de la oficial (no se ignora en silencio ni la reemplaza)");
{
  const enc = { partes: [{ id: "p1", tema: "comercial", cierre: "cifra", conceptos: ["margen", "brecha", "ventas"], universo: { eje: "cliente", excluir: { conjuntos: ["bajo el benchmark"] } } }] };
  const { E } = entregaDe({ ...enc, criterio: { referencia: { concepto: "benchmark", valor: 33, unidad: "pct" } } });
  const lim = E.entrega.limites.find((l) => /referencia planteada en la consulta/i.test(l.titulo));
  ok(!!lim && lim.titulo.includes("(33%)") && /no reemplaza la referencia oficial/.test(lim.motivo), "benchmark 33 % planteado sobre «todas menos las bajo el benchmark»: se declara «(33%)» al lado, «no reemplaza la referencia oficial»", lim && `${lim.titulo} | ${lim.motivo}`);
  ok(/Benchmark de margen: 30\.1%/.test((E.entrega.marco.referenciaDeclarada || {}).texto || ""), "el Marco sigue con el benchmark OFICIAL (30.1%), no el de la consulta");
  const { E: E0 } = entregaDe(enc);
  ok(!E0.entrega.limites.some((l) => /referencia planteada en la consulta/i.test(l.titulo)), "CONTROL NEGATIVO · sin referencia del usuario no se declara ninguna");
}

H("A10 · W27 · el piso de materialidad planteado en la consulta se declara al lado del oficial, con su origen y las cuentas que daría (nunca lo reemplaza, nunca se ignora)");
{
  /* oráculo independiente: la cuenta del detector a mano — carga comercial alta = carga sobre el nivel declarado (3.5 %) cuyo exceso en $ ≥ el piso (% de la venta total) */
  const nivel = 3.5, filasV = RK.cliente.ventas.filas, total = filasV.reduce((s, f) => s + f.valor, 0);
  const cuentasCon = (pct) => filasV.filter((f) => { const c = valRk("cliente", "carga", f.entidad); return c > nivel && ((c - nivel) / 100) * f.valor >= (pct / 100) * total; }).map((f) => f.entidad).sort();
  const U = { eje: "cliente", base: "carga comercial alta" };
  const enc = (pct, extra = {}) => ({ partes: [{ id: "p1", tema: "comercial", cierre: "cifra", conceptos: ["carga", "no_capturada", "ventas"], universo: U }], criterio: { referencia: { concepto: "umbral_materialidad", valor: pct, unidad: "pct" } }, premisas: [{ id: "q1", tipo: "conteo", conteo: { n: 6, m: 13 }, de: U }], ...extra });
  const { E } = entregaDe(enc(0.1));
  const lim = E.entrega.limites.find((l) => /referencia planteada en la consulta/i.test(l.titulo));
  const alt = cuentasCon(0.1);
  ok(!!lim && lim.titulo.includes("(0.1%)") && /general de ADI/.test(lim.titulo), "el piso de 0.1 % de la consulta se declara EXACTO «(0.1%)», contra el criterio general de ADI (su procedencia)", lim && lim.titulo);
  ok(!!lim && alt.length === 3 && alt.every((n) => lim.motivo.includes(n)) && new RegExp(`Serían 3 .*contra ${cuentasCon(0.05).length} con`).test(lim.motivo), `las cuentas que daría son las del detector con 0.1 % (oráculo: ${alt.join(", ")}) y el conteo oficial (${cuentasCon(0.05).length}) al lado`, lim && lim.motivo);
  ok(/0\.05% de la venta/.test(definiciones(E).join(" ")) && !/0\.1%/.test(definiciones(E).join(" ")), "NUNCA reemplaza: el Marco sigue con el piso OFICIAL 0.05 % (el 0.1 % vive solo en el límite, al lado)", definiciones(E).join(" | "));
  const { E: E2 } = entregaDe(enc(0.02));
  const lim2 = E2.entrega.limites.find((l) => /referencia planteada en la consulta/i.test(l.titulo));
  ok(!!lim2 && cuentasCon(0.02).every((n) => lim2.motivo.includes(n)) && cuentasCon(0.02).length >= cuentasCon(0.05).length, `un piso MÁS BAJO (0.02 %) da un conjunto mayor o igual y también se declara (${cuentasCon(0.02).length} cuentas)`, lim2 && lim2.motivo);
  initTenant(TENANT_PERFIL({ materialidadFocoPctVenta: 0.06 }));
  const { E: E3 } = entregaDe(enc(0.1));
  const lim3 = E3.entrega.limites.find((l) => /referencia planteada en la consulta/i.test(l.titulo));
  ok(!!lim3 && /declarado por la empresa/.test(lim3.titulo) && /0\.06% de la venta/.test(definiciones(E3).join(" ")) && !/0\.1%/.test(definiciones(E3).join(" ")), "el origen SIGUE al perfil: con el piso declarado por la EMPRESA (0.06 %) el límite dice «declarado por la empresa» y el Marco conserva 0.06 %", lim3 ? lim3.titulo : definiciones(E3).join(" | ") + " || " + E3.entrega.limites.map((l) => l.titulo).join(" | "));
  initTenant(TENANT_DEMO);
  const { E: E4 } = entregaDe({ partes: [INV({ universo: { eje: "sku" } })], criterio: { referencia: { concepto: "umbral_materialidad", valor: 0.1, unidad: "pct" } } });
  ok(!E4.entrega.limites.some((l) => /referencia planteada en la consulta/i.test(l.titulo)), "CONTROL NEGATIVO · si la Entrega no usa el piso (solo inventario) no declara una referencia que no está en juego");
  const { E: E5 } = entregaDe({ partes: enc(0.1).partes, premisas: enc(0.1).premisas });
  ok(!E5.entrega.limites.some((l) => /referencia planteada en la consulta/i.test(l.titulo)), "CONTROL NEGATIVO · sin la referencia del usuario no se declara ninguna");
}

H("A10 · P-A · `entrega.universos[]` declara el universo SERVIDO (base · excluir · unión), no uno más ancho");
{
  const uni = (encargo) => entregaDe(encargo).E.entrega.universos;
  const u1 = uni({ partes: [{ id: "p1", tema: "inventario", cierre: "cifra", conceptos: ["dias_sin_venta", "capital_frenado"], eje: "sku", universo: { eje: "sku", base: "con capital inmovilizado critico", filtros: [{ metrica: "dias_sin_venta", op: ">", valor: 90 }] } }] });
  ok(u1.some((u) => u.base === "con capital inmovilizado critico" && /inmovilizado/.test(u.texto)), "base «con capital inmovilizado critico» + filtro de días: el universo declarado conserva la BASE (antes decía solo el filtro)", JSON.stringify(u1.map((u) => [u.base, u.texto])));
  const u2 = uni({ partes: [{ id: "p1", tema: "comercial", cierre: "cifra", conceptos: ["margen", "ventas", "brecha"], universo: { eje: "cliente", estados: ["al dia"], excluir: { conjuntos: ["bajo el benchmark"] } } }] });
  ok(u2.some((u) => u.excluir && Array.isArray(u.excluir.conjuntos) && u.excluir.conjuntos.includes("bajo el benchmark") && /benchmark/.test(u.texto)), "estados + excluir «bajo el benchmark»: el universo declarado nombra el conjunto que excluye", JSON.stringify(u2.map((u) => [u.excluir, u.texto])));
  const u3 = uni({ partes: [{ id: "p1", tema: "inventario", cierre: "cifra", conceptos: ["capital", "dias_inventario", "rotacion"], eje: "sku", universo: { eje: "sku", union: [{ eje: "sku", base: "con capital inmovilizado critico" }, { eje: "sku", estados: ["riesgo de quiebre"] }] } }] });
  ok(u3.some((u) => /inmovilizado/.test(u.texto) && /quiebre/.test(u.texto)), "una UNIÓN de dos conjuntos: el universo declarado nombra los dos (antes «los 13 SKU»)", JSON.stringify(u3.map((u) => u.texto)));
  const u4 = uni({ partes: [{ id: "p1", tema: "comercial", cierre: "cifra", conceptos: ["ventas"], universo: { eje: "cliente", estados: ["al dia"] } }] });
  ok(u4.every((u) => !u.excluir) && !u4.some((u) => /benchmark/.test(u.texto || "")), "CONTROL NEGATIVO · un universo SIN exclusión no declara ninguna", JSON.stringify(u4.map((u) => [u.excluir, u.texto])));
}

H("A10 · P-B · una comparación con un concepto de otro tema deja la parte `parcial` (elementos válidos e inválidos); sin concepto inválido, `resuelta`");
{
  const enc = (conceptos) => ({ version: "encargo/v1", partes: [{ id: "p1", tema: "cobranza", cierre: "comparacion", conceptos, entidades: [{ nombre: "Ripley" }, { nombre: "Unimarc" }] }] });
  const R1 = validarEncargo(enc(["saldo_por_vencer", "recuperado", "capital"]), {});
  ok(R1.partes[0].estado === "parcial" && R1.noResuelto.some((n) => n.parte === "p1" && n.valor === "capital"), "«capital» (de inventario) en una comparación de cobranza: la parte queda PARCIAL con el concepto declarado sin resolver", JSON.stringify(R1.partes[0].estado));
  const R2 = validarEncargo(enc(["saldo_por_vencer", "recuperado"]), {});
  ok(R2.partes[0].estado === "resuelta", "CONTROL NEGATIVO · la misma comparación con conceptos válidos sigue `resuelta`", R2.partes[0].estado);
}

H("A10 · P-C · un lado de una comparación que vale 0 se dice en palabras junto a su cifra; un lado que no es 0, no");
{
  const cmp = (a, b, conceptos) => entregaDe({ partes: [{ id: "p1", tema: "cobranza", cierre: "comparacion", conceptos, entidades: [{ nombre: a }, { nombre: b }] }] }).E;
  const l = (E) => E.texto.split("\n").find((x) => /Comparando/.test(x)) || "";
  const E1 = cmp("La Polar", "Ripley", ["saldo_pendiente", "dias_vencido"]);
  ok(/La Polar no tiene dias vencido \(0 días\) contra Ripley no tiene dias vencido \(0 días\)/.test(l(E1)), "La Polar 0 días contra Ripley 0 días: «no tiene dias vencido (0 días)» de cada lado", l(E1));
  const E2 = cmp("Easy", "Unimarc", ["saldo_vencido", "dias_vencido"]);
  ok(/Easy 270 días contra Unimarc no tiene dias vencido \(0 días\)/.test(l(E2)) && !/Easy no tiene/.test(l(E2)), "Easy 270 días (no es 0: plano) contra Unimarc 0 días (en palabras)", l(E2));
  ok(/Unimarc no tiene saldo vencido \(\$0\)/.test(l(E2)), "el mismo criterio para el dinero: «no tiene saldo vencido ($0)»", l(E2));
  const E3 = cmp("Falabella", "Lider", ["saldo_pendiente", "dias_vencido"]);
  ok(!/no tiene/.test(l(E3)), "CONTROL NEGATIVO · dos cuentas con cifra distinta de cero: ningún «no tiene»", l(E3));
}

H("CERO llamadas a un LLM · CERO red — solo por npm run gates:offline");
{
  const fuente = fs.readFileSync("./_v12_correcciones_gate.mjs", "utf8");
  const c = clasificarFuente(fuente);
  ok(c.tipo === "offline", "clasificarFuente(_v12_correcciones_gate.mjs) === offline", JSON.stringify(c));
}

console.log(`\n── _v12_correcciones_gate: PASS ${pass} · FAIL ${fail} (de ${pass + fail}) ──`);
if (fail) console.log(fails.map((f) => `  ✗ ${f}`).join("\n"));
process.exit(fail ? 1 : 0);
