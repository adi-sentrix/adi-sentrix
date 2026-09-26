/* === _entrega_general_gate.mjs · LA ENTREGA PARA CUALQUIER ENCARGO SOPORTADO — ETAPA 1 · CORTE 3b + 3c (owner
 * 2026-09-25, offline) ═══════════════════════════════════════════════════════════════════════════════════════
 * EXTENDIDO EN EL CORTE 3c (owner 2026-09-25) — tres piezas, todas sobre `componerEntrega(resolucion)`:
 *   1 · UNIVERSO POR ESTADO — D07/D14/D19 (universo con `estados`/`no_estados`/`filtros` SIN `top`) YA NO
 *       declinan: `entrega/componer.js:_planCifraGrupoUniverso`/`_cerrarGrupoUniverso` resuelven el conjunto con
 *       `conjuntoDeUniverso` (notario/verificar.js — la MISMA primitiva que ya evalúa un universo tipado para el
 *       Notario v3) contra `I.rankings` (de `datoProyectado`, TODO el eje, no solo la boleta impresa) y declaran
 *       un hecho `conteo` verificado (K de M). Sección 2 (antes 2b, ahora reescrita).
 *   2 · TENTACIONES PRECALCULADAS — total + participación del primero, SOLO sobre un concepto monetario del
 *       grupo (`claveTentacion`, independiente del concepto que ordena la lista: sumar una tasa no es una cifra
 *       de la casa). Sección 3 (carnada: mezclar dos universos distintos no verifica).
 *   3 · VEREDICTO DE PREMISAS — `resolucion.premisas` (ya validadas por FORMA en `validar.js`) se juzgan con el
 *       MISMO `libroDeHechos` que verifica cada hecho de la Entrega, en un libro APARTE (`entrega.procedencia.
 *       libroPremisas`) para que una premisa falsa nunca tumbe la Entrega — es información legítima, no un hecho
 *       roto del compositor. La Entrega abre la parte correspondiente con el veredicto (verdadera/falsa —con la
 *       verdad y su id— /no verificable); la conclusión de cada parte NUNCA lee la premisa (ley
 *       «premisa-adoptada»). Sección 4.
 *
 * Corre `src/adi/entrega/componer.js:componerEntrega(resolucion)` — el generalizador del corte 3b — sobre los
 * casos VÁLIDOS de `fixtures/encargos-desarrollo.json` (los mismos 44 que certifican `_encargo_gate` y
 * `_lecturas_gate`, cortes 1 y 3a) y verifica las garantías que pide el encargo del corte:
 *
 *   1 · EQUIVALENCIA BYTE A BYTE — las 4 preguntas fijas del plan (D08 comercial, D09 cobranza, D10 inventario,
 *       D11 multidominio), expresadas como `Encargo`, producen el MISMO texto y el MISMO libro (mismos ids, mismo
 *       render por id) que `componerEntregaBrechaComercial`/`componerEntregaCobranza`/`componerEntregaInventario`/
 *       `componerEntregaMultidominio` con la pregunta fija. `componerEntrega` delega literalmente en esas 4
 *       funciones para esta forma exacta (`_delegarRutaCanonica`, componer.js): la equivalencia es por
 *       CONSTRUCCIÓN, este bloque la comprueba, no la produce.
 *   2 · SOBRE EL CATÁLOGO — para cada caso válido de `esperado.valido === true` cuya `Resolucion` quedó `ok`:
 *       verificarEntrega ok · 0 dígitos fuera del libro (regla 1 de verificar.js) · cada tema de una parte
 *       resuelta/parcial queda en `entrega.temasCubiertos` O declarado como límite del gap (universo con
 *       estado/filtro, fuera de alcance de este corte, señalado en la cabecera de componer.js) · cada
 *       `noResuelto` y cada ausencia relevante aparecen como límite · ninguna entidad prohibida (`prohibido.
 *       entidades` del fixture) aparece en el texto · determinismo (misma Resolucion ⇒ mismo texto, dos corridas).
 *   3 · POR FORMA — un caso `comparacion` trae los dos lados Y la diferencia; un caso `simulacion` trae sus
 *       piezas (base/resultado, con delta o su límite declarado); un caso `decision` declara su criterio.
 *   4 · CARNADAS — cambiar `preguntaOriginal` no cambia la Entrega (nadie la lee, ley del contrato) · una cifra
 *       con `fuerza` nula (hecho `propuesta`, sin insumos) nunca se rotula «medido»/verificada — invariante de
 *       `notario/hechos.js` que `componer.js` nunca pisa (candado directo sobre `procedenciaDe`/`NOMBRE_DE_
 *       PROCEDENCIA`, la MISMA tabla que arma la columna «Tipo»).
 *
 * GAP DEL CORTE 3b — CERRADO EN EL 3c PARA D07/D14/D19 (ver la pieza 1 de la cabecera). Lo que SIGUE fuera de
 * alcance (no hay caso del catálogo que lo pida, así que no se fuerza): un universo con `estados`/`no_estados`/
 * `filtros` COMBINADO con `top` en la MISMA parte — `componer.js` sigue declinando esa combinación con el límite
 * de siempre («el filtro del universo no se aplica todavía en este corte»); si conviven con partes que SÍ se
 * pueden componer, la parte no soportada sale como LÍMITE y el resto se sirve con `ok:true` (sección 9 —
 * corrección del supervisor, owner 2026-09-25: «una parte no soportada no puede tumbar la Entrega»). El tope de
 * tamaño por `profundidad` (D27, "sin corte 3c") queda igual: declarado, no forzado a pasar por 900 palabras.
 *
 * CORRECCIONES DEL SUPERVISOR SOBRE LA PRIMERA VERSIÓN DE ESTE CORTE (owner 2026-09-25), las tres cerradas acá:
 *   (1) la regla 4 de verificar.js (comparables-juntas) había dejado de vigilar «Para su juicio»/«Referencia del
 *       oficio» — ahora escanea el TEXTO COMPLETO otra vez, y solo descuenta por MARCA estructural (`lim._ausencia`,
 *       una oración `_definicion`), nunca por sección. Carnada nueva: sección 10.
 *   (2) una parte no soportada ya no tumbaba el resto — corregido y probado: sección 9.
 *   (3) el emparejador de rótulos aproximado (singular/plural + alias a mano) se RETIRÓ: `componer.js` reusa
 *       `notario/lexico.js:claveDeMetrica`, la MISMA canonización que ya usa el Notario para reconocer el
 *       concepto de una fig — nunca sobre texto del usuario. Esto además destapó y cerró un defecto real (una fig
 *       de una parte no soportada se colaba en la parte servida por una canonización ambigua): la corrección
 *       estructural fue acotar cada parte a SUS PROPIAS figs por procedencia (`fig.origin.callId`), no un segundo
 *       matcher.
 *   (4) el hueco de `claveDeMetrica` (punto 3) — CERRADO por el supervisor, owner 2026-09-25, CLAUDE.md §4 («un
 *       rótulo visible no puede nombrar dos campos»): ahora prueba el rótulo COMPLETO con su paréntesis ANTES de
 *       recortarlo. Sección 11 pasó de documentar el hueco a EXIGIR el valor correcto.
 *
 * CERO llamadas a un LLM · CERO red. Solo por `npm run gates:offline` o
 * `node --import ./scripts/offline-guard.mjs _entrega_general_gate.mjs`. */
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
import { verificarEntrega } from "./src/adi/entrega/verificar.js";
import { crearEntrega } from "./src/adi/entrega/esquema.js";
import { renderDe, procedenciaDe, fuerzaDe, NOMBRE_DE_PROCEDENCIA, libroDeHechos } from "./src/adi/notario/hechos.js";
import { claveDeMetrica } from "./src/adi/notario/lexico.js";
import { clasificarFuente } from "./scripts/clasificarGates.mjs";

