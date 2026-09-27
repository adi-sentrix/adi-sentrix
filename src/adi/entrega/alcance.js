/* === src/adi/entrega/alcance.js · EL ALCANCE DE UNA PARTE, EN UN SOLO PUNTO ═══════════════════════════════════
 * CANDADO DE COMPLETITUD (owner 2026-09-26, diagnóstico v4 §3, MATERIAL) — `alcanceDeParte` tiene que leer TODOS
 * los campos que `notario/hechos.js:CAMPOS_UNIVERSO` admite en un universo tipado (la MISMA lista que
 * `validarUniverso` usa para rechazar «campos desconocidos» — una sola fuente, importada, nunca copiada). El
 * defecto real que esto cierra: `u.bodega` nunca se leía acá, así que una `cifra` acotada a `{eje:"sku",
 * bodega:"Valparaíso"}` servía el inventario COMPLETO en la tabla «Cifras» y en la oración de respuesta — la
 * NOTARÍA (que verifica premisas) sí sabe filtrar por bodega (`notario/verificar.js:_skusEnBodega`); el
 * COMPOSITOR no. Este archivo se autochequea al cargar: si `CAMPOS_UNIVERSO` gana un campo mañana y
 * `_CAMPOS_MANEJADOS` (abajo) no lo lista, el import de este módulo LANZA — cualquier gate que lo cargue queda
 * rojo de inmediato, no en producción.
 *
 * DECISIÓN DE ARQUITECTURA DEL SUPERVISOR (diagnóstico v2, 2026-09-26) sobre el patrón transversal que atraviesa
 * R1, R2, RC-D y RC-F del diagnóstico: el alcance que el usuario DECLARÓ en una parte del encargo (eje, entidades
 * excluidas, el recorte `universo.top`) se validaba bien en `encargo/validar.js` pero se perdía entre la
 * validación y la composición — CUATRO compositores distintos (`iniciativa.js`, `_planMultiTema`,
 * `_planCifraGrupo`, el group-by de `_planCifraGrupo` otra vez para el eje) perdían el MISMO alcance por CUATRO
 * caminos de código distintos, la misma ley del owner violada cuatro veces. Mandato: «NADA de cuatro parches, uno
 * por compositor. Una sola pieza» — este archivo es esa pieza.
 *
 * `alcanceDeParte(parte)` DERIVA el alcance de una `ParteResuelta` (eje, entidades nombradas, entidades excluidas,
 * `top`, estados/no_estados/filtros, período) — la MISMA lectura de campos que antes vivía repetida y a medias en
 * `iniciativa.js:_tieneLecturaDeCarteraEntera`, `componer.js:_planCifraGrupo`/`_planMultiTema` (cada uno leía
 * `parte.universo`/`parte.eje` a su manera, y ninguno leía `universo.excluir`). `figsEnAlcance(figs, alcance, …)`
 * RECORTA las figs de esa parte a ese alcance — todo compositor consume figs YA acotadas, nunca decide el alcance
 * por su cuenta. `recortarATop(...)` hace la otra mitad del recorte por `top.k` (que exige el ORDEN por la
 * métrica del top, decisión de cada compositor — no se puede resolver acá sin ese criterio). */

import { CAMPOS_UNIVERSO } from "../notario/hechos.js";
// R-BASE-SIN-ALCANCE (supervisor 2026-09-26, MATERIAL) — `conjuntoDeUniverso` es LA MISMA primitiva que ya
// resuelve `base` para el Notario (`hechos.js:_conteoTipado`, la premisa que declara el mismo cohorte), sobre
// `datoProyectado.conjuntos` (ver su cabecera en verificar.js) — nunca una segunda definición de «carga comercial
// alta» ni de ningún otro cohorte de Business Knowledge.
import { conjuntoDeUniverso } from "../notario/verificar.js";

const _norm = (s) => String(s || "").trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

