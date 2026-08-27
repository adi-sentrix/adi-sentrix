/* === ingesta/plausibilidad.js · ADI LEE EL ARCHIVO ANTES DE ANALIZARLO (owner 2026-08-23) ====================
 *
 * LA IDEA, del owner: «los clientes pueden subir errores en sus datos. Nosotros no nos hacemos cargo de ellos,
 * pero sí de la interpretación. Si todo el inventario está sobre 90 días, tal vez hay un error: ADI debería
 * detectarlo y decir "acabé de leer tus datos y noto ciertas alarmas, ¿son errores?, ¿continuamos así?". Y si el
 * usuario dice que sí porque lo quiere probar, ADI debe entenderlo.»
 *
 * DÓNDE VA, y él lo decidió: ANTES de la primera respuesta. «El usuario sabrá que ya detectamos algo y deberá
 * confirmar si seguimos así.» Abrir con lo que se notó demuestra que ADI LEYÓ el archivo, no que solo lo cargó.
 *
 * ⚠️ ESTO NO ES EL VALIDADOR, Y NO LO REEMPLAZA. `validarPlantilla` tiene 22 chequeos y los 22 son de FORMA:
 * columnas, tipos, duplicados, coherencia. Todos contestan «¿el archivo está bien armado?». Ninguno se pregunta
 * «¿estas cifras tienen sentido como negocio?». Un archivo puede pasar los 22 y describir un negocio imposible.
 * Acá no se rechaza nada: el archivo ya es válido. Se LEE.
 *
 * ── LAS TRES REGLAS QUE LO SEPARAN DE UN DETECTOR DE RUIDO ───────────────────────────────────────────────────
 *  1. SE MIRA LA FORMA DEL CONJUNTO, NO LA FILA SUELTA. Que UN SKU tenga 200 días es un negocio; que los SIETE
 *     superen el techo huele a que faltó cargar la venta del mes. La alarma es el patrón, nunca el caso aislado.
 *  2. SE PROPONE LA CAUSA, NO SE AFIRMA. Cada alarma dice qué observó (con cifras) y cuál es la explicación más
 *     probable, EN FORMA DE PREGUNTA. Afirmar la causa rompería la regla 2 del proyecto — y además sería falso:
 *     es una hipótesis sobre el ARCHIVO, y quien sabe si es error o realidad es el dueño del dato.
 *  3. EL LISTÓN ALTO. Si avisa por todo, el usuario aprende a ignorarlo, y un candado que se ignora es peor que
 *     no tenerlo (ya pasó en este repo con una falsa alarma del gate del bundle). Por eso cada señal exige una
 *     MASA MÍNIMA de filas: con dos SKU no se diagnostica la forma de nada.
 *
 * ── LOS UMBRALES SON DEL NEGOCIO, NO DE ESTE MÓDULO ─────────────────────────────────────────────────────────
 * El techo de días y el piso de rotación salen de `businessPolicy` / de lo que el cliente declaró en la cabecera
 * de su plantilla. Acá no se escribe ningún «90»: se recibe el umbral y se mide contra él. Lo único que este
 * módulo declara es CUÁNTA PROPORCIÓN convierte un patrón en sospecha, que es su juicio y por eso está a la vista.
 *
 * PURO · sin red · sin modelo · no muta el dataset. Recibe lo que la ingesta ya armó y devuelve observaciones.
 */

/** La proporción a partir de la cual «varios» pasa a ser «casi todos» y deja de parecer un negocio. */
export const PROPORCION_SOSPECHOSA = 0.8;
/** Menos filas que esto y no se diagnostica la forma del conjunto: no hay conjunto. */
export const MASA_MINIMA = 4;

const _n = (v) => (typeof v === "number" && Number.isFinite(v) ? v : null);
const _pct = (a, b) => (b > 0 ? Math.round((a / b) * 100) : 0);

/**
 * leerPlausibilidad(dataset, { umbrales }) → { alarmas: [], hayAlarmas: bool }
 * Cada alarma: { tipo, que, probable, filas }
 *   · `que`      — lo OBSERVADO, con cifras. Es un hecho del archivo.
 *   · `probable` — la explicación más probable, EN PREGUNTA. Es una hipótesis, y se nota.
 */
