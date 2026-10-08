/* === scripts/medicion-anfitrion/clasificacion.mjs · LA CLASIFICACIÓN HUMANA (`clasificacion.json`) → LO QUE EL INFORME NECESITA ═══════════════════════════════
 * Tras una corrida, una persona (o el clasificador del supervisor) lee los transcritos y deja `clasificacion.json` con el formato de los ensayos 3-5:
 *   filas[]        las MARCAS del rastreo, una por id `hilo|sesión|turno|k`: clase V (falla del medidor: la frase era verdadera) · H-correcta (verdadera, pero la calculó el anfitrión: fuera de contrato) · H-leve (falsa, inmaterial) · H-grave (falsa, material) · A (error de ADI)
 *   fuera_de_contrato[]   las cifras que el rastreo aceptó como derivación propia del anfitrión, con la clase que les dio la persona
 *   palabras[]     lo que el rastreo NO ve (conteos, relaciones y afirmaciones dichas con letras), por TURNO `hilo|sesión|turno` (un id puede agrupar varios con « · ")
 *   paraRevisar    { noV[] } las cifras que el rastreo dejó «para revisar» y la persona juzgó no-V (con id de celda)
 *   casosA[]       los candidatos a error de ADI: estado «firme» · «a decidir…» (candidato) · «observación»
 *
 * CONVENCIÓN DE MEDICIÓN (owner 2026-10-08 · es de DOCUMENTACIÓN: ningún cálculo cambia; el diseño completo está en `_ADI_DISENO_MEDICION_ANFITRION.md` §6):
 *   · MATERIAL (H-grave, y A cuando la Entrega indujo el error) = un error que cambiaría una conclusión o una cifra sobre la que el usuario actuaría.
 *   · LEVE (H-leve) = un error DENTRO de una hipótesis explícita, una autocorrección en la misma respuesta, o una imprecisión de orden que no cambia la conclusión.
 * NADA acá llama a un modelo. Es lectura de datos de la persona, con una sola regla de fondo: lo que la persona clasificó manda sobre la máquina. */

const _plano = (s) => String(s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "");
const _turnoDe = (id) => String(id || "").split("|").slice(0, 3).join("|");
const _hiloDe = (id) => String(id || "").split("|")[0];

/* ── LA FAMILIA DE UN ERROR («el mismo tipo de error») ────────────────────────────────────────────────────────────────────────────────────────────────────────────
 * Para el patrón sistemático: dos errores son «del mismo tipo» si caen en la misma familia. La familia sale del subtipo que dio la persona (o del veredicto del rastreo): el orden de las reglas importa (la primera que casa). */
