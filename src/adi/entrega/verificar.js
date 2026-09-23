/* === src/adi/entrega/verificar.js · LA AUTOVERIFICACIÓN DE LA ENTREGA (plan `_ADI_LLMBUSINESS_PLAN.md` §1) ═══════
 * Segunda línea, liviana (plan §2): `componer.js` ya verificó CADA hecho contra la boleta con `notario/hechos.js`
 * antes de imprimirlo (regla 9 — ningún hecho sale sin pasar por esa verificación, y si uno falla la Entrega NO
 * se sirve a medias). Este módulo audita el RESULTADO ensamblado contra las ocho reglas de composición del plan
 * §1 — es una búsqueda mecánica sobre `{texto, entrega}`, no un juicio de contenido.
 *
 * Puro. Sin red, sin LLM. `verificarEntrega({texto, entrega}) → { ok, violaciones: [{regla, detalle}] }`.
 *
 * REGLA 11 · COBERTURA DE DOMINIOS (owner 2026-09-23, TAREA 3 del incremento 3 — el encargo multidominio). El
 * candado permanente que pide el owner: «una Entrega multidominio que omita un dominio pedido se pone roja».
 * Se reusa `coberturaDelEncargo` (`partesDelEncargo.js`, la MISMA hoja que ya certifica el ensamblador del
 * encargo compuesto y el contrato de dominios — «una regla, un archivo», no una segunda lista de partes) — jamás
 * se reescribe qué es una parte pedida ni cómo se cubre. Es OPCIONAL: solo corre cuando el llamador pasa
 * `partes` (las de `partesDelEncargo(pregunta)`); las rutas de un solo dominio no la pagan.
 *
 * SUMAR ENTRE UNIVERSOS DISTINTOS YA NO ES POSIBLE POR CONSTRUCCIÓN, no por esta regla: `notario/hechos.js`
 * (`_derivada`, op «suma») rechaza como `no-verificable` («dominios-distintos») cualquier hecho `derivada` que
 * sume figs de dominios distintos — la MISMA verificación que ya corre para cada hecho antes de imprimirse
 * (regla 9, arriba). Si algún día un compositor declarara esa suma, el libro la marca rota y `componer.js` ya
 * se niega a servir la Entrega (ver el candado 3.e en `_entrega_gate.mjs`, que lo prueba con una carnada). */
import { detectVoseo, stripLanguageLeaks } from "../llm/voiceGuard.js";
import { coberturaDelEncargo } from "../agente/partesDelEncargo.js";

const _PALABRAS = (t) => String(t || "").trim().split(/\s+/).filter(Boolean);

/* un número «impreso»: dinero ($21.5M · $500K · $50), porcentaje (12.0%), puntos porcentuales (3.4 pp), veces
 * (1.5x) o un entero suelto pegado a una palabra de conteo/unidad (5 clientes, 6 cuentas, 37 productos). No
 * pretende ser un parser completo de español — es el escáner MECÁNICO que la regla 1 necesita: cualquier cifra
 * que aparezca en el texto y no case con nada de lo impreso por el compositor es una alarma. */
const _RE_CIFRA = /\$\s?-?\d[\d.,]*\s?[MK]?\b|-?\d[\d.,]*\s?(?:%|pp\b|x\b)|(?<![\w.,/-])\d[\d.,]*(?![\w.,%])/g;

function _cifrasEnTexto(texto) {
  const vistas = new Set();
  const out = [];
  for (const m of String(texto || "").matchAll(_RE_CIFRA)) {
    // EL PUNTO FINAL DE ORACIÓN NO ES PARTE DEL NÚMERO (owner 2026-09-22, TAREA 3 — encontrado al generalizar a
    // cobranza: «…foto de cobranza al 31 ago 2026. Saldo pendiente…» capturaba «2026.» y ningún hecho lo
    // respalda, porque lo respaldado es «2026» sin punto). Un decimal REAL nunca termina en «.» —siempre trae
    // dígitos después—, así que quitar un punto final es siempre seguro: nunca corta un decimal legítimo.
    const s = m[0].trim().replace(/\.$/, "");
    if (!s || vistas.has(s)) continue;
    vistas.add(s);
    out.push(s);
  }
  return out;
}

/* «¿esta cifra impresa está respaldada?» — casa si es sustring de algo que el compositor declaró impreso, o si
 * algo declarado es sustring de ella (una cifra puede imprimirse con más o menos contexto pegado, ej. «MM$ 3.4M»
 * contiene «3.4M»). Comparación literal, sin tolerancia numérica: acá no se está re-verificando el VALOR (eso ya
 * lo hizo `notario/hechos.js`), se está verificando que el número no aparezca DE LA NADA. */
function _respaldada(cifra, cifrasImpresas) {
  return cifrasImpresas.some((c) => c === cifra || c.includes(cifra) || cifra.includes(c));
}

/* adjetivos evaluativos de la casa (regla 7) — vetados cuando CALIFICAN una cifra propia, no cuando son parte
 * del NOMBRE de un concepto de la casa («carga comercial alta» es el nombre del detector, no un juicio). */
