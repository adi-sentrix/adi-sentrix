/* === _registro_de_dominios_gate.mjs · EL REGISTRO ÚNICO DE DOMINIOS (owner 2026-09-24) ══════════════════════════
 * `encargo_natural_diseno.md` §2: «Registro único de dominios en `src/config/contract/dominios.js`… Migración en
 * dos etapas si hace falta: unión primero, fuente única después, con el candado "entrada registrada ⇒ reconocida"».
 *
 * QUÉ PRUEBA ESTE CANDADO:
 *   1 · ESCALABILIDAD — un dominio SINTÉTICO agregado a una COPIA del registro (nunca al registro real) se
 *       reconoce con `dominiosDeTexto` sin tocar ni una línea de `contratoDeDominios.js` / `contratoComercial.js` /
 *       `prioridadIntegrada.js` (los reconocedores). Si esto pasara solo modificando el registro real, no probaría
 *       nada — por eso la copia.
 *   2 · ENTRADA REGISTRADA ⇒ RECONOCIDA — cada concepto activo del registro (una muestra representativa: los
 *       literales, no los fragmentos-de-regex con clase de caracteres) enciende su propio dominio en `dominiosDe`.
 *   3 · LA MIGRACIÓN BYTE-IDÉNTICA — `_INVENTARIO` (`contratoDeDominios.js`) se DERIVA del registro: se verifica
 *       que el `.source` del regex derivado es EXACTO al que este archivo tenía hardcodeado antes de esta etapa
 *       (una copia congelada de esa fuente, para que este candado arda si alguien la cambia sin querer).
 *       `_COBRANZA` sumó fragmentos en las etapas 2 y 4 (tolerancia morfológica — «cobré», «paga», el ejemplo
 *       textual del diseño — y la corrección «caja ≠ cobranza»): se prueba por SUPERCONJUNTO DE CONDUCTA (0
 *       regresiones + los casos nuevos), no por byte-identidad. **`_COMERCIAL` (`contratoComercial.js`) dejó de
 *       ser byte-idéntica en la ley del piso sin modelo (owner 2026-09-25, ronda 4, vía coordinador):** sumó el
 *       LADO COMPRADOR de la venta —«nos/te/le/les compra», «compra(n) más», «comprándonos»— porque «¿cuál es el
 *       cliente que más nos compra?» no encendía NINGÚN dominio (el reconocedor solo sabía leer el verbo desde
 *       el lado del vendedor) y el turno caía al límite sin ninguna cifra que filtrar por concepto — la cifra
 *       ajena medida en el set ciego v2. El coordinador la aceptó explícitamente por ser «un concepto de negocio
 *       estable», la misma vara que ya aplicó a «cobré»/«paga»: se prueba igual, por SUPERCONJUNTO DE CONDUCTA.
 *       `_TESORERIA` (`prioridadIntegrada.js`) se reconstruye con un envoltorio distinto (`\b(?:…)\b` en vez de
 *       `\b…\b|\b…\b` por alternativa) — tampoco es byte-idéntica, EQUIVALENCIA DE CONDUCTA sobre una batería de
 *       casos.
 *   4 · EL BARRIDO, HONESTO — lo que NO se migró queda documentado acá, con el porqué (no es un olvido): la lista
 *       de `_OTRO_UNIVERSO` (contratoComercial.js) y `_SINONIMOS`/`_OBJ` (prioridadIntegrada.js) siguen locales.
 *       Este candado no finge que están migradas; prueba que existen y anota la razón (en `dominios.js`).
 *
 * Cero red: solo el registro y los tres consumidores, puros. */
