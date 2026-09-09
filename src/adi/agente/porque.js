/* === src/adi/agente/porque.js · EL MÉTODO DEL PORQUÉ, TRANSVERSAL (owner 2026-09-09) ========================
 *
 * LA LEY, palabra del owner, textual: «No quiero que el método del porqué dependa de venir desde un cuadro. Si
 * el usuario pregunta "por qué" desde cualquier lugar —cuadro, ficha, chat libre, cliente, margen, ventas,
 * inventario o cobranza— ADI debe seguir la misma doctrina: medir primero · hipótesis marcada después ·
 * pregunta concreta al dueño para completar la causa. Y los tres vetos deben aplicar transversalmente:
 * afirmar mecanismo sin cifras de respaldo, arde · afirmación sectorial externa sin fuente, arde · cerrar sin
 * una pregunta concreta CUANDO FALTA CONTEXTO, arde.»
 *
 * DE DÓNDE SALE. Nació en el turno del cuadro (contrato §15) porque ahí apareció el defecto: en producción ADI
 * afirmó «el volumen cayó, no es margen cedido» sin mostrar una cifra —teniéndolas todas en la boleta— y
 * escribió «el sector electrodomésticos históricamente cae en febrero» con el rótulo «criterio mío» puesto,
 * pero sin fuente. El rótulo salvaba la honestidad; faltaba el método. Acá deja de ser del cuadro y pasa a ser
 * de la casa.
 *
 * POR QUÉ UN MÓDULO Y NO TRECE PARCHES. Un mapeo de seis lecturas encontró SEIS detectores distintos de «por
 * qué» repartidos por los playbooks, y caminos que sirven un porqué con cero doctrina y cero veto (la lectura
 * por eje, la cobranza, el turno libre sin playbook). Dos léxicos que divergen son un turno partido en dos
 * cerebros. Un detector, una letra, tres reglas — y los tres consumidores importan de acá.
 *
 * LO QUE ESTA LEY NO HACE, y está medido:
 *   · NO se mete con la PROCEDENCIA («¿por qué 103.1%?» = de dónde sale esa cifra). Eso es aritmética con
 *     respaldo, no causa — y hoy el propio veto del cuadro se lo cobraba a su propia respuesta correcta.
 *   · NO se mete con el LÍMITE DEL DATO («¿por qué no me muestras el vencido?»). Ahí la causa completa es
 *     «tu archivo no declara el plazo de pago», y exigirle una pregunta al dueño sería absurdo.
 *   · NO se mete con la SIMULACIÓN («¿por qué me da $103.0M si crezco 3%?»). Es la aritmética del supuesto.
 *   · NO exige cifras donde el dato no tiene mecanismo (inventario, cobranza): ahí obligar respaldo empuja al
 *     cerebro a rellenar con conocimiento del mundo, que es EXACTAMENTE el defecto que esto cierra.
 *
 * PURO · determinístico · sin estado · cero llamadas. */

import { parseFigures } from "../boleta.js";
import { _PIDE_PROYECCION, _CIFRA_SUPUESTO } from "./contratoAgente.js";   // un detector, dos usos: la casa ya declara qué es una proyección

/* ── EL DETECTOR ÚNICO ───────────────────────────────────────────────────────────────────────────────────────
 * El ANGOSTO (el del cuadro, que ya está medido) y no el ancho: «motivo», «profundiza» y «explícame» son
 * LECTURAS, no porqués — «explícame el cuadro» y «profundiza en la contribución» piden que se lea lo que hay,
 * no que se explique una causa. Los playbooks que rutean con esas palabras siguen ruteando; la LEY no las ve.
 * ⚠️ Los cierres son lookahead, no `\b`: tras «é» el `\b` de JS no existe (la familia de «facturó»). */
/* ⚠️ LAS FORMAS, NO UNA PALABRA. La primera versión solo veía «por qué» y sus tres primas, y una auditoría
 * adversarial la reprobó reproduciendo el defecto: con «¿cómo se explica la caída?» o «¿cuál fue el motivo?»
 * —castellano corriente de un gerente— la ley no se activaba y el texto EXACTO que el owner rechazó volvía a
 * pantalla en verde. Un detector que solo ve una forma de preguntar no es un detector de la casa. */
