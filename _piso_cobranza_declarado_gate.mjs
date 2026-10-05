/* === _piso_cobranza_declarado_gate.mjs · EL PISO DE MATERIALIDAD DE COBRANZA, DECLARADO POR LA EMPRESA CONVERSANDO (Etapa 2, bloque 5 · owner 2026-10-04, offline) ═══════════════════════════════════
 * EL ALCANCE QUE CIERRA: el piso de cobranza (PRI-04, `config/contract/pisoMaterialidadCobranza.js`, k = 1 % del saldo pendiente, criterio general de ADI, rango 0,1–10 %) pasa a funcionar como los demás criterios
 * del bloque 3. (1) La empresa lo DECLARA conversando: `aportarContexto`, clase «criterio», concepto `piso_materialidad_cobranza`, valida el rango, queda PENDIENTE hasta la confirmación y se recuerda en la memoria
 * de empresa. (2) Su PROCEDENCIA sale de la función única de origen (`businessPolicy.js:pisoMaterialidadCobranzaDe` sobre `procedenciaDeLlave`): declarado → «declarado por la empresa»; sin declaración → «criterio
 * general de ADI, ajustable por la empresa»; nada de frases escritas a mano ni «supuesto del usuario» para lo que la empresa declaró; el camino B (`tenant.perfil.pisoMaterialidadCobranza`) se conserva como fuente válida.
 * (3) PRI-04 usa el piso vigente y cada texto nombra a su dueño. (4) FRONTERA DEL OWNER, garantía dura: «el piso es un criterio de materialidad/señal, NO modifica saldos, atrasos ni ninguna medición de cobranza»:
 * declarar otro piso solo puede cambiar qué cuentas quedan como señal · bajo el piso · borde.
 *
 *   §1  LA TABLA: el concepto tiene lugar en la lista de lo declarable; el rango es el del contrato; la nota de frontera viaja con él.
 *   §2  DECLARAR POR `aportarContexto`: pendiente → no cuenta; confirmado → PRI-04 lo usa y nombra «declarado por tu empresa»; fuera de rango o con entidad/período → rechazado con el motivo; se recuerda en la memoria.
 *   §3  EL ORIGEN: sin declaración, «criterio general de ADI»; camino B y chat bajo LA MISMA función (lo dicho conversando manda); nunca «supuesto del usuario»; un piso tomado de un documento conserva su rastro.
 *   §4  LA FRONTERA: con 0,5 % y con 5 % sobre la misma cartera todo lo medido es idéntico y solo cambian los veredictos; ninguna parte de la cobranza lee el piso.
 *   §5  AISLAMIENTO: otra empresa nunca ve el piso declarado; sin residuo fuera del tramo.
 *   §6  ATRIBUCIÓN: cero atribuciones falsas por significado (oráculo independiente) en las tres empresas.
 *   §7  CARNADAS (cada defecto, puesto a propósito, tiene que ponerse en rojo).
 *
 * CERO llamadas a un LLM · CERO red. Solo por `npm run gates:offline` o `node --import ./scripts/offline-guard.mjs _piso_cobranza_declarado_gate.mjs`. */
import fs from "node:fs";
import { crearAcciones, _datasetDeLaEmpresa } from "./src/adi/capacidad/acciones.js";
import { crearAlmacenEnMemoria } from "./src/adi/continuidad/almacen.js";
import { perfilDeLasFilas } from "./src/adi/continuidad/empresa.js";
import * as LD from "./src/adi/capacidad/loDeclarado.js";
import { conTenantActivo } from "./src/adi/capacidad/aislamiento.js";
import * as BP from "./src/config/businessPolicy.js";
import { PISO_MATERIALIDAD_COBRANZA_CRITERIO_ADI, PISO_MATERIALIDAD_COBRANZA_MIN, PISO_MATERIALIDAD_COBRANZA_MAX } from "./src/config/contract/pisoMaterialidadCobranza.js";
import { validateDataset } from "./src/config/contract/validator.js";
import { TENANT_DEMO } from "./src/data/tenants/demo.js";
import { initTenant, getTenantData } from "./src/data/tenantStore.js";
import { validarEncargo } from "./src/adi/encargo/validar.js";
import { componerEntrega } from "./src/adi/entrega/componer.js";
import { referenciasDe } from "./src/adi/continuidad/revalidar.js";
import { textosDePiso, medicionesDeCobranza, deLaEmpresa, PIEZA_PISO } from "./scripts/procedencia/textosDePiso.mjs";
import { medirPieza } from "./src/adi/conocimiento/medir.js";
import { servirPieza } from "./src/adi/conocimiento/servir.js";

