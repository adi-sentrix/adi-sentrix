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

      /* conceptos y supuestos de la parte: una cadena suelta es la lista de uno */
      if (_str(p.conceptos)) { copiarParte(); parte.conceptos = [p.conceptos]; salida.avisos.push(`en la parte ${id}, «conceptos» llegó como un nombre suelto: se leyó como lista de uno.`); }
      if (_str(p.supuestos)) { copiarParte(); parte.supuestos = [p.supuestos]; }

      if (parte !== p) { copiarPartes(); partes[i] = parte; }
    });
    if (partes !== encargo.partes) { copiarRaiz(); raiz.partes = partes; }
  }

  salida.encargo = raiz;
  return salida;
}
