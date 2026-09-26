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
import { normalizar } from "../notario/afirmacion.js";

const _PALABRAS = (t) => String(t || "").trim().split(/\s+/).filter(Boolean);
/** contarPalabras(texto) → cantidad de palabras — la MISMA cuenta que ya usa la regla 8, exportada para que
 *  `entrega/tamano.js:gobernarTamano` (Corte 3d.3) use la ÚNICA fuente de conteo, nunca una segunda cuenta que
 *  pueda divergir de la que este archivo verifica al final. */
export function contarPalabras(texto) { return _PALABRAS(texto).length; }

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

/* CORTE 3d.3 (owner 2026-09-25/26, `_ADI_DISENO_CORTE_3D.md` §B.1) — DOS PROFUNDIDADES, UN SOLO LIBRO. Los topes
 * son constantes EXPORTADAS de este archivo (una sola fuente — `entrega/tamano.js:gobernarTamano` las importa de
 * acá, nunca las copia). `TOPE_PALABRAS` se conserva como alias de `TOPE_COMPLETA` (mismo valor de siempre, 900):
 * ningún llamador que no declare `profundidad` cambia de comportamiento. */
export const TOPE_BREVE = 350;
export const TOPE_COMPLETA = 900;
const TOPE_PALABRAS = TOPE_COMPLETA;
/* el tope de FILAS de la tabla de Cifras, por profundidad (§B.1: "Cifras: ≤8 filas / ≤24 filas") — lo que se
 * gobierna es el TEXTO servido; `entrega.procedencia.libro` (la verificación completa) y `entrega.universos`
 * (siempre pequeños, nunca recortados en este corte) no cambian de tamaño con la profundidad. */
export const FILAS_BREVE_MAX = 8;
export const FILAS_COMPLETA_MAX = 24;

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

/** verificarEntrega({ texto, entrega, partes, profundidad }) → { ok, violaciones: [{ regla, detalle }] }
 *  Las ocho reglas de composición del plan §1 (la novena — autoverificación hecho por hecho — ya la aplicó
 *  `componer.js` con `notario/hechos.js`; acá se re-chequea que el libro haya quedado limpio, en profundidad).
 *  `profundidad` (ADITIVA, Corte 3d.3, owner 2026-09-25/26): "breve"|"completa", default "completa" — NINGÚN
 *  llamador viejo (las 4 rutas fijas, que nunca declaran profundidad) cambia de tope: siguen contra
 *  `TOPE_COMPLETA`/`FILAS_COMPLETA_MAX`, los mismos números de siempre. */
