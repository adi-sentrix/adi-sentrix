/* === _inventario_canon_gate.mjs · EL CANON VIGENTE DE INVENTARIO, JUZGADO POR EL NOTARIO (owner 2026-09-29,
 * cierre de las etapas 4-5 del rediseño) ═══════════════════════════════════════════════════════════════════════
 *
 * §7.3·34b/34d (contrato) exige pruebas NUEVAS para la definición VIGENTE de inmovilizado / inmovilizado crítico /
 * frenado — los corpus viejos de «frenado» (significado de rotación) quedan CONGELADOS aparte, como registro
 * histórico (`_ronda5_gate`, «hLG» en `fixtures/anclas-2026-09-17.json`, §7.3·34b). Este gate NO mide
 * `jerarquiaInventario()` en aislamiento — eso ya lo hace `_jerarquia_inventario_gate` (sin Notario, oráculo
 * independiente). Mide que el NOTARIO — el juez que de verdad recibe una afirmación y la contrasta contra la
 * evidencia del turno (`libroDeHechos`, `conjuntoDeUniverso`) — aprueba lo correcto y rechaza lo incorrecto sobre
 * el canon vigente, con evidencia REAL del tenant demo: el mismo `indice` que arma `_anclas_gate` (figs reales de
 * una pregunta real, corridas por el motor, + `indiceDeEvidencia`), nunca un objeto inventado a mano.
 *
 * BLOQUE (a) · EL CANON VIGENTE — hechos tipo "estado" (inmovilizado / inmovilizado crítico / «crítico» = la
 * alerta del archivo / frenado con umbral de la EMPRESA / frenado SIN umbral) y `conjuntoDeUniverso` directo (la
 * MISMA primitiva que usa el Notario para resolver un universo — `notario/verificar.js:_conteo` la llama con el
 * mismo nombre) para la intersección frenado ∩ inmovilizado.
 *
 * ⚠️ BUG REAL cazado al escribir «frenado con umbral de la EMPRESA» (cerrado acá, `notario/estados.js`, no una
 * consecuencia de la redefinición): `estados.js:verificar("frenado")` leía la KPI «Umbral de venta frenada» con
 * `_kpi(I, /^Umbral de venta frenada$/)` — un patrón con mayúscula inicial contra `conceptoNorm`, que SIEMPRE es
 * minúscula normalizada (mismo criterio que el resto de `_kpi(...)` en ese archivo: `/^piso de rotacion$/`, etc.).
 * El patrón NUNCA calzaba: «frenado» salía "no-verificable" SIEMPRE, incluso con la empresa declarando el umbral
 * en su perfil — el dato y el mecanismo de publicación (`datoProyectado.js`) estaban bien, el regex tenía el
 * `case` equivocado. Verificado que ningún gate de los 300 de `gates:offline` dependía del bug (ninguno, aparte
 * de `_jerarquia_inventario_gate` que llama `jerarquiaInventario()` directo, sin pasar por esta función, declara
 * `frenadoDiasSinVenta` en un perfil). Sección «frenado con umbral de la EMPRESA», abajo, es la carnada/prueba.
 *
 * BLOQUE (a2) · `frenado con umbral de la CONSULTA` (`criterio.referencia.umbral_frenado`, ETAPA 6, owner 2026-09-29,
 * §7.3·35) — CERRADO. Antes reportado (con `criterio.referencia:{umbral_frenado, 90}` y `universo.estados:["frenado"]`,
 * `componerEntrega` devolvía `ok:false`: la referencia de la consulta nunca llegaba al índice del Notario). Ahora el
 * umbral lo trae el encargo TIPADO (nunca un reconocedor sobre la pregunta) a `cifrasDelDato(escenario, consulta)`, de
 * ahí a `I.figs`/`I.estados` y a `estados.js:verificar("frenado")`; la Entrega lo declara en el Marco como «planteado en
 * la consulta», que vale solo para esa respuesta y nunca es un criterio de la empresa. Mismo patrón de §7.3·12/·19: si
 * la empresa YA declaró su umbral, manda el oficial y el de la consulta se declara aparte (`_REFERENCIA_FAMILIAS`).
 * Los oráculos son INDEPENDIENTES del motor: se calculan directo del archivo del tenant (`skuInventario.diasSinVenta`).
 * Frontera: «sobre el umbral» es ESTRICTO (`>`), igual que `jerarquiaInventario`, el glosario y la Entrega.
 *
 * BLOQUE (b) · LA GARANTÍA «HISTÓRICO, NO PRONÓSTICO» (§7.3·34d, precisada por la decisión del owner de §7.3·35: «Apruebo
 * A. La garantía queda en lo que ADI entrega antes del LLM. No abras B.») — la opción B (un tipo «proyección» en el
 * Notario) sigue DESCARTADA y este gate no toca al Notario para esto. La garantía NO es un veredicto sobre la prosa del
 * modelo: vive en lo que ADI ENTREGA. Los días sin venta, las unidades del período y la última venta viajan como hechos
 * tipados «históricos» (`figureType.js:HECHOS_HISTORICOS`): cada cifra con su naturaleza, su ventana (el período o los
 * días hasta la fecha de corte) y el límite «describe lo que pasó; no es un pronóstico» DENTRO de su `tipo`; la lectura
 * de inventario (`facts.historia`) y la Entrega (`marco.historicos`, filas) llevan lo mismo. Las pruebas de abajo miran
 * ESO —el tipo, la ventana, el límite, la ausencia de hechos de proyección— sobre la boleta de `inventoryStatus` y sobre
 * la Entrega de `componer.js`. NUNCA sobre el texto de un modelo y SIN listas de palabras.
 *
 * BLOQUE (c) · VOCABULARIO VISIBLE (etapa 6, tarea 1, §8.6 del diseño) — «frenado» queda SOLO para la venta interrumpida
 * con umbral; la regla de rotación se llama «inmovilizado crítico». Barrido estático de las superficies ya migradas
 * (no vuelven las frases viejas; son cadenas exactas de NUESTRO código, no prosa de un modelo).
 *
 * Solo por `npm run gates:offline` (o con el candado: node --import ./scripts/offline-guard.mjs
 * _inventario_canon_gate.mjs). Cero red. */
import { initTenant } from "./src/data/tenantStore.js";
import { TENANT_DEMO } from "./src/data/tenants/demo.js";
import { ESCENARIO_INICIAL } from "./src/config/scenarios.js";
import { cifrasDelDato } from "./src/adi/oracle/datoProyectado.js";
import { axisEntityNames } from "./src/adi/oracle/entityIndex.js";
import { runPlan } from "./src/adi/oracle/toolRunner.js";
import { TOOLS } from "./src/adi/oracle/toolRegistry.js";
import { cajaDelAgente } from "./src/adi/agente/herramientasAgente.js";
import { playbookPara, pasosDe } from "./src/adi/agente/playbooks/registro.js";
import { partesDelEncargo, pasosDelEncargo } from "./src/adi/agente/encargoCompuesto.js";
import { dominiosDe, pasosDeDominios, unirPasosDeDominios } from "./src/adi/agente/contratoDeDominios.js";
import { indiceDeEvidencia } from "./src/adi/notario/evidencia.js";
import { libroDeHechos, asignarIds } from "./src/adi/notario/hechos.js";
import { conjuntoDeUniverso } from "./src/adi/notario/verificar.js";
import { validarEncargo } from "./src/adi/encargo/validar.js";
import { componerEntrega } from "./src/adi/entrega/componer.js";
import { ETIQUETA_ORIGEN } from "./src/config/businessPolicy.js";
import { formatoDeLaCasa, nombrarUniverso } from "./src/adi/notario/hechos.js";
import { ESTADOS_DE_LA_CASA, FORMA_DE_ESTADO, formaDeEstado } from "./src/adi/notario/estados.js";
import { conteoDeEje, conPreposicion } from "./src/adi/notario/lexico.js";
import { CONJUNTOS_DE_LA_CASA } from "./src/adi/notario/conjuntosDeLaCasa.js";
import { HECHOS_HISTORICOS, LIMITE_HISTORICO, historicoDe, historiaDeFiguras } from "./src/config/contract/figureType.js";
import { fig as figDeBoleta } from "./src/adi/boleta.js";
import { clasificarFuente } from "./scripts/clasificarGates.mjs";
import { buildMesaCapital } from "./src/adi/sentrix/mesaCapital.js";
import { instruccionDeDeclaracion } from "./src/adi/notario/declaracion.js";
import { lecturasDe } from "./src/adi/encargo/lecturasDe.js";
import { getToolContract } from "./src/adi/oracle/toolContracts.js";
import fs from "node:fs";

let pass = 0, fail = 0;
const fails = [];
const ok = (c, m, extra = "") => { if (c) { pass++; console.log("  ✓ " + m); } else { fail++; fails.push(m); console.log("  ✗ " + m + (extra ? "\n      " + extra : "")); } };
const H = (t) => console.log(`\n${t}`);

initTenant(TENANT_DEMO);
const ejes = {};
for (const e of ["cliente", "sku", "marca", "familia", "bodega", "canal"]) { try { const n = axisEntityNames(e); if (n && n.length) ejes[e] = n; } catch { /* sin índice */ } }
const CAJA = cajaDelAgente(TOOLS);
/* el MISMO mecanismo que ya usa `_anclas_gate.mjs`: figs reales, producidas por el motor de verdad para una
 * pregunta real del demo — nunca una fig inventada a mano. */
