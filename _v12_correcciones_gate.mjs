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
 *   A18 · decisión 45 (§7.3·45; diagnóstico v21): una BODEGA pedida acota el universo servido también en el hecho histórico de los días sin venta sin umbral de frenado, con el límite que lo dice (c, T70) ·
 *         una lente se nombra con su nombre visible, nunca con su id: «por credito» → «por exposición de crédito» (e).
 *
 *   A19 · diagnóstico v22 (propuesta §7.3·46): un criterio con lente Y referencia conserva las dos (S47) · la verdad propia de un miembro que falla la base es la cifra de la base (S42) y la del SKU fuera por la bodega pedida
 *         nombra su bodega (S67) · una cifra de dos ejes se sirve con el productor de cada uno y la «Venta diaria» no pisa a «Ventas» (S84) · la lente pedida gobierna la prioridad de una decision sin universo y la foto declara lo que no trae
 *         (S31 S16) · el empate en cero de la pertenencia dice su cifra (S03 S04) · la falsa por M dice el M más ajustado de la cadena (S17 S18 S21).
 *
 *   A21 · diagnóstico v23 (§7.3·47): un top con empate en el filo sirve una fila por cada empatado (R01) · la foto de un eje explícito declara la cuenta que no trae la cifra pedida, con su «N de M» (R18) ·
 *         la referencia de la consulta se declara en el EJE del universo (marca · familia), no en clientes (R40 R45) · la lente pedida que aplica al dominio ordena la prioridad con SU medida: el saldo vencido · el capital inmovilizado crítico (R48 R100) ·
 *         si esa medida no distingue a nadie se declara sin coronar a la primera de la lista y un grupo en cero no tumba la Entrega (R72 R65).
 *
 *   A22 · diagnóstico v24 (§7.3·48): el empate en el filo por TODOS los productores (cobranza · inventario SKU y bodega) con sus ceros, lo declarado ES lo servido (Q05 Q08) · la lente × el dominio: el riesgo pedido se declara, «ventas» ordena cuentas, la medida de la lente que aplica se lee (Q44 Q45 Q70) ·
 *         el «de M» de un conteo en todas las formas de universo (Q63) · la oración «ninguna cuenta queda primera» pasa el verificador (Q100) · una definición sola no cita benchmark (Q09) · la cola de la foto en «breve» (Q13) · el barrido por combinación como aserciones.
 *
 *   A23 · diagnóstico v25 y v26 (§7.3·49): la referencia de la consulta en CADA parte que usa el conjunto, en su eje (P48) · una decision con entidades nombradas decide entre ellas (P60 P61 N63-N65) · la foto es el eje entero (N19 N23) ·
 *         una premisa carga su evidencia y el Marco no declara una cifra sin hecho (N26) · «ventas» aplica en cliente, marca, familia y SKU (N25 N32 N38 N73) · el rótulo de su concepto (N78) · el corte Cifras/Detalle no parte una entidad (P74) ·
 *         el «techo de quiebre» en el criterio aplicado (N39) · el Marco de cobranza sin «inventario» · el barrido por combinación como aserciones, con su carnada.
 *   A24 · corrección de las mediciones v25 y v26 (§7.3·50): la prioridad pide atención, nunca corona al mejor — lente × dominio·eje × forma del grupo × métrica propia (con su polaridad) × cierre · la cabeza de una lectura con varias partes cita solo
 *         las entidades que caben enteras · los dos residuos de la 49(d) (el capital inmovilizado crítico por familia y la premisa de orden sobre «carga comercial alta» en el eje cliente) · cada familia con su carnada.
 * Solo por `npm run gates:offline` (o con el candado: node --import ./scripts/offline-guard.mjs _v12_correcciones_gate.mjs). Cero red. */
import { initTenant } from "./src/data/tenantStore.js";
import { TENANT_DEMO, skuInventario, clientesMargen, clientesVentas, skusMargen, marcasMargen, sfamiliasMargen } from "./src/data/tenants/demo.js";
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
import { CRITERIOS } from "./src/adi/agente/prioridadIntegrada.js";
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
  ok(t.includes("nivel de referencia de carga 3.75%") && !/3\.8%/.test(t), "el veredicto imprime el nivel de referencia de carga 3.75% exacto (nunca «3.8%»)", t);
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
  ok(/en días vencido, Easy 270 días contra Unimarc/.test(E.texto) && E.entrega.cifras.filas.some((f) => f.valores["Entidad / grupo"] === "Unimarc" && /días vencido/i.test(f.valores["Métrica"] || "")), "Easy 270 días contra Unimarc 0 días (fuera del top 8): el par SÍ sale, con la fila de Unimarc", E.texto.split("\n").find((l) => /Comparando/.test(l)));
  const sin = [];
  const ents = ["Falabella", "Lider", "Jumbo", "Easy", "Sodimac", "Ripley", "La Polar", "Unimarc", "Tottus", "Hites", "Paris"];
  for (const a of ["Jumbo", "Ripley", "La Polar"]) for (const b of ents) { if (a === b) continue; if (!/días vencido/i.test(cmp(a, b).texto)) sin.push(`${a}~${b}`); }
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
  ok(/La Polar no tiene días vencido \(0 días\) contra Ripley no tiene días vencido \(0 días\)/.test(l(E1)), "La Polar 0 días contra Ripley 0 días: «no tiene días vencido (0 días)» de cada lado (con el rótulo del léxico, §7.3·49f)", l(E1));
  const E2 = cmp("Easy", "Unimarc", ["saldo_vencido", "dias_vencido"]);
  ok(/Easy 270 días contra Unimarc no tiene días vencido \(0 días\)/.test(l(E2)) && !/Easy no tiene/.test(l(E2)), "Easy 270 días (no es 0: plano) contra Unimarc 0 días (en palabras)", l(E2));
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
  ok(/Nivel de referencia de carga: 3\.5%/.test((E.entrega.marco.referenciaDeclarada || {}).texto || ""), "el Marco sigue con el nivel OFICIAL (3.5%), nunca el de la consulta");
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
  ok(new RegExp(`Nivel de referencia de carga: ${nivel}%, declarado por la empresa\\.`).test(ref), `base «sobre el nivel declarado de carga»: el Marco dice «Nivel de referencia de carga: ${nivel}%, declarado por la empresa» (oráculo: umbral().valor)`, ref);
  ok(ref.split("Nivel de referencia de carga").length === 2, "…una sola vez (no se duplica si otra ruta ya lo había declarado)", ref);
  ok(/Benchmark de margen: 30\.1%/.test(ref) ? /Nivel de referencia de carga/.test(ref) : true, "si el benchmark de las observaciones de controller ocupó el campo, el nivel se AGREGA (no queda sin declarar)", ref);
  /* v19 (§7.3·42b): la v18 leía «carga comercial alta» solo por su piso de materialidad y NO agregaba el nivel; el detector es carga > nivel Y exceso ≥ piso, y su veredicto imprime el nivel: el Marco también lo lleva (bloque A13·Y40) */
  const { E: E2 } = entregaDe({ partes: [{ id: "p1", tema: "comercial", cierre: "cifra", conceptos: ["ventas", "margen"], universo: { eje: "cliente" } }] });
  ok(!/Nivel de referencia de carga/.test((E2.entrega.marco.referenciaDeclarada || {}).texto || ""), "CONTROL NEGATIVO · un encargo que no usa el nivel de carga no lo declara en el Marco");
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
  ok(carga("Tottus") <= umbral("targetCarga").valor && new RegExp(`carga comercial ${carga("Tottus")}%`).test(segT) && new RegExp(`nivel de referencia de carga ${umbral("targetCarga").valor}%`).test(segT), "Tottus (bajo el benchmark, carga 3.2 % que NO supera el nivel): dice su carga y el nivel 3.5 % en SU frase", t);
  ok(margen("La Polar") > benchmarkOf() && carga("La Polar") > umbral("targetCarga").valor && new RegExp(`margen ${margen("La Polar")}%`).test(segL) && !/carga comercial/.test(segL) && new RegExp(`benchmark de margen ${benchmarkOf()}%`).test(segL), "La Polar (34 % > benchmark: sale por la BASE; su carga 3.9 % SÍ pasa el filtro): dice su margen y el benchmark, nunca «carga comercial 3.9 %»", t);
}

