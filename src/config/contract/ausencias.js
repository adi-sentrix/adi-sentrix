/* === config/contract/ausencias.js · CONTRATO DE DATOS · LAS AUSENCIAS DEL DATO (owner 2026-09-23, Etapa 2 §2 del
 * plan `_ADI_LLMBUSINESS_PLAN.md` — «enriquecer el libro de hechos», TAREA 2) ═══════════════════════════════════
 *
 * LO QUE SE MIDIÓ ANTES DE ESCRIBIR ESTE ARCHIVO (owner: «medí antes de cambiar, mostrá la sonda»):
 *   · `src/adi/oracle/datoProyectado.js` (`_HUECOS`, líneas 92-109) YA tenía la lista de CLAUDE.md §4 — pero como
 *     un array de STRINGS sueltos, sin id, sin tipo, sin dominio: solo servía para imprimirse en el prompt del
 *     narrador (`for (const h of _HUECOS) L.push('- ' + h)`), nunca como dato que otro consumidor pudiera
 *     filtrar o reusar. Vivía en `oracle/` (una capa del motor), no en `config/contract/` (el contrato de datos).
 *   · `src/config/contract/surfaceContract.js` (`BLOCKED_CROSSES`) SÍ es estructurado —{cross, reason, offer}—
 *     pero acota solo los CRUCES de ejes sin granularidad atómica (marca×cliente, cliente×SKU), no las ausencias
 *     generales del dato (lead time, causa de la detención, meta de rotación, etc.).
 *   · Dos de los cinco tipos de ausencia que nombra el owner YA eran datos, no prosa, antes de esta tarea: «no
 *     reconcilia» vive en `figureType.js` (`reconcilian()`, `DIVERGENCIAS`/`COMPARABLES`) y «sin fecha de corte
 *     declarada» ya lo calcula `entrega/componer.js` (`_periodoDelMarco`, con `periodoDeFiguras()` del mismo
 *     contrato) — las cuatro rutas de la Entrega YA los declaran como límite dinámico, no a mano. Este archivo no
 *     los duplica: se apoya en ellos y agrega los TRES tipos que sí estaban solo en prosa («sin serie», «causa no
 *     medida», «no calculado») más el patrón que las cuatro rutas de la Entrega repetían byte-a-byte con
 *     variaciones («sin conocimiento del sector cargado todavía»).
 *
 * QUÉ DECLARA ESTE ARCHIVO: el CATÁLOGO — cada ausencia con `id` (identidad estable) · `tipo` (uno de
 * `TIPOS_DE_AUSENCIA`, abierto: no todo hueco del dato entra en las categorías que ya se vieron aparecer) ·
 * `dominio` (a qué parte del negocio aplica: "comercial" | "inventario" | "cobranza" | "general") · `texto` (la
 * frase para el prompt del narrador) · `enPrompt` (true si `datoProyectado._HUECOS` la imprime — las once que YA
 * imprimía antes de esta tarea, byte-idénticas; las nuevas NO se agregan ahí sin que el owner lo pida, para no
 * cambiar un prompt que hoy corre en producción) · `entrega` opcional ({ titulo, motivo }, la forma que exige
 * `entrega/esquema.js`: un hallazgo con título, nunca una prohibición ni una excusa — plan §1, regla 5 de
 * `verificar.js`).
 *
 * PURO · sin imports · sin lógica de negocio. Un dominio nuevo agrega una entrada más; nada de esto decide si
 * una ausencia APLICA a un turno — eso lo sigue decidiendo el composer que la usa (ver `ausenciasDe`/
 * `limitesDeAusencias` abajo, y `entrega/componer.js`). */

/* ÚNICA EXCEPCIÓN a «sin imports» (§7.3·36b, diagnóstico v12 raíz A8): el ORIGEN del umbral de materialidad depende del perfil de
 * la empresa, así que la frase que lo nombra lo pide al helper único de la procedencia en vez de escribirlo a mano. */
