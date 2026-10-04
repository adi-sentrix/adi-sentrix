/* === src/adi/entrega/referencias.js · LA REFERENCIA DE LA CONSULTA (consolidación, paso 2 · FAMILIA 3) ═══════════════════════════
 * UNA pieza decide qué referencias de la consulta están en juego, en qué conjunto y eje, qué partes cubren, cuántas entidades daría el conjunto
 * con ellas en el eje de cada parte (con sus nombres) y la oficial al lado (contrato §7.3·12 · 19 · 37(b)/(d) · 40(d) · 41(b)/(d) · 42(d) · 49(a) ·
 * 51(g) · 52(e)). La tabla de familias (concepto → conjunto, eje, métrica, dirección) vive aquí, una sola vez; el compositor y la lectura le preguntan.
 *
 *   · `referenciasDeLaConsulta(ctx)` → { limites, marcoOperativa, cifras } — las declaraciones AL LADO de la oficial, una por (conjunto, eje); si la usan DOS o
 *     más partes, la declaración nombra las partes que cubre («Sobre las partes p1 y p3 (comercial), …», la forma de siempre extendida al plural; 52e); con cero
 *     miembros se dice «ninguno», nunca una lista en blanco. Nunca reemplaza a la oficial: el Marco la lleva aparte (`referenciasOficiales`).
 *   · `referenciasOficiales({ partesUtiles, premisas, I })` → [{ concepto, cifra, texto }] — la referencia OFICIAL de cada conjunto de la casa que un filtro (`filtros[].ref`) de una parte o de una premisa cita, TODAS (no solo la primera; 42b · 42d), para el Marco, con la misma función que imprime el veredicto (`valorDeReferencia`).
 *   · Un conjunto que la referencia define y que no se pudo evaluar contra el dato NO se calla: se declara con la forma de siempre («el universo declarado no
 *     se pudo evaluar»), con la parte que lo usa.
 * Puro: devuelve datos; el compositor los pone en la Entrega. Sin red. */
import { normalizar } from "../notario/afirmacion.js";
import { estadoDeclarado, formaDeEstado, UMBRALES_DE_ESTADO, estadoDeLaPremisa, umbralesDeEstados, ESTADO_DE_CONCEPTO } from "../notario/estados.js";
import { umbralesDeBases, umbralesDeConceptos, NOMBRE_CARGA_ALTA, formaDeConjunto, conjuntoDeFormaEnEje, referenciaDeBase } from "../notario/conjuntosDeLaCasa.js";
import { conjuntoDeUniverso, valorDeReferencia } from "../notario/verificar.js";
import { formatoDeReferencia } from "../notario/hechos.js";
import { conteoDeEje, conPreposicion, sintagmaDe, metricaPorClave } from "../notario/lexico.js";
import { ETIQUETA_ORIGEN, ADJETIVO_DE_ORIGEN, umbral, benchmarkOf, procedenciaDeUmbral, procedenciaDeUmbrales, procedenciaDeMaterialidad, procedenciaDeReferencia, valorDeUmbralEnTexto } from "../../config/businessPolicy.js";
import { descomposicionDeBrecha } from "../specRetrieval.js";

