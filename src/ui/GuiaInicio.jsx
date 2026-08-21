/* === src/ui/GuiaInicio.jsx · LA GUÍA DE INICIO (owner 2026-08-07 · ampliada 2026-08-10) ===
 * El problema original: la app abría en un chat vacío. El usuario no sabía qué preguntar ni para qué servía el
 * panel. La primera versión resolvió eso con tres pasos. El owner la volvió a mirar y dijo lo que faltaba:
 * "está muy básica — el usuario tiene que entender qué puede preguntar, qué puede relacionar, por qué existe
 * Sentrix, cómo se abre, cómo se relaciona con ADI, la historia que cuenta, nuestras tres reglas".
 *
 * EL VACÍO NO SE LLENA CON UN TOUR DE FEATURES. Se llena con lo único que el usuario NO puede deducir mirando la
 * pantalla quieta: la división del trabajo, la forma de una respuesta, y qué se le permite afirmar al producto.
 *     "Sentrix muestra el dato. ADI lo interpreta."
 *
 * SEIS CAPÍTULOS, CON ÍNDICE. Un asistente de seis pasos donde solo se puede apretar "Siguiente" es peor que uno
 * de tres: nadie hace seis clics para leer un folleto. Por eso el encabezado trae el índice numerado y cada
 * capítulo se abre directo. El recorrido lineal sigue existiendo para quien lo quiera.
 *   1 · quién hace qué y por qué existe Sentrix   4 · qué se puede RELACIONAR (los cruces entre los dos mundos)
 *   2 · la historia: los tres movimientos          5 · dónde está la evidencia (las tres puertas)
 *   3 · qué preguntar (ejemplos ejecutables)       6 · las tres reglas
 *
 * TRES INVARIANTES DURAS DE ESTE ARCHIVO:
 *
 *   1. LOS EJEMPLOS NO SE INVENTAN. `GUIA_EJEMPLOS` no declara preguntas propias: las DERIVA de HERO_CHIPS
 *      (ChatADI.jsx) buscándolas por texto exacto. HERO_CHIPS son specs curados y verificados — si la guía
 *      prometiera algo que el motor no contesta, el primer turno del usuario sería un decline, peor que no
 *      haber guiado. Si mañana alguien renombra un chip, la guía muestra UNO MENOS (degrada honesto, no
 *      revienta la app) y `_guia_inicio_gate` falla en CI diciendo exactamente cuál se perdió.
 *
 *   2. CERO LLAMADAS AL PROVEEDOR. La guía es texto estático + los specs que ya existen. No pide plan, no pide
 *      narración, no toca el gateway. El único efecto lateral de un ejemplo es ejecutar el MISMO camino que
 *      tocar ese chip en el hero (submitSpec), que es donde vive la decisión de cómo resolverlo.
 *
 *   3. LO QUE LA GUÍA PROMETE, EXISTE. Misma disciplina que la invariante 1, aplicada al texto que NO es
 *      clickeable: prometer un cruce que no existe deja al usuario buscando algo que no va a encontrar.
 *      🔴 Esta invariante nació de un error mío el mismo día que la escribí. El capítulo de los cruces prometía
 *      "el capital que tenés parado en los productos de este cliente" — un cruce que existía cuando lo redacté y
 *      que el owner RETIRÓ horas después (decisión 9): salía de una matriz de afinidad con todos los pesos > 0,
 *      así que el surtido de cada cuenta abarcaba los 13 de 13 SKU y la cifra era el inventario global repetido
 *      trece veces con nombre de cliente encima. El gate ahora prohíbe que vuelva.
 *
 * FORMA: panel que NO bloquea (se puede saltar en cualquier capítulo, la app sigue clickeable detrás) · en móvil
 * baja a hoja inferior a ancho completo. Primera visita se abre sola; después, solo desde el botón permanente
 * "¿Cómo funciona?" del header.
 *
 * REGISTRO: mismo que ADI ([[adi-lenguaje-formal]] · [[adi-perfil-persona]]) — ejecutivo sencillo, una idea por
 * frase, sin coloquialismos. Este archivo está en el barrido estático de `_registro_gate`. Y sin sobreafirmar:
 * ADI interpreta y enmarca la decisión ([[adi-contrato-de-respuesta]]), no decide por el usuario.
 */
