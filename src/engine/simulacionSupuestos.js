/* === src/engine/simulacionSupuestos.js · LA SIMULACIÓN COMBINADA: UN SOLO MODELO ARITMÉTICO PARA TODO SUPUESTO COMERCIAL (owner 2026-10-09, ensayo 9) ═══════════════════
 * Hasta el ensayo 9 cada supuesto de una simulación corría en SU herramienta (precio y volumen → `simulateGeneral`; costo y margen → `simulateCosto`; carga → `simulateCarga`) y
 * la Entrega pegaba los resultados como si fueran uno: «costo +10 % y precio +5 %» mostraba el margen del precio con el costo SIN mover (31.1 % donde el correcto es 20 %), el
 * costo solo devolvía únicamente el costo, «costo sobre el negocio» no tenía productor y `simulateGeneral` calculaba la contribución como venta − costo SIN las acciones comerciales
 * (en marca, familia y producto el costo NO las incluye: Samsung salía con 27.7 % de margen donde el dato dice 23.4 %). Esta hoja es el modelo único, PURO (sin tenant, sin red,
 * sin LLM): recibe filas ya leídas y supuestos tipados y devuelve cifras exactas. Todo supuesto de una parte se aplica JUNTO sobre la fila de cada entidad; un supuesto que no se
 * puede combinar sin inventar un reparto se RECHAZA con la razón (`resolverAlcance`) — nunca un resultado parcial que calle un supuesto.
 *
 * LA FILA (en la escala del dato, miles): venta V · costo C (el que la fila publica) · acciones comerciales R (`rebates`) · contribución K. La identidad del dato es V = costo + acciones + contribución;
 * en el eje CUENTA la fila publica el costo YA con las acciones dentro (V = C + K) y en marca, familia y producto sin ellas (V = C + R + K): `incl` lo detecta por la propia fila (la que
 * cierra mejor), no por el nombre del eje. `Cex` = el costo SIN acciones comerciales, la parte que un movimiento del costo mueve.
 *
 * EL MODELO, un solo lugar (declarado en la Entrega como límite; el mismo del costo variable que `simulateGeneral` ya declaraba — «el costo escala con el volumen, nunca con el precio»):
 *   · precio p %      → V' = V·(1+p). El precio NO mueve las unidades, ni el costo, ni las acciones comerciales en pesos.
 *   · volumen g %     → V', el costo y las acciones comerciales escalan con g (la carga como % de la venta no cambia). Un crecimiento en DINERO es g = monto ÷ venta del alcance, a precio constante.
 *   · costo c %       → el costo de los productos (sin acciones comerciales) × (1+c). La venta y las acciones no se mueven.
 *   · carga d puntos  → las acciones comerciales pasan a (su valor + d % de la venta simulada); no bajan de cero (el tope se declara).
 *   · margen d puntos → con la venta igual, la contribución cambia en d % de la venta: el costo absorbe el cambio (la misma cuenta que «cuánto costo hay que mover para ese margen»).
 *   Todos a la vez: V' = V(1+p)(1+g) · Cex' = Cex(1+g)(1+c) − m·V' · R' = max(0, R(1+g) + d·V') · K' = K + (V' − V) − (Cex' − Cex) − (R' − R). Margen = K ÷ V. Las identidades del dato se conservan:
 *   (V' − costo' − acciones' − K') = (V − costo − acciones − K), el residuo de redondeo de la propia fila. */

export const TIPOS_COMERCIALES = Object.freeze(["growth", "price", "costo", "margin", "carga"]);
/** el rango operable por tipo (porcentaje, o puntos para carga y margen): más allá deja de ser un supuesto — el mismo criterio de ±50 % de `simulateGeneral`/`simulateCosto` y de 20 puntos de `simulateCarga` */
export const RANGO_MAXIMO = Object.freeze({ growth: 50, price: 50, costo: 50, margin: 20, carga: 20 });
export const ES_COMERCIAL = (tipo) => TIPOS_COMERCIALES.includes(tipo);

const _fin = (x) => typeof x === "number" && Number.isFinite(x);
const _r1 = (x) => Math.round((x + (x >= 0 ? 1e-9 : -1e-9)) * 10) / 10;

