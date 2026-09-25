/* === _origenes_gate.mjs · ORÍGENES · COMPOSICIÓN · FUERZA EN EL LIBRO DE HECHOS (owner 2026-09-25, offline) ═══════
 * Etapa 1 · corte 2. Cuatro orígenes SIEMPRE distinguibles de un insumo —medido (por ADI sobre datos de la
 * empresa) · documento (extraído de un documento) · declarado (por el usuario) · supuesto (para un escenario)—,
 * separados de la CONFIRMACIÓN (un sello aparte: quién, cuándo, medio, sobre qué, que NUNCA cambia el origen).
 * Cada cifra lleva su COMPOSICIÓN completa —cada insumo con su origen, su id y su rol, SIN RESUMIR NUNCA— y por
 * separado su FUERZA: `verificada` (solo medidos, o documento verificado por ADI) · `condicionada` (algún insumo
 * declarado/extraído/confirmado, nombrando de cuál depende) · `hipotetica` (algún supuesto). Un declarado NUNCA
 * pisa un medido: misma llave (concepto, entidad, eje, período, unidad) y dos orígenes → los DOS hechos quedan,
 * más un hecho `discrepancia`.
 *
 * LA VÍA DE ORIGEN SIN TOCAR boleta.js (regla del repo): `fig()` no acepta un opt `origen` (destructura solo lo
 * que conoce; su return no hace spread de opts desconocidos) — así que un `origen` en sus opts se perdería en
 * silencio. La vía real, que este gate ejercita igual que un futuro productor lo haría: `fig()` devuelve un
 * objeto plano y mutable; se le CUELGA `.origen` (y opcionalmente `.confirmacion`) DESPUÉS, antes de empujarlo a
 * la boleta — `evidencia.js` lo lee igual que ya lee `context`/`source`/`cobertura`.
 *
 * Hoy NINGÚN composer real declara un origen ≠ medido («sin origen declarado = medido», la ley del owner): los
 * únicos productores futuros son «aportar contexto» (declarado, documento) y el motor de escenarios (supuesto).
 * Este gate construye esos orígenes A MANO, como lo haría un productor futuro, para probar que el libro sabe
 * RECIBIRLOS sin que ninguna de las 4 rutas fijas de `entrega/componer.js` ni los 7 gates que hoy importan
 * `notario/hechos.js` (_hechos_gate, _entrega_gate, _verificador_crudo_gate, _anclas_gate, _cau01_carga_resto_gate,
 * _piso_materialidad_gate, _notario_v3_flujo_gate — TODOS verdes tras este corte, corridos uno por uno) cambien
 * un byte: hoy, sin productor, `origen.titular` es siempre "medido" y `procedencia` (LEGADO) sale exactamente
 * igual que antes.
 *
 * CERO llamadas a un LLM: todo determinístico, sin red. Solo por `npm run gates:offline` (o
 * `node --import ./scripts/offline-guard.mjs _origenes_gate.mjs`). */
import { fig } from "./src/adi/boleta.js";
import { indiceDeEvidencia } from "./src/adi/notario/evidencia.js";
import {
  libroDeHechos, asignarIds, origenDe, naturalezaDe, fuerzaDe, composicionDe, confirmacionDe, procedenciaDe,
  ORIGENES, NATURALEZAS, FUERZAS, ORDEN_FIRMEZA_ORIGEN, peorOrigen, procedenciaLegado,
} from "./src/adi/notario/hechos.js";

let PASS = 0, FAIL = 0;
const ok = (c, m, extra = "") => { if (c) { PASS++; console.log("  ✓ " + m); } else { FAIL++; console.log("  ✗ " + m + (extra ? "\n      " + extra : "")); } };
const H = (t) => console.log(`\n${t}`);
const EJES = { cliente: ["Jumbo", "Falabella"] };
const con = (f, extra) => Object.assign(f, extra);   // «cuelga» .origen/.confirmacion sobre la fig ya devuelta por fig() — la vía sin tocar boleta.js