import React, { useEffect, useState } from "react";
import { C } from "./theme.js";
import { HERO_CHIPS } from "./ChatADI.jsx";
import { coerceFloor } from "../adi/coerceChain.js";   // el MISMO coercer determinístico del texto libre: los specs de la guía se derivan, nunca se escriben a mano
import { cuentasMasGrandes } from "../adi/helpers.js";   // las cuentas que el ejemplo nombra salen del dato, no de una lista
import { clientesMargen } from "../data/demoData.js";
import { onTenantChange } from "../data/tenantStore.js";

// ── PERSISTENCIA · mismo patrón que el resto de la app (adi_hint_v1 · adi_mesa_cara_v1 · adi_watchlist_v1) ──
// DOS valores, no un booleano, porque son dos hechos distintos:
//   "vista" → la guía ya se mostró sola una vez. No vuelve a abrirse sola (owner: "primera visita se abre sola;
//             después, solo si la piden"). Se escribe AL CERRAR.
//   "nunca" → el usuario pidió explícitamente no volver a verla. Se escribe EN EL MOMENTO de marcar la casilla,
//             no al cerrar: si cierra la pestaña con la guía abierta, su decisión ya quedó guardada igual.
// Ambos suprimen la apertura automática; el botón del header abre siempre, con cualquiera de los dos puesto.
export const GUIA_KEY   = "adi_guia_v1";
export const GUIA_VISTA = "vista";
export const GUIA_NUNCA = "nunca";

export function leerGuiaMarca() {
  try { return typeof localStorage !== "undefined" ? localStorage.getItem(GUIA_KEY) : null; } catch { return null; }
}
export function marcarGuia(valor) {
  try { if (typeof localStorage !== "undefined") localStorage.setItem(GUIA_KEY, valor); } catch { /* sin storage → sesión */ }
}
/** ¿Se abre sola? Solo en la primera visita: sin marca guardada. */
export function guiaAbreSola() { return !leerGuiaMarca(); }

/* ── LOS EJEMPLOS, POR TEMA (owner 2026-08-10) ────────────────────────────────────────────────────────────────
 * El owner pidió un ejemplo por cada cosa que el producto sabe hacer, no tres sueltos. La invariante 1 sigue en
 * pie, con el mecanismo ampliado: el spec de cada pregunta sale de HERO_CHIPS si el chip existe, y si no, del
 * MISMO coercer determinístico que usa la app para el texto libre (`coerceFloor`). No se escribe un spec a mano
 * en ningún caso. Si una pregunta no produce spec, la guía la deja fuera — degrada honesto, como siempre — y el
 * gate falla diciendo cuál se perdió.
 *
 * DOS DE LOS SEIS TEMAS QUE PIDIÓ EL OWNER NO ESTÁN, y las dos ausencias están medidas, no supuestas:
 *
 *   · FICHA · «Explicame Falabella y qué debería revisar primero.» El texto libre la contesta muy bien
 *     (ruta `client_dive`, 1.937 caracteres). Pero NINGUNO de los dos coercers le saca spec, y con el oráculo
 *     apagado —que es producción hoy— el click respondería "No recibí un pedido para procesar". Un ejemplo que
 *     funciona en desarrollo y falla en producción es peor que no ofrecerlo.
 *
 *   · CRUCES · «¿Puedo sumar venta anual con capital inmovilizado?» El motor NO contesta lo que se le pregunta:
 *     devuelve la lectura de capital inmovilizado, byte por byte la misma que da «¿Dónde tengo capital
 *     inmovilizado?». Se probaron cuatro redacciones y ninguna produce la respuesta correcta, que sería declarar
 *     que los dos universos no reconcilian. Está reportado; hasta que se arregle, ofrecerlo enseñaría lo contrario
 *     de lo que el producto sostiene.
 *
 * La glosa de cada uno describe lo que el motor DEVUELVE de verdad, sin prometer de más. */
