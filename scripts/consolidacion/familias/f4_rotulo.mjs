/* === scripts/consolidacion/familias/f4_rotulo.mjs · INVARIANTE DE LA FAMILIA 4 · EL RÓTULO DE CADA CIFRA SEGÚN SU CONCEPTO ═══════════
 * «Una cifra conserva el rótulo de SU concepto: cada concepto pedido lleva su rótulo del léxico (capital inmovilizado ≠ capital inmovilizado
 * crítico; saldo por vencer ≠ saldo pendiente; la venta a crédito se rotula «Venta a crédito»; ventas nunca se rotula «venta a crédito», aunque
 * coincidan en valor). Las filas de la tabla de señales de la prioridad conservan el rótulo de su señal. Una fig sin clave en el léxico se
 * DECLARA, nunca se imprime con un rótulo crudo» (contrato §7.3·49(f) · 51(f) · 52(a) · 52(e)).
 *
 * LO QUE LEE: la ENTREGA (sus filas de Cifras y de Detalle y sus oraciones) y el DATO de la proyección (`dato.rankings`: la clave y el valor de
 * cada cifra por entidad). NO lee `entrega/rotulos.js`: ni importa la pieza ni repite su lógica. Del léxico lee solo la TABLA (los nombres y las
 * claves: `lexico.CLAVES_DE_METRICA`, que es dato del contrato) y de la prioridad solo los NOMBRES de las señales (`LENTES`, dato del contrato).
 *
 * LAS REGLAS (cada violación nombra la suya):
 *   rotulo-fuera-del-lexico      una fila (o una diferencia, «Diferencia · X») lleva un rótulo cuya clave existe pero que no es el nombre del
 *                                léxico de su concepto («Ventas», «Dias Vencido», «Venta (flujo)», «Cobertura (DOH)», «YoY»…) (49f · 51f).
 *   fig-sin-clave-sin-declarar   una fila lleva un rótulo que no tiene clave en el léxico: se declara, no se imprime crudo (52e).
 *   rotulo-no-corresponde-al-dato  la fila lleva el rótulo de una clave que el dato publica para esa entidad con OTRO valor, y la cifra impresa es la
 *                                de otra clave de la misma unidad (capital inmovilizado ≠ crítico, saldo por vencer ≠ pendiente…) (51f).
 *   oracion-rotula-crudo         una oración dice la cifra «en X» (prioridad, comparación, «no tiene X») con una X que no es el nombre del
 *                                léxico en minúscula (49f · 51f · 52e).
 *   tema-mal-asociado            el Tema de la fila no es el del dominio de su cifra («Falabella · comercial · Venta a crédito»): cada fila lleva el tema de
 *                                su cifra, no el de la parte o la lente que la pidió (estándar de los cuatro puntos del owner; consolidación F5).
 * EXENTO (52e): las filas de la tabla de señales de la prioridad (el nombre de su señal: «vencido», «atraso», «distancia al benchmark»…, su
 * diferencia «Diferencia · materialidad» y la concentración «Participación del vencido total») y la tabla de la simulación (sus rótulos son los
 * de su productor: ningún artículo del contrato los cubre). */