/* ═══ 1 · EL VOCABULARIO ═══ */
H("1 · el vocabulario de los tres ejes nuevos");
ok(ORIGENES.join(",") === "medido,documento,declarado,supuesto", "los cuatro orígenes, en el orden de la ley");
ok(NATURALEZAS.join(",") === "directo,derivado,estimacion_referencia,propuesta", "las cuatro naturalezas");
ok(FUERZAS.join(",") === "verificada,condicionada,hipotetica", "las tres fuerzas");
ok(ORDEN_FIRMEZA_ORIGEN[0] === "medido", "medido es el más firme");
ok(peorOrigen("medido", "declarado") === "declarado" && peorOrigen("documento", "supuesto") === "supuesto" && peorOrigen() === null, "peorOrigen: el de menor firmeza gana; sin nada, null");
ok(procedenciaLegado("medido", "directo") === "medido" && procedenciaLegado("declarado", "directo") === "supuesto_usuario" && procedenciaLegado("medido", "derivado") === "derivado" && procedenciaLegado("medido", "estimacion_referencia") === "estimacion_referencia" && procedenciaLegado("medido", "propuesta") === "propuesta", "la tabla fija reconstruye las 5 categorías legadas desde (origen, naturaleza)");

/* ═══ 2 · medido + medido → verificada ═══ */
H("2 · medido + medido → verificada (con crudo)");
{
  const figs = asignarIds([
    fig("Jumbo · Venta", "$100K", { unit: "money", raw: 100000 }),
    fig("Jumbo · Costo", "$60K", { unit: "money", raw: 60000 }),
  ]);
  const I = indiceDeEvidencia({ figs, ejesDelTenant: EJES });
  const libro = libroDeHechos([
    { id: "margen", tipo: "razon", num: { id: figs[0].id }, den: { id: figs[0].id }, forma: "pct" },
  ], { indice: I });
  // una razón trivial (misma cifra sobre sí) no verifica (razon-vacua) — se usa solo para poblar figs con crudo real en el test 3/4 de abajo
  void libro;
  const libro2 = libroDeHechos([{ id: "c1", tipo: "ref", de: figs[0].id }], { indice: I });
  const c1 = libro2.porId.get("c1");
  ok(c1.ok, "c1 verdadera", c1.motivo);
  ok(origenDe(libro2, "c1").titular === "medido", "origen.titular = medido (sin origen declarado)");
  ok(naturalezaDe(libro2, "c1") === "directo", "naturaleza = directo (una fig citada tal cual)");
  ok(fuerzaDe(libro2, "c1") === "verificada", "fuerza = verificada (medido + crudo)");
  ok(procedenciaDe(libro2, "c1") === "medido", "procedencia LEGADO = medido, igual que antes de este corte");
  ok(composicionDe(libro2, "c1").length === 1 && composicionDe(libro2, "c1")[0].rol === "valor", "composición: un insumo, rol «valor»");
}

/* ═══ 3 · medido + declarado → condicionada, composición COMPLETA (los dos insumos visibles) ═══ */
H("3 · medido + declarado → condicionada, con los DOS insumos visibles y el que depende nombrado");
{
  const medida = con(fig("Falabella · Venta", "$50K", { unit: "money", raw: 50000 }), {});
  const declarada = con(fig("Falabella · Benchmark de margen declarado", "22%", { unit: "pct", raw: 22 }), { origen: { titular: "declarado", fuentes: [{ origen: "declarado", ref: null }] } });
  const figs = asignarIds([medida, declarada]);
  const I = indiceDeEvidencia({ figs, ejesDelTenant: EJES });
  const libro = libroDeHechos([{ id: "r1", tipo: "razon", num: { id: figs[0].id }, den: { id: figs[0].id }, forma: "pct" }], { indice: I });
  void libro;
  // una razón real medido/declarado, con las dos figs (unidades compatibles: ambas money no sirve para pct — se arma con dos figs money)
  const medida2 = con(fig("Falabella · Costo", "$30K", { unit: "money", raw: 30000 }), {});
  const declarada2 = con(fig("Falabella · Costo declarado por el cliente", "$28K", { unit: "money", raw: 28000 }), { origen: { titular: "declarado" } });
  const figs2 = asignarIds([medida2, declarada2]);
  const I2 = indiceDeEvidencia({ figs: figs2, ejesDelTenant: EJES });
  const libro2 = libroDeHechos([{ id: "r2", tipo: "derivada", op: "cociente", de: [figs2[0].id, figs2[1].id], valor: "1.1x" }], { indice: I2 });
  const r2 = libro2.porId.get("r2");
  ok(r2.ok, "r2 verdadera (dos insumos, unidades compatibles)", r2.motivo);
  ok(origenDe(libro2, "r2").titular === "declarado", "origen.titular = declarado (el peor de los dos)");
  ok(fuerzaDe(libro2, "r2") === "condicionada", "fuerza = condicionada");
  const comp = composicionDe(libro2, "r2");
  ok(comp.length === 2, `composición COMPLETA: ${comp.length} insumos (nunca resumida a 1)`);
  ok(comp.some((c) => c.origen === "medido") && comp.some((c) => c.origen === "declarado"), "los DOS orígenes distintos están visibles en la composición");
  const dependeDe = comp.find((c) => c.origen === "declarado");
  ok(!!dependeDe && !!dependeDe.rol, `nombra de qué insumo depende: rol «${dependeDe && dependeDe.rol}»`);
}

