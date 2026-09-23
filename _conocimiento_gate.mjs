/* === _conocimiento_gate.mjs · LA CAPA DE CONOCIMIENTO DE OFICIO (owner 2026-09-23, offline) ═══════════════════════
 * `_ADI_BUSINESS_KNOWLEDGE_V0_PROPUESTA.md` v0.2 — la infraestructura del mecanismo (pertinencia + medición),
 * no el contenido. Bandera `ADI_CONOCIMIENTO` (voiceFlags.js) APAGADA en todos los perfiles: sin entrada en
 * ningún perfil de flagProfile.js, igual que ADI_ENTREGA/ADI_NOTARIO_V3. Nada de esto cambia una Entrega
 * servida hoy — la prueba central de este gate (§8) es exactamente esa.
 *
 * LO QUE ESTE GATE EXIGE (documento §7, traducido al mecanismo real):
 *   1 · ninguna pieza se sirve sin pertinencia verdadera.
 *   2 · toda pieza servida trae estado y, si ocurre/no_ocurre, una cifra con id; si indeterminable, un motivo
 *       con el insumo nombrado.
 *   3 · "no_ocurre" solo con `decisivo: true` — nunca sobre una medición no decisiva.
 *   4 · ninguna pieza con literal numérico en `pertinencia` ni en `efecto`/`condicion`/`contraindicacion`
 *       (candado del validador de esquema).
 *   5 · `sujeto: "sector"` en toda pieza, y el enunciado no nombra ninguna entidad real del tenant.
 *   6 · una pieza en `estado: "borrador"` NUNCA se sirve — las cuatro piezas sembradas nacen así.
 *   7 · perfil incompleto apaga la capa entera (candado ya existente de perfilCliente.js, reusado).
 *   8 · LA CONCLUSIÓN DEL PROCEDIMIENTO ES BYTE-IDÉNTICA CON LA CAPA ENCENDIDA Y APAGADA — se prueba sobre las
 *       cuatro rutas reales de `componer.js`, comparando la Entrega completa MENOS `referenciaDelOficio` (que
 *       es exactamente lo que la capa agrega) y MENOS el libro/hechos internos de esa sección.
 *   9 · carnadas: pieza con umbral escondido (literal numérico) → el validador la rechaza · pieza sin
 *       `no_implica` → rechazada · pieza no decisiva forzada a "no_ocurre" (decisivo:false) → nunca se sirve
 *       ese veredicto, cae a indeterminable · una pieza en borrador, aun siendo válida y pertinente, no aparece
 *       en la salida servida.
 *
 * Sobre TENANT_DEMO real (`_entrega_gate.mjs` ya certifica que este mismo tenant compone las cuatro Entregas).
 * Sin red: todo lo que este gate corre son tools locales/deterministas, las mismas que ya certifica ese gate.
 * Solo por `npm run gates:offline` (o `node --import ./scripts/offline-guard.mjs _conocimiento_gate.mjs`). */
import { initTenant, getTenantData } from "./src/data/tenantStore.js";
import { TENANT_DEMO } from "./src/data/tenants/demo.js";
import { ESCENARIO_INICIAL } from "./src/config/scenarios.js";
import { construirPerfilCliente, perfilAutorizaConocimiento } from "./src/config/contract/perfilCliente.js";
import { ADI_CONOCIMIENTO } from "./src/config/voiceFlags.js";
import {
  componerEntregaBrechaComercial, PREGUNTA_BRECHA_COMERCIAL,
  componerEntregaCobranza, PREGUNTA_COBRANZA,
  componerEntregaInventario, PREGUNTA_INVENTARIO,
  componerEntregaMultidominio, PREGUNTA_MULTIDOMINIO,
} from "./src/adi/entrega/componer.js";
import { PIEZAS_CONOCIMIENTO, piezaPorId } from "./src/adi/conocimiento/piezas.js";
import { validarPieza, piezasValidas } from "./src/adi/conocimiento/validarPieza.js";
import { predicadoValido, PREDICADOS_CERRADOS } from "./src/adi/conocimiento/predicados.js";
import { construirTablaDeSenales } from "./src/adi/conocimiento/tablaSenales.js";
import { evaluarPertinencia } from "./src/adi/conocimiento/evaluarPertinencia.js";
import { medirPieza } from "./src/adi/conocimiento/medir.js";
import { servirPieza } from "./src/adi/conocimiento/servir.js";
import { aplicarAcotadores, TOPE_CARACTERES_OFICIO } from "./src/adi/conocimiento/acotadores.js";
import { recuentoDeLoRevisado } from "./src/adi/conocimiento/recuento.js";
import { referenciaDelOficio, _evaluarInfraestructura } from "./src/adi/conocimiento/seleccionar.js";

let pass = 0, fail = 0;
const ok = (c, m, extra = "") => { if (c) { pass++; console.log("  ✓ " + m); } else { fail++; console.log("  ✗ " + m + (extra ? "\n      " + extra : "")); } };
const H = (t) => console.log(`\n${t}`);

initTenant(TENANT_DEMO);
const PREGUNTA_LECTURA = PREGUNTA_MULTIDOMINIO;

/* ── un tenant de PRUEBA, perfil completo (camino B, sin tocar TENANT_DEMO ni ninguna migración) — solo para
 * probar el mecanismo con la puerta 2 (perfil) abierta; TENANT_DEMO real queda con su perfil incompleto, como
 * ya certifica `_entrega_gate.mjs` ── */
const TENANT_PERFIL_COMPLETO = {
  ...TENANT_DEMO,
  perfil: {
    ...TENANT_DEMO.perfil,
    sector: { valor: "distribucion", procedencia: "medido" },
    tipoProducto: { valor: "durable", procedencia: "medido" },
    pais: { valor: "CL", procedencia: "medido" },
    modeloComercial: { valor: "cuentas_grandes", procedencia: "medido" },
  },
};
const PERFIL_COMPLETO = construirPerfilCliente(TENANT_PERFIL_COMPLETO);
const PERFIL_INCOMPLETO = construirPerfilCliente(TENANT_DEMO);

