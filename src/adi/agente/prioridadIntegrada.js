import { leerClausula } from "../oracle/lectorDeClausula.js";   // la negación se lee dentro de la cláusula (owner 2026-09-14)
/* === src/adi/agente/prioridadIntegrada.js · LA PRIORIDAD INTEGRADA POR SEÑALES (owner 2026-09-14) ==============
 *
 * EL CASO (el prompt de producción, permanente): la primera versión del cierre integrado ponía primero a Falabella
 * «porque coincide Comercial + Cobranza». El owner: «Lider también coincide en ambos dominios y su severidad conjunta
 * parece mayor: tiene $1,5M de contribución no capturada y, además, $4,6M vencidos con 269 días de atraso. Falabella
 * tiene mayor brecha comercial ($1,6M), pero su vencido es $2,5M a solo 8 días.»
 *
 * LA REGLA DE PRODUCTO, textual: «Cuando ADI prioriza entre dominios, debe considerar materialidad + severidad +
 * urgencia de cada señal, no solo cuántos dominios coinciden.» Puede existir una prioridad POR DOMINIO (Falabella
 * primero en Comercial) y una prioridad INTEGRADA del negocio (Lider, si combina una brecha comercial material con un
 * riesgo de cobranza mucho más severo). «La prioridad final debe explicar su criterio. No quiero una fórmula rígida
 * inventada ni sumar magnitudes incompatibles; quiero que ADI use las señales comparables dentro de cada dominio y
 * después justifique cuál requiere atención primero.»
 *
 * EL ESTÁNDAR, como queda:
 *   1 · Cada dominio tiene TRES LENTES con señales de su propia boleta, citables verbatim:
 *         materialidad · cuánto está en juego (contribución sin capturar · saldo vencido · capital frenado);
 *         severidad    · cuán lejos de la referencia declarada (brecha al benchmark en pp · % recuperado · días de
 *                        inventario);
 *         urgencia     · la señal de tiempo del dominio (días de atraso · días sin venta). El comercial no trae señal
 *                        de tiempo en este dato, y se dice.
 *       Dentro del dominio, cada lente ORDENA a sus entidades (1º = la más grave). Eso es la prioridad POR DOMINIO:
 *       manda la materialidad, y la severidad y la urgencia la matizan.
 *   2 · La prioridad INTEGRADA compara entidades SEÑAL POR SEÑAL en los dominios que comparten (la clave real: el
 *       cliente entre comercial y cobranza), nunca por suma de montos de dominios distintos: va antes quien es más
 *       grave en más señales; en empate, quien tiene la señal de tiempo más grave; después, quien tiene más en juego
 *       en su dominio. Coincidir en dos dominios AGRAVA (hay más señales en contra), pero no decide por sí solo.
 *   3 · Las entidades de otra clave (los SKU del inventario) no se comparan con las cuentas: se ordenan aparte, con
 *       sus propias lentes, y entran al cierre como la prioridad de su dominio.
 *   4 · El criterio se dice con las señales que decidieron, con sus cifras: «Lider antes que Falabella: en cobranza es
 *       más grave en todas sus señales ($4.6M contra $2.5M vencidos, 269d contra 8d, 45% contra 57.7% recuperado) y
 *       está más lejos del benchmark (8.6 pp contra 8.1 pp); Falabella solo la supera en la brecha comercial».
 *   Lo que NO se hace: umbrales inventados, fórmulas que el dueño no pueda seguir, sumar o comparar magnitudes de
 *   dominios distintos. Todo lo que se cita sale de la boleta del turno.
 *
 * PURO · determinístico · sin red. Lo usan el ensamblador (cierre), la doctrina del encargo (la conclusión del
 * procedimiento viaja al cerebro ANTES de escribir) y el contrato (`prioridad-integrada-cambiada`). */

import { axisEntityNames } from "../oracle/entityIndex.js";   // los clientes del dato, para las lentes de ventas y crecimiento
import { declaradorDe } from "../notario/declarar.js";   // el Notario semántico (fase 2): el cierre declara MIENTRAS escribe, con el mismo estándar que el cerebro

const _lab = (f) => String((f && f.label) || "");
const _val = (f) => String((f && (f.text || f.value)) || "");
/* el concepto del rótulo («Lider · Saldo vencido» → «Saldo vencido»): la métrica con la que se declara cada señal, tal como la boleta la nombra */
const _conceptoDe = (label) => { const p = String(label || "").split("·").map((s) => s.trim()); return p.length >= 2 ? p.slice(1).join(" · ") : String(label || ""); };
/* los universos con los que se declaran los órdenes: el eje entero en palabras («los 13 clientes»), sin escribir el número a mano */
const _ejeEntero = (eje, palabra) => { try { const n = axisEntityNames(eje).length; return n ? `los ${n} ${palabra}` : `los ${palabra}`; } catch { return `los ${palabra}`; } };
const _num = (f) => {
  if (f && Number.isFinite(f.raw)) return f.raw;
  const s = _val(f).trim();
  const m = /^([+-])?\$\s?(-?[\d.,]+)\s?([KMB])?$/.exec(s);
  if (m) { const n = parseFloat(m[2].replace(",", ".")); const k = { K: 1e3, M: 1e6, B: 1e9 }[m[3]] || 1; return Number.isFinite(n) ? (m[1] === "-" ? -1 : 1) * n * k : NaN; }
  const p = /^(-?[\d.,]+)\s*(?:%|pp|d|x)$/.exec(s);
  return p ? parseFloat(p[1].replace(",", ".")) : NaN;
};
const _all = (figs, re) => (Array.isArray(figs) ? figs : []).filter((f) => re.test(_lab(f)));
const _entidadDe = (label) => { const p = String(label || "").split("·").map((s) => s.trim()); return p.length >= 2 ? p[0] : null; };

/* ── LAS LENTES DE CADA DOMINIO: rótulo de la boleta, nombre en palabras, y en qué sentido es «peor» ─────────── */
export const LENTES = {
  comercial: {
    clave: "cliente",
    materialidad: { re: /· Contribución no capturada$/i, nombre: "contribución sin capturar", peor: "mayor", como: (v) => `${v} sin capturar` },
    severidad: { re: /· Brecha al benchmark$/i, nombre: "distancia al benchmark", peor: "mayor", como: (v) => `${v} bajo el benchmark` },
    urgencia: null,   // el comercial no trae señal de tiempo en este dato
    universo: () => "los clientes bajo el benchmark",   // la contribución no capturada solo existe bajo el benchmark: ese es el conjunto que ordena la lente (y el de la proyección)
  },
  cobranza: {
    clave: "cliente",
    materialidad: { re: /· Saldo vencido$/i, nombre: "vencido", peor: "mayor", como: (v) => `${v} vencidos` },
    severidad: { re: /· Recuperado$/i, nombre: "recuperado", peor: "menor", como: (v) => `${v} recuperado` },
    urgencia: { re: /· Dias Vencido$/i, nombre: "atraso", peor: "mayor", como: (v) => `${v} de atraso` },
    universo: () => _ejeEntero("cliente", "clientes"),
  },
  inventario: {
    clave: "sku",
    materialidad: { re: /· Capital frenado$/i, nombre: "capital frenado", peor: "mayor", como: (v) => `${v} frenados` },
    severidad: { re: /· Días de inventario$/i, nombre: "días de inventario", peor: "mayor", como: (v) => `${v} de inventario` },
    urgencia: { re: /· Días sin venta$/i, nombre: "días sin venta", peor: "mayor", como: (v) => `${v} sin venta` },
    universo: () => "los SKU frenados",   // en la prioridad solo entran los SKU frenados (los que tienen días): el estado que la proyección declara
  },
};
const _LENTES = ["materialidad", "severidad", "urgencia"];
const MATERIALES = 3;   // las cuentas que «pesan» en un dominio: las tres de mayor materialidad (la convención de la casa: «los 3 de los 8 que más pesan»)

