/* === src/adi/agente/playbooks/prioridadPorLente.js · LA PRIORIDAD BAJO EL CRITERIO DEL USUARIO (owner 2026-09-14) =====
 *
 * «El usuario también debe poder cambiar el criterio después: "ahora ordénamelo por cobranza", "ahora por contribución",
 * etc., sin cambiar los hechos subyacentes.» Este playbook atiende ese turno: una petición corta que FIJA el criterio
 * («prioriza cobranza», «ordénamelo por contribución», «quiero recuperar margen») fuera de un encargo compuesto (el
 * encargo ya lleva el criterio por su propio camino). Lee la realidad de los tres dominios —los mismos pasos del
 * contrato de dominios— y compone la prioridad bajo esa lente con `prioridadIntegrada.js`: las mismas señales, otro
 * orden, y la nota de cómo cambia con otra lente. La lista notarial cobra que el cierre ponga primero a quien va
 * primero bajo ESE criterio.
 *
 * ══ «CAJA» ES TESORERÍA (owner 2026-09-24, ley ADI_CAJA_NO_ES_COBRANZA) ═══════════════════════════════════════════════
 * «Caja»/«liquidez» ya NO disparan el criterio de cobranza (que pasó a llamarse «exposición de crédito», clave `credito`
 * en `prioridadIntegrada.js`): este producto no tiene datos de tesorería. Ese pedido lo atiende este mismo playbook
 * declarando la ausencia (`config/contract/ausencias.js:sin_datos_tesoreria`) y ofreciendo la exposición de crédito
 * como lo más cercano que sí se mide, sin llamarla caja. */
import { criterioDeLaPregunta, componerPrioridadIntegrada, conclusionDePrioridad, prioridadIntegradaCambiada, pideTesoreria, CRITERIOS } from "../prioridadIntegrada.js";
import { pasosDeDominios } from "../contratoDeDominios.js";
import { esEncargoCompuesto } from "../partesDelEncargo.js";
import { declaradorDe } from "../../notario/declarar.js";   // el Notario semántico (fase 2): el composer declara mientras escribe, sin camino privilegiado
import { ausenciaPorId } from "../../../config/contract/ausencias.js";   // owner 2026-09-24: «caja» es tesorería — la ausencia se declara, nunca se confunde con cobranza

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
/* ══ «CAJA» ES TESORERÍA (owner 2026-09-24, ley ADI_CAJA_NO_ES_COBRANZA) — «prioriza caja», «ordénamelo por
 * liquidez»: no se reinterpreta como cobranza. Se declara la ausencia y se ofrece la exposición de crédito como
 * lo más cercano que sí se mide, sin llamarla caja (el veto `_COMO_CAJA` de guardC.js ya prohíbe narrar una
 * cifra de cobranza como caja — acá no se le pega ningún monto a la palabra «caja», solo se declara ausente). */
const _pideTesoreria = (pregunta) => {
  const q = String(pregunta || "");
  if (esEncargoCompuesto(q)) return false;   // el encargo compuesto lleva su propio camino
  if (_DECISION.test(q)) return false;
  return pideTesoreria(q);
};
const _AUSENCIA_TESORERIA_ID = "sin_datos_tesoreria";
const _textoAusenciaTesoreria = () => {
  const a = ausenciaPorId(_AUSENCIA_TESORERIA_ID);
  return (a && a.texto) || "«Caja» es tesorería: este dato no trae posición de caja ni movimientos de tesorería — no se puede priorizar por caja.";
};

