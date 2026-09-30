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
 *   A11 · diagnóstico v18: la cartera de cobranza sirve los N clientes (C-A) · el filtro con `ref` pone en juego la referencia de la consulta (C-B) · el Marco declara el nivel de carga oficial (C-C) ·
 *         el puesto empatado dice con quién empata (C-D) · `verificarEntrega` no acusa por sustring (C-E).
 *   A13 · diagnóstico v19: `==` con el crudo (Y96) · la razón de un miembro es la condición que NO cumple (Y41 · Y11 · Y14) · la unión dice cada rama (Y10) · la referencia de un filtro con `ref` en la premisa de orden (Y24) ·
 *         el Marco declara todas las referencias oficiales (Y40, 42b) · la cartera completa con sus 0 días (Y20, 42c) · la bodega excluida se nombra (Y74) · el empate del orden dice con quién (Y06, 42a).
 *   A14 · diagnóstico v19 (§7.3·43): el orden servido con empate declara el puesto compartido y quiénes lo comparten (b, Y02) · la relación juzgada dice la cifra de CADA lado (c, Y31) ·
 *         una cifra sobre un eje completo sin orden pedido se exhibe con lo que pide atención primero, según la polaridad (f).
 *   A15 · diagnóstico v20 (§7.3·43): una parte no_resuelta no reporta entidades (d) · el Marco comercial cita el benchmark sea cual sea la herramienta (e) · una lectura con eje explícito sirve el eje (U06 U42) ·
 *         el cero de un empate por ausencia en palabras y el del SUJETO (U06 U91) · el SKU fuera por la bodega PEDIDA dice su bodega (U62) · una definición sin curar se declara (U34).
 *
 *   A16 · diagnóstico v20 (§7.3·44): un top cuyo filo cae dentro de un empate sirve a TODOS los empatados y lo declara, y la premisa de pertenencia sobre un empatado del filo es verdadera y lo declara (a, Y73 U10) ·
 *         el «de M» de un conteo es el de la premisa (d, U62) · cada premisa lleva UNA sola traza «La verdad: …» (e).
 *
 *   A17 · diagnóstico v21 (§7.3·44): una lectura/decision sin universo sirve su FOTO completa (el universo del productor) con la prioridad encima (c, T15–T19 T28 T40 T99) · el top por recuperado trae las cuentas fuera de la mesa de 8 (T06) ·
 *         la oración que declara un empate no la retira el tope de tamaño (T100) · la pertenencia en el filo nombra al sujeto (T02 T32) · una definición sin curar se declara, no toma la de otra parte (T14) y se titula «objetivo» (T12) ·
 *         la verdad propia dentro del top que falla el estado es la cifra del estado (T46) · la exclusión por bodega lleva la referencia (T47) · los ceros por ausencia de una cifra sin top se empatan y se declaran (T36).
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
import { benchmarkOf, ETIQUETA_ORIGEN, umbral, NOMBRE_DE_UMBRAL, FAMILIAS_DE_PROCEDENCIA, clausulasDeProcedencia, procedenciaDeUmbrales, procedenciaDeUmbral, esProcedenciaDeCriterio, formatoDeUmbral, setBenchmarkOverride } from "./src/config/businessPolicy.js";
import { UMBRALES_DE_ESTADO, ESTADO_DE_CONCEPTO, ESTADOS_CANON, umbralesDeEstados, estadoDeLaPremisa } from "./src/adi/notario/estados.js";
import { clasificarFuente } from "./scripts/clasificarGates.mjs";
import { TOOLS } from "./src/adi/oracle/toolRegistry.js";
import { cajaDelAgente } from "./src/adi/agente/herramientasAgente.js";
import { buildMesaFlujo } from "./src/adi/sentrix/mesaFlujo.js";
import { objetivoPorMeta } from "./src/adi/llm/voiceGuard.js";
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

/* ═══ A11 · DIAGNÓSTICO v18 (medición ciega v18, catálogo sellado v18) ══════════════════════════════════════════════════════════════════
 * Cinco raíces de ADI, cada una con su carnada en POSITIVO (la corrección dice lo verdadero) y en NEGATIVO (el control que NO debe cambiar):
 *   C-A · una `cifra` de cobranza que sirve «la cartera» (sin entidades y sin restricción propia) sirve el eje ENTERO, no el top 8 fijo de `cobranza()` (§7.3·21: nunca se recorta el conjunto): opt-in `mesaCompleta`.
 *   C-B · un FILTRO que cita la referencia de la casa (`filtros[].ref`) pone en juego la referencia de la consulta igual que una `base` (§7.3·12/·19): se declara al lado, nunca se pierde en silencio.
 *   C-C · el Marco declara el nivel de carga OFICIAL cuando un conjunto de la casa lo define (`sobre el nivel declarado de carga`), aunque otra referencia ocupe `referenciaDeclarada`.
 *   C-D · la verdad propia de una entidad EMPATADA en el ranking del top comparte el puesto y dice con quién empata (nunca un «puesto 5» que es un desempate invisible).
 *   C-E · `verificarEntrega` no acusa a un dueño de una cifra ajena por sustring («3%» ⊂ «0.3%» · «$14K» ⊃ «4»); una cifra ajena de verdad sigue acusada.
 * Oráculos: los rankings de la proyección (`cifrasDelDato`), el índice del eje (`axisEntityNames`) y el umbral declarado (`umbral()`); nunca el código que se corrige. */
const _tiene = (E, nombre, tema) => {
  const filas = [...((E.entrega.cifras && E.entrega.cifras.filas) || []), ...((E.entrega.detalle && E.entrega.detalle.filas) || [])];
  return filas.some((f) => f.valores["Entidad / grupo"] === nombre && (!tema || f.valores["Tema"] === tema));
};

H("A11 · C-A · una `cifra` de cobranza que sirve «la cartera» sirve los 13 clientes (Cifras + Detalle), con o sin `{eje}`; una restricción propia sigue sirviendo solo su conjunto");
{
  const todos = ejes.cliente || [];
  for (const universo of [{ eje: "cliente" }, undefined]) {
    const { E } = entregaDe({ partes: [{ id: "p1", tema: "cobranza", cierre: "cifra", conceptos: ["saldo_pendiente", "recuperado"], ...(universo ? { universo } : {}) }] });
    const u = E.entrega.universos.find((x) => x.id === "p1");
    ok(todos.length === 13 && !!u && u.entidades.length === 13 && todos.every((n) => u.entidades.includes(n)), `«${universo ? "{eje:cliente}" : "sin universo"}»: el universo declarado son los 13 clientes (antes: el top 8 fijo)`, u && JSON.stringify(u.entidades));
    ok(todos.every((n) => _tiene(E, n, "cobranza")), `«${universo ? "{eje:cliente}" : "sin universo"}»: cada uno de los 13 tiene su fila (en Cifras o en Detalle): ninguna cuenta declarada queda sin servir`, todos.filter((n) => !_tiene(E, n, "cobranza")).join(", "));
  }
  const { E: E2 } = entregaDe({ partes: [{ id: "p1", tema: "cobranza", cierre: "cifra", conceptos: ["dias_vencido", "saldo_vencido"], universo: { eje: "cliente" } }] });
  const filasR = [...E2.entrega.cifras.filas, ...((E2.entrega.detalle && E2.entrega.detalle.filas) || [])].filter((f) => f.valores["Entidad / grupo"] === "Ripley").map((f) => `${f.valores["Métrica"]}=${f.valores["Valor"]}`);
  ok(filasR.includes("Días vencido=0d") && filasR.includes("Saldo vencido=$0"), "una cuenta al día (Ripley) trae su 0 días y su saldo vencido $0: ausente = cero, un hecho", filasR.join(" | "));
  const { E: E3 } = entregaDe({ partes: [{ id: "p1", tema: "cobranza", cierre: "cifra", conceptos: ["saldo_pendiente"], universo: { eje: "cliente", top: { metrica: "saldo_pendiente", k: 3 } } }] });
  const u3 = E3.entrega.universos.find((x) => x.id === "p1");
  ok(!!u3 && u3.entidades.length === 3, "CONTROL NEGATIVO · un universo con `top` k=3 sigue sirviendo 3 (la mesa completa no ensancha lo que el encargo restringe)", u3 && JSON.stringify(u3.entidades));
  const { E: E4 } = entregaDe({ partes: [{ id: "p1", tema: "cobranza", cierre: "cifra", conceptos: ["saldo_pendiente"], entidades: [{ nombre: "Unimarc" }] }] });
  const u4 = E4.entrega.universos.find((x) => /p1/.test(x.id));
  ok(!!u4 && u4.entidades.length === 1 && u4.entidades[0] === "Unimarc", "CONTROL NEGATIVO · una cuenta puntual sigue sirviendo solo esa cuenta", u4 && JSON.stringify(u4.entidades));
  const caja = cajaDelAgente(TOOLS);
  const nombres = (args) => new Set(((caja.cobranza({ scenario: ESCENARIO_INICIAL, ...args }).boleta) || []).map((x) => String(x.label).split(" · ")[0]));
  const sin = nombres({}), con = nombres({ mesaCompleta: true });
  ok(!sin.has("Unimarc") && !sin.has("Ripley") && todos.every((n) => con.has(n)), "CANDADO · `mesaCompleta` es opt-in del Encargo: la boleta del agente (sin él) sigue con el top 8 fijo; con él trae los 13", `sin=${[...sin].length} con=${[...con].length}`);
}

H("A11 · C-B · un FILTRO con `ref` pone en juego la referencia de la consulta: se declara al lado de la oficial (parte o premisa), sin repetirse");
{
  const cargaMayor = (v) => RK.cliente.carga.filas.filter((f) => f.valor > v).length;
  const filtro = { eje: "cliente", filtros: [{ metrica: "carga", op: ">", ref: "nivel_carga" }] };
  const encC = (extra = {}) => ({ partes: [{ id: "p1", tema: "comercial", cierre: "cifra", conceptos: ["carga", "ventas"], universo: filtro }], criterio: { referencia: { concepto: "nivel_carga", valor: 4, unidad: "pct" } }, ...extra });
  const { E } = entregaDe(encC());
  const lims = E.entrega.limites.filter((l) => /referencia planteada en la consulta/i.test(l.titulo));
  ok(lims.length === 1 && lims[0].titulo.includes("(4%)") && new RegExp(`Serían ${cargaMayor(4)} cuentas`).test(lims[0].motivo) && /no reemplaza la referencia oficial/.test(lims[0].motivo), `nivel de carga 4 % planteado sobre un filtro con \`ref\`: UN límite «(4%)» con las ${cargaMayor(4)} cuentas que daría (oráculo: el ranking de carga) y «no reemplaza la referencia oficial»`, lims.map((l) => `${l.titulo} | ${l.motivo}`).join(" || "));
  ok(/Nivel de carga declarado: 3\.5%/.test((E.entrega.marco.referenciaDeclarada || {}).texto || ""), "el Marco sigue con el nivel OFICIAL (3.5%), nunca el de la consulta");
  const { E: EP } = entregaDe({ partes: [{ id: "p1", tema: "comercial", cierre: "cifra", conceptos: ["ventas"], universo: { eje: "cliente" } }], premisas: [{ id: "q1", tipo: "conteo", conteo: { n: 9, m: 13 }, de: filtro }], criterio: { referencia: { concepto: "nivel_carga", valor: 4, unidad: "pct" } } });
  ok(EP.entrega.limites.some((l) => /referencia planteada en la consulta/i.test(l.titulo) && l.titulo.includes("(4%)")), "el mismo filtro con `ref` solo en el universo de una PREMISA también declara la referencia de la consulta");
  const { E: EB } = entregaDe({ partes: [{ id: "p1", tema: "comercial", cierre: "cifra", conceptos: ["margen", "ventas"], universo: { eje: "cliente", filtros: [{ metrica: "margen", op: "<", ref: "benchmark" }] } }], criterio: { referencia: { concepto: "benchmark", valor: 33, unidad: "pct" } } });
  const limB = EB.entrega.limites.find((l) => /referencia planteada en la consulta/i.test(l.titulo));
  const bajo33 = RK.cliente.margen.filas.filter((f) => f.valor < 33).length;
  ok(!!limB && limB.titulo.includes("(33%)") && new RegExp(`Serían ${bajo33} cuentas`).test(limB.motivo), `la misma ley con el benchmark (33 %, «<» sobre \`ref:"benchmark"\`): «Serían ${bajo33} cuentas» (oráculo: el ranking de margen)`, limB && limB.motivo);
  const { E: E0 } = entregaDe(encC({ criterio: undefined }));
  ok(!E0.entrega.limites.some((l) => /referencia planteada en la consulta/i.test(l.titulo)), "CONTROL NEGATIVO · sin `criterio.referencia` no se declara ninguna");
  const { E: EV } = entregaDe({ partes: [{ id: "p1", tema: "comercial", cierre: "cifra", conceptos: ["carga", "ventas"], universo: { eje: "cliente", filtros: [{ metrica: "carga", op: ">", valor: 4 }] } }], criterio: { referencia: { concepto: "nivel_carga", valor: 4, unidad: "pct" } } });
  ok(!EV.entrega.limites.some((l) => /referencia planteada en la consulta/i.test(l.titulo)), "CONTROL NEGATIVO · un filtro con `valor` propio (no cita la referencia de la casa) no pone en juego la referencia: nada que declarar al lado");
  const { E: EO } = entregaDe({ partes: [{ id: "p1", tema: "comercial", cierre: "cifra", conceptos: ["carga", "ventas"], universo: filtro }], criterio: { referencia: { concepto: "benchmark", valor: 33, unidad: "pct" } } });
  ok(!EO.entrega.limites.some((l) => /referencia planteada en la consulta/i.test(l.titulo)), "CONTROL NEGATIVO · una referencia de OTRA familia (benchmark) sobre un filtro que cita el nivel de carga no se declara");
}

