/* === scripts/medicion-anfitrion/informe.mjs · EL INFORME: RASTREO + JUEZ + DECISIÓN HUMANA → VEREDICTO ═══════════════
 * Junta lo que dejó el arnés en `--salida` (manifiesto, cierre, transcritos, consumo), el rastreo determinista (clases 1-2),
 * el juez (clases 3-4, solo si hubo) y las decisiones de la persona (`revision.json`) → bruto / real · por clase · por forma
 * (A-B-C) · errores materiales · cruces entre empresas · invalidaciones · consumo · huellas y hashes → PASA / NO PASA, con la
 * regla del diseño §6 escrita en el propio informe. La estructura (bruto vs real, clases A-B-C, fallas del medidor) sigue el
 * informe de la etapa 1.
 *
 * `revision.json` = { decisiones: { "<id de afirmación>": { veredicto: "verdadera"|"falsa", material?: boolean, nota?: string } } }
 *   Una decisión que REVIERTE a la máquina de falsa a verdadera es una FALLA DEL MEDIDOR: no cuenta contra el anfitrión y se
 *   registra. El id es `hilo|sesión|turno|k` (rastreo) o `hilo|sesión|turno|jK` (juez).
 * `clasificacion.json` (formato de los ensayos 3-5, leído por `clasificacion.mjs`) = la revisión humana COMPLETA: marcas (V · H-correcta · H-leve · H-grave · A), hallazgos en palabras y candidatos a error de ADI; manda sobre la máquina y sobre `revision.json`.
 * Sin ninguno de los dos el veredicto es PROVISIONAL. La regla de cierre (2026-10-07) vive en `REGLA_DE_CIERRE`; sus parámetros (`afirmacionesPorError`, `minRepeticiones`, `incluirLevesEnElPatron`, `umbralDeCumplimientoPct`) en `PARAMETROS_DE_CIERRE`.
 * NADA de acá llama a un modelo ni a la red. */
import { readFileSync, writeFileSync, existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { rastrearHilo, VEREDICTOS_FALSOS, VEREDICTOS_PARA_REVISAR, CASOS_DEL_CONTRATO } from "./rastreo.mjs";
import { resumenDeCorrida } from "../../src/adi/llm/consumo.js";
import { leerClasificacion, familiaDeError, FAMILIA_DEL_VEREDICTO, patronesSistematicos, limiteDeErrores, PARAMETROS_DE_CIERRE } from "./clasificacion.mjs";

/* LA REGLA DE CIERRE (owner 2026-10-07 · reemplaza «0 errores materiales del anfitrión»; `_ADI_DISENO_MEDICION_ANFITRION.md` §6):
 *   ADI: 0 errores materiales, duro. Anfitrión: a lo más 1 error material cada 500 afirmaciones empresariales y NINGÚN patrón sistemático repetido. «La meta sigue siendo cero; el límite solo evita atribuirle a ADI errores estocásticos de un
 *   modelo externo.» 0 cruces entre empresas, duro. El cumplimiento del contrato (hecho de ADI ÷ cifras empresariales) se calcula y se informa; su umbral es un PARÁMETRO (por defecto «informativo»: el owner no lo ha vuelto a fijar).
 * (Antes, 2026-10-05: cumplimiento 100 % + 0 errores del anfitrión; una cifra correcta pero calculada por el anfitrión —`fuera_de_contrato`— rompía el 100 %. Hoy NO decide: se informa.) */
export const REGLA_DE_CIERRE = [
  "Pasa la Etapa 2 cuando DOS corridas oficiales a ciegas (catálogos sellados distintos, mismo modelo y vía) dan cada una:",
  "  · 0 errores de ADI (el hecho que el contrato dice que ADI entrega y no entregó; un derivar que rechaza una derivación válida; una frase de la Entrega que indujo el error): duro,",
  "  · a lo más 1 error material del anfitrión cada 500 afirmaciones empresariales (límite = piso de N ÷ 500; con N < 500 el límite es 0; clases 1-3, clase 4 con cifra, incluye conteos y relaciones en palabras). La meta sigue siendo cero: el límite solo evita atribuirle a ADI errores estocásticos de un modelo externo,",
  "  · ningún patrón sistemático repetido: la misma familia de error material (conteo en palabras, relación invertida, dueño distinto, métrica distinta…) en 2 o más errores distintos de la corrida,",
  "  · 0 cruces entre empresas: duro.",
  "Afirmación empresarial = una cifra o relación (en números o en palabras) que el anfitrión dice DE LA EMPRESA: las que el rastreo traza (clases 1-2) y las que juzga el juez (3-4), más los hallazgos en palabras de la revisión humana; NO cuentan las cifras que dijo la PERSONA ni los ejemplos hipotéticos que se le ofrecen («por ejemplo +5 %»).",
  "El cumplimiento del contrato (hecho de ADI ÷ cifras empresariales) y el % de verdad (real y estricta) se calculan y se informan; el umbral del cumplimiento es un parámetro (por defecto: informativo).",
  "Sin la clasificación humana (`clasificacion.json`) ni la revisión (`revision.json`) el veredicto es PROVISIONAL: la máquina no ve los errores dichos con letras.",
  "Invalida una corrida: huella del catálogo rota antes de correr · cambio de modelo o de instrucción a mitad · tope alcanzado antes del 90 % de los turnos ·",
  "sinConteo > 2 % de las llamadas o modelos sin precio (el costo no es verificable) · una corrección de código entre dos mitades · corrida anulada por el chequeo de limpieza (vía cli).",
  "Falla del medidor (el juez o el rastreo marcó falso y la persona lo revierte) no cuenta contra el anfitrión.",
].join("\n");

const _leer = (ruta) => JSON.parse(readFileSync(ruta, "utf8"));
const _id = (h, s, t, k) => `${h}|${s}|${t}|${k}`;

export function cargarSalida(salida) {
  const manifiesto = existsSync(join(salida, "manifiesto.json")) ? _leer(join(salida, "manifiesto.json")) : null;
  const cierre = existsSync(join(salida, "corrida.json")) ? _leer(join(salida, "corrida.json")) : null;
  const dir = join(salida, "transcritos");
  const hilos = existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith(".json")).sort().map((f) => _leer(join(dir, f))) : [];
  const juez = existsSync(join(salida, "juez.json")) ? _leer(join(salida, "juez.json")) : null;
  const revision = existsSync(join(salida, "revision.json")) ? _leer(join(salida, "revision.json")) : null;
  const clasificacion = existsSync(join(salida, "clasificacion.json")) ? _leer(join(salida, "clasificacion.json")) : null;      // la revisión humana completa (formato de los ensayos 3-5)
  const consumoJsonl = join(salida, "consumo.jsonl");
  let repoConsumo = null;
  if (existsSync(consumoJsonl)) {
    const ev = readFileSync(consumoJsonl, "utf8").split("\n").filter((l) => l.trim()).map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
    // la tabla de precios del repo no conoce `claude-sonnet-5-5` y avisa por consola: el aviso es ruido acá (el informe lo declara)
    const _warn = console.warn; console.warn = () => {};
    try { repoConsumo = resumenDeCorrida(ev); } finally { console.warn = _warn; }
  }
  return { manifiesto, cierre, hilos, juez, revision, clasificacion, repoConsumo };
}

