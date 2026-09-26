/* === src/adi/entrega/alcance.js · EL ALCANCE DE UNA PARTE, EN UN SOLO PUNTO ═══════════════════════════════════
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

const _norm = (s) => String(s || "").trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

/** alcanceDeParte(parte) → { eje, excluir:[nombre,...], top, estados, no_estados, filtros, entidadesNombradas, periodo }
 *  `parte` es una `ParteResuelta` (`encargo/validar.js`) o el resumen equivalente que ya usa `iniciativa.js`
 *  (`{ tema, cierre, conceptos, entidades, universo, eje? }`) — ambos formatos traen los mismos campos con el
 *  mismo nombre, así que una sola función sirve a los dos llamadores. */
export function alcanceDeParte(parte) {
  if (!parte) return { eje: null, excluir: [], top: null, estados: null, no_estados: null, filtros: null, entidadesNombradas: [], periodo: null };
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
    excluir,
    top,
    estados: (u && Array.isArray(u.estados) && u.estados.length) ? u.estados : null,
    no_estados: (u && Array.isArray(u.no_estados) && u.no_estados.length) ? u.no_estados : null,
    filtros: (u && Array.isArray(u.filtros) && u.filtros.length) ? u.filtros : null,
    entidadesNombradas: (parte.entidades || []).map((e) => e && e.nombre).filter(Boolean),
    periodo: parte.periodo || null,
  };
}

const _entidadDeLabelDefault = (label) => { const p = String(label || "").split("·").map((s) => s.trim()); return p.length >= 2 ? p[0] : null; };

/** figsEnAlcance(figs, alcance, { ejesDelTenant, entidadDeLabel }) → figs recortadas al alcance declarado:
 *   (a) R2 — retira las figs cuya entidad está en `alcance.excluir` (nunca vuelve la entidad que el usuario excluyó);
 *   (b) RC-F — si `alcance.eje` está declarado y `ejesDelTenant` distingue ejes, retira las figs cuya entidad
 *       pertenece a OTRO eje conocido (nunca mezcla un SKU en un ranking de bodega, ni una bodega en uno de marca).
 *  Una fig SIN entidad reconocible en el rótulo (totales, benchmark, «Saldo vencido · total»…) nunca se filtra a
 *  ciegas — solo se recorta lo que SÍ se pudo identificar como perteneciente a otro alcance. NO trunca por `top`
 *  (ver `recortarATop`, abajo): ese recorte exige el ORDEN por la métrica del top, que decide cada compositor. */
export function figsEnAlcance(figs, alcance, { ejesDelTenant = {}, entidadDeLabel = _entidadDeLabelDefault } = {}) {
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
  if (!excluidas.size && !miembrosDeOtroEje.length) return figs;
  return figs.filter((f) => {
    const ent = entidadDeLabel(f && f.label);
    if (!ent) return true;
    const entN = _norm(ent);
    if (excluidas.has(entN)) return false;
    for (const otro of miembrosDeOtroEje) { if (otro.has(entN)) return false; }
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
