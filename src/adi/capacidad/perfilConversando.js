/* === src/adi/capacidad/perfilConversando.js · EL PERFIL SE COMPLETA CONVERSANDO (Etapa 2, bloque 2 · owner 2026-09-25) ═
 * LEY DEL OWNER (2026-09-25, aprobada completa; no se reabre): «el perfil se completa conversando con el LLM; misma
 * taxonomía y significados ya aprobados; preguntar lo necesario de forma natural; recordarlo en la empresa; no volver a
 * preguntar sin motivo. Sin perfil el Core funciona; solo se limita lo que necesita ese contexto.» Y la de siempre:
 * «la comprensión del lenguaje es del LLM» — ADI NO construye reconocedores de frases.
 *
 * EL REPARTO (el mismo del resto de la capacidad):
 *   · el ANFITRIÓN (el LLM) entiende lo que la persona dice y devuelve un valor TIPADO: el código de una opción;
 *   · ADI dice QUÉ falta (estructurado: `necesitaPerfil`), ofrece LA pregunta con las opciones válidas de la taxonomía
 *     (`preguntasDelPerfil`), valida el valor tipado contra esa taxonomía (`continuidad/empresa.js:declararPerfilCampo`)
 *     y lo guarda con origen «declarado». La confirmación es un sello aparte y no cambia el origen.
 * Nada acá lee texto libre del usuario ni de una pregunta: todo lo que entra es un encargo ya tipado (sus `partes[].tema`)
 * o un código. Cero llamadas a un modelo, cero red.
 *
 * LAS TRES PIEZAS DE ESTE ARCHIVO
 *   1 · `ROTULOS_PERFIL` + `preguntasDelPerfil`: lo que ve la persona (rótulo, pregunta, significado de cada opción), en UN
 *       solo lugar, y las OPCIONES salen de la taxonomía (`TAXONOMIA_PERFIL`) — nunca una segunda lista escrita a mano:
 *       un código nuevo de la taxonomía sin rótulo aquí lo marca el candado `_perfil_conversando_gate`.
 *       Redactado en tercera persona, sin trato (la Entrega no le habla a nadie — owner 2026-09-26): el anfitrión
 *       adapta el tono. Los significados son los de la propuesta aprobada (`_ADI_PERFIL_VOCABULARIOS_PROPUESTA.md` §1-§5).
 *   2 · `necesitaPerfil(encargo)`: de lo que se PIDIÓ, qué campos del perfil harían falta — y solo esos. La regla sale de los
 *       datos, no de una lista de palabras: una pieza de conocimiento del oficio FIRMADA, pertinente al tema del encargo
 *       (por los predicados de su pertinencia), decide con su `alcance` a qué empresas aplica; un campo hace falta si la
 *       pieza lo restringe, la empresa no lo declaró y lo ya declarado no la descarta (un sector «servicios» descarta una
 *       pieza de distribución: ya no hace falta preguntar a quién vende). Si no falta nada, no pide nada. De a UNA pregunta.
 *   3 · `armarPerfilConversando`: el bloque `perfil` que viaja en `consultar` — la pregunta (una sola, nunca repetida si ya
 *       se respondió o se omitió en esa conversación), lo que quedó por confirmar y lo que se limita por una omisión.
 *
 * ⚠️ HOY EL PERFIL SOLO HACE FALTA SI EL CONOCIMIENTO DEL OFICIO ESTÁ ENCENDIDO (`ADI_CONOCIMIENTO`, apagado en todos los
 * perfiles): con la bandera apagada ninguna referencia del oficio se sirve aunque el perfil esté completo, así que
 * preguntar no sirve para nada y no se pregunta («preguntar solo lo necesario»). Esa decisión es de la bandera, no de este
 * archivo: `activo` se inyecta (los candados la encienden). La regla de QUÉ se entrega sin perfil completo NO se toca acá
 * (sigue en `conocimiento/seleccionar.js` hasta que el bloque 6 —universal vs localizado— se decida).
 *
 * Puro: sin I/O propio — las funciones que leen la memoria reciben el almacén por parámetro. */
import { TAXONOMIA_PERFIL, SECTORES_CON_TIPO_PRODUCTO } from "../../config/contract/taxonomiaPerfil.js";
import { PIEZAS_CONOCIMIENTO } from "../conocimiento/piezas.js";
import { ADI_CONOCIMIENTO } from "../../config/voiceFlags.js";
import { CAMPOS_PERFIL_DECLARABLES, LISTA_DE_CAMPO_PERFIL, yaFueOmitido, conceptoDePerfil } from "../continuidad/empresa.js";