/** las señales de un dominio, por entidad, con el rango de cada lente (1 = la más grave) */
export function senalesDelDominio(figs, dominio) {
  const L = LENTES[dominio];
  if (!L) return [];
  const porEntidad = new Map();
  for (const lente of _LENTES) {
    const spec = L[lente];
    if (!spec) continue;
    for (const f of _all(figs, spec.re)) {
      const e = _entidadDe(_lab(f));
      const n = _num(f);
      if (!e || !Number.isFinite(n)) continue;
      if (!porEntidad.has(e)) porEntidad.set(e, { entidad: e, dominio });
      /* `rotulo`: el concepto del rótulo de la fig, con el que se DECLARA la señal (sujeto = la entidad, métrica = el concepto) */
      if (!porEntidad.get(e)[lente]) porEntidad.get(e)[lente] = { fmt: _val(f), n, rotulo: _conceptoDe(_lab(f)) };
    }
  }
  /* el inventario publica «capital frenado» también por bodega: en la prioridad solo entran los SKU (los que tienen días) */
  let filas = [...porEntidad.values()].filter((x) => x.materialidad);
  if (dominio === "inventario") filas = filas.filter((x) => x.severidad || x.urgencia);
  for (const lente of _LENTES) {
    const spec = L[lente];
    if (!spec) continue;
    const con = filas.filter((x) => x[lente]).sort((a, b) => (spec.peor === "mayor" ? b[lente].n - a[lente].n : a[lente].n - b[lente].n));
    con.forEach((x, i) => { x[lente].rango = i + 1; x[lente].de = con.length; });
  }
  filas.sort((a, b) => a.materialidad.rango - b.materialidad.rango);
  return filas.map((x) => ({ ...x, material: x.materialidad.rango <= MATERIALES }));
}

/* señal por señal: en los dominios que comparten, quién es más grave en cada lente */
function _comparar(a, b) {
  const gana = [], pierde = [];
  for (const dom of Object.keys(LENTES)) {
    const sa = a.senales[dom], sb = b.senales[dom];
    if (!sa || !sb) continue;
    for (const lente of _LENTES) {
      const spec = LENTES[dom][lente];
      if (!spec || !sa[lente] || !sb[lente]) continue;
      const peorA = spec.peor === "mayor" ? sa[lente].n > sb[lente].n : sa[lente].n < sb[lente].n;
      const peorB = spec.peor === "mayor" ? sb[lente].n > sa[lente].n : sb[lente].n < sa[lente].n;
      /* `metrica` y `peor`: con qué rótulo y en qué sentido se declara el comparativo («más grave en vencido» = mayor Saldo vencido) */
      const item = { dominio: dom, lente, nombre: spec.nombre, a: sa[lente].fmt, b: sb[lente].fmt, como: spec.como, metrica: sa[lente].rotulo, peor: spec.peor };
      if (peorA) gana.push(item); else if (peorB) pierde.push(item);
    }
  }
  return { gana, pierde };
}
const _mejorUrgencia = (e) => Math.min(...Object.values(e.senales).map((s) => (s.urgencia ? s.urgencia.rango : Infinity)));
/* la señal de tiempo de una cuenta, en palabras (la primera que tenga; «sin señal de tiempo» si ninguna) */
const _tiempoDe = (e) => { for (const d of Object.keys(e.senales)) { const s = e.senales[d]; if (s.urgencia && LENTES[d].urgencia) return LENTES[d].urgencia.como(s.urgencia.fmt); } return null; };
const _mejorMaterialidad = (e) => Math.min(...Object.values(e.senales).map((s) => (s.materialidad ? s.materialidad.rango : Infinity)));

/**
 * prioridadIntegrada(figs, dominios) → { porDominio, integrada, criterio } | null
 *   porDominio · { dominio → [señales por entidad, ordenadas por materialidad] }
 *   integrada  · las entidades de clave «cliente» que son materiales en algún dominio, ordenadas señal por señal
 */
export function prioridadIntegrada(figs, dominios = []) {
  const doms = (dominios || []).filter((d) => LENTES[d]);
  if (!doms.length) return null;
  const porDominio = {};
  for (const d of doms) { const s = senalesDelDominio(figs, d); if (s.length) porDominio[d] = s; }
  if (!Object.keys(porDominio).length) return null;
  /* las cuentas: una entidad por nombre, con sus señales en cada dominio de clave cliente donde es material */
  const cuentas = new Map();
  for (const d of Object.keys(porDominio)) {
    if (LENTES[d].clave !== "cliente") continue;
    for (const x of porDominio[d]) {
      if (!cuentas.has(x.entidad)) cuentas.set(x.entidad, { entidad: x.entidad, senales: {}, dominios: [] });
      const c = cuentas.get(x.entidad);
      c.senales[d] = x;
      if (x.material) c.dominios.push(d);
    }
  }
  const lista = [...cuentas.values()].filter((c) => c.dominios.length);
  /* señal por señal, todas contra todas: va antes quien es más grave en más señales que sus pares */
  for (const c of lista) {
    c.victorias = 0; c.contra = {};
    for (const o of lista) {
      if (o === c) continue;
      const r = _comparar(c, o);
      c.contra[o.entidad] = r;
      if (r.gana.length > r.pierde.length) c.victorias++;
    }
  }
  lista.sort((a, b) => (b.victorias - a.victorias) || (_mejorUrgencia(a) - _mejorUrgencia(b)) || (_mejorMaterialidad(a) - _mejorMaterialidad(b)) || a.entidad.localeCompare(b.entidad));
  const integrada = lista.map((c, i) => ({
    entidad: c.entidad, dominios: c.dominios, senales: c.senales,
    versus: i + 1 < lista.length ? { contra: lista[i + 1].entidad, ...c.contra[lista[i + 1].entidad], tiempo: { a: _tiempoDe(c), b: _tiempoDe(lista[i + 1]) }, contraSenales: lista[i + 1].senales } : null,   // `contraSenales`: para declarar «más en juego en su dominio» contra la cifra de la siguiente
  }));
  return { porDominio, integrada, criterio: CRITERIO };
}

export const CRITERIO = "dentro de cada dominio, materialidad (cuánto está en juego), severidad (distancia a la referencia declarada) y urgencia (la señal de tiempo); entre dominios, señal por señal —no por suma de montos—; coincidir en dos dominios agrava, no decide.";