H("A13 · Y10 · una UNIÓN deja fuera a quien no cumple ninguna rama: la verdad dice la cifra de cada rama (antes caía a la traza, sin entidad)");
{
  const univ = { eje: "cliente", union: [{ eje: "cliente", base: "sobre el benchmark" }, { eje: "cliente", base: "sobre el nivel declarado de carga" }] };
  const { E } = entregaDe({ partes: [{ id: "p1", tema: "comercial", cierre: "cifra", conceptos: ["margen", "carga"], universo: univ }], premisas: [{ id: "q1", tipo: "grupo", miembros: ["Tottus", "Mercado Libre"], universo: univ }, { id: "q2", tipo: "grupo", miembros: ["La Polar"], universo: univ }] });
  const t = _premisasDe(E)[0] || "";
  const m = (n) => RK.cliente.margen.filas.find((f) => f.entidad === n).valor, c = (n) => RK.cliente.carga.filas.find((f) => f.entidad === n).valor;
  ok(t.includes(`Tottus: margen ${m("Tottus")}%, carga comercial ${c("Tottus")}%`) && t.includes(`Mercado Libre: margen ${m("Mercado Libre")}%, carga comercial ${c("Mercado Libre")}%`), "Tottus y Mercado Libre (fuera por los dos lados): cada una con su margen y su carga, no la traza del universo sin entidad", t);
  ok(new RegExp(`benchmark de margen ${benchmarkOf()}%`).test(t) && new RegExp(`nivel de referencia de carga ${umbral("targetCarga").valor}%`).test(t), "…con las dos referencias de la unión en la misma oración", t);
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
  ok(new RegExp(`Nivel de referencia de carga: ${nivel}%, declarado por la empresa\\.`).test(marco(E)) && marco(E).split("Nivel de referencia de carga").length === 2, `base «carga comercial alta»: el Marco lleva el nivel oficial ${nivel} % (el detector es carga > nivel Y exceso ≥ piso; el veredicto ya lo imprime), una sola vez`, marco(E));
  const univ = { eje: "cliente", base: "bajo el benchmark", filtros: [{ metrica: "carga", op: ">", ref: "nivel_carga" }] };
  const { E: E2 } = entregaDe({ partes: [{ id: "p1", tema: "comercial", cierre: "cifra", conceptos: ["margen", "carga"], universo: univ }], premisas: [{ id: "q1", tipo: "grupo", miembros: ["Tottus"], universo: univ }] });
  ok(new RegExp(`Benchmark de margen: ${benchmarkOf()}%`).test(marco(E2)) && new RegExp(`Nivel de referencia de carga: ${nivel}%`).test(marco(E2)) && marco(E2).split("Benchmark de margen").length === 2, "base «bajo el benchmark» + filtro con `ref` del nivel en una premisa: el Marco lleva el benchmark Y el nivel (antes solo el nivel, que había ocupado el campo primero), cada uno una vez", marco(E2));
  const { E: E3 } = entregaDe({ partes: [{ id: "p1", tema: "comercial", cierre: "cifra", conceptos: ["ventas", "margen"], universo: { eje: "cliente" } }] });
  ok(!/Nivel de referencia de carga/.test(marco(E3)), "CONTROL NEGATIVO · un encargo que no usa el nivel de carga no lo declara en el Marco", marco(E3));
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
  /* una `decision` NO cambia: su primera fila es «la prioridad del procedimiento» (una conclusión, no una exhibición); la 43(f) habla de la cifra (la 50a rige solo la ORACIÓN de prioridad: el orden de la lista es el de siempre) */
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
  /* CONSOLIDACIÓN, SEGUNDA VUELTA (§7.3·51(e) y 51(a), posteriores a esta corrección v20): una lectura sobre el eje BODEGA sirve las bodegas, no un SKU (la oración «quien más pesa» del SKU ya no acompaña a una parte por bodega), y la lista de la foto se ordena por el PRIMER concepto pedido que su productor publica (aquí «capital inmovilizado crítico», de mayor a menor; las bodegas que no figuran llevan su cero de cobertura declarada) y la Entrega lo dice. */
  ok(!E.entrega.respuesta.some((r) => /quien más pesa/.test(r.texto || "")) && !/LG-DRYER8KG|BOS-SANDER/.test(E.texto), "§7.3·51(e): la lectura por BODEGA sirve las bodegas y NO un SKU (ninguna oración «quien más pesa» de un SKU)", E.entrega.respuesta.map((r) => r.texto).join(" | ").slice(0, 300));
  const linea = (E.entrega.respuesta.find((r) => /^Por bodega, ordenado por/.test(r.texto || "")) || {}).texto || "";
  ok(/^Por bodega, ordenado por Capital inmovilizado crítico: Valparaíso \(\$25K\), Antofagasta \(\$8K\), Santiago \(\$0\)\./.test(linea), "§7.3·51(a): el listado se ordena por «Capital inmovilizado crítico» (el primer concepto pedido que su productor publica), de mayor a menor, cada nombre con su cifra", linea);
  void rkCap;
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

/* ═══ A18 · DECISIÓN 45 (§7.3·45, supervisor 2026-09-30; diagnóstico v21: T70 y el hallazgo lateral «por credito») ═══════════════════════════════════════════════
 *   45(c) · T70 · una BODEGA pedida acota el universo servido, también el del HECHO histórico de los días sin venta cuando falta el umbral de «frenado»: «los frenados de Valparaíso» sirve los SKU de Valparaíso,
 *           nunca los de todas las bodegas (antes: los 13). La bodega EXCLUIDA acota igual, y una unión de bodegas sirve la suma; una rama sin bodega es el eje entero. Con el límite que lo dice («de Valparaíso»).
 *   45(e) · una lente se nombra con su NOMBRE VISIBLE (`CRITERIOS[id].nombre`, la declaración de la lente), nunca con su id: «por credito» → «por exposición de crédito». Para TODAS las lentes.
 * Oráculos: la bodega de cada SKU en la proyección (`cifrasDelDato`), el tamaño del eje y la declaración de la lente; nunca el código que se corrige. */
{
  const skus = axisEntityNames("sku"), bodegaDe = (n) => _bodegaDeSku(n);
  const deBodega = (b) => skus.filter((n) => bodegaDe(n) === b);
  const filasServidas = (E) => { const s = new Set(); for (const f of [...((E.entrega.cifras && E.entrega.cifras.filas) || []), ...((E.entrega.detalle && E.entrega.detalle.filas) || [])]) { const n = f.valores && f.valores["Entidad / grupo"]; if (typeof n === "string" && skus.includes(n)) s.add(n); } return [...s]; };
  const mismos = (a, b) => a.length === b.length && b.every((x) => a.includes(x));
  const BOD = bodegaDe("LG-DRYER8KG"), OTRA = bodegaDe("SAM-TV55");
  const enBodega = deBodega(BOD), enOtra = deBodega(OTRA);
  const servido = (universo, extra = {}) => { const { E } = entregaDe({ partes: [{ id: "p1", tema: "inventario", cierre: "cifra", conceptos: ["dias_sin_venta", "capital"], eje: "sku", universo }], ...extra }); return { E, filas: filasServidas(E), univ: ((E.entrega.universos || []).find((u) => u.id === "p1_dias_sin_venta") || {}).entidades || [] }; };

  H("A18 · 45(c) · T70 · «los frenados de Valparaíso» SIN umbral sirve los días sin venta de los SKU de la BODEGA pedida (no los 13), y el límite lo dice");
  ok(BOD && OTRA && BOD !== OTRA && enBodega.length >= 2 && enBodega.length < skus.length && enOtra.length >= 2, "oráculo · hay al menos dos bodegas con SKU y la bodega pedida no es todo el eje", JSON.stringify({ BOD, OTRA, enBodega, enOtra }));
  { const r = servido({ eje: "sku", estados: ["frenado"], bodega: BOD });
    ok(r.E.ok && mismos(r.filas, enBodega), `las filas servidas son EXACTAMENTE los ${enBodega.length} SKU de ${BOD}`, JSON.stringify({ filas: r.filas, esperado: enBodega }));
    ok(mismos(r.univ, enBodega), "el universo declarado del hecho (`p1_dias_sin_venta`) es el mismo que las filas servidas: lo declarado ES lo servido", JSON.stringify(r.univ));
    ok(!skus.filter((n) => bodegaDe(n) !== BOD).some((n) => (r.E.texto || "").includes(n)), "ningún SKU de otra bodega aparece en ningún lugar del texto servido", skus.filter((n) => bodegaDe(n) !== BOD && (r.E.texto || "").includes(n)).join(", "));
    ok(_limitesDe(r.E).some((t) => /la venta frenada queda sin evaluar/.test(t)) && new RegExp(`Los días sin venta de cada SKU de ${BOD}, un hecho histórico`).test(((r.E.entrega.limites || []).map((l) => l.motivo || "").join(" "))), `el límite nombra la bodega: «los días sin venta de cada SKU de ${BOD}»`, JSON.stringify(r.E.entrega.limites)); }
  { const r = servido({ eje: "sku", estados: ["frenado"], bodega: BOD, top: { metrica: "capital", k: 2, direccion: "mayor" } });
    ok(r.E.ok && mismos(r.filas, enBodega), "con un `top` sobre el veredicto sin evaluar también se acota a la bodega (el top no se puede juzgar; el hecho sí)", JSON.stringify(r.filas)); }
  { const r = servido({ eje: "sku", estados: ["frenado"], excluir: { bodega: BOD } }), esp = skus.filter((n) => bodegaDe(n) !== BOD);
    ok(r.E.ok && mismos(r.filas, esp) && !r.filas.some((n) => bodegaDe(n) === BOD), `la bodega EXCLUIDA acota igual: sirve los ${esp.length} SKU que no son de ${BOD}`, JSON.stringify(r.filas)); }
  { const r = servido({ eje: "sku", union: [{ eje: "sku", estados: ["frenado"], bodega: BOD }, { eje: "sku", estados: ["frenado"], bodega: OTRA }] });
    ok(r.E.ok && mismos(r.filas, [...enBodega, ...enOtra]), `una unión de dos bodegas sirve la suma de sus SKU (${enBodega.length + enOtra.length})`, JSON.stringify(r.filas)); }
  { const r = servido({ eje: "sku", union: [{ eje: "sku", estados: ["frenado"], bodega: BOD }, { eje: "sku", estados: ["inmovilizado"] }] });
    ok(r.E.ok && mismos(r.filas, skus), "CONTROL NEGATIVO · una rama de la unión SIN bodega es el eje entero: la unión no acota nada (los 13)", JSON.stringify(r.filas)); }
  { const r = servido({ eje: "sku", estados: ["frenado"] });
    ok(r.E.ok && mismos(r.filas, skus), "CONTROL NEGATIVO · «los frenados» sin bodega sigue sirviendo los días sin venta de TODOS los SKU", JSON.stringify(r.filas));
    ok(!/Los días sin venta de cada SKU (?:de|fuera de) /.test((r.E.entrega.limites || []).map((l) => l.motivo || "").join(" ")), "CONTROL NEGATIVO · sin bodega el límite conserva su texto de siempre (sin «de …»)", JSON.stringify(r.E.entrega.limites)); }
  { const r = servido({ eje: "sku", estados: ["frenado"], bodega: BOD }, { criterio: { referencia: { concepto: "umbral_frenado", valor: 45, unidad: "days" } } });
    ok(r.E.ok && r.filas.length >= 1 && r.filas.every((n) => bodegaDe(n) === BOD), "CONTROL NEGATIVO · con umbral planteado en la consulta el veredicto se evalúa y ya acotaba a la bodega: no cambia", JSON.stringify(r.filas)); }
  for (const cierre of ["lectura", "decision"]) { const { E } = entregaDe({ partes: [{ id: "p1", tema: "inventario", cierre, conceptos: ["dias_sin_venta", "capital"], eje: "sku", universo: { eje: "sku", estados: ["frenado"], bodega: BOD } }] });
    ok(E.ok && mismos(filasServidas(E), enBodega), `la misma acotación rige en una ${cierre} (no solo en la cifra)`, JSON.stringify(filasServidas(E))); }

  H("A18 · 45(e) · una lente se nombra con su NOMBRE VISIBLE (la declaración de la lente), nunca con su id — «por credito» → «por exposición de crédito»");
  /* §7.3·46(d): la oración del grupo nombra la lente que de verdad ORDENÓ la lista (ver A20); aquí solo se cobra que, cuando una lente se nombra (como la que ordena o como el criterio pedido que no aplica), se diga con su NOMBRE VISIBLE y nunca con su id */
  { const lente = (id) => { const { E } = entregaDe({ partes: [{ id: "p1", tema: "cobranza", cierre: "decision", conceptos: ["saldo_vencido"], universo: { eje: "cliente", top: { metrica: "saldo_vencido", k: 3 } } }], ...(id ? { criterio: { lente: id } } : {}) }); const m = /Prioridad del procedimiento dentro de este grupo, por ([^:]+):/.exec(E.texto || ""); return m ? m[1] : null; };
    ok(Object.keys(CRITERIOS).length >= 6 && CRITERIOS.credito.nombre === "exposición de crédito", "oráculo · la declaración de la lente (`CRITERIOS`) trae el nombre visible de cada lente", JSON.stringify(Object.keys(CRITERIOS)));
    for (const id of Object.keys(CRITERIOS).filter((x) => x !== "riesgo")) { const v = lente(id), nom = id === "ventas" ? "venta a crédito" : CRITERIOS[id].nombre; ok(v != null && v.includes(nom) && (new RegExp(`\\b${id}\\b`).test(nom) || !new RegExp(`\\b${id}\\b`).test(v)),`la lente «${id}» se dice con su nombre visible «${nom}», nunca con el id`, String(v)); }
    ok(lente("credito") === "exposición de crédito" && !/\bcredito\b/.test(lente("credito") || ""), "«por credito» ya no se imprime: dice «por exposición de crédito» (es la lente que ordena el saldo vencido)", String(lente("credito")));
    ok(!/riesgo/.test(lente(undefined) || "riesgo") && lente("riesgo") === "saldo vencido (el criterio pedido, riesgo, es el criterio entre dominios y no ordena este grupo)", "CONTROL NEGATIVO · la lente de riesgo POR DEFECTO no se estampa en la oración de un grupo (el grupo dice la clave que lo ordenó); la de riesgo PEDIDA por el usuario se declara como el criterio ENTRE dominios que no ordena un grupo (A20 · A22/47e)", JSON.stringify([lente(undefined), lente("riesgo")])); }
  { const { E } = entregaDe({ partes: [{ id: "p1", tema: "inventario", cierre: "decision", conceptos: ["capital", "dias_sin_venta"], eje: "sku", universo: { eje: "sku", estados: ["frenado"] } }], criterio: { referencia: { concepto: "umbral_frenado", valor: 45, unidad: "days" } } });
    ok(E.ok && !/por umbral de venta frenada:/.test(E.texto || "") && /\(la referencia pedida, umbral de venta frenada, no ordena este grupo\)/.test(E.texto || "") && !/umbral_frenado/.test(E.texto || ""), "CONTROL NEGATIVO · un criterio que es una REFERENCIA (no una lente) se nombra COMO referencia (§7.3·52e: la medida que ordenó y la referencia pedida; nunca como el criterio, nunca la clave técnica)", ((E.texto || "").split("\n").find((l) => /Prioridad del procedimiento/.test(l)) || "").slice(0, 160)); }
}

/* ═══ A19 · DIAGNÓSTICO v22 (medición ciega v22, catálogo sellado v22; §7.3·45 y propuesta 46) ═══════════════════════════════════════════════════════════
 * Siete raíces, cada una con su carnada en POSITIVO y su control en NEGATIVO:
 *   46(a) · S47 · un `criterio` con lente Y referencia conserva LAS DOS (antes la lente ganaba y la referencia se descartaba en silencio: el umbral de la consulta no se aplicaba, el universo de frenados salía vacío).
 *   41(c) · S42 · la verdad propia de un miembro que falla la BASE (no el top excluido) es la cifra de la base (su margen), no un «puesto 9 de 13 por venta» que el top excluido no explica.
 *   37a  · S67 · la verdad propia de un SKU fuera por la bodega PEDIDA (universo = solo la bodega) nombra al SKU y a su bodega propia (antes: «en Antofagasta.»).
 *   46(b) · S84 · una `cifra` con entidades de DOS ejes se sirve con el productor de cada una (`ejes_mezclados` rige solo la comparación): la venta de un SKU es la venta (no la «Venta diaria (unidades)» 0.8), y `verificarEntrega` acepta la Entrega.
 *   46(c) · S31 · S16 · «el criterio del usuario manda»: la lente pedida gobierna la prioridad de una `decision` sin universo (antes: siempre «por riesgo integrado»); si la lente no ordena ese conjunto, se DECLARA; y la foto
 *           declara las cuentas sin la cifra de un concepto pedido.
 *   39(c) · S03 · S04 · la pertenencia a un top sobre un empatado del filo EN CERO dice el cero con su cifra («no tiene capital inmovilizado crítico ($0)»).
 *   44(d) · S17 · S18 · S21 · la verdad propia de un conteo falso solo por el «de M» imprime el M MÁS AJUSTADO de la cadena del universo (el mismo que una premisa verdadera de ese universo), nunca un «5 de 5» vacuo ni el eje.
 * Oráculos: los datos del tenant (`skuInventario`, `clientesMargen`, `skusMargen`), la mesa de cobranza y la bodega de cada SKU en la proyección; nunca el código que se corrige. */
{
  const skus = axisEntityNames("sku"), clientes = axisEntityNames("cliente");
  const textoDe = (E) => String(E.texto || "");
  const lineasR = (E) => ((E.entrega && E.entrega.respuesta) || []).map((r) => String(r.texto || ""));
  const lineaCon = (E, ...frag) => lineasR(E).find((l) => /premisa planteada/.test(l) && frag.every((f) => (f instanceof RegExp ? f.test(l) : l.includes(f)))) || "";
  const universoDe = (E, id) => ((E.entrega.universos || []).find((u) => u.id === id) || {}).entidades || [];
  const mismos = (a, b) => a.length === b.length && b.every((x) => a.includes(x));

  H("A19 · 46(a) · S47 · un criterio con lente Y referencia conserva las dos: el umbral de la consulta se aplica y la lente ordena");
  { const frenados68 = skuInventario.filter((s) => s.diasSinVenta > 68).map((s) => s.sku);
    const parte = { id: "p1", tema: "inventario", cierre: "decision", conceptos: ["dias_sin_venta", "capital"], eje: "sku", universo: { eje: "sku", estados: ["frenado"] } };
    const ref = { concepto: "umbral_frenado", valor: 68, unidad: "days" };
    const premisas = [{ id: "q1", tipo: "conteo", conteo: { n: frenados68.length, m: skus.length }, de: { eje: "sku", estados: ["frenado"] } }, { id: "q2", tipo: "estado", sujeto: "BOS-SANDER", estado: "frenado" }];
    const { R, E } = entregaDe({ partes: [parte], criterio: { lente: "capital", referencia: ref }, premisas });
    ok(frenados68.length >= 2 && skuInventario.find((s) => s.sku === "BOS-SANDER").diasSinVenta === 68, "oráculo · hay ≥ 2 SKU con más de 68 días sin venta y BOS-SANDER tiene exactamente 68 (el filo: «sobre el umbral» es estricto)", JSON.stringify(frenados68));
    ok(R.criterio && R.criterio.lente === "capital" && R.criterio.origen === "usuario" && R.criterio.referencia && R.criterio.referencia.valor === 68 && R.criterio.referencia.concepto === "umbral_frenado", "el criterio resuelto trae la LENTE y la REFERENCIA (antes: solo la lente)", JSON.stringify(R.criterio));
    ok(E.ok && mismos(universoDe(E, "p1"), frenados68), `el universo de frenados con el umbral 68 son los ${frenados68.length} SKU sobre 68 días (no vacío)`, JSON.stringify(universoDe(E, "p1")));
    /* §7.3·47(a) (v23 · R48): la lente capital APLICA al inventario: ordena la prioridad con SU medida (el capital inmovilizado crítico), no con los días sin venta con que se listó el grupo */
    { const capFr = frenados68.map((n) => skuInventario.find((s) => s.sku === n)).sort((a, b) => b.stockUSD - a.stockUSD)[0];
      ok(/dentro de este grupo, por capital: [^,]+, con .* en capital inmovilizado crítico\./.test(textoDe(E)) && textoDe(E).includes(`por capital: ${capFr.sku}, con `) && !/por días sin venta:/.test(textoDe(E)) && !/sin umbral declarado/.test(textoDe(E)), "la oración del grupo nombra la lente capital y su primero es el de MAYOR capital inmovilizado crítico entre los frenados (oráculo: stockUSD del dato; 47(a): la lente que aplica al dominio ordena), y el Marco no dice «sin umbral declarado»", textoDe(E).split("\n").filter((l) => /Prioridad|umbral/i.test(l)).join(" | ")); }
    ok(/es correcto — .*\b2 de 13\b/.test(lineaCon(E, /de 13/)) || lineaCon(E, /de 13/).includes(`${frenados68.length} de ${skus.length}`), "la premisa «son N de 13» se juzga (verdadera) con el umbral de la consulta", lineaCon(E, /de 13/));
    ok(/no es así/.test(lineaCon(E, "BOS-SANDER")) && /68/.test(lineaCon(E, "BOS-SANDER")), "«BOS-SANDER está frenado» es FALSA con el umbral 68 (tiene exactamente 68)", lineaCon(E, "BOS-SANDER"));
    { const { R: R2, E: E2 } = entregaDe({ partes: [parte], criterio: { referencia: ref } });
      ok(R2.criterio && R2.criterio.referencia && !R2.criterio.lente && mismos(universoDe(E2, "p1"), frenados68), "CONTROL NEGATIVO · la referencia SOLA se honra como siempre (mismo universo)", JSON.stringify(R2.criterio)); }
    { const { R: R3, E: E3 } = entregaDe({ partes: [parte], criterio: { lente: "capital" } });
      ok(R3.criterio && R3.criterio.lente === "capital" && !R3.criterio.referencia && !universoDe(E3, "p1").length, "CONTROL NEGATIVO · la lente SOLA no inventa un umbral: sin referencia, «frenado» sigue sin evaluar (universo vacío)", JSON.stringify(R3.criterio)); }
    { const { R: R4 } = entregaDe({ partes: [parte], criterio: { lente: "capital", referencia: { concepto: "inventado", valor: 1, unidad: "days" } } });
      ok(R4.criterio && R4.criterio.lente === "capital" && !R4.criterio.referencia && R4.noResuelto.some((n) => n.campo === "criterio" && n.motivo === "criterio_desconocido"), "CONTROL NEGATIVO · una referencia inválida junto a una lente válida conserva la lente y DECLARA la referencia (nunca la descarta en silencio)", JSON.stringify([R4.criterio, R4.noResuelto.map((n) => n.motivo)])); }
  }

  H("A19 · 41(c) · S42 · la verdad propia de un miembro que falla la BASE es la cifra de la base; la del que el TOP excluido saca sigue siendo su puesto");
  { const margenDe = (n) => clientesMargen.find((c) => c.nombre === n).margen;
    const U = { eje: "cliente", base: "bajo el benchmark", excluir: { top: [{ metrica: "ventas", k: 3 }] } };
    const top3 = clientesVentas.slice().sort((a, b) => b.actual - a.actual).slice(0, 3).map((c) => c.nombre);
    const bench = 30.1;
    const { E } = entregaDe({ partes: [{ id: "p1", tema: "comercial", cierre: "cifra", conceptos: ["margen", "ventas"], universo: U }], premisas: [{ id: "q1", tipo: "grupo", miembros: ["Easy"], universo: U }, { id: "q2", tipo: "grupo", miembros: [top3[2]], universo: U }] });
    const lE = lineaCon(E, "Easy", "no es así"), lJ = lineaCon(E, top3[2], "no es así");
    ok(margenDe("Easy") > bench && !top3.includes("Easy") && top3.length === 3, "oráculo · Easy (margen 32 %) está sobre el benchmark 30.1 % y NO está entre las 3 que más venden: la deja fuera la BASE, no el top", `${margenDe("Easy")} ${top3}`);
    ok(lE && new RegExp(`margen ${String(margenDe("Easy")).replace(".", "\\.")}\\s?%`).test(lE) && !/puesto|venta \$/.test(lE), "la verdad propia de Easy es SU MARGEN (la condición que falla), sin «puesto N de 13 por venta»", lE);
    ok(lJ && /puesto 3 de 13/.test(lJ) && /venta/.test(lJ), `CONTROL NEGATIVO · ${top3[2]} (3.ª en venta: la saca el top excluido) sigue diciendo su venta y su puesto`, lJ);
  }

  H("A19 · 37a · S67 · la verdad propia de un SKU fuera por la bodega PEDIDA (universo = solo la bodega) nombra al SKU y a su bodega propia");
  { const propia = (n) => _bodegaDeSku(n);
    const PEDIDA = _bodegaDeSku("MAK-COMP-AIR");
    const fuera = skus.find((n) => propia(n) !== PEDIDA);
    const U = { eje: "sku", bodega: PEDIDA };
    const { E } = entregaDe({ partes: [{ id: "p1", tema: "inventario", cierre: "cifra", conceptos: ["dias_sin_venta", "capital"], eje: "sku", universo: U }], premisas: [{ id: "q1", tipo: "grupo", miembros: [fuera], universo: U }, { id: "q2", tipo: "grupo", miembros: ["MAK-COMP-AIR"], universo: U }] });
    const l = lineaCon(E, fuera, "no es así");
    ok(PEDIDA && propia(fuera) && propia(fuera) !== PEDIDA, "oráculo · hay un SKU cuya bodega propia no es la pedida", JSON.stringify([fuera, propia(fuera), PEDIDA]));
    ok(l.includes(fuera) && l.includes(propia(fuera)) && l.includes(PEDIDA), "la verdad propia nombra al SKU, su bodega propia y la pedida (antes: «en Antofagasta.»)", l);
    ok(/es correcto/.test(lineaCon(E, "MAK-COMP-AIR", "pertenece")) || /es correcto/.test(lineaCon(E, "MAK-COMP-AIR")), "CONTROL NEGATIVO · un SKU que SÍ es de la bodega pedida sigue siendo miembro (premisa verdadera)", lineaCon(E, "MAK-COMP-AIR"));
  }

  H("A19 · 46(b) · S84 · una `cifra` con entidades de dos ejes se sirve con el productor de cada una, sin cifras equivocadas; la comparación de dos ejes sigue declinando");
  { const ventaSku = skusMargen.find((s) => s.nombre === "SAM-TV55").venta;
    const fmt = (k) => "$" + (k / 1000).toFixed(1) + "M";
    const { R, E } = entregaDe({ partes: [{ id: "p1", tema: "comercial", cierre: "cifra", conceptos: ["ventas"], entidades: [{ nombre: "Lider" }, { nombre: "SAM-TV55", eje: "sku" }] }] });
    const filas = (E.entrega.cifras.filas || []).map((f) => f.valores);
    const vSku = (filas.find((v) => v["Entidad / grupo"] === "SAM-TV55" && /^Venta/.test(v["Métrica"])) || {})["Valor"], vLid = (filas.find((v) => v["Entidad / grupo"] === "Lider" && /^Venta/.test(v["Métrica"])) || {})["Valor"];   /* la venta del cliente la fija otra verdad (D8): aquí solo que exista en moneda */
    ok(R.partes[0].estado === "resuelta" && E.ok === true, "la parte con dos ejes se resuelve y la Entrega compone ok (verificarEntrega no la rechaza)", E.motivo);
    ok(vSku === fmt(ventaSku) && /^\$\d+\.\dM$/.test(vLid || ""), `la venta de cada entidad es la de SU productor: SAM-TV55 ${fmt(ventaSku)} (skusMargen) y Lider en moneda (no 0.8)`, JSON.stringify([vSku, vLid]));
    ok(!/SAM-TV55: venta 0\.8/.test(textoDe(E)) && !filas.some((v) => v["Entidad / grupo"] === "SAM-TV55" && v["Valor"] === "0.8"), "la «Venta diaria (unidades)» (0.8) NO se sirve como «Venta»", textoDe(E).split("\n").filter((l) => /SAM-TV55/.test(l)).join(" | "));
    const r2 = validarEncargo({ version: "encargo/v1", partes: [{ id: "p1", tema: "comercial", cierre: "comparacion", conceptos: ["ventas"], entidades: [{ nombre: "Lider" }, { nombre: "SAM-TV55", eje: "sku" }] }] }, {});
    ok(r2.partes[0].estado === "no_resuelta" && r2.noResuelto.some((n) => n.motivo === "ejes_mezclados"), "CONTROL NEGATIVO · la COMPARACIÓN con entidades de dos ejes sigue declinando por `ejes_mezclados`", JSON.stringify(r2.noResuelto.map((n) => n.motivo)));
    const { E: E3 } = entregaDe({ partes: [{ id: "p1", tema: "comercial", cierre: "cifra", conceptos: ["ventas", "margen"], eje: "sku", entidades: [{ nombre: "SAM-TV55", eje: "sku" }] }] });
    const v3 = (E3.entrega.cifras.filas || []).map((f) => f.valores).find((v) => /^Venta/.test(v["Métrica"])) || {};
    ok(v3["Valor"] === fmt(ventaSku), "la venta de un SKU en una cifra de UN solo eje también es la de skusMargen (la «Venta diaria» nunca pisa a «Ventas»)", JSON.stringify(v3));
  }

  H("A19 · 46(c) · S31 · S16 · la lente pedida gobierna la prioridad de una `decision` sin universo; si no ordena el conjunto se declara; la foto declara lo que no trae");
  { const prio = (E) => lineasR(E).find((l) => /^Prioridad del procedimiento, por /.test(l)) || "";
    const lider = (E, dom) => (lineasR(E).find((l) => l.startsWith(`En ${dom}, quien más pesa es `)) || "").replace(/^En [a-záéíóú]+, quien más pesa es /, "").split(":")[0];
    const com = (extra = {}) => entregaDe({ partes: [{ id: "p1", tema: "comercial", cierre: "decision", conceptos: ["contribucion", "carga"] }], ...extra }).E;
    { const E = com({ criterio: { lente: "contribucion" } }), p = prio(E);
      ok(E.ok && /^Prioridad del procedimiento, por contribución: /.test(p) && p.includes(lider(E, "comercial")) && !/riesgo integrado/.test(p), "lente contribución: «Prioridad del procedimiento, por contribución: <quien más contribución deja sin capturar>»", p);
      ok(!/Con otra lente/.test(textoDe(E)) && !/por riesgo integrado/.test(textoDe(E)), "con la lente pedida ya no dice «por riesgo integrado» ni «con otra lente cambia quién va primero»", lineasR(E).filter((l) => /riesgo integrado|otra lente/.test(l)).join(" | "));
      const primero = (p.match(/^Prioridad del procedimiento, por contribución: ([^,]+),/) || [])[1];
      ok(primero && lineasR(E).filter((l) => / va antes que /.test(l)).every((l) => l.startsWith(`${primero} va antes que `)), "el «va antes que» del riesgo integrado solo se sirve si pone primero a la MISMA cuenta que la lente pedida (nunca la contradice)", lineasR(E).filter((l) => / va antes que /.test(l)).join(" | ")); }
    { const E = com(), p = lineasR(E).find((l) => /^Prioridad del procedimiento, por riesgo integrado/.test(l)) || "";
      ok(E.ok && p && /Con otra lente \(por ejemplo, contribución o ventas\)/.test(p), "CONTROL NEGATIVO · sin criterio: sigue «por riesgo integrado» con la nota de que otra lente cambia quién va primero", p); }
    { const E = com({ criterio: { lente: "riesgo" } }), p = prio(E);
      ok(E.ok && /por riesgo integrado/.test(p), "CONTROL NEGATIVO · la lente «riesgo» explícita sigue siendo riesgo integrado", p); }
    { const E = com({ criterio: { lente: "credito" } }), p = prio(E);
      ok(E.ok && /por riesgo integrado/.test(p) && /El criterio pedido \(exposición de crédito\) no ordena este conjunto/.test(p), "una lente que NO ordena el conjunto (crédito sobre un tema solo comercial) se DECLARA: nunca sustituye en silencio", p); }
    { const E = entregaDe({ partes: [{ id: "p1", tema: "cobranza", cierre: "decision", conceptos: ["saldo_vencido"] }, { id: "p2", tema: "comercial", cierre: "decision", conceptos: ["contribucion"] }], criterio: { lente: "credito" } }).E, p = prio(E);
      ok(E.ok && /^Prioridad del procedimiento, por exposición de crédito: /.test(p) && p.includes(lider(E, "cobranza")), "dos temas con lente crédito: la prioridad es la de cobranza («por exposición de crédito»), con su cifra", p); }
    { const E = com({ criterio: { lente: "contribucion" } });
      const foto = universoDe(E, "p1"), conContrib = new Set(((E.entrega.cifras.filas || []).concat((E.entrega.detalle && E.entrega.detalle.filas) || [])).map((f) => f.valores).filter((v) => /^Contribución$/.test(v["Métrica"])).map((v) => v["Entidad / grupo"]));   /* 49c: la foto es el eje entero: las filas de la cola van al Detalle */
      const limite = (E.entrega.limites || []).map((l) => `${l.titulo} ${l.motivo || ""}`).join(" ");
      const sin = foto.filter((n) => !conContrib.has(n));
      /* §7.3·52(b)/51(b) (consolidación F2): la proyección publica la contribución de las 13 cuentas, así que cada cuenta de la foto TIENE su fila (antes se declaraba «la foto no trae contribución» de las que la boleta no traía: una declaración que el dato contradecía). Lo que ninguna fuente demuestre se sigue NOMBRANDO en un límite, nunca se omite */
      ok(foto.length === clientes.length && sin.length === 0, "oráculo · la foto es el eje ENTERO (49c) y cada cuenta de la foto tiene su fila de Contribución (el dato la publica para todas)", JSON.stringify({ foto, sin }));
      ok(sin.every((n) => limite.includes(n)) && !/la foto no trae contribución/.test(limite), "cada cuenta de la foto sin la cifra de un concepto pedido se NOMBRA en un límite (nunca se omite en silencio) y ningún límite niega una fila que la Entrega imprime", limite); }
    { const E = entregaDe({ partes: [{ id: "p1", tema: "cobranza", cierre: "decision", conceptos: ["saldo_vencido", "dias_vencido"] }] }).E;
      ok(E.ok && !(E.entrega.limites || []).some((l) => /la foto no trae/.test(`${l.titulo}`)), "CONTROL NEGATIVO · una foto que sí trae todos sus conceptos (cobranza) no declara ninguna cuenta sin cifra", JSON.stringify((E.entrega.limites || []).map((l) => l.titulo))); }
  }

  H("A19 · 39(c) · S03 · S04 · la pertenencia a un top sobre un empatado del filo EN CERO dice el cero con su cifra; un empate con valor no cambia");
  {
    const { E } = entregaDe({ partes: [{ id: "p1", tema: "inventario", cierre: "decision", conceptos: ["capital_frenado", "capital"], eje: "sku", universo: { eje: "sku", top: { metrica: "capital_frenado", k: 4 } } }], criterio: { lente: "capital" }, premisas: [{ id: "q1", tipo: "grupo", miembros: ["LG-WASH11KG"], universo: { eje: "sku", top: { metrica: "capital_frenado", k: 4 } } }] });
    const l = lineaCon(E, "LG-WASH11KG", "pertenece");
    ok(E.ok && /empatado con .* en el puesto \d/.test(l), "oráculo · la premisa de pertenencia sobre un empatado del filo declara el empate", l);
    ok(/; no tiene capital inmovilizado crítico \(\$0\)\.$/.test(l), "el empate en CERO dice «no tiene capital inmovilizado crítico ($0)» (39c: un cero por ausencia del conjunto también lleva su cifra)", l);
    const { E: E2 } = entregaDe({ partes: [{ id: "p1", tema: "cobranza", cierre: "cifra", conceptos: ["recuperado", "abonado"], universo: { eje: "cliente", top: { metrica: "recuperado", k: 8 } } }], premisas: [{ id: "q1", tipo: "grupo", miembros: ["Paris"], universo: { eje: "cliente", top: { metrica: "recuperado", k: 8 } } }] });
    const l2 = lineaCon(E2, "Paris", "empatado");
    ok(/Paris: recuperado [\d.]+%, empatado con Tottus en el puesto 8\.$/.test(l2) && !/no tiene/.test(l2), "CONTROL NEGATIVO · un empate en el filo con VALOR (recuperado) no agrega ningún cero", l2);
    { const U = { eje: "sku", top: { metrica: "dias_sin_venta", k: 9 } };
      const { E: E3 } = entregaDe({ partes: [{ id: "p1", tema: "inventario", cierre: "cifra", conceptos: ["dias_sin_venta", "capital"], eje: "sku", universo: U }], premisas: [{ id: "q1", tipo: "grupo", miembros: ["PHI-SHAVER9"], universo: U }] });
      const l3 = lineaCon(E3, "PHI-SHAVER9", "empatado");
      ok(l3 && (l3.match(/no tiene días sin venta/g) || []).length === 1, "CONTROL NEGATIVO · si la oración ya dice el cero de su sujeto («no tiene días sin venta (0 días)») el empate en cero no lo repite", l3); }
  }

  H("A19 · 44(d) · S17 · S18 · S21 · la verdad propia de un conteo falso solo por el «de M» imprime el M más ajustado de la cadena del universo, el mismo de la premisa verdadera");
  { const mesa = buildMesaFlujo(ESCENARIO_INICIAL);
    const alDia = mesa.filas.filter((f) => f.vencidoK === 0).length;
    const conteo = (universo, n, m) => ({ tipo: "conteo", conteo: { n, m }, de: universo });
    const deM = (l) => { const x = /\b(\d+) de (\d+)\b/.exec(l); return x ? { n: +x[1], m: +x[2] } : null; };
    { const U = { eje: "cliente", estados: ["al dia"], top: { metrica: "abonado", k: 3 } };
      const { E } = entregaDe({ partes: [{ id: "p1", tema: "cobranza", cierre: "cifra", conceptos: ["abonado", "recuperado"], universo: U }], premisas: [{ id: "q1", ...conteo(U, 3, alDia) }, { id: "q2", ...conteo(U, 3, alDia - 1) }] });
      const ls = lineasR(E).filter((l) => /premisa planteada/.test(l) && /de mayor abonado/.test(l) && deM(l));
      ok(alDia === 7 && ls.length === 2, "oráculo · 7 cuentas al día (la mesa) y las dos premisas se juzgan", JSON.stringify(ls));
      ok(ls.length === 2 && /es correcto/.test(ls[0]) && /no es así/.test(ls[1]) && deM(ls[0]).m === alDia && deM(ls[1]).m === alDia, `la premisa verdadera y la falsa por M dicen el MISMO M (${alDia}, las al día), no 7 y 13`, JSON.stringify(ls.map(deM))); }
    { const nBase = clientesMargen.filter((c) => c.margen > 30.1).length;
      const U = { eje: "cliente", base: "sobre el benchmark" };
      const { E } = entregaDe({ partes: [{ id: "p1", tema: "comercial", cierre: "cifra", conceptos: ["margen", "contribucion"], universo: U }], premisas: [{ id: "q1", ...conteo(U, nBase, clientes.length) }, { id: "q2", ...conteo(U, nBase, nBase + 3) }] });
      const ls = lineasR(E).filter((l) => /premisa planteada/.test(l) && /sobre el benchmark/.test(l) && deM(l));
      ok(nBase === 5 && ls.length === 2 && /no es así/.test(ls[1]) && deM(ls[1]).m === clientes.length && deM(ls[1]).m !== deM(ls[1]).n, `la falsa por M sobre «sobre el benchmark» dice «${nBase} de ${clientes.length}», nunca el vacuo «${nBase} de ${nBase}»`, JSON.stringify(ls.map(deM))); }
    { const U = { eje: "cliente", estados: ["en mora"], filtros: [{ metrica: "dias_vencido", op: ">", valor: 100 }] };
      const enMora = mesa.filas.filter((f) => f.vencidoK > 0).length, nFiltro = mesa.filas.filter((f) => f.vencidoK > 0 && f.diasVencido > 100).length;
      const { E } = entregaDe({ partes: [{ id: "p1", tema: "cobranza", cierre: "cifra", conceptos: ["dias_vencido", "saldo_vencido"], universo: U }], premisas: [{ id: "q1", ...conteo(U, nFiltro, enMora) }, { id: "q2", ...conteo(U, nFiltro, alDia) }] });
      const ls = lineasR(E).filter((l) => /premisa planteada/.test(l) && /en mora/.test(l) && deM(l));
      ok(ls.length === 2 && /es correcto/.test(ls[0]) && /no es así/.test(ls[1]) && deM(ls[1]).m === enMora, `la falsa por M sobre «en mora con más de 100 días» dice M = ${enMora} (las en mora, antes del filtro), el mismo de la verdadera`, JSON.stringify(ls.map(deM))); }
    { const U = { eje: "cliente", estados: ["al dia"], top: { metrica: "abonado", k: 3 } };
      const { E } = entregaDe({ partes: [{ id: "p1", tema: "cobranza", cierre: "cifra", conceptos: ["abonado"], universo: U }], premisas: [{ id: "q1", ...conteo(U, 3, clientes.length) }] });
      const l = lineasR(E).find((x) => /premisa planteada/.test(x) && deM(x)) || "";
      ok(/es correcto/.test(l) && deM(l).m === clientes.length, "CONTROL NEGATIVO · un M verdadero de la cadena (el eje entero) se imprime tal cual lo planteó la consulta", l); }
  }
}

/* ═══ A20 · §7.3·46(d) · DIAGNÓSTICO v22 (S16 p2) ═════════════════════════════════════════════════════════════════════════════════════════════════════
 * «Una oración nombra SIEMPRE la lente que de verdad ordenó su lista; nunca nombra una lente que no la ordenó.» El defecto: el grupo de inventario decía «por exposición de crédito: BOS-SANDER, con 1.6x en rotación» —la lente de crédito es de cobranza y no ordenó
 * esa lista de SKU—. La lista del grupo la ordena SU clave (la métrica del primer concepto pedido): la oración nombra la LENTE solo si esa clave es la suya, si no nombra la CLAVE con su nombre visible, y si el usuario pidió una lente que no ordena el grupo lo DECLARA.
 * La prioridad CRUZADA entre dominios no cambia (sigue en «riesgo integrado» / en la lente pedida, según A19 · 46(c)).
 * Oráculo: los datos del tenant (la rotación de cada SKU) y una tabla escrita a mano de QUÉ clave es de cada lente; nunca el código que se corrige. */
{
  const lineasDe = (E) => String(E.texto || "").split("\n").map((l) => l.replace(/^▸ /, ""));
  const prioGrupo = (E) => String(E.texto || "").split("\n").find((l) => /Prioridad del procedimiento dentro de este grupo/.test(l)) || "";
  const porDe = (E) => { const m = /Prioridad del procedimiento dentro de este grupo, por ([^:]+): /.exec(prioGrupo(E)); return m ? m[1] : null; };
  const colaDe = (E) => { const m = /Prioridad del procedimiento dentro de este grupo, por [^:]+: (.+)$/.exec(prioGrupo(E)); return m ? m[1] : null; };
  const grupo = (tema, eje, m, lente) => entregaDe({ partes: [{ id: "p1", tema, cierre: "decision", conceptos: [m], universo: { eje, top: { metrica: m, k: 3 } } }], ...(lente ? { criterio: { lente } } : {}) }).E;

  H("A20 · 46(d) · S16 · el grupo de inventario con la lente de crédito dice por cuál se ordena (la rotación) y que la lente pedida no lo ordena; antes nombraba una lente que no lo ordenó");
  { const lentos = skuInventario.filter((s) => s.rotacion < 2).sort((a, b) => a.rotacion - b.rotacion);
    const enc = { partes: [{ id: "p1", tema: "cobranza", cierre: "decision", conceptos: ["dias_vencido", "saldo_vencido"] }, { id: "p2", tema: "inventario", cierre: "decision", conceptos: ["rotacion", "capital"], eje: "sku", universo: { eje: "sku", estados: ["rota lento"] } }], criterio: { lente: "credito" } };
    const { E } = entregaDe(enc), L = prioGrupo(E), cab = lentos[0];
    ok(lentos.length === 3 && cab && cab.rotacion < lentos[1].rotacion, "oráculo · 3 SKU rotan bajo el piso de 2.0x y uno de ellos rota MENOS que los otros (el que pide atención: donde más es mejor, el menor va primero)", JSON.stringify(lentos.map((s) => [s.sku, s.rotacion])));
    ok(E.ok && L.startsWith("▸ Prioridad del procedimiento dentro de este grupo, por rotación (el criterio pedido, exposición de crédito, es de cobranza y no ordena este grupo): "), "la oración del grupo de inventario dice «por rotación» (lo que ordenó la lista) y DECLARA que el criterio pedido, exposición de crédito, es de cobranza y no la ordenó", L);
    ok(L.endsWith(`: ${cab.sku}, con ${cab.rotacion.toFixed(1)}x en rotación.`), "el primero y su cifra son los del que pide atención: el SKU que MENOS rota del grupo, con su rotación (la cifra impresa es la real)", L);
    ok(!/dentro de este grupo, por exposición de crédito/.test(String(E.texto || "")), "la lente de crédito ya no se nombra como la que ordenó la lista de SKU", L);
    ok(lineasDe(E).some((l) => /^Prioridad del procedimiento, por exposición de crédito: /.test(l)), "CONTROL NEGATIVO · la prioridad CRUZADA (la de cobranza, con la lente pedida) sigue intacta: la lente gobierna donde sí ordena", lineasDe(E).filter((l) => /^Prioridad del procedimiento,/.test(l)).join(" | ")); }

  H("A20 · 46(d) · la lente se nombra SOLO si la clave que ordenó el grupo es la suya; si no, se nombra la clave y, si la lente pedida es de otro dominio (o no ordena), se declara");
  { const DUENA = { credito: ["saldo_vencido"], contribucion: ["contribucion"], capital: ["capital"], ventas: ["ventas"] };   /* a mano: qué clave ordena cada lente en su dominio */
    const ROTULO = { saldo_vencido: "saldo vencido", dias_vencido: "días vencido", contribucion: "contribución", margen: "margen", ventas: "venta", capital: "capital", rotacion: "rotación" };   /* a mano: el nombre visible de cada clave */
    const GRUPOS = [["cobranza", "cliente", "saldo_vencido"], ["cobranza", "cliente", "dias_vencido"], ["comercial", "cliente", "contribucion"], ["comercial", "cliente", "margen"], ["comercial", "cliente", "ventas"], ["inventario", "sku", "capital"], ["inventario", "sku", "rotacion"]];
    const malas = [], colaDistinta = [];
    let n = 0, nombradas = 0;
    for (const [tema, eje, m] of GRUPOS) {
      const base = colaDe(grupo(tema, eje, m));
      for (const lente of Object.keys(DUENA)) {
        const E = grupo(tema, eje, m, lente), por = porDe(E), nom = (lente === "ventas" && tema === "cobranza" ? "venta a crédito" : CRITERIOS[lente].nombre), dom = CRITERIOS[lente].dominio;   /* §7.3·52a: en cobranza el único dato de venta es la venta a crédito: «ventas» se dice «venta a crédito» */
        n++;
        const nombrada = por === nom;
        if (nombrada) nombradas++;
        const aplica = dom === tema || (lente === "ventas" && tema !== "inventario");   /* §7.3·47(a) + 48(b): la lente que APLICA al dominio del grupo lo ordena con su medida: se nombra aunque el grupo se haya listado por otra clave; «ventas» no tiene dominio propio y aplica a todo grupo de cuentas que trae su venta (comercial · cobranza), no a SKU de inventario */
        if (!(nombrada === (aplica || DUENA[lente].includes(m)))) malas.push(`${lente}/${tema}:${m} → «${por}»`);   /* nombrada ⇔ la lente aplica al dominio o la clave es la suya */
        if (!nombrada) {
          const esperado = `${ROTULO[m]} (el criterio pedido, ${nom}, ${dom && dom !== tema ? `es de ${dom} y ` : ""}no ordena este grupo)`;
          const declara = dom === tema ? por === ROTULO[m] : por === esperado;   /* mismo dominio con otra clave: solo la clave; otro dominio o sin dominio: la clave y la declaración */
          if (!declara) malas.push(`${lente}/${tema}:${m} declara mal → «${por}»`);
        }
        if (!aplica && colaDe(E) !== base) colaDistinta.push(`${lente}/${tema}:${m}`);   /* la lente que NO aplica no cambia el primero; la que aplica lo decide con su medida (A21) */
      }
    }
    ok(n === 28 && malas.length === 0, `la lente se nombra ⇔ aplica al dominio del grupo (o la clave del grupo es la suya, o es «ventas» sobre cuentas), en ${n} combinaciones lente × grupo (crédito, contribución, capital, ventas × 7 grupos de 3 dominios); si no, dice la clave y declara el criterio pedido`, malas.join(" | "));
    ok(nombradas === 12, "oráculo · de las 28 combinaciones, 12 nombran la lente: las 7 donde la lente aplica a su dominio (crédito × 2 grupos de cobranza · contribución × 3 de comercial · capital × 2 de inventario) y ventas en los 5 grupos de cuentas (comercial × 3 · cobranza × 2); ventas sobre SKU de inventario se declara", String(nombradas));
    ok(colaDistinta.length === 0, "CONTROL NEGATIVO · el primero del grupo y su cifra no dependen de una lente que NO aplica a su dominio: la cola de la oración es idéntica con esa lente y sin ella", colaDistinta.join(" | "));
    const defecto = [];
    for (const [tema, eje, m] of GRUPOS) { const por0 = porDe(grupo(tema, eje, m, undefined)); if (por0 !== ROTULO[m]) defecto.push(`sinlente/${tema}:${m} → «${por0}»`);
      const porR = porDe(grupo(tema, eje, m, "riesgo")), esperadoR = `${ROTULO[m]} (el criterio pedido, riesgo, es el criterio entre dominios y no ordena este grupo)`; if (porR !== esperadoR) defecto.push(`riesgo/${tema}:${m} → «${porR}»`); }
    ok(defecto.length === 0, "CONTROL NEGATIVO · sin lente pedida el grupo nombra la clave que lo ordenó; con «riesgo integrado» PEDIDO por el usuario nombra la clave y DECLARA que ese criterio es el de ENTRE dominios y no ordena un grupo (A22 · 47e: nunca cambia de criterio en silencio)", defecto.join(" | ")); }

  H("A20 · 46(d) · una referencia (umbral, piso) no es una lente: conserva su nombre de la casa; sin clave de orden, nada cambia");
  { const { E } = entregaDe({ partes: [{ id: "p1", tema: "inventario", cierre: "decision", conceptos: ["dias_sin_venta", "capital"], eje: "sku", universo: { eje: "sku", estados: ["frenado"] } }], criterio: { referencia: { concepto: "umbral_frenado", valor: 45, unidad: "days" } } });
    ok(E.ok && !/dentro de este grupo, por umbral de venta frenada: /.test(prioGrupo(E)) && /dentro de este grupo, por [^:(]+ \(la referencia pedida, umbral de venta frenada, no ordena este grupo\): /.test(prioGrupo(E)), "CONTROL NEGATIVO · un criterio que es una REFERENCIA se nombra como referencia (§7.3·52e: «por <la medida que ordenó> (la referencia pedida, umbral de venta frenada, no ordena este grupo)»), nunca como el criterio", prioGrupo(E)); }
}

/* ═══ A21 · DIAGNÓSTICO v23 (medición ciega v23, catálogo sellado v23; §7.3·47) ═══════════════════════════════════════════════════════════════════════════════════
 * Seis raíces de ADI, cada una con su oráculo INDEPENDIENTE del código que corrige (la mesa de flujo, el dato del tenant, la tabla de Cifras ya servida) y su CARNADA (el defecto reconstruido a mano tiene que caer):
 *   (a) R01 · un top cuyo filo cae dentro de un empate sirve a TODOS los empatados CON FILA: lo declarado es lo servido (no «sirve 6» con filas de 3).
 *   (b) R18 · la foto de un eje explícito (marca) declara la cuenta que no trae la cifra pedida, como ya lo hacían cliente y sku (46e) — y con su «N de M».
 *   (c) R40 · R45 · la referencia de la consulta se declara en el EJE del universo que la pone en juego (familia · marca), no en clientes.
 *   (d) R48 · R72 · R100 · la lente pedida que APLICA al dominio del grupo lo ordena con SU medida (la exposición de crédito = el saldo vencido; el capital = el capital inmovilizado crítico), no con la clave con que se listó.
 *   (e) R72.p1 · R65 · si esa medida no distingue a nadie (vale cero o el grupo no la trae) se DECLARA, sin coronar a la primera de la lista; y un grupo en cero no tumba la Entrega (R65: «e16 = $0 es cero»).
 * Oráculo: `buildMesaFlujo` (el flujo de cobranza), `skuInventario`/`marcasMargen`/`clientesMargen` (el dato del tenant) y las filas de la tabla de Cifras; nunca el código que se corrige. */
{
  const Mflujo = buildMesaFlujo(ESCENARIO_INICIAL).filas;
  const filasCifras = (E) => ((E.entrega && E.entrega.cifras && E.entrega.cifras.filas) || []);
  const enTabla = (E) => [...new Set(filasCifras(E).map((f) => f.valores["Entidad / grupo"]))];
  const prioGrupo2 = (E) => String(E.texto || "").split("\n").filter((l) => /Prioridad del procedimiento dentro de este grupo/.test(l)).map((l) => l.replace(/^▸ /, ""));
  const limitesTxt = (E) => ((E.entrega && E.entrega.limites) || []).map((l) => `${l.titulo || ""} ${l.motivo || ""}`);
  const mismosNombres = (a, b) => a.length === b.length && a.every((x) => b.includes(x));
  const conTexto = (E, f) => ({ ...E, texto: f(String(E.texto || "")), entrega: { ...E.entrega, limites: ((E.entrega && E.entrega.limites) || []).map((l) => ({ ...l, titulo: f(l.titulo || ""), motivo: f(l.motivo || "") })) } });

  H("A21 · 44a · R01 · un top con EMPATE en el filo sirve una fila (cifras) por cada empatado: lo declarado ES lo servido");
  { const enc = (k) => ({ partes: [{ id: "p1", tema: "cobranza", cierre: "cifra", conceptos: ["recuperado", "abonado"], universo: { eje: "cliente", top: { metrica: "recuperado", k } } }] });
    const vs = Mflujo.map((f) => f.recuperadoPct).sort((a, b) => b - a), vFilo = vs[2];
    const esperados = Mflujo.filter((f) => f.recuperadoPct >= vFilo).map((f) => f.nombre);
    const { E } = entregaDe(enc(3));
    ok(esperados.length === 6 && vs[1] > vFilo, "oráculo · el puesto 3 por recuperado es un empate de 4 (71.4%): el top 3 sirve 6 (la mesa de flujo)", JSON.stringify(esperados));
    ok(E.ok && mismosNombres(enTabla(E), esperados), "la tabla de Cifras trae una fila por CADA uno de los 6 (Hites, ABC y Unimarc incluidos)", JSON.stringify(enTabla(E)));
    ok(/sirve 6 por el empate del filo/.test(E.texto || "") && filasCifras(E).filter((f) => f.valores["Métrica"] === "Abonado").length === 6, "lo declarado («sirve 6») es lo servido: seis filas de Abonado, tantas como empatados + los del top", String(E.texto).split("\n").find((l) => /empate del filo/.test(l)) || "");
    const E2 = entregaDe(enc(2)).E;
    ok(E2.ok && mismosNombres(enTabla(E2), ["Mercado Libre", "Ripley"]) && !/empate del filo/.test(E2.texto || ""), "CONTROL NEGATIVO · con k=2 el filo (77.8%) no parte ningún empate: se sirven 2, sin declarar empate del filo", JSON.stringify(enTabla(E2)));
    const sirve = (EE) => mismosNombres(enTabla(EE), esperados);
    const carnada = { ...E, entrega: { ...E.entrega, cifras: { ...E.entrega.cifras, filas: filasCifras(E).filter((f) => ["Mercado Libre", "Ripley", "La Polar"].includes(f.valores["Entidad / grupo"])) } } };
    ok(sirve(E) && !sirve(carnada), "CARNADA · el defecto reconstruido (filas solo de 3 con «sirve 6») cae", JSON.stringify(enTabla(carnada))); }

  H("A21 · 46e · R18 · la foto de un eje explícito (marca) declara la cuenta que no trae la cifra pedida, con su «N de M»");
  { const enc = (conceptos) => ({ partes: [{ id: "p1", tema: "comercial", cierre: "decision", conceptos, eje: "marca" }], criterio: { lente: "ventas" } });
    const { E } = entregaDe(enc(["variacion", "ventas"]));
    const filas = filasCifras(E), marcas = enTabla(E);
    const sinVar = marcas.filter((m) => !filas.some((f) => f.valores["Entidad / grupo"] === m && /Variaci[oó]n/.test(f.valores["Métrica"])));
    const dec = limitesTxt(E).filter((t) => /sin dato de variaci[oó]n/i.test(t));   /* parte B (§7.3·52b): la ausencia se dice «sin dato de X para Y», ya no «la foto no trae X de Y» */
    ok(E.ok && marcas.length === 5 && sinVar.length >= 1, "oráculo · la foto por marca trae 5 marcas y al menos una sin la fila de variación (la tabla ya servida)", JSON.stringify({ marcas, sinVar }));
    ok(dec.length === 1 && sinVar.every((m) => dec[0].includes(m)) && marcas.filter((m) => !sinVar.includes(m)).every((m) => !dec[0].includes(m)), "la declaración nombra EXACTAMENTE las marcas que no traen la variación (ni una más, ni una menos)", dec.join(" | "));
    ok(dec.length === 1 && dec[0].includes(`(${sinVar.length} de 5 marcas)`), "y dice cuántas son de cuántas: «(N de 5 marcas)»", dec.join(" | "));
    const E2 = entregaDe(enc(["ventas"])).E;
    ok(E2.ok && limitesTxt(E2).filter((t) => /sin dato de|la foto no trae/i.test(t)).length === 0, "CONTROL NEGATIVO · una foto por marca con la cifra de TODAS las cuentas no declara ninguna falta", limitesTxt(E2).join(" | "));
    const carnada = conTexto(E, (t) => t.replace(/sin dato de/g, "con dato de"));
    const declara = (EE) => limitesTxt(EE).some((t) => /sin dato de variaci[oó]n/i.test(t));
    ok(declara(E) && !declara(carnada), "CARNADA · el defecto reconstruido (la tabla omite la fila y ningún límite lo dice) cae", ""); }

  H("A21 · 19 · R40 · R45 · la referencia de la consulta se declara en el EJE del universo que la pone en juego (marca · familia), no en clientes");
  { const refEn = (eje, metrica, ref, valor, unidad = "pct") => ({ partes: [{ id: "p1", tema: "comercial", cierre: "cifra", conceptos: [metrica === "margen" ? "margen" : "carga", "ventas"], eje, universo: { eje, filtros: [{ metrica, op: metrica === "margen" ? ">" : ">=", ref }] } }], criterio: { referencia: { concepto: ref, valor, unidad } } });
    const dec = (E) => limitesTxt(E).filter((t) => /Con la referencia planteada en la consulta/.test(t)).join(" | ");
    const marcasSobre = marcasMargen.filter((m) => m.margen > 26.3).map((m) => m.nombre);
    const clientesSobre = clientesMargen.filter((c) => c.margen > 26.3).map((c) => c.nombre);
    const M = entregaDe(refEn("marca", "margen", "benchmark", 26.3)).E, C = entregaDe(refEn("cliente", "margen", "benchmark", 26.3)).E;
    ok(M.ok && marcasSobre.length === 2 && new RegExp(`Serían ${marcasSobre.length} marcas sobre esa referencia`).test(dec(M)) && marcasSobre.every((n) => dec(M).includes(n)), "una parte por MARCA cuenta MARCAS con la referencia de la consulta (26.3%): las que el dato deja sobre ese margen", dec(M));
    ok(!clientesMargen.some((c) => dec(M).includes(c.nombre)), "y no nombra ni un cliente (el eje de la parte es marca)", dec(M));
    ok(C.ok && clientesSobre.length >= 5 && new RegExp(`Serían ${clientesSobre.length} cuentas sobre esa referencia`).test(dec(C)) && clientesSobre.every((n) => dec(C).includes(n)), "CONTROL NEGATIVO · una parte por CLIENTE sigue contando cuentas con los nombres de clientes (el eje de la parte ES cliente)", dec(C));
    const F = entregaDe(refEn("familia", "carga", "nivel_carga", 4)).E;
    ok(F.ok && /Serían 2 familias sobre esa referencia \(contra 3 con el nivel declarado de carga\)/.test(dec(F)) && !/cuentas/.test(dec(F)), "una parte por FAMILIA (nivel de carga 4%) cuenta familias: 2 contra las 3 del nivel declarado", dec(F));
    const carnada = conTexto(M, (t) => t.replace(/Serían 2 marcas/g, "Serían 8 cuentas").replace(/Philips, Makita/, "Tottus, Paris, Easy"));
    ok(!/Serían 2 marcas/.test(dec(carnada)) && clientesMargen.some((c) => dec(carnada).includes(c.nombre)), "CARNADA · el defecto reconstruido (clientes en una parte por marca) es lo que el predicado de arriba rechaza", dec(carnada)); }

  H("A21 · 46(d) + ley del owner · R100 · R48 · la lente pedida que APLICA al dominio ordena la prioridad del grupo con SU medida (saldo vencido · capital inmovilizado crítico)");
  { const cob = (lente, estados, top) => entregaDe({ partes: [{ id: "p1", tema: "cobranza", cierre: "decision", conceptos: ["abonado", "saldo_vencido"], universo: { eje: "cliente", estados, top } }], ...(lente ? { criterio: { lente } } : {}) }).E;
    const mora = Mflujo.filter((f) => f.vencidoK > 0), top3 = mora.slice().sort((a, b) => b.abonadoK - a.abonadoK).slice(0, 3);
    const primero = top3.slice().sort((a, b) => b.vencidoK - a.vencidoK)[0];
    const E = cob("credito", ["en mora"], { metrica: "abonado", k: 3 });
    const L = prioGrupo2(E)[0] || "";
    ok(E.ok && top3.length === 3 && primero.nombre !== top3[0].nombre, "oráculo · el top 3 por abonado de los en mora es Falabella, Lider y Tottus; el de mayor saldo vencido (la exposición de crédito) NO es el primero por abonado", JSON.stringify(top3.map((f) => [f.nombre, f.abonadoK, f.vencidoK])));
    ok(L.startsWith(`Prioridad del procedimiento dentro de este grupo, por exposición de crédito: ${primero.nombre}, con `) && L.endsWith(" en saldo vencido."), "con la lente de crédito la prioridad del grupo es la del SALDO VENCIDO (el primero es el de mayor vencido del grupo, con su cifra y su nombre)", L);
    const E0 = cob(null, ["en mora"], { metrica: "abonado", k: 3 }), L0 = prioGrupo2(E0)[0] || "";
    ok(L0.startsWith(`Prioridad del procedimiento dentro de este grupo, por abonado: ${top3[0].nombre}, con `), "CONTROL NEGATIVO · sin lente pedida el grupo nombra la clave que lo ordenó (abonado) y su primero es el de siempre (el abonado es una magnitud: va de mayor a menor)", L0);
    const Ec = cob("capital", ["en mora"], { metrica: "abonado", k: 3 }), Lc = prioGrupo2(Ec)[0] || "";
    ok(/por abonado \(el criterio pedido, capital, es de inventario y no ordena este grupo\): /.test(Lc) && !/ninguna cuenta queda primera/.test(Lc), "CONTROL NEGATIVO · una lente de OTRO dominio (capital sobre cobranza) sigue declarándose «no ordena este grupo» (46d)", Lc);
    const carnada = prioGrupo2(conTexto(E, (t) => t.replace(/por exposición de crédito: [^,]+,/, `por exposición de crédito: ${top3[0].nombre},`)))[0] || "";
    const ordenaPorLente = (l) => l.startsWith(`Prioridad del procedimiento dentro de este grupo, por exposición de crédito: ${primero.nombre}, con `);
    ok(ordenaPorLente(L) && !ordenaPorLente(carnada), "CARNADA · el defecto reconstruido (la lente nombrada pero coronando al primero por abonado) cae", carnada); }
  { const inv = (lente) => entregaDe({ partes: [{ id: "p1", tema: "inventario", cierre: "decision", conceptos: ["dias_sin_venta", "capital_frenado"], eje: "sku", universo: { eje: "sku", estados: ["frenado"] } }], criterio: { ...(lente ? { lente } : {}), referencia: { concepto: "umbral_frenado", valor: 94, unidad: "days" } } }).E;
    const frenados = skuInventario.filter((s) => s.diasSinVenta > 94), cab = frenados.slice().sort((a, b) => b.stockUSD - a.stockUSD)[0];
    const E = inv("capital"), L = prioGrupo2(E)[0] || "";
    ok(E.ok && frenados.length === 1 && cab.sku === "MAK-COMP-AIR", "oráculo · con el umbral de 94 días solo MAK-COMP-AIR (112 días) es frenado; LG-DRYER8KG (94 exactos) queda fuera", JSON.stringify(frenados.map((s) => [s.sku, s.diasSinVenta, s.stockUSD])));
    ok(L.startsWith(`Prioridad del procedimiento dentro de este grupo, por capital: ${cab.sku}, con `) && /en capital inmovilizado crítico\.$/.test(L) && !/por días sin venta/.test(L), "con la lente de capital la prioridad es la del CAPITAL inmovilizado crítico (la medida de la lente), no la de los días sin venta con que se listó el grupo", L);
    const Lr = prioGrupo2(inv(null))[0] || "";
    ok(/por días sin venta \(la referencia pedida, umbral de venta frenada, no ordena este grupo\): /.test(Lr) && !/por umbral de venta frenada: /.test(Lr), "CONTROL NEGATIVO · sin lente (solo la referencia) el grupo nombra la clave que lo ordenó y la referencia como tal (§7.3·52e), nunca la referencia como el criterio", Lr);
    const Lx = prioGrupo2(inv("credito"))[0] || "";
    ok(/el criterio pedido, exposición de crédito, es de cobranza y no ordena este grupo/.test(Lx), "CONTROL NEGATIVO · la lente de crédito sobre inventario sigue declarándose «no ordena este grupo»", Lx); }

  H("A21 · 46(d) · R72.p1 · R65 · si la medida de la lente no distingue a nadie se DECLARA, sin coronar a la primera de la lista; un grupo en cero compone igual");
  { const E = entregaDe({ partes: [{ id: "p1", tema: "cobranza", cierre: "decision", conceptos: ["saldo_vencido", "recuperado"], universo: { eje: "cliente", estados: ["al dia"] } }], criterio: { lente: "credito" } }).E;
    const alDia = Mflujo.filter((f) => f.vencidoK === 0).map((f) => f.nombre), L = prioGrupo2(E)[0] || "";
    ok(alDia.length === 7, "oráculo · 7 cuentas al día: todas con saldo vencido en cero (la mesa de flujo)", JSON.stringify(alDia));
    ok(E.ok === true, "la Entrega COMPONE (antes «sin-evidencia: e16 = $0 es cero» tumbaba la Entrega entera: el usuario no recibía nada)", String(E.motivo));
    ok(/^Prioridad del procedimiento dentro de este grupo, por exposición de crédito: ninguna cuenta queda primera, porque el grupo \(.*\) no tiene saldo vencido \(\$0\)\.$/.test(L) && alDia.every((n) => L.includes(n)), "la prioridad DECLARA que la lente no distingue a nadie (todas en $0), nombra a las cuentas del grupo y no corona a ninguna", L);
    ok(!/exposición de crédito: [^n][^,]*, con /.test(L), "no dice «por exposición de crédito: <cuenta>, con $0»: ninguna cuenta es primera", L);
    const enMora = entregaDe({ partes: [{ id: "p1", tema: "cobranza", cierre: "decision", conceptos: ["saldo_vencido", "recuperado"], universo: { eje: "cliente", estados: ["en mora"] } }], criterio: { lente: "credito" } }).E, Lm = prioGrupo2(enMora)[0] || "";
    const cabMora = Mflujo.filter((f) => f.vencidoK > 0).sort((a, b) => b.vencidoK - a.vencidoK)[0];
    ok(enMora.ok && Lm.startsWith(`Prioridad del procedimiento dentro de este grupo, por exposición de crédito: ${cabMora.nombre}, con `), "CONTROL NEGATIVO · el mismo encargo sobre las cuentas EN MORA sí corona a la de mayor saldo vencido (Lider)", Lm);
    const carnada = `Prioridad del procedimiento dentro de este grupo, por exposición de crédito: ${alDia[0]}, con $0 en saldo vencido.`;
    const declaraSinPrimero = (l) => /ninguna cuenta queda primera/.test(l);
    ok(declaraSinPrimero(L) && !declaraSinPrimero(carnada), "CARNADA · el defecto reconstruido (coronar a Jumbo con $0) cae", carnada); }
  { const E = entregaDe({ partes: [{ id: "p1", tema: "inventario", cierre: "decision", conceptos: ["dias_inventario", "capital"], eje: "sku", universo: { eje: "sku", estados: ["riesgo de quiebre"] } }], criterio: { lente: "capital" } }).E;
    const L = prioGrupo2(E)[0] || "", skus = ((E.entrega.universos || []).find((u) => u.id === "p1") || {}).entidades || [];
    ok(E.ok && skus.length === 3 && skus.every((s) => (skuInventario.find((x) => x.sku === s) || {}).alerta !== "crit"), "oráculo · los 3 SKU en riesgo de quiebre no son inmovilizados críticos (el dato: ninguno en alerta crítica)", JSON.stringify(skus));
    ok(/^Prioridad del procedimiento dentro de este grupo, por capital: ninguna cuenta queda primera, porque el grupo \(.*\) no trae capital inmovilizado crítico/.test(L) && skus.every((s) => L.includes(s)), "la lente de capital, cuya medida (capital inmovilizado crítico) no trae ningún SKU del grupo, se declara sin primero (antes: «por días de inventario: PHI-HAIR-PRO» sin avisar)", L);
    ok(!/por días de inventario/.test(String(E.texto || "").split("\n").filter((l) => /Prioridad del procedimiento dentro de este grupo/.test(l)).join(" ")), "la oración de prioridad del grupo ya no cambia de criterio en silencio (no nombra los días de inventario como la que ordena)", L);
    const carnada = "Prioridad del procedimiento dentro de este grupo, por días de inventario: PHI-HAIR-PRO, con 19 días en días de inventario.";
    ok(/ninguna cuenta queda primera/.test(L) && !/ninguna cuenta queda primera/.test(carnada), "CARNADA · el defecto reconstruido (corona por otra clave sin avisar) cae", carnada); }
}

/* ═══ A22 · DIAGNÓSTICO v24 (medición ciega v24, catálogo sellado v24; §7.3·48) ═══════════════════════════════════════════════════════════════════════════════════
 * Las raíces de ADI que dejó la v24 y las FAMILIAS que las contienen (barrido por combinación, construido a mano: no son los casos del catálogo). Oráculos INDEPENDIENTES del código que se corrige: la mesa de flujo
 * (`buildMesaFlujo`), el dato del tenant (`skuInventario`, `clientesMargen`) y el productor comercial; nunca la Entrega ni el Notario.
 *   (i)  EL EMPATE EN EL FILO (Q05 · Q08): un top cuyo filo cae dentro de un empate sirve a TODOS los empatados, lo declarado ES lo servido, cada servido tiene fila (también los ceros: medidos o por ausencia), el empate dice su puesto,
 *        sus nombres y, en cero, su cifra; la pertenencia del empatado es verdadera y declara el empate con su cifra. Por cobranza (saldo · días · abonado · recuperado), inventario (SKU · bodega), comercial (unidades).
 *   (ii) LA LENTE × EL DOMINIO (Q44 · Q45 · Q70): la oración de prioridad de un grupo nombra la lente que de verdad ordenó o DECLARA que la lente pedida no ordena y nombra la medida que ordenó; la que aplica ordena con SU medida.
 *   (iii) COMPOSER ↔ VERIFICADOR (Q100): toda oración que agregan las decisiones 42 a 48 pasa `verificarEntrega` en cada combinación de la matriz.
 *   (iv) EL «DE M» DE UN CONTEO (Q63): cualquier eslabón de la cadena del universo (eje → base/bodega → estados → filtros → top → excluir) es un «de M» admisible y la verdad de un conteo falso por su M imprime el más ajustado.
 *   + la presentación: una definición comercial sola no cita benchmark (Q09) y la cola de la foto («8 de 13») se declara también en «breve» (Q13). */
{
  const Mflujo = buildMesaFlujo(ESCENARIO_INICIAL).filas;
  const filasCifras = (E) => ((E.entrega && E.entrega.cifras && E.entrega.cifras.filas) || []);
  const filasDetalle = (E) => ((E.entrega && E.entrega.detalle && E.entrega.detalle.filas) || []);
  const sujetosDe = (E) => new Set([...filasCifras(E), ...filasDetalle(E)].map((f) => f.valores["Entidad / grupo"]));
  const universoDe = (E, id) => (((E.entrega && E.entrega.universos) || []).find((u) => u.id === id && u.soloRanking !== true) || {}).entidades || [];
  const sinTablas = (E) => String(E.texto || "").split("\n").filter((l) => !/^\|/.test(l)).join("\n");
  const premisaTxt = (E, pid) => ((E.entrega && E.entrega.respuesta) || []).filter((r) => r._premisa === true && Array.isArray(r.hechos) && r.hechos.map(String).includes(String(pid))).map((r) => r.texto).join(" | ");
  const verifica = (E, R, prof = "completa") => { try { return verificarEntrega({ texto: E.texto, entrega: E.entrega, profundidad: prof, resolucion: R, indice: (E.entrega.procedencia && E.entrega.procedencia.libro && E.entrega.procedencia.libro.indice) || null }); } catch (x) { return { ok: false, violaciones: [{ regla: "excepcion", detalle: String(x && x.message) }] }; } };
  const mismosNombres = (a, b) => a.length === b.length && a.every((x) => b.includes(x));
  const conTexto = (E, f) => ({ ...E, texto: f(String(E.texto || "")) });

  /* el top k de un conjunto de (nombre, valor) con el empate del filo: servidos = los k primeros + todos los que valen lo que el k-ésimo; puesto = el compartido (1 + los estrictamente mejores) */
  const topDe = (vals, k, dir) => { const ord = vals.slice().sort((a, b) => (dir === "menor" ? a.v - b.v : b.v - a.v)); const vF = ord[Math.min(k, ord.length) - 1].v; const servidos = ord.filter((x, i) => i < k || x.v === vF).map((x) => x.n); const empatados = ord.filter((x) => x.v === vF).map((x) => x.n); return { ord: ord.map((x) => x.n), servidos, empatados, filo: vF, puesto: 1 + ord.filter((x) => (dir === "menor" ? x.v < vF : x.v > vF)).length, hay: servidos.length > k }; };

  /* ─ (i) Q08 · cobranza: el empate del filo en CERO (las cuentas al día) se sirve entero, con su fila ─ */
  H("A22 · 44a · Q08 · un top por saldo vencido cuyo filo cae en el empate en cero sirve a las 13 cuentas y cada una lleva su fila: lo declarado («sirve 13») ES lo servido");
  { const enc = (k) => ({ partes: [{ id: "p1", tema: "cobranza", cierre: "decision", conceptos: ["saldo_vencido", "dias_vencido"], universo: { eje: "cliente", top: { metrica: "saldo_vencido", k } } }], criterio: { lente: "credito" }, premisas: [{ id: "q1", tipo: "orden", sujeto: "Jumbo", metrica: "saldo_vencido", orden: { forma: "topk", k }, universo: { eje: "cliente" } }] });
    const T = topDe(Mflujo.map((f) => ({ n: f.nombre, v: f.vencidoK })), 8, "mayor");
    const { R, E } = entregaDe(enc(8)); const sirven = sujetosDe(E), txt = sinTablas(E);
    ok(T.servidos.length === 13 && T.empatados.length === 7 && T.puesto === 7, "oráculo · el puesto 8 por saldo vencido es el empate en cero de las 7 cuentas al día (puesto compartido 7): el top 8 sirve las 13 (la mesa de flujo)", JSON.stringify({ servidos: T.servidos.length, empatados: T.empatados, puesto: T.puesto }));
    ok(E.ok && mismosNombres(universoDe(E, "p1"), T.servidos), "el universo servido por la parte son las 13 cuentas", JSON.stringify(universoDe(E, "p1")));
    ok(T.servidos.every((n) => sirven.has(n)), "cada una de las 13 tiene fila (Cifras o Detalle): las 7 sanas también, con su «Saldo vencido $0»", JSON.stringify(T.servidos.filter((n) => !sirven.has(n))));
    ok(T.empatados.every((n) => filasCifras(E).concat(filasDetalle(E)).some((f) => f.valores["Entidad / grupo"] === n && /Saldo vencido/.test(f.valores["Métrica"]) && f.valores["Valor"] === "$0")), "la fila de cada sana es la de la métrica que ordena y dice su cifra en cero («$0»), nunca una celda vacía ni «sin procedencia»", "");
    ok(/sirve 13 por el empate del filo \(Jumbo, Mercado Libre, Ripley, La Polar, Hites, ABC y Unimarc empatan en el puesto 7(?:; no tienen [^)]*\([^)]*\))?\)/.test(txt), "la oración del top declara «sirve 13 por el empate del filo» con los 7 empatados y el puesto compartido", txt.split("\n").find((l) => /empate del filo/.test(l)) || "");
    ok(/Jumbo: no tiene saldo vencido \(\$0\), empatado con Mercado Libre, Ripley, La Polar, Hites, ABC y Unimarc en el puesto 7/.test(premisaTxt(E, "q1")), "la premisa de pertenencia del empatado es verdadera, dice su cero con su cifra y declara el empate", premisaTxt(E, "q1"));
    ok(verifica(E, R).ok === true, "la Entrega pasa `verificarEntrega`", JSON.stringify(verifica(E, R).violaciones));
    const E6 = entregaDe(enc(6)).E;
    ok(E6.ok && mismosNombres(universoDe(E6, "p1"), Mflujo.filter((f) => f.vencidoK > 0).map((f) => f.nombre)) && !/por el empate del filo/.test(sinTablas(E6)), "CONTROL NEGATIVO · con k=6 el filo (Easy) no parte ningún empate: se sirven las 6 en mora, sin declarar empate del filo", JSON.stringify(universoDe(E6, "p1")));
    const sinSanas = { ...E, entrega: { ...E.entrega, cifras: { ...E.entrega.cifras, filas: filasCifras(E).filter((f) => !T.empatados.includes(f.valores["Entidad / grupo"])) }, detalle: { ...E.entrega.detalle, filas: [] } } };
    ok(!T.servidos.every((n) => sujetosDe(sinSanas).has(n)) && T.servidos.every((n) => sirven.has(n)), "CARNADA · el defecto reconstruido (declarar «sirve 13» y traer solo las 6 en mora) es lo que el predicado rechaza", JSON.stringify([...sujetosDe(sinSanas)])); }

  /* ─ (i) Q05 · la pertenencia de un empatado del filo en cero dice el empate, el puesto y su cifra ─ */
  H("A22 · 44a + 46f · Q05 · «Santiago está entre las 3 bodegas de mayor capital inmovilizado crítico» (empata en $0 con Concepción): verdadera, dice el empate, el puesto compartido y su cero con su cifra");
  { const cap = (b) => skuInventario.filter((s) => s.bodega === b && s.rotacion < 2).reduce((a, s) => a + s.stockUSD, 0);
    const bodegas = [...new Set(skuInventario.map((s) => s.bodega))];
    const T = topDe(bodegas.map((b) => ({ n: b, v: cap(b) })), 3, "mayor");
    const enc = (sujeto) => ({ partes: [{ id: "p1", tema: "inventario", cierre: "cifra", conceptos: ["capital_frenado", "capital"], eje: "bodega", universo: { eje: "bodega", top: { metrica: "capital_frenado", k: 3 } } }], premisas: [{ id: "q1", tipo: "orden", sujeto, metrica: "capital_frenado", orden: { forma: "topk", k: 3 }, universo: { eje: "bodega" } }] });
    const { R, E } = entregaDe(enc("Santiago")); const p = premisaTxt(E, "q1");
    ok(T.servidos.length === 4 && mismosNombres(T.empatados, ["Santiago", "Concepción"]) && T.filo === 0 && T.puesto === 3, "oráculo · el puesto 3 por capital inmovilizado crítico es el empate en cero de Santiago y Concepción (los SKU bajo el piso de rotación están en Valparaíso y Antofagasta)", JSON.stringify(T));
    ok(/^Sobre la premisa planteada en la consulta: es correcto — Santiago: no tiene capital inmovilizado crítico \(\$0\), empatado con Concepción en el puesto 3\.$/.test(p), "la premisa es VERDADERA y dice el empate con Concepción, el puesto 3 compartido y el cero de Santiago en palabras de negocio con su cifra («$0»), no la traza «Santiago (0)»", p);
    ok(T.servidos.every((n) => sujetosDe(E).has(n)) && filasCifras(E).filter((f) => /Capital inmovilizado crítico/.test(f.valores["Métrica"]) && f.valores["Valor"] === "$0").length === 2, "las 4 bodegas tienen fila; Santiago y Concepción con su «Capital inmovilizado crítico $0» (la cifra de un cero por ausencia, declarada y verificada por el libro)", JSON.stringify(filasCifras(E).map((f) => `${f.valores["Entidad / grupo"]}:${f.valores["Métrica"]}:${f.valores["Valor"]}`)));
    ok(verifica(E, R).ok === true, "la Entrega pasa `verificarEntrega` (el «$0» de Santiago no se le atribuye a Concepción)", JSON.stringify(verifica(E, R).violaciones));
    const pv = premisaTxt(entregaDe(enc("Valparaíso")).E, "q1");
    ok(/es correcto/.test(pv) && !/empat/.test(pv), "CONTROL NEGATIVO · la pertenencia de una bodega que NO está en el filo (Valparaíso) no declara ningún empate", pv);
    const carnada = p.replace(/: no tiene capital inmovilizado crítico \(\$0\), empatado con Concepción en el puesto 3/, ": Valparaíso ($25K) · Antofagasta ($8K) · Santiago (0)");
    const dice = (t) => /empatado con Concepción en el puesto 3/.test(t) && /\(\$0\)/.test(t);
    ok(dice(p) && !dice(carnada), "CARNADA · el defecto reconstruido (la traza del ranking sin el empate ni la cifra del cero) cae", carnada); }

  /* ─ (iv) Q63 · el «de M» de un conteo falso es el eslabón más ajustado de la cadena ─ */
  H("A22 · 46c · Q63 · «4 de 12 en los 5 de más venta sin SAM-TV55» es falsa solo por el M: imprime «4 de 5» (el eslabón más ajustado de la cadena 13 → 5 → 4), no «4 de 13»");
  { const U = { eje: "sku", top: { metrica: "ventas", k: 5 }, excluir: { entidades: ["SAM-TV55"] } };
    const conteo = (m, n = 4) => { const { E } = entregaDe({ partes: [{ id: "p1", tema: "comercial", cierre: "cifra", conceptos: ["ventas"], eje: "sku", entidades: [{ nombre: "LG-WASH11KG", eje: "sku" }] }], premisas: [{ id: "q1", tipo: "conteo", conteo: { n, m }, de: U }] }); return premisaTxt(E, "q1"); };
    ok(/no es así — 4 de 5 en los 5 de mayor venta fuera de SAM-TV55/.test(conteo(12)), "el «de M» falso (12) imprime el eslabón MÁS AJUSTADO de la cadena (5, el top antes de la exclusión)", conteo(12));
    ok(/es correcto — 4 de 5 en /.test(conteo(5)) && /es correcto — 4 de 13 en /.test(conteo(13)), "CONTROL NEGATIVO · los dos eslabones (5: el top; 13: el eje) son «de M» admisibles: verdaderos y se imprimen tal cual", `${conteo(5)} || ${conteo(13)}`);
    const carnada = conteo(12).replace("4 de 5 en", "4 de 13 en");
    ok(/4 de 5 en /.test(conteo(12)) && !/4 de 5 en /.test(carnada), "CARNADA · el defecto reconstruido (el eslabón más suelto, «4 de 13») cae", carnada); }

  /* ─ (iii) Q100 · la oración «ninguna cuenta queda primera» pasa `verificarEntrega` ─ */
  H("A22 · 47a + coherencia composer↔verificador · Q100 · la declaración «ninguna cuenta queda primera» (la lente no trae su medida) es una oración válida para el verificador aunque no lleve cifra");
  { const { R, E } = entregaDe({ partes: [{ id: "p1", tema: "inventario", cierre: "decision", conceptos: ["dias_inventario", "capital"], eje: "sku", universo: { eje: "sku", estados: ["riesgo de quiebre"], top: { metrica: "ventas", k: 2 } } }], criterio: { lente: "capital" } });
    const ninguna = (E.entrega.respuesta || []).filter((r) => /ninguna cuenta queda primera/.test(r.texto || ""));
    ok(E.ok && ninguna.length === 1 && ninguna[0]._sinPrimero === true && verifica(E, R).ok === true, "oráculo · la oración «por capital: ninguna cuenta queda primera, porque el grupo … no trae capital inmovilizado crítico» viaja marcada (`_sinPrimero`) y la Entrega pasa `verificarEntrega`", JSON.stringify(ninguna));
    /* el caso que rechazaba el verificador (Q100): la cola de la oración sin ninguna cifra (la lista se ordenó por una clave de la que la boleta no trae el valor) */
    const pela = (t) => String(t).replace(/ \((?:\$[\d.,]+[MK]?|[\d.,]+(?:x|d)?)\)/g, "");
    const sinCifras = (marca) => { const r2 = E.entrega.respuesta.map((r) => (/ninguna cuenta queda primera/.test(r.texto || "") ? { ...r, texto: pela(r.texto), ...(marca ? {} : { _sinPrimero: undefined }) } : r)); return { ...E, texto: pela(E.texto), entrega: { ...E.entrega, respuesta: r2 } }; };
    const pelada = ninguna[0] && pela(ninguna[0].texto);
    ok(pelada && pelada !== ninguna[0].texto && !/\$|%|\b\d+(?:[.,]\d+)?\s*(?:d\b|días|x\b)/.test(pelada), "oráculo · la oración sin la cifra de la lista ya no trae ninguna cifra (el caso de Q100)", pelada || "");
    ok(verifica(sinCifras(true), R).ok === true, "la oración marcada pasa `verificarEntrega` aunque no lleve cifra (antes: «oracion-hecho: respuesta no trae ninguna cifra»)", JSON.stringify(verifica(sinCifras(true), R).violaciones));
    ok(verifica(sinCifras(false), R).ok === false && verifica(sinCifras(false), R).violaciones.some((x) => x.regla === "oracion-hecho"), "CARNADA · la misma oración SIN la marca estructural sigue rechazada por la regla de oración-hecho: la excepción no es general", JSON.stringify(verifica(sinCifras(false), R).violaciones));
    const { E: E2, R: R2 } = entregaDe({ partes: [{ id: "p1", tema: "cobranza", cierre: "cifra", conceptos: ["abonado"], entidades: [{ nombre: "Jumbo" }] }] });
    ok(verifica(E2, R2).ok === true, "CONTROL NEGATIVO · una cifra sin declaraciones negativas pasa igual", JSON.stringify(verifica(E2, R2).violaciones)); }

  /* ─ presentación · Q09 y Q13 ─ */
  H("A22 · 44b · Q09 · una definición comercial SOLA no es un Marco comercial: junto a una parte de inventario el Marco no cita el benchmark ni el año cerrado");
  { const enc = (extra) => ({ partes: [{ id: "p1", tema: "comercial", cierre: "definicion", concepto: "resultado" }, extra] });
    const inv = { id: "p2", tema: "inventario", cierre: "cifra", conceptos: ["capital"], eje: "sku", entidades: [{ nombre: "SAM-TV55", eje: "sku" }] };
    const { E } = entregaDe(enc(inv));
    ok(E.ok && !/enchmark de margen/.test(E.texto || "") && !/año cerrado/.test(E.texto || ""), "el Marco de «definición comercial + cifra de inventario» no cita el benchmark de margen ni el período del año cerrado", String(E.texto).split("\n").find((l) => /^\*\*Marco/.test(l)) || "");
    const com = { id: "p2", tema: "comercial", cierre: "cifra", conceptos: ["margen"], eje: "sku", entidades: [{ nombre: "SAM-TV55", eje: "sku" }] };
    ok(/enchmark de margen: 30\.1%/.test(entregaDe(enc(com)).E.texto || ""), "CONTROL NEGATIVO · con una cifra comercial (no una definición) el Marco SÍ cita el benchmark con que se juzga el margen (43e)", ""); }
  H("A22 · 45a · Q13 · la foto de cobranza en «breve» declara su cola («8 de 13 cuentas»): el tope de tamaño no la retira");
  { const enc = (profundidad) => ({ partes: [{ id: "p1", tema: "cobranza", cierre: "lectura", conceptos: ["abonado", "recuperado"] }], profundidad });
    for (const prof of ["breve", "completa"]) { const { E } = entregaDe(enc(prof)); ok(E.ok && /la foto de cobranza \(8 de 13 cuentas\)/.test(sinTablas(E)), `la Entrega en «${prof}» declara «la foto de cobranza (8 de 13 cuentas)»`, sinTablas(E).split("\n").filter((l) => /foto de cobranza/.test(l)).join(" | ")); } }

  /* ─ (ii) LA LENTE × EL DOMINIO ─ */
  H("A22 · 46d + 47 · Q44 · Q45 · Q70 · el «riesgo integrado» PEDIDO sobre un grupo se declara (es el criterio entre dominios); «ventas» ordena un grupo de cuentas que trae su venta; «crecimiento» se declara; nada cambia de criterio en silencio");
  { const grupo = (tema, conceptos, eje, universo, lente) => entregaDe({ partes: [{ id: "p1", tema, cierre: "decision", conceptos, eje, universo: { eje, ...universo } }], ...(lente ? { criterio: { lente } } : {}) });
    const prio = (E) => (String(E.texto || "").split("\n").find((l) => /Prioridad del procedimiento dentro de este grupo/.test(l)) || "").replace(/^▸ /, "");
    const inv = (l) => prio(grupo("inventario", ["rotacion", "capital"], "sku", { estados: ["rota lento"] }, l).E);
    const peorRot = skuInventario.filter((s) => s.rotacion < 2).sort((a, b) => a.rotacion - b.rotacion)[0];   /* §7.3·50a: el que pide atención es el de MENOR rotación (más es mejor) */
    ok(inv("riesgo") === `Prioridad del procedimiento dentro de este grupo, por rotación (el criterio pedido, riesgo, es el criterio entre dominios y no ordena este grupo): ${peorRot.sku}, con ${peorRot.rotacion.toFixed(1)}x en rotación.`, "Q44 · el riesgo integrado PEDIDO sobre un grupo de inventario dice por cuál se ordenó (la rotación) y que ese criterio es el de ENTRE dominios (antes no declaraba nada)", inv("riesgo"));
    ok(inv(null) === `Prioridad del procedimiento dentro de este grupo, por rotación: ${peorRot.sku}, con ${peorRot.rotacion.toFixed(1)}x en rotación.`, "CONTROL NEGATIVO · sin lente pedida (el criterio por defecto de ADI) no declara ningún criterio pedido", inv(null));
    ok(/\(el criterio pedido, crecimiento, no ordena este grupo\)/.test(prio(grupo("comercial", ["margen", "ventas"], "sku", { filtros: [{ metrica: "margen", op: ">=", ref: "benchmark" }] }, "crecimiento").E)), "Q45 · «crecimiento» no fija dirección: se declara que no ordena el grupo y se nombra la medida que lo ordenó", prio(grupo("comercial", ["margen", "ventas"], "sku", { filtros: [{ metrica: "margen", op: ">=", ref: "benchmark" }] }, "crecimiento").E));
    const cob = grupo("cobranza", ["abonado", "recuperado"], "cliente", { estados: ["al dia"], top: { metrica: "abonado", k: 2 } }, "ventas").E;
    const venta = (n) => Mflujo.find((f) => f.nombre === n).ventaK;
    const servidos = universoDe(cob, "p1"), primeroEsp = servidos.slice().sort((a, b) => venta(b) - venta(a))[0];
    ok(new RegExp(`^Prioridad del procedimiento dentro de este grupo, por venta a crédito: ${primeroEsp}, con \\$[\\d.]+M en venta a crédito\\.$`).test(prio(cob)), "Q70 · «ventas» ordena el grupo de cobranza con SU medida (la venta a crédito, la venta del flujo: §7.3·52a, «por venta a crédito», nunca «ventas» a secas; con el rótulo del léxico «venta a crédito», §7.3·49f): el primero es el de mayor venta del grupo (la mesa de flujo)", `${primeroEsp} :: ${prio(cob)}`);
    const com = grupo("comercial", ["contribucion", "margen"], "cliente", { base: "sobre el benchmark", top: { metrica: "contribucion", k: 2 } }, "ventas").E;
    ok(/^Prioridad del procedimiento dentro de este grupo, por ventas: [^,]+, con \$[\d.]+M en venta\.$/.test(prio(com)), "Q70 · también un grupo COMERCIAL (la lee aunque los conceptos pedidos no la incluyan)", prio(com));
    ok(/\(el criterio pedido, ventas, no ordena este grupo\)/.test(prio(grupo("inventario", ["rotacion", "capital"], "sku", { estados: ["rota lento"] }, "ventas").E)), "CONTROL NEGATIVO · «ventas» sobre SKU de inventario se declara (la venta comercial y el inventario son universos que no reconcilian)", inv("ventas"));
    const cap = grupo("inventario", ["rotacion", "capital"], "sku", { estados: ["rota lento"] }, "capital").E;
    const cf = (n) => { const s = skuInventario.find((x) => x.sku === n); return s.rotacion < 2 ? s.stockUSD : 0; };
    const servCap = universoDe(cap, "p1"), primCap = servCap.slice().sort((a, b) => cf(b) - cf(a))[0];
    ok(new RegExp(`^Prioridad del procedimiento dentro de este grupo, por capital: ${primCap}, con \\$[\\d.]+K en capital inmovilizado crítico\\.$`).test(prio(cap)), "la lente «capital» ordena con el capital inmovilizado crítico aunque el grupo se pidió por rotación (no con el capital total): el primero es el de mayor capital crítico del grupo", `${primCap} :: ${prio(cap)}`);
    const sinCrit = grupo("inventario", ["rotacion", "capital"], "sku", { estados: ["riesgo de quiebre"] }, "capital").E;
    ok(/por capital: ninguna cuenta queda primera, porque el grupo \(.*\) no trae capital inmovilizado crítico/.test(prio(sinCrit)), "un grupo sin capital inmovilizado crítico se declara «ninguna cuenta queda primera» (no corona a la primera de la lista)", prio(sinCrit));
    const invSin = (l) => { const { E } = entregaDe({ partes: [{ id: "p1", tema: "inventario", cierre: "decision", conceptos: ["rotacion", "capital"], eje: "sku" }], ...(l ? { criterio: { lente: l } } : {}) }); return String(E.texto || "").split("\n").filter((x) => /^▸/.test(x)).join("\n"); };
    ok(/Prioridad del procedimiento, por capital: LG-DRYER8KG, con \$14K en capital inmovilizado crítico\./.test(invSin("capital")) && /El criterio pedido \(exposición de crédito\) no ordena este conjunto/.test(invSin("credito")) && !/El criterio pedido/.test(invSin(null)), "un conjunto de inventario SIN prioridad cruzada también respeta el criterio del usuario: «capital» se nombra con su cifra, «exposición de crédito» se declara, sin lente no se dice nada", invSin("credito").slice(0, 300)); }

  /* ─ BARRIDO POR FAMILIA · matrices construidas a mano (combinaciones, invariantes) ─ */
  const PISO = 2.0, capFrenado = (n) => { const s = skuInventario.find((x) => x.sku === n); return s.rotacion < PISO ? s.stockUSD : 0; };
  const bodegasT = [...new Set(skuInventario.map((s) => s.bodega))], capFrenadoB = (b) => skuInventario.filter((s) => s.bodega === b && s.rotacion < PISO).reduce((a, s) => a + s.stockUSD, 0);
  const FAMILIAS = [
    { id: "cobranza", tema: "cobranza", eje: "cliente", nombres: Mflujo.map((f) => f.nombre), metricas: { saldo_vencido: (n) => Mflujo.find((f) => f.nombre === n).vencidoK, dias_vencido: (n) => Mflujo.find((f) => f.nombre === n).diasVencido, abonado: (n) => Mflujo.find((f) => f.nombre === n).abonadoK, recuperado: (n) => Mflujo.find((f) => f.nombre === n).recuperadoPct }, ceros: { saldo_vencido: /\$0(?![\d.,])/, dias_vencido: /\b0 días/ }, segunda: "saldo_pendiente" },
    { id: "inventario-sku", tema: "inventario", eje: "sku", nombres: skuInventario.map((s) => s.sku), metricas: { capital_frenado: capFrenado, dias_sin_venta: (n) => skuInventario.find((s) => s.sku === n).diasSinVenta }, ceros: { capital_frenado: /\$0(?![\d.,])/, dias_sin_venta: /\b0 días/ }, segunda: "capital" },
    { id: "inventario-bodega", tema: "inventario", eje: "bodega", nombres: bodegasT, metricas: { capital_frenado: capFrenadoB }, ceros: { capital_frenado: /\$0(?![\d.,])/ }, segunda: "capital" },
  ];
  const fallas = {}; const cuenta = { combos: 0, aserciones: 0 };
  const falla = (clave, etq, det) => { (fallas[clave] = fallas[clave] || []).push(`${etq}${det ? " · " + det : ""}`); };
  const afirma = (cond, clave, etq, det) => { cuenta.aserciones++; if (!cond) falla(clave, etq, det); };

  H("A22 · barrido (i) y (iii) · el empate en el filo por cobranza · inventario (SKU · bodega) × métrica × dirección × k × cierre × premisas: lo declarado ES lo servido, cada servido tiene fila, el empate dice su puesto, sus nombres y su cero, la pertenencia del empatado lo declara y la Entrega pasa su verificador");
  for (const F of FAMILIAS) for (const metrica of Object.keys(F.metricas)) for (const dir of ["mayor", "menor"]) for (const k of [1, 2, 3, 4, 6, 7, 8, 9, 10, 12]) { if (k > F.nombres.length) continue;
    const T = topDe(F.nombres.map((n) => ({ n, v: F.metricas[metrica](n) })), k, dir);
    for (const cierre of ["cifra", "decision"]) {
      const top = { metrica, k, ...(dir === "menor" ? { direccion: "menor" } : {}) }, uni = { eje: F.eje, top };
      const conceptos = [metrica, F.segunda];
      const tied = T.hay ? T.empatados[0] : T.ord[Math.min(k, T.ord.length) - 1];
      const premisas = [{ id: "q1", tipo: "orden", sujeto: tied, metrica, orden: { forma: "topk", k, ...(dir === "menor" ? { direccion: "menor" } : {}) }, universo: { eje: F.eje } }, { id: "q2", tipo: "grupo", miembros: [T.hay ? (T.empatados[1] || T.empatados[0]) : tied], universo: uni }];
      const etq = `${F.id}.${metrica}.${dir}.k${k}.${cierre}`; cuenta.combos++;
      const { R, E } = entregaDe({ partes: [{ id: "p1", tema: F.tema, cierre, conceptos, eje: F.eje, universo: uni }], premisas });
      if (!E.ok) { falla("compone", etq, String(E.motivo)); continue; }
      const ents = universoDe(E, "p1"), txt = sinTablas(E), sirven = sujetosDe(E);
      afirma(mismosNombres(ents, T.servidos), "servido=esperado (top k con el empate del filo)", etq, JSON.stringify({ esperado: T.servidos, servido: ents }));
      afirma(T.servidos.every((n) => sirven.has(n)), "cada servido tiene fila", etq, JSON.stringify(T.servidos.filter((n) => !sirven.has(n))));
      const m = /sirve (\d+) por el empate del filo \(([^)]*?) empatan en el puesto (\d+)(?:; no tienen? [^)]*\([^)]*\))?\)/.exec(txt);   /* parte B (§7.3·39c · 46f): un empate en cero agrega «; no tienen X (cifra del cero)» */
      if (T.hay) {
        afirma(!!m && +m[1] === T.servidos.length && mismosNombres(m[2].split(/, | y /).map((x) => x.trim()).filter(Boolean), T.empatados) && +m[3] === T.puesto, "declara N, los empatados y el puesto compartido", etq, m ? m[0] : "sin declaración");
        if (F.ceros[metrica] && T.filo === 0) afirma(F.ceros[metrica].test(`${m ? m[0] : ""} | ${premisaTxt(E, "q1")} | ${premisaTxt(E, "q2")}`), "el empate en cero dice su cifra", etq, premisaTxt(E, "q1").slice(0, 160));
        for (const pid of ["q1", "q2"]) { const t = premisaTxt(E, pid), suj = pid === "q1" ? tied : premisas[1].miembros[0]; if (/es correcto/.test(t) && T.empatados.includes(suj)) afirma(/empatad/i.test(t) && T.empatados.filter((n) => n !== suj).every((n) => t.includes(n)) && new RegExp(`puesto ${T.puesto}\\b`).test(t), "la pertenencia del empatado declara el empate", `${etq}.${pid}`, t.slice(0, 200)); }
      } else afirma(!/por el empate del filo/.test(txt) && ents.length === Math.min(k, F.nombres.length), "sin empate en el filo: sirve k y no declara empate", etq, String(ents.length));
      const v = verifica(E, R); afirma(v.ok === true, "verificarEntrega-ok (composer ↔ verificador)", etq, JSON.stringify(v.violaciones).slice(0, 200));
    } }
  for (const [clave, xs] of Object.entries(fallas)) ok(false, `barrido · ${clave}`, xs.slice(0, 4).join(" | "));
  ok(Object.keys(fallas).length === 0 && cuenta.combos === 256 && cuenta.aserciones > 1300, `el empate del filo: ${cuenta.combos} combinaciones · ${cuenta.aserciones} aserciones · 0 violaciones (cobranza 4 métricas · inventario-SKU 2 · inventario-bodega 1 × 2 direcciones × k × 2 cierres)`, JSON.stringify(cuenta));

  H("A22 · barrido (ii) · la lente × el dominio × el universo: la oración de prioridad nombra la lente que ordenó o declara la que no, y el primero es el de la medida");
  { const LENTES_A = ["riesgo", "credito", "capital", "contribucion", "ventas", "crecimiento"], VIS = { riesgo: "riesgo", credito: "exposición de crédito", capital: "capital", contribucion: "contribución", ventas: "ventas", crecimiento: "crecimiento" };
    const APLICA = (l, tema) => (l === "credito" && tema === "cobranza") || (l === "capital" && tema === "inventario") || (l === "contribucion" && tema === "comercial") || (l === "ventas" && (tema === "cobranza" || tema === "comercial")) || (l === "crecimiento" && tema === "comercial");   /* §7.3·56: «crecimiento» aplica donde el dato publica la variación vs año anterior (comercial por cuenta) */
    const TEMAS = { cobranza: { eje: "cliente", conceptos: [["abonado", "saldo_vencido"], ["venta_credito", "recuperado"]], unis: [{ top: { metrica: "abonado", k: 3 } }, { estados: ["en mora"] }] }, inventario: { eje: "sku", conceptos: [["rotacion", "capital"], ["capital_frenado", "dias_sin_venta"]], unis: [{ top: { metrica: "capital", k: 3 } }, { estados: ["rota lento"] }] }, comercial: { eje: "cliente", conceptos: [["contribucion", "margen"], ["ventas", "margen"]], unis: [{ top: { metrica: "margen", k: 3 } }, { base: "bajo el benchmark" }] } };
    const malas = []; let n = 0, nombradas = 0, declaradas = 0, noVerifican = 0;
    for (const [tema, T] of Object.entries(TEMAS)) for (const conceptos of T.conceptos) for (const uni of T.unis) for (const lente of LENTES_A.concat([null])) {
      const etq = `${tema}.${conceptos.join("+")}.${Object.keys(uni)[0]}.${lente || "sinlente"}`; n++;
      const { R, E } = entregaDe({ partes: [{ id: "p1", tema, cierre: "decision", conceptos, eje: T.eje, universo: { eje: T.eje, ...uni } }], ...(lente ? { criterio: { lente } } : {}) });
      if (!E.ok) { malas.push(`${etq} no compone`); continue; }
      const l = (String(E.texto || "").split("\n").find((x) => /Prioridad del procedimiento dentro de este grupo/.test(x)) || "").replace(/^▸ /, "");
      const mm = /Prioridad del procedimiento dentro de este grupo, por ([^:(]+?)(?: \(([^)]*)\))?: (.*)$/.exec(l);
      if (!mm) { malas.push(`${etq} sin oración de prioridad`); continue; }
      const visL = lente === "ventas" && tema === "cobranza" ? "venta a crédito" : VIS[lente];   /* §7.3·52a: en cobranza «ventas» se dice «venta a crédito» */
      const nombra = mm[1].trim() === visL, declara = !!mm[2] && new RegExp(`el criterio pedido, ${lente ? visL : "x"}`).test(mm[2]);
      if (lente) { if (nombra) nombradas++; if (declara) declaradas++; const esperaNombrar = APLICA(lente, tema); if (esperaNombrar !== nombra || (!esperaNombrar && !declara)) malas.push(`${etq} → «${l.slice(0, 150)}»`); } else if (mm[2]) malas.push(`${etq} declara sin lente pedida`);
      if (lente === "credito" && tema === "cobranza" && nombra && !/ninguna cuenta queda primera/.test(mm[3])) { const ents = universoDe(E, "p1"), esp = ents.map((x) => Mflujo.find((f) => f.nombre === x)).sort((a, b) => (b.vencidoK - a.vencidoK) || (b.diasVencido - a.diasVencido))[0]; if (!esp || esp.nombre !== mm[3].split(",")[0]) malas.push(`${etq} primero ≠ mayor saldo vencido (${esp && esp.nombre})`); }
      if (lente === "ventas" && tema === "cobranza" && nombra && !/ninguna cuenta queda primera/.test(mm[3])) { const ents = universoDe(E, "p1"), esp = ents.slice().sort((a, b) => Mflujo.find((f) => f.nombre === b).ventaK - Mflujo.find((f) => f.nombre === a).ventaK)[0]; if (esp !== mm[3].split(",")[0]) malas.push(`${etq} primero ≠ mayor venta (${esp})`); }
      if (!verifica(E, R).ok) noVerifican++;
    }
    ok(n === 84 && malas.length === 0, `la lente se nombra ⇔ aplica (crédito→cobranza · capital→inventario · contribución→comercial · ventas→cuentas) y si no se DECLARA; sin lente pedida no se declara; el primero es el de la medida — ${n} combinaciones (3 dominios × 2 conjuntos de conceptos × 2 universos × (6 lentes + sin lente))`, malas.slice(0, 4).join(" | "));
    ok(noVerifican === 0, "las 84 Entregas de la matriz de lentes pasan `verificarEntrega`", String(noVerifican));
    ok(nombradas === 24 && declaradas === 48, "oráculo de la matriz · hay lentes que se nombran y lentes que se declaran (24 nombradas: crédito→cobranza 4 · capital→inventario 4 · contribución→comercial 4 · ventas→cuentas 8 · crecimiento→comercial 4 (§7.3·56); las otras 48 se declaran)", JSON.stringify({ nombradas, declaradas })); }

  H("A22 · barrido (iv) · el «de M» de un conteo en todas las formas de universo (eje · base · estados · top · excluir · bodega): el eslabón es admisible y la falsedad por M imprime el más ajustado");
  { const bajo = new Set(clientesMargen.filter((c) => c.margen < 30.1).map((c) => c.nombre)), mora = new Set(Mflujo.filter((f) => f.vencidoK > 0).map((f) => f.nombre)), abon = Object.fromEntries(Mflujo.map((f) => [f.nombre, f.abonadoK]));
    const topSet = (set, k) => { const ord = [...set].sort((a, b) => abon[b] - abon[a]); if (!ord.length) return new Set(); const vF = abon[ord[Math.min(k, ord.length) - 1]]; return new Set(ord.filter((x, i) => i < k || abon[x] === vF)); };
    const FORMAS = [["eje", {}], ["base", { base: 1 }], ["estados", { estados: 1 }], ["base+estados", { base: 1, estados: 1 }], ["top", { top: 1 }], ["estados+top", { estados: 1, top: 1 }], ["base+top", { base: 1, top: 1 }], ["excluir", { excluir: 1 }], ["top+excluir", { top: 1, excluir: 1 }], ["estados+excluir", { estados: 1, excluir: 1 }], ["estados+top+excluir", { estados: 1, top: 1, excluir: 1 }]];
    const malas = []; let n = 0, aser = 0;
    for (const [nombre, f] of FORMAS) for (const k of (f.top ? [2, 3, 5] : [0])) { const excl = f.excluir ? ["Lider", "Jumbo"] : [];
      const u = { eje: "cliente" }; const cadena = [new Set(Mflujo.map((x) => x.nombre))]; let cur = cadena[0], pasos = ["eje"];
      if (f.base) { u.base = "bajo el benchmark"; cur = new Set([...cur].filter((x) => bajo.has(x))); cadena.push(cur); pasos.push("base"); }
      if (f.estados) { u.estados = ["en mora"]; cur = new Set([...cur].filter((x) => mora.has(x))); cadena.push(cur); pasos.push("estados"); }
      if (f.top) { u.top = { metrica: "abonado", k }; cur = topSet(cur, k); cadena.push(cur); pasos.push("top"); }
      if (f.excluir) { u.excluir = { entidades: excl }; cur = new Set([...cur].filter((x) => !excl.includes(x))); cadena.push(cur); pasos.push("excluir"); }
      const final = cadena[cadena.length - 1], nFinal = final.size; if (nFinal === 0) continue;
      /* §7.3·54(a): el universo FINAL también es un eslabón de la cadena («n de n» sobre el final es verdadero); antes de la 54 el último paso quedaba fuera de los «de M» admisibles */
      const eslabones = [...new Set(cadena.map((c) => c.size))];
      const extras = new Set(); if (f.base && f.estados) extras.add(new Set([...cadena[0]].filter((x) => mora.has(x))).size);   /* la población de los estados SOLOS: el código la admite, la cadena estricta no la exige */
      const noEslabon = [2, 3, 4, 5, 6, 7, 9, 11, 12].filter((c) => c >= nFinal && !eslabones.includes(c) && !extras.has(c))[0];
      const ms = [...eslabones, ...(noEslabon != null ? [noEslabon] : [])];
      const { R, E } = entregaDe({ partes: [{ id: "p1", tema: "cobranza", cierre: "cifra", conceptos: ["abonado"], entidades: [{ nombre: "Jumbo" }] }], premisas: ms.map((m, i) => ({ id: `q${i + 1}`, tipo: "conteo", conteo: { n: nFinal, m }, de: u })) });
      n++; const etq = `${nombre}.k${k}`;
      if (!E.ok) { malas.push(`${etq} no compone`); continue; }
      const siguientes = eslabones.filter((x) => x > nFinal).sort((a, b) => a - b);
      ms.forEach((m, i) => { const t = premisaTxt(E, `q${i + 1}`); if (!t) return; aser++;
        const esEsl = eslabones.includes(m), esp = esEsl ? "es correcto" : "no es así", im = /(\d+) de (\d+) en /.exec(t);
        const mEsp = esEsl ? m : (siguientes.length ? siguientes[0] : eslabones[eslabones.length - 1]);
        if (!t.includes(esp) || !im || +im[1] !== nFinal || +im[2] !== mEsp) malas.push(`${etq} m=${m} → «${t.slice(0, 110)}» (esperaba ${esp}, ${nFinal} de ${mEsp})`); });
      if (!verifica(E, R).ok) malas.push(`${etq} no pasa verificarEntrega`); }
    ok(n === 21 && malas.length === 0, `el «de M»: ${n} formas de universo × eslabones × un M fuera de la cadena (${aser} premisas) — el veredicto, el n real y el M impreso son los del oráculo de la cadena`, malas.slice(0, 4).join(" | "));
    const bod = (b, conTop) => { const todos = skuInventario.filter((s) => s.bodega === b); const top = todos.slice().sort((x, y) => y.stockUSD - x.stockUSD).slice(0, 2).map((s) => s.sku); const { E } = entregaDe({ partes: [{ id: "p1", tema: "inventario", cierre: "cifra", conceptos: ["capital"], eje: "sku", entidades: [{ nombre: todos[0].sku, eje: "sku" }] }], premisas: [{ id: "q1", tipo: "conteo", conteo: { n: conTop ? 2 : todos.length, m: conTop ? 7 : 4 }, de: { eje: "sku", bodega: b, ...(conTop ? { top: { metrica: "capital", k: 2 } } : {}) } }] }); return { t: premisaTxt(E, "q1"), todos: todos.length, top }; };
    const bv = bod("Valparaíso", true);
    ok(/no es así — 2 de 4 en /.test(bv.t) && bv.todos === 4, "bodega + top: «2 de 7 en los 2 de mayor capital de Valparaíso» es falsa solo por el M e imprime el eslabón de la bodega (4 SKU), no el eje (13)", bv.t); }
}

