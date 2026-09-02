/* === src/adi/agente/herramientasAgente.js · LAS HERRAMIENTAS PROPIAS DEL AGENTE (F2 · owner 2026-08-30) ======
 *
 * La caja del agente = las 24 de `TOOLS` (toolRegistry, con sus contratos) MÁS éstas:
 *
 *   · `serieEntidad` — el cruce entidad×mes REAL RECONCILIADO que este frente construyó. `trend` sirve la
 *     global; este sirve la de UNA entidad, o el MOTIVO del bloqueo con palabras — para que el cerebro decline
 *     honesto en una línea leyendo lo que la herramienta le dijo, en vez de inventar o volcar el tablero.
 *     Es la heredera del interceptor-puente: misma lectura del dato, mismo contrato de honestidad; cambia
 *     quién decide invocarla (el cerebro, no un regex).
 *
 *   · `registrarSupuesto` — la cifra que el USUARIO ofrece entra a la boleta ETIQUETADA (`source:
 *     "user_supuesto"`), nunca mezclada con lo verificado. El notario ya vigila supuestos; esto convierte la
 *     etiqueta en un acto de primera clase.
 *
 *   · `preferenciaNombre` — cómo prefiere ser llamado el usuario. SOLO el nombre: el registro no se configura.
 *
 *   · `proyectar` — la venta a futuro con la tasa que el usuario DECLARA. Es la pieza que le faltaba al agente
 *     para responder una proyección sobre TODO EL NEGOCIO (ver su bloque, más abajo).
 *
 * MISMA FORMA que las tools del registro: `(args, { scenario }) → { facts, boleta, coverage }`. Los montos van
 * con la escala DECLARADA del pack, como todo desde el barrido A. PURO · sin red. */
import { getTenantData } from "../../data/tenantStore.js";
import { factorComercialDe } from "../../config/contract/figureType.js";
import { serieRealDe } from "../sentrix/capability.js";
import { ventaOficialDelPeriodo } from "../sentrix/temporal.js";   // `proyectar` · la venta oficial del período: la sola verdad que el owner declaró (2026-07-15)
import { buildMesaFlujo } from "../sentrix/mesaFlujo.js";   // `cobranza` · la MISMA mesa que la pestaña Flujo Comercial — una sola verdad, cero recalculo
import { findCandidates } from "../oracle/entityIndex.js";
import { fig, parseFigures } from "../boleta.js";   // parseFigures se usa como FORMATEADOR (ver `_m` en proyectar): la técnica de la casa, jamás una copia
import { fmtMonto, simboloMoneda } from "../../config/moneda.js";
import { nombreDePeriodo } from "../../ingesta/historico.js";
import { ESCENARIO_INICIAL } from "../../config/scenarios.js";   // colapso del eje: el agente lee el MISMO dato que la pantalla
import { setNombreUsuario } from "./preferenciaNombre.js";   // F3 · «llámame jc» — solo el nombre, jamás el tono

const _pct = (v) => `${(+v).toFixed(1)}%`;

/** resuelve el nombre contra los cuatro ejes del historial — tolera tipeo, jamás adivina entre dos. */
function _resolver(nombre) {
  for (const eje of ["cliente", "marca", "familia", "sku"]) {
    const c = findCandidates(eje, nombre, { max: 2 });
    if (!c.length) continue;
    if (c.length > 1 && c[0].motivo !== "exacto" && c[0].distancia === c[1].distancia) continue;
    return { nombre: c[0].nombre, eje };
  }
  return null;
}

/* serieEntidad({ entity, metrica }) → la serie mensual real de esa entidad, o el motivo del bloqueo.
 * `metrica`: venta (default) · contribucion · unidades · acciones · margen. */