const figsDe = (pregunta) => {
  const pb = playbookPara(pregunta, {});
  const dom = (() => { try { return dominiosDe(pregunta); } catch { return { dominios: [], eje: null }; } })();
  const pasos = unirPasosDeDominios(pasosDelEncargo(partesDelEncargo(pregunta), pb ? pasosDe(pb, pregunta, {}) : [], {}), (() => { try { return pasosDeDominios(dom); } catch { return []; } })());
  const rp = runPlan({ intent: "answer", calls: pasos.map((p) => ({ tool: p.tool, args: p.args || {} })) }, { scenario: ESCENARIO_INICIAL, maxCalls: 18, preguntaUsuario: pregunta, registry: CAJA });
  return asignarIds((rp.ledger && rp.ledger.figs) || rp.ledger || []);
};
const PREGUNTA = "¿Cuánto capital inmovilizado hay y cuáles SKU tienen la venta frenada?";
const indiceDe = () => indiceDeEvidencia({ figs: figsDe(PREGUNTA), datoProyectado: cifrasDelDato(ESCENARIO_INICIAL), ejesDelTenant: ejes });
/* «con umbral de la EMPRESA»: se declara en el PERFIL del tenant (byte a byte el mismo mecanismo que ya certifica
 * `_jerarquia_inventario_gate.mjs` para la planilla — `perfil.frenadoDiasSinVenta`), nunca `setCriterioOverride`
 * (el override CONVERSACIONAL, C.2): `datoProyectado.js:_cacheado` memoiza por `tenantId::escenario::benchmark` —
 * la clave NO incluye `frenadoDiasSinVenta`, así que un override posterior a la primera lectura no le llega sin
 * volver a llamar `initTenant`; y `initTenant` dispara `businessPolicy.js:_resolvePolicy`, que LIMPIA todo
 * `_criterioOverride` en cada cambio de tenant (línea 136 de ese archivo) — el propio candado contra que un
 * criterio de OTRA empresa sobreviva un cambio de tenant borra, de paso, el override que este gate acababa de
 * fijar. Declarar el umbral en el PERFIL de un tenant derivado (inicializado UNA vez) evita las dos trampas. */
const TENANT_DEMO_FRENADO_60 = { ...TENANT_DEMO, perfil: { ...TENANT_DEMO.perfil, frenadoDiasSinVenta: 60 } };
const indiceConUmbralEmpresa60 = () => { initTenant(TENANT_DEMO_FRENADO_60); return indiceDeEvidencia({ figs: figsDe(PREGUNTA), datoProyectado: cifrasDelDato(ESCENARIO_INICIAL), ejesDelTenant: ejes }); };
const volverAlDemo = () => initTenant(TENANT_DEMO);

/* helper: declara UN hecho "estado" y lee su veredicto del libro */
const veredictoEstado = (I, sujeto, estado) => {
  const libro = libroDeHechos([{ id: "h1", tipo: "estado", sujeto, estado }], { indice: I });
  return libro.hechos[0];
};

/* ── BLOQUE (a) · EL CANON VIGENTE, verificado con la evidencia real del demo (sin umbral de frenado declarado) ── */
H("(a) · inmovilizado (4 SKU: LG-DRYER8KG, BOS-SANDER, PHI-IRON-PRO, MAK-COMP-AIR) — verdadero y falso");
{
  const I = indiceDe();
  const v1 = veredictoEstado(I, "LG-DRYER8KG", "inmovilizado");
  ok(v1.veredicto === "verdadera", "LG-DRYER8KG (miembro real) → verdadera", JSON.stringify(v1));
  const v2 = veredictoEstado(I, "PHI-IRON-PRO", "inmovilizado");
  ok(v2.veredicto === "verdadera", "PHI-IRON-PRO (sobrestock, también inmovilizado) → verdadera", JSON.stringify(v2));
  const v3 = veredictoEstado(I, "SAM-REF500L", "inmovilizado");
  ok(v3.veredicto === "falsa", "SAM-REF500L (riesgo de quiebre, NO inmovilizado) → falsa", JSON.stringify(v3));
  const v4 = veredictoEstado(I, "SAM-TV55", "inmovilizado");
  ok(v4.veredicto === "falsa", "SAM-TV55 (capital sano, NO inmovilizado) → falsa", JSON.stringify(v4));
}

H("(a) · inmovilizado crítico (3 SKU: LG-DRYER8KG, BOS-SANDER, MAK-COMP-AIR) — verdadero y falso");
{
  const I = indiceDe();
  const v1 = veredictoEstado(I, "LG-DRYER8KG", "inmovilizado critico");
  ok(v1.veredicto === "verdadera", "LG-DRYER8KG (miembro real de inmovilizado crítico) → verdadera", JSON.stringify(v1));
  const v2 = veredictoEstado(I, "BOS-SANDER", "inmovilizado critico");
  ok(v2.veredicto === "verdadera", "BOS-SANDER (miembro real de inmovilizado crítico) → verdadera", JSON.stringify(v2));
  const v3 = veredictoEstado(I, "PHI-IRON-PRO", "inmovilizado critico");
  ok(v3.veredicto === "falsa", "PHI-IRON-PRO (inmovilizado, pero SOLO sobrestock — no crítico) → falsa", JSON.stringify(v3));
  const v4 = veredictoEstado(I, "SAM-TV55", "inmovilizado critico");
  ok(v4.veredicto === "falsa", "SAM-TV55 (capital sano — no crítico) → falsa", JSON.stringify(v4));
}

H("(a) · «crítico» = la alerta del archivo (distinta de «inmovilizado crítico», §7.3·34a) — verdadero y falso");
{
  const I = indiceDe();
  // LG-DRYER8KG y MAK-COMP-AIR traen alerta:"crit" en el archivo del demo (verificado contra TENANT_DEMO.skuInventario).
  const v1 = veredictoEstado(I, "MAK-COMP-AIR", "critico");
  ok(v1.veredicto === "verdadera", "MAK-COMP-AIR (alerta:\"crit\" del archivo) → verdadera", JSON.stringify(v1));
  // BOS-SANDER es inmovilizado crítico (capital_frenado) pero su alerta de archivo es "warn", no "crit": los dos
  // canones («inmovilizado critico» vs. «critico» a secas) son conjuntos DISTINTOS, exactamente la ley §7.3·34a.
  const v2 = veredictoEstado(I, "BOS-SANDER", "critico");
  ok(v2.veredicto === "falsa", "BOS-SANDER (inmovilizado crítico POR ROTACIÓN, pero alerta:\"warn\" del archivo) → falsa — los dos canones no son el mismo conjunto", JSON.stringify(v2));
}

H("(a) · frenado con umbral de la EMPRESA (frenadoDiasSinVenta:60 declarado en el perfil) — verdadero y falso");
{
  const I = indiceConUmbralEmpresa60();
  const v1 = veredictoEstado(I, "LG-DRYER8KG", "frenado");
  ok(v1.veredicto === "verdadera", "LG-DRYER8KG (94 días sin venta ≥ 60 declarados por la empresa) → verdadera", JSON.stringify(v1));
  const v2 = veredictoEstado(I, "PHI-IRON-PRO", "frenado");
  ok(v2.veredicto === "falsa", "PHI-IRON-PRO (35 días sin venta < 60 declarados por la empresa) → falsa", JSON.stringify(v2));
  volverAlDemo();
}

H("(a) · frenado SIN umbral declarado — SIEMPRE no-verificable (nunca verdadera ni falsa, §7.3·32a)");
{
  const I = indiceDe();   // el demo, sin override: nadie declaró frenadoDiasSinVenta
  const v1 = veredictoEstado(I, "LG-DRYER8KG", "frenado");
  ok(v1.veredicto === "no-verificable", "LG-DRYER8KG (94 días, sin umbral) → no-verificable, nunca \"verdadera\"", JSON.stringify(v1));
  const v2 = veredictoEstado(I, "SAM-TV55", "frenado");
  ok(v2.veredicto === "no-verificable", "SAM-TV55 (12 días, sin umbral) → no-verificable, nunca \"falsa\" (un umbral inventado sería una verdad ADI, prohibida)", JSON.stringify(v2));
}

H("(a) · la intersección frenado ∩ inmovilizado — medida con conjuntoDeUniverso (la MISMA primitiva del Notario), nunca asumida");
{
  const I = indiceConUmbralEmpresa60();
  // frenado(60) = {LG-DRYER8KG, BOS-SANDER, MAK-COMP-AIR} (3) · inmovilizado = {esos 3} ∪ {PHI-IRON-PRO} (4) →
  // la intersección son los mismos 3 (verificado contra jerarquiaInventario en _jerarquia_inventario_gate).
  const R = conjuntoDeUniverso({ eje: "sku", estados: ["frenado", "inmovilizado"] }, I, "sku", "");
  ok(!!(R && R.set), "la intersección resuelve (conjuntoDeUniverso trae .set, no un {error})", JSON.stringify(R && R.error));
  if (R && R.set) {
    const esperado = ["bos-sander", "lg-dryer8kg", "mak-comp-air"];
    ok(R.set.size === 3, `la intersección son 3 SKU (obtenido: ${R.set.size})`, [...R.set].join(", "));
    ok(JSON.stringify([...R.set].sort()) === JSON.stringify(esperado), "la intersección es EXACTAMENTE {LG-DRYER8KG, BOS-SANDER, MAK-COMP-AIR} — no un cálculo distinto", [...R.set].sort().join(", "));
    ok(!R.set.has("phi-iron-pro"), "PHI-IRON-PRO (inmovilizado, sobrestock, NO frenado con este umbral) queda FUERA de la intersección", [...R.set].join(", "));
  }
  volverAlDemo();
}

/* ── CARNADAS · el gate tiene que arder con afirmaciones deliberadamente rotas sobre el canon (el candado tiene dientes) ── */
H("(a) · CARNADAS — el gate detecta una afirmación falsa sobre el canon (no solo confirma lo esperado)");
{
  const I = indiceDe();   // sin umbral de frenado
  const carnadaFalsa = veredictoEstado(I, "SAM-REF500L", "inmovilizado");
  ok(carnadaFalsa.veredicto !== "verdadera", "CARNADA · SAM-REF500L NO es inmovilizado — si esto saliera \"verdadera\", el candado no tiene dientes", JSON.stringify(carnadaFalsa));
  const carnadaCritico = veredictoEstado(I, "SAM-MICRO32L", "inmovilizado critico");
  ok(carnadaCritico.veredicto !== "verdadera", "CARNADA · SAM-MICRO32L (capital sano) NO es inmovilizado crítico", JSON.stringify(carnadaCritico));
  const I60 = indiceConUmbralEmpresa60();
  const carnadaFrenadoSano = veredictoEstado(I60, "SAM-TV55", "frenado");
  ok(carnadaFrenadoSano.veredicto !== "verdadera", "CARNADA · SAM-TV55 (12 días, bajo el umbral de 60) NO está frenado", JSON.stringify(carnadaFrenadoSano));
  volverAlDemo();
}

