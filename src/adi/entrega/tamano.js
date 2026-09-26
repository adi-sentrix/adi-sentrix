/* === src/adi/entrega/tamano.js · TAMAÑO GOBERNADO (Corte 3d.3, `_ADI_DISENO_CORTE_3D.md` §B, owner 2026-09-25/26)
 * ══════════════════════════════════════════════════════════════════════════════════════════════════════════════
 * «La ESTRUCTURA sigue completa; lo que se gobierna es el TEXTO» — `entrega.procedencia.libro` (todo hecho
 * declarado y verificado) y `entrega.universos` (siempre pequeños, nunca recortados en este corte) no cambian de
 * tamaño con la profundidad; lo que SÍ se gobierna es qué de eso se SIRVE en `entrega.respuesta` y
 * `entrega.cifras.filas` — lo recortado va a `entrega.detalle`, con los MISMOS ids (nunca desaparece).
 *
 * `gobernarTamano(entrega, profundidad, renderTexto)` — «puro» en el sentido que importa acá: mismos argumentos,
 * mismo resultado, sin leer estado global ni tocar el motor. `renderTexto` es una función INYECTADA (la MISMA
 * `_textoDeLaEntrega` de `componer.js`) — se inyecta en vez de importarse para evitar un import circular
 * (`componer.js` → `tamano.js` → `componer.js`); dado un `entrega` candidato, `renderTexto` arma el markdown
 * final exactamente igual que hoy, así que gobernar contra el RENDER REAL (no una estimación de palabras) es
 * exacto — nunca hay drift entre lo que este archivo cuenta y lo que `verificar.js` audita después.
 *
 * ALGORITMO (§B.2, «por PRIORIDAD, no por aparición»):
 *   1 · cada oración de Respuesta y cada fila de Cifras ya trae `.prioridad` (asignada en fase 1 por
 *       `componer.js` — 0 = nunca recortable; números mayores = se recorta antes). Un ítem SIN `.prioridad`
 *       (las 4 rutas fijas, que no la declaran) recibe un FALLBACK acá mismo: la primera oración/fila de la
 *       lista, o cualquiera cuyo texto sea la fórmula canónica de la casa «Prioridad del procedimiento»/«Quien
 *       más pesa en el conjunto», es prioridad 0; el resto, su índice de aparición (medido: nunca hace falta
 *       para D08-D11, que hoy caben enteros bajo el tope — el fallback es defensivo, no ejercitado en el
 *       catálogo actual).
 *   2 · se ordena por prioridad ascendente (estable: a igual prioridad, gana el orden de aparición) y se agregan
 *       ítems uno a uno mientras el RENDER completo siga bajo el tope de palabras Y la tabla siga bajo el tope
 *       de filas — la BÚSQUEDA es iterativa (agregar de a uno, re-renderizar, medir) en vez de una estimación,
 *       así el resultado es EXACTO por construcción.
 *   3 · lo que entró se devuelve EN EL ORDEN ORIGINAL DE APARICIÓN (el lector nunca ve el ranking de prioridad,
 *       ve la Entrega en su orden de siempre) — candado del gate: una fila de prioridad artificialmente alta
 *       puesta PRIMERA en el array tiene que ser la PRIMERA en salir, aunque su posición original fuera la 1ª.
 *
 * PROTECCIÓN CRUZADA (regla 3 de verificar.js, doble colocación) — una oración de Respuesta puede citar más
 * hechos de los que NARRA literalmente (evidencia estructural de apoyo, no todo texto citado). Se distingue acá
 * `hechosEsenciales` (el id RENDERIZA un valor que aparece literal en `r.texto` — sin esos, la oración no dice lo
 * que dice) de `hechosDeApoyo` (el resto: declarados, pero no narrados). Al gobernar, una fila de Cifras se
 * PROTEGE si algún hecho ESENCIAL de una oración SERVIDA la cita; los hechos de apoyo NO fuerzan la
 * supervivencia de su fila — así una oración con 90 hechos de apoyo (un caso real medido: una simulación cuya
 * lectura de origen no acota por entidad, ver el informe) no obliga a servir 90 filas. */