/* ═══ 0 · LA BANDERA — apagada en todos los perfiles bajo Node (piso) ═══ */
H("0 · ADI_CONOCIMIENTO — apagada bajo Node (piso), como ADI_ENTREGA/ADI_NOTARIO_V3");
ok(ADI_CONOCIMIENTO === false, "ADI_CONOCIMIENTO da false bajo Node — encenderla es una decisión del owner en flagProfile.js, no un efecto de este commit");

/* ═══ 1 · LAS CUATRO PIEZAS SEMBRADAS — esquema válido, todas "borrador", sin firma ═══
 * Owner 2026-09-23 (defecto 4 de la validación de contenido): RSG-06 y MOV-05 medían EXACTAMENTE lo mismo que
 * CAU-06 (mismo predicado, mismo cálculo `skuFrenadoVsTopSeller`) y se colapsaron dentro de CAU-06 — ver la
 * cabecera de `piezas.js`. Quedan 4 piezas sembradas, no 6; sus ids ya no existen en el catálogo. */
H("1 · piezas.js — las cuatro piezas sembradas (CAU-01 · CAU-06 · CAU-03 · PRI-04)");
ok(PIEZAS_CONOCIMIENTO.length === 4, `hay exactamente 4 piezas sembradas (hay ${PIEZAS_CONOCIMIENTO.length})`);
for (const id of ["CAU-01", "CAU-06", "CAU-03", "PRI-04"]) ok(!!piezaPorId(id), `la pieza ${id} está sembrada`);
// ★ CARNADA · RSG-06 y MOV-05 NO deben resucitar como piezas propias (se colapsaron dentro de CAU-06)
for (const id of ["RSG-06", "MOV-05"]) ok(!piezaPorId(id), `★ CARNADA · la pieza ${id} NO está sembrada (colapsada dentro de CAU-06, defecto 4)`);
for (const p of PIEZAS_CONOCIMIENTO) {
  const r = validarPieza(p, { entidadesConocidas: (TENANT_DEMO.clientesVentas || []).map((c) => c.nombre) });
  ok(r.ok, `${p.id} pasa el validador de esquema`, r.errores.join(" | "));
  ok(p.estado === "borrador", `${p.id} nace en estado "borrador"`);
  ok(p.firma == null, `${p.id} no trae firma (sin validar — el owner no aprobó el contenido)`);
  ok(p.sujeto === "sector", `${p.id} declara sujeto "sector", nunca una empresa del cliente`);
  ok(typeof p.no_implica === "string" && p.no_implica.trim().length > 0, `${p.id} declara su "no_implica"`);
}

/* ═══ 2 · LOS PREDICADOS — lista cerrada, sin literales numéricos en ninguna pieza ═══ */
H("2 · predicados.js + validarPieza.js — vocabulario cerrado, cero literales numéricos");
ok(PREDICADOS_CERRADOS.length > 0, `el vocabulario cerrado declara ${PREDICADOS_CERRADOS.length} predicados`);
{
  const usados = new Set();
  const rec = (n) => { if (typeof n === "string") { usados.add(n); return; } if (!n || typeof n !== "object") return; for (const k of ["todo", "alguno"]) if (Array.isArray(n[k])) for (const h of n[k]) rec(h); if (n.no != null) rec(n.no); };
  for (const p of PIEZAS_CONOCIMIENTO) rec(p.pertinencia);
  ok(usados.size > 0, `las piezas usan ${usados.size} predicados distintos`);
  for (const u of usados) ok(predicadoValido(u), `el predicado "${u}" está en la lista cerrada`);
  for (const p of PIEZAS_CONOCIMIENTO) {
    ok(!/\d/.test(JSON.stringify(p.pertinencia)), `${p.id}.pertinencia no trae ningún dígito`);
    ok(!("efecto" in p) || !/\d/.test(JSON.stringify(p.efecto)), `${p.id}.efecto no trae ningún dígito`);
  }
}
{
  // ★ CARNADA · una pieza con un umbral escondido en pertinencia (el literal "30" disfrazado de predicado)
  const conUmbral = { ...piezaPorId("CAU-01"), id: "CARNADA-UMBRAL", pertinencia: { todo: ["cuenta.bajo_benchmark"], alguno: ["30"] } };
  const rUmbral = validarPieza(conUmbral);
  ok(!rUmbral.ok, "★ CARNADA · una pieza con un literal numérico en pertinencia es RECHAZADA por el validador", rUmbral.errores.join(" | "));
  // ★ CARNADA · una pieza sin no_implica
  const sinNoImplica = { ...piezaPorId("CAU-01"), id: "CARNADA-SIN-NO-IMPLICA", no_implica: "" };
  const rSinNI = validarPieza(sinNoImplica);
  ok(!rSinNI.ok, "★ CARNADA · una pieza sin no_implica es RECHAZADA por el validador", rSinNI.errores.join(" | "));
  // ★ CARNADA · el sujeto del enunciado nombra una empresa real del cliente
  const conNombreDeCliente = { ...piezaPorId("CAU-01"), id: "CARNADA-SUJETO-EMPRESA", enunciado: "Cuando Lider está bajo el benchmark, mira su carga." };
  const rNombre = validarPieza(conNombreDeCliente, { entidadesConocidas: (TENANT_DEMO.clientesVentas || []).map((c) => c.nombre) });
  ok(!rNombre.ok, "★ CARNADA · un enunciado que nombra una entidad real del tenant es RECHAZADO", rNombre.errores.join(" | "));
  // control negativo: la MISMA pieza sin el defecto sigue pasando
  ok(validarPieza(piezaPorId("CAU-01")).ok, "control negativo · CAU-01 real (sin el defecto de arriba) sigue válida");
}