/* ══ EL CRITERIO DEL USUARIO MANDA (owner 2026-09-14, corrección del estándar) ═══════════════════════════════════════
 * «La prioridad no debe ser rígida ni pertenecer siempre al procedimiento. Depende del objetivo del usuario.» La jerarquía:
 *   1 · criterio EXPLÍCITO del usuario → manda («prioriza ventas», «prioriza caja», «prioriza riesgo», «quiero recuperar
 *       contribución», «ahora ordénamelo por caja»).
 *   2 · criterio IMPLÍCITO pero claro → ADI lo interpreta sin preguntar («mayor riesgo económico» → materialidad +
 *       severidad + urgencia).
 *   3 · multidominio realmente ambiguo → ADI puede preguntar qué lente quiere usar, sobre todo si distintos criterios
 *       producen prioridades distintas.
 *   4 · lectura ejecutiva general → no frenar al usuario: ADI entrega una prioridad ejecutiva propia (la de la casa: el
 *       riesgo integrado), declara el criterio y, si es material, indica que otra lente cambiaría el orden.
 * Lider primero queda asociado al criterio de RIESGO INTEGRADO de estos fixtures, no convertido en prioridad universal. Y
 * el usuario puede cambiar el criterio después («ahora ordénamelo por caja», «ahora por contribución») sin que cambien los
 * hechos: las mismas señales, otro orden. El respaldo nunca pregunta (no conversa): entrega con el criterio declarado y
 * ofrece reordenar; el cerebro recibe la jerarquía y puede preguntar solo en el caso 3. */
export const CRITERIOS = {
  riesgo:       { nombre: "riesgo integrado", dicho: "materialidad + severidad + urgencia, señal por señal entre dominios", clave: "cliente" },
  contribucion: { nombre: "contribución", dicho: "la contribución sin capturar del período, la brecha comercial", clave: "cliente", dominio: "comercial", lente: "materialidad" },
  caja:         { nombre: "cobranza", dicho: "el saldo vencido al corte y su atraso", clave: "cliente", dominio: "cobranza", lente: "materialidad", desempate: "urgencia" },   // se pide como «caja», «cobranza» o «liquidez»; en pantalla se dice «cobranza» (la palabra «caja» junto a una contribución dispara la naturaleza económica del muro)
  ventas:       { nombre: "ventas", dicho: "la venta del período", clave: "cliente" },
  crecimiento:  { nombre: "crecimiento", dicho: "la variación de la venta contra el año anterior", clave: "cliente", figs: /· YoY$/i },
  capital:      { nombre: "capital", dicho: "el capital frenado en inventario", clave: "sku", dominio: "inventario", lente: "materialidad" },
};
const _SINONIMOS = [
  [/\b(?:riesgo|riesgos|grave|graves|gravedad|urgente|urgencia|peligro)\b/i, "riesgo"],
  [/\b(?:contribuci[oó]n|margen|m[aá]rgenes|rentabilidad|brecha)\b/i, "contribucion"],
  [/\b(?:caja|cobranza|cobrar|cobro|liquidez|vencido|vencidos|saldo)\b/i, "caja"],
  [/\b(?:crecimiento|crecer|crece|crecen)\b/i, "crecimiento"],
  [/\b(?:ventas?|volumen|facturaci[oó]n)\b/i, "ventas"],
  [/\b(?:capital|inventario|stock|frenado)\b/i, "capital"],
];
const _criterioDe = (palabra) => { for (const [re, c] of _SINONIMOS) if (re.test(String(palabra))) return c; return null; };
const _OBJ = "(?:ventas?|volumen|facturaci[oó]n|caja|cobranza|cobro|liquidez|riesgo|riesgos|contribuci[oó]n|margen|m[aá]rgenes|rentabilidad|crecimiento|capital|inventario|stock)";
/* explícito: el usuario nombra el criterio con un verbo de ordenar o de objetivo */
const _EXPLICITO = [
  new RegExp(`\\bprioriz[ae]\\w*\\s+(?:por\\s+|la\\s+|el\\s+|las\\s+|los\\s+)?(${_OBJ})`, "i"),
  new RegExp(`\\b(?:ord[eé]n\\w*|reord[eé]n\\w*|rank\\w*|clasif[ií]c\\w*)\\s*(?:me)?(?:lo|la|los|las)?\\s+(?:ahora\\s+)?por\\s+(?:la\\s+|el\\s+)?(${_OBJ})`, "i"),
  new RegExp(`\\b(?:ahora|mejor|entonces)\\s+por\\s+(?:la\\s+|el\\s+)?(${_OBJ})`, "i"),
  new RegExp(`\\b(?:quiero|necesito|me interesa|busco)\\s+(?:recuperar|liberar|cobrar|proteger|cuidar|maximizar|mejorar)\\s+(?:la\\s+|el\\s+)?(${_OBJ})`, "i"),
  new RegExp(`\\b(?:con|desde|bajo)\\s+(?:la\\s+)?(?:lente|criterio|[oó]ptica|mirada)\\s+de\\s+(?:la\\s+|el\\s+)?(${_OBJ})`, "i"),
  new RegExp(`\\b(?:criterio|lente)\\s*:\\s*(${_OBJ})`, "i"),
  new RegExp(`\\blo que (?:m[aá]s )?me importa (?:es|son)\\s+(?:la\\s+|el\\s+|las\\s+|los\\s+)?(${_OBJ})`, "i"),
];
/* implícito pero claro: la pregunta describe el OBJETIVO sin nombrar la lente. Solo el riesgo: en un encargo compuesto «riesgo de
 * cobranza» o «dejo contribución sobre la mesa» son PARTES pedidas, no el criterio de la prioridad (medido: el primer prompt de
 * producción salía ordenado «por cobranza» por nombrar el riesgo de cobranza de sus principales clientes) */
const _IMPLICITO = [
  [/\bmayor riesgo\b|\briesgo econ[oó]mico\b|\blo m[aá]s grave\b|\bdeber[ií]a preocupar|\bqu[eé] (?:me|te|nos) preocupa\b|\bd[oó]nde (?:est[aá]|tengo) (?:hoy )?(?:el )?(?:mayor )?riesgo\b|\bm[aá]s urgente\b/i, "riesgo"],
];
/** criterioDeLaPregunta(q) → { criterio, modo: "explicito" | "implicito" } | null */
export function criterioDeLaPregunta(pregunta) {
  const q = String(pregunta || "");
  for (const re of _EXPLICITO) { const m = re.exec(q); if (m) { const c = _criterioDe(m[1]); if (c) return { criterio: c, modo: "explicito" }; } }
  for (const [re, c] of _IMPLICITO) if (re.test(q)) return { criterio: c, modo: "implicito" };
  return null;
}

/* el orden bajo un criterio: la lista de entidades con el valor que las ordena (en palabras), de la más grave a la menos.
 * Junto a la lista viaja CON QUÉ SE DECLARA (Notario, fase 2): la métrica del rótulo que ordena, su dirección y su universo, y en cada
 * línea las cifras que la componen (`cifras: [{metrica, valor}]`; `variacion` cuando la cifra es una variación contra el año anterior).
 * Y el conteo con el que se declara la cola «(y N más)» solo cuando el predicado es de la casa y la lista lo cumple entera (cobranza:
 * cuentas con saldo vencido; inventario: SKU frenados) — una lista de la boleta no es un conteo del negocio, y no se inventa uno. */
