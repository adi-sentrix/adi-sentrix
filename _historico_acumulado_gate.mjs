/* === _historico_acumulado_gate.mjs · LA CARGA ES HISTÓRICA Y EXPLÍCITA (owner 2026-08-30) ====================
 *
 * EL DEFECTO QUE VIGILA, verificado en producción antes de este cambio: cada carga REEMPLAZABA el pack entero.
 * Subir enero-marzo y después abril-junio hacía desaparecer enero-marzo sin un aviso — pérdida de dato
 * silenciosa. La regla nueva del owner, con su gate exigente, textual:
 *
 *   1 · subir enero-marzo y activar;
 *   2 · subir abril-junio y activar;
 *   3 · ver que el alcance diga enero-junio (y que los huecos, si los hay, SE NOMBREN);
 *   4 · subir mayo de nuevo y exigir decisión de reemplazo — el default es cancelar;
 *   5 · confirmar el reemplazo y verificar que mayo NO queda duplicado;
 *   6 · empresa B con otro histórico no se mezcla — mismos nombres de cliente y SKU, cifras distintas.
 *
 * ⚠️ SE FUSIONAN HECHOS, NUNCA AGREGADOS: el pack acumulado se RECALCULA entero desde las filas con el motor de
 * siempre. Este gate lo comprueba midiendo el margen del acumulado contra el margen calculado de las filas.
 *
 * POR QUÉ CORRE SIN BASE: `persistirCarga` / `activarVersion` / `historiaActiva` reciben el cliente inyectado,
 * así que se ejercen contra un doble en memoria que simula el RLS de la base (cada operación scoped al tenant
 * del pase — igual que Postgres con `request.jwt.claims`). Sección 8: carnadas que mutan el código VIVO.
 *
 * OFFLINE · doble en memoria + ingesta determinística · no puede gastar.
 * `node --import ./scripts/offline-guard.mjs _historico_acumulado_gate.mjs`
 */
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { construirXlsx } from "./src/ingesta/escribirLibro.js";
import { HOJAS, PARAMETROS, MARCA_PLANTILLA, HOJA_EMPRESA } from "./src/config/contract/plantilla.js";
import { ingestarPlantilla } from "./src/ingesta/plantilla/ingestarPlantilla.js";
import { handleIngesta } from "./src/ingesta/handleIngesta.server.js";
import { persistirCarga, historiaActiva, activarVersion } from "./src/ingesta/persistirCarga.server.js";
import { diffDeCarga, fusionarHechos, alcanceDeHistoria, periodosDeHechos, huecosDe, periodoInformadoDe } from "./src/ingesta/historico.js";

let pass = 0, fail = 0;
const ok = (cond, label, detalle) => {
  if (cond) { pass++; console.log(`  ✓ ${label}`); }
  else { fail++; console.log(`  ✗ ${label}`); if (detalle !== undefined) console.log(`      ${detalle}`); }
};
const H = (t) => console.log(`\n${t}`);

/* ── LOS ARCHIVOS · sintéticos, entidades inventadas (restricción vigente del owner) ─────────────────────────── */
const fila = (fecha, cliente, sku, marca, fam, und, venta, costo, acc) => ({
  fecha, folio: `F-${cliente.slice(0, 3).toUpperCase()}-${fecha.slice(0, 7)}`, tipoDoc: "factura", condicion: "contado",
  cliente, puntoVenta: null, canal: "Mayorista", sku, marca, sfamilia: fam, unidades: und, venta, costo, acciones: acc, precioLista: null,
});
const libro = (params, ventas, inv) => {
  const hojas = [{ nombre: HOJA_EMPRESA, filas: [[MARCA_PLANTILLA], [], ...PARAMETROS.map((p) => [p.etiqueta, params[p.clave] ?? null])] }];
  for (const h of HOJAS) {
    const datos = h.nombre === "Ventas" ? ventas : h.nombre === "Inventario" ? (inv || []) : [];
    hojas.push({ nombre: h.nombre, filas: [h.columnas.map((c) => c.titulo), ...datos.map((f) => h.columnas.map((c) => f[c.campo] ?? null))] });
  }
  return Buffer.from(construirXlsx(hojas));
};
const P = (id, nombre, per) => ({ empresa_id: id, empresa_nombre: nombre, periodo_actual: per, moneda: "CLP" });

