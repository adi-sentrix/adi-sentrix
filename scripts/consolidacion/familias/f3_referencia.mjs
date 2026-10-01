/* === scripts/consolidacion/familias/f3_referencia.mjs · INVARIANTE DE LA FAMILIA 3 · LA REFERENCIA DE LA CONSULTA, DECLARADA EN CADA PARTE QUE USA EL CONJUNTO ═══
 * «Toda referencia de la consulta que toca un conjunto que usa una parte (o una premisa) se declara AL LADO de la oficial, con el conteo y las
 * entidades de ese conjunto en el EJE de esa parte; nunca reemplaza a la oficial en el Marco ni en el veredicto (salvo `umbral_frenado` sin
 * oficial, que es la operativa de esa respuesta); el valor declarado es el exacto; y un error de evidencia se DECLARA, nunca se calla»
 * (contrato §7.3·12 · 19 · 37(b)/(d) · 40(d) · 41(b)/(d) · 42(b)/(d) · 49(a) · 51(g) · 52(e)).
 *
 * LO QUE LEE: la ENTREGA (sus límites, su Marco, sus oraciones), la RESOLUCIÓN del encargo (las partes y premisas con su universo tipado y el
 * criterio con la referencia) y el DATO de la proyección (`dato.rankings`, `dato.kpis` con las referencias OFICIALES, `dato.conjuntos`).
 * NO lee `entrega/referencias.js`: ni importa la pieza ni repite su lógica. El conjunto alternativo y el oficial se CUENTAN aquí, sobre los
 * rankings del dato (la métrica de la referencia contra su valor), nunca con la función de la casa.
 *
 * LAS REGLAS (cada violación nombra la suya):
 *   referencia-sin-declarar        un conjunto en juego (por una parte o una premisa) que la referencia de la consulta define no tiene su declaración al
 *                                  lado de la oficial en el eje de ese uso, ni la Entrega declara que no se pudo evaluar (19 · 49a · 52e).
 *   referencia-no-coincide         la declaración existe pero su conteo, sus entidades o el conteo oficial no son los que el dato da (12 · 19).
 *   referencia-sin-partes          la declaración de (conjunto, eje) no nombra una de las partes que usan ese conjunto (49a · 52e).
 *   referencia-repetida            dos declaraciones para el mismo (conjunto, eje): se declara UNA vez (52e).
 *   referencia-valor-inexacto      el valor de la consulta se escribe redondeado o distinto del declarado (40d · 41b).
 *   oficial-omitida-del-marco      el Marco no lleva la referencia OFICIAL con que se juzgó el conjunto en juego (42b · 37b).
 *   referencia-reemplaza-a-la-oficial  el Marco (o la oración de un veredicto) lleva el valor de la consulta donde va el oficial (12 · 41b).
 *   operativa-sin-declarar         `umbral_frenado` sin oficial: el valor de la consulta va exacto en el Marco (41b).
 *   La referencia que no toca ningún conjunto (una meta, el techo de compras…) no se declara: el control no dice nada de ella. */

const _norm = (s) => String(s == null ? "" : s).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
const _num = (t) => { const m = /(-?\d[\d.,]*)/.exec(String(t == null ? "" : t)); if (!m) return NaN; let s = m[1]; if (/,\d{1,3}$/.test(s) && !/\./.test(s)) s = s.replace(",", "."); else s = s.replace(/,/g, ""); return parseFloat(s); };
const _cmp = (a, op, b) => (op === "<" ? a < b : op === "<=" ? a <= b : op === ">" ? a > b : op === ">=" ? a >= b : false);
const _igualesSet = (a, b) => a.size === b.size && [...a].every((x) => b.has(x));

/* el sustantivo con que se cuenta cada eje (el idioma de la Entrega: «6 cuentas», «3 SKU») */
const NOMBRE_DE_EJE = { cliente: /^(?:cuentas?|clientes?)$/i, sku: /^SKU$/i, marca: /^marcas?$/i, familia: /^familias?$/i, bodega: /^bodegas?$/i, canal: /^canal(?:es)?$/i };

