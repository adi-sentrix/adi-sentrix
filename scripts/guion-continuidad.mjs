/* === scripts/guion-continuidad.mjs · EL GUION DE ACEPTACIÓN DE LA CONTINUIDAD DURABLE (Etapa 2, bloque 1) ═══════
 * UN solo guion, DOS niveles (owner 2026-10-02): el candado `_guardado_durable_gate.mjs` lo corre contra un doble de
 * Supabase (sin red, con reinicio de proceso real); `scripts/guion_continuidad_staging.mjs` lo corre contra la base
 * REAL de staging. Este archivo es la PARTE COMÚN — el guion, el control de no mezcla, las huellas, la comparación y
 * el transcrito lado a lado — y no sabe contra qué base habla: recibe un `llamar(empresa, accion, args)` (el que arma
 * la puerta, como lo haría un anfitrión) y un `leerHuellas(empresa, conversacionId)` (lee lo guardado por el MISMO
 * adaptador de producción). Cero red por sí mismo.
 *
 * EL GUION (el del owner): para cada empresa A y B, intercaladas turno a turno —las dos llamadas de cada turno salen
 * a la vez—:
 *   T0 · conocerEmpresa
 *   T1 · consultar → Entrega E1 con cifras
 *   T2 · aportarContexto (un plazo de cobro DECLARADO + un criterio que queda pendiente)
 *   T3 · confirmar el plazo (la persona lo confirma: pasa a vigente, sigue «declarado»)
 *   T4 · consultar → Entrega E2   (hoy NO lee lo declarado —eso es el bloque 3—: el dato queda guardado con su origen)
 *   → REINICIO (otro proceso; solo sobrevive la base) →
 *   R · retomar A y retomar B: E1 y E2 idénticas a las entregadas (cifras, ids, fecha y versión de carga), lo declarado
 *       intacto con su origen, y NADA de la otra empresa.
 * EVIDENCIA: la huella (sha256 de la forma canónica) del libro y de la memoria de cada empresa antes y después; un
 * control de no mezcla (ningún nombre, centinela, cifra o dato declarado de una empresa dentro de lo de la otra).
 * `jsonb` no conserva el orden de las claves: toda huella y toda comparación son sobre la forma CANÓNICA. */
import { createHash } from "node:crypto";

/* ── forma canónica + huella ─────────────────────────────────────────────────────────────────────────────────── */
export function canonico(x) {
  if (Array.isArray(x)) return x.map(canonico);
  if (x && typeof x === "object") { const o = {}; for (const k of Object.keys(x).sort()) o[k] = canonico(x[k]); return o; }
  return x;
}
export const huella = (x) => createHash("sha256").update(JSON.stringify(canonico(x === undefined ? null : x))).digest("hex");
export const iguales = (a, b) => JSON.stringify(canonico(a)) === JSON.stringify(canonico(b));

/* ── el llamador de la PUERTA: lo que haría un anfitrión (MCP, JSON-RPC por HTTP) ───────────────────────────────
 * `manejarPuerta(request, env, opciones)` es el de `capacidad/puerta.js`; `codigos[empresa]` es el bearer de cada
 * una. Cada llamada sale con una IP distinta (el rate limit es por IP) y se cuenta. Devuelve el objeto que la acción
 * devolvió (el `text` JSON del contenido MCP). */
