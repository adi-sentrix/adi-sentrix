/* === src/adi/agente/playbooks/crucePorSku.js · PLAYBOOK · EL CRUCE COMERCIAL × INVENTARIO POR SKU (owner 2026-09-14) ====
 *
 * LA LEY DEL CONTRATO DE DOMINIOS: «ADI solo relaciona aquello que el archivo demuestra que puede relacionarse». La
 * ÚNICA clave que une venta/contribución con stock en este dato es el SKU (marca y familia, como atributos del SKU).
 * Este playbook es el piso determinístico de ese cruce: cuando la pregunta hace participar a Comercial e Inventario
 * sin nombrar otro eje ni una cuenta, compone con las cifras que las herramientas del cruce YA publican
 * (`inventoryStatus{top_sellers}`: venta × stock por SKU · `tensionRead{sku}`: contribución × capital · los días por
 * SKU del contrato de inventario) — en forma de FICHA ENUMERADA, cada cifra con su marco, que es la forma que el
 * muro admite en todo pack (en el demo los dos universos no reconcilian; en una planilla son comparables y aun así
 * la enumeración con marcos es la lectura honesta).
 *
 * LO MEDIDO ANTES: «¿Los SKU que más vendo son los que tienen más capital en inventario?» caía a `lectura-por-eje`
 * y recibía un ranking de capital FRENADO — otra pregunta. Con los dos dominios en la boleta, el cerebro puede
 * responder; y si calla, esto responde lo que la boleta demuestra.
 *
 * PURO · determinístico · sin red. Cifras VERBATIM de la boleta: selecciona y ordena, jamás calcula. */
import { dominiosDe } from "../contratoDeDominios.js";
import { esPorQue } from "../porque.js";
import { nombraEntidad } from "./indiceEntidades.js";
import { reconcilian } from "../../../config/contract/figureType.js";

const _FIN = "(?![a-záéíóúüñ])";
const _lab = (f) => String((f && f.label) || "");
const _val = (f) => String((f && (f.text || f.value)) || "");
const _num = (f) => {
  if (f && Number.isFinite(f.raw)) return f.raw;
  const s = _val(f).trim();
  const m = /^\$\s?(-?[\d.,]+)\s?([KMB])?$/.exec(s);
  if (m) { const n = parseFloat(m[1].replace(",", ".")); const k = { K: 1e3, M: 1e6, B: 1e9 }[m[2]] || 1; return Number.isFinite(n) ? n * k : NaN; }
  const d = /^(-?[\d.,]+)\s*d$/.exec(s);
  return d ? parseFloat(d[1]) : NaN;
};
const _all = (figs, re) => (Array.isArray(figs) ? figs : []).filter((f) => re.test(_lab(f)));
const _entidadDe = (label) => { const p = String(label || "").split("·").map((s) => s.trim()); return p.length >= 2 ? p[0] : null; };
const _FUERA = new RegExp(`\\bsimul|\\bproyect|\\bqu[eé] pasa si${_FIN}|\\bpon[eé]le que${_FIN}|\\bllamame|\\bll[aá]mame|\\bqu[eé] hago${_FIN}|\\bpor d[oó]nde empiezo${_FIN}`, "i");

function _caso(pregunta) {
  const q = String(pregunta || "");
  if (!q.trim() || _FUERA.test(q) || esPorQue(q)) return null;
  let d; try { d = dominiosDe(q); } catch { return null; }
  if (!d.dominios.includes("comercial") || !d.dominios.includes("inventario")) return null;
  if (d.eje) return null;                       // por marca/familia/canal/bodega: la lectura por eje es de otros
  try { if (nombraEntidad(q)) return null; } catch { /* sin índice: sigue */ }   // una cuenta nombrada no se cruza con inventario
  return { dominios: d.dominios };
}