/* LAS REFERENCIAS QUE DEFINEN UN CONJUNTO DE LA CASA (el dato del contrato, escrito aparte del código de la Entrega):
 *   metrica(eje) = la clave del ranking contra la que se mide · oficial = la etiqueta de la fila de `dato.kpis` · nombre = cómo la dice el Marco */
const REF = {
  benchmark: { metrica: (eje) => (eje === "sku" ? "margen_venta" : "margen"), oficial: "Benchmark de margen", marco: /benchmark de margen(?: \(comercial\))?:\s*([\d.,]+)/i },
  nivel_carga: { metrica: () => "carga", oficial: "Nivel de carga declarado", marco: /nivel de carga declarado:\s*([\d.,]+)/i },
  piso_rotacion: { metrica: () => "rotacion", oficial: "Piso de rotación", marco: /piso de rotaci[oó]n:\s*([\d.,]+)/i },
  techo_cobertura: { metrica: () => "dias_inventario", oficial: "Techo de días de inventario", marco: /techo de (?:cobertura|d[ií]as de inventario):\s*([\d.,]+)/i },
  umbral_materialidad: { metrica: () => null, oficial: "Umbral de materialidad · % de la venta", marco: /umbral de materialidad:\s*([\d.,]+)/i },
  umbral_frenado: { metrica: () => "dias_sin_venta", oficial: null, marco: /umbral de (?:venta frenada|frenado):\s*([\d.,]+)/i },
};
/* qué conjunto de la casa pone cada referencia en juego (por `base`, por `excluir.conjuntos`, por estado o por el `ref` de un filtro) */
const BASES = {
  benchmark: { "bajo el benchmark": { dir: "bajo", op: "<", eje: "cliente" }, "sobre el benchmark": { dir: "sobre", op: ">=", eje: "cliente" }, "sku bajo el benchmark": { dir: "bajo", op: "<", eje: "sku" }, "sku sobre el benchmark": { dir: "sobre", op: ">=", eje: "sku" } },
  nivel_carga: { "sobre el nivel declarado de carga": { dir: "sobre", op: ">", eje: "cliente" } },
};
const DETECTOR = "carga comercial alta";
const ESTADOS = {
  piso_rotacion: { "rota lento": { dir: "bajo", op: "<" }, "rota bien": { dir: "sobre", op: ">=" }, "inmovilizado critico": { derivado: true }, inmovilizado: { derivado: true } },
  umbral_frenado: { frenado: { dir: "sobre", op: ">" } },
  techo_cobertura: { "inmovilizado critico": { derivado: true }, inmovilizado: { derivado: true }, sobrestock: { derivado: true }, "capital sano": { derivado: true } },
};
/* los conjuntos de la casa que SON un estado con otro nombre («con capital inmovilizado critico» = el estado «inmovilizado critico») */
const CONJUNTO_ES_ESTADO = { "con capital inmovilizado critico": "inmovilizado critico" };

