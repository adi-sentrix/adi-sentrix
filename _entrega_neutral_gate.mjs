/* === _entrega_neutral_gate.mjs · LA ENTREGA NEUTRAL Y LA PREGUNTA ABIERTA — CORTE 3e (owner 2026-09-26, offline)
 * ══════════════════════════════════════════════════════════════════════════════════════════════════════════════
 * Ley del owner («LA ENTREGA NO LE HABLA A NADIE», memoria `adi-flujo-producto-complemento.md`, REFINADO, dos
 * rondas): el LLM es dueño del trato y del tono → la Entrega va en TERCERA PERSONA, sin pronombres de trato (ni
 * tú ni usted); ADI identifica QUÉ conocimiento falta y SUGIERE la función más pertinente para CONSULTAR — nunca
 * afirma que esa función SABE la respuesta; la función se DERIVA del cruce DOMINIO (`config/contract/dominios.js:
 * funcion`) × TIPO DE HUECO (`config/contract/ausencias.js:TIPOS_DE_AUSENCIA`) — sin taxonomía nueva por caso,
 * sin fundamento → pregunta abierta SIN función (falla cerrado); nota pyme SOLO con perfil completo y banda
 * micro/pequeña.
 *
 * LO QUE ESTE GATE EXIGE:
 *   1 · CERO PRONOMBRES DE TRATO en el texto de ADI — las 4 rutas fijas + un barrido del catálogo de desarrollo
 *       vía el camino general (`componerEntrega`), en "completa" y en "breve". CARNADA: el detector no es un
 *       siempre-verde (una corrupción sintética con "usted"/"tú" lo enciende).
 *   2 · TODA PREGUNTA ABIERTA (`entrega.paraSuJuicio[i]._preguntaAbierta`) trae una función RASTREABLE al cruce
 *       de los dos catálogos (`preguntaAbierta.js:funcionSugeridaDe`, recalculada desde `item.fundamento` y
 *       comparada con `item.funcionSugerida`) o, sin fundamento válido, viaja SIN función (`funcionSugerida` y
 *       `dondePodriaEstar` en `null` — «falla cerrado», nunca una fuente inventada para tapar el hueco).
 *   3 · CARNADA «función inventada» → rojo — un ítem cuya `funcionSugerida` NO es la que el cruce deriva de su
 *       propio `fundamento` se detecta como no-rastreable.
 *   4 · REGLA DE COMPOSICIÓN — ADI nunca escribe «sabe», «conoce» ni «puede responder» sobre una función
 *       sugerida. CARNADA: una oración corrupta con esas palabras junto a «Función sugerida» se detecta.
 *   5 · NOTA PYME — ausente sin perfil o con perfil incompleto; ausente con perfil completo y banda mediana/
 *       grande; presente SOLO con perfil completo y banda micro/pequeña. CARNADA (implícita en la matriz): si el
 *       guardia de `_notaPymeDe` se rompiera y sirviera la nota siempre, la aserción "ausente sin perfil" arde.
 *   6 · AGREGADO (supervisor, revisión de cierre del 3d) — (a) el veredicto de una premisa nunca imprime una
 *       clave interna del ranking (la palabra "ranking", un `·` entre tokens en minúscula sin acento, o un
 *       `campo = valor` crudo): CARNADA + barrido sobre el catálogo de premisas. (b) un par base↔resultado
 *       IDÉNTICO nunca dice «pasaría de X a X»: dice «se mantiene en X» — CARNADA + barrido sobre el mismo
 *       sweep de `_simulacion_dueno_gate.mjs` (entidad × tipo de supuesto).
 *
 * CERO llamadas a un LLM · CERO red. Solo por `npm run gates:offline` o
 * `node --import ./scripts/offline-guard.mjs _entrega_neutral_gate.mjs`. */