export function serieEntidad({ entity, metrica = "venta" } = {}, { scenario = ESCENARIO_INICIAL } = {}) {
  const d = getTenantData() || {};
  const sinSoporte = (reason) => ({ facts: null, boleta: [], coverage: { supported: false, reason } });
  if (!entity) return sinSoporte("serieEntidad necesita `entity`: de quién es la serie");
  const res = _resolver(entity);
  if (!res) return sinSoporte(`no encuentro «${entity}» en ningún eje de este dato`);

  const estado = serieRealDe(res.nombre);
  if (!estado.real) {
    const motivo = estado.motivo === "no-reconcilia"
      ? `la serie mensual de ${res.nombre} no cierra contra su cifra oficial del período: no se sirve ninguno de los dos montos`
      : estado.motivo === "sin-periodo"
        ? `el histórico por entidad de este dato es de muestra y no reconcilia con la cifra oficial: no se usa`
        : `no hay serie mensual de ${res.nombre} en el dato de esta empresa`;
    return sinSoporte(motivo);
  }

  const serie = (d.historialMargen || {})[res.nombre] || [];
  const fx = factorComercialDe(d);
  const campo = { venta: "venta", contribucion: "contribucion", unidades: "unidades", acciones: "rebates", margen: "margen" }[metrica];
  if (!campo) return sinSoporte(`métrica «${metrica}» no soportada en la serie (venta · contribucion · unidades · acciones · margen)`);

  const boleta = [];
  const puntos = serie.map((p) => {
    const v = p[campo];
    const fmt = v === null ? null
      : metrica === "margen" ? _pct(v)
      : metrica === "unidades" ? `${Math.round(v)}` : fmtMonto(v * fx, { dataset: d });
    if (v !== null) boleta.push(fig(`${res.nombre} · ${metrica} · ${nombreDePeriodo(p.periodo)}`, fmt,
      { unit: metrica === "margen" ? "pct" : metrica === "unidades" ? "count" : "money",
        raw: metrica === "margen" || metrica === "unidades" ? v : v * fx,
        source: "serie", formula: "suma de las filas del archivo en ese mes · reconciliada con la cifra oficial",
        context: `serie mensual real de ${res.nombre}` }));
    return { periodo: p.periodo, mes: nombreDePeriodo(p.periodo), valor: v, fmt };
  });

  return {
    facts: {
      lens: "serie_entidad", entidad: res.nombre, eje: res.eje, metrica,
      n: puntos.length, desde: serie.length ? serie[0].periodo : null, hasta: serie.length ? serie[serie.length - 1].periodo : null,
      puntos,
      nota: puntos.some((p) => p.valor === null)
        ? "los meses sin venta no tienen esta métrica: van en null, no en cero"
        : null,
    },
    boleta,
    coverage: { supported: true, reason: null },
  };
}

/* P4 DE LA CORRIDA 2 (2026-08-31) · LA UNIDAD DEL ECO LA DICE EL USUARIO. Medido en T17: el usuario dijo
 * «30%» y el eco salió «Tu supuesto de $30» — el cerebro llamó sin declarar unidad y el default money la
 * convirtió en dinero. Regla de la casa: $ y % no se cruzan. Este eco CITA al usuario, así que la unidad se
 * lee de SU texto cuando ahí está explícita, y eso manda sobre el argumento del modelo. Mecánico: se busca la
 * cifra dentro del texto con su símbolo pegado; si no aparece explícita, se respeta lo declarado. */
function _unidadDelTexto(texto, cifra) {
  const n = Number(cifra);
  if (!Number.isFinite(n)) return null;
  const t = String(texto || "");
  const num = String(n).replace(/\./g, "[.,]");
  if (new RegExp(`${num}\\s?%`).test(t)) return "pct";
  if (new RegExp(`\\$\\s?${num}(?![\\d.,]*\\s?%)`).test(t)) return "money";
  return null;
}

/* registrarSupuesto({ texto, cifra, unidad }) → el supuesto del usuario, a la boleta CON etiqueta.
 * No calcula nada: registra. El cerebro lo usa para comparar contra lo verificado SIN mezclar. */
