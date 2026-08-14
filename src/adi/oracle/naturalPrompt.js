/* === src/adi/oracle/naturalPrompt.js · EL SYSTEM DEL CAMINO NATURAL (owner 2026-08-14, conexión autorizada) ====
 * QUÉ ES: el system del cerebro único del camino natural — persona + carpeta del negocio + doctrina del notario +
 * contrato [[CALCULO]] — productizado desde el `SYSTEM_NATURAL` de `_corrida_doble.mjs`, el arnés MEDIDO (28
 * turnos en 3 corridas). La doctrina y el contrato van TEXTUALES, byte por byte los del arnés: la condición 3 del
 * owner («cero reglas nuevas») convierte cualquier reescritura en una regla nueva sin medir. Si esta doctrina
 * tiene que cambiar, cambia PRIMERO en una corrida medida, no acá.
 *
 * SEGMENTADO PARA QUE EL CACHÉ PEGUE — el MISMO contrato que buildPlanSystemSegments/buildNarrateSystemSegments:
 *   · `fijo` = persona + carpeta + doctrina + contrato. Estable por tenant+escenario (la persona es constante y
 *     `proyectarDatoNegocio` está memoizada por tenant+escenario), así que va bajo cache:true.
 *   · `variable` = el bloque de memoria de interacción (`renderInteractionMemory(mem)`, lo arma el caller) — lo
 *     único que cambia turno a turno, del lado de afuera del corte del caché.
 * PURO · sin I/O · sin imports del gateway: lo consumen handleNarrateC (producción) y los gates (offline). */

// La doctrina del notario, TEXTUAL del arnés (`SYSTEM_NATURAL`, _corrida_doble.mjs). No agregar ni quitar reglas.
export const DOCTRINA_NOTARIO_NATURAL = `════════ LO QUE EL NOTARIO VERIFICA EN TU RESPUESTA ════════
Cada afirmación se verifica antes de llegar a pantalla:
· CADA CIFRA CON SU DUEÑO EN LA MISMA ORACIÓN. No cambies la cifra: nombra al dueño al lado.
· LAS CUENTAS SE MUESTRAN («$54.6M = $19.4M + $17.9M + $17.3M»). Una derivada sin su origen no pasa.
· LOS ESTADOS Y RANKINGS SON LOS DEL DATO: no clasifiques ni ordenes por tu cuenta.
· LAS SIMULACIONES van selladas como proyección («bajo este supuesto, generaría»), jamás como hecho.
· Si un «%» del usuario es ambiguo (relativo vs puntos), declara tu lectura o pregunta.
· LO QUE NO ESTÁ EN EL DATO NO EXISTE: se declara como límite, nunca se completa.`;

// El contrato de cálculo, TEXTUAL del arnés (adoptado 6/6 por el cerebro en la confirmación corta, dev 6632753).
export const CONTRATO_CALCULO_NATURAL = `════════ EL CONTRATO DE CÁLCULO (obligatorio cuando calculas) ════════
Tu prosa puede contar la cuenta como quieras — pero CADA cálculo que muestres va declarado además en un bloque
[[CALCULO]] al FINAL de tu respuesta (el usuario nunca lo ve; el notario lo recomputa). Una línea por cálculo:
id=c1 · op=<sumar|restar|multiplicar|dividir|pct_de|aplicar_pct|puntos> · inputs=<cifras o ids previos, separados por ;> · formula=<la cuenta en palabras> · resultado=<cifra con unidad> · unidad=<money|pct|pp>
Ejemplo:
[[CALCULO]]
id=c1 · op=aplicar_pct · inputs=$100.0M; 4% · formula=$100.0M + 4% · resultado=$104.0M · unidad=money
id=c2 · op=pct_de · inputs=c1; 25.1% · formula=25.1% de $104.0M · resultado=$26.1M · unidad=money
Reglas: los inputs salen del dato, de un supuesto del usuario o de un id previo · si una cuenta no cierra, el
notario la rechaza entera — verifica antes de declarar · una cifra calculada que NO declares no está autorizada.`;

// buildNaturalSystemSegments(persona, datoNegocio, memBlock) → { fijo, variable }
// `persona` = ADI_PERSONA (la completa: el cerebro natural SÍ redacta prosa) · `datoNegocio` = proyectarDatoNegocio
// (la carpeta curada, obligatoria — un cerebro sin carpeta inventa) · `memBlock` = renderInteractionMemory(mem).
export function buildNaturalSystemSegments(persona, datoNegocio, memBlock = "") {
  const fijo = `${persona}

════════ EL NEGOCIO DEL QUE HABLAS ════════
Esto es TODO lo que sabes de este negocio. No tienes herramientas: respondes con esto o declaras el límite.

${datoNegocio}

${DOCTRINA_NOTARIO_NATURAL}

${CONTRATO_CALCULO_NATURAL}`;
  return { fijo, variable: typeof memBlock === "string" ? memBlock : "" };
}
