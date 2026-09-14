/* === _cuatro_garantias_del_cruce_gate.mjs · EL ESTÁNDAR DE LOS CUATRO PUNTOS (owner 2026-09-14) ════════════════════
 * Tras la corrida en vivo del cruce de dominios (tres preguntas, cinco llamadas, transcripción en
 * `fixtures/cruce-vivo-2026-09-14.json`) el owner fijó el estándar de producto, textual:
 *   1. «una cifra correcta no puede quedar asociada a un atributo incorrecto, como bodega, sucursal, marca o entidad»;
 *   2. «cualquier relación cuantitativa expresada en palabras ("el doble", "cuatro veces", "la mitad", etc.) debe ser
 *      consistente con las cifras»;
 *   3. «en los cruces de dominios, la conclusión debe venir del análisis, no de la premisa del usuario. Si el dato
 *      demuestra lo contrario de lo que pregunta, ADI debe decirlo claramente»;
 *   4. «una respuesta buena del modelo no debe degradarse a un respaldo inferior por falsos positivos».
 *   «Valídalos offline con estos mismos borradores como fixtures y vuelve a correr la suite completa.»
 *
 * LO MEDIDO EN LA CORRIDA, que este gate congela:
 *   Q1 «¿Estoy sosteniendo stock en productos que venden bien pero dejan poca contribución?» → salió REPARADA y con tres
 *      defectos que ningún juez veía: las bodegas invertidas («Valparaíso el primero, Antofagasta el segundo» cuando
 *      MAK-COMP-AIR está en Antofagasta), «cuatro veces más lenta» con 95 contra 15 días (6.3×), y un «Sí, hay tres
 *      casos claros…» cuando lo medido dice que los que más venden también son los que más contribución dejan.
 *   Q2 «¿Los SKU que más vendo son también los que más capital me inmovilizan?» → el primer borrador del modelo era
 *      correcto y el muro lo tumbó dos veces por «17d»/«15d» «pegadas a otra entidad» (coordinación distributiva:
 *      «SAM-REF500L ($19K) y LG-WASH11KG ($15K) … (17d y 21d)»); la reparación cayó por cruce de universos (legítimo en
 *      el demo, que es divergente) y el usuario recibió el respaldo.
 *   Q3 «¿Mis principales clientes comerciales son también los que más me deben?» → verde del modelo; los jueces nuevos
 *      no le deben cobrar nada.
 *
 * CÓMO SE GARANTIZA CADA PUNTO (una regla, un archivo):
 *   1 → `atributoMalAsociado` (agente/atributosYRelaciones.js) en `vetosDeRegistro`: regla `atributo-mal-asociado`.
 *   2 → `relacionEnPalabrasNoCierra` (mismo archivo) en `vetosDeRegistro`: regla `relacion-en-palabras-no-cierra`.
 *   3 → el playbook `cruce-por-sku`: `_premisa` mide la premisa de la pregunta contra la boleta; el composer abre
 *       «No: …» / «Sí: …» con lo medido; `conclusiones(figs, pregunta)` se lo declara al cerebro ANTES de escribir; y la
 *       regla notarial `premisa-adoptada` veta abrir con «Sí» cuando lo medido dice que no (y al revés).
 *   4 → guardC: el sujeto de la oración es el dueño por defecto (`_atribucionAjenaEnBoleta`), la coordinación
 *       distributiva asigna por orden (`_grupoCoordinado`), y «17 días» se lee entero (`_finDeCifra`). Los candados que
 *       NO aflojan se prueban acá mismo.
 *
 * Cero red: cerebro mudo, herramientas puras, fixtures en disco. */
import fs from "node:fs";
import { initTenant } from "./src/data/tenantStore.js";
import { TENANT_DEMO } from "./src/data/tenants/demo.js";
import { ESCENARIO_INICIAL } from "./src/config/scenarios.js";
import { answerViaAgente } from "./src/adi/agente/bucleAgente.js";
import { dominiosDe, pasosDeDominios, unirPasosDeDominios } from "./src/adi/agente/contratoDeDominios.js";
import { playbookPara, pasosDe, vetosDelPlaybook } from "./src/adi/agente/playbooks/registro.js";
import { vetosDeRegistro } from "./src/adi/agente/contratoAgente.js";
import { atributoMalAsociado, relacionEnPalabrasNoCierra } from "./src/adi/agente/atributosYRelaciones.js";
import { runPlan } from "./src/adi/oracle/toolRunner.js";
import { TOOLS } from "./src/adi/oracle/toolRegistry.js";
import { cajaDelAgente } from "./src/adi/agente/herramientasAgente.js";
import { guardC } from "./src/adi/oracle/guardC.js";
import { cifrasDelDato } from "./src/adi/oracle/datoProyectado.js";
import { declararCompatibilidadActiva, compatibilidadActiva } from "./src/config/contract/figureType.js";