// §7.3·12/·19 (decisión del owner 2026-09-27, «con el benchmark de la empresa, como recomiendas»; generalizada
// por el supervisor el mismo día, diagnóstico v8, raíz A5) — una referencia declarada por el USUARIO
// (`resolucion.criterio.referencia`, §7.1·6) NUNCA recalcula un conjunto de la casa que la Entrega ya usa: la
// Entrega sigue contando con la referencia OFICIAL de la EMPRESA (arriba) y declara AL LADO, como límite,
// cuánto daría con la referencia del usuario — la cifra Y LOS NOMBRES de las cuentas, calculados por la MISMA
// función de la casa (`conjuntoDeUniverso`, con un `filtros` sintético sobre la métrica real del conjunto,
// nunca una segunda cuenta a mano) contra ESE valor. Nunca reemplaza a la oficial en silencio ni se presenta
// como objetivo de la empresa (ley «de quién es la vara»). Tres huecos cerrados de la versión anterior:
// (1) cubría SOLO `concepto:"benchmark"` — ahora una tabla concepto→familia, toda referencia que define un
//     conjunto de la casa (§7.3·19: benchmark, nivel declarado de carga; nunca se inventa la familia que
//     falte — un concepto sin entrada en la tabla, como `piso_rotacion`, sigue sin disparar nada, documentado);
// (2) miraba SOLO el universo de las PARTES — ahora también el universo de cada PREMISA (§7.3·19);
// (3) nunca enumeraba los NOMBRES del conjunto alternativo — ahora los une desde `I.entidades`, igual que
//     `_lista()` en el resto de este archivo.
// «carga comercial alta» es el DETECTOR (`datoProyectado.conjuntos`, no un filtro simple sobre la métrica
// «carga»): declara solo el conteo oficial, nunca una alternativa recalculada con una fórmula que no es la
// suya (`sinAlternativa` en la tabla).
export const REFERENCIA_FAMILIAS = {
  benchmark: { eje: "cliente", metrica: "margen", nombreDeLaEmpresa: { articulo: "el", nucleo: "benchmark de la empresa" }, direcciones: { bajo: { base: "bajo el benchmark", op: "<" }, sobre: { base: "sobre el benchmark", op: ">=" } } },
  nivel_carga: { eje: "cliente", metrica: "carga", nombreDeLaEmpresa: { articulo: "el", nucleo: "nivel declarado de carga" }, direcciones: { sobre: { base: "sobre el nivel declarado de carga", op: ">" } }, sinAlternativa: ["carga comercial alta"] },
  // §7.3·19 (SUPERVISOR, residual del diagnóstico v10 — X78/X79) — la TERCERA referencia que la propia decisión
  // ya nombra («benchmark, nivel declarado de carga, piso de rotación»): sin esta entrada, una referencia de
  // rotación declarada por el usuario (`criterio.referencia.concepto:"piso_rotacion"`) nunca disparaba nada —
  // el hueco que el comentario de arriba ya documentaba («un concepto sin entrada, como piso_rotacion, sigue
  // sin disparar nada»). Sus conjuntos se nombran por ESTADO («rota bien»/«rota lento», notario/estados.js), no
  // por `base` (un conjunto de `conjuntosDeLaCasa.js`): `estado` en vez de `base` en cada dirección se lee más
  // abajo con el MISMO valor (ambos son solo la clave que `basesEnJuego` tiene que contener).
  piso_rotacion: { eje: "sku", metrica: "rotacion", umbral: "rotacionMin", nombreDeLaEmpresa: { articulo: "el", nucleo: "piso de rotación declarado" }, direcciones: { bajo: { estado: "rota lento", op: "<" }, sobre: { estado: "rota bien", op: ">=" } } },
  // ETAPA 6 (owner 2026-09-29, §7.3·35) — el umbral de venta frenada (días sin venta) planteado en la consulta: la CUARTA
  // referencia que define un conjunto de la casa («frenado», notario/estados.js). Mismo patrón de §7.3·12/·19: si la
  // EMPRESA declaró su umbral, el veredicto oficial es el suyo y aquí se declara AL LADO cuántos SKU serían con el de la
  // consulta (`op:">"`, el mismo «sobre el umbral» de `jerarquiaInventario`). Si la empresa NO lo declaró
  // (`operativaSinOficial`), no hay oficial que contrastar: el de la consulta sostiene el veredicto de ESTA respuesta —
  // `componerEntrega` lo pasó al índice (`_consultaDeFrenado`) — y se declara en el Marco como criterio de quien consulta.
  umbral_frenado: { eje: "sku", metrica: "dias_sin_venta", nombreDeLaEmpresa: { articulo: "el", nucleo: "umbral de venta frenada declarado" }, direcciones: { sobre: { estado: "frenado", op: ">" } }, operativaSinOficial: true },
  // §7.3·36c (SUPERVISOR, diagnóstico v12, Z98 = Y96 de v11) — la QUINTA referencia que define un conjunto de la casa: el techo de
  // cobertura (días de inventario máximo, `REFERENCIAS_DE_LA_CASA`). Sin esta entrada el validador aceptaba `criterio.referencia{techo_cobertura}`
  // y la Entrega la ignoraba en silencio (la cara opuesta de «nunca reemplaza a la oficial en silencio»). Su conjunto no se nombra
  // por `base` ni por estado sino por el FILTRO que cita la referencia (`filtros[].ref`): la dirección se dispara por `ref`.
  techo_cobertura: { eje: "sku", metrica: "dias_inventario", umbral: "dohMax", nombreDeLaEmpresa: { articulo: "el", nucleo: "techo de cobertura de la empresa" }, direcciones: { sobre: { ref: "techo_cobertura", op: ">" } } },
  // v17 (W27, §7.3·19 «la referencia del usuario vale para TODA referencia que define un conjunto de la casa»): la SEXTA — el piso de materialidad (`materialidadFocoPctVenta`, % de la venta) que decide
  // «carga comercial alta» (`UMBRALES_DE_BASE`). Sin esta entrada, `criterio.referencia{umbral_materialidad}` se ignoraba en silencio. Se declara AL LADO del piso oficial (su origen sale de `umbral().origen`:
  // criterio general de ADI o declarado por la empresa) y nunca lo reemplaza: el conjunto alternativo lo calculan las MISMAS filas del detector (`descomposicionDeBrecha`) con el otro piso. Ni `direcciones` ni `umbral`: no pasan por la ruta de las demás.
  umbral_materialidad: { eje: "cliente", pisoDePolicy: "materialidadFocoPctVenta", detector: NOMBRE_CARGA_ALTA, direcciones: {} },
};