export function leerPlausibilidad(dataset, { umbrales = {}, filasPorPeriodo = null } = {}) {
  const d = dataset && typeof dataset === "object" ? dataset : {};
  const inv = Array.isArray(d.skuInventario) ? d.skuInventario : [];
  const sm = Array.isArray(d.skusMargen) ? d.skusMargen : [];
  const alarmas = [];
  const A = (tipo, que, probable, filas = []) => alarmas.push({ tipo, que, probable, filas });

  const undDe = (nombre) => { const s = sm.find((x) => x.nombre === nombre); return s ? _n(s.unidades) : null; };

  /* 1 · CASI TODO EL INVENTARIO SOBRE EL TECHO — el caso que puso el owner.
   * Un negocio real tiene algunos SKU lentos. Si los tiene TODOS, lo más probable es que el denominador esté
   * incompleto: se cargó el stock pero no la venta del período, y entonces cada SKU «dura» una eternidad. */
  const techo = _n(umbrales.dohMax);
  if (techo !== null && inv.length >= MASA_MINIMA) {
    const sobre = inv.filter((r) => { const v = _n(r.doh); return v !== null && v > techo; });
    if (sobre.length / inv.length >= PROPORCION_SOSPECHOSA) {
      A("inventario-casi-todo-sobre-el-techo",
        `${sobre.length} de ${inv.length} SKU (${_pct(sobre.length, inv.length)}%) superan los ${techo} días de inventario que declaraste como techo`,
        "Cuando pasa con casi todo el inventario, lo más común es que falte cargar la venta del período — sin venta suficiente, el stock parece durar para siempre. ¿Es así, o tu inventario está realmente tan quieto?",
        sobre.map((r) => r.sku));
    }
  }

  /* 2 · STOCK QUE NO VENDIÓ NADA. Distinto del anterior: acá el SKU no aparece en la venta del período. */
  if (inv.length >= MASA_MINIMA) {
    const mudos = inv.filter((r) => { const u = undDe(r.sku); return u === null || u === 0; });
    if (mudos.length / inv.length >= PROPORCION_SOSPECHOSA) {
      A("stock-sin-ninguna-venta",
        `${mudos.length} de ${inv.length} SKU tienen stock pero ninguna venta en el período informado`,
        "Suele pasar cuando la hoja de ventas quedó de otro mes, o cuando se cargó el inventario antes que las ventas. ¿Falta ese movimiento, o son SKU que efectivamente no rotaron?",
        mudos.map((r) => r.sku));
    }
  }

  /* 3 · VENDIÓ ALGO QUE NO ESTÁ EN INVENTARIO. Una fila sola es normal (se agotó); muchas indican dos archivos
   * que no hablan del mismo catálogo — y ahí toda comparación entre venta y stock queda coja. */
  if (sm.length >= MASA_MINIMA && inv.length > 0) {
    const huerfanos = sm.filter((s) => _n(s.unidades) > 0 && !inv.some((r) => r.sku === s.nombre));
    if (huerfanos.length >= Math.max(2, Math.ceil(sm.length * 0.5))) {
      A("venta-de-skus-que-no-estan-en-inventario",
        `${huerfanos.length} de ${sm.length} SKU vendieron en el período pero no aparecen en la hoja de inventario`,
        "Puede ser que se hayan agotado, o que las dos hojas estén describiendo catálogos distintos. ¿Los sigues teniendo?",
        huerfanos.map((s) => s.nombre));
    }
  }

  /* 4 · CIFRAS QUE NO PUEDEN SER. Acá NO hace falta masa mínima: un solo margen negativo es un hecho duro, no
   * una forma. Y es la señal más barata de todas para el usuario, porque casi siempre es una celda mal pegada. */
  const imposibles = sm.filter((s) => {
    const v = _n(s.venta), c = _n(s.costo), m = _n(s.margen);
    return (v !== null && c !== null && c > v) || (m !== null && (m < 0 || m > 100));
  });
  if (imposibles.length) {
    A("cifras-imposibles",
      `${imposibles.length} ${imposibles.length === 1 ? "fila tiene" : "filas tienen"} costo mayor que la venta, o un margen fuera de 0-100%`,
      "Casi siempre es una columna corrida o un monto pegado en la celda de al lado. ¿Lo revisas, o seguimos con estos números tal como están?",
      imposibles.map((s) => s.nombre));
  }
  /* 5 · UN PERÍODO CARGADO A MEDIAS. Si el mes de comparación trae una fracción de las filas del actual, la
   * variación va a decir que el negocio se derrumbó o explotó, y sería un artefacto de la carga.
   * ⚠️ EL CONTEO POR PERÍODO LO PASA QUIEN LLAMA, y no es un capricho: el dataset NO lo lleva —`historialMargen`
   * es un objeto, no filas contadas— así que leerlo de ahí habría sido un chequeo MUERTO, verde para siempre y
   * sin poder disparar nunca. Lo descubrí probándolo. Quien ingesta el archivo sí sabe cuántas filas trajo cada
   * período; si no lo pasa, esta señal simplemente no aplica, y eso está declarado en vez de disimulado. */
  const cuentas = Object.values(filasPorPeriodo || {}).map((x) => _n(x) || 0).filter((x) => x > 0);
  if (cuentas.length >= 2) {
    const min = Math.min(...cuentas), max = Math.max(...cuentas);
    if (max >= MASA_MINIMA && min / max <= 0.34) {
      A("periodo-cargado-a-medias",
        `un período trae ${min} filas de venta y el otro ${max}: uno de los dos está mucho menos cargado`,
        "Si el mes de comparación quedó incompleto, la variación contra el período anterior va a mostrar un salto que es de la carga y no del negocio. ¿Está completo?",
        []);
    }
  }


  return { alarmas, hayAlarmas: alarmas.length > 0 };
}

