/* _guion_declara.mjs · LOS GUIONES DE LOS GATES DECLARAN COMO UN CEREBRO (Notario semántico, fase 2 · 2026-09-15) ═══════════
 * El bucle exige que el cerebro DECLARE cada afirmación de hecho en el bloque <<AFIRMACIONES>> … <<FIN>>; un cierre sin bloque
 * cae por `sin-declaracion` y nunca se sirve como verificado (`_notario_semantico_flujo_gate` §B). Los guiones que los gates
 * inyectan como cerebro son anteriores a ese contrato: escriben la prosa y nada más. Este envoltorio hace lo que haría un cerebro
 * que declara desde la evidencia: toma la boleta verificada del turno (`figs`, que el bucle entrega en cada llamada) y deriva la
 * declaración de las cifras, conteos y estados que la prosa trae, con el MISMO derivador que usa el respaldo cuando no compone con
 * colector (`declaracionDeRespaldo`). Lo que la derivación no alcanza —un orden, una relación, una variación en palabras— queda
 * SIN declarar y el juez lo cobra (`afirmacion-no-declarada`): el guion que afirma eso tiene que declararlo a mano, en el bloque,
 * como lo haría el modelo. Un guion que YA trae su bloque pasa intacto; un guion mudo también.
 *
 * NO es un camino del producto: vive fuera de `src/`, solo lo importan los gates. El modelo de producción declara solo. */
import fs from "node:fs";
import { axisEntityNames } from "./src/adi/oracle/entityIndex.js";
import { ESCENARIO_INICIAL } from "./src/config/scenarios.js";
import { cifrasDelDato } from "./src/adi/oracle/datoProyectado.js";
import { MARCA_INICIO, MARCA_FIN, declaracionDeRespaldo } from "./src/adi/notario/declaracion.js";

const _ejes = () => { const o = {}; for (const e of ["cliente", "sku", "marca", "familia", "bodega", "canal"]) { try { const n = axisEntityNames(e); if (n && n.length) o[e] = n; } catch { /* sin índice */ } } return o; };

/** bloqueDe(afirmaciones) → el bloque tal como lo escribe el modelo (una afirmación JSON por línea) */
export const bloqueDe = (afirmaciones) => `${MARCA_INICIO}\n${(afirmaciones || []).map((a) => JSON.stringify(a)).join("\n")}\n${MARCA_FIN}`;

/** conDeclaracion(texto, figs, scenario) → el texto + su bloque derivado de la boleta (si no lo traía) */
export function conDeclaracion(texto, figs, scenario = ESCENARIO_INICIAL, extra = []) {
  const t = String(texto || "");
  if (!t.trim() || t.includes(MARCA_INICIO)) return t;
  let afs = [];
  try { afs = declaracionDeRespaldo(t, figs || [], { ejesDelTenant: _ejes(), datoProyectado: scenario ? cifrasDelDato(scenario) : null }); } catch { afs = []; }
  return `${t}\n\n${bloqueDe([...afs, ...(Array.isArray(extra) ? extra : [])])}`;   // `extra`: lo que el guion declara A MANO (lo que la derivación no alcanza: un orden, una relación, una lectura)
}

/** declarando(guion, scenario) → el mismo guion, cuyas respuestas de texto salen con su declaración derivada de `figs` */
export const declarando = (guion, scenario = ESCENARIO_INICIAL) => async (args) => {
  const r = await guion(args);
  /* el guion puede traer `declarar: [...]` con lo que declara a mano (se suma a lo derivado) */
  if (r && typeof r === "object" && r.tipo === "texto" && typeof r.texto === "string") return { ...r, texto: conDeclaracion(r.texto, args && args.figs, scenario, r.declarar) };
  return r;
};

/** afirmacionesDelFixture(fixture, borrador) → las afirmaciones declaradas A MANO (fase 1, seis etiquetadores) para ese borrador vivo, o null */
export function afirmacionesDelFixture(fixture, borrador) {
  try {
    const S = JSON.parse(fs.readFileSync(new URL("./fixtures/notario-semantico-2026-09-15.json", import.meta.url), "utf8"));
    const c = S.corpus.find((x) => x.fixture === fixture && x.borrador === borrador);
    return c ? c.afirmaciones.map((a) => Object.fromEntries(Object.entries(a).filter(([k]) => !["veredicto_esperado", "verdad", "nota", "evidencia"].includes(k)))) : null;
  } catch { return null; }
}
/** falsasEsperadas(fixture, borrador) → cuántas afirmaciones de ese borrador el fixture etiqueta como falsas */
export function falsasEsperadas(fixture, borrador) {
  try {
    const S = JSON.parse(fs.readFileSync(new URL("./fixtures/notario-semantico-2026-09-15.json", import.meta.url), "utf8"));
    const c = S.corpus.find((x) => x.fixture === fixture && x.borrador === borrador);
    return c ? c.afirmaciones.filter((a) => a.veredicto_esperado === "falsa").length : 0;
  } catch { return 0; }
}
