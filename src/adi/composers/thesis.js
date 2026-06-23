/* === adi/composers/thesis.js ===
 * ADI conversacional extraído de 41cc33d8 · verbatim · solo imports agregados.
 * Importa motor (engine/) + datos/config sellados. Cero cambio de cálculo. */
import { MECHANISM_REGISTRY } from "../../config/mechanisms.js";
import { applyScenarioToClientesMargen, applyScenarioToClientesVentas, applyScenarioToSkuInventario } from "../../engine/scenarios.js";

export function composeBusinessThesisOpener(scenarioId) {
  if (!scenarioId) return null;
  const t = deriveBusinessThesis(scenarioId);
  if (!t || t.titular === "ninguno") return null; // sin patrones → cae al teaser genérico

  if (t.requires_review || t.titular === "multiple") {
    return `Tu negocio tiene dos frentes grandes de naturaleza distinta que conviene mirar por separado.`;
  }

  if (t.es_causal && t.titular === "dependencia") {
    // crisis = alguna entity_clave opera bajo media benchmark (MISMA señal · MAT-B3/C · no se inventa)
    const benchmark = 30.1;
    const clientes = applyScenarioToClientesMargen(scenarioId);
    const agudo = (t.entities_clave || []).some(name => {
      const c = clientes.find(x => x.nombre === name);
      return c && c.margen != null && c.margen < benchmark / 2;
    });
    return agudo
      ? `Tu negocio depende de unas pocas cuentas grandes, y ahora una de ellas se está deteriorando — la concentración dejó de ser un riesgo de fondo y se volvió el problema del mes.`
      : `Tu negocio depende de unas pocas cuentas grandes, y esa concentración es lo que te está comprimiendo el margen. El resto son consecuencias de eso.`;
  }

  // titular coronado por severidad (independiente · capital/erosion/baja_calidad) · tesis sin cifras
  const _porSeveridad = {
    capital: `El frente principal es capital inmovilizado en inventario: hay stock que no rota y conviene liberarlo.`,
    erosion: `El frente principal es la erosión de margen en tus cuentas: estás vendiendo con menos rentabilidad de la que corresponde.`,
    baja_calidad: `El frente principal es la calidad del crecimiento: estás creciendo, pero a costa del margen unitario.`,
  };
  return _porSeveridad[t.titular] || null;
}

export function deriveBusinessThesis(scenarioId, override) {
  const benchmark = 30.1; // umbral de cartera (consistente con el código · const local)
  const scan = scanMechanisms(scenarioId, override);
  const clientes = applyScenarioToClientesMargen(scenarioId, override);
  const skus = applyScenarioToSkuInventario(scenarioId, override);

  // ── PASO 1 · 4 detectores binarios ──
  // P1 · baja calidad de crecimiento: instancias con crecimiento_pct≥10 && gap_margen_pp≥6
  const _p1m = (scan && scan.quality_of_growth_deterioration) || {};
  const _p1inst = (_p1m.instances || []).filter(i => (i.crecimiento_pct || 0) >= 10 && (i.gap_margen_pp || 0) >= 6);
  const P1 = {
    patron: "baja_calidad",
    activo: _p1inst.length > 0,
    entities: _p1inst.map(i => i.clientName),
    magnitud_K: Math.round(_p1inst.reduce((s, i) => s + (i.contribucion_perdida_M || 0), 0) * 1000),
    naturaleza: "flujo",
  };

  // P2 · dependencia de cuentas concentradas: aggregate.top3_participacion_pct ≥ 50
  const _p2agg = (scan && scan.customer_dependency_risk && scan.customer_dependency_risk.aggregate) || {};
  const P2 = {
    patron: "dependencia",
    activo: (_p2agg.top3_participacion_pct || 0) >= 50,
    entities: _p2agg.top3_names || [],
    magnitud_K: Math.round((_p2agg.top3_contribucion_M || 0) * 1000),
    naturaleza: "exposicion",
  };

  // P3 · erosión de margen: GENÉRICO (anti-hardcode · sin nombres fijos) · cuentas con margen < benchmark
  const _p3acc = clientes.filter(c => c.margen != null && c.margen < benchmark);
  const P3 = {
    patron: "erosion",
    activo: _p3acc.length > 0,
    entities: _p3acc.map(c => c.nombre),
    magnitud_K: Math.round(_p3acc.reduce((s, c) => s + (c.contribucion || 0), 0)),
    naturaleza: "flujo",
  };

  // P4 · capital atrapado: SKUs con DOH > 120 (umbral canónico de sobrestock · L57) · independiente
  const _p4sku = skus.filter(s => (s.doh || 0) > 120);
  const P4 = {
    patron: "capital",
    activo: _p4sku.length > 0,
    entities: _p4sku.map(s => s.sku),
    magnitud_K: Math.round(_p4sku.reduce((s, k) => s + (k.stockUSD || 0), 0) / 1000),
    naturaleza: "stock",
  };

  const detectores = { P1, P2, P3, P4 };

  // ── PASO 2-3 · dominancia + coronación (núcleo puro) ──
  const coronacion = _resolveThesisDominance(detectores);

  return Object.assign({}, coronacion, { _detectores: detectores }); // _detectores para telemetría/tests · no es texto
}