const _CAUSAL = new RegExp([
  "\\bpor\\s?qu[eé](?![\\wáéíóúñ])", "\\ba qu[eé] se debe(?![\\wáéíóúñ])",
  "\\bcu[aá]l (?:es|fue|ser[ií]a) (?:el|la) (?:causa|raz[oó]n|motivo|explicaci[oó]n|origen)(?![\\wáéíóúñ])",
  "\\bqu[eé] (?:pas[oó]|explica)(?![\\wáéíóúñ])",
  "\\bc[oó]mo se explica(?![\\wáéíóúñ])", "\\bc[oó]mo es que(?![\\wáéíóúñ])",
  "\\bqu[eé] hay detr[aá]s(?![\\wáéíóúñ])", "\\ba ra[ií]z de qu[eé](?![\\wáéíóúñ])",
  "\\bdebido a qu[eé](?![\\wáéíóúñ])", "\\bpor culpa de qu[eé](?![\\wáéíóúñ])",
  "\\bqu[eé] (?:lo |la |los |las )?(?:est[aá] )?(?:caus|provoc|gener|origin)[aóe]",
  "\\bqu[eé] hace que(?![\\wáéíóúñ])", "\\bhay alg[uú]n(?:a)? (?:motivo|raz[oó]n)(?![\\wáéíóúñ])",
].join("|"), "i");

/* (i) PROCEDENCIA · «¿de dónde sale ese 103.1%?» es pedir el respaldo de una cifra, no su causa.
 * ⚠️ ACOTADA A LA CIFRA (la auditoría la reprobó por ancha): «por qué es EL MARGEN de Lider tan bajo» es una
 * causa de negocio y quedaba excluida por el «por qué es + artículo». Tras el verbo tiene que venir un NÚMERO
 * o un demostrativo pegado a un número — si no, es un porqué del negocio y la ley se aplica. */
const _PROCEDENCIA = /\bde d[oó]nde (?:sale|sacas|viene|sali[oó])|\bpor\s?qu[eé]\s+(?:sale|da|dice|marca|arroja)\s+(?:ese|esa|eso|el|la|un|una)?\s*\$?\d|\bpor\s?qu[eé]\s+(?:es|son)\s+(?:ese|esa|esos|esas)\s*\$?\d|\bpor\s?qu[eé]\s+(?:ese|esa|esos|esas)\s+(?:\d|\$|cifra|monto|n[uú]mero|porcentaje|total|valor|%)|\bc[oó]mo (?:calculaste|sacaste|lo sacas)|\bpor\s?qu[eé]\s+\$?\d[\d.,]*\s*(?:%|M|K|\?|$)/i;
/* (ii) LÍMITE DEL DATO · «¿por qué no me muestras el vencido?» — la causa es el límite, y ya se dice entera.
 * ⚠️ ACOTADA AL INSTRUMENTO (la auditoría la reprobó): esto habla de lo que ADI o la pantalla no pueden hacer,
 * NUNCA del negocio. «¿Por qué no está creciendo Falabella?» y «¿por qué no hay ventas en febrero?» son
 * preguntas de negocio y son EXACTAMENTE lo que esta ley existe para atender. */
const _LIMITE_DEL_DATO = /\bpor\s?qu[eé]\s+no\s+(?:me\s+(?:muestras|das|dices|dec[ií]s|traes)|puedo\s+(?:ver|abrir)|puedes\s+(?:ver|darme|mostrarme|traer)|pod[eé]s\s+(?:ver|darme|mostrarme)|tienes\s+(?:el|la|los|las)\s+dat|aparece\s+(?:en|el cuadro)|sale\s+en|se\s+(?:puede\s+ver|ve\s+en))/i;

/** ¿este turno es un PORQUÉ CAUSAL? — la condición previa de la doctrina y de los tres vetos. */
export function esPorQue(pregunta) {
  const q = String(pregunta || "");
  if (!_CAUSAL.test(q)) return false;
  if (_PROCEDENCIA.test(q) || _LIMITE_DEL_DATO.test(q)) return false;
  if (_PIDE_PROYECCION.test(q) && _CIFRA_SUPUESTO.test(q)) return false;   // la aritmética de un supuesto no es una causa
  return true;
}

/* ── LA LETRA · UNA SOLA, PARA TODO CAMINO ───────────────────────────────────────────────────────────────────
 * Viaja como UN mensaje, solo en el turno que la necesita — el principio de `doctrinaAgente.js`: la
 * instrucción no viaja hasta que hace falta. Byte-estable (cero prosa por turno, cero entidades, cero
 * timestamps): el prefijo del proveedor no distingue «mismo contenido en otro orden» de «contenido nuevo».
 * Se inyecta ANTES de la primera ronda, así que no puede saber qué traerá la boleta: por eso su paso 1 ORDENA
 * LA LECTURA (qué herramienta trae mecanismo para cada tema) en vez de nombrar cifras. */
