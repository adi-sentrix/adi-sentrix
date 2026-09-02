/* === src/adi/agente/catalogoAgente.js · EL CATÁLOGO NATIVO DE HERRAMIENTAS (F2 · owner 2026-08-30) ===========
 *
 * Lo que el PROVEEDOR recibe en `tools`: nombre, descripción y schema de cada herramienta. Se DERIVA
 * mecánicamente de `TOOL_CONTRACTS` — la tabla que ya declara dimensiones, inputs obligatorios y cardinalidad,
 * verificada por su propio gate — más los contratos LOCALES de las dos herramientas del agente (la tabla
 * oficial está gateada a cubrir EXACTAMENTE el registro base, ni más ni menos: extenderla allá rompería ese
 * candado a propósito, así que las nuevas declaran acá y el catálogo une las dos fuentes).
 *
 * DETERMINÍSTICO: orden alfabético fijo, cero prosa generada por turno — el catálogo es parte del prefijo
 * cacheable del proveedor, la misma disciplina del mapa. */
import { TOOLS } from "../oracle/toolRegistry.js";
import { TOOL_CONTRACTS } from "../oracle/toolContracts.js";

/** los contratos de las herramientas PROPIAS del agente — misma forma que TOOL_CONTRACTS. */
export const CONTRATOS_AGENTE = {
  serieEntidad: {
    dimensionesSoportadas: ["cliente", "sku", "marca", "familia"],
    entidad: "single", aceptaEntidadPuntual: true, multiCardinality: null,
    inputsObligatorios: ["entity"], supuestosRequeridos: null, operacionValida: ["answer"],
    entityScopeNativo: false, escribeEntityList: true,
    notas: "la serie mensual REAL RECONCILIADA de una entidad (venta · contribucion · unidades · acciones · margen), o el motivo del bloqueo con palabras. Solo sirve dato que cierra contra la cifra oficial.",
  },
  registrarSupuesto: {
    dimensionesSoportadas: [],
    entidad: "none", aceptaEntidadPuntual: false, multiCardinality: null,
    inputsObligatorios: ["texto", "cifra"], supuestosRequeridos: null, operacionValida: ["answer"],
    entityScopeNativo: false, escribeEntityList: false,
    notas: "registra una cifra QUE EL USUARIO OFRECIÓ, etiquetada como supuesto — para compararla contra lo verificado sin mezclar jamás.",
  },
  /* `proyectar` · LA PIEZA QUE FALTABA. `simulate` exige una dimensión de cliente/sku/marca/familia y no admite
   * «todo el negocio»: por eso el agente preguntaba en vez de proyectar. Sin `entity` el alcance es el negocio
   * entero, que es el caso que el owner declaró como default. `tasa` NO es obligatoria a propósito: sin ella la
   * herramienta devuelve la base y declara que falta el supuesto — inventar un crecimiento que nadie declaró
   * sería causalidad sin respaldo, en versión futuro. */
  proyectar: {
    dimensionesSoportadas: [],
    entidad: "none", aceptaEntidadPuntual: true, multiCardinality: null,
    inputsObligatorios: [], supuestosRequeridos: null, operacionValida: ["answer"],
    entityScopeNativo: false, escribeEntityList: false,
    notas: "proyecta la venta a futuro con la tasa QUE EL USUARIO DECLARA (`tasa`, en %) y su `horizonte`. Sin `entity` proyecta sobre TODO EL NEGOCIO (la venta oficial del período). El resultado sale etiquetado como PROYECCIÓN, nunca como cifra medida. Sin `tasa` devuelve la base y dice que falta el supuesto: jamás inventa un crecimiento.",
  },
  /* `cobranza` · el cobro, de la MISMA mesa que la pestaña Flujo Comercial (owner 2026-09-01). Sin args: la
   * mesa decide qué hay. El vencido sin plazo declarado viaja como «—», jamás $0 — regla textual del owner. */
  cobranza: {
    dimensionesSoportadas: [],
    entidad: "none", aceptaEntidadPuntual: false, multiCardinality: null,
    inputsObligatorios: [], supuestosRequeridos: null, operacionValida: ["answer"],
    entityScopeNativo: false, escribeEntityList: false,
    notas: "quién te debe y cuánto: venta a crédito, abonado y saldo pendiente por cliente, de la misma mesa que la pestaña Flujo Comercial. El saldo vencido solo existe con plazo de pago declarado; sin plazo viaja «—» y el porqué — jamás $0. Las ventas de contado no generan deuda y no entran.",
  },
  preferenciaNombre: {
    dimensionesSoportadas: [],
    entidad: "none", aceptaEntidadPuntual: false, multiCardinality: null,
    inputsObligatorios: ["nombre"], supuestosRequeridos: null, operacionValida: ["answer"],
    entityScopeNativo: false, escribeEntityList: false,
    notas: "guarda cómo prefiere ser llamado el usuario («llámame jc») — SOLO el nombre; el registro y el tono no se configuran.",
  },
};

/** la descripción de una herramienta, derivada del contrato — mecánica, nunca prosa nueva por turno. */
function _descripcion(nombre, c) {
  const partes = [];
  if (c.notas) partes.push(c.notas);
  if (c.dimensionesSoportadas && c.dimensionesSoportadas.length) partes.push(`ejes: ${c.dimensionesSoportadas.join("/")}`);
  if (c.entidad === "single") partes.push("opera sobre UNA entidad nombrada");
  else if (c.entidad === "multi") partes.push(`toma una lista de entidades${c.multiCardinality ? ` (${c.multiCardinality})` : ""}`);
  if (c.inputsObligatorios && c.inputsObligatorios.length) partes.push(`requiere: ${c.inputsObligatorios.join(", ")}`);
  return partes.join(" · ") || nombre;
}

/** el input_schema, derivado: obligatorios como required; el resto permisivo (el contrato fino lo aplica el
 *  motor en runPlan — la doble validación de siempre: acá para que el modelo acierte, allá como garantía). */
function _schema(c) {
  const props = {};
  for (const k of c.inputsObligatorios || []) {
    props[k] = k === "dimension" && c.dimensionesSoportadas && c.dimensionesSoportadas.length
      ? { type: "string", enum: [...c.dimensionesSoportadas] }
      : k === "entities" ? { type: "array", items: { type: "string" } }
      : k === "cifra" ? { type: "number" }
      : { type: "string" };
  }
  return { type: "object", properties: props, required: [...(c.inputsObligatorios || [])], additionalProperties: true };
}

/* catalogoAgente() → [{ name, description, input_schema }] · alfabético · determinístico byte a byte. */
export function catalogoAgente() {
  const todos = { ...TOOL_CONTRACTS, ...CONTRATOS_AGENTE };
  return Object.keys(todos)
    .filter((n) => TOOLS[n] || CONTRATOS_AGENTE[n])   // solo lo que de verdad se puede ejecutar
    .sort((a, b) => a.localeCompare(b, "es"))
    .map((name) => ({ name, description: _descripcion(name, todos[name]), input_schema: _schema(todos[name]) }));
}