import fs from "node:fs";
import { initTenant } from "./src/data/tenantStore.js";
import { TENANT_DEMO } from "./src/data/tenants/demo.js";
import { validarEncargo } from "./src/adi/encargo/validar.js";
import {
  componerEntrega,
  componerEntregaBrechaComercial, PREGUNTA_BRECHA_COMERCIAL,
  componerEntregaCobranza, PREGUNTA_COBRANZA,
  componerEntregaInventario, PREGUNTA_INVENTARIO,
  componerEntregaMultidominio, PREGUNTA_MULTIDOMINIO,
} from "./src/adi/entrega/componer.js";
import { construirPerfilCliente } from "./src/config/contract/perfilCliente.js";
import { funcionSugeridaDe, construirPreguntaAbierta } from "./src/adi/entrega/preguntaAbierta.js";
import { DOMINIOS_REGISTRO, dominioPorId } from "./src/config/contract/dominios.js";
import { TIPOS_DE_AUSENCIA } from "./src/config/contract/ausencias.js";
import { axisEntityNames } from "./src/adi/oracle/entityIndex.js";
import { CONCEPT_DEFS, resolveGlossary } from "./src/adi/sentrix/glossary.js";
import { clasificarFuente } from "./scripts/clasificarGates.mjs";

let pass = 0, fail = 0;
const ok = (c, m, extra = "") => { if (c) { pass++; console.log("  ✓ " + m); } else { fail++; console.log("  ✗ " + m + (extra ? "\n      " + extra : "")); } };
const H = (t) => console.log(`\n${t}`);

initTenant(TENANT_DEMO);

/* ── DETECTORES (los mismos que un `_entrega_gate` cualquiera de esta casa: puros, sin adivinar nada del texto
 * del usuario — SOLO auditan el texto que ADI misma escribió) ────────────────────────────────────────────────── */
// pronombres de trato — «su»/«sus» NO se marcan (posesivo de tercero, válido: «su dueño», «su período»); lo que
// se prohíbe es la MARCA inequívoca de trato directo (tú/usted y sus formas). Borde de palabra tolerante a
// acentos, igual que `config/contract/dominios.js:_W` (evita el hueco medido: `\b` no ve el borde de una tilde).
const _W = "[\\wáéíóúñÁÉÍÓÚÑ]";
// pronombres/posesivos de tuteo (siempre inequívocos) + un puñado de verbos en tú, la misma familia léxica que
// ya rompió esta Entrega antes de este corte («¿Tienes demasiado inventario?», «…sin que lo decidieras»,
// `sentrix/rolesCartera.js`) — no es exhaustivo (ninguna lista de verbos conjugados lo es sin una gramática
// completa), pero cubre los ataques REALES medidos en este corte, no uno inventado para la carnada.
const RE_TRATO = new RegExp(`(?<!${_W})(?:usted|ustedes|t[uú]|tus|tuyo|tuya|tuyos|tuyas|contigo|ti|te|tienes|puedes|decidiste|decidieras|declaraste|quieres|sabes)(?!${_W})`, "i");
const pronombresDeTrato = (texto) => { const m = RE_TRATO.exec(String(texto || "")); return m ? m[0] : null; };

// clave interna en el veredicto de una premisa — el patrón MEDIDO del defecto real: dos identificadores en
// minúscula (sin acento, «ranking»/«cliente»/«variacion», nunca un rótulo de la casa — esos van capitalizados,
// «Entidad · Concepto») unidos por el separador de índice «·», seguidos de un tercer campo y un «= valor» crudo.
// NO alcanza con «·» a secas: el candado `_textoDeTipo` de esta misma casa ya imprime "medido · subtotal · 6
// cuentas materiales…" (Tipo, en minúscula, legítimo) — la firma real del leak es el «= número» al final.
const RE_CLAVE_INTERNA = /\b[a-z][a-z_]*\s·\s[a-z][a-z_]*\s·\s[^=\n]{1,40}=\s*[\d.]/;
const claveInternaEnTexto = (texto) => RE_CLAVE_INTERNA.test(String(texto || ""));

// «pasaría de X a X» — el mismo valor a los dos lados de un par base↔resultado (afirma un cambio que no ocurrió).
// el límite de la captura NO es `\b` (el valor puede terminar en «%»/«pp», no-\w — el hueco medido en esta casa,
// CLAUDE.md: «\b no ve el fin de «Sí,»»): se usa un lookahead de no-letra/dígito en vez de un borde de palabra.
const RE_DE_X_A_X = new RegExp(`pasar[ií]a de (\\S+(?: ?%| ?pp)?) a \\1(?!${_W})`);
const deXaXMismo = (texto) => RE_DE_X_A_X.test(String(texto || ""));