H("A11 · C-C · el Marco declara el nivel de carga OFICIAL cuando un conjunto de la casa lo define, aunque otra referencia ocupe el campo");
{
  const nivel = umbral("targetCarga").valor;
  const base = (b) => ({ partes: [{ id: "p1", tema: "comercial", cierre: "decision", conceptos: ["carga", "no_capturada", "contribucion"], universo: { eje: "cliente", base: b } }] });
  const { E } = entregaDe(base("sobre el nivel declarado de carga"));
  const ref = (E.entrega.marco.referenciaDeclarada || {}).texto || "";
  ok(new RegExp(`Nivel de carga declarado: ${nivel}%, declarado por la empresa\\.`).test(ref), `base «sobre el nivel declarado de carga»: el Marco dice «Nivel de carga declarado: ${nivel}%, declarado por la empresa» (oráculo: umbral().valor)`, ref);
  ok(ref.split("Nivel de carga declarado").length === 2, "…una sola vez (no se duplica si otra ruta ya lo había declarado)", ref);
  ok(/Benchmark de margen: 30\.1%/.test(ref) ? /Nivel de carga declarado/.test(ref) : true, "si el benchmark de las observaciones de controller ocupó el campo, el nivel se AGREGA (no queda sin declarar)", ref);
  /* v19 (§7.3·42b): la v18 leía «carga comercial alta» solo por su piso de materialidad y NO agregaba el nivel; el detector es carga > nivel Y exceso ≥ piso, y su veredicto imprime el nivel: el Marco también lo lleva (bloque A13·Y40) */
  const { E: E2 } = entregaDe({ partes: [{ id: "p1", tema: "comercial", cierre: "cifra", conceptos: ["ventas", "margen"], universo: { eje: "cliente" } }] });
  ok(!/Nivel de carga declarado/.test((E2.entrega.marco.referenciaDeclarada || {}).texto || ""), "CONTROL NEGATIVO · un encargo que no usa el nivel de carga no lo declara en el Marco");
}

H("A11 · C-D · la verdad propia de una entidad EMPATADA en el ranking del top comparte el puesto y dice con quién empata");
{
  const dias = Object.fromEntries(RK.cliente.dias_vencido.filas.map((f) => [f.entidad, f.valor]));
  const enMora = Object.keys(dias).filter((n) => dias[n] > 0).sort((a, b) => dias[b] - dias[a]);
  const universo = { eje: "cliente", estados: ["en mora"], top: { metrica: "dias_vencido", k: 3 } };
  const { E } = entregaDe({ partes: [{ id: "p1", tema: "cobranza", cierre: "cifra", conceptos: ["dias_vencido"], universo }], premisas: [{ id: "q1", tipo: "grupo", miembros: ["Tottus"], universo }] });
  const t = oracionDe(E, "Tottus");
  const iguales = enMora.filter((n) => dias[n] === dias.Tottus && n !== "Tottus");
  const primero = enMora.findIndex((n) => dias[n] === dias.Tottus) + 1;
  ok(iguales.length === 2 && new RegExp(`puesto ${primero} de ${enMora.length} `).test(t) && iguales.every((n) => t.includes(n)) && /empatado con/.test(t), `Tottus (8 días) empata con ${iguales.join(" y ")}: «puesto ${primero} de ${enMora.length}» (el del primero del empate, no una posición de desempate) y nombra a los empatados`, t);
  ok(!/puesto 5 de/.test(t), "nunca el «puesto 5» que solo era la posición dentro de la lista ordenada", t);
  const univS = { eje: "cliente", top: { metrica: "saldo_pendiente", k: 3 } };
  const { E: E2 } = entregaDe({ partes: [{ id: "p1", tema: "cobranza", cierre: "cifra", conceptos: ["saldo_pendiente"], universo: univS }], premisas: [{ id: "q1", tipo: "grupo", miembros: ["Jumbo"], universo: univS }] });
  const t2 = oracionDe(E2, "Jumbo");
  ok(/puesto \d+ de 13/.test(t2) && !/empat/.test(t2), "CONTROL NEGATIVO · una entidad con cifra única (Jumbo, saldo pendiente) dice su puesto sin «empatado»", t2);
}

H("A11 · C-E · `verificarEntrega` no acusa por sustring («3%» ⊂ «0.3%», «$14K» ⊃ «4»); una cifra que SÍ es de otro dueño sigue acusada");
{
  const enc = { version: "encargo/v1", partes: [
    { id: "p1", tema: "comercial", cierre: "simulacion", conceptos: ["ventas", "contribucion"], eje: "marca", entidades: [{ nombre: "Bosch", eje: "marca" }], supuestos: ["s1"] },
    { id: "p2", tema: "comercial", cierre: "simulacion", conceptos: ["ventas", "contribucion"], entidades: [{ nombre: "Ripley" }], supuestos: ["s2"] }],
    supuestos: [{ id: "s1", tipo: "growth", valor: 3, unidad: "pct", alcance: { eje: "marca", nombre: "Bosch" }, origen: "supuesto" }, { id: "s2", tipo: "growth", valor: 14157, unidad: "money", alcance: { eje: "cliente", nombre: "Ripley" }, origen: "supuesto" }],
    premisas: [{ id: "q1", tipo: "orden", sujeto: "Bosch", metrica: "ventas", orden: { forma: "puesto", k: 4 }, universo: { eje: "marca" } }] };
  const R = validarEncargo(enc, {}); const E = componerEntrega(R);
  const audita = (Ent, texto) => verificarEntrega({ texto, entrega: Ent, profundidad: "completa", resolucion: R, indice: (Ent.procedencia && Ent.procedencia.libro && Ent.procedencia.libro.indice) || null }).violaciones.filter((v) => v.regla === "dueno-de-cifra-equivocado");
  ok(E.ok && audita(E.entrega, E.texto).length === 0, "Bosch «el volumen sube 3%» (su supuesto) y Ripley «$14K … 0.3%»: ningún dueño equivocado (el «3%» no es el «0.3%» de Ripley ni el «$14K» un «4»)", JSON.stringify(audita(E.entrega, E.texto)));
  const mut = { ...E.entrega, respuesta: E.entrega.respuesta.map((r) => (/^Bosch — simulación/.test(r.texto) ? { ...r, texto: "Bosch — simulación: el volumen sube 0.3%." } : r)) };
  const vs = audita(mut, E.texto.replace(/Bosch — simulación: el volumen sube 3%\./, "Bosch — simulación: el volumen sube 0.3%."));
  ok(vs.some((v) => /atribuye a "Bosch" la cifra "0\.3%"/.test(v.detalle) && /Ripley/.test(v.detalle)), "CARNADA · la cifra EXACTA de otra cuenta (Ripley 0.3 %) dicha como de Bosch SÍ se acusa: «dueno-de-cifra-equivocado»", JSON.stringify(vs));
}

/* ═══ A12 · §7.3·42(e) (diagnóstico v18, supervisor) — una pregunta abierta que presupone mora solo se hace sobre una cuenta EN MORA ═══ */
H("A12 · 42(e) · «¿plazo pactado o atraso real?» solo sobre una cuenta en mora (el estado de la casa); una cuenta al día no se pregunta");
{
  const preguntaDe = (E) => JSON.stringify((E.entrega && E.entrega.paraSuJuicio) || []).match(/La deuda de [^?]{0,60}\?/g) || [];
  const cifraDe = (nombre) => entregaDe({ partes: [{ id: "p1", tema: "cobranza", cierre: "cifra", conceptos: ["saldo_vencido"], entidades: [{ nombre }] }] }).E;
  const eJ = cifraDe("Jumbo"), eL = cifraDe("Lider");
  ok(eJ.ok && !preguntaDe(eJ).some((q) => /Jumbo/.test(q)), "Jumbo (saldo vencido 0, al día): la Entrega NO pregunta «¿plazo pactado o atraso real?» — presupondría una mora que no existe", JSON.stringify(preguntaDe(eJ)));
  ok(eL.ok && preguntaDe(eL).some((q) => /Lider/.test(q)), "CONTROL · Lider (en mora, 269 días): la pregunta abierta de cobranza sigue", JSON.stringify(preguntaDe(eL)));
}

/* ═══ A13 · DIAGNÓSTICO v19 (medición ciega v19, catálogo sellado v19) ══════════════════════════════════════════════════════════════════
 * Diez raíces de ADI, cada una con su carnada en POSITIVO (la corrección dice lo verdadero) y en NEGATIVO (el control que NO debe cambiar):
 *   Y96 · un filtro `==` se juzga con el CRUDO (§7.3·23), no dentro de la tolerancia del muro: «capital == 11200» es BOS-SANDER, no PHI-SHAVER9 ($11.4K; los dos se imprimen «$11K»).
 *   Y41 · el top se calcula DENTRO del conjunto ya filtrado (§7.3·8): la entidad que el ESTADO deja fuera dice la cifra del estado (0 días sin venta), no el capital del top.
 *   Y11 · la verdad propia de un miembro nombra la condición que NO cumple (rota bien), no la base que sí cumple (bajo el benchmark).
 *   Y14 · …y el filtro que NO pasa, no el primero de la lista (La Polar pasa la carga y sale por el benchmark); la referencia de cada condición viaja en la frase de su miembro.
 *   Y10 · una UNIÓN deja fuera a quien no cumple ninguna rama: la verdad dice la cifra de cada rama (antes caía a la traza del Notario, sin entidad).
 *   Y24 · un filtro con `ref` en el universo de una premisa de ORDEN verdadera imprime el valor de la referencia (comparables juntas, §7.3·12/19).
 *   Y40 · 42(b): el Marco declara todas las referencias oficiales con que se juzgó: «carga comercial alta» también lleva el nivel de carga; el benchmark de la base no se pierde si otra referencia ocupó el campo.
 *   Y20 · 42(c): la cartera completa trae el «Días vencido 0d» de TODA cuenta sana (también las del top 8); la boleta del agente sin el opt-in no cambia.
 *   Y74 · un SKU que la consulta deja fuera por SU BODEGA (`excluir.bodega`) dice la bodega, sin una cifra de otra condición.
 *   Y06 · 42(a) en el ORDEN: el puesto empatado de la verdad propia de un orden falso dice con quién empata; el cero de un empate se dice en palabras (39c).
 * Oráculos: los rankings de la proyección (`cifrasDelDato`), el estado por bodega de la proyección y el benchmark/nivel declarados (`benchmarkOf`, `umbral()`); nunca el código que se corrige. */
const _premisasDe = (E) => oracionesDe(E);
const _univDe = (E, id = "p1") => (E.entrega.universos || []).find((x) => x.id === id);

H("A13 · Y96 · el filtro `==` se juzga con el CRUDO: «capital == $11.200» es solo BOS-SANDER, no PHI-SHAVER9 ($11.4K, que también se imprime «$11K»)");
{
  const filas = RK.sku.capital.filas;
  const exacto = filas.filter((f) => f.raw === 11200).map((f) => f.entidad);
  const impresoIgual = filas.filter((f) => Math.round(f.raw / 1000) === 11).map((f) => f.entidad);
  const univ = { eje: "sku", filtros: [{ metrica: "capital", op: "==", valor: 11200 }] };
  const { E } = entregaDe({ partes: [{ id: "p1", tema: "inventario", cierre: "cifra", conceptos: ["capital"], eje: "sku", universo: univ }], premisas: [{ id: "q1", tipo: "conteo", conteo: { n: 1, m: 13 }, de: univ }, { id: "q2", tipo: "grupo", miembros: ["PHI-SHAVER9"], universo: univ }, { id: "q3", tipo: "grupo", miembros: ["BOS-SANDER"], universo: univ }] });
  const u = _univDe(E), ps = _premisasDe(E);
  ok(exacto.length === 1 && impresoIgual.length === 2 && !!u && u.entidades.length === 1 && u.entidades[0] === exacto[0], `el universo declarado es SOLO ${exacto[0]} (crudo $11.200); ${impresoIgual.join(" y ")} comparten el impreso «$11K» y no cuentan como iguales`, u && JSON.stringify(u.entidades));
  ok(/es correcto — 1 de 13/.test(ps[0] || "") && /no es así — PHI-SHAVER9/.test(ps[1] || "") && /es correcto — BOS-SANDER/.test(ps[2] || ""), "«es 1 de 13» verdadera · «PHI-SHAVER9 está en el grupo» FALSA · «BOS-SANDER está en el grupo» verdadera", JSON.stringify(ps));
  const { E: E2 } = entregaDe({ partes: [{ id: "p1", tema: "comercial", cierre: "cifra", conceptos: ["margen"], universo: { eje: "cliente", filtros: [{ metrica: "margen", op: "==", valor: 22 }] } }] });
  const igual22 = RK.cliente.margen.filas.filter((f) => f.valor === 22).map((f) => f.entidad);
  const u2 = _univDe(E2);
  ok(igual22.length === 1 && !!u2 && u2.entidades.length === 1 && u2.entidades[0] === igual22[0], `CONTROL · «margen == 22 %» sigue sirviendo a ${igual22[0]} (la igualdad exacta sigue igualando)`, u2 && JSON.stringify(u2.entidades));
  const { E: E3 } = entregaDe({ partes: [{ id: "p1", tema: "inventario", cierre: "cifra", conceptos: ["capital"], eje: "sku", universo: { eje: "sku", filtros: [{ metrica: "capital", op: "entre", valor: [11200, 11400] }] } }] });
  const u3 = _univDe(E3);
  ok(!!u3 && u3.entidades.length === 2, "CONTROL · «entre $11.200 y $11.400» (inclusivo) sigue trayendo a los dos", u3 && JSON.stringify(u3.entidades));
}

H("A13 · Y41 · con estado + top, la entidad que el ESTADO deja fuera dice la cifra del estado (0 días sin venta), no el capital del top");
{
  const univ = { eje: "sku", estados: ["sin venta"], top: { metrica: "capital", k: 3 } };
  const mk = (miembros) => entregaDe({ partes: [{ id: "p1", tema: "inventario", cierre: "cifra", conceptos: ["capital", "dias_sin_venta"], eje: "sku", universo: univ }], premisas: [{ id: "q1", tipo: "grupo", miembros, universo: univ }] });
  const cero = RK.sku.dias_sin_venta.filas.find((f) => f.entidad === "SAM-REF500L").valor;
  const { E } = mk(["PHI-IRON-PRO", "SAM-REF500L"]);
  const tRef = _premisasDe(E)[0] || "";
  const segRef = (tRef.match(/SAM-REF500L:[^;]*/) || [""])[0];
  ok(cero === 0 && /no tiene días sin venta \(0 días\)/.test(segRef) && !/capital/.test(segRef), "SAM-REF500L (vendió al corte: 0 días sin venta) sale por el ESTADO «sin venta»: dice «no tiene días sin venta (0 días)» y ningún capital (antes «capital $19K», que lo leía como si el top lo incluyera)", tRef);
  const segIron = (tRef.match(/PHI-IRON-PRO:[^;]*/) || [""])[0];
  ok(/capital \$10K/.test(segIron) && /puesto 4 de 8/.test(segIron), "CONTROL · PHI-IRON-PRO SÍ está sin venta y sale por el top: sigue diciendo su capital y su puesto (4 de 8)", tRef);
  const { E: E2 } = mk(["PHI-SHAVER9"]);
  const t2 = _premisasDe(E2)[0] || "";
  ok(/PHI-SHAVER9: no tiene días sin venta \(0 días\)/.test(t2) && !/capital/.test(t2), "el mismo criterio con un solo miembro (PHI-SHAVER9, 0 días)", t2);
}

