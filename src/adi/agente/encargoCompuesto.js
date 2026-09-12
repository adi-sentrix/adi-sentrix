/* === src/adi/agente/encargoCompuesto.js · EL ENSAMBLADOR DEL ENCARGO COMPUESTO (owner 2026-09-11) =============
 *
 * EL REQUISITO DE PRODUCTO, textual: «Cuando el usuario realiza un encargo compuesto y ADI ya entendió sus partes
 * y reunió evidencia suficiente, un fallo del narrador no puede hacer que desaparezcan partes explícitamente
 * solicitadas. La respuesta de respaldo puede ser menos elegante, pero debe conservar la cobertura del encargo.»
 * Medido en su batería: el ejecutivo pidió 6 cosas y recibió 3; el causal 5 y ~3,5; el natural 5 y 0.
 *
 * LO QUE ES: un peldaño DETERMINÍSTICO de la escalera, solo para encargos compuestos, que compone con lo que ya
 * existe —los procedimientos, sus pasos, sus composers, la evidencia ya leída, el reformulador por audiencia,
 * el muro y la escalera—. No es un cerebro, no tiene memoria, no toca ningún composer ni el muro.
 *
 * CÓMO:
 *   1 · `partesDelEncargo(q)` reconoce las partes PEDIDAS con un léxico cerrado (jamás comprensión) y las ordena
 *       en el orden lógico de la casa: qué pasa → si es cierto → por qué → quiénes → qué está demostrado → qué
 *       haría primero. Solo lo pedido; y el ensamblador se activa únicamente con DOS o más partes (condición del
 *       owner: una pregunta normal no se convierte en encargo compuesto).
 *   2 · los pasos del turno son la UNIÓN de los pasos del procedimiento activo y de cada parte (el bucle los corre
 *       ANTES del cerebro, como siempre): el modelo recibe toda la evidencia, y el piso no sale a leer.
 *   3 · cada parte se compone con SU propia boleta (los resultados de sus pasos, ya ejecutados): cada composer
 *       espera la boleta que sus pasos producen — con la boleta unida, «quiénes» devuelve vacío (medido).
 *   4 · una sola tesis y un solo criterio: el criterio lo pone la prioridad si está pedida (y se quita de las
 *       demás partes); si no, queda el primero que aparezca. Una cifra una vez: una línea cuyas cifras en dinero
 *       o porcentaje ya fueron citadas se omite (la cabecera de «quiénes» repite la de la foto: se va) — salvo
 *       en la parte «primero», la conclusión, donde la segunda aparición cambia de función (es la razón de la
 *       prioridad). Las líneas sin cifras fuertes —tesis, mecanismos, preguntas al dueño— siempre se conservan.
 *   5 · la parte que no se puede armar con la evidencia se declara en UNA línea; jamás se inventa.
 *   6 · si el encargo nombra un lector al final, cierra con la versión para ese lector: el MISMO piso de
 *       reformular, aplicado a la lectura compuesta.
 * El texto ensamblado se juzga como cualquier peldaño (muro + contrato + notarial del procedimiento activo) y,
 * si no pasa, cede al piso simple de hoy. */
import { resumenDelNegocio } from "./playbooks/resumenDelNegocio.js";
import { margenEnRiesgo } from "./playbooks/margenEnRiesgo.js";
import { contradiccionDeMetricas } from "./playbooks/contradiccionDeMetricas.js";
import { pasosDe } from "./playbooks/registro.js";
import { componerReformulacion, destinatarioDe, sinPresentacionPosterior } from "./reformular.js";
import { esEncargoCompuesto } from "./contratoAgente.js";

const _FIN = "(?![\\wáéíóúñ])";

