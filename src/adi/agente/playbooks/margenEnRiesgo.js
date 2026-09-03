/* === src/adi/agente/playbooks/margenEnRiesgo.js · PLAYBOOK 1 · MARGEN EN RIESGO (§11 del F1) =================
 *
 * QUÉ RESUELVE, con los casos del expediente (`_AGENTE_PUNTO_DE_PARTIDA.md`): T6 «cómo viene mi margen» salió
 * como `limite` con UNA cifra suelta («Medida · cerrar brecha al piso = $4.9M») teniendo la cartera entera en
 * la mano; el corpus tiene el mismo hueco en «qué clientes están bajo el benchmark» y «a quién reviso primero».
 * El procedimiento junta la evidencia ANTES de que exista la opción de rescatar.
 *
 * EL MÉTODO (los pasos son del playbook, no del ánimo del cerebro):
 *   1 · marginRead{focus:"bajo_benchmark", dimension:"cliente"} — quiénes están bajo la vara, con su margen y
 *       su venta, el benchmark DECLARADO del negocio, el margen promedio y el conteo.
 *   2 · diagnose{} — cuánta contribución no se captura, por cliente y en total, y dónde localiza el motor el
 *       exceso de carga comercial. Es lo que permite decir «a quién primero y con cuánto en juego» sin inventar
 *       una prioridad: el orden sale de una cifra verificada.
 *
 * LO QUE NO HACE: explicar POR QUÉ un cliente cede margen. El dato LOCALIZA (dónde está el exceso, cuánto es);
 * la causa raíz necesita evidencia que este dato no trae. Su lista notarial veta cruzar esa línea.
 *
 * PURO · determinístico · sin red. Cifras VERBATIM de la boleta: este módulo selecciona y ordena, jamás calcula. */

const _num = (f) => (f && Number.isFinite(f.raw) ? f.raw : NaN);
/* ⚠️ EL MOTOR SOLO PONE `raw` EN LAS FILAS DESTACADAS (medido: de los 13 clientes con margen, 5 traen `raw` y
 * 8 traen solo su valor de pantalla «26.5%»). Para SELECCIONAR quién está bajo la vara hace falta el número de
 * las trece, así que el porcentaje se lee de la cifra que el motor YA publicó. Eso no es recalcular: la cifra
 * que se cita sigue siendo la suya, verbatim; leerla para compararla es lo mismo que ordenarla. Y el candado
 * está puesto donde importa — la selección se AUTO-VERIFICA contra el conteo que el propio motor declara
 * («clientes bajo el benchmark»): si no coincide exactamente, el playbook no sirve la lista. */
const _pct = (f) => {
  const r = _num(f);
  if (Number.isFinite(r)) return r;
  const m = /^-?[\d.,]+\s*%$/.exec(String((f && (f.text || f.value)) || "").trim());
  return m ? parseFloat(m[0].replace("%", "").replace(",", ".")) : NaN;
};
const _val = (f) => String((f && (f.text || f.value)) || "");
const _lab = (f) => String((f && f.label) || "");
const _find = (figs, re) => (Array.isArray(figs) ? figs : []).find((f) => re.test(_lab(f))) || null;
const _all = (figs, re) => (Array.isArray(figs) ? figs : []).filter((f) => re.test(_lab(f)));
const _esc = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const _re = (t) => new RegExp(`\\b${_esc(t)}\\b`, "i");

/* la entidad de un label «Entidad · Concepto» — la MISMA convención de la boleta, no un parser nuevo. */
const _entidadDe = (label) => {
  const p = String(label || "").split("·").map((s) => s.trim());
  return p.length >= 2 ? p[0] : null;
};