export function registrarSupuesto({ texto, cifra, unidad = "money" } = {}) {
  const sinSoporte = (reason) => ({ facts: null, boleta: [], coverage: { supported: false, reason } });
  if (!texto || typeof texto !== "string") return sinSoporte("registrarSupuesto necesita `texto`: qué afirmó el usuario, con sus palabras");
  const v = Number(cifra);
  if (!Number.isFinite(v)) return sinSoporte("registrarSupuesto necesita `cifra`: el número que el usuario ofreció");
  const d = getTenantData() || {};
  const u = _unidadDelTexto(texto, v) || unidad || "money";   // P4 · el texto del usuario manda sobre el argumento
  const fmt = u === "pct" ? _pct(v) : u === "count" ? String(Math.round(v)) : fmtMonto(v, { dataset: d });
  return {
    facts: { lens: "supuesto_usuario", texto: String(texto).slice(0, 200), cifra: v, unidad: u, etiqueta: "SUPUESTO DEL USUARIO — no verificado" },
    boleta: [fig(`Supuesto del usuario · ${String(texto).slice(0, 60)}`, fmt,
      { unit: u, raw: v, source: "user_supuesto", mandatory: false,
        context: "cifra ofrecida por el usuario — se compara contra lo verificado, jamás se mezcla sin etiqueta" })],
    coverage: { supported: true, reason: null },
  };
}

/* === proyectar · LA PIEZA QUE FALTABA (certificación 2026-09-01 · decisión del supervisor: tool nueva) ======
 *
 * EL HUECO QUE CIERRA, medido en la corrida: el agente podía LEER la venta total ($100,0M, autorizada) pero no
 * tenía forma de producir una PROYECCIÓN sellada. `simulate` exige una dimensión de cliente/sku/marca/familia
 * y no admite «todo el negocio»; `trend` opera sobre UNA entidad nombrada. Sin esta tool pasaban tres cosas, y
 * las tres se midieron: el turno 2 preguntaba en vez de proyectar; el turno 4 hacía la cuenta en el texto y el
 * muro vetaba el resultado CON RAZÓN —el propio `calculoCatalogo.js` documenta que no espeja `monto × (1+%)`
 * porque «los resultados llegan SIEMPRE sellados en la boleta de la tool», premisa que era falsa acá—; y el
 * turno 7, sin boleta, se quedaba con la quinta fuente como única puerta.
 *
 * LAS TRES CONDICIONES DEL SUPERVISOR, cada una en el código:
 *  1· LA PROYECCIÓN ES UN SUPUESTO, NO UN DATO. La base va a la boleta como cifra verificada; el resultado va
 *     ETIQUETADO como proyección, con la tasa y el horizonte que la produjeron. Nunca con el mismo tono que
 *     una cifra medida.
 *  2· ADMITE «TODO EL NEGOCIO» como alcance legítimo — sin `entity` proyecta sobre la venta oficial del
 *     período, que es la que el owner declaró como una sola verdad (`ventaOficialDelPeriodo`).
 *  3· NO REVIVE LA SIMULACIÓN AJENA: no fabrica escenarios ni toca el motor de transforms. Lee una base,
 *     aplica la tasa que le dieron, y devuelve las tres cifras.
 *
 * Y LA PRECISIÓN QUE AHORRA UNA VUELTA (supervisor, textual): «la tool no decide la tasa ni el horizonte — los
 * recibe». Sin `tasa` declarada NO inventa un default de crecimiento: devuelve la base y dice que falta el
 * supuesto. Proyectar con una tasa que nadie declaró sería causalidad sin respaldo, en versión futuro. */
