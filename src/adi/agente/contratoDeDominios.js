/* === src/adi/agente/contratoDeDominios.js · EL CONTRATO DE DOMINIOS (owner 2026-09-14) ================================
 * LA LEY, textual: «La pregunta determina qué dominios participan; cada dominio aporta su realidad suficiente; ADI solo
 * relaciona aquello que el archivo demuestra que puede relacionarse.» — «No quiero que mencionar un dominio haga
 * desaparecer otro. Quiero composición, no exclusión.»
 *
 * LO MEDIDO ANTES (20 preguntas cruzadas × 3 datasets, offline): 2 de 20 recibían los dos dominios en la boleta, y esas
 * dos por accidente (el playbook de cobranza y el contrato comercial se disparaban juntos). Comercial×inventario: 0 de
 * 10 — `lectura-por-eje` mandaba todo a «capital frenado» (otra pregunta) y `_OTRO_UNIVERSO` retiraba la base comercial
 * en cuanto la pregunta nombraba inventario o cobranza («Mira ventas, margen e inventario juntos» → vacío). Ventas ×
 * unidades: 0 de 5 — el contrato comercial no traía una sola cifra de unidades.
 *
 * QUÉ HACE. Tres dominios —Comercial · Inventario · Cobranza— con lo que cada uno ya tenía: su detector léxico (los
 * que antes EXCLUÍAN pasan a hacer PARTICIPAR), sus pasos (herramientas que ya existen) y su doctrina. `dominiosDe(q)`
 * dice cuáles participan; `pasosDeDominios` une los pasos de todos sin repetir una lectura; `doctrinaDeDominios` manda
 * la de cada uno más UNA doctrina de cruce: qué claves los unen, qué declara el pack sobre su compatibilidad (por
 * `reconcilian`, que lee la declaración del archivo), los dos marcos temporales y qué relación NO existe. Unidades no
 * es un dominio: viaja dentro de Comercial.
 *
 * QUÉ NO HACE. No cambia el foco: «que ADI tenga disponibles dos dominios completos no significa que deba volcarlos
 * en la respuesta. Debe responder al foco del usuario y utilizar el otro dominio solo cuando cambie o explique la
 * lectura» (owner). No cruza por cliente ni por bodega: el archivo no lo demuestra. No recalcula: cada cifra sale del
 * emisor que ya la publica. Y no se dispara en turnos que no son de ningún dominio (definiciones, saludos, reformular).
 *
 * PURO · determinístico · sin red. */
import { esTemaComercial, pasosDelContratoComercial, doctrinaComercial } from "./contratoComercial.js";
import { esReformular } from "./reformular.js";
import { _sinNombresDeEntidad } from "./mapaDelDato.js";   // un cliente llamado «Depósito …» no es una bodega
import { getTenantData } from "../../data/tenantStore.js";
import { datasetCapability, transferenciaCapability } from "../sentrix/capability.js";
import { reconcilian } from "../../config/contract/figureType.js";
import { POLICY } from "../../config/businessPolicy.js";

export const DOMINIOS = ["comercial", "inventario", "cobranza"];

const _W = "[\\wáéíóúñ]";
/* el léxico de cada dominio. Los de inventario y cobranza son, palabra por palabra, los que `_OTRO_UNIVERSO` usaba
 * para EXCLUIR al contrato comercial (contratoComercial.js) más el tema de la asesoría de inventario (`_B_TEMA`) y las
 * formas del cobro del playbook (`_DEUDA`/`_CREDITO`): ahora suman en vez de restar. «sku» no es un dominio: es un eje. */
