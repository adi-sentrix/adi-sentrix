/* === src/adi/entrega/iniciativa.js · LA INICIATIVA DE CFO (Corte 3d.1, `_ADI_DISENO_CORTE_3D.md` §A) ═══════════
 * «Lo que un controller miraría antes de responder, aunque el encargo no lo pidió» — hechos que el Core ya sabe
 * calcular, agregados a la Entrega SIN que ninguna parte del encargo los haya pedido. Candado central (§A.6): con
 * la iniciativa encendida o apagada, LO PEDIDO queda byte-idéntico — mismos ids `e*`, mismos renders, misma
 * oración de prioridad, mismos límites y universos pedidos. Este archivo NUNCA toca `hechos`/`contador`/`libro`
 * del pedido: declara su PROPIO libro de hechos, con su PROPIO prefijo de id (`i1..im`, asignados después de
 * todos los `e*` — nunca comparten contador), verificado aparte (`libroDeHechos`, el MISMO verificador que ya usa
 * el pedido — nunca una segunda verdad). Un hecho de iniciativa que no verifica NO se sirve y NO tumba la
 * Entrega — se declara en `entrega.detalle.iniciativaNoVerificada` (§B.3 adelantado solo en este campo; el resto
 * de "tamaño gobernado" es el corte 3d.3, fuera de este encargo).
 *
 * SOLO corre desde el camino GENERAL de `componerEntrega(resolucion)` — las 4 rutas fijas (`_delegarRutaCanonica`)
 * NUNCA la ejercitan: no importan este archivo. Byte a byte, `_entrega_gate` (363) queda intacto.
 *
 * ALCANCE DE ESTE CORTE (reportado al supervisor, no una decisión de significado — una decisión de ALCANCE del
 * arquitecto, por el tamaño del catálogo completo del diseño):
 *   · IMPLEMENTADO — sin llamadas ➕ nuevas, sobre los `figs` que el encargo YA cargó (`pasosDeDominios`/
 *     `pasosDelContratoComercial`, corridos por `lecturasDe.js` para el/los tema(s) del encargo):
 *       comercial   → partición-brecha · participación-líder · vs-benchmark (por entidad nombrada)
 *       cobranza    → participación-vencido · por-vencer · recuperado
 *       inventario  → participación-frenado
 *       cruce       → integrada (prioridadIntegrada entre ≥2 temas, cuando el pedido no la calculó ya —
 *                     evita duplicar lo que `_planMultiTema` ya sirve para partes lectura/decision sin entidad)
 *   · NO IMPLEMENTADO en este corte (documentado, no silenciado):
 *       - las entradas marcadas ➕ en el diseño (`variación-anterior` vía salesRead vs_anterior, `frenado-y-vende`
 *         vía tensionRead/top_sellers): exigen una llamada adicional al Core con presupuesto propio
 *         (`INICIATIVA_CALLS_MAX`), orquestada junto al plan del encargo — no se construyó acá; la constante
 *         queda declarada (siempre en 0 de 3 usadas) para cuando se implemente sin tener que tocar el candado.
 *       - `carga-vs-resto` (CAU-01) y `exposición-vs-participación` (PRI-04) del catálogo del diseño: HOY esas
 *         dos piezas de Business Knowledge ya se sirven como bloque PRINCIPAL en «Referencia del oficio» cuando
 *         su tema es el del encargo (corte 3d.2, `conocimiento/seleccionar.js:_resolverBloqueOMencion`) — que es
 *         el mismo resultado sustantivo (PRI-04 principal en cobranza, CAU-01 principal en comercial) por un
 *         camino ya construido. Puentear ese texto DENTRO del libro de iniciativa (con sus propios ids `i*`)
 *         duplicaría la verificación entre dos libros distintos sin necesidad; se deja para cuando el owner
 *         decida que el puente vale la complejidad.
 *       - `señales-otro-dominio` (mención breve en OTRO dominio sobre una entidad nombrada por el usuario): exige
 *         una llamada ➕ a un dominio que el encargo no pidió — mismo motivo que las entradas ➕ de arriba.
 *       - `prioridad-comercial`: para partes comercial `lectura`/`decision` SIN entidad, `_planMultiTema` YA sirve
 *         "Prioridad del procedimiento"/"Quien más pesa" — agregar esta entrada sería la MISMA oración dos veces.
 *       - `antigüedad-vencido` (CAU-03 como límite): el propio diseño lo deja como decisión abierta para el owner
 *         (§C, decisión 3 — «¿entra como ausencia del Core sin firmar la pieza, o espera la firma?»); no se
 *         resuelve acá.
 *   Nada de esto reduce lo firmado en A.1-A.6: los candados de proporcionalidad, ids, marca visible y byte-
 *   identidad de lo pedido se cumplen sobre el subconjunto implementado.
 *
 * Puro (salvo lectura de figs/índice que el llamador ya construyó). Sin red, sin estado global. */