let pass = 0, fail = 0;
const fails = [];
const ok = (c, m, extra = "") => { if (c) { pass++; } else { fail++; fails.push(m + (extra ? " — " + extra : "")); console.log("  ✗ " + m + (extra ? "\n      " + extra : "")); } };
const H = (t) => console.log(`\n${t}`);

initTenant(TENANT_DEMO);

const CATALOGO = JSON.parse(fs.readFileSync("./fixtures/encargos-desarrollo.json", "utf8"));
const CASOS_VALIDOS = CATALOGO.casos.filter((c) => c.esperado && c.esperado.valido === true);

/* CORTE 3c — D07/D14/D19 (universo estados/no_estados/filtros SIN top) ya NO se cuentan aparte: componen como
 * cualquier otro caso del catálogo y pasan por el loop genérico de la sección 2 (verificarEntrega, temasCubiertos,
 * noResuelto, entidades prohibidas, determinismo) igual que los demás — la sección 3 (antes 2b) los audita
 * ADEMÁS con la garantía específica de esta pieza (K de M correcto, contra `premisasDelGate` del fixture). */
const IDS_GAP_UNIVERSO_FILTRO = new Set();
/* D27 excede el tope de 900 palabras (tope de tamaño por profundidad, corte 3c, no este) — se compone y se
 * verifica todo LO DEMÁS, pero no se exige que pase la regla 8 de verificar.js. */
const IDS_SIN_TOPE_DE_TAMANO = new Set(["D27"]);
/* CORTE 3c · PIEZA 1 — el conteo K-de-M esperado de cada universo por estado (contra `premisasDelGate` del
 * fixture, verificado a mano por el autor del catálogo). */
