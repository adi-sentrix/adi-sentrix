/* === src/adi/encargo/lecturasDe.js · DEL ENCARGO A LAS LECTURAS DEL CORE (Etapa 1 · Corte 3a · owner 2026-09-25)
 * ══════════════════════════════════════════════════════════════════════════════════════════════════════════════
 * `_ADI_CONTRATO_ENCARGO_V1.md` es el contrato; `validar.js` produce la `Resolucion` (Corte 1). Este archivo hace
 * el paso siguiente: `lecturasDe(resolucion) → { plan, porParte }` — un PLAN determinístico de llamadas a las
 * tools del Core (`oracle/toolRegistry.js`, ejecutadas después con `oracle/toolRunner.js:runPlan`), por parte,
 * según (tema × cierre × conceptos × entidades × eje × universo × período × criterio × supuestos). QUÉ NO decide
 * este archivo: la CONCLUSIÓN (eso es de `prioridadIntegrada`/los composers/la Entrega, etapas siguientes) — acá
 * solo se decide QUÉ LECTURAS CORREN.
 *
 * LA LEY QUE OBEDECE (contrato §0, memoria `adi-no-desviarse-deterministico`): cero lectura de
 * `resolucion.encargo.preguntaOriginal`. Lo único que se lee del encargo crudo (`resolucion.encargo.partes`) son
 * los DOS campos estructurados que `validarEncargo` no reproyecta en `ParteResuelta` — `Parte.concepto` (el único
 * concepto de una `definicion`) y `Parte.supuestos` (los ids que una `simulacion` cita) — nunca `preguntaOriginal`
 * ni `Supuesto.cita`. Cero `cuandoAplica`: los disparadores léxicos de los playbooks (`agente/playbooks/registro.js`)
 * NO se usan acá — un playbook se activa por FRASE, y este archivo decide por FORMA (la `Resolucion` tipada).
 *
 * REUSA SIN COPIAR:
 *   · `agente/contratoComercial.js:pasosDelContratoComercial` — las cinco lecturas cuando el tema es comercial.
 *   · `agente/contratoDeDominios.js:pasosDeDominios` — YA recibe `{ dominios, eje }` objetos (nunca texto): es la
 *     pieza que este corte más aprovecha, porque ya compone comercial+inventario+cobranza sin leer una frase.
 *   · `agente/prioridadIntegrada.js` — NO se llama acá (opera sobre `figs` ya leídas, en la etapa de composición);
 *     el cierre `decision` corre las MISMAS lecturas que `lectura` para sus temas — es lo que `prioridadIntegrada`
 *     necesita para poder leer las señales después.
 *   · `oracle/toolRegistry.js:compareEntities` — el cierre `comparacion`.
 *   · `oracle/toolRegistry.js:simulate{General,Carga,Capital,Costo}` — el cierre `simulacion`, con el `productor`
 *     que ya resolvió `validar.js` (`Resolucion.supuestos[].productor`, contrato §3.5): este archivo NUNCA vuelve
 *     a decidir el productor, solo arma los args de la tool que `validar.js` ya nombró.
 *   · `agente/herramientasAgente.js:cobranza` (mesaFlujo) — el productor de cobranza en TODOS los cierres: no vive
 *     en `oracle/toolRegistry.js:TOOLS` (esa caja es la del oráculo puro); vive en la caja EXTENDIDA del agente
 *     (`cajaDelAgente`), la misma que ya usa `contratoDeDominios.js:_PASOS_COBRANZA`. `REGISTRO_LECTURAS` de acá
 *     es esa caja — hay que pasarla a `runPlan(plan, { registry: REGISTRO_LECTURAS })`, si no, `cobranza` sale
 *     "tool desconocida".
 *
 * LOS PLAYBOOKS DE `agente/playbooks/*` (margenEnRiesgo, etc.) NO se importan acá. Se investigó: sus `pasos` son
 * subconjuntos de lo que YA corre `pasosDelContratoComercial()` (margenEnRiesgo: marginRead(bajo_benchmark) +
 * diagnose() — las DOS primeras de las cinco del contrato comercial) o de `pasosDeDominios` (cobranza, lecturaPorEje)
 * — nada de lo que un playbook trae por FORMA (`pasosDe(playbook, pregunta)`, que hoy recibe la pregunta en TEXTO
 * para decidir el EJE de "lectura por eje") es necesario acá: el eje de una `Parte` YA es un campo tipado
 * (`ParteResuelta.eje`), así que la decisión que `pasosDe` tomaría leyendo la frase la toma acá leyendo el campo.
 * Si una etapa futura necesita un playbook que compone algo que ni `pasosDelContratoComercial` ni `pasosDeDominios`
 * cubren, la extensión pedida por el encargo es la de la cabecera del corte: una entrada NUEVA en ese playbook que
 * reciba la `Parte`/`Resolucion` en vez de `pregunta` — aditiva, sin tocar `pasos` (función de texto) que sigue
 * sirviendo al camino natural mientras exista. Hoy no hace falta: se deja escrito para la próxima vez que sí.
 *
 * PURO frente al ENCARGO (nunca lee `preguntaOriginal`/`.cita`) pero NO offline-puro frente al TENANT: como
 * `pasosDeDominios` (que ya lee `getTenantData()` para saber si el tenant trae inventario/cobranza/serie con
 * unidades), este archivo hereda esa dependencia — determinístico por tenant + versión de datos, igual que
 * `validarEncargo`. Nada de red, nada de LLM, nada de Math.random ni Date.now().
 *
 * `lecturasDe(resolucion) → { plan: { intent, calls: [{tool,args}] }, porParte: { [parteId]: [{tool,args,para}] } }`
 *   `plan` es lo que se le pasa a `runPlan` (con `registry: REGISTRO_LECTURAS`, más abajo). `porParte` es la traza:
 *   qué llamadas sirven a qué parte (las de `lectura`/`decision` se ATRIBUYEN por tool → tema, `_temaDeCall`, best
 *   effort de trazabilidad — no es una segunda validación de negocio, ver su comentario). */
import { TOOLS } from "../oracle/toolRegistry.js";
import { cajaDelAgente } from "../agente/herramientasAgente.js";
/* `pasosDelContratoComercial` NO se importa directo: `pasosDeDominios` (abajo) ya la llama por dentro cuando el
 * tema comercial participa sin eje explícito — importarla acá sería una segunda invocación que nadie usa. */
import { pasosDeDominios } from "../agente/contratoDeDominios.js";
import { sujetoDeTema, metricaCoreDe, productorDe, universoTieneRestriccionPropia } from "./esquema.js";
import { dominioPorId } from "../../config/contract/dominios.js";
import { dominioDeClave, polaridadDeClave, unidadDeClave } from "../notario/lexico.js";
import { resolveEntityRef } from "../oracle/entityIndex.js";
import { umbral } from "../../config/businessPolicy.js";
import { estadoDeclarado } from "../notario/estados.js";

/* LA CAJA EXTENDIDA (owner 2026-08-30, F2 · ADI Agente): `cobranza` y `rolesCartera` —las dos que
 * `pasosDelContratoComercial`/`pasosDeDominios` ya citan por nombre— viven en `cajaDelAgente`, no en `TOOLS` del
 * oráculo puro. Se exporta para que el LLAMADOR (el gate, y más adelante `entrega/componer.js`) pase SIEMPRE este
 * registro a `runPlan`, nunca `TOOLS` a secas — si no, esas dos tools salen "desconocida" y el plan degrada honesto
 * pero incompleto. */
export const REGISTRO_LECTURAS = cajaDelAgente(TOOLS);

/* ── «FRENADO» SIN UMBRAL: la misma prueba para la LECTURA (que pide los días sin venta) y la ENTREGA (que declara el límite) ── */
/* EL UMBRAL DE VENTA FRENADA PLANTEADO EN LA CONSULTA (owner 2026-09-29, etapa 6, §7.3·35): `criterio.referencia` con
 * `concepto:"umbral_frenado"` (días) lo trae el encargo TIPADO — nunca un regex sobre la pregunta. Devuelve los umbrales
 * de la consulta en la forma que `umbral()` entiende (`{ frenadoDiasSinVenta }`) o null. Mismo patrón de §7.3·12/·19:
 * la referencia de la EMPRESA manda — si la empresa ya declaró su umbral, el de la consulta NO reemplaza el veredicto
 * oficial (queda declarado aparte por `_REFERENCIA_FAMILIAS`); solo cuando la empresa no lo declaró, el de la consulta
 * es el que sostiene el veredicto «frenado» de ESTA respuesta, con origen «planteado en la consulta». */