/* los campos de CAMPOS_UNIVERSO que `alcanceDeParte` YA sabe leer y devolver — `eje` siempre estuvo (con su propio
 * fallback a `parte.eje`, ver abajo); `base` y `union` YA recortan (R-BASE-SIN-ALCANCE cerrado, UNIÓN cerrada en
 * la segunda vuelta, supervisor 2026-09-26): `figsEnAlcance` resuelve el conjunto combinado con `conjuntoDeUniverso`,
 * la MISMA primitiva del Notario, sobre `datoProyectado.conjuntos` — solo con `indice`, igual criterio que
 * `bodega`. Ningún campo de `CAMPOS_UNIVERSO` queda sin mecanismo de recorte en este archivo. */
const _CAMPOS_MANEJADOS = ["eje", "base", "estados", "no_estados", "bodega", "filtros", "top", "excluir", "union"];
{ const olvidados = CAMPOS_UNIVERSO.filter((c) => !_CAMPOS_MANEJADOS.includes(c)); if (olvidados.length) throw new Error(`entrega/alcance.js: CAMPOS_UNIVERSO ganó campo(s) que alcanceDeParte no maneja: ${olvidados.join(", ")} — agregalos a _CAMPOS_MANEJADOS y a alcanceDeParte/figsEnAlcance antes de tocar nada más`); }

/** alcanceDeParte(parte) → { eje, base, excluir:[nombre,...], top, estados, no_estados, filtros, bodega, union,
 *  entidadesNombradas, periodo } — TODOS los campos de `CAMPOS_UNIVERSO` (candado de completitud arriba).
 *  `parte` es una `ParteResuelta` (`encargo/validar.js`) o el resumen equivalente que ya usa `iniciativa.js`
 *  (`{ tema, cierre, conceptos, entidades, universo, eje? }`) — ambos formatos traen los mismos campos con el
 *  mismo nombre, así que una sola función sirve a los dos llamadores. */
export function alcanceDeParte(parte) {
  if (!parte) return { eje: null, base: null, excluir: [], top: null, estados: null, no_estados: null, filtros: null, bodega: null, union: null, entidadesNombradas: [], periodo: null };
  const u = parte.universo || null;
  // el eje EFECTIVO de la parte: el del universo si lo declara, si no el campo `eje` de la parte (`ParteResuelta.eje`
  // ya trae el sujeto por defecto del tema cuando el usuario no escribió uno — ver `validar.js:308` — así que este
  // campo SIEMPRE está poblado; «eje explícito» en el sentido de RC1/R1 es `eje !== sujetoDeTema(tema)`, decisión
  // que le toca al LLAMADOR, que sí conoce el tema — acá solo se deriva el valor, no se juzga si es «por defecto»).
  const eje = (u && u.eje) || parte.eje || null;
  const excluir = (u && u.excluir && Array.isArray(u.excluir.entidades)) ? u.excluir.entidades.filter(Boolean) : [];
  const top = (u && u.top && Number.isFinite(u.top.k)) ? u.top : null;
  return {
    eje,
    base: (u && u.base) || null,
    excluir,
    top,
    estados: (u && Array.isArray(u.estados) && u.estados.length) ? u.estados : null,
    no_estados: (u && Array.isArray(u.no_estados) && u.no_estados.length) ? u.no_estados : null,
    filtros: (u && Array.isArray(u.filtros) && u.filtros.length) ? u.filtros : null,
    // BODEGA (diagnóstico v4 §3, MATERIAL): solo restringe SKU (`validarUniverso` ya lo exige antes de llegar
    // acá) — se expone tal como se declaró, sin resolver contra el tenant: `figsEnAlcance` es quien recorta.
    bodega: (u && u.bodega) || null,
    union: (u && Array.isArray(u.union) && u.union.length) ? u.union : null,
    entidadesNombradas: (parte.entidades || []).map((e) => e && e.nombre).filter(Boolean),
    periodo: parte.periodo || null,
  };
}

const _entidadDeLabelDefault = (label) => { const p = String(label || "").split("·").map((s) => s.trim()); return p.length >= 2 ? p[0] : null; };