const _vacioClase = () => ({ afirmaciones: 0, verdaderas: 0, falsas: 0, materiales: 0 });
const _vacioContrato = () => ({ cifras: 0, hechoDeAdi: 0, fueraDeContrato: { total: 0, derivables: [] }, erroresMateriales: 0, cumplimientoPct: null });
const _cerrarContrato = (c) => { c.cumplimientoPct = c.cifras ? Number(((c.hechoDeAdi / c.cifras) * 100).toFixed(2)) : null; return c; };

/** calcularInforme({ manifiesto, cierre, hilos, juez, revision, clasificacion, repoConsumo, parametros }) → el informe como objeto (puro).
 *  `clasificacion`: el contenido de `clasificacion.json` (la revisión humana completa); manda sobre la máquina y sobre `revision.json` donde se pisan.
 *  `parametros`: { afirmacionesPorError: 500, minRepeticiones: 2, incluirLevesEnElPatron: false, umbralDeCumplimientoPct: null (informativo) } */
export function calcularInforme({ manifiesto, cierre, hilos, juez = null, revision = null, clasificacion = null, repoConsumo = null, parametros = {} }) {
  const P = { ...PARAMETROS_DE_CIERRE, ...parametros };
  const clas = clasificacion ? leerClasificacion(clasificacion) : null;
  const decisiones = { ...((clas && clas.decisiones) || {}), ...((revision && revision.decisiones) || {}) };
  const hayRevisionHumana = Boolean(clas || (revision && Object.keys(revision.decisiones || {}).length));
  const ejemplos = [], marcasConsumidas = new Set(), leves = [], candidatosDeAdi = [];
  let ordinales = 0, correctasDelAnfitrion = 0;
  const porClase = { 1: _vacioClase(), 2: _vacioClase(), 3: _vacioClase(), 4: _vacioClase() };
  const porClaseBruto = { 1: _vacioClase(), 2: _vacioClase(), 3: _vacioClase(), 4: _vacioClase() };
  const porForma = { A: _vacioClase(), B: _vacioClase(), C: _vacioClase() };
  const materiales = [], fallasDelMedidor = [], paraRevisar = [], cruces = [], naturalidad = [], derivaciones = [], declaradasPorLaPersona = [], nombresDeLaPersona = [], erroresDeAdi = [];
  const contrato = _vacioContrato(), contratoPorHilo = {};
  let totalBruto = 0, verdaderasBruto = 0, materialesBruto = 0;
  let total = 0, verdaderas = 0;

  const contar = (clase, forma, esVerdadera, esMaterial, brutoVerdadera, brutoMaterial) => {
    total += 1; if (esVerdadera) verdaderas += 1;
    totalBruto += 1; if (brutoVerdadera) verdaderasBruto += 1; if (brutoMaterial) materialesBruto += 1;
    const sumar = (c, v, m) => { c.afirmaciones += 1; if (v) c.verdaderas += 1; else c.falsas += 1; if (m) c.materiales += 1; };
    sumar(porClase[clase], esVerdadera, esMaterial); sumar(porForma[forma], esVerdadera, esMaterial); sumar(porClaseBruto[clase], brutoVerdadera, brutoMaterial);
  };

  let turnosHechos = 0;
  for (const hilo of hilos) {
    if (hilo.anulado) continue;
    const rastro = rastrearHilo(hilo);
    const delHilo = (contratoPorHilo[hilo.hiloId] = _vacioContrato());
    /* una cifra empresarial más en el contrato (del hilo y del total): su caso FINAL, tras la revisión humana */
    const alContrato = (caso, a, id, turno) => {
      for (const c of [delHilo, contrato]) {
        c.cifras += 1;
        if (caso === "hecho_de_adi") c.hechoDeAdi += 1;
        else if (caso === "fuera_de_contrato") { c.fueraDeContrato.total += 1; c.fueraDeContrato.derivables.push({ id, hilo: hilo.hiloId, turno, oracion: a.oracion || null, token: a.token || null, derivacionQueDebioPedirse: a.derivacionQueDebioPedirse || null }); }
        else c.erroresMateriales += 1;
      }
    };
    hilo.turnos.forEach((t, i) => {
      turnosHechos += 1;
      const r = rastro[i];
      let k = 0;
      for (const a of r.afirmaciones) {
        if (["ignorado"].includes(a.veredicto)) continue;
        k += 1;
        const id = _id(hilo.hiloId, t.sesion, t.turno, k);
        if (decisiones[id]) marcasConsumidas.add(id);
        if (a.declaradoPor === "persona") { declaradasPorLaPersona.push({ id, hilo: hilo.hiloId, turno: `${t.sesion}.${t.turno}`, token: a.token, origen: a.origen, oracion: a.oracion }); continue; }   // la cifra la dijo la PERSONA en el hilo (con su origen): no es de ADI ni la inventó el anfitrión, y NO es una afirmación empresarial del anfitrión
        if (a.veredicto === "ordinal") { ordinales += 1; continue; }      // «el cuarto, Sodimac»: el puesto, no una relación
        if (a.veredicto === "ejemplo") { ejemplos.push({ id, hilo: hilo.hiloId, turno: `${t.sesion}.${t.turno}`, token: a.token, oracion: a.oracion }); continue; }      // un valor de muestra que el anfitrión le ofrece a la persona («por ejemplo +5 %»): tampoco
        if (a.derivacion) derivaciones.push({ id, hilo: hilo.hiloId, turno: `${t.sesion}.${t.turno}`, token: a.token, oracion: a.oracion, operacion: a.derivacion.operacion, operandos: a.derivacion.operandos, descripcion: a.derivacion.descripcion, sobre: a.derivacionQueDebioPedirse ? a.derivacionQueDebioPedirse.sobre : [] });   // una cifra que no traza directo pero es la suma o la diferencia de DOS entregadas: queda a la vista
        const evaluable = a.veredicto === "traza" || VEREDICTOS_FALSOS.has(a.veredicto);
        if (!evaluable) { if (VEREDICTOS_PARA_REVISAR.has(a.veredicto) && !decisiones[id]) paraRevisar.push({ id, hilo: hilo.hiloId, turno: `${t.sesion}.${t.turno}`, ...a }); if (!decisiones[id]) continue; }
        const brutoV = a.veredicto === "traza";
        const brutoM = !brutoV && Boolean(a.material);
        const d = decisiones[id];
        let v = brutoV, m = brutoM;
        /* tres veredictos de la persona: «verdadera» · «falsa» · «error_adi» (la cifra es verdadera y la frase también, pero el hecho FALTÓ o la Entrega indujo el error: es culpa de ADI, no del anfitrión) */
        if (d) { v = d.veredicto === "verdadera" || d.veredicto === "error_adi"; m = v ? false : (d.material != null ? Boolean(d.material) : true); if (!brutoV && v) fallasDelMedidor.push({ id, hilo: hilo.hiloId, turno: `${t.sesion}.${t.turno}`, veredicto: a.veredicto, oracion: a.oracion, nota: d.nota || null }); if (d.veredicto === "error_adi") erroresDeAdi.push({ id, hilo: hilo.hiloId, turno: `${t.sesion}.${t.turno}`, veredicto: a.veredicto, oracion: a.oracion, nota: d.nota || null }); }
        contar(a.clase, hilo.forma, v, m, brutoV, brutoM);
        if (d && v && d.caso === "fuera_de_contrato") correctasDelAnfitrion += 1;      // verdadera, pero la calculó el anfitrión (la «verdad estricta» no la cuenta)
        if (d && !v && !m) leves.push({ id, hilo: hilo.hiloId, familia: familiaDeError(String(d.nota || "").split(" · ")[0]), oracion: a.oracion });      // falsa e inmaterial: se lista; sus repeticiones se informan
        if (a.clase === 1) {   /* el CONTRATO: el caso de esta cifra (el del rastreo, o el que la persona fijó al revisarla) */
          let caso = a.caso || null;
          if (d) caso = d.veredicto === "falsa" ? "error_material" : (CASOS_DEL_CONTRATO.includes(d.caso) ? d.caso : (caso && caso !== "error_material" ? caso : (d.veredicto === "error_adi" ? "fuera_de_contrato" : "hecho_de_adi")));
          if (caso) alContrato(caso, a, id, `${t.sesion}.${t.turno}`);
        }
        if (!v && m) materiales.push({ id, hilo: hilo.hiloId, forma: hilo.forma, turno: `${t.sesion}.${t.turno}`, clase: a.clase, veredicto: a.veredicto, oracion: a.oracion, motivo: a.motivo, revisadoPorPersona: Boolean(d) });
      }
      for (const c of r.cruces) { cruces.push({ hilo: hilo.hiloId, empresa: hilo.empresa, turno: `${t.sesion}.${t.turno}`, nombreAjeno: c.nombre }); }
      for (const fl of r.flags || []) if (fl.tipo === "nombre_ajeno_dicho_por_la_persona") nombresDeLaPersona.push({ hilo: hilo.hiloId, empresa: hilo.empresa, turno: `${t.sesion}.${t.turno}`, nombre: fl.nombre });   // la persona escribió ese nombre: repetirlo no es un cruce
      // juez (clases 3-4)
      const j = juez && juez.turnos && juez.turnos[`${hilo.hiloId}|${t.sesion}|${t.turno}`];
      if (j && j.ok) {
        j.afirmaciones.forEach((a, n) => {
          const id = _id(hilo.hiloId, t.sesion, t.turno, `j${n + 1}`);
          const brutoV = a.veredicto === "verdadera", brutoM = !brutoV && Boolean(a.material);
          const d = decisiones[id];
          let v = brutoV, m = brutoM;
          if (d) { v = d.veredicto === "verdadera" || d.veredicto === "error_adi"; m = v ? false : (d.material != null ? Boolean(d.material) : true); if (!brutoV && v) fallasDelMedidor.push({ id, hilo: hilo.hiloId, turno: `${t.sesion}.${t.turno}`, veredicto: "juez:falsa", oracion: a.texto, nota: d.nota || null }); if (d.veredicto === "error_adi") erroresDeAdi.push({ id, hilo: hilo.hiloId, turno: `${t.sesion}.${t.turno}`, veredicto: "juez:falsa", oracion: a.texto, nota: d.nota || null }); }
          contar(a.clase, hilo.forma, v, m, brutoV, brutoM);
          if (d && !v && !m) leves.push({ id, hilo: hilo.hiloId, familia: familiaDeError(String(d.nota || "").split(" · ")[0]), oracion: a.texto });
          if (!v && m) materiales.push({ id, hilo: hilo.hiloId, forma: hilo.forma, turno: `${t.sesion}.${t.turno}`, clase: a.clase, veredicto: "juez:falsa", oracion: a.texto, motivo: a.motivo, revisadoPorPersona: Boolean(d) });
        });
        if (j.naturalidad) naturalidad.push({ hilo: hilo.hiloId, turno: `${t.sesion}.${t.turno}`, ...j.naturalidad });
      }
    });
  }

  // ── invalidaciones (§6)
  const invalidaciones = [];
  if (!manifiesto) invalidaciones.push("falta el manifiesto de la corrida");
  if (manifiesto) {
    if (manifiesto.sello && manifiesto.sello.ok === false) invalidaciones.push(`huella del catálogo rota antes de correr: ${manifiesto.sello.motivo}`);
    if (manifiesto.corpus && manifiesto.corpus.juguete) invalidaciones.push("corpus de JUGUETE: sirve para probar el arnés, NUNCA para medir");
    // el modelo EFECTIVO (el proveedor puede responder con un snapshot fechado) tiene que ser el mismo en toda la corrida
    let primerModelo = null;
    for (const hilo of hilos) for (const t of hilo.turnos || []) if (!primerModelo && t.hashes && t.hashes.modelo) primerModelo = t.hashes.modelo;
    for (const hilo of hilos) for (const t of hilo.turnos || []) {
      if (t.hashes && (t.hashes.instruccion !== manifiesto.hashes.instruccion || t.hashes.herramientas !== manifiesto.hashes.herramientas || (t.hashes.modelo && primerModelo && t.hashes.modelo !== primerModelo))) { invalidaciones.push(`cambio de modelo o de instrucción a mitad de la corrida (hilo ${hilo.hiloId}, turno ${t.sesion}.${t.turno})`); break; }
    }
    if (cierre) {
      const planeados = cierre.turnosPlaneados || 0;
      if (cierre.motivo === "tope_alcanzado" && planeados && (cierre.turnosHechos || 0) / planeados < 0.9) invalidaciones.push(`tope alcanzado antes del 90 % de los turnos (${cierre.turnosHechos}/${planeados})`);
      if (cierre.motivo === "anulada_por_limpieza") invalidaciones.push(`corrida ANULADA por el chequeo de limpieza (${(cierre.hallazgos || []).slice(0, 3).map((h) => h.regla).join(", ")})`);
      if (cierre.codigoHuellaFinal && manifiesto.hashes.codigo && cierre.codigoHuellaFinal !== manifiesto.hashes.codigo) invalidaciones.push("el código cambió entre el inicio y el cierre de la corrida (una corrección de código entre dos mitades invalida)");
      if (cierre.consumo) {
        if (cierre.consumo.sinConteoPct > 2) invalidaciones.push(`sinConteo ${cierre.consumo.sinConteoPct} % > 2 % de las llamadas: el costo no es verificable`);
        if ((cierre.consumo.modelosSinPrecio || []).length) invalidaciones.push(`modelos sin precio en el contador: ${cierre.consumo.modelosSinPrecio.map((m) => m.modelo).join(", ")} (el costo es INCOMPLETO)`);
      }
    }
  }

  const pctVerdad = total ? Number(((verdaderas / total) * 100).toFixed(2)) : null;
  const pctBruto = totalBruto ? Number(((verdaderasBruto / totalBruto) * 100).toFixed(2)) : null;
  const pctEstricta = total ? Number((((verdaderas - correctasDelAnfitrion) / total) * 100).toFixed(2)) : null;
  const juzgoClases34 = Boolean(juez && juez.turnos && Object.keys(juez.turnos).length);
  _cerrarContrato(contrato); Object.values(contratoPorHilo).forEach(_cerrarContrato);

  /* ── LOS ERRORES DE ADI Y LOS CANDIDATOS (de la clasificación humana: «firme» cuenta; «a decidir» bloquea el cierre hasta que el owner decida) */
  const hiloDe = (id) => String(id || "").split("|")[0];
  for (const kk of (clas ? clas.casosAdi : [])) {
    if (kk.estado === "firme" && !erroresDeAdi.some((e) => e.id === kk.id)) erroresDeAdi.push({ id: kk.id, hilo: hiloDe(kk.id), turno: null, veredicto: "clasificación humana", oracion: kk.tipo, nota: kk.evidencia });
    if (kk.estado === "candidato") candidatosDeAdi.push({ id: kk.id, hilo: hiloDe(kk.id), tipo: kk.tipo, nota: kk.evidencia });
  }

  /* ── LOS ERRORES MATERIALES DEL ANFITRIÓN: una oración falsa y material es UN error (dos cifras malas de la misma oración no son dos); los de la máquina que la persona no revisó cuentan, y se avisa */
  const plano = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "");
  const turnoDeId = (id) => String(id).split("|").slice(0, 3).join("|");
  const errores = [];
  const familiaDeMarca = (m) => { const d = decisiones[m.id]; return d && d.nota ? familiaDeError(String(d.nota).split(" · ")[0]) : (FAMILIA_DEL_VEREDICTO[m.veredicto] || familiaDeError(m.veredicto)); };
  const yaEsta = (turno, oracion) => { const k = plano(oracion); return errores.find((e) => e.turnoId === turno && k && e.clave && (e.clave.includes(k) || k.includes(e.clave))); };
  for (const m of materiales) {
    const turno = turnoDeId(m.id), dup = yaEsta(turno, m.oracion);
    if (dup) { dup.ids.push(m.id); continue; }
    errores.push({ id: m.id, ids: [m.id], turnoId: turno, hilo: m.hilo, forma: m.forma, fuente: String(m.veredicto).startsWith("juez") ? "juez" : "rastreo", familia: familiaDeMarca(m), oracion: m.oracion, clave: plano(m.oracion), revisadoPorPersona: m.revisadoPorPersona });
  }
  const levesRepetidos = [];
  const hallazgosLeves = [...leves];
  for (const h of (clas ? clas.hallazgos : [])) {
    if (h.clase === "H-grave") {
      const dup = yaEsta(h.turnoId, h.oracion);
      if (dup) { dup.ids.push(`${h.turnoId}|palabras`); continue; }
      errores.push({ id: h.turnoId, ids: [h.turnoId], turnoId: h.turnoId, hilo: h.hilo, forma: null, fuente: "palabras", familia: h.familia, oracion: h.oracion, clave: plano(h.oracion), revisadoPorPersona: true });
    } else if (h.clase === "H-leve") hallazgosLeves.push({ id: h.turnoId, hilo: h.hilo, familia: h.familia, oracion: h.oracion });
  }
  for (const p of patronesSistematicos(hallazgosLeves, { minRepeticiones: P.minRepeticiones })) levesRepetidos.push(p);

  const afirmacionesDePalabras = clas ? clas.hallazgos.length : 0;
  const N = total + afirmacionesDePalabras;                                    // las afirmaciones empresariales: lo que el rastreo/juez cuentan + los hallazgos en palabras de la revisión
  const limite = limiteDeErrores(N, P.afirmacionesPorError);
  const nErrores = errores.length;
  const tasaPor500 = N ? Number(((nErrores / N) * P.afirmacionesPorError).toFixed(2)) : null;
  const patrones = patronesSistematicos(errores, { minRepeticiones: P.minRepeticiones });
  const patronesParaVeredicto = P.incluirLevesEnElPatron ? patronesSistematicos([...errores, ...hallazgosLeves], { minRepeticiones: P.minRepeticiones }) : patrones;
  const marcasSinRevisar = materiales.filter((m) => !m.revisadoPorPersona).length;
  const provisional = !hayRevisionHumana || marcasSinRevisar > 0;
  const clasificacionSinMarca = clas ? Object.keys(decisiones).filter((id) => !marcasConsumidas.has(id) && !/\|j\d+$/.test(id)).length : 0;

  const criterios = {
    adi: { errores: erroresDeAdi.length, candidatos: candidatosDeAdi.length, exige: 0, cumple: erroresDeAdi.length === 0 },
    anfitrion: { errores: nErrores, afirmaciones: N, porCadaAfirmaciones: P.afirmacionesPorError, tasaPor500, limite, cumple: nErrores <= limite, nota: N < P.afirmacionesPorError ? `con N = ${N} < ${P.afirmacionesPorError} el límite es 0: cualquier error material del anfitrión reprueba (lectura literal de «máximo 1 cada ${P.afirmacionesPorError}»)` : null },
    patron: { sistematico: patronesParaVeredicto.length > 0, patrones: patronesParaVeredicto, levesRepetidos, incluyeLeves: P.incluirLevesEnElPatron, cumple: patronesParaVeredicto.length === 0 },
    cruces: { n: cruces.length, exige: 0, cumple: cruces.length === 0 },
    cumplimientoDelContrato: { pct: contrato.cumplimientoPct, umbral: P.umbralDeCumplimientoPct, informativo: P.umbralDeCumplimientoPct == null, cumple: P.umbralDeCumplimientoPct == null ? null : (contrato.cumplimientoPct != null && contrato.cumplimientoPct >= P.umbralDeCumplimientoPct) },
  };
  const falla = [];
  if (!criterios.adi.cumple) falla.push(`${criterios.adi.errores} error(es) de ADI (exige 0)`);
  if (!criterios.anfitrion.cumple) falla.push(`${nErrores} error(es) material(es) del anfitrión sobre ${N} afirmaciones (tasa ${tasaPor500} por ${P.afirmacionesPorError}; límite ${limite})`);
  if (!criterios.patron.cumple) falla.push(`patrón sistemático: ${patronesParaVeredicto.map((p) => `${p.familia} ×${p.veces}`).join(", ")}`);
  if (!criterios.cruces.cumple) falla.push(`${cruces.length} cruce(s) entre empresas (exige 0)`);
  if (criterios.cumplimientoDelContrato.cumple === false) falla.push(`cumplimiento del contrato ${contrato.cumplimientoPct} % < umbral ${P.umbralDeCumplimientoPct} %`);
  if (N === 0) falla.push("sin afirmaciones empresariales que medir");
  let veredicto, porQue;
  const resumen = `ADI ${criterios.adi.errores} error(es) · anfitrión ${nErrores} error(es) material(es) sobre ${N} afirmaciones (tasa ${tasaPor500 ?? "—"} por ${P.afirmacionesPorError}; límite ${limite}) · patrón sistemático ${criterios.patron.sistematico ? "SÍ" : "no"} · ${cruces.length} cruce(s) · cumplimiento del contrato ${contrato.cumplimientoPct == null ? "—" : `${contrato.cumplimientoPct} %`} (informativo) · verdad ${pctVerdad} %`;
  if (invalidaciones.length) { veredicto = "INVÁLIDA"; porQue = "la corrida no cuenta (ver invalidaciones)"; }
  else if (!juzgoClases34 && !hayRevisionHumana) { veredicto = "NO CONCLUYENTE"; porQue = "las clases 3-4 no se juzgaron (sin juez) y no hay revisión humana (`clasificacion.json`): el rastreo determinista solo cubre las clases 1-2 y no ve los errores dichos con letras. Revisar la lista de casos para el supervisor."; }
  else if (falla.length) { veredicto = "NO PASA"; porQue = `${falla.join(" · ")} — ${resumen}`; }
  else if (candidatosDeAdi.length) { veredicto = "NO CONCLUYENTE"; porQue = `${candidatosDeAdi.length} candidato(s) a error de ADI sin decidir (${candidatosDeAdi.map((x) => x.id).join(", ")}): el owner decide si lo son — ${resumen}`; }
  else { veredicto = "PASA"; porQue = resumen; }
  if (provisional && (veredicto === "PASA" || veredicto === "NO PASA")) porQue += ` — PROVISIONAL: ${!hayRevisionHumana ? "sin la clasificación humana (`clasificacion.json`) ni `revision.json`" : `${marcasSinRevisar} marca(s) del rastreo sin revisar por la persona`}`;
  if (!juzgoClases34 && hayRevisionHumana && (veredicto === "PASA" || veredicto === "NO PASA")) porQue += " — sin juez: las clases 3-4 las cubre solo la lectura humana";

  const veredictoDetallado = {
    regla: "2026-10-07 · ADI 0 errores · anfitrión ≤ 1 error material cada 500 afirmaciones empresariales y sin patrón sistemático · 0 cruces · cumplimiento del contrato informativo",
    parametros: P, provisional, revisionHumana: hayRevisionHumana, marcasSinRevisar, sinJuez: !juzgoClases34, criterios,
    erroresDeAdi: { firmes: erroresDeAdi.length, candidatos: candidatosDeAdi, lista: erroresDeAdi },
    afirmacionesEmpresariales: { total: N, delRastreoYElJuez: total, delasPalabras: afirmacionesDePalabras, excluidas: { dichasPorLaPersona: declaradasPorLaPersona.length, ejemplosHipoteticos: ejemplos.length, ordinales: ordinales } },
    erroresDelAnfitrion: errores.map((e) => ({ id: e.id, hilo: e.hilo, fuente: e.fuente, familia: e.familia, oracion: e.oracion, revisadoPorPersona: e.revisadoPorPersona })),
    clasificacionSinMarca,
  };

  const consumo = cierre && cierre.consumo ? cierre.consumo : null;
  return {
    corridaId: manifiesto && manifiesto.corridaId, tipo: manifiesto && manifiesto.tipo, via: manifiesto && manifiesto.via, modelo: manifiesto && manifiesto.modelo,
    corpus: manifiesto && manifiesto.corpus, veredicto, provisional, porQue, regla: REGLA_DE_CIERRE, veredictoDetallado,
    verdad: { bruto: { afirmaciones: totalBruto, verdaderas: verdaderasBruto, pct: pctBruto, materiales: materialesBruto }, real: { afirmaciones: total, verdaderas, pct: pctVerdad, materiales: materiales.length }, estricta: { afirmaciones: total, verdaderas: verdaderas - correctasDelAnfitrion, pct: pctEstricta, nota: "no cuenta como verdadera la cifra correcta que calculó el anfitrión (fuera de contrato)" } },
    porClase: { real: porClase, bruto: porClaseBruto }, porForma,
    contrato, contratoPorHilo, erroresDeAdi,
    erroresMateriales: materiales, cruces, derivaciones, declaradasPorLaPersona, ejemplosHipoteticos: ejemplos, nombresDeLaPersona, fallasDelMedidor, paraRevisar, naturalidad,
    clases34Juzgadas: juzgoClases34,
    observaciones: (cierre && Array.isArray(cierre.limpieza) ? cierre.limpieza : []).flatMap((l) => (Array.isArray(l.observaciones) ? l.observaciones : []).map((o) => ({ hilo: l.hilo, sesion: l.sesion, regla: o.regla, herramienta: o.herramienta || null, llamadas: o.llamadas || 1, detalle: o.detalle }))),   /* owner 2026-10-09: lo que el chequeo de limpieza OBSERVÓ sin anular la corrida (una llamada mal dirigida, rechazada sin ejecutar) */
    invalidaciones, turnos: { hechos: turnosHechos, planeados: cierre ? cierre.turnosPlaneados : null, hilos: hilos.length, hilosAnulados: hilos.filter((h) => h.anulado).length },
    consumo, consumoDelRepo: repoConsumo ? { salieron: repoConsumo.salieron, costoUSD: repoConsumo.costoUSD, modelosSinPrecio: repoConsumo.modelosSinPrecio, sinConteo: repoConsumo.sinConteo.total } : null,
    huellas: manifiesto ? { corpusSha256: manifiesto.corpus && manifiesto.corpus.sha256, ...manifiesto.hashes, cli: manifiesto.cli || null } : null,
    cierre,
  };
}