import { NOMBRE_DE_UMBRAL, procedenciaDeUmbral } from "../businessPolicy.js";

// Las categorías que YA se vieron aparecer en el dato — LISTA ABIERTA (owner, textual: «tipos de ausencia que ya
// viste aparecer»): no es una partición cerrada de todo lo que un dato puede no tener. `no_reconcilia` y
// `sin_fecha_corte` se declaran acá por completitud del vocabulario, aunque HOY esas dos ausencias las calculan
// `figureType.reconcilian()` y `entrega/componer.js:_periodoDelMarco()` — dinámicas, no de esta tabla estática.
export const TIPOS_DE_AUSENCIA = [
  "sin_serie",                  // no hay evolución en el tiempo de esa métrica (histórica o a futuro)
  "causa_no_medida",            // el dato localiza DÓNDE, nunca explica POR QUÉ
  "no_reconcilia",              // dos universos no se pueden sumar ni comparar directo (ver figureType.reconcilian)
  "no_calculado",               // el dato no trae lo necesario para calcularlo, ni existe un campo declarado
  "sin_fecha_corte",            // no hay una fecha de corte/cierre declarada para ese universo
  "conocimiento_no_construido", // la capa de Business Knowledge (Etapa 3 del plan) todavía no existe — no es un hueco del DATO, es un hueco del PRODUCTO
  // perfil_incompleto (Etapa 2 §4, owner 2026-09-23, plan §3 «cómo se pega al cliente»): DISTINTO de
  // `conocimiento_no_construido` — ese es un hueco del CATÁLOGO (no hay benchmarks del sector todavía, aunque
  // el cliente esté perfectamente identificado); este es un hueco de LA IDENTIDAD DEL CLIENTE (sector,
  // subsector, tamaño, país, modelo comercial) — el catálogo podría existir mañana y esta ausencia seguiría
  // aplicando si el cliente no declaró quién es. Las dos gatillan la misma ley («falla cerrado»), por razones
  // distintas — `config/contract/perfilCliente.js` es la fuente de este hueco, nunca se recalcula acá.
  "perfil_incompleto",
  // CORTE 3e (owner 2026-09-26, «la Entrega no le habla a nadie», REFINADO) — dos tipos MÁS, la misma lista
  // abierta de arriba (no una taxonomía nueva por caso): son las dos formas de hueco que la ley del owner nombra
  // TEXTUALMENTE para cruzarlas con `config/contract/dominios.js:funcion` y sugerir a quién consultar
  // (`entrega/preguntaAbierta.js`). `condicion_pactada` es distinta de `causa_no_medida`: no es que el dato no
  // mida una causa, es que el dato no trae un ACUERDO entre partes (plazo de pago, condición comercial) que solo
  // existe fuera del sistema. `decision_de_rumbo` es distinta de ambas: no es un hueco del dato de ESTE turno,
  // es que la respuesta depende de una decisión de dirección del negocio, no de una medición posible.
  "condicion_pactada",          // una condición pactada entre partes (plazo, cláusula) que el dato no registra
  "decision_de_rumbo",          // la respuesta depende de una decisión de dirección del negocio, no de una medición
];

/* ── EL CATÁLOGO ESTÁTICO · «lo que este dato no tiene», sea cual sea el tenant ─────────────────────────────────
 * Los primeros once (`enPrompt: true`) son, en orden y en texto, los que traía `datoProyectado._HUECOS` (CLAUDE.md
 * §4 + los límites que los propios composers ya declaraban en pantalla) — MOVIDOS acá, no reescritos:
 * `datoProyectado.js` ahora arma `_HUECOS` filtrando por `enPrompt`, byte-idéntico (medido, ver el informe). */
/* el umbral de materialidad con SU origen real, del helper único de la procedencia (businessPolicy.js) — «umbral de materialidad
 * (declarado por la empresa)» o «(criterio general de ADI, ajustable por la empresa)» */
const _umbralDeMaterialidad = () => `${NOMBRE_DE_UMBRAL.materialidadFocoPctVenta} (${procedenciaDeUmbral("materialidadFocoPctVenta")})`;

