/* === _densidad_ejecutiva_gate.mjs · LA FORMA TAMBIÉN ES DEL PROCEDIMIENTO (owner 2026-09-11) ═════════════════
 *
 * SU MANDATO, textual, tras ver la segunda corrida en vivo de su batería: «Quiero cerrar esto como experiencia
 * premium, no solamente como respuesta correcta.» Y su regla: «densidad ejecutiva, no brevedad por brevedad»,
 * con criterio CONTEXTUAL —
 *   · si el usuario no pidió detalle, evitar subtítulos, bloques largos y listas extensas;
 *   · una respuesta ejecutiva prioriza tesis → evidencia mínima → criterio/siguiente paso;
 *   · listas solo cuando realmente ordenen información o el usuario las pida;
 *   · negrita para una conclusión puntual, no un informe lleno de encabezados;
 *   · si el narrador incumple, una oportunidad de reescribir; si vuelve a incumplir, el procedimiento
 *     determinístico que ya funciona bien.
 * Y tres casos explícitos de calibración: «¿Cómo va?» no se convierte normalmente en 380 palabras; «¿Por qué?»
 * no necesita ~520 salvo que pidan detalle; «¿Qué harías primero?» responde la prioridad y su razón, no
 * despliega 8 clientes si nadie los pidió. «No quiero imponer un número rígido de palabras si eso deteriora la
 * calidad.» Por eso este gate mide FORMA (encabezados · ítems · paredes de texto), no palabras.
 *
 * LO QUE SE PRUEBA:
 *   1 · las tres pantallas de su batería ARDEN con `formato-de-informe`, cada una por su motivo real;
 *   2 · el corpus determinístico (los pisos) pasa el mismo juez LIMPIO: el procedimiento ya habla así;
 *   3 · el criterio contextual: con detalle o lista pedidos, la misma forma pasa; una conclusión en negrita pasa;
 *   4 · la mecánica: una oportunidad de reescribir → si insiste, responde el procedimiento (medido de punta a punta);
 *   5 · la prevención: el entregable es de la RUTA y la doctrina lleva la forma del turno;
 *   6 · cableado y carnadas: sin el juez, la pantalla del owner vuelve a salir.
 *
 * OFFLINE · determinístico · CERO llamadas.
 * `node --import ./scripts/offline-guard.mjs _densidad_ejecutiva_gate.mjs` */
import { readFileSync } from "node:fs";
import { initTenant } from "./src/data/tenantStore.js";
import { TENANT_DEMO } from "./src/data/tenants/demo.js";
import { answerViaAgente } from "./src/adi/agente/bucleAgente.js";
import { vetosDeFormato, vetosDeContrato, pideDetalle, pideLista, TOPE_ITEMS_SIN_PEDIR, TOPE_PALABRAS_BLOQUE } from "./src/adi/agente/contratoAgente.js";
import { doctrinaDelPlaybook, formaDelTurno, entregableDe } from "./src/adi/agente/playbooks/registro.js";
import { margenEnRiesgo } from "./src/adi/agente/playbooks/margenEnRiesgo.js";
import { resumenDelNegocio } from "./src/adi/agente/playbooks/resumenDelNegocio.js";
import { ESCENARIO_INICIAL } from "./src/config/scenarios.js";

let pass = 0, fail = 0;
const ok = (cond, label, detalle) => {
  if (cond) { pass++; console.log(`  ✓ ${label}`); }
  else { fail++; console.log(`  ✗ ${label}`); if (detalle !== undefined) console.log(`      ${String(detalle).slice(0, 360)}`); }
};
const H = (t) => console.log(`\n${t}`);
const ESC = ESCENARIO_INICIAL;
const MUDO = async () => ({ tipo: "texto", texto: "" });
const palabras = (t) => String(t).trim().split(/\s+/).length;
const reglas = (t, q) => vetosDeFormato(t, { pregunta: q }).map((v) => v.regla);
const motivo = (t, q) => (vetosDeFormato(t, { pregunta: q })[0] || { multa: "" }).multa;
initTenant(TENANT_DEMO);

