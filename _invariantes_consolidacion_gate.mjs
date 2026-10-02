/* === _invariantes_consolidacion_gate.mjs · LOS CONTROLES AUTOMÁTICOS DE LA CONSOLIDACIÓN (owner 2026-09-30, offline) ====
 * La consolidación (paso 2) lleva cada propiedad que 20+ sitios decidían por su cuenta a UNA pieza. Este gate es lo que
 * impide que vuelvan a divergir: cada familia registra una función invariante (`scripts/consolidacion/familias/fN_*.mjs`) que
 * lee la ENTREGA y el DATO de la proyección —nunca el código de la pieza— y devuelve violaciones. Con UNA violación firme, ROJO.
 *
 * LO QUE ESTE GATE EXIGE:
 *   0 · LA INFRAESTRUCTURA — el marco carga las familias registradas (F1 al menos); el GENERADOR de encargos al azar es
 *       determinístico (misma semilla ⇒ mismos encargos; otra semilla ⇒ otros), produce encargos que el validador acepta y
 *       los varía (temas, cierres, ejes, universos, criterios con lente o referencia).
 *   1 · EL CORPUS — los catálogos v13–v28 (fixture, ~1.600 encargos) más una MUESTRA FIJA del generador (semilla de este gate).
 *       El total (miles de encargos) corre aparte: `node --import ./scripts/offline-guard.mjs scripts/consolidacion/medir.mjs`.
 *   2 · CERO VIOLACIONES FIRMES en todo el corpus, de TODAS las familias registradas. Una sola ⇒ rojo.
 *   3 · LAS ABIERTAS están CONGELADAS: reglas del contrato vigente cuyo cumplimiento exige comportamiento nuevo (frases nuevas) y que
 *       están a decisión del owner; se cuentan y NO pueden crecer (si bajan, se actualiza la cifra congelada).
 *   4 · CARNADAS — un control que nunca falla no prueba nada: sobre Entregas reales se rompe UNA propiedad a la vez (primero que no
 *       pide atención, referencia como criterio, «ventas» en cobranza, «por riesgo integrado» sobre un grupo, oración de prioridad sin marca,
 *       «no trae X» con X impreso, marca que nombra a otro) y el control TIENE que ponerlas en rojo, con la regla que corresponde.
 *       (4b · F2 lo servido · 4c · F3 la referencia de la consulta · 4d · F4 el rótulo de cada cifra: «Venta a crédito» ≠ «Venta», capital inmovilizado ≠ crítico,
 *       saldo por vencer ≠ saldo pendiente, las filas de señales conservan su rótulo, una fig sin clave se declara.)
 *   5 · INDEPENDENCIA Y CABLEADO (estático) — el control de la F1 no importa la pieza; ningún sitio de la F1 conserva su propia decisión
 *       (las helpers viven en `entrega/prioridad.js`) ni lee la oración de prioridad con una expresión regular sobre la prosa.
 *   0b · LA COBERTURA (segunda vuelta, owner 2026-10-01): las mediciones ciegas v29 y v30 fallaron en el eje BODEGA, que el generador casi no producía —los controles
 *       no probaban ese terreno—. El sub-azar de cobertura (`scripts/consolidacion/cobertura.mjs`, semilla derivada `<semilla>:cobertura`, sin mover las secuencias de la
 *       F1–F3) ejerce cada combinación válida tema × cierre × eje × concepto × forma de universo × premisa × criterio (+ la foto, la simulación y las lecturas de varias
 *       partes) y entra al corpus del §1; el §2 exige 0 violaciones también sobre él.
 *   4f · carnadas de la segunda vuelta: una lectura o decision con eje X sirve entidades del eje X (`eje-servido`, `primero-fuera-del-eje`) · la foto se sirve, completa y por el
 *       primer concepto pedido (`foto-sin-servir`, `foto-incompleta`, `foto-ordenada-por-otro-concepto`) · un «sin dato» nunca acompaña a una cifra que el dato publica
 *       (`sin-dato-con-dato-publicado`, `servida-sin-fila`) — con los ocho casos de v29 y v30 (J16 J17 J18 J35 J50 K16 K17 K18) como base verde.
 *   4g · carnadas de la PARTE B (segunda vuelta; owner 2026-10-01): F6, la frase de una premisa (R1 el rótulo de cada cifra: `premisa-cifra-sin-rotulo`, `premisa-rotulo-de-otro-concepto`; R2 un extremo sobre un
 *       ranking con miembros sin dato: `extremo-sobre-ranking-incompleto`, `ausente-sin-nombrar`) y tres reglas nuevas de la F2 (la foto de cobranza en el orden de la mesa, el cero del empate del filo en palabras,
 *       la ausencia en la forma «sin dato de X para Y»). Son FIRMES: el owner aprobó el cambio de ~120 textos de los catálogos v13–v28 y la pieza las cumple (4h).
 *   4i · carnadas de la 54 (v31 y v32) y 4j · carnadas de la 55 (mediciones v33 y v34): un top por ventas ordena la lista y la oración lo dice («por venta, el top que se pidió») sin declarar que «ventas» no ordena · el nombre de la lente «ventas» es POR PARTE
 *       («venta a crédito» solo en una parte de cobranza) · la lista tras «ninguna cuenta queda primera» conserva el orden pedido · el % con la forma de la casa. El sub-azar de cobertura agrega, al final y con su semilla derivada
 *       (`<semilla>:cobertura:prioridad`), 48 encargos con la lente «ventas» (comercial + cobranza · inventario por SKU con un top por ventas) sin mover las celdas ni los conteos.
 *   4k · carnadas de la 57 (mediciones v37 y v38): la lente «crecimiento» ordena por la variación EN % y corona a la mayor en TODOS los caminos (grupo · foto · universo con miembros · entidades nombradas · plan del tema), y a quien no tiene
 *       el dato se le declara (F1: B25 · B22 · A27) · en un encargo mixto cada parte que decide lleva SU oración de prioridad con el nombre de su lente (F1: B71) · la bodega, cada no_estado y cada rama de una unión son eslabones de un conteo (F6: B40).
 *       El sub-azar de cobertura agrega, al final y con sus semillas derivadas (`<semilla>:cobertura:crecimiento` y `<semilla>:cobertura:eslabones`), 48 encargos con la lente «crecimiento» (nombradas con y sin un miembro sin dato · mixtos con las mismas entidades por parte)
 *       y 48 conteos con bodega, no_estados y unión, sin mover las celdas, los conteos, la prioridad ni el orden nombrado.
 *   6 · CERO red.
 *
 * Solo por `npm run gates:offline` o `node --import ./scripts/offline-guard.mjs _invariantes_consolidacion_gate.mjs`. */
import fs from "node:fs";
import { createHash } from "node:crypto";
import { cargarBase } from "./scripts/consolidacion/base.mjs";
import { cargarCatalogos, armarCorpus, entregaDe } from "./scripts/consolidacion/corpus.mjs";
import { generarEncargos, generarCobertura, generarConteosDeCadena, generarPrioridadPorParte, generarEntidadesFueraDeOrden, generarCrecimientoPorCamino, generarEslabonesDeBodegaYUnion, VARIANTES_DE_ORDEN_NOMBRADO, VARIANTES_DE_CONTEO, VARIANTES_DE_PRIORIDAD, VARIANTES_DE_CRECIMIENTO, VARIANTES_DE_ESLABON, especificacionesDeCeldas, auditarCobertura } from "./scripts/consolidacion/generador.mjs";
import { cargarFamilias, correrCorpus, revisarEntrega } from "./scripts/consolidacion/marco.mjs";
import { clasificarFuente } from "./scripts/clasificarGates.mjs";

let pass = 0, fail = 0;
const ok = (c, m, extra = "") => { if (c) { pass++; console.log("  ✓ " + m); } else { fail++; console.log("  ✗ " + m + (extra ? "\n      " + extra : "")); } };
const H = (t) => console.log(`\n${t}`);

/* la muestra fija del generador que corre ESTE gate (rápida); el total corre en `scripts/consolidacion/medir.mjs` */
const SEMILLA_GATE = "adi-consolidacion-gate-1";
const N_MUESTRA = 400;
/* LAS ABIERTAS CONGELADAS (reglas vigentes cuyo cumplimiento es comportamiento nuevo, a decisión del owner; ver el informe de la F1):
 *   F1 · 48(b)/51(d) «riesgo» pedido sobre un solo dominio, o una lente pedida que no ordena el conjunto, y la prioridad se dice «por riesgo integrado».
 * Congeladas sobre ESTE corpus (catálogos + muestra fija): pueden bajar, nunca subir. */
/* F5 (segunda vuelta): una simulación en profundidad BREVE con más de 8 filas protegidas por su propio bloque (`filas-sobre-el-tope`): el gobernador de tamaño no parte un bloque de simulación (atomicidad, owner 2026-09-26) y sus oraciones son de prioridad 0 («mejor esfuerzo», `tamano.js`). Cumplirlo es comportamiento nuevo: a decisión del owner. El sub-azar de cobertura la ejerce 1 vez por semilla. */
/* PARTE B (segunda vuelta): las reglas R1/R2 de la F6 y las tres de la F2 (foto de cobranza en el orden de la mesa, cero del empate en palabras, «sin dato de X para Y») estuvieron congeladas (71 · 4 · 2 · 93 · 45 · 22) hasta que el owner aprobó el cambio de ~120 textos; hoy son FIRMES (0 violaciones). */
/* §7.3·55(a) y §7.3·56: la regla de no contradicción de la F1 (`oracion-dice-que-no-ordena-y-ordena`) es FIRME para toda lente: la de «crecimiento» (7 abiertas congeladas hasta la 56) se cerró (donde el dato publica la variación vs año anterior la lente aplica, ordena al mayor y se dice «por crecimiento»). */
const ABIERTAS_CONGELADAS = { "F5:verificador-rechaza-lo-servido": 1 };   /* la F1 las cerró con la condición del §7.3·53: «por riesgo integrado: X» vale cuando X es el primero del plan de señales de ese dominio (107 de 107 la cumplen en el corpus completo, 0 violaciones reales) */

const base = await cargarBase();
const familias = await cargarFamilias();

H("0 · la infraestructura: marco, familias, generador");
ok(familias.length >= 6 && ["F1", "F2", "F3", "F4", "F5", "F6"].every((id) => familias.some((f) => f.id === id)), `el marco carga las familias registradas (${familias.map((f) => f.id).join(", ")})`);
ok(familias.every((f) => typeof f.invariante === "function" && f.nombre), "cada familia declara su nombre y su función invariante");
{
  const a = (await generarEncargos(base, { semilla: "g0", n: 60 })).casos, b = (await generarEncargos(base, { semilla: "g0", n: 60 })).casos, c = (await generarEncargos(base, { semilla: "g1", n: 60 })).casos;
  ok(JSON.stringify(a) === JSON.stringify(b), "el generador es determinístico: la misma semilla produce exactamente los mismos encargos");
  ok(JSON.stringify(a) !== JSON.stringify(c), "otra semilla produce otros encargos");
  const valido = a.every((x) => { const r = base.validar.validarEncargo(x.encargo, {}); return Array.isArray(r.partes) && r.partes.length > 0 && (!r.noResuelto || r.noResuelto.length === 0); });
  ok(valido, "todos los encargos generados los acepta el validador sin reparos");
  const g = (await generarEncargos(base, { semilla: "g2", n: 400 })).casos;
  const dist = (f) => new Set(g.flatMap((x) => x.encargo.partes.map(f))).size;
  ok(dist((p) => p.tema) >= 3 && dist((p) => p.cierre) >= 4 && dist((p) => p.eje || "default") >= 4, `varía los temas (${dist((p) => p.tema)}), los cierres (${dist((p) => p.cierre)}) y los ejes (${dist((p) => p.eje || "default")})`);
  ok(g.some((x) => x.encargo.criterio && x.encargo.criterio.lente) && g.some((x) => x.encargo.criterio && x.encargo.criterio.referencia && !x.encargo.criterio.lente) && g.some((x) => x.encargo.partes.some((p) => p.universo && (p.universo.top || p.universo.estados || p.universo.base || p.universo.filtros || p.universo.excluir))), "produce criterios con lente, con solo una referencia, y universos con top, estados, base, filtros y exclusiones");
}

H("0b · la COBERTURA del generador (segunda vuelta): cada combinación válida —tema × cierre × eje × concepto × forma de universo × premisa × criterio— se ejerce, con su propia semilla");
const SEMILLA_COBERTURA = "adi-consolidacion-gate-cobertura";
const espacio = especificacionesDeCeldas(base, { semilla: SEMILLA_COBERTURA });
const cobertura = generarCobertura(base, { semilla: SEMILLA_COBERTURA, minimo: 1, espacio });
{
  /* el generador general NO se movió: las secuencias que usan la F1, la F2 y la F3 (y el sub-azar de la F3) son byte-idénticas a las de antes de la cobertura */
  const g400 = (await generarEncargos(base, { semilla: SEMILLA_GATE, n: N_MUESTRA })).casos;
  ok(createHash("sha256").update(JSON.stringify(g400)).digest("hex") === "93f9d5ce1c4c445b6d22f3c6b6c32baca2163ed80d62c2a8b791ad2aa0486329", "el sub-azar de cobertura tiene su propia semilla derivada: la secuencia del generador general (400 encargos de la semilla del gate) es byte-idéntica a la de antes");
  const otra = generarCobertura(base, { semilla: SEMILLA_COBERTURA, minimo: 1, espacio });
  ok(JSON.stringify(otra.casos) === JSON.stringify(cobertura.casos), "el sub-azar de cobertura es determinístico (misma semilla, mismos encargos)");
  /* §7.3·54(a): los CONTEOS DE CADENA van AL FINAL del sub-azar con su propia semilla derivada (`<semilla>:cobertura:conteos`): la secuencia de las celdas (los primeros 1223 encargos) es byte-idéntica a la de antes */
  const delasCeldas = cobertura.casos.filter((c) => !/:(?:conteos|prioridad|orden-nombrado|crecimiento|eslabones):/.test(c.id)), conteosDeCadena = cobertura.casos.filter((c) => /:conteos:/.test(c.id));   /* §7.3·55: la prioridad por parte (`:prioridad:`) va después de los conteos, con su propia semilla derivada · §7.3·57: la lente «crecimiento» (`:crecimiento:`) y los eslabones de bodega, no_estados y unión (`:eslabones:`) van al final de todo */
  ok(delasCeldas.length === 1223 && createHash("sha256").update(JSON.stringify(delasCeldas)).digest("hex") === "272520ae6366fcd7808c50cf2fbad71a78b9e85cce7a465655fda69a3f17df8f" && cobertura.casos.slice(0, 1223).every((c, i) => c === delasCeldas[i]), "los conteos de cadena (semilla derivada «:cobertura:conteos») no movieron la secuencia del sub-azar de las celdas: sus 1223 encargos son byte-idénticos a los de antes y van primero");
  ok(conteosDeCadena.length >= 60 && VARIANTES_DE_CONTEO.every((x) => conteosDeCadena.some((c) => c.celda === `CONTEO:${x}`)), `el sub-azar produce ${conteosDeCadena.length} conteos de cadena en las cuatro variantes (el M igual al final · el de un eslabón · fuera de la cadena · un n falso)`);
  ok(cobertura.estadistica.conteos && cobertura.estadistica.conteos.cadenas.filtros >= 30 && cobertura.estadistica.conteos.cadenas.estados >= 3 && cobertura.estadistica.conteos.cadenas.ambos >= 8, `…con cadenas de varios filtros (${cobertura.estadistica.conteos && cobertura.estadistica.conteos.cadenas.filtros}), de varios estados (${cobertura.estadistica.conteos && cobertura.estadistica.conteos.cadenas.estados}) y de filtros con estados (${cobertura.estadistica.conteos && cobertura.estadistica.conteos.cadenas.ambos})`);
  { const otraC = generarConteosDeCadena(base, { semilla: SEMILLA_COBERTURA, n: 64 }), otraD = generarConteosDeCadena(base, { semilla: SEMILLA_COBERTURA + "-b", n: 64 });
    ok(JSON.stringify(otraC.casos) === JSON.stringify(conteosDeCadena) && JSON.stringify(otraC.casos) !== JSON.stringify(otraD.casos), "los conteos de cadena son determinísticos (misma semilla, mismos encargos) y otra semilla da otros"); }
  /* §7.3·55: la PRIORIDAD POR PARTE (la lente «ventas» en comercial + cobranza y en inventario con un top por ventas) va después de los conteos, con su propia semilla derivada (`<semilla>:cobertura:prioridad`): ni las celdas ni los conteos se movieron */
  { const dePrioridad = cobertura.casos.filter((c) => /:prioridad:/.test(c.id));
    ok(dePrioridad.length >= 40 && VARIANTES_DE_PRIORIDAD.every((x) => dePrioridad.some((c) => c.celda === `PRIORIDAD:${x}`)), `el sub-azar produce ${dePrioridad.length} encargos de prioridad por parte en las seis variantes (comercial + cobranza con la lente «ventas» · inventario con un top por ventas)`);
    ok(dePrioridad.every((c) => c.encargo.criterio && c.encargo.criterio.lente === "ventas") && dePrioridad.some((c) => c.encargo.partes.some((p) => p.tema === "comercial") && c.encargo.partes.some((p) => p.tema === "cobranza")) && dePrioridad.some((c) => c.encargo.partes.some((p) => p.tema === "inventario" && p.universo && p.universo.top && p.universo.top.metrica === "ventas")), "…todos con la lente «ventas»: una parte comercial más una de cobranza, y partes de inventario por SKU con un top por ventas");
    ok(cobertura.casos.slice(0, delasCeldas.length + conteosDeCadena.length).every((c) => !/:prioridad:/.test(c.id)) && cobertura.casos.slice(delasCeldas.length + conteosDeCadena.length).filter((c) => !/:(?:orden-nombrado|crecimiento|eslabones):/.test(c.id)).every((c) => /:prioridad:/.test(c.id)), "los de prioridad van después de las celdas y de los conteos");
    const otraP = generarPrioridadPorParte(base, { semilla: SEMILLA_COBERTURA, n: 48 }), otraQ = generarPrioridadPorParte(base, { semilla: SEMILLA_COBERTURA + "-b", n: 48 });
    ok(JSON.stringify(otraP.casos) === JSON.stringify(dePrioridad) && JSON.stringify(otraP.casos) !== JSON.stringify(otraQ.casos), "los encargos de prioridad por parte son determinísticos (misma semilla, mismos encargos) y otra semilla da otros"); }
  /* §7.3·55(c) (C82 de v36): las entidades NOMBRADAS con la lente en cero y en un orden que NO es el del primer concepto pedido van después de la prioridad por parte, con su propia semilla derivada (`<semilla>:cobertura:orden-nombrado`): ni las celdas, ni los conteos, ni la prioridad se movieron */
  { const deOrden = cobertura.casos.filter((c) => /:orden-nombrado:/.test(c.id));
    ok(deOrden.length >= 20 && VARIANTES_DE_ORDEN_NOMBRADO.every((x) => deOrden.some((c) => c.celda === `ORDEN-NOMBRADO:${x}`)), `el sub-azar produce ${deOrden.length} encargos de cobranza con entidades nombradas en cero y la lente «crédito», en las tres variantes`);
    const ordenados = (c) => { const p = c.encargo.partes[0], rk = base.proyeccion.rankings.cliente[p.conceptos[0]]; const vals = new Map(((rk && rk.filas) || []).map((f) => [f.entidad, f.valor])); const ns = p.entidades.map((e) => e.nombre); return ns.slice().sort((x, y) => vals.get(y) - vals.get(x)).some((x, i) => x !== ns[i]); };
    ok(deOrden.every((c) => c.encargo.criterio && c.encargo.criterio.lente === "credito" && c.encargo.partes[0].tema === "cobranza" && c.encargo.partes[0].cierre === "decision" && c.encargo.partes[0].entidades.length >= 2 && ordenados(c)), "…todos con la lente «crédito», decision de cobranza, ≥ 2 entidades nombradas y en un orden DISTINTO del que da el primer concepto pedido (de mayor a menor)");
    ok(cobertura.casos.slice(delasCeldas.length + conteosDeCadena.length).filter((c) => /:prioridad:/.test(c.id)).length >= 40 && cobertura.casos.findIndex((c) => /:orden-nombrado:/.test(c.id)) === delasCeldas.length + conteosDeCadena.length + cobertura.casos.filter((c) => /:prioridad:/.test(c.id)).length, "los de orden nombrado van después de las celdas, los conteos y la prioridad (y antes de la lente «crecimiento» y de los eslabones)");
    const otraO = generarEntidadesFueraDeOrden(base, { semilla: SEMILLA_COBERTURA, n: 24 }), otraO2 = generarEntidadesFueraDeOrden(base, { semilla: SEMILLA_COBERTURA + "-b", n: 24 });
    ok(JSON.stringify(otraO.casos) === JSON.stringify(deOrden) && JSON.stringify(otraO.casos) !== JSON.stringify(otraO2.casos), "los encargos de orden nombrado son determinísticos (misma semilla, mismos encargos) y otra semilla da otros"); }
  /* §7.3·56 · 57: la lente «crecimiento» sobre entidades nombradas (con y sin un miembro sin dato) y los encargos mixtos con las mismas entidades por parte (`<semilla>:cobertura:crecimiento`), y los conteos con bodega, no_estados y unión como eslabones (`<semilla>:cobertura:eslabones`): AL FINAL de todo, sin mover nada de lo anterior */
  { const deCrec = cobertura.casos.filter((c) => /:crecimiento:/.test(c.id)), deEsl = cobertura.casos.filter((c) => /:eslabones:/.test(c.id));
    ok(deCrec.length >= 40 && VARIANTES_DE_CRECIMIENTO.every((x) => deCrec.some((c) => c.celda === `CRECIMIENTO:${x}`)), `el sub-azar produce ${deCrec.length} encargos con la lente «crecimiento» en las seis variantes (nombradas con dato · nombradas con un miembro sin dato · mixtos con las mismas entidades por parte · mixtos con la foto de cada parte)`);
    ok(deCrec.filter((c) => c.celda === "CRECIMIENTO:nombradas-con-un-miembro-sin-dato").every((c) => { const p = c.encargo.partes[0], rk = base.proyeccion.rankings[p.eje || "cliente"] && base.proyeccion.rankings[p.eje || "cliente"].variacion; const con = new Set(((rk && rk.filas) || []).map((f) => f.entidad)); return p.entidades.some((e) => !con.has(e.nombre)) && p.entidades.some((e) => con.has(e.nombre)); }) && deCrec.filter((c) => /^CRECIMIENTO:mixto-mismas/.test(c.celda)).every((c) => { const [a, b] = c.encargo.partes.map((p) => (p.entidades || []).map((e) => e.nombre).sort().join("|")); return c.encargo.partes.length === 2 && c.encargo.partes.map((p) => p.tema).sort().join() === "cobranza,comercial" && a === b && a.length > 0; }), "…las nombradas con un miembro sin dato traen al menos uno CON y uno SIN la variación vs año anterior, y los mixtos con las mismas entidades nombran las MISMAS cuentas en la parte comercial y en la de cobranza");
    const ultimos = cobertura.casos.slice(cobertura.casos.length - deCrec.length - deEsl.length);
    ok(ultimos.slice(0, deCrec.length).every((c) => /:crecimiento:/.test(c.id)) && ultimos.slice(deCrec.length).every((c) => /:eslabones:/.test(c.id)), "los de «crecimiento» y los de eslabones van AL FINAL de todo (en ese orden): ni las celdas, ni los conteos, ni la prioridad, ni el orden nombrado se movieron");
    ok(deEsl.length >= 40 && VARIANTES_DE_ESLABON.every((x) => deEsl.some((c) => c.celda === `ESLABON:${x}`)) && cobertura.estadistica.eslabones && ["bodega", "no_estados", "union"].every((k) => cobertura.estadistica.eslabones.porClase[k] >= 8), `el sub-azar produce ${deEsl.length} conteos de eslabón en las seis variantes, con universos de bodega (${cobertura.estadistica.eslabones && cobertura.estadistica.eslabones.porClase.bodega}), de no_estados (${cobertura.estadistica.eslabones && cobertura.estadistica.eslabones.porClase.no_estados}) y de unión (${cobertura.estadistica.eslabones && cobertura.estadistica.eslabones.porClase.union})`);
    const otraC = generarCrecimientoPorCamino(base, { semilla: SEMILLA_COBERTURA, n: 48 }), otraC2 = generarCrecimientoPorCamino(base, { semilla: SEMILLA_COBERTURA + "-b", n: 48 }), otraE = generarEslabonesDeBodegaYUnion(base, { semilla: SEMILLA_COBERTURA, n: 48 }), otraE2 = generarEslabonesDeBodegaYUnion(base, { semilla: SEMILLA_COBERTURA + "-b", n: 48 });
    ok(JSON.stringify(otraC.casos) === JSON.stringify(deCrec) && JSON.stringify(otraC.casos) !== JSON.stringify(otraC2.casos) && JSON.stringify(otraE.casos) === JSON.stringify(deEsl) && JSON.stringify(otraE.casos) !== JSON.stringify(otraE2.casos), "los encargos de «crecimiento» y de eslabones son determinísticos (misma semilla, mismos encargos) y otra semilla da otros"); }
  const dims = new Set([...espacio.validas.values()].map((c) => c.dim));
  ok(["P", "C", "U", "F", "F2", "Q", "K", "D", "S", "M", "M3"].every((d) => dims.has(d)) && espacio.validas.size >= 1900, `el espacio válido cubre las once dimensiones (${espacio.validas.size} celdas que el validador acepta; ${espacio.noConstruibles.length} combinaciones que no, p. ej. la bodega de un SKU aplicada a una marca)`);
  const aud = auditarCobertura(base, cobertura.casos, { espacio });
  ok(aud.ceros.length === 0, `cada celda válida tiene al menos un encargo que la ejerce (${cobertura.casos.length} encargos del sub-azar; celdas en cero: ${aud.ceros.length})`, aud.ceros.slice(0, 8).join(" · "));
  ok(cobertura.estadistica.sinCompletar.length === 0, "el sub-azar completó el mínimo de cada celda", cobertura.estadistica.sinCompletar.slice(0, 8).join(" · "));
  /* el terreno donde fallaron v29 y v30: la FOTO por BODEGA (lectura y decision), las premisas sobre bodegas, las tres partes de tres dominios */
  const tiene = (k) => (aud.conteo.get(k) || 0) >= 1;
  ok(["rotacion", "dias_inventario", "unidades_stock", "capital"].every((c) => tiene(`F:inventario|lectura|bodega|${c}`) && tiene(`F:inventario|decision|bodega|${c}`)), "ejerce la foto por BODEGA en lectura y decision con cada concepto de la bodega (rotación · días de inventario · unidades en stock · capital)");
  ok(["cifra", "orden", "relacion", "grupo", "conteo", "estado"].every((t) => !espacio.validas.has(`Q:inventario|decision|bodega|${t}`) || tiene(`Q:inventario|decision|bodega|${t}`)), "ejerce cada tipo de premisa sobre sujetos de bodega en una decision de inventario por bodega");
  ok(tiene("M3:comercial|cliente+inventario|bodega+cobranza|cliente") && tiene("M:comercial|cliente+inventario|bodega"), "ejerce una lectura de tres dominios con la parte de inventario por BODEGA (la de J50)");
  ok(["riesgo", "contribucion", "credito", "ventas", "crecimiento", "capital"].every((l) => tiene(`K:inventario|decision|bodega|lente:${l}`)), "ejerce cada lente sobre una decision de inventario por bodega");
}