/* ══ BLOQUE (a2) · «frenado» CON EL UMBRAL DE LA CONSULTA (etapa 6, §7.3·35) ═══════════════════════════════════════
 * Oráculo INDEPENDIENTE del motor: se calcula del archivo del tenant, no de `jerarquiaInventario` ni del Notario. */
const SKUS = TENANT_DEMO.skuInventario;
const oraculoFrenado = (umbral) => SKUS.filter((s) => typeof s.diasSinVenta === "number" && s.diasSinVenta > umbral).map((s) => s.sku).sort();
const refConsulta = (valor, unidad = "days") => ({ concepto: "umbral_frenado", valor, unidad });
const encUniverso = (referencia) => ({ version: "encargo/v1", ...(referencia ? { criterio: { referencia } } : {}), partes: [{ id: "p1", tema: "inventario", cierre: "decision", conceptos: ["capital"], universo: { eje: "sku", estados: ["frenado"] } }] });
const encPremisas = (referencia, sujetos) => ({ version: "encargo/v1", ...(referencia ? { criterio: { referencia } } : {}), partes: [{ id: "p1", tema: "inventario", cierre: "comparacion", conceptos: ["capital", "dias_sin_venta"], entidades: sujetos.map((nombre) => ({ nombre })) }], premisas: sujetos.map((s, i) => ({ id: `q${i + 1}`, tipo: "estado", sujeto: s, estado: "frenado" })) });
const entregaDe = (enc) => componerEntrega(validarEncargo(enc, {}));
const entidadesDelUniverso = (E) => [...((E.entrega.universos[0] && E.entrega.universos[0].entidades) || [])].sort();
const nombresLimite = (E, ini) => (E.entrega.limites || []).filter((l) => String(l.titulo).startsWith(ini));

H("(a2) · frenado con umbral de la CONSULTA — un universo por estado, con el oráculo del archivo (90 días)");
{
  const E = entregaDe(encUniverso(refConsulta(90)));
  ok(E.ok === true, "la Entrega SALE (antes: ok:false, la referencia de la consulta nunca llegaba al Notario)", E.motivo);
  if (E.ok) {
    const esperado = oraculoFrenado(90);
    ok(esperado.length >= 1 && esperado.length < SKUS.length, `el oráculo discrimina (${esperado.length} de ${SKUS.length} SKU con más de 90 días sin venta)`, esperado.join(", "));
    ok(JSON.stringify(entidadesDelUniverso(E)) === JSON.stringify(esperado), "el universo «frenado» servido es EXACTAMENTE el del oráculo (días sin venta > 90)", entidadesDelUniverso(E).join(", "));
    const mr = E.entrega.marco.referenciaDeclarada;
    ok(!!mr && mr.texto.includes(ETIQUETA_ORIGEN.consulta) && mr.texto.includes(formatoDeLaCasa(90, "days")), `el Marco declara el umbral con su ORIGEN («${ETIQUETA_ORIGEN.consulta}») y su valor`, JSON.stringify(mr));
    ok(!!mr && !mr.texto.includes(ETIQUETA_ORIGEN.empresa) && !mr.texto.includes(ETIQUETA_ORIGEN.adi), "…y NUNCA lo presenta como criterio de la empresa ni como el general de ADI", JSON.stringify(mr));
    ok(E.texto.includes(mr.texto), "…y esa declaración sale en el texto entregado", E.texto.slice(0, 400));
  }
  const E94 = entregaDe(encUniverso(refConsulta(94)));
  ok(E94.ok && JSON.stringify(entidadesDelUniverso(E94)) === JSON.stringify(oraculoFrenado(94)), "frontera ESTRICTA: con 94 días, el SKU que lleva exactamente 94 NO está frenado (sobre el umbral = más de N)", entidadesDelUniverso(E94).join(", "));
  ok(!oraculoFrenado(94).includes("LG-DRYER8KG") && oraculoFrenado(93).includes("LG-DRYER8KG"), "el oráculo confirma la frontera (94 no es > 94; sí es > 93)");
}

H("(a2) · frenado con umbral de la CONSULTA — premisas verdadera y falsa (LG-DRYER8KG 94 días · SAM-TV55 12 días)");
{
  const I90 = () => indiceDeEvidencia({ figs: [], datoProyectado: cifrasDelDato(ESCENARIO_INICIAL, { frenadoDiasSinVenta: 90 }), ejesDelTenant: ejes });
  const v1 = veredictoEstado(I90(), "LG-DRYER8KG", "frenado");
  ok(v1.veredicto === "verdadera", "LG-DRYER8KG (94 > 90 planteado en la consulta) → verdadera", JSON.stringify(v1));
  const v2 = veredictoEstado(I90(), "SAM-TV55", "frenado");
  ok(v2.veredicto === "falsa", "SAM-TV55 (12 < 90 planteado en la consulta) → falsa", JSON.stringify(v2));
  const I94 = indiceDeEvidencia({ figs: [], datoProyectado: cifrasDelDato(ESCENARIO_INICIAL, { frenadoDiasSinVenta: 94 }), ejesDelTenant: ejes });
  const v3 = veredictoEstado(I94, "LG-DRYER8KG", "frenado");
  ok(v3.veredicto === "falsa", "LG-DRYER8KG con la consulta en 94 → falsa (94 no supera 94: el veredicto usa la MISMA frontera que la pantalla)", JSON.stringify(v3));
  const E = entregaDe(encPremisas(refConsulta(90), ["LG-DRYER8KG", "SAM-TV55"]));
  ok(E.ok === true, "la Entrega con dos premisas «frenado» y umbral de la consulta SALE", E.motivo);
  if (E.ok) {
    const premisas = E.entrega.respuesta.filter((r) => r._premisa);
    ok(premisas.length === 2, "las dos premisas se anuncian (una verdadera, una falsa, cada una en su oración)", String(premisas.length));
    const mr = E.entrega.marco.referenciaDeclarada;
    ok(!!mr && mr.texto.includes(ETIQUETA_ORIGEN.consulta), "el Marco declara el umbral de la consulta cuando solo una PREMISA lo usa", JSON.stringify(mr));
  }
}

H("(a2) · frenado SIN umbral de la consulta ni de la empresa — la referencia de OTRA magnitud no lo inventa");
{
  const Ix = () => indiceDeEvidencia({ figs: [], datoProyectado: cifrasDelDato(ESCENARIO_INICIAL), ejesDelTenant: ejes });
  const v = veredictoEstado(Ix(), "LG-DRYER8KG", "frenado");
  ok(v.veredicto === "no-verificable", "sin ningún umbral → no-verificable (después de haber corrido consultas con umbral: la carpeta de una consulta no se filtra a la siguiente)", JSON.stringify(v));
  const kpiUmbral = (d) => (d.kpis || []).filter((k) => /umbral de venta frenada/i.test(String(k.label || k.canon || "")));
  const sin = cifrasDelDato(ESCENARIO_INICIAL);
  const con = cifrasDelDato(ESCENARIO_INICIAL, { frenadoDiasSinVenta: 90 });
  ok(kpiUmbral(sin).length === 0, "la carpeta SIN consulta no trae la fig «Umbral de venta frenada»", JSON.stringify(kpiUmbral(sin)));
  ok(kpiUmbral(con).length === 1, "la carpeta CON la consulta la trae (una vez)", JSON.stringify(kpiUmbral(con)));
  const vOtra = entregaDe(encUniverso(refConsulta(90, "pct")));
  ok(!(vOtra.ok && vOtra.entrega.marco.referenciaDeclarada && String(vOtra.entrega.marco.referenciaDeclarada.texto).includes(ETIQUETA_ORIGEN.consulta)), "una referencia con OTRA unidad (no días) no se toma como umbral de venta frenada", vOtra.ok ? JSON.stringify(vOtra.entrega.marco.referenciaDeclarada) : vOtra.motivo);
}

H("(a2) · el umbral de la CONSULTA no reemplaza al de la EMPRESA (§7.3·12/·19) — empresa 60, consulta 90");
{
  initTenant(TENANT_DEMO_FRENADO_60);
  const E = entregaDe(encUniverso(refConsulta(90)));
  ok(E.ok === true, "la Entrega SALE", E.motivo);
  if (E.ok) {
    ok(JSON.stringify(entidadesDelUniverso(E)) === JSON.stringify(oraculoFrenado(60)), "el universo «frenado» es el de la EMPRESA (60 días), no el de la consulta", entidadesDelUniverso(E).join(", "));
    const mr = E.entrega.marco.referenciaDeclarada;
    ok(!mr || !String(mr.texto).includes(ETIQUETA_ORIGEN.consulta), "el Marco NO presenta el umbral de la consulta como el operativo", JSON.stringify(mr));
    const alt = nombresLimite(E, "Con la referencia planteada en la consulta");
    ok(alt.length === 1, "el de la consulta se declara APARTE, como límite, con su propia cuenta", JSON.stringify((E.entrega.limites || []).map((l) => l.titulo)));
    if (alt.length === 1) for (const n of oraculoFrenado(90)) ok(alt[0].motivo.includes(n), `…y nombra a ${n} (frenado con 90 días)`, alt[0].motivo);
    ok(oraculoFrenado(60).length > oraculoFrenado(90).length, "el oráculo distingue los dos umbrales (60 ≠ 90): la prueba no puede pasar por casualidad");
  }
  volverAlDemo();
}

