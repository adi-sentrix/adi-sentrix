/* === ingesta/ingestarLibro.js · EL RECORRIDO COMPLETO, Y LA PREVIEW QUE LO DECLARA (vía 2 · paso 1) ===========
 *
 * Ata las tres piezas —leer, mapear, normalizar— y produce dos cosas: el dataset con forma de tenant, y una
 * **preview** que dice qué entró, qué no, y qué no se pudo decidir.
 *
 * LA PREVIEW ES LA MITAD DEL ENTREGABLE, no un adorno de debug. Un pipeline de ingesta que devuelve «listo, 13
 * filas» es exactamente lo que este proyecto no quiere: si el archivo trajo la venta pero no el costo, ADI va a
 * declinar media docena de preguntas y el usuario tiene que enterarse ANTES, no cuando pregunte. Por eso la
 * preview separa tres cosas que suelen ir mezcladas:
 *   · lo que ENTRÓ (con qué columna se mapeó cada campo y por qué)
 *   · lo que FALTA y su COSTO (qué deja de poder responderse)
 *   · lo que NO SE PUDO DECIDIR (ambiguo o sin resolver) — que es, literalmente, el trabajo que más adelante
 *     propone un modelo y confirma una persona
 *
 * NADA DE ESTO LLAMA A UN MODELO NI SALE A LA RED. Determinístico de punta a punta.
 */
import { leerLibro } from "./leerLibro.js";
import { proponerMapeo, elegirEje } from "./mapeoDeterministico.js";
import { normalizarEje, construirDataset } from "./normalizar.js";

/* ingestarLibro(archivo, { id, nombre, nombreArchivo, unidadesConfirmadas, ejePorHoja })
 *   · `unidadesConfirmadas` — el cerrojo: sin `true` no se normaliza un solo número.
 *   · `ejePorHoja` — { "Nombre de hoja": "skuInventario" } para forzar el eje cuando la hoja es ambigua.
 * Devuelve { ok, dataset, preview, bloqueos } · con ok:false el dataset es null y los bloqueos dicen por qué. */
export function ingestarLibro(archivo, { id, nombre, nombreArchivo = "", unidadesConfirmadas = false, ejePorHoja = {} } = {}) {
  const libro = leerLibro(archivo, { nombreArchivo });
  const hojas = [], ejes = {};
  const bloqueos = [], avisos = [];

  for (const hoja of libro.hojas) {
    const forzado = ejePorHoja[hoja.nombre] || null;
    const eleccion = forzado ? { eje: forzado, motivo: null, candidatos: [forzado] } : elegirEje({ encabezados: hoja.encabezados });

    if (!eleccion.eje) {
      hojas.push({ hoja: hoja.nombre, eje: null, motivo: eleccion.motivo, candidatos: eleccion.candidatos,
        filasLeidas: hoja.filas.length, encabezados: hoja.encabezados });
      avisos.push({ tipo: "hoja-sin-eje", detalle: `"${hoja.nombre}": ${eleccion.motivo}` });
      continue;
    }

    const prop = proponerMapeo({ eje: eleccion.eje, encabezados: hoja.encabezados });
    const norm = normalizarEje({ eje: eleccion.eje, filas: hoja.filas, mapeo: prop.mapeo, unidadesConfirmadas });

    hojas.push({
      hoja: hoja.nombre,
      eje: eleccion.eje,
      ejeForzado: !!forzado,
      filasLeidas: hoja.filas.length,
      filasNormalizadas: norm.filas.length,
      mapeo: Object.entries(prop.mapeo).map(([campo, m]) => ({ campo, columna: m.columna, via: m.via, unidad: m.unidad })),
      ambiguas: prop.ambiguas,
      faltantes: prop.faltantes,
      opcionalesAusentes: prop.opcionalesAusentes,
      sinResolver: prop.sinResolver,
      unidadesAConfirmar: prop.unidades,
      bloqueos: norm.bloqueos,
      avisos: norm.avisos,
    });

    for (const b of [...prop.faltantes.map((f) => ({ tipo: "columna-obligatoria-ausente", detalle: `${eleccion.eje}.${f.campo} (${f.unidad})`, hoja: hoja.nombre })),
                     ...prop.ambiguas.map((a) => ({ tipo: "columna-ambigua", detalle: `${eleccion.eje}.${a.campo}: la reclaman ${a.columnas.map((c) => `"${c}"`).join(" y ")}`, hoja: hoja.nombre })),
                     ...norm.bloqueos.map((b2) => ({ ...b2, hoja: hoja.nombre }))]) bloqueos.push(b);
    for (const a of norm.avisos) avisos.push({ ...a, hoja: hoja.nombre });

    if (norm.ok && norm.filas.length) ejes[eleccion.eje] = (ejes[eleccion.eje] || []).concat(norm.filas);
  }

  if (bloqueos.length) {
    return { ok: false, dataset: null, bloqueos, preview: { archivo: nombreArchivo || "(sin nombre)", formato: libro.formato, hojas, ausentes: [], avisos, bloqueos, totales: null } };
  }

  const construido = construirDataset({ id, nombre, ejes });
  if (!construido.ok) {
    return { ok: false, dataset: null, bloqueos: construido.bloqueos,
      preview: { archivo: nombreArchivo || "(sin nombre)", formato: libro.formato, hojas, ausentes: [], avisos, bloqueos: construido.bloqueos, totales: null } };
  }

  const d = construido.dataset;
  const suma = (arr, campo) => arr.reduce((s, r) => s + (typeof r[campo] === "number" ? r[campo] : 0), 0);
  const totales = {
    clientes: d.clientesVentas.length || d.clientesMargen.length,
    skusInventario: d.skuInventario.length,
    skusMargen: d.skusMargen.length,
    ventaClientes: d.clientesVentas.length ? suma(d.clientesVentas, "actual") : (d.clientesMargen.length ? suma(d.clientesMargen, "venta") : null),
    capitalInventario: d.skuInventario.length ? suma(d.skuInventario, "stockUSD") : null,
    marcas: d.MARCAS_ALL.length,
    familias: Math.max(0, d.SUPERFAMILIAS.length - 1),   // «Todas» no es una familia
    bodegas: d.SUCURSALES.length,
  };

  return {
    ok: true,
    dataset: d,
    bloqueos: [],
    preview: { archivo: nombreArchivo || "(sin nombre)", formato: libro.formato, hojas, ausentes: construido.ausentes, avisos, bloqueos: [], totales },
  };
}

