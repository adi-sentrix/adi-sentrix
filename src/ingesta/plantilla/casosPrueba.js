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
import { HOJAS, PARAMETROS, MARCA_PLANTILLA } from "../../config/contract/plantilla.js";
import { datosEjemplo } from "./generarPlantilla.js";

const anchoDe = (t) => Math.min(40, Math.max(12, String(t).length + 3));

/* Igual que `generarPlantilla`, pero pudiendo emitir un SUBCONJUNTO de columnas: es lo que hace un cliente que
 * llena solo lo obligatorio, y el caso mínimo no se puede armar sin eso. */
function hojaDe(def, filasDatos, valoresCabecera, campos = null) {
  const cols = campos ? def.columnas.filter((c) => campos.includes(c.campo)) : def.columnas;
  const cabecera = def.conCabecera
    ? [[MARCA_PLANTILLA], [], ...PARAMETROS.map((p) => [p.clave, valoresCabecera ? (valoresCabecera[p.clave] ?? null) : null]), []]
    : [];
  return {
    nombre: def.nombre,
    filas: [...cabecera, cols.map((c) => c.titulo), ...filasDatos.map((f) => cols.map((c) => f[c.campo] ?? null))],
    anchos: cols.map((c) => anchoDe(c.titulo)),
  };
}

const libro = (datos, campos = {}) => construirXlsx(
  HOJAS.filter((h) => datos[h.nombre] !== undefined)
       .map((h) => hojaDe(h, datos[h.nombre], datos.parametros, campos[h.nombre] || null)));

/* ── 1 · COMPLETO ────────────────────────────────────────────────────────────────────────────────────────────
 * Todas las columnas llenas y un ERP que publica sus propios días y rotación para TODOS los SKU. Prueba que
 * cuando el sistema del cliente ya tiene los KPI, ADI no le discute ninguno. */
function completo() {
  const d = datosEjemplo();
  const dohPorSku = { "TRM-800": 42, "TRM-450": 61, "SAN-LAV60": 185, "SAN-GRI22": 33, "ELE-CAB25": 118, "ELE-TAB12": 14 };
  const inventario = d.inventario.map((i) => ({
    ...i, doh: dohPorSku[i.sku], rotacion: Math.round((365 / dohPorSku[i.sku]) * 10) / 10,
  }));
  return libro({ parametros: d.parametros, Ventas: d.ventas, Inventario: inventario });
}

/* ── 2 · MÍNIMO ──────────────────────────────────────────────────────────────────────────────────────────────
 * Solo las columnas obligatorias: ni canal, ni marca, ni familia, ni bodega, ni acciones, ni precio de lista, y
 * un inventario sin fecha de última venta ni KPI. Es el archivo del cliente que llena lo justo, y es el caso que
 * de verdad importa: ADI tiene que calcular días y rotación, y DECIR qué partes de Sentrix se quedan cortas. */
function minimo() {
  const d = datosEjemplo();
  const ventas = d.ventas.map(({ periodo, cliente, sku, unidades, venta, costo }) => ({ periodo, cliente, sku, unidades, venta, costo }));
  /* Inventario SÍ lleva bodega: ahí es obligatoria, porque sin ella dos bodegas del mismo SKU son la misma
   * fila y el stock se pisa. En Ventas es opcional, y este caso la omite a propósito. */
  const inventario = d.inventario.map(({ fechaCorte, sku, bodega, stockUnd, stockUSD }) => ({ fechaCorte, sku, bodega, stockUnd, stockUSD }));
  return libro(
    { parametros: { ...d.parametros, empresa_id: "minimo", empresa_nombre: "Caso Mínimo S.A." }, Ventas: ventas, Inventario: inventario },
    { Ventas: ["periodo", "cliente", "sku", "unidades", "venta", "costo"], Inventario: ["fechaCorte", "sku", "bodega", "stockUnd", "stockUSD"] },
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
    if (i === 0) f.periodo = "ago-2026";      // período mal escrito
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
  const hojas = HOJAS.filter((h) => h.nombre === "Ventas" || h.nombre === "Inventario").map((h) => {
    const datos = h.nombre === "Ventas" ? ventas : d.inventario;
    const hj = hojaDe(h, datos, d.parametros);
    if (h.nombre === "Ventas") {
      const iEnc = hj.filas.findIndex((f) => f[0] === h.columnas[0].titulo);
      hj.filas[iEnc] = hj.filas[iEnc].map((t) => (t === "Venta" ? "Venta (miles)" : t));   // unidad ambigua
      hj.filas[iEnc] = [...hj.filas[iEnc], "Margen %"];                                     // KPI ya calculado
      hj.anchos = [...hj.anchos, 12];
    }
    return hj;
  });
  return construirXlsx(hojas);
}

export const CASOS = [
  { clave: "completo", archivo: "Caso_1_completo.xlsx", titulo: "COMPLETO · el ERP publica todo",
    que: "todas las columnas llenas y días/rotación informados para los 6 SKU",
    construir: completo,
    espera: { ok: true, diasInformados: 6, rotacionInformadas: 6, diasCalculados: 0, carasCompletas: 4 } },

  { clave: "minimo", archivo: "Caso_2_minimo.xlsx", titulo: "MÍNIMO · solo lo obligatorio",
    que: "sin canal, marca, familia, bodega, acciones ni precio de lista; ADI calcula días y rotación",
    construir: minimo,
    espera: { ok: true, diasInformados: 0, diasCalculados: 6, rotacionInformadas: 0 } },

  { clave: "malo", archivo: "Caso_3_malo.xlsx", titulo: "MALO · cinco problemas a la vez",
    que: "KPI ya calculado · unidad ambigua · período mal escrito · celda obligatoria vacía · SKU con dos marcas (6 bloqueos: romper el título de Venta la deja además ausente)",
    construir: maloCompleto,
    espera: { ok: false, tipos: ["columna-calculada", "unidad-ambigua", "columna-obligatoria-ausente",
                                 "periodo-mal-escrito", "celda-obligatoria-vacia", "atributo-incoherente"] } },
];