H("1 · el corpus: los catálogos v13–v28, la muestra fija del azar y el sub-azar de cobertura");
const catalogos = cargarCatalogos();
ok(catalogos.length >= 1600, `los catálogos v13–v28: ${catalogos.length} encargos`);
const { casos: corpusAzar } = await armarCorpus(base, { catalogos: false, azar: { semilla: SEMILLA_GATE, n: N_MUESTRA } });
const corpus = [...catalogos, ...corpusAzar, ...cobertura.casos];
ok(corpusAzar.length === N_MUESTRA, `la muestra fija del azar: ${corpusAzar.length} encargos (semilla «${SEMILLA_GATE}»)`);
ok(cobertura.casos.length >= 1000, `el sub-azar de cobertura: ${cobertura.casos.length} encargos (semilla «${SEMILLA_COBERTURA}:cobertura», mínimo 1 por celda válida)`);

H("2 · cero violaciones firmes en todo el corpus (todas las familias)");
let conPrioridad = 0;
const res = correrCorpus(base, corpus, { familias, porEntrega: (e) => { if ((e.entrega.respuesta || []).some((r) => r._prioridad)) conPrioridad++; } });
ok(res.excepciones === 0, `ninguna Entrega rompe al componerse (${res.compuestos} Entregas compuestas de ${res.total} encargos)`);
ok(res.compuestos >= 1500, "se compusieron las Entregas del corpus (no un corpus vacío)");
const firmes = res.violaciones.filter((v) => !v.abierta);
ok(firmes.length === 0, `0 violaciones firmes de ${familias.map((f) => f.id).join("+")} en ${res.compuestos} Entregas`, firmes.slice(0, 6).map((v) => `${v.caso} ${v.familia}:${v.regla} · ${v.detalle}`).join("\n      "));
ok(conPrioridad >= 400, `el corpus ejercita la prioridad: ${conPrioridad} Entregas con oración de prioridad`);

H("3 · las abiertas, congeladas");
for (const [k, tope] of Object.entries(ABIERTAS_CONGELADAS)) {
  const n = res.abiertas[k] || 0;
  ok(n <= tope, `abierta ${k}: ${n} (congelada en ${tope})${n < tope ? " — bajó: actualizar la cifra congelada" : ""}`);
}
const sinCongelar = Object.keys(res.abiertas).filter((k) => !(k in ABIERTAS_CONGELADAS));
ok(sinCongelar.length === 0, "ninguna regla abierta nueva sin congelar", sinCongelar.join(", "));