let pass = 0, fail = 0;
const fails = [];
const ok = (c, m, extra = "") => { if (c) { pass++; } else { fail++; fails.push(m + (extra ? " — " + extra : "")); console.log("  ✗ " + m + (extra ? "\n      " + String(extra).slice(0, 700) : "")); } };
const H = (t) => console.log(`\n${t}`);
const jj = (x) => JSON.stringify(x);
const leer = (p) => fs.readFileSync(new URL(p, import.meta.url), "utf8");
const sinComentarios = (src) => String(src).replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`\\])\/\/[^\n]*/g, "$1");
const CONCEPTO = "piso_materialidad_cobranza";
/* quién LEE el piso: la función de origen, su tabla, el concepto declarable, la validación del camino B, o el perfil/la llave por su nombre (el nombre del CÁLCULO de PRI-04, `calculo: "pisoMaterialidadCobranza"`, no es el piso) */
const RE_LECTOR = /pisoMaterialidadCobranzaDe|piso_materialidad_cobranza|CRITERIOS_FUERA_DE_POLICY|pisoDelCaminoB|perfil\??\.pisoMaterialidadCobranza|umbral\(\s*["']pisoMaterialidadCobranza/;
const ETQ_EMPRESA_TU = "declarado por tu empresa", ETQ_ADI_TU = "criterio general de ADI, ajustable por tu empresa";
const { atribuciones, esFalsa } = await import("./scripts/procedencia/lexicoAtribucion.mjs");

/* ── el campo de prueba: el demo con dos empresas (A y B) en un MISMO almacén, un reloj fijo y la memoria real ── */
let _tick = 0;
const reloj = () => new Date(Date.UTC(2026, 9, 4, 12, 0, 0) + (++_tick) * 1000).toISOString();
const tenantDe = (id) => ({ id, dataset: TENANT_DEMO, version: "v1" });
const aporte = (valor, extra = {}) => ({ clase: "criterio", concepto: CONCEPTO, valor: { raw: valor, unidad: "pct" }, ...extra });
const cmpTxt = (a, b) => String(a) === String(b);
/* declarar y confirmar de una vez (lo que hace el anfitrión cuando la persona dijo «sí»): devuelve el id de la fila */
async function declararYConfirmar(A, tenant, valor, extra = {}) {
  const r = await A.aportarContexto({ tenant, aportes: [aporte(valor, extra)] });
  const id = r.ok && r.resultados[0] ? r.resultados[0].id : null;
  if (id) await A.aportarContexto({ tenant, conversacionId: r.conversacionId, confirmar: [id] });
  return { id, r };
}
/* el dataset «de hoy» de una empresa, armado por LA MISMA función que usan `consultar` y `retomar` (la memoria → lo vigente → el perfil que rige) */
async function datasetDeHoy(store, tenant) {
  const filas = (await store.leerHechosEmpresa(tenant.id)) || [];
  return _datasetDeLaEmpresa(tenant.dataset, perfilDeLasFilas(filas), LD.clasificarLoDeclarado(filas));
}
const pisoDe = (dataset) => BP.pisoMaterialidadCobranzaDe(dataset);

/* ═══ 1 · LA TABLA ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════ */
H("1 · la tabla: el piso tiene lugar entre los criterios declarables, con el rango del contrato y su frontera");
{
  const d = LD.declarable();
  const e = d.criterios.find((c) => c.concepto === CONCEPTO);
  ok(!!e && e.comoDeclarar.clase === "criterio" && e.comoDeclarar.concepto === CONCEPTO && e.unidad === "pct", "★ `declarable()` ofrece el concepto `piso_materialidad_cobranza` con la forma exacta del aporte (clase «criterio», en %)", jj(e));
  ok(!!e && e.min === PISO_MATERIALIDAD_COBRANZA_MIN * 100 && e.max === PISO_MATERIALIDAD_COBRANZA_MAX * 100, `★ su rango es el del contrato (${PISO_MATERIALIDAD_COBRANZA_MIN * 100}–${PISO_MATERIALIDAD_COBRANZA_MAX * 100} %), nunca un número escrito aparte`, jj(e));
  ok(!!e && /no modifica ningún saldo, atraso ni medición de cobranza/.test(e.nota || ""), "★ la FRONTERA viaja con el concepto: «no modifica ningún saldo, atraso ni medición de cobranza»", e && e.nota);
  ok(LD.esReferenciaDeLaCasa(CONCEPTO) && LD.lugarDeAporte({ clase: "criterio", concepto: CONCEPTO }).enLaEntrega === true, "el aporte tiene lugar: la Entrega lo usará al confirmarse");
  const lugar = LD.lugarDeAporte({ clase: "criterio", concepto: CONCEPTO });
  ok(/declarado por la empresa/.test(lugar.como) && /no modifica ningún saldo, atraso ni medición de cobranza/.test(lugar.como), "★ al declararlo, ADI dice dónde se usa («declarado por la empresa») y que NO modifica ninguna medición de cobranza", lugar.como);
  const lugarOff = LD.lugarDeAporte({ clase: "criterio", concepto: CONCEPTO }, { conocimientoActivo: false });
  ok(lugarOff.enLaEntrega === false && /hoy no está activa/.test(lugarOff.motivo) && /no modifica ningún saldo, atraso ni medición de cobranza/.test(lugarOff.motivo), "★ con la capa de conocimiento APAGADA ADI no promete que la Entrega lo use: lo dice («hoy no está activa») y repite la frontera", lugarOff.motivo);
  ok(LD.lugarDeAporte({ clase: "hecho", concepto: CONCEPTO }).enLaEntrega === false, "como «hecho» no tiene lugar: es un criterio y se declara con esa clase");
  const c = BP.CRITERIOS_FUERA_DE_POLICY.pisoMaterialidadCobranza;
  ok(c.adi === PISO_MATERIALIDAD_COBRANZA_CRITERIO_ADI * 100 && c.min === PISO_MATERIALIDAD_COBRANZA_MIN * 100 && c.max === PISO_MATERIALIDAD_COBRANZA_MAX * 100, "la tabla de origen sale de las constantes del contrato (ningún dígito escrito aparte)");
  ok(!("pisoMaterialidadCobranza" in BP.POLICY_CONFIG) && !("pisoMaterialidadCobranza" in BP.POLICY), "no es una llave de POLICY: no lo lee el Core (la frontera, por construcción)");
}

/* ═══ 2 · DECLARAR POR `aportarContexto` ═══════════════════════════════════════════════════════════════════════════════════════════ */
H("2 · declarar por `aportarContexto`: pendiente no cuenta · confirmado, PRI-04 lo usa y nombra «declarado por tu empresa» · fuera de rango, rechazado con su motivo");
const store = crearAlmacenEnMemoria();
/* la capa de conocimiento ACTIVA: es lo que hace que el piso rija (PRI-04); con ella apagada se prueba aparte, más abajo, que ADI no promete lo que no pasa */
const A = crearAcciones({ continuidad: store, ahora: reloj, conocimiento: { activo: true } });
const TA = tenantDe("empresa-a"), TB = tenantDe("empresa-b");
let idA = null;
{
  const base = await datasetDeHoy(store, TA);
  const p0 = pisoDe(base.dataset);
  ok(p0.k === PISO_MATERIALIDAD_COBRANZA_CRITERIO_ADI && p0.origen === "adi" && p0.declaradoPorLaEmpresa === false, "sin declarar nada, rige el criterio general de ADI (1 %)", jj(p0));
  const t0 = textosDePiso(base.dataset);
  ok(t0.length > 0 && t0.every((t) => !t.includes(ETQ_EMPRESA_TU)) && t0.some((t) => t.includes(ETQ_ADI_TU)) && t0.some((t) => t.includes("el piso de ADI")), "★ sin declaración: «criterio general de ADI, ajustable por tu empresa» y «el piso de ADI» — jamás «declarado»", t0.slice(0, 2).join(" | "));

  const r1 = await A.aportarContexto({ tenant: TA, aportes: [aporte(0.5)] });
  idA = r1.resultados[0].id;
  ok(r1.ok && r1.resultados[0].estado === "pendiente" && r1.resultados[0].paraConfirmar === true && r1.resultados[0].lugar.enLaEntrega === true, "★ declarar 0,5 %: queda PENDIENTE hasta la confirmación y dice dónde se usará", jj(r1.resultados[0]));
  ok(/no modifica ningún saldo, atraso ni medición de cobranza/.test(r1.resultados[0].lugar.como), "el aviso de dónde se usa trae la FRONTERA", r1.resultados[0].lugar.como);

  const pendiente = await datasetDeHoy(store, TA);
  const pP = pisoDe(pendiente.dataset);
  ok(pP.origen === "adi" && pP.k === PISO_MATERIALIDAD_COBRANZA_CRITERIO_ADI && pendiente.criteriosAplicados.length === 0, "★ SIN CONFIRMAR no cuenta: rige el piso de ADI y no se aplica ningún criterio", jj(pP));
  ok(textosDePiso(pendiente.dataset).every((t) => !t.includes(ETQ_EMPRESA_TU)), "★ …y ningún texto de PRI-04 lo atribuye a la empresa mientras está pendiente");
  const c1 = await A.conocerEmpresa({ tenant: TA });
  ok(!c1.hechosAportados.some((h) => h.concepto === CONCEPTO) && (c1.pendientesDeConfirmar || []).some((h) => h.concepto === CONCEPTO || (h.entendido && h.entendido.concepto === CONCEPTO) || h.id === idA), "pendiente: no figura como dato vigente de la empresa, sí como pendiente de confirmar", jj(c1.pendientesDeConfirmar));

  await A.aportarContexto({ tenant: TA, conversacionId: r1.conversacionId, confirmar: [idA] });
  const vig = await datasetDeHoy(store, TA);
  const pV = pisoDe(vig.dataset);
  ok(pV.k === 0.005 && pV.origen === "empresa" && pV.declaradoPorLaEmpresa === true && vig.criteriosAplicados.length === 1 && vig.criteriosAplicados[0].llave === "pisoMaterialidadCobranza" && vig.criteriosAplicados[0].valor === 0.5, "★ CONFIRMADO: PRI-04 usa el piso declarado (0,5 %) y el origen es «empresa»", jj(pV));
  ok(pV.procedencia !== "supuesto_usuario" && pV.etiqueta === ETQ_EMPRESA_TU, "★ lo que la empresa declaró NO es un «supuesto del usuario»: la etiqueta sale de la función de origen («declarado por tu empresa»)", jj(pV));
  const tv = textosDePiso(vig.dataset);
  ok(tv.length > 0 && tv.every((t) => !t.includes("piso de ADI") && !t.includes("criterio general de ADI")), "★ con el piso declarado, NINGÚN texto de PRI-04 nombra a ADI como dueño del piso", tv.filter((t) => /piso de ADI|criterio general/.test(t)).slice(0, 1).join(""));
  ok(tv.some((t) => t.includes(`Piso: 0.5% del saldo pendiente`) && t.includes(ETQ_EMPRESA_TU)) && tv.some((t) => /[Ss]upera el piso declarado por tu empresa \(0\.5% del saldo pendiente evaluable/.test(t)), "★ las líneas nombran el valor declarado y su dueño: «Piso: 0.5% del saldo pendiente (…), declarado por tu empresa» · «supera el piso declarado por tu empresa (0.5% …)»", tv.slice(0, 3).join(" | "));
  const c2 = await A.conocerEmpresa({ tenant: TA });
  ok(c2.hechosAportados.some((h) => h.concepto === CONCEPTO && h.estado === "vigente"), "★ se recuerda en la memoria de la empresa (vigente, con su sello de confirmación)", jj(c2.hechosAportados.map((h) => h.concepto)));
  const ref = referenciasDe({ criteriosAplicados: vig.criteriosAplicados });
  ok(ref.criterios.some((c) => c.llave === "pisoMaterialidadCobranza" && c.valor === 0.5 && c.origen === "declarado"), "la referencia con que se calculó queda anotada (si el piso cambia, la continuidad lo ve como una referencia distinta)", jj(ref));

  /* la Entrega real (consultar) lo trae en `declarado.criterios`, con su origen, su aviso de frontera y lo que desplaza */
  const enc = { version: "encargo/v1", partes: [{ id: "p1", tema: "cobranza", cierre: "cifra", conceptos: ["saldo_pendiente"], entidades: [{ nombre: "Lider", eje: "cliente" }] }] };
  const cons = await A.consultar({ tenant: TA, encargo: enc });
  const dc = cons.ok && cons.declarado && cons.declarado.criterios.find((c) => c.concepto === CONCEPTO);
  ok(!!dc && dc.valor === 0.5 && dc.etiquetaDeOrigen === "declarado por la empresa" && /no modifica ningún saldo, atraso ni medición de cobranza/.test(dc.aplicadoComo) && dc.desplaza.origen === "adi", "★ `consultar` lo muestra declarado: «declarado por la empresa», con su frontera y lo que desplaza (el criterio de ADI)", jj(dc));
}

/* — la capa de conocimiento APAGADA: se declara y se confirma igual (queda en la memoria), pero ADI no dice que la Entrega lo use — */
{
  const sOff = crearAlmacenEnMemoria(); const AOff = crearAcciones({ continuidad: sOff, ahora: reloj, conocimiento: { activo: false } }); const TOff = tenantDe("empresa-off");
  const r = await AOff.aportarContexto({ tenant: TOff, aportes: [aporte(2)] });
  ok(r.ok && r.resultados[0].estado === "pendiente" && r.resultados[0].lugar.enLaEntrega === false && /hoy no está activa/.test(r.resultados[0].lugar.motivo), "★ con la capa apagada: se guarda (pendiente) y el aviso dice que hoy no rige", jj(r.resultados[0].lugar));
  await AOff.aportarContexto({ tenant: TOff, conversacionId: r.conversacionId, confirmar: [r.resultados[0].id] });
  const enc = { version: "encargo/v1", partes: [{ id: "p1", tema: "cobranza", cierre: "cifra", conceptos: ["saldo_pendiente"], entidades: [{ nombre: "Lider", eje: "cliente" }] }] };
  const c = await AOff.consultar({ tenant: TOff, encargo: enc });
  const dc = c.ok && c.declarado && c.declarado.criterios.find((x) => x.concepto === CONCEPTO);
  ok(!!dc && /sin efecto hoy/.test(dc.aplicadoComo) && /no modifica ningún saldo, atraso ni medición de cobranza/.test(dc.aplicadoComo), "★ con la capa apagada, `declarado.criterios` dice que el piso no tiene efecto hoy (no finge haberlo aplicado)", jj(dc));
  const m = await AOff.conocerEmpresa({ tenant: TOff });
  ok(m.hechosAportados.some((h) => h.concepto === CONCEPTO && h.estado === "vigente"), "y se recuerda en la memoria de la empresa igual (vigente)");
}

/* — fuera de rango, con entidad o período, valor que no es número: rechazados con el motivo — */
{
  const malo = async (valor, extra = {}) => A.aportarContexto({ tenant: tenantDe("empresa-rechazos"), aportes: [aporte(valor, extra)] });
  for (const [valor, quees] of [[0.05, "por debajo del mínimo (0,1 %)"], [11, "por encima del máximo (10 %)"], [0, "cero"], [-1, "negativo"], ["mucho", "no es un número"]]) {
    const r = await malo(valor);
    ok(r.ok && r.resultados[0].estado === "rechazado" && /piso_materialidad_cobranza/.test(r.resultados[0].motivo || ""), `★ ${valor} (${quees}): RECHAZADO con motivo`, jj(r.resultados[0]));
  }
  const rr = await malo(50);
  ok(/0\.1 y 10 \(pct\)/.test(rr.resultados[0].motivo), "★ el motivo dice el rango en que sí se declara (0.1 y 10, en %)", rr.resultados[0].motivo);
  const re = await malo(2, { entidad: "Lider" }), rp = await malo(2, { periodo: "2026-Q1" });
  ok(re.resultados[0].estado === "rechazado" && /toda la empresa/.test(re.resultados[0].motivo) && rp.resultados[0].estado === "rechazado", "un piso vale para toda la empresa: con una entidad o un período, rechazado", jj([re.resultados[0].motivo, rp.resultados[0].motivo]));
  const ok1 = await malo(0.1), ok2 = await malo(10);
  ok(ok1.resultados[0].estado === "pendiente" && ok2.resultados[0].estado === "pendiente", "los bordes del rango (0,1 % y 10 %) sí se aceptan");
  const f = await store.leerHechosEmpresa("empresa-rechazos");
  ok(f.filter((x) => x.concepto === CONCEPTO).length === 2, "lo rechazado no entra a la memoria (solo los dos bordes aceptados)", String(f.length));
}

/* ═══ 3 · EL ORIGEN: UNA SOLA FUNCIÓN ═════════════════════════════════════════════════════════════════════════════════════════════ */
H("3 · el origen: sin declarar es «criterio general de ADI» · camino B y chat bajo la misma función · un documento conserva su rastro");
{
  const demo = pisoDe(TENANT_DEMO);
  ok(demo.k === PISO_MATERIALIDAD_COBRANZA_CRITERIO_ADI && demo.origen === "adi" && demo.etiqueta === ETQ_ADI_TU && demo.dueno === "el piso de ADI" && demo.procedencia === "estimacion_referencia", "★ el demo (no declara piso): criterio general de ADI, «el piso de ADI»", jj(demo));
  const caminoB = pisoDe({ perfil: { pisoMaterialidadCobranza: { valor: 0.05, procedencia: "medido" } } });
  ok(caminoB.k === 0.05 && caminoB.origen === "empresa" && caminoB.etiqueta === ETQ_EMPRESA_TU && caminoB.procedencia === "estimacion_referencia", "★ el camino B (el perfil de la ficha) se conserva: es lo declarado, bajo LA MISMA función, y ya no se llama «supuesto del usuario»", jj(caminoB));
  for (const malo of [{ valor: 0.5, procedencia: "medido" }, { valor: 0.0001, procedencia: "medido" }, { valor: 0.05, procedencia: "propuesta" }, { valor: "x", procedencia: "medido" }, 11, 99, -2, 0.05, "1", null]) {
    const r = pisoDe({ perfil: { pisoMaterialidadCobranza: malo } });
    ok(r.origen === "adi" && r.k === PISO_MATERIALIDAD_COBRANZA_CRITERIO_ADI, `mal formado o fuera de rango (${jj(malo)}) → el criterio de ADI, nunca un número inventado`, jj(r));
  }
  /* los dos caminos a la vez: lo que declara conversando y confirma manda sobre el perfil (la regla de siempre del bloque 3) */
  const dsB = { ...TENANT_DEMO, perfil: { ...TENANT_DEMO.perfil, pisoMaterialidadCobranza: { valor: 0.05, procedencia: "medido" } } };
  const mezcla = BP.conCriteriosDeEmpresa(dsB, { pisoMaterialidadCobranza: 2 });
  const pm = pisoDe(mezcla.dataset);
  ok(pm.k === 0.02 && pm.origen === "empresa" && mezcla.aplicados[0].desplaza.origen === "empresa" && mezcla.aplicados[0].desplaza.valor === 5, "perfil (5 %) + lo dicho conversando (2 %): manda lo conversado y se declara lo que desplazó", jj([pm, mezcla.aplicados]));
  ok(BP.umbralDePerfil(mezcla.dataset.perfil, "pisoMaterialidadCobranza").valor === 2, "`umbralDePerfil` lee la MISMA resolución (en %, como los demás criterios)");
  ok(BP.procedenciaDeReferencia(CONCEPTO) === ETQ_ADI_TU.replace("tu empresa", "la empresa") || BP.procedenciaDeReferencia(CONCEPTO) === "criterio general de ADI, ajustable por la empresa", "`procedenciaDeReferencia(concepto)` también la dice la tabla única («…por la empresa», voz de la Entrega)", BP.procedenciaDeReferencia(CONCEPTO));
  const val = validateDataset("demo");
  const conB = (() => { initTenant(dsB); const v = validateDataset("demo"); initTenant(TENANT_DEMO); return v; })();
  ok(!conB.findings.warning.some((w) => /pisoMaterialidadCobranza/.test(w.where || "")) && !val.findings.warning.some((w) => /pisoMaterialidadCobranza/.test(w.where || "")), "el validador del contrato conoce la llave (ya no la reporta como «llave desconocida»)", jj(conB.findings.warning));
}
{
  /* un piso tomado de un documento que la empresa confirmó adoptar conserva el rastro: «declarado por tu empresa, tomado de <documento>» */
  const s2 = crearAlmacenEnMemoria();
  const A2 = crearAcciones({ continuidad: s2, ahora: reloj });
  const T = tenantDe("empresa-doc");
  const { r } = await declararYConfirmar(A2, T, 3, { documento: { nombre: "Política de crédito 2026.pdf", tipo: "pdf" } });
  const hoy = await datasetDeHoy(s2, T);
  const p = pisoDe(hoy.dataset);
  ok(r.ok && p.k === 0.03 && p.origen === "empresa" && /tomado de Política de crédito 2026\.pdf/.test(p.etiqueta), "★ tomado de un documento y confirmado: «declarado por tu empresa, tomado de <documento>» (el rastro viaja con el valor)", jj(p));
  const sinConf = await (async () => { const s3 = crearAlmacenEnMemoria(); const A3 = crearAcciones({ continuidad: s3, ahora: reloj }); await A3.aportarContexto({ tenant: T, aportes: [aporte(3, { documento: { nombre: "Política de crédito 2026.pdf", tipo: "pdf" } })] }); return pisoDe((await datasetDeHoy(s3, T)).dataset); })();
  ok(sinConf.origen === "adi", "★ del documento SIN confirmar: no se usa (rige el criterio de ADI)", jj(sinConf));
}

/* ═══ 4 · LA FRONTERA ═════════════════════════════════════════════════════════════════════════════════════════════════════════════ */
H("4 · FRONTERA: con 0,5 % y con 5 % sobre la misma cartera, todo lo medido es idéntico — solo cambian los veredictos");
const dsConPiso = (pct) => BP.conCriteriosDeEmpresa(TENANT_DEMO, { pisoMaterialidadCobranza: pct }).dataset;
const fronteraOk = (a, b) => a.mediciones === b.mediciones;
{
  const m05 = medicionesDeCobranza(dsConPiso(0.5)), m5 = medicionesDeCobranza(dsConPiso(5)), mAdi = medicionesDeCobranza(TENANT_DEMO);
  ok(m05.cuentas.length === 13 && m5.cuentas.length === 13, "la cartera real del demo: 13 cuentas evaluables con plazo declarado", String(m05.cuentas.length));
  ok(m05.mediciones.length > 20000, "la medición comparada es la real (la mesa de flujo entera, la tabla de señales con sus cifras y las cifras de cada cuenta)", String(m05.mediciones.length));
  ok(fronteraOk(m05, m5) && fronteraOk(m05, mAdi), "★ FRONTERA: saldos, vencidos, atrasos, participaciones, diferencias y lo que la cobertura cuenta de la cartera son IDÉNTICOS con 0,5 %, 5 % y el criterio de ADI");
  ok(m05.veredictos !== m5.veredictos, "y el piso SÍ actúa: los veredictos (señal · bajo el piso · borde) cambian — la prueba no es vacía", `${m05.veredictos.slice(0, 160)} / ${m5.veredictos.slice(0, 160)}`);
  const cuenta = (m, c) => JSON.parse(m.veredictos).porCuenta[c];
  ok(cuenta(m05, "Sodimac").estado === "senal" && cuenta(m5, "Sodimac").estado === "bajo_piso", "Sodimac: señal con 0,5 % y bajo el piso con 5 % (el MISMO saldo y vencido, otro veredicto)", jj([cuenta(m05, "Sodimac"), cuenta(m5, "Sodimac")]));

  /* la Entrega real sobre cobranza (`consultar`) y los números de PRI-04 con dos empresas que declaran 0,5 % y 5 %: lo medido, byte a byte */
  const enc = { version: "encargo/v1", partes: [{ id: "p1", tema: "cobranza", cierre: "cifra", conceptos: ["saldo_pendiente", "saldo_vencido", "dias_vencido"], entidades: [{ nombre: "Lider", eje: "cliente" }, { nombre: "Sodimac", eje: "cliente" }] }] };
  const sA = crearAlmacenEnMemoria(), sB = crearAlmacenEnMemoria();
  const AA = crearAcciones({ continuidad: sA, ahora: () => "2026-10-04T12:00:00.000Z" }), AB = crearAcciones({ continuidad: sB, ahora: () => "2026-10-04T12:00:00.000Z" });
  const T1 = tenantDe("frontera-1"), T2 = tenantDe("frontera-2");
  await declararYConfirmar(AA, T1, 0.5); await declararYConfirmar(AB, T2, 5);
  const e1 = await AA.consultar({ tenant: T1, encargo: enc }), e2 = await AB.consultar({ tenant: T2, encargo: enc });
  const sinPiso = (r) => jj({ texto: r.entrega && r.entrega.texto, cifras: r.entrega && r.entrega.json && r.entrega.json.cifras, universos: r.entrega && r.entrega.json && r.entrega.json.universos });
  ok(e1.ok && e2.ok && !!(e1.entrega && e1.entrega.texto) && /Lider/.test(e1.entrega.texto), "la Entrega de cobranza se sirve para las dos empresas", jj([e1.ok, e2.ok]));
  ok(sinPiso(e1) === sinPiso(e2) && sinPiso(e1) === sinPiso(await A.consultar({ tenant: tenantDe("frontera-0"), encargo: enc })), "★ FRONTERA · la Entrega de cobranza (texto, cifras y universos) es BYTE-IDÉNTICA con 0,5 %, 5 % y sin declarar", jj(e1.entrega.texto).slice(0, 200));
  ok(jj(e1.declarado.criterios.map((c) => c.valor)) === "[0.5]" && jj(e2.declarado.criterios.map((c) => c.valor)) === "[5]", "cada empresa ve SU piso declarado en `declarado.criterios` (0,5 y 5)");

  /* los números de PRI-04 cuenta por cuenta */
  const t05 = textosDePiso(dsConPiso(0.5)), t5 = textosDePiso(dsConPiso(5));
  const nums = (t) => (t.join(" ").match(/\$[\d.,]+[KMB]?|\d+(?:\.\d+)?%|\d+(?:\.\d+)? puntos/g) || []).length;
  ok(t05.length > 0 && nums(t05) > 20 && nums(t5) > 20, "los textos de PRI-04 traen las cifras de cada cuenta");
}
{
  /* ninguna parte de la cobranza lee el piso: lo leen la capa de conocimiento (PRI-04), la función de origen y quien lo declara */
  const MIDEN = ["src/adi/sentrix/mesaFlujo.js", "src/adi/agente/playbooks/cobranza.js", "src/adi/conocimiento/tablaSenales.js", "src/adi/agente/herramientasAgente.js", "src/adi/oracle/datoProyectado.js", "src/adi/entrega/componer.js", "src/adi/entrega/referencias.js"];
  const RE = RE_LECTOR;
  for (const f of MIDEN) ok(!RE.test(sinComentarios(leer(`./${f}`))), `★ ${f} (donde se MIDE la cobranza) no lee el piso`, f);
  const lectores = [];
  (function recorrer(dir) { for (const e of fs.readdirSync(new URL(`./${dir}`, import.meta.url), { withFileTypes: true })) { const p = `${dir}/${e.name}`; if (e.isDirectory()) recorrer(p); else if (/\.(js|jsx|mjs)$/.test(e.name) && RE.test(sinComentarios(leer(`./${p}`)))) lectores.push(p); } })("src");
  const PERMITIDOS = ["src/adi/capacidad/loDeclarado.js", "src/adi/conocimiento/medir.js", "src/config/businessPolicy.js", "src/config/contract/pisoMaterialidadCobranza.js", "src/config/contract/validationRules.js", "src/config/contract/validator.js"];
  ok(lectores.every((f) => PERMITIDOS.includes(f)) && lectores.length === PERMITIDOS.length, "★ los ÚNICOS lectores del piso son el conocimiento (PRI-04), la función de origen, el contrato y la tabla de lo declarable", jj(lectores));
}

/* ═══ 5 · AISLAMIENTO ═════════════════════════════════════════════════════════════════════════════════════════════════════════════ */
H("5 · otra empresa nunca ve el piso declarado; sin residuo fuera del tramo");
{
  const delB = await datasetDeHoy(store, TB);
  const pB = pisoDe(delB.dataset);
  ok(pB.origen === "adi" && pB.k === PISO_MATERIALIDAD_COBRANZA_CRITERIO_ADI && delB.criteriosAplicados.length === 0, "★ la empresa B (que no declaró nada) NO ve el 0,5 % de la A: rige el criterio de ADI", jj(pB));
  ok(textosDePiso(delB.dataset).every((t) => !t.includes(ETQ_EMPRESA_TU)), "★ …y ningún texto de la B la atribuye a la empresa");
  const cB = await A.conocerEmpresa({ tenant: TB });
  ok(!cB.hechosAportados.some((h) => h.concepto === CONCEPTO), "la memoria de la B no trae el piso de la A");
  const antes = jj(pisoDe(getTenantData()));
  const delA = await datasetDeHoy(store, TA);
  deLaEmpresa(delA.dataset, () => pisoDe(getTenantData()));
  ok(jj(pisoDe(getTenantData())) === antes, "sin residuo: fuera del tramo del Core el piso vuelve a lo que era (nada queda aplicado para la próxima empresa)");
}

/* ═══ 6 · ATRIBUCIÓN POR SIGNIFICADO, EN TRES EMPRESAS ═══════════════════════════════════════════════════════════════════════════ */
H("6 · cero atribuciones falsas por significado: la empresa que no declara · la que declara por chat · la que lo trae en su perfil");
const claves = ["pisoMaterialidadCobranza"];
const NO_ATRIBUYEN = [/plazos?\s+(?:de\s+pago\s+)?declarad[oa]s?/i];   /* «todos con plazo declarado»: el plazo de pago es un dato de cada cuenta, no el criterio del piso */
const atribDe = (t) => atribuciones(t, { claves, excluir: NO_ATRIBUYEN });
const falsasDe = (textos, declarado) => textos.flatMap((t) => atribDe(t)).filter((a) => esFalsa(a, declarado));
const EMPRESAS_PISO = {
  nada: { dataset: TENANT_DEMO, declarado: new Set() },
  chat: { dataset: dsConPiso(2), declarado: new Set(claves) },
  perfil: { dataset: { ...TENANT_DEMO, perfil: { ...TENANT_DEMO.perfil, pisoMaterialidadCobranza: { valor: 0.03, procedencia: "medido" } } }, declarado: new Set(claves) },
};
const TEXTOS_PISO = Object.fromEntries(Object.entries(EMPRESAS_PISO).map(([k, E]) => [k, textosDePiso(E.dataset)]));
{
  for (const [k, E] of Object.entries(EMPRESAS_PISO)) {
    const f = falsasDe(TEXTOS_PISO[k], E.declarado);
    const todas = TEXTOS_PISO[k].flatMap((t) => atribDe(t));
    ok(TEXTOS_PISO[k].length >= 10 && f.length === 0, `★ ${k}: CERO atribuciones falsas por significado sobre ${TEXTOS_PISO[k].length} textos de PRI-04 (${todas.length} atribuciones leídas)`, f.slice(0, 2).map((a) => a.clausula).join(" | "));
  }
  const cuenta = (k, tipo) => TEXTOS_PISO[k].flatMap((t) => atribDe(t)).filter((a) => a.tipo === tipo).length;
  ok(cuenta("nada", "empresa") === 0 && cuenta("nada", "adi") > 0, "control · sin declarar: ninguna atribución a la empresa y sí a ADI");
  ok(cuenta("chat", "empresa") > 0 && cuenta("chat", "adi") === 0 && cuenta("perfil", "empresa") > 0 && cuenta("perfil", "adi") === 0, "control · declarado (chat o perfil): atribuido a la empresa y a ADI nunca");
  ok(TEXTOS_PISO.chat.some((t) => t.includes("Piso: 2% del saldo pendiente")) && TEXTOS_PISO.perfil.some((t) => t.includes("Piso: 3% del saldo pendiente")), "cada empresa ve SU valor (2 % por chat · 3 % por su perfil)");
  ok(![...Object.values(TEXTOS_PISO).flat()].some((t) => /supuesto del usuario|supuesto_usuario|estimaci[oó]n contra referencia/i.test(t)), "★ ningún texto dice «supuesto del usuario» ni jerga de procedencia");
}

/* ═══ 7 · CARNADAS: CADA DEFECTO, PUESTO A PROPÓSITO, TIENE QUE PONER EL CANDADO EN ROJO ═════════════════════════════════════════════ */
H("7 · carnadas: el candado se pone en rojo ante cada defecto");
{
  /* K1 · una clasificación que no mira el estado deja entrar un pendiente */
  const sP = crearAlmacenEnMemoria(); const AP = crearAcciones({ continuidad: sP, ahora: reloj }); const TP = tenantDe("empresa-pend");
  await AP.aportarContexto({ tenant: TP, aportes: [aporte(0.5)] });
  const filasP = await sP.leerHechosEmpresa(TP.id);
  const usaPendiente = (clasificar) => { const c = clasificar(filasP); return c.criterios.some((x) => x.concepto === CONCEPTO); };
  ok(usaPendiente(LD.clasificarLoDeclarado) === false, "control · el clasificador real NO usa un pendiente");
  ok(usaPendiente((filas) => LD.clasificarLoDeclarado(filas.map((f) => ({ ...f, estado: "vigente" })))) === true, "★ CARNADA · un clasificador que no mira el estado deja entrar el pendiente → el detector lo ve (rojo)");

  /* K2 · un criterio fuera de rango (escrito directo en la memoria, saltando la puerta) no se usa; sin la validación, sí */
  const sR = crearAlmacenEnMemoria(); const TR = tenantDe("empresa-rango");
  const fila = { id: "hf-x", clase: "criterio", concepto: CONCEPTO, eje: null, entidad: null, periodo: null, valor: { raw: 50, unidad: "pct" }, origen: "declarado", estado: "vigente", declaradoEn: "2026-10-04T00:00:00.000Z", confirmacion: { por: "x", cuando: "2026-10-04T00:00:00.000Z", medio: "chat-anfitrion" } };
  const usaFuera = (filas) => { const c = LD.clasificarLoDeclarado(filas); return c.criterios.length > 0; };
  void sR; void TR;
  ok(usaFuera([fila]) === false && usaFuera([{ ...fila, valor: { raw: 2, unidad: "pct" } }]) === true, "control · una fila vigente fuera de rango (50 %) no entra; una dentro del rango (2 %) sí");
  const sinValidar = (filas) => filas.filter((f) => f.estado === "vigente").length > 0;
  ok(sinValidar([fila]) === true && usaFuera([fila]) === false, "★ CARNADA · un clasificador que no valida el rango dejaría entrar el 50 % → el detector lo ve (rojo)");
  ok(BP.pisoMaterialidadCobranzaDe({ perfil: { pisoMaterialidadCobranza: 50 } }).origen === "adi" && BP.pisoMaterialidadCobranzaDe({ perfil: { pisoMaterialidadCobranza: 0.05 } }).origen === "adi", "la función de origen también falla cerrado ante un número fuera de rango");

  /* K3 · la FRONTERA: un piso que alterara una medición — saldo, vencido, atraso, una cifra de cuenta — pone el comparador en rojo */
  const base = medicionesDeCobranza(dsConPiso(0.5));
  const k = (pct) => pct / 100;
  const contaminaciones = {
    "el saldo pendiente de una cuenta": (tabla) => { const c = tabla.cuentas[Object.keys(tabla.cuentas)[0]]; c.saldoPendiente = Math.round(c.saldoPendiente * (1 - k(0.5))); },
    "el vencido de una cuenta": (tabla) => { const e = Object.keys(tabla.cuentas).find((x) => tabla.cuentas[x].vencido); tabla.cuentas[e].vencido = Math.round(tabla.cuentas[e].vencido * (1 + k(0.5))); },
    "una cifra de la tabla de señales": (tabla) => { tabla._figs.cobranza[0].raw = tabla._figs.cobranza[0].raw * (1 - k(0.5)); },
    "el atraso de la mesa de flujo": (tabla, mesa) => { const m = JSON.parse(JSON.stringify(mesa)); const f = (m.filas || [])[0]; if (f) { for (const key of Object.keys(f)) if (typeof f[key] === "number") { f[key] = f[key] * (1 + k(0.5)); break; } } return { mesa: m }; },
  };
  for (const [que, cont] of Object.entries(contaminaciones)) {
    const sucio = medicionesDeCobranza(dsConPiso(0.5), { contaminar: cont });
    ok(!fronteraOk(base, sucio), `★ CARNADA · un piso que alterara ${que} → el comparador de la frontera lo ve (rojo)`);
  }
  const m5 = medicionesDeCobranza(dsConPiso(5));
  ok(fronteraOk(base, m5), "control · sin contaminar, 0,5 % y 5 % miden lo mismo");
  /* y lo que el piso sí mueve (los veredictos) no cuenta como medición */
  ok(base.veredictos !== m5.veredictos && fronteraOk(base, m5), "control · lo único que cambia con el piso son los veredictos");
  /* el candado ESTRUCTURAL: si la mesa de flujo (donde se mide) leyera el piso, el barrido de lectores lo vería */
  const RE = RE_LECTOR;
  const mesaSucia = leer("./src/adi/sentrix/mesaFlujo.js") + "\nconst _k = pisoMaterialidadCobranzaDe(getTenantData()).k;\n";
  ok(RE.test(sinComentarios(mesaSucia)) && !RE.test(sinComentarios(leer("./src/adi/sentrix/mesaFlujo.js"))), "★ CARNADA · una mesa de flujo que leyera el piso → el barrido de lectores lo ve (rojo)");

  /* K4 · la atribución falsa: decir «declarado por tu empresa» / «el piso declarado por tu empresa» sin declaración */
  const sinDecl = TEXTOS_PISO.nada;
  const mentira = sinDecl.map((t) => t.split(ETQ_ADI_TU).join(ETQ_EMPRESA_TU).split("el piso de ADI").join("el piso declarado por tu empresa").split("Es el declarado por tu empresa").join("Es lo declarado por tu empresa"));
  ok(falsasDe(sinDecl, new Set()).length === 0 && falsasDe(mentira, new Set()).length > 0, "★ CARNADA · decir «declarado por tu empresa» sin declaración → el oráculo lo marca como atribución FALSA (rojo)", falsasDe(mentira, new Set()).slice(0, 1).map((a) => a.clausula).join(""));
  const lamentira2 = TEXTOS_PISO.chat.map((t) => t.split(ETQ_EMPRESA_TU).join(ETQ_ADI_TU).split("el piso declarado por tu empresa").join("el piso de ADI"));
  ok(falsasDe(TEXTOS_PISO.chat, new Set(claves)).length === 0 && falsasDe(lamentira2, new Set(claves)).length > 0, "★ CARNADA · y al revés: decir «piso de ADI» cuando la empresa lo declaró → atribución falsa a ADI (rojo)");

  /* K5 · otra empresa ve el piso: una vista del almacén que ignora la empresa */
  const storeCompartido = crearAlmacenEnMemoria(); const AC = crearAcciones({ continuidad: storeCompartido, ahora: reloj });
  await declararYConfirmar(AC, tenantDe("duena"), 2);
  const veElPiso = async (st, id) => pisoDe((await datasetDeHoy(st, tenantDe(id))).dataset).origen === "empresa";
  ok(await veElPiso(storeCompartido, "duena") === true && await veElPiso(storeCompartido, "otra") === false, "control · el almacén real: la dueña ve su piso y otra empresa no");
  const vistaQueIgnoraLaEmpresa = { ...storeCompartido, leerHechosEmpresa: async () => storeCompartido.leerHechosEmpresa("duena") };
  ok(await veElPiso(vistaQueIgnoraLaEmpresa, "otra") === true, "★ CARNADA · una vista del almacén que ignora la empresa deja ver el piso ajeno → el detector lo ve (rojo)");

  /* K6 · «supuesto del usuario» para lo declarado (el defecto de antes): el detector de procedencia lo ve */
  const dsDecl = dsConPiso(2);
  const mDecl = deLaEmpresa(dsDecl, ({ tabla }) => { const e = Object.keys(tabla.cuentas).find((x) => tabla.cuentas[x].vencidoPositivo && tabla.cuentas[x].tienePlazoDeclarado); return medirPieza(PIEZA_PISO, e, tabla); });
  const atribuyeComoSupuesto = (m) => m.procedencia === "supuesto_usuario" || m.partes.pisoOrigenEnElLibro === "supuesto";
  ok(atribuyeComoSupuesto(mDecl) === false && atribuyeComoSupuesto({ ...mDecl, procedencia: "supuesto_usuario" }) === true, "★ CARNADA · la procedencia «supuesto_usuario» para un piso declarado → el detector la ve (rojo)", jj([mDecl.procedencia, mDecl.partes.pisoOrigenEnElLibro]));
  ok(mDecl.partes.pisoOrigenEnElLibro === "declarado" && mDecl.partes.pisoOrigen === "empresa", "el libro de hechos marca el piso declarado como «declarado» (el eje de origen de la Etapa 1), no «supuesto»", jj(mDecl.partes));
  void servirPieza;

  /* K7 · una frase de dueño escrita a mano en la capa de conocimiento (el defecto que cierra la función única) */
  const medirSrc = sinComentarios(leer("./src/adi/conocimiento/medir.js"));
  const delPiso = medirSrc.slice(medirSrc.indexOf("pisoMaterialidadCobranza(entidad, tabla) {"), medirSrc.indexOf("export const CALCULOS_DISPONIBLES"));
  const cobSrc = medirSrc.slice(medirSrc.indexOf("export function coberturaPisoDeCobranza"), medirSrc.indexOf("export function coberturaCargaVsResto"));
  const servirSrc = sinComentarios(leer("./src/adi/conocimiento/servir.js"));
  const bloquesPiso = servirSrc.slice(servirSrc.indexOf("export function servirBloquePisoDeCobranza"), servirSrc.indexOf("export function servirMencionCargaVsResto")) + servirSrc.slice(servirSrc.indexOf("export function servirMencionPisoDeCobranza"), servirSrc.indexOf("export function servirOfertaCargaVsResto")) + servirSrc.slice(servirSrc.indexOf("export function servirOfertaPisoDeCobranza"));
  const FRASE_A_MANO = /declarado por tu empresa|piso de ADI|criterio general de ADI|ajustable por tu empresa/;
  ok(delPiso.length > 1000 && cobSrc.length > 1000 && bloquesPiso.length > 1000, "los tres tramos de PRI-04 se aíslan del código fuente para auditarlos");
  ok(!FRASE_A_MANO.test(delPiso) && !FRASE_A_MANO.test(cobSrc) && !FRASE_A_MANO.test(bloquesPiso), "★ en el cálculo, la cobertura y los bloques de PRI-04 NINGÚN dueño se escribe a mano: todo sale de `pisoMaterialidadCobranzaDe`", [delPiso, cobSrc, bloquesPiso].map((s) => (FRASE_A_MANO.exec(s) || [""])[0]).join("|"));
  ok(FRASE_A_MANO.test(cobSrc + "\n const x = declaradoPorLaEmpresa ? \"el piso declarado por tu empresa\" : \"el piso de ADI\";"), "★ CARNADA · si alguien reescribe la frase a mano en PRI-04 → el barrido la ve (rojo)");
}

console.log(`\n── _piso_cobranza_declarado_gate: PASS ${pass} · FAIL ${fail} (de ${pass + fail}) ──`);
if (fail > 0) { console.log(fails.map((f) => "  ✗ " + f).join("\n")); process.exit(1); }