/* el tope subió de 900 a 1600 al sumar el paso (1b): la letra ahora también dice CON QUÉ descomponer. Sigue
 * siendo un bloque que viaja UNA vez y solo en el turno causal — no entra al system de todos los turnos. */
export const TOPE_DOCTRINA_CHARS = 2400;
const _DOCTRINA = [
  "MÉTODO DEL PORQUÉ (el usuario pregunta una causa) · TRES PASOS, EN ORDEN:",
  "(1) MIDE PRIMERO: pide el mecanismo del tema —margen→rolesCartera · un mes→cuadroSentrix · una cuenta→entityProfile · una caída→salesRead— y di QUÉ SE MOVIÓ CON SUS CIFRAS («cediste margen: la carga subió contra la del año»). Si ninguna lo trae, dilo: localizas, no explicas. NO rellenes ese hueco con mundo.",
  /* ── DESCOMPONER, NO SOLO LOCALIZAR (owner 2026-09-09) ────────────────────────────────────────────────────
   * «Que ADI no diga solo "margen bajo por Falabella", sino que pueda explicar si viene de precio, costo,
   * carga comercial, mix, canal o sucursal cuando el dato lo permita.» Las lecturas existían en el motor y el
   * catálogo no las nombraba; acá se le dice CUÁL pedir para cada pregunta, y qué hacer con la que no existe. */
  "(1b) Y NO TE QUEDES EN QUIÉN: DESCOMPÓN. Nombrar al culpable no es explicar. Para la VENTA: salesRead focus=descomposicion_vol_precio (¿volumen o precio?) · focus=mix_familia (efecto mezcla) · focus=precio_realizado (venta÷unidades) · focus=precio_neto (precio neto después de acciones). Para el MARGEN: marginRead focus=causa_precio (lista pegada al costo) · focus=causa_costo (el costo se lleva la lista) · rolesCartera (carga comercial). Los dos leen por eje: cliente · sku · marca · familia · canal. Si el usuario pide una dimensión y existe, ÚSALA; si no existe, dilo y ofrece el corte más cercano. NO HAY corte por punto de venta ni por sucursal: eso el motor no lo lee todavía, y se dice así.",
  /* ── DOS CAUTELAS QUE SALIERON DE LA CERTIFICACIÓN ADVERSARIAL (owner 2026-09-09) ─────────────────────────
   * (i) las tres cifras de la descomposición van JUNTAS: sueltas, el muro veta con razón —«+1.8%» coincide con
   *     la cifra de otra cuenta y sin el total al lado no se sabe de quién es. Medido: la frase completa pasa,
   *     la suelta cae en cifra-no-autorizada, y el turno degrada a un texto pobre.
   * (ii) el precio realizado SUBE SI CAMBIA LA MEZCLA, sin que se haya movido un precio. La salvedad la escribe
   *     el motor pero se pierde antes de llegar acá, así que la ley la lleva: decir «subiste precios» cuando lo
   *     que cambió fue quién compró es exactamente la causa inventada que este método existe para impedir. */
  "(1c) DOS CAUTELAS AL DESCOMPONER. Las tres cifras de volumen/precio se citan JUNTAS y en una sola frase (el total y sus dos efectos): sueltas no se pueden verificar y se vetan. Y el «precio realizado» es venta÷unidades: SUBE SOLO PORQUE CAMBIÓ LA MEZCLA de quién o qué compró, sin que hayas movido ningún precio — así que jamás digas «subiste precios» a partir de él; di «el precio realizado subió» y ofrece mirar el mix para separar una cosa de la otra.",
  "(2) TU HIPÓTESIS, MARCADA («mi hipótesis es…») y declarada no probada, sobre EL NEGOCIO DEL USUARIO: su calendario, sus clientes, sus campañas. PROHIBIDO afirmar cómo se comporta un sector o una industria: no tienes fuente y llega como estadística.",
  "(3) PREGÚNTALE AL DUEÑO lo que falta: el detonante lo sabe él. Concreta y con opciones (una campaña, un quiebre de stock, un cliente grande, una negociación). «¿Seguimos?» no cuenta. Si él ya te lo declaró, cítalo en vez de preguntar.",
].join("\n");
/** la letra de la ley — la MISMA cadena en todo turno (el gate lo verifica byte a byte). */
export function doctrinaDelPorque() { return _DOCTRINA; }