H("4 · carnadas: el control TIENE que ponerse en rojo cuando se rompe una propiedad");
{
  const F1 = familias.find((f) => f.id === "F1");
  const clonar = (e) => ({ ...e, respuesta: e.respuesta.map((r) => ({ ...r, ...(r._prioridad ? { _prioridad: { ...r._prioridad } } : {}) })), cifras: e.cifras });
  const buscar = (pred) => { for (const c of catalogos) { const e = entregaDe(base, c); if (!e.ok) continue; const i = e.entrega.respuesta.findIndex((r) => pred(String(r.texto || ""), e)); if (i >= 0) return { e, i, id: c.id }; } return null; };
  const rojo = (e, i, nuevoTexto, regla, msg, mutar = null) => {
    const ent = clonar(e.entrega); ent.respuesta[i].texto = nuevoTexto; if (mutar) mutar(ent.respuesta[i]);
    const vs = revisarEntrega({ ...e, entrega: ent }, [F1]);
    ok(vs.some((v) => v.regla === regla), `${msg} → ${regla}`, JSON.stringify(vs.map((v) => v.regla)));
  };
  /* la base verde: la misma Entrega sin tocar no tiene violaciones */
  const conCifra = buscar((t) => /^Prioridad del procedimiento dentro de este grupo, por [^:(]+: .+, con .+ en .+\.$/.test(t));
  ok(!!conCifra, "hay una Entrega real con una oración de prioridad de grupo con cifra");
  if (conCifra) {
    const { e, i } = conCifra;
    ok(revisarEntrega(e, [F1]).filter((v) => !v.abierta).length === 0, "la Entrega sin tocar no tiene violaciones firmes");
    const t = e.entrega.respuesta[i].texto;
    rojo(e, i, t.replace(/^(Prioridad del procedimiento dentro de este grupo, por )[^:]+(:)/, "$1umbral de venta frenada$2"), "referencia-como-criterio", "una referencia nombrada como el criterio");
    ok(revisarEntrega({ ...e, entrega: { ...clonar(e.entrega), respuesta: e.entrega.respuesta.map((r, k) => { const c = { ...r }; if (k === i) delete c._prioridad; return c; }) } }, [F1]).some((v) => v.regla === "prioridad-sin-marca"), "una oración de prioridad sin su marca estructural → prioridad-sin-marca");
    rojo(e, i, t, "marca-primero-distinto", "una marca que nombra a otro que la oración", (r) => { r._prioridad = { alcance: "grupo", primero: "NADIE-DEL-GRUPO" }; });
  }
  /* el primero que NO pide atención: se cambia el primero por otro miembro del grupo con otro valor, en una oración de la misma Entrega que el control sabe verificar */
  {
    let hecho = false;
    for (const c of catalogos) {
      if (hecho) break;
      const e = entregaDe(base, c); if (!e.ok) continue;
      e.entrega.respuesta.forEach((r, i) => {
        if (hecho) return;
        const m = /^(Prioridad del procedimiento dentro de este grupo, por [^:]+: )(.+?)(, con .+ en .+\.)$/.exec(String(r.texto));
        if (!m) return;
        for (const u of (e.entrega.universos || [])) {
          const otros = (u.entidades || []).filter((x) => x !== m[2]);
          if (!(u.entidades || []).includes(m[2]) || !otros.length) continue;
          for (const otro of otros) {
            const ent = clonar(e.entrega); ent.respuesta[i].texto = `${m[1]}${otro}${m[3]}`; ent.respuesta[i]._prioridad = { alcance: "grupo", primero: otro };
            const vs = revisarEntrega({ ...e, entrega: ent }, [F1]);
            if (vs.some((v) => v.regla === "primero-no-pide-atencion")) { hecho = true; ok(true, `cambiar el primero por otro del grupo (${c.id}) → primero-no-pide-atencion`); return; }
          }
        }
      });
    }
    ok(hecho, "existe al menos una Entrega real donde cambiar el primero lo pone en rojo (primero-no-pide-atencion)");
  }
    /* §7.3·53: «por riesgo integrado: X» sobre un grupo vale solo cuando X es el primero del plan de señales de ese dominio; sobre otro miembro del grupo, el control lo marca */
    {
      let hecho = false;
      for (const c of catalogos) {
        if (hecho) break;
        const e2 = entregaDe(base, c); if (!e2.ok) continue;
        e2.entrega.respuesta.forEach((r, k) => {
          if (hecho) return;
          const m = /^(Prioridad del procedimiento dentro de este grupo, por [^:]+: )(.+?)(, con .+ en .+\.)$/.exec(String(r.texto));
          if (!m) return;
          for (const u of (e2.entrega.universos || [])) {
            if (!(u.entidades || []).includes(m[2])) continue;
            for (const otro of (u.entidades || []).filter((x) => x !== m[2])) {
              const ent2 = clonar(e2.entrega); ent2.respuesta[k].texto = m[1].replace(/, por [^:]+: $/, ", por riesgo integrado: ") + `${otro}${m[3]}`; ent2.respuesta[k]._prioridad = { alcance: "grupo", primero: otro };
              if (revisarEntrega({ ...e2, entrega: ent2 }, [F1]).some((v) => v.regla === "riesgo-nombra-a-quien-no-es-primero-del-plan")) { hecho = true; ok(true, `«por riesgo integrado» que nombra a un miembro que no es el primero del plan (${c.id}) → riesgo-nombra-a-quien-no-es-primero-del-plan`); return; }
            }
          }
        });
      }
      ok(hecho, "existe una Entrega real donde nombrar riesgo sobre quien no es el primero del plan lo pone en rojo");
    }
  /* la lente pedida y su medida: «por contribución: X, con $ en contribución no capturada» (lente contribución pedida) */
  const conLente = buscar((t, e) => /^Prioridad del procedimiento dentro de este grupo, por contribución: [^,]+, con [^ ]+ en contribución no capturada\.$/.test(t) && e.resolucion.criterio && e.resolucion.criterio.origen === "usuario" && e.resolucion.criterio.lente === "contribucion");
  if (conLente) {
    const t = String(conLente.e.entrega.respuesta[conLente.i].texto);
    rojo(conLente.e, conLente.i, t.replace(", por contribución:", ", por margen:"), "lente-pedida-callada", "la lente pedida (contribución) que la oración no nombra ni declara");
    rojo(conLente.e, conLente.i, t.replace(/ en contribución no capturada\.$/, " en saldo vencido."), "lente-nombrada-no-ordeno", "una lente nombrada cuya medida no es la suya (contribución con «saldo vencido»)");
  } else ok(false, "hay una Entrega real con la lente contribución pedida que ordena su grupo con la contribución no capturada");
  const soloRef = buscar((t, e) => /^Prioridad del procedimiento dentro de este grupo, por [^:(]+ \(la referencia pedida, [^,]+, no ordena este grupo\): /.test(t) && e.resolucion.criterio && !e.resolucion.criterio.lente && e.resolucion.criterio.referencia);
  if (soloRef) rojo(soloRef.e, soloRef.i, String(soloRef.e.entrega.respuesta[soloRef.i].texto).replace(/ \(la referencia pedida, [^,]+, no ordena este grupo\)/, ""), "referencia-sin-nombrar", "un criterio que solo trae una referencia y la oración no la nombra como referencia");
  else ok(false, "hay una Entrega real con un criterio que solo trae una referencia, nombrada como referencia");
  const sinLente = buscar((t, e) => /^Prioridad del procedimiento dentro de este grupo, por [^:(]+: [^,]+, con [^ ]+ en [^,]+\.$/.test(t) && e.resolucion.criterio && e.resolucion.criterio.origen === "adi");
  if (sinLente) rojo(sinLente.e, sinLente.i, String(sinLente.e.entrega.respuesta[sinLente.i].texto).replace(/, por [^:]+:/, ", por exposición de crédito:"), "lente-no-pedida", "una lente nombrada sin que el usuario la haya pedido");
  else ok(false, "hay una Entrega real sin lente pedida con una oración de prioridad de grupo");
  const cruzada = buscar((t, e) => /^Prioridad del procedimiento, por exposición de crédito: Lider, con [^ ]+ en saldo vencido\.$/.test(t) && !(e.resolucion.partes || []).some((p) => (Array.isArray(p.entidades) && p.entidades.length) || (p.universo && Object.keys(p.universo).some((k) => k !== "eje"))));
  if (cruzada) rojo(cruzada.e, cruzada.i, String(cruzada.e.entrega.respuesta[cruzada.i].texto).replace(": Lider, con", ": Falabella, con"), "por-lente-cruzada-primero", "la prioridad por exposición de crédito que nombra a quien no es el que más pesa (Falabella en vez de Lider)");
  else ok(false, "hay una Entrega real con la prioridad cruzada por exposición de crédito");
  const cobr = buscar((t) => /^Prioridad del procedimiento(?: dentro de este grupo)?, por venta a crédito: /.test(t));
  if (cobr) rojo(cobr.e, cobr.i, String(cobr.e.entrega.respuesta[cobr.i].texto).replace(", por venta a crédito:", ", por ventas:"), "ventas-en-cobranza-sin-credito", "«ventas» a secas sobre la venta a crédito (cobranza)");
  else ok(false, "hay una Entrega real con la lente «ventas» en cobranza dicha «venta a crédito»");
  const sinP = buscar((t) => /ninguna cuenta queda primera, porque el grupo \(.+\) no tiene contribución no capturada/.test(t));
  if (sinP) rojo(sinP.e, sinP.i, String(sinP.e.entrega.respuesta[sinP.i].texto).replace(/no tiene contribución no capturada \(\$0\)/, "no trae contribución no capturada"), "sin-primero-contradice-lo-impreso", "«el grupo no trae X» mientras la Entrega imprime X");
  else ok(false, "hay una Entrega real con «ninguna cuenta queda primera» por la contribución no capturada en cero");
}

H("4b · carnadas de la F2 (lo anunciado es lo servido · la regla del cero): el control TIENE que ponerse en rojo");
{
  const F2 = familias.find((f) => f.id === "F2");
  const filasDe = (e) => (e.entrega.cifras && e.entrega.cifras.filas) || [];
  const conFilas = (e, filas, extra = {}) => ({ ...e, entrega: { ...e.entrega, cifras: { ...e.entrega.cifras, filas }, ...extra } });
  const regla = (vs, r) => vs.some((v) => v.regla === r);
  const caso = (id) => { const c = catalogos.find((x) => x.id === id); return c ? entregaDe(base, c) : { ok: false }; };
  const norm = (s) => String(s).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  ok(!!F2, "el marco carga la familia F2 (lo anunciado es lo servido)");
  if (F2) {
    /* la base verde: una Entrega con entidades nombradas y premisas (v27:M40, la que decía «no se pudo servir la cifra de PHI-IRON-PRO» y la imprimía) */
    const m40 = caso("v27:M40");
    ok(m40.ok && revisarEntrega(m40, [F2]).length === 0, "v27:M40 (entidad nombrada con premisas): el control no marca nada tras la pieza");
    if (m40.ok) {
      const fs0 = filasDe(m40);
      const iRot = fs0.findIndex((f) => f.valores["Entidad / grupo"] === "PHI-IRON-PRO" && /Rotaci/.test(f.valores["Métrica"]));
      ok(iRot >= 0, "la Entrega de v27:M40 sirve la fila de rotación de PHI-IRON-PRO (el dato la publica)");
      if (iRot >= 0) {
        ok(regla(revisarEntrega(conFilas(m40, fs0.filter((_, k) => k !== iRot)), [F2]), "servida-sin-fila"), "quitar la fila de una entidad nombrada que el dato publica → servida-sin-fila");
        /* un límite que NIEGA lo que la Entrega imprime */
        const lim = { titulo: "Sobre la parte p1 (inventario), no se pudo servir la cifra de PHI-IRON-PRO", motivo: "La lectura de este turno no trajo ninguna cifra de PHI-IRON-PRO para lo pedido: se declara en vez de omitirla. No se sustituye por otra cuenta." };
        ok(regla(revisarEntrega({ ...m40, entrega: { ...m40.entrega, limites: [...m40.entrega.limites, lim] } }, [F2]), "limite-niega-lo-impreso"), "un límite «no se pudo servir la cifra de X» con X impresa → limite-niega-lo-impreso");
        const sd = { titulo: "Sobre la parte p1 (inventario), sin dato de rotación para PHI-IRON-PRO", motivo: "x" };
        ok(regla(revisarEntrega({ ...m40, entrega: { ...m40.entrega, limites: [...m40.entrega.limites, sd] } }, [F2]), "sin-dato-como-numero"), "«sin dato de M para X» con la fila de X impresa → sin-dato-como-numero");
        const nan = fs0.map((f, k) => (k === iRot ? { ...f, valores: { ...f.valores, Valor: "NaN" } } : f));
        ok(regla(revisarEntrega(conFilas(m40, nan), [F2]), "sin-dato-como-numero"), "un valor «NaN» impreso → sin-dato-como-numero");
      }
    }
    /* el cero: medido o de cobertura declarada, nunca otro */
    const t36 = (() => { for (const c of catalogos) { const e = entregaDe(base, c); if (e.ok && filasDe(e).some((f) => f.valores.Tipo && /^cobertura declarada/.test(f.valores.Tipo))) return e; } return null; })();
    ok(!!t36, "hay una Entrega real con un cero de cobertura declarada (su Tipo dice el porqué)");
    if (t36) {
      ok(revisarEntrega(t36, [F2]).length === 0, "la Entrega con ceros de cobertura declarada no tiene violaciones del control");
      const fs1 = filasDe(t36), iC = fs1.findIndex((f) => /^cobertura declarada/.test(f.valores.Tipo || ""));
      ok(/\$0|0d/.test(fs1[iC].valores.Valor) && fs1[iC].origen === "cobertura", "la fila del cero de cobertura imprime 0, lleva su origen y su porqué (cobertura declarada: no figura entre …)");
    }
    const jumbo = (() => { for (const c of catalogos) { const e = entregaDe(base, c); if (e.ok && filasDe(e).some((f) => f.valores["Entidad / grupo"] === "Lider" && /^Saldo vencido$/.test(f.valores["Métrica"]) && /^\$4/.test(f.valores.Valor))) return e; } return null; })();
    ok(!!jumbo, "hay una Entrega real con el saldo vencido medido de Lider");
    if (jumbo) {
      const fs2 = filasDe(jumbo), iL = fs2.findIndex((f) => f.valores["Entidad / grupo"] === "Lider" && /^Saldo vencido$/.test(f.valores["Métrica"]) && /^\$4/.test(f.valores.Valor));
      const cero = fs2.map((f, k) => (k === iL ? { ...f, valores: { ...f.valores, Valor: "$0" } } : f));
      ok(regla(revisarEntrega(conFilas(jumbo, cero), [F2]), "cero-sin-origen"), "Lider con $0 de saldo vencido cuando el dato dice $4.6M (un cero que el dato no demuestra) → cero-sin-origen");
      /* una tasa sin denominador nunca es 0 % */
      const filaTasa = { valores: { "Entidad / grupo": "Jumbo", Tema: "cobranza", "Métrica": "Recuperado", Valor: "0%", Tipo: "medido" }, hechos: [], procedencia: "medido", origen: "medido" };
      const rk = base.proyeccion.rankings.cliente.venta_credito;
      const sinDen = { ...jumbo, entrega: { ...jumbo.entrega, cifras: { ...jumbo.entrega.cifras, filas: [...fs2, filaTasa] } }, dato: { ...base.proyeccion, rankings: { ...base.proyeccion.rankings, cliente: { ...base.proyeccion.rankings.cliente, venta_credito: { ...rk, filas: rk.filas.filter((f) => norm(f.entidad) !== "jumbo") } } } } };
      ok(regla(revisarEntrega(sinDen, [F2]), "tasa-sin-denominador-como-cero"), "«Recuperado 0%» de una cuenta cuya venta a crédito (el denominador) no figura en el dato → tasa-sin-denominador-como-cero");
      const conDen = { ...jumbo, entrega: { ...jumbo.entrega, cifras: { ...jumbo.entrega.cifras, filas: [...fs2, filaTasa] } } };
      ok(!regla(revisarEntrega(conDen, [F2]), "tasa-sin-denominador-como-cero"), "con el denominador en el dato, un 0 % medido no se marca (la base verde de la regla)");
    }
    /* lo anunciado: la cabeza «ordenado por M: A, B» sin la fila de M */
    const cab = (() => { for (const c of catalogos) { const e = entregaDe(base, c); if (!e.ok) continue; const r = e.entrega.respuesta.find((x) => /ordenado por Saldo vencido: /.test(x.texto)); if (r && filasDe(e).filter((f) => /^Saldo vencido$/.test(f.valores["Métrica"])).length >= 2) return e; } return null; })();
    ok(!!cab, "hay una Entrega real con la cabeza «ordenado por Saldo vencido: …»");
    if (cab) {
      ok(revisarEntrega(cab, [F2]).length === 0, "la Entrega de la cabeza no tiene violaciones del control");
      const sinSV = filasDe(cab).filter((f) => !/^Saldo vencido$/.test(f.valores["Métrica"]));
      ok(regla(revisarEntrega(conFilas(cab, sinSV), [F2]), "anunciada-sin-fila") || regla(revisarEntrega(conFilas(cab, sinSV), [F2]), "servida-sin-fila"), "una cabeza que anuncia entidades sin su fila de la métrica → anunciada-sin-fila");
    }
    /* el verificador de la Entrega (regla 19): un cero impreso lleva su origen y el dato lo respalda */
    const conInd = (e) => ({ texto: e.texto, entrega: e.entrega, resolucion: e.resolucion, indice: e.entrega.procedencia && e.entrega.procedencia.libro && e.entrega.procedencia.libro.indice });
    if (t36) {
      const v0 = base.verificar.verificarEntrega(conInd(t36));
      ok(!v0.violaciones.some((x) => x.regla === "cero-sin-origen"), "verificarEntrega: la Entrega con ceros de cobertura declarada no viola la regla 19");
      const muta = (fn) => { const ent = { ...t36.entrega, cifras: { ...t36.entrega.cifras, filas: filasDe(t36).map((f) => (/^cobertura declarada/.test(f.valores.Tipo || "") ? fn(f) : f)) } }; return base.verificar.verificarEntrega({ ...conInd(t36), entrega: ent }); };
      ok(muta((f) => ({ ...f, origen: undefined })).violaciones.some((x) => x.regla === "cero-sin-origen"), "verificarEntrega: un cero impreso SIN origen → cero-sin-origen");
      ok(muta((f) => ({ ...f, origen: "medido" })).violaciones.some((x) => x.regla === "cero-sin-origen"), "verificarEntrega: un cero de cobertura dicho «medido» sin fila de la fuente → cero-sin-origen");
    }
    if (jumbo) {
      const fs3 = filasDe(jumbo), iL = fs3.findIndex((f) => f.valores["Entidad / grupo"] === "Lider" && /^Saldo vencido$/.test(f.valores["Métrica"]) && /^\$4/.test(f.valores.Valor));
      const ent = { ...jumbo.entrega, cifras: { ...jumbo.entrega.cifras, filas: fs3.map((f, k) => (k === iL ? { ...f, valores: { ...f.valores, Valor: "$0" } } : f)) } };
      ok(base.verificar.verificarEntrega({ ...conInd(jumbo), entrega: ent }).violaciones.some((x) => x.regla === "cero-sin-origen"), "verificarEntrega: Lider con $0 que la fuente no trae (vale $4.6M) → cero-sin-origen");
    }
    /* la declaración de cobertura es dato de la fuente: lo que no declara no vale cero */
    const lx = base.lexico;
    ok(lx.ceroPorCobertura("capital_frenado", "sku") && lx.ceroPorCobertura("no_capturada", "cliente") && !lx.ceroPorCobertura("saldo_vencido", "cliente") && !lx.ceroPorCobertura("saldo_pendiente", "cliente") && !lx.ceroPorCobertura("dias_sin_venta", "sku") && !lx.ceroPorCobertura("abonado", "cliente"), "la cobertura es por fuente: la foto de inventario y la venta comercial la declaran; la mesa de cobranza, los días sin venta y el abonado NO (su cero es medido o dato ausente)");
  }
}

H("4c · carnadas de la F3 (la referencia de la consulta, declarada en cada parte que usa el conjunto): el control TIENE que ponerse en rojo");
{
  const F3 = familias.find((f) => f.id === "F3");
  const caso = (id) => { const c = catalogos.find((x) => x.id === id); return c ? entregaDe(base, c) : { ok: false }; };
  const regla = (vs, r) => vs.some((v) => v.regla === r);
  const conLimites = (e, limites, extra = {}) => ({ ...e, entrega: { ...e.entrega, limites, ...extra } });
  const esDecl = (l) => /referencia planteada en la consulta \(/.test(String(l.titulo));
  ok(!!F3, "el marco carga la familia F3 (la referencia de la consulta)");
  if (F3) {
    /* la base verde: v28:L40 (la causa de la F3: una parte SKU con «SKU bajo el benchmark» que no recibía su evidencia y cuyo error se callaba) */
    const l40 = caso("v28:L40");
    ok(l40.ok && revisarEntrega(l40, [F3]).length === 0, "v28:L40 (partes de cuenta y de SKU sobre el conjunto del benchmark): el control no marca nada tras la pieza");
    if (l40.ok) {
      const decl = l40.entrega.limites.filter(esDecl);
      ok(decl.length === 2 && decl.some((l) => /^Sobre las partes p1 y p3 \(comercial\), con la referencia/.test(l.titulo)) && decl.some((l) => /^Con la referencia planteada/.test(l.titulo) && /SKU bajo esa referencia/.test(l.motivo)), "L40: UNA declaración por (conjunto, eje): la de cuentas nombra las dos partes que la usan (p1 y p3); la de SKU, de una sola parte, no hace falta nombrarla");
      const sinSku = l40.entrega.limites.filter((l) => !(esDecl(l) && /SKU bajo esa referencia/.test(l.motivo)));
      ok(regla(revisarEntrega(conLimites(l40, sinSku), [F3]), "referencia-sin-declarar"), "quitar la declaración del conjunto SKU que usa la parte p2 (el error callado) → referencia-sin-declarar");
      const sinPartes = l40.entrega.limites.map((l) => (esDecl(l) && /^Sobre las partes/.test(l.titulo) ? { ...l, titulo: l.titulo.replace(/^Sobre las partes [^,]+, c/, "C") } : l));
      ok(regla(revisarEntrega(conLimites(l40, sinPartes), [F3]), "referencia-sin-partes"), "una declaración usada por DOS partes que no las nombra → referencia-sin-partes");
      const redondeada = l40.entrega.limites.map((l) => (esDecl(l) ? { ...l, titulo: l.titulo.replace("(27.5%)", "(28%)") } : l));
      ok(regla(revisarEntrega(conLimites(l40, redondeada), [F3]), "referencia-valor-inexacto"), "el valor de la consulta escrito redondeado (27.5% → 28%) → referencia-valor-inexacto");
      const otroConteo = l40.entrega.limites.map((l) => (esDecl(l) && /cuentas bajo/.test(l.motivo) ? { ...l, motivo: l.motivo.replace("Serían 6 cuentas", "Serían 5 cuentas") } : l));
      ok(regla(revisarEntrega(conLimites(l40, otroConteo), [F3]), "referencia-no-coincide"), "un conteo que el dato no da → referencia-no-coincide");
      const sinNombres = l40.entrega.limites.map((l) => (esDecl(l) && /cuentas bajo/.test(l.motivo) ? { ...l, motivo: l.motivo.replace(/\): .+ — calculado/, "):  — calculado") } : l));
      ok(regla(revisarEntrega(conLimites(l40, sinNombres), [F3]), "referencia-no-coincide"), "una lista de entidades en blanco (sin «ninguno») → referencia-no-coincide");
      const repetida = [...l40.entrega.limites, ...l40.entrega.limites.filter((l) => esDecl(l) && /cuentas bajo/.test(l.motivo))];
      ok(regla(revisarEntrega(conLimites(l40, repetida), [F3]), "referencia-repetida"), "el mismo (conjunto, eje) declarado dos veces → referencia-repetida");
      const marcoCon = (texto) => ({ ...l40.entrega.marco, referenciaDeclarada: { texto, hechoId: null } });
      ok(regla(revisarEntrega({ ...l40, entrega: { ...l40.entrega, marco: marcoCon("Benchmark de margen: 27.5%, declarado por la empresa.") } }, [F3]), "referencia-reemplaza-a-la-oficial"), "el Marco con la referencia de la consulta donde va la oficial → referencia-reemplaza-a-la-oficial");
      ok(regla(revisarEntrega({ ...l40, entrega: { ...l40.entrega, marco: { ...l40.entrega.marco, referenciaDeclarada: null } } }, [F3]), "oficial-omitida-del-marco"), "un Marco sin la referencia oficial del conjunto en juego → oficial-omitida-del-marco");
      /* el error de evidencia se DECLARA, nunca se calla: sin el ranking de margen por SKU la pieza no puede contar el conjunto y lo dice, con la parte */
      const { referenciasDeLaConsulta } = await import("./src/adi/entrega/referencias.js");
      const I0 = l40.entrega.procedencia.libro.indice;
      const sinRk = { ...I0, rankings: { ...I0.rankings, sku: { ...I0.rankings.sku, margen_venta: undefined } } };
      const ctx0 = (I) => ({ resolucion: l40.resolucion, partesUtiles: l40.resolucion.partes.filter((p) => p.estado === "resuelta" || p.estado === "parcial"), I, scenario: null, consultaDeFrenado: null, basesDeUniverso: (u) => new Set([...(u && typeof u.base === "string" ? [u.base] : [])]), indiceDelTenant: () => ({ I }), dominioNombre: (t) => t, listaDeNombres: (xs) => xs.join(" y ") });
      let r0 = null; try { r0 = referenciasDeLaConsulta(ctx0(sinRk)); } catch (e) { r0 = { error: String(e && e.message) }; }
      ok(r0 && Array.isArray(r0.limites) && r0.limites.some((l) => /^Sobre la parte p2 \(comercial\), el universo declarado no se pudo evaluar$/.test(l.titulo)), "sin la evidencia del conjunto SKU, la pieza DECLARA que la parte p2 no se pudo evaluar (nunca lo calla)", JSON.stringify(r0 && (r0.limites || r0.error)).slice(0, 300));
    }
    /* cero miembros: se dice «ninguno» (la forma que ya usaba la ruta de estados), y las partes se nombran solo si son dos o más */
    const z43 = caso("v14:Z43");
    ok(z43.ok && z43.entrega.limites.some((l) => esDecl(l) && /: ninguno — calculado/.test(l.motivo)) && revisarEntrega(z43, [F3]).length === 0, "v14:Z43 (cero SKU con la referencia): la lista dice «ninguno»");
    const m44 = caso("v27:M44");
    ok(m44.ok && m44.entrega.limites.some((l) => /^Sobre las partes p1, p2 y p3 \(comercial y cobranza\), con la referencia planteada/.test(l.titulo)) && revisarEntrega(m44, [F3]).length === 0, "v27:M44 (tres partes sobre el mismo conjunto): UNA declaración que nombra las tres partes");
    /* la operativa: «frenado» sin umbral oficial va exacta en el Marco (41b); sin ella, rojo */
    const z11 = caso("v13:Z11");
    ok(z11.ok && revisarEntrega(z11, [F3]).length === 0, "v13:Z11 (umbral de venta frenada planteado en la consulta, sin oficial): el control no marca nada");
    if (z11.ok) ok(regla(revisarEntrega({ ...z11, entrega: { ...z11.entrega, marco: { ...z11.entrega.marco, referenciaDeclarada: null, definiciones: [] } } }, [F3]), "operativa-sin-declarar"), "la operativa sin su valor exacto en el Marco → operativa-sin-declarar");
    /* la evidencia de la parte: lecturasDe pide el conjunto de la casa de las PARTES (no solo el de las premisas) y no se lo atribuye a ninguna parte (no agrega cifras a lo servido) */
    const { lecturasDe } = await import("./src/adi/encargo/lecturasDe.js");
    const lec = l40.ok ? lecturasDe(l40.resolucion) : null;
    const callsSku = lec ? lec.plan.calls.filter((c) => JSON.stringify(c.args || {}).includes("sku")) : [];
    ok(callsSku.length > 0, "lecturasDe trae la evidencia del conjunto SKU de la parte p2 en el plan general");
  }
}

H("4d · carnadas de la F4 (el rótulo de cada cifra según su concepto): el control TIENE que ponerse en rojo");
{
  const F4 = familias.find((f) => f.id === "F4");
  const caso = (id) => { const c = catalogos.find((x) => x.id === id); return c ? entregaDe(base, c) : { ok: false }; };
  const regla = (vs, r) => vs.some((v) => v.regla === r);
  /* una Entrega con otro rótulo en las filas de Cifras / en una oración (se rompe UNA propiedad a la vez) */
  const conFilas = (e, f) => ({ ...e, entrega: { ...e.entrega, cifras: { ...e.entrega.cifras, filas: e.entrega.cifras.filas.map(f) } } });
  const conRespuesta = (e, f) => ({ ...e, entrega: { ...e.entrega, respuesta: e.entrega.respuesta.map(f) } });
  const rotula = (viejo, nuevo) => (fila) => (fila.valores && fila.valores["Métrica"] === viejo ? { ...fila, valores: { ...fila.valores, "Métrica": nuevo } } : fila);
  ok(!!F4, "el marco carga la familia F4 (el rótulo de cada cifra)");
  if (F4) {
    /* las bases verdes: la venta a crédito en cobranza (el rótulo cerrado de la F1), la comparación de cobranza, la de inventario y la tabla de señales */
    const q14 = caso("v24:Q14"), w31 = caso("v17:W31"), z23 = caso("v13:Z23"), z63 = caso("v13:Z63"), q18 = caso("v24:Q18");
    ok(q14.ok && revisarEntrega(q14, [F4]).length === 0 && q14.entrega.cifras.filas.some((f) => f.valores["Métrica"] === "Venta a crédito") && q14.entrega.respuesta.some((r) => /con \$[\d.]+M en venta a crédito\.$/.test(r.texto)), "v24:Q14 (la lente «ventas» en cobranza): la cifra se rotula «Venta a crédito» en la fila y en la oración, y el control no marca nada");
    /* §7.3·57(a): la base de «crecimiento» es la variación EN %: la oración de v24:Q18 ya no ordena con «Variación vs año anterior en $» (antes: «por crecimiento: Lider, con +$2.3M en variación vs año anterior en $»). El dinero acompaña como cifra de apoyo y conserva su rótulo del léxico («YoY» → «Variación vs año anterior en $») cuando el usuario lo pide */
    ok(q18.ok && revisarEntrega(q18, [F4]).length === 0 && q18.entrega.respuesta.some((r) => /^Prioridad del procedimiento, por crecimiento: Mercado Libre, con \+?25\.3% en variación vs año anterior\.$/.test(r.texto)), "v24:Q18 (crecimiento): la oración de prioridad se dice con la variación EN % («por crecimiento: Mercado Libre, con 25.3% en variación vs año anterior»), 57(a)");
    { const qd = entregaDe(base, { origen: "gate", id: "4g:variacion_usd", encargo: { version: "encargo/v1", partes: [{ id: "p1", tema: "comercial", cierre: "decision", conceptos: ["variacion_usd", "ventas"], entidades: [{ nombre: "Lider" }, { nombre: "Ripley" }, { nombre: "Hites" }] }], criterio: { lente: "crecimiento" } } });
      ok(qd.ok && revisarEntrega(qd, [F4]).length === 0 && qd.entrega.cifras.filas.some((f) => f.valores["Métrica"] === "Variación vs año anterior en $") && qd.entrega.respuesta.some((r) => /^Prioridad del procedimiento, por crecimiento: Lider, con 14\.9% en variación vs año anterior\.$/.test(r.texto)), "57(a): la variación EN $ pedida como concepto conserva su rótulo del léxico («Variación vs año anterior en $», «YoY» nunca) como cifra de apoyo en la tabla, y NO decide quién va primero (la oración usa el %)"); }
    ok(w31.ok && revisarEntrega(w31, [F4]).length === 0 && /en venta a crédito, Ripley/.test(w31.texto) && !/Venta \(flujo\)/.test(w31.texto), "v17:W31 (comparación de cobranza): «Venta a crédito», nunca «Venta (flujo)»");
    ok(z23.ok && revisarEntrega(z23, [F4]).length === 0 && !/Cobertura \(DOH\)|cobertura \(doh\)/i.test(z23.texto) && (z23.texto.match(/Días de inventario/g) || []).length >= 3, "v13:Z23 (comparación de inventario): «Días de inventario», la misma cifra no sale con dos rótulos");
    ok(z63.ok && revisarEntrega(z63, [F4]).length === 0 && z63.entrega.cifras.filas.some((f) => f.valores["Métrica"] === "vencido") && z63.entrega.cifras.filas.some((f) => f.valores["Métrica"] === "distancia al benchmark"), "v13:Z63 (la tabla de señales): conserva el rótulo de su señal («vencido», «distancia al benchmark»): el control no la marca");
    if (w31.ok) {
      ok(regla(revisarEntrega(conFilas(w31, rotula("Venta a crédito", "Venta (flujo)")), [F4]), "rotulo-fuera-del-lexico"), "una fila «Venta (flujo)» donde va «Venta a crédito» → rotulo-fuera-del-lexico");
      ok(regla(revisarEntrega(conFilas(w31, rotula("Venta a crédito", "Ventas")), [F4]), "rotulo-fuera-del-lexico"), "una fila «Ventas» → rotulo-fuera-del-lexico");
      const w29 = caso("v17:W29");
      ok(w29.ok && revisarEntrega(w29, [F4]).length === 0 && regla(revisarEntrega(conFilas(w29, rotula("Saldo vencido", "Saldo pendiente")), [F4]), "rotulo-no-corresponde-al-dato") && regla(revisarEntrega(conFilas(w29, rotula("Saldo vencido", "Saldo por vencer")), [F4]), "rotulo-no-corresponde-al-dato"), "el saldo vencido de Lider dicho «saldo pendiente» o «saldo por vencer» (el dato trae esa cifra bajo otra clave) → rotulo-no-corresponde-al-dato");
      ok(regla(revisarEntrega(conFilas(w31, rotula("Recuperado", "Cosa que el léxico no conoce")), [F4]), "fig-sin-clave-sin-declarar"), "una cifra con un rótulo sin clave en el léxico → fig-sin-clave-sin-declarar");
      ok(regla(revisarEntrega(conRespuesta(w31, (r) => ({ ...r, texto: r.texto.replace("en venta a crédito,", "en venta (flujo),") })), [F4]), "oracion-rotula-crudo"), "una oración que dice la cifra «en venta (flujo)» → oracion-rotula-crudo");
    }
    if (z23.ok) ok(regla(revisarEntrega(conRespuesta(z23, (r) => ({ ...r, texto: r.texto.replace("en días de inventario,", "en cobertura (doh),") })), [F4]), "oracion-rotula-crudo"), "una comparación que dice «cobertura (doh)» → oracion-rotula-crudo");
    if (q14.ok) ok(regla(revisarEntrega(conRespuesta(q14, (r) => ({ ...r, texto: r.texto.replace(/en venta a crédito\.$/, "en ventas.") })), [F4]), "oracion-rotula-crudo"), "una oración de prioridad que dice «en ventas» → oracion-rotula-crudo");
    /* la pieza: el rótulo de cada concepto es el suyo; una fig sin clave se DECLARA con el texto de las ausencias */
    const { rotuloDeLaCasa, rotuloEnOracion, rotuloDeDiferencia, filaDeCifra, declaracionDeFigSinClave } = await import("./src/adi/entrega/rotulos.js");
    const { textoFigSinClave, MOTIVO_FIG_SIN_CLAVE } = await import("./src/config/contract/ausencias.js");
    ok(rotuloDeLaCasa({ concepto: "Venta (flujo)" }).rotulo === "Venta a crédito" && rotuloDeLaCasa({ concepto: "Ventas" }).rotulo === "Venta" && rotuloDeLaCasa({ concepto: "Ventas" }).clave === "ventas" && rotuloDeLaCasa({ concepto: "Venta (flujo)" }).clave === "venta_credito", "la pieza: «Venta (flujo)» es la venta a crédito y «Ventas» es la venta; nunca el rótulo de uno para el otro");
    ok(rotuloDeLaCasa({ clave: "capital_inmovilizado" }).rotulo === "Capital inmovilizado" && rotuloDeLaCasa({ clave: "capital_frenado" }).rotulo === "Capital inmovilizado crítico" && rotuloDeLaCasa({ clave: "saldo_por_vencer" }).rotulo === "Saldo por vencer" && rotuloDeLaCasa({ clave: "saldo_pendiente" }).rotulo === "Saldo pendiente", "la pieza: capital inmovilizado ≠ capital inmovilizado crítico · saldo por vencer ≠ saldo pendiente");
    ok(rotuloEnOracion({ concepto: "Cobertura (DOH)" }) === "días de inventario" && rotuloEnOracion({ concepto: "Dias Vencido" }) === "días vencido" && rotuloDeDiferencia({ clave: "venta_credito" }) === "Diferencia · Venta a crédito", "la pieza: «Cobertura (DOH)» y «Dias Vencido» se dicen con el nombre del léxico, en la oración y en la diferencia");
    const sc = rotuloDeLaCasa({ label: "Lider · Una cifra que el léxico no conoce" });
    ok(sc.sinClave === true && sc.clave === null, "la pieza: una fig sin clave en el léxico se marca (`sinClave`), no se rotula con la clave de otra");
    const d = declaracionDeFigSinClave(["Lider", "Falabella"]);
    ok(d.titulo === textoFigSinClave(["Lider", "Falabella"]) && d.motivo === MOTIVO_FIG_SIN_CLAVE && /Lider y Falabella/.test(d.titulo), "la declaración de una fig sin clave sale de `config/contract/ausencias.js` (la pieza no escribe su texto)");
    const fila = filaDeCifra({ entidad: "Lider", tema: "cobranza", rotulo: "Saldo vencido", valor: "$4.6M", tipo: "medido", id: "e1", procedencia: "medido", origen: "medido" });
    ok(JSON.stringify(Object.keys(fila)) === JSON.stringify(["valores", "hechos", "procedencia", "origen"]) && JSON.stringify(Object.keys(fila.valores)) === JSON.stringify(["Entidad / grupo", "Tema", "Métrica", "Valor", "Tipo"]), "filaDeCifra: el único constructor de la fila de Cifras, con la forma de siempre");
  }
}

H("4e · carnadas de la F5 (toda oración servida pasó su verificador), de la fila repetida (F2), del margen por SKU (F2) y del tema de la fila (F4): el control TIENE que ponerse en rojo");
{
  const F5 = familias.find((f) => f.id === "F5"), F2 = familias.find((f) => f.id === "F2"), F4 = familias.find((f) => f.id === "F4");
  const caso = (id) => { const c = catalogos.find((x) => x.id === id); return c ? entregaDe(base, c) : { ok: false }; };
  const regla = (vs, r) => vs.some((v) => v.regla === r);
  ok(!!F5 && !!F2 && !!F4, "el marco carga las familias F5, F2 y F4");
  /* F5 · la base verde es v27:M31 (la causa: la oración de puesto «Easy, 7° de 13» chocaba con la regla 17 del verificador, que le atribuía el «13» a la dueña de una premisa) */
  const m31 = caso("v27:M31");
  ok(m31.ok && /Easy, 7° de 13 clientes con saldo pendiente/.test(m31.texto) && revisarEntrega(m31, [F5]).length === 0, "v27:M31 (la oración de puesto «7° de 13» con una premisa que cita el puesto 13): el verificador la acepta, el control no marca nada");
  if (m31.ok) {
    const iEasy = m31.entrega.respuesta.findIndex((r) => /^Easy, 7° de 13/.test(r.texto));
    const mut = (fn) => ({ ...m31, entrega: { ...m31.entrega, respuesta: m31.entrega.respuesta.map((r, i) => (i === iEasy ? fn(r) : r)) } });
    const ctxDe = (e) => ({ ...e, texto: e.texto.replace(m31.entrega.respuesta[iEasy].texto, e.entrega.respuesta[iEasy].texto) });
    /* una cifra de OTRO dueño pegada al nombre (la sustitución silenciosa que la regla 17 vigila) sigue en rojo: el verificador no se relajó */
    const otra = ctxDe(mut((r) => ({ ...r, texto: r.texto.replace("$2.0M pendientes", "$5.3M pendientes") })));
    ok(regla(revisarEntrega(otra, [F5]), "verificador-rechaza-lo-servido") && regla(revisarEntrega(otra, [F5]), "oracion-rechazada-servida"), "la cifra de otra cuenta ($5.3M, de Sodimac) pegada al nombre de Easy → verificador-rechaza-lo-servido y oracion-rechazada-servida");
    const sinHechos = ctxDe(mut((r) => ({ ...r, hechos: [] })));
    ok(regla(revisarEntrega(sinHechos, [F5]), "oracion-rechazada-servida"), "una oración servida sin los hechos que la sostienen → oracion-rechazada-servida");
    const sinLimite = { ...m31, entrega: { ...m31.entrega, verificacion: { ok: true, violaciones: [], retiradas: [{ regla: "oracion-hecho", hechos: [] }] } } };
    ok(regla(revisarEntrega(sinLimite, [F5]), "retirada-sin-limite"), "una oración retirada que no se declara en los límites → retirada-sin-limite");
    /* la pieza: una oración rechazada se RETIRA y se DECLARA (nunca sale) */
    const { servirConGarantia } = await import("./src/adi/entrega/componer.js");
    const mala = otra;
    const s = servirConGarantia({ texto: mala.texto, entrega: mala.entrega, libro: mala.entrega.procedencia.libro, ok: true, motivo: "" }, m31.resolucion);
    const vs = s.ok ? base.verificar.verificarEntrega({ texto: s.texto, entrega: s.entrega, resolucion: m31.resolucion, indice: s.entrega.procedencia.libro.indice }) : null;
    ok(s.ok && !s.texto.includes("Easy, 7° de 13") && !s.entrega.respuesta.some((r) => /^Easy, 7° de 13/.test(r.texto)) && vs && vs.violaciones.length === 0, "servirConGarantia: la oración que el verificador rechaza no sale en el texto ni en la Entrega, y lo que sale pasa el verificador", JSON.stringify(vs && vs.violaciones));
    ok(s.ok && s.entrega.verificacion && s.entrega.verificacion.ok === true && s.entrega.verificacion.retiradas.length === 1 && s.entrega.verificacion.retiradas[0].regla === "dueno-de-cifra-equivocado" && s.entrega.limites.some((l) => l._retiradaPorVerificador && /^Una oración sobre Easy no pasó la verificación y se retiró$/.test(l.titulo)) && /\*\*Una oración sobre Easy no pasó la verificación y se retiró\.\*\*/.test(s.texto), "servirConGarantia: la oración retirada se declara como límite (su texto sale de ausencias.js) y la Entrega dice qué regla la rechazó, sin llevar la oración");
    ok(revisarEntrega({ ...m31, texto: s.texto, entrega: s.entrega }, [F5]).length === 0, "la Entrega que la pieza sirve tras retirar la oración no tiene violaciones del control F5");
  }
  /* F2 · una cifra se escribe una vez */
  const f40 = caso("v13:Z64");
  if (f40.ok) {
    const filas = f40.entrega.cifras.filas;
    ok(revisarEntrega(f40, [F2]).length === 0 && filas.filter((f) => f.valores["Entidad / grupo"] === "Falabella" && f.valores["Métrica"] === "Venta").length === 1, "v13:Z64 (la medida de la lente que la tabla ya traía): Falabella · Venta sale UNA vez");
    const dup = { ...f40, entrega: { ...f40.entrega, cifras: { ...f40.entrega.cifras, filas: [...filas, { ...filas[1], hechos: ["e999"] }] } } };
    ok(regla(revisarEntrega(dup, [F2]), "fila-duplicada"), "la misma fila (entidad, rótulo y valor) dos veces → fila-duplicada");
    const { unaFilaPorCifra } = await import("./src/adi/entrega/rotulos.js");
    const u = unaFilaPorCifra([...filas, { ...filas[1], hechos: ["e999"] }]);
    ok(u.length === filas.length && u[1].hechos.includes("e999") && u[1].hechos.length === 2, "la pieza: la fila repetida se funde en la primera, que cita los hechos de las dos (la doble colocación de cada oración se sigue cumpliendo)");
  } else ok(false, "existe v13:Z64 en los catálogos");
  /* F2 · el margen por SKU se verifica como cifra de una entidad (la causa del «sin dato» falso) */
  const y03 = caso("v19:Y03");
  if (y03.ok) {
    const I = y03.entrega.procedencia.libro.indice;
    const { libroDeHechos } = await import("./src/adi/notario/hechos.js");
    const H = libroDeHechos([{ id: "z1", tipo: "cifra", sujeto: "MAK-SAW18V", metrica: "margen", valor: "34%" }, { id: "z2", tipo: "cifra", sujeto: "MAK-SAW18V", metrica: "margen", valor: "20%" }], { indice: I }).hechos;
    ok(H[0].ok && H[0].veredicto === "verdadera" && !(H[1].ok && H[1].veredicto === "verdadera"), "el Notario verifica el margen de un SKU como cifra de una entidad (34% sí, 20% no)");
  } else ok(false, "existe v19:Y03 en los catálogos");
  /* F4 · el tema de la fila es el del dominio de su cifra */
  const q14 = caso("v24:Q14");
  if (q14.ok) {
    ok(revisarEntrega(q14, [F4]).length === 0 && q14.entrega.cifras.filas.every((f) => f.valores["Métrica"] !== "Venta a crédito" || f.valores.Tema === "cobranza"), "v24:Q14: «Venta a crédito» lleva el tema «cobranza» (el de su cifra), no el de la parte o la lente que la pidió");
    const mal = { ...q14, entrega: { ...q14.entrega, cifras: { ...q14.entrega.cifras, filas: q14.entrega.cifras.filas.map((f) => (f.valores["Métrica"] === "Venta a crédito" ? { ...f, valores: { ...f.valores, Tema: "comercial" } } : f)) } } };
    ok(regla(revisarEntrega(mal, [F4]), "tema-mal-asociado"), "«Falabella · comercial · Venta a crédito» (la venta a crédito es de cobranza) → tema-mal-asociado");
    const { temaDeLaFila } = await import("./src/adi/entrega/rotulos.js");
    ok(temaDeLaFila("Venta a crédito", "comercial") === "cobranza" && temaDeLaFila("Diferencia · Venta", "cobranza") === "comercial" && temaDeLaFila("vencido", "cobranza") === "cobranza" && temaDeLaFila("Cosa del productor", "inventario") === "inventario", "la pieza: el tema de una fila es el del dominio de su cifra; un rótulo que no es un concepto del léxico (una señal) conserva el de quien la pide");
  } else ok(false, "existe v24:Q14 en los catálogos");
}

H("4f · carnadas de la segunda vuelta (el EJE y la FOTO): una lectura o decision con eje X sirve entidades del eje X · un «sin dato» nunca acompaña a una cifra que el dato publica");
{
  const F1 = familias.find((f) => f.id === "F1"), F2 = familias.find((f) => f.id === "F2");
  const regla = (vs, r) => vs.some((v) => v.regla === r);
  const v = (parte) => ({ version: "encargo/v1", ...parte });
  /* LOS CASOS DE LAS MEDICIONES CIEGAS v29 y v30 (los que fallaron; el generador no producía el eje bodega, así que los controles no los probaban) */
  const CASOS = {
    "J16 (lectura por bodega, días de inventario y unidades en stock)": v({ partes: [{ id: "p1", tema: "inventario", cierre: "lectura", conceptos: ["dias_inventario", "unidades_stock"], eje: "bodega" }], premisas: [{ id: "q1", tipo: "orden", sujeto: "Antofagasta", metrica: "dias_inventario", orden: { forma: "max" }, universo: { eje: "bodega" } }, { id: "q2", tipo: "cifra", sujeto: "Santiago", metrica: "unidades_stock", valor: "310" }] }),
    "J17 (decision por bodega con la lente riesgo)": v({ partes: [{ id: "p1", tema: "inventario", cierre: "decision", conceptos: ["unidades_stock", "dias_inventario"], eje: "bodega" }], criterio: { lente: "riesgo" }, premisas: [{ id: "q1", tipo: "relacion", sujeto: "Santiago", metrica: "rotacion", relacion: { forma: "mayor", vs: { sujeto: "Valparaíso" } } }, { id: "q2", tipo: "cifra", sujeto: "Concepción", metrica: "dias_inventario", valor: "58.5 días" }] }),
    "J18 (decision por bodega con la lente crecimiento)": v({ partes: [{ id: "p1", tema: "inventario", cierre: "decision", conceptos: ["capital", "unidades_stock"], eje: "bodega" }], criterio: { lente: "crecimiento" }, premisas: [{ id: "q1", tipo: "cifra", sujeto: "Valparaíso", metrica: "capital", valor: "$39.0K" }, { id: "q2", tipo: "orden", sujeto: "Antofagasta", metrica: "unidades_stock", orden: { forma: "min" }, universo: { eje: "bodega" } }] }),
    "J35 (decision con dos bodegas nombradas)": v({ partes: [{ id: "p1", tema: "inventario", cierre: "decision", conceptos: ["rotacion", "capital"], eje: "bodega", entidades: [{ nombre: "Santiago", eje: "bodega" }, { nombre: "Concepción", eje: "bodega" }] }], criterio: { lente: "riesgo" }, premisas: [{ id: "q1", tipo: "relacion", sujeto: "Santiago", metrica: "capital", relacion: { forma: "mayor", vs: { sujeto: "Concepción" } } }, { id: "q2", tipo: "cifra", sujeto: "Concepción", metrica: "rotacion", valor: "5.3x" }] }),
    "J50 (tres lecturas: comercial por cuenta, inventario por bodega, cobranza)": v({ partes: [{ id: "p1", tema: "comercial", cierre: "lectura", conceptos: ["margen", "ventas"] }, { id: "p2", tema: "inventario", cierre: "lectura", conceptos: ["capital", "rotacion"], eje: "bodega" }, { id: "p3", tema: "cobranza", cierre: "lectura", conceptos: ["abonado", "dias_vencido"] }], premisas: [{ id: "q1", tipo: "cifra", sujeto: "Valparaíso", metrica: "capital", valor: "$39.0K" }, { id: "q2", tipo: "cifra", sujeto: "Jumbo", metrica: "abonado", valor: "$12.2M" }] }),
    "K16 (lectura por bodega, rotación y capital)": v({ partes: [{ id: "p1", tema: "inventario", cierre: "lectura", conceptos: ["rotacion", "capital"], eje: "bodega" }], premisas: [{ id: "q1", tipo: "relacion", sujeto: "Antofagasta", metrica: "rotacion", relacion: { forma: "menor", vs: { sujeto: "Santiago" } } }, { id: "q2", tipo: "cifra", sujeto: "Santiago", metrica: "capital", valor: "$63.8K" }] }),
    "K17 (decision por bodega con la lente exposición de crédito)": v({ partes: [{ id: "p1", tema: "inventario", cierre: "decision", conceptos: ["capital", "rotacion"], eje: "bodega" }], criterio: { lente: "credito" }, premisas: [{ id: "q1", tipo: "relacion", sujeto: "Valparaíso", metrica: "capital", relacion: { forma: "mayor", vs: { sujeto: "Concepción" } } }, { id: "q2", tipo: "orden", sujeto: "Santiago", metrica: "rotacion", orden: { forma: "max" }, universo: { eje: "bodega" } }] }),
    "K18 (decision por bodega sin criterio del usuario)": v({ partes: [{ id: "p1", tema: "inventario", cierre: "decision", conceptos: ["dias_inventario", "unidades_stock"], eje: "bodega" }], premisas: [{ id: "q1", tipo: "cifra", sujeto: "Antofagasta", metrica: "dias_inventario", valor: "111.5 días" }, { id: "q2", tipo: "relacion", sujeto: "Santiago", metrica: "unidades_stock", relacion: { forma: "mayor", vs: { sujeto: "Valparaíso" } } }] }),
  };
  const E = {};
  for (const [id, enc] of Object.entries(CASOS)) {
    E[id.slice(0, 3)] = entregaDe(base, { origen: "gate", id, encargo: enc });
    const e = E[id.slice(0, 3)];
    ok(e.ok && revisarEntrega(e, familias).filter((x) => !x.abierta).length === 0, `${id}: la Entrega no tiene violaciones firmes de F1–F6`, e.ok ? revisarEntrega(e, familias).filter((x) => !x.abierta).slice(0, 3).map((x) => `${x.familia}:${x.regla} ${x.detalle}`).join(" | ") : (e.motivo || e.excepcion));
  }
  const bodegas = ["Santiago", "Valparaíso", "Concepción", "Antofagasta"];
  const sirveLasBodegas = (e, parteId) => { const u = (e.entrega.universos || []).find((x) => x.id === parteId); return !!u && bodegas.every((b) => (u.entidades || []).includes(b)) && (u.entidades || []).length === 4; };
  const fila = (e, ent, metrica) => (e.entrega.cifras.filas || []).concat((e.entrega.detalle && e.entrega.detalle.filas) || []).some((f) => f.valores["Entidad / grupo"] === ent && f.valores["Métrica"] === metrica);
  ok(sirveLasBodegas(E.J16, "p1") && bodegas.every((b) => fila(E.J16, b, "Días de inventario") && fila(E.J16, b, "Unidades en stock")), "J16: sirve las cuatro bodegas (no un SKU) con la fila de días de inventario y de unidades en stock de cada una");
  ok(!/LG-DRYER8KG|BOS-SANDER|quien más pesa/i.test(E.J16.texto) && !/sin dato de/.test(E.J16.texto), "J16: ningún SKU en la lectura por bodega y ningún «sin dato» sobre cifras que el dato publica");
  ok(sirveLasBodegas(E.J17, "p1") && !/LG-DRYER8KG|por riesgo integrado: /.test(E.J17.texto), "J17: la decision por bodega con la lente riesgo sirve las cuatro bodegas y no corona a un SKU «por riesgo integrado»");
  ok(sirveLasBodegas(E.J18, "p1") && bodegas.every((b) => fila(E.J18, b, "Capital") && fila(E.J18, b, "Unidades en stock")), "J18: las cuatro bodegas con su capital y sus unidades en stock");
  ok(["Santiago", "Concepción"].every((b) => fila(E.J35, b, "Rotación") && fila(E.J35, b, "Capital")) && !/sin dato de rotaci/.test(E.J35.texto), "J35: las dos bodegas nombradas tienen su fila de rotación y de capital (el dato las publica)");
  ok(sirveLasBodegas(E.K16, "p1") && bodegas.every((b) => fila(E.K16, b, "Rotación")) && !/sin dato de rotaci/.test(E.K16.texto), "K16: las cuatro bodegas con su rotación (antes: «sin dato de rotación» para bodegas que la tienen)");
  ok(sirveLasBodegas(E.K17, "p1") && sirveLasBodegas(E.K18, "p1") && !/LG-DRYER8KG/.test(E.K17.texto + E.K18.texto), "K17 y K18: las cuatro bodegas, ningún SKU");
  { const u1 = E.J50.entrega.universos.find((u) => u.id === "p1"); ok(!!u1 && u1.entidades.length === 13 && sirveLasBodegas(E.J50, "p2") && fila(E.J50, "Falabella", "Margen") && fila(E.J50, "Falabella", "Venta"), "J50: la parte comercial por cuenta sirve las 13 cuentas con margen y venta (antes: el eje bodega de otra parte le quitaba su lectura) y la de inventario las cuatro bodegas"); }

  /* LAS CARNADAS: sobre la Entrega verde se rompe UNA propiedad y el control tiene que ponerse en rojo con la regla que corresponde */
  const conUniversos = (e, f) => ({ ...e, entrega: { ...e.entrega, universos: e.entrega.universos.map(f) } });
  const sinUniverso = (e, id) => ({ ...e, entrega: { ...e.entrega, universos: e.entrega.universos.filter((u) => u.id !== id) } });
  ok(regla(revisarEntrega(conUniversos(E.J16, (u) => (u.id === "p1" ? { ...u, entidades: ["LG-DRYER8KG", "BOS-SANDER", "PHI-IRON-PRO"] } : u)), [F2]), "eje-servido"), "una bodega servida como SKU (el universo de la parte por bodega trae SKU) → eje-servido");
  ok(regla(revisarEntrega(conUniversos(E.J50, (u) => (u.id === "p1_p3_prioridad" ? { ...u, entidades: [...(u.entidades || []), "LG-DRYER8KG"] } : u)), [F2]), "eje-servido") || regla(revisarEntrega({ ...E.J50, entrega: { ...E.J50.entrega, universos: [...E.J50.entrega.universos, { id: "p1_p2_p3_prioridad", top: null, entidades: ["LG-DRYER8KG"] }] } }, [F2]), "eje-servido"), "la prioridad de tres dominios que nombra a un SKU cuando ninguna parte es de SKU → eje-servido");
  ok(regla(revisarEntrega(sinUniverso(E.J16, "p1"), [F2]), "foto-sin-servir"), "una lectura por bodega sin universo ni entidades cuya foto no se sirve → foto-sin-servir");
  ok(regla(revisarEntrega(sinUniverso(E.J50, "p1"), [F2]), "foto-sin-servir"), "la parte comercial por cuenta de una lectura de tres dominios sin su foto (el caso de J50) → foto-sin-servir");
  ok(regla(revisarEntrega(conUniversos(E.J16, (u) => (u.id === "p1" ? { ...u, entidades: u.entidades.slice(0, 3) } : u)), [F2]), "foto-incompleta"), "la foto de inventario por bodega con tres de las cuatro bodegas → foto-incompleta");
  { const sd = { titulo: "Sobre la parte p1 (inventario), sin dato de rotación para Santiago y Valparaíso", motivo: "La lectura de este turno no publicó esa cifra para esas cuentas; no se rellena con otra." };
    ok(regla(revisarEntrega({ ...E.K16, entrega: { ...E.K16.entrega, limites: [...E.K16.entrega.limites, sd] } }, [F2]), "sin-dato-con-dato-publicado"), "«sin dato de rotación para Santiago y Valparaíso» cuando el dato publica la rotación de cada bodega → sin-dato-con-dato-publicado");
    const ft = { titulo: "Sobre la parte p1 (inventario), la foto no trae unidades en stock de Antofagasta (1 de 4 bodegas)", motivo: "x" };
    ok(regla(revisarEntrega({ ...E.J16, entrega: { ...E.J16.entrega, limites: [...E.J16.entrega.limites, ft] } }, [F2]), "sin-dato-con-dato-publicado"), "«la foto no trae unidades en stock de Antofagasta» cuando el dato publica sus 39 unidades → sin-dato-con-dato-publicado"); }
  { const sinFila = { ...E.K16, entrega: { ...E.K16.entrega, cifras: { ...E.K16.entrega.cifras, filas: E.K16.entrega.cifras.filas.filter((f) => !(f.valores["Entidad / grupo"] === "Santiago" && f.valores["Métrica"] === "Rotación")) } } };
    ok(regla(revisarEntrega(sinFila, [F2]), "servida-sin-fila"), "quitar la fila de rotación de una bodega servida (el dato la publica) → servida-sin-fila"); }
  { const i = E.J18.entrega.respuesta.findIndex((r) => /^Prioridad del procedimiento dentro de este grupo, por /.test(r.texto));
    ok(i >= 0, "J18: la decision por bodega trae una oración de prioridad de su grupo");
    if (i >= 0) {
      const ent = { ...E.J18.entrega, respuesta: E.J18.entrega.respuesta.map((r, k) => (k === i ? { ...r, texto: r.texto.replace(/: Santiago, con/, ": LG-DRYER8KG, con"), _prioridad: { alcance: "grupo", primero: "LG-DRYER8KG" } } : r)) };
      ok(regla(revisarEntrega({ ...E.J18, entrega: ent }, [F1]), "primero-fuera-del-eje"), "la prioridad de un grupo de bodegas que corona a un SKU (el «por riesgo integrado: LG-DRYER8KG» de J17) → primero-fuera-del-eje");
    } }
  /* 51(a): la foto se ordena por el PRIMER concepto pedido que el dato publica (v30·J15: pidió rotación y capital y salió «ordenado por Capital») */
  { const e15 = entregaDe(base, { origen: "gate", id: "J15", encargo: v({ partes: [{ id: "p1", tema: "inventario", cierre: "decision", conceptos: ["rotacion", "capital"], eje: "sku" }] }) });
    const i = e15.ok ? e15.entrega.respuesta.findIndex((r) => /^Por sku, ordenado por Rotación: /.test(r.texto)) : -1;
    ok(e15.ok && i >= 0 && revisarEntrega(e15, [F2]).length === 0, "una decision de inventario por SKU que pide rotación y capital se ordena «por Rotación» (el primero pedido) y el control no marca nada");
    if (i >= 0) ok(regla(revisarEntrega({ ...e15, entrega: { ...e15.entrega, respuesta: e15.entrega.respuesta.map((r, k) => (k === i ? { ...r, texto: r.texto.replace("ordenado por Rotación", "ordenado por Capital") } : r)) } }, [F2]), "foto-ordenada-por-otro-concepto"), "la foto que dice «ordenado por Capital» cuando el primer concepto pedido es la rotación → foto-ordenada-por-otro-concepto"); }
  /* la pieza: el eje es de cada parte */
  { const { pasosDeDominios } = await import("./src/adi/agente/contratoDeDominios.js");
    const mismo = [["comercial", "inventario", "cobranza"], ["comercial", "inventario"], ["inventario"], ["comercial"], ["inventario", "cobranza"]].every((ds) => [null, "bodega", "marca", "familia", "canal", "sku", "cliente"].every((eje) => JSON.stringify(pasosDeDominios({ dominios: ds, eje })) === JSON.stringify(pasosDeDominios({ dominios: ds, eje, ejesPorDominio: Object.fromEntries(ds.map((d) => [d, [eje]])) }))));
    ok(mismo, "pasosDeDominios: con el mismo eje en cada dominio, `ejesPorDominio` da exactamente lo de siempre (la boleta del agente, que pasa un solo `eje`, no cambia)");
    const sinComercial = pasosDeDominios({ dominios: ["comercial", "inventario", "cobranza"], eje: "bodega" }), conComercial = pasosDeDominios({ dominios: ["comercial", "inventario", "cobranza"], eje: "bodega", ejesPorDominio: { comercial: [null], inventario: ["bodega"], cobranza: [null] } });
    ok(!sinComercial.some((p) => p.tool === "salesRead") && conComercial.some((p) => p.tool === "salesRead"), "pasosDeDominios: con `ejesPorDominio`, la parte comercial por cuenta conserva su paquete aunque otra parte sea por bodega (con un solo `eje: bodega` lo perdía)");
    const { lecturasDe } = await import("./src/adi/encargo/lecturasDe.js");
    const l16 = lecturasDe(E.J16.resolucion).plan.calls.map((c) => `${c.tool}:${c.args.metric || ""}:${c.args.dimension || ""}`);
    ok(["queryMetric:doh:bodega", "queryMetric:stock:bodega"].every((k) => l16.includes(k)), "lecturasDe: una parte con eje explícito lee SUS conceptos por SU eje (días de inventario y unidades en stock por bodega)", l16.join(" "));
    const l50 = lecturasDe(E.J50.resolucion).plan.calls.map((c) => c.tool);
    ok(l50.includes("salesRead") && l50.includes("cobranza") && l50.includes("inventoryStatus"), "lecturasDe: la lectura de tres dominios trae el paquete de cada uno aunque una parte sea por bodega"); }
}

H("4g · carnadas de la PARTE B (segunda vuelta): el rótulo en la premisa (R1) · un extremo sobre un ranking incompleto (R2) · la foto de cobranza en el orden de la mesa (52c) · el cero del empate en palabras (39c·46f) · «sin dato de X para Y» (52b)");
{
  const F6 = familias.find((f) => f.id === "F6"), F2 = familias.find((f) => f.id === "F2");
  const regla = (vs, r) => vs.some((v) => v.regla === r);
  const v = (parte) => ({ version: "encargo/v1", ...parte });
  const comp = (id, enc) => entregaDe(base, { origen: "gate", id, encargo: enc });
  const conRespuesta = (e, f) => ({ ...e, entrega: { ...e.entrega, respuesta: e.entrega.respuesta.map(f) } });
  const conTexto = (e, f) => ({ ...e, texto: f(e.texto), entrega: { ...e.entrega, respuesta: e.entrega.respuesta.map((r) => ({ ...r, texto: f(r.texto) })) } });
  const PREM = "Sobre la premisa planteada en la consulta";
  ok(!!F6, "el marco carga la familia F6 (la frase de una premisa)");
  if (F6) {
    /* R1 · el rótulo en la premisa: «Samsung: margen 24.2%» (con su rótulo) es la base; sin rótulo o con el de otro concepto, rojo */
    const r1 = comp("R1", v({ partes: [{ id: "p1", tema: "comercial", cierre: "lectura", conceptos: ["margen"], eje: "marca" }], premisas: [{ id: "q1", tipo: "cifra", sujeto: "Samsung", metrica: "margen", valor: "24.2%" }] }));
    const iq1 = r1.ok ? r1.entrega.respuesta.findIndex((r) => r._premisa && r.hechos[0] === "q1") : -1;
    ok(r1.ok && iq1 >= 0 && /es correcto — Samsung: margen 24\.2%\.$/.test(r1.entrega.respuesta[iq1].texto) && revisarEntrega(r1, [F6]).length === 0, "R1 · base: «Samsung: margen 24.2%» lleva el rótulo de su concepto y el control no marca nada");
    if (iq1 >= 0) {
      const con = (txt) => conRespuesta(r1, (r, k) => (k === iq1 ? { ...r, texto: `${PREM}: es correcto — ${txt}.` } : r));
      ok(regla(revisarEntrega(con("Samsung (24.2%)"), [F6]), "premisa-cifra-sin-rotulo"), "la cifra de la premisa impresa sin rótulo («Samsung (24.2%)») → premisa-cifra-sin-rotulo");
      ok(regla(revisarEntrega(con("Samsung: margen de inventario 24.2%"), [F6]), "premisa-rotulo-de-otro-concepto"), "la cifra del margen rotulada «margen de inventario» (el rótulo de otro concepto) → premisa-rotulo-de-otro-concepto");
      ok(revisarEntrega(con("Samsung: margen 24.2%"), [F6]).length === 0, "la misma frase con el rótulo propio no marca nada");
    }
    /* R1 · la lista de un orden: «MAK-SAW18V (34%) · PHI-HAIR-PRO (30%)…» sin decir que es el margen (el margen y el margen de inventario coinciden en 34) */
    const r1b = comp("R1b", v({ partes: [{ id: "p1", tema: "comercial", cierre: "lectura", conceptos: ["margen"], eje: "sku" }], premisas: [{ id: "q1", tipo: "orden", sujeto: "MAK-SAW18V", metrica: "margen", orden: { forma: "max" }, universo: { eje: "sku" } }] }));
    const ib = r1b.ok ? r1b.entrega.respuesta.findIndex((r) => r._premisa && r.hechos[0] === "q1") : -1;
    if (ib >= 0) {
      ok(regla(revisarEntrega(conRespuesta(r1b, (r, k) => (k === ib ? { ...r, texto: `${PREM}: es correcto — MAK-SAW18V (34%) · PHI-HAIR-PRO (30%) · SAM-MICRO32L (28%).` } : r)), [F6]), "premisa-cifra-sin-rotulo"), "J21 · «MAK-SAW18V (34%) · PHI-HAIR-PRO (30%)…» sin rótulo (el 34 es del margen y del margen de inventario) → premisa-cifra-sin-rotulo");
      ok(revisarEntrega(conRespuesta(r1b, (r, k) => (k === ib ? { ...r, texto: `${PREM}: es correcto — margen: MAK-SAW18V (34%) · PHI-HAIR-PRO (30%) · SAM-MICRO32L (28%).` } : r)), [F6]).length === 0, "la misma lista con el rótulo del margen («margen: MAK-SAW18V (34%) · …») no marca nada");
    } else ok(false, "J21 · la premisa de orden sobre el margen de los SKU se compone");
    /* R2 · un extremo sobre un ranking con miembros sin dato: la variación de Makita no está publicada (no hay año anterior) */
    const r2 = comp("R2", v({ partes: [{ id: "p1", tema: "comercial", cierre: "lectura", conceptos: ["margen"], eje: "marca" }], premisas: [{ id: "q1", tipo: "orden", sujeto: "LG", metrica: "variacion", orden: { forma: "max" }, universo: { eje: "marca" } }, { id: "q2", tipo: "orden", sujeto: "Bosch", metrica: "margen", orden: { forma: "min" }, universo: { eje: "marca" } }] }));
    const i2 = r2.ok ? r2.entrega.respuesta.findIndex((r) => r._premisa && r.hechos[0] === "q1") : -1;
    ok(r2.ok && i2 >= 0, "R2 · la premisa «LG tiene la mayor variación» (marca) se compone");
    if (i2 >= 0) {
      const con = (txt) => conRespuesta(r2, (r, k) => (k === i2 ? { ...r, texto: txt } : r));
      ok(regla(revisarEntrega(con(`${PREM}: es correcto — variación vs año anterior: LG (+15.6%) · Philips (+7.1%) · Samsung (+4.1%).`), [F6]), "extremo-sobre-ranking-incompleto"), "K57 · «LG tiene la mayor variación» juzgada verdadera cuando Makita no tiene variación → extremo-sobre-ranking-incompleto");
      ok(regla(revisarEntrega(con(`${PREM}: no es así — LG va 2.º de 4 en variación vs año anterior.`), [F6]), "extremo-sobre-ranking-incompleto"), "ni verdadera ni falsa: «LG va 2.º de 4» sobre un ranking incompleto → extremo-sobre-ranking-incompleto");
      ok(regla(revisarEntrega(con(`${PREM}, no se pudo verificar con este dato: ranking-parcial: el ranking de «Variación vs año anterior» solo trae a 4 del eje.`), [F6]), "ausente-sin-nombrar"), "no verificable pero sin decir quién no tiene dato → ausente-sin-nombrar");
      ok(revisarEntrega(con(`${PREM}, no se pudo verificar con este dato: sin dato de variación vs año anterior para Makita.`), [F6]).filter((x) => x.regla !== "premisa-cifra-sin-rotulo").length === 0, "no verificable con «sin dato de variación vs año anterior para Makita» → el control no marca nada");
    }
    /* R2 · un ranking COMPLETO se afirma como siempre (el margen de las cinco marcas) */
    { const r2c = comp("R2c", v({ partes: [{ id: "p1", tema: "comercial", cierre: "lectura", conceptos: ["margen"], eje: "marca" }], premisas: [{ id: "q2", tipo: "orden", sujeto: "Bosch", metrica: "margen", orden: { forma: "min" }, universo: { eje: "marca" } }] }));
      const j = r2c.ok ? r2c.entrega.respuesta.findIndex((r) => r._premisa && r.hechos[0] === "q2") : -1;
      ok(j >= 0 && !revisarEntrega(conRespuesta(r2c, (r, k) => (k === j ? { ...r, texto: `${PREM}: no es así — margen: Bosch (26%).` } : r)), [F6]).some((x) => x.regla === "extremo-sobre-ranking-incompleto"), "el margen de las cinco marcas es un ranking completo: juzgar un extremo sobre él no marca nada"); }
  }
  if (F2) {
    /* (a) la foto de cobranza, en el orden de la mesa (52c, owner) */
    const f12 = comp("J12b", v({ partes: [{ id: "p1", tema: "cobranza", cierre: "lectura", conceptos: ["abonado", "venta_credito"] }] }));
    const uid = f12.ok ? f12.entrega.universos.findIndex((u) => u.id === "p1" && !u.soloRanking) : -1;
    const mesa = base.ordenDeLaMesa();
    ok(mesa.length >= 8 && mesa[0] === "Lider", `la mesa de flujo da el orden de la foto de cobranza (${mesa.slice(0, 4).join(", ")}…)`);
    if (uid >= 0) {
      const serv = f12.entrega.universos[uid].entidades;
      const enMesa = mesa.filter((n) => serv.includes(n)), alReves = [...enMesa].reverse();
      const con = (lista) => ({ ...f12, entrega: { ...f12.entrega, universos: f12.entrega.universos.map((u, k) => (k === uid ? { ...u, entidades: lista } : u)) } });
      ok(regla(revisarEntrega(con(alReves), [F2]), "foto-cobranza-fuera-del-orden-de-la-mesa"), "J12 · la foto de cobranza servida en otro orden que el de la mesa (Jumbo, Falabella, Lider…) → foto-cobranza-fuera-del-orden-de-la-mesa");
      ok(!regla(revisarEntrega(con(enMesa), [F2]), "foto-cobranza-fuera-del-orden-de-la-mesa"), "la misma foto en el orden de la mesa (Lider, Falabella, Sodimac…) no marca nada");
    } else ok(false, "J12 · la lectura de cobranza sin universo sirve su foto");
    /* (b) el cero del empate del filo, en palabras (39c · 46f) */
    const e04 = comp("J04b", v({ partes: [{ id: "p1", tema: "inventario", cierre: "cifra", conceptos: ["dias_sin_venta", "rotacion"], eje: "sku", universo: { eje: "sku", top: { metrica: "dias_sin_venta", k: 3, direccion: "menor" } } }] }));
    const iE = e04.ok ? e04.entrega.respuesta.findIndex((r) => /por el empate del filo/.test(r.texto)) : -1;
    ok(iE >= 0, "J04 · el top 3 de días sin venta cae en un empate en cero y sirve a todos los empatados");
    if (iE >= 0) {
      const sin = (t) => t.replace(/; no tienen? [^()]+\([^)]*\)(?=\))/, "");
      const con = (t) => sin(t).replace(/(empatan en el puesto \d+)\)/, "$1; no tienen días sin venta (0 días))");
      ok(regla(revisarEntrega(conTexto(e04, sin), [F2]), "empate-del-filo-en-cero-sin-palabras"), "J04 · el empate del filo en «(0 días)» sin decir el cero en palabras → empate-del-filo-en-cero-sin-palabras");
      ok(!regla(revisarEntrega(conTexto(e04, con), [F2]), "empate-del-filo-en-cero-sin-palabras"), "«…empatan en el puesto 1; no tienen días sin venta (0 días)» no marca nada");
    }
    /* (c) la ausencia, en la forma «sin dato de X para Y» (52b) */
    const e19 = comp("J19b", v({ partes: [{ id: "p1", tema: "comercial", cierre: "lectura", conceptos: ["variacion", "costo"], eje: "marca" }] }));
    ok(e19.ok, "J19 · la lectura por marca con la variación y el costo se compone");
    if (e19.ok) {
      const conLimite = (titulo) => ({ ...e19, entrega: { ...e19.entrega, limites: [...e19.entrega.limites.filter((l) => !/Makita/.test(String(l.titulo || ""))), { titulo, motivo: "La lectura de este turno no publicó esa cifra para esas cuentas; no se rellena con otra." }] } });
      ok(regla(revisarEntrega(conLimite("Sobre la parte p1 (comercial), la foto no trae variación vs año anterior de Makita (1 de 5 marcas)"), [F2]), "ausencia-sin-la-forma-sin-dato"), "J19 · «la foto no trae variación vs año anterior de Makita» (otras palabras) → ausencia-sin-la-forma-sin-dato");
      ok(!regla(revisarEntrega(conLimite("Sobre la parte p1 (comercial), sin dato de variación vs año anterior para Makita (1 de 5 marcas)"), [F2]), "ausencia-sin-la-forma-sin-dato"), "«sin dato de variación vs año anterior para Makita» (la forma de la 52b) no marca nada");
    }
    /* el texto de la ausencia es el de `config/contract/ausencias.js` */
    const { textoSinDato } = await import("./src/config/contract/ausencias.js");
    ok(textoSinDato("Variación vs año anterior", ["Makita"]) === "sin dato de variación vs año anterior para Makita", "la forma «sin dato de X para Y» sale de `config/contract/ausencias.js:textoSinDato`");
  }
}