/* ══ BLOQUE (a3) · «frenado» SIN NINGÚN UMBRAL → una Entrega ok:true que DECLINA con un límite de negocio (§7.3·29 y ·32a,
 * 2026-09-29) ═════════════════════════════════════════════════════════════════════════════════════════════════════════
 * Antes: un encargo con `universo.estados:["frenado"]` y sin umbral (ni de la empresa ni de la consulta) devolvía
 * `ok:false` («ninguna parte produjo una oración con evidencia»). Ahora: `ok:true`, sin ninguna oración ni fila que
 * afirme quiénes están frenados —nunca «no hay frenados», nunca tramos inventados—, y UN límite de negocio que dice que la
 * empresa no declaró desde cuántos días sin venta considera frenado un producto, con el ofrecimiento de declararlo (sin
 * proponer un número). El predicado se mide sobre la ESTRUCTURA de la Entrega (límites, universos, respuesta, filas), no
 * sobre palabras prohibidas.
 * ACTUALIZADO por la decisión del owner 2026-09-29, §7.3·31/34 (cierre del inventario, B2): antes «ninguna oración ni fila»; ahora la Entrega
 * SÍ trae los días sin venta de cada SKU, ordenados, como HECHO histórico (bloque (a5) abajo) — lo que sigue prohibido es una oración o una
 * fila que afirme quiénes están frenados, o «no hay frenados». */
const LIMITE_FRENADO_SIN_UMBRAL = "La empresa no ha declarado desde cuántos días sin venta considera frenado un producto";
const esDiasSinVenta = (rotulo) => { const h = historicoDe(String(rotulo || ""), "days"); return !!h && h.clave === "dias_sin_venta"; };   // la clase la fija el registro de hechos históricos (figureType.js), no una palabra
const declinaFrenadoSinUmbral = (E) => E && E.ok === true
  && (E.entrega.limites || []).filter((l) => String(l.motivo).includes(LIMITE_FRENADO_SIN_UMBRAL) && /\bindica\b|\bdeclar/i.test(String(l.motivo)) && !/\d/.test(String(l.motivo))).length === 1   // el límite, con su ofrecimiento y SIN un número propuesto
  /* decisión del owner 2026-09-29, §7.3·31/34 (B2, «sin umbral de frenado, ADI entrega los días sin venta de cada SKU, ordenados, y declara
   * que falta el criterio»). ANTES: `(respuesta.length === 0 && filas.length === 0)` — ninguna oración ni fila. DESPUÉS: lo que se sirve es SOLO el
   * HECHO histórico de los días (cada fila tipada «historico» y de la clase «días sin venta»; cada oración cita únicamente cifras de esa clase) —
   * nunca una oración ni una fila que afirme quiénes están frenados, nunca «no hay frenados». Medido sobre la ESTRUCTURA, no sobre palabras. */
  && (E.entrega.cifras.filas || []).every((f) => f.naturaleza === "historico" && esDiasSinVenta((f.valores || {})["Métrica"]))
  && (E.entrega.respuesta || []).every((r) => (r.hechos || []).length > 0 && r.hechos.every((id) => { const h = (((E.entrega.procedencia || {}).libro || {}).hechos || []).find((x) => x.id === id); return !!h && h.tipo === "ref" && (h.evidencia || []).length > 0 && h.evidencia.every(esDiasSinVenta); }))
  && (E.entrega.universos || []).every((u) => !(u.estados || []).some((e) => /frenad/i.test(String(e))) || (u.entidades || []).length === 0);   // ni un universo «frenado» con miembros inventados
H("(a3) · frenado SIN umbral: la Entrega SALE (ok:true) y declina con el límite de negocio, con cada cierre de la parte");
{
  for (const cierre of ["decision", "lectura", "cifra"]) {
    const enc = { version: "encargo/v1", partes: [{ id: "p1", tema: "inventario", cierre, conceptos: ["capital"], universo: { eje: "sku", estados: ["frenado"] } }] };
    const E = entregaDe(enc);
    ok(E.ok === true, `[${cierre}] la Entrega SALE (antes: ok:false)`, E.motivo);
    ok(declinaFrenadoSinUmbral(E), `[${cierre}] declina con el límite de negocio y el ofrecimiento, sin servir ninguna lista de frenados ni un número propuesto`, E.ok ? JSON.stringify(E.entrega.limites.map((l) => l.titulo)) : E.motivo);
    ok(E.ok && E.texto.includes(LIMITE_FRENADO_SIN_UMBRAL), `[${cierre}] …y el límite sale en el texto que ADI entrega`);
  }
  const uUnion = { eje: "sku", estados: ["inmovilizado critico"], union: [{ eje: "sku", estados: ["frenado"] }] };
  const Eu = entregaDe({ version: "encargo/v1", partes: [{ id: "p1", tema: "inventario", cierre: "decision", conceptos: ["capital"], universo: uUnion }] });
  ok(Eu.ok === true && (Eu.entrega.limites || []).some((l) => String(l.motivo).includes(LIMITE_FRENADO_SIN_UMBRAL)), "una rama «frenado» dentro de una unión también declina por el umbral (y no sirve solo la otra rama en silencio)", Eu.ok ? JSON.stringify(Eu.entrega.limites.map((l) => l.titulo)) : Eu.motivo);
  const Enot = entregaDe({ version: "encargo/v1", partes: [{ id: "p1", tema: "inventario", cierre: "lectura", conceptos: ["capital"], universo: { eje: "sku", no_estados: ["frenado"] } }] });
  ok(Enot.ok === true && (Enot.entrega.limites || []).some((l) => String(l.motivo).includes(LIMITE_FRENADO_SIN_UMBRAL)), "«los que NO están frenados» sin umbral también declina (lo contrario de un estado sin definir no se adivina)");
  // controles: con umbral (de la consulta o de la empresa) NO hay límite de «sin umbral» y sí un universo con miembros
  const Ec = entregaDe(encUniverso(refConsulta(90)));
  ok(Ec.ok === true && !(Ec.entrega.limites || []).some((l) => String(l.motivo).includes(LIMITE_FRENADO_SIN_UMBRAL)) && entidadesDelUniverso(Ec).length >= 1, "CONTROL · con el umbral de la CONSULTA no hay límite de «sin umbral» y el universo tiene miembros");
  initTenant(TENANT_DEMO_FRENADO_60);
  const Ee = entregaDe(encUniverso(null));
  ok(Ee.ok === true && !(Ee.entrega.limites || []).some((l) => String(l.motivo).includes(LIMITE_FRENADO_SIN_UMBRAL)) && entidadesDelUniverso(Ee).length >= 1, "CONTROL · con el umbral de la EMPRESA tampoco");
  volverAlDemo();
}
H("(a3) · CARNADAS — el predicado rechaza una Entrega que esconde la falta de umbral");
{
  const sana = entregaDe(encUniverso(null));
  ok(declinaFrenadoSinUmbral(sana), "la Entrega sana pasa el predicado");
  ok(!declinaFrenadoSinUmbral({ ok: false, motivo: "ninguna parte produjo una oración con evidencia" }), "CARNADA · ok:false (el estado de antes) → lo rechaza");
  ok(!declinaFrenadoSinUmbral({ ...sana, entrega: { ...sana.entrega, limites: [] } }), "CARNADA · sin el límite de negocio → lo rechaza");
  // decisión del owner 2026-09-29, §7.3·31/34: antes la oración carnada citaba «e1» (hoy un hecho de días, legítimo); ahora cita un hecho que NO es un día sin venta
  ok(!declinaFrenadoSinUmbral({ ...sana, entrega: { ...sana.entrega, respuesta: [{ texto: "No hay SKU frenados.", hechos: ["e999"] }] } }), "CARNADA · con una oración que afirma quiénes están frenados (o que no hay), sin un hecho de días que la respalde → lo rechaza");
  ok(!declinaFrenadoSinUmbral({ ...sana, entrega: { ...sana.entrega, respuesta: [{ texto: "No hay SKU frenados." }] } }), "CARNADA · con una oración sin ningún hecho citado → lo rechaza");
  ok(!declinaFrenadoSinUmbral({ ...sana, entrega: { ...sana.entrega, cifras: { ...sana.entrega.cifras, filas: [{ valores: {} }] } } }), "CARNADA · con filas de SKU frenados servidas → lo rechaza");
  ok(!declinaFrenadoSinUmbral({ ...sana, entrega: { ...sana.entrega, limites: sana.entrega.limites.map((l) => (String(l.motivo).includes(LIMITE_FRENADO_SIN_UMBRAL) ? { ...l, motivo: l.motivo + " Con 60 días serían 3." } : l)) } }), "CARNADA · con un umbral propuesto por ADI («con 60 días…») → lo rechaza");
}

/* ══ BLOQUE (a4) · LA GRAMÁTICA DE LO QUE ADI IMPRIME SOBRE UN UNIVERSO (owner 2026-09-29, tarea 3) ═══════════════════════
 * «los SKU frenado», «inmovilizado critico» (sin tilde, en singular) y «Serían 4 cuentas» cuando el eje es SKU eran texto de
 * la casa mal escrito. Las formas (singular · plural · contrario · sustantivo del grupo) son DATOS (`estados.js:FORMA_DE_ESTADO`,
 * `conjuntosDeLaCasa.js:visible`, `lexico.js:CUENTA_DE_EJE`), sin regex de frases: el gate verifica los datos y lo que se imprime. */