export function crearLlamadorPuerta({ manejarPuerta, env, opciones = {}, codigos, base = "http://puerta.local/mcp" }) {
  let k = 0, n = 0;
  async function llamar(empresa, accion, args = {}) {
    k += 1; n += 1;
    const cuerpo = { jsonrpc: "2.0", id: n, method: "tools/call", params: { name: accion, arguments: args } };
    const req = new Request(base, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${codigos[empresa]}`, "x-real-ip": `10.${(k >> 8) & 255}.${k & 255}.7` },
      body: JSON.stringify(cuerpo),
    });
    const res = await manejarPuerta(req, env, opciones);
    if (res.status !== 200) throw new Error(`la puerta respondió ${res.status} a ${accion} (${empresa}): ${(await res.text()).slice(0, 200)}`);
    const j = await res.json();
    if (j.error) throw new Error(`error JSON-RPC en ${accion}: ${j.error.message}`);
    return JSON.parse(j.result.content[0].text);
  }
  llamar.llamadas = () => n;
  return llamar;
}

/* ── lo que se retiene de cada respuesta ──────────────────────────────────────────────────────────────────────── */
/* lo que VIAJA al anfitrión es la respuesta COMPACTA (`capacidad/compacto.js`: `entrega.cifras`, cada una con el id del libro); la completa (`entrega.json.cifras.filas`) se sigue leyendo cuando es lo que se tiene (acciones sin puerta) */
const _cifrasDe = (r) => (r && r.entrega && !r.entrega.json && Array.isArray(r.entrega.cifras)
  ? r.entrega.cifras.map((c) => ({ entidad: c.entidad || null, metrica: c.metrica || null, valor: c.valor || null, tipo: c.procedencia || null, hechos: c.id ? [c.id] : [], id: c.id || null }))
  : ((r && r.entrega && r.entrega.json && r.entrega.json.cifras && r.entrega.json.cifras.filas) || [])
    .map((f) => ({ entidad: f.valores["Entidad / grupo"] || f.valores["Entidad"] || null, metrica: f.valores["Métrica"] || null, valor: f.valores["Valor"] || null, tipo: f.valores["Tipo"] || null, hechos: f.hechos || [] })));
const _marcoDe = (r) => (r && r.entrega && (r.entrega.marco || (r.entrega.json && r.entrega.json.marco))) || null;
export function resumirConsulta(r) {
  return {
    ok: Boolean(r && r.ok),
    empresa: (_marcoDe(r) && _marcoDe(r).empresa) || null,
    periodo: (_marcoDe(r) && _marcoDe(r).periodo && _marcoDe(r).periodo.texto) || null,
    cifras: _cifrasDe(r),
    conversacionId: (r && r.continuidad && r.continuidad.conversacionId) || null,
    turno: (r && r.continuidad && r.continuidad.estadoVigente && r.continuidad.estadoVigente.turno) || null,
    guardada: r && r.continuidad ? r.continuidad.guardada !== false : null,
    texto: (r && r.entrega && r.entrega.texto) || null,
  };
}
export function resumirRetomar(r) {
  return {
    ok: Boolean(r && r.ok),
    entregas: ((r && r.entregas) || []).map((e) => ({ n: e.n, versionId: e.versionId, entregadaEn: e.entregadaEn, periodo: e.periodo, temas: e.temas, entidades: e.entidades, cierre: e.cierre })),
    hechos: ((r && r.hechos) || []).map((h) => ({ id: h.id, sujeto: h.sujeto, metrica: h.metrica, valor: h.valor, origen: h.origen, ref: h.ref, estadoReverificacion: h.estadoReverificacion })),
    estadoVigente: (r && r.estadoVigente) || null,
  };
}
export function resumirEmpresa(r) {
  const h = (x) => ({ id: x.id, concepto: x.concepto, entidad: x.entidad, periodo: x.periodo || null, clase: x.clase, estado: x.estado, origen: x.origen, valor: x.valor, confirmacion: x.confirmacion || null });
  return {
    ok: Boolean(r && r.ok),
    nombre: (r && r.empresa && r.empresa.nombre) || null,
    version: (r && r.datos && r.datos.version) || null,
    hechosAportados: ((r && r.hechosAportados) || []).filter((x) => !x.soloLectura).map(h),
    pendientes: ((r && r.pendientesDeConfirmar) || []).map(h),
  };
}

/* ── el guion de UNA empresa ─────────────────────────────────────────────────────────────────────────────────── */
/** E = { id, etiqueta (centinela único), entidadE1, entidadE2, plazoDias, benchmarkPct } */
export const encargoDeVentas = (entidad, conversacionId = null) => ({
  version: "encargo/v1",
  ...(conversacionId ? { conversacionId } : {}),
  partes: [{ id: "p1", tema: "comercial", cierre: "cifra", conceptos: ["ventas"], entidades: [{ nombre: entidad }] }],
});
export const aportesDe = (E) => [
  { clase: "hecho", concepto: "plazo_de_cobro", entidad: E.entidadE1, ...(E.periodo ? { periodo: E.periodo } : {}), valor: { raw: E.plazoDias, unidad: "days", texto: `${E.plazoDias} días pactados · ref ${E.etiqueta}` } },
  { clase: "criterio", concepto: "benchmark_propio_margen", ...(E.periodo ? { periodo: E.periodo } : {}), valor: { raw: E.benchmarkPct, unidad: "pct", texto: `margen objetivo ${E.benchmarkPct}% · ref ${E.etiqueta}` } },
];

/* el hecho de ESTA corrida del guion: mismo concepto y, si la empresa trae `periodo`, ese período (la base real guarda las corridas anteriores) */
const delGuion = (E, concepto) => (h) => h.concepto === concepto && (!E.periodo || h.periodo === E.periodo);

const TURNOS = [
  { nombre: "T0 conocerEmpresa", correr: async (llamar, E, est) => { est.t0 = resumirEmpresa(await llamar(E.id, "conocerEmpresa", {})); } },
  { nombre: "T1 consultar → E1", correr: async (llamar, E, est) => { est.e1 = resumirConsulta(await llamar(E.id, "consultar", { encargo: encargoDeVentas(E.entidadE1) })); est.conversacionId = est.e1.conversacionId; } },
  { nombre: "T2 aportarContexto", correr: async (llamar, E, est) => {
      const r = await llamar(E.id, "aportarContexto", { conversacionId: est.conversacionId, aportes: aportesDe(E) });
      est.aportes = (r.resultados || []).map((x) => ({ id: x.id, estado: x.estado, concepto: x.entendido && x.entendido.concepto, paraConfirmar: x.paraConfirmar }));
      est.aporteOk = Boolean(r.ok);
  } },
  { nombre: "T3 confirmar el plazo", correr: async (llamar, E, est) => {
      const idPlazo = (est.aportes.find((x) => x.concepto === "plazo_de_cobro") || {}).id;
      const r = await llamar(E.id, "aportarContexto", { conversacionId: est.conversacionId, aportes: [], confirmar: [idPlazo] });
      est.confirmacion = (r.confirmaciones || []).map((x) => ({ id: x.id, confirmado: x.confirmado }));
  } },
  { nombre: "T4 consultar → E2", correr: async (llamar, E, est) => { est.e2 = resumirConsulta(await llamar(E.id, "consultar", { encargo: encargoDeVentas(E.entidadE2, est.conversacionId) })); } },
];

/** faseAntes({ llamar, empresas, leerHuellas }) → { porEmpresa: { [id]: transcrito } } · intercalado turno a turno */
export async function faseAntes({ llamar, empresas, leerHuellas }) {
  const est = Object.fromEntries(empresas.map((E) => [E.id, { empresa: E.id, turnos: [] }]));
  for (const turno of TURNOS) {
    await Promise.all(empresas.map(async (E) => { await turno.correr(llamar, E, est[E.id]); est[E.id].turnos.push(turno.nombre); }));
  }
  // lo que dice cada empresa de sí misma, y lo guardado, ANTES del reinicio
  for (const E of empresas) {
    const e = est[E.id];
    e.retomar = resumirRetomar(await llamar(E.id, "retomar", { conversacionId: e.conversacionId }));
    e.conocer = resumirEmpresa(await llamar(E.id, "conocerEmpresa", { conversacionId: e.conversacionId }));
    e.huellas = await leerHuellas(E.id, e.conversacionId);
  }
  return { porEmpresa: est };
}

/** faseDespues({ llamar, empresas, antes, leerHuellas }) → { porEmpresa } · tras el reinicio: SOLO retomar + leer */
export async function faseDespues({ llamar, empresas, antes, leerHuellas }) {
  const out = {};
  for (const E of empresas) {
    const id = antes.porEmpresa[E.id].conversacionId;
    out[E.id] = {
      empresa: E.id, conversacionId: id,
      retomar: resumirRetomar(await llamar(E.id, "retomar", { conversacionId: id })),
      conocer: resumirEmpresa(await llamar(E.id, "conocerEmpresa", { conversacionId: id })),
      huellas: await leerHuellas(E.id, id),
    };
  }
  return { porEmpresa: out };
}

/* ── el control de NO MEZCLA ──────────────────────────────────────────────────────────────────────────────────── */
/** marcadoresDe(empresas, antes) → { [id]: [strings] } · lo que identifica SOLO a esa empresa DENTRO DE UN TEXTO: su nombre
 * y su centinela (la marca única que lleva cada dato que declaró). Las cifras NO se buscan como subcadena: un «$6.8M» de
 * una empresa puede coincidir por casualidad con otra cifra del texto de otra (una contribución, un total) y daría una
 * falsa alarma. Las cifras se controlan ESTRUCTURALMENTE: cada hecho del libro de una empresa tiene que ser una de las
 * cifras que ESA empresa recibió (ver `cifrasAjenas`). */
export function marcadoresDe(empresas, antes) {
  const out = {};
  for (const E of empresas) out[E.id] = [antes.porEmpresa[E.id].e1.empresa, E.etiqueta].filter(Boolean);
  return out;
}

/** cifrasAjenas({ empresas, antes, despues }) → violaciones[] · estructural: cada hecho que `retomar` devuelve a una empresa
 * (antes y después del reinicio) es una de las cifras que ESA empresa recibió en E1/E2, y ninguna que solo recibió la otra. */
export function cifrasAjenas({ empresas, antes, despues }) {
  const v = [];
  const propias = Object.fromEntries(empresas.map((E) => [E.id, new Set([...antes.porEmpresa[E.id].e1.cifras, ...antes.porEmpresa[E.id].e2.cifras].map((c) => `${c.entidad}|${c.metrica}|${c.valor}`))]));
  for (const E of empresas) {
    for (const [donde, hechos] of [["antes", antes.porEmpresa[E.id].retomar.hechos], ["después", despues.porEmpresa[E.id].retomar.hechos]]) {
      for (const h of hechos) {
        const clave = `${h.sujeto}|${h.metrica}|${h.valor}`;
        if (!propias[E.id].has(clave)) v.push({ empresa: E.id, donde: `retomar ${donde}`, hecho: clave });
      }
    }
  }
  return v;
}

/** controlDeNoMezcla({ textos:[{empresa, donde, texto}], marcadores }) → violaciones[] · ningún marcador de OTRA
 * empresa dentro del texto de esta. Vacío = no se mezcló nada. */
export function controlDeNoMezcla({ textos, marcadores }) {
  const v = [];
  for (const { empresa, donde, texto } of textos) {
    for (const [otra, lista] of Object.entries(marcadores)) {
      if (otra === empresa) continue;
      for (const m of lista) if (m && String(texto).includes(m)) v.push({ empresa, donde, ajena: otra, marcador: m });
    }
  }
  return v;
}

/* ── la comparación ANTES / DESPUÉS ──────────────────────────────────────────────────────────────────────────── */
export function compararAntesDespues({ antes, despues, empresas }) {
  const checks = [];
  const chk = (ok, label, detalle = "") => checks.push({ ok: Boolean(ok), label, detalle });
  const marcadores = marcadoresDe(empresas, antes);

  for (const E of empresas) {
    const a = antes.porEmpresa[E.id], d = despues.porEmpresa[E.id];
    const R = `${E.id}`;
    chk(a.e1.ok && a.e2.ok && a.e1.guardada && a.e2.guardada, `${R} · E1 y E2 se entregaron y quedaron guardadas`, JSON.stringify({ e1: a.e1.ok, e2: a.e2.ok, g1: a.e1.guardada, g2: a.e2.guardada }));
    chk(a.e1.turno === 1 && a.e2.turno === 2 && a.e2.conversacionId === a.e1.conversacionId, `${R} · E2 continúa la MISMA conversación (turno 2, mismo id)`);
    chk(d.retomar.ok === true, `${R} · retomar encuentra la conversación tras el reinicio`);
    chk(d.retomar.entregas.length === 2 && d.retomar.entregas[0].n === 1 && d.retomar.entregas[1].n === 2, `${R} · retomar trae las DOS Entregas (E1, E2)`, JSON.stringify(d.retomar.entregas.map((e) => e.n)));
    chk(iguales(d.retomar.entregas, a.retomar.entregas), `${R} · las Entregas conservan su número, su versión de carga, su fecha y su período, idénticos a antes`, JSON.stringify({ antes: a.retomar.entregas, despues: d.retomar.entregas }));
    chk(d.retomar.entregas.every((e) => e.versionId != null && e.entregadaEn && e.periodo), `${R} · cada Entrega trae versión de carga, fecha de entrega y período (no vacíos)`);
    chk(iguales(d.retomar.hechos, a.retomar.hechos), `${R} · los hechos (cifras e ids E1.h1…) vuelven idénticos a antes del reinicio`);
    // idénticas a LO ENTREGADO: cada cifra de E1/E2 que se mostró está en el libro con el mismo sujeto, métrica y valor
    const entregadas = [...a.e1.cifras, ...a.e2.cifras];
    const enLibro = d.retomar.hechos;
    const faltan = entregadas.filter((c) => !enLibro.some((h) => h.sujeto === c.entidad && h.metrica === c.metrica && h.valor === c.valor && (!c.id || h.id === c.id)));   // y, si la cifra viajó con su id, el libro la guardó CON ESE id
    chk(entregadas.length > 0 && faltan.length === 0 && enLibro.length === entregadas.length, `${R} · el libro tiene EXACTAMENTE las cifras que se entregaron (sujeto · métrica · valor)`, JSON.stringify({ entregadas: entregadas.length, enLibro: enLibro.length, faltan }));
    chk(d.retomar.hechos.every((h) => /^E[12]\.h\d+$/.test(h.id)) && new Set(d.retomar.hechos.map((h) => h.id)).size === d.retomar.hechos.length, `${R} · los ids de los hechos son E1.hk / E2.hk, sin repetirse`);
    chk(iguales(d.retomar.estadoVigente, a.retomar.estadoVigente), `${R} · el estado vigente es idéntico`);
    // lo declarado
    const dePlazo = delGuion(E, "plazo_de_cobro"), deCriterio = delGuion(E, "benchmark_propio_margen");
    const plazoA = a.conocer.hechosAportados.find(dePlazo), plazoD = d.conocer.hechosAportados.find(dePlazo);
    chk(Boolean(plazoD) && plazoD.estado === "vigente" && plazoD.origen === "declarado" && plazoD.valor && plazoD.valor.raw === E.plazoDias, `${R} · el plazo de cobro declarado sigue vigente, con origen «declarado» y su valor (${E.plazoDias} días)`, JSON.stringify(plazoD));
    chk(Boolean(plazoD) && Boolean(plazoD.confirmacion) && plazoD.confirmacion.por, `${R} · y conserva el sello de confirmación aparte (el origen no cambió)`);
    chk(Boolean(plazoA) && plazoD && plazoA.id === plazoD.id, `${R} · el MISMO id del hecho antes y después`);
    const critD = d.conocer.pendientes.find(deCriterio);
    chk(Boolean(critD) && critD.estado === "pendiente" && critD.origen === "declarado", `${R} · el criterio sin confirmar sigue PENDIENTE y declarado (nunca se volvió dato)`);
    chk(!d.conocer.hechosAportados.some(deCriterio), `${R} · el pendiente no figura entre los hechos vigentes`);
    chk(iguales(d.conocer.hechosAportados, a.conocer.hechosAportados) && iguales(d.conocer.pendientes, a.conocer.pendientes), `${R} · lo declarado y lo pendiente son idénticos antes y después`);
    chk(d.conocer.nombre === a.conocer.nombre && d.conocer.version === a.conocer.version, `${R} · el nombre de la empresa y la versión de carga no cambian`);
    // huellas
    chk(d.huellas.libro === a.huellas.libro, `${R} · HUELLA del libro idéntica (sha256 ${String(a.huellas.libro).slice(0, 12)}… → ${String(d.huellas.libro).slice(0, 12)}…)`);
    chk(d.huellas.memoria === a.huellas.memoria, `${R} · HUELLA de la memoria idéntica (sha256 ${String(a.huellas.memoria).slice(0, 12)}… → ${String(d.huellas.memoria).slice(0, 12)}…)`);
  }
  chk(empresas.length > 1 && new Set(empresas.map((E) => antes.porEmpresa[E.id].conversacionId)).size === empresas.length, "cada empresa tiene SU conversación (ids distintos)");
  chk(new Set(empresas.map((E) => antes.porEmpresa[E.id].huellas.libro)).size === empresas.length, "las huellas del libro de las empresas son DISTINTAS entre sí");

  // no mezcla: todo lo que la empresa ve (antes y después) y todo lo guardado a su nombre
  const textos = [];
  for (const E of empresas) {
    const a = antes.porEmpresa[E.id], d = despues.porEmpresa[E.id];
    textos.push({ empresa: E.id, donde: "E1 (texto)", texto: a.e1.texto }, { empresa: E.id, donde: "E2 (texto)", texto: a.e2.texto });
    textos.push({ empresa: E.id, donde: "retomar tras el reinicio", texto: JSON.stringify(d.retomar) }, { empresa: E.id, donde: "conocerEmpresa tras el reinicio", texto: JSON.stringify(d.conocer) });
  }
  const violaciones = [...controlDeNoMezcla({ textos, marcadores }), ...cifrasAjenas({ empresas, antes, despues })];
  chk(violaciones.length === 0, "NO MEZCLA · ni un nombre, centinela, cifra ni dato declarado de una empresa dentro de lo que ve la otra", JSON.stringify(violaciones.slice(0, 3)));
  return { checks, marcadores, violaciones };
}

/* ── el transcrito, lado a lado ──────────────────────────────────────────────────────────────────────────────── */
export function transcritoLadoALado({ antes, despues, empresas }) {
  const L = [];
  const col = (s, n) => { const t = String(s == null ? "" : s); return t.length >= n ? t.slice(0, n - 1) + "…" : t.padEnd(n); };
  for (const E of empresas) {
    const a = antes.porEmpresa[E.id], d = despues.porEmpresa[E.id];
    L.push("", `════ EMPRESA ${E.id} · «${a.e1.empresa}» · conversación ${a.conversacionId} ════`);
    L.push(`${col("", 30)}${col("ANTES del reinicio", 46)}DESPUÉS del reinicio`);
    const fila = (campo, x, y, corto = (v) => v) => L.push(`${col(campo, 30)}${col(x == null ? x : corto(x), 46)}${col(y == null ? y : corto(y), 46)}${String(x) === String(y) ? "✓" : "✗ DISTINTO"}`);
    for (let i = 0; i < 2; i++) {
      const ea = a.retomar.entregas[i] || {}, ed = d.retomar.entregas[i] || {};
      fila(`E${i + 1} · versión de carga`, ea.versionId, ed.versionId);
      fila(`E${i + 1} · entregada en`, ea.entregadaEn, ed.entregadaEn);
      fila(`E${i + 1} · período`, ea.periodo && ea.periodo.texto, ed.periodo && ed.periodo.texto);
    }
    const ha = a.retomar.hechos, hd = d.retomar.hechos;
    for (let i = 0; i < Math.max(ha.length, hd.length); i++) {
      const x = ha[i], y = hd[i];
      fila(`hecho ${(x || y).id}`, x && `${x.sujeto} · ${x.metrica} = ${x.valor} (${x.origen})`, y && `${y.sujeto} · ${y.metrica} = ${y.valor} (${y.origen})`);
    }
    const pa = a.conocer.hechosAportados.find(delGuion(E, "plazo_de_cobro")) || {}, pd = d.conocer.hechosAportados.find(delGuion(E, "plazo_de_cobro")) || {};
    fila("declarado · plazo de cobro", pa.valor && `${pa.valor.raw} ${pa.valor.unidad} · ${pa.estado} · origen ${pa.origen}`, pd.valor && `${pd.valor.raw} ${pd.valor.unidad} · ${pd.estado} · origen ${pd.origen}`);
    const ca = a.conocer.pendientes.find(delGuion(E, "benchmark_propio_margen")) || {}, cd = d.conocer.pendientes.find(delGuion(E, "benchmark_propio_margen")) || {};
    fila("pendiente · criterio", ca.valor && `${ca.valor.raw} ${ca.valor.unidad} · ${ca.estado} · origen ${ca.origen}`, cd.valor && `${cd.valor.raw} ${cd.valor.unidad} · ${cd.estado} · origen ${cd.origen}`);
    fila("HUELLA del libro (sha256)", a.huellas.libro, d.huellas.libro, (h) => `${String(h).slice(0, 32)}…`);
    fila("HUELLA de la memoria (sha256)", a.huellas.memoria, d.huellas.memoria, (h) => `${String(h).slice(0, 32)}…`);
  }
  return L;
}
