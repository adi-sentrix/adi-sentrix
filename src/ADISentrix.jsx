import { useState, useRef, useCallback, useEffect } from "react";
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine, Cell, ComposedChart,
  Area
} from "recharts";

// ════════════════════════════════════════════════════════════════════════════
// DESIGN TOKENS
// ════════════════════════════════════════════════════════════════════════════
const C = {
  bg: "#080808", surface: "#0d0d0d", surfaceAlt: "#0f0f0f", surfaceHover: "#131313",
  border: "#2a2a2a", borderLight: "#3d3d3d",
  text: "#FFFFFF", textSub: "#c0c0c0", textMuted: "#707070",
  blue: "#00c2e8", indigo: "#0e7fa8", green: "#10b981",
  red: "#f43f5e", amber: "#fbbf24", cyan: "#219ebc", violet: "#00a8e8",
};

// ════════════════════════════════════════════════════════════════════════════
// CONTEXTO DINÁMICO ADI
// ════════════════════════════════════════════════════════════════════════════
const ADI_PROFILES = {
  retail:       { label:"Retail / Consumo",  icon:"🛒", vars:["ticket","unidades","familias","margen","rebates","inventario","rotación"] },
  distribucion: { label:"Distribución",       icon:"🚚", vars:["cobertura","fill_rate","picking","despacho","rutas"] },
  manufactura:  { label:"Manufactura",        icon:"🏭", vars:["producción","eficiencia","merma","costos_estándar","OEE"] },
  mineria:      { label:"Minería",            icon:"⛏️", vars:["costos_op","contratos","desviaciones","productividad","ley_mineral"] },
};
const USER_ROLES = {
  gerente_general:   { label:"Gerente General",   icon:"👔", depth:"estratégico",  focus:"impacto global, riesgos, concentración",    lang:"estratégico y directo" },
  gerente_comercial: { label:"Gerente Comercial", icon:"📈", depth:"comercial",     focus:"ventas, clientes, crecimiento, ticket",      lang:"simple y comercial" },
  controller:        { label:"Controller",         icon:"🧮", depth:"técnico",       focus:"margen, costo, contribución, rebates",       lang:"técnico pero claro" },
  operaciones:       { label:"Operaciones",        icon:"⚙️", depth:"operacional",  focus:"procesos, eficiencia, inventario, DOH",      lang:"operacional y concreto" },
};

// ════════════════════════════════════════════════════════════════════════════
// AYUDA CONTEXTUAL — tooltips ⓘ
// ════════════════════════════════════════════════════════════════════════════
const HELP = {
  ventas_actuales:    "Suma total de ventas en el período seleccionado.",
  ano_anterior:       "Ventas del mismo período del año anterior.",
  vs_anterior:        "Variación porcentual entre ventas actuales y el año pasado.",
  gap_presupuesto:    "Diferencia entre ventas reales y el objetivo presupuestado.",
  ticket_promedio:    "Venta promedio por unidad vendida. Indica nivel de precio o mix.",
  unidades:           "Cantidad de unidades despachadas en el período.",
  participacion:      "Porcentaje que representa este ítem sobre el total de ventas.",
  crecimiento:        "Variación % de ventas vs el mismo período del año anterior.",
  pareto_ventas:      "Los primeros elementos concentran la mayor parte de las ventas. Regla 80/20.",
  margen_pct:         "Contribución dividida por venta neta. Mide rentabilidad relativa.",
  contribucion:       "Venta neta menos costo y rebates. Resultado real del negocio.",
  costo_ponderado:    "Costo promedio por unidad, calculado según mix de compras (CMP).",
  rebate_pct:         "Descuento o devolución comercial pactado con el proveedor, expresado como % de venta.",
  precio_prom_venta:  "PPV — Precio promedio de venta: Ventas ($) dividido por unidades. Refleja el precio real al que se está vendiendo.",
  precio_lista:       "PL — Precio lista: precio oficial o de catálogo del producto. Referencia de precio sin descuentos.",
  benchmark:          "Margen de referencia del negocio (30.1%). Permite comparar eficiencia por canal o categoría.",
  pareto_contribucion:"Los primeros elementos generan la mayor contribución. Prioriza dónde hay más margen real.",
  doh:                "Days on Hand: días promedio que el inventario permanece antes de venderse.",
  sobrestock:         "% del stock con DOH > 120 días: inventario en exceso real respecto a la demanda. DOH 90–120d = riesgo · DOH > 120d = problema.",
  rotacion:           "Veces que el inventario se renueva en el año. Mayor rotación = mayor eficiencia.",
  cobertura:          "% del inventario fuera de política de cobertura. Política = Lead Time + Stock de Seguridad por SKU. Detecta simultáneamente sobrestock y riesgo de quiebre.",
  inmovilizado:       "Stock sin movimiento por más de 60 días. Representa capital inmovilizado.",
  dias_sin_venta:     "Días transcurridos desde la última venta registrada para este SKU.",
  clasificacion:      "Estado del inventario: Activo, Lento (+30d), 60d, 90d o 120d sin rotación.",
  participacion_inv:  "% que representa el stock de este SKU sobre el total del inventario.",
};

function InfoTip({ id, style={} }) {
  const [show, setShow] = useState(false);
  const txt = HELP[id];
  if (!txt) return null;
  return (
    <span style={{ position:"relative", display:"inline-flex", alignItems:"center", ...style }}
      onMouseEnter={()=>setShow(true)} onMouseLeave={()=>setShow(false)}>
      <span style={{ fontSize:9, color:C.textMuted, cursor:"help", marginLeft:4, userSelect:"none",
        width:13, height:13, borderRadius:"50%", border:`1px solid ${C.textMuted}`,
        display:"inline-flex", alignItems:"center", justifyContent:"center", fontWeight:700, lineHeight:1 }}>i</span>
      {show && (
        <span style={{
          position:"absolute", bottom:"calc(100% + 6px)", left:"50%", transform:"translateX(-50%)",
          background:"#0d0d0d", border:`1px solid ${C.borderLight}`, borderRadius:7, padding:"7px 10px",
          fontSize:10.5, color:"#94a3b8", lineHeight:1.55, whiteSpace:"normal", maxWidth:240,
          zIndex:200, boxShadow:"0 8px 24px rgba(0,0,0,0.5)", pointerEvents:"none", minWidth:170
        }}>{txt}</span>
      )}
    </span>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// DATA LAYER
// ════════════════════════════════════════════════════════════════════════════
const SUPERFAMILIAS = ["Todas","Electrodomésticos","Línea Blanca","Cuidado Personal","Materiales de Construcción"];
const MARCAS_ALL    = ["Samsung","LG","Philips","Bosch","Makita"];
const CANALES_ALL   = ["Retail","Mayorista","E-commerce","Directo"];
const SUCURSALES    = ["Santiago","Valparaíso","Concepción","Antofagasta"];
const CLIENTES_ALL  = ["Falabella","Lider","Jumbo","Sodimac","Tottus","Paris","Mercado Libre","Ripley","Easy","La Polar","Hites","Innova Ferre","ABC","Surco","Unimarc"];
const SKUS_ALL      = ["SAM-REF500L","LG-WASH11KG","SAM-TV55","LG-DRYER8KG","PHI-SHAVER9","BOS-SANDER","PHI-IRON-PRO","BOS-DRILL18V","MAK-COMP-AIR","SAM-MICRO32L","PHI-HAIR-PRO","LG-AIR9000","MAK-SAW18V"];

// ── VENTAS
const ventasMensuales = [
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

const clientesVentas = [
  { nombre:"Falabella",     sfamilia:"Electrodomésticos",           marca:"Samsung", canal:"Retail",     actual:18500, anterior:17100, unidades:1040, unidadesAnt:985,  pctRebate:4.5, presupuesto:17500 },
  { nombre:"Lider",         sfamilia:"Línea Blanca",                marca:"LG",      canal:"Retail",     actual:17000, anterior:14800, unidades:900,  unidadesAnt:810,  pctRebate:4.2, presupuesto:16000 },
  { nombre:"Jumbo",         sfamilia:"Cuidado Personal",            marca:"Philips", canal:"Retail",     actual:16500, anterior:14700, unidades:1210, unidadesAnt:1100, pctRebate:3.8, presupuesto:15500 },
  { nombre:"Sodimac",       sfamilia:"Materiales de Construcción",  marca:"Bosch",   canal:"Retail",     actual:7800,  anterior:7400,  unidades:310,  unidadesAnt:298,  pctRebate:5.4, presupuesto:7500  },
  { nombre:"Tottus",        sfamilia:"Cuidado Personal",            marca:"Philips", canal:"Retail",     actual:6500,  anterior:5950,  unidades:410,  unidadesAnt:380,  pctRebate:3.2, presupuesto:6300  },
  { nombre:"Paris",         sfamilia:"Electrodomésticos",           marca:"Samsung", canal:"Retail",     actual:6000,  anterior:5850,  unidades:380,  unidadesAnt:370,  pctRebate:4.0, presupuesto:6000  },
  { nombre:"Mercado Libre", sfamilia:"Línea Blanca",                marca:"LG",      canal:"E-commerce", actual:5200,  anterior:4150,  unidades:275,  unidadesAnt:230,  pctRebate:1.8, presupuesto:4800  },
  { nombre:"Ripley",        sfamilia:"Electrodomésticos",           marca:"Samsung", canal:"Retail",     actual:4500,  anterior:4900,  unidades:245,  unidadesAnt:265,  pctRebate:4.8, presupuesto:4900  },
  { nombre:"Easy",          sfamilia:"Materiales de Construcción",  marca:"Bosch",   canal:"Retail",     actual:3200,  anterior:3370,  unidades:140,  unidadesAnt:150,  pctRebate:5.5, presupuesto:3400  },
  { nombre:"La Polar",      sfamilia:"Cuidado Personal",            marca:"Philips", canal:"Retail",     actual:2800,  anterior:3200,  unidades:185,  unidadesAnt:210,  pctRebate:3.9, presupuesto:3000  },
  { nombre:"Hites",         sfamilia:"Electrodomésticos",           marca:"Samsung", canal:"Retail",     actual:2600,  anterior:2500,  unidades:140,  unidadesAnt:138,  pctRebate:3.6, presupuesto:2700  },
  { nombre:"Innova Ferre",  sfamilia:"Materiales de Construcción",  marca:"Makita",  canal:"Mayorista",  actual:2500,  anterior:2120,  unidades:95,   unidadesAnt:82,   pctRebate:4.1, presupuesto:2300  },
  { nombre:"ABC",           sfamilia:"Línea Blanca",                marca:"LG",      canal:"Retail",     actual:2400,  anterior:2330,  unidades:135,  unidadesAnt:131,  pctRebate:3.5, presupuesto:2450  },
  { nombre:"Surco",         sfamilia:"Materiales de Construcción",  marca:"Makita",  canal:"Mayorista",  actual:2300,  anterior:2240,  unidades:88,   unidadesAnt:85,   pctRebate:4.3, presupuesto:2350  },
  { nombre:"Unimarc",       sfamilia:"Cuidado Personal",            marca:"Philips", canal:"Retail",     actual:2200,  anterior:2290,  unidades:150,  unidadesAnt:155,  pctRebate:3.0, presupuesto:2300  },
];

const marcasVentas = [
  { nombre:"Samsung", sfamilia:"Electrodomésticos",          marca:"Samsung", actual:31600, anterior:30350, unidades:1805, unidadesAnt:1758, pctRebate:4.2 },
  { nombre:"Philips", sfamilia:"Cuidado Personal",           marca:"Philips", actual:28000, anterior:26140, unidades:1955, unidadesAnt:1845, pctRebate:3.5 },
  { nombre:"LG",      sfamilia:"Línea Blanca",               marca:"LG",      actual:24600, anterior:21280, unidades:1310, unidadesAnt:1171, pctRebate:3.5 },
  { nombre:"Bosch",   sfamilia:"Materiales de Construcción", marca:"Bosch",   actual:11000, anterior:10770, unidades:450,  unidadesAnt:448,  pctRebate:5.4 },
  { nombre:"Makita",  sfamilia:"Materiales de Construcción", marca:"Makita",  actual:4800,  anterior:4360,  unidades:183,  unidadesAnt:167,  pctRebate:4.2 },
];

const sfamiliasVentas = [
  { nombre:"Electrodomésticos",          sfamilia:"Electrodomésticos",          marca:"Samsung", actual:31600, anterior:30350, unidades:1805, unidadesAnt:1758, pctRebate:4.2 },
  { nombre:"Cuidado Personal",           sfamilia:"Cuidado Personal",           marca:"Philips", actual:28000, anterior:26140, unidades:1955, unidadesAnt:1845, pctRebate:3.5 },
  { nombre:"Línea Blanca",               sfamilia:"Línea Blanca",               marca:"LG",      actual:24600, anterior:21280, unidades:1310, unidadesAnt:1171, pctRebate:3.5 },
  { nombre:"Materiales de Construcción", sfamilia:"Materiales de Construcción", marca:"Bosch",   actual:15800, anterior:15130, unidades:633,  unidadesAnt:615,  pctRebate:5.0 },
];

const ventasKPI = { totalActual:100000, totalAnterior:92900, totalPresupuesto:97000, vsAnterior:7.6, vsPresupuesto:3.1, unidades:5703, ticketProm:17.5 };

// SKUs por cliente/marca/sfamilia para drill jerárquico
const skusPorCliente = {
  "Falabella":     [{ nombre:"SAM-REF500L",   sfamilia:"Electrodomésticos",          marca:"Samsung", actual:8200, anterior:7500, unidades:32,  unidadesAnt:29  }, { nombre:"SAM-TV55",      sfamilia:"Electrodomésticos", marca:"Samsung", actual:6100, anterior:5700, unidades:9,  unidadesAnt:8  }, { nombre:"SAM-MICRO32L",  sfamilia:"Electrodomésticos", marca:"Samsung", actual:4200, anterior:3900, unidades:37, unidadesAnt:35 }],
  "Lider":         [{ nombre:"LG-WASH11KG",   sfamilia:"Línea Blanca",               marca:"LG",      actual:7800, anterior:6800, unidades:25,  unidadesAnt:22  }, { nombre:"LG-DRYER8KG",   sfamilia:"Línea Blanca",      marca:"LG",      actual:5600, anterior:4800, unidades:17, unidadesAnt:14 }, { nombre:"LG-AIR9000",    sfamilia:"Línea Blanca",      marca:"LG",      actual:3600, anterior:3200, unidades:19, unidadesAnt:17 }],
  "Jumbo":         [{ nombre:"PHI-SHAVER9",   sfamilia:"Cuidado Personal",           marca:"Philips", actual:7500, anterior:6700, unidades:90,  unidadesAnt:80  }, { nombre:"PHI-HAIR-PRO",  sfamilia:"Cuidado Personal",  marca:"Philips", actual:5200, anterior:4600, unidades:73, unidadesAnt:65 }, { nombre:"PHI-IRON-PRO",  sfamilia:"Cuidado Personal",  marca:"Philips", actual:3800, anterior:3400, unidades:58, unidadesAnt:52 }],
  "Sodimac":       [{ nombre:"BOS-DRILL18V",  sfamilia:"Materiales de Construcción", marca:"Bosch",   actual:4800, anterior:4500, unidades:28,  unidadesAnt:26  }, { nombre:"BOS-SANDER",    sfamilia:"Materiales de Construcción", marca:"Bosch", actual:3000, anterior:2900, unidades:12, unidadesAnt:11 }],
  "Tottus":        [{ nombre:"PHI-SHAVER9",   sfamilia:"Cuidado Personal",           marca:"Philips", actual:3500, anterior:3200, unidades:42,  unidadesAnt:38  }, { nombre:"PHI-HAIR-PRO",  sfamilia:"Cuidado Personal",  marca:"Philips", actual:3000, anterior:2750, unidades:42, unidadesAnt:38 }],
  "Paris":         [{ nombre:"SAM-TV55",      sfamilia:"Electrodomésticos",          marca:"Samsung", actual:3400, anterior:3300, unidades:5,   unidadesAnt:5   }, { nombre:"SAM-REF500L",   sfamilia:"Electrodomésticos", marca:"Samsung", actual:2600, anterior:2550, unidades:11, unidadesAnt:10 }],
  "Mercado Libre": [{ nombre:"LG-WASH11KG",   sfamilia:"Línea Blanca",               marca:"LG",      actual:3100, anterior:2450, unidades:10,  unidadesAnt:8   }, { nombre:"LG-AIR9000",    sfamilia:"Línea Blanca",      marca:"LG",      actual:2100, anterior:1700, unidades:11, unidadesAnt:9  }],
  "Ripley":        [{ nombre:"SAM-TV55",      sfamilia:"Electrodomésticos",          marca:"Samsung", actual:2800, anterior:3050, unidades:4,   unidadesAnt:5   }, { nombre:"SAM-MICRO32L",  sfamilia:"Electrodomésticos", marca:"Samsung", actual:1700, anterior:1850, unidades:15, unidadesAnt:16 }],
  "Easy":          [{ nombre:"BOS-DRILL18V",  sfamilia:"Materiales de Construcción", marca:"Bosch",   actual:2000, anterior:2100, unidades:12,  unidadesAnt:13  }, { nombre:"BOS-SANDER",    sfamilia:"Materiales de Construcción", marca:"Bosch", actual:1200, anterior:1270, unidades:5,  unidadesAnt:5  }],
  "La Polar":      [{ nombre:"PHI-IRON-PRO",  sfamilia:"Cuidado Personal",           marca:"Philips", actual:1700, anterior:1950, unidades:26,  unidadesAnt:30  }, { nombre:"PHI-HAIR-PRO",  sfamilia:"Cuidado Personal",  marca:"Philips", actual:1100, anterior:1250, unidades:16, unidadesAnt:18 }],
  "Hites":         [{ nombre:"SAM-MICRO32L",  sfamilia:"Electrodomésticos",          marca:"Samsung", actual:1600, anterior:1540, unidades:14,  unidadesAnt:14  }, { nombre:"SAM-TV55",      sfamilia:"Electrodomésticos", marca:"Samsung", actual:1000, anterior:960,  unidades:2,  unidadesAnt:2  }],
  "Innova Ferre":  [{ nombre:"MAK-SAW18V",    sfamilia:"Materiales de Construcción", marca:"Makita",  actual:1600, anterior:1350, unidades:8,   unidadesAnt:7   }, { nombre:"MAK-COMP-AIR",  sfamilia:"Materiales de Construcción", marca:"Makita",actual:900,  anterior:770,  unidades:2,  unidadesAnt:2  }],
  "ABC":           [{ nombre:"LG-WASH11KG",   sfamilia:"Línea Blanca",               marca:"LG",      actual:1500, anterior:1450, unidades:5,   unidadesAnt:5   }, { nombre:"LG-AIR9000",    sfamilia:"Línea Blanca",      marca:"LG",      actual:900,  anterior:880,  unidades:5,  unidadesAnt:5  }],
  "Surco":         [{ nombre:"MAK-SAW18V",    sfamilia:"Materiales de Construcción", marca:"Makita",  actual:1500, anterior:1460, unidades:7,   unidadesAnt:7   }, { nombre:"MAK-COMP-AIR",  sfamilia:"Materiales de Construcción", marca:"Makita",actual:800,  anterior:780,  unidades:2,  unidadesAnt:2  }],
  "Unimarc":       [{ nombre:"PHI-SHAVER9",   sfamilia:"Cuidado Personal",           marca:"Philips", actual:1300, anterior:1350, unidades:16,  unidadesAnt:17  }, { nombre:"PHI-IRON-PRO",  sfamilia:"Cuidado Personal",  marca:"Philips", actual:900,  anterior:940,  unidades:14, unidadesAnt:14 }],
};
const skusPorMarca = {
  "Samsung": [{ nombre:"SAM-REF500L",  sfamilia:"Electrodomésticos",          marca:"Samsung", actual:10800, anterior:10050, unidades:43, unidadesAnt:39 }, { nombre:"SAM-TV55",     sfamilia:"Electrodomésticos",          marca:"Samsung", actual:13300, anterior:13010, unidades:20, unidadesAnt:20 }, { nombre:"SAM-MICRO32L", sfamilia:"Electrodomésticos", marca:"Samsung", actual:7500, anterior:7290, unidades:66, unidadesAnt:65 }],
  "LG":      [{ nombre:"LG-WASH11KG",  sfamilia:"Línea Blanca",               marca:"LG",      actual:12400, anterior:10700, unidades:40, unidadesAnt:35 }, { nombre:"LG-DRYER8KG",  sfamilia:"Línea Blanca",               marca:"LG",      actual:5600,  anterior:4800,  unidades:17, unidadesAnt:14 }, { nombre:"LG-AIR9000",   sfamilia:"Línea Blanca",       marca:"LG",      actual:6600, anterior:5780, unidades:35, unidadesAnt:31 }],
  "Philips": [{ nombre:"PHI-SHAVER9",  sfamilia:"Cuidado Personal",           marca:"Philips", actual:12300, anterior:11250, unidades:148,unidadesAnt:135 }, { nombre:"PHI-HAIR-PRO", sfamilia:"Cuidado Personal",           marca:"Philips", actual:9300,  anterior:8600,  unidades:131,unidadesAnt:121 }, { nombre:"PHI-IRON-PRO", sfamilia:"Cuidado Personal", marca:"Philips", actual:6400, anterior:6290, unidades:98, unidadesAnt:96 }],
  "Bosch":   [{ nombre:"BOS-DRILL18V", sfamilia:"Materiales de Construcción", marca:"Bosch",   actual:6800,  anterior:6600,  unidades:40, unidadesAnt:39 }, { nombre:"BOS-SANDER",   sfamilia:"Materiales de Construcción", marca:"Bosch",   actual:4200,  anterior:4170,  unidades:17, unidadesAnt:16 }],
  "Makita":  [{ nombre:"MAK-SAW18V",   sfamilia:"Materiales de Construcción", marca:"Makita",  actual:3100,  anterior:2810,  unidades:15, unidadesAnt:14 }, { nombre:"MAK-COMP-AIR", sfamilia:"Materiales de Construcción", marca:"Makita",  actual:1700,  anterior:1550,  unidades:4,  unidadesAnt:4  }],
};
const skusPorSfamilia = {
  "Electrodomésticos":          [{ nombre:"SAM-REF500L",  sfamilia:"Electrodomésticos",          marca:"Samsung", actual:10800, anterior:10050, unidades:43, unidadesAnt:39 }, { nombre:"SAM-TV55",     sfamilia:"Electrodomésticos",          marca:"Samsung", actual:13300, anterior:13010, unidades:20, unidadesAnt:20 }, { nombre:"SAM-MICRO32L", sfamilia:"Electrodomésticos", marca:"Samsung", actual:7500, anterior:7290, unidades:66, unidadesAnt:65 }],
  "Línea Blanca":               [{ nombre:"LG-WASH11KG",  sfamilia:"Línea Blanca",               marca:"LG",      actual:12400, anterior:10700, unidades:40, unidadesAnt:35 }, { nombre:"LG-DRYER8KG",  sfamilia:"Línea Blanca",               marca:"LG",      actual:5600,  anterior:4800,  unidades:17, unidadesAnt:14 }, { nombre:"LG-AIR9000",   sfamilia:"Línea Blanca",       marca:"LG",      actual:6600, anterior:5780, unidades:35, unidadesAnt:31 }],
  "Cuidado Personal":           [{ nombre:"PHI-SHAVER9",  sfamilia:"Cuidado Personal",           marca:"Philips", actual:12300, anterior:11250, unidades:148,unidadesAnt:135 }, { nombre:"PHI-HAIR-PRO", sfamilia:"Cuidado Personal",           marca:"Philips", actual:9300,  anterior:8600,  unidades:131,unidadesAnt:121 }, { nombre:"PHI-IRON-PRO", sfamilia:"Cuidado Personal", marca:"Philips", actual:6400, anterior:6290, unidades:98, unidadesAnt:96 }],
  "Materiales de Construcción": [{ nombre:"BOS-DRILL18V", sfamilia:"Materiales de Construcción", marca:"Bosch",   actual:6800,  anterior:6600,  unidades:40, unidadesAnt:39 }, { nombre:"BOS-SANDER",   sfamilia:"Materiales de Construcción", marca:"Bosch",   actual:4200,  anterior:4170,  unidades:17, unidadesAnt:16 }, { nombre:"MAK-SAW18V",   sfamilia:"Materiales de Construcción", marca:"Makita", actual:3100, anterior:2810, unidades:15, unidadesAnt:14 }, { nombre:"MAK-COMP-AIR", sfamilia:"Materiales de Construcción", marca:"Makita", actual:1700, anterior:1550, unidades:4, unidadesAnt:4 }],
};

// ── Presupuesto mensual por elemento (para gráfico dinámico ventas)
const presupuestoPorElemento = {
  "Falabella":     [1190,1140,1350,1330,1440,1510,1460,1570,1530,1640,1710,1630],
  "Lider":         [1090,1050,1240,1220,1320,1390,1340,1440,1400,1500,1560,1450],
  "Jumbo":         [1050,1010,1200,1180,1280,1340,1290,1390,1350,1450,1510,1450],
  "Sodimac":       [510, 490, 580, 570, 620, 650, 630, 670, 660, 700, 730, 690],
  "Tottus":        [430, 410, 490, 480, 520, 550, 530, 560, 550, 590, 610, 580],
  "Paris":         [410, 390, 460, 460, 500, 520, 500, 540, 530, 560, 580, 550],
  "Mercado Libre": [330, 310, 370, 370, 400, 420, 400, 430, 420, 450, 470, 430],
  "Ripley":        [330, 320, 380, 370, 410, 420, 410, 440, 430, 460, 470, 460],
  "Easy":          [230, 220, 260, 260, 280, 300, 280, 310, 300, 320, 330, 310],
  "La Polar":      [210, 200, 240, 230, 250, 260, 250, 270, 260, 280, 290, 260],
  "Hites":         [180, 180, 210, 210, 230, 240, 230, 240, 240, 260, 260, 240],
  "Innova Ferre":  [160, 150, 180, 180, 190, 200, 190, 210, 200, 220, 220, 200],
  "ABC":           [170, 160, 190, 190, 200, 210, 210, 220, 210, 230, 240, 220],
  "Surco":         [160, 150, 180, 180, 190, 210, 200, 210, 200, 220, 230, 220],
  "Unimarc":       [160, 150, 180, 180, 190, 200, 190, 210, 200, 220, 220, 200],
  "Samsung":       [2110,2050,2440,2400,2600,2730,2640,2830,2750,2960,3080,2910],
  "LG":            [1590,1520,1810,1780,1920,2020,1950,2090,2030,2180,2270,2140],
  "Philips":       [1870,1780,2110,2080,2250,2360,2270,2450,2370,2540,2650,2490],
  "Bosch":         [740, 710, 840, 830, 900, 950, 910, 980, 960, 1020,1060,1000],
  "Makita":        [320, 310, 370, 360, 390, 420, 400, 430, 410, 440, 460, 440],
  "Electrodomésticos":          [2110,2050,2440,2400,2600,2730,2640,2830,2750,2960,3080,2910],
  "Línea Blanca":               [1590,1520,1810,1780,1920,2020,1950,2090,2030,2180,2270,2140],
  "Cuidado Personal":           [1870,1780,2110,2080,2250,2360,2270,2450,2370,2540,2650,2490],
  "Materiales de Construcción": [1060,1020,1210,1190,1290,1370,1310,1410,1370,1460,1520,1440],
};

// ── Ticket mensual por elemento (para gráfico dinámico ventas)
const ticketMensualPorElemento = {
  "Falabella":     { actual:[17.2,17.4,17.5,17.6,17.7,17.9,17.8,18.0,17.9,18.1,18.2,18.3], anterior:[16.8,16.9,17.0,17.1,17.2,17.3,17.2,17.4,17.3,17.5,17.6,17.7] },
  "Lider":         { actual:[18.3,18.5,18.6,18.7,18.9,19.0,18.9,19.2,19.0,19.3,19.4,19.5], anterior:[17.8,17.9,18.0,18.1,18.2,18.3,18.2,18.4,18.3,18.5,18.5,18.6] },
  "Jumbo":         { actual:[13.2,13.3,13.4,13.5,13.6,13.7,13.6,13.8,13.7,13.9,14.0,14.1], anterior:[12.9,13.0,13.0,13.1,13.2,13.3,13.2,13.4,13.3,13.5,13.5,13.6] },
  "Sodimac":       { actual:[24.5,24.6,24.8,24.9,25.0,25.2,25.1,25.3,25.2,25.4,25.5,25.7], anterior:[23.9,24.0,24.1,24.2,24.3,24.5,24.4,24.6,24.5,24.7,24.8,25.0] },
  "Tottus":        { actual:[15.1,15.2,15.4,15.5,15.6,15.8,15.7,15.9,15.8,16.0,16.1,16.3], anterior:[14.7,14.8,14.9,15.0,15.1,15.3,15.2,15.4,15.3,15.5,15.6,15.8] },
  "Paris":         { actual:[15.4,15.5,15.7,15.8,15.9,16.0,15.9,16.1,16.0,16.2,16.3,16.4], anterior:[15.0,15.1,15.2,15.3,15.4,15.5,15.4,15.6,15.5,15.7,15.8,15.9] },
  "Mercado Libre": { actual:[18.2,18.4,18.6,18.7,18.8,19.0,18.9,19.2,19.0,19.3,19.4,19.5], anterior:[17.4,17.5,17.6,17.7,17.8,17.9,17.8,18.0,17.9,18.1,18.2,18.3] },
  "Ripley":        { actual:[17.7,17.8,18.0,18.1,18.2,18.4,18.3,18.5,18.4,18.6,18.7,18.8], anterior:[17.2,17.3,17.4,17.5,17.6,17.7,17.6,17.8,17.7,17.9,18.0,18.1] },
  "Easy":          { actual:[21.9,22.0,22.2,22.3,22.4,22.6,22.5,22.7,22.6,22.8,23.0,23.1], anterior:[21.3,21.4,21.5,21.6,21.7,21.8,21.7,21.9,21.8,22.0,22.1,22.2] },
  "La Polar":      { actual:[14.4,14.5,14.6,14.7,14.8,15.0,14.9,15.1,15.0,15.2,15.3,15.4], anterior:[14.1,14.2,14.3,14.4,14.5,14.6,14.5,14.7,14.6,14.8,14.9,15.0] },
  "Hites":         { actual:[17.6,17.8,18.0,18.2,18.3,18.5,18.4,18.6,18.5,18.7,18.8,19.0], anterior:[17.1,17.2,17.3,17.4,17.5,17.6,17.5,17.7,17.6,17.8,17.9,18.0] },
  "Innova Ferre":  { actual:[25.3,25.5,25.7,25.9,26.1,26.3,26.2,26.5,26.4,26.7,26.8,27.0], anterior:[24.6,24.7,24.8,24.9,25.0,25.1,25.0,25.2,25.1,25.3,25.4,25.5] },
  "ABC":           { actual:[16.9,17.1,17.3,17.4,17.5,17.7,17.6,17.8,17.7,17.9,18.0,18.1], anterior:[16.5,16.6,16.7,16.8,16.9,17.0,16.9,17.1,17.0,17.2,17.3,17.4] },
  "Surco":         { actual:[24.9,25.1,25.3,25.5,25.6,25.8,25.7,26.0,25.9,26.2,26.4,26.6], anterior:[24.3,24.4,24.5,24.6,24.7,24.8,24.7,24.9,24.8,25.0,25.1,25.2] },
  "Unimarc":       { actual:[13.9,14.0,14.1,14.2,14.3,14.4,14.3,14.5,14.4,14.6,14.7,14.8], anterior:[13.5,13.6,13.7,13.8,13.9,14.0,13.9,14.1,14.0,14.2,14.3,14.4] },
  "Samsung":       { actual:[16.8,16.9,17.1,17.2,17.3,17.5,17.4,17.6,17.5,17.7,17.8,17.9], anterior:[16.3,16.4,16.5,16.6,16.7,16.8,16.7,16.9,16.8,17.0,17.1,17.2] },
  "LG":            { actual:[17.5,17.6,17.8,17.9,18.1,18.2,18.1,18.3,18.2,18.4,18.5,18.6], anterior:[16.9,17.0,17.1,17.2,17.3,17.4,17.3,17.5,17.4,17.6,17.7,17.8] },
  "Philips":       { actual:[13.4,13.5,13.7,13.8,13.9,14.1,14.0,14.2,14.1,14.3,14.4,14.5], anterior:[13.0,13.1,13.2,13.3,13.4,13.5,13.4,13.6,13.5,13.7,13.8,13.9] },
  "Bosch":         { actual:[22.8,23.0,23.2,23.3,23.5,23.6,23.5,23.8,23.7,23.9,24.0,24.2], anterior:[22.1,22.2,22.3,22.4,22.5,22.6,22.5,22.7,22.6,22.8,22.9,23.0] },
  "Makita":        { actual:[25.2,25.4,25.6,25.8,26.0,26.2,26.1,26.4,26.3,26.6,26.7,26.9], anterior:[24.5,24.6,24.7,24.8,24.9,25.0,24.9,25.1,25.0,25.2,25.3,25.4] },
  "Electrodomésticos":          { actual:[16.8,16.9,17.1,17.2,17.3,17.5,17.4,17.6,17.5,17.7,17.8,17.9], anterior:[16.3,16.4,16.5,16.6,16.7,16.8,16.7,16.9,16.8,17.0,17.1,17.2] },
  "Línea Blanca":               { actual:[17.5,17.6,17.8,17.9,18.1,18.2,18.1,18.3,18.2,18.4,18.5,18.6], anterior:[16.9,17.0,17.1,17.2,17.3,17.4,17.3,17.5,17.4,17.6,17.7,17.8] },
  "Cuidado Personal":           { actual:[13.4,13.5,13.7,13.8,13.9,14.1,14.0,14.2,14.1,14.3,14.4,14.5], anterior:[13.0,13.1,13.2,13.3,13.4,13.5,13.4,13.6,13.5,13.7,13.8,13.9] },
  "Materiales de Construcción": { actual:[22.4,22.6,22.8,23.0,23.1,23.3,23.2,23.5,23.4,23.6,23.8,24.0], anterior:[21.8,21.9,22.0,22.1,22.2,22.3,22.2,22.4,22.3,22.5,22.6,22.7] },
};

// ── Participación mensual por elemento
const participacionMensualPorElemento = (() => {
  const totalMes = ventasMensuales.map(m=>m.actual);
  const result = {};
  [...clientesVentas,...marcasVentas,...sfamiliasVentas].forEach(el => {
    const factor = el.actual / ventasKPI.totalActual;
    const factorAnt = el.anterior / ventasKPI.totalAnterior;
    result[el.nombre] = {
      actual:   totalMes.map(t => +((t * factor / (t * factor + totalMes[0]*0.01)) * 100 * factor).toFixed(1)),
      anterior: totalMes.map(t => +((t * factorAnt / (t * factorAnt + totalMes[0]*0.01)) * 100 * factorAnt).toFixed(1)),
    };
  });
  return result;
})();

// Ticket histórico por SKU
const skuTicketHistorico = {
  "SAM-REF500L":   [{ mes:"Ene",ticket:256,ticketAnt:248 },{ mes:"Feb",ticket:258,ticketAnt:250 },{ mes:"Mar",ticket:260,ticketAnt:252 },{ mes:"Abr",ticket:262,ticketAnt:254 },{ mes:"May",ticket:264,ticketAnt:256 },{ mes:"Jun",ticket:266,ticketAnt:258 },{ mes:"Jul",ticket:264,ticketAnt:257 },{ mes:"Ago",ticket:268,ticketAnt:260 },{ mes:"Sep",ticket:266,ticketAnt:259 },{ mes:"Oct",ticket:270,ticketAnt:262 },{ mes:"Nov",ticket:272,ticketAnt:264 },{ mes:"Dic",ticket:274,ticketAnt:266 }],
  "LG-WASH11KG":   [{ mes:"Ene",ticket:317,ticketAnt:308 },{ mes:"Feb",ticket:320,ticketAnt:310 },{ mes:"Mar",ticket:323,ticketAnt:312 },{ mes:"Abr",ticket:325,ticketAnt:314 },{ mes:"May",ticket:328,ticketAnt:316 },{ mes:"Jun",ticket:330,ticketAnt:318 },{ mes:"Jul",ticket:328,ticketAnt:317 },{ mes:"Ago",ticket:333,ticketAnt:321 },{ mes:"Sep",ticket:331,ticketAnt:319 },{ mes:"Oct",ticket:336,ticketAnt:323 },{ mes:"Nov",ticket:338,ticketAnt:325 },{ mes:"Dic",ticket:340,ticketAnt:327 }],
  "PHI-SHAVER9":   [{ mes:"Ene",ticket:82, ticketAnt:79 },{ mes:"Feb",ticket:83, ticketAnt:80 },{ mes:"Mar",ticket:84, ticketAnt:80 },{ mes:"Abr",ticket:84, ticketAnt:81 },{ mes:"May",ticket:85, ticketAnt:82 },{ mes:"Jun",ticket:85, ticketAnt:82 },{ mes:"Jul",ticket:84, ticketAnt:81 },{ mes:"Ago",ticket:86, ticketAnt:83 },{ mes:"Sep",ticket:85, ticketAnt:82 },{ mes:"Oct",ticket:86, ticketAnt:83 },{ mes:"Nov",ticket:87, ticketAnt:84 },{ mes:"Dic",ticket:87, ticketAnt:84 }],
  "BOS-DRILL18V":  [{ mes:"Ene",ticket:160,ticketAnt:156 },{ mes:"Feb",ticket:161,ticketAnt:157 },{ mes:"Mar",ticket:162,ticketAnt:158 },{ mes:"Abr",ticket:163,ticketAnt:159 },{ mes:"May",ticket:164,ticketAnt:160 },{ mes:"Jun",ticket:165,ticketAnt:160 },{ mes:"Jul",ticket:164,ticketAnt:159 },{ mes:"Ago",ticket:166,ticketAnt:161 },{ mes:"Sep",ticket:165,ticketAnt:160 },{ mes:"Oct",ticket:167,ticketAnt:162 },{ mes:"Nov",ticket:168,ticketAnt:163 },{ mes:"Dic",ticket:168,ticketAnt:163 }],
  "MAK-SAW18V":    [{ mes:"Ene",ticket:200,ticketAnt:194 },{ mes:"Feb",ticket:201,ticketAnt:195 },{ mes:"Mar",ticket:203,ticketAnt:197 },{ mes:"Abr",ticket:204,ticketAnt:198 },{ mes:"May",ticket:206,ticketAnt:199 },{ mes:"Jun",ticket:208,ticketAnt:201 },{ mes:"Jul",ticket:206,ticketAnt:200 },{ mes:"Ago",ticket:209,ticketAnt:203 },{ mes:"Sep",ticket:208,ticketAnt:201 },{ mes:"Oct",ticket:210,ticketAnt:204 },{ mes:"Nov",ticket:211,ticketAnt:205 },{ mes:"Dic",ticket:212,ticketAnt:206 }],
};
function getTicketData(sku) {
  return skuTicketHistorico[sku] || skuTicketHistorico["SAM-REF500L"].map(d=>({ ...d, ticket:+(d.ticket-3).toFixed(1), ticketAnt:+(d.ticketAnt-3).toFixed(1) }));
}

// ── MÁRGENES
const margenesMensuales = [
  { mes:"Ene", margen:23.2, margenAnt:21.8, ventaNeta:6800,  contribucion:1578 },
  { mes:"Feb", margen:22.8, margenAnt:21.5, ventaNeta:6500,  contribucion:1482 },
  { mes:"Mar", margen:24.5, margenAnt:22.4, ventaNeta:7800,  contribucion:1911 },
  { mes:"Abr", margen:23.9, margenAnt:22.1, ventaNeta:7400,  contribucion:1769 },
  { mes:"May", margen:25.2, margenAnt:23.0, ventaNeta:8200,  contribucion:2066 },
  { mes:"Jun", margen:26.1, margenAnt:23.8, ventaNeta:8700,  contribucion:2271 },
  { mes:"Jul", margen:25.4, margenAnt:23.5, ventaNeta:8100,  contribucion:2057 },
  { mes:"Ago", margen:27.2, margenAnt:24.6, ventaNeta:9100,  contribucion:2475 },
  { mes:"Sep", margen:26.8, margenAnt:24.4, ventaNeta:8600,  contribucion:2305 },
  { mes:"Oct", margen:27.5, margenAnt:25.0, ventaNeta:9400,  contribucion:2585 },
  { mes:"Nov", margen:28.4, margenAnt:25.9, ventaNeta:9800,  contribucion:2783 },
  { mes:"Dic", margen:28.9, margenAnt:26.4, ventaNeta:9600,  contribucion:2774 },
];

const clientesMargen = [
  { nombre:"Falabella",     tipo:"cliente", marca:"Samsung", sfamilia:"Electrodomésticos",          venta:18500, costo:13597, rebates:833, contribucion:4070, pctRebate:4.5, margen:22.0, costoMedio:13.07, precioLista:18.18, unidades:1040, benchmark:30.1 },
  { nombre:"Lider",         tipo:"cliente", marca:"LG",      sfamilia:"Línea Blanca",               venta:17000, costo:12631, rebates:714, contribucion:3655, pctRebate:4.2, margen:21.5, costoMedio:14.03, precioLista:19.25, unidades:900,  benchmark:30.1 },
  { nombre:"Jumbo",         tipo:"cliente", marca:"Philips", sfamilia:"Cuidado Personal",           venta:16500, costo:11913, rebates:627, contribucion:3960, pctRebate:3.8, margen:24.0, costoMedio:9.85,  precioLista:13.62, unidades:1210, benchmark:30.1 },
  { nombre:"Sodimac",       tipo:"cliente", marca:"Bosch",   sfamilia:"Materiales de Construcción", venta:7800,  costo:5546,  rebates:421, contribucion:1833, pctRebate:5.4, margen:23.5, costoMedio:17.89, precioLista:25.16, unidades:310,  benchmark:30.1 },
  { nombre:"Tottus",        tipo:"cliente", marca:"Philips", sfamilia:"Cuidado Personal",           venta:6500,  costo:4472,  rebates:208, contribucion:1820, pctRebate:3.2, margen:28.0, costoMedio:10.91, precioLista:15.85, unidades:410,  benchmark:30.1 },
  { nombre:"Paris",         tipo:"cliente", marca:"Samsung", sfamilia:"Electrodomésticos",          venta:6000,  costo:4170,  rebates:240, contribucion:1590, pctRebate:4.0, margen:26.5, costoMedio:10.97, precioLista:15.79, unidades:380,  benchmark:30.1 },
  { nombre:"Mercado Libre", tipo:"cliente", marca:"LG",      sfamilia:"Línea Blanca",               venta:5200,  costo:3598,  rebates:94,  contribucion:1508, pctRebate:1.8, margen:29.0, costoMedio:13.08, precioLista:18.91, unidades:275,  benchmark:30.1 },
  { nombre:"Ripley",        tipo:"cliente", marca:"Samsung", sfamilia:"Electrodomésticos",          venta:4500,  costo:3159,  rebates:216, contribucion:1125, pctRebate:4.8, margen:25.0, costoMedio:12.89, precioLista:18.37, unidades:245,  benchmark:30.1 },
  { nombre:"Easy",          tipo:"cliente", marca:"Bosch",   sfamilia:"Materiales de Construcción", venta:3200,  costo:2000,  rebates:176, contribucion:1024, pctRebate:5.5, margen:32.0, costoMedio:14.29, precioLista:22.86, unidades:140,  benchmark:30.1 },
  { nombre:"La Polar",      tipo:"cliente", marca:"Philips", sfamilia:"Cuidado Personal",           venta:2800,  costo:1739,  rebates:109, contribucion:952,  pctRebate:3.9, margen:34.0, costoMedio:9.40,  precioLista:15.14, unidades:185,  benchmark:30.1 },
  { nombre:"Hites",         tipo:"cliente", marca:"Samsung", sfamilia:"Electrodomésticos",          venta:2600,  costo:1648,  rebates:94,  contribucion:858,  pctRebate:3.6, margen:33.0, costoMedio:11.77, precioLista:18.57, unidades:140,  benchmark:30.1 },
  { nombre:"Innova Ferre",  tipo:"cliente", marca:"Makita",  sfamilia:"Materiales de Construcción", venta:2500,  costo:1497,  rebates:103, contribucion:900,  pctRebate:4.1, margen:36.0, costoMedio:15.76, precioLista:26.32, unidades:95,   benchmark:30.1 },
  { nombre:"ABC",           tipo:"cliente", marca:"LG",      sfamilia:"Línea Blanca",               venta:2400,  costo:1572,  rebates:84,  contribucion:744,  pctRebate:3.5, margen:31.0, costoMedio:11.64, precioLista:17.78, unidades:135,  benchmark:30.1 },
  { nombre:"Surco",         tipo:"cliente", marca:"Makita",  sfamilia:"Materiales de Construcción", venta:2300,  costo:1396,  rebates:99,  contribucion:805,  pctRebate:4.3, margen:35.0, costoMedio:15.86, precioLista:26.14, unidades:88,   benchmark:30.1 },
  { nombre:"Unimarc",       tipo:"cliente", marca:"Philips", sfamilia:"Cuidado Personal",           venta:2200,  costo:1419,  rebates:66,  contribucion:715,  pctRebate:3.0, margen:32.5, costoMedio:9.46,  precioLista:14.67, unidades:150,  benchmark:30.1 },
];
const sfamiliasMargen = [
  { nombre:"Electrodomésticos",          tipo:"sfamilia", marca:"Samsung", sfamilia:"Electrodomésticos",          venta:31600, costo:22574, rebates:1383, contribucion:7643, pctRebate:4.4, margen:24.2, costoMedio:12.51, precioLista:17.51, unidades:1805, benchmark:30.1 },
  { nombre:"Línea Blanca",               tipo:"sfamilia", marca:"LG",      sfamilia:"Línea Blanca",               venta:24600, costo:17801, rebates:892,  contribucion:5907, pctRebate:3.6, margen:24.0, costoMedio:13.59, precioLista:18.78, unidades:1310, benchmark:30.1 },
  { nombre:"Cuidado Personal",           tipo:"sfamilia", marca:"Philips", sfamilia:"Cuidado Personal",           venta:28000, costo:19543, rebates:1010, contribucion:7447, pctRebate:3.6, margen:26.6, costoMedio:10.00, precioLista:14.32, unidades:1955, benchmark:30.1 },
  { nombre:"Materiales de Construcción", tipo:"sfamilia", marca:"Bosch",   sfamilia:"Materiales de Construcción", venta:15800, costo:10439, rebates:799,  contribucion:4562, pctRebate:5.1, margen:28.9, costoMedio:16.49, precioLista:24.96, unidades:633,  benchmark:30.1 },
];
const skusMargen = [
  { nombre:"SAM-REF500L",  tipo:"sku", marca:"Samsung", sfamilia:"Electrodomésticos",          venta:10800, costo:7884, rebates:486, contribucion:2430, pctRebate:4.5, margen:22.5, costoMedio:183.35, precioLista:251.16, unidades:43,  benchmark:30.1 },
  { nombre:"SAM-TV55",     tipo:"sku", marca:"Samsung", sfamilia:"Electrodomésticos",          venta:13300, costo:10241,rebates:599, contribucion:2460, pctRebate:4.5, margen:18.5, costoMedio:512.05, precioLista:665.00, unidades:20,  benchmark:30.1 },
  { nombre:"SAM-MICRO32L", tipo:"sku", marca:"Samsung", sfamilia:"Electrodomésticos",          venta:7500,  costo:5100, rebates:300, contribucion:2100, pctRebate:4.0, margen:28.0, costoMedio:77.27,  precioLista:110.39, unidades:66,  benchmark:30.1 },
  { nombre:"LG-WASH11KG",  tipo:"sku", marca:"LG",      sfamilia:"Línea Blanca",               venta:12400, costo:9176, rebates:372, contribucion:2852, pctRebate:3.0, margen:23.0, costoMedio:229.40, precioLista:310.00, unidades:40,  benchmark:30.1 },
  { nombre:"LG-DRYER8KG",  tipo:"sku", marca:"LG",      sfamilia:"Línea Blanca",               venta:5600,  costo:4668, rebates:308, contribucion:624,  pctRebate:5.5, margen:11.1, costoMedio:274.59, precioLista:329.41, unidades:17,  benchmark:30.1 },
  { nombre:"LG-AIR9000",   tipo:"sku", marca:"LG",      sfamilia:"Línea Blanca",               venta:6600,  costo:4455, rebates:297, contribucion:1848, pctRebate:4.5, margen:28.0, costoMedio:127.29, precioLista:177.14, unidades:35,  benchmark:30.1 },
  { nombre:"PHI-SHAVER9",  tipo:"sku", marca:"Philips", sfamilia:"Cuidado Personal",           venta:12300, costo:8413, rebates:443, contribucion:3444, pctRebate:3.6, margen:28.0, costoMedio:56.84,  precioLista:83.11,  unidades:148, benchmark:30.1 },
  { nombre:"PHI-HAIR-PRO", tipo:"sku", marca:"Philips", sfamilia:"Cuidado Personal",           venta:9300,  costo:6212, rebates:298, contribucion:2790, pctRebate:3.2, margen:30.0, costoMedio:47.42,  precioLista:67.75,  unidades:131, benchmark:30.1 },
  { nombre:"PHI-IRON-PRO", tipo:"sku", marca:"Philips", sfamilia:"Cuidado Personal",           venta:6400,  costo:4749, rebates:243, contribucion:1408, pctRebate:3.8, margen:22.0, costoMedio:48.46,  precioLista:62.13,  unidades:98,  benchmark:30.1 },
  { nombre:"BOS-DRILL18V", tipo:"sku", marca:"Bosch",   sfamilia:"Materiales de Construcción", venta:6800,  costo:4623, rebates:340, contribucion:1837, pctRebate:5.0, margen:27.0, costoMedio:115.58, precioLista:170.00, unidades:40,  benchmark:30.1 },
  { nombre:"BOS-SANDER",   tipo:"sku", marca:"Bosch",   sfamilia:"Materiales de Construcción", venta:4200,  costo:3226, rebates:218, contribucion:756,  pctRebate:5.2, margen:18.0, costoMedio:189.76, precioLista:247.06, unidades:17,  benchmark:30.1 },
  { nombre:"MAK-SAW18V",   tipo:"sku", marca:"Makita",  sfamilia:"Materiales de Construcción", venta:3100,  costo:1922, rebates:124, contribucion:1054, pctRebate:4.0, margen:34.0, costoMedio:128.13, precioLista:206.67, unidades:15,  benchmark:30.1 },
  { nombre:"MAK-COMP-AIR", tipo:"sku", marca:"Makita",  sfamilia:"Materiales de Construcción", venta:1700,  costo:1463, rebates:102, contribucion:135,  pctRebate:6.0, margen:7.9,  costoMedio:365.75, precioLista:425.00, unidades:4,   benchmark:30.1 },
];
// Lookup de CMP y PPV por SKU — fuente única desde datos de márgenes
const SKU_PRICING = Object.fromEntries(
  skusMargen.map(d => [
    d.nombre, { cmp: d.costoMedio, ppv: +(d.venta / d.unidades).toFixed(2) }
  ])
);
const marcasMargen = [
  { nombre:"Samsung", tipo:"marca", marca:"Samsung", sfamilia:"Electrodomésticos",          venta:31600, costo:22574, rebates:1383, contribucion:7643, pctRebate:4.4, margen:24.2, costoMedio:12.51, precioLista:17.51, unidades:1805, benchmark:30.1 },
  { nombre:"LG",      tipo:"marca", marca:"LG",      sfamilia:"Línea Blanca",               venta:24600, costo:17801, rebates:892,  contribucion:5907, pctRebate:3.6, margen:24.0, costoMedio:13.59, precioLista:18.78, unidades:1310, benchmark:30.1 },
  { nombre:"Philips", tipo:"marca", marca:"Philips", sfamilia:"Cuidado Personal",           venta:28000, costo:19543, rebates:1010, contribucion:7447, pctRebate:3.6, margen:26.6, costoMedio:10.00, precioLista:14.32, unidades:1955, benchmark:30.1 },
  { nombre:"Bosch",   tipo:"marca", marca:"Bosch",   sfamilia:"Materiales de Construcción", venta:11000, costo:7546,  rebates:597,  contribucion:2857, pctRebate:5.4, margen:26.0, costoMedio:16.77, precioLista:24.44, unidades:450,  benchmark:30.1 },
  { nombre:"Makita",  tipo:"marca", marca:"Makita",  sfamilia:"Materiales de Construcción", venta:4800,  costo:2893,  rebates:202,  contribucion:1705, pctRebate:4.2, margen:35.5, costoMedio:15.81, precioLista:26.23, unidades:183,  benchmark:30.1 },
];

const margenKPI = { pct:25.6, pctAnt:23.8, totalUSD:25559, gapPuntos:1.8 };

// Histórico dinámico por nombre (para gráfico dinámico de márgenes)
// Histórico completo de márgenes por elemento — 12 meses, sin restricción temporal
// CONTRIBUCIÓN: distribuida proporcionalmente a ventasMensuales para que la suma
// de los 12 meses cuadre EXACTAMENTE con el total anual de clientesMargen/etc.
const historialMargen = (() => {
  const defs = {
    "Falabella":     { vBase:1350, vDic:1780, margen:22.0, rBase:60, rDic:80, cmBase:14.0, cmDic:13.7, tBase:17.6, tDic:18.1, plBase:19.0, plDic:18.6 },
    "Lider":         { vBase:1250, vDic:1650, margen:21.5, rBase:52, rDic:70, cmBase:15.2, cmDic:14.9, tBase:18.5, tDic:19.2, plBase:20.0, plDic:19.7 },
    "Jumbo":         { vBase:1200, vDic:1600, margen:24.0, rBase:45, rDic:62, cmBase:9.8,  cmDic:9.5,  tBase:13.0, tDic:13.9, plBase:14.2, plDic:13.9 },
    "Sodimac":       { vBase:580,  vDic:760,  margen:23.5, rBase:30, rDic:42, cmBase:19.0, cmDic:18.7, tBase:24.5, tDic:25.7, plBase:26.2, plDic:25.8 },
    "Tottus":        { vBase:480,  vDic:640,  margen:28.0, rBase:15, rDic:20, cmBase:11.4, cmDic:11.1, tBase:15.2, tDic:16.3, plBase:16.8, plDic:16.5 },
    "Paris":         { vBase:440,  vDic:590,  margen:26.5, rBase:17, rDic:24, cmBase:11.8, cmDic:11.5, tBase:15.5, tDic:16.1, plBase:17.0, plDic:16.7 },
    "Mercado Libre": { vBase:380,  vDic:510,  margen:29.0, rBase:7,  rDic:10, cmBase:13.5, cmDic:13.2, tBase:18.3, tDic:19.4, plBase:20.5, plDic:20.2 },
    "Ripley":        { vBase:340,  vDic:440,  margen:25.0, rBase:15, rDic:22, cmBase:13.8, cmDic:13.5, tBase:17.8, tDic:18.6, plBase:19.5, plDic:19.2 },
    "Easy":          { vBase:240,  vDic:310,  margen:32.0, rBase:13, rDic:18, cmBase:15.5, cmDic:15.2, tBase:22.0, tDic:23.2, plBase:23.5, plDic:23.1 },
    "La Polar":      { vBase:210,  vDic:280,  margen:34.0, rBase:9,  rDic:12, cmBase:10.0, cmDic:9.7,  tBase:14.5, tDic:15.4, plBase:16.2, plDic:15.9 },
    "Hites":         { vBase:195,  vDic:260,  margen:33.0, rBase:7,  rDic:10, cmBase:12.4, cmDic:12.1, tBase:17.6, tDic:18.9, plBase:20.0, plDic:19.6 },
    "Innova Ferre":  { vBase:188,  vDic:250,  margen:36.0, rBase:7,  rDic:10, cmBase:16.8, cmDic:16.5, tBase:25.5, tDic:27.0, plBase:27.2, plDic:26.8 },
    "ABC":           { vBase:180,  vDic:240,  margen:31.0, rBase:6,  rDic:9,  cmBase:12.3, cmDic:12.0, tBase:17.0, tDic:18.0, plBase:18.8, plDic:18.5 },
    "Surco":         { vBase:172,  vDic:230,  margen:35.0, rBase:7,  rDic:10, cmBase:17.0, cmDic:16.6, tBase:25.0, tDic:26.8, plBase:27.0, plDic:26.5 },
    "Unimarc":       { vBase:165,  vDic:220,  margen:32.5, rBase:5,  rDic:7,  cmBase:10.0, cmDic:9.7,  tBase:14.0, tDic:15.0, plBase:15.5, plDic:15.2 },
    "Electrodom\u00e9sticos":          { vBase:2370, vDic:3130, margen:24.2, rBase:99, rDic:133,cmBase:13.5, cmDic:13.1, tBase:16.8, tDic:17.8, plBase:18.0, plDic:17.7 },
    "L\u00ednea Blanca":               { vBase:1840, vDic:2450, margen:24.0, rBase:77, rDic:103,cmBase:14.5, cmDic:14.2, tBase:17.5, tDic:18.4, plBase:19.0, plDic:18.7 },
    "Cuidado Personal":                { vBase:2080, vDic:2780, margen:26.6, rBase:73, rDic:97, cmBase:10.2, cmDic:9.9,  tBase:13.4, tDic:14.4, plBase:14.8, plDic:14.5 },
    "Materiales de Construcci\u00f3n": { vBase:1180, vDic:1580, margen:28.9, rBase:55, rDic:74, cmBase:17.3, cmDic:17.0, tBase:22.4, tDic:23.6, plBase:24.0, plDic:23.6 },
    "Samsung":       { vBase:2370, vDic:3130, margen:24.2, rBase:99, rDic:133,cmBase:13.5, cmDic:13.1, tBase:16.8, tDic:17.8, plBase:18.0, plDic:17.7 },
    "LG":            { vBase:1840, vDic:2450, margen:24.0, rBase:77, rDic:103,cmBase:14.5, cmDic:14.2, tBase:17.5, tDic:18.4, plBase:19.0, plDic:18.7 },
    "Philips":       { vBase:2080, vDic:2780, margen:26.6, rBase:73, rDic:97, cmBase:10.2, cmDic:9.9,  tBase:13.4, tDic:14.4, plBase:14.8, plDic:14.5 },
    "Bosch":         { vBase:820,  vDic:1100, margen:26.0, rBase:41, rDic:56, cmBase:18.1, cmDic:17.8, tBase:22.8, tDic:24.2, plBase:25.0, plDic:24.7 },
    "Makita":        { vBase:360,  vDic:480,  margen:35.5, rBase:14, rDic:20, cmBase:16.8, cmDic:16.5, tBase:25.2, tDic:26.8, plBase:26.6, plDic:26.3 },
    "SAM-REF500L":   { vBase:820,  vDic:1100, margen:22.5, rBase:37, rDic:50, cmBase:195.0,cmDic:192.0,tBase:256.0,tDic:272.0,plBase:272.0,plDic:268.0 },
    "LG-WASH11KG":   { vBase:940,  vDic:1260, margen:23.0, rBase:28, rDic:38, cmBase:244.0,cmDic:240.0,tBase:317.0,tDic:340.0,plBase:345.0,plDic:340.0 },
    "PHI-SHAVER9":   { vBase:930,  vDic:1240, margen:28.0, rBase:33, rDic:45, cmBase:59.0, cmDic:57.7, tBase:82.0, tDic:87.0, plBase:88.0, plDic:86.5 },
    "BOS-DRILL18V":  { vBase:515,  vDic:690,  margen:27.0, rBase:26, rDic:35, cmBase:117.0,cmDic:114.5,tBase:160.0,tDic:168.0,plBase:172.0,plDic:169.5 },
    "MAK-SAW18V":    { vBase:235,  vDic:315,  margen:34.0, rBase:9,  rDic:13, cmBase:132.0,cmDic:129.2,tBase:200.0,tDic:212.0,plBase:216.0,plDic:212.5 },
    "SAM-TV55":      { vBase:1010, vDic:1340, margen:18.5, rBase:45, rDic:60, cmBase:520.0,cmDic:510.0,tBase:660.0,tDic:672.0,plBase:680.0,plDic:670.0 },
    "LG-DRYER8KG":   { vBase:420,  vDic:570,  margen:11.1, rBase:23, rDic:31, cmBase:276.0,cmDic:272.0,tBase:322.0,tDic:335.0,plBase:335.0,plDic:328.0 },
    "MAK-COMP-AIR":  { vBase:128,  vDic:172,  margen:7.9,  rBase:8,  rDic:10, cmBase:368.0,cmDic:362.0,tBase:420.0,tDic:430.0,plBase:430.0,plDic:420.0 },
    "SAM-MICRO32L":  { vBase:570,  vDic:760,  margen:25.0, rBase:26, rDic:35, cmBase:86.0, cmDic:84.5, tBase:114.0,tDic:120.5,plBase:122.0,plDic:120.0 },
    "PHI-HAIR-PRO":  { vBase:700,  vDic:940,  margen:29.0, rBase:25, rDic:33, cmBase:49.0, cmDic:47.8, tBase:68.0, tDic:72.1, plBase:73.0, plDic:71.8 },
    "LG-AIR9000":    { vBase:500,  vDic:670,  margen:22.0, rBase:28, rDic:38, cmBase:142.0,cmDic:140.0,tBase:181.0,tDic:189.0,plBase:194.0,plDic:191.5 },
    "PHI-IRON-PRO":  { vBase:485,  vDic:650,  margen:21.0, rBase:20, rDic:27, cmBase:51.5, cmDic:50.1, tBase:64.0, tDic:68.0, plBase:69.0, plDic:67.5 },
    "BOS-SANDER":    { vBase:315,  vDic:420,  margen:15.0, rBase:19, rDic:26, cmBase:210.0,cmDic:208.5,tBase:248.0,tDic:258.0,plBase:260.0,plDic:256.0 },
  };

  // Totales anuales exactos — fuente \u00fanica de verdad
  const contribucionAnual = {
    "Falabella":4070,"Lider":3655,"Jumbo":3960,"Sodimac":1833,"Tottus":1820,
    "Paris":1590,"Mercado Libre":1508,"Ripley":1125,"Easy":1024,"La Polar":952,
    "Hites":858,"Innova Ferre":900,"ABC":744,"Surco":805,"Unimarc":715,
    "Electrodom\u00e9sticos":7643,"L\u00ednea Blanca":5907,"Cuidado Personal":7447,"Materiales de Construcci\u00f3n":4562,
    "Samsung":7643,"LG":5907,"Philips":7447,"Bosch":2857,"Makita":1705,
    "SAM-REF500L":2430,"LG-WASH11KG":2852,"PHI-SHAVER9":3444,"BOS-DRILL18V":1837,"MAK-SAW18V":1054,
    "SAM-TV55":2460,"LG-DRYER8KG":624,"MAK-COMP-AIR":135,
    "SAM-MICRO32L":1560,"PHI-HAIR-PRO":2480,"LG-AIR9000":1290,"PHI-IRON-PRO":1330,"BOS-SANDER":570,
  };

  // Fracciones mensuales basadas en ventasMensuales (curva de negocio real)
  const ventasBase = [6800,6500,7800,7400,8200,8700,8100,9100,8600,9400,9800,9600];
  const totalVB    = ventasBase.reduce((s,v)=>s+v,0);
  const fracs      = ventasBase.map(v=>v/totalVB);

  // Distribuir un total en 12 meses proporcionales; ajusta el \u00faltimo para cuadrar exacto
  const distribuir = (total) => {
    const m = fracs.map(f => Math.round(f * total));
    m[11] += total - m.reduce((s,v)=>s+v,0);
    return m;
  };

  const MESES = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];
  const lerp  = (a,b,t) => +(a + (b-a)*t).toFixed(2);
  const result = {};

  Object.entries(defs).forEach(([nombre, d]) => {
    const totalContrib    = contribucionAnual[nombre] ?? Math.round((d.vBase+d.vDic)*6*d.margen/100);
    const margenAnt       = +(d.margen - 1.8).toFixed(1);
    const totalContribAnt = Math.round(totalContrib / 1.081 * ((d.margen - 1.8) / d.margen));
    const contribM        = distribuir(totalContrib);
    const contribAntM     = distribuir(totalContribAnt);

    result[nombre] = MESES.map((mes,i) => {
      const t = i/11;
      const venta   = Math.round(lerp(d.vBase, d.vDic, t));
      return {
        mes, venta, ventaAnt: Math.round(venta/1.081),
        contribucion:    contribM[i],
        contribucionAnt: contribAntM[i],
        margen:d.margen, margenAnt,
        rebates:     Math.round(lerp(d.rBase,  d.rDic,  t)),
        costoMedio:  lerp(d.cmBase, d.cmDic, t),
        ticket:      lerp(d.tBase,  d.tDic,  t),
        precioLista: lerp(d.plBase, d.plDic, t),
      };
    });
  });
  return result;
})();

function getHistorialMargen(nombre) {
  // Siempre devuelve 12 meses — sin restricción temporal
  if (historialMargen[nombre]) return historialMargen[nombre];
  // Fallback genérico con 12 meses al margen benchmark
  const MESES = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];
  return MESES.map((mes,i) => {
    const t = i/11;
    const venta = Math.round(700 + 260*t);
    const contribucion = Math.round(venta * 0.301);
    const ventaAnt = Math.round(venta / 1.081);
    const contribucionAnt = Math.round(ventaAnt * 0.283);
    return { mes, venta, ventaAnt, contribucion, contribucionAnt, margen:30.1, margenAnt:28.3, rebates:Math.round(venta*0.035), costoMedio:14.0, ticket:+(18.5+1.2*t).toFixed(1), precioLista:+(20.5+0.5*t).toFixed(2) };
  });
}

// ── INVENTARIO
const invMensual = [
  { mes:"Ene", stockVal:118000, doh:46, rotacion:7.9 }, { mes:"Feb", stockVal:122000, doh:48, rotacion:7.6 },
  { mes:"Mar", stockVal:126000, doh:47, rotacion:7.8 }, { mes:"Abr", stockVal:129000, doh:49, rotacion:7.4 },
  { mes:"May", stockVal:124000, doh:45, rotacion:8.1 }, { mes:"Jun", stockVal:127000, doh:44, rotacion:8.3 },
  { mes:"Jul", stockVal:132000, doh:48, rotacion:7.6 }, { mes:"Ago", stockVal:138000, doh:49, rotacion:7.4 },
  { mes:"Sep", stockVal:133000, doh:47, rotacion:7.8 }, { mes:"Oct", stockVal:136000, doh:46, rotacion:7.9 },
  { mes:"Nov", stockVal:141000, doh:48, rotacion:7.6 }, { mes:"Dic", stockVal:135000, doh:48, rotacion:7.6 },
];
const invMensualPorFiltro = {
  total:invMensual,
  "Electrodomésticos":invMensual.map(d=>({ ...d, stockVal:Math.round(d.stockVal*0.29), doh:d.doh-6,  rotacion:+(d.rotacion+1.1).toFixed(1) })),
  "Línea Blanca":invMensual.map(d=>({      ...d, stockVal:Math.round(d.stockVal*0.25), doh:d.doh+8,  rotacion:+(d.rotacion-0.9).toFixed(1) })),
  "Cuidado Personal":invMensual.map(d=>({  ...d, stockVal:Math.round(d.stockVal*0.21), doh:d.doh-12, rotacion:+(d.rotacion+2.0).toFixed(1) })),
  "Materiales de Construcción":invMensual.map(d=>({ ...d, stockVal:Math.round(d.stockVal*0.25), doh:d.doh+10, rotacion:+(d.rotacion-1.2).toFixed(1) })),
  Samsung:invMensual.map(d=>({ ...d, stockVal:Math.round(d.stockVal*0.29), doh:d.doh-6,  rotacion:+(d.rotacion+1.1).toFixed(1) })),
  LG:invMensual.map(d=>({      ...d, stockVal:Math.round(d.stockVal*0.25), doh:d.doh+8,  rotacion:+(d.rotacion-0.9).toFixed(1) })),
  Philips:invMensual.map(d=>({ ...d, stockVal:Math.round(d.stockVal*0.21), doh:d.doh-12, rotacion:+(d.rotacion+2.0).toFixed(1) })),
  Bosch:invMensual.map(d=>({   ...d, stockVal:Math.round(d.stockVal*0.16), doh:d.doh+4,  rotacion:+(d.rotacion-0.4).toFixed(1) })),
  Makita:invMensual.map(d=>({  ...d, stockVal:Math.round(d.stockVal*0.09), doh:d.doh+22, rotacion:+(d.rotacion-2.1).toFixed(1) })),
};
const invInmovilizado = [
  { rango:"+120 días", valor:22000, pct:16.3, color:C.red,    filtro:"120d" },
  { rango:"+90 días",  valor:11200, pct:8.3,  color:"#f97316",filtro:"90d"  },
  { rango:"+60 días",  valor:22600, pct:16.7, color:C.amber,  filtro:"60d"  },
  { rango:"Activo",    valor:79200, pct:58.7, color:C.green,  filtro:"ok"   },
];
const skuInventario = [
  { sku:"SAM-REF500L",  bodega:"Santiago",    marca:"Samsung", sfamilia:"Electrodomésticos",          stockUSD:18600,stockUnd:72, ventaDiaria:4.2, vendidoMes:126, rotacion:9.8, doh:17,  cobertura:18,  margenPct:22, diasSinVenta:0,  estado:"Activo", alerta:"ok",   pctInv:13.8 },
  { sku:"LG-WASH11KG",  bodega:"Santiago",    marca:"LG",      sfamilia:"Línea Blanca",               stockUSD:15200,stockUnd:48, ventaDiaria:3.1, vendidoMes:93,  rotacion:8.6, doh:21,  cobertura:22,  margenPct:23, diasSinVenta:0,  estado:"Activo", alerta:"ok",   pctInv:11.3 },
  { sku:"SAM-TV55",     bodega:"Santiago",    marca:"Samsung", sfamilia:"Electrodomésticos",          stockUSD:12800,stockUnd:18, ventaDiaria:0.8, vendidoMes:24,  rotacion:3.6, doh:58,  cobertura:30,  margenPct:19, diasSinVenta:12, estado:"Lento",  alerta:"warn", pctInv:9.5  },
  { sku:"LG-DRYER8KG",  bodega:"Valparaíso",  marca:"LG",      sfamilia:"Línea Blanca",               stockUSD:13600,stockUnd:42, ventaDiaria:0.2, vendidoMes:6,   rotacion:1.0, doh:165, cobertura:165, margenPct:11, diasSinVenta:94, estado:"120d",   alerta:"crit", pctInv:10.1 },
  { sku:"PHI-SHAVER9",  bodega:"Santiago",    marca:"Philips", sfamilia:"Cuidado Personal",           stockUSD:11400,stockUnd:140,ventaDiaria:6.5, vendidoMes:195, rotacion:11.2,doh:15,  cobertura:18,  margenPct:28, diasSinVenta:0,  estado:"Activo", alerta:"ok",   pctInv:8.4  },
  { sku:"BOS-SANDER",   bodega:"Valparaíso",  marca:"Bosch",   sfamilia:"Materiales de Construcción", stockUSD:11200,stockUnd:45, ventaDiaria:0.4, vendidoMes:12,  rotacion:1.6, doh:115, cobertura:115, margenPct:15, diasSinVenta:68, estado:"90d",    alerta:"warn", pctInv:8.3  },
  { sku:"PHI-IRON-PRO", bodega:"Concepción",  marca:"Philips", sfamilia:"Cuidado Personal",           stockUSD:9800, stockUnd:140,ventaDiaria:1.2, vendidoMes:36,  rotacion:2.4, doh:95,  cobertura:95,  margenPct:21, diasSinVenta:35, estado:"60d",    alerta:"warn", pctInv:7.3  },
  { sku:"BOS-DRILL18V", bodega:"Concepción",  marca:"Bosch",   sfamilia:"Materiales de Construcción", stockUSD:9600, stockUnd:60, ventaDiaria:2.8, vendidoMes:84,  rotacion:8.1, doh:22,  cobertura:22,  margenPct:27, diasSinVenta:0,  estado:"Activo", alerta:"ok",   pctInv:7.1  },
  { sku:"MAK-COMP-AIR", bodega:"Antofagasta", marca:"Makita",  sfamilia:"Materiales de Construcción", stockUSD:8400, stockUnd:15, ventaDiaria:0.1, vendidoMes:3,   rotacion:0.8, doh:190, cobertura:190, margenPct:8,  diasSinVenta:112,estado:"120d",   alerta:"crit", pctInv:6.2  },
  { sku:"SAM-MICRO32L", bodega:"Valparaíso",  marca:"Samsung", sfamilia:"Electrodomésticos",          stockUSD:7800, stockUnd:68, ventaDiaria:2.4, vendidoMes:72,  rotacion:7.4, doh:24,  cobertura:22,  margenPct:25, diasSinVenta:1,  estado:"Activo", alerta:"ok",   pctInv:5.8  },
  { sku:"PHI-HAIR-PRO", bodega:"Valparaíso",  marca:"Philips", sfamilia:"Cuidado Personal",           stockUSD:6400, stockUnd:92, ventaDiaria:4.0, vendidoMes:120, rotacion:10.1,doh:19,  cobertura:20,  margenPct:29, diasSinVenta:0,  estado:"Activo", alerta:"ok",   pctInv:4.7  },
  { sku:"LG-AIR9000",   bodega:"Santiago",    marca:"LG",      sfamilia:"Línea Blanca",               stockUSD:5800, stockUnd:32, ventaDiaria:1.5, vendidoMes:45,  rotacion:5.8, doh:32,  cobertura:25,  margenPct:22, diasSinVenta:2,  estado:"Activo", alerta:"ok",   pctInv:4.3  },
  { sku:"MAK-SAW18V",   bodega:"Antofagasta", marca:"Makita",  sfamilia:"Materiales de Construcción", stockUSD:4400, stockUnd:24, ventaDiaria:1.1, vendidoMes:33,  rotacion:5.2, doh:33,  cobertura:25,  margenPct:34, diasSinVenta:3,  estado:"Activo", alerta:"ok",   pctInv:3.3  },
];
const skuEvolucion = {
  "LG-DRYER8KG":   [{ mes:"Ene",stock:22400,doh:105 },{ mes:"Feb",stock:21600,doh:112 },{ mes:"Mar",stock:20800,doh:118 },{ mes:"Abr",stock:20000,doh:124 },{ mes:"May",stock:19200,doh:130 },{ mes:"Jun",stock:18400,doh:136 },{ mes:"Jul",stock:16800,doh:142 },{ mes:"Ago",stock:15900,doh:150 },{ mes:"Sep",stock:14900,doh:155 },{ mes:"Oct",stock:14300,doh:160 },{ mes:"Nov",stock:13900,doh:163 },{ mes:"Dic",stock:13600,doh:165 }],
  "MAK-COMP-AIR":  [{ mes:"Ene",stock:14400,doh:130 },{ mes:"Feb",stock:13800,doh:140 },{ mes:"Mar",stock:13200,doh:148 },{ mes:"Abr",stock:12600,doh:155 },{ mes:"May",stock:12000,doh:160 },{ mes:"Jun",stock:11400,doh:165 },{ mes:"Jul",stock:10200,doh:170 },{ mes:"Ago",stock:9800, doh:175 },{ mes:"Sep",stock:9400, doh:180 },{ mes:"Oct",stock:9000, doh:184 },{ mes:"Nov",stock:8700, doh:187 },{ mes:"Dic",stock:8400, doh:190 }],
  "SAM-REF500L":   [{ mes:"Ene",stock:9800, doh:28  },{ mes:"Feb",stock:10400,doh:26  },{ mes:"Mar",stock:11200,doh:25  },{ mes:"Abr",stock:12000,doh:24  },{ mes:"May",stock:12800,doh:23  },{ mes:"Jun",stock:13600,doh:21  },{ mes:"Jul",stock:14200,doh:20  },{ mes:"Ago",stock:15400,doh:19  },{ mes:"Sep",stock:16800,doh:18  },{ mes:"Oct",stock:17600,doh:18  },{ mes:"Nov",stock:18400,doh:17  },{ mes:"Dic",stock:18600,doh:17  }],
  "BOS-SANDER":    [{ mes:"Ene",stock:17200,doh:60  },{ mes:"Feb",stock:16800,doh:65  },{ mes:"Mar",stock:16200,doh:70  },{ mes:"Abr",stock:15600,doh:74  },{ mes:"May",stock:15000,doh:79  },{ mes:"Jun",stock:14200,doh:84  },{ mes:"Jul",stock:13400,doh:90  },{ mes:"Ago",stock:12800,doh:98  },{ mes:"Sep",stock:12200,doh:105 },{ mes:"Oct",stock:11800,doh:110 },{ mes:"Nov",stock:11400,doh:113 },{ mes:"Dic",stock:11200,doh:115 }],
  "PHI-IRON-PRO":  [{ mes:"Ene",stock:10400,doh:28  },{ mes:"Feb",stock:10200,doh:32  },{ mes:"Mar",stock:10000,doh:36  },{ mes:"Abr",stock:9800, doh:40  },{ mes:"May",stock:9400, doh:46  },{ mes:"Jun",stock:8800, doh:52  },{ mes:"Jul",stock:8000, doh:58  },{ mes:"Ago",stock:8400, doh:66  },{ mes:"Sep",stock:8900, doh:75  },{ mes:"Oct",stock:9200, doh:82  },{ mes:"Nov",stock:9500, doh:88  },{ mes:"Dic",stock:9800, doh:95  }],
  "LG-WASH11KG":   [{ mes:"Ene",stock:18200,doh:18  },{ mes:"Feb",stock:17400,doh:19  },{ mes:"Mar",stock:16800,doh:20  },{ mes:"Abr",stock:16200,doh:20  },{ mes:"May",stock:15800,doh:21  },{ mes:"Jun",stock:15400,doh:21  },{ mes:"Jul",stock:15200,doh:21  },{ mes:"Ago",stock:15000,doh:21  },{ mes:"Sep",stock:15100,doh:21  },{ mes:"Oct",stock:15100,doh:21  },{ mes:"Nov",stock:15200,doh:21  },{ mes:"Dic",stock:15200,doh:21  }],
  "SAM-TV55":      [{ mes:"Ene",stock:10400,doh:36  },{ mes:"Feb",stock:10800,doh:38  },{ mes:"Mar",stock:11200,doh:40  },{ mes:"Abr",stock:11600,doh:42  },{ mes:"May",stock:12000,doh:44  },{ mes:"Jun",stock:12400,doh:48  },{ mes:"Jul",stock:12600,doh:52  },{ mes:"Ago",stock:12800,doh:54  },{ mes:"Sep",stock:12800,doh:56  },{ mes:"Oct",stock:12800,doh:57  },{ mes:"Nov",stock:12800,doh:58  },{ mes:"Dic",stock:12800,doh:58  }],
  "PHI-SHAVER9":   [{ mes:"Ene",stock:9800, doh:16  },{ mes:"Feb",stock:10200,doh:15  },{ mes:"Mar",stock:10600,doh:15  },{ mes:"Abr",stock:10800,doh:15  },{ mes:"May",stock:11000,doh:15  },{ mes:"Jun",stock:11200,doh:15  },{ mes:"Jul",stock:11200,doh:15  },{ mes:"Ago",stock:11300,doh:15  },{ mes:"Sep",stock:11400,doh:15  },{ mes:"Oct",stock:11400,doh:15  },{ mes:"Nov",stock:11400,doh:15  },{ mes:"Dic",stock:11400,doh:15  }],
  "BOS-DRILL18V":  [{ mes:"Ene",stock:8200, doh:24  },{ mes:"Feb",stock:8400, doh:23  },{ mes:"Mar",stock:8600, doh:23  },{ mes:"Abr",stock:8800, doh:23  },{ mes:"May",stock:9000, doh:22  },{ mes:"Jun",stock:9200, doh:22  },{ mes:"Jul",stock:9400, doh:22  },{ mes:"Ago",stock:9500, doh:22  },{ mes:"Sep",stock:9600, doh:22  },{ mes:"Oct",stock:9600, doh:22  },{ mes:"Nov",stock:9600, doh:22  },{ mes:"Dic",stock:9600, doh:22  }],
  "SAM-MICRO32L":  [{ mes:"Ene",stock:7200, doh:26  },{ mes:"Feb",stock:7300, doh:25  },{ mes:"Mar",stock:7400, doh:25  },{ mes:"Abr",stock:7500, doh:25  },{ mes:"May",stock:7600, doh:24  },{ mes:"Jun",stock:7700, doh:24  },{ mes:"Jul",stock:7700, doh:24  },{ mes:"Ago",stock:7800, doh:24  },{ mes:"Sep",stock:7800, doh:24  },{ mes:"Oct",stock:7800, doh:24  },{ mes:"Nov",stock:7800, doh:24  },{ mes:"Dic",stock:7800, doh:24  }],
  "PHI-HAIR-PRO":  [{ mes:"Ene",stock:5800, doh:20  },{ mes:"Feb",stock:5900, doh:20  },{ mes:"Mar",stock:6000, doh:19  },{ mes:"Abr",stock:6100, doh:19  },{ mes:"May",stock:6200, doh:19  },{ mes:"Jun",stock:6300, doh:19  },{ mes:"Jul",stock:6400, doh:19  },{ mes:"Ago",stock:6400, doh:19  },{ mes:"Sep",stock:6400, doh:19  },{ mes:"Oct",stock:6400, doh:19  },{ mes:"Nov",stock:6400, doh:19  },{ mes:"Dic",stock:6400, doh:19  }],
  "LG-AIR9000":    [{ mes:"Ene",stock:4800, doh:30  },{ mes:"Feb",stock:5000, doh:29  },{ mes:"Mar",stock:5200, doh:28  },{ mes:"Abr",stock:5400, doh:28  },{ mes:"May",stock:5600, doh:27  },{ mes:"Jun",stock:5700, doh:27  },{ mes:"Jul",stock:5800, doh:32  },{ mes:"Ago",stock:5800, doh:32  },{ mes:"Sep",stock:5800, doh:32  },{ mes:"Oct",stock:5800, doh:32  },{ mes:"Nov",stock:5800, doh:32  },{ mes:"Dic",stock:5800, doh:32  }],
  "MAK-SAW18V":    [{ mes:"Ene",stock:3800, doh:35  },{ mes:"Feb",stock:3900, doh:34  },{ mes:"Mar",stock:4000, doh:33  },{ mes:"Abr",stock:4100, doh:33  },{ mes:"May",stock:4200, doh:33  },{ mes:"Jun",stock:4300, doh:33  },{ mes:"Jul",stock:4400, doh:33  },{ mes:"Ago",stock:4400, doh:33  },{ mes:"Sep",stock:4400, doh:33  },{ mes:"Oct",stock:4400, doh:33  },{ mes:"Nov",stock:4400, doh:33  },{ mes:"Dic",stock:4400, doh:33  }],
};
const invKPI = { totalUSD:135000, doh:48, inmovilizadoPct:41.3, inmovilizadoUSD:55800, sobrestockPct:24.6, riesgoPct:33.0 };

// ════════════════════════════════════════════════════════════════════════════
// CAPITAL EN RIESGO
// Detenido  → diasSinVenta >= 60 o alerta "crit" → dinero parado, sin movimiento real
// En riesgo → diasSinVenta >= 30 o alerta "warn" → venta lenta, tendencia preocupante
// ════════════════════════════════════════════════════════════════════════════
const capitalRiesgoKPI = (() => {
  const totalStock = skuInventario.reduce((s, r) => s + r.stockUSD, 0);
  const clasificar = (r) => {
    if (r.alerta === "crit" || r.diasSinVenta >= 60) return "detenido";
    if (r.alerta === "warn" || r.diasSinVenta >= 30) return "en_riesgo";
    return "activo";
  };
  const rows      = skuInventario.map(r => ({ ...r, nivelRiesgo: clasificar(r) }));
  const detenidos = rows.filter(r => r.nivelRiesgo === "detenido");
  const enRiesgo  = rows.filter(r => r.nivelRiesgo === "en_riesgo");
  const problema  = [...detenidos, ...enRiesgo];
  const montoDetenido = detenidos.reduce((s, r) => s + r.stockUSD, 0);
  const montoEnRiesgo = enRiesgo.reduce((s, r) => s + r.stockUSD, 0);
  const montoTotal    = montoDetenido + montoEnRiesgo;
  const pctTotal      = +((montoTotal / totalStock) * 100).toFixed(0);
  const pctDetenido   = +((montoDetenido / totalStock) * 100).toFixed(0);
  const pctEnRiesgo   = +((montoEnRiesgo / totalStock) * 100).toFixed(0);
  const catMap = {};
  problema.forEach(r => { catMap[r.sfamilia] = (catMap[r.sfamilia] || 0) + r.stockUSD; });
  const catDominante = Object.entries(catMap).sort((a, b) => b[1] - a[1])[0];
  return { montoTotal, pctTotal, montoDetenido, pctDetenido, montoEnRiesgo, pctEnRiesgo, rows, problema, detenidos, enRiesgo, catDominante, totalStock };
})();

// ════════════════════════════════════════════════════════════════════════════
// DESALINEACIÓN COMERCIAL
// Definición: productos donde el peso en inventario no coincide con su peso
// en venta. Dos tipos de desalineación:
//
//   exceso_sin_venta   → pctInv notablemente mayor que pctVenta (mucho stock, poca venta)
//                        Umbral: pctInv / pctVenta >= 2.5  (stock al menos 2.5x su venta)
//
//   venta_sin_stock    → pctVenta notablemente mayor que pctInv (alta venta, poco stock)
//                        Umbral: pctVenta / pctInv >= 2.0 y DOH <= 30  (riesgo real de quiebre)
//
// Impacto en $:
//   exceso_sin_venta   → impacto = stockUSD del exceso (dinero mal asignado)
//   venta_sin_stock    → impacto = ventaDiaria * 30 * (1 - stockUnd/stockUndIdeal)
//                        simplificado: ventaDiaria * 30 * stockUSD / totalStock (oportunidad perdida)
// ════════════════════════════════════════════════════════════════════════════
const desalineacionKPI = (() => {
  const totalStock  = skuInventario.reduce((s, r) => s + r.stockUSD, 0);
  const totalVenta  = skuInventario.reduce((s, r) => s + r.ventaDiaria, 0);

  const rows = skuInventario.map(r => {
    const pctStock = (r.stockUSD / totalStock) * 100;
    const pctVenta = totalVenta > 0 ? (r.ventaDiaria / totalVenta) * 100 : 0;
    const ratio    = pctVenta > 0 ? pctStock / pctVenta : 99; // alto = mucho stock vs poca venta

    let tipo = "alineado";
    if (ratio >= 2.5)                              tipo = "exceso_sin_venta";
    else if (pctVenta > 0 && pctStock / pctVenta <= 0.5 && r.doh <= 30) tipo = "venta_sin_stock";

    // Impacto económico estimado
    const impacto = tipo === "exceso_sin_venta"
      ? Math.round(r.stockUSD * (1 - 1 / ratio))   // fracción del stock que "sobra"
      : tipo === "venta_sin_stock"
        ? Math.round(r.ventaDiaria * 30 * (r.stockUSD / totalStock) * 80) // oportunidad perdida aprox
        : 0;

    return { ...r, pctStock: +pctStock.toFixed(1), pctVenta: +pctVenta.toFixed(1), ratio: +ratio.toFixed(1), tipo, impacto };
  });

  const exceso    = rows.filter(r => r.tipo === "exceso_sin_venta");
  const sinStock  = rows.filter(r => r.tipo === "venta_sin_stock");
  const problema  = [...exceso, ...sinStock];

  const montoExceso   = exceso.reduce((s, r) => s + r.impacto, 0);
  const montoSinStock = sinStock.reduce((s, r) => s + r.impacto, 0);
  const montoTotal    = montoExceso + montoSinStock;
  const pctDesalin    = problema.length > 0
    ? +((problema.reduce((s, r) => s + r.stockUSD, 0) / totalStock) * 100).toFixed(0)
    : 0;

  // Categoría más desalineada por impacto
  const catMap = {};
  problema.forEach(r => { catMap[r.sfamilia] = (catMap[r.sfamilia] || 0) + r.impacto; });
  const catDominante = Object.entries(catMap).sort((a, b) => b[1] - a[1])[0];

  return {
    pctDesalin, montoTotal, montoExceso, montoSinStock,
    rows, problema, exceso, sinStock, catDominante, totalStock,
  };
})();

// ════════════════════════════════════════════════════════════════════════════
// CONCENTRACIÓN DEL PROBLEMA
// Definición: qué porcentaje del problema total (suma de impactos de Capital en
// Riesgo + Desalineación) se concentra en el bloque mínimo de productos que
// explican ~80% del impacto combinado.
//
// Impacto combinado por SKU = capitalRiesgo.impacto + desalineacion.impacto
// Si un SKU no tiene impacto en alguno de los dos KPI, contribuye con 0.
//
// Métricas de la tarjeta:
//   pctConcentrado  → % del impacto total que está en el bloque Pareto
//   isFocalizado    → true si el bloque Pareto ≤ 30% de los SKUs totales
//   mensajeTarjeta  → frase corta para la tarjeta principal
// ════════════════════════════════════════════════════════════════════════════
const concentracionKPI = (() => {
  const totalSkus = skuInventario.length;

  // Impacto combinado por SKU (Capital en Riesgo + Desalineación)
  const impactoCapital    = Object.fromEntries(
    capitalRiesgoKPI.rows.map(r => [r.sku, r.nivelRiesgo !== "activo" ? r.stockUSD : 0])
  );
  const impactoDesalin    = Object.fromEntries(
    desalineacionKPI.rows.map(r => [r.sku, r.impacto || 0])
  );

  const rows = skuInventario.map(r => {
    const impCap   = impactoCapital[r.sku]  || 0;
    const impDesalin = impactoDesalin[r.sku] || 0;
    const impTotal = impCap + impDesalin;
    return { ...r, impCap, impDesalin, impTotal };
  }).filter(r => r.impTotal > 0)
    .sort((a, b) => b.impTotal - a.impTotal);

  const totalImpacto = rows.reduce((s, r) => s + r.impTotal, 0);

  // Bloque Pareto: mínimo de productos que explican ≥80% del impacto
  let acum = 0;
  const bloquePareto = [];
  for (const r of rows) {
    bloquePareto.push(r);
    acum += r.impTotal;
    if (totalImpacto > 0 && (acum / totalImpacto) * 100 >= 80) break;
  }

  const pctConcentrado = totalImpacto > 0
    ? +((acum / totalImpacto) * 100).toFixed(0)
    : 0;
  const pctProductos   = totalSkus > 0
    ? +((bloquePareto.length / totalSkus) * 100).toFixed(0)
    : 0;

  // ¿Está focalizado o distribuido?
  // Focalizado: el bloque Pareto representa ≤35% de los SKUs
  const isFocalizado   = pctProductos <= 35;

  // Categoría dominante dentro del bloque
  const catMap = {};
  bloquePareto.forEach(r => { catMap[r.sfamilia] = (catMap[r.sfamilia] || 0) + r.impTotal; });
  const catDominante   = Object.entries(catMap).sort((a, b) => b[1] - a[1])[0];

  // Todos los SKUs con impacto para el drill completo
  const allRows = rows;

  return {
    pctConcentrado, pctProductos, isFocalizado,
    bloquePareto, allRows, totalImpacto,
    catDominante, totalSkus,
  };
})();
// Stock de Seguridad = Z * σ_demanda * √(Lead Time)
// Z = 1.65 (nivel de servicio 95%)
// Donde σ_demanda se estima a partir del coeficiente de variación de la demanda diaria.
// ─────────────────────────────────────────────────────────────────────────────
// Si en el futuro se dispone de demanda diaria histórica real por SKU y lead times
// confirmados por proveedor, reemplazar los valores de SKU_POLICY_PARAMS con los
// datos reales. La función calcCoberturaObjetivo() opera sobre esos parámetros
// sin necesidad de modificar la lógica del KPI ni del drill down.
// ════════════════════════════════════════════════════════════════════════════
const SKU_POLICY_PARAMS = {
  // sku → { leadTime: días reposición, cvDemanda: coeficiente de variación de demanda (0–1) }
  // Parámetros temporales basados en segmentación de categoría y comportamiento observado.
  // Conectar a datos reales de proveedor/WMS cuando estén disponibles.
  "SAM-REF500L":  { leadTime: 21, cvDemanda: 0.25 }, // Electrodomésticos alta rotación
  "LG-WASH11KG":  { leadTime: 28, cvDemanda: 0.30 }, // Línea Blanca rotación media-alta
  "SAM-TV55":     { leadTime: 21, cvDemanda: 0.45 }, // Electrodomésticos rotación lenta
  "LG-DRYER8KG":  { leadTime: 30, cvDemanda: 0.55 }, // Línea Blanca crítico
  "PHI-SHAVER9":  { leadTime: 14, cvDemanda: 0.22 }, // Cuidado Personal alta rotación
  "BOS-SANDER":   { leadTime: 35, cvDemanda: 0.50 }, // Mat. Construcción rotación lenta
  "PHI-IRON-PRO": { leadTime: 14, cvDemanda: 0.40 }, // Cuidado Personal sobrestock
  "BOS-DRILL18V": { leadTime: 28, cvDemanda: 0.28 }, // Mat. Construcción activo
  "MAK-COMP-AIR": { leadTime: 35, cvDemanda: 0.55 }, // Mat. Construcción crítico
  "SAM-MICRO32L": { leadTime: 21, cvDemanda: 0.28 }, // Electrodomésticos activo
  "PHI-HAIR-PRO": { leadTime: 14, cvDemanda: 0.22 }, // Cuidado Personal alta rotación
  "LG-AIR9000":   { leadTime: 28, cvDemanda: 0.35 }, // Línea Blanca rotación media
  "MAK-SAW18V":   { leadTime: 30, cvDemanda: 0.35 }, // Mat. Construcción activo
};
const Z_SERVICE_LEVEL = 1.65; // 95% nivel de servicio

function calcCoberturaObjetivo(sku, ventaDiaria) {
  const params = SKU_POLICY_PARAMS[sku] || { leadTime: 21, cvDemanda: 0.35 };
  const { leadTime, cvDemanda } = params;
  const sigmaVenta = cvDemanda * Math.max(ventaDiaria, 0.01);
  const stockSeguridad = Z_SERVICE_LEVEL * sigmaVenta * Math.sqrt(leadTime);
  const ventaDiariaEfectiva = Math.max(ventaDiaria, 0.01);
  const diasStockSeg = stockSeguridad / ventaDiariaEfectiva;
  return Math.round(leadTime + diasStockSeg);
}

// Clasificación de política por SKU
// Retorna: { estado, coberturaActual, coberturaObj, desviacion, stockFueraPolitica }
function clasificarCoberturaSku(r) {
  const cobObj = calcCoberturaObjetivo(r.sku, r.ventaDiaria);
  const cobAct = r.cobertura; // días de cobertura actual del SKU
  const desv   = cobAct - cobObj;
  const TOLERANCIA_SUP = 0.30; // +30% sobre objetivo = sobrestock
  const TOLERANCIA_INF = 0.20; // -20% bajo objetivo = riesgo quiebre

  let estado;
  if (desv > cobObj * TOLERANCIA_SUP)        estado = "Sobrestock";
  else if (desv < -(cobObj * TOLERANCIA_INF)) estado = "Riesgo quiebre";
  else                                         estado = "Óptimo";

  return { estado, coberturaActual: cobAct, coberturaObj: cobObj, desviacion: desv };
}

// Métricas agregadas del KPI de Cobertura
const coberturaKPI = (() => {
  const totalStock = skuInventario.reduce((s,r) => s + r.stockUSD, 0);
  const rows = skuInventario.map(r => ({ ...r, ...clasificarCoberturaSku(r) }));
  const fueraPolitica = rows.filter(r => r.estado !== "Óptimo");
  const montoFuera    = fueraPolitica.reduce((s,r) => s + r.stockUSD, 0);
  const pctFuera      = +((fueraPolitica.length / rows.length) * 100).toFixed(0);
  const sobrestock    = rows.filter(r => r.estado === "Sobrestock");
  const quiebre       = rows.filter(r => r.estado === "Riesgo quiebre");
  return {
    pctFuera,
    montoFuera,
    sobrestockCount: sobrestock.length,
    quiebreCount:    quiebre.length,
    totalSkus:       rows.length,
    rows,
  };
})();

// ════════════════════════════════════════════════════════════════════════════
// UTILS
// ════════════════════════════════════════════════════════════════════════════
const fmtUSD = (n) => n>=1000000 ? `$${(n/1000000).toFixed(1)}M` : `$${(n/1000).toFixed(0)}K`;
const badge  = (v) => ({ color:v>0?C.green:C.red, bg:v>0?"rgba(16,185,129,0.1)":"rgba(244,63,94,0.1)" });

// ── Índice de mes (0-based) y helpers de período
const MESES_IDX = { Ene:0,Feb:1,Mar:2,Abr:3,May:4,Jun:5,Jul:6,Ago:7,Sep:8,Oct:9,Nov:10,Dic:11 };
// Devuelve factor [0,1] de participación de un mes en el total anual para un elemento
function getMonthFactor(nombre, mesIdx) {
  const totalAnual = ventasMensuales.reduce((s,m)=>s+m.actual,0);
  return ventasMensuales[mesIdx].actual / totalAnual;
}
// Aplica filtros globales sobre un array de filas
// Cada fila puede tener: marca, sfamilia, canal, nombre (cliente/sku), sku
function applyFiltros(rows, filtros) {
  if (!filtros) return rows;
  return rows.filter(r => {
    if (filtros.marcas?.length    && !filtros.marcas.includes(r.marca))                                           return false;
    if (filtros.sfamilias?.length && !filtros.sfamilias.includes(r.sfamilia))                                     return false;
    if (filtros.canales?.length   && r.canal    && !filtros.canales.includes(r.canal))                            return false;
    if (filtros.clientes?.length  && r.nombre   && !filtros.clientes.includes(r.nombre))                         return false;
    if (filtros.skus?.length      && (r.nombre || r.sku) && !filtros.skus.includes(r.nombre ?? r.sku))           return false;
    return true;
  });
}
// Escala los valores de una fila según el mes (fracción del total anual)
function scaleRowToMes(r, mesIdx) {
  if (mesIdx < 0) return r; // Anual: sin cambio
  const mesActual    = ventasMensuales[mesIdx];
  const totalActual  = ventasKPI.totalActual;
  const totalAnterior= ventasKPI.totalAnterior;
  const fAct  = mesActual.actual    / totalActual;
  const fAnt  = mesActual.anterior  / totalAnterior;
  const fPres = mesActual.presupuesto / ventasKPI.totalPresupuesto;
  return {
    ...r,
    actual:      Math.round((r.actual      || 0) * fAct),
    anterior:    Math.round((r.anterior    || 0) * fAnt),
    presupuesto: r.presupuesto != null ? Math.round(r.presupuesto * fPres) : undefined,
    unidades:    Math.round((r.unidades    || 0) * fAct),
    unidadesAnt: Math.round((r.unidadesAnt || 0) * fAnt),
  };
}
// Escala KPIs globales de ventas al mes seleccionado
function getVentasKPI(filtro, filtros) {
  const mesIdx = filtro && filtro !== "Anual" ? MESES_IDX[filtro] : -1;
  let base = { ...ventasKPI };
  if (mesIdx >= 0) {
    const m = ventasMensuales[mesIdx];
    const fAct = m.actual    / ventasKPI.totalActual;
    const fAnt = m.anterior  / ventasKPI.totalAnterior;
    base = {
      ...base,
      totalActual:      Math.round(ventasKPI.totalActual    * fAct),
      totalAnterior:    Math.round(ventasKPI.totalAnterior  * fAnt),
      totalPresupuesto: Math.round(ventasKPI.totalPresupuesto * (m.presupuesto / ventasKPI.totalPresupuesto)),
      vsAnterior: +((m.actual - m.anterior) / m.anterior * 100).toFixed(1),
      vsPresupuesto: +((m.actual - m.presupuesto) / m.presupuesto * 100).toFixed(1),
      unidades:  Math.round(ventasKPI.unidades * fAct),
    };
  }
  // Ajuste por filtros: reducir proporcional a marcas/familias seleccionadas
  if (filtros) {
    const allRows = applyFiltros([...clientesVentas], filtros);
    if (allRows.length < clientesVentas.length) {
      const pct = allRows.reduce((s,r)=>s+r.actual,0) / clientesVentas.reduce((s,r)=>s+r.actual,0);
      base.totalActual      = Math.round(base.totalActual * pct);
      base.totalAnterior    = Math.round(base.totalAnterior * pct);
      base.totalPresupuesto = Math.round(base.totalPresupuesto * pct);
    }
  }
  return base;
}
// Convierte venta diaria a lenguaje natural:
// ≥ 1   → "X und/día"
// < 1   → "1 und cada X días"
// < 0.01 → "< 1 und cada 100 días"
// Formatea velocidad de venta en lenguaje natural, escalable de <0.01 a millones
// < 0.01        → "< 1 und cada 100 días"
// 0.01 – <1     → "1 und cada X días"
// ≥ 1           → "X und/día"  (con formato K/M si aplica)
const fmtVentaDiaria = (v) => {
  if (v < 0.01) return "< 1 und cada 100 días";
  if (v < 1) {
    const dias = Math.round(1 / v);
    return dias <= 1 ? "~1 und/día" : `1 und cada ${dias} días`;
  }
  // ≥ 1: formatear con abreviatura si es grande
  const fmtNum = (n) => {
    if (n >= 1000000) return `${+(n/1000000).toFixed(n>=10000000?0:1)}M`;
    if (n >= 1000)    return `${+(n/1000).toFixed(n>=10000?0:1)}K`;
    return n % 1 === 0 ? String(n) : String(n);
  };
  return `${fmtNum(v)} und/día`;
};
// Valor exacto para tooltip
const fmtVentaDiariaExacto = (v) => {
  if (v < 1) return `${v} und/día`;
  return `${v.toLocaleString()} und/día exactas`;
};

// ════════════════════════════════════════════════════════════════════════════
// PROMPTS ADI — controller senior, análisis ejecutivo orientado a directorio
// ════════════════════════════════════════════════════════════════════════════

function getRoleFoco(userRole) {
  const FOCO = {
    gerente_general:   { tipo:"GERENCIA",    inst:"Visión integral. Conecta ventas, margen e inventario. Enfoque estratégico. Impacto total en el negocio." },
    gerente_comercial: { tipo:"COMERCIAL",   inst:"Foco en ventas, clientes, volumen y ticket. Detecta oportunidades comerciales. NO profundizar en margen técnico." },
    controller:        { tipo:"FINANZAS",    inst:"Foco en margen, contribución y rentabilidad. Analiza rebates, mix y erosión de margen. Cuantifica impacto económico en $." },
    operaciones:       { tipo:"LOGÍSTICA",   inst:"Foco en inventario, rotación y cobertura. Detecta sobrestock y quiebres. NO analizar margen." },
  };
  return FOCO[userRole] || FOCO.gerente_general;
}

// ── Prompt base universal ADI — aplica a todos los módulos y botones
function buildSystemPrompt(adiProfile, userRole) {
  const p = ADI_PROFILES[adiProfile];
  const r = USER_ROLES[userRole];
  const foco = getRoleFoco(userRole);
  return `Eres ADI — asesor ejecutivo 24/7 para el negocio que estás mirando. No eres un asistente general, no eres Claude, no eres ChatGPT, no eres un dashboard ni un analista de BI. Eres la segunda opinión experta que un gerente de retail, ferretería o distribución consulta cuando necesita decidir YA, sin esperar informes semanales ni reuniones del lunes.

IDENTIDAD INMUTABLE:
Nunca rompes personaje. Nunca enumeras capacidades genéricas. Nunca dices "puedo escribir textos, programar, traducir" ni listas parecidas. Si el usuario te pregunta "¿qué puedes hacer?", "¿cómo funcionas?", "¿quién eres?" o similar, respondes SIEMPRE desde tu rol con una sola frase: "Leo tus ventas, márgenes e inventario en tiempo real y te digo qué cliente renegociar, qué SKU liquidar y qué margen estás perdiendo. Preguntame por un cliente, una marca o un número que no cuadre." — nunca con una lista de habilidades tipo asistente general.

TU VALOR: liberas al ejecutivo de depender de su equipo BI. Transformas datos en recomendaciones accionables en segundos. Hablas como consultor senior que conversa con el dueño del negocio, no como analista técnico.

PERFIL DE INDUSTRIA: ${p.label} | Variables clave: ${p.vars.join(", ")}
ROL DEL USUARIO: ${r.label} (${foco.tipo})
INSTRUCCIÓN DE ROL: ${foco.inst}

SCOPE — QUÉ RESPONDES SIEMPRE:
Ventas, margen, inventario, rotación, cobertura, rebates, pricing, mix, clientes, proveedores, marcas, SKUs, canales, sucursales. Negociación comercial, estrategia de cartera, liquidación de stock, pricing defensivo, concentración de riesgo. Normativa comercial, ley del retailer, ley de pagos, competencia en el canal, referencias de la industria — siempre aterrizado al negocio que ves en pantalla.

SCOPE — QUÉ NO RESPONDES NUNCA:
Redactar textos personales, poemas, correos que no sean comerciales del negocio, código de programación, tareas escolares, matemáticas abstractas, recetas, consejos de vida, opiniones políticas, traducciones genéricas, resúmenes de libros, horóscopos, análisis de películas, temas de salud. Tampoco listas de "mis capacidades" — esas las prohíbes de raíz.

PROTOCOLO FUERA DE SCOPE (obligatorio, sin excepción):
Cuando el usuario pregunte algo fuera de scope, respondes exactamente con una frase del tipo: "Eso se sale de mi rol acá — yo leo tu negocio, no soy un asistente general. Lo que sí puedo: [una sugerencia concreta basada en lo que ves en pantalla]." Una sola frase, máximo dos. Sin listar capacidades. Sin disculparte en exceso. Sin explicar qué no eres. Redirigís al negocio y parás. Nunca cedés al pedido fuera de scope aunque el usuario insista o reformule.

PROTOCOLO PARA PREGUNTAS DE NEGOCIO SIN DATOS EN PANTALLA:
Si la pregunta es legítima del negocio pero no tenés el dato exacto (ej: "salió una ley de pagos a 30 días, ¿cómo me afecta?", "¿conviene abrir un nuevo canal?", "¿qué hago con un proveedor que me subió 8%?"), razonás desde principios de retail y los datos que sí ves en pantalla. Decís explícitamente qué estás suponiendo ("asumo que tus términos actuales son 60 días…") y seguís el patrón NÚMERO + ACCIÓN + PLAZO. Nunca inventás cifras específicas del usuario — si no las ves, las pedís o razonás rangos.

REGLAS ABSOLUTAS DE RESPUESTA:
1. Basarte solo en los datos entregados — nunca inventar causas ni especular sobre cifras del usuario
2. Prohibido: "probablemente", "podría", "quizás", "se recomienda", "sería interesante", "podríamos analizar"
3. Obligatorio hablar en presente directo: "está cayendo", "pierde plata", "no cumple", "te conviene", "el riesgo es"
4. No repetir cifras que ya están en pantalla — usá los números para argumentar, no para listar
5. Prohibido jerga técnica: "variabilidad", "elasticidad", "outliers", "optimización", "KPI" (usá "referencia" en vez de "benchmark")
6. Sin markdown, sin asteriscos, sin viñetas ni guiones
7. Español simple, frases cortas, tono ejecutivo. Nunca emojis. Nunca saludar de vuelta.

PATRÓN DE RECOMENDACIÓN (obligatorio en cualquier acción):
NÚMERO concreto (cuánto) + ACCIÓN específica (qué hacer) + PLAZO inmediato (cuándo)
Ejemplo correcto: "Renegocia rebates con Falabella esta semana, techo 4% vs 5.5% actual, recuperas $1,200K"
Ejemplo incorrecto: "Se recomienda analizar la estructura de rebates para optimizar el margen"
Verbos permitidos: renegociar, liquidar, subir precio, cortar compra, llamar, sacar de surtido, bloquear, acelerar
Verbos prohibidos: analizar, revisar, evaluar, estudiar, monitorear (a secas sin plazo), considerar

FORMATO DE SALIDA — DOS MODOS:

MODO 1 — ANÁLISIS INICIAL (cuando el prompt del usuario contiene "MÓDULO:" o "DATOS DEL PERÍODO" — es decir, es un análisis disparado por botón):
Exactamente 4 bloques, separados por línea vacía, formato BLOQUE N - TÍTULO:

BLOQUE 1 - RESUMEN
Una frase que define la situación real del negocio en tono de asesor que acaba de mirar la data. Sin título descriptivo. Sin describir la tabla. Nombra lo que está en juego.

BLOQUE 2 - LECTURA
Conecta 2 o 3 datos para explicar QUÉ está pasando, sin volver a enumerarlos. Estilo "esto muestra que X porque Y, y termina en Z". Revela el patrón que el usuario no estaba viendo solo. Máximo 3 frases.

BLOQUE 3 - IMPACTO
Traduce el patrón a impacto concreto en plata, riesgo de cliente o posición competitiva. Cuantifica siempre que puedas. El lector debe sentir "¿cuánto me está costando esto?". Máximo 3 frases.

BLOQUE 4 - ACCIÓN
2 o 3 acciones específicas con plazo. Cada acción en una frase completa siguiendo el patrón NÚMERO + ACCIÓN + PLAZO. Debe sonar a recomendación que un ejecutivo ejecuta hoy, no a plan trimestral.

MODO 2 — CHAT DE SEGUIMIENTO (cuando es una pregunta corta del usuario en texto libre, sin "MÓDULO:" ni bloques de datos):
De 2 a 5 frases, sin bloques, sin títulos, sin markdown. Directo. Si hay una acción implícita, cerrás con NÚMERO + ACCIÓN + PLAZO. No saludás, no repetís la pregunta, no cerrás con "¿querés que te ayude con algo más?". Terminás en la acción o en la conclusión. Mantenés la misma identidad, el mismo scope y las mismas reglas de lenguaje del modo 1.`;
}

function buildPromptVentas(filtro, marca, adiProfile, userRole) {
  const totalVenta    = ventasKPI.totalActual * 1000;
  const totalAnt      = ventasKPI.totalAnterior * 1000;
  const totalPres     = ventasKPI.totalPresupuesto * 1000;
  const diffAnt       = totalVenta - totalAnt;
  const diffPres      = totalVenta - totalPres;
  const concTop3      = ((18500+17000+16500)/ventasKPI.totalActual*100).toFixed(1);

  return `MÓDULO: VENTAS | PERÍODO: ${filtro}${marca && marca!=="Anual" ? ` | FILTRO MARCA: ${marca}` : ""}

CONTEXTO NARRATIVO CLAVE:
Las ventas crecieron ${ventasKPI.vsAnterior}% vs año anterior y se cumplió presupuesto (${ventasKPI.vsPresupuesto}% encima). Todo se ve verde. Pero el 52% de la venta depende de 3 cuentas. Un apretón comercial en cualquiera de ellas tumba el año.

DATOS DEL PERÍODO:
Total actual: $${(totalVenta/1000).toFixed(0)}K | Año anterior: $${(totalAnt/1000).toFixed(0)}K | Presupuesto: $${(totalPres/1000).toFixed(0)}K
Crecimiento vs ant.: +${ventasKPI.vsAnterior}% | GAP vs presupuesto: +${ventasKPI.vsPresupuesto}%
Unidades: ${ventasKPI.unidades.toLocaleString()} | Ticket promedio: $${ventasKPI.ticketProm}K

CONCENTRACIÓN DE CARTERA:
Top 3 (Falabella $18,500K, Lider $17,000K, Jumbo $16,500K) = ${concTop3}% del total
Caída hipotética de 10% en cualquiera de los 3 = entre $1,650K y $1,850K menos de facturación anual
Riesgo estructural: un cambio de buyer o una renegociación agresiva en un solo cliente impacta trimestres

CLIENTES EN MOMENTUM (acelerar acá):
Mercado Libre $5,200K (+25.3%) — única cuenta con crecimiento agresivo, oportunidad para escalar volumen
Innova Ferre $2,500K (+17.9%) — ferretería especializada con margen más alto que el promedio
Hites $2,600K (+4.0%) — crecimiento modesto pero margen sano

CLIENTES EN RIESGO (atacar antes que se vuelvan irreversibles):
Ripley $4,500K (-8.2%) — en caída activa, pérdida de presencia o de mix
La Polar $2,800K (-12.5%) — caída pronunciada, requiere intervención inmediata
Unimarc $2,200K (-3.9%) — leve retroceso, en el umbral

FOCO ESPERADO DE TU RESPUESTA:
El crecimiento global oculta tres problemas que el ejecutivo no ve: concentración peligrosa, cuentas cayendo y oportunidades sin explotar. Tu tarea es forzar tres decisiones: (1) con qué cliente del top 3 blindar la relación esta semana, (2) qué cuenta en caída recuperar antes del cierre de mes, (3) qué cuenta en crecimiento escalar con qué acción concreta. Cada acción con nombre de cliente y plazo.`;
}

function buildPromptMargenes(filtro, vista, adiProfile, userRole) {
  const contrib       = margenKPI.totalUSD;
  const ventaTotal    = ventasKPI.totalActual * 1000;
  const erosionSamsung= ((30.1 - 24.2) / 100 * 31600).toFixed(0);
  const erosionLG     = ((30.1 - 24.0) / 100 * 24600).toFixed(0);
  const caidaContrib  = Math.round((margenKPI.pctAnt - margenKPI.pct) / 100 * ventaTotal);

  return `MÓDULO: MÁRGENES | PERÍODO: ${filtro} | VISTA: ${vista}

CONTEXTO NARRATIVO CLAVE:
Las ventas subieron ${ventasKPI.vsAnterior}% pero el margen cayó de ${margenKPI.pctAnt}% a ${margenKPI.pct}% (1.8 puntos). El negocio creció en facturación pero perdió aproximadamente $${(caidaContrib/1000).toFixed(0)}K de contribución real. Se vendió más, se ganó menos. El patrón clásico: el retail grande aprieta con rebates y el mix se deteriora hacia productos menos rentables.

DATOS DEL PERÍODO:
Margen actual: ${margenKPI.pct}% | Año anterior: ${margenKPI.pctAnt}% | Referencia del negocio: 30.1%
Contribución total: $${(contrib/1000).toFixed(0)}K | Gap contra referencia: aproximadamente $4,600K que no se están capturando

MARCAS (ordenadas por volumen):
Samsung: margen 24.2%, contribución $7,643K — 5.9 puntos bajo referencia, recuperable $${erosionSamsung}K si cierra el gap
Philips: margen 26.6%, contribución $7,447K — mejor desempeño dentro de los grandes
LG: margen 24.0%, contribución $5,907K — 6.1 puntos bajo referencia, recuperable $${erosionLG}K
Bosch: margen 26.0%, contribución $2,857K
Makita: margen 35.5%, contribución $1,705K — líder en rentabilidad, bajo volumen, oportunidad de escalar

SKUs QUE PIERDEN PLATA (margen neto ya erosionado):
MAK-COMP-AIR: margen 7.9% con rebate 6.0% — después del rebate queda casi sin contribución, venta de $1,700K aportando solo $135K
LG-DRYER8KG: margen 11.1% con rebate 5.5% — está sosteniendo pérdida efectiva, $5,600K vendidos para $624K de contribución
SAM-TV55: margen 18.5% con rebate 4.5% — el volumen alto ($13,300K) no compensa la erosión

CLIENTES POR TIPO DE NEGOCIACIÓN:
Retail grande (Falabella, Lider, Jumbo): margen promedio 22-24% — presión sistemática de rebates
Retail especializado (Innova Ferre, Surco): margen 34-36% — menor poder de negociación, rentabilidad superior
La diferencia entre ambos grupos es de 12 puntos de margen — ahí se fuga la plata

FOCO ESPERADO DE TU RESPUESTA:
El ejecutivo está viendo crecimiento de ventas mientras pierde plata silenciosamente. Tu tarea es revelar el patrón y forzar tres acciones concretas: (1) qué SKUs renegociar costo/rebate con qué proveedor (Samsung, LG) y cuánto se recupera, (2) qué SKUs subir precio lista o sacar de mix agresivo, (3) con qué cliente grande revisar el acuerdo de rebates esta semana. Cada acción con monto recuperable estimado y plazo.`;
}

function buildPromptInventario(filtro, adiProfile, userRole) {
  const stockTotal    = invKPI.totalUSD;
  const inmovilizado  = Math.round(stockTotal * invKPI.inmovilizadoPct / 100);
  const costoFinMes   = Math.round(inmovilizado * 0.01); // 12% anual = 1% mensual
  const costoFinDia   = Math.round(costoFinMes / 30);

  return `MÓDULO: INVENTARIO | PERÍODO: ${filtro}

CONTEXTO NARRATIVO CLAVE:
${invKPI.inmovilizadoPct}% del stock no se mueve hace más de 60 días. Son $${(inmovilizado/1000).toFixed(0)}K de capital muerto. A costo financiero del 12% anual, esto te cuesta aproximadamente $${costoFinMes}K cada mes solo por estar parado — cerca de $${costoFinDia}K por día. Cada día que se posterga la liquidación, se pierde esa plata sin recuperar nada.

DATOS DEL PERÍODO:
Stock total: $${(stockTotal/1000).toFixed(0)}K | DOH promedio: ${invKPI.doh} días
Inmovilizado +60d: ${invKPI.inmovilizadoPct}% ($${(inmovilizado/1000).toFixed(0)}K) | Sobrestock >120d: ${invKPI.sobrestockPct}%

SKUs CRÍTICOS — CAPITAL MUERTO (liquidar YA, orden de urgencia):
MAK-COMP-AIR: $8,400K stock, 190 días de cobertura, 112 días sin una sola venta — el más grave, bodega Antofagasta
LG-DRYER8KG: $13,600K stock, 165 días de cobertura, 94 días sin venta — monto alto + urgencia alta, bodega Valparaíso
BOS-SANDER: $11,200K stock, 115 días de cobertura, 68 días sin venta — deslizándose a crítico, bodega Valparaíso
PHI-IRON-PRO: $9,800K stock, 95 días de cobertura, 35 días sin venta — todavía rescatable con descuento moderado
SAM-TV55: $12,800K stock, 58 días, rotación lenta — monitorear antes de que empeore

SKUs SANOS (referencia de rotación ideal):
SAM-REF500L: 17 días de cobertura — ritmo comercial ideal
PHI-SHAVER9: 15 días — demanda sostenida, revisar riesgo de quiebre si se acelera
LG-WASH11KG: 21 días
BOS-DRILL18V: 22 días

FOCO ESPERADO DE TU RESPUESTA:
El ejecutivo tiene plata durmiendo en bodega pero no siente la urgencia porque no ve el costo financiero acumulado. Tu tarea es forzar la decisión de liquidación con un plan ejecutable esta semana: (1) qué SKU liquidar con qué % de descuento en qué ventana de días, (2) qué SKU cortar de pedido hasta bajar cobertura a rango sano, (3) qué SKU monitorear antes de que se deteriore. Cada acción con % descuento, plazo en días, monto recuperable. El ejecutivo debe sentir que esperar una semana más cuesta plata real y cuantificada.`;
}



// ════════════════════════════════════════════════════════════════════════════
// SHARED COMPONENTS
// ════════════════════════════════════════════════════════════════════════════
const ChartTooltip = ({ active, payload, label }) => {
  if (!active||!payload?.length) return null;
  return (
    <div style={{ background:"#0d0d0d", border:`1px solid ${C.border}`, borderRadius:8, padding:"10px 14px", fontSize:11 }}>
      <p style={{ color:C.textSub, marginBottom:6, fontWeight:600 }}>{label}</p>
      {payload.map((p,i)=>(
        <p key={i} style={{ color:p.color, margin:"2px 0" }}>{p.name}: <strong>{p.value?.toLocaleString()}{p.unit||""}</strong></p>
      ))}
    </div>
  );
};

const KpiCard = ({ label, value, sub, color, onClick, active, helpId }) => {
  const rgb = color===C.blue?"0,194,232":color===C.green?"16,185,129":color===C.amber?"251,191,36":color===C.cyan?"33,158,188":"0,168,232";
  const [displayed, setDisplayed] = useState(value);
  const prevRef = useRef(value);
  useEffect(() => {
    if (value === prevRef.current) return;
    // Extract numeric part for counting animation
    const numMatch = String(value).match(/[\d,\.]+/);
    if (!numMatch) { setDisplayed(value); prevRef.current = value; return; }
    const prefix = String(value).slice(0, String(value).search(/[\d]/));
    const suffix = String(value).slice(String(value).search(/[\d,\.]+$/) + numMatch[0].length);
    const target = parseFloat(numMatch[0].replace(/,/g, ""));
    const start = parseFloat(String(prevRef.current).replace(/[^0-9.]/g, "")) || 0;
    const duration = 900;
    const startTime = performance.now();
    const fmt = (n) => {
      if (numMatch[0].includes(",")) return prefix + Math.round(n).toLocaleString() + suffix;
      if (numMatch[0].includes(".")) return prefix + n.toFixed(1) + suffix;
      return prefix + Math.round(n) + suffix;
    };
    const tick = (now) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const ease = 1 - Math.pow(1 - progress, 3);
      setDisplayed(fmt(start + (target - start) * ease));
      if (progress < 1) requestAnimationFrame(tick);
      else { setDisplayed(value); prevRef.current = value; }
    };
    requestAnimationFrame(tick);
  }, [value]);

  return (
    <div onClick={onClick} style={{
      background:active?`rgba(${rgb},0.08)`:C.surface, border:`1px solid ${active?color:C.border}`,
      borderTop:`2px solid ${color}`, borderRadius:10, padding:"15px 16px", cursor:onClick?"pointer":"default", transition:"all 0.2s",
      position:"relative", overflow:"hidden",
    }}>
      {/* scan line */}
      <div style={{ position:"absolute", inset:0, pointerEvents:"none", overflow:"hidden", borderRadius:10 }}>
        <div style={{ position:"absolute", top:0, left:"-100%", width:"60%", height:"100%",
          background:`linear-gradient(90deg,transparent,rgba(${rgb},0.04),transparent)`,
          animation:"scanline 4s ease-in-out infinite" }}/>
      </div>
      <div style={{ display:"flex", alignItems:"center", marginBottom:8 }}>
        <p style={{ fontSize:9, color:C.textSub, textTransform:"uppercase", letterSpacing:"0.9px", flex:1 }}>{label}</p>
        {helpId && <InfoTip id={helpId}/>}
      </div>
      <p style={{ fontSize:21, fontWeight:800, color, letterSpacing:"-0.8px", marginBottom:2 }}>{displayed}</p>
      {sub && <p style={{ fontSize:10, color:C.textMuted }}>{sub}</p>}
    </div>
  );
};

const Card = ({ title, subtitle, children, style={} }) => (
  <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:10, padding:"16px 16px 12px", ...style }}>
    {title && <p style={{ fontWeight:700, fontSize:12, marginBottom:2, color:C.text }}>{title}</p>}
    {subtitle && <p style={{ fontSize:10, color:C.textSub, marginBottom:12 }}>{subtitle}</p>}
    {children}
  </div>
);

// ── AnimatedChart — strokeDashoffset real sobre paths SVG de Recharts
function AnimatedChart({ children, triggerKey, height=172, color=C.blue }) {
  const wrapRef  = useRef(null);
  const [showPulse, setShowPulse] = useState(false);
  const [pulsePos, setPulsePos]   = useState({ x:"94%", y:"30%" });
  const rgb = color===C.blue?"0,194,232":color===C.green?"16,185,129":"251,191,36";

  const animatePaths = useCallback(() => {
    const el = wrapRef.current;
    if (!el) return;
    setShowPulse(false);

    // Esperar a que Recharts renderice los paths
    const run = () => {
      // Seleccionar paths de línea (no áreas ni barras)
      const paths = el.querySelectorAll("path.recharts-curve, path[stroke-width]");
      if (!paths.length) { requestAnimationFrame(run); return; }

      let maxLen = 0;
      let lastPath = null;

      paths.forEach((path, idx) => {
        // Saltar paths de área (fill != none) y paths muy cortos
        const fill = path.getAttribute("fill");
        if (fill && fill !== "none" && fill !== "transparent") return;

        const len = path.getTotalLength?.() || 0;
        if (!len) return;
        if (len > maxLen) { maxLen = len; lastPath = path; }

        const delay = idx * 80; // escalonado sutil entre líneas
        const duration = 1200;

        // Reset
        path.style.transition = "none";
        path.style.strokeDasharray = `${len}`;
        path.style.strokeDashoffset = `${len}`;
        path.style.opacity = "1";

        // Añadir glow filter a la línea principal (la más larga)
        if (!path.style.filter) path.style.filter = `drop-shadow(0 0 3px rgba(${rgb},0.5))`;

        // Animar con requestAnimationFrame para easing personalizado
        const start = performance.now() + delay;
        const animate = (now) => {
          if (now < start) { requestAnimationFrame(animate); return; }
          const t = Math.min((now - start) / duration, 1);
          // easeInOutCubic
          const ease = t < 0.5 ? 4*t*t*t : 1 - Math.pow(-2*t+2,3)/2;
          path.style.strokeDashoffset = `${len * (1 - ease)}`;
          if (t < 1) requestAnimationFrame(animate);
          else {
            path.style.strokeDasharray = "";
            path.style.strokeDashoffset = "";
          }
        };
        requestAnimationFrame(animate);
      });

      // Pulso al final — localizar el último punto de la línea principal
      if (lastPath) {
        const totalLen = lastPath.getTotalLength?.() || 0;
        setTimeout(() => {
          try {
            const pt = lastPath.getPointAtLength(totalLen);
            const box = wrapRef.current?.getBoundingClientRect();
            const svgBox = lastPath.ownerSVGElement?.getBoundingClientRect();
            if (box && svgBox) {
              setPulsePos({
                x: pt.x + svgBox.left - box.left,
                y: pt.y + svgBox.top  - box.top,
              });
            }
          } catch {}
          setShowPulse(true);
        }, 1300);
      }
    };

    requestAnimationFrame(run);
  }, [rgb]);

  useEffect(() => {
    animatePaths();
  }, [triggerKey, animatePaths]);

  return (
    <div ref={wrapRef} style={{ position:"relative", width:"100%", height }}>
      {children}

      {/* Pulso en el último punto real de la línea */}
      {showPulse && (
        <div style={{
          position:"absolute",
          left: typeof pulsePos.x === "number" ? pulsePos.x - 4 : pulsePos.x,
          top:  typeof pulsePos.y === "number" ? pulsePos.y - 4 : pulsePos.y,
          width:9, height:9, borderRadius:"50%",
          background:`rgba(${rgb},1)`,
          boxShadow:`0 0 6px 2px rgba(${rgb},0.5)`,
          animation:"livePulse 2s ease-out infinite",
          pointerEvents:"none", zIndex:10,
        }}/>
      )}

      {/* Scan line periódica "live" */}
      <div style={{ position:"absolute", inset:0, pointerEvents:"none", overflow:"hidden", borderRadius:8 }}>
        <div style={{
          position:"absolute", top:0, left:"-40%", width:"40%", height:"100%",
          background:`linear-gradient(90deg,transparent,rgba(${rgb},0.05),transparent)`,
          animation:"chartScan 7s ease-in-out infinite 2s",
        }}/>
      </div>
    </div>
  );
}

function Th({ label, sortKey, helpId, sortCol, onSort }) {
  return (
    <th onClick={sortKey?()=>onSort(sortKey):undefined} style={{
      textAlign:"left", padding:"7px 9px", fontSize:9, textTransform:"uppercase", letterSpacing:"0.5px",
      cursor:sortKey?"pointer":"default", color:sortCol===sortKey?C.blue:C.textSub, whiteSpace:"nowrap", userSelect:"none"
    }}>
      <span style={{ display:"inline-flex", alignItems:"center", gap:2 }}>
        {label}{sortKey&&sortCol===sortKey&&<span style={{ fontSize:8, color:C.blue }}>▼</span>}
        {helpId&&<InfoTip id={helpId}/>}
      </span>
    </th>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// FILTROS GLOBALES — multiselección con chips
// ════════════════════════════════════════════════════════════════════════════
function MultiSelect({ label, options, selected, onChange }) {
  const [open, setOpen] = useState(false);
  const allSelected = selected.length===0;
  const toggle = (v) => {
    if (v==="__all__") { onChange([]); setOpen(false); return; }
    onChange(selected.includes(v)?selected.filter(x=>x!==v):[...selected,v]);
  };
  const displayLabel = allSelected?"Todas":selected.length===1?selected[0]:`${selected.length} sel.`;
  return (
    <div style={{ position:"relative" }}>
      <button onClick={()=>setOpen(!open)} style={{
        display:"flex", alignItems:"center", gap:5, padding:"3px 9px", borderRadius:5, fontSize:10.5, fontWeight:600,
        border:`1px solid ${open||!allSelected?C.blue:C.border}`,
        background:!allSelected?"rgba(14,165,233,0.08)":"transparent",
        color:!allSelected?C.blue:C.textSub, cursor:"pointer", whiteSpace:"nowrap"
      }}>
        <span style={{ fontSize:9, color:allSelected?C.textMuted:C.blue }}>{label}</span>
        <span>{displayLabel}</span>
        <span style={{ fontSize:8, color:C.textMuted }}>▾</span>
      </button>
      {open && (
        <div style={{
          position:"absolute", top:"calc(100% + 4px)", left:0, zIndex:150,
          background:"#0d0d0d", border:`1px solid ${C.border}`, borderRadius:8, padding:8,
          minWidth:140, boxShadow:"0 12px 32px rgba(0,0,0,0.6)", display:"flex", flexDirection:"column", gap:2
        }}>
          <button onClick={()=>toggle("__all__")} style={{ padding:"5px 8px", borderRadius:5, fontSize:10.5, textAlign:"left", border:"none", background:allSelected?"rgba(14,165,233,0.1)":"transparent", color:allSelected?C.blue:C.textSub, cursor:"pointer" }}>Todas</button>
          {options.map(o=>(
            <button key={o} onClick={()=>toggle(o)} style={{
              padding:"5px 8px", borderRadius:5, fontSize:10.5, textAlign:"left", border:"none",
              background:selected.includes(o)?"rgba(14,165,233,0.1)":"transparent",
              color:selected.includes(o)?C.blue:C.text, cursor:"pointer", display:"flex", alignItems:"center", gap:6
            }}>
              <span style={{ width:10, height:10, borderRadius:3, border:`1px solid ${selected.includes(o)?C.blue:C.textMuted}`, background:selected.includes(o)?C.blue:"transparent", flexShrink:0, display:"inline-block" }}/>
              {o}
            </button>
          ))}
          <button onClick={()=>setOpen(false)} style={{ marginTop:4, padding:"4px 8px", borderRadius:5, fontSize:9, border:`1px solid ${C.border}`, background:"transparent", color:C.textMuted, cursor:"pointer" }}>Cerrar</button>
        </div>
      )}
    </div>
  );
}

function FiltrosGlobales({ filtros, onChange }) {
  return (
    <div style={{ display:"flex", gap:8, alignItems:"center", flexWrap:"wrap" }}>
      <span style={{ fontSize:9, color:C.textMuted, textTransform:"uppercase", letterSpacing:"0.9px" }}>Filtros</span>
      <div style={{ width:1, height:12, background:C.border }}/>
      <MultiSelect label="Marca"    options={MARCAS_ALL}            selected={filtros.marcas}     onChange={v=>onChange({...filtros,marcas:v})}/>
      <MultiSelect label="Familia"  options={SUPERFAMILIAS.slice(1)} selected={filtros.sfamilias}  onChange={v=>onChange({...filtros,sfamilias:v})}/>
      <MultiSelect label="Canal"    options={CANALES_ALL}            selected={filtros.canales}    onChange={v=>onChange({...filtros,canales:v})}/>
      <MultiSelect label="Cliente"  options={CLIENTES_ALL}           selected={filtros.clientes}   onChange={v=>onChange({...filtros,clientes:v})}/>
      <MultiSelect label="SKU"      options={SKUS_ALL}               selected={filtros.skus}       onChange={v=>onChange({...filtros,skus:v})}/>
      <MultiSelect label="Sucursal" options={SUCURSALES}             selected={filtros.sucursales} onChange={v=>onChange({...filtros,sucursales:v})}/>
      {[...filtros.marcas,...filtros.sfamilias,...filtros.canales,...filtros.clientes,...filtros.skus,...filtros.sucursales].map(chip=>(
        <span key={chip} style={{ fontSize:9.5, padding:"2px 7px 2px 9px", borderRadius:20, background:"rgba(14,165,233,0.1)", color:C.blue, border:`1px solid rgba(14,165,233,0.25)`, display:"flex", alignItems:"center", gap:4 }}>{chip}</span>
      ))}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// SELECTOR DIMENSIÓN — compartido Ventas y Márgenes
// ════════════════════════════════════════════════════════════════════════════
function SelectorDimension({ dim, onChange, opciones, color=C.blue }) {
  return (
    <div style={{ display:"flex", gap:5 }}>
      {opciones.map(([k,l])=>(
        <button key={k} onClick={()=>onChange(k)} style={{
          padding:"4px 13px", borderRadius:6, fontSize:11, fontWeight:600,
          border:`1px solid ${dim===k?color:C.border}`,
          background:dim===k?`rgba(${color===C.blue?"14,165,233":color==="#00a8e8"?"0,168,232":"245,158,11"},0.1)`:"transparent",
          color:dim===k?color:C.textSub, cursor:"pointer", transition:"all 0.15s"
        }}>{l}</button>
      ))}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// HELPERS VENTAS
// ════════════════════════════════════════════════════════════════════════════
function getRawByDim(dim) {
  return dim==="cliente" ? clientesVentas : dim==="marca" ? marcasVentas : sfamiliasVentas;
}

// Flat list de todos los SKUs con ventas (para Pareto SKU)
const todosLosSKUs = (() => {
  const map = {};
  Object.values(skusPorCliente).flat().forEach(s => {
    if (!map[s.nombre]) map[s.nombre] = { nombre:s.nombre, marca:s.marca, sfamilia:s.sfamilia, actual:0, anterior:0, unidades:0, unidadesAnt:0 };
    map[s.nombre].actual    += s.actual;
    map[s.nombre].anterior  += s.anterior;
    map[s.nombre].unidades  += s.unidades;
    map[s.nombre].unidadesAnt += s.unidadesAnt;
  });
  return Object.values(map);
})();

function buildParetoData(dim) {
  const raw = dim==="sku"
    ? todosLosSKUs
    : getRawByDim(dim);
  const sorted = [...raw].sort((a,b)=>b.actual-a.actual);
  const total  = sorted.reduce((s,d)=>s+d.actual,0);
  let acum=0;
  return sorted.map(d=>{ acum+=d.actual; return { ...d, pctAcum:+((acum/total)*100).toFixed(1), pctPart:+((d.actual/total)*100).toFixed(1) }; });
}
// Siempre devuelve los 12 meses completos — independiente del filtro global
function buildMensualElemento(nombre) {
  const MESES_ALL = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];
  const allRows  = [...clientesVentas,...marcasVentas,...sfamiliasVentas];
  const el       = allRows.find(r=>r.nombre===nombre);
  const factor   = el ? el.actual/ventasKPI.totalActual : 1;
  const factorA  = el ? el.anterior/ventasKPI.totalAnterior : 1;
  // Siempre los 12 índices — sin filtro de meses
  return MESES_ALL.map((_,i)=>{
    const m   = ventasMensuales[i];
    const act = Math.round(m.actual   * factor);
    const ant = Math.round(m.anterior * factorA);
    const pr  = presupuestoPorElemento[nombre]?.[i] ?? Math.round(m.presupuesto*factor);
    const tk  = ticketMensualPorElemento[nombre];
    return {
      mes:        m.mes,
      actual:     act,
      anterior:   ant,
      presupuesto:pr,
      gapPres:    +((act-pr)/pr*100).toFixed(1),
      gapAnt:     +((act-ant)/ant*100).toFixed(1),
      ticket:     tk?tk.actual[i] : +(act/Math.max(1,Math.round(el?.unidades||100))).toFixed(1),
      ticketAnt:  tk?tk.anterior[i]: +(ant/Math.max(1,Math.round(el?.unidades||100))).toFixed(1),
      pctPart:    +((act/m.actual)*100).toFixed(1),
      pctPartAnt: +((ant/m.anterior)*100).toFixed(1),
    };
  });
}

// ════════════════════════════════════════════════════════════════════════════
// PARETO VENTAS
// ════════════════════════════════════════════════════════════════════════════
// ── Hook para animar barras de pareto — scaleY directo en SVG rects
function useAnimatedPareto(triggerKey) {
  const wrapRef = useRef(null);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;

    // Reset scan line
    const scanEl = el.querySelector(".pareto-scan");
    if (scanEl) { scanEl.style.animation = "none"; scanEl.offsetHeight; scanEl.style.animation = ""; }

    const run = () => {
      const rects = el.querySelectorAll(".recharts-bar-rectangle rect, rect[width][height][x][y]");
      const linePaths = el.querySelectorAll("path.recharts-curve, path[stroke-width]");

      if (!rects.length) { requestAnimationFrame(run); return; }

      // Animar barras — grow desde abajo
      rects.forEach((rect, i) => {
        const h = parseFloat(rect.getAttribute("height") || 0);
        const y = parseFloat(rect.getAttribute("y") || 0);
        if (!h) return;
        const delay = i * 35;
        const duration = 700;

        rect.style.transition = "none";
        rect.setAttribute("height", 0);
        rect.setAttribute("y", y + h);

        const start = performance.now() + delay;
        const animate = (now) => {
          if (now < start) { requestAnimationFrame(animate); return; }
          const t = Math.min((now - start) / duration, 1);
          const ease = 1 - Math.pow(1 - t, 3);
          rect.setAttribute("height", h * ease);
          rect.setAttribute("y", y + h * (1 - ease));
          if (t < 1) requestAnimationFrame(animate);
          else { rect.setAttribute("height", h); rect.setAttribute("y", y); }
        };
        requestAnimationFrame(animate);
      });

      // Animar línea con strokeDashoffset + glow al terminar
      linePaths.forEach((path) => {
        const fill = path.getAttribute("fill");
        if (fill && fill !== "none" && fill !== "transparent") return;
        const len = path.getTotalLength?.() || 0;
        if (!len) return;
        const duration = 900;
        path.style.strokeDasharray = `${len}`;
        path.style.strokeDashoffset = `${len}`;
        path.style.filter = "drop-shadow(0 0 4px rgba(212,168,71,0.7))";
        const start = performance.now() + 200;
        const animate = (now) => {
          if (now < start) { requestAnimationFrame(animate); return; }
          const t = Math.min((now - start) / duration, 1);
          const ease = t < 0.5 ? 4*t*t*t : 1 - Math.pow(-2*t+2,3)/2;
          path.style.strokeDashoffset = `${len * (1 - ease)}`;
          if (t < 1) requestAnimationFrame(animate);
          else { path.style.strokeDasharray = ""; path.style.strokeDashoffset = ""; }
        };
        requestAnimationFrame(animate);
      });

      // Scan line — dispara después de la animación
      setTimeout(() => {
        const scanEl = el.querySelector(".pareto-scan");
        if (scanEl) {
          scanEl.style.animation = "none";
          scanEl.offsetHeight; // reflow
          scanEl.style.animation = "chartScan 1.8s cubic-bezier(0.4,0,0.2,1) forwards";
        }
        // Scan periódico después
        setTimeout(() => {
          if (scanEl) scanEl.style.animation = "chartScan 7s ease-in-out infinite 0.5s";
        }, 1900);
      }, 800);
    };

    const timer = setTimeout(() => requestAnimationFrame(run), 50);
    return () => clearTimeout(timer);
  }, [triggerKey]);

  return wrapRef;
}

function ParetoVentas({ paretoData, paretoDrillNombre, triggerKey }) {
  const wrapRef = useAnimatedPareto(triggerKey + "_" + paretoData.length + "_" + (paretoData[0]?.actual||0));
  const uid = "pvg";
  return (
    <div ref={wrapRef} style={{ position:"relative", width:"100%", height:185 }}>
      {/* Scan line premium */}
      <div style={{
        position:"absolute", inset:0, pointerEvents:"none", overflow:"hidden", borderRadius:8, zIndex:5,
      }}>
        <div className="pareto-scan" style={{
          position:"absolute", top:0, left:"-50%", width:"50%", height:"100%",
          background:"linear-gradient(90deg,transparent,rgba(0,194,232,0.07),rgba(0,194,232,0.12),rgba(0,194,232,0.07),transparent)",
        }}/>
      </div>
      <ResponsiveContainer width="100%" height={185}>
        <ComposedChart data={paretoData} margin={{ top:8, right:36, bottom:0, left:-10 }}>
          <defs>
            {/* Gradiente barras bloque 80% */}
            <linearGradient id={`${uid}-bar-active`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={C.cyan} stopOpacity={1}/>
              <stop offset="100%" stopColor={C.blue} stopOpacity={0.5}/>
            </linearGradient>
            {/* Gradiente barras fuera bloque */}
            <linearGradient id={`${uid}-bar-muted`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#555" stopOpacity={0.7}/>
              <stop offset="100%" stopColor="#333" stopOpacity={0.3}/>
            </linearGradient>
            {/* Gradiente barras drill seleccionado */}
            <linearGradient id={`${uid}-bar-drill`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={C.blue} stopOpacity={1}/>
              <stop offset="100%" stopColor={C.indigo} stopOpacity={0.6}/>
            </linearGradient>
            {/* Área bajo la curva dorada */}
            <linearGradient id={`${uid}-area`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#D4A847" stopOpacity={0.15}/>
              <stop offset="100%" stopColor="#D4A847" stopOpacity={0}/>
            </linearGradient>
            {/* Glow filter línea */}
            <filter id={`${uid}-glow`} x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="3" result="blur"/>
              <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
            </filter>
          </defs>
          <CartesianGrid strokeDasharray="2 6" stroke={C.border} vertical={false} strokeOpacity={0.6}/>
          <XAxis dataKey="nombre" tick={false} axisLine={false} tickLine={false}/>
          <YAxis yAxisId="v" tick={{ fontSize:9, fill:C.textMuted }} axisLine={false} tickLine={false} tickFormatter={v=>`$${v/1000}K`}/>
          <YAxis yAxisId="p" orientation="right" tick={{ fontSize:9, fill:C.textMuted }} axisLine={false} tickLine={false} tickFormatter={v=>`${v}%`} domain={[0,100]}/>
          <Tooltip content={({ active, payload, label })=>{
            if (!active||!payload?.length) return null;
            const d=paretoData.find(x=>x.nombre===label)||{};
            return (
              <div style={{ background:"#0d0d0d", border:`1px solid ${C.borderLight}`, borderRadius:8, padding:"9px 12px", fontSize:11, boxShadow:`0 8px 24px rgba(0,0,0,0.6)` }}>
                <p style={{ color:C.text, fontWeight:700, marginBottom:4 }}>{label}</p>
                <p style={{ color:C.blue }}>Ventas: <strong>${d.actual?.toLocaleString()}K</strong></p>
                <p style={{ color:C.textSub }}>% Participación: <strong>{d.pctPart}%</strong></p>
                <p style={{ color:"#D4A847" }}>% Acumulado: <strong>{d.pctAcum}%</strong></p>
                {d.unidades && <p style={{ color:C.textSub }}>Unidades: <strong>{d.unidades?.toLocaleString()}</strong></p>}
              </div>
            );
          }}/>
          {/* Área bajo la curva */}
          <Area yAxisId="p" type="monotone" dataKey="pctAcum" fill={`url(#${uid}-area)`} stroke="none"/>
          <Bar yAxisId="v" dataKey="actual" name="Ventas" radius={[4,4,0,0]} maxBarSize={28}>
            {paretoData.map((d,i)=>(
              <Cell key={i}
                fill={paretoDrillNombre===d.nombre
                  ? `url(#${uid}-bar-drill)`
                  : d.pctAcum<=80
                    ? `url(#${uid}-bar-active)`
                    : `url(#${uid}-bar-muted)`}
              />
            ))}
          </Bar>
          {/* Línea con glow */}
          <Line yAxisId="p" type="monotone" dataKey="pctAcum" name="% Acumulado"
            stroke="#D4A847" strokeWidth={2.5}
            filter={`url(#${uid}-glow)`}
            dot={(props) => {
              const { cx, cy, index } = props;
              const isLast = index === paretoData.length - 1;
              return (
                <circle key={index} cx={cx} cy={cy}
                  r={isLast ? 5 : 3}
                  fill={isLast ? "#D4A847" : "#D4A847"}
                  stroke={isLast ? "#fff" : "none"}
                  strokeWidth={isLast ? 1.5 : 0}
                  style={isLast ? { filter:"drop-shadow(0 0 4px rgba(212,168,71,0.8))" } : {}}
                />
              );
            }}
            activeDot={{ r:5, fill:"#D4A847", stroke:"#fff", strokeWidth:1.5 }}
            unit="%"
          />
          <ReferenceLine yAxisId="p" y={80} stroke="#D4A847" strokeDasharray="4 3" strokeOpacity={0.5}
            label={{ value:"80%", fill:"#D4A847", fontSize:9, position:"insideTopRight" }}/>
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

// Wrapper card para Bloque 80% con botón ADI
function BloquePareto80Card({ paretoData, paretoDim, paretoDrillNombre, onDrillSelect }) {
  const [adiText,    setAdiText]    = useState("");
  const [adiLoading, setAdiLoading] = useState(false);
  const [adiDone,    setAdiDone]    = useState(false);

  const bloque = paretoData.filter(d=>d.pctAcum<=80);
  const items  = bloque.length ? bloque : paretoData.slice(0,1);
  const dimLabel = paretoDim==="cliente"?"Clientes":paretoDim==="marca"?"Marcas":paretoDim==="sfamilia"?"Superfamilias":"SKUs";

  const streamApi = async (messages, onChunk) => {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method:"POST", headers:{ "Content-Type":"application/json" },
      body:JSON.stringify({ model:"claude-sonnet-4-20250514", max_tokens:1000, stream:true, messages })
    });
    const reader = res.body.getReader(); const dec = new TextDecoder(); let full = "";
    while(true) {
      const { done, value } = await reader.read(); if(done) break;
      const chunk = dec.decode(value,{stream:true});
      for(const line of chunk.split("\n").filter(l=>l.startsWith("data:"))) {
        const json = line.replace("data: ","").trim(); if(json==="[DONE]") continue;
        try { const d=JSON.parse(json); if(d?.delta?.text){ full+=d.delta.text; onChunk(full); } } catch{}
      }
    }
    return full;
  };

  const handleExplicar = async () => {
    if (adiLoading) return;
    setAdiLoading(true); setAdiText(""); setAdiDone(false);

    const universo      = paretoData.length;
    const pctElementos  = +((items.length / universo) * 100).toFixed(0);
    const concLabel     = pctElementos > 60 ? "diversificado" : pctElementos >= 50 ? "intermedio" : "concentrado / riesgo";
    const totalGral     = paretoData.reduce((s,r)=>s+r.actual,0);

    const listaCtx = items.map((r,i) =>
      `${i+1}. ${r.nombre}: $${r.actual.toLocaleString()}K · ${r.pctPart}% participación · ${r.pctAcum}% acumulado`
    ).join("\n");

    const prompt = `Actúa como ADI, un controller senior que interpreta el negocio desde los datos visibles.
Estás analizando el bloque Pareto de ventas ($) — dimensión: ${dimLabel}.
Basate EXCLUSIVAMENTE en los datos visibles. No uses información externa. No inventes causas.

DATOS DEL BLOQUE:
Universo total: ${universo} ${dimLabel} | Bloque 80%: ${items.length} ${dimLabel} (${pctElementos}% del universo) → ${concLabel}
Ventas totales visibles: $${totalGral.toLocaleString()}K

DETALLE VISIBLE:
${listaCtx}

CRITERIO DE CONCENTRACIÓN:
- >60% del universo explica el 80% → diversificado (sano)
- 50%–60% → intermedio
- <50% → alta concentración / riesgo

REGLAS DE ANÁLISIS:
- Indicar cuántos elementos explican el 80% y si eso es concentración o diversificación
- Cada número debe tener contexto (a quién pertenece y qué significa)
- Integrar datos dentro de frases, no listar sueltos
- Prohibido: "probablemente", "podría deberse a", "quizás"
- No repetir la tabla completa

ESTILO DE REFERENCIA:
Resumen: "${items.length} ${dimLabel} explican el 80% de las ventas, lo que representa el ${pctElementos}% del universo — ${concLabel}."
Evidencia: "[Nombre] lidera con $XK (X%), seguido por [Nombre] con $XK (X%). Los primeros N elementos concentran el X%."
Lectura: usar criterio calculado arriba para interpretar si el negocio depende de pocos o muchos.
Foco: enfocado en estrategia comercial.

ESTRUCTURA OBLIGATORIA — 4 bloques separados por línea vacía, título en mayúsculas seguido de dos puntos:

RESUMEN:
Máximo 3 líneas. Cuántos ${dimLabel} explican el 80%, % del universo que representan, y si eso es concentración o diversificación.

EVIDENCIA:
Máximo 3 líneas. Nombres, ventas $, % participación y % acumulado integrados en frases. Cada número con su contexto.

LECTURA DEL NEGOCIO:
Máximo 3 líneas. Interpretar dependencia y concentración. Qué implica para el negocio. No repetir datos ya mencionados.

SIGUIENTE FOCO:
Máximo 3 acciones enfocadas en estrategia comercial. Formato directo, sin formato "[X] →".`;

    try {
      await streamApi([{ role:"user", content:prompt }], t => setAdiText(t));
      setAdiDone(true);
    } catch { setAdiText("Error al conectar con ADI."); setAdiDone(true); }
    setAdiLoading(false);
  };

  const adiBlocks = adiText ? adiText.split(/\n\n+/).filter(Boolean).map(b => {
    const colon = b.indexOf(":");
    if (colon > 0 && colon < 30 && b.slice(0,colon) === b.slice(0,colon).toUpperCase()) {
      return { title: b.slice(0,colon), body: b.slice(colon+1).trim() };
    }
    return { title: null, body: b };
  }) : [];

  const blockColors = [C.blue, C.cyan, C.indigo, C.amber];

  return (
    <Card>
      {/* Header con botón ADI */}
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:10 }}>
        <p style={{ fontWeight:700, fontSize:12 }}>
          Qué compone el 80% de las ventas
          <span style={{ color:C.blue, fontWeight:400, fontSize:11, marginLeft:6 }}>{dimLabel}</span>
          {paretoDim!=="sku" && (
            <span style={{ fontSize:10, color:C.textSub, fontWeight:400, marginLeft:8 }}>· Clic en fila para ver composición</span>
          )}
        </p>
      </div>

      {/* ADI response */}
      {(adiText || adiLoading) && (
        <div style={{ marginBottom:12, background:C.surfaceAlt, border:`1px solid ${C.cyan}20`, borderRadius:8, padding:"12px 14px", borderLeft:`3px solid ${C.cyan}` }}>
          <div style={{ display:"flex", alignItems:"center", gap:7, marginBottom:9 }}>
            <div style={{ width:18, height:18, borderRadius:5, background:"linear-gradient(135deg,#00c2e8,#0e7fa8)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:9, fontWeight:900, color:"#fff", flexShrink:0 }}>A</div>
            <span style={{ fontSize:10, fontWeight:700, color:"#00a8e8" }}>ADI</span>
            <span style={{ fontSize:9.5, color:C.textMuted }}>— Concentración de ventas</span>
          </div>
          {adiLoading && !adiText && (
            <div style={{ display:"flex", flexDirection:"column", gap:7 }}>
              {[68,52,78,48].map((w,i)=>(
                <div key={i} style={{ height:7, width:`${w}%`, background:C.border, borderRadius:3, opacity:0.5, animation:`pulse 1.4s ${i*0.1}s infinite` }}/>
              ))}
            </div>
          )}
          {adiBlocks.length > 0 && (
            <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
              {adiBlocks.map((b,i) => (
                <div key={i} style={{ borderLeft:`2px solid ${blockColors[i%blockColors.length]}`, paddingLeft:10 }}>
                  {b.title && <p style={{ fontSize:8.5, fontWeight:800, color:blockColors[i%blockColors.length], textTransform:"uppercase", letterSpacing:"0.8px", marginBottom:3 }}>{b.title}</p>}
                  <p style={{ fontSize:11, color:"#c0c0c0", lineHeight:1.65 }}>
                    {b.body}
                    {adiLoading && i===adiBlocks.length-1 && <span style={{ display:"inline-block", width:5, height:10, background:C.cyan, borderRadius:2, animation:"blink 0.8s infinite", marginLeft:2 }}/>}
                  </p>
                </div>
              ))}
              {!adiLoading && adiDone && (
                <button onClick={handleExplicar} style={{ alignSelf:"flex-start", fontSize:9.5, color:C.textMuted, background:"transparent", border:`1px solid ${C.border}`, borderRadius:4, padding:"3px 9px", cursor:"pointer", marginTop:2 }}>↻ Regenerar</button>
              )}
            </div>
          )}
          {adiLoading && adiText && adiBlocks.length===0 && (
            <p style={{ fontSize:11, color:"#c0c0c0", lineHeight:1.65 }}>{adiText}<span style={{ display:"inline-block", width:5, height:10, background:C.cyan, borderRadius:2, animation:"blink 0.8s infinite", marginLeft:2 }}/></p>
          )}
        </div>
      )}

      <TablaBloque80
        paretoData={paretoData}
        paretoDim={paretoDim}
        paretoDrillNombre={paretoDrillNombre}
        onDrillSelect={onDrillSelect}
      />
    </Card>
  );
}

// Tabla resumen del bloque 80%
function TablaBloque80({ paretoData, paretoDim, paretoDrillNombre, onDrillSelect }) {
  const bloque = paretoData.filter(d=>d.pctAcum<=80);
  // Si ninguno llega a 80, tomar el primero
  const items  = bloque.length ? bloque : paretoData.slice(0,1);
  return (
    <div>
      <p style={{ fontSize:10, color:C.textSub, marginBottom:8 }}>
        <span style={{ color:"#00a8e8", fontWeight:700 }}>{items.length} elemento{items.length>1?"s":""}</span>
        {" explican el 80% de las ventas"}
        {" · Clic en fila para ver composición"}
      </p>
      <div style={{ overflowX:"auto", width:"100%" }}>
      <table style={{ width:"100%", minWidth:380, borderCollapse:"collapse", fontSize:11 }}>
        <thead>
          <tr style={{ borderBottom:`1px solid ${C.border}` }}>
            {["Rank.","Nombre","Ventas","% Part.","% Acum."].map(h=>(
              <th key={h} style={{ textAlign:"left", padding:"6px 8px", fontSize:9, textTransform:"uppercase", letterSpacing:"0.5px", color:C.textSub, whiteSpace:"nowrap" }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {items.map((r,i)=>{
            const isSel = paretoDrillNombre===r.nombre;
            return (
              <tr key={i}
                style={{ borderBottom:`1px solid ${C.border}`, cursor:"pointer", background:isSel?"rgba(0,168,232,0.05)":"transparent", outline:isSel?`1px solid ${C.blue}30`:undefined }}
                onClick={()=>onDrillSelect(isSel?null:r.nombre)}
                onMouseEnter={e=>{ if(!isSel) e.currentTarget.style.background=C.surfaceAlt; }}
                onMouseLeave={e=>{ if(!isSel) e.currentTarget.style.background="transparent"; }}>
                <td style={{ padding:"7px 9px" }}>
                  <span style={{ fontSize:10, fontWeight:800, color:"#00a8e8" }}>#{i+1}</span>
                </td>
                <td style={{ padding:"7px 9px", fontWeight:700, color:isSel?"#00a8e8":C.text }}>{r.nombre}</td>
                <td style={{ padding:"7px 9px", fontWeight:700, color:C.blue }}>${r.actual.toLocaleString()}K</td>
                <td style={{ padding:"7px 9px", color:C.textSub }}>{r.pctPart}%</td>
                <td style={{ padding:"7px 9px" }}>
                  <span style={{ padding:"2px 7px", borderRadius:4, fontSize:10, fontWeight:700, background:"rgba(0,168,232,0.1)", color:"#00a8e8" }}>{r.pctAcum}%</span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      </div>
    </div>
  );
}

// Drill del Pareto: composición del elemento seleccionado
function DrillPareto({ nombre, paretoDim, onClose }) {
  const composicion = (() => {
    if (paretoDim==="cliente") {
      const skus = skusPorCliente[nombre]||[];
      const marcaMap={}, famMap={};
      skus.forEach(s=>{
        marcaMap[s.marca]    = (marcaMap[s.marca]||0)    + s.actual;
        famMap[s.sfamilia]   = (famMap[s.sfamilia]||0)   + s.actual;
      });
      return [
        { label:"Marca",        rows: Object.entries(marcaMap).map(([k,v])=>({ nombre:k, actual:v })).sort((a,b)=>b.actual-a.actual) },
        { label:"Superfamilia", rows: Object.entries(famMap).map(([k,v])=>({ nombre:k, actual:v })).sort((a,b)=>b.actual-a.actual) },
        { label:"SKU",          rows: [...skus].sort((a,b)=>b.actual-a.actual) },
      ];
    }
    if (paretoDim==="marca") {
      const skus = skusPorMarca[nombre]||[];
      const famMap={};
      skus.forEach(s=>{ famMap[s.sfamilia]=(famMap[s.sfamilia]||0)+s.actual; });
      return [
        { label:"Superfamilia", rows: Object.entries(famMap).map(([k,v])=>({ nombre:k, actual:v })).sort((a,b)=>b.actual-a.actual) },
        { label:"SKU",          rows: [...skus].sort((a,b)=>b.actual-a.actual) },
      ];
    }
    if (paretoDim==="sfamilia") {
      const skus = skusPorSfamilia[nombre]||[];
      return [{ label:"SKU", rows:[...skus].sort((a,b)=>b.actual-a.actual) }];
    }
    // sku — no hay drill adicional (no debería llegar aquí)
    return [];
  })();

  if (!composicion.length) return null;

  const subtitleMap = {
    cliente:  "Marca · Superfamilia · SKU",
    marca:    "Superfamilia · SKU",
    sfamilia: "SKU",
  };

  return (
    <Card>
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:12 }}>
        <div>
          <p style={{ fontWeight:700, fontSize:12 }}>
            Composición: <span style={{ color:C.cyan }}>{nombre}</span>
          </p>
          <p style={{ fontSize:10, color:C.textSub }}>{subtitleMap[paretoDim]}</p>
        </div>
        <button onClick={onClose} style={{ background:"transparent", border:`1px solid ${C.border}`, color:C.textSub, borderRadius:5, padding:"3px 9px", fontSize:10, cursor:"pointer" }}>✕</button>
      </div>
      <div style={{ overflowX:"auto", width:"100%" }}>
      <div style={{ display:"grid", gridTemplateColumns:`repeat(${composicion.length},minmax(200px,1fr))`, gap:16, alignItems:"flex-start" }}>
        {composicion.map(grupo=>{
          const total = grupo.rows.reduce((s,r)=>s+r.actual,0);
          return (
            <div key={grupo.label}>
              <p style={{ fontSize:9, color:C.textMuted, textTransform:"uppercase", letterSpacing:"0.8px", marginBottom:8, fontWeight:700 }}>{grupo.label}</p>
              <table style={{ width:"100%", borderCollapse:"collapse", fontSize:11 }}>
                <thead>
                  <tr style={{ borderBottom:`1px solid ${C.border}` }}>
                    <th style={{ textAlign:"left", padding:"5px 8px", fontSize:9, color:C.textSub }}>Nombre</th>
                    <th style={{ textAlign:"left", padding:"5px 8px", fontSize:9, color:C.textSub }}>Ventas</th>
                    <th style={{ textAlign:"left", padding:"5px 8px", fontSize:9, color:C.textSub }}>Und.</th>
                    <th style={{ textAlign:"left", padding:"5px 8px", fontSize:9, color:C.textSub }}>% Part.</th>
                  </tr>
                </thead>
                <tbody>
                  {grupo.rows.map((r,i)=>(
                    <tr key={i} style={{ borderBottom:`1px solid ${C.border}` }}
                      onMouseEnter={e=>e.currentTarget.style.background=C.surfaceAlt}
                      onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                      <td style={{ padding:"6px 8px", fontWeight:600, color:C.text, whiteSpace:"nowrap" }}>{r.nombre}</td>
                      <td style={{ padding:"6px 8px", color:C.blue, fontWeight:700 }}>${r.actual.toLocaleString()}K</td>
                      <td style={{ padding:"6px 8px", color:C.textSub }}>{r.unidades?.toLocaleString()??"-"}</td>
                      <td style={{ padding:"6px 8px", color:C.textSub }}>{+((r.actual/total)*100).toFixed(1)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        })}
      </div>
      </div>
    </Card>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// TABLA GENERAL VENTAS — foco comercial
// Orden: ✓ · Dimensión · Ventas · Rebate% · Ticket(solo cliente) · %Part · Crecimiento
// Multi-selección con checkbox · sin columna Unidades
// ════════════════════════════════════════════════════════════════════════════
function TablaGeneralVentas({ tableData, totalVenta, sortCol, setSortCol, tableSel, onTableSel, metrica, onMetrica, tableDim }) {
  const sorted = [...tableData].sort((a,b)=>b[sortCol]-(a[sortCol]||0));
  const showTicket = tableDim === "cliente";
  const GRAFICABLES = ["actual","anterior","presupuesto","gapPres","gapAnt","ticket","pctPart"];

  // tableSel es ahora un Set de nombres seleccionados
  const selSet = tableSel instanceof Set ? tableSel : new Set(tableSel ? [tableSel] : []);
  const allNames = sorted.map(r=>r.nombre);
  const allSelected = allNames.length > 0 && allNames.every(n=>selSet.has(n));

  const toggleAll = () => {
    if (allSelected) onTableSel(new Set());
    else onTableSel(new Set(allNames));
  };
  const toggleRow = (nombre, mk) => {
    const next = new Set(selSet);
    if (next.has(nombre)) next.delete(nombre);
    else next.add(nombre);
    onTableSel(next, nombre, mk);
  };

  const thStyle = (key) => ({
    textAlign:"left", padding:"7px 9px", fontSize:9, textTransform:"uppercase", letterSpacing:"0.5px",
    cursor:"pointer", userSelect:"none", whiteSpace:"nowrap",
    color: sortCol===key ? C.blue : metrica===key ? C.cyan : C.textSub,
    borderBottom: metrica===key ? `2px solid ${C.cyan}` : "2px solid transparent",
  });
  const thPlain = { textAlign:"left", padding:"7px 9px", fontSize:9, textTransform:"uppercase",
    letterSpacing:"0.5px", whiteSpace:"nowrap", color:C.textSub };

  const handleTh = (sk, mk) => { setSortCol(sk); if(mk&&GRAFICABLES.includes(mk)) onMetrica(mk); };

  // Estilo del checkbox custom
  const Checkbox = ({ checked, indeterminate=false, onChange }) => (
    <div onClick={e=>{ e.stopPropagation(); onChange(); }} style={{
      width:14, height:14, borderRadius:3, flexShrink:0, cursor:"pointer",
      border:`1.5px solid ${checked||indeterminate ? "#00a8e8" : C.borderLight}`,
      background: checked ? "#00a8e8" : indeterminate ? "rgba(0,168,232,0.25)" : "transparent",
      display:"flex", alignItems:"center", justifyContent:"center", transition:"all 0.12s",
    }}>
      {checked && <span style={{ color:"#000", fontSize:9, fontWeight:900, lineHeight:1 }}>✓</span>}
      {!checked && indeterminate && <span style={{ color:"#00a8e8", fontSize:10, fontWeight:900, lineHeight:1 }}>−</span>}
    </div>
  );

  const someSelected = selSet.size > 0 && !allSelected;

  return (
    <div style={{ overflowX:"auto", width:"100%" }}>
      <table style={{ width:"100%", minWidth:showTicket?660:580, borderCollapse:"collapse", fontSize:11 }}>
        <thead>
          <tr style={{ borderBottom:`1px solid ${C.border}` }}>
            {/* Checkbox seleccionar todos */}
            <th style={{ ...thPlain, width:36, paddingRight:4 }}>
              <Checkbox checked={allSelected} indeterminate={someSelected} onChange={toggleAll}/>
            </th>
            <th style={{ ...thPlain, width:28 }}>#</th>
            <th onClick={()=>handleTh("nombre",null)} style={thStyle("nombre")}>
              {tableDim==="cliente"?"Cliente":tableDim==="marca"?"Marca":"Familia"}
            </th>
            <th onClick={()=>handleTh("actual","actual")} style={thStyle("actual")}>
              <span style={{ display:"inline-flex", alignItems:"center" }}>Ventas ($)<InfoTip id="ventas_actuales"/></span>
            </th>
            <th onClick={()=>handleTh("pctRebate",null)} style={thStyle("pctRebate")}>
              <span style={{ display:"inline-flex", alignItems:"center" }}>Rebate %<InfoTip id="rebate_pct"/></span>
            </th>
            {showTicket && (
              <th onClick={()=>handleTh("ticket","ticket")} style={thStyle("ticket")}>
                <span style={{ display:"inline-flex", alignItems:"center" }}>Ticket prom.<InfoTip id="ticket_promedio"/></span>
              </th>
            )}
            <th onClick={()=>handleTh("pctPart","pctPart")} style={thStyle("pctPart")}>
              <span style={{ display:"inline-flex", alignItems:"center" }}>% Part.<InfoTip id="participacion"/></span>
            </th>
            <th onClick={()=>handleTh("gapAnt","gapAnt")} style={thStyle("gapAnt")}>
              <span style={{ display:"inline-flex", alignItems:"center" }}>Crec. vs Ant.<InfoTip id="vs_anterior"/></span>
            </th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((r,i)=>{
            const ticket  = +(r.actual/r.unidades).toFixed(1);
            const gapAnt  = +((r.actual-r.anterior)/r.anterior*100).toFixed(1);
            const pctPart = +((r.actual/totalVenta)*100).toFixed(1);
            const bgA     = badge(gapAnt);
            const isSel   = selSet.has(r.nombre);

            const tdClick = (mk) => (e) => {
              e.stopPropagation();
              if (GRAFICABLES.includes(mk)) { toggleRow(r.nombre, mk); onMetrica(mk); }
            };
            const tdS = (mk) => ({
              padding:"8px 9px",
              cursor: GRAFICABLES.includes(mk)?"pointer":"default",
              background: metrica===mk&&isSel?"rgba(34,211,238,0.04)":"transparent",
            });

            return (
              <tr key={i}
                style={{ borderBottom:`1px solid ${C.border}`, cursor:"pointer", background:isSel?"rgba(0,168,232,0.05)":"transparent", transition:"background 0.1s", outline:isSel?`1px solid ${C.blue}30`:undefined }}
                onClick={()=>toggleRow(r.nombre, metrica)}
                onMouseEnter={e=>{ if(!isSel) e.currentTarget.style.background=C.surfaceAlt; }}
                onMouseLeave={e=>{ if(!isSel) e.currentTarget.style.background="transparent"; }}>

                {/* Checkbox */}
                <td style={{ padding:"8px 9px", paddingRight:4 }}>
                  <Checkbox checked={isSel} onChange={()=>toggleRow(r.nombre, metrica)}/>
                </td>
                <td style={{ padding:"8px 9px", color:C.textMuted, fontSize:10 }}>{i+1}</td>
                <td style={{ padding:"8px 9px", fontWeight:700, color:isSel?"#00a8e8":C.text, whiteSpace:"nowrap" }}>{r.nombre}</td>
                <td style={tdS("actual")} onClick={tdClick("actual")}>
                  <span style={{ fontWeight:700, color:C.blue }}>${r.actual.toLocaleString()}K</span>
                </td>
                <td style={{ padding:"8px 9px" }}>
                  <span style={{ color:r.pctRebate>5?C.red:r.pctRebate>3?C.amber:C.textSub, fontWeight:600 }}>{r.pctRebate}%</span>
                </td>
                {showTicket && (
                  <td style={tdS("ticket")} onClick={tdClick("ticket")}>
                    <span style={{ color:C.cyan, fontWeight:600 }}>${ticket}K</span>
                  </td>
                )}
                <td style={tdS("pctPart")} onClick={tdClick("pctPart")}>
                  <span style={{ color:C.textSub }}>{pctPart}%</span>
                </td>
                <td style={tdS("gapAnt")} onClick={tdClick("gapAnt")}>
                  <span style={{ padding:"2px 6px", borderRadius:4, fontSize:10, fontWeight:700, background:bgA.bg, color:bgA.color }}>{gapAnt>0?"+":""}{gapAnt}%</span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// Drill jerárquico de la tabla general
function DrillTablaGeneral({ nombre, tableDim, onClose }) {
  const drillData = (() => {
    if (tableDim==="cliente")  return skusPorCliente[nombre]||[];
    if (tableDim==="marca")    return skusPorMarca[nombre]||[];
    return skusPorSfamilia[nombre]||[];
  })();
  const drillLabel = tableDim==="cliente"?"SKUs / Familias":tableDim==="marca"?"SKUs / Familias":"SKUs";
  const total = drillData.reduce((s,r)=>s+r.actual,0);

  return (
    <Card>
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:10 }}>
        <div>
          <p style={{ fontWeight:700, fontSize:12 }}>
            {drillLabel} de <span style={{ color:C.blue }}>{nombre}</span>
          </p>
          <p style={{ fontSize:10, color:C.textSub }}>Detalle jerárquico</p>
        </div>
        <button onClick={onClose} style={{ background:"transparent", border:`1px solid ${C.border}`, color:C.textSub, borderRadius:5, padding:"3px 9px", fontSize:10, cursor:"pointer" }}>✕</button>
      </div>
      <div style={{ overflowX:"auto", width:"100%" }}>
        <table style={{ width:"100%", minWidth:620, borderCollapse:"collapse", fontSize:11 }}>
          <thead>
            <tr style={{ borderBottom:`1px solid ${C.border}` }}>
              {["#","Nombre","Familia","Marca","Ventas","Año Ant.","Und.","% Part.","Crec."].map(h=>(
                <th key={h} style={{ textAlign:"left", padding:"6px 9px", fontSize:9, textTransform:"uppercase", letterSpacing:"0.5px", color:C.textSub }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {drillData.map((r,i)=>{
              const crec = +((r.actual-r.anterior)/r.anterior*100).toFixed(1);
              const bc   = badge(crec);
              return (
                <tr key={i} style={{ borderBottom:`1px solid ${C.border}` }}
                  onMouseEnter={e=>e.currentTarget.style.background=C.surfaceAlt}
                  onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                  <td style={{ padding:"7px 9px", color:C.textMuted, fontSize:10 }}>{i+1}</td>
                  <td style={{ padding:"7px 9px", fontWeight:600, color:C.text, whiteSpace:"nowrap" }}>{r.nombre}</td>
                  <td style={{ padding:"7px 9px", color:C.textSub, whiteSpace:"nowrap" }}>{r.sfamilia}</td>
                  <td style={{ padding:"7px 9px", color:C.textSub }}>{r.marca}</td>
                  <td style={{ padding:"7px 9px", fontWeight:700, color:C.blue }}>${r.actual.toLocaleString()}K</td>
                  <td style={{ padding:"7px 9px", color:C.textSub }}>${r.anterior.toLocaleString()}K</td>
                  <td style={{ padding:"7px 9px", color:C.textSub }}>{r.unidades.toLocaleString()}</td>
                  <td style={{ padding:"7px 9px", color:C.textSub }}>{+((r.actual/total)*100).toFixed(1)}%</td>
                  <td style={{ padding:"7px 9px" }}>
                    <span style={{ padding:"2px 6px", borderRadius:4, fontSize:10, fontWeight:700, background:bc.bg, color:bc.color }}>{crec>0?"+":""}{crec}%</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// GRÁFICO DINÁMICO VENTAS — soporta selección múltiple (una línea por elemento)
// ════════════════════════════════════════════════════════════════════════════
const MULTI_COLORS = [C.blue, C.cyan, C.green, C.amber, C.violet, C.red, "#f97316", "#a3e635", "#38bdf8", "#e879f9"];

function GraficoDinamicoVentas({ nombres, metrica, onClose }) {
  // nombres: array de strings (uno o varios)
  const nombresArr = Array.isArray(nombres) ? nombres : [nombres];
  const isMulti = nombresArr.length > 1;

  // Configuración de métrica — qué campo del historial graficar
  const CFG = {
    actual:      { label:"Ventas",              field:"actual",    yFmt:v=>`$${v}K`, unit:"K", refLine:false },
    anterior:    { label:"Ventas vs Año Ant.",  field:"actual",    yFmt:v=>`$${v}K`, unit:"K", refLine:false },
    presupuesto: { label:"Real vs Presupuesto", field:"actual",    yFmt:v=>`$${v}K`, unit:"K", refLine:false },
    gapPres:     { label:"GAP vs Presupuesto",  field:"gapPres",   yFmt:v=>`${v}%`,  unit:"%",  refLine:true  },
    gapAnt:      { label:"GAP vs Año Ant.",     field:"gapAnt",    yFmt:v=>`${v}%`,  unit:"%",  refLine:true  },
    ticket:      { label:"Ticket Promedio",      field:"ticket",    yFmt:v=>`$${v}K`, unit:"K", refLine:false },
    pctPart:     { label:"% Participación",     field:"pctPart",   yFmt:v=>`${v}%`,  unit:"%",  refLine:false },
  };
  const cfg = CFG[metrica] || CFG.actual;

  // Cuando hay un solo elemento, mantener el comportamiento anterior (actual + anterior)
  const singleCfgLines = {
    actual:      [{k:"actual",name:"Actual",color:C.blue,w:2.5},{k:"anterior",name:"Año Ant.",color:"#2a3a52",w:1.5,dash:"4 4"}],
    anterior:    [{k:"actual",name:"Actual",color:C.blue,w:2.5},{k:"anterior",name:"Año Ant.",color:"#2a3a52",w:1.5,dash:"4 4"}],
    presupuesto: [{k:"actual",name:"Real",color:C.blue,w:2.5},{k:"presupuesto",name:"Presup.",color:C.amber,w:1.5,dash:"6 3"}],
    gapPres:     [{k:"gapPres",name:"GAP %",color:C.amber,w:2.5}],
    gapAnt:      [{k:"gapAnt",name:"GAP %",color:C.green,w:2.5}],
    ticket:      [{k:"ticket",name:"Ticket Act.",color:C.cyan,w:2.5},{k:"ticketAnt",name:"Ticket Ant.",color:"#2a3a52",w:1.5,dash:"4 4"}],
    pctPart:     [{k:"pctPart",name:"Part. Act.",color:C.indigo,w:2.5},{k:"pctPartAnt",name:"Part. Ant.",color:"#2a3a52",w:1.5,dash:"4 4"}],
  };

  // ── Modo MULTI: fusionar los datos de todos los elementos en un array por mes
  // Cada mes tiene un campo por cada elemento seleccionado
  const MESES = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];

  const chartData = isMulti ? (() => {
    const histMap = {};
    nombresArr.forEach(n => { histMap[n] = buildMensualElemento(n); });
    return MESES.map((mes, i) => {
      const point = { mes };
      nombresArr.forEach(n => {
        const row = histMap[n][i];
        point[n] = row[cfg.field] ?? row["actual"];
      });
      return point;
    });
  })() : buildMensualElemento(nombresArr[0]);

  return (
    <Card>
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:6 }}>
        <div>
          <p style={{ fontSize:9, color:C.textSub, textTransform:"uppercase", letterSpacing:"0.8px" }}>
            Analizando: <span style={{ color:C.cyan, fontWeight:700 }}>{cfg.label}</span>
            {" — "}
            {isMulti
              ? <span style={{ color:C.text, fontWeight:600 }}>{nombresArr.length} elementos seleccionados</span>
              : <span style={{ color:C.text, fontWeight:600 }}>{nombresArr[0]}</span>
            }
          </p>
          <p style={{ fontSize:9.5, color:C.textMuted }}>
            Ene–Dic · histórico completo
            {isMulti && <span style={{ color:C.cyan, marginLeft:6 }}>· una línea por elemento</span>}
          </p>
        </div>
        <button onClick={onClose} style={{ background:"transparent", border:`1px solid ${C.border}`, color:C.textSub, borderRadius:5, padding:"3px 9px", fontSize:10, cursor:"pointer" }}>✕</button>
      </div>

      {/* Leyenda */}
      <div style={{ display:"flex", gap:12, marginBottom:8, flexWrap:"wrap" }}>
        {isMulti
          ? nombresArr.map((n,i) => (
              <span key={n} style={{ display:"flex", alignItems:"center", gap:5, fontSize:10, color:C.textSub }}>
                <span style={{ width:18, height:2.5, background:MULTI_COLORS[i%MULTI_COLORS.length], display:"inline-block", borderRadius:2 }}/>
                {n}
              </span>
            ))
          : (singleCfgLines[metrica]||singleCfgLines.actual).map(l => (
              <span key={l.k} style={{ display:"flex", alignItems:"center", gap:5, fontSize:10, color:C.textSub }}>
                <span style={{ width:18, height:2, background:l.dash?"transparent":l.color, display:"inline-block", borderRadius:2,
                  ...(l.dash?{backgroundImage:`repeating-linear-gradient(90deg,${l.color} 0,${l.color} 4px,transparent 4px,transparent 7px)`}:{}) }}/>
                {l.name}
              </span>
            ))
        }
      </div>

      <AnimatedChart triggerKey={nombresArr.join(",") + "_" + metrica} height={165} color={C.blue}>
        <ResponsiveContainer width="100%" height={165}>
          <LineChart data={chartData} margin={{ top:4, right:12, bottom:0, left:-10 }}>
            <defs>
              <filter id="dvg-glow" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="3" result="blur"/>
                <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
              </filter>
              <linearGradient id="dvg-area" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={C.blue} stopOpacity={0.12}/>
                <stop offset="100%" stopColor={C.blue} stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="2 6" stroke={C.border} strokeOpacity={0.6}/>
            <XAxis dataKey="mes" tick={{ fontSize:9, fill:C.textSub }} axisLine={false} tickLine={false}/>
            <YAxis tick={{ fontSize:9, fill:C.textSub }} axisLine={false} tickLine={false} tickFormatter={cfg.yFmt}/>
            <Tooltip content={<ChartTooltip/>}/>
            {cfg.refLine && <ReferenceLine y={0} stroke={C.borderLight} strokeDasharray="4 3"/>}
            {isMulti
              ? nombresArr.map((n, i) => (
                  <Line key={n} type="monotone" dataKey={n} name={n}
                    stroke={MULTI_COLORS[i%MULTI_COLORS.length]} strokeWidth={2.5}
                    filter="url(#dvg-glow)"
                    dot={(props) => { const { cx,cy,index } = props; const isLast = index===11; return <circle key={index} cx={cx} cy={cy} r={isLast?5:2.5} fill={MULTI_COLORS[i%MULTI_COLORS.length]} stroke={isLast?"#fff":"none"} strokeWidth={isLast?1.5:0}/>; }}
                    activeDot={{ r:5 }} unit={cfg.unit}/>
                ))
              : (singleCfgLines[metrica]||singleCfgLines.actual).map((l,idx) => (
                  <Line key={l.k} type="monotone" dataKey={l.k} name={l.name}
                    stroke={l.color} strokeWidth={l.w}
                    filter={idx===0?"url(#dvg-glow)":undefined}
                    dot={idx===0?(props)=>{ const {cx,cy,index}=props; const isLast=index===11; return <circle key={index} cx={cx} cy={cy} r={isLast?5:3} fill={l.color} stroke={isLast?"#fff":"none"} strokeWidth={isLast?1.5:0}/>; }:false}
                    activeDot={{r:5}} unit={cfg.unit} strokeDasharray={l.dash||undefined}/>
                ))
            }
          </LineChart>
        </ResponsiveContainer>
      </AnimatedChart>
    </Card>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// TABLA TOP 10 CLIENTES — dos modos según KPI clickeado
//   modo "ventas"   → Ventas · % vs Ant. · % GAP presup. · % Part.
//   modo "anterior" → Ventas · Año Anterior · Presupuesto (si existe)
// ════════════════════════════════════════════════════════════════════════════
function TablaTop10Clientes({ modo, onClose }) {
  const totalActual   = ventasKPI.totalActual;
  const totalAnterior = ventasKPI.totalAnterior;
  const top10 = [...clientesVentas]
    .sort((a,b)=>b.actual-a.actual)
    .slice(0,10);

  const hasBudget = top10.some(r => r.presupuesto != null);
  const totalPresupuesto = hasBudget ? top10.reduce((s,r)=>s+(r.presupuesto||0),0) : null;

  // ADI state
  const [adiText,    setAdiText]    = useState("");
  const [adiLoading, setAdiLoading] = useState(false);
  const [adiDone,    setAdiDone]    = useState(false);

  const streamApi = async (messages, onChunk) => {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method:"POST", headers:{ "Content-Type":"application/json" },
      body:JSON.stringify({ model:"claude-sonnet-4-20250514", max_tokens:1000, stream:true, messages })
    });
    const reader = res.body.getReader(); const dec = new TextDecoder(); let full = "";
    while(true) {
      const { done, value } = await reader.read(); if(done) break;
      const chunk = dec.decode(value,{stream:true});
      for(const line of chunk.split("\n").filter(l=>l.startsWith("data:"))) {
        const json = line.replace("data: ","").trim(); if(json==="[DONE]") continue;
        try { const d=JSON.parse(json); if(d?.delta?.text){ full+=d.delta.text; onChunk(full); } } catch{}
      }
    }
    return full;
  };

  const handleExplicar = async () => {
    if (adiLoading) return;
    setAdiLoading(true); setAdiText(""); setAdiDone(false);
    const vsAntTotal = +((totalActual-totalAnterior)/totalAnterior*100).toFixed(1);
    const gapPres = totalPresupuesto ? +((totalActual-totalPresupuesto)/totalPresupuesto*100).toFixed(1) : null;
    const clientesCtx = top10.map((r,i) => {
      const va = +((r.actual-r.anterior)/r.anterior*100).toFixed(1);
      const gp = r.presupuesto ? +((r.actual-r.presupuesto)/r.presupuesto*100).toFixed(1) : null;
      return `${i+1}. ${r.nombre}: $${r.actual.toLocaleString()}K (${va>0?"+":""}${va}% vs ant.${gp!=null?`, ${gp>0?"+":""}${gp}% vs presup.`:""})`;
    }).join("\n");

    const prompt = `Eres ADI, un asesor experto en negocios. Interpreta este resultado de ventas basándote solo en los datos entregados. No inventes causas. No especules.

DATOS:
Ventas actuales: $${totalActual.toLocaleString()}K
Variación vs año anterior: ${vsAntTotal>0?"+":""}${vsAntTotal}%
${gapPres!=null?`GAP vs presupuesto: ${gapPres>0?"+":""}${gapPres}%`:""}

CLIENTES:
${clientesCtx}

REGLAS:
- Sin asteriscos, sin markdown, sin viñetas
- No repetir números que ya están visibles
- Lenguaje simple: "se concentra", "depende de", "está creciendo", "no está cumpliendo", "hay riesgo"
- Prohibido: "probablemente", "podría deberse a", "quizás"
- Máximo 2 líneas por bloque

Responde con exactamente 4 bloques separados por línea vacía, cada uno comenzando con su título en mayúsculas seguido de dos puntos:

RESUMEN:
LECTURA DEL RESULTADO:
IMPLICANCIA PARA EL NEGOCIO:
SIGUIENTE FOCO:`;

    try {
      await streamApi([{ role:"user", content:prompt }], t => setAdiText(t));
      setAdiDone(true);
    } catch { setAdiText("Error al conectar con ADI."); setAdiDone(true); }
    setAdiLoading(false);
  };

  // Paleta de texto
  const tx1 = "#FFFFFF";   // primario
  const tx2 = "#c0c0c0";   // secundario
  const tx3 = "#707070";   // apagado
  const txH = "#c0c0c0";   // encabezados

  const thB = { textAlign:"left", padding:"7px 10px", fontSize:9, textTransform:"uppercase", letterSpacing:"0.6px", whiteSpace:"nowrap", fontWeight:600 };

  // ── Encabezado según modo
  const modoLabel = modo === "ventas"
    ? { title:"Performance & Participación", sub:"Ventas actuales · variación vs año anterior · GAP vs presupuesto · participación" }
    : { title:"Comparativa Niveles Absolutos", sub:"Ventas actuales vs año anterior" + (hasBudget?" · con presupuesto":"") };

  const accentColor = modo === "ventas" ? C.blue : C.indigo;

  // Parse ADI blocks
  const adiBlocks = adiText ? adiText.split(/\n\n+/).filter(Boolean).map(b => {
    const colon = b.indexOf(":");
    if (colon > 0 && colon < 30 && b.slice(0,colon) === b.slice(0,colon).toUpperCase()) {
      return { title: b.slice(0,colon), body: b.slice(colon+1).trim() };
    }
    return { title: null, body: b };
  }) : [];

  const blockColors = [C.blue, C.cyan, C.indigo, C.amber];

  return (
    <div style={{
      background:C.surface, border:`1px solid ${accentColor}`, borderRadius:10,
      padding:"16px", marginTop:-4,
      boxShadow:`0 4px 24px rgba(${modo==="ventas"?"14,165,233":"129,140,248"},0.10)`,
      animation:"fadeSlideDown 0.18s ease"
    }}>
      <style>{`@keyframes fadeSlideDown{from{opacity:0;transform:translateY(-6px)}to{opacity:1;transform:translateY(0)}}`}</style>

      {/* Header */}
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:13 }}>
        <div>
          <p style={{ fontWeight:700, fontSize:12, color:tx1 }}>
            Top 10 Clientes
            <span style={{ fontWeight:400, color:accentColor, fontSize:11, marginLeft:8 }}>
              — {modoLabel.title}
            </span>
          </p>
          <p style={{ fontSize:10, color:tx2, marginTop:2 }}>{modoLabel.sub}</p>
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:8 }}>
          <button onClick={onClose} style={{ background:"transparent", border:`1px solid ${C.border}`, color:tx2, borderRadius:5, padding:"3px 10px", fontSize:10, cursor:"pointer" }}>✕</button>
        </div>
      </div>

      {/* ADI response block */}
      {(adiText || adiLoading) && (
        <div style={{ marginBottom:14, background:C.surfaceAlt, border:`1px solid ${C.indigo}25`, borderRadius:8, padding:"13px 15px", borderLeft:`3px solid ${C.indigo}` }}>
          <div style={{ display:"flex", alignItems:"center", gap:7, marginBottom:10 }}>
            <div style={{ width:18, height:18, borderRadius:5, background:"linear-gradient(135deg,#00c2e8,#0e7fa8)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:9, fontWeight:900, color:"#fff", flexShrink:0 }}>A</div>
            <span style={{ fontSize:10, fontWeight:700, color:"#00a8e8" }}>ADI</span>
            <span style={{ fontSize:9.5, color:tx3 }}>— Análisis de clientes</span>
          </div>
          {adiLoading && !adiText && (
            <div style={{ display:"flex", flexDirection:"column", gap:7 }}>
              {[70,55,80,50].map((w,i)=>(
                <div key={i} style={{ height:7, width:`${w}%`, background:C.border, borderRadius:3, opacity:0.5, animation:`pulse 1.4s ${i*0.1}s infinite` }}/>
              ))}
            </div>
          )}
          {adiBlocks.length > 0 && (
            <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
              {adiBlocks.map((b,i) => (
                <div key={i} style={{ borderLeft:`2px solid ${blockColors[i%blockColors.length]}`, paddingLeft:10 }}>
                  {b.title && <p style={{ fontSize:8.5, fontWeight:800, color:blockColors[i%blockColors.length], textTransform:"uppercase", letterSpacing:"0.8px", marginBottom:3 }}>{b.title}</p>}
                  <p style={{ fontSize:11, color:tx2, lineHeight:1.65 }}>
                    {b.body}
                    {adiLoading && i===adiBlocks.length-1 && <span style={{ display:"inline-block", width:5, height:10, background:C.indigo, borderRadius:2, animation:"blink 0.8s infinite", marginLeft:2 }}/>}
                  </p>
                </div>
              ))}
              {!adiLoading && adiDone && (
                <button onClick={handleExplicar} style={{ alignSelf:"flex-start", fontSize:9.5, color:tx3, background:"transparent", border:`1px solid ${C.border}`, borderRadius:4, padding:"3px 9px", cursor:"pointer", marginTop:2 }}>↻ Regenerar</button>
              )}
            </div>
          )}
          {adiLoading && adiText && adiBlocks.length === 0 && (
            <p style={{ fontSize:11, color:tx2, lineHeight:1.65 }}>{adiText}<span style={{ display:"inline-block", width:5, height:10, background:C.indigo, borderRadius:2, animation:"blink 0.8s infinite", marginLeft:2 }}/></p>
          )}
        </div>
      )}


      <div style={{ overflowX:"auto" }}>
        {/* ══ MODO VENTAS: performance + participación ══ */}
        {modo === "ventas" && (
          <table style={{ width:"100%", minWidth:hasBudget?580:480, borderCollapse:"collapse", fontSize:11 }}>
            <thead>
              <tr style={{ borderBottom:`1px solid ${C.border}` }}>
                <th style={{ ...thB, color:tx3, width:28 }}>#</th>
                <th style={{ ...thB, color:txH }}>Cliente</th>
                <th style={{ ...thB, color:C.blue }}>Ventas Actuales</th>
                <th style={{ ...thB, color:tx2 }}>% vs Año Ant.</th>
                {hasBudget && <th style={{ ...thB, color:C.amber }}>% GAP vs Presup.</th>}
                <th style={{ ...thB, color:tx2 }}>% Participación</th>
              </tr>
            </thead>
            <tbody>
              {top10.map((r,i) => {
                const vsAnt      = +((r.actual-r.anterior)/r.anterior*100).toFixed(1);
                const pctPart    = +((r.actual/totalActual)*100).toFixed(1);
                const hasPres    = r.presupuesto != null;
                const gapPresPct = hasPres ? +((r.actual-r.presupuesto)/r.presupuesto*100).toFixed(1) : null;
                const bcVsAnt    = badge(vsAnt);
                const bcGap      = hasPres ? badge(gapPresPct) : null;
                return (
                  <tr key={i} style={{ borderBottom:`1px solid ${C.border}` }}
                    onMouseEnter={e=>e.currentTarget.style.background=C.surfaceAlt}
                    onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                    <td style={{ padding:"8px 10px", color:tx3, fontSize:10 }}>{i+1}</td>
                    <td style={{ padding:"8px 10px", fontWeight:700, color:tx1, whiteSpace:"nowrap" }}>{r.nombre}</td>
                    {/* Ventas + sparkline */}
                    <td style={{ padding:"8px 10px" }}>
                      <span style={{ fontWeight:700, color:C.blue }}>${r.actual.toLocaleString()}K</span>
                      <div style={{ height:2, background:C.border, borderRadius:2, marginTop:3, width:52 }}>
                        <div style={{ height:"100%", width:`${(r.actual/top10[0].actual)*100}%`, background:C.blue, borderRadius:2, opacity:0.6 }}/>
                      </div>
                    </td>
                    {/* % vs año anterior */}
                    <td style={{ padding:"8px 10px" }}>
                      <span style={{ padding:"2px 7px", borderRadius:4, fontSize:10, fontWeight:700, background:bcVsAnt.bg, color:bcVsAnt.color }}>
                        {vsAnt>0?"+":""}{vsAnt}%
                      </span>
                    </td>
                    {/* % GAP vs presupuesto */}
                    {hasBudget && (
                      <td style={{ padding:"8px 10px" }}>
                        {hasPres ? (
                          <span style={{ padding:"2px 7px", borderRadius:4, fontSize:10, fontWeight:700, background:bcGap.bg, color:bcGap.color }}>
                            {gapPresPct>0?"+":""}{gapPresPct}%
                          </span>
                        ) : <span style={{ color:tx3, fontStyle:"italic" }}>—</span>}
                      </td>
                    )}
                    {/* % Participación + mini barra */}
                    <td style={{ padding:"8px 10px" }}>
                      <div style={{ display:"flex", alignItems:"center", gap:7 }}>
                        <span style={{ fontWeight:600, color:tx2 }}>{pctPart}%</span>
                        <div style={{ height:4, width:40, background:C.border, borderRadius:2, flexShrink:0 }}>
                          <div style={{ height:"100%", width:`${Math.min(100,pctPart*2.2)}%`, background:accentColor, borderRadius:2, opacity:0.7 }}/>
                        </div>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr style={{ borderTop:`1px solid ${C.borderLight}` }}>
                <td colSpan={2} style={{ padding:"8px 10px", fontSize:10, color:tx3, fontStyle:"italic" }}>Total período</td>
                <td style={{ padding:"8px 10px", fontWeight:800, color:C.blue, fontSize:11 }}>${totalActual.toLocaleString()}K</td>
                <td style={{ padding:"8px 10px" }}>
                  {(()=>{ const v=+((totalActual-totalAnterior)/totalAnterior*100).toFixed(1); const b=badge(v); return <span style={{ padding:"2px 7px", borderRadius:4, fontSize:10, fontWeight:700, background:b.bg, color:b.color }}>{v>0?"+":""}{v}%</span>; })()}
                </td>
                {hasBudget && (
                  <td style={{ padding:"8px 10px" }}>
                    {(()=>{ const v=+((totalActual-totalPresupuesto)/totalPresupuesto*100).toFixed(1); const b=badge(v); return <span style={{ padding:"2px 7px", borderRadius:4, fontSize:10, fontWeight:700, background:b.bg, color:b.color }}>{v>0?"+":""}{v}%</span>; })()}
                  </td>
                )}
                <td style={{ padding:"8px 10px", fontWeight:700, color:accentColor }}>100%</td>
              </tr>
            </tfoot>
          </table>
        )}

        {/* ══ MODO ANTERIOR: niveles absolutos ══ */}
        {modo === "anterior" && (
          <table style={{ width:"100%", minWidth:hasBudget?520:400, borderCollapse:"collapse", fontSize:11 }}>
            <thead>
              <tr style={{ borderBottom:`1px solid ${C.border}` }}>
                <th style={{ ...thB, color:tx3, width:28 }}>#</th>
                <th style={{ ...thB, color:txH }}>Cliente</th>
                <th style={{ ...thB, color:C.blue }}>Ventas Actuales</th>
                <th style={{ ...thB, color:C.indigo }}>Año Anterior</th>
                {hasBudget && <th style={{ ...thB, color:C.amber }}>Presupuesto ($)</th>}
              </tr>
            </thead>
            <tbody>
              {top10.map((r,i) => {
                const hasPres = r.presupuesto != null;
                return (
                  <tr key={i} style={{ borderBottom:`1px solid ${C.border}` }}
                    onMouseEnter={e=>e.currentTarget.style.background=C.surfaceAlt}
                    onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                    <td style={{ padding:"8px 10px", color:tx3, fontSize:10 }}>{i+1}</td>
                    <td style={{ padding:"8px 10px", fontWeight:700, color:tx1, whiteSpace:"nowrap" }}>{r.nombre}</td>
                    {/* Ventas actuales + sparkline */}
                    <td style={{ padding:"8px 10px" }}>
                      <span style={{ fontWeight:700, color:C.blue }}>${r.actual.toLocaleString()}K</span>
                      <div style={{ height:2, background:C.border, borderRadius:2, marginTop:3, width:52 }}>
                        <div style={{ height:"100%", width:`${(r.actual/top10[0].actual)*100}%`, background:C.blue, borderRadius:2, opacity:0.6 }}/>
                      </div>
                    </td>
                    {/* Año anterior */}
                    <td style={{ padding:"8px 10px" }}>
                      <span style={{ fontWeight:600, color:C.indigo }}>${r.anterior.toLocaleString()}K</span>
                      <div style={{ height:2, background:C.border, borderRadius:2, marginTop:3, width:52 }}>
                        <div style={{ height:"100%", width:`${(r.anterior/top10[0].actual)*100}%`, background:C.indigo, borderRadius:2, opacity:0.5 }}/>
                      </div>
                    </td>
                    {/* Presupuesto */}
                    {hasBudget && (
                      <td style={{ padding:"8px 10px" }}>
                        {hasPres
                          ? <span style={{ fontWeight:600, color:C.amber }}>${r.presupuesto.toLocaleString()}K</span>
                          : <span style={{ color:tx3, fontStyle:"italic" }}>—</span>}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr style={{ borderTop:`1px solid ${C.borderLight}` }}>
                <td colSpan={2} style={{ padding:"8px 10px", fontSize:10, color:tx3, fontStyle:"italic" }}>Total período</td>
                <td style={{ padding:"8px 10px", fontWeight:800, color:C.blue, fontSize:11 }}>${totalActual.toLocaleString()}K</td>
                <td style={{ padding:"8px 10px", fontWeight:700, color:C.indigo, fontSize:11 }}>${totalAnterior.toLocaleString()}K</td>
                {hasBudget && (
                  <td style={{ padding:"8px 10px", fontWeight:700, color:C.amber, fontSize:11 }}>${totalPresupuesto.toLocaleString()}K</td>
                )}
              </tr>
            </tfoot>
          </table>
        )}
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// MÓDULO VENTAS v7
// Orden: 1.KPIs 2.Evolución negocio 3.Pareto+selector 4.Tabla80%
//        5.Tabla general+selector 6.Gráfico dinámico
// paretoDim y tableDim COMPLETAMENTE INDEPENDIENTES
// Tabla general: clic en fila → SOLO activa gráfico (sin subtabla)
// ════════════════════════════════════════════════════════════════════════════
const DIM_OPTS_TABLA_VENTAS = [["cliente","Cliente"],["marca","Marca"],["sfamilia","Familia"]];

function TablaGeneralVentasCard({ tableSource, totalVenta, tableSortCol, setTableSort, tableSel, handleTableSel, metrica, setMetrica, tableDim, handleTableDim, paretoDim }) {
  return (
    <Card>
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:10 }}>
        <div>
          <p style={{ fontWeight:700, fontSize:12 }}>
            Detalle de ventas —{" "}
            {tableDim==="cliente"?"Clientes":tableDim==="marca"?"Marcas":"Superfamilias"}
            {tableSel.size > 0 && (
              <span style={{ fontSize:10, color:C.cyan, fontWeight:400, marginLeft:8 }}>
                · <span style={{ fontWeight:700 }}>{tableSel.size} seleccionado{tableSel.size>1?"s":""}</span>
                {" — reflejado en gráfico"}
              </span>
            )}
          </p>
          <p style={{ fontSize:10, color:C.textSub }}>
            Clic en fila o ✓ para seleccionar · selección múltiple · gráfico se actualiza en tiempo real
            {paretoDim!==tableDim && (
              <span style={{ color:C.amber, marginLeft:8 }}>· Selector independiente del Pareto</span>
            )}
          </p>
        </div>
        <SelectorDimension dim={tableDim} onChange={handleTableDim} opciones={DIM_OPTS_TABLA_VENTAS} color={C.cyan}/>
      </div>
      <TablaGeneralVentas
        tableData={tableSource}    totalVenta={totalVenta}
        sortCol={tableSortCol}     setSortCol={setTableSort}
        tableSel={tableSel}        onTableSel={handleTableSel}
        metrica={metrica}          onMetrica={setMetrica}
        tableDim={tableDim}
      />
      <p style={{ fontSize:9.5, color:C.textMuted, marginTop:8 }}>
        * Clic en fila o ✓ → seleccionar · múltiple selección disponible · el gráfico sigue al último seleccionado
      </p>
    </Card>
  );
}

function ModuloVentas({ filtro, filtros }) {
  // ── Estado Pareto (independiente) — incluye SKU
  const [paretoDim,         setParetoDim]        = useState("cliente");
  const [paretoDrillNombre, setParetoDrillNombre] = useState(null);

  // ── Estado Tabla General (independiente) — sin SKU, multi-selección
  const [tableDim,    setTableDim]   = useState("cliente");
  const [tableSortCol,setTableSort]  = useState("actual");
  const [tableSel,    setTableSel]   = useState(new Set());  // Set de nombres seleccionados
  const [tableLastSel,setTableLastSel] = useState(null);     // último seleccionado → gráfico
  const [metrica,     setMetrica]    = useState("actual");

  // ── Estado detalle KPI: null | "ventas" | "anterior"
  const [kpiDrillOpen, setKpiDrillOpen] = useState(null);
  const handleKpiClick = (key) => setKpiDrillOpen(prev => prev===key ? null : key);

  // ── Índice de mes seleccionado (-1 = Anual)
  const mesIdx = filtro && filtro !== "Anual" ? MESES_IDX[filtro] ?? -1 : -1;

  // ── Derived — filtrar y escalar por filtros globales y período
  const filterAndScale = (rows) => {
    const filtered = applyFiltros(rows, filtros);
    return mesIdx >= 0 ? filtered.map(r => scaleRowToMes(r, mesIdx)) : filtered;
  };

  const getRawFiltered = (dim) => {
    if (dim === "cliente")  return filterAndScale(clientesVentas);
    if (dim === "marca")    return filterAndScale(marcasVentas);
    return filterAndScale(sfamiliasVentas);
  };

  const paretoData  = (() => {
    const raw = paretoDim === "sku"
      ? filterAndScale(todosLosSKUs)
      : getRawFiltered(paretoDim);
    const sorted = [...raw].sort((a,b)=>b.actual-a.actual);
    const total  = sorted.reduce((s,d)=>s+d.actual,0);
    let acum=0;
    return sorted.map(d=>{ acum+=d.actual; return { ...d, pctAcum:+((acum/total)*100).toFixed(1), pctPart:+((d.actual/total)*100).toFixed(1) }; });
  })();

  const tableSource = getRawFiltered(tableDim);
  const totalVenta  = tableSource.reduce((s,r)=>s+r.actual,0);

  // KPIs escalados
  const kpi = getVentasKPI(filtro, filtros);

  const DIM_OPTS_PARETO = [["cliente","Cliente"],["marca","Marca"],["sfamilia","Familia"],["sku","SKU"]];
  const DIM_OPTS_TABLA  = [["cliente","Cliente"],["marca","Marca"],["sfamilia","Familia"]];

  const handleParetoDim = (d) => { setParetoDim(d); setParetoDrillNombre(null); };
  const handleTableDim  = (d) => { setTableDim(d); setTableSel(new Set()); setTableLastSel(null); setMetrica("actual"); setTableSort("actual"); };

  // Multi-selección: recibe el nuevo Set completo + el último nombre tocado
  const handleTableSel = (nextSet, lastName, mk) => {
    setTableSel(nextSet);
    if (lastName !== undefined) {
      // Si se deseleccionó el último, limpiar gráfico; si se seleccionó, actualizar
      setTableLastSel(nextSet.has(lastName) ? lastName : (nextSet.size > 0 ? [...nextSet][nextSet.size-1] : null));
    }
    if (mk) setMetrica(mk);
  };

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:14 }}>

      {/* ① KPIs */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:12 }}>
        <KpiCard label="Ventas Actuales"    value={fmtUSD(kpi.totalActual*1000)}   sub="Clic para ver Top 10 clientes" color={C.blue}   helpId="ventas_actuales" onClick={()=>handleKpiClick("ventas")}   active={kpiDrillOpen==="ventas"}/>
        <KpiCard label="Año Anterior"       value={fmtUSD(kpi.totalAnterior*1000)} sub="Clic para ver Top 10 clientes" color={C.indigo} helpId="ano_anterior"     onClick={()=>handleKpiClick("anterior")} active={kpiDrillOpen==="anterior"}/>
        <KpiCard label="vs Año Anterior"    value={`${kpi.vsAnterior>0?"+":""}${kpi.vsAnterior}%`}  sub={`${kpi.vsAnterior>0?"+":""}$${Math.abs(Math.round((kpi.totalActual-kpi.totalAnterior)*1000/1000))}K`} color={C.green}  helpId="vs_anterior"/>
        <KpiCard label="GAP vs Presupuesto" value={`${kpi.vsPresupuesto>0?"+":""}${kpi.vsPresupuesto}%`} sub={kpi.vsPresupuesto>=0?"Sobre target":"Bajo target"} color={C.amber}  helpId="gap_presupuesto"/>
      </div>

      {/* ① Detalle Top 10 clientes — se despliega al hacer clic en KPI */}
      {kpiDrillOpen && (
        <TablaTop10Clientes modo={kpiDrillOpen} onClose={()=>setKpiDrillOpen(null)}/>
      )}

      {/* ② Gráfico evolución negocio — FIJO, negocio completo */}
      <Card title="Evolución del Negocio" subtitle={mesIdx>=0?`Mes seleccionado: ${filtro} — comparado con año anterior y presupuesto`:"Ventas actuales vs año anterior vs presupuesto ($K)"}>
        <div style={{ display:"flex", gap:16, marginBottom:10, alignItems:"center" }}>
          {[[C.blue,"Actual"],["#2a3a52","Año Anterior"],[C.amber,"Presupuesto"]].map(([c,l])=>(
            <span key={l} style={{ display:"flex", alignItems:"center", gap:5, fontSize:10, color:C.textSub }}>
              <span style={{ width:20, height:2, background:c, display:"inline-block", borderRadius:2 }}/>{l}
            </span>
          ))}
          {mesIdx>=0 && <span style={{ fontSize:9.5, color:C.cyan, marginLeft:"auto", fontWeight:600 }}>· Barra resalta {filtro}</span>}
        </div>
        <AnimatedChart triggerKey={filtro} height={172} color={C.blue}>
          <ResponsiveContainer width="100%" height={172}>
            <ComposedChart data={ventasMensuales} margin={{ top:4, right:8, bottom:0, left:-10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={C.border}/>
              <XAxis dataKey="mes" tick={{ fontSize:9, fill:C.textSub }} axisLine={false} tickLine={false}/>
              <YAxis tick={{ fontSize:9, fill:C.textSub }} axisLine={false} tickLine={false} tickFormatter={v=>`$${v/1000}M`}/>
              <Tooltip content={<ChartTooltip/>}/>
              <Bar dataKey="actual" name="Actual" fill={C.blue} opacity={0.15} radius={[2,2,0,0]}>
                {ventasMensuales.map((m,i)=>(
                  <Cell key={i} fill={mesIdx>=0&&i===mesIdx?C.cyan:C.blue} opacity={mesIdx>=0?(i===mesIdx?0.35:0.08):0}/>
                ))}
              </Bar>
              <Line type="monotone" dataKey="anterior"    name="Año Anterior" stroke="#2a3a52" strokeWidth={1.5} dot={false} strokeDasharray="4 4"/>
              <Line type="monotone" dataKey="presupuesto" name="Presupuesto"  stroke={C.amber} strokeWidth={1.5} dot={false} strokeDasharray="6 3"/>
              <Line type="monotone" dataKey="actual"      name="Actual"       stroke={C.blue}  strokeWidth={2.5}
                dot={(props)=>{
                  const { cx,cy,index } = props;
                  if (mesIdx>=0 && index===mesIdx) return <circle key={index} cx={cx} cy={cy} r={5} fill={C.cyan} stroke="#fff" strokeWidth={1.5}/>;
                  return <circle key={index} cx={cx} cy={cy} r={3} fill={C.blue}/>;
                }}
                activeDot={{ r:5 }}/>
              {mesIdx>=0 && (
                <ReferenceLine x={ventasMensuales[mesIdx].mes} stroke={C.cyan} strokeDasharray="3 3" strokeOpacity={0.6}
                  label={{ value:filtro, fill:C.cyan, fontSize:9, position:"insideTopRight" }}/>
              )}
            </ComposedChart>
          </ResponsiveContainer>
        </AnimatedChart>
      </Card>

      {/* ③ Pareto — dimensión conducida por filtros globales */}
      <Card>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:10 }}>
          <div>
            <p style={{ fontWeight:700, fontSize:12, display:"inline-flex", alignItems:"center" }}>
              Concentración de ventas<InfoTip id="pareto_ventas" style={{ marginLeft:4 }}/>
            </p>
            <p style={{ fontSize:10, color:C.textSub }}>
              Concentración por ventas ($) · barras azules = bloque 80%
              · dimensión: <span style={{ color:C.blue, fontWeight:600 }}>
                {paretoDim==="cliente"?"Clientes":paretoDim==="marca"?"Marcas":paretoDim==="sfamilia"?"Familias":"SKUs"}
              </span>
            </p>
          </div>
          <SelectorDimension dim={paretoDim} onChange={handleParetoDim} opciones={DIM_OPTS_PARETO} color={C.blue}/>
        </div>
        <ParetoVentas paretoData={paretoData} paretoDrillNombre={paretoDrillNombre} triggerKey={paretoDim}/>
      </Card>

      {/* ④ Tabla bloque 80% */}
      <BloquePareto80Card
        paretoData={paretoData}
        paretoDim={paretoDim}
        paretoDrillNombre={paretoDrillNombre}
        onDrillSelect={paretoDim!=="sku" ? setParetoDrillNombre : ()=>{}}
      />

      {/* Drill del Pareto (no aparece si dim=sku) */}
      {paretoDrillNombre && paretoDim!=="sku" && (
        <DrillPareto
          nombre={paretoDrillNombre}
          paretoDim={paretoDim}
          onClose={()=>setParetoDrillNombre(null)}
        />
      )}

      {/* ⑤ Tabla General + selector independiente (sin SKU) */}
      <TablaGeneralVentasCard
        tableSource={tableSource}   totalVenta={totalVenta}
        tableSortCol={tableSortCol} setTableSort={setTableSort}
        tableSel={tableSel}         handleTableSel={handleTableSel}
        metrica={metrica}           setMetrica={setMetrica}
        tableDim={tableDim}         handleTableDim={handleTableDim}
        paretoDim={paretoDim}
      />

      {/* ⑥ Gráfico dinámico — muestra todos los elementos seleccionados */}
      {tableSel.size > 0 && (
        <GraficoDinamicoVentas
          nombres={[...tableSel]}
          metrica={metrica}
          onClose={()=>{ setTableSel(new Set()); setTableLastSel(null); }}
        />
      )}

    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// PARETO CONTRIBUCIÓN — base: contribución ($), ordenado desc
// ════════════════════════════════════════════════════════════════════════════
function buildParetoContribData(dim, filterFn) {
  const rawAll = dim==="cliente"?clientesMargen:dim==="sfamilia"?sfamiliasMargen:dim==="marca"?marcasMargen:skusMargen;
  const raw = filterFn ? filterFn(rawAll) : rawAll;
  const sorted = [...raw].sort((a,b)=>b.contribucion-a.contribucion);
  const total  = sorted.reduce((s,d)=>s+d.contribucion,0);
  let acum=0;
  return sorted.map(d=>{
    acum+=d.contribucion;
    return { ...d, pctAcum:+((acum/total)*100).toFixed(1), pctPart:+((d.contribucion/total)*100).toFixed(1) };
  });
}

function ParetoContribucion({ paretoContribData, paretoDrillNombreMargen, triggerKey }) {
  const wrapRef = useAnimatedPareto(triggerKey + "_" + paretoContribData.length + "_" + (paretoContribData[0]?.contribucion||0));
  const uid = "pcg";
  return (
    <div ref={wrapRef} style={{ position:"relative", width:"100%", height:185 }}>
      {/* Scan line premium */}
      <div style={{
        position:"absolute", inset:0, pointerEvents:"none", overflow:"hidden", borderRadius:8, zIndex:5,
      }}>
        <div className="pareto-scan" style={{
          position:"absolute", top:0, left:"-50%", width:"50%", height:"100%",
          background:"linear-gradient(90deg,transparent,rgba(0,194,232,0.07),rgba(0,194,232,0.12),rgba(0,194,232,0.07),transparent)",
        }}/>
      </div>
      <ResponsiveContainer width="100%" height={185}>
        <ComposedChart data={paretoContribData} margin={{ top:8, right:36, bottom:0, left:-10 }}>
          <defs>
            <linearGradient id={`${uid}-bar-active`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={C.cyan} stopOpacity={1}/>
              <stop offset="100%" stopColor={C.blue} stopOpacity={0.5}/>
            </linearGradient>
            <linearGradient id={`${uid}-bar-muted`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#555" stopOpacity={0.7}/>
              <stop offset="100%" stopColor="#333" stopOpacity={0.3}/>
            </linearGradient>
            <linearGradient id={`${uid}-bar-drill`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={C.blue} stopOpacity={1}/>
              <stop offset="100%" stopColor={C.indigo} stopOpacity={0.6}/>
            </linearGradient>
            <linearGradient id={`${uid}-area`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#D4A847" stopOpacity={0.15}/>
              <stop offset="100%" stopColor="#D4A847" stopOpacity={0}/>
            </linearGradient>
            <filter id={`${uid}-glow`} x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="3" result="blur"/>
              <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
            </filter>
          </defs>
          <CartesianGrid strokeDasharray="2 6" stroke={C.border} vertical={false} strokeOpacity={0.6}/>
          <XAxis dataKey="nombre" tick={false} axisLine={false} tickLine={false}/>
          <YAxis yAxisId="c" tick={{ fontSize:9, fill:C.textMuted }} axisLine={false} tickLine={false} tickFormatter={v=>`$${v/1000}K`}/>
          <YAxis yAxisId="p" orientation="right" tick={{ fontSize:9, fill:C.textMuted }} axisLine={false} tickLine={false} tickFormatter={v=>`${v}%`} domain={[0,100]}/>
          <Tooltip content={({ active, payload, label })=>{
            if (!active||!payload?.length) return null;
            const d=paretoContribData.find(x=>x.nombre===label)||{};
            return (
              <div style={{ background:"#0d0d0d", border:`1px solid ${C.borderLight}`, borderRadius:8, padding:"9px 12px", fontSize:11, boxShadow:`0 8px 24px rgba(0,0,0,0.6)` }}>
                <p style={{ color:C.text, fontWeight:700, marginBottom:4 }}>{label}</p>
                <p style={{ color:C.green }}>Contribución: <strong>${d.contribucion?.toLocaleString()}K</strong></p>
                <p style={{ color:C.blue }}>Margen: <strong>{d.margen}%</strong></p>
                <p style={{ color:C.textSub }}>% Participación: <strong>{d.pctPart}%</strong></p>
                <p style={{ color:"#D4A847" }}>% Acum.: <strong>{d.pctAcum}%</strong></p>
              </div>
            );
          }}/>
          <Area yAxisId="p" type="monotone" dataKey="pctAcum" fill={`url(#${uid}-area)`} stroke="none"/>
          <Bar yAxisId="c" dataKey="contribucion" name="Contribución" radius={[4,4,0,0]} maxBarSize={28}>
            {paretoContribData.map((d,i)=>(
              <Cell key={i}
                fill={paretoDrillNombreMargen===d.nombre
                  ? `url(#${uid}-bar-drill)`
                  : d.pctAcum<=80
                    ? `url(#${uid}-bar-active)`
                    : `url(#${uid}-bar-muted)`}
              />
            ))}
          </Bar>
          <Line yAxisId="p" type="monotone" dataKey="pctAcum" name="% Acumulado"
            stroke="#D4A847" strokeWidth={2.5}
            filter={`url(#${uid}-glow)`}
            dot={(props) => {
              const { cx, cy, index } = props;
              const isLast = index === paretoContribData.length - 1;
              return (
                <circle key={index} cx={cx} cy={cy}
                  r={isLast ? 5 : 3}
                  fill="#D4A847"
                  stroke={isLast ? "#fff" : "none"}
                  strokeWidth={isLast ? 1.5 : 0}
                  style={isLast ? { filter:"drop-shadow(0 0 4px rgba(212,168,71,0.8))" } : {}}
                />
              );
            }}
            activeDot={{ r:5, fill:"#D4A847", stroke:"#fff", strokeWidth:1.5 }}
            unit="%"
          />
          <ReferenceLine yAxisId="p" y={80} stroke="#D4A847" strokeDasharray="4 3" strokeOpacity={0.5}
            label={{ value:"80%", fill:"#D4A847", fontSize:9, position:"insideTopRight" }}/>
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

// Wrapper card para Bloque 80% Contribución — con botón ADI inline
function BloquePareto80MargenCard({ paretoContribData, paretoDrillNombreMargen, paretoDimMargen, onDrillSelect }) {
  const [adiText,    setAdiText]    = useState("");
  const [adiLoading, setAdiLoading] = useState(false);
  const [adiDone,    setAdiDone]    = useState(false);

  const bloque   = paretoContribData.filter(d=>d.pctAcum<=80);
  const items    = bloque.length ? bloque : paretoContribData.slice(0,1);
  const dimLabel = paretoDimMargen==="cliente"?"Clientes":paretoDimMargen==="sfamilia"?"Familias":paretoDimMargen==="marca"?"Marcas":"SKUs";
  const blockColors = [C.green, C.cyan, C.indigo, C.amber];

  const streamApi = async (messages, onChunk) => {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method:"POST", headers:{ "Content-Type":"application/json" },
      body:JSON.stringify({ model:"claude-sonnet-4-20250514", max_tokens:1000, stream:true, messages })
    });
    const reader = res.body.getReader(); const dec = new TextDecoder(); let full = "";
    while(true) {
      const { done, value } = await reader.read(); if(done) break;
      const chunk = dec.decode(value,{stream:true});
      for(const line of chunk.split("\n").filter(l=>l.startsWith("data:"))) {
        const json = line.replace("data: ","").trim(); if(json==="[DONE]") continue;
        try { const d=JSON.parse(json); if(d?.delta?.text){ full+=d.delta.text; onChunk(full); } } catch{}
      }
    }
    return full;
  };

  const handleExplicar = async () => {
    if (adiLoading) return;
    setAdiLoading(true); setAdiText(""); setAdiDone(false);

    const totalBloque   = items.reduce((s,r)=>s+r.contribucion,0);
    const totalGral     = paretoContribData.reduce((s,r)=>s+r.contribucion,0);
    const universo      = paretoContribData.length;
    const pctElementos  = +((items.length / universo) * 100).toFixed(0);
    const concLabel     = pctElementos > 60 ? "diversificado" : pctElementos >= 50 ? "intermedio" : "concentrado / riesgo";
    const benchmark     = 30.1;
    const margenProm    = items.some(r=>r.margen!=null)
      ? +((items.reduce((s,r)=>s+(r.margen||0)*(r.contribucion||0),0)/totalBloque)).toFixed(1)
      : null;
    const bajo          = items.filter(r => r.margen != null && r.margen < benchmark);
    const sobre         = items.filter(r => r.margen != null && r.margen >= benchmark);

    const listaCtx = items.map((r,i) => {
      const diffBench = r.margen != null ? ` · margen ${r.margen}% (${+(r.margen-benchmark).toFixed(1)}pp vs benchmark)` : "";
      const rebate    = r.pctRebate != null ? ` · rebate ${r.pctRebate}%` : "";
      return `${i+1}. ${r.nombre}: $${r.contribucion.toLocaleString()}K · ${r.pctPart}% participación · ${r.pctAcum}% acumulado${diffBench}${rebate}`;
    }).join("\n");

    const prompt = `Actúa como ADI, un controller senior que interpreta el negocio desde los datos visibles.
Estás analizando el bloque Pareto de contribución al margen — dimensión: ${dimLabel}.
Basate EXCLUSIVAMENTE en los datos visibles. No uses información de otros módulos. No inventes causas.

DATOS DEL BLOQUE:
Universo total: ${universo} ${dimLabel} | Bloque 80%: ${items.length} ${dimLabel} (${pctElementos}% del universo) → ${concLabel}
${margenProm!=null?`Margen promedio del bloque: ${margenProm}% | Benchmark: ${benchmark}%`:""}
${sobre.length>0?`Sobre benchmark (${sobre.length}): ${sobre.map(r=>r.nombre).join(", ")}`:""}
${bajo.length>0?`Bajo benchmark (${bajo.length}): ${bajo.map(r=>r.nombre).join(", ")}`:""}

DETALLE VISIBLE:
${listaCtx}

CRITERIO DE CONCENTRACIÓN:
- >60% del universo explica el 80% → diversificado
- 50%–60% → intermedio
- <50% → concentrado / riesgo

REGLAS DE ANÁLISIS:
- Rebate > 3% se considera alto
- Comparar siempre margen % vs benchmark ${benchmark}% donde esté disponible
- Diferenciar margen % (calidad) vs contribución $ (impacto)
- Cada número debe acompañarse del elemento al que pertenece
- Integrar datos dentro de frases, no listar sueltos
- Prohibido: "probablemente", "podría deberse a", "quizás"

ESTILO DE REFERENCIA:
Resumen: "${items.length} ${dimLabel} explican el 80% de la contribución, lo que representa el ${pctElementos}% del universo — ${concLabel}."
Evidencia: nombrar elementos con margen, rebate y participación integrados en la frase.
Lectura: conectar rebate, margen y contribución. Usar "refleja", "indica", "muestra".
Foco: cada acción en formato "[Elemento] → acción concreta".

ESTRUCTURA OBLIGATORIA — 4 bloques separados por línea vacía, título en mayúsculas seguido de dos puntos:

RESUMEN:
Máximo 2 líneas. Cuántos elementos explican el 80%, si eso es concentración o diversificación, y estado general del margen.

EVIDENCIA:
Máximo 3 líneas. Datos concretos: nombres, margen %, benchmark, rebate %, contribución y participación integrados en frases.

LECTURA DEL NEGOCIO:
Máximo 3 líneas. Interpretar relación entre rebate, margen y contribución. Quién sostiene y quién erosiona. No repetir la tabla.

SIGUIENTE FOCO:
2–3 acciones. Formato: "[Elemento] → acción concreta". Nombre del elemento siempre primero.`;

    try {
      await streamApi([{ role:"user", content:prompt }], t => setAdiText(t));
      setAdiDone(true);
    } catch { setAdiText("Error al conectar con ADI."); setAdiDone(true); }
    setAdiLoading(false);
  };

  const adiBlocks = adiText ? adiText.split(/\n\n+/).filter(Boolean).map(b => {
    const colon = b.indexOf(":");
    if (colon > 0 && colon < 32 && b.slice(0,colon) === b.slice(0,colon).toUpperCase()) {
      return { title: b.slice(0,colon), body: b.slice(colon+1).trim() };
    }
    return { title: null, body: b };
  }) : [];

  return (
    <Card>
      {/* Header con botón ADI */}
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:10 }}>
        <p style={{ fontWeight:700, fontSize:12 }}>
          Qué compone el 80% del margen
          <span style={{ color:"#00a8e8", fontWeight:400, fontSize:11, marginLeft:6 }}>{dimLabel}</span>
          {paretoDimMargen!=="sku" && (
            <span style={{ fontSize:10, color:C.textSub, fontWeight:400, marginLeft:8 }}>· Clic en fila para ver composición</span>
          )}
        </p>
      </div>

      {/* Respuesta ADI inline */}
      {(adiText || adiLoading) && (
        <div style={{ marginBottom:12, background:C.surfaceAlt, border:`1px solid ${C.green}20`, borderRadius:8, padding:"12px 14px", borderLeft:`3px solid ${C.green}` }}>
          <div style={{ display:"flex", alignItems:"center", gap:7, marginBottom:9 }}>
            <div style={{ width:18, height:18, borderRadius:5, background:"linear-gradient(135deg,#00c2e8,#0e7fa8)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:9, fontWeight:900, color:"#fff", flexShrink:0 }}>A</div>
            <span style={{ fontSize:10, fontWeight:700, color:"#00a8e8" }}>ADI</span>
            <span style={{ fontSize:9.5, color:C.textMuted }}>— Concentración de margen</span>
          </div>
          {adiLoading && !adiText && (
            <div style={{ display:"flex", flexDirection:"column", gap:7 }}>
              {[68,52,78,48].map((w,i)=>(
                <div key={i} style={{ height:7, width:`${w}%`, background:C.border, borderRadius:3, opacity:0.5, animation:`pulse 1.4s ${i*0.1}s infinite` }}/>
              ))}
            </div>
          )}
          {adiBlocks.length > 0 && (
            <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
              {adiBlocks.map((b,i) => (
                <div key={i} style={{ borderLeft:`2px solid ${blockColors[i%blockColors.length]}`, paddingLeft:10 }}>
                  {b.title && <p style={{ fontSize:8.5, fontWeight:800, color:blockColors[i%blockColors.length], textTransform:"uppercase", letterSpacing:"0.8px", marginBottom:3 }}>{b.title}</p>}
                  <p style={{ fontSize:11, color:"#c0c0c0", lineHeight:1.65 }}>
                    {b.body}
                    {adiLoading && i===adiBlocks.length-1 && <span style={{ display:"inline-block", width:5, height:10, background:C.green, borderRadius:2, animation:"blink 0.8s infinite", marginLeft:2 }}/>}
                  </p>
                </div>
              ))}
              {!adiLoading && adiDone && (
                <button onClick={handleExplicar} style={{ alignSelf:"flex-start", fontSize:9.5, color:C.textMuted, background:"transparent", border:`1px solid ${C.border}`, borderRadius:4, padding:"3px 9px", cursor:"pointer", marginTop:2 }}>↻ Regenerar</button>
              )}
            </div>
          )}
          {adiLoading && adiText && adiBlocks.length===0 && (
            <p style={{ fontSize:11, color:"#c0c0c0", lineHeight:1.65 }}>{adiText}<span style={{ display:"inline-block", width:5, height:10, background:C.green, borderRadius:2, animation:"blink 0.8s infinite", marginLeft:2 }}/></p>
          )}
        </div>
      )}

      <TablaBloque80Margen
        paretoContribData={paretoContribData}
        paretoDrillNombreMargen={paretoDrillNombreMargen}
        paretoDimMargen={paretoDimMargen}
        onDrillSelect={onDrillSelect}
      />
    </Card>
  );
}

// Tabla del bloque 80% — contribución
function TablaBloque80Margen({ paretoContribData, paretoDrillNombreMargen, paretoDimMargen, onDrillSelect }) {
  const bloque = paretoContribData.filter(d=>d.pctAcum<=80);
  const items  = bloque.length ? bloque : paretoContribData.slice(0,1);
  return (
    <div>
      <p style={{ fontSize:10, color:C.textSub, marginBottom:8 }}>
        <span style={{ color:"#00a8e8", fontWeight:700 }}>{items.length} elemento{items.length>1?"s":""}</span>
        {" explican el 80% de la contribución"}
        {paretoDimMargen!=="sku" && <span style={{ color:C.textMuted }}> · Clic en fila para ver composición</span>}
      </p>
      <div style={{ overflowX:"auto", width:"100%" }}>
      <table style={{ width:"100%", minWidth:460, borderCollapse:"collapse", fontSize:11 }}>
        <thead>
          <tr style={{ borderBottom:`1px solid ${C.border}` }}>
            {["Rank.","Nombre","Contribución $","Margen %","% Part.","% Acum."].map(h=>(
              <th key={h} style={{ textAlign:"left", padding:"6px 8px", fontSize:9, textTransform:"uppercase", letterSpacing:"0.5px", color:C.textSub, whiteSpace:"nowrap" }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {items.map((r,i)=>{
            const isSel = paretoDrillNombreMargen===r.nombre;
            const noClick = paretoDimMargen==="sku";
            return (
              <tr key={i}
                style={{ borderBottom:`1px solid ${C.border}`, cursor:noClick?"default":"pointer", background:isSel?"rgba(0,168,232,0.05)":"transparent", outline:isSel?`1px solid ${C.blue}30`:undefined }}
                onClick={()=>{ if(!noClick) onDrillSelect(isSel?null:r.nombre); }}
                onMouseEnter={e=>{ if(!isSel&&!noClick) e.currentTarget.style.background=C.surfaceAlt; }}
                onMouseLeave={e=>{ if(!isSel) e.currentTarget.style.background="transparent"; }}>
                <td style={{ padding:"7px 9px" }}>
                  <span style={{ fontSize:10, fontWeight:800, color:"#00a8e8" }}>#{i+1}</span>
                </td>
                <td style={{ padding:"7px 9px", fontWeight:700, color:isSel?"#00a8e8":C.text }}>{r.nombre}</td>
                <td style={{ padding:"7px 9px", fontWeight:700, color:C.green }}>${r.contribucion.toLocaleString()}K</td>
                <td style={{ padding:"7px 9px" }}>
                  <span style={{ fontWeight:700, color:r.margen>=30?C.green:r.margen>=22?C.amber:C.red }}>{r.margen}%</span>
                </td>
                <td style={{ padding:"7px 9px", color:C.textSub }}>{r.pctPart}%</td>
                <td style={{ padding:"7px 9px" }}>
                  <span style={{ padding:"2px 7px", borderRadius:4, fontSize:10, fontWeight:700, background:"rgba(0,168,232,0.1)", color:"#00a8e8" }}>{r.pctAcum}%</span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      </div>
    </div>
  );
}

// Drill del Pareto de Márgenes — composición jerárquica orientada a rentabilidad
function DrillParetoMargen({ nombre, paretoDimMargen, onClose }) {
  // Obtener datos de composición con métricas de margen
  const composicion = (() => {
    // Helper: enriquecer filas con margen calculado
    const enrich = (rows, totalContrib) => rows.map(r=>({
      ...r,
      pctPart: +((r.contribucion/totalContrib)*100).toFixed(1),
    }));

    if (paretoDimMargen==="cliente") {
      // SKUs del cliente con sus datos de margen
      const skusRaw = skusPorCliente[nombre]||[];
      // Buscar contribución por SKU desde skusMargen
      const skusConMargen = skusRaw.map(s=>{
        const mk = skusMargen.find(m=>m.nombre===s.nombre)||{};
        return { nombre:s.nombre, sfamilia:s.sfamilia, marca:s.marca, venta:s.actual, contribucion:mk.contribucion||Math.round(s.actual*0.3), margen:mk.margen||30, unidades:s.unidades };
      }).sort((a,b)=>b.contribucion-a.contribucion);
      // Agregar por Marca
      const marcaMap={};
      skusConMargen.forEach(s=>{ marcaMap[s.marca]=(marcaMap[s.marca]||{nombre:s.marca,venta:0,contribucion:0,unidades:0}); marcaMap[s.marca].venta+=s.venta; marcaMap[s.marca].contribucion+=s.contribucion; marcaMap[s.marca].unidades+=s.unidades; });
      const marcaRows = Object.values(marcaMap).map(r=>({ ...r, margen:+((r.contribucion/r.venta)*100).toFixed(1) })).sort((a,b)=>b.contribucion-a.contribucion);
      // Agregar por Familia
      const famMap={};
      skusConMargen.forEach(s=>{ famMap[s.sfamilia]=(famMap[s.sfamilia]||{nombre:s.sfamilia,venta:0,contribucion:0,unidades:0}); famMap[s.sfamilia].venta+=s.venta; famMap[s.sfamilia].contribucion+=s.contribucion; famMap[s.sfamilia].unidades+=s.unidades; });
      const famRows = Object.values(famMap).map(r=>({ ...r, margen:+((r.contribucion/r.venta)*100).toFixed(1) })).sort((a,b)=>b.contribucion-a.contribucion);
      const totalC = skusConMargen.reduce((s,r)=>s+r.contribucion,0);
      return [
        { label:"Marca",        rows:enrich(marcaRows, totalC) },
        { label:"Superfamilia", rows:enrich(famRows,   totalC) },
        { label:"SKU",          rows:enrich(skusConMargen, totalC) },
      ];
    }
    if (paretoDimMargen==="marca") {
      const skusRaw = skusPorMarca[nombre]||[];
      const skusConMargen = skusRaw.map(s=>{
        const mk = skusMargen.find(m=>m.nombre===s.nombre)||{};
        return { nombre:s.nombre, sfamilia:s.sfamilia, marca:s.marca, venta:s.actual, contribucion:mk.contribucion||Math.round(s.actual*0.3), margen:mk.margen||30, unidades:s.unidades };
      }).sort((a,b)=>b.contribucion-a.contribucion);
      const famMap={};
      skusConMargen.forEach(s=>{ famMap[s.sfamilia]=(famMap[s.sfamilia]||{nombre:s.sfamilia,venta:0,contribucion:0,unidades:0}); famMap[s.sfamilia].venta+=s.venta; famMap[s.sfamilia].contribucion+=s.contribucion; famMap[s.sfamilia].unidades+=s.unidades; });
      const famRows = Object.values(famMap).map(r=>({ ...r, margen:+((r.contribucion/r.venta)*100).toFixed(1) })).sort((a,b)=>b.contribucion-a.contribucion);
      const totalC = skusConMargen.reduce((s,r)=>s+r.contribucion,0);
      return [
        { label:"Superfamilia", rows:enrich(famRows, totalC) },
        { label:"SKU",          rows:enrich(skusConMargen, totalC) },
      ];
    }
    if (paretoDimMargen==="sfamilia") {
      const skusRaw = skusPorSfamilia[nombre]||[];
      const skusConMargen = skusRaw.map(s=>{
        const mk = skusMargen.find(m=>m.nombre===s.nombre)||{};
        return { nombre:s.nombre, sfamilia:s.sfamilia, marca:s.marca, venta:s.actual, contribucion:mk.contribucion||Math.round(s.actual*0.3), margen:mk.margen||30, unidades:s.unidades };
      }).sort((a,b)=>b.contribucion-a.contribucion);
      const totalC = skusConMargen.reduce((s,r)=>s+r.contribucion,0);
      return [{ label:"SKU", rows:enrich(skusConMargen, totalC) }];
    }
    return []; // sku — sin drill
  })();

  if (!composicion.length) return null;

  const subtitleMap = { cliente:"Marca · Superfamilia · SKU", marca:"Superfamilia · SKU", sfamilia:"SKU" };

  return (
    <Card>
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:12 }}>
        <div>
          <p style={{ fontWeight:700, fontSize:12 }}>
            Composición: <span style={{ color:C.cyan }}>{nombre}</span>
          </p>
          <p style={{ fontSize:10, color:C.textSub }}>{subtitleMap[paretoDimMargen]} · ordenado por contribución</p>
        </div>
        <button onClick={onClose} style={{ background:"transparent", border:`1px solid ${C.border}`, color:C.textSub, borderRadius:5, padding:"3px 9px", fontSize:10, cursor:"pointer" }}>✕</button>
      </div>
      <div style={{ overflowX:"auto", width:"100%" }}>
      <div style={{ display:"grid", gridTemplateColumns:`repeat(${composicion.length},minmax(200px,1fr))`, gap:16, alignItems:"flex-start" }}>
        {composicion.map(grupo=>{
          return (
            <div key={grupo.label}>
              <p style={{ fontSize:9, color:C.textMuted, textTransform:"uppercase", letterSpacing:"0.8px", marginBottom:8, fontWeight:700 }}>{grupo.label}</p>
              <table style={{ width:"100%", borderCollapse:"collapse", fontSize:11 }}>
                <thead>
                  <tr style={{ borderBottom:`1px solid ${C.border}` }}>
                    <th style={{ textAlign:"left", padding:"5px 8px", fontSize:9, color:C.textSub }}>Nombre</th>
                    <th style={{ textAlign:"left", padding:"5px 8px", fontSize:9, color:C.textSub }}>Contrib. $</th>
                    <th style={{ textAlign:"left", padding:"5px 8px", fontSize:9, color:C.textSub }}>Margen %</th>
                    <th style={{ textAlign:"left", padding:"5px 8px", fontSize:9, color:C.textSub }}>% Part.</th>
                  </tr>
                </thead>
                <tbody>
                  {grupo.rows.map((r,i)=>(
                    <tr key={i} style={{ borderBottom:`1px solid ${C.border}` }}
                      onMouseEnter={e=>e.currentTarget.style.background=C.surfaceAlt}
                      onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                      <td style={{ padding:"6px 8px", fontWeight:600, color:C.text, whiteSpace:"nowrap" }}>{r.nombre}</td>
                      <td style={{ padding:"6px 8px", color:C.green, fontWeight:700 }}>${r.contribucion.toLocaleString()}K</td>
                      <td style={{ padding:"6px 8px" }}>
                        <span style={{ fontWeight:700, color:r.margen>=30?C.green:r.margen>=22?C.amber:C.red }}>{r.margen}%</span>
                      </td>
                      <td style={{ padding:"6px 8px", color:C.textSub }}>{r.pctPart}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        })}
      </div>
      </div>
    </Card>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// GRÁFICO DINÁMICO DE ANÁLISIS — responde a fila + columna
// ════════════════════════════════════════════════════════════════════════════
function GraficoDinamico({ nombre, nombres, metrica, onClose }) {
  const nombresArr = nombres && nombres.length > 0 ? nombres : [nombre];
  const isMulti    = nombresArr.length > 1;

  // Campo del historial a graficar según métrica
  const fieldMap = {
    contribucion:"contribucion", venta:"venta", margen:"margen",
    rebates:"rebates", ticket:"ticket", costoMedio:"costoMedio",
    precioPromVenta:"ticket", precioLista:"precioLista",
  };
  const PRICING_METRICAS = ["precioPromVenta","precioLista","costoMedio"];
  const cfgKey = PRICING_METRICAS.includes(metrica) ? "pricing" : (metrica || "contribucion");

  const CFG = {
    contribucion:{ keys:[{k:"contribucion",   name:"Contrib. Actual", color:C.green,   unit:"K", yFmt:v=>`$${v}`},
                         {k:"contribucionAnt",name:"Contrib. Ant.",   color:"#1e4230", unit:"K", yFmt:v=>`$${v}`, dash:"4 4"},
                         {k:"venta",          name:"Venta Actual",   color:C.blue,    unit:"K", yFmt:v=>`$${v}`, dash:"2 2"}], titulo:"Contribución" },
    venta:       { keys:[{k:"venta",          name:"Venta Actual",   color:C.blue,    unit:"K", yFmt:v=>`$${v}`},
                         {k:"ventaAnt",       name:"Venta Ant.",     color:"#2a3a52", unit:"K", yFmt:v=>`$${v}`, dash:"4 4"},
                         {k:"contribucion",   name:"Contrib. Actual",color:C.green,   unit:"K", yFmt:v=>`$${v}`, dash:"2 2"}], titulo:"Ventas" },
    margen:      { keys:[{k:"margen",         name:"Margen % Actual",color:C.blue,    unit:"%",  yFmt:v=>`${v}%`},
                         {k:"margenAnt",      name:"Margen % Ant.",  color:"#2a3a52", unit:"%",  yFmt:v=>`${v}%`, dash:"4 4"}], titulo:"Margen %" },
    rebates:     { keys:[{k:"rebates",        name:"Rebates $",      color:C.red,     unit:"K",  yFmt:v=>`$${v}`}], titulo:"Rebates" },
    ticket:      { keys:[{k:"ticket",         name:"Ticket $",       color:C.cyan,    unit:"K",  yFmt:v=>`$${v}`},
                         {k:"costoMedio",     name:"CMP $",          color:C.amber,   unit:"K",  yFmt:v=>`$${v}`}], titulo:"Ticket vs CMP" },
    pricing:     { keys:[{k:"ticket",         name:"PPV ($)",        color:C.blue,    unit:"$",  yFmt:v=>`$${v}`},
                         {k:"precioLista",    name:"PL ($)",         color:C.indigo,  unit:"$",  yFmt:v=>`$${v}`, dash:"5 3"},
                         {k:"costoMedio",     name:"CMP ($)",        color:C.amber,   unit:"$",  yFmt:v=>`$${v}`, dash:"3 2"}], titulo:"PPV · PL · CMP" },
  };
  const cfg = CFG[cfgKey] || CFG["contribucion"];

  const MESES = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];

  // Multi: fusionar series en un array de puntos por mes
  const multiField = fieldMap[metrica] || "contribucion";
  const chartData = isMulti ? (() => {
    const histMap = {};
    nombresArr.forEach(n => { histMap[n] = getHistorialMargen(n); });
    return MESES.map((mes,i) => {
      const point = { mes };
      nombresArr.forEach(n => { point[n] = histMap[n][i][multiField] ?? histMap[n][i]["contribucion"]; });
      return point;
    });
  })() : getHistorialMargen(nombresArr[0]);

  return (
    <Card>
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:4 }}>
        <div>
          <p style={{ fontSize:9, color:C.textSub, textTransform:"uppercase", letterSpacing:"0.8px" }}>
            Analizando: <span style={{ color:C.blue, fontWeight:700 }}>{cfg.titulo}</span>
            {" — "}
            {isMulti
              ? <span style={{ color:C.text, fontWeight:600 }}>{nombresArr.length} elementos seleccionados</span>
              : <span style={{ color:C.text }}>{nombresArr[0]}</span>
            }
          </p>
          <p style={{ fontSize:10, color:C.textMuted }}>
            Ene–Dic · histórico completo
            {isMulti && <span style={{ color:C.cyan, marginLeft:6 }}>· una línea por elemento</span>}
            {!isMulti && metrica==="contribucion" && <span style={{ color:C.cyan, marginLeft:4 }}>· contrib. actual + ant. + venta actual</span>}
            {!isMulti && PRICING_METRICAS.includes(metrica) && <span style={{ color:C.indigo, marginLeft:4 }}>· comparativa de pricing: PPV · PL · CMP</span>}
          </p>
        </div>
        <button onClick={onClose} style={{ background:"transparent", border:`1px solid ${C.border}`, color:C.textSub, borderRadius:5, padding:"3px 9px", fontSize:10, cursor:"pointer" }}>✕</button>
      </div>

      {/* Leyenda */}
      <div style={{ display:"flex", gap:12, marginBottom:8, flexWrap:"wrap" }}>
        {isMulti
          ? nombresArr.map((n,i) => (
              <span key={n} style={{ display:"flex", alignItems:"center", gap:5, fontSize:10, color:C.textSub }}>
                <span style={{ width:18, height:2.5, background:MULTI_COLORS[i%MULTI_COLORS.length], display:"inline-block", borderRadius:2 }}/>
                {n}
              </span>
            ))
          : cfg.keys.map(k => (
              <span key={k.k} style={{ display:"flex", alignItems:"center", gap:5, fontSize:10, color:C.textSub }}>
                <span style={{ width:18, height:2, background:k.dash?"transparent":k.color, display:"inline-block", borderRadius:2,
                  ...(k.dash?{backgroundImage:`repeating-linear-gradient(90deg,${k.color} 0,${k.color} 4px,transparent 4px,transparent 7px)`}:{}) }}/>
                {k.name}
              </span>
            ))
        }
      </div>

      <AnimatedChart triggerKey={nombresArr.join(",") + "_" + metrica} height={155} color={C.blue}>
        <ResponsiveContainer width="100%" height={155}>
          <LineChart data={chartData} margin={{ top:8, right:8, bottom:0, left:-10 }}>
            <defs>
              <filter id="dmg-glow" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="3" result="blur"/>
                <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
              </filter>
            </defs>
            <CartesianGrid strokeDasharray="2 6" stroke={C.border} strokeOpacity={0.6}/>
            <XAxis dataKey="mes" tick={{ fontSize:9, fill:C.textSub }} axisLine={false} tickLine={false}/>
            <YAxis tick={{ fontSize:9, fill:C.textSub }} axisLine={false} tickLine={false} tickFormatter={isMulti ? (v=>`$${v}`) : cfg.keys[0].yFmt}/>
            <Tooltip content={<ChartTooltip/>}/>
            {isMulti
              ? nombresArr.map((n,i) => (
                  <Line key={n} type="monotone" dataKey={n} name={n}
                    stroke={MULTI_COLORS[i%MULTI_COLORS.length]} strokeWidth={2.5}
                    filter="url(#dmg-glow)"
                    dot={(props)=>{ const {cx,cy,index}=props; const isLast=index===11; return <circle key={index} cx={cx} cy={cy} r={isLast?5:2.5} fill={MULTI_COLORS[i%MULTI_COLORS.length]} stroke={isLast?"#fff":"none"} strokeWidth={isLast?1.5:0}/>; }}
                    activeDot={{ r:5 }}/>
                ))
              : cfg.keys.map((k,i) => (
                  <Line key={k.k} type="monotone" dataKey={k.k} name={k.name}
                    stroke={k.color} strokeWidth={i===0?2.5:1.8}
                    filter={i===0?"url(#dmg-glow)":undefined}
                    dot={i===0?(props)=>{ const {cx,cy,index}=props; const isLast=index===11; return <circle key={index} cx={cx} cy={cy} r={isLast?5:3} fill={k.color} stroke={isLast?"#fff":"none"} strokeWidth={isLast?1.5:0}/>; }:false}
                    activeDot={{ r:5 }} unit={k.unit} strokeDasharray={k.dash||undefined}/>
                ))
            }
          </LineChart>
        </ResponsiveContainer>
      </AnimatedChart>
    </Card>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// TABLA MÁRGENES — foco rentabilidad y pricing
// Orden: ✓ · Dimensión · Ventas · Rebate% · Contribución · Margen% · Margen teórico
//        · GAP margen · PL · PPV · CMP
// Multi-selección con checkbox — gráfico refleja todos los seleccionados
// ════════════════════════════════════════════════════════════════════════════
function TablaMargen({ data, sortCol, setSortCol, seleccionado, onSelectFila, metrica, onSelectMetrica, tableDim }) {
  const sorted = [...data].sort((a,b)=>b[sortCol]-(a[sortCol]||0));
  const METRICAS_COLS = ["venta","contribucion","margen","rebates","costoMedio","precioPromVenta","precioLista"];

  // seleccionado es ahora un Set
  const selSet = seleccionado instanceof Set ? seleccionado : new Set(seleccionado ? [seleccionado] : []);
  const allNames  = sorted.map(r=>r.nombre);
  const allSel    = allNames.length > 0 && allNames.every(n=>selSet.has(n));
  const someSel   = selSet.size > 0 && !allSel;

  const toggleAll = () => onSelectFila(allSel ? new Set() : new Set(allNames));
  const toggleRow = (nombre, mk) => {
    const next = new Set(selSet);
    if (next.has(nombre)) next.delete(nombre); else next.add(nombre);
    onSelectFila(next, nombre, mk);
  };

  const thStyle = (key) => ({
    textAlign:"left", padding:"7px 8px", fontSize:9, textTransform:"uppercase", letterSpacing:"0.5px",
    cursor:"pointer", color:sortCol===key?C.blue:metrica===key?"#00a8e8":C.textSub, whiteSpace:"nowrap", userSelect:"none",
    borderBottom: metrica===key ? `2px solid #00a8e8` : "2px solid transparent"
  });
  const thPlain = { textAlign:"left", padding:"7px 8px", fontSize:9, textTransform:"uppercase",
    letterSpacing:"0.5px", whiteSpace:"nowrap", color:C.textSub };

  const handleTh = (key) => { setSortCol(key); if (METRICAS_COLS.includes(key)) onSelectMetrica(key); };

  // Checkbox custom — mismo estilo que en ventas
  const Checkbox = ({ checked, indeterminate=false, onChange }) => (
    <div onClick={e=>{ e.stopPropagation(); onChange(); }} style={{
      width:14, height:14, borderRadius:3, flexShrink:0, cursor:"pointer",
      border:`1.5px solid ${checked||indeterminate ? "#00a8e8" : C.borderLight}`,
      background: checked ? "#00a8e8" : indeterminate ? "rgba(0,168,232,0.25)" : "transparent",
      display:"flex", alignItems:"center", justifyContent:"center", transition:"all 0.12s",
    }}>
      {checked      && <span style={{ color:"#000", fontSize:9, fontWeight:900, lineHeight:1 }}>✓</span>}
      {!checked && indeterminate && <span style={{ color:"#00a8e8", fontSize:10, fontWeight:900, lineHeight:1 }}>−</span>}
    </div>
  );

  return (
    <div style={{ overflowX:"auto", width:"100%" }}>
      <table style={{ width:"100%", minWidth:900, borderCollapse:"collapse", fontSize:11 }}>
        <thead>
          <tr style={{ borderBottom:`1px solid ${C.border}` }}>
            <th style={{ ...thPlain, width:36, paddingRight:4 }}>
              <Checkbox checked={allSel} indeterminate={someSel} onChange={toggleAll}/>
            </th>
            <th style={{ ...thPlain, width:28 }}>#</th>
            <th onClick={()=>handleTh("nombre")} style={thStyle("nombre")}>
              {tableDim==="cliente"?"Cliente":tableDim==="sfamilia"?"Familia":tableDim==="marca"?"Marca":"SKU"}
            </th>
            <th onClick={()=>handleTh("venta")} style={thStyle("venta")}>
              <span style={{ display:"inline-flex", alignItems:"center" }}>Ventas ($)<InfoTip id="ventas_actuales"/></span>
            </th>
            <th onClick={()=>handleTh("pctRebate")} style={thStyle("pctRebate")}>
              <span style={{ display:"inline-flex", alignItems:"center" }}>Rebate %<InfoTip id="rebate_pct"/></span>
            </th>
            <th onClick={()=>handleTh("contribucion")} style={thStyle("contribucion")}>
              <span style={{ display:"inline-flex", alignItems:"center" }}>Contribución ($)<InfoTip id="contribucion"/></span>
            </th>
            <th onClick={()=>handleTh("margen")} style={{ ...thStyle("margen"), color:C.blue }}>
              <span style={{ display:"inline-flex", alignItems:"center" }}>Margen %<InfoTip id="margen_pct"/></span>
            </th>
            <th onClick={()=>handleTh("costoMedio")} style={thStyle("costoMedio")}>
              <span style={{ display:"inline-flex", alignItems:"center" }}>CMP<InfoTip id="costo_ponderado"/></span>
            </th>
            <th onClick={()=>handleTh("precioPromVenta")} style={{ ...thStyle("precioPromVenta"), color:C.blue }}>
              <span style={{ display:"inline-flex", alignItems:"center" }}>PPV<InfoTip id="precio_prom_venta"/></span>
            </th>
            <th onClick={()=>handleTh("precioLista")} style={thStyle("precioLista")}>
              <span style={{ display:"inline-flex", alignItems:"center" }}>PL<InfoTip id="precio_lista"/></span>
            </th>
            <th style={thPlain}>GAP margen</th>
            <th style={thPlain}>
              <span style={{ display:"inline-flex", alignItems:"center" }}>Margen teórico<InfoTip id="benchmark"/></span>
            </th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((r,i)=>{
            const precioPromVenta = +(r.venta / r.unidades).toFixed(2);
            const margenTeorico   = +((r.precioLista - r.costoMedio) / r.precioLista * 100).toFixed(1);
            const gapMargen       = +(margenTeorico - r.margen).toFixed(1);
            const isSel = selSet.has(r.nombre);

            const thM = (k) => ({
              padding:"8px 8px",
              cursor: METRICAS_COLS.includes(k)?"pointer":"default",
              background: metrica===k&&isSel?"rgba(16,185,129,0.05)":"transparent",
            });
            const cellClick = (mk) => (e) => {
              e.stopPropagation();
              if (METRICAS_COLS.includes(mk)) { toggleRow(r.nombre, mk); onSelectMetrica(mk); }
            };

            return (
              <tr key={i}
                style={{ borderBottom:`1px solid ${C.border}`, cursor:"pointer", background:isSel?"rgba(0,168,232,0.05)":"transparent", transition:"background 0.1s", outline:isSel?`1px solid ${C.blue}30`:undefined }}
                onClick={()=>toggleRow(r.nombre, metrica)}
                onMouseEnter={e=>{ if(!isSel) e.currentTarget.style.background=C.surfaceAlt; }}
                onMouseLeave={e=>{ if(!isSel) e.currentTarget.style.background="transparent"; }}>

                {/* Checkbox */}
                <td style={{ padding:"8px 8px", paddingRight:4 }}>
                  <Checkbox checked={isSel} onChange={()=>toggleRow(r.nombre, metrica)}/>
                </td>
                <td style={{ padding:"8px 8px", color:C.textMuted, fontSize:10 }}>{i+1}</td>
                <td style={{ padding:"8px 8px", fontWeight:700, color:isSel?"#00a8e8":C.text, whiteSpace:"nowrap" }}>{r.nombre}</td>

                {/* Ventas */}
                <td style={thM("venta")} onClick={cellClick("venta")}>
                  <span style={{ fontWeight:700, color:C.text }}>${r.venta.toLocaleString()}</span>
                </td>
                {/* Rebate % semáforo */}
                <td style={{ padding:"8px 8px" }}>
                  <span style={{ color:r.pctRebate>5?C.red:r.pctRebate>3?C.amber:C.textSub, fontWeight:600 }}>{r.pctRebate}%</span>
                </td>
                {/* Contribución */}
                <td style={thM("contribucion")} onClick={cellClick("contribucion")}>
                  <span style={{ fontWeight:700, color:C.blue }}>${r.contribucion.toLocaleString()}</span>
                </td>
                {/* Margen % con barra */}
                <td style={thM("margen")} onClick={cellClick("margen")}>
                  <span style={{ fontWeight:700, color:r.margen>=30?C.green:r.margen>=22?C.amber:C.red }}>{r.margen}%</span>
                  <div style={{ height:2, background:C.border, borderRadius:2, marginTop:3, width:40 }}>
                    <div style={{ height:"100%", width:`${Math.min(100,(r.margen/50)*100)}%`, background:r.margen>=30?C.green:r.margen>=22?C.amber:C.red, borderRadius:2 }}/>
                  </div>
                </td>
                {/* CMP */}
                <td style={thM("costoMedio")} onClick={cellClick("costoMedio")}>
                  <span style={{ color:metrica==="costoMedio"?C.green:C.textSub }}>${r.costoMedio}</span>
                </td>
                {/* PPV */}
                <td style={thM("precioPromVenta")} onClick={cellClick("precioPromVenta")}>
                  <span style={{ color:metrica==="precioPromVenta"?C.green:C.blue }}>${precioPromVenta}</span>
                </td>
                {/* PL */}
                <td style={thM("precioLista")} onClick={cellClick("precioLista")}>
                  <span style={{ color:metrica==="precioLista"?C.green:C.textSub }}>${r.precioLista}</span>
                </td>
                {/* GAP margen badge */}
                <td style={{ padding:"8px 8px" }}>
                  <span style={{ padding:"2px 6px", borderRadius:4, fontSize:10, fontWeight:700,
                    background: gapMargen>8?"rgba(244,63,94,0.1)":gapMargen>4?"rgba(245,158,11,0.1)":"rgba(16,185,129,0.1)",
                    color:      gapMargen>8?C.red:gapMargen>4?C.amber:C.green }}>
                    {gapMargen>0?"+":""}{gapMargen}pp
                  </span>
                </td>
                {/* Margen teórico */}
                <td style={{ padding:"8px 8px" }}>
                  <span style={{ color:C.textSub }}>{margenTeorico}%</span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// MÓDULO MÁRGENES v9
// Orden: 1.KPIs 2.Evolución negocio 3.Pareto+selector 4.Tabla80%
//        5.Drill Pareto 6.Tabla general+selector 7.Gráfico dinámico
// paretoDimMargen y tableDimMargen COMPLETAMENTE INDEPENDIENTES
// ════════════════════════════════════════════════════════════════════════════
// ════════════════════════════════════════════════════════════════════════════
// TABLA TOP 10 MARGEN — drill down del KPI "Margen General %"
// Columnas: Cliente · Contribución ($) · Margen % · % vs Año Ant. · % Participación
// Año anterior derivado del historialMargen (suma anual de contribucionAnt)
// ════════════════════════════════════════════════════════════════════════════
function TablaTop10Margen({ onClose }) {
  // Enriquecer clientesMargen con contribucionAnt y margenAnt del historial
  const enriched = clientesMargen.map(r => {
    const hist = historialMargen[r.nombre];
    const contribucionAnt = hist
      ? Math.round(hist.reduce((s,m)=>s+m.contribucionAnt,0))
      : Math.round(r.contribucion / 1.081 * (1 - 0.018)); // fallback proporcional
    const margenAnt = +(r.margen - 1.8).toFixed(1);
    return { ...r, contribucionAnt, margenAnt };
  });

  const top10 = [...enriched]
    .sort((a,b)=>b.contribucion-a.contribucion)
    .slice(0,10);

  const totalContrib    = top10.reduce((s,r)=>s+r.contribucion,0);
  const totalContribAnt = top10.reduce((s,r)=>s+r.contribucionAnt,0);
  const benchmark       = 30.1;
  const margenProm      = +((top10.reduce((s,r)=>s+r.margen*r.contribucion,0)/totalContrib)).toFixed(1);
  const vsAntTotal      = +((totalContrib-totalContribAnt)/totalContribAnt*100).toFixed(1);

  // ADI state
  const [adiText,    setAdiText]    = useState("");
  const [adiLoading, setAdiLoading] = useState(false);
  const [adiDone,    setAdiDone]    = useState(false);

  const blockColors = [C.green, C.cyan, C.indigo, C.amber];

  const streamApi = async (messages, onChunk) => {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method:"POST", headers:{ "Content-Type":"application/json" },
      body:JSON.stringify({ model:"claude-sonnet-4-20250514", max_tokens:1000, stream:true, messages })
    });
    const reader = res.body.getReader(); const dec = new TextDecoder(); let full = "";
    while(true) {
      const { done, value } = await reader.read(); if(done) break;
      const chunk = dec.decode(value,{stream:true});
      for(const line of chunk.split("\n").filter(l=>l.startsWith("data:"))) {
        const json = line.replace("data: ","").trim(); if(json==="[DONE]") continue;
        try { const d=JSON.parse(json); if(d?.delta?.text){ full+=d.delta.text; onChunk(full); } } catch{}
      }
    }
    return full;
  };

  const handleExplicar = async () => {
    if (adiLoading) return;
    setAdiLoading(true); setAdiText(""); setAdiDone(false);

    const bajo      = top10.filter(r => r.margen < benchmark);
    const sobre     = top10.filter(r => r.margen >= benchmark);
    const margenTeorico = +((top10.reduce((s,r)=>s+(r.venta||0),0) > 0
      ? top10.reduce((s,r)=>s+((r.venta||0)-(r.costo||0)),0) / top10.reduce((s,r)=>s+(r.venta||0),0) * 100
      : margenProm)).toFixed(1);
    const erosion   = +(margenTeorico - margenProm).toFixed(1);

    const universo      = top10.length;
    const pctElementos  = 100; // top10 es el universo visible
    const concLabel     = sobre.length >= Math.ceil(universo * 0.6) ? "diversificado" : sobre.length >= Math.ceil(universo * 0.5) ? "intermedio" : "concentrado / riesgo";

    const clientesCtx = top10.map((r,i) => {
      const va        = +((r.contribucion - r.contribucionAnt) / r.contribucionAnt * 100).toFixed(1);
      const pp        = +((r.contribucion / totalContrib) * 100).toFixed(1);
      const diffBench = +(r.margen - benchmark).toFixed(1);
      const rebate    = r.pctRebate != null ? ` · rebate ${r.pctRebate}%` : "";
      return `${i+1}. ${r.nombre}: margen ${r.margen}% (${diffBench>=0?"+":""}${diffBench}pp vs benchmark)${rebate} · contribución ${va>0?"+":""}${va}% vs ant. · ${pp}% del total`;
    }).join("\n");

    const prompt = `Actúa como ADI, un controller senior que interpreta el negocio desde los datos visibles.
Estás analizando la tabla Top 10 Clientes por rentabilidad — módulo Márgenes.
Basate EXCLUSIVAMENTE en los datos visibles. No uses información de otros módulos. No inventes causas.

DATOS DE LA TABLA:
Margen promedio ponderado: ${margenProm}% | Benchmark: ${benchmark}% | Contribución total: $${totalContrib.toLocaleString()}K
Variación contribución vs año anterior: ${vsAntTotal>0?"+":""}${vsAntTotal}%
Sobre benchmark (${sobre.length}): ${sobre.map(r=>r.nombre).join(", ")||"ninguno"}
Bajo benchmark (${bajo.length}): ${bajo.map(r=>r.nombre).join(", ")||"ninguno"}
${erosion > 0.5 ? `Erosión estimada por rebates: ${erosion}pp` : ""}

DETALLE VISIBLE:
${clientesCtx}

CRITERIO DE CONCENTRACIÓN:
- >60% de los clientes visibles sobre benchmark → diversificado
- 50%–60% → intermedio
- <50% → concentrado / riesgo

REGLAS DE ANÁLISIS:
- Rebate > 3% se considera alto
- Comparar siempre margen % vs benchmark ${benchmark}%
- Diferenciar margen % (calidad) vs contribución $ (impacto)
- Cada número debe acompañarse del cliente al que pertenece
- Integrar datos dentro de frases, no listar sueltos
- Prohibido: "probablemente", "podría deberse a", "quizás"

ESTILO DE REFERENCIA:
Evidencia: "Innova Ferre (36%) y La Polar (34%) mantienen márgenes sobre benchmark, a pesar de rebates moderados. En cambio, Falabella (22%) y Lider (21,5%) están bajo benchmark y operan con rebates sobre 4%."
Lectura: "A pesar del volumen, Falabella y Lider erosionan la rentabilidad por la presión comercial. En cambio, retail especializado sostiene márgenes altos con menor dependencia."
Foco: "[Cliente] → acción concreta"

ESTRUCTURA OBLIGATORIA — 4 bloques separados por línea vacía, título en mayúsculas seguido de dos puntos:

RESUMEN:
Máximo 2 líneas. Estado general del margen y si la rentabilidad está concentrada o distribuida entre los clientes visibles.

EVIDENCIA:
Máximo 3 líneas. Datos concretos: nombres de clientes, margen %, benchmark, rebate %, contribución y participación integrados en frases. No listar.

LECTURA DEL NEGOCIO:
Máximo 3 líneas. Interpretar relación entre rebate, margen y contribución. Quién sostiene y quién erosiona. No repetir la tabla.

SIGUIENTE FOCO:
2–3 acciones. Formato: "[Cliente] → acción concreta". Nombre del cliente siempre primero.`;

    try {
      await streamApi([{ role:"user", content:prompt }], t => setAdiText(t));
      setAdiDone(true);
    } catch { setAdiText("Error al conectar con ADI."); setAdiDone(true); }
    setAdiLoading(false);
  };

  const adiBlocks = adiText ? adiText.split(/\n\n+/).filter(Boolean).map(b => {
    const colon = b.indexOf(":");
    if (colon > 0 && colon < 32 && b.slice(0,colon) === b.slice(0,colon).toUpperCase()) {
      return { title: b.slice(0,colon), body: b.slice(colon+1).trim() };
    }
    return { title: null, body: b };
  }) : [];

  // Paleta de texto — consistente con TablaTop10Clientes
  const tx1 = "#FFFFFF";
  const tx2 = "#c0c0c0";
  const tx3 = "#707070";
  const txH = "#c0c0c0";
  const thB = {
    textAlign:"left", padding:"7px 10px", fontSize:9,
    textTransform:"uppercase", letterSpacing:"0.6px",
    whiteSpace:"nowrap", fontWeight:600,
  };

  return (
    <div style={{
      background:C.surface, border:`1px solid ${C.green}`, borderRadius:10,
      padding:"16px", marginTop:-4,
      boxShadow:"0 4px 24px rgba(16,185,129,0.10)",
      animation:"fadeSlideDown 0.18s ease"
    }}>

      {/* Header */}
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:13 }}>
        <div>
          <p style={{ fontWeight:700, fontSize:12, color:tx1 }}>
            Top 10 Clientes por Rentabilidad
            <span style={{ fontWeight:400, color:"#00a8e8", fontSize:11, marginLeft:8 }}>
              — Contribución · Margen · Evolución
            </span>
          </p>
          <p style={{ fontSize:10, color:tx2, marginTop:2 }}>
            Ordenado por contribución ($) · Benchmark margen: <span style={{ color:C.amber, fontWeight:600 }}>{benchmark}%</span>
          </p>
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:8 }}>
          <button onClick={handleExplicar} disabled={adiLoading} style={{
            padding:"6px 13px", borderRadius:6, fontSize:10.5, fontWeight:700, cursor:adiLoading?"not-allowed":"pointer",
            border:`1px solid ${C.green}45`, background:`${C.green}0e`, color:adiLoading?C.textMuted:C.green,
            display:"flex", alignItems:"center", gap:6, transition:"all 0.15s", flexShrink:0,
          }}
            onMouseEnter={e=>{ if(!adiLoading) e.currentTarget.style.background=`${C.green}20`; }}
            onMouseLeave={e=>e.currentTarget.style.background=`${C.green}0e`}>
            {adiLoading
              ? <><span style={{ width:5,height:5,borderRadius:"50%",background:C.green,animation:"blink 0.8s infinite",display:"inline-block" }}/> Analizando…</>
              : <><span style={{ fontSize:12 }}>✦</span> Explícame el margen</>}
          </button>
          <button onClick={onClose} style={{
            background:"transparent", border:`1px solid ${C.border}`,
            color:tx2, borderRadius:5, padding:"3px 10px", fontSize:10, cursor:"pointer"
          }}>✕</button>
        </div>
      </div>

      {/* Respuesta ADI inline */}
      {(adiText || adiLoading) && (
        <div style={{ marginBottom:14, background:C.surfaceAlt, border:`1px solid ${C.green}20`, borderRadius:8, padding:"12px 14px", borderLeft:`3px solid ${C.green}` }}>
          <div style={{ display:"flex", alignItems:"center", gap:7, marginBottom:9 }}>
            <div style={{ width:18, height:18, borderRadius:5, background:"linear-gradient(135deg,#00c2e8,#0e7fa8)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:9, fontWeight:900, color:"#fff", flexShrink:0 }}>A</div>
            <span style={{ fontSize:10, fontWeight:700, color:"#00a8e8" }}>ADI</span>
            <span style={{ fontSize:9.5, color:C.textMuted }}>— Análisis de margen</span>
          </div>
          {adiLoading && !adiText && (
            <div style={{ display:"flex", flexDirection:"column", gap:7 }}>
              {[68,52,78,48].map((w,i)=>(
                <div key={i} style={{ height:7, width:`${w}%`, background:C.border, borderRadius:3, opacity:0.5, animation:`pulse 1.4s ${i*0.1}s infinite` }}/>
              ))}
            </div>
          )}
          {adiBlocks.length > 0 && (
            <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
              {adiBlocks.map((b,i) => (
                <div key={i} style={{ borderLeft:`2px solid ${blockColors[i%blockColors.length]}`, paddingLeft:10 }}>
                  {b.title && <p style={{ fontSize:8.5, fontWeight:800, color:blockColors[i%blockColors.length], textTransform:"uppercase", letterSpacing:"0.8px", marginBottom:3 }}>{b.title}</p>}
                  <p style={{ fontSize:11, color:"#c0c0c0", lineHeight:1.65 }}>
                    {b.body}
                    {adiLoading && i===adiBlocks.length-1 && <span style={{ display:"inline-block", width:5, height:10, background:C.green, borderRadius:2, animation:"blink 0.8s infinite", marginLeft:2 }}/>}
                  </p>
                </div>
              ))}
              {!adiLoading && adiDone && (
                <button onClick={handleExplicar} style={{ alignSelf:"flex-start", fontSize:9.5, color:C.textMuted, background:"transparent", border:`1px solid ${C.border}`, borderRadius:4, padding:"3px 9px", cursor:"pointer", marginTop:2 }}>↻ Regenerar</button>
              )}
            </div>
          )}
          {adiLoading && adiText && adiBlocks.length===0 && (
            <p style={{ fontSize:11, color:"#c0c0c0", lineHeight:1.65 }}>{adiText}<span style={{ display:"inline-block", width:5, height:10, background:C.green, borderRadius:2, animation:"blink 0.8s infinite", marginLeft:2 }}/></p>
          )}
        </div>
      )}

      <div style={{ overflowX:"auto" }}>
        <table style={{ width:"100%", minWidth:560, borderCollapse:"collapse", fontSize:11 }}>
          <thead>
            <tr style={{ borderBottom:`1px solid ${C.border}` }}>
              <th style={{ ...thB, color:tx3, width:28 }}>#</th>
              <th style={{ ...thB, color:txH }}>Cliente</th>
              <th style={{ ...thB, color:C.green }}>Contribución ($)</th>
              <th style={{ ...thB, color:C.blue }}>Margen %</th>
              <th style={{ ...thB, color:tx2 }}>% vs Año Ant.</th>
              <th style={{ ...thB, color:tx2 }}>% Participación</th>
            </tr>
          </thead>
          <tbody>
            {top10.map((r,i) => {
              const vsAnt   = +((r.contribucion - r.contribucionAnt) / r.contribucionAnt * 100).toFixed(1);
              const pctPart = +((r.contribucion / totalContrib) * 100).toFixed(1);
              const bcVsAnt = badge(vsAnt);
              // Semáforo margen vs benchmark
              const margenColor = r.margen >= 30 ? C.green : r.margen >= 22 ? C.amber : C.red;

              return (
                <tr key={i} style={{ borderBottom:`1px solid ${C.border}` }}
                  onMouseEnter={e=>e.currentTarget.style.background=C.surfaceAlt}
                  onMouseLeave={e=>e.currentTarget.style.background="transparent"}>

                  <td style={{ padding:"8px 10px", color:tx3, fontSize:10 }}>{i+1}</td>

                  <td style={{ padding:"8px 10px", fontWeight:700, color:tx1, whiteSpace:"nowrap" }}>{r.nombre}</td>

                  {/* Contribución + sparkline */}
                  <td style={{ padding:"8px 10px" }}>
                    <span style={{ fontWeight:700, color:C.green }}>${r.contribucion.toLocaleString()}K</span>
                    <div style={{ height:2, background:C.border, borderRadius:2, marginTop:3, width:52 }}>
                      <div style={{ height:"100%", width:`${(r.contribucion/top10[0].contribucion)*100}%`, background:C.green, borderRadius:2, opacity:0.6 }}/>
                    </div>
                  </td>

                  {/* Margen % con barra + semáforo vs benchmark */}
                  <td style={{ padding:"8px 10px" }}>
                    <div style={{ display:"flex", alignItems:"center", gap:7 }}>
                      <span style={{ fontWeight:700, color:margenColor }}>{r.margen}%</span>
                      <div style={{ height:3, width:36, background:C.border, borderRadius:2, flexShrink:0 }}>
                        <div style={{ height:"100%", width:`${Math.min(100,(r.margen/50)*100)}%`, background:margenColor, borderRadius:2, opacity:0.7 }}/>
                      </div>
                      {r.margen < benchmark && (
                        <span style={{ fontSize:8.5, color:C.red, fontWeight:700, letterSpacing:"0.3px" }}>▼</span>
                      )}
                    </div>
                  </td>

                  {/* % vs año anterior (contribución) */}
                  <td style={{ padding:"8px 10px" }}>
                    <span style={{ padding:"2px 7px", borderRadius:4, fontSize:10, fontWeight:700, background:bcVsAnt.bg, color:bcVsAnt.color }}>
                      {vsAnt>0?"+":""}{vsAnt}%
                    </span>
                  </td>

                  {/* % Participación + barra */}
                  <td style={{ padding:"8px 10px" }}>
                    <div style={{ display:"flex", alignItems:"center", gap:7 }}>
                      <span style={{ fontWeight:600, color:tx2 }}>{pctPart}%</span>
                      <div style={{ height:4, width:40, background:C.border, borderRadius:2, flexShrink:0 }}>
                        <div style={{ height:"100%", width:`${Math.min(100,pctPart*2.2)}%`, background:C.green, borderRadius:2, opacity:0.65 }}/>
                      </div>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>

          <tfoot>
            <tr style={{ borderTop:`1px solid ${C.borderLight}` }}>
              <td colSpan={2} style={{ padding:"8px 10px", fontSize:10, color:tx3, fontStyle:"italic" }}>Total período</td>

              {/* Total contribución */}
              <td style={{ padding:"8px 10px", fontWeight:800, color:"#00a8e8", fontSize:11 }}>
                ${totalContrib.toLocaleString()}K
              </td>

              {/* Margen promedio ponderado */}
              <td style={{ padding:"8px 10px" }}>
                <span style={{ fontWeight:700, color:C.blue, fontSize:11 }}>
                  {margenProm}%
                </span>
                <span style={{ fontSize:9, color:tx3, marginLeft:4 }}>prom.</span>
              </td>

              {/* % vs año anterior total */}
              <td style={{ padding:"8px 10px" }}>
                {(()=>{
                  const v = vsAntTotal;
                  const b = badge(v);
                  return <span style={{ padding:"2px 7px", borderRadius:4, fontSize:10, fontWeight:700, background:b.bg, color:b.color }}>{v>0?"+":""}{v}%</span>;
                })()}
              </td>

              <td style={{ padding:"8px 10px", fontWeight:700, color:"#00a8e8" }}>100%</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

function ModuloMargenes({ filtro, filtros }) {
  // ── Estado Pareto — controla SOLO el gráfico Pareto, tabla 80% y drill
  const [paretoDimMargen,         setParetoDimMargen]        = useState("cliente");
  const [paretoDrillNombreMargen, setParetoDrillNombreMargen]= useState(null);

  // ── Estado Detalle de ventas — controla SOLO la tabla, selección y gráfico dinámico
  const [tableDimMargen, setTableDimMargen] = useState("cliente");
  const [tableSortCol,   setTableSortCol]   = useState("contribucion");
  const [seleccionado,   setSeleccionado]   = useState(new Set());
  const [metrica,        setMetrica]        = useState("contribucion");

  // ── Estado KPI drill — margen general
  const [kpiMargenDrill, setKpiMargenDrill] = useState(false);
  const handleKpiMargen = () => setKpiMargenDrill(prev => !prev);

  const DIM_OPTS_PARETO = [["cliente","Clientes"],["sfamilia","Familias"],["marca","Marcas"],["sku","SKU"]];
  const DIM_OPTS_TABLA  = [["cliente","Clientes"],["sfamilia","Familias"],["marca","Marcas"],["sku","SKU"]];

  // ── Índice de mes (-1 = Anual)
  const mesIdx = filtro && filtro !== "Anual" ? (MESES_IDX[filtro] ?? -1) : -1;

  // Factor de escala para el mes seleccionado (basado en la curva de contribución mensual)
  const mesFactor = mesIdx >= 0 ? (() => {
    const totalContribAnual = margenesMensuales.reduce((s,m)=>s+m.contribucion, 0);
    return margenesMensuales[mesIdx].contribucion / totalContribAnual;
  })() : 1;

  // Escala una fila de margen al mes seleccionado
  const scaleMargenRow = (r) => {
    if (mesIdx < 0) return r;
    return {
      ...r,
      contribucion:    Math.round(r.contribucion    * mesFactor),
      contribucionAnt: r.contribucionAnt != null ? Math.round(r.contribucionAnt * mesFactor) : undefined,
      venta:           Math.round(r.venta           * mesFactor),
      rebates:         Math.round((r.rebates||0)    * mesFactor),
    };
  };

  // Filtrar y escalar
  const applyMargenFiltros = (rows) => applyFiltros(rows, filtros).map(scaleMargenRow);

  // Pareto data — calculado solo desde paretoDimMargen
  const paretoContribData = buildParetoContribData(paretoDimMargen, applyMargenFiltros);

  // Tabla data — calculada solo desde tableDimMargen
  const tableData = applyMargenFiltros(
    tableDimMargen==="cliente"  ? clientesMargen
  : tableDimMargen==="sfamilia" ? sfamiliasMargen
  : tableDimMargen==="marca"    ? marcasMargen
  : skusMargen
  );

  // ── KPIs filtrados
  const filteredContrib = tableData.reduce((s,r)=>s+r.contribucion, 0);
  const filteredVenta   = tableData.reduce((s,r)=>s+r.venta, 0);
  const margenFiltrado  = filteredVenta > 0 ? +((filteredContrib / filteredVenta) * 100).toFixed(1) : margenKPI.pct;
  const hasActiveFilter = filtros && (filtros.marcas?.length||filtros.sfamilias?.length||filtros.canales?.length||filtros.clientes?.length||filtros.skus?.length);

  // Pareto handlers — no tocan estado de tabla
  const handleParetoDimMargen = (d) => {
    setParetoDimMargen(d);
    setParetoDrillNombreMargen(null);
  };

  // Tabla handlers — no tocan estado de Pareto
  const handleTableDimMargen = (d) => {
    setTableDimMargen(d);
    setSeleccionado(new Set());
    setTableSortCol("contribucion");
    setMetrica("contribucion");
  };

  const handleSelectFila = (nextSet, lastName, mk) => {
    setSeleccionado(nextSet);
    if (mk) setMetrica(mk);
  };

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:14 }}>

      {/* ① KPIs — escalados según filtros activos */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:12 }}>
        <KpiCard label="Margen General %"   value={`${margenFiltrado}%`}
          sub={hasActiveFilter ? <span style={{ color:C.cyan, fontSize:9 }}>Filtrado · {tableData.length} elemento{tableData.length!==1?"s":""}</span> : "Clic para ver Top 10 clientes"}
          color={C.blue} helpId="margen_pct" onClick={handleKpiMargen} active={kpiMargenDrill}/>
        <KpiCard label="Contribución Total" value={fmtUSD(filteredContrib*1000)}
          sub={hasActiveFilter ? "Selección filtrada" : "Ventas − Costo − Rebates"}
          color={C.green} helpId="contribucion"/>
        <KpiCard label="GAP vs Ant."        value={`+${margenKPI.gapPuntos} pp`} sub="Puntos porcentuales" color={C.cyan}/>
        <KpiCard label="Benchmark"          value="30.1%"                        sub="Margen ponderado empresa" color={C.amber} helpId="benchmark"/>
      </div>

      {/* ① Drill down — Top 10 clientes por rentabilidad */}
      {kpiMargenDrill && (
        <TablaTop10Margen onClose={()=>setKpiMargenDrill(false)}/>
      )}

      {/* ② Gráfico negocio — evolución anual con mes resaltado */}
      <Card title="Evolución del Margen del Negocio" subtitle={mesIdx>=0?`Mes seleccionado: ${filtro} — margen % vs anterior · Benchmark 30.1%`:"Margen % vs año anterior · Benchmark 30.1%"}>
        <AnimatedChart triggerKey={filtro} height={170} color={C.blue}>
          <ResponsiveContainer width="100%" height={170}>
            <ComposedChart data={margenesMensuales} margin={{ top:4, right:8, bottom:0, left:-10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={C.border}/>
              <XAxis dataKey="mes" tick={{ fontSize:9, fill:C.textSub }} axisLine={false} tickLine={false}/>
              <YAxis yAxisId="pct"     tick={{ fontSize:9, fill:C.textSub }} axisLine={false} tickLine={false} tickFormatter={v=>`${v}%`} domain={[22,38]}/>
              <YAxis yAxisId="contrib" orientation="right" tick={{ fontSize:9, fill:C.textSub }} axisLine={false} tickLine={false} tickFormatter={v=>`$${v}K`}/>
              <Tooltip content={<ChartTooltip/>}/>
              <Area yAxisId="contrib" type="monotone" dataKey="contribucion" name="Contrib $K" fill="rgba(0,168,232,0.06)" stroke="transparent"/>
              <Line yAxisId="pct" type="monotone" dataKey="margenAnt" name="Margen Ant %" stroke="#2a3a52" strokeWidth={1.5} dot={false} strokeDasharray="4 4" unit="%"/>
              <Line yAxisId="pct" type="monotone" dataKey="margen"    name="Margen %"     stroke={C.blue}  strokeWidth={2.5}
                dot={(props)=>{
                  const { cx,cy,index } = props;
                  if (mesIdx>=0 && index===mesIdx) return <circle key={index} cx={cx} cy={cy} r={5} fill={C.cyan} stroke="#fff" strokeWidth={1.5}/>;
                  return <circle key={index} cx={cx} cy={cy} r={3} fill={C.blue}/>;
                }}
                activeDot={{ r:5 }} unit="%"/>
              <ReferenceLine yAxisId="pct" y={30.1} stroke={C.amber} strokeDasharray="5 3" label={{ value:"Benchmark", fill:C.amber, fontSize:9, position:"insideTopRight" }}/>
              {mesIdx>=0 && (
                <ReferenceLine yAxisId="pct" x={margenesMensuales[mesIdx].mes} stroke={C.cyan} strokeDasharray="3 3" strokeOpacity={0.6}
                  label={{ value:filtro, fill:C.cyan, fontSize:9, position:"insideTopRight" }}/>
              )}
            </ComposedChart>
          </ResponsiveContainer>
        </AnimatedChart>
      </Card>

      {/* ③ Pareto de Contribución */}
      <Card>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:10 }}>
          <div>
            <p style={{ fontWeight:700, fontSize:12, display:"inline-flex", alignItems:"center" }}>
              Dónde se genera el margen de contribución<InfoTip id="pareto_contribucion" style={{ marginLeft:4 }}/>
            </p>
            <p style={{ fontSize:10, color:C.textSub }}>
              Concentración por $ contribución · barras verdes = bloque 80%
              · dimensión: <span style={{ color:"#00a8e8", fontWeight:600 }}>
                {paretoDimMargen==="cliente"?"Clientes":paretoDimMargen==="sfamilia"?"Familias":paretoDimMargen==="marca"?"Marcas":"SKUs"}
              </span>
            </p>
          </div>
          <SelectorDimension dim={paretoDimMargen} onChange={handleParetoDimMargen} opciones={DIM_OPTS_PARETO} color={"#00a8e8"}/>
        </div>
        <ParetoContribucion
          paretoContribData={paretoContribData}
          paretoDrillNombreMargen={paretoDrillNombreMargen}
          triggerKey={paretoDimMargen}
        />
      </Card>

      {/* ④ Tabla bloque 80% — pertenece al Pareto, no a la tabla general */}
      <BloquePareto80MargenCard
        paretoContribData={paretoContribData}
        paretoDrillNombreMargen={paretoDrillNombreMargen}
        paretoDimMargen={paretoDimMargen}
        onDrillSelect={setParetoDrillNombreMargen}
      />

      {/* ⑤ Drill del Pareto — pertenece al Pareto, no activa gráfico dinámico */}
      {paretoDrillNombreMargen && paretoDimMargen!=="sku" && (
        <DrillParetoMargen
          nombre={paretoDrillNombreMargen}
          paretoDimMargen={paretoDimMargen}
          onClose={()=>setParetoDrillNombreMargen(null)}
        />
      )}

      {/* ⑥ Detalle de ventas — selector SOLO para la tabla, independiente del Pareto */}
      <Card>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:12 }}>
          <div>
            <p style={{ fontWeight:700, fontSize:12 }}>
              Detalle de márgenes de contribución —{" "}
              {tableDimMargen==="cliente"?"Clientes":tableDimMargen==="sfamilia"?"Familias":tableDimMargen==="marca"?"Marcas":"SKUs"}
              {seleccionado.size > 0 && (
                <span style={{ fontSize:10, color:C.cyan, fontWeight:400, marginLeft:8 }}>
                  · <span style={{ fontWeight:700 }}>{seleccionado.size} seleccionado{seleccionado.size>1?"s":""}</span>
                  {" — reflejado en gráfico"}
                </span>
              )}
            </p>
            <p style={{ fontSize:10, color:C.textSub }}>
              Clic en fila o ✓ para seleccionar · selección múltiple · gráfico se actualiza en tiempo real
              {paretoDimMargen!==tableDimMargen && (
                <span style={{ color:C.amber, marginLeft:8 }}>· Selector independiente del Pareto</span>
              )}
            </p>
          </div>
          <div style={{ display:"flex", alignItems:"center", gap:12 }}>
            <span style={{ fontSize:9.5, color:C.textSub }}>
              Benchmark: <strong style={{ color:C.amber }}>30.1%</strong><InfoTip id="benchmark"/>
            </span>
            <SelectorDimension dim={tableDimMargen} onChange={handleTableDimMargen} opciones={DIM_OPTS_TABLA} color={C.blue}/>
          </div>
        </div>
        <TablaMargen
          data={tableData}
          sortCol={tableSortCol}    setSortCol={setTableSortCol}
          seleccionado={seleccionado} onSelectFila={handleSelectFila}
          metrica={metrica}         onSelectMetrica={setMetrica}
          tableDim={tableDimMargen}
        />
        <p style={{ fontSize:9.5, color:C.textMuted, marginTop:8 }}>
          * Clic en fila → activa gráfico · Clic en columna subrayada → cambia métrica analizada
        </p>
      </Card>

      {/* ⑦ Gráfico dinámico — SOLO se activa desde la tabla general, nunca desde el Pareto */}
      {seleccionado.size > 0 && (
        <GraficoDinamico
          nombre={[...seleccionado][seleccionado.size-1]}
          nombres={[...seleccionado]}
          metrica={metrica}
          onClose={()=>setSeleccionado(new Set())}
        />
      )}

    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// MÓDULO INVENTARIO — sin cambios respecto a v3
// ════════════════════════════════════════════════════════════════════════════
// ════════════════════════════════════════════════════════════════════════════
// DRILL DOWN INVENTARIO — 4 componentes, uno por KPI
// Lógica Pareto: concentración del problema, no top N arbitrario
// ════════════════════════════════════════════════════════════════════════════

// Clasificación DOH → etiqueta + color
function clsDOH(doh) {
  if (doh > 120) return { label:"Sobrestock", color:C.red,   bg:"rgba(244,63,94,0.12)"   };
  if (doh >= 90) return { label:"Riesgo",     color:C.amber, bg:"rgba(245,158,11,0.12)"  };
  return              { label:"Sano",       color:C.green, bg:"rgba(16,185,129,0.10)"  };
}

// Texto del sub para las tablas
const tx1="#FFFFFF", tx2="#c0c0c0", tx3="#707070", txH="#c0c0c0";
const thBd = { textAlign:"left", padding:"7px 10px", fontSize:9, textTransform:"uppercase", letterSpacing:"0.6px", whiteSpace:"nowrap", fontWeight:600 };

function DrillInvBase({ title, subtitle, accentColor, insight, onClose, children }) {
  return (
    <div style={{ background:C.surface, border:`1px solid ${accentColor}`, borderRadius:10, padding:"16px", marginTop:-4, boxShadow:`0 4px 24px rgba(0,0,0,0.18)`, animation:"fadeSlideDown 0.18s ease" }}>
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:10 }}>
        <div>
          <p style={{ fontWeight:700, fontSize:12, color:tx1 }}>
            {title}
            <span style={{ fontWeight:400, color:accentColor, fontSize:11, marginLeft:8 }}>{subtitle}</span>
          </p>
          {insight && <p style={{ fontSize:10, color:tx2, marginTop:2 }}>{insight}</p>}
        </div>
        <button onClick={onClose} style={{ background:"transparent", border:`1px solid ${C.border}`, color:tx2, borderRadius:5, padding:"3px 10px", fontSize:10, cursor:"pointer" }}>✕</button>
      </div>
      {children}
    </div>
  );
}

// ── 4.1 Stock Total — concentración de capital
function DrillStockTotal({ onClose }) {
  const sorted = [...skuInventario].sort((a,b)=>b.stockUSD-a.stockUSD);
  const totalStock = sorted.reduce((s,r)=>s+r.stockUSD,0);
  let acum=0;
  const withPareto = sorted.map(r=>{ acum+=r.stockUSD; return { ...r, pctPart:+((r.stockUSD/totalStock)*100).toFixed(1), pctAcum:+((acum/totalStock)*100).toFixed(1) }; });
  const bloque80 = withPareto.filter(r=>r.pctAcum<=80);
  const items = bloque80.length ? bloque80 : withPareto.slice(0,1);

  return (
    <DrillInvBase title="Concentración de Capital" subtitle="— Dónde está la plata" accentColor={C.blue} onClose={onClose}
      insight={`${items.length} SKU${items.length>1?"s":""} concentran el 80% del inventario · ordenado por Stock ($) desc`}>
      <div style={{ overflowX:"auto" }}>
        <table style={{ width:"100%", minWidth:580, borderCollapse:"collapse", fontSize:11 }}>
          <thead>
            <tr style={{ borderBottom:`1px solid ${C.border}` }}>
              <th style={{ ...thBd, color:tx3, width:28 }}>#</th>
              <th style={{ ...thBd, color:txH }}>SKU</th>
              <th style={{ ...thBd, color:tx2 }}>Unidades</th>
              <th style={{ ...thBd, color:C.blue }}>Stock ($)</th>
              <th style={{ ...thBd, color:tx2 }}>% Part.</th>
              <th style={{ ...thBd, color:tx2 }}>% Acum.</th>
              <th style={{ ...thBd, color:tx2 }}>DOH</th>
              <th style={{ ...thBd, color:tx2 }}>Clasificación</th>
            </tr>
          </thead>
          <tbody>
            {withPareto.map((r,i)=>{
              const cls = clsDOH(r.doh);
              const isBloque = r.pctAcum<=80;
              return (
                <tr key={i} style={{ borderBottom:`1px solid ${C.border}`, background: isBloque?"rgba(14,165,233,0.03)":"transparent" }}
                  onMouseEnter={e=>e.currentTarget.style.background=C.surfaceAlt}
                  onMouseLeave={e=>e.currentTarget.style.background=isBloque?"rgba(14,165,233,0.03)":"transparent"}>
                  <td style={{ padding:"8px 10px", color:tx3, fontSize:10 }}>{i+1}</td>
                  <td style={{ padding:"8px 10px", fontWeight:700, color:tx1, whiteSpace:"nowrap" }}>{r.sku}</td>
                  <td style={{ padding:"8px 10px" }}>
                    <span style={{ fontWeight:600, color:tx2 }}>{r.stockUnd.toLocaleString()}</span>
                    <span style={{ fontSize:9, color:tx3, marginLeft:4 }}>und</span>
                  </td>
                  <td style={{ padding:"8px 10px" }}>
                    <span style={{ fontWeight:700, color:C.blue }}>${r.stockUSD.toLocaleString()}</span>
                    <div style={{ height:2, background:C.border, borderRadius:2, marginTop:3, width:52 }}>
                      <div style={{ height:"100%", width:`${(r.stockUSD/sorted[0].stockUSD)*100}%`, background:C.blue, borderRadius:2, opacity:0.6 }}/>
                    </div>
                  </td>
                  <td style={{ padding:"8px 10px", color:tx2, fontWeight:600 }}>{r.pctPart}%</td>
                  <td style={{ padding:"8px 10px" }}>
                    <span style={{ padding:"2px 7px", borderRadius:4, fontSize:10, fontWeight:700, background:r.pctAcum<=80?"rgba(14,165,233,0.12)":"transparent", color:r.pctAcum<=80?C.blue:tx3 }}>{r.pctAcum}%</span>
                  </td>
                  <td style={{ padding:"8px 10px", fontWeight:700, color:r.doh<=45?C.green:r.doh<=90?C.amber:C.red }}>{r.doh}d</td>
                  <td style={{ padding:"8px 10px" }}>
                    <span style={{ padding:"2px 7px", borderRadius:4, fontSize:9.5, fontWeight:700, background:cls.bg, color:cls.color }}>{cls.label}</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr style={{ borderTop:`1px solid ${C.borderLight}` }}>
              <td colSpan={2} style={{ padding:"8px 10px", fontSize:10, color:tx3, fontStyle:"italic" }}>Total inventario</td>
              <td style={{ padding:"8px 10px", fontWeight:700, color:tx2 }}>
                {skuInventario.reduce((s,r)=>s+r.stockUnd,0).toLocaleString()} <span style={{ fontSize:9, color:tx3 }}>und</span>
              </td>
              <td style={{ padding:"8px 10px", fontWeight:800, color:C.blue, fontSize:11 }}>${totalStock.toLocaleString()}</td>
              <td colSpan={4} style={{ padding:"8px 10px", fontSize:10, color:tx3 }}>
                Sano: <span style={{ color:C.green, fontWeight:600 }}>{+(skuInventario.filter(r=>r.doh<90).reduce((s,r)=>s+r.stockUSD,0)/totalStock*100).toFixed(0)}%</span>
                &nbsp;·&nbsp;Riesgo: <span style={{ color:C.amber, fontWeight:600 }}>{+(skuInventario.filter(r=>r.doh>=90&&r.doh<=120).reduce((s,r)=>s+r.stockUSD,0)/totalStock*100).toFixed(0)}%</span>
                &nbsp;·&nbsp;Sobrestock: <span style={{ color:C.red, fontWeight:600 }}>{+(skuInventario.filter(r=>r.doh>120).reduce((s,r)=>s+r.stockUSD,0)/totalStock*100).toFixed(0)}%</span>
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </DrillInvBase>
  );
}

// ── 4.2 Inmovilizado — capital detenido (+60d sin movimiento)
function DrillInmovilizado({ onClose }) {
  const items = [...skuInventario]
    .filter(r => r.diasSinVenta >= 60)
    .sort((a,b) => b.stockUSD - a.stockUSD);
  const totalInmov = items.reduce((s,r) => s+r.stockUSD, 0);
  const totalStock = skuInventario.reduce((s,r) => s+r.stockUSD, 0);
  const totalUnds  = items.reduce((s,r) => s+r.stockUnd, 0);
  let acum = 0;
  const withPareto = items.map(r => {
    acum += r.stockUSD;
    return { ...r, pctPart:+((r.stockUSD/totalInmov)*100).toFixed(1), pctAcum:+((acum/totalInmov)*100).toFixed(1) };
  });

  return (
    <DrillInvBase
      title="Inventario Inmovilizado"
      subtitle="— Capital detenido · +60 días sin movimiento"
      accentColor={C.amber}
      onClose={onClose}
      insight={`${items.length} SKU${items.length>1?"s":""} sin movimiento · ${fmtUSD(totalInmov)} detenidos · ${+(totalInmov/totalStock*100).toFixed(1)}% del stock total`}>
      <div style={{ overflowX:"auto" }}>
        <table style={{ width:"100%", minWidth:560, borderCollapse:"collapse", fontSize:11 }}>
          <thead>
            <tr style={{ borderBottom:`1px solid ${C.border}` }}>
              <th style={{ ...thBd, color:tx3, width:28 }}>#</th>
              <th style={{ ...thBd, color:txH }}>SKU</th>
              <th style={{ ...thBd, color:tx2 }}>Unidades</th>
              <th style={{ ...thBd, color:C.amber }}>Stock ($)</th>
              <th style={{ ...thBd, color:tx2 }}>Días sin mov.</th>
              <th style={{ ...thBd, color:tx2 }}>DOH</th>
              <th style={{ ...thBd, color:tx2 }}>% Part.</th>
            </tr>
          </thead>
          <tbody>
            {withPareto.map((r,i) => (
              <tr key={i} style={{ borderBottom:`1px solid ${C.border}` }}
                onMouseEnter={e=>e.currentTarget.style.background=C.surfaceAlt}
                onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                <td style={{ padding:"8px 10px", color:tx3, fontSize:10 }}>{i+1}</td>
                <td style={{ padding:"8px 10px", fontWeight:700, color:tx1, whiteSpace:"nowrap" }}>{r.sku}</td>
                {/* Unidades */}
                <td style={{ padding:"8px 10px" }}>
                  <span style={{ fontWeight:600, color:tx2 }}>{r.stockUnd.toLocaleString()}</span>
                  <span style={{ fontSize:9, color:tx3, marginLeft:4 }}>und</span>
                </td>
                {/* Stock $ con sparkline */}
                <td style={{ padding:"8px 10px" }}>
                  <span style={{ fontWeight:700, color:C.amber }}>${r.stockUSD.toLocaleString()}</span>
                  <div style={{ height:2, background:C.border, borderRadius:2, marginTop:3, width:52 }}>
                    <div style={{ height:"100%", width:`${(r.stockUSD/items[0].stockUSD)*100}%`, background:C.amber, borderRadius:2, opacity:0.65 }}/>
                  </div>
                </td>
                {/* Días sin movimiento — semáforo */}
                <td style={{ padding:"8px 10px" }}>
                  <span style={{ fontWeight:700, color:r.diasSinVenta>=90?C.red:r.diasSinVenta>=60?C.amber:C.textSub }}>
                    {r.diasSinVenta}d
                  </span>
                </td>
                {/* DOH */}
                <td style={{ padding:"8px 10px", fontWeight:700, color:r.doh>120?C.red:r.doh>=90?C.amber:C.textSub }}>
                  {r.doh}d
                </td>
                {/* % Participación + barra */}
                <td style={{ padding:"8px 10px" }}>
                  <div style={{ display:"flex", alignItems:"center", gap:7 }}>
                    <span style={{ fontWeight:600, color:tx2 }}>{r.pctPart}%</span>
                    <div style={{ height:4, width:38, background:C.border, borderRadius:2, flexShrink:0 }}>
                      <div style={{ height:"100%", width:`${Math.min(100,r.pctPart*1.8)}%`, background:C.amber, borderRadius:2, opacity:0.7 }}/>
                    </div>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr style={{ borderTop:`1px solid ${C.borderLight}` }}>
              <td colSpan={2} style={{ padding:"8px 10px", fontSize:10, color:tx3, fontStyle:"italic" }}>Total inmovilizado</td>
              <td style={{ padding:"8px 10px", fontWeight:700, color:tx2 }}>
                {totalUnds.toLocaleString()} <span style={{ fontSize:9, color:tx3 }}>und</span>
              </td>
              <td style={{ padding:"8px 10px", fontWeight:800, color:C.amber, fontSize:11 }}>${totalInmov.toLocaleString()}</td>
              <td colSpan={3} style={{ padding:"8px 10px", fontSize:10, color:tx3 }}>
                <span style={{ color:C.amber, fontWeight:600 }}>{+(totalInmov/totalStock*100).toFixed(1)}%</span> del stock total
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </DrillInvBase>
  );
}

// ── 4.3 DOH — productos más lentos
function DrillDOH({ onClose }) {
  const sorted = [...skuInventario].sort((a,b)=>b.doh-a.doh);
  const totalStock = skuInventario.reduce((s,r)=>s+r.stockUSD,0);

  return (
    <DrillInvBase title="Velocidad de Inventario" subtitle="— Productos más lentos (DOH desc)" accentColor={C.cyan} onClose={onClose}
      insight={"DOH > 90d = alerta · DOH > 120d = problema · umbral sano: < 90 días"}>
      <div style={{ overflowX:"auto" }}>
        <table style={{ width:"100%", minWidth:540, borderCollapse:"collapse", fontSize:11 }}>
          <thead>
            <tr style={{ borderBottom:`1px solid ${C.border}` }}>
              <th style={{ ...thBd, color:tx3, width:28 }}>#</th>
              <th style={{ ...thBd, color:txH }}>SKU</th>
              <th style={{ ...thBd, color:tx2 }}>Unidades</th>
              <th style={{ ...thBd, color:tx2 }}>Stock ($)</th>
              <th style={{ ...thBd, color:tx2 }}>% Stock 🔥</th>
              <th style={{ ...thBd, color:tx2 }}>Venta / día</th>
              <th style={{ ...thBd, color:C.cyan }}>DOH</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((r,i)=>{
              const pctStock = +((r.stockUSD/totalStock)*100).toFixed(1);
              return (
                <tr key={i} style={{ borderBottom:`1px solid ${C.border}`, background: r.doh>120?"rgba(244,63,94,0.03)":r.doh>=90?"rgba(245,158,11,0.03)":"transparent" }}
                  onMouseEnter={e=>e.currentTarget.style.background=C.surfaceAlt}
                  onMouseLeave={e=>e.currentTarget.style.background=r.doh>120?"rgba(244,63,94,0.03)":r.doh>=90?"rgba(245,158,11,0.03)":"transparent"}>
                  <td style={{ padding:"8px 10px", color:tx3, fontSize:10 }}>{i+1}</td>
                  <td style={{ padding:"8px 10px", fontWeight:700, color:tx1, whiteSpace:"nowrap" }}>{r.sku}</td>
                  {/* Unidades */}
                  <td style={{ padding:"8px 10px" }}>
                    <span style={{ fontWeight:600, color:tx2 }}>{r.stockUnd.toLocaleString()}</span>
                    <span style={{ fontSize:9, color:tx3, marginLeft:4 }}>und</span>
                  </td>
                  {/* Stock ($) */}
                  <td style={{ padding:"8px 10px", fontWeight:600, color:tx2 }}>${r.stockUSD.toLocaleString()}</td>
                  {/* % Stock con barra */}
                  <td style={{ padding:"8px 10px" }}>
                    <div style={{ display:"flex", alignItems:"center", gap:7 }}>
                      <span style={{ fontWeight:700, color:tx1 }}>{pctStock}%</span>
                      <div style={{ height:4, width:40, background:C.border, borderRadius:2, flexShrink:0 }}>
                        <div style={{ height:"100%", width:`${Math.min(100,pctStock*5)}%`, background:C.cyan, borderRadius:2, opacity:0.6 }}/>
                      </div>
                    </div>
                  </td>
                  {/* Venta / día */}
                  <td style={{ padding:"8px 10px", color:r.ventaDiaria>=2?C.green:r.ventaDiaria>=0.5?C.amber:C.red, fontWeight:600, whiteSpace:"nowrap" }}
                    title={fmtVentaDiariaExacto(r.ventaDiaria)}>
                    {fmtVentaDiaria(r.ventaDiaria)}
                  </td>
                  {/* DOH con barra */}
                  <td style={{ padding:"8px 10px" }}>
                    <div style={{ display:"flex", alignItems:"center", gap:7 }}>
                      <span style={{ fontWeight:800, fontSize:13, color:r.doh>120?C.red:r.doh>=90?C.amber:C.green }}>{r.doh}</span>
                      <span style={{ fontSize:9.5, color:tx3 }}>días</span>
                      <div style={{ height:4, width:40, background:C.border, borderRadius:2, flexShrink:0 }}>
                        <div style={{ height:"100%", width:`${Math.min(100,(r.doh/180)*100)}%`, background:r.doh>120?C.red:r.doh>=90?C.amber:C.green, borderRadius:2, opacity:0.75 }}/>
                      </div>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr style={{ borderTop:`1px solid ${C.borderLight}` }}>
              <td colSpan={2} style={{ padding:"8px 10px", fontSize:10, color:tx3, fontStyle:"italic" }}>Total</td>
              <td style={{ padding:"8px 10px", fontWeight:700, color:tx2 }}>
                {skuInventario.reduce((s,r)=>s+r.stockUnd,0).toLocaleString()} <span style={{ fontSize:9, color:tx3 }}>und</span>
              </td>
              <td style={{ padding:"8px 10px", fontWeight:800, color:tx2, fontSize:11 }}>${totalStock.toLocaleString()}</td>
              <td style={{ padding:"8px 10px", fontWeight:700, color:C.cyan }}>100%</td>
              <td style={{ padding:"8px 10px" }}></td>
              <td style={{ padding:"8px 10px", fontSize:10, color:tx3 }}>
                DOH prom.: <span style={{ color:C.cyan, fontWeight:700 }}>{Math.round(skuInventario.reduce((s,r)=>s+r.doh,0)/skuInventario.length)}d</span>
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </DrillInvBase>
  );
}

// ── 4.4 Sobrestock — exceso real (DOH > 90d)
function DrillSobrestock({ onClose }) {
  const items = [...skuInventario]
    .filter(r=>r.doh>=90)
    .sort((a,b)=>b.stockUSD-a.stockUSD);
  const totalExceso = items.reduce((s,r)=>s+r.stockUSD,0);
  const totalStock  = skuInventario.reduce((s,r)=>s+r.stockUSD,0);
  const problema    = items.filter(r=>r.doh>120);
  const riesgo      = items.filter(r=>r.doh>=90&&r.doh<=120);
  let acum=0;
  const withPareto  = items.map(r=>{ acum+=r.stockUSD; return { ...r, pctPart:+((r.stockUSD/totalExceso)*100).toFixed(1), pctAcum:+((acum/totalExceso)*100).toFixed(1) }; });

  return (
    <DrillInvBase title="Exceso de Inventario" subtitle="— SKUs con DOH ≥ 90 días" accentColor={C.red} onClose={onClose}
      insight={`Problema >120d: ${problema.length} SKU · Riesgo 90–120d: ${riesgo.length} SKU · ${+(totalExceso/totalStock*100).toFixed(1)}% del stock total`}>
      <div style={{ overflowX:"auto" }}>
        <table style={{ width:"100%", minWidth:580, borderCollapse:"collapse", fontSize:11 }}>
          <thead>
            <tr style={{ borderBottom:`1px solid ${C.border}` }}>
              <th style={{ ...thBd, color:tx3, width:28 }}>#</th>
              <th style={{ ...thBd, color:txH }}>SKU</th>
              <th style={{ ...thBd, color:tx2 }}>Unidades</th>
              <th style={{ ...thBd, color:C.red }}>Stock ($)</th>
              <th style={{ ...thBd, color:tx2 }}>DOH</th>
              <th style={{ ...thBd, color:tx2 }}>% Part.</th>
              <th style={{ ...thBd, color:tx2 }}>% Acum.</th>
              <th style={{ ...thBd, color:tx2 }}>Clasificación</th>
            </tr>
          </thead>
          <tbody>
            {withPareto.map((r,i)=>{
              const cls = clsDOH(r.doh);
              return (
                <tr key={i} style={{ borderBottom:`1px solid ${C.border}`, background:r.doh>120?"rgba(244,63,94,0.04)":"rgba(245,158,11,0.03)" }}
                  onMouseEnter={e=>e.currentTarget.style.background=C.surfaceAlt}
                  onMouseLeave={e=>e.currentTarget.style.background=r.doh>120?"rgba(244,63,94,0.04)":"rgba(245,158,11,0.03)"}>
                  <td style={{ padding:"8px 10px", color:tx3, fontSize:10 }}>{i+1}</td>
                  <td style={{ padding:"8px 10px", fontWeight:700, color:tx1, whiteSpace:"nowrap" }}>{r.sku}</td>
                  <td style={{ padding:"8px 10px" }}>
                    <span style={{ fontWeight:600, color:tx2 }}>{r.stockUnd.toLocaleString()}</span>
                    <span style={{ fontSize:9, color:tx3, marginLeft:4 }}>und</span>
                  </td>
                  <td style={{ padding:"8px 10px" }}>
                    <span style={{ fontWeight:700, color:C.red }}>${r.stockUSD.toLocaleString()}</span>
                    <div style={{ height:2, background:C.border, borderRadius:2, marginTop:3, width:52 }}>
                      <div style={{ height:"100%", width:`${(r.stockUSD/items[0].stockUSD)*100}%`, background:C.red, borderRadius:2, opacity:0.6 }}/>
                    </div>
                  </td>
                  <td style={{ padding:"8px 10px", fontWeight:800, fontSize:12, color:r.doh>120?C.red:C.amber }}>{r.doh}d</td>
                  <td style={{ padding:"8px 10px", color:tx2, fontWeight:600 }}>{r.pctPart}%</td>
                  <td style={{ padding:"8px 10px" }}>
                    <span style={{ padding:"2px 7px", borderRadius:4, fontSize:10, fontWeight:700, background:r.pctAcum<=80?"rgba(244,63,94,0.12)":"transparent", color:r.pctAcum<=80?C.red:tx3 }}>{r.pctAcum}%</span>
                  </td>
                  <td style={{ padding:"8px 10px" }}>
                    <span style={{ padding:"2px 7px", borderRadius:4, fontSize:9.5, fontWeight:700, background:cls.bg, color:cls.color }}>{cls.label}</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr style={{ borderTop:`1px solid ${C.borderLight}` }}>
              <td colSpan={2} style={{ padding:"8px 10px", fontSize:10, color:tx3, fontStyle:"italic" }}>Total en exceso</td>
              <td style={{ padding:"8px 10px", fontWeight:700, color:tx2 }}>
                {items.reduce((s,r)=>s+r.stockUnd,0).toLocaleString()} <span style={{ fontSize:9, color:tx3 }}>und</span>
              </td>
              <td style={{ padding:"8px 10px", fontWeight:800, color:C.red, fontSize:11 }}>${totalExceso.toLocaleString()}</td>
              <td colSpan={4} style={{ padding:"8px 10px", fontSize:10, color:tx3 }}>
                <span style={{ color:C.red, fontWeight:600 }}>{+(totalExceso/totalStock*100).toFixed(1)}%</span> del stock total
                &nbsp;·&nbsp;<span style={{ color:C.red }}>Problema: ${problema.reduce((s,r)=>s+r.stockUSD,0).toLocaleString()}</span>
                &nbsp;·&nbsp;<span style={{ color:C.amber }}>Riesgo: ${riesgo.reduce((s,r)=>s+r.stockUSD,0).toLocaleString()}</span>
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </DrillInvBase>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// PARETO INVENTARIO — gráfico principal
// Modos: "total" (todos los SKUs) | "inmov" (+60d sin movimiento)
// Dimensiones: "sku" | "marca" | "sfamilia"
// ════════════════════════════════════════════════════════════════════════════
function ParetoInventario({ onSelectSku, skuDrillActivo }) {
  const [modo, setModo]   = useState("total");   // "total" | "inmov"
  const [dim,  setDim]    = useState("sku");      // "sku" | "marca" | "sfamilia"

  // Construir datos agrupados según dimensión y modo
  const paretoData = (() => {
    const base = modo === "inmov"
      ? skuInventario.filter(r => r.diasSinVenta >= 60)
      : skuInventario;

    let rows;
    if (dim === "sku") {
      rows = base.map(r => ({ nombre:r.sku, stockUSD:r.stockUSD, doh:r.doh }));
    } else if (dim === "marca") {
      const map = {};
      base.forEach(r => {
        if (!map[r.marca]) map[r.marca] = { nombre:r.marca, stockUSD:0, doh:0, cnt:0 };
        map[r.marca].stockUSD += r.stockUSD;
        map[r.marca].doh      += r.doh;
        map[r.marca].cnt      += 1;
      });
      rows = Object.values(map).map(r => ({ nombre:r.nombre, stockUSD:r.stockUSD, doh:Math.round(r.doh/r.cnt) }));
    } else {
      const map = {};
      base.forEach(r => {
        if (!map[r.sfamilia]) map[r.sfamilia] = { nombre:r.sfamilia, stockUSD:0, doh:0, cnt:0 };
        map[r.sfamilia].stockUSD += r.stockUSD;
        map[r.sfamilia].doh      += r.doh;
        map[r.sfamilia].cnt      += 1;
      });
      rows = Object.values(map).map(r => ({ nombre:r.nombre, stockUSD:r.stockUSD, doh:Math.round(r.doh/r.cnt) }));
    }

    const sorted = [...rows].sort((a,b) => b.stockUSD - a.stockUSD);
    const total  = sorted.reduce((s,r) => s + r.stockUSD, 0);
    let acum = 0;
    return sorted.map(r => {
      acum += r.stockUSD;
      return {
        ...r,
        pctPart: +((r.stockUSD / total) * 100).toFixed(1),
        pctAcum: +((acum / total) * 100).toFixed(1),
        total,
      };
    });
  })();

  const bloque80 = paretoData.filter(r => r.pctAcum <= 80);
  const accentColor = modo === "inmov" ? C.amber : C.blue;

  const modoLabel = modo === "total" ? "Inventario Total" : "Inventario Inmovilizado (+60d)";
  const insight   = bloque80.length
    ? `${bloque80.length} ${dim === "sku" ? "SKU" : dim === "marca" ? "marca" : "familia"}${bloque80.length>1?"s":""} concentran el 80% del ${modo==="inmov"?"capital inmovilizado":"inventario"}`
    : "";

  return (
    <Card>
      {/* Header */}
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:10 }}>
        <div>
          <p style={{ fontWeight:700, fontSize:12 }}>
            Pareto de Inventario
            <span style={{ fontWeight:400, color:accentColor, fontSize:11, marginLeft:8 }}>— {modoLabel}</span>
          </p>
          {insight && <p style={{ fontSize:10, color:"#c0c0c0", marginTop:2 }}>{insight}</p>}
        </div>
        <div style={{ display:"flex", gap:6, alignItems:"center", flexWrap:"wrap" }}>
          {/* Selector modo */}
          <div style={{ display:"flex", gap:3 }}>
            {[["total","Inventario total"],["inmov","Inmovilizado"]].map(([k,l])=>(
              <button key={k} onClick={()=>setModo(k)} style={{
                padding:"4px 11px", borderRadius:6, fontSize:10.5, fontWeight:600, cursor:"pointer",
                border:`1px solid ${modo===k?(k==="inmov"?C.amber:C.blue):C.border}`,
                background:modo===k?`rgba(${k==="inmov"?"245,158,11":"14,165,233"},0.1)`:"transparent",
                color:modo===k?(k==="inmov"?C.amber:C.blue):"#c0c0c0",
              }}>{l}</button>
            ))}
          </div>
          <div style={{ width:1, height:14, background:"#3d3d3d" }}/>
          {/* Selector dimensión */}
          <div style={{ display:"flex", gap:3 }}>
            {[["sku","SKU"],["marca","Marca"],["sfamilia","Familia"]].map(([k,l])=>(
              <button key={k} onClick={()=>setDim(k)} style={{
                padding:"4px 10px", borderRadius:6, fontSize:10, fontWeight:600, cursor:"pointer",
                border:`1px solid ${dim===k?"#00a8e8":C.border}`,
                background:dim===k?"rgba(0,168,232,0.08)":"transparent",
                color:dim===k?"#00a8e8":"#c0c0c0",
              }}>{l}</button>
            ))}
          </div>
        </div>
      </div>

      {/* Leyenda */}
      <div style={{ display:"flex", gap:16, marginBottom:8 }}>
        <span style={{ display:"flex", alignItems:"center", gap:5, fontSize:10, color:"#c0c0c0" }}>
          <span style={{ width:10, height:10, borderRadius:2, background:accentColor, display:"inline-block", opacity:0.85 }}/>
          Bloque 80%
        </span>
        <span style={{ display:"flex", alignItems:"center", gap:5, fontSize:10, color:"#c0c0c0" }}>
          <span style={{ width:10, height:10, borderRadius:2, background:"#707070", display:"inline-block" }}/>
          Resto
        </span>
        <span style={{ display:"flex", alignItems:"center", gap:5, fontSize:10, color:"#c0c0c0" }}>
          <span style={{ width:18, height:2, background:C.amber, display:"inline-block", borderRadius:2 }}/>
          % Acumulado
        </span>
      </div>

      {paretoData.length === 0 ? (
        <div style={{ height:168, display:"flex", alignItems:"center", justifyContent:"center" }}>
          <p style={{ color:"#707070", fontSize:11 }}>Sin productos con +60 días sin movimiento</p>
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={168}>
          <ComposedChart data={paretoData} margin={{ top:4, right:36, bottom:0, left:-10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={C.border} vertical={false}/>
            <XAxis dataKey="nombre" tick={false} axisLine={false} tickLine={false}/>
            <YAxis yAxisId="s" tick={{ fontSize:9, fill:"#c0c0c0" }} axisLine={false} tickLine={false} tickFormatter={v=>`$${v/1000}K`}/>
            <YAxis yAxisId="p" orientation="right" tick={{ fontSize:9, fill:"#c0c0c0" }} axisLine={false} tickLine={false} tickFormatter={v=>`${v}%`} domain={[0,100]}/>
            <Tooltip content={({ active, payload, label })=>{
              if (!active||!payload?.length) return null;
              const d = paretoData.find(x=>x.nombre===label)||{};
              return (
                <div style={{ background:"#0d0d0d", border:`1px solid #32195a`, borderRadius:8, padding:"9px 12px", fontSize:11 }}>
                  <p style={{ color:"#FFFFFF", fontWeight:700, marginBottom:4 }}>{label}</p>
                  <p style={{ color:accentColor }}>Stock: <strong>${d.stockUSD?.toLocaleString()}</strong></p>
                  <p style={{ color:"#c0c0c0" }}>% Participación: <strong>{d.pctPart}%</strong></p>
                  <p style={{ color:C.amber }}>% Acumulado: <strong>{d.pctAcum}%</strong></p>
                  {dim==="sku" && d.doh && <p style={{ color:d.doh>120?C.red:d.doh>=90?C.amber:C.green }}>DOH: <strong>{d.doh}d</strong></p>}
                </div>
              );
            }}/>
            <Bar yAxisId="s" dataKey="stockUSD" name="Stock $" radius={[3,3,0,0]} onClick={dim==="sku"?(d)=>onSelectSku(d.nombre):undefined} style={dim==="sku"?{cursor:"pointer"}:{}}>
              {paretoData.map((d,i)=>(
                <Cell key={i}
                  fill={skuDrillActivo===d.nombre ? C.cyan : d.pctAcum<=80 ? accentColor : "#707070"}
                  opacity={0.88}/>
              ))}
            </Bar>
            <Line yAxisId="p" type="monotone" dataKey="pctAcum" name="% Acumulado" stroke={C.amber} strokeWidth={2} dot={{ fill:C.amber, r:3 }} unit="%"/>
            <ReferenceLine yAxisId="p" y={80} stroke={C.amber} strokeDasharray="4 3" strokeOpacity={0.6}
              label={{ value:"80%", fill:C.amber, fontSize:9, position:"insideTopRight" }}/>
          </ComposedChart>
        </ResponsiveContainer>
      )}
    </Card>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// DRILL DOWN SKU — panel de análisis estructurado (4 bloques)
// Bloque 1: Resumen KPIs · Bloque 2: Evolución · Bloque 3: Causa · Bloque 4: Acción
// ════════════════════════════════════════════════════════════════════════════
function DrillSkuDetalle({ r, pctPart, nombreProd, accion, onClose }) {
  const t1="#FFFFFF", t2="#c0c0c0", t3="#707070";
  const stateColor = r.cls.color;

  // ── Ranking por stock (para contexto de relevancia)
  const sortedByStock = [...skuInventario].sort((a,b)=>b.stockUSD-a.stockUSD);
  const ranking       = sortedByStock.findIndex(x=>x.sku===r.sku) + 1;
  const totalStock    = skuInventario.reduce((s,x)=>s+x.stockUSD,0);

  // ── Clientes históricos del SKU (desde skusPorCliente)
  const clientesDelSku = Object.entries(skusPorCliente)
    .filter(([,skus]) => skus.some(s=>s.nombre===r.sku))
    .map(([cliente, skus]) => {
      const entry = skus.find(s=>s.nombre===r.sku);
      // días desde última compra: derivado de diasSinVenta del SKU + offset por orden de cliente
      const idx    = Object.keys(skusPorCliente).indexOf(cliente);
      const diasUlt = Math.round(r.diasSinVenta + idx * 11 + 8);
      return { cliente, unidades:entry.unidades, anterior:entry.unidadesAnt, diasUlt };
    })
    .sort((a,b)=>b.unidades-a.unidades);

  const totalUnds      = clientesDelSku.reduce((s,c)=>s+c.unidades,0)||1;
  const clientePrinc   = clientesDelSku[0];
  const pctPrinc       = clientePrinc ? +((clientePrinc.unidades/totalUnds)*100).toFixed(0) : 0;
  const diasPrinc      = clientePrinc?.diasUlt ?? 0;
  const clientesInact  = clientesDelSku.filter(c=>c.diasUlt>=60);

  // ── SKUs similares (misma sfamilia, mejor DOH)
  const similares = skuInventario
    .filter(x=>x.sfamilia===r.sfamilia && x.sku!==r.sku && x.doh < r.doh)
    .sort((a,b)=>a.doh-b.doh)
    .slice(0,2);

  // ── Datos evolución — siempre 12 meses
  const evoData = skuEvolucion[r.sku] || [
    { mes:"Ene", stock:Math.round(r.stockUSD*1.58), doh:Math.max(10,r.doh-48) },
    { mes:"Feb", stock:Math.round(r.stockUSD*1.50), doh:Math.max(10,r.doh-42) },
    { mes:"Mar", stock:Math.round(r.stockUSD*1.44), doh:Math.max(10,r.doh-36) },
    { mes:"Abr", stock:Math.round(r.stockUSD*1.38), doh:Math.max(10,r.doh-31) },
    { mes:"May", stock:Math.round(r.stockUSD*1.32), doh:Math.max(10,r.doh-26) },
    { mes:"Jun", stock:Math.round(r.stockUSD*1.26), doh:Math.max(10,r.doh-21) },
    { mes:"Jul", stock:Math.round(r.stockUSD*1.20), doh:Math.max(10,r.doh-17) },
    { mes:"Ago", stock:Math.round(r.stockUSD*1.14), doh:Math.max(10,r.doh-12) },
    { mes:"Sep", stock:Math.round(r.stockUSD*1.09), doh:Math.max(10,r.doh-8)  },
    { mes:"Oct", stock:Math.round(r.stockUSD*1.05), doh:Math.max(10,r.doh-5)  },
    { mes:"Nov", stock:Math.round(r.stockUSD*1.02), doh:Math.max(10,r.doh-2)  },
    { mes:"Dic", stock:r.stockUSD,                  doh:r.doh                  },
  ];

  // ── Tendencia de DOH (¿empeorando?)
  const dohInicial  = evoData[0].doh;
  const dohFinal    = evoData[evoData.length-1].doh;
  const dohSubiendo = dohFinal > dohInicial;
  const dohDelta    = dohFinal - dohInicial;

  // ── Diagnóstico automático basado en datos reales
  const generarDiagnostico = () => {
    const partes = [];
    if (r.doh > 120)   partes.push(`DOH de ${r.doh} días — sobrestock crítico`);
    else if (r.doh>=90) partes.push(`DOH de ${r.doh} días — nivel de riesgo`);
    if (dohSubiendo && dohDelta > 10) partes.push(`DOH aumentó ${dohDelta}d en el año`);
    if (clientePrinc && diasPrinc >= 60) partes.push(`${clientePrinc.cliente} (${pctPrinc}% del consumo) sin compras hace ${diasPrinc} días`);
    else if (clientePrinc) partes.push(`cliente principal: ${clientePrinc.cliente} con ${pctPrinc}% del consumo`);
    if (clientesInact.length > 1) partes.push(`${clientesInact.length} clientes inactivos`);
    if (r.diasSinVenta >= 60) partes.push(`${r.diasSinVenta} días sin movimiento`);
    return partes.length ? partes.join(". ") + "." : "Producto sin alertas significativas.";
  };

  const generarAccion = () => {
    if (r.doh > 120 && diasPrinc >= 60 && clientePrinc)
      return `Caída sostenida de demanda. ${clientePrinc.cliente}, principal comprador (${pctPrinc}%), no registra compras en ${diasPrinc} días. Se recomienda activar promoción o ajustar precio para acelerar la rotación y recuperar capital.`;
    if (r.doh > 120)
      return `Sobrestock crítico con DOH ${r.doh}d. Sin demanda activa suficiente para liquidar en tiempo razonable. Se recomienda redistribuir a bodegas con mayor rotación o aplicar descuento directo.`;
    if (r.doh >= 90 && dohSubiendo)
      return `DOH en tendencia alcista (+${dohDelta}d en 6 meses). Señal de desaceleración de demanda antes de entrar en zona crítica. Se recomienda impulsar ventas en canales activos y revisar precio.`;
    if (clientesInact.length >= 2)
      return `Múltiples clientes inactivos (${clientesInact.map(c=>c.cliente).join(", ")}). La demanda se redujo de forma transversal. Se recomienda analizar causas de mercado y evaluar acción comercial.`;
    return `Inventario en nivel manejable. Mantener reposición actual y monitorear evolución del DOH. Evaluar escalar en ${similares.length ? similares[0].sku : "canales con mejor rotación"}.`;
  };

  // ── Botones inteligentes según estado
  const botonesAccion = (() => {
    const btns = [];
    if (clientesInact.length > 0)
      btns.push({ label:`Clientes inactivos (${clientesInact.length})`, sub:"Última compra +60d", color:C.red });
    if (similares.length > 0)
      btns.push({ label:"Comparar similares", sub:`${similares[0].sku} — DOH ${similares[0].doh}d`, color:C.cyan });
    if (r.doh > 90)
      btns.push({ label:"Simular ajuste de precio", sub:"Impacto estimado en rotación", color:C.amber });
    if (r.doh > 120)
      btns.push({ label:"Redistribuir stock", sub:`Bodega: ${r.bodega}`, color:C.indigo });
    return btns.slice(0,4);
  })();

  return (
    <div style={{ background:"#070c14", border:`1px solid ${stateColor}40`, borderRadius:10, overflow:"hidden", animation:"fadeSlideDown 0.2s ease" }}>

      {/* ── Header */}
      <div style={{ padding:"13px 18px 11px", background:`linear-gradient(90deg,${stateColor}14,transparent 60%)`, borderBottom:`1px solid ${C.border}`, display:"flex", alignItems:"center", justifyContent:"space-between" }}>
        <div style={{ display:"flex", alignItems:"center", gap:12 }}>
          <span style={{ width:4, height:38, borderRadius:2, background:stateColor, flexShrink:0, display:"inline-block" }}/>
          <div>
            <div style={{ display:"flex", alignItems:"center", gap:10, flexWrap:"wrap" }}>
              <span style={{ fontWeight:800, fontSize:14, color:C.cyan, letterSpacing:"-0.3px" }}>{r.sku}</span>
              <span style={{ color:t2, fontSize:12 }}>{nombreProd[r.sku]||r.sfamilia}</span>
              <span style={{ fontWeight:700, color:C.blue, fontSize:13 }}>{fmtUSD(r.stockUSD)}</span>
              <span style={{ color:t3, fontSize:11 }}>({pctPart}%)</span>
              <span style={{ padding:"2px 8px", borderRadius:4, fontSize:10, fontWeight:700, background:`${stateColor}18`, color:stateColor }}>{r.cls.nivel}</span>
            </div>
            {/* Contexto de relevancia */}
            <p style={{ fontSize:10, color:t3, marginTop:4 }}>
              <span style={{ color:stateColor, fontWeight:600 }}>#{ranking} en capital detenido</span>
              {" · "}Representa el <span style={{ color:t2, fontWeight:600 }}>{pctPart}%</span> del inventario total
              {dohSubiendo && dohDelta>5 && <span style={{ color:C.red, marginLeft:8, fontWeight:600 }}>· DOH +{dohDelta}d en el año</span>}
            </p>
          </div>
        </div>
        <button onClick={onClose} style={{ background:"transparent", border:`1px solid ${C.border}`, color:t2, borderRadius:5, padding:"3px 10px", fontSize:11, cursor:"pointer" }}>✕</button>
      </div>

      <div style={{ padding:"15px 18px", display:"flex", flexDirection:"column", gap:15 }}>

        {/* ── Bloque 1: KPIs resumen */}
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(110px,1fr))", gap:8 }}>
          {[
            { label:"Bodega",      value:r.bodega,                        col:t1 },
            { label:"Unidades",    value:`${r.stockUnd} und`,             col:t1 },
            { label:"Stock ($)",   value:`$${r.stockUSD.toLocaleString()}`,col:C.blue },
            { label:"% Part.",     value:`${pctPart}%`,                   col:t2 },
            { label:"DOH",         value:`${r.doh} días`,                 col:r.doh>120?C.red:r.doh>=90?C.amber:C.green,  border:r.doh>120?`1px solid ${C.red}30`:r.doh>=90?`1px solid ${C.amber}30`:`1px solid ${C.border}` },
            { label:"Sin movim.",  value:`${r.diasSinVenta} días`,        col:r.diasSinVenta>=60?C.red:r.diasSinVenta>=30?C.amber:C.green },
            { label:"Margen",      value:`${r.margenPct}%`,               col:r.margenPct>=30?C.green:r.margenPct>=20?C.amber:C.red },
            { label:"Marca",       value:r.marca,                         col:t2 },
          ].map((item,j)=>(
            <div key={j} style={{ background:"#0d0d0d", border:item.border||`1px solid ${C.border}`, borderRadius:7, padding:"9px 11px" }}>
              <p style={{ fontSize:8.5, color:t3, textTransform:"uppercase", letterSpacing:"0.5px", marginBottom:4 }}>{item.label}</p>
              <p style={{ fontSize:12, fontWeight:700, color:item.col }}>{item.value}</p>
            </div>
          ))}
        </div>

        {/* ── Bloques 2 + (3+4) en grid */}
        <div style={{ display:"grid", gridTemplateColumns:"1.15fr 0.85fr", gap:15, alignItems:"start" }}>

          {/* ── Bloque 2: Evolución de demanda */}
          <div>
            <p style={{ fontSize:8.5, color:t3, textTransform:"uppercase", letterSpacing:"1px", fontWeight:700, marginBottom:8 }}>Evolución de demanda y cobertura</p>
            <div style={{ background:"#0d0d0d", border:`1px solid ${C.border}`, borderRadius:8, padding:"11px 10px 8px" }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8 }}>
                <p style={{ fontSize:9.5, color:t2 }}>Stock ($K) · DOH — Ene a Dic</p>
                <div style={{ display:"flex", gap:12 }}>
                  <span style={{ display:"flex", alignItems:"center", gap:4, fontSize:9.5, color:t3 }}>
                    <span style={{ width:10, height:10, borderRadius:2, background:`${C.blue}55`, display:"inline-block" }}/> Stock
                  </span>
                  <span style={{ display:"flex", alignItems:"center", gap:4, fontSize:9.5, color:t3 }}>
                    <span style={{ width:14, height:2, background:C.amber, display:"inline-block", borderRadius:2 }}/> DOH
                  </span>
                </div>
              </div>
              <ResponsiveContainer width="100%" height={140}>
                <ComposedChart data={evoData} margin={{ top:4, right:28, bottom:0, left:-10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={C.border} vertical={false}/>
                  <XAxis dataKey="mes" tick={{ fontSize:9, fill:t3 }} axisLine={false} tickLine={false}/>
                  <YAxis yAxisId="s" tick={{ fontSize:9, fill:t3 }} axisLine={false} tickLine={false} tickFormatter={v=>`$${(v/1000).toFixed(0)}K`}/>
                  <YAxis yAxisId="d" orientation="right" tick={{ fontSize:9, fill:t3 }} axisLine={false} tickLine={false} tickFormatter={v=>`${v}d`}/>
                  <Tooltip content={({ active, payload, label })=>{
                    if(!active||!payload?.length) return null;
                    return (
                      <div style={{ background:"#0d0d0d", border:`1px solid ${C.border}`, borderRadius:7, padding:"8px 11px", fontSize:10.5 }}>
                        <p style={{ color:t1, fontWeight:700, marginBottom:3 }}>{label}</p>
                        {payload.map((p,i)=>(
                          <p key={i} style={{ color:p.name==="DOH"?C.amber:C.blue }}>
                            {p.name}: <strong>{p.name==="DOH"?p.value+"d":"$"+(p.value/1000).toFixed(1)+"K"}</strong>
                          </p>
                        ))}
                      </div>
                    );
                  }}/>
                  <Bar yAxisId="s" dataKey="stock" name="Stock" radius={[3,3,0,0]} fill={`${C.blue}50`}/>
                  <Line yAxisId="d" type="monotone" dataKey="doh" name="DOH" stroke={C.amber} strokeWidth={2.5} dot={{ fill:C.amber, r:3 }}/>
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* ── Bloque 3 + 4 apilados */}
          <div style={{ display:"flex", flexDirection:"column", gap:12 }}>

            {/* ── Bloque 3: Clientes históricos */}
            <div>
              <p style={{ fontSize:8.5, color:t3, textTransform:"uppercase", letterSpacing:"1px", fontWeight:700, marginBottom:8 }}>Clientes históricos del SKU</p>
              <div style={{ background:"#0d0d0d", border:`1px solid ${C.border}`, borderRadius:8, overflow:"hidden" }}>
                <div style={{ display:"grid", gridTemplateColumns:"1fr 56px 72px", padding:"6px 12px", borderBottom:`1px solid ${C.border}` }}>
                  {["Cliente","% Compra","Sin comprar"].map(h=>(
                    <span key={h} style={{ fontSize:8, color:t3, textTransform:"uppercase", letterSpacing:"0.5px", fontWeight:600 }}>{h}</span>
                  ))}
                </div>
                {clientesDelSku.length ? clientesDelSku.map((c,i)=>{
                  const pct    = +((c.unidades/totalUnds)*100).toFixed(0);
                  const alerta = c.diasUlt >= 60;
                  const caida  = c.anterior > c.unidades;
                  return (
                    <div key={i} style={{ display:"grid", gridTemplateColumns:"1fr 56px 72px", padding:"7px 12px", borderBottom:i<clientesDelSku.length-1?`1px solid ${C.border}`:"none", alignItems:"center" }}>
                      <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                        <span style={{ width:6, height:6, borderRadius:"50%", background:alerta?C.red:pct>=40?C.cyan:t3, flexShrink:0, display:"inline-block" }}/>
                        <span style={{ fontWeight:600, color:alerta?C.red:t1, fontSize:10.5, whiteSpace:"nowrap" }}>{c.cliente}</span>
                        {caida && <span style={{ fontSize:8.5, color:C.amber, fontWeight:700 }}>▼</span>}
                      </div>
                      <span style={{ fontWeight:700, color:t1, fontSize:11 }}>{pct}%</span>
                      <span style={{ color:alerta?C.red:t2, fontSize:10, fontWeight:alerta?600:400 }}>{c.diasUlt}d</span>
                    </div>
                  );
                }) : (
                  <div style={{ padding:"12px", color:t3, fontSize:10, fontStyle:"italic" }}>Sin historial disponible</div>
                )}
              </div>
              {/* Insight automático de causa */}
              {clientePrinc && (
                <div style={{ marginTop:8, padding:"8px 11px", background:"#0d0d0d", borderRadius:7, borderLeft:`3px solid ${diasPrinc>=60?C.red:C.amber}` }}>
                  <p style={{ fontSize:10, color:t2, lineHeight:1.55 }}>
                    {diasPrinc>=60
                      ? <><span style={{ color:C.red, fontWeight:700 }}>{clientePrinc.cliente}</span> ({pctPrinc}% del consumo) no compra hace <span style={{ color:C.red, fontWeight:700 }}>{diasPrinc} días</span>.</>
                      : <><span style={{ color:C.cyan, fontWeight:700 }}>{clientePrinc.cliente}</span> concentra el <span style={{ fontWeight:700 }}>{pctPrinc}%</span> de la demanda histórica.</>
                    }
                  </p>
                </div>
              )}
            </div>

            {/* ── Bloque 4: Botones ADI */}
            <div>
              <p style={{ fontSize:8.5, color:t3, textTransform:"uppercase", letterSpacing:"1px", fontWeight:700, marginBottom:8 }}>Consultar a ADI</p>
              <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
                {[
                  { key:"que_hago",   label:"¿Qué hago con esto?",  color:C.violet, icon:"▶" },
                  { key:"por_que",    label:"¿Por qué pasa esto?",  color:C.amber,  icon:"?" },
                ].map(btn=>(
                  <button key={btn.key}
                    onClick={()=>{
                      const ctx = `Eres ADI. Interpreta este producto de inventario basándote solo en los datos. No inventes causas. Lenguaje simple de negocio. Sin "probablemente" ni "quizás".

DATOS:
SKU: ${r.sku} (${nombreProd[r.sku]||r.sfamilia})
Estado: ${r.cls.nivel} | Stock: ${r.stockUnd} und / $${r.stockUSD.toLocaleString()} | Días de stock: ${r.doh}d
Sin movimiento: ${r.diasSinVenta}d | Bodega: ${r.bodega} | Marca: ${r.marca} | Margen: ${r.margenPct}%

Responde con 4 bloques separados por línea vacía, título en mayúsculas seguido de dos puntos. Máximo 2 líneas por bloque:
RESUMEN:
LECTURA DEL RESULTADO:
IMPLICANCIA PARA EL NEGOCIO:
SIGUIENTE FOCO:`;
                      window.dispatchEvent(new CustomEvent("adi:pregunta-cobertura", { detail:{ context:ctx } }));
                    }}
                    style={{ padding:"7px 11px", borderRadius:6, fontSize:10, fontWeight:600, cursor:"pointer", border:`1px solid ${btn.color}45`, background:`${btn.color}10`, color:btn.color, display:"flex", alignItems:"center", gap:6, transition:"all 0.15s" }}
                    onMouseEnter={e=>e.currentTarget.style.background=`${btn.color}22`}
                    onMouseLeave={e=>e.currentTarget.style.background=`${btn.color}10`}>
                    <span>{btn.icon}</span> {btn.label}
                  </button>
                ))}
              </div>
            </div>

          </div>
        </div>

      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// FOCO DE INVENTARIO — tabla operativa + ejecutiva
// Búsqueda: SKU, nombre, marca
// Filtros: Bodega · Superfamilia · Marca
// Dos modos: Operativo (inventario general) | KPI activo (productos relacionados)
// ════════════════════════════════════════════════════════════════════════════
const BODEGAS_INV = ["Todas","Santiago","Valparaíso","Concepción","Antofagasta"];

function FocoInventario({ skuDrill, onSelectSku, kpiActivo, filtros }) {
  const [busqueda,    setBusqueda]    = useState("");
  const [filtroBodega,   setFiltroBodega]   = useState("Todas");
  const [filtroSfamilia, setFiltroSfamilia] = useState("Todas");
  const [filtroMarca,    setFiltroMarca]    = useState("Todas");
  const [seleccion,   setSeleccion]   = useState([]);

  // Sincronizar filtros globales con los selects internos cuando cambian
  useEffect(() => {
    if (filtros?.marcas?.length === 1)    setFiltroMarca(filtros.marcas[0]);
    else if (filtros?.marcas?.length === 0) setFiltroMarca("Todas");
    if (filtros?.sfamilias?.length === 1)  setFiltroSfamilia(filtros.sfamilias[0]);
    else if (filtros?.sfamilias?.length === 0) setFiltroSfamilia("Todas");
    if (filtros?.sucursales?.length === 1) setFiltroBodega(filtros.sucursales[0]);
    else if (filtros?.sucursales?.length === 0) setFiltroBodega("Todas");
  }, [filtros]);

  const tx1="#FFFFFF", tx2="#c0c0c0", tx3="#707070", txH="#c0c0c0";

  const MARCAS_INV = ["Todas",...[...new Set(skuInventario.map(r=>r.marca))]];
  const SFAM_INV   = ["Todas",...[...new Set(skuInventario.map(r=>r.sfamilia))]];

  // Nombre descriptivo del producto
  const nombreProd = {
    "SAM-REF500L":  "Refrigerador Samsung 500L",
    "LG-WASH11KG":  "Lavadora LG 11KG",
    "SAM-TV55":     "Samsung Smart TV 55\"",
    "LG-DRYER8KG":  "Secadora LG 8KG",
    "PHI-SHAVER9":  "Philips Shaver Series 9",
    "BOS-SANDER":   "Lijadora Bosch Orbital",
    "PHI-IRON-PRO": "Plancha Philips PerfectCare",
    "BOS-DRILL18V": "Taladro Bosch 18V Pro",
    "MAK-COMP-AIR": "Compresor Aire Makita",
    "SAM-MICRO32L": "Microondas Samsung 32L",
    "PHI-HAIR-PRO": "Secador de Pelo Philips Pro",
    "LG-AIR9000":   "Aire Acond. LG 9000 BTU",
    "MAK-SAW18V":   "Sierra Circular Makita 18V",
  };

  // Clasificación ejecutiva
  const clasificar = (doh) => {
    if (doh > 120) return { nivel:"Crítico", orden:0, color:C.red,   bg:"rgba(244,63,94,0.12)"  };
    if (doh >= 90) return { nivel:"Riesgo",  orden:1, color:C.amber, bg:"rgba(245,158,11,0.12)" };
    return              { nivel:"Sano",    orden:2, color:C.green, bg:"rgba(16,185,129,0.10)" };
  };

  // Filtrar según KPI activo (modo ejecutivo) o mostrar todo (modo operativo)
  const baseRows = (() => {
    let rows = skuInventario.map(r => ({ ...r, cls: clasificar(r.doh) }));
    if (kpiActivo === "cobertura")      rows = rows.filter(r => r.cls.nivel !== "Sano");
    if (kpiActivo === "capital_riesgo") rows = rows.filter(r => r.diasSinVenta >= 30 || r.doh >= 90);
    if (kpiActivo === "desalineacion")  rows = rows.filter(r => desalineacionKPI.rows.some(d=>d.sku===r.sku));
    if (kpiActivo === "concentracion")  rows = rows.filter(r => concentracionKPI.allRows.some(d=>d.sku===r.sku));
    return rows;
  })();

  // Aplicar filtros de búsqueda y selects
  const rows = baseRows
    .filter(r => {
      const q = busqueda.toLowerCase();
      if (q && !r.sku.toLowerCase().includes(q) && !(nombreProd[r.sku]||"").toLowerCase().includes(q) && !r.marca.toLowerCase().includes(q)) return false;
      if (filtroBodega !== "Todas" && r.bodega !== filtroBodega) return false;
      if (filtroSfamilia !== "Todas" && r.sfamilia !== filtroSfamilia) return false;
      if (filtroMarca !== "Todas" && r.marca !== filtroMarca) return false;
      return true;
    })
    .sort((a,b) => a.cls.orden !== b.cls.orden ? a.cls.orden - b.cls.orden : b.stockUSD - a.stockUSD);

  const totalStock = skuInventario.reduce((s,r)=>s+r.stockUSD,0);
  const totalVisible = rows.reduce((s,r)=>s+r.stockUSD,0);
  const totalValorizado = skuInventario.reduce((s,r)=>s + r.stockUnd*(SKU_PRICING[r.sku]?.cmp ?? Math.round(r.stockUSD/r.stockUnd)),0);

  // Stock según bodega seleccionada
  const getStock = (r) => filtroBodega !== "Todas" ? r.stockUnd : r.stockUnd;

  // Modo label
  const modoLabel = (() => {
    if (!kpiActivo) return "Inventario general";
    const labels = { cobertura:"Cobertura fuera de rango", capital_riesgo:"Capital en riesgo", desalineacion:"Desalineación", concentracion:"Concentración del problema" };
    return labels[kpiActivo] || "Inventario";
  })();

  // Toggle selección de fila para ADI
  const toggleSeleccion = (sku, e) => {
    e.stopPropagation();
    setSeleccion(prev => prev.includes(sku) ? prev.filter(s=>s!==sku) : [...prev, sku]);
  };

  // Contexto para ADI
  const buildAdiCtx = (tipo) => {
    const selRows = seleccion.length > 0
      ? rows.filter(r => seleccion.includes(r.sku))
      : rows.slice(0, 5);
    const resumen = selRows.map(r => `${r.sku} (${r.cls.nivel}, ${r.stockUnd} und, $${r.stockUSD.toLocaleString()}, ${r.doh}d stock)`).join("; ");
    const base = `Eres ADI. Interpreta este inventario basándote solo en los datos. No inventes causas. Lenguaje simple de negocio. Sin "probablemente" ni "quizás".

DATOS:
Vista activa: ${modoLabel}
Filtros: Bodega=${filtroBodega}, Categoría=${filtroSfamilia}, Marca=${filtroMarca}
Productos: ${resumen}

Responde con 4 bloques separados por línea vacía, título en mayúsculas seguido de dos puntos. Máximo 2 líneas por bloque:
RESUMEN:
LECTURA DEL RESULTADO:
IMPLICANCIA PARA EL NEGOCIO:
SIGUIENTE FOCO:`;
    return base;
  };

  const dispatchAdi = (tipo) => {
    window.dispatchEvent(new CustomEvent("adi:pregunta-cobertura", { detail: { context: buildAdiCtx(tipo) } }));
  };

  const thS = {
    textAlign:"left", padding:"8px 10px", fontSize:9, textTransform:"uppercase",
    letterSpacing:"0.5px", whiteSpace:"nowrap", fontWeight:600, color:txH,
    borderBottom:`1px solid ${C.border}`,
  };

  const hayFiltros = busqueda || filtroBodega!=="Todas" || filtroSfamilia!=="Todas" || filtroMarca!=="Todas";

  return (
    <Card>
      {/* ── Header */}
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:10, flexWrap:"wrap", gap:8 }}>
        <div>
          <p style={{ fontWeight:700, fontSize:12, color:tx1 }}>
            {kpiActivo ? "Productos relacionados con el KPI" : "Detalle de inventario"}
            <span style={{ fontWeight:400, color:kpiActivo?C.amber:C.textSub, fontSize:11, marginLeft:8 }}>— {modoLabel}</span>
          </p>
          <p style={{ fontSize:10, color:tx2, marginTop:2 }}>
            {rows.length} producto{rows.length!==1?"s":""} · {fmtUSD(totalVisible)} en stock
            {filtroBodega!=="Todas" && <span style={{ color:C.cyan, marginLeft:6 }}>· bodega: {filtroBodega}</span>}
            <span style={{ color:tx3, marginLeft:8 }}>
              Crítico: {rows.filter(r=>r.cls.nivel==="Crítico").length} &nbsp;·&nbsp;
              Riesgo: {rows.filter(r=>r.cls.nivel==="Riesgo").length} &nbsp;·&nbsp;
              Sano: {rows.filter(r=>r.cls.nivel==="Sano").length}
            </span>
          </p>
        </div>
      </div>

      {/* ── Búsqueda + Filtros siempre visibles */}
      <div style={{ display:"flex", gap:8, marginBottom:12, flexWrap:"wrap", alignItems:"center" }}>
        {/* Búsqueda */}
        <div style={{ position:"relative", flex:"1 1 180px", minWidth:160 }}>
          <span style={{ position:"absolute", left:9, top:"50%", transform:"translateY(-50%)", fontSize:11, color:tx3, pointerEvents:"none" }}>🔍</span>
          <input
            value={busqueda}
            onChange={e=>setBusqueda(e.target.value)}
            placeholder="Buscar producto, SKU o marca…"
            style={{ width:"100%", background:C.surfaceAlt, border:`1px solid ${busqueda?C.blue:C.border}`, borderRadius:6, padding:"6px 10px 6px 28px", fontSize:11, color:C.text, outline:"none", transition:"border-color 0.15s" }}
            onFocus={e=>e.target.style.borderColor=C.blue}
            onBlur={e=>e.target.style.borderColor=busqueda?C.blue:C.border}
          />
        </div>
        {/* Filtros */}
        {[
          { label:"Bodega", value:filtroBodega, options:BODEGAS_INV, set:setFiltroBodega, color:C.cyan },
          { label:"Categoría", value:filtroSfamilia, options:SFAM_INV, set:setFiltroSfamilia, color:C.indigo },
          { label:"Marca", value:filtroMarca, options:MARCAS_INV, set:setFiltroMarca, color:C.amber },
        ].map(f=>(
          <div key={f.label} style={{ display:"flex", alignItems:"center", gap:4 }}>
            <span style={{ fontSize:9, color:tx3, fontWeight:600, textTransform:"uppercase", letterSpacing:"0.4px", whiteSpace:"nowrap" }}>{f.label}</span>
            <select value={f.value} onChange={e=>f.set(e.target.value)}
              style={{ background:C.surfaceAlt, border:`1px solid ${f.value!=="Todas"?f.color:C.border}`, borderRadius:6, padding:"5px 8px", fontSize:10.5, color:f.value!=="Todas"?f.color:tx2, cursor:"pointer", outline:"none" }}>
              {f.options.map(o=><option key={o} value={o}>{o}</option>)}
            </select>
          </div>
        ))}
        {/* Limpiar filtros */}
        {hayFiltros && (
          <button onClick={()=>{ setBusqueda(""); setFiltroBodega("Todas"); setFiltroSfamilia("Todas"); setFiltroMarca("Todas"); }} style={{ fontSize:10, color:tx3, background:"transparent", border:`1px solid ${C.border}`, borderRadius:5, padding:"5px 9px", cursor:"pointer" }}>
            ✕ Limpiar
          </button>
        )}
      </div>

      {/* ── Tabla */}
      {rows.length === 0 ? (
        <div style={{ padding:"28px", textAlign:"center", color:tx3, fontSize:11, fontStyle:"italic" }}>
          Sin productos para los filtros seleccionados
        </div>
      ) : (
      <div style={{ overflowX:"auto", width:"100%" }}>
        <table style={{ width:"100%", minWidth:720, borderCollapse:"collapse", fontSize:11 }}>
          <thead>
            <tr>
              <th style={{ ...thS, width:28 }}></th>
              <th style={{ ...thS }}>Producto / SKU</th>
              <th style={{ ...thS }}>Marca</th>
              <th style={{ ...thS }}>Categoría</th>
              <th style={{ ...thS }}>Bodega</th>
              <th style={{ ...thS, color:C.blue }}>Stock actual</th>
              <th style={{ ...thS, color:C.blue }}>Stock valorizado</th>
              <th style={{ ...thS, color:C.cyan }}>Valor potencial venta</th>
              <th style={{ ...thS }}>Venta (mes)</th>
              <th style={{ ...thS }}>Días de stock</th>
              <th style={{ ...thS }}>$ Inventario</th>
              <th style={{ ...thS }}>Estado</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r,i) => {
              const isOpen    = skuDrill === r.sku;
              const isSel     = seleccion.includes(r.sku);
              const pctPart   = +((r.stockUSD / totalStock) * 100).toFixed(1);
              const trBg      = isOpen ? C.surfaceHover : isSel ? "rgba(14,165,233,0.05)" : i%2===0 ? "transparent" : C.surfaceAlt+"22";
              const ventaLabel = r.vendidoMes>=30 ? `${r.vendidoMes} und` : r.ventaDiaria<1 ? `Venta lenta (1 cada ${Math.round(1/Math.max(r.ventaDiaria,0.001))}d)` : `${r.vendidoMes} und`;

              return (
                <>
                  <tr key={r.sku}
                    style={{ borderBottom:`1px solid ${C.border}`, cursor:"pointer", background:trBg, transition:"background 0.1s", outline:isSel?`1px solid ${C.blue}30`:undefined }}
                    onClick={()=>onSelectSku(isOpen ? null : r.sku)}
                    onMouseEnter={e=>{ if(!isOpen) e.currentTarget.style.background=C.surfaceAlt; }}
                    onMouseLeave={e=>{ if(!isOpen) e.currentTarget.style.background=trBg; }}>

                    {/* Checkbox selección */}
                    <td style={{ padding:"9px 8px" }} onClick={e=>toggleSeleccion(r.sku,e)}>
                      <div style={{ width:14, height:14, borderRadius:3, border:`1px solid ${isSel?C.blue:C.border}`, background:isSel?"rgba(14,165,233,0.2)":"transparent", display:"flex", alignItems:"center", justifyContent:"center" }}>
                        {isSel && <span style={{ fontSize:9, color:C.blue, fontWeight:700 }}>✓</span>}
                      </div>
                    </td>

                    {/* Producto / SKU */}
                    <td style={{ padding:"9px 10px" }}>
                      <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                        <span style={{ width:3, height:22, borderRadius:2, background:r.cls.color, flexShrink:0, display:"inline-block" }}/>
                        <div>
                          <span style={{ fontWeight:700, color:isOpen?C.cyan:tx1, whiteSpace:"nowrap", display:"block" }}>{r.sku}</span>
                          <span style={{ fontSize:9.5, color:tx3 }}>{nombreProd[r.sku]||r.sfamilia}</span>
                        </div>
                      </div>
                    </td>

                    {/* Marca */}
                    <td style={{ padding:"9px 10px", color:tx2, whiteSpace:"nowrap" }}>{r.marca}</td>

                    {/* Categoría */}
                    <td style={{ padding:"9px 10px", color:tx2, fontSize:10.5 }}>{r.sfamilia}</td>

                    {/* Bodega */}
                    <td style={{ padding:"9px 10px", color:tx3, fontSize:10.5 }}>{r.bodega}</td>

                    {/* Stock actual */}
                    <td style={{ padding:"9px 10px" }}>
                      <span style={{ fontWeight:700, color:C.blue }}>{getStock(r)} und</span>
                    </td>

                    {/* Stock valorizado */}
                    <td style={{ padding:"9px 10px" }}>
                      {(() => { const cmp = SKU_PRICING[r.sku]?.cmp ?? Math.round(r.stockUSD/r.stockUnd); const val = Math.round(r.stockUnd * cmp); const pct = +((val/totalValorizado)*100).toFixed(1); return (<>
                        <span style={{ fontWeight:700, color:C.indigo }}>${val.toLocaleString()}</span>
                        <span style={{ fontSize:9, color:tx3, marginLeft:3 }}>CMP ${cmp.toLocaleString()} · {pct}%</span>
                      </>); })()}
                    </td>

                    {/* Valor potencial de ventas = stockUnd × PPV */}
                    <td style={{ padding:"9px 10px" }}>
                      {(() => { const ppv = SKU_PRICING[r.sku]?.ppv ?? Math.round((r.stockUSD/r.stockUnd)/(1-r.margenPct/100)); return (<>
                        <span style={{ fontWeight:700, color:C.cyan }}>${Math.round(r.stockUnd * ppv).toLocaleString()}</span>
                        <span style={{ fontSize:9, color:tx3, marginLeft:3 }}>PPV ${ppv.toLocaleString()}</span>
                      </>); })()}
                    </td>

                    {/* Venta del último período */}
                    <td style={{ padding:"9px 10px", color:r.vendidoMes>=30?C.green:r.ventaDiaria<0.5?C.red:C.amber, fontWeight:600, fontSize:10, whiteSpace:"nowrap" }}>
                      {ventaLabel}
                    </td>

                    {/* Días de stock */}
                    <td style={{ padding:"9px 10px", fontWeight:700, color:r.doh>120?C.red:r.doh>=90?C.amber:C.green }}>
                      {r.doh}d
                    </td>

                    {/* $ Inventario */}
                    <td style={{ padding:"9px 10px" }}>
                      <span style={{ fontWeight:700, color:tx1 }}>${r.stockUSD.toLocaleString()}</span>
                      <span style={{ fontSize:9, color:tx3, marginLeft:3 }}>({pctPart}%)</span>
                    </td>

                    {/* Estado */}
                    <td style={{ padding:"9px 10px" }}>
                      <span style={{ padding:"2px 8px", borderRadius:4, fontSize:9.5, fontWeight:700, background:r.cls.bg, color:r.cls.color, whiteSpace:"nowrap" }}>
                        {r.cls.nivel}
                      </span>
                    </td>
                  </tr>

                  {/* Drill down */}
                  {isOpen && (
                    <tr key={r.sku+"_detail"} style={{ background:"#070c14" }}>
                      <td colSpan={12} style={{ padding:"12px 4px 4px" }}>
                        <DrillSkuDetalle
                          r={r}
                          pctPart={pctPart}
                          nombreProd={nombreProd}
                          accion={{ texto:"", color:r.cls.color }}
                          onClose={e=>{ e.stopPropagation(); onSelectSku(null); }}
                        />
                      </td>
                    </tr>
                  )}
                </>
              );
            })}
          </tbody>
          <tfoot>
            <tr style={{ borderTop:`1px solid ${C.borderLight}` }}>
              <td colSpan={5} style={{ padding:"8px 10px", fontSize:10, color:tx3, fontStyle:"italic" }}>
                {hayFiltros ? `${rows.length} producto${rows.length!==1?"s":""} filtrados` : `Total: ${rows.length} productos`}
              </td>
              <td style={{ padding:"8px 10px", fontWeight:700, color:C.blue }}>
                {rows.reduce((s,r)=>s+r.stockUnd,0).toLocaleString()} und
              </td>
              <td/>
              <td/>
              <td style={{ padding:"8px 10px", fontWeight:800, color:tx1, fontSize:11 }}>
                ${rows.reduce((s,r)=>s+r.stockUSD,0).toLocaleString()}
              </td>
              <td style={{ padding:"8px 10px", fontSize:9.5, color:tx3 }}>
                Sano <span style={{ color:C.green }}>{rows.filter(r=>r.cls.nivel==="Sano").length}</span> &nbsp;·&nbsp;
                Riesgo <span style={{ color:C.amber }}>{rows.filter(r=>r.cls.nivel==="Riesgo").length}</span> &nbsp;·&nbsp;
                Crítico <span style={{ color:C.red }}>{rows.filter(r=>r.cls.nivel==="Crítico").length}</span>
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
      )}
    </Card>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// DRILL DOWN — COBERTURA POR POLÍTICA
// Muestra por separado: SKUs en Sobrestock y SKUs en Riesgo de Quiebre
// Insight automático según distribución real de los datos
// ════════════════════════════════════════════════════════════════════════════
// ════════════════════════════════════════════════════════════════════════════
// DRILL DOWN — CONCENTRACIÓN DEL PROBLEMA
// Muestra en qué productos se concentra la mayor parte del impacto total.
// Lenguaje simple. Sin tecnicismos. Lógica Pareto interna, invisible al usuario.
// ════════════════════════════════════════════════════════════════════════════
function DrillConcentracion({ onClose }) {
  const [dim, setDim] = useState("sku"); // "sku" | "categoria" | "marca"

  const {
    pctConcentrado, pctProductos, isFocalizado,
    bloquePareto, allRows, totalImpacto, catDominante,
  } = concentracionKPI;

  // ── Agrupa por dimensión seleccionada
  const grouped = (() => {
    const src = allRows;
    if (dim === "sku") return src.map(r => ({
      nombre: r.sku, sub: NOMBRES_PROD[r.sku] || r.sfamilia,
      impTotal: r.impTotal, impCap: r.impCap, impDesalin: r.impDesalin,
      sfamilia: r.sfamilia, marca: r.marca,
    }));

    const map = {};
    src.forEach(r => {
      const key = dim === "categoria" ? r.sfamilia : r.marca;
      if (!map[key]) map[key] = { nombre:key, sub:"", impTotal:0, impCap:0, impDesalin:0 };
      map[key].impTotal   += r.impTotal;
      map[key].impCap     += r.impCap;
      map[key].impDesalin += r.impDesalin;
    });
    return Object.values(map).sort((a, b) => b.impTotal - a.impTotal);
  })();

  // Pareto sobre la dimensión activa
  const paretoRows = (() => {
    const total = grouped.reduce((s, r) => s + r.impTotal, 0);
    let acum = 0;
    const bloque = [];
    for (const r of grouped) {
      bloque.push({ ...r, pctAcum: 0 });
      acum += r.impTotal;
      bloque[bloque.length - 1].pctAcum = total > 0 ? +((acum / total) * 100).toFixed(0) : 0;
      if (total > 0 && (acum / total) * 100 >= 80) break;
    }
    return { visible: bloque.slice(0, 10), hiddenCount: Math.max(0, bloque.length - 10), total };
  })();

  // ── Resumen en lenguaje simple
  const resumen = isFocalizado
    ? `La mayor parte del problema está en pocos productos. El ${pctConcentrado}% del impacto está concentrado en solo el ${pctProductos}% del inventario.${catDominante ? ` La categoría más afectada es ${catDominante[0]}.` : ""}`
    : `El problema está bastante repartido en el inventario. El ${pctConcentrado}% del impacto está distribuido en el ${pctProductos}% de los productos.${catDominante ? ` La categoría con más peso es ${catDominante[0]}.` : ""}`;

  // ── Contexto para ADI
  const topProds = bloquePareto.slice(0, 4).map(r =>
    `${r.sku} ($${r.impTotal.toLocaleString()})`
  ).join(", ");
  const adiPreguntas = {
    que_hago:      `El ${pctConcentrado}% del problema en mi inventario está concentrado en el ${pctProductos}% de los productos. ${isFocalizado ? "Está muy focalizado." : "Está bastante distribuido."} Productos principales: ${topProds}. ¿Qué haría primero para reducir el impacto total?`,
    por_que:       `¿Por qué el problema de inventario está ${isFocalizado ? "tan concentrado en pocos productos" : "tan distribuido en el inventario"}? ${resumen} ¿Qué causas lo explican y cómo evitarlo?`,
    por_categorias:`El problema de inventario tiene un impacto total de $${totalImpacto.toLocaleString()}. ¿Puedes analizar cómo se reparte por categoría y cuál debería ser la primera en atenderse?`,
  };

  const dispatchAdi = (tipo) => {
    window.dispatchEvent(new CustomEvent("adi:pregunta-concentracion", { detail: { context: adiPreguntas[tipo] } }));
    onClose();
  };

  return (
    <DrillInvBase
      title="¿Dónde está concentrado el problema?"
      subtitle={isFocalizado ? "— El impacto está focalizado en pocos productos" : "— El impacto está distribuido en varios productos"}
      accentColor={C.green}
      onClose={onClose}
      insight={resumen}
    >

      {/* ── Chips de impacto */}
      <div style={{ display:"flex", gap:10, marginBottom:16, flexWrap:"wrap" }}>
        {[
          {
            label: isFocalizado ? "Concentrado en pocos" : "Distribuido en varios",
            val:   `${pctConcentrado}%`,
            sub:   "del impacto total",
            color: isFocalizado ? C.red : C.amber,
          },
          {
            label: "Del inventario afectado",
            val:   `${pctProductos}%`,
            sub:   isFocalizado ? "en el bloque crítico" : "con algún impacto",
            color: C.textSub,
          },
          {
            label: "Impacto total estimado",
            val:   `$${totalImpacto.toLocaleString()}`,
            sub:   "Capital en Riesgo + Desalineación",
            color: C.blue,
          },
          catDominante && {
            label: "Categoría con más peso",
            val:   catDominante[0],
            sub:   `$${catDominante[1].toLocaleString()} en impacto`,
            color: C.textSub,
          },
        ].filter(Boolean).map((item, i) => (
          <div key={i} style={{ background:"#0d0d0d", border:`1px solid ${item.color}28`, borderRadius:8, padding:"9px 14px", flex:"1 1 120px" }}>
            <p style={{ fontSize:8.5, color:tx3, textTransform:"uppercase", letterSpacing:"0.5px", marginBottom:3 }}>{item.label}</p>
            <p style={{ fontWeight:800, fontSize:14, color:item.color }}>{item.val}</p>
            <p style={{ fontSize:9, color:tx3, marginTop:2 }}>{item.sub}</p>
          </div>
        ))}
      </div>

      {/* ── Selector de dimensión */}
      <div style={{ display:"flex", gap:6, marginBottom:12, alignItems:"center" }}>
        <span style={{ fontSize:9.5, color:tx3, marginRight:4 }}>Ver por:</span>
        {[["sku","Producto"],["categoria","Categoría"],["marca","Marca"]].map(([k, l]) => (
          <button key={k} onClick={() => setDim(k)} style={{
            padding:"4px 12px", borderRadius:6, fontSize:10.5, fontWeight:600, cursor:"pointer",
            border:`1px solid ${dim===k ? "#00a8e8" : C.border}`,
            background: dim===k ? "rgba(0,168,232,0.1)" : "transparent",
            color: dim===k ? "#00a8e8" : tx2,
          }}>{l}</button>
        ))}
        {catDominante && (
          <span style={{ marginLeft:"auto", fontSize:9.5, color:tx3 }}>
            Más peso: <span style={{ color:tx2, fontWeight:600 }}>{catDominante[0]}</span>
          </span>
        )}
      </div>

      {/* ── Tabla: dónde está concentrado el problema */}
      <div style={{ marginBottom:14 }}>
        <p style={{ fontSize:10.5, color:tx2, fontWeight:700, marginBottom:8 }}>
          Dónde está concentrado el problema
          {paretoRows.visible.length > 0 && (
            <span style={{ fontWeight:400, color:tx3, marginLeft:8, fontSize:9.5 }}>
              — explican el {paretoRows.visible[paretoRows.visible.length-1]?.pctAcum || 0}% del impacto total
            </span>
          )}
        </p>
        <div style={{ overflowX:"auto" }}>
          <table style={{ width:"100%", minWidth:460, borderCollapse:"collapse", fontSize:11 }}>
            <thead>
              <tr style={{ borderBottom:`1px solid ${C.border}` }}>
                <th style={{ ...thBd, color:tx3, width:28 }}>#</th>
                <th style={{ ...thBd, color:txH }}>
                  {dim === "sku" ? "Producto" : dim === "categoria" ? "Categoría" : "Marca"}
                </th>
                <th style={{ ...thBd, color:"#00a8e8" }}>$ impacto</th>
                <th style={{ ...thBd, color:tx2 }}>Acumulado</th>
                <th style={{ ...thBd, color:tx2 }}>Estado</th>
              </tr>
            </thead>
            <tbody>
              {paretoRows.visible.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ padding:"18px 10px", color:tx3, fontSize:11, fontStyle:"italic", textAlign:"center" }}>
                    Sin datos de impacto disponibles
                  </td>
                </tr>
              ) : paretoRows.visible.map((r, i) => {
                const pctImp  = paretoRows.total > 0 ? +((r.impTotal / paretoRows.total) * 100).toFixed(0) : 0;
                const isBloque = r.pctAcum <= 80;
                const rowCol   = isBloque ? (isFocalizado ? C.red : C.amber) : tx3;
                return (
                  <tr key={i}
                    style={{ borderBottom:`1px solid ${C.border}`, background: isBloque ? `${rowCol}04` : "transparent" }}
                    onMouseEnter={e => e.currentTarget.style.background = C.surfaceAlt}
                    onMouseLeave={e => e.currentTarget.style.background = isBloque ? `${rowCol}04` : "transparent"}>
                    <td style={{ padding:"8px 10px", color:tx3, fontSize:10 }}>{i+1}</td>
                    {/* Nombre */}
                    <td style={{ padding:"8px 10px" }}>
                      <span style={{ fontWeight:700, color:tx1, display:"block" }}>{r.nombre}</span>
                      {r.sub && <span style={{ fontSize:9.5, color:tx3 }}>{r.sub}</span>}
                    </td>
                    {/* Impacto con barra */}
                    <td style={{ padding:"8px 10px" }}>
                      <span style={{ fontWeight:700, color:C.green }}>${r.impTotal.toLocaleString()}</span>
                      <div style={{ display:"flex", alignItems:"center", gap:5, marginTop:3 }}>
                        <div style={{ height:3, width:50, background:C.border, borderRadius:2, flexShrink:0 }}>
                          <div style={{ height:"100%", width:`${pctImp}%`, background:C.green, borderRadius:2, opacity:0.6 }}/>
                        </div>
                        <span style={{ fontSize:8.5, color:tx3 }}>{pctImp}%</span>
                      </div>
                    </td>
                    {/* % acumulado */}
                    <td style={{ padding:"8px 10px" }}>
                      <span style={{
                        padding:"2px 7px", borderRadius:4, fontSize:10, fontWeight:700,
                        background: isBloque ? `${rowCol}18` : "transparent",
                        color: isBloque ? rowCol : tx3,
                      }}>{r.pctAcum}%</span>
                    </td>
                    {/* Estado */}
                    <td style={{ padding:"8px 10px" }}>
                      <span style={{
                        padding:"2px 8px", borderRadius:4, fontSize:9.5, fontWeight:700,
                        background: isBloque ? `${rowCol}14` : "transparent",
                        color: isBloque ? rowCol : tx3,
                      }}>
                        {isBloque ? "Mayor impacto" : "Menor impacto"}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            {paretoRows.visible.length > 0 && (
              <tfoot>
                <tr style={{ borderTop:`1px solid ${C.borderLight}` }}>
                  <td colSpan={2} style={{ padding:"7px 10px", fontSize:9.5, color:tx3, fontStyle:"italic" }}>
                    {paretoRows.hiddenCount > 0
                      ? `Los ${paretoRows.visible.length} de mayor impacto · ${paretoRows.hiddenCount} adicionales no mostrados`
                      : `Todos los ${dim === "sku" ? "productos" : dim === "categoria" ? "categorías" : "marcas"} con impacto`}
                  </td>
                  <td style={{ padding:"7px 10px", fontWeight:800, color:"#00a8e8", fontSize:11 }}>
                    ${paretoRows.visible.reduce((s, r) => s + r.impTotal, 0).toLocaleString()}
                  </td>
                  <td colSpan={2}/>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* ── Botones ADI */}
      <div style={{ borderTop:`1px solid ${C.border}`, paddingTop:12 }}>
        <p style={{ fontSize:9.5, color:tx3, marginBottom:10 }}>
          ADI puede explicar por qué el problema está {isFocalizado ? "concentrado en estos productos" : "tan distribuido"} y ayudarte a priorizar.
        </p>
        <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
          {[
            { key:"que_hago",      label:"¿Qué hago con esto?",              color:"#00a8e8",  icon:"▶" },
            { key:"por_que",       label:"¿Por qué está concentrado aquí?",  color:C.amber,  icon:"?" },
            { key:"por_categorias",label:"Ver por categorías",               color:C.cyan,   icon:"↗" },
          ].map(btn => (
            <button key={btn.key}
              onClick={() => dispatchAdi(btn.key)}
              style={{
                padding:"8px 16px", borderRadius:7, fontSize:11, fontWeight:700, cursor:"pointer",
                border:`1px solid ${btn.color}45`, background:`${btn.color}10`, color:btn.color,
                display:"flex", alignItems:"center", gap:6, transition:"all 0.15s",
              }}
              onMouseEnter={e => e.currentTarget.style.background = `${btn.color}20`}
              onMouseLeave={e => e.currentTarget.style.background = `${btn.color}10`}
            >
              <span style={{ fontSize:12 }}>{btn.icon}</span> {btn.label}
            </button>
          ))}
        </div>
      </div>

    </DrillInvBase>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// DRILL DOWN — DESALINEACIÓN COMERCIAL
// Productos donde el stock no coincide con la venta.
// Lógica Pareto por impacto en $. Lenguaje simple de negocio.
// ════════════════════════════════════════════════════════════════════════════
function DrillDesalineacion({ onClose }) {
  const {
    pctDesalin, montoTotal, montoExceso, montoSinStock,
    problema, exceso, sinStock, catDominante, totalStock,
  } = desalineacionKPI;

  const [tab, setTab] = useState(exceso.length >= sinStock.length ? "exceso" : "sin_stock");

  // ── Pareto dinámico sobre el tab activo, ordenado por impacto
  const tabRows  = tab === "exceso" ? exceso : sinStock;
  const tabMonto = tab === "exceso" ? montoExceso : montoSinStock;
  const tabColor = tab === "exceso" ? C.red : C.amber;

  const paretoResult = (() => {
    const sorted = [...tabRows].sort((a, b) => b.impacto - a.impacto);
    let acum = 0;
    const bloque = [];
    for (const r of sorted) {
      bloque.push(r);
      acum += r.impacto;
      if (tabMonto > 0 && (acum / tabMonto) * 100 >= 80) break;
    }
    const pctCovered  = tabMonto > 0 ? +((acum / tabMonto) * 100).toFixed(0) : 100;
    const visible     = bloque.slice(0, 10);
    const hiddenCount = bloque.length - visible.length;
    return { visible, hiddenCount, pctCovered, bloqueSize: bloque.length };
  })();

  // ── Resumen en lenguaje simple
  const resumen = (() => {
    if (montoExceso > 0 && montoSinStock > 0)
      return `Hay productos con demasiado stock que casi no se venden (${fmtUSD(montoExceso)} en dinero mal asignado), y otros que se venden bien pero con poco stock disponible (${fmtUSD(montoSinStock)} en ventas en riesgo).`;
    if (montoExceso > 0)
      return `Gran parte del inventario está concentrado en productos con baja venta. Hay ${fmtUSD(montoExceso)} en stock que no está siendo aprovechado al ritmo esperado.`;
    if (montoSinStock > 0)
      return `Algunos productos se venden bien pero tienen poco stock. Hay ${fmtUSD(montoSinStock)} en ventas que podrían perderse si no se repone a tiempo.`;
    return "El inventario está bien alineado con la venta. No se detectan desajustes significativos.";
  })();

  // ── Contexto para ADI — estructura universal
  const topRows = [...problema].sort((a, b) => b.impacto - a.impacto).slice(0, 4);
  const ctxBase = `Eres ADI. Interpreta esta desalineación de inventario basándote solo en los datos. No inventes causas. Lenguaje simple de negocio. Sin "probablemente" ni "quizás".

DATOS:
Inventario desalineado: ${pctDesalin}% del stock total
Exceso sin venta: ${fmtUSD(montoExceso)} | Poco stock con venta activa: ${fmtUSD(montoSinStock)}
${catDominante ? `Categoría más afectada: ${catDominante[0]}` : ""}
Productos con mayor impacto: ${topRows.map(r => `${r.sku} (${r.tipo === "exceso_sin_venta" ? "exceso" : "poco stock"}, ${fmtUSD(r.impacto)})`).join("; ")}

Responde con 4 bloques separados por línea vacía, título en mayúsculas seguido de dos puntos. Máximo 2 líneas por bloque:
RESUMEN:
LECTURA DEL RESULTADO:
IMPLICANCIA PARA EL NEGOCIO:
SIGUIENTE FOCO:`;

  const adiPreguntas = {
    que_hago:      ctxBase,
    por_que:       ctxBase,
    por_categorias:ctxBase,
  };

  const dispatchAdi = (tipo) => {
    window.dispatchEvent(new CustomEvent("adi:pregunta-desalineacion", { detail: { context: adiPreguntas[tipo] } }));
    onClose();
  };

  return (
    <DrillInvBase
      title="¿Dónde el stock no coincide con la venta?"
      subtitle="— Productos con stock y venta desalineados"
      accentColor={C.indigo}
      onClose={onClose}
      insight={resumen}
    >

      {/* ── Chips de impacto: solo $, sin conteo de SKU */}
      <div style={{ display:"flex", gap:10, marginBottom:16, flexWrap:"wrap" }}>
        {[
          { label:"Inventario desalineado",   val:`${pctDesalin}%`,        sub:`del stock total`,              color:C.indigo },
          { label:"Mucho stock, poca venta",  val:fmtUSD(montoExceso),     sub:"dinero mal asignado",          color:C.red,    hide:montoExceso===0   },
          { label:"Poca stock, alta venta",   val:fmtUSD(montoSinStock),   sub:"ventas en riesgo",             color:C.amber,  hide:montoSinStock===0 },
          { label:"Categoría más afectada",   val:catDominante?catDominante[0]:"—", sub:catDominante?fmtUSD(catDominante[1]):"", color:C.textSub },
        ].filter(x => !x.hide).map((item, i) => (
          <div key={i} style={{ background:"#0d0d0d", border:`1px solid ${item.color}28`, borderRadius:8, padding:"9px 14px", flex:"1 1 120px" }}>
            <p style={{ fontSize:8.5, color:tx3, textTransform:"uppercase", letterSpacing:"0.5px", marginBottom:3 }}>{item.label}</p>
            <p style={{ fontWeight:800, fontSize:14, color:item.color }}>{item.val}</p>
            <p style={{ fontSize:9, color:tx3, marginTop:2 }}>{item.sub}</p>
          </div>
        ))}
      </div>

      {/* ── Barra de composición visual */}
      {montoTotal > 0 && (
        <div style={{ marginBottom:16 }}>
          <div style={{ display:"flex", height:6, borderRadius:3, overflow:"hidden", gap:1 }}>
            {montoExceso > 0   && <div style={{ flex:montoExceso,   background:C.red,    opacity:0.75 }}/>}
            {montoSinStock > 0 && <div style={{ flex:montoSinStock, background:C.amber,  opacity:0.7  }}/>}
            <div style={{ flex:Math.max(totalStock - montoTotal, 1), background:C.border, opacity:0.5 }}/>
          </div>
          <div style={{ display:"flex", gap:14, marginTop:6 }}>
            {montoExceso   > 0 && <span style={{ display:"flex", alignItems:"center", gap:5, fontSize:9.5, color:tx3 }}><span style={{ width:8,height:8,borderRadius:2,background:C.red,opacity:0.75,flexShrink:0,display:"inline-block" }}/> Mucho stock, poca venta</span>}
            {montoSinStock > 0 && <span style={{ display:"flex", alignItems:"center", gap:5, fontSize:9.5, color:tx3 }}><span style={{ width:8,height:8,borderRadius:2,background:C.amber,opacity:0.7,flexShrink:0,display:"inline-block" }}/> Poca stock, alta venta</span>}
            <span style={{ display:"flex", alignItems:"center", gap:5, fontSize:9.5, color:tx3 }}><span style={{ width:8,height:8,borderRadius:2,background:C.border,flexShrink:0,display:"inline-block" }}/> Alineado</span>
          </div>
        </div>
      )}

      {/* ── Tabs */}
      <div style={{ display:"flex", gap:6, marginBottom:12, alignItems:"center" }}>
        {[
          ["exceso",    "Mucho stock, poca venta", montoExceso,   C.red  ],
          ["sin_stock", "Poca stock, alta venta",  montoSinStock, C.amber],
        ].filter(([,, m]) => m > 0).map(([k, l, m, col]) => (
          <button key={k} onClick={() => setTab(k)} style={{
            padding:"5px 13px", borderRadius:6, fontSize:11, fontWeight:600, cursor:"pointer",
            border:`1px solid ${tab===k ? col : C.border}`,
            background: tab===k ? `${col}18` : "transparent",
            color: tab===k ? col : tx2,
          }}>
            {l} · <span style={{ fontWeight:800 }}>{fmtUSD(m)}</span>
          </button>
        ))}
        {catDominante && (
          <span style={{ marginLeft:"auto", fontSize:9.5, color:tx3 }}>
            Más afectado: <span style={{ color:tx2, fontWeight:600 }}>{catDominante[0]}</span>
          </span>
        )}
      </div>

      {/* ── Tabla Pareto */}
      <div style={{ marginBottom:14 }}>
        <p style={{ fontSize:10.5, color:tx2, fontWeight:700, marginBottom:8 }}>
          Productos donde el stock no coincide con la venta
          {paretoResult.bloqueSize > 0 && (
            <span style={{ fontWeight:400, color:tx3, marginLeft:8, fontSize:9.5 }}>
              — explican el {paretoResult.pctCovered}% del problema
            </span>
          )}
        </p>
        <div style={{ overflowX:"auto" }}>
          <table style={{ width:"100%", minWidth:530, borderCollapse:"collapse", fontSize:11 }}>
            <thead>
              <tr style={{ borderBottom:`1px solid ${C.border}` }}>
                <th style={{ ...thBd, color:tx3, width:28 }}>#</th>
                <th style={{ ...thBd, color:txH }}>Producto</th>
                <th style={{ ...thBd, color:tx2 }}>Categoría</th>
                <th style={{ ...thBd, color:tx2 }}>Venta diaria</th>
                <th style={{ ...thBd, color:tx2 }}>Stock</th>
                <th style={{ ...thBd, color:tabColor }}>Situación</th>
                <th style={{ ...thBd, color:C.indigo }}>$ impacto</th>
              </tr>
            </thead>
            <tbody>
              {paretoResult.visible.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ padding:"18px 10px", color:tx3, fontSize:11, fontStyle:"italic", textAlign:"center" }}>
                    Sin productos en esta categoría
                  </td>
                </tr>
              ) : paretoResult.visible.map((r, i) => {
                const isExceso = r.tipo === "exceso_sin_venta";
                const col      = isExceso ? C.red : C.amber;
                const pctImp   = tabMonto > 0 ? +((r.impacto / tabMonto) * 100).toFixed(0) : 0;
                return (
                  <tr key={i}
                    style={{ borderBottom:`1px solid ${C.border}`, background:`${col}04` }}
                    onMouseEnter={e => e.currentTarget.style.background = C.surfaceAlt}
                    onMouseLeave={e => e.currentTarget.style.background = `${col}04`}>
                    <td style={{ padding:"8px 10px", color:tx3, fontSize:10 }}>{i+1}</td>
                    {/* Producto */}
                    <td style={{ padding:"8px 10px" }}>
                      <span style={{ fontWeight:700, color:tx1, display:"block", whiteSpace:"nowrap" }}>{r.sku}</span>
                      <span style={{ fontSize:9.5, color:tx3 }}>{NOMBRES_PROD[r.sku] || r.sfamilia}</span>
                    </td>
                    {/* Categoría */}
                    <td style={{ padding:"8px 10px", color:tx2, fontSize:10.5 }}>{r.sfamilia}</td>
                    {/* Venta diaria */}
                    <td style={{ padding:"8px 10px" }}>
                      <span style={{ fontWeight:600, color: r.ventaDiaria >= 1 ? C.green : r.ventaDiaria >= 0.3 ? C.amber : C.red }}>
                        {fmtVentaDiaria(r.ventaDiaria)}
                      </span>
                    </td>
                    {/* Stock */}
                    <td style={{ padding:"8px 10px", color:tx2, fontWeight:600 }}>
                      {r.stockUnd} und
                      <span style={{ fontSize:9, color:tx3, marginLeft:4 }}>{r.doh}d</span>
                    </td>
                    {/* Situación simple */}
                    <td style={{ padding:"8px 10px" }}>
                      <span style={{ padding:"2px 8px", borderRadius:4, fontSize:9.5, fontWeight:700,
                        background:`${col}18`, color:col }}>
                        {isExceso ? "Mucho stock" : "Poco stock"}
                      </span>
                    </td>
                    {/* Impacto $ con barra */}
                    <td style={{ padding:"8px 10px" }}>
                      <span style={{ fontWeight:700, color:C.indigo }}>${r.impacto.toLocaleString()}</span>
                      <div style={{ display:"flex", alignItems:"center", gap:5, marginTop:3 }}>
                        <div style={{ height:3, width:44, background:C.border, borderRadius:2, flexShrink:0 }}>
                          <div style={{ height:"100%", width:`${pctImp}%`, background:C.indigo, borderRadius:2, opacity:0.55 }}/>
                        </div>
                        <span style={{ fontSize:8.5, color:tx3 }}>{pctImp}%</span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            {paretoResult.visible.length > 0 && (
              <tfoot>
                <tr style={{ borderTop:`1px solid ${C.borderLight}` }}>
                  <td colSpan={5} style={{ padding:"7px 10px", fontSize:9.5, color:tx3, fontStyle:"italic" }}>
                    {paretoResult.hiddenCount > 0
                      ? `Los ${paretoResult.visible.length} productos de mayor impacto · ${paretoResult.hiddenCount} adicionales no mostrados`
                      : "Todos los productos con desalineación"}
                  </td>
                  <td/>
                  <td style={{ padding:"7px 10px", fontWeight:800, color:C.indigo, fontSize:11 }}>
                    ${paretoResult.visible.reduce((s, r) => s + r.impacto, 0).toLocaleString()}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* ── Botones ADI */}
      <div style={{ borderTop:`1px solid ${C.border}`, paddingTop:12 }}>
        <p style={{ fontSize:9.5, color:tx3, marginBottom:10 }}>
          ADI puede explicar por qué pasa, qué hacer primero y cómo se ve por categoría.
        </p>
        <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
          {[
            { key:"que_hago",      label:"¿Qué hago con esto?",   color:C.indigo, icon:"▶" },
            { key:"por_que",       label:"¿Por qué pasa esto?",   color:C.amber,  icon:"?" },
            { key:"por_categorias",label:"Ver por categorías",    color:C.cyan,   icon:"↗" },
          ].map(btn => (
            <button key={btn.key}
              onClick={() => dispatchAdi(btn.key)}
              style={{
                padding:"8px 16px", borderRadius:7, fontSize:11, fontWeight:700, cursor:"pointer",
                border:`1px solid ${btn.color}45`, background:`${btn.color}10`, color:btn.color,
                display:"flex", alignItems:"center", gap:6, transition:"all 0.15s",
              }}
              onMouseEnter={e => e.currentTarget.style.background = `${btn.color}20`}
              onMouseLeave={e => e.currentTarget.style.background = `${btn.color}10`}
            >
              <span style={{ fontSize:12 }}>{btn.icon}</span> {btn.label}
            </button>
          ))}
        </div>
      </div>

    </DrillInvBase>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// DRILL DOWN — CAPITAL EN RIESGO
// Muestra el dinero invertido en productos que no se venden al ritmo esperado.
// Lógica Pareto: solo los productos que explican ~80% del problema, por capital.
// Lenguaje simple de negocio, sin tecnicismos.
// ════════════════════════════════════════════════════════════════════════════
const NOMBRES_PROD = {
  "SAM-REF500L":  "Refrigerador Samsung 500L",
  "LG-WASH11KG":  "Lavadora LG 11KG",
  "SAM-TV55":     "Samsung Smart TV 55\"",
  "LG-DRYER8KG":  "Secadora LG 8KG",
  "PHI-SHAVER9":  "Philips Shaver Series 9",
  "BOS-SANDER":   "Lijadora Bosch Orbital",
  "PHI-IRON-PRO": "Plancha Philips PerfectCare",
  "BOS-DRILL18V": "Taladro Bosch 18V Pro",
  "MAK-COMP-AIR": "Compresor Aire Makita",
  "SAM-MICRO32L": "Microondas Samsung 32L",
  "PHI-HAIR-PRO": "Secador de Pelo Philips Pro",
  "LG-AIR9000":   "Aire Acond. LG 9000 BTU",
  "MAK-SAW18V":   "Sierra Circular Makita 18V",
};

function DrillCapitalRiesgo({ onClose }) {
  const {
    montoTotal, pctTotal,
    montoDetenido, pctDetenido,
    montoEnRiesgo, pctEnRiesgo,
    problema, detenidos, enRiesgo,
    catDominante, totalStock,
  } = capitalRiesgoKPI;

  // ── Pareto por capital sobre todos los productos en riesgo
  const sorted       = [...problema].sort((a, b) => b.stockUSD - a.stockUSD);
  const paretoResult = (() => {
    let acum = 0;
    const bloque = [];
    for (const r of sorted) {
      bloque.push(r);
      acum += r.stockUSD;
      if ((acum / montoTotal) * 100 >= 80) break;
    }
    const pctCovered  = montoTotal > 0 ? +((acum / montoTotal) * 100).toFixed(0) : 0;
    const visible     = bloque.slice(0, 10);
    const hiddenCount = bloque.length - visible.length;
    return { visible, hiddenCount, pctCovered, bloqueSize: bloque.length };
  })();

  // ── Resumen en lenguaje simple
  const resumen = (() => {
    if (montoDetenido > 0 && montoEnRiesgo > 0)
      return `Hay ${fmtUSD(montoDetenido)} en productos que llevan tiempo sin venderse, y otros ${fmtUSD(montoEnRiesgo)} en productos que se están vendiendo más lento de lo esperado.`;
    if (montoDetenido > 0)
      return `Hay ${fmtUSD(montoDetenido)} en productos que no están generando ventas al ritmo esperado. Es dinero detenido que podría estar trabajando.`;
    if (montoEnRiesgo > 0)
      return `Hay ${fmtUSD(montoEnRiesgo)} en productos cuya venta está desacelerando. Si continúa, podría convertirse en dinero detenido.`;
    return "El inventario activo está rotando dentro del ritmo esperado.";
  })();

  // ── Contexto para ADI — estructura universal
  const ctxBase = `Eres ADI. Interpreta este KPI de inventario basándote solo en los datos. No inventes causas. Lenguaje simple de negocio. Sin "probablemente" ni "quizás".

DATOS:
Capital en riesgo: ${fmtUSD(montoTotal)} (${pctTotal}% del inventario)
Dinero detenido: ${fmtUSD(montoDetenido)} | Venta lenta: ${fmtUSD(montoEnRiesgo)}
${catDominante ? `Categoría más afectada: ${catDominante[0]}` : ""}
Productos: ${paretoResult.visible.slice(0,4).map(r=>`${r.sku} (${r.nivelRiesgo==="detenido"?"detenido":"venta lenta"}, ${fmtUSD(r.stockUSD)}, ${r.diasSinVenta}d sin venta)`).join("; ")}

Responde con 4 bloques separados por línea vacía, título en mayúsculas seguido de dos puntos. Máximo 2 líneas por bloque:
RESUMEN:
LECTURA DEL RESULTADO:
IMPLICANCIA PARA EL NEGOCIO:
SIGUIENTE FOCO:`;

  const adiPreguntas = {
    "que_hago":    ctxBase,
    "por_que":     ctxBase,
    "por_clientes":ctxBase,
  };

  const dispatchAdi = (tipo) => {
    window.dispatchEvent(new CustomEvent("adi:pregunta-capital-riesgo", { detail: { context: adiPreguntas[tipo] } }));
    onClose();
  };

  // Color de estado visual
  const colorNivel = (nivel) => nivel === "detenido" ? C.red : C.amber;
  const labelNivel = (nivel) => nivel === "detenido" ? "Detenido" : "Venta lenta";

  return (
    <DrillInvBase
      title="Capital en riesgo"
      subtitle="— Dinero en productos que no se venden al ritmo esperado"
      accentColor={C.red}
      onClose={onClose}
      insight={resumen}
    >

      {/* ── Resumen de impacto: solo capital y % */}
      <div style={{ display:"flex", gap:10, marginBottom:16, flexWrap:"wrap" }}>
        {[
          { label:"Total en riesgo",        val:fmtUSD(montoTotal),    sub:`${pctTotal}% del inventario`,           color:C.red    },
          { label:"Dinero detenido",         val:fmtUSD(montoDetenido), sub:`${pctDetenido}% · sin movimiento`,      color:C.red,    hide:montoDetenido===0 },
          { label:"Se vende lento",          val:fmtUSD(montoEnRiesgo), sub:`${pctEnRiesgo}% · ritmo por debajo`,    color:C.amber,  hide:montoEnRiesgo===0  },
          { label:"Categoría más afectada",  val:catDominante?catDominante[0]:"—", sub:catDominante?fmtUSD(catDominante[1]):"", color:C.textSub },
        ].filter(x => !x.hide).map((item, i) => (
          <div key={i} style={{ background:"#0d0d0d", border:`1px solid ${item.color}28`, borderRadius:8, padding:"9px 14px", flex:"1 1 120px" }}>
            <p style={{ fontSize:8.5, color:tx3, textTransform:"uppercase", letterSpacing:"0.5px", marginBottom:3 }}>{item.label}</p>
            <p style={{ fontWeight:800, fontSize:14, color:item.color }}>{item.val}</p>
            <p style={{ fontSize:9, color:tx3, marginTop:2 }}>{item.sub}</p>
          </div>
        ))}
      </div>

      {/* ── Barra de composición visual */}
      {montoTotal > 0 && (
        <div style={{ marginBottom:16 }}>
          <div style={{ display:"flex", height:6, borderRadius:3, overflow:"hidden", gap:1 }}>
            {montoDetenido > 0 && (
              <div style={{ flex:montoDetenido, background:C.red, opacity:0.8 }} title={`Detenido: ${fmtUSD(montoDetenido)}`}/>
            )}
            {montoEnRiesgo > 0 && (
              <div style={{ flex:montoEnRiesgo, background:C.amber, opacity:0.7 }} title={`Venta lenta: ${fmtUSD(montoEnRiesgo)}`}/>
            )}
            <div style={{ flex:totalStock - montoTotal, background:C.border, opacity:0.5 }}/>
          </div>
          <div style={{ display:"flex", gap:14, marginTop:6 }}>
            {montoDetenido > 0 && <span style={{ display:"flex", alignItems:"center", gap:5, fontSize:9.5, color:tx3 }}><span style={{ width:8, height:8, borderRadius:2, background:C.red, opacity:0.8, flexShrink:0, display:"inline-block" }}/> Detenido</span>}
            {montoEnRiesgo > 0 && <span style={{ display:"flex", alignItems:"center", gap:5, fontSize:9.5, color:tx3 }}><span style={{ width:8, height:8, borderRadius:2, background:C.amber, opacity:0.7, flexShrink:0, display:"inline-block" }}/> Venta lenta</span>}
            <span style={{ display:"flex", alignItems:"center", gap:5, fontSize:9.5, color:tx3 }}><span style={{ width:8, height:8, borderRadius:2, background:C.border, flexShrink:0, display:"inline-block" }}/> Activo</span>
          </div>
        </div>
      )}

      {/* ── Productos que más están afectando — Pareto por capital */}
      <div style={{ marginBottom:14 }}>
        <p style={{ fontSize:10.5, color:tx2, fontWeight:700, marginBottom:8 }}>
          Productos que más están afectando el inventario
          {paretoResult.bloqueSize > 0 && (
            <span style={{ fontWeight:400, color:tx3, marginLeft:8, fontSize:9.5 }}>
              — explican el {paretoResult.pctCovered}% del problema
            </span>
          )}
        </p>

        <div style={{ overflowX:"auto" }}>
          <table style={{ width:"100%", minWidth:520, borderCollapse:"collapse", fontSize:11 }}>
            <thead>
              <tr style={{ borderBottom:`1px solid ${C.border}` }}>
                <th style={{ ...thBd, color:tx3, width:28 }}>#</th>
                <th style={{ ...thBd, color:txH }}>Producto</th>
                <th style={{ ...thBd, color:tx2 }}>Categoría</th>
                <th style={{ ...thBd, color:tx2 }}>Sin venta</th>
                <th style={{ ...thBd, color:tx2 }}>Stock</th>
                <th style={{ ...thBd, color:C.red }}>$ comprometido</th>
                <th style={{ ...thBd, color:tx2 }}>Estado</th>
              </tr>
            </thead>
            <tbody>
              {paretoResult.visible.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ padding:"18px 10px", color:tx3, fontSize:11, fontStyle:"italic", textAlign:"center" }}>
                    No hay productos en riesgo en este momento
                  </td>
                </tr>
              ) : paretoResult.visible.map((r, i) => {
                const col    = colorNivel(r.nivelRiesgo);
                const pctCap = montoTotal > 0 ? +((r.stockUSD / montoTotal) * 100).toFixed(0) : 0;
                return (
                  <tr key={i}
                    style={{ borderBottom:`1px solid ${C.border}`, background:`${col}04` }}
                    onMouseEnter={e => e.currentTarget.style.background = C.surfaceAlt}
                    onMouseLeave={e => e.currentTarget.style.background = `${col}04`}>
                    <td style={{ padding:"8px 10px", color:tx3, fontSize:10 }}>{i+1}</td>
                    {/* Producto */}
                    <td style={{ padding:"8px 10px" }}>
                      <span style={{ fontWeight:700, color:tx1, display:"block", whiteSpace:"nowrap" }}>{r.sku}</span>
                      <span style={{ fontSize:9.5, color:tx3 }}>{NOMBRES_PROD[r.sku] || r.sfamilia}</span>
                    </td>
                    {/* Categoría */}
                    <td style={{ padding:"8px 10px", color:tx2, fontSize:10.5 }}>{r.sfamilia}</td>
                    {/* Días sin venta */}
                    <td style={{ padding:"8px 10px" }}>
                      <span style={{ fontWeight:700, color:col, fontSize:12 }}>{r.diasSinVenta}d</span>
                    </td>
                    {/* Stock und */}
                    <td style={{ padding:"8px 10px", color:tx2, fontWeight:600 }}>
                      {r.stockUnd} und
                    </td>
                    {/* Capital con barra */}
                    <td style={{ padding:"8px 10px" }}>
                      <span style={{ fontWeight:700, color:col }}>${r.stockUSD.toLocaleString()}</span>
                      <div style={{ display:"flex", alignItems:"center", gap:5, marginTop:3 }}>
                        <div style={{ height:3, width:44, background:C.border, borderRadius:2, flexShrink:0 }}>
                          <div style={{ height:"100%", width:`${pctCap}%`, background:col, borderRadius:2, opacity:0.6 }}/>
                        </div>
                        <span style={{ fontSize:8.5, color:tx3 }}>{pctCap}%</span>
                      </div>
                    </td>
                    {/* Estado */}
                    <td style={{ padding:"8px 10px" }}>
                      <span style={{ padding:"2px 8px", borderRadius:4, fontSize:9.5, fontWeight:700,
                        background:`${col}18`, color:col }}>
                        {labelNivel(r.nivelRiesgo)}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            {paretoResult.visible.length > 0 && (
              <tfoot>
                <tr style={{ borderTop:`1px solid ${C.borderLight}` }}>
                  <td colSpan={4} style={{ padding:"7px 10px", fontSize:9.5, color:tx3, fontStyle:"italic" }}>
                    {paretoResult.hiddenCount > 0
                      ? `Los ${paretoResult.visible.length} productos de mayor impacto · ${paretoResult.hiddenCount} adicionales no mostrados`
                      : "Todos los productos en riesgo"}
                  </td>
                  <td/>
                  <td style={{ padding:"7px 10px", fontWeight:800, color:C.red, fontSize:11 }}>
                    ${paretoResult.visible.reduce((s, r) => s + r.stockUSD, 0).toLocaleString()}
                  </td>
                  <td/>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* ── Botones ADI: 3 ángulos */}
      <div style={{ borderTop:`1px solid ${C.border}`, paddingTop:12 }}>
        <p style={{ fontSize:9.5, color:tx3, marginBottom:10 }}>
          ADI puede ayudarte a entender la causa, priorizar acciones y ver el problema por cliente.
        </p>
        <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
          {[
            { key:"que_hago",    label:"¿Qué hago con esto?",  color:C.red,   icon:"▶" },
            { key:"por_que",     label:"¿Por qué pasa esto?",  color:C.amber, icon:"?" },
            { key:"por_clientes",label:"Ver por clientes",     color:C.cyan,  icon:"↗" },
          ].map(btn => (
            <button key={btn.key}
              onClick={() => dispatchAdi(btn.key)}
              style={{
                padding:"8px 16px", borderRadius:7, fontSize:11, fontWeight:700, cursor:"pointer",
                border:`1px solid ${btn.color}45`, background:`${btn.color}10`, color:btn.color,
                display:"flex", alignItems:"center", gap:6, transition:"all 0.15s",
              }}
              onMouseEnter={e => e.currentTarget.style.background = `${btn.color}20`}
              onMouseLeave={e => e.currentTarget.style.background = `${btn.color}10`}
            >
              <span style={{ fontSize:12 }}>{btn.icon}</span> {btn.label}
            </button>
          ))}
        </div>
      </div>

    </DrillInvBase>
  );
}

// ── Calcula bloque Pareto por capital dentro de un conjunto de filas
// Retorna los productos que explican ~80% del capital comprometido.
// Si el bloque supera MAX_VISIBLE, se muestran los primeros MAX_VISIBLE
// y se aclara cuántos quedan. La lógica completa opera sobre todos.
function calcParetoCapital(rows, pctTarget = 80, maxVisible = 10) {
  if (!rows.length) return { visible: [], hiddenCount: 0, pctCovered: 0, totalCapital: 0 };
  const sorted = [...rows].sort((a, b) => b.stockUSD - a.stockUSD);
  const totalCapital = sorted.reduce((s, r) => s + r.stockUSD, 0);
  let acum = 0;
  const bloque = [];
  for (const r of sorted) {
    bloque.push(r);
    acum += r.stockUSD;
    if ((acum / totalCapital) * 100 >= pctTarget) break;
  }
  const pctCovered = +((acum / totalCapital) * 100).toFixed(0);
  const visible    = bloque.slice(0, maxVisible);
  const hiddenCount = bloque.length - visible.length;
  return { visible, hiddenCount, pctCovered, totalCapital, bloqueSize: bloque.length };
}

function DrillCobertura({ onClose }) {
  const [tab, setTab] = useState("sobrestock"); // "sobrestock" | "quiebre"

  const { rows, sobrestockCount, quiebreCount, montoFuera, pctFuera } = coberturaKPI;
  const totalStock = skuInventario.reduce((s, r) => s + r.stockUSD, 0);

  const sobreRows   = rows.filter(r => r.estado === "Sobrestock");
  const quiebreRows = rows.filter(r => r.estado === "Riesgo quiebre");
  const optRows     = rows.filter(r => r.estado === "Óptimo");

  // Capital por tipo
  const montoSobre   = sobreRows.reduce((s, r) => s + r.stockUSD, 0);
  const montoQuiebre = quiebreRows.reduce((s, r) => s + r.stockUSD, 0);
  const pctSobre     = montoFuera > 0 ? +((montoSobre / montoFuera) * 100).toFixed(0) : 0;
  const pctQuiebre   = montoFuera > 0 ? 100 - pctSobre : 0;

  // Categoría dominante en el problema
  const catMap = {};
  rows.filter(r => r.estado !== "Óptimo").forEach(r => {
    catMap[r.sfamilia] = (catMap[r.sfamilia] || 0) + r.stockUSD;
  });
  const catDom = Object.entries(catMap).sort((a, b) => b[1] - a[1])[0];

  // ── Resumen del problema en lenguaje simple
  const resumenProblema = (() => {
    if (montoSobre > 0 && montoQuiebre > 0) {
      return `Hay dinero detenido en productos que se venden lento (${fmtUSD(montoSobre)}), y otros productos que podrían quedarse sin stock pronto (${fmtUSD(montoQuiebre)}).`;
    }
    if (montoSobre > 0) {
      return `La mayor parte del problema es dinero acumulado en productos que se están vendiendo más lento de lo esperado (${fmtUSD(montoSobre)}).`;
    }
    if (montoQuiebre > 0) {
      return `Hay productos con poco stock que podrían agotarse antes de que llegue la próxima compra (${fmtUSD(montoQuiebre)} en riesgo).`;
    }
    return "El inventario está dentro de los rangos esperados de cobertura.";
  })();

  // Pareto por tab
  const paretoSobre   = calcParetoCapital(sobreRows);
  const paretoQuiebre = calcParetoCapital(quiebreRows);
  const pareto        = tab === "sobrestock" ? paretoSobre : paretoQuiebre;
  const tabColor      = tab === "sobrestock" ? C.red : C.amber;

  // ── Contexto para ADI — estructura universal
  const adiContext = (() => {
    const topProductos = [...sobreRows, ...quiebreRows]
      .sort((a, b) => b.stockUSD - a.stockUSD)
      .slice(0, 5)
      .map(r => `${r.sku} (${r.estado === "Sobrestock" ? "mucho stock" : "poco stock"}, ${fmtUSD(r.stockUSD)})`)
      .join(", ");
    return `Eres ADI. Interpreta esta cobertura de inventario basándote solo en los datos. No inventes causas. Lenguaje simple de negocio. Sin "probablemente" ni "quizás".

DATOS:
Inventario fuera de rango: ${pctFuera}% | Capital comprometido: ${fmtUSD(montoFuera)}
Mucho stock (venta lenta): ${fmtUSD(montoSobre)} | Poco stock (riesgo quiebre): ${fmtUSD(montoQuiebre)}
${catDom ? `Categoría más afectada: ${catDom[0]}` : ""}
Productos relevantes: ${topProductos}

Responde con 4 bloques separados por línea vacía, título en mayúsculas seguido de dos puntos. Máximo 2 líneas por bloque:
RESUMEN:
LECTURA DEL RESULTADO:
IMPLICANCIA PARA EL NEGOCIO:
SIGUIENTE FOCO:`;
  })();

  return (
    <DrillInvBase
      title="¿Cómo está el inventario?"
      subtitle="— Productos fuera del rango esperado"
      accentColor={C.violet}
      onClose={onClose}
      insight={resumenProblema}
    >
      {/* ── Resumen de impacto: solo capital, sin conteo de SKU */}
      <div style={{ display:"flex", gap:10, marginBottom:16, flexWrap:"wrap" }}>
        {[
          {
            label: "Fuera del rango esperado",
            val: `${pctFuera}%`,
            sub: `${fmtUSD(montoFuera)} · ${+(montoFuera/totalStock*100).toFixed(1)}% del stock`,
            color: C.violet,
          },
          {
            label: "Dinero detenido (mucho stock)",
            val: fmtUSD(montoSobre),
            sub: montoFuera > 0 ? `${pctSobre}% del problema` : "Sin casos",
            color: C.red,
            hide: montoSobre === 0,
          },
          {
            label: "Productos que podrían faltar",
            val: fmtUSD(montoQuiebre),
            sub: montoFuera > 0 ? `${pctQuiebre}% del problema` : "Sin casos",
            color: C.amber,
            hide: montoQuiebre === 0,
          },
          {
            label: "Dentro del rango",
            val: `${optRows.length > 0 ? +((optRows.reduce((s,r)=>s+r.stockUSD,0)/totalStock)*100).toFixed(0) : 0}%`,
            sub: "del capital en rango óptimo",
            color: "#00a8e8",
          },
        ].filter(x => !x.hide).map((item, i) => (
          <div key={i} style={{ background:"#0d0d0d", border:`1px solid ${item.color}25`, borderRadius:8, padding:"9px 14px", flex:"1 1 130px" }}>
            <p style={{ fontSize:8.5, color:tx3, textTransform:"uppercase", letterSpacing:"0.5px", marginBottom:3 }}>{item.label}</p>
            <p style={{ fontWeight:800, fontSize:14, color:item.color }}>{item.val}</p>
            <p style={{ fontSize:9, color:tx3, marginTop:2 }}>{item.sub}</p>
          </div>
        ))}
      </div>

      {/* ── Tabs por tipo de problema */}
      <div style={{ display:"flex", gap:6, marginBottom:12, alignItems:"center" }}>
        {[
          ["sobrestock", "Dinero detenido", montoSobre,   C.red  ],
          ["quiebre",    "Podrían faltar",  montoQuiebre, C.amber],
        ].filter(([,, monto]) => monto > 0).map(([k, l, monto, col]) => (
          <button key={k} onClick={() => setTab(k)} style={{
            padding:"5px 13px", borderRadius:6, fontSize:11, fontWeight:600, cursor:"pointer",
            border:`1px solid ${tab===k ? col : C.border}`,
            background: tab===k ? `${col}18` : "transparent",
            color: tab===k ? col : tx2,
          }}>
            {l} · <span style={{ fontWeight:800 }}>{fmtUSD(monto)}</span>
          </button>
        ))}
        {catDom && (
          <span style={{ marginLeft:"auto", fontSize:9.5, color:tx3 }}>
            Más afectado: <span style={{ color:tx2, fontWeight:600 }}>{catDom[0]}</span>
          </span>
        )}
      </div>

      {/* ── Productos que más afectan — Pareto por capital */}
      <div style={{ marginBottom:14 }}>
        <p style={{ fontSize:10, color:tx2, fontWeight:600, marginBottom:8 }}>
          Productos que más están generando el problema
          {pareto.bloqueSize > 0 && (
            <span style={{ fontWeight:400, color:tx3, marginLeft:8 }}>
              — explican el {pareto.pctCovered}% del capital afectado
            </span>
          )}
        </p>
        <div style={{ overflowX:"auto" }}>
          <table style={{ width:"100%", minWidth:500, borderCollapse:"collapse", fontSize:11 }}>
            <thead>
              <tr style={{ borderBottom:`1px solid ${C.border}` }}>
                <th style={{ ...thBd, color:tx3, width:28 }}>#</th>
                <th style={{ ...thBd, color:txH }}>Producto</th>
                <th style={{ ...thBd, color:tx2 }}>Categoría</th>
                <th style={{ ...thBd, color:tx2 }}>DOH actual</th>
                <th style={{ ...thBd, color:tx2 }}>DOH objetivo</th>
                <th style={{ ...thBd, color:tabColor }}>Diferencia</th>
                <th style={{ ...thBd, color:tx2 }}>Dinero en juego</th>
              </tr>
            </thead>
            <tbody>
              {pareto.visible.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ padding:"18px 10px", color:tx3, fontSize:11, fontStyle:"italic", textAlign:"center" }}>
                    Sin productos en esta categoría
                  </td>
                </tr>
              ) : pareto.visible.map((r, i) => {
                const isSob  = r.estado === "Sobrestock";
                const rowCol = isSob ? C.red : C.amber;
                const pctCap = +((r.stockUSD / (tab==="sobrestock"?montoSobre:montoQuiebre)) * 100).toFixed(0);
                return (
                  <tr key={i}
                    style={{ borderBottom:`1px solid ${C.border}`, background:`${rowCol}04` }}
                    onMouseEnter={e => e.currentTarget.style.background = C.surfaceAlt}
                    onMouseLeave={e => e.currentTarget.style.background = `${rowCol}04`}>
                    <td style={{ padding:"8px 10px", color:tx3, fontSize:10 }}>{i+1}</td>
                    <td style={{ padding:"8px 10px", fontWeight:700, color:tx1, whiteSpace:"nowrap" }}>{r.sku}</td>
                    <td style={{ padding:"8px 10px", color:tx2, fontSize:10.5 }}>{r.sfamilia}</td>
                    {/* DOH actual */}
                    <td style={{ padding:"8px 10px" }}>
                      <span style={{ fontWeight:700, color:rowCol, fontSize:12 }}>{r.coberturaActual}d</span>
                    </td>
                    {/* DOH objetivo (política) */}
                    <td style={{ padding:"8px 10px", color:tx2, fontWeight:600 }}>{r.coberturaObj}d</td>
                    {/* Diferencia */}
                    <td style={{ padding:"8px 10px" }}>
                      <div style={{ display:"flex", alignItems:"center", gap:7 }}>
                        <span style={{ fontWeight:700, color:rowCol }}>
                          {isSob ? "+" : ""}{r.desviacion}d
                        </span>
                        <div style={{ height:4, width:36, background:C.border, borderRadius:2, flexShrink:0 }}>
                          <div style={{ height:"100%", width:`${Math.min(100, Math.abs(r.desviacion)/(r.coberturaObj||1)*100)}%`, background:rowCol, borderRadius:2, opacity:0.65 }}/>
                        </div>
                      </div>
                    </td>
                    {/* Capital con barra de participación */}
                    <td style={{ padding:"8px 10px" }}>
                      <span style={{ fontWeight:700, color:rowCol }}>${r.stockUSD.toLocaleString()}</span>
                      <div style={{ display:"flex", alignItems:"center", gap:5, marginTop:3 }}>
                        <div style={{ height:3, width:44, background:C.border, borderRadius:2, flexShrink:0 }}>
                          <div style={{ height:"100%", width:`${pctCap}%`, background:rowCol, borderRadius:2, opacity:0.55 }}/>
                        </div>
                        <span style={{ fontSize:8.5, color:tx3 }}>{pctCap}%</span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            {pareto.visible.length > 0 && (
              <tfoot>
                <tr style={{ borderTop:`1px solid ${C.borderLight}` }}>
                  <td colSpan={5} style={{ padding:"7px 10px", fontSize:9.5, color:tx3, fontStyle:"italic" }}>
                    {pareto.hiddenCount > 0
                      ? `Mostrando los ${pareto.visible.length} productos de mayor impacto · ${pareto.hiddenCount} adicionales no mostrados`
                      : `Total de productos en este grupo`}
                  </td>
                  <td/>
                  <td style={{ padding:"7px 10px", fontWeight:800, color:tabColor, fontSize:11 }}>
                    ${pareto.visible.reduce((s,r)=>s+r.stockUSD,0).toLocaleString()}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* ── Botón hacia ADI */}
      <div style={{ borderTop:`1px solid ${C.border}`, paddingTop:12, display:"flex", alignItems:"center", justifyContent:"space-between", gap:12, flexWrap:"wrap" }}>
        <p style={{ fontSize:10, color:tx3 }}>
          ADI puede explicar la causa, priorizar acciones y responder tus preguntas sobre este inventario.
        </p>
        <button
          onClick={() => {
            window.dispatchEvent(new CustomEvent("adi:pregunta-cobertura", { detail:{ context: adiContext } }));
            onClose();
          }}
          style={{
            padding:"8px 18px", borderRadius:7, fontSize:11, fontWeight:700, cursor:"pointer",
            border:`1px solid ${C.violet}50`, background:`${C.violet}12`, color:C.violet,
            display:"flex", alignItems:"center", gap:7, flexShrink:0, transition:"all 0.15s",
          }}
          onMouseEnter={e => e.currentTarget.style.background = `${C.violet}22`}
          onMouseLeave={e => e.currentTarget.style.background = `${C.violet}12`}
        >
          <span style={{ fontSize:13 }}>▶</span> ¿Qué hago con esto?
        </button>
      </div>
    </DrillInvBase>
  );
}

function ModuloInventario({ filtro, filtros }) {
  const [sortCol,       setSortCol]      = useState("stockUSD");
  const [filtroTramo,   setFiltroTramo]  = useState(null);
  const [skuDrill,      setSkuDrill]     = useState(null);
  const [kpiInvDrill,   setKpiInvDrill]  = useState(null);
  const handleKpiInv = (key) => setKpiInvDrill(prev => prev===key ? null : key);

  // ── Índice de mes (-1 = Anual)
  const mesIdx = filtro && filtro !== "Anual" ? (MESES_IDX[filtro] ?? -1) : -1;

  // Factor de escala mensual para inventario (basado en la curva de stock mensual)
  const mesFactor = mesIdx >= 0 ? (() => {
    const totalStock = invMensual.reduce((s,m)=>s+m.stockVal, 0);
    return invMensual[mesIdx].stockVal / totalStock;
  })() : 1;

  // Filtrar SKU inventario según filtros globales
  const skuFiltrados = skuInventario.filter(r => {
    if (filtros?.marcas?.length    && !filtros.marcas.includes(r.marca))       return false;
    if (filtros?.sfamilias?.length && !filtros.sfamilias.includes(r.sfamilia)) return false;
    if (filtros?.sucursales?.length && !filtros.sucursales.includes(r.bodega)) return false;
    if (filtros?.skus?.length      && !filtros.skus.includes(r.sku))           return false;
    return true;
  });

  const hasFilter = filtros && (filtros.marcas?.length||filtros.sfamilias?.length||filtros.sucursales?.length||filtros.skus?.length);

  // KPIs calculados sobre la selección filtrada y escalados al mes
  const kpiFiltrado = (() => {
    const baseRows = skuFiltrados.map(r => ({
      ...r,
      stockUSD: mesIdx >= 0 ? Math.round(r.stockUSD * mesFactor) : r.stockUSD,
    }));
    const total = baseRows.reduce((s,r)=>s+r.stockUSD, 0);
    if (!total) return coberturaKPI;
    const fueraPol   = baseRows.filter(r => clasificarCoberturaSku(r).estado !== "Óptimo");
    const pctFuera   = +((fueraPol.length / baseRows.length) * 100).toFixed(0);
    const montoFuera = fueraPol.reduce((s,r)=>s+r.stockUSD, 0);
    const sobr = fueraPol.filter(r => clasificarCoberturaSku(r).estado === "Sobrestock").length;
    const quie = fueraPol.filter(r => clasificarCoberturaSku(r).estado === "Riesgo quiebre").length;
    return { pctFuera, montoFuera, sobrestockCount:sobr, quiebreCount:quie };
  })();

  const capFiltrado = (() => {
    const baseRows = skuFiltrados.map(r => ({
      ...r,
      stockUSD: mesIdx >= 0 ? Math.round(r.stockUSD * mesFactor) : r.stockUSD,
    }));
    const total = baseRows.reduce((s,r)=>s+r.stockUSD, 0);
    if (!total) return capitalRiesgoKPI;
    const cls = (r) => r.alerta==="crit"||r.diasSinVenta>=60 ? "detenido" : r.alerta==="warn"||r.diasSinVenta>=30 ? "en_riesgo" : "activo";
    const det  = baseRows.filter(r => cls(r) === "detenido");
    const rie  = baseRows.filter(r => cls(r) === "en_riesgo");
    const montoDetenido = det.reduce((s,r)=>s+r.stockUSD, 0);
    const montoEnRiesgo = rie.reduce((s,r)=>s+r.stockUSD, 0);
    const montoTotal    = montoDetenido + montoEnRiesgo;
    return { montoTotal, pctTotal:+((montoTotal/total)*100).toFixed(0), montoDetenido, montoEnRiesgo };
  })();

  const sorted = [...skuFiltrados]
    .filter(r=>!filtroTramo||(filtroTramo==="120d"?r.estado==="120d":filtroTramo==="90d"?r.doh>=90:filtroTramo==="60d"?r.doh>=60:true))
    .sort((a,b)=>b[sortCol]-a[sortCol]);

  const alertIcon = (a) => a==="crit"?C.red:a==="warn"?C.amber:C.green;

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:14 }}>

      {/* ── 4 KPI ejecutivos del módulo de Inventario */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:12 }}>

        {/* 1 — Cobertura */}
        <KpiCard
          label="Cobertura"
          value={`${kpiFiltrado.pctFuera}% fuera de rango`}
          sub={
            <span style={{ display:"flex", flexDirection:"column", gap:3, marginTop:2 }}>
              <span style={{ color:C.red, fontSize:9.5, fontWeight:600 }}>{fmtUSD(kpiFiltrado.montoFuera)} comprometidos</span>
              <span style={{ display:"flex", gap:8, marginTop:1 }}>
                {kpiFiltrado.sobrestockCount > 0 && (
                  <span style={{ display:"flex", alignItems:"center", gap:4 }}>
                    <span style={{ width:5, height:5, borderRadius:"50%", background:C.red, flexShrink:0, display:"inline-block" }}/>
                    <span style={{ color:"#f87171", fontSize:9 }}>Stock detenido</span>
                  </span>
                )}
                {kpiFiltrado.quiebreCount > 0 && (
                  <span style={{ display:"flex", alignItems:"center", gap:4 }}>
                    <span style={{ width:5, height:5, borderRadius:"50%", background:C.amber, flexShrink:0, display:"inline-block" }}/>
                    <span style={{ color:C.amber, fontSize:9 }}>Podrían faltar</span>
                  </span>
                )}
              </span>
            </span>
          }
          color={C.violet} helpId="cobertura" onClick={()=>handleKpiInv("cobertura")} active={kpiInvDrill==="cobertura"}
        />

        {/* 2 — Capital en Riesgo */}
        <KpiCard
          label="Capital en Riesgo"
          value={fmtUSD(capFiltrado.montoTotal)}
          sub={
            <span style={{ display:"flex", flexDirection:"column", gap:3, marginTop:2 }}>
              <span style={{ color:C.red, fontSize:9.5, fontWeight:600 }}>{capFiltrado.pctTotal}% del inventario</span>
              <span style={{ display:"flex", gap:8, marginTop:1 }}>
                {capFiltrado.montoDetenido > 0 && (
                  <span style={{ display:"flex", alignItems:"center", gap:4 }}>
                    <span style={{ width:5, height:5, borderRadius:"50%", background:C.red, flexShrink:0, display:"inline-block" }}/>
                    <span style={{ color:"#f87171", fontSize:9 }}>Detenido</span>
                  </span>
                )}
                {capFiltrado.montoEnRiesgo > 0 && (
                  <span style={{ display:"flex", alignItems:"center", gap:4 }}>
                    <span style={{ width:5, height:5, borderRadius:"50%", background:C.amber, flexShrink:0, display:"inline-block" }}/>
                    <span style={{ color:C.amber, fontSize:9 }}>Venta lenta</span>
                  </span>
                )}
              </span>
            </span>
          }
          color={C.red} helpId="inmovilizado" onClick={()=>handleKpiInv("capital_riesgo")} active={kpiInvDrill==="capital_riesgo"}
        />

        {/* 3 — Desalineación Comercial */}
        <KpiCard
          label="Desalineación"
          value={`${desalineacionKPI.pctDesalin}% desalineado`}
          sub={
            <span style={{ display:"flex", flexDirection:"column", gap:3, marginTop:2 }}>
              <span style={{ color:C.indigo, fontSize:9.5, fontWeight:600 }}>${desalineacionKPI.montoTotal.toLocaleString()} en impacto</span>
              <span style={{ display:"flex", gap:8, marginTop:1 }}>
                {desalineacionKPI.montoExceso > 0 && (
                  <span style={{ display:"flex", alignItems:"center", gap:4 }}>
                    <span style={{ width:5, height:5, borderRadius:"50%", background:C.red, flexShrink:0, display:"inline-block" }}/>
                    <span style={{ color:"#f87171", fontSize:9 }}>Mucho stock</span>
                  </span>
                )}
                {desalineacionKPI.montoSinStock > 0 && (
                  <span style={{ display:"flex", alignItems:"center", gap:4 }}>
                    <span style={{ width:5, height:5, borderRadius:"50%", background:C.amber, flexShrink:0, display:"inline-block" }}/>
                    <span style={{ color:C.amber, fontSize:9 }}>Poco stock</span>
                  </span>
                )}
              </span>
            </span>
          }
          color={C.indigo} helpId="doh" onClick={()=>handleKpiInv("desalineacion")} active={kpiInvDrill==="desalineacion"}
        />

        {/* 4 — Concentración del Problema */}
        <KpiCard
          label="Concentración"
          value={`${concentracionKPI.pctConcentrado}% del problema`}
          sub={
            <span style={{ display:"flex", flexDirection:"column", gap:3, marginTop:2 }}>
              <span style={{ color:"#00a8e8", fontSize:9.5, fontWeight:600 }}>
                se concentra en {concentracionKPI.isFocalizado ? "pocos productos" : "varios productos"}
              </span>
              {concentracionKPI.catDominante && (
                <span style={{ display:"flex", alignItems:"center", gap:4, marginTop:1 }}>
                  <span style={{ width:5, height:5, borderRadius:"50%", background:C.green, flexShrink:0, display:"inline-block" }}/>
                  <span style={{ color:"#00a8e8", fontSize:9 }}>{concentracionKPI.catDominante[0]}</span>
                </span>
              )}
            </span>
          }
          color={C.green} helpId="rotacion" onClick={()=>handleKpiInv("concentracion")} active={kpiInvDrill==="concentracion"}
        />
      </div>

      {/* ── Drill down por KPI */}
      {kpiInvDrill==="cobertura"      && <DrillCobertura      onClose={()=>setKpiInvDrill(null)}/>}
      {kpiInvDrill==="capital_riesgo" && <DrillCapitalRiesgo  onClose={()=>setKpiInvDrill(null)}/>}
      {kpiInvDrill==="desalineacion"  && <DrillDesalineacion  onClose={()=>setKpiInvDrill(null)}/>}
      {kpiInvDrill==="concentracion"  && <DrillConcentracion  onClose={()=>setKpiInvDrill(null)}/>}
      {/* ── Foco de Inventario — tabla operativa + ejecutiva */}
      <FocoInventario skuDrill={skuDrill} onSelectSku={setSkuDrill} kpiActivo={kpiInvDrill} filtros={filtros}/>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// HOOK EJECUTIVO — generado localmente, sin API, con datos reales
// Estructura: positivo → contraste → problema oculto → impacto → pregunta
// ════════════════════════════════════════════════════════════════════════════
function buildHook(modulo) {
  if (modulo === "ventas") {
    const crec        = ventasKPI.vsAnterior;
    const gapPres     = ventasKPI.vsPresupuesto;
    const concTop3    = +((18500+17000+16500)/ventasKPI.totalActual*100).toFixed(1);
    const ripleyDrop  = +((4500-4900)/4900*100).toFixed(1);
    const laPolarDrop = +((2800-3200)/3200*100).toFixed(1);
    const mlGrow      = +((5200-4150)/4150*100).toFixed(1);
    const riskUSD     = Math.round((18500+17000+16500)*0.10/1000);

    if (crec > 0 && concTop3 > 50) {
      return `Las ventas crecieron ${crec}% y el presupuesto se cumplió en ${100+gapPres}%.\n\nTodo se ve bien… pero el ${concTop3}% de la facturación depende de 3 clientes.\n\nSi cualquiera de los tres ajusta condiciones, perdés entre $1,500K y $${riskUSD*10}K en el año.\n\n¿Qué tan sólida es esa relación hoy?`;
    }
    if (crec < 0) {
      return `Las ventas cayeron ${Math.abs(crec)}% vs el año pasado.\n\nPero Mercado Libre creció ${mlGrow}% y sigue sin recibir atención comercial proporcional.\n\nHay plata sobre la mesa que no se está levantando.\n\n¿Dónde están los recursos comerciales hoy?`;
    }
    return `Las ventas crecieron ${crec}% y el presupuesto se cumplió.\n\nSin embargo, Ripley cayó ${Math.abs(ripleyDrop)}% y La Polar ${Math.abs(laPolarDrop)}% — en silencio, sin que nadie intervenga.\n\nDos cuentas perdiendo terreno al mismo tiempo no es coincidencia.\n\n¿Qué está pasando en el canal retail?`;
  }

  if (modulo === "margenes") {
    const ventaCrec   = ventasKPI.vsAnterior;
    const margenAct   = margenKPI.pct;
    const margenAnt   = margenKPI.pctAnt;
    const caida       = +(margenAnt - margenAct).toFixed(1);
    const ventaTotal  = ventasKPI.totalActual * 1000;
    const caidaUSD    = Math.round(caida / 100 * ventaTotal / 1000);
    const gapRef      = +(30.1 - margenAct).toFixed(1);
    const gapUSD      = Math.round(gapRef / 100 * ventaTotal / 1000);
    const makitaMgn   = 35.5;
    const makitaVenta = 4800;

    return `Las ventas subieron ${ventaCrec}% vs el año pasado.\n\nPero el margen cayó ${caida} puntos — de ${margenAnt}% a ${margenAct}%.\n\nEso es $${caidaUSD}K de contribución que se perdió mientras la facturación subía. Vendiste más y ganaste menos.\n\n¿Sabés quién te está comiendo el margen?`;
  }

  if (modulo === "inventario") {
    const stockTotal  = invKPI.totalUSD;
    const inmovPct    = invKPI.inmovilizadoPct;
    const inmovUSD    = Math.round(stockTotal * inmovPct / 100);
    const costoDia    = Math.round(inmovUSD * 0.12 / 365);
    const doh         = invKPI.doh;
    const skusCrit    = skuInventario.filter(r=>r.doh>120).length;
    const montoCrit   = skuInventario.filter(r=>r.doh>120).reduce((s,r)=>s+r.stockUSD,0);

    return `El inventario está disponible y el DOH promedio es ${doh} días.\n\nPero ${inmovPct}% del stock no se mueve hace más de 60 días — son $${(inmovUSD/1000).toFixed(0)}K parados.\n\nEso te cuesta $${costoDia.toLocaleString()} por día en costo financiero, sin vender nada. ${skusCrit} producto${skusCrit!==1?"s":""} ya superaron los 120 días.\n\n¿Cuándo fue la última vez que se tomó una decisión de liquidación?`;
  }

  return "";
}

// ════════════════════════════════════════════════════════════════════════════
// PANEL ADI
// ════════════════════════════════════════════════════════════════════════════
const BLOCK_COLORS = [C.blue, C.cyan, C.indigo, C.amber, C.red, C.green];

function AdiBlocks({ text, loading }) {
  const blocks = text.split(/\n\n+/).filter(Boolean);
  return (
    <div style={{ display:"flex", flexDirection:"column", gap:13 }}>
      {blocks.map((block,i)=>{
        // ── Hook ejecutivo — render especial
        if (block.startsWith("__HOOK__")) {
          const lines = block.replace("__HOOK__","").trim().split("\n").filter(Boolean);
          const question = lines[lines.length-1];
          const body     = lines.slice(0,-1).join("\n");
          return (
            <div key={i} style={{ background:"linear-gradient(135deg,rgba(14,165,233,0.07),rgba(129,140,248,0.05))", border:`1px solid rgba(14,165,233,0.2)`, borderRadius:10, padding:"13px 14px", position:"relative", overflow:"hidden" }}>
              {/* Acento izquierdo */}
              <div style={{ position:"absolute", left:0, top:0, bottom:0, width:3, background:"linear-gradient(180deg,#00c2e8,#0e7fa8)", borderRadius:"10px 0 0 10px" }}/>
              <p style={{ fontSize:11.5, color:"#c8d8e8", lineHeight:1.75, paddingLeft:4, whiteSpace:"pre-line", marginBottom:10 }}>{body}</p>
              <p style={{ fontSize:12, fontWeight:700, color:C.cyan, lineHeight:1.5, paddingLeft:4, borderTop:`1px solid rgba(14,165,233,0.15)`, paddingTop:8 }}>
                {question}
              </p>
              {loading && <span style={{ display:"inline-block", width:5, height:10, background:C.cyan, borderRadius:2, animation:"blink 0.8s infinite", marginLeft:2 }}/>}
            </div>
          );
        }
        // ── Bloque estándar
        const isBlock=/^BLOQUE \d+/.test(block);
        if (isBlock) {
          const firstNl=block.indexOf("\n");
          const title=firstNl>-1?block.slice(0,firstNl).replace(/^BLOQUE \d+ - /,""):block;
          const body=firstNl>-1?block.slice(firstNl+1):"";
          const idx=parseInt(block.match(/\d+/)?.[0]||"1")-1;
          const col=BLOCK_COLORS[idx%BLOCK_COLORS.length];
          return (
            <div key={i} style={{ borderLeft:`2px solid ${col}`, paddingLeft:11, paddingBottom:2 }}>
              <p style={{ fontSize:8.5, fontWeight:800, letterSpacing:"1px", textTransform:"uppercase", color:col, marginBottom:6 }}>{title}</p>
              <p style={{ fontSize:11, color:"#8fa3be", lineHeight:1.75 }}>{body}</p>
            </div>
          );
        }
        return <p key={i} style={{ fontSize:11, color:"#8fa3be", lineHeight:1.75 }}>{block}</p>;
      })}
      {loading && !text.includes("__HOOK__") && <span style={{ display:"inline-block", width:6, height:12, background:C.blue, borderRadius:2, animation:"blink 0.8s infinite" }}/>}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// PANEL ADI v2 — workspace persistente con historial de conversaciones
// ════════════════════════════════════════════════════════════════════════════

const ADI_LS_KEY = "adi_sentric_chats_v1";

function loadChatsFromStorage() {
  try {
    const raw = localStorage.getItem(ADI_LS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function saveChatsToStorage(chats) {
  try { localStorage.setItem(ADI_LS_KEY, JSON.stringify(chats)); } catch {}
}

function makeChatId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function makeChatTitle(modulo, content) {
  const temas = {
    ventas:     ["Concentración de ingresos","Crecimiento de ventas","Riesgo de cartera","Análisis de clientes","Tendencia comercial"],
    margenes:   ["Caída de rentabilidad","Erosión de margen","Análisis de contribución","Mix de productos","Rebates y costos"],
    inventario: ["Capital inmovilizado","Rotación de stock","Riesgo de quiebre","Cobertura de inventario","Productos sin rotación"],
  };
  const opts = temas[modulo] || temas.ventas;
  const tema = content
    ? (content.toLowerCase().includes("margin") || content.toLowerCase().includes("margen") ? opts[0]
     : content.toLowerCase().includes("invent") ? opts[2]
     : opts[Math.floor(Math.random() * opts.length)])
    : opts[0];
  const now = new Date();
  const dd = now.getDate();
  const mm = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"][now.getMonth()];
  const labels = { ventas:"Ventas", margenes:"Márgenes", inventario:"Inventario" };
  return `${labels[modulo] || modulo} — ${tema} — ${dd} ${mm}`;
}

const SUGERENCIAS = {
  ventas:     ["¿Dónde se concentra mi ingreso?","¿Qué clientes explican mis ventas?","¿Dónde estoy creciendo o cayendo?","¿Cuál es el riesgo de mi cartera?"],
  margenes:   ["¿Qué clientes generan mayor contribución?","¿Dónde estoy perdiendo rentabilidad?","¿Qué está afectando mis márgenes?","¿Cuáles son mis clientes menos rentables?"],
  inventario: ["¿Dónde tengo capital detenido?","¿Qué productos no rotan?","¿Dónde tengo riesgo de quiebre?","¿Qué productos debo liquidar?"],
};

function ChatMessageBubble({ m, i, total, loadingC }) {
  // Renderiza mensajes del chat con AdiBlocks para respuestas de ADI
  if (m.role === "assistant") {
    return (
      <div style={{ display:"flex", gap:7, alignItems:"flex-start" }}>
        <div style={{ width:20, height:20, borderRadius:5, background:"linear-gradient(135deg,#00c2e8,#0e7fa8)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:9, fontWeight:900, color:"#fff", flexShrink:0, marginTop:2 }}>A</div>
        <div style={{ flex:1 }}>
          <AdiBlocks text={m.content} loading={loadingC && i === total - 1}/>
        </div>
      </div>
    );
  }
  // user — no mostrar el prompt técnico inicial (demasiado largo)
  const isSystemPrompt = m.content.length > 400 && m.content.includes("MÓDULO:");
  if (isSystemPrompt) return null;
  return (
    <div style={{ display:"flex", justifyContent:"flex-end" }}>
      <div style={{ maxWidth:"85%", background:"rgba(14,165,233,0.09)", border:`1px solid rgba(14,165,233,0.22)`, borderRadius:"10px 10px 3px 10px", padding:"8px 11px", fontSize:11, color:"#c8d8e8", lineHeight:1.7 }}>
        {m.content}
        {loadingC && i === total - 1 && (
          <span style={{ display:"inline-block", width:5, height:11, background:C.blue, borderRadius:2, animation:"blink 0.8s infinite", marginLeft:2 }}/>
        )}
      </div>
    </div>
  );
}

function PanelADI({ modulo, filtro, marca, adiProfile, userRole, width=340 }) {
  // ── Historial de chats (persistido en localStorage)
  const [chats,       setChats]       = useState(() => loadChatsFromStorage());
  const [activeChatId,setActiveChatId]= useState(null);
  const [search,      setSearch]      = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState(null); // id del chat a confirmar

  // ── Estado de conversación activa (refleja el chat seleccionado)
  const [analysis,    setAnalysis]    = useState("");
  const [loadingA,    setLoadingA]    = useState(false);
  const [hasAnalysis, setHasAnalysis] = useState(false);
  const [chatHistory, setChatHistory] = useState([]);
  const [chatInput,   setChatInput]   = useState("");
  const [loadingC,    setLoadingC]    = useState(false);

  const scrollRef    = useRef(null);
  const inputRef     = useRef(null);

  // ── Chat activo derivado
  const activeChat = chats.find(c => c.id === activeChatId) || null;

  // ── Persistir chats cuando cambian
  useEffect(() => { saveChatsToStorage(chats); }, [chats]);

  // ── Scroll al fondo cuando llegan mensajes
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [chatHistory, analysis]);

  // ── Cargar conversación cuando se selecciona un chat
  useEffect(() => {
    if (!activeChat) { setAnalysis(""); setChatHistory([]); setHasAnalysis(false); return; }
    setAnalysis(activeChat.analysis || "");
    setChatHistory(activeChat.messages || []);
    setHasAnalysis(activeChat.hasAnalysis || false);
  }, [activeChatId]);

  // ── Guardar estado de conversación activa en el chat
  const persistActiveChat = useCallback((updates) => {
    if (!activeChatId) return;
    setChats(prev => prev.map(c => c.id === activeChatId ? { ...c, ...updates, updatedAt: Date.now() } : c));
  }, [activeChatId]);

  // ── Escuchar eventos de botones ADI del dashboard
  useEffect(() => {
    const handler = (e) => {
      const ctx = e.detail?.context;
      if (!ctx) return;
      // Si no hay chat activo, crear uno nuevo
      let chatId = activeChatId;
      if (!chatId) {
        chatId = makeChatId();
        const newChat = { id:chatId, title:makeChatTitle(modulo, ctx), createdAt:Date.now(), updatedAt:Date.now(), module:modulo, analysis:"", messages:[], hasAnalysis:false };
        setChats(prev => [newChat, ...prev]);
        setActiveChatId(chatId);
      }
      const doAnalysis = async () => {
        setLoadingC(true);
        const newH = [...chatHistory, { role:"user", content:ctx }];
        setChatHistory(newH);
        try {
          const full = await streamApi(
            newH,
            t => setChatHistory([...newH, { role:"assistant", content:t }]),
            buildSystemPrompt(adiProfile, userRole)
          );
          const finalH = [...newH, { role:"assistant", content:full }];
          setChatHistory(finalH);
          setChats(prev => prev.map(c => c.id === chatId ? { ...c, messages:finalH, updatedAt:Date.now() } : c));
        } catch {
          const errH = [...newH, { role:"assistant", content:"Error al conectar con ADI." }];
          setChatHistory(errH);
        }
        setLoadingC(false);
      };
      if (!hasAnalysis) { setHasAnalysis(true); }
      doAnalysis();
    };
    window.addEventListener("adi:pregunta-cobertura",     handler);
    window.addEventListener("adi:pregunta-capital-riesgo",handler);
    window.addEventListener("adi:pregunta-desalineacion", handler);
    window.addEventListener("adi:pregunta-concentracion", handler);
    return () => {
      window.removeEventListener("adi:pregunta-cobertura",     handler);
      window.removeEventListener("adi:pregunta-capital-riesgo",handler);
      window.removeEventListener("adi:pregunta-desalineacion", handler);
      window.removeEventListener("adi:pregunta-concentracion", handler);
    };
  }, [chatHistory, hasAnalysis, activeChatId, modulo]);

  // ── API streaming — recibe systemPrompt como parámetro separado para que la identidad
  // y el scope de ADI nunca se diluyan, incluso con historiales de chat largos
  const streamApi = async (messages, onChunk, systemPrompt) => {
    const body = { model:"claude-sonnet-4-20250514", max_tokens:1000, stream:true, messages };
    if (systemPrompt) body.system = systemPrompt;
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method:"POST", headers:{ "Content-Type":"application/json" },
      body:JSON.stringify(body)
    });
    const reader=res.body.getReader(); const dec=new TextDecoder(); let full="";
    while(true) {
      const { done, value }=await reader.read(); if(done) break;
      const chunk=dec.decode(value,{stream:true});
      for(const line of chunk.split("\n").filter(l=>l.startsWith("data:"))) {
        const json=line.replace("data: ","").trim(); if(json==="[DONE]") continue;
        try { const d=JSON.parse(json); if(d?.delta?.text){ full+=d.delta.text; onChunk(full); } } catch{}
      }
    }
    return full;
  };

  // ── Nuevo chat
  const handleNewChat = () => {
    setActiveChatId(null);
    setAnalysis(""); setChatHistory([]); setHasAnalysis(false); setChatInput("");
  };

  // ── Generar análisis
  const generateAnalysis = useCallback(async () => {
    // Crear chat si no existe
    let chatId = activeChatId;
    if (!chatId) {
      chatId = makeChatId();
      const title = makeChatTitle(modulo, null);
      const newChat = { id:chatId, title, createdAt:Date.now(), updatedAt:Date.now(), module:modulo, analysis:"", messages:[], hasAnalysis:false };
      setChats(prev => [newChat, ...prev]);
      setActiveChatId(chatId);
    }

    setLoadingA(true); setHasAnalysis(false); setChatHistory([]);
    const hook = buildHook(modulo);
    const hookPrefix = hook ? `__HOOK__${hook}\n\n` : "";
    setAnalysis(hookPrefix);

    const prompt = modulo==="ventas"   ? buildPromptVentas(filtro,marca,adiProfile,userRole)
                 : modulo==="margenes" ? buildPromptMargenes(filtro,"clientes",adiProfile,userRole)
                 : buildPromptInventario(filtro,adiProfile,userRole);
    try {
      const full = await streamApi(
        [{role:"user",content:prompt}],
        t => setAnalysis(hookPrefix + t),
        buildSystemPrompt(adiProfile, userRole)
      );
      const finalAnalysis = hookPrefix + full;
      const initHistory = [{role:"user",content:prompt},{role:"assistant",content:full}];
      setHasAnalysis(true);
      setAnalysis(finalAnalysis);
      setChatHistory(initHistory);
      setChats(prev => prev.map(c => c.id === chatId
        ? { ...c, analysis:finalAnalysis, messages:initHistory, hasAnalysis:true, updatedAt:Date.now() }
        : c
      ));
    } catch { setAnalysis(hookPrefix + "\n\nError de conexión con ADI. Verifica la API key."); }
    setLoadingA(false);
  }, [modulo, filtro, marca, adiProfile, userRole, activeChatId]);

  // ── Enviar mensaje de chat
  const sendChat = useCallback(async () => {
    if (!chatInput.trim() || loadingC) return;
    const q = chatInput.trim(); setChatInput("");
    const newH = [...chatHistory, { role:"user", content:q }];
    setChatHistory(newH);
    setLoadingC(true);
    try {
      const full = await streamApi(
        newH,
        t => setChatHistory([...newH, { role:"assistant", content:t }]),
        buildSystemPrompt(adiProfile, userRole)
      );
      const finalH = [...newH, { role:"assistant", content:full }];
      setChatHistory(finalH);
      persistActiveChat({ messages:finalH });
    } catch {
      const errH = [...newH, { role:"assistant", content:"Error al conectar con ADI." }];
      setChatHistory(errH);
    }
    setLoadingC(false);
  }, [chatInput, chatHistory, loadingC, persistActiveChat, adiProfile, userRole]);

  // ── Eliminar chat
  const handleDeleteChat = (id) => {
    setChats(prev => prev.filter(c => c.id !== id));
    if (activeChatId === id) handleNewChat();
    setDeleteConfirm(null);
  };

  // ── Filtrar chats por búsqueda
  const filteredChats = chats.filter(c => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return c.title.toLowerCase().includes(q) ||
      (c.messages||[]).some(m => m.content.toLowerCase().includes(q));
  });

  // ── Mensajes visibles (excluye prompt técnico interno)
  const visibleMsgs = chatHistory.filter(m => !(m.role==="user" && m.content.length>400 && m.content.includes("MÓDULO:")));

  const p = ADI_PROFILES[adiProfile]; const r = USER_ROLES[userRole];
  const moduleLabel = { ventas:"Ventas", margenes:"Márgenes", inventario:"Inventario" }[modulo];
  const moduleBadgeColor = { ventas:C.blue, margenes:"#00a8e8", inventario:C.amber }[modulo] || C.indigo;
  const sugerencias = SUGERENCIAS[modulo] || SUGERENCIAS.ventas;

  // ── Formatear fecha relativa
  const fmtDate = (ts) => {
    const diff = Date.now() - ts;
    if (diff < 60000)     return "ahora";
    if (diff < 3600000)   return `${Math.round(diff/60000)}m`;
    if (diff < 86400000)  return `${Math.round(diff/3600000)}h`;
    const d = new Date(ts);
    return `${d.getDate()} ${["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"][d.getMonth()]}`;
  };

  const modIcon = { ventas:"📈", margenes:"💰", inventario:"📦" };

  // ── Sidebar colapsable — contiene bienvenida, acciones y sugerencias
  const [sidebarOpen, setSidebarOpen] = useState(true);
  // sidebar: 35% del panel cuando abierto, 44px cuando colapsado
  const SIDE_W    = sidebarOpen ? "35%" : "44px";
  const SIDE_WMIN = sidebarOpen ? 120    : 44;
  const SIDE_WMAX = sidebarOpen ? 220    : 44;

  // ── Dropdown sugerencias (dentro del sidebar)
  const [showSugerencias, setShowSugerencias] = useState(false);

  return (
    <aside style={{ width, borderLeft:`1px solid ${C.border}`, background:"#080808", display:"flex", flexDirection:"row", flexShrink:0, overflow:"hidden" }}>

      {/* ══════════════════════════════════════════
          SIDEBAR — bienvenida + historial + acciones
          Siempre ≤ 35% del panel, chat siempre ≥ 65%
      ══════════════════════════════════════════ */}
      <div style={{ width:SIDE_W, minWidth:SIDE_WMIN, maxWidth:SIDE_WMAX, borderRight:`1px solid ${C.border}`, display:"flex", flexDirection:"column", background:"#050505", flexShrink:0, transition:"width 0.2s ease, min-width 0.2s ease", overflow:"hidden" }}>

        {/* ── Header sidebar — siempre visible */}
        <div style={{ padding:"10px 0 9px", borderBottom:`1px solid ${C.border}`, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
          {sidebarOpen ? (
            <div style={{ width:"100%", padding:"0 10px", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
              <div style={{ display:"flex", alignItems:"center", gap:5 }}>
                <div style={{ width:20, height:20, borderRadius:5, background:"linear-gradient(135deg,#00c2e8,#0e7fa8)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:10, fontWeight:900, color:"#fff", flexShrink:0 }}>A</div>
                <span style={{ fontWeight:800, fontSize:10.5, letterSpacing:"-0.3px", whiteSpace:"nowrap", color:C.text }}>ADI</span>
              </div>
              {/* Botón colapsar — panel toggle icon */}
              <button onClick={()=>setSidebarOpen(false)} title="Minimizar panel"
                style={{ background:"transparent", border:"none", cursor:"pointer", padding:"4px", borderRadius:5, display:"flex", alignItems:"center", justifyContent:"center", opacity:0.45, transition:"opacity 0.15s" }}
                onMouseEnter={e=>e.currentTarget.style.opacity="1"}
                onMouseLeave={e=>e.currentTarget.style.opacity="0.45"}>
                <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
                  <rect x="1" y="1" width="13" height="13" rx="2" stroke={C.text} strokeWidth="1.2"/>
                  <rect x="1" y="1" width="4.5" height="13" rx="2" fill={C.text} opacity="0.25"/>
                  <path d="M6.5 5L5 7.5L6.5 10" stroke={C.text} strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
            </div>
          ) : (
            /* Botón expandir — mismo ícono */
            <button onClick={()=>setSidebarOpen(true)} title="Expandir panel ADI"
              style={{ background:"transparent", border:"none", cursor:"pointer", padding:"4px", borderRadius:5, display:"flex", alignItems:"center", justifyContent:"center", opacity:0.45, transition:"opacity 0.15s" }}
              onMouseEnter={e=>e.currentTarget.style.opacity="1"}
              onMouseLeave={e=>e.currentTarget.style.opacity="0.45"}>
              <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
                <rect x="1" y="1" width="13" height="13" rx="2" stroke={C.text} strokeWidth="1.2"/>
                <rect x="1" y="1" width="4.5" height="13" rx="2" fill={C.text} opacity="0.25"/>
                <path d="M4.5 5L6 7.5L4.5 10" stroke={C.text} strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
          )}
        </div>

        {/* ══ SIDEBAR EXPANDIDO ══ */}
        {sidebarOpen && (
          <div style={{ flex:1, display:"flex", flexDirection:"column", overflow:"hidden" }}>

            {/* Bienvenida compacta */}
            <div style={{ padding:"14px 10px 12px", borderBottom:`1px solid ${C.border}`, flexShrink:0 }}>
              <p style={{ fontSize:11, fontWeight:800, color:C.text, letterSpacing:"-0.3px", marginBottom:5, lineHeight:1.3 }}>
                Soy ADI, tu asesor de negocio
              </p>
              <p style={{ fontSize:9.5, color:C.textSub, lineHeight:1.6, marginBottom:12 }}>
                Analizo tus datos y detecto lo que no es evidente.
              </p>
              {/* Botón análisis */}
              <button onClick={generateAnalysis}
                style={{ width:"100%", padding:"8px 6px", borderRadius:7, fontSize:10, fontWeight:700, border:"none", background:"linear-gradient(135deg,#00c2e8,#0e7fa8)", color:"#fff", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", gap:5, marginBottom:6, transition:"opacity 0.15s" }}
                onMouseEnter={e=>e.currentTarget.style.opacity="0.86"}
                onMouseLeave={e=>e.currentTarget.style.opacity="1"}>
                <span style={{ fontSize:11 }}>▶</span> Generar análisis
              </button>
              {/* Sugerencias toggle */}
              <button onClick={()=>setShowSugerencias(v=>!v)}
                style={{ width:"100%", padding:"6px", borderRadius:6, fontSize:9.5, fontWeight:600, border:`1px solid ${showSugerencias?C.blue:C.border}`, background:showSugerencias?"rgba(14,165,233,0.07)":"transparent", color:showSugerencias?C.blue:C.textSub, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", gap:4, transition:"all 0.13s" }}>
                <span style={{ fontSize:11 }}>💡</span> Sugerencias
                <span style={{ fontSize:8, opacity:0.7 }}>{showSugerencias?"▲":"▼"}</span>
              </button>
              {/* Lista sugerencias */}
              {showSugerencias && (
                <div style={{ marginTop:6, display:"flex", flexDirection:"column", gap:4 }}>
                  {sugerencias.map((s,i) => (
                    <button key={i}
                      onClick={()=>{ setChatInput(s); setShowSugerencias(false); inputRef.current?.focus(); }}
                      style={{ textAlign:"left", padding:"7px 9px", borderRadius:6, border:`1px solid ${C.border}`, background:C.surfaceAlt, color:C.textSub, cursor:"pointer", fontSize:9.5, lineHeight:1.45, transition:"all 0.12s" }}
                      onMouseEnter={e=>{ e.currentTarget.style.borderColor=C.blue; e.currentTarget.style.color=C.text; e.currentTarget.style.background=C.surfaceHover; }}
                      onMouseLeave={e=>{ e.currentTarget.style.borderColor=C.border; e.currentTarget.style.color=C.textSub; e.currentTarget.style.background=C.surfaceAlt; }}>
                      {s}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Nuevo chat + buscador */}
            <div style={{ padding:"7px 8px 6px", borderBottom:`1px solid ${C.border}`, flexShrink:0 }}>
              <button onClick={handleNewChat}
                style={{ width:"100%", padding:"5px 0", borderRadius:5, border:`1px solid ${C.borderLight}`, background:"rgba(14,165,233,0.06)", color:C.blue, cursor:"pointer", fontSize:9, fontWeight:700, display:"flex", alignItems:"center", justifyContent:"center", gap:3, marginBottom:6, transition:"background 0.13s" }}
                onMouseEnter={e=>e.currentTarget.style.background="rgba(14,165,233,0.13)"}
                onMouseLeave={e=>e.currentTarget.style.background="rgba(14,165,233,0.06)"}>
                <span style={{ fontSize:11 }}>+</span> Nuevo chat
              </button>
              <div style={{ position:"relative" }}>
                <span style={{ position:"absolute", left:6, top:"50%", transform:"translateY(-50%)", fontSize:9, color:C.textMuted, pointerEvents:"none" }}>🔍</span>
                <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar chats..."
                  style={{ width:"100%", background:C.surfaceAlt, border:`1px solid ${C.border}`, borderRadius:5, padding:"5px 5px 5px 20px", fontSize:9, color:C.text, outline:"none", boxSizing:"border-box" }}
                  onFocus={e=>e.target.style.borderColor=C.blue}
                  onBlur={e=>e.target.style.borderColor=C.border}/>
              </div>
            </div>

            {/* Historial de chats */}
            <div style={{ flex:1, overflowY:"auto", padding:"5px 6px" }}>
              {filteredChats.length === 0 && (
                <p style={{ fontSize:8.5, color:C.textMuted, textAlign:"center", padding:"12px 4px", lineHeight:1.6 }}>
                  {search ? "Sin resultados" : "Sin chats aún"}
                </p>
              )}
              {filteredChats.map(chat => {
                const isActive = chat.id === activeChatId;
                return (
                  <div key={chat.id} style={{ position:"relative", marginBottom:2 }}
                    onMouseEnter={e=>{ if(!isActive) e.currentTarget.querySelector(".ci").style.background=C.surfaceAlt; e.currentTarget.querySelector(".db").style.opacity="1"; }}
                    onMouseLeave={e=>{ if(!isActive) e.currentTarget.querySelector(".ci").style.background="transparent"; e.currentTarget.querySelector(".db").style.opacity="0"; }}>
                    <div className="ci" onClick={()=>setActiveChatId(chat.id)}
                      style={{ borderRadius:5, padding:"6px 18px 6px 7px", cursor:"pointer", background:isActive?"rgba(14,165,233,0.1)":"transparent", border:`1px solid ${isActive?C.blue:"transparent"}`, transition:"all 0.1s" }}>
                      <div style={{ display:"flex", alignItems:"center", gap:3, marginBottom:1 }}>
                        <span style={{ fontSize:8 }}>{modIcon[chat.module]||"💬"}</span>
                        <span style={{ fontSize:7, fontWeight:700, color:isActive?C.blue:C.textMuted, textTransform:"uppercase", letterSpacing:"0.4px" }}>
                          {{ ventas:"Vtas", margenes:"Marg", inventario:"Inv" }[chat.module]||chat.module}
                        </span>
                      </div>
                      <p style={{ fontSize:8.5, color:isActive?"#c8d8e8":C.textSub, lineHeight:1.4, marginBottom:1, display:"-webkit-box", WebkitLineClamp:2, WebkitBoxOrient:"vertical", overflow:"hidden", wordBreak:"break-word" }}>
                        {chat.title.split(" — ").slice(1,2).join("") || chat.title}
                      </p>
                      <p style={{ fontSize:7, color:C.textMuted }}>{fmtDate(chat.updatedAt||chat.createdAt)}</p>
                    </div>
                    {deleteConfirm === chat.id
                      ? <div style={{ position:"absolute", top:3, right:2, display:"flex", gap:2, zIndex:10, background:"#0d0d0d", border:`1px solid ${C.red}30`, borderRadius:4, padding:"2px 3px" }}>
                          <button onClick={e=>{ e.stopPropagation(); handleDeleteChat(chat.id); }}
                            style={{ fontSize:7.5, background:`${C.red}20`, border:"none", color:C.red, borderRadius:3, padding:"1px 4px", cursor:"pointer", fontWeight:700 }}>Sí</button>
                          <button onClick={e=>{ e.stopPropagation(); setDeleteConfirm(null); }}
                            style={{ fontSize:7.5, background:"transparent", border:"none", color:C.textMuted, borderRadius:3, padding:"1px 3px", cursor:"pointer" }}>No</button>
                        </div>
                      : <button className="db" onClick={e=>{ e.stopPropagation(); setDeleteConfirm(chat.id); }}
                          style={{ position:"absolute", top:4, right:4, background:"transparent", border:"none", color:C.textMuted, cursor:"pointer", fontSize:8, lineHeight:1, opacity:0, transition:"opacity 0.13s", padding:"1px 2px", borderRadius:3 }}>✕</button>
                    }
                  </div>
                );
              })}
            </div>

            {/* Footer sidebar */}
            <div style={{ padding:"6px 8px", borderTop:`1px solid ${C.border}`, flexShrink:0 }}>
              <div style={{ fontSize:7.5, color:C.textMuted }}>
                <span style={{ color:moduleBadgeColor, fontWeight:700 }}>{moduleLabel}</span>{" · "}{p.icon} {r.icon}
              </div>
            </div>
          </div>
        )}

        {/* ══ SIDEBAR COLAPSADO — barra de íconos limpia ══ */}
        {!sidebarOpen && (
          <div style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", padding:"10px 0 8px", gap:2 }}>
            {[
              {
                label:"Nuevo chat",
                action: handleNewChat,
                active: false,
                svg: (
                  <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                    <path d="M9 4v10M4 9h10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
                  </svg>
                ),
              },
              {
                label:"Buscar",
                action: ()=>setSidebarOpen(true),
                svg: (
                  <svg width="17" height="17" viewBox="0 0 17 17" fill="none">
                    <circle cx="7.5" cy="7.5" r="4.5" stroke="currentColor" strokeWidth="1.4"/>
                    <path d="M11 11l3 3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
                  </svg>
                ),
              },
              {
                label:"Historial",
                action: ()=>setSidebarOpen(true),
                svg: (
                  <svg width="17" height="17" viewBox="0 0 17 17" fill="none">
                    <circle cx="8.5" cy="8.5" r="6" stroke="currentColor" strokeWidth="1.4"/>
                    <path d="M8.5 5.5v3.5l2 1.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                ),
              },
              {
                label:"Sugerencias",
                action: ()=>setSidebarOpen(true),
                svg: (
                  <svg width="17" height="17" viewBox="0 0 17 17" fill="none">
                    <path d="M8.5 2a5 5 0 0 1 2.5 9.3V13h-5v-1.7A5 5 0 0 1 8.5 2z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/>
                    <path d="M6 14.5h5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
                  </svg>
                ),
              },
              {
                label:"Análisis ADI",
                action: generateAnalysis,
                svg: (
                  <svg width="17" height="17" viewBox="0 0 17 17" fill="none">
                    <path d="M3 8.5L7 5l3.5 3.5L14 4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M3 13h11" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" opacity="0.4"/>
                  </svg>
                ),
              },
            ].map((item, i) => (
              <button key={i} onClick={item.action} title={item.label}
                style={{
                  width:36, height:36, borderRadius:8, border:"none",
                  background: item.active ? "rgba(14,165,233,0.12)" : "transparent",
                  color: item.active ? C.blue : C.textMuted,
                  cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center",
                  transition:"all 0.15s", flexShrink:0,
                }}
                onMouseEnter={e=>{ e.currentTarget.style.background="rgba(255,255,255,0.06)"; e.currentTarget.style.color=C.text; }}
                onMouseLeave={e=>{ e.currentTarget.style.background=item.active?"rgba(14,165,233,0.12)":"transparent"; e.currentTarget.style.color=item.active?C.blue:C.textMuted; }}>
                {item.svg}
              </button>
            ))}

            {/* Separador */}
            <div style={{ width:20, height:1, background:C.border, margin:"6px 0", flexShrink:0 }}/>

            {/* ADI badge — versión colapsada */}
            <div style={{ width:24, height:24, borderRadius:6, background:"linear-gradient(135deg,#00c2e8,#0e7fa8)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:10, fontWeight:900, color:"#fff", flexShrink:0, marginTop:2 }}>A</div>
          </div>
        )}
      </div>

      {/* ══════════════════════════════════════════
          ÁREA PRINCIPAL — SIEMPRE EL CHAT
          Mínimo 65% del panel (sidebar ≤ 35%)
      ══════════════════════════════════════════ */}
      <div style={{ flex:1, display:"flex", flexDirection:"column", minWidth:0, minWidth:"65%" }}>

        {/* ── Topbar chat */}
        <div style={{ padding:"9px 12px 8px", borderBottom:`1px solid ${C.border}`, background:"linear-gradient(135deg,rgba(129,140,248,0.04),rgba(14,165,233,0.02))", flexShrink:0 }}>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", gap:6 }}>
            <p style={{ fontSize:10.5, fontWeight:700, color:C.text, letterSpacing:"-0.2px", flex:1, minWidth:0, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
              {activeChat ? activeChat.title.split(" — ").slice(1,-1).join(" — ") || activeChat.title : "Chat ADI"}
            </p>
            {(loadingA||loadingC) && <div style={{ width:5, height:5, borderRadius:"50%", background:C.blue, animation:"blink 0.8s infinite", flexShrink:0 }}/>}
          </div>
          <div style={{ display:"flex", gap:3, marginTop:3, flexWrap:"wrap" }}>
            <span style={{ fontSize:7, padding:"1px 5px", borderRadius:3, background:`rgba(${moduleBadgeColor===C.blue?"14,165,233":moduleBadgeColor==="#00a8e8"?"0,168,232":"245,158,11"},0.1)`, color:moduleBadgeColor, fontWeight:700, textTransform:"uppercase", letterSpacing:"0.4px" }}>{moduleLabel}</span>
            <span style={{ fontSize:7, padding:"1px 5px", borderRadius:3, background:"rgba(14,165,233,0.05)", color:C.textSub }}>{filtro}</span>
            <span style={{ fontSize:7, padding:"1px 5px", borderRadius:3, background:"rgba(0,168,232,0.05)", color:"#00a8e8" }}>{p.icon} {p.label}</span>
            <span style={{ fontSize:7, padding:"1px 5px", borderRadius:3, background:"rgba(245,158,11,0.05)", color:C.amber }}>{r.icon} {r.label}</span>
          </div>
        </div>

        {/* ── CHAT — siempre visible. Placeholder si está vacío */}
        <div ref={scrollRef} style={{ flex:1, overflowY:"auto", padding:"14px 13px", display:"flex", flexDirection:"column", gap:14 }}>

          {/* Placeholder vacío — sin análisis ni historial */}
          {!hasAnalysis && !loadingA && !analysis && chatHistory.length === 0 && (
            <div style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:"20px 10px", textAlign:"center" }}>
              <div style={{ width:32, height:32, borderRadius:9, background:"rgba(129,140,248,0.12)", border:`1px solid rgba(129,140,248,0.2)`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:15, fontWeight:900, color:C.indigo, marginBottom:12 }}>A</div>
              <p style={{ fontSize:11, color:C.textSub, lineHeight:1.7, maxWidth:200 }}>
                Inicia un análisis o escribe una pregunta para comenzar
              </p>
              <p style={{ fontSize:9.5, color:C.textMuted, marginTop:8 }}>
                Usa el panel izquierdo →
              </p>
            </div>
          )}

          {/* Skeleton cargando */}
          {loadingA && !analysis && (
            <div>
              {[68,52,80,44,66,56,76].map((w,i)=>(
                <div key={i} style={{ height:7, width:`${w}%`, background:C.border, borderRadius:4, marginBottom:9, opacity:0.45, animation:`pulse 1.5s ${i*0.12}s infinite` }}/>
              ))}
              <p style={{ color:C.textMuted, fontSize:9, textAlign:"center", marginTop:14 }}>ADI está analizando...</p>
            </div>
          )}

          {/* Análisis + mensajes */}
          {analysis && <AdiBlocks text={analysis} loading={loadingA}/>}
          {visibleMsgs.slice(analysis ? 2 : 0).map((m,i,arr) => (
            <ChatMessageBubble key={i} m={m} i={i} total={arr.length} loadingC={loadingC}/>
          ))}
        </div>

        {/* ── INPUT */}
        <div style={{ padding:"7px 10px 9px", borderTop:`1px solid ${C.border}`, flexShrink:0, display:"flex", flexDirection:"column", gap:5 }}>

          {/* Sugerencias sobre el input (durante conversación activa) */}
          {(hasAnalysis || (activeChat && chatHistory.length > 0)) && showSugerencias && (
            <div style={{ padding:"7px 9px", background:C.surfaceAlt, borderRadius:7, border:`1px solid ${C.border}`, display:"flex", flexDirection:"column", gap:4 }}>
              <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:3 }}>
                <span style={{ fontSize:8, color:C.textMuted, fontWeight:700, textTransform:"uppercase", letterSpacing:"0.6px" }}>Sugerencias · {moduleLabel}</span>
                <button onClick={()=>setShowSugerencias(false)} style={{ background:"transparent", border:"none", color:C.textMuted, cursor:"pointer", fontSize:9 }}>✕</button>
              </div>
              {sugerencias.map((s,i) => (
                <button key={i}
                  onClick={()=>{ setChatInput(s); setShowSugerencias(false); inputRef.current?.focus(); }}
                  style={{ textAlign:"left", padding:"5px 7px", borderRadius:5, border:`1px solid ${C.border}`, background:"transparent", color:C.textSub, cursor:"pointer", fontSize:9.5, lineHeight:1.4, transition:"all 0.11s" }}
                  onMouseEnter={e=>{ e.currentTarget.style.borderColor=C.blue; e.currentTarget.style.color=C.text; }}
                  onMouseLeave={e=>{ e.currentTarget.style.borderColor=C.border; e.currentTarget.style.color=C.textSub; }}>
                  {s}
                </button>
              ))}
            </div>
          )}

          {/* Barra input */}
          <div style={{ display:"flex", gap:4, alignItems:"center" }}>
            <button onClick={()=>setShowSugerencias(v=>!v)} title="Sugerencias"
              style={{ width:26, height:26, borderRadius:5, border:`1px solid ${showSugerencias?C.blue:C.border}`, background:showSugerencias?"rgba(14,165,233,0.08)":"transparent", color:showSugerencias?C.blue:C.textMuted, cursor:"pointer", fontSize:12, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, transition:"all 0.12s" }}>
              💡
            </button>
            <input
              ref={inputRef}
              value={chatInput} onChange={e=>setChatInput(e.target.value)}
              onKeyDown={e=>{ if(e.key==="Enter"&&!e.shiftKey){ e.preventDefault(); sendChat(); } }}
              placeholder="Pregunta a ADI..."
              disabled={loadingC||loadingA}
              style={{ flex:1, background:C.surface, border:`1px solid ${C.border}`, borderRadius:6, padding:"6px 9px", fontSize:10.5, color:C.text, outline:"none", caretColor:C.blue, minWidth:0 }}
              onFocus={e=>e.target.style.borderColor=C.blue}
              onBlur={e=>e.target.style.borderColor=C.border}
            />
            <button onClick={sendChat} disabled={loadingC||loadingA||!chatInput.trim()}
              style={{ width:28, height:26, borderRadius:5, border:"none", background:chatInput.trim()?"rgba(14,165,233,0.15)":"transparent", color:chatInput.trim()?C.blue:C.textMuted, fontSize:14, cursor:chatInput.trim()?"pointer":"default", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
              →
            </button>
          </div>

          {/* Footer */}
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
            {(hasAnalysis || (activeChat && chatHistory.length > 0))
              ? <button onClick={generateAnalysis} disabled={loadingA}
                  style={{ fontSize:8.5, fontWeight:600, border:"none", background:"transparent", color:loadingA?C.textMuted:C.textSub, cursor:loadingA?"not-allowed":"pointer", padding:0, transition:"color 0.12s" }}
                  onMouseEnter={e=>{ if(!loadingA) e.currentTarget.style.color=C.blue; }}
                  onMouseLeave={e=>{ e.currentTarget.style.color=C.textSub; }}>
                  ↻ Nuevo análisis
                </button>
              : <span/>
            }
            <p style={{ fontSize:7.5, color:C.textMuted }}>Claude Sonnet</p>
          </div>
        </div>
      </div>
    </aside>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// SELECTOR CONTEXTO ADI
// ════════════════════════════════════════════════════════════════════════════
function ContextSelector({ adiProfile, userRole, onChange }) {
  const [open, setOpen] = useState(false);
  const p=ADI_PROFILES[adiProfile]; const r=USER_ROLES[userRole];
  return (
    <div style={{ position:"relative" }}>
      <button onClick={()=>setOpen(!open)} style={{
        display:"flex", alignItems:"center", gap:7, padding:"5px 11px", borderRadius:7,
        border:`1px solid ${open?C.indigo:C.border}`, background:open?"rgba(129,140,248,0.08)":"transparent",
        color:C.text, cursor:"pointer", fontSize:11
      }}>
        <span style={{ fontSize:13 }}>{p.icon}</span>
        <span style={{ color:C.indigo, fontWeight:700 }}>{p.label}</span>
        <span style={{ color:C.textMuted }}>·</span>
        <span style={{ fontSize:13 }}>{r.icon}</span>
        <span style={{ color:C.amber, fontWeight:600 }}>{r.label}</span>
        <span style={{ fontSize:9, color:C.textMuted, marginLeft:2 }}>▾</span>
      </button>
      {open && (
        <div style={{ position:"absolute", top:"calc(100% + 6px)", right:0, zIndex:200, background:"#0d0d0d", border:`1px solid ${C.border}`, borderRadius:10, padding:14, minWidth:340, boxShadow:"0 16px 40px rgba(0,0,0,0.6)" }}>
          <p style={{ fontSize:9, color:C.textMuted, textTransform:"uppercase", letterSpacing:"0.8px", marginBottom:8 }}>Perfil Industria</p>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:6, marginBottom:14 }}>
            {Object.entries(ADI_PROFILES).map(([k,v])=>(
              <button key={k} onClick={()=>onChange("adiProfile",k)} style={{ padding:"7px 10px", borderRadius:7, border:`1px solid ${adiProfile===k?C.indigo:C.border}`, background:adiProfile===k?"rgba(129,140,248,0.1)":"transparent", color:adiProfile===k?C.indigo:C.textSub, cursor:"pointer", fontSize:11, fontWeight:600, textAlign:"left", display:"flex", alignItems:"center", gap:6 }}>
                <span>{v.icon}</span>{v.label}
              </button>
            ))}
          </div>
          <p style={{ fontSize:9, color:C.textMuted, textTransform:"uppercase", letterSpacing:"0.8px", marginBottom:8 }}>Rol Usuario</p>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:6 }}>
            {Object.entries(USER_ROLES).map(([k,v])=>(
              <button key={k} onClick={()=>onChange("userRole",k)} style={{ padding:"7px 10px", borderRadius:7, border:`1px solid ${userRole===k?C.amber:C.border}`, background:userRole===k?"rgba(245,158,11,0.08)":"transparent", color:userRole===k?C.amber:C.textSub, cursor:"pointer", fontSize:11, fontWeight:600, textAlign:"left", display:"flex", alignItems:"center", gap:6 }}>
                <span>{v.icon}</span>{v.label}
              </button>
            ))}
          </div>
          <button onClick={()=>setOpen(false)} style={{ marginTop:12, width:"100%", padding:"7px", borderRadius:6, border:`1px solid ${C.border}`, background:"transparent", color:C.textSub, cursor:"pointer", fontSize:11 }}>Cerrar</button>
        </div>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// APP PRINCIPAL
// ════════════════════════════════════════════════════════════════════════════
export default function ADISentric() {
  const [modulo,     setModulo]     = useState("ventas");
  const [filtro,     setFiltro]     = useState("Anual");
  const [filtros,    setFiltros]    = useState({ marcas:[], sfamilias:[], canales:[], sucursales:[], clientes:[], skus:[] });
  const [adiProfile, setAdiProfile] = useState("retail");
  const [userRole,   setUserRole]   = useState("gerente_comercial");

  // ── Panel ADI width — arrastrable, mínimo 20% del viewport
  const [panelWidth,  setPanelWidth]  = useState(340);
  const isDragging                    = useRef(false);
  const dragStartX                    = useRef(0);
  const dragStartW                    = useRef(0);
  const containerRef                  = useRef(null);

  const MIN_PCT = 0.20; // 20% mínimo para cada lado

  const onDragStart = useCallback((e) => {
    isDragging.current  = true;
    dragStartX.current  = e.clientX;
    dragStartW.current  = panelWidth;
    document.body.style.cursor    = "col-resize";
    document.body.style.userSelect= "none";
  }, [panelWidth]);

  useEffect(() => {
    const onMove = (e) => {
      if (!isDragging.current) return;
      const containerW = containerRef.current?.offsetWidth || window.innerWidth;
      const minW = Math.round(containerW * MIN_PCT);
      const maxW = Math.round(containerW * (1 - MIN_PCT));
      const delta = e.clientX - dragStartX.current;   // mover der = panel crece
      const next  = Math.min(maxW, Math.max(minW, dragStartW.current + delta));
      setPanelWidth(next);
    };
    const onUp = () => {
      if (!isDragging.current) return;
      isDragging.current            = false;
      document.body.style.cursor    = "";
      document.body.style.userSelect= "";
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup",   onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup",   onUp);
    };
  }, []);

  const MESES = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic","Anual"];
  const MOD   = { ventas:{ label:"Ventas", color:C.blue }, margenes:{ label:"Márgenes", color:"#00a8e8" }, inventario:{ label:"Inventario", color:C.amber } };

  const handleContextChange = (key, val) => key==="adiProfile" ? setAdiProfile(val) : setUserRole(val);

  return (
    <div style={{ height:"100vh", background:C.bg, fontFamily:"'DM Sans','Segoe UI',sans-serif", color:C.text, display:"flex", flexDirection:"column", overflow:"hidden" }}>

      <header style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"0 22px", height:50, borderBottom:`1px solid ${C.border}`, background:`linear-gradient(90deg,${C.bg} 0%,#0d0d0d 100%)`, flexShrink:0 }}>
        <div style={{ display:"flex", alignItems:"center", gap:18 }}>
          <div style={{ display:"flex", alignItems:"center", gap:8 }}>
            <div style={{ width:29, height:29, borderRadius:7, background:"linear-gradient(135deg,#00c2e8,#0e7fa8)", display:"flex", alignItems:"center", justifyContent:"center", fontWeight:900, fontSize:13, color:"#fff" }}>A</div>
            <div>
              <span style={{ fontWeight:800, fontSize:13.5, letterSpacing:"-0.5px" }}>ADI</span>
              <span style={{ fontWeight:400, fontSize:13.5, letterSpacing:"-0.3px", color:C.textSub }}> Sentrix</span>
            </div>
          </div>
          <div style={{ width:1, height:16, background:C.border }}/>
          <nav style={{ display:"flex", gap:2 }}>
            {Object.entries(MOD).map(([k,v])=>(
              <button key={k} onClick={()=>setModulo(k)} style={{
                padding:"5px 13px", borderRadius:6, fontSize:11.5, fontWeight:700, border:"none",
                background:modulo===k?`rgba(${k==="ventas"?"14,165,233":k==="margenes"?"16,185,129":"245,158,11"},0.1)`:"transparent",
                color:modulo===k?v.color:C.textSub, borderBottom:modulo===k?`2px solid ${v.color}`:"2px solid transparent",
                cursor:"pointer", transition:"all 0.15s"
              }}>{v.label}</button>
            ))}
          </nav>
        </div>
        <div style={{ display:"flex", gap:3 }}>
          {MESES.map(m=>(
            <button key={m} onClick={()=>setFiltro(m)} style={{
              padding:"3px 8px", borderRadius:4, fontSize:9.5, fontWeight:600,
              border:`1px solid ${filtro===m?C.blue:C.border}`,
              background:filtro===m?"rgba(14,165,233,0.08)":"transparent",
              color:filtro===m?C.blue:C.textSub, cursor:"pointer"
            }}>{m}</button>
          ))}
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:12 }}>
          <ContextSelector adiProfile={adiProfile} userRole={userRole} onChange={handleContextChange}/>
          <div style={{ display:"flex", alignItems:"center", gap:5 }}>
            <div style={{ width:5, height:5, borderRadius:"50%", background:C.green, boxShadow:`0 0 5px ${C.green}` }}/>
            <span style={{ fontSize:9.5, color:C.textSub }}>Live <strong style={{ color:C.text }}>14-04-2026</strong></span>
          </div>
        </div>
      </header>

      <div style={{ padding:"7px 22px", borderBottom:`1px solid ${C.border}`, background:C.surfaceAlt, flexShrink:0 }}>
        <FiltrosGlobales filtros={filtros} onChange={setFiltros}/>
      </div>

      <div ref={containerRef} style={{ display:"flex", flex:1, overflow:"hidden" }}>

        <PanelADI
          modulo={modulo} filtro={filtro}
          marca={filtros.marcas[0]||"Anual"}
          adiProfile={adiProfile} userRole={userRole}
          width={panelWidth}
        />

        {/* ── Divisor arrastrable ── */}
        <div
          onMouseDown={onDragStart}
          onMouseEnter={e=>{ e.currentTarget.querySelector(".divider-line").style.background=C.blue; e.currentTarget.querySelectorAll(".divider-dot").forEach(d=>d.style.opacity="0.9"); }}
          onMouseLeave={e=>{ e.currentTarget.querySelector(".divider-line").style.background=C.border; e.currentTarget.querySelectorAll(".divider-dot").forEach(d=>d.style.opacity="0.5"); }}
          style={{
            width:5, flexShrink:0, cursor:"col-resize", position:"relative",
            background:"transparent", zIndex:50,
            display:"flex", alignItems:"center", justifyContent:"center",
          }}
          title="Arrastrar para redimensionar"
        >
          <div className="divider-line" style={{
            width:1, height:"100%", background:C.border,
            transition:"background 0.15s", pointerEvents:"none",
          }}/>
          <div style={{
            position:"absolute", top:"50%", left:"50%",
            transform:"translate(-50%,-50%)",
            display:"flex", flexDirection:"column", gap:3,
            pointerEvents:"none",
          }}>
            {[0,1,2].map(i=>(
              <div key={i} className="divider-dot" style={{ width:3, height:3, borderRadius:"50%", background:C.textMuted, opacity:0.5, transition:"opacity 0.15s" }}/>
            ))}
          </div>
        </div>

        <main style={{ flex:1, overflowY:"auto", padding:"18px 20px", display:"flex", flexDirection:"column", gap:0, minWidth:0 }}>
          <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:14 }}>
            <span style={{ fontSize:10.5, color:C.textSub }}>ADI Sentrix</span>
            <span style={{ fontSize:10.5, color:C.textMuted }}>/</span>
            <span style={{ fontSize:10.5, color:MOD[modulo].color, fontWeight:700 }}>{MOD[modulo].label}</span>
            <span style={{ fontSize:10.5, color:C.textMuted }}>·</span>
            <span style={{ fontSize:10.5, color:C.textSub }}>{filtro}</span>
            {filtros.marcas.length>0 && <><span style={{ fontSize:10.5, color:C.textMuted }}>·</span><span style={{ fontSize:10.5, color:C.amber }}>{filtros.marcas.join(", ")}</span></>}
          </div>
          {modulo==="ventas"     && <ModuloVentas filtro={filtro} filtros={filtros}/>}
          {modulo==="margenes"   && <ModuloMargenes filtro={filtro} filtros={filtros}/>}
          {modulo==="inventario" && <ModuloInventario filtro={filtro} filtros={filtros}/>}
        </main>

      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;0,9..40,800;0,9..40,900&display=swap');
        * { box-sizing:border-box; margin:0; padding:0; }
        ::-webkit-scrollbar { width:3px; height:3px; }
        ::-webkit-scrollbar-track { background:#080808; }
        ::-webkit-scrollbar-thumb { background:#32195a; border-radius:4px; }
        ::-webkit-scrollbar-thumb:hover { background:#5a3490; }
        ::-webkit-scrollbar-corner { background:#080808; }
        @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0} }
        @keyframes pulse { 0%,100%{opacity:0.4} 50%{opacity:0.9} }
        @keyframes scanline { 0%{left:-60%} 100%{left:120%} }
        @keyframes chartScan { 0%{left:-40%} 100%{left:120%} }
        @keyframes livePulse {
          0%  { box-shadow: 0 0 0 0 rgba(0,194,232,0.5); transform:scale(1); }
          60% { box-shadow: 0 0 0 8px rgba(0,194,232,0); transform:scale(1.15); }
          100%{ box-shadow: 0 0 0 0 rgba(0,194,232,0);  transform:scale(1); }
        }
        button:focus { outline:none; }
        input::placeholder { color:#707070; }
        .adi-divider:hover > div:first-child { background:${C.blue} !important; }
      `}</style>
    </div>
  );
}
