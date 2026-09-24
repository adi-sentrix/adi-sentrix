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
 * PROCEDENCIA (owner, textual, regla 5 del sello — «el nivel de comparación nunca es un hecho publicado», y el
 * porqué de cada procedencia): el piso por DEFECTO (criterio de ADI) es una referencia declarada por la casa,
 * no medida en ningún archivo — usa `estimacion_referencia` (la categoría de `notario/hechos.js:PROCEDENCIAS`
 * para «una brecha o un criterio contra una referencia declarada», la misma familia que un benchmark). El piso
 * AJUSTADO por la empresa es un número que la empresa aportó — `supuesto_usuario`. Ninguno de los dos es nunca
 * "medido": no hay archivo que declare un piso de materialidad. */

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

/** pisoMaterialidadCobranzaDe(tenant) → { k, procedencia, fuente } — nunca lanza, nunca vuelve null.
 *  Camino B: `tenant.perfil.pisoMaterialidadCobranza = {valor, procedencia}`, con `valor` un número entre
 *  `PISO_MATERIALIDAD_COBRANZA_MIN` y `PISO_MATERIALIDAD_COBRANZA_MAX` y `procedencia` en {"medido","derivado"}
 *  (lo que la empresa declaró). Ausente, mal formado o fuera de rango ⇒ el criterio de ADI, con SU propia
 *  procedencia (`estimacion_referencia`) — la puerta falla cerrado hacia el criterio de la casa, nunca hacia un
 *  número inventado. */
export function pisoMaterialidadCobranzaDe(tenant) {
  const v = tenant && tenant.perfil && tenant.perfil.pisoMaterialidadCobranza;
  if (v && typeof v === "object" && _PROCEDENCIAS_DEL_AJUSTE.includes(v.procedencia)) {
    const k = Number(v.valor);
    if (Number.isFinite(k) && k >= PISO_MATERIALIDAD_COBRANZA_MIN && k <= PISO_MATERIALIDAD_COBRANZA_MAX) {
      return {
        k, procedencia: "supuesto_usuario", declaradoPorLaEmpresa: true,
        fuente: "tenant.perfil.pisoMaterialidadCobranza — declarado por la empresa (camino B, fuera de la plantilla; `db/migraciones/014_piso_materialidad_cobranza.sql`, sin aplicar)",
      };
    }
  }
  return {
    k: PISO_MATERIALIDAD_COBRANZA_CRITERIO_ADI, procedencia: "estimacion_referencia", declaradoPorLaEmpresa: false,
    fuente: "config/contract/pisoMaterialidadCobranza.js:PISO_MATERIALIDAD_COBRANZA_CRITERIO_ADI — criterio general de ADI, ajustable por la empresa",
  };
}
