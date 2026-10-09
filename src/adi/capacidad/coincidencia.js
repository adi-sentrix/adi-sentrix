/* === src/adi/capacidad/coincidencia.js · LA COINCIDENCIA ENTRE DOS ÓRDENES: ADI RESPONDE LA RELACIÓN, NO EL ANFITRIÓN (owner 2026-10-09, ensayo 10, opción 1) ═════════
 * `_ADI_DISENO_CONTRATO_ANFITRION.md` §16. El ensayo 10 dejó un patrón nuevo con el dato correcto a la vista: el anfitrión dijo una RELACIÓN FALSA ENTRE DOS ÓRDENES («las cuentas más grandes —Falabella, Lider y Jumbo— son también las de menor
 * margen», cuando su propia tabla ponía a Sodimac, 23.5 %, bajo Jumbo, 24 %; «El Roble… la que más crece» cuando era Mercantil Pacífico; «Falabella es además tu mayor cliente en deuda» cuando era Lider). Decisión del owner: la relación entre
 * dos listas es un hecho de ADI, no una inferencia del anfitrión. Esta es la vía barata para pedirlo: `derivar` con `operacion: "coincidencia"` y `{ eje, a: {metrica, direccion, k}, b: {metrica, direccion, k} }` → cuántas de las `k`
 * primeras por A están entre las `k` primeras por B, y cuáles («de las 3 cuentas de mayor venta, 2 están entre las 3 de menor margen: Falabella y Lider»).
 *
 * LOS DOS ÓRDENES SE CALCULAN SOBRE EL UNIVERSO COMPLETO DEL EJE, nunca sobre lo que se imprimió: es el MISMO top que `consultar` sirve con `universo: {eje, top}` —la misma lectura del Core (`lecturasDe` + `runPlan`) y la MISMA primitiva que
 * resuelve un `top` para la Entrega y para el Notario (`notario/verificar.js:conjuntoDeUniverso`, con su empate del filo, su `ranking-parcial` y su polaridad de «peor/mejor»)—, así que un lado nunca discrepa de lo que `consultar` mostraría. Lo que el
 * Core no puede ordenar sobre el eje entero (una métrica sin cifra en ese eje, un ranking parcial, «peor/mejor» sin polaridad) se RECHAZA con su razón: jamás se rellena con lo que sí se vio.
 *
 * DOS DOMINIOS EN EL MISMO EJE (venta y saldo vencido): se admiten, porque el eje y su universo de entidades son los mismos, y cada lado dice su marco («período cerrado» vs «foto de cobranza al 31 ago 2026»); nunca se suman ni se restan.
 * EMPATES: si el corte cae en un empate, el top sirve a TODOS los empatados y la coincidencia lo declara (`empate`) —no se elige a uno en silencio—; «m de n» usa los n servidos.
 *
 * Este archivo toca el Core (`validarEncargo`, `lecturasDe`, `runPlan`, el tenant ACTIVO): se llama DENTRO de `conTenantActivo` (`acciones.js`), igual que `consultar`. `derivar.js` sigue siendo puro: solo guarda y describe el resultado.
 * Sin red, sin LLM, sin `node:*`. */
import { validarEncargo } from "../encargo/validar.js";
import { lecturasDe, REGISTRO_LECTURAS } from "../encargo/lecturasDe.js";
import { EJES } from "../encargo/esquema.js";
import { runPlan } from "../oracle/toolRunner.js";
import { cifrasDelDato } from "../oracle/datoProyectado.js";
import { axisEntityNames } from "../oracle/entityIndex.js";
import { indiceDeEvidencia } from "../notario/evidencia.js";
import { asignarIds, nombrarUniverso } from "../notario/hechos.js";
import { conjuntoDeUniverso } from "../notario/verificar.js";
import { dominioDeClave, metricaDeClave, PLURAL_DE_EJE, ARTICULO_DE_EJE } from "../notario/lexico.js";
import { formaDeLaCoincidencia } from "./derivar.js";
import { metricasDelEje } from "./ensenar.js";
import { periodoDeFiguras } from "../../config/contract/figureType.js";
import { ESCENARIO_INICIAL } from "../../config/scenarios.js";

