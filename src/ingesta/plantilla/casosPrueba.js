/* === ingesta/plantilla/casosPrueba.js · TRES ARCHIVOS QUE PRUEBAN LA PLANTILLA (v1 · 2026-08-23) ==============
 *
 * El owner pidió probarla con tres archivos antes de pensar en pantalla: uno completo, uno mínimo y uno malo.
 * Están acá y no sueltos en una carpeta por dos razones. Un .xlsx guardado a mano se desincroniza del contrato
 * en la primera semana —el mismo motivo por el que la plantilla se genera y no se versiona—; y un caso de prueba
 * sin la afirmación de QUÉ debe probar es un archivo, no una prueba: el día que el resultado cambie, nadie sabrá
 * si mejoró o se rompió. Por eso cada caso declara su `espera`, y el candado la verifica.
 *
 * TODO ES SINTÉTICO. Entidades inventadas, ningún dato de ningún cliente real (restricción vigente del owner).
 */
import { construirXlsx } from "../escribirLibro.js";
import { HOJAS, PARAMETROS, MARCA_PLANTILLA, HOJA_EMPRESA } from "../../config/contract/plantilla.js";
import { datosEjemplo } from "./generarPlantilla.js";

const anchoDe = (t) => Math.min(40, Math.max(12, String(t).length + 3));

/* Igual que `generarPlantilla`, pero pudiendo emitir un SUBCONJUNTO de columnas: es lo que hace un cliente que
 * llena solo lo obligatorio, y el caso mínimo no se puede armar sin eso. */
function hojaDe(def, filasDatos, valoresCabecera, campos = null) {
  const cols = campos ? def.columnas.filter((c) => campos.includes(c.campo)) : def.columnas;
  const cabecera = def.conCabecera
    ? [[MARCA_PLANTILLA], [], ...PARAMETROS.map((p) => [p.etiqueta, valoresCabecera ? (valoresCabecera[p.clave] ?? null) : null]), []]
    : [];
  return {
    nombre: def.nombre,
    filas: [...cabecera, cols.map((c) => c.titulo), ...filasDatos.map((f) => cols.map((c) => f[c.campo] ?? null))],
    anchos: cols.map((c) => anchoDe(c.titulo)),
  };
}

/* La hoja «Empresa» va SIEMPRE, y primero: desde 2026-08-26 ahí vive la marca del archivo y los datos del
 * negocio, así que un libro sin ella no es la plantilla y el validador lo rechaza antes de mirar nada más. */
const hojaEmpresaDe = (parametros) => ({
  nombre: HOJA_EMPRESA,
  filas: [[MARCA_PLANTILLA], [], ...PARAMETROS.map((p) => [p.etiqueta, (parametros || {})[p.clave] ?? null])],
});
const libro = (datos, campos = {}) => construirXlsx([
  hojaEmpresaDe(datos.parametros),
  ...HOJAS.filter((h) => datos[h.nombre] !== undefined)
          .map((h) => hojaDe(h, datos[h.nombre], datos.parametros, campos[h.nombre] || null)),
]);

/* ── 1 · COMPLETO ────────────────────────────────────────────────────────────────────────────────────────────
 * Todas las columnas que la plantilla ofrece, incluidas las opcionales. Desde el contrato v1 de Inventario
 * (owner 2026-08-26) eso ya NO incluye días ni rotación: la hoja pide hechos, no KPIs. La única opcional que le
 * queda a Inventario es la bodega, y este caso la trae — así el cálculo va por SKU+bodega. */
function completo() {
  const d = datosEjemplo();
  return libro({ parametros: d.parametros, Ventas: d.ventas, Inventario: d.inventario });
}

/* ── 2 · MÍNIMO ──────────────────────────────────────────────────────────────────────────────────────────────
 * Solo las columnas obligatorias: ni canal, ni marca, ni familia, ni bodega, ni acciones, ni precio de lista —
 * y un inventario de DOS columnas, SKU y stock. Es el archivo del cliente que llena lo justo, y es el caso que
 * de verdad importa: ADI tiene que valorizar el stock, calcular días y rotación, y DECIR qué se queda corto.
 *
 * ⚠️ ACÁ LA BODEGA NO VA, y es deliberado desde 2026-08-26: dejó de ser obligatoria en Inventario. Un negocio
 * de una sola bodega estaba obligado a llenar una columna que no le dice nada. Sin bodega, todo se calcula por
 * SKU total — y el motor lo DECLARA en los avisos en vez de disimularlo. */
