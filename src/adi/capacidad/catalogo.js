/* === src/adi/capacidad/catalogo.js · EL CATÁLOGO DE LA CAPACIDAD — Etapa 3, corte 8 (owner 2026-09-25) ═══════
 * `_ADI_DISENO_FLUJO_V2.md` §E: «el catálogo se GENERA, no se escribe». Este archivo NO declara un solo tema,
 * concepto, cierre o umbral a mano: cada campo sale de una tabla que YA es la fuente única del Core (la misma
 * que usa el validador del encargo, `src/adi/encargo/esquema.js`, y el compositor de la Entrega). Si el Core
 * agrega un dominio o una métrica, este catálogo crece SOLO, sin tocar una línea acá.
 *
 * LEY DEL OWNER que gobierna este archivo (memoria `adi-flujo-producto-complemento`): «el LLM ve a ADI como UNA
 * capacidad empresarial coherente, nunca como mecanismos internos» — por eso el catálogo nombra TEMAS, CONCEPTOS
 * y CIERRES (el vocabulario de negocio del contrato del encargo), nunca nombres de función ni de tool interna
 * (`compareEntities`, `simulateGeneral` no aparecen en la salida — se usan ADENTRO solo para VERIFICAR que el
 * productor existe, ver `_cierresDelTema`). Y «cualquier solicitud» significa cualquiera que ESTE catálogo
 * derive del Core real — nunca una capacidad inventada.
 *
 * SIN UNA SOLA CIFRA (regla dura del encargo de esta pieza): este módulo no importa ningún dataset de negocio ni
 * lee `fig()` — describe QUÉ existe, no CUÁNTO vale. Los tres campos que sí dependen del tenant activo (períodos
 * vigentes por tema y los 3 ejemplos de cada eje) leen NOMBRES y FECHAS declaradas, nunca un monto.
 *
 * PRODUCTOR REAL, POR CANDADO (contrato §E): cada entrada de `temas[].conceptos` trae `ejes` = SOLO los ejes con
 * productor de verdad (`ejesConProductor`, `esquema.js` — la misma tabla que usa el validador para
 * `concepto_sin_productor`); una clave de referencia (`referencia:true` en `notario/lexico.js`) declara
 * `referencia:true` en vez de fingir un eje de entidad — se cita desde POLICY/perfil, no se ordena por cuenta.
 * `cierres` verifica contra `TOOL_CONTRACTS`/`toolNames()` (el registro real de tools) y contra las 4 rutas de
 * `entrega/componer.js` que de verdad existen — si mañana una de esas exportaciones desaparece, el IMPORT de
 * este archivo revienta antes de que el catálogo mienta. */
import { DOMINIOS_REGISTRO, idsDeDominios } from "../../config/contract/dominios.js";
import { CLAVES_DE_METRICA } from "../notario/lexico.js";
import { CONCEPT_DEFS } from "../sentrix/glossary.js";
import { AXES, axisEntityNames, entityIndexStats } from "../oracle/entityIndex.js";
import { CALCULOS, BLOQUEADOS } from "../../ingesta/plantilla/motorKpi.js";
import { AUSENCIAS_DEL_DATO, ausenciasDe } from "../../config/contract/ausencias.js";
import { ASSUMPTIONS } from "../../config/contract/assumptionRegistry.js";
import { CRITERIOS } from "../agente/prioridadIntegrada.js";
import { definicionesDeEstados } from "../notario/estados.js";
import {
  CIERRES, USAR_VALORES, PROFUNDIDAD_VALORES, TIPOS_DE_PREMISA,
  ejesConProductor, EJES,
} from "../encargo/esquema.js";
import { TOOLS } from "../oracle/toolRegistry.js";
import {
  componerEntregaBrechaComercial, componerEntregaCobranza, componerEntregaInventario, componerEntregaMultidominio,
} from "../entrega/componer.js";
import { periodoDeclaradoDe } from "../../config/contract/bandaTamano.js";
import { monedaDelNegocio } from "../../config/moneda.js";
import { guiaDeUniverso } from "./ensenar.js";
import { validarEncargo } from "../encargo/validar.js";   // SOLO para preguntarle al validador dónde corre cada supuesto (la misma tabla que decide, nunca una copia)
import { getTenantData } from "../../data/tenantStore.js";
import { ESCENARIO_INICIAL } from "../../config/scenarios.js";
import { buildMesaFlujo } from "../sentrix/mesaFlujo.js";