/* LAS PANTALLAS DE LA BATERÍA EN VIVO (2026-09-11, corrida 2) — verbatim: son la carnada de este gate */
const PANTALLAS = {
  T1: `El negocio crece, pero deja caja sobre la mesa: venta +7.5% versus el año anterior, margen en 25.1% contra un benchmark de 30.1% — 5 puntos de brecha que representan $4.9M de contribución no capturada en el año.

**Quién sostiene y quién presiona (no es lista, es papel):**
- **Erosión por acciones comerciales (6 cuentas, 73.8% de la venta):** Falabella, Lider, Jumbo, Sodimac, Paris y uno más. Margen bajo el benchmark Y carga comercial por encima del 3.5% de referencia al mismo tiempo. Falabella lidera con $1.6M de contribución no capturada y carga de 4.5%; Lider le sigue con $1.5M y 4.2% de carga.
- **Margen delgado sin volumen ni carga (2 cuentas, 12.3%):** Tottus y Mercado Libre. Ni la carga ni el volumen lo explican — el precio de lista o el mix pesan más aquí.
- **Sanos, sobre el benchmark (5 cuentas, 13.8%):** Easy, La Polar, Hites, ABC y Unimarc — no son el problema; si cargan alto, lo sostienen con mejor costo.

**Por qué pasa (patrón medido, no causa probada):** en Falabella, Lider, Jumbo y Sodimac hay dos huellas presentes a la vez:
- Carga comercial sobre el nivel de referencia — **probado**: los 4 pagan más carga que el 3.5% declarado.
- Precio de lista pegado al costo — **indicado**: su markup (37-40%) es más bajo que el de los sanos (que rondan 42-45%).

La huella de "volumen a margen bajo deliberado" está **abierta**: ningún cliente del tramo alto cae sin exceder también la carga — o sea, en los datos, carga y volumen viajan juntos, no se pueden separar todavía. La regla que lo resolvería: si esta combinación de carga alta + markup bajo se repite igual en toda la cartera, es política comercial general; si varía cliente por cliente, es negociación caso a caso — y ahí el terreno de acción es distinto.

Hay una pregunta que ningún dato resuelve: ¿el volumen de Falabella y Jumbo a ese margen es una apuesta tuya de rotación y liquidez, o se te fue de las manos? De la respuesta depende si es estrategia o fuga.

**Qué haría primero:** partiría por Falabella — no porque tenga la peor brecha de margen (esa es de Lider, con 8.6 pp contra el benchmark, la mayor de la cartera), sino porque concentra el mayor monto absoluto ($1.6M de contribución no capturada) y la mayor carga comercial ($194K). Ahí, revisar qué parte de esa carga de 4.5% es negociable antes de tocar precio — es la acción más rápida y más grande en dinero real.`,
  T2: `La brecha no es un problema difuso: son 5 puntos de margen (25.1% contra el benchmark de 30.1%) concentrados en 6 cuentas, y en 4 de ellas hay dos señales que se mueven juntas.

**Lo que se movió, con cifras:**
- **Falabella, Lider, Jumbo y Sodimac** están bajo el benchmark Y con carga comercial por encima del 3.5% de referencia al mismo tiempo — esta huella está **probada**: los 4 la tienen presente.
  - Falabella: margen 22.0% (brecha 8.1 pp), carga 4.5%, contribución no capturada $1.6M
  - Lider: margen 21.5% (brecha 8.6 pp, la mayor de la cartera), carga 4.2%, $1.5M
  - Jumbo: margen 24.0% (brecha 6.1 pp), carga 3.8%, $1.1M
  - Sodimac: margen 23.5% (brecha 6.6 pp), carga 5.4% (la más alta), $540K
- La misma gente que cae en margen (86.1% de su venta) es la que excede la carga. Esto **no distingue** todavía si la carga arrastra el margen o si viajan juntas por otra razón — la concurrencia es un patrón, no una prueba de dirección causal.

**El segundo camino, más débil pero presente:** en esos mismos 4 clientes, el markup (precio de lista sobre costo) es más bajo que en los sanos — Falabella 39.1%, Lider 37.2%, Jumbo 38.3%, Sodimac 40.6%, contra Easy o La Polar que sostienen el margen con mejor costo. Esta huella —precio pegado al costo— está **indicada**, no probada: el markup bajo coincide con la carga alta, pero no puedo separar cuánto pesa cada uno por separado con lo que tengo.

**Lo que el dato NO puede decirte:** si el volumen que le vendes a Falabella y Jumbo a ese margen es una apuesta tuya de rotación y liquidez, o si la negociación se te fue de las manos. Esa es la pregunta que solo tú respondes, porque ningún número mide intención, y la causa de fondo —por qué esas 4 cuentas concentran carga y markup bajo a la vez— no está probada en el dato: solo localizada.

**La regla que lo cierra:** si esta combinación de carga alta + markup bajo se repite igual en Falabella, Lider, Jumbo y Sodimac con la misma intensidad, es política comercial general tuya con estas cuentas. Si varía cliente por cliente —unos por rebate pactado, otros por negociación puntual— es caso a caso, y ahí conviene revisar cuenta por cuenta, no la política completa.

**Lo que puedo hacer ahora mismo, si quieres:** separar en Falabella cuánto de su brecha de 8.1 pp viene de la carga comercial (los $194K que ya localicé) versus cuánto del markup — con una lectura de causa de precio para esa cuenta puntual. Eso te dice si mover primero la carga o el precio de lista.

¿Sabes si Falabella y Jumbo tienen un rebate pactado por volumen, o esa carga se negoció suelta?

(Lo tendré en cuenta en las próximas lecturas.)`,
  T6: `Falabella, con $1.6M de contribución no capturada.

No es la peor brecha porcentual — esa es Lider, con 8.6 puntos bajo el benchmark (margen 21.5% contra 30.1%) — pero Falabella combina tres cosas a la vez: el monto absoluto más grande en juego (la contribución no capturada del conjunto de clientes bajo benchmark suma $4.9M, y Falabella es la mayor parte individual con $1.6M), la carga comercial más alta en dinero ($194K, la mayor de las 6 cuentas con exceso de carga) y una venta de $19.4M que hace que cada punto de margen recuperado ahí valga más que en cualquier otra cuenta.

Contexto rápido de dónde está parada la cartera — 8 clientes bajo el benchmark de 30.1%:

- Lider — margen 21.5%, venta $17.8M, brecha 8.6 pp
- Falabella — margen 22.0%, venta $19.4M, brecha 8.1 pp
- Sodimac — margen 23.5%, venta $8.2M, brecha 6.6 pp
- Jumbo — margen 24.0%, venta $17.3M, brecha 6.1 pp
- Ripley — margen 25.0%, venta $4.7M, brecha 5.1 pp
- Paris — margen 26.5%, venta $6.3M, brecha 3.6 pp
- Tottus — margen 28.0%, venta $6.8M, brecha 2.1 pp
- Mercado Libre — margen 29.0%, venta $5.5M, brecha 1.1 pp

Priorizar por monto absoluto y empezar por Falabella es criterio mío, no un orden que el dato imponga — el dato solo mide magnitudes, no decide por dónde entrar. Si prefieres priorizar por brecha porcentual pura, Lider es la conversación pendiente.`,
  T3: `Falabella, Lider, Jumbo y Sodimac cargan comercial por encima del 3.5% de referencia y a la vez tienen markup más bajo que los sanos — las dos señales viajan juntas, pero no puedo probar cuál arrastra a cuál.

Falabella concentra la mayor recuperación potencial en dinero ($1.6M); Lider tiene la peor brecha porcentual (8.6 pp). Yo partiría por Falabella.

Falta un dato tuyo para cerrarlo: si esa carga es rebate pactado o negociación suelta.`,
  T4: `Para el equipo: 4 cuentas están cargando más de la cuenta comercial de lo que deberían.

- **Falabella** — carga 4.5% contra 3.5% de referencia. Ahí hay $194K. Prioridad #1: es donde más caja se recupera.
- **Lider** — la brecha de margen más grande dentro de este grupo de 4 (8.6 puntos bajo el benchmark de 30.1%). Carga 4.2%.
- **Jumbo** y **Sodimac** — mismo patrón, menor monto.

Lo que conviene validar en terreno, cuenta por cuenta: si esa carga se pactó a cambio de volumen (rebate acordado) o si se fue negociando suelta sin ese respaldo. La respuesta cambia si se ataca la condición comercial o el precio de lista.

Arranquen por Falabella.`,
};