export function ordenPorCriterio(figs, dominios = [], criterio = "riesgo") {
  const C = CRITERIOS[criterio];
  if (!C) return null;
  if (criterio === "riesgo") {
    const P = prioridadIntegrada(figs, dominios);
    if (!P || !P.integrada.length) return null;
    return { criterio, lista: P.integrada.map((c) => ({ entidad: c.entidad, valor: null, cifras: [] })), P };
  }
  if (C.dominio) {
    if (dominios.length && !dominios.includes(C.dominio)) return null;
    const s = senalesDelDominio(figs, C.dominio);
    if (!s.length) return null;
    const L = LENTES[C.dominio];
    const lista = s.slice().sort((a, b) => (a.materialidad.rango - b.materialidad.rango) || (C.desempate && a[C.desempate] && b[C.desempate] ? a[C.desempate].rango - b[C.desempate].rango : 0))
      .map((x) => ({ entidad: x.entidad, valor: [L.materialidad.como(x.materialidad.fmt), C.desempate && x[C.desempate] ? L[C.desempate].como(x[C.desempate].fmt) : null].filter(Boolean).join(", "),
        cifras: [{ metrica: x.materialidad.rotulo, valor: x.materialidad.fmt }, ...(C.desempate && x[C.desempate] ? [{ metrica: x[C.desempate].rotulo, valor: x[C.desempate].fmt }] : [])] }));
    const conteo = C.dominio === "cobranza" && s.every((x) => x.materialidad.n > 0) ? { predicado: "con saldo vencido", universo: _ejeEntero("cliente", "clientes") }
      : C.dominio === "inventario" ? { predicado: "frenados", universo: _ejeEntero("sku", "SKU") } : null;
    return { criterio, lista, metrica: lista[0].cifras[0].metrica, direccion: L.materialidad.peor, universo: L.universo(), conteo };
  }
  /* ventas · crecimiento: cifras por cliente de la boleta (la venta del flujo cubre a todos los clientes; si no está, la de margen) */
  const clientes = new Set((() => { try { return axisEntityNames("cliente"); } catch { return []; } })());
  const fuente = criterio === "ventas" ? (_all(figs, /· Venta \(flujo\)$/i).length ? _all(figs, /· Venta \(flujo\)$/i) : _all(figs, /· Venta$/i)) : _all(figs, C.figs);
  const vistos = new Set();
  const filas = fuente.map((f) => ({ entidad: _entidadDe(_lab(f)), fmt: _val(f), n: _num(f), rotulo: _conceptoDe(_lab(f)) }))
    .filter((x) => x.entidad && Number.isFinite(x.n) && (!clientes.size || clientes.has(x.entidad)) && (vistos.has(x.entidad) ? false : (vistos.add(x.entidad), true)))
    .sort((a, b) => b.n - a.n);
  if (!filas.length) return null;
  const esVariacion = criterio !== "ventas";
  return { criterio, lista: filas.map((x) => ({ entidad: x.entidad, valor: criterio === "ventas" ? `${x.fmt} de venta` : `${x.fmt} contra el año anterior`, cifras: [{ metrica: x.rotulo, valor: x.fmt, ...(esVariacion ? { variacion: x.n > 0 ? "sube" : x.n < 0 ? "baja" : "estable" } : {}) }] })),
    metrica: filas[0].rotulo, direccion: "mayor", universo: _ejeEntero("cliente", "clientes"), conteo: null };
}
/* las cifras de una línea de lista, declaradas sobre su tramo: una variación se declara como tal (dirección y magnitud, contra el año anterior) */
const _declararCifras = (D, entidad, cifras, texto) => {
  for (const c of cifras || []) {
    if (c.variacion) D.variacion({ sujeto: entidad, metrica: "Ventas", direccion: c.variacion, valor: c.valor, texto });
    else D.cifra({ sujeto: entidad, metrica: c.metrica, valor: c.valor, texto });
  }
};
/** quién va primero bajo cada criterio disponible con esta boleta — para decir «con otra lente el orden cambia» */
export function primerosPorCriterio(figs, dominios = []) {
  const out = {};
  /* la primera de cada lente, con la métrica, la dirección y el universo del orden que la puso primero (para declararlo) */
  for (const c of Object.keys(CRITERIOS)) { const o = ordenPorCriterio(figs, dominios, c); if (o && o.lista.length) out[c] = { ...o.lista[0], metrica: o.metrica || null, direccion: o.direccion || null, universo: o.universo || null }; }
  return out;
}
/* las lentes de clave cliente cuya primera es DISTINTA de la del criterio en uso, en palabras. Con colector, cada «por X, Y primero (cifra)»
 * se declara sobre su propio tramo: el orden máximo de esa lente (con su métrica y su universo) y la cifra; «por riesgo integrado, Y primero»
 * no ordena una métrica —es la conclusión del procedimiento— y va como lectura con sello. */
const _otrasLentes = (figs, dominios, criterio, D = declaradorDe(null)) => {
  const P1 = primerosPorCriterio(figs, dominios);
  const base = P1[criterio];
  if (!base) return "";
  const otras = Object.keys(P1).filter((c) => c !== criterio && CRITERIOS[c].clave === "cliente" && P1[c].entidad !== base.entidad);
  if (!otras.length) return "";
  const tramo = (c) => {
    const t = `por ${CRITERIOS[c].nombre}, ${P1[c].entidad} primero${P1[c].valor ? ` (${P1[c].valor})` : ""}`;
    if (P1[c].metrica) {
      D.orden({ sujeto: P1[c].entidad, metrica: P1[c].metrica, forma: P1[c].direccion === "menor" ? "min" : "max", universo: P1[c].universo, texto: t });
      _declararCifras(D, P1[c].entidad, P1[c].cifras, t);
    } else D.lectura({ texto: t, sello: "criterio mío" });
    return t;
  };
  return `Con otra lente cambia quién va primero: ${otras.map(tramo).join("; ")}.`;
};
const _MODO_TXT = { explicito: "el criterio que pediste", implicito: "el criterio que se lee en tu pregunta" };

/* ── EN PALABRAS: el cierre del ensamblador y la conclusión que viaja al cerebro ────────────────────────────────── */
const _DOM_TXT = { comercial: "comercial", cobranza: "cobranza", inventario: "inventario" };
/* ── LO QUE DECLARA EL CIERRE (Notario semántico, fase 2 · owner 2026-09-15) ────────────────────────────────────────────
 * El mismo estándar que el cerebro, sin camino privilegiado: cada cifra de una señal es una CIFRA (sujeto = la cuenta o el SKU,
 * métrica = el concepto del rótulo de la fig); «comercial → Falabella (…)» es el ORDEN máximo de la lente de materialidad en su
 * universo; «más lejos de la referencia», «más urgente», «más grave en…», «solo la supera en…» son órdenes COMPARATIVOS (con quién y
 * en qué sentido); la cabecera «Dónde pondría el foco primero…» y la línea «Criterio: …» son LECTURA con sello «criterio mío» — la
 * prioridad integrada es la conclusión del procedimiento, no un ranking de una métrica, y las listas «1. Lider … 2. Falabella …»
 * declaran los hechos de cada línea, no el puesto. Cada declaración lleva como `texto` el TRAMO literal que la escribe (único en el
 * bloque: el detector de presencia cubre por tramo, y un mismo tramo repetido se ubica una sola vez). Sin colector, todo es mudo. */