// composición: «sabe»/«conoce»/«puede responder» pegado a una función sugerida (ley 6 — nunca se afirma que la
// función SEPA la respuesta). Se busca en la vecindad de «Función sugerida para consultar», no en el texto entero
// (la palabra «sabe» podría aparecer legítimamente en otra parte de una Entrega grande, fuera de este alcance).
const RE_FUNCION_SABE = /Función sugerida para consultar:[^\n]*\b(sabe|conoce|puede responder)\b/i;
const funcionAfirmaSaber = (texto) => RE_FUNCION_SABE.test(String(texto || ""));

/* ═══ 1 · CERO PRONOMBRES DE TRATO ═══════════════════════════════════════════════════════════════════════════ */
H("1 · cero pronombres de trato — las 4 rutas fijas + el camino general sobre el catálogo, en las dos profundidades");
{
  const RUTAS = [
    ["componerEntregaBrechaComercial", componerEntregaBrechaComercial({ pregunta: PREGUNTA_BRECHA_COMERCIAL })],
    ["componerEntregaCobranza", componerEntregaCobranza({ pregunta: PREGUNTA_COBRANZA })],
    ["componerEntregaInventario", componerEntregaInventario({ pregunta: PREGUNTA_INVENTARIO })],
    ["componerEntregaMultidominio", componerEntregaMultidominio({ pregunta: PREGUNTA_MULTIDOMINIO })],
  ];
  for (const [nombre, R] of RUTAS) {
    ok(R.ok, `${nombre} compone ok`, R.motivo);
    if (R.ok) ok(!pronombresDeTrato(R.texto), `${nombre} · cero pronombres de trato`, `encontrado: "${pronombresDeTrato(R.texto)}"`);
  }
}
{
  const CATALOGO = JSON.parse(fs.readFileSync("./fixtures/encargos-desarrollo.json", "utf8"));
  const CASOS_VALIDOS = CATALOGO.casos.filter((c) => c.esperado && c.esperado.valido === true);
  let compuestos = 0, sucios = [];
  for (const caso of CASOS_VALIDOS) {
    const res = validarEncargo(caso.encargo, {});
    const tienePartesUtiles = (res.partes || []).some((p) => p.estado === "resuelta" || p.estado === "parcial");
    if (!res.ok || !tienePartesUtiles) continue;
    for (const profundidad of ["completa", "breve"]) {
      const conProf = { ...res, encargo: { ...res.encargo, profundidad } };
      const entrega = componerEntrega(conProf);
      if (!entrega.ok) continue;
      compuestos++;
      const encontrado = pronombresDeTrato(entrega.texto);
      if (encontrado) sucios.push(`${caso.id}/${profundidad}: "${encontrado}"`);
    }
  }
  ok(compuestos >= 30, `${compuestos} composiciones auditadas sobre el catálogo (≥ 30)`);
  ok(sucios.length === 0, "0 composiciones con un pronombre de trato en el texto", sucios.join(" · "));
}
{
  // ★ CARNADA · el detector no es un siempre-verde: una corrupción sintética con «usted»/«tú» lo enciende.
  ok(!!pronombresDeTrato("Benchmark de margen: 30,1 %, declarado por usted."), "★ CARNADA · «declarado por usted» se detecta");
  ok(!!pronombresDeTrato("¿Tienes demasiado inventario?"), "★ CARNADA · «Tienes» (tú) se detecta");
  ok(!!pronombresDeTrato("La política de tu negocio."), "★ CARNADA · «tu negocio» se detecta");
  // control negativo — «su»/«sus» de tercero NO se marcan (posesivo válido, no es trato)
  ok(!pronombresDeTrato("Cada cifra viaja con su dueño, su período y su origen."), "control negativo · «su dueño»/«su período» (tercero) NO se marca");
  ok(!pronombresDeTrato("La empresa declaró su benchmark."), "control negativo · «su benchmark» (de la empresa, tercero) NO se marca");
}

