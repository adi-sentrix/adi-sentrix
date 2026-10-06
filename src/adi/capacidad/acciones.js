/* === src/adi/capacidad/acciones.js · LAS CUATRO ACCIONES DE LA CAPACIDAD (Etapa 3, corte 9, owner 2026-09-26) ═
 * `_ADI_DISENO_FLUJO_V2.md` §E: una sola capacidad ante el LLM, cuatro acciones — `conocerEmpresa`, `consultar`,
 * `aportarContexto`, `retomar`. Este archivo NO sabe de MCP ni de OpenAPI ni de HTTP: eso es `puerta.js`. Acá solo
 * viven las cuatro funciones, con el TENANT INYECTADO por quien llama (ley del owner: «el tenant sale del token,
 * nunca de un argumento» — la puerta ya resolvió el tenant contra el token ANTES de llegar acá; estas funciones ni
 * siquiera saben leer un token).
 *
 * «PURAS», EN EL SENTIDO DE ESTE REPOSITORIO: determinísticas dado el MISMO `tenant.dataset` y el MISMO encargo —
 * la misma garantía que ya tienen `validarEncargo`/`componerEntrega`, que tampoco son puras en el sentido
 * estricto de la programación funcional (leen el tenant activo de `data/tenantStore.js`, la ÚNICA puerta del dato
 * del Core — ver su cabecera). El resultado depende solo de lo que el LLAMADOR inyectó, nunca de una sesión
 * anterior que haya quedado activa por accidente: el tramo que toca el Core entra con `conTenantActivo`
 * (`aislamiento.js`), que fija la empresa, calcula SIN ESPERAR NADA y restaura lo que había.
 *
 * NUNCA VIAJA EL ARCHIVO DEL CLIENTE (ley del owner): `tenant.dataset` es el PACK ya calculado (la misma forma
 * que `initTenant` recibe en toda la casa — `TENANT_DEMO`, o `packActivo(...).pack` en producción), nunca el
 * .xlsx ni sus filas crudas. Lo único que sale de acá son hechos calculados: texto, JSON de la Entrega, catálogo.
 *
 * LA COMPRENSIÓN ES DEL LLM: ninguna función de este archivo lee `encargo.preguntaOriginal` ni ningún campo de
 * prosa libre — todo lo que entra ya es un objeto tipado (`Encargo` v1) o un aporte con forma declarada.
 *
 * `tenant` (el objeto inyectado en las cuatro acciones): `{ id, nombre, dataset, version?, sello? }` — la MISMA
 * forma que ya devuelve `data/tenantService.server.js:packActivo`/`handleData` para el estado "activo". `puerta.js`
 * arma este objeto DESPUÉS de verificar el token; ninguna acción de acá vuelve a verificar nada de identidad.
 *
 * ═══ ETAPA 2, BLOQUE 1 · GUARDADO DURABLE (owner 2026-10-02) — LAS CUATRO ACCIONES SON ASÍNCRONAS ═════════════
 * El almacén (`continuidad/almacen.js`) es UNA interfaz asíncrona, la misma para la memoria en proceso y para
 * Supabase (`almacenSupabase.js`). La nota anterior de este archivo —«ninguna línea cambia al enchufar Supabase»—
 * era FALSA: las acciones eran síncronas y trataban lo que devolvía el almacén como un arreglo ya resuelto
 * (`.filter is not a function`). Ahora cada acción es `async` y ESPERA al almacén.
 *
 * EL ORDEN DE CADA ACCIÓN (defecto D2): LEER de la base → ENTRAR AL TRAMO DEL CORE (`conTenantActivo`: initTenant +
 * validarEncargo/componerEntrega, SÍNCRONO, sin `await` adentro) → SALIR → ESCRIBIR a la base. Entre `initTenant` y
 * el cálculo no hay ninguna espera, así que dos empresas atendidas a la vez en el mismo servidor no se mezclan
 * (`_guardado_durable_gate.mjs` lo prueba intercalando al azar, y el orden viejo —carnada— sí las mezcla).
 *
 * LA FALLA ES VISIBLE (contrato de `almacen.js`): si el almacén no puede leer o guardar, la acción responde
 * `{ok:false, memoria:"no_disponible"}` — nunca trata «no pude leer» como «no existe» (eso abriría un libro vacío
 * con el mismo id y lo guardaría encima del real). `consultar` es la excepción honesta: si el CÁLCULO salió bien y
 * lo único que falló es GUARDAR la conversación, entrega la Entrega (las cifras son verdaderas) y declara
 * `continuidad.guardada:false` con su motivo — nunca finge que la conversación quedó guardada.
 *
 * LAS ESCRITURAS DE UNA MISMA CONVERSACIÓN / EMPRESA SE SERIALIZAN (`continuidad/serializar.js`): leer-calcular-
 * guardar el libro no es atómico, y dos llamadas cruzadas de la misma conversación perderían una Entrega («el pasado
 * no se reescribe»). Es un candado DE PROCESO: no protege entre instancias del hosting (eso es de la base).
 *
 * ═══ CORTE 9 (owner 2026-09-26) — LA CONTINUIDAD REAL, YA NO EL DOBLE ═══════════════════════════════════════════
 * `continuidadMemoria.js` (el doble en memoria de esta pieza) se RETIRA: el carril B publicó la continuidad real
 * en `src/adi/continuidad/` (memoria de empresa + libro de conversación + estado vigente + retomar, sobre un
 * ALMACÉN inyectable — `continuidad/almacen.js`). Las funciones de `continuidad/` se llaman directo desde acá, con
 * el almacén como primer parámetro.
 *
 * LO QUE ESTE CORTE CONECTA (`_ADI_CONTINUIDAD_INTEGRACION.md` §2) Y LO QUE DEJA DECLARADO COMO LÍMITE:
 *   · `consultar` abre/reusa el libro de conversación, registra lo entregado como referencias (tabla de Cifras:
 *     ya es la forma denormalizada que el libro necesita — sujeto/métrica/valor/procedencia — sin tener que leer
 *     el libro de hechos interno de `entrega/componer.js`), avanza criterio y supuestos vivos desde `resolucion`
 *     (ya resueltos por `validarEncargo`, sin tocar `componerEntrega`), y juzga las premisas leyendo
 *     `salida.entrega.procedencia.libroPremisas` — un campo YA EXPUESTO por `componerEntrega` para esto mismo.
 *   · LO DECLARADO EN LA ENTREGA (Etapa 2, bloque 3 · owner 2026-10-03; antes era un límite declarado de este corte): `consultar` lee la
 *     memoria, y lo VIGENTE (confirmado) entra POR ESTA CAPA sin tocar `entrega/componer.js` (la etapa 1 está cerrada): un criterio de la
 *     empresa es su umbral «declarado por la empresa» (`conCriteriosDeEmpresa`: va al perfil de la empresa que el Core resuelve en `initTenant`, el camino de
 *     `umbral()`) y un hecho declarado se muestra al lado de lo medido de la misma métrica y entidad, con su origen y la diferencia (`loDeclarado.js`). Un
 *     pendiente nunca entra; lo que no tiene lugar en la Entrega se queda en la memoria. La cita `contexto: E1` se resuelve contra el libro
 *     de la conversación (`validarEncargo(encargo, { libro })`) y trae lo que esa Entrega entregó, sin recalcularlo. Sin nada declarado y sin
 *     cita, la Entrega sale byte-idéntica a la de antes.
 *   · RETOMAR REVALIDANDO (Etapa 2, bloque 4 · owner 2026-10-04; antes era un límite declarado de este corte, `retomar` con `reverificar:null`): el índice de evidencia de la versión activa no se
 *     reconstruye desde afuera —sigue siendo del compositor y `entrega/componer.js` sigue sin tocarse—: `retomar` le VUELVE A HACER al Core, hoy, la misma pregunta que se le hizo entonces (el
 *     Encargo que el libro guardó) y compara cifra por cifra (`continuidad/revalidar.js`). Ver su cabecera más abajo. */
import { validarEncargo } from "../encargo/validar.js";
import { normalizarFormaDelEncargo } from "./formaDelEncargo.js";
import { componerEntrega } from "../entrega/componer.js";
import { construirCatalogo } from "./catalogo.js";
import { construirPerfilCliente } from "../../config/contract/perfilCliente.js";
import { crearAlmacenEnMemoria, esErrorDeAlmacen } from "../continuidad/almacen.js";
import {
  memoriaDeEmpresa, declararHecho, confirmarHecho, hechoDePerfilCampo, leerPendientes,
  leerPerfilDeclarado, perfilDeLasFilas, declararPerfilCampo, omitirPerfilCampo, esConceptoReservadoDePerfil, CAMPOS_PERFIL_DECLARABLES,
} from "../continuidad/empresa.js";
import { conPerfilDeclarado, armarPerfilConversando, opcionesDeCampo, textoDeLimitacion } from "./perfilConversando.js";
import {
  clasificarLoDeclarado, contrastarHechos, textoDeLoDeclarado, plazosCitados, procedenciasDeCriterios, antecedentesDe, textoDeAntecedentes, lugarDeAporte, aplicadoComoDe, validarCriterio, declarable, esReferenciaDeLaCasa, USO_DE_LO_DECLARADO,
} from "./loDeclarado.js";
import { conCriteriosDeEmpresa, setBenchmarkOverride, ETIQUETA_ORIGEN, ORIGEN, etiquetaDeProcedencia } from "../../config/businessPolicy.js";
import { PIEZAS_CONOCIMIENTO } from "../conocimiento/piezas.js";
import { ADI_CONOCIMIENTO } from "../../config/voiceFlags.js";
import {
  libroNuevo, emitirConversacionId, detectarCambioVersion, registrarEntrega,
  actualizarCriterio, agregarSupuestoVivo, registrarPremisa, registrarHechoAportado, registrarDerivacion, derivacionesDe,
} from "../continuidad/libro.js";
import { validarDerivacion, calcularDerivacion, derivacionParaElLibro, respuestaDeLaDerivacion, cifrasDeLosOperandos, llaveDeDerivacion } from "./derivar.js";
import { estadoVigenteDe, eventosDeContinuidad, lineaDeContinuidad } from "../continuidad/estadoVigente.js";
import { retomar as reverificarConversacion } from "../continuidad/retomar.js";
import { cifraDeHecho, referenciasDe, revalidarEntrega, reverificadorDe, encargoParaElLibro } from "../continuidad/revalidar.js";
import { renderDe } from "../notario/hechos.js";
import { serializarPorClave } from "../continuidad/serializar.js";
import { conTenantActivo } from "./aislamiento.js";