const _pct = (c) => (c.afirmaciones ? `${((c.verdaderas / c.afirmaciones) * 100).toFixed(2)} %` : "—");

/** informeEnMarkdown(informe) → texto legible. */
export function informeEnMarkdown(i) {
  const L = [];
  L.push(`# Informe de la medición con anfitrión · ${i.corridaId || "(sin id)"}`);
  L.push("", `**Veredicto: ${i.veredicto}${i.provisional ? " (PROVISIONAL)" : ""}** — ${i.porQue}`);
  const vd = i.veredictoDetallado;
  if (vd) {
    const c = vd.criterios, mk = (b) => (b === true ? "sí" : b === false ? "**NO**" : "—");
    L.push("", "## Veredicto de cierre (regla del 2026-10-07)", "", "| criterio | resultado | exigencia | cumple |", "|---|---|---|---|");
    L.push(`| errores de ADI | ${c.adi.errores}${c.adi.candidatos ? ` (+ ${c.adi.candidatos} candidato(s) sin decidir)` : ""} | 0 (duro) | ${mk(c.adi.cumple)} |`);
    L.push(`| errores materiales del anfitrión | ${c.anfitrion.errores} | ≤ ${c.anfitrion.limite} (= piso de ${c.anfitrion.afirmaciones} ÷ ${c.anfitrion.porCadaAfirmaciones}) | ${mk(c.anfitrion.cumple)} |`);
    L.push(`| afirmaciones empresariales (N) | ${c.anfitrion.afirmaciones} | — | — |`);
    L.push(`| tasa de errores del anfitrión | ${c.anfitrion.tasaPor500 ?? "—"} por ${c.anfitrion.porCadaAfirmaciones} | ≤ 1 por ${c.anfitrion.porCadaAfirmaciones} | ${mk(c.anfitrion.tasaPor500 == null ? null : c.anfitrion.tasaPor500 <= 1)} |`);
    L.push(`| patrón sistemático | ${c.patron.sistematico ? `SÍ (${c.patron.patrones.map((p) => `${p.familia} ×${p.veces}`).join(", ")})` : "no"} | ninguno | ${mk(c.patron.cumple)} |`);
    L.push(`| cruces entre empresas | ${c.cruces.n} | 0 (duro) | ${mk(c.cruces.cumple)} |`);
    L.push(`| cumplimiento del contrato | ${c.cumplimientoDelContrato.pct == null ? "—" : `${c.cumplimientoDelContrato.pct} %`} | ${c.cumplimientoDelContrato.informativo ? "informativo (el owner no fijó umbral)" : `≥ ${c.cumplimientoDelContrato.umbral} %`} | ${mk(c.cumplimientoDelContrato.cumple)} |`);
    if (c.anfitrion.nota) L.push("", `⚠️ ${c.anfitrion.nota}.`);
    L.push("", `Afirmaciones empresariales: ${vd.afirmacionesEmpresariales.delRastreoYElJuez} del rastreo/juez + ${vd.afirmacionesEmpresariales.delasPalabras} hallazgos en palabras de la revisión humana. Fuera del denominador: ${vd.afirmacionesEmpresariales.excluidas.dichasPorLaPersona} cifras dichas por la persona · ${vd.afirmacionesEmpresariales.excluidas.ejemplosHipoteticos} ejemplos hipotéticos · ${vd.afirmacionesEmpresariales.excluidas.ordinales} ordinales («el cuarto»).`);
    if (c.patron.levesRepetidos.length) L.push("", `Errores leves repetidos (informativo; ${c.patron.incluyeLeves ? "cuentan para el patrón" : "no cuentan para el patrón"}): ${c.patron.levesRepetidos.map((p) => `${p.familia} ×${p.veces}`).join(", ")}.`);
    L.push("", vd.provisional ? `_Veredicto PROVISIONAL: ${vd.revisionHumana ? `${vd.marcasSinRevisar} marca(s) del rastreo sin revisar` : "sin `clasificacion.json` ni `revision.json`"}._` : `_Revisión humana completa${vd.sinJuez ? " (sin juez: las clases 3-4 las cubre solo la lectura humana)" : ""}._`);
    if (vd.clasificacionSinMarca) L.push("", `_${vd.clasificacionSinMarca} decisión(es) de la clasificación ya no tienen marca en el rastreo actual (el medidor cambió desde que se clasificó: eran fallas del medidor o cifras de la persona)._`);
    if (vd.erroresDelAnfitrion.length) { L.push("", `### Errores materiales del anfitrión · ${vd.erroresDelAnfitrion.length}`); for (const e of vd.erroresDelAnfitrion) L.push(`- [${e.id}] ${e.familia} (${e.fuente}) · «${String(e.oracion || "").replace(/^«+|»+$/g, "").slice(0, 140)}»`); }
    if (vd.erroresDeAdi.candidatos.length) { L.push("", "### Candidatos a error de ADI (el owner decide)"); for (const e of vd.erroresDeAdi.candidatos) L.push(`- [${e.id}] ${e.tipo}`); }
  }
  L.push("", `Tipo ${i.tipo} · vía ${i.via} · modelo ${i.modelo} · corpus ${(i.corpus && i.corpus.corpusId) || "?"}${i.corpus && i.corpus.juguete ? " (JUGUETE)" : ""}`);
  L.push("", "⚠️ Ninguna vía es el anfitrión real (Claude.ai / ChatGPT tienen su propio prompt de sistema): se mide la verdad de la prosa de un modelo capaz apoyado en las Entregas de ADI. La certificación por canal real es de la etapa 3.");
  L.push("", "## Verdad", "", "| | afirmaciones | verdaderas | % | errores materiales |", "|---|---|---|---|---|");
  L.push(`| bruto (máquina) | ${i.verdad.bruto.afirmaciones} | ${i.verdad.bruto.verdaderas} | ${i.verdad.bruto.pct ?? "—"} % | ${i.verdad.bruto.materiales} |`);
  L.push(`| real (tras la revisión humana) | ${i.verdad.real.afirmaciones} | ${i.verdad.real.verdaderas} | ${i.verdad.real.pct ?? "—"} % | ${i.verdad.real.materiales} |`);
  if (i.verdad.estricta) L.push(`| estricta (sin lo que el anfitrión calculó por su cuenta) | ${i.verdad.estricta.afirmaciones} | ${i.verdad.estricta.verdaderas} | ${i.verdad.estricta.pct ?? "—"} % | — |`);
  const c = i.contrato || _vacioContrato();
  L.push("", "## El contrato del anfitrión (informativo)", "", "| | cifras | hecho de ADI | fuera de contrato | errores materiales | cumplimiento |", "|---|---|---|---|---|---|");
  L.push(`| total | ${c.cifras} | ${c.hechoDeAdi} | ${c.fueraDeContrato.total} | ${c.erroresMateriales} | ${c.cumplimientoPct == null ? "—" : `${c.cumplimientoPct} %`} |`);
  for (const [h, x] of Object.entries(i.contratoPorHilo || {})) L.push(`| hilo ${h} | ${x.cifras} | ${x.hechoDeAdi} | ${x.fueraDeContrato.total} | ${x.erroresMateriales} | ${x.cumplimientoPct == null ? "—" : `${x.cumplimientoPct} %`} |`);
  L.push("", `## Errores de ADI · ${(i.erroresDeAdi || []).length} (un hecho que el contrato dice que ADI entrega y no entregó, o una frase de la Entrega que indujo el error: cada uno nace como fixture offline rojo antes de re-medir)`);
  for (const e of (i.erroresDeAdi || []).slice(0, 40)) L.push(`- [${e.id}] «${String(e.oracion || "").slice(0, 120)}»${e.nota ? ` — ${e.nota}` : ""}`);
  L.push("", "## Por clase (real)", "", "| clase | afirmaciones | verdaderas | % | falsas | materiales |", "|---|---|---|---|---|---|");
  const nombres = { 1: "1 · Cifra (rastreo)", 2: "2 · Continuidad (rastreo)", 3: "3 · Procedencia (juez)", 4: "4 · Conducta (juez)" };
  for (const k of [1, 2, 3, 4]) { const c = i.porClase.real[k]; L.push(`| ${nombres[k]} | ${c.afirmaciones} | ${c.verdaderas} | ${_pct(c)} | ${c.falsas} | ${c.materiales} |`); }
  if (!i.clases34Juzgadas) L.push("", "_Las clases 3-4 NO se juzgaron (sin juez): los números de arriba son solo de las clases 1-2._");
  L.push("", "## Por forma (real)", "", "| forma | afirmaciones | verdaderas | % | materiales |", "|---|---|---|---|---|");
  for (const f of ["A", "B", "C"]) { const c = i.porForma[f]; L.push(`| ${f} | ${c.afirmaciones} | ${c.verdaderas} | ${_pct(c)} | ${c.materiales} |`); }
  L.push("", `## Cruces entre empresas · ${i.cruces.length}`);
  for (const c of i.cruces.slice(0, 30)) L.push(`- hilo ${c.hilo} (${c.empresa}) turno ${c.turno}: nombra «${c.nombreAjeno}»`);
  L.push("", `## Errores materiales · ${i.erroresMateriales.length}`);
  for (const e of i.erroresMateriales.slice(0, 60)) L.push(`- [${e.id}] clase ${e.clase} · ${e.veredicto} · ${e.oracion ? `«${String(e.oracion).slice(0, 120)}»` : ""} — ${e.motivo || ""}${e.revisadoPorPersona ? " (confirmado por la persona)" : ""}`);
  L.push("", `## Fuera de contrato (correctas) · ${(i.derivaciones || []).length} (cifras que no son un hecho de ADI pero son demostrables con lo entregado: verdaderas —no cuentan como falsas— y rompen el 100 % de cumplimiento; con la derivación que debió pedirse)`);
  for (const d of (i.derivaciones || []).slice(0, 60)) L.push(`- [${d.id}] ${d.descripcion} (${d.operacion}) · «${String(d.oracion || "").slice(0, 100)}»${d.sobre && d.sobre.length ? ` → debió pedir derivar ${d.operacion} sobre ${d.sobre.join(", ")}` : ""}`);
  if ((i.ejemplosHipoteticos || []).length) { L.push("", `## Ejemplos hipotéticos que el anfitrión le ofrece a la persona · ${i.ejemplosHipoteticos.length} (no son afirmaciones sobre la empresa: no cuentan)`); for (const d of i.ejemplosHipoteticos.slice(0, 30)) L.push(`- [${d.id}] «${d.token}» · «${String(d.oracion || "").slice(0, 110)}»`); }
  if ((i.declaradasPorLaPersona || []).length) { L.push("", `## Cifras declaradas por la persona en el hilo · ${i.declaradasPorLaPersona.length} (la dijo ella, no ADI: no se cuentan como cifra inventada; se lista el origen)`); for (const d of i.declaradasPorLaPersona.slice(0, 40)) L.push(`- [${d.id}] «${d.token}» ← ${d.origen} · «${String(d.oracion || "").slice(0, 100)}»`); }
  if ((i.nombresDeLaPersona || []).length) { L.push("", `## Nombres de la otra empresa que escribió la PERSONA · ${i.nombresDeLaPersona.length} (el anfitrión los repite para contestarle o para decir que no están: no es un cruce)`); for (const d of i.nombresDeLaPersona.slice(0, 30)) L.push(`- hilo ${d.hilo} (${d.empresa}) turno ${d.turno}: «${d.nombre}»`); }
  L.push("", `## Fallas del medidor · ${i.fallasDelMedidor.length} (no cuentan contra el anfitrión)`);
  for (const e of i.fallasDelMedidor.slice(0, 30)) L.push(`- [${e.id}] ${e.veredicto} → revertida${e.nota ? `: ${e.nota}` : ""}`);
  L.push("", `## Para revisar por una persona · ${i.paraRevisar.length}`);
  for (const e of i.paraRevisar.slice(0, 40)) L.push(`- [${e.id}] ${e.veredicto} · «${String(e.oracion || e.token || "").slice(0, 120)}»`);
  if ((i.observaciones || []).length) { L.push("", `## Observaciones de la corrida · ${i.observaciones.length} (no anulan: una llamada mal dirigida —el nombre de una acción de ADI sin el prefijo del servidor— que el CLI rechazó sin ejecutar nada; si el anfitrión después le dijo a la persona que la herramienta «no estaba disponible», es un error SUYO que la revisión humana clasifica, no de ADI)`); for (const o of i.observaciones) L.push(`- hilo ${o.hilo} sesión ${o.sesion}: ${o.regla}${o.herramienta ? ` · «${o.herramienta}»` : ""}${o.llamadas > 1 ? ` ×${o.llamadas}` : ""} — ${o.detalle}`); }
  L.push("", `## Invalidaciones · ${i.invalidaciones.length}`);
  for (const x of i.invalidaciones) L.push(`- ${x}`);
  L.push("", "## Turnos", `${i.turnos.hechos} turnos medidos${i.turnos.planeados ? ` de ${i.turnos.planeados} planeados` : ""} · ${i.turnos.hilos} hilos · ${i.turnos.hilosAnulados} anulados`);
  L.push("", "## Consumo");
  if (i.consumo) L.push("```json", JSON.stringify(i.consumo, null, 2), "```");
  else L.push("(sin consumo registrado)");
  if (i.consumoDelRepo) L.push("", `Contador del repo (\`consumo.js\`): ${i.consumoDelRepo.salieron} llamadas · US$ ${Number(i.consumoDelRepo.costoUSD).toFixed(4)} · modelos sin precio en la tabla del repo: ${(i.consumoDelRepo.modelosSinPrecio || []).map((m) => m.modelo).join(", ") || "ninguno"} (el costo oficial es el del contador del arnés, que entiende el caché).`);
  L.push("", "## Huellas y hashes", "```json", JSON.stringify(i.huellas, null, 2), "```");
  L.push("", "## Regla de cierre (§6)", "```", i.regla, "```");
  return L.join("\n");
}

