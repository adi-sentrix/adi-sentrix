/* === scripts/consolidacion/familias/f2_servido.mjs · INVARIANTE DE LA FAMILIA 2 · LO ANUNCIADO ES LO SERVIDO ═══════════════
 * «Toda entidad nombrada, anunciada o servida por un top tiene su fila en cada concepto pedido que su productor publica; si no la
 * tiene, se declara con verdad; un límite nunca niega una cifra que la misma Entrega imprime» (contrato §7.3·44(a) · 45(a) · 48(a) ·
 * 49(c) · 51(b)/(e) · 52(b)/(c)/(e)) — y LA REGLA DEL CERO (52b): solo hay dos ceros reales, el MEDIDO (la fuente tiene la fila de la
 * entidad y el valor es 0) y el de COBERTURA DECLARADA (la fuente declara que cubre a todo el grupo); todo lo demás es dato ausente, que se
 * dice «sin dato de X para Y» y nunca es un número.
 *
 * LO QUE LEE: la ENTREGA (sus tablas Cifras y Detalle, sus límites, sus oraciones y sus universos) y el DATO de la proyección
 * (`dato.rankings`, `dato.figs`, la declaración de cobertura de las fuentes `config/contract/coberturaDeFuentes.js`, que es dato del
 * contrato). NO lee `entrega/servidas.js`: ni importa la pieza ni repite su lógica.
 *
 * LAS REGLAS (cada violación nombra la suya):
 *   servida-sin-fila           una entidad que el usuario NOMBRA o que la parte SIRVE (su universo declarado) no tiene fila en un concepto
 *                              pedido que el dato publica para ella (una fila del ranking, o su cero por cobertura declarada), ni la
 *                              Entrega declara que falta (51b · 48a · 49c · 45a · decisión 30).
 *   anunciada-sin-fila         la cabeza «ordenado por M: A, B» anuncia entidades sin fila de M ni declaración (45a/51a).
 *   ausente-sin-declarar       el dato ausente de una entidad servida (la fuente publica la métrica a otras entidades del eje, a ella no) no se declara: se calla (52b).
 *   limite-niega-lo-impreso    un límite dice «no se pudo servir la cifra de X», «sin dato de M para X» o «la foto no trae M de X» mientras la
 *                              Entrega imprime esa cifra (51b, 2.ª frase).
 *   cero-sin-origen            un 0 impreso en una fila medida no tiene origen en el dato: ni la fila de la fuente con valor 0 (medido) ni una fuente
 *                              que declare cubrir al grupo para esa métrica (52b).
 *   sin-dato-como-numero       un «sin dato» impreso como número (NaN, «null», «undefined») (52b).
 *   tasa-sin-denominador-como-cero una tasa impresa como 0 % cuyo denominador el dato no trae o vale cero (52b).
 *   fila-duplicada             la misma fila (entidad, rótulo y valor iguales) se imprime dos veces: una cifra se escribe una vez (40b · 52e, consolidación F5).
 *   (segunda vuelta · el EJE y la FOTO; lee además `base.publica`: lo que el Core publica por cada eje que el registro de métricas declara, no solo la proyección)
 *   eje-servido                una lectura/decision/cifra con eje X sirve entidades del eje X (51e): nunca una bodega servida como SKU.
 *   foto-sin-servir            una lectura/decision sin universo ni entidades, con conceptos que el dato publica en su eje, sirve su foto (45a · 49c).
 *   foto-incompleta            en comercial e inventario la foto es el eje entero (45a · 49c).
 *   foto-ordenada-por-otro-concepto  la cabeza de la foto dice «ordenado por M» y M no es el primer concepto pedido que el dato publica (51a).
 *   sin-dato-con-dato-publicado «sin dato de M para X» (o «la foto no trae M de X») cuando el Core publica M para X: un «sin dato» nunca acompaña a una cifra que el dato publica (52b · 51b).
 *   (segunda vuelta · parte B · FIRMES: el owner aprobó el cambio de ~120 textos de los catálogos)
 *   foto-cobranza-fuera-del-orden-de-la-mesa  la foto de cobranza va en el orden de la mesa (52c, owner), no en el de un concepto.
 *   empate-del-filo-en-cero-sin-palabras      el cero de un empate en el filo se dice en palabras de negocio junto a su cifra (39c · 46f).
 *   ausencia-sin-la-forma-sin-dato            la ausencia de una cifra se dice «sin dato de X para Y» (52b), no con otras palabras.
 * (El margen por SKU ya no está exento: el Notario lo verifica como cifra de una entidad y el productor lo sirve; consolidación F5.) */
