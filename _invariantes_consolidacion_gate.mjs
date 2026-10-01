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
const ABIERTAS_CONGELADAS = {};   /* la F1 las cerró con la condición del §7.3·53: «por riesgo integrado: X» vale cuando X es el primero del plan de señales de ese dominio (107 de 107 la cumplen en el corpus completo, 0 violaciones reales) */

const base = await cargarBase();
const familias = await cargarFamilias();

H("0 · la infraestructura: marco, familias, generador");
ok(familias.length >= 3 && familias.some((f) => f.id === "F1") && familias.some((f) => f.id === "F2") && familias.some((f) => f.id === "F3"), `el marco carga las familias registradas (${familias.map((f) => f.id).join(", ")})`);
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
  ok(/from "\.\/referencias\.js"/.test(comp) && /referenciasDeLaConsulta\(/.test(comp) && /referenciasOficiales\(/.test(comp), "componer.js le pregunta a la pieza de la referencia de la consulta (las declaraciones y las oficiales del Marco)");
  ok(!/_REFERENCIA_FAMILIAS/.test(comp) && /export const REFERENCIA_FAMILIAS/.test(ref), "la tabla de familias de referencia vive UNA vez, en la pieza (no en componer.js)");
  ok(!/no se declara nada a medias/.test(ref), "la pieza no calla un error de evidencia: ningún `catch` que descarte sin declarar");
  ok(/_callsDeConjuntosDePartes/.test(lec) && /_conceptosDeConjuntos\(/.test(lec), "lecturasDe pide la evidencia del conjunto de la casa para las PARTES con la misma función que para las premisas");
}

H("6 · cero red");
ok(clasificarFuente(fs.readFileSync("./_invariantes_consolidacion_gate.mjs", "utf8")).tipo === "offline", "este gate se clasifica OFFLINE (ni una sola llamada de red)");

console.log(`\n── _invariantes_consolidacion_gate: PASS ${pass} · FAIL ${fail} (de ${pass + fail}) ──`);
if (fail > 0) process.exit(1);