export function proyectar({ tasa, horizonte, entity } = {}, { scenario = ESCENARIO_INICIAL } = {}) {
  const d = getTenantData() || {};
  const sinSoporte = (reason) => ({ facts: null, boleta: [], coverage: { supported: false, reason } });
  const fx = factorComercialDe(d);
  /* ⚠️ ACÁ ESCRIBÍ UN SEGUNDO FORMATEADOR, que es justo lo que la casa prohíbe. La primera versión copiaba el
   * `_M` de resumenComercial. Se cambió por LA TÉCNICA DE LA CASA (la misma que usa `datoProyectado._fmtBoleta`,
   * con su porqué escrito allá): darle el crudo a `parseFigures` en su forma mínima y leer el canon ES usar el
   * formateador del producto, sin copiarlo ni tocar `boleta.js`.
   *
   * ⚠️ Y UNA COSA QUE **NO** ARREGLA, para que nadie la busque acá: en el escenario real (`bonanza`) esta
   * herramienta publica la base como «$100.0M» y el dato proyectado publica «$99.9M» para el MISMO concepto
   * (dueños: negocio · total · cartera · global). No es un problema de formato — son las DOS ANCLAS que
   * `sentrix/temporal.js` ya declara: `getVentasKPI` (99.999) contra Σ`clientesVentas` (99.887), separadas por
   * el ~0,1% que el dataset arrastra, y «elegir cuál es LA venta oficial es decisión del owner». Esta tool usa
   * la que el owner declaró en 2026-07-15. La consecuencia práctica: con la boleta de esta herramienta la base
   * está autorizada; citada de memoria, sin boleta, el muro la veta — y hace bien. */
  const _m = (v) => {
    const raw = Math.round(v * fx);
    const p = parseFigures(`${simboloMoneda()}${raw}`);
    return p.length ? p[0].canon.slice(p[0].canon.indexOf(":") + 1) : fmtMonto(raw, { dataset: d });
  };

  // ── LA BASE ──────────────────────────────────────────────────────────────────────────────────────────────
  let base = null, deQuien = null;
  if (entity) {
    const res = _resolver(entity);
    if (!res) return sinSoporte(`no encuentro «${entity}» en ningún eje de este dato`);
    const estado = serieRealDe(res.nombre);
    if (!estado.real) return sinSoporte(`no puedo proyectar sobre ${res.nombre}: su cifra del período no reconcilia con el dato oficial`);
    const serie = (d.historialMargen || {})[res.nombre] || [];
    const ult = serie.length ? serie[serie.length - 1] : null;
    base = ult && Number.isFinite(Number(ult.venta)) ? Number(ult.venta) : null;
    deQuien = res.nombre;
    if (base == null) return sinSoporte(`no encuentro la venta del período de ${res.nombre} para usarla de base`);
  } else {
    const of = ventaOficialDelPeriodo(scenario);
    base = of && Number.isFinite(Number(of.actual)) ? Number(of.actual) : null;
    deQuien = "el negocio";
    if (base == null) return sinSoporte("este dato no trae una venta oficial del período: sin base no hay proyección");
  }

  // ── LA TASA · se RECIBE, jamás se inventa ────────────────────────────────────────────────────────────────
  /* `Number(null)` es 0 y `Number("")` también: sin este filtro, un cerebro que llamara con `tasa: null`
   * recibía una proyección de +0,0% — una cifra futura construida sobre un supuesto que nadie declaró, que es
   * justo lo que esta tool no puede hacer. Lo cazó el propio gate al probar tasas basura. */
  const t = (tasa === null || tasa === undefined || tasa === "") ? NaN : Number(tasa);
  const hz = horizonte == null ? null : String(horizonte).slice(0, 40);
  const baseFig = fig(`Venta del período · ${deQuien}`, _m(base),
    { unit: "money", raw: base, source: "dato", mandatory: true, context: "la venta oficial del período — es la base, no la proyección" });
  if (!Number.isFinite(t)) {
    return {
      facts: { lens: "proyeccion", base: _m(base), sobre: deQuien, falta: "el supuesto de crecimiento",
        nota: "sin una tasa declarada no hay proyección: la base está, el supuesto lo pone el usuario" },
      boleta: [baseFig],
      coverage: { supported: true, reason: null },
    };
  }

  const resultado = base * (1 + t / 100);
  const delta = resultado - base;
  const etq = `${t > 0 ? "+" : ""}${(+t).toFixed(1)}%${hz ? ` a ${hz}` : ""}`;
  return {
    facts: {
      lens: "proyeccion", sobre: deQuien, base: _m(base), tasa: `${(+t).toFixed(1)}%`, horizonte: hz,
      proyectado: _m(resultado), adicional: _m(delta),
      etiqueta: "PROYECCIÓN — supuesto del usuario aplicado sobre la venta oficial, no es una cifra medida",
    },
    boleta: [
      baseFig,
      fig(`Supuesto del usuario · crecimiento${hz ? ` a ${hz}` : ""}`, `${(+t).toFixed(1)}%`,
        { unit: "pct", raw: t, source: "user_supuesto", mandatory: false, context: "la tasa la puso el usuario — no sale del dato" }),
      fig(`Proyección · ${deQuien} ${etq}`, _m(resultado),
        { unit: "money", raw: resultado, source: "proyeccion", mandatory: false,
          context: "PROYECCIÓN sobre el supuesto del usuario — se nombra como tal, jamás como cifra medida" }),
      fig(`Proyección · adicional ${etq}`, _m(delta),
        { unit: "money", raw: delta, source: "proyeccion", mandatory: false,
          context: "la diferencia contra la base, bajo el mismo supuesto" }),
    ],
    coverage: { supported: true, reason: null },
  };
}

