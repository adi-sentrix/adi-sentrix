/* === src/adi/encargo/simulacion.js · LA HERRAMIENTA DE LA SIMULACIÓN COMBINADA DEL ENCARGO (owner 2026-10-09, ensayo 9) ═════════════════════════════════════════════════
 * Envoltura delgada de `engine/simulacionSupuestos.js` (el modelo aritmético único) con el contrato de una herramienta de lectura: `{ facts, boleta, coverage }`. `lecturasDe.js` emite UNA llamada
 * por parte `simulacion` con TODOS sus supuestos comerciales (precio · volumen · costo · carga · margen, de cualquier eje o del negocio) y ESTA función los aplica juntos sobre la fila de cada
 * entidad: ya no hay una herramienta por supuesto cuyos resultados se pegan. Vive en la caja de lecturas del Encargo (`REGISTRO_LECTURAS`), no en `TOOLS`: el oráculo y el agente conservan sus
 * herramientas de siempre.
 *
 * LAS CIFRAS (las mismas etiquetas de siempre, `Entidad · Venta actual/supuesta`…, para que el compositor no cambie de forma): venta · costo · contribución · margen — actual y supuesto — y, si
 * algún supuesto es de CARGA, la carga actual/supuesta y lo liberado/comprometido. El costo es el que la fila publica (en el eje cuenta ya incluye las acciones comerciales; en marca, familia y
 * producto no). Sin entidades nombradas en la parte, además va el NEGOCIO: el total del eje con el supuesto (la respuesta a «¿y qué pasa con la venta total?»).
 *
 * EL MODELO DE COSTO (`costModelOf`): un cambio de VOLUMEN mueve el costo solo si el negocio declaró que su costo es variable; sin ese modelo, volumen sin movimiento de costo se limita a la venta
 * (degrade honesto, como `simulateGeneral`) y volumen CON un movimiento de costo, carga o margen se rechaza — no hay forma honesta de combinar lo que el modelo no autoriza. Precio, costo, carga y
 * margen no necesitan el modelo: no dependen de cómo escala el costo con el volumen.
 *
 * LAS ACCIONES COMERCIALES CON EL PRECIO (owner 2026-10-09): un cambio de precio las mueve con la venta (mantienen su % de ella) salvo que la empresa haya declarado montos fijos
 * (`perfil.accionesComerciales`, `accionesComercialesDe()`, el mismo camino de política que `costModelOf`). La regla aplicada y su origen viajan en `facts` para que la Entrega los diga. */
import { rawRecordFor } from "../oracle/entityRecord.js";
import { axisEntityNames, resolveCanonical } from "../oracle/entityIndex.js";
import { fig } from "../boleta.js";
import { getTenantData } from "../../data/tenantStore.js";
import { factorComercialDe } from "../../config/contract/figureType.js";
import { costModelOf, benchmarkOf, accionesComercialesDe } from "../../config/businessPolicy.js";
import { formatoDeLaCasa } from "../notario/hechos.js";
import { baseDeFila, sumarBases, simularFila, resolverAlcance, parametrosDe, ES_COMERCIAL } from "../../engine/simulacionSupuestos.js";

const _fx = () => factorComercialDe(getTenantData());
const _dinero = (miles) => formatoDeLaCasa(miles * _fx(), "money");
const _pct = (n) => formatoDeLaCasa(n, "pct");
const _signo = (n) => (n > 0 ? "+" : "");
/* lo que el USUARIO planteó no es una medición: la cifra se cuelga con su origen («supuesto», la ley de los cuatro orígenes: `notario/evidencia.js`), así `derivar` no la toma por medida ni `retomar` la contrasta con los datos */
const _delUsuario = (f) => { f.origen = { titular: "supuesto" }; return f; };

/** problemasDeCombinacion(supuestos, entidades) → [{ ids, detalle }] | [] · la MISMA prueba de alcance que la herramienta, para que el validador del Encargo rechace ANTES de componer (con la razón que enseña) */
export function problemasDeCombinacion(supuestos, entidades, pideTotal = false) {
  const r = resolverAlcance({ supuestos: (supuestos || []).filter((s) => ES_COMERCIAL(s.tipo)), entidades: entidades || [], pideTotal, canon: resolveCanonical, nombresDe: axisEntityNames });
  return r.ok ? [] : r.problemas;
}

