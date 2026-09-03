/* === src/adi/agente/playbooks/resumenDelNegocio.js · LA FOTO DEL NEGOCIO (owner 2026-09-05) ==================
 *
 * LA SEÑAL: el owner preguntó «¿cómo va el negocio?» y «dame un resumen ejecutivo de negocio» en producción y
 * las dos cayeron al rescate honesto — `playbookPara` = NINGUNO, el cerebro sin piso. (Su primera prueba de
 * «resumen ejecutivo» había salido bien POR SUERTE del cerebro vivo: nunca hubo camino garantizado.)
 *
 * EL DESLINDE, que es la mitad del diseño: `sintesisEjecutiva` responde LOS RIESGOS para el directorio —tres,
 * por materialidad, con su umbral—. Esto responde LA FOTO: cómo viene el negocio, qué sostiene y qué presiona.
 * Son dos preguntas distintas y el registro no puede dudar entre ellas: el detector de acá exige léxico de
 * PANORAMA y se retira ante «riesgo/directorio», que son de la otra. Ante la duda, false.
 *
 * LA HISTORIA que cuenta (la voz de la carta, entera): la tesis en la primera línea · qué sostiene · qué
 * presiona, POR PAPEL (reusa `rolesCartera`, la pieza central del razonamiento: no todo margen bajo es un
 * problema) · el cobro si el dato lo trae · qué mirar primero, con el criterio marcado · UN cierre.
 *
 * PURO · determinístico · sin red. Cifras VERBATIM de la boleta: selecciona y ordena, jamás calcula. */

import { variante } from "../variacion.js";
import { buildRolesCartera } from "../../sentrix/rolesCartera.js";

const _num = (f) => (f && Number.isFinite(f.raw) ? f.raw : NaN);
const _val = (f) => String((f && (f.text || f.value)) || "");
const _lab = (f) => String((f && f.label) || "");
const _find = (figs, re) => (Array.isArray(figs) ? figs : []).find((f) => re.test(_lab(f))) || null;
const _all = (figs, re) => (Array.isArray(figs) ? figs : []).filter((f) => re.test(_lab(f)));
const _entidadDe = (label) => { const p = String(label || "").split("·").map((s) => s.trim()); return p.length >= 2 ? p[0] : null; };
const _FIN = "(?![a-záéíóúüñ])";

/* ── EL DETECTOR · léxico de PANORAMA, conservador ─────────────────────────────────────────────────────────
 * Entra: «cómo va/viene/venimos el negocio», «resumen ejecutivo», «la foto del negocio», «puntos altos y
 * bajos», «panorama general». NO entra: los riesgos del directorio (de `sintesisEjecutiva`), ni nada que
 * nombre un tema con dueño propio (margen, cobro, inventario, un cliente puntual) — esas ya tienen su camino
 * y secuestrarlas sería peor que no existir. */
