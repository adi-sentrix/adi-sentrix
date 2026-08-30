/* === adi/sentrix/mesaCapital.js · MESA DE CONTROL · CARA CAPITAL (owner 2026-07-15: "ok, veamos cómo queda") ===
 * El estado de la SEGUNDA CARA de la Mesa: el mismo sello (entender→explicar→actuar) contando EL CAPITAL —
 * "el inventario está muy pobre en Sentrix y para el cliente es súper relevante" (owner). No es un módulo de dato
 * ([[adi-sentrix-estructura]]): es la misma mesa mirando otro capital, con los detectores de INVENTARIO existentes.
 *   - mapa: la tira de flujo del capital — los 4 estados del MOTOR (diagnoseInventario · POLICY 2x/120d · una
 *     verdad con el composer de inventario y el detector del diagnose) · los tramos SUMAN EXACTO el total.
 *   - kpis: capital total · detenido · quiebres próximos · rotación media — semáforo del dato (cero umbral nuevo).
 *   - focos: por qué pasa, con su $ (detenido · quiebre próximo · sobrestock — la dist del motor).
 *   - veredicto: la historia SELLADA por el owner (2026-08-08) — localiza dónde está el capital y dónde falta, y
 *     NUNCA afirma la venta perdida por quiebre: eso no está medido en este dato y queda abierto.
 *   - cortes: el MISMO capital por bodega y por familia, más el detalle por SKU. Los tres cierran con el total.
 *     ⚠️ La bodega LOCALIZA, no explica ni habilita transferencias (ningún SKU está en más de una).
 *   - reponer/liquidar: QUÉ HACER PRIMERO en dos listas, priorizadas con EVIDENCIA PROPIA DE CAPITAL — días de
 *     inventario y rotación para el quiebre, capital y última venta para el detenido. Sin una sola cifra de venta
 *     comercial: ver el porqué en el comentario del import.
 *   - limitaciones: lo que la cara no puede afirmar, dicho en la vista.
 *   - simulaciones: "¿y si libero…?" (el composer de simulate YA cuantifica) · "¿y si repongo…?" honesto (la
 *     reposición no se cuantifica en este pase — la línea pregunta y ADI responde con lo probado; venta-en-riesgo
 *     es pase 2, toca motor).
 *   - alertas: la pata de inventario del "En alerta" (SKU críticos · $ detenido).
 *   - "Qué cambió" NO existe acá: sin historial de stock no se fabrica (el bloque no aparece — honesto).
 * + buildCuadroCapital: la tabla HERMANA del cuadro (la de ventas NO se toca) — eje SKU/bodega con columnas
 *   legibles (Disponible · Valorizado · Rotación · Días inv. · Última venta · Estado · "En juego $" · Acción), microlectura
 *   solo con señal del detector, chip Acción con su pregunta. Comparado de 12 meses NO: no existe serie mensual de
 *   stock por SKU y la serie de venta NO la sustituye en silencio.
 * Cada tramo, KPI, foco, línea y chip lleva su PREGUNTA a ADI (anti-BI: nada mudo) — todas por _promise_gate.
 * Registro EJECUTIVO y lenguaje formal en todo texto emitido (_registro_gate · benchmark, no vara).
 * Puro · client-side · CERO cálculo nuevo (agrupar y formatear lo que el motor ya afirma) · motor sellado intacto. */
import { applyScenarioToSkuInventario } from "../../engine/scenarios.js";
import { diagnoseInventario, concentracion } from "../diagnosis/economicDiagnosis.js";
import { POLICY } from "../../config/businessPolicy.js";
import { rotacionPonderada } from "./headline.js";   // la ÚNICA rotación media del producto (ponderada por capital)
import { transferenciaCapability } from "./capability.js";   // la ÚNICA cuenta de "¿se puede evaluar transferir?"
// Solo para saber A QUIÉN le calza un producto detenido. De acá NO entra plata: ver `_compradoresDe`.
import { compradoresSku } from "../../data/clienteSkuMatrix.js";
import { simboloMoneda } from "../../config/moneda.js";
import { ESCENARIO_INICIAL } from "../../config/scenarios.js";   // colapso del eje: la base real se declara UNA vez
/* ⚠️ `skusMargen` NO SE IMPORTA ACÁ, Y ES A PROPÓSITO (owner 2026-08-08, decisión 7). El inventario y la venta
 * comercial no reconcilian en unidad, moneda ni período: `skusMargen.venta` viene en MILES ($100.0M anuales) y
 * `stockUSD` en dólares crudos ($135.000 de inventario); además las unidades vendidas que declara cada fuente
 * difieren entre 4x y 35x por SKU. Cualquier cruce produce una cifra falsa. No importarlo es el sello: lo que no
 * entra al módulo no se puede colar a un texto. Si algún día ambas fuentes se concilian, esto se revisa acá. */

const _r1 = (n) => Math.round(n * 10) / 10;
const _mean = (a, f) => (a.length ? a.reduce((s, x) => s + (typeof f(x) === "number" ? f(x) : 0), 0) / a.length : 0);
/* SE EXPORTA para que `pulsoInicio.js` no escriba una TERCERA copia de esta función (ya vive igual acá y en
 * mesa.js). Dos formateadores con la misma cara y distinto redondeo son cómo el mismo capital termina publicado
 * como $33K en una pantalla y $34K en la de al lado. */
export const _money = (v) => {
  const a = Math.abs(v), s = v < 0 ? "-" : "";
  if (a >= 1e6) return `${s}${simboloMoneda()}${(a / 1e6).toFixed(1)}M`;
  if (a >= 1e3) return `${s}${simboloMoneda()}${Math.round(a / 1e3)}K`;
  return `${s}${simboloMoneda()}${Math.round(a)}`;
};

// ── LOS 4 ESTADOS DEL MOTOR · label legible + color + su pregunta (todas gate-proven · la pregunta es del ESTADO,
// no de la fila: el composer de inventario responde la punta completa — ahí vive la historia) ──
export const CAPITAL_ESTADOS = {
  capital_sano:    { label: "en rango",        color: "green", ask: "Ver todo el inventario",
    def: "Rota dentro de tu benchmark (rotación sobre " + POLICY.rotacionMin + "x y menos de " + POLICY.dohMax + " días de inventario) — capital trabajando." },
  riesgo_quiebre:  { label: "quiebre próximo", color: "red",   ask: "¿Qué reponer por quiebre?",
    def: "Rota rápido (" + POLICY.quiebreRotMin + "x o más) y le quedan " + POLICY.quiebreDohMax + " días de inventario o menos: el stock no alcanza hasta la próxima compra." },
  sobrestock:      { label: "sobrestock",      color: "cyan",  ask: "¿Dónde sobra inventario?",
    def: "Vende, pero le quedan entre " + POLICY.sobrestockDohMin + " y " + POLICY.dohMax + " días de inventario: capital inmovilizado de más." },
  capital_frenado: { label: "inmovilizado",     color: "amber", ask: "¿Dónde está inmovilizado mi capital?",
    def: "Sin rotación según tu benchmark (rotación bajo " + POLICY.rotacionMin + "x o más de " + POLICY.dohMax + " días de inventario): capital que no trabaja." },
};
// LAS CUATRO ACCIONES PERMITIDAS, textuales del owner (2026-08-08, decisión 9) · una por estado y ninguna otra.
// El detenido dice EVALUAR una salida: que un SKU no rote no prueba que haya que rematarlo.
const ACCION_POR_ESTADO = {
  capital_frenado: "evaluar salida comercial", riesgo_quiebre: "revisar reposición",
  sobrestock: "frenar o ajustar reposición", capital_sano: "sostener",
};
const _ORDEN = ["capital_sano", "riesgo_quiebre", "sobrestock", "capital_frenado"];
const _RANK = { capital_frenado: 0, riesgo_quiebre: 1, sobrestock: 2, capital_sano: 3 };