/* ── LA CABECERA DE USO (plan v2, Etapa 3 · «una cabecera de USO para el LLM») ───────────────────────────────────
 * Viaja en CADA `consultar(...)`. Cuatro reglas, en el vocabulario de negocio del contrato (nunca "boleta" ni
 * "fig" ni ningún nombre interno): las cifras se PIDEN, no se recalculan; las NEGATIVAS —los hallazgos de «Lo que
 * no se puede concluir», no los números bajo cero (corrección del supervisor 2026-09-26)— se respetan; la
 * referencia del oficio no es un objetivo de esta empresa y el benchmark no es un promedio (CLAUDE.md §4:
 * «benchmark ≠ promedio ≠ meta»); y la libertad de redacción tiene un único límite — nombrar la simulación o la
 * entidad SOLO cuando de verdad hay ambigüedad (ley del colapso de escenarios: el texto dice «simulación»). */
export const CABECERA_DE_USO = Object.freeze([
  "Toda cifra empresarial que usted diga —en números o en palabras, incluidos totales, diferencias, porcentajes y conteos— debe ser un hecho que ADI le entregó en esta conversación. Si la cifra que necesita no está entre lo entregado, no la calcule ni la complete: pídasela a ADI (derivar, sobre identificadores ya entregados; o una consulta nueva). Redondear a lo impreso no es calcular.",
  "Lo que la Entrega declara en «Lo que no se puede concluir» se respeta: son hallazgos, no excusas — no se afirma lo contrario ni se rellena el hueco con una suposición.",
  `La «Referencia del oficio» es conocimiento general del sector, no un dato de esta empresa ni un objetivo suyo; el benchmark lleva su origen (${ETIQUETA_ORIGEN[ORIGEN.EMPRESA]} o criterio general de ADI) y no es un promedio.`,
  "Redacte con total libertad — resuma, ordene, adapte el tono al lector — y nombre la simulación o la entidad exacta SOLO cuando haya ambigüedad real sobre a cuál se refiere la cifra.",
]);

/* ── LA CABECERA DE USO DE `retomar` (Etapa 2, bloque 4 · owner 2026-10-04) ──────────────────────────────────────────────────────────────────
 * Viaja en CADA `retomar(...)`, en el mismo vocabulario de negocio que `CABECERA_DE_USO` (nunca «boleta», «fig» ni un nombre interno): lo entregado antes se cita tal como se dijo; si una
 * cifra cambió se dicen las dos; lo que no se pudo comparar o no se midió no se afirma como vigente; y no se recalcula sobre el texto. */
export const CABECERA_DE_RETOMAR = Object.freeze([
  "Lo entregado antes se cita tal como se dijo: no se reescribe ni se corrige sobre el texto. Si algo cambió, se dice que cambió con los datos actuales — no que antes estuviera mal.",
  "Si una cifra cambió, se dicen las dos —la de antes y la de ahora— con los datos de su momento; la diferencia ya viene calculada por ADI, no se recalcula ni se estima a mano.",
  "Lo marcado «no_comparable» (otro período, otra moneda, otra unidad, otra referencia o una cuenta que ya no figura en el ranking), «no_se_revalida» (un supuesto, un declarado, un documento) o «sin_reverificar» no se afirma como vigente ni como cambiado: se dice por qué, con las palabras del motivo.",
  "La línea de continuidad es lo único que se dice sin que la persona lo pida, y solo si pasó algo; nombra hasta tres cambios y cuántos más hay. El detalle de cada cifra está en `hechos` por si lo pide (`E1.h3.2` es la segunda cifra de la fila `E1.h3`).",
]);

/* ── validar la FORMA del tenant inyectado — SIN tocar el estado global del Core (eso es `conTenantActivo`) ────── */
function _validarTenant(tenant) {
  if (!tenant || typeof tenant !== "object" || !tenant.dataset || typeof tenant.dataset !== "object") {
    return { ok: false, motivo: "tenant inválido: falta el dataset ya calculado (nunca se recibe un archivo del cliente acá)" };
  }
  return { ok: true };
}

/* la respuesta cuando el almacén no pudo leer o guardar: palabras de negocio, sin el mensaje de la base. */
const MOTIVO_SIN_MEMORIA = "la memoria de la empresa no está disponible en este momento (no se pudo leer o guardar en la base): no se entrega nada que dependa de ella — reintente en unos minutos.";
const _sinMemoria = (e) => ({ ok: false, memoria: "no_disponible", motivo: MOTIVO_SIN_MEMORIA, operacion: (e && e.operacion) || null });

/* ── forma mínima de un aporte (aportarContexto) — sin leer prosa: valida CAMPOS, no interpreta texto ─────────── */
const _CLASES_DE_APORTE = ["perfil", "criterio", "hecho", "documento"];
function _entenderAporte(aporte) {
  if (!aporte || typeof aporte !== "object") return { valido: false, motivo: "el aporte no es un objeto" };
  if (!_CLASES_DE_APORTE.includes(aporte.clase)) return { valido: false, motivo: `clase debe ser una de: ${_CLASES_DE_APORTE.join(", ")}` };
  if (typeof aporte.concepto !== "string" || !aporte.concepto.trim()) return { valido: false, motivo: "falta \"concepto\" (string)" };
  if (aporte.valor === undefined || aporte.valor === null) return { valido: false, motivo: "falta \"valor\"" };
  if (aporte.clase === "documento" && (typeof aporte.documento !== "object" || !aporte.documento)) {
    return { valido: false, motivo: "clase \"documento\" exige el objeto \"documento\" ({nombre, tipo, ...})" };
  }
  return {
    valido: true,
    entendido: {
      clase: aporte.clase, concepto: aporte.concepto,
      entidad: typeof aporte.entidad === "string" ? aporte.entidad : null,
      periodo: typeof aporte.periodo === "string" ? aporte.periodo : null,
      valor: aporte.valor,
      unidad: typeof aporte.unidad === "string" ? aporte.unidad : null,
      documento: aporte.documento || null,
      parte: typeof aporte.parte === "string" ? aporte.parte : null,
    },
  };
}

/* el aporte de la puerta manda `valor` como CUALQUIER tipo (el `inputSchema` MCP lo declara `{}` a propósito: un
 * LLM puede mandar un número, un texto o ya un objeto {raw,unidad,texto}) — `empresa.js:declararHecho` exige la
 * forma tipada. Esta es la ÚNICA traducción de forma que este archivo hace sobre el valor de un aporte. */
function _valorParaEmpresa(valorCrudo, unidadDelCampo) {
  if (valorCrudo != null && typeof valorCrudo === "object" && !Array.isArray(valorCrudo) && ("raw" in valorCrudo || "texto" in valorCrudo)) {
    return { raw: valorCrudo.raw != null && Number.isFinite(+valorCrudo.raw) ? +valorCrudo.raw : null, unidad: valorCrudo.unidad || unidadDelCampo || null, texto: valorCrudo.texto != null ? String(valorCrudo.texto) : null };
  }
  if (typeof valorCrudo === "number" && Number.isFinite(valorCrudo)) return { raw: valorCrudo, unidad: unidadDelCampo || null, texto: null };
  return { raw: null, unidad: unidadDelCampo || null, texto: valorCrudo != null ? String(valorCrudo) : null };
}

/* ── el aporte de PERFIL: el valor llega TIPADO (el código de una opción), nunca prosa que ADI tenga que interpretar ──
 * Se acepta el texto del código a secas o dentro de `{texto}` (la forma que el resto de la puerta ya usa); cualquier otra
 * cosa no es un código y `declararPerfilCampo` la rechaza diciendo cuáles son los válidos. */
function _codigoDePerfil(valor) {
  if (typeof valor === "string") return valor.trim();
  if (valor && typeof valor === "object" && !Array.isArray(valor) && typeof valor.texto === "string") return valor.texto.trim();
  return null;
}
/* el sector de la ficha de la empresa (`tenants`), si lo trae y es un texto — para juzgar un tipo de producto */
function _sectorDeLaFicha(dataset) {
  const s = dataset && dataset.perfil && dataset.perfil.sector;
  return s && typeof s.valor === "string" && s.valor ? s.valor : null;
}
/* lo válido, para que el anfitrión pueda reintentar: las opciones de la taxonomía con su rótulo (nunca solo códigos mudos) */
function _validosParaElAnfitrion(campo, validos) {
  return CAMPOS_PERFIL_DECLARABLES.includes(campo) ? opcionesDeCampo(campo) : validos;
}

/* ── etiquetas cortas para los eventos de continuidad (texto de la CASA, nunca del LLM) ─────────────────────── */
function _etiquetaCriterio(c) {
  if (!c) return null;
  if (c.valor && c.valor.lente) return c.valor.lente;
  if (c.valor && c.valor.referencia) return c.valor.referencia.concepto;
  return null;
}
function _etiquetaSupuesto(s) {
  return [s.tipo, s.alcance && (s.alcance.nombre || s.alcance), s.valor != null ? `${s.valor}${s.unidad || ""}` : null].filter(Boolean).join(" · ") || s.id;
}