/* ═══ 1 · LOS RÓTULOS Y LOS SIGNIFICADOS (la propuesta aprobada, una sola vez) ═══════════════════════════════════════ */
export const ROTULOS_PERFIL = Object.freeze({
  sector: {
    rotulo: "sector", conArticulo: "el sector",
    pregunta: "¿Qué hace la empresa con lo que vende?",
    aclaracion: "Si hace más de una cosa, se elige la que explica la mayor parte de su venta.",
    significado: "Separa a las empresas por lo que hacen con lo que venden, no por lo que venden: el mismo producto se trabaja distinto si se compra hecho, se fabrica, se vende al público o se instala.",
    paraQue: "Con el sector ADI sabe a qué empresas aplican las referencias del oficio; sin él no se aplican y la consulta se responde igual, con los datos de la empresa.",
    opciones: {
      distribucion: { rotulo: "Distribución y venta mayorista", significado: "Compra productos terminados y los revende a otras empresas: importadores, distribuidores, mayoristas." },
      fabricacion: { rotulo: "Fabricación y producción", significado: "Produce lo que vende: industria, agroindustria, alimentos, envases, metalmecánica." },
      minorista: { rotulo: "Comercio minorista", significado: "Vende al consumidor final, en tienda o en línea." },
      servicios: { rotulo: "Servicios", significado: "Vende trabajo, tiempo o capacidad, no productos: consultoría, logística, software, servicios profesionales o técnicos." },
      obras: { rotulo: "Obras y proyectos por contrato", significado: "Ejecuta obras o proyectos por contrato: construcción, montaje, ingeniería, instalaciones." },
      ninguno: { rotulo: "Ninguna de estas", significado: "Ninguna de las anteriores describe a la empresa. Se guarda como respuesta (no es «sin responder»)." },
    },
  },
  tipoProducto: {
    rotulo: "tipo de producto", conArticulo: "el tipo de producto",
    pregunta: "¿Qué tipo de producto es la mayor parte de lo que vende la empresa?",
    aclaracion: "Solo aplica a distribución, fabricación y minorista.",
    significado: "Es el comportamiento del inventario, no el rubro: cuánto rota y qué pasa con lo que no se vende a tiempo.",
    paraQue: "Con el tipo de producto ADI sabe qué rotación de inventario es sana para la empresa.",
    opciones: {
      vence: { rotulo: "Con fecha de vencimiento", significado: "Alimentos, bebidas, farmacia u otros productos con fecha de vencimiento: rotan en días o semanas y el stock inmovilizado es merma, no solo capital." },
      consumo: { rotulo: "Consumo frecuente sin fecha crítica", significado: "Aseo, hogar, librería, ferretería: rotación rápida, margen bajo, poca obsolescencia." },
      durable: { rotulo: "Bienes durables", significado: "Electrodomésticos, muebles, tecnología, herramientas, repuestos: rotación en meses, ticket alto, estacionalidad fuerte." },
      temporada: { rotulo: "Vestuario, calzado y temporada", significado: "El inventario vale por temporada: lo que no se vendió a tiempo se liquida." },
      insumos: { rotulo: "Insumos y equipos para otras empresas", significado: "Insumos, materiales o equipos para otras empresas: venta técnica, plazos largos, tickets grandes, rotación irregular." },
    },
  },
  modeloComercial: {
    rotulo: "modelo comercial", conArticulo: "el modelo comercial",
    pregunta: "¿A quién le vende la empresa la mayor parte de lo que vende?",
    aclaracion: "Se pregunta por la mayor parte: lo demás lo muestra el dato. La concentración de clientes no se declara, la mide ADI.",
    significado: "Es el tipo de contraparte, no cuántos clientes tiene: de él depende el poder de negociación, los plazos de pago usuales y el riesgo de crédito.",
    paraQue: "Con el modelo comercial ADI sabe qué plazos y qué poder de negociación son los usuales para la empresa.",
    opciones: {
      cuentas_grandes: { rotulo: "A pocas cuentas grandes", significado: "Cadenas de retail o grandes empresas: el poder lo tiene el comprador y perder una cuenta es riesgo de continuidad." },
      comercios: { rotulo: "A muchos comercios y empresas pequeñas o medianas", significado: "Poder equilibrado; el riesgo de crédito está repartido y la cobranza es trabajo de volumen." },
      consumidor: { rotulo: "A personas, como consumidor final", significado: "Cobro inmediato; no hay eje «cliente»." },
      publico: { rotulo: "Al Estado o a empresas públicas", significado: "Licitaciones y plazos legales que no siempre se cumplen: cobranza lenta y previsible." },
    },
  },
  pais: {
    rotulo: "país", conArticulo: "el país",
    pregunta: "¿En qué país está la mayor parte de la venta de la empresa?",
    aclaracion: "Lista cerrada. No se deduce de la moneda: varios países comparten moneda.",
    significado: "Es el país donde está la mayor parte de la venta: cambian el plazo legal de pago, el calendario, la práctica de cobranza y las cadenas.",
    paraQue: "Con el país ADI sabe qué plazos legales, qué calendario y qué referencias locales corresponden.",
    opciones: {
      CL: { rotulo: "Chile" }, AR: { rotulo: "Argentina" }, BO: { rotulo: "Bolivia" }, CO: { rotulo: "Colombia" }, CR: { rotulo: "Costa Rica" },
      CU: { rotulo: "Cuba" }, EC: { rotulo: "Ecuador" }, SV: { rotulo: "El Salvador" }, GT: { rotulo: "Guatemala" }, HN: { rotulo: "Honduras" },
      MX: { rotulo: "México" }, NI: { rotulo: "Nicaragua" }, PA: { rotulo: "Panamá" }, PY: { rotulo: "Paraguay" }, PE: { rotulo: "Perú" },
      DO: { rotulo: "República Dominicana" }, UY: { rotulo: "Uruguay" }, VE: { rotulo: "Venezuela" }, BR: { rotulo: "Brasil" }, ES: { rotulo: "España" },
    },
  },
});

