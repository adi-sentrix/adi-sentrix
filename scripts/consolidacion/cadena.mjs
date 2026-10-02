/* === scripts/consolidacion/cadena.mjs · LA CADENA DE UN CONTEO, RECALCULADA CON EL DATO (consolidación, contrato §7.3·54(a)) ═══════════════════════
 * «La cadena del universo de una premisa tiene un eslabón por cada restricción, en orden: el eje entero, la base, CADA estado, CADA filtro, el top y la
 * exclusión. El universo FINAL también es un eslabón.» Y (57d) «la bodega, cada no_estado y cada rama de una unión también son eslabones de la cadena». Este módulo recalcula esa cadena SIN el Notario: lee el DATO (la proyección: `dato.rankings`, `dato.conjuntos`,
 * `dato.estados`, `dato.kpis`; y lo que el Core publica por eje, `base.publica`) y el léxico (la clave de una métrica y su polaridad). NO importa `notario/hechos.js`,
 * `notario/verificar.js` ni `entrega/componer.js`: lo usan el control de la F6 (el veredicto de una premisa de conteo) y el generador de cobertura (los conteos con cadenas
 * de varios filtros y estados, y un M igual al final), así que la pieza y el control no pueden equivocarse de la misma manera.
 *
 * `cadenaDeConteo(base, u)` → { ok:true, eslabones:[{ nombre, tam }], finales: Set, tam } | { ok:false, motivo }
 *   `ok:false` cuando alguna restricción no se puede recalcular con el dato sin inventar (un estado sin definición medible en el dato, una referencia, una unidad en palabras, o una rama de
 *   una unión con alguna de ellas): el control no decide y el generador no usa ese universo. Un universo con una restricción que SÍ se recalcula siempre da su cadena completa. */
const _norm = (s) => String(s == null ? "" : s).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
const _lista = (x) => (Array.isArray(x) ? x : x == null || x === "" ? [] : [x]);
/* cómo se llama el ranking de la proyección cuando su clave no es la del léxico (el margen por SKU es `margen_venta`) */
const _CLAVE_DEL_RANKING = { sku: { margen: "margen_venta" } };

