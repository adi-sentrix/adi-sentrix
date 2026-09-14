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

const _lab = (f) => String((f && f.label) || "");
const _val = (f) => String((f && (f.text || f.value)) || "");
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
  },
  cobranza: {
    clave: "cliente",
    materialidad: { re: /· Saldo vencido$/i, nombre: "vencido", peor: "mayor", como: (v) => `${v} vencidos` },
    severidad: { re: /· Recuperado$/i, nombre: "recuperado", peor: "menor", como: (v) => `${v} recuperado` },
    urgencia: { re: /· Dias Vencido$/i, nombre: "atraso", peor: "mayor", como: (v) => `${v} de atraso` },
  },
  inventario: {
    clave: "sku",
    materialidad: { re: /· Capital frenado$/i, nombre: "capital frenado", peor: "mayor", como: (v) => `${v} frenados` },
    severidad: { re: /· Días de inventario$/i, nombre: "días de inventario", peor: "mayor", como: (v) => `${v} de inventario` },
    urgencia: { re: /· Días sin venta$/i, nombre: "días sin venta", peor: "mayor", como: (v) => `${v} sin venta` },
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
      if (!porEntidad.get(e)[lente]) porEntidad.get(e)[lente] = { fmt: _val(f), n };
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
      const item = { dominio: dom, lente, nombre: spec.nombre, a: sa[lente].fmt, b: sb[lente].fmt, como: spec.como };
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
    versus: i + 1 < lista.length ? { contra: lista[i + 1].entidad, ...c.contra[lista[i + 1].entidad], tiempo: { a: _tiempoDe(c), b: _tiempoDe(lista[i + 1]) } } : null,
  }));
  return { porDominio, integrada, criterio: CRITERIO };
}

export const CRITERIO = "dentro de cada dominio, materialidad (cuánto está en juego), severidad (distancia a la referencia declarada) y urgencia (la señal de tiempo); entre dominios, señal por señal —no por suma de montos—; coincidir en dos dominios agrava, no decide.";

/* ── EN PALABRAS: el cierre del ensamblador y la conclusión que viaja al cerebro ────────────────────────────────── */
const _DOM_TXT = { comercial: "comercial", cobranza: "cobranza", inventario: "inventario" };
const _lider = (x, dominio) => {
  const L = LENTES[dominio];
  const partes = [L.materialidad.como(x.materialidad.fmt)];
  if (x.severidad) partes.push(L.severidad.como(x.severidad.fmt));
  if (x.urgencia) partes.push(L.urgencia.como(x.urgencia.fmt));
  return `${x.entidad} (${partes.join(", ")})`;
};
/* por qué el segundo de un dominio no va primero en él, cuando le gana al líder en alguna otra lente */
const _matiz = (porDominio, dominio) => {
  const s = porDominio[dominio];
  if (!s || s.length < 2) return "";
  const p = s[0];
  /* entre las materiales, las que son más graves que el líder en severidad o urgencia (la materialidad manda; esto matiza) */
  const matices = s.slice(1, MATERIALES).map((q) => ({ q, gana: _LENTES.filter((l) => l !== "materialidad" && q[l] && p[l] && q[l].rango < p[l].rango) })).filter((x) => x.gana.length);
  if (!matices.length) return "";
  return "; " + matices.map(({ q, gana }) => `${q.entidad} ${LENTES[dominio].materialidad.como(q.materialidad.fmt)} y ${gana.map((l) => `${l === "severidad" ? "más lejos de la referencia" : "más urgente"} (${q[l].fmt} contra ${p[l].fmt})`).join(" y ")}`).join("; ");
};
/* la línea de una cuenta en la lista integrada: sus señales, y contra la siguiente, en qué gana y en qué pierde */
const _lineaIntegrada = (c, i, total) => {
  const senales = Object.keys(c.senales).map((d) => `${_DOM_TXT[d]}: ${_LENTES.filter((l) => c.senales[d][l]).map((l) => LENTES[d][l].como(c.senales[d][l].fmt)).join(", ")}`).join(" · ");
  let razon = "";
  if (c.versus) {
    const { contra, gana, pierde } = c.versus;
    const porDom = (items) => { const m = new Map(); for (const it of items) { if (!m.has(it.dominio)) m.set(it.dominio, []); m.get(it.dominio).push(it); } return m; };
    const g = porDom(gana), p = porDom(pierde);
    const dice = (m, sujeto) => [...m.entries()].map(([d, items]) => `en ${_DOM_TXT[d]}, ${items.map((it) => `${it.nombre} (${sujeto === "a" ? it.a : it.b} contra ${sujeto === "a" ? it.b : it.a})`).join(", ")}`).join("; ");
    const tiempo = c.versus.tiempo || {};
    if (gana.length > pierde.length) razon = ` — antes que ${contra}: más grave ${dice(g, "a")}${pierde.length ? `; ${contra} solo la supera ${dice(p, "b")}` : ""}.`;
    else if (tiempo.a && !tiempo.b) razon = ` — antes que ${contra} por la señal de tiempo (${tiempo.a}; ${contra} sin señal de tiempo)${gana.length ? `: más grave ${dice(g, "a")}` : ""}${pierde.length ? `; ${contra} la supera ${dice(p, "b")}` : ""}.`;
    else if (tiempo.a && tiempo.b) razon = ` — antes que ${contra} por la señal de tiempo (${tiempo.a} contra ${tiempo.b})${gana.length ? `: más grave ${dice(g, "a")}` : ""}${pierde.length ? `; ${contra} la supera ${dice(p, "b")}` : ""}.`;
    else razon = ` — antes que ${contra} por tener más en juego en su dominio${pierde.length ? `, aunque ${contra} la supera ${dice(p, "b")}` : ""}.`;
  } else if (i === total - 1 && total > 1) {
    razon = ".";
  }
  return `${i + 1}. ${c.entidad} — ${senales}${razon}`;
};

