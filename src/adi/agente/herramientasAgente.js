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
import { buildRolesCartera, REGLAS_DE_ROL } from "../sentrix/rolesCartera.js";   // `rolesCartera` · el papel de cada cliente y la huella de cada mecanismo (el porqué, hecho evidencia)
import { lecturaDeCuadro } from "../sentrix/lecturaDeCuadro.js";   // `cuadroSentrix` · lo que ESE cuadro pinta, del mismo módulo que lo pinta (owner 2026-09-08)
import { findCandidates } from "../oracle/entityIndex.js";
import { fig, parseFigures } from "../boleta.js";   // parseFigures se usa como FORMATEADOR (ver `_m` en proyectar): la técnica de la casa, jamás una copia
import { parseCounts } from "../oracle/guardC.js";   // `cuadroSentrix` · el MISMO lector de conteos del muro: lo que el notario busca es lo que la frase del cuadro autoriza
import { fmtMonto, simboloMoneda } from "../../config/moneda.js";
import { nombreDePeriodo } from "../../ingesta/historico.js";
import { ESCENARIO_INICIAL } from "../../config/scenarios.js";   // colapso del eje: el agente lee el MISMO dato que la pantalla
import { setNombreUsuario } from "./preferenciaNombre.js";   // F3 · «llámame jc» — solo el nombre, jamás el tono

const _pct = (v) => `${(+v).toFixed(1)}%`;

/** resuelve el nombre contra los cuatro ejes del historial — LA LEY DEL ÚNICO BUSCADOR (owner 2026-09-03):
 *  solo el match EXACTO del índice canónico resuelve; el parecido se DEVUELVE COMO SUGERENCIA para que el
 *  cerebro lo ofrezca, jamás se asume. La versión anterior «toleraba tipeo» y con eso también el PREFIJO:
 *  `serieEntidad({entity:"Mercado Norte"})` respondía la serie de Mercado Libre — texto sobre un sujeto que el
 *  usuario no preguntó, la misma familia del defecto de producción que el owner encontró en la captura. */
function _resolver(nombre) {
  let sugerencia = null;
  for (const eje of ["cliente", "marca", "familia", "sku"]) {
    const c = findCandidates(eje, nombre, { max: 2 });
    if (!c.length) continue;
    if (c[0].motivo === "exacto") return { nombre: c[0].nombre, eje };
    if (!sugerencia || c[0].distancia < sugerencia.distancia) sugerencia = { nombre: c[0].nombre, eje, distancia: c[0].distancia };
  }
  return sugerencia ? { sugerencia: sugerencia.nombre } : null;
}

/* serieEntidad({ entity, metrica }) → la serie mensual real de esa entidad, o el motivo del bloqueo.
 * `metrica`: venta (default) · contribucion · unidades · acciones · margen. */
/* ⚠️ EL ESCENARIO ENTRA POR LOS DOS CANALES (tanda 3 post-poda, 2026-09-05): el runner del bucle mete el
 * scenario DEL TURNO dentro de args y llama con UN argumento — estas firmas lo esperaban en el segundo, así
 * que TODA llamada por playbook corría con ESCENARIO_INICIAL aunque el turno midiera otra carpeta (el
 * mecanismo del hallazgo «directo vs en turno»). El arg del turno manda; el ctx queda para callers directos. */