/** referenciasDeLaConsulta({ resolucion, partesUtiles, I, scenario, consultaDeFrenado, basesDeUniverso, indiceDelTenant, dominioNombre, listaDeNombres }) → { limites, marcoOperativa, cifras } */
export function referenciasDeLaConsulta({ resolucion, partesUtiles, I, scenario, consultaDeFrenado, basesDeUniverso, indiceDelTenant, dominioNombre, listaDeNombres }) {
  const limites = [], cifras = [];
  let marcoOperativa = null;
  const refUsuario = resolucion.criterio && resolucion.criterio.referencia;
  const familiaRef = refUsuario && REFERENCIA_FAMILIAS[refUsuario.concepto];
  if (familiaRef && Number.isFinite(refUsuario.valor) && I) {
    const _baseCasa = (u) => (u && typeof u.base === "string" ? u.base.trim() : "");
    // las referencias de la casa que un universo CITA en sus filtros (`filtros[].ref`, también en las ramas de una `union`): un campo tipado.
    const _refsCasa = (u, acc = []) => { if (!u || typeof u !== "object") return acc; for (const x of Array.isArray(u.filtros) ? u.filtros : []) if (x && typeof x.ref === "string") acc.push(x.ref.trim()); for (const v of Array.isArray(u.union) ? u.union : []) _refsCasa(v, acc); return acc; };
    // los estados («rota bien»/«rota lento») declarados en un universo, por su nombre CANÓNICO — la misma
    // fuente (`estadoDeclarado`, notario/estados.js) que ya valida estos campos en `validarUniverso`.
    const _estadosCasa = (u) => [...(Array.isArray(u && u.estados) ? u.estados : []), ...(Array.isArray(u && u.no_estados) ? u.no_estados : [])].map((e) => estadoDeclarado(e)).filter(Boolean);
    // (2) PARTES y PREMISAS, unidas — nunca solo partesUtiles.
    const basesEnJuego = new Set();
    /* v23 (R40 · R45, §7.3·19 + ley del universo): la referencia de la consulta se declara en el EJE del universo que la pone en juego (una parte por familia cuenta familias, por marca cuenta marcas), nunca en el eje fijo de la familia de referencia (clientes). `ejesDeClave` recuerda, por clave en juego (base · estado · ref), el eje de cada universo que la cita; sin eje propio, el de la familia de referencia (lo de siempre). */
    const ejesDeClave = new Map();
    /* FAMILIA 3 (§7.3·52e): las PARTES que usan cada clave en cada eje — la declaración, una por (conjunto, eje), nombra las partes que cubre si son DOS o más */
    const partesDeClave = new Map();
    const _anotarParte = (mapa, k, parteId) => { if (parteId == null) return; if (!mapa.has(k)) mapa.set(k, new Set()); mapa.get(k).add(parteId); };
    const _ponerEnJuego = (u, parteId = null) => { if (!u || typeof u !== "object") return; const ejeU = (typeof u.eje === "string" && u.eje.trim()) || familiaRef.eje; const claves = [...basesDeUniverso(u), ...[...basesDeUniverso(u)].map(formaDeConjunto), _baseCasa(u), ..._estadosCasa(u), ..._refsCasa(u)]; for (const c of claves) { if (!c) continue; const k = normalizar(c); basesEnJuego.add(k); if (!ejesDeClave.has(k)) ejesDeClave.set(k, new Set()); ejesDeClave.get(k).add(ejeU); _anotarParte(partesDeClave, `${k}|${ejeU}`, parteId); } };
    for (const p of partesUtiles) _ponerEnJuego(p.universo, p.id);
    for (const pr of resolucion.premisas || []) _ponerEnJuego(pr.universo != null ? pr.universo : pr.de);
    // una PREMISA de estado («¿LG está frenado?») también pone en juego el estado de la familia con `operativaSinOficial`:
    // sin esto, el umbral que planteó quien consulta se ignoraría en silencio cuando solo aparece en una premisa.
    if (familiaRef.operativaSinOficial || familiaRef.umbral) for (const pr of resolucion.premisas || []) { const e = typeof pr.estado === "string" ? estadoDeclarado(pr.estado) : null; if (e) basesEnJuego.add(normalizar(e)); }
    const valFmt = formatoDeReferencia(refUsuario.valor, refUsuario.unidad || "pct");   /* §7.3·40(d): la referencia que la consulta planteó es un valor DECLARADO — exacto, nunca redondeado */
    const temaDeParte = new Map(partesUtiles.map((p) => [p.id, p.tema]));
    /* §7.3·52e: la declaración de un (conjunto, eje) usado por DOS o más partes nombra las partes que cubre, con la forma de siempre («Sobre la parte pN (tema), …») extendida al plural; una sola parte no hace falta nombrarla */
    const _tituloDeLaDeclaracion = (nombre, ids) => {
      const cola = `con la referencia planteada en la consulta (${valFmt}), en vez ${conPreposicion("de", nombre)}`;
      if (ids.length < 2) return cola.charAt(0).toUpperCase() + cola.slice(1);
      return `Sobre las partes ${listaDeNombres(ids)} (${listaDeNombres([...new Set(ids.map((id) => dominioNombre(temaDeParte.get(id))))])}), ${cola}`;
    };
    /* un error de evidencia se DECLARA, nunca se calla: la forma de siempre («el universo declarado no se pudo evaluar») con las partes que usan el conjunto. Una premisa sola lleva su propio veredicto. */
    const _limiteNoSePudoEvaluar = (ids) => (ids.length ? {
      titulo: `${ids.length > 1 ? `Sobre las partes ${listaDeNombres(ids)}` : `Sobre la parte ${ids[0]}`} (${listaDeNombres([...new Set(ids.map((id) => dominioNombre(temaDeParte.get(id))))])}), el universo declarado no se pudo evaluar`,
      motivo: "El conjunto se resolvió parcialmente o no se pudo verificar contra la evidencia de este turno — se declina en vez de servir con otro alcance o sobre un ranking incompleto.",
    } : null);
    const _nombreDeLasEntidades = (set) => [...set].map((k) => (I.entidades && I.entidades.get ? (I.entidades.get(k) || { nombre: k }).nombre : k));
    // ETAPA 6 (§7.3·35) — la referencia de la consulta es la OPERATIVA (la empresa no declaró la suya): no hay oficial
    // contra el cual declarar «serían N»; el veredicto de ESTA respuesta ya se calculó con ella (índice) y lo que
    // falta es DECLARAR su procedencia, en el Marco, como criterio de quien consulta. Solo si «frenado» está en juego
    // (una parte, un universo de premisa o una premisa de estado lo nombran), como en las demás familias.
    const operativaDeLaConsulta = !!(familiaRef.operativaSinOficial && consultaDeFrenado);
    if (operativaDeLaConsulta) {
      const claveOp = Object.values(familiaRef.direcciones).map((d) => d.base || d.estado);
      if (claveOp.some((c) => basesEnJuego.has(normalizar(c)))) {
        const m = metricaPorClave(refUsuario.concepto);
        cifras.push(valFmt);
        const txt = `${m ? m.nombre : refUsuario.concepto}: ${valFmt} sin venta, ${ETIQUETA_ORIGEN.consulta}; vale solo para esta respuesta y no es un criterio de la empresa.`;
        marcoOperativa = txt;
      }
    }
    // v18 (X33, §7.3·12/·19): un FILTRO que CITA la referencia de la casa (`filtros[].ref === concepto`, en una parte o en una premisa, también en las ramas de una unión) pone en juego esa referencia igual que una `base`: la
    // dirección sale del `op` del filtro. Antes solo se disparaba por `base`/estado/`ref` propio de la tabla, y una consulta que planteaba SU referencia sobre un filtro con `ref` se perdía en silencio. Un `op` que la tabla ya
    // cubre con su propia `ref` (techo_cobertura) no se repite; sin `metrica` (el piso de materialidad, que va por su detector) no hay filtro que citar.
    const ejesDeOp = new Map();   /* v23: el eje de los universos que citan la referencia con ese `op` */
    const partesDeOp = new Map();
    const _opsDeRefCitada = (u, acc, ejePadre = familiaRef.eje, parteId = null) => { if (!u || typeof u !== "object") return acc; const ejeU = (typeof u.eje === "string" && u.eje.trim()) || ejePadre; for (const x of Array.isArray(u.filtros) ? u.filtros : []) if (x && typeof x.ref === "string" && x.ref.trim() === refUsuario.concepto && typeof x.op === "string") { const op = x.op.trim(); acc.add(op); if (!ejesDeOp.has(op)) ejesDeOp.set(op, new Set()); ejesDeOp.get(op).add(ejeU); _anotarParte(partesDeOp, `${op}|${ejeU}`, parteId); } for (const v of Array.isArray(u.union) ? u.union : []) _opsDeRefCitada(v, acc, ejeU, parteId); return acc; };
    const opsCitadas = new Set();
    if (familiaRef.metrica) { for (const p of partesUtiles) _opsDeRefCitada(p.universo, opsCitadas, familiaRef.eje, p.id); for (const pr of resolucion.premisas || []) _opsDeRefCitada(pr.universo != null ? pr.universo : pr.de, opsCitadas); }
    const _direccionesDeLaReferencia = operativaDeLaConsulta ? [] : [
      ...Object.entries(familiaRef.direcciones),
      ...[...opsCitadas].filter((o) => !Object.values(familiaRef.direcciones).some((d) => d.ref === refUsuario.concepto && d.op === o)).map((o) => [/^>/.test(o) ? "sobre" : "bajo", { ref: refUsuario.concepto, op: o }]),
    ];
    /* §7.3·52e: UNA declaración por (conjunto, eje): una `base` y un filtro con `ref` que dicen lo mismo (el mismo conteo y las mismas entidades) comparten la declaración y suman sus partes */
    const declaraciones = new Map();
    const _declarar = (nombre, ids, motivo) => { if (!declaraciones.has(motivo)) declaraciones.set(motivo, { nombre, ids: new Set(), motivo }); for (const id of ids) declaraciones.get(motivo).ids.add(id); };
    const _pushLimiteUnico = (l) => { if (!limites.some((x) => x.titulo === l.titulo && x.motivo === l.motivo)) limites.push(l); };   // una `base` y un filtro con `ref` pueden decir lo mismo: una sola declaración
    for (const [dir, { base, estado, ref: refCasa, op }] of _direccionesDeLaReferencia) {
      const claveDireccion = base || estado || refCasa;
      if (!basesEnJuego.has(normalizar(claveDireccion))) continue;
      /* v23: los ejes donde esta dirección está en juego: el del universo que cita la `base`/el estado, o el del universo que cita la referencia con este `op` (sin eje propio, el de la familia de referencia) */
      const ejesEnJuego = [...(refCasa && !base && !estado && ejesDeOp.has(op) ? ejesDeOp.get(op) : (ejesDeClave.get(normalizar(claveDireccion)) || new Set([familiaRef.eje])))];
      for (const ejeDeLaParte of ejesEnJuego) {
      const idsDeLasPartes = [...((refCasa && !base && !estado && ejesDeOp.has(op) ? partesDeOp.get(`${op}|${ejeDeLaParte}`) : partesDeClave.get(`${normalizar(claveDireccion)}|${ejeDeLaParte}`)) || [])];
      let declarada = false;
      try {
        // el conjunto OFICIAL: el de la `base` de la casa, el del estado, o el del filtro que cita la referencia oficial (`ref`)
        const universoOficial = base ? { eje: ejeDeLaParte, base: conjuntoDeFormaEnEje(base, ejeDeLaParte) || base } : estado ? { eje: ejeDeLaParte, estados: [estado] } : { eje: ejeDeLaParte, filtros: [{ metrica: familiaRef.metrica, op, ref: refCasa }] };
        const oficial = conjuntoDeUniverso(universoOficial, I, ejeDeLaParte, "");
        const conReferencia = conjuntoDeUniverso({ eje: ejeDeLaParte, filtros: [{ metrica: familiaRef.metrica, op, valor: refUsuario.valor }] }, I, ejeDeLaParte, "");
        if (oficial && oficial.set && conReferencia && conReferencia.set) {
          const nombresAlt = _nombreDeLasEntidades(conReferencia.set);
          cifras.push(valFmt, String(conReferencia.set.size), String(oficial.set.size));
          declarada = true;
          _declarar(familiaRef.nombreDeLaEmpresa, idsDeLasPartes, `${conteoDeEje(ejeDeLaParte, conReferencia.set.size).condicional} ${conteoDeEje(ejeDeLaParte, conReferencia.set.size).texto} ${dir} esa referencia (contra ${oficial.set.size} con ${sintagmaDe(familiaRef.nombreDeLaEmpresa)}): ${nombresAlt.length ? nombresAlt.join(", ") : "ninguno"} — calculado con la misma cuenta; no reemplaza la referencia oficial ni es un objetivo de la empresa.`);
        }
      } catch { /* declarada = false: abajo se DECLARA que no se pudo evaluar */ }
      if (!declarada) { const l = _limiteNoSePudoEvaluar(idsDeLasPartes); if (l) _pushLimiteUnico(l); }
      }
    }
    const ordenDeParte = new Map(partesUtiles.map((p, i) => [p.id, i]));
    for (const d of declaraciones.values()) limites.push({ titulo: _tituloDeLaDeclaracion(d.nombre, [...d.ids].sort((a, b) => ordenDeParte.get(a) - ordenDeParte.get(b))), motivo: d.motivo });
    // DECISIÓN 37d (supervisor 2026-09-29, diagnóstico v13 A4; la 19 y la 36c): los estados de la Mesa Capital (inmovilizado crítico, inmovilizado, sobrestock, capital sano…) son
    // conjuntos que define UNA referencia —el piso de rotación o el techo de cobertura—: la de quien consulta se declara AL LADO, con su cifra y sus nombres, igual que la de un
    // conjunto por `base`/filtro. Los estados que dependen del umbral salen de la tabla de datos `UMBRALES_DE_ESTADO` (nunca una lista aparte), y el conjunto alternativo lo calcula
    // la MISMA función de la casa (`jerarquiaInventario` bajo ese umbral, vía la proyección con el umbral planteado) — nunca una cuenta a mano.
    if (familiaRef.umbral && !operativaDeLaConsulta) {
      const yaPorDireccion = new Set(Object.values(familiaRef.direcciones).map((d) => d.estado).filter(Boolean));
      for (const [canonEstado, llaves] of Object.entries(UMBRALES_DE_ESTADO)) {
        if (!llaves.includes(familiaRef.umbral) || yaPorDireccion.has(canonEstado) || !basesEnJuego.has(normalizar(canonEstado))) continue;
        const idsDeLasPartes = [...new Set([...partesDeClave].filter(([k]) => k.startsWith(`${normalizar(canonEstado)}|`)).flatMap(([, v]) => [...v]))];
        let declarada = false;
        try {
          const Ialt = indiceDelTenant([], scenario, { ...(consultaDeFrenado || {}), [familiaRef.umbral]: refUsuario.valor }).I;
          const oficial = conjuntoDeUniverso({ eje: familiaRef.eje, estados: [canonEstado] }, I, familiaRef.eje, "");
          const conReferencia = conjuntoDeUniverso({ eje: familiaRef.eje, estados: [canonEstado] }, Ialt, familiaRef.eje, "");
          if (oficial && oficial.set && conReferencia && conReferencia.set) {
            const nombresAlt = _nombreDeLasEntidades(conReferencia.set);
            const cnt = conteoDeEje(familiaRef.eje, conReferencia.set.size);
            cifras.push(valFmt, String(conReferencia.set.size), String(oficial.set.size));
            declarada = true;
            limites.push({
              titulo: _tituloDeLaDeclaracion(familiaRef.nombreDeLaEmpresa, idsDeLasPartes),
              motivo: `${cnt.condicional} ${cnt.texto} ${formaDeEstado(canonEstado).plural} con esa referencia (contra ${oficial.set.size} con ${sintagmaDe(familiaRef.nombreDeLaEmpresa)}): ${nombresAlt.length ? nombresAlt.join(", ") : "ninguno"} — calculado con la misma cuenta; no reemplaza la referencia oficial ni es un objetivo de la empresa.`,
            });
          }
        } catch { /* declarada = false: abajo se DECLARA que no se pudo evaluar */ }
        if (!declarada) { const l = _limiteNoSePudoEvaluar(idsDeLasPartes); if (l) limites.push(l); }
      }
    }
    // v17 (W27): el piso de materialidad planteado en la consulta se declara AL LADO del oficial, con la cifra Y los nombres que daría el MISMO detector con ese piso. Solo si el piso está en juego
    // (una parte o premisa nombra «carga comercial alta» o pide su concepto) y la referencia es un % de la venta; si el detector no se puede leer o no cierra con el conjunto oficial de la Entrega, se declara que no se pudo evaluar (nunca se calla).
    if (familiaRef.pisoDePolicy && (refUsuario.unidad || "pct") === "pct" && refUsuario.valor > 0) {
      const kPiso = familiaRef.pisoDePolicy;
      const enJuego = umbralesDeBases([...basesEnJuego]).includes(kPiso) || umbralesDeConceptos(partesUtiles.flatMap((p) => p.conceptos || [])).includes(kPiso);
      if (enJuego) {
        const idsDeLasPartes = partesUtiles.filter((p) => umbralesDeBases([...basesDeUniverso(p.universo)]).includes(kPiso) || umbralesDeConceptos(p.conceptos || []).includes(kPiso)).map((p) => p.id);
        let declarada = false;
        try {
          const pisoOficial = umbral(kPiso);
          const D = descomposicionDeBrecha(scenario);
          const oficial = conjuntoDeUniverso({ eje: familiaRef.eje, base: familiaRef.detector }, I, familiaRef.eje, "");
          if (pisoOficial && pisoOficial.valor > 0 && D && Array.isArray(D.filas) && D.piso > 0 && oficial && oficial.set) {
            const delDetector = new Set(D.filas.filter((f) => f.cargaMaterial).map((f) => normalizar(f.entidad)));
            const coincide = delDetector.size === oficial.set.size && [...delDetector].every((k) => oficial.set.has(k));
            if (coincide) {
              const pisoAlterno = D.piso * (refUsuario.valor / pisoOficial.valor);   // el mismo % de la venta real, con el otro porcentaje
              const nombresAlt = D.filas.filter((f) => f.cargaUsd >= pisoAlterno).map((f) => f.entidad);
              const cnt = conteoDeEje(familiaRef.eje, nombresAlt.length);
              const nombreOficial = { articulo: "el", nucleo: `umbral de materialidad ${pisoOficial.origen === "empresa" ? ADJETIVO_DE_ORIGEN.empresa : ADJETIVO_DE_ORIGEN.adi}` };
              cifras.push(valFmt, String(nombresAlt.length), String(oficial.set.size));
              declarada = true;
              limites.push({
                titulo: _tituloDeLaDeclaracion(nombreOficial, idsDeLasPartes),
                motivo: `${cnt.condicional} ${cnt.texto} con «${familiaRef.detector}» con esa referencia (contra ${oficial.set.size} con ${sintagmaDe(nombreOficial)}): ${nombresAlt.length ? nombresAlt.join(", ") : "ninguno"} — calculado con el mismo detector y las mismas filas, solo con otro piso; no reemplaza el criterio oficial ni es un objetivo de la empresa.`,
              });
            }
          }
        } catch { /* declarada = false: abajo se DECLARA que no se pudo evaluar */ }
        if (!declarada) { const l = _limiteNoSePudoEvaluar(idsDeLasPartes); if (l) limites.push(l); }
      }
    }
    // «carga comercial alta»: solo el conteo OFICIAL del detector — nunca una alternativa con una fórmula que no es la suya.
    for (const baseDetector of familiaRef.sinAlternativa || []) {
      if (!basesEnJuego.has(normalizar(baseDetector))) continue;
      const idsDeLasPartes = [...new Set([...partesDeClave].filter(([k]) => k.startsWith(`${normalizar(baseDetector)}|`)).flatMap(([, v]) => [...v]))];
      let declarada = false;
      try {
        const oficial = conjuntoDeUniverso({ eje: familiaRef.eje, base: baseDetector }, I, familiaRef.eje, "");
        if (oficial && oficial.set) {
          cifras.push(valFmt, String(oficial.set.size));
          declarada = true;
          limites.push({
            titulo: _tituloDeLaDeclaracion(familiaRef.nombreDeLaEmpresa, idsDeLasPartes),
            motivo: `«${baseDetector}» ${conteoDeEje(familiaRef.eje, oficial.set.size).presente} ${conteoDeEje(familiaRef.eje, oficial.set.size).texto} con la referencia de la empresa; el detector no se recalcula con una referencia distinta — no reemplaza la oficial ni es un objetivo de la empresa.`,
          });
        }
      } catch { /* declarada = false: abajo se DECLARA que no se pudo evaluar */ }
      if (!declarada) { const l = _limiteNoSePudoEvaluar(idsDeLasPartes); if (l) limites.push(l); }
    }
  }
  return { limites, marcoOperativa, cifras };
}