// el diagnóstico del motor + el join con la alerta del dato (crítico) · la ÚNICA entrada de todo el módulo
function _diag(scenario) {
  const inv = applyScenarioToSkuInventario(scenario || ESCENARIO_INICIAL) || [];
  const D = diagnoseInventario(inv, {});
  const bySku = {}; for (const r of inv) bySku[r.sku] = r;
  return { inv, D, bySku };
}

/* buildMesaCapital(scenario) → { kpis, mapa, focos, reponer, liquidar, simulaciones, alertas } · todo formateado */
export function buildMesaCapital(scenario) {
  const { inv, D, bySku } = _diag(scenario);
  const dist = (e) => D.dist[e] || { usd: 0, count: 0, pct: 0 };
  const frenado = dist("capital_frenado"), quiebre = dist("riesgo_quiebre"), sobre = dist("sobrestock"), sano = dist("capital_sano");
  const criticos = D.perSku.filter((s) => s.estado === "capital_frenado" && bySku[s.sku] && bySku[s.sku].alerta === "crit").length;
  // LA ROTACIÓN MEDIA VIVE EN UN SOLO LUGAR (owner 2026-08-09, decisión 6 · hallazgo E): `_rotPond` era local de este
  // builder, así que la tabla de drill de más abajo —y la tool del oráculo— podían tener su propia idea de qué
  // significa "rotación media". Tenían: 6,0x acá y 5,8x ahí, con el mismo nombre y en la misma cara. Ahora la
  // implementación es única y la importan los dos lados (headline.js).
  const _rotPond = rotacionPonderada;
  const rotMedia = _rotPond(inv);

  // ── EL MAPA DEL CAPITAL · la tira de flujo (los tramos del motor suman EXACTO el total — el gate lo verifica) ──
  const tramos = _ORDEN.filter((e) => dist(e).usd > 0).map((e) => ({
    key: e, label: CAPITAL_ESTADOS[e].label, color: CAPITAL_ESTADOS[e].color,
    usd: dist(e).usd, usdFmt: _money(dist(e).usd), n: dist(e).count,
    pct: D.total ? (dist(e).usd / D.total) * 100 : 0,
    ask: CAPITAL_ESTADOS[e].ask, def: CAPITAL_ESTADOS[e].def,
  }));
  const _frase = { capital_sano: "trabajan en rango", riesgo_quiebre: "con quiebre próximo", sobrestock: "en sobrestock", capital_frenado: "inmovilizados" };
  const lectura = `De tus ${_money(D.total)} en inventario: ${tramos.map((t) => `${t.usdFmt} ${_frase[t.key]}`).join(" · ")}.`;
  const mapa = { totalUsd: D.total, totalFmt: _money(D.total), lectura, tramos };

  // ── KPIs DE LA CARA · semáforo del dato (los estados del motor — cero umbral nuevo) + su pregunta ──
  const kpis = [
    { key: "capital", label: "Capital total", value: _money(D.total),
      estado: !frenado.usd ? "verde" : criticos ? "rojo" : "ambar",
      linea: `${sano.pct}% en rango · ${inv.length} SKU en ${[...new Set(inv.map((r) => r.bodega))].length} bodegas`,
      ask: "Ver todo el inventario" },
    { key: "detenido", label: "Capital inmovilizado", value: _money(frenado.usd),
      estado: !frenado.usd ? "verde" : criticos ? "rojo" : "ambar",
      linea: frenado.usd ? `${frenado.count} SKU sin rotación${criticos ? ` · ${criticos} crítico${criticos > 1 ? "s" : ""}` : ""}` : "sin capital inmovilizado material",
      ask: frenado.usd ? "¿Dónde está inmovilizado mi capital?" : "Ver todo el inventario" },
    // ⚠️ EN LA MISMA UNIDAD QUE SUS HERMANAS (owner 2026-08-09). Antes el titular era "3 SKU" mientras las otras
    // tres decían plata: cuatro cards que se leen juntas y no se podían comparar — y la cifra más grande de la
    // pantalla ($36K en riesgo, MÁS que los $33K detenidos) quedaba escondida detrás de un conteo.
    { key: "quiebres", label: "Quiebres próximos", value: _money(quiebre.usd),
      estado: !quiebre.count ? "verde" : D.quiebreMaterial ? "rojo" : "ambar",
      linea: quiebre.count ? `${quiebre.count} SKU rotan rápido y con pocos días de inventario` : "sin quiebres a la vista",
      ask: quiebre.count ? "¿Qué reponer por quiebre?" : "Ver todo el inventario" },
    // la ask cuenta LO MISMO que la línea (auditoría de asks 2026-07-15: preguntaba los SKU sin venta +90d —
    // 2 SKU/$22K — mientras la línea habla del criterio de DETENCIÓN — 3 SKU/$33K: dos cifras para un click)
    { key: "rotacion", label: "Rotación media", value: `${rotMedia.toFixed(1)}x`,
      estado: rotMedia >= POLICY.rotacionMin ? "verde" : "rojo",
      linea: `ponderada por capital · benchmark ${POLICY.rotacionMin}x — por debajo, el capital se considera inmovilizado`,
      ask: frenado.usd ? "¿Dónde está inmovilizado mi capital?" : "Ver todo el inventario" },
  ];

  // ── 02 · POR QUÉ PASA · los focos de capital con su $ (la dist del motor · solo los materiales) ──
  const focos = [];
  if (frenado.usd) focos.push({ key: "detenido", usdFmt: _money(frenado.usd), label: `inmovilizado en ${frenado.count} SKU sin rotación`, ask: "Por qué el capital está inmovilizado" });
  if (quiebre.usd) focos.push({ key: "quiebre", usdFmt: _money(quiebre.usd), label: `en ${quiebre.count} SKU con quiebre próximo`, ask: "¿Qué reponer por quiebre?" });
  if (sobre.usd) focos.push({ key: "sobrestock", usdFmt: _money(sobre.usd), label: `en sobrestock · demasiados días de inventario`, ask: "¿Dónde sobra inventario?" });

  /* ── 03 · QUÉ HACER PRIMERO · dos listas accionables ───────────────────────────────────────────────────────
   * ⚠️ SIN UNA SOLA CIFRA DE VENTA COMERCIAL (owner 2026-08-08, decisión 7). Hasta acá esta lista ordenaba por
   * `skusMargen.venta` y mostraba "vende $12.3M al año · 15d de cobertura" al lado de "$14K detenidos". Son dos
   * universos que el dataset NO reconcilia: `skusMargen.venta` viene en MILES (la escala comercial, $100.0M de
   * venta anual) y `stockUSD` en dólares crudos ($135.000 de inventario) — y peor, las unidades vendidas que
   * declara cada fuente difieren entre 4x y 35x por SKU. Un SKU que vendiera $12.3M al año no puede tener $11K de
   * stock con 15 días de inventario. La cifra era falsa y estaba a la vista.
   *
   * La prioridad ahora sale de EVIDENCIA PROPIA DE CAPITAL, que es la única conmensurable consigo misma: rotación,
   * días de inventario, stock disponible, valorización y última venta. El import de `skusMargen` se eliminó del
   * módulo entero — es el sello más fuerte: lo que no se importa no se puede colar. */
  const TOPE = 5;   // decisión 6 del owner: máximo 5 por lista, el resto detrás de "ver todos"
  const _fila = (s) => ({ sku: s.sku, bodega: s.bodega, capital: s.capital, capitalFmt: _money(s.capital),
    rotacion: _r1(s.rotacion), rotacionFmt: `${_r1(s.rotacion)}x`, doh: Math.round(s.doh), dohFmt: `${Math.round(s.doh)}d`,
    stockUnd: (bySku[s.sku] || {}).stockUnd ?? null,
    diasSinVenta: typeof s.diasSinVenta === "number" ? s.diasSinVenta : null,
    critico: !!(bySku[s.sku] && bySku[s.sku].alerta === "crit") });
  // QUIEBRE PRÓXIMO · ordenado por urgencia real: menos días de inventario primero. Es el que se queda sin stock
  // antes, y eso lo dice su propio dato — no la venta de otra tabla.
  const _quiebreFilas = D.perSku.filter((s) => s.estado === "riesgo_quiebre").map(_fila)
    .sort((a, b) => a.doh - b.doh || b.capital - a.capital);
  const reponer = {
    titulo: "Proteger la venta", criterio: "Rotan rápido y les quedan pocos días de inventario.",
    accion: "Revisar reposición y abastecimiento.",
    n: _quiebreFilas.length, tope: Math.min(TOPE, _quiebreFilas.length), resto: Math.max(0, _quiebreFilas.length - TOPE),
    usd: quiebre.usd, usdFmt: _money(quiebre.usd),
    filas: _quiebreFilas.map((f) => ({ ...f,
      linea: `${f.dohFmt} de inventario · rota ${f.rotacionFmt}${f.stockUnd != null ? ` · ${f.stockUnd} disponibles` : ""} · ${f.capitalFmt}`,
      ask: `Profundiza en ${f.sku}` })),
    ask: "¿Qué reponer por quiebre?",
  };
  // DETENIDO · ordenado por capital: lo que más plata inmoviliza primero.
  const _frenadoFilas = D.perSku.filter((s) => s.estado === "capital_frenado").map(_fila)
    .sort((a, b) => b.capital - a.capital);
  const liquidar = {
    titulo: "Recuperar liquidez", criterio: "No rotan según tu benchmark: el capital no trabaja.",
    accion: "Evaluar salida comercial.",
    n: _frenadoFilas.length, tope: Math.min(TOPE, _frenadoFilas.length), resto: Math.max(0, _frenadoFilas.length - TOPE),
    usd: frenado.usd, usdFmt: _money(frenado.usd),
    filas: _frenadoFilas.map((f) => ({ ...f,
      linea: `${f.capitalFmt} inmovilizados · rota ${f.rotacionFmt}${f.diasSinVenta ? ` · sin venta hace ${f.diasSinVenta}d` : ""}${f.critico ? " · crítico" : ""}`,
      ask: `¿Cómo libero el capital de ${f.sku}?` })),
    ask: "¿Qué SKU libero primero?",
  };

  // ── ¿Y SI…? · supuestos accionables (liberar YA lo cuantifica el composer de simulate · reponer es honesto:
  // la reposición no se proyecta en este pase — la pregunta abre lo probado del motor) ──
  const simulaciones = [];
  if (frenado.usd) simulaciones.push({
    key: "liberar", delta: _money(frenado.usd),
    texto: `Si liberas el capital inmovilizado, ${_money(frenado.usd)} de caja vuelven a trabajar.`,
    ask: "¿Qué pasa si libero el capital inmovilizado?",
  });
  if (quiebre.count) simulaciones.push({
    key: "reponer", delta: _money(quiebre.usd),
    texto: quiebre.count === 1
      ? `Si repones a tiempo, el SKU con quiebre próximo (${_money(quiebre.usd)}) no corta su venta.`
      : `Si repones a tiempo, los ${quiebre.count} SKU con quiebre próximo (${_money(quiebre.usd)}) no cortan su venta.`,
    ask: "¿Qué reponer por quiebre?",
  });

  /* ── EN ALERTA · la pata de inventario (SKU críticos · $ detenido) — para la tira compartida de la Mesa ──
   * EL CAMPO DICE QUÉ CAPITAL ES (owner 2026-08-09, decisión 6 · hallazgo E). Este monto se llamaba `usd`, el mismo
   * nombre genérico con que las filas del mapa nombran SU capital. En una fila eso no es ambiguo —la fila declara
   * de qué estado habla—, pero acá es un AGREGADO sin identidad de fila: leído por su nombre, "usd" dice «capital»
   * y el número es el capital INMOVILIZADO, no el total. Un lector automático que contraste esta cifra contra el
   * capital del inventario compara $33K contra $135K y los dos son correctos: el que miente es el nombre. */
  const alertas = {
    n: criticos, inmovilizado: frenado.usd, inmovilizadoFmt: _money(frenado.usd),
    linea: criticos
      ? `${criticos} SKU crítico${criticos > 1 ? "s" : ""} · ${_money(frenado.usd)} de capital inmovilizado`
      : frenado.usd ? `${_money(frenado.usd)} de capital inmovilizado · sin SKU críticos` : "Capital rotando en rango — sin alertas de inventario.",
    ask: frenado.usd ? "¿Dónde está inmovilizado mi capital?" : "Ver todo el inventario",
  };

  /* ── 01 · EL VEREDICTO · la historia SELLADA por el owner (2026-08-08, decisión 8) ──────────────────────────
   * LOCALIZA, nunca atribuye: dice dónde está el capital y dónde falta, y NO dice "por eso perdés ventas" — la
   * venta no realizada por quiebre no está medida en este dato y queda ABIERTA.
   * El titular es fijo cuando el dato da la señal (hay detenido Y hay quiebre a la vez); si no la da, la lectura
   * cae a su rama neutral en vez de forzar una conclusión que el dato no sostiene. */
  const _haySenal = frenado.usd > 0 && quiebre.count > 0;
  const _diasMin = _frenadoFilas.length ? Math.min(..._frenadoFilas.map((f) => f.diasSinVenta || 0)) : 0;
  const _dohMax = _quiebreFilas.length ? Math.max(..._quiebreFilas.map((f) => f.doh)) : 0;
  const _rotMin = _quiebreFilas.length ? Math.min(..._quiebreFilas.map((f) => f.rotacion)) : 0;
  const veredicto = _haySenal
    ? { tipo: "senal",
        titular: "Tu capital está donde no se vende, y escasea donde sí.",
        soporte: `${_money(frenado.usd)} llevan ${_diasMin} días o más sin venta. Al mismo tiempo, ${_money(quiebre.usd)} rotan sobre ${_rotMin}x y les quedan ${_dohMax} días de inventario o menos.`,
        cierre: "Primero protegé los SKU de alta salida; después frená compras o evaluá salida para los inmovilizados." }
    : frenado.usd
      ? { tipo: "senal", titular: "Hay capital que no está trabajando.",
          soporte: `${_money(frenado.usd)} (${frenado.pct}% del inventario) no rotan según tu benchmark. No hay SKU con quiebre próximo.`, cierre: null }
      : quiebre.count
        ? { tipo: "senal", titular: "El inventario rota, pero hay stock al límite.",
            soporte: `${_money(quiebre.usd)} rotan rápido y les quedan ${_dohMax} días de inventario o menos. No hay capital inmovilizado material.`, cierre: null }
        : { tipo: "neutral", titular: "El inventario está trabajando en rango.",
            soporte: `${sano.pct}% del capital rota dentro de tu benchmark, sin quiebres próximos ni capital inmovilizado.`, cierre: null };

  /* ── 02 · DÓNDE OCURRE · el MISMO capital por tres cortes, y los tres cierran ────────────────────────────────
   * Abre por BODEGA (owner, decisión 5: ahí está el patrón operativo más fuerte), con Familia como segunda vista
   * y SKU como detalle accionable.
   * ⚠️ LA BODEGA LOCALIZA, NO EXPLICA NI HABILITA TRANSFERENCIAS. Que el capital detenido se concentre en una
   * bodega no prueba que la bodega sea la causa; y como ningún SKU está en más de una, mover stock de una a otra
   * no es una acción que este dato pueda evaluar. Las dos cosas se declaran en la vista, sin volverlas el tema. */
  const _porEstado = (rs, totalUsd) => _ORDEN.filter((e) => rs.some((r) => r.estado === e)).map((e) => {
    const f = rs.filter((r) => r.estado === e), usd = f.reduce((a, r) => a + r.capital, 0);
    return { key: e, label: CAPITAL_ESTADOS[e].label, color: CAPITAL_ESTADOS[e].color,
      usd, usdFmt: _money(usd), n: f.length, pct: totalUsd ? Math.round((usd / totalUsd) * 100) : 0 };
  }).sort((a, b) => b.usd - a.usd);
  const _corte = (key, label, campo) => {
    const names = [...new Set(D.perSku.map((s) => s[campo]))];
    const filas = names.map((n) => {
      const rs = D.perSku.filter((s) => s[campo] === n);
      const usd = rs.reduce((a, r) => a + r.capital, 0);
      const tramos = _porEstado(rs, usd);
      const dom = tramos.find((t) => t.key !== "capital_sano") || tramos[0];
      return { nombre: n, usd, usdFmt: _money(usd), n: rs.length,
        pctTotal: D.total ? Math.round((usd / D.total) * 100) : 0, tramos,
        dominante: dom ? dom.key : null, dominanteLabel: dom ? dom.label : null, dominantePct: dom ? dom.pct : 0,
        ask: `¿Cuánto capital tengo en ${n}?` };
    }).sort((a, b) => b.usd - a.usd);
    const suma = filas.reduce((a, f) => a + f.usd, 0);
    /* ── LA REGLA 80/20 SOBRE EL CAPITAL (owner 2026-08-09) ──────────────────────────────────────────────────
     * Cuántas bodegas (o familias) concentran el 80% del capital. Con 4 la respuesta es casi trivial, pero con
     * 40 bodegas o 200 familias es LA pregunta — y el mismo motor de concentración que usa la cara Comercial
     * responde las dos, así que no se inventa un criterio nuevo. `enGrupo` marca las filas de la cabeza. */
    const conc = concentracion(filas.map((f) => ({ nombre: f.nombre, valor: f.usd })));
    const enGrupo = new Set(conc.entidades.map((e) => e.nombre));
    for (const f of filas) f.enGrupo = enGrupo.has(f.nombre);
    const cabeza = filas.filter((f) => f.enGrupo), cola = filas.filter((f) => !f.enGrupo);
    const usdCabeza = cabeza.reduce((a, f) => a + f.usd, 0);
    const pareto = {
      regla: conc.regla, n: conc.cantidadEntidades, cubrePct: conc.totalCubiertoPct,
      usdFmt: _money(usdCabeza), colaN: cola.length, colaUsdFmt: _money(suma - usdCabeza),
      // la frase se arma acá, no en la vista, y nombra los dos universos: cabeza y cola cierran con el total
      lectura: cola.length
        ? `${conc.cantidadEntidades} de ${filas.length} ${label.toLowerCase()} concentran el ${conc.totalCubiertoPct}% del capital (${_money(usdCabeza)}); ${cola.length === 1 ? "la otra queda" : `las otras ${cola.length} quedan`} con ${_money(suma - usdCabeza)}.`
        : `Hacen falta las ${filas.length} ${label.toLowerCase()} para juntar el ${conc.umbral * 100}% del capital: está repartido parejo.`,
    };
    return { key, label, filas, n: filas.length, suma, sumaFmt: _money(suma), reconcilia: suma === D.total, pareto };
  };
  /* ── EL EJE DE TIEMPO · el MISMO capital partido por "desde cuándo" (owner 2026-08-09) ──────────────────────
   * Es la partición ORTOGONAL a la de estados: las dos cubren el 100% del capital y se cruzan sin solaparse. Y es
   * lo que convierte "detenido" de una categoría en una URGENCIA — que algo lleve 90 días quieto no es lo mismo
   * que lleve 20, aunque el estado sea idéntico.
   *
   * ⚠️ SE LLAMA POR SU NOMBRE: son DÍAS SIN VENTA, no antigüedad en bodega. No hay fecha de recepción en el dato,
   * así que no se puede decir cuánto lleva el stock almacenado. Llamarlo "aging" sería la trampa de «cobertura».
   * ⚠️ Y NO ES UNA CAUSA: dice desde cuándo, no por qué. El por qué —obsolescencia, sobrecompra, temporada— sigue
   * declarado como lo que el dato no permite afirmar. */
  const _TRAMOS_EDAD = [[0, 30, "0–30 días"], [31, 60, "31–60 días"], [61, 90, "61–90 días"], [91, Infinity, "Más de 90 días"]];
  for (const s of D.perSku) {
    const d = typeof s.diasSinVenta === "number" ? s.diasSinVenta : 0;
    s._edad = (_TRAMOS_EDAD.find(([lo, hi]) => d >= lo && d <= hi) || _TRAMOS_EDAD[0])[2];
  }
  const _corteEdad = () => {
    const v = _corte("edad", "Días sin venta", "_edad");
    // el orden es CRONOLÓGICO, no por capital: el eje es el tiempo y leerlo desordenado no dice nada
    const rank = Object.fromEntries(_TRAMOS_EDAD.map(([, , l], i) => [l, i]));
    v.filas.sort((a, b) => rank[a.nombre] - rank[b.nombre]);
    for (const f of v.filas) f.enGrupo = false;   // el 80/20 no aplica a un eje de tiempo
    const viejo = v.filas.filter((f) => rank[f.nombre] >= 2).reduce((a, f) => a + f.usd, 0);
    v.pareto = { ...v.pareto,
      lectura: viejo
        ? `${_money(viejo)} llevan más de 60 días sin venderse — ${Math.round((viejo / D.total) * 100)}% de tu capital. La antigüedad dice desde cuándo, no por qué.`
        : `Ningún capital lleva más de 60 días sin venderse.` };
    return v;
  };
  const cortes = {
    porDefecto: "bodega",
    vistas: [_corte("bodega", "Bodegas", "bodega"), _corte("familia", "Familias", "familia"), _corteEdad()],
    // el detalle accionable por SKU: el mismo capital, fila por fila, con su estado
    detalle: D.perSku.map((s) => ({ nombre: s.sku, bodega: s.bodega, familia: s.familia,
      usd: s.capital, usdFmt: _money(s.capital), rotacionFmt: `${_r1(s.rotacion)}x`, dohFmt: `${Math.round(s.doh)}d`,
      diasSinVenta: typeof s.diasSinVenta === "number" ? s.diasSinVenta : null,
      estado: s.estado, estadoLabel: CAPITAL_ESTADOS[s.estado].label, estadoColor: CAPITAL_ESTADOS[s.estado].color,
      ask: `Profundiza en ${s.sku}` })).sort((a, b) => b.usd - a.usd),
    nota: "Los tres cortes reparten el mismo capital: cambia el eje, no el total. Ninguno explica la causa — la bodega dice dónde está y los días dicen desde cuándo no se mueve.",
  };

  /* ── LO QUE ESTA CARA NO PUEDE AFIRMAR, dicho en la vista ────────────────────────────────────────────────────
   * Se declaran, no se disimulan. La de transferencias va PRIMERA porque es la que el usuario va a esperar. */
  // LA CUENTA VIVE EN UN SOLO LADO (owner 2026-08-09, decisión 13). Esta cara DECLARA el límite y el ring de bodega
  // RETIRA la recomendación por el mismo hecho: si cada uno lo contara por su cuenta, el día que el dato cambie una
  // superficie se enteraría y la otra no — que es exactamente cómo la tarjeta "Rotar / transferir" terminó
  // recomendando lo que esta línea declara inevaluable.
  const _transf = transferenciaCapability(inv);
  const limitaciones = [
    _transf.motivo,
    "Sin historial de stock no se puede mostrar cómo evolucionó el capital ni anticipar qué se va a detener.",
    "La rotación es un valor declarado del dato: no se recalcula desde stock y unidades.",
    "Las sucursales del dato son bodegas —traen inventario, no venta—, así que no hay corte por punto de venta.",
  ];

  /* ── EL DETALLE DE CADA KPI · una tabla por card (owner 2026-08-09) ─────────────────────────────────────────
   * "Que cada card muestre lo que corresponda, y al hacer clic se vea una tabla." Cada KPI abre EL universo que
   * ese KPI cuenta — no el inventario entero cuatro veces.
   *
   * ⚠️ LOS DÍAS SON UN VALOR DECLARADO, NO UNA CUENTA. El owner pidió calcular "días para quiebre = stock ÷ venta
   * diaria". Se verificó: esa cuenta NO coincide con el `doh` del dato en 11 de las 13 filas (PHI-SHAVER9 daría
   * 21,5 y el dato dice 15). Y `doh` es el campo con el que el MOTOR decide qué está en quiebre. Mostrar la cuenta
   * al lado del estado sería poner dos números del mismo concepto en la misma tabla — el defecto que ya costó
   * caro. Se muestra el declarado, y la tabla dice que es declarado.
   *
   * ⚠️ LO QUE NO EXISTE NO SE INVENTA: lead time del proveedor, estado de la orden de compra y "causa sugerida"
   * (obsolescencia / sobrecompra / temporada) no están en el dato — y la causa no se puede inferir sin historial
   * de stock. Cada tabla DECLARA lo que le falta, que es justo lo que haría falta para completar su decisión. */
  const _pctInv = (usd) => (D.total ? Math.round((usd / D.total) * 100) : 0);
  /* ── A QUIÉN LE VENDÉS HOY LO QUE ESTÁ DETENIDO (owner 2026-08-09) ──────────────────────────────────────────
   * Responde la pregunta accionable —"¿a quién le ofrezco la salida?"— sin cruzar universos. Se toma SOLO el
   * reparto, se convierte a PARTICIPACIÓN y se descarta el monto en el acto: la venta viene en escala comercial y
   * el inventario en dólares crudos, así que un "$X" al lado de "$14K detenidos" se leería como que ese cliente
   * tiene $14K parados. Acá no sobrevive ni un peso de ese universo — solo nombres y porcentajes.
   *
   * ⚠️ Y VA COMO `indicado`, no como dato: la matriz cliente×SKU del set se CONSTRUYE por afinidad de marca y
   * familia (el propio módulo lo declara y se reemplaza por la matriz real cuando llegue el ERP). Es una
   * estimación de a quién le calza el producto, no una transacción observada. La vista lo dice. */
  const _compradoresDe = (sku) => {
    let lista = [];
    try { lista = compradoresSku(sku) || []; } catch { return null; }
    const tot = lista.reduce((a, x) => a + (x.value || 0), 0);
    if (!tot) return null;
    const filas = lista.map((x) => ({ nombre: x.name, pct: Math.round((x.value / tot) * 100) }))
      .filter((x) => x.pct >= 1).sort((a, b) => b.pct - a.pct);
    return { estatus: "indicado", n: filas.length,
      filas: filas.slice(0, 5).map((x) => ({ ...x, pctFmt: `${x.pct}%` })),
      resto: Math.max(0, filas.length - 5) };
  };
  const _filaDrill = (s) => {
    const r = bySku[s.sku] || {};
    return { sku: s.sku, bodega: s.bodega, familia: s.familia,
      estado: s.estado, estadoLabel: CAPITAL_ESTADOS[s.estado].label, estadoColor: CAPITAL_ESTADOS[s.estado].color,
      usd: s.capital, usdFmt: _money(s.capital), pctInv: _pctInv(s.capital),
      stockUnd: r.stockUnd ?? null, ventaDiaria: r.ventaDiaria ?? null,
      rotacion: _r1(s.rotacion), rotacionFmt: `${_r1(s.rotacion)}x`,
      doh: Math.round(s.doh), dohFmt: `${Math.round(s.doh)}d`,
      diasSinVenta: typeof s.diasSinVenta === "number" ? s.diasSinVenta : null,
      margenPct: typeof r.margenPct === "number" ? r.margenPct : null,
      margenFmt: typeof r.margenPct === "number" ? `${r.margenPct}%` : "—",
      critico: r.alerta === "crit",
      accion: ACCION_POR_ESTADO[s.estado],
      ask: `Profundiza en ${s.sku}`,
      // ALERTAS VISUALES (owner): el capital grande se destaca, y la urgencia real también
      destacar: s.capital > 5000, urgente: s.estado === "riesgo_quiebre" && Math.round(s.doh) < 5,
    };
  };
  const _COL = (key, label, align = "right", nota = null) => ({ key, label, align, nota });
  const _todas = D.perSku.map(_filaDrill);
  const drill = {
    capital: {
      key: "capital", titulo: "Todo el inventario", objetivo: "Dónde está concentrado tu capital y en qué estado.",
      columnas: [_COL("sku", "SKU", "left"), _COL("estado", "Estado", "left"), _COL("usd", "Valor inventario"),
        _COL("stockUnd", "Unidades"), _COL("rotacion", "Rotación", "right", "declarada"),
        _COL("doh", "Días inv.", "right", "declarado"), _COL("bodega", "Bodega", "left")],
      filas: [..._todas].sort((a, b) => b.usd - a.usd),   // Pareto: el capital primero
      orden: "de mayor a menor capital: arriba están los SKU que concentran tu inventario.",
      totalFmt: _money(D.total), n: _todas.length, faltan: [],
    },
    detenido: {
      key: "detenido", titulo: "Capital inmovilizado", objetivo: "Qué capital no está trabajando y desde cuándo.",
      // «nunca en dinero», no «nunca en plata»: la palabra está vetada en superficie (CLAUDE.md §4) y esta nota se
      // pinta bajo la tabla de compradores de la cara Capital. El punto que hace la frase —que los dos universos no
      // comparten unidad y por eso solo se muestra participación— queda idéntico.
      compradoresNota: "Quién compra hoy ese producto, por su peso en la venta del SKU. Es una ESTIMACIÓN por afinidad de marca y familia —no una transacción observada— y por eso va en participación, nunca en dinero: la venta y el inventario no se miden en la misma unidad.",
      columnas: [_COL("sku", "SKU", "left"), _COL("diasSinVenta", "Días sin venta"), _COL("usd", "Valor inmovilizado"),
        // «Margen inv.» y no «Margen» (owner 2026-08-10): este campo es skuInventario.margenPct, del universo de la
        // foto de inventario, y NO es el margen comercial que ADI cita para el mismo SKU (skusMargen.margen).
        // Difieren en 9 de 13 SKU, hasta 6pp (LG-AIR9000: 22% acá, 28% en la boleta), y con esa brecha el veredicto
        // material/no material contra el benchmark se da vuelta. Los dos universos NO reconcilian y no se los hace
        // reconciliar: se los distingue por nombre. La nota «del inventario» ya estaba, pero iba de subtítulo.
        _COL("margenPct", "Margen inv.", "right", "del inventario"), _COL("rotacion", "Rotación", "right", "declarada"),
        _COL("bodega", "Bodega", "left"), _COL("accion", "Acción", "left")],
      filas: _todas.filter((f) => f.estado === "capital_frenado")
        .sort((a, b) => (b.diasSinVenta || 0) - (a.diasSinVenta || 0))
        .map((f) => ({ ...f, compradores: _compradoresDe(f.sku) })),
      orden: "por días sin venta: primero lo que lleva más tiempo quieto.",
      totalFmt: _money(frenado.usd), n: frenado.count,
      faltan: [
        "Por qué se detuvo —obsolescencia, sobrecompra, temporada— no está en el dato y no se puede inferir sin historial de stock.",
        "Quiénes lo compraban y dejaron de comprar tampoco: no existe historia por cliente y producto, solo el total de cada cliente. Se enciende con el ERP, que trae la transacción con fecha.",
      ],
    },
    quiebres: {
      key: "quiebres", titulo: "Quiebres próximos", objetivo: "Qué se queda sin stock antes.",
      columnas: [_COL("sku", "SKU", "left"), _COL("doh", "Días inv.", "right", "declarado"),
        _COL("ventaDiaria", "Venta diaria", "right", "unidades"), _COL("stockUnd", "Stock actual"),
        _COL("rotacion", "Rotación", "right", "declarada"), _COL("usd", "Valor inventario"), _COL("bodega", "Bodega", "left")],
      filas: _todas.filter((f) => f.estado === "riesgo_quiebre").sort((a, b) => a.doh - b.doh),
      orden: "por días de inventario: primero el que se queda sin stock antes.",
      totalFmt: _money(quiebre.usd), n: quiebre.count,
      faltan: [
        "El lead time del proveedor no está en el dato: sin él no se puede decir cuáles se quiebran ANTES de que llegue la reposición, que es la pregunta que ordena esta lista.",
        "El estado de las órdenes de compra tampoco: no se sabe qué ya está pedido ni en tránsito.",
      ],
    },
    rotacion: {
      key: "rotacion", titulo: "Rotación por familia", objetivo: "Qué familias arrastran la rotación hacia abajo.",
      columnas: [_COL("familia", "Familia", "left"), _COL("rotacion", "Rotación", "right", "promedio de la familia"),
        _COL("benchmark", "Tu benchmark"), _COL("desvio", "Desviación"), _COL("usd", "Valor inventario"), _COL("stockUnd", "Unidades")],
      filas: [...new Set(D.perSku.map((s) => s.familia))].map((fam) => {
        const rs = _todas.filter((f) => f.familia === fam);
        const usd = rs.reduce((a, f) => a + f.usd, 0);
        const rot = _rotPond(rs.map((f) => ({ rotacion: f.rotacion, stockUSD: f.usd })));
        const desv = POLICY.rotacionMin ? Math.round(((rot - POLICY.rotacionMin) / POLICY.rotacionMin) * 100) : 0;
        return { familia: fam, sku: fam, n: rs.length,
          rotacion: rot, rotacionFmt: `${rot.toFixed(1)}x`,
          benchmark: POLICY.rotacionMin, benchmarkFmt: `${POLICY.rotacionMin}x`,
          desvio: desv, desvioFmt: `${desv >= 0 ? "+" : ""}${desv}%`, bajoBenchmark: rot < POLICY.rotacionMin,
          usd, usdFmt: _money(usd), pctInv: _pctInv(usd),
          stockUnd: rs.reduce((a, f) => a + (f.stockUnd || 0), 0),
          destacar: usd > 5000, ask: `¿Cuánto capital tengo en ${fam}?` };
      }).sort((a, b) => a.rotacion - b.rotacion),   // la peor rotación primero: es la que arrastra
      orden: "de menor a mayor rotación: arriba, las que más arrastran.",
      totalFmt: _money(D.total), n: [...new Set(D.perSku.map((s) => s.familia))].length,
      faltan: ["El benchmark es uno solo para todas las familias, el que declaraste. El dato no trae una meta por familia."],
    },
  };

  /* ── CAPITAL POR PRODUCTO, DE UN VISTAZO · barras horizontales por valorizado (owner 2026-08-09) ─────────────
   * Es la lectura más rápida que tiene la cara: sin ejes, ordenado de mayor a menor y con el monto al final de la
   * barra. La UNIDAD dentro de la barra agrega lo que ninguna otra vista muestra — que $11K en 140 unidades y
   * $13K en 18 son dos problemas de compra distintos (barato-muchos contra caro-pocos).
   *
   * ⚠️ LA BARRA MIDE CAPITAL, y por eso el monto va al final y las unidades adentro en tono menor: si el largo
   * fuera ambiguo, dos magnitudes en una misma forma se leerían mal. Todas las barras van del MISMO tono (el owner
   * pidió el gráfico de barras azules, y pintar cada una de su color rompe su regla: el color resalta, no decora).
   * El estado viaja en un punto de semáforo, con su LEYENDA — un punto de color sin clave es un código interno.
   * ⚠️ PENSADO PARA MILES: con 1.000 SKU una barra por SKU es ilegible, así que se dibujan las primeras y el
   * resto va agrupado en una barra propia — que sigue sumando el total. Nunca se corta en silencio. */
  const _TOPE_BARRAS = 10;
  const _vistaBarras = (key, label, filtro, nota) => {
    const rs = D.perSku.filter(filtro).map((s) => ({
      sku: s.sku, bodega: s.bodega, usd: s.capital, usdFmt: _money(s.capital),
      und: (bySku[s.sku] || {}).stockUnd ?? null,
      estado: s.estado, estadoLabel: CAPITAL_ESTADOS[s.estado].label, estadoColor: CAPITAL_ESTADOS[s.estado].color,
      ask: `Profundiza en ${s.sku}`,
    })).sort((a, b) => b.usd - a.usd);
    const total = rs.reduce((a, r) => a + r.usd, 0);
    const und = rs.reduce((a, r) => a + (r.und || 0), 0);
    const cabeza = rs.slice(0, _TOPE_BARRAS), cola = rs.slice(_TOPE_BARRAS);
    const usdCola = cola.reduce((a, r) => a + r.usd, 0);
    const max = cabeza.length ? cabeza[0].usd : 1;
    const barras = cabeza.map((r) => ({ ...r, anchoPct: Math.round((r.usd / max) * 100) }));
    if (cola.length) barras.push({ sku: `Otros ${cola.length}`, usd: usdCola, usdFmt: _money(usdCola),
      und: cola.reduce((a, r) => a + (r.und || 0), 0), anchoPct: Math.round((usdCola / max) * 100),
      estado: null, estadoLabel: null, estadoColor: "neutro", agrupado: true, ask: null });
    // LA LEYENDA DEL PUNTO · solo los estados que esta vista realmente contiene, en el orden del gráfico. Con los
    // cuatro fijos, la vista "Inmovilizado" mostraría tres claves que no aparecen en ninguna barra.
    const leyenda = [];
    for (const r of cabeza) if (!leyenda.some((l) => l.estado === r.estado))
      leyenda.push({ estado: r.estado, label: r.estadoLabel, color: r.estadoColor });
    return { key, label, n: rs.length, total, totalFmt: _money(total), und,
      barras, colaN: cola.length, nota, leyenda,
      lectura: cola.length
        ? `${_money(total)} en ${rs.length} SKU y ${und.toLocaleString("es-CL")} unidades. Se dibujan los ${_TOPE_BARRAS} de mayor valor; los otros ${cola.length} van agrupados en la última barra.`
        : `${_money(total)} en ${rs.length} SKU y ${und.toLocaleString("es-CL")} unidades.` };
  };
  const barras = {
    porDefecto: "general",
    vistas: [
      _vistaBarras("general", "Inventario general", () => true,
        "La barra mide capital; el número dentro son las unidades."),
      _vistaBarras("inmovilizado", "Inmovilizado", (s) => s.estado === "capital_frenado",
        "Solo el capital que no rota según tu benchmark — el mismo criterio del KPI de capital inmovilizado."),
    ],
  };

  return { veredicto, kpis, mapa, cortes, focos, reponer, liquidar, simulaciones, alertas, limitaciones, drill, barras,
    total: D.total, totalFmt: _money(D.total), n: D.perSku.length,
    nBodegas: [...new Set(D.perSku.map((s) => s.bodega))].length };
}

