/* === src/adi/porQueEstaCifra.js · «¿POR QUÉ ESA CIFRA?» TIENE RESPUESTA (owner 2026-08-12) ==============
 *
 * NACIÓ DE UNA CONVERSACIÓN REAL. El owner miró la cascada del P&L y preguntó: «logística por qué tiene un
 * 3.5%». ADI repreguntó, y después repitió la lectura entera sin contestar. **La respuesta estaba en su propia
 * tabla**: la línea viene con la nota «supuesto declarado · 3.5%». No es un dato medido — es un supuesto, y el
 * resultado se mueve con él. Una línea alcanzaba.
 *
 * LO QUE FALTABA NO ERA EL DATO, ERA EL CAMINO. `pnl.js` sella cada línea de gasto con su origen
 * (`supuesto declarado` si lo declaró el usuario, `supuesto del perfil de la empresa` si vino del perfil), y
 * ninguna ruta conectaba la pregunta con esa etiqueta. Es el mismo patrón que ya mordió cuatro veces:
 * la capacidad existe y es invisible.
 *
 * POR QUÉ DETERMINÍSTICO: la respuesta NO se interpreta, se lee. Qué es la cifra, de dónde salió y que se puede
 * cambiar son hechos sellados en el dato. Mandárselo al narrador sería pedirle que redacte algo que ya está
 * decidido, y arriesgar que lo adorne. Además NO gasta una llamada — la respuesta sale del motor.
 *
 * LA REGLA DE PROPORCIONALIDAD MANDA ACÁ MÁS QUE EN NINGÚN LADO: un supuesto NO es una medición, y decirlo es
 * la mitad honesta de la respuesta. La otra mitad es la oferta de corregirlo, que es lo que convierte una
 * explicación en una decisión — y la puerta natural a la simulación.
 */

/* Detector. Red ANGOSTA, como `_ORIENTACION_RE` y los otros: dispara con las formas reales de preguntar por el
 * origen de una cifra, y NO con una consulta general. Ante la duda no dispara: que ADI responda de más es peor
 * que no atajar. Cubre las tres formas que aparecen de verdad — «por qué tiene X», «de dónde sale», «qué es». */
const _POR_QUE_RE = /\b(?:por\s*qu[eé]|porqu[eé])\b[^?]{0,40}\b(?:tiene|es|sale|aparece|marca|figura|est[aá]|pone|dice)\b|\bde\s+d[oó]nde\s+(?:sale|viene|sac[aá]s|saca|salen)\b|\bqu[eé]\s+(?:es|significa)\s+(?:ese|esa|el|la|lo\s+de)\b|\bc[oó]mo\s+(?:calculaste|sacaste|llegaste\s+a)\b|\bqu[eé]\s+incluye\b/i;

/** Las líneas de la cascada que el usuario puede nombrar. Se comparan contra los nombres REALES del P&L. */
const _normal = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();

/**
 * ¿Este turno pregunta por el ORIGEN de una cifra de la cascada?
 * @param {string} text        lo que escribió el usuario
 * @param {Array}  lineas      las líneas activas del P&L: [{ nombre, pct, origen }]
 * @returns {{linea:Object}|null}  la línea que nombró, o null si no aplica
 */
export function detectaPorQueCifra(text, lineas) {
  const t = String(text || "");
  if (!t.trim() || !Array.isArray(lineas) || !lineas.length) return null;
  if (!_POR_QUE_RE.test(t)) return null;
  const tn = _normal(t);
  // la línea nombrada: match por el nombre real, no por una lista escrita a mano (un P&L nuevo funciona igual)
  const linea = lineas.find((l) => l && l.nombre && tn.includes(_normal(l.nombre)));
  return linea ? { linea } : null;
}

/**
 * La respuesta, armada desde el dato sellado. NO interpreta: lee el origen y ofrece corregirlo.
 * Sin cifras inventadas — el % es el que la línea declara, y es la única que se nombra.
 */
export function componePorQueCifra({ linea }) {
  if (!linea) return null;
  const pct = typeof linea.pct === "number" ? `${Math.round(linea.pct * 10) / 10}%` : String(linea.pct || "");
  const delPerfil = linea.origen === "perfil_empresa";
  const fuente = delPerfil
    ? "es un supuesto que viene del perfil de tu empresa, no una medición de este período"
    : "es un supuesto que declaraste vos, no una medición";
  return [
    `El ${pct} de ${linea.nombre} ${fuente}.`,
    `Por eso el resultado después de gastos se mueve con esa cifra: no es contabilidad cerrada, es tu supuesto aplicado sobre la venta real. Lo que sí está medido es todo lo que va antes — venta, costo, carga comercial y contribución.`,
    `Si tenés el número real de ${linea.nombre}, decímelo y recalculo la cascada completa con ese dato.`,
  ].join("\n\n");
}
