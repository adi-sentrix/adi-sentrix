/* === ingesta/mapeoDeterministico.js · LO OBVIO SE RESUELVE SOLO; LO DEMÁS SE DECLARA (vía 2 · paso 1) =========
 *
 * Toma los encabezados de una hoja y dice qué columna es qué campo del contrato — **sin modelo y sin adivinar**.
 * Resuelve dos casos y nada más: el nombre del campo tal cual, o un sinónimo DECLARADO en el contrato
 * (`config/contract/ingestaColumnas.js`). Cualquier otra cosa sale reportada como sin resolver.
 *
 * ESA RENUNCIA ES EL DISEÑO, no una limitación temporal. Un mapeador que se esfuerza —parecido de strings,
 * distancia de edición, «se parece bastante a costo»— acierta el 90% y falla el 10% EN SILENCIO, y una columna
 * mal mapeada es una cifra con dueño equivocado, que es el error más caro que este producto puede cometer.
 * Preferimos una lista corta de «no supe» que un humano resuelve en diez segundos.
 *
 * TRES COSAS QUE ESTE MÓDULO REPORTA Y NUNCA DECIDE:
 *   · **ambiguo** — dos columnas reclaman el mismo campo («Venta» y «Ventas» en la misma hoja). No se elige por
 *     orden ni por la primera: se declaran las dos y no se mapea ninguna. Elegir sería inventar.
 *   · **faltante** — un campo obligatorio del eje que ninguna columna cubre. Es BLOQUEANTE: sin él el eje no existe.
 *   · **sin resolver** — columnas que el contrato no reconoce. NO es bloqueante: es la lista de trabajo que más
 *     adelante le vamos a dar al modelo para que PROPONGA y a una persona para que CONFIRME.
 *
 * Y la unidad NUNCA se infiere: se toma DECLARADA del schema del contrato y viaja en la propuesta para que se
 * confirme antes de normalizar. Es la lección de miles-vs-dólares, hecha mecanismo.
 */
import { SOURCES } from "../config/contract/sourceManifest.js";
import { SINONIMOS, SINONIMOS_POR_EJE, REQUERIDAS, EJES_SOPORTADOS, normalizarEncabezado, esPorcentaje } from "../config/contract/ingestaColumnas.js";

/* El índice forma normalizada → LISTA de campos que la reclaman. Es una lista y no un valor único a propósito:
 * «Rebate %» y «Rebates» se normalizan igual, y quedarse con el último que se escribió en la tabla sería elegir
 * por orden de declaración — el mismo bug de `Object.fromEntries` que ya costó caro en este repo (CLAUDE.md §4:
 * «Margen» y «Ventas» declarados dos veces, ganaba el último, y un ranking salía sellado sobre la lista
 * equivocada). Acá la colisión se conserva y la resuelve la pista de unidad, o se declara. */
function formasPorCampo(eje) {
  const schema = (SOURCES[eje] && SOURCES[eje].schema) || {};
  const propios = (SINONIMOS_POR_EJE[eje] || {});
  const idx = new Map();
  const propiosDelEje = new Set();   // formas que SOLO este eje declara — pesan más al elegir hoja (ver elegirEje)
  const agregar = (forma, campo) => {
    const k = normalizarEncabezado(forma);
    if (!k) return;
    if (!idx.has(k)) idx.set(k, []);
    if (!idx.get(k).includes(campo)) idx.get(k).push(campo);
  };
  for (const campo of Object.keys(schema)) {
    agregar(campo, campo);
    for (const s of SINONIMOS[campo] || []) agregar(s, campo);
    for (const s of propios[campo] || []) { agregar(s, campo); propiosDelEje.add(normalizarEncabezado(s)); }
  }
  idx._propios = propiosDelEje;
  return idx;
}

/* Resuelve una colisión con la pista que dejó el humano en el encabezado: si escribió «%», quiere la TASA; si no,
 * quiere la magnitud. Solo desempata entre candidatos que ya reclamaron esa forma — nunca inventa uno nuevo. */
function resolverPorUnidad(candidatos, encabezado, schema) {
  if (candidatos.length <= 1) return candidatos;
  const quierePct = esPorcentaje(encabezado);
  const filtrados = candidatos.filter((c) => (String(schema[c] || "") === "pct") === quierePct);
  return filtrados.length === 1 ? filtrados : (filtrados.length ? filtrados : candidatos);
}

/** La unidad DECLARADA de un campo, tal cual la escribe el contrato (`money(K)`, `pct`, `count`, …). */
export const unidadDeclarada = (eje, campo) => ((SOURCES[eje] && SOURCES[eje].schema) || {})[campo] || null;

/* proponerMapeo({ eje, encabezados }) → la propuesta COMPLETA, con todo lo que no pudo resolver a la vista.
 *   {
 *     eje, ok,                       // ok = no hay faltantes obligatorios ni ambigüedades
 *     mapeo:        { campo: { columna, via, unidad } },
 *     ambiguas:     [{ campo, columnas: [...] }],
 *     faltantes:    [{ campo, unidad }],          // obligatorias que nadie cubre → BLOQUEANTE
 *     opcionalesAusentes: [{ campo, unidad }],    // se declaran como límite, no se rellenan
 *     sinResolver:  [columna, …],                 // el trabajo para el modelo + humano, más adelante
 *     unidades:     [{ campo, columna, unidad }], // lo que hay que CONFIRMAR antes de normalizar
 *   }
 */