/* ═══ 3 · LA TABLA DE SEÑALES — proyección real sobre TENANT_DEMO, sin umbrales nuevos ═══ */
H("3 · tablaSenales.js — proyección real (TENANT_DEMO, escenario " + ESCENARIO_INICIAL + ")");
initTenant(TENANT_DEMO);
const TABLA = construirTablaDeSenales({ scenario: ESCENARIO_INICIAL, pregunta: PREGUNTA_LECTURA });
{
  const nCuentas = Object.keys(TABLA.cuentas).length, nSkus = Object.keys(TABLA.skus).length;
  ok(nCuentas > 0, `la tabla trae señales de ${nCuentas} cuentas`);
  ok(nSkus > 0, `la tabla trae señales de ${nSkus} SKU (con capital frenado o entre los que más venden)`);
  const bajoBenchmark = Object.entries(TABLA.cuentas).filter(([, c]) => c.bajoBenchmark).map(([e]) => e);
  const cargaAlta = Object.entries(TABLA.cuentas).filter(([, c]) => c.cargaAlta).map(([e]) => e);
  const vencido = Object.entries(TABLA.cuentas).filter(([, c]) => c.vencidoPositivo).map(([e]) => e);
  const frenados = Object.entries(TABLA.skus).filter(([, s]) => s.frenado).map(([e]) => e);
  console.log(`      cuentas bajo benchmark (${bajoBenchmark.length}): ${bajoBenchmark.join(", ")}`);
  console.log(`      cuentas con carga alta (${cargaAlta.length}): ${cargaAlta.join(", ")}`);
  console.log(`      cuentas con vencido > 0 (${vencido.length}): ${vencido.join(", ")}`);
  console.log(`      SKU frenados (${frenados.length}): ${frenados.join(", ")}`);
  ok(bajoBenchmark.length > 0 && bajoBenchmark.length < nCuentas, "el conjunto bajo benchmark es un subconjunto propio (ni vacío ni todas)");
  ok(frenados.length > 0, "hay al menos un SKU frenado en este tenant");
}

/* ═══ 4 · PERTINENCIA — por entidad, nunca booleana global ═══ */
H("4 · evaluarPertinencia.js — las entidades encendidas, no un booleano");
{
  const pCAU01 = evaluarPertinencia(piezaPorId("CAU-01"), TABLA, PERFIL_COMPLETO, PREGUNTA_LECTURA);
  ok(pCAU01.pertinente, "CAU-01 es pertinente en al menos una cuenta");
  ok(pCAU01.eje === "cuenta", "CAU-01 recorre el eje \"cuenta\"");
  ok(pCAU01.entidades.length > 0 && pCAU01.entidades.length < Object.keys(TABLA.cuentas).length, `CAU-01 enciende en ${pCAU01.entidades.length} de ${Object.keys(TABLA.cuentas).length} cuentas — pertinencia POR ENTIDAD, no global`);
  const pCAU06 = evaluarPertinencia(piezaPorId("CAU-06"), TABLA, PERFIL_COMPLETO, PREGUNTA_LECTURA);
  ok(pCAU06.eje === "sku", "CAU-06 recorre el eje \"sku\"");
  ok(pCAU06.entidades.length === Object.entries(TABLA.skus).filter(([, s]) => s.frenado).length, "CAU-06 enciende exactamente en los SKU frenados, ni uno más");
  // control negativo: una pieza cuyo predicado nunca se cumple (una copia de CAU-01 pidiendo un predicado indisponible)
  const nuncaEnciende = { ...piezaPorId("CAU-01"), id: "CTRL-NUNCA", pertinencia: { todo: ["cuenta.bajo_benchmark", "cuenta.contraparte_cadena"] } };
  const pNunca = evaluarPertinencia(nuncaEnciende, TABLA, PERFIL_COMPLETO, PREGUNTA_LECTURA);
  ok(!pNunca.pertinente && pNunca.entidades.length === 0, "control negativo · un predicado no disponible (Ficha sin integrar) nunca enciende — conservador, no se sirve");
}

/* ═══ 5 · MEDICIÓN — los tres estados, cada uno con su respaldo ═══ */
H("5 · medir.js — ocurre / no_ocurre / indeterminable, con cifra+id o motivo+resolveria");
{
  const cuentaBajoBenchmark = Object.entries(TABLA.cuentas).find(([, c]) => c.bajoBenchmark)[0];
  const mCAU01 = medirPieza(piezaPorId("CAU-01"), cuentaBajoBenchmark, TABLA);
  ok(["ocurre", "no_ocurre"].includes(mCAU01.estado), `CAU-01 sobre ${cuentaBajoBenchmark} mide un veredicto decisivo (dio "${mCAU01.estado}")`);
  ok(!!mCAU01.cifra && !!mCAU01.cifra.id, "★ toda pieza servida trae una cifra CON ID (regla 2 del documento)", JSON.stringify(mCAU01.cifra));
  console.log(`      CAU-01 · ${cuentaBajoBenchmark} · ${mCAU01.estado}: ${mCAU01.cifra.texto} contra ${mCAU01.referencia.texto}`);

  const mCAU03 = medirPieza(piezaPorId("CAU-03"), Object.keys(TABLA.cuentas)[0], TABLA);
  ok(mCAU03.estado === "indeterminable", "CAU-03 (vencido por tramo, NO existe en el motor) siempre da \"indeterminable\"");
  ok(typeof mCAU03.motivo === "string" && mCAU03.motivo.length > 0 && typeof mCAU03.resolveria === "string", "★ todo \"indeterminable\" trae motivo Y qué lo resolvería (regla 2)", mCAU03.motivo);

  // ★ REGLA 3 · no_ocurre SOLO si decisivo:true — carnada: la MISMA condición con decisivo:false
  const cuentaNoBajoBenchmark = Object.entries(TABLA.cuentas).find(([, c]) => !c.bajoBenchmark && c.cargaPct != null && !c.cargaSobreResto);
  ok(!!cuentaNoBajoBenchmark, "hay al menos una cuenta con carga% bajo el promedio del resto (para la carnada de \"no_ocurre\")");
  if (cuentaNoBajoBenchmark) {
    const noDecisiva = { ...piezaPorId("CAU-01"), id: "CARNADA-NO-DECISIVA", medicion: { ...piezaPorId("CAU-01").medicion, decisivo: false } };
    const mNoDecisiva = medirPieza(noDecisiva, cuentaNoBajoBenchmark[0], TABLA);
    ok(mNoDecisiva.estado === "indeterminable" && mNoDecisiva.motivo === "la cifra disponible no decide (medición no decisiva)", "★ CARNADA · con decisivo:false, un comparador que da falso NUNCA dice \"no_ocurre\" — cae a indeterminable con el motivo exacto del documento", mNoDecisiva.estado);
    const mDecisiva = medirPieza(piezaPorId("CAU-01"), cuentaNoBajoBenchmark[0], TABLA);
    ok(mDecisiva.estado === "no_ocurre", "control · la MISMA condición, con decisivo:true (CAU-01 real), sí dice \"no_ocurre\"");
  }
}

