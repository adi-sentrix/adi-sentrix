/* === src/adi/sentrix/rolesCartera.js · EL PAPEL DE CADA CLIENTE, Y LA HUELLA DE CADA MECANISMO =============
 *
 * POR QUÉ EXISTE (owner 2026-09-04, tras probar en producción): ante «¿por qué estamos perdiendo margen?» ADI
 * respondía DÓNDE y CUÁNTO — nunca razonaba el porqué. Su alineamiento, textual: «hay clientes que venden
 * mucho pero erosionan margen, unos apuntan a volumen, otros tienen mejor costo… puede ser una decisión
 * gerencial apuntar a volumen y perder un poco de margen pero eso da rotación, movimiento, liquidez… pero hay
 * otros clientes que bajan el margen por demasiadas acciones comerciales».
 *
 * LA TESIS QUE ESTE MÓDULO HACE MEDIBLE: **no todo margen bajo es un problema.** Un margen bajo con la carga
 * comercial dentro del target es un PRECIO — puede ser una apuesta de volumen deliberada del dueño. Un margen
 * bajo con la carga por encima del target es una FUGA: el descuento se está comiendo la contribución. Separar
 * la ESTRATEGIA de la FUGA es el insight; confundirlas es lo que hacía ADI hasta hoy.
 *
 * QUÉ ES DETERMINÍSTICO ACÁ Y QUÉ NO — la frontera de la casa, intacta:
 *   · SE MIDE: la brecha contra la vara (`benchmarkOf`), la carga contra el target (`POLICY.targetCarga`), el
 *     peso en venta, y el markup sobre el costo cuando el dato trae precio de lista y costo medio.
 *   · SE SELLA: cada huella sale con `probado` (la cuenta está), `indicado` (el patrón está pero el mecanismo
 *     no se aisló) o `abierto` (el dato no alcanza y se dice QUÉ falta).
 *   · NO SE AFIRMA: la INTENCIÓN. Que un volumen sea apuesta deliberada solo lo sabe el dueño — por eso este
 *     módulo emite la PREGUNTA en vez de suponerla (`preguntaAlDueno`).
 *
 * PURO · sin red · cero cifras nuevas fuera de las cuentas declaradas arriba. */
import { applyScenarioToClientesMargen } from "../../engine/scenarios.js";
import { POLICY, benchmarkOf } from "../../config/businessPolicy.js";
import { ESCENARIO_INICIAL } from "../../config/scenarios.js";

const _r1 = (n) => Math.round(n * 10) / 10;
const _num = (v) => (typeof v === "number" && Number.isFinite(v) ? v : null);

/* el markup sobre el costo: el precio de lista contra lo que cuesta. Un markup bajo es «precio pegado al
 * costo» — la huella del mecanismo precio/costo. Sin los dos campos, no hay huella: se declara abierta. */
const _markup = (r) => {
  const pl = _num(r.precioLista), cm = _num(r.costoMedio);
  return pl && cm && cm > 0 ? _r1(((pl - cm) / cm) * 100) : null;
};

/* ── LOS ROLES · reglas DECLARADAS, no opiniones ────────────────────────────────────────────────────────────
 * Cada fila cae en UN rol. El orden importa y es doctrina: la carga sobre el target manda sobre el volumen,
 * porque una fuga medida no se disculpa con un relato de estrategia. */
export const REGLAS_DE_ROL = [
  { rol: "erosion_por_acciones", titulo: "erosión por acciones comerciales", etiqueta: "Clientes · erosión por acciones comerciales",
    regla: "margen bajo el benchmark Y carga comercial sobre el nivel de referencia",
    lectura: "las acciones comerciales se están comiendo la contribución: es fuga, no precio" },
  { rol: "apuesta_de_volumen", titulo: "volumen a margen bajo", etiqueta: "Clientes · volumen a margen bajo",
    regla: "margen bajo el benchmark, carga DENTRO del nivel de referencia, y venta en el tramo alto de la cartera",
    lectura: "el margen bajo viene del precio o del mix, no de la carga comercial — puede ser una apuesta deliberada" },
  { rol: "margen_delgado", titulo: "margen delgado", etiqueta: "Clientes · margen delgado sin volumen ni carga",
    regla: "margen bajo el benchmark, carga dentro del nivel de referencia, venta fuera del tramo alto",
    lectura: "ni la carga ni el volumen lo explican: el precio de lista o el mix de lo que compra" },
  { rol: "sano", titulo: "sobre el benchmark", etiqueta: "Clientes · sobre el benchmark",
    regla: "margen igual o sobre el benchmark declarado",
    lectura: "no es un problema de margen; si además carga alto, sostiene la carga con mejor costo" },
];

