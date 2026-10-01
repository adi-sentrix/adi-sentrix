/* === scripts/consolidacion/familias/f6_premisas.mjs · INVARIANTE DE LA FAMILIA 6 · LA FRASE DE UNA PREMISA (consolidación, segunda vuelta · parte B) ═════════════
 * Dos reglas del owner sobre lo que la frase de una premisa imprime:
 *   R1 · EL RÓTULO EN LA PREMISA (contrato §7.3·49(f) · 51(f) · 52(e)): toda cifra que la frase de una premisa imprime lleva el rótulo de SU concepto, el del léxico: nunca sin rótulo
 *        y nunca con el de otro concepto, aunque coincidan en valor («MAK-SAW18V (34%) · PHI-HAIR-PRO (30%)…» sin decir que es el margen, cuando el margen y el margen de inventario valen 34).
 *   R2 · NO SE AFIRMA UN EXTREMO SOBRE UN RANKING INCOMPLETO (contrato §7.3·13 · 52(b)): «el mayor / el menor», «es el k.º» y «la mayor variación» no se juzgan verdaderos ni falsos si el ranking tiene
 *        miembros sin dato: se declaran no verificables y se dice quién no tiene dato («sin dato de M para X»). Lo ausente no se ordena.
 *
 * LO QUE LEE: la ENTREGA (las oraciones de sus premisas: `respuesta[i]._premisa`, su id en `hechos[0]`) y el DATO (los rankings de la proyección, lo que el Core publica por eje —`base.publica`—, la
 * declaración de cobertura de las fuentes y los nombres de cada eje). De la premisa lee su CAMPO TIPADO del encargo (`encargo.premisas`: tipo, métrica, forma del orden, universo). NO lee `notario/*` ni
 * `entrega/componer.js`: ni importa la pieza ni repite su lógica.
 *
 * LAS REGLAS (cada violación nombra la suya):
 *   premisa-cifra-sin-rotulo        la frase imprime «A (valor) · B (valor)» (o «A (valor) vs B (valor)») y ningún rótulo del léxico de la cifra —ni el de la métrica de la premisa ni el de la clave que el dato
 *                                   trae para A con ese valor— aparece en la frase (49f · 51f · 52e).
 *   premisa-rotulo-de-otro-concepto la frase dice «A: ROTULO valor» con el rótulo de un concepto que no es el de la métrica de la premisa (el margen dicho «margen de inventario»; las ventas, «venta a crédito») (49f).
 *   extremo-sobre-ranking-incompleto una premisa de orden máx/mín/puesto sobre un eje cuyo ranking tiene miembros sin dato (y la fuente no declara que lo ausente vale cero) se juzga (verdadera o falsa): debía declararse
 *                                   no verificable (13 · 52b).
 *   ausente-sin-nombrar             esa misma premisa, declarada no verificable, no dice quién no tiene dato en la forma «sin dato de M para X» (52b).
 * Las cuatro están ABIERTAS mientras el owner decide el alcance del cambio (la pieza todavía no las cumple: afectan a más de 100 textos de los catálogos v13–v28); el gate las congela. */

const _norm = (s) => String(s == null ? "" : s).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
const _esc = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
/* el valor impreso de una cifra como número + su precisión («+15.6%» → 15.6 ± 0.05 · «$13K» → 13e3 ± 0.5e3 · «140» → 140 ± 0.5) */
function _valorImpreso(txt) {
  const m = /(-?\d[\d.,]*)\s*([KMB])?/.exec(String(txt == null ? "" : txt).replace(/^[+−]/, (c) => (c === "−" ? "-" : "")));
  if (!m) return null;
  let t = m[1]; if (/,\d{1,3}$/.test(t) && !/\./.test(t)) t = t.replace(",", "."); else t = t.replace(/,/g, "");
  const dec = (t.split(".")[1] || "").length;
  const mult = m[2] === "K" ? 1e3 : m[2] === "M" ? 1e6 : m[2] === "B" ? 1e9 : 1;
  const x = parseFloat(t);
  return Number.isFinite(x) ? { x: x * mult, tol: 0.5 * Math.pow(10, -dec) * mult * 1.001 } : null;
}
const _numerosDeLaFila = (f) => [f && Number.isFinite(f.raw) ? f.raw : null, f && Number.isFinite(f.valor) ? f.valor : null, f && Number.isFinite(f.valor) ? f.valor * 1000 : null].filter((x) => x != null);
const _CLAVE_DE_RANKING = { margen_venta: "margen" };
/* una cifra: «+15.6%», «$13K», «(140)», «7.8x», «0 días» */
const RE_CIFRA = "[+\\-−]?\\$?\\d[\\d.,]*\\s?(?:%|pp|[KMB]|x|d|días?|veces)?";