/** componerPrioridadIntegrada(figs, dominios) → el bloque de cierre, o null sin señales */
export function componerPrioridadIntegrada(figs, dominios = []) {
  const P = prioridadIntegrada(figs, dominios);
  if (!P) return null;
  const doms = Object.keys(P.porDominio);
  const L = [`Dónde pondría el foco primero — por señales comparables dentro de cada dominio, sin sumar montos entre dominios:`];
  L.push(`Por dominio: ${doms.map((d) => `${_DOM_TXT[d]} → ${_lider(P.porDominio[d][0], d)}${_matiz(P.porDominio, d)}`).join(" · ")}.`);
  if (P.integrada.length >= 2) {
    L.push(`Integrada, entre las cuentas${doms.includes("comercial") && doms.includes("cobranza") ? " (la clave real entre comercial y cobranza es el cliente)" : ""}:`);
    P.integrada.slice(0, 3).forEach((c, i) => L.push(_lineaIntegrada(c, i, Math.min(3, P.integrada.length))));
  } else if (P.integrada.length === 1) {
    L.push(`Integrada: ${P.integrada[0].entidad} — ${Object.keys(P.integrada[0].senales).map((d) => `${_DOM_TXT[d]}: ${_LENTES.filter((l) => P.integrada[0].senales[d][l]).map((l) => LENTES[d][l].como(P.integrada[0].senales[d][l].fmt)).join(", ")}`).join(" · ")}.`);
  }
  if (P.porDominio.inventario) {
    const s = P.porDominio.inventario[0];
    L.push(`En inventario (clave SKU: no se compara con las cuentas): ${s.entidad} primero — ${_LENTES.filter((l) => s[l]).map((l) => LENTES.inventario[l].como(s[l].fmt)).join(", ")}.`);
  }
  if (!P.porDominio.comercial || !LENTES.comercial.urgencia) L.push(`El comercial no trae señal de tiempo en este dato: ahí la prioridad es por materialidad y distancia al benchmark.`);
  L.push(`Criterio: ${P.criterio}`);
  return L.join("\n");
}