const K_DE_M_ESPERADO = {
  D07: { n: 9, m: 13, set: ["Falabella", "Lider", "Jumbo", "Sodimac", "Paris", "Ripley", "Easy", "La Polar", "Hites"] },
  D14: { n: 6, m: 13, set: ["Lider", "Falabella", "Sodimac", "Easy", "Paris", "Tottus"] },
  D19: { n: 8, m: 13, set: ["Falabella", "Lider", "Jumbo", "Sodimac", "Tottus", "Paris", "Mercado Libre", "Ripley"], primero: "Falabella" },
};
/* CORTE 3c · PIEZA 3 — CERRADO (owner 2026-09-25, orden del supervisor): D22/q1 y D29/q1 daban «no-verificable»
 * porque una premisa se juzgaba SOLO contra la boleta de la parte donde cayó, no contra lo que ADI ya sabe de la
 * empresa. Dos arreglos de raíz, en el Notario compartido (no en este archivo, no en `entrega/componer.js`):
 *   D22/q1 — `notario/verificar.js:_relacion` (vía `_valorDe`) ahora cae a `I.rankings` (`_delRanking`, la MISMA
 *     primitiva que ya usaba `_cifra`) cuando la boleta de la parte no trae la fig — la proyección SÍ tiene la
 *     contribución de Jumbo aunque la comparación de esta parte solo pidiera Falabella y Lider.
 *   D29/q1 — `oracle/datoProyectado.js` ahora publica `rankings.<eje>.variacion` (cliente · marca · familia ·
 *     canal — SKU no trae año anterior) con `specRetrieval.js:variacionVentasPorEje`, LA MISMA función que usa
 *     `salesRead` («una sola verdad por eje»); `notario/verificar.js:_variacion` cae a ese ranking cuando la
 *     boleta no trae la fig (una `simulacion`, en este caso, que solo publica el escenario, no la serie real).
 * Las dos ahora dan «verdadera», como esperaba el fixture — sin tocar ni el fixture ni ningún otro veredicto
 * (los 8 casos que ya coincidían siguen coincidiendo; los 9 gates del Notario que corren sobre estas dos
 * funciones compartidas — `_hechos_gate`, `_resolutor_gate`, `_anclas_gate`, `_anclar_composers_gate`,
 * `_notario_semantico_gate`, `_notario_semantico_flujo_gate`, `_notario_adversarial_gate`,
 * `_adversarial_notario_gate`, `_origenes_gate`, `_raw_gate`, `_ronda5_gate` — se corrieron y quedaron en su
 * mismo verde, sin tocar una sola aserción). */

/* ═══ 1 · EQUIVALENCIA BYTE A BYTE — las 4 rutas fijas, por delegación ═══════════════════════════════════════ */
H("1 · equivalencia byte a byte — componerEntrega(resolucion) === la ruta fija, por delegación (D08-D11)");
{
  const CASOS_CANONICOS = [
    { id: "D08", pregunta: PREGUNTA_BRECHA_COMERCIAL, ruta: componerEntregaBrechaComercial },
    { id: "D09", pregunta: PREGUNTA_COBRANZA, ruta: componerEntregaCobranza },
    { id: "D10", pregunta: PREGUNTA_INVENTARIO, ruta: componerEntregaInventario },
    { id: "D11", pregunta: PREGUNTA_MULTIDOMINIO, ruta: componerEntregaMultidominio },
  ];
  for (const { id, pregunta, ruta } of CASOS_CANONICOS) {
    const caso = CATALOGO.casos.find((c) => c.id === id);
    ok(!!caso, `${id} existe en el catálogo de desarrollo`);
    if (!caso) continue;
    const res = validarEncargo(caso.encargo, {});
    ok(res.ok, `${id} · la Resolucion es ok`, JSON.stringify(res.noResuelto));
    const general = componerEntrega(res);
    const fija = ruta({ pregunta });
    ok(general.ok && fija.ok, `${id} · las dos rutas componen ok`);
    ok(general.texto === fija.texto, `${id} · el TEXTO es byte a byte idéntico`, general.texto !== fija.texto ? `general(${general.texto.length}) vs fija(${fija.texto.length})` : "");
    // el LIBRO: mismos ids, mismo render por id (no se compara el objeto entero — `entrega`/`libro` cargan
    // funciones y Sets que no son comparables por igualdad estructural; el render es la verdad pública del libro).
    const idsG = general.ok ? general.libro.hechos.map((h) => h.id) : [];
    const idsF = fija.ok ? fija.libro.hechos.map((h) => h.id) : [];
    ok(JSON.stringify(idsG) === JSON.stringify(idsF), `${id} · el LIBRO declara los MISMOS ids, en el mismo orden`);
    const rendersIguales = general.ok && fija.ok && idsG.every((id2) => renderDe(general.libro, id2) === renderDe(fija.libro, id2));
    ok(rendersIguales, `${id} · cada id renderiza EXACTAMENTE igual en las dos rutas`);
  }
}