import { lecturaDeMargen, prioridadDe } from "../agente/playbooks/margenEnRiesgo.js";
import { prioridadIntegrada, LENTES } from "../agente/prioridadIntegrada.js";
import { sujetoDeTema } from "../encargo/esquema.js";
import { alcanceDeParte } from "./alcance.js";

const _lab = (f) => String((f && f.label) || "");
const _find = (figs, re) => (Array.isArray(figs) ? figs : []).find((f) => re.test(_lab(f))) || null;
const _all = (figs, re) => (Array.isArray(figs) ? figs : []).filter((f) => re.test(_lab(f)));
const _esc = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const _entidadDe = (label) => { const p = String(label || "").split("·").map((s) => s.trim()); return p.length >= 2 ? p[0] : null; };

/* ── el catálogo (§A.1 del diseño) — DATOS, para que el gate y el owner lean qué existe y qué no corre todavía.
 * `activo:false` marca las entradas del diseño que este corte NO ejecuta (ver la cabecera) — el gate las lista
 * como catálogo declarado sin exigirles corrida. ── */
export const INICIATIVA = Object.freeze({
  comercial: [
    { id: "particion-brecha", activo: true, hecho: "ref total · ref carga alta total · derivada diferencia", de: "diagnose (descomposicionDeBrecha)", cuando: "hay ≥1 cuenta bajo benchmark (totales presentes en la boleta)" },
    { id: "participacion-lider", activo: true, hecho: "razon pct (líder ÷ total no capturada)", de: "diagnose", cuando: "≥2 cuentas en juego" },
    { id: "vs-benchmark", activo: true, hecho: "derivada pp (margen − benchmark)", de: "diagnose/marginRead", cuando: "entidad nombrada con margen y benchmark en la boleta" },
    { id: "variacion-anterior", activo: false, hecho: "ref (variacion)", de: "salesRead vs_anterior ➕", cuando: "entidad nombrada, eje ≠ sku — NO IMPLEMENTADO (llamada ➕)" },
    { id: "carga-vs-resto", activo: false, hecho: "CAU-01 (medir.js:cargaCuentaVsResto)", de: "Knowledge (solo firmada)", cuando: "cuenta bajo benchmark — servido HOY por el bloque principal de Referencia del oficio (corte 3d.2), no puenteado a este libro" },
    { id: "prioridad-comercial", activo: false, hecho: "orden top-1 por no_capturada (prioridadDe)", de: "diagnose", cuando: "cierre lectura/decision — YA servido por _planMultiTema, se omite para no duplicar la oración" },
  ],
  cobranza: [
    { id: "participacion-vencido", activo: true, hecho: "razon pct (vencido ÷ vencido total)", de: "cobranza", cuando: "≥2 cuentas con vencido" },
    { id: "por-vencer", activo: true, hecho: "derivada diferencia (pendiente − vencido)", de: "cobranza", cuando: "cuenta con pendiente y vencido en la boleta" },
    { id: "recuperado", activo: true, hecho: "razon pct (abonado ÷ venta a crédito)", de: "cobranza", cuando: "abonado y venta a crédito totales en la boleta" },
    { id: "exposicion-vs-participacion", activo: false, hecho: "PRI-04 (pisoMaterialidadCobranza)", de: "Knowledge (firmada)", cuando: "servido HOY por el bloque principal de Referencia del oficio (corte 3d.2), no puenteado a este libro" },
    { id: "antiguedad-vencido", activo: false, hecho: "AUSENCIA (CAU-03 marcador → límite, sin cifra)", de: "—", cuando: "decisión abierta del owner (§C, decisión 3) — no resuelta acá" },
  ],
  inventario: [
    { id: "participacion-frenado", activo: true, hecho: "razon pct (capital inmovilizado crítico SKU ÷ capital inmovilizado crítico total)", de: "inventoryStatus frenado", cuando: "≥2 SKU inmovilizados críticos" },
    { id: "frenado-y-vende", activo: false, hecho: "grupo/conteo (SKU en frenado ∩ top_sellers)", de: "_INV_CRUCE ➕", cuando: "NO IMPLEMENTADO (llamada ➕, tensionRead/top_sellers)" },
  ],
  cruce: [
    { id: "senales-otro-dominio", activo: false, hecho: "ref de materialidad/severidad/urgencia (LENTES)", de: "cobranza|diagnose ➕", cuando: "NO IMPLEMENTADO (llamada ➕ a un dominio no pedido)" },
    { id: "integrada", activo: true, hecho: "prioridadIntegrada", de: "—", cuando: "≥2 temas del encargo, sin que el pedido ya haya servido la integrada (_planMultiTema)" },
  ],
});