/**
 * textoDeApertura(lectura, { archivo }) → el mensaje con el que ADI ABRE, o null si no hay nada que decir.
 * Sin alarmas devuelve null a propósito: no se saluda con «no encontré problemas». Un asesor que no tiene nada
 * que observar simplemente contesta la pregunta.
 */
export function textoDeApertura(lectura, { archivo = null } = {}) {
  if (!lectura || !lectura.hayAlarmas) return null;
  const n = lectura.alarmas.length;
  const cabeza = archivo
    ? `Acabo de leer ${archivo}. Antes de analizarlo, ${n === 1 ? "hay algo" : `hay ${n} cosas`} que me ${n === 1 ? "llama" : "llaman"} la atención:`
    : `Acabo de leer tus datos. Antes de analizarlos, ${n === 1 ? "hay algo" : `hay ${n} cosas`} que me ${n === 1 ? "llama" : "llaman"} la atención:`;
  const cuerpo = lectura.alarmas.map((a, i) => `${n > 1 ? `${i + 1}. ` : ""}${a.que}.\n   ${a.probable}`);
  /* EL CIERRE ES UNA PREGUNTA REAL, y por eso ofrece las dos salidas. El owner: «si el usuario dice que sí
   * porque lo quiere probar, ADI debe entenderlo». No se lo empuja a corregir nada — es su dato. */
  const cierre = "Puedes corregir el archivo y volver a subirlo, o seguimos con estos números tal como están y lo tengo en cuenta al leerlos. ¿Cómo prefieres?";
  return [cabeza, "", ...cuerpo, "", cierre].join("\n");
}

/**
 * selloDeLaLectura(lectura, { confirmado }) → la marca que ACOMPAÑA a las cifras después de que el usuario
 * decidió seguir. La alarma no desaparece porque el usuario dijo que sí.
 *
 * ⚠️ ESTO ES LA MITAD QUE IMPORTA. Si ADI avisa y después presenta «$99K inmovilizado» como si nada, convirtió
 * una advertencia en una cifra confiada — que es exactamente lo que la proporcionalidad semántica prohíbe. El
 * sello viaja igual que `procedencia` en días y rotación: pegado al número, no en una nota que alguien recuerda.
 */