let PASS = 0, FAIL = 0;
const ok = (c, m, extra = "") => { if (c) { PASS++; console.log("  ✓ " + m); } else { FAIL++; console.log("  ✗ " + m + (extra ? "\n      " + extra : "")); } };
const H = (t) => console.log(`\n${t}`);
const CAJA = cajaDelAgente(TOOLS);
const MUDO = async () => ({ tipo: "texto", texto: "", stop: "end_turn" });
const FX = JSON.parse(fs.readFileSync(new URL("./fixtures/cruce-vivo-2026-09-14.json", import.meta.url), "utf8"));
const [Q1, Q2, Q3] = FX.corridas;
initTenant(TENANT_DEMO);

/* la boleta del turno, reconstruida como la arma el agente: playbook + dominios, cerebro mudo */
const boletaDe = (q) => {
  const pb = playbookPara(q, {});
  const pasos = unirPasosDeDominios(pb ? pasosDe(pb, q, {}) : [], pasosDeDominios(dominiosDe(q)));
  const rp = runPlan({ intent: "answer", calls: pasos.map((p) => ({ tool: p.tool, args: p.args || {} })) }, { scenario: ESCENARIO_INICIAL, maxCalls: 18, preguntaUsuario: q, registry: CAJA });
  return { figs: rp.ledger.figs || [], results: rp.results, pb, q };
};
const muro = (t, b) => { const v = guardC(t, { ledger: { figs: b.figs }, results: b.results, question: b.q, datoProyectado: cifrasDelDato(ESCENARIO_INICIAL), contentScope: "full" }); return v.ok ? [] : (v.violations || []); };
const registro = (t, b) => vetosDeRegistro(t, { figs: b.figs, pregunta: b.q });
const notarial = (t, b) => vetosDelPlaybook(b.pb, t, { figs: b.figs, pregunta: b.q });
const reglas = (v) => v.map((x) => x.regla);
const kinds = (v) => v.map((x) => x.kind);
const B1 = boletaDe(Q1.pregunta), B2 = boletaDe(Q2.pregunta), B3 = boletaDe(Q3.pregunta);

/* ═══ 0 · EL FIXTURE ═══════════════════════════════════════════════════════════════════════════════════════════════ */
H("0 · el fixture de la corrida en vivo (2026-09-14): tres turnos, con sus borradores y su final tal como salió");
ok(FX.corridas.length === 3 && FX.tenant === "demo", `tres corridas sobre el demo (${FX.fecha})`);
ok(Q1.final.estado === "reparado" && Q2.final.estado === "playbook" && Q3.final.estado === "verde", "los tres estados de salida medidos: reparado · playbook (respaldo) · verde");
ok(B1.pb && B1.pb.nombre === "cruce-por-sku" && B2.pb && B2.pb.nombre === "cruce-por-sku" && B3.pb && B3.pb.nombre === "cobranza", `los playbooks que atendieron cada pregunta (${[B1, B2, B3].map((b) => b.pb && b.pb.nombre).join(" · ")})`);