/** lo que el playbook lee de la boleta, una sola vez y para todos sus usos (composer y lista notarial). */
export function lecturaDeMargen(figs) {
  const bench = _find(figs, /^Benchmark de margen$/i);
  const conteo = _find(figs, /clientes bajo el benchmark/i);
  const promedio = _find(figs, /^Margen promedio$/i);
  const brechaNegocio = _find(figs, /^El negocio · Brecha al benchmark$/i);   // sellada (2026-09-03): la MISMA cifra de la card de la Mesa
  const totalJuego = _find(figs, /^Contribuci[oó]n no capturada · subtotal$/i);
  const cargaTotal = _find(figs, /^Carga comercial alta · subtotal$/i);

  const margenes = _all(figs, /· Margen$/i).map((f) => ({ entidad: _entidadDe(_lab(f)), pct: _pct(f), fmt: _val(f) }))
    .filter((x) => x.entidad && Number.isFinite(x.pct));
  const ventas = new Map(_all(figs, /· Venta$/i).map((f) => [_entidadDe(_lab(f)), _val(f)]));
  const juego = _all(figs, /· Contribuci[oó]n no capturada$/i)
    .map((f) => ({ entidad: _entidadDe(_lab(f)), usd: _num(f), fmt: _val(f) }))
    .filter((x) => x.entidad && Number.isFinite(x.usd))
    .sort((a, b) => b.usd - a.usd);
  const carga = _all(figs, /· Carga comercial alta$/i)
    .map((f) => ({ entidad: _entidadDe(_lab(f)), fmt: _val(f), usd: _num(f) }))
    .filter((x) => x.entidad && Number.isFinite(x.usd))
    .sort((a, b) => b.usd - a.usd);

  const benchPct = bench ? _pct(bench) : NaN;
  const bajo = Number.isFinite(benchPct) ? margenes.filter((m) => m.pct < benchPct).sort((a, b) => a.pct - b.pct) : [];
  return { bench, benchPct, conteo, promedio, brechaNegocio, totalJuego, cargaTotal, margenes, ventas, juego, carga, bajo };
}

/* ── EL DETECTOR · determinístico y ANGOSTO ────────────────────────────────────────────────────────────────────
 * Dos condiciones a la vez: el turno habla de MARGEN (o de la vara), y pide una LECTURA de ese margen — cómo
 * viene, quiénes están bajo, a quién priorizar, cuánto falta. Sin las dos, este playbook no se activa: un
 * playbook que secuestra turnos ajenos es peor que no tenerlo. «Simula/proyecta» queda AFUERA a propósito: esa
 * ruta es de simulación (la letra de RUTEO ya la manda ahí) y el playbook no la pisa. */
/* ⚠️ EL FIN DE PALABRA CUANDO LA PALABRA TERMINA EN ACENTO — la trampa que cazó el barrido de
 * `_agente_contrato_gate` §5g, y acá había TRES casos vivos: `\b` se define sobre [A-Za-z0-9_], así que
 * `qu[eé]\b` NO veía «qué» (con tilde, que es como se escribe), `supon(?:e|é)\b` NO veía «suponé» y
 * `la causa (?:es|está)\b` NO veía «está». `_FIN` es el cierre que sí cuenta vocales acentuadas y ñ. */
const _FIN = "(?![a-záéíóúüñ])";
const _TEMA_MARGEN = /\bm[aá]rgen(?:es)?\b|\bbenchmark\b|\bvara\b|\brentabilidad\b/i;
const _PIDE_LECTURA = new RegExp(`\\bc[oó]mo${_FIN}|\\bqu[eé]${_FIN}|\\bqui[eé]n(?:es)?${_FIN}|\\bcu[aá]l(?:es)?${_FIN}|\\bcu[aá]nto${_FIN}|\\bd[oó]nde${_FIN}|\\bprioriza|\\bprioridad\\b|\\bprimero\\b|\\brevis|\\bmejor(?:ar|a)\\b|\\bbajo\\b|\\bdebajo\\b|\\briesgo\\b|\\bdame\\b|\\bmu[eé]stra|\\blista\\b|\\branking\\b`, "i");
/* ⚠️ LO QUE QUEDA AFUERA, Y POR QUÉ (calibrado contra el corpus de exámenes, cero gasto — cazó tres casos):
 *   · simulación/proyección — esa ruta es de simulateGeneral y la letra de RUTEO ya la manda ahí;
 *   · OTRO EJE — este playbook lee el margen POR CLIENTE. «Ranking de SKU por peor rotación cruzado con
 *     margen» (examen 2 t4) y «ranking de puntos de venta» (examen 3 t4) NO son suyos: activarse ahí cargaba
 *     la cartera de clientes para responder de inventario, y su lista notarial juzgaba texto de otro dominio;
 *   · OTRO PERÍODO — «compara Q1 vs Q2 en ventas, margen y contribución» (examen 3 t1) es una pregunta de
 *     corte temporal; el dato no lo sostiene y el camino honesto es declinar, no traer la foto anual.
 * Un playbook que se activa de más es peor que no tenerlo: secuestra el turno Y le aplica promesas ajenas. */
