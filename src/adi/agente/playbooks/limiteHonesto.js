/* === src/adi/agente/playbooks/limiteHonesto.js · EL LÍMITE HONESTO CON ALTERNATIVA (owner 2026-09-02) =======
 *
 * LA EVIDENCIA — tres fallos de la certificación, la MISMA conducta:
 *   · COMPLETA T4 «por punto de venta, ¿quién queda bajo el plan?» → respondió por CLIENTES bajo benchmark sin
 *     nombrar jamás el eje pedido. El dato declara punto de venta como capturado SIN analizar
 *     (`guardadoSinAnalizar`, decisión del owner 2026-08-26) y ADI no lo dijo.
 *   · PARCIAL T4 «mejores y peores puntos de venta» → ídem: clientes, sin avisar que la columna vino vacía.
 *   · DEMO T6 «Compara Q1 vs Q2…» → el menú de rescate con labels internos («tengo Este año y Valor: dime cuál
 *     abro»).
 *
 * EL MÉTODO: el corte pedido no se puede servir y SE DICE, con la razón EXACTA que el dataset activo declara —
 * este playbook CABLEA frases que ya existen (`guardadoSinAnalizar` con sus filas y valores distintos ·
 * `faltanteQueToca` con la pieza y lo que abre · el corte trimestral que ningún dato de hoy trae), jamás las
 * inventa. Después, QUÉ SÍ HAY: la alternativa real más cercana con su eje nombrado (la lectura por cliente
 * contra el año anterior), jamás un menú de labels internos. Y una oferta de una línea.
 *
 * CUÁNDO APLICA — léxico sobre el EJE pedido, CRUZADO con el estado del dato: solo si el dato declara que ese
 * eje no se sirve. En el DEMO nadie declara nada sobre punto de venta (ni guardado ni faltante), así que ahí
 * este playbook se retira y el cerebro decide — inventar «no existe» sin una declaración del dato sería
 * exactamente el pecado que este playbook viene a cerrar. El corte por TRIMESTRE es la excepción declarada
 * acá: ningún pack de hoy lo trae (la serie autorizada es mensual); el día que un dato declare trimestres,
 * esta línea tiene que aprender a consultarlo.
 *
 * ⚠️ LA TRAMPA MEDIDA (no-secuestro en las DOS direcciones): «por punto de venta, ¿quién queda bajo el plan?»
 * contiene «venta» y «bajo» — caída-de-ventas ya la esquiva (bigrama + palabras inequívocas, jamás la
 * preposición) y ESTE detector exige el bigrama «punto de venta» completo, así que ninguno pisa al otro.
 * Carnadas de las dos direcciones en el gate.
 *
 * PURO · determinístico · sin red. Cifras VERBATIM de la boleta; selecciona y ordena, jamás calcula. */

import { getTenantData } from "../../../data/tenantStore.js";
import { faltanteQueToca } from "../mapaDelDato.js";
import { variante } from "../variacion.js";   // la oferta varía por semilla («matar la repetición», 2026-09-03)

const _num = (f) => (f && Number.isFinite(f.raw) ? f.raw : NaN);
const _val = (f) => String((f && (f.text || f.value)) || "");
const _lab = (f) => String((f && f.label) || "");
const _find = (figs, re) => (Array.isArray(figs) ? figs : []).find((f) => re.test(_lab(f))) || null;
const _all = (figs, re) => (Array.isArray(figs) ? figs : []).filter((f) => re.test(_lab(f)));
const _entidadDe = (label) => {
  const p = String(label || "").split("·").map((s) => s.trim());
  return p.length >= 2 ? p[0] : null;
};
const _FIN = "(?![a-záéíóúüñ])";
const _SIMULA = new RegExp(`\\bsimul|\\bproyect|\\bqu[eé] pasa si${_FIN}|\\bpon[eé]le que${_FIN}`, "i");

/* los DOS ejes que este playbook sabe declarar como no servibles — bigramas completos, jamás palabras sueltas */
const _PDV = /\bpunto[s]? de venta\b|\bsucursal(?:es)?\b|\btienda[s]?\b/i;
const _TRIM = /\bq[1-4]\s*(?:vs\.?|contra|y|-)\s*q[1-4]\b|\btrimestre[s]?\b|\btrimestral(?:es)?\b/i;

/* el estado del dato para punto de venta: guardado-sin-analizar (la columna vino LLENA) o faltante (vacía/ausente) */
const _estadoPdv = (pregunta) => {
  const d = getTenantData() || {};
  const g = (Array.isArray(d.guardadoSinAnalizar) ? d.guardadoSinAnalizar : []).find((x) => /punto de venta/i.test(String(x && x.campo)));
  if (g) return { tipo: "guardado", g };
  let f = null;
  try { f = faltanteQueToca(String(pregunta || "")); } catch { /* sin mapa no hay declaración */ }
  if (f && /punto de venta/i.test(String(f.pieza))) return { tipo: "faltante", f };
  return null;
};

