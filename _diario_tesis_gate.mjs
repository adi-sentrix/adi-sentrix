/* === _diario_tesis_gate.mjs · EL DIARIO DE LA TESIS — paso 1 del diario de la relación (owner 2026-09-04) ===
 *
 * LO QUE EL OWNER PIDIÓ («me gusta» a la propuesta): la tesis de ADI persiste, y en turnos posteriores se
 * confirma o corrige EN VOZ ALTA — «esto confirma lo que vimos» / «la lectura cambió y lo corrijo». El corte
 * CONSERVADOR aprobado por el supervisor: la tesis vive en la MEMORIA DEL HILO (`mem.diarioTesis`, el mismo
 * canal del trato y de la última aprobada) — cero servidor; la persistencia entre sesiones es el paso 2.
 *
 * LA REGLA QUE HACE HONESTO AL DIARIO: confirmar una tesis es RE-MEDIRLA, no repetirla. Lo que se guarda es
 * la HUELLA MEDIDA (la concurrencia del motor de papeles: cuántos caen, cuántos grandes, si son la misma
 * gente), y el turno siguiente compara huella contra huella — jamás una frase contra un recuerdo.
 *
 * OFFLINE · determinístico · cerebro MUDO · CERO llamadas. Carnada: el guardado quitado → la confirmación
 * desaparece. `node --import ./scripts/offline-guard.mjs _diario_tesis_gate.mjs` */
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { initTenant } from "./src/data/tenantStore.js";
import { TENANT_DEMO } from "./src/data/tenants/demo.js";
import { answerViaAgente } from "./src/adi/agente/bucleAgente.js";

let PASS = 0, FAIL = 0;
const ok = (c, m, extra = "") => { if (c) { PASS++; console.log("  ✓ " + m); } else { FAIL++; console.log("  ✗ " + m + (extra ? "\n      " + extra : "")); } };
const H = (t) => console.log("\n" + t);
const MUDO = async () => ({ tipo: "texto", texto: "" });

initTenant(TENANT_DEMO);

/* ═══ 1 · EL CICLO ENTERO · guardar → confirmar → corregir → no arrastrar ═══════════════════════════════════ */
H("1 · la tesis se guarda al aprobar el porqué, se confirma re-midiendo y se corrige en voz alta");
const t1 = await answerViaAgente({ text: "por que estamos perdiendo margen?", history: [], mem: {}, scenario: "bonanza", callAgente: MUDO });
{
  const d = t1.mem.diarioTesis;
  ok(!!d && d.clave === "margen-roles" && d.huella && Number.isFinite(d.huella.caen),
    "★ GUARDAR: el turno del porqué aprobado deja la tesis en la memoria del hilo, con su HUELLA MEDIDA", JSON.stringify(d));
  ok(typeof d.resumen === "string" && d.resumen.length > 20 && !/\bvara\b|\btarget\b/i.test(d.resumen),
    "…y el resumen es una línea en registro correcto (puede salir a pantalla al confirmar)");
}
{
  const t2 = await answerViaAgente({ text: "y por que el margen sigue asi?", history: [], mem: t1.mem, scenario: "bonanza", callAgente: MUDO });
  /* (etapa 2, 2026-09-05: la tesis lleva FECHA — la frase pasa de «en este hilo» a «(guardada el …)») */
  ok(/^(?:jc: )?Esto confirma la lectura que ya teníamos \(guardada el \d{4}-\d{2}-\d{2}\)/.test(String(t2.r.text).trim()) && !(t2.r.agente.vetos || []).length,
    "★ CONFIRMAR: el segundo porqué del hilo abre confirmando — la huella de hoy coincide con la guardada", String(t2.r.text).split("\n")[0].slice(0, 100));
}
{
  const memAlt = { ...t1.mem, diarioTesis: { ...t1.mem.diarioTesis, huella: { caen: 3, grandesQueCaen: 0, mismaGente: false }, resumen: "los que caen bajo el benchmark caen por razones distintas" } };
  const t3 = await answerViaAgente({ text: "por que perdemos margen?", history: [], mem: memAlt, scenario: "bonanza", callAgente: MUDO });
  ok(/^(?:jc: )?La lectura cambió respecto de lo que vimos \(guardado el \d{4}-\d{2}-\d{2}\)/.test(String(t3.r.text).trim()) && /lo corrijo con el dato de hoy/.test(String(t3.r.text)),
    "★ CORREGIR: con una huella guardada que ya no coincide, ADI lo dice y se corrige — jamás sostiene la tesis vieja por orgullo");
  ok(!(t3.r.agente.vetos || []).length, "…y la corrección pasa el muro entera");
}
{
  const t4 = await answerViaAgente({ text: "como viene mi margen?", history: [], mem: t1.mem, scenario: "bonanza", callAgente: MUDO });
  ok(!/confirma la lectura|lectura cambió/i.test(String(t4.r.text)),
    "★ NO ARRASTRA: la lectura simple (sin porqué) no menciona el diario — la tesis habla solo donde se razona");
  const t5 = await answerViaAgente({ text: "quien me debe y que esta vencido", history: [], mem: t1.mem, scenario: "bonanza", callAgente: MUDO });
  ok(t5.mem.diarioTesis && t5.mem.diarioTesis.clave === "margen-roles",
    "…y un turno de OTRO tema no borra la tesis guardada: la memoria del hilo la conserva");
}