H("4h · la PIEZA cumple las seis reglas de la parte B (las Entregas reales, sin mutar): R1 · R2 · la foto de cobranza en el orden de la mesa · el cero del empate · «sin dato de X para Y»");
{
  const v = (parte) => ({ version: "encargo/v1", ...parte });
  const real = (id, enc) => entregaDe(base, { origen: "gate", id, encargo: enc });
  const limpio = (e) => e.ok && revisarEntrega(e, familias).length === 0;
  const J21 = real("B21", v({ partes: [{ id: "p1", tema: "comercial", cierre: "lectura", conceptos: ["margen"], eje: "sku" }], premisas: [{ id: "q1", tipo: "orden", sujeto: "MAK-SAW18V", metrica: "margen", orden: { forma: "max" }, universo: { eje: "sku" } }] }));
  ok(limpio(J21) && /es correcto — margen: MAK-SAW18V \(34%\) · PHI-HAIR-PRO \(30%\)/.test(J21.texto), "R1 · J21: la lista de la premisa de orden dice «margen: MAK-SAW18V (34%) · …» (el rótulo de su concepto)");
  const K57 = real("B57", v({ partes: [{ id: "p1", tema: "comercial", cierre: "lectura", conceptos: ["margen"], eje: "marca" }], premisas: [{ id: "q1", tipo: "orden", sujeto: "LG", metrica: "variacion", orden: { forma: "max" }, universo: { eje: "marca" } }] }));
  ok(limpio(K57) && /no se pudo verificar con este dato: ranking-parcial: sin dato de variación vs año anterior para Makita/.test(K57.texto) && !/es correcto — .*LG \(\+15\.6%\)/.test(K57.texto), "R2 · K57: «LG tiene la mayor variación» es no verificable y dice «sin dato de variación vs año anterior para Makita» (antes: verdadera)");
  const J12 = real("B12", v({ partes: [{ id: "p1", tema: "cobranza", cierre: "decision", conceptos: ["abonado", "venta_credito"] }], criterio: { lente: "credito" } }));
  ok(limpio(J12) && /la foto de cobranza \(8 de 13 cuentas\), en el orden de la mesa, con Abonado: Lider /.test(J12.texto), "52(c) · J12: la foto de cobranza va «en el orden de la mesa» (Lider, Falabella, Sodimac…), no ordenada por «Abonado»");
  const J04 = real("B04", v({ partes: [{ id: "p1", tema: "inventario", cierre: "cifra", conceptos: ["dias_sin_venta", "rotacion"], eje: "sku", universo: { eje: "sku", top: { metrica: "dias_sin_venta", k: 3, direccion: "menor" } } }] }));
  ok(limpio(J04) && /empatan en el puesto 1; no tienen días sin venta \(0 días\)\)/.test(J04.texto), "39(c) · 46(f) · J04: el empate del filo en cero dice «no tienen días sin venta (0 días)»");
  const J19 = real("B19", v({ partes: [{ id: "p1", tema: "comercial", cierre: "lectura", conceptos: ["variacion", "costo"], eje: "marca" }] }));
  ok(limpio(J19) && /sin dato de variación vs año anterior para Makita \(1 de 5 marcas\)/.test(J19.texto) && !/la foto no trae/.test(J19.texto), "52(b) · J19: la ausencia de la variación de Makita se dice «sin dato de variación vs año anterior para Makita (1 de 5 marcas)»");
  const J57 = real("B57b", v({ partes: [{ id: "p1", tema: "comercial", cierre: "decision", conceptos: ["variacion", "contribucion"], eje: "marca", universo: { eje: "marca", top: { metrica: "variacion", k: 4 } } }] }));
  ok(limpio(J57) && /el universo declarado no se pudo evaluar\.\*\* ranking-parcial: sin dato de variación vs año anterior para Makita/.test(J57.texto), "52(b) · J57: la parte declinada por el ranking incompleto dice quién no tiene dato (texto de `ausencias.js`)");
}