export function consultaDeFrenado(resolucion) {
  const r = resolucion && resolucion.criterio && resolucion.criterio.referencia;
  if (!r || r.concepto !== "umbral_frenado" || !Number.isFinite(r.valor) || r.valor < 0) return null;
  if (r.unidad !== unidadDeClave("umbral_frenado")) return null;   // días, no otra magnitud: la unidad la fija el léxico
  if (umbral("frenadoDiasSinVenta").valor != null) return null;    // la empresa ya lo declaró: manda la oficial
  return { frenadoDiasSinVenta: r.valor };
}
/* EL UNIVERSO «FRENADO» SIN UMBRAL (owner 2026-09-29, §7.3·29 y ·32a): un universo que nombra el estado «frenado» (en
 * `estados`, `no_estados`, `base`, una rama de `union` o `excluir.estados`) no se puede resolver mientras no haya umbral
 * — ni el que declaró la empresa ni el que planteó la consulta (`criterio.referencia{umbral_frenado}`, `_consultaDeFrenado`).
 * No es un error técnico ni «no hay frenados»: es un límite de negocio. Los estados se leen por su CANON
 * (`estadoDeclarado`, notario/estados.js), nunca por el texto del motivo del error. */
export function estadosDeUniverso(u, acc = new Set()) {
  if (!u || typeof u !== "object") return acc;
  const lista = (x) => (Array.isArray(x) ? x : x != null ? [x] : []);
  for (const e of [...lista(u.estados), ...lista(u.no_estados), ...(u.base != null ? [u.base] : []), ...(u.excluir && typeof u.excluir === "object" ? lista(u.excluir.estados) : [])]) { const c = estadoDeclarado(e); if (c) acc.add(c); }
  for (const v of lista(u.union)) estadosDeUniverso(v, acc);
  return acc;
}
export const frenadoSinUmbral = (u, resolucion) => estadosDeUniverso(u).has("frenado") && umbral("frenadoDiasSinVenta").valor == null && !consultaDeFrenado(resolucion);

/* ── conceptos SIN fuente declarativa en `metricRegistry.js` (contrato §3.3, la tabla residual de `esquema.js`):
 * cada familia tiene UN productor fijo, sea cual sea el eje que le llegue (el eje lo filtra `validar.js` — acá ya
 * llegó validado). El orden de estas listas es el de la tabla del contrato, no arbitrario. ─────────────────────── */
const _FAM_DIAGNOSE = new Set(["no_capturada", "carga_alta", "brecha", "brecha_precio_costo"]);
const _FAM_CAPITAL_FRENADO = new Set(["capital_frenado", "margen_inventario"]);
/* `dias_sin_venta` (owner 2026-09-29, cierre del inventario): antes vivía en `_FAM_CAPITAL_FRENADO` y leía el foco `frenado`
 * — SOLO los SKU del tramo crítico (3 de 13): «los 5 con más días sin venta» servía 3 filas y el «menor» no tenía ni
 * productor. Familia propia: el foco `dias_sin_venta` (specRetrieval.js) trae TODOS los SKU con sus días, desde la MISMA
 * fuente que la vista «Días sin venta» de la cara Capital (`jerarquiaInventario().porSku`), tipados como hecho histórico.
 * Lo pide SOLO esta lectura del encargo: el foco no está en el catálogo del agente, su boleta queda byte-idéntica. */
const _FAM_DIAS_SIN_VENTA = new Set(["dias_sin_venta"]);
const _CALL_DIAS_SIN_VENTA = (para) => ({ tool: "inventoryStatus", args: { focus: "dias_sin_venta" }, para });
/* `capital_inmovilizado` (owner 2026-09-28, §7.3·30-34, etapa 5): antes vivía en `_FAM_CAPITAL_FRENADO` y leía
 * `inventoryStatus({focus:"frenado"})` — el foco CRÍTICO (capital_frenado, ⊆ inmovilizado), nunca el universo ∪
 * que el concepto nombra. Familia propia: lee el foco `inmovilizado` (etapa 4, specRetrieval.js:1174) — todos los
 * SKU del universo (crítico ⊎ sobrestock), cada uno con su cifra. */
const _FAM_CAPITAL_INMOVILIZADO = new Set(["capital_inmovilizado"]);
/* markup/peso_costo NO tienen familia acá (corrección del contraste, `esquema.js:_PRODUCTOR_RESIDUAL`, con
 * evidencia): `specRetrieval.js` calcula esos dos valores pero nunca los publica como `fig()` — ni `marginRead`
 * ni `entityRecord` traen una cifra autorizada que citar. `ejesConProductor("markup"|"peso_costo") === []` en
 * TODOS los ejes, así que `validar.js` ya nunca deja esas claves en `ParteResuelta.conceptos` — este archivo no
 * necesita una rama que jamás se alcanza. Si `specRetrieval.js` llega a publicar el fig, la corrección es la
 * inversa: reabrir la fila en `esquema.js` y agregar la familia acá. */
const _FAM_VS_ANTERIOR = new Set(["variacion", "variacion_usd", "ventas_anterior"]);
const _FAM_VS_PRESUPUESTO = new Set(["vs_presupuesto", "vs_presupuesto_usd"]);
const _FAM_COBRANZA = new Set(["venta_credito", "saldo_vencido", "saldo_pendiente", "saldo_por_vencer", "abonado", "recuperado", "dias_vencido"]);
/* CORTE 3d, revisión de calidad del supervisor (2026-09-25, evidencia con crudo real) — `markup` SÍ tiene
 * productor: `agente/herramientasAgente.js:rolesCartera()` publica "{cliente} · Markup sobre costo" con `raw`
 * real, client-only, sin `dimension` (es una lectura de CARTERA, no un group-by con eje — mismo patrón que
 * `_FAM_DIAGNOSE`/`_FAM_CAPITAL_FRENADO`/`_FAM_COBRANZA` de abajo: la tool ignora el eje pedido porque su ruteo
 * es siempre el mismo). Cobertura PARCIAL (cuentas "que caen" + sanos de una huella, no toda la cartera) — el
 * mismo tipo de cobertura que ya tienen `no_capturada`/`carga_alta` (vía diagnose). `peso_costo` NO entra acá:
 * no tiene un `fig()` propio autorizado por ningún playbook (ver la nota de `esquema.js:_PRODUCTOR_RESIDUAL`),
 * viaja solo por el auto-walk de facts — reportado al supervisor, no cableado como productor de un concepto. */
const _FAM_MARKUP = new Set(["markup"]);

/* ¿esta parte declara una restricción PROPIA de universo? La prueba es UNA sola, compartida con `entrega/componer.js` y
 * `entrega/verificar.js` (regla 18, §7.3·17 y ·39d): vive en `encargo/esquema.js` (la forma del encargo, sin evidencia
 * del turno; esta capa ya la importa) — antes eran tres copias que se desalineaban. */
const _tieneUniversoPropio = universoTieneRestriccionPropia;

/* la PRIMERA parte de COBRANZA con universo propio (o, si ninguna, la de otro dominio del grupo, V81) le pasa su universo COMPLETO a las llamadas de `cobranza` que aún no lo llevan: `herramientasAgente.js:cobranza`
 * ensancha la mesa al conjunto entero solo cuando lo recibe (opt-in del Encargo; la boleta del agente vivo no lo manda y queda byte-idéntica). Se aplica DESPUÉS de agregar las llamadas por concepto (§7.3·39, A7):
 * una llamada que pide «Saldo por vencer» sin él solo traía el top 8 fijo y las demás cuentas del conjunto se servían sin la cifra pedida. */
function _conUniversoRequerido(calls, partes) {
  const parteConUniverso = partes.find((p) => p.tema === "cobranza" && _tieneUniversoPropio(p.universo))
    || partes.find((p) => _tieneUniversoPropio(p.universo));
  if (!parteConUniverso) return calls;
  return calls.map((c) => (c.tool === "cobranza" && !(c.args && c.args.universoRequerido) ? { ...c, args: { ...c.args, universoRequerido: parteConUniverso.universo } } : c));
}

/** los nombres (resueltos, únicos, en orden) de las entidades tipadas de una parte. */
function _nombresDeEntidades(entidades) {
  return [...new Set((Array.isArray(entidades) ? entidades : []).map((e) => e && e.nombre).filter((n) => typeof n === "string" && n))];
}