export const limiteHonesto = {
  nombre: "limite-honesto",

  cuandoAplica(pregunta) {
    const q = String(pregunta || "");
    if (!q.trim() || _SIMULA.test(q)) return false;
    if (_TRIM.test(q)) return true;                       // ningún dato de hoy trae el corte trimestral (ver cabecera)
    if (_PDV.test(q)) return _estadoPdv(q) !== null;      // solo si el DATO declara el límite; en el demo se retira
    return false;
  },

  /* la alternativa es UNA y existe en los tres mundos medidos (demo · completa · parcial): la lectura por
   * cliente contra el año anterior (headline + YoY con nombre). Un paso, una promesa. */
  pasos: [
    { tool: "salesRead", args: {}, para: "la alternativa real más cercana: la lectura por cliente contra el año anterior (el período y quién sube/cae), para ofrecerla con su eje nombrado" },
  ],
  obligatorias: [/^headline$/i],

  entregable: "el corte pedido no está disponible y POR QUÉ, con la razón exacta que el dataset declara (guardado sin analizar · columna vacía · sin corte trimestral); qué lectura SÍ hay, nombrada con su eje (cliente, contra el año anterior); y una oferta de una línea. Jamás responder por otro eje sin declarar el límite, jamás un menú de labels internos.",

  componer({ figs, pregunta, semilla } = {}) {
    const q = String(pregunta || "");
    const head = _find(figs, /^headline$/i);
    if (!head) return null;

    /* 1 · QUÉ: la razón del dataset activo, cableada de donde ya vive */
    let razon = null;
    if (_TRIM.test(q)) {
      razon = "Tu dato no trae un corte por trimestre: la serie autorizada es mensual, y la comparación declarada del período es contra el año anterior. Armar Q1 y Q2 sumando meses sería una cifra que tu dato no declara, y no la invento.";
    } else if (_PDV.test(q)) {
      const e = _estadoPdv(q);
      if (!e) return null;
      razon = e.tipo === "guardado"
        ? `Tu archivo SÍ trae punto de venta (${e.g.filas} filas con ${e.g.distintos} valores distintos) y está guardado, pero ADI todavía no analiza por ese eje — la lectura que pides no existe aún.`
        : `Tu archivo no trae ${e.f.pieza}: con eso se abre ${e.f.abre}. Sin esa columna, la lectura que pides no se puede armar.`;
    }
    if (!razon) return null;

    /* 2 · QUÉ SÍ HAY: la alternativa con su eje nombrado, cifras verbatim y con dueño */
    const yoy = _all(figs, /· YoY$/i).map((f) => ({ entidad: _entidadDe(_lab(f)), usd: _num(f), fmt: _val(f) }))
      .filter((x) => x.entidad && Number.isFinite(x.usd));
    const sube = yoy.filter((x) => x.usd > 0).sort((a, b) => b.usd - a.usd)[0];
    const cae = yoy.filter((x) => x.usd < 0).sort((a, b) => a.usd - b.usd)[0];
    const partes = [razon];
    const piezas = [];
    if (sube) piezas.push(`el que más sube es ${sube.entidad} (${sube.fmt})`);
    if (cae) piezas.push(`el que más cae es ${cae.entidad} (${cae.fmt})`);
    partes.push(`\nLo que sí tengo es la lectura por CLIENTE contra el año anterior: el período viene en ${_val(head)}${piezas.length ? ` — ${piezas.join(" y ")}` : ""}.`);

    /* 3 · LA OFERTA, una línea — varía por semilla; toda variante nombra «ese eje» (el ancla verificable) */
    partes.push(variante(semilla, [
      "Si te sirve ese eje, la abro completa. Dime y la traigo.",
      "¿Te abro la lectura completa por ese eje?",
      "Si ese eje te sirve, te la traigo completa.",
    ]));
    return partes.join("\n");
  },

  listaNotarial(texto, { figs, pregunta } = {}) {
    const t = String(texto || "");
    if (!t.trim()) return [];
    const q = String(pregunta || "");
    const v = [];
    /* 1 · EL EJE SERVIDO A ESCONDIDAS — la conducta T4 exacta: responder por otro eje sin nombrar jamás el
     * límite del pedido. Si el playbook está activo, el texto TIENE que nombrar el eje pedido (punto de
     * venta / trimestre); nombrar clientes sin esa mención es el secuestro silencioso que se vino a cerrar. */
    const eje = _TRIM.test(q) ? { re: /\btrimestr|\bq[1-4]\b/i, nombre: "trimestre" }
      : _PDV.test(q) ? { re: /punto[s]? de venta|sucursal|tienda/i, nombre: "punto de venta" } : null;
    if (eje && !eje.re.test(t)) {
      v.push({ regla: "eje-servido-a-escondidas",
        multa: `la pregunta pide el corte por ${eje.nombre} y tu respuesta no lo nombra ni una vez: declara primero que ese corte no está disponible (con la razón del dato) y recién después ofrece la alternativa por otro eje.` });
    }
    /* 2 · EL MENÚ DE LABELS INTERNOS — el rescate medido en T6/T11: «tengo Este año y Valor: dime cuál abro».
     * Un label interno no es una oferta; la alternativa se nombra con su eje y en castellano. */
    if (/tambi[eé]n tengo [A-ZÁÉÍÓÚ][\w ]{0,30}(?: y [A-ZÁÉÍÓÚ][\w ]{0,30})?\s*[:.]?\s*dime cu[aá]l/i.test(t) || /\bdime cu[aá]l abro\b/i.test(t)) {
      v.push({ regla: "menu-de-labels",
        multa: "ofreces un menú de labels internos («tengo X y Y: dime cuál abro»): la alternativa se nombra con su eje y en palabras del negocio, no con etiquetas de la boleta." });
    }
    return v;
  },
};