export const familia = {
  id: "F3",
  nombre: "la referencia de la consulta, declarada una vez por conjunto y eje, nombrando las partes que cubre, al lado de la oficial",
  invariante(ctx) {
    const { entrega, resolucion, dato, base } = ctx;
    const vs = [];
    const v = (regla, detalle) => vs.push({ regla, detalle: String(detalle).slice(0, 360) });
    const ref = resolucion && resolucion.criterio && resolucion.criterio.referencia;
    if (!ref || !REF[ref.concepto] || !Number.isFinite(ref.valor)) return vs;
    const C = ref.concepto, T = REF[C], valor = ref.valor;
    const esq = base.esquema;
    const R = (dato && dato.rankings) || {};
    const kpi = (etq) => { const k = ((dato && dato.kpis) || []).find((x) => x && x.label === etq); return k && Number.isFinite(k.raw) ? k.raw : null; };
    const oficialRaw = T.oficial ? kpi(T.oficial) : null;
    const limites = Array.isArray(entrega.limites) ? entrega.limites : [];
    const marcoTexto = [entrega.marco && entrega.marco.referenciaDeclarada && entrega.marco.referenciaDeclarada.texto, ...((entrega.marco && entrega.marco.definiciones) || [])].filter(Boolean).join(" · ");

    /* ── 1 · lo que usa cada parte y cada premisa ────────────────────────────────────────────────────────────────────── */
    const usos = [];   // { origen, esParte, eje, clave, kind, dir, op }
    const ejeDeParte = (p) => (p && p.eje) || (esq.sujetoDeTema ? esq.sujetoDeTema(p.tema) : null) || "cliente";
    const estadoCanon = (e) => { try { return base.estados.estadoDeclarado(e) || _norm(e); } catch { return _norm(e); } };
    const poner = (u) => (o) => usos.push({ origen: u.origen, esParte: u.esParte, ...o });
    const visitar = (u, orig, ejeDef) => {
      if (!u || typeof u !== "object" || Array.isArray(u)) return;
      const eje = (typeof u.eje === "string" && u.eje.trim()) || ejeDef;
      const add = poner(orig);
      const nombres = [...(typeof u.base === "string" && u.base.trim() ? [u.base] : []), ...(u.excluir && typeof u.excluir === "object" && Array.isArray(u.excluir.conjuntos) ? u.excluir.conjuntos.filter((n) => typeof n === "string") : [])];
      for (const n of nombres) {
        const k = _norm(n);
        const b = (BASES[C] || {})[k];
        if (b) { add({ eje: b.eje === "sku" && eje !== "sku" ? b.eje : (eje || b.eje), clave: `dir:${b.dir}`, kind: "dir", dir: b.dir, op: b.op }); continue; }
        if (k === DETECTOR && C === "nivel_carga") add({ eje: eje || "cliente", clave: "detector", kind: "detector" });
        if (k === DETECTOR && C === "umbral_materialidad") add({ eje: eje || "cliente", clave: "piso", kind: "piso" });
        const est = CONJUNTO_ES_ESTADO[k];
        if (est && (ESTADOS[C] || {})[est]) add({ eje: eje || "sku", clave: `estado:${est}`, kind: "estado", estado: est, ...(ESTADOS[C][est]) });
      }
      for (const e of [...(Array.isArray(u.estados) ? u.estados : []), ...(Array.isArray(u.no_estados) ? u.no_estados : [])]) {
        const canon = estadoCanon(e), d = (ESTADOS[C] || {})[canon];
        if (d) add({ eje: eje || "sku", clave: `estado:${canon}`, kind: "estado", estado: canon, ...d });
      }
      for (const f of Array.isArray(u.filtros) ? u.filtros : []) if (f && typeof f.ref === "string" && f.ref.trim() === C && typeof f.op === "string" && T.metrica(eje)) add({ eje: eje || "sku", clave: `op:${f.op.trim()}`, kind: "dir", dir: /^>/.test(f.op.trim()) ? "sobre" : "bajo", op: f.op.trim() });
      for (const w of Array.isArray(u.union) ? u.union : []) visitar(w, orig, eje);
    };
    const partes = (resolucion.partes || []).filter((p) => p.estado === "resuelta" || p.estado === "parcial");
    for (const p of partes) {
      visitar(p.universo, { origen: p.id, esParte: true }, ejeDeParte(p));
      if (C === "umbral_materialidad" && (p.conceptos || []).includes("carga_alta")) poner({ origen: p.id, esParte: true })({ eje: "cliente", clave: "piso", kind: "piso" });
    }
    for (const pr of resolucion.premisas || []) {
      const u = pr.universo != null ? pr.universo : pr.de;
      visitar(u, { origen: pr.id, esParte: false }, (u && u.eje) || null);
      if (typeof pr.estado === "string") { const canon = estadoCanon(pr.estado), d = (ESTADOS[C] || {})[canon]; if (d) poner({ origen: pr.id, esParte: false })({ eje: "sku", clave: `estado:${canon}`, kind: "estado", estado: canon, ...d }); }
    }

    /* los usos, por (conjunto, eje): una declaración por cada uno, con las partes que lo usan */
    const grupos = new Map();
    for (const u of usos) {
      if (!u.eje) continue;
      const k = `${u.eje}|${u.clave}`;
      if (!grupos.has(k)) grupos.set(k, { ...u, partes: new Set(), premisas: new Set() });
      (u.esParte ? grupos.get(k).partes : grupos.get(k).premisas).add(u.origen);
    }

    /* ── 2 · lo que la Entrega declara ───────────────────────────────────────────────────────────────────────────────── */
    const decls = [];
    for (const l of limites) {
      const m = /^(?:Sobre la parte \S+ \([^)]*\), c|Sobre las partes .+? \([^)]*\), c|C)on la referencia planteada en la consulta \((.+?)\), en vez (.+)$/.exec(String(l.titulo || ""));
      if (!m) continue;
      const mo = String(l.motivo || "");
      const d = { titulo: String(l.titulo), motivo: mo, valorTxt: m[1], texto: `${l.titulo} ${mo}`, tipo: "otra" };
      let x;
      if ((x = /^(?:Sería|Serían) (\d+) (\S+) (.+?) \(contra (\d+) con (.+?)\):\s*(.*?)\s*— calculado con (?:la misma cuenta|el mismo detector)/.exec(mo))) Object.assign(d, { tipo: "conjunto", n: Number(x[1]), noun: x[2], rest: x[3], contra: Number(x[4]), nombres: !x[6] || x[6] === "ninguno" ? [] : x[6].split(", ").map((s) => s.trim()), listaVacia: !x[6] });
      else if ((x = /^«(.+?)» (?:es|son) (\d+) (\S+) con la referencia de la empresa;/.exec(mo))) Object.assign(d, { tipo: "detector", detector: x[1], n: Number(x[2]), noun: x[3] });
      decls.push(d);
    }
    const delConjunto = decls.filter((d) => d.tipo === "conjunto"), delDetector = decls.filter((d) => d.tipo === "detector");
    const sinPlantear = (d) => decls.indexOf(d) < 0;
    void sinPlantear;

    /* ── 3 · el valor declarado es el exacto (40d · 41b) ─────────────────────────────────────────────────────────────── */
    for (const d of decls) { const n = _num(d.valorTxt); if (!(Math.abs(n - valor) < 1e-9)) v("referencia-valor-inexacto", `la declaración dice «${d.valorTxt}» y la consulta planteó ${valor}`); }

    /* ── 4 · cada (conjunto, eje) en juego tiene su declaración, con el conteo del dato, y nombra sus partes ────────────── */
    const rk = (eje, clave) => { const r = R[eje] && R[eje][clave]; return r && Array.isArray(r.filas) && r.filas.length ? r : null; };
    const miembrosDe = (eje, clave, op, umbral) => { const r = rk(eje, clave); if (!r) return null; return new Set(r.filas.filter((f) => Number.isFinite(f.valor) && _cmp(f.valor, op, umbral)).map((f) => _norm(f.entidad))); };
    const oficialDelConjunto = {};   // dato.conjuntos: el oficial de nivel de carga y del detector
    for (const [k, c] of Object.entries((dato && dato.conjuntos) || {})) oficialDelConjunto[_norm(k)] = new Set((c.entidades || []).map(_norm));
    const operativa = C === "umbral_frenado" && oficialRaw == null;
    const declaracionesUsadas = new Set();
    /* un error de evidencia DECLARADO («el universo declarado no se pudo evaluar», con las partes) vale como declaración: lo que no se acepta es callarlo */
    const noEvaluables = limites.filter((l) => /el universo declarado no se pudo evaluar$/.test(String(l.titulo || "")));
    const declaradoComoNoEvaluable = (g) => [...g.partes].some((pid) => noEvaluables.some((l) => new RegExp(`\\b${pid}\\b`).test(String(l.titulo))));
    /* §7.3·52(e) precisada: la declaración nombra las partes que cubre SOLO si la usan DOS o más; con una sola no hace falta nombrarla */
    /* las partes que usan el conjunto que UNA declaración cubre (una `base` y un filtro con `ref` que dicen lo mismo comparten la declaración): se juntan por declaración y, si son DOS o más, la declaración las nombra todas */
    const partesPorDeclaracion = new Map();
    const nombrarPartes = (g, d) => { if (!partesPorDeclaracion.has(d)) partesPorDeclaracion.set(d, { g, partes: new Set() }); for (const pid of g.partes) partesPorDeclaracion.get(d).partes.add(pid); };
    for (const g of grupos.values()) {
      const nounRe = NOMBRE_DE_EJE[g.eje] || /^.+$/;
      const comoUso = `${[...g.partes, ...g.premisas].join(", ")} (${g.eje} · ${g.clave})`;
      if (g.kind === "detector") {
        const cand = delDetector.filter((d) => d.detector === DETECTOR && nounRe.test(d.noun));
        const oficial = oficialDelConjunto[DETECTOR];
        if (!cand.length) { if (declaradoComoNoEvaluable(g)) continue; v("referencia-sin-declarar", `${comoUso}: «${DETECTOR}» está en juego y la Entrega no declara la referencia de la consulta (solo el conteo oficial)`); continue; }
        cand.forEach((d) => declaracionesUsadas.add(d));
        if (cand.length > 1) v("referencia-repetida", `${comoUso}: ${cand.length} declaraciones para el mismo conjunto y eje`);
        if (oficial && cand[0].n !== oficial.size) v("referencia-no-coincide", `${comoUso}: «${DETECTOR}» dice ${cand[0].n} y el dato da ${oficial.size}`);
        nombrarPartes(g, cand[0]); continue;
      }
      if (g.kind === "piso") {
        const cand = delConjunto.filter((d) => /con «carga comercial alta» con esa referencia/.test(d.rest || "") && nounRe.test(d.noun));
        const oficial = oficialDelConjunto[DETECTOR];
        if (!cand.length) { if (declaradoComoNoEvaluable(g)) continue; v("referencia-sin-declarar", `${comoUso}: el piso de materialidad está en juego y la Entrega no declara la referencia de la consulta`); continue; }
        cand.forEach((d) => declaracionesUsadas.add(d));
        if (cand.length > 1) v("referencia-repetida", `${comoUso}: ${cand.length} declaraciones para el mismo conjunto y eje`);
        if (oficial && cand[0].contra !== oficial.size) v("referencia-no-coincide", `${comoUso}: el conteo oficial declarado es ${cand[0].contra} y el dato da ${oficial.size}`);
        nombrarPartes(g, cand[0]); continue;
      }
      if (operativa && g.kind === "estado") continue;   /* la operativa de esta respuesta: va en el Marco, no hay oficial contra el cual contar (41b) */
      /* conjunto con dirección (bajo/sobre) o estado: contar con el dato */
      const clave = T.metrica(g.eje);
      const esDerivado = !!g.derivado;
      const cand = delConjunto.filter((d) => nounRe.test(d.noun) && (esDerivado ? true : new RegExp(`^${g.dir} esa referencia$`).test(d.rest || "")));
      let esperado = null, oficial = null;
      if (!esDerivado && clave) {
        esperado = miembrosDe(g.eje, clave, g.op, valor);
        const kBase = g.kind === "dir" && C === "nivel_carga" && g.clave === "dir:sobre" && oficialDelConjunto["sobre el nivel declarado de carga"];
        oficial = kBase || (oficialRaw != null ? miembrosDe(g.eje, clave, g.op, oficialRaw) : null);
      }
      if (esDerivado) {
        /* un estado que depende del umbral: sin la función de la casa el control no cuenta; exige la declaración de ESE estado en su eje */
        const forma = (() => { try { return base.estados.formaDeEstado(g.estado).plural; } catch { return g.estado; } })();
        const propias = cand.filter((d) => _norm(d.rest || "").startsWith(`${_norm(forma)} con esa referencia`));
        if (!propias.length) { if (declaradoComoNoEvaluable(g)) continue; v("referencia-sin-declarar", `${comoUso}: el estado «${g.estado}» depende de la referencia y la Entrega no declara cuántos serían con la de la consulta`); continue; }
        propias.forEach((d) => declaracionesUsadas.add(d));
        if (propias.length > 1) v("referencia-repetida", `${comoUso}: ${propias.length} declaraciones para el mismo estado y eje`);
        nombrarPartes(g, propias[0]); continue;
      }
      if (!esperado) continue;   /* el dato no publica el ranking de esa métrica en ese eje: el control no tiene contra qué contar */
      if (!cand.length) { if (declaradoComoNoEvaluable(g)) continue; v("referencia-sin-declarar", `${comoUso}: el conjunto «${g.dir}» la referencia (${valor}) tendría ${esperado.size} y la Entrega no lo declara`); continue; }
      cand.forEach((d) => declaracionesUsadas.add(d));
      /* las declaraciones con el contenido que el dato da para ESTE conjunto: si hay más de una, el (conjunto, eje) se declara dos veces (52e) */
      const delConteo = cand.filter((x) => x.n === esperado.size && _igualesSet(new Set(x.nombres.map(_norm)), esperado));
      if (delConteo.length > 1) v("referencia-repetida", `${comoUso}: ${delConteo.length} declaraciones para el mismo conjunto y eje`);
      const d = delConteo[0] || cand[0];
      if (d.listaVacia) v("referencia-no-coincide", `${comoUso}: la declaración deja la lista de entidades en blanco (sin «ninguno»)`);
      const nombresDecl = new Set(d.nombres.map(_norm));
      if (d.n !== esperado.size || !_igualesSet(nombresDecl, esperado)) v("referencia-no-coincide", `${comoUso}: declara ${d.n} (${d.nombres.join(", ") || "ninguno"}) y el dato da ${esperado.size} (${[...esperado].join(", ") || "ninguno"})`);
      if (oficial && d.contra !== oficial.size) v("referencia-no-coincide", `${comoUso}: el conteo oficial declarado es ${d.contra} y el dato da ${oficial.size}`);
      nombrarPartes(g, d);
    }
    for (const [d, { g, partes: ps }] of partesPorDeclaracion) { if (ps.size < 2) continue; for (const pid of ps) if (!new RegExp(`\\b${pid}\\b`).test(d.texto)) v("referencia-sin-partes", `la declaración de «${g.clave}» en ${g.eje} (${d.valorTxt}) no nombra la parte ${pid}, que usa ese conjunto (${ps.size} partes lo usan)`); }
    /* una declaración sin ningún uso (un conjunto que ninguna parte ni premisa usa) no es una violación del control: el control solo exige lo que se usa */

    /* ── 5 · el Marco lleva la oficial; nunca la reemplaza la de la consulta (42b · 37b · 41b) ───────────────────────── */
    if (grupos.size) {
      const trozos = []; { const re = new RegExp(T.marco.source, "gi"); let m; while ((m = re.exec(marcoTexto))) trozos.push(_num(m[1])); }
      if (operativa) {
        if (!trozos.some((n) => Math.abs(n - valor) < 1e-9)) v("operativa-sin-declarar", `«umbral_frenado» sin oficial: el valor de la consulta (${valor}) no figura exacto en el Marco`);
      } else if (oficialRaw != null) {
        const hayOficial = trozos.some((n) => Math.abs(n - oficialRaw) < 1e-9);
        const hayConsulta = Math.abs(oficialRaw - valor) > 1e-9 && trozos.some((n) => Math.abs(n - valor) < 1e-9);
        if (hayConsulta) v("referencia-reemplaza-a-la-oficial", `el Marco lleva ${valor} (la consulta) donde va la oficial ${oficialRaw}`);
        else if (!hayOficial && !(C === "umbral_materialidad" && !grupos.size)) v("oficial-omitida-del-marco", `el Marco no lleva la referencia oficial (${oficialRaw}) de «${C}», que un conjunto en juego usa`);
      }
    }
    /* el veredicto: una oración que dice la referencia con el valor de la consulta, donde va la oficial */
    if (oficialRaw != null && Math.abs(oficialRaw - valor) > 1e-9 && grupos.size) {
      const nombreEnOracion = { benchmark: "benchmark", nivel_carga: "nivel declarado de carga|nivel de carga", piso_rotacion: "piso de rotaci[oó]n", techo_cobertura: "techo de cobertura|techo de d[ií]as", umbral_materialidad: "umbral de materialidad" }[C];
      for (const r of entrega.respuesta || []) {
        const t = String((r && r.texto) || "");
        const re = new RegExp(`(?:${nombreEnOracion})[^.;:]{0,45}?(-?\\d[\\d.,]*)\\s*(?:%|x|d\\b|d[ií]as)`, "gi"); let m;
        while ((m = re.exec(t))) if (Math.abs(_num(m[1]) - valor) < 1e-9) { v("referencia-reemplaza-a-la-oficial", `una oración dice la referencia con el valor de la consulta (${m[1]}) donde va la oficial (${oficialRaw}): «${t.slice(0, 120)}»`); break; }
      }
    }
    return vs;
  },
};