H("A13 · Y11 · la verdad propia nombra la condición que la entidad NO cumple: PHI-IRON-PRO SÍ está bajo el benchmark y sale por rotar bien");
{
  const univ = { eje: "sku", base: "SKU bajo el benchmark", estados: ["rota lento"] };
  const mk = (miembros) => entregaDe({ partes: [{ id: "p1", tema: "inventario", cierre: "cifra", conceptos: ["rotacion", "capital"], eje: "sku", universo: univ }], premisas: [{ id: "q1", tipo: "grupo", miembros, universo: univ }] });
  const rot = RK.sku.rotacion.filas.find((f) => f.entidad === "PHI-IRON-PRO").valor;
  const mvIron = RK.sku.margen_venta.filas.find((f) => f.entidad === "PHI-IRON-PRO").valor;
  const t = _premisasDe(mk(["PHI-IRON-PRO"]).E)[0] || "";
  ok(mvIron < benchmarkOf() && /PHI-IRON-PRO: rotación 2\.4x/.test(t) && rot === 2.4 && !/margen de venta/.test(t), "PHI-IRON-PRO (margen 22 % < benchmark: cumple la base) dice su ROTACIÓN 2.4x (rota bien: lo que falla), nunca «margen de venta 22 %»", t);
  const mvSaw = RK.sku.margen_venta.filas.find((f) => f.entidad === "MAK-SAW18V").valor;
  const t2 = _premisasDe(mk(["MAK-SAW18V"]).E)[0] || "";
  ok(mvSaw > benchmarkOf() && /MAK-SAW18V: margen de venta 34%/.test(t2), "CONTROL · MAK-SAW18V (margen 34 % > benchmark) SÍ falla la base: dice su margen de venta", t2);
}

H("A13 · Y14 · el filtro que la entidad NO pasa decide, y la referencia de cada condición viaja en la frase de su miembro");
{
  const univ = { eje: "cliente", base: "bajo el benchmark", filtros: [{ metrica: "carga", op: ">", ref: "nivel_carga" }] };
  const { E } = entregaDe({ partes: [{ id: "p1", tema: "comercial", cierre: "cifra", conceptos: ["margen", "carga"], universo: univ }], premisas: [{ id: "q1", tipo: "grupo", miembros: ["Tottus", "La Polar"], universo: univ }] });
  const t = _premisasDe(E)[0] || "";
  const segT = (t.match(/Tottus:[^;]*/) || [""])[0], segL = (t.match(/La Polar:[^;.]*(?:\.\d%|%)[^;]*/) || [""])[0];
  const carga = (n) => RK.cliente.carga.filas.find((f) => f.entidad === n).valor, margen = (n) => RK.cliente.margen.filas.find((f) => f.entidad === n).valor;
  ok(carga("Tottus") <= umbral("targetCarga").valor && new RegExp(`carga comercial ${carga("Tottus")}%`).test(segT) && new RegExp(`nivel de carga declarado ${umbral("targetCarga").valor}%`).test(segT), "Tottus (bajo el benchmark, carga 3.2 % que NO supera el nivel): dice su carga y el nivel 3.5 % en SU frase", t);
  ok(margen("La Polar") > benchmarkOf() && carga("La Polar") > umbral("targetCarga").valor && new RegExp(`margen ${margen("La Polar")}%`).test(segL) && !/carga comercial/.test(segL) && new RegExp(`benchmark de margen ${benchmarkOf()}%`).test(segL), "La Polar (34 % > benchmark: sale por la BASE; su carga 3.9 % SÍ pasa el filtro): dice su margen y el benchmark, nunca «carga comercial 3.9 %»", t);
}

H("A13 · Y10 · una UNIÓN deja fuera a quien no cumple ninguna rama: la verdad dice la cifra de cada rama (antes caía a la traza, sin entidad)");
{
  const univ = { eje: "cliente", union: [{ eje: "cliente", base: "sobre el benchmark" }, { eje: "cliente", base: "sobre el nivel declarado de carga" }] };
  const { E } = entregaDe({ partes: [{ id: "p1", tema: "comercial", cierre: "cifra", conceptos: ["margen", "carga"], universo: univ }], premisas: [{ id: "q1", tipo: "grupo", miembros: ["Tottus", "Mercado Libre"], universo: univ }, { id: "q2", tipo: "grupo", miembros: ["La Polar"], universo: univ }] });
  const t = _premisasDe(E)[0] || "";
  const m = (n) => RK.cliente.margen.filas.find((f) => f.entidad === n).valor, c = (n) => RK.cliente.carga.filas.find((f) => f.entidad === n).valor;
  ok(t.includes(`Tottus: margen ${m("Tottus")}%, carga comercial ${c("Tottus")}%`) && t.includes(`Mercado Libre: margen ${m("Mercado Libre")}%, carga comercial ${c("Mercado Libre")}%`), "Tottus y Mercado Libre (fuera por los dos lados): cada una con su margen y su carga, no la traza del universo sin entidad", t);
  ok(new RegExp(`benchmark de margen ${benchmarkOf()}%`).test(t) && new RegExp(`nivel de carga declarado ${umbral("targetCarga").valor}%`).test(t), "…con las dos referencias de la unión en la misma oración", t);
  ok(/es correcto — La Polar/.test(_premisasDe(E)[1] || ""), "CONTROL · La Polar (34 %, sobre el benchmark) SÍ está en la unión: la premisa es verdadera y no dice ninguna verdad propia", _premisasDe(E)[1]);
}

H("A13 · Y24 · un filtro con `ref` en el universo de una premisa de ORDEN verdadera imprime el valor de la referencia");
{
  const univ = { eje: "cliente", filtros: [{ metrica: "margen", op: ">=", ref: "benchmark" }] };
  const { E } = entregaDe({ partes: [{ id: "p1", tema: "comercial", cierre: "cifra", conceptos: ["ventas", "margen"], universo: univ }], premisas: [{ id: "q1", tipo: "orden", sujeto: "Easy", metrica: "ventas", orden: { forma: "max" }, universo: univ }] });
  const t = _premisasDe(E)[0] || "";
  ok(/es correcto — Easy/.test(t) && new RegExp(`benchmark de margen ${benchmarkOf()}%`).test(t), `«Easy es la de más venta entre las que alcanzan el benchmark» (verdadera): la oración lleva «benchmark de margen ${benchmarkOf()}%»`, t);
  const { E: E2 } = entregaDe({ partes: [{ id: "p1", tema: "comercial", cierre: "cifra", conceptos: ["ventas"], universo: { eje: "cliente" } }], premisas: [{ id: "q1", tipo: "orden", sujeto: "Falabella", metrica: "ventas", orden: { forma: "max" }, universo: { eje: "cliente" } }] });
  ok(!/benchmark/.test(_premisasDe(E2)[0] || ""), "CONTROL · un orden sin filtro con `ref` no arrastra ninguna referencia", _premisasDe(E2)[0]);
}

H("A13 · Y40 · 42(b): el Marco declara todas las referencias oficiales con que se juzgó («carga comercial alta» lleva el nivel; el benchmark de la base no se pierde)");
{
  const nivel = umbral("targetCarga").valor;
  const marco = (E) => ((E.entrega.marco.referenciaDeclarada || {}).texto || "");
  const { E } = entregaDe({ partes: [{ id: "p1", tema: "comercial", cierre: "cifra", conceptos: ["carga", "no_capturada"], universo: { eje: "cliente", base: "carga comercial alta" } }] });
  ok(new RegExp(`Nivel de carga declarado: ${nivel}%, declarado por la empresa\\.`).test(marco(E)) && marco(E).split("Nivel de carga declarado").length === 2, `base «carga comercial alta»: el Marco lleva el nivel oficial ${nivel} % (el detector es carga > nivel Y exceso ≥ piso; el veredicto ya lo imprime), una sola vez`, marco(E));
  const univ = { eje: "cliente", base: "bajo el benchmark", filtros: [{ metrica: "carga", op: ">", ref: "nivel_carga" }] };
  const { E: E2 } = entregaDe({ partes: [{ id: "p1", tema: "comercial", cierre: "cifra", conceptos: ["margen", "carga"], universo: univ }], premisas: [{ id: "q1", tipo: "grupo", miembros: ["Tottus"], universo: univ }] });
  ok(new RegExp(`Benchmark de margen: ${benchmarkOf()}%`).test(marco(E2)) && new RegExp(`Nivel de carga declarado: ${nivel}%`).test(marco(E2)) && marco(E2).split("Benchmark de margen").length === 2, "base «bajo el benchmark» + filtro con `ref` del nivel en una premisa: el Marco lleva el benchmark Y el nivel (antes solo el nivel, que había ocupado el campo primero), cada uno una vez", marco(E2));
  const { E: E3 } = entregaDe({ partes: [{ id: "p1", tema: "comercial", cierre: "cifra", conceptos: ["ventas", "margen"], universo: { eje: "cliente" } }] });
  ok(!/Nivel de carga declarado/.test(marco(E3)), "CONTROL NEGATIVO · un encargo que no usa el nivel de carga no lo declara en el Marco", marco(E3));
}

H("A13 · Y20 · 42(c): la cartera completa trae el «Días vencido 0d» de TODA cuenta sana (también las del top 8); la boleta del agente sin el opt-in no cambia");
{
  const todos = ejes.cliente || [];
  const { E } = entregaDe({ partes: [{ id: "p1", tema: "cobranza", cierre: "cifra", conceptos: ["dias_vencido", "saldo_vencido"] }] });
  const filas = [...E.entrega.cifras.filas, ...((E.entrega.detalle && E.entrega.detalle.filas) || [])];
  const dias = (n) => filas.some((f) => f.valores["Entidad / grupo"] === n && f.valores["Métrica"] === "Días vencido");
  const sanas = RK.cliente.dias_vencido.filas.filter((f) => f.valor === 0).map((f) => f.entidad);
  ok(todos.length === 13 && todos.every(dias), "las 13 cuentas tienen su fila de «Días vencido» (Jumbo y Mercado Libre, sanas del top 8, antes sin ella)", todos.filter((n) => !dias(n)).join(", "));
  ok(sanas.length === 7 && sanas.every((n) => filas.some((f) => f.valores["Entidad / grupo"] === n && f.valores["Métrica"] === "Días vencido" && f.valores["Valor"] === "0d")), "cada una de las 7 cuentas sanas dice «0d» (ausente vale cero: un hecho)", sanas.join(", "));
  const caja = cajaDelAgente(TOOLS);
  const etiquetas = (args) => new Set(((caja.cobranza({ scenario: ESCENARIO_INICIAL, ...args }).boleta) || []).map((x) => String(x.label)));
  const sin = etiquetas({}), con = etiquetas({ mesaCompleta: true });
  ok(!sin.has("Jumbo · Dias Vencido") && con.has("Jumbo · Dias Vencido") && con.has("Mercado Libre · Dias Vencido"), "CANDADO · sin `mesaCompleta` (la boleta del agente) Jumbo no publica «Dias Vencido»; con el opt-in del Encargo sí", `sin=${sin.has("Jumbo · Dias Vencido")} con=${con.has("Jumbo · Dias Vencido")}`);
}

H("A13 · Y74 · un SKU que la consulta deja fuera por SU BODEGA dice la bodega, sin una cifra de otra condición");
{
  const bodegaDe = (n) => (cifrasDelDato(ESCENARIO_INICIAL, null).estados.find((x) => x.entidad === n) || {}).bodega;
  const univ = { eje: "sku", estados: ["sin venta"], excluir: { bodega: "Valparaíso" } };
  const mk = (miembros) => entregaDe({ partes: [{ id: "p1", tema: "inventario", cierre: "cifra", conceptos: ["dias_sin_venta", "capital"], eje: "sku", universo: univ }], premisas: [{ id: "q1", tipo: "grupo", miembros, universo: univ }] });
  const t = _premisasDe(mk(["BOS-SANDER"]).E)[0] || "";
  ok(bodegaDe("BOS-SANDER") === "Valparaíso" && /BOS-SANDER: fuera del universo por su bodega \(Valparaíso\)/.test(t) && !/días sin venta/.test(t), "BOS-SANDER (Valparaíso, 68 días sin venta) queda fuera por su BODEGA: la oración nombra Valparaíso y no dice «días sin venta 68» (que leería como si el universo la incluyera)", t);
  const t2 = _premisasDe(mk(["PHI-SHAVER9"]).E)[0] || "";
  ok(bodegaDe("PHI-SHAVER9") !== "Valparaíso" && /PHI-SHAVER9: no tiene días sin venta \(0 días\)/.test(t2) && !/bodega/.test(t2), "CONTROL · PHI-SHAVER9 (no está en Valparaíso) sale por el estado, no por la bodega: sigue diciendo su cifra", t2);
}

