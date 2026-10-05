/* === scripts/procedencia/textosDePiso.mjs · LOS TEXTOS Y LAS MEDICIONES DEL PISO DE COBRANZA (PRI-04) DE UNA EMPRESA (Etapa 2, bloque 5 · owner 2026-10-04) ═════════════
 * Compartido por `_piso_cobranza_declarado_gate.mjs` y por el barrido de las tres empresas de `_procedencia_gate.mjs` (§8): UNA sola forma de pedirle a la capa de conocimiento «el piso de esta empresa».
 * `deLaEmpresa(dataset, fn)` corre `fn` dentro del tramo del Core de esa empresa (la misma `conTenantActivo` de las acciones); `textosDePiso` devuelve todo lo que PRI-04 le dice al usuario con ESE piso
 * (cada cuenta, la cobertura, el bloque, la mención y la oferta), y `medicionesDeCobranza` lo que la cobranza MIDE con él (la mesa de flujo, la tabla de señales y las cifras de cada cuenta) separado de los
 * VEREDICTOS (señal · bajo el piso · borde): la FRONTERA del owner dice que declarar otro piso puede cambiar los segundos y nunca las primeras.
 * Puro: cero red, cero LLM. */
import { conTenantActivo } from "../../src/adi/capacidad/aislamiento.js";
import { ESCENARIO_INICIAL } from "../../src/config/scenarios.js";
import { construirTablaDeSenales } from "../../src/adi/conocimiento/tablaSenales.js";
import { medirPieza, coberturaPisoDeCobranza, resultadosPisoDeCobranza } from "../../src/adi/conocimiento/medir.js";
import { servirPieza, servirBloquePisoDeCobranza, servirMencionPisoDeCobranza, servirOfertaPisoDeCobranza } from "../../src/adi/conocimiento/servir.js";
import { piezaPorId } from "../../src/adi/conocimiento/piezas.js";
import { buildMesaFlujo } from "../../src/adi/sentrix/mesaFlujo.js";

export const PIEZA_PISO = piezaPorId("PRI-04");
const PREGUNTA = "quién me debe más";

/** tablaDe(dataset) → la tabla de señales de la empresa (dentro de su tramo del Core) */
const _tabla = () => construirTablaDeSenales({ scenario: ESCENARIO_INICIAL, pregunta: PREGUNTA, entidadesEnRespuesta: [] });

/** deLaEmpresa(dataset, fn) → lo que devuelva `fn({ tabla })`, con `dataset` como la empresa activa */
export function deLaEmpresa(dataset, fn) {
  return conTenantActivo(dataset, () => fn({ tabla: _tabla() }));
}

/** textosDePiso(dataset) → [string] · todo lo que PRI-04 le dice al usuario con el piso que rige para esa empresa */
export function textosDePiso(dataset) {
  return deLaEmpresa(dataset, ({ tabla }) => {
    const { evaluables, porEntidad } = resultadosPisoDeCobranza(PIEZA_PISO, tabla);
    const out = [];
    for (const e of evaluables) {
      const m = medirPieza(PIEZA_PISO, e, tabla);
      if (m && m.estado !== "indeterminable") out.push(servirPieza(PIEZA_PISO, e, m).texto);
    }
    const cierre = coberturaPisoDeCobranza(tabla);
    if (cierre) out.push(cierre.texto);
    const todas = new Set(evaluables);
    const bloque = cierre && servirBloquePisoDeCobranza(PIEZA_PISO, porEntidad, cierre.texto, { sujeto: todas, abierta: true });
    if (bloque && bloque.texto) out.push(bloque.texto);
    const mencion = servirMencionPisoDeCobranza(PIEZA_PISO, porEntidad, { nombradas: todas });
    if (mencion && mencion.texto) out.push(mencion.texto);
    const oferta = servirOfertaPisoDeCobranza(PIEZA_PISO, porEntidad, cierre);
    if (oferta && oferta.texto) out.push(oferta.texto);
    return out.filter((t) => typeof t === "string" && t.trim());
  });
}

/** medicionesDeCobranza(dataset, { contaminar? }) → { mediciones, veredictos } · `mediciones` = TODO lo que la cobranza mide (la mesa de flujo entera, la tabla de señales con sus cifras y, por cuenta, las cifras que PRI-04
 *  publica: participaciones, diferencia en puntos y en monto) más lo que la cobertura cuenta de la CARTERA (vencido total, su peso, cuántos clientes se evaluaron); `veredictos` = señal · bajo el piso · borde de cada cuenta
 *  y los conteos de la cobertura. La frontera: con otro piso, `mediciones` es IDÉNTICO y `veredictos` puede cambiar. `contaminar(tabla, mesa)` solo existe para las carnadas (un piso que alterara una medición). */
export function medicionesDeCobranza(dataset, { contaminar = null } = {}) {
  return deLaEmpresa(dataset, ({ tabla }) => {
    let mesa = buildMesaFlujo(ESCENARIO_INICIAL);
    if (contaminar) { const r = contaminar(tabla, mesa); if (r && r.mesa) mesa = r.mesa; }
    const { evaluables } = resultadosPisoDeCobranza(PIEZA_PISO, tabla);
    const cuentas = {}, veredictos = {};
    for (const e of evaluables) {
      const m = medirPieza(PIEZA_PISO, e, tabla);
      if (!m || m.estado === "indeterminable") { cuentas[e] = { indeterminable: true }; continue; }
      const p = m.partes || {};
      cuentas[e] = { cifra: m.cifra ? m.cifra.texto : null, propio: p.propio, resto: p.resto, puntos: p.puntos, monto: p.monto, sentido: p.sentido };
      veredictos[e] = { estado: m.estado, borde: m.borde === true };
    }
    const cierre = coberturaPisoDeCobranza(tabla);
    const cartera = cierre ? { vencidoTotal: cierre.vencidoTotal ? { texto: cierre.vencidoTotal.texto, pct: cierre.vencidoTotal.pctTexto, raw: cierre.vencidoTotal.raw } : null, evaluados: evaluables.length } : null;
    const conteos = cierre ? (/(\d+) señal · (\d+) bajo el piso · (\d+) al día/.exec(cierre.texto) || []).slice(1).map(Number) : null;
    return {
      mediciones: JSON.stringify({ mesa, cuentasDeLaTabla: tabla.cuentas, skus: tabla.skus, periodo: tabla.periodo, universo: tabla._universoCobranza, figs: tabla._figs, cifrasPorCuenta: cuentas, cartera }),
      veredictos: JSON.stringify({ porCuenta: veredictos, conteos }),
      cuentas: evaluables,
    };
  });
}