/* ═══ 1 · LAS TRES PANTALLAS DEL OWNER ARDEN, cada una por su motivo ═══════════════════════════════════════ */
H("1 · las tres pantallas de la batería en vivo arden con «formato-de-informe», cada una por su motivo real");
{
  ok(reglas(PANTALLAS.T1, "¿Cómo va el negocio?").includes("formato-de-informe") && /\d subtítulos/.test(motivo(PANTALLAS.T1, "¿Cómo va el negocio?")),
    `★★ «¿Cómo va?» en ${palabras(PANTALLAS.T1)} palabras con subtítulos en negrita ARDE por los subtítulos`, motivo(PANTALLAS.T1, "¿Cómo va el negocio?"));
  ok(reglas(PANTALLAS.T2, "¿Por qué está pasando?").includes("formato-de-informe") && /subtítulos/.test(motivo(PANTALLAS.T2, "¿Por qué está pasando?")) && /lista de \d+ ítems/.test(motivo(PANTALLAS.T2, "¿Por qué está pasando?")),
    `★★ el porqué en ${palabras(PANTALLAS.T2)} palabras ARDE por los subtítulos y la lista anidada que nadie pidió`, motivo(PANTALLAS.T2, "¿Por qué está pasando?"));
  ok(reglas(PANTALLAS.T6, "¿Qué harías primero?").includes("formato-de-informe") && /lista de 8 ítems que nadie pidió/.test(motivo(PANTALLAS.T6, "¿Qué harías primero?")),
    "★★ «¿qué harías primero?» ARDE por volcar los 8 clientes que nadie pidió", motivo(PANTALLAS.T6, "¿Qué harías primero?"));
  ok(!/\bpalabras\b/.test(motivo(PANTALLAS.T1, "¿Cómo va el negocio?")) && !/\bpalabras\b/.test(motivo(PANTALLAS.T6, "¿Qué harías primero?")),
    "…y ninguna de las tres arde por un número de palabras: se cobra la forma, no el largo (condición del owner)");
  ok(/tesis en una frase/.test(motivo(PANTALLAS.T1, "¿Cómo va el negocio?")) && /evidencia mínima/.test(motivo(PANTALLAS.T1, "¿Cómo va el negocio?")) && /criterio o siguiente paso/.test(motivo(PANTALLAS.T1, "¿Cómo va el negocio?")) && /Mismas cifras, misma conclusión/.test(motivo(PANTALLAS.T1, "¿Cómo va el negocio?")),
    "…y la multa le da al cerebro la forma que sí sirve (tesis → evidencia mínima → criterio) sin tocar cifras ni conclusión");
  /* los dos turnos vivos que ya estaban bien pasan limpios: el juez no muerde prosa buena */
  ok(reglas(PANTALLAS.T3, "Dámelo más corto.").length === 0, "«dámelo más corto» en vivo (74 palabras, prosa) pasa limpio");
  ok(reglas(PANTALLAS.T4, "Explícamelo para el equipo comercial.").length === 0, "«para el equipo comercial» en vivo (3 viñetas, negrita en los nombres) pasa limpio: la negrita de énfasis no es encabezado");
}