import { COBERTURA_DE_FUENTES, coberturaDeLaMetrica } from "../../../src/config/contract/coberturaDeFuentes.js";

const _norm = (s) => String(s == null ? "" : s).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
const _esc = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
/* el valor de una celda, como número, y si es un cero impreso (la cifra entera vale 0: «$0», «0d», «0», «0.0%», «0.0x») */
const _numDe = (txt) => { const m = /(-?\d[\d.,]*)/.exec(String(txt || "")); if (!m) return NaN; let t = m[1]; if (/,\d{1,2}$/.test(t)) t = t.replace(/\./g, "").replace(",", "."); else t = t.replace(/,/g, ""); return parseFloat(t); };
const _esCeroImpreso = (txt) => { const t = String(txt || "").trim(); return /^[$]?\s*0(?:[.,]0+)?\s*(?:[KMB]|%|x|d|días?)?$/i.test(t.replace(/\s/g, "")); };
/* una tasa vive en porcentaje: se mide por la unidad del léxico, no por el rótulo */
const _CLAVE_DE_RANKING = (eje, clave, tema) => (eje === "sku" && clave === "margen" ? (tema === "inventario" ? "margen_inventario" : "margen_venta") : clave);
/* el denominador de cada tasa (de dónde sale su base): la métrica cuya fila de la fuente debe traer la entidad con un valor > 0 */
const DENOMINADOR = { recuperado: "venta_credito", margen: "ventas", carga: "ventas", brecha: "ventas" };