/* ═══ 2 · TODA PREGUNTA ABIERTA TRAE UNA FUNCIÓN RASTREABLE, O VIAJA SIN FUNCIÓN (falla cerrado) ═══════════════ */
H("2 · toda pregunta abierta rastrea su función al cruce dominio × tipo de hueco, o viaja sin función");
{
  const RUTAS = [
    componerEntregaBrechaComercial({ pregunta: PREGUNTA_BRECHA_COMERCIAL }),
    componerEntregaCobranza({ pregunta: PREGUNTA_COBRANZA }),
    componerEntregaInventario({ pregunta: PREGUNTA_INVENTARIO }),
    componerEntregaMultidominio({ pregunta: PREGUNTA_MULTIDOMINIO }),
  ];
  let nPreguntas = 0;
  for (const R of RUTAS) {
    if (!R.ok) continue;
    for (const item of R.entrega.paraSuJuicio) {
      if (!item._preguntaAbierta) continue;
      nPreguntas++;
      const { dominio, tipoDeHueco } = item.fundamento || {};
      const recalc = funcionSugeridaDe({ dominio, tipoDeHueco });
      ok(item.funcionSugerida === (recalc.funcion || null), `pregunta abierta (${dominio || "?"}/${tipoDeHueco || "?"}) · funcionSugerida rastrea al cruce de los dos catálogos`, `item: ${item.funcionSugerida} · recalculada: ${recalc.funcion}`);
      ok(!tipoDeHueco || TIPOS_DE_AUSENCIA.includes(tipoDeHueco), `pregunta abierta · fundamento.tipoDeHueco ("${tipoDeHueco}") está en TIPOS_DE_AUSENCIA (el catálogo compartido, sin taxonomía nueva)`);
      // falla cerrado: sin función, tampoco hay fuente — nunca se inventa una para tapar el hueco
      if (item.funcionSugerida == null) ok(item.dondePodriaEstar == null, "pregunta abierta sin función · dondePodriaEstar también es null (falla cerrado)");
    }
  }
  ok(nPreguntas >= 6, `${nPreguntas} preguntas abiertas auditadas sobre las 4 rutas fijas (≥ 6: comercial+inventario+cobranza en brecha/cobranza/inventario sueltas + las 3 de multidominio)`);
}
{
  // ★ CARNADA · «función inventada» → rojo. Un ítem con una función que NO es la que el cruce deriva de su
  // propio fundamento es detectado como no-rastreable — la MISMA comparación de la sección 2, aplicada a mano.
  const item = { funcionSugerida: "el director financiero del holding", fundamento: { dominio: "cobranza", tipoDeHueco: "condicion_pactada" } };
  const recalc = funcionSugeridaDe(item.fundamento);
  ok(item.funcionSugerida !== recalc.funcion, "★ CARNADA · una función inventada («el director financiero del holding») NO calza con la derivada del cruce (\"" + recalc.funcion + "\") — se detecta como no-rastreable");
  // control negativo: la función REAL del cruce sí calza
  const itemOk = { funcionSugerida: recalc.funcion, fundamento: item.fundamento };
  ok(itemOk.funcionSugerida === funcionSugeridaDe(itemOk.fundamento).funcion, "control negativo · la función derivada del cruce SÍ calza consigo misma");
}
{
  // DOMINIOS_REGISTRO gana el atributo `funcion` — un dominio SIN el atributo rompería el cruce en silencio
  // (funcionSugeridaDe daría null aunque el tipo de hueco lo pidiera) — candado de forma, no de contenido.
  for (const d of DOMINIOS_REGISTRO) ok(typeof d.funcion === "string" && d.funcion.trim().length > 0, `dominios.js · el dominio "${d.id}" declara su atributo "funcion"`);
  ok(dominioPorId("cobranza").funcion === "la gestión de crédito y cobranza", 'dominios.js · cobranza.funcion es el ejemplo TEXTUAL del owner ("la gestión de crédito y cobranza")');
}

/* ═══ 3 · REGLA DE COMPOSICIÓN — nunca «sabe»/«conoce»/«puede responder» sobre una función sugerida ═══════════ */
H('3 · composición — ADI nunca escribe "sabe"/"conoce"/"puede responder" sobre una función sugerida');
{
  const RUTAS = [
    componerEntregaBrechaComercial({ pregunta: PREGUNTA_BRECHA_COMERCIAL }),
    componerEntregaCobranza({ pregunta: PREGUNTA_COBRANZA }),
    componerEntregaInventario({ pregunta: PREGUNTA_INVENTARIO }),
    componerEntregaMultidominio({ pregunta: PREGUNTA_MULTIDOMINIO }),
  ];
  for (const [i, R] of RUTAS.entries()) if (R.ok) ok(!funcionAfirmaSaber(R.texto), `ruta fija #${i + 1} · ninguna «Función sugerida» dice "sabe"/"conoce"/"puede responder"`);
  // ★ CARNADA · una oración corrupta con esas palabras junto a «Función sugerida» se detecta.
  ok(funcionAfirmaSaber("**Función sugerida para consultar:** la gestión de crédito y cobranza, que sabe la respuesta exacta."), '★ CARNADA · «Función sugerida… que sabe la respuesta» se detecta');
  ok(funcionAfirmaSaber("**Función sugerida para consultar:** compras y abastecimiento, quien conoce el motivo."), '★ CARNADA · «Función sugerida… quien conoce el motivo» se detecta');
  ok(!funcionAfirmaSaber("**Función sugerida para consultar:** la gestión de crédito y cobranza — también: el contrato pactado con la cuenta."), "control negativo · el texto real (sin esos verbos) no se marca");
}