H("4i · carnadas de la 54 (mediciones v31 y v32): los eslabones de un conteo (F6) · la lente «ventas» sobre inventario no ordena (F1) · un concepto sin productor declina con alternativas (F2)");
{
  const F1 = familias.find((f) => f.id === "F1"), F2 = familias.find((f) => f.id === "F2"), F6 = familias.find((f) => f.id === "F6");
  const regla = (vs, r) => vs.some((x) => x.regla === r);
  const v = (parte) => ({ version: "encargo/v1", ...parte });
  const comp = (id, enc) => entregaDe(base, { origen: "gate", id, encargo: enc });
  const conRespuesta = (e, f) => ({ ...e, entrega: { ...e.entrega, respuesta: e.entrega.respuesta.map(f) } });
  const PREM = "Sobre la premisa planteada en la consulta";
  /* (a) los eslabones de un conteo — la cadena de H74 (v31): marca · venta > $4M ∧ margen < 26.5 % → top 2 de contribución → sin Samsung = 5 → 5 → 3 → 2 → 1 */
  const U1 = { eje: "marca", filtros: [{ metrica: "ventas", op: ">", valor: 4000000 }, { metrica: "margen", op: "<", valor: 26.5 }], top: { metrica: "contribucion", k: 2 }, excluir: { entidades: ["Samsung"] } };
  const E1 = comp("E54a", v({ partes: [{ id: "p1", tema: "comercial", cierre: "cifra", conceptos: ["ventas", "margen"], eje: "marca", universo: U1 }], premisas: [
    { id: "q1", tipo: "conteo", conteo: { n: 1, m: 1 }, de: U1 }, { id: "q2", tipo: "conteo", conteo: { n: 1, m: 3 }, de: U1 }, { id: "q3", tipo: "conteo", conteo: { n: 1, m: 4 }, de: U1 }, { id: "q4", tipo: "conteo", conteo: { n: 2, m: 5 }, de: U1 }] }));
  const idx = (e, q) => (e.ok ? e.entrega.respuesta.findIndex((r) => r._premisa && r.hechos[0] === q) : -1);
  const frase = (e, q) => (idx(e, q) >= 0 ? e.entrega.respuesta[idx(e, q)].texto : "");
  ok(!!F6 && E1.ok && revisarEntrega(E1, [F6]).length === 0, "54(a) · H74: la cadena 5 → 5 → 3 → 2 → 1 se compone y el control de la F6 no marca nada");
  ok(/es correcto — 1 de 1 en las marcas/.test(frase(E1, "q1")), "54(a) · «1 de 1» sobre el universo FINAL (el top menos Samsung: LG) es verdadero: «n de n» sobre el final");
  ok(/es correcto — 1 de 3 en las marcas/.test(frase(E1, "q2")), "54(a) · «1 de 3» (el eslabón tras los DOS filtros) es verdadero");
  ok(/no es así — 1 de 2 en las marcas/.test(frase(E1, "q3")), "54(a) · «1 de 4» (4 no es de la cadena) es falso y la verdad imprime el eslabón MÁS AJUSTADO distinto del final: «1 de 2» (el top, antes de excluir)");
  ok(/no es así — 1 de 5 en las marcas/.test(frase(E1, "q4")), "54(a) · «2 de 5» (n falso) es falso: la verdad dice «1 de 5»");
  if (F6 && E1.ok) {
    const con = (q, t) => conRespuesta(E1, (r, k) => (k === idx(E1, q) ? { ...r, texto: t } : r));
    ok(regla(revisarEntrega(con("q1", `${PREM}: no es así — 1 de 2 en las marcas con venta superior a $4.0M: LG.`), [F6]), "conteo-eslabon-veredicto"), "«1 de 1» sobre el universo final juzgado FALSO (lo que hacía el Notario) → conteo-eslabon-veredicto");
    ok(regla(revisarEntrega(con("q2", `${PREM}: no es así — 1 de 2 en las marcas con venta superior a $4.0M: LG.`), [F6]), "conteo-eslabon-veredicto"), "«1 de 3» (el eslabón de los dos filtros) juzgado FALSO → conteo-eslabon-veredicto");
    ok(regla(revisarEntrega(con("q4", `${PREM}: es correcto — 1 de 5 en las marcas con venta superior a $4.0M: LG.`), [F6]), "conteo-eslabon-veredicto"), "«2 de 5» (el universo final tiene 1) juzgado VERDADERO → conteo-eslabon-veredicto");
    ok(regla(revisarEntrega(con("q3", `${PREM}: no es así — 1 de 5 en las marcas con venta superior a $4.0M: LG.`), [F6]), "conteo-eslabon-m-impreso"), "un conteo falso por su M que imprime «1 de 5» (el eje entero) en vez del eslabón más ajustado (2) → conteo-eslabon-m-impreso");
    ok(revisarEntrega(con("q3", `${PREM}: no es así — 1 de 2 en las marcas con venta superior a $4.0M: LG.`), [F6]).length === 0, "la misma verdad con el eslabón más ajustado («1 de 2») no marca nada");
  }
  /* (a) los filtros NO son un solo eslabón — G71 (v32): familia · venta > $12M (4 → 3) ∧ carga > 3.3 % (→ 2) → top 2 de menos margen (→ 2) → sin Electrodomésticos (→ 1) */
  const U2 = { eje: "familia", filtros: [{ metrica: "ventas", op: ">", valor: 12000000 }, { metrica: "carga", op: ">", valor: 3.3 }], top: { metrica: "margen", k: 2, direccion: "menor" }, excluir: { entidades: ["Electrodomésticos"] } };
  const E2 = comp("E54b", v({ partes: [{ id: "p1", tema: "comercial", cierre: "cifra", conceptos: ["margen", "carga"], eje: "familia", universo: U2 }], premisas: [{ id: "q1", tipo: "conteo", conteo: { n: 1, m: 1 }, de: U2 }, { id: "q2", tipo: "conteo", conteo: { n: 1, m: 3 }, de: U2 }] }));
  ok(E2.ok && revisarEntrega(E2, [F6]).length === 0 && /es correcto — 1 de 1 en las familias/.test(frase(E2, "q1")) && /es correcto — 1 de 3 en las familias/.test(frase(E2, "q2")), "54(a) · G71: «1 de 3» (tras el primer filtro) y «1 de 1» (el final) son verdaderos: cada filtro es su propio eslabón");
  if (F6 && E2.ok) ok(regla(revisarEntrega(conRespuesta(E2, (r, k) => (k === idx(E2, "q2") ? { ...r, texto: `${PREM}: no es así — 1 de 2 en las familias con venta superior a $12.0M: Cuidado Personal.` } : r)), [F6]), "conteo-eslabon-veredicto"), "G71.q2 «1 de 3» juzgado FALSO (los filtros contados como un solo eslabón) → conteo-eslabon-veredicto");
  /* (c) la 50(b) en todos los caminos: la lente «ventas» sobre inventario por SKU se declara y no ordena, aunque el universo use un top por ventas (H72, v31) */
  const E3 = comp("E54c", v({ partes: [{ id: "p1", tema: "inventario", cierre: "decision", conceptos: ["capital"], eje: "sku", universo: { eje: "sku", top: { metrica: "ventas", k: 3 } } }], criterio: { lente: "ventas" } }));
  const iP = E3.ok ? E3.entrega.respuesta.findIndex((r) => /^Prioridad del procedimiento dentro de este grupo/.test(r.texto)) : -1;
  ok(!!F1 && iP >= 0 && /por venta, el top que se pidió: SAM-TV55/.test(E3.entrega.respuesta[iP].texto) && !/no ordena este grupo/.test(E3.entrega.respuesta[iP].texto) && revisarEntrega(E3, [F1]).length === 0, "54(c) corregida por la 55(a) · H72: con un top por ventas la lista la ordena la venta y la oración lo dice («por venta, el top que se pidió»), sin declarar que «ventas» no ordena; el control de la F1 no marca nada");
  if (F1 && iP >= 0) {
    ok(regla(revisarEntrega(conRespuesta(E3, (r, k) => (k === iP ? { ...r, texto: "Prioridad del procedimiento dentro de este grupo, por ventas: SAM-TV55, con $13.3M en venta." } : r)), [F1]), "ventas-sobre-inventario-ordena"), "«por ventas: SAM-TV55, con $13.3M en venta» sobre inventario (la lente nombrada como la que ordenó) → ventas-sobre-inventario-ordena");
    ok(!regla(revisarEntrega(conRespuesta(E3, (r, k) => (k === iP ? { ...r, texto: "Prioridad del procedimiento dentro de este grupo, por capital (el criterio pedido, ventas, no ordena este grupo): SAM-REF500L, con $19K en capital." } : r)), [F1]), "ventas-sobre-inventario-ordena"), "la lente declarada sobre otra medida («por capital (el criterio pedido, ventas, no ordena este grupo)») no marca la regla");
  }
  /* (c) la lente «ventas» sobre COMERCIAL sigue ordenando: el control no la marca */
  { const E3c = comp("E54c2", v({ partes: [{ id: "p1", tema: "comercial", cierre: "decision", conceptos: ["ventas", "margen"], eje: "marca" }], criterio: { lente: "ventas" } }));
    ok(E3c.ok && /por ventas: Samsung/.test(E3c.texto) && revisarEntrega(E3c, [F1]).length === 0, "la lente «ventas» sobre una decision COMERCIAL sigue ordenando («por ventas: Samsung») y no marca la regla"); }
  /* (b) un concepto sin productor declina CON alternativas: el eje donde sí se publica y el concepto que sí se publica en ese eje (H27, v31) */
  const E4 = comp("E54d", v({ partes: [{ id: "p1", tema: "comercial", cierre: "cifra", conceptos: ["ventas", "peso_costo"], eje: "marca", entidades: [{ nombre: "Bosch", eje: "marca" }] }] }));
  const nrSP = E4.ok ? E4.resolucion.noResuelto.find((x) => x.motivo === "concepto_sin_productor" && x.valor === "peso_costo") : null;
  ok(!!F2 && !!nrSP && nrSP.alternativas.some((a) => a.tipo === "eje" && a.eje === "marca") && nrSP.alternativas.some((a) => a.tipo === "concepto" && a.clave === "ventas") && revisarEntrega(E4, [F2]).length === 0, "54(b) · H27: `peso_costo` (sin productor en ningún eje) declina con el eje donde se publica (marca) y el concepto que sí se publica en él (ventas), y el control de la F2 no marca nada");
  if (F2 && nrSP) {
    const conAlt = (alt) => ({ ...E4, resolucion: { ...E4.resolucion, noResuelto: E4.resolucion.noResuelto.map((x) => (x === nrSP ? { ...x, alternativas: alt } : x)) } });
    ok(regla(revisarEntrega(conAlt([]), [F2]), "declinacion-sin-alternativas"), "`peso_costo` declinado con la lista de alternativas VACÍA (lo que hacía el validador) → declinacion-sin-alternativas");
    ok(regla(revisarEntrega(conAlt([{ tipo: "eje", eje: "marca" }]), [F2]), "declinacion-sin-alternativas"), "declinado con el eje pero sin el concepto que sí se publica → declinacion-sin-alternativas");
    ok(regla(revisarEntrega(conAlt([{ tipo: "eje", eje: "marca" }, { tipo: "concepto", clave: "saldo_vencido" }]), [F2]), "declinacion-alternativa-falsa"), "declinado con una pareja que el Core no publica (saldo vencido por marca) → declinacion-alternativa-falsa");
  }
  /* (b) el barrido: cada concepto de cada tema, en cada eje, con el eje explícito y por defecto — ninguna declinación sale con alternativas vacías */
  { const { DOMINIOS_REGISTRO } = await import("./src/config/contract/dominios.js"), { EJES } = await import("./src/adi/encargo/esquema.js");
    let n = 0; const malas = [];
    for (const d of DOMINIOS_REGISTRO.filter((x) => x.estado !== "ausente" && Array.isArray(x.metricas))) for (const eje of [null, ...EJES]) for (const c of d.metricas) {
      const R = base.validar.validarEncargo({ version: "encargo/v1", partes: [{ id: "p1", tema: d.id, cierre: "cifra", conceptos: [c], ...(eje ? { eje } : {}) }] }, {});
      for (const nr of R.noResuelto || []) { if (nr.motivo !== "concepto_sin_productor" && nr.motivo !== "eje_no_soportado") continue; n++; const t = new Set((nr.alternativas || []).map((a) => a.tipo)); if (!t.has("eje") || (nr.motivo === "concepto_sin_productor" && !t.has("concepto"))) malas.push(`${d.id}·${eje || "defecto"}·${c} (${nr.motivo})`); }
    }
    ok(n >= 100 && malas.length === 0, `54(b) · el barrido de ${n} declinaciones (concepto_sin_productor · eje_no_soportado) de todos los temas, ejes y conceptos: ninguna sale con la lista vacía ni sin el eje y el concepto que sí se publican`, malas.slice(0, 6).join(" · ")); }
  /* los conteos de cadena que genera el sub-azar: la variante «M igual al final» se juzga VERDADERA y la del n falso, FALSA */
  { const deCadena = cobertura.casos.filter((c) => /:conteos:/.test(c.id)); let veri = 0, malas = [];
    for (const c of deCadena.filter((x) => x.celda === "CONTEO:m-igual-al-final" || x.celda === "CONTEO:n-falso")) { const e = entregaDe(base, c); const i = e.ok ? e.entrega.respuesta.findIndex((r) => r._premisa && r.hechos[0] === "q1") : -1; if (i < 0 || !/(?:es correcto|no es así) — /.test(e.entrega.respuesta[i].texto)) continue; veri++; const dice = /es correcto — /.test(e.entrega.respuesta[i].texto); if (dice !== (c.celda === "CONTEO:m-igual-al-final")) malas.push(c.id); }
    ok(veri >= 20 && malas.length === 0, `los conteos de cadena del sub-azar (${veri} verificados): «n de n» sobre el universo final se juzga verdadero y un n falso, falso`, malas.slice(0, 4).join(", ")); }
}