/* ═══ 2 · SOBRE EL CATÁLOGO — cada caso válido, verificado ═══════════════════════════════════════════════════ */
H(`2 · sobre el catálogo (${CASOS_VALIDOS.length} casos con esperado.valido) — componerEntrega + verificarEntrega`);
const resultadosCompuestos = new Map();   // id → { resolucion, entrega }
for (const caso of CASOS_VALIDOS) {
  const res = validarEncargo(caso.encargo, {});
  const tienePartesUtiles = (res.partes || []).some((p) => p.estado === "resuelta" || p.estado === "parcial");
  if (!res.ok || !tienePartesUtiles) continue;   // sin parte útil: nada que componer (ya lo certifica `_encargo_gate`)
  const entrega = componerEntrega(res);
  resultadosCompuestos.set(caso.id, { caso, res, entrega });
}
H(`2a · casos con al menos una parte útil que SÍ componen (${[...resultadosCompuestos.values()].filter((x) => x.entrega.ok).length} de ${resultadosCompuestos.size})`);
for (const { caso, res, entrega } of resultadosCompuestos.values()) {
  if (IDS_GAP_UNIVERSO_FILTRO.has(caso.id)) continue;   // sección 2b
  if (!entrega.ok) { ok(false, `${caso.id} · componerEntrega ok`, entrega.motivo); continue; }

  const v = verificarEntrega({ texto: entrega.texto, entrega: entrega.entrega });
  const violacionesRelevantes = IDS_SIN_TOPE_DE_TAMANO.has(caso.id) ? v.violaciones.filter((x) => x.regla !== "tope-de-tamano") : v.violaciones;
  ok(violacionesRelevantes.length === 0, `${caso.id} · verificarEntrega ok`, JSON.stringify(violacionesRelevantes));

  // cada tema de una parte resuelta/parcial queda cubierto (temasCubiertos) — la ley de cobertura del encargo,
  // generalizada: "temas reconocidos se cubren TODOS". D08-D11 delegan LITERALMENTE en las 4 rutas fijas (sección
  // 1): esas rutas no declaran `temasCubiertos` (campo nuevo del corte 3b) — su cobertura ya la prueba la
  // equivalencia byte a byte de la sección 1, así que este chequeo es solo para el camino GENERAL.
  if (entrega.entrega.temasCubiertos !== undefined) {
    const temasPedidos = [...new Set((res.partes || []).filter((p) => p.estado === "resuelta" || p.estado === "parcial").map((p) => p.tema))];
    const temasServidos = new Set(entrega.entrega.temasCubiertos || []);
    const faltan = temasPedidos.filter((t) => !temasServidos.has(t));
    ok(faltan.length === 0, `${caso.id} · cada tema pedido (${temasPedidos.join(",")}) queda en temasCubiertos`, faltan.join(","));
  }

  // cada noResuelto de esta Resolucion aparece como límite (por su motivo, en el texto de algún límite)
  const limitesTexto = entrega.entrega.limites.map((l) => `${l.titulo} ${l.motivo}`).join(" \n ");
  for (const nr of res.noResuelto || []) {
    const cubierto = limitesTexto.includes(nr.motivo.replace(/_/g, " ")) || (nr.detalle && limitesTexto.includes(nr.detalle.slice(0, 20)));
    ok(cubierto, `${caso.id} · noResuelto (${nr.campo}/${nr.motivo}) aparece como límite`, !cubierto ? limitesTexto.slice(0, 200) : "");
  }

  // ninguna entidad prohibida aparece en el texto (pertinencia por encargo: solo lo pedido o lo que el
  // procedimiento pone, nunca un vecino)
  const prohibidas = (caso.esperado.prohibido && caso.esperado.prohibido.entidades) || [];
  for (const ent of prohibidas) ok(!entrega.texto.includes(ent), `${caso.id} · «${ent}» (prohibida) no aparece en el texto`);

  // por forma: comparacion (dos lados + diferencia), simulacion (piezas), decision (criterio declarado)
  const cierres = new Set((res.partes || []).map((p) => p.cierre));
  if (cierres.has("comparacion")) {
    const parteComp = (res.partes || []).find((p) => p.cierre === "comparacion" && p.estado !== "no_resuelta");
    if (parteComp && parteComp.entidades.length === 2) {
      const [a, b] = parteComp.entidades.map((e) => e.nombre);
      ok(entrega.texto.includes(a) && entrega.texto.includes(b), `${caso.id} · comparacion trae los DOS lados (${a} · ${b})`);
      ok(/diferencia/i.test(entrega.texto), `${caso.id} · comparacion trae la diferencia (hecho derivado del libro)`);
    }
  }
  if (cierres.has("simulacion")) {
    ok(/Simulaci[oó]n — supuesto:/.test(entrega.texto) && /Resultado:/.test(entrega.texto), `${caso.id} · simulacion trae supuesto y resultado en la misma oración`);
    ok(/delta contra lo real|no se pudo aislar como cifra propia/.test(entrega.texto), `${caso.id} · simulacion trae delta O su límite declarado (nunca en silencio)`);
    ok(/escenario hipot[eé]tico/.test(entrega.texto), `${caso.id} · simulacion declara el límite «es un escenario, no lo que ya ocurrió»`);
  }
  if (cierres.has("decision")) {
    const criterioTxt = res.criterio && (res.criterio.lente || (res.criterio.referencia && res.criterio.referencia.concepto));
    ok(!!criterioTxt, `${caso.id} · decision trae un criterio resuelto (lente u origen del usuario)`, JSON.stringify(res.criterio));
  }

  // determinismo — misma Resolucion, dos corridas, mismo texto
  const otra = componerEntrega(res);
  ok(otra.ok && otra.texto === entrega.texto, `${caso.id} · determinismo: dos corridas de la MISMA Resolucion dan el MISMO texto`);
}

