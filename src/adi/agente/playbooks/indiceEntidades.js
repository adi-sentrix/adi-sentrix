/* === src/adi/agente/playbooks/indiceEntidades.js · ¿LA PREGUNTA NOMBRA A ALGUIEN? ==========================
 *
 * Un solo lugar para responder eso, y dos playbooks lo usan al revés:
 *   · los que responden por EL NEGOCIO ENTERO (la foto, la lectura de ventas) se RETIRAN si hay un nombre —
 *     contestar el total a quien preguntó por Falabella es cambiarle la pregunta, y eso ya pasó una vez
 *     («cómo viene Falabella» lo secuestró la foto, censo 2026-09-04);
 *   · la FICHA solo aplica si hay un nombre, y necesita además CUÁL es, exacto como lo declara el índice,
 *     porque es el argumento con el que le pide el cuadro al motor.
 *
 * Vive aparte a propósito: dos copias del mismo guardia son dos verdades, y la primera vez que una se corrige
 * sin la otra el defecto vuelve por el lado que nadie miró.
 *
 * ⚠️ LOS NOMBRES DE UNA Y DOS LETRAS. Buscarlos como palabra suelta caza dentro de frases corrientes; ignorarlos
 * deja un agujero medido: «cómo viene LG» se lo llevaba la foto del negocio porque «LG» tiene dos caracteres y
 * el guardia lo salteaba. La regla que sale de esos dos hechos: los cortos se buscan SOLO con su capitalización
 * declarada (LG sí, «lg» no), que es como el usuario escribe una marca y no como escribe una preposición. */

import { axisEntityNames } from "../../oracle/entityIndex.js";

const _EJES = ["cliente", "sku", "marca", "familia", "bodega", "canal"];
const _esc = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const _CORTO = 3;   // menos de esto exige capitalización exacta

/**
 * La entidad que la pregunta nombra, o null.
 * Devuelve `{ nombre, eje }` con el nombre EXACTO del índice (el que las herramientas aceptan).
 * Si nombra más de una, gana la más larga: «LG-DRYER8KG» antes que «LG».
 */
/* ── EL EJE QUE NO EXISTE · punto de venta / sucursal / local / tienda (owner 2026-09-09) ────────────────────
 * «Punto de venta/sucursal queda como trabajo de ingesta si hoy no lo lee el motor.» Y no lo lee: la columna
 * viaja en el archivo del cliente y ningún módulo la agrega. El problema NO era declararlo —el límite ya se
 * declara— sino que la pregunta ni llegaba a esa declaración: una auditoría adversarial encontró que
 * «¿cómo viene la sucursal Santiago?» se resolvía con la FICHA DE UNA BODEGA, porque en este dato hay bodegas
 * con nombre de ciudad y el índice las reconoce. El usuario recibía capital de inventario como si fuera la
 * lectura de su local. Eso es improvisar con otro eje, que es exactamente lo que el owner pidió evitar.
 * Acá vive el detector, junto al índice que resuelve los nombres: quien podría contestar por el eje vecino
 * consulta esto y se retira. */
const _PIDE_PUNTO_DE_VENTA = /\bpunto[s]? de venta\b|\bsucursal(?:es)?\b|\blocal(?:es)?\b|\btienda[s]?\b/i;
/** ¿la pregunta pide el eje PUNTO DE VENTA, que este producto todavía no analiza? */
export function pidePuntoDeVenta(pregunta) { return _PIDE_PUNTO_DE_VENTA.test(String(pregunta || "")); }

export function entidadNombrada(pregunta) {
  const q = String(pregunta || "");
  if (!q.trim()) return null;
  let mejor = null;
  for (const eje of _EJES) {
    let nombres = [];
    try { nombres = axisEntityNames(eje) || []; } catch { nombres = []; }
    for (const n of nombres) {
      const nombre = String(n);
      if (!nombre) continue;
      const corto = nombre.length < _CORTO;
      const re = new RegExp(`(?<![\\w-])${_esc(nombre)}(?![\\w-])`, corto ? "" : "i");
      if (!re.test(q)) continue;
      if (!mejor || nombre.length > mejor.nombre.length) mejor = { nombre, eje };
      /* LA COLISIÓN SE DEVUELVE, NO SE TRAGA (tanda 3 post-poda, 2026-09-05): el MISMO nombre puede existir
       * en dos ejes de un catálogo real («Valparaíso» bodega y cliente). Elegir en silencio contradice el
       * contrato del ask de cuadro; quien recibe el resultado decide con el viewContext o DECLARA. La
       * colisión es del nombre elegido — un nombre más largo que contiene a otro no colisiona con él. */
      else if (mejor && nombre === mejor.nombre && eje !== mejor.eje) {
        mejor = { ...mejor, colision: [...(mejor.colision || [mejor.eje]), eje] };
      }
    }
  }
  return mejor;
}

/** true si la pregunta menciona el nombre de alguna entidad declarada en el índice del tenant. */
export function nombraEntidad(pregunta) {
  return entidadNombrada(pregunta) !== null;
}

/* ── DOS NOMBRES, NO UNO ───────────────────────────────────────────────────────────────────────────────────
 * `entidadNombrada` devuelve LA entidad —la más larga— y eso es correcto para la ficha, que responde por una.
 * Pero hay preguntas cuyo objeto son DOS: «¿por qué Jumbo vende menos que Lider pero aporta más?» no se puede
 * contestar con Jumbo solo, y comparar alternativas tampoco. Acá se devuelven TODAS, del mismo eje, EN EL
 * ORDEN EN QUE APARECEN — el orden importa: quien pregunta pone primero el sujeto de su contradicción, y
 * responder al revés le cambia la pregunta.
 * Se filtra por contención para no devolver «LG» junto a «LG-DRYER8KG»: es un nombre, no dos. */
export function entidadesNombradas(pregunta, eje = null) {
  const q = String(pregunta || "");
  if (!q.trim()) return [];
  const ejes = eje ? [eje] : _EJES;
  const halladas = [];
  for (const e of ejes) {
    let nombres = [];
    try { nombres = axisEntityNames(e) || []; } catch { nombres = []; }
    for (const n of nombres) {
      const nombre = String(n);
      if (!nombre) continue;
      const corto = nombre.length < _CORTO;
      const re = new RegExp(`(?<![\\w-])${_esc(nombre)}(?![\\w-])`, corto ? "" : "i");
      const m = re.exec(q);
      if (m) halladas.push({ nombre, eje: e, en: m.index });
    }
  }
  /* el nombre contenido en otro más largo que también aparece NO es una entidad aparte */
  const limpias = halladas.filter((a) => !halladas.some((b) => b !== a && b.nombre.length > a.nombre.length && b.nombre.toLowerCase().includes(a.nombre.toLowerCase())));
  const vistas = new Set();
  return limpias.sort((a, b) => a.en - b.en)
    .filter((x) => { const k = `${x.eje}·${x.nombre}`; if (vistas.has(k)) return false; vistas.add(k); return true; })
    .map(({ nombre, eje: ej }) => ({ nombre, eje: ej }));
}