/* ⚠️ REESCRITO (owner 2026-08-15): «no deben usar una ruta demo, respuesta prearmada ni shortcut. Cuando el
 * usuario toque una pregunta, debe enviarse el prompt exacto al mismo chat normal, con el mismo camino natural,
 * notario, reparación, contrato [[CALCULO]] y rastro interno».
 *
 * QUÉ CAMBIÓ Y POR QUÉ. Hasta hoy cada ejemplo llevaba un SPEC enlatado (de HERO_CHIPS o del coercer) y el click
 * ejecutaba ese spec por una puerta propia (`submitSpec`). Era una decisión defendible cuando el motor
 * determinístico era el piso: garantizaba que el primer turno del usuario nunca fuera un decline. Pero hoy el
 * producto ES el camino natural, y una puerta que lo esquiva muestra otra cosa que la que el usuario va a usar.
 * Ahora cada ejemplo es SOLO UN TEXTO, y el click lo manda por `submit()` — la misma función que corre cuando
 * escribís y apretás Enter. Sin spec, sin atajo, sin ruta demo.
 *
 * LAS PREGUNTAS SON LAS DE LOS EXÁMENES, verbatim. No se inventan acá: son las que se corrieron y verificaron
 * contra la carpeta en los exámenes 1, 2 y 3, así que la guía promete exactamente lo que está medido.
 * `titulo` es lo que se lee en el botón; `q` es el prompt EXACTO que viaja al chat. Los dos se muestran para que
 * nadie tenga que adivinar qué se va a enviar. */
const _TEMAS = [
  { tema: "Comercial", titulo: "¿Qué clientes venden mucho pero están bajo benchmark?",
    glosa: "Ordena las cuentas grandes por venta, margen y brecha.",
    q: "Dime cuáles son los clientes que venden mucho pero están bajo el benchmark de margen. Ordénalos por mayor venta y dame un resumen ejecutivo." },
  { tema: "Inventario", titulo: "¿Dónde tengo capital inmovilizado o frenado?",
    glosa: "Separa capital inmovilizado de SKU frenados y muestra los principales casos.",
    q: "Identifica los SKU con capital inmovilizado o frenado. Dame cantidad de SKU, monto total y principales casos." },
  { tema: "Períodos", titulo: "¿Cómo va el año contra el anterior?",
    glosa: "Compara ventas y margen, y declara si falta algún dato.",
    q: "Compara el año actual contra el año anterior en ventas y margen. Si algún dato no está en la carpeta, dilo explícitamente." },
  { tema: "Simulación", titulo: "Si bajo 2% la carga comercial, ¿qué cambia?",
    glosa: "Corrige la ambigüedad entre 2% y 2 puntos antes de calcular.",
    // El único ejemplo que nombra cuentas las recibe armadas (ver abajo): antes decía "Falabella y Lider".
    q: (ctx) => `Baja 2% la carga comercial de ${ctx.dosCuentas}, y dime el impacto. Si «2%» es ambiguo, corrígelo antes de calcular.` },
];

/* GUIA_EJEMPLOS · los prompts, YA con las cuentas del negocio activo (2026-08-21).
 * El ejemplo de simulación nombraba «Falabella y Lider» — dos cuentas del demo escritas a mano en la pantalla de
 * bienvenida. Es el primer texto que ve alguien que abre la app: ofrecerle un click que simula sobre cuentas de
 * otra empresa es prometerle una respuesta que ADI no puede dar. Las dos más grandes salen del dato, y como el
 * dataset entra por `initTenant` (el store arranca vacío), esto se RE-ARMA ahí, como todo lo demás derivado. */
const _construirEjemplos = () => {
  const dos = cuentasMasGrandes(clientesMargen, 2);
  const ctx = { dosCuentas: dos.length >= 2 ? `${dos[0]} y ${dos[1]}` : (dos[0] || "tus cuentas más grandes") };
  return _TEMAS.map((t) => (typeof t.q === "function" ? { ...t, q: t.q(ctx) } : t));
};
export let GUIA_EJEMPLOS = _construirEjemplos();
onTenantChange(() => { GUIA_EJEMPLOS = _construirEjemplos(); });