/** referenciasOficiales({ partesUtiles, premisas, I }) → [{ concepto, cifra, texto }] */
export function referenciasOficiales({ partesUtiles, premisas, I }) {
  const refs = [];
  const visitar = (u) => { if (!u || typeof u !== "object" || Array.isArray(u)) return; for (const f of Array.isArray(u.filtros) ? u.filtros : []) if (f && typeof f.ref === "string" && f.ref.trim() && !refs.includes(f.ref.trim())) refs.push(f.ref.trim()); for (const v of Array.isArray(u.union) ? u.union : []) visitar(v); };
  for (const pr of premisas || []) visitar(pr.universo != null ? pr.universo : pr.de);
  for (const p of partesUtiles || []) visitar(p.universo);
  const out = [];
  for (const ref of refs) {
    const r = I ? valorDeReferencia(ref, I) : null, m = metricaPorClave(ref);
    if (r && Number.isFinite(r.raw) && m) { const cifra = formatoDeReferencia(r.raw, r.unidad || m.unidad); const origen = procedenciaDeReferencia(ref); out.push({ concepto: ref, cifra, texto: `${m.nombre}: ${cifra}${origen ? `, ${origen}` : ""}.` }); }
  }
  return out;
}

/* ── LA REFERENCIA OFICIAL EN EL MARCO (consolidación, paso 2 · cierre de la FAMILIA 3 dentro del compositor) ──────────────────────────────────────────────
 * Hasta ahora cada bloque del Marco (el camino general, el multitema, las rutas fijas de brecha, inventario y multidominio) decidía por su cuenta si declaraba el benchmark, el
 * nivel de carga, el piso de materialidad y la procedencia de los umbrales, y escribía su frase a mano. Ahora la frase y la decisión son de esta pieza; el texto es EXACTAMENTE el de
 * siempre (ningún texto cambia). Nunca reemplaza a la referencia de la consulta: esa va aparte (`referenciasDeLaConsulta`). */