function minimo() {
  const d = datosEjemplo();
  /* ⚠️ EL FOLIO ENTRA AL MÍNIMO (v2 · owner 2026-08-30): pasó a ser obligatorio, así que un archivo sin él ya
   * no es «el mínimo», es un archivo que se rechaza. La hoja Abonos NO entra: es opcional, y este caso existe
   * justamente para probar que se puede cargar sin lo opcional — quien no la llena no ve Flujo Comercial. */
  const ventas = d.ventas.map(({ fecha, cliente, folio, sku, unidades, venta, costo }) => ({ fecha, cliente, folio, sku, unidades, venta, costo }));
  const inventario = d.inventario.map(({ sku, stockUnd }) => ({ sku, stockUnd }));
  return libro(
    { parametros: { ...d.parametros, empresa_id: "minimo", empresa_nombre: "Caso Mínimo S.A." }, Ventas: ventas, Inventario: inventario },
    { Ventas: ["cliente", "fecha", "folio", "sku", "unidades", "venta", "costo"], Inventario: ["sku", "stockUnd"] },
  );
}

/* ── 3 · MALO ────────────────────────────────────────────────────────────────────────────────────────────────
 * Cinco problemas DISTINTOS a la vez, a propósito. Un validador que se detiene en el primero condena al usuario
 * a subir el archivo cinco veces; el que los junta todos lo hace corregir una sola. Eso es lo que se prueba acá:
 * no que rechace —eso ya está probado— sino que rechace TODO junto y con la fila a la vista. */
function malo() {
  const d = datosEjemplo();
  const ventas = d.ventas.map((v, i) => {
    const f = { ...v };
    if (i === 0) f.fecha = "ago-2026";         // fecha mal escrita (desde 2026-08-26 la columna es aaaa-mm-dd)
    if (i === 3) f.unidades = null;           // celda obligatoria vacía (en Unidades, no en Venta:
                                              // a Venta se le rompe el encabezado más abajo y la columna deja de existir)
    if (i === 5) f.marca = "MarcaFantasma";   // el mismo SKU con dos marcas
    return f;
  });
  const libroBase = libro({ parametros: d.parametros, Ventas: ventas, Inventario: d.inventario });
  return { bytes: libroBase, ventas };
}

/* Los dos problemas que faltan son de ENCABEZADO, así que se aplican sobre las filas antes de escribir. */
function maloCompleto() {
  const d = datosEjemplo();
  const ventas = malo().ventas;
  const hojas = [hojaEmpresaDe(d.parametros), ...HOJAS.filter((h) => h.nombre === "Ventas" || h.nombre === "Inventario").map((h) => {
    const datos = h.nombre === "Ventas" ? ventas : d.inventario;
    const hj = hojaDe(h, datos, d.parametros);
    if (h.nombre === "Ventas") {
      const iEnc = hj.filas.findIndex((f) => f[0] === h.columnas[0].titulo);
      hj.filas[iEnc] = hj.filas[iEnc].map((t) => (t === "venta" ? "venta (miles)" : t));     // unidad ambigua
      hj.filas[iEnc] = [...hj.filas[iEnc], "Margen %"];                                     // KPI ya calculado
      hj.anchos = [...hj.anchos, 12];
    }
    return hj;
  })];
  return construirXlsx(hojas);
}

export const CASOS = [
  { clave: "completo", archivo: "Caso_1_completo.xlsx", titulo: "COMPLETO · el ERP publica todo",
    que: "todas las columnas que ofrece la plantilla, incluida la bodega: el cálculo va por SKU+bodega",
    construir: completo,
    espera: { ok: true, diasInformados: 0, rotacionInformadas: 0, diasCalculados: 6, carasCompletas: 4, conBodega: true } },

  { clave: "minimo", archivo: "Caso_2_minimo.xlsx", titulo: "MÍNIMO · solo lo obligatorio",
    que: "inventario de dos columnas (SKU y stock); ADI valoriza, calcula días y rotación, y declara que va por SKU total",
    construir: minimo,
    espera: { ok: true, diasInformados: 0, diasCalculados: 6, rotacionInformadas: 0, conBodega: false } },

  { clave: "malo", archivo: "Caso_3_malo.xlsx", titulo: "MALO · cinco problemas a la vez",
    que: "KPI ya calculado · unidad ambigua · fecha mal escrita · celda obligatoria vacía · SKU con dos marcas (6 bloqueos: romper el título de Venta la deja además ausente)",
    construir: maloCompleto,
    espera: { ok: false, tipos: ["columna-calculada", "unidad-ambigua", "columna-obligatoria-ausente",
                                 "fecha-mal-escrita", "celda-obligatoria-vacia", "atributo-incoherente"] } },
];