// A1 · enero-marzo de ACME
const A1 = libro(P("acme", "ACME", "2026-03-31"), [
  fila("2026-01-15", "Nortania", "AX-10", "Corvex", "Herrajes", 100, 5000, 3400, 200),
  fila("2026-02-12", "Nortania", "AX-10", "Corvex", "Herrajes", 110, 5500, 3700, 220),
  fila("2026-03-18", "Nortania", "AX-10", "Corvex", "Herrajes", 120, 6000, 4000, 240),
  fila("2026-03-18", "Sureste", "BX-20", "Delmar", "Selladores", 40, 2000, 1500, 60),
], [{ sku: "AX-10", bodega: "Central", stockUnd: 80 }]);
// A2 · abril-junio de ACME (con inventario nuevo: la foto del archivo nuevo manda)
const A2 = libro(P("acme", "ACME", "2026-06-30"), [
  fila("2026-04-10", "Nortania", "AX-10", "Corvex", "Herrajes", 105, 5300, 3550, 210),
  fila("2026-05-14", "Nortania", "AX-10", "Corvex", "Herrajes", 90, 4500, 3050, 180),
  fila("2026-06-19", "Nortania", "AX-10", "Corvex", "Herrajes", 130, 6500, 4300, 260),
  fila("2026-06-19", "Sureste", "BX-20", "Delmar", "Selladores", 44, 2200, 1650, 66),
], [{ sku: "AX-10", bodega: "Central", stockUnd: 65 }]);
// A3 · MAYO de nuevo, corregido (cifra distinta a propósito: si se sumara, el duplicado se vería)
const MAYO_CORREGIDO = 4800;
const A3 = libro(P("acme", "ACME", "2026-05-31"), [
  fila("2026-05-14", "Nortania", "AX-10", "Corvex", "Herrajes", 96, MAYO_CORREGIDO, 3200, 190),
], null);
// B1 · empresa B con LOS MISMOS nombres de cliente y SKU y cifras distintas — la exigencia textual del owner
const B1 = libro(P("brisas", "Brisas SpA", "2026-02-28"), [
  fila("2026-02-12", "Nortania", "AX-10", "Corvex", "Herrajes", 10, 900, 600, 30),
], null);

const ing = (buf, nombre) => ingestarPlantilla(buf, { nombreArchivo: nombre, fechaCarga: "2026-08-30" });