/** la conclusión del procedimiento sobre la prioridad, para el cerebro (se conserva, no se re-decide) */
export function conclusionDePrioridad(figs, dominios = []) {
  const P = prioridadIntegrada(figs, dominios);
  if (!P) return "";
  const doms = Object.keys(P.porDominio);
  const L = [`[PRIORIDAD DEL PROCEDIMIENTO — no es el usuario] Se conserva; el cerebro la explica, no la cambia:`];
  L.push(`- por dominio: ${doms.map((d) => `${_DOM_TXT[d]} → ${_lider(P.porDominio[d][0], d)}`).join(" · ")}.`);
  if (P.integrada.length) {
    L.push(`- integrada (las cuentas, señal por señal): ${P.integrada.slice(0, 3).map((c, i) => `${i + 1}º ${c.entidad}`).join(" · ")}.${P.integrada[0].versus && P.integrada[0].versus.gana.length ? ` ${P.integrada[0].entidad} va antes que ${P.integrada[0].versus.contra} porque es más grave en ${P.integrada[0].versus.gana.map((it) => `${it.nombre} (${it.a} contra ${it.b})`).join(", ")}${P.integrada[0].versus.pierde.length ? `; ${P.integrada[0].versus.contra} solo la supera en ${P.integrada[0].versus.pierde.map((it) => `${it.nombre} (${it.b} contra ${it.a})`).join(", ")}` : ""}.` : ""}`);
  }
  if (P.porDominio.inventario) L.push(`- inventario (clave SKU, aparte de las cuentas): ${P.porDominio.inventario[0].entidad} primero.`);
  L.push(`- el criterio se dice: ${P.criterio} Nada de sumar o comparar montos de dominios distintos; cada cifra tal cual está en la boleta.`);
  return L.join("\n");
}

/** la ley: en un encargo con prioridad pedida, la respuesta pone primero a quien puso el procedimiento */
const _PRIORIDAD = /\bprimero\b|\bprioridad|\bfoco\b|\bantes que\b|\bentrar[ií]a\b|\bpartir[ií]a\b|\bempezar[ií]a\b|\barrancar[ií]a\b/i;
export function prioridadIntegradaCambiada(texto, figs, dominios = []) {
  const P = prioridadIntegrada(figs, dominios);
  if (!P || !P.integrada.length) return null;
  const primera = P.integrada[0].entidad;
  const t = String(texto || "");
  /* «Líder» con tilde (corrida en vivo, 2026-09-14): el modelo acentuó el nombre las 13 veces y la ley no lo reconoció —
   * un falso positivo propio que tumbó una respuesta correcta. El nombre se compara sin tildes, en los dos lados. */
  const _sinTildes = (s) => String(s).normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const _re = (nombre) => new RegExp(`(?<![\\p{L}\\p{N}])${_sinTildes(nombre).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![\\p{L}\\p{N}])`, "iu");
  /* el CIERRE es el último párrafo con prioridad QUE HABLA DE LAS CUENTAS (owner 2026-09-14, segundo prompt de producción):
   * «Yo miraría primero Falabella —criterio mío—» al final de una lectura de tres dominios es una prioridad local servida
   * como global. La primera del procedimiento tiene que estar nombrada en ese último párrafo, no en cualquiera. Un párrafo
   * de inventario («LG-DRYER8KG primero») es otra clave y no compite con las cuentas: no cuenta como cierre de éstas. */
  const cuentas = P.integrada.map((c) => c.entidad);
  const parrafos = t.split(/\n\s*\n/).filter((p) => _PRIORIDAD.test(p) && cuentas.some((e) => _re(e).test(_sinTildes(p))));
  if (!parrafos.length) return null;   // sin prioridad dicha sobre las cuentas, esto no juzga (la cobertura del encargo ya cobra que falte)
  const cierre = parrafos[parrafos.length - 1];
  if (_re(primera).test(_sinTildes(cierre))) return null;
  const v = P.integrada[0].versus;
  return `la prioridad integrada del procedimiento es ${primera}${v && v.gana.length ? ` (antes que ${v.contra}: más grave en ${v.gana.map((it) => `${it.nombre}, ${it.a} contra ${it.b}`).join("; ")})` : ""} y tu prioridad no la nombra. La conclusión es del procedimiento: explícala, no la cambies — puedes decir la prioridad de cada dominio, pero la integrada abre con ${primera}.`;
}
