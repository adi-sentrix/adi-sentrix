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
 *   5 · INDEPENDENCIA Y CABLEADO (estático) — el control de la F1 no importa la pieza; ningún sitio de la F1 conserva su propia decisión
 *       (las helpers viven en `entrega/prioridad.js`) ni lee la oración de prioridad con una expresión regular sobre la prosa.
 *   6 · CERO red.
 *
 * Solo por `npm run gates:offline` o `node --import ./scripts/offline-guard.mjs _invariantes_consolidacion_gate.mjs`. */
import fs from "node:fs";
import { cargarBase } from "./scripts/consolidacion/base.mjs";
import { cargarCatalogos, armarCorpus, entregaDe } from "./scripts/consolidacion/corpus.mjs";
import { generarEncargos } from "./scripts/consolidacion/generador.mjs";
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
const ABIERTAS_CONGELADAS = { "F1:riesgo-pedido-corona-por-riesgo-integrado": 11, "F1:lente-de-otro-dominio-corona-por-riesgo-integrado": 14 };

const base = await cargarBase();
const familias = await cargarFamilias();

H("0 · la infraestructura: marco, familias, generador");
ok(familias.length >= 1 && familias.some((f) => f.id === "F1"), `el marco carga las familias registradas (${familias.map((f) => f.id).join(", ")})`);
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

H("1 · el corpus: los catálogos v13–v28 y la muestra fija del azar");
const catalogos = cargarCatalogos();
ok(catalogos.length >= 1600, `los catálogos v13–v28: ${catalogos.length} encargos`);
const { casos: corpusAzar } = await armarCorpus(base, { catalogos: false, azar: { semilla: SEMILLA_GATE, n: N_MUESTRA } });
const corpus = [...catalogos, ...corpusAzar];
ok(corpusAzar.length === N_MUESTRA, `la muestra fija del azar: ${corpusAzar.length} encargos (semilla «${SEMILLA_GATE}»)`);

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
    rojo(e, i, t.replace(/^(Prioridad del procedimiento dentro de este grupo, por )[^:]+(:)/, "$1riesgo integrado$2"), "riesgo-integrado-sobre-un-grupo", "«por riesgo integrado» sobre un grupo");
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

H("5 · independencia del control y cableado de la pieza (estático)");
{
  const f1 = fs.readFileSync("./scripts/consolidacion/familias/f1_prioridad.mjs", "utf8");
  ok(!/from\s+["'][^"']*entrega\/prioridad/.test(f1) && !/^\s*import[^\n]*prioridad\.js/m.test(f1), "el control de la F1 NO importa la pieza (`entrega/prioridad.js`): lee la Entrega y el dato");
  const comp = fs.readFileSync("./src/adi/entrega/componer.js", "utf8"), tam = fs.readFileSync("./src/adi/entrega/tamano.js", "utf8"), ini = fs.readFileSync("./src/adi/entrega/iniciativa.js", "utf8"), lec = fs.readFileSync("./src/adi/encargo/lecturasDe.js", "utf8");
  ok(/from "\.\/prioridad\.js"/.test(comp) && /from "\.\/prioridad\.js"/.test(tam) && /from "\.\/prioridad\.js"/.test(ini) && /from "\.\.\/entrega\/prioridad\.js"/.test(lec), "componer, tamano, iniciativa y lecturasDe le preguntan a la pieza");
  ok(!/^(?:const|function) _(?:lenteDelGrupo|primeroDeAtencion|atencionEsElMenor|lenteOrdenaLaClave|lenteDeLaLista|nombreVisibleDeLente|lenteIdDelCriterio)\b/m.test(comp), "componer.js ya no decide por su cuenta (las helpers de la prioridad viven en la pieza)");
  ok(!/_MARCADOR_CONCLUSION/.test(comp) && !/_MARCADOR_CONCLUSION/.test(tam) && !/_entidadPrioritariaDeEntrega/.test(comp), "ni componer.js ni tamano.js leen «cuál es la oración de prioridad» con una expresión regular: leen la marca");
  ok(!/Prioridad del procedimiento, por \[\^:\]/.test(comp), "la expresión regular que extraía a la entidad prioritaria del texto ya no existe");
  ok(!/_CONCEPTO_DE_LA_MEDIDA\s*=\s*\{/.test(lec), "lecturasDe.js no tiene su propia tabla lente → medida: usa la de la pieza");
}

H("6 · cero red");
ok(clasificarFuente(fs.readFileSync("./_invariantes_consolidacion_gate.mjs", "utf8")).tipo === "offline", "este gate se clasifica OFFLINE (ni una sola llamada de red)");

console.log(`\n── _invariantes_consolidacion_gate: PASS ${pass} · FAIL ${fail} (de ${pass + fail}) ──`);
if (fail > 0) process.exit(1);
