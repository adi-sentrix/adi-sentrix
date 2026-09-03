/* === src/adi/sentrix/vigia.js · EL VIGÍA — ADI habla primero (owner 2026-09-03, «avanza con todo») ==========
 *
 * QUÉ ES (del diseño aprobado, `_VIGIA_DISENO.md`, opción (a)+(c)): el motor ya detecta estados sin que nadie
 * pregunte; el vigía los DICE — una franja al abrir la Mesa (siempre, con el silencio declarado) y un turno
 * proactivo en el chat SOLO cuando algo cambió. Este módulo es el CEREBRO de ambas superficies: la UI solo
 * pinta lo que sale de acá (regla 3 — cero cálculo en React).
 *
 * LA REGLA DE ORO: no calcula nada nuevo y no inventa causas. Habla SOLO de estados que el motor ya declara
 * (los findings del diagnóstico + la lectura del período), elegidos por la materialidad del piso relativo
 * (pisoFocosUSD — la MISMA vara del diagnóstico), máximo 3, cada uno localizado (quién y cuánto) y con el
 * primer paso OFRECIDO. El ejemplo medido del diseño es ley acá: en el demo el capital frenado es $33K y el
 * piso $50K → el vigía del demo NO menciona inventario. El vigía que grita bajo el piso es peor que ninguno.
 *
 * LAS DOS POLÍTICAS DE SILENCIO (aprobadas, y parametrizadas por si el owner luego prefiere otra mezcla):
 *   · franja (a): SIEMPRE pinta — sin focos dice «sin focos materiales» CON el umbral a la vista (la doctrina:
 *     un silencio sin su umbral es inauditable).
 *   · chat (c): SOLO-cuando-cambia — nuevo foco, foco que cruzó el piso, foco resuelto. El resto: silencio
 *     absoluto (null). El estado «qué vio ya» viaja como HUELLA canónica; la persistencia es del caller (la
 *     UI la guarda por tenant), este módulo es puro.
 *
 * ECONOMÍA: cero llamadas, cero corridas nuevas — todo sale de composeSpecDiagnose y getVentasKPI, que ya
 * corren para la Mesa. El signo negativo va en guion ASCII (la lección medida del agente: el «−» tipográfico
 * rompe parsers aguas abajo). Registro ejecutivo (lockeado por _registro_gate). */
import { composeSpecDiagnose, declaracionUmbralFocos, pisoFocosUSD } from "../specRetrieval.js";
import { getVentasKPI } from "../../engine/metrics.js";
import { ESCENARIO_INICIAL } from "../../config/scenarios.js";
import { _money } from "./mesa.js";

const _r1 = (n) => Math.round(n * 10) / 10;

/* los nombres ejecutivos de las familias del diagnóstico — los MISMOS conceptos de la síntesis certificada.
 * El de margen DECLARA SU UNIVERSO en la frase («la cartera con brecha material»): la cifra del detector en
 * prosa sin su universo es exactamente lo que _resumen_comercial_ui_gate multa — y multó al primer borrador
 * de esta franja. La regla de los dos montos parecidos no tiene excepción para el vigía. */
const _FAMILIA = {
  margen: { orden: 2, nombre: "de contribución no capturada en la cartera con brecha material" },
  carga: { orden: 3, nombre: "de carga comercial alta" },
  capital: { orden: 4, nombre: "de capital inmovilizado" },
};

