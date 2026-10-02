/* === scripts/consolidacion/familias/f1_prioridad.mjs · INVARIANTE DE LA FAMILIA 1 · PRIORIDAD ══════════════════════════
 * «Quién va primero y qué lente o medida se nombra» (contrato §7.3·46d · 47a/47d · 48b · 50a · 51d · 52a/52e).
 *
 * LO QUE LEE: la ENTREGA (sus oraciones de prioridad, sus marcas, sus universos y su tabla de cifras) y el DATO de la
 * proyección (`dato.rankings`). NO lee `entrega/prioridad.js`: ni importa la pieza ni repite su lógica. La polaridad y la unidad son
 * las del léxico (`metricaPorClave`, la misma tabla que el contrato cita); los valores, los de la proyección; las lentes, las de
 * `CRITERIOS`/`LENTES` del agente (la fuente de las lentes, no de la pieza).
 *
 * LAS REGLAS (cada violación nombra la suya):
 *   primero-no-pide-atencion          el primero nombrado es el que pide atención por la medida nombrada (50a): con una magnitud
 *                                     (dinero, unidades) o con la medida de la lente, quien más pesa (el mayor); con una tasa o razón
 *                                     donde más es mejor, el menor.
 *   lente-nombrada-no-ordeno          la lente que la oración nombra es la que ordenó: su medida es la medida nombrada (46d).
 *   lente-pedida-callada              el usuario pidió una lente: la oración la nombra con su medida, o declara que no ordena (46d·47d).
 *   lente-no-pedida                   sin lente pedida, la oración nunca nombra una lente.
 *   riesgo-nombra-a-quien-no-es-primero-del-plan   si se dice «riesgo» (sobre un grupo o un dominio), lo nombrado es el primero del plan de señales de ese dominio (53, que corrige la 48b y la 51d).
 *   referencia-como-criterio          una referencia (umbral, piso, techo, benchmark) nunca se nombra como el criterio (52e).
 *   referencia-sin-nombrar            el criterio que solo trae una referencia nombra la medida que ordenó y la referencia como tal (52e).
 *   ventas-en-cobranza-sin-credito    en cobranza la lente «ventas» se dice «venta a crédito» (52a).
 *   sin-primero-contradice-lo-impreso «ninguna cuenta queda primera, porque el grupo no trae X» mientras la Entrega imprime X (51b).
 *   por-lente-cruzada-primero         la prioridad cruzada por una lente nombra a quien más pesa por la medida de esa lente (47a).
 *   prioridad-sin-marca               toda oración de prioridad lleva su marca estructural `_prioridad` (la que leen el tamaño gobernado y
 *                                     la pregunta abierta de «breve»; nadie lee ya el texto con una expresión regular).
 *   marca-primero-distinto            el `primero` de la marca es el que nombra la oración.
 *   ventas-sobre-inventario-ordena    la lente «ventas» pedida sobre una parte de INVENTARIO se declara y no ordena (50b · 54c): la oración de prioridad del grupo no la nombra como la lente que ordenó aunque el universo use un top por ventas.
 *   primero-fuera-del-eje             quien va primero es una entidad del eje de la parte que prioriza (51e · 53, segunda vuelta): «por riesgo integrado: LG-DRYER8KG» en una decision por BODEGA corona a un SKU que no es del grupo. */
const _norm = (s) => String(s == null ? "" : s).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
const CAB = /^(Prioridad del procedimiento|Quien más pesa en el conjunto)(?: (dentro de este grupo))?, por (.+?): (.*)$/s;
const MARCADOR = /^(Prioridad del procedimiento|Quien más pesa en el conjunto)/;
const DECL = /^(.+?) \((el criterio pedido|la referencia pedida), (.+?), (?:es de .+? y |es el criterio entre dominios y )?no ordena este grupo\)$/;