const _PANORAMA = new RegExp([
  `\\bc[oó]mo (?:va|viene|venimos|estamos|anda)${_FIN}`,
  `\\bresumen ejecutivo\\b`, `\\bresumen (?:del|de) negocio\\b`, `\\bresumen general\\b`,
  `\\bla foto (?:del negocio|general)\\b`, `\\bpanorama\\b`,
  `\\bpuntos altos\\b`, `\\bfuertes y d[eé]biles\\b`, `\\blo bueno y lo malo\\b`,
].join("|"), "i");
/* lo que NO es esta pregunta (cada uno con su playbook o su razón) */
const _AJENO = new RegExp([
  `\\briesgos?\\b`, `\\bdirectorio\\b`, `\\bboard\\b`,        // → sintesisEjecutiva
  `\\bsimul`, `\\bproyect`, `\\bpon[eé]le que${_FIN}`,        // → proyección
  `\\bpor\\s?qu[eé]${_FIN}`, `\\bporqu[eé]${_FIN}`,           // → el porqué del margen
  `\\bdeb[eo]n?\\b|\\bvencid|\\bcobr`,                        // → cobranza
  `\\binventario\\b|\\bstock\\b|\\brotaci[oó]n\\b`,           // → inventario
  `\\bcliente\\b|\\bsku\\b|\\bmarca\\b|\\bbodega\\b|\\bfamilia\\b|\\bcanal\\b`,   // → lectura por eje / ficha
  /* ⚠️ Y LA SERIE, que este detector secuestró al estrenarse (cazado por el gate de la amnistía, no por mí):
   * «cómo viene la VENTA mes a mes» matchea «cómo viene» y NO es la foto — es la curva, y tiene su camino.
   * Una métrica nombrada convierte la pregunta en lectura de esa métrica; la foto es del NEGOCIO entero. */
  /* sin `\b` delante de vocal acentuada ni después de ella (el `\b` imposible del §5g — me lo cazó su barrido
   * al estrenar esto): `\b[uú]ltimos` nunca vería «últimos», y `evolución\b` nunca cerraría tras la «ó». */
  `\\bmes a mes${_FIN}|\\bmensual${_FIN}|\\bpor mes${_FIN}|\\bevoluci[oó]n${_FIN}|\\btendencia${_FIN}|[uú]ltimos meses${_FIN}`,
  `\\bventas?${_FIN}|\\bcontribuci[oó]n${_FIN}|\\bcaja${_FIN}`,
].join("|"), "i");