/* === cobranza · EL COBRO, DE LA MISMA MESA QUE LA PESTAÑA (owner 2026-09-01) =================================
 *
 * EL HUECO, medido por el supervisor: ninguna herramienta del catálogo leía `flujoComercial` — «quién me debe
 * y qué está vencido» era incontestable en la completa del owner CON 158 abonos cargados. La pestaña Flujo
 * Comercial ya contesta esa pregunta; el agente no podía ni mirarla.
 *
 * UNA SOLA VERDAD: lee `buildMesaFlujo`, el MISMO módulo que dibuja la pestaña, y no suma ni un peso propio.
 * Todas las cifras van VERBATIM del módulo (sus `*Fmt`), con el cliente como dueño en el label.
 *
 * ⚠️ EL VENCIDO SIN PLAZO DECLARADO ES «—», JAMÁS $0 — regla textual del owner («Mantén el vencido en raya
 * mientras no exista plazo declarado. No mostrar cero»), y su planilla ES este caso: no declara plazo. La fig
 * de «Saldo vencido» solo existe cuando el módulo la calculó; sin plazo, facts dice «—» y el porqué, y el
 * playbook de cobranza veta a quien lo escriba como cifra.
 *
 * ⚠️ «CRÉDITO VS CONTADO» NO RESTA: el dato declara la venta A CRÉDITO (la columna condición); el contado no
 * genera deuda y NO está declarado como cifra. Derivarlo (venta oficial − crédito) cruzaría dos fuentes con
 * escalas y períodos propios — la clase de cuenta que el muro existe para vetar. Se sirve el crédito con su
 * alcance, que ya dice que el contado no entra. */
