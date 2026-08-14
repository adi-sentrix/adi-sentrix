/* === src/adi/oracle/cicloNotarial.js · EL CICLO DEL CAMINO NATURAL, CON LA GARANTÍA ADENTRO (2026-08-14) ======
 * QUÉ ES: el flujo que la constitución acordó para el camino natural, escrito una sola vez —
 *   «1. la pregunta llega al cerebro · 2. el cerebro razona y escribe · 3. el NOTARIO verifica: falla → una
 *    devolución con la falla exacta; reincide → SUPLENTE DIGNO · 4. pantalla»
 * — con la garantía anti-silencio de la propia constitución hecha código: «si el cerebro falla dos veces,
 * responde el suplente digno con las cifras verdaderas. La pantalla nunca queda en blanco.»
 *
 * POR QUÉ EXISTE COMO MÓDULO Y NO DENTRO DEL ARNÉS (corrida doble 2026-08-14): el ciclo vivía suelto dentro de
 * `_corrida_doble.mjs`, que abre sockets y no se puede correr en `gates:offline` — así que la garantía del brazo
 * natural no tenía forma de quedar FIJADA por un gate. Un arnés que se prueba a sí mismo no prueba nada. Acá el
 * ciclo es puro e inyectable: el arnés le pasa el modelo real y el gate le pasa un modelo mockeado que devuelve
 * `""`, espacios o `null`, y los dos ejercitan EXACTAMENTE el mismo código. Una implementación, cero divergencia.
 *
 * PURO · sin I/O · sin red · no importa el gateway ni ningún adapter. Todo lo que habla con el mundo (el modelo,
 * el hilo de mensajes) entra por `pedir`, que lo pone el caller.
 *
 * LA GARANTÍA ES DEL MÓDULO, NO DE LA DISCIPLINA DEL CALLER: esta función no puede devolver un texto vacío. Si el
 * suplente que le pasaron también viniera en blanco, cae al genérico PELADO de `composeNoDataMessage(null)` — el
 * MISMO último recurso absoluto de la escalera anti-null de `answerViaOracle`, nunca una segunda frase.
 * Y el vacío no tiene una rama propia: `juzgar` (guardC) ya lo trata como veredicto bloqueante, así que una
 * pantalla en blanco entra al ciclo de reparación por la MISMA puerta que cualquier otro veto. Lo único propio
 * del vacío es cómo se REPORTA — `vacias` deja el registro intento por intento para que ningún balance pueda
 * volver a esconderlo dentro de «reparado». */
import { esNarracionVacia } from "./guardC.js";
import { composeNoDataMessage } from "./narrationBlocks.js";
import { DEICTIC_PLURAL_RE } from "./conversationScope.js";   // el MISMO detector de referencia plural del camino vigente
import { parseFigures } from "../boleta.js";                  // el MISMO parser del muro — el canon (con su unidad) sale de acá

/* ── EL ALCANCE HEREDADO DEL CAMINO NATURAL (corrida doble #2, 2026-08-14) ───────────────────────────────────────
 * MEDIDO: ante «reduce en 2 puntos las acciones comerciales de ESOS clientes», el brazo natural respondió sobre
 * TRES cuentas — perdió a Sodimac del conjunto que él mismo había nombrado el turno anterior. El notario ya sabe
 * cazar eso (`alcanceHeredado` en guardC, veto `alcance-heredado-cambiado` con su instrucción de reparación),
 * pero nadie se lo estaba pasando: la seguridad existía y el cable faltaba.
 *
 * DE DÓNDE SALE EL ALCANCE ACÁ. El camino vigente lo deriva de la BOLETA del turno (conversationScope). El camino
 * natural no tiene boleta: su única huella de qué se habló es LO QUE ADI MISMA ESCRIBIÓ. Así que el alcance son
 * las entidades del catálogo real que la respuesta anterior nombró — nunca una lista escrita a mano, nunca algo
 * que el modelo declare sobre sí mismo.
 *
 * ANGOSTO POR TRES CANDADOS, para que no vete conversación legítima:
 *   (1) solo si la pregunta trae una referencia deíctica PLURAL — el mismo `DEICTIC_PLURAL_RE` del camino vigente,
 *       no una regla nueva. Sin «esos/estos/los mismos», no hay alcance que heredar y devuelve null;
 *   (2) solo el eje DOMINANTE de la respuesta anterior (el que más entidades aportó), y solo si aportó 2+: con una
 *       sola entidad no hay «conjunto» que sustituir, y mezclar ejes convertiría un SKU citado al pasar en parte
 *       del alcance;
 *   (3) los candidatos son los de ESE eje — nombrar una bodega o el benchmark sigue siendo legítimo.
 * Sin catálogo o sin respuesta anterior: null, y el turno se juzga exactamente como antes. */
