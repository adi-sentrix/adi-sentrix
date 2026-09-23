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
import { esPorQue } from "../porque.js";   // la ley del porqué es de la casa (owner 2026-09-09)
import { nombraEntidad, pidePuntoDeVenta } from "./indiceEntidades.js";   // el guardia anti-secuestro, compartido con la foto
import { pisoFocosUSD, declaracionUmbralFocos, figsUmbralFocos } from "../../specRetrieval.js";
import { variante } from "../variacion.js";   // los cierres varían por semilla («matar la repetición», 2026-09-03)
import { axisEntityNames } from "../../oracle/entityIndex.js";   // el tamaño del eje, para el universo de un orden («los 13 clientes») sin escribirlo a mano
import { declaradorDe } from "../../notario/declarar.js";
import { parseFigures } from "../../boleta.js";   // el parser de la casa, para el número de una fig sin raw   // el Notario semántico (fase 2): los composers declaran MIENTRAS escriben, sin tocar el texto

const _num = (f) => (f && Number.isFinite(f.raw) ? f.raw : NaN);
/* el número de una fig SIN raw (el ledger emite «Variación vs año anterior en $» desde el texto, sin crudo): del valor, con el parser de la casa */
const _numOValor = (f) => { const r = _num(f); if (Number.isFinite(r)) return r; const p = parseFigures(String((f && (f.text || f.value)) || "").replace(/[\u2212\u2013]/g, "-")); return p.length ? p[0].raw : NaN; };
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

/* ── LO QUE SE DECLARA AL NOTARIO (fase 2) · utilería compartida por los cuatro composers ─────────────────────────
 * El universo de un orden o un conteo lleva el tamaño del eje del tenant («los 13 clientes»), sin escribir el 13 a
 * mano; sin índice, el eje entero por su nombre («los clientes»), que el verificador también lee como el conjunto
 * completo. Y las dos cifras del umbral que `_fraseUmbral` interpola («0.05%» · «$50K») se declaran con el rótulo
 * con que el motor las publica: las de la boleta si vienen, y si no las mismas dos figs de la misma función. */