export function cobranza(_args = {}, { scenario = ESCENARIO_INICIAL } = {}) {
  const sinSoporte = (reason) => ({ facts: null, boleta: [], coverage: { supported: false, reason } });
  let M = null;
  try { M = buildMesaFlujo(scenario); } catch { M = null; }
  if (!M || !Array.isArray(M.filas) || !M.filas.length) {
    return sinSoporte("este dato no trae el flujo comercial: sin la hoja Abonos no hay cobro que leer");
  }
  const d = getTenantData() || {};
  const fx = factorComercialDe(d);
  const boleta = [];
  const _fig = (label, fmt, rawK, extra = {}) => boleta.push(fig(label, fmt, {
    unit: "money", raw: Number.isFinite(rawK) ? rawK * fx : null, source: "actual",
    context: `flujo comercial al ${M.fechaCorteFmt || "cierre del período"} — la misma mesa que la pestaña`, ...extra }));

  /* los TOTALES · con el label del propio módulo (en la planilla dice «a crédito»; en el demo, «del período») */
  const esPlanilla = M.origen === "planilla";
  const ventaLabel = esPlanilla ? "Venta a crédito del período" : "Venta del período (flujo)";
  const T = M.total || null;
  const kpiDe = (key) => (M.kpis || []).find((k) => k.key === key) || null;
  const kV = kpiDe("venta"), kA = kpiDe("abonado"), kS = kpiDe("saldo"), kX = kpiDe("vencido");
  if (kV) _fig(ventaLabel, T ? T.ventaFmt : kV.valor, T ? T.ventaK : NaN, { mandatory: true });
  if (kA) _fig("Abonado · total", T ? T.abonadoFmt : kA.valor, T ? T.abonadoK : NaN, { mandatory: true });
  if (kS) _fig("Saldo pendiente · total", T ? T.saldoFmt : kS.valor, T ? T.saldoK : NaN, { mandatory: true });
  const vencidoCalculable = !!(kX && kX.valor && kX.valor !== "—");
  if (vencidoCalculable) _fig("Saldo vencido · total", kX.valor, T && T.vencidoK != null ? T.vencidoK : NaN);

  /* las FILAS · cap 8, en el orden del módulo (vencido primero, después saldo) — cada cifra con su dueño */
  const filas = M.filas.slice(0, 8);
  for (const f of filas) {
    _fig(`${f.nombre} · ${esPlanilla ? "Venta a crédito" : "Venta (flujo)"}`, f.ventaFmt, f.ventaK);
    _fig(`${f.nombre} · Abonado`, f.abonadoFmt, f.abonadoK);
    _fig(`${f.nombre} · Saldo pendiente`, f.saldoFmt, f.saldoK);
    if (f.vencidoFmt != null) _fig(`${f.nombre} · Saldo vencido`, f.vencidoFmt, f.vencidoK);
  }

  return {
    facts: {
      lens: "cobranza",
      fechaCorte: M.fechaCorteFmt || null,
      sinPlazo: !!M.sinPlazo,
      vencido: vencidoCalculable ? (kX && kX.valor) : "—",
      porQueSinVencido: M.porQueSinVencido || null,
      alcance: M.alcance || null,
      clientes: filas.map((f) => ({ nombre: f.nombre, venta: f.ventaFmt, abonado: f.abonadoFmt, saldo: f.saldoFmt,
        vencido: f.vencidoFmt == null ? "—" : f.vencidoFmt, diasVencido: f.diasVencidoFmt || "—", estado: f.estado, recuperado: f.recuperadoFmt })),
      masFilas: Math.max(0, M.filas.length - filas.length),
      nota: vencidoCalculable ? null
        : "el saldo vencido va en «—»: sin plazo de pago declarado no se puede calcular — dilo así, JAMÁS como $0",
    },
    boleta,
    coverage: { supported: true, reason: null },
  };
}

/* preferenciaNombre({ nombre }) → guarda cómo prefiere ser llamado el usuario (F3 · «llámame jc»).
 * SOLO el nombre: no existe campo de tono ni de registro — lo que no existe no se puede aflojar. */
export function preferenciaNombre({ nombre } = {}) {
  const sinSoporte = (reason) => ({ facts: null, boleta: [], coverage: { supported: false, reason } });
  const r = setNombreUsuario(nombre);
  if (!r.ok) return sinSoporte(`preferenciaNombre: ${r.reason}`);
  return {
    facts: { lens: "preferencia_nombre", nombre: r.nombre, nota: "el registro no cambia — solo el nombre" },
    boleta: [],   // una preferencia no es una cifra: nada que autorizar
    coverage: { supported: true, reason: null },
  };
}

/** la caja completa del agente: el registro de siempre + las nuevas. Se arma acá para que el bucle y los
 *  gates tengan UNA fuente del catálogo. */
export function cajaDelAgente(TOOLS_BASE) {
  return { ...TOOLS_BASE, serieEntidad, registrarSupuesto, preferenciaNombre, proyectar, cobranza };
}