/* ═══ 4 · NOTA PYME — solo con perfil completo y banda micro/pequeña ═══════════════════════════════════════════ */
H("4 · nota pyme — ausente sin perfil, ausente con banda mediana/grande, presente SOLO con perfil completo + micro/pequeña");
{
  const _base = { pregunta: "¿Deliberado?", porQueNoEstaEnLosDatos: "El dato no mide intención.", dominio: "cobranza", tipoDeHueco: "condicion_pactada", queCambia: "Cambia la acción." };
  const RE_NOTA_PYME = /en muchas pymes/i;

  const sinPerfil = construirPreguntaAbierta({ ..._base, perfil: null });
  ok(!RE_NOTA_PYME.test(sinPerfil.texto), "★ sin perfil (null) · nota pyme AUSENTE");

  const perfilIncompleto = { completo: false, campos: { tamano: { valor: "pequena" } } };
  const conIncompleto = construirPreguntaAbierta({ ..._base, perfil: perfilIncompleto });
  ok(!RE_NOTA_PYME.test(conIncompleto.texto), "★ CARNADA · perfil INCOMPLETO (aunque banda diga «pequena») · nota pyme AUSENTE — el guardia mira `perfil.completo`, no solo la banda");

  const perfilGrande = { completo: true, campos: { tamano: { valor: "grande" } } };
  const conGrande = construirPreguntaAbierta({ ..._base, perfil: perfilGrande });
  ok(!RE_NOTA_PYME.test(conGrande.texto), "perfil completo, banda «grande» · nota pyme AUSENTE (no es pyme)");

  const perfilMediana = { completo: true, campos: { tamano: { valor: "mediana" } } };
  const conMediana = construirPreguntaAbierta({ ..._base, perfil: perfilMediana });
  ok(!RE_NOTA_PYME.test(conMediana.texto), "perfil completo, banda «mediana» · nota pyme AUSENTE (no es pyme)");

  const perfilPequena = { completo: true, campos: { tamano: { valor: "pequena" } } };
  const conPequena = construirPreguntaAbierta({ ..._base, perfil: perfilPequena });
  ok(RE_NOTA_PYME.test(conPequena.texto), "★ perfil completo, banda «pequena» · nota pyme PRESENTE");

  const perfilMicro = { completo: true, campos: { tamano: { valor: "micro" } } };
  const conMicro = construirPreguntaAbierta({ ..._base, perfil: perfilMicro });
  ok(RE_NOTA_PYME.test(conMicro.texto), "★ perfil completo, banda «micro» · nota pyme PRESENTE");

  // sobre el tenant real: TENANT_DEMO (perfil incompleto) nunca sirve la nota, en ninguna de las 4 rutas fijas.
  const RUTAS = [componerEntregaBrechaComercial({ pregunta: PREGUNTA_BRECHA_COMERCIAL }), componerEntregaCobranza({ pregunta: PREGUNTA_COBRANZA }), componerEntregaInventario({ pregunta: PREGUNTA_INVENTARIO }), componerEntregaMultidominio({ pregunta: PREGUNTA_MULTIDOMINIO })];
  for (const [i, R] of RUTAS.entries()) if (R.ok) ok(!RE_NOTA_PYME.test(R.texto), `TENANT_DEMO (perfil incompleto) · ruta fija #${i + 1} · nota pyme AUSENTE`);
}