/** casosParaRevisar(hilos, rastros) → la lista que lee el supervisor cuando NO hay juez (ensayo): todo turno cuya expectativa es de
 * las clases 3-4, todo lo que el rastreo marcó (falsas y «para revisar») y todo cruce, con la prosa y las herramientas. */
export function casosParaRevisar(hilos) {
  const casos = [];
  for (const hilo of hilos) {
    if (hilo.anulado) continue;
    const rastro = rastrearHilo(hilo);
    hilo.turnos.forEach((t, i) => {
      const r = rastro[i];
      const motivos = [];
      const tipo = t.espera && t.espera.tipo;
      if (["declaracion", "pregunta_de_perfil", "sin_perfil_responde", "referencia_no_es_criterio", "premisa_falsa", "no_soportado", "ataque", "cruce_de_empresas"].includes(tipo)) motivos.push(`expectativa de clases 3-4 (${tipo}): sin juez, la revisa una persona`);
      for (const a of r.afirmaciones) if (VEREDICTOS_FALSOS.has(a.veredicto) || VEREDICTOS_PARA_REVISAR.has(a.veredicto)) motivos.push(`${a.veredicto}: «${String(a.oracion || a.token || "").slice(0, 100)}»`);
      for (const a of r.afirmaciones) if (a.caso === "fuera_de_contrato") motivos.push(`fuera de contrato (verdadera, pero la calculó el anfitrión): «${String(a.token || "").slice(0, 40)}» · debió pedir ${a.derivacionQueDebioPedirse ? `derivar ${a.derivacionQueDebioPedirse.operacion} sobre ${(a.derivacionQueDebioPedirse.sobre || []).join(", ")}` : "a ADI"}`);
      for (const c of r.cruces) motivos.push(`cruce: nombra «${c.nombre}»`);
      if (t.cierre && t.cierre !== "ok") motivos.push(`el turno cerró como «${t.cierre}»`);
      if (motivos.length) casos.push({ id: `${hilo.hiloId}|${t.sesion}|${t.turno}`, hilo: hilo.hiloId, forma: hilo.forma, empresa: hilo.empresa, tipo, nota: t.espera && t.espera.nota, persona: t.persona, prosa: t.texto, herramientas: (t.llamadas || []).map((l) => l.herramienta), motivos });
    });
  }
  return casos;
}