const _porClave = new Map(CLAVES_DE_METRICA.map((m) => [m.clave, m]));

/* ── VERIFICACIÓN DE PRODUCTOR (el candado del corte) ────────────────────────────────────────────────────────
 * Un concepto se OFRECE para consultar solo si `consultar` lo puede responder: tiene ≥1 eje con productor. Una REFERENCIA de la casa (el benchmark, el nivel de carga, el piso de rotación… — `notario/lexico.js:referencia:true`) y un
 * ESCALAR DEL NEGOCIO sin eje de entidad propio (`negocio:true` — hoy `margen_promedio`) NO se piden como concepto: `esquema.js` los declara con productor `[]` A PROPÓSITO (se citan en el Marco o en la comparación de una Entrega,
 * con su origen), y `consultar` los rechaza con `concepto_sin_productor`. Hasta el ensayo 6 el catálogo los listaba entre los conceptos (A01|1|4: `margen_promedio` ofrecido, `consultar` lo rechazó): ahora viajan APARTE, en
 * `temas[].referencias`, diciendo lo que son. Cualquier otra clave sin eje es una entrada sin productor de verdad: el gate la caza (carnada de escalabilidad y recorrido del catálogo, `_capacidad_gate.mjs`). */
function _conceptoServible(clave) {
  return ejesConProductor(clave).length > 0;
}
function _esReferenciaOEscalar(clave) {
  const m = _porClave.get(clave);
  return Boolean(m && (m.referencia || m.negocio)) && ejesConProductor(clave).length === 0;
}

/* Las 4 rutas fijas de `entrega/componer.js` son el productor REAL de `lectura`/`decision` por tema (contrato
 * §1.1). Se referencian como funciones (no como strings) para que un renombre o un retiro accidental de una de
 * ellas TIRE el import de este archivo — «una entrada sin productor pone el gate en rojo» empieza acá, antes de
 * que el gate corra una sola aserción. */
const _RUTA_POR_TEMA = {
  comercial: componerEntregaBrechaComercial,
  cobranza: componerEntregaCobranza,
  inventario: componerEntregaInventario,
};
const _RUTA_MULTIDOMINIO = componerEntregaMultidominio;

/* `compareEntities`/`simulateGeneral`/`simulateCarga`/`simulateCapital`/`simulateCosto`/`defineConcept` tienen
 * que EXISTIR en el registro real de tools (`toolRegistry.js:TOOLS`) — la misma fuente que ejecuta el Core, no
 * una lista aparte. Si el registro pierde una de estas tools, `_TOOL(x)` deja de encontrarla y la entrada del
 * catálogo que la cita se apaga sola (ver `_cierresDelTema`), en vez de anunciar una capacidad que ya no existe. */
const _TOOL = (nombre) => (Object.prototype.hasOwnProperty.call(TOOLS, nombre) ? TOOLS[nombre] : null);

/* CIERRES POR TEMA — contrato `_ADI_CONTRATO_ENCARGO_V1.md` §3.4, verificado leyendo `lecturasDe.js`/`componer.js`
 * (la misma tabla que ese documento ya deja escrita, con cita). `cifra` corre para todo tema ACTIVO: la ruta la
 * decide `lecturasDe.js` (`_pasosCifra`, por concepto y eje) y no hay un único productor central que citar acá
 * más allá de "el concepto tiene productor" (ya lo cubre `_conceptoServible`). `definicion` corre para todo tema
 * (`defineConcept` es transversal — no depende del tema, solo del concepto pedido). */
