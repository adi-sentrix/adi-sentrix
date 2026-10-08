/* === src/adi/capacidad/formaDelEncargo.js · LA FORMA DEL ENCARGO ANTES DE VALIDARLO (Etapa 2, medición con anfitrión · ensayo 2 · owner 2026-10-05) ═══════════
 * Lo que mostró el ensayo 2: cuando el anfitrión mandaba `entidades: ["Jumbo","Lider"]` (cadenas sueltas, y no `[{nombre:"Jumbo"},…]`) o `criterio: "credito"` (una cadena, y no `{lente:"credito"}`),
 * el validador del Encargo contestaba «entidad_inexistente» / «criterio_desconocido» para cuentas y lentes que EXISTEN — y el anfitrión le dijo al usuario «Hites no existe como cliente».
 * Un problema de FORMA se declaraba como un problema del VALOR. Ley del owner: ADI no culpa a la entidad por un problema de forma.
 *
 * QUÉ HACE (puro, sin I/O, sin Core, sin leer lenguaje): ANTES de `validarEncargo`, en la capa de la capacidad —`encargo/*` sigue congelado—:
 *   (a) una cadena suelta donde el contrato pide una lista se lee como la lista de UN elemento, y una cadena donde el contrato pide un objeto se lee como el objeto de su único campo
 *       (`entidades: "Jumbo"` · `entidades: ["Jumbo"]` → `[{nombre:"Jumbo"}]`; `criterio: "credito"` → `{lente:"credito"}`; `conceptos: "ventas"` → `["ventas"]`; `supuestos: "s1"` → `["s1"]`).
 *       Solo cuando la lectura es única: no hay otra manera de leer una cadena como entidad que su nombre, ni como criterio que su lente. Lo que ocurra después con el VALOR (la cuenta no existe, la lente no
 *       existe) lo dice el validador de siempre, con su motivo de siempre.
 *   (b) lo que NO se puede leer sin adivinar (un elemento de `entidades` que no es un nombre ni un objeto con `nombre`; un `criterio` que no es una lente ni una referencia) NO pasa al validador: se
 *       declara `formato_invalido` —con el campo, lo que llegó y la forma que se esperaba— y NUNCA «la entidad no existe» ni «criterio desconocido». No se corre con lo que alcanzó a leerse: una cuenta
 *       dejada fuera cambiaría el alcance de la consulta en silencio.
 * Lo bien formado pasa IDÉNTICO (misma referencia de objeto: cero diferencia con lo que ya funcionaba) — por eso las Entregas de los catálogos sellados no cambian.
 * `formato_invalido` es un motivo de ESTA capa: no está en la lista cerrada de `MOTIVOS` del contrato del Encargo (que no se toca). Cero `node:*` (corre en `edge`). */

const _es = (x) => x != null && typeof x === "object" && !Array.isArray(x);
const _str = (x) => typeof x === "string" && x.trim() !== "";
const _breve = (x) => { try { const s = typeof x === "string" ? x : JSON.stringify(x); return s === undefined ? String(x) : (s.length > 80 ? `${s.slice(0, 77)}...` : s); } catch { return String(x); } };

const ESPERADO_ENTIDADES = "una lista de cuentas, cada una como {\"nombre\": \"<nombre exacto>\"} (con \"eje\" si se conoce); un nombre suelto también se lee";
const ESPERADO_CRITERIO = "{\"lente\": \"<lente>\"} (o una referencia {\"referencia\": {concepto, valor, unidad}}); un nombre suelto de lente también se lee";

const _problema = (parte, campo, valor, esperado, detalle) => ({ parte, campo, valor, motivo: "formato_invalido", detalle, alternativas: [], esperado });

/** una entidad suelta: ¿se lee sin ambigüedad? → { ok, ref } */
function _entidad(ref) {
  if (_str(ref)) return { ok: true, ref: { nombre: ref.trim() }, cambio: true };
  if (_es(ref) && _str(ref.nombre)) return { ok: true, ref, cambio: false };
  return { ok: false };
}