/* ═══ 2 · EL CORPUS DETERMINÍSTICO PASA EL MISMO JUEZ: el procedimiento ya habla con densidad ejecutiva ════ */
H("2 · los pisos, juzgados como si fueran el cerebro, pasan limpios — el procedimiento es la referencia de forma");
{
  let h = [], mem = {};
  const paso = async (q, encadena = true) => {
    const r = await answerViaAgente({ text: q, history: h, mem, scenario: ESC, callAgente: MUDO });
    const t = String(r.r.text || "");
    if (encadena) { h = [...h, { role: "user", text: q }, { role: "assistant", text: t }]; mem = r.mem || mem; }
    return { q, t, a: r.r.agente };
  };
  const B = [];
  for (const q of ["¿Cómo va el negocio?", "¿Por qué está pasando?", "Dámelo más corto.", "Explícamelo para el equipo comercial.", "Ahora para directorio.", "¿Qué harías primero?", "¿Qué parte de eso puedes demostrar y qué parte no?"]) B.push(await paso(q));
  for (const q of ["¿Qué clientes explican más eso?", "dame los 3 riesgos para el directorio", "qué hago esta semana", "¿qué es más urgente, margen o cobranza?", "¿por qué estamos perdiendo margen?", "dame la ficha de Lider", "¿quién me debe?", "¿cómo viene la venta por canal?"]) B.push(await paso(q, false));
  for (const x of B) ok(reglas(x.t, x.q).length === 0, `«${x.q}» (${x.a.estado}, ${palabras(x.t)} palabras) pasa limpio`, motivo(x.t, x.q));
  /* los tres casos de calibración del owner, medidos en el piso: la vara que el cerebro tiene que igualar */
  const [foto, porque, , , , primero] = B;
  ok(palabras(foto.t) <= 130, `★ «¿Cómo va?» del procedimiento: ${palabras(foto.t)} palabras (la pantalla en vivo tenía ${palabras(PANTALLAS.T1)})`);
  ok(palabras(primero.t) <= 110 && !/^\s*[-·•]/m.test(primero.t), `★ «¿qué harías primero?» del procedimiento: ${palabras(primero.t)} palabras, la prioridad y su razón, sin lista (la pantalla en vivo tenía ${palabras(PANTALLAS.T6)} con 8 clientes)`);
  ok(palabras(porque.t) < palabras(PANTALLAS.T2) && !/\*\*/.test(porque.t), `★ el porqué del procedimiento: ${palabras(porque.t)} palabras sin negritas (en vivo ${palabras(PANTALLAS.T2)} con cinco subtítulos) — no se recorta a la fuerza: se mide`);
}