/* ── LO QUE CUENTA COMO HIPÓTESIS MARCADA ────────────────────────────────────────────────────────────────── */
/* ⚠️ SIN «creo que» NI «sospecho» (la auditoría los reprobó, y con razón): son muletillas, no una marca de
 * proporcionalidad. «Creo que Falabella cede margen porque no los visitan» suena a hipótesis y afirma una
 * causa inventada igual — con esas dos adentro, cualquier atribución quedaba blanqueada. La marca tiene que
 * DECIR que es criterio propio o que no está probado, que es lo que el owner pidió. */
export const MARCA_HIPOTESIS = /\bmi hip[oó]tesis\b|\bhip[oó]tesis m[ií]a\b|\bes criterio m[ií]o\b|\bcriterio m[ií]o\b|\ba mi juicio\b|\bmi lectura es\b|\bno est[aá] probado\b|\bel dato no lo confirma\b|\bno (?:lo )?puedo (?:probar|confirmar)\b/i;
/** el texto DECLARA que el porqué no está en el dato — también es una lectura causal que hay que cerrar. */
const _DECLARA_LIMITE = /no est[aá]\s+(?:exactamente\s+)?en (?:este|el|ese) (?:dato|cuadro)|localiza[^.]{0,30}no explica|no (?:lo )?explica|el porqu[eé][^.]{0,40}no (?:est[aá]|viene)/i;

/* ── (a) UN MECANISMO AFIRMADO VIAJA CON SUS CIFRAS ──────────────────────────────────────────────────────────
 * «Fue volumen, no margen» es una afirmación sobre el negocio: sin las cifras que la sostienen es una opinión
 * con cara de medición. ⚠️ SOLO SE ASOMA SI EL TURNO TRAE UN CONJUNTO MEDIDO: en inventario y cobranza no hay
 * mecanismo en el dato, y exigir cifras ahí solo mata la declinación honesta o empuja a inventar. */
const _MECANISMO = /\b(?:fue|es|vino)\s+(?:por\s+)?(?:el\s+)?volumen(?![\wáéíóúñ])|\bno\s+es\s+(?:el\s+)?margen(?![\wáéíóúñ])|\bcedis?te?\s+margen(?![\wáéíóúñ])|\bperdi(?:mos|ste|ó)\s+margen(?![\wáéíóúñ])|\bganas?te?\s+volumen(?![\wáéíóúñ])|\bcay[óo]\s+el\s+volumen(?![\wáéíóúñ])|\bno\s+(?:es|fue)\s+(?:una\s+)?acci[oó]n(?:es)?\s+comercial(?:es)?(?![\wáéíóúñ])|\bel\s+margen\s+(?:se\s+mantuvo|no\s+se\s+movi[óo]|acompañ[óa])(?![\wáéíóúñ])/i;
/* las llaves de facts que SÍ son un conjunto medido del mecanismo — declaradas, no adivinadas */
const _CONJUNTOS_MEDIDOS = ["mesPorDentro", "huellas", "roles", "mecanismo", "brechaMargen", "excesoAcciones"];
/** ¿el turno trae, en los resultados de sus herramientas, un conjunto medido del mecanismo? */
function _hayMecanismoMedido(results) {
  for (const r of results || []) {
    const f = r && r.facts;
    if (!f || typeof f !== "object") continue;
    for (const k of _CONJUNTOS_MEDIDOS) if (f[k] !== undefined && f[k] !== null) return true;
    /* rolesCartera publica sus huellas anidadas; entityProfile su brecha — se buscan un nivel adentro */
    for (const v of Object.values(f)) {
      if (!v || typeof v !== "object") continue;
      for (const k of _CONJUNTOS_MEDIDOS) if (v[k] !== undefined && v[k] !== null) return true;
    }
  }
  return false;
}
/** las cifras AUTORIZADAS del turno: la boleta acumulada + lo que el usuario ya vio aprobado. */
function _cifrasAutorizadas(figs, recita) {
  const out = new Set();
  const _sumar = (lista) => { for (const f of lista || []) { const v = f && (f.value !== undefined ? f.value : f.valor); if (v && /\d/.test(String(v))) out.add(String(v)); } };
  _sumar(figs);
  _sumar(recita && recita.figs);
  return out;
}
/* una oración CONDICIONAL no afirma un mecanismo: propone («priorizaría dónde el margen acompaña»). */
const _CONDICIONAL = /\b\w+r[ií]a(?![\wáéíóúñ])|\bsi\s+\w+(?:ras|ses|ra|se)(?![\wáéíóúñ])|\bhabr[ií]a\b|\bpodr[ií]a\b/i;