/* ── QUÉ CONTAMINA CADA OBSERVACIÓN (owner 2026-08-25) ────────────────────────────────────────────────────────
 * La regla del owner: «no debe hablar como si el dato estuviera limpio; debe mencionar el sello cuando la
 * respuesta use una métrica afectada por esa observación». Eso obliga a declarar, señal por señal, QUÉ lecturas
 * quedan tocadas — porque mencionarlo en toda respuesta sería ruido, y no mencionarlo nunca sería mentir.
 *
 * ⚠️ EL ALCANCE ES ESTRECHO A PROPÓSITO, y es la mitad del diseño. «Un período cargado a medias» NO ensucia la
 * venta del mes: esa cifra es la suma de las filas que el archivo trae, y es un hecho. Lo que queda tocado es la
 * COMPARACIÓN contra el otro período — que es exactamente lo que dice la alarma. Estirar el alcance a todo lo
 * que huela a venta haría sonar el sello en cada turno, y un aviso que suena siempre es un aviso que se ignora.
 *
 * `enUnaLinea` es la frase que ADI dice en voz alta. Vive acá, junto a la señal que la origina, para que no haya
 * dos redacciones del mismo hallazgo. Un tipo nuevo sin entrada acá lo caza `_sello_en_respuesta_gate`. */
export const DOMINIOS_POR_ALARMA = {
  "inventario-casi-todo-sobre-el-techo": {
    dominios: ["inventario"],
    enUnaLinea: "casi todo el inventario supera el techo de días que declaraste",
  },
  "stock-sin-ninguna-venta": {
    dominios: ["inventario"],
    enUnaLinea: "casi todos los SKU tienen stock pero ninguna venta en el período",
  },
  "venta-de-skus-que-no-estan-en-inventario": {
    dominios: ["inventario"],
    enUnaLinea: "hay SKU que vendieron y no aparecen en la hoja de inventario",
  },
  "cifras-imposibles": {
    dominios: ["margen"],
    enUnaLinea: "hay filas con costo mayor que la venta, o con el margen fuera de rango",
  },
  "periodo-cargado-a-medias": {
    dominios: ["comparacion"],
    enUnaLinea: "el período anterior tiene menos filas cargadas",
  },
};

export function selloDeLaLectura(lectura, { confirmado = false } = {}) {
  if (!lectura || !lectura.hayAlarmas) return null;
  const tipos = lectura.alarmas.map((a) => a.tipo);
  /* CADA OBSERVACIÓN VIAJA CON SU ALCANCE Y SU FRASE. Sin esto, quien tenga que decidir si mencionar el sello
   * tendría que volver a mapear los tipos por su cuenta — y ahí nacen las dos verdades. Un tipo sin entrada en
   * el mapa viaja igual, con dominios vacíos: se declara el hueco en vez de inventarle un alcance. */
  const observaciones = lectura.alarmas.map((a) => {
    const d = DOMINIOS_POR_ALARMA[a.tipo] || null;
    return { tipo: a.tipo, dominios: d ? d.dominios : [], enUnaLinea: d ? d.enUnaLinea : null };
  });
  return {
    conAlarmas: true,
    confirmadoPorElUsuario: !!confirmado,
    tipos,
    observaciones,
    nota: _notaDelSello(tipos, confirmado),
  };
}

/* LA REDACCIÓN, EN UN SOLO LUGAR. Se extrajo cuando la confirmación pasó a ocurrir en otro momento que la
 * lectura (vía 3 · 3.d): al activar una versión guardada ya no hay `lectura` a mano, solo el sello guardado, y
 * volver a redactar la nota ahí habría creado una SEGUNDA VERDAD sobre el mismo hallazgo — el defecto que este
 * producto persigue en todas sus superficies. Las dos rutas pasan por acá, y el candado lo comprueba. */
function _notaDelSello(tipos, confirmado) {
  return confirmado
    ? `sobre datos que confirmaste, con ${tipos.length === 1 ? "una observación abierta" : `${tipos.length} observaciones abiertas`}`
    : `hay ${tipos.length === 1 ? "una observación" : `${tipos.length} observaciones`} sin resolver sobre este archivo`;
}

/* confirmarSello(sello) → el mismo sello, ya asumido por el usuario.
 * Se usa al ACTIVAR una versión guardada: confirmar y activar son el mismo acto, y hasta ese momento la fila
 * guardada dice —con razón— que el usuario no decidió. Un sello sin alarmas no se toca: no hay nada que asumir. */
export function confirmarSello(sello) {
  if (!sello || !sello.conAlarmas) return sello || null;
  const tipos = Array.isArray(sello.tipos) ? sello.tipos : [];
  return { ...sello, confirmadoPorElUsuario: true, nota: _notaDelSello(tipos, true) };
}