export const INICIATIVA_CALLS_MAX = 3;   // §A.2(b) — tope de llamadas ➕; hoy siempre 0 de 3 usadas (ninguna implementada)
/* la frase visible de la marca (owner/supervisor, encargo 2026-09-25): UNA constante de texto de la casa, para
 * que el owner pueda cambiarla sin tocar el resto del compositor ni del gate. */
export const MARCA_INICIATIVA = "Además, revisé lo que un controller miraría antes de responder:";
export const INICIATIVA_VALORES = ["completa", "ninguna"];

/* ── el libro de hechos de la iniciativa: prefijo `i`, contador PROPIO — nunca comparte namespace con `e*` del
 * pedido (§A.5.2: "asignados DESPUÉS de todos los e*" — con prefijos distintos no hay colisión posible, y el
 * pedido queda intacto se ejecute o no esta capa). ── */
function _crearDeclaradores() {
  const hechos = [];
  const contador = { n: 0 };
  const ref = (fig) => { if (!fig || fig.id == null) return null; const id = `i${++contador.n}`; hechos.push({ id, tipo: "ref", de: fig.id }); return id; };
  const declararRazon = (idNum, idDen) => { if (idNum == null || idDen == null) return null; const id = `i${++contador.n}`; hechos.push({ id, tipo: "razon", num: { id: idNum }, den: { id: idDen }, forma: "pct" }); return id; };
  const declararDerivada = (op, ids) => { if (!Array.isArray(ids) || ids.some((x) => x == null)) return null; const id = `i${++contador.n}`; hechos.push({ id, tipo: "derivada", op, de: ids.map((x) => ({ id: x })) }); return id; };
  return { hechos, contador, ref, declararRazon, declararDerivada };
}

/* ── COMERCIAL ── */
function _particionBrecha(figs, D) {
  const idTotal = D.ref(_find(figs, /^Contribuci[oó]n no capturada · subtotal/i));
  const idCargaTotal = D.ref(_find(figs, /^Carga comercial alta · subtotal/i));
  if (idTotal == null || idCargaTotal == null) return null;
  const idResto = D.declararDerivada("diferencia", [idTotal, idCargaTotal]);
  if (idResto == null) return null;
  return {
    catalogo: "particion-brecha", tema: "comercial", hechos: [idTotal, idCargaTotal, idResto],
    render: (R) => `De la brecha comercial total, ${R(idTotal)}, la carga comercial alta explica ${R(idCargaTotal)}; los ${R(idResto)} restantes son precio y costo, que los datos no separan.`,
  };
}
function _participacionLider(figs, D) {
  const pr = prioridadDe(figs);
  if (!pr || !pr.top || !Array.isArray(pr.juego) || pr.juego.length < 2) return null;
  const lect = lecturaDeMargen(figs);
  if (!lect.totalJuego) return null;
  const figTop = _find(figs, new RegExp(`^${_esc(pr.top.entidad)} · Contribuci[oó]n no capturada$`, "i"));
  const idTop = D.ref(figTop);
  const idTotal = D.ref(lect.totalJuego);
  if (idTop == null || idTotal == null) return null;
  const idShare = D.declararRazon(idTop, idTotal);
  if (idShare == null) return null;
  return {
    catalogo: "participacion-lider", tema: "comercial", hechos: [idTop, idTotal, idShare],
    render: (R) => `${pr.top.entidad} concentra el ${R(idShare)} de la contribución no capturada total (${R(idTotal)}).`,
  };
}
function _vsBenchmarkPara(entidad, figs, D) {
  const figMargen = _find(figs, new RegExp(`^${_esc(entidad)} · Margen$`, "i"));
  const figBench = _find(figs, /^Benchmark de margen$/i);
  if (!figMargen || !figBench) return null;
  const idMargen = D.ref(figMargen), idBench = D.ref(figBench);
  if (idMargen == null || idBench == null) return null;
  const idPp = D.declararDerivada("pp", [idMargen, idBench]);
  if (idPp == null) return null;
  return {
    catalogo: "vs-benchmark", tema: "comercial", entidad, hechos: [idMargen, idBench, idPp],
    render: (R) => `${entidad} tiene un margen de ${R(idMargen)} contra el benchmark de ${R(idBench)}: una diferencia de ${R(idPp)}.`,
  };
}