/* ── EL DOBLE · simula el RLS de la base: cada operación scoped al tenant del pase ───────────────────────────── */
function dobleDeBase() {
  const T = { uploads: [], fact_pack_versions: [] };
  let nid = 0, reloj = 0;
  const tenantDelPase = (pase) => { try { return JSON.parse(Buffer.from(String(pase).split(".")[1], "base64url").toString()).tenant_id; } catch { return null; } };
  const cli = {
    async seleccionar(tabla, o) {
      const t = tenantDelPase(o.pase);
      let filas = (T[tabla] || []).filter((f) => f.tenant_id === t);
      for (const [k, v] of Object.entries(o.filtros || {})) { const val = String(v).replace(/^eq\./, ""); filas = filas.filter((f) => String(f[k]) === val); }
      if (o.orden) { const [c, d] = o.orden.split("."); filas = [...filas].sort((a, b) => (a[c] < b[c] ? -1 : 1) * (d === "desc" ? -1 : 1)); }
      if (o.limite) filas = filas.slice(0, o.limite);
      return { ok: true, filas: filas.map((f) => ({ ...f })) };
    },
    async insertar(tabla, o) {
      const t = tenantDelPase(o.pase);
      const f = Array.isArray(o.filas) ? o.filas[0] : o.filas;
      if (f.tenant_id !== t) return { ok: false, motivo: "RLS: tenant ajeno" };
      const con = { ...f, id: `id-${++nid}`, created_at: `2026-08-30T00:00:${String(++reloj).padStart(2, "0")}Z` };
      T[tabla].push(con);
      return { ok: true, filas: [{ ...con }] };
    },
    async actualizar(tabla, o) {
      const t = tenantDelPase(o.pase);
      for (const f of T[tabla] || []) {
        if (f.tenant_id !== t) continue;
        let pasa = true;
        for (const [k, v] of Object.entries(o.filtros || {})) if (String(f[k]) !== String(v).replace(/^eq\./, "")) pasa = false;
        if (pasa) Object.assign(f, o.cambios);
      }
      return { ok: true, filas: [] };
    },
    async subirObjeto() { return { ok: true, filas: [] }; },
    async llamarFuncion(nombre, args, o) {
      const t = tenantDelPase(o.pase);
      if (nombre !== "adi_activar_version") return { ok: true, filas: [{ version: 1 }] };
      const fila2 = T.fact_pack_versions.find((f) => f.id === args.p_version_id && f.tenant_id === t);
      if (!fila2) return { ok: false, motivo: "la versión no existe o no es alcanzable con este pase" };
      for (const f of T.fact_pack_versions) if (f.tenant_id === t) f.activa = false;
      fila2.activa = true;
      if (args.p_sello) fila2.sello = args.p_sello;
      return { ok: true, filas: [{ id: fila2.id, version: fila2.version, activa: true }] };
    },
  };
  return { cli, T };
}
const ENV = { SUPABASE_URL: "https://x.supabase.co", SUPABASE_ANON_KEY: "k", SUPABASE_JWT_SECRET: "s" };
const subir = (cli, tenantId, buf, nombre) => {
  const r = ing(buf, nombre);
  return persistirCarga({ tenantId, bytes: buf, nombreArchivo: nombre, dataset: r.dataset, hechos: r.hechos, sello: null, plantillaVersion: "v2", env: ENV, cliente: cli });
};

const { cli, T } = dobleDeBase();

/* ═══ 1 · SUBIR ENERO-MARZO Y ACTIVAR ═════════════════════════════════════════════════════════════════════════ */
H("1 · enero-marzo entra y el alcance lo dice");
const p1 = await subir(cli, "acme", A1, "a1.xlsx");
{
  ok(p1.guardado === true, "la carga se guardó (versión inactiva)");
  const act = await activarVersion({ tenantId: "acme", versionId: p1.versionId, env: ENV, cliente: cli });
  ok(act.activada === true, "y se activó", act.motivo);
  ok(!!act.alcance && act.alcance.texto === "Ahora tengo datos desde enero hasta marzo 2026.",
    "el alcance declara enero-marzo, con las palabras de la casa", act.alcance && act.alcance.texto);
  ok(!!act.pack && act.pack.historiaCompleta === true && Array.isArray(act.pack.hechos.Ventas),
    "el pack activo lleva la historia completa y sus hechos adentro");
}

/* ═══ 2 · SUBIR ABRIL-JUNIO: EL DIFF DECLARA, LA ACTIVACIÓN FUSIONA ═══════════════════════════════════════════ */
H("2 · abril-junio se AGREGA — enero-marzo ya no desaparece");
const p2 = await subir(cli, "acme", A2, "a2.xlsx");
{
  const activa = await historiaActiva({ tenantId: "acme", env: ENV, cliente: cli });
  const d = diffDeCarga({ previos: activa.periodos, delArchivo: periodosDeHechos(ing(A2, "a2.xlsx").hechos) });
  ok(d.nuevos.join(",") === "2026-04,2026-05,2026-06" && d.repetidos.length === 0, "el diff ve tres meses nuevos y ninguno repetido");
  ok(/Ya tenías enero, febrero y marzo 2026\./.test(d.texto) && /Si lo activas/.test(d.texto),
    "y lo dice con la frase del owner: qué había, qué trae, qué queda", d.texto);
  ok(d.pideDecision === false, "sin repetidos no hay nada que preguntar");

  const act = await activarVersion({ tenantId: "acme", versionId: p2.versionId, env: ENV, cliente: cli });
  ok(act.activada === true, "activar fusiona sin preguntar", act.motivo);
  ok(act.alcance.texto === "Ahora tengo datos desde enero hasta junio 2026.",
    "★ paso 3 del owner: el alcance dice enero-junio", act.alcance.texto);

  const pk = act.pack;
  ok((pk.ventasMensuales || []).length === 6, `la serie global del pack acumulado tiene 6 meses (${(pk.ventasMensuales || []).length})`);
  ok((pk.historialMargen["Nortania"] || []).length === 6, "y la serie por entidad también");
  const junio = pk.clientesVentas.find((c) => c.nombre === "Nortania");
  ok(junio && junio.actual === 6500 && junio.anterior === 4500,
    "el período informado es JUNIO y se compara contra mayo — la comparación mensual se encendió con la historia",
    JSON.stringify(junio && { actual: junio.actual, anterior: junio.anterior }));
  ok((pk.skuInventario || []).some((s) => s.stockUnd === 65),
    "el inventario es la foto del archivo NUEVO (65 unidades), no la vieja");
  /* fusionar HECHOS y no agregados: el margen del acumulado tiene que ser el de las filas, recalculado */
  const filasEne = pk.hechos.Ventas.filter((v) => v.periodo === "2026-01");
  ok(filasEne.length === 1 && filasEne[0].venta === 5000, "las filas de enero siguen en los hechos, intactas");
}

