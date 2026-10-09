/* === scripts/medicion-anfitrion/comparar-brazos.mjs · EL INFORME COMPARATIVO DEL A/B (`_ADI_DISENO_ALCANCE_DE_LO_ENTREGADO.md` §6.2 y §6.4) ═════════════════
 * Toma N carpetas de corrida (cada una con su manifiesto, sus transcritos y su `clasificacion.json`; el brazo sale del manifiesto) y dice:
 *   · el sobre-alcance por brazo (sumado sobre las repeticiones) con su intervalo de Wilson, por 500 afirmaciones empresariales, por subtipo y por hilo;
 *   · la reducción relativa de B respecto de A, con un intervalo bootstrap por hilo (y, de chequeo, el intervalo de Newcombe de la diferencia absoluta);
 *   · los errores materiales por familia y por brazo;
 *   · el veredicto de la REGLA DE PARADA (§6.4): «familia resuelta» si B reduce el sobre-alcance ≥ umbral (50 % por defecto, parámetro) y el intervalo excluye la no-reducción;
 *     si no, «el residuo es variabilidad del anfitrión: el owner revisa el criterio». Si B reduce pero los materiales que quedan son deslices con la verdad a la vista, se dice (§6.4 iii).
 *
 *   node scripts/medicion-anfitrion/comparar-brazos.mjs [--umbral=50] [--iteraciones=10000] [--semilla=20261009] [--json=<f>] [--aceptar-invalidas] <carpeta> <carpeta> …
 *
 * Rechaza (código 2) lo que haría la comparación engañosa: una corrida sin brazo, sin clasificación humana, de otro corpus (huella sha256 distinta) o de otro código; faltan los dos brazos.
 * La regla de cierre de las corridas oficiales NO se toca: esto decide solo si la familia «alcance implícito» se resolvió como producto. Cero red, cero LLM. */
import { existsSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { cargarSalida, calcularInforme } from "./informe.mjs";
import { wilson, newcombe, reduccionRelativa, veredictoDeLaRegla, FRASE_FAMILIA_RESUELTA, FRASE_RESIDUO } from "./estadistica.mjs";
import { FAMILIA_DESLIZ, esFamiliaDesliz, SUBTIPOS_DE_SOBRE_ALCANCE } from "./clasificacion.mjs";

export const UMBRAL_DE_REDUCCION_POR_DEFECTO = 50;
const por500 = (k, n) => (n ? Number(((k / n) * 500).toFixed(2)) : null);
const pct = (x) => (x == null ? "—" : `${(x * 100).toFixed(1)} %`);

/** resumirCorrida(carpeta) → lo que el comparador necesita de UNA corrida (puro: lee los archivos y calcula el informe). */
export function resumirCorrida(carpeta, { aceptarInvalidas = false } = {}) {
  const errores = [];
  if (!existsSync(carpeta)) return { carpeta, errores: [`la carpeta ${carpeta} no existe`] };
  const datos = cargarSalida(carpeta);
  const inf = calcularInforme(datos);
  const m = datos.manifiesto;
  if (!m) errores.push("falta el manifiesto");
  if (!inf.brazo) errores.push("la corrida no declara su brazo (manifiesto.brazo): es anterior al A/B");
  if (!datos.clasificacion) errores.push("falta `clasificacion.json`: el sobre-alcance lo marca la lectura humana");
  else if (!inf.sobreAlcance || !inf.sobreAlcance.medido) errores.push("el sobre-alcance no se midió");
  if (!aceptarInvalidas && inf.invalidaciones.length) errores.push(`la corrida es INVÁLIDA: ${inf.invalidaciones.slice(0, 2).join(" · ")}`);
  const sa = inf.sobreAlcance && inf.sobreAlcance.medido ? inf.sobreAlcance : null;
  return {
    carpeta, errores, corridaId: inf.corridaId, brazo: inf.brazo, repeticion: m && m.serieAb ? m.serieAb.repeticion : null, serie: m && m.serieAb ? m.serieAb.nombre : null,
    corpusSha256: m && m.corpus ? m.corpus.sha256 : null, codigoSha256: m && m.hashes ? m.hashes.codigo : null, modelo: inf.modelo, veredicto: inf.veredicto,
    N: sa ? sa.N : null, n: sa ? sa.n : null, porSubtipo: sa ? sa.porSubtipo : {}, porHilo: sa ? Object.fromEntries(Object.entries(sa.porHilo).map(([h, x]) => [h, { k: x.n, n: x.N }])) : {},
    materiales: inf.veredictoDetallado.erroresDelAnfitrion.map((e) => ({ id: e.id, hilo: e.hilo, familia: e.familia, esDesliz: esFamiliaDesliz(e.familia) })), nMateriales: inf.veredictoDetallado.criterios.anfitrion.errores,
    patron: inf.veredictoDetallado.criterios.patron.patrones.map((p) => ({ familia: p.familia, veces: p.veces })),
  };
}

/** compararResumenes(resumenes[], { umbralPct, iteraciones, semilla }) → el análisis completo (puro: no toca disco). */
export function compararResumenes(resumenes, { umbralPct = UMBRAL_DE_REDUCCION_POR_DEFECTO, iteraciones = 10000, semilla = 20261009 } = {}) {
  const errores = [], advertencias = [];
  for (const r of resumenes) for (const e of r.errores || []) errores.push(`${r.carpeta}: ${e}`);
  const buenas = resumenes.filter((r) => !(r.errores || []).length);
  const delBrazo = (b) => buenas.filter((r) => r.brazo === b);
  for (const b of ["A", "B"]) if (!delBrazo(b).length) errores.push(`falta al menos una corrida del brazo ${b}`);
  const shas = new Set(buenas.map((r) => r.corpusSha256));
  if (shas.size > 1) errores.push(`las corridas no son del MISMO corpus sellado (${shas.size} huellas sha256 distintas): sin pareo no hay A/B`);
  const codigos = new Set(buenas.map((r) => r.codigoSha256));
  if (codigos.size > 1) errores.push(`las corridas no tienen el mismo CÓDIGO (${codigos.size} huellas distintas): el único cambio entre A y B tiene que ser el brazo`);
  const modelos = new Set(buenas.map((r) => r.modelo));
  if (modelos.size > 1) errores.push(`las corridas no usan el mismo modelo (${[...modelos].join(", ")})`);
  const celdas = new Map();
  for (const r of buenas) { const c = `${r.brazo}·${r.repeticion ?? "?"}`; if (celdas.has(c) && r.repeticion != null) advertencias.push(`la celda ${c} aparece dos veces (${celdas.get(c)} y ${r.corridaId})`); celdas.set(c, r.corridaId); }
  for (const b of ["A", "B"]) if (delBrazo(b).length && delBrazo(b).length !== 2) advertencias.push(`el brazo ${b} trae ${delBrazo(b).length} corrida(s); el diseño pide 2 repeticiones por brazo`);
  if (errores.length) return { ok: false, errores, advertencias };

  const hilosDe = (b) => new Set(delBrazo(b).flatMap((r) => Object.keys(r.porHilo)));
  const hA = hilosDe("A"), hB = hilosDe("B");
  const comunes = [...hA].filter((h) => hB.has(h)).sort();
  if (hA.size !== comunes.length || hB.size !== comunes.length) advertencias.push(`los brazos no tienen los mismos hilos (A ${hA.size}, B ${hB.size}, comunes ${comunes.length}): el bootstrap usa los comunes`);
  const arm = (b) => {
    const rs = delBrazo(b);
    const k = rs.reduce((s, r) => s + r.n, 0), n = rs.reduce((s, r) => s + r.N, 0), w = wilson(k, n);
    const porHilo = Object.fromEntries(comunes.map((h) => [h, rs.reduce((s, r) => ({ k: s.k + ((r.porHilo[h] || {}).k || 0), n: s.n + ((r.porHilo[h] || {}).n || 0) }), { k: 0, n: 0 })]));
    const porSubtipo = Object.fromEntries([...SUBTIPOS_DE_SOBRE_ALCANCE, "sin_subtipo"].map((t) => [t, rs.reduce((s, r) => s + (r.porSubtipo[t] || 0), 0)]).filter(([, c]) => c));
    const materiales = {}; for (const r of rs) for (const e of r.materiales) materiales[e.familia] = (materiales[e.familia] || 0) + 1;
    return { brazo: b, corridas: rs.map((r) => ({ corridaId: r.corridaId, repeticion: r.repeticion, n: r.n, N: r.N, tasaPor500: por500(r.n, r.N), materiales: r.nMateriales, veredicto: r.veredicto })), k, n, tasaPor500: por500(k, n), wilsonPor500: { lo: w.lo == null ? null : Number((w.lo * 500).toFixed(2)), hi: w.hi == null ? null : Number((w.hi * 500).toFixed(2)) }, porSubtipo, porHilo, materialesPorFamilia: materiales, nMateriales: Object.values(materiales).reduce((s, c) => s + c, 0), patrones: rs.flatMap((r) => r.patron.map((p) => ({ ...p, corrida: r.corridaId }))) };
  };
  const A = arm("A"), B = arm("B");
  const red = reduccionRelativa({ A: A.porHilo, B: B.porHilo }, { iteraciones, semilla });
  const nc = newcombe(A.k, A.n, B.k, B.n);
  const regla = veredictoDeLaRegla(red, { umbralPct });
  /* §6.4 (iii): B reduce, pero los materiales que quedan en B son todos deslices con la verdad a la vista → la evidencia de «variabilidad» vale solo para esa familia */
  const familiasB = Object.keys(B.materialesPorFamilia);
  const nota = regla.resuelta && familiasB.length && familiasB.every((f) => f === FAMILIA_DESLIZ)
    ? `B reduce el sobre-alcance, pero TODOS los materiales que quedan en B (${B.nMateriales}) son «${FAMILIA_DESLIZ}»: es variabilidad del anfitrión; el owner revisa el criterio solo para esa familia (§6.4 iii)`
    : null;
  if (red.motivo) advertencias.push(`reducción relativa: ${red.motivo}`);
  return { ok: true, errores, advertencias, A, B, reduccion: red, newcombe: nc, regla, umbralPct, nota, comunes: comunes.length, corpusSha256: [...shas][0], codigoSha256: [...codigos][0], modelo: [...modelos][0], series: [...new Set(buenas.map((r) => r.serie).filter(Boolean))] };
}

/** textoDeLaComparacion(r) → el informe legible. */
export function textoDeLaComparacion(r) {
  const L = [];
  if (!r.ok) { L.push("COMPARACIÓN RECHAZADA", ...r.errores.map((e) => `  ✗ ${e}`)); if (r.advertencias.length) L.push(...r.advertencias.map((a) => `  ! ${a}`)); return L.join("\n"); }
  const { A, B } = r;
  L.push("COMPARACIÓN A/B · sobre-alcance de la entrega");
  L.push(`  corpus sha256 ${String(r.corpusSha256).slice(0, 16)}… · código ${String(r.codigoSha256).slice(0, 16)}… · modelo ${r.modelo}${r.series.length ? ` · serie ${r.series.join(", ")}` : ""} · ${r.comunes} hilos`);
  L.push("", "Sobre-alcance por brazo (sumado sobre las repeticiones; tasa por 500 afirmaciones empresariales; Wilson 95 %)");
  L.push("  brazo  corridas  sobre-alcance  afirmaciones  tasa/500  intervalo/500        materiales");
  for (const X of [A, B]) L.push(`  ${X.brazo}      ${String(X.corridas.length).padEnd(8)}  ${String(X.k).padEnd(13)}  ${String(X.n).padEnd(12)}  ${String(X.tasaPor500 ?? "—").padEnd(8)}  ${`${X.wilsonPor500.lo ?? "—"} – ${X.wilsonPor500.hi ?? "—"}`.padEnd(19)}  ${X.nMateriales}`);
  for (const X of [A, B]) for (const c of X.corridas) L.push(`    · ${X.brazo}${c.repeticion ?? ""} ${c.corridaId}: ${c.n}/${c.N} = ${c.tasaPor500 ?? "—"} por 500 · ${c.materiales} material(es) · ${c.veredicto}`);
  const red = r.reduccion;
  L.push("", "Reducción relativa de B respecto de A  (1 − pB/pA)");
  if (red.reduccion == null) L.push(`  no se define: ${red.motivo}`);
  else L.push(`  ${pct(red.reduccion)}  · intervalo bootstrap por hilo 95 %: ${pct(red.lo)} a ${pct(red.hi)}  (${red.validas} remuestras de hilos, mismo conjunto de hilos en los dos brazos)`);
  L.push(`  chequeo ingenuo, Newcombe sobre la diferencia absoluta pA − pB: ${r.newcombe.diff == null ? "—" : `${(r.newcombe.diff * 500).toFixed(2)} por 500 (${(r.newcombe.lo * 500).toFixed(2)} a ${(r.newcombe.hi * 500).toFixed(2)})`}  — trata cada afirmación como independiente; el veredicto usa el bootstrap por hilo`);
  const tipos = [...new Set([...Object.keys(A.porSubtipo), ...Object.keys(B.porSubtipo)])];
  L.push("", "Por subtipo (cuenta sumada)", "  subtipo        A     B");
  for (const t of tipos) L.push(`  ${t.padEnd(13)}  ${String(A.porSubtipo[t] || 0).padEnd(4)}  ${B.porSubtipo[t] || 0}`);
  if (!tipos.length) L.push("  (ninguno)");
  const hilos = Object.keys(A.porHilo);
  L.push("", "Por hilo (sobre-alcance / afirmaciones, sumado sobre las repeticiones)", "  hilo     A              B");
  for (const h of hilos) L.push(`  ${h.padEnd(7)}  ${`${A.porHilo[h].k}/${A.porHilo[h].n}`.padEnd(13)}  ${B.porHilo[h].k}/${B.porHilo[h].n}`);
  const fams = [...new Set([...Object.keys(A.materialesPorFamilia), ...Object.keys(B.materialesPorFamilia)])];
  L.push("", "Errores materiales del anfitrión por familia (cuenta sumada; el criterio de certificación no cambia)", "  familia                                        A   B");
  for (const f of fams) L.push(`  ${f.padEnd(45)}  ${String(A.materialesPorFamilia[f] || 0).padEnd(2)}  ${B.materialesPorFamilia[f] || 0}${esFamiliaDesliz(f) ? "   (variabilidad del anfitrión: la verdad estaba a la vista)" : ""}`);
  if (!fams.length) L.push("  (ninguno en ningún brazo)");
  L.push("", `REGLA DE PARADA (§6.4): B reduce ≥ ${r.umbralPct} % y el intervalo excluye la no-reducción → «${FRASE_FAMILIA_RESUELTA}»; si no → «${FRASE_RESIDUO}».`);
  L.push(`  reducción ${pct(red.reduccion)} ${r.regla.cumpleUmbral ? "≥" : "<"} ${r.umbralPct} %  ·  límite inferior del intervalo ${pct(red.lo)} ${r.regla.excluyeNoReduccion ? "> 0 (excluye la no-reducción)" : "≤ 0 (NO excluye la no-reducción)"}`);
  L.push(`  VEREDICTO: ${r.regla.frase}`);
  if (r.nota) L.push(`  NOTA: ${r.nota}`);
  if (r.regla.resuelta) L.push("  → se corren las dos corridas oficiales con la regla de cierre vigente, sin tocarla.");
  else L.push("  → el producto no se deforma: no entra una regla por frase ni un juez de prosa; el owner decide el criterio con esta evidencia.");
  if (r.advertencias.length) L.push("", ...r.advertencias.map((a) => `! ${a}`));
  return L.join("\n");
}

/** compararBrazos(carpetas, opciones) → { ...análisis, texto } */
export function compararBrazos(carpetas, opciones = {}) {
  const res = carpetas.map((c) => resumirCorrida(c, { aceptarInvalidas: Boolean(opciones.aceptarInvalidas) }));
  const r = compararResumenes(res, opciones);
  return { ...r, texto: textoDeLaComparacion(r) };
}

// CLI
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  const opt = (n) => { const a = args.find((x) => x.startsWith(`--${n}=`)); return a ? a.slice(n.length + 3) : null; };
  const carpetas = args.filter((x) => !x.startsWith("--"));
  if (!carpetas.length) { console.error("uso: comparar-brazos.mjs [--umbral=50] [--iteraciones=10000] [--semilla=N] [--json=<f>] [--aceptar-invalidas] <carpeta de corrida> …"); process.exit(2); }
  const r = compararBrazos(carpetas, { umbralPct: opt("umbral") != null ? Number(opt("umbral")) : UMBRAL_DE_REDUCCION_POR_DEFECTO, ...(opt("iteraciones") ? { iteraciones: Number(opt("iteraciones")) } : {}), ...(opt("semilla") ? { semilla: Number(opt("semilla")) } : {}), aceptarInvalidas: args.includes("--aceptar-invalidas") });
  console.log(r.texto);
  if (opt("json")) writeFileSync(opt("json"), JSON.stringify({ ...r, texto: undefined }, null, 2));
  process.exit(r.ok ? 0 : 2);
}