/** La preview en texto — para mirarla en consola sin armar pantalla. Misma información, sin adornos. */
export function previewEnTexto(preview) {
  const L = [];
  const n = (x) => (typeof x === "number" ? x.toLocaleString("es-CL") : "—");
  L.push(`ARCHIVO: ${preview.archivo}  ·  formato: ${preview.formato}`);

  for (const h of preview.hojas) {
    L.push("");
    if (!h.eje) {
      L.push(`  HOJA "${h.hoja}" · SIN EJE — ${h.motivo}`);
      L.push(`    columnas: ${h.encabezados.join(" · ")}`);
      continue;
    }
    L.push(`  HOJA "${h.hoja}" → eje ${h.eje}${h.ejeForzado ? " (forzado)" : ""} · ${h.filasNormalizadas}/${h.filasLeidas} filas`);
    for (const m of h.mapeo) L.push(`    ✓ ${m.campo.padEnd(14)} ← "${m.columna}"  (${m.via}${m.unidad ? ` · ${m.unidad}` : ""})`);
    for (const a of h.ambiguas) L.push(`    ⚠ AMBIGUA · ${a.campo}: la reclaman ${a.columnas.map((c) => `"${c}"`).join(" y ")} — decide una persona`);
    for (const f of h.faltantes) L.push(`    ✗ FALTA (obligatoria) · ${f.campo}${f.unidad ? ` (${f.unidad})` : ""}`);
    if (h.sinResolver.length) L.push(`    · sin resolver (${h.sinResolver.length}): ${h.sinResolver.join(" · ")}`);
    if (h.opcionalesAusentes.length) L.push(`    · opcionales ausentes (${h.opcionalesAusentes.length}): ${h.opcionalesAusentes.map((o) => o.campo).join(" · ")}`);
    for (const a of h.avisos) L.push(`    · ${a.detalle}`);
  }

  if (preview.bloqueos.length) {
    L.push("", "  NO SE CARGÓ. Bloqueantes:");
    for (const b of preview.bloqueos) L.push(`    ✗ [${b.tipo}] ${b.detalle}`);
    return L.join("\n");
  }

  const t = preview.totales;
  L.push("", "  LO QUE ENTRÓ:");
  L.push(`    clientes ${n(t.clientes)}  ·  SKU inventario ${n(t.skusInventario)}  ·  SKU margen ${n(t.skusMargen)}`);
  L.push(`    marcas ${n(t.marcas)}  ·  familias ${n(t.familias)}  ·  bodegas ${n(t.bodegas)}`);
  if (t.ventaClientes !== null) L.push(`    venta sumada de clientes: ${n(t.ventaClientes)}`);
  if (t.capitalInventario !== null) L.push(`    capital en inventario: ${n(t.capitalInventario)}`);

  L.push("", "  LO QUE NO TRAE ESTE ARCHIVO (y qué deja de poder responderse):");
  for (const a of preview.ausentes) L.push(`    · ${a.que} → ${a.costo}`);
  return L.join("\n");
}
