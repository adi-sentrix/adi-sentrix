/* === src/adi/oracle/fichaIntent.js · LLEGAR A LA FICHA DESDE TEXTO LIBRE (owner 2026-08-12 · deuda prioritaria)
 * LA RAZÓN DE FONDO, textual del owner: **Sentrix es APOYO, NO REQUISITO.** Si el usuario escribe desde el inicio,
 * sin haber tocado la Mesa, ADI igual tiene que entender que quiere acercarse a una entidad y abrir su ficha. Un
 * producto que solo entiende la pregunta cuando venís de un botón obliga al usuario a aprender la interfaz antes
 * de poder preguntar.
 *
 * LO QUE ESTABA MEDIDO (2026-08-12) Y LO QUE CAMBIÓ. La nota decía que el piso determinístico no tenía ruta a la
 * Ficha —`router.js` y `coerceChain.js` siguen sin mencionarla, verificado— y que llegar dependía de que el
 * planificador acertara. Desde entonces el CAMINO NATURAL pasó a ser el principal, y ahí el hueco es peor y más
 * simple: `answerViaNatural` devolvía `sentrixAction: null` FIJO. O sea que desde texto libre no había ruta
 * ninguna a la Ficha — ni buena ni mala.
 *
 * ESTE MÓDULO ES EL PISO, NO EL TECHO. Determinístico, sin LLM, sin red: si la frase pide acercarse a un cliente
 * y ese cliente existe, la respuesta trae el botón que abre SU ficha. Si no, devuelve null y no pasa nada — nunca
 * inventa una entidad ni abre la ficha de otra.
 *
 * TRES DECISIONES QUE NO SON OBVIAS:
 *   1. SOLO EL EJE CLIENTE. La Ficha que existe es la del cliente (`address.js` la arma con `eje:"cliente"` y slug
 *      `ficha-cliente`; la Mesa la monta con `MesaFichaCara entity={fichaCliente}`). Ofrecer «la ficha» de un SKU
 *      abriría algo que no existe: eso no es una ruta nueva, es una promesa falsa.
 *   2. SE REUSA LA MÁQUINA QUE YA HAY — `findCandidates` para resolver el nombre (tolera el tipeo: «falabela» →
 *      Falabella, con el umbral que ese módulo ya declara) y `makeAddress`/`formatAddress` para la dirección. La
 *      nota del owner lo pedía explícito: «la MISMA capacidad, no una variante paralela que después diverge».
 *   3. UN CANDIDATO O NINGUNO. Si el nombre se parece a dos clientes, no se elige a ojo: se devuelve null. Un
 *      candidato equivocado con cifras reales es peor que no ofrecer el botón — es la misma regla que ese índice
 *      ya aplica para las entidades corruptas. */
import { findCandidates, axisCollisions } from "./entityIndex.js";
import { makeAddress, buildSentrixActionFromAddress } from "../sentrix/address.js";

/* LAS FORMAS QUE TIENEN QUE FUNCIONAR (el piso que declaró el owner, más las vecinas naturales). No es «cualquier
 * pregunta que nombre un cliente»: «cuánto vendió Falabella» es una consulta de dato, no un pedido de ficha, y
 * convertirla en botón sería adivinar. Acá van los pedidos de ACERCARSE a la entidad. */
const _PIDE_FICHA = new RegExp(
  "(?:" +
  "expl[ií]ca(?:me|r)?|expliqu[ée]?me?|" +
  "(?:abr[eií]r?|mostrar?|mu[ée]strame|ver|abrime)\\s+(?:la\\s+)?ficha|" +
  "ficha\\s+(?:de|del)|perfil\\s+(?:de|del)|" +
  "(?:cont[aá]me|h[aá]blame|dime)\\s+(?:de|del|sobre)|" +
  "qu[ée]\\s+(?:deber[ií]a|tengo\\s+que|hay\\s+que)\\s+(?:revisar|mirar|ver)|" +
  "(?:anal[ií]za(?:me)?|revis[aá](?:me)?|prof[uú]ndiza(?:r)?\\s+en)|" +
  "qu[ée]\\s+pasa\\s+con|c[oó]mo\\s+(?:est[aá]|viene|va)" +
  ")", "i");