// ── EL ÍNDICE · una sola fuente para el conteo, el orden y los rótulos. El gate lo importa en vez de repetir el
// número: si mañana se agrega un capítulo, el gate recorre siete sin que nadie lo edite. ──
export const GUIA_CAPITULOS = [
  "Quién hace qué",
  "Cómo te responde",
  "Qué preguntar",
  "Qué relacionar",
  "Dónde está la evidencia",
  "Nuestras tres reglas",
];
export const GUIA_PASOS = GUIA_CAPITULOS.length;

// ── piezas de estilo compartidas (inline · el proyecto no usa CSS modules) ──
const MONO = "'JetBrains Mono', ui-monospace, monospace";
const _eyebrow = { fontSize: 9.5, fontFamily: MONO, letterSpacing: "1.1px", textTransform: "uppercase", color: C.celeste, fontWeight: 600 };
const _titulo  = { fontSize: 16, fontWeight: 600, color: C.text, letterSpacing: "-0.01em", lineHeight: 1.35, marginTop: 7 };
const _bajada  = { fontSize: 12.5, color: C.textSub, lineHeight: 1.55, marginTop: 7 };
const _pie     = { fontSize: 11.5, color: C.textMuted, lineHeight: 1.5, marginTop: 13, paddingTop: 11, borderTop: `1px solid ${C.border}` };

// item numerado · la misma pieza en los capítulos 2, 5 y 6 (un solo idioma visual para "esto viene en pasos")
const Item = ({ n, titulo, children }) => (
  <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
    <span style={{ width: 17, height: 17, borderRadius: "50%", flexShrink: 0, marginTop: 1, border: "1px solid rgba(47,184,218,0.5)", color: C.celeste, fontSize: 9.5, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: MONO }}>{n}</span>
    <span style={{ fontSize: 12.5, color: C.textSub, lineHeight: 1.55, minWidth: 0 }}>
      {titulo ? <b style={{ color: C.text, fontWeight: 600, display: "block", marginBottom: 2 }}>{titulo}</b> : null}
      {children}
    </span>
  </div>
);
const Lista = ({ children }) => <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 14 }}>{children}</div>;

// CAPÍTULO 1 · el ida y vuelta, y POR QUÉ existe Sentrix. Las dos direcciones son SIMÉTRICAS a propósito: el
// usuario tiene que ver que el puente se cruza en los dos sentidos, que es justo lo que no se deduce mirando la
// pantalla quieta.
function CapQuienHaceQue() {
  const fila = (origen, destino, texto) => (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "10px 12px", borderRadius: 9, background: "rgba(255,255,255,0.03)", border: `1px solid ${C.border}` }}>
      <span style={{ fontSize: 9.5, fontFamily: MONO, letterSpacing: "0.4px", color: C.celeste, fontWeight: 600, whiteSpace: "nowrap", flexShrink: 0, paddingTop: 1 }}>
        {origen} <span style={{ color: C.textMuted }}>→</span> {destino}
      </span>
      <span style={{ fontSize: 12, color: C.textSub, lineHeight: 1.5 }}>{texto}</span>
    </div>
  );
  return (
    <div data-testid="guia-paso" data-paso="1">
      <div style={_eyebrow}>Quién hace qué</div>
      <div style={_titulo}>Sentrix muestra el dato. ADI lo interpreta.</div>
      {/* POR QUÉ EXISTE SENTRIX · dicho como problema del usuario, no como arquitectura */}
      <div style={_bajada}>
        Un asesor que te da un número y no te lo puede mostrar te está pidiendo fe. Por eso existe Sentrix: es donde
        vive la cuenta de cada cifra que ADI afirma.
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 14 }}>
        {fila("ADI", "SENTRIX", "Cuando ADI nombra una cuenta, Sentrix la pinta en el cuadro.")}
        {fila("SENTRIX", "ADI", "Cuando tocas una fila del cuadro, se la puedes preguntar a ADI.")}
      </div>
      <div style={_pie}>El puente se cruza en los dos sentidos. No hay una pantalla para mirar y otra para preguntar: son la misma.</div>
    </div>
  );
}