import { renderDe } from "../notario/hechos.js";
import { contarPalabras, TOPE_BREVE, TOPE_COMPLETA, FILAS_BREVE_MAX, FILAS_COMPLETA_MAX } from "./verificar.js";

const _MARCADOR_CONCLUSION = /^Prioridad del procedimiento|^Quien m[aá]s pesa en el conjunto/;

/** hechosEsencialesDeOracion(r, libro) → { esenciales:[id,...], apoyo:[id,...] } — puro, sin efectos. Las
 *  oraciones «especiales» (premisa, definición, marca de iniciativa) no se dividen: TODOS sus hechos son
 *  esenciales (son estructuralmente simples, y partirlas no ahorra nada relevante). Una oración de INICIATIVA
 *  (`r._iniciativa`) TAMBIÉN va completa: sus ids `i*` viven en `libroIniciativa`, no en `libro` (así que jamás
 *  calzarían por sustring contra el `libro` principal — cortarlos a medias violaría «una señal nunca desaparece»,
 *  la ley de `_iniciativa_gate`: si una oración de iniciativa no cabe entera, se retira ENTERA a `detalle`, nunca
 *  se le podan ids sueltos por dentro). */
function hechosEsencialesDeOracion(r, libro) {
  const hechos = Array.isArray(r.hechos) ? r.hechos : [];
  if (r._premisa || r._definicion || r._marcaIniciativa || r._iniciativa || !libro) return { esenciales: hechos.slice(), apoyo: [] };
  const esenciales = [], apoyo = [];
  for (const id of hechos) {
    const v = libro.porId && libro.porId.has(id) ? renderDe(libro, id) : null;
    if (v != null && String(r.texto || "").includes(v)) esenciales.push(id); else apoyo.push(id);
  }
  // defensivo: si NINGÚN hecho calificó como esencial (ej. un render que no calzó por redondeo), se conserva el
  // primero como esencial — una oración nunca queda con doble colocación imposible de satisfacer por un desajuste de formato.
  if (!esenciales.length && hechos.length) { esenciales.push(hechos[0]); apoyo.splice(apoyo.indexOf(hechos[0]), 1); }
  return { esenciales, apoyo };
}

/** prioridadDe(item, idx) → number — el fallback documentado en la cabecera, para ítems sin `.prioridad` propia
 *  (las 4 rutas fijas). Nunca se usa si el ítem YA declara `.prioridad` (un número, incluido 0). */
function prioridadDe(item, idx) {
  if (typeof item.prioridad === "number") return item.prioridad;
  // «NUNCA se recorta»: premisas (Corte 3c pieza 3 — «sobre la premisa declarada por la empresa» es un negativo
  // obligatorio (renombrado en tercera persona en el corte 3e, `entrega/componer.js:_textoDePremisa`), no
  // una señal opcional) y definiciones (un encargo `cierre:"definicion"` NO TIENE otro contenido: recortarla
  // dejaría la Entrega vacía) — protegidas por el MISMO marcador estructural que ya usa `hechosEsencialesDeOracion`.
  if (item._premisa || item._definicion) return 0;
  if (typeof item.texto === "string" && _MARCADOR_CONCLUSION.test(item.texto)) return 0;
  return idx === 0 ? 0 : idx;
}

/** ordenParaRecorte(items) → [{ item, idx, prioridad }] ordenado por prioridad asc (estable). */
function ordenParaRecorte(items) {
  return items
    .map((item, idx) => ({ item, idx, prioridad: prioridadDe(item, idx) }))
    .sort((a, b) => a.prioridad - b.prioridad || a.idx - b.idx);
}