/* ═══ 1 · UNA CIFRA CORRECTA NO QUEDA ASOCIADA A UN ATRIBUTO INCORRECTO ═══════════════════════════════════════════════ */
H("1 · «una cifra correcta no puede quedar asociada a un atributo incorrecto, como bodega, sucursal, marca o entidad»");
{
  const vf = registro(Q1.final.texto, B1);
  const atr = vf.find((x) => x.regla === "atributo-mal-asociado");
  ok(!!atr, "★ el FINAL de Q1 (el que recibió el usuario) arde por «atributo-mal-asociado»: las bodegas invertidas", reglas(vf).join(","));
  ok(atr && /MAK-COMP-AIR/.test(atr.multa) && /Antofagasta/.test(atr.multa) && /bodega/.test(atr.multa), "…y la multa nombra al SKU, la bodega real y el atributo", atr && atr.multa.slice(0, 160));
  const corregido = Q1.final.texto.replace("(Valparaíso el primero, Antofagasta el segundo)", "(Antofagasta el primero, Valparaíso el segundo)");
  ok(corregido !== Q1.final.texto && !reglas(registro(corregido, B1)).includes("atributo-mal-asociado"), "el mismo texto con el reparto en el orden real ya no arde por atributo");
  /* los controles del juez, con el dato del demo (MAK-COMP-AIR en Antofagasta · Mercado Libre por E-commerce · SAM-TV55 de Samsung) */
  const arde = (t) => !!atributoMalAsociado(t), pasa = (t) => !atributoMalAsociado(t);
  ok(arde("MAK-COMP-AIR está en Valparaíso."), "arde: «MAK-COMP-AIR está en Valparaíso» (está en Antofagasta)");
  ok(arde("Mercado Libre (Retail) vende $5.5M."), "arde: «Mercado Libre (Retail)» (vende por E-commerce)");
  ok(arde("SAM-TV55, de la marca LG, vende $13.3M."), "arde: «SAM-TV55, de la marca LG» (es Samsung)");
  ok(pasa("MAK-COMP-AIR no está en Valparaíso, está en Antofagasta."), "pasa: la negación («no está en Valparaíso, está en Antofagasta»)");
  ok(pasa("LG-DRYER8KG tiene $14K frenados; por bodega, Valparaíso concentra $25K y Antofagasta $8K."), "pasa: un desglose por bodega en la misma oración no es una asociación");
  ok(pasa("MAK-COMP-AIR ($8K frenados en Antofagasta) y LG-DRYER8KG ($14K en Valparaíso)."), "pasa: cada SKU con su bodega real");
  ok(pasa("Falabella (Retail) vende $19.4M."), "pasa: Falabella con su canal real");
}

/* ═══ 2 · LA RELACIÓN DICHA EN PALABRAS ES CONSISTENTE CON LAS CIFRAS ══════════════════════════════════════════════════ */
H("2 · «cualquier relación cuantitativa expresada en palabras debe ser consistente con las cifras»");
{
  const vf = registro(Q1.final.texto, B1);
  const rel = vf.find((x) => x.regla === "relacion-en-palabras-no-cierra");
  ok(!!rel, "★ el FINAL de Q1 arde por «relacion-en-palabras-no-cierra»: «cuatro veces más lenta» con 95 contra 15 días", reglas(vf).join(","));
  ok(rel && /«cuatro veces»/.test(rel.multa) && /6\.3 veces/.test(rel.multa), "…y la multa trae la relación real (6.3 veces)", rel && rel.multa.slice(0, 120));
  const corregido = Q1.final.texto.replace("cuatro veces más lenta", "seis veces más lenta");
  ok(corregido !== Q1.final.texto && !reglas(registro(corregido, B1)).includes("relacion-en-palabras-no-cierra"), "con «seis veces» (95/15 = 6.3) el mismo texto pasa");
  const arde = (t) => !!relacionEnPalabrasNoCierra(t), pasa = (t) => !relacionEnPalabrasNoCierra(t);
  ok(pasa("liberar esos dos suma $22K, casi dos tercios del capital frenado total ($33K)."), "pasa: «casi dos tercios» con 22/33");
  ok(pasa("LG-DRYER8KG tiene $14K frenados, casi el doble que MAK-COMP-AIR ($8K)."), "pasa: «casi el doble» con 1.75×");
  ok(pasa("Falabella vende $19.4M, más del doble que Sodimac ($8.2M)."), "pasa: «más del doble» con 2.37×");
  ok(arde("Falabella vende $19.4M, el doble que Sodimac ($8.2M)."), "arde: «el doble» a secas con 2.37× (se dice «más del doble»)");
  ok(arde("Falabella vende $19.4M, más del doble que Lider ($17.8M)."), "arde: «más del doble» con 1.09× (la contracción «del doble» se lee)");
  ok(arde("Lider ($17.8M) vende la mitad que el total de los tres grandes ($54.5M)."), "arde: «la mitad» con 33%");
  ok(pasa("Sodimac vende $8.2M, menos de la mitad que Falabella ($19.4M)."), "pasa: «menos de la mitad» con 0.42×");
  ok(arde("LG-DRYER8KG tiene 165 días de inventario, cerca del triple que PHI-SHAVER9 (15 días)."), "arde: «cerca del triple» con 11×");
  ok(pasa("LG-DRYER8KG tiene 165 días de inventario, once veces PHI-SHAVER9 (15 días)."), "pasa: «once veces» con 11×");
  ok(pasa("A veces la venta cae. Falabella vende $19.4M."), "pasa: «a veces» no es una relación");
}

