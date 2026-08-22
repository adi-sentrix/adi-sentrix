/* === ingesta/plantilla/validarPlantilla.js · EL PORTERO (v0 · 2026-08-22) =====================================
 *
 * «La ingesta debe ser aburrida, estricta y contractual» (owner, 2026-08-22). Este módulo es la parte aburrida y
 * es la más importante: decide si un archivo entra, y cuando no entra, dice exactamente qué arreglar.
 *
 * NO ADIVINA NADA. No hay sinónimos, no hay parecidos, no hay elección de eje: los títulos son los del contrato o
 * no son. Esa rigidez es la que hace innecesario el modelo en el camino base — con la plantilla, mapear no es una
 * inferencia, es una comparación.
 *
 * LAS SEIS COSAS QUE REVISA, en orden de gravedad:
 *   1. **formato oficial** · la marca y la versión en A1 de `Parametros`. Sin eso no es la plantilla: es un Excel
 *      cualquiera, y aceptarlo sería volver justo al enfoque que se descartó.
 *   2. **columnas calculadas** · si el archivo trae «Margen %» o «Rotación», el archivo se RECHAZA con el mensaje
 *      que dice qué mandar en su lugar. No se ignoran: una columna calculada que se ignora en silencio hace que
 *      el usuario crea que ADI está usando su número, y esa confusión no se descubre nunca.
 *   3. **unidades ambiguas** · un título sin su unidad («Venta» en vez de «Venta (USD)») se trata como
 *      ambigüedad, no como sinónimo. Es la lección de miles-vs-dólares: ante la duda, no se carga.
 *   4. **claves faltantes** · una fila sin cliente, sin SKU o sin período no es una fila incompleta: es una fila
 *      que no se puede atribuir a nadie.
 *   5. **duplicados contradictorios** · misma clave, distinto valor ⇒ bloqueante. Idénticos ⇒ se colapsa y se avisa.
 *   6. **vacíos** · se DECLARAN. Nunca se completan con cero, con el promedio ni con nada.
 */
import { leerLibro } from "../leerLibro.js";
import { FILA_ENCABEZADO, MARCA_PLANTILLA } from "./generarPlantilla.js";
import { HOJAS, PARAMETROS, PLANTILLA_VERSION, columnaProhibida, hojaPorNombre, normalizarTitulo } from "../../config/contract/plantilla.js";