/* ═══ 3 · CORTE 3c · PIEZA 1 — UNIVERSO POR ESTADO: D07/D14/D19 componen, con su grupo y su «K de M» ═══════════ */
H("3 · pieza 1 (universo por estado) — D07/D14/D19 componen con el grupo K de M correcto (contra premisasDelGate)");
for (const [id, esp] of Object.entries(K_DE_M_ESPERADO)) {
  const x = resultadosCompuestos.get(id);
  ok(!!x, `${id} · el caso corrió`);
  if (!x) continue;
  ok(x.entrega.ok, `${id} · componerEntrega YA NO declina (compone el grupo)`, x.entrega.motivo);
  if (!x.entrega.ok) continue;
  const libro = x.entrega.libro;
  // el hecho `conteo` del grupo: único en el libro para este caso (los otros hechos son `ref`/`derivada`/`razon`)
  const hConteo = libro.hechos.find((h) => h.tipo === "conteo" && h.ok);
  ok(!!hConteo, `${id} · el libro trae un hecho «conteo» verificado (el grupo)`);
  if (!hConteo) continue;
  ok(hConteo.render.n === String(esp.n), `${id} · K = ${esp.n} (medido, no afirmado)`, hConteo.render.n);
  ok(hConteo.render.m === String(esp.m), `${id} · M = ${esp.m}`, hConteo.render.m);
  const miembros = new Set([...hConteo.entidades].map((k) => (libro.indice.entidades.get(k) || { nombre: k }).nombre));
  const esperados = new Set(esp.set);
  const faltan = esp.set.filter((n) => ![...miembros].some((m) => m === n));
  const sobran = [...miembros].filter((m) => !esperados.has(m));
  ok(faltan.length === 0 && sobran.length === 0, `${id} · el conjunto medido es EXACTAMENTE el esperado`, JSON.stringify({ faltan, sobran }));
  // universo tipado declarado en la Entrega (Etapa 2 §3): esta parte SÍ trae estados/filtros ahora (antes null)
  const uDeclarado = (x.entrega.entrega.universos || []).find((u) => u.id === "p1");
  ok(!!uDeclarado && uDeclarado.valido, `${id} · entrega.universos declara el universo tipado, válido`, JSON.stringify(uDeclarado));
  if (esp.primero) ok(x.entrega.texto.includes(`por contribución no capturada: ${esp.primero}`) || x.entrega.texto.includes(esp.primero), `${id} · el «primero» del grupo (decision) es ${esp.primero}`, x.entrega.texto);
}

/* ═══ 4 · CORTE 3c · PIEZA 2 — TENTACIONES PRECALCULADAS, con su carnada (nunca cruza universos) ══════════════ */
H("4 · pieza 2 (tentaciones precalculadas) — total + participación del primero, y la carnada de universos distintos");
{
  // D07 (13 cuentas comerciales, conceptos carga+ventas): el total/participación se calculan sobre VENTAS (money),
  // nunca sobre CARGA (una tasa — «las tasas no se suman», notario/hechos.js candado de raíz, no de este archivo).
  const x = resultadosCompuestos.get("D07");
  ok(!!x && x.entrega.ok, "D07 · el caso compone (para probar su tentación)");
  if (x && x.entrega.ok) {
    const libro = x.entrega.libro;
    const hSuma = libro.hechos.find((h) => h.tipo === "derivada" && h.ok && /^derivada \(suma\)/.test(h.motivo));
    ok(!!hSuma, "D07 · el libro trae una `derivada` de tipo suma (el total del grupo)", JSON.stringify(libro.hechos.map((h) => h.tipo)));
    ok(!!hSuma && hSuma.claves.has("ventas"), "D07 · la suma es sobre «ventas» (money), NUNCA sobre «carga» (una tasa)", hSuma ? [...hSuma.claves].join(",") : "");
    const hRazon = libro.hechos.find((h) => h.tipo === "razon" && h.ok);
    ok(!!hRazon, "D07 · el libro trae una `razon` (la participación del primero sobre el total)");
    ok(/concentra el/.test(x.entrega.texto) && /suma \$/.test(x.entrega.texto), "D07 · el texto imprime el total Y la participación (la tentación, ya calculada)");
  }
  // CARNADA — sumar capital (inventario) con ventas (comercial) en una `derivada` es NO-VERIFICABLE por diseño de
  // `notario/hechos.js:_derivada` («dominios-distintos»): la propia verificación (regla 9, ya corre en cada
  // Entrega) tumbaría cualquier compositor que lo intentara. Se prueba el candado DIRECTO (sin pasar por
  // componer.js, que hoy nunca genera esta mezcla — la carnada es del verificador, con dientes reales).
  {
    const figCapital = { id: "cX", label: "Santiago · Capital", raw: 63800, unidad: "money", texto: "$63.8K", entidad: "Santiago", concepto: "Capital", conceptoNorm: "capital", crudo: true, fig: { id: "cX", tipo: { verificabilidad: "literal" } } };
    const figVenta = { id: "cY", label: "Falabella · Venta", raw: 19433000, unidad: "money", texto: "$19.4M", entidad: "Falabella", concepto: "Venta", conceptoNorm: "venta", crudo: true, fig: { id: "cY", tipo: { verificabilidad: "literal" } } };
    const I = { figs: [figCapital, figVenta], buscarFigs: () => [], resolverEntidad: () => null, tamanoDelEje: () => null, entidades: new Map(), rankings: {}, conjuntos: {} };
    const libroMezcla = libroDeHechos([
      { id: "r1", tipo: "ref", de: "cX" }, { id: "r2", tipo: "ref", de: "cY" },
      { id: "m1", tipo: "derivada", op: "suma", de: [{ id: "r1" }, { id: "r2" }] },
    ], { indice: I });
    const hMezcla = libroMezcla.porId.get("m1");
    ok(!!hMezcla && !hMezcla.ok && hMezcla.veredicto === "no-verificable" && /dominios-distintos/.test(hMezcla.motivo), "CARNADA: sumar capital (inventario) + venta (comercial) da no-verificable «dominios-distintos» — el candado tiene dientes", JSON.stringify(hMezcla && { ok: hMezcla.ok, veredicto: hMezcla.veredicto, motivo: hMezcla.motivo }));
  }
}

