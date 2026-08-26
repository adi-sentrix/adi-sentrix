/* === ingesta/plantilla/validarPlantilla.js · EL PORTERO (v1 · 2026-08-22) =====================================
 *
 * «La ingesta debe ser aburrida, estricta y contractual» (owner). Este módulo decide si un archivo entra, y
 * cuando no entra dice exactamente qué arreglar.
 *
 * NO ADIVINA NADA. No hay sinónimos ni parecidos: los títulos son los del contrato o no son. Esa rigidez es la que
 * hace innecesario el modelo en el camino base — con la plantilla, mapear no es una inferencia, es una comparación.
 *
 * LAS SIETE COSAS QUE REVISA, en orden de gravedad:
 *   1. **formato oficial** · la marca y la versión en A1 de `Ventas`. Sin eso no es la plantilla.
 *   2. **columnas calculadas** · «Margen %» o «Contribución» RECHAZAN el archivo, con el mensaje que dice qué
 *      mandar en su lugar. Ignorarlas en silencio haría creer al usuario que ADI está usando su número.
 *      ⚠️ «Rotación» y «Días de inventario» YA NO están en esa lista (owner 2026-08-22): pasaron a columnas
 *      OPCIONALES, porque no son un KPI que le pedimos calcular al usuario sino un dato que su ERP puede tener —
 *      y si lo tiene, manda. Ver la regla «informado manda, calculado rellena» en sentrix/diasYRotacion.js.
 *   3. **títulos parecidos** · «Venta (miles)» no es «Venta», y un plural tampoco. No se aceptan como equivalentes:
 *      adivinar cuál quiso decir es la lección de miles-contra-dólares.
 *   4. **claves faltantes** · una fila sin cuenta, sin SKU o sin período no es incompleta: es inatribuible.
 *   5. **duplicados contradictorios** · misma clave, distinto valor ⇒ bloquea. Idénticos ⇒ colapsa y avisa.
 *   6. **atributos incoherentes** · el precio de haber colapsado los maestros en columnas: el mismo SKU con dos
 *      marcas distintas. No se elige una — se nombran las dos filas y se rechaza.
 *   7. **vacíos** · se DECLARAN. Nunca se completan con cero, con el promedio ni con nada.
 */
import { leerLibro } from "../leerLibro.js";
import { HOJAS, PARAMETROS, COHERENCIA, PLANTILLA_VERSION, columnaProhibida, normalizarTitulo, HOJA_EMPRESA, HOJA_EJEMPLO } from "../../config/contract/plantilla.js";

