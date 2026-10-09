/* === src/adi/capacidad/paginasDeRetomar.js · `retomar` EN PÁGINAS, CON LO IMPORTANTE PRIMERO (ensayo 12, owner 2026-10-09 · `_ADI_DISENO_ALCANCE_DE_LO_ENTREGADO.md` §4) ═════════════════
 * Lo que pasó (12 · B01 sesión 2): `retomar` devolvió 235 KB —213 hechos, cada uno con su revalidación— con `hechos` ANTES de `resumen` y de `lineaContinuidad`; el cliente guardó un archivo y el modelo vio 2 KB.
 * Consecuencia: «una cifra ya cambió» (eran 26 + 4 que ya no existen), tres H-leve de continuidad y el terreno de un error material (los que tienen vencido). Con el libro en 64 KB es lo esperable.
 *
 * LO QUE SE HACE (puro; lo llama `compacto.js` al armar la respuesta de `retomar`, en los dos brazos del experimento):
 *   1 · ORDEN FIJO de la respuesta: memoria → establecido → estadoVigente → resumen → lineaContinuidad → (eventos · advertencias) → cambios[] → entregas[] → hechos[] → pagina → uso.
 *       `cambios[]` = solo lo que cambió (`cambio` · `ya_no_existe`), con la cifra de antes, la de ahora y la diferencia que ADI ya calculó: es lo que `retomar` existe para decir.
 *   2 · PAGINACIÓN CON PRESUPUESTO: cada respuesta cabe en la referencia de `consultar` (20 KB). La página 1 trae siempre resumen + cambios (todos, si caben) + los hechos que quepan; las
 *       siguientes, solo hechos. `retomar { conversacionId, pagina }` o `{ conversacionId, desde: "E3.h1" }`. La unión de las páginas es EXACTAMENTE `hechos` de antes, en su orden: ninguno se pierde ni se repite.
 *   3 · LA INCOMPLETITUD SE DECLARA EN DATO: `pagina: { k, de, hechos: "E1.h1–E2.h14 de E1.h1–E4.h35", completa, siguiente }` y `memoria.estaRespuesta` / `establecido.memoria`: «esta respuesta: página 1 de 4,
 *       faltan 173 hechos». Quien diga «solo vi el inicio» ya no adivina: sabe qué le falta y cómo pedirlo.
 * Sin `node:*`. Ningún cálculo de cifras: se COPIA lo que `retomar` ya revalidó. */

export const REFERENCIA_DE_PAGINA_BYTES = 20 * 1024;   /* = REFERENCIA_DE_TAMANO_BYTES de `compacto.js` (el mismo tope de `consultar`); `compacto.js` lo pasa, este archivo no lo importa para no hacer un ciclo */

const _bytes = (x) => new TextEncoder().encode(JSON.stringify(x)).length;
const _sinNulos = (o) => { const r = {}; for (const [k, v] of Object.entries(o)) if (v !== null && v !== undefined) r[k] = v; return r; };
const _rangoDe = (hs) => (hs.length ? (hs.length > 1 ? `${hs[0].id}–${hs[hs.length - 1].id}` : hs[0].id) : "");

/** cambiosDe(hechos) → [{ id, entidad, metrica, estado, antes, ahora?, diferencia? }] · SOLO los hechos que cambiaron o ya no figuran, con lo que `revalidar.js` ya calculó (nada se recalcula aquí) */
export function cambiosDe(hechos) {
  const out = [];
  for (const h of Array.isArray(hechos) ? hechos : []) {
    if (!h || (h.estadoReverificacion !== "cambio" && h.estadoReverificacion !== "ya_no_existe")) continue;
    const rv = h.revalidacion || {};
    const dif = rv.diferencia && typeof rv.diferencia === "object" ? rv.diferencia : null;
    out.push(_sinNulos({
      id: h.id, entidad: h.sujeto != null ? h.sujeto : null, metrica: h.metrica != null ? h.metrica : null, estado: h.estadoReverificacion,
      antes: rv.anterior && rv.anterior.valor != null ? rv.anterior.valor : (h.valor != null ? h.valor : null),
      ahora: h.estadoReverificacion === "cambio" ? (rv.actual && rv.actual.valor != null ? rv.actual.valor : (h.valorNuevo != null ? h.valorNuevo : null)) : null,
      diferencia: dif && dif.texto ? `${dif.texto}${dif.sentido ? ` (${dif.sentido})` : ""}` : null,
    }));
  }
  return out;
}

/** paginarRetomar({ cabeza, cambios, hechos, pagina?, desde?, limite? , establecido?, memoria? }) → la respuesta de UNA página
 *  `cabeza`  = { ok, conversacionId, memoria?, establecido?, estadoVigente, resumen, lineaContinuidad, eventos?, advertencias?, entregas, uso } — lo que va en la página 1 (y `memoria` · `establecido` · `uso` en todas)
 *  Devuelve { respuesta } | { rechazo } (página fuera de rango / `desde` desconocido). */