/* ═══ 5 · CORTE 3c · PIEZA 3 — VEREDICTO DE PREMISAS, contra premisasDelGate del catálogo ═══════════════════════ */
H("5 · pieza 3 (veredicto de premisas) — cada premisa del catálogo, contra esperado.premisas");
{
  const IDS_CON_PREMISAS = CATALOGO.casos.filter((c) => c.encargo && Array.isArray(c.encargo.premisas) && c.encargo.premisas.length).map((c) => c.id);
  ok(IDS_CON_PREMISAS.length >= 10, `el catálogo trae ≥10 casos con premisas (trae ${IDS_CON_PREMISAS.length})`);
  for (const id of IDS_CON_PREMISAS) {
    const caso = CATALOGO.casos.find((c) => c.id === id);
    const x = resultadosCompuestos.get(id);
    if (!x) { ok(false, `${id} · el caso corrió con al menos una parte útil (¿esperado.valido y estado resuelto?)`); continue; }
    ok(x.entrega.ok, `${id} · componerEntrega ok con premisas en el encargo`, x.entrega.motivo);
    if (!x.entrega.ok) continue;
    const lp = x.entrega.entrega.procedencia.libroPremisas;
    ok(!!lp, `${id} · entrega.procedencia.libroPremisas existe (el libro APARTE de las premisas)`);
    if (!lp) continue;
    const esperadas = (caso.esperado.premisas || []);
    for (const esp of esperadas) {
      const H1 = lp.porId.get(String(esp.id));
      ok(!!H1, `${id}/${esp.id} · la premisa quedó en el libro de premisas`);
      if (!H1) continue;
      // CERRADO (owner 2026-09-25): D22/q1 y D29/q1 ya NO son una excepción — el respaldo por ranking (`_relacion`,
      // `_variacion`, notario/verificar.js) las juzga como el resto. EXIGE el veredicto correcto; si el motor
      // discrepa contra `premisasDelGate` (el catálogo calculado a mano), esta aserción lo dice con la evidencia
      // — no se ajusta el motor ni el fixture desde este gate.
      ok(H1.veredicto === esp.veredicto, `${id}/${esp.id} · veredicto = «${esp.veredicto}» (esperado, premisasDelGate)`, `real: «${H1.veredicto}» — ${H1.motivo}`);
    }
    // cada premisa bien formada del encargo (TIPOS_DE_PREMISA) abre la parte correspondiente en la Respuesta,
    // marcada `_premisa` — nunca decide la conclusión (se prueba en la sección 6 con una carnada directa).
    const nPremisasEnRespuesta = x.entrega.entrega.respuesta.filter((r) => r._premisa).length;
    ok(nPremisasEnRespuesta === esperadas.length, `${id} · la Entrega abre ${esperadas.length} premisa(s) en la Respuesta (una por premisa bien formada)`, `real: ${nPremisasEnRespuesta}`);
  }
}

/* ═══ 6 · CORTE 3c · PIEZA 3 · CARNADA — una premisa FALSA nunca cambia la conclusión (ley «premisa-adoptada») ══ */
H("6 · CARNADA · una premisa falsa sobre quién vende más NO cambia el «primero» del análisis (D15: Falabella)");
{
  // D15 declara Falabella como «primero» por ventas (medido); su premisa q2 (Jumbo tiene el margen máximo) es
  // FALSA (La Polar lo es). La conclusión de la parte (una lectura sin decision, sin «primero» explícito en este
  // caso) se prueba indirectamente: el TEXTO declara el veredicto («no es así») y AL MISMO TIEMPO nombra a
  // Falabella con su cifra real de ventas — ninguno de los dos hechos depende del otro.
  const x = resultadosCompuestos.get("D15");
  ok(!!x && x.entrega.ok, "D15 · el caso compone");
  if (x && x.entrega.ok) {
    ok(/no es así/.test(x.entrega.texto), "D15 · el veredicto «falsa» de q2 (Jumbo no tiene el margen máximo) se declara en el texto");
    ok(/Falabella.*\$19\.4M|\$19\.4M.*Falabella/.test(x.entrega.texto) || x.entrega.texto.includes("Falabella"), "D15 · Falabella (el máximo REAL de ventas, medido) sigue en el texto con su propia cifra — la premisa falsa no lo reemplaza ni lo esconde");
  }
}