/* ═══ 3 · EL CRITERIO CONTEXTUAL ══════════════════════════════════════════════════════════════════════════ */
H("3 · contextual: el detalle pedido abre la estructura; la lista pedida admite la lista; la conclusión en negrita pasa");
{
  ok(pideDetalle("dame el detalle del porqué") && pideDetalle("desglósamelo cuenta por cuenta") && pideDetalle("explícamelo para el analista") && !pideDetalle("¿Por qué está pasando?") && !pideDetalle("¿Cómo va el negocio?"),
    "el detector de detalle reconoce «detalle», «desglosa», «cuenta por cuenta», «para el analista» — y no las preguntas de la batería");
  ok(pideLista("¿cuáles son los clientes bajo el benchmark?") && pideLista("¿quién me debe?") && pideLista("dame los 3 riesgos") && pideLista("el ranking por venta") && !pideLista("¿Qué harías primero?") && !pideLista("¿Por qué está pasando?"),
    "el detector de lista reconoce «cuáles», «quién», «los 3», «ranking» — y no «¿qué harías primero?»");
  ok(reglas(PANTALLAS.T2, "dame el detalle de por qué está pasando").length === 0, "★ el MISMO porqué de 5 subtítulos pasa cuando pidieron detalle: los subtítulos son suyos");
  ok(reglas(PANTALLAS.T6, "¿cuáles son los 8 clientes bajo el benchmark y por cuál entrarías?").length === 0, "★ la MISMA lista de 8 pasa cuando pidieron la lista");
  /* el resumen de directorio con 3 riesgos y 3 acciones (examen 4, aceptado): dos secciones tituladas ordenan lo que pidieron */
  const DIRECTORIO = ["**Riesgos — resumen ejecutivo**", "", "1. **Margen bajo el benchmark.** La cartera cierra en 25.1%, 5.0pp bajo el 30.1% declarado.", "2. **Capital inmovilizado.** $56K no está activo; $33K en 3 SKU están frenados.", "3. **Carga comercial sobre el objetivo.** Sodimac opera al 5.4% ($442K).", "", "**Acciones que ofrecería**", "", "1. Revisar precio o costo en LG-DRYER8KG.", "2. Liquidar MAK-COMP-AIR.", "3. Revisar la condición de Sodimac."].join("\n");
  ok(reglas(DIRECTORIO, "Dame un resumen para directorio con los 3 riesgos principales y las 3 acciones").length === 0,
    "…y el resumen de 3 riesgos + 3 acciones con dos secciones tituladas pasa: la estructura ordena lo que pidieron");
  ok(reglas(DIRECTORIO, "¿Cómo va el negocio?").includes("formato-de-informe"), "★ …pero esa MISMA forma ante «¿cómo va?» arde: nadie pidió un informe");
  ok(reglas("**El negocio crece, pero deja menos margen del que debería.** La venta viene +7.5% y el margen queda en 25.1% contra 30.1%. Yo entraría por Falabella: ahí coinciden el volumen y la carga excedida.", "¿Cómo va el negocio?").length === 0,
    "una conclusión puntual en negrita pasa: la regla no persigue la negrita, persigue el informe");
  ok(reglas("El margen cede.\n- Falabella: 22.0%\n- Lider: 21.5%\n- Jumbo: 24.0%\nYo entraría por Falabella.", "¿Por qué está pasando?").length === 0, "una lista corta (3 ítems) pasa aunque nadie la pidiera: ordena información");
  const PARED = "El negocio " + "crece pero deja menos margen del que debería y eso se ve en la venta que viene arriba mientras el margen queda abajo del benchmark declarado con una contribución no capturada que se concentra en las cuentas grandes ".repeat(4) + "y por eso entraría por Falabella.";
  ok(reglas(PARED, "¿Cómo va el negocio?").includes("formato-de-informe") && /bloque de \d+ palabras/.test(motivo(PARED, "¿Cómo va el negocio?")), `una pared de más de ${TOPE_PALABRAS_BLOQUE} palabras en un solo párrafo arde como bloque largo`);
  ok(TOPE_ITEMS_SIN_PEDIR === 5, "el tope de ítems sin pedir es 5: cinco viñetas ordenan, ocho clientes son un informe");
}