/** la llamada (o llamadas) que sirve UN concepto por UN eje, group-by, sin entidad puntual (contrato §3.3). */
function _callsDeConceptoEje(tema, concepto, eje) {
  if (tema === "cobranza" || _FAM_COBRANZA.has(concepto)) {
    return [{ tool: "cobranza", args: { figsPorVencer: true }, para: `${concepto} de la cartera de cobranza (mesaFlujo, la misma mesa que la pestaña)` }];
  }
  if (_FAM_DIAGNOSE.has(concepto)) {
    return [{ tool: "diagnose", args: {}, para: `${concepto} — el detector de brecha comercial, por cliente (contrato §3.3)` }];
  }
  if (_FAM_CAPITAL_INMOVILIZADO.has(concepto)) {
    return [{ tool: "inventoryStatus", args: { focus: "inmovilizado" }, para: `${concepto} — capital inmovilizado (crítico ⊎ sobrestock), todos los SKU con su cifra (mesaCapital)` }];
  }
  if (_FAM_DIAS_SIN_VENTA.has(concepto)) {
    return [_CALL_DIAS_SIN_VENTA(`${concepto} — los días sin venta de TODOS los SKU, un hecho histórico (mesaCapital, la vista «Días sin venta»)`)];
  }
  if (_FAM_CAPITAL_FRENADO.has(concepto)) {
    return [{ tool: "inventoryStatus", args: { focus: "frenado" }, para: `${concepto} — capital inmovilizado crítico por ${eje} (mesaCapital)` }];
  }
  if (_FAM_VS_ANTERIOR.has(concepto)) {
    // R-VARIACION-SIN-CIFRA-EN-TOP (diagnóstico v6, owner 2026-09-26): `figsPct:true` — SOLO acá, la lectura del
    // Encargo — hace que `salesRead` publique la fig de % por entidad («… · Variación vs año anterior», clave
    // `variacion`), la misma que un `universo.top.metrica:"variacion"` necesita citar en la tabla. Apagado en
    // cualquier otro llamador (la caja del agente en vivo, `cajaDelAgente`): su boleta queda byte-idéntica.
    return [{ tool: "salesRead", args: { focus: "vs_anterior", dimension: eje, figsPct: true }, para: `${concepto} por ${eje} (salesRead vs_anterior)` }];
  }
  if (_FAM_VS_PRESUPUESTO.has(concepto)) {
    return [{ tool: "salesRead", args: { focus: "vs_presupuesto", dimension: eje }, para: `${concepto} por ${eje} (salesRead vs_presupuesto)` }];
  }
  if (_FAM_MARKUP.has(concepto)) {
    return [{ tool: "rolesCartera", args: {}, para: `${concepto} — el papel de cada cuenta y su markup sobre costo, por cliente (contrato §3.3)` }];
  }
  const metrica = metricaCoreDe(concepto) || concepto;
  return [{ tool: "queryMetric", args: { metric: metrica, dimension: eje }, para: `${concepto} por ${eje} (METRICS.${metrica})` }];
}

/* R-DIRECCION-PEOR-MEJOR (supervisor 2026-09-26, segunda vuelta) — `direccion` de `universo.top` acepta CUATRO
 * valores (contrato §2, `hechos.js:_ENUM.direccion`: mayor · menor · peor · mejor), pero acá solo se traducía
 * "menor" a `asc` — "peor"/"mejor" (y hasta "mayor" mal escrito) caían todos al `else` como si fueran "mayor",
 * sin mirar la POLARIDAD de la métrica: para «margen», peor es MENOR; para «saldo vencido», peor es MAYOR — la
 * MISMA resolución que ya usa el Notario para el mismo campo (`notario/verificar.js:_topTipado`, líneas ~540-545)
 * contra `polaridadDeClave` (notario/lexico.js, la fuente única — nunca una segunda tabla de polaridad acá).
 * `direccion:"peor"/"mejor"` sobre una métrica SIN polaridad declarada no se puede resolver acá (esta función no
 * tiene la evidencia que el Notario sí tiene para declarar el error): se sirve el default de siempre (`desc`,
 * como "mayor"), documentado — la defensa en profundidad de `entrega/componer.js:_entidadesDelTopVerificado` lo
 * corrige de todos modos cuando hay `indice` a mano, porque esa sí resuelve contra la polaridad real. */