/* ═══ 4 · con supuesto → hipotética (gana sobre cualquier otra combinación) ═══ */
H("4 · con supuesto → hipotética");
{
  const medida = con(fig("Falabella · Venta", "$50K", { unit: "money", raw: 50000 }), {});
  const supuesta = con(fig("Falabella · Precio propuesto", "$55K", { unit: "money", raw: 55000 }), { origen: { titular: "supuesto" } });
  const figs = asignarIds([medida, supuesta]);
  const I = indiceDeEvidencia({ figs, ejesDelTenant: EJES });
  const libro = libroDeHechos([{ id: "s1", tipo: "derivada", op: "diferencia", de: [figs[1].id, figs[0].id], valor: "$5K" }], { indice: I });
  const s1 = libro.porId.get("s1");
  ok(s1.ok, "s1 verdadera", s1.motivo);
  ok(fuerzaDe(libro, "s1") === "hipotetica", "fuerza = hipotética (un insumo es supuesto)");
  ok(origenDe(libro, "s1").titular === "supuesto", "origen.titular = supuesto (el peor)");
  ok(origenDe(libro, "s1").lista.includes("medido") && origenDe(libro, "s1").lista.includes("supuesto"), "origen.lista trae los DOS orígenes vistos, no solo el peor");
}

/* ═══ 5 · CRUDO: PARA CALCULAR, NO PARA CITAR ═══
 * Corte 2c (owner 2026-09-25, corrige el corte 2b): «el valor es el comprobante a la precisión de lo impreso»
 * (ley vigente del Notario) — una cita directa que repite EXACTAMENTE lo mostrado sigue verdadera aunque la fig
 * no tenga crudo; el crudo es obligatorio para HACER UNA CUENTA NUEVA (razón/derivada), no para citar. El corte
 * 2b había hecho que esta rama rechazara la cita entera sin crudo — `_ronda5_gate` (RA15) lo cazó: una cita
 * legítima de un composer de la casa («LG-DRYER8KG · Valor de inventario = $14K», sin crudo) quedaba
 * «no-verificable» y tumbaba el ancla. Lo único que sin-crudo sigue cambiando es la FUERZA: nunca «verificada»,
 * y NUNCA «condicionada» tampoco (esa palabra es de un insumo declarado por el usuario) — null. */
H("5 · CRUDO OBLIGATORIO PARA CALCULAR — una cita directa sin crudo sigue verdadera, con fuerza null");
{
  // una fig SIN raw: evidencia.js reparsea el texto mostrado y marca crudo:false (la lección 36,3→36,1)
  const sinCrudo = fig("Jumbo · Días vencido", "12 días", { unit: "days" });   // sin `raw`
  const figs = asignarIds([sinCrudo]);
  const I = indiceDeEvidencia({ figs, ejesDelTenant: EJES });
  ok(I.figs[0].crudo === false, "control: el índice SÍ marca crudo:false para esta fig");
  const libro = libroDeHechos([{ id: "c2", tipo: "ref", de: figs[0].id }], { indice: I });
  const c2 = libro.porId.get("c2");
  ok(c2.veredicto === "verdadera", "★ CONTROL · c2 (cita directa, sin crudo) sigue verdadera — «el valor es el comprobante a la precisión de lo impreso»", c2.motivo);
  ok(fuerzaDe(libro, "c2") == null, `★ CARNADA · fuerza = ${fuerzaDe(libro, "c2")} (null: ni verificada, ni condicionada, ni hipotética)`);

  // control negativo: la MISMA fig, citada con VALOR (mismoValor) también sigue verdadera — el crudo no toca
  // NINGUNA rama de cita, solo razón/derivada.
  const libroConValor = libroDeHechos([{ id: "c3", tipo: "cifra", sujeto: "Jumbo", metrica: "Días vencido", valor: "12 días" }], { indice: I });
  const c3 = libroConValor.porId.get("c3");
  ok(c3.veredicto === "verdadera", "★ CONTROL · la MISMA fig, citada CON valor (mismoValor), sigue verdadera", c3.motivo);
  ok(fuerzaDe(libroConValor, "c3") !== "condicionada", `fuerza de c3 = ${fuerzaDe(libroConValor, "c3")} (nunca condicionada)`);
}