export function serieEntidad(args = {}, ctx = {}) {
  const { entity, metrica = "venta" } = args || {};
  const scenario = (args && args.scenario) || (ctx && ctx.scenario) || ESCENARIO_INICIAL;
  const d = getTenantData() || {};
  const sinSoporte = (reason) => ({ facts: null, boleta: [], coverage: { supported: false, reason } });
  if (!entity) return sinSoporte("serieEntidad necesita `entity`: de quién es la serie");
  const res = _resolver(entity);
  if (!res || res.sugerencia) return sinSoporte(`no encuentro «${entity}» en ningún eje de este dato${res && res.sugerencia ? ` — ¿quisiste decir ${res.sugerencia}? Ofrécelo, no lo asumas` : ""}`);

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
export function proyectar(args = {}, ctx = {}) {
  const { tasa, horizonte, entity } = args || {};
  const scenario = (args && args.scenario) || (ctx && ctx.scenario) || ESCENARIO_INICIAL;
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
    /* el signo va AFUERA del parseo (2026-09-02, al habilitar la dirección del supuesto): `$-2999970` adentro
     * de parseFigures devolvía el canon sin abreviar («$-2.999.970») y el adicional negativo salía con otro
     * formato que el resto de la boleta. Se formatea el ABSOLUTO con la técnica de la casa y el «-» ASCII se
     * antepone — para positivos, byte-idéntico a lo de siempre. */
    const abs = Math.abs(raw);
    const p = parseFigures(`${simboloMoneda()}${abs}`);
    const fmt = p.length ? p[0].canon.slice(p[0].canon.indexOf(":") + 1) : fmtMonto(abs, { dataset: d });
    return raw < 0 ? `-${fmt}` : fmt;
  };

  // ── LA BASE ──────────────────────────────────────────────────────────────────────────────────────────────
  let base = null, deQuien = null;
  if (entity) {
    const res = _resolver(entity);
    if (!res || res.sugerencia) return sinSoporte(`no encuentro «${entity}» en ningún eje de este dato${res && res.sugerencia ? ` — ¿quisiste decir ${res.sugerencia}? Ofrécelo, no lo asumas` : ""}`);
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
export function cobranza(_args = {}, ctx = {}) {
  const scenario = (_args && _args.scenario) || (ctx && ctx.scenario) || ESCENARIO_INICIAL;
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
/* ── `rolesCartera` · EL PORQUÉ, HECHO EVIDENCIA (owner 2026-09-04) ─────────────────────────────────────────
 * El defecto que el owner encontró en producción: ante «¿por qué perdemos margen?» ADI decía dónde y cuánto,
 * jamás por qué. No era falta de permiso —el muro siempre admitió hipotetizar marcado— era falta de EVIDENCIA
 * del porqué: ninguna herramienta traía con qué razonarlo. Esta lo trae: el PAPEL de cada cliente (fuga por
 * acciones · volumen a margen bajo · margen delgado · sano) y la HUELLA de cada mecanismo con su sello
 * (probado · indicado · abierto), incluida la que el dato NO sostiene y qué haría falta para cerrarla.
 * Cero cifras nuevas fuera de las cuentas que `rolesCartera.js` declara; la interpretación es del cerebro. */
export function rolesCartera(_args = {}, ctx = {}) {
  const scenario = (_args && _args.scenario) || (ctx && ctx.scenario) || ESCENARIO_INICIAL;
  let A = null;
  try { A = buildRolesCartera(scenario); } catch { A = null; }
  if (!A || !A.hay) return { facts: null, boleta: [], coverage: { supported: false, reason: "este dato no trae margen por cliente: sin eso no hay papeles que leer" } };
  const boleta = [];
  const _ctx = "el papel de cada cliente en el margen";
  boleta.push(fig("Benchmark de margen", `${A.vara}%`, { unit: "pct", raw: A.vara, mandatory: false, context: "la referencia declarada" }));
  if (A.target !== null) boleta.push(fig("Target de carga", `${A.target}%`, { unit: "pct", raw: A.target, mandatory: false, context: "la referencia declarada" }));
  /* los CONTEOS entran a la boleta: un número dicho en la respuesta sin fig detrás es un conteo-no-autorizado */
  for (const reg of REGLAS_DE_ROL) {
    const r = A.roles[reg.rol];
    if (r && r.n > 0) boleta.push(fig(reg.etiqueta, String(r.n), { unit: "count", raw: r.n, mandatory: false, context: `${_ctx} · regla: ${reg.regla}` }));
  }
  const C = A.concurrencia || {};
  if (C.grandesQueCaen) boleta.push(fig("Clientes del tramo alto bajo la vara", String(C.grandesQueCaen), { unit: "count", raw: C.grandesQueCaen, mandatory: false, context: `${_ctx} · los que mueven la venta y además caen` }));
  if (C.grandesQueCaenYExcedenCarga) boleta.push(fig("De esos, los que además exceden el target de carga", String(C.grandesQueCaenYExcedenCarga), { unit: "count", raw: C.grandesQueCaenYExcedenCarga, mandatory: false, context: `${_ctx} · volumen y fuga en la misma cuenta` }));
  /* cada cliente que cae, con SU papel y sus cifras — una por concepto, cada una con su dueño */
  /* ⚠️ NO SE REPUBLICA «X · Margen» (medido al estrenar la herramienta): `marginRead` ya lo publica en el mismo
   * turno y el playbook lee los márgenes de la boleta para SELECCIONAR quién está bajo la vara — dos figs con
   * el mismo rótulo duplicaban cada cliente, el auto-verificado del composer dejaba de reconciliar y la
   * notarial contaba 16 clientes donde hay 8. Cada herramienta publica LO SUYO; el margen ya tiene dueño. */
  for (const f of A.filas.filter((x) => x.brecha > 0).sort((a, b) => b.venta - a.venta).slice(0, 8)) {
    boleta.push(fig(`${f.entidad} · Brecha al benchmark`, `${f.brecha} pp`, { unit: "pct", raw: f.brecha, mandatory: false, source: "computed", formula: "benchmark declarado − margen del cliente", context: `${_ctx} · papel: ${(A.roles[f.rol] || {}).titulo || f.rol}` }));
    if (f.carga !== null) boleta.push(fig(`${f.entidad} · Carga comercial`, `${f.carga}%`, { unit: "pct", raw: f.carga, mandatory: false, context: `${_ctx} · el target declarado es ${A.target}%` }));
    if (f.markup !== null) boleta.push(fig(`${f.entidad} · Markup sobre costo`, `${f.markup}%`, { unit: "pct", raw: f.markup, mandatory: false, source: "computed", formula: "(precio de lista − costo medio) ÷ costo medio × 100", context: `${_ctx} · el precio contra lo que cuesta` }));
  }
  return {
    facts: {
      vara: A.vara, target: A.target,
      roles: Object.values(A.roles).map((r) => ({ rol: r.rol, titulo: r.titulo, regla: r.regla, lectura: r.lectura, n: r.n, pesoVenta: r.pesoVenta, entidades: r.items.slice(0, 5).map((f) => f.entidad) })),
      huellas: A.huellas.map((h) => ({ mecanismo: h.mecanismo, huella: h.huella, presente: h.presente, sello: h.sello, porque: h.porque, ...(h.falta ? { falta: h.falta } : {}), entidades: (h.items || []).map((f) => f.entidad) })),
      concurrencia: A.concurrencia,
      preguntaAlDueno: A.preguntaAlDueno,
      /* la frontera, dicha en los propios facts para que el cerebro la tenga a mano al razonar */
      contrato: "Los papeles y las huellas son PATRONES medidos, no causas probadas. Puedes razonar el porqué apoyándote en ellos —marcando la hipótesis como hipótesis y diciendo qué la confirmaría—; afirmar la causa como hecho sigue prohibido.",
    },
    boleta,
    coverage: { supported: true },
  };
}

/* === cuadroSentrix · EL CUADRO QUE EL USUARIO ESTÁ MIRANDO (owner 2026-09-08) ================================
 *
 * LA PALABRA DEL OWNER, textual: «El botón no manda solo texto. Manda el ancla completa del cuadro que el
 * usuario está viendo… ADI debe responder ese cuadro, no una pregunta libre ni un ranking genérico. Si el
 * cuadro muestra un 80/20, explica el 80/20. Si el cuadro muestra presupuesto, explica presupuesto.»
 *
 * QUÉ TRAE. La identidad declarada de esa pieza (cara · nombre · métrica · eje · período · filtros · universo ·
 * comparación · sello · su límite declarado) y SUS CIFRAS VISIBLES, verbatim del módulo que la pinta —
 * `lecturaDeCuadro` no calcula: selecciona. Es el mismo patrón de `cobranza`, que lee la mesa del Flujo en vez
 * de rehacer el cobro; acá se generaliza a cualquier cuadro declarado en el manifiesto, sin una rama por cuadro.
 *
 * LA UNIDAD Y EL CRUDO DE CADA CIFRA SE DERIVAN CON `parseFigures` — el MISMO parser con el que el muro busca
 * números en el texto. Así, lo que la herramienta autoriza y lo que el notario va a buscar hablan el mismo
 * idioma por construcción, y no por dos criterios que alguien tiene que mantener sincronizados.
 *
 * ⚠️ LAS FRASES DEL MÓDULO TAMBIÉN AUTORIZAN SUS CIFRAS, y esto merece decirse: la lectura al pie de un cuadro
 * («El 80% se alcanza en Mercado Libre», «4 cuentas venden menos que el año pasado») la escribió el MÓDULO y
 * está EN LA PANTALLA que el usuario tiene delante. Que ADI la repita no puede ser una invención — y sin
 * autorizarlas, el muro mataba la cita textual de lo que el usuario está leyendo. Se autoriza el token exacto,
 * no una reescritura.
 *
 * ⚠️ Y LO QUE NO SE PUEDE LEER SE DECLINA CON SU RAZÓN: `coverage.reason` es el string que va a pantalla y al
 * prompt. El motivo distingue el límite del DATO (la pieza no existe en esta carga) del límite del LECTOR (la
 * pieza no publica sus cifras formateadas) — nunca se le dice al usuario que su dato no trae algo que sí trae. */
export function cuadroSentrix(args = {}, ctx = {}) {
  const scenario = (args && args.scenario) || (ctx && ctx.scenario) || ESCENARIO_INICIAL;
  const componentId = String((args && (args.componentId || args.cuadro)) || "");
  const controles = (args && args.controles && typeof args.controles === "object") ? args.controles : null;
  const sinSoporte = (reason) => ({ facts: null, boleta: [], coverage: { supported: false, reason } });
  if (!componentId) return sinSoporte("no me dijeron qué cuadro explicar: sin la dirección de la pieza no puedo responder por ella.");

  const L = lecturaDeCuadro(componentId, { scenario, controles });
  if (!L.ok) return sinSoporte(L.falta);

  const I = L.identidad;
  const boleta = [];
  const _ctx = `del cuadro «${I.cuadro}» de la cara ${I.cara}${I.periodo ? ` · ${I.periodo}` : ""} — la misma cifra que está en pantalla`;
  /* la unidad y el crudo salen del parser del muro; un conteo entero no lleva símbolo y se declara `count`. */
  const _emitir = (label, valor, extra = {}) => {
    const tok = (() => { try { return parseFigures(valor)[0] || null; } catch { return null; } })();
    const n = Number(String(valor).replace(",", "."));
    boleta.push(fig(label, valor, {
      unit: tok ? tok.unit : "count",
      raw: tok ? tok.raw : (Number.isFinite(n) ? n : null),
      source: "actual", context: _ctx, ...extra,
    }));
  };

  /* 1 · LA CABECERA del cuadro — lo que el cuadro afirma de sí mismo (su total, su corte, su universo).
   * ⚠️ `entidad: null` ES DELIBERADO Y ESTÁ MEDIDO: sin declararlo, el tipo toma el primer tramo del label como
   * la ENTIDAD dueña de la cifra, y el muro exigía «nombrar» al cuadro como si fuera un cliente («81.4% es de
   * Quién sostiene el negocio · clientes (entidad) pero se narra como si fuera del negocio»). Un agregado del
   * cuadro no tiene dueña — el mismo criterio de «Capital frenado · total». */
  for (const c of L.cabecera) _emitir(`${I.cuadro} · ${c.label}`, c.valor, { mandatory: true, entidad: null });
  /* 2 · LAS FILAS — cada cifra con su dueño en el label, la ley de la boleta */
  for (const f of L.filas) for (const c of f.cifras) _emitir(`${f.nombre} · ${c.label}`, c.valor);
  /* 2b · CUÁNTAS FILAS LLEVA CADA SEÑAL. Es la cifra de la INTERPRETACIÓN («de 13 cuentas, 4 caen»), y sin
   * autorizarla el muro la mata con razón: un conteo que no corresponde a nada es un conteo inventado. Sale de
   * agrupar las banderas que el módulo ya puso en cada fila — se cuenta su veredicto, no se calcula nada. */
  {
    const porSenal = new Map();
    for (const f of L.filas) for (const s of (f.senales || [])) {
      if (!s.alerta) continue;
      porSenal.set(s.dice, (porSenal.get(s.dice) || 0) + 1);
    }
    for (const [dice, n] of porSenal) _emitir(`${I.cuadro} · cuántas ${dice}`, String(n), { entidad: null });
  }
  /* 3 · LAS FRASES DEL MÓDULO, con sus cifras autorizadas verbatim.
   * Se extraen con los DOS lectores del muro —`parseFigures` para montos/porcentajes/días y `parseCounts` para
   * los enteros contables («4 cuentas venden menos que el año pasado»)— y no por gusto: lo que el notario va a
   * buscar en el texto es exactamente lo que la frase del módulo autoriza, sin un criterio paralelo que alguien
   * tenga que mantener sincronizado. Medido: sin `parseCounts`, la lectura del propio cuadro se caía en
   * «conteo-no-autorizado» — el muro vetando una frase que está impresa en la pantalla. */
  for (const t of L.textos) {
    let toks = [];
    try { toks = [...(parseFigures(t.texto) || []), ...(parseCounts(t.texto) || [])]; } catch { toks = []; }
    for (const tk of toks) boleta.push(fig(`${I.cuadro} · lo que dice el cuadro`, tk.text, {
      unit: tk.unit, raw: tk.raw, source: "actual", entidad: null,
      context: `frase que el propio cuadro «${I.cuadro}» muestra en pantalla, citada textual`,
    }));
  }
  /* 3b · EL MES POR DENTRO (owner 2026-09-09) — los hechos mensuales que el builder publica anclados a la
   * formación del margen de la misma cara. Van TODOS los meses a la boleta: el turno no sabe de antemano cuál
   * va a nombrar el usuario, y una cifra del mes citada sin autorización moriría en el muro con el dato al
   * lado. `entidad: null` por la misma razón de siempre: un mes no es una entidad del negocio. */
  if (L.porDentro && Array.isArray(L.porDentro.meses)) {
    const _conCifra = (v) => typeof v === "string" && /\d/.test(v);
    for (const m of L.porDentro.meses) {
      if (_conCifra(m.contribucionFmt)) _emitir(`${I.cuadro} · ${m.mes} · contribución`, m.contribucionFmt, { entidad: null });
      if (_conCifra(m.margenFmt)) _emitir(`${I.cuadro} · ${m.mes} · margen`, m.margenFmt, { entidad: null });
      if (_conCifra(m.accionesFmt)) _emitir(`${I.cuadro} · ${m.mes} · acciones comerciales`, m.accionesFmt, { entidad: null });
      if (_conCifra(m.cargaFmt)) _emitir(`${I.cuadro} · ${m.mes} · carga`, m.cargaFmt, { entidad: null });
      if (typeof m.unidades === "number") _emitir(`${I.cuadro} · ${m.mes} · unidades`, String(m.unidades), { entidad: null });
    }
    if (_conCifra(L.porDentro.margenAnioFmt)) _emitir(`${I.cuadro} · margen del año`, L.porDentro.margenAnioFmt, { entidad: null });
    if (_conCifra(L.porDentro.cargaAnioFmt)) _emitir(`${I.cuadro} · carga del año`, L.porDentro.cargaAnioFmt, { entidad: null });
    /* ⚠️ Y EL PROMEDIO DE UNIDADES DEL AÑO — lo destapó la ley del porqué al exigir que el mecanismo viaje con
     * su referencia: la respuesta correcta dice «360 unidades contra un promedio de 475» y el 475 NO estaba
     * autorizado. Un defecto real, no del veto: si el cerebro escribía esa comparación, el muro se la mataba
     * con razón. La referencia de una comparación es tan cifra como el valor comparado. */
    if (Number.isFinite(L.porDentro.unidadesProm)) _emitir(`${I.cuadro} · unidades promedio del año`, String(L.porDentro.unidadesProm), { entidad: null });
  }

  return {
    facts: {
      lens: "cuadro",
      cuadro: {
        /* ⚠️ LA CLAVE ES `titulo`, NO `nombre`, Y NO ES ESTILO: el muro cosecha toda clave `nombre|name|entidad|
         * entity` de los facts como ENTIDAD del turno (`_entityNames`), y con `nombre` el cuadro entero pasaba a
         * ser «dueño» de sus cifras — el notario exigía nombrarlo como si fuera un cliente y el turno caía.
         * Medido: «81.4% es de Quién sostiene el negocio · clientes (entidad)…». Un cuadro no es una entidad. */
        cara: I.cara, movimiento: I.movimiento, titulo: I.cuadro, tipo: I.tipo,
        mide: I.metricaLabel, eje: I.eje, periodo: I.periodo,
        compara: I.comparacion, universo: I.universo,
        corte: L.corte ? L.corte.label : null,
        filtros: I.controles && Object.keys(I.controles).length ? I.controles : null,
        filas: L.n, campo: L.filasLlave,
      },
      /* lo que el cuadro dice de sí mismo, en sus propias palabras (las que están en pantalla) */
      loQueDiceElCuadro: L.textos.map((t) => t.texto),
      /* EL PATRÓN ANUAL (solo series con año anterior): ¿el mes extremo SE REPITE? Es un hecho de ORDEN sobre
       * los crudos del builder — sin cifras nuevas — y cambia la lectura del porqué: repetido apunta a
       * estacionalidad; nuevo, a algo de este año. La causa concreta sigue sin estar en el dato. */
      ...(L.patronAnual ? { patronAnual: L.patronAnual } : {}),
      /* EL MES POR DENTRO: los hechos de cada mes (unidades · contribución · margen · acciones) contra su año,
       * ya formateados y anclados por el builder. El porqué INTERNO del mes se lee de acá; el detonante de
       * fondo sigue sin estar en el dato y se marca como criterio. */
      ...(L.porDentro ? { mesPorDentro: L.porDentro } : {}),
      cifras: [
        ...L.cabecera.map((c) => ({ de: I.cuadro, concepto: c.label, valor: c.valor })),
        ...L.filas.map((f) => ({ de: f.nombre, valores: f.cifras.map((c) => ({ concepto: c.label, valor: c.valor })) })),
      ],
      /* EL LÍMITE DECLARADO de esta pieza: qué de lo que muestra no tiene respaldo, con su razón verificable */
      limite: L.limite && L.limite.estado !== "reconciled"
        ? { estado: L.limite.estado, campos: L.limite.campos, razon: L.limite.razon } : null,
      contrato: "Estas cifras son las del cuadro que el usuario tiene delante, verbatim del módulo que lo pinta. Explica ESE cuadro: qué mide, qué muestran sus filas y qué decisión sale de ahí. No lo reemplaces por el ranking del negocio ni por otro eje.",
    },
    boleta,
    coverage: { supported: true, reason: null },
  };
}

export function cajaDelAgente(TOOLS_BASE) {
  return { ...TOOLS_BASE, serieEntidad, registrarSupuesto, preferenciaNombre, proyectar, cobranza, rolesCartera, cuadroSentrix };
}
