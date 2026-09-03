/* === src/adi/agente/playbooks/asesoria.js · LOS 4 PLAYBOOKS DE ASESORÍA (owner 2026-09-01) ==================
 *
 * EL ENCARGO, textual: «cliente perdiendo contribución · inventario inmovilizado · caída de ventas ·
 * oportunidad de precio», con el molde de margen-en-riesgo y tres condiciones que acá son LEY:
 *   01 QUÉ · 02 DÓNDE · 03 QUÉ HACER PRIMERO — el 02 LOCALIZA, jamás explica causas que el dato no sabe
 *   (regla 2 del contrato); el 03 OFRECE, jamás ordena.
 *   `cuandoAplica` léxico y CONSERVADOR: ante la duda, false. Cuatro playbooks nuevos son cuatro oportunidades
 *   de secuestrar turnos ajenos; cada detector tiene su carnada de no-secuestro en el gate.
 *   MATERIALIDAD: el piso relativo del negocio (0,05% de la venta real — `pisoFocosUSD`, la MISMA función del
 *   diagnóstico, jamás un segundo cálculo del umbral) manda sobre qué entra al entregable; lo que queda afuera
 *   se declara con el umbral (`declaracionUmbralFocos`), porque un silencio sin su umbral es inauditable.
 *
 * DÓNDE VAN EN EL REGISTRO Y POR QUÉ: después de margen-en-riesgo (una pregunta de margen es de margen aunque
 * diga «perdiendo») y ANTES de lectura-por-eje — «cómo libero el capital frenado» nombra el eje frenado y sin
 * esta precedencia la lista simple taparía la asesoría. La disjunción se sostiene por léxico: los de asesoría
 * exigen una señal que las preguntas de lectura no traen (perdiendo/caída · qué hago/liberar · oportunidad),
 * medida contra las preguntas que los gates existentes ejercitan — ninguna cambió de dueño.
 *
 * TRAMPAS DE DETECTOR QUE ACÁ SE ESQUIVAN A PROPÓSITO (aprendidas midiendo, no opinando):
 *   · «bajo» como palabra de caída NO: «por punto de venta, ¿quién queda bajo el plan?» contiene `venta` y
 *     `bajo` — la caída se detecta con palabras inequívocas (cayeron/desplom/bajaron) o el bigrama
 *     «venta(s) baj…», jamás con la preposición.
 *   · sin `\b` delante de vocal acentuada (el `\b` imposible en espejo, §5g del contrato).
 *   · entidad×período se retira ante `detectSerieIntent` — el MISMO detector del puente, nunca una copia.
 *
 * PURO · determinístico · sin red. Cifras VERBATIM de la boleta: se selecciona y ordena, jamás se calcula.
 * La única aritmética permitida es COMPARAR dos números ya publicados (raw contra raw, raw contra el piso):
 * eso decide qué se cita, nunca produce una cifra nueva. */

import { detectSerieIntent } from "../../oracle/serieIntent.js";
import { nombraEntidad } from "./indiceEntidades.js";   // el guardia anti-secuestro, compartido con la foto
import { pisoFocosUSD, declaracionUmbralFocos } from "../../specRetrieval.js";
import { variante } from "../variacion.js";   // los cierres varían por semilla («matar la repetición», 2026-09-03)

const _num = (f) => (f && Number.isFinite(f.raw) ? f.raw : NaN);
const _val = (f) => String((f && (f.text || f.value)) || "");
/* el motor solo pone `raw` en las filas DESTACADAS (la lección medida de margen-en-riesgo): para seleccionar y
 * ordenar hace falta el número de todas, así que cuando falta el raw se lee la cifra que el motor YA publicó —
 * la cifra citada sigue siendo la suya, verbatim; leerla para compararla es lo mismo que ordenarla. */
const _pct = (f) => {
  const r = _num(f);
  if (Number.isFinite(r)) return r;
  const m = /^-?[\d.,]+\s*%$/.exec(_val(f).trim());
  return m ? parseFloat(m[0].replace("%", "").replace(",", ".")) : NaN;
};
const _cnt = (f) => {
  const r = _num(f);
  if (Number.isFinite(r)) return r;
  const m = /^\d+$/.exec(_val(f).trim());
  return m ? Number(m[0]) : NaN;
};
const _lab = (f) => String((f && f.label) || "");
const _find = (figs, re) => (Array.isArray(figs) ? figs : []).find((f) => re.test(_lab(f))) || null;
const _all = (figs, re) => (Array.isArray(figs) ? figs : []).filter((f) => re.test(_lab(f)));
const _entidadDe = (label) => {
  const p = String(label || "").split("·").map((s) => s.trim());
  return p.length >= 2 ? p[0] : null;
};
const _FIN = "(?![a-záéíóúüñ])";
/* lo que ningún playbook de asesoría toca: simulaciones y proyecciones (playbook propio) y el cobro (ídem). */
const _SIMULA = new RegExp(`\\bsimul|\\bproyect|\\bqu[eé] pasa si${_FIN}|\\bpon[eé]le que${_FIN}|\\bsupon(?:e|é|gamos)${_FIN}`, "i");
const _DEUDA = /\bdeb[eo]n?\b|\bvencid|\bmora\b|\bcobr|\bpagad|\bpor cobrar\b|\bsaldo pendiente\b/i;

/* el umbral, para el composer: qué pasa el piso y cómo se declara lo que no. El piso llega en las unidades de
 * los `raw` de la boleta (la misma escala), así que comparar |raw| ≥ piso es selección, no cálculo. */