/* la bodega declarada («Valparaíso») CASA con la bodega real de un SKU («Valparaíso») por igualdad normalizada o
 * contención (tolera una frase suelta del tipo «bodega de Valparaíso» sin necesitar resolver contra el tenant —
 * el universo tipado del encargo ya trae el nombre limpio en el 99% de los casos; la contención es la misma
 * tolerancia que `_bodegaNombrada` usa en `notario/verificar.js`, sin duplicar su regex sobre el índice). */
const _mismaBodega = (declarada, real) => { const d = _norm(declarada), r = _norm(real); return !!d && !!r && (d === r || d.includes(r) || r.includes(d)); };

/** figsEnAlcance(figs, alcance, { ejesDelTenant, entidadDeLabel, indice }) → figs recortadas al alcance declarado:
 *   (a) R2 — retira las figs cuya entidad está en `alcance.excluir` (nunca vuelve la entidad que el usuario excluyó);
 *   (b) RC-F — si `alcance.eje` está declarado y `ejesDelTenant` distingue ejes, retira las figs cuya entidad
 *       pertenece a OTRO eje conocido (nunca mezcla un SKU en un ranking de bodega, ni una bodega en uno de marca);
 *   (c) BODEGA (diagnóstico v4 §3, MATERIAL) — si `alcance.bodega` está declarado, retira los SKU cuyo estado
 *       (`indice.estados`, la MISMA proyección que lee `notario/verificar.js:_skusEnBodega`) los ubica en OTRA
 *       bodega del tenant. `indice` es OPCIONAL (el índice de `notario/evidencia.js:indiceDeEvidencia` que
 *       `componer.js` ya arma con `_indiceDelTenant`); sin él, esta mitad del recorte no corre — el llamador que
 *       declare `bodega` sin pasar `indice` se queda con el defecto viejo (documentado, no silencioso: ver el
 *       candado de completitud arriba, que exige que todo campo de universo SE LEA, no que todos se resuelvan sin
 *       insumos). Un SKU sin ningún estado conocido (sin fila en `indice.estados`) NUNCA se excluye a ciegas —
 *       mismo principio que (a)/(b): solo se recorta lo que SÍ se identificó como perteneciente a OTRA bodega. */
