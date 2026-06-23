/* === CONFIG · escenarios + transforms + benchmarks sectoriales ===
 * Extraído de 41cc33d8 · valores byte-idénticos · cero recálculo (Fase 2 del refactor).
 * La única diferencia con el monolito es DÓNDE vive el dato, nunca QUÉ vale. */

export const SCENARIOS = {
  bonanza: { id:"bonanza", label:"Bonanza", sublabel:"La trampa del éxito",   color:"#10b981", dotColor:"#34d399", icon:"🟢" },
  tension: { id:"tension", label:"Tensión", sublabel:"KPIs dejan de funcionar", color:"#f59e0b", dotColor:"#fbbf24", icon:"🟡" },
  crisis:  { id:"crisis",  label:"Crisis",  sublabel:"Todo se rompe a la vez",  color:"#ef4444", dotColor:"#f87171", icon:"🔴" },
};

export const SCENARIO_TRANSFORMS = {
  bonanza: {
    clientes: {
      "Falabella":    { growth:  8.2, rebateDelta: 0, marginErosion: 0 },
      "Lider":        { growth: 14.9, rebateDelta: 0, marginErosion: 0 },
      "Jumbo":        { growth: 12.2, rebateDelta: 0, marginErosion: 0 },
      "Sodimac":      { growth:  5.4, rebateDelta: 0, marginErosion: 0 },
      "Tottus":       { growth:  9.2, rebateDelta: 0, marginErosion: 0 },
      "Paris":        { growth:  2.6, rebateDelta: 0, marginErosion: 0 },
      "Mercado Libre":{ growth: 25.3, rebateDelta: 0, marginErosion: 0 },
      "Ripley":       { growth: -8.2, rebateDelta: 0, marginErosion: 0 },
      "Easy":         { growth: -5.0, rebateDelta: 0, marginErosion: 0 },
      "La Polar":     { growth:-12.5, rebateDelta: 0, marginErosion: 0 },
      "Hites":        { growth:  4.0, rebateDelta: 0, marginErosion: 0 },
      "ABC":          { growth:  3.0, rebateDelta: 0, marginErosion: 0 },
      "Unimarc":      { growth: -3.9, rebateDelta: 0, marginErosion: 0 },
    },
    kpis: {
      ventas: { totalActual:99999,  totalAnterior:92900, totalPresupuesto:97000, vsAnterior: 7.6, vsPresupuesto:  3.1 },
      // Bonanza · Margen: derivado del agregado. ContribTotal ≈ Σ(venta*margen/100) ≈ 25559.
      margen:     { pct:25.6, pctAnt:23.8, totalUSD:25559, gapPuntos: 1.8, benchmark:30.1 },
      inventario: { totalUSD:135000, doh:48, inmovilizadoPct:41.3, inmovilizadoUSD:55800,  sobrestockPct:24.6, riesgoPct:33.0, desalineacionPct:35, desalineacionUSD:25400, concentracionPct:72, concentracionTopCat:"Línea Blanca" },
    },
  },

  tension: {
    clientes: {
      // Icónicos (mencionados en tesis ADI): Falabella ~plano, Lider en caída,
      // Jumbo crece moderado, Mercado Libre crece fuerte, La Polar y Ripley caen.
      "Falabella":    { growth:  0.5, rebateDelta:+0.8, marginErosion:-2.0 },
      "Lider":        { growth: -3.0, rebateDelta:+1.0, marginErosion:-3.5 },
      "Jumbo":        { growth:  4.0, rebateDelta:+1.5, marginErosion:-2.5 },
      "Sodimac":      { growth:  2.0, rebateDelta:+0.5, marginErosion:-4.3 },
      "Tottus":       { growth:  1.0, rebateDelta:+0.3, marginErosion:-4.3 },
      "Paris":        { growth: -1.0, rebateDelta:+0.4, marginErosion:-4.3 },
      "Mercado Libre":{ growth: 18.0, rebateDelta:+1.7, marginErosion:-1.5 },
      "Ripley":       { growth: -8.0, rebateDelta:+1.2, marginErosion:-3.5 },
      "Easy":         { growth: -6.0, rebateDelta:+1.0, marginErosion:-4.3 },
      "La Polar":     { growth:-12.0, rebateDelta:+0.6, marginErosion:-4.0 },
      "Hites":        { growth: -5.0, rebateDelta:+0.5, marginErosion:-4.3 },
      "ABC":          { growth:  0.0, rebateDelta:+0.4, marginErosion:-4.3 },
      "Unimarc":      { growth: -4.0, rebateDelta:+0.3, marginErosion:-4.3 },
    },
    // KPIs RECALIBRADOS desde los growth: totalActual = Σ(anterior*(1+growth/100)) ≈ 92892
    kpis: {
      ventas: { totalActual:92892, totalAnterior:92900, totalPresupuesto:97000, vsAnterior:-0.0, vsPresupuesto:-4.2 },
      // Margen RECALIBRADO desde la erosión: prom ponderado por venta del escenario = 22.4%
      margen:     { pct:22.4, pctAnt:25.6, totalUSD:20808, gapPuntos:-3.2, benchmark:30.1 },
      inventario: { totalUSD:168000, doh:64, inmovilizadoPct:52.3, inmovilizadoUSD:87864,  sobrestockPct:31.8, riesgoPct:42.5, desalineacionPct:47, desalineacionUSD:40617, concentracionPct:88, concentracionTopCat:"Materiales de Construcción" },
    },
  },

  crisis: {
    clientes: {
      "Falabella":    { growth:-12.0, rebateDelta:+2.0, marginErosion:-6.0 },
      "Lider":        { growth:-18.0, rebateDelta:+2.8, marginErosion:-8.5 },
      "Jumbo":        { growth: -7.0, rebateDelta:+2.5, marginErosion:-5.5 },
      "Sodimac":      { growth:-15.0, rebateDelta:+2.2, marginErosion:-7.0 },
      "Tottus":       { growth: -9.0, rebateDelta:+1.8, marginErosion:-7.0 },
      "Paris":        { growth:-14.0, rebateDelta:+2.0, marginErosion:-7.0 },
      "Mercado Libre":{ growth: 32.0, rebateDelta:+2.5, marginErosion:-3.0 },
      "Ripley":       { growth:-28.0, rebateDelta:+3.5, marginErosion:-10.0 },
      "Easy":         { growth:-22.0, rebateDelta:+3.0, marginErosion:-7.0 },
      "La Polar":     { growth:-35.0, rebateDelta:+3.2, marginErosion:-12.0 },
      "Hites":        { growth:-17.0, rebateDelta:+2.5, marginErosion:-7.0 },
      "ABC":          { growth:-12.0, rebateDelta:+1.5, marginErosion:-7.0 },
      "Unimarc":      { growth:-19.0, rebateDelta:+1.8, marginErosion:-7.0 },
    },
    // KPIs RECALIBRADOS: totalActual ≈ 81182, var = -12.6%
    kpis: {
      ventas: { totalActual:81182, totalAnterior:92900, totalPresupuesto:97000, vsAnterior:-12.6, vsPresupuesto:-16.3 },
      // Margen RECALIBRADO: prom ponderado · escenario = 18.9% · contrib = 15343
      margen:     { pct:18.9, pctAnt:25.6, totalUSD:15343, gapPuntos:-6.7, benchmark:30.1 },
      inventario: { totalUSD:198000, doh:78, inmovilizadoPct:67.4, inmovilizadoUSD:133452, sobrestockPct:48.5, riesgoPct:58.0, desalineacionPct:62, desalineacionUSD:68800, concentracionPct:94, concentracionTopCat:"Materiales de Construcción" },
    },
  },
};