/** figDelBenchmarkOficial(figs) → la fig «Benchmark de margen» de la boleta del turno (el nombre del léxico de la clave `benchmark`), o null: el benchmark que viaja con una lectura comercial */
export function figDelBenchmarkOficial(figs) {
  const nombre = String((metricaPorClave("benchmark") || {}).nombre || "Benchmark de margen").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`^${nombre}$`, "i");
  return (Array.isArray(figs) ? figs : []).find((f) => re.test(String((f && f.label) || ""))) || null;
}
/** ¿este plan (de una parte comercial que no es una definición, o un multitema que incluye comercial) pone en juego el benchmark oficial? Entonces su fig viaja en el libro y el Marco la declara (regla 4, «comparables juntas») */
export const planPoneElBenchmark = (plan) => !!plan && ((plan.tema === "comercial" && plan.kind !== "definicion") || (plan.kind === "multitema" && Array.isArray(plan.temas) && plan.temas.includes("comercial")));

/** textoDeBenchmark(valor, { calificador?, nota? }) → «Benchmark de margen[ (calificador)]: V, <origen>.[ nota]» — la frase del benchmark oficial, escrita una sola vez; el ORIGEN (declarado por la empresa · criterio general de ADI · según un documento…) lo da la función de origen de la casa (`procedenciaDeReferencia`), nunca una frase fija (§7.3·58) */
export const textoDeBenchmark = (valor, { calificador = null, nota = null } = {}) => `Benchmark de margen${calificador ? ` (${calificador})` : ""}: ${valor}, ${procedenciaDeReferencia("benchmark")}.${nota ? ` ${nota}` : ""}`;