const _senalesDe = (D, entidad, x, texto) => { for (const l of _LENTES) if (x[l]) D.cifra({ sujeto: entidad, metrica: x[l].rotulo, valor: x[l].fmt, texto }); };
const _lider = (x, dominio, D = declaradorDe(null)) => {
  const L = LENTES[dominio];
  const partes = [L.materialidad.como(x.materialidad.fmt)];
  if (x.severidad) partes.push(L.severidad.como(x.severidad.fmt));
  if (x.urgencia) partes.push(L.urgencia.como(x.urgencia.fmt));
  const t = `${x.entidad} (${partes.join(", ")})`;
  /* la líder del dominio: el extremo de la lente de materialidad en su universo, y sus tres señales como cifras */
  D.orden({ sujeto: x.entidad, metrica: x.materialidad.rotulo, forma: L.materialidad.peor === "menor" ? "min" : "max", universo: L.universo(), texto: t });
  _senalesDe(D, x.entidad, x, t);
  return t;
};
/* por qué el segundo de un dominio no va primero en él, cuando le gana al líder en alguna otra lente */
const _matiz = (porDominio, dominio, D = declaradorDe(null)) => {
  const s = porDominio[dominio];
  if (!s || s.length < 2) return "";
  const p = s[0];
  /* entre las materiales, las que son más graves que el líder en severidad o urgencia (la materialidad manda; esto matiza) */
  const matices = s.slice(1, MATERIALES).map((q) => ({ q, gana: _LENTES.filter((l) => l !== "materialidad" && q[l] && p[l] && q[l].rango < p[l].rango) })).filter((x) => x.gana.length);
  if (!matices.length) return "";
  const L = LENTES[dominio];
  /* cada lente en que gana: un comparativo contra la líder sobre SU tramo («más urgente (112d contra 94d)»), con la cifra de la segunda */
  const lente = (q, l) => {
    const t = `${l === "severidad" ? "más lejos de la referencia" : "más urgente"} (${q[l].fmt} contra ${p[l].fmt})`;
    D.orden({ sujeto: q.entidad, metrica: q[l].rotulo, forma: "comparativo", direccion: L[l].peor, vs: p.entidad, texto: t });
    D.cifra({ sujeto: q.entidad, metrica: q[l].rotulo, valor: q[l].fmt, texto: t });
    return t;
  };
  const matiz = (q, gana) => {
    const cabeza = `${q.entidad} ${L.materialidad.como(q.materialidad.fmt)}`;
    D.cifra({ sujeto: q.entidad, metrica: q.materialidad.rotulo, valor: q.materialidad.fmt, texto: cabeza });
    return `${cabeza} y ${gana.map((l) => lente(q, l)).join(" y ")}`;
  };
  return "; " + matices.map(({ q, gana }) => matiz(q, gana)).join("; ");
};
/* la línea de una cuenta en la lista integrada: sus señales, y contra la siguiente, en qué gana y en qué pierde */
const _lineaIntegrada = (c, i, total, D = declaradorDe(null), figs = []) => {
  const senales = Object.keys(c.senales).map((d) => `${_DOM_TXT[d]}: ${_LENTES.filter((l) => c.senales[d][l]).map((l) => LENTES[d][l].como(c.senales[d][l].fmt)).join(", ")}`).join(" · ");
  const cabeza = `${i + 1}. ${c.entidad} — ${senales}`;
  for (const d of Object.keys(c.senales)) _senalesDe(D, c.entidad, c.senales[d], cabeza);
  let razon = "";
  if (c.versus) {
    const { contra, gana, pierde } = c.versus;
    const porDom = (items) => { const m = new Map(); for (const it of items) { if (!m.has(it.dominio)) m.set(it.dominio, []); m.get(it.dominio).push(it); } return m; };
    const g = porDom(gana), p = porDom(pierde);
    const dice = (m, sujeto) => [...m.entries()].map(([d, items]) => `en ${_DOM_TXT[d]}, ${items.map((it) => `${it.nombre} (${sujeto === "a" ? it.a : it.b} contra ${sujeto === "a" ? it.b : it.a})`).join(", ")}`).join("; ");
    /* las comparaciones, declaradas sobre el tramo que las escribe: cada «nombre (x contra y)» es un comparativo en su métrica —quien va
     * delante en el tramo es el sujeto— y las dos cifras van declaradas con su dueño (la de la siguiente puede no tener línea propia) */
    const comparativos = (items, sujeto, texto) => {
      for (const it of items) {
        const [quien, otro] = sujeto === "a" ? [c.entidad, contra] : [contra, c.entidad];
        D.orden({ sujeto: quien, metrica: it.metrica, forma: "comparativo", direccion: it.peor, vs: otro, texto });
        D.cifra({ sujeto: c.entidad, metrica: it.metrica, valor: it.a, texto });
        D.cifra({ sujeto: contra, metrica: it.metrica, valor: it.b, texto });
      }
    };
    const masGrave = () => { const t = `más grave ${dice(g, "a")}`; comparativos(gana, "a", t); return t; };
    const supera = (solo) => { const t = `${contra} ${solo ? "solo la supera" : "la supera"} ${dice(p, "b")}`; comparativos(pierde, "b", t); return t; };
    const tiempo = c.versus.tiempo || {};
    if (gana.length > pierde.length) razon = ` — antes que ${contra}: ${masGrave()}${pierde.length ? `; ${supera(true)}` : ""}.`;
    else if (tiempo.a && !tiempo.b) {
      /* la señal de tiempo de la cuenta es una cifra; «sin señal de tiempo» de la siguiente es su estado cuando su fila de cobranza
       * está en la boleta sin saldo vencido (la misma lectura que hace la cobranza cruzada) — si no está, no se afirma nada de ella */
      const t = `por la señal de tiempo (${tiempo.a}; ${contra} sin señal de tiempo)`;
      const dt = Object.keys(c.senales).find((d) => c.senales[d].urgencia && LENTES[d].urgencia);   // la misma señal que imprime _tiempoDe: la primera con lente de tiempo
      if (dt) D.cifra({ sujeto: c.entidad, metrica: c.senales[dt].urgencia.rotulo, valor: c.senales[dt].urgencia.fmt, texto: t });
      const enCobranza = (figs || []).some((f) => _lab(f) === `${contra} · Saldo pendiente`), conVencido = (figs || []).some((f) => _lab(f) === `${contra} · Saldo vencido`);
      if (enCobranza && !conVencido) D.estado({ sujeto: contra, estado: "sin vencido", texto: `${contra} sin señal de tiempo` });
      razon = ` — antes que ${contra} ${t}${gana.length ? `: ${masGrave()}` : ""}${pierde.length ? `; ${supera(false)}` : ""}.`;
    } else if (tiempo.a && tiempo.b) {
      /* las dos señales de tiempo: un comparativo en la lente de urgencia del dominio que las trae (para las cuentas, la cobranza) */
      const t = `por la señal de tiempo (${tiempo.a} contra ${tiempo.b})`;
      for (const d of Object.keys(c.senales)) {
        const u = c.senales[d].urgencia, v = c.versus.contraSenales && c.versus.contraSenales[d] && c.versus.contraSenales[d].urgencia;
        if (!u || !v) continue;
        D.orden({ sujeto: c.entidad, metrica: u.rotulo, forma: "comparativo", direccion: LENTES[d].urgencia.peor, vs: contra, texto: t });
        D.cifra({ sujeto: c.entidad, metrica: u.rotulo, valor: u.fmt, texto: t });
        D.cifra({ sujeto: contra, metrica: v.rotulo, valor: v.fmt, texto: t });
        break;
      }
      razon = ` — antes que ${contra} ${t}${gana.length ? `: ${masGrave()}` : ""}${pierde.length ? `; ${supera(false)}` : ""}.`;
    } else {
      /* «más en juego en su dominio»: la materialidad de la cuenta contra la de la siguiente en el dominio donde la cuenta pesa más —
       * un comparativo solo si la siguiente tiene esa señal; si no la tiene, no hay dos cifras que comparar y no se declara */
      const t = `antes que ${contra} por tener más en juego en su dominio`;
      const mejor = Object.keys(c.senales).filter((d) => c.senales[d].materialidad).sort((x, y) => c.senales[x].materialidad.rango - c.senales[y].materialidad.rango)[0];
      const v = mejor && c.versus.contraSenales && c.versus.contraSenales[mejor] && c.versus.contraSenales[mejor].materialidad;
      if (v) D.orden({ sujeto: c.entidad, metrica: c.senales[mejor].materialidad.rotulo, forma: "comparativo", direccion: LENTES[mejor].materialidad.peor, vs: contra, texto: t });
      razon = ` — ${t}${pierde.length ? `, aunque ${supera(false)}` : ""}.`;
    }
  } else if (i === total - 1 && total > 1) {
    razon = ".";
  }
  return `${cabeza}${razon}`;
};