/* ── LAS PARTES, con su léxico cerrado y su pregunta canónica (la que ese procedimiento ya sabe responder) ─── */
const PARTES = [
  { clave: "foto", nombre: "la foto del negocio", playbook: resumenDelNegocio, pregunta: "¿Cómo va el negocio?",
    re: new RegExp([`\\bc[oó]mo (?:va|viene|vamos|venimos|est[aá]|anda|andamos) (?:el |mi )?negocio${_FIN}`, `\\bnegocio (?:completo|entero)${_FIN}`, `\\bmira el negocio${_FIN}`,
      `\\bqu[eé] est[aá] bien${_FIN}`, `\\bqu[eé] (?:te )?preocupa${_FIN}`, `\\bla foto${_FIN}`, `\\bpanorama${_FIN}`, `\\bqui[eé]n(?:es)? sostiene(?:n)? (?:la |las )?ventas?${_FIN}`].join("|"), "i") },
  { clave: "veredicto", nombre: "si es cierto", playbook: contradiccionDeMetricas, pregunta: null,   // la pregunta es la contradicción misma, tal como la dijo
    re: /\b(?:m[aá]s|menos|sub[eií]|baj[aoó]|crec[eií]|cae|cay[oó])\b[^.?!\n]{0,40}\bpero\b[^.?!\n]{0,40}\b(?:m[aá]s|menos|sub[eií]|baj[aoó]|crec[eií]|cae|cay[oó])\b/i },
  { clave: "porque", nombre: "el porqué", playbook: margenEnRiesgo, pregunta: "¿Por qué está pasando?",
    re: new RegExp([`\\bpor qu[eé]${_FIN}`, `\\bqu[eé] (?:est[aá] )?explic(?:a|ando)${_FIN}`, `\\ba qu[eé] se debe${_FIN}`, `\\bqu[eé] hay detr[aá]s${_FIN}`, `\\bde d[oó]nde viene${_FIN}`,
      `\\bsi viene de${_FIN}`, `\\bprecio, costo, mix${_FIN}`, `\\bla causa${_FIN}`, `\\bqu[eé] lo explica${_FIN}`].join("|"), "i") },
  { clave: "quienes", nombre: "quiénes lo explican", playbook: margenEnRiesgo, pregunta: "¿cómo viene mi margen?",
    re: new RegExp([`\\bqu[eé] clientes${_FIN}`, `\\bqu[eé] cuentas${_FIN}`, `\\bcu[aá]les (?:clientes|cuentas)${_FIN}`, `\\bqui[eé]n(?:es)? (?:destruye|presiona|explica|pesa|est[aá]n? detr[aá]s|se lleva)`,
      `\\bcu[aá]nto (?:dinero |plata )?(?:est[aá]|hay) en juego${_FIN}`, `\\bd[oó]nde est[aá] la mayor recuperaci[oó]n${_FIN}`, `\\bqui[eé]n(?:es)? (?:sostiene|sostienen) (?:el )?margen${_FIN}`].join("|"), "i") },
  { clave: "sello", nombre: "qué está demostrado", playbook: margenEnRiesgo, pregunta: "¿Qué parte de eso puedes demostrar y qué parte no?",
    re: new RegExp([`\\bqu[eé] (?:parte )?(?:puedes|pod[eé]s|podr[ií]as) (?:demostrar|probar)`, `\\bqu[eé] (?:est[aá]|tienes) (?:probado|demostrado)`, `\\bqu[eé] es hip[oó]tesis`,
      `\\bqu[eé] (?:informaci[oó]n|datos?) (?:te )?falta`, `\\bqu[eé] (?:te )?falta${_FIN}`, `\\bqu[eé] no puedes (?:probar|demostrar)`].join("|"), "i") },
  { clave: "primero", nombre: "qué haría primero", playbook: margenEnRiesgo, pregunta: "¿Qué harías primero?",
    re: new RegExp([`\\bqu[eé] har[ií]as primero`, `\\bd[oó]nde actuar[ií]as`, `\\bpor d[oó]nde (?:empezar|entrar|partir)`, `\\bqu[eé] (?:tres |dos |\\d+ )?cuentas (?:revisar[ií]as|atacar[ií]as|abrir[ií]as|mirar[ií]as)`,
      `\\bqu[eé] hacer primero`, `\\bprioridad${_FIN}`, `\\bqu[eé] har[ií]a primero`].join("|"), "i") },
];

/** las partes PEDIDAS, en el orden lógico de la casa — [] si no es un encargo compuesto o pide menos de dos */
export function partesDelEncargo(pregunta) {
  const q = sinPresentacionPosterior(String(pregunta || ""));
  if (!esEncargoCompuesto(q)) return [];
  const partes = PARTES.filter((p) => p.re.test(q)).map((p) => ({ ...p, pregunta: p.pregunta || q }));
  return partes.length >= 2 ? partes : [];
}

/** la unión de pasos (sin duplicar por herramienta+args): los del procedimiento activo y los de cada parte */
export function pasosDelEncargo(partes, pasosBase, ctx) {
  const out = [];
  const vistos = new Set();
  const firma = (p) => `${p.tool}::${JSON.stringify(p.args || {})}`;
  for (const p of [...(pasosBase || []), ...partes.flatMap((pt) => { try { return pasosDe(pt.playbook, pt.pregunta, ctx) || []; } catch { return []; } })]) {
    if (!p || !p.tool || vistos.has(firma(p))) continue;
    vistos.add(firma(p));
    out.push(p);
  }
  return out;
}