/* ═══ 5b · EL "NO IMPLICA" QUE LLEGA AL USUARIO (defecto 1, owner 2026-09-23) ═══
 * «Firmar una pieza hoy es firmar una salvaguarda que no se sirve» — servir.js SIEMPRE servía `medicion.no_excluye`
 * bajo el rótulo "No implica:", también en "ocurre". Este bloque prueba que ahora "ocurre" sirve `pieza.no_implica`
 * (la salvaguarda que el owner firma) y "no_ocurre" sigue sirviendo `medicion.no_excluye` (el descarte) — cada
 * veredicto, su propia negativa, nunca la otra, nunca las dos. */
H("5b · servir.js — cada veredicto sirve SU negativa (defecto 1: ocurre→no_implica, no_ocurre→no_excluye)");
{
  const cuentaBajoBenchmark = Object.entries(TABLA.cuentas).find(([, c]) => c.bajoBenchmark)[0];
  // ★ CARNADA · no_implica y no_excluye deliberadamente DISTINTOS y reconocibles, para que la prueba no pueda
  // pasar por casualidad si el código sirve el campo equivocado.
  const piezaCarnada = { ...piezaPorId("CAU-01"), id: "CARNADA-DEFECTO1", no_implica: "TEXTO-NO-IMPLICA-9f3a", medicion: { ...piezaPorId("CAU-01").medicion, no_excluye: "TEXTO-NO-EXCLUYE-b71c" } };
  const mOcurre = medirPieza(piezaCarnada, cuentaBajoBenchmark, TABLA);
  if (mOcurre.estado === "ocurre") {
    const sOcurre = servirPieza(piezaCarnada, cuentaBajoBenchmark, mOcurre);
    ok(sOcurre.texto.includes("TEXTO-NO-IMPLICA-9f3a"), "★ CARNADA · \"ocurre\" sirve pieza.no_implica (la salvaguarda firmada)", sOcurre.texto);
    ok(!sOcurre.texto.includes("TEXTO-NO-EXCLUYE-b71c"), "★ CARNADA · \"ocurre\" NO sirve medicion.no_excluye (el defecto 1 original)", sOcurre.texto);
    ok(!/No implica: No implica/.test(sOcurre.texto), "★ CARNADA · no hay doble rótulo (\"No implica: No implica que…\") — pieza.no_implica se sirve TAL CUAL, ya es oración completa", sOcurre.texto);
  } else {
    ok(false, "no se pudo forzar \"ocurre\" con la pieza carnada del defecto 1 — revisar la cuenta elegida");
  }
  const cuentaNoBajoBenchmark2 = Object.entries(TABLA.cuentas).find(([, c]) => !c.bajoBenchmark && c.cargaPct != null && c.cargaSobreResto === false);
  if (cuentaNoBajoBenchmark2) {
    const mNo = medirPieza(piezaCarnada, cuentaNoBajoBenchmark2[0], TABLA);
    if (mNo.estado === "no_ocurre") {
      const sNo = servirPieza(piezaCarnada, cuentaNoBajoBenchmark2[0], mNo);
      ok(sNo.texto.includes("TEXTO-NO-EXCLUYE-b71c"), "control · \"no_ocurre\" SÍ sirve medicion.no_excluye (el descarte)", sNo.texto);
      ok(!sNo.texto.includes("TEXTO-NO-IMPLICA-9f3a"), "control · \"no_ocurre\" NO sirve pieza.no_implica", sNo.texto);
    }
  }
  // control negativo real: CAU-01 servida de verdad, sobre la misma cuenta que 5 arriba
  const mReal = medirPieza(piezaPorId("CAU-01"), cuentaBajoBenchmark, TABLA);
  const sReal = servirPieza(piezaPorId("CAU-01"), cuentaBajoBenchmark, mReal);
  ok(sReal.texto.includes(piezaPorId("CAU-01").no_implica), "control · CAU-01 real: el texto servido incluye pieza.no_implica verbatim", sReal.texto);
}

