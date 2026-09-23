/* === config/contract/taxonomiaPerfil.js · EL VOCABULARIO DEL PERFIL, UNA SOLA VEZ (owner 2026-09-23) ==========
 * ═══════════════════════════════════════════════════════════════════════════════════════════════════════════
 * TAREA 2 del encargo: «sembrar la taxonomía» (`_ADI_PERFIL_VOCABULARIOS_PROPUESTA.md`, aprobada por el owner).
 * Este archivo es LA VERDAD que usa el producto en tiempo de ejecución — el owner pidió explícitamente que el
 * vocabulario de ejecución y las filas de `perfil_taxonomia` (la migración `013_perfil_taxonomia_siembra.sql`)
 * «sean la misma verdad, no dos listas que se puedan desincronizar». Como una migración SQL no puede `import`
 * un archivo `.js`, no se puede derivar una de la otra en código — así que el candado es el inverso: la
 * migración 013 siembra EXACTAMENTE estos códigos (comentario de cabecera con la lista, byte a byte) y
 * `_entrega_gate.mjs` compara el array de acá contra el `insert` de la migración leída como texto. Si alguien
 * cambia uno sin el otro, el candado arde — ver «candado: una sola verdad por vocabulario» en el gate.
 *
 * Códigos estables e independientes del rótulo (nota técnica §8 de la propuesta): el rótulo (lo que ve el
 * usuario) es superficie y puede cambiar; el código (lo que guarda la base y lee el motor) NO se renombra ni se
 * borra nunca — un vocabulario que crece sube `PERFIL_VERSION` y agrega, no reemplaza.
 *
 * PURO. Sin imports, sin red, sin lógica de UI. */

export const PERFIL_VERSION = 1;

/** Sector: CINCO más «ninguno» (propuesta §1). «obras» entra DESDE AHORA (owner, textual: «lo incluyó desde
 *  ahora») — un sector prestado (meter obras en servicios) entregaría conocimiento falso sobre cobranza y
 *  plazos, que es justo la regla que gobierna cuándo un sector nuevo se agrega. */
export const SECTORES = ["distribucion", "fabricacion", "minorista", "servicios", "obras", "ninguno"];

/** Los tres sectores donde el inventario tiene un comportamiento que vale la pena distinguir (propuesta §2).
 *  Servicios y obras no tienen SKU con vencimiento/temporada/etc. en el sentido de la pregunta — su inventario
 *  (si existe) es obra en curso o trabajo no facturado, no un tipo de producto. */
export const SECTORES_CON_TIPO_PRODUCTO = ["distribucion", "fabricacion", "minorista"];

/** tipoProducto (antes «subsector» — renombrado por la propuesta §2, nota: «el plan lo llamaba subsector pero
 *  el contenido es tipo de producto»). Solo aplica a los tres sectores de arriba; para servicios y obras es
 *  NULO OBLIGATORIO (lo valida `validarTipoProductoDeSector` acá y el trigger `adi.validar_perfil_tenant()` en
 *  la base). */
export const TIPOS_PRODUCTO = ["vence", "consumo", "durable", "temporada", "insumos"];

/** modeloComercial: a quién le vende la mayor parte (propuesta §4). Sin "mixto": se pregunta por la mayor
 *  parte, el resto lo mide el dato. */
export const MODELOS_COMERCIALES = ["cuentas_grandes", "comercios", "consumidor", "publico"];

/** país: ISO alfa-2, países de habla hispana de América más Brasil y España, Chile primero (propuesta §5 — el
 *  orden no es inferencia, es conveniencia de lista; NUNCA se pre-marca ni se deduce de la moneda). */
export const PAISES = [
  "CL", // Chile — primero, por convención de lista (no es una sugerencia pre-marcada)
  "AR", "BO", "CO", "CR", "CU", "EC", "SV", "GT", "HN", "MX", "NI", "PA", "PY", "PE", "DO", "UY", "VE", // resto de habla hispana de América
  "BR", "ES", // Brasil y España, por mandato explícito de la propuesta
];

/** tamanoBanda: las cuatro bandas derivadas (nunca preguntadas) — propuesta §3, umbrales sellados por el owner
 *  el 2026-09-23. El cálculo de CUÁL banda vive en `bandaTamano.js`; esta lista es solo el vocabulario cerrado. */
export const TAMANO_BANDAS = ["micro", "pequena", "mediana", "grande"];

/** El mismo mapa que la migración 013 siembra en `perfil_taxonomia` — campo (nombre de columna en snake_case,
 *  el que usa la base) → lista de códigos. Única fuente que lee el candado de sincronía del gate. */
export const TAXONOMIA_PERFIL = {
  sector: SECTORES,
  tipo_producto: TIPOS_PRODUCTO,
  modelo_comercial: MODELOS_COMERCIALES,
  pais: PAISES,
  tamano_banda: TAMANO_BANDAS,
};

/** codigoValido(campo, codigo) → boolean — defensa en profundidad, el mismo criterio que el trigger de la base:
 *  `null`/`undefined` siempre es válido (significa "no respondido", nunca se rechaza acá — lo decide
 *  `perfilCliente.js` si el campo es obligatorio); cualquier otro valor tiene que estar en la lista exacta. */
export function codigoValido(campo, codigo) {
  if (codigo == null) return true;
  const lista = TAXONOMIA_PERFIL[campo];
  return Array.isArray(lista) && lista.includes(codigo);
}

/** validarTipoProductoDeSector(sector, tipoProducto) → { ok, motivo? }
 *  LA REGLA DURA de la propuesta §2: «tipoProducto... solo aplica a distribucion, fabricacion y minorista; para
 *  servicios y obras tiene que ser nulo obligatoriamente». Un tipoProducto no nulo con un sector que no admite
 *  el campo (servicios, obras, ninguno, o sector todavía no declarado) se RECHAZA — no se ignora en silencio,
 *  para que quien declaró el perfil sepa que esa combinación no es válida y no que ADI la descartó sin decir
 *  nada. El código en sí también se valida contra la lista cerrada (un valor fuera de `TIPOS_PRODUCTO` se
 *  rechaza igual que uno mal emparejado con el sector). */
export function validarTipoProductoDeSector(sector, tipoProducto) {
  if (tipoProducto == null) return { ok: true };
  if (!TIPOS_PRODUCTO.includes(tipoProducto)) {
    return { ok: false, motivo: `"${tipoProducto}" no está en la lista autorizada de tipoProducto (${TIPOS_PRODUCTO.join(" · ")})` };
  }
  if (!SECTORES_CON_TIPO_PRODUCTO.includes(sector)) {
    return { ok: false, motivo: `tipoProducto no aplica al sector "${sector ?? "(sin declarar)"}" — solo distribución, fabricación y minorista lo usan; servicios y obras deben declarar tipoProducto nulo` };
  }
  return { ok: true };
}