/* ── (b) NADA DE ESTADÍSTICA DE SECTOR SIN FUENTE ────────────────────────────────────────────────────────────
 * ⚠️ CALIBRACIÓN MEDIDA, y sin ella esta regla sería un desastre: «retail», «canal» y «categoría» son PALABRAS
 * DEL DATO de este producto — «Retail» es un valor del eje canal del tenant y «categoría» es como la casa
 * nombra el eje familia. Frases legítimas que ardían con la primera versión: «El canal Retail siempre fue tu
 * mayor canal: $95.2M de $100.0M» · «La categoría Electrodomésticos sostiene la venta». El sujeto es SOLO de
 * mundo, y además se excluye cualquier nombre propio del índice del tenant. */
const _SUJETO_MUNDO = "(?:el\\s+sector|la\\s+industria|el\\s+mercado|el\\s+rubro|el\\s+comercio|del\\s+(?:sector|rubro|mercado)|la\\s+competencia)";
const _HABITO = "(?:hist[oó]ricamente|t[ií]picamente|por\\s+lo\\s+general|generalmente|suele[n]?|tiende[n]?\\s+a|siempre|normalmente|en\\s+general)";
const _SECTORIAL = new RegExp(`${_SUJETO_MUNDO}[^.;\\n]{0,60}${_HABITO}|${_HABITO}[^.;\\n]{0,40}${_SUJETO_MUNDO}`, "i");
/* la fuente EXIME, pero acotada a la MISMA oración: si no, un «tu benchmark» al final del texto perdonaba
 * cualquier afirmación de industria escrita tres párrafos antes (hueco inverso, medido). */
const _FUENTE = /seg[uú]n\s+(?:tu|lo que|el dato|la fuente|me)|que\s+(?:t[uú]\s+)?(?:declaraste|contaste|dijiste|mencionaste)|me\s+(?:dijiste|contaste|declaraste)|como\s+(?:me\s+)?(?:contaste|declaraste|dijiste)|t[uú]\s+mismo\s+(?:señalas|dices|declaras)|tu\s+benchmark|el\s+dato\s+que\s+cargaste/i;

/* ── (c) EL PORQUÉ CIERRA PREGUNTANDO — «CUANDO FALTA CONTEXTO» (la condición textual del owner) ─────────────
 * Falta contexto se define MECÁNICAMENTE, y por eso esta regla no es un capricho: hay una lectura causal que
 * cerrar (hipótesis, mecanismo afirmado o límite declarado), y el dueño NO nos dio ya ese contexto. */
const _CONCRETA = /\b(?:campañ|promoci|stock|quiebre|cliente|precio|negoci|acuerdo|convenio|descuento|calendario|temporada|mes bajo|proveedor|mezcla|mix|inventario|licitaci|contrato|competidor|cobro|pago|plazo|surtido|local|sucursal|vendedor|equipo|comprar|compró|compran|vend)/i;
/* el cortador de preguntas respeta el decimal: «103.1%» no parte la oración (trampa documentada de la casa). */
const _PREGUNTAS = /(?:[^.!?\n]|(?<=\d)\.(?=\d))*\?/g;
/** ¿el dueño ya declaró el contexto? — su intención registrada, o el contexto del negocio citado en el texto */
function _contextoYaDado(texto, mem, contexto) {
  const intenciones = (mem && Array.isArray(mem.intenciones)) ? mem.intenciones : [];
  if (intenciones.length && /\bme (?:dijiste|contaste|declaraste)|seg[uú]n me|como (?:me )?(?:contaste|dijiste)|t[uú] (?:mismo )?(?:declaraste|dijiste)/i.test(texto)) return true;
  const ctxTxt = contexto && typeof contexto === "object" ? String(contexto.texto || "") : String(contexto || "");
  if (ctxTxt.trim() && _FUENTE.test(texto)) return true;
  return false;
}

/** LOS TRES VETOS DE LA LEY. Devuelve [] si el turno no es un porqué causal — la lectura normal no se toca.
 *  @param {string} texto  el borrador del cerebro
 *  @param {{pregunta:string, figs:Array, results:Array, recita:object, mem:object, contexto:any, sitio:string}} ctx */