/** opcionesDeCampo(campo) → [{ codigo, rotulo, significado? }] · SALEN DE LA TAXONOMÍA (el orden y los códigos son los de
 *  `TAXONOMIA_PERFIL`); el rótulo y el significado, de `ROTULOS_PERFIL`. Un código sin rótulo se entrega con el código
 *  como rótulo (nunca desaparece una opción válida) y el candado del gate lo marca. */
export function opcionesDeCampo(campo) {
  const lista = TAXONOMIA_PERFIL[LISTA_DE_CAMPO_PERFIL[campo]] || [];
  const R = (ROTULOS_PERFIL[campo] && ROTULOS_PERFIL[campo].opciones) || {};
  return lista.map((codigo) => ({ codigo, rotulo: (R[codigo] && R[codigo].rotulo) || codigo, ...(R[codigo] && R[codigo].significado ? { significado: R[codigo].significado } : {}) }));
}

/** preguntasDelPerfil(campos?) → [Pregunta] · la pregunta de cada campo, con su significado y sus opciones, en el orden
 *  en que ADI las hace (sector → tipo de producto → modelo comercial → país). `comoResponder` es la forma EXACTA del
 *  aporte que el anfitrión devuelve (el código de la opción elegida, nunca texto libre) y de la omisión. */
export function preguntasDelPerfil(campos = CAMPOS_PERFIL_DECLARABLES) {
  return CAMPOS_PERFIL_DECLARABLES.filter((c) => campos.includes(c)).map((campo) => {
    const R = ROTULOS_PERFIL[campo];
    return {
      campo, rotulo: R.rotulo, pregunta: R.pregunta, aclaracion: R.aclaracion, significado: R.significado, paraQue: R.paraQue,
      aplicaA: campo === "tipoProducto" ? [...SECTORES_CON_TIPO_PRODUCTO] : null,
      omitible: true,
      opciones: opcionesDeCampo(campo),
      comoResponder: {
        herramienta: "aportarContexto",
        aporte: { clase: "perfil", concepto: campo, valor: "<código de la opción que la persona eligió>" },
        siNoQuiereResponder: { omitir: [campo] },
      },
    };
  });
}

/* ═══ 2 · QUÉ CAMPOS HARÍAN FALTA PARA LO QUE SE PIDIÓ ═══════════════════════════════════════════════════════════════ */
/* De qué tema (dominio) es cada predicado de pertinencia de una pieza — la tabla que une dos vocabularios INTERNOS (el de
 * los predicados y el de los dominios del encargo), no una lista de palabras del usuario. `null` = neutro: el predicado
 * no dice de qué dominio es la pieza (habla de la respuesta, del período o de la métrica). El candado del gate exige
 * que TODO predicado de `PREDICADOS_CERRADOS` esté acá: un predicado nuevo obliga a decidir su tema. */