/** componerPrioridadIntegrada(figs, dominios, { criterio, modo, declarar }) → el bloque de cierre, o null sin señales.
 *  Sin criterio: la prioridad ejecutiva de la casa (riesgo integrado), declarada como tal, con la nota de otras lentes.
 *  `declarar`: el colector del Notario (fase 2); sin él, el bloque se compone igual, byte a byte, sin declarar. */
export function componerPrioridadIntegrada(figs, dominios = [], { criterio = null, modo = null, declarar = null } = {}) {
  const D = declaradorDe(declarar);
  const usa = criterio && CRITERIOS[criterio] ? criterio : "riesgo";
  if (usa !== "riesgo") {
    const O = ordenPorCriterio(figs, dominios, usa);
    if (!O) return null;
    const C = CRITERIOS[usa];
    const cabecera = `Dónde pondría el foco primero — por ${C.nombre}, ${_MODO_TXT[modo] || "el criterio que pediste"} (${C.dicho}):`;
    const L = [cabecera];
    /* bajo una lente, la lista ES un orden top-k sobre la métrica de la lente (el criterio del usuario eligió la lente, no el puesto):
     * se declara con los nombres impresos sobre la cabecera; cada línea, con sus cifras */
    const top = O.lista.slice(0, 3);
    if (O.metrica) D.orden({ sujeto: top.map((x) => x.entidad), metrica: O.metrica, forma: "topk", k: top.length, direccion: O.direccion, universo: O.universo, texto: cabecera });
    else D.lectura({ texto: cabecera, sello: "criterio mío" });
    top.forEach((x, i) => { const l = `${i + 1}. ${x.entidad}${x.valor ? ` — ${x.valor}` : ""}`; L.push(l); _declararCifras(D, x.entidad, x.cifras, l); });
    if (O.lista.length > 3) { const cola = `(y ${O.lista.length - 3} más)`; L.push(cola); if (O.conteo) D.conteo({ n: O.lista.length, predicado: O.conteo.predicado, universo: O.conteo.universo, texto: cola }); }
    const otras = _otrasLentes(figs, dominios, usa, D);
    if (otras) L.push(`${otras} Los hechos no cambian con la lente; cambia quién va primero. Dime por cuál quieres que lo reordene.`);
    const criterioTxt = `Criterio: ${C.nombre} (${C.dicho}); las cifras de dominios distintos no se suman ni se comparan entre sí.`;
    L.push(criterioTxt);
    D.lectura({ texto: criterioTxt, sello: "criterio mío" });
    return L.join("\n");
  }
  const P = prioridadIntegrada(figs, dominios);
  if (!P) return null;
  const doms = Object.keys(P.porDominio);
  const cabecera = modo
    ? `Dónde pondría el foco primero — por riesgo integrado, ${_MODO_TXT[modo]} (materialidad + severidad + urgencia, señal por señal, sin sumar montos entre dominios):`
    : `Dónde pondría el foco primero — criterio ejecutivo de ADI, porque no fijaste otro: riesgo integrado (materialidad + severidad + urgencia, señal por señal, sin sumar montos entre dominios):`;
  const L = [cabecera];
  D.lectura({ texto: cabecera, sello: "criterio mío" });
  L.push(`Por dominio: ${doms.map((d) => `${_DOM_TXT[d]} → ${_lider(P.porDominio[d][0], d, D)}${_matiz(P.porDominio, d, D)}`).join(" · ")}.`);
  if (P.integrada.length >= 2) {
    L.push(`Integrada, entre las cuentas${doms.includes("comercial") && doms.includes("cobranza") ? " (la clave real entre comercial y cobranza es el cliente)" : ""}:`);
    P.integrada.slice(0, 3).forEach((c, i) => L.push(_lineaIntegrada(c, i, Math.min(3, P.integrada.length), D, figs)));
  } else if (P.integrada.length === 1) {
    const sola = P.integrada[0];
    const l = `Integrada: ${sola.entidad} — ${Object.keys(sola.senales).map((d) => `${_DOM_TXT[d]}: ${_LENTES.filter((l) => sola.senales[d][l]).map((l) => LENTES[d][l].como(sola.senales[d][l].fmt)).join(", ")}`).join(" · ")}.`;
    L.push(l);
    for (const d of Object.keys(sola.senales)) _senalesDe(D, sola.entidad, sola.senales[d], l);
  }
  if (P.porDominio.inventario) {
    const s = P.porDominio.inventario[0];
    const l = `En inventario (clave SKU: no se compara con las cuentas): ${s.entidad} primero — ${_LENTES.filter((l) => s[l]).map((l) => LENTES.inventario[l].como(s[l].fmt)).join(", ")}.`;
    L.push(l);
    /* el primero del inventario: el extremo de su lente de materialidad entre los SKU frenados, con sus señales como cifras */
    D.orden({ sujeto: s.entidad, metrica: s.materialidad.rotulo, forma: LENTES.inventario.materialidad.peor === "menor" ? "min" : "max", universo: LENTES.inventario.universo(), texto: l });
    _senalesDe(D, s.entidad, s, l);
  }
  if (!P.porDominio.comercial || !LENTES.comercial.urgencia) L.push(`El comercial no trae señal de tiempo en este dato: ahí la prioridad es por materialidad y distancia al benchmark.`);
  const otras = _otrasLentes(figs, dominios, "riesgo", D);
  if (otras) L.push(`${otras} Los hechos no cambian con la lente; cambia quién va primero. Dime por cuál quieres que lo reordene.`);
  const criterioTxt = `Criterio: ${P.criterio}`;
  L.push(criterioTxt);
  D.lectura({ texto: criterioTxt, sello: "criterio mío" });
  return L.join("\n");
}