/** textoDeUmbralDeMaterialidad(pct, usd) → la frase del piso de materialidad con su origen (la empresa o el criterio general de ADI, `umbral().origen`), nunca «declarado por la empresa» a ciegas (§7.3·36b) */
export const textoDeUmbralDeMaterialidad = (pct, usd) => `${umbral("materialidadFocoPctVenta").origen === "empresa" ? "Umbral de materialidad de la empresa" : "Umbral de materialidad"}: ${pct} de la venta (${usd}), ${procedenciaDeUmbral("materialidadFocoPctVenta")}.`;

/** referenciaDelMarco({ ya, idBenchGlobal, R, partesUtiles, premisas, libroPremisas, I, basesDeUniverso }) → { referenciaDeclarada, cifras }
 *  La referencia OFICIAL que el Marco declara, en este orden (cada una solo si aún no está): (1) el benchmark de una fig que viaja en la boleta (`idBenchGlobal`); (2) la oficial de cada conjunto que un
 *  filtro con `ref` cita (`referenciasOficiales`, TODAS: 42b · 42d); (3) el benchmark cuando una parte comercial se sirve, un `base` o un `excluir` lo nombra o una premisa habla de la brecha (la misma
 *  fuente que juzga el margen, `benchmarkOf`: 40d · 43e · 49d); (4) el nivel de carga declarado cuando un filtro lo cita o «carga comercial alta» se define por él (41b · 42b). `ya` es lo que el Marco
 *  ya trae (el benchmark del multitema, p. ej.); `R` renderiza el hecho de una fig (y la registra como cifra impresa); las `cifras` que devuelve son las declaradas sin hecho (regla 1, cero cifras desnudas). */