/* ═══ 4 · LA MECÁNICA · una oportunidad de reescribir; si insiste, el procedimiento ══════════════════════ */
H("4 · ★★ de punta a punta: el cerebro entrega el informe, se le pide reescribir UNA vez, y si insiste responde el procedimiento");
{
  let llamadas = 0, segunda = null;
  const insiste = async ({ mensajes }) => { llamadas++; if (llamadas === 2) segunda = mensajes; return { tipo: "texto", texto: PANTALLAS.T1 }; };
  const r = await answerViaAgente({ text: "¿Cómo va el negocio?", history: [], mem: {}, scenario: ESC, callAgente: insiste });
  const t = String(r.r.text || "");
  ok(llamadas === 2, `dos llamadas al cerebro: el cierre y UNA reparación (${llamadas})`);
  ok(r.r.agente.estado === "playbook", `★★ el cerebro insistió con el informe → responde el procedimiento (${r.r.agente.estado})`);
  ok(!/\*\*/.test(t) && palabras(t) <= 130 && /entrar[ií]a por/i.test(t), `…y lo que ve el dueño es la foto ejecutiva: ${palabras(t)} palabras, sin negritas, con el criterio`, t.slice(0, 120));
  ok((r.r.agente.vetos || []).some((v) => /formato-de-informe/.test(String(v))), "…y el expediente registra el veto de formato en el cierre y en la reparación", (r.r.agente.vetos || []).join(" | ").slice(0, 200));
  const ultimo = segunda && segunda.length ? String(segunda[segunda.length - 1].content || "") : "";
  ok(/forma de informe/.test(ultimo) && /tesis en una frase/.test(ultimo), "…y la reparación le llevó la multa con la forma que sirve (tesis → evidencia → criterio)", ultimo.slice(0, 200));
  /* el cerebro que SÍ corrige al primer aviso: se acepta como reparado — la oportunidad es real */
  let k = 0;
  const corrige = async () => { k++; return { tipo: "texto", texto: k === 1 ? PANTALLAS.T1 : "El negocio crece, pero deja menos margen del que debería: la venta viene +7.5% contra el año anterior y el margen queda en 25.1% contra un benchmark de 30.1%, con $4.9M de contribución no capturada. Si fuera mi decisión —criterio mío—, entraría por Falabella: ahí coinciden el volumen y la carga excedida. Cuando digas, la abro." }; };
  const r2 = await answerViaAgente({ text: "¿Cómo va el negocio?", history: [], mem: {}, scenario: ESC, callAgente: corrige });
  ok(r2.r.agente.estado === "reparado" && /entraría por Falabella/.test(String(r2.r.text || "")), `★ el cerebro que reescribe bien al primer aviso queda como reparado (${r2.r.agente.estado}) — la oportunidad es real`);
  /* con detalle pedido, el mismo informe NO se veta: el cerebro entrega y el turno sale por él */
  let k3 = 0;
  const conDetalle = async () => { k3++; return { tipo: "texto", texto: PANTALLAS.T2 }; };
  const r3 = await answerViaAgente({ text: "dame el detalle de por qué está pasando", history: [], mem: {}, scenario: ESC, callAgente: conDetalle });
  ok(!(r3.r.agente.vetos || []).some((v) => /formato-de-informe/.test(String(v))), `…y con detalle pedido el mismo porqué de cinco subtítulos no recibe el veto de formato (${r3.r.agente.estado})`);
}