const _universo = (eje, plural) => { let n = 0; try { n = (axisEntityNames(eje) || []).length; } catch { n = 0; } return n ? `los ${n} ${plural}` : `los ${plural}`; };
const _figsUmbral = (figs) => {
  const pct = _find(figs, /^Umbral de materialidad · % de la venta$/i), usd = _find(figs, /^Umbral de materialidad · en dinero$/i);
  if (pct && usd) return [pct, usd];
  let propias = []; try { propias = figsUmbralFocos() || []; } catch { propias = []; }
  return [pct || propias[0] || null, usd || propias[1] || null];
};

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
  componer({ figs, semilla, pregunta, declarar } = {}) {
    const total = _find(figs, /^Contribuci[oó]n total$/i);
    /* LA VARIACIÓN EN $ DE TODAS LAS CUENTAS (Notario semántico, fase 2, 2026-09-15): salesRead publica «YoY» solo de los cinco que más se mueven y
     * «Variación vs año anterior en $» de todas; medir la materialidad solo en los cinco decía «las otras 2 caen bajo el umbral» con Easy (−$177K)
     * y Unimarc (−$94K) por encima del piso — el Notario lo dio por falso. Se toma la primera fig de cada cuenta, YoY primero. */
    const _vistas = new Set();
    const caen = [..._all(figs, /· YoY$/i), ..._all(figs, /· Variaci[oó]n vs a[ñn]o anterior en \$$/i)]
      .map((f) => ({ entidad: _entidadDe(_lab(f)), usd: _numOValor(f), fmt: _val(f) }))
      .filter((x) => x.entidad && Number.isFinite(x.usd) && x.usd < 0 && !_vistas.has(x.entidad) && _vistas.add(x.entidad))
      .sort((a, b) => a.usd - b.usd);
    if (!total) return null;
    const piso = _piso();
    const materiales = _materiales(caen, piso);
    /* TODAS LAS CAÍDAS QUE LA BOLETA MUESTRA (owner 2026-09-14, grupos, conteos, universos e inventos): la venta publica el YoY en dinero solo de
     * los cinco que más se mueven, pero la variación porcentual de las 13 cuentas — y ahí caen cuatro, dos bajo el umbral. «Se te están cayendo 2
     * clientes» era un conteo que la propia boleta desmentía: el conteo en palabras se compara con lo que la boleta permite contar, así que se
     * cuenta con la variación completa y se dice cuántas son materiales. La cifra en % viene formateada (sin raw): el signo se lee del valor. */
    const caenTodas = new Set(_all(figs, /· Variación vs año anterior$/i).filter((f) => /^\s*[-−]/.test(_val(f)) || _num(f) < 0).map((f) => _entidadDe(_lab(f))).filter(Boolean));
    for (const c of caen) caenTodas.add(c.entidad);
    const nCaen = caenTodas.size;
    const _otras = (n) => (n === 1 ? "la otra cae" : `las otras ${n} caen`);
    const contrib = new Map(_all(figs, /· Contribuci[oó]n$/i).map((f) => [_entidadDe(_lab(f)), _val(f)]));
    /* EL NOTARIO SEMÁNTICO (fase 2): «se te están cayendo N clientes» es un conteo sobre el eje entero con el predicado que la boleta sí cuenta (la
     * variación vs año anterior); la partición material / bajo el umbral es una cuenta del composer contra el piso —se declara tal cual, con el
     * umbral como universo, aunque la boleta no la cuente—; «los N que más caen» es un orden top-k de YoY (dirección menor) y cada línea una
     * variación en dinero; «el que más cae» es el mínimo de YoY. */
    const D = declaradorDe(declarar);
    const U_CLI = _universo("cliente", "clientes");
    const U_CAEN = "los que caen vs año anterior";
    const [uPct, uUsd] = _figsUmbral(figs);
    const declaraUmbral = (texto) => { if (uPct) D.deFig(uPct, texto); if (uUsd) D.deFig(uUsd, texto); };
    const declaraQueCaen = (texto) => D.conteo({ n: nCaen, predicado: "caen vs año anterior", universo: U_CLI, texto });
    const partes = [];
    // LA VOZ (2026-09-03): el asesor cuenta, no rotula — mismas cifras, mismos dueños. Y una precisión que
    // la voz obligó a hacer: `total` es la contribución DEL NEGOCIO (contexto para dimensionar), no «lo en
    // juego» — la frase vieja lo insinuaba de más.
    if (!materiales.length) {
      const l0 = `Ningún cliente cae de forma material contra el año anterior${nCaen ? ` (${nCaen} caen, todos ${_fraseUmbral() || "bajo el umbral de materialidad del negocio"})` : ""}.`;
      partes.push(l0);
      D.conteo({ n: 0, m: nCaen || undefined, predicado: "sobre el umbral del negocio", universo: nCaen ? U_CAEN : U_CLI, texto: l0 });
      if (nCaen) { declaraQueCaen(l0); declaraUmbral(l0); }
      const l1 = `Para dimensionar: la contribución total del negocio es ${_val(total)}.`;
      partes.push(l1);
      D.deFig(total, l1);
      return partes.join("\n");
    }
    const top = materiales.slice(0, 4);
    const l0 = `Se te están cayendo ${nCaen} clientes contra el año anterior${nCaen > materiales.length ? `, ${materiales.length} de forma material (${_otras(nCaen - materiales.length)} ${_fraseUmbral() || "bajo el umbral de materialidad"})` : ""}. Para dimensionar: la contribución total del negocio es ${_val(total)}.`;
    partes.push(l0);
    declaraQueCaen(l0);
    if (nCaen > materiales.length) {
      D.conteo({ n: materiales.length, m: nCaen, predicado: "sobre el umbral del negocio", universo: U_CAEN, texto: l0 });
      D.conteo({ n: nCaen - materiales.length, m: nCaen, predicado: "bajo el umbral del negocio", universo: U_CAEN, texto: l0 });
      declaraUmbral(l0);
    }
    D.deFig(total, l0);
    const cab = `Los ${top.length} que más caen:`;
    partes.push(`\n${cab}`);
    D.orden({ sujeto: top.map((c) => c.entidad), metrica: "YoY", forma: "topk", k: top.length, direccion: "menor", universo: U_CLI, texto: cab });
    D.variacion({ sujeto: top.map((c) => c.entidad), metrica: "Ventas", direccion: "baja", texto: cab });
    for (const c of top) {
      const l = `- ${c.entidad} · ${c.fmt} contra el año anterior${contrib.has(c.entidad) ? ` · contribución actual ${contrib.get(c.entidad)}` : ""}`;
      partes.push(l);
      D.variacion({ sujeto: c.entidad, metrica: "Ventas", direccion: "baja", valor: c.fmt, texto: l });
      if (contrib.has(c.entidad)) D.cifra({ sujeto: c.entidad, metrica: "Contribución", valor: contrib.get(c.entidad), texto: l });
    }
    /* ⚠️ SI PREGUNTÓ POR SUCURSAL, SE DICE QUE ESE CORTE NO EXISTE (owner 2026-09-09): esta lectura responde
     * por CLIENTE, y contestar por el eje vecino sin nombrar el que pidió es improvisar por omisión — el
     * usuario se queda creyendo que le respondieron su pregunta. El punto de venta viaja en su archivo y el
     * motor todavía no lo agrega: se declara acá, con la lectura que sí existe al lado. */
    if (pidePuntoDeVenta(pregunta)) partes.push(`\nTu pregunta era por punto de venta, y ese corte todavía no lo analizo: la columna viaja en tu archivo pero aún no la agrego. Lo de arriba es por cliente, que es lo que sí puedo darte hoy.`);
    const lDonde = `Dónde se cae queda localizado; por qué se cae no está en este dato.`;
    partes.push(`\n${lDonde}`);
    D.variacion({ sujeto: [...caenTodas], metrica: "Ventas", direccion: "baja", texto: lDonde });   // «se cae»: los que caen, cada uno con su variación en la boleta
    const oferta = variante(semilla, [
      `Si quieres, abrimos la serie mensual de ${top[0].entidad} —el que más cae— para ver desde cuándo. Dime y la traigo.`,
      `Vale la pena ver desde cuándo: ¿abrimos la serie mensual de ${top[0].entidad}, el que más cae?`,
      `Para ver desde cuándo se cae, te abro la serie mensual de ${top[0].entidad} —el que más cae— si quieres.`,
    ]);
    partes.push(oferta);
    D.orden({ sujeto: top[0].entidad, metrica: "YoY", forma: "min", universo: U_CLI, texto: oferta });
    D.variacion({ sujeto: top[0].entidad, metrica: "Ventas", direccion: "baja", texto: oferta });
    /* LA LEY DEL PORQUÉ (owner 2026-09-09): el paso 3 CIERRA el turno — la oferta de navegación va antes.
     * Medido sobre los ocho lugares que el owner nombró: con la oferta al final, la pregunta que de verdad
     * cierra la lectura quedaba sepultada en el medio y el turno terminaba ofreciendo otra pantalla. */
    if (esPorQue(pregunta)) partes.push(`¿Qué pasó con esas cuentas: cambiaron su mezcla, hubo un quiebre de stock, se movió el precio, o entró un competidor?`);
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
    /* ⚠️ EL PORQUÉ DEL CAPITAL FRENADO TAMBIÉN ES SUYO (owner 2026-09-09, cazado por auditoría adversarial):
     * «¿por qué tengo capital frenado?» se la llevaba la lectura por eje —por el «qué» de «por qué», que su
     * detector acepta como pedido de lista— y el usuario recibía un ranking de tres SKU, sin límite, sin
     * hipótesis y sin pregunta. Retirarla de ahí sin darle dueño acá dejaba la pregunta cayendo al rescate,
     * que es peor. Quien trae el dato del capital frenado responde su porqué: con el límite dicho —la causa
     * de un freno NO está en este dato, y la casa lo tiene declarado— y la pregunta al dueño. */
    if (_B_TEMA.test(q) && _B_ESTADO.test(q) && esPorQue(q)) return true;
    return _B_TEMA.test(q) && _B_ESTADO.test(q) && _B_ASESORIA.test(q);
  },
  pasos: [
    { tool: "inventoryStatus", args: { focus: "frenado" }, para: "cuánto capital está frenado y en qué SKU, con los días de inventario y la rotación de cada uno" },
  ],
  obligatorias: [/^Capital frenado · total$/i, /· Capital frenado$/i],
  entregable: "cuánto capital está frenado (y si es material para este negocio, con el umbral declarado), en qué SKU está, y cuál abrir primero — ofrecido con su cifra, jamás ordenado. Se localiza dónde; el porqué de cada freno no está en este dato.",
  componer({ figs, semilla, pregunta, declarar } = {}) {
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
    /* EL NOTARIO SEMÁNTICO (fase 2): el total es una cifra del negocio (universo «total»); «está bajo el umbral» es el total MENOR que la
     * referencia declarada en dinero, con las dos cifras del umbral; la lista es el top-k de Capital frenado entre los SKU frenados, cada
     * línea con sus tres cifras y su estado; «cada uno está frenado» es el estado de los listados; «el mayor» es el máximo entre los frenados
     * y «$14K de $33K» una parte del total. */
    const D = declaradorDe(declarar);
    const U_SKU = _universo("sku", "SKU");
    const U_FRENADOS = "los SKU frenados";
    const [uPct, uUsd] = _figsUmbral(figs);
    const partes = [];
    // LA VOZ (2026-09-03): «Capital inmovilizado (frenado): $X.» rotulaba; el asesor lo dice.
    /* la cifra es el capital FRENADO (rotación bajo el piso / días sobre el techo), subconjunto del inmovilizado amplio: se nombra por lo que es (owner 2026-09-15) */
    const l0 = `Tienes ${_val(total)} de capital frenado — stock que no está rotando.${esMaterial ? "" : ` Está ${_fraseUmbral() || "bajo el umbral de materialidad de tu negocio"} — no es tu incendio de hoy.`}`;
    partes.push(l0);
    D.cifra({ sujeto: "negocio", metrica: "Capital frenado", valor: _val(total), universo: "total", texto: l0 });
    if (!esMaterial) {
      if (uUsd) D.relacion({ sujeto: "negocio", metrica: "Capital frenado", forma: "menor", vs: { sujeto: "negocio", metrica: _lab(uUsd) }, texto: l0 });
      if (uPct) D.deFig(uPct, l0);
      if (uUsd) D.deFig(uUsd, l0);
    }
    const top = skus.slice(0, 4);
    const cab = `Dónde está:`;
    partes.push(`\n${cab}`);
    D.orden({ sujeto: top.map((s) => s.entidad), metrica: "Capital frenado", forma: "topk", k: top.length, direccion: "mayor", universo: U_FRENADOS, texto: cab });
    if (skus.length <= top.length) D.conteo({ n: skus.length, predicado: "frenados", universo: U_SKU, sujeto: top.map((s) => s.entidad), texto: cab });   // la lista es completa: dónde está el capital frenado son estos
    for (const s of top) {
      /* cada cifra pegada a su concepto: «$14K (165d · rotación 1.0x)» dejaba el monto huérfano y el muro lo
       * leía atribuido a la rotación — el dueño de cada número se nombra al lado del número. */
      const extra = [dias.get(s.entidad) ? `${dias.get(s.entidad)} de inventario` : null, rota.get(s.entidad) ? `rotación ${rota.get(s.entidad)}` : null].filter(Boolean).join(" · ");
      const l = `- ${s.entidad} · capital frenado ${s.fmt}${extra ? ` · ${extra}` : ""}`;
      partes.push(l);
      D.cifra({ sujeto: s.entidad, metrica: "Capital frenado", valor: s.fmt, texto: l });
      D.estado({ sujeto: s.entidad, estado: "frenado", texto: l });
      if (dias.get(s.entidad)) D.cifra({ sujeto: s.entidad, metrica: "Días de inventario", valor: dias.get(s.entidad), texto: l });
      if (rota.get(s.entidad)) D.cifra({ sujeto: s.entidad, metrica: "Rotación", valor: rota.get(s.entidad), texto: l });
    }
    if (skus.length > top.length) {
      const l = `(${top.length} de ${skus.length} SKU con capital frenado.)`;
      partes.push(l);
      D.conteo({ n: skus.length, predicado: "frenados", universo: U_SKU, sujeto: top.map((s) => s.entidad), texto: l });   // los listados son parte de los N frenados; el «4» es el corte de la lista, no un hecho del dato
    }
    const lPorQue = `Por qué cada uno está frenado no está en este dato: queda localizado, no explicado.`;
    partes.push(`\n${lPorQue}`);
    D.estado({ sujeto: top.map((s) => s.entidad), estado: "frenado", texto: lPorQue });
    const cierre = esMaterial
      ? (skus.length === 1
        ? `Si quieres, empiezo por ${top[0].entidad}: es el único con capital frenado. Dime y lo abrimos.`
        : variante(semilla, [
          `Si quieres, empiezo por ${top[0].entidad}: es el mayor (${top[0].fmt} de ${_val(total)}). Dime y lo abrimos.`,
          `El mayor es ${top[0].entidad} (${top[0].fmt} de ${_val(total)}) — ¿lo abrimos?`,
          `Si te parece, arranco por ${top[0].entidad}: es el mayor (${top[0].fmt} de ${_val(total)}).`,
        ]))
      : `Si igual quieres verlo, empiezo por ${top[0].entidad}, que es el mayor. Dime y lo abrimos.`;
    partes.push(cierre);
    if (skus.length === 1) D.conteo({ n: 1, predicado: "frenados", universo: U_SKU, sujeto: [top[0].entidad], texto: cierre });
    else {
      D.orden({ sujeto: top[0].entidad, metrica: "Capital frenado", forma: "max", universo: U_FRENADOS, texto: cierre });
      if (esMaterial) {
        D.cifra({ sujeto: top[0].entidad, metrica: "Capital frenado", valor: top[0].fmt, texto: cierre });
        D.cifra({ sujeto: "negocio", metrica: "Capital frenado", valor: _val(total), universo: "total", texto: cierre });
        D.relacion({ sujeto: top[0].entidad, metrica: "Capital frenado", forma: "parte", vs: "negocio", texto: cierre });
      }
    }
    /* LA LEY DEL PORQUÉ (owner 2026-09-09): el inventario NO trae la causa de un freno —está declarado en la
     * casa: sin entradas, sin lead time, sin órdenes de compra— así que el paso 1 no se puede cumplir acá y no
     * se finge. Lo que sí corresponde es la parte que el dato no puede dar y el dueño sí: preguntársela. */
    if (esPorQue(pregunta)) partes.push(`¿Qué pasó con esos SKU: fue una sobrecompra, un cambio de temporada, un cliente que no retiró, o un proveedor que llegó tarde?`);
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
/* el TEMA en sustantivo o en verbo, y el verbo en TODAS sus personas: «¿Cuánto vendí en el período?» es un ask
 * de pantalla y el tema solo veía el plural (re-censo). «vendí» termina en tilde → `_FIN`, jamás `\b` (§5g). */
const _C_TEMA = new RegExp(`\\bventa[s]?${_FIN}|\\bfacturaci[oó]n${_FIN}|\\bfactur(?:amos|aste|ando|[eé])${_FIN}|\\bvend(?:imos|emos|iendo|iste|ido|[ií])${_FIN}`, "i");
const _C_CAE = new RegExp(`\\bca[ií]da${_FIN}|\\bcaen${_FIN}|\\bcayendo${_FIN}|\\bcay[oó]${_FIN}|\\bcayeron${_FIN}|\\bbajaron${_FIN}|\\bbajando${_FIN}|\\bbajad[oa]${_FIN}|\\bbaj[oó]n${_FIN}|\\bdesplom|\\bperd[ií]${_FIN}|\\bperdiendo${_FIN}|\\bvenimos mal${_FIN}|\\bvan mal${_FIN}|venta[s]?\\s+baj|facturaci[oó]n\\s+baj`, "i");
/* «crédito» y «contado» ceden a cobranza — que va DESPUÉS en el registro, así que si esta lectura no se
 * retira, se lo lleva puesto: «cuánto vendí a crédito vs contado» es una pregunta del cobro con el verbo
 * vender adentro (el gate de cobranza lo cazó al ampliar las conjugaciones). */
const _C_FUERA = new RegExp(`\\bq[1-4]${_FIN}|\\btrimestr|\\bsemestr|[uú]ltimo mes${_FIN}|\\bpunto[s]? de venta${_FIN}|\\bcliente[s]?${_FIN}|\\bcr[eé]dito${_FIN}|\\bcontado${_FIN}`, "i");
/* la lectura NEUTRA: cómo van · cómo viene · cuánto vendimos · dame la venta. Sin señal de caída y sin pedir
 * un eje — quien nombra un eje («ventas por marca») pregunta otra cosa y la atiende lectura-por-eje. */
/* el verbo en TODAS sus personas — «¿Cuánto vendí en el período?» es un ask de pantalla y el detector solo
 * veía el plural (el re-censo lo cazó: la conjugación es el mismo defecto que el género de «cuánta»). */
const _C_LEE = new RegExp(`\\bc[oó]mo (?:va[n]?|viene[n]?|est[aá]|estamos|andamos|venimos)${_FIN}|\\bcu[aá]nto (?:vend[ií](?:mos)?|vendiste|factur(?:amos|[eé]|aste)|llevamos|llevo|va|vendemos)${_FIN}|\\bcu[aá]nto (?:es|fue) (?:la|mi|nuestra) (?:venta|facturaci[oó]n)${_FIN}|\\b(?:dame|mu[eé]strame|muestrame|ver|quiero ver|necesito ver)${_FIN}|\\bevoluci[oó]n${_FIN}|\\bqu[eé] tal (?:van|viene|est[aá])${_FIN}`, "i");
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
  /* el PASADO a secas no es esta lectura: «cuánto vendí el año pasado» pide el total de OTRO período, y
   * abrirle la lectura del período actual sería cambiarle la pregunta (el gate de proyección lo congeló:
   * el pasado es historia, no supuesto). La COMPARACIÓN contra ese pasado sí es de acá. */
  if (new RegExp(`\\ba[ñn]o (?:pasado|anterior)${_FIN}|\\bmes pasado${_FIN}`, "i").test(q)
    && !new RegExp(`\\bcontra${_FIN}|\\bvs\\.?${_FIN}|\\bversus${_FIN}|\\bcompar`, "i").test(q)) return null;
  /* (tanda 2 post-poda, 2026-09-05: acá vivía el guardia ad-hoc `nombraEntidad` — hoy es la PROPIEDAD
   * `respondePorElNegocio` del playbook, aplicada UNA vez en playbookPara. Una línea que cada autor tenía
   * que recordar se olvidó tres veces en una semana; la propiedad no se olvida.) */
  if (_C_CAE.test(q)) return "caida";
  if (_C_PPTO.test(q) && _C_LEE.test(q)) return "presupuesto";
  if (_C_SERIE.test(q)) return "serie";
  if (_C_LEE.test(q)) return "neutra";
  return null;
}
export const lecturaDeVentas = {
  nombre: "lectura-de-ventas",
  /* responde POR EL NEGOCIO ENTERO: el registro lo retira si la pregunta nombra una entidad del índice */
  respondePorElNegocio: true,
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
  componer({ figs, pregunta, semilla, declarar } = {}) {
    const caso = _casoVentas(pregunta) || "caida";
    const head = _find(figs, /^headline$/i);
    if (!head || !Number.isFinite(_pct(head))) return null;
    const cae = _pct(head) < 0;
    /* el par que el motor publica bajo la MISMA etiqueta: [0] el período, [1] su referencia (año anterior o
     * presupuesto, según el foco pedido). Si no vienen los dos no se cita ninguno — media comparación es una
     * cifra suelta, y una cifra suelta sin su contra es exactamente lo que el muro castiga. */
    const subs = _all(figs, /^headlineSub$/i);
    const contraPpto = caso === "presupuesto";
    /* la referencia viaja con rótulo propio («Ventas del año anterior», Notario semántico fase 2) y la boleta no repite la cifra en la segunda
     * `headlineSub`: el par es el total de la cabecera y esa fila; contra el plan, solo si la cabecera trae los dos */
    const refAnt = !contraPpto ? _find(figs, /^Ventas del a[ñn]o anterior$/i) : null;
    const totalPpto = contraPpto ? _find(figs, /^Venta total$/i) : null;
    const pptoFig = contraPpto ? _find(figs, /^Presupuesto total$/i) : null;
    // «Ventas del período» (owner 2026-09-23 — arreglo del verificador, specRetrieval.js composeSpecVentas): el
    // MISMO total que antes SOLO vivía en la primera `headlineSub`, ahora con crudo real y rótulo propio — dedup
    // por canon contra la fig que `enrichFromFacts` auto-generaba (ledger.js), así que `subs` puede llegar VACÍO
    // (las dos mitades de headlineSub ya están cubiertas por figs con nombre: «Ventas del período» + «Ventas del
    // año anterior»). Sin esta rama el par se perdía y la apertura caía al fraseo degradado sin las dos cifras.
    const totalPeriodo = !contraPpto ? _find(figs, /^Ventas del per[ií]odo$/i) : null;
    const par = subs.length === 2 ? { total: _val(subs[0]), ref: _val(subs[1]), figs: [subs[0], subs[1]] }
      : subs.length === 1 && refAnt ? { total: _val(subs[0]), ref: _val(refAnt), figs: [subs[0], refAnt] }
      : totalPeriodo && refAnt ? { total: _val(totalPeriodo), ref: _val(refAnt), figs: [totalPeriodo, refAnt] }
      : totalPpto && pptoFig ? { total: _val(totalPpto), ref: _val(pptoFig), figs: [totalPpto, pptoFig] } : null;
    const yoy = _all(figs, contraPpto ? /· vs ppto$/i : /· YoY$/i).map((f) => ({ entidad: _entidadDe(_lab(f)), usd: _num(f), fmt: _val(f) }))
      .filter((x) => x.entidad && Number.isFinite(x.usd));
    const piso = _piso();
    const caen = _materiales(yoy.filter((x) => x.usd < 0), piso).sort((a, b) => a.usd - b.usd);
    const suben = _materiales(yoy.filter((x) => x.usd > 0), piso).sort((a, b) => b.usd - a.usd);
    /* EL NOTARIO SEMÁNTICO (fase 2): la lectura del período se declara con los rótulos con que salesRead la publica («headline» es la variación
     * del negocio; «headlineSub», el total y su referencia) y, además, con su significado: la variación de Ventas del negocio contra el año
     * anterior, o la relación con el presupuesto. Por cliente: cada «vs año anterior» es una variación en dinero y cada «vs ppto» una cifra;
     * «los que más suben / aportan sobre el plan» es un orden top-k y «el que más cae / se aleja del plan» el mínimo. */
    const D = declaradorDe(declarar);
    const U_CLI = _universo("cliente", "clientes");
    const M_CLI = contraPpto ? "vs ppto" : "YoY";   // el rótulo por cliente del foco pedido, para los órdenes
    const [uPct, uUsd] = _figsUmbral(figs);
    const ppto = _find(figs, /^Presupuesto total$/i);
    const declaraLectura = (texto, conPar = !!par) => {
      D.deFig(head, texto);
      if (par && conPar) { D.deFig(par.figs[0], texto); D.deFig(par.figs[1], texto); }   // el par solo donde la línea lo imprime (la lectura de «caída» no lo cita)
      if (!contraPpto) D.variacion({ sujeto: "negocio", metrica: "Ventas", direccion: cae ? "baja" : "sube", valor: _val(head), texto });
      else if (ppto) D.relacion({ sujeto: "negocio", metrica: "Venta", forma: /^-?0([.,]0+)?\s*%$/.test(_val(head).trim()) ? "igual" : cae ? "menor" : "mayor", vs: { sujeto: "negocio", metrica: _lab(ppto) }, texto });
    };
    const declaraCliente = (x, texto) => (contraPpto
      ? D.cifra({ sujeto: x.entidad, metrica: "vs ppto", valor: x.fmt, texto })
      : D.variacion({ sujeto: x.entidad, metrica: "Ventas", direccion: x.usd < 0 ? "baja" : "sube", valor: x.fmt, texto }));
    const partes = [];
    // LA VOZ (2026-09-03): el asesor abre con el veredicto y lo respalda — sin endulzar el que viene mal.
    if (contraPpto) {
      /* el par de cifras NO llega en este foco (medido): el motor publica el headline y la brecha por cliente,
       * y el total contra el plan solo como texto de panel que no entra a la boleta. Se dice lo que hay.
       * Y el EMPATE PUBLICADO no toma partido: con «0.0%» en pantalla (el pack de plantilla lo produce), decir
       * «por encima» es afirmar una dirección que la cifra que el usuario ve no muestra. */
      const empate = /^-?0([.,]0+)?\s*%$/.test(_val(head).trim());
      const l0 = empate
        ? `Tu venta viene en línea con el presupuesto comprometido${par ? `: ${par.total} contra ${par.ref}` : ""} — ${_val(head)} en la lectura del período.`
        : cae
          ? `Tu venta quedó bajo el presupuesto comprometido${par ? `: ${par.total} contra ${par.ref}` : ""} — ${_val(head)} en la lectura del período.`
          : `Tu venta va por encima del presupuesto comprometido${par ? `: ${par.total} contra ${par.ref}` : ""} — ${_val(head)} en la lectura del período.`;
      partes.push(l0);
      declaraLectura(l0);
    } else if (caso === "neutra" || caso === "serie") {
      /* la pregunta NO afirmó que la venta cae: se abre con la lectura, no con un desmentido. */
      /* el guion largo antes de un porcentaje se lee como signo menos: «$100.0M — 7.6%» parecía una caída
       * cuando el dato dice que crece. La dirección se nombra con la palabra —que la autoriza el signo del raw
       * publicado, comparar contra cero es selección, no cuenta— y la cifra queda pegada a su referencia. */
      const l0 = par
        ? `Tu venta del período viene en ${par.total} y ${cae ? "viene cayendo" : "viene creciendo"} contra el año anterior: ${_val(head)} sobre los ${par.ref} del año pasado.`
        : `Tu venta ${cae ? "viene cayendo" : "viene creciendo"} contra el año anterior: ${_val(head)} en la lectura del período.`;
      partes.push(l0);
      declaraLectura(l0);
      if (caso === "serie") {
        partes.push(`\nEl mes a mes no te lo puedo dictar acá: este dato publica el total del período y el detalle mensual se ve en el cuadro de la Mesa. Lo que sí te doy es quién mueve ese total.`);
      }
    } else {
      const l0 = cae
        ? `Sí: tu venta viene por debajo del año anterior — ${_val(head)} en la lectura del período.`
        : `Tu venta NO viene cayendo: la lectura del período contra el año anterior es ${_val(head)}.`;
      partes.push(l0);
      declaraLectura(l0, false);
    }
    /* la referencia se nombra UNA vez y es la del foco que se pidió: mezclar «año anterior» con cifras que
     * salieron del presupuesto es el defecto de los dos universos, en chico. */
    const REF = contraPpto ? "contra su presupuesto" : "contra el año anterior";
    if (caen.length) {
      const cab = `${contraPpto ? "Quiénes quedan debajo del plan" : `Dónde ${cae ? "se cae" : "sí hay caída, aunque el total suba"}`}:`;
      partes.push(`\n${cab}`);
      if (!contraPpto) D.variacion({ sujeto: caen.slice(0, 4).map((c) => c.entidad), metrica: "Ventas", direccion: "baja", texto: cab });   // «se cae / hay caída»: los listados, cada uno con su variación
      for (const c of caen.slice(0, 4)) { const l = `- ${c.entidad} · ${c.fmt} ${REF}`; partes.push(l); declaraCliente(c, l); }
    } else {
      const l = `\nNingún cliente ${contraPpto ? "queda debajo de su presupuesto" : "cae"} de forma material ${contraPpto ? "" : REF}${_fraseUmbral() ? ` (${_fraseUmbral()})` : ""}.`.replace(/\s+/g, " ");
      partes.push(l);
      /* la materialidad es una cuenta del composer contra el piso: se declara tal cual aunque la boleta no la cuente */
      D.conteo({ n: 0, predicado: contraPpto ? "bajo el presupuesto sobre el umbral del negocio" : "caída contra el año anterior sobre el umbral del negocio", universo: U_CLI, texto: l });
      if (_fraseUmbral()) { if (uPct) D.deFig(uPct, l); if (uUsd) D.deFig(uUsd, l); }
    }
    if (suben.length) {
      const l = `${caen.length ? "\n" : ""}Los que más ${contraPpto ? "aportan sobre el plan" : "suben"}: ${suben.slice(0, 2).map((s) => `${s.entidad} ${s.fmt}`).join(" · ")}.`;
      partes.push(l);
      D.orden({ sujeto: suben.slice(0, 2).map((s) => s.entidad), metrica: M_CLI, forma: "topk", k: Math.min(2, suben.length), direccion: "mayor", universo: U_CLI, texto: l });
      for (const s of suben.slice(0, 2)) declaraCliente(s, l);
    }
    /* el mismo criterio que en la lectura de arriba: si preguntó por sucursal, se dice que ese corte no existe
     * todavía en vez de contestar por cliente como si nada (owner 2026-09-09). */
    if (pidePuntoDeVenta(pregunta)) partes.push(`\nTu pregunta era por punto de venta, y ese corte todavía no lo analizo: la columna viaja en tu archivo pero aún no la agrego. Lo de arriba es por cliente, que es lo que sí puedo darte hoy.`);
    const lPorQue = `Por qué ${cae ? "cae" : "se mueve así"} no está en este dato: queda localizado quién y cuánto.`;
    partes.push(`\n${lPorQue}`);
    if (cae && !contraPpto) D.variacion({ sujeto: "negocio", metrica: "Ventas", direccion: "baja", texto: lPorQue });   // «cae»: la venta del negocio, la misma lectura de arriba
    /* el ofrecimiento cambia con lo que el turno dejó sin abrir: si hubo caídas, la cuenta que más pesa; si no,
     * la otra comparación —que existe en el dato y el usuario no pidió— o nada. Jamás se ofrece la serie
     * mensual POR CLIENTE, que este dato no trae (medido). */
    if (caen.length) {
      const oferta = variante(semilla, [
        `Si quieres, abrimos ${caen[0].entidad} —${contraPpto ? "el que más se aleja del plan" : "el que más cae"}— para ver qué le pasa a su margen. Dime y la traigo.`,
        `Vale la pena mirar a ${caen[0].entidad}, ${contraPpto ? "el más lejos del plan" : "el que más cae"}: ¿lo abrimos?`,
        `Te abro ${caen[0].entidad} —${contraPpto ? "el que más se aleja del plan" : "el que más cae"}— si quieres verlo por dentro.`,
      ]);
      partes.push(oferta);
      /* se declara la CLÁUSULA del puesto (la entidad y su superlativo), no la oración entera: el «para ver qué le pasa a su margen» es la oferta */
      const fragOferta = oferta.includes("—") ? `${caen[0].entidad} —${contraPpto ? "el que más se aleja del plan" : "el que más cae"}—` : `${caen[0].entidad}, ${contraPpto ? "el más lejos del plan" : "el que más cae"}`;
      D.orden({ sujeto: caen[0].entidad, metrica: M_CLI, forma: "min", universo: U_CLI, texto: fragOferta });
      if (!contraPpto) D.variacion({ sujeto: caen[0].entidad, metrica: "Ventas", direccion: "baja", texto: fragOferta });
    } else if (!contraPpto && (caso === "neutra" || caso === "serie")) {
      partes.push(variante(semilla, [
        `Si quieres, te la abro también contra el presupuesto comprometido.`,
        `¿La comparamos también contra el presupuesto? Ese corte está en el dato.`,
        `Te queda pendiente la comparación contra el presupuesto: dime y la traigo.`,
      ]));
    }
    /* LA LEY DEL PORQUÉ (owner 2026-09-09): el paso 3 CIERRA el turno — la oferta de navegación va antes.
     * Medido sobre los ocho lugares que el owner nombró: esta lectura localiza quién cae y cuánto, y lo dice;
     * la causa la tiene él, así que el turno termina preguntándosela. */
    if (esPorQue(pregunta)) partes.push(`¿Sabes qué cambió con ${(caen[0] && caen[0].entidad) || "esas cuentas"}: una negociación, un quiebre de stock, una campaña que no salió, o un competidor?`);
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
  componer({ figs, semilla, pregunta, declarar } = {}) {
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
    /* EL NOTARIO SEMÁNTICO (fase 2): el benchmark es una cifra del negocio; «N SKU venden por debajo» es el conteo que publica el motor,
     * y «por debajo de esa referencia» la relación menor de cada margen publicado contra el benchmark; el orden «de menor margen» se
     * declara sobre el universo REAL del composer —la lista de los SKU cuyo margen publica esta lectura— porque el eje entero no está en
     * la boleta (lo dice el propio texto); cada línea trae su margen de venta y su venta. */
    const D = declaradorDe(declarar);
    const U_SKU = _universo("sku", "SKU");
    const U_PUBLICADOS = bajo.map((x) => x.entidad);
    const partes = [];
    // LA VOZ (2026-09-03): rotular era «Benchmark: X. SKU bajo: N.» — el asesor lo dice en una frase.
    const l0 = `Tu benchmark de margen es ${_val(bench)}, y ${_val(conteo)} SKU venden por debajo de esa referencia.`;
    partes.push(l0);
    D.deFig(bench, l0);
    if (Number.isFinite(n)) D.conteo({ n, predicado: "bajo el benchmark", universo: U_SKU, texto: l0 });
    D.relacion({ sujeto: U_PUBLICADOS, metrica: "Margen", forma: "menor", vs: { sujeto: "negocio", metrica: _lab(bench) }, texto: l0 });
    const cab = `Dónde está la oportunidad (los ${top.length} de menor margen${Number.isFinite(n) && bajo.length < n ? ` — esta lectura publica el margen de ${bajo.length} de los ${_val(conteo)}` : `, de los ${_val(conteo)} bajo el benchmark`}):`;
    partes.push(`\n${cab}`);
    D.orden({ sujeto: top.map((s) => s.entidad), metrica: "Margen", forma: "topk", k: top.length, direccion: "menor", universo: U_PUBLICADOS, texto: cab });
    /* «publica el margen de N de los M» es una cuenta del composer sobre la boleta (cuántos márgenes trae de los M bajo el benchmark):
     * se declara tal cual, aunque la boleta no la cuente */
    if (Number.isFinite(n) && bajo.length < n) D.conteo({ n: bajo.length, m: n, predicado: "con margen publicado en esta lectura", universo: `los ${_val(conteo)} SKU bajo el benchmark`, texto: cab });
    for (const s of top) {
      const vf = venta.get(s.entidad);
      const mf = medida.get(s.entidad);
      /* la medida solo si reconcilia contra la venta del MISMO SKU (ver la cabecera de este playbook) */
      const medidaOk = mf && vf && Number.isFinite(_num(mf)) && Number.isFinite(_num(vf)) && _num(mf) <= _num(vf);
      /* «margen de venta», nunca «margen» a secas: a un SKU el muro le exige decir de CUÁL margen se habla
       * (venta vs inventario) — y el de marginRead es el de venta (las filas de margen del año, no el stock). */
      const l = `- ${s.entidad} · margen de venta ${s.fmt}${vf ? ` · venta ${_val(vf)}` : ""}${medidaOk ? ` · cerrar su brecha al benchmark vale ${_val(mf)}` : ""}`;
      partes.push(l);
      D.cifra({ sujeto: s.entidad, metrica: "Margen", valor: s.fmt, texto: l });
      if (vf) D.cifra({ sujeto: s.entidad, metrica: "Venta", valor: _val(vf), texto: l });
      if (medidaOk) D.cifra({ sujeto: s.entidad, metrica: "Medida cerrar brecha", valor: _val(mf), texto: l });
    }
    partes.push(`\nSi el problema de cada uno es precio o costo no está en esta lectura: no lo afirmo.`);
    const oferta = variante(semilla, [
      `Si quieres, abrimos ${top[0].entidad} —el de menor margen— y vemos su estructura antes de tocar ningún precio. Dime y lo abrimos.`,
      `Antes de tocar ningún precio, ¿abrimos ${top[0].entidad}? Es el de menor margen.`,
      `Te propongo abrir ${top[0].entidad} —el de menor margen— y ver su estructura antes de tocar ningún precio.`,
    ]);
    partes.push(oferta);
    D.orden({ sujeto: top[0].entidad, metrica: "Margen", forma: "min", universo: U_PUBLICADOS, texto: oferta });
    /* LA LEY DEL PORQUÉ: esta lectura no separa costo de precio (lo dice arriba). La otra mitad la tiene él. */
    if (esPorQue(pregunta)) partes.push(`¿Sabes qué mueve ese margen: te subió el costo, cediste precio en una negociación, o cambió la mezcla de lo que se vende?`);
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