/** gobernarTamano(entrega, profundidad, renderTexto, titulo) → { entrega, detalle, meta }
 *  `renderTexto(entregaCandidata, titulo, profundidad) → string` — inyectado (ver la cabecera). El TERCER
 *  argumento (owner 2026-09-26, ronda final del corte) deja que `_textoDeLaEntrega` compacte por profundidad las
 *  partes que esta función NUNCA toca (límites, referencia del oficio, qué más puedo calcular) — la MISMA
 *  `profundidad` que gobierna qué oraciones/filas se sirven, para que el conteo de palabras que este archivo mide
 *  sea el REAL, ya compactado, nunca una estimación aparte. Devuelve una Entrega NUEVA (no muta la de entrada)
 *  con `respuesta`/`cifras.filas` gobernadas, más `detalle` (lo recortado, con sus MISMOS ids) y `meta`
 *  (profundidad, palabras finales, tope). En "completa" el resultado es byte-idéntico al de entrada salvo por
 *  `meta`/`detalle` (vacío) cuando todo cabe. */
export function gobernarTamano(entrega, profundidad, renderTexto, titulo) {
  const topeTexto = profundidad === "breve" ? TOPE_BREVE : TOPE_COMPLETA;
  const topeFilas = profundidad === "breve" ? FILAS_BREVE_MAX : FILAS_COMPLETA_MAX;
  const libro = entrega.procedencia && entrega.procedencia.libro;

  const respuestaOriginal = Array.isArray(entrega.respuesta) ? entrega.respuesta : [];
  const filasOriginal = (entrega.cifras && Array.isArray(entrega.cifras.filas)) ? entrega.cifras.filas : [];
  const esencialesPorOracion = respuestaOriginal.map((r) => hechosEsencialesDeOracion(r, libro));

  // candidatos ordenados por prioridad (mayor prioridad primero en la búsqueda de qué SERVIR)
  const ordenOraciones = ordenParaRecorte(respuestaOriginal);
  const ordenFilas = ordenParaRecorte(filasOriginal);

  // conjunto de índices de oración SERVIDOS — arranca con TODO adentro (el caso común: todo cabe bajo el tope,
  // cero recorte) y el bucle de abajo va RETIRANDO por prioridad, nunca al revés — arrancar solo con prioridad 0
  // dejaría afuera de entrada cualquier oración que no fuera la 1ª/la conclusión, aunque sobrara espacio de sobra.
  const oracionesServidasIdx = new Set(respuestaOriginal.map((_, idx) => idx));
  const filasServidasIdx = new Set();   // se decide DESPUÉS de fijar qué oraciones sobreviven (protección cruzada)

  const _hechosEsencialesServidos = () => { const s = new Set(); for (const idx of oracionesServidasIdx) for (const id of esencialesPorOracion[idx].esenciales) s.add(id); return s; };
  const _filaTieneHechoServido = (fila, hechosServidos) => (fila.hechos || []).some((id) => hechosServidos.has(id));

  // LLENADO INICIAL (una sola vez, ANTES de que el bucle de presupuesto empiece a retirar) — protección cruzada
  // MÁS relleno hasta `topeFilas` con las de mayor prioridad: el caso normal es "todo cabe, sirve lo más rico
  // posible hasta el tope". `topeFilas` acá es un TECHO para el llenado inicial, no una garantía de que 8 filas
  // quepan en el presupuesto de palabras (owner 2026-09-26, hallazgo real en D43: `_recalcularFilasServidas`
  // rellenaba OTRA VEZ hasta el tope cada vez que se retiraba una oración, deshaciendo el recorte de filas ya
  // logrado — la fila retirada por presupuesto volvía a entrar porque "sobraba cupo" bajo `topeFilas`).
  const _llenarFilasInicial = () => {
    const hechosServidos = _hechosEsencialesServidos();
    filasOriginal.forEach((f, idx) => { if (_filaTieneHechoServido(f, hechosServidos)) filasServidasIdx.add(idx); });
    for (const { idx } of ordenFilas) {
      if (filasServidasIdx.size >= topeFilas) break;
      filasServidasIdx.add(idx);
    }
  };
  _llenarFilasInicial();
  // ASEGURAR PROTECCIÓN CRUZADA (se llama DURANTE el recorte, cuando se retira una oración) — SOLO agrega lo que
  // la doble colocación exige para lo que sigue servido; NUNCA vuelve a rellenar hasta `topeFilas` ni revive una
  // fila que el bucle de presupuesto ya retiró a propósito. El tope de 8 es un MÁXIMO del llenado inicial, no una
  // meta a mantener mientras se recorta por presupuesto.
  const _asegurarProteccionCruzada = () => {
    const hechosServidos = _hechosEsencialesServidos();
    filasOriginal.forEach((f, idx) => { if (_filaTieneHechoServido(f, hechosServidos)) filasServidasIdx.add(idx); });
  };

  // regla 3 de verificar.js (doble colocación) exige que TODO hecho `ref` de cliente citado en una oración
  // SERVIDA esté también en alguna fila SERVIDA de Cifras — pero solo mira lo que quede en `r.hechos`, así que un
  // id de APOYO (no narrado, ver `hechosEsencialesDeOracion`) cuya fila se recortó debe salir TAMBIÉN de
  // `r.hechos` de la oración: no es una mentira («la oración ya no lo cita»), es la limpieza correspondiente al
  // recorte de su respaldo secundario. Un id ESENCIAL nunca se retira así — su fila está SIEMPRE protegida por
  // `_recalcularFilasServidas` (protección cruzada), así que nunca hace falta soltarlo.
  const _construirCandidata = () => {
    const hechosDeFilasServidas = new Set();
    filasOriginal.forEach((f, idx) => { if (filasServidasIdx.has(idx)) for (const id of (f.hechos || [])) hechosDeFilasServidas.add(id); });
    const respuesta = respuestaOriginal
      .map((r, idx) => {
        if (!oracionesServidasIdx.has(idx)) return null;
        const { esenciales } = esencialesPorOracion[idx];
        const esencialesSet = new Set(esenciales);
        const hechosOriginales = r.hechos || [];
        const hechosFinal = hechosOriginales.filter((id) => esencialesSet.has(id) || hechosDeFilasServidas.has(id));
        return hechosFinal.length === hechosOriginales.length ? r : { ...r, hechos: hechosFinal };
      })
      .filter(Boolean);
    const filas = filasOriginal
      .map((f, idx) => (filasServidasIdx.has(idx) ? f : null))
      .filter(Boolean);
    return { ...entrega, respuesta, cifras: { ...entrega.cifras, filas } };
  };

  // BÚSQUEDA ITERATIVA (§B.2): mientras el render exceda el tope de palabras o de filas, se retira el ítem de
  // MENOR prioridad servido (el «más recortable» primero) — nunca el de aparición más tardía porque sí: es el
  // de prioridad más baja, EN EL ORDEN en que `ordenOraciones`/`ordenFilas` ya lo declaran.
  let guard = respuestaOriginal.length + filasOriginal.length + 2;   // cota dura: nunca más iteraciones que ítems
  while (guard-- > 0) {
    const candidata = _construirCandidata();
    const texto = renderTexto(candidata, titulo, profundidad);
    const palabras = contarPalabras(texto);
    const sobreTexto = palabras > topeTexto;
    const sobreFilas = candidata.cifras.filas.length > topeFilas;
    if (!sobreTexto && !sobreFilas) break;

    // se retira SIEMPRE lo de menor prioridad servida (nunca prioridad 0): primero una fila de Cifras no protegida
    // por doble colocación (baja el conteo de filas Y de palabras a la vez); si ya no queda ninguna fila
    // retirable, una oración no protegida (lo que a su vez puede liberar más filas en la próxima vuelta, al
    // encoger el conjunto de hechos esenciales servidos).
    let retirado = false;
    const hechosServidos = _hechosEsencialesServidos();
    const filaRetirable = ordenFilas.slice().reverse().find(({ idx }) => filasServidasIdx.has(idx) && !_filaTieneHechoServido(filasOriginal[idx], hechosServidos));
    const oracionRetirable = ordenOraciones.slice().reverse().find(({ idx, prioridad }) => oracionesServidasIdx.has(idx) && prioridad > 0);

    if (filaRetirable) { filasServidasIdx.delete(filaRetirable.idx); retirado = true; }
    else if (oracionRetirable) {
      // ATOMICIDAD DE BLOQUE (owner 2026-09-26, hallazgo real al gobernar D27 en "breve": el encabezado de un
      // bloque de simulación sobrevivía solo, sin su cuerpo — un encabezado sin resultado no dice nada). Una
      // oración con `_bloqueId` NUNCA se retira sola: se retira TODO el bloque junto (mismo `_bloqueId`), aunque
      // eso retire de un golpe más de lo estrictamente necesario para esta vuelta — nunca un bloque partido.
      const bId = respuestaOriginal[oracionRetirable.idx]._bloqueId;
      if (bId) respuestaOriginal.forEach((r, idx) => { if (r._bloqueId === bId) oracionesServidasIdx.delete(idx); });
      else oracionesServidasIdx.delete(oracionRetirable.idx);
      _asegurarProteccionCruzada();
      retirado = true;
    }

    if (!retirado) break;   // no queda nada recortable (todo lo servido es prioridad 0 / doble-colocación) — mejor esfuerzo
  }

  let entregaGobernada = _construirCandidata();
  // en el orden ORIGINAL de aparición — ya lo están, porque `_construirCandidata` filtra sobre el array original
  // sin reordenar (candado §B.2: "devuelve al orden original de aparición lo que quedó").

  // regla 12 de verificar.js (iniciativa-sin-ubicar) exige que TODO id de `entrega.iniciativa.ids` esté citado en
  // Respuesta o en la oferta — si una oración ENTERA de iniciativa se recortó (nunca a medias, ver
  // `hechosEsencialesDeOracion`), sus ids salen de `ids` acá: la señal no «desaparece», queda en
  // `detalle.oraciones` (con `solicitud:"iniciativa"`, recuperable por `comoPedirlo`) — la MISMA garantía que ya
  // cubre `detalle.iniciativaNoVerificada` para una señal que nunca llegó a verificar.
  if (entrega.iniciativa && Array.isArray(entrega.iniciativa.ids)) {
    const citadosEnRespuesta = new Set();
    for (const r of entregaGobernada.respuesta) if (r.solicitud === "iniciativa") for (const id of (r.hechos || [])) citadosEnRespuesta.add(id);
    const enOferta = new Set(entrega.iniciativa.ofertaIds || []);
    entregaGobernada = { ...entregaGobernada, iniciativa: { ...entrega.iniciativa, ids: entrega.iniciativa.ids.filter((id) => citadosEnRespuesta.has(id) || enOferta.has(id)) } };
  }

  // limpieza cosmética: si TODA la iniciativa que seguía a la marca (`_marcaIniciativa`) se recortó, la marca
  // queda colgada sola (un encabezado sin contenido) — se retira también. Nunca al revés: una marca servida con
  // al menos una oración de iniciativa detrás se queda, aunque esa oración esté más lejos que el tope de índice.
  if (entregaGobernada.respuesta.some((r) => r._marcaIniciativa)) {
    const hayIniciativaServida = entregaGobernada.respuesta.some((r) => r._iniciativa);
    if (!hayIniciativaServida) entregaGobernada = { ...entregaGobernada, respuesta: entregaGobernada.respuesta.filter((r) => !r._marcaIniciativa) };
  }

  const oracionesRecortadas = respuestaOriginal.filter((_, idx) => !oracionesServidasIdx.has(idx));
  const filasRecortadas = filasOriginal.filter((_, idx) => !filasServidasIdx.has(idx));

  const detalle = {
    ...(entrega.detalle || {}),
    oraciones: oracionesRecortadas.map((r) => ({ texto: r.texto, hechos: r.hechos, solicitud: r.solicitud || "pedido" })),
    filas: filasRecortadas.map((f) => ({ ...f })),
  };

  const textoFinal = renderTexto(entregaGobernada, titulo, profundidad);
  const meta = { profundidad, palabras: contarPalabras(textoFinal), tope: topeTexto, topeFilas, filas: entregaGobernada.cifras.filas.length, recortoOraciones: oracionesRecortadas.length, recortoFilas: filasRecortadas.length };

  return { entrega: entregaGobernada, detalle, meta, texto: textoFinal };
}