/** baseDeFila(r) → { V, C, R, K, incl, carga } | null · la fila del dato (miles) con la identidad leída de ella misma */
export function baseDeFila(r) {
  if (!r || !_fin(r.venta) || !_fin(r.costo) || !_fin(r.contribucion) || !(r.venta > 0)) return null;
  const R = _fin(r.rebates) ? r.rebates : 0;
  const incl = Math.abs(r.venta - r.costo - r.contribucion) < Math.abs(r.venta - r.costo - R - r.contribucion);
  return { V: r.venta, C: r.costo, R, K: r.contribucion, incl, carga: _fin(r.pctRebate) ? r.pctRebate : _r1((R / r.venta) * 100) };
}

/** sumarBases(bases) → la base del negocio: Σ de las filas del eje (cada una con SU forma de costo; un eje trae una sola) */
export function sumarBases(bases) {
  const t = { V: 0, C: 0, R: 0, K: 0, incl: bases.every((b) => b.incl) };
  for (const b of bases) { t.V += b.V; t.C += b.C; t.R += b.R; t.K += b.K; }
  t.carga = t.V > 0 ? _r1((t.R / t.V) * 100) : 0;
  return t;
}

/** simularFila(b, a) → { ok:true, V1, C1, R1, K1, m0, m1, carga0, carga1, liberado, topadoPp } | { ok:false, razon }
 *  a = { price, g, costo, margin, carga } (porcentajes; carga y margin en puntos): los que no vienen valen 0 */
export function simularFila(b, a = {}) {
  const p = (a.price || 0) / 100, g = (a.g || 0) / 100, c = (a.costo || 0) / 100, dm = (a.margin || 0) / 100, dc = (a.carga || 0) / 100;
  const Cex = b.incl ? b.C - b.R : b.C;
  const V1 = b.V * (1 + p) * (1 + g);
  const Cex1 = Cex * (1 + g) * (1 + c) - dm * V1;
  if (!(Cex1 >= 0)) return { ok: false, razon: "con ese supuesto el costo de los productos quedaría negativo: el supuesto deja de ser operable sobre el dato actual" };
  const Rpre = b.R * (1 + g);
  let R1 = Rpre + dc * V1, topadoPp = null;
  if (R1 < 0) { topadoPp = V1 > 0 ? +(((Rpre) / V1) * 100).toFixed(2) : 0; R1 = 0; }
  const K1 = b.K + (V1 - b.V) - (Cex1 - Cex) - (R1 - b.R);
  const C1 = b.incl ? Cex1 + R1 : Cex1;
  const m0 = _r1((b.K / b.V) * 100), m1 = V1 > 0 ? _r1((K1 / V1) * 100) : null;
  const carga0 = b.carga, carga1 = V1 > 0 ? _r1(b.carga + 100 * (R1 / V1 - b.R / b.V)) : null;
  return { ok: true, V1, C1, R1, K1, m0, m1, carga0, carga1, liberado: Rpre - R1, topadoPp };
}

/* ═══ EL ALCANCE: A QUIÉN LE TOCA CADA SUPUESTO, Y CUÁNDO DOS SUPUESTOS NO SE PUEDEN COMBINAR ═══════════════════════════════════════════════════════════════════════
 * Un supuesto afecta al negocio entero o a UNA entidad de un eje. Dos supuestos del mismo eje se combinan fila por fila (cada entidad recibe los suyos); de ejes distintos, no: sin el cruce
 * entre ejes (cuánto de la venta de una cuenta es de cada marca) ADI tendría que inventar el reparto. El resultado pedido (las entidades de la parte) tiene que ser del mismo eje que los
 * supuestos. Dos supuestos del MISMO tipo que tocan a la misma entidad son ambiguos (¿se suman? ¿manda uno?): se pide uno solo. */
const _TIPO_TXT = { growth: "de volumen", price: "de precio", costo: "de costo", margin: "de margen", carga: "de carga comercial" };