const _contexto = (lista, quien) => `supuesto: ${lista.map((s) => `${_nombreTipo(s)}`).join(" · ")} sobre ${quien} (dato real)`;
function _nombreTipo(s) {
  const v = s.unidad === "money" ? formatoDeLaCasa(Math.abs(s.valor), "money") : `${_signo(s.valor)}${s.valor}${s.unidad === "pp" ? " puntos" : "%"}`;
  return `${{ growth: "volumen", price: "precio", costo: "costo", margin: "margen", carga: "carga comercial" }[s.tipo] || s.tipo} ${s.unidad === "money" ? `+${v}` : v}`;
}

/** simularSupuestos({ supuestos, entidades, scenario }) → { facts, boleta, coverage } */
export function simularSupuestos({ supuestos = [], entidades = [], pideTotal = false, scenario } = {}) {
  const sin = (reason) => ({ facts: null, boleta: [], coverage: { supported: false, reason } });
  const S = (Array.isArray(supuestos) ? supuestos : []).filter((s) => s && ES_COMERCIAL(s.tipo));
  const ents = (Array.isArray(entidades) ? entidades : []).map((e) => (typeof e === "string" ? { nombre: e, eje: null } : e)).filter((e) => e && e.nombre);
  const al = resolverAlcance({ supuestos: S, entidades: ents, pideTotal, canon: resolveCanonical, nombresDe: axisEntityNames });
  if (!al.ok) return sin(al.problemas.map((p) => p.detalle).join(" · "));
  const eje = al.eje;
  const modelo = costModelOf();
  const costoVariable = Boolean(modelo && modelo.tipo === "variable_total");
  const acciones = accionesComercialesDe();
  /* las filas del eje: el total del negocio y la venta del alcance de un crecimiento en dinero salen de ellas */
  const nombresEje = axisEntityNames(eje);
  const filas = new Map();
  for (const n of nombresEje) { const b = baseDeFila(rawRecordFor(eje, n, scenario)); if (b) filas.set(n, b); }
  for (const n of al.universo) if (!filas.has(n)) return sin(`no encuentro '${n}' en el eje '${eje}' con venta, costo y contribución`);
  const total = sumarBases([...filas.values()]);
  const fx = _fx();
  const canon = (s) => (s.alcance === "negocio" ? null : resolveCanonical(s.alcance.eje, s.alcance.nombre));
  const ventaDelAlcance = (s) => (s.alcance === "negocio" ? total.V : (filas.get(canon(s)) || {}).V);

  const boleta = [], factsEnt = [], topados = [];
  const benchmarks = [];
  const hayCarga = S.some((s) => s.tipo === "carga");
  const bloques = [...al.universo.map((n) => ({ nombre: n, base: filas.get(n), sup: al.aplicables.get(n) || [] }))];
  if (al.conTotal) bloques.push({ nombre: "Negocio", base: total, sup: al.paraTotal, esTotal: true });

  for (const bl of bloques) {
    /* el negocio con supuestos propios de algunas entidades: se simula fila por fila y se suma (cada fila recibe SOLO los suyos) */
    const filasDelBloque = bl.esTotal ? [...filas.entries()].map(([n, b]) => ({ n, b, sup: S.filter((s) => s.alcance === "negocio" || canon(s) === n) })) : [{ n: bl.nombre, b: bl.base, sup: bl.sup }];
    let acum = { V0: 0, C0: 0, R0: 0, K0: 0, V1: 0, C1: 0, R1: 0, K1: 0, lib: 0 };
    /* sin un modelo de costo declarado, un cambio de volumen no mueve el costo: se limita a la venta; combinado con un movimiento del costo, de la carga o del margen, se rechaza */
    const conVolumen = filasDelBloque.some(({ sup }) => sup.some((s) => s.tipo === "growth"));
    const sinModelo = !costoVariable && conVolumen;
    if (sinModelo && filasDelBloque.some(({ sup }) => sup.some((s) => s.tipo === "costo" || s.tipo === "margin" || s.tipo === "carga"))) {
      return sin("el negocio no declaró cómo escala su costo con el volumen (costo variable o fijo): no puedo combinar un cambio de volumen con un movimiento del costo, de la carga comercial o del margen sin inventar ese modelo. Pida el cambio de volumen solo (se calcula la venta), o declare cómo se comporta el costo");
    }
    for (const { n, b, sup } of filasDelBloque) {
      const p = parametrosDe(sup, { ventaDelAlcance, fx });
      if (!p.ok) return sin(p.razon);
      const r = simularFila(b, { ...p.a, accionesFijas: acciones.fijas });
      if (!r.ok) return sin(`${n}: ${r.razon}`);
      if (r.topadoPp != null) topados.push(`${n} (${r.topadoPp} puntos)`);
      acum.V0 += b.V; acum.C0 += b.C; acum.R0 += b.R; acum.K0 += b.K;
      acum.V1 += r.V1; acum.C1 += r.C1; acum.R1 += r.R1; acum.K1 += r.K1; acum.lib += r.liberado;
    }
    const nom = bl.nombre;
    const ctx = _contexto(bl.sup.length ? bl.sup : S, bl.esTotal ? "el negocio" : nom);
    const m0 = Math.round((acum.K0 / acum.V0) * 1000 + 1e-7) / 10, m1 = acum.V1 > 0 ? Math.round((acum.K1 / acum.V1) * 1000 + 1e-7) / 10 : null;
    const M = (miles) => miles * fx;
    /* el margen/carga de una sola fila: el que el dato declara (misma cifra que `consultar`); el del negocio, el cociente */
    const m0v = bl.esTotal ? m0 : (Math.round((bl.base.K / bl.base.V) * 1000 + 1e-7) / 10);
    const ent = bl.esTotal ? "Negocio" : nom;
    boleta.push(fig(`${ent} · Venta actual`, _dinero(acum.V0), { unit: "money", raw: M(acum.V0), source: "actual", context: ctx }));
    boleta.push(fig(`${ent} · Venta supuesta`, _dinero(acum.V1), { unit: "money", raw: M(acum.V1), mandatory: true, source: "computed", formula: "venta × (1 + precio) × (1 + volumen)", context: ctx }));
    if (!sinModelo) {
      boleta.push(fig(`${ent} · Costo actual`, _dinero(acum.C0), { unit: "money", raw: M(acum.C0), source: "actual", context: ctx }));
      boleta.push(fig(`${ent} · Costo supuesto`, _dinero(acum.C1), { unit: "money", raw: M(acum.C1), source: "computed", formula: "costo × (1 + volumen) × (1 + costo), sin acciones comerciales; más las acciones comerciales en el eje cuenta", context: ctx }));
      boleta.push(fig(`${ent} · Contribución actual`, _dinero(acum.K0), { unit: "money", raw: M(acum.K0), source: "actual", context: ctx }));
      boleta.push(fig(`${ent} · Contribución supuesta`, _dinero(acum.K1), { unit: "money", raw: M(acum.K1), mandatory: true, source: "computed", formula: "venta supuesta − costo supuesto − acciones comerciales supuestas (con la diferencia de redondeo del dato)", context: ctx }));
      boleta.push(fig(`${ent} · Margen actual`, _pct(m0v), { unit: "pct", raw: m0v, source: "actual", context: ctx }));
      boleta.push(fig(`${ent} · Margen supuesto`, _pct(m1), { unit: "pct", raw: m1, mandatory: true, source: "computed", formula: "contribución supuesta ÷ venta supuesta × 100", context: ctx }));
      const cargaPropia = bl.sup.some((s) => s.tipo === "carga");
      if (cargaPropia) {
        const c0 = bl.esTotal ? Math.round((acum.R0 / acum.V0) * 1000 + 1e-7) / 10 : bl.base.carga;
        const c1 = Math.round((c0 + 100 * (acum.R1 / acum.V1 - acum.R0 / acum.V0)) * 10 + 1e-7) / 10;
        boleta.push(fig(`${ent} · Carga actual`, _pct(c0), { unit: "pct", raw: c0, source: "actual", context: ctx }));
        boleta.push(fig(`${ent} · Carga supuesta`, _pct(c1), { unit: "pct", raw: c1, source: "computed", formula: "acciones comerciales supuestas ÷ venta supuesta × 100", context: ctx }));
        if (Math.abs(acum.lib) > 1e-9) boleta.push(fig(`${ent} · ${acum.lib > 0 ? "Liberado" : "Comprometido"}`, _dinero(Math.abs(acum.lib)), { unit: "money", raw: M(Math.abs(acum.lib)), source: "computed", formula: "acciones comerciales antes del movimiento de carga − después", context: ctx }));
        benchmarks.push(benchmarkOf(bl.esTotal ? null : rawRecordFor(eje, nom, scenario)));
      }
    }
    /* LO QUE EL USUARIO PLANTEÓ, con id: el valor de cada supuesto que toca a este bloque es una cifra que la oración imprime («el precio sube 5%») y viaja como cifra de apoyo —nunca una cifra sin id—. Van DESPUÉS de los pares: el compositor empareja con la primera base de cada concepto («Costo actual», no «Costo propuesto»). */
    for (const s of bl.sup) {
      const ab = Math.abs(s.valor);
      if (s.tipo === "price") boleta.push(_delUsuario(fig(`${ent} · Precio propuesto`, `${ab}%`, { unit: "pct", raw: s.valor, source: "actual", context: ctx })));
      else if (s.tipo === "costo") boleta.push(_delUsuario(fig(`${ent} · Costo propuesto`, `${ab}%`, { unit: "pct", raw: s.valor, source: "actual", context: ctx })));
      else if (s.tipo === "growth" && s.unidad !== "money") boleta.push(_delUsuario(fig(`${ent} · Volumen propuesto`, `${ab}%`, { unit: "pct", raw: s.valor, source: "actual", context: ctx })));
      else if (s.tipo === "growth") boleta.push(_delUsuario(fig(`${ent} · Crecimiento propuesto`, formatoDeLaCasa(ab, "money"), { unit: "money", raw: ab, source: "actual", context: ctx })));
      else if (s.tipo === "margin") boleta.push(_delUsuario(fig(`${ent} · Margen propuesto`, `${ab} ${ab === 1 ? "punto" : "puntos"}`, { unit: "pp", raw: s.valor, source: "actual", context: ctx })));
      else if (s.tipo === "carga") boleta.push(_delUsuario(fig(`${ent} · Carga propuesta`, `${ab} ${ab === 1 ? "punto" : "puntos"}`, { unit: "pp", raw: s.valor, source: "actual", context: ctx })));
    }
    /* un crecimiento en DINERO se simuló como volumen a precio constante: el % equivalente (monto ÷ venta del alcance) es una cifra de la simulación y la Entrega lo declara */
    if (!bl.esTotal && bl.sup.some((s) => s.tipo === "growth" && s.unidad === "money")) {
      const sm = bl.sup.find((s) => s.tipo === "growth" && s.unidad === "money");
      const pm = parametrosDe([sm], { ventaDelAlcance, fx });
      if (pm.ok) boleta.push(_delUsuario(fig(`${ent} · Volumen propuesto`, _pct(pm.a.g), { unit: "pct", raw: pm.a.g, source: "computed", formula: "crecimiento en dinero / venta del período cerrado × 100 (a precio constante)", context: ctx })));
    }
    factsEnt.push({ entidad: ent, supuestos: bl.sup.map((s) => s.id), ...(bl.esTotal ? { esTotal: true } : {}) });
  }
  if (hayCarga && benchmarks.length) boleta.push(fig("Benchmark de margen", _pct(benchmarks[0]), { unit: "pct", raw: benchmarks[0], source: "actual", formula: "referencia declarada (POLICY · no inventado)", context: _contexto(S, "el negocio") }));
  const facts = {
    simulacion: "supuestos", dimension: eje, conTotal: al.conTotal, entidades: factsEnt,
    ...(topados.length ? { topadas: topados } : {}),
    ...(!costoVariable && S.some((s) => s.tipo === "growth") ? { limitacion: "el negocio no declaró cómo escala su costo con el volumen: el cálculo del cambio de volumen se limita a la venta" } : {}),
    costModelAutorizado: costoVariable,
    ...(S.some((s) => s.tipo === "price") ? { accionesComerciales: acciones.tipo, accionesComercialesOrigen: acciones.origen } : {}),
  };
  return { facts, boleta, coverage: { supported: true, figCount: boleta.length } };
}
