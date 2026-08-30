/* === config/politicaCobro.js · EL PLAZO DE PAGO, QUE ES POLÍTICA Y NO DATO (owner 2026-08-30) ===========
 *
 * LA ORDEN, textual: «Plazo de pago por cliente, con un plazo general por defecto para la empresa. La app debe
 * permitir declarar un plazo general, por ejemplo 30 días, y sobrescribirlo por cliente cuando aplique. Si un
 * cliente no tiene plazo propio, usa el general. Esto es política del negocio, no dato del período, así que
 * vive en la app/versión del pack, no como columna obligatoria de la planilla.»
 *
 * POR QUÉ NO ES UNA COLUMNA DE LA PLANILLA. Un plazo no ocurrió: se decidió. Ponerlo en la planilla obligaría a
 * repetir la misma decisión en cada fila de cada mes, y a que dos filas del mismo cliente puedan contradecirse.
 * Va declarado una vez, en la empresa, y se aplica a todo lo que venga.
 *
 * ⚠️ Y POR QUÉ NO VA EN `localStorage`, que es donde viven los prorrateos del P&L —el ejemplo que dio el owner—:
 * ahí la declaración es de UN NAVEGADOR. El propio owner ya había puesto el dedo en eso preguntando «¿qué pasa
 * cuando hay 4 usuarios en la misma empresa?». Un plazo de pago es de la EMPRESA: si cada usuario tuviera el
 * suyo, cuatro personas verían cuatro deudas vencidas distintas del mismo cliente. Vive en el pack, del lado
 * del servidor, y queda registrado quién lo declaró.
 *
 * ⚠️ SIN PLAZO DECLARADO NO HAY VENCIDO, Y SE DEVUELVE `null` — NUNCA CERO. Es la orden explícita del owner
 * («Mantén el vencido en raya mientras no exista plazo declarado. No mostrar cero») y es lo mismo que ya hacía
 * la cara antes de que esto existiera. Un cero afirma «no debe nada vencido»; una raya dice «no lo sé», que es
 * la verdad. Nunca se cae a un plazo por defecto de 30 días: sería inventar la política del cliente.
 */

import { getTenantData } from "../data/tenantStore.js";

/* El techo no es decorativo: un plazo de cuatro dígitos es un error de tipeo, no una condición comercial, y
 * dejarlo pasar convertiría toda la deuda en «por vencer» para siempre. */
const MAX_DIAS = 365;

export const POLITICA_VACIA = Object.freeze({ diasGeneral: null, porCliente: {} });

/* Los acentos se sacan con el rango ESCAPADO (\u0300-\u036f) y no con los caracteres literales: pegar marcas
 * combinantes dentro de una clase es invisible en el editor y se rompe en el primer copiado. */
const _norm = (s) => String(s == null ? "" : s).trim().toLowerCase()
  .normalize("NFD").replace(/[\u0300-\u036f]/g, "");

/** Un plazo válido: entero, de 0 a 365. Cero es legítimo —«paga contra entrega»— y distinto de no declarado. */
export function diasLimpios(v) {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  const e = Math.round(n);
  if (e < 0 || e > MAX_DIAS) return null;
  return e;
}

/* politicaLimpia(x) → la política normalizada, siempre con la misma forma.
 *
 * Lo que no se entiende se DESCARTA en vez de aproximarse: un plazo ilegible no puede convertirse en 30. */
export function politicaLimpia(x) {
  const p = x && typeof x === "object" ? x : {};
  const porCliente = {};
  const bruto = p.porCliente && typeof p.porCliente === "object" ? p.porCliente : {};
  for (const [nombre, valor] of Object.entries(bruto)) {
    const n = String(nombre || "").trim();
    const d = diasLimpios(valor);
    if (n && d !== null) porCliente[n] = d;
  }
  return {
    diasGeneral: diasLimpios(p.diasGeneral),
    porCliente,
    ...(p.declaradoEn ? { declaradoEn: String(p.declaradoEn) } : {}),
    ...(p.declaradoPor ? { declaradoPor: String(p.declaradoPor).slice(0, 80) } : {}),
    ...(p.declaradoPorRol ? { declaradoPorRol: String(p.declaradoPorRol).slice(0, 40) } : {}),
  };
}

/* plazoDe(politica, cliente) → los días que le corresponden a ESE cliente, o `null` si nadie lo declaró.
 *
 * El orden lo fijó el owner: el plazo propio del cliente pisa al general; sin plazo propio, el general. Y si
 * tampoco hay general, `null` — que es lo que mantiene el vencido en raya. */
