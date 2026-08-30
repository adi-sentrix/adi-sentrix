/* === adi/sentrix/mesaResultado.js · MESA DE CONTROL · CARA RESULTADO (owner 2026-07-15: "sí, parte por p&l") ===
 * La TERCERA CARA de la Mesa: el mismo sello (entender→explicar→actuar) contando EL RESULTADO — la cascada del
 * P&L comercial con las líneas de gasto QUE EL USUARIO DECLARÓ conversando con ADI (% sobre la venta · v1).
 *   - cascada (01 Qué está pasando): Ingreso → Costo → Margen bruto → Acciones comerciales (carga) →
 *     Contribución → [las líneas del usuario] → RESULTADO COMERCIAL ($ y % de la venta) · GRADUACIÓN A LA VISTA:
 *     probado (dato, trazo firme) vs "supuesto declarado · N%" (trazo punteado ámbar — el mismo lenguaje visual
 *     del panel de criterio). La cascada CIERRA EXACTO (buildPnlCascade · una verdad con las lecturas de ADI).
 *   - foco (02 Por qué): qué línea pesa más en el resultado, con su $.
 *   - accion (03 Qué hacer primero): probar el ajuste de la línea que más pesa (simulate de línea · supuesto).
 *   - simulaciones (¿Y si…?): cada línea es una pregunta → la proyección determinística de composePnl; + la meta
 *     de venta ("¿cuánto tengo que vender para ganar $X después de gastos?") anclada al dato.
 *   - cuadro: RESULTADO POR ENTIDAD — columnas clásicas (Venta · Contribución · Margen) INTACTAS + Resultado $ y %
 *     (prorrateo de tus % por la venta de la entidad) · cada fila pregunta (anti-BI).
 *   - PASE 2 (owner 2026-07-25): el cuadro gana SELECTOR DE EJE (patrón CuadroMando · solo los ejes con venta
 *     desglosada — pnlEjesDisponibles, una verdad con el redirect del chat) · cada fila pregunta «P&L de X» (la
 *     lectura scoped completa) · la CASCADA puede scopear a una fila (cascadaFoco — espejo del comparado del
 *     cuadro: mismas anclas de esa entidad, Σ ejes == negocio garantizado por buildPnlCascade).
 *   - empty: sin P&L declarado la cara lo dice honesto y OFRECE armarlo (prefill "Armemos mi P&L" — el flujo guiado).
 * Cada fila, foco, línea y chip lleva su PREGUNTA a ADI — todas por _promise_gate. Registro ejecutivo (_registro_gate).
 * Puro · client-side · CERO cálculo nuevo (formatea lo que buildPnlCascade afirma) · motor sellado intacto. */
import { buildPnlCascade, pnlSimAsk, pnlEjesDisponibles } from "../pnl.js";
import { simboloMoneda } from "../../config/moneda.js";
import { getTenantData } from "../../data/tenantStore.js";
import { factorComercialDe } from "../../config/contract/figureType.js";   // la escala la DECLARA el pack (2026-08-30)
import { ESCENARIO_INICIAL } from "../../config/scenarios.js";   // colapso del eje: la base real se declara UNA vez

const _r1 = (n) => Math.round(n * 10) / 10;
const _money = (v) => {
  const a = Math.abs(v), s = v < 0 ? "-" : "";
  if (a >= 1e6) return `${s}${simboloMoneda()}${(a / 1e6).toFixed(1)}M`;
  if (a >= 1e3) return `${s}${simboloMoneda()}${Math.round(a / 1e3)}K`;
  return `${s}${simboloMoneda()}${Math.round(a)}`;
};
const _moneyK = (v) => _money(v * factorComercialDe(getTenantData()));   // escala declarada del pack, nunca ×1000 fijo
const _fmtPct = (v) => String(_r1(v));

/* buildMesaResultado(scenario, cuadroEje?, cascadaFoco?) → { defined, empty? | cascada, resultado, foco, accion,
 * simulaciones, cuadro, alerta, alcance? } · cuadroEje = eje del cuadro por entidad (null → el primario) ·
 * cascadaFoco = { eje, nombre } → la cascada de arriba scopeada a esa entidad (pase 2 · espejo del comparado). */