/* ═══ 5 · LA PREVENCIÓN · el entregable es de la RUTA y la doctrina lleva la forma ═══════════════════════ */
H("5 · prevención: el entregable es de la ruta, y la forma del turno viaja con el procedimiento");
{
  const ePrimero = entregableDe(margenEnRiesgo, "¿Qué harías primero?");
  const ePorque = entregableDe(margenEnRiesgo, "¿Por qué está pasando?");
  const eSello = entregableDe(margenEnRiesgo, "¿Qué parte de eso puedes demostrar y qué parte no?");
  const eEstandar = entregableDe(margenEnRiesgo, "¿qué clientes están bajo el benchmark?");
  ok(/una sola cuenta/.test(ePrimero) && /Sin recorrer la cartera/.test(ePrimero), "★ «¿qué harías primero?» pide UNA cuenta y su razón — sin recorrer la cartera (antes recibía «total y por cliente» y obedecía)");
  ok(/en prosa/.test(ePorque) && /dos o tres que más pesan/.test(ePorque) && /se abre cuando la pidan/.test(ePorque), "★ el porqué pide prosa, los dos o tres que más pesan, y la cartera solo si la piden");
  ok(/medida/.test(eSello) && /queda abierta/.test(eSello) && /Sin volver a contar/.test(eSello), "el sello pide medido / patrón / abierto sin recontar la lectura");
  ok(/total y por cliente/.test(eEstandar), "…y la lectura estándar conserva su entregable completo: la lista es lo que esa pregunta pide");
  ok(new Set([ePrimero, ePorque, eSello, eEstandar]).size === 4, "cuatro rutas, cuatro entregables distintos");
  ok(/lectura corta/.test(resumenDelNegocio.entregable) && /se ofrecen, no se despliegan/.test(resumenDelNegocio.entregable), "★ la foto pide una lectura corta: el porqué y el detalle se ofrecen, no se despliegan");
  const doc = doctrinaDelPlaybook(margenEnRiesgo, "¿Qué harías primero?");
  ok(/FORMA \(densidad ejecutiva\)/.test(doc) && /Sin subtítulos/.test(doc) && /una lista solo si ordena información o la pidieron/.test(doc), "la doctrina del playbook lleva la FORMA del turno con las reglas del owner");
  ok(doc === doctrinaDelPlaybook(margenEnRiesgo, "¿Qué harías primero?"), "…byte-estable para la misma pregunta");
  ok(/SÍ pide detalle/.test(formaDelTurno("dame el detalle del porqué")) && !/SÍ pide detalle/.test(formaDelTurno("¿Por qué está pasando?")), "…y contextual: con detalle pedido, la forma dice que lo abra");
}