// CAPÍTULO 2 · LA HISTORIA. Es el capítulo más valioso de la guía porque entrega el MODELO MENTAL: los tres
// movimientos son la forma de toda respuesta de ADI y también la estructura de cada cara de la Mesa. Quien
// entiende esto deja de leer la pantalla como un tablero y empieza a leerla como un argumento.
function CapComoTeResponde() {
  return (
    <div data-testid="guia-paso" data-paso="2">
      <div style={_eyebrow}>La historia que te cuenta</div>
      <div style={_titulo}>Toda respuesta trae las mismas tres cosas.</div>
      <div style={_bajada}>Siempre en este orden. Las caras de la Mesa están armadas igual, así que la respuesta y la pantalla se leen con el mismo mapa.</div>
      <Lista>
        <Item n="01" titulo="Qué está pasando">
          La cifra y su tamaño. Cuánto, dónde y desde cuándo, sin adornos.
        </Item>
        <Item n="02" titulo="Por qué y dónde">
          Qué parte de tu negocio lo explica. Si tu dato no alcanza para explicarlo, ADI lo dice en vez de inventar
          una causa.
        </Item>
        <Item n="03" titulo="Qué hacer primero">
          Una acción concreta y priorizada. La decisión sigue siendo tuya: ADI la enmarca, no la toma.
        </Item>
      </Lista>
      <div style={_pie}>Si alguna de las tres falta, es porque tu dato no la sostiene — y eso también te lo va a decir.</div>
    </div>
  );
}

// CAPÍTULO 3 · los ejemplos. Clickear uno CIERRA la guía y ejecuta la pregunta: la explicación se convierte en el
// primer turno de la conversación, en vez de quedar como un folleto que hay que recordar.
function CapQuePreguntar({ onEjecutar }) {
  return (
    <div data-testid="guia-paso" data-paso="3">
      <div style={_eyebrow}>Qué puedes preguntar</div>
      <div style={_titulo}>Pregúntale algo de tu negocio.</div>
      <div style={_bajada}>Una por cada cosa que sabe hacer. Todas se responden con tus datos de hoy: toca una y arrancamos.</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 14 }}>
        {GUIA_EJEMPLOS.map((ej, i) => (
          <button key={ej.q} data-testid={`guia-ejemplo-${i}`} onClick={() => onEjecutar(ej.q)}
            style={{ display: "flex", alignItems: "flex-start", gap: 9, width: "100%", padding: "11px 13px", borderRadius: 10, border: "1px solid rgba(47,184,218,0.35)", background: C.card, fontFamily: "'DM Sans', system-ui, sans-serif", textAlign: "left", cursor: "pointer", transition: "background 0.15s, border-color 0.15s" }}
            onMouseEnter={(e) => { e.currentTarget.style.background = C.surfaceHover; e.currentTarget.style.borderColor = "rgba(47,184,218,0.6)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = C.card; e.currentTarget.style.borderColor = "rgba(47,184,218,0.35)"; }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: C.celeste, flexShrink: 0, marginTop: 6 }}/>
            <span style={{ minWidth: 0 }}>
              <span style={{ display: "flex", alignItems: "baseline", gap: 7, minWidth: 0 }}>
                <span style={{ fontFamily: MONO, fontSize: 8.5, letterSpacing: "0.7px", textTransform: "uppercase", color: C.celeste, flexShrink: 0 }}>{ej.tema}</span>
                <span style={{ fontSize: 13, fontWeight: 600, color: C.text, lineHeight: 1.35 }}>{ej.titulo}</span>
              </span>
              <span style={{ display: "block", fontSize: 11.5, color: C.textMuted, lineHeight: 1.45, marginTop: 3 }}>{ej.glosa}</span>
            </span>
          </button>
        ))}
      </div>
      {/* EL DECLINE, CONTADO COMO LO QUE ES: una garantía, no una limitación que se esconde */}
      <div style={_pie}>También puedes escribirle con tus palabras. Si algo no lo puede sostener con tu dato, te lo va a decir en vez de improvisar.</div>
    </div>
  );
}