/* ── COBRANZA ── */
function _participacionVencido(figs, D) {
  const idTotal = D.ref(_find(figs, /^Saldo vencido · total$/i));
  if (idTotal == null) return null;
  const filas = _all(figs, /· Saldo vencido$/i).filter((f) => !/^Saldo vencido · total$/i.test(_lab(f)));
  const conRaw = filas.map((f) => ({ f, entidad: _entidadDe(_lab(f)), raw: Number.isFinite(f.raw) ? f.raw : null })).filter((x) => x.entidad && x.raw != null && x.raw > 0);
  if (conRaw.length < 2) return null;
  conRaw.sort((a, b) => b.raw - a.raw);
  const idTop = D.ref(conRaw[0].f);
  if (idTop == null) return null;
  const idShare = D.declararRazon(idTop, idTotal);
  if (idShare == null) return null;
  return {
    catalogo: "participacion-vencido", tema: "cobranza", hechos: [idTop, idTotal, idShare],
    render: (R) => `${conRaw[0].entidad} concentra el ${R(idShare)} del vencido total (${R(idTotal)}).`,
  };
}
function _porVencer(figs, D) {
  const filasSaldo = _all(figs, /· Saldo pendiente$/i);
  if (!filasSaldo.length) return null;
  // orden del módulo (mesaFlujo.js: vencido primero) — el primero de la lista ya es quien más debe, el mismo
  // criterio que usa `componerEntregaCobranza` para elegir el "top" de la ruta fija.
  const top = filasSaldo[0];
  const entidad = _entidadDe(_lab(top));
  if (!entidad) return null;
  const figVencido = _find(figs, new RegExp(`^${_esc(entidad)} · Saldo vencido$`, "i"));
  if (!figVencido) return null;
  const idPendiente = D.ref(top), idVencido = D.ref(figVencido);
  if (idPendiente == null || idVencido == null) return null;
  const idPorVencer = D.declararDerivada("diferencia", [idPendiente, idVencido]);
  if (idPorVencer == null) return null;
  return {
    catalogo: "por-vencer", tema: "cobranza", hechos: [idPendiente, idVencido, idPorVencer],
    render: (R) => `De lo que ${entidad} tiene pendiente (${R(idPendiente)}), ${R(idPorVencer)} todavía no vence — el resto, ${R(idVencido)}, ya está vencido.`,
  };
}
function _recuperado(figs, D) {
  const idAbonado = D.ref(_find(figs, /^Abonado · total$/i));
  const idVenta = D.ref(_find(figs, /^Venta (?:a crédito del período|del período \(flujo\))$/i));
  if (idAbonado == null || idVenta == null) return null;
  const idPct = D.declararRazon(idAbonado, idVenta);
  if (idPct == null) return null;
  return {
    catalogo: "recuperado", tema: "cobranza", hechos: [idAbonado, idVenta, idPct],
    render: (R) => `De la venta a crédito del período (${R(idVenta)}), ya se recuperó ${R(idAbonado)}, el ${R(idPct)}.`,
  };
}