function _cierresDelTema(temaId) {
  const activo = idsDeDominios().includes(temaId);
  const defineConcept = _TOOL("defineConcept");
  const compareEntities = _TOOL("compareEntities");
  return {
    cifra: activo,
    lectura: Boolean(activo && _RUTA_POR_TEMA[temaId]),
    decision: Boolean(activo && _RUTA_POR_TEMA[temaId]),   // `prioridadIntegrada` corre sobre la MISMA lectura del tema
    // comparación: `_pasosComparacion` (lecturasDe.js) llama SIEMPRE a `compareEntities` — hoy esa tool sirve las
    // métricas de `metricRegistry` (comercial/inventario). Cobranza queda DECLARADA `decision_pendiente` (contrato
    // §7.1 punto 4: «dos cifra de mesaFlujo lado a lado + la diferencia», capacidad real pero AÚN no cableada en
    // `lecturasDe.js` — no se inventa acá lo que ese corte todavía no construyó).
    comparacion: temaId === "cobranza" ? "decision_pendiente" : Boolean(activo && compareEntities),
    // simulación: por tema, según `_ADI_CONTRATO_ENCARGO_V1.md` §3.5 — comercial (simulateGeneral/simulateCarga/
    // simulateCosto) e inventario (simulateCapital, solo SKU, "liberar capital frenado"); cobranza sin productor.
    simulacion: temaId === "comercial"
      ? Boolean(_TOOL("simulateGeneral") && _TOOL("simulateCarga") && _TOOL("simulateCosto"))
      : temaId === "inventario" ? Boolean(_TOOL("simulateCapital")) : false,
    definicion: Boolean(activo && defineConcept),
  };
}

/* ── LO QUE SE PUEDE DEFINIR ──────────────────────────────────────────────────────────────────────────────────
 * `cierre: definicion` responde con la definición CURADA del glosario (`defineConcept`): un id que el glosario no resuelve no tiene qué responder. El catálogo ofrece SOLO los que la herramienta resuelve (ensayo 6: `ventas_anterior`,
 * `markup`, `variacion`, `vs_presupuesto_usd`, `umbral_materialidad`, `unidades_stock`… se ofrecían y la consulta volvía vacía). Es la MISMA función que corre la consulta, no una lista aparte. */
function _definible(id) {
  const t = _TOOL("defineConcept");
  if (!t) return false;
  try { const r = t({ concept: id }); return Boolean(r && r.coverage && r.coverage.supported); } catch { return false; }
}

/* ── DÓNDE CORRE CADA SUPUESTO ────────────────────────────────────────────────────────────────────────────────
 * `supuestosAdmitidos` listaba los siete tipos de `ASSUMPTIONS` (la FORMA del supuesto), pero no todos corren: el de inventario (`inventory`) no tiene productor en ningún tema, y los demás corren solo en ciertos temas y ejes (carga: solo
 * cuentas; costo: producto, cuenta, marca y familia; libre: solo producto, en Inventario). Se le PREGUNTA al validador del Encargo —la misma tabla que decide, nunca una copia— con un encargo mínimo por (tipo, tema, alcance) y se publica
 * dónde corre; el tipo que no corre en ningún lugar no se ofrece. Puro (el validador no toca la red); lee los nombres de las entidades del tenant ACTIVO. */
function _alcancesDeSupuestos(tipos, temasActivos) {
  const ejemplo = {};
  for (const e of EJES) { const ns = axisEntityNames(e); if (ns.length) ejemplo[e] = ns[0]; }
  const out = {};
  for (const s of tipos) {
    const porTema = {};
    for (const tema of temasActivos) {
      const ejes = [];
      for (const alc of ["negocio", ...Object.keys(ejemplo)]) {
        const alcance = alc === "negocio" ? "negocio" : { eje: alc, nombre: ejemplo[alc] };
        const encargo = {
          version: "encargo/v1",
          supuestos: [{ id: "s1", tipo: s.tipo, valor: 5, unidad: (s.unidades || [])[0], alcance }],
          partes: [{ id: "p1", tema, cierre: "simulacion", supuestos: ["s1"], ...(alc === "negocio" ? {} : { entidades: [{ nombre: ejemplo[alc], eje: alc }] }) }],
        };
        let R = null;
        try { R = validarEncargo(encargo, {}); } catch { R = null; }
        const parte = R && Array.isArray(R.partes) ? R.partes[0] : null;
        if (parte && parte.estado !== "no_resuelta" && !(R.noResuelto || []).some((n) => n.campo === "supuesto")) ejes.push(alc);
      }
      if (ejes.length) porTema[tema] = ejes;
    }
    out[s.tipo] = porTema;
  }
  return out;
}