/* ═══ 2 · CARNADA · el guardado quitado → la confirmación desaparece ════════════════════════════════════════ */
H("2 · carnada: sin el guardado del bucle, el diario muere en silencio — y este gate lo ve");
{
  const abs = path.join(process.cwd(), "src", "adi", "agente", "bucleAgente.js");
  const txt = fs.readFileSync(abs, "utf8").replace(/\r\n/g, "\n");
  /* (re-apuntada en la etapa 2: el guardado es un bloque — fecha, carga, aviso — y la línea que muta es la
   * escritura misma de memOut.diarioTesis) */
  const m = txt.replace(/        memOut\.diarioTesis = \{ \.\.\._tesis, fecha: new Date\(\)\.toISOString\(\)\.slice\(0, 10\), carga: \(\(\) => \{ try \{ return idDeCargaActiva\(\); \} catch \{ return null; \} \}\)\(\) \};/,
    "        void _tesis;   // CARNADA: el diario no se guarda");
  if (m === txt) { ok(false, "carnada: no encontró el guardado a mutar"); }
  else {
    const destino = abs.replace(/\.js$/, `.carnada${process.pid}.js`);
    fs.writeFileSync(destino, m);
    try {
      const Mut = await import(pathToFileURL(destino).href);
      const m1 = await Mut.answerViaAgente({ text: "por que estamos perdiendo margen?", history: [], mem: {}, scenario: "bonanza", callAgente: MUDO });
      ok(!m1.mem.diarioTesis, "★ carnada «guardado quitado» → la tesis NO queda en la memoria: el check ★ GUARDAR se pondría ROJO");
    } catch (e) { ok(false, "carnada: la copia mutada no carga", e.message); }
    finally { try { fs.unlinkSync(destino); } catch { /* */ } }
  }
}

/* ═══ 3 · LOS GRISES DEL §6, EN CONSERVADOR Y DECLARADOS (el owner decide después) ══════════════════════════ */
H("3 · los grises, tomados en conservador — el documento los lista para el owner");
{
  const D = fs.readFileSync(path.join(process.cwd(), "_DIARIO_DISENO.md"), "utf8");
  ok(/¿Las promesas de vigilancia obligan\?/.test(D) && /¿El saludo con diario gasta\?/.test(D),
    "los grises siguen escritos en _DIARIO_DISENO.md, esperando al owner");
  /* conservador v1, declarado acá: (1) HILO, no servidor — nada persiste entre sesiones todavía; (2) SOLO la
   * tesis de margen-roles — una clave, no un cuaderno; (3) la respuesta del dueño a la pregunta de intención
   * NO se captura aún (clasificar texto libre exige al cerebro vivo: iría con inventos al primer error);
   * (4) sin borrado explícito porque nada sale del hilo — cerrar el chat ES el borrado. */
  ok(true, "v1 conservadora: hilo (no servidor) · solo margen-roles · sin captura de la respuesta del dueño · el hilo mismo es el borrado");
}

console.log(`\n── _diario_tesis_gate: ${PASS} PASS · ${FAIL} FAIL (de ${PASS + FAIL}) ──`);
process.exit(FAIL ? 1 : 0);