export const TEMA_DE_PREDICADO = Object.freeze({
  "cuenta.bajo_benchmark": "comercial", "cuenta.carga_alta": "comercial", "cuenta.variacion_venta_neg": "comercial", "cuenta.variacion_venta_pos": "comercial",
  "cuenta.vencido_positivo": "cobranza", "cuenta.al_dia": "cobranza", "cuenta.sin_plazo_declarado": "cobranza",
  "sku.inmovilizado_critico": "inventario", "sku.top_seller": "inventario", "sku.estado_critico": "inventario",
  "pregunta.tema_comercial": "comercial", "pregunta.tema_cobranza": "cobranza", "pregunta.tema_inventario": "inventario",
  "cuenta.en_respuesta": null, "cuenta.prioridad_primera": null, "cuenta.contraparte_cadena": null, "cuenta.contraparte_comercio": null,
  "cuenta.grupo_declarado": null, "periodo.abierto": null, "pregunta.tema_prioridad": null, "pregunta.metrica_margen": null,
  "pregunta.metrica_carga": null, "pregunta.metrica_plazos": null, "pregunta.sujeto_abierto": null,
});

/* los temas que nombra la pertinencia de una pieza (recorre `todo` · `alguno` · `no`). Una pieza sin ningún predicado
 * de dominio (todos neutros) no está atada a un tema: aplica a cualquier encargo. */
function _temasDeLaPieza(pieza) {
  const temas = new Set();
  const visitar = (n) => {
    if (typeof n === "string") { const t = TEMA_DE_PREDICADO[n]; if (t) temas.add(t); return; }
    if (!n || typeof n !== "object") return;
    for (const h of (Array.isArray(n.todo) ? n.todo : [])) visitar(h);
    for (const h of (Array.isArray(n.alguno) ? n.alguno : [])) visitar(h);
    if (n.no != null) visitar(n.no);
  };
  visitar(pieza && pieza.pertinencia);
  return temas;
}

/* campo del perfil → su llave en el `alcance` de una pieza (`banda` es el tamaño: se deriva, nunca se pregunta) */
const _LLAVE_DE_ALCANCE = Object.freeze({ sector: "sector", tipoProducto: "tipoProducto", modeloComercial: "modeloComercial", pais: "pais" });

/* los temas (dominios) del encargo: salen de lo ya TIPADO — `partes[].tema` del encargo o de su resolución */
function _temasDelEncargo(encargo) {
  const partes = encargo && Array.isArray(encargo.partes) ? encargo.partes : [];
  return [...new Set(partes.map((p) => p && typeof p.tema === "string" ? p.tema : null).filter(Boolean))];
}

/** necesitaPerfil(encargo, { conocidos?, omitidos?, activo?, catalogo? }) → { activo, temas, necesarios, siguiente, limitaciones }
 *  `encargo` = el Encargo v1 o su resolución (solo se leen `partes[].tema`).
 *  `conocidos` = { campo: código } de lo que la empresa ya tiene (declarado y confirmado, de la ficha, o dado por la persona
 *  y todavía por confirmar — para decidir qué preguntar, una respuesta pendiente ya cuenta como respondida).
 *  `omitidos` = los campos que la persona prefirió no decir en ESTA conversación.
 *  → `necesarios`: los campos que harían falta, en el orden en que se preguntan (vacío = no falta nada, no se pide nada) ·
 *    `siguiente`: LA pregunta que corresponde ahora (una sola) · `limitaciones`: lo que una omisión deja sin aplicar. */
