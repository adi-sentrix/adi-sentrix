/* === DATA · KPIs base + serie mensual ===
 * Datos extraídos de 41cc33d8 · valores byte-idénticos · surfaceados por el motor en Fase 3.
 * Los archivos aprobados de Fase 2 quedan intactos; esto es aditivo. */

export const ventasKPI = { totalActual:100000, totalAnterior:92900, totalPresupuesto:97000, vsAnterior:7.6, vsPresupuesto:3.1, unidades:5703, ticketProm:17.5 };

export const margenKPI = { pct:25.6, pctAnt:23.8, totalUSD:25559, gapPuntos:1.8 };

export const invKPI = { totalUSD:135000, doh:48, inmovilizadoPct:41.3, inmovilizadoUSD:55800, sobrestockPct:24.6, riesgoPct:33.0 };

export const ventasMensuales = [
  { mes:"Ene", actual:6800,  anterior:6300, presupuesto:6500 },
  { mes:"Feb", actual:6500,  anterior:6050, presupuesto:6300 },
  { mes:"Mar", actual:7800,  anterior:7200, presupuesto:7500 },
  { mes:"Abr", actual:7400,  anterior:6950, presupuesto:7400 },
  { mes:"May", actual:8200,  anterior:7650, presupuesto:8000 },
  { mes:"Jun", actual:8700,  anterior:8050, presupuesto:8400 },
  { mes:"Jul", actual:8100,  anterior:7600, presupuesto:8100 },
  { mes:"Ago", actual:9100,  anterior:8400, presupuesto:8700 },
  { mes:"Sep", actual:8600,  anterior:7950, presupuesto:8500 },
  { mes:"Oct", actual:9400,  anterior:8700, presupuesto:9100 },
  { mes:"Nov", actual:9800,  anterior:9050, presupuesto:9500 },
  { mes:"Dic", actual:9600,  anterior:9100, presupuesto:9000 },
];

export const MESES_IDX = { Ene:0,Feb:1,Mar:2,Abr:3,May:4,Jun:5,Jul:6,Ago:7,Sep:8,Oct:9,Nov:10,Dic:11 };