/* ── INVENTARIO ── */
// RECONOCEDOR TOLERANTE (owner 2026-09-28, §7.3·30-32): «Capital frenado» → «Capital inmovilizado crítico».
function _participacionFrenado(figs, D) {
  const idTotal = D.ref(_find(figs, /^Capital (?:frenado|inmovilizado cr[ií]tico) · total$/i));
  if (idTotal == null) return null;
  const filas = _all(figs, /· Capital (?:frenado|inmovilizado cr[ií]tico)$/i).filter((f) => !/^Capital (?:frenado|inmovilizado cr[ií]tico) · total$/i.test(_lab(f)));
  const conRaw = filas.map((f) => ({ f, entidad: _entidadDe(_lab(f)), raw: Number.isFinite(f.raw) ? f.raw : null })).filter((x) => x.entidad && x.raw != null && x.raw > 0);
  if (conRaw.length < 2) return null;
  conRaw.sort((a, b) => b.raw - a.raw);
  const idTop = D.ref(conRaw[0].f);
  if (idTop == null) return null;
  const idShare = D.declararRazon(idTop, idTotal);
  if (idShare == null) return null;
  return {
    catalogo: "participacion-frenado", tema: "inventario", hechos: [idTop, idTotal, idShare],
    render: (R) => `${conRaw[0].entidad} concentra el ${R(idShare)} del capital inmovilizado crítico total (${R(idTotal)}).`,
  };
}

/* ── CRUCE ── */
// RC4 (owner, diagnostico.md §RC4): `entidadesPermitidas` (Set|null) — cuando el encargo no trae ninguna parte
// "cartera entera" (todas nombran entidades específicas), el "top" que `prioridadIntegrada` calcule sobre TODA
// la cartera solo se sirve si es una de las entidades que el encargo nombró — nunca una cuenta ajena al alcance
// pedido. `null` (hay al menos una parte "cartera entera" real) no acota: cualquier top es una respuesta legítima.
function _integrada(figs, temas, D, entidadesPermitidas = null) {
  if (!Array.isArray(temas) || temas.length < 2) return null;
  let P = null;
  try { P = prioridadIntegrada(figs, temas); } catch { P = null; }
  const top = P && Array.isArray(P.integrada) ? P.integrada[0] : null;
  if (!top || !top.senales) return null;
  if (entidadesPermitidas && !entidadesPermitidas.has(top.entidad)) return null;
  const idsPorDominio = {};
  for (const dom of Object.keys(top.senales)) {
    const s = top.senales[dom];
    const rotulo = s && s.materialidad && s.materialidad.rotulo;
    if (!rotulo) continue;
    const fig = _find(figs, new RegExp(`^${_esc(top.entidad)} · ${_esc(rotulo)}$`, "i"));
    const id = D.ref(fig);
    if (id != null) idsPorDominio[dom] = id;
  }
  const doms = Object.keys(idsPorDominio);
  if (doms.length < 2) return null;   // hace falta señal citable en al menos dos dominios para que "integrada" aporte algo nuevo
  return {
    catalogo: "integrada", tema: "cruce", hechos: doms.map((d) => idsPorDominio[d]),
    render: (R) => `Mirando ${doms.join(" y ")} en conjunto, ${top.entidad} es quien más pesa (${doms.map((d) => `${d}: ${R(idsPorDominio[d])}`).join("; ")}).`,
  };
}