/* ═══ 7 · CARNADA · preguntaOriginal nunca se lee ═══════════════════════════════════════════════════════════ */
H("7 · CARNADA · cambiar preguntaOriginal no cambia la Entrega (componerEntrega nunca la lee)");
{
  const caso = CATALOGO.casos.find((c) => c.id === "D01");
  const res1 = validarEncargo(caso.encargo, {});
  const res2 = validarEncargo({ ...caso.encargo, preguntaOriginal: "esto es una carnada — si esto cambia algo, el candado arde" }, {});
  const e1 = componerEntrega(res1), e2 = componerEntrega(res2);
  ok(e1.ok && e2.ok && e1.texto === e2.texto, "D01 con preguntaOriginal distinta produce el MISMO texto");
}

/* ═══ 8 · CARNADA · fuerza nula nunca se rotula «medido»/verificada ═══════════════════════════════════════════ */
H("8 · CARNADA · un hecho con fuerza nula (propuesta, sin insumos) nunca sale con la etiqueta de «medido»");
{
  // un hecho `propuesta` (notario/hechos.js): sin composición, `fuerza` queda null por diseño («un número del
  // asesor, no una medición» — el mismo comentario de hechos.js) — se prueba el INVARIANTE que la columna «Tipo»
  // de componer.js usa (`procedenciaDe`/`NOMBRE_DE_PROCEDENCIA`), la MISMA tabla, sin segunda copia.
  const libro = libroDeHechos([{ id: "pr1", tipo: "propuesta", valor: "5%", sujeto: "negocio" }], { indice: { resolverEntidad: () => null, tamanoDelEje: () => null } });
  const h = libro.porId.get("pr1");
  ok(!!h && h.ok, "el hecho propuesta verifica (sellada)");
  ok(h && h.fuerza === null, "fuerza queda null (sin insumos que medir)", JSON.stringify(h && h.fuerza));
  const procedencia = procedenciaDe(libro, "pr1");
  ok(procedencia === "propuesta", "la procedencia es «propuesta», nunca «medido»", procedencia);
  const etiqueta = NOMBRE_DE_PROCEDENCIA[procedencia];
  ok(!/^medido$/i.test(etiqueta || ""), "la etiqueta que componer.js imprimiría en «Tipo» NO es «medido»", etiqueta);
  ok(fuerzaDe(libro, "pr1") === null, "fuerzaDe(libro, id) también da null para este hecho (la misma verdad, otra puerta)");
}

/* ═══ 9 · UNA PARTE NO SOPORTADA NO TUMBA LA ENTREGA (corrección del supervisor, owner 2026-09-25) ═════════════
 * CORTE 3c: `estados` SOLO (sin `top`) ya NO es «no soportada» (pieza 1 — p2 compondría). Esta carnada necesita
 * un universo que SIGA fuera de alcance: `estados` COMBINADO con `top` en la MISMA parte — la combinación que
 * `componer.js` sigue declinando a propósito (ver la cabecera de este gate). */
H("9 · una parte con universo no soportado (estados + top combinados) no impide servir las demás partes del MISMO encargo");
{
  const encargo = {
    version: "encargo/v1",
    partes: [
      { id: "p1", tema: "comercial", cierre: "cifra", conceptos: ["ventas"], entidades: [{ nombre: "Jumbo" }] },
      { id: "p2", tema: "cobranza", cierre: "lectura", universo: { eje: "cliente", estados: ["en mora"], top: { metrica: "saldo_vencido", k: 3, direccion: "mayor" } } },
    ],
  };
  const res = validarEncargo(encargo, {});
  ok(res.ok && res.partes.every((p) => p.estado === "resuelta"), "las dos partes resuelven en validarEncargo (el gap se evalúa al COMPONER, no al validar)");
  const entrega = componerEntrega(res);
  ok(entrega.ok, "componerEntrega da ok:true — la parte p2 (no soportada) NO tumba la Entrega entera", entrega.motivo);
  if (entrega.ok) {
    ok(entrega.texto.includes("Jumbo"), "la parte servible (p1, Jumbo) aparece servida en el texto");
    ok(/Sobre la parte p2 \(cobranza\), el filtro del universo no se aplica/.test(entrega.texto), "p2 sale como LÍMITE con título y motivo, en «Lo que no se puede concluir»");
    const filasCobranza = (entrega.entrega.cifras.filas || []).filter((f) => f.valores["Tema"] === "cobranza");
    ok(filasCobranza.length === 0, "ninguna fila de Cifras pertenece a la parte declinada (cobranza)");
    ok((entrega.entrega.temasCubiertos || []).includes("comercial") && !(entrega.entrega.temasCubiertos || []).includes("cobranza"), "temasCubiertos = solo lo servido (comercial); cobranza queda fuera y declarado, no silenciado");
    const v = verificarEntrega({ texto: entrega.texto, entrega: entrega.entrega });
    ok(v.ok, "verificarEntrega ok sobre la Entrega mixta (parcial + límite)", JSON.stringify(v.violaciones));
    // CARNADA de raíz (defecto real hallado y cerrado en este corte, no hipotético): antes de acotar cada parte a
    // sus PROPIAS figs (`_figsDeParte`/`_figsDePartes`, componer.js), una fig de la parte declinada (`cobranza`,
    // «Jumbo · Venta (flujo)») se colaba en la lectura de la parte servida (`comercial`) por una canonización
    // ambigua del rótulo (ver la nota reportada en el punto 8 de este archivo) y el Marco mezclaba "año cerrado"
    // con "foto a hoy" para un encargo que ni siquiera sirve contenido de inventario/cobranza.
    ok(!/dos marcos en la misma respuesta/.test(entrega.texto), "el Marco declara UN SOLO marco temporal — ninguna fig de la parte declinada se coló en la parte servida");
  }
}