import fs from "node:fs";
import { DOMINIOS_REGISTRO, dominioPorId, idsActivos, idsDeDominios, conceptosDe, regexDeConceptos, regexDeDominio, dominiosDeTexto } from "./src/config/contract/dominios.js";
import { dominiosDe, DOMINIOS as DOMINIOS_CONTRATO } from "./src/adi/agente/contratoDeDominios.js";
import { esTemaComercial } from "./src/adi/agente/contratoComercial.js";
import { pideTesoreria, criterioDeLaPregunta } from "./src/adi/agente/prioridadIntegrada.js";
import { DOMINIOS as DOMINIOS_LEXICO } from "./src/adi/notario/lexico.js";

let PASS = 0, FAIL = 0;
const ok = (c, m, extra = "") => { if (c) { PASS++; console.log("  ✓ " + m); } else { FAIL++; console.log("  ✗ " + m + (extra ? "\n      " + extra : "")); } };
const H = (t) => console.log(`\n${t}`);

/* ═══ 0 · LA FORMA DEL REGISTRO ═════════════════════════════════════════════════════════════════════════════════ */
H("0 · la forma del registro: un dominio, una entrada, con lo que la ficha exige");
{
  ok(Array.isArray(DOMINIOS_REGISTRO) && DOMINIOS_REGISTRO.length === 4, `4 dominios registrados (${DOMINIOS_REGISTRO.length}): ${DOMINIOS_REGISTRO.map((d) => d.id).join(", ")}`);
  for (const d of DOMINIOS_REGISTRO) {
    ok(typeof d.id === "string" && d.id, `${d.id}: tiene id`);
    ok(typeof d.nombre === "string" && d.nombre, `${d.id}: tiene nombre`);
    ok(typeof d.definicion === "string" && d.definicion.length > 10, `${d.id}: tiene definición`);
    ok(typeof d.sujeto === "string" && d.sujeto, `${d.id}: declara su sujeto (${d.sujeto})`);
    ok(Array.isArray(d.conceptosDeEntrada) && d.conceptosDeEntrada.length > 0, `${d.id}: tiene conceptos de entrada (${d.conceptosDeEntrada.length})`);
    ok(Array.isArray(d.metricas), `${d.id}: declara sus métricas (${d.metricas.length})`);
    ok(Array.isArray(d.lentes), `${d.id}: declara sus lentes (${d.lentes.join(",") || "ninguna"})`);
    ok(Array.isArray(d.relaciones), `${d.id}: declara sus relaciones (${d.relaciones.length})`);
    ok(d.estado === "activo" || d.estado === "ausente", `${d.id}: estado válido (${d.estado})`);
    if (d.estado === "ausente") ok(d.ausencia && typeof d.ausencia.que === "string" && typeof d.ausencia.alternativa === "string", `${d.id}: declara su ausencia (qué + alternativa)`);
  }
  ok(idsActivos().join(",") === "comercial,inventario,cobranza", `idsActivos() = comercial,inventario,cobranza (${idsActivos().join(",")})`);
  ok(idsDeDominios({ incluirAusentes: true }).includes("tesoreria"), "idsDeDominios({incluirAusentes:true}) incluye tesorería");
  ok(!idsDeDominios({}).includes("tesoreria"), "…pero idsDeDominios() por defecto no la incluye: no es un dominio con datos");
}