/** parte la oración de prioridad en sus piezas (null si no es una oración de prioridad «por X: …») */
export function analizarOracion(texto) {
  const m = CAB.exec(String(texto || ""));
  if (!m) return null;
  const S = { texto, grupo: !!m[2], cabeza: m[1], nombreRaw: m[3], resto: m[4], primero: null, medida: null, valor: null, sinPrimero: false };
  const d = DECL.exec(m[3]);
  if (d) { S.medidaNombrada = d[1]; S.decl = { tipo: d[2] === "la referencia pedida" ? "referencia" : "criterio", pedido: d[3] }; } else S.nombre = m[3];
  const r = m[4];
  let x;
  if (/^ninguna cuenta queda primera, porque /.test(r)) {
    S.sinPrimero = true;
    const mm = /\bno (?:tiene|trae) (.+?)(?: \(|;|\.|$)/.exec(r);
    if (mm) { S.medida = mm[1]; S.verbo = /\bno trae\b/.test(r) ? "trae" : "tiene"; }
    const g = /el grupo \(([^)]*)\)/.exec(r); if (g) S.miembrosDichos = g[1].split(",").map((s) => s.trim()).filter(Boolean);
  } else if ((x = /ordenado por (.+?), lo encabeza (.+)\.$/.exec(r))) { S.medida = x[1]; S.primero = x[2]; S.forma = "encabeza"; }
  else if ((x = /^(.+?), con (.+?) en ([^,]+?)\.$/.exec(r))) { S.primero = x[1]; S.valor = x[2]; S.medida = x[3]; S.forma = "cifra"; }
  else if ((x = /^(.+?) \(\d+ de \d+ en .+\)\.$/.exec(r))) { S.primero = x[1]; S.forma = "universo"; }
  else if ((x = /^(.+?)(?: — | \()/.exec(r))) { S.primero = x[1]; S.forma = "cruzada"; }
  return S;
}

/** las «abiertas» congeladas de la F1 (riesgo pedido sobre un dominio · lente de otro dominio) frente a la condición del 53: cuántas la cumplen y cuántas son violaciones reales (para el informe) */
export const ESTADISTICA_53 = { pasan: 0, reales: 0 };
export const familia = {
  id: "F1",
  nombre: "prioridad: quién va primero y qué lente o medida se nombra",
  invariante(ctx) {
    const { entrega, resolucion, dato, base } = ctx;
    const vs = [];
    /* `abierta`: la regla es del contrato vigente pero el comportamiento de hoy no la cumple y arreglarlo es COMPORTAMIENTO NUEVO (frases nuevas): queda declarada, contada y congelada por el gate (no puede crecer), a decisión del owner */
    const v = (regla, detalle, abierta = false) => vs.push({ regla, detalle: String(detalle).slice(0, 320), ...(abierta ? { abierta: true } : {}) });
    const lex = base.lexico, esq = base.esquema;
    const CRITERIOS = base.prioridadIntegrada.CRITERIOS, LENTES = base.prioridadIntegrada.LENTES;
    const respuesta = Array.isArray(entrega.respuesta) ? entrega.respuesta : [];
    const nombreVentaCredito = _norm((lex.metricaPorClave("venta_credito") || {}).nombre || "venta a credito");

    /* ── los nombres con que se dice cada lente (los de la casa) y las referencias del léxico ───────────────────────── */
    const visiblesDe = (id) => { const L = CRITERIOS[id]; if (!L) return []; const s = new Set([_norm(L.nombre), _norm(String(L.nombre).split(/\s+/)[0])]); if (id === "ventas") s.add(nombreVentaCredito); return [...s]; };
    const idDeLente = new Map(); for (const id of Object.keys(CRITERIOS)) for (const n of visiblesDe(id)) if (!idDeLente.has(n)) idDeLente.set(n, id);
    const refs = lex.CLAVES_DE_METRICA.filter((m) => m.referencia);
    const refNombres = new Set(refs.map((m) => _norm(m.nombre)));
    const esNombreDeReferencia = (n) => { const t = _norm(n); return refNombres.has(t) || /^(umbral|piso|techo|nivel de carga|benchmark)\b/.test(t); };
    /* solo el rótulo EXACTO de una métrica del léxico identifica su clave: «unidades en stock» no es «capital» aunque contenga «stock» */
    const claveDe = (medida) => (medida ? lex.claveExactaDeMetrica(medida) || null : null);
    /* ¿la medida nombrada es la medida de la lente `id`? (la que declara `LENTES`, o la venta para «ventas», o la variación para «crecimiento») */
    const esMedidaDeLente = (id, medida) => {
      const L = CRITERIOS[id]; if (!L || !medida) return false;
      if (L.dominio && L.lente && LENTES[L.dominio] && LENTES[L.dominio][L.lente]) return LENTES[L.dominio][L.lente].re.test(`· ${medida}`) || LENTES[L.dominio][L.lente].re.test(`· ${_norm(medida)}`);
      if (id === "ventas") return /^venta/.test(_norm(medida));
      if (id === "crecimiento") return /yoy|variaci/.test(_norm(medida));
      return false;
    };

    /* ── los grupos que sirve cada parte `decision`: de dónde sale «el grupo» de una oración de prioridad ────────────── */
    const partes = (resolucion && Array.isArray(resolucion.partes) ? resolucion.partes : []);
    const decisiones = partes.filter((p) => p.cierre === "decision");
    const miembrosDe = (p) => {
      if (Array.isArray(p.entidades) && p.entidades.length) return { eje: p.eje || null, miembros: p.entidades.map((e) => e.nombre) };
      const u = (entrega.universos || []).find((x) => x.id === p.id);
      return u ? { eje: u.eje || p.eje || null, miembros: u.entidades || [] } : null;
    };
    const grupos = decisiones.map((p) => ({ parte: p, ...(miembrosDe(p) || { eje: null, miembros: [] }) }));
    /* cómo publica la proyección una métrica en un eje cuando su clave del léxico no es la del ranking (el margen por SKU es `margen_venta`) */
    const CLAVE_DEL_RANKING = { sku: { margen: "margen_venta" } };
    const valoresDe = (eje, clave) => { const k = (CLAVE_DEL_RANKING[eje] && CLAVE_DEL_RANKING[eje][clave]) || clave; const rk = dato && dato.rankings && dato.rankings[eje] && dato.rankings[eje][k]; return rk ? new Map((rk.filas || []).filter((f) => Number.isFinite(f.valor)).map((f) => [_norm(f.entidad), f.valor])) : null; };
    /* ¿quien pide atención es el MAYOR o el MENOR de la medida? (50a: una magnitud, de mayor a menor; solo una tasa o razón donde más es mejor invierte) */
    const atencionEsElMenor = (clave, comoLente) => {
      if (comoLente) return false;
      const m = lex.metricaPorClave(clave) || {};
      if (m.unidad === "money" || m.unidad === "count") return false;
      const rk = Object.values(dato.rankings || {}).map((porClave) => porClave[clave]).find(Boolean);
      return !!(rk && rk.peorEs === "menor");
    };

    /* la medida de la lente de MATERIALIDAD de cada dominio (la que ordena el plan de señales): `LENTES[dominio].materialidad` — eje y clave del dato */
    /* las señales de cada dominio, del DATO: eje, clave del ranking y el rótulo con que el plan de señales (`prioridadIntegrada`, la prioridad del procedimiento del agente) las lee */
    const SENALES_DEL_DOMINIO = { comercial: { cliente: [["no_capturada", "Contribución no capturada"], ["brecha", "Brecha al benchmark"]] }, cobranza: { cliente: [["saldo_vencido", "Saldo vencido"], ["recuperado", "Recuperado"], ["dias_vencido", "Dias Vencido"]] }, inventario: { sku: [["capital_frenado", "Capital inmovilizado crítico"], ["dias_inventario", "Días de inventario"], ["dias_sin_venta", "Días sin venta"]] } };
    /* el PRIMERO del plan de señales de un dominio (materialidad + severidad + urgencia) sobre un alcance (null = la cartera): lo calcula el mismo procedimiento del agente con los valores del dato. En un dominio de clave cliente es la prioridad integrada; en los SKU, el de mayor materialidad. */
    const primerosDelPlan = (dominio, alcance) => {
      const figs = [];
      for (const [eje, senales] of Object.entries(SENALES_DEL_DOMINIO[dominio] || {})) for (const [clave, rotulo] of senales) {
        const vals = valoresDe(eje, clave); if (!vals) continue;
        const rk = dato.rankings[eje][(CLAVE_DEL_RANKING[eje] && CLAVE_DEL_RANKING[eje][clave]) || clave];
        for (const fila of rk.filas) if (Number.isFinite(fila.valor) && (!alcance || alcance.has(_norm(fila.entidad)))) figs.push({ label: `${fila.entidad} · ${rotulo}`, raw: fila.valor, value: String(fila.valor), eje });
      }
      let P = null; try { P = base.prioridadIntegrada.prioridadIntegrada(figs, [dominio]); } catch { P = null; }
      if (!P) return null;
      /* el primero del plan, y quienes EMPATAN con él en cada señal (con todo en cero el orden entre iguales es arbitrario: cualquiera de ellos es «el primero») */
      const ns = (x) => { const sg = dominio === "inventario" ? x : ((x.senales || {})[dominio] || {}); return ["materialidad", "severidad", "urgencia"].map((l) => (sg[l] ? sg[l].n : null)).join("|"); };
      const filas = dominio === "inventario" ? (P.porDominio[dominio] || []) : (P.integrada || []);
      const lista = filas.length ? filas.filter((x) => ns(x) === ns(filas[0])).map((x) => x.entidad) : [];
      return lista.map(_norm);
    };
    const crit = resolucion && resolucion.criterio ? resolucion.criterio : null;
    const lentePedida = crit && crit.origen === "usuario" && crit.lente && CRITERIOS[crit.lente] ? crit.lente : null;
    const soloReferencia = !!(crit && crit.origen === "usuario" && !crit.lente && crit.referencia && crit.referencia.concepto);
    /* los dominios sobre los que la Entrega prioriza (las partes decision y lectura): con uno solo no hay prioridad ENTRE dominios */
    const temasQuePrioriza = new Set(partes.filter((p) => p.cierre === "decision" || p.cierre === "lectura").map((p) => p.tema));

    /* los ejes sobre los que prioriza la Entrega: el eje efectivo de cada parte decision o lectura (una bodega no se corona con un SKU: 51(e) · 53) */
    const ejesDe = (n) => { if (/\s[−-]\s/.test(String(n))) return []; const out = []; for (const e of esq.EJES) { let c = null; try { c = base.entityIndex.resolveCanonical(e, n); } catch { c = null; } if (c) out.push(e); } return out; };
    const ejesQuePrioriza = new Set(partes.filter((p) => (p.cierre === "decision" || p.cierre === "lectura") && p.estado !== "no_resuelta").map((p) => p.eje || (esq.sujetoDeTema ? esq.sujetoDeTema(p.tema) : null)).filter(Boolean));

    for (const r of respuesta) {
      const texto = String((r && r.texto) || "");
      const esPrioridad = MARCADOR.test(texto);
      if (esPrioridad && !r._prioridad) v("prioridad-sin-marca", `la oración de prioridad no lleva su marca estructural: «${texto.slice(0, 90)}»`);
      const S = analizarOracion(texto);
      if (!S) continue;
      /* 51(e) · 53: quien va primero es del eje de la parte que prioriza; «por riesgo integrado: LG-DRYER8KG» en una decision por BODEGA corona a quien no es del grupo */
      if (S.primero != null && !S.sinPrimero && ejesQuePrioriza.size) {
        const es = ejesDe(S.primero);
        if (es.length && !es.some((e) => ejesQuePrioriza.has(e))) v("primero-fuera-del-eje", `«${S.primero}» es de ${es.join("/")} y la Entrega prioriza sobre ${[...ejesQuePrioriza].join("/")}: «${texto.slice(0, 100)}»`);
      }
      const nom = S.nombre != null ? _norm(S.nombre) : null;
      /* un nombre que es EL NOMBRE DE LA MEDIDA de la misma oración («por contribución: X, con $4.3M en contribución») es la medida, no la lente homónima */
      const esLaMedida = nom != null && S.medida != null && nom === _norm(S.medida) && !(lentePedida && visiblesDe(lentePedida).includes(nom));
      const tipoNombre = nom == null ? "declara" : (nom === "riesgo integrado" || nom === "riesgo") ? "riesgo" : esLaMedida ? "medida" : idDeLente.has(nom) ? "lente" : esNombreDeReferencia(S.nombre) ? "referencia" : "medida";
      const idLente = tipoNombre === "lente" ? idDeLente.get(nom) : null;
      if (r._prioridad && r._prioridad.primero != null && S.primero != null && _norm(r._prioridad.primero) !== _norm(S.primero)) v("marca-primero-distinto", `la marca dice «${r._prioridad.primero}» y la oración nombra «${S.primero}»`);

      /* §7.3·53 (corrige la 48(b) y la 51(d)): «por riesgo integrado: X» sobre un grupo, o sobre UN dominio, vale cuando X es el PRIMERO del plan de señales de ese dominio (materialidad + severidad + urgencia: la prioridad del procedimiento); lo que se prohíbe es nombrar riesgo cuando el plan no ordenó esa lista, o coronar a alguien distinto del primero del plan. Se lee del dato: el primero del plan es quien más pesa por la medida de materialidad del dominio (dato.rankings). */
      if (tipoNombre === "riesgo" && S.primero != null) {
        const dominio = S.grupo ? ((grupos.find((g) => g.miembros.some((m) => _norm(m) === _norm(S.primero))) || {}).parte || {}).tema : (temasQuePrioriza.size === 1 ? [...temasQuePrioriza][0] : null);
        /* el plan de señales se arma sobre el alcance de la parte: si el usuario nombró entidades o declaró un universo propio, el primero es el de ESE conjunto; sin restricción, el de la cartera */
        const delDominio = partes.filter((p) => p.tema === dominio && (p.cierre === "decision" || p.cierre === "lectura"));
        /* las partes de un mismo dominio pueden tener alcances distintos (una de cartera, otra con entidades nombradas): la oración vale si nombra al primero del plan de CUALQUIERA de esos alcances */
        const alcances = [null];
        for (const p of delDominio) if ((Array.isArray(p.entidades) && p.entidades.length) || esq.universoTieneRestriccionPropia(p.universo)) alcances.push(new Set(((miembrosDe(p) || { miembros: [] }).miembros).map(_norm)));
        const candidatos = dominio ? alcances.map((al) => primerosDelPlan(dominio, al)).filter((x) => x && x.length) : [];
        const primeros = candidatos.length ? candidatos[candidatos.length - 1] : null;
        if (primeros && primeros.length) {
          const esDelPlan = candidatos.some((c) => c.includes(_norm(S.primero)));
          const abiertaDeLaF1 = !S.grupo && nom === "riesgo integrado" && temasQuePrioriza.size === 1 && (lentePedida === "riesgo" || (lentePedida && /no ordena este conjunto/.test(texto)));
          if (abiertaDeLaF1) ESTADISTICA_53[esDelPlan ? "pasan" : "reales"]++;
          if (!esDelPlan) v("riesgo-nombra-a-quien-no-es-primero-del-plan", `«por riesgo» nombra a «${S.primero}» y el primero del plan de señales de ${dominio} es ${primeros.join(" / ")}: «${texto.slice(0, 100)}»`);
        }
      }
      /* 52(e): una referencia nunca es el criterio */
      if (tipoNombre === "referencia") v("referencia-como-criterio", `la oración nombra la referencia «${S.nombre}» como criterio`);
      /* 46(d): la lente nombrada es la que ordenó (su medida es la medida nombrada) */
      if (tipoNombre === "lente" && S.medida) {
        if (!esMedidaDeLente(idLente, S.medida)) v("lente-nombrada-no-ordeno", `nombra la lente «${S.nombre}» pero la medida es «${S.medida}»`);
      }
      /* 52(a): en cobranza «ventas» se dice «venta a crédito» */
      if (tipoNombre === "lente" && idLente === "ventas" && nom === "ventas") {
        const c = claveDe(S.medida);
        if (c === "venta_credito" || (S.medida && /flujo|a cr[eé]dito/i.test(S.medida))) v("ventas-en-cobranza-sin-credito", `dice «por ventas» sobre la venta a crédito (${S.medida})`);
      }
      if (S.decl && S.decl.tipo === "criterio" && _norm(S.decl.pedido) === "ventas" && lex.dominioDeClave(claveDe(S.medidaNombrada)) === "cobranza") v("ventas-en-cobranza-sin-credito", `declara «ventas» sobre una medida de cobranza (${S.medidaNombrada})`);
      /* 46(d)·47(d): la lente pedida se nombra con su medida o se declara que no ordena; sin lente pedida, nunca se nombra una lente */
      if (S.grupo) {
        if (lentePedida && lentePedida !== "riesgo") {
          const nombraLaPedida = tipoNombre === "lente" && idLente === lentePedida;
          const laDeclara = !!(S.decl && S.decl.tipo === "criterio" && visiblesDe(lentePedida).includes(_norm(S.decl.pedido)));
          if (!nombraLaPedida && !laDeclara) v("lente-pedida-callada", `se pidió «${CRITERIOS[lentePedida].nombre}» y la oración no la nombra ni declara que no ordena: «${texto.slice(0, 110)}»`);
        } else if (lentePedida === "riesgo") {
          if (!(S.decl && S.decl.tipo === "criterio")) v("lente-pedida-callada", `se pidió riesgo y la oración de un grupo no declara que es el criterio entre dominios: «${texto.slice(0, 110)}»`);
        } else if (tipoNombre === "lente") v("lente-no-pedida", `nombra la lente «${S.nombre}» sin que el usuario la haya pedido`);
        /* §7.3·54(c) (la 50(b) en todos los caminos): el inventario no publica la venta; la lente «ventas» sobre una parte de INVENTARIO se declara y no ordena, aunque el universo de la parte use un top por ventas */
        if (lentePedida === "ventas" && S.primero != null && !S.sinPrimero) {
          const deEsto = grupos.filter((g) => g.miembros.some((m) => _norm(m) === _norm(S.primero)));
          const laDeclaraVentas = !!(S.decl && S.decl.tipo === "criterio" && visiblesDe("ventas").includes(_norm(S.decl.pedido)));
          if (deEsto.length && deEsto.every((g) => g.parte.tema === "inventario") && !laDeclaraVentas) v("ventas-sobre-inventario-ordena", `la lente «ventas» sobre una parte de inventario no se declara como la que no ordena: «${texto.slice(0, 110)}»`);
        }
        if (soloReferencia && !S.sinPrimero && S.primero != null) {
          const ref = crit.referencia.concepto, nomRef = _norm((lex.metricaPorClave(ref) || {}).nombre || ref);
          if (!(S.decl && S.decl.tipo === "referencia" && _norm(S.decl.pedido) === nomRef)) v("referencia-sin-nombrar", `el criterio solo trae la referencia «${nomRef}» y la oración no la nombra como referencia: «${texto.slice(0, 110)}»`);
        }
      }
      /* 50(a): el primero nombrado es el que pide atención por la medida nombrada */
      if (S.grupo && S.primero != null && (S.forma === "cifra" || S.forma === "encabeza" || S.forma === "universo")) {
        /* la medida: la que la oración dice («con V en M», «ordenado por M»), la que declara el criterio no ordenante o, sin eso, el nombre de la medida tras «por» */
        const medidaTxt = S.medida || S.medidaNombrada || (tipoNombre === "medida" ? S.nombre : null); const clave = claveDe(medidaTxt);
        const comoLente = tipoNombre === "lente" && esMedidaDeLente(idLente, medidaTxt);
        const deEstoMiembros = grupos.filter((g) => g.miembros.some((m) => _norm(m) === _norm(S.primero)));
        /* si varias partes sirven a ese primero, la oración es de la que pide esa medida; sin eso (la medida de una lente que ninguna parte pidió), de todas */
        const pideLaMedida = (p) => (Array.isArray(p.conceptos) && p.conceptos.includes(clave)) || !!(p.universo && p.universo.top && p.universo.top.metrica === clave);
        const delConcepto = clave ? deEstoMiembros.filter((g) => pideLaMedida(g.parte)) : [];
        const candidatos = delConcepto.length ? delConcepto : deEstoMiembros;
        if (!candidatos.length) v("primero-no-pide-atencion", `«${S.primero}» no pertenece a ningún grupo servido por una parte decision`);
        else if (clave) {
          let verificable = false, algunoCumple = false, detalle = "";
          for (const g of candidatos) {
            const vals = valoresDe(g.eje, clave); if (!vals) continue;
            const deMiembros = g.miembros.map((m) => ({ m, x: vals.get(_norm(m)) })).filter((o) => Number.isFinite(o.x));
            const mio = vals.get(_norm(S.primero));
            if (!Number.isFinite(mio)) continue;
            if (deMiembros.length < 2) { verificable = true; algunoCumple = true; break; }   // un grupo de uno: su primero es trivialmente el que pide atención
            verificable = true;
            const menor = atencionEsElMenor(clave, comoLente);
            const ext = menor ? Math.min(...deMiembros.map((o) => o.x)) : Math.max(...deMiembros.map((o) => o.x));
            if (Math.abs(mio - ext) < 1e-9) { algunoCumple = true; break; }
            detalle = `«${S.primero}» (${mio}) no es ${menor ? "el menor" : "el mayor"} en ${medidaTxt} del grupo (${ext})`;
          }
          if (verificable && !algunoCumple) v("primero-no-pide-atencion", detalle);
        }
      }
      /* 51(b): «ninguna cuenta queda primera, porque el grupo no trae X» mientras la Entrega imprime X para ese grupo */
      if (S.sinPrimero && S.verbo === "trae" && S.medida && Array.isArray(S.miembrosDichos) && S.miembrosDichos.length) {
        const mNorm = _norm(S.medida);
        const filas = (entrega.cifras && entrega.cifras.filas) || [];
        const impresa = filas.find((f) => { const val = f.valores || {}; const ent = _norm(val["Entidad / grupo"] || val.Entidad || ""); return _norm(val["Métrica"] || val.Metrica || "") === mNorm && S.miembrosDichos.some((n) => _norm(n) === ent); });
        if (impresa) v("sin-primero-contradice-lo-impreso", `dice que el grupo no trae «${S.medida}» y la Entrega imprime ${JSON.stringify(impresa.valores).slice(0, 120)}`);
      }
      /* 47(a): la prioridad cruzada por una lente nombra a quien más pesa por la medida de esa lente (sobre todo el eje de la lente) */
      if (!S.grupo && tipoNombre === "lente" && S.primero != null && S.medida && S.forma === "cifra") {
        const clave = claveDe(S.medida), eje = CRITERIOS[idLente].clave;
        const vals = clave && eje ? valoresDe(eje, clave) : null;
        const mio = vals ? vals.get(_norm(S.primero)) : NaN;
        if (vals && vals.size >= 2 && Number.isFinite(mio)) {
          const ext = Math.max(...vals.values());
          if (Math.abs(mio - ext) > 1e-9 && !(esq.universoTieneRestriccionPropia(((partes.find((p) => p.cierre === "decision") || {}).universo)) || partes.some((p) => Array.isArray(p.entidades) && p.entidades.length))) v("por-lente-cruzada-primero", `«${S.primero}» (${mio}) no es quien más pesa por «${S.medida}» (${ext})`);
        }
      }
    }
    return vs;
  },
};