const _FUERA = new RegExp(`\\bsimul|\\bproyect|\\bqu[eé] pasa si\\b|\\bpon[eé]le que\\b|\\bsupon(?:e|é|gamos)${_FIN}|\\bsku\\b|\\bproducto`, "i");
/* el eje de ESTE playbook es CLIENTE. Cualquier otro eje nombrado lo deja afuera — incluido el que el dato no
 * tiene: «ranking de puntos de venta… no mezcles clientes con puntos de venta» (examen 3 t4) se responde
 * declinando que ese eje no existe, y un playbook de clientes ahí es exactamente la mezcla que el usuario pidió
 * evitar. Equivocarse hacia AFUERA es barato: el turno sigue por el camino de siempre. */
const _OTRO_EJE = /\brotaci[oó]n\b|\binventario\b|\bstock\b|\bbodega|\bpunto[s]? de venta\b|\bsucursal|\btienda|\bcanal(?:es)?\b|\bfamilia|\bmarca[s]?\b|\bcategor[ií]a/i;
/* ⚠️ `\b[uú]ltimo mes` ES EL `\b` IMPOSIBLE EN ESPEJO (cazado 2026-09-01 midiendo el agente entero: un solo
 * sitio, éste). `\b` se define sobre [A-Za-z0-9_]; entre el espacio y la «ú» de «el último» no hay frontera,
 * así que la alternativa acentuada jamás matcheaba: /\b[uú]ltimo mes\b/.test("el último mes") === false. Media
 * ciega: cazaba «ultimo» y no «último». Sin daño visible porque el bucle resuelve entidad×período ANTES de los
 * playbooks — pero un candado que solo funciona con la ortografía equivocada es un adorno. Sin `\b` delante;
 * la frontera de atrás con `_FIN`, como el resto del archivo. */
const _OTRO_PERIODO = new RegExp(`\\bq[1-4]\\b|\\btrimestr|\\bmensual\\b|\\bmes a mes\\b|[uú]ltimo mes${_FIN}|\\bsemestr`, "i");