const _INVENTARIO = new RegExp(`(?<!${_W})(?:inventarios?|stock|existencias|mercader[ií]as?|rotaci[oó]n|rot(?:a|an|ando)|bodegas?|dep[oó]sitos?|almac[eé]n(?:es)?|reposici[oó]n|reponer|quiebres?|sobrestock|inmoviliz${_W}*|frenad${_W}*|dormid${_W}*|capital(?! de trabajo)|d[ií]as de inventario|cobertura)(?!${_W})`, "i");
const _COBRANZA = new RegExp(`(?<!${_W})(?:cobranzas?|cobros?|cobrad[oa]s?|cobrar|cobrando|vencid[oa]s?|mora|deudas?|deben|debe|adeud${_W}*|abonos?|abonad[oa]s?|pagos?|pagan|pagado|pagar|plazo de pago|por cobrar|saldos? pendientes?|cr[eé]dito|contado|flujo de caja|efectivo)(?!${_W})`, "i");
const _DEFINICION = /^\s*¿?\s*(?:qu[eé] (?:es|son|significa|quiere decir)|expl[ií]came (?:qu[eé] es|el concepto)|c[oó]mo se (?:calcula|define))\b/i;
const _SALUDO_O_META = /^\s*(?:hola|gracias|ok|dale|listo|buen[oa]s?\b)/i;
/* el eje que la pregunta nombra —fuera de cliente y SKU— para que Inventario aporte su corte por ese mismo eje y
 * Comercial, cuando compone con otro dominio, su lectura por ese eje en vez de las trece cuentas. */
const _EJES = [
  ["marca", new RegExp(`(?<!${_W})marcas?(?!${_W})`, "i")],
  ["familia", new RegExp(`(?<!${_W})(?:familias?|subfamilias?|categor[ií]as?|l[ií]neas? de producto)(?!${_W})`, "i")],
  ["canal", new RegExp(`(?<!${_W})canal(?:es)?(?!${_W})`, "i")],
  ["bodega", new RegExp(`(?<!${_W})(?:bodegas?|dep[oó]sitos?|almac[eé]n(?:es)?|sucursal(?:es)?)(?!${_W})`, "i")],
];

/** ejeNombrado(q) → "marca" | "familia" | "canal" | "bodega" | null — sin los nombres de entidad del tenant. */
export function ejeNombrado(pregunta) {
  const q = String(pregunta || "");
  const sin = (() => { try { return _sinNombresDeEntidad(q); } catch { return q; } })();
  const e = _EJES.find(([, re]) => re.test(sin));
  return e ? e[0] : null;
}

/** dominiosDe(q) → { dominios: [...], eje } · determinístico y léxico; ante la duda, ninguno. */
export function dominiosDe(pregunta) {
  const q = String(pregunta || "");
  const vacio = { dominios: [], eje: null };
  if (!q.trim() || _SALUDO_O_META.test(q) || _DEFINICION.test(q)) return vacio;
  if (esReformular(q)) return vacio;
  const sin = (() => { try { return _sinNombresDeEntidad(q); } catch { return q; } })();
  const dominios = [];
  if (esTemaComercial(q, { conOtrosUniversos: true })) dominios.push("comercial");
  if (_INVENTARIO.test(sin)) dominios.push("inventario");
  if (_COBRANZA.test(sin)) dominios.push("cobranza");
  return { dominios, eje: ejeNombrado(q) };
}

/* ── LOS PASOS DE CADA DOMINIO · herramientas que ya existen, con su para-qué ─────────────────────────────────────── */
const _INV_BASE = [
  /* `estado` es la foto ENTERA (total y los cuatro estados, suman exacto) y responde también cuando nada está frenado —
   * `frenado` solo declina en ese caso (medido en la plantilla de ejemplo: «no hay señal de inventario»). */
  { tool: "inventoryStatus", args: { focus: "estado" }, para: "la foto completa del inventario: el capital total y cómo se reparte en los cuatro estados (rotando en rango · riesgo de quiebre · sobrestock · inmovilizado), con la referencia declarada" },
  { tool: "inventoryStatus", args: { focus: "frenado" }, para: "el capital frenado: los SKU inmovilizados con su monto, días y rotación, y el corte por bodega y familia (declina si no hay ninguno: eso también es una lectura)" },
  { tool: "queryMetric", args: { metric: "capital", dimension: "sku" }, para: "el capital en inventario de cada SKU y el total de la foto" },
  { tool: "queryMetric", args: { metric: "doh", dimension: "sku" }, para: "los días de inventario de cada SKU (declarados por el dato, no recalculados)" },
  { tool: "queryMetric", args: { metric: "stock", dimension: "sku" }, para: "las unidades físicas en stock de cada SKU" },
  { tool: "queryMetric", args: { metric: "capital", dimension: "bodega" }, para: "el capital por bodega" },
];
const _INV_CRUCE = [
  { tool: "inventoryStatus", args: { focus: "top_sellers" }, para: "el cruce por SKU: los SKU que más venden con su stock — venta del período y stock de la foto, lado a lado" },
  { tool: "tensionRead", args: { dimension: "sku" }, para: "el cruce por SKU: quién deja más contribución y quién tiene más capital en inventario, y quién aparece en las dos listas" },
];
const _INV_POR_EJE = (eje) => ({ tool: "queryMetric", args: { metric: "capital", dimension: eje }, para: `el capital en inventario por ${eje}, el mismo eje que la pregunta nombra` });
/* la realidad COMERCIAL por otro eje, para cuando Comercial compone con otro dominio: la lectura de ESE eje, no las
 * trece cuentas (que en un ranking de marcas mezclaban márgenes de clientes — medido al cablear el contrato comercial). */