const _norm = (s) => String(s == null ? "" : s).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
/* el valor impreso de una celda como número + su precisión («$19.4M» → 19.4e6 ± 0.05e6; «269d» → 269 ± 0.5; «22%» → 22 ± 0.5) */
function _valorImpreso(txt) {
  const m = /(-?\d[\d.,]*)\s*([KMB])?/.exec(String(txt == null ? "" : txt));
  if (!m) return null;
  let t = m[1]; if (/,\d{1,3}$/.test(t) && !/\./.test(t)) t = t.replace(",", "."); else t = t.replace(/,/g, "");
  const dec = (t.split(".")[1] || "").length;
  const mult = m[2] === "K" ? 1e3 : m[2] === "M" ? 1e6 : m[2] === "B" ? 1e9 : 1;
  const x = parseFloat(t);
  return Number.isFinite(x) ? { x: x * mult, tol: 0.5 * Math.pow(10, -dec) * mult * 1.001 } : null;
}
/* los números de una fila del ranking del dato en la unidad que se imprime (dinero: `raw` en pesos o `valor` en K; el resto: `valor`) */
const _numerosDeLaFila = (f) => [f && Number.isFinite(f.raw) ? f.raw : null, f && Number.isFinite(f.valor) ? f.valor : null, f && Number.isFinite(f.valor) ? f.valor * 1000 : null].filter((x) => x != null);
/* la clave del ranking del dato → la clave del léxico («margen_venta» es el margen del SKU en la venta: el concepto «margen») */
const _CLAVE_DE_RANKING = { margen_venta: "margen" };