export function figsEnAlcance(figs, alcance, { ejesDelTenant = {}, entidadDeLabel = _entidadDeLabelDefault, indice = null } = {}) {
  if (!Array.isArray(figs) || !figs.length) return figs || [];
  const excluidas = new Set((alcance && alcance.excluir || []).map(_norm));
  const eje = alcance && alcance.eje ? String(alcance.eje).trim().toLowerCase() : null;
  const miembrosDeOtroEje = [];   // [Set(nombre normalizado), ...] — uno por cada eje AJENO con índice conocido
  if (eje && ejesDelTenant && typeof ejesDelTenant === "object") {
    for (const [otroEje, nombres] of Object.entries(ejesDelTenant)) {
      if (otroEje === eje || !Array.isArray(nombres) || !nombres.length) continue;
      miembrosDeOtroEje.push(new Set(nombres.map(_norm)));
    }
  }
  const bodegaDecl = alcance && alcance.bodega ? String(alcance.bodega) : null;
  const fueraDeBodega = new Set();   // SKU CONOCIDOS en otra bodega — nunca "desconocido = fuera"
  if (bodegaDecl && indice && Array.isArray(indice.estados)) {
    for (const x of indice.estados) {
      if (!x || !x.entidad) continue;
      if (x.bodega && !_mismaBodega(bodegaDecl, x.bodega)) fueraDeBodega.add(_norm(x.entidad));
    }
  }
  // BASE + UNIÓN (R-BASE-SIN-ALCANCE cerrado; UNIÓN cerrada en la segunda vuelta, supervisor 2026-09-26,
  // MATERIAL) — `universo.base` («carga comercial alta») y `universo.union` recortan las figs IGUAL que `bodega`:
  // el conjunto lo calcula el Core, con la MISMA primitiva que el Notario usa para verificar la premisa que
  // declara ese mismo cohorte (`conjuntoDeUniverso`, sobre `datoProyectado.conjuntos` — nunca una segunda
  // definición). Se resuelven JUNTOS en UNA sola llamada porque así compone la primitiva
  // (`notario/verificar.js:_conjuntoTipado`): `union` es una operación ADITIVA sobre lo que YA restringieron
  // `base`/`estados`/`no_estados`/`filtros` — resolverla sola, sin las restricciones que la acompañan, no
  // restringe nada (sin punto de partida previo, el código arranca del eje ENTERO y unir cualquier cosa a
  // «todos» sigue siendo «todos»). `estados`/`no_estados`/`filtros` viajan en la misma llamada por si algún
  // llamador futuro los declara junto con `union` — HOY nunca llegan poblados a `figsEnAlcance` (`_planCifraGrupo`,
  // componer.js, ya descarta esa combinación antes de llamar acá vía `_universoNoSoportado`), así que incluirlos
  // es inerte para el camino actual y correcto para el que no lo es. Antes, `base`/`union` figuraban en
  // `_CAMPOS_MANEJADOS` (candado de completitud arriba) sin que ningún código los aplicara: una `cifra` acotada a
  // la base o a una unión servía el eje entero. Solo corre con `indice` (mismo criterio que bodega): sin él, esta
  // mitad del recorte no corre, documentado, nunca silencioso. `dentroDelUniverso === null` significa «ni base ni
  // union se declararon, o no se pudo resolver contra la evidencia» — nunca se excluye a ciegas por no poder
  // resolverla.
  const camposDeclarados = {};
  if (alcance && alcance.base) camposDeclarados.base = alcance.base;
  if (alcance && alcance.estados) camposDeclarados.estados = alcance.estados;
  if (alcance && alcance.no_estados) camposDeclarados.no_estados = alcance.no_estados;
  if (alcance && alcance.filtros) camposDeclarados.filtros = alcance.filtros;
  if (alcance && alcance.union && alcance.union.length) camposDeclarados.union = alcance.union;
  let dentroDelUniverso = null;
  if (Object.keys(camposDeclarados).length && indice) {
    try {
      const B = conjuntoDeUniverso({ eje: alcance.eje || null, ...camposDeclarados }, indice, alcance.eje || null, "");
      if (B && B.set) {
        dentroDelUniverso = new Set();
        for (const k of B.set) { const ent = indice.entidades && indice.entidades.get ? indice.entidades.get(k) : null; dentroDelUniverso.add(_norm(ent ? ent.nombre : k)); }
      }
    } catch { dentroDelUniverso = null; }
  }
  if (!excluidas.size && !miembrosDeOtroEje.length && !fueraDeBodega.size && !dentroDelUniverso) return figs;
  return figs.filter((f) => {
    const ent = entidadDeLabel(f && f.label);
    if (!ent) return true;
    const entN = _norm(ent);
    if (excluidas.has(entN)) return false;
    for (const otro of miembrosDeOtroEje) { if (otro.has(entN)) return false; }
    if (fueraDeBodega.has(entN)) return false;
    if (dentroDelUniverso && !dentroDelUniverso.has(entN)) return false;
    return true;
  });
}

/** recortarATop(ordenados, top) → { enFoco, cola } — «un top-N declara su cola» (CLAUDE.md §5), nunca reparte
 *  cifra propia a la cola completa (RC-D: `cobranza` vía `mesaFlujo`/`diagnose`/`rolesCartera` no aceptan `limit`,
 *  así que sin este recorte la cola entera recibía fila propia en la tabla de Cifras aunque la ORACIÓN ya
 *  declarara solo el top-k). `ordenados` YA tiene que venir ordenado por el criterio del compositor (mayor a
 *  menor o al revés, según `top.direccion`) — este helper solo trunca, no ordena. Idempotente: si `ordenados` ya
 *  viene recortado a `top.k` (una tool que sí soporta `limit`), no cambia nada. */
export function recortarATop(ordenados, top) {
  if (!top || !Number.isFinite(top.k) || top.k <= 0 || !Array.isArray(ordenados) || ordenados.length <= top.k) {
    return { enFoco: ordenados || [], cola: [] };
  }
  return { enFoco: ordenados.slice(0, top.k), cola: ordenados.slice(top.k) };
}