const _ADJETIVOS = /\b(preocupante|alarmante|excesiv[oa]|grave|gravísim[oa]|inaceptable|pésim[oa]|dram[aá]tic[oa])\b/i;
const _ALTA_PERMITIDA = /carga\s+comercial\s+alta/gi;
function _adjetivosEvaluativos(texto) {
  const sinNombresDeLaCasa = String(texto || "").replace(_ALTA_PERMITIDA, "carga comercial ALTA");
  const m = _ADJETIVOS.exec(sinNombresDeLaCasa);
  return m ? m[0] : null;
}

const TOPE_PALABRAS = 900;

/* REGISTRO — voseo y coloquialismos/anglicismos vetados NUNCA en la Entrega (owner 2026-09-22, corrección del
 * mismo día sobre la TAREA 2 original). La primera versión de esta regla también marcaba el PRONOMBRE de tuteo
 * (tú/tu/tuyo/te/contigo/ti) como defecto — eso estaba MAL: el registro del proyecto ES tuteo neutro
 * (CLAUDE.md; `_registro_gate.mjs`: «El registro es "formal LatAm, sin chilenismos" — eso es tuteo neutro»), y
 * la Entrega no es una excepción decidida por el owner. UNA SOLA FUENTE, no una lista nueva: se reusa
 * `voiceGuard.js` para las dos cosas que sí siguen vetadas —
 *   · VOSEO (chilenismos/argentinismos verbales: «andás», «hacé», «decime»): `detectVoseo`, la autoridad única
 *     del repo para esa forma.
 *   · COLOQUIALISMOS/ANGLICISMOS/VOCABULARIO VETADO: `stripLanguageLeaks` (guita, plata, dormido, palanca,
 *     detenido aplicado a capital, vara, anglicismos de negocio) — si lavarla cambia el texto, algo vetado
 *     estaba adentro.
 * El pronombre de tuteo (tú/tus/tuyo/te) NO se marca: es el registro correcto del proyecto. */
function _tuteoOColoquial(texto) {
  const t = String(texto || "");
  const voseo = detectVoseo(t);
  if (voseo) return { forma: voseo, motivo: "voseo (detectVoseo, voiceGuard.js)" };
  const lavado = stripLanguageLeaks(t);
  if (lavado !== t) return { forma: null, motivo: "coloquialismo/anglicismo que stripLanguageLeaks (voiceGuard.js) reescribe" };
  return null;
}

/** verificarEntrega({ texto, entrega }) → { ok, violaciones: [{ regla, detalle }] }
 *  Las ocho reglas de composición del plan §1 (la novena — autoverificación hecho por hecho — ya la aplicó
 *  `componer.js` con `notario/hechos.js`; acá se re-chequea que el libro haya quedado limpio, en profundidad). */