H("(a4) · cada estado de la casa tiene su forma (datos), con tildes, y el canon nunca se imprime");
{
  const sinForma = ESTADOS_DE_LA_CASA.filter((e) => !FORMA_DE_ESTADO[e.canon]).map((e) => e.canon);
  ok(sinForma.length === 0, "TODO canon de ESTADOS_DE_LA_CASA tiene su forma en FORMA_DE_ESTADO", sinForma.join(", "));
  const sobran = Object.keys(FORMA_DE_ESTADO).filter((c) => !ESTADOS_DE_LA_CASA.some((e) => e.canon === c));
  ok(sobran.length === 0, "…y ninguna forma sobra (no hay formas de estados que la casa no define)", sobran.join(", "));
  const completas = Object.entries(FORMA_DE_ESTADO).every(([, v]) => typeof v.singular === "string" && v.singular && typeof v.plural === "string" && v.plural);
  ok(completas, "cada forma trae su singular y su plural");
}
H("(a4) · nombrarUniverso: el estado concuerda con el grupo — «los SKU frenados», «los SKU inmovilizados críticos»");
{
  const n = (u) => nombrarUniverso(u, null);
  ok(n({ eje: "sku", estados: ["frenado"] }) === "los SKU frenados", "los SKU frenados (antes: «los SKU frenado»)", n({ eje: "sku", estados: ["frenado"] }));
  ok(n({ eje: "sku", estados: ["inmovilizado critico"] }) === "los SKU inmovilizados críticos", "los SKU inmovilizados críticos (antes: «los SKU inmovilizado critico»)", n({ eje: "sku", estados: ["inmovilizado critico"] }));
  ok(n({ eje: "sku", estados: ["inmovilizado"] }) === "los SKU inmovilizados", "los SKU inmovilizados");
  /* decisión del owner 2026-09-28, §7.3·34a: la alerta del archivo se dice «con alerta en el archivo», no «crítico» */
  ok(n({ eje: "sku", estados: ["critico"] }) === "los SKU con alerta en el archivo", "los SKU con alerta en el archivo (la alerta del archivo; «crítico» es del tramo inmovilizado crítico)");
  ok(n({ eje: "sku", no_estados: ["frenado"] }) === "los SKU no frenados", "el contrario: los SKU no frenados");
  ok(n({ eje: "sku", no_estados: ["sobrestock"] }) === "los SKU que no están en sobrestock", "el contrario de una forma con preposición no se arma con un «no» pegado");
  ok(n({ eje: "sku", base: "con capital inmovilizado critico" }) === "los SKU con capital inmovilizado crítico", "un conjunto de la casa con nombre visible propio se imprime con su tilde");
  ok(n({ eje: "sku", base: "frenado" }) === "los SKU frenados", "un estado citado como base se imprime con su forma de grupo");
  ok(n({ eje: "sku", excluir: { estados: ["frenado"] } }) === "los SKU fuera de los frenados", "«fuera de» lleva el sustantivo del grupo: los frenados");
  ok(n({ eje: "sku", excluir: { estados: ["sobrestock"] } }) === "los SKU fuera de los que están en sobrestock", "…y el de una forma con preposición: los que están en sobrestock");
  // el canon de cada estado, dicho como estado de un grupo, no se filtra al texto con el formato de identificador
  const filtraciones = ESTADOS_DE_LA_CASA.filter((e) => /^(?:inmovilizado critico|critico)$/.test(e.canon) && n({ eje: e.eje, estados: [e.canon] }).includes(e.canon));
  ok(filtraciones.length === 0, "el identificador sin tilde no se imprime nunca", filtraciones.map((e) => e.canon).join(", "));
  // los que ya estaban bien no cambian
  ok(n({ eje: "cliente", estados: ["en mora"] }) === "los clientes en mora" && n({ eje: "cliente", no_estados: ["en mora"] }) === "los clientes sin mora" && n({ eje: "cliente", estados: ["al dia"] }) === "los clientes al día", "los estados de cobranza que ya se decían bien siguen igual");
  const visibles = CONJUNTOS_DE_LA_CASA.filter((c) => c.visible);
  ok(visibles.length >= 1 && visibles.every((c) => c.visible.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase() === c.nombre), "cada nombre visible de un conjunto es el mismo nombre con su ortografía (solo cambian las tildes)", visibles.map((c) => c.nombre).join(", "));
}
H("(a4) · «Serían N …»: el sustantivo es el del eje (SKU, no «cuentas») y concuerda con la cantidad");
{
  ok(conteoDeEje("sku", 4).texto === "4 SKU" && conteoDeEje("sku", 4).condicional === "Serían", "eje sku: «Serían 4 SKU»");
  ok(conteoDeEje("cliente", 4).texto === "4 cuentas", "eje cliente: «4 cuentas» (la palabra de la casa, sin cambio)");
  ok(conteoDeEje("cliente", 1).texto === "1 cuenta" && conteoDeEje("cliente", 1).condicional === "Sería" && conteoDeEje("cliente", 1).presente === "es", "con uno: «Sería 1 cuenta» / «es 1 cuenta»");
  ok(conteoDeEje("marca", 2).texto === "2 marcas" && conteoDeEje("bodega", 3).texto === "3 bodegas", "los demás ejes se cuentan con su nombre");
  // en la Entrega: la alternativa con la referencia de la consulta sobre un eje SKU
  const encSku = { version: "encargo/v1", criterio: { referencia: { concepto: "piso_rotacion", valor: 2.5, unidad: "ratio" } }, partes: [{ id: "p1", tema: "inventario", cierre: "decision", conceptos: ["capital"], universo: { eje: "sku", estados: ["rota lento"] } }] };
  const Es = entregaDe(encSku);
  const alt = Es.ok ? (Es.entrega.limites || []).filter((l) => String(l.titulo).startsWith("Con la referencia planteada en la consulta")) : [];
  ok(alt.length === 1, "la Entrega declara la alternativa con la referencia de la consulta (piso de rotación) sobre el eje SKU", Es.ok ? "" : Es.motivo);
  if (alt.length === 1) {
    const m = alt[0].motivo;
    ok(/^Serían \d+ SKU /.test(m) && !/cuentas/.test(m), "…y dice «Serían N SKU», no «N cuentas»", m.slice(0, 90));
  }
  const encCli = { version: "encargo/v1", criterio: { referencia: { concepto: "benchmark", valor: 25, unidad: "pct" } }, partes: [{ id: "p1", tema: "comercial", cierre: "decision", conceptos: ["ventas"], universo: { eje: "cliente", base: "bajo el benchmark" } }] };
  const Ec = entregaDe(encCli);
  const altC = Ec.ok ? (Ec.entrega.limites || []).filter((l) => String(l.titulo).startsWith("Con la referencia planteada en la consulta")) : [];
  ok(altC.length === 1 && /^Serían \d+ cuentas /.test(altC[0].motivo), "CONTROL · sobre clientes sigue diciendo «Serían N cuentas»", altC.length ? altC[0].motivo.slice(0, 60) : Ec.motivo);
}

/* ══ BLOQUE (b) · LO HISTÓRICO VIAJA TIPADO (etapa 6, §7.3·35, decisión del owner: opción A) ════════════════════════ */
const esHistoricoTipado = (f) => { const h = historicoDe(f.label, f.unit); const t = f.tipo || {}; return !!h && t.naturaleza === "historico" && t.ventana === h.ventana && t.limite === LIMITE_HISTORICO && f.source === "actual" && (t.escenario == null); };

H("(b) · el registro: tres hechos históricos, cada uno con su ventana, y el límite exacto de la decisión del owner");
{
  ok(LIMITE_HISTORICO === "describe lo que pasó; no es un pronóstico", "el límite es la frase del owner, una sola vez, en el contrato (figureType.js)", LIMITE_HISTORICO);
  ok(JSON.stringify(Object.keys(HECHOS_HISTORICOS).sort()) === JSON.stringify(["dias_sin_venta", "ultima_venta", "unidades_periodo"]), "los hechos históricos son EXACTAMENTE: días sin venta, unidades del período y última venta", Object.keys(HECHOS_HISTORICOS).join(", "));
  for (const [k, h] of Object.entries(HECHOS_HISTORICOS)) ok(typeof h.ventana === "string" && h.ventana.length > 20 && typeof h.unidad === "string" && !!h.fuente, `«${k}» declara su ventana (período / días hasta el corte), su unidad y su fuente`);
}

H("(b) · la BOLETA de inventoryStatus: cada cifra histórica lleva su tipo, su ventana y su límite; la lectura los repite tipados");
{
  let total = 0;
  for (const focus of ["frenado", "stale", "sobrestock", "quiebre", "mas_vendidos_mes"]) {   // `mas_vendidos_mes` trae las UNIDADES del período («Vendido en el mes»)
    const r = TOOLS.inventoryStatus({ focus, scenario: ESCENARIO_INICIAL });
    const figsH = (r.boleta || []).filter((f) => historicoDe(f.label, f.unit));
    total += figsH.length;
    ok(figsH.length >= 1, `[${focus}] la boleta trae cifras históricas (no es una prueba vacía)`, String((r.boleta || []).length));
    const malas = figsH.filter((f) => !esHistoricoTipado(f)).map((f) => f.label);
    ok(malas.length === 0, `[${focus}] TODA cifra histórica sale tipada (naturaleza, ventana, límite, source actual, sin escenario)`, malas.join(" | "));
    const hist = r.facts && r.facts.historia;
    ok(!!hist && hist.naturaleza === "historico" && hist.limite === LIMITE_HISTORICO, `[${focus}] facts.historia declara la naturaleza y el límite DENTRO de la lectura`, JSON.stringify(hist));
    ok(r.facts && r.facts.historia_limite === LIMITE_HISTORICO, `[${focus}] el límite viaja también como escalar (sobrevive a la compactación de facts)`);
    const clavesBoleta = [...new Set(figsH.map((f) => historicoDe(f.label, f.unit).clave))].sort();
    ok(!!hist && JSON.stringify(hist.hechos.map((h) => h.clave).sort()) === JSON.stringify(clavesBoleta), `[${focus}] facts.historia lista EXACTAMENTE las clases que la boleta trae`, JSON.stringify(hist && hist.hechos.map((h) => h.clave)));
    ok(!!hist && hist.hechos.every((h) => h.proyeccion === false && h.ventana === HECHOS_HISTORICOS[h.clave].ventana), `[${focus}] cada hecho declara su ventana y que NO autoriza una proyección`);
    ok(!!hist && JSON.stringify(Object.keys(hist).sort()) === JSON.stringify(["hechos", "limite", "naturaleza"]), `[${focus}] la lectura no trae ningún otro tipo de hecho junto a lo histórico`, Object.keys(hist || {}).join(","));
    // ausencia de hechos de proyección: ninguna cifra de la boleta es una simulación con supuestos
    const proyecciones = (r.boleta || []).filter((f) => f.source === "user_supuesto" || (f.tipo && f.tipo.escenario != null) || (f.tipo && f.tipo.naturaleza && f.tipo.naturaleza !== "historico"));
    ok(proyecciones.length === 0, `[${focus}] ninguna cifra de la boleta es una proyección (sin supuestos de usuario, sin escenario simulado, sin otra naturaleza)`, proyecciones.map((f) => f.label).join(" | "));
  }
  ok(total >= 5, `en los cinco focos viajaron ${total} cifras históricas`);
  const rIn = TOOLS.inventoryStatus({ focus: "inmovilizado", scenario: ESCENARIO_INICIAL });
  ok(!(rIn.facts && rIn.facts.historia) && !(rIn.facts && rIn.facts.historia_limite), "una lectura SIN cifras históricas (focus inmovilizado) no agrega ruido: no hay `historia`");
}