export function alcanceHeredadoDe({ pregunta, respuestaAnterior, catalogoPorEje } = {}) {
  const q = String(pregunta || "");
  if (!DEICTIC_PLURAL_RE.test(q)) return null;
  const prev = String(respuestaAnterior || "");
  if (!prev.trim() || !catalogoPorEje || typeof catalogoPorEje !== "object") return null;
  let mejor = null;
  for (const [eje, nombres] of Object.entries(catalogoPorEje)) {
    if (!Array.isArray(nombres) || !nombres.length) continue;
    const nombradas = nombres.filter((n) => new RegExp(`\\b${String(n).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(prev));
    if (nombradas.length >= 2 && (!mejor || nombradas.length > mejor.entities.length)) mejor = { eje, entities: nombradas, candidatos: nombres };
  }
  return mejor;
}

/* ── LA RE-CITA APROBADA (owner 2026-08-14, medido en la mini doble #2) ──────────────────────────────────────────
 * «Puede re-citar cifras aprobadas por ADI en turnos anteriores; solo si coinciden entidad, métrica, unidad,
 * periodo/concepto y alcance; si la cifra no fue aprobada antes, o cambia de dueño/concepto, sigue muriendo.»
 *
 * Acá se construye el insumo con la forma que `guardC` ya sabe verificar (la misma de la quinta fuente:
 * `{figs:[{value, duenos}]}`), y los tres candados de la regla viven en dónde y cómo se construye:
 *   · APROBADA — el caller SOLO debe pasarle textos que ya pasaron el muro (estado verde o reparado). Un
 *     borrador vetado no entra: por eso `responderConNotario` devuelve `aprobado`, para que el caller no tenga
 *     que decidirlo de memoria.
 *   · MISMO DUEÑO/CONCEPTO — los dueños de cada cifra son los tokens que la acompañaban en SU oración original
 *     (entidades reales del catálogo + el vocabulario de concepto del producto). `guardC` exige que uno de ellos
 *     esté en la oración de la re-cita; si la cifra cambia de dueño, no autoriza.
 *   · MISMA UNIDAD Y MISMO VALOR — van en el canon, que es la llave del índice ($104.0M ≠ 104%).
 * El alcance/período se sostiene por el mismo camino: «proyectados», «presupuesto», «año anterior», «total» son
 * parte del vocabulario de concepto, así que una cifra proyectada re-citada como si fuera real pierde su dueño. */
const _CONCEPTOS_RECITA = ["negocio", "total", "totales", "cartera", "global", "presupuesto", "anterior", "proyectado", "proyectados", "proyección", "supuesto", "escenario", "benchmark", "referencia", "margen", "venta", "ventas", "contribución", "costo", "carga", "capital", "inventario", "rotación", "unidades", "acciones"];
export function recitaAprobadaDe({ textoAprobado, catalogoEntidades, previa = null, cap = 24 } = {}) {
  const t = String(textoAprobado || "");
  const figs = Array.isArray(previa && previa.figs) ? [...previa.figs] : [];
  if (t.trim()) {
    const ents = Array.isArray(catalogoEntidades) ? catalogoEntidades : [];
    // ⚠️ EL CORTE DE ORACIÓN TIENE QUE SER NUMBER-SAFE: partir por «.» a secas rompe «$104.0M» en «$104» + «0M»
    // y la cifra desaparece. Se exige espacio (o fin de texto) después del signo — sin lookbehind (Safari viejo).
    for (const oracion of t.split(/[.!?\n]+(?:\s+|$)/)) {
      // el `\b` va SOLO tras las unidades que son letras: «25.1%» al final de una frase no tiene word-boundary
      // después del «%» y se perdía (medido: el turno nuevo no sumaba nada a la memoria de re-cita).
      const cifras = oracion.match(/\$[\d.,]+[KMB]?|[\d.,]+\s*(?:%|(?:pp|x|d)\b)/gi) || [];
      if (!cifras.length) continue;
      const duenos = [
        ...ents.filter((e) => new RegExp(`\\b${String(e).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(oracion)),
        ..._CONCEPTOS_RECITA.filter((c) => new RegExp(`\\b${c}\\b`, "i").test(oracion)),
      ];
      if (!duenos.length) continue;   // una cifra sin dueño en su propia oración no puede prestar el suyo
      // el CANON lo pone `parseFigures` — el MISMO parser del muro, nunca un segundo. Ahí vive la unidad
      // («money:$104.0M» ≠ «pct:104%»), que es lo que hace que el mismo número con otra unidad no se autorice.
      for (const c of cifras) for (const pf of parseFigures(c.trim())) figs.push({ canon: pf.canon, value: pf.text, duenos });
    }
  }
  // cap por el mismo criterio que la boleta anterior del camino vigente (1b): una memoria de cifras larga deja
  // de ser una SEÑAL y pasa a ser un volcado. Se conservan las MÁS RECIENTES.
  return figs.length ? { figs: figs.slice(-cap) } : null;
}