export const AUSENCIAS_DEL_DATO = [
  {
    id: "sin_historial_cliente_sku", tipo: "no_calculado", dominio: "inventario", enPrompt: true,
    texto: "historial de compra cliente×SKU: NO existe. La relación cliente×SKU disponible es una AFINIDAD ESTIMADA (sellada `indicado`), nunca una venta registrada — «quiénes dejaron de comprar» no es respondible.",
  },
  {
    id: "sin_entradas_recepciones", tipo: "no_calculado", dominio: "inventario", enPrompt: true,
    texto: "entradas y recepciones de inventario: NO existen — «entradas y salidas» no es dibujable ni narrable.",
  },
  {
    id: "sin_lead_time_proveedor", tipo: "no_calculado", dominio: "inventario", enPrompt: true,
    texto: "lead time de proveedor: NO existe — no se puede decir qué se quiebra antes de que llegue reposición.",
  },
  {
    id: "sin_estado_orden_compra", tipo: "no_calculado", dominio: "inventario", enPrompt: true,
    texto: "estado de órdenes de compra: NO existe.",
  },
  {
    // `entrega` NO declarado a propósito: `entrega/componer.js` ya arma este límite CON el nombre de la cuenta o
    // del SKU que corresponde a ese turno («la causa de que Falabella…», «…de cada SKU…») — un título genérico
    // acá sería MENOS específico que lo que ya sirve cada ruta, así que esta entrada queda para el prompt del
    // narrador (`texto`) y como identidad del TIPO (`causa_no_medida`), sin forzar una segunda redacción del límite.
    id: "causa_detencion_sku", tipo: "causa_no_medida", dominio: "inventario", enPrompt: true,
    texto: "causa de la detención de un SKU: NO está en el dato — se localiza dónde, no por qué.",
  },
  {
    id: "sin_meta_rotacion_familia", tipo: "no_calculado", dominio: "inventario", enPrompt: true,
    texto: "meta de rotación por familia: NO existe.",
  },
  {
    id: "sku_una_sola_bodega", tipo: "no_calculado", dominio: "inventario", enPrompt: true,
    texto: "ningún SKU está en más de una bodega — transferir stock entre bodegas NO es evaluable con este dato.",
  },
  {
    id: "sin_pronostico", tipo: "sin_serie", dominio: "general", enPrompt: true,
    texto: "serie a futuro / pronóstico: NO existe — solo la evolución hasta hoy.",
  },
  {
    id: "sin_resultado_mensual", tipo: "sin_serie", dominio: "comercial", enPrompt: true,
    texto: "resultado (después de gastos) POR MES: NO existe — los gastos son % sobre la venta anual.",
  },
  {
    id: "sin_meta_declarada", tipo: "no_calculado", dominio: "general", enPrompt: true,
    texto: "la META no existe en este dato: el benchmark lo declara el cliente y benchmark ≠ promedio ≠ meta.",
  },
  /* «caja ≠ cobranza» (owner 2026-09-24, ley ADI_CAJA_NO_ES_COBRANZA, textual: «En ADI, cobranza no es sinónimo
   * de tesorería, aunque pueda impactarla»): este dato no trae posición de caja ni movimientos de tesorería —
   * cuentas por cobrar informa la EXPOSICIÓN DE CRÉDITO por cliente, que es distinto. `enPrompt` NO se marca (no
   * es un límite general del dato como los de arriba: se declara puntualmente cuando el usuario pide priorizar
   * o leer por «caja»/«liquidez», ver `prioridadPorLente.js`). */
  {
    id: "sin_datos_tesoreria", tipo: "no_calculado", dominio: "cobranza",
    texto: "«caja» es tesorería: este dato no trae posición de caja ni movimientos de tesorería — no se puede priorizar ni leer por caja. Cuentas por cobrar informa la exposición de crédito por cliente (pendiente, vencido y su atraso): es la referencia disponible sobre crédito, no sobre caja.",
    entrega: { titulo: "Sin datos de tesorería", motivo: "Este dato no trae posición de caja ni movimientos de tesorería. Cuentas por cobrar informa la exposición de crédito por cliente, que es distinto." },
  },
  {
    id: "sin_fuente_sectorial", tipo: "conocimiento_no_construido", dominio: "general", enPrompt: true,
    texto: "fuente sectorial autorizada: NO hay — la única referencia es la del propio negocio (su benchmark declarado).",
  },
  /* CORTE 3d, revisión de calidad del supervisor (2026-09-25) — «toda Entrega que sirve cobranza declara que el
   * dato no trae la antigüedad del vencido por tramos, así que no se puede distinguir vencido documental de
   * disputa». Ya verificado en `piezas.js` (CAU-03): `cobranza.js` solo trae un saldo vencido TOTAL por cliente,
   * nunca por tramo de antigüedad ni fecha de vencimiento por documento — esto es una AUSENCIA del Core, no el
   * contenido (sin firmar) de CAU-03. `enPrompt` NO se marca (mismo criterio que el resto de las ausencias
   * agregadas después de las once originales: no se cambia el prompt de producción sin que el owner lo pida). */
  {
    id: "sin_antiguedad_vencido", tipo: "no_calculado", dominio: "cobranza",
    texto: "antigüedad del vencido por tramos: NO existe — solo un saldo vencido total por cliente, sin fecha de vencimiento por documento.",
    entrega: { titulo: "La antigüedad del vencido no está en los datos", motivo: "El dato trae un saldo vencido total por cliente, no el vencido por tramo de antigüedad: no se puede distinguir si es un documento en trámite (rechazo, retención, nota de crédito pendiente) o una disputa de cobranza real." },
  },

  /* ── «SIN CONOCIMIENTO DEL SECTOR CARGADO TODAVÍA» — LA MISMA ausencia, declarada UNA vez por dominio (antes
   * vivía repetida, con variaciones, en las cuatro rutas de `entrega/componer.js`). No es un hueco del DATO (el
   * archivo del cliente no tiene por qué traer benchmarks de la industria): es un hueco del PRODUCTO — la Etapa
   * 3 del plan (Business Knowledge) todavía no está construida — y por eso su tipo es `conocimiento_no_construido`,
   * no `no_calculado`. `enPrompt` NO se marca (el prompt del narrador ya tiene `sin_fuente_sectorial`, arriba, que
   * dice lo mismo en general — agregar estas cuatro ahí sería CAMBIAR un prompt que hoy corre en producción, y
   * esta tarea es aditiva al esquema, no una modificación de ADI sin autorización). Título idéntico en las cuatro
   * (ya lo era); el motivo sigue siendo específico por dominio porque cada Entrega compara contra una vara
   * distinta (benchmark de margen · plazos y mora · rotación e inventario). */
  {
    id: "conocimiento_sector_comercial", tipo: "conocimiento_no_construido", dominio: "comercial",
    texto: "conocimiento del sector (benchmarks de margen de la industria): NO construido — la única referencia disponible es el benchmark que declaró el cliente.",
    // CORTE 3e (owner 2026-09-26) — «usted declaró» → «la empresa declaró»: la Entrega va en tercera persona,
    // sin pronombres de trato (ley «LA ENTREGA NO LE HABLA A NADIE»). Mismo texto, mismo motivo, solo el trato.
    entrega: { titulo: "Sin conocimiento del sector cargado todavía", motivo: "El Business Knowledge (benchmarks del sector) todavía no está construido: esta Entrega compara solo contra el benchmark que la empresa declaró, no contra el sector." },
  },
  {
    id: "conocimiento_sector_cobranza", tipo: "conocimiento_no_construido", dominio: "cobranza",
    texto: "conocimiento del sector (plazos y mora habituales de la industria): NO construido.",
    entrega: { titulo: "Sin conocimiento del sector cargado todavía", motivo: "El Business Knowledge (referencias del sector sobre plazos y mora) todavía no está construido." },
  },
  {
    id: "conocimiento_sector_inventario", tipo: "conocimiento_no_construido", dominio: "inventario",
    /* RAÍZ A8 (supervisor 2026-09-29, diagnóstico v12; decisión del owner §7.3·32b/·36b — «ningún veredicto debe esconder de dónde
     * proviene su criterio»): antes decía «el umbral de materialidad que la empresa declaró» SIEMPRE, y en el demo ese umbral es
     * el criterio general de ADI (`umbral("materialidadFocoPctVenta").origen === "adi"`): un origen mal atribuido, peor que ninguno.
     * Ahora el ORIGEN sale del helper único de `businessPolicy.js` (`procedenciaDeUmbral`), el mismo del Marco de la Entrega,
     * y se lee al momento de pedir el texto (`get`): el catálogo no congela un origen que depende del perfil de la empresa. La
     * cláusula del umbral va separada de la del sector (`;`): una cláusula por cosa, cada una con lo suyo. */
    get texto() { return `conocimiento del sector (rotación e inventario habituales de la industria): NO construido — la única referencia disponible es el ${_umbralDeMaterialidad()}.`; },
    entrega: {
      titulo: "Sin conocimiento del sector cargado todavía",
      get motivo() { return `El Business Knowledge (referencias del sector sobre rotación e inventario) todavía no está construido; esta Entrega compara solo contra el ${_umbralDeMaterialidad()}, no contra el sector.`; },
    },
  },
  {
    id: "conocimiento_sector_general", tipo: "conocimiento_no_construido", dominio: "general",
    texto: "conocimiento del sector (referencias de la industria, cualquier dominio): NO construido.",
    entrega: { titulo: "Sin conocimiento del sector cargado todavía", motivo: "El Business Knowledge (referencias del sector) todavía no está construido: esta prioridad compara solo contra lo que cada dominio ya declara, no contra el sector." },
  },

  /* ── «SIN PERFIL COMPLETO DEL CLIENTE TODAVÍA» (Etapa 2 §4, owner 2026-09-23) — el título genérico que usan
   * las cuatro rutas de `entrega/componer.js` (`_limitePerfilIncompleto`). El MOTIVO específico (qué campos
   * faltan, para ESTE tenant) se arma dinámico en `componer.js`, igual que `faltaRango` — este catálogo solo
   * fija el título y la identidad del tipo. `enPrompt` NO se marca (mismo criterio que `conocimiento_sector_*`:
   * agregar esto al prompt del narrador de producción es una decisión aparte, no de esta tarea). */
  {
    id: "perfil_cliente_incompleto", tipo: "perfil_incompleto", dominio: "general",
    texto: "perfil del cliente (sector, tipo de producto, tamaño, país, modelo comercial): incompleto — sin él, el conocimiento del oficio no se aplica con seguridad, aunque el catálogo exista.",
    entrega: { titulo: "Sin perfil completo del cliente todavía", motivo: "Sector, tipo de producto, tamaño (banda), país y/o modelo comercial no están declarados ni se pueden derivar todavía." },
  },
];