export function referenciaDelMarco({ ya = null, idBenchGlobal = null, R, partesUtiles, premisas, libroPremisas = null, I, basesDeUniverso }) {
  const cifras = [];
  let ref = ya;
  /* (1) el benchmark de la fig que viaja en la boleta */
  if (idBenchGlobal && !ref) ref = { texto: textoDeBenchmark(R(idBenchGlobal)), hechoId: idBenchGlobal };
  /* (2) la referencia OFICIAL de cada conjunto que un filtro con `ref` (de una parte o de una premisa) cita (§7.3·42b · 42d); §7.3·49(d): una cifra DECLARADA aunque la premisa no se pueda juzgar */
  for (const o of referenciasOficiales({ partesUtiles, premisas, I })) {
    if (ref && String(ref.texto || "").includes(o.texto)) continue;
    cifras.push(o.cifra);
    ref = ref ? { ...ref, texto: `${ref.texto} ${o.texto}` } : { texto: o.texto, hechoId: null };
  }
  /* (3) el benchmark: un `base`/`excluir` que lo nombra (también en las ramas de una unión: A4b), una premisa sobre la brecha (49d) o una parte comercial servida (43e), con el valor que juzga el margen (`benchmarkOf`) */
  {
    const _BASE_BENCHMARK_RE = /\bbenchmark\b/i;
    const _baseNombraBenchmark = (u) => {
      if (!u || typeof u !== "object") return false;
      if (typeof u.base === "string" && _BASE_BENCHMARK_RE.test(u.base)) return true;
      /* §7.3·39(d): un universo SOLO-EXCLUIR que nombra el benchmark en `excluir.conjuntos` lo cita igual que un `base` */
      if (u.excluir && typeof u.excluir === "object" && (Array.isArray(u.excluir.conjuntos) ? u.excluir.conjuntos : []).some((n) => typeof n === "string" && _BASE_BENCHMARK_RE.test(n))) return true;
      if (Array.isArray(u.union)) return u.union.some((v) => _baseNombraBenchmark(v));
      return false;
    };
    const partesConBaseBenchmark = partesUtiles.some((p) => _baseNombraBenchmark(p.universo));
    let premisaConBaseBenchmark = false;
    if (!partesConBaseBenchmark && libroPremisas) { for (const H of libroPremisas.porId.values()) { if (_baseNombraBenchmark(H && H.universoTipado)) { premisaConBaseBenchmark = true; break; } } }
    /* v20 (§7.3·43e): el Marco comercial cita el benchmark con que se juzga el margen AUNQUE la consulta no lo nombre: la regla es del tema, no de la herramienta que sirvió la parte */
    const parteComercialServida = partesUtiles.some((p) => p.tema === "comercial" && p.cierre !== "definicion");
    /* §7.3·49(d): una premisa sobre la BRECHA al benchmark pone en juego el benchmark igual que un `base` (composer y verificador no se contradicen, 48d) */
    const premisaConBrecha = !!libroPremisas && [...libroPremisas.porId.values()].some((H) => H && H.claves && [...H.claves].some((c) => c === "brecha"));
    if (partesConBaseBenchmark || premisaConBaseBenchmark || premisaConBrecha || parteComercialServida) {
      const benchRaw = benchmarkOf();
      if (Number.isFinite(benchRaw)) {
        const benchFmt = formatoDeReferencia(benchRaw, "pct");   /* §7.3·40(d): el benchmark es un valor DECLARADO — exacto */
        const _txtB = textoDeBenchmark(benchFmt);
        /* v19 (Y14, §7.3·42b): `referenciaDeclarada` es UN campo: el benchmark se ANTEPONE al texto que ya hay (todas las referencias oficiales con que se juzgó, no solo la primera) */
        if (!ref) { cifras.push(benchFmt); ref = { texto: _txtB, hechoId: null }; }
        else if (!/benchmark de margen/i.test(String(ref.texto || ""))) { cifras.push(benchFmt); ref = { ...ref, texto: `${_txtB} ${ref.texto}` }; }
      }
    }
  }
  /* (4) el nivel de carga declarado: un filtro que lo cita (`filtros[].ref`) o «carga comercial alta», que también se define por el nivel oficial (v19: Y09 · Y13 · Y16 · Y40 · Y43, §7.3·42b) */
  {
    const nivelEnJuego = (u) => {
      if (!u || typeof u !== "object") return false;
      if (Array.isArray(u.union) && u.union.some(nivelEnJuego)) return true;
      if ((Array.isArray(u.filtros) ? u.filtros : []).some((x) => x && typeof x.ref === "string" && x.ref.trim() === "nivel_carga")) return true;
      return [...basesDeUniverso(u)].some((b) => { const fam = referenciaDeBase(b); return !!(fam && fam.concepto === "nivel_carga"); });
    };
    const enJuego = partesUtiles.some((p) => nivelEnJuego(p.universo)) || (premisas || []).some((pr) => nivelEnJuego(pr.universo != null ? pr.universo : pr.de));
    if (enJuego && I) {
      const r = valorDeReferencia("nivel_carga", I);
      const m = metricaPorClave("nivel_carga");
      if (r && Number.isFinite(r.raw) && m) {
        const fmt = formatoDeReferencia(r.raw, r.unidad || m.unidad);
        const txt = `${m.nombre}: ${fmt}, ${procedenciaDeReferencia("nivel_carga")}.`;
        cifras.push(fmt);   /* §7.3·49(d): declarada aunque otro bloque ya escribiera la cláusula en el Marco */
        if (!ref || !ref.texto.includes(txt)) ref = ref ? { ...ref, texto: `${ref.texto} ${txt}` } : { texto: txt, hechoId: null };
      }
    }
  }
  return { referenciaDeclarada: ref, cifras };
}