H("A13 · Y06 · 42(a) en el ORDEN: el puesto empatado de la verdad propia dice con quién empata; el cero de un empate se dice en palabras");
{
  const dias = Object.fromEntries(RK.cliente.dias_vencido.filas.map((f) => [f.entidad, f.valor]));
  const empatadas = Object.keys(dias).filter((n) => dias[n] === dias.Paris && n !== "Paris");
  const mkOrden = (sujeto, k) => entregaDe({ partes: [{ id: "p1", tema: "cobranza", cierre: "cifra", conceptos: ["dias_vencido", "saldo_vencido"] }], premisas: [{ id: "q1", tipo: "orden", sujeto, metrica: "dias_vencido", orden: { forma: "puesto", k }, universo: { eje: "cliente" } }] });
  const t = _premisasDe(mkOrden("Paris", 3).E)[0] || "";
  ok(empatadas.length === 2 && /puesto 4 de 13/.test(t) && empatadas.every((n) => t.includes(n)) && /empatado con/.test(t), `«Paris es la 3.ª en días vencido» (falsa): su puesto compartido es el 4.º y dice que empata con ${empatadas.join(" y ")}`, t);
  const t2 = _premisasDe(mkOrden("Lider", 1).E)[0] || "";
  ok(/Lider: días vencido 269 días, puesto 2 de 13/.test(t2) && !/empat/.test(t2), "CONTROL NEGATIVO · «Lider es la 1.ª» (falsa; 269 días, sin empate): dice su puesto 2 sin «empatado»", t2);
  const t3 = _premisasDe(mkOrden("ABC", 7).E)[0] || "";
  ok(/no tiene días vencido \(0 días\)/.test(t3) && !/\(ABC \(0/.test(t3), "el empate de siete cuentas en 0 días dice el cero en palabras de negocio («no tiene días vencido (0 días)»), no «(ABC (0 días))»", t3);
}

/* ═══ A14 · §7.3·43 (b · c · f) (diagnóstico v19, supervisor) ═════════════════════════════════════════════════════════════════════════════
 *   43(b) · un orden servido con EMPATE declara el puesto compartido y quiénes lo comparten (Y02): «puesto 1 compartido por Mercado Libre y Ripley»; sin empate no hay línea.
 *   43(c) · una relación juzgada, verdadera o falsa, dice la cifra de CADA lado en la oración (Y31); un cero se dice con el criterio de la casa (39c: «no tiene saldo vencido ($0)»).
 *   43(f) · una cifra sobre un eje completo, sin orden pedido, se exhibe con lo que pide ATENCIÓN primero según la polaridad de la métrica (el ranking de la proyección declara `peorEs`: días vencido → el mayor primero;
 *          margen → el menor primero; sin polaridad → el mayor primero); el tope de tamaño manda al Detalle lo que pide menos atención. Un top pedido conserva el orden que se pidió.
 * Oráculos: los rankings de la proyección (`cifrasDelDato`: `valor`, `texto`, `peorEs`); nunca el código que se corrige. */
const _ordenDe = (E) => (E.entrega.respuesta.find((r) => /ordenado por/.test(r.texto || "")) || {}).texto || "";
const _lineaDeEmpate = (E) => { const m = /Empate en el orden servido:[^\n]*/.exec(_ordenDe(E)); return m ? m[0] : ""; };
const _filaDe = (n, rk) => rk.filas.find((f) => f.entidad === n);
/* el orden «atención primero» que declara la proyección: `peorEs: "mayor"` (más es peor) → el mayor primero; `"menor"` → el menor primero; sin polaridad → el mayor primero */
const _atencionPrimero = (rk) => [...rk.filas].sort((a, b) => (rk.peorEs === "menor" ? a.valor - b.valor : b.valor - a.valor)).map((f) => f.entidad);

H("A14 · 43(b) · Y02 · un orden servido con EMPATE declara el puesto compartido y quiénes lo comparten");
{
  const rec = RK.cliente.recuperado, sanas = new Set(RK.cliente.saldo_vencido.filas.filter((f) => f.valor === 0).map((f) => f.entidad));
  const alDia = rec.filas.filter((f) => sanas.has(f.entidad));
  const maxV = Math.max(...alDia.map((f) => f.valor));
  const empatadas = alDia.filter((f) => f.valor === maxV).map((f) => f.entidad);
  const { E } = entregaDe({ partes: [{ id: "p1", tema: "cobranza", cierre: "cifra", conceptos: ["recuperado"], universo: { eje: "cliente", estados: ["al dia"], top: { metrica: "recuperado", k: 2 } } }] });
  const linea = _lineaDeEmpate(E);
  ok(E.ok && empatadas.length === 2 && empatadas.every((n) => linea.includes(n)) && /puesto 1 compartido por/.test(linea), `las 2 al día que más recuperaron (${empatadas.join(" y ")}: ${maxV} %) comparten el 1.er puesto: la oración del orden lo declara con los dos nombres`, linea || _ordenDe(E));
  const { E: E2 } = entregaDe({ partes: [{ id: "p1", tema: "comercial", cierre: "cifra", conceptos: ["ventas"], universo: { eje: "cliente", top: { metrica: "ventas", k: 3 } } }] });
  const sinEmpate = new Set(RK.cliente.ventas.filas.map((f) => f.valor)).size === RK.cliente.ventas.filas.length;
  ok(E2.ok && sinEmpate && _lineaDeEmpate(E2) === "" && /ordenado por Venta/.test(_ordenDe(E2)), "CONTROL NEGATIVO · un top 3 de ventas (13 cifras distintas, sin empate) no agrega línea de empate", _ordenDe(E2));
  const dv = RK.cliente.dias_vencido.filas;
  const grupos = [...new Set(dv.map((f) => f.valor))].map((v) => ({ v, ns: dv.filter((f) => f.valor === v).map((f) => f.entidad), puesto: dv.filter((f) => f.valor > v).length + 1 })).filter((g) => g.ns.length > 1);
  const { E: E3 } = entregaDe({ partes: [{ id: "p1", tema: "cobranza", cierre: "cifra", conceptos: ["dias_vencido", "saldo_vencido"] }] });
  const l3 = _lineaDeEmpate(E3);
  ok(grupos.length === 2 && grupos.every((g) => g.ns.every((n) => l3.includes(n)) && l3.includes(`puesto ${g.puesto} compartido por`)), `la cartera completa por días vencido dice CADA puesto compartido (${grupos.map((g) => `${g.puesto}.º: ${g.ns.length} cuentas`).join(" · ")}), con el puesto del primero del grupo`, l3);
}

H("A14 · 43(c) · Y31 · una relación juzgada dice la cifra de CADA lado en la oración (verdadera o falsa); el cero, con el criterio de la casa");
{
  const sv = RK.cliente.saldo_vencido, lider = _filaDe("Lider", sv), jumbo = _filaDe("Jumbo", sv), fala = _filaDe("Falabella", sv);
  const rel = (sujeto, vs) => entregaDe({ partes: [{ id: "p1", tema: "cobranza", cierre: "comparacion", conceptos: ["saldo_vencido"], entidades: [{ nombre: sujeto }, { nombre: vs }] }], premisas: [{ id: "q1", tipo: "relacion", sujeto, metrica: "saldo_vencido", relacion: { forma: "mayor", vs: { sujeto: vs } } }] });
  const t1 = _premisasDe(rel("Lider", "Jumbo").E)[0] || "";
  ok(jumbo.valor === 0 && /es correcto/.test(t1) && t1.includes(`Lider: saldo vencido ${lider.texto}`) && /frente a Jumbo: no tiene saldo vencido \(\$0\)/.test(t1), `«Lider tiene más saldo vencido que Jumbo» (verdadera): dice ${lider.texto} de Lider Y el cero de Jumbo en palabras («no tiene saldo vencido ($0)»)`, t1);
  const t2 = _premisasDe(rel("Lider", "Falabella").E)[0] || "";
  ok(lider.valor > fala.valor && /es correcto/.test(t2) && t2.includes(`Lider: saldo vencido ${lider.texto}`) && t2.includes(`frente a Falabella: saldo vencido ${fala.texto}`) && !/no tiene/.test(t2), `«Lider tiene más que Falabella» (verdadera, sin ceros): las dos cifras ${lider.texto} y ${fala.texto}, cada una con su dueño`, t2);
  const t3 = _premisasDe(rel("Falabella", "Lider").E)[0] || "";
  ok(fala.valor < lider.valor && /no es así/.test(t3) && t3.includes(`Falabella: saldo vencido ${fala.texto}`) && t3.includes(`frente a Lider: saldo vencido ${lider.texto}`), "CONTROL · «Falabella tiene más que Lider» (falsa) sigue diciendo las dos cifras, como en la 38(a)", t3);
}

H("A14 · 43(f) · una cifra sobre un eje completo, sin orden pedido, se exhibe con lo que pide ATENCIÓN primero (según la polaridad de la métrica); lo que pide menos atención se va al Detalle");
{
  const nombresDe = (t) => [...String(t || "").matchAll(/(?:^|: |, )([A-ZÁÉÍÓÚ][\wÁÉÍÓÚáéíóúñ .-]+?) \(/g)].map((m) => m[1]);
  const cab = (t) => nombresDe(String(t).split("ordenado por")[1] || "");
  const dv = RK.cliente.dias_vencido, esperadoDv = _atencionPrimero(dv);
  const { E } = entregaDe({ partes: [{ id: "p1", tema: "cobranza", cierre: "cifra", conceptos: ["dias_vencido", "saldo_vencido"] }] });
  ok(E.ok && dv.peorEs === "mayor" && cab(_ordenDe(E)).join() === esperadoDv.slice(0, 3).join(), `días vencido (más es peor): la cartera completa abre con ${esperadoDv.slice(0, 3).join(", ")} (los peores), no con las de 0 días`, _ordenDe(E));
  const enTabla = new Set(E.entrega.cifras.filas.map((f) => f.valores["Entidad / grupo"])), enDetalle = [...new Set(((E.entrega.detalle && E.entrega.detalle.filas) || []).map((f) => f.valores["Entidad / grupo"]))];
  const rango = (n) => esperadoDv.indexOf(n);
  ok(enDetalle.length > 0 && enDetalle.every((d) => [...enTabla].every((t) => rango(t) < rango(d))), `el tope de tamaño manda al Detalle a las que piden MENOS atención (${enDetalle.join(", ")}); Easy y Lider (270 y 269 días) quedan en la tabla`, `tabla=${[...enTabla].join(",")} detalle=${enDetalle.join(",")}`);
  const mg = RK.cliente.margen, esperadoMg = _atencionPrimero(mg);
  const { E: E2 } = entregaDe({ partes: [{ id: "p1", tema: "comercial", cierre: "cifra", conceptos: ["margen"] }] });
  /* 43(f), lectura estrecha del supervisor: donde más es MEJOR se conserva el orden de siempre (de mayor a menor), no se invierte */
  const esperadoMgDesc = [...mg.filas].filter((f) => Number.isFinite(f.valor)).sort((a, b) => b.valor - a.valor).map((f) => f.entidad);
  ok(E2.ok && mg.peorEs === "menor" && cab(_ordenDe(E2)).join() === esperadoMgDesc.slice(0, 3).join() && cab(_ordenDe(E2)).join() !== esperadoMg.slice(0, 3).join(), `margen (más es mejor): conserva el orden de siempre, de mayor a menor (${esperadoMgDesc.slice(0, 3).join(", ")}); no se invierte`, _ordenDe(E2));
  const un = RK.cliente.saldo_por_vencer, esperadoUn = _atencionPrimero(un);
  const { E: E3 } = entregaDe({ partes: [{ id: "p1", tema: "cobranza", cierre: "cifra", conceptos: ["saldo_por_vencer"] }] });
  ok(E3.ok && un.peorEs == null && cab(_ordenDe(E3)).join() === esperadoUn.slice(0, 3).join(), `CONTROL · sin polaridad (saldo por vencer) sigue de mayor a menor (${esperadoUn.slice(0, 3).join(", ")})`, _ordenDe(E3));
  const vt = RK.cliente.ventas;
  const { E: E4 } = entregaDe({ partes: [{ id: "p1", tema: "comercial", cierre: "cifra", conceptos: ["ventas"], universo: { eje: "cliente", top: { metrica: "ventas", k: 3 } } }] });
  ok(E4.ok && cab(_ordenDe(E4)).join() === [...vt.filas].sort((a, b) => b.valor - a.valor).slice(0, 3).map((f) => f.entidad).join(), "CONTROL NEGATIVO · un TOP pedido conserva el orden que se pidió (el mayor primero), aunque la métrica tenga polaridad", _ordenDe(E4));
  /* una `decision` NO cambia: su primera fila es «la prioridad del procedimiento» (una conclusión, no una exhibición); la 43(f) habla de la cifra */
  const cg = RK.cliente.carga;
  const { E: E5 } = entregaDe({ partes: [{ id: "p1", tema: "comercial", cierre: "decision", conceptos: ["carga", "no_capturada", "contribucion"], universo: { eje: "cliente", base: "carga comercial alta" } }] });
  const vs5 = cab(_ordenDe(E5)).map((n) => _filaDe(n, cg).valor);
  ok(E5.ok && vs5.length >= 2 && vs5.every((v, i) => i === 0 || v >= vs5[i - 1]), "CONTROL · una `decision` conserva su orden de siempre (la cifra menor primero: la prioridad del procedimiento no la mueve la 43(f), que habla de la cifra)", _ordenDe(E5));
}

/* ═══ A15 · DIAGNÓSTICO v20 (medición ciega v20, catálogo sellado v20; §7.3·43) ═══════════════════════════════════════════════════════════════
 * Seis raíces de ADI, cada una con su carnada en POSITIVO (la corrección dice lo verdadero) y en NEGATIVO (el control que NO debe cambiar):
 *   43(d) · U21 U22 U23 U25 U28 U86 U100 · una parte `no_resuelta` NO reporta entidades resueltas: es UNA salida de `validarEncargo` (antes las devolvían solo los retornos tempranos).
 *   43(e) · U03 U04 U12 … (24 casos) · el Marco comercial cita el benchmark con que se juzga el margen AUNQUE la fig «Benchmark de margen» no viaje en la boleta (la publica `entityRecord`/`rolesCartera`, no `queryMetric`):
 *           la regla es del TEMA (toda parte comercial servida que no es una definición), no de la herramienta que la sirvió.
 *   eje   · U06 U42 · una `lectura` sin entidades con un eje EXPLÍCITO (bodega) sirve ese eje además de la foto del tema (antes solo si el plan del tema no armaba nada: la lectura de inventario SIEMPRE lo arma); y el listado
 *           se ordena por el primer concepto que trae fig de TODAS las entidades en juego (no «Antofagasta, Valparaíso, Santiago» sin cifra).
 *   cero  · U06 · el cero de un empate POR AUSENCIA del conjunto (Santiago no tiene capital inmovilizado crítico) se dice en palabras de negocio, no «Santiago (0)» (39c).
 *   bodega· U62 · un SKU que la consulta deja fuera porque su bodega no es la PEDIDA dice su bodega (37a), no un «puesto 3 de 13» que leería como si el top lo incluyera.
 *   defin.· U34 · una definición que el validador acepta y `defineConcept` no tiene curada (`markup`) no desaparece en silencio: se declara el límite.
 * Oráculos: los rankings de la proyección (`cifrasDelDato`), el estado por bodega de la proyección, `benchmarkOf()` y el índice de entidades de cada eje; nunca el código que se corrige. */
const _marcoDe = (E) => (/\*\*Marco\.\*\*[^\n]*/.exec(E.texto || "") || [""])[0];
const _limitesDe = (E) => ((E.entrega && E.entrega.limites) || []).map((l) => String((l && l.titulo) || l));
const _filasDe = (E) => ((E.entrega && E.entrega.cifras && E.entrega.cifras.filas) || []).map((f) => f.valores["Entidad / grupo"]);
const _partesDe = (R) => Object.fromEntries((R.partes || []).map((p) => [p.id, p]));
const _bodegaDeSku = (n) => (cifrasDelDato(ESCENARIO_INICIAL, null).estados.find((x) => x.entidad === n) || {}).bodega;

H("A15 · 43(d) · una parte `no_resuelta` NO reporta entidades resueltas (una sola salida), sea cual sea el motivo; las `parcial` y `resuelta` SÍ reportan lo resuelto");
{
  const a = entregaDe({ partes: [
    { id: "p1", tema: "cobranza", cierre: "comparacion", conceptos: ["saldo_vencido"], entidades: [{ nombre: "Falabella" }, { nombre: "Cencosud" }] },
    { id: "p2", tema: "cobranza", cierre: "cifra", conceptos: ["saldo_vencido"], entidades: [{ nombre: "Falabella" }] },
    { id: "p3", tema: "cobranza", cierre: "cifra", conceptos: [], entidades: [{ nombre: "Jumbo" }] },
    { id: "p4", tema: "cobranza", cierre: "cifra", conceptos: ["saldo_vencido"], eje: "sku", entidades: [{ nombre: "SAM-TV55", eje: "sku" }] },
  ] });
  const P = _partesDe(a.R);
  const noRes = a.R.partes.filter((p) => p.estado === "no_resuelta");
  ok(noRes.length === 3 && ["p1", "p3", "p4"].every((id) => P[id].estado === "no_resuelta"), "las tres partes que fallan (comparación con una cuenta inexistente · cifra sin concepto · eje sin productor) quedan no_resuelta", JSON.stringify(a.R.partes.map((p) => [p.id, p.estado])));
  ok(noRes.every((p) => p.entidades.length === 0), "ninguna parte no_resuelta reporta entidades (Falabella en p1, Jumbo en p3 y SAM-TV55 en p4 existen y NO se reportan)", JSON.stringify(noRes.map((p) => [p.id, p.entidades.map((e) => e.nombre)])));
  ok(P.p2.estado === "resuelta" && P.p2.entidades.map((e) => e.nombre).join() === "Falabella", "CONTROL · la parte resuelta (p2) SÍ reporta a Falabella: una cifra puntual de la misma cuenta la sirve otra parte", JSON.stringify(P.p2.entidades));
  const b = entregaDe({ partes: [{ id: "p1", tema: "cobranza", cierre: "cifra", conceptos: ["saldo_vencido"], entidades: [{ nombre: "Falabella" }, { nombre: "Cencosud" }] }] });
  ok(b.R.partes[0].estado === "parcial" && b.R.partes[0].entidades.map((e) => e.nombre).join() === "Falabella", "CONTROL NEGATIVO · una parte `parcial` (una cuenta válida y una inexistente) SÍ reporta la resuelta", JSON.stringify(b.R.partes.map((p) => [p.estado, p.entidades.map((e) => e.nombre)])));
  const c = entregaDe({ partes: [{ id: "p1", tema: "cobranza", cierre: "cifra", conceptos: ["saldo_vencido"], entidades: [{ nombre: "Cencosud" }] }] });
  ok(c.R.partes[0].estado === "no_resuelta" && c.R.partes[0].entidades.length === 0 && c.R.noResuelto.some((n) => n.motivo === "entidad_inexistente"), "la entidad que FALLÓ sigue dicha en `noResuelto` (motivo entidad_inexistente): quitar las entidades de la parte no borra la razón", JSON.stringify(c.R.noResuelto.map((n) => n.motivo)));
}

H("A15 · 43(e) · el Marco comercial cita el benchmark con que se juzga el margen, sirva la parte la herramienta que sirva (no depende de que la fig viaje en la boleta)");
{
  const txtB = `Benchmark de margen: ${formatoDeUmbral(benchmarkOf(), "pct")}, declarado por la empresa.`;
  const veces = (m) => m.split(txtB).length - 1;
  const casos = [
    ["cifra por cliente (ventas, contribución: `queryMetric`, sin la fig del benchmark)", { partes: [{ id: "p1", tema: "comercial", cierre: "cifra", conceptos: ["ventas", "contribucion"] }] }],
    ["cifra por SKU (margen, ventas)", { partes: [{ id: "p1", tema: "comercial", cierre: "cifra", conceptos: ["margen", "ventas"], eje: "sku", universo: { eje: "sku" } }] }],
    ["cifra por marca (carga, margen)", { partes: [{ id: "p1", tema: "comercial", cierre: "cifra", conceptos: ["carga", "margen"], eje: "marca", universo: { eje: "marca" } }] }],
    ["cifra puntual de un cliente (`entityRecord`: la fig SÍ viaja; una sola vez)", { partes: [{ id: "p1", tema: "comercial", cierre: "cifra", conceptos: ["ventas", "margen"], entidades: [{ nombre: "Sodimac" }] }] }],
  ];
  for (const [t, enc] of casos) { const { E } = entregaDe(enc); const m = _marcoDe(E); ok(E.ok && veces(m) === 1, `${t}: el Marco lleva «${txtB}» UNA vez`, m.slice(0, 260)); }
  const c1 = entregaDe({ partes: [{ id: "p1", tema: "comercial", cierre: "definicion", concepto: "margen" }, { id: "p2", tema: "cobranza", cierre: "cifra", conceptos: ["saldo_vencido"], entidades: [{ nombre: "Lider" }] }] });
  ok(c1.E.ok && veces(_marcoDe(c1.E)) === 0 && !/Benchmark de margen/.test(_marcoDe(c1.E)), "CONTROL NEGATIVO · una parte comercial que es solo una DEFINICIÓN (no juzga ningún margen) no trae el benchmark al Marco", _marcoDe(c1.E));
  const c2 = entregaDe({ partes: [{ id: "p1", tema: "inventario", cierre: "cifra", conceptos: ["capital"], eje: "sku", universo: { eje: "sku" } }, { id: "p2", tema: "cobranza", cierre: "cifra", conceptos: ["saldo_vencido"], entidades: [{ nombre: "Lider" }] }] });
  ok(c2.E.ok && !/Benchmark de margen/.test(_marcoDe(c2.E)), "CONTROL NEGATIVO · sin parte comercial (inventario y cobranza) el Marco no agrega el benchmark", _marcoDe(c2.E));
}

H("A15 · lectura con eje EXPLÍCITO · una `lectura` de inventario por BODEGA sirve las cuatro bodegas (además de la foto del tema); sin eje explícito no agrega nada");
{
  const bodegas = ejes.bodega || [], rkCap = RK.bodega.capital.filas;
  const { E } = entregaDe({ partes: [{ id: "p1", tema: "inventario", cierre: "lectura", conceptos: ["capital_frenado", "capital"], eje: "bodega", universo: { eje: "bodega" } }] });
  const filas = new Set(_filasDe(E));
  ok(E.ok && bodegas.length === 4 && bodegas.every((b) => filas.has(b)), "las cuatro bodegas están en la tabla de Cifras (la lectura pedía el eje bodega)", JSON.stringify([...filas]));
  ok(E.entrega.respuesta.some((r) => /quien más pesa/.test(r.texto || "")), "la foto del procedimiento (el SKU que más pesa) se conserva: el eje pedido se SIRVE además, no en su lugar", E.entrega.respuesta.map((r) => r.texto).join(" | ").slice(0, 300));
  const linea = (E.entrega.respuesta.find((r) => /^Por bodega, ordenado por/.test(r.texto || "")) || {}).texto || "";
  const esperada = rkCap.slice(0, 3).map((f) => `${f.entidad} (${formatoDeLaCasa(f.raw, "money")})`).join(", ");
  ok(linea === `Por bodega, ordenado por Capital: ${esperada}.`, `el listado se ordena por «Capital» (el primer concepto con fig de las cuatro), cada nombre con su cifra: ${esperada}`, linea);
  const solo = entregaDe({ partes: [{ id: "p1", tema: "inventario", cierre: "cifra", conceptos: ["capital_frenado"], eje: "bodega", universo: { eje: "bodega" } }] });
  const lineaSolo = (solo.E.entrega.respuesta.find((r) => /ordenado por/.test(r.texto || "")) || {}).texto || "";
  ok(/ordenado por Capital inmovilizado crítico: Valparaíso \(\$25K\), Antofagasta \(\$8K\)/.test(lineaSolo), "CONTROL · con un solo concepto (solo dos bodegas lo traen) el orden es el de siempre, por ese concepto", lineaSolo);
  const sin = entregaDe({ partes: [{ id: "p1", tema: "inventario", cierre: "lectura", conceptos: ["capital", "dias_inventario"] }] });
  ok(sin.E.ok && !_filasDe(sin.E).some((n) => bodegas.includes(n)) && !sin.E.entrega.respuesta.some((r) => /^Por bodega/.test(r.texto || "")), "CONTROL NEGATIVO · una lectura de inventario SIN eje explícito (el sujeto del tema es el SKU) no agrega listado por bodega", JSON.stringify(_filasDe(sin.E)));
  const marcas = ejes.marca || [];
  const com = entregaDe({ partes: [{ id: "p1", tema: "comercial", cierre: "lectura", conceptos: ["ventas", "margen"], eje: "marca", universo: { eje: "marca" } }] });
  const fm = new Set(_filasDe(com.E));
  ok(com.E.ok && marcas.length >= 4 && marcas.every((m) => fm.has(m)), "una lectura comercial por MARCA (eje explícito) sirve las marcas: antes salía sin una sola cifra, solo con límites", JSON.stringify([...fm]));
  const comSin = entregaDe({ partes: [{ id: "p1", tema: "comercial", cierre: "lectura" }] });
  ok(comSin.E.ok && !_filasDe(comSin.E).some((n) => marcas.includes(n)), "CONTROL NEGATIVO · una lectura comercial sin eje explícito no agrega marcas", JSON.stringify(_filasDe(comSin.E)));
}

H("A15 · U06 · el cero de un empate POR AUSENCIA se dice en palabras de negocio con su cifra (no «Santiago (0)»); un empate sin cero no cambia");
{
  const cf = RK.bodega.capital_frenado.filas.map((f) => f.entidad);
  const mk = (premisas) => entregaDe({ partes: [{ id: "p1", tema: "inventario", cierre: "lectura", conceptos: ["capital_frenado", "capital"], eje: "bodega", universo: { eje: "bodega" } }], premisas });
  const t = oracionesDe(mk([{ id: "q1", tipo: "orden", sujeto: "Santiago", metrica: "capital_frenado", orden: { forma: "min" }, universo: { eje: "bodega" } }]).E)[0] || "";
  ok(!cf.includes("Santiago") && !cf.includes("Concepción") && /no se pudo verificar/.test(t) && /Santiago: no tiene capital inmovilizado crítico \(\$0\)/.test(t) && !/Santiago \(0\)/.test(t), "«Santiago es la bodega con menos capital inmovilizado crítico» (empata con Concepción, ambas sin crítico: 0 por ausencia): «Santiago: no tiene capital inmovilizado crítico ($0)»", t);
  /* U91: el cero que la oración dice es el del SUJETO de la premisa (Ripley), no el del primero del empate (Jumbo) */
  const dv0 = RK.cliente.dias_vencido.filas, ceros = dv0.filter((f) => f.valor === 0).map((f) => f.entidad);
  const menos = (sujeto) => oracionesDe(entregaDe({ partes: [{ id: "p1", tema: "cobranza", cierre: "cifra", conceptos: ["dias_vencido", "saldo_vencido"] }], premisas: [{ id: "q1", tipo: "orden", sujeto, metrica: "dias_vencido", orden: { forma: "min" }, universo: { eje: "cliente" } }] }).E)[0] || "";
  const tR = menos("Ripley"), tJ = menos("Jumbo");
  ok(ceros.length === 7 && ceros.indexOf("Ripley") > 0 && /comparten el extremo/.test(tR) && /Ripley: no tiene días vencido \(0 días\)/.test(tR) && !/Jumbo: no tiene/.test(tR), "«Ripley es la de menos días vencidos» (empata con otras 6 en 0 días; Jumbo va primero del empate): el cero dicho es el de RIPLEY", tR);
  ok(/Jumbo: no tiene días vencido \(0 días\)/.test(tJ) && !/Ripley: no tiene/.test(tJ), "CONTROL · «Jumbo es la de menos días vencidos» (el sujeto es el primero del empate) sigue diciendo el cero de Jumbo", tJ);
  const dv = Object.fromEntries(RK.cliente.dias_vencido.filas.map((f) => [f.entidad, f.valor]));
  const t2 = oracionesDe(entregaDe({ partes: [{ id: "p1", tema: "cobranza", cierre: "cifra", conceptos: ["dias_vencido", "saldo_vencido"] }], premisas: [{ id: "q1", tipo: "orden", sujeto: "Tottus", metrica: "dias_vencido", orden: { forma: "puesto", k: 4 }, universo: { eje: "cliente" } }] }).E)[0] || "";
  ok(dv.Tottus > 0 && dv.Tottus === dv.Paris && /valen lo mismo/.test(t2) && /Tottus \(8 días\)/.test(t2) && !/no tiene/.test(t2), "CONTROL NEGATIVO · un empate SIN cero (Tottus, Falabella y Paris: 8 días) sigue con su cifra, sin «no tiene»", t2);
}

H("A15 · U62 · un SKU que la consulta deja fuera porque su BODEGA no es la pedida dice su bodega (37a), sin un puesto que leería como si el top lo incluyera");
{
  const univ = { eje: "sku", top: { metrica: "capital", k: 4, sobre: "eje" }, bodega: "Santiago" };
  const mk = (m) => entregaDe({ partes: [{ id: "p1", tema: "inventario", cierre: "cifra", conceptos: ["capital", "rotacion"], eje: "sku", universo: univ }], premisas: [{ id: "q1", tipo: "grupo", miembros: [m], universo: univ }] }).E;
  const top4 = RK.sku.capital.filas.slice(0, 4).map((f) => f.entidad), bp = _bodegaDeSku("LG-DRYER8KG");
  const t = oracionesDe(mk("LG-DRYER8KG"))[0] || "";
  ok(top4.includes("LG-DRYER8KG") && bp === "Valparaíso" && /no es así — LG-DRYER8KG: fuera del universo por su bodega \(Valparaíso\), distinta de la pedida \(Santiago\)/.test(t) && !/puesto/.test(t), "LG-DRYER8KG (3.º del eje, pero en Valparaíso): la oración nombra su bodega y la pedida, sin «puesto 3 de 13»", t);
  const t2 = oracionesDe(mk("PHI-SHAVER9"))[0] || "";
  ok(!top4.includes("PHI-SHAVER9") && /PHI-SHAVER9: capital \$11K, puesto 5 de 13/.test(t2) && !/bodega/.test(t2), "CONTROL · PHI-SHAVER9 (5.º del eje, FUERA del top) sigue diciendo su cifra y su puesto: el puesto es la razón (41c)", t2);
  const t3 = oracionesDe(mk("SAM-TV55"))[0] || "";
  ok(_bodegaDeSku("SAM-TV55") === "Santiago" && /es correcto — SAM-TV55/.test(t3), "CONTROL NEGATIVO · SAM-TV55 (top 4 y en Santiago) es MIEMBRO: verdadera, sin razón de exclusión", t3);
}

H("A15 · U34 · una definición aceptada por el validador que `defineConcept` no tiene curada (`markup`) se DECLARA como límite, no desaparece; una curada se sirve");
{
  const cob = { id: "p2", tema: "cobranza", cierre: "cifra", conceptos: ["saldo_vencido"], entidades: [{ nombre: "Lider" }] };
  const a = entregaDe({ partes: [{ id: "p1", tema: "comercial", cierre: "definicion", concepto: "markup" }, cob] });
  ok(a.E.ok && _partesDe(a.R).p1.estado === "resuelta" && _limitesDe(a.E).some((t) => /la definición de «markup» no está disponible en este registro/.test(t)), "«qué es el markup» (parte resuelta, sin definición curada): el límite lo dice", JSON.stringify(_limitesDe(a.E)));
  const b = entregaDe({ partes: [{ id: "p1", tema: "comercial", cierre: "definicion", concepto: "margen" }, cob] });
  ok(b.E.ok && !_limitesDe(b.E).some((t) => /no está disponible en este registro/.test(t)) && /margen de contribución/.test(b.E.texto), "CONTROL NEGATIVO · «qué es el margen» (curada) se sirve y no agrega límite", JSON.stringify(_limitesDe(b.E)));
}

/* ═══ A16 · DIAGNÓSTICO v20 (§7.3·44) ══════════════════════════════════════════════════════════════════════════════════════════════════════════
 * Tres raíces de la Entrega, cada una con su carnada en POSITIVO y su control en NEGATIVO:
 *   44(a) · Y73 · U10 · un top cuyo filo cae DENTRO de un empate sirve a TODOS los empatados del filo y lo declara (nunca elige a uno ni declina el top); una premisa de PERTENENCIA a ese top (`orden` topk o `grupo` sobre un universo con `top`)
 *           sobre un empatado del filo es verdadera y declara el empate. Un corte que NO parte el empate no cambia nada; el puesto único (`max`, `puesto`) sigue la 43(a).
 *   44(d) · U62 · el «de M» de un conteo es el tamaño del universo de la PREMISA (el «de M» admisible que la consulta planteó), no el de otra base («3 de 4», nunca «3 de 5»).
 *   44(e) · 37 textos · cada premisa lleva UNA sola traza «La verdad: …»: nunca se repite ni repite lo que la oración ya dice; la que agrega una verdad que la oración no trae se conserva.
 * Oráculos: el ranking de la proyección (`cifrasDelDato`), el tamaño real de cada universo y la cuenta de trazas del propio texto servido; nunca el código que se corrige. */
{
  H("A16 · 44(a) · Y73 · un top cuyo filo cae DENTRO de un empate sirve a TODOS los empatados y lo declara");
  const rec = RK.cliente.recuperado.filas.slice().sort((x, y) => y.valor - x.valor);
  const filoPartido = (k) => rec.length > k && rec[k - 1].valor === rec[k].valor;
  const tamServido = (k) => { const v = rec[k - 1].valor; return rec.filter((f, i) => i < k || f.valor === v).length; };
  const topDe = (k) => entregaDe({ partes: [{ id: "p1", tema: "cobranza", cierre: "cifra", conceptos: ["recuperado", "abonado"], universo: { eje: "cliente", top: { metrica: "recuperado", k } } }] });
  const filasDe = (E) => new Set(((E.entrega.universos || []).find((u) => u.id === "p1") || {}).entidades || []);   /* el universo DECLARADO de la parte (las entidades servidas), no la tabla (que manda filas al Detalle) */
  const lineaTop = (E) => (E.entrega.respuesta.find((r) => /^El top \d+ de \d+/.test(r.texto || "")) || {}).texto || "";
  { const k = 1, { R, E } = topDe(k), sirve = rec.filter((f) => f.valor === rec[0].valor).map((f) => f.entidad), l = lineaTop(E);
    ok(filoPartido(k) && sirve.length === 2, "oráculo · el top 1 de recuperado parte un empate (dos cuentas con el mismo valor)", JSON.stringify(rec.slice(0, 3)));
    ok(E.ok && R.partes[0].estado === "resuelta" && sirve.every((n) => filasDe(E).has(n)) && filasDe(E).size === sirve.length, "top 1: se sirven las DOS empatadas (ni una sola, ni la parte declinada)", JSON.stringify([...filasDe(E)]));
    ok(new RegExp(`que sirve ${sirve.length} por el empate del filo \\(${sirve[0]} y ${sirve[1]} empatan en el puesto 1\\)`).test(l) && !/Empate en el orden servido/.test(l), "el empate del filo se declara UNA vez, con la cuenta servida y el puesto compartido", l);
    ok(!_limitesDe(E).some((t) => /empate|top/i.test(t)), "ningún límite dice que el universo «no se pudo evaluar» por el empate", JSON.stringify(_limitesDe(E))); }
  { const k = 8, { E } = topDe(k), n = tamServido(k), l = lineaTop(E), pu = rec.findIndex((f) => f.valor === rec[k - 1].valor) + 1;
    ok(filoPartido(k) && n === 9 && filasDe(E).size === n, "top 8: el filo cae dentro de un empate: se sirven 9 cuentas", JSON.stringify([...filasDe(E)]));
    ok(new RegExp(`que sirve 9 por el empate del filo \\(.+ empatan en el puesto ${pu}\\)`).test(l), "«top 8: 9 cuentas, … empatan en el puesto 8»", l); }
  for (const k of [2, 9]) { const { E } = topDe(k), l = lineaTop(E);
    ok(!filoPartido(k) && filasDe(E).size === k && !/empate del filo/.test(l), `CONTROL NEGATIVO · el top ${k} NO parte ningún empate (el corte cae entre dos valores): se sirven ${k} y no se declara empate del filo`, l); }
  { const k = 3, { E } = topDe(k), l = lineaTop(E), n = tamServido(k);
    ok(filoPartido(k) && filasDe(E).size === n && n > 3 && /empate del filo/.test(l), `un empate de MÁS de dos cuentas en el filo (top 3: ${n} servidas) se sirve entero y se declara`, l); }

  H("A16 · 44(a) · U10 · la premisa de PERTENENCIA a un top sobre un empatado del filo es verdadera y declara el empate");
  const empatados = rec.filter((f) => f.valor === rec[7].valor).map((f) => f.entidad);
  const otro = (n) => empatados.find((x) => x !== n);
  const topk = (sujeto, k) => oracionesDe(entregaDe({ partes: [{ id: "p1", tema: "cobranza", cierre: "cifra", conceptos: ["recuperado"] }], premisas: [{ id: "q1", tipo: "orden", sujeto, metrica: "recuperado", orden: { forma: "topk", k }, universo: { eje: "cliente" } }] }).E)[0] || "";
  { const t = topk("Paris", 8);
    ok(empatados.length === 2 && empatados.includes("Paris") && empatados.includes("Tottus"), "oráculo · Paris y Tottus comparten el puesto 8 de recuperado", JSON.stringify(empatados));
    ok(/es correcto — Paris: recuperado 58\.3%, empatado con Tottus en el puesto 8\./.test(t), "«Paris está entre las 8 primeras» (el corte parte el empate): VERDADERA y declara el empate con Tottus en el puesto 8", t);
    const t2 = topk("Tottus", 8); ok(/es correcto — Tottus: recuperado 58\.3%, empatado con Paris en el puesto 8\./.test(t2), "lo mismo para el otro empatado (Tottus)", t2); }
  { const t = topk("Tottus", 9);
    ok(/es correcto — Tottus: recuperado 58\.3%\./.test(t) && !/empatado/.test(t), "CONTROL NEGATIVO · «Tottus está entre las 9 primeras» (el grupo empatado cabe entero): verdadera, sin declaración de empate (el corte no lo parte)", t);
    const f = topk("Falabella", 7); ok(/no es así — Falabella/.test(f) && !/empatado con/.test(f), "CONTROL NEGATIVO · «Falabella está entre las 7 primeras» sigue FALSA (fuera del top), sin declaración de empate", f);
    const pu = oracionesDe(entregaDe({ partes: [{ id: "p1", tema: "cobranza", cierre: "cifra", conceptos: ["recuperado"] }], premisas: [{ id: "q1", tipo: "orden", sujeto: "Paris", metrica: "recuperado", orden: { forma: "puesto", k: 8 }, universo: { eje: "cliente" } }] }).E)[0] || "";
    ok(/no se pudo verificar/.test(pu) && /empat|valen lo mismo/.test(pu), "CONTROL NEGATIVO · una premisa de PUESTO único («Paris es el 8.º») sigue la 43(a): no verificable, con el empate", pu); }
  { const u8 = { eje: "cliente", top: { metrica: "recuperado", k: 8 } }, u9 = { eje: "cliente", top: { metrica: "recuperado", k: 9 } };
    const gr = (m, u) => oracionesDe(entregaDe({ partes: [{ id: "p1", tema: "cobranza", cierre: "cifra", conceptos: ["recuperado"], universo: u }], premisas: [{ id: "q1", tipo: "grupo", miembros: [m], universo: u }] }).E)[0] || "";
    const t = gr("Paris", u8);
    ok(/es correcto — Paris/.test(t) && /empatado con Tottus en el puesto 8/.test(t), "«Paris está en el grupo de las 8 primeras» (grupo sobre un universo con top que parte el empate): verdadera y declara el empate", t);
    const t9 = gr("Paris", u9); ok(/es correcto — Paris/.test(t9) && !/empatado/.test(t9), "CONTROL NEGATIVO · el grupo de las 9 primeras (el corte no parte el empate) no declara empate", t9);
    const tf = gr("Falabella", u8); ok(/no es así — Falabella/.test(tf) && !/empatado con/.test(tf), "CONTROL NEGATIVO · un miembro que NO está en el top sigue falso", tf); }

  H("A16 · 44(d) · U62 · el «de M» de un conteo es el de la PREMISA, no el de otra base");
  { const univ = { eje: "sku", top: { metrica: "capital", k: 4, sobre: "eje" }, bodega: "Santiago" };
    const cnt = (m) => oracionesDe(entregaDe({ partes: [{ id: "p1", tema: "inventario", cierre: "cifra", conceptos: ["capital"], eje: "sku", universo: univ }], premisas: [{ id: "q1", tipo: "conteo", conteo: { n: 3, m }, de: univ }] }).E)[0] || "";
    const santiago = RK.sku.capital.filas.filter((f) => _bodegaDeSku(f.entidad) === "Santiago").length;
    const t4 = cnt(4);
    ok(santiago === 5 && /es correcto — 3 de 4 en /.test(t4) && !/3 de 5/.test(t4), "«3 de los 4» (4 = el top del eje, un «de M» admisible; la bodega tiene 5 SKU): la oración dice «3 de 4», nunca «3 de 5»", t4);
    const t5 = cnt(5); ok(/es correcto — 3 de 5 en /.test(t5), "CONTROL · «3 de 5» (el tamaño de la base) dice «3 de 5»", t5);
    const t7 = cnt(7); ok(/no es así — 3 de 5 en /.test(t7), "CONTROL NEGATIVO · un «de M» que NO es admisible (7) no se dice: la falsa dice el tamaño real de la base", t7);
    const enMora = RK.cliente.saldo_vencido.filas.filter((f) => f.valor > 0).length, nEje = RK.cliente.saldo_vencido.filas.length;
    const z = oracionesDe(entregaDe({ partes: [{ id: "p1", tema: "cobranza", cierre: "cifra", conceptos: ["saldo_vencido"] }], premisas: [{ id: "q1", tipo: "conteo", conteo: { n: enMora, m: nEje }, de: { eje: "cliente", estados: ["en mora"] } }] }).E)[0] || "";
    ok(new RegExp(`es correcto — ${enMora} de ${nEje} en los clientes en mora`).test(z), `un conteo sobre un estado con «de ${nEje}» (el eje, admisible) dice «${enMora} de ${nEje}», el universo que la premisa planteó`, z); }

  H("A16 · 44(e) · cada premisa lleva UNA sola traza «La verdad: …»: sin repetirla ni repetir lo que la oración ya dice");
  { const premisasFalsas = [
      { partes: [{ id: "p1", tema: "inventario", cierre: "cifra", conceptos: ["rotacion"] }], premisas: [{ id: "q1", tipo: "estado", sujeto: "BOS-SANDER", estado: "rota bien" }] },
      { partes: [{ id: "p1", tema: "cobranza", cierre: "cifra", conceptos: ["saldo_vencido"] }], premisas: [{ id: "q1", tipo: "estado", sujeto: "Lider", estado: "al dia" }] },
      { partes: [{ id: "p1", tema: "cobranza", cierre: "cifra", conceptos: ["saldo_vencido"] }], premisas: [{ id: "q1", tipo: "variacion", sujeto: "Ripley", metrica: "ventas", variacion: { direccion: "sube" }, periodo: "anterior" }] },
    ];
    const trazas = (t) => { const m = /\. La verdad: (.*)\.$/.exec(t); return m ? m[1] : null; };
    const dicho = (t) => t.replace(/^.*no es así — /, "").replace(/\. La verdad: .*$/, "").replace(/\.$/, "");
    for (const enc of premisasFalsas) {
      const t = oracionesDe(entregaDe(enc).E)[0] || "", tr = trazas(t), cuerpo = dicho(t);
      const segs = tr ? tr.split(" · ") : [];
      ok(/no es así/.test(t) && (t.match(/La verdad:/g) || []).length <= 1 && new Set(segs).size === segs.length && (!tr || !cuerpo.includes(tr)), `premisa de ${enc.premisas[0].tipo} falsa sobre ${enc.premisas[0].sujeto}: a lo más UNA traza, sin segmentos repetidos y sin repetir la oración`, t);
    }
    const t1 = oracionesDe(entregaDe(premisasFalsas[0]).E)[0] || "";
    ok(/BOS-SANDER: rotación 1\.6x, piso de rotación 2\.0x/.test(t1) && !/La verdad/.test(t1), "«BOS-SANDER rota bien» (falsa): la verdad propia va una vez, en palabras, y no se repite con la notación interna", t1);
    const t2 = oracionesDe(entregaDe(premisasFalsas[1]).E)[0] || "";
    ok((t2.match(/Saldo vencido = \$4\.6M/g) || []).length === 1, "«Lider está al día» (falsa): «Saldo vencido = $4.6M» aparece UNA vez", t2);
    const u18 = oracionesDe(entregaDe({ partes: [{ id: "p1", tema: "comercial", cierre: "cifra", conceptos: ["ventas", "contribucion", "variacion"], eje: "canal", universo: { eje: "canal" } }], premisas: [{ id: "q1", tipo: "variacion", sujeto: "Retail", metrica: "ventas", variacion: { direccion: "sube", valor: "7.6%" }, periodo: "anterior" }] }).E)[0] || "";
    ok((u18.match(/La verdad:/g) || []).length === 1 && /La verdad: Retail · Variación vs año anterior = \+6\.6%/.test(u18), "CONTROL NEGATIVO · una traza que AGREGA la verdad (Retail +6.6% cuando la consulta dijo 7.6%) se conserva, una sola vez", u18);
  }
}

/* ═══ A17 · DIAGNÓSTICO v21 (medición ciega v21, catálogo sellado v21; §7.3·44) ═══════════════════════════════════════════════════════════════════════
 * Siete raíces de la Entrega, cada una con su carnada en POSITIVO y su control en NEGATIVO:
 *   44(c) · T15–T19 · T28 · T40 · T99 (90 de las 102 fallas) · una `lectura`/`decision` SIN universo ni entidades sirve su FOTO COMPLETA —el universo que el PRODUCTOR publica (cobranza: las cuentas de su mesa, con su «$0» las sanas;
 *           inventario y comercial: el eje que sus conceptos sostienen)— y la prioridad del procedimiento ENCIMA; el universo declarado ES lo servido (antes: el líder y su rival, 2 o 3 entidades, mientras el texto hablaba de «toda la cartera»).
 *   44(a) · T06 · el top por «recuperado» (y por «días vencidos») trae las cuentas que quedan fuera del top 8 por vencido, con su fila; el empate del orden servido se declara con el puesto y quiénes lo comparten.
 *   44(a) · T100 · la oración que declara un empate (del filo o del orden servido) no la retira el tope de tamaño de un encargo de tres partes.
 *   44(a) · T02 · T32 · la premisa de PERTENENCIA sobre un empatado del filo nombra al sujeto, su puesto compartido, su cifra y con quién empata (no lista otros SKU).
 *   44(b) · T14 · una definición sin curar NO toma la definición de OTRA parte del turno: se declara como límite. · T12 · el título de una definición dice «objetivo», no «meta».
 *   41(c) · T46 · con `top` sobre el eje y un estado que la entidad no cumple, la verdad propia de la entidad DENTRO del top es la cifra de ese estado (no un puesto que leería como si estuviera adentro). · T47 · la exclusión por bodega lleva la referencia del universo.
 *   43(b) · T36 · en una métrica de `AUSENTE_VALE_CERO` la entidad sin fig vale 0: los ceros por ausencia de una cifra sin `top` se ordenan y su empate se declara.
 * Oráculos: la mesa de cobranza (`buildMesaFlujo`, la lista que publica la herramienta), el tamaño de cada eje, el ranking de la proyección (`cifrasDelDato`) y los valores del propio texto; nunca el código que se corrige. */
{
  const mesa = buildMesaFlujo(ESCENARIO_INICIAL);
  const fotoCob = mesa.filas.slice(0, 8).map((f) => f.nombre);
  const nCli = axisEntityNames("cliente").length, nSku = axisEntityNames("sku").length;
  const fueraDeLaFoto = axisEntityNames("cliente").filter((n) => !fotoCob.includes(n));
  const filasServidas = (E) => { const s = new Set(); for (const f of [...((E.entrega.cifras && E.entrega.cifras.filas) || []), ...((E.entrega.detalle && E.entrega.detalle.filas) || [])]) { const n = f.valores && f.valores["Entidad / grupo"]; if (typeof n === "string" && !/ − |^Total \(/.test(n)) s.add(n); } return s; };
  const universoDe = (E, id) => ((E.entrega.universos || []).find((u) => u.id === id) || {}).entidades || [];
  const mismoConjunto = (a, b) => a.length === b.length && new Set(a).size === a.length && b.every((x) => a.includes(x));
  const lineas = (E) => E.entrega.respuesta.map((r) => r.texto || "");
  const enDetalle = (E) => ((E.entrega.detalle && E.entrega.detalle.oraciones) || []).map((o) => o.texto || "");

  H("A17 · 44(c) · T15–T19 · T99 · una lectura de COBRANZA sin universo sirve su FOTO (las cuentas de su mesa) con fila de lo pedido en cada una, y la prioridad encima");
  { const { E } = entregaDe({ partes: [{ id: "p1", tema: "cobranza", cierre: "lectura", conceptos: ["saldo_vencido", "dias_vencido"] }] });
    ok(fotoCob.length === 8 && nCli === 13 && fueraDeLaFoto.length === 5 && E.ok, "oráculo · la mesa de cobranza publica 8 de los 13 clientes; la Entrega compone", JSON.stringify(fotoCob));
    ok(mismoConjunto(universoDe(E, "p1"), fotoCob), "el universo DECLARADO de la parte es la foto de la mesa (8), en su totalidad y sin nadie de más", JSON.stringify(universoDe(E, "p1")));
    const filas = filasServidas(E);
    ok(fotoCob.every((n) => filas.has(n)), "cada cuenta de la foto tiene su fila (Cifras o Detalle), también las SANAS de la mesa (su «Saldo vencido $0»)", JSON.stringify(fotoCob.filter((n) => !filas.has(n))));
    ok(fueraDeLaFoto.every((n) => !filas.has(n)), "ninguna de las 5 cuentas fuera de la foto se sirve (no es la cartera completa)", JSON.stringify(fueraDeLaFoto.filter((n) => filas.has(n))));
    const sanas = mesa.filas.slice(0, 8).filter((f) => !(f.vencidoK > 0)).map((f) => f.nombre);
    const celdas = [...((E.entrega.cifras && E.entrega.cifras.filas) || []), ...((E.entrega.detalle && E.entrega.detalle.filas) || [])].filter((f) => sanas.includes(f.valores["Entidad / grupo"]) && /vencido/i.test(f.valores["Métrica"] || ""));
    ok(sanas.length >= 1 && sanas.every((n) => celdas.some((f) => f.valores["Entidad / grupo"] === n && f.valores["Valor"] === "$0")), "la cuenta sana de la foto dice «Saldo vencido $0» (ausente ES cero), no queda sin cifra de lo pedido", JSON.stringify(sanas));
    const L = lineas(E), iFoto = L.findIndex((t) => new RegExp(`la foto de cobranza \\(${fotoCob.length} de ${nCli} cuentas\\)`).test(t)), iPrio = L.findIndex((t) => /^(Quien más pesa en el conjunto|Prioridad del procedimiento)/.test(t));
    ok(iFoto >= 0 && iPrio >= 0 && iPrio < iFoto, "la foto declara su cola («la foto de cobranza (8 de 13 cuentas)») y va DESPUÉS de la prioridad del procedimiento", JSON.stringify(L.slice(0, 8)));
    ok(iFoto >= 0 && L[iFoto].includes(`ordenado por Saldo vencido: ${fotoCob[0]} (`), "la foto se ordena de MAYOR a menor (43f): abre la cuenta con más vencido de la mesa", L[iFoto]); }
  { const { E } = entregaDe({ partes: [{ id: "p1", tema: "cobranza", cierre: "decision", conceptos: ["saldo_vencido", "recuperado"] }], criterio: { lente: "credito" }, profundidad: "breve" });
    ok(E.ok && mismoConjunto(universoDe(E, "p1"), fotoCob) && fotoCob.every((n) => filasServidas(E).has(n)), "una `decision` BREVE sirve la misma foto (lo recortado por tamaño queda en el Detalle con los mismos ids)", JSON.stringify(universoDe(E, "p1")));
    ok(!lineas(E).some((t) => /^Prioridad del procedimiento dentro de este grupo/.test(t)), "la foto no repite la prioridad del procedimiento (una sola conclusión: la del plan del tema)", JSON.stringify(lineas(E))); }
  { const { E } = entregaDe({ partes: [{ id: "p1", tema: "cobranza", cierre: "cifra", conceptos: ["saldo_vencido"] }] });
    ok(E.ok && universoDe(E, "p1").length === nCli, "CONTROL NEGATIVO · una `cifra` de cobranza sin universo sigue sirviendo la cartera COMPLETA (42c), no la foto", String(universoDe(E, "p1").length));
    const { E: E2 } = entregaDe({ partes: [{ id: "p1", tema: "cobranza", cierre: "lectura", conceptos: ["saldo_vencido"], universo: { eje: "cliente", top: { metrica: "saldo_vencido", k: 3 } } }] });
    ok(E2.ok && universoDe(E2, "p1").length === 3 && !lineas(E2).some((t) => /la foto de cobranza/.test(t)), "CONTROL NEGATIVO · una lectura con universo PROPIO (top 3) sirve 3, sin foto", JSON.stringify(universoDe(E2, "p1")));
    const { E: E3 } = entregaDe({ partes: [{ id: "p1", tema: "cobranza", cierre: "lectura", conceptos: ["saldo_vencido"], entidades: [{ nombre: "Lider" }] }] });
    ok(E3.ok && !lineas(E3).some((t) => /la foto de cobranza/.test(t)), "CONTROL NEGATIVO · una lectura de UNA cuenta nombrada no es una foto", JSON.stringify(lineas(E3).slice(0, 3)));
    const { E: E4 } = entregaDe({ partes: [{ id: "p1", tema: "comercial", cierre: "lectura" }, { id: "p2", tema: "cobranza", cierre: "lectura" }] });
    ok(E4.ok && !lineas(E4).some((t) => /la foto de cobranza/.test(t)) && lineas(E4).some((t) => /^Quien más pesa en el conjunto/.test(t)), "CONTROL NEGATIVO · dos lecturas SIN conceptos declarados sirven la prioridad del procedimiento (el plan del tema), no la foto: listar cada cuenta con todas las métricas del dominio no es lo pedido (y la iniciativa no desplaza lo pedido)", JSON.stringify(lineas(E4).slice(0, 4))); }
  { const caja = cajaDelAgente(TOOLS), etiquetas = (r) => (r.boleta || []).map((f) => f.label);
    const sin = etiquetas(caja.cobranza({})), con = etiquetas(caja.cobranza({ cerosDeLaFoto: true }));
    const sana = mesa.filas.slice(0, 8).find((f) => !(f.vencidoK > 0)).nombre;
    ok(!sin.includes(`${sana} · Saldo vencido`) && !sin.includes(`${sana} · Dias Vencido`), "CANDADO · la boleta del AGENTE (sin opt-in) no publica el «$0» ni los «0d» de la cuenta sana de la mesa", sana);
    ok(con.includes(`${sana} · Saldo vencido`) && con.includes(`${sana} · Dias Vencido`) && !con.some((l) => l.startsWith(`${fueraDeLaFoto[0]} · `)), "con el opt-in del Encargo (`cerosDeLaFoto`) la cuenta sana de la foto publica su «$0» y su «0d», y la mesa NO se ensancha", sana); }

  H("A17 · 44(c) · T28 · T40 · inventario y comercial sirven su foto = el eje que sus conceptos sostienen (los 13), con su prioridad encima");
  { const { E } = entregaDe({ partes: [{ id: "p1", tema: "inventario", cierre: "decision", conceptos: ["dias_sin_venta", "capital"], eje: "sku" }], criterio: { lente: "capital" } });
    ok(E.ok && universoDe(E, "p1").length === nSku && axisEntityNames("sku").every((n) => filasServidas(E).has(n)), `una decision de inventario sobre el eje completo sirve los ${nSku} SKU, cada uno con su fila`, JSON.stringify(universoDe(E, "p1"))); }
  { const { E } = entregaDe({ partes: [{ id: "p1", tema: "comercial", cierre: "lectura", conceptos: ["margen", "carga"] }] });
    ok(E.ok && universoDe(E, "p1").length === nCli && axisEntityNames("cliente").every((n) => filasServidas(E).has(n)), `una lectura comercial sin universo sirve los ${nCli} clientes, cada uno con su fila`, JSON.stringify(universoDe(E, "p1")));
    ok(lineas(E).findIndex((t) => /^(Quien más pesa en el conjunto|Prioridad del procedimiento)/.test(t)) >= 0, "y conserva la prioridad del procedimiento", JSON.stringify(lineas(E).slice(0, 6))); }

  H("A17 · 44(a) · T06 · el top por RECUPERADO trae a las cuentas fuera del top 8 por vencido, con su fila; el empate del orden servido se declara");
  { const rec = RK.cliente.recuperado.filas.slice().sort((x, y) => y.valor - x.valor), servidas = rec.filter((f, i) => i < 8 || f.valor === rec[7].valor).map((f) => f.entidad);
    const { E } = entregaDe({ partes: [{ id: "p1", tema: "cobranza", cierre: "decision", conceptos: ["recuperado", "saldo_vencido"], universo: { eje: "cliente", top: { metrica: "recuperado", k: 8 } } }], criterio: { lente: "credito" } });
    const filas = filasServidas(E), fuera = servidas.filter((n) => !fotoCob.includes(n));
    ok(servidas.length === 9 && fuera.length >= 3 && mismoConjunto(universoDe(E, "p1"), servidas), "oráculo · el top 8 de recuperado sirve 9 (el empate del filo) y varias no están en la mesa de 8", JSON.stringify({ servidas, fuera }));
    ok(servidas.every((n) => filas.has(n)), "TODAS las servidas tienen fila (las que la mesa de 8 no publica, también)", JSON.stringify(servidas.filter((n) => !filas.has(n))));
    const grupos = []; for (const f of rec.slice(0, servidas.length)) { const g = grupos.find((x) => x.v === f.valor); if (g) g.n.push(f.entidad); else grupos.push({ v: f.valor, p: rec.findIndex((x) => x.valor === f.valor) + 1, n: [f.entidad] }); }
    const linea = lineas(E).find((t) => /^El top 8 de /.test(t)) || "";
    for (const g of grupos.filter((x) => x.n.length > 1 && x.n.length < servidas.length && x.p + x.n.length - 1 <= 8)) ok(new RegExp(`puesto ${g.p} compartido por`).test(linea) && g.n.every((n) => linea.includes(n)), `el empate del orden servido dice «puesto ${g.p} compartido por» y nombra a TODOS (${g.n.join(", ")})`, linea); }
  { const caja = cajaDelAgente(TOOLS), r = (a) => (caja.cobranza(a).boleta || []).map((f) => f.label);
    ok(!r({}).includes("Ripley · Recuperado") && r({ universoRequerido: { eje: "cliente", top: { metrica: "recuperado", k: 8 } } }).includes("Ripley · Recuperado"), "CANDADO · la boleta del AGENTE no trae a Ripley; el universo tipado del Encargo (`universoRequerido`, top por recuperado) sí", ""); }

  H("A17 · 44(a) · T100 · la oración que declara el empate no la retira el tope de tamaño de un encargo de tres partes");
  { const { E } = entregaDe({ partes: [
      { id: "p1", tema: "cobranza", cierre: "decision", conceptos: ["dias_vencido", "saldo_vencido"], universo: { eje: "cliente", estados: ["en mora"], top: { metrica: "dias_vencido", k: 4 } } },
      { id: "p2", tema: "comercial", cierre: "decision", conceptos: ["contribucion", "carga"], universo: { eje: "cliente", base: "carga comercial alta", top: { metrica: "contribucion", k: 2 } } },
      { id: "p3", tema: "inventario", cierre: "decision", conceptos: ["dias_inventario", "capital"], eje: "sku", universo: { eje: "sku", estados: ["sobrestock"] } }], criterio: { lente: "riesgo" },
      premisas: [
        { id: "q1", tipo: "orden", sujeto: "Falabella", metrica: "dias_vencido", orden: { forma: "topk", k: 4 }, universo: { eje: "cliente", estados: ["en mora"] } },
        { id: "q2", tipo: "grupo", miembros: ["Jumbo"], universo: { eje: "cliente", base: "carga comercial alta", top: { metrica: "contribucion", k: 2 } } },
        { id: "q3", tipo: "conteo", conteo: { n: 1, m: 13 }, de: { eje: "sku", estados: ["sobrestock"] } },
        { id: "q4", tipo: "estado", sujeto: "PHI-IRON-PRO", estado: "sobrestock" }] });
    const declara = (t) => /^El top 4 de \d+ .*que sirve \d+ por el empate del filo/.test(t);
    ok(E.ok && lineas(E).some(declara) && !enDetalle(E).some(declara), "el empate del filo del top 4 de días vencidos («que sirve N por el empate del filo») está en la Respuesta, no en el Detalle", JSON.stringify(enDetalle(E).map((t) => t.slice(0, 70))));
    const verif = verificarEntrega({ texto: E.texto, entrega: E.entrega });
    ok(!verif.violaciones.some((v) => v.regla === "tope-de-tamano") , "y el exceso sobre el tope, si lo hay, queda DECLARADO (`meta.excedeTope`), nunca un tope roto en silencio", JSON.stringify({ palabras: E.entrega.meta && E.entrega.meta.palabras, excede: E.entrega.meta && E.entrega.meta.excedeTope })); }

  H("A17 · 44(a) · T02 · T32 · la premisa de PERTENENCIA sobre un empatado del filo nombra al sujeto, su puesto, su cifra y con quién empata");
  { const mg = RK.sku.margen_venta.filas.slice().sort((x, y) => y.valor - x.valor), v4 = mg[3].valor, empatados = mg.filter((f) => f.valor === v4).map((f) => f.entidad), primero = mg.findIndex((f) => f.valor === v4) + 1;
    const enc = (sujeto, forma, k) => ({ partes: [{ id: "p1", tema: "comercial", cierre: "cifra", conceptos: ["margen", "contribucion"], eje: "sku", universo: { eje: "sku", top: { metrica: "margen", k: 4 } } }], premisas: [{ id: "q1", tipo: "orden", sujeto, metrica: "margen", orden: { forma, ...(k ? { k } : {}) }, universo: { eje: "sku" } }] });
    const suj = empatados.includes("LG-AIR9000") ? "LG-AIR9000" : empatados[0], t = oracionesDe(entregaDe(enc(suj, "topk", 4)).E)[0] || "", otros = empatados.filter((n) => n !== suj);
    ok(empatados.length >= 2 && primero <= 4 && primero + empatados.length - 1 > 4, "oráculo · el corte del top 4 de margen cae DENTRO de un empate", JSON.stringify({ empatados, primero }));
    ok(/es correcto —/.test(t) && t.includes(`${suj}:`) && t.includes(`${v4}%`) && new RegExp(`en el puesto ${primero}(?!\\d)`).test(t) && otros.every((n) => t.includes(n)), "«está entre los 4»: VERDADERA y dice al sujeto con su cifra, con quién empata y el puesto compartido (no lista otros SKU)", t);
    const max = oracionesDe(entregaDe(enc(mg[0].entidad, "max")).E)[0] || "";
    ok(/es correcto —/.test(max) && max.includes(`(${mg[1].valor}%)`), "CONTROL NEGATIVO · «es el de más margen» (un máximo, fuera de un empate del filo) conserva el top de la casa con sus cifras", max); }

  H("A17 · 44(b) · T14 · T12 · una definición sin curar se DECLARA como límite (no toma la de otra parte); el título de una definición va en la voz de la casa");
  { const { E } = entregaDe({ partes: [{ id: "p1", tema: "comercial", cierre: "definicion", concepto: "peso_costo" }, { id: "p2", tema: "comercial", cierre: "definicion", concepto: "en_juego" }] });
    const defs = lineas(E).filter((t) => /^en juego: /.test(t));
    ok(E.ok && defs.length === 1, "«en juego» (curada) se sirve UNA vez: la parte sin definición curada no la toma", JSON.stringify(defs.map((t) => t.slice(0, 40))));
    ok(_limitesDe(E).some((t) => /peso costo/.test(t) && /definición/.test(t) && /no está disponible/.test(t)) && !_limitesDe(E).some((t) => /_/.test(t)), "«peso costo» se declara como límite (sin la clave interna con guion bajo)", JSON.stringify(_limitesDe(E)));
    const { E: E2 } = entregaDe({ partes: [{ id: "p1", tema: "comercial", cierre: "definicion", concepto: "en_juego" }] });
    ok(E2.ok && lineas(E2).filter((t) => /^en juego: /.test(t)).length === 1 && !_limitesDe(E2).some((t) => /definición de/.test(t)), "CONTROL NEGATIVO · una definición curada sola se sirve una vez y no declara límite", JSON.stringify(_limitesDe(E2))); }
  { const { E } = entregaDe({ partes: [{ id: "p1", tema: "comercial", cierre: "definicion", concepto: "meta" }, { id: "p2", tema: "comercial", cierre: "cifra", conceptos: ["margen"], entidades: [{ nombre: "Jumbo" }] }], premisas: [{ id: "q1", tipo: "grupo", miembros: ["Jumbo"], universo: { eje: "cliente", base: "bajo el benchmark" } }] });
    const verif = verificarEntrega({ texto: E.texto, entrega: E.entrega });
    ok(lineas(E).some((t) => /^objetivo: /.test(t)) && !lineas(E).some((t) => /^meta: /.test(t)), "la definición de «meta» se titula «objetivo» (la palabra de la casa)", JSON.stringify(lineas(E).map((t) => t.slice(0, 30))));
    ok(!verif.violaciones.some((v) => v.regla === "registro-informal"), "y `verificarEntrega` no marca «registro-informal» junto al benchmark", JSON.stringify(verif.violaciones));
    ok(objetivoPorMeta("meta") === "objetivo" && objetivoPorMeta("Meta") === "Objetivo" && objetivoPorMeta("metas") === "objetivos" && objetivoPorMeta("markup") === "markup" && objetivoPorMeta("en juego") === "en juego", "CONTROL NEGATIVO · `objetivoPorMeta` solo cambia «meta/target»; cualquier otro término sale intacto", ""); }

  H("A17 · 41(c) · T46 · T47 · la verdad propia de una entidad dentro del top que falla el ESTADO es la cifra del estado; la exclusión por bodega lleva la referencia");
  { const uni = { eje: "cliente", estados: ["al dia"], top: { metrica: "ventas", k: 3, sobre: "eje" } };
    const gr = (m) => oracionesDe(entregaDe({ partes: [{ id: "p1", tema: "cobranza", cierre: "cifra", conceptos: ["saldo_vencido", "abonado"], universo: uni }], premisas: [{ id: "q1", tipo: "grupo", miembros: [m], universo: uni }] }).E)[0] || "";
    const fv = RK.cliente.saldo_vencido.filas.find((f) => f.entidad === "Falabella"), venc = fv.raw, t = gr("Falabella");
    ok(venc > 0 && t.includes("no es así") && t.includes("está en mora") && t.includes(fv.texto) && !/puesto \d+ de \d+/.test(t), "«Falabella está entre las 3 que más venden y al día» (falsa: está en mora): dice su estado CON su cifra (saldo vencido) y ningún puesto por venta", t);
    const so = gr("Sodimac");
    ok(/no es así — Sodimac: está en mora/.test(so) && /puesto \d+ de \d+/.test(so) && !/saldo vencido/i.test(so), "CONTROL NEGATIVO · una cuenta FUERA del top conserva su puesto (la razón que la deja fuera es el top)", so); }
  { const uni = { eje: "sku", estados: ["rota bien"], excluir: { bodega: "Santiago" } };
    const t = oracionesDe(entregaDe({ partes: [{ id: "p1", tema: "inventario", cierre: "cifra", conceptos: ["rotacion", "capital"], eje: "sku", universo: uni }], premisas: [{ id: "q1", tipo: "grupo", miembros: ["SAM-TV55"], universo: uni }] }).E)[0] || "";
    ok(/fuera del universo por su bodega \(Santiago\)/.test(t) && t.includes(valorDe("rotacionMin")), `el SKU excluido por su bodega dice el piso de rotación con que se juzga el universo (${valorDe("rotacionMin")})`, t);
    const u2 = { eje: "cliente", base: "bajo el benchmark", excluir: { entidades: ["Unimarc"] } };
    const t2 = oracionesDe(entregaDe({ partes: [{ id: "p1", tema: "comercial", cierre: "cifra", conceptos: ["margen"], universo: u2 }], premisas: [{ id: "q1", tipo: "grupo", miembros: ["Unimarc"], universo: u2 }] }).E)[0] || "";
    ok(/fuera del universo por exclusión de la consulta\.?$/.test(t2), "CONTROL NEGATIVO · la exclusión por el NOMBRE de la entidad no agrega referencia", t2); }

  H("A17 · 43(b) · T36 · los ceros por AUSENCIA de una cifra sin `top` se ordenan y su empate se declara con el puesto y todos los que lo comparten");
  { const filas = RK.sku.capital_inmovilizado.filas, ceros = axisEntityNames("sku").filter((n) => !filas.some((f) => f.entidad === n)), puesto = filas.length + 1;
    const { E } = entregaDe({ partes: [{ id: "p1", tema: "inventario", cierre: "cifra", conceptos: ["capital_inmovilizado", "capital"], eje: "sku", universo: { eje: "sku" } }] });
    const l = lineas(E).find((t) => /^Por sku, ordenado por Capital inmovilizado/.test(t)) || "";
    ok(ceros.length >= 3 && puesto + ceros.length - 1 === nSku, "oráculo · los SKU sin capital inmovilizado (cero por ausencia) ocupan los últimos puestos, juntos", JSON.stringify({ ceros, puesto }));
    ok(new RegExp(`Empate en el orden servido: puesto ${puesto} compartido por`).test(l) && ceros.every((n) => l.includes(n)), `la línea del orden dice «puesto ${puesto} compartido por» y nombra a los ${ceros.length}`, l);
    const { E: E2 } = entregaDe({ partes: [{ id: "p1", tema: "inventario", cierre: "cifra", conceptos: ["capital_inmovilizado", "capital"], eje: "sku", universo: { eje: "sku", top: { metrica: "capital_inmovilizado", k: 6 } } }] });
    ok(E2.ok && !lineas(E2).some((t) => /Empate en el orden servido/.test(t)), "CONTROL NEGATIVO · con `top` el corte puede partir el grupo en cero: no se declara un empate a medias (lo dice el empate del filo)", JSON.stringify(lineas(E2).slice(0, 4))); }
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