H("4j · carnadas de la 55 (mediciones v33 y v34): un top por ventas ordena la lista (54c corregida) · el nombre de la lente es POR PARTE (52a) · la lista tras «ninguna cuenta queda primera» conserva el orden · el % con la forma de la casa");
{
  const F1 = familias.find((f) => f.id === "F1");
  const regla = (vs, r) => vs.some((x) => x.regla === r);
  const v = (parte) => ({ version: "encargo/v1", ...parte });
  const comp = (id, enc) => entregaDe(base, { origen: "gate", id, encargo: enc });
  const cambia = (e, re, texto) => ({ ...e, entrega: { ...e.entrega, respuesta: e.entrega.respuesta.map((r) => (re.test(r.texto) ? { ...r, texto } : r)) } });
  const frase = (e, re) => (e.ok ? (e.entrega.respuesta.find((r) => re.test(r.texto)) || { texto: "" }).texto : "");
  const PRIO_G = /^Prioridad del procedimiento dentro de este grupo/, PRIO_C = /^Prioridad del procedimiento, por /;
  /* (a) la 55(a): el universo ya viene ordenado por venta (un top por ventas): lo que ordenó la lista es la venta; no se declara «ventas no ordena este grupo» (E20 · E55 · E81 · E82 · E83 de v34) */
  const A = comp("E55a", v({ partes: [{ id: "p1", tema: "inventario", cierre: "decision", conceptos: ["dias_inventario", "capital"], eje: "sku", universo: { eje: "sku", estados: ["capital sano"], top: { metrica: "ventas", k: 4 } } }], criterio: { lente: "ventas" } }));
  ok(!!F1 && A.ok && /por venta, el top que se pidió: SAM-TV55, con \$13\.3M en venta\.$/.test(frase(A, PRIO_G)) && !/no ordena/.test(frase(A, PRIO_G)) && revisarEntrega(A, [F1]).length === 0, "55(a) · E81: inventario por SKU con un top por ventas y la lente «ventas» → «por venta, el top que se pidió: SAM-TV55, con $13.3M en venta», sin declarar que «ventas» no ordena; el control no marca nada");
  if (F1 && A.ok) {
    ok(regla(revisarEntrega(cambia(A, PRIO_G, "Prioridad del procedimiento dentro de este grupo, por venta (el criterio pedido, ventas, no ordena este grupo): SAM-TV55, con $13.3M en venta."), [F1]), "oracion-dice-que-no-ordena-y-ordena"), "la oración que dice «ventas no ordena este grupo» mientras ordena por venta (lo que hacía la 54c) → oracion-dice-que-no-ordena-y-ordena");
    ok(regla(revisarEntrega(cambia(A, PRIO_G, "Prioridad del procedimiento dentro de este grupo, por capital (el criterio pedido, ventas, no ordena este grupo): LG-WASH11KG, con $15K en capital."), [F1]), "oracion-dice-que-no-ordena-y-ordena"), "dice «ventas no ordena» y el universo de la parte ya viene ordenado por venta (aunque la medida nombrada sea otra) → oracion-dice-que-no-ordena-y-ordena");
    ok(regla(revisarEntrega(cambia(A, PRIO_G, "Prioridad del procedimiento dentro de este grupo, por ventas: SAM-TV55, con $13.3M en venta."), [F1]), "ventas-sobre-inventario-ordena"), "«por ventas: SAM-TV55» sobre inventario (la lente nombrada como la que ordenó) → ventas-sobre-inventario-ordena");
  }
  /* sin un top por ventas la lente SÍ se declara (50b): el control no marca la declaración y marca «el top que se pidió» sin top por esa medida */
  const A2 = comp("E55a2", v({ partes: [{ id: "p1", tema: "inventario", cierre: "decision", conceptos: ["capital"], eje: "sku", universo: { eje: "sku", top: { metrica: "capital", k: 3 } } }], criterio: { lente: "ventas" } }));
  ok(!!F1 && A2.ok && /por capital \(el criterio pedido, ventas, no ordena este grupo\): SAM-REF500L/.test(frase(A2, PRIO_G)) && revisarEntrega(A2, [F1]).length === 0, "55(a) · sin un top por ventas (el top es por capital) la lente «ventas» sobre inventario se declara («no ordena este grupo») y el control no marca nada");
  if (F1 && A2.ok) ok(regla(revisarEntrega(cambia(A2, PRIO_G, "Prioridad del procedimiento dentro de este grupo, por venta, el top que se pidió: SAM-REF500L, con $19K en capital."), [F1]), "por-el-top-sin-top"), "«por venta, el top que se pidió» cuando el top es por capital → por-el-top-sin-top");
  /* (b) la 55(b): el nombre de la lente «ventas» es POR PARTE — F30 de v33: una decision comercial y una lectura de cobranza */
  const B = comp("F30c", v({ partes: [{ id: "p1", tema: "comercial", cierre: "decision", conceptos: ["variacion", "ventas"] }, { id: "p2", tema: "cobranza", cierre: "lectura", conceptos: ["saldo_pendiente"] }], criterio: { lente: "ventas" } }));
  ok(!!F1 && B.ok && /por ventas: Falabella, con \$19\.4M en venta\.$/.test(frase(B, PRIO_C)) && revisarEntrega(B, [F1]).length === 0, "55(b) · F30: una decision comercial más una lectura de cobranza con la lente «ventas» → «por ventas: Falabella, con $19.4M en venta» (no «venta a crédito»); el control no marca nada");
  const Bd = comp("F30d", v({ partes: [{ id: "p1", tema: "comercial", cierre: "decision", conceptos: ["ventas", "margen"] }, { id: "p2", tema: "cobranza", cierre: "decision", conceptos: ["saldo_vencido"] }], criterio: { lente: "ventas" } }));
  ok(!!F1 && Bd.ok && /por ventas: Falabella/.test(frase(Bd, PRIO_C)) && revisarEntrega(Bd, [F1]).length === 0, "55(b) · con una decision comercial y otra de cobranza la lente se dice «ventas» (la parte comercial ordena por la venta del período)");
  if (F1 && B.ok) ok(regla(revisarEntrega(cambia(B, PRIO_C, "Prioridad del procedimiento, por venta a crédito: Falabella, con $19.4M en venta a crédito."), [F1]), "venta-a-credito-fuera-de-cobranza"), "«por venta a crédito» en una oración cuya parte que decide es comercial (aunque el encargo tenga una parte de cobranza) → venta-a-credito-fuera-de-cobranza");
  const C = comp("F30e", v({ partes: [{ id: "p1", tema: "cobranza", cierre: "decision", conceptos: ["saldo_vencido", "saldo_pendiente"] }], criterio: { lente: "ventas" } }));
  ok(!!F1 && C.ok && /por venta a crédito: Falabella, con \$19\.4M en venta a crédito\.$/.test(frase(C, PRIO_C)) && revisarEntrega(C, [F1]).length === 0, "55(b) · una decision de COBRANZA con la lente «ventas» sigue diciendo «por venta a crédito» (52a)");
  if (F1 && C.ok) ok(regla(revisarEntrega(cambia(C, PRIO_C, "Prioridad del procedimiento, por ventas: Falabella, con $19.4M en venta a crédito."), [F1]), "ventas-en-cobranza-sin-credito"), "«por ventas» en una oración cuya única parte que decide es de cobranza → ventas-en-cobranza-sin-credito");
  /* (c) la 55(c): tras «ninguna cuenta queda primera» la lista conserva el orden del top pedido (E03 de v34: «las 4 que más recuperaron» con la lente exposición de crédito) */
  const D = comp("E55c", v({ partes: [{ id: "p1", tema: "cobranza", cierre: "decision", conceptos: ["recuperado", "saldo_pendiente"], universo: { eje: "cliente", top: { metrica: "recuperado", k: 4 } } }], criterio: { lente: "credito" } }));
  ok(!!F1 && D.ok && /ninguna cuenta queda primera, porque el grupo \(.*\) no trae saldo vencido; la lista se ordenó por recuperado: Mercado Libre \(77\.8%\), Ripley \(77\.8%\), La Polar \(71\.4%\)\.$/.test(frase(D, PRIO_G)) && revisarEntrega(D, [F1]).length === 0, "55(c) · E03: «ninguna cuenta queda primera» y la lista conserva el orden del top pedido (Mercado Libre, Ripley, La Polar); el control no marca nada");
  if (F1 && D.ok) {
    ok(regla(revisarEntrega(cambia(D, PRIO_G, "Prioridad del procedimiento dentro de este grupo, por exposición de crédito: ninguna cuenta queda primera, porque el grupo (Mercado Libre, Ripley, La Polar, Hites, ABC, Unimarc) no trae saldo vencido; la lista se ordenó por recuperado: La Polar (71.4%), Ripley (77.8%), Mercado Libre (77.8%)."), [F1]), "lista-tras-ninguna-pierde-el-orden"), "la lista tras «ninguna cuenta queda primera» invertida (de menor a mayor, como pedía la 50a para la oración) → lista-tras-ninguna-pierde-el-orden");
  }
  /* (c·2) la 55(c) SIN top, con entidades nombradas (C82 de v36): la lente en cero (el saldo vencido vale $0 para las tres) y el primer concepto pedido (recuperado) ordena a las tres en otro orden que el nombrado: la enumeración «el grupo (…)» conserva el orden en que se NOMBRARON (el de la tabla) */
  const NOMB = (nombres, conceptos = ["recuperado", "saldo_pendiente"]) => v({ partes: [{ id: "p1", tema: "cobranza", cierre: "decision", conceptos, entidades: nombres.map((nombre) => ({ nombre })) }], criterio: { lente: "credito" } });
  const D2 = comp("E55c2", NOMB(["Jumbo", "Mercado Libre", "Ripley"]));
  ok(!!F1 && D2.ok && /ninguna cuenta queda primera, porque el grupo \(Jumbo, Mercado Libre, Ripley\) no tiene saldo vencido/.test(frase(D2, PRIO_G)) && revisarEntrega(D2, [F1]).length === 0, "55(c) · C82: tres cuentas nombradas (Jumbo, Mercado Libre, Ripley) con la lente en cero → «ninguna cuenta queda primera, porque el grupo (Jumbo, Mercado Libre, Ripley)…», el orden nombrado (no el de «recuperado»); el control no marca nada");
  const D3 = comp("E55c3", NOMB(["Ripley", "Jumbo", "Mercado Libre"]));
  ok(!!F1 && D3.ok && /porque el grupo \(Ripley, Jumbo, Mercado Libre\) no tiene saldo vencido/.test(frase(D3, PRIO_G)) && revisarEntrega(D3, [F1]).length === 0, "55(c) · las mismas tres nombradas en otro orden (Ripley, Jumbo, Mercado Libre) → la enumeración las dice en ESE orden (la tabla de la misma Entrega también); el control no marca nada");
  if (F1 && D2.ok) {
    ok(regla(revisarEntrega(cambia(D2, PRIO_G, "Prioridad del procedimiento dentro de este grupo, por exposición de crédito: ninguna cuenta queda primera, porque el grupo (Mercado Libre, Ripley, Jumbo) no tiene saldo vencido ($0)."), [F1]), "lista-tras-ninguna-pierde-el-orden"), "55(c) sin top · la enumeración reordenada por el primer concepto pedido (la de v36, «(Mercado Libre, Ripley, Jumbo)») → lista-tras-ninguna-pierde-el-orden");
    ok(regla(revisarEntrega(cambia(D2, PRIO_G, "Prioridad del procedimiento dentro de este grupo, por exposición de crédito: ninguna cuenta queda primera, porque Ripley y Jumbo empatan en saldo vencido ($0)."), [F1]), "lista-tras-ninguna-pierde-el-orden"), "55(c) sin top · los empatados dichos al revés del orden nombrado («Ripley y Jumbo empatan») → lista-tras-ninguna-pierde-el-orden");
    ok(!regla(revisarEntrega(cambia(D2, PRIO_G, "Prioridad del procedimiento dentro de este grupo, por exposición de crédito: ninguna cuenta queda primera, porque Jumbo y Ripley empatan en saldo vencido ($0)."), [F1]), "lista-tras-ninguna-pierde-el-orden"), "55(c) sin top · los empatados en el orden nombrado («Jumbo y Ripley empatan») → el control no marca");
  }
  /* (56) la lente «crecimiento»: su medida es la variación vs año anterior; donde el dato la publica la lente APLICA y ordena al mayor («por crecimiento: …»), sin declarar que no ordena (S64 · P22 · L22 · L24); a quien no tiene dato se le aplica la 52(b) (M25: Makita) */
  const G = comp("S64c", v({ partes: [{ id: "p1", tema: "comercial", cierre: "decision", conceptos: ["variacion", "ventas"], eje: "familia" }], criterio: { lente: "crecimiento" } }));
  ok(!!F1 && G.ok && /por crecimiento: Línea Blanca, con 15\.6% en variación vs año anterior\.$/.test(frase(G, PRIO_G)) && revisarEntrega(G, [F1]).length === 0, "56 · S64: la lente «crecimiento» sobre una decision comercial por familia → «por crecimiento: Línea Blanca, con 15.6% en variación vs año anterior» (va primero el de mayor variación); el control no marca nada");
  if (F1 && G.ok) {
    ok(regla(revisarEntrega(cambia(G, PRIO_G, "Prioridad del procedimiento dentro de este grupo, por variación vs año anterior (el criterio pedido, crecimiento, no ordena este grupo): Línea Blanca, con 15.6% en variación vs año anterior."), [F1]), "oracion-dice-que-no-ordena-y-ordena"), "la oración que declara «crecimiento no ordena este grupo» mientras ordena por la variación vs año anterior (lo que hacía el código) → oracion-dice-que-no-ordena-y-ordena (firme)");
    ok(regla(revisarEntrega(cambia(G, PRIO_G, "Prioridad del procedimiento dentro de este grupo, por crecimiento: Cuidado Personal, con 7.1% en variación vs año anterior."), [F1]), "primero-no-pide-atencion"), "«por crecimiento» que corona a quien no tiene la mayor variación → primero-no-pide-atencion");
  }
  const Gm = comp("M25c", v({ partes: [{ id: "p1", tema: "comercial", cierre: "decision", conceptos: ["carga", "variacion"], eje: "marca" }], criterio: { lente: "crecimiento" } }));
  ok(!!F1 && Gm.ok && /por crecimiento: LG, con \+?15\.6% en variación vs año anterior\.$/.test(frase(Gm, PRIO_G)) && /sin dato de variación vs año anterior para Makita/.test(Gm.texto) && revisarEntrega(Gm, [F1]).length === 0, "56 · M25: una marca sin variación (Makita) se declara «sin dato de variación vs año anterior para Makita» (52b) y la lente ordena a las demás; el control no marca nada");
  const Gi = comp("L56i", v({ partes: [{ id: "p1", tema: "inventario", cierre: "decision", conceptos: ["capital"], eje: "sku", universo: { eje: "sku", top: { metrica: "capital", k: 3 } } }], criterio: { lente: "crecimiento" } }));
  ok(!!F1 && Gi.ok && /\(el criterio pedido, crecimiento, no ordena este grupo\)/.test(frase(Gi, PRIO_G)) && revisarEntrega(Gi, [F1]).length === 0, "56 · donde el dato no publica la variación para el eje de la parte (inventario por SKU) la lente «crecimiento» se declara (50b) y el control no marca nada");
  /* la presentación (v33 F09.q3): un % negativo de la verdad propia con la forma de la casa («-5%», no «-5.0%») */
  const U9 = { eje: "cliente", estados: ["en mora"], filtros: [{ metrica: "carga", op: ">", valor: 4 }, { metrica: "variacion", op: ">", valor: 0 }], top: { metrica: "saldo_pendiente", k: 2 }, excluir: { entidades: ["Lider"] } };
  const E9 = comp("F09q3", v({ partes: [{ id: "p1", tema: "cobranza", cierre: "lectura", conceptos: ["saldo_vencido", "saldo_pendiente"], universo: U9 }], premisas: [{ id: "q3", tipo: "grupo", miembros: ["Easy"], universo: U9 }] }));
  ok(E9.ok && /no es así — Easy: variación vs año anterior -5%\./.test(E9.texto) && !/-5\.0%/.test(E9.texto), "presentación · F09.q3: la verdad propia de Easy dice «-5%» (el formato de la casa), no «-5.0%»");
}

