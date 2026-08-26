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
import { disponibilidadSentrix } from "./disponibilidad.js";

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
    preview: {
      archivo: nombreArchivo || "(sin nombre)", formato: libro.formato, hojas,
      ausentes: construido.ausentes, avisos, bloqueos: [], totales,
      // qué va a poder responder ADI con este archivo · derivado del contrato, no de una lista aparte
      disponibilidad: disponibilidadSentrix(d),
    },
  };
}

/* previewEnTexto(preview) → LA PREVIEW HUMANA, en las seis secciones que pidió el owner y en ese orden:
 *   1 hojas detectadas · 2 eje por hoja · 3 columnas mapeadas · 4 campos ausentes · 5 errores que bloquean ·
 *   6 qué partes de Sentrix quedan disponibles.
 * Está pensada para que alguien la lea y DECIDA —cargar, corregir el archivo, o pedir la columna que falta—, no
 * para depurar. Por eso los bloqueantes van antes de los totales: si el archivo no entra, el resto es ruido. */
export function previewEnTexto(preview) {
  const L = [];
  const n = (x) => (typeof x === "number" ? x.toLocaleString("es-CL") : "—");
  const sec = (t) => { L.push("", t, "─".repeat(Math.min(96, t.length))); };
  const conEje = preview.hojas.filter((h) => h.eje);

  L.push(`ARCHIVO: ${preview.archivo}  ·  formato: ${preview.formato}`);

  /* 1 + 2 · qué hojas hay y qué es cada una ─────────────────────────────────────────────────────────────── */
  sec(`1 · HOJAS DETECTADAS (${preview.hojas.length}) y 2 · QUÉ ES CADA UNA`);
  for (const h of preview.hojas) {
    if (!h.eje) { L.push(`  "${h.hoja}"  →  SIN ASIGNAR · ${h.motivo}`); L.push(`      columnas: ${h.encabezados.join(" · ")}`); continue; }
    L.push(`  "${h.hoja}"  →  ${h.eje}${h.ejeForzado ? " (asignado a mano)" : ""} · ${h.filasNormalizadas} de ${h.filasLeidas} filas`);
  }

  /* 3 · columnas mapeadas ───────────────────────────────────────────────────────────────────────────────── */
  sec("3 · COLUMNAS MAPEADAS");
  for (const h of conEje) {
    L.push(`  ${h.hoja}:`);
    for (const m of h.mapeo) L.push(`    ✓ "${m.columna}"`.padEnd(34) + `→ ${m.campo.padEnd(14)} ${m.unidad ? `(${m.unidad})` : ""}  · ${m.via}`);
    for (const a of h.ambiguas) L.push(`    ⚠ AMBIGUA · ${a.campo}: la reclaman ${a.columnas.map((c) => `"${c}"`).join(" y ")} — no se elige ninguna, decide una persona`);
    if (h.sinResolver.length) L.push(`    ? sin reconocer: ${h.sinResolver.map((c) => `"${c}"`).join(" · ")}`);
  }

  /* 4 · campos ausentes ─────────────────────────────────────────────────────────────────────────────────── */
  sec("4 · CAMPOS AUSENTES");
  let huboAusentes = false;
  for (const h of conEje) {
    const opt = h.opcionalesAusentes.map((o) => o.campo);
    if (!h.faltantes.length && !opt.length) continue;
    huboAusentes = true;
    L.push(`  ${h.hoja}:`);
    for (const f of h.faltantes) L.push(`    ✗ OBLIGATORIA · ${f.campo}${f.unidad ? ` (${f.unidad})` : ""} — sin esta columna el eje no existe`);
    if (opt.length) L.push(`    · opcionales: ${opt.join(" · ")} — el eje carga igual, pero ADI declina esas métricas`);
  }
  for (const a of preview.avisos.filter((x) => x.tipo === "celdas-vacias")) L.push(`  · ${a.detalle}`);
  if (!huboAusentes && !preview.avisos.some((x) => x.tipo === "celdas-vacias")) L.push("  (ninguno: todas las columnas del contrato vinieron completas)");

  /* 5 · lo que bloquea ──────────────────────────────────────────────────────────────────────────────────── */
  sec("5 · ERRORES QUE BLOQUEAN LA NORMALIZACIÓN");
  if (preview.bloqueos.length) {
    for (const b of preview.bloqueos) L.push(`  ✗ ${b.detalle}${b.hoja ? `   [hoja "${b.hoja}"]` : ""}`);
    L.push("", "  EL ARCHIVO NO SE CARGÓ. Corregí lo de arriba y volvé a subirlo.");
    return L.join("\n");
  }
  L.push("  (ninguno: el archivo se puede normalizar)");

  /* lo que entró, en números ────────────────────────────────────────────────────────────────────────────── */
  const t = preview.totales;
  sec("LO QUE ENTRÓ");
  L.push(`  clientes ${n(t.clientes)}  ·  SKU inventario ${n(t.skusInventario)}  ·  SKU margen ${n(t.skusMargen)}`);
  L.push(`  marcas ${n(t.marcas)}  ·  familias ${n(t.familias)}  ·  bodegas ${n(t.bodegas)}`);
  if (t.ventaClientes !== null) L.push(`  venta sumada de clientes: ${n(t.ventaClientes)}`);
  if (t.capitalInventario !== null) L.push(`  capital en inventario: ${n(t.capitalInventario)}`);

  /* 6 · qué queda disponible ────────────────────────────────────────────────────────────────────────────── */
  const d = preview.disponibilidad;
  if (d) {
    sec(`6 · QUÉ PARTES DE SENTRIX QUEDAN DISPONIBLES  (${d.resumen.carasDisponibles} de ${d.resumen.carasTotales} caras · ${d.resumen.metricasDisponibles} de ${d.resumen.metricasTotales} métricas)`);
    for (const c of d.caras) {
      const marca = c.completa ? "✓ COMPLETA " : c.disponible ? "◐ PARCIAL  " : "✗ NO ABRE  ";
      L.push(`  ${marca} ${c.cara.padEnd(10)} ${c.que}`);
      if (!c.completa) L.push(`               falta: ${c.falta.join(" · ")}`);
    }
    const no = d.metricas.filter((m) => !m.disponible);
    if (no.length) {
      L.push("", "  MÉTRICAS QUE NO SE VAN A PODER RESPONDER:");
      const porMotivo = new Map();
      for (const m of no) { const k = m.motivo; if (!porMotivo.has(k)) porMotivo.set(k, []); porMotivo.get(k).push(m.clave); }
      for (const [motivo, claves] of porMotivo) L.push(`    · ${claves.join(" · ")}\n        ${motivo}`);
    }
  }

  /* lo que el archivo no trae ───────────────────────────────────────────────────────────────────────────── */
  sec("LO QUE ESTE ARCHIVO NO TRAE (y qué deja de poder responderse)");
  for (const a of preview.ausentes) L.push(`  · ${a.que}\n      → ${a.costo}`);
  return L.join("\n");
}