H("(b) · CARNADAS — el gate detecta un hecho histórico mal tipado y una proyección disfrazada de historia");
{
  const r = TOOLS.inventoryStatus({ focus: "frenado", scenario: ESCENARIO_INICIAL });
  const f0 = (r.boleta || []).find((f) => historicoDe(f.label, f.unit));
  ok(!!f0 && esHistoricoTipado(f0), "la cifra sana pasa el verificador");
  const sinLimite = { ...f0, tipo: { ...f0.tipo, limite: undefined } };
  ok(!esHistoricoTipado(sinLimite), "CARNADA · sin el límite dentro del tipo → el verificador la rechaza");
  const sinVentana = { ...f0, tipo: { ...f0.tipo, ventana: undefined } };
  ok(!esHistoricoTipado(sinVentana), "CARNADA · sin la ventana (período / días hasta el corte) → la rechaza");
  const otraNat = { ...f0, tipo: { ...f0.tipo, naturaleza: "proyeccion" } };
  ok(!esHistoricoTipado(otraNat), "CARNADA · con otra naturaleza → la rechaza");
  const proyectada = figDeBoleta("LG-DRYER8KG · Días sin venta", "120d", { unit: "days", raw: 120, source: "computed", formula: "días actuales + 26 (simulado)" });
  ok(!(proyectada.tipo && proyectada.tipo.naturaleza), "CARNADA · una cifra de días sin venta PROYECTADA (source computed, con fórmula) nunca sale con naturaleza «historico»", JSON.stringify(proyectada.tipo));
  ok(!esHistoricoTipado(proyectada), "…y el verificador la rechaza");
  ok(historiaDeFiguras([proyectada]) === null, "…y no aparece en la historia de la lectura");
}

H("(b) · la ENTREGA de componer.js: los días sin venta salen como hecho histórico — tipo, ventana, límite y sin proyección");
{
  const enc = { version: "encargo/v1", partes: [{ id: "p1", tema: "inventario", cierre: "cifra", conceptos: ["dias_sin_venta"], entidades: [{ nombre: "LG-DRYER8KG" }, { nombre: "MAK-COMP-AIR" }] }] };
  const E = entregaDe(enc);
  ok(E.ok === true, "la Entrega de «días sin venta» SALE", E.motivo);
  if (E.ok) {
    const M = E.entrega.marco.historicos;
    ok(!!M && M.naturaleza === "historico" && M.limite === LIMITE_HISTORICO, "el Marco trae `historicos` tipado, con la naturaleza y el límite", JSON.stringify(M));
    ok(!!M && M.hechos.length === 1 && M.hechos[0].clave === "dias_sin_venta" && M.hechos[0].ventana === HECHOS_HISTORICOS.dias_sin_venta.ventana && M.hechos[0].proyeccion === false, "…con la clase servida (días sin venta), su ventana (los días hasta la fecha de corte) y sin proyección", JSON.stringify(M && M.hechos));
    const filas = E.entrega.cifras.filas.filter((f) => /d[ií]as sin venta/i.test(f.valores["Métrica"] || ""));
    ok(filas.length === 2, "las dos filas de días sin venta están en la tabla", String(filas.length));
    ok(filas.every((f) => f.naturaleza === "historico" && f.ventana === HECHOS_HISTORICOS.dias_sin_venta.ventana && f.limite === LIMITE_HISTORICO), "CADA fila lleva naturaleza, ventana y límite (dentro del dato, no una nota suelta)", JSON.stringify(filas.map((f) => [f.naturaleza, !!f.ventana, !!f.limite])));
    ok(E.texto.includes(LIMITE_HISTORICO), "el límite sale en el texto que ADI entrega (Marco), armado del dato tipado");
    const hechos = E.entrega.procedencia.libro.hechos || [];
    ok(hechos.length >= 2 && hechos.every((h) => h.procedencia === "medido"), "todos los hechos del libro son MEDIDOS: ninguno es supuesto, propuesta ni estimación (ningún hecho de proyección)", [...new Set(hechos.map((h) => h.procedencia))].join(","));
    ok(!(E.entrega.respuesta || []).some((r) => r.solicitud === "simulacion"), "ninguna oración de la respuesta es una simulación");
  }
  const encCap = { version: "encargo/v1", partes: [{ id: "p1", tema: "inventario", cierre: "cifra", conceptos: ["capital"], entidades: [{ nombre: "LG-DRYER8KG" }] }] };
  const Ec = entregaDe(encCap);
  ok(Ec.ok === true && !Ec.entrega.marco.historicos && !Ec.entrega.cifras.filas.some((f) => f.naturaleza), "una Entrega SIN hechos históricos (solo capital) no trae `historicos` ni filas marcadas: nada de ruido", Ec.motivo);
}


/* ══ BLOQUE (a5) · EL RANKING DE DÍAS SIN VENTA, COMO HECHO (cierre del inventario, owner 2026-09-29, §7.3·31/34) ═══════════
 * Decisión del owner: sin un umbral de frenado, ADI entrega los días sin venta de CADA SKU, ordenados, y declara que falta el criterio.
 * El productor es `inventoryStatus{focus:"dias_sin_venta"}` (specRetrieval.js), desde la MISMA fuente que la vista «Días sin venta» de
 * la cara Capital (`jerarquiaInventario().porSku`, vía `buildMesaCapital().diasSinVenta`); lo pide SOLO `encargo/lecturasDe.js`. Los oráculos
 * son INDEPENDIENTES del motor: salen del archivo del tenant (`skuInventario.diasSinVenta`) y de la vista de la pantalla. */