H("4k · carnadas de la 57 (mediciones v37 y v38): la lente «crecimiento» en % y en TODOS los caminos (F1) · una oración de prioridad por parte en un encargo mixto (F1) · la bodega, los no_estados y las ramas de una unión son eslabones de un conteo (F6)");
{
  const F1 = familias.find((f) => f.id === "F1"), F6 = familias.find((f) => f.id === "F6");
  const regla = (vs, r) => vs.some((x) => x.regla === r);
  const v = (parte) => ({ version: "encargo/v1", ...parte });
  const comp = (id, enc) => entregaDe(base, { origen: "gate", id, encargo: enc });
  const cambia = (e, re, texto) => ({ ...e, entrega: { ...e.entrega, respuesta: e.entrega.respuesta.map((r) => (re.test(r.texto) ? { ...r, texto } : r)) } });
  const quita = (e, re) => ({ ...e, entrega: { ...e.entrega, respuesta: e.entrega.respuesta.filter((r) => !re.test(r.texto)) } });
  const sinLimite = (e, re) => ({ ...e, entrega: { ...e.entrega, limites: e.entrega.limites.filter((l) => !re.test(`${l.titulo} ${l.motivo}`)) } });
  const frase = (e, re) => (e.ok ? (e.entrega.respuesta.find((r) => re.test(r.texto)) || { texto: "" }).texto : "");
  const PRIO_G = /^Prioridad del procedimiento dentro de este grupo/, PRIO_C = /^Prioridad del procedimiento, por crecimiento/;
  /* (a)(b) B25 de v37: Ripley, Hites y Paris NOMBRADAS con la lente «crecimiento»: va primero la de MAYOR variación EN % (Hites, 4%), no la de menor (Ripley, −8.2%, −$422K) */
  const B25 = comp("B25k", v({ partes: [{ id: "p1", tema: "comercial", cierre: "decision", conceptos: ["ventas", "margen"], entidades: [{ nombre: "Ripley" }, { nombre: "Hites" }, { nombre: "Paris" }] }], criterio: { lente: "crecimiento" } }));
  ok(!!F1 && B25.ok && /^Prioridad del procedimiento, por crecimiento: Hites, con \+?4% en variación vs año anterior\.$/.test(frase(B25, PRIO_C)) && revisarEntrega(B25, [F1]).length === 0, "57(b) · B25: entidades NOMBRADAS (Ripley · Hites · Paris) con la lente «crecimiento» → «por crecimiento: Hites, con 4% en variación vs año anterior» (la mayor variación en %); el control no marca nada");
  if (F1 && B25.ok) {
    const c1 = revisarEntrega(cambia(B25, PRIO_C, "Prioridad del procedimiento, por crecimiento: Ripley, con -$422K en variación vs año anterior en $."), [F1]);
    ok(regla(c1, "crecimiento-no-corona-a-la-mayor-variacion") && regla(c1, "crecimiento-base-en-dinero"), "lo que decía el código en B25 («por crecimiento: Ripley, con -$422K en variación vs año anterior en $») → crecimiento-no-corona-a-la-mayor-variacion Y crecimiento-base-en-dinero");
    ok(regla(revisarEntrega(cambia(B25, PRIO_C, "Prioridad del procedimiento, por crecimiento: Ripley, con -8.2% en variación vs año anterior."), [F1]), "crecimiento-no-corona-a-la-mayor-variacion"), "«por crecimiento» que corona a la de MENOR variación en % (Ripley, −8.2%) → crecimiento-no-corona-a-la-mayor-variacion");
    const c3 = revisarEntrega(cambia(B25, PRIO_C, "Prioridad del procedimiento, por crecimiento: Hites, con +$150K en variación vs año anterior en $."), [F1]);
    ok(regla(c3, "crecimiento-base-en-dinero") && !regla(c3, "crecimiento-no-corona-a-la-mayor-variacion"), "la oración que ordena con la variación EN $ aunque nombre a la correcta → solo crecimiento-base-en-dinero (57a: el dinero acompaña, no decide)");
  }
  /* (b) B22 de v37: la FOTO de las 13 cuentas con la lente «crecimiento»: va primero Mercado Libre (25.3%), no Lider (la mayor variación en dinero, +$2.3M) */
  const B22 = comp("B22k", v({ partes: [{ id: "p1", tema: "comercial", cierre: "decision", conceptos: ["ventas", "unidades"] }], criterio: { lente: "crecimiento" } }));
  ok(!!F1 && B22.ok && /^Prioridad del procedimiento, por crecimiento: Mercado Libre, con \+?25\.3% en variación vs año anterior\.$/.test(frase(B22, PRIO_C)) && revisarEntrega(B22, [F1]).length === 0, "57(a)(b) · B22: la foto de las 13 cuentas con la lente «crecimiento» → «por crecimiento: Mercado Libre, con 25.3% en variación vs año anterior» (la mayor variación en %, no en dinero); el control no marca nada");
  if (F1 && B22.ok) { const c = revisarEntrega(cambia(B22, PRIO_C, "Prioridad del procedimiento, por crecimiento: Lider, con +$2.3M en variación vs año anterior en $."), [F1]); ok(regla(c, "crecimiento-no-corona-a-la-mayor-variacion") && regla(c, "crecimiento-base-en-dinero"), "lo que decía el código en B22 («por crecimiento: Lider, con +$2.3M en variación vs año anterior en $») → las dos reglas"); }
  /* (b) en los otros caminos: el grupo por eje explícito, el universo con miembros y las nombradas de marca/familia/canal ordenan también por la mayor variación en % */
  { const casos = [
      ["foto por marca", { partes: [{ id: "p1", tema: "comercial", cierre: "decision", conceptos: ["carga"], eje: "marca" }] }, /por crecimiento: LG, con \+?15\.6%/],
      ["foto por canal", { partes: [{ id: "p1", tema: "comercial", cierre: "decision", conceptos: ["ventas"], eje: "canal" }] }, /por crecimiento: E-commerce, con \+?25\.3%/],
      ["universo con top", { partes: [{ id: "p1", tema: "comercial", cierre: "decision", conceptos: ["ventas"], universo: { eje: "cliente", top: { metrica: "ventas", k: 5, direccion: "mayor" } } }] }, /por crecimiento: Lider, con \+?14\.9%/],
      ["universo con filtros", { partes: [{ id: "p1", tema: "comercial", cierre: "decision", conceptos: ["ventas"], universo: { eje: "cliente", filtros: [{ metrica: "ventas", op: ">", valor: 15000000 }] } }] }, /por crecimiento: Lider, con \+?14\.9%/],
      ["nombradas de canal", { partes: [{ id: "p1", tema: "comercial", cierre: "decision", conceptos: ["ventas"], eje: "canal", entidades: [{ nombre: "Retail", eje: "canal" }, { nombre: "E-commerce", eje: "canal" }] }] }, /por crecimiento: E-commerce, con \+?25\.3%/],
      ["nombradas de familia", { partes: [{ id: "p1", tema: "comercial", cierre: "decision", conceptos: ["ventas"], eje: "familia", entidades: [{ nombre: "Línea Blanca", eje: "familia" }, { nombre: "Materiales de Construcción", eje: "familia" }] }] }, /por crecimiento: Línea Blanca, con \+?15\.6%/],
    ];
    const malos = [];
    for (const [n, p, re] of casos) { const e = comp(`4k:${n}`, v({ ...p, criterio: { lente: "crecimiento" } })); if (!(e.ok && re.test(e.texto) && revisarEntrega(e, [F1]).length === 0)) malos.push(n); }
    ok(malos.length === 0, `57(b) · la lente «crecimiento» corona a la mayor variación en % en la foto por marca y por canal, el universo con top y con filtros y las nombradas de canal y de familia (${casos.length} caminos) y el control no marca nada`, malos.join(", ")); }
  /* (b)(52b) A27 de v38: Makita NO tiene la variación: se declara «sin dato de variación vs año anterior para Makita» y la lente ordena a LG y Samsung */
  const A27 = comp("A27k", v({ partes: [{ id: "p1", tema: "comercial", cierre: "decision", conceptos: ["contribucion", "carga"], eje: "marca", entidades: [{ nombre: "LG", eje: "marca" }, { nombre: "Makita", eje: "marca" }, { nombre: "Samsung", eje: "marca" }] }], criterio: { lente: "crecimiento" } }));
  ok(!!F1 && A27.ok && /por crecimiento: LG, con \+?15\.6% en variación vs año anterior\.$/.test(frase(A27, PRIO_G)) && /sin dato de variación vs año anterior para Makita/.test(A27.texto) && revisarEntrega(A27, [F1]).length === 0, "57(b) · A27: LG · Makita · Samsung NOMBRADAS → «por crecimiento: LG» y «sin dato de variación vs año anterior para Makita» (52b, en el mismo camino); el control no marca nada");
  if (F1 && A27.ok) {
    ok(regla(revisarEntrega(sinLimite(A27, /Makita/), [F1]), "crecimiento-sin-dato-no-declarado"), "la Entrega de A27 sin la declaración de Makita (lo que decía v38) → crecimiento-sin-dato-no-declarado");
    ok(regla(revisarEntrega(cambia(A27, PRIO_G, "Prioridad del procedimiento dentro de este grupo, por crecimiento: Makita, con +20% en variación vs año anterior."), [F1]), "crecimiento-no-corona-a-la-mayor-variacion"), "coronar a Makita, que no tiene la variación → crecimiento-no-corona-a-la-mayor-variacion");
  }
  /* (c) B71 de v37: un encargo MIXTO (comercial + cobranza, la foto de cada una) con la lente «ventas»: cada parte que decide lleva SU oración con el nombre de su lente */
  const B71 = comp("B71k", v({ partes: [{ id: "p1", tema: "comercial", cierre: "decision", conceptos: ["carga", "unidades"] }, { id: "p2", tema: "cobranza", cierre: "decision", conceptos: ["saldo_por_vencer", "recuperado"] }], criterio: { lente: "ventas" } }));
  const PRIO_V = /^Prioridad del procedimiento, por venta/;
  ok(!!F1 && B71.ok && B71.entrega.respuesta.filter((r) => PRIO_V.test(r.texto)).length === 2 && /por ventas: Falabella, con \$19\.4M en venta\./.test(B71.texto) && /por venta a crédito: Falabella, con \$19\.4M en venta a crédito\./.test(B71.texto) && revisarEntrega(B71, [F1]).length === 0, "57(c) · B71: comercial + cobranza con la lente «ventas» → UNA oración por parte («por ventas: Falabella…» y «por venta a crédito: Falabella…»); el control no marca nada");
  if (F1 && B71.ok) {
    ok(regla(revisarEntrega(quita(B71, /^Prioridad del procedimiento, por venta a crédito/), [F1]), "parte-que-decide-sin-oracion-de-prioridad"), "la Entrega de B71 con UNA sola oración de prioridad (lo que decía v37: la de la parte comercial) → parte-que-decide-sin-oracion-de-prioridad");
    ok(regla(revisarEntrega(quita(B71, /^Prioridad del procedimiento, por ventas:/), [F1]), "parte-que-decide-sin-oracion-de-prioridad"), "…y sin la oración de la parte comercial → parte-que-decide-sin-oracion-de-prioridad");
  }
  /* (c) la lente «crecimiento» en un encargo mixto: la parte comercial la aplica («por crecimiento: Mercado Libre») y la de cobranza declara que no la ordena (50b) */
  const Bc = comp("B71c", v({ partes: [{ id: "p1", tema: "comercial", cierre: "decision", conceptos: ["carga", "unidades"] }, { id: "p2", tema: "cobranza", cierre: "decision", conceptos: ["saldo_por_vencer", "recuperado"] }], criterio: { lente: "crecimiento" } }));
  ok(!!F1 && Bc.ok && /por crecimiento: Mercado Libre, con \+?25\.3% en variación vs año anterior\./.test(Bc.texto) && /En cobranza, quien más pesa es .*El criterio pedido \(crecimiento\) no ordena este conjunto/.test(Bc.texto) && revisarEntrega(Bc, [F1]).length === 0, "57(c) · comercial + cobranza con la lente «crecimiento» → la parte comercial la aplica y la de cobranza declara que no la ordena; el control no marca nada");
  if (F1 && Bc.ok) ok(regla(revisarEntrega(cambia(Bc, /^En cobranza, quien más pesa/, "En cobranza, quien más pesa es Lider: $4.6M vencidos, 45% recuperado, 269 días de atraso."), [F1]), "parte-que-decide-sin-oracion-de-prioridad"), "la parte de cobranza que decide sin su oración ni la declaración de que la lente no la ordena → parte-que-decide-sin-oracion-de-prioridad");
  /* (c) las MISMAS entidades nombradas en las dos partes: cada una con su oración y el nombre de su lente */
  const Bn = comp("B71n", v({ partes: [{ id: "p1", tema: "comercial", cierre: "decision", conceptos: ["ventas"], entidades: [{ nombre: "Falabella" }, { nombre: "Lider" }, { nombre: "Jumbo" }] }, { id: "p2", tema: "cobranza", cierre: "decision", conceptos: ["saldo_vencido"], entidades: [{ nombre: "Falabella" }, { nombre: "Lider" }, { nombre: "Jumbo" }] }], criterio: { lente: "ventas" } }));
  ok(!!F1 && Bn.ok && /por ventas: Falabella/.test(Bn.texto) && /por venta a crédito: Falabella/.test(Bn.texto) && revisarEntrega(Bn, [F1]).length === 0, "57(c) · las mismas tres cuentas nombradas en una parte comercial y una de cobranza con la lente «ventas» → cada parte con su oración y el nombre de SU lente; el control no marca nada");
  /* (d) B40 de v37: la bodega, cada no_estado y cada rama de una unión son eslabones de un conteo */
  const UB = { eje: "sku", estados: ["rota lento"], bodega: "Valparaíso" };
  const EB = comp("B40k", v({ partes: [{ id: "p1", tema: "inventario", cierre: "lectura", conceptos: ["dias_sin_venta", "capital"], eje: "sku", universo: UB }], premisas: [{ id: "q1", tipo: "conteo", conteo: { n: 2, m: 4 }, de: UB }, { id: "q2", tipo: "conteo", conteo: { n: 2, m: 9 }, de: UB }] }));
  const idxP = (e, q) => (e.ok ? e.entrega.respuesta.findIndex((r) => r._premisa && r.hechos[0] === q) : -1);
  const conPrem = (e, q, t) => ({ ...e, entrega: { ...e.entrega, respuesta: e.entrega.respuesta.map((r, k) => (k === idxP(e, q) ? { ...r, texto: t } : r)) } });
  const PREM = "Sobre la premisa planteada en la consulta";
  ok(!!F6 && EB.ok && /es correcto — 2 de 4 en los SKU que rotan lento de Valparaíso/.test(EB.entrega.respuesta[idxP(EB, "q1")].texto) && /no es así — 2 de 3 en los SKU/.test(EB.entrega.respuesta[idxP(EB, "q2")].texto) && revisarEntrega(EB, [F6]).length === 0, "57(d) · B40: «2 de 4» (los 4 SKU de Valparaíso: la bodega acota el eje) es verdadero; «2 de 9» (9 no es de la cadena) es falso y la verdad imprime el eslabón más ajustado («2 de 3»); el control no marca nada");
  /* el control de la F6 recalcula la cadena con el dato: «rota lento» no tiene definición medible en la proyección (no decide); con «inmovilizado» sí: la bodega acota el eje como una base y su tamaño (2 SKU de Antofagasta) es un eslabón */
  const UI = { eje: "sku", estados: ["inmovilizado"], bodega: "Antofagasta" };
  const EI = comp("B40i", v({ partes: [{ id: "p1", tema: "inventario", cierre: "lectura", conceptos: ["capital"], eje: "sku", universo: UI }], premisas: [{ id: "q1", tipo: "conteo", conteo: { n: 1, m: 2 }, de: UI }, { id: "q2", tipo: "conteo", conteo: { n: 1, m: 3 }, de: UI }] }));
  ok(!!F6 && EI.ok && /es correcto — 1 de 2 en los SKU inmovilizados de Antofagasta/.test(EI.entrega.respuesta[idxP(EI, "q1")].texto) && /no es así — 1 de 2 en los SKU inmovilizados de Antofagasta/.test(EI.entrega.respuesta[idxP(EI, "q2")].texto) && revisarEntrega(EI, [F6]).length === 0, "57(d) · la BODEGA como eslabón (inmovilizados de Antofagasta): «1 de 2» (los 2 SKU de la bodega) es verdadero; «1 de 3» es falso y la verdad imprime el eslabón más ajustado («1 de 2»); el control no marca nada");
  if (F6 && EI.ok) ok(regla(revisarEntrega(conPrem(EI, "q1", `${PREM}: no es así — 1 de 3 en los SKU inmovilizados de Antofagasta: MAK-COMP-AIR.`), [F6]), "conteo-eslabon-veredicto"), "«1 de 2» (el eslabón de la bodega) juzgado FALSO → conteo-eslabon-veredicto");
  /* un NO_ESTADO es un eslabón: «sin inmovilizado crítico» (10 de los 13 SKU) y la bodega (4 SKU de Valparaíso, o 2 con el no_estado) */
  const UE = { eje: "sku", no_estados: ["inmovilizado critico"], bodega: "Valparaíso" };
  const EE = comp("B40e", v({ partes: [{ id: "p1", tema: "inventario", cierre: "lectura", conceptos: ["capital"], eje: "sku", universo: UE }], premisas: [{ id: "q1", tipo: "conteo", conteo: { n: 2, m: 10 }, de: UE }, { id: "q2", tipo: "conteo", conteo: { n: 2, m: 4 }, de: UE }] }));
  ok(!!F6 && EE.ok && /es correcto — 2 de 10 en los SKU no inmovilizados críticos de Valparaíso/.test(EE.entrega.respuesta[idxP(EE, "q1")].texto) && /es correcto — 2 de 4 en los SKU no inmovilizados críticos de Valparaíso/.test(EE.entrega.respuesta[idxP(EE, "q2")].texto) && revisarEntrega(EE, [F6]).length === 0, "57(d) · un NO_ESTADO como eslabón: «2 de 10» (los SKU sin inmovilizado crítico) y «2 de 4» (los SKU de la bodega) son verdaderos; el control no marca nada");
  if (F6 && EE.ok) ok(regla(revisarEntrega(conPrem(EE, "q1", `${PREM}: no es así — 2 de 4 en los SKU no inmovilizados críticos de Valparaíso: SAM-MICRO32L, PHI-HAIR-PRO.`), [F6]), "conteo-eslabon-veredicto"), "«2 de 10» (el eslabón del no_estado) juzgado FALSO → conteo-eslabon-veredicto");
  const UN = { eje: "cliente", union: [{ estados: ["en mora"] }, { no_estados: ["en mora"], filtros: [{ metrica: "recuperado", op: "<", valor: 40 }] }] };
  const EU = comp("B40u", v({ partes: [{ id: "p1", tema: "comercial", cierre: "lectura", conceptos: ["ventas"] }], premisas: [{ id: "q1", tipo: "conteo", conteo: { n: 6, m: 7 }, de: UN }, { id: "q2", tipo: "conteo", conteo: { n: 6, m: 9 }, de: UN }] }));
  ok(!!F6 && EU.ok && /es correcto — 6 de 7 en los clientes en mora y los clientes sin mora/.test(EU.entrega.respuesta[idxP(EU, "q1")].texto) && /no es así — 6 de 7 en los clientes en mora/.test(EU.entrega.respuesta[idxP(EU, "q2")].texto) && revisarEntrega(EU, [F6]).length === 0, "57(d) · una UNIÓN: «6 de 7» (el tamaño de una rama: los 7 clientes en mora) es verdadero; «6 de 9» es falso y la verdad imprime el eslabón más ajustado (7); el control no marca nada");
  if (F6 && EU.ok) {
    ok(regla(revisarEntrega(conPrem(EU, "q1", `${PREM}: no es así — 6 de 13 en los clientes en mora y los clientes sin mora con recuperado inferior a 40%: Falabella, Lider, Sodimac, Tottus, Paris, Easy.`), [F6]), "conteo-eslabon-veredicto"), "«6 de 7» (una rama de la unión) juzgado FALSO (lo que hacía el Notario) → conteo-eslabon-veredicto");
    ok(regla(revisarEntrega(conPrem(EU, "q2", `${PREM}: no es así — 6 de 13 en los clientes en mora y los clientes sin mora con recuperado inferior a 40%: Falabella, Lider, Sodimac, Tottus, Paris, Easy.`), [F6]), "conteo-eslabon-m-impreso"), "un conteo falso por su M que imprime el eje entero en vez del eslabón más ajustado de la unión (7) → conteo-eslabon-m-impreso");
  }
  /* los conteos de eslabón del sub-azar: «el M de la bodega / un no_estado / una rama» se juzga VERDADERO si n es el del universo final, y el n falso, FALSO */
  { const deEsl = cobertura.casos.filter((c) => /:eslabones:/.test(c.id)); let veri = 0; const malas = [];
    for (const c of deEsl.filter((x) => /m-de-la-bodega|m-de-un-no-estado|m-de-una-rama|m-igual-al-final|n-falso/.test(x.celda))) { const e = entregaDe(base, c); const i = e.ok ? e.entrega.respuesta.findIndex((r) => r._premisa && r.hechos[0] === "q1") : -1; if (i < 0 || !/(?:es correcto|no es así) — /.test(e.entrega.respuesta[i].texto)) continue; veri++; const dice = /es correcto — /.test(e.entrega.respuesta[i].texto); if (dice !== (c.celda !== "ESLABON:n-falso")) malas.push(c.id); }
    ok(veri >= 20 && malas.length === 0, `los conteos de eslabón del sub-azar (${veri} verificados): el M de la bodega, de un no_estado, de una rama o del universo final se juzga verdadero y un n falso, falso`, malas.slice(0, 4).join(", ")); }
}