/* ═══ 6 · CABLEADO Y CARNADAS ═══════════════════════════════════════════════════════════════════════════ */
H("6 · cableado: la forma se juzga al cerebro y no a los peldaños; sin el juez, la pantalla del owner vuelve");
{
  const bucle = readFileSync(new URL("./src/adi/agente/bucleAgente.js", import.meta.url), "utf8");
  const contrato = readFileSync(new URL("./src/adi/agente/contratoAgente.js", import.meta.url), "utf8");
  ok(/limiteDeHerramienta: motivosNoSoportado\.length > 0, sitio \}/.test(bucle), "el bucle pasa el sitio al contrato");
  ok(/if \(contexto\.sitio === "cierre" \|\| contexto\.sitio === "reparacion" \|\| contexto\.sitio === "poda"\) v\.push\(\.\.\.vetosDeFormato\(texto, contexto\)\);/.test(contrato), "el contrato cobra la forma SOLO en cierre, reparación y poda");
  ok(vetosDeContrato(PANTALLAS.T1, { pregunta: "¿Cómo va el negocio?", sitio: "cierre" }).some((v) => v.regla === "formato-de-informe"), "★ juzgado como cierre, el informe arde en el contrato");
  ok(!vetosDeContrato(PANTALLAS.T1, { pregunta: "¿Cómo va el negocio?", sitio: "playbook:resumen-del-negocio" }).some((v) => v.regla === "formato-de-informe") && !vetosDeContrato(PANTALLAS.T1, { pregunta: "¿Cómo va el negocio?" }).some((v) => v.regla === "formato-de-informe"),
    "…y como peldaño (o sin sitio) no: se juzga al cerebro, no a los peldaños");
  ok(/formaDelTurno\(pregunta\),/.test(readFileSync(new URL("./src/adi/agente/playbooks/registro.js", import.meta.url), "utf8")), "la doctrina del playbook incluye la forma del turno");
  /* carnada: el juez vaciado — la pantalla del owner pasa el contrato entero como cierre */
  const mutado = contrato.replace(/export function vetosDeFormato\(texto, \{ pregunta = "" \} = \{\}\) \{/, 'export function vetosDeFormato(texto, { pregunta = "" } = {}) { if (texto) return [];');
  ok(mutado !== contrato, "la carnada encontró el juez para vaciarlo");
  const { writeFileSync, unlinkSync } = await import("node:fs");
  const tmp = new URL("./src/adi/agente/_contratoAgente_carnada_formato.js", import.meta.url);
  writeFileSync(tmp, mutado);
  try {
    const Mut = await import(tmp.href + `?t=${Math.random()}`);
    ok(!Mut.vetosDeContrato(PANTALLAS.T1, { pregunta: "¿Cómo va el negocio?", sitio: "cierre" }).some((v) => v.regla === "formato-de-informe"),
      "★ carnada «juez de formato vaciado» → la pantalla de 424 palabras con subtítulos pasaría: el chequeo ★ de arriba daría ✗ — el candado mira");
  } finally { try { unlinkSync(tmp); } catch { /* ya no está */ } }
}

console.log(`\n── _densidad_ejecutiva_gate: ${pass} PASS · ${fail} FAIL (de ${pass + fail}) ──`);
process.exit(fail ? 1 : 0);