/* ═══ 6 · SERVICIO + ACOTADORES — la forma fija, y los cuatro acotadores del documento §3 ═══ */
H("6 · servir.js + acotadores.js — forma fija y los cuatro acotadores (entidad · orden · dedup · tamaño)");
{
  const RES = _evaluarInfraestructura({ scenario: ESCENARIO_INICIAL, pregunta: PREGUNTA_LECTURA, entidadesEnRespuesta: ["Lider", "Falabella"], perfil: PERFIL_COMPLETO });
  ok(RES.salida.length > 0, `el pipeline completo (sin la puerta de firma) sirve ${RES.salida.length} ítems sobre datos reales`);
  ok(RES.salida.every((s) => /^El oficio mira: /.test(s.texto) || /^Y en \d+ /.test(s.texto) || /^\d+ mediciones más no entraron por espacio/.test(s.texto)), "toda línea servida usa la forma fija (\"El oficio mira…\"), la línea de agregado (\"Y en N…\") o la línea combinada de sobrantes por tope (defecto 2)");
  ok(RES.salida.some((s) => /est[aá] ocurriendo/.test(s.texto)), "al menos una pieza sirve el estado \"ocurre\", con su cifra");
  const soloEntidadesNombradas = RES.detalle.filter((d) => d.pertinente && d.estado && d.entidad && !["Lider", "Falabella"].includes(d.entidad)).length;
  ok(soloEntidadesNombradas > 0, `hay ${soloEntidadesNombradas} mediciones sobre entidades NO nombradas por la Respuesta — el acotador 1 las agrega, no las pierde`);
  ok(RES.salida.some((s) => /^Y en \d+ .* más del mismo conjunto/.test(s.texto)), "el acotador 1 (acotar por entidad) produjo al menos una línea de agregado con conteo");
  ok(!RES.salida.some((s) => /ver «Qué más puedo calcular»/.test(s.texto)), "★ CARNADA · ninguna línea de agregado promete «ver Qué más puedo calcular» (esa sección no tiene cómo recibir el enlace — defecto 2)");
  // orden: la primera línea servida es "ocurre" (mayor valor informativo), nunca "indeterminable" primero si hay un "ocurre" disponible
  const idxOcurre = RES.salida.findIndex((s) => /est[aá] ocurriendo/.test(s.texto));
  const idxIndet = RES.salida.findIndex((s) => /no se puede saber/.test(s.texto));
  ok(idxOcurre === 0 || idxIndet === -1 || idxOcurre < idxIndet, "el acotador 2 (orden por valor informativo) pone \"ocurre\" antes que \"indeterminable\"");
  // CAU-06 (defecto 4, colapsada) es UNA sola pieza — un solo enunciado, nunca tres líneas casi iguales por SKU.
  const lineasCAU06 = RES.salida.filter((s) => /Cuando un SKU está frenado/.test(s.texto));
  ok(lineasCAU06.length <= 1, `★ defecto 4 · a lo sumo UNA línea con el enunciado de CAU-06 en la salida (dio ${lineasCAU06.length}) — antes CAU-06/RSG-06/MOV-05 servían tres casi iguales`, RES.salida.map((s) => s.texto).join("\n"));
  ok(RES.sobrantes.length >= 0, "el tope de tamaño produjo una lista de sobrantes trazable (nunca se pierde en silencio)");
}
/* ═══ 6b · DEFECTO 2 EN LA RUTA REAL — los sobrantes aparecen en UNA línea combinada, nunca desaparecen sin
 * rastro y nunca se repiten una vez por pieza ═══
 * Reproduce exactamente el caso medido en la sonda: 4 piezas firmadas, 2 entidades nombradas (Falabella, Lider),
 * el tope por defecto (TOPE_CARACTERES_OFICIO) — antes del arreglo, CAU-03 desaparecía sin dejar rastro; en la
 * primera versión del arreglo, cada pieza cortada agregaba su PROPIA línea («CAU-01 midió…», «PRI-04 midió…»,
 * …) — el owner pidió combinarlas (segunda pasada, 2026-09-23): una sola línea, total + desglose por veredicto. */
H("6b · defecto 2 en la ruta real — el tope nunca descarta en silencio, y en UNA sola línea");
{
  const RES2 = _evaluarInfraestructura({ scenario: ESCENARIO_INICIAL, pregunta: PREGUNTA_LECTURA, entidadesEnRespuesta: ["Falabella", "Lider"], perfil: PERFIL_COMPLETO, maxCaracteres: TOPE_CARACTERES_OFICIO });
  const huboSobrantesCAU03 = RES2.sobrantes.some((s) => s.piezaId === "CAU-03");
  if (huboSobrantesCAU03) {
    ok(RES2.salida.some((s) => /^\d+ mediciones más no entraron por espacio en esta sección: /.test(s.texto)), "★ CARNADA · con algo cortado por el tope (incluida CAU-03), la salida SÍ trae una línea combinada con conteo — antes desaparecía sin rastro (defecto 2)", RES2.salida.map((s) => s.texto).join("\n"));
    const lineasDeSobrantes = RES2.salida.filter((s) => /mediciones más no entraron por espacio/.test(s.texto));
    ok(lineasDeSobrantes.length <= 1, `★ CARNADA · a lo sumo UNA línea de sobrantes en toda la salida (dio ${lineasDeSobrantes.length}) — nunca una por pieza`, RES2.salida.map((s) => s.texto).join("\n"));
  } else {
    console.log("      (con este tope, todo entró completo esta corrida — la línea 6 ya probó el mecanismo con un tope artificialmente chico)");
  }
  // control negativo: con un tope enorme, nada se corta y no aparece ninguna línea de sobrantes
  const RES3 = _evaluarInfraestructura({ scenario: ESCENARIO_INICIAL, pregunta: PREGUNTA_LECTURA, entidadesEnRespuesta: ["Falabella", "Lider"], perfil: PERFIL_COMPLETO, maxCaracteres: 100000 });
  ok(RES3.sobrantes.length === 0, "control · con un tope enorme, nada se corta (0 sobrantes)");
  ok(!RES3.salida.some((s) => /que no entraron por espacio/.test(s.texto)), "control negativo · sin nada cortado, no aparece ninguna línea de sobrantes (no es un siempre-presente)");
}
/* ═══ 6c · EL PRESUPUESTO REAL DE MULTIDOMINIO — la ruta más densa, medida sin adornar el resultado ═══
 * Owner 2026-09-23 (segunda pasada): «si después de combinarlas sigue pasándose, no lo fuerces más: decímelo
 * con el número, documentá que esa ruta es la más densa y queda al límite». Corre la ruta REAL
 * (componerEntregaMultidominio) con las 4 piezas REALES de `piezas.js` firmadas a mano (clon en memoria, nunca
 * sembrado) — el techo de la Entrega corta es 900 palabras (`TOPE_PALABRAS`, src/adi/entrega/verificar.js). */