/** la conclusión del procedimiento sobre la prioridad, para el cerebro: con el criterio del usuario si lo hay; si no, la
 *  jerarquía (lectura ejecutiva con el criterio declarado; preguntar solo si es realmente ambiguo) */
export function conclusionDePrioridad(figs, dominios = [], { criterio = null, modo = null } = {}) {
  const usa = criterio && CRITERIOS[criterio] ? criterio : "riesgo";
  const P1 = primerosPorCriterio(figs, dominios);
  const otras = _otrasLentes(figs, dominios, usa);
  if (usa !== "riesgo") {
    const O = ordenPorCriterio(figs, dominios, usa);
    if (!O) return "";
    const C = CRITERIOS[usa];
    return [
      `[PRIORIDAD DEL PROCEDIMIENTO — no es el usuario] El usuario fijó el criterio${modo === "implicito" ? " (se lee en su pregunta)" : ""}: ${C.nombre} — ${C.dicho}. Se conserva; el cerebro lo explica, no lo cambia:`,
      `- bajo ese criterio: ${O.lista.slice(0, 3).map((x, i) => `${i + 1}º ${x.entidad}${x.valor ? ` (${x.valor})` : ""}`).join(" · ")}.`,
      otras ? `- ${otras} Dilo si es material, sin cambiar la prioridad pedida.` : null,
      `- cada cifra tal cual está en la boleta; nada de sumar o comparar montos de dominios distintos.`,
    ].filter(Boolean).join("\n");
  }
  const P = prioridadIntegrada(figs, dominios);
  if (!P) return "";
  const doms = Object.keys(P.porDominio);
  const L = [modo
    ? `[PRIORIDAD DEL PROCEDIMIENTO — no es el usuario] El criterio se lee en la pregunta del usuario: riesgo integrado (materialidad + severidad + urgencia). Se conserva; el cerebro lo explica, no lo cambia:`
    : `[PRIORIDAD DEL PROCEDIMIENTO — no es el usuario] El usuario NO fijó criterio. La jerarquía: (1) si lo fija, manda; (2) si se lee en su pregunta, se interpreta; (3) si el encargo es realmente ambiguo entre lentes que dan órdenes distintos, puedes preguntarle qué lente quiere; (4) en una lectura ejecutiva general no lo frenes: entrega una prioridad ejecutiva con el criterio DECLARADO. La de la casa es el riesgo integrado (materialidad + severidad + urgencia):`];
  L.push(`- por dominio: ${doms.map((d) => `${_DOM_TXT[d]} → ${_lider(P.porDominio[d][0], d)}`).join(" · ")}.`);
  if (P.integrada.length) {
    L.push(`- integrada (las cuentas, señal por señal): ${P.integrada.slice(0, 3).map((c, i) => `${i + 1}º ${c.entidad}`).join(" · ")}.${P.integrada[0].versus && P.integrada[0].versus.gana.length ? ` ${P.integrada[0].entidad} va antes que ${P.integrada[0].versus.contra} porque es más grave en ${P.integrada[0].versus.gana.map((it) => `${it.nombre} (${it.a} contra ${it.b})`).join(", ")}${P.integrada[0].versus.pierde.length ? `; ${P.integrada[0].versus.contra} solo la supera en ${P.integrada[0].versus.pierde.map((it) => `${it.nombre} (${it.b} contra ${it.a})`).join(", ")}` : ""}.` : ""}`);
  }
  if (P.porDominio.inventario) L.push(`- inventario (clave SKU, aparte de las cuentas): ${P.porDominio.inventario[0].entidad} primero.`);
  if (otras) L.push(`- ${otras}${modo ? " Dilo si es material." : " Si eliges otra lente, decláralo; si preguntas, pregunta cuál lente quiere en vez de decidir sin decirlo."}`);
  L.push(`- el criterio se dice siempre: ${P.criterio} Nada de sumar o comparar montos de dominios distintos; cada cifra tal cual está en la boleta. Nunca des «coincide en dos dominios» como LA razón de ir primero: la razón son las señales bajo el criterio (materialidad, severidad, urgencia) — la coincidencia agrava el caso, no lo decide.`);
  return L.join("\n");
}

/** la ley: la prioridad que cierra la respuesta es la del criterio del usuario; sin criterio, es la de alguna lente y el
 *  criterio está declarado (o la respuesta pregunta qué lente usar) */
const _PRIORIDAD = /\bprimero\b|\bprioridad|\bprioritari|\bfoco\b|\bantes que\b|\bentrar[ií]a\b|\bpartir[ií]a\b|\bempezar[ií]a\b|\barrancar[ií]a\b|\bir[ií]a\s+por\b|\bmayor riesgo\b/i;   // «iría por Lider» también es una prioridad (2026-09-14)
/* «Entre los que más venden, Falabella primero ($19.4M), después Lider» y «En vencido, Lider va primero» son un RANKING, no la prioridad del
 * cierre (owner 2026-09-14, el orden en todas sus formas · fp-listas P9): el «primero» que va con una métrica de orden («por venta», «en
 * contribución», «entre los que más X», «ordenados por», «ranking») no dispara esta ley; el de una lente («por riesgo integrado») sí. */
const _METRICA_DE_ORDEN = "ventas?|factura\\p{L}*|contribuci[oó]n|m[aá]rgen(?:es)?|carga|unidades|vencid[oa]s?|saldo|mora|atraso|recuperaci[oó]n|brecha|capital|rotaci[oó]n|d[ií]as";
const _PRIMERO_DE_RANKING = new RegExp(`(?:\\b(?:entre|de)\\s+(?:los|las)\\s+que\\s+m[aá]s\\s+\\p{L}+|\\b(?:por|en)\\s+(?:${_METRICA_DE_ORDEN})\\b|\\bordenad[oa]s\\s+por\\b|\\branking\\b)(?:[^.;\\n]|\\.(?=\\d)){0,60}?\\bprimero\\b|\\bprimero\\s+(?:en|por)\\s+(?:${_METRICA_DE_ORDEN})\\b`, "giu");
const _sinPrimeroDeRanking = (p) => String(p).replace(_PRIMERO_DE_RANKING, (m) => m.replace(/\bprimero\b/giu, "…"));
/* ══ LA COINCIDENCIA AGRAVA, NO DECIDE (owner 2026-09-14, segunda corrida de la prueba 2) ═════════════════════════════════
 * Lo servido: «partir por Lider: coincide en dos dominios (…), y esa coincidencia agrava más que cualquier monto aislado».
 * Es ley, no una función nueva: «Coincidir en varios dominios agrava el caso, pero la prioridad se decide por el criterio/
 * lente correspondiente —materialidad, severidad, urgencia o el criterio explícito del usuario—. No debe reaparecer
 * “coincide en dos dominios” como razón suficiente para quedar primero.» Se cobra cuando el párrafo de la prioridad presenta
 * la coincidencia como LA razón: «porque coincide», «por coincidir», «X: coincide en dos dominios», «esa coincidencia agrava/
 * pesa más que», «la coincidencia decide/manda». Decir que coincide y que eso agrava, con las señales al lado, sigue bien;
 * «coincidir agrava, no decide» (la doctrina) también. */
