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
 *       lista, o cualquiera que lleve la MARCA ESTRUCTURAL de la oración de prioridad (`_prioridad`, `prioridad.js`: las
 *       oraciones «Prioridad del procedimiento…»/«Quien más pesa en el conjunto…»), es prioridad 0; el resto, su índice de aparición (medido: nunca hace falta
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
import { esOracionDePrioridad } from "./prioridad.js";   // FAMILIA 1 (consolidación): «cuál es la oración de prioridad» se lee de su marca estructural, no del texto

/** §7.3·49(g): las veces que un valor renderizado APARECE como valor en el texto — no como un trozo de otro número («4» no está en «$12.4M» ni en «14») ni de una palabra. Un hecho «esencial» lo es porque el texto dice SU valor; con la coincidencia por subcadena, el «4» de una cuenta de 4 unidades protegía su fila (y la partía de la entidad) solo porque otra cifra traía un 4. */
function _apariciones(texto, v) {
  const t = String(texto || ""), x = String(v);
  if (!x) return 0;
  const antes = /^[\p{L}\p{N}]/u.test(x) ? "(?<![\\p{L}\\p{N}.,])" : "";
  const despues = /\p{N}$/u.test(x) ? "(?![\\p{N}]|[.,]\\p{N})" : "(?![\\p{L}\\p{N}])";
  const re = new RegExp(antes + x.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + despues, "gu");
  return (t.match(re) || []).length;
}

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
  const texto = String(r.texto || "");
  const candidatos = [];   // hechos cuyo valor renderizado aparece literal en el texto, con ese valor
  for (const id of hechos) {
    const v = libro.porId && libro.porId.has(id) ? renderDe(libro, id) : null;
    if (v != null && _apariciones(texto, v) > 0) candidatos.push({ id, v }); else apoyo.push(id);
  }
  /* v24 (barrido familia iii): varios hechos pueden RENDERIZAR el mismo valor («$0» de cuatro bodegas o cuentas, «8d» de tres cuentas) y el texto decirlo UNA vez pegado a SU dueño: solo tantos hechos como veces aparece el valor en el texto son esenciales (los del dueño nombrado más temprano); los demás son apoyo. Antes, el «$0» de una cuenta protegía la fila de TODAS las empatadas en cero y la tabla superaba el tope de filas. */
  const porValor = new Map();
  for (const c of candidatos) { if (!porValor.has(c.v)) porValor.set(c.v, []); porValor.get(c.v).push(c); }
  for (const [v, grupo] of porValor) {
    const veces = _apariciones(texto, v);
    if (grupo.length <= veces) { for (const c of grupo) esenciales.push(c.id); continue; }
    const posDueno = (c) => { const h = libro.porId.get(c.id); const d = h && h.roles && h.roles.sujetos && h.roles.sujetos[0]; const p = d && d !== "negocio" ? texto.indexOf(String(d)) : -1; return p < 0 ? Infinity : p; };
    const ordenado = [...grupo].sort((a, b) => posDueno(a) - posDueno(b));
    ordenado.forEach((c, i) => { if (i < veces) esenciales.push(c.id); else apoyo.push(c.id); });
  }
  /* el orden original de los hechos se conserva (la salida no depende del agrupado) */
  { const orden = new Map(hechos.map((id, i) => [id, i])); esenciales.sort((a, b) => orden.get(a) - orden.get(b)); apoyo.sort((a, b) => orden.get(a) - orden.get(b)); }
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
  if (esOracionDePrioridad(item)) return 0;   // la conclusión del procedimiento: la marca estructural `_prioridad` (`prioridad.js`), no su texto
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

  /* §7.3·49(g): el corte entre Cifras y Detalle NUNCA parte una entidad — las filas de una misma entidad (en un mismo tema) viajan juntas. La clave es el dueño de la fila y su tema; una fila sin dueño no forma grupo */
  const _claveDeEntidad = (f) => { const v = f && f.valores ? f.valores : null; if (!v) return null; const e = v["Entidad / grupo"] != null ? v["Entidad / grupo"] : v.Entidad; return e == null ? null : `${e}::${v.Tema != null ? v.Tema : ""}`; };
  const _gruposDeEntidad = new Map();   // clave → [idx de fila, ...] en el orden de aparición
  filasOriginal.forEach((f, idx) => { const k = _claveDeEntidad(f); if (k == null) return; if (!_gruposDeEntidad.has(k)) _gruposDeEntidad.set(k, []); _gruposDeEntidad.get(k).push(idx); });
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
    /* §7.3·49(g): el relleno va por ENTIDADES ENTERAS en el orden de la prioridad (las filas de una entidad van juntas): las de una entidad protegida se completan, y después entra la siguiente entidad entera mientras quepa; la primera que no cabe corta el relleno (no se salta a una más chica de más abajo: el orden exhibido no se rompe) */
    for (const g of _gruposDeEntidad.values()) if (g.some((j) => filasServidasIdx.has(j))) for (const j of g) filasServidasIdx.add(j);
    for (const { idx } of ordenFilas) {
      if (filasServidasIdx.size >= topeFilas) break;
      if (filasServidasIdx.has(idx)) continue;
      const kI = _claveDeEntidad(filasOriginal[idx]);
      const faltan = (kI == null ? [idx] : _gruposDeEntidad.get(kI)).filter((j) => !filasServidasIdx.has(j));
      if (filasServidasIdx.size + faltan.length > topeFilas) break;
      for (const j of faltan) filasServidasIdx.add(j);
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

  // §7.3·21 (supervisor 2026-09-27, diagnóstico v9, RAÍZ C2) — la nota «N filas más en el detalle» (más abajo,
  // después del bucle) se agrega SOLO en "completa" cuando algo de `cifras.filas` quedó fuera — pero agregarla
  // DESPUÉS de que el bucle ya decidió qué entra podía empujar el render sobre `topeTexto` (medido: W25/W100,
  // 899/900 sin la nota, sobre el tope con ella — la nota misma violaba la ley que la motiva, «un top-N que no
  // declara su cola miente por omisión», CLAUDE.md §5). `_RESERVA_NOTA_COLA` es el costo MÁXIMO de esa nota en
  // palabras (constante: el número y el plural no cambian el conteo) — se suma a `palabras` en CADA vuelta en que
  // YA se sabe que al menos una fila quedará fuera (el llenado inicial, arriba, ya pudo haber recortado hasta
  // `topeFilas`), para que el bucle deje el hueco ANTES de terminar, nunca después.
  const _RESERVA_NOTA_COLA = 9;
  // BÚSQUEDA ITERATIVA (§B.2): mientras el render exceda el tope de palabras o de filas, se retira el ítem de
  // MENOR prioridad servido (el «más recortable» primero) — nunca el de aparición más tardía porque sí: es el
  // de prioridad más baja, EN EL ORDEN en que `ordenOraciones`/`ordenFilas` ya lo declaran.
  /* §7.3·49(g): ninguna entidad queda partida entre Cifras y Detalle. Una entidad servida a medias SIN fila protegida por una oración servida sale ENTERA al Detalle; con una fila protegida (su hecho lo cita una oración) se le agregan las filas que faltan (el bucle retira después entidades ENTERAS de menor prioridad si el tope de filas lo exige). Solo cuando no queda ninguna entidad entera que retirar se acepta partir una (`splitForzado`): el tope de tamaño manda, como siempre. */
  let splitForzado = false;
  const _alinearEntidades = (permiteAgregar) => {
    const hechosServidos = _hechosEsencialesServidos();
    for (const g of _gruposDeEntidad.values()) {
      const servidas = g.filter((j) => filasServidasIdx.has(j));
      if (!servidas.length || servidas.length === g.length) continue;
      if (servidas.some((j) => _filaTieneHechoServido(filasOriginal[j], hechosServidos))) { if (permiteAgregar) for (const j of g) filasServidasIdx.add(j); }
      else for (const j of servidas) filasServidasIdx.delete(j);
    }
  };
  let guard = respuestaOriginal.length + filasOriginal.length + 2;   // cota dura: nunca más iteraciones que ítems
  while (guard-- > 0) {
    _alinearEntidades(!splitForzado);
    const candidata = _construirCandidata();
    const texto = renderTexto(candidata, titulo, profundidad);
    const palabras = contarPalabras(texto);
    const yaRecortoFilas = filasServidasIdx.size < filasOriginal.length;
    // §7.3·21 precisada (SUPERVISOR, diagnóstico v10, raíz A3, X41-X45/X49/X50) — la reserva de presupuesto para
    // la nota de cola vale para LAS DOS profundidades, no solo «completa»: el propio comentario de más abajo
    // (§7.3·21 original) ya decía «un top-N que no declara su cola miente por omisión» sin excepción por
    // profundidad — antes, "breve" recortaba filas sin dejarle hueco a su propia nota (más corta) en el
    // presupuesto de 350 palabras, así que la nota nunca se llegó a escribir en el bucle de abajo.
    const reservaCola = yaRecortoFilas ? _RESERVA_NOTA_COLA : 0;
    const sobreTexto = (palabras + reservaCola) > topeTexto;
    const sobreFilas = candidata.cifras.filas.length > topeFilas;
    if (!sobreTexto && !sobreFilas) break;

    // se retira SIEMPRE lo de menor prioridad servida (nunca prioridad 0): primero una fila de Cifras no protegida
    // por doble colocación (baja el conteo de filas Y de palabras a la vez); si ya no queda ninguna fila
    // retirable, una oración no protegida (lo que a su vez puede liberar más filas en la próxima vuelta, al
    // encoger el conjunto de hechos esenciales servidos).
    let retirado = false;
    const hechosServidos = _hechosEsencialesServidos();
    const _grupoSinProtegidas = (idx) => { const k = _claveDeEntidad(filasOriginal[idx]); const g = k == null ? [idx] : _gruposDeEntidad.get(k); return g.every((j) => !filasServidasIdx.has(j) || !_filaTieneHechoServido(filasOriginal[j], hechosServidos)); };
    /* §7.3·49(g): se retira una entidad ENTERA (todas sus filas servidas), la de MENOR importancia: la que tiene su mejor fila más abajo en la prioridad (nunca una entidad importante porque una de sus filas sea la última de la tabla). Sin fila protegida en el grupo. */
    const _prioDeFila = new Map(ordenFilas.map(({ idx, prioridad }) => [idx, prioridad]));
    let _grupoRetirable = null;
    for (const [kG, g] of _gruposDeEntidad) {
      const servidas = g.filter((j) => filasServidasIdx.has(j));
      if (!servidas.length || servidas.some((j) => _filaTieneHechoServido(filasOriginal[j], hechosServidos))) continue;
      const mejor = Math.min(...servidas.map((j) => _prioDeFila.get(j)));
      if (!_grupoRetirable || mejor >= _grupoRetirable.mejor) _grupoRetirable = { k: kG, g, mejor };
    }
    const _filaEnteraRetirable = _grupoRetirable ? { idx: _grupoRetirable.g.filter((j) => filasServidasIdx.has(j))[0], grupo: _grupoRetirable.g } : ordenFilas.slice().reverse().find(({ idx }) => filasServidasIdx.has(idx) && _claveDeEntidad(filasOriginal[idx]) == null && !_filaTieneHechoServido(filasOriginal[idx], hechosServidos));
    /* una fila suelta de una entidad protegida se retira solo cuando no queda ninguna entidad entera que retirar (lo de siempre: antes de retirar una oración) */
    const filaRetirable = _filaEnteraRetirable || ordenFilas.slice().reverse().find(({ idx }) => filasServidasIdx.has(idx) && !_filaTieneHechoServido(filasOriginal[idx], hechosServidos));
    if (filaRetirable && !_filaEnteraRetirable) splitForzado = true;
    const oracionRetirable = ordenOraciones.slice().reverse().find(({ idx, prioridad }) => oracionesServidasIdx.has(idx) && prioridad > 0);

    if (filaRetirable) {
      if (filaRetirable.grupo) { for (const j of filaRetirable.grupo) filasServidasIdx.delete(j); } else filasServidasIdx.delete(filaRetirable.idx);
      retirado = true;
    }
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

  _alinearEntidades(!splitForzado);
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

  // §7.3·21 (supervisor 2026-09-27, diagnóstico v9, RAÍZ C2; precisada en el diagnóstico v10, RAÍZ A3) — «un
  // top-N que no declara su cola miente por omisión» (CLAUDE.md §5) vale también para el recorte por TAMAÑO, no
  // solo para el recorte por `top`, y SIN excepción por profundidad — el SELLO exige la declaración «falla SOLO
  // si `meta.recortoFilas > 0` y no hay ninguna», sin salvedad para "breve". Cuando este gobernador retira filas
  // de `cifras.filas` por presupuesto (nunca el CONJUNTO — `entrega.universos` no cambia de tamaño en este
  // corte, ver la cabecera del archivo), la tabla tiene que decir que el resto sigue vivo en
  // `entrega.detalle.filas`, con los MISMOS ids — nunca un recorte silencioso, en NINGUNA profundidad.
  // La única diferencia por profundidad es el LARGO de la nota, no si existe: en "completa" va la frase entera
  // (con «mismo conjunto»); en "breve" va la nota CORTA que el propio comentario original ya pedía («el conteo,
  // el destino y que el conjunto no cambió, sin la prosa larga») — 4 palabras, cabe sobrado en
  // `_RESERVA_NOTA_COLA` (9, ya reservada arriba para las dos profundidades). En "breve" la nota SÍ puede
  // convivir con `_esGuiaDeUsoGenerica`/`_defSinGuia` (`_textoDeLaEntrega`, componer.js): si es la única
  // definición no-guía, se imprime igual que cualquier otra; la estructura completa (`entrega.detalle.filas`)
  // sigue disponible siempre, con o sin la nota en el texto.
  // RAÍZ A3 precisada (SUPERVISOR, diagnóstico v10) — la heurística del medidor (`_colaDeclaradaEnTexto`, que el
  // propio SELLO documenta como «generosa, no estrecha») exige, en la MISMA línea que la palabra «detalle», una
  // idea de fila/conjunto/resto (`/\bfilas?\b|\bconjunto\b|\bresto\b|\brestantes?\b|\bquedan\b|\bsiguen\b/i`) —
  // una nota corta que diga SOLO «N más en el detalle.» no trae NINGUNA de esas palabras y no cuenta como
  // declarada. «Mismo conjunto» ya lo pedía el propio comentario original de esta ley («el conteo, el destino y
  // que el conjunto no cambió») — se mantiene esa cláusula en la nota breve (2 palabras más, sigue sobrando
  // presupuesto contra `_RESERVA_NOTA_COLA`) en vez de acortarla hasta perder la palabra que la hace verificable.
  let entregaConColaDeclarada = entregaGobernada;
  if (filasRecortadas.length && entregaGobernada.marco) {
    const notaCola = profundidad === "breve"
      ? `${filasRecortadas.length} más en el detalle (mismo conjunto).`
      : `${filasRecortadas.length} fila${filasRecortadas.length === 1 ? "" : "s"} más en el detalle (mismo conjunto).`;
    // regla 1 de verificar.js («cero cifras desnudas») — el conteo que la nota imprime tiene que estar en
    // `entrega.procedencia.cifrasImpresas` (la lista blanca de números que el compositor declaró), o el propio
    // candado que exige la cola declarada la marcaría como una cifra huérfana. Es un CONTEO real (`filasRecortadas.
    // length`, medido acá mismo, nunca inventado) — se declara igual que cualquier otro conteo de la Entrega
    // (`entrega/componer.js: cifrasImpresas.push(String(...))`, el mismo patrón, solo que desde este archivo).
    const procedencia = entregaGobernada.procedencia ? { ...entregaGobernada.procedencia, cifrasImpresas: [...(entregaGobernada.procedencia.cifrasImpresas || []), String(filasRecortadas.length)] } : entregaGobernada.procedencia;
    entregaConColaDeclarada = { ...entregaGobernada, marco: { ...entregaGobernada.marco, definiciones: [...(entregaGobernada.marco.definiciones || []), notaCola] }, ...(procedencia ? { procedencia } : {}) };
  }

  const detalle = {
    ...(entrega.detalle || {}),
    oraciones: oracionesRecortadas.map((r) => ({ texto: r.texto, hechos: r.hechos, solicitud: r.solicitud || "pedido" })),
    filas: filasRecortadas.map((f) => ({ ...f })),
  };

  const textoFinal = renderTexto(entregaConColaDeclarada, titulo, profundidad);
  const palabrasFinal = contarPalabras(textoFinal);
  // §7.3·33 (SUPERVISOR, 2026-09-28, diagnóstico v11 — «tamaño con contenido obligatorio») — cuando el bucle de
  // arriba llega a `if (!retirado) break;` sin haber podido bajar del tope (todo lo que quedó servido es prioridad
  // 0: premisas, definiciones, la conclusión de prioridad cruzada — NUNCA se retiran, ver `prioridadDe`), el
  // render final SIGUE sobre `topeTexto`. Antes esto se servía en silencio: `meta` no lo declaraba y
  // `verificarEntrega` (regla 8, `tope-de-tamano`) rechazaba la Entrega sin distinguir «hay contenido recortable
  // que no se recortó» de «no queda nada que recortar». `excedeTope` es la declaración de ese segundo caso — SOLO
  // es `true` cuando, tras agotar todo lo recortable (oraciones de prioridad DENTRO de cada universo y filas de
  // Cifras), el contenido obligatorio por sí solo sigue sobre el tope. El tope nunca se cumple borrando una
  // conclusión ni una premisa (regla del owner): se sirve completo y se declara el exceso, nunca se corta a la
  // fuerza ni se sirve oversized en silencio.
  const excedeTope = palabrasFinal > topeTexto;
  const meta = { profundidad, palabras: palabrasFinal, tope: topeTexto, topeFilas, filas: entregaGobernada.cifras.filas.length, recortoOraciones: oracionesRecortadas.length, recortoFilas: filasRecortadas.length, excedeTope };

  return { entrega: entregaConColaDeclarada, detalle, meta, texto: textoFinal };
}