/* ── lo entregado, como REFERENCIAS para el libro (`_ADI_CONTINUIDAD_INTEGRACION.md` §2, paso 8) ────────────────
 * La tabla de Cifras que ya arma `componerEntrega` (`entrega.cifras.filas`) es, por diseño, la forma DENORMALIZADA
 * que el libro necesita — cada fila ya trae su entidad, su métrica, su valor y su procedencia (`_fila`/`_procedenciaDeFila`,
 * `entrega/componer.js`) — así que este corte NO reconstruye el libro de hechos interno del compositor (eso exigiría
 * tocar `entrega/componer.js`, congelado): lee lo que ya está expuesto.
 *
 * BLOQUE 4 (owner 2026-10-04) — LO QUE EL LIBRO CONSERVA PARA REVALIDAR. Cada fila además guarda, APARTE en `rv` (los campos de siempre quedan intactos: citar una
 * respuesta anterior y el estado vigente salen byte a byte como antes), el valor EXACTO de su cifra y de dónde viene: lo lee del libro de hechos que el compositor ya expone
 * (`entrega.procedencia.libro.porId.get(ref)`, `revalidar.js:cifraDeHecho` — la misma función con la que después se compara). `prioridad` es la `.prioridad` de la fila de Cifras
 * (la MISMA con la que `entrega/tamano.js` decide qué se recorta; menor = más prioritaria): hoy el compositor no la declara en las filas que sirve, así que vale el fallback de ese
 * mismo archivo —el orden de aparición en la tabla— y, si algún día la declara, esta línea la toma sin cambiar. Una fila ANCHA (una columna por cifra: Venta · Margen · Contribución
 * no capturada) dice varias cifras: la primera va en `rv` y las demás en `rv.mas`, cada una con la columna de la que sale (la que imprime EXACTAMENTE su valor) — así ninguna se
 * pierde y los ids de siempre (`E<n>.h<k>` = la k-ésima fila) no se mueven. Lo derivado de un SUPUESTO (una fila de simulación cuyo valor no es una medición) se marca `deSupuesto`:
 * el libro de hechos lo declara «derivado» pero de `medido` (su insumo es medido), así que no hay otro dato estructural que lo distinga de un derivado del motor que sí se revalida. */
function _cifraParaRevalidar(libro, id, deSupuestoFila) {
  const c = libro && libro.porId ? cifraDeHecho(libro.porId.get(id)) : null;
  if (!c) return null;
  /* compacto a propósito (el libro tiene un tope de 16 KB que además exige la base, migración 015): los dos valores de siempre —`titular: "medido"`, `tipo: "ref"`— no se escriben; `cifrasDeLaEntrega` los repone */
  return { raw: c.raw, unidad: c.unidad, clave: c.clave, dueno: c.dueno, ...(c.titular === "medido" ? {} : { titular: c.titular }), procedencia: c.procedencia, ...(c.tipo === "ref" ? {} : { tipo: c.tipo }), ...(deSupuestoFila && c.procedencia !== "medido" ? { deSupuesto: true } : {}) };
}
export function _hechosDeLaEntrega(entregaJson, { conFueraDelTexto = true } = {}) {   // exportada para `capacidad/compacto.js` (lo que viaja al anfitrión sale de la MISMA función que arma lo que el libro guarda: mismas cifras, mismos ids)
  const filas = (entregaJson && entregaJson.cifras && Array.isArray(entregaJson.cifras.filas)) ? entregaJson.cifras.filas : [];
  const libro = (entregaJson && entregaJson.procedencia && entregaJson.procedencia.libro) || null;
  /* EL TOTAL DEL LISTADO (owner 2026-10-05): cuando la Entrega sirvió un listado COMPLETO de una métrica aditiva, `componerEntrega` declaró en el libro la SUMA EXACTA de sus filas y la dejó en `cifras.totales` (no impresa en el texto).
   * Entra al libro de la conversación como un hecho más, DESPUÉS de las filas (los ids `E<n>.h<k>` de las filas no se mueven): su procedencia es «derivado» (es una suma de lo medido) y se revalida como cualquier otra cifra. */
  const totales = (entregaJson && entregaJson.cifras && Array.isArray(entregaJson.cifras.totales)) ? entregaJson.cifras.totales : [];
  const hechosDeTotales = totales.map((t, j) => {
    /* NO es una entidad (no entra a «entidades» del estado vigente): el universo se dice en la métrica («Venta · total del listado completo (13 cuentas)»). NO se revalida aparte (`deListado`, `revalidar.js`): lo revalidan sus filas; retomar lo declara «no se revalida», con su motivo, y no se afirma como vigente. */
    const universo = String(t.entidad || "").replace(/^Total del listado completo/, "total del listado completo");
    const base = { sujeto: null, metrica: [t.metrica, universo].filter(Boolean).join(" · ") || null, valor: t.valor || null, unidad: null, periodo: null, origen: "derivado", ref: t.hecho || null };
    const c = libro && t.hecho ? _cifraParaRevalidar(libro, t.hecho, false) : null;
    return c ? { ...base, rv: { ...c, dueno: "listado completo", deListado: true, prioridad: filas.length + j } } : base;
  });
  const hechoDeFila = (f, idx) => {
    const v = (f && f.valores) || {};
    const ids = Array.isArray(f.hechos) ? f.hechos : [];
    const hecho = {
      sujeto: v["Entidad / grupo"] || v["Entidad"] || null,
      metrica: v["Métrica"] || null,
      valor: v["Valor"] || null,
      unidad: null,
      periodo: null,
      origen: f.procedencia || null,
      ref: ids.length ? ids[0] : null,
    };
    if (!ids.length || !libro) return hecho;
    const prioridad = typeof f.prioridad === "number" ? f.prioridad : idx;
    const deSupuestoFila = typeof v["Supuesto"] === "string" && v["Supuesto"].trim() !== "";
    const primera = _cifraParaRevalidar(libro, ids[0], deSupuestoFila);
    if (!primera) return hecho;
    const ancha = v["Métrica"] == null && v["Valor"] == null;
    if (!ancha) return { ...hecho, rv: { ...primera, prioridad } };
    /* fila ancha: cada cifra de la fila con la columna que imprime exactamente su valor (la primera columna es el rótulo de la fila; «Tipo» no es una cifra) */
    const claves = Object.keys(v);
    const columnas = claves.filter((k, i) => i > 0 && k !== "Tipo");
    const usadas = new Set();
    const columnaDe = (id) => { const t = renderDe(libro, id); const col = columnas.find((k) => !usadas.has(k) && typeof v[k] === "string" && v[k] === t); if (col) usadas.add(col); return { col: col || null, texto: col ? v[col] : t }; };
    const l0 = columnaDe(ids[0]);
    const mas = ids.slice(1).map((id) => { const cf = _cifraParaRevalidar(libro, id, deSupuestoFila); if (!cf) return null; const l = columnaDe(id); return { ref: id, metrica: l.col, valor: l.texto, ...cf }; }).filter(Boolean);
    return { ...hecho, rv: { ...primera, prioridad, sujeto: typeof v[claves[0]] === "string" ? v[claves[0]] : null, metrica: l0.col, valor: l0.texto, ...(mas.length ? { mas } : {}) } };
  };
  /* LAS CIFRAS DE `detalle.fueraDelTexto` (owner 2026-10-05, §8.2 del Contrato del Anfitrión: «toda cifra que viaja al anfitrión lleva id»): lo que la Entrega recortó de la tabla de Cifras va al detalle y viaja al anfitrión; ahora entra al libro
   * DESPUÉS de las filas y de los totales (ningún id `E<n>.h<k>` existente se mueve), con su `rv` — así el anfitrión puede derivar sobre ellas y `retomar` las revalida. `fuera:true` las distingue: no son parte de la tabla de la Entrega (el rango de ids
   * del estado vigente y las entidades entregadas siguen siendo las de siempre). */
  const detalleFilas = conFueraDelTexto && entregaJson && entregaJson.detalle && Array.isArray(entregaJson.detalle.filas) ? entregaJson.detalle.filas : [];
  const hechosFuera = detalleFilas.map((f, j) => ({ ...hechoDeFila(f, filas.length + totales.length + j), fuera: true }));
  return filas.map(hechoDeFila).concat(hechosDeTotales, hechosFuera);
}
/* ── EL DATASET «DE HOY» DE UNA EMPRESA: la ficha que cargó + lo que declaró conversando y confirmó (bloques 2 y 3) ──────────────────────────────────────────────────────────
 * UNA sola función para `consultar` y para `retomar` (bloque 4): para que una cifra revalidada hoy salga de EXACTAMENTE el mismo dataset con el que `consultar` la daría hoy (una sola
 * verdad por eje — si las dos armaran su dataset por separado, la primera vez que una cambie sin la otra aparecería un «cambió» que no es de la realidad). Puro: sin I/O, sin red.
 *   · el perfil que la empresa declaró conversando entra a la Entrega y a Knowledge (la ficha de `tenants`, si la trae, manda); sin perfil leído es EL MISMO dataset;
 *   · los criterios que declaró y confirmó SON sus umbrales («declarado por la empresa»): van al perfil que el Core resuelve en `initTenant` (`conCriteriosDeEmpresa`); el rastro de lo que se
 *     tomó de un documento (§7.3·58) viaja con el valor;
 *   · `benchmarkDeclarado` pisa también el benchmark embebido por fila del dato (la vara de la empresa, como C.2): quien llama lo aplica DENTRO del tramo del Core (`setBenchmarkOverride`). */