export const prioridadPorLente = {
  nombre: "prioridad-por-lente",
  multidominio: true,
  ejemplos: ["ahora ordénamelo por cobranza", "prioriza contribución", "quiero recuperar margen: ¿por dónde parto?", "prioriza caja"],
  tenantDeMuestra: "demo",

  cuandoAplica(pregunta) { return _criterio(pregunta) !== null || _pideTesoreria(pregunta); },

  /* la realidad de los tres dominios: las mismas señales de siempre, para que cualquier lente tenga con qué ordenar
   * (también para el pedido de tesorería: la exposición de crédito que se ofrece en su lugar necesita la misma realidad) */
  pasos(pregunta) {
    if (!_criterio(pregunta) && !_pideTesoreria(pregunta)) return [];
    return pasosDeDominios({ dominios: _DOMS, eje: null }).map((p) => ({ ...p, para: p.para || "la realidad del dominio, para ordenar bajo el criterio que pidió el usuario" }));
  },
  /* la promesa: la señal de materialidad del criterio pedido (el registro retira al playbook que no promete nada
   * — `promesasCumplidas`, registro.js:163, trata una promesa VACÍA como NO cumplida, así que un pedido de
   * tesorería tiene que prometer algo real). Un pedido de tesorería nunca promete una fig de caja (no existe):
   * promete lo que SÍ entrega en su lugar, la exposición de crédito — el mismo «· Saldo vencido» del criterio
   * `credito` (owner 2026-09-24, arreglo tras medir con `answerViaAgente`: sin esta promesa el playbook se
   * retiraba en silencio y el turno degradaba a la línea del límite). */
  obligatorias(pregunta) {
    const c = _criterio(pregunta);
    if (c) return { riesgo: [/· Contribución no capturada$/i, /· Saldo vencido$/i], contribucion: [/· Contribución no capturada$/i], credito: [/· Saldo vencido$/i], ventas: [/· Venta(?: (flujo))?$/i], crecimiento: [/· YoY$/i], capital: [/· Capital frenado$/i] }[c.criterio] || [];
    if (_pideTesoreria(pregunta)) return [/· Saldo vencido$/i];
    return [];
  },

  entregable: "la prioridad ordenada bajo el criterio que fijó el usuario —las mismas cifras de siempre, otra prioridad—, con el criterio dicho y, si es material, la nota de que otra lente cambiaría el orden; con «caja»/«liquidez», la ausencia de datos de tesorería declarada y la exposición de crédito ofrecida en su lugar",

  componer({ figs, pregunta, declarar } = {}) {
    const D = declaradorDe(declarar);   // sin colector, mudo: el texto es el mismo byte a byte
    const c = _criterio(pregunta);
    if (!c) {
      if (!_pideTesoreria(pregunta)) return null;
      /* «caja»/«liquidez» es tesorería: se declara la ausencia (nunca se le cuelga un monto a la palabra «caja» —
       * el veto `_COMO_CAJA` de guardC.js vigila justo eso) y se ofrece la exposición de crédito como lo más
       * cercano que sí se mide, con su propio nombre. */
      const linea1 = _textoAusenciaTesoreria();
      const linea2 = "Ofrezco en su lugar la exposición de crédito por cliente —el saldo vencido y su atraso—: no es caja, es cobranza.";
      D.lectura({ texto: linea1, sello: "criterio mío" });
      D.lectura({ texto: linea2, sello: "criterio mío" });
      const texto = componerPrioridadIntegrada(figs, _DOMS, { criterio: "credito", modo: "explicito", declarar });
      return texto ? `${linea1}\n${linea2}\n${texto}` : `${linea1}\n${linea2}`;
    }
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
    if (c) return conclusionDePrioridad(figs, _DOMS, c);
    if (_pideTesoreria(pregunta)) {
      return [
        `[PRIORIDAD DEL PROCEDIMIENTO — no es el usuario] El usuario pidió priorizar/ordenar por «caja» o «liquidez»: ${_textoAusenciaTesoreria()}`,
        `- caja ≠ cobranza: no reinterpretes el pedido como cobranza ni llames «caja» a una cifra de vencido o saldo pendiente.`,
        `- ofrece la exposición de crédito por cliente (saldo vencido al corte y su atraso) como lo más cercano que sí se mide, nombrándola así, nunca como caja.`,
      ].join("\n");
    }
    return "";
  },

  listaNotarial(texto, { figs, pregunta } = {}) {
    const c = _criterio(pregunta);
    if (!c) return [];
    const m = (() => { try { return prioridadIntegradaCambiada(texto, figs, _DOMS, c); } catch { return null; } })();
    return m ? [{ regla: "prioridad-cambiada", multa: m }] : [];
  },
};