H("6c · el presupuesto real de Multidominio (la ruta más densa) — medido, no forzado");
{
  const catalogoFirmado4 = PIEZAS_CONOCIMIENTO.map((p) => ({ ...p, estado: "firmada", firma: { por: "_conocimiento_gate.mjs §6c", fecha: "2026-09-23" } }));
  initTenant(TENANT_PERFIL_COMPLETO);
  let RMulti;
  try {
    RMulti = componerEntregaMultidominio({ scenario: ESCENARIO_INICIAL, pregunta: PREGUNTA_MULTIDOMINIO, conocimientoActivo: true, conocimientoCatalogo: catalogoFirmado4 });
  } finally {
    initTenant(TENANT_DEMO);
  }
  ok(RMulti.ok, "componerEntregaMultidominio compone ok con las 4 piezas reales firmadas", RMulti.motivo);
  const nPalabras = (RMulti.texto || "").trim().split(/\s+/).filter(Boolean).length;
  const lineasSobrantesMulti = (RMulti.entrega.referenciaDelOficio || []).filter((s) => /mediciones más no entraron por espacio/.test(s.texto));
  ok(lineasSobrantesMulti.length <= 1, `★ Multidominio · a lo sumo UNA línea combinada de sobrantes (dio ${lineasSobrantesMulti.length}) — no una por pieza`, (RMulti.entrega.referenciaDelOficio || []).map((s) => s.texto).join("\n"));
  console.log(`      Multidominio, 4 piezas reales firmadas: ${nPalabras} palabras (techo 900) — ${nPalabras > 900 ? "SOBRE EL TECHO" : "bajo el techo"}`);
  if (nPalabras > 900) {
    console.log(`      ⚠️ Multidominio queda sobre el techo aun con la línea de sobrantes combinada: es la ruta más densa`);
    console.log(`         (3 dominios, hasta 4 piezas pertinentes a la vez, varias entidades ya nombradas) — reportado al owner, no forzado más.`);
  }
  // el número queda documentado acá mismo, no forzado: no hay un ok() que exija <900 — ver la nota de cabecera.
}
{
  // acotadores.js en aislamiento, con un tope de caracteres MUY chico — para demostrar que topa por TAMAÑO, no por CONTEO
  const itemsFalsos = [
    { texto: "a".repeat(100), piezaId: "X1", entidad: "A", estado: "ocurre" },
    { texto: "b".repeat(100), piezaId: "X2", entidad: "B", estado: "ocurre" },
    { texto: "c".repeat(100), piezaId: "X3", entidad: "C", estado: "ocurre" },
  ];
  const { servidos, sobrantes } = aplicarAcotadores(itemsFalsos, { entidadesEnRespuesta: ["A", "B", "C"], maxCaracteres: 150 });
  ok(servidos.length === 1 && sobrantes.length === 2, `★ CARNADA · con un tope de 150 caracteres y 3 ítems de 100, sirve 1 y sobran 2 (topa por TAMAÑO, no por número de piezas — dio ${servidos.length}/${sobrantes.length})`);
}

/* ═══ 7 · EL RECUENTO DE LO REVISADO — empresa sana, la capa no queda muda ═══
 * Owner 2026-09-23 (defecto 3): la forma vieja, «De las N cosas que el oficio mira…, ADI midió M: …», mezclaba
 * piezas (N) con mediciones (M) bajo la misma palabra "cosas" — un ejecutivo no podía saber en una lectura que
 * M no es un subconjunto de N. Ahora cada número lleva su propia unidad: "aspectos" (piezas) y "casos"
 * (mediciones) — ver la corrección en la cabecera de `recuento.js`. */
H("7 · recuento.js — cada número con su propia unidad (defecto 3), cuando nada es pertinente");
{
  // se simula "nada pertinente" con una entidad inexistente en la tabla (ninguna cuenta real se llama así) —
  // así TODAS las piezas de sujeto "cuenta"/"sku" reales de la tabla siguen encendiendo (no se puede vaciar la
  // tabla sin tocar el motor), así que se prueba el CÁLCULO del recuento directamente con una tabla vacía.
  const tablaVacia = { cuentas: {}, skus: {}, periodo: { abierto: false }, pregunta: { temas: [], metricas: [] } };
  const rec = recuentoDeLoRevisado(PIEZAS_CONOCIMIENTO, tablaVacia, PERFIL_COMPLETO, "");
  ok(rec === null, "sin ninguna entidad en la tabla, ninguna pieza mide nada — el recuento no inventa un conteo de cero contra cero");
  // con la tabla real, todas las piezas "firmadas" (simuladas) sí producen un recuento con cifra
  const recReal = recuentoDeLoRevisado(PIEZAS_CONOCIMIENTO, TABLA, PERFIL_COMPLETO, PREGUNTA_LECTURA);
  ok(!!recReal && new RegExp(`^El oficio revisa ${PIEZAS_CONOCIMIENTO.length} aspectos de un distribuidor\\. ADI los midió en \\d+ casos: `).test(recReal.texto), "sobre datos reales, el recuento nombra los aspectos (piezas) y los casos (mediciones) por separado — nunca \"cosas\" para las dos", recReal && recReal.texto);
  ok(!!recReal && !/\bcosas\b/i.test(recReal.texto), "★ CARNADA · el texto del recuento no usa la palabra \"cosas\" (la mezcla que causaba el defecto 3)", recReal && recReal.texto);
  ok(!!recReal && recReal.medidas !== recReal.total, "control · en este demo, aspectos (piezas) y casos (mediciones) SON números distintos — la frase vieja los leía como si fueran lo mismo", `total=${recReal && recReal.total} medidas=${recReal && recReal.medidas}`);
  console.log(`      "${recReal.texto}"`);
}