export function _datasetDeLaEmpresa(datasetDelTenant, estadoPerfil, loDeclarado) {   // exportada para los candados que prueban lo MISMO que usan `consultar` y `retomar` (el piso de cobranza declarado, bloque 5)
  const datasetConPerfil = estadoPerfil ? conPerfilDeclarado(datasetDelTenant, estadoPerfil.vigentes) : datasetDelTenant;
  const criterios = loDeclarado && Array.isArray(loDeclarado.criterios) ? loDeclarado.criterios : [];
  const { dataset, aplicados: criteriosAplicados } = conCriteriosDeEmpresa(datasetConPerfil, Object.fromEntries(criterios.map((c) => [c.llave, c.valor])), procedenciasDeCriterios(criterios));
  return { dataset, criteriosAplicados, benchmarkDeclarado: criterios.find((c) => c.llave === "benchmark") || null };
}

/** crearAcciones({ continuidad?, ahora? }) → { conocerEmpresa, consultar, aportarContexto, retomar, derivar }
 *
 *  `continuidad` es el ALMACÉN inyectable de `src/adi/continuidad/almacen.js` — UNA interfaz asíncrona para la
 *  memoria en proceso (`crearAlmacenEnMemoria()`, el default: la misma instancia que usan los gates) y para
 *  Supabase (`crearAlmacenSupabase({url, apikey, pase})`, que `puerta.js` arma POR PEDIDO con el pase de la empresa
 *  de esa llamada — un almacén Supabase nunca se comparte entre empresas). Las cuatro acciones esperan a ese
 *  almacén; ninguna lo supone síncrono.
 *
 *  `ahora` es el reloj de la acción (devuelve un ISO): solo estampa CUÁNDO se entregó cada Entrega en el libro; los
 *  gates lo fijan para que la prueba no dependa de la hora.
 *
 *  `conocimiento` ({ activo?, catalogo? }) es la costura del PERFIL CONVERSANDO (bloque 2): decide si el conocimiento
 *  del oficio está encendido (default: la bandera `ADI_CONOCIMIENTO`, apagada en todos los perfiles) y con qué catálogo
 *  de piezas — de eso depende qué campos del perfil hacen falta (`perfilConversando.js:necesitaPerfil`). En producción
 *  no se pasa nada; los candados la encienden. */
