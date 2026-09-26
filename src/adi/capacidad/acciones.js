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
 * del Core — ver su cabecera). Cada acción de acá llama `initTenant(tenant.dataset)` ANTES de tocar el Core, así
 * que el resultado depende solo de lo que el LLAMADOR inyectó, nunca de una sesión anterior que haya quedado
 * activa por accidente — esa es toda la superficie de "pureza" que este corte necesita y la única que se puede
 * dar sin reescribir el Core para que reciba el dataset por parámetro en cada función.
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
 * ═══ CORTE 9 (owner 2026-09-26) — LA CONTINUIDAD REAL, YA NO EL DOBLE ═══════════════════════════════════════════
 * `continuidadMemoria.js` (el doble en memoria de esta pieza) se RETIRA: el carril B publicó la continuidad real
 * en `src/adi/continuidad/` (memoria de empresa + libro de conversación + estado vigente + retomar, sobre un
 * ALMACÉN inyectable — `continuidad/almacen.js`). Lo que este archivo llamaba `continuidad` (con las cinco
 * funciones del doble: `nuevaConversacion`/`obtenerEstado`/`registrarAporte`/`confirmarAporte`/`listarAportes`)
 * pasa a ser, LITERAL, el ALMACÉN de `_ADI_CONTINUIDAD_INTEGRACION.md` §1: `crearAlmacenEnMemoria()` por defecto
 * en los gates y en la puerta (un proceso, una instancia — ver `puerta.js`), o `crearAlmacenSupabase(...)` el día
 * que el owner autorice aplicar la migración 015 (HOY no aplicada: este archivo NUNCA la importa por defecto).
 * Las funciones PURAS de `continuidad/` (`empresa.js`, `libro.js`, `estadoVigente.js`, `retomar.js`) se llaman
 * directo desde acá, con el almacén como primer parámetro — el mismo patrón que ya usa el resto del repo para
 * separar cálculo de transporte.
 *
 * LO QUE ESTE CORTE CONECTA (`_ADI_CONTINUIDAD_INTEGRACION.md` §2) Y LO QUE DEJA DECLARADO COMO LÍMITE:
 *   · `consultar` abre/reusa el libro de conversación, registra lo entregado como referencias (tabla de Cifras:
 *     ya es la forma denormalizada que el libro necesita — sujeto/métrica/valor/procedencia — sin tener que leer
 *     el libro de hechos interno de `entrega/componer.js`), avanza criterio y supuestos vivos desde `resolucion`
 *     (ya resueltos por `validarEncargo`, sin tocar `componerEntrega`), y juzga las premisas leyendo
 *     `salida.entrega.procedencia.libroPremisas` — un campo YA EXPUESTO por `componerEntrega` para esto mismo.
 *   · LÍMITE DECLARADO (no se resuelve acá, congelado en `entrega/componer.js` durante esta etapa, ver
 *     `_ADI_CONTINUIDAD_INTEGRACION.md` §3): plegar `memoriaDeEmpresa().hechos` como FIGS con `.origen` dentro del
 *     libro de hechos del turno (para que un declarado que choca con un medido dispare el hecho `discrepancia` de
 *     `notario/hechos.js`) es trabajo de `entrega/componer.js`. Este corte no lo hace: un declarado y un medido
 *     conviven, cada uno visible por su propio camino (`conocerEmpresa`/`aportarContexto` para lo declarado,
 *     `consultar` para lo medido), pero todavía no se CRUZAN en una sola Entrega. Reportado al supervisor.
 *   · LÍMITE DECLARADO (`retomar`, ver su cabecera más abajo): el `reverificar()` real exige reconstruir el
 *     índice de evidencia de la versión activa (`notario/evidencia.js:indiceDeEvidencia`), que hoy solo se arma
 *     DENTRO de `entrega/componer.js` corriendo los playbooks del turno — tocar eso está fuera de lo que este
 *     corte puede hacer sin meterse en `entrega/componer.js` (congelado). `retomar` queda con `reverificar:null`,
 *     que es el comportamiento YA DISEÑADO de `continuidad/retomar.js` para este caso: falla cerrado,
 *     `estadoReverificacion:"sin_reverificar"` para todo, nunca un veredicto inventado. */