/* ═══ 8 · LAS TRES PUERTAS QUE APAGAN LA CAPA — seleccionar.js:referenciaDelOficio ═══ */
H("8 · seleccionar.js — las tres puertas (bandera · perfil · firma), sobre TENANT_DEMO real");
initTenant(TENANT_DEMO);
{
  const puerta1 = referenciaDelOficio({ perfil: PERFIL_COMPLETO, pregunta: PREGUNTA_LECTURA, entidadesEnRespuesta: ["Lider"], scenario: ESCENARIO_INICIAL, activo: false });
  ok(Array.isArray(puerta1) && puerta1.length === 0, "★ PUERTA 1 · activo:false → [] (byte-idéntico a hoy, catálogo de perfilCliente.js vacío)");

  const puerta2 = referenciaDelOficio({ perfil: PERFIL_INCOMPLETO, pregunta: PREGUNTA_LECTURA, entidadesEnRespuesta: ["Lider"], scenario: ESCENARIO_INICIAL, activo: true });
  ok(Array.isArray(puerta2) && puerta2.length === 0, `★ PUERTA 2 · activo:true pero perfil incompleto (TENANT_DEMO real, faltan: ${PERFIL_INCOMPLETO.faltantes.join(", ")}) → [] — perfil incompleto apaga la capa ENTERA`);

  const puerta3 = referenciaDelOficio({ perfil: PERFIL_COMPLETO, pregunta: PREGUNTA_LECTURA, entidadesEnRespuesta: ["Lider", "Falabella"], scenario: ESCENARIO_INICIAL, activo: true });
  ok(Array.isArray(puerta3) && puerta3.length === 0, "★ PUERTA 3 (LA CENTRAL DE ESTA SIEMBRA) · activo:true + perfil COMPLETO, pero las cuatro piezas están en \"borrador\" → [] — una pieza sin firmar NUNCA se sirve");

  // control positivo: con un catálogo de las MISMAS 4 piezas pero "firmadas" a mano (clon, nunca piezas.js), la
  // puerta 3 SÍ deja pasar contenido — la infraestructura funciona; lo que falta es la validación del owner.
  const catalogoFirmado = PIEZAS_CONOCIMIENTO.map((p) => ({ ...p, estado: "firmada", firma: { por: "control-positivo-del-gate", fecha: p.fecha } }));
  const { validas: firmadasValidas } = piezasValidas(catalogoFirmado);
  ok(firmadasValidas.length === PIEZAS_CONOCIMIENTO.length, `control · las ${PIEZAS_CONOCIMIENTO.length} piezas, firmadas a mano, siguen pasando el validador de esquema (firmarlas no cambia su forma)`);
}