export function _resolveThesisDominance(detectores) {
  const { P1, P2, P3, P4 } = detectores;
  const activos = [P1, P2, P3, P4].filter(p => p && p.activo);
  const _inter = (a, b) => { const s = new Set(b || []); return (a || []).filter(x => s.has(x)); };

  let titular = "ninguno", requires_review = false, es_causal = false, raiz = null;
  let sintomas = [], secundarios = [];

  // ── 2a · CAUSAL · dependencia (P2) es RAÍZ si comparte cuentas con erosión (P3) o baja_calidad (P1) ──
  if (P2 && P2.activo) {
    const causados = [];
    if (P3 && P3.activo && _inter(P2.entities, P3.entities).length > 0) causados.push(P3);
    if (P1 && P1.activo && _inter(P2.entities, P1.entities).length > 0) causados.push(P1);
    if (causados.length > 0) {
      es_causal = true;
      titular = "dependencia";
      raiz = "dependencia";
      sintomas = causados.map(p => p.patron);
      secundarios = activos.filter(p => p !== P2 && !causados.includes(p)).map(p => p.patron);
    }
  }

  // ── 2b · SEVERIDAD (sin causalidad) · corona SOLO si naturaleza comparable u orden evidente ──
  if (!es_causal) {
    if (activos.length === 0) {
      titular = "ninguno";
    } else if (activos.length === 1) {
      titular = activos[0].patron;
    } else {
      const byMag = [...activos].sort((a, b) => (b.magnitud_K || 0) - (a.magnitud_K || 0));
      const naturalezas = new Set(activos.map(p => p.naturaleza));
      // orden evidente = el mayor ≥ 3× el segundo (diferencia de orden · misma unidad $K)
      const ordenEvidente = byMag.length >= 2 && (byMag[1].magnitud_K || 0) > 0 &&
        (byMag[0].magnitud_K || 0) >= 3 * (byMag[1].magnitud_K || 0);
      if (naturalezas.size === 1) {
        // misma naturaleza · comparable · corona el mayor
        titular = byMag[0].patron;
        secundarios = byMag.slice(1).map(p => p.patron);
      } else if (ordenEvidente) {
        // naturalezas distintas pero diferencia de ORDEN evidente · corona el grande (PASO 2b)
        titular = byMag[0].patron;
        secundarios = byMag.slice(1).map(p => p.patron);
      } else {
        // naturalezas incomparables + magnitudes del mismo orden · NO forzar ganador
        titular = "multiple";
        requires_review = true;
        secundarios = activos.map(p => p.patron);
      }
    }
  }

  const titularDet = activos.find(p => p.patron === titular);
  const entities_clave = es_causal ? (P2.entities || []) : (titularDet ? titularDet.entities : []);

  return {
    titular,
    requires_review,
    es_causal,
    raiz,
    sintomas,
    secundarios,
    entities_clave,
    confianza: activos.length > 0 ? "presente" : "ausente", // BINARIA v1 · derivada (NO texto hardcoded)
  };
}