export function vetosDelPorque(texto, { pregunta = "", figs = [], results = [], recita = null, mem = null, contexto = null, sitio = "cierre" } = {}) {
  const t = String(texto || "");
  if (!t.trim()) return [];
  /* ⚠️ JUZGA AL CEREBRO, NO A LOS PELDAÑOS — el mismo criterio que `vetoCifraSinBoleta`: la línea honesta y el
   * respaldo sirven textos que YA pasaron el muro, y multar al que rescata es castigar al que arregla. */
  if (sitio !== "cierre" && sitio !== "reparacion") return [];
  if (!esPorQue(pregunta)) return [];
  const v = [];

  /* (a) MECANISMO SIN CIFRAS — solo donde el turno TIENE un conjunto medido con qué respaldarlo */
  if (_hayMecanismoMedido(results)) {
    const autorizadas = _cifrasAutorizadas(figs, recita);
    if (autorizadas.size) {
      for (const oracion of t.split(/(?<![\d])[.;\n](?![\d])/)) {
        if (!_MECANISMO.test(oracion) || _CONDICIONAL.test(oracion)) continue;
        let citadas = 0;
        for (const cif of autorizadas) if (oracion.includes(cif)) citadas++;
        if (citadas < 2) {
          v.push({ regla: "mecanismo-sin-cifras", multa: `afirmas QUÉ movió el resultado («${oracion.trim().slice(0, 60)}…») sin mostrar las cifras que lo sostienen. Este turno midió el mecanismo: cita al menos dos de sus cifras —la del período y su referencia— o no lo afirmes.` });
          break;
        }
      }
    }
  }

  /* (b) SECTORIAL SIN FUENTE — el rótulo «criterio mío» NO lo salva: la frase llega igual como estadística */
  for (const oracion of t.split(/(?<![\d])[.;\n](?![\d])/)) {
    const m = oracion.match(_SECTORIAL);
    if (!m) continue;
    if (_FUENTE.test(oracion)) continue;                       // la fuente exime, en SU oración
    if (new RegExp(_SUJETO_MUNDO, "i").test(String(pregunta))) continue;   // lo trajo el usuario: es su premisa
    v.push({ regla: "sectorial-sin-fuente", multa: `escribes «${String(m[0]).slice(0, 70)}…»: eso afirma cómo se comporta un sector entero y no tienes fuente para sostenerlo. Habla del NEGOCIO DEL USUARIO —su calendario, sus clientes, sus campañas— como hipótesis tuya, o pregúntaselo.` });
    break;
  }

  /* (c) SIN PREGUNTA CUANDO FALTA CONTEXTO — las cuatro condiciones del owner, mecánicas */
  /* ⚠️ Y SE PIDE SIEMPRE, NO SOLO CUANDO HAY LECTURA CAUSAL (la auditoría encontró el agujero, reproducido en
   * el bucle real): con la condición anterior, un texto que ESQUIVA la pregunta —el ranking de SKU frenados,
   * la tabla de deuda: puro dato, sin hipótesis, sin límite y sin preguntar— quedaba exento porque no tenía
   * «lectura causal que cerrar». Justo el peor caso: el usuario preguntó una causa y se le devolvió una lista.
   * La condición del owner es «cuando falta contexto», y falta salvo que él ya lo haya declarado. */
  if (!_contextoYaDado(t, mem, contexto)) {
    const preguntas = (t.match(_PREGUNTAS) || []).filter((p) => p.trim().length > 12);
    if (!preguntas.some((p) => _CONCRETA.test(p))) {
      const esquiva = !(MARCA_HIPOTESIS.test(t) || _MECANISMO.test(t) || _DECLARA_LIMITE.test(t));
      v.push({ regla: "porque-sin-pregunta", multa: esquiva
        ? `el usuario preguntó una CAUSA y tu respuesta no la aborda ni pregunta por ella: entregas dato y te vas. Di qué mide el dato, declara que la causa no está en él, y pregúntale lo que falta —una campaña, un quiebre de stock, un cliente grande, una negociación—, con opciones.`
        : `cierras el porqué sin preguntarle nada concreto al usuario. El detonante lo sabe él: pregúntale por lo que el dato no tiene —si ese período suele ser bajo, si hubo una campaña, un quiebre de stock o un cliente grande que cambió—, con opciones. Un «¿seguimos?» no es esa pregunta.` });
    }
  }
  return v;
}