export function paginarRetomar({ cabeza, cambios = [], hechos = [], pagina = null, desde = null, limite = REFERENCIA_DE_PAGINA_BYTES } = {}) {
  const nC = cambios.length, nH = hechos.length;
  const items = [...cambios.map((c) => ({ t: "c", v: c })), ...hechos.map((h) => ({ t: "h", v: h }))];
  const { memoria, establecido, uso, ...resto } = cabeza;
  const textoDeEstaRespuesta = (p) => (p.completa ? "completa" : `${p.k ? `página ${p.k} de ${p.de}` : `desde ${p.desdeId}`}, faltan ${p.faltan} ${p.faltan === 1 ? "hecho" : "hechos"}`);

  /* una respuesta con los ítems [a, b) */
  const armar = (a, b, p, esPrimera) => {
    const cs = items.slice(a, b).filter((x) => x.t === "c").map((x) => x.v);
    const hs = items.slice(a, b).filter((x) => x.t === "h").map((x) => x.v);
    const faltan = nH - hs.length;
    const completa = a === 0 && b === items.length;
    const pg = _sinNulos({
      ...(p.k ? { k: p.k, de: p.de } : { desde: p.desdeId }),
      ...(hs.length ? { hechos: `${_rangoDe(hs)} de ${_rangoDe(hechos)}` } : {}),
      ...(cs.length && cs.length !== nC ? { cambios: `${cs.length} de ${nC}` } : {}),
      completa,
      siguiente: b < items.length ? (p.k ? p.k + 1 : (items[b].t === "h" ? { desde: items[b].v.id } : p.k)) : null,
    });
    const est = { completa, faltan, k: p.k, de: p.de, desdeId: p.desdeId };
    const mem = memoria ? { ...memoria, estaRespuesta: textoDeEstaRespuesta(est) } : { estaRespuesta: textoDeEstaRespuesta(est) };
    const estb = establecido ? { ...establecido, memoria: String(establecido.memoria || "").replace(/ · esta respuesta: .*$/, "") + ` · esta respuesta: ${textoDeEstaRespuesta(est)}` } : null;
    const base = esPrimera ? resto : { ok: resto.ok, conversacionId: resto.conversacionId };
    /* orden fijo: memoria → establecido → estadoVigente → resumen → lineaContinuidad → eventos/advertencias → cambios → entregas → hechos → pagina → uso */
    const ordenPrimera = ["ok", "conversacionId"];
    const r = { ...Object.fromEntries(ordenPrimera.filter((k) => k in base).map((k) => [k, base[k]])), memoria: mem, ...(estb ? { establecido: estb } : {}) };
    if (esPrimera) for (const k of ["estadoVigente", "resumen", "lineaContinuidad", "eventos", "advertencias"]) if (k in base) r[k] = base[k];
    if (cs.length || esPrimera) r.cambios = cs;
    if (esPrimera && "entregas" in base) r.entregas = base.entregas;
    r.hechos = hs;
    r.pagina = pg;
    if (esPrimera) for (const k of Object.keys(base)) if (!(k in r)) r[k] = base[k];   /* lo que `retomar` agregue después sigue viajando */
    if (uso !== undefined) r.uso = uso;
    return r;
  };

  /* el mayor tramo [a, b) que cabe (siempre avanza al menos un ítem: nada se queda sin entregar) */
  const llenar = (a, p, esPrimera) => {
    let b = a;
    while (b < items.length) {
      const prueba = armar(a, b + 1, { ...p, de: 99 }, esPrimera);
      if (_bytes(prueba) > limite && b > a) break;
      if (_bytes(prueba) > limite && b === a && !esPrimera) { b += 1; break; }   /* un ítem solo que no cabe: viaja solo */
      if (_bytes(prueba) > limite && b === a && esPrimera) break;               /* la cabeza de la página 1 ya llena la página: los ítems van desde la 2.ª */
      b += 1;
    }
    return b;
  };

  /* el recorrido de punta a punta fija las páginas */
  const cortes = [];   /* [a, b) de cada página */
  { let a = 0; for (let k = 1; ; k++) { const b = llenar(a, { k }, k === 1); cortes.push([a, b]); if (b >= items.length) break; a = b; if (k > 5000) break; } }
  const de = cortes.length;

  if (desde != null) {
    const iDesde = items.findIndex((x) => x.t === "h" && x.v.id === desde);
    if (iDesde < 0) return { rechazo: { motivo: "desde_desconocido", detalle: `«${desde}» no es el id de un hecho de esta conversación`, primero: hechos[0] ? hechos[0].id : null, ultimo: hechos[nH - 1] ? hechos[nH - 1].id : null } };
    const b = llenar(iDesde, { desdeId: desde }, false);
    return { respuesta: armar(iDesde, b, { desdeId: desde, de }, false), de };
  }
  const k = pagina == null ? 1 : pagina;
  if (!Number.isInteger(k) || k < 1 || k > de) return { rechazo: { motivo: "pagina_fuera_de_rango", detalle: `la conversación tiene ${de} ${de === 1 ? "página" : "páginas"} de hechos; pidió la ${k}`, de } };
  const [a, b] = cortes[k - 1];
  return { respuesta: armar(a, b, { k, de }, k === 1), de };
}