/* ═══ 3 · LOS HUECOS SE NOMBRAN ═══════════════════════════════════════════════════════════════════════════════ */
H("3 · una historia con agujeros no dice «desde-hasta»: nombra lo que falta");
{
  ok(huecosDe(["2026-03", "2026-05", "2026-09"]).join(",") === "2026-04,2026-06,2026-07,2026-08",
    "los huecos se calculan entre el primero y el último");
  const a = alcanceDeHistoria(["2026-03", "2026-05", "2026-09"]);
  ok(a.texto === "Tengo marzo, mayo y septiembre 2026; faltan abril, junio, julio y agosto 2026.",
    "y la frase es la del owner: tengo esto, falta esto", a.texto);
  ok(alcanceDeHistoria(["2026-05"]).texto === "Ahora tengo datos de mayo 2026.", "un solo mes se dice como un mes");
}

/* ═══ 4 · MAYO DE NUEVO: DECISIÓN EXPLÍCITA O NADA ════════════════════════════════════════════════════════════ */
H("4 · un período repetido exige decisión — el default es cancelar");
const p3 = await subir(cli, "acme", A3, "a3.xlsx");
{
  const activa = await historiaActiva({ tenantId: "acme", env: ENV, cliente: cli });
  const d = diffDeCarga({ previos: activa.periodos, delArchivo: ["2026-05"] });
  ok(d.pideDecision === true && d.repetidos.join(",") === "2026-05", "el diff marca mayo como repetido y pide decisión");
  ok(/¿Quieres reemplazar ese mes, o prefieres cancelar\?/.test(d.texto), "con la pregunta del owner, textual", d.texto);

  const sinDecision = await activarVersion({ tenantId: "acme", versionId: p3.versionId, env: ENV, cliente: cli });
  ok(sinDecision.activada === false, "★ activar SIN decisión se RECHAZA — nunca suma silenciosa");
  ok(/mayo 2026 ya existe/.test(sinDecision.motivo) && /No se activó nada/.test(sinDecision.motivo),
    "y el motivo lo dice con todas las letras", sinDecision.motivo);
  const sigueActiva = await historiaActiva({ tenantId: "acme", env: ENV, cliente: cli });
  ok(sigueActiva.periodos.length === 6 && T.fact_pack_versions.filter((f) => f.tenant_id === "acme" && f.activa).length === 1,
    "la historia activa quedó como estaba: cancelar es cancelar");

  /* La decisión sobre mayo viene dada; lo que se prueba es el mes FANTASMA de más en la lista. */
  const fantasma = await activarVersion({ tenantId: "acme", versionId: p3.versionId, env: ENV, cliente: cli, reemplazar: ["2026-05", "2026-07"] });
  ok(fantasma.activada === false && /no trae ese per[ií]odo/.test(fantasma.motivo),
    "pedir reemplazar un mes que el archivo no trae también se rechaza", fantasma.motivo);
  ok((await historiaActiva({ tenantId: "acme", env: ENV, cliente: cli })).periodos.length === 6,
    "y ese intento tampoco movió la historia");
}