/** calcularIniciativa({ figs, partes, iniciativaOn, yaTieneIntegrada }) → { hechos, candidatos } — construye
 *  TODOS los candidatos aplicables sobre `figs` (los que la boleta ya sostiene) y los clasifica por NIVEL según
 *  la tabla de proporcionalidad (§A.2), CON GRANULARIDAD POR PARTE (no por tema): una entrada de la iniciativa
 *  que es AGREGADA DE CARTERA (partición-brecha, participación-líder, participación-vencido, por-vencer,
 *  recuperado, participación-frenado) solo se ofrece cuando el encargo trae una parte de ESE tema en `lectura`/
 *  `decision` SIN entidad (la lectura de "la cartera entera" — el mismo caso que las 4 rutas fijas cubren, nunca
 *  un grupo/filtro/top de `cifra`: ESE ya trae su propia tentación precalculada, `_cerrarGrupoUniverso`/
 *  `_planCifraGrupo` en `componer.js` — servir además una agregada de iniciativa sería una segunda tentación
 *  sobre el MISMO grupo, y puede citar "brecha"/"benchmark" sin que el Marco declare la referencia porque esa
 *  parte no corrió el contrato comercial completo — medido con D07 del catálogo de desarrollo). Una entrada POR
 *  ENTIDAD (vs-benchmark) solo se ofrece sobre una entidad que una parte comercial nombra de verdad (`cifra`
 *  con esa entidad, o `lectura`/`decision` con esa entidad) — nunca sobre una entidad ajena a lo pedido.
 *  `partes`: [{ tema, cierre, conceptos:number, entidades:[nombre,...] }] — el mismo resumen de `ParteResuelta`
 *  que ya usa el resto del compositor, sin reproyectar nada nuevo. Devuelve el libro CRUDO (sin verificar — el
 *  llamador corre `libroDeHechos` UNA vez sobre `hechos`, el mismo patrón que `libroPremisas` en `componer.js`).
 *  Nunca decide `iniciativaOn` por su cuenta: si viene `false`, devuelve listas vacías — el interruptor es del
 *  llamador (`resolucion.encargo.iniciativa`, §A.2c). */