/* ═══ 5 · AGREGADO (a) — el veredicto de una premisa nunca imprime una clave interna del ranking ═══════════════ */
H("5 · AGREGADO (a) — el veredicto de una premisa no imprime clave interna (ranking · «·» de índice · campo=valor)");
{
  // ★ CARNADA · la forma que el owner citó como defecto real («ranking cliente · variacion · Mercado Libre = 25.3%»)
  ok(claveInternaEnTexto("Sobre la premisa declarada por la empresa: es correcto — ranking cliente · variacion · Mercado Libre = 25.3%."), '★ CARNADA · «ranking cliente · variacion · Mercado Libre = 25.3%» se detecta como clave interna');
  // control negativo — el rótulo de la casa correcto («Entidad · Concepto», capitalizado) no se marca
  ok(!claveInternaEnTexto("Mercado Libre creció 25,3 % contra el año anterior, la mayor variación de la cartera."), "control negativo · el rótulo de la casa (redactado) NO se marca");
  ok(!claveInternaEnTexto("Falabella · Margen: 21,5 %."), 'control negativo · «Entidad · Concepto» capitalizado (el rótulo de la casa) NO se marca');

  // sobre el catálogo real (casos con premisas) — cero veredictos con clave interna.
  const CATALOGO = JSON.parse(fs.readFileSync("./fixtures/encargos-desarrollo.json", "utf8"));
  const CON_PREMISAS = CATALOGO.casos.filter((c) => c.encargo && Array.isArray(c.encargo.premisas) && c.encargo.premisas.length && c.esperado && c.esperado.valido === true);
  ok(CON_PREMISAS.length >= 5, `el catálogo trae ≥5 casos con premisas (trae ${CON_PREMISAS.length})`);
  let sucios = [];
  for (const caso of CON_PREMISAS) {
    const res = validarEncargo(caso.encargo, {});
    if (!res.ok) continue;
    const R = componerEntrega(res);
    if (!R.ok) continue;
    if (claveInternaEnTexto(R.texto)) sucios.push(caso.id);
  }
  ok(sucios.length === 0, "0 composiciones reales con clave interna en el veredicto de una premisa", sucios.join(" · "));
}

/* ═══ 6 · AGREGADO (b) — un par base↔resultado idéntico dice «se mantiene en X», nunca «de X a X» ═══════════════ */
H('6 · AGREGADO (b) — «se mantiene en X», nunca «pasaría de X a X» cuando base y resultado son iguales');
{
  ok(deXaXMismo("El margen pasaría de 22,0 % a 22,0 %."), "★ CARNADA · «pasaría de 22,0 % a 22,0 %» (mismo valor) se detecta");
  ok(!deXaXMismo("El margen pasaría de 22,0 % a 23,0 % (1 pp)."), "control negativo · valores DISTINTOS no se marcan");
  ok(!deXaXMismo("El margen se mantiene en 22,0 %."), "control negativo · la forma nueva («se mantiene en») no se marca (no hay «de… a…» que comparar)");

  // barrido real — el mismo sweep de `_simulacion_dueno_gate.mjs` (entidad × tipo de supuesto con productor);
  // cero «de X a X», y AL MENOS un caso real cae en «se mantiene en» (si no, este AGREGADO no se está ejercitando).
  const ENTIDADES = axisEntityNames("cliente");
  const TIPOS = [
    { tipo: "growth", valor: 10, unidad: "pct" },
    { tipo: "price", valor: 5, unidad: "pct" },
    { tipo: "margin", valor: 3, unidad: "pct" },
    { tipo: "costo", valor: -5, unidad: "pct" },
    { tipo: "carga", valor: -1, unidad: "pp" },
  ];
  let compuestas = 0, conDeXaX = [], conSeMantiene = 0;
  for (const entidad of ENTIDADES) {
    for (const t of TIPOS) {
      const encargo = { version: "encargo/v1", partes: [{ id: "p1", tema: "comercial", cierre: "simulacion", entidades: [{ nombre: entidad }], supuestos: ["s1"] }], supuestos: [{ id: "s1", tipo: t.tipo, valor: t.valor, unidad: t.unidad, alcance: { eje: "cliente", nombre: entidad }, origen: "supuesto" }] };
      const res = validarEncargo(encargo, {});
      if (!res.ok) continue;
      const R = componerEntrega(res);
      if (!R.ok) continue;
      compuestas++;
      if (deXaXMismo(R.texto)) conDeXaX.push(`${entidad}/${t.tipo}`);
      if (/se mantiene en /.test(R.texto)) conSeMantiene++;
    }
  }
  ok(compuestas >= 50, `${compuestas} simulaciones auditadas (barrido entidad × tipo, ≥ 50)`);
  ok(conDeXaX.length === 0, "0 simulaciones con «pasaría de X a X» (mismo valor)", conDeXaX.join(" · "));
  ok(conSeMantiene >= 1, `≥1 simulación real cae en "se mantiene en" (dio ${conSeMantiene}) — el AGREGADO se ejercita de verdad, no solo en la carnada`);
}

