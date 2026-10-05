/* === config/contract/pisoMaterialidadCobranza.js · EL PISO DE MATERIALIDAD DE COBRANZA (owner 2026-09-23,
 * diseño SELLADO — pieza PRI-04 de la capa de conocimiento) ═══════════════════════════════════════════════════
 * Las cinco reglas selladas del owner, textuales donde importa:
 *   1 · Para cada cuenta c: D_c = (participación de c en el vencido − participación de c en la venta) × vencido
 *       total. Material ⟺ D_c ≥ k × P, con P = saldo pendiente total del universo evaluable. k = 1% es el
 *       CRITERIO GENERAL DE ADI, ajustable por la empresa — «no como verdad sectorial», sello textual del
 *       owner: «El 1% queda explícitamente como criterio general de ADI, ajustable por la empresa, no como
 *       verdad sectorial».
 *   3 · `borde:boolean` = el veredicto cambia dentro de la banda [k/2, 2k] (con k=1%: 0,5%–2%).
 *
 * ESTA CONSTANTE VIVE ACÁ — nunca en prosa, nunca en la plantilla congelada — con un nombre que declara su
 * autoría (`_CRITERIO_ADI`). Ningún dígito de este archivo se escribe a mano en `medir.js`, `piezas.js` ni en
 * ningún texto servido: `medir.js` lo importa y lo declara como OPERANDO con su procedencia, y
 * `notario/hechos.js` verifica la aritmética (ver la nota de cabecera de `medir.js:pisoMaterialidadCobranza`).
 *
 * EL AJUSTE POR LA EMPRESA (camino B, diseño sellado): `tenant.perfil.pisoMaterialidadCobranza = {valor,
 * procedencia}`, el mismo patrón `{valor, procedencia}` que ya usa `perfilCliente.js` para sector/tipoProducto/
 * país/modeloComercial/tamanoBanda — pero este campo NO es uno de los seis del perfil (`CAMPOS_DEL_PERFIL`): es
 * un ajuste de POLÍTICA de la capa de conocimiento, opcional, que nunca bloquea la capa si falta (a diferencia
 * del perfil, que «falla cerrado» si falta cualquiera de sus seis campos). Por eso vive en este archivo y no en
 * `perfilCliente.js` — mismo patrón `{valor, procedencia}`, otra puerta, sin mezclar la ley de "perfil completo"
 * con la de "criterio de materialidad declarado". Migración escrita, sin aplicar: `db/migraciones/014_piso_
 * materialidad_cobranza.sql` — mismo camino B que 012/013 (`tenants`, fuera de la plantilla congelada).
 *
 * PROCEDENCIA (Etapa 2, bloque 5 · owner 2026-10-04: «el piso de cobranza funciona como los demás criterios»): el piso ya NO tiene una procedencia propia escrita acá. Su ORIGEN lo resuelve la
 * función única de la casa (`businessPolicy.js:pisoMaterialidadCobranzaDe` sobre `procedenciaDeLlave`): lo que la empresa DECLARÓ —conversando y confirmado (`aportarContexto`, clase «criterio», concepto
 * `piso_materialidad_cobranza`) o en su perfil (el camino B de arriba, que sigue siendo una fuente válida de lo declarado)— es «declarado por la empresa»; sin declaración, el criterio general de ADI. Nada de
 * «supuesto del usuario» para algo que la empresa declaró. La categoría legada de `notario/hechos.js:PROCEDENCIAS` de la constante del piso es siempre `estimacion_referencia` («un criterio contra una referencia»,
 * la misma familia que un benchmark); QUIÉN lo puso viaja en el eje de origen del libro (`declarado`). Ninguno de los dos es nunca "medido": no hay archivo que declare un piso de materialidad.
 *
 * FRONTERA (owner 2026-10-04, garantía dura): el piso es un criterio de materialidad —decide qué cuentas quedan como señal, bajo el piso o al borde—, NO modifica saldos, atrasos ni ninguna medición de cobranza.
 * Declarar otro piso solo puede cambiar esos veredictos; ningún saldo, vencido, atraso, porcentaje ni cifra medida cambia. Lo vigila `_piso_cobranza_declarado_gate.mjs`. */

/** k = 1% — criterio general de ADI, ajustable por la empresa. NO es una verdad sectorial ni una meta. */
export const PISO_MATERIALIDAD_COBRANZA_CRITERIO_ADI = 0.01;

/** la banda de borde: [k × BORDE_FACTOR_INFERIOR, k × BORDE_FACTOR_SUPERIOR] — con k=1%, 0,5%–2%. */
export const BORDE_FACTOR_INFERIOR = 0.5;
export const BORDE_FACTOR_SUPERIOR = 2;

/* el rango de ajuste razonable que la empresa puede declarar (camino B) — 0,1% a 10%. Los MISMOS dos números
 * viven en la migración 014 como literales SQL (un `.sql` no puede importar este módulo); el candado nuevo
 * (`_piso_materialidad_gate.mjs`) compara los dos textos para que no diverjan en silencio, el mismo mecanismo
 * que ya usa `_entrega_gate.mjs` para la migración 013 contra `taxonomiaPerfil.js`. */
export const PISO_MATERIALIDAD_COBRANZA_MIN = 0.001;
export const PISO_MATERIALIDAD_COBRANZA_MAX = 0.10;

const _PROCEDENCIAS_DEL_AJUSTE = ["medido", "derivado"];   // el mismo par que ya acepta `perfilCliente.js:_delPerfilDeEmpresa` — lo que la EMPRESA declaró o el motor derivó, nunca una brecha ni una propuesta

/** pisoDelCaminoB(v) → la fracción (0,001–0,10) que la empresa declaró en `tenant.perfil.pisoMaterialidadCobranza = {valor, procedencia}` (camino B), o `null` si el valor está ausente, mal formado,
 *  con una procedencia que no es la de una declaración o fuera del rango de ajuste. PURA y sin imports: el ORIGEN de ese valor (declarado por la empresa, o el criterio general de ADI cuando esto da `null`) lo resuelve
 *  UNA sola función de la casa —`businessPolicy.js:pisoMaterialidadCobranzaDe`, la misma que lee lo que la empresa declaró conversando—; este archivo solo guarda las constantes y esta validación. */
export function pisoDelCaminoB(v) {
  if (!v || typeof v !== "object" || !_PROCEDENCIAS_DEL_AJUSTE.includes(v.procedencia)) return null;
  const k = Number(v.valor);
  return Number.isFinite(k) && k >= PISO_MATERIALIDAD_COBRANZA_MIN && k <= PISO_MATERIALIDAD_COBRANZA_MAX ? k : null;
}