/* ═══ 3 · LA CONCLUSIÓN VIENE DEL ANÁLISIS, NO DE LA PREMISA ═══════════════════════════════════════════════════════════ */
H("3 · «la conclusión debe venir del análisis, no de la premisa del usuario. Si el dato demuestra lo contrario, ADI debe decirlo»");
{
  const vf = notarial(Q1.final.texto, B1);
  const pre = vf.find((x) => x.regla === "premisa-adoptada");
  ok(!!pre, "★ el FINAL de Q1 («Sí, hay tres casos claros…») arde por «premisa-adoptada»: abre con «Sí» y lo medido dice que no", reglas(vf).join(","));
  ok(pre && /venden bien dejan poca contribuci/.test(pre.multa) && /también están entre los que más contribución dejan/.test(pre.multa), "…y la multa cita la premisa de la pregunta y lo medido", pre && pre.multa.slice(0, 200));
  ok(Q1.borradores.every((b) => reglas(notarial(b.texto, B1)).includes("premisa-adoptada")), "los dos borradores de Q1 (mismo arranque) también");
  const abreNo = Q1.final.texto.replace(/^\*{0,2}Sí, hay tres casos claros/, "No: los que más venden también dejan contribución; hay tres casos");
  ok(abreNo !== Q1.final.texto && !reglas(notarial(abreNo, B1)).includes("premisa-adoptada"), "el mismo texto abriendo con «No: …» no arde");
  ok(Q2.borradores.every((b) => !reglas(notarial(b.texto, B2)).includes("premisa-adoptada")), "Q2 abría «No, son dos listas distintas» con la premisa falsa: correcto, no arde");
  /* el piso determinístico y la doctrina dicen lo medido, no lo preguntado */
  const r1 = await answerViaAgente({ text: Q1.pregunta, history: [], mem: {}, scenario: ESCENARIO_INICIAL, callAgente: MUDO });
  ok(r1.r.agente.estado === "playbook" && /^No: los que más venden también están entre los que más contribución dejan: SAM-TV55/.test(r1.r.text), "★ el piso de Q1 abre «No: los que más venden también están entre los que más contribución dejan: SAM-TV55…»", r1.r.text.slice(0, 120));
  const r2 = await answerViaAgente({ text: Q2.pregunta, history: [], mem: {}, scenario: ESCENARIO_INICIAL, callAgente: MUDO });
  ok(r2.r.agente.estado === "playbook" && /^No: entre los que más venden no aparece capital frenado/.test(r2.r.text), "★ el piso de Q2 abre «No: entre los que más venden no aparece capital frenado…»", r2.r.text.slice(0, 120));
  const d1 = B1.pb.conclusiones(B1.figs, Q1.pregunta);
  ok(/CONCLUSIÓN DEL PROCEDIMIENTO/.test(d1) && /es FALSA en este dato/.test(d1) && /en vez de abrir con «sí»/i.test(d1), "la doctrina que viaja al cerebro declara la premisa FALSA y manda abrir con «No: …» en vez de «sí»", d1.slice(0, 200));
  ok(/es FALSA en este dato/.test(B2.pb.conclusiones(B2.figs, Q2.pregunta)), "…y en Q2 igual (la premisa «más venden = más capital» es falsa en el demo)");
}