export function cadenaDeConteo(base, u) {
  if (!u || typeof u !== "object" || Array.isArray(u)) return { ok: false, motivo: "sin universo tipado" };
  /* §7.3·57(d): CADA RAMA de una unión también es un eslabón: el universo de la raíz (sin unión), la cadena completa de cada rama (la rama sola, con sus propias restricciones) y la unión acumulada rama a rama; el universo FINAL es la unión de todo (la raíz, si tiene restricciones propias, más las ramas) */
  if (Array.isArray(u.union) && u.union.length) {
    const raiz = { ...u }; delete raiz.union;
    const cRaiz = cadenaDeConteo(base, raiz);
    if (!cRaiz.ok) return cRaiz;
    const conRestriccionPropia = Object.entries(raiz).some(([k, x]) => k !== "eje" && x != null && x !== "" && !(Array.isArray(x) && !x.length));
    const eslabones = cRaiz.eslabones.slice();
    const acc = new Set(conRestriccionPropia ? cRaiz.finales : []);
    let i = 0;
    for (const v of u.union) {
      i++;
      const cR = cadenaDeConteo(base, { ...(v && typeof v === "object" && !Array.isArray(v) ? v : {}), eje: u.eje });
      if (!cR.ok) return { ok: false, motivo: `la rama ${i} de la unión no se recalcula con el dato: ${cR.motivo}` };
      for (const e of cR.eslabones) eslabones.push({ nombre: `rama ${i} · ${e.nombre}`, tam: e.tam });
      for (const x of cR.finales) acc.add(x);
      eslabones.push({ nombre: `unión de las ramas 1 a ${i}`, tam: acc.size });
    }
    return { ok: true, eslabones, finales: acc, tam: acc.size };
  }
  const dato = base.proyeccion, lex = base.lexico;
  const eje = _norm(u.eje || "cliente");
  let todos = []; try { todos = (base.entityIndex.axisEntityNames(eje) || []).map(_norm); } catch { todos = []; }
  if (!todos.length) return { ok: false, motivo: `el eje ${eje} no tiene miembros` };
  const TODOS = new Set(todos);
  const claveDe = (m) => (m == null ? null : (lex.claveExactaDeMetrica(m) || lex.claveDeMetrica(m) || null));

  /* los valores de una métrica por entidad del eje: la fila del ranking de la proyección (el crudo si lo trae) o, si el eje no la publica, lo que el Core publica por eje */
  const valoresDe = (clave) => {
    const rk = dato && dato.rankings && dato.rankings[eje] && dato.rankings[eje][(_CLAVE_DEL_RANKING[eje] && _CLAVE_DEL_RANKING[eje][clave]) || clave];
    const out = new Map();
    if (rk && Array.isArray(rk.filas) && rk.filas.length) {
      for (const f of rk.filas) { const x = Number.isFinite(f.raw) ? f.raw : (Number.isFinite(f.valor) ? f.valor : null); if (x != null) out.set(_norm(f.entidad), x); }
      return { vals: out, peorEs: rk.peorEs || null };
    }
    /* lo que el Core publica por eje no declara la ESCALA del dinero (la venta va en miles y el capital en dólares crudos): el dinero se usa solo con la escala que el DATO demuestra para esa misma métrica (una entidad de otro eje que el ranking publica con su crudo y el Core con su valor, en una proporción única); unidades, tasas, días y razones, tal cual */
    let unidad = null; try { unidad = lex.unidadDeClave(clave); } catch { unidad = null; }
    const pub = unidad && typeof base.publica === "function" ? base.publica(eje, clave) : null;
    if (pub && pub.size) {
      let escala = 1;
      if (unidad === "money") { escala = escalaDelDinero(clave); if (escala == null) return null; }
      for (const [k, v] of pub) out.set(_norm(k), v * escala);
      return { vals: out, peorEs: null };
    }
    return null;
  };
  /* la escala del dinero de una métrica: crudo del ranking ÷ valor del Core, en las entidades de CUALQUIER eje donde el ranking trae el crudo; solo si es la misma proporción en todas las que se pueden contrastar */
  const escalaDelDinero = (clave) => {
    const props = [];
    for (const e of Object.keys((dato && dato.rankings) || {})) {
      const rk = dato.rankings[e] && dato.rankings[e][(_CLAVE_DEL_RANKING[e] && _CLAVE_DEL_RANKING[e][clave]) || clave]; const pub = base.publica(e, clave);
      if (!rk || !pub) continue;
      for (const f of rk.filas || []) { const v = pub.get(_norm(f.entidad)); if (Number.isFinite(f.raw) && Number.isFinite(v) && v !== 0) props.push(f.raw / v); }
    }
    return props.length >= 2 && props.every((x) => Math.abs(x - props[0]) <= 1e-6 * Math.abs(props[0])) ? props[0] : null;
  };

  /* los conjuntos y estados que el dato demuestra */
  const conjuntoDe = (nombre) => {
    const n = _norm(nombre);
    const cj = dato && dato.conjuntos && Object.entries(dato.conjuntos).find(([k, c]) => _norm(k) === n && (!c.eje || _norm(c.eje) === eje));
    if (cj) return new Set((cj[1].entidades || []).map(_norm));
    const est = estadoDe(nombre);
    if (est) return est;
    /* «bajo / sobre el benchmark»: el margen de venta de la entidad contra el benchmark que la empresa declaró (la referencia OFICIAL de la proyección) */
    const mb = /^(?:sku )?(bajo|sobre) el benchmark$/.exec(n);
    if (mb && ((eje === "cliente" && !/^sku /.test(n)) || (eje === "sku" && /^sku /.test(n)))) {
      const kb = ((dato && dato.kpis) || []).find((k) => /^Benchmark de margen/i.test(String(k.label || "")));
      const V = valoresDe("margen");
      if (!kb || !Number.isFinite(kb.raw) || !V || V.vals.size < TODOS.size) return null;
      return new Set([...V.vals].filter(([, x]) => (mb[1] === "bajo" ? x < kb.raw : x > kb.raw)).map(([k]) => k));
    }
    return null;
  };
  const estadoDe = (nombre) => {
    const n = _norm(nombre);
    if (eje === "sku") {
      const canon = { "inmovilizado": "inmovilizado", "inmovilizado critico": "inmovilizado critico", "critico": "critico", "sobrestock": "sobrestock", "riesgo de quiebre": "riesgo de quiebre", "capital sano": "capital sano" }[n];
      if (!canon) return null;
      const filas = (dato && Array.isArray(dato.estados)) ? dato.estados : [];
      return new Set(filas.filter((f) => _norm(f.estado) === canon).map((f) => _norm(f.entidad)));
    }
    if (eje === "cliente" && (n === "al dia" || n === "en mora" || n === "con saldo vencido")) {
      const v = valoresDe("saldo_vencido");
      if (!v || v.vals.size < TODOS.size) return null;   /* la mesa no publica a todas las cuentas: lo ausente no vale cero */
      return new Set([...TODOS].filter((k) => (n === "al dia" ? v.vals.get(k) === 0 : v.vals.get(k) > 0)));
    }
    if (eje === "cliente" && n === "sin deuda") {
      const v = valoresDe("saldo_pendiente");
      if (!v || v.vals.size < TODOS.size) return null;
      return new Set([...TODOS].filter((k) => v.vals.get(k) === 0));
    }
    return null;
  };
  const baseDe = (nombre) => {
    const n = _norm(nombre);
    if (/^(?:todos?|todas?|el eje|eje|el total|la cartera)$/.test(n)) return TODOS;
    return conjuntoDe(nombre);
  };
  const bodegaDe = (b) => {
    const nb = _norm(b);
    const filas = (dato && Array.isArray(dato.estados)) ? dato.estados : [];
    const s = new Set(filas.filter((f) => _norm(f.bodega) === nb).map((f) => _norm(f.entidad)));
    return s.size ? s : null;
  };
  const filtroDe = (f) => {
    if (!f || f.ref != null || (f.unidad != null && !/^(?:days|money|pct|pp|count|ratio)$/.test(String(f.unidad)))) return null;
    const clave = claveDe(f.metrica); if (!clave) return null;
    const V = valoresDe(clave); if (!V) return null;
    const op = String(f.op != null ? f.op : ">");
    const lo = op === "entre" ? Number(Array.isArray(f.valor) ? f.valor[0] : f.valor) : Number(f.valor), hi = op === "entre" ? Number(Array.isArray(f.valor) ? f.valor[1] : f.hasta) : null;
    if (!Number.isFinite(lo) || (op === "entre" && !Number.isFinite(hi))) return null;
    const cmp = { ">": (x) => x > lo, ">=": (x) => x >= lo, "<": (x) => x < lo, "<=": (x) => x <= lo, "==": (x) => Math.abs(x - lo) <= 1e-9 * Math.max(1, Math.abs(lo)), "entre": (x) => x >= lo && x <= hi }[op];
    if (!cmp) return null;
    const incompleto = V.vals.size < TODOS.size;
    if (incompleto && /^(?:<|<=|==|entre)$/.test(op)) return null;   /* lo ausente no vale cero: «menor que» sobre un ranking incompleto no se resuelve */
    return new Set([...V.vals].filter(([, x]) => cmp(x)).map(([k]) => k));
  };
  const topDe = (t, dentro) => {
    const clave = claveDe(t && t.metrica); const k = t && Number.isFinite(+t.k) ? +t.k : null;
    if (!clave || !k || k < 1) return null;
    const V = valoresDe(clave); if (!V) return null;
    let dir = _norm(t.direccion || "mayor");
    if (V.vals.size < TODOS.size && /^(?:mayor|menor|peor|mejor)$/.test(dir)) return null;   /* un extremo no se decide sobre un ranking incompleto */
    if (dir === "peor" || dir === "mejor") {
      const pol = (lex.metricaPorClave(clave) || {}).polaridad;
      const peorEs = V.peorEs || (pol === "mayor" ? "menor" : pol === "menor" ? "mayor" : null);
      if (!peorEs) return null;
      dir = dir === "peor" ? peorEs : (peorEs === "mayor" ? "menor" : "mayor");
    }
    if (dir !== "mayor" && dir !== "menor") return null;
    const orden = [...V.vals].filter(([e]) => !dentro || dentro.has(e)).sort((a, b) => (dir === "mayor" ? b[1] - a[1] : a[1] - b[1]));
    let filas = orden.slice(0, k);
    if (orden.length > k && orden[k - 1][1] === orden[k][1]) { const vFilo = orden[k - 1][1]; filas = orden.filter((x, i) => i < k || x[1] === vFilo); }   /* el empate del filo sirve a todos los empatados */
    return new Set(filas.map(([e]) => e));
  };

  /* LA CADENA: el eje entero · la base · CADA estado · CADA no-estado · la bodega · CADA filtro · el top · la exclusión. §7.3·57(d): la BODEGA acota el eje como una base, así que también es un eslabón ANTES de los estados («el eje acotado por la bodega»): con estados o no_estados la cadena se corre en los dos órdenes y sus eslabones se reúnen (el universo final es el mismo) */
  const corrida = (bodegaPrimero) => {
    const eslabones = [{ nombre: "eje entero", tam: TODOS.size }];
    let set = null;   /* null = el eje entero */
    const empuja = (nombre) => eslabones.push({ nombre, tam: (set || TODOS).size });
    const intersecar = (S, nombre) => { set = set ? new Set([...set].filter((x) => S.has(x))) : new Set([...S].filter((x) => TODOS.has(x))); empuja(nombre); };
    const pasos = {
      base: () => { if (u.base && !/^(?:todos?|todas?|el eje|eje|el total|la cartera)$/i.test(String(u.base).trim())) { const S = baseDe(u.base); if (!S) return { ok: false, motivo: `la base «${u.base}» no se recalcula con el dato` }; intersecar(S, `base ${u.base}`); } return null; },
      estados: () => { for (const e of _lista(u.estados)) { const S = estadoDe(e); if (!S) return { ok: false, motivo: `el estado «${e}» no se recalcula con el dato` }; intersecar(S, `estado ${e}`); } return null; },
      no_estados: () => { for (const e of _lista(u.no_estados)) { const S = estadoDe(e); if (!S) return { ok: false, motivo: `el estado «${e}» no se recalcula con el dato` }; const b = set || TODOS; set = new Set([...b].filter((x) => !S.has(x))); empuja(`sin ${e}`); } return null; },
      bodega: () => { if (u.bodega) { if (eje !== "sku") return { ok: false, motivo: "bodega sobre un eje que no es SKU" }; const S = bodegaDe(u.bodega); if (!S) return { ok: false, motivo: `la bodega «${u.bodega}» no se recalcula con el dato` }; intersecar(S, `bodega ${u.bodega}`); } return null; },
      filtros: () => { for (const f of _lista(u.filtros)) { const S = filtroDe(f); if (!S) return { ok: false, motivo: `el filtro de «${f && f.metrica}» no se recalcula con el dato` }; intersecar(S, `filtro ${f.metrica}`); } return null; },
      top: () => {
        if (!u.top) return null;
        const dentro = _norm(u.top.sobre) === "eje" ? TODOS : (set || TODOS);
        const S = topDe(u.top, dentro); if (!S) return { ok: false, motivo: "el top no se recalcula con el dato" };
        set = set ? new Set([...S].filter((x) => set.has(x))) : new Set(S); empuja(`top ${u.top.k} de ${u.top.metrica}`);
        return null;
      },
      excluir: () => {
        if (!(u.excluir && typeof u.excluir === "object")) return null;
        const ex = u.excluir, quitar = new Set();
        for (const e of _lista(ex.entidades)) { let c = null; try { c = base.entityIndex.resolveCanonical(eje, e); } catch { c = null; } if (!c) return { ok: false, motivo: `«${e}» no es una entidad de ${eje}` }; quitar.add(_norm(c)); }
        for (const n of _lista(ex.conjuntos)) { const S = conjuntoDe(n); if (!S) return { ok: false, motivo: `el conjunto «${n}» no se recalcula con el dato` }; for (const x of S) quitar.add(x); }
        for (const e of _lista(ex.estados)) { const S = estadoDe(e); if (!S) return { ok: false, motivo: `el estado «${e}» no se recalcula con el dato` }; for (const x of S) quitar.add(x); }
        if (ex.bodega) { const S = eje === "sku" ? bodegaDe(ex.bodega) : null; if (!S) return { ok: false, motivo: "la exclusión por bodega no se recalcula con el dato" }; for (const x of S) quitar.add(x); }
        if (_lista(ex.top).some((t) => t && typeof t === "object")) return { ok: false, motivo: "la exclusión por top no se recalcula" };
        const b = set || TODOS; set = new Set([...b].filter((x) => !quitar.has(x))); empuja("exclusión");
        return null;
      },
    };
    for (const k of bodegaPrimero ? ["base", "bodega", "estados", "no_estados", "filtros", "top", "excluir"] : ["base", "estados", "no_estados", "bodega", "filtros", "top", "excluir"]) { const err = pasos[k](); if (err) return err; }
    return { ok: true, eslabones, finales: set || TODOS };
  };
  const c1 = corrida(false);
  if (!c1.ok) return c1;
  const eslabones = c1.eslabones.slice();
  if (u.bodega && (_lista(u.estados).length || _lista(u.no_estados).length)) { const c2 = corrida(true); if (c2.ok) for (const e of c2.eslabones.slice(1)) eslabones.push({ nombre: `${e.nombre} (la bodega acota primero)`, tam: e.tam }); }
  return { ok: true, eslabones, finales: c1.finales, tam: c1.finales.size };
}

/** los «de M» admisibles de una cadena (54a): el tamaño de CUALQUIER eslabón, el final incluido; un M de 0 no es un universo */
export const mAdmisiblesDe = (cadena) => new Set(cadena.eslabones.map((e) => e.tam).filter((x) => x > 0).concat(cadena.tam > 0 ? [cadena.tam] : []));
/** el eslabón MÁS AJUSTADO distinto del final (54a): el menor tamaño de la cadena que supera al del universo final; null si ninguno lo supera */
export function eslabonMasAjustado(cadena) {
  const may = cadena.eslabones.map((e) => e.tam).filter((x) => x > cadena.tam).sort((a, b) => a - b);
  return may.length ? may[0] : null;
}