export const SECTORAL_BENCHMARKS = {
  // doh · = typical_doh U.A
  doh: {
    retail: 53,         // typical_doh U.A retail [DERIVADO n=6 SKU]
    construccion: 90,   // typical_doh U.A construcción [DERIVADO n=4 SKU Materiales]
    consumo_masivo: 43, // typical_doh U.A consumo_masivo [DERIVADO n=3 SKU]
    generico: 62,       // typical_doh U.A genérico [DERIVADO portfolio.doh_promedio]
  },
  // margen_pct · = typical_margin_pct U.A
  margen_pct: {
    retail: 20,         // typical_margin U.A retail [DERIVADO n=6 SKU]
    construccion: 21,   // typical_margin U.A construcción [DERIVADO n=4 SKU]
    consumo_masivo: 26, // typical_margin U.A consumo_masivo [DERIVADO n=3 SKU]
    generico: 22,       // typical_margin U.A genérico [ASUNCIÓN U.A]
  },
  // rotacion · = typical_rotation U.A
  rotacion: {
    retail: 6.0,        // typical_rotation U.A retail [DERIVADO n=6 SKU]
    construccion: 3.9,  // typical_rotation U.A construcción [DERIVADO n=4 SKU]
    consumo_masivo: 7.9,// typical_rotation U.A consumo_masivo [DERIVADO n=3 SKU]
    generico: 6.0,      // typical_rotation U.A genérico [ASUNCIÓN U.A]
  },
  // carga_comercial_pct · = typical_carga_pct U.A
  carga_comercial_pct: {
    retail: 3.7,        // typical_carga U.A retail [DERIVADO n=7 clientes]
    construccion: 5.5,  // typical_carga U.A construcción [DERIVADO n=2 clientes]
    consumo_masivo: 3.5,// typical_carga U.A consumo_masivo [DERIVADO n=4 clientes]
    generico: 4.0,      // typical_carga U.A genérico [ASUNCIÓN U.A]
  },
};