/* CAPÍTULO 4 · LOS CRUCES. Lo que ningún usuario descubre solo, porque exige saber que los dos mundos están
 * conectados. ⚠️ INVARIANTE 3: acá solo entra lo que el dato SOSTIENE HOY, verificado contra el código.
 *
 * 🔴 ESTE CAPÍTULO YA CAZÓ UN ERROR MÍO, y por eso el tercer punto cuenta un límite en vez de un cruce. La primera
 * versión prometía "abrí la Ficha y vas a ver cuánto capital tenés parado en los productos de ese cliente". Ese
 * cruce EXISTÍA cuando lo escribí y el owner lo RETIRÓ el mismo día (decisión 9): el mix del cliente salía de una
 * matriz de afinidad con todos los pesos mayores que cero, así que el surtido de cada cuenta abarcaba los 13 de 13
 * SKU y la cifra era el inventario global repetido trece veces con nombre de cliente encima.
 * Contarlo como límite no es un consuelo: es la regla 3 funcionando a la vista, y es más creíble que un cruce más. */
function CapQueRelacionar() {
  return (
    <div data-testid="guia-paso" data-paso="4">
      <div style={_eyebrow}>Qué puedes relacionar</div>
      <div style={_titulo}>Lo que más sirve está en el cruce.</div>
      <div style={_bajada}>Lo que vendes y lo que tienes guardado son dos mundos. Estos son los cruces que tu dato sostiene.</div>
      <Lista>
        <Item n="1" titulo="Un producto parado con quién se lo podría llevar">
          En la cara Capital, cada producto inmovilizado muestra qué clientes lo compran y en qué proporción. Sin
          cifras de dinero, y marcado como estimación: es a quién le calza el producto, no una venta registrada.
        </Item>
        <Item n="2" titulo="Una cuenta consigo misma, por cinco lados">
          La Ficha cruza perfil, brecha contra tu benchmark, evolución, composición y posición en la cartera — la
          misma cuenta mirada cinco veces.
        </Item>
        <Item n="3" titulo="Y uno que tu dato no sostiene">
          Cuánto capital tienes parado en los productos de un cliente. Tu inventario no registra qué cuenta compró
          qué unidad, así que ese cruce se retiró en vez de estimarlo. Es la regla 3, funcionando.
        </Item>
      </Lista>
    </div>
  );
}

// CAPÍTULO 5 · la evidencia y CÓMO SE ABRE. Es el cierre honesto del producto: ADI no pide que le crean.
function CapDondeEstaLaEvidencia() {
  return (
    <div data-testid="guia-paso" data-paso="5">
      <div style={_eyebrow}>Dónde está la evidencia</div>
      <div style={_titulo}>Cada cifra cierra con su cuenta.</div>
      <div style={_bajada}>ADI no te pide que le creas. Todo lo que afirma se puede abrir y revisar, por tres puertas.</div>
      <Lista>
        <Item n="1">Debajo de cada respuesta aparece un botón que abre <b style={{ color: C.text, fontWeight: 600 }}>Sentrix</b> con la evidencia de esa respuesta.</Item>
        <Item n="2">En el cuadro, toca una fila y se abre su <b style={{ color: C.text, fontWeight: 600 }}>Ficha</b>: ahí vive el detalle de esa entidad.</Item>
        <Item n="3">El botón <b style={{ color: C.text, fontWeight: 600 }}>Mesa de control</b>, arriba, abre todas tus cifras a la vez.</Item>
      </Lista>
      <div style={_pie}>La Mesa tiene cuatro caras: Comercial, Capital, Resultado y la Ficha de una cuenta.</div>
    </div>
  );
}

// CAPÍTULO 6 · LAS TRES REGLAS, en lengua del usuario (owner 2026-08-10). La versión interna dice
// "proporcionalidad semántica · no afirmar causalidad sin respaldo · nada hardcodeado"; acá se dicen por lo que
// el usuario EXPERIMENTA, porque un cliente no sabe qué es hardcodear pero sí sabe qué es que le escondan un dato.
function CapTresReglas() {
  return (
    <div data-testid="guia-paso" data-paso="6">
      <div style={_eyebrow}>Nuestras tres reglas</div>
      <div style={_titulo}>Preferimos un «no lo sé» a un número que no se sostiene.</div>
      <div style={_bajada}>Son las tres que gobiernan todo lo que ves acá.</div>
      <Lista>
        <Item n="1" titulo="Cada cifra cierra con su cuenta">
          Nada que no puedas abrir y revisar. Si ADI lo afirma, Sentrix lo demuestra.
        </Item>
        <Item n="2" titulo="No te decimos por qué si no lo podemos probar">
          Ubicar dónde pasa algo no es explicar por qué pasa. Cuando la causa no está en tu dato, se dice.
        </Item>
        <Item n="3" titulo="Lo que falta, aparece en pantalla">
          Los límites de tu información se declaran, no se disimulan.
        </Item>
      </Lista>
    </div>
  );
}