function _dirAscDesc(direccionPalabra) { return direccionPalabra === "menor" ? "asc" : "desc"; }
function _direccionDeTop(direccion, metrica) {
  const dir = String(direccion || "mayor").toLowerCase();
  if (dir === "peor" || dir === "mejor") {
    const pol = polaridadDeClave(metrica);
    const peorEs = pol === "mayor" ? "menor" : pol === "menor" ? "mayor" : null;
    if (peorEs) return _dirAscDesc(dir === "peor" ? peorEs : (peorEs === "mayor" ? "menor" : "mayor"));
  }
  return _dirAscDesc(dir === "menor" ? "menor" : "mayor");
}
/* ── cierre `cifra` (contrato §1.1: productor `queryMetric / entityRecord / gridTable / mesaFlujo / mesaCapital`) */
function _pasosCifra(p) {
  const eje = p.eje;
  if (p.tema === "cobranza") {
    // mesaFlujo es SIEMPRE por cliente (contrato §3.3): una entidad puntual o la cartera entera pasan por la
    // MISMA tool — la fila de un cliente puntual la recorta la Entrega, no una segunda llamada.
    const quien = p.entidades.length ? p.entidades.map((e) => e.nombre).join(", ") : "la cartera";
    // R-COBRANZA-TOP8-SIN-COLA-MENOR (diagnóstico v6, ALTA): `cobranza()` recorta su boleta a un TOP 8 fijo
    // (vencido primero, después saldo — siempre el extremo MAYOR); un `universo.top.direccion:"menor"` («los 3
    // de MENOR saldo pendiente») cae fuera de ese recorte y no hay forma de traerlo sin leer texto. Se pasa el
    // universo YA RESUELTO de la parte (nunca `preguntaOriginal`) para que la tool complete la cola desde la
    // MISMA mesa completa que ya usa — ver `herramientasAgente.js:cobranza`.
    const universoRequerido = p.universo && typeof p.universo === "object" && !Array.isArray(p.universo) ? p.universo : null;
    // RAÍZ A1 (supervisor 2026-09-29, diagnóstico v13, Z78) — la cuenta que la parte NOMBRA (su `entidades`, tipada) tiene
    // que traerse aunque quede fuera del top 8 fijo de `cobranza()` (una cuenta al día y chica —Hites, Jumbo, Ripley— nunca
    // entra ahí): sin su fig, `entrega/componer.js:_planCifraEntidad` no tenía qué servir y la parte se perdía. Se pasa
    // por el mismo opt-in del Encargo que `universoRequerido` (el turno libre del agente nunca lo manda: su boleta no cambia).
    const entidadesRequeridas = _nombresDeEntidades(p.entidades);
    const argsCobranza = universoRequerido ? { universoRequerido, figsPorVencer: true } : { figsPorVencer: true };
    if (entidadesRequeridas.length) argsCobranza.entidadesRequeridas = entidadesRequeridas;
    const out = [{ tool: "cobranza", args: argsCobranza, para: `cobranza de ${quien} (mesaFlujo)` }];
    // §7.3·13 (diagnóstico v7) — `universo.top` puede ordenar por una métrica AJENA a cobranza («ventas», para
    // «los clientes de menor venta que están en mora»): `mesaFlujo` solo publica `venta_credito` («Venta
    // (flujo)», la venta A CRÉDITO — `adi-caja-no-es-cobranza` — nunca la venta total), así que no basta con
    // pedir la mesa completa — hay que pedir esa métrica aparte, por el eje ENTERO (nunca `limit`: el conjunto lo
    // decide el compositor contra el universo completo, `entrega/componer.js`, no la tool).
    const topMetrica = p.universo && p.universo.top && p.universo.top.metrica;
    if (topMetrica && !_FAM_COBRANZA.has(topMetrica)) {
      out.push(..._FAM_VS_ANTERIOR.has(topMetrica)
        ? [{ tool: "salesRead", args: { focus: "vs_anterior", dimension: eje, figsPct: true }, para: `${topMetrica} por ${eje} (universo.top de una parte de cobranza, salesRead vs_anterior)` }]
        : [{ tool: "queryMetric", args: { metric: metricaCoreDe(topMetrica) || topMetrica, dimension: eje }, para: `${topMetrica} por ${eje} (universo.top de una parte de cobranza)` }]);
    }
    return _dedupeCalls(out);
  }
  if (p.entidades.length) {
    // LA FILA COMPLETA de cada entidad (entityRecord: "TODAS sus columnas reales del dato") — cubre de sobra
    // cualquier concepto puntual de comercial/inventario que la parte haya pedido, sin adivinar cuál.
    // RC12 (owner, diagnostico.md §RC12 — MATERIAL, el contrato §3.4 ejemplifica comparar bodegas): `entityRecord`
    // SOLO tiene fuente para sku/cliente/marca/familia (`entityRecord.js:_sources`, `default: return null`) — una
    // entidad de eje bodega/canal SIEMPRE fallaba ahí, aunque `productorDe(concepto, eje)` sea `true` (el camino
    // de listado/group-by SÍ la sirve). Esas entidades van por el MISMO camino que un `cifra` sin entidades
    // (group-by de `queryMetric`/etc. por ese eje, SIN filtro de entidad — un filtro `{bodega: nombre}` redirige
    // a `entityRecord` otra vez, `toolRegistry.js:queryMetric` líneas 230-232): el compositor
    // (`_planCifraEntidad`, componer.js) ya filtra las figs resultantes por `entidad === nombre`, así que no hace
    // falta una segunda ruta de composición — solo la llamada correcta, por CONCEPTO PEDIDO (sin `conceptos`
    // declarados no hay «fila completa» posible en este camino: nada que listar).
    const out = [];
    for (const e of p.entidades) {
      // RC-G (diagnóstico v2, supervisor 2026-09-26 — MATERIAL, misma familia que RC12 del diagnóstico v1):
      // `entityRecord.js:_sources` SOLO tiene fuente comercial para los ejes "marca"/"familia" (marcasMargen/
      // marcasVentas, sfamiliasMargen/sfamiliasVentas) — una entidad de esos dos ejes para un TEMA que no es
      // comercial (inventario: capital por marca/familia SÍ existe, contrato §3.3) siempre fallaba ahí, aunque
      // `productorDe(concepto, eje)` sea `true`. RC12 ya resolvió el mismo defecto para bodega/canal (ningún eje
      // de esos dos tiene fuente en `entityRecord` para NINGÚN tema); acá se generaliza la MISMA regla — no es un
      // caso por eje, es "cuando `entityRecord` no sirve este (tema, eje), usar el listado/group-by que sí lo
      // sirve, filtrado a la entidad por el compositor" — a marca/familia cuando el tema no es comercial (el
      // único caso, hoy, en que `entityRecord` SÍ tiene fuente para esos dos ejes).
      const sinFuenteEnEntityRecord = e.eje === "bodega" || e.eje === "canal"
        || ((e.eje === "marca" || e.eje === "familia") && p.tema !== "comercial");
      if (sinFuenteEnEntityRecord) {
        for (const c of (p.conceptos || [])) out.push(..._callsDeConceptoEje(p.tema, c, e.eje));
        continue;
      }
      out.push({ tool: "entityRecord", args: { dimension: e.eje, entity: e.nombre }, para: `la fila completa de ${e.nombre} (entityRecord)` });
    }
    return _dedupeCalls(out);
  }
  if (p.universo && p.universo.top && p.universo.top.metrica) {
    const { metrica, k, direccion } = p.universo.top;
    const ejeUniverso = p.universo.eje || eje;
    // R-SORT-DIRECCION-IGNORADA (supervisor 2026-09-26, MATERIAL, ESTRUCTURAL, la más grave de la ronda: «los 3
    // más chicos» servía los 3 más grandes) — `specRetrieval.js:composeSpecRetrieval` lee `sort.dir` (un OBJETO,
    // `{dir:"asc"|"desc"}`: así lo mandan TODOS los demás llamadores, `answerADIFromSpec.js`/`coerceChain.js`).
    // Acá se mandaba un STRING a secas (`"asc"`/`"desc"`): `sort.dir` sobre un string es SIEMPRE `undefined`, así
    // que `dir` caía SIEMPRE a `"desc"` sin importar `direccion` — un top «menor» servía el extremo opuesto,
    // siempre, en silencio. Se manda la FORMA que el productor espera, nunca texto.
    // R-VARIACION-SIN-CIFRA-EN-TOP (diagnóstico v6, owner 2026-09-26) — `metrica` de la familia `_FAM_VS_ANTERIOR`
    // («variacion», el %) no tiene fuente declarativa en `METRICS` (`metricaCoreDe` no la resuelve): `queryMetric`
    // caía a `composeSpecRetrieval({metric:"variacion",...})`, que no conoce esa clave y no publica NADA — la
    // selección del top-k igual salía bien (se corrige después contra `I.rankings`, en `entrega/componer.js`),
    // pero la Entrega nunca tenía una fig de % que citar. Para esta familia se pide `salesRead` en su lugar —
    // la MISMA función del Core que arma el ranking de `variacion` (`variacionDeFilas`, `specRetrieval.js`) — con
    // `figsPct:true` para que publique la fig de % por entidad. Sin `sort`/`limit` propios (salesRead trae TODAS
    // las entidades): no hace falta, la selección del top-k la sigue haciendo `entrega/componer.js` contra el
    // universo resuelto, nunca el orden en que la tool devolvió las filas.
    // §7.3·13 (diagnóstico v7, decisión 2026-09-27) — «un ranking parcial es un problema de LECTURA, no de
    // verificación»: cuando `top` viaja COMBINADO con `base`/`estados`/`no_estados`/`filtros`/`bodega` (necesita
    // el conjunto EXACTO, no solo el extremo) o mira el eje ENTERO (`top.sobre:"eje"`), el Core SÍ tiene la
    // métrica para todo el eje — la lectura tiene que TRAER el ranking COMPLETO, sin `limit`, para que el
    // compositor (`_planCifraGrupo`/`_entidadesDelTopVerificado`, `entrega/componer.js`) resuelva el conjunto
    // EXACTO contra figs reales, en vez de adivinar con solo `k` filas (esas `k` pueden no ser, ni de lejos, las
    // que además cumplen el resto del universo).
    // §7.3·38 (diagnóstico v14, A1) — y un top SIMPLE tampoco lleva `limit:k`: `datoProyectado` publica ranking
    // completo solo para algunos ejes (cliente, marca, sku, bodega) y solo de algunas métricas; para el resto
    // (familia, canal…) la boleta del turno ES la evidencia, y con `limit:k` llega PARCIAL (2 de 4 familias): el
    // Notario declina `ranking-parcial` y la parte queda sin evidencia, o peor, un conteo sale «2 de 4» siendo 3.
    // La lectura trae el eje completo (evidencia completa) y la selección del top la sigue haciendo la Entrega.
    const universoCombinado = !!(p.universo.base || p.universo.bodega
      || (Array.isArray(p.universo.estados) && p.universo.estados.length)
      || (Array.isArray(p.universo.no_estados) && p.universo.no_estados.length)
      || (Array.isArray(p.universo.filtros) && p.universo.filtros.length));
    const necesitaEjeCompleto = universoCombinado || String(p.universo.top.sobre || "").trim().toLowerCase() === "eje";
    const argsQueryMetric = { metric: metricaCoreDe(metrica) || metrica, dimension: ejeUniverso, sort: { dir: _direccionDeTop(direccion, metrica) } };
    const out = _FAM_VS_ANTERIOR.has(metrica)
      ? [{ tool: "salesRead", args: { focus: "vs_anterior", dimension: ejeUniverso, figsPct: true }, para: `el top ${k} de ${ejeUniverso} por ${metrica} (universo.top, salesRead vs_anterior)` }]
      : _FAM_DIAS_SIN_VENTA.has(metrica)
      ? [_CALL_DIAS_SIN_VENTA(`el top ${k} de ${ejeUniverso} por ${metrica} (universo.top): el ranking COMPLETO de días sin venta, el orden lo aplica la Entrega`)]
      : [{ tool: "queryMetric", args: argsQueryMetric, para: `el top ${k} de ${ejeUniverso} por ${metrica} (universo.top${necesitaEjeCompleto ? ", eje completo — universo combinado" : ""})` }];
    // los OTROS conceptos de la parte, por el mismo eje SIN recorte: la Entrega selecciona de ahí las filas del
    // top ya fijado arriba — dos rankings por separado, nunca una segunda decisión de universo.
    for (const c of p.conceptos) { if (c === metrica) continue; out.push(..._callsDeConceptoEje(p.tema, c, ejeUniverso)); }
    return _dedupeCalls(out);
  }
  if (p.universo && Array.isArray(p.universo.filtros) && p.universo.filtros.length) {
    const out = [];
    for (const f of p.universo.filtros) {
      const ref = f && (f.ref || f.metrica);
      if (ref === "nivel_carga" || f.metrica === "carga") out.push({ tool: "diagnose", args: {}, para: "el universo sobre el nivel de carga — mismo detector que lo declaró (contrato §3.3)" });
      else if (ref === "benchmark" || f.metrica === "margen") out.push({ tool: "marginRead", args: { focus: "bajo_benchmark", dimension: "cliente" }, para: "el universo bajo el benchmark — mismo detector que lo declaró (contrato §3.3)" });
    }
    for (const c of p.conceptos) out.push(..._callsDeConceptoEje(p.tema, c, p.universo.eje || eje));
    return _dedupeCalls(out);
  }
  // group-by listing: eje sin entidades ni universo — un concepto, una o más llamadas.
  const out = [];
  for (const c of p.conceptos) out.push(..._callsDeConceptoEje(p.tema, c, eje));
  return _dedupeCalls(out);
}