export const familia = {
  id: "F4",
  nombre: "el rótulo de cada cifra es el de su concepto en el léxico: sin rótulos crudos, sin confundir conceptos que coinciden en valor",
  invariante(ctx) {
    const { entrega, dato, base } = ctx;
    const vs = [];
    const v = (regla, detalle) => vs.push({ regla, detalle: String(detalle).slice(0, 320) });
    const lex = base.lexico;
    const claveDe = (rotulo) => lex.claveExactaDeMetrica(rotulo) || null;
    /* las señales de la prioridad (dato del contrato): sus nombres y las tres dimensiones */
    const SENALES = new Set(["materialidad", "severidad", "urgencia"]);
    try { for (const dom of Object.values((base.prioridadIntegrada && base.prioridadIntegrada.LENTES) || {})) for (const l of Object.values(dom || {})) if (l && l.nombre) SENALES.add(String(l.nombre)); } catch { /* sin señales: el control sigue */ }
    /* el rótulo de una señal es SU nombre, tal cual (en minúscula: «vencido», «días sin venta»); el rótulo de un concepto («Días sin venta») no es una señal aunque se parezca: no se exime */
    const esDeSenal = (met) => {
      const t = String(met).replace(/^Diferencia · /, "");
      if (SENALES.has(t)) return true;
      const m = /^Participación del (.+) total$/.exec(t);
      return !!(m && SENALES.has(m[1]));
    };
    /* el dato: la clave y el valor de cada cifra por entidad (los rankings de la proyección) */
    const R = (dato && dato.rankings) || {};
    const valoresDe = (ent) => { const out = new Map(); for (const eje of Object.keys(R)) for (const [k, rk] of Object.entries(R[eje] || {})) { const f = rk && Array.isArray(rk.filas) ? rk.filas.find((g) => _norm(g.entidad) === _norm(ent)) : null; if (f) out.set(_CLAVE_DE_RANKING[k] || k, _numerosDeLaFila(f)); } return out; };

    /* ── lo impreso: las filas de Cifras y del Detalle ───────────────────────────────────────────────────────────── */
    const filas = [...((entrega.cifras && entrega.cifras.filas) || []), ...((entrega.detalle && Array.isArray(entrega.detalle.filas) ? entrega.detalle.filas : []))];
    for (const f of filas) {
      const x = f.valores || {};
      const met = x["Métrica"] != null ? x["Métrica"] : x.Metrica;
      const ent = x["Entidad / grupo"] != null ? x["Entidad / grupo"] : (x.Entidad != null ? x.Entidad : x.Cliente);
      if (met == null || ent == null) continue;
      const enSimulacion = x["Simulación"] != null || /\(simulación:/.test(String(met));
      if (esDeSenal(met)) continue;   // 52e: las filas de la tabla de señales conservan el rótulo de su señal
      if (enSimulacion) continue;   // los rótulos de la simulación son de su productor («Margen actual», «Delta · Venta», «Liberado»): ningún artículo del contrato los cubre
      const esDif = /^Diferencia · /.test(String(met));
      const core = String(met).replace(/^Diferencia · /, "");
      const clave = claveDe(core);
      if (!clave) { v("fig-sin-clave-sin-declarar", `la fila «${ent} · ${met}» (${x.Tema}) lleva un rótulo sin clave en el léxico`); continue; }
      const nombre = lex.metricaPorClave(clave).nombre;
      if (core !== nombre) { v("rotulo-fuera-del-lexico", `la fila «${ent} · ${met}» (${x.Tema}) debería rotularse «${esDif ? "Diferencia · " : ""}${nombre}»`); continue; }
      /* el TEMA de la fila es el del dominio de su cifra (el estándar de los cuatro puntos: cada atributo de una fila es el de SU cifra): «Falabella · comercial · Venta a crédito» tiene el tema mal asociado (la venta a crédito es de cobranza) */
      const dominio = lex.metricaPorClave(clave).dominio;
      if (x.Tema != null && dominio && _norm(x.Tema) !== _norm(dominio)) v("tema-mal-asociado", `la fila «${ent} · ${met}» lleva el tema «${x.Tema}» y su cifra es del dominio «${dominio}»`);
      if (esDif || /\s[−-]\s|^Total\b/.test(String(ent))) continue;   // una diferencia o un total no es la cifra de UNA fig del dato
      /* el dato: si publica la clave del rótulo para esa entidad con OTRO valor y la cifra impresa es la de otra clave de la misma unidad, el rótulo es de otro concepto */
      const imp = _valorImpreso(x.Valor);
      if (!imp || imp.x === 0) continue;   // un cero coincide con cualquier otro cero: no distingue conceptos
      const dd = valoresDe(ent);
      const propios = dd.get(clave);
      if (!propios || propios.some((n) => Math.abs(n - imp.x) <= imp.tol)) continue;
      const unidad = lex.metricaPorClave(clave).unidad;
      const otras = [...dd.entries()].filter(([k, ns]) => k !== clave && (lex.metricaPorClave(k) || {}).unidad === unidad && ns.some((n) => Math.abs(n - imp.x) <= imp.tol)).map(([k]) => (lex.metricaPorClave(k) || { nombre: k }).nombre);
      if (otras.length) v("rotulo-no-corresponde-al-dato", `la fila «${ent} · ${met}» = ${x.Valor}: el dato trae esa cifra bajo ${otras.map((n) => `«${n}»`).join(", ")}, no bajo «${nombre}»`);
    }

    /* ── lo dicho en las oraciones: «con $X en CONCEPTO.» (prioridad) · «en CONCEPTO, A … contra B …» (comparación) · «no tiene CONCEPTO (0 …)» ─ */
    const textos = (Array.isArray(entrega.respuesta) ? entrega.respuesta : []).map((r) => String((r && r.texto) || ""));
    const revisa = (X, donde) => {
      const t = String(X).trim();
      const clave = claveDe(t);
      if (!clave) { if (donde !== "no-tiene") v("oracion-rotula-crudo", `${donde}: «${t}» no tiene clave en el léxico y se imprime crudo`); return; }
      const esperado = lex.metricaPorClave(clave).nombre.toLowerCase();
      if (t !== esperado) v("oracion-rotula-crudo", `${donde}: «${t}» debería decirse «${esperado}»`);
    };
    for (const t of textos) {
      let m;
      if ((m = /^Prioridad del procedimiento(?: dentro de este grupo)?, por .+?: .+?, con .+? en (.+?)\.$/.exec(t))) revisa(m[1], "prioridad");
      if (/^Comparando /.test(t)) { const re = /(?:: |; )en ([^,;]+?), /g; while ((m = re.exec(t))) revisa(m[1], "comparación"); }
      const reNo = /no tiene ([^()$,;]+?) \((?:\$0|0 [^)]*)\)/g;
      while ((m = reNo.exec(t))) revisa(m[1], "no-tiene");
    }
    return vs;
  },
};