/* ═══ 4 · UNA RESPUESTA BUENA DEL MODELO NO SE DEGRADA POR FALSOS POSITIVOS ════════════════════════════════════════════ */
H("4 · «una respuesta buena del modelo no debe degradarse a un respaldo inferior por falsos positivos»");
{
  const m1 = muro(Q2.borradores[0].texto, B2);
  ok(m1.length === 0 && registro(Q2.borradores[0].texto, B2).length === 0 && notarial(Q2.borradores[0].texto, B2).length === 0,
    "★ el borrador 1 de Q2 (el primero del modelo, correcto) pasa el muro, el registro y el playbook — en vivo cayó por «17d»/«15d» «pegadas a otra entidad»", kinds(m1).join(","));
  const m2 = muro(Q2.borradores[1].texto, B2);
  ok(m2.length > 0 && kinds(m2).every((k) => k === "cruce-de-universos"), "el borrador 2 de Q2 solo arde por «cruce-de-universos» (legítimo: el demo declara divergente), ya no por proximidad ni por «$15K narrado como cobertura»", kinds(m2).join(","));
  ok(!m2.some((x) => /narrado como cobertura|pegada a otra entidad/.test(String(x.detail))), "…ni una sola multa de dueño o de métrica en ese borrador");
  /* el mismo borrador 2 en un pack COMPARABLE (lo que declara la ingesta de una planilla): nombra sus marcos y pasa entero */
  declararCompatibilidadActiva({ "inventario|venta_comercial": { estado: "comparable", razon: "misma moneda cruda; venta del período cerrado contra foto de inventario", marcos: { venta_comercial: "período cerrado (2026-08)", inventario: "foto de inventario al 2026-09-01" } } });
  const mc = muro(Q2.borradores[1].texto, B2);
  ok(mc.length === 0 && registro(Q2.borradores[1].texto, B2).length === 0 && notarial(Q2.borradores[1].texto, B2).length === 0, "★ en un pack comparable el borrador 2 de Q2 pasa entero (nombra «en el año» y «la foto actual»)", kinds(mc).join(","));
  initTenant(TENANT_DEMO);
  ok(compatibilidadActiva()["inventario|venta_comercial"].estado === "divergent", "el demo vuelve a su declaración (divergente)");
  const m3 = muro(Q3.final.texto, B3);
  ok(m3.length === 0 && registro(Q3.final.texto, B3).length === 0 && notarial(Q3.final.texto, B3).length === 0, "★ el verde de Q3 sigue verde: los jueces nuevos no le cobran nada", kinds(m3).concat(reglas(registro(Q3.final.texto, B3))).join(","));
  ok(muro(Q1.final.texto, B1).length === 0, "el final de Q1 pasa el muro: sus tres defectos los cobran el registro y el playbook, no el muro (una regla, un archivo)");
  /* LOS CANDADOS QUE NO AFLOJAN */
  const ardeM = (t, b, kind) => muro(t, b).some((x) => x.kind === kind);
  ok(ardeM("Lider vende $19.4M.", B3, "cifra-de-boleta-sin-dueno"), "candado: «Lider vende $19.4M» (es de Falabella) sigue ardiendo");
  ok(ardeM("Falabella lidera la venta con diferencia y sostiene la mayor parte del canal retail durante todo el año cerrado, mientras que Lider vende $19.4M.", B3, "cifra-de-boleta-sin-dueno"), "candado: el dueño lejos y otra entidad entre medio sigue ardiendo");
  ok(!ardeM("Falabella lidera la venta con diferencia y sostiene la mayor parte del canal retail durante todo el año cerrado, con una venta anual de $19.4M.", B3, "cifra-de-boleta-sin-dueno"), "el sujeto de la oración es el dueño por defecto: Falabella a más de 90 caracteres, sin nadie entre medio, libre");
  ok(ardeM("PHI-HAIR-PRO y PHI-SHAVER9 son el mejor caso de la lista — lideran contribución con diferencia sobre el resto del catálogo, sostienen margen sin pedir capital y tienen cobertura corta (15 días y 19 días).", B2, "cifra-de-boleta-sin-dueno"), "candado: la coordinación distributiva INVERTIDA («PHI-HAIR-PRO y PHI-SHAVER9 … (15 días y 19 días)») arde");
  ok(!ardeM("PHI-SHAVER9 y PHI-HAIR-PRO son el mejor caso de la lista — lideran contribución con diferencia sobre el resto del catálogo, sostienen margen sin pedir capital y tienen cobertura corta (15 días y 19 días).", B2, "cifra-de-boleta-sin-dueno"), "…y en el orden real pasa");
  ok(!ardeM("SAM-REF500L ($19K, con 17 días de cobertura) y LG-WASH11KG ($15K, con 21 días) rotan rápido.", B2, "metrica-mal-atribuida") && !ardeM("SAM-REF500L ($19K, con 17 días de cobertura) y LG-WASH11KG ($15K, con 21 días) rotan rápido.", B2, "cifra-de-boleta-sin-dueno"), "«17 días» se lee entero: «$15K» ya no se cobra como «narrado como cobertura»");
}

console.log(`\n── _cuatro_garantias_del_cruce_gate: ${PASS} PASS · ${FAIL} FAIL (de ${PASS + FAIL}) ──`);
process.exit(FAIL ? 1 : 0);