/* ── CUADRO DE CAPITAL · la tabla hermana (eje SKU/bodega · columnas clásicas legibles · el cuadro de ventas NO
 * se toca) — mismo patrón del cuadro comercial: Estado = el semáforo del MOTOR contra POLICY (2x/120d), "En juego $"
 * = el capital detenido que el detector afirma de esa fila, microlectura SOLO con señal, chip Acción con su pregunta.
 * SIN comparado de 12 meses: no existe serie mensual de stock por SKU (la serie de venta NO la sustituye). ── */
export const CUADRO_CAPITAL_EJES = [
  { key: "sku",    label: "SKU",     plural: "SKUs" },
  { key: "bodega", label: "Bodegas", plural: "bodegas" },
];
const COLS_CAPITAL = {
  sku: [
    { key: "stock", label: "Disponible", fmt: "int", sort: "desc" },
    { key: "capital", label: "Valorizado", fmt: "moneyk", sort: "desc", defKey: "Capital" },
    { key: "rotacion", label: "Rotación", fmt: "x", sort: "desc", defKey: "Rotación" },
    { key: "doh", label: "Días inv.", fmt: "d", sort: "asc", defKey: "DOH" },
    { key: "ultimaVenta", label: "Última venta", fmt: "texto", sort: "desc" },
    { key: "estado", label: "Estado", fmt: "estado" },
    { key: "enJuego", label: "En juego $", fmt: "usd", sort: "desc", adv: true },
    { key: "accion", label: "Acción", fmt: "accion" },
  ],
  bodega: [
    { key: "stock", label: "Disponible", fmt: "int", sort: "desc" },
    { key: "capital", label: "Valorizado", fmt: "moneyk", sort: "desc", defKey: "Capital" },
    { key: "rotacion", label: "Rotación", fmt: "x", sort: "desc", defKey: "Rotación" },
    { key: "criticos", label: "SKU crít.", fmt: "int", sort: "asc" },
    { key: "estado", label: "Estado", fmt: "estado" },
    { key: "enJuego", label: "En juego $", fmt: "usd", sort: "desc", adv: true },
    { key: "accion", label: "Acción", fmt: "accion" },
  ],
};