const _COM_POR_EJE = (eje) => [
  { tool: "queryMetric", args: { metric: "ventas", dimension: eje }, para: `la venta por ${eje}` },
  ...(eje === "canal" ? [] : [{ tool: "marginRead", args: { dimension: eje }, para: `el margen por ${eje} contra el benchmark declarado` }]),
  { tool: "contributionRead", args: { dimension: eje }, para: `la contribución por ${eje}` },
  ...(eje === "canal" || eje === "bodega" ? [] : [{ tool: "queryMetric", args: { metric: "unidades", dimension: eje }, para: `las unidades vendidas por ${eje}` }]),
];
const _COM_UNIDADES = [
  { tool: "queryMetric", args: { metric: "unidades", dimension: "cliente" }, para: "unidades vendidas por cliente y el total del período: el volumen, para leer venta contra cantidad" },
];
const _COM_VOL_PRECIO = { tool: "salesRead", args: { focus: "descomposicion_vol_precio" }, para: "cuánto del crecimiento es más unidades y cuánto mejor precio realizado (venta ÷ unidades) — solo si hay año anterior con unidades" };
const _PASOS_COBRANZA = [
  { tool: "cobranza", args: {}, para: "la venta a crédito, lo abonado y el saldo pendiente —total y por cliente— de la misma mesa que la pestaña Flujo Comercial, con la fecha de corte y si el vencido se puede calcular" },
];

const _hayInventario = () => { try { return ((getTenantData() || {}).skuInventario || []).length > 0; } catch { return false; } };
const _hayAnteriorConUnidades = () => { try { return ((getTenantData() || {}).clientesVentas || []).some((c) => typeof c.anterior === "number" && typeof c.unidadesAnt === "number"); } catch { return false; } };

/** pasosDeDominios({ dominios, eje }) → los pasos de todos los dominios que participan, en orden fijo. */
export function pasosDeDominios({ dominios = [], eje = null } = {}) {
  const out = [];
  const multi = dominios.length >= 2;
  if (dominios.includes("comercial")) {
    if (eje === "bodega") { /* no hay venta por bodega en el archivo: Comercial no tiene qué aportar por ese eje — la doctrina de cruce lo dice */ }
    else if (eje) { if (multi) out.push(..._COM_POR_EJE(eje)); }   // solo Comercial por otro eje: su lectura por eje es la realidad (lectura-por-eje), como hasta hoy
    else {
      out.push(...pasosDelContratoComercial(), ..._COM_UNIDADES);
      if (_hayAnteriorConUnidades()) out.push(_COM_VOL_PRECIO);
    }
  }
  if (dominios.includes("inventario") && _hayInventario()) {
    out.push(..._INV_BASE);
    if (eje === "marca" || eje === "familia") out.push(_INV_POR_EJE(eje));
    if (dominios.includes("comercial")) out.push(..._INV_CRUCE);
  }
  if (dominios.includes("cobranza")) out.push(..._PASOS_COBRANZA);
  return out;
}