const _materiales = (items, piso) => (piso > 0 ? items.filter((x) => Math.abs(x.usd) >= piso) : items);
const _fraseUmbral = () => { try { return declaracionUmbralFocos(); } catch { return ""; } };
const _piso = () => { try { return pisoFocosUSD() || 0; } catch { return 0; } };

/* ═══ A · CLIENTE PERDIENDO CONTRIBUCIÓN ══════════════════════════════════════════════════════════════════════
 * La señal temporal que el dato SÍ declara por cliente es el YoY de venta (salesRead vs_anterior); la serie
 * mensual de contribución existe pero solo POR NOMBRE (serieEntidad) — por eso el 03 la OFRECE para el que más
 * cae, en vez de fingir un ranking de contribución cayendo que ninguna herramienta publica. */
/* `cay[oó]` va con _FIN y no con `\b` atrás: `\b` tras la «ó» exige una letra ASCII después y «cayó » jamás
 * matchearía — el `\b` imposible del §5g, esta vez en la cola de la palabra. */
const _A_CAE = new RegExp(`\\bperdiendo${_FIN}|\\bpierd|\\bcayendo${_FIN}|\\bcaen${_FIN}|\\bcay[oó]${_FIN}|\\bcayeron${_FIN}|\\bse me (?:van|caen)${_FIN}|\\bse est[aá]n yendo${_FIN}`, "i");
export const clientePerdiendoContribucion = {
  nombre: "cliente-perdiendo-contribucion",
  cuandoAplica(pregunta) {
    const q = String(pregunta || "");
    if (_SIMULA.test(q) || _DEUDA.test(q)) return false;
    if (detectSerieIntent(q)) return false;   // «cuánto cayó Falabella el último mes» es del puente
    return (_A_CAE.test(q) && /\bcliente[s]?\b/i.test(q)) || (_A_CAE.test(q) && /contribuci[oó]n/i.test(q));
  },
  pasos: [
    { tool: "salesRead", args: {}, para: "la comparación por cliente contra el año anterior: quién cae y por cuánto (YoY), con la lectura del período" },
    { tool: "contributionRead", args: {}, para: "la contribución por cliente y el total: cuánto está en juego donde la venta se cae" },
  ],
  obligatorias: [/· YoY$/i, /^Contribuci[oó]n total$/i],
  entregable: "qué clientes están cayendo contra el año anterior (cada uno con su cifra YoY), sobre cuánta contribución total, y a quién abrir primero — ofrecido, jamás ordenado. Localiza dónde se cae; el porqué no está en este dato.",
  componer({ figs, semilla } = {}) {
    const total = _find(figs, /^Contribuci[oó]n total$/i);
    const caen = _all(figs, /· YoY$/i)
      .map((f) => ({ entidad: _entidadDe(_lab(f)), usd: _num(f), fmt: _val(f) }))
      .filter((x) => x.entidad && Number.isFinite(x.usd) && x.usd < 0)
      .sort((a, b) => a.usd - b.usd);
    if (!total) return null;
    const piso = _piso();
    const materiales = _materiales(caen, piso);
    const contrib = new Map(_all(figs, /· Contribuci[oó]n$/i).map((f) => [_entidadDe(_lab(f)), _val(f)]));
    const partes = [];
    // LA VOZ (2026-09-03): el asesor cuenta, no rotula — mismas cifras, mismos dueños. Y una precisión que
    // la voz obligó a hacer: `total` es la contribución DEL NEGOCIO (contexto para dimensionar), no «lo en
    // juego» — la frase vieja lo insinuaba de más.
    if (!materiales.length) {
      partes.push(`Ningún cliente cae de forma material contra el año anterior${caen.length ? ` (${caen.length} caen, todos ${_fraseUmbral() || "bajo el umbral de materialidad del negocio"})` : ""}.`);
      partes.push(`Para dimensionar: la contribución total del negocio es ${_val(total)}.`);
      return partes.join("\n");
    }
    const top = materiales.slice(0, 4);
    partes.push(`Se te están cayendo ${materiales.length} clientes contra el año anterior${caen.length > materiales.length ? ` (otros ${caen.length - materiales.length} caen ${_fraseUmbral() || "bajo el umbral de materialidad"})` : ""}. Para dimensionar: la contribución total del negocio es ${_val(total)}.`);
    partes.push(`\nLos ${top.length} que más caen:`);
    for (const c of top) partes.push(`- ${c.entidad} · ${c.fmt} contra el año anterior${contrib.has(c.entidad) ? ` · contribución actual ${contrib.get(c.entidad)}` : ""}`);
    partes.push(`\nDónde se cae queda localizado; por qué se cae no está en este dato.`);
    partes.push(variante(semilla, [
      `Si quieres, abrimos la serie mensual de ${top[0].entidad} —el que más cae— para ver desde cuándo. Dime y la traigo.`,
      `Vale la pena ver desde cuándo: ¿abrimos la serie mensual de ${top[0].entidad}, el que más cae?`,
      `Para ver desde cuándo se cae, te abro la serie mensual de ${top[0].entidad} —el que más cae— si quieres.`,
    ]));
    return partes.join("\n");
  },
  listaNotarial(texto, { figs } = {}) {
    const t = String(texto || "");
    if (!t.trim()) return [];
    const v = [];
    /* causa inventada: el porqué de una caída no está en este dato — una oración causal sin mecanismo del dato
     * ni cifra es atribución pura (la regla de margen-en-riesgo, con los mecanismos de ESTE dominio). */
    const MEC = /a[ñn]o anterior|yoy|contribuci[oó]n|ca[ií]da|serie mensual/i;
    const CIFRA = /\$\s?[\d.,]+\s?[KMB]?|[\d.,]+\s*%/;
    for (const o of t.split(/[.!?\n]+/)) {
      if (!new RegExp(`\\bporque\\b|\\bse debe a\\b|\\bla causa (?:es|est[aá])${_FIN}|\\bes consecuencia de\\b`, "i").test(o)) continue;
      if (!MEC.test(o) && !CIFRA.test(o)) {
        v.push({ regla: "causa-sin-respaldo", multa: "afirmas por qué se cae un cliente y este dato no lo declara: localiza (quién y cuánto) o di que la causa no está medida." });
        break;
      }
    }
    /* prioridad muda: proponer abrir por alguien que no es el que más cae, sin declarar el criterio. */
    const caen = _all(figs, /· YoY$/i).map((f) => ({ entidad: _entidadDe(_lab(f)), usd: _num(f) }))
      .filter((x) => x.entidad && Number.isFinite(x.usd) && x.usd < 0).sort((a, b) => a.usd - b.usd);
    const m = /(?:empiez[oa]|abrimos|abro|arranco|primero)\s+(?:por|con)?\s*([A-ZÁÉÍÓÚÑ][\wÁÉÍÓÚÑáéíóúñ .'-]{2,30})/i.exec(t);
    if (m && caen.length > 1) {
      const prop = caen.find((c) => new RegExp(`\\b${c.entidad.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(m[1]));
      const declara = /el que m[aá]s cae|mayor ca[ií]da|criterio|porque tiene|por su/i.test(t);
      if (prop && prop.entidad !== caen[0].entidad && !declara) {
        v.push({ regla: "prioridad-muda", multa: `propones abrir por ${prop.entidad}, pero el que más cae es ${caen[0].entidad}: ordena por la cifra o declara tu criterio.` });
      }
    }
    return v;
  },
};

/* ═══ B · INVENTARIO INMOVILIZADO ═════════════════════════════════════════════════════════════════════════════
 * La lista simple («qué SKU tienen capital frenado») es de lectura-por-eje y AHÍ SE QUEDA: este playbook exige
 * una señal de ASESORÍA (qué hago / liberar / recuperar / plata dormida) que esas preguntas no traen. */
const _B_TEMA = /\binventario\b|\bstock\b|\bcapital\b|\bmercader[ií]a\b/i;
/* «sobra» y «no rota» son la misma pregunta con otras palabras — las dos las ofrece la cara Capital (censo T2) */
const _B_ESTADO = /\binmoviliz|\bfrenad|\bdormid|\bparad[oa]s?\b|\bestancad|\bsin mover(?:se)?\b|\bno rota\b|\bsin rotaci[oó]n\b|\batrapad|\bsobra\b|\bsobrante\b/i;
/* ⚠️ EL LÉXICO DE LOS ASKS (censo T2, 2026-09-05): la cara Capital OFRECE botones —«¿Dónde está frenado mi
 * capital?» · «¿Dónde está inmovilizado mi capital?» · «¿Dónde sobra inventario?»— y ninguno tenía camino
 * porque este detector pedía una señal de ASESORÍA («qué hago», «liberar») que un botón no trae. Un ask es un
 * click sobre una promesa: no puede caer al rescate. Se suma la forma LOCATIVA («dónde está…»), que es
 * exactamente lo que esos botones preguntan. */
const _B_UBICACION = new RegExp(`\\bd[oó]nde\\b[^.\\n]{0,24}\\b(?:est[aá]|tengo|hay|se acumula|sobra|queda)${_FIN}|\\bd[oó]nde (?:sobra|se acumula)${_FIN}`, "i");
const _B_ASESORIA = new RegExp(`\\bqu[eé] hago${_FIN}|\\bhacer con${_FIN}|\\bliber[aoáé]|\\brecuper[aoáé]|\\bconviene${_FIN}|\\bdesarm|\\bcu[aá]nta plata${_FIN}|\\bplata (?:dormida|parada|atrapada|metida)${_FIN}|${_B_UBICACION.source}`, "i");
export const inventarioInmovilizado = {
  nombre: "inventario-inmovilizado",
  cuandoAplica(pregunta) {
    const q = String(pregunta || "");
    if (_SIMULA.test(q) || _DEUDA.test(q)) return false;
    return _B_TEMA.test(q) && _B_ESTADO.test(q) && _B_ASESORIA.test(q);
  },
  pasos: [
    { tool: "inventoryStatus", args: { focus: "frenado" }, para: "cuánto capital está frenado y en qué SKU, con los días de inventario y la rotación de cada uno" },
  ],
  obligatorias: [/^Capital frenado · total$/i, /· Capital frenado$/i],
  entregable: "cuánto capital está inmovilizado (y si es material para este negocio, con el umbral declarado), en qué SKU está, y cuál abrir primero — ofrecido con su cifra, jamás ordenado. Se localiza dónde; el porqué de cada freno no está en este dato.",
  componer({ figs, semilla } = {}) {
    const total = _find(figs, /^Capital frenado · total$/i);
    if (!total) return null;
    const dias = new Map(_all(figs, /· D[ií]as de inventario$/i).map((f) => [_entidadDe(_lab(f)), _val(f)]));
    const rota = new Map(_all(figs, /· Rotaci[oó]n$/i).map((f) => [_entidadDe(_lab(f)), _val(f)]));
    /* «X · Capital frenado» mezcla bodegas y SKU bajo el MISMO label: la pertenencia separa (la técnica de
     * lectura-por-eje) — es SKU quien además trae días de inventario o rotación; la bodega no los tiene. */
    const skus = _all(figs, /· Capital frenado$/i)
      .map((f) => ({ entidad: _entidadDe(_lab(f)), usd: _num(f), fmt: _val(f) }))
      .filter((x) => x.entidad && Number.isFinite(x.usd) && (dias.has(x.entidad) || rota.has(x.entidad)))
      .sort((a, b) => b.usd - a.usd);
    if (!skus.length) return null;
    const piso = _piso();
    const esMaterial = Number.isFinite(_num(total)) && piso > 0 ? _num(total) >= piso : true;
    const partes = [];
    // LA VOZ (2026-09-03): «Capital inmovilizado (frenado): $X.» rotulaba; el asesor lo dice.
    partes.push(`Tienes ${_val(total)} de capital inmovilizado — stock que no está rotando.${esMaterial ? "" : ` Está ${_fraseUmbral() || "bajo el umbral de materialidad de tu negocio"} — no es tu incendio de hoy.`}`);
    const top = skus.slice(0, 4);
    partes.push(`\nDónde está:`);
    for (const s of top) {
      /* cada cifra pegada a su concepto: «$14K (165d · rotación 1.0x)» dejaba el monto huérfano y el muro lo
       * leía atribuido a la rotación — el dueño de cada número se nombra al lado del número. */
      const extra = [dias.get(s.entidad) ? `${dias.get(s.entidad)} de inventario` : null, rota.get(s.entidad) ? `rotación ${rota.get(s.entidad)}` : null].filter(Boolean).join(" · ");
      partes.push(`- ${s.entidad} · capital frenado ${s.fmt}${extra ? ` · ${extra}` : ""}`);
    }
    if (skus.length > top.length) partes.push(`(${top.length} de ${skus.length} SKU con capital frenado.)`);
    partes.push(`\nPor qué cada uno está frenado no está en este dato: queda localizado, no explicado.`);
    partes.push(esMaterial
      ? (skus.length === 1
        ? `Si quieres, empiezo por ${top[0].entidad}: es el único con capital frenado. Dime y lo abrimos.`
        : variante(semilla, [
          `Si quieres, empiezo por ${top[0].entidad}: es el mayor (${top[0].fmt} de ${_val(total)}). Dime y lo abrimos.`,
          `El mayor es ${top[0].entidad} (${top[0].fmt} de ${_val(total)}) — ¿lo abrimos?`,
          `Si te parece, arranco por ${top[0].entidad}: es el mayor (${top[0].fmt} de ${_val(total)}).`,
        ]))
      : `Si igual quieres verlo, empiezo por ${top[0].entidad}, que es el mayor. Dime y lo abrimos.`);
    return partes.join("\n");
  },
  listaNotarial(texto, { figs } = {}) {
    const t = String(texto || "");
    if (!t.trim()) return [];
    const v = [];
    const MEC = /d[ií]as de inventario|rotaci[oó]n|frenad|sobrestock|quiebre|capital/i;
    const CIFRA = /\$\s?[\d.,]+\s?[KMB]?|[\d.,]+\s*%|\b\d+\s*d\b|[\d.,]+\s*x\b/;
    for (const o of t.split(/[.!?\n]+/)) {
      if (!new RegExp(`\\bporque\\b|\\bse debe a\\b|\\bla causa (?:es|est[aá])${_FIN}`, "i").test(o)) continue;
      if (!MEC.test(o) && !CIFRA.test(o)) {
        v.push({ regla: "causa-sin-respaldo", multa: "afirmas por qué está frenado y este dato no lo declara: localiza (qué SKU y cuánto) o di que la causa no está medida." });
        break;
      }
    }
    /* el 03 OFRECE, jamás ordena: una orden de liquidar/rematar sin marcador de oferta cruza la línea.
     * Los imperativos voseados terminan en vocal acentuada («liquidá») — _FIN, no `\b` (§5g en espejo). */
    const ORDENA = new RegExp(`\\bliquid[aá](?:l[oa])?${_FIN}|\\bremat[aá](?:l[oa])?${_FIN}|\\bvend[eé](?:l[oa])?${_FIN}|\\bten[eé]s que${_FIN}|\\btienes que${_FIN}|\\bhay que${_FIN}|\\bdeb[eé]s${_FIN}`, "i");
    const OFRECE = /si (?:quieres|quer[eé]s)|podr[ií]a(?:s|mos)?|una opci[oó]n|te conviene evaluar|¿quieres|dime y/i;
    if (ORDENA.test(t) && !OFRECE.test(t)) {
      v.push({ regla: "accion-ordenada", multa: "ordenas una acción (liquidar/rematar/«hay que») sin ofrecerla: las acciones se OFRECEN para que el usuario las evalúe, jamás se ordenan." });
    }
    return v;
  },
};

/* ═══ C · LECTURA DE VENTAS ═══════════════════════════════════════════════════════════════════════════════════
 * Se llamaba «caída de ventas» y solo abría si la pregunta ya afirmaba que la venta caía. El censo (2026-09-04)
 * midió el costo: «cómo van las ventas» · «cuánto vendimos» · «¿Cómo van las ventas contra el presupuesto?»
 * —este último un ask de pantalla, o sea un botón que el producto ofrece— caían todos a `vacio`. El composer ya
 * sabía decir «tu venta NO viene cayendo»: lo que faltaba era dejar entrar la pregunta neutra.
 *
 * TRES CASOS, un solo entregable: `caida` (lo de antes) · `neutra` (cómo van) · `presupuesto` (contra el plan).
 * El nombre cambió con el alcance — un identificador que dice «caída» y atiende la lectura entera es la deuda
 * «una palabra, dos conceptos» que este proyecto ya pagó una vez.
 *
 * LA SERIE MES A MES no se narra acá y es a propósito: los valores mensuales viven en `trend.facts.tablaM` y
 * NO están en la boleta (medido), así que citarlos sería cifra sin respaldo; y los tres totales que `trend` sí
 * pone en boleta viajan como COMPUTED que el juez del escenario veta con razón. Lo honesto es la lectura del
 * período —que sí es del dato— y decir dónde se ve el mes a mes. */
const _C_TEMA = /\bventa[s]?\b|\bfacturaci[oó]n\b|\bfactur(?:amos|aci[oó]n)\b|\bvend(?:imos|emos|iendo)\b/i;
const _C_CAE = new RegExp(`\\bca[ií]da${_FIN}|\\bcaen${_FIN}|\\bcayendo${_FIN}|\\bcay[oó]${_FIN}|\\bcayeron${_FIN}|\\bbajaron${_FIN}|\\bbajando${_FIN}|\\bbajad[oa]${_FIN}|\\bbaj[oó]n${_FIN}|\\bdesplom|\\bperd[ií]${_FIN}|\\bperdiendo${_FIN}|\\bvenimos mal${_FIN}|\\bvan mal${_FIN}|venta[s]?\\s+baj|facturaci[oó]n\\s+baj`, "i");
const _C_FUERA = new RegExp(`\\bq[1-4]${_FIN}|\\btrimestr|\\bsemestr|[uú]ltimo mes${_FIN}|\\bpunto[s]? de venta${_FIN}|\\bcliente[s]?${_FIN}`, "i");
/* la lectura NEUTRA: cómo van · cómo viene · cuánto vendimos · dame la venta. Sin señal de caída y sin pedir
 * un eje — quien nombra un eje («ventas por marca») pregunta otra cosa y la atiende lectura-por-eje. */
const _C_LEE = new RegExp(`\\bc[oó]mo (?:va[n]?|viene[n]?|est[aá]|estamos|andamos|venimos)${_FIN}|\\bcu[aá]nto (?:vendimos|facturamos|llevamos|va|vendemos)${_FIN}|\\bcu[aá]nto (?:es|fue) (?:la|mi|nuestra) (?:venta|facturaci[oó]n)${_FIN}|\\b(?:dame|mu[eé]strame|muestrame|ver|quiero ver|necesito ver)${_FIN}|\\bevoluci[oó]n${_FIN}|\\bqu[eé] tal (?:van|viene|est[aá])${_FIN}`, "i");
/* el plan comprometido — el ask de pantalla dice «contra el presupuesto» y el dato lo trae (vs_presupuesto). */
const _C_PPTO = new RegExp(`\\bpresupuest|\\bppto${_FIN}|\\bplan${_FIN}|\\bcomprometid`, "i");
const _C_SERIE = new RegExp(`\\bmes a mes${_FIN}|\\bmensual(?:es|mente)?${_FIN}|\\bevoluci[oó]n${_FIN}|\\bpor mes${_FIN}`, "i");
/* PURO detector: devuelve el caso o null. Lo consultan `cuandoAplica`, `pasos` y `componer` — una sola lectura
 * de la pregunta para los tres, que es lo que evita que el paso pida un foco y el composer redacte otro. */
function _casoVentas(pregunta) {
  const q = String(pregunta || "");
  if (!q.trim()) return null;
  if (_SIMULA.test(q) || _DEUDA.test(q) || _C_FUERA.test(q)) return null;
  if (detectSerieIntent(q)) return null;
  if (!_C_TEMA.test(q)) return null;
  /* nombra a alguien → no es la lectura del negocio: contestar el total a quien preguntó por una cuenta es
   * cambiarle la pregunta (el secuestro que el censo encontró en la foto). Ante la duda, false. */
  if (nombraEntidad(q)) return null;
  if (_C_CAE.test(q)) return "caida";
  if (_C_PPTO.test(q) && _C_LEE.test(q)) return "presupuesto";
  if (_C_SERIE.test(q)) return "serie";
  if (_C_LEE.test(q)) return "neutra";
  return null;
}
export const lecturaDeVentas = {
  nombre: "lectura-de-ventas",
  cuandoAplica(pregunta) {
    return _casoVentas(pregunta) !== null;
  },
  /* ⚠️ SIN el tool `trend`, a propósito (medido 2026-09-01): su «Venta del período» viaja como cifra COMPUTED
   * que el dato declara no reconciliada, y el juez del escenario la veta con razón. La comparación contra el
   * año anterior que SÍ es lectura del dato es la de salesRead (headline + YoY por cliente). */
  pasos(pregunta) {
    if (_casoVentas(pregunta) === "presupuesto") {
      return [{ tool: "salesRead", args: { focus: "vs_presupuesto" }, para: "la venta del período contra el presupuesto comprometido (headline) y la brecha por cliente" }];
    }
    return [{ tool: "salesRead", args: {}, para: "la comparación contra el año anterior: la lectura del período (headline) y el YoY por cliente — quién cae y quién sube" }];
  },
  obligatorias(pregunta) {
    if (_casoVentas(pregunta) === "presupuesto") return [/^headline$/i, /· vs ppto$/i];
    return [/^headline$/i, /· YoY$/i];
  },
  entregable: "si la venta cae o no contra el año anterior (la lectura del período, verbatim), quiénes explican el movimiento (YoY por cliente, materialidad mediante) y a quién abrir primero — ofrecido. Localiza; el porqué no está en este dato.",
  componer({ figs, pregunta, semilla } = {}) {
    const caso = _casoVentas(pregunta) || "caida";
    const head = _find(figs, /^headline$/i);
    if (!head || !Number.isFinite(_pct(head))) return null;
    const cae = _pct(head) < 0;
    /* el par que el motor publica bajo la MISMA etiqueta: [0] el período, [1] su referencia (año anterior o
     * presupuesto, según el foco pedido). Si no vienen los dos no se cita ninguno — media comparación es una
     * cifra suelta, y una cifra suelta sin su contra es exactamente lo que el muro castiga. */
    const subs = _all(figs, /^headlineSub$/i);
    const par = subs.length === 2 ? { total: _val(subs[0]), ref: _val(subs[1]) } : null;
    const contraPpto = caso === "presupuesto";
    const yoy = _all(figs, contraPpto ? /· vs ppto$/i : /· YoY$/i).map((f) => ({ entidad: _entidadDe(_lab(f)), usd: _num(f), fmt: _val(f) }))
      .filter((x) => x.entidad && Number.isFinite(x.usd));
    const piso = _piso();
    const caen = _materiales(yoy.filter((x) => x.usd < 0), piso).sort((a, b) => a.usd - b.usd);
    const suben = _materiales(yoy.filter((x) => x.usd > 0), piso).sort((a, b) => b.usd - a.usd);
    const partes = [];
    // LA VOZ (2026-09-03): el asesor abre con el veredicto y lo respalda — sin endulzar el que viene mal.
    if (contraPpto) {
      /* el par de cifras NO llega en este foco (medido): el motor publica el headline y la brecha por cliente,
       * y el total contra el plan solo como texto de panel que no entra a la boleta. Se dice lo que hay. */
      partes.push(cae
        ? `Tu venta quedó bajo el presupuesto comprometido${par ? `: ${par.total} contra ${par.ref}` : ""} — ${_val(head)} en la lectura del período.`
        : `Tu venta va por encima del presupuesto comprometido${par ? `: ${par.total} contra ${par.ref}` : ""} — ${_val(head)} en la lectura del período.`);
    } else if (caso === "neutra" || caso === "serie") {
      /* la pregunta NO afirmó que la venta cae: se abre con la lectura, no con un desmentido. */
      /* el guion largo antes de un porcentaje se lee como signo menos: «$100.0M — 7.6%» parecía una caída
       * cuando el dato dice que crece. La dirección se nombra con la palabra —que la autoriza el signo del raw
       * publicado, comparar contra cero es selección, no cuenta— y la cifra queda pegada a su referencia. */
      partes.push(par
        ? `Tu venta del período viene en ${par.total} y ${cae ? "viene cayendo" : "viene creciendo"} contra el año anterior: ${_val(head)} sobre los ${par.ref} del año pasado.`
        : `Tu venta ${cae ? "viene cayendo" : "viene creciendo"} contra el año anterior: ${_val(head)} en la lectura del período.`);
      if (caso === "serie") {
        partes.push(`\nEl mes a mes no te lo puedo dictar acá: este dato publica el total del período y el detalle mensual se ve en el cuadro de la Mesa. Lo que sí te doy es quién mueve ese total.`);
      }
    } else {
      partes.push(cae
        ? `Sí: tu venta viene por debajo del año anterior — ${_val(head)} en la lectura del período.`
        : `Tu venta NO viene cayendo: la lectura del período contra el año anterior es ${_val(head)}.`);
    }
    /* la referencia se nombra UNA vez y es la del foco que se pidió: mezclar «año anterior» con cifras que
     * salieron del presupuesto es el defecto de los dos universos, en chico. */
    const REF = contraPpto ? "contra su presupuesto" : "contra el año anterior";
    if (caen.length) {
      partes.push(`\n${contraPpto ? "Quiénes quedan debajo del plan" : `Dónde ${cae ? "se cae" : "sí hay caída, aunque el total suba"}`}:`);
      for (const c of caen.slice(0, 4)) partes.push(`- ${c.entidad} · ${c.fmt} ${REF}`);
    } else {
      partes.push(`\nNingún cliente ${contraPpto ? "queda debajo de su presupuesto" : "cae"} de forma material ${contraPpto ? "" : REF}${_fraseUmbral() ? ` (${_fraseUmbral()})` : ""}.`.replace(/\s+/g, " "));
    }
    if (suben.length) partes.push(`${caen.length ? "\n" : ""}Los que más ${contraPpto ? "aportan sobre el plan" : "suben"}: ${suben.slice(0, 2).map((s) => `${s.entidad} ${s.fmt}`).join(" · ")}.`);
    partes.push(`\nPor qué ${cae ? "cae" : "se mueve así"} no está en este dato: queda localizado quién y cuánto.`);
    /* el ofrecimiento cambia con lo que el turno dejó sin abrir: si hubo caídas, la cuenta que más pesa; si no,
     * la otra comparación —que existe en el dato y el usuario no pidió— o nada. Jamás se ofrece la serie
     * mensual POR CLIENTE, que este dato no trae (medido). */
    if (caen.length) {
      partes.push(variante(semilla, [
        `Si quieres, abrimos ${caen[0].entidad} —${contraPpto ? "el que más se aleja del plan" : "el que más cae"}— para ver qué le pasa a su margen. Dime y la traigo.`,
        `Vale la pena mirar a ${caen[0].entidad}, ${contraPpto ? "el más lejos del plan" : "el que más cae"}: ¿lo abrimos?`,
        `Te abro ${caen[0].entidad} —${contraPpto ? "el que más se aleja del plan" : "el que más cae"}— si quieres verlo por dentro.`,
      ]));
    } else if (!contraPpto && (caso === "neutra" || caso === "serie")) {
      partes.push(variante(semilla, [
        `Si quieres, te la abro también contra el presupuesto comprometido.`,
        `¿La comparamos también contra el presupuesto? Ese corte está en el dato.`,
        `Te queda pendiente la comparación contra el presupuesto: dime y la traigo.`,
      ]));
    }
    return partes.join("\n");
  },
  listaNotarial(texto, { figs } = {}) {
    const t = String(texto || "");
    if (!t.trim()) return [];
    const v = [];
    /* la caída no se afirma contra el dato: si el texto dice que la venta cae y la lectura publicada del
     * período dice lo contrario (o al revés), miente — el signo de UN raw ya publicado, cero cálculo nuevo. */
    const head = _find(figs, /^headline$/i);
    if (head && Number.isFinite(_pct(head))) {
      const caeDato = _pct(head) < 0;
      const diceCae = /\bventa[s]? (?:viene[n]? por debajo|cae[n]?|cay[oó]|cayeron|se desplom)/i.test(t) || /la ca[ií]da de (?:la |las |tu |tus )?venta/i.test(t);
      const diceSube = /\bventa[s]? (?:no cae[n]?|no viene[n]? cayendo|viene[n]? por encima|sube[n]?|crece[n]?)/i.test(t);
      if (diceCae && !caeDato) v.push({ regla: "caida-inventada", multa: "dices que la venta cae y la lectura del período publicada dice lo contrario: corrige la lectura." });
      if (diceSube && caeDato) v.push({ regla: "alza-inventada", multa: "dices que la venta no cae y la lectura del período publicada dice lo contrario: corrige la lectura." });
    }
    const MEC = /a[ñn]o anterior|yoy|mes a mes|per[ií]odo/i;
    const CIFRA = /\$\s?[\d.,]+\s?[KMB]?|[\d.,]+\s*%/;
    for (const o of t.split(/[.!?\n]+/)) {
      if (!new RegExp(`\\bporque\\b|\\bse debe a\\b|\\bla causa (?:es|est[aá])${_FIN}`, "i").test(o)) continue;
      if (!MEC.test(o) && !CIFRA.test(o)) {
        v.push({ regla: "causa-sin-respaldo", multa: "afirmas por qué caen las ventas y este dato no lo declara: localiza (quién y cuánto) o di que la causa no está medida." });
        break;
      }
    }
    return v;
  },
};

/* ═══ D · OPORTUNIDAD DE PRECIO ═══════════════════════════════════════════════════════════════════════════════
 * La señal que el producto ya usa para «revisar precio» es el margen bajo la vara POR SKU (marginRead sku).
 * ⚠️ LAS «Medida …» SE CITAN SOLO SI RECONCILIAN: en la planilla real del owner «Medida cerrar brecha» salió
 * 1000× la venta del SKU (medido 2026-09-01: venta $9.1M, brecha 10.3pp ≈ $937K, publicado $937.8M). Una
 * medida mayor que la venta del propio SKU es imposible (la brecha es una fracción de la venta): NO se cita —
 * comparar dos raw publicados para decidir si citar es selección, no recálculo. El defecto de escala se
 * reportó aparte; este playbook no lo tapa ni lo reproduce. */
const _D_TEMA = /\bprecio[s]?\b|\bpricing\b/i;
const _D_PIDE = new RegExp(`\\boportunidad|\\bsubir${_FIN}|\\brevis[aoáé]|\\bajust[aoáé]|\\bmejorar${_FIN}|\\btocar${_FIN}|\\bd[oó]nde${_FIN}|\\bcu[aá]les${_FIN}`, "i");
const _D_FUERA = /\bcanal(?:es)?\b|\bmarca[s]?\b|\bfamilia[s]?\b|\bbodega[s]?\b|\bcliente[s]?\b|\bcosto[s]?\b/i;
export const oportunidadDePrecio = {
  nombre: "oportunidad-de-precio",
  cuandoAplica(pregunta) {
    const q = String(pregunta || "");
    if (_SIMULA.test(q) || _DEUDA.test(q) || _D_FUERA.test(q)) return false;
    return _D_TEMA.test(q) && _D_PIDE.test(q);
  },
  pasos: [
    { tool: "marginRead", args: { dimension: "sku" }, para: "qué SKU están bajo el benchmark de margen, con el margen y la venta de cada uno — la señal de revisión de precio que el producto declara" },
  ],
  obligatorias: [/^Benchmark de margen$/i, /^SKU bajo el benchmark$/i],
  entregable: "el benchmark declarado, cuántos SKU están bajo él, cuáles son (margen y venta de cada uno) y cuál abrir primero — ofrecido como revisión, jamás como orden de subir precios. Si el driver es costo o precio no está en esta lectura: se ofrece abrirlo, no se afirma.",
  componer({ figs, semilla } = {}) {
    const bench = _find(figs, /^Benchmark de margen$/i);
    const conteo = _find(figs, /^SKU bajo el benchmark$/i);
    if (!bench || !conteo || !Number.isFinite(_pct(bench))) return null;
    const margen = _all(figs, /· Margen$/i).map((f) => ({ entidad: _entidadDe(_lab(f)), fmt: _val(f), pct: _pct(f) }))
      .filter((x) => x.entidad && Number.isFinite(x.pct)).sort((a, b) => a.pct - b.pct);
    /* EL CORTE SE DECLARA CONTRA LO PUBLICADO, no contra el conteo (medido 2026-09-01): el panel del demo
     * publica el margen de 10 de sus 12 bajo-benchmark — la reconciliación exacta del molde es inalcanzable
     * acá, y fingir «los N de los M» sin ver los M sería la lista-sin-corte de siempre. El conteo del motor se
     * cita verbatim; la lista dice de cuántos publicados sale, y si la lectura no publica todos, LO DICE. */
    const bajo = margen.filter((x) => x.pct < _pct(bench));
    if (!bajo.length) return null;
    const n = _cnt(conteo);
    const venta = new Map(_all(figs, /· Venta$/i).map((f) => [_entidadDe(_lab(f)), f]));
    const medida = new Map(_all(figs, /· Medida cerrar brecha$/i).map((f) => [_entidadDe(_lab(f)), f]));
    const top = bajo.slice(0, 3);
    const partes = [];
    // LA VOZ (2026-09-03): rotular era «Benchmark: X. SKU bajo: N.» — el asesor lo dice en una frase.
    partes.push(`Tu benchmark de margen es ${_val(bench)}, y ${_val(conteo)} SKU venden por debajo de esa referencia.`);
    partes.push(`\nDónde está la oportunidad (los ${top.length} de menor margen${Number.isFinite(n) && bajo.length < n ? ` — esta lectura publica el margen de ${bajo.length} de los ${_val(conteo)}` : `, de los ${_val(conteo)} bajo el benchmark`}):`);
    for (const s of top) {
      const vf = venta.get(s.entidad);
      const mf = medida.get(s.entidad);
      /* la medida solo si reconcilia contra la venta del MISMO SKU (ver la cabecera de este playbook) */
      const medidaOk = mf && vf && Number.isFinite(_num(mf)) && Number.isFinite(_num(vf)) && _num(mf) <= _num(vf);
      /* «margen de venta», nunca «margen» a secas: a un SKU el muro le exige decir de CUÁL margen se habla
       * (venta vs inventario) — y el de marginRead es el de venta (las filas de margen del año, no el stock). */
      partes.push(`- ${s.entidad} · margen de venta ${s.fmt}${vf ? ` · venta ${_val(vf)}` : ""}${medidaOk ? ` · cerrar su brecha al benchmark vale ${_val(mf)}` : ""}`);
    }
    partes.push(`\nSi el problema de cada uno es precio o costo no está en esta lectura: no lo afirmo.`);
    partes.push(variante(semilla, [
      `Si quieres, abrimos ${top[0].entidad} —el de menor margen— y vemos su estructura antes de tocar ningún precio. Dime y lo abrimos.`,
      `Antes de tocar ningún precio, ¿abrimos ${top[0].entidad}? Es el de menor margen.`,
      `Te propongo abrir ${top[0].entidad} —el de menor margen— y ver su estructura antes de tocar ningún precio.`,
    ]));
    return partes.join("\n");
  },
  listaNotarial(texto, { figs } = {}) {
    const t = String(texto || "");
    if (!t.trim()) return [];
    const v = [];
    /* «el precio está mal/bajo» es una causa que esta lectura no declara (el driver puede ser costo).
     * El sujeto puede traer la entidad en medio («el precio de MAK-COMP-AIR está muy bajo»): se tolera. */
    const AFIRMA_PRECIO = /precio[s]?(?: de [\w.-]+)? (?:est[aá][n]? |es |son )?(?:muy |demasiado )?(?:mal\b|bajo[s]?\b|barato[s]?\b|equivocado[s]?\b)|est[aá][s]? (?:vendiendo|cobrando) (?:muy )?barato/i;
    const DRIVER = /costo|estructura|driver|carga comercial|rebate/i;
    if (AFIRMA_PRECIO.test(t) && !DRIVER.test(t)) {
      v.push({ regla: "precio-culpado-sin-driver", multa: "afirmas que el precio está mal y esta lectura no declara el driver (puede ser costo): ofrece abrir la estructura del SKU en vez de culpar al precio." });
    }
    const ORDENA = /\bsub[ií] (?:el|los) precios?\b|\bten[eé]s que subir\b|\btienes que subir\b|\bhay que subir\b/i;
    const OFRECE = /si (?:quieres|quer[eé]s)|podr[ií]a(?:s|mos)?|una opci[oó]n|¿quieres|dime y/i;
    if (ORDENA.test(t) && !OFRECE.test(t)) {
      v.push({ regla: "accion-ordenada", multa: "ordenas subir precios sin ofrecerlo: la revisión se OFRECE con su evidencia, jamás se ordena." });
    }
    return v;
  },
};
