/* === src/adi/agente/playbooks/prioridadPorLente.js · LA PRIORIDAD BAJO EL CRITERIO DEL USUARIO (owner 2026-09-14) =====
 *
 * «El usuario también debe poder cambiar el criterio después: "ahora ordénamelo por caja", "ahora por contribución", etc.,
 * sin cambiar los hechos subyacentes.» Este playbook atiende ese turno: una petición corta que FIJA el criterio («prioriza
 * caja», «ordénamelo por contribución», «quiero recuperar margen») fuera de un encargo compuesto (el encargo ya lleva el
 * criterio por su propio camino). Lee la realidad de los tres dominios —los mismos pasos del contrato de dominios— y
 * compone la prioridad bajo esa lente con `prioridadIntegrada.js`: las mismas señales, otro orden, y la nota de cómo
 * cambia con otra lente. La lista notarial cobra que el cierre ponga primero a quien va primero bajo ESE criterio. */
import { criterioDeLaPregunta, componerPrioridadIntegrada, conclusionDePrioridad, prioridadIntegradaCambiada, CRITERIOS } from "../prioridadIntegrada.js";
import { pasosDeDominios } from "../contratoDeDominios.js";
import { esEncargoCompuesto } from "../partesDelEncargo.js";
import { declaradorDe } from "../../notario/declarar.js";   // el Notario semántico (fase 2): el composer declara mientras escribe, sin camino privilegiado

const _DOMS = ["comercial", "inventario", "cobranza"];
const _DECISION = /\bhago bien\b|\bhacemos bien\b|\bdeber[ií]a(?:mos)? (?:priorizar|seguir|apostar)\b|\bconviene\b|\bes buena idea\b|\bme equivoco\b|\btiene sentido\b/i;
const _ORDENA = /\bprioriz|\bord[eé]n|\breord[eé]n|\brank|\bclasif|\bahora por\b|\bmejor por\b|\bentonces por\b|\bquiero (?:recuperar|liberar|cobrar|proteger|cuidar|maximizar|mejorar)\b|\blente\b|\bcriterio\b/i;
const _criterio = (pregunta) => {
  const q = String(pregunta || "");
  if (esEncargoCompuesto(q)) return null;   // el encargo compuesto lleva el criterio por su camino (encargoCompuesto)
  if (_DECISION.test(q)) return null;      // «¿hago bien en priorizar volumen?» es una decisión a desafiar, no un cambio de criterio
  if (!_ORDENA.test(q)) return null;
  const c = criterioDeLaPregunta(q);
  return c && c.modo === "explicito" && CRITERIOS[c.criterio] ? c : null;
};

export const prioridadPorLente = {
  nombre: "prioridad-por-lente",
  multidominio: true,
  ejemplos: ["ahora ordénamelo por caja", "prioriza contribución", "quiero recuperar margen: ¿por dónde parto?"],
  tenantDeMuestra: "demo",

  cuandoAplica(pregunta) { return _criterio(pregunta) !== null; },

  /* la realidad de los tres dominios: las mismas señales de siempre, para que cualquier lente tenga con qué ordenar */
  pasos(pregunta) {
    if (!_criterio(pregunta)) return [];
    return pasosDeDominios({ dominios: _DOMS, eje: null }).map((p) => ({ ...p, para: p.para || "la realidad del dominio, para ordenar bajo el criterio que pidió el usuario" }));
  },
  /* la promesa: la señal de materialidad del criterio pedido (el registro retira al playbook que no promete nada) */
  obligatorias(pregunta) {
    const c = _criterio(pregunta);
    if (!c) return [];
    return { riesgo: [/· Contribución no capturada$/i, /· Saldo vencido$/i], contribucion: [/· Contribución no capturada$/i], caja: [/· Saldo vencido$/i], ventas: [/· Venta(?: (flujo))?$/i], crecimiento: [/· YoY$/i], capital: [/· Capital frenado$/i] }[c.criterio] || [];
  },

  entregable: "la prioridad ordenada bajo el criterio que fijó el usuario —las mismas cifras de siempre, otra prioridad—, con el criterio dicho y, si es material, la nota de que otra lente cambiaría el orden",

  componer({ figs, pregunta, declarar } = {}) {
    const D = declaradorDe(declarar);   // sin colector, mudo: el texto es el mismo byte a byte
    const c = _criterio(pregunta);
    if (!c) return null;
    /* el cuerpo lo escribe —y lo declara— la prioridad integrada con el MISMO colector (la convención del ensamblador del encargo):
     * cifras, órdenes y conteos del cierre son suyos; este playbook solo pone el marco, que no es un hecho sobre una métrica */
    const texto = componerPrioridadIntegrada(figs, _DOMS, { ...c, declarar });
    if (!texto) return null;
    const marco = `Ordenado bajo el criterio que fijaste — ${CRITERIOS[c.criterio].nombre}. Los hechos son los mismos; cambia quién va primero.`;
    D.lectura({ texto: marco, sello: "probado" });
    return `${marco}\n${texto}`;
  },

  conclusiones(figs, pregunta = "") {
    const c = _criterio(pregunta);
    return c ? conclusionDePrioridad(figs, _DOMS, c) : "";
  },

  listaNotarial(texto, { figs, pregunta } = {}) {
    const c = _criterio(pregunta);
    if (!c) return [];
    const m = (() => { try { return prioridadIntegradaCambiada(texto, figs, _DOMS, c); } catch { return null; } })();
    return m ? [{ regla: "prioridad-cambiada", multa: m }] : [];
  },
};