/* ── cierre `comparacion` (contrato §1.1: EXACTAMENTE 2 entidades del MISMO eje → `compareEntities`) ──────────── */
/* RAÍZ A4 (supervisor 2026-09-29, diagnóstico v12, Z33): `compareEntities` sirve las métricas de `metricRegistry` lado a lado, y NO
 * produce los conceptos que tienen su propio productor — hoy los días sin venta (`_FAM_DIAS_SIN_VENTA`, el foco `dias_sin_venta`
 * de `inventoryStatus`). El validador acepta ese concepto en una comparación (su productor existe, contrato §3.3) y, sin esta
 * lectura, la Entrega lo calla: un concepto pedido, aceptado y desaparecido sin declaración (un cambio silencioso; y con él, el
 * bloque de lo histórico del Marco, que solo viaja si se sirve un hecho histórico). Por cada concepto pedido de esas familias se
 * agrega la llamada de SU productor (la misma `_callsDeConceptoEje` que usa una `cifra`); las figs resultantes llegan a
 * `porParte[parte]` y `_planComparacion` las compara par a par, tipadas como históricas. */
const _FAM_FUERA_DE_COMPARE = _FAM_DIAS_SIN_VENTA;
function _pasosComparacion(p) {
  if (p.entidades.length !== 2 || p.entidades[0].eje !== p.entidades[1].eje) return [];
  const eje = p.entidades[0].eje;
  const calls = [{ tool: "compareEntities", args: { dimension: eje, entities: p.entidades.map((e) => e.nombre) }, para: `comparación ${p.entidades.map((e) => e.nombre).join(" vs ")}` }];
  for (const c of p.conceptos || []) if (_FAM_FUERA_DE_COMPARE.has(c)) calls.push(..._callsDeConceptoEje(p.tema, c, eje));
  return _dedupeCalls(calls);
}

/* ── cierre `simulacion` (contrato §3.5: el PRODUCTOR ya lo resolvió `validar.js`, acá solo se arman los args) ─── */
function _callDeSupuesto(s) {
  const alcance = s.alcance;
  const esNegocio = alcance === "negocio";
  const nombre = esNegocio ? null : (alcance && alcance.nombre) || null;
  const ejeAlcance = esNegocio ? null : (alcance && alcance.eje) || null;
  // CORREGIDO (owner 2026-09-26, CORTE 3d — hallazgo de raíz, «96 filas de clientes no pedidos» en D27) —
  // `oracle/specRetrieval.js:_scopeRows` exige `entityScope.entities` (un ARRAY dentro de esa clave; ver
  // `oracle/toolContracts.js`, el otro productor de este mismo campo: `entityScope: { entities }`). Este archivo
  // pasaba `[nombre]` — un array A SECAS, sin la clave `.entities` — así que `Array.isArray(entityScope.entities)`
  // daba `false` (un array no tiene esa propiedad) y el filtro por entidad se saltaba EN SILENCIO: la simulación
  // corría sobre las 13 cuentas del tenant en vez de la UNA que el supuesto citaba. Mismo defecto para
  // simulateCarga/simulateCapital/simulateCosto (los tres consumen `entityScope` vía `_scopeRows`).
  const entityScope = nombre ? { entities: [nombre] } : null;
  if (s.productor === "simulateGeneral") {
    // simulateGeneral exige DOS variables de rol distinto (precio · volumen), cada una con su delta — contrato
    // §3.5: "price" mueve precio, "growth" mueve volumen; la variable que el supuesto NO trae viaja en 0 (el
    // usuario no declaró ese movimiento, así que su delta es cero, nunca inferido de otra cifra).
    const variableA = { campo: "precioLista", delta_pct: s.tipo === "price" ? s.valor : 0 };
    // §7.3·38(c) (diagnóstico v14, A5) — un crecimiento en DINERO («+$500.000») NUNCA se pasa como porcentaje (`delta_pct: 500000` era «+500000 % de volumen»):
    // viaja como `delta_money` y la tool lo convierte a % de la venta del período cerrado de la entidad, a precio constante. El % no se calcula acá: lo sabe la tool, que tiene el dato.
    const variableB = s.tipo === "growth" && s.unidad === "money"
      ? { campo: "unidades", delta_money: s.valor }
      : { campo: "unidades", delta_pct: s.tipo === "growth" ? s.valor : 0 };
    return { tool: "simulateGeneral", args: { dimension: ejeAlcance, entity: nombre, variableA, variableB }, para: `simulación ${s.tipo} (${s.valor}${s.unidad}) sobre ${nombre || "el negocio"} (simulateGeneral)` };
  }
  if (s.productor === "simulateCarga") {
    return { tool: "simulateCarga", args: { entityScope, delta_pp: s.valor }, para: `simulación de carga (${s.valor}pp) sobre ${nombre || "la cartera"} (simulateCarga)` };
  }
  if (s.productor === "simulateCapital") {
    return { tool: "simulateCapital", args: { entityScope }, para: `liberar el capital inmovilizado crítico de ${nombre || "el SKU"} (simulateCapital)` };
  }
  if (s.productor === "simulateCosto") {
    // scope:"all" — el supuesto apunta a UNA entidad puntual (entityScope); el filtro "bajo_benchmark" de
    // simulateCosto es del modo SIN entidad (mover el costo de todo el eje bajo la vara) y la excluiría si ya
    // está sobre el benchmark, que no es la pregunta que el supuesto puntual hace.
    return { tool: "simulateCosto", args: { dimension: ejeAlcance, entityScope, pct: s.valor, scope: "all" }, para: `simulación de costo (${s.valor}%) sobre ${nombre || "el eje"} (simulateCosto)` };
  }
  return null;
}
function _pasosSimulacion(p, supuestosResueltos, citadosPorParte) {
  const citados = citadosPorParte.get(p.id) || [];
  const out = [];
  for (const sid of citados) {
    const s = (supuestosResueltos || []).find((x) => x.id === sid);
    if (!s) continue;   // el gate del corte 1 ya lo declara en noResuelto; acá simplemente no hay llamada que armar
    const call = _callDeSupuesto(s);
    if (call) out.push(call);
  }
  return out;
}

/* ── cierre `definicion` (contrato §1.1: exige `concepto`, prohíbe cifras — `defineConcept` nunca lee la boleta) */
function _pasosDefinicion(p, conceptoPorParte) {
  const concepto = conceptoPorParte.get(p.id);
  if (!concepto) return [];
  return [{ tool: "defineConcept", args: { concept: concepto }, para: `definición de ${concepto} (defineConcept)` }];
}

/* ── cierres `lectura` y `decision` (contrato §1.1: `decision` corre lo que `prioridadIntegrada` necesita LEER
 * después — las MISMAS lecturas que `lectura` para sus temas; `prioridadIntegrada` no se llama acá, opera sobre
 * los `figs` que estas llamadas van a producir, en la etapa de composición). Se agrupan TODAS las partes con
 * estos dos cierres de una vez (mismo criterio que `pasosDeDominios`: el `multi` de dos temas juntos trae MÁS
 * pasos que la suma de cada uno por separado — `_INV_CRUCE`, `_COM_POR_EJE` bajo `multi`) — es la pieza que este
 * corte reusa completa, sin copiar una línea de su cuerpo. */
