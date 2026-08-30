/* === src/adi/agente/herramientasAgente.js · LAS DOS HERRAMIENTAS NUEVAS DEL AGENTE (F2 · owner 2026-08-30) ===
 *
 * La caja del agente = las 24 de `TOOLS` (toolRegistry, con sus contratos) MÁS estas dos:
 *
 *   · `serieEntidad` — el cruce entidad×mes REAL RECONCILIADO que este frente construyó. `trend` sirve la
 *     global; este sirve la de UNA entidad, o el MOTIVO del bloqueo con palabras — para que el cerebro decline
 *     honesto en una línea leyendo lo que la herramienta le dijo, en vez de inventar o volcar el tablero.
 *     Es la heredera del interceptor-puente: misma lectura del dato, mismo contrato de honestidad; cambia
 *     quién decide invocarla (el cerebro, no un regex).
 *
 *   · `registrarSupuesto` — la cifra que el USUARIO ofrece entra a la boleta ETIQUETADA (`source:
 *     "user_supuesto"`), nunca mezclada con lo verificado. El notario ya vigila supuestos; esto convierte la
 *     etiqueta en un acto de primera clase.
 *
 * MISMA FORMA que las tools del registro: `(args, { scenario }) → { facts, boleta, coverage }`. Los montos van
 * con la escala DECLARADA del pack, como todo desde el barrido A. PURO · sin red. */
import { getTenantData } from "../../data/tenantStore.js";
import { factorComercialDe } from "../../config/contract/figureType.js";
import { serieRealDe } from "../sentrix/capability.js";
import { findCandidates } from "../oracle/entityIndex.js";
import { fig } from "../boleta.js";
import { fmtMonto } from "../../config/moneda.js";
import { nombreDePeriodo } from "../../ingesta/historico.js";
import { ESCENARIO_INICIAL } from "../../config/scenarios.js";   // colapso del eje: el agente lee el MISMO dato que la pantalla

const _pct = (v) => `${(+v).toFixed(1)}%`;

/** resuelve el nombre contra los cuatro ejes del historial — tolera tipeo, jamás adivina entre dos. */
function _resolver(nombre) {
  for (const eje of ["cliente", "marca", "familia", "sku"]) {
    const c = findCandidates(eje, nombre, { max: 2 });
    if (!c.length) continue;
    if (c.length > 1 && c[0].motivo !== "exacto" && c[0].distancia === c[1].distancia) continue;
    return { nombre: c[0].nombre, eje };
  }
  return null;
}

/* serieEntidad({ entity, metrica }) → la serie mensual real de esa entidad, o el motivo del bloqueo.
 * `metrica`: venta (default) · contribucion · unidades · acciones · margen. */
export function serieEntidad({ entity, metrica = "venta" } = {}, { scenario = ESCENARIO_INICIAL } = {}) {
  const d = getTenantData() || {};
  const sinSoporte = (reason) => ({ facts: null, boleta: [], coverage: { supported: false, reason } });
  if (!entity) return sinSoporte("serieEntidad necesita `entity`: de quién es la serie");
  const res = _resolver(entity);
  if (!res) return sinSoporte(`no encuentro «${entity}» en ningún eje de este dato`);

  const estado = serieRealDe(res.nombre);
  if (!estado.real) {
    const motivo = estado.motivo === "no-reconcilia"
      ? `la serie mensual de ${res.nombre} no cierra contra su cifra oficial del período: no se sirve ninguno de los dos montos`
      : estado.motivo === "sin-periodo"
        ? `el histórico por entidad de este dato es de muestra y no reconcilia con la cifra oficial: no se usa`
        : `no hay serie mensual de ${res.nombre} en el dato de esta empresa`;
    return sinSoporte(motivo);
  }

  const serie = (d.historialMargen || {})[res.nombre] || [];
  const fx = factorComercialDe(d);
  const campo = { venta: "venta", contribucion: "contribucion", unidades: "unidades", acciones: "rebates", margen: "margen" }[metrica];
  if (!campo) return sinSoporte(`métrica «${metrica}» no soportada en la serie (venta · contribucion · unidades · acciones · margen)`);

  const boleta = [];
  const puntos = serie.map((p) => {
    const v = p[campo];
    const fmt = v === null ? null
      : metrica === "margen" ? _pct(v)
      : metrica === "unidades" ? `${Math.round(v)}` : fmtMonto(v * fx, { dataset: d });
    if (v !== null) boleta.push(fig(`${res.nombre} · ${metrica} · ${nombreDePeriodo(p.periodo)}`, fmt,
      { unit: metrica === "margen" ? "pct" : metrica === "unidades" ? "count" : "money",
        raw: metrica === "margen" || metrica === "unidades" ? v : v * fx,
        source: "serie", formula: "suma de las filas del archivo en ese mes · reconciliada con la cifra oficial",
        context: `serie mensual real de ${res.nombre}` }));
    return { periodo: p.periodo, mes: nombreDePeriodo(p.periodo), valor: v, fmt };
  });

  return {
    facts: {
      lens: "serie_entidad", entidad: res.nombre, eje: res.eje, metrica,
      n: puntos.length, desde: serie.length ? serie[0].periodo : null, hasta: serie.length ? serie[serie.length - 1].periodo : null,
      puntos,
      nota: puntos.some((p) => p.valor === null)
        ? "los meses sin venta no tienen esta métrica: van en null, no en cero"
        : null,
    },
    boleta,
    coverage: { supported: true, reason: null },
  };
}

/* registrarSupuesto({ texto, cifra, unidad }) → el supuesto del usuario, a la boleta CON etiqueta.
 * No calcula nada: registra. El cerebro lo usa para comparar contra lo verificado SIN mezclar. */
export function registrarSupuesto({ texto, cifra, unidad = "money" } = {}) {
  const sinSoporte = (reason) => ({ facts: null, boleta: [], coverage: { supported: false, reason } });
  if (!texto || typeof texto !== "string") return sinSoporte("registrarSupuesto necesita `texto`: qué afirmó el usuario, con sus palabras");
  const v = Number(cifra);
  if (!Number.isFinite(v)) return sinSoporte("registrarSupuesto necesita `cifra`: el número que el usuario ofreció");
  const d = getTenantData() || {};
  const fmt = unidad === "pct" ? _pct(v) : unidad === "count" ? String(Math.round(v)) : fmtMonto(v, { dataset: d });
  return {
    facts: { lens: "supuesto_usuario", texto: String(texto).slice(0, 200), cifra: v, unidad, etiqueta: "SUPUESTO DEL USUARIO — no verificado" },
    boleta: [fig(`Supuesto del usuario · ${String(texto).slice(0, 60)}`, fmt,
      { unit: unidad, raw: v, source: "user_supuesto", mandatory: false,
        context: "cifra ofrecida por el usuario — se compara contra lo verificado, jamás se mezcla sin etiqueta" })],
    coverage: { supported: true, reason: null },
  };
}

/** la caja completa del agente: el registro de siempre + las dos nuevas. Se arma acá para que el bucle y los
 *  gates tengan UNA fuente del catálogo. */
export function cajaDelAgente(TOOLS_BASE) {
  return { ...TOOLS_BASE, serieEntidad, registrarSupuesto };
}