/* ═══ A23 · DIAGNÓSTICO v25 y v26 (mediciones ciegas v25 y v26; §7.3·49) ═══════════════════════════════════════════════════════════════════════════════════════
 * Las raíces que dejaron las dos mediciones y las FAMILIAS que las contienen (barrido por combinación, construido a mano: no son los casos de los catálogos). Oráculos INDEPENDIENTES del código que se corrige: el dato del tenant
 * (`clientesMargen`, `marcasMargen`, `sfamiliasMargen`, `skusMargen`, `skuInventario`), la mesa de flujo (`buildMesaFlujo`) y la política (`benchmarkOf`, `umbral`); nunca la Entrega ni el Notario. Cada familia trae su CARNADA (el defecto, reconstruido, cae).
 *   (a) LA REFERENCIA DE LA CONSULTA en cada parte que usa el conjunto, en el eje de esa parte (P48): referencia × eje × base o filtro × dirección × una o dos partes × la referencia solo en una premisa.
 *   (b) UNA DECISION CON ENTIDADES NOMBRADAS DECIDE (P60 P61 N63 N64 N65): lente × dominio/eje × 2 a 4 entidades.
 *   (c) LA FOTO (N19 N23): el eje entero con fila o cero; lo que el productor no trae se declara.
 *   (d) UNA PREMISA CARGA SU EVIDENCIA (N26): tipo de premisa × concepto × eje; el Marco no declara una cifra sin hecho.
 *   (e) LA LENTE «VENTAS» en cliente, marca, familia y SKU (N25 N32 N38 N73). (f) EL RÓTULO de su concepto (N78). (g) EL CORTE Cifras/Detalle no parte una entidad (P74).
 *   + el «techo de quiebre» en el criterio aplicado (N39) y el Marco de una Entrega solo de cobranza. */
{
  const Mflujo = buildMesaFlujo(ESCENARIO_INICIAL).filas;
  const filasCifras = (E) => ((E.entrega && E.entrega.cifras && E.entrega.cifras.filas) || []);
  const filasDetalle = (E) => ((E.entrega && E.entrega.detalle && E.entrega.detalle.filas) || []);
  const sujetosDe = (E) => new Set([...filasCifras(E), ...filasDetalle(E)].map((f) => f.valores["Entidad / grupo"]));
  const universoDe = (E, id) => (((E.entrega && E.entrega.universos) || []).find((u) => u.id === id && u.soloRanking !== true) || {}).entidades || [];
  const sinTablas = (E) => String(E.texto || "").split("\n").filter((l) => !/^\|/.test(l)).join("\n");
  const oracionesDe = (E) => [...(((E.entrega && E.entrega.respuesta) || [])), ...(((E.entrega && E.entrega.detalle && E.entrega.detalle.oraciones) || []))].filter((r) => r && typeof r.texto === "string");
  const verifica = (E, R, prof = "completa") => { try { return verificarEntrega({ texto: E.texto, entrega: E.entrega, profundidad: prof, resolucion: R, indice: (E.entrega.procedencia && E.entrega.procedencia.libro && E.entrega.procedencia.libro.indice) || null }); } catch (x) { return { ok: false, violaciones: [{ regla: "excepcion", detalle: String(x && x.message) }] }; } };
  const conTexto = (E, f) => ({ ...E, texto: f(String(E.texto || "")) });
  const EJE = { cliente: clientesMargen.map((x) => ({ n: x.nombre, m: x.margen, v: x.venta })), marca: marcasMargen.map((x) => ({ n: x.nombre, m: x.margen, v: x.venta })), familia: sfamiliasMargen.map((x) => ({ n: x.nombre, m: x.margen, v: x.venta })), sku: skusMargen.map((x) => ({ n: x.nombre, m: x.margen, v: x.venta })) };
  const UNIDAD = { cliente: ["cuenta", "cuentas"], marca: ["marca", "marcas"], familia: ["familia", "familias"], sku: ["SKU", "SKU"] };
  const cuenta = (eje, n) => `${n} ${UNIDAD[eje][n === 1 ? 0 : 1]}`;
  const BENCH = benchmarkOf();
  const conjunto = (eje, dir, valor) => EJE[eje].filter((x) => (dir === "bajo" ? x.m < valor : x.m >= valor)).map((x) => x.n);

  /* ─ (a) P48 · la referencia de la consulta se declara en CADA parte que usa el conjunto, en el eje de esa parte ─ */
  H("A23 · 49a · P48 · la referencia de la consulta se declara al lado de la oficial en CADA parte que usa el conjunto, con su conteo, el oficial y sus nombres en el EJE de la parte");
  { const BASE = { cliente: { bajo: "bajo el benchmark", sobre: "sobre el benchmark" }, sku: { bajo: "SKU bajo el benchmark", sobre: "SKU sobre el benchmark" } }, OP = { bajo: "<", sobre: ">=" };
    const uni = (eje, forma, dir) => (forma === "base" ? { eje, base: BASE[eje][dir] } : { eje, filtros: [{ metrica: "margen", op: OP[dir], ref: "benchmark" }] });
    const declaraciones = (E) => ((E.entrega && E.entrega.limites) || []).filter((l) => /^Con la referencia planteada en la consulta/.test(l.titulo || "")).map((l) => `${l.titulo} ${l.motivo}`);
    /* la declaración esperada de (eje, dir): el conteo alternativo en la unidad del eje, el oficial y todos los nombres; consume UNA declaración */
    const declara = (E, eje, dir, ref) => { const ds = declaraciones(E), alt = conjunto(eje, dir, ref), ofi = conjunto(eje, dir, BENCH); return ds.some((d) => d.includes(cuenta(eje, alt.length)) && new RegExp(`${dir} esa referencia`).test(d) && new RegExp(`contra ${ofi.length}\\b`).test(d) && alt.every((n) => d.includes(n))); };
    let n = 0, malas = [];
    for (const ref of [25, 35]) {
      const criterio = { referencia: { concepto: "benchmark", valor: ref, unidad: "pct" } };
      const items = [["cliente", "base", "bajo"], ["cliente", "filtro", "sobre"], ["sku", "base", "bajo"], ["sku", "base", "sobre"], ["sku", "filtro", "bajo"], ["marca", "filtro", "bajo"], ["familia", "filtro", "bajo"], ["familia", "filtro", "sobre"]];
      for (const [eje, forma, dir] of items) for (const cierre of ["cifra", "lectura", "decision"]) { n++; const { R, E } = entregaDe({ partes: [{ id: "p1", tema: "comercial", cierre, conceptos: ["margen", "ventas"], eje, universo: uni(eje, forma, dir) }], criterio }); if (!(E.ok && declara(E, eje, dir, ref) && declaraciones(E).length === 1 && verifica(E, R).ok)) malas.push(`1p.${ref}.${cierre}.${eje}.${forma}.${dir}`); }
      for (let i = 0; i < items.length; i++) for (let j = i + 1; j < items.length; j++) { const [a, b] = [items[i], items[j]]; if (a[0] === b[0] && a[2] === b[2]) continue; n++;
        const { E } = entregaDe({ partes: [{ id: "p1", tema: "comercial", cierre: "cifra", conceptos: ["margen", "ventas"], eje: a[0], universo: uni(...a) }, { id: "p2", tema: "comercial", cierre: "lectura", conceptos: ["margen", "ventas"], eje: b[0], universo: uni(...b) }], criterio });
        const usados = [a, b].filter((x, k, arr) => arr.findIndex((y) => y[0] === x[0] && y[2] === x[2]) === k);
        if (!(E.ok && usados.every((u) => declara(E, u[0], u[2], ref)) && declaraciones(E).length === usados.length)) malas.push(`2p.${ref}.${a.join("/")}+${b.join("/")}`); }
      for (const it of [["sku", "base", "bajo"], ["sku", "base", "sobre"], ["marca", "filtro", "bajo"], ["cliente", "base", "bajo"]]) { n++; const { E } = entregaDe({ partes: [{ id: "p1", tema: "comercial", cierre: "cifra", conceptos: ["ventas"], eje: "cliente" }], criterio, premisas: [{ id: "q1", tipo: "conteo", conteo: { n: conjunto(it[0], it[2], BENCH).length, m: EJE[it[0]].length }, de: uni(...it) }] }); if (!(E.ok && declara(E, it[0], it[2], ref))) malas.push(`premisa.${ref}.${it.join("/")}`); }
    }
    ok(n >= 100 && malas.length === 0, `barrido · ${n} combinaciones (referencia × eje × base o filtro × dirección × 1-2 partes × premisa): la referencia se declara en el eje de cada parte`, JSON.stringify(malas.slice(0, 6)));
    /* la carnada: el defecto reconstruido (la declaración del eje SKU desaparece, queda la de familias) cae */
    const { E: E0 } = entregaDe({ partes: [{ id: "p1", tema: "comercial", cierre: "cifra", conceptos: ["margen", "ventas"], eje: "familia", universo: uni("familia", "filtro", "bajo") }, { id: "p2", tema: "comercial", cierre: "lectura", conceptos: ["margen", "ventas"], eje: "sku", universo: uni("sku", "base", "bajo") }], criterio: { referencia: { concepto: "benchmark", valor: 25, unidad: "pct" } } });
    const sinSku = { ...E0, entrega: { ...E0.entrega, limites: (E0.entrega.limites || []).filter((l) => !/SKU bajo esa referencia/.test(`${l.motivo}`)) } };
    ok(declara(E0, "familia", "bajo", 25) && declara(E0, "sku", "bajo", 25) && !declara(sinSku, "sku", "bajo", 25), "CARNADA · el defecto reconstruido (la declaración de la parte por SKU falta: solo queda la de las familias) cae"); }

  /* ─ (b) P60 P61 N63 N64 N65 · una decision con entidades nombradas decide entre ellas ─ */
  H("A23 · 49b · P60 P61 N63 N64 N65 · una `decision` con entidades nombradas DECIDE: da la prioridad entre ellas por la lente pedida (nombrada) o la de ADI; una lente que no las ordena se declara; la que no distingue no corona");
  { const cap = (n) => { const s = skuInventario.find((x) => x.sku === n); return s.rotacion < 2.0 ? s.stockUSD : 0; };
    const DOMS = [
      { k: "cobranza·cliente", tema: "cobranza", eje: "cliente", ents: ["Lider", "Tottus", "Sodimac", "Easy", "Paris", "Jumbo", "Mercado Libre"], conj: ["saldo_vencido", "dias_vencido"], aplica: { credito: (x) => { const f = Mflujo.find((y) => y.nombre === x); return f.vencidoK * 1e6 + f.diasVencido; }, ventas: (x) => Mflujo.find((y) => y.nombre === x).ventaK } },
      { k: "comercial·marca", tema: "comercial", eje: "marca", ents: ["Samsung", "LG", "Philips", "Bosch", "Makita"], conj: ["ventas", "margen"], aplica: { ventas: (x) => marcasMargen.find((y) => y.nombre === x).venta } },
      { k: "inventario·sku", tema: "inventario", eje: "sku", ents: ["LG-DRYER8KG", "MAK-COMP-AIR", "BOS-SANDER", "SAM-REF500L", "PHI-IRON-PRO", "LG-WASH11KG"], conj: ["capital_frenado", "dias_sin_venta"], aplica: { capital: cap } },
    ];
    const VIS = { credito: "exposición de crédito", capital: "capital", contribucion: "contribución", ventas: "ventas", crecimiento: "crecimiento" };
    const visDe = (lu, D) => (lu === "ventas" && D.tema === "cobranza" ? "venta a crédito" : VIS[lu]);   /* §7.3·52a: en cobranza «ventas» se dice «venta a crédito» */
    const RE_DEC = /^(?:Prioridad del procedimiento|En (?:comercial|cobranza|inventario), quien más pesa|Quien más pesa en el conjunto)/;
    let n = 0, malas = [], ejemplo = null;
    for (const D of DOMS) for (const lente of [null, "riesgo", "credito", "capital", "contribucion", "ventas", "crecimiento"]) for (const k of [2, 3, 4]) for (const sel of ["primeras", "ultimas"]) {
      const nombres = sel === "primeras" ? D.ents.slice(0, k) : D.ents.slice(-k);
      const { R, E } = entregaDe({ partes: [{ id: "p1", tema: D.tema, cierre: "decision", conceptos: D.conj, eje: D.eje, entidades: nombres.map((x) => ({ nombre: x, ...(D.eje !== "cliente" ? { eje: D.eje } : {}) })) }], ...(lente ? { criterio: { lente } } : {}) });
      n++; const etq = `${D.k}.${lente || "sinlente"}.${k}.${sel}`;
      if (!E.ok) { malas.push(`${etq}:no-ok`); continue; }
      const dec = oracionesDe(E).filter((r) => !r._premisa && RE_DEC.test(r.texto)).map((r) => r.texto), txt = dec.join(" | ");
      const fuera = D.ents.filter((x) => !nombres.includes(x) && !nombres.some((y) => y.includes(x) || x.includes(y)));
      let bien = verifica(E, R).ok && dec.length > 0 && nombres.some((x) => txt.includes(x)) && !fuera.some((x) => new RegExp(`(?<![\\wÁ-ú-])${x}(?![\\wÁ-ú-])`).test(txt));
      const lu = lente && lente !== "riesgo" ? lente : null;
      if (lu) {
        const f = D.aplica[lu];
        if (f) { const vals = nombres.map((x) => ({ x, v: f(x) })), mx = Math.max(...vals.map((y) => y.v)), cima = vals.filter((y) => y.v === mx);
          const m = /Prioridad del procedimiento(?: dentro de este grupo)?, por ([^:(]+?)(?: \([^)]*\))?: ([^,.(]+?)(?:,| \(|\.)/.exec(txt);
          const nombra = !!m && new RegExp(visDe(lu, D), "i").test(m[1]);
          bien = bien && (nombra || /ninguna cuenta queda primera|criterio pedido|no ordena|no trae/i.test(txt));
          if (nombra && mx > 0 && cima.length === 1) bien = bien && m[2].trim() === cima[0].x;
          if (mx === 0 || cima.length > 1) bien = bien && !(nombra && m && nombres.includes(m[2].trim()) && !/ninguna cuenta queda primera|no ordena|criterio pedido/i.test(txt)); }
        else bien = bien && new RegExp(visDe(lu, D), "i").test(txt);
      }
      if (!bien) malas.push(etq); else if (!ejemplo && D.k === "cobranza·cliente" && lente === "credito" && sel === "primeras" && k === 2) ejemplo = { E, nombres, dec };
    }
    ok(n >= 120 && malas.length === 0, `barrido · ${n} combinaciones (lente × dominio/eje × 2-4 entidades × dos selecciones): decide entre las pedidas, nombra la lente o la declara, el primero es el de su medida y nunca coronado en cero`, JSON.stringify(malas.slice(0, 6)));
    /* P60 exacto: Lider antes que Tottus por exposición de crédito, con su cifra */
    const { R: R60, E: E60 } = entregaDe({ partes: [{ id: "p1", tema: "cobranza", cierre: "decision", conceptos: ["saldo_vencido", "dias_vencido"], entidades: [{ nombre: "Lider" }, { nombre: "Tottus" }] }], criterio: { lente: "credito" } });
    ok(E60.ok && oracionesDe(E60).some((r) => /^Prioridad del procedimiento, por exposición de crédito: Lider, con \$4\.6M en saldo vencido\.$/.test(r.texto)) && verifica(E60, R60).ok, "P60 · «Prioridad del procedimiento, por exposición de crédito: Lider, con $4.6M en saldo vencido» (nombre visible de la lente, el primero y su cifra)", oracionesDe(E60).map((r) => r.texto).join(" | "));
    /* la carnada: sin las oraciones de prioridad la decisión no decide */
    const sinPrio = { ...E60, entrega: { ...E60.entrega, respuesta: (E60.entrega.respuesta || []).filter((r) => !RE_DEC.test(r.texto) && !/ va antes que /.test(r.texto)) } };
    ok(oracionesDe(E60).some((r) => RE_DEC.test(r.texto)) && !oracionesDe(sinPrio).some((r) => RE_DEC.test(r.texto)), "CARNADA · el defecto reconstruido (la Entrega sirve a cada entidad pero ninguna oración decide entre ellas) cae"); }

  /* ─ (c) N19 N23 · la foto es el eje entero: cada miembro con fila (o su cero) y lo que el productor no trae se declara ─ */
  H("A23 · 49c · N19 N23 · la foto sirve el EJE ENTERO (comercial e inventario): cada miembro con su fila (su cero por ausencia o el valor que la proyección publica) y lo que el productor no trae se nombra en un límite");
  { const PRODS = [
      { k: "comercial·cliente", tema: "comercial", eje: "cliente", miembros: clientesMargen.map((x) => x.nombre), conj: [["contribucion", "brecha"], ["ventas", "margen"]] },
      { k: "comercial·familia", tema: "comercial", eje: "familia", explicito: true, miembros: sfamiliasMargen.map((x) => x.nombre), conj: [["margen", "unidades"]] },
      { k: "inventario·sku", tema: "inventario", eje: "sku", miembros: skuInventario.map((x) => x.sku), conj: [["capital_frenado", "rotacion"], ["capital", "dias_inventario"]] },
    ];
    let n = 0, malas = [], real = null;
    for (const P of PRODS) for (const conj of P.conj) for (const cierre of ["lectura", "decision"]) for (const prof of ["completa", "breve"]) {
      const { R, E } = entregaDe({ partes: [{ id: "p1", tema: P.tema, cierre, conceptos: conj, ...(P.explicito ? { eje: P.eje } : {}) }], profundidad: prof, ...(cierre === "decision" ? { criterio: { lente: P.tema === "inventario" ? "capital" : "contribucion" } } : {}) });
      n++; const etq = `${P.k}.${conj.join("+")}.${cierre}.${prof}`;
      if (!E.ok) { malas.push(`${etq}:no-ok`); continue; }
      const sv = universoDe(E, "p1"), tablas = sujetosDe(E);
      const limites = ((E.entrega && E.entrega.limites) || []).map((l) => `${l.titulo} ${l.motivo}`).join(" ");
      const filaDe = (m, c) => [...filasCifras(E), ...filasDetalle(E)].some((f) => f.valores["Entidad / grupo"] === m && new RegExp(`^${({ capital_frenado: "Capital inmovilizado crítico", rotacion: "Rotación", capital: "Capital", dias_inventario: "Días de inventario", contribucion: "Contribución", brecha: "Brecha al benchmark", ventas: "Venta", margen: "Margen", unidades: "Unidades vendidas" })[c]}`, "i").test(f.valores["Métrica"]));
      const etiq = { capital_frenado: "capital inmovilizado crítico", rotacion: "rotación", capital: "capital", dias_inventario: "días de inventario", contribucion: "contribución", brecha: "brecha", ventas: "venta", margen: "margen", unidades: "unidades vendidas" };
      const faltantes = conj.flatMap((c) => P.miembros.filter((m) => !filaDe(m, c) && !(new RegExp(m.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).test(limites) && limites.toLowerCase().includes(etiq[c]))).map((m) => `${m}:${c}`));
      const bien = verifica(E, R, prof).ok && P.miembros.every((m) => sv.includes(m) && tablas.has(m)) && sv.length === P.miembros.length && faltantes.length === 0;
      if (!real && P.k === "inventario·sku" && conj[0] === "capital_frenado" && cierre === "lectura" && prof === "completa") real = { E, P };
      if (!bien) malas.push(`${etq}:${faltantes.length}`);
    }
    ok(n === 20 && malas.length === 0, `barrido · ${n} combinaciones (productor × conceptos × cierre × profundidad): la foto es el eje entero, cada miembro con fila de cada concepto o nombrado en el límite`, JSON.stringify(malas.slice(0, 6)));
    const tab = sujetosDe(real.E);
    ok(real.P.miembros.length === 13 && real.P.miembros.every((m) => tab.has(m)) && filasCifras(real.E).concat(filasDetalle(real.E)).filter((f) => /Capital inmovilizado crítico/.test(f.valores["Métrica"]) && f.valores["Valor"] === "$0").length >= 10, "N19 · los 13 SKU tienen fila y los 10 sin capital inmovilizado crítico llevan su «$0» (la foto ya no son solo los 3 críticos)");
    /* la carnada: a la foto se le quitan las filas de las cuentas sin cifra del productor */
    const sanos = new Set(filasCifras(real.E).concat(filasDetalle(real.E)).filter((f) => /Capital inmovilizado crítico/.test(f.valores["Métrica"]) && f.valores["Valor"] === "$0").map((f) => f.valores["Entidad / grupo"]));
    const sinSanos = { ...real.E, entrega: { ...real.E.entrega, cifras: { ...real.E.entrega.cifras, filas: filasCifras(real.E).filter((f) => !sanos.has(f.valores["Entidad / grupo"])) }, detalle: { ...(real.E.entrega.detalle || {}), filas: filasDetalle(real.E).filter((f) => !sanos.has(f.valores["Entidad / grupo"])) } } };
    ok(real.P.miembros.every((m) => sujetosDe(real.E).has(m)) && !real.P.miembros.every((m) => sujetosDe(sinSanos).has(m)), "CARNADA · el defecto reconstruido (la foto solo trae los SKU con cifra del productor: los sanos sin fila) cae"); }

  /* ─ (d) N26 · una premisa carga su evidencia aunque ninguna parte pida su concepto; el Marco no declara una cifra sin hecho ─ */
  H("A23 · 49d · N26 · una premisa carga su evidencia aunque ninguna parte pida su concepto: tipo × concepto × eje; y el Marco nunca declara el «3.5 %» sin que su cifra esté declarada");
  { const VALOR = { money: "$1.0M", pct: "10%", days: "10 días", ratio: "1.0x", count: "10" };
    const ENTS = { cliente: clientesMargen.map((x) => x.nombre), marca: marcasMargen.map((x) => x.nombre), familia: sfamiliasMargen.map((x) => x.nombre), sku: skusMargen.map((x) => x.nombre) };
    const PARES = [["carga", "pct", "cliente"], ["carga", "pct", "marca"], ["carga", "pct", "familia"], ["margen", "pct", "familia"], ["margen", "pct", "sku"], ["contribucion", "money", "marca"], ["unidades", "count", "familia"], ["brecha", "pp", "cliente"]];
    const parteAjena = { id: "p1", tema: "cobranza", cierre: "cifra", conceptos: ["saldo_pendiente"], entidades: [{ nombre: "Lider" }] };
    const hecho = (E) => E.entrega.procedencia.libroPremisas.porId.get("q1");
    let n = 0, malas = [];
    for (const [c, u, eje] of PARES) {
      const e1 = ENTS[eje][0], e2 = ENTS[eje][1], val = VALOR[u] || "1pp";
      const premisas = [
        { id: "q1", tipo: "cifra", sujeto: e1, metrica: c, valor: val },
        { id: "q1", tipo: "orden", sujeto: e1, metrica: c, orden: { forma: "max" }, universo: { eje } },
        { id: "q1", tipo: "grupo", miembros: [e1], universo: { eje, top: { metrica: c, k: 3 } } },
        { id: "q1", tipo: "conteo", conteo: { n: 1, m: 3 }, de: { eje, top: { metrica: c, k: 3 } } },
        { id: "q1", tipo: "conteo", conteo: { n: 1, m: ENTS[eje].length }, de: { eje, filtros: [{ metrica: c, op: ">", valor: 1 }] } },
        { id: "q1", tipo: "relacion", sujeto: e1, metrica: c, relacion: { forma: "mayor", vs: { sujeto: e2 } } },
      ];
      for (const premisa of premisas) { n++; const { R, E } = entregaDe({ partes: [parteAjena], premisas: [premisa] }); const H1 = E.ok ? hecho(E) : null; if (!(E.ok && H1 && (H1.veredicto === "verdadera" || H1.veredicto === "falsa") && verifica(E, R).ok)) malas.push(`${premisa.tipo}.${c}.${eje}`); }
    }
    for (const [ref, metrica, op, ejes] of [["nivel_carga", "carga", ">", ["cliente", "marca", "familia"]], ["benchmark", "margen", "<", ["cliente", "marca", "familia", "sku"]]]) for (const eje of ejes) for (const tipo of ["conteo", "grupo"]) { n++;
      const U = { eje, filtros: [{ metrica, op, ref }] };
      const premisa = tipo === "conteo" ? { id: "q1", tipo, conteo: { n: 1, m: ENTS[eje].length }, de: U } : { id: "q1", tipo, miembros: [ENTS[eje][0]], universo: U };
      const { R, E } = entregaDe({ partes: [parteAjena], premisas: [premisa] }); const H1 = E.ok ? hecho(E) : null;
      if (!(E.ok && H1 && (H1.veredicto === "verdadera" || H1.veredicto === "falsa") && verifica(E, R).ok)) malas.push(`ref.${ref}.${eje}.${tipo}`); }
    for (const base of ["bajo el benchmark", "SKU bajo el benchmark"]) { n++; const eje = /^SKU/.test(base) ? "sku" : "cliente"; const { R, E } = entregaDe({ partes: [{ id: "p1", tema: "comercial", cierre: "cifra", conceptos: ["ventas"], eje: "cliente" }], criterio: { referencia: { concepto: "benchmark", valor: 25, unidad: "pct" } }, premisas: [{ id: "q1", tipo: "conteo", conteo: { n: 1, m: ENTS[eje].length }, de: { eje, base } }] });
      if (!(E.ok && /(?:\d+ )(?:SKU|cuentas)[^.]*esa referencia/.test((E.entrega.limites || []).map((l) => l.motivo).join(" ")) && verifica(E, R).ok)) malas.push(`base.${base}`); }
    ok(n >= 50 && malas.length === 0, `barrido · ${n} combinaciones (tipo de premisa × concepto × eje, el filtro con \`ref\` y el \`base\` de la casa): ninguna queda «no verificable» por una evidencia que el Core sabe calcular y todas pasan verificarEntrega`, JSON.stringify(malas.slice(0, 6)));
    const { R: R26, E: E26 } = entregaDe({ partes: [{ id: "p1", tema: "comercial", cierre: "decision", conceptos: ["margen", "unidades"], eje: "familia" }], criterio: { lente: "riesgo" }, premisas: [{ id: "q2", tipo: "conteo", conteo: { n: 2, m: 4 }, de: { eje: "familia", filtros: [{ metrica: "carga", op: ">", ref: "nivel_carga" }] } }] });
    const H26 = E26.entrega.procedencia.libroPremisas.porId.get("q2");
    ok(E26.ok && H26.veredicto === "verdadera" && /2 de 4/.test(sinTablas(E26)) && verifica(E26, R26).ok, "N26 · «2 de 4» familias sobre el nivel de carga: la premisa carga la carga por familia aunque la parte pida margen y unidades", sinTablas(E26).split("\n").filter((l) => /premisa/.test(l)).join(" | "));
    /* el Marco declara «3.5%» sin que su cifra esté declarada: la Entrega de N26 sin su cifra impresa es rechazada (el rechazo de verificarEntrega que la 49d cierra) */
    const sinCifra = { ...E26, entrega: { ...E26.entrega, procedencia: { ...E26.entrega.procedencia, cifrasImpresas: (E26.entrega.procedencia.cifrasImpresas || []).filter((c) => !/3\.5/.test(c)) } } };
    ok(/Nivel de referencia de carga: 3\.5%/.test(E26.texto) && verifica(E26, R26).ok && !verifica(sinCifra, R26).ok, "CARNADA · el defecto reconstruido (el Marco dice «3.5%» sin que esa cifra esté declarada) cae en verificarEntrega"); }

  /* ─ (e) N25 N32 N38 N73 · la lente «ventas» aplica en cliente, marca, familia y SKU ─ */
  H("A23 · 49e · N25 N32 N38 N73 · la lente «ventas» APLICA donde el dato publica venta (cliente · marca · familia · SKU): la oración de prioridad la nombra y su primero es el de mayor venta del grupo; en inventario (sin venta) se declara");
  { const PRIO = /^Prioridad del procedimiento(?: dentro de este grupo)?, por ([^:(]+?)(?: \(([^)]*)\))?: ([^,]+?), con /;
    let n = 0, malas = [];
    for (const [eje, uni] of [["cliente", null], ["cliente", { top: { metrica: "margen", k: 3 } }], ["marca", null], ["marca", { top: { metrica: "margen", k: 3 } }], ["familia", null], ["familia", { top: { metrica: "margen", k: 2 } }], ["sku", null], ["sku", { top: { metrica: "margen", k: 4 } }], ["sku", { base: "SKU bajo el benchmark" }]]) for (const conj of [["margen", "unidades"], ["ventas", "margen"]]) {
      const { R, E } = entregaDe({ partes: [{ id: "p1", tema: "comercial", cierre: "decision", conceptos: conj, eje, ...(uni ? { universo: { eje, ...uni } } : {}) }], criterio: { lente: "ventas" } }); n++;
      const m = oracionesDe(E).map((r) => PRIO.exec(r.texto)).filter(Boolean)[0], grupo = universoDe(E, "p1");
      const esp = grupo.map((g) => EJE[eje].find((x) => x.n === g)).filter(Boolean).sort((a, b) => b.v - a.v)[0];
      if (!(E.ok && m && /^ventas$/i.test(m[1].trim()) && esp && esp.n === m[3].trim() && verifica(E, R).ok)) malas.push(`${eje}.${uni ? Object.keys(uni)[0] : "sin"}.${conj.join("+")}`);
    }
    ok(n === 18 && malas.length === 0, `barrido · ${n} combinaciones (eje × universo × conceptos): «por ventas» y el primero de mayor venta del grupo`, JSON.stringify(malas.slice(0, 6)));
    const { E: EI } = entregaDe({ partes: [{ id: "p1", tema: "inventario", cierre: "decision", conceptos: ["capital", "dias_inventario"], eje: "sku" }], criterio: { lente: "ventas" } });
    ok(EI.ok && !oracionesDe(EI).some((r) => /por ventas:/.test(r.texto)) && /ventas/.test(oracionesDe(EI).map((r) => r.texto).join(" ")), "inventario por SKU (sin venta): la lente ventas no ordena y se declara, nunca se sirve «por ventas»"); }

  /* ─ (f) N78 · una cifra conserva el rótulo de su concepto aunque otra clave comparta su valor ─ */
  H("A23 · 49f · N78 · ventas no se rotula «venta a crédito» aunque coincidan en valor (todas las claves que comparten valor: ventas · venta a crédito, saldo pendiente · saldo por vencer)");
  { let n = 0, malas = [];
    for (const cl of clientesMargen.slice(0, 13)) {
      const f = Mflujo.find((x) => x.nombre === cl.nombre); if (!f) continue;
      for (const [metrica, valor, rotulo] of [["ventas", f.ventaFmt, "venta"], ["venta_credito", f.ventaFmt, "venta a crédito"], ["saldo_pendiente", f.saldoFmt, "saldo pendiente"]]) {
        n++;   /* el valor es el que la mesa de flujo imprime (oráculo independiente) */
        const { R, E } = entregaDe({ partes: [{ id: "p1", tema: "comercial", cierre: "cifra", conceptos: ["ventas", "margen"], entidades: [{ nombre: cl.nombre }] }, { id: "p2", tema: "cobranza", cierre: "cifra", conceptos: ["saldo_vencido", "saldo_pendiente", "venta_credito"], entidades: [{ nombre: cl.nombre }] }], premisas: [{ id: "q1", tipo: "cifra", sujeto: cl.nombre, metrica, valor }] });
        const o = E.ok ? (E.entrega.respuesta || []).filter((r) => r._premisa === true).map((r) => r.texto).join(" | ") : "";
        const mm = new RegExp(`${cl.nombre.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}: (.+?) ${valor.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`, "i").exec(o);
        if (!(E.ok && mm && mm[1].trim().toLowerCase() === rotulo && verifica(E, R).ok)) malas.push(`${cl.nombre}.${metrica}:${mm && mm[1]}`);
      }
    }
    ok(n >= 35 && malas.length === 0, `barrido · ${n} premisas de cifra (cuentas × ventas · venta a crédito · saldo pendiente): el rótulo es el del concepto pedido`, JSON.stringify(malas.slice(0, 6)));
    const { E: E78 } = entregaDe({ partes: [{ id: "p2", tema: "comercial", cierre: "cifra", conceptos: ["ventas", "margen"], entidades: [{ nombre: "Lider" }] }, { id: "p3", tema: "cobranza", cierre: "cifra", conceptos: ["saldo_vencido", "dias_vencido"], entidades: [{ nombre: "Sodimac" }] }], premisas: [{ id: "q1", tipo: "cifra", sujeto: "Lider", metrica: "ventas", valor: "$17.8M" }] });
    const l78 = (E78.entrega.respuesta || []).filter((r) => r._premisa === true).map((r) => r.texto)[0] || "";
    ok(/es correcto — Lider: venta \$17\.8M\.$/.test(l78), "N78 · «Lider: venta $17.8M», no «venta a crédito»", l78);
    ok(!/es correcto — Lider: venta \$17\.8M\.$/.test(l78.replace("Lider: venta $", "Lider: venta a crédito $")), "CARNADA · el defecto reconstruido («Lider: venta a crédito $17.8M» para una premisa de ventas) cae"); }

  /* ─ (g) P74 · el corte entre Cifras y Detalle nunca parte una entidad ─ */
  H("A23 · 49g · P74 · el corte entre Cifras y Detalle nunca parte una entidad: sus filas van juntas (y un hecho cuyo valor es parte de otro número no protege su fila)");
  { const clave = (f) => { const v = f.valores || {}; return `${v["Entidad / grupo"]}::${v.Tema}`; };
    const partidas = (E) => { const c = new Set(filasCifras(E).map(clave)), d = new Set(filasDetalle(E).map(clave)); return [...c].filter((k) => d.has(k)); };
    const P = { sku2: { tema: "comercial", eje: "sku", conceptos: ["ventas", "unidades"] }, cli2: { tema: "comercial", eje: "cliente", conceptos: ["ventas", "margen"] }, marca3: { tema: "comercial", eje: "marca", conceptos: ["ventas", "margen", "unidades"] }, cob2: { tema: "cobranza", conceptos: ["saldo_pendiente", "recuperado"] }, cob3: { tema: "cobranza", conceptos: ["saldo_vencido", "dias_vencido", "abonado"] }, inv2: { tema: "inventario", eje: "sku", conceptos: ["capital", "dias_inventario"] } };
    let n = 0, malas = [];
    for (const ks of [["sku2"], ["cli2"], ["marca3"], ["cob2"], ["sku2", "cob2"], ["sku2", "cli2"], ["cli2", "cob2"], ["sku2", "cob3"], ["marca3", "cob2"], ["cli2", "inv2"], ["sku2", "cli2", "cob2"], ["sku2", "cob2", "inv2"]]) for (const prof of ["completa", "breve"]) {
      const tope = prof === "breve" ? 8 : 24; const porGrupo = new Map(); for (const k of ks) { const g = `${P[k].tema}:${P[k].eje || ""}`; porGrupo.set(g, (porGrupo.get(g) || 0) + P[k].conceptos.length); }
      if ([...porGrupo.values()].reduce((a, b) => a + b, 0) > tope) continue;   /* el tope de filas no alcanza ni para una entidad entera por grupo: el corte es forzado */
      n++; const { R, E } = entregaDe({ partes: ks.map((k, i) => ({ id: `p${i + 1}`, tema: P[k].tema, cierre: "cifra", conceptos: P[k].conceptos, ...(P[k].eje ? { eje: P[k].eje } : {}) })), profundidad: prof });
      if (!(E.ok && partidas(E).length === 0 && verifica(E, R, prof).ok)) malas.push(`${ks.join("+")}.${prof}:${partidas(E).slice(0, 2)}`);
    }
    ok(n >= 18 && malas.length === 0, `barrido · ${n} combinaciones (1-3 partes de eje completo × profundidad): ninguna entidad queda en Cifras y en Detalle a la vez`, JSON.stringify(malas.slice(0, 6)));
    const { R: R74, E: E74 } = entregaDe({ partes: [{ id: "p1", tema: "comercial", cierre: "cifra", conceptos: ["ventas", "unidades"], eje: "sku" }, { id: "p2", tema: "cobranza", cierre: "cifra", conceptos: ["saldo_pendiente", "recuperado"] }], premisas: [{ id: "q1", tipo: "orden", sujeto: "SAM-TV55", metrica: "ventas", orden: { forma: "max" }, universo: { eje: "sku" } }, { id: "q2", tipo: "orden", sujeto: "Lider", metrica: "saldo_pendiente", orden: { forma: "max" }, universo: { eje: "cliente" } }] });
    const ordenSku = filasCifras(E74).concat(filasDetalle(E74)).filter((f) => f.valores.Tema === "comercial" && /^Venta$/.test(f.valores["Métrica"])).map((f) => f.valores["Entidad / grupo"]);
    const esperado = skusMargen.slice().sort((a, b) => b.venta - a.venta).map((x) => x.nombre);
    ok(E74.ok && partidas(E74).length === 0 && JSON.stringify(ordenSku) === JSON.stringify(esperado) && verifica(E74, R74).ok, "P74 · 13 SKU por venta + 13 cuentas: ninguna entidad partida y el orden exhibido de los SKU es el de la venta (MAK-COMP-AIR no se cuela antes por un «4» de otro número)", JSON.stringify({ partidas: partidas(E74), ordenSku }));
    /* la carnada: se parte una entidad a mano (su segunda fila al Detalle) */
    const f0 = filasCifras(E74)[0]; const k0 = clave(f0);
    const partida = { ...E74, entrega: { ...E74.entrega, cifras: { ...E74.entrega.cifras, filas: filasCifras(E74).filter((f, i) => !(clave(f) === k0 && i === 1)) }, detalle: { ...(E74.entrega.detalle || {}), filas: [filasCifras(E74)[1], ...filasDetalle(E74)] } } };
    ok(partidas(E74).length === 0 && partidas(partida).length === 1, "CARNADA · el defecto reconstruido (la segunda fila de una entidad va al Detalle y la primera queda en Cifras) cae"); }

  /* ─ el «techo de quiebre» (N39) y el Marco de una Entrega solo de cobranza ─ */
  H("A23 · 49 · N39 · el criterio aplicado de una premisa dice TODOS los umbrales de su estado (también «techo de quiebre 20 días»); y el Marco de una Entrega solo de cobranza no habla de inventario");
  { let n = 0, malas = [];
    const num = (v) => String(v).replace(/\.0+$/, "");
    for (const estado of ["riesgo de quiebre", "sobrestock", "inmovilizado critico", "capital sano"]) for (const tipo of ["grupo", "conteo"]) for (const top of [false, true]) {
      const U = { eje: "sku", estados: [estado], ...(top ? { top: { metrica: "ventas", k: 3 } } : {}) };
      const premisa = tipo === "grupo" ? { id: "q1", tipo, miembros: ["PHI-IRON-PRO"], universo: U } : { id: "q1", tipo, conteo: { n: 2, m: 8 }, de: U };
      const { R, E } = entregaDe({ partes: [{ id: "p1", tema: "comercial", cierre: "cifra", conceptos: ["ventas"], eje: "sku" }], premisas: [premisa] }); n++;
      const H1 = E.ok ? E.entrega.procedencia.libroPremisas.porId.get("q1") : null; const o = E.ok ? (E.entrega.respuesta || []).filter((r) => r._premisa === true).map((r) => r.texto).join(" | ") : "";
      const faltan = H1 && (H1.veredicto === "verdadera" || H1.veredicto === "falsa") ? (UMBRALES_DE_ESTADO[estado] || []).filter((k) => { const v = umbral(k).valor; return Number.isFinite(v) && !new RegExp(`(?<![\\d.,])${num(v)}(?![\\d])`).test(o); }) : [];
      if (!(E.ok && faltan.length === 0 && verifica(E, R).ok)) malas.push(`${estado}.${tipo}.${top ? "top" : "sin"}:${faltan}`);
    }
    ok(n === 16 && malas.length === 0, `barrido · ${n} premisas (estado × tipo × top): cada umbral del estado se dice en la oración`, JSON.stringify(malas.slice(0, 4)));
    const { E: E39 } = entregaDe({ partes: [{ id: "p1", tema: "comercial", cierre: "cifra", conceptos: ["ventas"], eje: "sku" }], premisas: [{ id: "q5", tipo: "grupo", miembros: ["PHI-IRON-PRO"], universo: { eje: "sku", estados: ["sin venta"], no_estados: ["riesgo de quiebre"], filtros: [{ metrica: "dias_inventario", op: ">", valor: 20 }], top: { metrica: "ventas", k: 3 } } }] });
    const l39 = (E39.entrega.respuesta || []).filter((r) => r._premisa === true).map((r) => r.texto).join(" | ");
    ok(/criterio aplicado: piso de quiebre 6\.0x; techo de quiebre 20 días/.test(l39), "N39 · «criterio aplicado: piso de quiebre 6.0x; techo de quiebre 20 días» (el otro umbral del conjunto no queda solo en el Marco)", l39);
    let nc = 0, malasC = [];
    for (const conc of [["saldo_vencido", "dias_vencido"], ["abonado", "recuperado"]]) for (const cierre of ["cifra", "lectura", "decision"]) for (const uni of [null, { top: { metrica: "saldo_vencido", k: 5 } }, { estados: ["en mora"] }]) for (const prof of ["completa", "breve"]) {
      nc++; const { E } = entregaDe({ partes: [{ id: "p1", tema: "cobranza", cierre, conceptos: conc, ...(uni ? { universo: { eje: "cliente", ...uni } } : {}) }], profundidad: prof });
      const marco = (/\*\*Marco\.\*\*[^\n]*/.exec(E.texto || "") || [""])[0];
      if (!(E.ok && !/inventario|dos marcos|tres marcos/i.test(marco))) malasC.push(`${conc.join("+")}.${cierre}.${uni ? Object.keys(uni)[0] : "sin"}.${prof}`);
    }
    ok(nc === 36 && malasC.length === 0, `barrido · ${nc} Entregas solo de cobranza (conceptos × cierre × universo × profundidad): el Marco es «foto de cobranza al …», sin «dos marcos» ni «foto de inventario»`, JSON.stringify(malasC.slice(0, 4)));
    const { E: EC } = entregaDe({ partes: [{ id: "p1", tema: "cobranza", cierre: "lectura", conceptos: ["saldo_vencido", "dias_vencido"] }] });
    const marcoC = (/\*\*Marco\.\*\*[^\n]*/.exec(EC.texto || "") || [""])[0];
    ok(/foto de cobranza al /.test(marcoC) && !/inventario/.test(marcoC) && /inventario/.test(marcoC.replace("foto de cobranza", "foto de inventario")), "CARNADA · el defecto reconstruido («dos marcos… foto de inventario a hoy» en una Entrega solo de cobranza) cae"); }
}

/* ═══ A24 · CORRECCIÓN DE LAS MEDICIONES v25 y v26 (corrector de v49; §7.3·50) ═══════════════════════════════════════════════════════════════════════════
 * «Una prioridad nunca corona al mejor»: un grupo de una `decision` se ordenaba por su medida propia de MENOR a mayor cuando más es peor (la carga: «por carga comercial (el criterio pedido, crecimiento, no ordena este grupo): LG, con 3.2 %» abría
 * con la cuenta de MENOS carga, la mejor). La ley (50a), que rige solo la ORACIÓN de prioridad (el orden de las listas es el de su productor, 45a): con la medida de una LENTE la prioridad va de MAYOR a menor; con la medida PROPIA va primero lo que pide atención según la polaridad del léxico
 * (donde más es peor, el mayor); una MAGNITUD (dinero o unidades: ventas, contribución, unidades, saldo) va de mayor a menor aunque más sea mejor, y solo una TASA o RAZÓN con polaridad «mayor» (margen, rotación, recuperado) invierte: el menor. Oráculos INDEPENDIENTES del código que se corrige: la tabla de polaridades de abajo (escrita a mano desde la ley), el dato del tenant por productor (`queryMetric`, `skuInventario`) y la mesa de flujo; nunca la Entrega.
 *   (a) MATRIZ lente × dominio·eje × forma del grupo (entidades nombradas · top · foto) × métrica PROPIA (con su polaridad) × cierre: el primero que nombra la ORACIÓN de prioridad es el que pide atención por la medida nombrada.
 *   (c) LA CABEZA de una lectura con varias partes cita solo las entidades que caben ENTERAS (ninguna partida entre Cifras y Detalle) y el resto se declara («N filas más en el detalle»).
 *   (d) LOS DOS RESIDUOS de la 49(d): el capital inmovilizado crítico por familia (rotulado «… · Familia» por su productor) se reconoce como concepto, y la premisa de orden sobre «carga comercial alta» en el eje cliente se juzga (la ausencia es cero).
 *   Cada familia trae su CARNADA: el defecto, reconstruido, cae. */
{
  const Mflujo = buildMesaFlujo(ESCENARIO_INICIAL).filas;
  const qm = (dimension, metric) => new Map(((TOOLS.queryMetric({ metric, dimension, scenario: ESCENARIO_INICIAL }) || {}).boleta || []).map((f) => [String(f.label).split(" · ")[0], f.raw]));
  const verifica = (E, R, prof = "completa") => { try { return verificarEntrega({ texto: E.texto, entrega: E.entrega, profundidad: prof, resolucion: R, indice: (E.entrega.procedencia && E.entrega.procedencia.libro && E.entrega.procedencia.libro.indice) || null }); } catch (x) { return { ok: false, violaciones: [{ regla: "excepcion", detalle: String(x && x.message) }] }; } };
  const filasCifras = (E) => ((E.entrega && E.entrega.cifras && E.entrega.cifras.filas) || []);
  const filasDetalle = (E) => ((E.entrega && E.entrega.detalle && E.entrega.detalle.filas) || []);
  const respuestaDe = (E) => ((E.entrega && E.entrega.respuesta) || []).filter((r) => r && typeof r.texto === "string" && !r._premisa).map((r) => r.texto.replace(/^▸\s*/, ""));
  /* la polaridad de la ley, a mano: «mayor» = más es mejor · «menor» = más es peor · null = sin polaridad (quien más pesa) */
  const TASA = new Set(["margen", "rotacion", "recuperado"]);   /* a mano, del oráculo: las tasas y razones (porcentaje, ratio); el resto son magnitudes (dinero, unidades) */
  const POL = { ventas: "mayor", margen: "mayor", unidades: "mayor", contribucion: "mayor", carga: "menor", rotacion: "mayor", dias_sin_venta: "menor", dias_inventario: "menor", capital: null, saldo_vencido: "menor", dias_vencido: "menor", abonado: "mayor", recuperado: "mayor", saldo_pendiente: "menor", venta_credito: "mayor" };
  const DE_ROTULO = { "venta": "ventas", "ventas": "ventas", "venta (flujo)": "venta_credito", "margen": "margen", "carga comercial": "carga", "contribución": "contribucion", "unidades vendidas": "unidades", "capital": "capital", "capital inmovilizado crítico": "capital_frenado", "capital inmovilizado": "capital_frenado", "días sin venta": "dias_sin_venta", "días de inventario": "dias_inventario", "rotación": "rotacion", "saldo vencido": "saldo_vencido", "días vencido": "dias_vencido", "abonado": "abonado", "recuperado": "recuperado", "saldo pendiente": "saldo_pendiente" };
  /* la medida de cada lente (su nombre visible → las claves que lee): con ella el primero es el MAYOR */
  const LENTE = { credito: { visible: "exposición de crédito", claves: ["saldo_vencido"] }, capital: { visible: "capital", claves: ["capital_frenado"] }, contribucion: { visible: "contribución", claves: ["no_capturada"] }, ventas: { visible: "ventas", claves: ["ventas", "venta_credito"] } };
  const capFrenado = (n) => { const s = skuInventario.find((x) => x.sku === n); return s.rotacion < 2.0 ? s.stockUSD : 0; };
  const noCapt = (n) => { const c = clientesMargen.find((x) => x.nombre === n); return Math.max(0, Math.round((c.venta * 30.1 / 100 - c.contribucion) * 10) / 10); };
  const cC = { ventas: qm("cliente", "ventas"), margen: qm("cliente", "margen"), carga: qm("cliente", "carga"), contribucion: qm("cliente", "contribucion"), unidades: qm("cliente", "unidades") };
  const cM = { ventas: qm("marca", "ventas"), margen: qm("marca", "margen"), carga: qm("marca", "carga"), contribucion: qm("marca", "contribucion"), unidades: qm("marca", "unidades") };
  const cF = { ventas: qm("familia", "ventas"), margen: qm("familia", "margen"), carga: qm("familia", "carga"), contribucion: qm("familia", "contribucion") };
  const cS = { ventas: qm("sku", "ventas"), margen: qm("sku", "margen"), carga: qm("sku", "carga"), contribucion: qm("sku", "contribucion"), unidades: qm("sku", "unidades") };
  const DOMS = {
    "cobranza·cliente": { tema: "cobranza", eje: "cliente", explicito: false, ents: ["Lider", "Tottus", "Sodimac", "Easy"], top: { metrica: "saldo_vencido", k: 5 }, val: { saldo_vencido: (n) => Mflujo.find((x) => x.nombre === n).vencidoK, dias_vencido: (n) => Mflujo.find((x) => x.nombre === n).diasVencido, abonado: (n) => Mflujo.find((x) => x.nombre === n).abonadoK, recuperado: (n) => Mflujo.find((x) => x.nombre === n).recuperadoPct, saldo_pendiente: (n) => Mflujo.find((x) => x.nombre === n).saldoK, venta_credito: (n) => Mflujo.find((x) => x.nombre === n).ventaK } },
    "comercial·cliente": { tema: "comercial", eje: "cliente", explicito: false, ents: ["Falabella", "Lider", "Jumbo", "Ripley"], top: { metrica: "ventas", k: 5 }, val: { ...Object.fromEntries(Object.entries(cC).map(([k, m]) => [k, (n) => m.get(n)])), no_capturada: noCapt } },
    "comercial·marca": { tema: "comercial", eje: "marca", explicito: true, ents: ["Samsung", "LG", "Philips", "Bosch"], top: { metrica: "ventas", k: 4 }, val: Object.fromEntries(Object.entries(cM).map(([k, m]) => [k, (n) => m.get(n)])) },
    "comercial·familia": { tema: "comercial", eje: "familia", explicito: true, ents: ["Electrodomésticos", "Línea Blanca", "Cuidado Personal", "Materiales de Construcción"], top: { metrica: "ventas", k: 3 }, val: Object.fromEntries(Object.entries(cF).map(([k, m]) => [k, (n) => m.get(n)])) },
    "comercial·sku": { tema: "comercial", eje: "sku", explicito: true, ents: ["SAM-TV55", "LG-WASH11KG", "PHI-SHAVER9", "BOS-SANDER"], top: { metrica: "ventas", k: 5 }, val: Object.fromEntries(Object.entries(cS).map(([k, m]) => [k, (n) => m.get(n)])) },
    "inventario·sku": { tema: "inventario", eje: "sku", explicito: false, ents: ["LG-DRYER8KG", "MAK-COMP-AIR", "BOS-SANDER", "SAM-REF500L"], top: { metrica: "capital", k: 5 }, val: { capital: (n) => skuInventario.find((x) => x.sku === n).stockUSD, capital_frenado: capFrenado, dias_sin_venta: (n) => skuInventario.find((x) => x.sku === n).diasSinVenta, dias_inventario: (n) => skuInventario.find((x) => x.sku === n).doh, rotacion: (n) => skuInventario.find((x) => x.sku === n).rotacion } },
  };
  const CONCEPTOS = { "cobranza·cliente": ["saldo_vencido", "dias_vencido", "abonado", "recuperado"], "comercial·cliente": ["ventas", "margen", "carga", "contribucion"], "comercial·marca": ["ventas", "margen", "carga"], "comercial·familia": ["margen", "carga"], "comercial·sku": ["ventas", "margen", "carga"], "inventario·sku": ["capital_frenado", "dias_sin_venta", "rotacion"] };
  const LENTES = [null, "riesgo", "credito", "capital", "contribucion", "ventas", "crecimiento"];
  /* el extremo de atención de un conjunto por una medida: el MAYOR (lente · polaridad «menor» · sin polaridad) o el MENOR (propia con polaridad «mayor») */
  const extremo = (D, clave, miembros, deLente) => {
    const vals = miembros.map((n) => ({ n, v: D.val[clave] ? D.val[clave](n) : NaN })).filter((x) => Number.isFinite(x.v));
    if (vals.length < 2 || vals.every((x) => x.v === vals[0].v)) return null;
    const menor = !deLente && POL[clave] === "mayor" && TASA.has(clave);
    const ext = menor ? Math.min(...vals.map((x) => x.v)) : Math.max(...vals.map((x) => x.v));
    return vals.filter((x) => x.v === ext).map((x) => x.n);
  };
  const RE_PRI = /^Prioridad del procedimiento dentro de este grupo, por ([^:]+?): (.+?), con (.+?) en (.+?)\.$/;
  const RE_CAB = /^(?:El top \d+ de \d+ \w+[^,]*?|Por \w+[^,]*?), ordenado por ([^:]+): (.+?)\.(?: Empate.*)?$/;
  /* el veredicto de la ley sobre una Entrega: las violaciones (vacío = cumple) — el mismo juez para la Entrega real y para la carnada */
  const juzga = (E, D, lente, forma, miembros) => {
    const malas = [];
    for (const t of respuestaDe(E)) {
      const p = RE_PRI.exec(t);
      if (p && !/ninguna cuenta queda primera/.test(t)) {
        const clave = DE_ROTULO[p[4].trim().toLowerCase()] || (p[4].trim().toLowerCase() === "contribución no capturada" ? "no_capturada" : null);
        const deLente = !!(lente && LENTE[lente] && p[1].replace(/\s*\(.*$/, "").trim().toLowerCase() === LENTE[lente].visible && LENTE[lente].claves.includes(clave));
        const ex = clave ? extremo(D, clave, miembros, deLente) : null;
        if (ex && !ex.includes(p[2].trim())) malas.push(`prioridad:${p[2].trim()}≠${ex.join("/")}(${clave}${deLente ? ",lente" : ""})`);
      }
    }
    return malas;
  };

  /* ─ (a) la matriz ─ */
  H("A24 · 50a · la ORACIÓN de PRIORIDAD PIDE ATENCIÓN: con la medida de una lente o una magnitud el mayor; con una tasa (margen, rotación), el menor; nunca corona al mejor — matriz lente × dominio·eje × forma × métrica × cierre");
  { let n = 0, sentencias = 0; const malas = [];
    for (const [dk, D] of Object.entries(DOMS)) for (const clave of CONCEPTOS[dk]) for (const forma of ["entidades", "top", "foto"]) for (const lente of LENTES) for (const cierre of ["decision", "lectura"]) {
      if (cierre === "lectura" && lente) continue;
      if (forma === "top" && !D.top) continue;
      const base = { id: "p1", tema: D.tema, cierre, conceptos: [clave], ...(D.explicito ? { eje: D.eje } : {}) };
      const parte = forma === "entidades" ? { ...base, entidades: D.ents.map((x) => ({ nombre: x, ...(D.eje !== "cliente" ? { eje: D.eje } : {}) })) } : forma === "top" ? { ...base, universo: { eje: D.eje, top: D.top } } : base;
      n++;
      const { R, E } = entregaDe({ partes: [parte], ...(lente ? { criterio: { lente } } : {}) });
      if (!E.ok) { malas.push(`${dk}.${clave}.${forma}.${lente || "sin"}.${cierre}:declinada`); continue; }
      const u = (((E.entrega && E.entrega.universos) || []).find((x) => x.id === "p1" && x.soloRanking !== true) || {}).entidades || [];
      const miembros = forma === "entidades" ? D.ents : u;
      const m = juzga(E, D, lente, forma, miembros);
      sentencias += respuestaDe(E).filter((t) => RE_PRI.test(t)).length;
      if (m.length) malas.push(`${dk}.${clave}.${forma}.${lente || "sin"}.${cierre}:${m[0]}`);
      if (!verifica(E, R).ok) malas.push(`${dk}.${clave}.${forma}.${lente || "sin"}.${cierre}:verificarEntrega`);
    }
    ok(n >= 300 && sentencias >= 100 && malas.length === 0, `barrido · ${n} Entregas (${sentencias} oraciones de prioridad): ninguna corona al mejor`, JSON.stringify(malas.slice(0, 5)));
    /* el caso del corrector: la carga comercial de las marcas (la foto del eje), con «crecimiento» pedido (la lente no ordena el grupo): abre con la marca de MAYOR carga, no con la de menos */
    const marcas = marcasMargen.map((x) => x.nombre), Dm0 = { ...DOMS["comercial·marca"], ents: marcas };
    const { R: Rc, E: Ec } = entregaDe({ partes: [{ id: "p1", tema: "comercial", cierre: "decision", conceptos: ["carga"], eje: "marca" }], criterio: { lente: "credito" } });   /* §7.3·56: «crecimiento» ya aplica a una parte comercial por marca; la lente que se DECLARA aquí es «exposición de crédito» (de cobranza) */
    const mayorCarga = extremo(Dm0, "carga", marcas, false), menorCarga = marcas.slice().sort((a, b) => cM.carga.get(a) - cM.carga.get(b))[0];
    const oc = respuestaDe(Ec).find((t) => RE_PRI.test(t)) || "";
    ok(mayorCarga && !mayorCarga.includes(menorCarga) && RE_PRI.test(oc) && mayorCarga.includes(RE_PRI.exec(oc)[2].trim()) && /el criterio pedido, exposición de crédito/.test(oc) && verifica(Ec, Rc).ok, "50a · el caso del corrector: «por carga comercial (el criterio pedido, exposición de crédito, …)» nombra a la marca de MÁS carga, no a la de menos", oc);
    /* CARNADA · el defecto reconstruido: la prioridad que corona a la cuenta de MENOS carga (la mejor) cae en el mismo juez */
    const Dm = Dm0, malo = { ...Ec, texto: Ec.texto, entrega: { ...Ec.entrega, respuesta: (Ec.entrega.respuesta || []).map((r) => (RE_PRI.test(String(r.texto).replace(/^▸\s*/, "")) ? { ...r, texto: r.texto.replace(RE_PRI.exec(r.texto.replace(/^▸\s*/, ""))[2], menorCarga) } : r)) } };
    ok(juzga(Ec, Dm, "credito", "foto", Dm.ents).length === 0 && juzga(malo, Dm, "credito", "foto", Dm.ents).length > 0, "CARNADA · el defecto reconstruido (la prioridad abre con la cuenta de MENOS carga, la mejor) cae en el juez de la matriz");
    /* donde más es mejor (margen, rotación) el primero es el MENOR; con la lente ventas pedida, el MAYOR (la medida de la lente) */
    const Dc = DOMS["comercial·marca"];
    const { E: Em } = entregaDe({ partes: [{ id: "p1", tema: "comercial", cierre: "decision", conceptos: ["margen"], eje: "marca", entidades: Dc.ents.map((x) => ({ nombre: x, eje: "marca" })) }] });
    const om = respuestaDe(Em).find((t) => RE_PRI.test(t)) || "";
    const menorMargen = extremo(Dc, "margen", Dc.ents, false);
    ok(menorMargen && RE_PRI.test(om) && menorMargen.includes(RE_PRI.exec(om)[2].trim()) && Dc.ents.slice().sort((a, b) => cM.margen.get(a) - cM.margen.get(b))[0] === RE_PRI.exec(om)[2].trim(), "50a · donde más es mejor (margen) la prioridad abre con el de MENOR margen", om);
    const { E: Ev } = entregaDe({ partes: [{ id: "p1", tema: "comercial", cierre: "decision", conceptos: ["ventas"], eje: "marca", entidades: Dc.ents.map((x) => ({ nombre: x, eje: "marca" })) }], criterio: { lente: "ventas" } });
    const ov = respuestaDe(Ev).find((t) => RE_PRI.test(t)) || "";
    ok(RE_PRI.test(ov) && Dc.ents.slice().sort((a, b) => cM.ventas.get(b) - cM.ventas.get(a))[0] === RE_PRI.exec(ov)[2].trim(), "50a · con la medida de una LENTE (ventas) la prioridad va de MAYOR a menor", ov); }

  /* ─ (c) la cabeza de una lectura con varias partes cita solo lo que cabe entero ─ */
  H("A24 · 50c · la cabeza de una lectura con varias partes cita solo las entidades que caben ENTERAS y el resto se declara (ninguna entidad citada queda partida entre Cifras y Detalle)");
  { const PARTES = { A: { tema: "cobranza", conceptos: ["saldo_vencido", "dias_vencido"] }, B: { tema: "comercial", conceptos: ["contribucion", "margen"] }, C: { tema: "inventario", conceptos: ["capital_frenado", "dias_sin_venta"] }, D: { tema: "comercial", eje: "marca", conceptos: ["ventas", "margen"] }, E: { tema: "comercial", eje: "familia", conceptos: ["ventas", "margen"] }, F: { tema: "comercial", eje: "sku", conceptos: ["ventas", "margen"] }, G: { tema: "inventario", conceptos: ["capital", "dias_inventario"], universo: { eje: "sku", top: { metrica: "capital", k: 5 } } }, H: { tema: "cobranza", conceptos: ["abonado", "recuperado"], universo: { eje: "cliente", top: { metrica: "saldo_vencido", k: 5 } } } };
    const claves = Object.keys(PARTES), subs = [];
    for (let i = 0; i < claves.length; i++) for (let j = i + 1; j < claves.length; j++) { subs.push([claves[i], claves[j]]); for (let k = j + 1; k < claves.length; k++) { subs.push([claves[i], claves[j], claves[k]]); for (let l = k + 1; l < claves.length; l++) if ((i + j + k + l) % 4 === 0) subs.push([claves[i], claves[j], claves[k], claves[l]]); } }
    const citadasDe = (E) => { const out = []; for (const r of (E.entrega.respuesta || [])) { const m = /^(?:El top \d+ de \d+ \w+[^,]*?|Por \w+[^,]*?), ordenado por ([^:]+): (.+?)\.(?: Empate.*)?$/.exec(r.texto.replace(/^▸\s*/, "")); if (m) out.push(m[2].split(/,\s*(?=[A-ZÁÉÍÓÚ0-9])/).map((x) => x.replace(/\s*\(.*$/, "").trim()).filter(Boolean)); } return out; };
    /* las entidades que una cabeza de DOS o más cita y que quedan partidas (alguna de sus filas en el Detalle mientras otra va en Cifras): la cabeza PODÍA citar menos */
    const partidas = (E) => { const enC = new Set(filasCifras(E).map((f) => `${f.valores["Entidad / grupo"]}::${f.valores.Tema}`)), enD = new Set(filasDetalle(E).map((f) => `${f.valores["Entidad / grupo"]}::${f.valores.Tema}`)); const cit = new Set(((E.entrega && E.entrega.respuesta) || []).filter((r) => r._entidadesCitadas && r._entidadesCitadas.nombres.length > 1).flatMap((r) => r._entidadesCitadas.nombres.map((n) => `${n}::${r._entidadesCitadas.tema}`))); return [...enC].filter((k) => enD.has(k) && cit.has(k)); };
    const sinFila = (E) => { const enC = new Set(filasCifras(E).map((f) => f.valores["Entidad / grupo"])); return citadasDe(E).flat().filter((n) => !enC.has(n)); };
    let n = 0, cabezas = 0; const malas = [];
    for (const sub of subs) for (const cierre of ["lectura", "decision"]) for (const prof of ["completa", "breve"]) {
      n++; const { R, E } = entregaDe({ partes: sub.map((k, i) => ({ id: `p${i + 1}`, cierre, ...PARTES[k] })), profundidad: prof });
      if (!E.ok) { malas.push(`${sub.join("")}.${cierre}.${prof}:declinada`); continue; }
      cabezas += citadasDe(E).length;
      const et = `${sub.join("")}.${cierre}.${prof}`;
      if (!verifica(E, R, prof).ok) malas.push(`${et}:verificarEntrega`);
      if (partidas(E).length) malas.push(`${et}:partida ${partidas(E)[0]}`);
      if (sinFila(E).length) malas.push(`${et}:sin fila ${sinFila(E)[0]}`);
      if (filasDetalle(E).length && !/m[aá]s en el detalle/i.test(String(E.texto || ""))) malas.push(`${et}:el resto no se declara`);
    }
    ok(n >= 200 && cabezas >= 400 && malas.length === 0, `barrido · ${n} lecturas/decisiones de 2 a 4 partes × profundidad (${cabezas} cabezas): ninguna entidad citada queda partida ni sin fila, y el resto se declara`, JSON.stringify(malas.slice(0, 5)));
    /* el caso: dos partes (cobranza y comercial por cuenta) en completa: la cabeza cita las cuentas cuyas filas caben enteras (antes citaba tres y dejaba sus segundas cifras en el Detalle) */
    const { E: E2 } = entregaDe({ partes: [{ id: "p1", tema: "cobranza", cierre: "lectura", conceptos: ["saldo_vencido", "dias_vencido"] }, { id: "p2", tema: "comercial", cierre: "lectura", conceptos: ["contribucion", "margen"] }] });
    ok(E2.ok && partidas(E2).length === 0 && sinFila(E2).length === 0 && citadasDe(E2).every((c) => c.length >= 1), "50c · cobranza y comercial por cuenta en completa: cada cuenta que la cabeza cita trae TODAS sus filas en Cifras", JSON.stringify({ partidas: partidas(E2), cabezas: citadasDe(E2) }));
    /* CARNADA · el defecto reconstruido: una cabeza que cita una cuenta con una de sus filas en Cifras y otra en el Detalle cae en el mismo juez */
    const cit = citadasDe(E2).find((c) => c.length >= 1);
    const fila = filasCifras(E2).find((x) => x.valores["Entidad / grupo"] === cit[0]);
    const partido = { entrega: { respuesta: [{ texto: `Por cliente, ordenado por Margen: ${cit[0]} (1%), Otra (2%).`, _entidadesCitadas: { nombres: [cit[0], "Otra"], tema: fila.valores.Tema } }], cifras: { filas: [fila] }, detalle: { filas: [{ ...fila }] } } };
    ok(partidas(E2).length === 0 && partidas(partido).length > 0, "CARNADA · el defecto reconstruido (la cabeza cita una cuenta y una de sus filas está en el Detalle) cae en el mismo juez"); }

  /* ─ (d) los dos residuos de la 49(d) ─ */
  H("A24 · 50d · el capital inmovilizado crítico por familia se reconoce como concepto y la premisa de orden sobre «carga comercial alta» (eje cliente) se juzga: la ausencia es cero");
  { const encP = (premisas) => entregaDe({ partes: [{ id: "p1", tema: "comercial", cierre: "cifra", conceptos: ["ventas"], entidades: [{ nombre: "Lider" }] }], premisas });
    const hechoDe = (E, id) => (E.ok && E.entrega.procedencia.libroPremisas ? E.entrega.procedencia.libroPremisas.porId.get(id) : null);
    const juzgada = (H1) => !!H1 && (H1.veredicto === "verdadera" || H1.veredicto === "falsa");
    const famCapital = (n) => skuInventario.filter((s) => s.sfamilia === n && s.rotacion < 2.0).reduce((a, s) => a + s.stockUSD, 0);
    const fams = [...new Set(skuInventario.map((s) => s.sfamilia))], conCapital = fams.filter((f) => famCapital(f) > 0), sinCapital = fams.filter((f) => famCapital(f) === 0);
    const { R: R1, E: E1 } = encP([{ id: "q1", tipo: "orden", sujeto: conCapital.slice().sort((a, b) => famCapital(b) - famCapital(a))[0], metrica: "capital_frenado", orden: { forma: "max" }, universo: { eje: "familia" } }]);
    ok(E1.ok && hechoDe(E1, "q1") && hechoDe(E1, "q1").veredicto === "verdadera" && verifica(E1, R1).ok, "50d · «la familia con más capital inmovilizado crítico es la que lo trae»: verdadera con la evidencia por familia (rotulada «… · Familia» por su productor)", JSON.stringify(hechoDe(E1, "q1") && [hechoDe(E1, "q1").veredicto, hechoDe(E1, "q1").motivo]));
    if (sinCapital.length) { const { R: R2, E: E2b } = encP([{ id: "q1", tipo: "orden", sujeto: sinCapital[0], metrica: "capital_frenado", orden: { forma: "max" }, universo: { eje: "familia" } }]);
      ok(E2b.ok && hechoDe(E2b, "q1") && hechoDe(E2b, "q1").veredicto === "falsa" && /\$0/.test(E2b.texto) && verifica(E2b, R2).ok, "50d · la familia SIN capital inmovilizado crítico vale $0 (la ausencia es cero): «es la de más capital» es falsa, con su $0", JSON.stringify(hechoDe(E2b, "q1") && [hechoDe(E2b, "q1").veredicto, hechoDe(E2b, "q1").motivo])); }
    const { R: R3, E: E3 } = encP([{ id: "q1", tipo: "orden", sujeto: "Falabella", metrica: "carga_alta", orden: { forma: "max" }, universo: { eje: "cliente" } }]);
    ok(E3.ok && juzgada(hechoDe(E3, "q1")) && !/universo-incompleto/.test(String((hechoDe(E3, "q1") || {}).motivo)) && verifica(E3, R3).ok, "50d · «Falabella tiene la mayor carga comercial alta»: se juzga sobre el eje entero (las 8 cuentas que el detector no marca valen cero), no queda «universo incompleto»", JSON.stringify(hechoDe(E3, "q1") && [hechoDe(E3, "q1").veredicto, hechoDe(E3, "q1").motivo]));
    const { E: E4 } = encP([{ id: "q1", tipo: "orden", sujeto: "Lider", metrica: "carga_alta", orden: { forma: "max" }, universo: { eje: "cliente" } }]);
    ok(E4.ok && hechoDe(E4, "q1") && hechoDe(E4, "q1").veredicto === "falsa", "50d · «Lider tiene la mayor carga comercial alta» es falsa (la mayor es de otra cuenta)");
    /* el barrido de la 49(d) sin exclusiones: todo par (concepto, eje) con productor, en cinco tipos de premisa, se juzga */
    let n = 0; const malas = [];
    for (const [c, eje, sujeto, valor] of [["capital_frenado", "familia", fams[0], "$1.0M"], ["carga_alta", "cliente", "Falabella", "$100K"]]) {
      const casos = [{ tipo: "cifra", sujeto, metrica: c, valor }, { tipo: "orden", sujeto, metrica: c, orden: { forma: "max" }, universo: { eje } }, { tipo: "grupo", miembros: [sujeto], universo: { eje, top: { metrica: c, k: 3 } } }, { tipo: "conteo", conteo: { n: 1, m: 3 }, de: { eje, top: { metrica: c, k: 3 } } }];
      for (const p of casos) { n++; const { R, E } = encP([{ id: "q1", ...p }]); if (!(E.ok && verifica(E, R).ok)) malas.push(`${c}.${eje}.${p.tipo}:verificarEntrega`); if (p.tipo !== "cifra" && !juzgada(hechoDe(E, "q1"))) malas.push(`${c}.${eje}.${p.tipo}:${(hechoDe(E, "q1") || {}).veredicto}`); }
    }
    ok(n === 8 && malas.length === 0, `barrido · ${n} premisas (2 residuos × tipo): se juzgan y toda Entrega pasa verificarEntrega`, JSON.stringify(malas.slice(0, 4)));
    /* CARNADA · el defecto reconstruido: «no verificable» por universo incompleto no es un juicio */
    ok(juzgada(hechoDe(E3, "q1")) && !juzgada({ veredicto: "no-verificable", motivo: "universo-incompleto: la boleta trae «Carga comercial alta» de 5 de 13 clientes" }), "CARNADA · el defecto reconstruido (la premisa queda «no verificable» por universo incompleto) no cuenta como juzgada"); }
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