export function buildMesaResultado(scenario, cuadroEje = null, cascadaFoco = null) {
  const c = buildPnlCascade(scenario || ESCENARIO_INICIAL);
  if (!c.defined) {
    return {
      defined: false,
      empty: {
        titulo: "Todavía no armamos tu P&L",
        texto: "Del dato ya tengo el ingreso, el costo y la carga comercial — hasta la contribución. Para llegar al resultado comercial faltan TUS líneas de gasto (administrativos, logística, marketing… las que manejes tú), con su % sobre la venta. Las defines conversando con ADI y quedan como supuestos declarados: cuando entre la contabilidad real, se reemplazan línea a línea.",
        cta: "¿Lo armamos ahora?",
        prefill: "Armemos mi P&L",
      },
    };
  }

  // ── 01 · LA CASCADA · cada paso con su graduación y su pregunta (todas gate-proven) ──
  const cascada = [
    { key: "ingreso", label: "Ingreso", usdFmt: _moneyK(c.ingresoK), kind: "probado",
      ask: "¿Cómo van las ventas contra el presupuesto?", def: "La venta facturada anual del dato — la misma base de margen y contribución de la Mesa." },
    { key: "costo", label: "Costo", usdFmt: `− ${_moneyK(c.costoK)}`, kind: "probado",
      ask: "¿Cómo se compone mi costo por cliente?", def: "El costo de lo vendido: ingreso menos margen bruto, del dato de margen (una sola verdad con la cascada)." },
    { key: "margen_bruto", label: "Margen bruto", usdFmt: _moneyK(c.margenBrutoK), kind: "probado", subtotal: true,
      ask: "¿Quiénes están bajo el margen mínimo?", def: "Lo que queda de la venta después del costo, antes de las acciones comerciales." },
    { key: "carga", label: "Acciones comerciales · carga", usdFmt: `− ${_moneyK(c.cargaK)}`, kind: "probado",
      ask: "¿Cuánta carga comercial puedo recuperar?", def: "Rebates y condiciones comerciales — el valor que se entrega en el canal antes de llegar a la contribución." },
    { key: "contribucion", label: "Contribución", usdFmt: _moneyK(c.contribK), kind: "probado", subtotal: true,
      ask: "¿Cuánta contribución no estoy capturando?", def: "Hasta acá todo es dato probado: la misma contribución que citan las respuestas y las cards de ADI." },
    // F2: la línea puede venir del PERFIL de la empresa (no declarada por el usuario) — el chip y la lectura
    // de ayuda lo dicen como es. Con líneas declaradas (demo siempre), byte-igual.
    // EDICIÓN DIRECTA (owner 2026-07-26 "con opción de cambiarlos"): cada supuesto expone `edit` (nombre + %
    // vigente) — la UI edita con editPnlLine/removePnlLine (las primitivas del chat: una verdad).
    ...c.gastos.map((g) => ({
      key: `gasto:${g.nombre}`, label: g.nombre, usdFmt: `− ${_moneyK(g.usdK)}`, kind: "supuesto",
      nota: `${g.origen === "perfil_empresa" ? "supuesto del perfil" : "supuesto declarado"} · ${_fmtPct(g.pct)}%`,
      edit: { nombre: g.nombre, pct: g.pct },
      ask: pnlSimAsk(g), def: g.origen === "perfil_empresa"
        ? `Línea de gasto del perfil de tu empresa: ${_fmtPct(g.pct)}% sobre la venta — un supuesto del rubro, no una declaración tuya. La pisas declarando la tuya («armemos mi P&L»), y cuando entre la contabilidad real se reemplaza por su dato.`
        : `Tu línea de gasto: ${_fmtPct(g.pct)}% sobre la venta, declarada por ti en la conversación. No es dato contable — cuando entre la contabilidad real, esta línea se reemplaza por su dato.`,
    })),
    { key: "resultado", label: "Resultado comercial", usdFmt: _moneyK(c.resultadoK), pctFmt: `${_fmtPct(c.resultadoPct)}%`,
      kind: "resultado", negativo: c.resultadoK < 0,
      ask: "¿Cómo queda mi resultado comercial?",
      def: "Contribución menos tus gastos declarados. Es un resultado sobre supuestos: firme hasta la contribución, declarado de ahí para abajo. La cascada cierra exacto: ingreso − costo − carga − gastos = resultado." },
  ];
  const lectura = `De ${_moneyK(c.ingresoK)} de ingreso, después de costo, carga comercial y tus ${c.lines.length === 1 ? "1 línea" : `${c.lines.length} líneas`} de gasto (${_fmtPct(c.sumPct)}% de la venta), quedan ${_moneyK(c.resultadoK)} de resultado comercial — ${_fmtPct(c.resultadoPct)}% de la venta.`;

  // ── ALCANCE DE LA CASCADA (pase 2 · cascadaFoco = una fila del cuadro): la MISMA cascada contando UNA
  // entidad — anclas de esa entidad (venta/contribución/carga · costo derivado), gastos prorrateados sobre SU
  // venta. El negocio queda a un click («× volver al negocio» en la UI). Cero cálculo nuevo: buildPnlCascade. ──
  let alcance = null, cascadaOut = cascada, lecturaOut = lectura;
  if (cascadaFoco && cascadaFoco.nombre) {
    const cF = buildPnlCascade(scenario || ESCENARIO_INICIAL, null, { dimension: cascadaFoco.eje });
    const eF = cF.porEntidad.find((x) => x.nombre === cascadaFoco.nombre);
    if (eF) {
      alcance = { nombre: eF.nombre, eje: cF.dimension, ask: `P&L de ${eF.nombre}`, volverLabel: "× volver al negocio" };
      const simSc = (g, t) => `¿Qué pasa si bajas ${g.nombre.toLowerCase()} a ${_fmtPct(t)}% en ${eF.nombre}?`;
      cascadaOut = [
        { key: "ingreso", label: "Ingreso", usdFmt: _moneyK(eF.ventaK), kind: "probado",
          ask: `P&L de ${eF.nombre}`, def: `La venta anual de ${eF.nombre} en el dato — la misma base que citan las respuestas de ADI.` },
        { key: "costo", label: "Costo", usdFmt: `− ${_moneyK(eF.costoK)}`, kind: "probado",
          ask: `P&L de ${eF.nombre}`, def: "El costo de lo vendido en este alcance: ingreso menos margen bruto (una sola verdad con la cascada)." },
        { key: "margen_bruto", label: "Margen bruto", usdFmt: _moneyK(eF.margenBrutoK), kind: "probado", subtotal: true,
          ask: `P&L de ${eF.nombre}`, def: "Lo que queda de su venta después del costo, antes de las acciones comerciales." },
        { key: "carga", label: "Acciones comerciales · carga", usdFmt: `− ${_moneyK(eF.cargaK)}`, kind: "probado",
          ask: "¿Cuánta carga comercial puedo recuperar?", def: "Rebates y condiciones comerciales de este alcance — valor entregado en el canal antes de la contribución." },
        { key: "contribucion", label: "Contribución", usdFmt: _moneyK(eF.contribK), kind: "probado", subtotal: true,
          ask: "¿Cuánta contribución no estoy capturando?", def: "Hasta acá todo es dato probado: la misma contribución que ADI cita para esta entidad." },
        ...cF.lines.map((l) => {
          const gK = (eF.ventaK * l.pct) / 100, t = _r1(Math.max(l.pct / 2, l.pct - 1));
          const _perfil = l.origen === "perfil_empresa";   // F2: origen honesto también en el alcance
          return { key: `gasto:${l.nombre}`, label: l.nombre, usdFmt: `− ${_moneyK(gK)}`, kind: "supuesto",
            nota: `${_perfil ? "supuesto del perfil" : "supuesto declarado"} · ${_fmtPct(l.pct)}%`, ask: simSc(l, t),
            edit: { nombre: l.nombre, pct: l.pct },   // el % editado es el criterio GLOBAL (la línea es % sobre la venta)
            def: `${_perfil ? "Línea del perfil de tu empresa" : "Tu línea de gasto"} prorrateada en este alcance: ${_fmtPct(l.pct)}% sobre la venta de ${eF.nombre}. ${_perfil ? "Supuesto del rubro" : "Supuesto declarado"}, no contabilidad de la entidad.` };
        }),
        { key: "resultado", label: `Resultado · ${eF.nombre}`, usdFmt: _moneyK(eF.resultadoK), pctFmt: `${_fmtPct(eF.resultadoPct)}%`,
          kind: "resultado", negativo: eF.resultadoK < 0, ask: `P&L de ${eF.nombre}`,
          def: "Contribución de la entidad menos tus gastos prorrateados sobre su venta. La cascada cierra exacto también acá — y la suma de todas las entidades del eje da el resultado del negocio." },
      ];
      lecturaOut = `P&L de ${eF.nombre}: de ${_moneyK(eF.ventaK)} de su venta quedan ${_moneyK(eF.resultadoK)} de resultado — ${_fmtPct(eF.resultadoPct)}% — después de costo, carga y tus gastos prorrateados (${_fmtPct(cF.sumPct)}%). El negocio completo sigue en el cuadro de abajo.`;
    }
  }

  // ── 02 · POR QUÉ · la línea que más pesa (del propio P&L declarado) ──
  const orden = c.gastos.slice().sort((a, b) => b.usdK - a.usdK);
  const top = orden[0];
  const foco = top ? {
    usdFmt: _moneyK(top.usdK),
    label: `${top.nombre} es la línea que más pesa (${_fmtPct(top.pct)}% de la venta)`,
    ask: "¿Qué línea pesa más en el resultado?",
  } : null;

  // ── 03 · QUÉ HACER PRIMERO · probar el ajuste de la línea top (supuesto → simulate de línea) ──
  const accion = top ? {
    titulo: `Revisar la línea ${top.nombre.toLowerCase()}`,
    detalle: `Es la línea de gasto que más resultado consume: ${_moneyK(top.usdK)} al año con tu ${_fmtPct(top.pct)}% declarado. Probar un ajuste muestra cuánto resultado devuelve — y si el % real es otro, actualizarlo deja la cascada honesta.`,
    usdFmt: _moneyK(top.usdK),
    ask: pnlSimAsk(top),
    askLabel: "Probar el ajuste",
  } : null;

  // ── ¿Y SI…? · cada línea pregunta su proyección + la meta de venta anclada al resultado ──
  const simulaciones = c.gastos.map((g) => ({
    key: `sim:${g.nombre}`, delta: _moneyK(g.usdK),
    texto: `Si ajustas ${g.nombre.toLowerCase()} (hoy ${_fmtPct(g.pct)}% · ${_moneyK(g.usdK)} al año), el resultado se mueve directo.`,
    ask: pnlSimAsk(g),
  }));
  if (c.resultadoK > 0) {
    const metaM = Math.max(1, Math.ceil((c.resultadoK * 1.1) / 1000));
    simulaciones.push({
      key: "meta", delta: `${simboloMoneda()}${metaM}M`,
      texto: `¿Y la meta al revés? Pregunta cuánta venta necesitas para un resultado objetivo.`,
      ask: `¿Cuánto tengo que vender para ganar ${simboloMoneda()}${metaM}M después de gastos?`,
    });
  }

  // ── CUADRO · RESULTADO POR ENTIDAD + SELECTOR DE EJE (pase 2 · solo ejes con venta desglosada — una verdad
  // con el redirect del chat) · cada fila pregunta «P&L de X» (la lectura scoped completa) · Total == negocio
  // en TODO eje (Σ del group-by cierra por construcción) ──
  const _cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
  const ejes = pnlEjesDisponibles().map((d) => ({ key: d.eje, label: _cap(d.label.sing) }));
  const ejeCuadro = (cuadroEje && ejes.some((x) => x.key === cuadroEje)) ? cuadroEje : ejes[0].key;
  const cE = ejeCuadro === c.dimension ? c : buildPnlCascade(scenario || ESCENARIO_INICIAL, null, { dimension: ejeCuadro });
  const rows = cE.porEntidad.map((e) => ({
    name: e.nombre, venta: e.ventaK, contribucion: e.contribK,
    margen: e.ventaK ? _r1((e.contribK / e.ventaK) * 100) : 0,
    gasto: e.gastoK, resultado: e.resultadoK, resultadoPct: _r1(e.resultadoPct),
    negativo: e.resultadoK < 0,
    ask: `P&L de ${e.nombre}`,
  })).sort((a, b) => b.resultado - a.resultado);
  const total = {
    name: "Total", venta: c.ingresoK, contribucion: c.contribK,
    margen: c.ingresoK ? _r1((c.contribK / c.ingresoK) * 100) : 0,
    gasto: c.totalGastosK, resultado: rows.reduce((a, r) => a + r.resultado, 0), resultadoPct: _r1(c.resultadoPct), _total: true,
  };

  // ── CORDURA HONESTA · resultado negativo se declara arriba de la cara (nunca silencioso) ──
  const alerta = c.resultadoK < 0 ? {
    linea: `Con tus supuestos declarados (${_fmtPct(c.sumPct)}% de gastos), el resultado queda negativo: ${_moneyK(c.resultadoK)}. Vale revisar las líneas antes que la venta.`,
    ask: "¿Qué línea pesa más en el resultado?",
  } : null;

  return {
    defined: true,
    lines: c.lines, sumPct: c.sumPct, sumPctFmt: `${_fmtPct(c.sumPct)}%`,
    resultado: { usdFmt: _moneyK(c.resultadoK), pctFmt: `${_fmtPct(c.resultadoPct)}%`, negativo: c.resultadoK < 0 },
    lectura: lecturaOut, cascada: cascadaOut, alcance, foco, accion, simulaciones, alerta,
    cuadro: { rows, total, n: rows.length, eje: ejeCuadro, ejes, colLabel: (ejes.find((x) => x.key === ejeCuadro) || ejes[0]).label },
  };
}