/* ═══ 1 · ESCALABILIDAD — un dominio sintético en una COPIA, sin tocar el reconocedor ══════════════════════════ */
H("1 · escalabilidad: un dominio sintético en una copia del registro se reconoce sin tocar ninguna línea de los reconocedores");
{
  const COPIA = [...DOMINIOS_REGISTRO, {
    id: "logistica", nombre: "Logística", definicion: "transporte y despacho — dominio de prueba, no real.",
    sujeto: "envio", estado: "activo", boundary: "acento",
    conceptosDeEntrada: ["log[ií]stica", "flete", "transportista", "despacho"],
    metricas: [], lentes: [], relaciones: [],
  }];
  ok(COPIA !== DOMINIOS_REGISTRO && COPIA.length === DOMINIOS_REGISTRO.length + 1, "la copia es un arreglo NUEVO (el registro real no se tocó)");
  ok(idsActivos() .length === 3 && !idsActivos().includes("logistica"), "el registro REAL sigue con 3 dominios activos: la copia no lo mutó");
  const r1 = dominiosDeTexto("¿cómo va la logística y el flete del mes?", { registro: COPIA });
  ok(r1.dominios.includes("logistica"), "★ el dominio sintético SE RECONOCE contra la copia (dominiosDeTexto), sin tocar contratoDeDominios.js/contratoComercial.js/prioridadIntegrada.js", JSON.stringify(r1));
  const r2 = dominiosDeTexto("¿cómo va la logística y el flete del mes?");
  ok(!r2.dominios.includes("logistica"), "…y contra el registro REAL (sin la copia) el mismo texto NO enciende un dominio que no existe");
  ok(dominioPorId("logistica", COPIA) && dominioPorId("logistica", COPIA).nombre === "Logística", "dominioPorId acepta la copia como segundo argumento");
  ok(dominioPorId("logistica") === null, "…pero el registro real no conoce «logistica»");
  const reLog = regexDeConceptos(conceptosDe("logistica", COPIA), { boundary: "acento" });
  ok(reLog && reLog.test("un problema de flete"), "regexDeConceptos/conceptosDe funcionan igual con la copia que con el registro real");
}

/* ═══ 2 · ENTRADA REGISTRADA ⇒ RECONOCIDA ══════════════════════════════════════════════════════════════════════ */
H("2 · entrada registrada ⇒ reconocida: una muestra de conceptos literales de cada dominio activo enciende su dominio en dominiosDe(q)");
{
  const MUESTRA = {
    comercial: ["ventas", "margen", "contribución", "benchmark", "carga comercial", "cartera"],
    inventario: ["inventario", "stock", "bodega", "rotación", "sobrestock", "días de inventario"],
    cobranza: ["cobranza", "vencido", "mora", "por cobrar", "saldo pendiente", "crédito"],
  };
  for (const [dom, palabras] of Object.entries(MUESTRA)) {
    for (const p of palabras) {
      const q = `Cuéntame sobre ${p} de mi negocio`;
      const r = dominiosDe(q);
      ok(r.dominios.includes(dom), `«${p}» → enciende ${dom} (dominiosDe: ${r.dominios.join(",") || "∅"})`, q);
    }
  }
  /* tesorería: dominio AUSENTE — no lo enciende `dominiosDe` (no es un dominio con datos), pero SÍ lo reconoce
   * `dominiosDeTexto` (que sabe distinguir activos de ausentes) y `pideTesoreria` lo usa para declarar la ausencia.
   * «efectivo» queda AFUERA de esta muestra a propósito: `_COBRANZA` (contratoDeDominios.js) ya traía «flujo de
   * caja|efectivo» ANTES de esta etapa —una inconsistencia preexistente con la nueva ley «caja ≠ cobranza», no
   * introducida acá— y se prueba aparte, sin fingir que no existe (§4b). */
  for (const p of ["caja", "liquidez", "tesorería"]) {
    const r = dominiosDeTexto(`¿cuánta ${p} tengo?`);
    ok(r.ausentes.includes("tesoreria") && !r.dominios.length, `«${p}» → tesorería AUSENTE, ningún dominio activo (dominiosDeTexto: ausentes=${r.ausentes.join(",")})`);
  }
  ok(pideTesoreria("prioriza caja") === true, "pideTesoreria(«prioriza caja») sigue reconociendo el pedido (vía el registro)");
  ok(pideTesoreria("prioriza cobranza") === false, "…y «prioriza cobranza» no dispara tesorería: el sinónimo real manda");
}