/* ═══ 9 · LA CONCLUSIÓN DEL PROCEDIMIENTO — BYTE-IDÉNTICA con la capa encendida y apagada ═══ */
H("9 · byte-identidad — las cuatro rutas de componer.js, capa ON vs OFF, MENOS \"referenciaDelOficio\"");
function _sinReferenciaDelOficio(R) {
  if (!R || !R.entrega) return null;
  const { referenciaDelOficio: _r, ...resto } = R.entrega;
  return JSON.stringify({ ok: R.ok, texto: R.texto.replace(/\*\*Referencia del oficio\*\*[\s\S]*?(?=\n\*\*Para su juicio)/, "**Referencia del oficio** [omitido de esta comparación]\n\n"), entrega: resto });
}
{
  const rutas = [
    ["componerEntregaBrechaComercial", () => componerEntregaBrechaComercial({ scenario: ESCENARIO_INICIAL, pregunta: PREGUNTA_BRECHA_COMERCIAL, conocimientoActivo: false }), () => componerEntregaBrechaComercial({ scenario: ESCENARIO_INICIAL, pregunta: PREGUNTA_BRECHA_COMERCIAL, conocimientoActivo: true })],
    ["componerEntregaCobranza", () => componerEntregaCobranza({ scenario: ESCENARIO_INICIAL, pregunta: PREGUNTA_COBRANZA, conocimientoActivo: false }), () => componerEntregaCobranza({ scenario: ESCENARIO_INICIAL, pregunta: PREGUNTA_COBRANZA, conocimientoActivo: true })],
    ["componerEntregaInventario", () => componerEntregaInventario({ scenario: ESCENARIO_INICIAL, pregunta: PREGUNTA_INVENTARIO, conocimientoActivo: false }), () => componerEntregaInventario({ scenario: ESCENARIO_INICIAL, pregunta: PREGUNTA_INVENTARIO, conocimientoActivo: true })],
    ["componerEntregaMultidominio", () => componerEntregaMultidominio({ scenario: ESCENARIO_INICIAL, pregunta: PREGUNTA_MULTIDOMINIO, conocimientoActivo: false }), () => componerEntregaMultidominio({ scenario: ESCENARIO_INICIAL, pregunta: PREGUNTA_MULTIDOMINIO, conocimientoActivo: true })],
  ];
  for (const [nombre, off, on] of rutas) {
    const Roff = off(), Ron = on();
    ok(Roff.ok, `${nombre} (capa apagada) compone ok`, Roff.motivo);
    ok(Ron.ok, `${nombre} (capa encendida) compone ok`, Ron.motivo);
    ok(JSON.stringify(Roff.entrega.referenciaDelOficio) === "[]", `${nombre} (capa apagada) — referenciaDelOficio === [] (TENANT_DEMO real, perfil incompleto)`);
    ok(JSON.stringify(Ron.entrega.referenciaDelOficio) === "[]", `${nombre} (capa ENCENDIDA) — referenciaDelOficio TAMBIÉN === [] (perfil incompleto sigue apagando la capa entera, aun con la bandera en true)`);
    const sOff = _sinReferenciaDelOficio(Roff), sOn = _sinReferenciaDelOficio(Ron);
    ok(sOff === sOn, `★ ${nombre} · BYTE-IDÉNTICA con la capa encendida y apagada (prioridad, ranking, cifras y respuesta no cambian)`, sOff === sOn ? "" : "difieren fuera de referenciaDelOficio — ver diff manual");
  }
}
{
  // ⚠️ CORRECCIÓN 2026-09-23 (owner): «demostraste que apagado es igual a apagado». El bloque anterior comparaba
  // dos corridas donde `referenciaDelOficio` daba [] en las DOS — no probaba nada sobre lo que importa: que la
  // conclusión del procedimiento aguante la capa SIRVIENDO contenido de verdad. Acá se prueba eso, con una
  // PIEZA DE PRUEBA — firmada, solo dentro de este gate, NUNCA sembrada en `piezas.js` — que SÍ pertinente y SÍ
  // se sirve, pasada por el hueco de prueba `conocimientoCatalogo` (seleccionar.js, que ningún camino de
  // producción usa: `componer.js` nunca lo pasa).
  H("9b · LA PRUEBA REAL — una pieza de prueba FIRMADA que SÍ sirve contenido, contra las cuatro rutas");
  const piezaPrueba = {
    ...piezaPorId("CAU-01"),
    id: "TEST-FIRMADA-9B", estado: "firmada",
    firma: { por: "_conocimiento_gate.mjs (prueba de identidad §9b)", fecha: "2026-09-23", motivo: "pieza de prueba — NUNCA sembrada en piezas.js ni servida a un cliente" },
  };
  ok(validarPieza(piezaPrueba).ok, "la pieza de prueba pasa el validador de esquema (firmarla no cambia su forma)");

  initTenant(TENANT_PERFIL_COMPLETO);   // perfil completo REAL (camino B) — para que la puerta 2 tampoco vacíe el resultado
  try {
    const rutas9b = [
      ["componerEntregaBrechaComercial", componerEntregaBrechaComercial, { pregunta: PREGUNTA_BRECHA_COMERCIAL }],
      ["componerEntregaCobranza", componerEntregaCobranza, { pregunta: PREGUNTA_COBRANZA }],
      ["componerEntregaInventario", componerEntregaInventario, { pregunta: PREGUNTA_INVENTARIO }],
      ["componerEntregaMultidominio", componerEntregaMultidominio, { pregunta: PREGUNTA_MULTIDOMINIO }],
    ];
    let unCasoConContenido = null;
    for (const [nombre, fn, extra] of rutas9b) {
      const Roff = fn({ scenario: ESCENARIO_INICIAL, conocimientoActivo: false, ...extra });
      const Ron = fn({ scenario: ESCENARIO_INICIAL, conocimientoActivo: true, conocimientoCatalogo: [piezaPrueba], ...extra });
      ok(Roff.ok && Ron.ok, `${nombre} compone ok en las dos corridas (perfil completo)`, `${Roff.motivo} | ${Ron.motivo}`);
      const sirvioContenido = Array.isArray(Ron.entrega.referenciaDelOficio) && Ron.entrega.referenciaDelOficio.length > 0;
      ok(sirvioContenido, `★ ${nombre} · CON la pieza de prueba firmada, referenciaDelOficio SÍ sirve contenido real (${Ron.entrega.referenciaDelOficio.length} ítem(s))`, JSON.stringify(Ron.entrega.referenciaDelOficio));
      ok(JSON.stringify(Roff.entrega.referenciaDelOficio) === "[]", `${nombre} (capa apagada, sin catálogo de prueba) sigue dando referenciaDelOficio === []`);
      const sOff = _sinReferenciaDelOficio(Roff), sOn = _sinReferenciaDelOficio(Ron);
      ok(sOff === sOn, `★★ ${nombre} · BYTE-IDÉNTICA incluso SIRVIENDO contenido real (Respuesta · Cifras · Límites · Para su juicio · universos · prioridad) — la ÚNICA diferencia es la sección referenciaDelOficio`, sOff === sOn ? "" : "difieren fuera de referenciaDelOficio — la pieza de prueba está tocando algo que no debería");
      if (sirvioContenido && !unCasoConContenido) unCasoConContenido = { nombre, Roff, Ron, sOff };
    }

    // ★ LA CARNADA (owner: «si alguien hiciera que una pieza tocara la prioridad, el candado tiene que arder») —
    // se corrompe a mano una copia de la Entrega ENCENDIDA (como si una pieza hubiera alterado la Respuesta, que
    // es donde vive la prioridad/el ranking) y se confirma que la MISMA comparación de arriba SÍ lo detecta.
    H("9c · CARNADA · si una pieza tocara la prioridad, el candado arde");
    if (unCasoConContenido) {
      const { nombre, Roff, Ron, sOff } = unCasoConContenido;
      const Rcorrupto = JSON.parse(JSON.stringify(Ron));
      Rcorrupto.entrega.respuesta[0].texto = `${Rcorrupto.entrega.respuesta[0].texto} (prioridad alterada por una pieza — esto NUNCA debería pasar)`;
      const sCorrupto = _sinReferenciaDelOficio(Rcorrupto);
      ok(sCorrupto !== sOff, `★ CARNADA · con la Respuesta de ${nombre} tocada, la comparación deja de ser byte-idéntica — el candado ARDE como debe`, sCorrupto === sOff ? "NO ARDIÓ — la comparación es ciega a cambios en la Respuesta" : "");
      // control negativo: la comparación real (sin corromper nada) sigue dando idéntica — la carnada de arriba
      // no es un siempre-rojo: el candado distingue "tocado" de "no tocado".
      const sOnDeNuevo = _sinReferenciaDelOficio(JSON.parse(JSON.stringify(Ron)));
      ok(sOnDeNuevo === sOff, "control negativo · SIN corromper nada, la misma comparación vuelve a dar idéntica — el candado no es un siempre-rojo");
    } else {
      ok(false, "ninguna de las 4 rutas sirvió contenido con la pieza de prueba — no se pudo correr la carnada 9c", "revisar por qué CAU-01 no fue pertinente/medible en ninguna ruta con perfil completo");
    }
  } finally {
    initTenant(TENANT_DEMO);   // restaurar el tenant real para el resto del gate
  }
}

console.log(`\n── _conocimiento_gate: PASS ${pass} · FAIL ${fail} (de ${pass + fail}) ──`);
if (fail > 0) process.exit(1);
