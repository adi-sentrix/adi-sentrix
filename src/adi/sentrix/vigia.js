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
import { guardC } from "../oracle/guardC.js";                 // EL MURO también acá (supervisor 2026-09-03)
import { cifrasDelDato } from "../oracle/datoProyectado.js";  // el mismo contexto de dato que usa el bucle
import { axisEntityNames } from "../oracle/entityIndex.js";

const _r1 = (n) => Math.round(n * 10) / 10;

/* ── EL MURO JUZGA LO QUE SALE (supervisor 2026-09-03) ────────────────────────────────────────────────────────
 * «La regla de la casa no es 'confiamos en la fuente', es que el muro juzga lo que sale» — el `componer` de los
 * playbooks es determinístico y de cifras selladas, y aun así se juzga. El vigía lleva cifras a la pantalla del
 * usuario sin que nadie pregunte: con más razón. Se juzga contra la MISMA boleta que produjo sus cifras (la del
 * diagnose) más el dato proyectado — el mismo contexto que arma el bucle del agente.
 * QUÉ PASA SI VETA: el texto NO sale (la franja no se pinta, el chat calla) y el motivo queda en `vetos` para
 * que se vea. Un texto vetado no se afloja ni se maquilla: se calla y se reporta. */
const _ejes = (lista) => {
  const o = [];
  for (const e of lista) { try { for (const n of axisEntityNames(e)) o.push(n); } catch { /* sin índice: ese eje no participa */ } }
  return o.length ? o : null;
};
function _muro(texto, { boleta, scenario }) {
  if (!texto) return null;
  try {
    const v = guardC(texto, {
      ledger: { figs: boleta || [] }, results: [], trace: null, question: "",
      datoProyectado: cifrasDelDato(scenario),
      entidadesDelTenant: _ejes(["cliente", "sku", "marca"]),
      duenosDelTenant: _ejes(["cliente", "sku", "marca", "familia", "bodega", "canal"]),
      contentScope: "full", tablePolicy: "auto",
    });
    if (v && v.ok) return null;
    const m = v && (v.multa || (Array.isArray(v.violations) && v.violations[0] && (v.violations[0].detail || v.violations[0].kind)));
    return String(m || "vetado por el muro").split("\n")[0].slice(0, 180);
  } catch (e) {
    return `el muro no pudo juzgar: ${String(e && e.message).slice(0, 90)}`;   // sin juicio no se publica
  }
}

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
  const boleta = (diag && diag.evidence && diag.evidence.boleta) || [];   // las MISMAS figs con las que el muro lo juzga
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

  /* ⚠️ DOS LECCIONES QUE EL MURO ME ENSEÑÓ SOBRE ESTE TEXTO (2026-09-03, al cablearlo — las dos multas eran
   * CORRECTAS y se corrigieron acá, no aflojando al juez):
   *   · «2 focos materiales» era un CONTEO NO AUTORIZADO: ese 2 no está en ninguna boleta. Va en PALABRAS, el
   *     mismo precedente que la regla del owner sobre el vencido sin plazo. Con techo de 3, alcanza y sobra.
   *   · los focos separados por « · » quedaban en UNA oración y el binding del muro atribuía el «$1.6M» de
   *     contribución a la palabra «carga» del foco siguiente — la lección ya escrita de la casa: UNA CIFRA POR
   *     ORACIÓN, cada una con su dueño. Ahora cada foco es su propia oración. */
  const _CUENTA = ["", "un", "dos", "tres"];
  const _oraciones = (fs2) => fs2.map((f) => `${f.linea.charAt(0).toUpperCase()}${f.linea.slice(1)}.`).join(" ");

  /* (a) LA FRANJA — siempre hay texto; el silencio se declara con su umbral. */
  const lineaBruta = hayMateriales
    ? `ADI vigila — ${_CUENTA[top3.length] || top3.length} ${top3.length === 1 ? "foco material" : "focos materiales"} hoy. ${_oraciones(top3)}`
    : `ADI vigila — sin focos materiales hoy${umbral ? ` (${umbral})` : ""}.`;

  /* (c) EL TURNO PROACTIVO DEL CHAT — solo el contenido; hablarEnChat decide SI se dice. */
  const chatBruto = hayMateriales
    ? `Antes de tu pregunta: hoy veo ${_CUENTA[top3.length] || top3.length} ${top3.length === 1 ? "foco material" : "focos materiales"}. ${_oraciones(top3)} ¿Abro alguno? También podemos seguir con lo tuyo.`
    : null;

  /* EL MURO, en las DOS superficies: lo vetado no sale — ni a la franja ni al chat. Los motivos quedan a la
   * vista en `vetos` (nadie los maquilla: si el muro veta algo legítimo, se trae, no se afloja). */
  const vetos = [];
  const vFranja = _muro(lineaBruta, { boleta, scenario: s });
  if (vFranja) vetos.push(`franja · ${vFranja}`);
  const vChat = _muro(chatBruto, { boleta, scenario: s });
  if (vChat) vetos.push(`chat · ${vChat}`);
  const linea = vFranja ? null : lineaBruta;
  const lineaChat = vChat ? null : chatBruto;

  /* el botón «Abrir con ADI» lleva a la pregunta CERTIFICADA de la síntesis (28/28, gate-proven): el vigía
   * no estrena promesas — reusa la que ya tiene candado. */
  const ask = "dame los 3 riesgos para el directorio";

  return { focos: top3, umbral, linea, lineaChat, ask, huella, hayMateriales, vetos, boleta };
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