/* ═══ 6 · declarado ≠ medido con la misma llave → AMBOS + discrepancia ═══ */
H("6 · declarado ≠ medido, misma llave → los DOS hechos quedan + un hecho «discrepancia»");
{
  const medida = con(fig("Jumbo · Benchmark de margen", "20%", { unit: "pct", raw: 20 }), {});
  const declarada = con(fig("Jumbo · Benchmark de margen (declarado)", "25%", { unit: "pct", raw: 25 }), { origen: { titular: "declarado" } });
  const figs = asignarIds([medida, declarada]);
  const I = indiceDeEvidencia({ figs, ejesDelTenant: EJES });
  const libro = libroDeHechos([
    { id: "bm", tipo: "cifra", sujeto: "Jumbo", metrica: "benchmark" },
    { id: "bd", tipo: "ref", de: figs[1].id },
  ], { indice: I });
  const bm = libro.porId.get("bm"), bd = libro.porId.get("bd");
  ok(bm && bm.ok, "bm (medido) sigue verdadera", bm ? bm.motivo : "sin hecho");
  ok(bd && bd.ok, "bd (declarado) sigue verdadera — NINGUNO pisa al otro", bd ? bd.motivo : "sin hecho");
  const disc = libro.hechos.find((x) => x.tipo === "discrepancia" && x.de && x.de.includes("bm") && x.de.includes("bd"));
  ok(!!disc, "se emitió un hecho «discrepancia» que nombra a los dos", disc ? disc.motivo : (libro.hechos.filter((x) => x.tipo === "discrepancia").map((x) => `${x.id}:${(x.de || []).join("+")}`).join(" · ") || "ninguna discrepancia en el libro"));
  ok(!!disc && disc.diferencia && Math.abs(Math.abs(disc.diferencia.raw) - 5) < 1e-9, "la diferencia queda calculada (|25 − 20| = 5)");
}

/* ═══ 7 · misma llave, MISMO origen → no es discrepancia ═══ (control negativo) */
H("7 · CONTROL NEGATIVO · misma llave, mismo origen (dos medidos) → sin discrepancia");
{
  const a = fig("Jumbo · Margen", "18%", { unit: "pct", raw: 18 });
  const figs = asignarIds([a]);
  const I = indiceDeEvidencia({ figs, ejesDelTenant: EJES });
  const libro = libroDeHechos([{ id: "u1", tipo: "ref", de: figs[0].id }], { indice: I });
  ok(!libro.hechos.some((x) => x.tipo === "discrepancia"), "ninguna discrepancia (un solo origen no colisiona consigo mismo)");
}

/* ═══ 8 · la confirmación es un sello APARTE: NO cambia el origen ═══ */
H("8 · la confirmación no cambia el origen");
{
  const declarada = con(fig("Falabella · Piso de rotación (declarado)", "3x", { unit: "ratio", raw: 3 }), {
    origen: { titular: "declarado" },
    confirmacion: { por: "jc", cuando: "2026-09-25", medio: "chat-anfitrion", sobre: { concepto: "piso_rotacion", entidad: "Falabella" } },
  });
  const figs = asignarIds([declarada]);
  const I = indiceDeEvidencia({ figs, ejesDelTenant: EJES });
  const libro = libroDeHechos([{ id: "cf", tipo: "ref", de: figs[0].id }], { indice: I });
  ok(origenDe(libro, "cf").titular === "declarado", "el origen sigue siendo «declarado» aunque esté confirmado");
  const conf = confirmacionDe(libro, "cf");
  ok(!!conf && conf.por === "jc" && conf.medio === "chat-anfitrion", "la confirmación viaja aparte: quién, cuándo, medio, sobre qué");
}