export function scanMechanisms(scenarioId, override) {
  const ventas = applyScenarioToClientesVentas(scenarioId, override);
  const margenes = applyScenarioToClientesMargen(scenarioId, override);
  const totalVentas = ventas.reduce((s, c) => s + c.actual, 0);
  const totalContribucion = margenes.reduce((s, c) => s + c.contribucion, 0);
  const clientNames = ventas.map(c => c.nombre);

  const scan = {};

  for (const [mechanismId, mechanism] of Object.entries(MECHANISM_REGISTRY)) {
    const instances = [];

    for (const clientName of clientNames) {
      if (mechanism.detect(clientName, scenarioId)) {
        const evidence = mechanism.gatherEvidence(clientName, scenarioId);
        if (evidence) {
          const severity = mechanism.severityOfInstance(evidence);
          instances.push({ ...evidence, severity });
        }
      }
    }

    // Sort instances by materiality descending
    if (mechanismId === "commercial_erosion") {
      instances.sort((a, b) => b.recuperable_at_target_3_5 - a.recuperable_at_target_3_5);
    } else if (mechanismId === "quality_of_growth_deterioration") {
      instances.sort((a, b) => b.contribucion_perdida_M - a.contribucion_perdida_M);
    } else if (mechanismId === "customer_dependency_risk") {
      instances.sort((a, b) => b.contribucion_M - a.contribucion_M);
    }

    let aggregateMetrics = {};

    if (mechanismId === "commercial_erosion" && instances.length > 0) {
      const total_recuperable_3_5 = instances.reduce((s, i) => s + i.recuperable_at_target_3_5, 0);
      const total_recuperable_3_0 = instances.reduce((s, i) => s + i.recuperable_at_bestPractice_3_0, 0);

      // BRIEF #15-bis · FIX 1
      // pct_of_total_sales calcula sobre TOP3 (que es lo que el composer muestra),
      // NO sobre todas las instances. Adicionalmente: corregir bug de unidad ·
      // ventas_M está en M ($M, equivalente a 1000K), totalVentas viene de
      // c.actual que está en K. La conversión correcta es sum_ventas_M * 1000
      // dividido por totalVentas_K. El bug previo aplicaba esa multiplicación
      // sobre TODAS las instances, sumando hasta 100% en Crisis o 76.7% en Tensión.
      const top3_instances = instances.slice(0, 3);
      const sum_ventas_top3_M = top3_instances.reduce((s, i) => s + i.ventas_M, 0);
      const sum_ventas_top3_K = sum_ventas_top3_M * 1000;

      aggregateMetrics = {
        recuperable_total_K: Math.round(total_recuperable_3_5),
        recuperable_total_M_at_3_0: +(total_recuperable_3_0 / 1000).toFixed(2),
        recuperable_total_M_at_3_5: +(total_recuperable_3_5 / 1000).toFixed(2),
        pct_of_total_sales: +((sum_ventas_top3_K / totalVentas) * 100).toFixed(1),
        pct_of_total_contribution: +((total_recuperable_3_5 / totalContribucion) * 100).toFixed(1),
        instances_count: instances.length,
        top3_count: top3_instances.length,
      };
    }

    if (mechanismId === "quality_of_growth_deterioration" && instances.length > 0) {
      const total_contribucion_perdida = instances.reduce((s, i) => s + i.contribucion_perdida_M, 0);
      aggregateMetrics = {
        contribucion_perdida_M: +total_contribucion_perdida.toFixed(2),
        instances_count: instances.length,
        crecimiento_range: {
          min: Math.min(...instances.map(i => i.crecimiento_pct)),
          max: Math.max(...instances.map(i => i.crecimiento_pct)),
        },
      };
    }

    if (mechanismId === "customer_dependency_risk" && instances.length > 0) {
      const top3 = instances.slice(0, 3);
      const top3_participacion = top3.reduce((s, i) => s + i.participacion_pct, 0);
      const top3_contribucion = top3.reduce((s, i) => s + i.contribucion_M, 0);
      aggregateMetrics = {
        instances_count: instances.length,
        top3_names: top3.map(i => i.clientName),
        top3_participacion_pct: +top3_participacion.toFixed(1),
        top3_contribucion_M: +top3_contribucion.toFixed(2),
      };
    }

    scan[mechanismId] = {
      mechanismId,
      nombre: mechanism.nombre,
      nombre_capitalizado: mechanism.nombre_capitalizado,
      clausula: mechanism.clausula,
      descripcion_humana: mechanism.descripcion_humana,
      triggered: instances.length > 0,
      instances,
      aggregate: aggregateMetrics,
      relations: mechanism.relations,
    };
  }

  return scan;
}