/** resolverAlcance({ supuestos, entidades, canon, nombresDe }) → { ok:true, eje, universo:[nombre], conTotal, aplicables:Map nombre → [supuesto], paraTotal:[supuesto] } | { ok:false, problemas:[{ ids, detalle }] }
 *   supuestos  [{ id, tipo, valor, unidad, alcance }] · los citados por UNA parte, ya con productor comercial
 *   entidades  [{ nombre, eje }] · las de la parte ya resueltas ([] = la parte no nombra entidades)
 *   pideTotal  la parte pidió el universo «negocio» además de sus entidades (o no nombra ninguna): el resultado trae también el TOTAL del negocio con los supuestos
 *   canon      (eje, nombre) → nombre del dato | null · nombresDe (eje) → [nombre] del eje */
export function resolverAlcance({ supuestos, entidades = [], pideTotal = false, canon, nombresDe }) {
  const S = Array.isArray(supuestos) ? supuestos : [];
  const problemas = [];
  const mal = (ids, detalle) => problemas.push({ ids: ids.filter(Boolean), detalle });
  if (!S.length) return { ok: false, problemas: [{ ids: [], detalle: "la simulación no tiene ningún supuesto que aplicar" }] };
  for (const s of S) {
    const max = RANGO_MAXIMO[s.tipo];
    if (!_fin(s.valor) || s.valor === 0) mal([s.id], `el supuesto ${s.id} no mueve nada (${_fin(s.valor) ? "0" : "no es un número"}): dime en cuánto cambia, con su signo`);
    else if (s.unidad !== "money" && Math.abs(s.valor) > max) mal([s.id], `un cambio ${_TIPO_TXT[s.tipo]} de ${s.valor > 0 ? "+" : ""}${s.valor}${s.unidad === "pp" ? " puntos" : "%"} ya no es un supuesto operable (el rango es de ±${max}${s.unidad === "pp" ? " puntos" : "%"}) — prueba un valor realista y lo corro sobre el dato real`);
  }
  /* los ejes de los supuestos: negocio no cuenta */
  const ejes = [...new Set(S.filter((s) => s.alcance !== "negocio" && s.alcance && s.alcance.eje).map((s) => s.alcance.eje))];
  if (ejes.length > 1) {
    mal(S.filter((s) => s.alcance !== "negocio").map((s) => s.id), `los supuestos tocan ejes distintos (${ejes.join(" y ")}): ADI no tiene el cruce entre ${ejes.join(" y ")} —cuánto de la venta de una cuenta es de cada marca, de cada familia o de cada producto—, así que combinarlos sería inventar ese reparto. Exprese todos los supuestos sobre el mismo eje (o sobre el negocio), o pida cada uno en su propia simulación`);
  }
  const ejesParte = [...new Set(entidades.map((e) => e.eje).filter(Boolean))];
  if (ejesParte.length > 1) mal(S.map((s) => s.id), `la parte pide entidades de ejes distintos (${ejesParte.join(" y ")}): una simulación se lee sobre un solo eje`);
  const ejeResultado = ejesParte[0] || ejes[0] || "cliente";
  if (ejes.length === 1 && ejesParte.length === 1 && ejes[0] !== ejesParte[0]) {
    mal(S.filter((s) => s.alcance !== "negocio").map((s) => s.id), `el resultado pedido es de ${ejesParte[0]} y el supuesto es sobre ${ejes[0]}: ADI no tiene el cruce entre ${ejesParte[0]} y ${ejes[0]} (cuánto de ${ejesParte[0] === "cliente" ? "una cuenta" : "una entidad"} es de cada ${ejes[0]}), así que no puede decir cómo le pega. Pida el resultado sobre ${ejes[0]}, o exprese el supuesto sobre ${ejesParte[0]}`);
  }
  /* supuestos del mismo tipo que tocan a la misma entidad */
  const porTipo = new Map();
  for (const s of S) { if (!porTipo.has(s.tipo)) porTipo.set(s.tipo, []); porTipo.get(s.tipo).push(s); }
  for (const [tipo, lista] of porTipo) {
    if (lista.length < 2) continue;
    const negocio = lista.filter((s) => s.alcance === "negocio");
    const nombres = new Map();
    let repetido = null;
    for (const s of lista.filter((x) => x.alcance !== "negocio")) {
      const n = canon ? canon(s.alcance.eje, s.alcance.nombre) : s.alcance.nombre;
      if (nombres.has(n)) repetido = repetido || [nombres.get(n), s.id]; else nombres.set(n, s.id);
    }
    if (negocio.length > 1 || (negocio.length === 1 && lista.length > 1) || repetido) {
      mal(lista.map((s) => s.id), `dos supuestos ${_TIPO_TXT[tipo]} tocan a la misma entidad (${lista.map((s) => s.id).join(" y ")}): no sé si se suman o manda uno. Deje uno solo por entidad, o pida cada uno en su propia simulación`);
    }
  }
  if (problemas.length) return { ok: false, problemas };

  /* el universo del resultado y a quién le toca qué */
  const nombresParte = entidades.map((e) => (canon ? canon(e.eje, e.nombre) : e.nombre) || e.nombre);
  const conTotal = nombresParte.length === 0 || Boolean(pideTotal);
  let universo = nombresParte;
  if (!universo.length) {
    universo = [];
    for (const s of S) if (s.alcance !== "negocio") { const n = canon ? canon(s.alcance.eje, s.alcance.nombre) : s.alcance.nombre; if (n && !universo.includes(n)) universo.push(n); }
  }
  const aplicables = new Map();
  for (const n of universo) {
    aplicables.set(n, S.filter((s) => s.alcance === "negocio" || ((canon ? canon(s.alcance.eje, s.alcance.nombre) : s.alcance.nombre) === n)));
  }
  /* cada supuesto tiene que tocar a alguien del resultado */
  for (const s of S) {
    const toca = conTotal || [...aplicables.values()].some((l) => l.includes(s));
    if (!toca) mal([s.id], `el supuesto ${s.id} es sobre ${s.alcance.nombre} y la simulación pide ${nombresParte.join(", ")}: no toca a ninguna de las entidades pedidas. Pida ${s.alcance.nombre} también, o quite el supuesto`);
  }
  /* una entidad pedida que ningún supuesto toca se muestra sin cambio (es la respuesta: «no le pasa nada»); si NINGUNA fue tocada no hay simulación */
  if (!conTotal && ![...aplicables.values()].some((l) => l.length)) mal(S.map((s) => s.id), "ningún supuesto toca a las entidades pedidas: no hay nada que simular");
  if (problemas.length) return { ok: false, problemas };
  return { ok: true, eje: ejeResultado, universo, conTotal, aplicables, paraTotal: S.slice(), nombresDeEje: typeof nombresDe === "function" ? nombresDe(ejeResultado) : [] };
}