/* ═══ 9 · simulación: piezas distinguibles (base · supuesto · resultado · delta) ═══
 * «límites» (lo que NO se movió: modelo de costo, volumen) no es un HECHO del libro — es una ausencia/límite del
 * Marco de la Entrega (fuera de `notario/hechos.js`, corte futuro): este gate prueba las cuatro piezas que SÍ son
 * hechos, distinguibles por origen/naturaleza/fuerza. */
H("9 · simulación en piezas distinguibles (base · supuesto · resultado · delta)");
{
  const base = con(fig("Jumbo · Precio actual", "$10K", { unit: "money", raw: 10000 }), {});
  const supuesto = con(fig("Jumbo · Precio propuesto", "$11K", { unit: "money", raw: 11000 }), { origen: { titular: "supuesto" } });
  const figs = asignarIds([base, supuesto]);
  const I = indiceDeEvidencia({ figs, ejesDelTenant: EJES });
  const libro = libroDeHechos([
    { id: "base", tipo: "ref", de: figs[0].id },
    { id: "sup", tipo: "ref", de: figs[1].id },
    { id: "resultado", tipo: "derivada", op: "suma", de: [figs[1].id, figs[0].id], valor: "$21K" },   // solo para poblar naturaleza=derivado; no es la cuenta real de negocio
    { id: "delta", tipo: "derivada", op: "diferencia", de: [figs[1].id, figs[0].id], valor: "$1K" },
  ], { indice: I });
  ok(fuerzaDe(libro, "base") === "verificada" && origenDe(libro, "base").titular === "medido", "base: verificada, origen medido");
  ok(fuerzaDe(libro, "sup") === "hipotetica" && origenDe(libro, "sup").titular === "supuesto", "supuesto: hipotética, origen supuesto");
  ok(fuerzaDe(libro, "resultado") === "hipotetica", "resultado: fuerza hipotética (hereda el supuesto — el insumo más débil manda)");
  ok(fuerzaDe(libro, "delta") === "hipotetica", "delta: fuerza hipotética");
  ok(origenDe(libro, "resultado").lista.includes("medido") && origenDe(libro, "resultado").lista.includes("supuesto"), "resultado: origen.lista distingue AMBOS insumos (no colapsa a uno)");
  ok(composicionDe(libro, "resultado").length === 2 && composicionDe(libro, "delta").length === 2, "resultado y delta: composición completa, 2 insumos cada uno — base y supuesto siguen distinguibles dentro de la pieza derivada");
}

/* ═══ 10 · CARNADA — si la fuerza se resumiera como «el peor origen» perdiendo la composición, esto arde ═══ */
H("10 · CARNADA · la fuerza NUNCA pierde la composición al resumir");
{
  const a = con(fig("Jumbo · Ajuste A", "$40K", { unit: "money", raw: 40000 }), {});
  const b = con(fig("Jumbo · Ajuste B", "$25K", { unit: "money", raw: 25000 }), { origen: { titular: "declarado" } });
  const c = con(fig("Jumbo · Ajuste C", "$2K", { unit: "money", raw: 2000 }), { origen: { titular: "supuesto" } });
  const figs = asignarIds([a, b, c]);
  const I = indiceDeEvidencia({ figs, ejesDelTenant: EJES });
  const libro = libroDeHechos([{ id: "z1", tipo: "derivada", op: "suma", de: [figs[0].id, figs[1].id, figs[2].id], valor: "$67K" }], { indice: I });
  const comp = composicionDe(libro, "z1");
  ok(comp.length === 3, `★ CARNADA · los 3 insumos siguen visibles (dio ${comp.length}) — un resumen «peor origen» los habría colapsado a 1`);
  ok(new Set(comp.map((x) => x.origen)).size === 3, "★ CARNADA · los TRES orígenes distintos (medido · declarado · supuesto) están todos, sin colapsar");
  ok(fuerzaDe(libro, "z1") === "hipotetica", "la fuerza sigue siendo la correcta (hipotética, por el supuesto) aunque la composición no se resuma");
}

console.log(`\n── _origenes_gate: ${PASS} PASS · ${FAIL} FAIL (de ${PASS + FAIL}) ──`);
if (FAIL > 0) process.exit(1);