function _pasosLecturaDecision(partes) {
  if (!partes.length) return [];
  const dominios = [...new Set(partes.map((p) => p.tema))];
  // el primer eje EXPLÍCITO (≠ el sujeto por defecto del tema) entre estas partes — el mismo campo que ya resolvió
  // `validar.js` en `ParteResuelta.eje`; nunca se relee una frase para encontrarlo.
  let eje = null;
  for (const p of partes) { if (p.eje && p.eje !== sujetoDeTema(p.tema)) { eje = p.eje; break; } }
  let out = pasosDeDominios({ dominios, eje });
  // R-INICIATIVA-UNIVERSO-NO-ENTIDADES / V81 (diagnóstico v6, cerrado del todo, owner 2026-09-26 · coordinador) —
  // `cobranza()` recorta su boleta a un TOP 8 fijo (vencido primero, después saldo); una parte de este grupo
  // (`lectura`/`decision` sin entidad, 1..N temas) puede declarar `universo.top` sobre OTRA métrica («los 3
  // clientes de MENOR venta») que cae fuera de ese recorte — sin esto, `cobranza()` nunca trae esas cuentas y
  // `entrega/componer.js` termina sin evidencia para ellas al restringir por el mismo universo (mismo mecanismo
  // que `_pasosCifra` ya usa para `cifra`, `herramientasAgente.js:cobranza`, `_args.universoRequerido`). Las
  // partes de este grupo comparten eje (`validarUniverso` exige el mismo eje del tema): se toma el PRIMER
  // `universo.top` declarado por cualquier parte.
  // RAÍZ A6 (supervisor 2026-09-27, diagnóstico v9, precisa la nota de arriba) — la condición original solo
  // miraba `universo.top.metrica`: un `union` (u otro universo propio) SIN `top` («con saldo vencido» ∪ «carga
  // comercial alta») nunca disparaba `universoRequerido`, así que `cobranza()` seguía sirviendo solo el top-8 y
  // el conjunto declarado (W43.p2) quedaba sin ninguna fig para completar — `_planCifraGrupo` no tenía qué
  // ordenar y la parte se declinaba en silencio, sin plan ni límite. `_tieneUniversoPropio` (ya definida arriba
  // en este archivo, la MISMA prueba de 6 campos que usa `entrega/componer.js`) reemplaza el chequeo estrecho de
  // `top`; se pasa el universo COMPLETO de la parte (`herramientasAgente.js:cobranza` ya sabe ensanchar a la mesa
  // completa cuando el universo no trae `top`, tarea gemela de esta misma raíz).
  if (dominios.includes("cobranza")) {
    // CORREGIDO (supervisor 2026-09-28, diagnóstico v11, Y04/Y20) — «la PRIMERA parte con universo propio, sea
    // cual sea su tema» tomaba una parte COMERCIAL (p1, primera en el array) cuando el MISMO grupo también traía
    // una parte de COBRANZA con su propio universo (p2: `estados:["al dia"]` + `excluir.top` de «abonado»):
    // `universoRequerido` terminaba resolviendo el `top`/`excluir` de OTRO dominio (ventas/contribución) en vez
    // del universo que la parte de cobranza en verdad necesita, así que `cobranza()` ensanchaba la mesa con el
    // criterio equivocado y las cuentas que la parte de cobranza pedía (Ripley, La Polar, Hites, ABC, Unimarc en
    // Y20; el «al día» completo de Y04.p3) se quedaban sin fig — ni en Cifras ni en Detalle, un recorte SIN
    // declarar. Se prefiere la PRIMERA parte de COBRANZA con universo propio (la que de verdad necesita la mesa
    // completa); solo si NINGUNA parte de cobranza declara universo propio se conserva el comportamiento de
    // siempre (tomar prestado el de otro dominio del mismo grupo, V81 — `_necesitaMesaCompleta`, en
    // `herramientasAgente.js:cobranza`, sigue siendo la guarda que evita fabricar una señal de severidad falsa).
    out = _conUniversoRequerido(out, partes);
    // RAÍZ A1 (diagnóstico v13) — la misma regla que `_pasosCifra`: la cuenta que una parte de COBRANZA nombra se trae aunque
    // quede fuera del top 8 (nunca las entidades de otro dominio: cada parte pide solo las de su propio tema).
    const nombradas = _nombresDeEntidades(partes.filter((p) => p.tema === "cobranza").flatMap((p) => p.entidades || []));
    if (nombradas.length) out = out.map((c) => (c.tool === "cobranza" ? { ...c, args: { ...c.args, entidadesRequeridas: nombradas } } : c));
  }
  // §7.3·17 (supervisor 2026-09-27, diagnóstico v8, tarea 2 del cierre — HUECO DE LECTURA, raíz de Z25/Z64) — una
  // parte con universo PROPIO (`top`/`base`/`estados`/`no_estados`/`filtros`/`bodega`/`union`) necesita las
  // cifras de TODOS los miembros que ese universo resuelve, no solo los que el paquete FIJO del dominio
  // (`pasosDeDominios`/`pasosDelContratoComercial`, arriba) trajo: sus detectores («brecha de contribución»,
  // «precio de lista/markup y carga por cuenta», «las cuentas que más aportan») publican una cobertura PARCIAL a
  // propósito (cuentas que caen o que más aportan, nunca la cartera entera — ver la cabecera de
  // `agente/contratoComercial.js`). `entrega/componer.js:_planCifraGrupo` (§7.3·17) ya sabe COMPLETAR lo que
  // falte desde `indice.figsDeMetrica` (la evidencia YA traída este turno) — pero si NINGUNA llamada del plan
  // trajo la fig de una entidad para el concepto pedido, no hay nada que completar y la parte se declina en vez
  // de servir el universo entero (Z25: Easy sin «carga»/«contribución» propias en la boleta). Se pide el ranking
  // COMPLETO (sin `limit`) de cada concepto DECLARADO por la parte, por el eje del universo — la MISMA llamada
  // que ya arma el group-by sin entidades (`_callsDeConceptoEje`, nunca una segunda tabla) — ADITIVO: nunca
  // reemplaza lo que el contrato del dominio ya trae, solo agrega lo que falta (dedupe por tool+args exacto,
  // `_dedupeCalls`, al final de esta función).
  for (const p of partes) {
    if (!_tieneUniversoPropio(p.universo)) continue;
    const ejeP = (p.universo && p.universo.eje) || p.eje || sujetoDeTema(p.tema);
    for (const c of (p.conceptos || [])) out.push(..._callsDeConceptoEje(p.tema, c, ejeP));
  }
  if (dominios.includes("cobranza")) out = _conUniversoRequerido(out, partes);   // A7: las llamadas por concepto (recién agregadas) llevan el MISMO universo que la llamada base
  // «DÍAS SIN VENTA» COMO CONCEPTO DE LA PARTE (owner 2026-09-29, cierre del inventario): el paquete fijo del dominio trae el tramo crítico,
  // no los días de TODOS los SKU — una parte que los declara los pide con su productor (el mismo foco, aditivo, deduplicado abajo).
  for (const p of partes) if ((p.conceptos || []).some((c) => _FAM_DIAS_SIN_VENTA.has(c))) out.push(_CALL_DIAS_SIN_VENTA("dias_sin_venta — declarado por la parte: los días sin venta de TODOS los SKU, un hecho histórico (mesaCapital)"));
  // LA GRIETA DE UN SOLO TEMA CON EJE EXPLÍCITO (documentada, corte 3a): `pasosDeDominios` solo agrega la lectura
  // comercial POR EJE (`_COM_POR_EJE`) cuando participan DOS o más dominios (`multi`); con un único tema comercial
  // y un eje explícito (p. ej. "el margen por marca", sin que inventario/cobranza participen) devuelve `[]` para
  // esa parte. Ningún caso del catálogo de desarrollo lo ejercita hoy (D20 es de dos temas), así que se documenta
  // en vez de tocar `contratoDeDominios.js` sin un caso que lo pida: si aparece, cae acá, por concepto y eje —
  // mismo camino que el group-by de `cifra`, para no inventar una segunda regla de composición.
  if (!out.length && dominios.length === 1 && eje) {
    // RC8 (owner, diagnostico.md §RC8, punto 1): `conceptos` SIN declarar (`Parte.conceptos` vacío/ausente) es,
    // por contrato (§1: "lo que el procedimiento del tema sirva"), NO "nada que pedir" — antes el bucle solo
    // recorría lo DECLARADO, así que una parte "dame el margen por familia" (eje explícito, sin conceptos)
    // producía `plan.calls: []` y la Entrega fallaba con "el encargo no generó ninguna lectura del Core". Sin
    // conceptos declarados, se usan TODOS los del tema con productor en ESE eje (mismo criterio que ya usa
    // `validar.js:_validarConcepto` vía `productorDe`, nunca una segunda tabla).
    const declarados = partes.flatMap((p) => p.conceptos || []);
    const metricasDelTema = (dominioPorId(dominios[0]) && dominioPorId(dominios[0]).metricas) || [];
    const conceptos = new Set(declarados.length ? declarados : metricasDelTema.filter((c) => productorDe(c, eje)));
    for (const c of conceptos) out.push(..._callsDeConceptoEje(dominios[0], c, eje));
  }
  // RC-B (diagnóstico v2, supervisor 2026-09-26 — MATERIAL, la raíz que más fallas explica): `vs_presupuesto`/
  // `vs_presupuesto_usd` es un concepto que `validar.js` YA acepta con productor (contrato §3.3, corregido en el
  // corte 3a) pero que las lecturas FIJAS de arriba (`pasosDeDominios`/`pasosDelContratoComercial`, el `salesRead`
  // que traen es SIEMPRE el de foco por defecto) nunca leen — así que un `lectura`/`decision` que lo declara
  // (con entidad, como W36, o sobre la cartera entera, como W37) nunca lo trae al turno: no aparece en Cifras y
  // el Notario declara «no-verificable» una premisa (`variacion` con `periodo:"presupuesto"`) que el Core SÍ
  // puede verificar de verdad. Mismo criterio que `_pasosCifra`/`_callsDeConceptoEje` ya usan para `cifra`: si
  // ALGUNA parte de este grupo declaró el concepto y ninguna llamada YA planeada trae ese foco, se agrega — nunca
  // se reemplaza lo que el contrato ya trae. NO se usa `unirPasosDeDominios` (que agrupa por NOMBRE DE TOOL para
  // `salesRead`: colapsaría este `salesRead{focus:"vs_presupuesto"}` contra el `salesRead` default del contrato
  // comercial, que es justo el bug) — se hace la unión por tool+args EXACTO, el mismo criterio de `_dedupeCalls`
  // que ya cierra esta función más abajo (`lecturasDe`, línea ~330).
  const conceptosDeclarados = new Set(partes.flatMap((p) => p.conceptos || []));
  if (conceptosDeclarados.has("vs_presupuesto") || conceptosDeclarados.has("vs_presupuesto_usd")) {
    const yaTrae = out.some((c) => c.tool === "salesRead" && c.args && c.args.focus === "vs_presupuesto");
    if (!yaTrae) {
      const pConVsPresupuesto = partes.find((p) => (p.conceptos || []).includes("vs_presupuesto") || (p.conceptos || []).includes("vs_presupuesto_usd"));
      const temaVs = (pConVsPresupuesto && pConVsPresupuesto.tema) || dominios[0];
      const ejeVs = (pConVsPresupuesto && pConVsPresupuesto.eje) || eje || sujetoDeTema(temaVs);
      out.push({ tool: "salesRead", args: { focus: "vs_presupuesto", dimension: ejeVs }, para: "vs_presupuesto — declarado por el encargo, no cubierto por las lecturas fijas del contrato comercial (RC-B)" });
    }
  }
  return out;
}