/** parametrosDe(supuestos, V, vNegocio) → { price, g, costo, margin, carga } · los supuestos que tocan a UNA fila, ya en porcentaje/puntos; el crecimiento en dinero es monto ÷ la venta del ALCANCE del supuesto
 *  (`ventaDelAlcance(s)` en miles → pesos con `fx`), a precio constante. Devuelve null y la razón si un crecimiento en dinero no tiene venta contra la que convertirse. */
export function parametrosDe(supuestos, { ventaDelAlcance, fx = 1 }) {
  const a = {};
  for (const s of supuestos) {
    if (s.tipo === "growth") {
      if (s.unidad === "money") {
        const v = ventaDelAlcance(s);
        if (!_fin(v) || !(v > 0)) return { ok: false, razon: `no encuentro la venta de ${s.alcance === "negocio" ? "el negocio" : s.alcance.nombre} para convertir el crecimiento en dinero` };
        a.g = (s.valor / (v * fx)) * 100;
      } else a.g = s.valor;
      if (Math.abs(a.g) > RANGO_MAXIMO.growth + 1e-9) return { ok: false, razon: `un crecimiento de ${s.unidad === "money" ? "ese monto" : `${s.valor}%`} equivale a ${a.g > 0 ? "+" : ""}${(Math.round(a.g * 10) / 10)}% de volumen sobre ${s.alcance === "negocio" ? "el negocio" : s.alcance.nombre}: ya no es un supuesto operable (el rango es de ±${RANGO_MAXIMO.growth}%)` };
    } else a[s.tipo] = s.valor;
  }
  return { ok: true, a };
}