export function verificarEntrega({ texto, entrega, partes = [], profundidad = "completa" } = {}) {
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
  // hecho de apoyo declarado (evidencia estructural) y al menos una cifra impresa (evidencia de forma).
  // EXCEPCIÓN (corte 3b, `componerEntrega`, cierre `definicion`): el contrato §1.1 PROHÍBE cifras en una
  // definición (`defineConcept` nunca lee la boleta) — una oración marcada `_definicion` no tiene hecho que
  // declarar ni cifra que traer, y eso es lo CORRECTO, no un hueco. Ninguna de las 4 rutas fijas marca esto: la
  // regla queda idéntica para ellas.
  // EXCEPCIÓN (corte 3c, pieza 3 — veredicto de premisas, `entrega/componer.js:_textoDePremisa`): una premisa
  // «no verificable» declara POR QUÉ (falta evidencia), y ese motivo no siempre trae una cifra impresa — mismo
  // espíritu que la excepción `_definicion` de arriba (una oración que legítimamente no tiene cifra propia no es
  // el defecto que esta regla vigila). SÍ sigue exigiendo `hechos` declarados (el id de la premisa evaluada):
  // `_premisa` nunca exime esa mitad de la regla, solo la cifra.
  // EXCEPCIÓN (corte 3d.1, `entrega/iniciativa.js` — la marca visible de la iniciativa de CFO): la línea
  // `_marcaIniciativa` es un TÍTULO de sección (la constante `MARCA_INICIATIVA`), no una oración-hecho — igual
  // que `_definicion` no tiene cifra propia por contrato, esta línea no tiene hecho ni cifra por DISEÑO (§A.5.3).
  (entrega.respuesta || []).forEach((r, i) => {
    if (r._definicion || r._marcaIniciativa) return;
    if (!Array.isArray(r.hechos) || !r.hechos.length) v("oracion-hecho", `respuesta[${i}] no declara los hechos que la sostienen: «${(r.texto || "").slice(0, 80)}»`);
    if (!r._premisa && !_cifrasEnTexto(r.texto).length) v("oracion-hecho", `respuesta[${i}] no trae ninguna cifra: «${(r.texto || "").slice(0, 80)}»`);
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
  // CORTE 3b (owner 2026-09-25) — CORREGIDO por el supervisor: el escaneo sigue siendo el TEXTO COMPLETO («Para
  // su juicio» y «Referencia del oficio» SÍ pueden afirmar una brecha sin su referencia — hay que seguir
  // vigilándolos). Solo se descuentan DOS cosas, por MARCA estructural, nunca por texto adivinado:
  //  · los límites de AUSENCIA (`lim._ausencia`, `_limiteDeAusencia` en componer.js): la frase fija «el Business
  //    Knowledge (benchmarks del sector) todavía no está construido: esta Entrega compara solo contra el
  //    benchmark que usted declaró» nombra «benchmark» para decir que NO hay uno del sector, no para afirmar una
  //    brecha propia — no es el caso que esta regla vigila.
  //  · las oraciones `_definicion` (defineConcept: EXPLICAN qué es «benchmark»/«brecha», contrato §1.1 — no
  //    afirman una, y `definicion` prohíbe cifras y marco).
  // Las 4 rutas fijas nunca marcan un límite `_ausencia` de forma distinta a como ya lo hacían (campo aditivo) ni
  // tienen respuesta `_definicion`: el cambio no las afecta — `_entrega_gate` sigue en 363/363.
  const _SIN_EXCLUSIONES = (() => {
    let t = String(texto || "");
    for (const lim of entrega.limites || []) { if (lim && lim._ausencia) t = t.split(`- **${lim.titulo}.** ${lim.motivo}`).join(""); }
    for (const r of entrega.respuesta || []) { if (r && r._definicion) t = t.split(`▸ ${r.texto}`).join(""); }
    return t;
  })();
  const _HABLA_DE_BRECHA = /\bbenchmark\b|\bbrecha\b/i.test(_SIN_EXCLUSIONES);
  if (_HABLA_DE_BRECHA && (!entrega.marco || !entrega.marco.referenciaDeclarada)) v("comparables-juntas", "el texto habla de benchmark/brecha y el marco no declara la referencia — una brecha sin su referencia no se sostiene sola");
  (entrega.respuesta || []).forEach((r, i) => {
    if (r._definicion) return;
    if (/benchmark|brecha/i.test(r.texto) && !_cifrasEnTexto(r.texto).length) v("comparables-juntas", `respuesta[${i}] habla de benchmark/brecha sin ninguna cifra en la misma oración: «${(r.texto || "").slice(0, 80)}»`);
  });

  // 5 · toda ausencia relevante es un límite con TÍTULO, redactado como hallazgo (nunca prohibición ni excusa)
  const _PROHIBICION = /\bprohibid[oa]\b|\bno se puede\b(?!\s+concluir)|\bno está permitido\b/i;
  (entrega.limites || []).forEach((lim, i) => {
    if (!lim.titulo || !lim.titulo.trim()) v("limite-sin-titulo", `limites[${i}] no trae título`);
    if (_PROHIBICION.test(lim.titulo || "")) v("limite-como-prohibicion", `limites[${i}] suena a prohibición, no a hallazgo: «${lim.titulo}»`);
  });

  // 6 · toda tentación precalculada — con más de una CUENTA (dueño distinto) en Cifras, el libro tiene que traer
  // al menos una `razon` o `derivada` (participación del primero, resto de una partición): la tentación de
  // calcular a mano queda precalculada, no dejada al anfitrión.
  // CORTE 3b (owner 2026-09-25): el conteo pasó de FILAS a DUEÑOS DISTINTOS (primera columna de cada fila — el
  // dueño, en TODAS las tablas de este archivo: «Cliente»/«SKU»/«Entidad / grupo»/…). Una Entrega general puede
  // traer varias filas de UN MISMO dueño (tres métricas de un solo cliente, sin ninguna tentación segura que
  // precalcular entre ellas por unidades incompatibles) sin que eso sea el defecto que esta regla vigila. Las 4
  // rutas fijas SIEMPRE tienen ≥2 dueños distintos cuando esta regla las alcanza (nunca declaran una fila de un
  // solo cliente sin comparación): el cambio no las afecta — ver `_entrega_gate.mjs`, sin tocar.
  if (libro) {
    // CORTE 3d (owner 2026-09-26) — la tabla de una simulación (garantía §2) declara "Negocio" como dueño de las
    // figs sin entidad propia (benchmark, montos agregados de todo el alcance) — no es una CUENTA que compita con
    // otra, es el agregado del universo; contarla como un segundo "dueño" frente a la única entidad pedida
    // dispararía esta regla sin que haya ninguna tentación real de comparar dos cuentas (D28: LG-DRYER8KG solo).
    const duenosEnJuego = new Set((entrega.cifras.filas || []).filter((f) => f.hechos && f.hechos.length).map((f) => Object.values(f.valores)[0]).filter((d) => d !== "Negocio"));
    if (duenosEnJuego.size > 1) {
      const hayTentacion = libro.hechos.some((h) => h.tipo === "razon" || h.tipo === "derivada");
      // RC5 (owner, diagnostico.md §RC5): esta regla solo miraba el libro del PEDIDO — pero el usuario puede
      // haber traído la MISMA comparación como PREMISA (`libroPremisas`, tipo "relacion", ej. «Sodimac saldo
      // vencido mayor que Easy»), que SÍ se imprime en el texto (`_textoDePremisa`, entrega/componer.js) aunque
      // el pedido en sí no calculó ninguna razón/derivada cruzada. Cuenta como tentación precalculada solo
      // cuando compara EXACTAMENTE los dos dueños en juego (mismo conjunto, ni más ni menos entidades) — nunca
      // una relación sobre otras cuentas que la parte no trae a Cifras.
      const duenosNorm = new Set([...duenosEnJuego].map((d) => normalizar(d)));
      const libroPremisas = entrega.procedencia && entrega.procedencia.libroPremisas;
      const hayRelacionDePremisa = !hayTentacion && libroPremisas && (libroPremisas.hechos || []).some((h) => h.tipo === "relacion" && h.entidades && h.entidades.size === duenosNorm.size && [...duenosNorm].every((d) => h.entidades.has(d)));
      if (!hayTentacion && !hayRelacionDePremisa) v("tentacion-no-precalculada", "hay más de una cuenta en juego y ningún hecho `razon`/`derivada` precalcula su relación");
    }
  }

  // 7 · ningún adjetivo evaluativo de la casa sobre una cifra
  const adj = _adjetivosEvaluativos(texto);
  if (adj) v("adjetivo-evaluativo", `la casa usa un juicio de valor («${adj}») que le corresponde al modelo, no a ADI`);

  // 10 (owner 2026-09-22, corregida el mismo día) · ningún texto de la Entrega usa voseo ni coloquialismos —
  // viaja sola, sin ADI al lado para reencuadrarla. El tuteo neutro SÍ es el registro del proyecto (CLAUDE.md)
  // y no se marca. Fuente única: voiceGuard.js (ver `_tuteoOColoquial` arriba).
  const registro = _tuteoOColoquial(texto);
  if (registro) v("registro-informal", `${registro.motivo}${registro.forma ? ` («${registro.forma}»)` : ""} — la Entrega va en tuteo neutro, sin voseo ni coloquialismos`);

  // 8 · tope de tamaño — CORTE 3d.3: por profundidad (350 breve / 900 completa, antes siempre 900)
  const _topePalabras = profundidad === "breve" ? TOPE_BREVE : TOPE_COMPLETA;
  const n = _PALABRAS(texto).length;
  if (n > _topePalabras) v("tope-de-tamano", `${n} palabras, sobre el tope de ${_topePalabras} (profundidad: ${profundidad})`);

  // 13 · CORTE 3d.3 (owner 2026-09-25/26) — tope de FILAS de Cifras por profundidad (8 breve / 24 completa): lo
  // recortado tiene que haber ido a `entrega.detalle.filas`, nunca simplemente faltar sin rastro — esta regla
  // solo vigila que la tabla SERVIDA respete el tope; que lo recortado esté en `detalle` lo prueba el gate
  // (`_tamano_gate.mjs`), no esta regla (que es puramente sobre lo impreso, como el resto de este archivo).
  const _topeFilas = profundidad === "breve" ? FILAS_BREVE_MAX : FILAS_COMPLETA_MAX;
  const _nFilas = (entrega.cifras && Array.isArray(entrega.cifras.filas)) ? entrega.cifras.filas.length : 0;
  if (_nFilas > _topeFilas) v("filas-sobre-el-tope", `${_nFilas} filas en Cifras, sobre el tope de ${_topeFilas} (profundidad: ${profundidad})`);

  // 11 · cobertura de dominios (TAREA 3, encargo multidominio) — solo si el llamador declara las partes pedidas
  if (Array.isArray(partes) && partes.length) {
    const faltantes = coberturaDelEncargo(texto, partes);
    if (faltantes.length) v("cobertura-de-dominios", `partes pedidas que la Entrega no cubre: ${faltantes.map((p) => p.nombre).join(" · ")}`);
  }

  // 12 · toda iniciativa citada verificó y quedó ubicada (corte 3d.1, owner 2026-09-25, `entrega/iniciativa.js`).
  // «Una señal nunca desaparece»: todo id `i*` que la Entrega declara SERVIDO (`entrega.iniciativa.ids`) tiene que
  // (a) verificar en su propio libro (`entrega.procedencia.libroIniciativa`) y (b) aparecer citado en Respuesta
  // (una oración marcada `solicitud:"iniciativa"`) o en la oferta (`entrega.iniciativa.ofertaIds`) — nunca
  // declarado como servido y ausente del texto. Es OPCIONAL: una Entrega sin `entrega.iniciativa` (las 4 rutas
  // fijas, que no importan `iniciativa.js`) no paga esta regla.
  if (entrega.iniciativa && Array.isArray(entrega.iniciativa.ids) && entrega.iniciativa.ids.length) {
    const libroIni = entrega.procedencia && entrega.procedencia.libroIniciativa;
    const citadosEnRespuesta = new Set();
    for (const r of entrega.respuesta || []) if (r.solicitud === "iniciativa") for (const id of r.hechos || []) citadosEnRespuesta.add(id);
    const enOferta = new Set(entrega.iniciativa.ofertaIds || []);
    for (const id of entrega.iniciativa.ids) {
      const h = libroIni && libroIni.porId.get(id);
      if (!h || !h.ok) { v("iniciativa-no-verificada", `el hecho de iniciativa ${id} está declarado como servido pero no verifica en su libro`); continue; }
      if (!citadosEnRespuesta.has(id) && !enOferta.has(id)) v("iniciativa-sin-ubicar", `el hecho de iniciativa ${id} verificó pero no aparece en Respuesta ni en la oferta — una señal no puede desaparecer`);
    }
  }

  // 14 · CORTE 3d (owner 2026-09-26) — DUEÑO DE LA SIMULACIÓN, por BLOQUE (ajuste del supervisor: el vínculo vive
  // en la ESTRUCTURA, no obliga a repetir entidad/escenario/supuesto en cada oración de la prosa). Tres chequeos:
  //   (a) todo BLOQUE (`entrega.respuesta[i]._bloqueId`) tiene un encabezado (`_bloqueEncabezado:true`) que
  //       declara `_bloqueMeta.{entidad,escenarioId,supuestoId}` completos — un bloque sin encabezado, o con el
  //       encabezado incompleto, arde.
  //   (b) toda oración marcada `_simulacion:true` pertenece a un bloque (`_bloqueId`) O declara explícitamente,
  //       en `_mezcla.{entidades,escenarios}`, los alcances que mezcla (comparar escenarios/entidades, citar una
  //       cifra de otro bloque) — nunca una oración de simulación suelta, sin bloque y sin declarar su mezcla.
  //   (c) toda fila de una tabla de simulación (columnas "Simulación"+"Supuesto" declaradas — la columna se
  //       llama "Simulación" en TODO texto emitido desde owner 2026-09-26, `_colapso_eje_gate` C4: el concepto
  //       visible «escenario» murió; el campo estructural `escenarioId` no cambia, no es texto) trae Entidad,
  //       Simulación y Supuesto — la fila es indivisible.
  {
    const bloques = new Map();
    for (const r of entrega.respuesta || []) {
      if (!r._bloqueId) continue;
      if (r._bloqueEncabezado) bloques.set(r._bloqueId, { meta: r._bloqueMeta || null, visto: true });
      else if (!bloques.has(r._bloqueId)) bloques.set(r._bloqueId, { meta: null, visto: false });
    }
    for (const [bid, b] of bloques) {
      if (!b.visto) { v("bloque-sin-encabezado", `el bloque "${bid}" no declara un encabezado (entidad · escenario · supuesto)`); continue; }
      const m = b.meta;
      if (!m || !m.entidad || !m.escenarioId || !m.supuestoId) v("bloque-sin-dueno", `el bloque "${bid}" no declara entidad/escenario/supuesto completos en su encabezado`);
    }
    (entrega.respuesta || []).forEach((r, i) => {
      if (!r._simulacion || r._bloqueId) return;
      const mezcla = r._mezcla;
      const declaraMezcla = mezcla && ((Array.isArray(mezcla.entidades) && mezcla.entidades.length) || (Array.isArray(mezcla.escenarios) && mezcla.escenarios.length));
      if (!declaraMezcla) v("oracion-simulacion-sin-alcance", `respuesta[${i}] es de una simulación pero no pertenece a un bloque ni declara los alcances que mezcla (\`_mezcla\`)`);
    });
    const colsSim = entrega.cifras && Array.isArray(entrega.cifras.columnas) ? entrega.cifras.columnas : [];
    if (colsSim.includes("Simulación") && colsSim.includes("Supuesto")) {
      (entrega.cifras.filas || []).forEach((f, i) => {
        const val = f.valores || {};
        if (!val.Entidad || !val["Simulación"] || !val.Supuesto) v("fila-simulacion-sin-dueno", `cifras.filas[${i}] no declara Entidad/Simulación/Supuesto completos`);
      });
      // (d) UNIVERSO — `entrega._simulacionUniverso` (componer.js:_planSimulacion, la unión de `parte.entidades`
      // de cada parte `simulacion` de ESTE encargo) declara qué entidades pidió el encargo; NUNCA se reusa el
      // parámetro `partes` de esta función (regla 11, cobertura de dominios) — es una forma de "parte" distinta
      // (`{nombre,cubre}` de `partesDelEncargo.js`, no `{entidades:[...]}` de `encargo/validar.js`), mezclarlas
      // sería la MISMA clase de "dos verdades" que este corte cierra en otro lado. «Negocio» (el agregado sin
      // entidad propia) nunca cuenta como fuera de universo. Opcional: una Entrega sin simulación no la paga.
      if (Array.isArray(entrega._simulacionUniverso) && entrega._simulacionUniverso.length) {
        const universoPedido = new Set(entrega._simulacionUniverso);
        if (universoPedido.size) {
          (entrega.cifras.filas || []).forEach((f, i) => {
            const ent = f.valores && f.valores.Entidad;
            if (ent && ent !== "Negocio" && !universoPedido.has(ent)) v("fila-fuera-de-universo", `cifras.filas[${i}] nombra a "${ent}", fuera del universo pedido (${[...universoPedido].join(", ")})`);
          });
        }
      }
      // (g) LÉXICO DE LA CASA (owner 2026-09-26, ronda final) — una fila cuyo rótulo (Métrica) es JERGA INTERNA
      // del motor (rótulos ya identificados como tales: no dicen nada al LLM, pueden inducirlo a error) nunca se
      // sirve. `componer.js:_planSimulacion` ya filtra proactivamente (mecanismo primario); esta es la red de
      // seguridad — una lista NEGATIVA de rótulos conocidos, no la lista positiva completa (esa es dinámica: los
      // pares base↔resultado cambian de nombre según el concepto de cada encargo).
      const _JERGA_INTERNA_SIM = /^(lectura relativa descartada|movimiento de carga|total)$/i;
      (entrega.cifras.filas || []).forEach((f, i) => {
        const met = f.valores && f.valores.Métrica;
        if (met && _JERGA_INTERNA_SIM.test(String(met).trim())) v("fila-jerga-interna", `cifras.filas[${i}] sirve un rótulo de jerga interna del motor: "${met}"`);
      });
    }

    // (e) el DELTA no mezcla ENTIDADES — el propio hecho `derivada` ya declara qué entidades involucran sus
    // operandos (`h.entidades`, notario/hechos.js: lo calcula el veredicto, no se re-deriva acá); más de una
    // entidad en un delta de simulación es la MISMA clase de error que motivó este corte (D27, 96 filas ajenas).
    if (libro) {
      (entrega.cifras.filas || []).forEach((f, i) => {
        if (f.escenarioId == null) return;
        for (const id of f.hechos || []) {
          const h = libro.porId.get(id);
          if (!h || h.tipo !== "derivada") continue;
          const ents = h.entidades ? [...h.entidades] : [];
          if (ents.length > 1) v("delta-entre-entidades-distintas", `cifras.filas[${i}] (delta) mezcla operandos de entidades distintas (${ents.join(" · ")})`);
        }
      });
    }
    // (f) el DELTA no mezcla ESCENARIOS — un MISMO id de hecho no puede pertenecer a filas de dos escenarios
    // distintos (sería un valor calculado bajo un supuesto compartido entre dos bloques que declararon supuestos
    // DISTINTOS). El motor de hoy corre un solo escenario por parte (nunca ocurre en el catálogo real); el
    // chequeo queda para cuando exista un motor de variantes múltiples — `_simulacion_dueno_gate.mjs` lo prueba
    // con una Entrega sintética.
    {
      const escenarioDeHecho = new Map();
      (entrega.cifras.filas || []).forEach((f) => {
        if (f.escenarioId == null) return;
        for (const id of f.hechos || []) {
          const previo = escenarioDeHecho.get(id);
          if (previo != null && previo !== f.escenarioId) v("delta-entre-escenarios-distintos", `el hecho "${id}" aparece en filas de escenarios distintos ("${previo}" · "${f.escenarioId}")`);
          else escenarioDeHecho.set(id, f.escenarioId);
        }
      });
    }
  }

  // 15 · CANDADO DE ALCANCE (diagnóstico v2, supervisor 2026-09-26, punto 2 de la decisión de arquitectura sobre
  // el patrón transversal R1/R2/RC-D/RC-F/RC-G — «el alcance declarado se pierde entre validación y composición»,
  // memoria `adi-cobertura-del-encargo`). LEY: toda entidad con CIFRA PROPIA en la tabla de Cifras pertenece al
  // alcance de ALGUNA parte del encargo, o está autorizada por una ley escrita. La autorización se lee de
  // `entrega.universos` (`entrega/componer.js:_declararUniverso`) — lo que CADA compositor YA declara (grupo,
  // grupoUniverso, entidad, comparación, la prioridad integrada del multitema) — nunca una lista nueva ni una
  // segunda lectura del encargo:
  //   · `entrega.universos[].entidades` autoriza, salvo un universo `soloRanking:true` (declara el DENOMINADOR
  //     del puesto de una conclusión —"5° de 13 clientes"—, nunca una lista de autorizados: si contara, el
  //     ranking completo de la cartera autorizaría a cualquiera de sus nombres a aparecer con cifra propia en
  //     cualquier parte de la Entrega);
  //   · la ruta fija `componerEntregaMultidominio` (columna "Dominio" en vez de la entidad en primer lugar) tiene
  //     su PROPIA declaración por líder (`${d}_lider`/`prioridad_integrada`) — se excluye del escaneo genérico
  //     solo porque su primera columna no es el dueño (es el dominio), no porque le falte autorización;
  //   · la tabla de una simulación (columnas "Simulación"+"Supuesto") ya tiene su propio candado, más específico
  //     (regla 14(d), contra `entrega._simulacionUniverso`) — se excluye acá para no duplicar ni contradecir esa
  //     lógica con una distinta.
  // Carnadas que esta regla cierra: una entidad EXCLUIDA que reaparece (R2); la cola de un top-N con cifra propia
  // (RC-D); una fig de OTRO eje colada en un ranking (RC-F); una entidad no pedida sustituyendo el alcance (R1).
  {
    const colsAlcance = (entrega.cifras && Array.isArray(entrega.cifras.columnas)) ? entrega.cifras.columnas : [];
    const esRutaMultidominio = colsAlcance.includes("Dominio");
    const esTablaSimulacion = colsAlcance.includes("Simulación") && colsAlcance.includes("Supuesto");
    if (entrega.cifras && !esRutaMultidominio && !esTablaSimulacion) {
      const universoDeclarado = new Set();
      for (const u of entrega.universos || []) {
        if (!u || u.soloRanking) continue;
        for (const e of u.entidades || []) if (e) universoDeclarado.add(normalizar(e));
      }
      (entrega.cifras.filas || []).forEach((f, i) => {
        const dueño = f && f.valores && Object.values(f.valores)[0];
        if (!dueño) return;
        const d = String(dueño);
        // ni una entidad: son los rótulos ESTRUCTURALES que este archivo ya reconoce en otras reglas ("Negocio",
        // el agregado de un top-N/grupo declarado "Total (…)", la fila sintética "A − B" de un `comparacion`, ya
        // cubierta por la autorización de A y B por separado).
        if (d === "Negocio" || d === "negocio" || /^total\b/i.test(d) || d.includes(" − ")) return;
        if (!universoDeclarado.has(normalizar(d))) v("alcance-fuera-de-parte", `cifras.filas[${i}] nombra a "${d}" con cifra propia, fuera del alcance que declara cualquier parte del encargo (\`entrega.universos\`)`);
      });
    }
  }

  // 16 · SIN DOCUMENTACIÓN INTERNA EN EL TEXTO (diagnóstico v3, supervisor 2026-09-26 — raíz R-SECCION-FILTRADA,
  // MATERIAL). Un `detalle` de `validar.js` llegó a citar la numeración de `_ADI_CONTRATO_ENCARGO_V1.md` («§7»,
  // «§7.1») dentro del texto que lee el usuario — una cita de sección no es vocabulario de negocio, es
  // documentación de implementación filtrada al Complemento. Se corrigieron los tres `detalle` que la citaban
  // (`validar.js`, motivos `origen_no_admitido` y `supuesto_mal_formado`), pero el candado va ACÁ, no solo en el
  // origen: cualquier «§» futuro en CUALQUIER texto servido (un `detalle` nuevo, una plantilla, un playbook) se
  // atrapa antes de llegar al usuario, sin depender de que nadie recuerde no escribirlo.
  if (/§/.test(texto)) v("documentacion-interna-en-texto", "el texto cita una numeración de sección interna («§») — eso es documentación de implementación, no vocabulario de negocio, y no puede llegar a la Entrega");

  return { ok: violaciones.length === 0, violaciones };
}
