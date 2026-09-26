/* === src/adi/capacidad/acciones.js · LAS CUATRO ACCIONES DE LA CAPACIDAD (Etapa 3, corte 8, owner 2026-09-25) ═
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
 * arma este objeto DESPUÉS de verificar el token; ninguna acción de acá vuelve a verificar nada de identidad. */
import { initTenant, getTenantData } from "../../data/tenantStore.js";
import { validarEncargo } from "../encargo/validar.js";
import { componerEntrega } from "../entrega/componer.js";
import { construirCatalogo } from "./catalogo.js";
import { construirPerfilCliente } from "../../config/contract/perfilCliente.js";
import { crearContinuidadEnMemoria } from "./continuidadMemoria.js";

/* ── LA CABECERA DE USO (plan v2, Etapa 3 · «una cabecera de USO para el LLM») ───────────────────────────────────
 * Viaja en CADA `consultar(...)`. Cuatro reglas, en el vocabulario de negocio del contrato (nunca "boleta" ni
 * "fig" ni ningún nombre interno): las cifras se PIDEN, no se recalculan; las negativas se respetan tal cual; la
 * referencia del oficio no es un objetivo de esta empresa; y la libertad de redacción tiene un único límite —
 * nombrar escenario o entidad SOLO cuando de verdad hay ambigüedad sobre a cuál se refiere. */
