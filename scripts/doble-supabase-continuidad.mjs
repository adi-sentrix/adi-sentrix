/* === scripts/doble-supabase-continuidad.mjs · UN DOBLE DE SUPABASE (PostgREST) PARA EL GUARDADO DURABLE ═════════
 * Etapa 2, bloque 1. Las migraciones 012-015 NO están aplicadas en ninguna base y los candados no pueden llamar a
 * Supabase: este doble es un TRANSPORTE (`transporte(url, init)` — la costura que `supabaseRest.js:crearClienteRest`
 * ya acepta) que responde como lo haría PostgREST para las funciones y tablas que la continuidad necesita:
 *   · `tenants` (select) y `adi_version_activa` — lo que `tenantService.server.js:packActivo` pide para servir el pack;
 *   · las funciones de la migración 015 (`adi_aportar/confirmar/retirar_hecho_empresa`, `adi_leer_memoria_empresa`,
 *     `adi_leer/guardar_estado_conversacion`) con la semántica de su SQL (validaciones, `reemplaza`, tope de 16 KB,
 *     el origen del hilo SELLADO por la base);
 *   · las del Historial de la app (009/010: `adi_guardar/listar/leer_conversacion`) en DOS modos — `"010"` (la lista
 *     original, SIN la condición de origen: la CARNADA del defecto D3) y `"015"` (con ella).
 * Lo que el doble sí reproduce, porque es lo que muerde en producción: (1) el pase se VERIFICA (HMAC, rol, vencimiento)
 * y manda el tenant — una empresa jamás ve las filas de otra (el muro «falla cerrado»); (2) `jsonb` NO conserva el
 * orden de las claves (las reordena: más cortas primero) — por eso toda comparación del candado es canónica; (3) una
 * LATENCIA aleatoria con SEMILLA FIJA antes y después de cada operación, así las llamadas concurrentes se intercalan de
 * verdad y la misma semilla repite el mismo experimento; (4) fallas inyectables (503) y funciones que «no existen»
 * (migración sin aplicar → 404 PGRST202, como PostgREST).
 * Lo que NO reproduce (y por eso existe `scripts/verificar-supabase.mjs`, que sí habla con la base): Postgres real, RLS
 * evaluada por el motor, los permisos (`grant`) y el rendimiento. Un doble prueba que NUESTRO código hace lo que dice;
 * no que el SQL esté bien escrito.
 *
 * `exportar()`/`importar()` serializan TODO el estado: es lo que sobrevive a un «reinicio real» del proceso (el candado
 * lanza un proceso nuevo que lo carga y retoma). CERO red: este archivo no abre un socket ni importa nada de red. */
import { verificarPase } from "../src/data/paseTenant.js";