/* ═══ 3 · LA MIGRACIÓN, VERIFICADA CONTRA LA FUENTE ORIGINAL CONGELADA ═══════════════════════════════════════════ */
H("3 · byte-identidad: _INVENTARIO/_COBRANZA/_COMERCIAL se derivan del registro sin cambiar un carácter del regex de siempre");
{
  /* las fuentes ORIGINALES, congeladas acá (no en el archivo que ya migró) — si alguien cambia el registro y esto
   * deja de calzar, el candado arde: es la prueba de que la migración fue una RELOCACIÓN, no una reinvención. */
  const _W = "[\\wáéíóúñ]";
  const ORIG_INVENTARIO = new RegExp(`(?<!${_W})(?:inventarios?|stock|existencias|mercader[ií]as?|rotaci[oó]n|rot(?:a|an|ando)|bodegas?|dep[oó]sitos?|almac[eé]n(?:es)?|reposici[oó]n|reponer|quiebres?|sobrestock|inmoviliz${_W}*|frenad${_W}*|dormid${_W}*|capital(?! de trabajo)|d[ií]as de inventario|cobertura)(?!${_W})`, "i");
  const ORIG_COBRANZA = new RegExp(`(?<!${_W})(?:cobranzas?|cobros?|cobrad[oa]s?|cobrar|cobrando|vencid[oa]s?|mora|deudas?|deben|debe|adeud${_W}*|abonos?|abonad[oa]s?|pagos?|pagan|pagado|pagar|plazo de pago|por cobrar|saldos? pendientes?|cr[eé]dito|contado|flujo de caja|efectivo)(?!${_W})`, "i");
  const ORIG_COMERCIAL = new RegExp(`(?<!${_W})(?:ventas?|vend[ií](?:[oó]|mos|endo|ste|eron|a|an|e|en)?|vend(?:o|es|e|en|emos)|vendid[oa]s?|factur${_W}*|ingresos?|contribu${_W}*|m[aá]rgen(?:es)?|rentab${_W}*|benchmark|costos?|precios?|markup|acciones comerciales|carga comercial|rebates?|descuentos?|clientes?|cuentas?|cartera|negocio|resultado comercial|crec${_W}*|volumen|mix|ticket|comercial(?:es)?|ganamos|ganando|gano|mejorando|apuesta)(?!${_W})`, "i");
  const nuevoInv = regexDeDominio("inventario");
  const nuevoCob = regexDeDominio("cobranza");
  const nuevoCom = regexDeDominio("comercial");
  ok(nuevoInv.source === ORIG_INVENTARIO.source && nuevoInv.flags === ORIG_INVENTARIO.flags, "★ regexDeDominio(\"inventario\") es BYTE-IDÉNTICO a la fuente original de _INVENTARIO");
  /* _COMERCIAL YA NO es byte-idéntica desde la ley del piso sin modelo (owner 2026-09-25, ronda 4): se agregó
   * el lado COMPRADOR de la venta — «nos/te/le/les compra», «compra(n) más», «comprándonos» —, el mismo concepto
   * de negocio contado desde el cliente. Se prueba por SUPERCONJUNTO DE CONDUCTA, la misma vara que _COBRANZA. */
  const CASOS_COMERCIAL_ORIGINALES = ["las ventas del mes", "vendí mucho ayer", "vendo todos los días", "vendido por completo",
    "facturación del período", "la contribución marginal", "cuál es mi margen", "rentabilidad del negocio", "el benchmark de la industria",
    "los costos fijos", "precios de lista", "el markup aplicado", "acciones comerciales activas", "carga comercial alta", "rebates otorgados",
    "descuentos aplicados", "mis clientes principales", "esas cuentas grandes", "toda la cartera", "cómo va el negocio", "resultado comercial del mes",
    "crecimiento sostenido", "el volumen vendido", "mix de productos", "ticket promedio", "el área comercial", "ganamos ese cliente", "vamos ganando terreno"];
  const regresionesCom = CASOS_COMERCIAL_ORIGINALES.filter((c) => ORIG_COMERCIAL.test(c) && !nuevoCom.test(c));
  ok(regresionesCom.length === 0, `★ 0 regresiones: los ${CASOS_COMERCIAL_ORIGINALES.length} casos que _COMERCIAL original reconocía, la derivada del registro los sigue reconociendo`, regresionesCom.join(" | "));
  ok(!ORIG_COMERCIAL.test("cuánto nos compra") && nuevoCom.test("cuánto nos compra"), "★ tolerancia NUEVA (ley del piso sin modelo): «nos compra» (el lado comprador — «¿cuál es el cliente que más nos compra?») NO lo reconocía _COMERCIAL original — la derivada del registro sí");
  ok(!ORIG_COMERCIAL.test("cómo anda pagando") && !nuevoCom.test("cómo anda pagando"), "…y «pagando» NO enciende comercial (es cobranza, no se cruzó el vocabulario)");
  /* _COBRANZA YA NO es byte-idéntica desde la etapa 2 (owner 2026-09-24): se agregaron «cobrés?» y «paga» —
   * tolerancia morfológica, los ejemplos TEXTUALES del diseño («vendí, cobré», «…y cómo paga?»). Se prueba por
   * SUPERCONJUNTO DE CONDUCTA: todo lo que la fuente original reconocía SIGUE MAYORMENTE reconociéndose — con
   * DOS EXCEPCIONES A PROPÓSITO desde la etapa 4: «flujo de caja» y «efectivo» se QUITARON (eran el hallazgo que
   * la etapa 1 dejó documentado, sin tocar: «"efectivo" enciende cobranza Y tesorería a la vez» — la ley «caja ≠
   * cobranza» del mismo día dice que esas dos frases SON tesorería, no cobranza; el set de diseño v1 (q42) lo
   * confirmó como falla real: «cómo anda mi flujo de caja» encendía cobranza cuando el tema pedido era SOLO
   * tesorería). Esas dos exclusiones se prueban aparte, como una CORRECCIÓN, no como una regresión oculta. */
  const CASOS_COBRANZA_ORIGINALES = ["cobranza pendiente", "cobros del mes", "cobrado en su totalidad", "quiero cobrar esto", "estamos cobrando",
    "cuentas vencidas", "clientes en mora", "esas deudas", "me deben mucho", "debe hace tiempo", "adeudan capital",
    "los abonos del mes", "cuotas abonadas", "pagos pendientes", "clientes que pagan", "ya está pagado", "falta pagar",
    "el plazo de pago", "lo que está por cobrar", "saldos pendientes", "venta a crédito", "venta de contado"];
  const regresiones = CASOS_COBRANZA_ORIGINALES.filter((c) => ORIG_COBRANZA.test(c) && !nuevoCob.test(c));
  ok(regresiones.length === 0, `★ 0 regresiones (fuera de la corrección a propósito de abajo): los ${CASOS_COBRANZA_ORIGINALES.length} casos que _COBRANZA original reconocía, la derivada del registro los sigue reconociendo`, regresiones.join(" | "));
  ok(!ORIG_COBRANZA.test("¿cuánto cobré este mes?") && nuevoCob.test("¿cuánto cobré este mes?"), "★ tolerancia morfológica NUEVA: «cobré» (el ejemplo textual del diseño) NO lo reconocía _COBRANZA original — la derivada del registro sí");
  ok(!nuevoCob.test("el precio del cobre subió"), "…y «cobre» (el metal, sin tilde) sigue SIN encender cobranza: el fragmento nuevo exige la tilde a propósito");
  ok(!ORIG_COBRANZA.test("¿y cómo paga?") && nuevoCob.test("¿y cómo paga?"), "★ tolerancia morfológica NUEVA: «paga» (3a persona, del ejemplo textual «…margen, stock y cómo paga?») tampoco la reconocía la fuente original — la derivada del registro sí");
  ok(ORIG_COBRANZA.test("cómo anda mi flujo de caja") && !nuevoCob.test("cómo anda mi flujo de caja"), "★ CORRECCIÓN (etapa 4, set v1 q42): «flujo de caja» YA NO enciende cobranza — es tesorería, no cobranza (ley `adi-caja-no-es-cobranza`)");
  ok(ORIG_COBRANZA.test("cuánto efectivo tengo disponible") && !nuevoCob.test("cuánto efectivo tengo disponible"), "…«efectivo» tampoco — cierra el hallazgo que la etapa 1 había dejado documentado sin tocar");

  /* _TESORERIA: envoltorio distinto (\b(?:…)\b en vez de \b…\b por alternativa) — se prueba por CONDUCTA. Además,
   * en la etapa 4 sumó «proveedores»/«sueldos»/«capital de trabajo» (medido con el set de diseño v1: preguntas de
   * tesorería real que no dicen «caja»/«liquidez»/«efectivo» y quedaban sin NINGÚN dominio reconocido). */
  const ORIG_TESORERIA = /\bcaja\b|\bliquidez\b|\befectivo\b|\btesorer[ií]a\b/i;
  const nuevoTes = regexDeDominio("tesoreria");
  ok(nuevoTes.source !== ORIG_TESORERIA.source, "(nota, no falla) _TESORERIA NO quedó byte-idéntica: el envoltorio genérico agrupa la alternancia distinto — se exige EQUIVALENCIA DE CONDUCTA abajo");
  ok(!ORIG_TESORERIA.test("pagarle a mis proveedores") && nuevoTes.test("pagarle a mis proveedores"), "★ tolerancia NUEVA (etapa 4): «proveedores» — del ejemplo del set v1 «…me alcanza para pagarle a mis proveedores?» — la fuente original no lo reconocía");
  ok(!ORIG_TESORERIA.test("cubrir sueldos este mes") && nuevoTes.test("cubrir sueldos este mes"), "…«sueldos» tampoco");
  ok(!ORIG_TESORERIA.test("mi capital de trabajo disponible") && nuevoTes.test("mi capital de trabajo disponible"), "…«capital de trabajo» tampoco (y sigue sin encender inventario: `capital(?! de trabajo)` ya lo excluía)");
  const CASOS_TES = ["prioriza caja", "ordename por liquidez", "cuanto efectivo tengo", "tesoreria del negocio", "tesorería",
    "cajaliquidez", "micaja", "caja1", "la caja fuerte", "sin caja", "nada de esto", "CAJA", "Liquidez y Efectivo",
    "flujo de caja", "efectivo?", "¿cuánta liquidez tengo?"];
  const difs = CASOS_TES.filter((c) => ORIG_TESORERIA.test(c) !== nuevoTes.test(c));
  ok(difs.length === 0, `★ _TESORERIA: equivalencia de conducta sobre ${CASOS_TES.length} casos (0 diferencias)`, difs.join(" | "));
}