// palabras que rodean al nombre y no son parte de él
const _RUIDO = new Set(["de", "del", "la", "el", "los", "las", "con", "sobre", "en", "y", "a", "al", "mi", "mis",
  "cliente", "cuenta", "ficha", "perfil", "primero", "ahora", "por", "favor", "que", "qué", "me", "un", "una"]);

const _limpiar = (s) => String(s || "").replace(/[¿?¡!.,;:()"'«»]/g, " ").replace(/\s+/g, " ").trim();

/* detectFichaIntent(pregunta) → { entidad, address, label } | null
 * Puro: no toca red, no llama a nadie, no muta nada. */
export function detectFichaIntent(pregunta, { escenario = null } = {}) {
  const q = _limpiar(pregunta);
  if (!q || !_PIDE_FICHA.test(q)) return null;

  /* EL NOMBRE PUEDE ESTAR EN CUALQUIER PARTE de la frase — «explicame Falabella» lo pone al final, «qué debería
   * revisar primero de Falabella» también, y «cómo está Falabella este mes» lo deja en el medio. Así que se
   * prueban los n-gramas de la pregunta contra el eje cliente, de más largo a más corto: un nombre de dos
   * palabras («La Polar») tiene que ganarle al de una que esté adentro. */
  /* ⚠️ LAS PALABRAS VAN CRUDAS, sin sacarles el ruido. La primera versión filtraba «la/el/de» antes de armar los
   * n-gramas y con eso perdía «La Polar»: el artículo es PARTE del nombre del cliente, no relleno alrededor.
   * El ruido no hace falta filtrarlo —un n-grama que no es un nombre simplemente no matchea—; solo se descartan
   * los que son ruido ENTERO, para que «de la» no llegue a parecerse por tipeo a un cliente de nombre corto. */
  const palabras = q.split(" ").filter(Boolean);
  let mejor = null;
  for (let n = Math.min(4, palabras.length); n >= 1; n--) {
    for (let i = 0; i + n <= palabras.length; i++) {
      const frase = palabras.slice(i, i + n).join(" ");
      if (frase.length < 3) continue;
      if (palabras.slice(i, i + n).every((w) => _RUIDO.has(w.toLowerCase()))) continue;   // puro relleno
      const cand = findCandidates("cliente", frase, { max: 2 });
      if (!cand.length) continue;
      // DOS CANDIDATOS = no se adivina. Salvo que el primero sea exacto: ahí no hay duda que resolver.
      if (cand.length > 1 && cand[0].motivo !== "exacto" && cand[0].distancia === cand[1].distancia) continue;
      if (!mejor || cand[0].distancia < mejor.distancia || (cand[0].distancia === mejor.distancia && n > mejor.n)) {
        mejor = { nombre: cand[0].nombre, distancia: cand[0].distancia, motivo: cand[0].motivo, n };
      }
    }
    if (mejor && mejor.distancia === 0) break;   // exacto: no hace falta seguir acortando
  }
  if (!mejor) return null;

  /* HOMÓNIMO ENTRE EJES: si el mismo nombre existe también como marca o SKU, abrir la ficha del cliente sería
   * elegir un eje en silencio — el error de atribución que `axisCollisions` existe para impedir. */
  try {
    const ejes = axisCollisions(mejor.nombre);
    if (Array.isArray(ejes) && ejes.length > 1) return null;
  } catch { /* si el índice no puede responder, se sigue: el candado de abajo igual exige dirección válida */ }

  const addr = makeAddress({ vista: "ficha", seccion: "otro", slug: "ficha-cliente", eje: "cliente",
    entidad: mejor.nombre, escenario: escenario || null });
  if (!addr) return null;   // dirección inválida = no se ofrece nada: nunca un botón que no abre

  /* EL BOTÓN LO ARMA `buildSentrixActionFromAddress`, no este módulo. La primera versión componía el payload a
   * mano y le faltaban campos (`modulo`, `clientes`, `skus`) — exactamente la «variante paralela que después
   * diverge» que el owner pidió evitar. La etiqueta también sale de ahí: es la voz que el producto ya usa para
   * estos botones («Ver la ficha de X en Sentrix»), no una inventada acá. */
  const accion = buildSentrixActionFromAddress(addr);
  if (!accion) return null;   // sin acción resoluble no se ofrece nada: nunca un botón que no abre

  return { entidad: mejor.nombre, motivo: mejor.motivo, sentrixAction: accion };
}