/* ── LA UNIÓN SIN REPETIR ────────────────────────────────────────────────────────────────────────────────────────
 * Los pasos del PROCEDIMIENTO van primero y mandan. Las lecturas con FOCO (salesRead, marginRead, contributionRead,
 * diagnose, rolesCartera, cobranza) se unen por herramienta: dos `salesRead` con distinto foco mezclaban referencias
 * (medido 2026-09-13). Las que sirven CORTES distintos (queryMetric, inventoryStatus, tensionRead) se unen por
 * herramienta + argumentos: capital por SKU y capital por bodega son dos lecturas, no una repetida. */
const _POR_HERRAMIENTA = new Set(["salesRead", "marginRead", "contributionRead", "diagnose", "rolesCartera", "cobranza", "executiveSummary", "trend"]);
const _clave = (p) => (_POR_HERRAMIENTA.has(p.tool) ? p.tool : `${p.tool} ${JSON.stringify(p.args || {})}`);
export function unirPasosDeDominios(delProcedimiento, delContrato) {
  const out = [...(delProcedimiento || [])];
  const vistas = new Set(out.map(_clave));
  for (const p of delContrato || []) { const k = _clave(p); if (vistas.has(k)) continue; vistas.add(k); out.push(p); }
  return out;
}

/* ── LAS DOCTRINAS ─────────────────────────────────────────────────────────────────────────────────────────────── */
const _marcos = () => { try { const r = reconcilian("venta_comercial", "inventario"); return r.marcos || {}; } catch { return {}; } };
const _fotoDe = () => {
  const m = _marcos();
  if (m.inventario) return m.inventario;
  try { const d = getTenantData(); const f = d && d.hechos && d.hechos.inventarioDe; return f ? `foto de inventario al ${String(f).slice(0, 10)}` : "foto de inventario a hoy"; } catch { return "foto de inventario a hoy"; }
};
const _varas = () => {   // las referencias de inventario del negocio (días máximos · rotación mínima) y de quién son
  const perfil = (() => { try { return (getTenantData() || {}).perfil || {}; } catch { return {}; } })();
  const de = (k) => (typeof perfil[k] === "number" ? "declarada por el negocio" : "referencia general de ADI");
  return `días máximos ${POLICY.dohMax} (${de("dohMax")}) · rotación mínima ${POLICY.rotacionMin}x (${de("rotacionMin")})`;
};

/** la doctrina de inventario: el marco de la foto, las referencias declaradas, los límites del dato. Byte-estable por tenant. */
export function doctrinaInventario(figs) {
  const hayCapital = (Array.isArray(figs) ? figs : []).some((f) => /Capital|Stock|Valor de inventario/i.test(String((f && f.label) || "")));
  if (!hayCapital) return "";
  let transfer = "";
  try { const t = transferenciaCapability(); transfer = t.evaluable ? "" : ` ${t.motivo}`; } catch { transfer = ""; }
  return [
    `[CONTRATO DE INVENTARIO — no es el usuario] Este turno también es de inventario: la foto completa está arriba (capital total y los cuatro estados · SKU con capital, días y rotación · unidades en stock · bodega · familia/marca).`,
    `Marco: ${_fotoDe()} — es una foto, nunca un acumulado ni una evolución: no hay serie de inventario en este dato. Referencias declaradas de inventario: ${_varas()}; nómbralas así, jamás como «meta».`,
    `Límites del dato, dichos si hacen falta: no hay entradas ni recepciones, ni órdenes de compra, ni lead time de proveedor; por qué un SKU está frenado no está en este dato (localiza, no expliques).${transfer}`,
  ].join("\n");
}

/** la doctrina de cobranza cuando el cobro participa sin que su playbook componga: las reglas del owner, cortas. */
export function doctrinaCobranza(figs) {
  const hay = (Array.isArray(figs) ? figs : []).some((f) => /Saldo pendiente|Venta a crédito|Venta del período \(flujo\)|Abonado/i.test(String((f && f.label) || "")));
  if (!hay) return "";
  const vencido = (Array.isArray(figs) ? figs : []).some((f) => /^Saldo vencido · total$/i.test(String((f && f.label) || "")));
  return [
    `[CONTRATO DE COBRANZA — no es el usuario] Este turno también es de cobranza: el saldo pendiente total y por cliente, lo abonado y la venta a crédito están arriba, con su fecha de corte.`,
    vencido
      ? "El vencido está calculado por la mesa: cítalo verbatim."
      : "El vencido NO se puede calcular (sin plazo de pago declarado): di que no se puede saber y por qué — jamás $0 ni otra cifra.",
    "El contado no es una cifra del dato: no lo derives restando. Por qué un cliente debe lo que debe no está en el flujo: localiza cuánto y de quién.",
  ].join("\n");
}