/* ── EL SUPUESTO DE UNA SIMULACIÓN (ensayo 8, owner 2026-10-08) ─────────────────────────────────────────────────────────────────────────────────────────────────────────────
 * La forma que el Encargo exige: el supuesto vive en la RAÍZ con su id (`supuestos: [{id, tipo, valor, unidad, alcance}]`) y la parte lo CITA (`supuestos: ["s1"]`). En el ensayo 8 el anfitrión declaró el supuesto dentro de la parte (con `alcance` como cadena, con `entidad` y
 * `valor: {raw, unidad}`) y en la raíz sin id y sin citarlo: tres veces `cierre_incompleto · ningún supuesto citado tiene productor`, sin saber por qué. Cuando la lectura es ÚNICA se acepta: un supuesto declarado dentro de la parte sube a la raíz con un id y la parte lo cita; un
 * supuesto de la raíz sin id recibe uno; el que ninguna parte cita se asigna a la única simulación que no cita ninguno; el alcance dicho como cadena (una cuenta) o con `entidad`/`tema` se lee como {eje, nombre} con el eje de la parte, solo si la parte tiene UN eje. Lo que no
 * se puede leer sin adivinar queda como llegó (el validador lo dice, y el rechazo enseña la forma). */
function _supuestoNormalizado(s, parte) {
  const out = { ...s };
  const cambios = [];
  if (_es(out.valor) && typeof out.valor.raw === "number") { if (!_str(out.unidad) && _str(out.valor.unidad)) out.unidad = out.valor.unidad; out.valor = out.valor.raw; cambios.push("valor"); }
  const eje = parte && _str(parte.eje) ? parte.eje.trim() : null;
  let nombre = null;
  if (_str(out.entidad)) { nombre = out.entidad.trim(); delete out.entidad; cambios.push("entidad"); }
  if (out.alcance == null && nombre && eje) { out.alcance = { eje, nombre }; }
  else if (_str(out.alcance) && out.alcance.trim() !== "negocio" && eje) { out.alcance = { eje, nombre: out.alcance.trim() }; cambios.push("alcance"); }
  else if (_es(out.alcance) && !(_str(out.alcance.eje) && _str(out.alcance.nombre))) {
    const nom = _str(out.alcance.nombre) ? out.alcance.nombre : _str(out.alcance.entidad) ? out.alcance.entidad : null;
    const ej = _str(out.alcance.eje) ? out.alcance.eje : eje;
    if (nom && ej) { out.alcance = { eje: ej.trim(), nombre: nom.trim() }; cambios.push("alcance"); }
  } else if (_es(out.alcance) && "tema" in out.alcance) { const { tema, ...resto } = out.alcance; out.alcance = resto; cambios.push("alcance"); }
  return { supuesto: out, cambios };
}
const _idLibre = (usados) => { let n = 1; while (usados.has(`s${n}`)) n++; return `s${n}`; };

/** normalizarFormaDelEncargo(encargo) → { encargo, avisos: string[], formato: NoResuelto[] }
 *  `encargo` es el MISMO objeto cuando nada cambió; si algo se leyó de otra forma, una copia con solo eso cambiado (la entrada no se muta). */