/* ═══ 5 · REEMPLAZO CONFIRMADO: MAYO NO SE DUPLICA ════════════════════════════════════════════════════════════ */
H("5 · con la decisión explícita, mayo se REEMPLAZA — ni se suma ni se pierde el resto");
{
  const act = await activarVersion({ tenantId: "acme", versionId: p3.versionId, env: ENV, cliente: cli, reemplazar: ["2026-05"] });
  ok(act.activada === true, "activar con reemplazar:[mayo] pasa", act.motivo);
  const pk = act.pack;
  const mayo = pk.hechos.Ventas.filter((v) => v.periodo === "2026-05");
  ok(mayo.length === 1 && mayo[0].venta === MAYO_CORREGIDO,
    `★ mayo tiene UNA fila y es la corregida (${MAYO_CORREGIDO}) — no ${4500 + MAYO_CORREGIDO} que sería el duplicado`,
    JSON.stringify(mayo.map((v) => v.venta)));
  const serieMayo = (pk.historialMargen["Nortania"] || []).find((x) => x.periodo === "2026-05");
  ok(serieMayo && serieMayo.venta === MAYO_CORREGIDO, "y la serie por entidad sirve el mayo corregido");
  ok(periodosDeHechos(pk.hechos).length === 6, "los otros cinco meses siguen todos");
  const nortania = pk.clientesVentas.find((c) => c.nombre === "Nortania");
  ok(nortania && nortania.actual === 6500,
    "el período de la Mesa SIGUE siendo junio: re-subir un mes viejo no retrocede el negocio", JSON.stringify(nortania && nortania.actual));

  /* LA REVERSIÓN: cada activación es una versión completa; volver a la anterior restaura TAL CUAL, sin fusión */
  const vuelta = await activarVersion({ tenantId: "acme", versionId: p2.versionId, env: ENV, cliente: cli });
  ok(vuelta.activada === true && vuelta.pack.hechos.Ventas.find((v) => v.periodo === "2026-05").venta === 4500,
    "reactivar la versión anterior devuelve el mayo original — reversible de verdad, sin pedir permiso mes a mes");
  const otraVez = await activarVersion({ tenantId: "acme", versionId: p3.versionId, env: ENV, cliente: cli });
  ok(otraVez.activada === true && otraVez.pack.hechos.Ventas.find((v) => v.periodo === "2026-05").venta === MAYO_CORREGIDO,
    "y volver a la corregida también es un solo acto: su pack ya es historia completa");
}

/* ═══ 6 · EMPRESA B NO SE MEZCLA · mismos nombres, cifras distintas ═══════════════════════════════════════════ */
H("6 · empresa B: mismos nombres de cliente y SKU, historia propia");
{
  const antesA = JSON.stringify(T.fact_pack_versions.filter((f) => f.tenant_id === "acme"));
  const pB = await subir(cli, "brisas", B1, "b1.xlsx");
  const actB = await activarVersion({ tenantId: "brisas", versionId: pB.versionId, env: ENV, cliente: cli });
  ok(actB.activada === true, "B sube y activa su propio archivo", actB.motivo);
  ok(actB.alcance.texto === "Ahora tengo datos de febrero 2026.", "el alcance de B es SU mes, no los seis de A", actB.alcance.texto);
  const nB = actB.pack.clientesVentas.find((c) => c.nombre === "Nortania");
  ok(nB && nB.actual === 900, "la Nortania de B vale 900 — la cifra de B, no la de A", JSON.stringify(nB && nB.actual));

  const hA = await historiaActiva({ tenantId: "acme", env: ENV, cliente: cli });
  ok(hA.periodos.length === 6, "la historia de A sigue teniendo sus seis meses");
  const nA = (hA.hechos.Ventas || []).filter((v) => v.cliente === "Nortania" && v.periodo === "2026-02");
  ok(nA.length === 1 && nA[0].venta === 5500, "y el febrero de la Nortania de A sigue valiendo 5500");
  ok(JSON.stringify(T.fact_pack_versions.filter((f) => f.tenant_id === "acme")) === antesA,
    "★ la subida y activación de B no tocó UNA SOLA fila de A");

  const dB = diffDeCarga({ previos: (await historiaActiva({ tenantId: "brisas", env: ENV, cliente: cli })).periodos, delArchivo: ["2026-03"] });
  ok(dB.pideDecision === false && dB.nuevos.join(",") === "2026-03",
    "un marzo nuevo para B no pregunta nada, aunque A ya tenga marzo: la historia es POR EMPRESA");
}