export function calcularIniciativa({ figs, partes = [], iniciativaOn = true, yaTieneIntegrada = false } = {}) {
  const D = _crearDeclaradores();
  if (!iniciativaOn || !Array.isArray(figs) || !figs.length) return { hechos: D.hechos, candidatos: [] };

  const candidatos = [];
  const _partesDe = (tema) => partes.filter((p) => p.tema === tema);
  // «la cartera entera»: lectura/decision SIN entidad — el único caso donde una AGREGADA de cartera es del
  // mismo tipo de lectura que las 4 rutas fijas ya sirven de punta a punta (con el contrato comercial completo
  // corrido, así que el Marco ya trae su referencia si el texto la necesita).
  // RC4 (owner, diagnostico.md §RC4 — MATERIAL: entidad no pedida con cifra real fuera del alcance): sin
  // `entidades` NO alcanza para llamarla «cartera entera» — un `Parte.universo` declarado (ej. "clientes al
  // día") YA ES un recorte real de la cartera, aunque no nombre entidades una por una. Sin este chequeo, una
  // parte con universo restringido disparaba una agregada sobre TODA la cartera y nombraba a quien más pesa
  // ahí (p.ej. un moroso dentro de "quién está al día"), una entidad que el propio recorte excluye por
  // definición — nunca autorizado por la cabecera de la iniciativa («SIN que ninguna parte del encargo los haya
  // pedido» habla de MÉTRICAS no pedidas del MISMO alcance, no de entidades ajenas al alcance).
  // R1 (diagnóstico v2, supervisor 2026-09-26 — MATERIAL: entidad NO pedida con cifra real, sustituyendo el
  // alcance que el usuario sí declaró): este chequeo ya distinguía «con universo» de «cartera entera» (RC4 del
  // diagnóstico v1), pero nunca miraba el EJE — una parte "léeme el negocio por marca" (sin entidades, sin
  // universo, eje explícito "marca") seguía contando como «cartera entera», así que la agregada de CLIENTE
  // (partición de la brecha, participación del líder) se calculaba sobre TODOS los clientes y nombraba a uno
  // (Falabella) que el usuario ni pidió ni el eje pedido puede nombrar (una lectura por marca no tiene cliente
  // sujeto). Mismo criterio de «eje explícito» que ya usan `encargo/lecturasDe.js`/`entrega/componer.js`
  // (`alcanceDeParte`, `entrega/alcance.js` — la MISMA derivación del alcance en un solo punto): con un eje
  // declarado DISTINTO del sujeto por defecto del tema, esto YA NO es «la cartera entera» del sujeto de siempre.
  const _tieneLecturaDeCarteraEntera = (tema) => _partesDe(tema).some((p) => {
    if (!((p.cierre === "lectura" || p.cierre === "decision") && !(p.entidades && p.entidades.length) && !p.universo)) return false;
    const alcance = alcanceDeParte(p);
    return !(alcance.eje && alcance.eje !== sujetoDeTema(tema));
  });

  // COMERCIAL — solo si el encargo tocó comercial (nunca un tema no pedido, ley §A.2a)
  if (_tieneLecturaDeCarteraEntera("comercial")) {
    const pb = _particionBrecha(figs, D); if (pb) candidatos.push({ ...pb, nivel: "principal" });
    const pl = _participacionLider(figs, D); if (pl) candidatos.push({ ...pl, nivel: "principal" });
  }
  {
    // vs-benchmark: por cada entidad que una parte COMERCIAL nombra de verdad (nunca una entidad ajena al
    // encargo) — §A.2: `lectura`/`decision` con esa entidad ⇒ principal; `cifra` con ≥2 conceptos ⇒ principal
    // (tope 2 del mismo tema); `cifra` con 1 concepto ⇒ oferta.
    let usados = 0;
    for (const p of _partesDe("comercial")) {
      if (!p.entidades || !p.entidades.length) continue;
      const nivel = (p.cierre === "lectura" || p.cierre === "decision") ? "principal" : (p.conceptos >= 2 ? "principal" : "oferta");
      for (const entidad of p.entidades) {
        if (usados >= 2) break;   // §A.2: "≤ 2 hechos de iniciativa del MISMO tema"
        const vb = _vsBenchmarkPara(entidad, figs, D);
        if (vb) { candidatos.push({ ...vb, nivel }); usados++; }
      }
    }
  }

  // COBRANZA — mismo criterio: solo agregadas de "la cartera entera" (lectura/decision sin entidad)
  if (_tieneLecturaDeCarteraEntera("cobranza")) {
    const pv = _participacionVencido(figs, D); if (pv) candidatos.push({ ...pv, nivel: "principal" });
    const por = _porVencer(figs, D); if (por) candidatos.push({ ...por, nivel: "principal" });
    const rec = _recuperado(figs, D); if (rec) candidatos.push({ ...rec, nivel: "principal" });
  }

  // INVENTARIO — idem
  if (_tieneLecturaDeCarteraEntera("inventario")) {
    const pf = _participacionFrenado(figs, D); if (pf) candidatos.push({ ...pf, nivel: "principal" });
  }

  // CRUCE — solo si el encargo tocó ≥2 temas (nunca agrega un tema no pedido: usa temas YA presentes) Y el
  // pedido mismo no calculó ya la integrada (`_planMultiTema`, componer.js): evita servir la MISMA oración dos
  // veces cuando el encargo es "lectura/decision sin entidad" sobre ≥2 temas — ese camino ya la sirve como pedido.
  const temasDelEncargo = [...new Set(partes.map((p) => p.tema))];
  // RC4 (owner, diagnostico.md §RC4, disparador 2 · V20): el mismo defecto de fondo con otro gatillo — antes
  // corría con solo `temasDelEncargo.length>=2`, sin mirar si las partes traen entidades declaradas.
  // `_integrada` corre `prioridadIntegrada(figs, temas)` sobre TODA la cartera (sin acotarla) y nombra a quien
  // más pesa ahí — con TODAS las partes del encargo nombrando entidades específicas (nunca "cartera entera"),
  // ese "quien más pesa" puede ser una cuenta que el encargo nunca mencionó (V20: preguntó por Sodimac/Easy,
  // salió Lider). Cuando SÍ hay una parte "cartera entera" real, no hace falta acotar: nada se excluyó, así que
  // cualquier entidad que resulte "la que más pesa" es una respuesta legítima a "la cartera entera" (2b: ambas
  // partes nombran la MISMA entidad — Lider — y `_integrada` la sirve porque es justo la que se preguntó).
  const hayCarteraEnteraEnAlgunTema = temasDelEncargo.some((t) => _tieneLecturaDeCarteraEntera(t));
  const entidadesNombradas = hayCarteraEnteraEnAlgunTema ? null : new Set(partes.flatMap((p) => p.entidades || []));
  if (temasDelEncargo.length >= 2 && !yaTieneIntegrada) {
    const it = _integrada(figs, temasDelEncargo, D, entidadesNombradas);
    if (it) candidatos.push({ ...it, nivel: "principal" });
  }

  return { hechos: D.hechos, candidatos };
}