export function necesitaPerfil(encargo, { conocidos = {}, omitidos = [], activo = ADI_CONOCIMIENTO, catalogo = PIEZAS_CONOCIMIENTO } = {}) {
  const temas = _temasDelEncargo(encargo);
  const vacio = { activo: Boolean(activo), temas, necesarios: [], siguiente: null, limitaciones: [] };
  if (!activo || !temas.length) return vacio;
  const omit = new Set(Array.isArray(omitidos) ? omitidos : []);
  const sabe = (c) => conocidos[c] != null && conocidos[c] !== "";

  const necesarios = new Set();
  const limitados = new Set();
  for (const pieza of Array.isArray(catalogo) ? catalogo : []) {
    if (!pieza || pieza.estado !== "firmada" || !pieza.alcance) continue;          // solo lo que puede servirse
    const t = _temasDeLaPieza(pieza);
    if (t.size && !temas.some((x) => t.has(x))) continue;                           // no es del tema de este encargo
    const restringidos = CAMPOS_PERFIL_DECLARABLES.filter((c) => Array.isArray(pieza.alcance[_LLAVE_DE_ALCANCE[c]]));
    // lo ya declarado la descarta: no hace falta preguntar nada más por una pieza que no le aplica a esta empresa
    if (restringidos.some((c) => sabe(c) && !pieza.alcance[_LLAVE_DE_ALCANCE[c]].includes(conocidos[c]))) continue;
    // lo omitido la deja sin aplicar: se declara la limitación y no se pregunta nada más por ella
    const sinDecir = restringidos.filter((c) => !sabe(c) && omit.has(c));
    if (sinDecir.length) { for (const c of sinDecir) limitados.add(c); continue; }
    for (const c of restringidos) if (!sabe(c)) necesarios.add(c);
  }
  const ordenados = CAMPOS_PERFIL_DECLARABLES.filter((c) => necesarios.has(c));
  // el tipo de producto solo se pregunta cuando ya hay un sector al que le aplica (no antes: no hay con qué validarlo)
  const preguntable = (c) => c !== "tipoProducto" || (sabe("sector") && SECTORES_CON_TIPO_PRODUCTO.includes(conocidos.sector));
  return {
    activo: true, temas, necesarios: ordenados,
    siguiente: ordenados.find(preguntable) || null,
    limitaciones: CAMPOS_PERFIL_DECLARABLES.filter((c) => limitados.has(c)).map((campo) => ({ campo })),
  };
}

/* ═══ 3 · EL PERFIL GUARDADO ALIMENTA A LA ENTREGA ═══════════════════════════════════════════════════════════════════ */
/** conPerfilDeclarado(dataset, vigentes) → el dataset con el perfil que la empresa declaró conversando. NUNCA muta el
 *  dataset (devuelve una copia superficial, el mismo patrón que `tenantService.server.js:packActivo`), y si no hay nada
 *  que agregar devuelve EL MISMO objeto (cero costo, cero diferencia). Lo que la ficha de la empresa ya trae (las columnas
 *  de `tenants`) manda sobre la memoria: la memoria solo llena huecos. Solo cuenta lo VIGENTE (confirmado). */
export function conPerfilDeclarado(dataset, vigentes) {
  if (!dataset || typeof dataset !== "object" || !vigentes || typeof vigentes !== "object") return dataset;
  const base = dataset.perfil && typeof dataset.perfil === "object" ? dataset.perfil : {};
  const nuevos = {};
  for (const campo of CAMPOS_PERFIL_DECLARABLES) {
    const v = vigentes[campo];
    if (!v || typeof v.valor !== "string" || !v.valor) continue;
    const propio = base[campo];
    if (propio && typeof propio.valor === "string" && propio.valor) continue;
    nuevos[campo] = { valor: v.valor, procedencia: "declarado" };
  }
  return Object.keys(nuevos).length ? { ...dataset, perfil: { ...base, ...nuevos } } : dataset;
}

/* ═══ 4 · EL BLOQUE `perfil` DE `consultar` ═════════════════════════════════════════════════════════════════════════ */
/** textoDeLimitacion(campo) → lo que una omisión deja sin aplicar, en palabras de negocio (tercera persona). */
export function textoDeLimitacion(campo) {
  const R = ROTULOS_PERFIL[campo];
  const que = R ? R.conArticulo : `el campo ${campo}`;
  return `Sin ${que} declarado (se prefirió no decirlo), ADI no aplica las referencias del oficio que dependen de él. El resto de la consulta se responde igual, con los datos de la empresa.`;
}

const USO_DE_LA_PREGUNTA = Object.freeze([
  "Pregunte esto a la persona de forma natural y UNA sola vez, ofreciendo las opciones; no la repita en esta conversación aunque la persona no la responda.",
  "Si la persona responde, devuelva con aportarContexto el código de la opción que eligió (clase «perfil», concepto = el campo): nunca un valor que ADI no ofreció, y nunca uno deducido de los datos o de otra respuesta. Después, léale lo entendido y pida que lo confirme: recién confirmado cuenta como dato.",
  "Si prefiere no responder, use «omitir» con el campo: ADI no vuelve a preguntarlo en esta conversación y declara qué queda limitado.",
]);
const USO_DE_LO_PENDIENTE = "Lo que figura por confirmar lo declaró la persona pero todavía no lo confirmó: léale lo entendido y pida confirmación (aportarContexto, confirmar: ids) antes de darlo por dicho.";