/* ── EL CATÁLOGO ──────────────────────────────────────────────────────────────────────────────────────────────
 * construirCatalogo() → sin argumentos: lee el tenant ACTIVO (la misma singleton que usa el resto del Core,
 * `data/tenantStore.js`) SOLO para los tres campos que dependen de qué archivo se cargó — período vigente por
 * tema y los ejemplos de cada eje —, nunca para una cifra. Se llama DESPUÉS de `initTenant(dataset)` (el mismo
 * orden que ya exige `validarEncargo`/`componerEntrega`), nunca antes.
 *
 * `registro` (optativo) es la MISMA costura de escalabilidad que ya usa `dominios.js` (`dominioPorId(id,
 * registro)`, probada en `_registro_de_dominios_gate.mjs`): una COPIA del registro con un dominio o una métrica
 * SINTÉTICA, sin tocar `DOMINIOS_REGISTRO` real, para que el candado de este corte (`_capacidad_gate.mjs`) pueda
 * probar que una entrada sin productor se declara `productor:false` en vez de fingir un eje. */
export function construirCatalogo({ registro = DOMINIOS_REGISTRO } = {}) {
  const tenant = getTenantData();

  const temas = registro.map((d) => {
    const cierres = _cierresDelTema(d.id);
    // SOLO los conceptos SERVIBLES entran al catálogo (owner: «cualquier solicitud… nunca capacidades
    // inventadas» — una clave sin productor, sin ser referencia ni escalar del negocio, NO es una capacidad real
    // hoy, así que no se anuncia). El caso residual conocido y documentado (`peso_costo`, `esquema.js` §3.3) queda
    // FUERA del catálogo por la misma regla que `validarEncargo` ya aplica (`concepto_sin_productor`) — una sola
    // verdad entre lo que el catálogo promete y lo que el encargo resuelve. La carnada de escalabilidad
    // (`_capacidad_gate.mjs` §4) prueba que una métrica sintética sin productor queda EXCLUIDA, nunca presente
    // con un eje fingido.
    const conceptos = (d.metricas || [])
      .filter((clave) => _conceptoServible(clave))
      .map((clave) => {
        const m = _porClave.get(clave);
        return {
          clave,
          rotulo: m ? m.nombre : clave,
          unidad: m ? m.unidad : null,
          referencia: Boolean(m && m.referencia),
          negocio: Boolean(m && m.negocio),
          ejes: ejesConProductor(clave),
        };
      });
    /* las referencias y escalares del negocio del tema: se CITAN, no se piden (su valor llega dentro de la Entrega que las usa, con su origen; `cierre: definicion` explica qué son) */
    const referencias = (d.metricas || []).filter(_esReferenciaOEscalar).map((clave) => {
      const m = _porClave.get(clave);
      return { clave, rotulo: m ? m.nombre : clave, unidad: m ? m.unidad : null, tipo: m && m.referencia ? "referencia" : "escalar del negocio", nota: "no se pide como concepto: se cita en la Entrega que la usa, con su origen" };
    });
    return {
      id: d.id,
      nombre: d.nombre,
      definicion: d.definicion,
      sujeto: d.sujeto,
      estado: d.estado,               // "activo" | "ausente"
      conceptos,
      ...(referencias.length ? { referencias } : {}),
      lentes: d.lentes || [],
      cierres,
      ausencia: d.ausencia || null,   // solo temas ausentes (tesorería): {id, que, alternativa}
    };
  });

  const ejes = AXES.map((eje) => ({
    eje,
    n: (entityIndexStats().porEje || {})[eje] || 0,
    ejemplos: axisEntityNames(eje).slice(0, 3),
  }));

  /* períodos vigentes por tema — texto declarado, nunca recalculado (misma ley que `doh`: "un valor declarado,
   * no una cuenta"). Comercial: año cerrado (`periodoDeclaradoDe`, `bandaTamano.js` — la MISMA lectura que usa
   * `perfilCliente.js`). Cobranza: la foto al corte (`buildMesaFlujo`, campo `fechaCorteFmt`, la MISMA función
   * que arma la Mesa de Control). Inventario: foto sin fecha declarada en este dato — ausencia `sin_fecha_corte`
   * del registro (nunca se inventa una fecha). */
  let cobranzaCorte = null;
  try { cobranzaCorte = buildMesaFlujo(ESCENARIO_INICIAL).fechaCorteFmt || null; } catch { cobranzaCorte = null; }
  const periodos = {
    comercial: { tipo: "cerrado", valor: periodoDeclaradoDe(tenant) || null, texto: "año cerrado" },
    cobranza: { tipo: "foto", valor: cobranzaCorte, texto: "foto al corte" },
    inventario: { tipo: "foto", valor: null, texto: "foto sin fecha declarada" },
    tiposDisponibles: ["vigente", "mes", "rango"],   // Periodo.tipo del contrato del encargo (§1)
  };

  const definiciones = CALCULOS.map((c) => ({ id: c.id, que: c.que, formula: c.formula, fuente: c.fuente }));
  const noCalcula = BLOQUEADOS.map((b) => ({ id: b.id, que: b.que, porque: b.porque, paraAbrirlo: b.paraAbrirlo }));
  const ausencias = AUSENCIAS_DEL_DATO.map((a) => ({ id: a.id, tipo: a.tipo, dominio: a.dominio, texto: a.texto }));
  const supuestosDeLaForma = Object.entries(ASSUMPTIONS).map(([tipo, def]) => ({
    tipo, nombre: def.label, unidades: def.units, perturba: def.perturbs,
  }));
  const alcancesDeSupuestos = _alcancesDeSupuestos(supuestosDeLaForma, temas.filter((t) => t.estado === "activo" && t.cierres.simulacion).map((t) => t.id));
  const supuestosAdmitidos = supuestosDeLaForma.filter((s) => Object.keys(alcancesDeSupuestos[s.tipo] || {}).length).map((s) => ({ ...s, alcances: alcancesDeSupuestos[s.tipo] }));
  const criterios = Object.entries(CRITERIOS).map(([lente, def]) => ({
    lente, nombre: def.nombre, dicho: def.dicho, tema: def.dominio || null,
  }));
  const estados = definicionesDeEstados();
  const conceptosDeDefinicion = [
    ...Object.keys(CONCEPT_DEFS).map((id) => ({ id, rotulo: (CONCEPT_DEFS[id] && CONCEPT_DEFS[id].aka) || id })),
    ...CLAVES_DE_METRICA.map((m) => ({ id: m.clave, rotulo: m.nombre })),
  ].filter((c) => _definible(c.id));

  return {
    version: "capacidad/v1",
    empresa: { id: tenant && tenant.id ? tenant.id : null, nombre: tenant && tenant.nombre ? tenant.nombre : null },
    temas,
    ejes,
    periodos,
    cierresEnum: CIERRES,
    multidominio: { decision: Boolean(_RUTA_MULTIDOMINIO), lectura: Boolean(_RUTA_MULTIDOMINIO) },
    definiciones,
    noCalcula,
    ausencias,
    supuestosAdmitidos,
    criterios,
    estados,
    conceptosDeDefinicion,
    universo: guiaDeUniverso(),   // la forma de un universo (top · estados · filtros · base · excluir · union), documentada para esta empresa (ensayo 5)
    tiposDePremisa: TIPOS_DE_PREMISA,
    usar: USAR_VALORES,
    profundidad: PROFUNDIDAD_VALORES,
    moneda: monedaDelNegocio(tenant) || null,
  };
}

/** ausenciasDelEncargo(temasPedidos) → las ausencias que aplican a los temas de un encargo (envoltorio delgado
 *  sobre `ausenciasDe`, para que `acciones.js` no tenga que importar `config/contract/ausencias.js` dos veces
 *  con dos nombres distintos — una sola puerta). */
export function ausenciasDelEncargo(temasPedidos) {
  return ausenciasDe(temasPedidos);
}