export function plazoDe(politica, cliente) {
  const p = politicaLimpia(politica);
  const buscado = _norm(cliente);
  if (buscado) {
    /* Se compara NORMALIZADO —sin tildes, sin mayúsculas, sin espacios de más— porque el nombre que el usuario
     * escribe en la pantalla y el que trae su planilla salen de dos teclados distintos. «Depósito Riachuelo» y
     * «deposito riachuelo» son el mismo cliente, y tratarlos como dos deja al segundo sin plazo en silencio. */
    for (const [nombre, dias] of Object.entries(p.porCliente)) {
      if (_norm(nombre) === buscado) return dias;
    }
  }
  return p.diasGeneral;
}

/** ¿Alguien declaró algo? Con esto la cara decide entre calcular el vencido o dejarlo en raya. */
export function hayPlazo(politica) {
  const p = politicaLimpia(politica);
  return p.diasGeneral !== null || Object.keys(p.porCliente).length > 0;
}

/* alcanceDeLaPolitica(politica, clientes) → qué cubre y qué no, para decirlo en pantalla.
 *
 * ⚠️ EL CASO INCÓMODO ES EL PARCIAL: hay plazos por cliente pero no general, y algún cliente quedó afuera. Ahí
 * el total del vencido no es el vencido del negocio, es el de los clientes que sí tienen plazo. Callarlo sería
 * un top-N sin cola: cada cifra correcta y el total mintiendo por omisión. */
export function alcanceDeLaPolitica(politica, clientes = []) {
  const p = politicaLimpia(politica);
  const lista = [...new Set(clientes.map((c) => String(c || "").trim()).filter(Boolean))];
  const conPlazo = lista.filter((c) => plazoDe(p, c) !== null);
  const sinPlazo = lista.filter((c) => plazoDe(p, c) === null);
  const propios = lista.filter((c) => {
    const buscado = _norm(c);
    return Object.keys(p.porCliente).some((n) => _norm(n) === buscado);
  });
  return {
    hay: hayPlazo(p),
    diasGeneral: p.diasGeneral,
    total: lista.length,
    conPlazo: conPlazo.length,
    sinPlazo,
    conPlazoPropio: propios.length,
    completa: lista.length > 0 && sinPlazo.length === 0,
  };
}

/* frasePolitica(alcance) → la línea que la pantalla muestra debajo de las cifras.
 *
 * Se redacta acá y no en React: es la misma regla de la casa que ya siguen la moneda y el marco del período —
 * la vista pinta, el módulo decide qué se puede afirmar. */
export function frasePolitica(alcance) {
  const a = alcance || {};
  if (!a.hay) {
    return "Sin plazo de pago declarado: no se puede saber qué parte del saldo está vencida. Se declara una vez, en la empresa, y aplica a todo lo que venga.";
  }
  const general = a.diasGeneral !== null && a.diasGeneral !== undefined
    ? `Plazo general de ${a.diasGeneral} días`
    : "Sin plazo general";
  const propios = a.conPlazoPropio > 0
    ? `, con ${a.conPlazoPropio} ${a.conPlazoPropio === 1 ? "cliente que tiene el suyo" : "clientes que tienen el suyo"}`
    : "";
  if (a.completa) return `${general}${propios}. Cubre a los ${a.total} clientes con venta a crédito.`;
  /* ⚠️ EL PARCIAL SE NOMBRA CON NOMBRE Y APELLIDO: quién quedó afuera, no cuántos. El usuario tiene que poder
   * ir a arreglarlo, y «3 clientes sin plazo» no le dice a cuáles. */
  const fuera = a.sinPlazo.slice(0, 3).join(", ");
  const resto = a.sinPlazo.length > 3 ? ` y ${a.sinPlazo.length - 3} más` : "";
  return `${general}${propios}. El vencido cubre ${a.conPlazo} de ${a.total} clientes: ${fuera}${resto} ${a.sinPlazo.length === 1 ? "no tiene" : "no tienen"} plazo declarado y ${a.sinPlazo.length === 1 ? "queda" : "quedan"} fuera de esa cifra.`;
}

/* politicaDelNegocio(dataset) → la política declarada por ESTA empresa.
 *
 * Vive en `perfil.cobro`, al lado de la moneda y por la misma razón: las dos son cosas que el negocio DECLARA,
 * no que el período trae. Se lee igual que `monedaDelNegocio` — mismo patrón, mismo lugar, misma caída a vacío
 * cuando no hay nada declarado. */
export function politicaDelNegocio(dataset) {
  const d = dataset || getTenantData();
  return politicaLimpia(d && d.perfil && d.perfil.cobro);
}