export const CABECERA_DE_USO = Object.freeze([
  "Las cifras de esta respuesta ya están verificadas por ADI: no se recalculan ni se derivan a mano sobre el texto — un número nuevo se pide como una consulta nueva.",
  "Las cifras negativas se respetan tal cual llegan: nunca se leen como un error de signo ni se redondean a cero.",
  "La referencia del oficio (benchmark, promedio del sector) es información general — nunca un objetivo ni una meta de esta empresa.",
  "Redacte con total libertad — resuma, ordene, adapte el tono al lector — y nombre el escenario o la entidad exacta SOLO cuando haya ambigüedad real sobre a cuál se refiere la cifra.",
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

/** crearAcciones({ continuidad? }) → { conocerEmpresa, consultar, aportarContexto, retomar }
 *
 *  EL PUNTO DE ENGANCHE (owner: «deja escrito el punto de enganche» para el carril B): `continuidad` es la
 *  interfaz inyectable de `src/adi/continuidad/` (`_ADI_DISENO_FLUJO_V2.md` §B — memoria de empresa + libro de
 *  conversación + estado vigente). Hoy la respalda el doble en memoria (`continuidadMemoria.js`); el día que el
 *  carril B publique la real, se pasa acá y ninguna otra línea de este archivo cambia. El contrato que
 *  `aportarContexto`/`retomar` exigen de `continuidad` (cualquier implementación que lo cumpla sirve):
 *    · nuevaConversacion(tenantId?)                    → conversacionId (string)
 *    · obtenerEstado(conversacionId)                   → EstadoVigente | null
 *    · registrarAporte(conversacionId, aporteEntendido) → { id, ...aporteEntendido, estado, creadoEn }
 *    · confirmarAporte(conversacionId, aporteId)        → boolean
 *    · listarAportes(conversacionId)                    → AporteRegistrado[]
 *  `EstadoVigente = { conversacionId, tenantId, turno, creadoEn, actualizadoEn, hechosAportados: [...] }`. */
export function crearAcciones({ continuidad = crearContinuidadEnMemoria() } = {}) {
  /* 1 · conocerEmpresa({ tenant, conversacionId? }) → la ficha completa de la empresa activa + el catálogo
   * generado (contrato §E). Sin cifras del negocio salvo lo que el catálogo YA declara que no lleva (temas,
   * conceptos, ejes, cierres, definiciones) — el perfil trae sus CAMPOS y sus FALTANTES, nunca una cifra de venta. */
  function conocerEmpresa({ tenant, conversacionId = null } = {}) {
    const prep = _prepararTenant(tenant);
    if (!prep.ok) return { ok: false, motivo: prep.motivo };

    const datosDelTenant = getTenantData();
    const perfil = construirPerfilCliente(datosDelTenant);
    const catalogo = construirCatalogo();
    const hechosAportados = conversacionId ? continuidad.listarAportes(conversacionId) : [];

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
      hechosAportados,
    };
  }

  /* 2 · consultar({ tenant, encargo }) → valida el Encargo v1 contra el Core (`validarEncargo`) y arma la Entrega
   * (`componerEntrega`) — CUALQUIER encargo válido, nunca un catálogo de preguntas fijas. La cabecera de USO viaja
   * SIEMPRE, incluso cuando la Entrega quedó vacía (el LLM necesita las mismas reglas para leer un `noResuelto`). */
  function consultar({ tenant, encargo } = {}) {
    const prep = _prepararTenant(tenant);
    if (!prep.ok) return { ok: false, motivo: prep.motivo, uso: CABECERA_DE_USO };

    const resolucion = validarEncargo(encargo, {});
    const salida = componerEntrega(resolucion);

    return {
      ok: Boolean(salida.ok),
      entrega: salida.ok ? { texto: salida.texto, json: salida.entrega } : null,
      noResuelto: resolucion.noResuelto || [],
      uso: CABECERA_DE_USO,
      meta: {
        conversacionId: (encargo && encargo.conversacionId) || null,
        motivo: salida.motivo || null,
        avisos: resolucion.avisos || [],
        criterio: resolucion.criterio || null,
      },
    };
  }

  /* 3 · aportarContexto({ tenant, conversacionId?, aportes?, confirmar? }) → registra lo que el usuario declaró
   * (perfil, criterio, hecho, documento) en la continuidad INYECTADA. Nunca pisa un medido: acá solo se GUARDA el
   * aporte con su estado ("pendiente" hasta que se confirme, o desde ya "vigente" si `confirmar` lo nombra en el
   * mismo llamado) — la colisión contra un hecho medido del Core es trabajo de `src/adi/continuidad/` (carril B,
   * ver la nota en `retomar`); este corte lo declara como límite en vez de fingir que ya lo resuelve. */
  function aportarContexto({ tenant, conversacionId = null, aportes = [], confirmar = [] } = {}) {
    const prep = _prepararTenant(tenant);
    if (!prep.ok) return { ok: false, motivo: prep.motivo };

    const idDeConversacion = conversacionId || continuidad.nuevaConversacion(tenant.id || null);
    const listaAportes = Array.isArray(aportes) ? aportes : [];
    const listaConfirmar = Array.isArray(confirmar) ? confirmar : [];

    const resultados = listaAportes.map((crudo) => {
      const { valido, motivo, entendido } = _entenderAporte(crudo);
      if (!valido) return { id: null, estado: "rechazado", motivo, recibido: crudo };
      const registro = continuidad.registrarAporte(idDeConversacion, entendido);
      return {
        id: registro.id,
        estado: registro.estado,
        entendido: { clase: registro.clase, concepto: registro.concepto, entidad: registro.entidad, periodo: registro.periodo, valor: registro.valor, unidad: registro.unidad },
        // esta pieza no evalúa colisión contra un hecho medido del Core todavía (ver la cabecera del archivo):
        // se declara `null`, nunca se afirma "sin conflicto" como si se hubiera comprobado.
        conflictoCon: null,
        paraConfirmar: registro.estado === "pendiente",
      };
    });

    const confirmaciones = listaConfirmar.map((id) => ({ id, confirmado: continuidad.confirmarAporte(idDeConversacion, id) }));

    return {
      ok: true,
      conversacionId: idDeConversacion,
      resultados,
      confirmaciones,
      estadoVigente: continuidad.obtenerEstado(idDeConversacion),
    };
  }

  /* 4 · retomar({ tenant, conversacionId }) → el estado vigente de una conversación anterior. LÍMITE DECLARADO
   * (owner: «declina honestamente cuenta como éxito», nunca en silencio): este corte NO re-verifica cada hecho
   * aportado contra la versión de datos activa — esa re-verificación es la pieza de continuidad del carril B
   * (`_ADI_DISENO_FLUJO_V2.md` §B, "Retomar"). Hoy `retomar` devuelve el estado tal cual quedó guardado y lo dice. */
  function retomar({ tenant, conversacionId } = {}) {
    const prep = _prepararTenant(tenant);
    if (!prep.ok) return { ok: false, motivo: prep.motivo };
    if (!conversacionId || typeof conversacionId !== "string") return { ok: false, motivo: "falta conversacionId" };

    const estadoVigente = continuidad.obtenerEstado(conversacionId);
    if (!estadoVigente) return { ok: false, motivo: "no existe una conversación con ese id", conversacionId };

    return {
      ok: true,
      conversacionId,
      estadoVigente,
      hechos: estadoVigente.hechosAportados,
      advertencias: [
        "este corte no re-verifica los hechos contra la versión de datos activa (esa pieza vive en la continuidad real, carril B) — lo que sigue es el estado tal cual quedó guardado.",
      ],
    };
  }

  return { conocerEmpresa, consultar, aportarContexto, retomar };
}
