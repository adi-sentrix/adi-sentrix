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
];

/* ── EL CATÁLOGO ESTÁTICO · «lo que este dato no tiene», sea cual sea el tenant ─────────────────────────────────
 * Los primeros once (`enPrompt: true`) son, en orden y en texto, los que traía `datoProyectado._HUECOS` (CLAUDE.md
 * §4 + los límites que los propios composers ya declaraban en pantalla) — MOVIDOS acá, no reescritos:
 * `datoProyectado.js` ahora arma `_HUECOS` filtrando por `enPrompt`, byte-idéntico (medido, ver el informe). */
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
  {
    id: "sin_fuente_sectorial", tipo: "conocimiento_no_construido", dominio: "general", enPrompt: true,
    texto: "fuente sectorial autorizada: NO hay — la única referencia es la del propio negocio (su benchmark declarado).",
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
    entrega: { titulo: "Sin conocimiento del sector cargado todavía", motivo: "El Business Knowledge (benchmarks del sector) todavía no está construido: esta Entrega compara solo contra el benchmark que usted declaró, no contra el sector." },
  },
  {
    id: "conocimiento_sector_cobranza", tipo: "conocimiento_no_construido", dominio: "cobranza",
    texto: "conocimiento del sector (plazos y mora habituales de la industria): NO construido.",
    entrega: { titulo: "Sin conocimiento del sector cargado todavía", motivo: "El Business Knowledge (referencias del sector sobre plazos y mora) todavía no está construido." },
  },
  {
    id: "conocimiento_sector_inventario", tipo: "conocimiento_no_construido", dominio: "inventario",
    texto: "conocimiento del sector (rotación e inventario habituales de la industria): NO construido — la única referencia disponible es el umbral de materialidad que declaró el cliente.",
    entrega: { titulo: "Sin conocimiento del sector cargado todavía", motivo: "El Business Knowledge (referencias del sector sobre rotación e inventario) todavía no está construido: esta Entrega compara solo contra el umbral de materialidad que tú declaraste, no contra el sector." },
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