/** ausenciasDe(dominios) → las ausencias del catálogo que aplican a uno o más dominios ("comercial", "inventario",
 *  "cobranza"), más las de dominio "general" (aplican siempre). `dominios` acepta un string o una lista. */
export function ausenciasDe(dominios) {
  const ds = new Set((Array.isArray(dominios) ? dominios : [dominios]).filter(Boolean));
  return AUSENCIAS_DEL_DATO.filter((a) => a.dominio === "general" || ds.has(a.dominio));
}

/** limitesDeAusencias(dominios) → [{ titulo, motivo, ausenciaId, tipo }] — SOLO las que traen forma de Entrega
 *  (`entrega`); las que no la traen no se imprimen como límite (viven para el prompt del narrador, con `texto`). */
export function limitesDeAusencias(dominios) {
  return ausenciasDe(dominios).filter((a) => a.entrega).map((a) => ({ titulo: a.entrega.titulo, motivo: a.entrega.motivo, ausenciaId: a.id, tipo: a.tipo }));
}

/** ausenciaPorId(id) → la entrada del catálogo, o null. */
export function ausenciaPorId(id) {
  return AUSENCIAS_DEL_DATO.find((a) => a.id === id) || null;
}

/* ── EL DATO AUSENTE POR ENTIDAD (§7.3·52b, owner 2026-10-01 · «el cero solo si el dato lo demuestra») ─────────────────────
 * Lo que la fuente no trae para una entidad NO es un cero: se dice «sin dato de X para Y» y se declara aparte. Es la ÚNICA forma nueva de la regla del cero;
 * su redacción vive ACÁ, una vez (la Entrega la lee; ningún composer la escribe a mano). `metrica` es el nombre de la casa (léxico) y `sujetos` las entidades. */