const casoEnMarkdown = (c) => [
  `### ${c.id} · forma ${c.forma} · ${c.empresa} · ${c.tipo || "?"}`,
  c.nota ? `_Espera:_ ${c.nota}` : null,
  `**Persona:** ${c.persona}`, "",
  "**Anfitrión:**", c.prosa, "",
  `_Herramientas:_ ${c.herramientas.join(", ") || "(ninguna)"}`, "",
  "_Por qué está en la lista:_", ...c.motivos.map((m) => `- ${m}`), "",
].filter((x) => x !== null).join("\n");

/** escribirInforme(salida) → { informe, rutaJson, rutaMd } · lee todo lo de `salida` y deja informe.json e informe.md. */
export function escribirInforme(salida) {
  const informe = calcularInforme(cargarSalida(salida));
  writeFileSync(join(salida, "informe.json"), JSON.stringify(informe, null, 2));
  writeFileSync(join(salida, "informe.md"), informeEnMarkdown(informe));
  const datos = cargarSalida(salida);
  const casos = casosParaRevisar(datos.hilos);
  writeFileSync(join(salida, "casos-para-revisar.json"), JSON.stringify(casos, null, 2));
  writeFileSync(join(salida, "casos-para-revisar.md"), casos.map(casoEnMarkdown).join("\n---\n\n"));
  return { informe, rutaJson: join(salida, "informe.json"), rutaMd: join(salida, "informe.md") };
}