export const crucePorSku = {
  nombre: "cruce-por-sku",
  multidominio: true,
  ejemplos: ["¿Los SKU que más vendo son los que tienen más capital en inventario?", "¿Cuánto inventario tengo de los 5 SKU que más venden?", "¿Qué SKU dejan contribución pero tienen capital frenado?"],

  cuandoAplica(pregunta) { return _caso(pregunta) !== null; },

  /* los pasos del cruce — los mismos que trae el contrato de inventario cuando Comercial participa (la unión por
   * herramienta+argumentos no los repite); van acá para que el playbook PROMETA y se active. */
  pasos(pregunta) {
    return _caso(pregunta) ? [
      { tool: "inventoryStatus", args: { focus: "top_sellers" }, para: "los SKU que más venden con su stock: venta del período y stock de la foto, lado a lado" },
      { tool: "tensionRead", args: { dimension: "sku" }, para: "quién deja más contribución y quién tiene más capital en inventario, y quién aparece en las dos listas" },
    ] : [];
  },
  obligatorias(pregunta) { return _caso(pregunta) ? [/· Venta$/i, /· Stock$/i] : []; },

  entregable: "la lectura del cruce por SKU en forma de ficha: los SKU que más venden con su stock y sus días de inventario (cada cifra con su marco: venta del período · stock de la foto), quiénes de ellos tienen capital frenado, y quiénes dejan contribución sin capital grande detrás (o al revés). Sin sumar venta con stock ni derivar cobertura: los días se citan del dato.",

  componer({ figs, pregunta } = {}) {
    if (!_caso(pregunta)) return null;
    /* SOLO SKU: la boleta unida trae «Falabella · Venta» (rolesCartera) y «Lider · Contribución» (contributionRead) — las
     * cifras del cruce son las que tienen una fig de INVENTARIO con el mismo dueño (stock, días, capital): esa es la clave */
    const stock = new Map(_all(figs, /· Stock$/i).map((f) => [_entidadDe(_lab(f)), _val(f)]));
    const dias = new Map(_all(figs, /· (?:Cobertura \(DOH\)|D[ií]as de inventario)$/i).map((f) => [_entidadDe(_lab(f)), _val(f)]));
    const frenados = new Map(_all(figs, /· Capital frenado$/i).map((f) => [_entidadDe(_lab(f)), _val(f)]));
    const capital = _all(figs, /· Valor de inventario$/i).map((f) => ({ sku: _entidadDe(_lab(f)), fmt: _val(f), n: _num(f) })).filter((x) => x.sku && Number.isFinite(x.n)).sort((a, b) => b.n - a.n);
    const esSku = new Set([...stock.keys(), ...dias.keys(), ...frenados.keys(), ...capital.map((x) => x.sku), ..._all(figs, /· (?:Capital|Unidades en stock)$/i).map((f) => _entidadDe(_lab(f)))].filter(Boolean));
    const ventas = _all(figs, /· Venta$/i).map((f) => ({ sku: _entidadDe(_lab(f)), fmt: _val(f), n: _num(f) })).filter((x) => x.sku && stock.has(x.sku)).sort((a, b) => b.n - a.n);
    if (!ventas.length || !stock.size) return null;
    const contrib = _all(figs, /· Contribución$/i).map((f) => ({ sku: _entidadDe(_lab(f)), fmt: _val(f), n: _num(f) })).filter((x) => x.sku && esSku.has(x.sku) && Number.isFinite(x.n)).sort((a, b) => b.n - a.n);
    const marcos = (() => { try { return reconcilian("venta_comercial", "inventario").marcos || {}; } catch { return {}; } })();
    const mVenta = marcos.venta_comercial || "período cerrado", mFoto = marcos.inventario || "foto de inventario a hoy";

    const partes = [];
    /* sin conteo en la apertura: «tus 5 SKU» es un conteo que la boleta no autoriza (el muro lo cobra: conteo-no-autorizado) */
    partes.push(`Los SKU que más venden, con su inventario (venta: ${mVenta} · stock y días: ${mFoto}):`);
    for (const v of ventas) {
      const extra = [stock.has(v.sku) ? `stock ${stock.get(v.sku)}` : "sin registro de inventario", dias.has(v.sku) ? `${dias.get(v.sku)} de inventario` : null, frenados.has(v.sku) ? `capital frenado ${frenados.get(v.sku)}` : null].filter(Boolean).join(" · ");
      partes.push(`- ${v.sku} · vende ${v.fmt} · ${extra}`);
    }
    const topVenta = new Set(ventas.map((v) => v.sku));
    const frenadosTop = ventas.filter((v) => frenados.has(v.sku)).map((v) => v.sku);
    partes.push(frenadosTop.length
      ? `De los que más venden, ${frenadosTop.join(" y ")} ${frenadosTop.length === 1 ? "tiene" : "tienen"} capital frenado según la referencia de inventario declarada.`
      : `Entre los que más venden no aparece capital frenado${frenados.size ? `: el capital frenado está en ${[...frenados.keys()].slice(0, 3).join(", ")}${frenados.size > 3 ? ` y ${frenados.size - 3} más` : ""}, fuera de los que más venden` : ""}.`);
    if (contrib.length && capital.length) {
      const topC = new Set(contrib.slice(0, 5).map((x) => x.sku));
      const enAmbas = capital.slice(0, 5).filter((x) => topC.has(x.sku));
      const soloCapital = capital.slice(0, 5).filter((x) => !topC.has(x.sku) && !topVenta.has(x.sku));
      if (enAmbas.length) partes.push(`Dejan contribución y también concentran capital en inventario: ${enAmbas.map((x) => `${x.sku} (contribución ${contrib.find((c) => c.sku === x.sku).fmt} · inventario ${x.fmt})`).join(" · ")}.`);
      if (soloCapital.length) partes.push(`Concentran capital sin estar entre los que más contribuyen ni más venden: ${soloCapital.map((x) => `${x.sku} (${x.fmt} en inventario)`).join(" · ")}.`);
    }
    partes.push(`Venta y contribución son del ${mVenta}; el stock, los días y el capital son la ${mFoto} — se leen lado a lado y no se suman.${frenados.size ? " Por qué cada uno está frenado no está en este dato: queda localizado, no explicado." : ""}`);
    return partes.join("\n");
  },

  listaNotarial(texto, { figs } = {}) {
    const t = String(texto || "");
    if (!t.trim()) return [];
    const v = [];
    /* sumar venta con stock es el acto que ningún archivo permite; el muro lo caza por anafórico — acá, por la forma directa */
    if (/\b(?:sum(?:a|an|ando|ar|é)|total(?:iza|izando)?|consolid\w+)\b[^.\n]{0,60}\b(?:venta|vende|factura)\b[^.\n]{0,40}\b(?:stock|inventario|capital)\b|\b(?:stock|inventario|capital)\b[^.\n]{0,40}\b(?:m[aá]s|\+)\s+(?:la\s+)?venta\b/i.test(t)) {
      v.push({ regla: "venta-mas-stock", multa: "la venta (un flujo del período) y el stock (una foto) no se suman ni se consolidan: cada cifra con su marco, lado a lado." });
    }
    /* «días de cobertura» recalculados: los días se citan del dato (`· Cobertura (DOH)`), jamás se derivan de venta ÷ stock */
    const diasBoleta = new Set(_all(figs, /· (?:Cobertura \(DOH\)|D[ií]as de inventario)$/i).map((f) => _val(f).replace(/\s/g, "")));
    for (const m of t.matchAll(/(\d+(?:[.,]\d+)?)\s*d[ií]as? de (?:cobertura|venta|inventario)/gi)) {
      const dicho = `${Math.round(parseFloat(m[1].replace(",", ".")))}d`;
      if (![...diasBoleta].some((d) => d.replace(/d$/, "") === dicho.replace(/d$/, ""))) { v.push({ regla: "dias-derivados", multa: `«${m[0]}» no está en la boleta: los días de inventario se citan del dato, no se derivan de venta ÷ stock.` }); break; }
    }
    return v;
  },
};