const _txt = (v) => (v === null || v === undefined ? null : String(v).trim() || null);
const _num = (v) => {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : Number(String(v).replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(n) ? n : NaN;   // NaN ⇒ «venía algo y no era número», distinto de vacío
};
const ES_PERIODO = /^\d{4}-(0[1-9]|1[0-2])$/;
const ES_FECHA = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

/** La fila del encabezado: la primera cuya primera celda es el título de la primera columna. Se BUSCA, no se
 *  cuenta — así agregar un parámetro a la cabecera mañana no corre nada ni rompe el validador. */
function filaEncabezado(matriz, def) {
  const buscado = normalizarTitulo(def.columnas[0].titulo);
  for (let i = 0; i < matriz.length; i++) if (normalizarTitulo((matriz[i] || [])[0]) === buscado) return i;
  return -1;
}

/* validarPlantilla(archivo, { nombreArchivo }) →
 *   { ok, version, parametros, tablas, hojas, bloqueos[], avisos[] }
 * Con `ok:false` NO devuelve ni una fila: un archivo que no cumple el contrato no entrega datos a medias. */
export function validarPlantilla(archivo, { nombreArchivo = "" } = {}) {
  const bloqueos = [], avisos = [], hojasInfo = [];
  const B = (tipo, detalle, extra = {}) => bloqueos.push({ tipo, detalle, ...extra });
  const A = (tipo, detalle, extra = {}) => avisos.push({ tipo, detalle, ...extra });
  const vacio = { ok: false, version: null, parametros: {}, tablas: {}, hojas: [], avisos, bloqueos };

  let libro;
  try { libro = leerLibro(archivo, { nombreArchivo }); }
  catch (e) { return { ...vacio, bloqueos: [{ tipo: "archivo-ilegible", detalle: (e && e.message) || "no se pudo abrir el archivo" }] }; }

  const porNombre = new Map(libro.hojas.map((h) => [normalizarTitulo(h.nombre), h]));

  /* ── 1 · ¿es la plantilla oficial? ─────────────────────────────────────────────────────────────────────── */
  const hMarca = porNombre.get(normalizarTitulo(HOJA_EMPRESA));
  if (!hMarca) {
    B("no-es-la-plantilla", `el archivo no trae la hoja «${HOJA_EMPRESA}» — descargá la plantilla oficial y llenala; este flujo no acepta un Excel cualquiera`);
    return vacio;
  }
  const a1 = _txt((hMarca.matriz[0] || [])[0]);
  const version = a1 && a1.startsWith("PLANTILLA OFICIAL ADI/SENTRIX") ? a1.split("·").pop().trim() : null;
  if (!version) { B("no-es-la-plantilla", `la celda A1 de «${HOJA_EMPRESA}» debería identificar la plantilla oficial y dice ${a1 ? `"${a1}"` : "(vacía)"} — descargá la plantilla vigente`); return vacio; }
  if (version !== PLANTILLA_VERSION) { B("version-distinta", `el archivo es de la plantilla ${version} y este motor espera ${PLANTILLA_VERSION} — bajá la plantilla vigente y volvé a llenarla`); return { ...vacio, version }; }

  /* Las hojas que el libro puede traer: las de datos, la de la empresa y la de ejemplo (que es solo para mirar
   * y el validador NO lee). Cualquier otra se reporta: una hoja de más suele ser una copia vieja olvidada. */
  const esperadas = new Set([...HOJAS.map((h) => normalizarTitulo(h.nombre)), normalizarTitulo(HOJA_EMPRESA), normalizarTitulo(HOJA_EJEMPLO)]);
  for (const h of libro.hojas) if (!esperadas.has(normalizarTitulo(h.nombre))) B("hoja-de-mas", `la hoja «${h.nombre}» no es parte de la plantilla — sacala`);
  for (const def of HOJAS) if (def.obligatoria && !porNombre.get(normalizarTitulo(def.nombre))) B("hoja-obligatoria-ausente", `falta la hoja «${def.nombre}»: ${def.que}`);

  /* ── 2 · los datos de la empresa · HOJA PROPIA ────────────────────────────────────────────────────────────
   * Owner 2026-08-26: «si vas a pedir datos de la empresa déjalo en una pestaña sola, para que no se mezcle con
   * la de datos ventas o inventario». Antes vivían arriba de la tabla de Ventas: el usuario abría el archivo y
   * no sabía dónde terminaba la configuración y empezaban los datos.
   *
   * SE LEE POR LA ETIQUETA QUE VE EL USUARIO, y también por la clave interna. En la hoja va el nombre en
   * castellano porque pedirle a un gerente que llene una celda rotulada `periodo_actual` es pedirle que adivine.
   * La clave se sigue aceptando para no romper un archivo que alguien haya armado a mano. */
  const hEmpresa = porNombre.get(normalizarTitulo(HOJA_EMPRESA));
  const parametros = {};
  if (!hEmpresa) {
    B("hoja-empresa-ausente", `falta la hoja «${HOJA_EMPRESA}»: ahí van el nombre de tu empresa y el período que estás informando`, { hoja: HOJA_EMPRESA });
  } else {
    const leidos = new Map();
    for (const f of hEmpresa.matriz) { const k = _txt((f || [])[0]); if (k) leidos.set(normalizarTitulo(k), (f || [])[1]); }
    const buscar = (p) => {
      for (const forma of [p.etiqueta, p.clave]) { const k = normalizarTitulo(forma); if (leidos.has(k)) return leidos.get(k); }
      return undefined;
    };
    for (const p of PARAMETROS) {
      const bruto = buscar(p);
      const v = bruto === undefined || bruto === null || bruto === "" ? null : bruto;
      if (v === null) {
        if (p.obligatorio) B("parametro-obligatorio-ausente", `falta «${p.etiqueta}» en la hoja ${HOJA_EMPRESA}`, { hoja: HOJA_EMPRESA });
        else A("parametro-ausente", `«${p.clave}» sin declarar — ADI usa su valor general y lo dice en pantalla`, { clave: p.clave });
        continue;
      }
      if (p.tipo === "numero") {
        const n = _num(v);
        if (n === null || Number.isNaN(n)) { B("parametro-no-numerico", `«${p.clave}» tiene "${v}" y se esperaba un número`); continue; }
        parametros[p.clave] = n;
      } else if (p.tipo === "fecha") {
        const s = String(v).trim();
        if (!ES_FECHA.test(s)) { B("fecha-mal-escrita", `«${p.etiqueta}» tiene "${v}" y se esperaba AAAA-MM-DD (por ejemplo 2026-08-31)`, { hoja: HOJA_EMPRESA }); continue; }
        parametros[p.clave] = s;
      } else if (p.tipo === "periodo") {
        if (!ES_PERIODO.test(String(v).trim())) { B("periodo-mal-escrito", `«${p.clave}» tiene "${v}" y se esperaba AAAA-MM (por ejemplo 2026-08)`); continue; }
        parametros[p.clave] = String(v).trim();
      } else parametros[p.clave] = _txt(v);
    }
  }
  /* ── 3 · las tablas ────────────────────────────────────────────────────────────────────────────────────── */
  const tablas = {};
  for (const def of HOJAS) {
    const hoja = porNombre.get(normalizarTitulo(def.nombre));
    if (!hoja) { hojasInfo.push({ hoja: def.nombre, presente: false, obligatoria: def.obligatoria, filas: 0 }); continue; }

    const iEnc = filaEncabezado(hoja.matriz, def);
    if (iEnc < 0) {
      B("encabezado-no-encontrado", `en «${def.nombre}» no se encuentra la fila de encabezados (debería empezar con "${def.columnas[0].titulo}") — no modifiques los títulos de la plantilla`, { hoja: def.nombre });
      hojasInfo.push({ hoja: def.nombre, presente: true, obligatoria: def.obligatoria, filas: 0, titulos: [] });
      continue;
    }

    const titulos = (hoja.matriz[iEnc] || []).map((t) => _txt(t));
    const info = { hoja: def.nombre, presente: true, obligatoria: def.obligatoria, titulos, columnas: [], prohibidas: [], ambiguas: [], filas: 0 };

    const posPorCampo = new Map(); const vistos = new Set();
    titulos.forEach((t, i) => {
      if (!t) return;
      const prohibida = columnaProhibida(t);
      if (prohibida) { info.prohibidas.push(t); B("columna-calculada", `«${def.nombre}» trae la columna "${t}": ${prohibida.porque}. Sacala y mandá ${prohibida.enSuLugar} — ADI la calcula.`, { hoja: def.nombre, columna: t }); return; }
      const col = def.columnas.find((c) => c.titulo === t);
      if (col) {
        if (vistos.has(col.campo)) { B("columna-repetida", `«${def.nombre}» trae dos veces la columna "${t}"`, { hoja: def.nombre }); return; }
        vistos.add(col.campo); posPorCampo.set(col.campo, i); info.columnas.push({ campo: col.campo, titulo: t, pos: i }); return;
      }
      const casi = def.columnas.find((c) => normalizarTitulo(c.titulo).startsWith(normalizarTitulo(t)) || normalizarTitulo(t).startsWith(normalizarTitulo(c.titulo)));
      if (casi) { info.ambiguas.push({ vino: t, esperado: casi.titulo }); B("unidad-ambigua", `«${def.nombre}» trae "${t}" y la plantilla dice "${casi.titulo}". Un título parecido NO se acepta como equivalente —"Venta (miles)" y "Venta" no son lo mismo— y adivinar cuál quiso decir es exactamente el error de miles-contra-dólares. Copiá el encabezado tal cual.`, { hoja: def.nombre, columna: t }); }
      else { info.prohibidas.push(t); B("columna-de-mas", `«${def.nombre}» trae la columna "${t}", que no es parte de la plantilla`, { hoja: def.nombre, columna: t }); }
    });

    for (const c of def.columnas) if (c.obligatoria && !posPorCampo.has(c.campo)) B("columna-obligatoria-ausente", `«${def.nombre}» no trae la columna obligatoria "${c.titulo}"`, { hoja: def.nombre });

    /* filas */
    /* LA CLAVE SE ARMA CON LAS COLUMNAS QUE EL ARCHIVO TRAE, no con las que el contrato podría tener.
     * «Bodega» es clave y a la vez opcional: el que la manda obtiene la lectura fina (el ritmo de venta se mide
     * por SKU y bodega), y el que no la manda debe poder cargar igual, agregado al total del SKU. Exigirla para
     * armar la clave rechazaba TODAS las filas de un archivo por lo demás correcto — el caso mínimo, que es
     * justamente el cliente que llena lo justo. Se declara el efecto en un aviso: caer al total es una decisión
     * que el usuario tiene que ver, no un silencio. */
    const claves = def.columnas.filter((c) => c.clave && posPorCampo.has(c.campo)).map((c) => c.campo);
    for (const c of def.columnas) {
      if (c.clave && !c.obligatoria && !posPorCampo.has(c.campo)) {
        A("clave-mas-gruesa", `«${def.nombre}» no trae "${c.titulo}": se puede cargar igual, pero todo queda agregado al total y no se puede abrir por ${c.titulo.toLowerCase()}`, { hoja: def.nombre, columna: c.titulo });
      }
    }
    const porClave = new Map(); const filas = []; const vaciasPorColumna = {};
    (hoja.matriz || []).slice(iEnc + 1).forEach((cruda, i) => {
      const nFila = iEnc + i + 2;   // número de fila como lo ve el usuario en Excel
      if (!(cruda || []).some((v) => v !== null && v !== undefined && String(v).trim() !== "")) return;

      const fila = { _fila: nFila }; let rota = false;
      for (const [campo, pos] of posPorCampo) {
        const col = def.columnas.find((c) => c.campo === campo);
        const bruto = (cruda || [])[pos];
        if (bruto === null || bruto === undefined || String(bruto).trim() === "") {
          if (col.obligatoria) { B("celda-obligatoria-vacia", `«${def.nombre}» fila ${nFila}: falta "${col.titulo}"`, { hoja: def.nombre, fila: nFila }); rota = true; }
          /* ⚠️ UNA COLUMNA OPCIONAL VACÍA NO SE AVISA POR FILA (2026-08-26). Antes salía un aviso por cada
           * celda: con «punto de venta» opcional —que la mitad de los clientes deja vacío por definición— eso
           * eran diez avisos idénticos que enterraban a los que sí importan. Se cuenta acá y se avisa UNA vez
           * por columna al final, diciendo qué es lo que ADI no va a poder responder. */
          else if (!col.laCalculaAdi) (vaciasPorColumna[campo] = (vaciasPorColumna[campo] || 0) + 1);
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

      /* EL MES SE DERIVA DEL DÍA (owner 2026-08-26): la hoja pide la fecha completa —«no importa que no
       * ocupemos [el día], pero debe estar por si lo necesitamos»— y todo lo que compara períodos trabaja por
       * mes. Se deriva acá, en el borde, para que el motor siga agrupando por `periodo` sin enterarse: el día
       * queda guardado en la fila para cuando haga falta. */
      if (fila.fecha && fila.periodo === undefined) fila.periodo = String(fila.fecha).slice(0, 7);

      /* ⚠️ UNA CLAVE OPCIONAL PUEDE VENIR VACÍA, y eso NO es una fila inatribuible (2026-08-26). Cuando el
       * «punto de venta» pasó a ser columna opcional, exigirlo lleno rechazaba a todo cliente que no tiene
       * sucursales — la mitad de los casos. Un vacío ahí significa «esta venta no se atribuye a ninguna
       * sucursal», que es un valor legítimo y distinto de cualquier sucursal concreta. Lo que sigue siendo
       * inatribuible es una fila sin su clave OBLIGATORIA: sin cliente o sin SKU no hay a quién sumarle. */
      const clavesDuras = claves.filter((k) => (def.columnas.find((c) => c.campo === k) || {}).obligatoria);
      if (clavesDuras.some((k) => fila[k] === null || fila[k] === undefined)) {
        B("clave-incompleta", `«${def.nombre}» fila ${nFila}: la fila no se puede atribuir (falta ${clavesDuras.filter((k) => fila[k] === null || fila[k] === undefined).join(" y ")})`, { hoja: def.nombre, fila: nFila });
        return;
      }
      const k = claves.map((c) => fila[c] ?? "").join(" ⋅ ");   // el vacío es un valor de clave, no un hueco
      const previa = porClave.get(k);
      if (previa) {
        const igual = JSON.stringify({ ...previa.fila, _fila: 0 }) === JSON.stringify({ ...fila, _fila: 0 });
        if (igual) A("fila-duplicada-identica", `«${def.nombre}» fila ${nFila}: repite la fila ${previa.fila._fila} con los mismos valores — se colapsa`, { hoja: def.nombre, fila: nFila });
        else B("duplicado-contradictorio", `«${def.nombre}»: las filas ${previa.fila._fila} y ${nFila} tienen la misma clave (${k}) y valores distintos — no hay forma de elegir sin inventar`, { hoja: def.nombre, fila: nFila });
        return;
      }
      porClave.set(k, { fila }); filas.push(fila);
    });

    /* EL TRATO CON LAS OPCIONALES, dicho una vez y con su consecuencia (owner 2026-08-26): «si el usuario no
     * llena ese campo, ADI solo no responderá sobre eso». Se distingue la columna ENTERAMENTE vacía —que sí
     * apaga una lectura— de la que viene a medias, donde el dato existe para unas filas y no para otras. */
    for (const [campo, n] of Object.entries(vaciasPorColumna)) {
      const col = def.columnas.find((c) => c.campo === campo);
      if (!col) continue;
      const todas = n >= filas.length && filas.length > 0;
      A("columna-opcional-vacia", todas
        ? `«${def.nombre}»: "${col.titulo}" quedó vacía en todas las filas — el archivo entra igual, pero ADI no va a poder responder sobre ${col.titulo.toLowerCase()}`
        : `«${def.nombre}»: "${col.titulo}" viene vacía en ${n} de ${filas.length} filas — esas quedan sin ${col.titulo.toLowerCase()}, no se completan con nada`,
        { hoja: def.nombre, columna: col.titulo, filas: n });
    }

    info.filas = filas.length;
    hojasInfo.push(info);
    tablas[def.nombre] = filas;
  }

  /* ── 6 · coherencia de los atributos repetidos ─────────────────────────────────────────────────────────── */
  for (const regla of COHERENCIA) {
    const filas = tablas[regla.hoja] || [];
    const visto = new Map();   // clave → { atributo → { valor, fila } }
    for (const f of filas) {
      const id = f[regla.clave];
      if (id === null || id === undefined) continue;
      if (!visto.has(id)) visto.set(id, {});
      const acc = visto.get(id);
      for (const attr of regla.atributos) {
        const v = f[attr];
        if (v === null || v === undefined) continue;
        if (!(attr in acc)) { acc[attr] = { valor: v, fila: f._fila }; continue; }
        if (String(acc[attr].valor) !== String(v)) {
          B("atributo-incoherente", `«${regla.hoja}»: el ${regla.entidad} "${id}" tiene "${attr}" = ${JSON.stringify(acc[attr].valor)} en la fila ${acc[attr].fila} y ${JSON.stringify(v)} en la fila ${f._fila} — no se elige una: corregí el archivo`,
            { hoja: regla.hoja, fila: f._fila });
        }
      }
    }
  }

  const ok = bloqueos.length === 0;
  if (ok) for (const t of Object.values(tablas)) for (const f of t) delete f._fila;
  return { ok, version, parametros: ok ? parametros : {}, tablas: ok ? tablas : {}, hojas: hojasInfo, bloqueos, avisos };
}