/* ── PRNG con semilla (mulberry32): la misma semilla, la misma secuencia ─────────────────────────────────────── */
export function crearAzar(semilla) {
  let a = (semilla >>> 0) || 1;
  const sig = () => {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  sig.entero = (n) => Math.floor(sig() * n);
  sig.elegir = (arr) => arr[Math.floor(sig() * arr.length)];
  return sig;
}

/* ── jsonb: ida y vuelta por JSON y claves reordenadas como Postgres (más cortas primero, luego bytes) ──────────── */
const _porLongitudYLetra = (a, b) => a.length - b.length || (a < b ? -1 : a > b ? 1 : 0);
function _canon(x) {
  if (Array.isArray(x)) return x.map(_canon);
  if (x && typeof x === "object") { const o = {}; for (const k of Object.keys(x).sort(_porLongitudYLetra)) o[k] = _canon(x[k]); return o; }
  return x;
}
export function jsonb(x) { return x === undefined || x === null ? null : _canon(JSON.parse(JSON.stringify(x))); }

/* JSON canónico (claves ordenadas A-Z, a cualquier profundidad): la forma en que el candado COMPARA y huella. */
export function canonico(x) {
  if (Array.isArray(x)) return x.map(canonico);
  if (x && typeof x === "object") { const o = {}; for (const k of Object.keys(x).sort()) o[k] = canonico(x[k]); return o; }
  return x;
}

const _UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const _TOPE_ESTADO = 16384;
const _ESTADOS = ["pendiente", "vigente", "retirado", "omitido"];

/* firma de cada función: argumentos que acepta, cuáles son obligatorios, y desde qué migración existe */
const FUNCIONES = {
  adi_version_activa: { args: [], req: [], mig: "base" },
  adi_guardar_conversacion: { args: ["p_hilo_id", "p_titulo", "p_mensajes", "p_actor_id", "p_actor_label", "p_actor_rol"], req: ["p_hilo_id", "p_titulo", "p_mensajes"], mig: "base" },
  adi_listar_conversaciones: { args: ["p_limite"], req: [], mig: "base" },
  adi_leer_conversacion: { args: ["p_hilo_id"], req: ["p_hilo_id"], mig: "base" },
  adi_aportar_hecho_empresa: { args: ["p_clase", "p_concepto", "p_eje", "p_entidad", "p_periodo", "p_valor", "p_origen", "p_documento", "p_estado", "p_reemplaza", "p_conversacion_id", "p_actor_label", "p_actor_rol"], req: ["p_clase", "p_concepto"], mig: "015" },
  adi_confirmar_hecho_empresa: { args: ["p_id", "p_confirmacion", "p_estado", "p_reemplaza", "p_actor_label", "p_actor_rol"], req: ["p_id"], mig: "015" },
  adi_retirar_hecho_empresa: { args: ["p_id", "p_motivo", "p_actor_label", "p_actor_rol"], req: ["p_id"], mig: "015" },
  adi_leer_memoria_empresa: { args: [], req: [], mig: "015" },
  adi_leer_estado_conversacion: { args: ["p_hilo_id"], req: ["p_hilo_id"], mig: "015" },
  adi_guardar_estado_conversacion: { args: ["p_hilo_id", "p_estado", "p_actor_id", "p_actor_label", "p_actor_rol"], req: ["p_hilo_id", "p_estado"], mig: "015" },
};

class _ErrorSql extends Error { constructor(codigo, mensaje, status = 400) { super(mensaje); this.codigo = codigo; this.status = status; } }

/** crearSupabaseFalso({ secretoJwt, semilla?, latenciaMaxMs?, migraciones?, modoListado?, tenants?, reloj? })
 *   tenants: [{ id, nombre, plan?: "pro"|"gratis", version?, sello?, pack }]
 *   migraciones: qué migraciones «están aplicadas» (["015"] por defecto) — una función de una migración no aplicada
 *     contesta 404 PGRST202, como PostgREST.
 *   modoListado: "015" (con la condición de origen) | "010" (la lista original — la carnada de D3). */
export function crearSupabaseFalso({ secretoJwt, semilla = 20261002, latenciaMaxMs = 3, migraciones = ["015"], modoListado = "015", tenants = [], reloj = null } = {}) {
  if (!secretoJwt) throw new Error("crearSupabaseFalso: falta el secreto de firma de los pases");
  let azar = crearAzar(semilla);
  const T = new Map();           // tenantId → { id, nombre, plan, version, sello, pack }
  let memoria = [];              // filas de memoria_empresa (de TODAS las empresas: el muro es del pase)
  let conversaciones = [];       // filas de conversaciones (idem)
  let contadorUuid = 0, contadorReloj = 0;
  const estado = { migraciones: new Set(migraciones), modoListado, latenciaMaxMs, desconectada: false, fallas: [] };
  const llamadas = [];           // { tenant, fn, ok }
  const metricas = { solicitudes: 0, porFuncion: {} };

  for (const t of tenants) T.set(t.id, { id: t.id, nombre: t.nombre || t.id, plan: t.plan || "pro", version: t.version ?? 1, sello: t.sello ?? null, pack: jsonb(t.pack) });

  const ahoraIso = () => (reloj ? reloj() : new Date(Date.UTC(2026, 9, 2, 12, 0, 0) + (++contadorReloj) * 1000).toISOString());
  const nuevoUuid = () => { contadorUuid += 1; return `00000000-0000-4000-8000-${contadorUuid.toString(16).padStart(12, "0")}`; };
  const dormir = () => new Promise((r) => setTimeout(r, estado.latenciaMaxMs > 0 ? azar.entero(estado.latenciaMaxMs + 1) : 0));
  const resp = (status, cuerpo) => new Response(typeof cuerpo === "string" ? cuerpo : JSON.stringify(cuerpo), { status, headers: { "content-type": "application/json" } });

  /* ── las funciones (cada una, atómica: corre entera sin ceder el turno, como una transacción) ─────────────── */
  const filasDe = (tenant) => memoria.filter((f) => f.tenant_id === tenant);

  function aportar(tenant, a) {
    if (!["criterio", "hecho", "documento"].includes(a.p_clase)) throw new _ErrorSql("P0001", `clase «${a.p_clase}» no admitida (criterio | hecho | documento — el perfil no se declara por esta vía)`);
    const origen = a.p_origen === undefined ? "declarado" : a.p_origen;
    if (!["declarado", "documento"].includes(origen)) throw new _ErrorSql("P0001", `origen «${origen}» no admitido en la memoria de empresa (declarado | documento)`);
    if (a.p_concepto == null || String(a.p_concepto).trim().length === 0) throw new _ErrorSql("P0001", "falta el concepto del hecho");
    const est = a.p_estado === undefined ? "vigente" : a.p_estado;
    if (!_ESTADOS.includes(est)) throw new _ErrorSql("P0001", `estado «${est}» no admitido`);
    if (origen === "documento" && a.p_documento == null) throw new _ErrorSql("P0001", "un hecho de documento exige {documento:{nombre,tipo,parte,...}}");
    if ((origen === "documento") !== (a.p_documento != null)) throw new _ErrorSql("23514", "viola memoria_empresa_documento_si_origen_documento", 409);
    if (a.p_reemplaza != null && !_UUID.test(String(a.p_reemplaza))) throw new _ErrorSql("22P02", "invalid input syntax for type uuid");
    if (a.p_reemplaza != null) {
      const v = memoria.find((f) => f.id === a.p_reemplaza && f.tenant_id === tenant && f.estado === "vigente");
      if (v) v.estado = "retirado";
    }
    const fila = {
      id: nuevoUuid(), tenant_id: tenant, clase: a.p_clase, concepto: String(a.p_concepto).trim(), eje: a.p_eje ?? null, entidad: a.p_entidad ?? null,
      periodo: a.p_periodo ?? null, valor: jsonb(a.p_valor), origen, documento: jsonb(a.p_documento), confirmacion: null, estado: est,
      declarado_en: ahoraIso(), actor_label: a.p_actor_label ?? null, conversacion_id: a.p_conversacion_id ?? null, reemplaza: a.p_reemplaza ?? null,
    };
    memoria.push(fila);
    return [jsonb(fila)];
  }
  function confirmar(tenant, a) {
    if (!_UUID.test(String(a.p_id))) throw new _ErrorSql("22P02", "invalid input syntax for type uuid");
    if (a.p_estado != null && !_ESTADOS.includes(a.p_estado)) throw new _ErrorSql("P0001", `estado «${a.p_estado}» no admitido`);
    if (a.p_reemplaza != null) {
      const v = memoria.find((f) => f.id === a.p_reemplaza && f.tenant_id === tenant && f.estado === "vigente");
      if (v) v.estado = "retirado";
    }
    const f = memoria.find((x) => x.id === a.p_id && x.tenant_id === tenant);
    if (f) {   // NUNCA toca valor, concepto ni origen
      if (a.p_confirmacion != null) f.confirmacion = jsonb(a.p_confirmacion);
      if (a.p_estado != null) f.estado = a.p_estado;
      if (a.p_reemplaza != null) f.reemplaza = a.p_reemplaza;
    }
    return f ? [jsonb(f)] : [];
  }
  function retirar(tenant, a) {
    if (!_UUID.test(String(a.p_id))) throw new _ErrorSql("22P02", "invalid input syntax for type uuid");
    const f = memoria.find((x) => x.id === a.p_id && x.tenant_id === tenant);
    if (f) f.estado = "retirado";
    return f ? [jsonb(f)] : [];
  }
  const origenDe = (c) => (c.estado && c.estado.origen) || "app";
  function leerEstado(tenant, a) {
    const c = conversaciones.find((x) => x.tenant_id === tenant && x.hilo_id === a.p_hilo_id && x.estado && x.estado.origen === "complemento");
    return c ? [jsonb({ hilo_id: c.hilo_id, estado: c.estado, actualizado_en: c.actualizado_en })] : [];
  }
  function guardarEstado(tenant, a) {
    if (a.p_hilo_id == null || String(a.p_hilo_id).trim().length === 0) throw new _ErrorSql("P0001", "sin empresa o sin hilo: no se guarda un libro anónimo");
    if (a.p_estado == null || typeof a.p_estado !== "object" || Array.isArray(a.p_estado)) throw new _ErrorSql("P0001", "el libro de conversación tiene que ser un objeto");
    const v = jsonb({ ...a.p_estado, origen: "complemento" });          // ★ el origen lo SELLA la base
    if (JSON.stringify(v).length > _TOPE_ESTADO) throw new _ErrorSql("P0001", "el libro de conversación supera el tamaño máximo (16KB)");
    const previa = conversaciones.find((x) => x.tenant_id === tenant && x.hilo_id === a.p_hilo_id);
    if (previa) {
      if (origenDe(previa) !== "complemento") throw new _ErrorSql("P0001", "ese hilo es una conversación del chat de la app: no se guarda un libro encima");
      previa.estado = v; previa.actualizado_en = ahoraIso();
      return [jsonb({ hilo_id: previa.hilo_id, estado: previa.estado, actualizado_en: previa.actualizado_en })];
    }
    const c = { tenant_id: tenant, hilo_id: String(a.p_hilo_id), titulo: "", mensajes: [], estado: v, oculta_en: null, creado_en: ahoraIso(), actualizado_en: ahoraIso() };
    conversaciones.push(c);
    return [jsonb({ hilo_id: c.hilo_id, estado: c.estado, actualizado_en: c.actualizado_en })];
  }
  const esPro = (tenant) => (T.get(tenant) || {}).plan === "pro";
  function guardarApp(tenant, a) {
    if (a.p_hilo_id == null || String(a.p_hilo_id).trim().length === 0) throw new _ErrorSql("P0001", "sin empresa o sin hilo: no se guarda una conversación anónima");
    if (!esPro(tenant)) throw new _ErrorSql("P0001", "el historial de conversaciones es del plan pro");
    if (!Array.isArray(a.p_mensajes)) throw new _ErrorSql("P0001", "los mensajes son una lista");
    const previa = conversaciones.find((x) => x.tenant_id === tenant && x.hilo_id === a.p_hilo_id);
    if (previa) {
      previa.mensajes = jsonb(a.p_mensajes); if (!previa.titulo) previa.titulo = a.p_titulo || ""; previa.actualizado_en = ahoraIso();
      return [jsonb({ hilo_id: previa.hilo_id, titulo: previa.titulo, actualizado_en: previa.actualizado_en })];
    }
    const c = { tenant_id: tenant, hilo_id: String(a.p_hilo_id), titulo: a.p_titulo || "", mensajes: jsonb(a.p_mensajes), estado: {}, oculta_en: null, creado_en: ahoraIso(), actualizado_en: ahoraIso() };
    conversaciones.push(c);
    return [jsonb({ hilo_id: c.hilo_id, titulo: c.titulo, actualizado_en: c.actualizado_en })];
  }
  function listarApp(tenant, a) {
    if (!esPro(tenant)) return [];
    const lim = Math.max(1, Math.min(a.p_limite == null ? 50 : a.p_limite, 200));
    return conversaciones
      .filter((c) => c.tenant_id === tenant && c.oculta_en == null)
      // ★ D3: SOLO en modo «015» la lista filtra por el ORIGEN DEL HILO. En «010» no filtra nada: la carnada.
      .filter((c) => estado.modoListado !== "015" || origenDe(c) === "app")
      .sort((x, y) => (x.actualizado_en < y.actualizado_en ? 1 : -1))
      .slice(0, lim)
      .map((c) => jsonb({ hilo_id: c.hilo_id, titulo: c.titulo, actualizado_en: c.actualizado_en, mensajes: Array.isArray(c.mensajes) ? c.mensajes.length : 0 }));
  }
  function leerApp(tenant, a) {
    if (!esPro(tenant)) return [];
    const c = conversaciones.find((x) => x.tenant_id === tenant && x.hilo_id === a.p_hilo_id && x.oculta_en == null && (estado.modoListado !== "015" || origenDe(x) === "app"));
    return c ? [jsonb({ hilo_id: c.hilo_id, titulo: c.titulo, mensajes: c.mensajes, actualizado_en: c.actualizado_en })] : [];
  }
  function versionActiva(tenant) {
    const t = T.get(tenant);
    if (!t || !t.pack) return [];
    return [{ id: nuevoUuid(), version: t.version, pack: t.pack, sello: t.sello, plantilla_version: "doble" }];
  }

  function rpc(tenant, nombre, args) {
    const def = FUNCIONES[nombre];
    if (!def || (def.mig !== "base" && !estado.migraciones.has(def.mig))) {
      throw new _ErrorSql("PGRST202", `Could not find the function public.${nombre} in the schema cache`, 404);
    }
    const dados = Object.keys(args || {});
    if (dados.some((k) => !def.args.includes(k)) || def.req.some((k) => !dados.includes(k))) {
      throw new _ErrorSql("PGRST202", `Could not find the function public.${nombre}(${dados.join(", ")}) in the schema cache`, 404);
    }
    switch (nombre) {
      case "adi_version_activa": return versionActiva(tenant);
      case "adi_aportar_hecho_empresa": return aportar(tenant, args);
      case "adi_confirmar_hecho_empresa": return confirmar(tenant, args);
      case "adi_retirar_hecho_empresa": return retirar(tenant, args);
      case "adi_leer_memoria_empresa": return filasDe(tenant).slice().sort((x, y) => (x.declarado_en < y.declarado_en ? -1 : 1)).map(jsonb);
      case "adi_leer_estado_conversacion": return leerEstado(tenant, args);
      case "adi_guardar_estado_conversacion": return guardarEstado(tenant, args);
      case "adi_guardar_conversacion": return guardarApp(tenant, args);
      case "adi_listar_conversaciones": return listarApp(tenant, args);
      case "adi_leer_conversacion": return leerApp(tenant, args);
      default: throw new _ErrorSql("PGRST202", `función sin implementar en el doble: ${nombre}`, 404);
    }
  }

  const COLUMNAS_BASE = ["id", "nombre"];
  const COLUMNAS_PERFIL = ["sector_codigo", "sector_procedencia", "tipo_producto_codigo", "tipo_producto_procedencia", "pais_codigo", "pais_procedencia", "modelo_comercial_codigo", "modelo_comercial_procedencia", "tamano_banda_codigo", "tamano_banda_procedencia", "moneda", "moneda_procedencia"];
  function seleccionarTenants(tenant, url) {
    const cols = String(url.searchParams.get("select") || "*").split(",").map((s) => s.trim()).filter(Boolean);
    const validas = estado.migraciones.has("012") ? [...COLUMNAS_BASE, ...COLUMNAS_PERFIL] : COLUMNAS_BASE;
    const mala = cols.find((c) => c !== "*" && !validas.includes(c));
    if (mala) throw new _ErrorSql("42703", `column tenants.${mala} does not exist`);
    const t = T.get(tenant);
    if (!t) return [];
    const fila = { id: t.id, nombre: t.nombre };
    for (const c of COLUMNAS_PERFIL) fila[c] = null;
    const out = {};
    for (const c of (cols.includes("*") ? validas : cols)) out[c] = fila[c];
    return [out];
  }

  /* ── EL TRANSPORTE: lo único que `crearClienteRest` necesita ─────────────────────────────────────────────── */
  async function transporte(url, init = {}) {
    metricas.solicitudes += 1;
    await dormir();
    let respuesta;
    const u = new URL(url);
    const auth = (init.headers && (init.headers.Authorization || init.headers.authorization)) || "";
    const pase = String(auth).replace(/^Bearer\s+/i, "");
    const v = await verificarPase(pase, secretoJwt);
    if (!v.ok) {
      respuesta = resp(401, { code: "PGRST301", message: `JWT inválido: ${v.motivo}` });
    } else if (estado.desconectada) {
      respuesta = resp(503, "base no disponible");
    } else {
      const falla = estado.fallas.find((f) => (f.restantes === undefined || f.restantes > 0) && (!f.fn || u.pathname.endsWith(`/rpc/${f.fn}`)) && (!f.tenant || f.tenant === v.tenantId));
      if (falla) {
        if (falla.restantes !== undefined) falla.restantes -= 1;
        respuesta = resp(falla.status || 503, "falla inyectada");
      } else {
        try {
          const mRpc = /\/rest\/v1\/rpc\/([a-z_0-9]+)$/.exec(u.pathname);
          let filas;
          if (mRpc && init.method === "POST") {
            const args = init.body ? JSON.parse(init.body) : {};
            metricas.porFuncion[mRpc[1]] = (metricas.porFuncion[mRpc[1]] || 0) + 1;
            filas = rpc(v.tenantId, mRpc[1], args);
            llamadas.push({ tenant: v.tenantId, fn: mRpc[1], ok: true });
          } else if (/\/rest\/v1\/tenants$/.test(u.pathname) && init.method === "GET") {
            filas = seleccionarTenants(v.tenantId, u);
            llamadas.push({ tenant: v.tenantId, fn: "select:tenants", ok: true });
          } else {
            throw new _ErrorSql("PGRST125", `Invalid path specified in request URL: ${u.pathname}`, 404);
          }
          respuesta = resp(200, filas);
        } catch (e) {
          if (!(e instanceof _ErrorSql)) throw e;
          llamadas.push({ tenant: v.tenantId, fn: String(u.pathname).split("/").pop(), ok: false });
          respuesta = resp(e.status, { code: e.codigo, message: e.message });
        }
      }
    }
    await dormir();
    return respuesta;
  }

  return {
    transporte,
    /* controles de escenario */
    desconectar(si = true) { estado.desconectada = si; },
    inyectarFalla(f) { estado.fallas.push({ ...f }); },
    limpiarFallas() { estado.fallas = []; },
    fijarModoListado(m) { estado.modoListado = m; },
    fijarLatencia(ms) { estado.latenciaMaxMs = ms; },
    reiniciarAzar(s) { azar = crearAzar(s); },
    /* inspección DIRECTA (lo que hay guardado, sin pasar por el pase: solo para el candado, nunca para el producto) */
    tablaMemoria() { return memoria.map(jsonb); },
    tablaConversaciones() { return conversaciones.map(jsonb); },
    filasDeEmpresa(id) { return { memoria: memoria.filter((f) => f.tenant_id === id).map(jsonb), conversaciones: conversaciones.filter((c) => c.tenant_id === id).map(jsonb) }; },
    packServido(id) { const t = T.get(id); return t ? jsonb(t.pack) : null; },
    versionDe(id) { const t = T.get(id); return t ? { version: t.version, sello: t.sello } : null; },
    metricas, llamadas,
    /* sobrevive a un «reinicio»: todo el estado como JSON, y su recarga en un proceso nuevo */
    exportar() { return JSON.stringify({ tenants: [...T.values()], memoria, conversaciones, contadorUuid, contadorReloj, migraciones: [...estado.migraciones], modoListado: estado.modoListado }); },
    importar(texto) {
      const s = JSON.parse(texto);
      T.clear(); for (const t of s.tenants) T.set(t.id, t);
      memoria = s.memoria; conversaciones = s.conversaciones; contadorUuid = s.contadorUuid; contadorReloj = s.contadorReloj;
      estado.migraciones = new Set(s.migraciones); estado.modoListado = s.modoListado;
    },
  };
}