/* ═══ 4 · EL BARRIDO, HONESTO — lo migrado y lo que quedó en unión, con su porqué ═══════════════════════════════ */
H("4 · el barrido: lo migrado queda a fuente única; lo que sigue local está documentado, no perdido");
{
  const srcComercial = fs.readFileSync(new URL("./src/adi/agente/contratoComercial.js", import.meta.url), "utf8");
  const srcPrioridad = fs.readFileSync(new URL("./src/adi/agente/prioridadIntegrada.js", import.meta.url), "utf8");
  const srcDominios = fs.readFileSync(new URL("./src/config/contract/dominios.js", import.meta.url), "utf8");
  /* _COMERCIAL/_TESORERIA/_INVENTARIO pasaron de EAGER a PEREZOSO (owner 2026-09-24, `_import_sin_dato_gate`:
   * el candado marcaba la llamada a `regexDeDominio` a nivel de módulo como si derivara dato de tenant —el
   * registro es estático, pero el candado mira la ruta del import—; se memoizan en el primer uso). Se sigue
   * verificando que `regexDeDominio("comercial"/"tesoreria"/"inventario")` es la fuente, ahora dentro del getter. */
  ok(/regexDeDominio\("comercial"\)/.test(srcComercial), "★ contratoComercial.js: _COMERCIAL se deriva del registro (fuente única, perezoso)");
  ok(/const _OTRO_UNIVERSO = new RegExp/.test(srcComercial), "…_OTRO_UNIVERSO sigue local (documentado: es una señal más liviana a propósito, no inventario∪cobranza)");
  ok(/regexDeDominio\("tesoreria"\)/.test(srcPrioridad), "★ prioridadIntegrada.js: _TESORERIA se deriva del registro (fuente única, perezoso)");
  ok(/const _SINONIMOS = \[/.test(srcPrioridad) && /const _OBJ = /.test(srcPrioridad), "…_SINONIMOS/_OBJ siguen locales (documentado: vocabulario de CRITERIOS, no de dominios — mezcla «riesgo»/«urgente», que no son de ningún dominio)");
  ok(/QUEDÓ EN UNIÓN/i.test(srcDominios), "el registro documenta, en su propia cabecera, qué quedó en unión y por qué (no un olvido silencioso)");
  ok(/regexDeDominio\("inventario"\)/.test(fs.readFileSync(new URL("./src/adi/agente/contratoDeDominios.js", import.meta.url), "utf8")), "★ contratoDeDominios.js: _INVENTARIO se deriva del registro (perezoso)");

  /* §4b · «efectivo» — CERRADO en la etapa 4 (owner 2026-09-24, set de diseño v1: q42 lo destapó como falla real).
   * La etapa 1 había dejado esto como hallazgo sin tocar («_COBRANZA ya lo traía»); la ley «caja ≠ cobranza» del
   * mismo día y la propia medición contra el set v1 (0 «caja leída como cobranza» es una meta explícita del
   * protocolo) dieron la autorización para corregirlo: ahora «efectivo»/«flujo de caja» encienden SOLO tesorería. */
  const r = dominiosDeTexto("¿cuánto efectivo tengo?");
  ok(!r.dominios.includes("cobranza") && r.ausentes.includes("tesoreria"), `★ CERRADO (etapa 4): «efectivo» enciende SOLO tesorería, ya no cobranza`, JSON.stringify(r));
}

/* ═══ 5 · LOS OTROS CONSUMIDORES QUE YA DEPENDÍAN DE ESTOS TRES, INTACTOS ══════════════════════════════════════ */
H("5 · los consumidores de dominiosDe/esTemaComercial/pideTesoreria no cambian su conducta");
{
  /* DOMINIOS pasó de constante a getter perezoso (owner 2026-09-24, `_import_sin_dato_gate`): se llama, no se lee. */
  ok(DOMINIOS_CONTRATO().join(",") === "comercial,inventario,cobranza", `contratoDeDominios.js exporta DOMINIOS = comercial,inventario,cobranza (${DOMINIOS_CONTRATO().join(",")}), ahora derivado de idsActivos()`);
  ok(DOMINIOS_LEXICO().join(",") === "comercial,inventario,cobranza", `notario/lexico.js exporta DOMINIOS derivado del registro (${DOMINIOS_LEXICO().join(",")})`);
  ok(esTemaComercial("¿cómo van las ventas de Falabella?") === true, "esTemaComercial sigue reconociendo una pregunta comercial de siempre");
  ok(esTemaComercial("¿cuánto stock tengo?") === false, "…y una de inventario puro sigue sin ser comercial (conducta de siempre)");
  ok(dominiosDe("Mira ventas, margen e inventario juntos").dominios.join(",") === "comercial,inventario", "dominiosDe compone comercial+inventario como siempre (composición, no exclusión)");
  ok(criterioDeLaPregunta("prioriza cobranza").criterio === "credito", "criterioDeLaPregunta sigue traduciendo «cobranza» al criterio «credito» (exposición de crédito)");
}

console.log(`\n── _registro_de_dominios_gate: ${PASS} PASS · ${FAIL} FAIL (de ${PASS + FAIL}) ──`);
process.exit(FAIL ? 1 : 0);
