/* === config/escala.js · EN QUÉ ESCALA ESTÁN LOS MONTOS · SE DECLARA, NUNCA SE SUPONE (owner 2026-10-04 · P1) =======
 *
 * LA LEY, textual del owner: «el símbolo de moneda declarado sí, la ESCALA jamás se supone». Hasta hoy la ingesta
 * decretaba la escala («raw») sin preguntarla: quien escribía sus montos en MILES cargaba sin una sola alarma —medido
 * con una sonda real: venta 61 en vez de 61.483.000— y ADI analizaba magnitudes mil veces erradas, con la misma voz
 * de seguridad de siempre.
 *
 * LA DECISIÓN, simple a propósito (owner, mismo día): el recorrido de «Tus datos» —leer → mostrar lo entendido →
 * confirmar → analizar— y la empresa confirma moneda y escala; ADI lo registra con procedencia y continúa. NO SE INFIERE
 * NADA que el archivo no declare explícitamente:
 *   · la MONEDA es la de la hoja Empresa si ese parámetro viene lleno (se muestra «CLP (del archivo)» y se confirma con el
 *     mismo botón); si no viene, se pregunta, sin preselección;
 *   · la ESCALA no tiene dónde declararse en la plantilla (está congelada): SIEMPRE se pregunta, sin preselección.
 * Ni encabezados («M$», «MM$») ni el rango de los valores cuentan como declaración: eso es otro frente (P2).
 *
 * QUÉ HAY ACÁ: las dos escalas como DATO, la pregunta y los rótulos (que la pantalla solo pinta) y la cuenta de
 * `multiplicar`. Qué columnas se multiplican NO se decide acá: lo declara el contrato de la plantilla (`magnitud:
 * "dinero"`, `config/contract/plantilla.js`) y lo aplica `ingesta/convertirEscala.js`.
 *
 * ⚠️ NO HAY ESCALA POR DEFECTO. `escalaLimpia` devuelve `null` para todo lo que no sea una de las dos, y quien recibe
 * `null` NO ACTIVA NADA. Tampoco se infiere del archivo: ni del encabezado, ni de la cabecera Empresa, ni del rango
 * de los valores (esa es la lección de miles-contra-dólares).
 *
 * PURO · sin red · sin modelo · sin Node: sirve igual en el navegador y en el servidor. */

/** Las escalas que se ofrecen, en el orden en que se preguntan. `factor` = por cuánto se multiplica para llegar a
 *  unidades de la moneda. El pack SIEMPRE queda en unidades: «miles» es lo que escribió el usuario, no lo que se guarda. */
export const ESCALAS = {
  unidades: { factor: 1,    rotulo: "En unidades de la moneda" },
  miles:    { factor: 1000, rotulo: "En miles" },
};
export const ESCALAS_OFRECIDAS = Object.keys(ESCALAS);

/** De dónde sale la moneda y la escala de un pack: de la empresa que subió el archivo, y de nadie más. */
export const ORIGEN_DECLARACION = "declarado por la empresa";

/** La FUENTE de cada declaración, registrada junto al origen: la moneda puede venir de la hoja Empresa del archivo o de la
 *  pantalla; la escala solo de la pantalla (la plantilla no tiene dónde traerla). */
export const FUENTES = { archivo: "archivo", pantalla: "pantalla" };

/* preguntaDeDeclaracion({ faltaMoneda }) → { titulo, ayuda } · LA PREGUNTA, adaptada a lo que falta.
 * Si el archivo no trae la moneda, faltan las dos y se preguntan juntas; si la trae, falta solo la escala y la pregunta es
 * solo de escala. La pantalla pinta estas palabras; no las redacta. */
export function preguntaDeDeclaracion({ faltaMoneda = true } = {}) {
  const f = ESCALAS.miles.factor.toLocaleString("es-CL");
  const queHace = `Si eliges «miles», ADI multiplica por ${f} los montos en dinero antes de calcular.`;
  return faltaMoneda
    ? { titulo: "¿En qué moneda y escala están expresados los montos?",
        ayuda: `Tu archivo no indica ninguna de las dos y no se dan por supuestas: se preguntan con cada carga y quedan registradas como declaradas por la empresa. ${queHace}` }
    : { titulo: "¿Los montos están en unidades de la moneda o en miles?",
        ayuda: `Tu archivo no indica la escala y no se da por supuesta: se pregunta con cada carga y queda registrada como declarada por la empresa. ${queHace}` };
}

/* lineasDeDeclaracion({ monedaArchivo, monedaPantalla, escala }) → [{ clave, rotulo, valor, fuente }] · LAS DOS LÍNEAS que
 * «Esto es lo que leí» suma junto a Empresa, Período y los totales: Moneda y Escala, con de dónde sale cada una. Las arma
 * este módulo —no la pantalla— para que lo mostrado y lo registrado en el pack digan lo mismo.
 *   Moneda · «CLP (del archivo)» · «USD (declarada en pantalla)» · «sin indicar en el archivo»
 *   Escala · «sin indicar en el archivo» · «en miles (declarada en pantalla)» · «en unidades de la moneda (declarada en pantalla)» */
export function lineasDeDeclaracion({ monedaArchivo = null, monedaPantalla = null, escala = null } = {}) {
  const e = escalaLimpia(escala);
  const moneda = monedaArchivo
    ? { valor: `${monedaArchivo} (del archivo)`, fuente: FUENTES.archivo }
    : monedaPantalla
      ? { valor: `${monedaPantalla} (declarada en pantalla)`, fuente: FUENTES.pantalla }
      : { valor: "sin indicar en el archivo", fuente: null };
  const esc = e
    ? { valor: `${ESCALAS[e].rotulo.toLowerCase()} (declarada en pantalla)`, fuente: FUENTES.pantalla }
    : { valor: "sin indicar en el archivo", fuente: null };
  return [{ clave: "moneda", rotulo: "Moneda", ...moneda }, { clave: "escala", rotulo: "Escala", ...esc }];
}

/** La escala normalizada («Miles » → «miles»), o `null`. No corrige, no traduce, no completa: `null` es «nadie lo dijo». */
export function escalaLimpia(x) {
  const s = String(x == null ? "" : x).trim().toLowerCase();
  return Object.prototype.hasOwnProperty.call(ESCALAS, s) ? s : null;
}
export const factorDeEscala = (x) => { const e = escalaLimpia(x); return e ? ESCALAS[e].factor : null; };

/* multiplicar(valor, factor) · EXACTO en decimal. `61.4835 * 1000` da 61483.49999999999 en coma flotante: ese ruido
 * se limpia a 15 cifras significativas, que es lo que un double sostiene de verdad. Con factor 1 no se toca nada. */
export function multiplicar(valor, factor) {
  if (typeof valor !== "number" || !Number.isFinite(valor)) return valor;
  if (factor === 1) return valor;
  return Number((valor * factor).toPrecision(15));
}

/** validarEscala(x) → { ok:true, valor } | { ok:false, motivo } · la puerta de ENTRADA del endpoint. */
export function validarEscala(x) {
  const valor = escalaLimpia(x);
  if (valor) return { ok: true, valor };
  return { ok: false, motivo: "falta declarar la escala de los montos: indica si están en las unidades de la moneda o en miles. No se activó nada" };
}