/** buildVigia(scenario) → { focos, umbral, linea, lineaChat, ask, huella, hayMateriales } — puro, sin I/O. */
export function buildVigia(scenario) {
  const s = scenario || ESCENARIO_INICIAL;
  const piso = (() => { try { return pisoFocosUSD() || 0; } catch { return 0; } })();
  const umbral = (() => { try { return declaracionUmbralFocos(); } catch { return ""; } })();

  const focos = [];

  /* 1 · LA VENTA CAYENDO — manda (un negocio que se achica va primero; misma prioridad que la síntesis).
   * La MISMA KPI del hero, de la card y de la respuesta de ADI (getVentasKPI): una verdad. */
  const K = (() => { try { return getVentasKPI(null, null, s) || {}; } catch { return {}; } })();
  const _hayAnt = typeof K.totalAnterior === "number" && Number.isFinite(K.totalAnterior) && K.totalAnterior !== 0;
  if (_hayAnt && Number.isFinite(K.vsAnterior) && K.vsAnterior < 0) {
    focos.push({ familia: "venta", orden: 1, linea: `la venta viene ${_r1(K.vsAnterior)}% contra el año anterior` });
  }

  /* 2 · LOS FINDINGS DEL DIAGNÓSTICO, materiales por el piso — el detector ya localiza quién encabeza. */
  const diag = (() => { try { return composeSpecDiagnose({ filters: {}, scenario: s }); } catch { return null; } })();
  const F = (diag && diag.evidence && diag.evidence.findings) || [];
  for (const f of F) {
    const fam = _FAMILIA[f.detector];
    if (!fam) continue;
    if (!(Number.isFinite(f.subtotal_usd) && (piso <= 0 || f.subtotal_usd >= piso))) continue;   // bajo el piso: se calla
    const top = (f.items && f.items[0]) || null;
    focos.push({ familia: f.detector, orden: fam.orden,
      linea: `${_money(f.subtotal_usd)} ${fam.nombre}${top ? ` — encabeza ${top.entidad} con ${_money(top.usd)}` : ""}` });
  }

  focos.sort((a, b) => a.orden - b.orden);
  const top3 = focos.slice(0, 3);
  const hayMateriales = top3.length > 0;

  /* LA HUELLA canónica del estado — SOLO presencia de familias (la política aprobada: nuevo foco · cruce del
   * piso · foco resuelto; un monto que crece sin cruzar el piso NO re-dispara el chat). */
  const huella = top3.map((f) => f.familia).join("|") || "sin-focos";

  /* (a) LA FRANJA — siempre hay texto; el silencio se declara con su umbral. */
  const linea = hayMateriales
    ? `ADI vigila — ${top3.length === 1 ? "1 foco material" : `${top3.length} focos materiales`} hoy: ${top3.map((f) => f.linea).join(" · ")}.`
    : `ADI vigila — sin focos materiales hoy${umbral ? ` (${umbral})` : ""}.`;

  /* (c) EL TURNO PROACTIVO DEL CHAT — solo el contenido; hablarEnChat decide SI se dice. */
  const lineaChat = hayMateriales
    ? `Antes de tu pregunta: hoy veo ${top3.length === 1 ? "un foco material" : `${top3.length} focos materiales`}. ${top3.map((f) => f.linea).join("; ")}. ¿Abro alguno? También podemos seguir con lo tuyo.`
    : null;

  /* el botón «Abrir con ADI» lleva a la pregunta CERTIFICADA de la síntesis (28/28, gate-proven): el vigía
   * no estrena promesas — reusa la que ya tiene candado. */
  const ask = "dame los 3 riesgos para el directorio";

  return { focos: top3, umbral, linea, lineaChat, ask, huella, hayMateriales };
}

/** hablarEnChat(huellaVista, vigia) → string | null — la política (c): SOLO-cuando-cambia, silencio absoluto
 * el resto. `huellaVista` es la última huella que ese tenant ya vio (la UI la persiste); null/"" = primera vez.
 * Un foco RESUELTO también es un cambio: se dice corto, con el umbral, y la huella nueva lo absorbe. */
export function hablarEnChat(huellaVista, vigia) {
  if (!vigia) return null;
  const vieja = String(huellaVista || "");
  if (vieja === vigia.huella) return null;                       // nada cambió: silencio absoluto
  if (vigia.hayMateriales) return vigia.lineaChat;               // hay focos y son noticia (nuevos o cruzaron el piso)
  if (!vieja || vieja === "sin-focos") return null;              // sin focos y sin historia: no hay nada que anunciar
  return `Antes de tu pregunta: los focos que venía vigilando quedaron bajo el umbral de materialidad${vigia.umbral ? ` (${vigia.umbral})` : ""}. Sin focos materiales hoy.`;
}
