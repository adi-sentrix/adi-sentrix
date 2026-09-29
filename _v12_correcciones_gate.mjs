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
import { ETIQUETA_ORIGEN, umbral, NOMBRE_DE_UMBRAL, FAMILIAS_DE_PROCEDENCIA, clausulasDeProcedencia, procedenciaDeUmbrales, procedenciaDeUmbral, esProcedenciaDeCriterio } from "./src/config/businessPolicy.js";
import { UMBRALES_DE_ESTADO, ESTADO_DE_CONCEPTO, ESTADOS_CANON, umbralesDeEstados, estadoDeLaPremisa } from "./src/adi/notario/estados.js";
import { clasificarFuente } from "./scripts/clasificarGates.mjs";
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
const claveNombre = (k) => `${NOMBRE_DE_UMBRAL[k]}: ${etiquetaDe(k)}`;
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
  ok(todas.length === FAMILIAS_DE_PROCEDENCIA.length && todas.every((t) => !/\d/.test(t)), "las oraciones de procedencia no llevan dígitos (definición del criterio, no cifra)");
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
  ok(p.length === 1 && p[0] === `${FAMILIAS_DE_PROCEDENCIA[1].prefijo}${NOMBRE_DE_UMBRAL.frenadoDiasSinVenta}: ${ETIQUETA_ORIGEN.consulta}.`, "con el umbral de la CONSULTA → «umbral de frenado: planteado en la consulta»", JSON.stringify(p));
  ok(!p.some((t) => /declarado por la empresa|criterio general de ADI/.test(t)), "el umbral de la consulta nunca se atribuye a la empresa ni a ADI");
}
{
  const { E } = entregaDe({ partes: [INV({ universo: { eje: "sku", estados: ["frenado"] }, conceptos: ["dias_sin_venta"] })] });
  ok(procedencias(E).join(" ").includes(`${NOMBRE_DE_UMBRAL.frenadoDiasSinVenta}: ${ETIQUETA_ORIGEN.sin_declarar}`), "sin umbral (ni empresa ni consulta) → «sin umbral declarado», junto al límite «sin evaluar»", procedencias(E).join(" "));
}
{
  initTenant(TENANT_PERFIL({ frenadoDiasSinVenta: 75 }));
  const { E } = entregaDe({ partes: [INV({ universo: { eje: "sku", estados: ["frenado"] }, conceptos: ["dias_sin_venta"] })] });
  ok(procedencias(E).join(" ").includes(`${NOMBRE_DE_UMBRAL.frenadoDiasSinVenta}: ${ETIQUETA_ORIGEN.empresa}`), "con el umbral en el PERFIL de la empresa → «declarado por la empresa»", procedencias(E).join(" "));
  initTenant(TENANT_DEMO);
}

H("A1 · CARNADA · el origen SIGUE al perfil (no está escrito a mano): si la empresa declara el umbral de sobrestock, la cláusula cambia");
{
  const enc = { partes: [INV({ universo: { eje: "sku", estados: ["inmovilizado"] } })] };
  const antes = procedencias(entregaDe(enc).E).join(" ");
  initTenant(TENANT_PERFIL({ sobrestockDohMin: 45 }));
  const despues = procedencias(entregaDe(enc).E).join(" ");
  ok(antes.includes(`${NOMBRE_DE_UMBRAL.sobrestockDohMin}: ${ETIQUETA_ORIGEN.adi}`) && despues.includes(`${NOMBRE_DE_UMBRAL.sobrestockDohMin}: ${ETIQUETA_ORIGEN.empresa}`), "sobrestock: criterio de ADI en el demo → declarado por la empresa cuando su perfil lo declara", `${antes} || ${despues}`);
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

H("CERO llamadas a un LLM · CERO red — solo por npm run gates:offline");
{
  const fuente = fs.readFileSync("./_v12_correcciones_gate.mjs", "utf8");
  const c = clasificarFuente(fuente);
  ok(c.tipo === "offline", "clasificarFuente(_v12_correcciones_gate.mjs) === offline", JSON.stringify(c));
}

console.log(`\n── _v12_correcciones_gate: PASS ${pass} · FAIL ${fail} (de ${pass + fail}) ──`);
if (fail) console.log(fails.map((f) => `  ✗ ${f}`).join("\n"));
process.exit(fail ? 1 : 0);
