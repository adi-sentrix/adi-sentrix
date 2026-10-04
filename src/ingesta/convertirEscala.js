/* === ingesta/convertirEscala.js · LA ESCALA DECLARADA, APLICADA A LOS HECHOS ANTES DE CALCULAR (owner 2026-10-04 · P1) ==
 *
 * EL TRABAJO, y es del MOTOR —nunca de la pantalla—: si la empresa declara que sus montos están en MILES, todos los
 * campos MONETARIOS de las filas se multiplican por 1.000 ANTES de calcular nada, de modo que el pack queda SIEMPRE en
 * unidades de la moneda. Con eso `escalaComercial: "raw"` deja de ser una suposición y pasa a ser verdad por
 * construcción: cada cifra aguas abajo (venta, costo, contribución, capital valorizado) hereda la unidad correcta.
 *
 * ⚠️ QUÉ SE MULTIPLICA LO DICE EL CONTRATO, no una lista escrita acá. Cada columna numérica de `HOJAS` declara su
 * `magnitud` (`"dinero"` | `"cantidad"`): dinero se multiplica; cantidades —unidades vendidas, stock físico, días— y
 * porcentajes, fechas y textos NO se tocan jamás. Una columna numérica sin magnitud declarada hace que esta conversión
 * SE NIEGUE a correr (`ok:false`) en vez de adivinar si es plata.
 *
 * ⚠️ NO SE MUTA NADA: las filas de entrada quedan intactas; salen copias. Y la declaración QUEDA REGISTRADA con su
 * procedencia (`registro` → `perfil.escala` en el pack): moneda, escala, «declarado por la empresa» y, si hubo
 * conversión, qué columnas se multiplicaron, cuántas celdas y por qué.
 *
 * PURO · sin red · sin modelo · sin I/O. El servidor lo llama en los dos caminos de activación (con versión guardada y
 * en memoria) para que el dataset activado ya salga convertido de ahí. */
import { HOJAS, PARAMETROS, columnasSinMagnitud } from "../config/contract/plantilla.js";
import { validarEscala, factorDeEscala, multiplicar, ORIGEN_DECLARACION, FUENTES } from "../config/escala.js";
import { monedaLimpia } from "../config/moneda.js";

const _esNumero = (v) => typeof v === "number" && Number.isFinite(v);

/* convertirHechos(hechos, escala, { moneda, monedaHeredada }) → { ok:true, hechos, registro } | { ok:false, motivo, sinMoneda? }
 * `hechos` = { parametros, Ventas, Inventario, Abonos, … } tal como los normalizó el validador, EN LA ESCALA DEL ARCHIVO.
 * Devuelve hechos en UNIDADES DE LA MONEDA.
 *
 * LA MONEDA tiene tres fuentes posibles y solo tres, en este orden: la que la empresa declaró EN LA PANTALLA (`moneda`), la
 * que la hoja Empresa del archivo trae EXPLÍCITAMENTE en su parámetro «moneda» (`parametros.moneda`) o la que la EMPRESA ya
 * declaró en una carga anterior y se le recuerda (`monedaHeredada`: no es inferida, es la misma declaración de antes). Sin
 * ninguna no se convierte ni se activa nada, y la fuente usada queda registrada (`fuente.moneda`: «pantalla» | «archivo» |
 * «empresa»). La escala siempre es de la pantalla: la plantilla no tiene dónde declararla y NO se hereda. */
export function convertirHechos(hechos, escala, { moneda = null, monedaHeredada = null } = {}) {
  const v = validarEscala(escala);
  if (!v.ok) return { ok: false, motivo: v.motivo };
  const esc = v.valor;
  const factor = factorDeEscala(esc);

  /* NO SE ADIVINA: si el contrato tiene una columna numérica sin magnitud, no se sabe qué multiplicar. */
  const huecos = columnasSinMagnitud();
  if (huecos.length) {
    return { ok: false,
      motivo: `el contrato no declara si ${huecos.map((c) => `«${c.hoja}: ${c.titulo}»`).join(", ")} es dinero o cantidad: no se convierte la escala sin saberlo` };
  }

  const h = hechos && typeof hechos === "object" ? hechos : {};
  const salida = { ...h };
  const campos = [];   // qué se multiplicó, con cuántas celdas

  for (const def of HOJAS) {
    const filas = Array.isArray(h[def.nombre]) ? h[def.nombre] : [];
    const dinero = def.columnas.filter((c) => c.tipo === "numero" && c.magnitud === "dinero");
    if (!dinero.length) continue;
    const cuenta = new Map(dinero.map((c) => [c.campo, 0]));
    salida[def.nombre] = filas.map((f) => {
      const g = { ...f };
      for (const c of dinero) {
        if (_esNumero(g[c.campo])) { g[c.campo] = multiplicar(g[c.campo], factor); cuenta.set(c.campo, cuenta.get(c.campo) + 1); }
      }
      return g;
    });
    for (const c of dinero) campos.push({ hoja: def.nombre, campo: c.campo, titulo: c.titulo, celdas: cuenta.get(c.campo) });
  }

  /* Los parámetros numéricos que sean dinero (hoy no hay ninguno: la plantilla ya no pide políticas) se tratan igual,
   * para que el día que alguno vuelva no quede sin convertir. */
  const parametros = { ...(h.parametros || {}) };
  for (const p of PARAMETROS) {
    if (p.tipo === "numero" && p.magnitud === "dinero" && _esNumero(parametros[p.clave])) {
      parametros[p.clave] = multiplicar(parametros[p.clave], factor);
      campos.push({ hoja: "Empresa", campo: p.clave, titulo: p.etiqueta, celdas: 1 });
    }
  }
  const dePantalla = monedaLimpia(moneda);
  const delArchivo = monedaLimpia(parametros.moneda);
  const deLaEmpresa = monedaLimpia(monedaHeredada);
  const monedaDeclarada = dePantalla || delArchivo || deLaEmpresa;
  if (!monedaDeclarada) {
    return { ok: false, sinMoneda: true,
      motivo: "falta declarar la moneda de los montos: el archivo no la trae y no se da por supuesta. No se activó nada" };
  }
  parametros.moneda = monedaDeclarada;
  salida.parametros = parametros;

  const registro = {
    valor: esc,
    factor,
    moneda: monedaDeclarada,
    origen: ORIGEN_DECLARACION,
    /* DE DÓNDE SALE CADA DECLARACIÓN: la moneda, de la pantalla, del archivo o de la empresa (carga anterior); la escala, siempre de la pantalla */
    fuente: { moneda: dePantalla ? FUENTES.pantalla : delArchivo ? FUENTES.archivo : FUENTES.empresa, escala: FUENTES.pantalla },
    packEn: "unidades de la moneda",
    transformacion: factor === 1 ? null : {
      operacion: `multiplicar por ${factor}`,
      motivo: `la empresa declaró que los montos están en miles; el motor los multiplicó por ${factor.toLocaleString("es-CL")} ` +
        "antes de calcular, para que todo el pack quede en unidades de la moneda",
      campos,
    },
  };
  return { ok: true, hechos: salida, registro };
}