/** armarPerfilConversando({ store, tenantId, conversacionId, encargo, perfilCliente, estado, activo?, catalogo? }) → bloque | null
 *  `estado` = lo que devuelve `leerPerfilDeclarado`; `perfilCliente` = `construirPerfilCliente` del dataset con el perfil
 *  YA mezclado (así lo vigente cuenta como sabido). Devuelve `null` cuando no hay nada que decir (no falta nada, nada por
 *  confirmar, nada limitado): «si no falta nada, no pide nada». Usa `yaFueOmitido` para no repetir lo que se omitió en esta
 *  conversación; lo omitido en OTRA conversación se vuelve a ofrecer solo si esta consulta lo necesita, y lo dice. */
export async function armarPerfilConversando({ store, tenantId, conversacionId = null, encargo, perfilCliente, estado: estadoCrudo, activo = ADI_CONOCIMIENTO, catalogo = PIEZAS_CONOCIMIENTO } = {}) {
  const estado = { vigentes: {}, pendientes: {}, omitidos: {}, ...(estadoCrudo || {}) };
  const campos = (perfilCliente && perfilCliente.campos) || {};
  const conocidos = {};
  for (const c of CAMPOS_PERFIL_DECLARABLES) if (campos[c] && campos[c].valor != null) conocidos[c] = campos[c].valor;
  const pendientes = (estado && estado.pendientes) || {};
  // lo que la persona ya respondió (aunque falte confirmarlo) no se vuelve a preguntar
  for (const c of CAMPOS_PERFIL_DECLARABLES) if (conocidos[c] == null && pendientes[c]) conocidos[c] = pendientes[c].valor;

  const omitidosAqui = [];
  for (const c of CAMPOS_PERFIL_DECLARABLES) {
    const tieneOmision = estado && estado.omitidos && Array.isArray(estado.omitidos[c]) && estado.omitidos[c].length > 0;
    if (conocidos[c] == null && tieneOmision && await yaFueOmitido(store, tenantId, { concepto: conceptoDePerfil(c) }, { conversacionId })) omitidosAqui.push(c);
  }

  const n = necesitaPerfil(encargo, { conocidos, omitidos: omitidosAqui, activo, catalogo });
  // UNA cosa a la vez: mientras haya algo por confirmar no se abre otra pregunta (si la persona corrige lo pendiente, la
  // pregunta siguiente podría ya no hacer falta — p. ej. el modelo comercial después de decir que el sector es servicios)
  const hayPendientes = CAMPOS_PERFIL_DECLARABLES.some((c) => pendientes[c] && !(estado.vigentes[c] && estado.vigentes[c].valor === pendientes[c].valor));
  const pregunta = n.siguiente && !hayPendientes ? (() => {
    const q = preguntasDelPerfil([n.siguiente])[0];
    const antes = estado && estado.omitidos && Array.isArray(estado.omitidos[n.siguiente]) && estado.omitidos[n.siguiente].length > 0;
    return antes ? { ...q, reofrecida: "se omitió en otra conversación y esta consulta depende de ese dato" } : q;
  })() : null;

  const porConfirmar = CAMPOS_PERFIL_DECLARABLES.filter((c) => pendientes[c] && !(estado.vigentes && estado.vigentes[c] && estado.vigentes[c].valor === pendientes[c].valor)).map((campo) => {
    const p = pendientes[campo];
    const op = opcionesDeCampo(campo).find((o) => o.codigo === p.valor);
    return { id: p.id, campo, rotulo: ROTULOS_PERFIL[campo].rotulo, valor: p.valor, valorRotulo: op ? op.rotulo : p.valor, origen: "declarado", ...(estado.vigentes && estado.vigentes[campo] ? { reemplazaA: estado.vigentes[campo].valor } : {}) };
  });
  const limitaciones = n.limitaciones.map((l) => ({ campo: l.campo, rotulo: ROTULOS_PERFIL[l.campo].rotulo, texto: textoDeLimitacion(l.campo) }));

  if (!pregunta && !porConfirmar.length && !limitaciones.length) return null;
  return {
    pregunta,
    porConfirmar,
    limitaciones,
    uso: [...(pregunta ? USO_DE_LA_PREGUNTA : []), ...(porConfirmar.length ? [USO_DE_LO_PENDIENTE] : [])],
  };
}