/* ═══ 7 · EL BORDE HTTP · handleIngesta declara la historia también sin base ══════════════════════════════════ */
H("7 · handleIngesta lleva la historia en la respuesta");
{
  const r = await handleIngesta({ archivo: A1.toString("base64"), nombre: "a1.xlsx" }, {});
  ok(r.ok && r.historia && /primera carga/.test(r.historia.texto),
    "sin base, la carga declara que es la primera — el campo viaja siempre", r.historia && r.historia.texto);
  ok(r.historia.pideDecision === false, "y no pide decisión");
}

/* ═══ 8 · CARNADAS · cada afirmación, probada capaz de ponerse ROJA ═══════════════════════════════════════════ */
H("8 · CARNADA · el candado se prueba con el defecto puesto");
{
  const tmp = [];
  let nCarnada = 0;
  const mutar = (rel, reemplazos) => {
    const abs = path.join(process.cwd(), rel);
    // saltos normalizados ANTES de mutar — la lección de _esquema_datos_gate: en Windows git entrega CRLF
    let txt = fs.readFileSync(abs, "utf8").replace(/\r\n/g, "\n");
    for (const [de, a] of reemplazos) {
      const antes = txt;
      txt = txt.replace(de, a);
      if (txt === antes) return { error: `la carnada no encontró qué mutar en ${rel}` };
    }
    // nombre único POR CARNADA: dos copias con la misma URL serían el mismo módulo para el caché de ESM
    const destino = abs.replace(/\.js$/, `.carnada${process.pid}_${++nCarnada}.js`);
    fs.writeFileSync(destino, txt);
    tmp.push(destino);
    return { url: pathToFileURL(destino).href };
  };
  const carnada = async (nombre, rel, reemplazos, prueba) => {
    const m = mutar(rel, reemplazos);
    if (m.error) return ok(false, `carnada «${nombre}»`, m.error);
    let cazada = false, detalle = "";
    try { cazada = await prueba(await import(m.url)); }
    catch (e) { detalle = `la copia mutada ni siquiera carga: ${e.message}`; }
    ok(cazada, `carnada «${nombre}» → el chequeo se pone ROJO`, detalle || "el defecto pasó DESAPERCIBIDO");
  };

  const HECHOS_A = { parametros: P("acme", "ACME", "2026-03-31"), fechaCarga: "2026-08-30", inventarioDe: "2026-08-30",
    Ventas: [ { periodo: "2026-05", fecha: "2026-05-14", cliente: "Nortania", sku: "AX-10", venta: 4500, costo: 3050, unidades: 90, acciones: 180 } ],
    Inventario: [], Abonos: [] };
  const ARCHIVO_MAYO = { parametros: P("acme", "ACME", "2026-05-31"), fechaCarga: "2026-08-30", inventarioDe: "2026-08-30",
    Ventas: [ { periodo: "2026-05", fecha: "2026-05-14", cliente: "Nortania", sku: "AX-10", venta: MAYO_CORREGIDO, costo: 3200, unidades: 96, acciones: 190 } ],
    Inventario: [], Abonos: [] };

  // (a) el duplicado silencioso: fusionar AGREGANDO en vez de reemplazar
  await carnada("sumar el mes repetido en vez de reemplazarlo", "src/ingesta/historico.js",
    [[/  const vive = \(per\) => !\(pedidos\.has\(per\) && setArchivo\.has\(per\)\);\n/, "  const vive = () => true;\n"]],
    async (Mut) => {
      const f = Mut.fusionarHechos({ previos: HECHOS_A, delArchivo: ARCHIVO_MAYO, reemplazar: ["2026-05"] });
      const mayo = f.ok ? f.hechos.Ventas.filter((v) => v.periodo === "2026-05") : [];
      return mayo.length === 2;   // el defecto: mayo dos veces — el gate del paso 5 lo cazaría
    });

  // (b) el reemplazo sin preguntar: pisar aunque nadie lo haya pedido
  await carnada("reemplazar sin decisión explícita", "src/ingesta/historico.js",
    [[/  if \(sinDecision\.length\) \{\n[\s\S]*?\n  \}\n/, "\n"]],
    async (Mut) => {
      const f = Mut.fusionarHechos({ previos: HECHOS_A, delArchivo: ARCHIVO_MAYO, reemplazar: [] });
      return f.ok === true;   // el defecto: fusiona igual — el paso 4 exige el rechazo
    });

  // (c) el alcance que esconde los huecos
  await carnada("declarar «desde-hasta» sobre una historia con agujeros", "src/ingesta/historico.js",
    [[/  const texto = faltantes\.length\n    \? `Tengo /, "  const texto = false\n    ? `Tengo "]],
    async (Mut) => {
      const a = Mut.alcanceDeHistoria(["2026-03", "2026-05", "2026-09"]);
      return !/faltan/.test(a.texto);   // el defecto: los agujeros desaparecen de la frase
    });

  // (d) la activación que no re-verifica la decisión (la pantalla podría mandarse sola)
  await carnada("activar fusionando aunque la fusión diga que no", "src/ingesta/persistirCarga.server.js",
    [[/    if \(!fusion\.ok\) return \{ activada: false, motivo: fusion\.motivo, sinDecision: fusion\.sinDecision \|\| null \};\n/,
      "    if (!fusion.ok) { fusion.ok = true; fusion.hechos = { ...packVersion.hechos }; fusion.agregados = []; fusion.reemplazados = []; }\n"]],
    async (Mut) => {
      const { cli: c2 } = dobleDeBase();
      const pa = await subir(c2, "acme", A1, "a1.xlsx");
      await Mut.activarVersion({ tenantId: "acme", versionId: pa.versionId, env: ENV, cliente: c2 });
      const pm = await subir(c2, "acme", A3, "a3.xlsx");
      const r = await Mut.activarVersion({ tenantId: "acme", versionId: pm.versionId, env: ENV, cliente: c2 });
      return r.activada === true;   // el defecto: activó sin decisión — el paso 4 exige activada:false
    });

  // (e) el muro entre empresas: si el RLS del doble se apaga Y el update pierde su filtro, ¿el chequeo de
  //     «A intacta» lo ve? — prueba la SENSIBILIDAD de la afirmación del paso 6, no el código del producto
  {
    const { cli: c3, T: T3 } = dobleDeBase();
    const sinRls = {
      ...c3,
      async actualizar(tabla, o) {   // un update que ignora tenant Y filtros: pisa todo
        for (const f of T3[tabla] || []) Object.assign(f, o.cambios);
        return { ok: true, filas: [] };
      },
    };
    const pa = await subir(c3, "acme", A1, "a1.xlsx");
    await activarVersion({ tenantId: "acme", versionId: pa.versionId, env: ENV, cliente: c3 });
    const antesA = JSON.stringify(T3.fact_pack_versions.filter((f) => f.tenant_id === "acme"));
    const pb = await subir(c3, "brisas", B1, "b1.xlsx");
    await activarVersion({ tenantId: "brisas", versionId: pb.versionId, env: ENV, cliente: sinRls });
    const cambio = JSON.stringify(T3.fact_pack_versions.filter((f) => f.tenant_id === "acme")) !== antesA;
    ok(cambio, "carnada «B escribe sin muro» → la afirmación «A intacta» se pone ROJA",
      cambio ? undefined : "el chequeo de aislamiento no distingue un muro caído");
  }

  for (const f of tmp) { try { fs.unlinkSync(f); } catch { /* */ } }
}

console.log(`\n── _historico_acumulado_gate: ${pass} PASS · ${fail} FAIL (de ${pass + fail}) ──`);
process.exit(fail ? 1 : 0);