import { initTenant, getTenantData } from "../../data/tenantStore.js";
import { validarEncargo } from "../encargo/validar.js";
import { componerEntrega } from "../entrega/componer.js";
import { construirCatalogo } from "./catalogo.js";
import { construirPerfilCliente } from "../../config/contract/perfilCliente.js";
import { crearAlmacenEnMemoria } from "../continuidad/almacen.js";
import { memoriaDeEmpresa, declararHecho, confirmarHecho, hechoDePerfilCampo } from "../continuidad/empresa.js";
import {
  libroNuevo, emitirConversacionId, detectarCambioVersion, registrarEntrega,
  actualizarCriterio, agregarSupuestoVivo, registrarPremisa, registrarHechoAportado,
} from "../continuidad/libro.js";
import { estadoVigenteDe, eventosDeContinuidad, lineaDeContinuidad } from "../continuidad/estadoVigente.js";
import { retomar as reverificarConversacion } from "../continuidad/retomar.js";

/* ── LA CABECERA DE USO (plan v2, Etapa 3 · «una cabecera de USO para el LLM») ───────────────────────────────────
 * Viaja en CADA `consultar(...)`. Cuatro reglas, en el vocabulario de negocio del contrato (nunca "boleta" ni
 * "fig" ni ningún nombre interno): las cifras se PIDEN, no se recalculan; las NEGATIVAS —los hallazgos de «Lo que
 * no se puede concluir», no los números bajo cero (corrección del supervisor 2026-09-26)— se respetan; la
 * referencia del oficio no es un objetivo de esta empresa y el benchmark no es un promedio (CLAUDE.md §4:
 * «benchmark ≠ promedio ≠ meta»); y la libertad de redacción tiene un único límite — nombrar la simulación o la
 * entidad SOLO cuando de verdad hay ambigüedad (ley del colapso de escenarios: el texto dice «simulación»). */
export const CABECERA_DE_USO = Object.freeze([
  "Las cifras de esta respuesta ya están verificadas por ADI: no se recalculan ni se derivan a mano sobre el texto — un número nuevo se pide como una consulta nueva.",
  "Lo que la Entrega declara en «Lo que no se puede concluir» se respeta: son hallazgos, no excusas — no se afirma lo contrario ni se rellena el hueco con una suposición.",
  "La «Referencia del oficio» es conocimiento general del sector, no un dato de esta empresa ni un objetivo suyo; el benchmark es el que declaró la empresa y no es un promedio.",
  "Redacte con total libertad — resuma, ordene, adapte el tono al lector — y nombre la simulación o la entidad exacta SOLO cuando haya ambigüedad real sobre a cuál se refiere la cifra.",
]);

/* ── preparar el tenant inyectado: la ÚNICA vez que estas acciones tocan `data/tenantStore.js` ──────────────── */
function _prepararTenant(tenant) {
  if (!tenant || typeof tenant !== "object" || !tenant.dataset || typeof tenant.dataset !== "object") {
    return { ok: false, motivo: "tenant inválido: falta el dataset ya calculado (nunca se recibe un archivo del cliente acá)" };
  }
  initTenant(tenant.dataset);
  return { ok: true };
}

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
 * tocar `entrega/componer.js`, congelado): lee lo que ya está expuesto. */
function _hechosDeLaEntrega(entregaJson) {
  const filas = (entregaJson && entregaJson.cifras && Array.isArray(entregaJson.cifras.filas)) ? entregaJson.cifras.filas : [];
  return filas.map((f) => ({
    sujeto: (f.valores && (f.valores["Entidad / grupo"] || f.valores["Entidad"])) || null,
    metrica: (f.valores && f.valores["Métrica"]) || null,
    valor: (f.valores && f.valores["Valor"]) || null,
    unidad: null,
    periodo: null,
    origen: f.procedencia || null,
    ref: Array.isArray(f.hechos) && f.hechos.length ? f.hechos[0] : null,
  }));
}