export const FAMILIAS_DE_ERROR = Object.freeze([
  ["conteo", /conteo|cuantos|cuantas|cuantific/],
  ["relación o razón entre cifras", /relacion|razon|proporcion|orden|compar|invertid|mitad|doble/],
  ["dueño distinto", /dueno|atribu|entidad_|mal_asociad|cuenta_equivocada/],
  ["métrica distinta", /metrica|etiqueta|rotulo/],
  ["aritmética propia", /suma|aritmet|calculo|conversion|resta|diferencia|complemento|porcentaje/],
  ["causalidad sin respaldo", /causal|porque|causa_/],
  ["cifra sin respaldo", /no_traza|inventad|sin_respaldo|cifra_/],
  ["umbral redondeado", /umbral|redondead/],
  ["afirmación no sostenida", /no_sostenid|autocontradich|exagerad|generaliz|omision|cuantificador|ejemplos_presentados/],
  ["continuidad", /pasado_reescrito|cambio_no_avisado|cambio_inventado/],
]);
/** familiaDeError(subtipoOVeredicto) → la familia («conteo», «dueño distinto»…) o el propio subtipo si no cae en ninguna. */
export function familiaDeError(subtipo) {
  const s = String(subtipo || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  for (const [nombre, rx] of FAMILIAS_DE_ERROR) if (rx.test(s)) return nombre;
  return s || "sin clasificar";
}
/** El veredicto del rastreo → su familia (las marcas que nadie clasificó). */
export const FAMILIA_DEL_VEREDICTO = Object.freeze({ no_traza: "cifra sin respaldo", dueno_distinto: "dueño distinto", metrica_distinta: "métrica distinta", conteo_no_cierra: "conteo", relacion_no_cierra: "relación o razón entre cifras", pasado_reescrito: "continuidad", cambio_no_avisado: "continuidad", "juez:falsa": "afirmación no sostenida" });

/** leerClasificacion(obj) → { decisiones{id→{veredicto, material?, caso?, nota}}, hallazgos[], casosAdi[], resumen } · el contenido de `clasificacion.json`, normalizado para el informe. */
export function leerClasificacion(c) {
  if (!c || typeof c !== "object") return null;
  const decisiones = {};
  const nota = (x) => [x.subtipo, x.oracion ? `«${String(x.oracion).slice(0, 90)}»` : null].filter(Boolean).join(" · ");
  const deClase = (clase, x) => {
    if (clase === "V") return { veredicto: "verdadera", nota: nota(x) };
    if (clase === "H-correcta") return { veredicto: "verdadera", caso: "fuera_de_contrato", nota: nota(x) };
    if (clase === "H-leve") return { veredicto: "falsa", material: false, nota: nota(x) };
    if (clase === "H-grave") return { veredicto: "falsa", material: true, nota: nota(x) };
    if (clase === "A") return { veredicto: "error_adi", nota: nota(x) };
    return null;
  };
  for (const f of c.fuera_de_contrato || []) { const d = deClase(f.clase, f); if (d && f.id) decisiones[f.id] = d; }       // (las filas mandan sobre esta lista: van después)
  for (const f of c.filas || []) { const d = deClase(f.clase, f); if (d && f.id) decisiones[f.id] = d; }

  /* lo que el rastreo NO ve: palabras (por turno, con ids agrupados) y las cifras «para revisar» que la persona juzgó no-V (por celda); una misma oración con varias celdas es UN hallazgo */
  const crudos = [];
  for (const p of c.palabras || []) for (const id of String(p.id || "").split(/\s*·\s*/).filter(Boolean)) crudos.push({ turnoId: id, hilo: _hiloDe(id), clase: p.clase, subtipo: p.subtipo || "", oracion: p.oracion || "", fuente: "palabras" });
  for (const p of (c.paraRevisar && c.paraRevisar.noV) || []) crudos.push({ turnoId: _turnoDe(p.id), hilo: _hiloDe(p.id), clase: p.clase, subtipo: p.subtipo || "", oracion: p.oracion || "", fuente: "para_revisar", celda: p.id });
  const rango = { "H-grave": 3, "H-leve": 2, "H-correcta": 1 };
  const hallazgos = [];
  for (const x of crudos) {
    if (!rango[x.clase]) continue;                                // observaciones de conducta, errores de ADI y lo demás no son afirmaciones del anfitrión
    const k = _plano(x.oracion);
    const igual = hallazgos.find((h) => h.turnoId === x.turnoId && ((k && h.clave && (h.clave.includes(k) || k.includes(h.clave))) || (!k && !h.clave && h.subtipo === x.subtipo)));
    if (igual) { if (rango[x.clase] > rango[igual.clase]) { igual.clase = x.clase; igual.subtipo = x.subtipo || igual.subtipo; } igual.fuentes.add(x.fuente); continue; }
    hallazgos.push({ turnoId: x.turnoId, hilo: x.hilo, clase: x.clase, subtipo: x.subtipo, oracion: x.oracion, clave: k, fuentes: new Set([x.fuente]) });
  }
  for (const h of hallazgos) { h.familia = familiaDeError(h.subtipo); h.fuentes = [...h.fuentes]; delete h.clave; }

  /* ADI: «firme» es un error de ADI; «a decidir» es un candidato (bloquea el cierre hasta que el owner decida); el resto, observaciones */
  const casosAdi = [];
  for (const k of c.casosA || []) {
    const estado = /^firme/i.test(String(k.estado || "")) ? "firme" : /^a decidir|candidat/i.test(String(k.estado || "") + " " + String(k.tipo || "")) ? "candidato" : "observacion";
    casosAdi.push({ id: k.id, tipo: k.tipo, estado, evidencia: String(k.evidencia || "").slice(0, 400) });
  }
  for (const p of c.palabras || []) if (p.clase === "A" && !casosAdi.some((k) => k.id === p.id)) casosAdi.push({ id: p.id, tipo: `A · ${p.subtipo || "palabras"}`, estado: "firme", evidencia: String(p.verdad || "").slice(0, 400) });
  for (const f of c.filas || []) if (f.clase === "A" && !casosAdi.some((k) => k.id === f.id)) casosAdi.push({ id: f.id, tipo: `A · ${f.subtipo || "marca"}`, estado: "firme", evidencia: String(f.evidencia || "").slice(0, 400) });

  const conteo = {};
  for (const f of c.filas || []) conteo[f.clase] = (conteo[f.clase] || 0) + 1;
  return { corrida: c.corrida || null, decisiones, hallazgos, casosAdi, resumen: { filas: (c.filas || []).length, porClase: conteo, hallazgosDePalabras: hallazgos.length } };
}

/* ── EL PATRÓN SISTEMÁTICO ───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
 * Un error del anfitrión que se REPITE no es un tropiezo estocástico de un modelo externo: es una conducta (o una Entrega que la provoca). Regla (owner 2026-10-07: «sin patrón sistemático repetido»): la MISMA familia de error
 * aparece en `minRepeticiones` (2) o más errores distintos de la corrida —sea en un hilo o en varios—. Se evalúa sobre los errores MATERIALES; los errores leves repetidos se listan aparte (informativo) y solo cuentan si
 * `incluirLeves` está encendido. */
export const PARAMETROS_DE_CIERRE = Object.freeze({ afirmacionesPorError: 500, minRepeticiones: 2, incluirLevesEnElPatron: false, umbralDeCumplimientoPct: null });

/** patronesSistematicos(errores[{familia, hilo, id, oracion}], { minRepeticiones }) → [{ familia, veces, hilos[], ids[] }] · las familias con `minRepeticiones` o más errores distintos. */
export function patronesSistematicos(errores, { minRepeticiones = PARAMETROS_DE_CIERRE.minRepeticiones } = {}) {
  const porFamilia = new Map();
  for (const e of errores) { if (!porFamilia.has(e.familia)) porFamilia.set(e.familia, []); porFamilia.get(e.familia).push(e); }
  return [...porFamilia.entries()].filter(([, v]) => v.length >= minRepeticiones).map(([familia, v]) => ({ familia, veces: v.length, hilos: [...new Set(v.map((e) => e.hilo))].sort(), ids: v.map((e) => e.id), ejemplos: v.slice(0, 3).map((e) => String(e.oracion || "").slice(0, 100)) }));
}

/** limiteDeErrores(N, afirmacionesPorError) → floor(N / 500): lo que se tolera de errores materiales del anfitrión. Con N < 500 el límite es 0 (se dice así en el informe: «máximo 1 cada 500» a la letra). */
export function limiteDeErrores(n, porError = PARAMETROS_DE_CIERRE.afirmacionesPorError) {
  return Math.floor(Math.max(0, Number(n) || 0) / porError);
}