export function crearAcciones({ continuidad = crearAlmacenEnMemoria(), ahora = () => new Date().toISOString(), conocimiento = {} } = {}) {
  const store = continuidad; // alias local: acá adentro es, literal, el almacén de `continuidad/almacen.js`
  const conocimientoActivo = conocimiento && conocimiento.activo != null ? Boolean(conocimiento.activo) : ADI_CONOCIMIENTO;
  const catalogoDePiezas = conocimiento && Array.isArray(conocimiento.catalogo) ? conocimiento.catalogo : PIEZAS_CONOCIMIENTO;

  /* 1 · conocerEmpresa({ tenant, conversacionId? }) → la ficha completa de la empresa activa + el catálogo
   * generado (contrato §E) + la memoria de empresa VIGENTE (criterios/hechos/documentos que la empresa declaró,
   * nunca una cifra medida) + el perfil plegado como hechos de solo lectura (`hechoDePerfilCampo`) + el estado
   * vigente de la conversación, si se indicó una.
   *
   * `hechosAportados` es SOLO lo VIGENTE (`memoriaDeEmpresa`, ya filtra por `estado:"vigente"`) — lo único que
   * cuenta como dato. `pendientesDeConfirmar` (corrección 2026-09-26, ley del owner: «proponer es del modelo,
   * confirmar es de la persona») va APARTE, nunca mezclado: un pendiente se anuncia como pendiente, jamás se
   * cuenta como lo que la empresa "ya sabe" — el LLM se lo devuelve a la persona antes de usarlo.
   *
   * ORDEN: leer la memoria y el libro (base) → tramo del Core (perfil + catálogo) → armar la respuesta. */
  async function conocerEmpresa({ tenant, conversacionId = null } = {}) {
    const forma = _validarTenant(tenant);
    if (!forma.ok) return { ok: false, motivo: forma.motivo };

    const tenantId = tenant.id || null;
    const datosDelTenant = tenant.dataset;

    // migración EN LECTURA de lo legado (007 diario / 011 contexto) — hoy vive en la versión activa del pack
    // (`_ADI_CONTINUIDAD_INTEGRACION.md`, cabecera de `continuidad/empresa.js`): `memoriaDeEmpresa` lo traduce
    // sin que este archivo tenga que saber cómo.
    const legado = {
      diario: (datosDelTenant.perfil && datosDelTenant.perfil.diario) || null,
      contexto: (datosDelTenant.perfil && datosDelTenant.perfil.contexto) || null,
    };

    // 1 · LEER (base) — todo ANTES de tocar el estado global del Core
    let memoria, pendientes, libro, estadoPerfil;
    try {
      [memoria, pendientes, libro, estadoPerfil] = await Promise.all([
        memoriaDeEmpresa(store, tenantId, { legado }),
        leerPendientes(store, tenantId, {}),
        conversacionId ? store.leerLibro(tenantId, conversacionId) : Promise.resolve(null),
        leerPerfilDeclarado(store, tenantId),
      ]);
    } catch (e) {
      if (esErrorDeAlmacen(e)) return _sinMemoria(e);
      throw e;
    }

    // 2 · EL TRAMO DEL CORE (síncrono, sin await): el perfil y el catálogo salen del dataset de ESTA empresa, con el perfil
    // que la empresa declaró conversando (solo lo confirmado) — la ficha de `tenants`, si la hay, manda sobre la memoria
    const datasetConPerfil = conPerfilDeclarado(datosDelTenant, estadoPerfil.vigentes);
    const { perfil, catalogo } = conTenantActivo(datasetConPerfil, () => ({
      perfil: construirPerfilCliente(datasetConPerfil),
      catalogo: construirCatalogo(),
    }));

    // 3 · armar la respuesta (puro)
    const perfilPlegado = Object.entries(perfil.campos || {})
      .map(([campo, v]) => hechoDePerfilCampo(campo, { codigo: v && v.valor, procedencia: v && v.procedencia }))
      .filter(Boolean);
    const estadoVigente = libro ? estadoVigenteDe(libro, { versionIdActual: tenant.version || null }) : null;

    // el NOMBRE DE LA EMPRESA sale primero del propio dataset cargado (`datosDelTenant.nombre` — "ADI Demo", el
    // nombre real del negocio) y solo si el dataset no lo trae se cae a `tenant.nombre`: en el camino SIN base de
    // `tenantService.server.js:handleData` (registro estático, sin Supabase) ese campo es el NOMBRE DE LA PERSONA
    // de la sesión firmada (`resolverTenantDeSesion`), no el de la empresa — un detalle de esa pieza compartida
    // (fuera del alcance de este corte, reportado al supervisor) que acá se evita mostrando el nombre del negocio
    // cuando el dataset lo declara.
    return {
      ok: true,
      empresa: { id: tenant.id || (datosDelTenant && datosDelTenant.id) || null, nombre: (datosDelTenant && datosDelTenant.nombre) || tenant.nombre || null },
      datos: { version: tenant.version || null, sello: tenant.sello || null, periodo: catalogo.periodos, moneda: catalogo.moneda },
      perfil: {
        campos: perfil.campos, faltantes: perfil.faltantes, completo: perfil.completo,
        // lo que la persona declaró del perfil y falta confirmar (no cuenta como dato) y lo que prefirió no decir
        ...(Object.keys(estadoPerfil.pendientes).length ? { porConfirmar: CAMPOS_PERFIL_DECLARABLES.filter((c) => estadoPerfil.pendientes[c]).map((c) => ({ id: estadoPerfil.pendientes[c].id, campo: c, valor: estadoPerfil.pendientes[c].valor, origen: "declarado" })) } : {}),
        ...(Object.keys(estadoPerfil.omitidos).length ? { omitidos: CAMPOS_PERFIL_DECLARABLES.filter((c) => estadoPerfil.omitidos[c] && !estadoPerfil.vigentes[c]) } : {}),
      },
      catalogo,
      declarable: declarable(),   // bloque 3: qué se puede declarar con lugar en la Entrega (criterios y hechos), con la forma exacta del aporte
      conversacionId: conversacionId || null,
      hechosAportados: [...memoria.hechos, ...perfilPlegado],
      /* lo que dice un documento y la empresa todavía NO confirmó es DOCUMENTAL («según <documento>, sin confirmar», §7.3·58): se anuncia así, nunca como «declarado por la empresa», y no se usa */
      pendientesDeConfirmar: pendientes.filter((h) => h.clase !== "perfil" && !esConceptoReservadoDePerfil(h.concepto)).map((h) => {
        const doc = h.documento && typeof h.documento === "object" && typeof h.documento.nombre === "string" && h.documento.nombre.trim() ? h.documento.nombre.trim() : null;
        return doc ? { ...h, etiquetaDeOrigen: etiquetaDeProcedencia({ origen: ORIGEN.DOCUMENTAL, fuente: { tipo: "documento", detalle: doc }, confirmado: false }) } : h;
      }),
      estadoVigente,
    };
  }

  /* 2 · consultar({ tenant, encargo }) → valida el Encargo v1 contra el Core (`validarEncargo`) y arma la Entrega
   * (`componerEntrega`) — CUALQUIER encargo válido, nunca un catálogo de preguntas fijas. La cabecera de USO viaja
   * SIEMPRE, incluso cuando la Entrega quedó vacía (el LLM necesita las mismas reglas para leer un `noResuelto`).
   *
   * LA CONTINUIDAD DE ESTE TURNO (`_ADI_CONTINUIDAD_INTEGRACION.md` §2), TODO en esta capa, CERO líneas tocadas
   * de `entrega/componer.js`: abre o reusa el libro de conversación, avanza criterio/supuestos vivos/premisas con
   * lo que `validarEncargo` YA resolvió y lo que `componerEntrega` YA expuso (`entrega.procedencia.libroPremisas`),
   * registra lo entregado como referencias, y antepone UNA línea de la casa al texto SOLO si hubo un evento.
   *
   * ORDEN (D2): 1 · LEER el libro (base) → 2 · TRAMO DEL CORE (initTenant + validarEncargo + componerEntrega, síncrono)
   * → 3 · avanzar el libro (puro) → 4 · ESCRIBIR el libro (base). Con `conversacionId`, todo el recorrido se
   * serializa por conversación (dos consultas cruzadas de la misma conversación no se pisan el libro). */
  async function consultar({ tenant, encargo } = {}) {
    const forma = _validarTenant(tenant);
    if (!forma.ok) return { ok: false, motivo: forma.motivo, uso: CABECERA_DE_USO };

    /* LA FORMA ANTES DEL VALOR (ensayo 2, owner 2026-10-05): una cadena suelta donde el contrato pide una lista o un objeto se lee con su única lectura posible (`formaDelEncargo.js`); lo que no se puede leer sin adivinar
     * se declara `formato_invalido` —con el campo y la forma esperada— y NUNCA como «la entidad no existe» ni «criterio desconocido». Lo bien formado pasa idéntico. */
    const leido = normalizarFormaDelEncargo(encargo);
    if (leido.formato.length) return { ok: false, entrega: null, noResuelto: leido.formato, uso: CABECERA_DE_USO };
    encargo = leido.encargo;
    const avisosDeForma = leido.avisos;

    const tenantId = tenant.id || null;
    const conversacionIdEntrante = (encargo && typeof encargo.conversacionId === "string" && encargo.conversacionId) || null;

    const trabajo = async () => {
      // 1 · LEER (base) — antes de entrar al tramo del Core
      let libroLeido = null;
      if (conversacionIdEntrante) {
        try { libroLeido = await store.leerLibro(tenantId, conversacionIdEntrante); }
        catch (e) { if (esErrorDeAlmacen(e)) return { ..._sinMemoria(e), entrega: null, noResuelto: [], uso: CABECERA_DE_USO }; throw e; }
      }

      // 1b · LO QUE LA EMPRESA DECLARÓ Y CONFIRMÓ (bloques 2 y 3) — también ANTES del tramo del Core, con UNA sola lectura de la
      // memoria: el perfil que declaró conversando (bloque 2) y sus criterios y hechos (bloque 3). Si la base no responde, la
      // consulta sigue SIN ellos (sin perfil ni declarados el Core funciona igual) y lo declara: nunca finge.
      let estadoPerfil = null;
      let perfilNoDisponible = false;
      let loDeclarado = { criterios: [], hechos: [], plazos: [] };
      try {
        const filasDeLaMemoria = (await store.leerHechosEmpresa(tenantId)) || [];
        estadoPerfil = perfilDeLasFilas(filasDeLaMemoria);
        loDeclarado = clasificarLoDeclarado(filasDeLaMemoria);   // SOLO lo vigente (confirmado): un pendiente nunca entra
      } catch (e) { if (!esErrorDeAlmacen(e)) throw e; perfilNoDisponible = true; }
      // lo CONFIRMADO alimenta a la Entrega y a Knowledge (la ficha de `tenants`, si la trae, manda); sin nada que agregar
      // es EL MISMO dataset (cero diferencia con lo de antes del bloque)
      // los criterios que la empresa declaró y confirmó SON sus umbrales («declarado por la empresa»): van al perfil de la empresa que el Core resuelve en `initTenant`
      // (el mismo camino de `umbral()`); sin ninguno es EL MISMO dataset (cero diferencia con lo de antes del bloque). Es `_datasetDeLaEmpresa`, la MISMA que usa `retomar`.
      const { dataset, criteriosAplicados, benchmarkDeclarado } = _datasetDeLaEmpresa(tenant.dataset, estadoPerfil, loDeclarado);

      // 2 · EL TRAMO DEL CORE — síncrono, sin una sola espera entre `initTenant` y el cálculo
      const { resolucion, salida, perfilCliente, hechosContrastados } = conTenantActivo(dataset, () => {
        // el benchmark declarado pisa también el benchmark embebido por fila del dato (la vara de la empresa, como C.2): lo limpia el siguiente `initTenant` (el de `conTenantActivo` al salir)
        if (benchmarkDeclarado) setBenchmarkOverride(benchmarkDeclarado.valor);
        // `libro: libroLeido` = la cita `contexto: E1` se resuelve contra lo que ESTA conversación ya entregó (bloque 3)
        const resolucion = validarEncargo(encargo, { libro: libroLeido });
        /* FAMILIA 5 (§7.3·48d): `componerEntrega` ya pasa TODA la Entrega por `verificarEntrega` antes de que salga (`entrega/componer.js:servirConGarantia`): el invariante del universo propio (§7.3·17) la declina entera, y una oración que el verificador rechaza se retira y se declara. Acá no se audita por segunda vez (era la tercera copia de la regla 18). */
        const salida = componerEntrega(resolucion);
        // lo declarado al lado de lo medido de la MISMA métrica y la MISMA entidad (la Entrega ya compuesta no se toca)
        const marcoPeriodo = salida.ok && salida.entrega && salida.entrega.marco && salida.entrega.marco.periodo;
        const hechosContrastados = salida.ok && salida.entrega && loDeclarado.hechos.length
          ? contrastarHechos({ hechos: loDeclarado.hechos, libro: salida.entrega.procedencia && salida.entrega.procedencia.libro, resolucion, periodos: marcoPeriodo ? [marcoPeriodo.texto, marcoPeriodo.rango, typeof marcoPeriodo.valor === "string" ? marcoPeriodo.valor : null] : [] })
          : [];
        return { resolucion, salida, perfilCliente: estadoPerfil ? construirPerfilCliente(dataset) : null, hechosContrastados };
      });

      // 3 · avanzar el libro (puro — no toca el Core ni la base)
      const versionIdActivo = tenant.version != null ? tenant.version : null;
      let libro = libroLeido;
      const esNueva = !libro;
      if (!libro) {
        libro = libroNuevo({ versionId: versionIdActivo, empresaId: tenantId });
      }
      const cambioVersion = detectarCambioVersion(libro, versionIdActivo);

      const eventosBase = { cambioVersion, cifrasReverificadas: [], premisasFalsas: [], criterioCambio: null, supuestosVivosRelevantes: [] };
      let fueraSinId = false;   /* las cifras de `fueraDelTexto` no caben en el libro (16 KB): se entregan como siempre, sin id (ver más abajo) */

      if (salida.ok && salida.entrega) {
        // § criterio (§4·2 del contrato del encargo, ya resuelto por `validarEncargo` — nunca se infiere acá)
        const criterioAntes = libro.criterioVigente;
        if (resolucion.criterio) libro = actualizarCriterio(libro, resolucion.criterio);
        if (resolucion.criterio && resolucion.criterio.origen === "usuario" && JSON.stringify(criterioAntes && criterioAntes.valor) !== JSON.stringify(libro.criterioVigente && libro.criterioVigente.valor)) {
          eventosBase.criterioCambio = { de: _etiquetaCriterio(criterioAntes), a: _etiquetaCriterio(libro.criterioVigente) };
        }

        // § premisas — el veredicto YA lo calculó `componerEntrega` (mismo `libroDeHechos` que juzga la Entrega,
        // expuesto en `procedencia.libroPremisas`): esta capa solo LEE, nunca re-juzga (ley «premisa-adoptada»).
        const libroPremisas = salida.entrega.procedencia && salida.entrega.procedencia.libroPremisas;
        for (const p of (resolucion.premisas || [])) {
          const H = libroPremisas && libroPremisas.porId ? libroPremisas.porId.get(String(p.id)) : null;
          if (!H) continue;
          libro = registrarPremisa(libro, { id: p.id, hecho: p, veredicto: H.veredicto, verdadId: (H.derivados && H.derivados[0]) || null });
          if (H.veredicto === "falsa") eventosBase.premisasFalsas.push({ id: p.id, texto: H.verdad || H.motivo || p.id });
        }

        // § supuestos vivos — «relevante» = ya estaba vivo ANTES de este turno (un supuesto recién declarado en
        // este mismo encargo no es una sorpresa de continuidad: el usuario lo acaba de pedir).
        const vivosAntes = new Set((libro.supuestosVivos || []).map((s) => s.id));
        for (const s of (resolucion.supuestos || [])) {
          libro = agregarSupuestoVivo(libro, { id: s.id, concepto: s.tipo, tipo: s.tipo, valor: s.valor, unidad: s.unidad, alcance: s.alcance });
          if (vivosAntes.has(s.id)) eventosBase.supuestosVivosRelevantes.push({ id: s.id, texto: _etiquetaSupuesto(s) });
        }

        // § lo entregado, como referencias (paso 8) — ver `_hechosDeLaEntrega`
        const hechosParaLibro = _hechosDeLaEntrega(salida.entrega);
        const entidadesEntregadas = [...new Set(hechosParaLibro.filter((h) => !h.fuera).map((h) => h.sujeto).filter(Boolean))];   /* las de la tabla de la Entrega: las cifras de `fueraDelTexto` entran al libro con id pero no cambian quiénes se entregaron */
        const cierres = [...new Set((resolucion.partes || []).map((p) => p.cierre).filter(Boolean))];
        const entradaDeLaEntrega = {
          versionId: versionIdActivo,
          temas: salida.entrega.temasCubiertos || [],
          entidades: entidadesEntregadas,
          cierre: cierres.length === 1 ? cierres[0] : (cierres.length ? cierres.join("+") : null),
          hechos: hechosParaLibro,
          universos: salida.entrega.universos || [],
          entregadaEn: ahora(),
          periodo: (salida.entrega.marco && salida.entrega.marco.periodo) || null,
          // BLOQUE 4: lo que hace falta para REVALIDAR esta Entrega al retomar (el Encargo, con qué referencias se calculó, la moneda): se guarda en el libro, nunca sale en esta respuesta
          revalidable: true, encargo: encargoParaElLibro(resolucion.encargo), referencias: referenciasDe({ criteriosAplicados, marco: salida.entrega.marco }), moneda: (salida.entrega.marco && salida.entrega.marco.moneda) || null,
        };
        let conFuera = registrarEntrega(libro, entradaDeLaEntrega);
        /* EL TOPE DE 16 KB MANDA (Contrato del Anfitrión, §8.2): las cifras de `fueraDelTexto` con id entran al libro SOLO si con ellas el libro no recorta más Entregas que sin ellas — nunca le cuestan al hilo una Entrega que antes se conservaba.
         * Si no caben, esta Entrega queda como siempre (sin esas cifras en el libro) y sus cifras de `fueraDelTexto` viajan SIN id: no se puede derivar sobre lo que el libro no guarda. */
        if (hechosParaLibro.some((h) => h.fuera)) {
          const sinFuera = registrarEntrega(libro, { ...entradaDeLaEntrega, hechos: hechosParaLibro.filter((h) => !h.fuera) });
          const vivas = (L) => L.entregas.filter((e) => !e.recortada).length;
          if (vivas(conFuera) < vivas(sinFuera)) { conFuera = sinFuera; fueraSinId = true; }
        }
        libro = conFuera;
      }

      // 4 · ESCRIBIR (base) — después de salir del tramo del Core. Si SOLO falla guardar, la Entrega (verdadera) se
      // entrega igual y se DECLARA que la conversación no quedó guardada: nunca se finge una continuidad que no existe.
      let guardada = true;
      let operacionFallida = null;
      try { await store.guardarLibro(tenantId, libro); }
      catch (e) { if (!esErrorDeAlmacen(e)) throw e; guardada = false; operacionFallida = e.operacion || null; }

      const estadoVigente = estadoVigenteDe(libro, { versionIdActual: versionIdActivo });
      /* lenguaje empresarial también en `consultar` (owner 2026-10-04, bloque 4): la línea dice «los datos cambiaron desde la Entrega N», nunca ids de carga («1 → 2») */
      const eventos = eventosDeContinuidad({ ...eventosBase, lenguajeDeNegocio: true });
      const lineaContinuidad = lineaDeContinuidad(eventos);
      let textoConContinuidad = salida.ok && lineaContinuidad ? `${lineaContinuidad}\n\n${salida.texto}` : (salida.ok ? salida.texto : "");

      // 4b · LO QUE ESTA ENTRADA NUEVA AGREGA A LA ENTREGA (bloque 3) — solo si hay una cita que resolvió o algo declarado en juego; sin ellos
      // el texto y la respuesta son EXACTAMENTE los de antes. La Entrega compuesta no se toca: se agregan, al final, el antecedente que se citó
      // (tal cual quedó guardado, sin recalcular) y lo declarado al lado de lo medido.
      const usarPedido = resolucion.encargo && typeof resolucion.encargo.usar === "string" ? resolucion.encargo.usar : null;
      const antecedentes = salida.ok && resolucion.contextoResuelto ? antecedentesDe(resolucion.contextoResuelto, { versionActiva: versionIdActivo }) : [];
      // el plazo de cobro declarado que la pregunta abierta de cobranza de esta Entrega cita (opción A, §7.3·58): se muestra con su origen y NO cambia ningún cálculo
      const plazosEnJuego = salida.ok && salida.entrega && loDeclarado.plazos.length ? plazosCitados({ plazos: loDeclarado.plazos, entrega: salida.entrega }) : [];
      const declarado = salida.ok && (criteriosAplicados.length || hechosContrastados.length || plazosEnJuego.length) ? {
        criterios: loDeclarado.criterios.map((c) => {
          const a = criteriosAplicados.find((x) => x.llave === c.llave);
          return { id: c.id, concepto: c.concepto, rotulo: c.rotulo, valor: c.valor, unidad: c.unidad, origen: c.origen, etiquetaDeOrigen: etiquetaDeProcedencia(c.procedencia), fuente: c.procedencia.fuente, sello: c.sello, aplicadoComo: aplicadoComoDe(c, { conocimientoActivo }), ...(a ? { desplaza: { valor: a.desplaza.valor, origen: a.desplaza.origen, etiquetaDeOrigen: ETIQUETA_ORIGEN[a.desplaza.origen] || null } } : {}) };
        }),
        hechos: hechosContrastados.map((h) => ({ id: h.id, concepto: h.concepto, rotulo: h.rotulo, entidad: h.entidad, periodo: h.periodo, valor: h.valor, unidad: h.unidad, origen: h.origen, etiquetaDeOrigen: etiquetaDeProcedencia(h.procedencia), fuente: h.procedencia.fuente, sello: h.sello, estado: h.estado, medido: h.medido, diferencia: h.diferencia, ...(h.motivoNoComparable ? { motivoNoComparable: h.motivoNoComparable } : {}) })),
        ...(plazosEnJuego.length ? { plazos: plazosEnJuego.map((q) => ({ id: q.id, concepto: q.concepto, rotulo: q.rotulo, entidad: q.entidad, valor: q.valor, unidad: q.unidad, origen: q.origen, etiquetaDeOrigen: etiquetaDeProcedencia(q.procedencia), fuente: q.procedencia.fuente, sello: q.sello, citadoPor: { tipo: "pregunta_abierta", sobre: q.citadoPor.entidad, pregunta: q.citadoPor.pregunta }, nota: "no cambia ningún cálculo: el saldo vencido sigue siendo el medido" })) } : {}),
        ...(usarPedido ? { usar: { pedido: usarPedido, aplicado: "medido", nota: "ADI no calcula sobre lo declarado ni lo pone en lugar de lo medido: lo declarado se muestra al lado, con su origen." } } : {}),
        uso: USO_DE_LO_DECLARADO,
      } : null;
      if (salida.ok) {
        const agregado = [textoDeAntecedentes(antecedentes), textoDeLoDeclarado({ hechos: hechosContrastados, plazos: plazosEnJuego, usar: usarPedido })].filter(Boolean).join("\n\n");
        if (agregado) textoConContinuidad = `${textoConContinuidad}\n\n${agregado}`;
      }

      // 5 · EL PERFIL CONVERSANDO: qué falta de lo que se pidió (una sola pregunta, nunca repetida), lo por confirmar y lo
      // limitado por una omisión. `null` cuando no hay nada que decir: «si no falta nada, no pide nada».
      let bloquePerfil = null;
      if (perfilNoDisponible) bloquePerfil = { disponible: false, motivo: "no se pudo leer el perfil que la empresa declaró (la memoria no respondió): esta consulta se respondió sin él." };
      else if (salida.ok && estadoPerfil) {
        try {
          bloquePerfil = await armarPerfilConversando({
            store, tenantId, conversacionId: libro.conversacionId, encargo: resolucion, perfilCliente, estado: estadoPerfil,
            activo: conocimientoActivo, catalogo: catalogoDePiezas,
          });
        } catch (e) {
          if (!esErrorDeAlmacen(e)) throw e;
          bloquePerfil = { disponible: false, motivo: "no se pudo leer el perfil que la empresa declaró (la memoria no respondió): esta consulta se respondió sin él." };
        }
      }

      return {
        ok: Boolean(salida.ok),
        entrega: salida.ok ? (fueraSinId ? Object.defineProperty({ texto: textoConContinuidad, json: salida.entrega }, "fueraSinId", { value: true }) : { texto: textoConContinuidad, json: salida.entrega }) : null,   /* `fueraSinId`: no enumerable —no sale en el JSON—; solo se lo dice a `compacto.js` */
        noResuelto: resolucion.noResuelto || [],
        uso: CABECERA_DE_USO,
        ...(avisosDeForma.length ? { advertencias: avisosDeForma } : {}),
        ...(bloquePerfil ? { perfil: bloquePerfil } : {}),
        ...(declarado ? { declarado } : {}),
        ...(antecedentes.length ? { antecedentes } : {}),
        continuidad: {
          conversacionId: libro.conversacionId,
          nueva: esNueva,
          motivoNueva: esNueva ? (conversacionIdEntrante ? "el conversacionId indicado no existe: se abrió una conversación nueva" : "no llegó un conversacionId: se abrió una conversación nueva") : null,
          estadoVigente,
          guardada,
          ...(guardada ? {} : { motivoNoGuardada: "la conversación no se pudo guardar en la memoria de la empresa: esta respuesta es correcta, pero retomarla más tarde no va a encontrar este turno.", operacion: operacionFallida }),
        },
        meta: {
          conversacionId: libro.conversacionId,
          motivo: salida.motivo || null,
          avisos: resolucion.avisos || [],
          criterio: resolucion.criterio || null,
        },
      };
    };

    return conversacionIdEntrante ? serializarPorClave(`libro|${tenantId}|${conversacionIdEntrante}`, trabajo) : trabajo();
  }

  /* 3 · aportarContexto({ tenant, conversacionId?, aportes?, confirmar? }) → registra lo que el usuario declaró
   * (criterio, hecho, documento y —bloque 2— un campo del PERFIL: sector, tipo de producto, modelo comercial, país, con
   * el código de una opción de la taxonomía; `omitir` = «prefiero no decirlo») en la MEMORIA DE EMPRESA real
   * (`continuidad/empresa.js`). Nunca pisa un medido — esta memoria no tiene medidos (ley «un declarado nunca pisa un
   * medido», satisfecha por construcción, ver la cabecera de `empresa.js`).
   *
   * CORRECCIÓN (owner 2026-09-26, ley aprobada): «un dato declarado o leído de un documento se devuelve para
   * confirmar ANTES de usarlo; proponer es del modelo, confirmar es de la persona.» TODO aporte nuevo (haya o
   * no colisión con otro declarado) entra `"pendiente"` con `paraConfirmar:true` y el `entendido` canónico —
   * la ÚNICA salida directa es declarar EXACTAMENTE el mismo valor ya vigente (nada nuevo que confirmar). Un
   * aporte con colisión de valor queda además con `conflictoCon`. Ningún pendiente cuenta como dato: no aparece
   * en `hechosAportados` de `conocerEmpresa` (solo vigentes), solo en `pendientesDeConfirmar`. Confirmar
   * (`confirmarHecho`) es lo único que promueve a `"vigente"` — y NUNCA toca el origen (ley del owner, textual).
   *
   * NO TOCA EL CORE: no usa el estado global del tenant (los aportes y el libro viajan con `tenantId`), así que no
   * entra a `conTenantActivo`. Los aportes se procesan EN ORDEN, de a uno (el segundo ve al primero), y toda la
   * acción se serializa por conversación Y por empresa (el libro y la memoria se leen-y-escriben). */
  async function aportarContexto({ tenant, conversacionId = null, aportes = [], confirmar = [], omitir = [] } = {}) {
    const forma = _validarTenant(tenant);
    if (!forma.ok) return { ok: false, motivo: forma.motivo };

    const tenantId = tenant.id || null;
    const idDeConversacion = conversacionId || emitirConversacionId();
    const versionIdActivo = tenant.version != null ? tenant.version : null;

    const trabajo = async () => {
      try {
        let libro = (await store.leerLibro(tenantId, idDeConversacion)) || libroNuevo({ conversacionId: idDeConversacion, versionId: versionIdActivo, empresaId: tenantId });

        const listaAportes = Array.isArray(aportes) ? aportes : [];
        const listaConfirmar = Array.isArray(confirmar) ? confirmar : [];

        const resultados = [];
        for (const crudo of listaAportes) {
          const { valido, motivo, entendido } = _entenderAporte(crudo);
          if (!valido) { resultados.push({ id: null, estado: "rechazado", motivo, recibido: crudo }); continue; }

          // EL PERFIL (bloque 2): el anfitrión devuelve el valor TIPADO (el código de una opción); ADI lo valida contra la
          // taxonomía y lo guarda como «declarado»/pendiente. Un valor fuera de la taxonomía se rechaza diciendo los válidos.
          if (entendido.clase === "perfil") {
            const codigo = _codigoDePerfil(entendido.valor);
            const rp = await declararPerfilCampo(store, tenantId, { campo: entendido.concepto, codigo, sectorDelDataset: _sectorDeLaFicha(tenant.dataset) }, { actorLabel: "anfitrion", conversacionId: idDeConversacion });
            if (!rp.ok) {
              resultados.push({ id: null, estado: "rechazado", motivo: rp.motivo, ...(rp.validos ? { validos: _validosParaElAnfitrion(entendido.concepto, rp.validos) } : {}), recibido: crudo });
              continue;
            }
            if (rp.id) libro = registrarHechoAportado(libro, rp.id);
            resultados.push({
              id: rp.id, estado: rp.estado,
              entendido: { clase: "perfil", concepto: entendido.concepto, valor: codigo, origen: "declarado" },
              conflictoCon: rp.conflictoCon || null,
              paraConfirmar: rp.estado === "pendiente",
            });
            continue;
          }

          // UN CRITERIO CON LUGAR EN LA ENTREGA (bloque 3): el concepto es el id de una referencia de la casa y el valor un número en su
          // unidad y su rango — se valida AQUÍ (ADI no lee lenguaje: es una tabla cerrada), y lo que no sirve se rechaza diciendo por qué.
          // Un criterio con otro concepto no se rechaza: se guarda, y `lugar` dice que no se usa en la Entrega.
          if (entendido.clase === "criterio" && esReferenciaDeLaCasa(entendido.concepto)) {
            const vc = _valorParaEmpresa(entendido.valor, entendido.unidad);
            const rv = validarCriterio({ concepto: entendido.concepto, raw: vc.raw, unidad: vc.unidad, entidad: entendido.entidad, periodo: entendido.periodo });
            if (!rv.ok) { resultados.push({ id: null, estado: "rechazado", motivo: rv.motivo, recibido: crudo }); continue; }
          }

          const aporte = {
            clase: entendido.clase,
            concepto: entendido.concepto,
            entidad: entendido.entidad,
            periodo: entendido.periodo,
            valor: _valorParaEmpresa(entendido.valor, entendido.unidad),
            origen: entendido.clase === "documento" ? "documento" : "declarado",
            documento: entendido.documento,
          };
          const r = await declararHecho(store, tenantId, aporte, { actorLabel: "anfitrion", conversacionId: idDeConversacion });
          if (!r.ok) { resultados.push({ id: null, estado: "rechazado", motivo: r.motivo, recibido: crudo }); continue; }

          if (r.id) libro = registrarHechoAportado(libro, r.id);

          resultados.push({
            id: r.id,
            estado: r.estado,
            entendido: { clase: entendido.clase, concepto: entendido.concepto, entidad: entendido.entidad, periodo: entendido.periodo, valor: entendido.valor, unidad: entendido.unidad },
            conflictoCon: r.conflictoCon || null,
            paraConfirmar: r.estado === "pendiente",
            lugar: lugarDeAporte(entendido, { conocimientoActivo }),   // dónde se usaría cuando se confirme (o que se queda en la memoria): se dice AL DECLARARLO
          });
        }

        const confirmaciones = [];
        for (const id of listaConfirmar) {
          const r = await confirmarHecho(store, tenantId, id, { actorLabel: "anfitrion", medio: "chat-anfitrion", resolverConflicto: true });
          confirmaciones.push({ id, confirmado: Boolean(r.ok) });
        }

        // «prefiero no decirlo» (bloque 2): se guarda la omisión de ESA conversación —ADI no vuelve a preguntar ese campo en
        // ella— y se declara qué queda limitado. Solo campos del perfil; lo ya declarado no se omite.
        const omitidos = [];
        for (const campo of (Array.isArray(omitir) ? omitir : [])) {
          const ro = await omitirPerfilCampo(store, tenantId, campo, { actorLabel: "anfitrion", conversacionId: idDeConversacion });
          omitidos.push(ro.ok ? { campo, ok: true, ...(ro.duplicado ? { yaOmitido: true } : {}), limitacion: textoDeLimitacion(campo) } : { campo, ok: false, motivo: ro.motivo });
        }

        await store.guardarLibro(tenantId, libro);

        return {
          ok: true,
          conversacionId: idDeConversacion,
          resultados,
          confirmaciones,
          ...(omitidos.length ? { omitidos } : {}),
          estadoVigente: estadoVigenteDe(libro, { versionIdActual: versionIdActivo }),
        };
      } catch (e) {
        if (esErrorDeAlmacen(e)) return { ..._sinMemoria(e), conversacionId: idDeConversacion };
        throw e;
      }
    };

    // libro de la conversación (afuera) → memoria de la empresa (adentro): SIEMPRE ese orden, para no cruzar candados
    return serializarPorClave(`libro|${tenantId}|${idDeConversacion}`, () => serializarPorClave(`memoria|${tenantId}`, trabajo));
  }

  /* 4 · retomar({ tenant, conversacionId }) → el estado vigente + las cifras de las Entregas de esa conversación REVALIDADAS contra los datos de hoy (`continuidad/retomar.js` +
   * `continuidad/revalidar.js`), sin recomponer prosa. (Etapa 2, bloque 4 · owner 2026-10-04; antes devolvía todo «sin_reverificar», el límite declarado del corte 9.)
   *
   * EL MECANISMO: revalidar = volver a hacerle al Core, HOY, la MISMA pregunta tipada que se le hizo entonces (el Encargo que el libro guardó con cada Entrega) y comparar cifra por cifra,
   * por llave y con crudos. Ni un camino nuevo de evidencia ni una segunda verdad: la cifra «actual» es la que `consultar` daría hoy, con el mismo dataset (`_datasetDeLaEmpresa`: la ficha
   * + lo que la empresa declaró y confirmó). `entrega/componer.js` no se toca. Cómputo determinístico: cero LLM, cero red.
   *
   * ORDEN (D2): 1 · LEER (base: el libro y la memoria) → 2 · TRAMO DEL CORE (`conTenantActivo`, síncrono: re-corre cada Entrega revalidable) → 3 · comparar (puro) → 4 · armar la respuesta.
   * SOLO LEE: no registra la re-corrida como una Entrega y no escribe el libro — lo que se entregó se devuelve tal cual quedó guardado, y lo que cambió se DICE, nunca se reescribe («el pasado
   * no se reescribe»). Una conversación de otra empresa se rechaza por su propio dato (`empresaId`), además de la llave del almacén.
   *
   * QUÉ DICE: `hechos[]` (cada cifra con su `revalidacion` tipada: igual · cambio · ya_no_existe · no_comparable · no_se_revalida · sin_reverificar), `resumen` (el conteo por estado), `eventos` y
   * UNA línea de la casa (`lineaContinuidad`) SOLO si pasó algo: nombra hasta 3 cambios y dice cuántos más hay. `advertencias` solo declara lo que NO se pudo revalidar y por qué. */
  async function retomar({ tenant, conversacionId } = {}) {
    const forma = _validarTenant(tenant);
    if (!forma.ok) return { ok: false, motivo: forma.motivo };
    if (!conversacionId || typeof conversacionId !== "string") return { ok: false, motivo: "falta conversacionId" };

    const tenantId = tenant.id || null;
    const versionIdActivo = tenant.version != null ? tenant.version : null;

    // 1 · LEER (base) — todo ANTES de tocar el estado global del Core. Si la base no responde, no se revalida contra «lo que haya»: falla cerrado, como las otras acciones.
    let libro, filasDeLaMemoria = [];
    try {
      libro = await store.leerLibro(tenantId, conversacionId);
      if (libro) filasDeLaMemoria = (await store.leerHechosEmpresa(tenantId)) || [];
    } catch (e) { if (esErrorDeAlmacen(e)) return { ..._sinMemoria(e), conversacionId }; throw e; }
    if (!libro) return { ok: false, motivo: "no existe una conversación con ese id", conversacionId };
    if (libro.empresaId && tenantId && libro.empresaId !== tenantId) return { ok: false, motivo: "esta conversación es de otra empresa", conversacionId };

    // 2 · EL TRAMO DEL CORE — síncrono, sin una sola espera: la pregunta de cada Entrega revalidable, repetida con los datos de hoy
    const { dataset: datasetDeHoy, criteriosAplicados, benchmarkDeclarado } = _datasetDeLaEmpresa(tenant.dataset, perfilDeLasFilas(filasDeLaMemoria), clasificarLoDeclarado(filasDeLaMemoria));
    const aRevalidar = (libro.entregas || []).filter((e) => e && !e.recortada && e.revalidable === true && e.encargo && typeof e.encargo === "object");
    const corridas = new Map();
    if (aRevalidar.length) {
      conTenantActivo(datasetDeHoy, () => {
        for (const e of aRevalidar) {
          try {
            if (benchmarkDeclarado) setBenchmarkOverride(benchmarkDeclarado.valor);   // como en `consultar`: la vara declarada pisa el benchmark embebido por fila
            const resolucion = validarEncargo(e.encargo, {});
            const salida = componerEntrega(resolucion);
            const noResuelto = (resolucion.noResuelto || []).slice(0, 6).map((n) => ({ campo: n.campo || null, motivo: n.motivo || null, valor: typeof n.valor === "string" || typeof n.valor === "number" ? n.valor : null }));
            corridas.set(e.n, {
              ok: Boolean(salida.ok && salida.entrega),
              libro: salida.ok && salida.entrega && salida.entrega.procedencia ? salida.entrega.procedencia.libro : null,
              marco: salida.ok && salida.entrega ? salida.entrega.marco : null,
              parteResuelta: (resolucion.partes || []).length > 0 && resolucion.partes.every((p) => p.estado === "resuelta"),
              noResuelto,
            });
          } catch (err) { corridas.set(e.n, { ok: false, noResuelto: [], error: true }); }   // una Entrega que no se puede repetir no tumba a las demás: queda «sin_reverificar», con su motivo
        }
      });
    }

    // 3 · comparar (puro): cada Entrega contra SU re-corrida
    const resultados = new Map();
    for (const e of libro.entregas || []) {
      if (!e || e.recortada) continue;
      const corrida = corridas.get(e.n);
      resultados.set(e.n, revalidarEntrega(e, corrida && corrida.ok
        ? { libroActual: corrida.libro, marcoActual: corrida.marco, referenciasActuales: referenciasDe({ criteriosAplicados, marco: corrida.marco }), versionIdActual: versionIdActivo, parteResuelta: corrida.parteResuelta, noResuelto: corrida.noResuelto, renderDe }
        : { versionIdActual: versionIdActivo, noResuelto: corrida ? corrida.noResuelto : [], renderDe }));
    }

    // 4 · armar la respuesta
    const r = reverificarConversacion(libro, { versionIdActual: versionIdActivo, reverificar: reverificadorDe(resultados), lenguajeDeNegocio: true });

    // lo que NO se pudo revalidar, y por qué (nada de esto es un cambio: es lo que el anfitrión no debe afirmar como vigente)
    const advertencias = [];
    const sinVerificar = new Map();
    for (const h of r.hechos) if (h.estadoReverificacion === "sin_reverificar") { const m = (h.revalidacion && h.revalidacion.motivo) || "no se pudo revalidar"; sinVerificar.set(m, (sinVerificar.get(m) || 0) + 1); }
    for (const [m, n] of sinVerificar) advertencias.push(`${n} ${n === 1 ? "cifra" : "cifras"} sin revalidar: ${m}.`);
    for (const e of libro.entregas || []) if (e && e.recortada) advertencias.push(`la Entrega E${e.n} se recortó por tamaño: ya no conserva sus cifras, así que no se pueden revalidar.`);
    if (!r.hechos.length && !advertencias.length) advertencias.push("esta conversación todavía no tiene cifras entregadas que revalidar.");

    return {
      ok: true,
      conversacionId,
      estadoVigente: r.estadoVigente,
      hechos: r.hechos,
      resumen: r.resumen,
      entregas: r.entregas,
      eventos: r.eventos,
      lineaContinuidad: r.lineaContinuidad,
      advertencias,
      uso: CABECERA_DE_RETOMAR,
    };
  }

  /* 5 · derivar({ tenant, conversacionId, operacion, sobre, base?, condicion? }) → un HECHO NUEVO (`D<k>`, procedencia «derivado») calculado por ADI sobre cifras que ya entregó en esta conversación (Contrato del Anfitrión, owner 2026-10-05:
   * «si necesita una cifra, total, porcentaje, conteo o diferencia que ADI no le entregó, debe volver a ADI en vez de calcularlo»). Suma · diferencia · participación · conteo, con aritmética exacta sobre los crudos del libro
   * (`derivar.js`, puro). NO toca el Core: no pasa por `validarEncargo` ni `componerEntrega` ni entra a `conTenantActivo` — opera sobre el libro de la conversación.
   *
   * ORDEN (D2): 1 · LEER el libro (base) → 2 · calcular (puro, sin Core) → 3 · ESCRIBIR el libro (base), todo serializado por conversación (el mismo candado que `consultar`). A diferencia de `consultar`, que entrega la Entrega
   * verdadera aunque no pueda guardar, acá el id ES el producto: si GUARDAR falla, la acción FALLA CERRADA (`memoria:"no_disponible"`) — un `D1` que no quedó guardado se reasignaría al siguiente pedido. IDEMPOTENTE: el mismo pedido
   * (operación, operandos, base, condición) devuelve la derivación que ya existe (`repetida:true`) y NO escribe el libro. */
  async function derivar({ tenant, conversacionId = null, operacion, sobre, base, condicion } = {}) {
    const forma = _validarTenant(tenant);
    if (!forma.ok) return { ok: false, motivo: forma.motivo, uso: CABECERA_DE_USO };
    const tenantId = tenant.id || null;
    if (!conversacionId || typeof conversacionId !== "string") {
      const v = validarDerivacion(null, { conversacionId: null, operacion, sobre });
      return { ok: false, motivo: v.motivo, detalle: v.detalle, uso: CABECERA_DE_USO };
    }
    const trabajo = async () => {
      let libro;
      try { libro = await store.leerLibro(tenantId, conversacionId); }
      catch (e) { if (esErrorDeAlmacen(e)) return { ..._sinMemoria(e), conversacionId, uso: CABECERA_DE_USO }; throw e; }
      const pedido = { conversacionId, operacion, sobre, base, condicion };
      const v = validarDerivacion(libro, pedido, { tenantId });
      if (!v.ok) return { ok: false, motivo: v.motivo, detalle: v.detalle, ...(v.ids ? { ids: v.ids } : {}), uso: CABECERA_DE_USO };

      const llave = llaveDeDerivacion({ operacion: v.operacion, sobre: v.operandos.map((x) => x.id), base: v.base ? v.base.id : null, condicion: v.condicion });
      const previa = derivacionesDe(libro).find((d) => llaveDeDerivacion(d) === llave);
      if (previa) {
        const ids = [...previa.sobre, ...(previa.base ? [previa.base] : []), ...(previa.condicion && typeof previa.condicion.valor === "string" ? [previa.condicion.valor] : [])];
        return { ok: true, conversacionId, ...respuestaDeLaDerivacion(previa, cifrasDeLosOperandos(libro, ids)), repetida: true, continuidad: { conversacionId, guardada: true }, uso: CABECERA_DE_USO };
      }

      const c = calcularDerivacion(v);
      if (!c) return { ok: false, motivo: "operando_sin_valor_exacto", detalle: "no se pudo calcular la derivación con las cifras indicadas", uso: CABECERA_DE_USO };
      const nuevo = registrarDerivacion(libro, derivacionParaElLibro(pedido, v, c));
      try { await store.guardarLibro(tenantId, nuevo); }
      catch (e) { if (esErrorDeAlmacen(e)) return { ..._sinMemoria(e), conversacionId, uso: CABECERA_DE_USO }; throw e; }
      const d = nuevo.derivaciones[nuevo.derivaciones.length - 1];
      const operandosPorId = new Map([...v.operandos, ...(v.base ? [v.base] : []), ...(v.referencia ? [v.referencia] : [])].map((x) => [x.id, x]));
      return { ok: true, conversacionId, ...respuestaDeLaDerivacion(d, operandosPorId), repetida: false, continuidad: { conversacionId, guardada: true }, uso: CABECERA_DE_USO };
    };
    return serializarPorClave(`libro|${tenantId}|${conversacionId}`, trabajo);
  }

  return { conocerEmpresa, consultar, aportarContexto, retomar, derivar };
}