const _CAPS = [CapQuienHaceQue, CapComoTeResponde, CapQuePreguntar, CapQueRelacionar, CapDondeEstaLaEvidencia, CapTresReglas];

/**
 * La guía. NO bloquea: sin overlay opaco detrás, la app sigue viva y clickeable.
 *   onEjecutar(q) → manda el PROMPT EXACTO al chat normal (el llamador cierra la guía y lo envía por submit)
 *   onCerrar()              → saltar / cerrar / terminar
 */
export function GuiaInicio({ onEjecutar, onCerrar }) {
  const [paso, setPaso]   = useState(0);
  const [nunca, setNunca] = useState(() => leerGuiaMarca() === GUIA_NUNCA);

  // CERRAR es siempre el mismo hecho, venga del ✕, de "Saltar", de "Empezar", de Escape o de tocar un ejemplo:
  // la guía ya se mostró → no vuelve a abrirse sola. Si el usuario marcó "no volver a mostrar", esa marca es más
  // fuerte y no se pisa.
  const cerrar = () => {
    if (leerGuiaMarca() !== GUIA_NUNCA) marcarGuia(GUIA_VISTA);
    if (onCerrar) onCerrar();
  };

  // Escape cierra · un panel que no se puede sacar de encima con el teclado es un panel que bloquea.
  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") cerrar(); };
    if (typeof window !== "undefined") window.addEventListener("keydown", onKey);
    return () => { if (typeof window !== "undefined") window.removeEventListener("keydown", onKey); };
  }, []);

  const ultimo = paso === GUIA_PASOS - 1;
  const avanzar = () => { if (ultimo) cerrar(); else setPaso((p) => p + 1); };
  const ejecutar = (q) => { cerrar(); if (onEjecutar) onEjecutar(q); };
  const Cap = _CAPS[paso];

  // la casilla persiste EN EL ACTO (ver la nota de los dos valores arriba)
  const toggleNunca = () => {
    const v = !nunca;
    setNunca(v);
    marcarGuia(v ? GUIA_NUNCA : GUIA_VISTA);
  };

  return (
    <aside className="adi-guia" data-testid="guia-inicio" role="dialog" aria-modal="false" aria-label="Guía de inicio">
      <div style={{ padding: "12px 16px 10px", borderBottom: `1px solid ${C.border}` }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8, minWidth: 0 }}>
            <span style={{ fontSize: 12.5, fontWeight: 600, color: C.text, whiteSpace: "nowrap" }}>¿Cómo funciona?</span>
            <span style={{ fontSize: 10, color: C.textMuted, fontFamily: MONO, letterSpacing: "0.5px", flexShrink: 0 }}>{paso + 1} / {GUIA_PASOS}</span>
            {/* el NOMBRE del capítulo vive acá, no dentro de la pastilla: si la pastilla activa se ensancha, corre
                a las demás y el usuario que apunta al 4 termina en el 5. Las pastillas quedan de ancho fijo. */}
            <span style={{ fontSize: 11, color: C.textMuted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>· {GUIA_CAPITULOS[paso]}</span>
          </div>
          <button data-testid="guia-cerrar" onClick={cerrar} aria-label="Cerrar la guía" title="Cerrar la guía"
            style={{ background: "transparent", border: "none", color: C.textMuted, cursor: "pointer", fontSize: 14, lineHeight: 1, padding: 4, flexShrink: 0 }}
            onMouseEnter={(e) => { e.currentTarget.style.color = C.text; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = C.textMuted; }}>✕</button>
        </div>
        {/* EL ÍNDICE · seis capítulos con "Siguiente" nada más serían seis clics para leer un folleto. Cada uno se
            abre directo. Pastillas de ANCHO FIJO: si la activa creciera, movería a las vecinas y el blanco de
            clic dejaría de estar donde el usuario lo vio. El nombre del capítulo va arriba, en el encabezado. */}
        <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 9 }}>
          {GUIA_CAPITULOS.map((t, i) => (
            <button key={t} data-testid={`guia-indice-${i}`} onClick={() => setPaso(i)}
              aria-label={t} aria-current={paso === i ? "step" : undefined} title={t}
              style={{ width: 22, height: 22, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center",
                borderRadius: "50%", border: `1px solid ${paso === i ? "rgba(47,184,218,0.6)" : C.border}`,
                background: paso === i ? "rgba(47,184,218,0.14)" : "transparent",
                color: paso === i ? C.celeste : C.textMuted, cursor: "pointer",
                fontFamily: MONO, fontSize: 9.5, fontWeight: 700, padding: 0, transition: "background 0.15s, border-color 0.15s, color 0.15s" }}
              onMouseEnter={(e) => { if (paso !== i) { e.currentTarget.style.color = C.textSub; e.currentTarget.style.borderColor = C.borderLight; } }}
              onMouseLeave={(e) => { if (paso !== i) { e.currentTarget.style.color = C.textMuted; e.currentTarget.style.borderColor = C.border; } }}>
              {i + 1}
            </button>
          ))}
        </div>
      </div>

      <div className="adi-guia-cuerpo" style={{ padding: "16px", overflowY: "auto", minHeight: 0 }}>
        <Cap onEjecutar={ejecutar}/>
      </div>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "11px 16px", borderTop: `1px solid ${C.border}`, flexWrap: "wrap" }}>
        <label style={{ display: "flex", alignItems: "center", gap: 7, cursor: "pointer", userSelect: "none" }}>
          <input type="checkbox" data-testid="guia-nunca" checked={nunca} onChange={toggleNunca}
            style={{ width: 13, height: 13, accentColor: C.celeste, cursor: "pointer", margin: 0 }}/>
          <span style={{ fontSize: 11, color: C.textMuted }}>No volver a mostrar</span>
        </label>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
          {/* SALTAR en TODOS los capítulos (owner: "un panel que se puede saltar en cualquier paso") */}
          <button data-testid="guia-saltar" onClick={cerrar}
            style={{ background: "transparent", border: "none", color: C.textMuted, fontFamily: "'DM Sans', system-ui, sans-serif", fontSize: 12, cursor: "pointer", padding: "7px 9px" }}
            onMouseEnter={(e) => { e.currentTarget.style.color = C.textSub; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = C.textMuted; }}>Saltar</button>
          <button data-testid="guia-siguiente" onClick={avanzar}
            style={{ border: "none", borderRadius: 9, padding: "7px 15px", background: C.celeste, color: "#ffffff", fontFamily: "'DM Sans', system-ui, sans-serif", fontSize: 12, fontWeight: 600, cursor: "pointer", transition: "background 0.15s", whiteSpace: "nowrap" }}
            onMouseEnter={(e) => { e.currentTarget.style.background = "#28a9c9"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = C.celeste; }}>{ultimo ? "Empezar" : "Siguiente"}</button>
        </div>
      </div>

      <style>{`
        .adi-guia {
          position: fixed; right: 24px; bottom: 24px; z-index: 70;
          width: 438px; max-height: 80vh;
          display: flex; flex-direction: column;
          background: ${C.surface}; border: 1px solid rgba(47,184,218,0.4); border-radius: 14px;
          box-shadow: 0 18px 48px -12px rgba(0,0,0,0.75), 0 0 0 1px rgba(0,0,0,0.35);
          font-family: 'DM Sans', system-ui, sans-serif;
          animation: adiGuiaEntra 0.22s ease-out;
        }
        @keyframes adiGuiaEntra { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        /* MÓVIL · hoja inferior a ancho completo (una tarjeta de 438px no entra en un viewport de 375) */
        @media (max-width: 760px) {
          .adi-guia { right: 10px; left: 10px; bottom: 10px; width: auto; max-height: 82vh; }
        }
        @media (prefers-reduced-motion: reduce) { .adi-guia { animation: none; } }
      `}</style>
    </aside>
  );
}

export default GuiaInicio;