/* ═══ 10 · CARNADA · una brecha en «Para su juicio» sin referencia declarada viola comparables-juntas ═══════════ */
H("10 · CARNADA · «Para su juicio» afirmando una brecha sin marco.referenciaDeclarada da violación (regla 4)");
{
  const entrega = crearEntrega();
  entrega.marco.referenciaDeclarada = null;   // a propósito: nadie declaró la referencia
  entrega.respuesta = [{ texto: "Jumbo vende $17.3M.", hechos: ["e1"] }];
  entrega.cifras.columnas = ["Entidad", "Valor"];
  entrega.cifras.filas = [{ valores: { Entidad: "Jumbo", Valor: "$17.3M" }, hechos: ["e1"] }];
  entrega.paraSuJuicio = [{ texto: "Sospecho que hay una brecha importante contra el benchmark del sector en esta cuenta.", hechos: [] }];
  const libro = { hechos: [{ id: "e1", ok: true }], porId: new Map([["e1", { tipo: "ref", ok: true, roles: { sujetos: ["Jumbo"] } }]]) };
  entrega.procedencia = { libro, cifrasImpresas: ["$17.3M"] };
  const texto = [
    "**Marco.** ADI Demo.",
    "",
    "**Respuesta.**",
    "▸ Jumbo vende $17.3M.",
    "",
    "**Para su juicio.**",
    "- Sospecho que hay una brecha importante contra el benchmark del sector en esta cuenta.",
  ].join("\n");
  const v = verificarEntrega({ texto, entrega });
  ok(!v.ok && v.violaciones.some((x) => x.regla === "comparables-juntas"), "CARNADA: «brecha»/«benchmark» en Para su juicio, sin referencia declarada ⇒ viola comparables-juntas", JSON.stringify(v.violaciones));
  // control negativo: la MISMA oración, pero con la referencia declarada, no debe violar por este motivo
  const entregaOk = { ...entrega, marco: { ...entrega.marco, referenciaDeclarada: { texto: "Benchmark de margen: 30.1%, declarado por usted.", hechoId: "e1" } } };
  const v2 = verificarEntrega({ texto, entrega: entregaOk });
  ok(!v2.violaciones.some((x) => x.regla === "comparables-juntas"), "control negativo: con la referencia declarada, la MISMA oración no viola comparables-juntas");
}

/* ═══ 11 · CERRADO POR EL SUPERVISOR · claveDeMetrica ya NO nombra dos campos con un rótulo (CLAUDE.md §4) ══════
 * `claveDeMetrica` (notario/lexico.js, owner 2026-09-25) ahora prueba el rótulo COMPLETO, con su paréntesis,
 * contra los sinónimos ANTES de recortarlo — regla general, no un alias de este caso. Barrido real (908 rótulos
 * únicos de comercial+inventario+cobranza, `_sweep_claveDeMetrica.mjs`, borrado tras reportarse): 9 cambiaron, los
 * 9 el MISMO caso («Venta (flujo)»/«Venta del período (flujo)» → venta_credito, no ventas), 0 inesperados. */
H("11 · claveDeMetrica(\"Venta (flujo)\") === \"venta_credito\" (CLAUDE.md §4 — el rótulo ya no nombra dos campos)");
{
  const c = claveDeMetrica("Venta (flujo)");
  ok(c === "venta_credito", "claveDeMetrica(\"Venta (flujo)\") === \"venta_credito\" (cobranza, no comercial)", c);
}

/* ═══ 12 · CERO red ═══════════════════════════════════════════════════════════════════════════════════════════ */
H("12 · CERO red — clasificarFuente(este gate) === offline");
{
  const fuente = fs.readFileSync("./_entrega_general_gate.mjs", "utf8");
  const c = clasificarFuente(fuente);
  ok(c.tipo === "offline", "clasificarFuente(_entrega_general_gate.mjs) === offline", JSON.stringify(c));
}

console.log(`\n── _entrega_general_gate: PASS ${pass} · FAIL ${fail} (de ${pass + fail}) ──`);
if (fail > 0) { console.log("\nFALLAS:\n" + fails.map((f) => "  · " + f).join("\n")); process.exit(1); }