export const familia = {
  id: "F6",
  nombre: "la frase de una premisa rotula cada cifra con el de su concepto, y no afirma un extremo sobre un ranking con miembros sin dato",
  invariante(ctx) {
    const { entrega, dato, base, encargo } = ctx;
    const vs = [];
    const v = (regla, detalle) => vs.push({ regla, detalle: String(detalle).slice(0, 360), abierta: true });
    const lex = base.lexico, esq = base.esquema;
    const premisas = (encargo && Array.isArray(encargo.premisas)) ? encargo.premisas : [];
    const respuesta = Array.isArray(entrega.respuesta) ? entrega.respuesta : [];
    const R = (dato && dato.rankings) || {};
    const claveDe = (m) => (m == null ? null : (lex.claveExactaDeMetrica(m) || lex.claveDeMetrica(m) || null));
    const nombreDe = (clave) => ((lex.metricaPorClave(clave) || {}).nombre) || clave;
    /* los nombres de las entidades del dato (todos los ejes) y, por entidad, las claves que el dato trae con su valor */
    const entidades = new Map();   /* nombre normalizado → nombre */
    for (const eje of Object.keys(R)) for (const rk of Object.values(R[eje] || {})) for (const f of (rk && Array.isArray(rk.filas) ? rk.filas : [])) if (f && f.entidad) entidades.set(_norm(f.entidad), f.entidad);
    const valoresDe = (ent) => { const out = new Map(); for (const eje of Object.keys(R)) for (const [k, rk] of Object.entries(R[eje] || {})) { const f = rk && Array.isArray(rk.filas) ? rk.filas.find((g) => _norm(g.entidad) === _norm(ent)) : null; if (f) out.set(_CLAVE_DE_RANKING[k] || k, _numerosDeLaFila(f)); } return out; };
    /* ¿la frase dice el rótulo `rot`? Un rótulo MÁS LARGO de otro concepto que lo contiene («Margen de inventario» contiene «Margen») no cuenta como el corto */
    const todosLosNombres = (lex.CLAVES_DE_METRICA || []).map((m) => _norm(m.nombre)).filter(Boolean);
    const tieneRotulo = (texto, rot) => { const r = _norm(rot); let t = _norm(texto); for (const n of todosLosNombres.filter((x) => x !== r && x.includes(r)).sort((a, b) => b.length - a.length)) t = t.split(n).join(" "); return t.includes(r); };
    const nombresOrdenados = [...entidades.values()].sort((a, b) => b.length - a.length);

    for (const r of respuesta) {
      if (!r || !r._premisa || !Array.isArray(r.hechos) || !r.hechos.length) continue;
      const t = String(r.texto || "");
      const mv = /(?:es correcto|no es así) — (.*)$/.exec(t);
      if (!mv) continue;   /* «no se pudo verificar…»: la frase no imprime la cifra de una premisa */
      const cuerpo = mv[1];
      const p = premisas.find((x) => x && x.id === r.hechos[0]) || null;
      const claveP = p ? claveDe(p.metrica) : null;
      const rotuloP = claveP ? nombreDe(claveP) : null;

      /* R1a · «A (valor) · B (valor)» / «A (valor) vs B (valor)»: la cifra sin rótulo */
      const sinRotulo = [];
      for (const nombre of nombresOrdenados) {
        const re = new RegExp(`(?<![\\wÁ-ú])${_esc(nombre)} \\((${RE_CIFRA})\\)`, "g");
        let m;
        while ((m = re.exec(cuerpo))) {
          const imp = _valorImpreso(m[1]); if (!imp) continue;
          const dd = valoresDe(nombre);
          const candidatas = [...dd.entries()].filter(([, ns]) => ns.some((n) => Math.abs(n - imp.x) <= imp.tol)).map(([k]) => k);
          const claves = [...new Set([...(claveP ? [claveP] : []), ...candidatas])];
          if (!claves.length) continue;   /* el dato no dice de qué concepto es esa cifra: el control no decide */
          if (!candidatas.length && !claveP) continue;
          const rotulos = claves.map(nombreDe);
          if (rotulos.some((rot) => tieneRotulo(t, rot))) continue;
          sinRotulo.push({ cifra: `${nombre} (${m[1]})`, rotulos });
        }
      }
      /* una violación por FRASE (la lista «A (x) · B (y) · C (z)» sin rótulo es una sola falta), con la primera cifra como ejemplo */
      if (sinRotulo.length) v("premisa-cifra-sin-rotulo", `${r.hechos[0]}: ${sinRotulo.length} cifra(s) sin el rótulo de su concepto («${sinRotulo[0].cifra}»: ${sinRotulo[0].rotulos.slice(0, 3).map((x) => `«${x}»`).join(" / ")}) en «${t.slice(0, 120)}»`);
      /* R1b · «A: ROTULO valor» / «A: no tiene ROTULO ($0)»: el rótulo de OTRO concepto */
      if (claveP) {
        for (const nombre of nombresOrdenados) {
          const re = new RegExp(`(?<![\\wÁ-ú])${_esc(nombre)}: (?:está al día, )?(?:no tienen? )?([^:;()$\\d]+?) ?\\(?(?:${RE_CIFRA})`, "g");
          let m;
          while ((m = re.exec(cuerpo))) {
            const rot = m[1].trim().replace(/,$/, "");
            const k = lex.claveExactaDeMetrica(rot);
            if (!k || k === claveP) continue;
            v("premisa-rotulo-de-otro-concepto", `${r.hechos[0]}: la premisa es sobre «${rotuloP}» y la frase rotula la cifra de «${nombre}» como «${rot}» (${nombreDe(k)})`);
          }
        }
      }
    }

    /* R2 · un extremo sobre un ranking con miembros sin dato */
    for (const p of premisas) {
      if (!p || p.tipo !== "orden" || !p.orden || !["max", "min", "puesto"].includes(p.orden.forma)) continue;
      const clave = claveDe(p.metrica); if (!clave) continue;
      if (p.universo && esq.universoTieneRestriccionPropia && esq.universoTieneRestriccionPropia(p.universo)) continue;   /* un universo acotado: sus miembros no son el eje entero */
      const sujetos = Array.isArray(p.sujeto) ? p.sujeto : [p.sujeto];
      let ejes = p.universo && p.universo.eje ? [p.universo.eje] : [];
      if (!ejes.length && sujetos[0]) ejes = esq.EJES.filter((e) => { try { return !!base.entityIndex.resolveCanonical(e, sujetos[0]); } catch { return false; } }).slice(0, 1);
      for (const eje of ejes) {
        const pub = typeof base.publica === "function" ? base.publica(eje, clave) : null;
        if (!pub) continue;   /* el dato no publica ese ranking: «sin evidencia» de siempre, no un ranking incompleto */
        if (lex.ceroPorCobertura(clave, eje)) continue;   /* la fuente declara que lo ausente vale cero: el ranking es completo */
        let todos = []; try { todos = base.entityIndex.axisEntityNames(eje) || []; } catch { todos = []; }
        const sinDato = todos.filter((n) => !pub.has(_norm(n)));
        if (!sinDato.length) continue;
        const frases = respuesta.filter((r) => r && r._premisa && Array.isArray(r.hechos) && r.hechos[0] === p.id);
        for (const r of frases) {
          const t = String(r.texto || "");
          if (/(?:es correcto|no es así) — /.test(t)) { v("extremo-sobre-ranking-incompleto", `${p.id} (orden ${p.orden.forma} de «${nombreDe(clave)}» por ${eje}): ${sinDato.join(", ")} no tiene${sinDato.length > 1 ? "n" : ""} dato y la premisa se juzga: «${t.slice(0, 110)}»`); continue; }
          const n = _norm(t);
          if (!/sin dato de /.test(n) || !sinDato.every((x) => n.includes(_norm(x)))) v("ausente-sin-nombrar", `${p.id} (orden ${p.orden.forma} de «${nombreDe(clave)}» por ${eje}) es no verificable y no dice «sin dato de ${nombreDe(clave).toLowerCase()} para ${sinDato.join(", ")}»: «${t.slice(0, 130)}»`);
        }
      }
    }
    return vs;
  },
};