/** crearAcciones({ continuidad? }) → { conocerEmpresa, consultar, aportarContexto, retomar }
 *
 *  `continuidad` es el ALMACÉN inyectable de `src/adi/continuidad/almacen.js` (owner: «deja escrito el punto de
 *  enganche» — corte 9: YA ESTÁ enganchado). Por defecto, `crearAlmacenEnMemoria()` — la misma instancia que usan
 *  los gates y la que `puerta.js` comparte por proceso (nunca una por request: perdería la conversación entre
 *  llamadas). El día que el owner autorice aplicar la migración 015, se inyecta `crearAlmacenSupabase({url,
 *  apikey, pase})` (`continuidad/almacenSupabase.js`, escrito y sin usar) desde donde se arme la puerta —
 *  NINGUNA línea de este archivo cambia: es exactamente el "almacén" que `_ADI_CONTINUIDAD_INTEGRACION.md` §1
 *  describe. */
export function crearAcciones({ continuidad = crearAlmacenEnMemoria() } = {}) {
  const store = continuidad; // alias local: acá adentro es, literal, el almacén de `continuidad/almacen.js`

  /* 1 · conocerEmpresa({ tenant, conversacionId? }) → la ficha completa de la empresa activa + el catálogo
   * generado (contrato §E) + la memoria de empresa VIGENTE (criterios/hechos/documentos que la empresa declaró,
   * nunca una cifra medida) + el perfil plegado como hechos de solo lectura (`hechoDePerfilCampo`) + el estado
   * vigente de la conversación, si se indicó una. */
  function conocerEmpresa({ tenant, conversacionId = null } = {}) {
    const prep = _prepararTenant(tenant);
    if (!prep.ok) return { ok: false, motivo: prep.motivo };

    const tenantId = tenant.id || null;
    const datosDelTenant = getTenantData();
    const perfil = construirPerfilCliente(datosDelTenant);
    const catalogo = construirCatalogo();

    // migración EN LECTURA de lo legado (007 diario / 011 contexto) — hoy vive en la versión activa del pack
    // (`_ADI_CONTINUIDAD_INTEGRACION.md`, cabecera de `continuidad/empresa.js`): `memoriaDeEmpresa` lo traduce
    // sin que este archivo tenga que saber cómo.
    const legado = {
      diario: (datosDelTenant && datosDelTenant.perfil && datosDelTenant.perfil.diario) || null,
      contexto: (datosDelTenant && datosDelTenant.perfil && datosDelTenant.perfil.contexto) || null,
    };
    const memoria = memoriaDeEmpresa(store, tenantId, { legado });
    const perfilPlegado = Object.entries(perfil.campos || {})
      .map(([campo, v]) => hechoDePerfilCampo(campo, { codigo: v && v.valor, procedencia: v && v.procedencia }))
      .filter(Boolean);

    const libro = conversacionId ? store.leerLibro(conversacionId) : null;
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
      perfil: { campos: perfil.campos, faltantes: perfil.faltantes, completo: perfil.completo },
      catalogo,
      conversacionId: conversacionId || null,
      hechosAportados: [...memoria.hechos, ...perfilPlegado],
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
   * registra lo entregado como referencias, y antepone UNA línea de la casa al texto SOLO si hubo un evento. */
  function consultar({ tenant, encargo } = {}) {
    const prep = _prepararTenant(tenant);
    if (!prep.ok) return { ok: false, motivo: prep.motivo, uso: CABECERA_DE_USO };

    const resolucion = validarEncargo(encargo, {});
    const salida = componerEntrega(resolucion);

    const versionIdActivo = tenant.version != null ? tenant.version : null;
    const conversacionIdEntrante = (encargo && typeof encargo.conversacionId === "string" && encargo.conversacionId) || null;
    let libro = conversacionIdEntrante ? store.leerLibro(conversacionIdEntrante) : null;
    const esNueva = !libro;
    if (!libro) {
      libro = libroNuevo({ versionId: versionIdActivo });
    }
    const cambioVersion = detectarCambioVersion(libro, versionIdActivo);

    const eventosBase = { cambioVersion, cifrasReverificadas: [], premisasFalsas: [], criterioCambio: null, supuestosVivosRelevantes: [] };

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
      const entidadesEntregadas = [...new Set(hechosParaLibro.map((h) => h.sujeto).filter(Boolean))];
      const cierres = [...new Set((resolucion.partes || []).map((p) => p.cierre).filter(Boolean))];
      libro = registrarEntrega(libro, {
        versionId: versionIdActivo,
        temas: salida.entrega.temasCubiertos || [],
        entidades: entidadesEntregadas,
        cierre: cierres.length === 1 ? cierres[0] : (cierres.length ? cierres.join("+") : null),
        hechos: hechosParaLibro,
        universos: salida.entrega.universos || [],
      });
    }

    store.guardarLibro(libro);

    const estadoVigente = estadoVigenteDe(libro, { versionIdActual: versionIdActivo });
    const eventos = eventosDeContinuidad(eventosBase);
    const lineaContinuidad = lineaDeContinuidad(eventos);
    const textoConContinuidad = salida.ok && lineaContinuidad ? `${lineaContinuidad}\n\n${salida.texto}` : (salida.ok ? salida.texto : "");

    return {
      ok: Boolean(salida.ok),
      entrega: salida.ok ? { texto: textoConContinuidad, json: salida.entrega } : null,
      noResuelto: resolucion.noResuelto || [],
      uso: CABECERA_DE_USO,
      continuidad: {
        conversacionId: libro.conversacionId,
        nueva: esNueva,
        motivoNueva: esNueva ? (conversacionIdEntrante ? "el conversacionId indicado no existe: se abrió una conversación nueva" : "no llegó un conversacionId: se abrió una conversación nueva") : null,
        estadoVigente,
      },
      meta: {
        conversacionId: libro.conversacionId,
        motivo: salida.motivo || null,
        avisos: resolucion.avisos || [],
        criterio: resolucion.criterio || null,
      },
    };
  }

  /* 3 · aportarContexto({ tenant, conversacionId?, aportes?, confirmar? }) → registra lo que el usuario declaró
   * (criterio, hecho, documento — el perfil se rechaza acá: vive en `tenants`, ver `empresa.js:declararHecho`) en
   * la MEMORIA DE EMPRESA real (`continuidad/empresa.js`). Nunca pisa un medido — esta memoria no tiene medidos
   * (ley «un declarado nunca pisa un medido», satisfecha por construcción, ver la cabecera de `empresa.js`): una
   * colisión posible es solo contra OTRO declarado de la misma llave, y ahí SÍ queda `pendiente` con
   * `conflictoCon`, hasta que se confirme (`confirmarHecho` nunca toca el origen — ley del owner, textual). */
  function aportarContexto({ tenant, conversacionId = null, aportes = [], confirmar = [] } = {}) {
    const prep = _prepararTenant(tenant);
    if (!prep.ok) return { ok: false, motivo: prep.motivo };

    const tenantId = tenant.id || null;
    const idDeConversacion = conversacionId || emitirConversacionId();
    let libro = store.leerLibro(idDeConversacion) || libroNuevo({ conversacionId: idDeConversacion, versionId: tenant.version != null ? tenant.version : null });

    const listaAportes = Array.isArray(aportes) ? aportes : [];
    const listaConfirmar = Array.isArray(confirmar) ? confirmar : [];

    const resultados = listaAportes.map((crudo) => {
      const { valido, motivo, entendido } = _entenderAporte(crudo);
      if (!valido) return { id: null, estado: "rechazado", motivo, recibido: crudo };

      const aporte = {
        clase: entendido.clase,
        concepto: entendido.concepto,
        entidad: entendido.entidad,
        periodo: entendido.periodo,
        valor: _valorParaEmpresa(entendido.valor, entendido.unidad),
        origen: entendido.clase === "documento" ? "documento" : "declarado",
        documento: entendido.documento,
      };
      const r = declararHecho(store, tenantId, aporte, { actorLabel: "anfitrion", conversacionId: idDeConversacion });
      if (!r.ok) return { id: null, estado: "rechazado", motivo: r.motivo, recibido: crudo };

      if (r.id) libro = registrarHechoAportado(libro, r.id);

      return {
        id: r.id,
        estado: r.estado,
        entendido: { clase: entendido.clase, concepto: entendido.concepto, entidad: entendido.entidad, periodo: entendido.periodo, valor: entendido.valor, unidad: entendido.unidad },
        conflictoCon: r.conflictoCon || null,
        paraConfirmar: r.estado === "pendiente",
      };
    });

    const confirmaciones = listaConfirmar.map((id) => {
      const r = confirmarHecho(store, tenantId, id, { actorLabel: "anfitrion", medio: "chat-anfitrion", resolverConflicto: true });
      return { id, confirmado: Boolean(r.ok) };
    });

    store.guardarLibro(libro);

    return {
      ok: true,
      conversacionId: idDeConversacion,
      resultados,
      confirmaciones,
      estadoVigente: estadoVigenteDe(libro, { versionIdActual: tenant.version != null ? tenant.version : null }),
    };
  }

  /* 4 · retomar({ tenant, conversacionId }) → el estado vigente + los hechos de las últimas Entregas
   * RE-VERIFICADOS contra la versión activa (`continuidad/retomar.js`), sin recomponer prosa.
   *
   * LÍMITE DECLARADO (owner: «declina honestamente cuenta como éxito», nunca en silencio): el `reverificar()`
   * real exige el índice de evidencia de la versión activa (`notario/evidencia.js:indiceDeEvidencia`), que hoy
   * solo se arma DENTRO de `entrega/componer.js` corriendo los playbooks del turno (`_indiceDelTenant`/
   * `_correrPlaybook`) — conectarlo desde acá sin tocar `entrega/componer.js` (congelado durante esta etapa) no
   * es posible con lo que ese módulo expone hoy. Reportado al supervisor (`_ADI_CONTINUIDAD_INTEGRACION.md`
   * §2, nota de "retomar": "Construirlo es responsabilidad de quien conecte esta pieza al índice de evidencia
   * real, no de `continuidad/`"). Por eso `reverificar` va `null`: es el comportamiento YA DISEÑADO por
   * `continuidad/retomar.js` para este caso — cada hecho vuelve con `estadoReverificacion:"sin_reverificar"`,
   * nunca un veredicto inventado. */
  function retomar({ tenant, conversacionId } = {}) {
    const prep = _prepararTenant(tenant);
    if (!prep.ok) return { ok: false, motivo: prep.motivo };
    if (!conversacionId || typeof conversacionId !== "string") return { ok: false, motivo: "falta conversacionId" };

    const libro = store.leerLibro(conversacionId);
    if (!libro) return { ok: false, motivo: "no existe una conversación con ese id", conversacionId };

    const r = reverificarConversacion(libro, { versionIdActual: tenant.version != null ? tenant.version : null, reverificar: null });

    return {
      ok: true,
      conversacionId,
      estadoVigente: r.estadoVigente,
      hechos: r.hechos,
      lineaContinuidad: r.lineaContinuidad,
      advertencias: [
        "este corte no re-verifica los hechos contra la versión de datos activa (falta conectar el índice de evidencia real del Core desde `entrega/componer.js`, reportado al supervisor): todo hecho entregado vuelve con estadoReverificacion:\"sin_reverificar\".",
      ],
    };
  }

  return { conocerEmpresa, consultar, aportarContexto, retomar };
}