export function normalizarFormaDelEncargo(encargo) {
  const salida = { encargo, avisos: [], formato: [] };
  if (!_es(encargo)) return salida;                                             // `encargo_vacio` y compañía los dice el validador
  let raiz = encargo;
  const copiarRaiz = () => { if (raiz === encargo) raiz = { ...encargo }; };

  /* ── criterio (raíz) ── */
  if (encargo.criterio != null) {
    const c = encargo.criterio;
    if (_str(c)) { copiarRaiz(); raiz.criterio = { lente: c.trim() }; salida.avisos.push(`el criterio «${c.trim()}» llegó como cadena: se leyó como {"lente": "${c.trim()}"}.`); }
    else if (_es(c) && (_str(c.lente) || _es(c.referencia))) { /* forma conocida: el validador juzga el valor */ }
    else salida.formato.push(_problema(null, "criterio", _breve(c), ESPERADO_CRITERIO, `El campo «criterio» llegó con una forma que ADI no sabe leer (${_breve(c)}); se esperaba ${ESPERADO_CRITERIO}. No se evaluó si la lente existe.`));
  }

  /* ── supuestos (raíz): una cadena suelta es la lista de uno (no hay otra lectura) ── */
  if (_str(encargo.supuestos)) { copiarRaiz(); raiz.supuestos = [encargo.supuestos]; }

  /* ── partes ── */
  if (Array.isArray(encargo.partes)) {
    let partes = encargo.partes;
    const copiarPartes = () => { if (partes === encargo.partes) partes = [...encargo.partes]; };
    encargo.partes.forEach((p, i) => {
      if (!_es(p)) return;
      const id = _str(p.id) ? p.id : `p${i + 1}`;
      let parte = p;
      const copiarParte = () => { if (parte === p) parte = { ...p }; };

      /* entidades */
      if (p.entidades != null) {
        const lista = Array.isArray(p.entidades) ? p.entidades : [p.entidades];   // una cadena u objeto suelto = la lista de uno
        const leidas = [];
        let cambio = !Array.isArray(p.entidades);
        let malos = null;
        for (const ref of lista) {
          const r = _entidad(ref);
          if (!r.ok) { (malos = malos || []).push(ref); continue; }
          if (r.cambio) cambio = true;
          leidas.push(r.ref);
        }
        if (malos) {
          const ej = _breve(malos[0]);
          salida.formato.push(_problema(id, "entidad", _breve(malos.length === 1 ? malos[0] : malos), ESPERADO_ENTIDADES, `En la parte ${id}, «entidades» trae un elemento con una forma que ADI no sabe leer (${ej}); se esperaba ${ESPERADO_ENTIDADES}. No se evaluó si la cuenta existe.`));
        } else if (cambio) {
          copiarParte(); parte.entidades = leidas;
          salida.avisos.push(`en la parte ${id}, «entidades» llegó como ${Array.isArray(p.entidades) ? "lista de nombres" : "un nombre suelto"}: se leyó como lista de {"nombre": …}.`);
        }
      }

      /* universo como LISTA DE NOMBRES (ensayo 7, owner 2026-10-08): el catálogo documenta «una lista de nombres de entidades» y el Core no tiene universo por nombres —tiene `entidades`—: la lista se ignoraba y la consulta devolvía el eje entero (con su total) como si
       * nadie hubiera acotado. Un conjunto NOMBRADO es lo que `entidades` ya sabe servir (las cifras de exactamente esas entidades, sin total ni cola de las demás): la lista se lee como `entidades`. Si la parte trae las dos y no son las mismas, no se adivina cuál
       * manda: `formato_invalido`, con la forma esperada. Una lista vacía o con algo que no es un nombre tampoco corre. */
      if (Array.isArray(p.universo)) {
        const ESPERADO_UNIVERSO_LISTA = "una lista de nombres exactos de entidades (la misma que \"entidades\": [{\"nombre\": …}]); para acotar con reglas (los mayores, un estado, un filtro) use un objeto: {\"eje\": …, \"top\": …}";
        const nombres = p.universo.map((x) => (_str(x) ? x.trim() : _es(x) && _str(x.nombre) ? x.nombre.trim() : null));
        if (!nombres.length || nombres.some((n) => n == null)) {
          salida.formato.push(_problema(id, "universo", _breve(p.universo), ESPERADO_UNIVERSO_LISTA, `En la parte ${id}, «universo» llegó como una lista ${nombres.length ? "con un elemento que no es un nombre de entidad" : "vacía"} (${_breve(p.universo)}); se esperaba ${ESPERADO_UNIVERSO_LISTA}. No se evaluó nada: la consulta no corrió sin acotar.`));
        } else {
          const ya = Array.isArray(parte.entidades) ? parte.entidades.map((e) => (_es(e) && _str(e.nombre) ? e.nombre.trim() : null)) : null;
          const clave = (s) => String(s).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
          const mismos = ya && ya.length && ya.every((n) => n != null) && new Set(ya.map(clave)).size === new Set(nombres.map(clave)).size && ya.every((n) => nombres.some((m) => clave(m) === clave(n)));
          if (ya && ya.length && !mismos) {
            salida.formato.push(_problema(id, "universo", _breve(p.universo), ESPERADO_UNIVERSO_LISTA, `En la parte ${id}, «universo» (${_breve(p.universo)}) y «entidades» (${_breve(ya)}) nombran entidades distintas; ADI no adivina cuál manda. Mande una sola de las dos con la lista completa (${ESPERADO_UNIVERSO_LISTA}).`));
          } else {
            copiarParte();
            if (!mismos) parte.entidades = nombres.map((nombre) => ({ nombre }));
            delete parte.universo;
            salida.avisos.push(`en la parte ${id}, «universo» llegó como lista de nombres: se leyó como las entidades de la parte (${nombres.length}), y la consulta sirve exactamente esas, sin las demás del eje ni su total.`);
          }
        }
      }

      /* conceptos y supuestos de la parte: una cadena suelta es la lista de uno */
      if (_str(p.conceptos)) { copiarParte(); parte.conceptos = [p.conceptos]; salida.avisos.push(`en la parte ${id}, «conceptos» llegó como un nombre suelto: se leyó como lista de uno.`); }
      if (_str(p.supuestos)) { copiarParte(); parte.supuestos = [p.supuestos]; }

      if (parte !== p) { copiarPartes(); partes[i] = parte; }
    });
    if (partes !== encargo.partes) { copiarRaiz(); raiz.partes = partes; }
  }

  /* ── los supuestos de una simulación (ver arriba): del lugar donde el anfitrión los escribió a la raíz, con id, citados por la parte ── */
  if (Array.isArray(raiz.partes) && (Array.isArray(raiz.supuestos) || raiz.partes.some((p) => _es(p) && Array.isArray(p.supuestos) && p.supuestos.some(_es)))) {
    const partesAct = raiz.partes;
    const sup = Array.isArray(raiz.supuestos) ? raiz.supuestos.slice() : [];
    const usados = new Set(sup.filter((s) => _es(s) && _str(s.id)).map((s) => s.id));
    const partesNuevas = partesAct.slice();
    let cambio = false;
    const avisos = [];
    /* 1 · un supuesto escrito DENTRO de la parte sube a la raíz con un id y la parte lo cita */
    partesAct.forEach((p, i) => {
      if (!_es(p) || !Array.isArray(p.supuestos) || !p.supuestos.some(_es)) return;
      const idP = _str(p.id) ? p.id : `p${i + 1}`;
      const ids = [];
      for (const s of p.supuestos) {
        if (!_es(s)) { ids.push(s); continue; }
        const { supuesto, cambios } = _supuestoNormalizado(s, p);
        const id = _str(supuesto.id) && !usados.has(supuesto.id) ? supuesto.id.trim() : _idLibre(usados);
        usados.add(id);
        const { id: _omitido, ...resto } = supuesto;
        sup.push({ id, ...resto });
        ids.push(id);
        avisos.push(`en la parte ${idP}, el supuesto escrito dentro de la parte se leyó como un supuesto de la raíz con id «${id}» citado por la parte${cambios.length ? ` (se leyó ${cambios.join(", ")} en la forma del contrato)` : ""}. La forma completa: en la raíz «supuestos»: [{"id", "tipo", "valor", "unidad", "alcance"}] y en la parte «supuestos»: ["${id}"].`);
      }
      partesNuevas[i] = { ...p, supuestos: ids };
      cambio = true;
    });
    const simulaciones = partesNuevas.filter((p) => _es(p) && p.cierre === "simulacion");
    /* 2 · un supuesto de la raíz sin id recibe uno; su alcance se lee con el eje de la parte que lo cita (o de la única simulación) */
    sup.forEach((s, k) => {
      if (!_es(s)) return;
      let t = s, cambiosT = [];
      if (!_str(t.id)) { const id = _idLibre(usados); usados.add(id); t = { id, ...t }; cambiosT.push("id"); }
      const citante = partesNuevas.find((p) => _es(p) && Array.isArray(p.supuestos) && p.supuestos.includes(t.id)) || (simulaciones.length === 1 ? simulaciones[0] : null);
      const n = _supuestoNormalizado(t, citante);
      if (n.cambios.length) { t = { id: t.id, ...Object.fromEntries(Object.entries(n.supuesto).filter(([c]) => c !== "id")) }; cambiosT = cambiosT.concat(n.cambios); }
      if (cambiosT.length) { sup[k] = t; cambio = true; avisos.push(`el supuesto «${t.id}» de la raíz se leyó en la forma del contrato (${cambiosT.join(", ")}).`); }
    });
    /* 3 · el supuesto que ninguna parte cita pertenece a la ÚNICA simulación que no cita ninguno */
    const citados = new Set(partesNuevas.flatMap((p) => (_es(p) && Array.isArray(p.supuestos) ? p.supuestos.filter(_str) : [])));
    const huerfanos = sup.filter((s) => _es(s) && _str(s.id) && !citados.has(s.id)).map((s) => s.id);
    const sinCitas = simulaciones.filter((p) => !Array.isArray(p.supuestos) || p.supuestos.length === 0);
    if (huerfanos.length && sinCitas.length === 1) {
      const i = partesNuevas.indexOf(sinCitas[0]);
      partesNuevas[i] = { ...sinCitas[0], supuestos: huerfanos };
      cambio = true;
      avisos.push(`el/los supuesto(s) ${huerfanos.map((x) => `«${x}»`).join(", ")} no los citaba ninguna parte: se asignaron a la parte ${_str(sinCitas[0].id) ? sinCitas[0].id : `p${i + 1}`}, la única simulación que no citaba ninguno (la parte los cita con «supuestos»: [ids]).`);
    }
    if (cambio) { copiarRaiz(); raiz.supuestos = sup; raiz.partes = partesNuevas; salida.avisos.push(...avisos); }
  }

  salida.encargo = raiz;
  return salida;
}
