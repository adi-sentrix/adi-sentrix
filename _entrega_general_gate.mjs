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
import { stripLanguageLeaks } from "./src/adi/llm/voiceGuard.js";   // §7.3·28 (SUPERVISOR): carnada 27 más abajo

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
/* CORTE 3d.3 (owner 2026-09-25/26) — SE RETIRA la exención de la regla 8 para D27: `componerEntrega` ahora
 * gobierna el tamaño por profundidad (`entrega/tamano.js:gobernarTamano`, cableado en `componer.js`) — D27 (la
 * simulación de 96 filas / 1620 palabras sin gobernar) queda en 638 palabras / 24 filas bajo "completa" (su
 * profundidad por defecto, sin declarar en el fixture), dentro del tope de 900. Ya no hay ningún caso exento. */
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

  // CORTE 3d.3 — la profundidad que `componerEntrega` de verdad usó (`entrega.entrega.meta.profundidad`, "completa"
  // por defecto si el encargo no la declaró) — nunca "completa" a ciegas: verificarEntrega debe auditar la MISMA
  // profundidad que gobernó el texto servido.
  const profundidadUsada = (entrega.entrega.meta && entrega.entrega.meta.profundidad) || "completa";
  const v = verificarEntrega({ texto: entrega.texto, entrega: entrega.entrega, profundidad: profundidadUsada });
  ok(v.violaciones.length === 0, `${caso.id} · verificarEntrega ok`, JSON.stringify(v.violaciones));

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
    // ACTUALIZADO (owner 2026-09-26, CORTE 3d — garantía de dueño de la simulación): la vieja forma «Simulación —
    // supuesto: X. Resultado: Y» ponía supuesto y resultado en UNA sola oración; la nueva organiza la Respuesta
    // en BLOQUES por entidad (`entrega/componer.js:_planSimulacion`) — el ENCABEZADO nombra entidad+simulación+
    // supuesto una vez («Falabella — simulación: la carga comercial baja 1 punto.») y el
    // CUERPO trae el resultado, COMPARABLES JUNTAS (owner 2026-09-26, ronda final): «el margen pasaría de 22,0 %
    // a 23,0 % (1 pp)», nunca «margen supuesto» como sujeto suelto sin decir desde dónde. Antes: una oración con
    // ambas piezas y un delta con la frase "contra lo real: …"; ahora: dos oraciones del MISMO bloque (`_bloqueId`
    // compartido) y el delta pegado al par que lo trae, entre paréntesis — `_simulacion_dueno_gate.mjs` prueba el
    // vínculo estructural completo (entidad/simulación/supuesto por bloque y por fila); acá solo se confirma que
    // las piezas SIGUEN presentes en el texto servido.
    // RENOMBRADO (owner 2026-09-26, `_colapso_eje_gate` C4 — «el CONCEPTO visible "escenario" murió»): «— escenario
    // declarado por usted:» → «— simulación:»; «escenario hipotético» → «simulación… resultado hipotético».
    ok(/— simulaci[oó]n:/.test(entrega.texto) && /pasar[ií]a/.test(entrega.texto), `${caso.id} · simulacion trae el encabezado del bloque (simulación+supuesto) y el resultado`);
    ok(/\(-?\$?\d/.test(entrega.texto) || /no se pudo aislar como cifra propia/.test(entrega.texto), `${caso.id} · simulacion trae delta O su límite declarado (nunca en silencio)`);
    ok(/simulaci[oó]n es un resultado hipot[eé]tico/.test(entrega.texto), `${caso.id} · simulacion declara el límite «es una simulación, no lo que ya ocurrió»`);
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
    /* CONGELAMIENTO (owner 2026-09-28, §7.3·34b, etapa 5 — migración de significado de «frenado»): D23/q1 y
     * D23/q2 (fixtures/encargos-desarrollo.json) pinzan «estado: "frenado"» con el significado VIEJO
     * (capital_frenado, rotación — "premisasDelGate": "LG-DRYER8KG rotación 1.0 < 2 → capital_frenado"). Registro
     * histórico, no se juzgan contra el canon vigente (frenado = venta interrumpida, sin umbral en este fixture).
     * Únicos dos casos del catálogo con `estado:"frenado"` en una premisa — verificado. */
    const HISTORICOS_PREMISA = id === "D23" ? new Set(["q1", "q2"]) : new Set();
    for (const esp of esperadas) {
      if (HISTORICOS_PREMISA.has(esp.id)) { console.log(`  ❄ HISTÓRICO · ${id}/${esp.id} — congelado (frenado-regla-de-rotacion, §7.3·34b)`); continue; }
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

/* ═══ 9 · UNA PARTE NO COMPONIBLE NO TUMBA LA ENTREGA (corrección del supervisor, owner 2026-09-25;
 * REESCRITO 2026-09-27, decisión del coordinador sobre el diagnóstico v7) ═══════════════════════════════════
 * La carnada original usaba `estados` COMBINADO con `top` como universo «fuera de alcance» — esa combinación
 * es justo la que §7.3·8 (2026-09-26) cerró: HOY compone (ver la sección 9b, más abajo, con la MISMA parte
 * vieja). La INTENCIÓN de esta sección («una parte que no se puede componer no impide servir las demás partes
 * del MISMO encargo») sigue vigente — se prueba con una causa de declinación que SÍ sigue siendo real hoy:
 * un concepto sin productor para el eje de la entidad pedida (§2.1/§3.3 del contrato — `markup` SOLO tiene
 * productor para `cliente`; pedirlo por `marca` no tiene ni tendrá una cifra que citar, no es un gap de este
 * corte). A diferencia de la vieja carnada, esta declina en la VALIDACIÓN (no al componer) — el contrato ya lo
 * documenta así (§4f): un concepto sin productor es un defecto de la PARTE, no del universo. */
H("9 · una parte con un concepto sin productor no impide servir las demás partes del MISMO encargo");
{
  const encargo = {
    version: "encargo/v1",
    partes: [
      { id: "p1", tema: "comercial", cierre: "cifra", conceptos: ["ventas"], entidades: [{ nombre: "Jumbo" }] },
      { id: "p2", tema: "comercial", cierre: "cifra", conceptos: ["markup"], entidades: [{ nombre: "Philips", eje: "marca" }] },
    ],
  };
  const res = validarEncargo(encargo, {});
  const p1 = (res.partes || []).find((p) => p.id === "p1"), p2 = (res.partes || []).find((p) => p.id === "p2");
  ok(res.ok && p1 && p1.estado === "resuelta" && p2 && p2.estado === "no_resuelta", "p1 resuelve; p2 (markup por marca — sin productor real) declina en la VALIDACIÓN", JSON.stringify(res.partes.map((p) => ({ id: p.id, estado: p.estado }))));
  const nr = (res.noResuelto || []).find((n) => n.parte === "p2" && n.campo === "concepto" && n.motivo === "concepto_sin_productor");
  ok(!!nr, "★ noResuelto declara concepto_sin_productor para p2 (markup no tiene eje marca — nunca lo tuvo)", JSON.stringify(res.noResuelto));
  const entrega = componerEntrega(res);
  ok(entrega.ok, "componerEntrega da ok:true — la parte p2 (sin productor) NO tumba la Entrega entera", entrega.motivo);
  if (entrega.ok) {
    ok(entrega.texto.includes("Jumbo"), "la parte servible (p1, Jumbo) aparece servida en el texto");
    ok(/concepto sin productor/.test(entrega.texto) && /concepto_sin_productor/.test(entrega.texto), "p2 sale como LÍMITE con su motivo real, en «Lo que no se puede concluir»", entrega.texto);
    ok(!/Philips/.test(entrega.texto), "Philips (la marca de p2) no recibe ninguna cifra — declinada, no inventada");
    const duenos = new Set((entrega.entrega.cifras.filas || []).map((f) => f.valores["Entidad / grupo"]));
    ok(duenos.has("Jumbo") && !duenos.has("Philips"), "Cifras solo trae lo que p1 sí sirvió (Jumbo), nunca una fila de la parte declinada");
    ok((entrega.entrega.temasCubiertos || []).includes("comercial"), "temasCubiertos sigue cubriendo comercial (lo que p1 sí sirvió)");
    const v = verificarEntrega({ texto: entrega.texto, entrega: entrega.entrega });
    ok(v.ok, "verificarEntrega ok sobre la Entrega mixta (parcial + límite)", JSON.stringify(v.violaciones));
  }
}

/* ═══ 9b · §7.3·8 (2026-09-26), cerrado por el diagnóstico v7 (supervisor 2026-09-27) — `top` COMBINADO con
 * `estados` en la MISMA parte YA compone, en el sentido por defecto (top DENTRO del conjunto ya filtrado): la
 * parte vieja de la sección 9 (cobranza, «en mora» + los 3 de mayor saldo vencido) ya no es un universo fuera
 * de alcance — se prueba acá, contra el dato real del tenant demo (nunca un número a mano). ── */
H("9b · §7.3·8 — «en mora» + top 3 por saldo vencido (antes «no soportado») compone HOY, con las entidades reales del dato");
{
  const encargo = {
    version: "encargo/v1",
    partes: [
      { id: "p1", tema: "comercial", cierre: "cifra", conceptos: ["ventas"], entidades: [{ nombre: "Jumbo" }] },
      { id: "p2", tema: "cobranza", cierre: "lectura", universo: { eje: "cliente", estados: ["en mora"], top: { metrica: "saldo_vencido", k: 3, direccion: "mayor" } } },
    ],
  };
  const res = validarEncargo(encargo, {});
  ok(res.ok && res.partes.every((p) => p.estado === "resuelta"), "★ las dos partes resuelven en validarEncargo — la MISMA combinación de la vieja sección 9", JSON.stringify(res.partes.map((p) => ({ id: p.id, estado: p.estado }))));
  const entrega = componerEntrega(res);
  ok(entrega.ok, "★ componerEntrega da ok:true — §7.3·8 cerrado: ya no se declina por «universo no soportado»", entrega.motivo);
  if (entrega.ok) {
    ok(entrega.texto.includes("Jumbo"), "p1 (Jumbo) sigue sirviéndose");
    ok(entrega.texto.includes("Lider") && entrega.texto.includes("Sodimac"), "★ p2 compone con las entidades reales del dato (Lider y Sodimac, el saldo vencido más alto entre los «en mora» que la prioridad integrada retiene)", entrega.texto);
    ok((entrega.entrega.temasCubiertos || []).includes("comercial") && (entrega.entrega.temasCubiertos || []).includes("cobranza"), "★ temasCubiertos trae los DOS temas — cobranza ya no queda fuera", JSON.stringify(entrega.entrega.temasCubiertos));
    const duenos = new Set((entrega.entrega.cifras.filas || []).map((f) => f.valores["Entidad / grupo"]));
    ok(duenos.has("Lider") && duenos.has("Sodimac"), "★ Cifras trae filas propias de Lider y Sodimac (cobranza), no un límite genérico", JSON.stringify([...duenos]));
    const _FUERA_DE_ALCANCE = ["Ripley", "Mercado Libre", "La Polar", "Hites", "ABC", "Unimarc"]; // saldo_vencido = 0: nunca "en mora"
    ok(_FUERA_DE_ALCANCE.every((n) => !duenos.has(n)), "ninguna cuenta sin saldo vencido (nunca «en mora») recibe fila propia", JSON.stringify([...duenos]));
    const v = verificarEntrega({ texto: entrega.texto, entrega: entrega.entrega });
    ok(v.ok, "verificarEntrega ok sobre la Entrega con las dos partes compuestas", JSON.stringify(v.violaciones));
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

/* ═══ 13 · REVISIÓN DE CALIDAD DEL SUPERVISOR (2026-09-25) — (a) la Respuesta de una lectura/decision con
 * entidad abre con la CONCLUSIÓN del procedimiento, nunca un volcado de conceptos; y ninguna cifra se repite
 * con dos rótulos ═══════════════════════════════════════════════════════════════════════════════════════════ */
H("13a · lectura con entidad — abre con la CONCLUSIÓN (posición, brecha, margen vs benchmark), no un volcado");
{
  const res = validarEncargo({ version: "encargo/v1", partes: [{ id: "p1", tema: "comercial", cierre: "lectura", entidades: [{ nombre: "Lider", eje: "cliente" }] }] }, {});
  const R = componerEntrega(res);
  ok(R.ok, "compone ok", R.motivo);
  if (R.ok) {
    const primera = R.entrega.respuesta[0];
    ok(/^Lider(,.*)?: vende /.test(primera.texto), "★ la PRIMERA oración es la conclusión (dueño + posición + vende + margen vs benchmark), no un listado", primera.texto);
    ok(/contra el benchmark de/.test(primera.texto), "la conclusión cita el benchmark (regla madre: ADI arma decisiones, no muestra datos)", primera.texto);
    ok(!/\byoy\b/i.test(R.texto), "★ CARNADA · ningún alias de jerga (\"yoy\") sobrevive en el texto — se dedupeó a su clave canónica", R.texto.match(/yoy/i));
    ok(!/\$\s\$/.test(R.texto), "★ CARNADA · ningún \"$ $\" (rótulo con \"en $\" pegado a un valor en dinero) en todo el texto", (R.texto.match(/\$\s\$[^\s]*/g) || []).join(", "));
    // «la Respuesta nunca repite la misma cifra con dos rótulos»: dentro de la MISMA fila (Entidad+Tema) de
    // Cifras, cada Métrica aparece una sola vez — dos claves LEGÍTIMAMENTE distintas (ej. variación en % y en $)
    // no son un duplicado; dos filas con el rótulo IDÉNTICO sí lo serían.
    const claves = new Map();
    for (const f of R.entrega.cifras.filas) {
      const k = `${f.valores["Entidad / grupo"]}::${f.valores["Tema"]}::${f.valores["Métrica"]}`;
      claves.set(k, (claves.get(k) || 0) + 1);
    }
    const repetidas = [...claves.entries()].filter(([, n]) => n > 1);
    ok(repetidas.length === 0, "ninguna fila de Cifras repite (Entidad, Tema, Métrica) — ningún rótulo duplicado", JSON.stringify(repetidas));
  }
}

H("13b · cifra con entidad (no lectura/decision) sigue con el listado — el contrato §1.1 no cambia");
{
  const res = validarEncargo({ version: "encargo/v1", partes: [{ id: "p1", tema: "comercial", cierre: "cifra", entidades: [{ nombre: "Lider", eje: "cliente" }], conceptos: ["margen", "ventas"] }] }, {});
  const R = componerEntrega(res);
  ok(R.ok, "compone ok", R.motivo);
  if (R.ok) ok(/^Lider: /.test(R.entrega.respuesta[0].texto) && !/vende .* contra el benchmark/.test(R.entrega.respuesta[0].texto), "una `cifra` (no lectura/decision) NO recibe la conclusión — sigue siendo un listado de lo pedido", R.entrega.respuesta[0].texto);
}

/* ═══ 14 · (b) LA INICIATIVA NUNCA REPITE LO PEDIDO ═══════════════════════════════════════════════════════════
 * Caso real medido: en un encargo de 2 temas (comercial+cobranza, cartera entera) el pedido YA declara «Lider
 * concentra el 36.3% del vencido total» (razón sobre el vencido de Lider ÷ vencido total) — el candidato de
 * iniciativa `participacion-vencido` calcula EXACTAMENTE la misma razón sobre los MISMOS figs: tiene que
 * desaparecer, no duplicarse con otro rótulo. */
H("14 · (b) la iniciativa no repite un hecho ya pedido (misma razón, mismos figs subyacentes)");
{
  const res = validarEncargo({ version: "encargo/v1", partes: [{ id: "p1", tema: "comercial", cierre: "lectura" }, { id: "p2", tema: "cobranza", cierre: "lectura" }] }, {});
  const R = componerEntrega(res);
  ok(R.ok, "compone ok", R.motivo);
  if (R.ok) {
    const ocurrencias = (R.texto.match(/Lider concentra el 36[.,]3%/g) || []).length;
    ok(ocurrencias === 1, `★ CARNADA · «Lider concentra el 36,3%[...]» aparece UNA sola vez (pedido) — la iniciativa no lo repite (apareció ${ocurrencias} veces)`, R.texto);
    ok(!R.entrega.respuesta.some((r) => r._iniciativa && /vencido total/i.test(r.texto) && /Lider/.test(r.texto) && /36[.,]3%/.test(r.texto)), "ninguna oración de iniciativa duplica el contenido exacto de la participación de Lider en el vencido total");
  }
}

/* ═══ 15 · (c) SECCIONES VACÍAS NO SE IMPRIMEN + OFERTAS CONCRETAS ═══════════════════════════════════════════ */
H("15a · «Para su juicio» no se imprime si no hay contenido; con contenido, sí");
{
  // comercial "cifra" de una entidad SIN carga comercial alta detectada (Jumbo: bajo el nivel, sin cuenta con
  // roles/candidatos de volumen que dispare `buildRolesCartera`) — puede quedar sin nada que preguntar.
  const resVacio = validarEncargo({ version: "encargo/v1", partes: [{ id: "p1", tema: "comercial", cierre: "cifra", entidades: [{ nombre: "Jumbo", eje: "cliente" }], conceptos: ["ventas"] }] }, {});
  const Rvacio = componerEntrega(resVacio);
  ok(Rvacio.ok, "compone ok (caso sin «Para su juicio»)", Rvacio.motivo);
  if (Rvacio.ok) {
    ok(Rvacio.entrega.paraSuJuicio.length === 0, "en este caso, `entrega.paraSuJuicio` queda vacío (nada que preguntar sin inventar sujeto)", JSON.stringify(Rvacio.entrega.paraSuJuicio));
    // CORTE 3e (owner 2026-09-26, «LA ENTREGA NO LE HABLA A NADIE») — «Para su juicio» llevaba «su» de trato
    // (posesivo de segunda persona formal): el título se renombró a uno neutro. Misma carnada, título nuevo.
    ok(!/\*\*Preguntas abiertas y supuestos a validar\.\*\*/.test(Rvacio.texto), "★ CARNADA · con `paraSuJuicio` vacío, la sección NO se imprime (ni el título)", Rvacio.texto);
  }
  const resConContenido = validarEncargo({ version: "encargo/v1", partes: [{ id: "p1", tema: "cobranza", cierre: "lectura", entidades: [{ nombre: "Lider", eje: "cliente" }] }] }, {});
  const Rcon = componerEntrega(resConContenido);
  ok(Rcon.ok, "compone ok (caso con «Para su juicio»)", Rcon.motivo);
  // CORTE 3e (owner 2026-09-26) — título renombrado (ver arriba); el contenido sigue siendo el mismo campo
  // `entrega.paraSuJuicio`, ahora con preguntas abiertas tipadas en vez de «Solo usted/tú puede(s) responder».
  if (Rcon.ok) ok(Rcon.entrega.paraSuJuicio.length > 0 && /\*\*Preguntas abiertas y supuestos a validar\.\*\*/.test(Rcon.texto), "con contenido, el título SÍ se imprime", Rcon.texto.includes("Preguntas abiertas"));
}

H("15b · «Qué más puedo calcular» trae ofertas CONCRETAS (con el nombre de la entidad), no solo el genérico");
{
  const res = validarEncargo({ version: "encargo/v1", partes: [{ id: "p1", tema: "comercial", cierre: "lectura", entidades: [{ nombre: "Lider", eje: "cliente" }] }] }, {});
  const R = componerEntrega(res);
  ok(R.ok, "compone ok", R.motivo);
  if (R.ok) {
    ok(R.entrega.queMasPuedoCalcular.puedo.some((s) => s.includes("Lider")), "★ hay al menos una oferta CONCRETA que nombra a Lider (no solo \"Otro corte del mismo encargo\")", JSON.stringify(R.entrega.queMasPuedoCalcular.puedo));
  }
}

/* ═══ 16 · (d) CAU-03 COMO AUSENCIA — toda Entrega que sirve cobranza declara la antigüedad del vencido ═══════ */
H("16 · (d) cobranza siempre declara «antigüedad del vencido» como límite (ausencias.js, no la pieza en borrador)");
{
  const res = validarEncargo({ version: "encargo/v1", partes: [{ id: "p1", tema: "cobranza", cierre: "lectura", entidades: [{ nombre: "Lider", eje: "cliente" }] }] }, {});
  const R = componerEntrega(res);
  ok(R.ok, "compone ok", R.motivo);
  if (R.ok) ok(R.entrega.limites.some((l) => /antig[uü]edad del vencido/i.test(l.titulo)), "★ el límite «La antigüedad del vencido no está en los datos» aparece", JSON.stringify(R.entrega.limites.map((l) => l.titulo)));
  // ACTUALIZADO (owner, 2026-09-25, ronda 2 de revisión): «agrega la ausencia de antigüedad del vencido también
  // a las rutas fijas de cobranza y multidominio — es un agregado de verdad intencional». Antes esta sección
  // probaba lo CONTRARIO (que la ruta fija NO la ganaba); ahora prueba que SÍ la gana, en las DOS rutas fijas que
  // sirven cobranza — el ÚNICO texto que cambia en esas rutas en este corte (ver `componer.js`, con la misma fecha).
  const fijaCobranza = componerEntregaCobranza({ pregunta: PREGUNTA_COBRANZA });
  ok(fijaCobranza.ok && fijaCobranza.entrega.limites.some((l) => /antig[uü]edad del vencido/i.test(l.titulo)), "★ AGREGADO INTENCIONAL · la ruta FIJA de cobranza (componerEntregaCobranza) también declara este límite ahora", JSON.stringify(fijaCobranza.entrega.limites.map((l) => l.titulo)));
  const fijaMulti = componerEntregaMultidominio({ pregunta: PREGUNTA_MULTIDOMINIO });
  ok(fijaMulti.ok && fijaMulti.entrega.limites.some((l) => /antig[uü]edad del vencido/i.test(l.titulo)), "★ AGREGADO INTENCIONAL · la ruta FIJA multidominio (componerEntregaMultidominio) también declara este límite ahora", JSON.stringify(fijaMulti.entrega.limites.map((l) => l.titulo)));
  // control negativo: la ruta fija de INVENTARIO (que no sirve cobranza) sigue SIN este límite — el agregado es
  // solo para las rutas que efectivamente cubren cobranza, nunca uno que no la toca.
  const fijaInv = componerEntregaInventario({ pregunta: PREGUNTA_INVENTARIO });
  ok(fijaInv.ok && !fijaInv.entrega.limites.some((l) => /antig[uü]edad del vencido/i.test(l.titulo)), "control negativo · la ruta fija de INVENTARIO (no sirve cobranza) sigue SIN este límite");
}

/* ═══ 17 · (e) SIN UNIDADES ABREVIADAS EN LA PROSA (el camino general) ═══════════════════════════════════════ */
H("17 · (e) \"269d\" → \"269 días\" en Respuesta/Para su juicio del camino general — la tabla de Cifras no cambia");
{
  const res = validarEncargo({ version: "encargo/v1", partes: [{ id: "p1", tema: "comercial", cierre: "lectura" }, { id: "p2", tema: "cobranza", cierre: "lectura" }] }, {});
  const R = componerEntrega(res);
  ok(R.ok, "compone ok", R.motivo);
  if (R.ok) {
    const textoRespuesta = R.entrega.respuesta.map((r) => r.texto).join(" ");
    ok(!/\b\d+d\b/.test(textoRespuesta), "★ ninguna Respuesta trae un día abreviado (\"269d\") — se escribe \"269 días\"", textoRespuesta.match(/\b\d+d\b/g));
    ok(/\b\d+\s+días\b/.test(textoRespuesta), "★ la forma larga (\"N días\") SÍ aparece", textoRespuesta.match(/\b\d+\s+días\b/g));
    const filaConDias = R.entrega.cifras.filas.find((f) => /d[ií]as/i.test(f.valores["Métrica"] || ""));
    if (filaConDias) ok(/\d+d$/.test(filaConDias.valores.Valor), "la tabla de Cifras conserva el formato denso (\"269d\") — no se tocó", filaConDias.valores.Valor);
  }
}

/* ═══ 19 · REVISIÓN DE CALIDAD DEL SUPERVISOR (2026-09-25, ronda 2) — (1) EL MARCO POR DOMINIO, error MATERIAL de
 * CONCEPTO: una Entrega de cobranza NUNCA dice «inventario»; una de comercial NUNCA dice «foto» (cobranza SÍ
 * puede decir «foto de cobranza», así que la carnada es específica por dominio, no una prohibición ciega de la
 * palabra) ═══════════════════════════════════════════════════════════════════════════════════════════════════ */
H("19 · (1) el Marco por dominio — cobranza nunca dice \"inventario\"; comercial nunca dice \"foto\"");
{
  const resCobranza = validarEncargo({ version: "encargo/v1", partes: [{ id: "p1", tema: "cobranza", cierre: "lectura", entidades: [{ nombre: "Lider", eje: "cliente" }] }] }, {});
  const Rc = componerEntrega(resCobranza);
  ok(Rc.ok, "compone ok (cobranza sola)", Rc.motivo);
  if (Rc.ok) {
    ok(!/inventario/i.test(Rc.entrega.marco && (Rc.entrega.marco.periodo && Rc.entrega.marco.periodo.texto || "")), "★ CARNADA · el Marco de una Entrega SOLO cobranza no menciona \"inventario\"", JSON.stringify(Rc.entrega.marco.periodo));
    ok(/foto de cobranza al/.test(Rc.entrega.marco.periodo.texto || ""), "★ el Marco declara \"foto de cobranza al {fecha}\" — el mismo marco que la ruta fija de cobranza", Rc.entrega.marco.periodo.texto);
    ok(Rc.entrega.marco.periodo.rango, "el período trae `rango` (la fecha de corte real, `facts.fechaCorte`)", Rc.entrega.marco.periodo.rango);
  }
  const resComercial = validarEncargo({ version: "encargo/v1", partes: [{ id: "p1", tema: "comercial", cierre: "lectura", entidades: [{ nombre: "Lider", eje: "cliente" }] }] }, {});
  const Rm = componerEntrega(resComercial);
  ok(Rm.ok, "compone ok (comercial solo)", Rm.motivo);
  if (Rm.ok) ok(!/\bfoto\b/i.test(Rm.entrega.marco.periodo.texto || ""), "★ CARNADA · el Marco de una Entrega SOLO comercial no dice \"foto\" (es año cerrado)", Rm.entrega.marco.periodo.texto);

  // control positivo: multi-tema (comercial+cobranza+inventario) SÍ puede nombrar los tres, cada uno con el suyo
  const resTres = validarEncargo({ version: "encargo/v1", partes: [{ id: "p1", tema: "comercial", cierre: "lectura" }, { id: "p2", tema: "inventario", cierre: "lectura" }, { id: "p3", tema: "cobranza", cierre: "lectura" }] }, {});
  ok(resTres.ok, "el encargo de 3 partes valida");
  // (3 partes, las 3 "lectura" sin entidad) delega a la ruta fija multidominio — no ejercita `_periodoGeneralPorDominio`,
  // así que se arma un caso NO delegable (agregando un cuarto elemento no cambia el tema, solo evita la forma exacta
  // de delegación) para probar la combinación real de "tres marcos" en el camino general.
  const resTresGeneral = validarEncargo({ version: "encargo/v1", partes: [{ id: "p1", tema: "comercial", cierre: "lectura", entidades: [{ nombre: "Lider", eje: "cliente" }] }, { id: "p2", tema: "inventario", cierre: "lectura" }, { id: "p3", tema: "cobranza", cierre: "lectura" }] }, {});
  const Rtres = componerEntrega(resTresGeneral);
  ok(Rtres.ok, "compone ok (comercial+inventario+cobranza, camino general)", Rtres.motivo);
  if (Rtres.ok) {
    const ptxt = Rtres.entrega.marco.periodo.texto || "";
    ok(/año cerrado/.test(ptxt) && /foto de inventario a hoy/.test(ptxt) && /cobranza es una foto al/.test(ptxt), "con los 3 dominios, el Marco nombra los TRES marcos, cada uno con su propio texto — nunca uno solo por los tres", ptxt);
  }
}

/* ═══ 20 · (2) EL UNIVERSO DEL PUESTO — error MATERIAL de universo: el denominador de "N° de M..." tiene que ser
 * el tamaño de un universo DECLARADO en `entrega.universos` (nunca la boleta capada de este turno) ═══════════ */
H("20 · (2) el denominador del puesto == tamaño de un universo declarado en entrega.universos");
{
  const res = validarEncargo({ version: "encargo/v1", partes: [{ id: "p1", tema: "cobranza", cierre: "lectura", entidades: [{ nombre: "Lider", eje: "cliente" }] }] }, {});
  const R = componerEntrega(res);
  ok(R.ok, "compone ok", R.motivo);
  if (R.ok) {
    const conclusion = R.entrega.respuesta[0].texto;
    const m = /(\d+)° de (\d+)/.exec(conclusion);
    ok(!!m, "la conclusión trae la forma \"N° de M\"", conclusion);
    if (m) {
      const total = Number(m[2]);
      // ★ CANDADO CENTRAL — la cartera del demo tiene 13 clientes: el denominador NUNCA puede ser 8 (la boleta
      // capada del agente, memoria `adi-piso-materialidad-cobranza`) — tiene que ser 13 (mesaFlujo/la proyección).
      ok(total === 13, "★ CARNADA · el denominador es 13 (la cartera completa vía mesaFlujo/rankings), NUNCA 8 (la boleta capada del agente)", conclusion);
      const universo = R.entrega.universos.find((u) => Array.isArray(u.entidades) && u.entidades.length === total && u.entidades.includes("Lider"));
      ok(!!universo, "★ existe un universo declarado en `entrega.universos` cuyo `entidades.length` es EXACTAMENTE el denominador del puesto", JSON.stringify(R.entrega.universos.map((u) => ({ id: u.id, n: (u.entidades || []).length }))));
    }
  }
  // el mismo candado en comercial — el conteo (5) tiene que calzar con un universo declarado
  const resC = validarEncargo({ version: "encargo/v1", partes: [{ id: "p1", tema: "comercial", cierre: "lectura", entidades: [{ nombre: "Lider", eje: "cliente" }] }] }, {});
  const RC = componerEntrega(resC);
  ok(RC.ok, "compone ok (comercial)", RC.motivo);
  if (RC.ok) {
    const conclusion = RC.entrega.respuesta[0].texto;
    const m = /(\d+)° de (\d+)/.exec(conclusion);
    ok(!!m, "la conclusión comercial trae la forma \"N° de M\"", conclusion);
    ok(/cuentas con contribuci[oó]n no capturada/.test(conclusion), "★ declara DE QUÉ UNIVERSO son esas N — \"cuentas con contribución no capturada\", nunca un número suelto", conclusion);
    if (m) {
      const total = Number(m[2]);
      const universo = RC.entrega.universos.find((u) => Array.isArray(u.entidades) && u.entidades.length === total && u.entidades.includes("Lider"));
      ok(!!universo, "existe un universo declarado cuyo tamaño calza con el denominador comercial", JSON.stringify(RC.entrega.universos.map((u) => ({ id: u.id, n: (u.entidades || []).length }))));
    }
  }
}

/* ═══ 21 · «Para su juicio» entre DOS partes comerciales de alcance distinto: UNIÓN, no intersección (supervisor
 * 2026-09-26, segunda vuelta — decisión explícita: «una entidad es legítima si está dentro del alcance de ALGUNA
 * parte comercial, porque cada parte es algo que el usuario pidió; exigir todas a la vez borraría entidades
 * pedidas»). `buildRolesCartera` propone SIEMPRE Falabella y Jumbo para el tenant demo (medido) — con `p1`
 * excluyendo solo a Jumbo y `p2` excluyendo solo a Falabella, cada entidad SÍ está dentro del alcance de LA OTRA
 * parte: con unión, ambas sobreviven (si el criterio fuera intersección, ninguna sobreviviría — las dos quedarían
 * fuera y la pregunta caería al representante genérico, que es justo el error que un criterio de AND introduce).
 * Control: cuando AMBAS partes excluyen a las DOS, ninguna sobrevive de verdad (fuera del alcance de TODAS) y la
 * pregunta cae al representante (`_entidadRepresentativaDeTema`), nunca a una entidad ajena al alcance. ═══════ */
H("21 · «Para su juicio» con dos partes comerciales — UNIÓN de alcances, nunca intersección");
{
  const _res2Comercial = (exA, exB) => validarEncargo({ version: "encargo/v1", partes: [
    { id: "p1", tema: "comercial", cierre: "cifra", conceptos: ["ventas"], universo: { eje: "cliente", excluir: { entidades: exA } } },
    { id: "p2", tema: "comercial", cierre: "cifra", conceptos: ["ventas"], universo: { eje: "cliente", excluir: { entidades: exB } } },
  ] }, {});
  // p1 excluye Jumbo (Falabella queda DENTRO de p1); p2 excluye Falabella (Jumbo queda DENTRO de p2) — cada una
  // pertenece al alcance de la OTRA parte, así que la unión las retiene a las DOS.
  const resUnion = _res2Comercial(["Jumbo"], ["Falabella"]);
  ok(resUnion.ok, "el encargo de 2 partes comerciales valida (caso unión)");
  const Runion = componerEntrega(resUnion);
  ok(Runion.ok, "compone ok (2 partes comerciales, alcances distintos)", Runion.motivo);
  if (Runion.ok) {
    const pa = Runion.entrega.paraSuJuicio.find((p) => p.sobre && /Falabella/.test(p.sobre.entidad || ""));
    ok(!!pa, "★ CARNADA · con alcances distintos por parte, la pregunta al dueño nombra a AMBAS (Falabella y Jumbo) — unión, no intersección", JSON.stringify(Runion.entrega.paraSuJuicio.map((p) => p.pregunta)));
    ok(!!pa && /Falabella/.test(pa.sobre.entidad) && /Jumbo/.test(pa.sobre.entidad), "★ las dos entidades, cada una dentro del alcance de UNA parte, aparecen juntas", pa && pa.sobre.entidad);
  }
  // control: las DOS partes excluyen a las DOS entidades — ninguna está dentro del alcance de NINGUNA parte, así
  // que la unión tampoco las retiene: cae al representante, nunca a Falabella/Jumbo (fuera de TODO alcance).
  const resNinguna = _res2Comercial(["Falabella", "Jumbo"], ["Falabella", "Jumbo"]);
  const Rninguna = componerEntrega(resNinguna);
  ok(Rninguna.ok, "compone ok (2 partes comerciales, ambas excluyen a las dos entidades)", Rninguna.motivo);
  if (Rninguna.ok) {
    const textoPJ = Rninguna.entrega.paraSuJuicio.map((p) => p.pregunta || "").join(" | ");
    ok(!/Falabella/.test(textoPJ) && !/Jumbo/.test(textoPJ), "★ CARNADA · fuera del alcance de LAS DOS partes, ninguna de las dos aparece (nunca «de ninguna, sí»)", textoPJ);
  }
}

/* ═══ 23 · EL LÍMITE «SIN SEÑAL DE RIESGO» ES DE NEGOCIO, NUNCA TÉCNICO NI UN NEGATIVO NO PROBADO (coordinador
 * 2026-09-27, cierre de R-INICIATIVA-UNIVERSO-NO-ENTIDADES / V81) ══════════════════════════════════════════════
 * Con el universo restringido al `top` de cada parte (`entrega/componer.js:figsDelGrupo`), un `decision`/`lectura`
 * multitema puede genuinamente no tener ninguna señal de riesgo (materialidad) para las cuentas pedidas —
 * `_planMultiTema` declara un límite en vez de tumbar la Entrega. Dos leyes sobre ESE texto: (a) nunca nombra un
 * archivo del código (ningún `.js` llega a la Entrega); (b) nunca afirma un negativo que la boleta no prueba — la
 * ley de materialidad del owner es señal · bajo el piso · sin evaluar, jamás «no tiene X»/«sin X» como si fuera un
 * hecho demostrado. */
H("22 · CARNADA · el límite «sin señal de riesgo» es de negocio (sin nombre de archivo, sin negativo no probado)");
{
  const encV81 = { version: "encargo/v1", partes: [
    { id: "p1", tema: "comercial", cierre: "decision", conceptos: ["ventas", "margen", "carga"], universo: { eje: "cliente", top: { metrica: "ventas", k: 3, direccion: "menor" } } },
    { id: "p2", tema: "cobranza", cierre: "decision", conceptos: ["saldo_pendiente", "saldo_vencido"], universo: { eje: "cliente", top: { metrica: "ventas", k: 3, direccion: "menor" } } },
  ], criterio: { lente: "credito" }, premisas: [
    { id: "q1", tipo: "estado", sujeto: "Unimarc", estado: "al dia" },
    { id: "q2", tipo: "orden", sujeto: "Unimarc", metrica: "saldo_pendiente", orden: { forma: "min" }, universo: { eje: "cliente" } },
  ] };
  const Rv81 = validarEncargo(encV81, {});
  const Ev81 = componerEntrega(Rv81);
  ok(Ev81.ok, "compone ok (universo de 3 cuentas sanas, sin señal de riesgo en ningún dominio)", Ev81.motivo);
  if (Ev81.ok) {
    const limSinSenal = (Ev81.entrega.limites || []).find((l) => /prioridad entre dominios/i.test(l.titulo || ""));
    ok(!!limSinSenal, "★ se declaró el límite «sin señal de riesgo» (nunca un silencio ni una Entrega vacía)", JSON.stringify(Ev81.entrega.limites));
    const textoCompleto = `${Ev81.texto} ${JSON.stringify(Ev81.entrega.limites)}`;
    ok(!/\.js\b/i.test(textoCompleto), "★ CARNADA · ningún nombre de archivo (ningún «.js») llega al texto de la Entrega ni a sus límites", textoCompleto.match(/[a-zA-Z0-9_]+\.js\b/gi));
    /* §7.3·52(b): el cero MEDIDO (la mesa de cobranza trae la fila de la cuenta y vale $0) se dice con su cifra: «no tiene saldo vencido ($0)» es un hecho demostrado y está en la tabla; lo que se prohíbe es el negativo SIN cifra ni fila */
    ok(!/no tiene saldo vencido(?! \(\$0\))|sin saldo vencido/i.test(textoCompleto),"★ CARNADA · nunca «no tiene saldo vencido» / «sin saldo vencido» — la ley de materialidad prohíbe el negativo no probado (señal · bajo el piso · sin evaluar)", textoCompleto);
    ok(!/ni tiene\b/i.test(limSinSenal && limSinSenal.motivo || ""), "★ el motivo del límite no afirma un negativo no probado", limSinSenal && limSinSenal.motivo);
    // las cifras de cobranza de esas cuentas (saldo pendiente, y su vencido si lo hay) siguen citables en la
    // Entrega — ninguna señal desaparece, aunque no arme una prioridad entre dominios.
    ok(/saldo pendiente/i.test(Ev81.texto), "★ el saldo pendiente de las cuentas sigue citado en la Entrega (ninguna cifra desaparece)", Ev81.texto.match(/saldo pendiente[^.]{0,20}/i));
  }
}

H("24 · CARNADA · §7.3·29 (SUPERVISOR, «declinar honestamente cuenta como éxito», X75) — un top «mayor» sobre un ranking parcial DECLINA la parte, pero la Entrega compone igual, con el límite declarado");
{
  // comercial por marca, top variación (default «mayor»): el dato solo trae variación de 4 de 5 marcas (Makita
  // sin año anterior) — «mayor» declina igual que «menor/peor/mejor» (RAÍZ A6, diagnóstico v10): nunca se sirve
  // un ganador no verificable. Hasta acá, sin cambios. Lo que SÍ cambió (decisión 29, supervisor 2026-09-28,
  // sobre esta misma aserción — la escribió un agente ANTES de la decisión, describía el comportamiento viejo):
  // con la ÚNICA parte del encargo declinada al componer, la Entrega ya no sale vacía (`ok:false`) — sale con
  // `ok:true`, el límite de esa parte en `entrega.limites` (ya no en `motivo`, que ahora solo existe si la
  // Entrega de verdad falla), el marco y las premisas verificadas. `ok:false` queda solo para una raíz inválida
  // o un error interno — nunca para esto.
  // Con premisas (mismo patrón que X75, catálogo v10): sin ellas, la parte declinada deja `entrega.respuesta`
  // vacía y cae en el OTRO `_vacia` de componer.js (línea ~3543, «ninguna parte produjo una oración con
  // evidencia» — un caso DISTINTO, fuera del alcance de la decisión 29, que sigue en `ok:false`: ver el reporte
  // al supervisor). Con las premisas, su veredicto («no verificable», el mismo ranking incompleto) SÍ entra a
  // `entrega.respuesta` — el camino real de X75.
  const encA6 = { version: "encargo/v1", partes: [
    { id: "p1", tema: "comercial", cierre: "decision", conceptos: ["variacion"], eje: "marca", universo: { eje: "marca", top: { metrica: "variacion", k: 1 } } },
  ], premisas: [
    { id: "q1", tipo: "orden", sujeto: "Bosch", metrica: "variacion", orden: { forma: "min" }, universo: { eje: "marca" } },
    { id: "q2", tipo: "orden", sujeto: "LG", metrica: "variacion", orden: { forma: "max" }, universo: { eje: "marca" } },
  ] };
  const RA6 = validarEncargo(encA6, {});
  ok(RA6.partes[0].estado === "resuelta", "la parte valida (el hueco es de DATO, no de forma)", JSON.stringify(RA6.partes[0]));
  const EA6 = componerEntrega(RA6);
  ok(EA6.ok === true, "★ §7.3·29 · la Entrega compone ok:true aunque su única parte se decline al armar (declinar honestamente cuenta como éxito, nunca una Entrega vacía)", EA6.ok ? "" : EA6.motivo);
  if (EA6.ok) {
    const limRanking = (EA6.entrega.limites || []).find((l) => /ranking parcial|no encontró evidencia/i.test(`${l.titulo} ${l.motivo}`));
    ok(!!limRanking, "★ el límite nombra el ranking incompleto, declarado en entrega.limites (ya no en motivo — no hay Entrega vacía que lo esconda)", JSON.stringify(EA6.entrega.limites));
    // (a) NUNCA se sirve un ganador no verificable: ninguna marca recibe cifra propia como sujeto de esta parte
    // (la tabla de Cifras queda vacía — la parte se declinó, no se sirvió con otro alcance) y ninguna oración de
    // prioridad («quien más pesa»/«prioridad del procedimiento», el patrón que arma un ganador) nombra una marca.
    ok(!(EA6.entrega.cifras.filas || []).length, "★ CARNADA · ninguna marca recibe cifra propia como sujeto de la parte declinada", JSON.stringify(EA6.entrega.cifras.filas));
    ok(!/quien m[aá]s pesa|prioridad del procedimiento/i.test(EA6.texto), "★ CARNADA · ninguna oración de prioridad nombra una marca como ganador", EA6.texto);
  }
}

H("25a · CARNADA · §7.3·26(a) forma MIXTA — el eje compartido cruza (2 comercial + 1 cobranza, cliente); inventario (sku) queda declarado FUERA");
{
  const enc26a = { version: "encargo/v1", partes: [
    { id: "p1", tema: "comercial", cierre: "decision", conceptos: ["carga"], universo: { eje: "cliente", top: { metrica: "carga", k: 1, direccion: "peor" } } },
    { id: "p2", tema: "comercial", cierre: "decision", conceptos: ["margen"], universo: { eje: "cliente", top: { metrica: "margen", k: 1, direccion: "peor" } } },
    { id: "p3", tema: "cobranza", cierre: "decision", conceptos: ["saldo_por_vencer"], universo: { eje: "cliente", estados: ["al dia"], top: { metrica: "saldo_por_vencer", k: 1 } } },
    { id: "p4", tema: "inventario", cierre: "decision", conceptos: ["capital"], universo: { eje: "sku", estados: ["riesgo de quiebre"], top: { metrica: "capital", k: 1 } } },
  ] };
  const R26a = validarEncargo(enc26a, {});
  const E26a = componerEntrega(R26a);
  ok(E26a.ok, "compone ok (forma mixta: 3 decisions por cliente + 1 por sku)", E26a.motivo);
  if (E26a.ok) {
    const universos = (E26a.entrega.universos || []).map((u) => u.id);
    ok(universos.includes("p1_p2_p3_prioridad"), "★ el grupo de eje CLIENTE (p1,p2,p3) cruzó — universo _prioridad declarado", JSON.stringify(universos));
    ok(!universos.some((id) => /^p1_p2_p3_p4_prioridad$|p4.*prioridad|prioridad.*p4/.test(id)), "★ el sku (p4) NUNCA entra en ESE universo _prioridad", JSON.stringify(universos));
    ok(/riesgo integrado/i.test(E26a.texto), "★ hay una oración de riesgo integrado (un ganador real, no un límite disfrazado)", E26a.texto.match(/[^.]*riesgo integrado[^.]*\./i));
    const limExcluido = (E26a.entrega.limites || []).find((l) => /no entra en la prioridad cruzada/i.test(l.titulo || ""));
    ok(!!limExcluido && /inventario/i.test(limExcluido.titulo), "★ CARNADA · se declara EXPLÍCITAMENTE que Inventario (otro eje) no entra en esta prioridad — nunca en silencio", JSON.stringify(limExcluido));
  }
}

H("25c · CARNADA · §7.3·26(c) ejes distintos — «no se establece una prioridad» aunque una parte resuelva vacía");
{
  // inventario con un filtro que no deja NINGÚN SKU (capital > 999999) + comercial con datos normales: la
  // elegibilidad depende del EJE PEDIDO (sku vs cliente), nunca de si una parte resolvió vacía o se declinó.
  const enc26c = { version: "encargo/v1", partes: [
    { id: "p1", tema: "inventario", cierre: "decision", conceptos: ["capital"], universo: { eje: "sku", estados: ["inmovilizado"], filtros: [{ metrica: "capital", op: ">", valor: 999999 }] } },
    { id: "p2", tema: "comercial", cierre: "decision", conceptos: ["ventas"], universo: { eje: "cliente", top: { metrica: "ventas", k: 2 } } },
  ] };
  const R26c = validarEncargo(enc26c, {});
  const E26c = componerEntrega(R26c);
  ok(E26c.ok, "compone ok (p1 resuelve un universo vacío por el filtro, p2 con datos normales)", E26c.motivo);
  if (E26c.ok) {
    const limSinCruce = (E26c.entrega.limites || []).find((l) => /no se establece una prioridad entre dominios/i.test(l.titulo || ""));
    ok(!!limSinCruce, "★ CARNADA · se declara «no se establece una prioridad» por EJES DISTINTOS, no por el universo vacío de p1", JSON.stringify(limSinCruce));
    ok(!/riesgo integrado/i.test(E26c.texto), "★ ningún ganador inventado entre sku y cliente", E26c.texto.match(/[^.]*riesgo integrado[^.]*\./i));
    const universos = (E26c.entrega.universos || []).map((u) => u.id);
    ok(universos.includes("p1") && universos.includes("p2"), "★ cada parte conserva su propio universo aunque no haya cruzada", JSON.stringify(universos));
  }
}

H("26a · CARNADA · §7.3·27 (SUPERVISOR) — dos decisions de SKU (comercial + inventario) NUNCA cruzan entre sí, aunque compartan la clave real");
{
  const enc27a = { version: "encargo/v1", partes: [
    { id: "p1", tema: "comercial", cierre: "decision", conceptos: ["ventas"], eje: "sku", universo: { eje: "sku", top: { metrica: "ventas", k: 1 } } },
    { id: "p2", tema: "inventario", cierre: "decision", conceptos: ["capital"], universo: { eje: "sku", top: { metrica: "capital", k: 1 } } },
  ] };
  const R27a = validarEncargo(enc27a, {});
  const E27a = componerEntrega(R27a);
  ok(E27a.ok, "compone ok (dos decisions por SKU, cada una con su propio top)", E27a.motivo);
  if (E27a.ok) {
    const universos = (E27a.entrega.universos || []).map((u) => u.id);
    ok(!universos.some((id) => /prioridad$/.test(id) && id !== "p1_prioridad" && id !== "p2_prioridad"), "★ CARNADA · NUNCA existe un universo «_prioridad» combinado para p1+p2 (SKU no cruza con SKU)", JSON.stringify(universos));
    ok(!/riesgo integrado/i.test(E27a.texto), "★ ninguna oración de «riesgo integrado» cruza los dos SKU", E27a.texto.match(/[^.]*riesgo integrado[^.]*\./i));
    const limSku = (E27a.entrega.limites || []).find((l) => /entre dos decisions de SKU no se cruza/i.test(l.motivo || ""));
    ok(!!limSku, "★ CARNADA · se declara EXPLÍCITAMENTE que dos decisions de SKU no cruzan — nunca en silencio", JSON.stringify(limSku));
  }
}

H("26b · CARNADA · §7.3·27 (SUPERVISOR) — mismo eje, un dominio resuelve VACÍO: no hay nada que cruzar y NO hace falta declarar nada (X28)");
{
  // cobranza con un filtro contradictorio (al día + días vencido > 0) resuelve 0 de 13 — comercial, con datos
  // normales, no tiene con quién cruzar: la ley dice silencio, no una declaración de «no se establece».
  const enc27b = { version: "encargo/v1", partes: [
    { id: "p1", tema: "cobranza", cierre: "decision", conceptos: ["dias_vencido", "saldo_vencido"], universo: { eje: "cliente", estados: ["al dia"], filtros: [{ metrica: "dias_vencido", op: ">", valor: 0 }] } },
    { id: "p2", tema: "comercial", cierre: "decision", conceptos: ["contribucion"], universo: { eje: "cliente", top: { metrica: "contribucion", k: 2 } } },
  ] };
  const R27b = validarEncargo(enc27b, {});
  const E27b = componerEntrega(R27b);
  ok(E27b.ok, "compone ok (p1 resuelve vacío por el filtro contradictorio, p2 con datos normales)", E27b.motivo);
  if (E27b.ok) {
    const universos = (E27b.entrega.universos || []).map((u) => ({ id: u.id, n: (u.entidades || []).length }));
    ok((universos.find((u) => u.id === "p1") || {}).n === 0, "p1 resuelve vacío (0 de 13), confirmado", JSON.stringify(universos));
    const limCruzada = (E27b.entrega.limites || []).find((l) => /no se establece una prioridad entre dominios/i.test(l.titulo || ""));
    ok(!limCruzada, "★ CARNADA · NINGÚN límite de «no se establece una prioridad» — con un dominio vacío, la ley pide silencio, no una declaración", JSON.stringify(limCruzada));
    ok(!/riesgo integrado/i.test(E27b.texto), "★ ningún ganador cruzado inventado", E27b.texto.match(/[^.]*riesgo integrado[^.]*\./i));
  }
}

H("27 · CARNADA · §7.3·28 (SUPERVISOR, ley de registro del owner) — un estado no reconocido NUNCA cita una palabra vetada del registro");
{
  // premisa tipo «estado» con una palabra de la lista de registro prohibida («dormido») en vez del nombre del
  // estado — la declinación tiene que nombrar el campo y ofrecer alternativas, NUNCA citar la palabra.
  const enc28 = { version: "encargo/v1", partes: [
    { id: "p1", tema: "cobranza", cierre: "cifra", conceptos: ["saldo_vencido"], entidades: [{ nombre: "Easy" }] },
  ], premisas: [
    { id: "q1", tipo: "estado", sujeto: "Easy", estado: "dormido" },
  ] };
  const R28 = validarEncargo(enc28, {});
  const E28 = componerEntrega(R28);
  ok(E28.ok, "compone ok (la parte p1 sirve; la premisa se declina)", E28.motivo);
  if (E28.ok) {
    ok(!/dormido/i.test(E28.texto), "★ CARNADA · «dormido» NUNCA aparece en el texto servido", E28.texto);
    ok(stripLanguageLeaks(E28.texto) === E28.texto, "★ CARNADA · stripLanguageLeaks no cambia nada — cero fuga de registro en toda la Entrega", stripLanguageLeaks(E28.texto));
    ok(/estado-desconocido/.test(E28.texto) && /los estados válidos son/.test(E28.texto), "★ la declinación nombra el campo y ofrece los estados válidos de la casa", E28.texto.match(/estado-desconocido[^*]*/));
  }
}

/* ═══ 23 · CERO red ═══════════════════════════════════════════════════════════════════════════════════════════ */
H("23 · CERO red — clasificarFuente(este gate) === offline");
{
  const fuente = fs.readFileSync("./_entrega_general_gate.mjs", "utf8");
  const c = clasificarFuente(fuente);
  ok(c.tipo === "offline", "clasificarFuente(_entrega_general_gate.mjs) === offline", JSON.stringify(c));
}

console.log(`\n── _entrega_general_gate: PASS ${pass} · FAIL ${fail} (de ${pass + fail}) ──`);
if (fail > 0) { console.log("\nFALLAS:\n" + fails.map((f) => "  · " + f).join("\n")); process.exit(1); }