export const resumenDelNegocio = {
  nombre: "resumen-del-negocio",

  cuandoAplica(pregunta) {
    const q = String(pregunta || "");
    if (!q.trim() || _AJENO.test(q)) return false;
    return _PANORAMA.test(q);
  },

  pasos: [
    { tool: "executiveSummary", args: {}, para: "la foto del período: venta contra el año anterior, contribución, margen contra el benchmark declarado" },
    { tool: "diagnose", args: {}, para: "dónde localiza el motor lo que presiona: contribución no capturada, carga comercial alta, capital inmovilizado — con su subtotal y quién encabeza" },
    { tool: "rolesCartera", args: {}, para: "el PAPEL de cada cliente: quién sostiene, quién erosiona por acciones comerciales y quién vende volumen a margen bajo — para no meter en la misma bolsa la estrategia y la fuga" },
  ],
  obligatorias: [/^Ventas del período$/i, /^Margen promedio$/i],

  entregable: "la foto del negocio en una lectura: cómo viene la venta contra el año anterior, qué margen deja, quiénes lo sostienen y quiénes lo presionan (por papel, no por lista), qué mira primero un asesor y por qué — el criterio marcado como criterio.",

  componer({ figs, semilla, scenario } = {}) {
    const ventas = _find(figs, /^Ventas del período$/i);
    const margen = _find(figs, /^Margen promedio$/i);
    if (!ventas || !margen) return null;                       // sin la foto base no hay foto
    const contrib = _find(figs, /^Contribución$/i);
    const yoy = _find(figs, /^Ventas vs a[ñn]o anterior$/i);
    const bench = _find(figs, /^(?:Piso de margen|Benchmark de margen)$/i);
    const noCapturada = _find(figs, /^Contribuci[oó]n no capturada · subtotal$/i);
    const cargaAlta = _find(figs, /^Carga comercial alta · subtotal$/i);
    const grandesPct = _find(figs, /^Contribución de los grandes$/i);

    let A = null;
    try { A = buildRolesCartera(scenario); } catch { A = null; }
    const p = [];

    /* 1 · LA TESIS EN LA PRIMERA LÍNEA — la voz de la carta: qué historia cuentan juntos los números */
    const sube = yoy && Number.isFinite(_num(yoy)) && _num(yoy) > 0;
    p.push(sube
      ? `El negocio está creciendo y dejando menos margen del que podría: la venta viene ${_val(yoy)} contra el año anterior, y el margen promedio queda en ${_val(margen)}${bench ? ` contra un benchmark de ${_val(bench)}` : ""}.`
      : `La foto en una línea: ${_val(ventas)} de venta en el período${yoy ? ` (${_val(yoy)} contra el año anterior)` : ""}, con el margen promedio en ${_val(margen)}${bench ? ` contra un benchmark de ${_val(bench)}` : ""}.`);

    /* 2 · LO QUE SOSTIENE */
    const altos = [];
    if (sube) altos.push(`la venta crece ${_val(yoy)} contra el año anterior`);
    if (contrib) altos.push(`la contribución del período es ${_val(contrib)}`);
    const sanos = A && A.roles && A.roles.sano ? A.roles.sano : null;
    /* ⚠️ ESTA AFIRMACIÓN VA CON SU DUEÑO (multa del muro al estrenar: «N clientes rinden sobre tu benchmark»
     * quedaba sin sujeto y el binding la cruzó con Falabella, que está BAJO — la afirmación se leía invertida).
     * Se nombra al que encabeza, con su cifra de la boleta: cada afirmación con su dueño al lado. */
    /* ⚠️ LO QUE NO SE DICE ACÁ, Y POR QUÉ (medido, tres intentos): «N clientes rinden sobre tu benchmark»
     * dispara `relacion-contradictoria` en el muro — en una línea que enumera al negocio entero, el binding
     * empareja ese «sobre el benchmark» con las entidades cercanas, y las cercanas están BAJO. Intenté darle
     * dueño (el sano que encabeza, con su cifra) y el conflicto siguió: el problema no es el dueño, es que la
     * frase mezcla el universo «los sanos» con el párrafo que habla de todos. Los sanos SÍ se cuentan, pero en
     * su lugar natural: el papel de cada cliente, que ya vive abajo. Si no puedo decirlo sin ambigüedad, no lo
     * digo — la foto no pierde nada y el muro no se afloja por una frase de adorno. */
    void sanos;
    if (altos.length) p.push(`\n**Lo que sostiene:** ${altos.join(" · ")}.`);

    /* 3 · LO QUE PRESIONA, POR PAPEL — la distinción que separa la estrategia de la fuga */
    const bajos = [];
    /* el subtotal se ATRIBUYE al detector, no se insinúa cerrable: «contra el benchmark» hacía que el muro lo
       * leyera como una brecha con palanca, y esta boleta no la trae cuantificada. La misma forma que ya pasó
       * en el molde de margen. */
      if (noCapturada) bajos.push(`el motor detecta ${_val(noCapturada)} de contribución no capturada`);
    /* «sobre el nivel de referencia» era ambiguo y el muro lo cazó: con la entidad de la línea siguiente cerca,
     * el binding leía «Falabella está SOBRE la referencia» —y está bajo—. Se dice el exceso sin la preposición
     * que se puede confundir con el margen: cada afirmación con su métrica clara. */
    if (cargaAlta) bajos.push(`${_val(cargaAlta)} de acciones comerciales en exceso`);
    if (bajos.length) p.push(`\n**Lo que presiona:** ${bajos.join(" · ")}.`);
    if (A && A.roles) {
      const ero = A.roles.erosion_por_acciones, vol = A.roles.apuesta_de_volumen;
      const linea = [];
      if (ero && ero.n) linea.push(`${ero.n} pagan margen en acciones comerciales (${ero.items.slice(0, 2).map((f) => f.entidad).join(" · ")})`);
      if (vol && vol.n) linea.push(`${vol.n} venden volumen a margen bajo sin exceso de carga —eso puede ser una decisión tuya, no una fuga—`);
      if (linea.length) p.push(`Y no todos presionan por lo mismo: ${linea.join("; ")}.`);
    }
    if (grandesPct) p.push(`Tus cuentas grandes concentran ${_val(grandesPct)} de la contribución: ahí se decide el resultado.`);

    /* 4 · QUÉ MIRARÍA PRIMERO — criterio marcado (la regla `juicio-sin-marcar` del muro, hecha voz) */
    const foco = A && A.roles && A.roles.erosion_por_acciones && A.roles.erosion_por_acciones.items[0];
    if (foco) {
      p.push(variante(semilla, [
        `\nQué miraría primero —criterio mío, no una cifra del dato—: ${foco.entidad}, donde el volumen y la carga excedida coinciden. Si quieres, te abro el porqué del margen completo.`,
        `\nCriterio mío, no una cifra del dato: empezaría por ${foco.entidad}, que junta volumen y carga excedida. ¿Te abro el porqué del margen?`,
        `\nSi fuera mi decisión —criterio mío—, entraría por ${foco.entidad}: ahí coinciden el volumen y la carga excedida. Te abro el análisis completo cuando digas.`,
      ]));
    }
    return p.join("\n");
  },

  /* ── LA LISTA NOTARIAL · las promesas de ESTA foto ─────────────────────────────────────────────────────── */
  listaNotarial(texto, { figs } = {}) {
    const t = String(texto || "");
    if (!t.trim()) return [];
    const v = [];
    /* 1 · una foto sin la venta ni el margen no es una foto: es una opinión sobre el negocio */
    /* ⚠️ ACOTADA AL ROL (medido al estrenarla: sin esto la regla mataba la LÍNEA HONESTA — el peldaño de
     * rescate no cita el margen porque no es una foto, y mi lista lo multaba igual; el turno terminaba en vacío).
     * La foto se juzga cuando el texto ES la foto: cita la venta del período o cuenta el panorama. */
    const ventas = _find(figs, /^Ventas del período$/i), margen = _find(figs, /^Margen promedio$/i);
    const esLaFoto = ventas && (t.includes(_val(ventas)) || /lo que sostiene|lo que presiona|la foto en una línea/i.test(t));
    if (esLaFoto && margen && !t.includes(_val(margen))) {
      v.push({ regla: "foto-sin-margen", multa: `la foto del negocio no cita el margen promedio (${_val(margen)}), que es la mitad de cómo va el negocio: dilo con su cifra.` });
    }
    /* 2 · el veredicto tiene que cerrar con el dato: si la venta SUBE, no se narra como caída (y al revés) */
    const yoy = _find(figs, /^Ventas vs a[ñn]o anterior$/i);
    if (yoy && Number.isFinite(_num(yoy))) {
      const sube = _num(yoy) > 0;
      if (sube && /\b(?:la venta|las ventas) (?:viene|vienen|est[aá]n?) (?:cayendo|en ca[íi]da|a la baja)\b/i.test(t)) {
        v.push({ regla: "veredicto-invertido", multa: `dices que la venta cae y el dato declara ${_val(yoy)} contra el año anterior: el veredicto va con la cifra.` });
      }
      if (!sube && /\b(?:la venta|las ventas) (?:crece|crecen|sube|suben)\b/i.test(t)) {
        v.push({ regla: "veredicto-invertido", multa: `dices que la venta crece y el dato declara ${_val(yoy)} contra el año anterior: el veredicto va con la cifra.` });
      }
    }
    /* 3 · nombrar clientes como «los que sostienen» exige que sean los que el motor pone arriba */
    const contribs = _all(figs, /· Contribución$/i)
      .map((f) => ({ entidad: _entidadDe(_lab(f)), usd: _num(f) }))
      .filter((x) => x.entidad && Number.isFinite(x.usd)).sort((a, b) => b.usd - a.usd);
    if (contribs.length >= 2) {
      const m = /\bsostiene[n]?\b[^.\n]{0,60}?([A-ZÁÉÍÓÚÑ][\wÁÉÍÓÚÑáéíóúñ .'-]{2,25})/.exec(t);
      if (m) {
        const nombrado = contribs.find((c) => new RegExp(`\\b${c.entidad.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(m[1]));
        if (nombrado && nombrado.entidad !== contribs[0].entidad) {
          v.push({ regla: "sostiene-mal-atribuido", multa: `dices que sostiene ${nombrado.entidad}, pero el de mayor contribución del período es ${contribs[0].entidad}: la foto se cuenta con el orden del dato.` });
        }
      }
    }
    return v;
  },
};