export const MOTIVO_SIN_DATO = "La lectura de este turno no publicó esa cifra para esas cuentas; no se rellena con otra.";   /* el motivo de siempre de la foto (v22, S31): una sola redacción */
export function textoSinDato(metrica, sujetos) {
  const xs = (Array.isArray(sujetos) ? sujetos : [sujetos]).map((s) => String(s)).filter(Boolean);
  const lista = xs.length > 1 ? `${xs.slice(0, -1).join(", ")} y ${xs[xs.length - 1]}` : String(xs[0] || "");
  return `sin dato de ${String(metrica).toLowerCase()} para ${lista}`;
}

/* ── UNA FIG SIN CLAVE EN EL LÉXICO SE DECLARA (§7.3·52e, consolidación F4) ─────────────────────────────────────────────────────────
 * Una cifra cuyo concepto el léxico de la casa no conoce no se imprime con el rótulo crudo del productor ni con el de otro concepto: se declara. Su redacción vive ACÁ, una vez
 * (la pieza `entrega/rotulos.js` la pide; ningún composer la escribe a mano). `sujetos` son las entidades de las que el productor la trajo. */
export const MOTIVO_FIG_SIN_CLAVE = "La cifra no tiene un concepto del léxico de la casa; no se imprime con un rótulo crudo ni con el de otro concepto.";
export function textoFigSinClave(sujetos) {
  const xs = (Array.isArray(sujetos) ? sujetos : [sujetos]).map((s) => String(s)).filter(Boolean);
  const lista = xs.length > 1 ? `${xs.slice(0, -1).join(", ")} y ${xs[xs.length - 1]}` : String(xs[0] || "");
  return `una cifra de ${lista} sin concepto en el léxico de la casa`;
}