/** buildRolesCartera(scenario) → { filas, roles, huellas, preguntaAlDueno, vara, target, hay } · puro. */
export function buildRolesCartera(scenario) {
  const s = scenario || ESCENARIO_INICIAL;
  const rows = (applyScenarioToClientesMargen(s) || []).filter((r) => r && _num(r.margen) !== null && _num(r.venta) !== null);
  if (!rows.length) return { filas: [], roles: {}, huellas: [], preguntaAlDueno: null, vara: null, target: null, hay: false };

  const target = _num(POLICY.targetCarga);
  const ventaTotal = rows.reduce((a, r) => a + (r.venta || 0), 0);
  /* el «tramo alto» no es un umbral inventado: es el bloque que explica la mitad de la venta, ordenando de
   * mayor a menor (el mismo criterio de concentración que el motor ya usa para el 80/20 — acá al 50% porque
   * lo que se busca es «los que mueven el volumen», no la cola larga). */
  const porVenta = rows.slice().sort((a, b) => (b.venta || 0) - (a.venta || 0));
  const tramoAlto = new Set();
  let acum = 0;
  for (const r of porVenta) { if (acum >= ventaTotal * 0.5) break; tramoAlto.add(r.nombre); acum += r.venta || 0; }

  const filas = rows.map((r) => {
    const vara = benchmarkOf(r);
    const brecha = _r1(vara - r.margen);
    const cargaSobre = target !== null && _num(r.pctRebate) !== null ? _r1(r.pctRebate - target) : null;
    const grande = tramoAlto.has(r.nombre);
    let rol;
    if (brecha > 0 && cargaSobre !== null && cargaSobre > 0) rol = "erosion_por_acciones";
    else if (brecha > 0 && grande) rol = "apuesta_de_volumen";
    else if (brecha > 0) rol = "margen_delgado";
    else rol = "sano";
    return { entidad: r.nombre, rol, margen: _r1(r.margen), venta: r.venta, brecha, vara,
      carga: _num(r.pctRebate), cargaSobre, markup: _markup(r), grande,
      pesoVenta: ventaTotal ? _r1((r.venta / ventaTotal) * 100) : null };
  });

  const roles = {};
  for (const reg of REGLAS_DE_ROL) {
    const items = filas.filter((f) => f.rol === reg.rol).sort((a, b) => b.venta - a.venta);
    roles[reg.rol] = { ...reg, items, n: items.length, pesoVenta: _r1(items.reduce((a, f) => a + (f.pesoVenta || 0), 0)) };
  }

  /* ── LAS HUELLAS · cada mecanismo deja una marca distinta en el dato. ADI mira cuál está y sella. ────────── */
  const huellas = [];
  const ero = roles.erosion_por_acciones.items;
  huellas.push({
    mecanismo: "acciones comerciales sobre el nivel de referencia",
    huella: "clientes bajo el benchmark que además pagan más carga que el nivel de referencia",
    presente: ero.length > 0,
    sello: ero.length > 0 ? "probado" : "abierto",
    porque: ero.length > 0
      ? `${ero.length} de los que caen la tienen sobre el ${target}%`
      : `ningún cliente bajo el benchmark supera el ${target}% de carga`,
    items: ero.slice(0, 4),
  });
  const vol = roles.apuesta_de_volumen.items;
  huellas.push({
    mecanismo: "volumen a margen bajo",
    huella: "clientes del tramo alto de venta, bajo el benchmark, con la carga DENTRO del nivel de referencia",
    presente: vol.length > 0,
    sello: vol.length > 0 ? "indicado" : "abierto",
    porque: vol.length > 0
      ? "venta alta y margen bajo sin exceso de carga; si es apuesta deliberada solo lo sabe el dueño"
      : "ningún cliente del tramo alto cae sin carga excedida",
    items: vol.slice(0, 4),
  });
  const conMarkup = filas.filter((f) => f.brecha > 0 && f.markup !== null);
  const sanosMk = filas.filter((f) => f.rol === "sano" && f.markup !== null);
  const mkBajo = conMarkup.length && sanosMk.length
    ? _r1(conMarkup.reduce((a, f) => a + f.markup, 0) / conMarkup.length) < _r1(sanosMk.reduce((a, f) => a + f.markup, 0) / sanosMk.length)
    : false;
  huellas.push({
    mecanismo: "precio de lista pegado al costo",
    huella: "markup (precio de lista sobre costo medio) más bajo en los que caen que en los sanos",
    presente: conMarkup.length > 0 && mkBajo,
    sello: conMarkup.length === 0 ? "abierto" : (mkBajo ? "indicado" : "abierto"),
    porque: conMarkup.length === 0
      ? "tu dato no trae precio de lista y costo medio por cliente: sin eso el precio no se puede separar del costo"
      : (mkBajo
        ? "los que caen tienen el precio más pegado al costo que los sanos"
        : "el markup de los que caen no es menor que el de los sanos: por acá el patrón no aparece"),
    items: conMarkup.slice(0, 4),
  });
  huellas.push({
    mecanismo: "mix de lo que cada cliente compra",
    huella: "margen por familia DENTRO de cada cliente",
    presente: false,
    sello: "abierto",
    porque: "tu dato no cruza cliente con familia",
    falta: "agregar la familia (o la línea de producto) a cada fila de venta en la planilla — con eso el mix deja de ser hipótesis y pasa a cuenta",
    items: [],
  });

  /* ── LA CONCURRENCIA · la tesis que une los puntos ──────────────────────────────────────────────────────
   * ⚠️ MEDIDO AL ESTRENAR ESTE MÓDULO (demo, 2026-09-04) y es el hallazgo que cambia la lectura: los seis
   * clientes que caen bajo la vara son TAMBIÉN los que mueven el volumen, y todos exceden la carga. O sea:
   * volumen y fuga no son dos poblaciones distintas — son la misma gente. Un módulo que los separara en
   * cajas limpias contaría una historia falsa; lo honesto es medir el solapamiento y decirlo, porque cambia
   * la decisión (no se puede «cortar la fuga» sin tocar a los que sostienen la venta). */
  const caen = filas.filter((f) => f.brecha > 0);
  const caenGrandes = caen.filter((f) => f.grande);
  const caenGrandesConCarga = caenGrandes.filter((f) => f.cargaSobre !== null && f.cargaSobre > 0);
  const concurrencia = {
    caen: caen.length,
    grandesQueCaen: caenGrandes.length,
    grandesQueCaenYExcedenCarga: caenGrandesConCarga.length,
    pesoVentaDeLosQueCaen: _r1(caen.reduce((a, f) => a + (f.pesoVenta || 0), 0)),
    /* el rango del exceso: no todos pesan igual, y decirlo evita meter en la misma bolsa a quien excede por
     * 0,3 puntos y a quien excede por 1,9 (el matiz que el owner pidió distinguir) */
    excesoMin: caenGrandesConCarga.length ? Math.min(...caenGrandesConCarga.map((f) => f.cargaSobre)) : null,
    excesoMax: caenGrandesConCarga.length ? Math.max(...caenGrandesConCarga.map((f) => f.cargaSobre)) : null,
    mismaGente: caenGrandes.length > 0 && caenGrandesConCarga.length === caenGrandes.length,
  };

  /* ── LA PREGUNTA AL DUEÑO · solo cuando la distinción depende de una intención que el dato no puede tener.
   * Vale para TODO cliente grande que cae —tenga o no la carga excedida—: la intención es lo que separa la
   * apuesta de la fuga, y esa no está en ninguna columna. */
  const candidatos = (vol.length ? vol : caenGrandes).slice(0, 2);
  const preguntaAlDueno = candidatos.length
    ? { clave: "volumen_deliberado",
        entidades: candidatos.map((f) => f.entidad),
        texto: candidatos.length === 1
          ? `¿El volumen de ${candidatos[0].entidad} a ese margen es una apuesta tuya —rotación y liquidez— o se te fue de las manos?`
          : `¿El volumen de ${candidatos[0].entidad} y ${candidatos[1].entidad} a ese margen es una apuesta tuya —rotación y liquidez— o se te fue de las manos?`,
        porque: "de la respuesta depende si eso es estrategia o fuga, y el dato no mide intención" }
    : null;

  return { filas, roles, huellas, concurrencia, preguntaAlDueno, vara: benchmarkOf(null), target, hay: true };
}