/**
 * responderConNotario({ pedir, juzgar, suplente, lavar }) → { texto, estado, vetos, vacias, suplenteDigno, aprobado, calls }
 *  · pedir({ intento, multa, anterior }) → texto crudo del cerebro (async). El caller maneja el hilo de mensajes.
 *  · juzgar(texto) → veredicto de guardC ({ ok, verdict, violations }).
 *  · suplente() → el texto de respaldo con las cifras verificadas (ver suplenteDignoDelDato en datoProyectado.js).
 *  · lavar(texto) → el lavado de registro del producto (opcional). Se aplica null-safe: si deja el texto en nada,
 *    eso cuenta como vacío igual que si el modelo no hubiera escrito nada — que es el caso que el arnés midió.
 * estado ∈ "verde" (pasó al primer intento) · "reparado" (pasó al segundo) · "suplente" (dos textos vetados) ·
 *          "vacio" (el cerebro volvió en blanco y respondió el suplente digno). Son EXCLUYENTES: suman el total.
 */
export async function responderConNotario({ pedir, juzgar, suplente = null, lavar = null } = {}) {
  const _lav = (t) => {
    const crudo = String(t == null ? "" : t);
    if (typeof lavar !== "function") return crudo;
    const lavado = lavar(crudo);
    return String(lavado == null ? "" : lavado);
  };
  // `aprobado`: si el texto que sale FUE avalado por el muro (verde o reparado). Es lo que decide si esa
  // respuesta puede prestar sus cifras al turno siguiente — el caller no tiene que deducirlo de memoria.
  const out = { texto: "", estado: "verde", vetos: [], vacias: [], suplenteDigno: false, aprobado: true, calls: 0 };

  let texto = _lav(await pedir({ intento: 1, multa: null, anterior: null })); out.calls++;
  if (esNarracionVacia(texto)) out.vacias.push(1);
  let v = juzgar(texto);

  if (!v || !v.ok) {
    out.vetos.push(String(v && v.verdict));
    const multa = ((v && v.violations) || []).slice(0, 3).map((x) => `[${x.kind}] ${x.detail}`).join("\n");
    texto = _lav(await pedir({ intento: 2, multa, anterior: texto })); out.calls++;
    if (esNarracionVacia(texto)) out.vacias.push(2);
    v = juzgar(texto);
    if (!v || !v.ok) out.vetos.push(`2º: ${v && v.verdict}`);
    // «vacio» NO es «suplente»: las dos terminan sin la respuesta del cerebro, pero una es un texto que el notario
    // rechazó y la otra es una pantalla en blanco. Categorías distintas porque son fallas distintas.
    out.estado = (v && v.ok) ? "reparado" : (esNarracionVacia(texto) ? "vacio" : "suplente");
    out.aprobado = !!(v && v.ok);   // un texto que el muro rechazó NO puede prestar sus cifras al turno siguiente
    if (esNarracionVacia(texto)) {
      const s = typeof suplente === "function" ? suplente() : null;   // UNA sola invocación: componer el suplente puede no ser gratis
      texto = String(s == null ? "" : s);
      out.suplenteDigno = true;
    }
  }
  // EL PISO ABSOLUTO: pase lo que pase arriba —incluido un suplente que llegue vacío—, de acá no sale una pantalla
  // en blanco. Cero cifras, cero entidades: no hay chequeo del muro que tenga algo que cobrarle a esta oración.
  if (esNarracionVacia(texto)) { texto = composeNoDataMessage(null); out.suplenteDigno = true; }
  out.texto = texto;
  return out;
}