export function buildCuadroCapital(eje = "sku", scenario = ESCENARIO_INICIAL) {
  const { inv, D, bySku } = _diag(scenario);
  const estadoDe = {}; for (const s of D.perSku) estadoDe[s.sku] = s;
  let rows;
  if (eje === "bodega") {
    const names = [...new Set(inv.map((r) => r.bodega))];
    rows = names.map((b) => {
      const rs = inv.filter((r) => r.bodega === b);
      const det = rs.filter((r) => estadoDe[r.sku].estado === "capital_frenado");
      const detUsd = det.reduce((a, r) => a + r.stockUSD, 0);
      const crit = rs.filter((r) => r.alerta === "crit").length;
      // EL ESTADO DE LA BODEGA SALE DE SUS SKU (owner 2026-08-10). Antes esta rama tenía su PROPIA regla binaria
      // —crítico o capital detenido → capital_frenado, si no capital_sano— reutilizando LAS MISMAS CLAVES del enum
      // con otro predicado. Consecuencia medida: «quiebre próximo» y «sobrestock» eran inalcanzables por
      // construcción (0 ocurrencias en las 4 bodegas), justo los dos estados que cortan venta y atan caja de más; y
      // Santiago publicaba «en rango» en verde con $30.000 de sus $63.800 —el 47%— en quiebre próximo en el otro
      // eje. Además, cualquier consumidor que leyera `row.estado` obtenía un significado distinto según el eje.
      // Ahora la bodega hereda el PEOR estado presente entre sus SKU, con el mismo `_RANK` que ordena el eje SKU:
      // una sola clasificación, el mismo vocabulario, y el glosario (CONCEPT_DEFS.estado) vuelve a describirla.
      const estados = rs.map((r) => estadoDe[r.sku].estado);
      const est = estados.slice().sort((a, b2) => _RANK[a] - _RANK[b2])[0] || "capital_sano";
      const nEnEse = estados.filter((e) => e === est).length;
      const E = CAPITAL_ESTADOS[est];
      return {
        name: b, stock: rs.reduce((a, r) => a + r.stockUnd, 0), capital: rs.reduce((a, r) => a + r.stockUSD, 0),
        rotacion: _r1(_mean(rs, (r) => r.rotacion)), criticos: crit,
        estado: est, estadoRank: _RANK[est],
        // el conteo va en la etiqueta para que «el peor estado» no se lea como «toda la bodega está así». Los SKU
        // críticos siguen teniendo su propia columna («SKU crít.»): son un atributo del dato, no un estado del motor.
        estadoLabel: `${E.label} (${nEnEse} de ${rs.length} SKU)`,
        estadoColor: E.color,
        enJuego: detUsd || null, alert: crit > 0 || detUsd > 0,
        lectura: detUsd ? `${_money(detUsd)} inmovilizados en ${det.length} SKU sin rotación${crit ? ` · ${crit} crítico${crit > 1 ? "s" : ""}` : ""}` : null,
        accion: detUsd ? "evaluar salida comercial" : "sostener",
        accionAsk: detUsd ? `¿Cómo libero el capital inmovilizado en ${b}?` : `¿Cuánto capital tengo en ${b}?`,
      };
    });
  } else {
    rows = inv.map((r) => {
      const s = estadoDe[r.sku], E = CAPITAL_ESTADOS[s.estado];
      const detenido = s.estado === "capital_frenado";
      const quiebre = s.estado === "riesgo_quiebre";
      return {
        name: r.sku, stock: r.stockUnd, capital: r.stockUSD, rotacion: _r1(r.rotacion), doh: Math.round(r.doh),
        diasSinVenta: typeof r.diasSinVenta === "number" ? r.diasSinVenta : null,
        ultimaVenta: typeof r.diasSinVenta !== "number" ? "—" : r.diasSinVenta === 0 ? "hoy" : `hace ${r.diasSinVenta}d`,
        estado: s.estado, estadoRank: _RANK[s.estado], estadoLabel: E.label, estadoColor: E.color,
        enJuego: detenido ? r.stockUSD : null, alert: detenido || quiebre,
        lectura: detenido
          ? `${_money(r.stockUSD)} inmovilizados${r.bodega ? ` en ${r.bodega}` : ""} · rotación ${_r1(r.rotacion)}x · ${Math.round(r.doh)}d de inventario${typeof r.diasSinVenta === "number" && r.diasSinVenta > 0 ? ` · sin venta hace ${r.diasSinVenta}d` : ""}${r.alerta === "crit" ? " · crítico" : ""}`
          : quiebre ? `Rota ${_r1(r.rotacion)}x y le quedan ${Math.round(r.doh)}d de inventario — reposición antes del corte` : null,
        accion: detenido ? "evaluar salida comercial" : quiebre ? "revisar reposición" : s.estado === "sobrestock" ? "frenar o ajustar reposición" : "sostener",
        accionAsk: detenido ? `¿Cómo libero el capital de ${r.sku}?`
          : quiebre ? "¿Qué reponer por quiebre?"
          : s.estado === "sobrestock" ? "¿Dónde sobra inventario?"
          : `Profundiza en ${r.sku}`,
      };
    });
  }
  const tCap = rows.reduce((a, r) => a + r.capital, 0), tEJ = rows.reduce((a, r) => a + (r.enJuego || 0), 0);
  /* LA MISMA ROTACIÓN MEDIA QUE LA CARD (owner 2026-08-09, decisión 6 · hallazgo E). Acá había un
   * `_r1(_mean(inv, r => r.rotacion))` —promedio SIMPLE— mientras la card de arriba mostraba el ponderado por
   * capital: 5,8x y 6,0x con la misma etiqueta, en la misma pantalla. El pie de esta tabla lo pinta
   * (`SentrixPanel.jsx`: "rotación media {cc.rotacionMedia}x"), así que no era código muerto: era la segunda
   * verdad, visible. Queda la ponderada, que es la que el manifiesto declara y la que responde la pregunta del
   * negocio — cuántas veces rota el DINERO, no el SKU promedio. */
  const rotMedia = rotacionPonderada(inv);
  const total = { name: "Total", stock: rows.reduce((a, r) => a + r.stock, 0), capital: tCap,
    rotacion: rotMedia, criticos: eje === "bodega" ? rows.reduce((a, r) => a + r.criticos, 0) : null,
    doh: null, estado: null, enJuego: tEJ || null, accion: "", _total: true };
  const meta = CUADRO_CAPITAL_EJES.find((d) => d.key === eje) || CUADRO_CAPITAL_EJES[0];
  return { eje, label: meta.label, plural: meta.plural, columns: COLS_CAPITAL[eje] || COLS_CAPITAL.sku, rows, total, n: rows.length, rotacionMedia: rotMedia };
}