export const familia = {
  id: "F2",
  nombre: "lo anunciado es lo servido: toda entidad tiene su fila o su declaración, y el cero solo si el dato lo demuestra",
  invariante(ctx) {
    const { entrega, resolucion, dato, base } = ctx;
    const vs = [];
    const v = (regla, detalle, abierta = false) => vs.push({ regla, detalle: String(detalle).slice(0, 320), ...(abierta ? { abierta: true } : {}) });
    const lex = base.lexico, esq = base.esquema;
    const R = (dato && dato.rankings) || {};
    const respuesta = Array.isArray(entrega.respuesta) ? entrega.respuesta : [];
    const textos = respuesta.map((r) => String((r && r.texto) || ""));
    const limites = Array.isArray(entrega.limites) ? entrega.limites : [];
    const textoLimites = limites.map((l) => `${l.titulo || ""} ${l.motivo || ""}`);

    /* ── lo impreso: las filas de Cifras y del Detalle (los mismos ids: lo recortado no desaparece) ────────────────── */
    const filas = [...((entrega.cifras && entrega.cifras.filas) || []), ...((entrega.detalle && Array.isArray(entrega.detalle.filas) ? entrega.detalle.filas : []))];
    const celdas = filas.map((f) => { const x = f.valores || {}; return { ent: x["Entidad / grupo"] != null ? x["Entidad / grupo"] : (x.Entidad != null ? x.Entidad : x.Cliente), met: x["Métrica"] != null ? x["Métrica"] : x.Metrica, val: x.Valor, tipo: x.Tipo, fila: f }; }).filter((c) => c.ent != null && c.met != null && c.val != null);
    const claveDeRotulo = (met) => lex.claveExactaDeMetrica(met) || lex.claveDeMetrica(met) || null;
    const hayFila = (ent, clave) => celdas.some((c) => _norm(c.ent) === _norm(ent) && (claveDeRotulo(c.met) === clave || _norm(c.met) === _norm((lex.metricaPorClave(clave) || {}).nombre)));
    const filasDe = (ent) => celdas.filter((c) => _norm(c.ent) === _norm(ent));
    const nombreDe = (clave) => ((lex.metricaPorClave(clave) || {}).nombre) || clave;

    /* ── una cifra se escribe UNA vez (40b · 52e): la misma fila (entidad, rótulo y valor iguales) no sale dos veces entre Cifras y Detalle ──────── */
    { const vistas = new Set(); for (const c of celdas) { const x = c.fila.valores || {}; const k = [c.ent, c.met, String(c.val).trim(), x.Tema, x["Simulación"], x.Supuesto].join("|"); if (vistas.has(k)) v("fila-duplicada", `«${c.ent} · ${c.met}» = ${c.val} (${x.Tema || "—"}) se imprime dos veces`); else vistas.add(k); } }

    /* ── el dato: qué publica la fuente para una entidad y un concepto ────────────────────────────────────────────── */
    /* EL DATO PUBLICADO (`base.publica`): además de los rankings de la proyección, lo que el Core publica por cada eje que el registro de métricas declara (la rotación, los días de inventario y las
     * unidades en stock de cada BODEGA no están en la proyección, pero el dato las publica: un «sin dato» sobre ellas es falso). Independiente de las piezas de composición. */
    const publicadoPorElCore = (eje, clave) => (typeof base.publica === "function" ? base.publica(eje, clave) : null);
    const filaDelRanking = (eje, clave, ent, tema) => {
      const rk = R[eje] && R[eje][_CLAVE_DE_RANKING(eje, clave, tema)];
      const f = rk && Array.isArray(rk.filas) ? (rk.filas.find((x) => _norm(x.entidad) === _norm(ent) && Number.isFinite(x.valor)) || null) : null;
      if (f || rk) return f;   /* la proyección del contexto publica este ranking: manda ella (una fila ausente es ausente); solo si no lo publica se mira lo que publica el Core */
      const pub = publicadoPorElCore(eje, _CLAVE_DE_RANKING(eje, clave, tema) === "margen_venta" ? "margen" : clave);
      return pub && pub.has(_norm(ent)) ? { entidad: ent, valor: pub.get(_norm(ent)) } : null;
    };
    const rankingPublicado = (eje, clave, tema) => { const rk = R[eje] && R[eje][_CLAVE_DE_RANKING(eje, clave, tema)]; return !!((rk && Array.isArray(rk.filas) && rk.filas.length) || publicadoPorElCore(eje, clave)); };
    const esDelEje = (eje, ent) => Object.values(R[eje] || {}).some((rk) => rk && Array.isArray(rk.filas) && rk.filas.some((f) => _norm(f.entidad) === _norm(ent)));
    /* ¿el dato demuestra algo para (entidad, concepto)? → "medido" (la fila de la fuente) · "cobertura" (la fuente declara cubrir al grupo y la entidad es del grupo) · null (dato ausente) */
    const origenEnElDato = (eje, clave, ent, tema) => {
      if (filaDelRanking(eje, clave, ent, tema)) return "medido";
      if (rankingPublicado(eje, clave, tema) && coberturaDeLaMetrica(clave, eje) && esDelEje(eje, ent)) return "cobertura";
      return null;
    };
    const ejeDe = (p, e) => (e && e.eje) || p.eje || (esq.sujetoDeTema ? esq.sujetoDeTema(p.tema) : null) || "cliente";
    /* ¿la Entrega DECLARA que falta (E, c)? un límite que nombra a la entidad y el concepto, o el «no se pudo servir la cifra de E» de siempre (todo lo de E) */
    const declarado = (ent, clave) => textoLimites.some((t) => { const tn = _norm(t); if (!tn.includes(_norm(ent))) return false; return tn.includes("no se pudo servir la cifra de") || tn.includes(_norm(nombreDe(clave))) || /sin dato de/.test(tn); });

    const partes = (resolucion && Array.isArray(resolucion.partes) ? resolucion.partes : []).filter((p) => ["cifra", "lectura", "decision", "comparacion"].includes(p.cierre) && p.estado !== "no_resuelta");
    const servidasPorParte = [];
    for (const p of partes) {
      const conceptos = Array.isArray(p.conceptos) ? p.conceptos : [];
      const cola = [];
      for (const e of Array.isArray(p.entidades) ? p.entidades : []) cola.push({ n: e.nombre, eje: ejeDe(p, e), via: "nombrada" });
      const u = (entrega.universos || []).find((x) => x.id === p.id && !x.soloRanking);
      if (u) for (const n of u.entidades || []) if (!cola.some((x) => _norm(x.n) === _norm(n))) cola.push({ n, eje: u.eje || ejeDe(p, null), via: "servida" });
      servidasPorParte.push({ p, cola });
      if (!conceptos.length) continue;
      for (const s of cola) {
        for (const c of conceptos) {
          if (hayFila(s.n, c)) continue;
          const origen = origenEnElDato(s.eje, c, s.n, p.tema);
          /* el dato la publica: una declaración de que falta NO la excusa (se declara con verdad: lo que el dato trae se sirve) */
          if (origen) { v("servida-sin-fila", `${p.id} · «${s.n}» (${s.via}) no tiene fila de «${nombreDe(c)}» y el dato la publica (${origen})${declarado(s.n, c) ? "; la Entrega dice que falta" : "; la Entrega no lo declara"}`); continue; }
          /* el dato no la publica pero la fuente SÍ publica a otras entidades del eje (dato ausente de esta entidad): hay que declararlo, nunca callarlo (52b) */
          if (rankingPublicado(s.eje, c, p.tema) && esDelEje(s.eje, s.n) && !declarado(s.n, c)) v("ausente-sin-declarar", `${p.id} · «${s.n}» (${s.via}) no tiene dato de «${nombreDe(c)}» en la fuente y la Entrega no lo declara («sin dato de X para Y»)`);
        }
      }
    }

    /* ── EL EJE Y LA FOTO (51e · 45a · 49c, consolidación segunda vuelta) ───────────────────────────────────────────────────────────────────────
     * eje-servido        una `lectura`/`decision`/`cifra` con eje X sirve entidades del eje X: ningún universo que su parte declara (el suyo o el de su prioridad) nombra a una entidad de otro eje (una bodega
     *                    servida como SKU: «quien más pesa es LG-DRYER8KG» en una lectura por bodega).
     * foto-sin-servir    una `lectura`/`decision` sin entidades ni universo propio, con conceptos que el dato publica en su eje, sirve su foto: un universo con el id de la parte.
     * foto-incompleta    en comercial e inventario la foto es el EJE ENTERO (45a · 49c); cobranza sirve las cuentas de su mesa y declara la cola (52c), así que ahí solo se exige que haya foto.
     * sin-dato-con-dato-publicado   «sin dato de M para X» (o «la foto no trae M de X») cuando el Core publica M para X: un «sin dato» nunca acompaña a una cifra que el dato publica. */
    const ejesDeEntidad = (n) => { if (/\s[−-]\s/.test(String(n))) return []; const out = []; for (const e of esq.EJES) { let c = null; try { c = base.entityIndex.resolveCanonical(e, n); } catch { c = null; } if (c) out.push(e); } return out; };
    const ejeDeParte = (p) => p.eje || (esq.sujetoDeTema ? esq.sujetoDeTema(p.tema) : null) || "cliente";
    const ejePorParte = new Map(partes.map((p) => [p.id, ejeDeParte(p)]));
    for (const p of partes) {
      if (!["cifra", "lectura", "decision"].includes(p.cierre)) continue;
      if (Array.isArray(p.entidades) && p.entidades.length) continue;   /* las entidades que la parte NOMBRA se sirven con el productor de cada una, de su propio eje (46b: una cifra con entidades de dos ejes) */
      const vistas = new Set();
      for (const u of entrega.universos || []) {
        const idsP = String(u.id || "").split("_").filter((x) => /^p\d+$/.test(x));
        if (!idsP.includes(p.id)) continue;
        const admitidos = new Set(idsP.map((pid) => ejePorParte.get(pid)).filter(Boolean));
        for (const n of u.entidades || []) {
          const es = ejesDeEntidad(n);
          if (es.length && !es.some((e) => admitidos.has(e)) && !vistas.has(`${n}`)) { vistas.add(`${n}`); v("eje-servido", `${p.id} (${p.cierre}, eje ${ejeDeParte(p)}) sirve «${n}», que es de ${es.join("/")} (universo «${u.id}»)`); }
        }
      }
    }
    for (const p of partes) {
      if (!["lectura", "decision"].includes(p.cierre)) continue;
      if ((Array.isArray(p.entidades) && p.entidades.length) || esq.universoTieneRestriccionPropia(p.universo)) continue;
      const conceptos = Array.isArray(p.conceptos) ? p.conceptos : [];
      if (!conceptos.length) continue;
      const eje = ejeDeParte(p);
      if (!conceptos.some((c) => publicadoPorElCore(eje, c) || (R[eje] && R[eje][_CLAVE_DE_RANKING(eje, c, p.tema)]))) continue;   /* el dato no publica ninguno de sus conceptos en ese eje: no hay foto que exigir */
      const u = (entrega.universos || []).find((x) => x.id === p.id && !x.soloRanking);
      if (!u || !(u.entidades || []).length) { v("foto-sin-servir", `${p.id} (${p.cierre} de ${p.tema} por ${eje}, sin universo ni entidades) pide ${conceptos.join(", ")} y la Entrega no sirve su foto (ningún universo «${p.id}»)`); continue; }
      if (p.tema !== "cobranza") {
        let todos = []; try { todos = base.entityIndex.axisEntityNames(eje) || []; } catch { todos = []; }
        const dichas = new Set((u.entidades || []).map(_norm));
        const faltan = todos.filter((n) => !dichas.has(_norm(n)));
        if (faltan.length) v("foto-incompleta", `${p.id} (${p.tema} por ${eje}, sin universo) sirve ${(u.entidades || []).length} de ${todos.length}: faltan ${faltan.slice(0, 6).join(", ")}`);
      }
    }
    /* foto-ordenada-por-otro-concepto: la lista de la foto se ordena por el PRIMER concepto pedido que su productor publica y la cabeza lo dice «ordenado por M: …» (51a) */
    for (const p of partes) {
      if (!["lectura", "decision"].includes(p.cierre) || p.tema === "cobranza") continue;   /* en cobranza la foto va en el orden de la mesa (52c) */
      if ((Array.isArray(p.entidades) && p.entidades.length) || esq.universoTieneRestriccionPropia(p.universo)) continue;
      if (partes.filter((q) => ['cifra', 'lectura', 'decision'].includes(q.cierre) && q.tema === p.tema && ejeDeParte(q) === ejeDeParte(p)).length > 1) continue;   /* otra parte del mismo dominio y eje: la oración no se puede atribuir a una sola */
      const eje = ejeDeParte(p), conceptos = Array.isArray(p.conceptos) ? p.conceptos : [];
      const u = (entrega.universos || []).find((x) => x.id === p.id && !x.soloRanking);
      if (!u || !(u.entidades || []).length) continue;
      const suyas = new Set((u.entidades || []).map(_norm));
      for (const t of textos) {
        const m = /^Por .*?ordenado por ([^:]+): (.+)$/.exec(t);
        if (!m) continue;
        const nombresDichos = [...suyas].filter((n) => _norm(m[2]).includes(n));
        if (!nombresDichos.length || nombresDichos.length < Math.min(2, suyas.size)) continue;   /* la oración de otra parte u otra lista */
        const dicho = claveDeRotulo(m[1].trim());
        const dom = dicho ? lex.dominioDeClave(dicho) : null;
        if (!dicho || (dom && dom !== p.tema)) continue;   /* una oración de otra parte (otro dominio) sobre las mismas entidades */
        if (dicho !== "participacion" && !conceptos.includes(dicho)) continue;   /* una lista de otro concepto que la parte no pidió (los días sin venta de «frenado» sin umbral, la medida de una lente): no es la foto de esta parte */
        /* el primer concepto pedido que la Entrega sirve (una fila de alguna entidad de la foto): la lista se ordena por ese; «participación» es derivada de lo que se sirva */
        const servido = (c) => celdas.some((x) => suyas.has(_norm(x.ent)) && claveDeRotulo(x.met) === c);
        const esperado = conceptos.filter((c) => c !== "participacion").find(servido) || conceptos[0];
        if (dicho !== esperado && dicho !== "participacion") v("foto-ordenada-por-otro-concepto", `${p.id} (${p.tema} por ${eje}) pidió ${conceptos.join(", ")}: la foto debe ordenarse por «${nombreDe(esperado)}» y la cabeza dice «ordenado por ${m[1].trim()}»`);
      }
    }
    /* ── PARTE B (segunda vuelta · owner 2026-10-01): tres reglas de presentación (FIRMES: el owner aprobó el cambio de ~120 textos) ────────────────────────────────────────
     * foto-cobranza-fuera-del-orden-de-la-mesa   la foto de una lectura o decision de cobranza son las cuentas de la mesa EN EL ORDEN DE LA MESA (52c, owner): el universo que la Entrega declara para la parte las trae en otro orden (el de «Abonado»,
     *                                            el de «Saldo pendiente»…). El orden de la mesa lo da la mesa de flujo (`base.ordenDeLaMesa`: la misma que la pestaña Flujo Comercial), no una pieza de la Entrega.
     * empate-del-filo-en-cero-sin-palabras       el empate del filo cuya cifra es 0 dice el cero en palabras de negocio junto a su cifra («no tienen días sin venta (0 días)»), no «(0 días)» a secas (39c · 46f).
     * ausencia-sin-la-forma-sin-dato             la Entrega declara que falta la cifra de X para Y («la foto no trae…», «no trae «X» de Y») y el dato de verdad no la publica, pero ninguna oración dice «sin dato de X para Y» (52b: la ÚNICA forma). */
    for (const p of partes) {
      if (!["lectura", "decision"].includes(p.cierre) || p.tema !== "cobranza") continue;
      if ((Array.isArray(p.entidades) && p.entidades.length) || esq.universoTieneRestriccionPropia(p.universo)) continue;
      const u = (entrega.universos || []).find((x) => x.id === p.id && !x.soloRanking);
      const mesa = typeof base.ordenDeLaMesa === "function" ? base.ordenDeLaMesa() : [];
      if (!u || !(u.entidades || []).length || !mesa.length) continue;
      const servidas = (u.entidades || []).map(_norm);
      const esperado = mesa.map(_norm).filter((n) => servidas.includes(n));
      const dicho = servidas.filter((n) => esperado.includes(n));
      if (JSON.stringify(dicho) !== JSON.stringify(esperado)) v("foto-cobranza-fuera-del-orden-de-la-mesa", `${p.id} (cobranza, foto): las cuentas van ${(u.entidades || []).slice(0, 4).join(", ")}… y el orden de la mesa es ${mesa.filter((n) => servidas.includes(_norm(n))).slice(0, 4).join(", ")}…`);
    }
    for (const t of textos) {
      const mE = /que sirve \d+ por el empate del filo \((.+?) empatan? en el puesto \d+\)/.exec(t);
      const mO = /ordenado por ([^:]+): /.exec(t);
      if (!mE || !mO) continue;
      const clave = claveDeRotulo(mO[1].trim());
      const unidad = clave ? (lex.metricaPorClave(clave) || {}).unidad : null;
      if (!clave || !(lex.UNIDADES_DE_CANTIDAD || ["money", "days", "count"]).includes(unidad)) continue;
      const primero = mE[1].split(/, | y /).map((s) => s.trim()).filter(Boolean)[0];
      const fila = celdas.find((c) => _norm(c.ent) === _norm(primero) && claveDeRotulo(c.met) === clave);
      if (fila && _esCeroImpreso(fila.val) && !/\bno tienen?\b|vendieron? al corte/i.test(t)) v("empate-del-filo-en-cero-sin-palabras", `el empate del filo en ${fila.val} de «${mO[1].trim()}» no dice el cero en palabras: «${t.slice(0, 150)}»`);
    }
    { /* la ausencia declarada con otras palabras sin la forma «sin dato de X para Y» */
      const sinDatoDichos = [...limites.map((l) => String(l.titulo || "")), ...textos].flatMap((s) => { const out = []; const re = /sin dato de (.+?) para (.+?)(?:\.| \(|;|$)/g; let m; while ((m = re.exec(s))) out.push({ clave: claveDeRotulo(m[1].trim()), nombres: m[2].split(/, | y /).map((x) => _norm(x.trim())) }); return out; });
      const ausencias = [];
      for (const l of limites) { const m = /la foto no trae (.+?) de (.+?) \(\d+ de /.exec(String(l.titulo || "")); if (m) ausencias.push({ clave: claveDeRotulo(m[1].trim()), nombres: m[2].split(/, | y /).map((s) => s.trim()).filter(Boolean), donde: String(l.titulo).slice(0, 100) }); }
      for (const s of [...limites.map((l) => `${l.titulo || ""} ${l.motivo || ""}`), ...textos]) { const m = /no trae «([^»]+)» de ([^.;]+?)(?:\.|;|$)/.exec(s); if (m) ausencias.push({ clave: claveDeRotulo(m[1].trim()), nombres: m[2].split(/, | y /).map((x) => x.trim()).filter(Boolean), donde: s.slice(0, 100) }); }
      for (const a of ausencias) {
        if (!a.clave) continue;
        for (const n of a.nombres) {
          const real = ejesDeEntidad(n).some((e) => rankingPublicado(e, a.clave, null) && !filaDelRanking(e, a.clave, n, null) && !coberturaDeLaMetrica(a.clave, e));
          if (real && !sinDatoDichos.some((d) => d.clave === a.clave && d.nombres.includes(_norm(n)))) v("ausencia-sin-la-forma-sin-dato", `«${a.donde}»: «${n}» no tiene dato de «${nombreDe(a.clave)}» y la Entrega no dice «sin dato de ${nombreDe(a.clave).toLowerCase()} para ${n}»`);
        }
      }
    }
    for (const l of limites) {
      const titulo = String(l.titulo || "");
      let m, nombres = [], clave = null;
      if ((m = /sin dato de (.+?) para (.+?)(?:\.| \(|$)/.exec(titulo))) { clave = claveDeRotulo(m[1].trim()); nombres = m[2].split(/, | y /).map((s) => s.trim()).filter(Boolean); }
      else if ((m = /la foto no trae (.+?) de (.+?) \(\d+ de /.exec(titulo))) { clave = claveDeRotulo(m[1].trim()); nombres = m[2].split(/, | y /).map((s) => s.trim()).filter(Boolean); }
      if (!clave) continue;
      for (const n of nombres) { const es = ejesDeEntidad(n); const pub = es.map((e) => ({ e, p: publicadoPorElCore(e, clave) })).find((x) => x.p && x.p.has(_norm(n))); if (pub) v("sin-dato-con-dato-publicado", `«${titulo.slice(0, 110)}»: el dato publica ${nombreDe(clave)} de ${n} (${pub.p.get(_norm(n))}) en ${pub.e}`); }
    }

    /* ── lo anunciado en la cabeza: «ordenado por M: A (v), B (v)» ──────────────────────────────────────────────────── */
    for (const t of textos) {
      const m = /ordenado por ([^:]+?): (.+?)\.?$/.exec(t);
      if (!m) continue;
      const clave = lex.claveExactaDeMetrica(m[1].trim()) || lex.claveDeMetrica(m[1].trim());
      if (!clave) continue;
      const lista = m[2];
      const miembros = new Set(); for (const u of entrega.universos || []) for (const n of u.entidades || []) miembros.add(n);
      for (const n of miembros) {
        if (!new RegExp(`(?:^|[ ,])${_esc(n)}(?: \\(|,|$)`).test(lista)) continue;
        if (hayFila(n, clave) || declarado(n, clave)) continue;
        v("anunciada-sin-fila", `la cabeza anuncia «${n}» ordenada por «${m[1].trim()}» y no hay fila de esa métrica para ella ni se declara`);
      }
    }

    /* ── ningún límite niega una cifra que la Entrega imprime ────────────────────────────────────────────────────── */
    const impresaDe = (ent) => {
      if (filasDe(ent).length) return `su fila ${JSON.stringify(filasDe(ent)[0].val)}`;
      const re = new RegExp(`${_esc(ent)}(?::|, con| \\()[^.;]{0,80}\\d`);
      const o = textos.find((t) => re.test(t) && !/^Sobre la premisa planteada/.test("") );
      return o ? `la oración «${o.slice(0, 80)}»` : null;
    };
    for (const l of limites) {
      const titulo = String(l.titulo || ""), t = `${titulo} ${l.motivo || ""}`;
      let m;
      if ((m = /no se pudo servir la cifra de (.+?)(?:\.|$)/.exec(titulo))) { const dicho = impresaDe(m[1].trim()); if (dicho) v("limite-niega-lo-impreso", `«${titulo.slice(0, 120)}» y la Entrega imprime ${dicho}`); }
      if ((m = /sin dato de (.+?) para (.+?)(?:\.| \(|$)/.exec(titulo))) { const clave = claveDeRotulo(m[1].trim()); const ent = m[2].trim(); if (clave && hayFila(ent, clave)) v("sin-dato-como-numero", `«${titulo.slice(0, 120)}» y la Entrega imprime una fila de esa métrica para ${ent}`); }
      if ((m = /la foto no trae (.+?) de (.+?) \(\d+ de /.exec(titulo))) {
        const clave = claveDeRotulo(m[1].trim());
        for (const n of m[2].split(/, | y /).map((s) => s.trim()).filter(Boolean)) if (clave && hayFila(n, clave)) v("limite-niega-lo-impreso", `la foto declara que falta «${m[1]}» de «${n}» y la Entrega imprime su fila`);
      }
      void t;
    }

    /* ── el cero solo si el dato lo demuestra · «sin dato» nunca es un número ───────────────────────────────────────── */
    const ejeDeFila = (ent, tema) => { for (const { p, cola } of servidasPorParte) { const s = cola.find((x) => _norm(x.n) === _norm(ent)); if (s) return { eje: s.eje, tema: p.tema }; } for (const eje of Object.keys(R)) if (esDelEje(eje, ent)) return { eje, tema }; return null; };
    for (const c of celdas) {
      if (/NaN|undefined|null|Infinity/i.test(String(c.val))) { v("sin-dato-como-numero", `la fila «${c.ent} · ${c.met}» imprime «${c.val}»`); continue; }
      /* un cero que la Entrega dice de COBERTURA DECLARADA: la fuente tiene que declarar cubrir al grupo y la entidad ser del grupo sin figurar en la métrica (52b) */
      if (/^cobertura declarada/i.test(String(c.tipo || "").trim()) && !/\s[−-]\s|^Total\b/.test(String(c.ent))) {
        const cl = claveDeRotulo(c.met), w = ejeDeFila(c.ent, c.fila && c.fila.valores && c.fila.valores.Tema);
        if (cl && w && origenEnElDato(w.eje, cl, c.ent, (c.fila.valores && c.fila.valores.Tema) || w.tema) !== "cobertura") v("cero-sin-origen", `«${c.ent} · ${c.met}» se dice de cobertura declarada y ninguna fuente declara cubrir a esa entidad en esa métrica (o la fuente sí trae su fila)`);
        if (!_esCeroImpreso(c.val)) v("cero-sin-origen", `«${c.ent} · ${c.met}» se dice de cobertura declarada pero no imprime un cero (${c.val})`);
        continue;
      }
      if (!/^medido$/i.test(String(c.tipo || "").trim()) || /\s[−-]\s|^Total\b/.test(String(c.ent))) continue;   // solo las cifras medidas de UNA entidad (no derivadas, diferencias ni totales)
      const clave = claveDeRotulo(c.met); if (!clave) continue;
      const un = (lex.metricaPorClave(clave) || {}).unidad;
      const where = ejeDeFila(c.ent, c.fila && c.fila.valores && c.fila.valores.Tema);
      const tema = (c.fila && c.fila.valores && c.fila.valores.Tema) || (where && where.tema) || null;
      if (_esCeroImpreso(c.val) && where) {
        const origen = origenEnElDato(where.eje, clave, c.ent, tema);
        /* el dato publica un ranking para esa métrica en el eje: el cero tiene que ser la fila (medido) o cobertura declarada; sin ranking el control no tiene contra qué mirar el cero (no se exige) */
        if (rankingPublicado(where.eje, clave, tema) && !origen) v("cero-sin-origen", `«${c.ent} · ${c.met}» imprime ${c.val} y el dato no trae su fila ni una fuente declara cubrir al grupo`);
        else if (origen === "medido" && filaDelRanking(where.eje, clave, c.ent, tema).valor !== 0 && un !== "pct") v("cero-sin-origen", `«${c.ent} · ${c.met}» imprime ${c.val} y la fila del dato dice ${filaDelRanking(where.eje, clave, c.ent, tema).valor}`);
      }
      /* una tasa sin denominador nunca es 0 % */
      if (un === "pct" && _esCeroImpreso(c.val) && where && DENOMINADOR[clave]) {
        const d = filaDelRanking(where.eje, DENOMINADOR[clave], c.ent, tema);
        if (!d || !(d.valor > 0)) v("tasa-sin-denominador-como-cero", `«${c.ent} · ${c.met}» imprime ${c.val} y su denominador («${nombreDe(DENOMINADOR[clave])}») ${d ? "vale 0" : "no figura en el dato"}`);
      }
    }
    void COBERTURA_DE_FUENTES; void _numDe;
    return vs;
  },
};