/* la clasificación tool→tema es de TRAZABILIDAD (`porParte`), no una segunda validación de negocio: si una tool
 * sirve dos temas (queryMetric), se distingue por la métrica pedida. Nunca se usa para decidir QUÉ corre — eso ya
 * lo decidió `pasosDeDominios`/`pasosDelContratoComercial` arriba. */
const _TOOLS_COBRANZA = new Set(["cobranza"]);
const _TOOLS_INVENTARIO = new Set(["inventoryStatus", "tensionRead"]);
const _TOOLS_COMERCIAL = new Set(["salesRead", "marginRead", "contributionRead", "diagnose", "rolesCartera", "trend"]);
const _METRICAS_INVENTARIO = new Set(["capital", "doh", "stock", "rotacion"]);
function _temaDeCall(call) {
  const tool = call && call.tool;
  if (_TOOLS_COBRANZA.has(tool)) return "cobranza";
  if (_TOOLS_INVENTARIO.has(tool)) return "inventario";
  if (_TOOLS_COMERCIAL.has(tool)) return "comercial";
  if (tool === "queryMetric") return _METRICAS_INVENTARIO.has(call.args && call.args.metric) ? "inventario" : "comercial";
  return null;
}

/* dedupe EXACTO (tool + args, byte a byte vía JSON): dos llamadas iguales colapsan en una — nunca dos llamadas
 * DISTINTAS con el mismo nombre de tool (dos `queryMetric` con distinto `metric`/`dimension` son dos lecturas). */
function _dedupeCalls(calls) {
  const vistos = new Set();
  const out = [];
  for (const c of calls) {
    if (!c || !c.tool) continue;
    const clave = JSON.stringify({ tool: c.tool, args: c.args || {} });
    if (vistos.has(clave)) continue;
    vistos.add(clave);
    out.push(c);
  }
  return out;
}

/* ── R-EVIDENCIA-PREMISA (diagnóstico v3, supervisor 2026-09-26 — MATERIAL, la raíz más alineada con la ley del
 * owner ya aprobada, memoria `adi-flujo-producto-complemento`: «una premisa se juzga contra LO QUE ADI SABE de la
 * empresa, no contra la boleta de la parte»). Hasta acá el plan solo miraba `resolucion.partes` — una premisa
 * (`resolucion.premisas`, ya validada y tipada por `validar.js:_resolverPremisasRaiz` vía `hechos.js:validarHecho`)
 * podía declarar un (metrica, eje) que NINGUNA parte pidió (marca dentro de una lectura por cliente, familia
 * dentro de una simulación de una sola entidad): esa lectura nunca se agendaba, y `libroPremisas`
 * (`entrega/componer.js`, MISMO índice de evidencia `I` que arma este plan) la declaraba «sin-evidencia» aunque
 * el Core supiera calcularla. `_conceptosYEjesDePremisa` resuelve qué (concepto, eje) necesita CADA premisa —
 * exactamente los mismos campos tipados que ya lee `_pasosCifra`/`_pasosLecturaDecision` de una Parte — y
 * `_callsDeConceptoEje` arma la MISMA llamada que ya usa el resto de este archivo para esa combinación (nunca un
 * productor nuevo, nunca una segunda tabla).
 *
 * EL EJE de un sujeto puntual (Samsung, Línea Blanca) se resuelve con `resolveEntityRef` — el MISMO índice de
 * entidades que ya usa `validar.js` para resolver `Parte.entidades` (`oracle/entityIndex.js`): tenant-dependiente,
 * nunca de red ni de LLM, coherente con la dependencia que este archivo ya declara en su cabecera. `productorDe`
 * (esquema.js) es el MISMO candado que ya audita el pedido de una Parte: sin productor para ese (concepto, eje),
 * no hay llamada que inventar — la premisa sigue «sin-evidencia», honesto, no un intento fallido.
 *
 * ESTAS LLAMADAS VIAJAN EN EL PLAN GENERAL (comparten `I` con `libroPremisas`, `entrega/componer.js`) PERO NUNCA
 * SE ATRIBUYEN A NINGÚN `porParte[id]` — la ley que este corte no puede romper: «nunca agregan cifras ni
 * entidades a lo servido en la parte». Esa separación la garantiza `_figsDeParte` (componer.js), que solo deja
 * ver a una parte las figs de LAS LLAMADAS QUE SU PROPIO `porParte[pid]` ya declaró; una llamada que no aparece en
 * ningún `porParte[pid]` quedó fuera de esa vista, aunque su fig exista en el índice de evidencia. Tipos de
 * premisa NO cubiertos hoy (alcance de este corte, con evidencia): `estado` (el estado ya lo sirven los
 * detectores fijos de cada dominio, `pasosDeDominios`, no un concepto con productor) y `razon`/`derivada` (sus
 * operandos referencian otro hecho por id, no un `(concepto, eje)` nuevo — fuera de lo que el catálogo diagnosticó). */
