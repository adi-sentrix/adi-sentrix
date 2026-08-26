/* === ingesta/disponibilidad.js · QUÉ VA A PODER RESPONDER ADI CON ESTE ARCHIVO (vía 2 · fase 2 · 2026-08-21) ==
 *
 * La pregunta que el owner puso al final de la preview: «qué partes de Sentrix quedarían disponibles y cuáles no».
 * Es la más útil de las seis y la única que no se contesta mirando el archivo: se contesta cruzando lo que el
 * archivo trajo contra lo que el producto necesita.
 *
 * NO HAY UNA LISTA NUEVA ACÁ, y eso es lo importante. `metricRegistry` ya declara, para cada métrica y cada eje,
 * **de qué tabla y de qué campo sale** (`sourceByAxis: { cliente: { source: "clientesVentas", field: "actual" } }`).
 * Así que la disponibilidad se DERIVA: la métrica «ventas por cliente» está disponible si el dataset trae filas en
 * `clientesVentas` y alguna tiene `actual`. Si mañana se agrega una métrica al contrato, aparece acá sola; si se
 * saca, desaparece sola. Una lista paralela se habría desincronizado con el primer cambio.
 *
 * LO ÚNICO DECLARADO A MANO son las CUATRO CARAS de la Mesa y qué necesita cada una — y no se puede derivar
 * porque no es dato: es la estructura del producto (CLAUDE.md §1: Comercial DETECTA → la Ficha EXPLICA → Sentrix
 * DEMUESTRA). Está escrito en un solo lugar, corto, y el candado comprueba que con el tenant demo —que es el
 * dataset de referencia completo— las cuatro dan disponible. Si alguna diera roja con el demo, el mapa está mal.
 *
 * Función PURA: recibe el dataset y no toca la puerta del dato. Nada de activar el tenant para «preguntarle» al
 * producto — una preview no puede tener el efecto secundario de cambiar la empresa activa de la aplicación.
 */
import { METRICS } from "../config/contract/metricRegistry.js";

/** ¿la tabla trae filas con ese campo cargado? Es toda la regla: sin filas no hay métrica, y con filas pero el
 *  campo vacío tampoco (una columna que vino en blanco no habilita nada, solo lo aparenta). */
function tieneDato(dataset, source, field) {
  const filas = (dataset && dataset[source]) || [];
  if (!Array.isArray(filas) || filas.length === 0) return { hay: false, filas: 0, conCampo: 0 };
  const conCampo = filas.filter((r) => r && r[field] !== null && r[field] !== undefined && r[field] !== "").length;
  return { hay: conCampo > 0, filas: filas.length, conCampo };
}

/* LAS CUATRO CARAS · lo único escrito a mano, porque es la forma del producto y no del dato.
 * `necesita` son pares métrica@eje: si NINGUNO está disponible, la cara no se puede abrir. */
export const CARAS = [
  { cara: "Comercial", que: "quién vende, quién cede margen y dónde está la carga comercial",
    necesita: ["ventas@cliente", "margen@cliente", "contribucion@cliente"] },
  { cara: "Capital", que: "capital inmovilizado, rotación y días de inventario",
    necesita: ["capital@sku", "rotacion@sku", "doh@sku"] },
  { cara: "Resultado", que: "el P&L comercial: qué queda después de costos y gastos",
    necesita: ["ventas@cliente", "contribucion@cliente"] },
  { cara: "Ficha", que: "el perfil completo de una cuenta, un SKU, una marca o una familia",
    necesita: ["ventas@cliente", "ventas@sku", "ventas@marca", "ventas@familia"] },
];

/* disponibilidadSentrix(dataset) → { metricas, caras, resumen }
 *   metricas: [{ clave:"ventas@cliente", metrica, eje, disponible, source, field, filas, conCampo, motivo }]
 *   caras:    [{ cara, que, disponible, apoyos:[claves disponibles], falta:[claves ausentes] }]
 */
export function disponibilidadSentrix(dataset) {
  const metricas = [];
  for (const [id, m] of Object.entries(METRICS)) {
    const porEje = m.sourceByAxis || {};
    for (const [eje, cfg] of Object.entries(porEje)) {
      if (!cfg || !cfg.source || !cfg.field) continue;
      const t = tieneDato(dataset, cfg.source, cfg.field);
      metricas.push({
        clave: `${id}@${eje}`, metrica: m.label || id, eje,
        disponible: t.hay, source: cfg.source, field: cfg.field, filas: t.filas, conCampo: t.conCampo,
        motivo: t.hay ? null : (t.filas === 0 ? `el archivo no trajo la tabla "${cfg.source}"` : `"${cfg.source}" tiene ${t.filas} filas pero ninguna con "${cfg.field}"`),
      });
    }
  }
  const porClave = new Map(metricas.map((x) => [x.clave, x]));

  const caras = CARAS.map(({ cara, que, necesita }) => {
    const apoyos = necesita.filter((k) => porClave.get(k) && porClave.get(k).disponible);
    const falta = necesita.filter((k) => !porClave.get(k) || !porClave.get(k).disponible);
    return { cara, que, disponible: apoyos.length > 0, completa: falta.length === 0, apoyos, falta };
  });

  const dispo = metricas.filter((m) => m.disponible).length;
  return {
    metricas, caras,
    resumen: { metricasDisponibles: dispo, metricasTotales: metricas.length,
      carasDisponibles: caras.filter((c) => c.disponible).length, carasTotales: caras.length },
  };
}