const _txt = (v) => (v === null || v === undefined ? null : String(v).trim() || null);
const _num = (v) => {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : Number(String(v).replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(n) ? n : NaN;   // NaN ⇒ «venía algo y no era número», que no es lo mismo que vacío
};
const ES_PERIODO = /^\d{4}-(0[1-9]|1[0-2])$/;
const ES_FECHA = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

/* validarPlantilla(archivo, { nombreArchivo }) →
 *   { ok, version, parametros, tablas: { Ventas: [filas…] }, bloqueos[], avisos[], hojas[] }
 * Con `ok:false` NO se devuelve ni una fila: un archivo que no cumple el contrato no entrega datos a medias. */
export function validarPlantilla(archivo, { nombreArchivo = "" } = {}) {
  const bloqueos = [], avisos = [], hojasInfo = [];
  const B = (tipo, detalle, extra = {}) => bloqueos.push({ tipo, detalle, ...extra });
  const A = (tipo, detalle, extra = {}) => avisos.push({ tipo, detalle, ...extra });

  let libro;
  try { libro = leerLibro(archivo, { nombreArchivo }); }
  catch (e) { return { ok: false, version: null, parametros: {}, tablas: {}, hojas: [], avisos, bloqueos: [{ tipo: "archivo-ilegible", detalle: (e && e.message) || "no se pudo abrir el archivo" }] }; }

  const porNombre = new Map(libro.hojas.map((h) => [normalizarTitulo(h.nombre), h]));

  /* ── 1 · ¿es la plantilla oficial? ─────────────────────────────────────────────────────────────────────── */
  const hParam = porNombre.get(normalizarTitulo("Parametros"));
  if (!hParam) {
    B("no-es-la-plantilla", "el archivo no trae la hoja «Parametros» — descargá la plantilla oficial y llenala; este flujo no acepta un Excel cualquiera");
    return { ok: false, version: null, parametros: {}, tablas: {}, hojas: [], avisos, bloqueos };
  }
  const a1 = _txt((hParam.matriz[0] || [])[0]);
  const version = a1 && a1.startsWith("PLANTILLA OFICIAL ADI/SENTRIX") ? a1.split("·").pop().trim() : null;
  if (!version) B("no-es-la-plantilla", `la celda A1 de «Parametros» debería decir "${MARCA_PLANTILLA}" y dice ${a1 ? `"${a1}"` : "(vacía)"}`);
  else if (version !== PLANTILLA_VERSION) B("version-distinta", `el archivo es de la plantilla ${version} y este motor espera ${PLANTILLA_VERSION} — bajá la plantilla vigente`);

  /* ── hojas de más o de menos ───────────────────────────────────────────────────────────────────────────── */
  const esperadas = new Set(HOJAS.map((h) => normalizarTitulo(h.nombre)));
  for (const h of libro.hojas) if (!esperadas.has(normalizarTitulo(h.nombre))) B("hoja-de-mas", `la hoja «${h.nombre}» no es parte de la plantilla — sacala o bajá la plantilla vigente`);
  for (const def of HOJAS) if (def.obligatoria && !porNombre.get(normalizarTitulo(def.nombre))) B("hoja-obligatoria-ausente", `falta la hoja «${def.nombre}»: ${def.que}`);

  /* ── 2 · parámetros ────────────────────────────────────────────────────────────────────────────────────── */
  const parametros = {};
  {
    const filas = (hParam.matriz || []).slice(FILA_ENCABEZADO);   // salta la marca y el encabezado
    const leidos = new Map();
    for (const f of filas) { const k = _txt((f || [])[0]); if (k) leidos.set(k, (f || [])[1]); }
    for (const p of PARAMETROS) {
      const bruto = leidos.has(p.clave) ? leidos.get(p.clave) : undefined;
      const v = bruto === undefined || bruto === null || bruto === "" ? null : bruto;
      if (v === null) {
        if (p.obligatorio) B("parametro-obligatorio-ausente", `falta el parámetro «${p.clave}»: ${p.etiqueta}`);
        else A("parametro-ausente", `«${p.clave}» sin declarar — ADI usa su valor general y lo declara en pantalla`, { clave: p.clave });
        continue;
      }
      if (p.tipo === "numero") {
        const n = _num(v);
        if (n === null || Number.isNaN(n)) { B("parametro-no-numerico", `«${p.clave}» tiene "${v}" y se esperaba un número`); continue; }
        parametros[p.clave] = n;
      } else if (p.tipo === "periodo") {
        if (!ES_PERIODO.test(String(v).trim())) { B("periodo-mal-escrito", `«${p.clave}» tiene "${v}" y se esperaba AAAA-MM (por ejemplo 2026-08)`); continue; }
        parametros[p.clave] = String(v).trim();
      } else parametros[p.clave] = _txt(v);
    }
  }

  /* ── 3 · las tablas ────────────────────────────────────────────────────────────────────────────────────── */
  const tablas = {};
  for (const def of HOJAS.filter((h) => h.tipo === "tabla")) {
    const hoja = porNombre.get(normalizarTitulo(def.nombre));
    if (!hoja) { hojasInfo.push({ hoja: def.nombre, presente: false, obligatoria: def.obligatoria, filas: 0 }); continue; }

    const titulos = (hoja.matriz[FILA_ENCABEZADO - 1] || []).map((t) => _txt(t));
    const info = { hoja: def.nombre, presente: true, obligatoria: def.obligatoria, titulos, columnas: [], prohibidas: [], ambiguas: [], filas: 0 };

    // índice título oficial → posición
    const posPorCampo = new Map();
    const vistos = new Set();
    titulos.forEach((t, i) => {
      if (!t) return;
      const prohibida = columnaProhibida(t);
      if (prohibida) {
        info.prohibidas.push(t);
        B("columna-calculada", `«${def.nombre}» trae la columna "${t}": ${prohibida.porque}. Sacala y mandá ${prohibida.enSuLugar} — ADI la calcula.`, { hoja: def.nombre, columna: t });
        return;
      }
      const col = def.columnas.find((c) => c.titulo === t);
      if (col) {
        if (vistos.has(col.campo)) { B("columna-repetida", `«${def.nombre}» trae dos veces la columna "${t}"`, { hoja: def.nombre }); return; }
        vistos.add(col.campo); posPorCampo.set(col.campo, i); info.columnas.push({ campo: col.campo, titulo: t, pos: i });
        return;
      }
      // no es oficial ni prohibida: ¿es una oficial sin su unidad? entonces es AMBIGUA, no un sinónimo
      const casi = def.columnas.find((c) => normalizarTitulo(c.titulo).startsWith(normalizarTitulo(t)) || normalizarTitulo(t).startsWith(normalizarTitulo(c.titulo)));
      if (casi) {
        info.ambiguas.push({ vino: t, esperado: casi.titulo });
        B("unidad-ambigua", `«${def.nombre}» trae "${t}" y la plantilla dice "${casi.titulo}". No se asume la unidad: copiá el encabezado tal cual.`, { hoja: def.nombre, columna: t });
      } else {
        info.prohibidas.push(t);
        B("columna-de-mas", `«${def.nombre}» trae la columna "${t}", que no es parte de la plantilla`, { hoja: def.nombre, columna: t });
      }
    });

    for (const c of def.columnas) if (c.obligatoria && !posPorCampo.has(c.campo)) {
      B("columna-obligatoria-ausente", `«${def.nombre}» no trae la columna obligatoria "${c.titulo}"`, { hoja: def.nombre });
    }

    /* ── filas ──────────────────────────────────────────────────────────────────────────────────────────── */
    const claves = def.columnas.filter((c) => c.clave).map((c) => c.campo);
    const porClave = new Map();
    const filas = [];
    const crudas = (hoja.matriz || []).slice(FILA_ENCABEZADO);
    crudas.forEach((cruda, i) => {
      const nFila = FILA_ENCABEZADO + i + 1;   // número de fila como lo ve el usuario en Excel
      if (!(cruda || []).some((v) => v !== null && v !== undefined && String(v).trim() !== "")) return;   // fila vacía

      const fila = {};
      let rota = false;
      for (const [campo, pos] of posPorCampo) {
        const col = def.columnas.find((c) => c.campo === campo);
        const bruto = (cruda || [])[pos];
        if (bruto === null || bruto === undefined || String(bruto).trim() === "") {
          if (col.obligatoria) { B("celda-obligatoria-vacia", `«${def.nombre}» fila ${nFila}: falta "${col.titulo}"`, { hoja: def.nombre, fila: nFila }); rota = true; }
          else A("celda-vacia", `«${def.nombre}» fila ${nFila}: "${col.titulo}" vino vacía — no se completa con nada`, { hoja: def.nombre, fila: nFila });
          fila[campo] = null; continue;
        }
        if (col.tipo === "numero") {
          const n = _num(bruto);
          if (Number.isNaN(n)) { B("valor-no-numerico", `«${def.nombre}» fila ${nFila}: "${col.titulo}" tiene "${bruto}" y se esperaba un número`, { hoja: def.nombre, fila: nFila }); rota = true; continue; }
          fila[campo] = n;
        } else if (col.tipo === "periodo") {
          const s = String(bruto).trim();
          if (!ES_PERIODO.test(s)) { B("periodo-mal-escrito", `«${def.nombre}» fila ${nFila}: "${col.titulo}" tiene "${s}" y se esperaba AAAA-MM`, { hoja: def.nombre, fila: nFila }); rota = true; continue; }
          fila[campo] = s;
        } else if (col.tipo === "fecha") {
          const s = String(bruto).trim();
          if (!ES_FECHA.test(s)) { B("fecha-mal-escrita", `«${def.nombre}» fila ${nFila}: "${col.titulo}" tiene "${s}" y se esperaba AAAA-MM-DD`, { hoja: def.nombre, fila: nFila }); rota = true; continue; }
          fila[campo] = s;
        } else fila[campo] = _txt(bruto);
      }
      if (rota) return;

      // 4 · clave completa
      if (claves.some((k) => fila[k] === null || fila[k] === undefined)) {
        B("clave-incompleta", `«${def.nombre}» fila ${nFila}: la fila no se puede atribuir (falta parte de la clave ${claves.join(" + ")})`, { hoja: def.nombre, fila: nFila });
        return;
      }
      // 5 · duplicados
      const k = claves.map((c) => fila[c]).join(" ⋅ ");
      const previa = porClave.get(k);
      if (previa) {
        if (JSON.stringify(previa.fila) === JSON.stringify(fila)) {
          A("fila-duplicada-identica", `«${def.nombre}» fila ${nFila}: repite la fila ${previa.n} con los mismos valores — se colapsa`, { hoja: def.nombre, fila: nFila });
        } else {
          B("duplicado-contradictorio", `«${def.nombre}»: las filas ${previa.n} y ${nFila} tienen la misma clave (${k}) y valores distintos — no hay forma de elegir sin inventar`, { hoja: def.nombre, fila: nFila });
        }
        return;
      }
      porClave.set(k, { fila, n: nFila });
      filas.push(fila);
    });

    info.filas = filas.length;
    hojasInfo.push(info);
    tablas[def.nombre] = filas;
  }

  const ok = bloqueos.length === 0;
  return { ok, version, parametros: ok ? parametros : {}, tablas: ok ? tablas : {}, hojas: hojasInfo, bloqueos, avisos };
}