/** la doctrina de CRUCE: claves, compatibilidad declarada por el pack, marcos, y lo que no se relaciona. */
export function doctrinaDeCruce({ dominios = [], eje = null } = {}) {
  if (dominios.length < 2) return "";
  const L = [`[CRUCE DE DOMINIOS — no es el usuario] Participan ${dominios.join(" + ")}. La pregunta define el foco: responde ese foco y usa el otro dominio SOLO cuando cambie o explique la lectura — no lo vuelques.`];
  if (dominios.includes("comercial") && dominios.includes("inventario")) {
    const r = (() => { try { return reconcilian("venta_comercial", "inventario"); } catch { return { estado: "divergent", razon: "" }; } })();
    const m = r.marcos || {};
    L.push(`Clave de unión: el SKU (y marca/familia como atributo del SKU). Por cliente NO existe relación con el inventario en este archivo y por bodega no hay venta: no construyas ninguna de las dos.`);
    if (r.estado === "comparable") {
      L.push(`Compatibilidad declarada por el archivo: venta e inventario son COMPARABLES por SKU — ${r.razon}. Al relacionar una cifra de venta con una de stock nombra los dos marcos («${m.venta_comercial || "del período cerrado"}» / «${m.inventario || "foto de inventario a hoy"}»); nunca las sumes ni las consolides. Los días de inventario se citan del dato, no se recalculan.`);
    } else {
      L.push(`Compatibilidad declarada por el dato: venta e inventario NO reconcilian — ${r.razon || "escala y unidades distintas"}. Puedes enumerarlas lado a lado (cada una con su marco: período cerrado / foto de inventario) pero no las relaciones («frente a», «por cada», «equivale», «fracción») ni las sumes.`);
    }
  }
  if (dominios.includes("comercial") && dominios.includes("cobranza")) {
    L.push(`Clave de unión: el cliente (su nombre). La venta es del período y el saldo es al corte declarado por la mesa: se leen juntas por cuenta, no se restan entre sí ni se derivan una de otra.`);
  }
  if (dominios.includes("inventario") && dominios.includes("cobranza")) {
    L.push(`Inventario y cobranza no comparten clave en este archivo (el stock es por SKU y bodega; el cobro por cliente): no las relaciones.`);
  }
  if (eje === "bodega" && dominios.includes("comercial")) L.push(`La venta no se registra por bodega en este archivo: por bodega solo hay capital, días y rotación. Dilo, y ofrece la venta por el eje que sí existe.`);
  return L.join("\n");
}

/** doctrinaDeDominios({ dominios, eje }, figs, { playbookActivo }) → los bloques a empujar, en orden fijo. */
export function doctrinaDeDominios({ dominios = [], eje = null } = {}, figs = [], { playbookActivo = null } = {}) {
  const out = [];
  const multi = dominios.length >= 2;
  if (dominios.includes("comercial") && (!eje || multi) && (!playbookActivo || playbookActivo !== "margen-en-riesgo")) {
    if (!eje) { const dc = doctrinaComercial(figs); if (dc) out.push(dc); }
  }
  if (dominios.includes("inventario")) { const di = doctrinaInventario(figs); if (di) out.push(di); }
  if (dominios.includes("cobranza") && playbookActivo !== "cobranza") { const dco = doctrinaCobranza(figs); if (dco) out.push(dco); }
  if (multi) out.push(doctrinaDeCruce({ dominios, eje }));
  return out;
}

/** ¿el cruce cliente×SKU está observado en este archivo? (hoy: nunca — la afinidad estimada está apagada) */
export function cruceAtomico() { try { return !!(datasetCapability().crosses && datasetCapability().crosses.atomic); } catch { return false; } }