/** procedenciaDeLosUmbrales({ partesUtiles, premisas, consultaDeFrenado, estadosDeUniverso, basesDeUniverso }) → { definiciones, cifras }
 *  LA PROCEDENCIA DE LOS UMBRALES (§7.3·32b · 36b · 37b · 40a): los estados que la Entrega usa (el universo de cada parte y de cada premisa, el estado de una premisa y el capital que un concepto sirve)
 *  y los conjuntos de la casa que DEPENDEN de un umbral (`base`/`excluir`) declaran su origen —con el helper único de `businessPolicy`— en `marco.definiciones`, una cláusula por umbral y sin dígitos; el
 *  VALOR de cada umbral que la cláusula imprime se devuelve en `cifras` (regla 1). El umbral de frenado planteado en la consulta se declara además en la referencia (aquí solo se nombra su origen). */
export function procedenciaDeLosUmbrales({ partesUtiles, premisas, consultaDeFrenado, estadosDeUniverso, basesDeUniverso }) {
  const estadosEnJuego = new Set();
  for (const p of partesUtiles) {
    estadosDeUniverso(p.universo, estadosEnJuego);
    for (const c of p.conceptos || []) if (ESTADO_DE_CONCEPTO[c]) estadosEnJuego.add(ESTADO_DE_CONCEPTO[c]);
  }
  for (const pr of premisas || []) {
    estadosDeUniverso(pr.universo != null ? pr.universo : pr.de, estadosEnJuego);
    const e = estadoDeLaPremisa(pr.estado);
    if (e) estadosEnJuego.add(e);
  }
  const llavesDeEstados = umbralesDeEstados([...estadosEnJuego]);
  /* §7.3·40(a): un conjunto de la casa que ES un estado de inventario pone en juego los umbrales de ESE estado, esté en `base` o en `excluir.conjuntos` (`basesDeUniverso` suma los dos) */
  const basesEnJuegoDeLaCasa = new Set();
  for (const p of partesUtiles) basesDeUniverso(p.universo, basesEnJuegoDeLaCasa);
  for (const pr of premisas || []) basesDeUniverso(pr.universo != null ? pr.universo : pr.de, basesEnJuegoDeLaCasa);
  const llavesDeBases = [...new Set([...umbralesDeBases([...basesEnJuegoDeLaCasa]), ...umbralesDeConceptos(partesUtiles.flatMap((p) => p.conceptos || []))])];
  const definiciones = [...procedenciaDeUmbrales([...new Set([...llavesDeEstados, ...llavesDeBases])], consultaDeFrenado)];
  const cifras = [];
  for (const k of llavesDeEstados) { const val = valorDeUmbralEnTexto(k, consultaDeFrenado); if (val) cifras.push(val); }
  /* RAÍZ A5 (§7.3·36b «el piso de materialidad»): un conjunto que DEPENDE de un umbral (`UMBRALES_DE_BASE`) declara su origen en su propia oración */
  definiciones.push(...procedenciaDeMaterialidad(llavesDeBases, consultaDeFrenado));
  for (const k of llavesDeBases) { const val = valorDeUmbralEnTexto(k, consultaDeFrenado); if (val) cifras.push(val); }
  return { definiciones, cifras };
}