// ── DEEP-LINK del P&L (mejora 5 · 2026-07-26): decide DEL LADO PURO qué abre «Ampliar en Sentrix» para una
// evidencia — si la respuesta es del P&L (evidence.pnl), la Mesa arranca en la cara Resultado con SU alcance:
// el eje de la respuesta al selector del cuadro y la entidad en foco en la cascada. Cualquier otra evidencia
// devuelve null (sus paneles clásicos siguen intactos). buildMesaResultado valida solo: eje no disponible cae
// al primario y entidad desconocida deja la cascada global — el deep-link jamás abre una vista rota.
export function pnlMesaLink(e) {
  if (!e || !e.pnl) return null;
  const eje = e.dimension || null;
  return { cara: "resultado", eje, foco: e.entidad ? { eje, nombre: e.entidad } : null };
}

// ── EXPORT/COPIAR de la cara Resultado (mejora 8 · 2026-07-26 · gap premium declarado: "lo primero que pide un
// cliente pagando"): el MISMO buildMesaResultado (una verdad — se exporta lo que se está viendo: eje y foco
// activos) serializado para pegar en Excel/Sheets (TSV) o descargar (CSV). La cascada va formateada (narrativa,
// con su graduación declarada); el cuadro va en USD CRUDOS y % numéricos — sumable, no decorativo. Puro · gate-testable.
export function pnlExportData(scenario, cuadroEje = null, cascadaFoco = null) {
  const mr = buildMesaResultado(scenario, cuadroEje, cascadaFoco);
  if (!mr.defined) return null;
  const S = "\t";
  const L = [];
  L.push(`P&L comercial · ${mr.alcance ? `alcance: ${mr.alcance.nombre}` : "el negocio completo"} · gastos declarados ${mr.sumPctFmt} sobre la venta`);
  L.push("");
  L.push(["Concepto", "USD"].join(S));
  for (const r of mr.cascada) L.push([`${r.label}${r.kind === "supuesto" ? " (supuesto declarado)" : ""}`, r.usdFmt].join(S));
  L.push("");
  L.push([mr.cuadro.colLabel, "Venta (USD)", "Contribución (USD)", "Margen %", "Gastos (USD)", "Resultado (USD)", "Resultado %"].join(S));
  const _usd = (v) => Math.round(v * factorComercialDe(getTenantData()));
  for (const r of mr.cuadro.rows) L.push([r.name, _usd(r.venta), _usd(r.contribucion), r.margen, _usd(r.gasto), _usd(r.resultado), r.resultadoPct].join(S));
  const t = mr.cuadro.total;
  L.push(["Total", _usd(t.venta), _usd(t.contribucion), t.margen != null ? t.margen : "", _usd(t.gasto), _usd(t.resultado), t.resultadoPct != null ? t.resultadoPct : ""].join(S));
  L.push("");
  L.push("Hasta la contribución todo es dato del negocio; los gastos son supuestos declarados (% sobre la venta) — cuando entre la contabilidad real, se reemplazan línea a línea. Generado por ADI · Sentrix.");
  const tsv = L.join("\n");
  const csv = L.map((l) => l.split(S).map((c) => (/[",;\n]/.test(String(c)) ? `"${String(c).replace(/"/g, '""')}"` : String(c))).join(",")).join("\n");
  const slug = (s) => String(s).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const filename = `pnl-comercial-${slug(mr.alcance ? mr.alcance.nombre : mr.cuadro.eje)}.csv`;
  return { tsv, csv, filename, filas: mr.cuadro.rows.length };
}