export function proponerMapeo({ eje, encabezados = [] } = {}) {
  if (!EJES_SOPORTADOS.includes(eje)) {
    return { eje, ok: false, mapeo: {}, ambiguas: [], faltantes: [], opcionalesAusentes: [], sinResolver: [...encabezados], unidades: [],
      motivo: `este paso no sabe construir el eje "${eje}" (sabe: ${EJES_SOPORTADOS.join(", ")})` };
  }
  const idx = formasPorCampo(eje);
  const schema = SOURCES[eje].schema || {};
  const obligatorias = REQUERIDAS[eje] || [];

  // 1 · cada encabezado pide su campo · una forma que reclaman dos campos se desempata por la pista de unidad
  const candidatosPorCampo = new Map();
  const sinResolver = [], indecisas = [];
  for (const enc of encabezados) {
    const posibles = idx.get(normalizarEncabezado(enc));
    if (!posibles || !posibles.length) { sinResolver.push(enc); continue; }
    const resueltos = resolverPorUnidad(posibles, enc, schema);
    if (resueltos.length > 1) { indecisas.push({ columna: enc, campos: resueltos }); continue; }
    const campo = resueltos[0];
    if (!candidatosPorCampo.has(campo)) candidatosPorCampo.set(campo, []);
    candidatosPorCampo.get(campo).push(enc);
  }

  // 2 · el que tiene DOS pretendientes no se resuelve: se declara
  const mapeo = {}, ambiguas = [];
  for (const ind of indecisas) ambiguas.push({ campo: ind.campos.join(" | "), columnas: [ind.columna], motivo: `la columna "${ind.columna}" podría ser ${ind.campos.join(" o ")} y el encabezado no lo aclara` });
  for (const [campo, cols] of candidatosPorCampo) {
    if (cols.length > 1) { ambiguas.push({ campo, columnas: cols }); continue; }
    const col = cols[0];
    const k = normalizarEncabezado(col);
    mapeo[campo] = {
      columna: col,
      via: k === normalizarEncabezado(campo) ? "nombre exacto"
        : (idx._propios && idx._propios.has(k)) ? "sinónimo propio del eje"
        : "sinónimo declarado",
      unidad: schema[campo] || null,
    };
  }

  // 3 · lo que falta, separando lo que rompe de lo que solo limita
  const faltantes = obligatorias.filter((c) => !mapeo[c]).map((c) => ({ campo: c, unidad: schema[c] || null }));
  const opcionalesAusentes = Object.keys(schema)
    .filter((c) => !mapeo[c] && !obligatorias.includes(c))
    .map((c) => ({ campo: c, unidad: schema[c] || null }));

  // 4 · las unidades que hay que confirmar: solo las que TIENEN escala (un `string` no se confirma)
  const unidades = Object.entries(mapeo)
    .filter(([, m]) => m.unidad && !/^string$|^enum\(/.test(m.unidad))
    .map(([campo, m]) => ({ campo, columna: m.columna, unidad: m.unidad }));

  return { eje, ok: faltantes.length === 0 && ambiguas.length === 0, mapeo, ambiguas, faltantes, opcionalesAusentes, sinResolver, unidades };
}

/* elegirEje({ encabezados }) → qué eje describe mejor esta hoja, o null si ninguno cierra.
 * Se decide por CUÁNTAS obligatorias cubre, no por el nombre de la hoja: un archivo puede llamar «Datos» a
 * cualquier cosa, pero si trae SKU + capital + rotación + días + estado, es inventario. Empate ⇒ null (no se
 * elige por orden: se declara que la hoja es ambigua y decide un humano). */
export function elegirEje({ encabezados = [] } = {}) {
  const puntajes = EJES_SOPORTADOS.map((eje) => {
    const p = proponerMapeo({ eje, encabezados });
    // «propios» = columnas que este eje reclama con un sinónimo QUE SOLO ÉL DECLARA («Producto» para productos,
    // «Cuenta» para clientes). Pesan más que el conteo de campos: una hoja de margen por cuenta y una de margen
    // por producto tienen el MISMO schema, y lo único que las distingue de verdad es cómo llamaron a la clave.
    const propios = Object.values(p.mapeo).filter((m) => m.via === "sinónimo propio del eje").length;
    return { eje, completo: p.ok, campos: Object.keys(p.mapeo).length, propios };
  }).filter((x) => x.completo);
  if (!puntajes.length) return { eje: null, motivo: "ninguna hoja cubre las columnas obligatorias de un eje conocido", candidatos: [] };
  puntajes.sort((a, b) => (b.propios - a.propios) || (b.campos - a.campos));
  const empate = puntajes.length > 1 && puntajes[0].propios === puntajes[1].propios && puntajes[0].campos === puntajes[1].campos;
  if (empate) {
    return { eje: null, motivo: "la hoja encaja igual de bien en más de un eje — lo decide una persona", candidatos: puntajes.map((p) => p.eje) };
  }
  return { eje: puntajes[0].eje, motivo: null, candidatos: puntajes.map((p) => p.eje) };
}