H("5 · independencia del control y cableado de la pieza (estático)");
{
  const f6 =fs.readFileSync("./scripts/consolidacion/familias/f6_premisas.mjs", "utf8");
  ok(!/^\s*import[^\n]*(?:notario\/|entrega\/componer|entrega\/rotulos)/m.test(f6), "el control de la F6 NO importa el Notario ni la pieza del rótulo: lee la Entrega, el encargo y el dato");
  const cad = fs.readFileSync("./scripts/consolidacion/cadena.mjs", "utf8"), hec = fs.readFileSync("./src/adi/notario/hechos.js", "utf8");
  ok(!/^\s*import/m.test(cad) && /from "\.\.\/cadena\.mjs"/.test(f6) && /from "\.\/cadena\.mjs"/.test(fs.readFileSync("./scripts/consolidacion/cobertura.mjs", "utf8")), "la cadena de un conteo (`cadena.mjs`) se recalcula con el DATO, sin importar nada del Notario ni de la Entrega; la usan el control de la F6 y el generador de cobertura");
  ok(/§7\.3·54\(a\)/.test(hec) && /sumar\("filtros"/.test(hec) && /mAdmisibles\.add\(set\.size\)/.test(hec), "el Notario cuenta CADA filtro y cada estado como un eslabón y admite el universo final (54a)");
  ok(/§7\.3·57\(d\)/.test(hec) && /sumar\("bodega"/.test(hec) && /sumar\("no_estados"/.test(hec) && /u\.union\.forEach/.test(hec) && /rama = \{ \.\.\.v \}/.test(hec), "el Notario cuenta la BODEGA, CADA no_estado y CADA RAMA de una unión como eslabones (57d, que extiende la 54a)");
}
{
  const f1 =fs.readFileSync("./scripts/consolidacion/familias/f1_prioridad.mjs", "utf8");
  ok(!/from\s+["'][^"']*entrega\/prioridad/.test(f1) && !/^\s*import[^\n]*prioridad\.js/m.test(f1), "el control de la F1 NO importa la pieza (`entrega/prioridad.js`): lee la Entrega y el dato");
  const comp = fs.readFileSync("./src/adi/entrega/componer.js", "utf8"), tam = fs.readFileSync("./src/adi/entrega/tamano.js", "utf8"), ini = fs.readFileSync("./src/adi/entrega/iniciativa.js", "utf8"), lec = fs.readFileSync("./src/adi/encargo/lecturasDe.js", "utf8");
  ok(/from "\.\/prioridad\.js"/.test(comp) && /from "\.\/prioridad\.js"/.test(tam) && /from "\.\/prioridad\.js"/.test(ini) && /from "\.\.\/entrega\/prioridad\.js"/.test(lec), "componer, tamano, iniciativa y lecturasDe le preguntan a la pieza");
  ok(!/^(?:const|function) _(?:lenteDelGrupo|primeroDeAtencion|atencionEsElMenor|lenteOrdenaLaClave|lenteDeLaLista|nombreVisibleDeLente|lenteIdDelCriterio)\b/m.test(comp), "componer.js ya no decide por su cuenta (las helpers de la prioridad viven en la pieza)");
  ok(!/_MARCADOR_CONCLUSION/.test(comp) && !/_MARCADOR_CONCLUSION/.test(tam) && !/_entidadPrioritariaDeEntrega/.test(comp), "ni componer.js ni tamano.js leen «cuál es la oración de prioridad» con una expresión regular: leen la marca");
  ok(!/Prioridad del procedimiento, por \[\^:\]/.test(comp), "la expresión regular que extraía a la entidad prioritaria del texto ya no existe");
  ok(!/_CONCEPTO_DE_LA_MEDIDA\s*=\s*\{/.test(lec), "lecturasDe.js no tiene su propia tabla lente → medida: usa la de la pieza");
  ok(/prioridadPorMedidaParcial\(/.test(comp) && /export function prioridadPorMedidaParcial/.test(fs.readFileSync("./src/adi/entrega/prioridad.js", "utf8")) && /claves: \["variacion"\]/.test(fs.readFileSync("./src/adi/entrega/prioridad.js", "utf8")) && !/YoY/.test(fs.readFileSync("./src/adi/entrega/prioridad.js", "utf8").replace(/\/\*[\s\S]*?\*\//g, "")), "la lente «crecimiento» ordena por la variación EN % en todos los caminos con UNA función de la pieza (57a/b: `prioridadPorMedidaParcial`); su medida es solo `variacion`, nunca la variación en dinero");
  const f2 = fs.readFileSync("./scripts/consolidacion/familias/f2_servido.mjs", "utf8");
  ok(!/from\s+["'][^"']*entrega\/servidas/.test(f2) && !/^\s*import[^\n]*servidas\.js/m.test(f2), "el control de la F2 NO importa la pieza (`entrega/servidas.js`): lee la Entrega y el dato");
  ok(/from "\.\/servidas\.js"/.test(comp), "componer.js le pregunta a la pieza de lo servido");
  ok(!/_figDeRankingOCero|_declararCifraFaltanteDeFoto = \(p, planF, ejeDeProductor\)/.test(comp) && !/AUSENTE_VALE_CERO/.test(comp), "componer.js ya no completa filas ni cuenta ceros por su cuenta (la pieza y la declaración de cobertura por fuente)");
  const hay = (r) => { const out = []; const rec = (d) => { for (const n of fs.readdirSync(d, { withFileTypes: true })) { const p = d + "/" + n.name; if (n.isDirectory()) rec(p); else if (/\.(js|jsx|mjs)$/.test(n.name) && /AUSENTE_VALE_CERO\s*[=\[.]|AUSENTE_VALE_CERO\.includes|import[^;]*AUSENTE_VALE_CERO/.test(fs.readFileSync(p, "utf8"))) out.push(p); } }; rec(r); return out; };
  ok(hay("./src").length === 0, "AUSENTE_VALE_CERO ya no existe en el código: la lista por métrica pasó a ser la declaración de cobertura por fuente (config/contract/coberturaDeFuentes.js)", hay("./src").join(", "));
}

{
  const f3 = fs.readFileSync("./scripts/consolidacion/familias/f3_referencia.mjs", "utf8"), ref = fs.readFileSync("./src/adi/entrega/referencias.js", "utf8");
  const comp = fs.readFileSync("./src/adi/entrega/componer.js", "utf8"), lec = fs.readFileSync("./src/adi/encargo/lecturasDe.js", "utf8");
  ok(!/from\s+["'][^"']*entrega\/referencias/.test(f3) && !/^\s*import[^\n]*referencias\.js/m.test(f3), "el control de la F3 NO importa la pieza (`entrega/referencias.js`): lee la Entrega, la resolución y el dato");
  ok(/from "\.\/referencias\.js"/.test(comp) && /referenciasDeLaConsulta\(/.test(comp) && /referenciaDelMarco\(/.test(comp) && /referenciasOficiales\(\{ partesUtiles, premisas, I \}\)/.test(ref), "componer.js le pregunta a la pieza de la referencia de la consulta (las declaraciones) y de la referencia oficial del Marco (que a su vez usa `referenciasOficiales`)");
  ok(!/_REFERENCIA_FAMILIAS/.test(comp) && /export const REFERENCIA_FAMILIAS/.test(ref), "la tabla de familias de referencia vive UNA vez, en la pieza (no en componer.js)");
  ok(!/no se declara nada a medias/.test(ref), "la pieza no calla un error de evidencia: ningún `catch` que descarte sin declarar");
  ok(/_callsDeConjuntosDePartes/.test(lec) && /_conceptosDeConjuntos\(/.test(lec), "lecturasDe pide la evidencia del conjunto de la casa para las PARTES con la misma función que para las premisas");
}

{
  /* F4 · el control no importa la pieza; los sitios del rótulo le preguntan a ella (y ya no escriben el rótulo crudo ni uno a mano) */
  const f4 = fs.readFileSync("./scripts/consolidacion/familias/f4_rotulo.mjs", "utf8"), rot = fs.readFileSync("./src/adi/entrega/rotulos.js", "utf8");
  const comp = fs.readFileSync("./src/adi/entrega/componer.js", "utf8"), pri = fs.readFileSync("./src/adi/entrega/prioridad.js", "utf8"), ini = fs.readFileSync("./src/adi/entrega/iniciativa.js", "utf8"), ref = fs.readFileSync("./src/adi/entrega/referencias.js", "utf8");
  ok(!/from\s+["'][^"']*entrega\/rotulos/.test(f4) && !/^\s*import[^\n]*rotulos\.js/m.test(f4), "el control de la F4 NO importa la pieza (`entrega/rotulos.js`): lee la Entrega y el dato");
  ok(/from "\.\/rotulos\.js"/.test(comp) && /from "\.\/rotulos\.js"/.test(pri) && /from "\.\/rotulos\.js"/.test(ini), "componer, prioridad e iniciativa le preguntan a la pieza del rótulo");
  ok(/export function filaDeCifra/.test(rot) && /filaDeCifra\(\{/.test(comp) && !/valores: \{ "Entidad \/ grupo": entidad, "Tema"/.test(comp), "la fila de Cifras la construye UNA función de la pieza (`filaDeCifra`), no `componer.js`");
  ok(!/^const _conceptoDeLabel = \(label\)/m.test(comp) && !/^const _claveDeFig = \(fig\) => \{/m.test(comp) && !/^const _labelDeClave = \(clave\) => \{/m.test(comp) && !/^const _conceptoDeLabel = \(label\)/m.test(pri), "ni componer.js ni prioridad.js definen su propio concepto-de-rótulo, clave de fig o rótulo de clave: son los de la pieza");
  ok(!/String\(PL\.metrica\)\.toLowerCase/.test(comp) && !/"Participación del vencido total"/.test(comp) && !/"Diferencia · materialidad"/.test(comp) && !/`Diferencia · \$\{p\.concepto\}`/.test(comp), "la oración y la fila de la medida de la lente, la concentración y la diferencia de la tabla de señales ya no escriben su rótulo a mano");
  ok(!/nombre: "(?:saldo vencido|capital inmovilizado crítico|contribución no capturada|venta)"/.test(pri) && !/_conceptoDeLabel\(_lab\(f\)\)\.toLowerCase\(\)/.test(pri), "prioridad.js no escribe a mano el nombre de la medida de cada lente ni el rótulo crudo de la cifra: los pide a la pieza");
  ok(!/columnas = \["Cliente", "(?:Venta|Saldo pendiente)"/.test(comp) && !/columnas = \["SKU", "Bodega", "Capital inmovilizado"/.test(comp), "los encabezados de las tablas de las rutas fijas son los rótulos del léxico (la pieza), no literales");
  ok(!/etiqueta: clave \? null : _conceptoDeLabel/.test(comp), "una fig sin clave en el léxico ya no se imprime con su rótulo crudo (se declara)");
  /* F3 · cierre dentro del compositor: la referencia oficial del Marco y la procedencia de los umbrales son de la pieza */
  ok(/referenciaDelMarco\(/.test(comp) && /procedenciaDeLosUmbrales\(/.test(comp) && /export function referenciaDelMarco/.test(ref) && /export function procedenciaDeLosUmbrales/.test(ref), "componer.js le pregunta a la pieza por la referencia oficial del Marco y por la procedencia de los umbrales");
  ok(!/_BASE_BENCHMARK_RE/.test(comp) && !/const nivelEnJuego/.test(comp) && !/umbralesDeEstados\(\[\.\.\.estadosEnJuego\]\)/.test(comp), "componer.js ya no decide por su cuenta cuándo el Marco declara el benchmark, el nivel de carga o la procedencia de un umbral");
  ok(!/`Benchmark de margen(?: \(comercial\))?: \$\{/.test(comp) && !/Umbral de materialidad de la empresa/.test(comp), "ni las rutas fijas ni el multitema escriben a mano la frase del benchmark o del piso de materialidad: salen de la pieza");
}

{
  /* F5 · el control no importa la pieza; `componerEntrega` pasa TODA Entrega por ella; la tercera copia de la regla 18 (acciones.js) ya no existe */
  const f5 = fs.readFileSync("./scripts/consolidacion/familias/f5_verificador.mjs", "utf8"), comp = fs.readFileSync("./src/adi/entrega/componer.js", "utf8"), acc = fs.readFileSync("./src/adi/capacidad/acciones.js", "utf8"), aus = fs.readFileSync("./src/config/contract/ausencias.js", "utf8");
  ok(!/^\s*import[^\n]*componer\.js/m.test(f5) && !/servirConGarantia\(/.test(f5), "el control de la F5 NO importa la pieza (`servirConGarantia`): el oráculo es `verificarEntrega` sobre lo servido");
  ok(/return servirConGarantia\(r, resolucion\);/.test(comp) && /verificarEntrega\(\{ texto: s\.texto, entrega: s\.entrega, resolucion, indice, profundidad \}\)/.test(comp), "componerEntrega pasa la Entrega por `servirConGarantia`, que corre `verificarEntrega` con la resolución, el índice del turno y la profundidad");
  ok(!/verificarEntrega/.test(acc.replace(/\/\*[\s\S]*?\*\//g, "")) && !/universo-propio-no-coincide/.test(acc), "`acciones.consultar` ya no audita por su cuenta (la tercera copia de la regla 18 se borró)");
  ok(/export function textoOracionRetirada/.test(aus) && /export const MOTIVO_ORACION_RETIRADA/.test(aus) && /textoOracionRetirada\(/.test(comp) && !/no pasó la verificación/.test(comp), "el límite de una oración retirada sale de `config/contract/ausencias.js` (la pieza no escribe su texto)");
  const ver = fs.readFileSync("./src/adi/entrega/verificar.js", "utf8");
  ok(/\{ oraciones \}|oraciones = null/.test(ver) && !/respuesta\\\[\(\\d\+\)\\\]/.test(comp), "la pieza lee de la ESTRUCTURA qué oraciones rechaza el verificador (`violacion.oraciones`), nunca parsea la prosa del detalle");
}

{
  /* segunda vuelta · el eje es de cada parte: el cableado de las piezas (estático) */
  const lec = fs.readFileSync("./src/adi/encargo/lecturasDe.js", "utf8"), comp = fs.readFileSync("./src/adi/entrega/componer.js", "utf8"), cdd = fs.readFileSync("./src/adi/agente/contratoDeDominios.js", "utf8"), f2 = fs.readFileSync("./scripts/consolidacion/familias/f2_servido.mjs", "utf8"), f1 = fs.readFileSync("./scripts/consolidacion/familias/f1_prioridad.mjs", "utf8");
  ok(/ejesPorDominio/.test(lec) && /pasosDeDominios\(\{ dominios, eje, ejesPorDominio \}\)/.test(lec) && /ejesPorDominio = null/.test(cdd), "lecturasDe le pasa a `pasosDeDominios` el eje de CADA dominio (`ejesPorDominio`), no el primer eje explícito de cualquier parte para todos");
  ok(/partesDelPlanDelTema/.test(comp) && /_planMultiTema\(temas, figsDelGrupo/.test(comp), "componer.js: el plan del tema (quién más pesa) solo recibe las partes de eje por defecto; una parte con eje explícito tiene su propio grupo");
  ok(!/from\s+["'][^"']*entrega\/(?:servidas|prioridad|rotulos|referencias)/.test(f2) && /base\.publica/.test(f2) && /primero-fuera-del-eje/.test(f1), "los controles nuevos (eje-servido, foto, sin-dato-con-dato-publicado) leen el dato publicado por el Core (`base.publica`), no las piezas de composición");
}

H("6 · cero red");
ok(clasificarFuente(fs.readFileSync("./_invariantes_consolidacion_gate.mjs", "utf8")).tipo === "offline", "este gate se clasifica OFFLINE (ni una sola llamada de red)");

console.log(`\n── _invariantes_consolidacion_gate: PASS ${pass} · FAIL ${fail} (de ${pass + fail}) ──`);
if (fail > 0) process.exit(1);