/* ── UNA ORACIÓN QUE EL VERIFICADOR RECHAZA SE RETIRA Y SE DECLARA (§7.3·52e, consolidación F5) ───────────────────────────────────
 * Toda oración que compone la Entrega pasa `verificarEntrega` antes de servirse (§7.3·48d); la que no pasa se retira de la Entrega (nunca sale) y se declara como límite. Su redacción vive ACÁ, una vez
 * (`entrega/componer.js:servirConGarantia` la pide; ningún composer la escribe a mano). `sujetos` son las entidades de las que hablaba la oración retirada (vacío: «una oración de la Entrega»). */
export const MOTIVO_ORACION_RETIRADA = "Cada oración de la Entrega se verifica contra los hechos del turno antes de servirse; esta no se sostuvo y no se reemplaza por otra. Las cifras de las tablas siguen siendo las verificadas.";
export function textoOracionRetirada(sujetos) {
  const xs = (Array.isArray(sujetos) ? sujetos : [sujetos]).map((s) => String(s)).filter(Boolean);
  const lista = xs.length > 1 ? `${xs.slice(0, -1).join(", ")} y ${xs[xs.length - 1]}` : String(xs[0] || "");
  return `${lista ? `Una oración sobre ${lista}` : "Una oración de la Entrega"} no pasó la verificación y se retiró`;
}