export const margenEnRiesgo = {
  nombre: "margen-en-riesgo",

  cuandoAplica(pregunta) {
    const q = String(pregunta || "");
    if (_FUERA.test(q) || _OTRO_EJE.test(q) || _OTRO_PERIODO.test(q)) return false;
    return _TEMA_MARGEN.test(q) && _PIDE_LECTURA.test(q);
  },

  pasos: [
    { tool: "marginRead", args: { focus: "bajo_benchmark", dimension: "cliente" },
      para: "quiénes están bajo el benchmark, con su margen y su venta, más el benchmark declarado, el margen promedio y el conteo" },
    { tool: "diagnose", args: {},
      para: "cuánta contribución no se captura —por cliente y en total— y dónde localiza el motor el exceso de carga comercial" },
  ],

  /* las figs que este playbook PROMETE. Si el dato de un tenant no las sostiene, el playbook no promete nada y
   * se retira: sin vara declarada o sin conteo, «quiénes están bajo el benchmark» no tiene respuesta honesta. */
  obligatorias: [/^Benchmark de margen$/i, /clientes bajo el benchmark/i],

  entregable: "qué clientes están bajo el benchmark (con su margen y su venta), cuánta contribución no se captura —total y por cliente— y a quién conviene revisar primero, con su cifra. Las acciones se OFRECEN para que el usuario las evalúe; jamás se ordenan.",

  /* ── EL ENTREGABLE DETERMINÍSTICO · el peldaño que responde cuando el cerebro no pudo ────────────────────────
   * Cifras VERBATIM de la boleta. Una línea por cliente A PROPÓSITO: apilar varias cifras en una sola oración
   * es lo que expuso al rescate al veto de atribución (P1a de la corrida 2) — cada cifra viaja con su dueño en
   * su propia oración. Se AUTO-VERIFICA contra el conteo del motor: si la lista que arma no reconcilia con
   * «clientes bajo el benchmark», no sirve nada y cede al peldaño siguiente.
   *
   * LA VOZ (owner 2026-09-03, «la voz humana en los textos determinísticos»): escribe como un asesor, no como
   * un ledger — sin perder un byte de garantía. Las mismas cifras con los mismos dueños, PERO además cumpliendo
   * los candados que este mismo frente estrenó: la brecha del negocio sale de la fig SELLADA («El negocio ·
   * Brecha al benchmark» — la cifra de la card) y solo si la boleta la trae; «margen promedio» y «benchmark»
   * se nombran con su palabra al lado de su % (las anclas léxicas del humo); el recorte se declara («3 de los
   * 8»); la prioridad nombra su criterio. Cercanía sí, adulación no: si el margen viene mal, se dice derecho. */
  componer({ figs } = {}) {
    const L = lecturaDeMargen(figs);
    if (!L.bench || !L.conteo || !L.bajo.length) return null;
    const nDeclarado = _num(L.conteo);
    if (!Number.isFinite(nDeclarado) || L.bajo.length !== nDeclarado) return null;   // la selección no reconcilia: no se sirve

    const top = L.juego.slice(0, 3);
    const partes = [];
    const abre = L.promedio
      ? (L.brechaNegocio
        ? `Tu margen promedio viene en ${_val(L.promedio)} — ${_val(L.brechaNegocio)} bajo el benchmark que declaraste (${_val(L.bench)}).`
        : `Tu margen promedio viene en ${_val(L.promedio)}, contra el benchmark de ${_val(L.bench)} que declaraste.`)
      : `Tu benchmark declarado es ${_val(L.bench)}.`;
    partes.push(`${abre} ${_val(L.conteo)} de tus clientes están bajo esa referencia.`);

    if (top.length) {
      partes.push(`\nDonde más contribución dejas sin capturar — los ${top.length} de los ${_val(L.conteo)} que más pesan:`);
      for (const t of top) {
        const m = L.bajo.find((b) => b.entidad === t.entidad);
        const venta = L.ventas.get(t.entidad);
        partes.push(`- ${t.entidad} · deja ${t.fmt} sin capturar${m ? ` · margen ${m.fmt}` : ""}${venta ? ` · venta ${venta}` : ""}`);
      }
    }
    // «En total: …» moría en el muro, Y CON RAZÓN: la fig es el SUBTOTAL de los focos del detector, no el
    // total del universo — la voz lo atribuye a su dueño (el motor) en vez de totalizarlo.
    if (L.totalJuego) partes.push(`\nLa contribución sin capturar que el motor detecta suma ${_val(L.totalJuego)}.`);
    if (L.cargaTotal) {
      const c0 = L.carga[0];
      partes.push(`Dónde lo localiza el motor: carga comercial alta por ${_val(L.cargaTotal)}${c0 ? ` — la más pesada es la de ${c0.entidad} (${c0.fmt})` : ""}.`);
    }
    if (top.length) partes.push(`\n¿Lo abrimos por ${top[0].entidad}? Es donde hay más contribución en juego.`);
    return partes.join("\n");
  },

  /* ── LA LISTA NOTARIAL DEL PLAYBOOK · chequeos MECÁNICOS de SUS promesas ─────────────────────────────────────
   * Se SUMA al muro (guardC intacto) y solo corre cuando el playbook está activo y trajo sus obligatorias.
   * El notario crece por REGLAS, nunca por comprensión: cada una compara texto contra la boleta. */
  listaNotarial(texto, { figs } = {}) {
    const t = String(texto || "");
    if (!t.trim()) return [];
    const L = lecturaDeMargen(figs);
    const v = [];

    /* 1 · LA CONDUCTA DEL OWNER, hecha regla: con la evidencia en la mano, no se pide aclaración ni se declina.
     * Se dispara solo si el texto NO trae ninguna de las cifras del playbook Y encima pide definir o declina. */
    const cifrasClave = [L.bench, L.conteo, L.promedio, L.totalJuego].filter(Boolean).map((f) => _val(f));
    const citaAlguna = cifrasClave.some((c) => c && t.includes(c));
    /* «pedir que el usuario defina» = una pregunta de ELECCIÓN antes de responder. Se busca el interrogativo
     * DENTRO de la pregunta (no pegado al «¿»): en la corrida 3 el turno decía «¿Sobre cuál entidad…?» y un
     * patrón anclado al signo lo dejaba pasar. El cierre-oferta del contrato F3 («¿lo vemos por ahí?»,
     * «¿arrancamos?») NO trae interrogativo de elección y sigue siendo legítimo — como debe ser. */
    const pideDefinir = /¿[^?]{0,90}\b(?:cu[aá]l(?:es)?|qu[eé]|qui[eé]n(?:es)?)\b[^?]*\?|necesito que me digas|dime (?:si|cu[aá]l|qu[eé])|aclar[ae]mos|clarifiquemos/i.test(t);
    const declina = /\bno (?:pude|puedo|tengo|dispongo)\b/i.test(t);
    if (!citaAlguna && (pideDefinir || declina)) {
      v.push({ regla: "evidencia-sin-usar",
        multa: "el procedimiento ya trajo la evidencia de este turno (benchmark, cuántos clientes están bajo la vara y cuánta contribución no se captura) y tu respuesta no la usa: responde con esas cifras antes de pedir una aclaración o declinar." });
    }

    /* 2 · La lista enumerada tiene que declarar su corte: nombrar 2+ de los que están bajo la vara sin decir
     * «N de M» es un top-N presentado como si fuera todo (la regla de la casa sobre top-N).
     * ACOTADA AL ROL (calibración): solo cuando el texto los presenta COMO la lista de bajo-la-vara. Nombrar a
     * dos clientes al pasar —«Lider está en 21.5% y Jumbo en 24.0%, entre los tres grandes» (examen 4 t2)— no
     * es presentar una lista recortada, y multarlo sería vetar prosa legítima que ya salió a pantalla. */
    const _ROL_BAJO = /bajo (?:el|la) (?:benchmark|vara|referencia)|por debajo (?:del|de la)|bajo la referencia|no (?:llegan|alcanzan) (?:al|a la)/i;
    const nombradosBajo = L.bajo.filter((b) => _re(b.entidad).test(t)).length;
    const declaraCorte = new RegExp(`\\bde (?:los |las )?${L.bajo.length}\\b|\\bde un total\\b|\\btop\\s*\\d|\\bprimeros\\b|\\blos ${L.bajo.length}\\b|\\bentre los\\b|\\blos (?:dos|tres|cuatro|cinco) (?:m[aá]s|grandes|primeros|mayores)\\b`, "i").test(t);
    if (_ROL_BAJO.test(t) && L.bajo.length > 3 && nombradosBajo >= 2 && nombradosBajo < L.bajo.length && !declaraCorte) {
      v.push({ regla: "lista-sin-corte",
        multa: `nombras ${nombradosBajo} de los ${L.bajo.length} clientes bajo el benchmark sin declarar que es un recorte: di «${nombradosBajo} de ${L.bajo.length}» o nómbralos a todos.` });
    }

    /* 3 · EL ORDEN DECLARADO TIENE QUE SER EL APLICADO. La promesa NO es «mi métrica es la única»: es que la
     * prioridad no salga de la nada. Si el texto DECLARA su criterio con su cifra —«empieza por Lider: cerrar
     * sus 3.6pp suma $641K, el mayor impacto en $ de los cinco» (examen 1 t3, aceptado)— eso es exactamente
     * la promesa cumplida, aunque ordene por otra métrica que la del playbook. La multa es para la prioridad
     * MUDA: proponer a alguien que no es el mayor por la cifra del procedimiento y no decir por qué. */
    const mPrim = /(?:empiez[oa]|empez[aá]|empezar[ií]a|arranco|arrancar[ií]a|primero|prioridad|priorizar[ií]a)\s+(?:por|con|es|:)?\s*([A-ZÁÉÍÓÚÑ][\wÁÉÍÓÚÑáéíóúñ .'-]{2,30})/i.exec(t);
    if (mPrim && L.juego.length) {
      const propuesto = L.juego.find((j) => _re(j.entidad).test(mPrim[1]));
      const citados = L.juego.filter((j) => _re(j.entidad).test(t));
      const declaraCriterio = /\bel (?:mayor|m[aá]s alto|de mayor)\b|\bmayor impacto\b|\bel que m[aá]s\b|\bpor(?:que)? (?:tiene|es) el\b|\bcriterio\b|\bordenad[oa] por\b|\bpor su\b/i.test(t);
      if (propuesto && citados.length > 1 && citados[0].entidad !== propuesto.entidad && !declaraCriterio) {
        v.push({ regla: "orden-no-aplicado",
          multa: `propones empezar por ${propuesto.entidad}, pero entre los que nombras el de mayor contribución no capturada es ${citados[0].entidad} (${citados[0].fmt}): ordena por la cifra o di con qué criterio priorizas.` });
      }
    }

    /* 4 · LOCALIZAR ≠ EXPLICAR: una afirmación causal solo vale si se apoya en algo del dato — el mecanismo que
     * el motor declara, o una cifra (que el muro ya verificó). Lo que se veta es la causa INVENTADA, del tipo
     * «cede margen porque su equipo negocia mal»: ninguna cifra, ningún mecanismo, pura atribución. Una
     * justificación anclada en cifras —«porque juntos explican $1.24M de los $1.57M» (examen 1 t3, aceptado)—
     * NO es una causa inventada y no se multa: el dato la sostiene. */
    /* ⚠️ «margen» y «venta» NO entran acá: son el TEMA del playbook, así que casi toda oración causal de este
     * dominio los nombra —incluida la que hay que vetar («cede margen porque su equipo negocia mal»)— y la
     * regla quedaría muerta. Lo que sostiene una causa es el mecanismo declarado por el motor o una cifra. */
    /* 5 · LA BRECHA DEL NEGOCIO TIENE QUE CERRAR CON SUS DOS TÉRMINOS (owner 2026-09-03, defecto vivo cazado
     * por el supervisor verificando el humo): el cerebro abrió con «tu margen está 8,6 puntos por debajo del
     * benchmark» — y 8,6 es la brecha de LIDER (su propia tabla lo decía al lado); la del negocio es 5,0
     * (30,1 − 25,1). La pantalla del owner decía 5.0: dos verdades del mismo concepto. Sobrevivió a todo
     * porque el 8,6 EXISTE en la boleta (es de Lider) y la atribución no lo cazó en esa oración. La regla es
     * aritmética y quirúrgica: una brecha en pp atribuida AL NEGOCIO (la oración trae señal de negocio y NO
     * nombra a ningún cliente — la fila «Lider · –8,6 pp» es legítima y no se toca) tiene que cerrar con
     * benchmark − promedio de la boleta, tolerancia de redondeo. */
    const _BRECHA_PP = /(\d+(?:[.,]\d+)?)\s*(?:pp\b|puntos?(?:\s+porcentuales)?)\s*(?:por\s+debajo|bajo|abajo)/i;
    const _DEL_NEGOCIO = /tu margen|margen (?:promedio|de la cartera|general)|la cartera|el negocio|\bpromedio\b/i;
    if (Number.isFinite(L.benchPct) && L.promedio) {
      const promPct = _pct(L.promedio);
      if (Number.isFinite(promPct)) {
        const brechaReal = L.benchPct - promPct;
        /* el punto decimal NO corta la oración (medido acá mismo: «8.6 puntos por debajo» quedaba partido en
         * «…8» / «6 puntos por debajo…» y la señal de negocio moría en el otro fragmento — la variante con
         * coma multaba y la de punto pasaba limpia). El punto solo corta si NO le sigue un dígito. */
        for (const oracion of t.split(/[!?\n]+|\.(?!\d)/)) {
          const m = _BRECHA_PP.exec(oracion);
          if (!m) continue;
          if (!_DEL_NEGOCIO.test(oracion)) continue;                            // sin señal de negocio, no es esta regla
          if (L.margenes.some((x) => _re(x.entidad).test(oracion))) continue;   // nombra un cliente: es SU brecha, no la del negocio
          const declarada = parseFloat(m[1].replace(",", "."));
          if (Math.abs(declarada - brechaReal) > 0.15) {
            v.push({ regla: "brecha-del-negocio-no-cierra",
              multa: `declaras que el margen del negocio está ${m[1]} pp por debajo del benchmark, pero benchmark (${_val(L.bench)}) menos margen promedio (${_val(L.promedio)}) da ${brechaReal.toFixed(1)} pp — esa cifra es la brecha de OTRA cosa (probablemente un cliente): usa la del negocio o atribúyela a su dueño.` });
            break;
          }
        }
      }
    }

    const MECANISMOS = /carga comercial|rebate|contribuci[oó]n no capturada|capital frenado|peso del costo|\bcosto\b|benchmark/i;
    // el «%» sin `\b` detrás (ver la nota de _CIFRA_EN_MULTA en bucleAgente): con `\b` esta regla no veía
    // NINGÚN porcentaje, y en este playbook casi toda cifra que ancla una causa es un margen.
    const CIFRA = /\$\s?[\d.,]+\s?[KMB]?|[\d.,]+\s*%|[\d.,]+\s*(?:pp|x)\b/;
    for (const oracion of t.split(/[.!?\n]+/)) {
      if (!new RegExp(`\\bporque\\b|\\bse debe a\\b|\\bla causa (?:es|está)${_FIN}|\\bes consecuencia de\\b|\\bexplica por qu[eé]${_FIN}`, "i").test(oracion)) continue;
      if (!MECANISMOS.test(oracion) && !CIFRA.test(oracion)) {
        v.push({ regla: "causa-sin-respaldo",
          multa: "afirmas una causa que el dato no declara: este playbook LOCALIZA (dónde está el exceso y cuánto es); para el porqué hace falta evidencia que este dato no trae. Reformula como localización o di que la causa no está medida." });
        break;
      }
    }
    return v;
  },
};