/* ── UNA SOLA TESIS Y UN SOLO CRITERIO · UNA CIFRA UNA VEZ ──────────────────────────────────────────────────── */
/* el criterio Y la oferta de cierre de cada composer («¿lo abrimos por…?», «pídeme su serie…»): son la misma
 * cosa —la puerta al siguiente paso— y en una lectura compuesta va una sola */
const _CRITERIO = /\b(?:entrar[ií]a por|empezar[ií]a por|partir[ií]a por|arrancar[ií]a por|criterio m[ií]o|si fuera mi decisi[oó]n|si te parece, empiezo|si quieres, sigo|cuando digas|te abro su serie|mi recomendaci[oó]n|yo mirar[ií]a primero|lo abrimos|p[ií]deme su serie|te dejo armado|el siguiente de la lista|donde hay m[aá]s contribuci[oó]n en juego es)\b/i;
/* una viñeta es una unidad de evidencia (una huella con su sello, una cuenta con su cifra): no se poda por repetir */
const _ES_VINETA = /^\s*(?:[-·•]|\d{1,2}[.)])\s+/;
const _CIFRA_FUERTE = /\$\s?[\d.,]+\s?[KMB]?|[\d.,]+\s*%/g;
const _cifrasDe = (l) => (String(l).match(_CIFRA_FUERTE) || []).map((c) => c.replace(/\s+/g, ""));

/**
 * componerEncargo({ partes, leer, scenario, mem, semilla, pregunta }) → texto | null
 *   `leer(pasos)` → figs: la boleta de ESA parte, con los resultados de sus pasos (ya ejecutados en el turno).
 */
export function componerEncargo({ partes, leer, scenario, mem, semilla, pregunta } = {}) {
  if (!Array.isArray(partes) || partes.length < 2 || typeof leer !== "function") return null;
  /* el porqué ya contiene el sello (sus huellas con su sello): si piden los dos, va uno */
  const activas = partes.some((p) => p.clave === "porque") ? partes.filter((p) => p.clave !== "sello") : partes;
  const hayPrimero = activas.some((p) => p.clave === "primero");
  const bloques = [];
  const citadas = new Set();
  let criterioVisto = false;
  let compuestas = 0;
  for (const parte of activas) {
    let texto = null;
    try {
      const figs = leer(pasosDe(parte.playbook, parte.pregunta, {}) || []);
      texto = parte.playbook.componer({ figs, pregunta: parte.pregunta, semilla, scenario, mem });
    } catch { texto = null; }
    if (!texto || !String(texto).trim()) {
      bloques.push(`Sobre ${parte.nombre} no pude armar la lectura con lo leído en este turno.`);
      continue;
    }
    compuestas++;
    const lineas = String(texto).split("\n");
    const salida = [];
    lineas.forEach((l, i) => {
      const linea = l.trimEnd();
      if (!linea.trim()) { salida.push(""); return; }
      const esCriterio = _CRITERIO.test(linea);
      if (esCriterio) {
        /* el criterio lo pone la prioridad si está pedida; si no, el primero que aparezca */
        if (parte.clave !== "primero" && (hayPrimero || criterioVisto)) return;
        criterioVisto = true;
      }
      const cifras = _cifrasDe(linea);
      if (cifras.length && parte.clave !== "primero" && !_ES_VINETA.test(linea) && cifras.every((c) => citadas.has(c))) return;   // solo repite lo ya citado: se omite
      for (const c of cifras) citadas.add(c);
      salida.push(linea);
    });
    bloques.push(salida.join("\n").replace(/\n{3,}/g, "\n\n").trim());
  }
  if (compuestas < 2) return null;   // con una sola parte armada no hay encargo compuesto que garantizar: cede al piso simple
  let cuerpo = bloques.join("\n\n");
  /* la versión para el lector, al final — el mismo piso de reformular sobre la lectura compuesta */
  const lector = (() => { try { return destinatarioDe(pregunta); } catch { return null; } })();
  if (lector) {
    let version = null;
    try { version = componerReformulacion(cuerpo, { pregunta: `para ${lector}` }); } catch { version = null; }
    if (version) cuerpo = `${cuerpo}\n\n${version}`;
  }
  return cuerpo;
}
