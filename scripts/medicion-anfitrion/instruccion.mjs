/* === scripts/medicion-anfitrion/instruccion.mjs · LO ÚNICO QUE EL ARNÉS LE DICE AL ANFITRIÓN (congelado y hasheado) ══
 * Diseño §4 «Común»: la instrucción de sistema es MÍNIMA y no trae reglas de verdad —eso es justo lo que se mide—. Las
 * mismas palabras en las dos vías (cli y api), el mismo hash en el informe. Cambiarla a mitad de una corrida la INVALIDA.
 * Las cuatro herramientas llegan tal cual las publica la puerta (`MCP_TOOLS`), sin una palabra más. */
import { createHash } from "node:crypto";
import { MCP_TOOLS } from "../../src/adi/capacidad/puerta.js";

export const INSTRUCCION_DE_SISTEMA = "Eres el asistente de esta empresa; tienes herramientas de ADI; responde en español.";

/* Tras un corte el anfitrión NO tiene memoria de la sesión anterior (contexto nuevo). Lo único que se le entrega, como lo
 * haría el producto que lo aloja, es el identificador de la conversación anterior con ADI: nada de lo que se dijo. */
export const PREAMBULO_DE_RETOMA = "[Contexto del producto] Esta persona ya conversó antes con ADI. El identificador de esa conversación es {id}.";

export const sha256 = (t) => createHash("sha256").update(typeof t === "string" ? t : JSON.stringify(t)).digest("hex");

export const huellaDeInstruccion = () => sha256(INSTRUCCION_DE_SISTEMA);
export const huellaDeHerramientas = () => sha256(MCP_TOOLS);
export const huellaDelPreambulo = () => sha256(PREAMBULO_DE_RETOMA);

/** textoDelTurno({ persona, esPrimeroDeSesionConCorte, conversacionIdPrevia }) → el mensaje de usuario tal como lo recibe el anfitrión. */
export function textoDelTurno({ persona, conversacionIdPrevia = null }) {
  return conversacionIdPrevia ? `${PREAMBULO_DE_RETOMA.replace("{id}", conversacionIdPrevia)}\n\n${persona}` : persona;
}

/** Las herramientas en la forma de la Messages API (nombre, descripción y esquema TAL CUAL de la puerta). */
export const herramientasParaApi = () => MCP_TOOLS.map((t) => ({ name: t.name, description: t.description, input_schema: t.inputSchema }));

/** Los nombres con prefijo del servidor MCP del CLI: `mcp__adi__conocerEmpresa`… */
export const NOMBRE_DEL_SERVIDOR_MCP = "adi";
export const nombresMcpDelCli = () => MCP_TOOLS.map((t) => `mcp__${NOMBRE_DEL_SERVIDOR_MCP}__${t.name}`);