const ORACULO_DIAS = SKUS.filter((x) => typeof x.diasSinVenta === "number").map((x) => [x.sku, x.diasSinVenta]).sort((a, b) => b[1] - a[1]);
const filasDeDias = (E) => (E.entrega.cifras.filas || []).filter((f) => esDiasSinVenta((f.valores || {})["Métrica"])).map((f) => [f.valores["Entidad / grupo"], Number(String(f.valores["Valor"]).replace(/[^\d.-]/g, ""))]);
const mismaSecuenciaDeDias = (filas, oraculo) => filas.length === oraculo.length && filas.every((x, i) => x[1] === oraculo[i][1]) && JSON.stringify(filas.map((x) => x[0]).sort()) === JSON.stringify(oraculo.map((x) => x[0]).sort());
H("(a5) · el PRODUCTOR: los días sin venta de TODOS los SKU, de la misma fuente que la vista de la cara Capital, tipados como hecho histórico");
{
  const r = TOOLS.inventoryStatus({ focus: "dias_sin_venta", scenario: ESCENARIO_INICIAL });
  const figsD = (r.boleta || []).filter((x) => esDiasSinVenta(x.label));
  ok(figsD.length === ORACULO_DIAS.length && ORACULO_DIAS.length === 13, `la lectura trae ${figsD.length} cifras: TODOS los SKU con días declarados (13), no solo los del tramo crítico (3)`);
  ok(figsD.every((x) => x.raw === (ORACULO_DIAS.find((o) => x.label.startsWith(o[0] + " ")) || [])[1]), "cada cifra es EXACTAMENTE la del archivo del tenant (oráculo independiente)");
  ok(figsD.every(esHistoricoTipado), "TODAS salen tipadas como hecho histórico (naturaleza, ventana, límite, sin escenario)");
  const vista = buildMesaCapital(ESCENARIO_INICIAL).diasSinVenta.filas.map((x) => [x.sku, x.diasSinVenta]);
  ok(JSON.stringify(figsD.map((x) => [x.label.split(" · ")[0], x.raw])) === JSON.stringify(vista), "el orden y las cifras son los de la vista «Días sin venta» de la cara Capital (una sola verdad entre las dos superficies)");
  ok(!!(r.facts && r.facts.historia) && r.facts.historia.hechos.length === 1 && r.facts.historia.hechos[0].clave === "dias_sin_venta" && r.facts.historia.hechos[0].proyeccion === false, "facts.historia declara SOLO la clase «días sin venta», sin proyección");
  ok(!(r.facts && r.facts.umbral_no_aplicado), "no declara un «umbral no aplicado»: los días son el hecho mismo");
  // el AGENTE vivo no ve este foco: no está en su catálogo de lecturas y ningún paso de dominios lo pide
  ok(!((getToolContract("inventoryStatus") || {}).lecturasSoportadas || []).some((l) => l.clave === "dias_sin_venta"), "el foco NO está en el catálogo de lecturas que ve el agente (toolContracts.js): su boleta queda idéntica");
  const pasosAgente = [...pasosDeDominios({ dominios: ["inventario"], eje: null }), ...pasosDeDominios({ dominios: ["comercial", "inventario", "cobranza"], eje: null })];
  ok(pasosAgente.length > 0 && !pasosAgente.some((p) => p.args && p.args.focus === "dias_sin_venta"), "ningún paso de los dominios del agente pide el foco", String(pasosAgente.length));
}
H("(a5) · «frenado» SIN umbral: la Entrega trae los 13 SKU ordenados con sus días y declara que falta el criterio");
{
  for (const cierre of ["decision", "lectura", "cifra"]) {
    const E = entregaDe({ version: "encargo/v1", partes: [{ id: "p1", tema: "inventario", cierre, conceptos: ["capital"], universo: { eje: "sku", estados: ["frenado"] } }] });
    ok(E.ok === true && declinaFrenadoSinUmbral(E), `[${cierre}] sale, con el límite del criterio y solo el HECHO de los días`, E.ok ? "" : E.motivo);
    if (!E.ok) continue;
    const filas = filasDeDias(E);
    ok(filas.length === 13 && mismaSecuenciaDeDias(filas, ORACULO_DIAS), `[${cierre}] las 13 filas, de MÁS a MENOS días, con los días del archivo (oráculo independiente)`, JSON.stringify(filas));
    ok(E.entrega.marco.historicos && E.entrega.marco.historicos.limite === LIMITE_HISTORICO && E.texto.includes(LIMITE_HISTORICO), `[${cierre}] el Marco declara que es histórico: «${LIMITE_HISTORICO}»`);
    const u = (E.entrega.universos || []).find((x) => x.id === "p1_dias_sin_venta");
    ok(!!u && u.entidades.length === 13 && !u.estados, `[${cierre}] el ranking declara SU universo (13 SKU, sin estado «frenado»), con id propio`);
    const lim = (E.entrega.limites || []).filter((l) => String(l.motivo).includes(LIMITE_FRENADO_SIN_UMBRAL));
    ok(lim.length === 1 && /van ordenados en esta Entrega/.test(lim[0].motivo), `[${cierre}] el límite dice que los días van en esta Entrega (no manda a otra pestaña)`);
  }
  // CONTROLES · con umbral (empresa o consulta) NO hay ranking sintético: el universo «frenado» se resuelve con su umbral
  const Ec = entregaDe(encUniverso(refConsulta(90)));
  ok(Ec.ok === true && !(Ec.entrega.universos || []).some((x) => /_dias_sin_venta$/.test(String(x.id))), "CONTROL · con el umbral de la CONSULTA no se agrega el ranking sintético (el universo «frenado» se resuelve)");
  initTenant(TENANT_DEMO_FRENADO_60);
  const Ee = entregaDe(encUniverso(null));
  ok(Ee.ok === true && !(Ee.entrega.universos || []).some((x) => /_dias_sin_venta$/.test(String(x.id))), "CONTROL · con el umbral de la EMPRESA tampoco");
  volverAlDemo();
  // el plan (la LECTURA) pide los días para «frenado» sin umbral, y solo entonces
  const resSin = validarEncargo(encUniverso(null), {});
  const pide = (R) => lecturasDe(R).plan.calls.some((c) => c.tool === "inventoryStatus" && c.args && c.args.focus === "dias_sin_venta");
  ok(pide(resSin), "lecturasDe: con «frenado» SIN umbral, pide el foco de los días sin venta");
  ok(!pide(validarEncargo(encUniverso(refConsulta(90)), {})), "lecturasDe CONTROL: con el umbral de la consulta no lo pide");
  const encCon = (cierre, extra) => validarEncargo({ version: "encargo/v1", partes: [{ id: "p1", tema: "inventario", cierre, conceptos: ["dias_sin_venta"], eje: "sku", ...extra }] }, {});
  ok(["cifra", "lectura", "decision"].every((c) => pide(encCon(c, {}))), "lecturasDe: el CONCEPTO «días sin venta» por SKU (cifra, lectura y decisión) lo pide");
  ok(pide(encCon("lectura", { universo: { eje: "sku", top: { metrica: "dias_sin_venta", k: 5, direccion: "mayor" } } })) && !lecturasDe(encCon("lectura", { universo: { eje: "sku", top: { metrica: "dias_sin_venta", k: 5, direccion: "mayor" } } })).plan.calls.some((c) => c.tool === "queryMetric" && c.args && c.args.metric === "dias_sin_venta"), "lecturasDe: un top por días sin venta usa ese productor, no un queryMetric que no tiene la métrica");
  ok(!pide(validarEncargo({ version: "encargo/v1", partes: [{ id: "p1", tema: "inventario", cierre: "lectura", conceptos: ["capital"], eje: "sku" }] }, {})), "lecturasDe CONTROL: una parte que no habla de días ni de «frenado» no lo pide");
}
H("(a5) · un top / orden por días sin venta: el top correcto sobre TODOS los SKU (antes: 3 filas, y el «menor» sin productor)");
{
  const encTop = (k, direccion, cierre = "lectura") => ({ version: "encargo/v1", partes: [{ id: "p1", tema: "inventario", cierre, conceptos: ["dias_sin_venta"], universo: { eje: "sku", top: { metrica: "dias_sin_venta", k, direccion } } }] });
  const E5 = entregaDe(encTop(5, "mayor"));
  const f5 = E5.ok ? filasDeDias(E5) : [];
  ok(E5.ok === true && f5.length === 5 && mismaSecuenciaDeDias(f5, ORACULO_DIAS.slice(0, 5)), "top 5 de MÁS días: los 5 SKU y sus días del archivo (antes servía 3 filas bajo el título «top 5»)", E5.ok ? JSON.stringify(f5) : E5.motivo);
  const cero = ORACULO_DIAS.filter((x) => x[1] === 0);
  const E5m = entregaDe(encTop(5, "menor", "cifra"));
  const f5m = E5m.ok ? filasDeDias(E5m) : [];
  ok(cero.length === 5 && E5m.ok === true && f5m.length === 5 && f5m.every((x) => x[1] === 0) && JSON.stringify(f5m.map((x) => x[0]).sort()) === JSON.stringify(cero.map((x) => x[0]).sort()), "top 5 de MENOS días: exactamente los 5 SKU que vendieron a la fecha de corte (antes: sin productor, la Entrega no salía)", E5m.ok ? JSON.stringify(f5m) : E5m.motivo);
  ok(E5m.ok === true && !JSON.stringify(E5m.entrega.paraSuJuicio || []).includes("esté inmovilizado"), "la cabeza del ranking (SAM-REF500L, con 0 días, no inmovilizado) NO dispara la pregunta «por qué está inmovilizado»: no afirma algo falso");
  // el top 3 «menor» parte un EMPATE (5 SKU con 0 días): §7.3·44(a) — se sirven los 5 empatados y se declara el empate (nunca 3 al azar, ni se declina el top)
  const E3m = entregaDe(encTop(3, "menor"));
  const f3m = E3m.ok ? filasDeDias(E3m) : [];
  ok(E3m.ok === true && f3m.length === 5 && JSON.stringify(f3m.map((x) => x[0]).sort()) === JSON.stringify(cero.map((x) => x[0]).sort()) && /que sirve 5 por el empate del filo \(.+ empatan en el puesto 1\)/.test(E3m.texto || "") && !(E3m.entrega.limites || []).some((l) => /empat/i.test(String(l.motivo))), "top 3 de MENOS días: el corte parte un empate → se sirven los 5 empatados y se declara el empate del filo (§7.3·44a), sin elegir 3 de 5 iguales ni declinar", E3m.ok ? JSON.stringify(f3m) : E3m.motivo);
  const Ecs = entregaDe({ version: "encargo/v1", partes: [{ id: "p1", tema: "inventario", cierre: "cifra", conceptos: ["dias_sin_venta"], eje: "sku" }] });
  const fcs = Ecs.ok ? filasDeDias(Ecs) : [];
  ok(Ecs.ok === true && fcs.length === 13 && JSON.stringify(fcs.map((x) => x[0]).sort()) === JSON.stringify(ORACULO_DIAS.map((x) => x[0]).sort()) && fcs.every((x) => ORACULO_DIAS.find((o) => o[0] === x[0])[1] === x[1]), "el CONCEPTO «días sin venta» por SKU: los 13, cada uno con su cifra del archivo");
}
H("(a5) · CARNADAS — el gate detecta un ranking incompleto, mal ordenado o con un día equivocado");
{
  const E = entregaDe(encUniverso(null));
  const filas = filasDeDias(E);
  ok(mismaSecuenciaDeDias(filas, ORACULO_DIAS), "el ranking sano pasa el verificador");
  ok(!mismaSecuenciaDeDias(filas.slice(0, 3), ORACULO_DIAS), "CARNADA · solo el tramo crítico (3 filas, como antes) → lo rechaza");
  ok(!mismaSecuenciaDeDias(filas.slice().reverse(), ORACULO_DIAS), "CARNADA · el orden invertido (de MENOS a MÁS) → lo rechaza");
  ok(!mismaSecuenciaDeDias(filas.map((x, i) => (i === 0 ? [x[0], x[1] + 1] : x)), ORACULO_DIAS), "CARNADA · un día equivocado → lo rechaza");
  ok(!mismaSecuenciaDeDias(filas.map((x, i) => (i === 0 ? ["SKU-INEXISTENTE", x[1]] : x)), ORACULO_DIAS), "CARNADA · un SKU que no es del inventario → lo rechaza");
}

/* ══ BLOQUE (a6) · LA ENTREGA IMPRIME EL CANON, NO «CAPITAL FRENADO» (cierre del inventario, owner 2026-09-29) ═══════════
 * B1: la conclusión por SKU dice «SKU inmovilizados críticos» y «de capital inmovilizado crítico» (formas de la casa, `FORMA_DE_ESTADO`).
 * B3: la gramática de los nombres de la casa sale de DATOS del léxico: «en vez del benchmark…» (`conPreposicion`) y «los clientes con carga
 * comercial alta» (`precede` del conjunto), nunca una regla sobre frases. */