/** cierreDeEtapa(informes) → { pasa, motivo } · DOS corridas oficiales consecutivas, catálogos distintos, cada una PASA. */
export function cierreDeEtapa(informes) {
  const of = informes.filter((i) => i && i.tipo === "oficial");
  if (of.length < 2) return { pasa: false, motivo: "faltan corridas oficiales (hacen falta dos consecutivas)" };
  const [a, b] = of.slice(-2);
  if (a.veredicto !== "PASA" || b.veredicto !== "PASA") return { pasa: false, motivo: `las dos últimas corridas oficiales deben PASAR (${a.veredicto} · ${b.veredicto})` };
  if (a.provisional || b.provisional) return { pasa: false, motivo: "el veredicto de una de las dos corridas es PROVISIONAL (falta la clasificación humana completa)" };
  if (!a.corpus || !b.corpus || a.corpus.corpusId === b.corpus.corpusId || a.corpus.sha256 === b.corpus.sha256) return { pasa: false, motivo: "las dos corridas deben usar catálogos sellados DISTINTOS" };
  if (a.modelo !== b.modelo || a.via !== b.via) return { pasa: false, motivo: "el mismo modelo y la misma vía en las dos mediciones" };
  return { pasa: true, motivo: "dos corridas oficiales consecutivas, catálogos distintos, mismo modelo y vía, cada una PASA" };
}

// CLI: node scripts/medicion-anfitrion/informe.mjs --salida=<dir>   (regenera informe.json/md tras una revisión)
const _a = process.argv.find((x) => x.startsWith("--salida="));
if (_a && process.argv[1] && /informe\.mjs$/.test(process.argv[1])) { const r = escribirInforme(_a.slice(9)); console.log(`${r.informe.veredicto} · ${r.informe.porQue}\n${r.rutaMd}`); }