const _COINCIDE = /coincid(?:e|en|ir|encia)\s+en\s+(?:dos|tres|varios|ambos|los\s+dos|los\s+tres|m[aá]s\s+de\s+un)\s+(?:dominios|frentes|lentes)|(?:esa|esta|la|su)\s+coincidencia/i;
const _COMO_RAZON = /\b(?:porque|ya\s+que|dado\s+que|por\s+eso\s+que|por)\s+coincid|:\s*coincide\s+en|coincidencia\s+(?:agrava|pesa|cuenta|vale|importa)\s+m[aá]s\s+que|coincidencia\s+(?:decide|manda|basta|es\s+lo\s+que\s+(?:decide|manda|pesa|la\s+pone)|es\s+la\s+raz[oó]n|es\s+el\s+motivo)|(?:va|queda|est[aá]|ir[ií]a|entra)\s+primero\s+porque\s+coincide|primero\s+por\s+coincidir/i;
/* «no porque coincidir en dos dominios lo decida solo, sino porque en cada uno pesa más» (prueba 2, tercera corrida viva · 2026-09-14):
 * la coincidencia NEGADA como razón es justo lo que la ley pide. LA NEGACIÓN LA LEE EL LECTOR DE CLÁUSULA (owner 2026-09-14), no
 * una lista de frases: la mención de la coincidencia está negada si en SU cláusula hay un «no / ni / tampoco / sin» antes, sin
 * un «sino / pero / aunque» entre medio. Así «no porque pese más, sino porque coincide en dos dominios» sí arde (lo que sigue a
 * «sino» se afirma), y «mi criterio —no una cifra del dato— es partir por Lider: coincide en dos dominios…» también (el «no» del
 * inciso es de otra cláusula). */
export function coincidenciaComoRazon(texto) {
  const parrafos = String(texto || "").split(/\n\s*\n/).filter((p) => _PRIORIDAD.test(p) && _COINCIDE.test(p));
  for (const p of parrafos) {
    for (const oracion of p.split(/(?<=[.!?])\s+/)) {
      const _mc = _COINCIDE.exec(oracion);
      if (!_mc || !_COMO_RAZON.test(oracion) || leerClausula(oracion, _mc.index).negada) continue;
      return `pones primero a una cuenta «porque coincide en dos dominios»: coincidir agrava el caso, no lo decide. La prioridad se decide por el criterio —materialidad, severidad, urgencia, o el que fijó el usuario—: di qué señales la ponen primero (por ejemplo, la mayor brecha al benchmark y el atraso más largo) y deja la coincidencia como agravante, no como la razón: "${oracion.trim().slice(0, 140)}"`;
    }
  }
  return null;
}
const _CRITERIO_DICHO = /\bcriterio\b|\blente\b|\bintegr|\briesgo\b|\bcontribuci[oó]n\b|\bmargen\b|\bcaja\b|\bcobranza\b|\bvencid|\bventas?\b|\bcrecimiento\b|\bcapital\b|\bmaterialidad\b|\bseveridad\b|\burgencia\b|\bseñal/i;
export function prioridadIntegradaCambiada(texto, figs, dominios = [], { criterio = null, modo = null } = {}) {
  const t = String(texto || "");
  const _sinTildes = (s) => String(s).normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const _re = (nombre) => new RegExp(`(?<![\\p{L}\\p{N}])${_sinTildes(nombre).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![\\p{L}\\p{N}])`, "iu");
  const P1 = primerosPorCriterio(figs, dominios);
  const usa = criterio && CRITERIOS[criterio] ? criterio : null;
  if (usa && !P1[usa]) return null;
  if (!usa && !P1.riesgo) return null;
  /* las cuentas que compiten: las primeras de cada lente de clave cliente, más las de la lista integrada */
  const cuentas = new Set(Object.keys(P1).filter((c) => CRITERIOS[c].clave === "cliente").map((c) => P1[c].entidad));
  const Pint = prioridadIntegrada(figs, dominios);
  for (const c of (Pint ? Pint.integrada : [])) cuentas.add(c.entidad);
  /* el CIERRE es el último párrafo con prioridad QUE HABLA DE LAS CUENTAS (owner 2026-09-14, segundo prompt de producción):
   * «Yo miraría primero Falabella —criterio mío—» al final de una lectura de tres dominios es una prioridad local servida
   * como global. Un párrafo de inventario («LG-DRYER8KG primero») es otra clave y no compite con las cuentas. */
  const parrafos = t.split(/\n\s*\n/).filter((p) => _PRIORIDAD.test(_sinPrimeroDeRanking(p)) && [...cuentas].some((e) => _re(e).test(_sinTildes(p))));
  if (!parrafos.length) return null;   // sin prioridad dicha sobre las cuentas, esto no juzga (la cobertura del encargo ya cobra que falte)
  const cierre = _sinTildes(parrafos[parrafos.length - 1]);
  if (usa) {
    /* 1 y 2 · el criterio del usuario manda: la primera bajo ese criterio tiene que estar en el cierre */
    const primera = P1[usa].entidad;
    if (_re(primera).test(cierre)) return null;
    const C = CRITERIOS[usa];
    return `el usuario ${modo === "implicito" ? "pidió (con sus palabras)" : "fijó"} el criterio «${C.nombre}» y bajo ese criterio va primero ${primera}${P1[usa].valor ? ` (${P1[usa].valor})` : ""}; tu cierre no la nombra. El criterio del usuario manda: ordena bajo él y, si otra lente cambiaría quién va primero, dilo sin cambiar la prioridad pedida.`;
  }
  /* 4 · sin criterio: vale la primera de alguna lente, con el criterio declarado — o preguntar qué lente usar (3) */
  if (/\?/.test(cierre) && /criterio|lente|ordenar|ordeno|priorizar/i.test(cierre)) return null;
  const alguna = Object.keys(P1).filter((c) => CRITERIOS[c].clave === "cliente").find((c) => _re(P1[c].entidad).test(cierre));
  if (alguna && _CRITERIO_DICHO.test(cierre)) return null;
  const riesgo = P1.riesgo;
  const v = Pint && Pint.integrada[0] && Pint.integrada[0].versus;
  if (!alguna) return `el usuario no fijó criterio: tu cierre no pone primero a quien va primero bajo ninguna lente (por riesgo integrado, ${riesgo.entidad}${v && v.gana.length ? ` — antes que ${v.contra}: más grave en ${v.gana.map((it) => `${it.nombre}, ${it.a} contra ${it.b}`).join("; ")}` : ""}${Object.keys(P1).filter((c) => c !== "riesgo" && CRITERIOS[c].clave === "cliente" && P1[c].entidad !== riesgo.entidad).map((c) => `; por ${CRITERIOS[c].nombre}, ${P1[c].entidad}`).join("")}). Entrega una prioridad ejecutiva con el criterio declarado, o pregunta qué lente quiere usar.`;
  return `el usuario no fijó criterio y tu cierre pone primero a ${P1[alguna].entidad} sin declarar bajo qué criterio (por ${CRITERIOS[alguna].nombre} va primero; por riesgo integrado, ${riesgo.entidad}). Declara el criterio en el cierre y, si es material, di que otra lente cambiaría quién va primero.`;
}