const _rechazo = (motivo, detalle, extra = {}) => ({ ok: false, motivo, detalle, ...extra });
const _sinPrefijo = (e) => String(e || "").replace(/^[a-z-]+:\s*/i, "");

/* el tema (dominio) de una métrica: el registro de la casa, no una tabla nueva */
const _temaDe = (metrica) => dominioDeClave(metrica) || null;
const _marcoDeCobranza = (rp, plan) => {
  const idx = plan && Array.isArray(plan.calls) ? plan.calls.findIndex((c) => c && c.tool === "cobranza") : -1;
  const f = idx >= 0 && rp && rp.results && rp.results[idx] ? rp.results[idx].facts : null;
  return f && f.fechaCorte ? `foto de cobranza al ${f.fechaCorte}` : "foto de cobranza";
};

/** calcularCoincidencia({ eje, a, b }) → { ok:true, eje, n, lados:[{metrica, direccion, k, tema, marco, texto, entidades, empate?}, …], comunes:[…], m } | rechazo · se llama DENTRO del tenant activo (`conTenantActivo`).
 *  `n` = cuántas entidades tiene el eje; `entidades` = las del top en orden de ranking; `comunes` = las del cruce, en el orden del lado A. */
export function calcularCoincidencia(pedido) {
  const f = formaDeLaCoincidencia(pedido);
  if (!f.ok) return f;
  const { eje, a, b } = f;
  const N = axisEntityNames(eje).length;
  if (!N) return _rechazo("lado_no_resoluble", `este eje no tiene entidades en los datos de la empresa: no hay nada que ordenar`, { eje });
  for (const [nombre, x] of [["a", a], ["b", b]]) if (x.k > N) return _rechazo("k_fuera_de_rango", `«${nombre}.k» = ${x.k}, pero el eje ${eje} tiene ${N} ${PLURAL_DE_EJE[eje] || `${eje}s`}: pida a lo más ${N} (un k igual al total no es una vista parcial)`, { eje, n: N });

  /* LA MISMA VALIDACIÓN QUE `consultar`: un encargo de dos partes, cada una un top sobre el eje. Lo que el validador no resuelve (una métrica que no es de ese eje, un cruce bloqueado, un eje sin productor) se rechaza con sus alternativas. */
  const tema = {};
  for (const [nombre, x] of [["a", a], ["b", b]]) {
    tema[nombre] = _temaDe(x.metrica);
    const delEje = metricasDelEje(eje);
    if (!tema[nombre] || !delEje.includes(x.metrica)) return _rechazo("metrica_no_del_eje", `«${x.metrica}» no tiene cifras por ${eje} en el catálogo de ADI: no se puede ordenar ese eje por ella. Use una de las que sí las tienen`, { ladoAfectado: nombre, eje });
  }
  const encargo = { version: "encargo/v1", partes: [a, b].map((x, i) => ({ id: i === 0 ? "a" : "b", tema: tema[i === 0 ? "a" : "b"], cierre: "cifra", eje, universo: { eje, top: { metrica: x.metrica, k: x.k, direccion: x.direccion } } })) };
  const resolucion = validarEncargo(encargo, {});
  const noResuelto = resolucion.noResuelto || [];
  const sinResolver = (resolucion.partes || []).filter((p) => p.estado !== "resuelta");
  if (noResuelto.length || sinResolver.length || (resolucion.partes || []).length !== 2) {
    const nr = (resolucion.noResuelto || [])[0] || {};
    const lado = nr.parte === "a" || nr.parte === "b" ? nr.parte : (sinResolver[0] && sinResolver[0].id) || null;
    const mot = nr.motivo === "concepto_de_otro_tema" || nr.motivo === "concepto_desconocido" || nr.motivo === "concepto_sin_productor" || nr.motivo === "universo_invalido" ? "metrica_no_del_eje" : "lado_no_resoluble";
    return _rechazo(mot, `${lado ? `el orden «${lado}»` : "uno de los órdenes"} no se puede pedir sobre el eje ${eje}: ${nr.detalle || nr.motivo || "el catálogo no lo soporta para ese eje"}`, { ladoAfectado: lado, eje, noResuelto: resolucion.noResuelto || [] });
  }

  /* LAS LECTURAS DEL CORE y el índice de evidencia: lo mismo que arma `componerEntrega` para resolver un top */
  const { plan, porParte } = lecturasDe(resolucion);
  if (!plan || !plan.calls || !plan.calls.length) return _rechazo("lado_no_resoluble", "el Core no generó ninguna lectura para estos órdenes", { eje });
  const rp = runPlan(plan, { scenario: ESCENARIO_INICIAL, maxCalls: Math.max(8, plan.calls.length), preguntaUsuario: null, registry: REGISTRO_LECTURAS });
  const figs = asignarIds((rp.ledger && rp.ledger.figs) || []);
  const ejesDelTenant = {};
  for (const e of EJES) { try { const ns = axisEntityNames(e); if (ns && ns.length) ejesDelTenant[e] = ns; } catch { /* eje sin índice en este tenant */ } }
  const I = indiceDeEvidencia({ figs, datoProyectado: cifrasDelDato(ESCENARIO_INICIAL, null), ejesDelTenant });
  const callIdx = (call) => plan.calls.findIndex((c) => c.tool === call.tool && JSON.stringify(c.args || {}) === JSON.stringify(call.args || {}));
  const figsDeLado = (id) => { const ids = new Set((porParte[id] || []).map((c) => callIdx(c)).filter((i) => i >= 0).map((i) => `c${i}`)); return ids.size ? figs.filter((g) => g.origin && ids.has(g.origin.callId)) : figs; };

  const nombreDe = (clave) => { const r = I.entidades && I.entidades.get ? I.entidades.get(clave) : null; return r && r.nombre ? r.nombre : clave; };
  const lados = [];
  for (const [id, x] of [["a", a], ["b", b]]) {
    const universo = { eje, top: { metrica: x.metrica, k: x.k, direccion: x.direccion } };
    const S = conjuntoDeUniverso(universo, I, eje, "");
    if (S.error || !S.set) return _rechazo("lado_no_resoluble", `el orden «${id}» (${metricaDeClave(x.metrica)}, ${x.direccion}) no se puede calcular sobre el eje ${eje} completo: ${_sinPrefijo(S.error) || "la evidencia no trae la métrica para todo el eje"}. ADI no ordena sobre una vista parcial`, { ladoAfectado: id, eje, motivoDelCore: S.error || null });
    const claves = [...S.set];
    const e = S.empateEnElFilo || null;
    let texto = ""; try { texto = nombrarUniverso(universo, I); } catch { texto = ""; }
    /* «el de mayor saldo vencido» (un solo extremo), no «los 1 de mayor…» */
    if (x.k === 1) texto = `${ARTICULO_DE_EJE[eje] === "las" ? "la" : "el"} de ${x.direccion} ${metricaDeClave(x.metrica).toLowerCase()}`;
    const figsL = figsDeLado(id);
    const marco = tema[id] === "cobranza" ? _marcoDeCobranza(rp, plan) : (() => { const t = periodoDeFiguras(figsL.filter((g) => dominioDeClave(g && g.metric) !== "cobranza")).texto; return t ? String(t).split(" — ")[0] : ""; })();
    lados.push({ id, metrica: x.metrica, direccion: x.direccion, k: x.k, tema: tema[id], marco, texto, claves, entidades: claves.map(nombreDe), ...(e ? { empate: { entidades: (e.nombres || []).slice(), puesto: e.puesto, servidos: e.servidos, k: x.k } } : {}) });
  }
  const enB = new Set(lados[1].claves);
  const comunesClaves = lados[0].claves.filter((c) => enB.has(c));
  return {
    ok: true, eje, n: N,
    lados: lados.map(({ claves, ...r }) => r),
    comunes: comunesClaves.map(nombreDe),
    m: comunesClaves.length,
  };
}