H("(a6) · B1: la conclusión de un SKU dice el canon");
{
  const E = entregaDe({ version: "encargo/v1", partes: [{ id: "p1", tema: "inventario", cierre: "lectura", conceptos: ["capital_frenado"], entidades: [{ nombre: "LG-DRYER8KG" }] }] });
  ok(E.ok === true, "la Entrega de la conclusión por SKU sale", E.motivo);
  if (E.ok) {
    const txt = E.entrega.respuesta.map((r) => r.texto).join(" ");
    const forma = formaDeEstado("inmovilizado critico");
    ok(txt.includes(`SKU ${forma.plural}`) && txt.includes(`de capital ${forma.singular}`), `dice «SKU ${forma.plural}» y «de capital ${forma.singular}» (las formas de la casa)`, txt);
    const uni = (E.entrega.universos || []).find((x) => x.criterio);
    ok(!!uni && uni.criterio === `SKU ${forma.plural}` && uni.texto === uni.criterio, "el universo del ranking se declara con el mismo nombre del canon", JSON.stringify(uni && [uni.criterio, uni.texto]));
  }
  const fuente = fs.readFileSync("./src/adi/entrega/componer.js", "utf8") + fs.readFileSync("./src/adi/oracle/datoProyectado.js", "utf8") + fs.readFileSync("./src/adi/entrega/iniciativa.js", "utf8");
  ok(!/SKU con capital frenado|capital frenado SKU|capital frenado total|\$\{R\(c\.idFrenado\)\} frenados|los SKU frenados \(rotaci/.test(fuente), "ninguna de las cuatro cadenas viejas sigue en el código (componer.js, datoProyectado.js, iniciativa.js)");
}
H("(a6) · B3: la gramática sale de datos del léxico");
{
  ok(conPreposicion("de", { articulo: "el", nucleo: "benchmark de la empresa" }) === "del benchmark de la empresa", "de + el → «del» (tabla de contracciones del léxico)");
  ok(conPreposicion("de", { articulo: "la", nucleo: "empresa" }) === "de la empresa" && conPreposicion("con", { articulo: "el", nucleo: "nivel" }) === "con el nivel", "con los otros artículos y preposiciones, no se contrae");
  const familias = [
    ["benchmark", { version: "encargo/v1", criterio: { referencia: { concepto: "benchmark", valor: 25, unidad: "pct" } }, partes: [{ id: "p1", tema: "comercial", cierre: "decision", conceptos: ["ventas"], universo: { eje: "cliente", base: "bajo el benchmark" } }] }],
    ["nivel_carga", { version: "encargo/v1", criterio: { referencia: { concepto: "nivel_carga", valor: 2, unidad: "pct" } }, partes: [{ id: "p1", tema: "comercial", cierre: "decision", conceptos: ["ventas"], universo: { eje: "cliente", base: "carga comercial alta" } }] }],
    ["piso_rotacion", { version: "encargo/v1", criterio: { referencia: { concepto: "piso_rotacion", valor: 2.5, unidad: "ratio" } }, partes: [{ id: "p1", tema: "inventario", cierre: "decision", conceptos: ["capital"], universo: { eje: "sku", estados: ["rota lento"] } }] }],
  ];
  for (const [concepto, enc] of familias) {
    const E = entregaDe(enc);
    const t = E.ok ? (E.entrega.limites || []).filter((l) => String(l.titulo).startsWith("Con la referencia planteada en la consulta")).map((l) => l.titulo).join(" | ") : "";
    ok(E.ok === true && /, en vez del /.test(t) && !/en vez de el /.test(t), `[${concepto}] el título dice «en vez del …», no «en vez de el …»`, t || E.motivo);
  }
  const Ec = entregaDe(familias[1][1]);
  const unis = Ec.ok ? (Ec.entrega.universos || []).map((u) => u.texto).join(" | ") : "";
  ok(Ec.ok === true && /los clientes con carga comercial alta/.test(unis) && !/los clientes carga comercial alta/.test(unis), "«carga comercial alta» califica al grupo con su preposición: «los clientes con carga comercial alta»", unis || Ec.motivo);
  ok(nombrarUniverso({ eje: "cliente", base: "carga comercial alta" }, null) === "los clientes con carga comercial alta", "también sin índice (sin el valor de la referencia)");
  ok(nombrarUniverso({ eje: "cliente", base: "bajo el benchmark" }, null) === "los clientes bajo el benchmark" && nombrarUniverso({ eje: "cliente", base: "con saldo vencido" }, null) === "los clientes en mora", "CONTROL · los conjuntos que ya se decían bien no cambian");
  const conPrecede = CONJUNTOS_DE_LA_CASA.filter((c) => c.precede);
  ok(conPrecede.length >= 1 && conPrecede.every((c) => c.visible == null && !c.nombre.startsWith(c.precede + " ")), "la preposición es un dato del conjunto (`precede`), y solo lo llevan los que su nombre no la trae ya", conPrecede.map((c) => c.nombre).join(", "));
}

/* ══ BLOQUE (c) · VOCABULARIO VISIBLE — no vuelven las frases viejas (etapa 6, tarea 1) ══════════════════════════════ */
H("(c) · barrido: ninguna superficie migrada llama «frenado» a la regla de rotación");
{
  const leer = (p) => fs.readFileSync(p, "utf8");
  const LEGADO = [
    ["./src/ui/SentrixPanel.jsx", "qué se frena, qué reponer", "el tooltip de la pestaña Capital"],
    ["./src/ui/SentrixPanel.jsx", "Capital frenado · dónde está frenado tu capital", "el título de respaldo del panel de inventario"],
    ["./src/ui/GuiaInicio.jsx", "Separa capital inmovilizado de SKU frenados", "la glosa de la guía de inicio"],
    ["./src/adi/entrega/componer.js", "\"Capital frenado por bodega\"", "la oferta «Qué más puedo calcular» de la Entrega"],
    ["./src/adi/entrega/iniciativa.js", "del capital frenado total", "la oración de participación de la iniciativa"],
    ["./src/adi/agente/playbooks/contradiccionDeMetricas.js", "En dinero el capital frenado pesa", "la oración de contradicción de métricas"],
    // decisión del owner 2026-09-29, §7.3·31/34: los textos internos que ve el LLM dejan de explicar «frenado» con la regla de rotación (antes → después en cada archivo)
    ["./src/adi/agente/doctrinaAgente.js", "«frenado» el subconjunto crítico", "la doctrina de inventario que ve el agente"],
    ["./src/adi/notario/carta.js", "capital_frenado: \"Capital frenado\"", "el nombre del ranking en la carta de hechos"],
    ["./src/adi/notario/declaracion.js", "\\\"Capital frenado\\\"", "el ejemplo de métrica en la instrucción de declaración"],
    ["./src/adi/notario/declaracion.js", "\\\"del capital frenado\\\"", "el ejemplo de base en la instrucción de declaración"],
    ["./src/adi/oracle/narrationContract.js", "liberar el capital inmovilizado en inventario", "la acción permitida del capital detenido"],
    ["./src/adi/oracle/toolContracts.js", "el estado completo, el capital frenado", "las notas de inventoryStatus"],
    ["./src/adi/oracle/toolContracts.js", "que: \"el capital inmovilizado: qué SKU", "la lectura «frenado» de inventoryStatus"],
    ["./src/adi/agente/partesDelEncargo.js", "dónde hay capital frenado", "la parte «inventario» del encargo"],
    ["./src/adi/agente/partesDelEncargo.js", "Dónde tengo capital frenado", "la pregunta de la parte «inventario»"],
    ["./src/adi/agente/partesDelEncargo.js", "tienen capital frenado?", "la pregunta de la parte «cruce por SKU»"],
    ["./src/adi/agente/playbooks/crucePorSku.js", "tienen capital frenado", "los ejemplos y el entregable del playbook cruce-por-sku"],
    ["./src/adi/sentrix/viewManifest.js", "el dinero de la tira es el capital FRENADO", "la razón de concordancia de la tira «En alerta»"],
    ["./src/adi/sentrix/viewManifest.js", "el capital inmovilizado de la bodega es el mismo subconjunto", "la razón de concordancia del recibo de bodega"],
    // decisión del owner 2026-09-29, §7.3·31/34 (cierre del inventario, A): los `para:` que ve el LLM y la lista de estados de la instrucción de declaración (antes → después en cada archivo)
    ["./src/adi/agente/playbooks/contradiccionDeMetricas.js", "\"el capital frenado: el lado del monto", "el «para» de la lectura de inventario en la contradicción de métricas"],
    ["./src/adi/agente/playbooks/sintesisEjecutiva.js", "y el capital frenado — los subtotales", "el «para» del diagnóstico en la síntesis ejecutiva"],
    ["./src/adi/agente/playbooks/lecturaPorEje.js", "qué SKU tienen el capital frenado, con su monto", "el «para» de la lectura por eje de inventario"],
    ["./src/adi/encargo/lecturasDe.js", "liberar el capital frenado de", "el «para» de la simulación de capital"],
    ["./src/adi/notario/declaracion.js", "cada estado (frenado, inmovilizado, en riesgo de quiebre, crítico;", "la lista de estados de la instrucción de declaración"],
    ["./src/adi/oracle/guardC.js", "{ clave: \"con capital frenado\"", "el nombre del conjunto en el conteo de bodegas del juez de conteos (lo lee el LLM en la multa)"],
  ];
  for (const [ruta, frase, donde] of LEGADO) ok(!leer(ruta).includes(frase), `${donde}: ya no dice «${frase}»`);
}

H("(c) · la instrucción de declaración lista los estados con el significado vigente");
{
  const txt = instruccionDeDeclaracion();
  const lista = (txt.match(/cada estado \(([^)]*)\)/) || [])[1] || "";
  ok(/inmovilizado cr[ií]tico/.test(lista) && /frenado —venta interrumpida—/.test(lista) && /(?:^|, )inmovilizado,/.test(lista) && !/frenado, inmovilizado/.test(lista), "la lista de estados: inmovilizado · inmovilizado crítico · frenado (venta interrumpida) — sin el «frenado» de la regla de rotación", lista);
}

H("CERO llamadas a un LLM · CERO red — solo por npm run gates:offline");
{
  const fuente = fs.readFileSync("./_inventario_canon_gate.mjs", "utf8");
  const c = clasificarFuente(fuente);
  ok(c.tipo === "offline", "clasificarFuente(_inventario_canon_gate.mjs) === offline", JSON.stringify(c));
}

console.log(`\n── _inventario_canon_gate: PASS ${pass} · FAIL ${fail} (de ${pass + fail}) ──`);
if (fail) console.log(fails.map((f) => `  ✗ ${f}`).join("\n"));
process.exit(fail ? 1 : 0);