function _ejeDeSujetoPremisa(sujeto) {
  const nombre = Array.isArray(sujeto) ? sujeto[0] : (sujeto && typeof sujeto === "object" ? null : sujeto);
  if (typeof nombre !== "string" || !nombre.trim() || nombre === "negocio") return null;
  const r = resolveEntityRef(nombre);
  return r && r.estado === "resuelto" ? r.dimension : null;
}
/** §7.3·38 (diagnóstico v14, A1) — los conceptos que el UNIVERSO tipado de una premisa NOMBRA (y que la premisa no trae
 *  en `metrica`): `top.metrica`, `filtros[].metrica` (sin `ref`: un filtro por referencia lo resuelve su propio
 *  detector), `excluir.top[].metrica` y, recursivo, cada miembro de `union` (hereda el eje del universo que lo
 *  contiene). Una premisa de grupo/conteo sin `metrica` propia necesita esa evidencia para juzgarse. */
function _conceptosDeUniverso(u, add, ejeHeredado = null) {
  if (!u || typeof u !== "object" || Array.isArray(u)) return;
  const eje = u.eje || ejeHeredado;
  if (u.top && u.top.metrica) add(u.top.metrica, eje);
  for (const f of Array.isArray(u.filtros) ? u.filtros : []) if (f && f.metrica && f.ref == null) add(f.metrica, eje);
  if (u.excluir && typeof u.excluir === "object") {
    const tops = Array.isArray(u.excluir.top) ? u.excluir.top : (u.excluir.top ? [u.excluir.top] : []);
    for (const t of tops) if (t && t.metrica) add(t.metrica, eje);
  }
  for (const v of Array.isArray(u.union) ? u.union : []) _conceptosDeUniverso(v, add, eje);
}
function _conceptosYEjesDePremisa(p) {
  if (!p || typeof p !== "object") return [];
  const out = [];
  const add = (concepto, eje) => { if (concepto && eje) out.push({ concepto: String(concepto), eje }); };
  _conceptosDeUniverso(p.universo, add);
  _conceptosDeUniverso(p.de, add);
  const ejeDeUniverso = (u) => (u && typeof u === "object" ? u.eje : null);
  const tipo = p.tipo;
  if (tipo === "cifra") {
    add(p.metrica, ejeDeUniverso(p.universo) || _ejeDeSujetoPremisa(p.sujeto));
  } else if (tipo === "orden" || tipo === "grupo") {
    add(p.metrica, ejeDeUniverso(p.universo) || _ejeDeSujetoPremisa(p.sujeto));
  } else if (tipo === "conteo") {
    add(p.metrica, ejeDeUniverso(p.de != null ? p.de : p.universo));
  } else if (tipo === "variacion") {
    add(p.metrica, _ejeDeSujetoPremisa(p.sujeto));
  } else if (tipo === "relacion") {
    const eje = ejeDeUniverso(p.universo) || _ejeDeSujetoPremisa(p.sujeto);
    add(p.metrica, eje);
    const vs = p.relacion && p.relacion.vs;
    if (vs) {
      const vsSujeto = vs.sujeto != null ? vs.sujeto : vs.grupo;
      add(vs.metrica || p.metrica, _ejeDeSujetoPremisa(vsSujeto) || eje);
    }
  }
  return out;
}
/** callsDePremisas(premisas) → las llamadas ➕ que las PREMISAS del encargo necesitan para poder juzgarse, más
 *  allá de lo que la Parte ya pidió — SOLO para `libroPremisas`, ver la nota de arriba. */
function _callsDePremisas(premisas) {
  const out = [];
  for (const p of Array.isArray(premisas) ? premisas : []) {
    for (const { concepto, eje } of _conceptosYEjesDePremisa(p)) {
      if (!productorDe(concepto, eje)) continue;   // sin productor: nada que agendar, la premisa sigue sin-evidencia
      out.push(..._callsDeConceptoEje(dominioDeClave(concepto) || "", concepto, eje));
    }
  }
  return out;
}

/** lecturasDe(resolucion) → { plan, porParte }. Puro frente al encargo (nunca lee `preguntaOriginal`); hereda de
 *  `pasosDeDominios` la dependencia del TENANT activo (no de la red, no del LLM) — ver cabecera. */
export function lecturasDe(resolucion) {
  if (!resolucion || !Array.isArray(resolucion.partes)) return { plan: { intent: "encargo", calls: [] }, porParte: {} };

  const partesCrudas = (resolucion.encargo && Array.isArray(resolucion.encargo.partes)) ? resolucion.encargo.partes : [];
  const conceptoPorParte = new Map();     // Parte.concepto (SOLO `definicion`) — no viaja en ParteResuelta
  const citadosPorParte = new Map();      // Parte.supuestos (SOLO `simulacion`) — no viaja en ParteResuelta
  for (const cruda of partesCrudas) {
    if (!cruda || typeof cruda !== "object" || !cruda.id) continue;
    if (typeof cruda.concepto === "string") conceptoPorParte.set(cruda.id, cruda.concepto);
    if (Array.isArray(cruda.supuestos)) citadosPorParte.set(cruda.id, cruda.supuestos.filter((x) => typeof x === "string"));
  }

  const porParte = {};
  const sueltas = [];          // llamadas de cifra/comparacion/simulacion/definicion — una parte, sus llamadas
  const partesLecturaDecision = [];   // se agrupan al final (ver _pasosLecturaDecision)

  for (const p of resolucion.partes) {
    if (!p || p.estado === "no_resuelta") { if (p) porParte[p.id] = []; continue; }
    if (p.cierre === "cifra") { const c = _pasosCifra(p); porParte[p.id] = c; sueltas.push(...c); }
    else if (p.cierre === "comparacion") { const c = _pasosComparacion(p); porParte[p.id] = c; sueltas.push(...c); }
    else if (p.cierre === "simulacion") { const c = _pasosSimulacion(p, resolucion.supuestos, citadosPorParte); porParte[p.id] = c; sueltas.push(...c); }
    else if (p.cierre === "definicion") { const c = _pasosDefinicion(p, conceptoPorParte); porParte[p.id] = c; sueltas.push(...c); }
    else { partesLecturaDecision.push(p); }   // "lectura" | "decision": se agrupan
  }

  const lecturaCalls = _pasosLecturaDecision(partesLecturaDecision);
  /* «FRENADO» SIN UMBRAL (owner 2026-09-29, cierre del inventario): la parte pide un estado que ADI no puede juzgar sin un
   * umbral declarado (empresa o consulta) — el veredicto queda «sin evaluar», pero el HECHO se entrega: los días sin venta
   * de TODOS los SKU, ordenados. Se pide aquí (por FORMA del universo tipado, `frenadoSinUmbral`, la misma prueba que usa la
   * Entrega para declarar el límite); jamás leyendo la pregunta. */
  const _diasParaFrenado = (p) => (frenadoSinUmbral(p.universo, resolucion) ? [_CALL_DIAS_SIN_VENTA("los días sin venta de TODOS los SKU, ordenados — el hecho que se entrega cuando «frenado» no tiene umbral declarado (mesaCapital)")] : []);
  for (const p of partesLecturaDecision) {
    const dd = _diasParaFrenado(p);
    if (dd.length) lecturaCalls.push(...dd);
    porParte[p.id] = lecturaCalls.filter((c) => _temaDeCall(c) === p.tema);
  }
  for (const p of resolucion.partes) {
    if (!p || p.estado === "no_resuelta" || p.cierre === "lectura" || p.cierre === "decision") continue;
    const dd = _diasParaFrenado(p);
    if (dd.length) { porParte[p.id] = [...(porParte[p.id] || []), ...dd]; sueltas.push(...dd); }
  }

  // R-EVIDENCIA-PREMISA: se agregan DESPUÉS de fijar `porParte` (arriba) — nunca entran a esa traza, así que
  // ninguna parte las hereda como "lo servido" (ver la nota de `_callsDePremisas`).
  const premisaCalls = _callsDePremisas(resolucion.premisas);

  const todas = _dedupeCalls([...lecturaCalls, ...sueltas, ...premisaCalls]);
  return {
    plan: { intent: "encargo", calls: todas.map(({ tool, args }) => ({ tool, args: args || {} })) },
    porParte,
  };
}