export function verificarEntrega({ texto, entrega, partes = [] } = {}) {
  const violaciones = [];
  const v = (regla, detalle) => violaciones.push({ regla, detalle });

  if (!entrega || typeof texto !== "string" || !texto.trim()) { v("estructura", "no hay Entrega o el texto está vacío"); return { ok: false, violaciones }; }

  // 9 (defensa en profundidad) · el libro de hechos no puede traer un hecho roto
  const libro = entrega.procedencia && entrega.procedencia.libro;
  if (libro) { const rotos = libro.hechos.filter((h) => !h.ok); if (rotos.length) v("autoverificacion", `${rotos.length} hecho(s) del libro no verifican: ${rotos.map((h) => h.id).join(", ")}`); }
  else v("autoverificacion", "la Entrega no trae el libro de hechos con que se compuso — no es auditable");

  // 1 · cero cifras desnudas — toda cifra impresa en el texto tiene que casar con algo que el compositor declaró
  const cifrasImpresas = (entrega.procedencia && entrega.procedencia.cifrasImpresas) || [];
  const enTexto = _cifrasEnTexto(texto);
  const huerfanas = enTexto.filter((c) => !_respaldada(c, cifrasImpresas));
  if (huerfanas.length) v("cifras-desnudas", `cifras en el texto sin hecho que las respalde: ${huerfanas.join(", ")}`);

  // 2 · oración-hecho = dueño + métrica + valor en la misma oración — cada oración de Respuesta trae al menos un
  // hecho de apoyo declarado (evidencia estructural) y al menos una cifra impresa (evidencia de forma)
  (entrega.respuesta || []).forEach((r, i) => {
    if (!Array.isArray(r.hechos) || !r.hechos.length) v("oracion-hecho", `respuesta[${i}] no declara los hechos que la sostienen: «${(r.texto || "").slice(0, 80)}»`);
    if (!_cifrasEnTexto(r.texto).length) v("oracion-hecho", `respuesta[${i}] no trae ninguna cifra: «${(r.texto || "").slice(0, 80)}»`);
  });

  // 3 · doble colocación — todo hecho citado en Respuesta aparece también en Cifras (tabla) o en la lista de hechos
  // declarados; se exige que cada hecho de tipo `ref`/`cifra` que aparece en una oración de Respuesta esté
  // también entre los hechos de al menos una fila de Cifras (la tabla es la otra colocación obligatoria)
  {
    const enCifras = new Set();
    for (const f of (entrega.cifras && entrega.cifras.filas) || []) for (const id of f.hechos || []) enCifras.add(id);
    const idsDeCliente = new Set();
    for (const r of entrega.respuesta || []) for (const id of r.hechos || []) {
      const h = libro && libro.porId.get(id);
      if (h && h.tipo === "ref" && h.roles.sujetos.length && h.roles.sujetos[0] !== "negocio") idsDeCliente.add(id);
    }
    const sinSegunda = [...idsDeCliente].filter((id) => !enCifras.has(id));
    if (sinSegunda.length) v("doble-colocacion", `hechos por cliente citados en Respuesta y ausentes de la tabla de Cifras: ${sinSegunda.join(", ")}`);
  }

  // 4 · comparables juntas — SOLO aplica cuando la Entrega efectivamente habla de una brecha/benchmark (mecanismo
  // 5 del plan: la frase puente la escribe ADI una vez, en el Marco, para que cada oración de Respuesta la
  // herede sin repetirla). GENERALIZADO en TAREA 3 (owner 2026-09-22, al sumar la ruta de cobranza): la versión
  // original exigía `marco.referenciaDeclarada` SIEMPRE, asumiendo que TODA Entrega compara contra un benchmark
  // — cierto para la brecha comercial, falso para cobranza (no hay benchmark de deuda). La regla ahora se activa
  // por CONTENIDO (el texto nombra «brecha»/«benchmark»), no por la forma de la Entrega.
  const _HABLA_DE_BRECHA = /\bbenchmark\b|\bbrecha\b/i.test(texto);
  if (_HABLA_DE_BRECHA && (!entrega.marco || !entrega.marco.referenciaDeclarada)) v("comparables-juntas", "el texto habla de benchmark/brecha y el marco no declara la referencia — una brecha sin su referencia no se sostiene sola");
  (entrega.respuesta || []).forEach((r, i) => {
    if (/benchmark|brecha/i.test(r.texto) && !_cifrasEnTexto(r.texto).length) v("comparables-juntas", `respuesta[${i}] habla de benchmark/brecha sin ninguna cifra en la misma oración: «${(r.texto || "").slice(0, 80)}»`);
  });

  // 5 · toda ausencia relevante es un límite con TÍTULO, redactado como hallazgo (nunca prohibición ni excusa)
  const _PROHIBICION = /\bprohibid[oa]\b|\bno se puede\b(?!\s+concluir)|\bno está permitido\b/i;
  (entrega.limites || []).forEach((lim, i) => {
    if (!lim.titulo || !lim.titulo.trim()) v("limite-sin-titulo", `limites[${i}] no trae título`);
    if (_PROHIBICION.test(lim.titulo || "")) v("limite-como-prohibicion", `limites[${i}] suena a prohibición, no a hallazgo: «${lim.titulo}»`);
  });

  // 6 · toda tentación precalculada — con más de una cuenta en Cifras, el libro tiene que traer al menos una
  // `razon` o `derivada` (participación del primero, resto de una partición): la tentación de calcular a mano
  // queda precalculada, no dejada al anfitrión
  if (libro && (entrega.cifras.filas || []).filter((f) => f.hechos.length).length > 1) {
    const hayTentacion = libro.hechos.some((h) => h.tipo === "razon" || h.tipo === "derivada");
    if (!hayTentacion) v("tentacion-no-precalculada", "hay más de una cuenta en juego y ningún hecho `razon`/`derivada` precalcula su relación");
  }

  // 7 · ningún adjetivo evaluativo de la casa sobre una cifra
  const adj = _adjetivosEvaluativos(texto);
  if (adj) v("adjetivo-evaluativo", `la casa usa un juicio de valor («${adj}») que le corresponde al modelo, no a ADI`);

  // 10 (owner 2026-09-22, corregida el mismo día) · ningún texto de la Entrega usa voseo ni coloquialismos —
  // viaja sola, sin ADI al lado para reencuadrarla. El tuteo neutro SÍ es el registro del proyecto (CLAUDE.md)
  // y no se marca. Fuente única: voiceGuard.js (ver `_tuteoOColoquial` arriba).
  const registro = _tuteoOColoquial(texto);
  if (registro) v("registro-informal", `${registro.motivo}${registro.forma ? ` («${registro.forma}»)` : ""} — la Entrega va en tuteo neutro, sin voseo ni coloquialismos`);

  // 8 · tope de tamaño — 900 palabras la Entrega corta
  const n = _PALABRAS(texto).length;
  if (n > TOPE_PALABRAS) v("tope-de-tamano", `${n} palabras, sobre el tope de ${TOPE_PALABRAS}`);

  // 11 · cobertura de dominios (TAREA 3, encargo multidominio) — solo si el llamador declara las partes pedidas
  if (Array.isArray(partes) && partes.length) {
    const faltantes = coberturaDelEncargo(texto, partes);
    if (faltantes.length) v("cobertura-de-dominios", `partes pedidas que la Entrega no cubre: ${faltantes.map((p) => p.nombre).join(" · ")}`);
  }

  return { ok: violaciones.length === 0, violaciones };
}
