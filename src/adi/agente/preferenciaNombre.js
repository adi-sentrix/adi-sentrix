/* === src/adi/agente/preferenciaNombre.js · «LLÁMAME JC» — EL NOMBRE ES DEL USUARIO (F3 · owner 2026-08-30) ===
 *
 * LA REGLA, en dos mitades que no se mezclan:
 *   · EL NOMBRE SÍ SE CONFIGURA: «llámame jc» se guarda y persiste POR EMPRESA (patrón C.2 de criteria.js:
 *     espejo en memoria por tenant + localStorage con clave por tenant, guarded para headless/gates). Viaja
 *     como UNA línea del segmento fijo del system.
 *   · EL TONO NO SE CONFIGURA: guardar un nombre JAMÁS afloja el registro. «decime wachin» guarda el apodo
 *     «wachin» y el agente lo usa — con el MISMO registro formal de siempre. No hay campo de tono, no hay
 *     parse de tono, no hay forma de pedirlo: lo que no existe no se puede aflojar (carnada en el gate).
 *
 * PURO · sin red · mismo patrón de persistencia que criteria.js (capas distintas a propósito, ver su nota). */
import { getTenantId, onTenantChange } from "../../data/tenantStore.js";

/* NADA SE DERIVA AL IMPORTARSE (regla de _import_sin_dato_gate — F2 multiempresa): el tenant se resuelve
 * PEREZOSO en el primer uso, nunca en tiempo de import. El callback de cambio de tenant se registra al
 * importar (registrar no es derivar), y solo mueve estado si el módulo ya se usó. */
let _tid = null;                    // el tenant cuyo nombre está aplicado · null = módulo aún sin usar
const _lsKey = () => `adi_nombre_v1::${_tid}`;
const _hasLS = () => { try { return typeof localStorage !== "undefined" && !!localStorage; } catch { return false; } };

let _nombre = null;                 // el del tenant activo
const _byTenant = {};               // espejo en memoria (headless/gates: ida-y-vuelta sin localStorage no pierde ni arrastra)

const _leerLS = () => { if (!_hasLS()) return null; try { return localStorage.getItem(_lsKey()) || null; } catch { return null; } };
function _ensure() {
  const t = getTenantId();
  if (_tid === t) return;
  if (_tid != null) _byTenant[_tid] = _nombre;   // guarda lo del tenant anterior antes de cambiar
  _tid = t;
  _nombre = _byTenant[_tid] != null ? _byTenant[_tid] : _leerLS();
}
onTenantChange(() => { if (_tid != null) _ensure(); });

/* setNombreUsuario(nombre) → {ok} | {ok:false, reason}
 * Validación MECÁNICA y mínima: un nombre corto (1-24 chars, letras/dígitos/espacios/.·-), sin saltos de línea.
 * No se juzga el contenido — «wachin» es un apodo válido; lo que no se negocia es el registro, y eso no vive acá. */
export function setNombreUsuario(nombre) {
  _ensure();
  const n = typeof nombre === "string" ? nombre.trim() : "";
  if (!n || n.length > 24 || /[\n\r]/.test(n) || !/^[\p{L}\p{N} .·'-]+$/u.test(n)) {
    return { ok: false, reason: "nombre inválido: corto y simple (hasta 24 caracteres)" };
  }
  _nombre = n;
  _byTenant[_tid] = n;
  if (_hasLS()) { try { localStorage.setItem(_lsKey(), n); } catch { /* headless */ } }
  return { ok: true, nombre: n };
}
export function olvidarNombreUsuario() {
  _ensure();
  _nombre = null;
  _byTenant[_tid] = null;
  if (_hasLS()) { try { localStorage.removeItem(_lsKey()); } catch { /* headless */ } }
  return { ok: true };
}
export function getNombreUsuario() { _ensure(); return _nombre; }

/** La línea del segmento fijo — "" sin declaración (cero tokens). Byte-estable por tenant+nombre. */
export function lineaDeNombre() {
  _ensure();
  /* LA PALABRA DEL OWNER (2026-08-31), tras ver la corrida 3: «no quiero que use esas cosas, que use el NOMBRE
   * de usuario… ahora es ejecutivo». El apodo le había arrastrado el registro a once turnos («wachin, acá está
   * lo que mueve aguja»). El nombre es SOLO la forma de trato: nada más cambia. Lo dice la letra y —porque en
   * este repo la instrucción sola no alcanza— lo veta `registro-coloquial` en contratoAgente. */
  return _nombre ? `El usuario pidió que lo llames «${_nombre}». Es SOLO la forma de trato: el registro sigue siendo ejecutivo y formal — nada de aperturas ni muletillas coloquiales por tener su nombre.` : "";
}
// boot (llamar UNA vez desde la app en el navegador): re-aplica lo persistido del tenant activo
export function initPreferenciaNombre() {
  _ensure();
  if (!_hasLS()) return;
  try { const v = localStorage.getItem(_lsKey()); if (v) { _nombre = v; _byTenant[_tid] = v; } } catch { /* headless */ }
}