/* ═══ 8 · GLOSARIO — «una sola verdad por concepto, dos registros de presentación» (owner 2026-09-26, resuelve
 * la duda 2 del corte) ═══════════════════════════════════════════════════════════════════════════════════════
 * `sentrix/glossary.js` sigue en tuteo (correcto para Sentrix); cada concepto de `CONCEPT_DEFS` gana un campo
 * `neutra` (la misma definición, en tercera persona) que la Entrega usa SIEMPRE — `_neutralizarPosesivoGlosario`
 * (el parche de posesivos del corte anterior) se retiró: no cubría un verbo conjugado en tú («que definiste»).
 * Acá se prueba: (a) todo concepto tiene `neutra`; (b) `neutra` no tiene pronombres de trato NI verbos en
 * segunda persona (pretérito -aste/-iste, presente tras «que»); (c) `neutra` nombra los MISMOS términos de
 * fórmula (**negrita**) que el original — no es una definición distinta, es la misma verdad reescrita. */
H("7 · glosario — todo concepto de CONCEPT_DEFS tiene `neutra`, sin pronombres de trato, misma verdad que el original");
{
  // detector de VERBO EN SEGUNDA PERSONA (pretérito -aste/-iste, o presente -as/-es inmediatamente tras «que») —
  // acotado a este texto corto (definiciones de un párrafo), no una gramática completa. Lista de falsos positivos
  // MEDIDA contra el propio corpus (37 conceptos): sustantivos/verbos de tercero que terminan igual («existe»,
  // «consiste») no son un verbo en tú.
  const _FALSOS_POSITIVOS_2P = new Set(["existe", "existen", "consiste", "consisten", "resiste", "resisten", "asiste", "asisten", "reviste", "revisten"]);
  const RE_PRETERITO_2P = /\b\w*(?:aste|iste)\b/gi;
  const RE_PRESENTE_2P_TRAS_QUE = /\bque\s+(\w*(?:as|es))\b/gi;
  // «es» (ser, 3ª persona: «que es X») es, con enorme diferencia, el falso positivo más común de este patrón —
  // nunca el tuteo «tú eres» (que se escribe «eres», no «es»). Exclusión puntual, medida contra el corpus real.
  const _FALSOS_POSITIVOS_QUE = new Set(["es"]);
  const _W2 = "[\\wáéíóúñÁÉÍÓÚÑ]";
  const RE_TRATO_GLOSARIO = new RegExp(`(?<!${_W2})(?:usted|ustedes|t[uú]s?|tuyo|tuya|tuyos|tuyas|contigo|ti|te)(?!${_W2})`, "i");
  function verboOPronombre2P(texto) {
    const t = String(texto || "");
    if (RE_TRATO_GLOSARIO.test(t)) return RE_TRATO_GLOSARIO.exec(t)[0];
    const pret = [...t.matchAll(RE_PRETERITO_2P)].map((x) => x[0]).find((w) => !_FALSOS_POSITIVOS_2P.has(w.toLowerCase()));
    if (pret) return pret;
    const pres = [...t.matchAll(RE_PRESENTE_2P_TRAS_QUE)].find((x) => !_FALSOS_POSITIVOS_QUE.has(x[1].toLowerCase()));
    if (pres) return pres[0];
    return null;
  }
  // «misma verdad»: los términos en **negrita** (las referencias cruzadas a otros conceptos) de `neutra` son
  // EXACTAMENTE los de la definición original — nunca una definición distinta con otro vocabulario de fórmula.
  const _negritas = (t) => [...String(t || "").matchAll(/\*\*([^*]+)\*\*/g)].map((m) => m[1]).sort();

  const slugs = Object.keys(CONCEPT_DEFS);
  ok(slugs.length >= 30, `CONCEPT_DEFS trae ${slugs.length} conceptos (≥ 30)`);
  let sinNeutra = [], conTrato = [], distintaVerdad = [];
  for (const slug of slugs) {
    const c = CONCEPT_DEFS[slug];
    if (!c.neutra || !c.neutra.def) { sinNeutra.push(slug); continue; }
    const v1 = verboOPronombre2P(c.neutra.aka) || verboOPronombre2P(c.neutra.def) || verboOPronombre2P(c.neutra.distingue);
    if (v1) conTrato.push(`${slug}: "${v1}"`);
    const negOriginal = _negritas(c.def).concat(_negritas(c.distingue || "")).sort();
    const negNeutra = _negritas(c.neutra.def).concat(_negritas(c.neutra.distingue || "")).sort();
    if (JSON.stringify(negOriginal) !== JSON.stringify(negNeutra)) distintaVerdad.push(`${slug}: original=${JSON.stringify(negOriginal)} neutra=${JSON.stringify(negNeutra)}`);
  }
  ok(sinNeutra.length === 0, `todo concepto de CONCEPT_DEFS tiene "neutra" (${slugs.length}/${slugs.length})`, sinNeutra.join(" · "));
  ok(conTrato.length === 0, "0 conceptos con pronombre de trato o verbo en 2ª persona dentro de \"neutra\"", conTrato.join(" · "));
  ok(distintaVerdad.length === 0, "0 conceptos donde \"neutra\" nombra términos de fórmula distintos del original (misma verdad)", distintaVerdad.join(" · "));

  // ★ CARNADA · el detector no es un siempre-verde.
  ok(!!verboOPronombre2P("es la referencia que tú declaraste para este análisis"), '★ CARNADA · «tú declaraste» se detecta (pronombre)');
  ok(!!verboOPronombre2P("es contribución que quedas sin capturar por operar bajo el benchmark"), '★ CARNADA · «que quedas» (presente 2ª persona tras «que») se detecta');
  ok(!!verboOPronombre2P("la brecha de margen que ese costo definiste ayer"), '★ CARNADA · «definiste» (pretérito -iste) se detecta');
  ok(!verboOPronombre2P("El estado del inventario existe siempre que haya SKU"), "control negativo · «existe» (falso positivo conocido de -iste) NO se marca");
  ok(!verboOPronombre2P("Es la brecha entre lo que un cliente aporta hoy y lo que aportaría si alcanzara el benchmark de margen."), "control negativo · texto real de \"neutra\" (no_capturada) no se marca");

  // CANDADO — `entrega/componer.js:_planDefinicion` usa SIEMPRE `neutra`, nunca `facts.definicion`/`facts.distingue`
  // crudos: sobre el catálogo real, cada Entrega con cierre "definicion" sirve texto de `neutra`, no el de Sentrix.
  const CATALOGO = JSON.parse(fs.readFileSync("./fixtures/encargos-desarrollo.json", "utf8"));
  const CASOS_DEF = CATALOGO.casos.filter((c) => c.encargo && Array.isArray(c.encargo.partes) && c.encargo.partes.some((p) => p.cierre === "definicion") && c.esperado && c.esperado.valido === true);
  ok(CASOS_DEF.length >= 1, `el catálogo trae ≥1 caso con cierre "definicion" (trae ${CASOS_DEF.length})`);
  for (const caso of CASOS_DEF) {
    const parteDef = caso.encargo.partes.find((p) => p.cierre === "definicion");
    const res = validarEncargo(caso.encargo, {});
    if (!res.ok) continue;
    const R = componerEntrega(res);
    if (!R.ok) continue;
    const g = resolveGlossary(parteDef.concepto);
    if (!g || !g.neutra) continue;
    ok(R.texto.includes(g.neutra.def), `${caso.id} · la Entrega sirve el texto de "neutra" para «${parteDef.concepto}»`, R.texto.slice(0, 300));
    if (g.def && g.def !== g.neutra.def) ok(!R.texto.includes(g.def), `${caso.id} · la Entrega NO sirve el texto de Sentrix (tuteo) para «${parteDef.concepto}»`);
  }
}

/* ═══ 8 · CERO red ═══════════════════════════════════════════════════════════════════════════════════════════ */
H("8 · CERO red — clasificarFuente(este gate) === offline");
{
  const propio = fs.readFileSync(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"), "utf8");
  const c = clasificarFuente(propio);
  ok(c.tipo === "offline", "este gate se clasifica offline (no toca la red)", JSON.stringify(c));
}

console.log(`\n── _entrega_neutral_gate: PASS ${pass} · FAIL ${fail} (de ${pass + fail}) ──`);
if (fail > 0) process.exit(1);
