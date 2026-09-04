/* === _diario_persistente_gate.mjs · LA MEMORIA ENTRE SESIONES (DIARIO ETAPA 2 · owner GO 2026-09-05) ========
 *
 * EL VALOR QUE EL OWNER NOMBRÓ: que ADI llegue el lunes recordando la tesis del jueves y las respuestas de
 * intención del dueño, y que confirme o corrija RE-MIDIENDO — jamás repitiendo de memoria. Este gate cubre lo
 * que se puede verificar SIN base real (la RPC va mockeada, el patrón del gate de plazos): el capturador con
 * sus NEGATIVOS, el round-trip, EL MURO (el pase es del tenant de la sesión — nunca del body), la caducidad
 * re-midiendo, el olvido que borra, y las carnadas. La prueba EN VIVO (migración 007 + los 4 pasos del owner)
 * queda declarada en `_DIARIO_ETAPA2_PLAN.md` §6.
 *
 * OFFLINE · determinístico · cero red (offline-guard vigila).
 * `node --import ./scripts/offline-guard.mjs _diario_persistente_gate.mjs` */
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { initTenant } from "./src/data/tenantStore.js";
import { TENANT_DEMO } from "./src/data/tenants/demo.js";
import { answerViaAgente } from "./src/adi/agente/bucleAgente.js";
import { declararDiario, diarioLimpio } from "./src/ingesta/persistirCarga.server.js";

let pass = 0, fail = 0;
const ok = (c, m, extra = "") => { if (c) { pass++; console.log("  ✓ " + m); } else { fail++; console.log("  ✗ " + m + (extra ? "\n      " + String(extra).slice(0, 200) : "")); } };
const H = (t) => console.log("\n" + t);
const MUDO = async () => ({ tipo: "texto", texto: "" });
const root = process.cwd();

initTenant(TENANT_DEMO);

/* ═══ 1 · EL CICLO DEL HILO · guardar → citar → caducar → olvidar (todo re-midiendo) ═══════════════════════ */
H("1 · el ciclo: la tesis se guarda con fecha y carga, la intención como CITA, y nada se afirma sin re-medir");
const r1 = await answerViaAgente({ text: "por qué estamos perdiendo margen", history: [], mem: {}, scenario: "actual", callAgente: MUDO });
{
  const T = r1.mem.diarioTesis;
  ok(!!T && T.clave === "margen-roles" && /^\d{4}-\d{2}-\d{2}$/.test(String(T.fecha)) && "carga" in T,
    "★ la tesis del porqué se guarda CON fecha y con la identidad de la carga", JSON.stringify(T));
  ok(r1.mem.diarioCambio === true, "…y deja la marca `diarioCambio` para que el caller persista");
  ok(/\(Me guardo esta lectura para la próxima\.\)/.test(String(r1.r.text || "")),
    "★ y el guardado SE AVISA en una línea — la memoria no es secreta");
}
const HILO1 = [{ role: "user", text: "por qué estamos perdiendo margen" }, { role: "assistant", text: String(r1.r.text || "") }];
let r2;
{
  let llamadas = 0;
  const espia = async () => { llamadas++; return { tipo: "texto", texto: "" }; };
  r2 = await answerViaAgente({ text: "sí, es apuesta mía — lo estoy empujando yo", history: HILO1, mem: r1.mem, scenario: "actual", callAgente: espia });
  const i = (r2.mem.intenciones || [])[0];
  ok(llamadas === 0 && r2.r.agente.estado === "intencion",
    `★ la respuesta de intención se captura SIN gastar (${llamadas} llamadas · estado «${r2.r.agente.estado}»)`);
  ok(!!i && i.cita === "sí, es apuesta mía — lo estoy empujando yo" && i.pregunta === "volumen_deliberado",
    "★ y se guarda como CITA textual del dueño — jamás un resumen del modelo", JSON.stringify(i));
  ok(Array.isArray(i && i.entidades) && i.entidades.length >= 1,
    "…con las entidades de la pregunta que respondía (afirmó sin nombrar a nadie)");
  /* la entidad de la CITA manda cuando el dueño nombra a otro (medido al estrenar: preguntaron por Falabella
   * y Jumbo, respondió sobre Lider — anotarlo bajo los preguntados desalineaba su palabra) */
  const rCruz = await answerViaAgente({ text: "el volumen de Lider es apuesta mía, lo decidí yo", history: HILO1, mem: r1.mem, scenario: "actual", callAgente: MUDO });
  ok(JSON.stringify(((rCruz.mem.intenciones || [])[0] || {}).entidades) === JSON.stringify(["Lider"]),
    "★ y si su frase nombra a OTRO, la cita se anota bajo el nombre que ÉL dijo");
}
H("1b · los NEGATIVOS del capturador: ante la duda, no se guarda");
{
  const n1 = await answerViaAgente({ text: "el volumen de Lider es apuesta mía", history: [], mem: {}, scenario: "actual", callAgente: MUDO });
  ok(n1.r.agente.estado !== "intencion" && !(n1.mem.intenciones || []).length,
    "sin la pregunta emitida en el turno anterior, la frase NO se anota (nadie preguntó)");
  const n2 = await answerViaAgente({ text: "no sé, dime tú qué opinas del volumen", history: HILO1, mem: r1.mem, scenario: "actual", callAgente: MUDO });
  ok(n2.r.agente.estado !== "intencion", "una respuesta que NO afirma no se anota");
  const n3 = await answerViaAgente({ text: "sí, es apuesta mía. " + "bla ".repeat(80), history: HILO1, mem: r1.mem, scenario: "actual", callAgente: MUDO });
  ok(n3.r.agente.estado !== "intencion", "…y un turno largo tampoco: la cita es una frase, no un discurso");
}
H("1c · la cita reemplaza la re-pregunta; la caducidad re-mide; el olvido borra");
{
  const r3 = await answerViaAgente({ text: "profundiza en el porqué pasa", history: HILO1, mem: r2.mem, scenario: "actual", callAgente: MUDO });
  const t3 = String(r3.r.text || "");
  ok(/tu palabra ya está anotada/.test(t3) && /«sí, es apuesta mía — lo estoy empujando yo»/.test(t3),
    "★ el porqué siguiente CITA la palabra guardada (con su fecha) en vez de re-preguntar", t3.slice(0, 120));
  ok(!/apuesta tuya —rotación y liquidez— o se te fue/.test(t3), "…y la pregunta NO se repite");

  const memOtraCarga = { ...r2.mem, diarioTesis: { ...r2.mem.diarioTesis, carga: "vieja.xlsx@2026-08-01" } };
  const r4 = await answerViaAgente({ text: "por qué estamos perdiendo margen", history: [], mem: memOtraCarga, scenario: "actual", callAgente: MUDO });
  ok(/era de tu carga anterior/.test(String(r4.r.text || "")),
    "★ una tesis de OTRA carga se DICE de la carga anterior — y se re-mide contra la de hoy");
  const memVieja = { ...r2.mem, diarioTesis: { ...r2.mem.diarioTesis, fecha: "2026-07-20" } };
  const r5 = await answerViaAgente({ text: "por qué estamos perdiendo margen", history: [], mem: memVieja, scenario: "actual", callAgente: MUDO });
  ok(/pasó más de un mes: no la doy por vigente/.test(String(r5.r.text || "")),
    "★ una tesis de 30+ días NO se afirma: se ofrece retomar y la lectura de hoy va sola (la regla del owner)");

  const r6 = await answerViaAgente({ text: "olvida todo lo que guardaste", history: [], mem: r2.mem, scenario: "actual", callAgente: MUDO });
  ok(r6.r.agente.estado === "olvido" && r6.mem.diarioTesis === null && Array.isArray(r6.mem.intenciones) && !r6.mem.intenciones.length && r6.mem.diarioCambio === true,
    "★ «olvida todo lo que guardaste» borra tesis e intenciones y marca la persistencia del borrado");
  ok(/no lo puedo deshacer/.test(String(r6.r.text || "")) && /una carga nueva no lo revive/.test(String(r6.r.text || "")),
    "…y lo dice sin maquillaje: definitivo, y la carga nueva no lo revive");
  const r7 = await answerViaAgente({ text: "por qué estamos perdiendo margen", history: [], mem: r6.mem, scenario: "actual", callAgente: MUDO });
  ok(!/guardamos|guardad[ao] el/.test(String(r7.r.text || "")), "…y el porqué siguiente ya no recuerda nada");
  const r8 = await answerViaAgente({ text: "olvida mi margen mínimo", history: [], mem: {}, scenario: "actual", callAgente: MUDO });
  ok(r8.r.agente.estado === "criterio", "…y «olvida mi margen mínimo» sigue siendo del CRITERIO — los dos olvidos no se pisan");
}

/* ═══ 2 · EL SERVER · diarioLimpio, el round-trip y EL MURO (el pase es de la sesión, jamás del body) ══════ */
H("2 · el server: lo que no se entiende se descarta, el round-trip devuelve lo GUARDADO, y el pase es del tenant");
{
  const sucio = { tesis: { clave: "margen-roles", resumen: "x".repeat(999), huella: { caen: 4 }, fecha: "2026-09-05T10:00:00Z", carga: null },
    intenciones: [{ cita: "el volumen es apuesta mía", pregunta: "volumen_deliberado", entidades: ["Lider"], fecha: "2026-09-05" }, { malo: true }, "basura"],
    basura: "no va" };
  const limpio = diarioLimpio(sucio);
  ok(limpio.tesis.resumen.length === 300 && limpio.tesis.fecha === "2026-09-05" && !("basura" in limpio),
    "diarioLimpio recorta, normaliza la fecha y descarta lo que no entiende — nunca aproxima");
  ok(limpio.intenciones.length === 1 && limpio.intenciones[0].cita === "el volumen es apuesta mía",
    "…y una intención malformada se DESCARTA, no se repara");

  let capturado = null;
  const mockDb = { llamarFuncion: async (fn, args, opts) => { capturado = { fn, args, pase: opts && opts.pase }; return { ok: true, filas: [{ version: 7, diario: args.p_diario }] }; } };
  const rr = await declararDiario({ tenantId: "empresa-a", diario: sucio, actor: { label: "jc" }, env: { SUPABASE_JWT_SECRET: "secreto-de-prueba" }, cliente: mockDb });
  ok(rr.declarada === true && rr.version === 7 && Object.keys(rr.diario).sort().join(",") === "intenciones,tesis",
    "el round-trip devuelve lo que QUEDÓ guardado (limpio), no lo que se mandó");
  ok(capturado && capturado.fn === "adi_escribir_diario" && typeof capturado.pase === "string" && capturado.pase.length > 10,
    "la escritura viaja con PASE firmado — sin pase no hay RPC");
  /* EL MURO: el pase se emite con el tenant de LA SESIÓN (declararDiario recibe el tenantId que el servidor
   * resolvió del access — la op ignora cualquier tenant del body). El payload del JWT lo prueba. */
  const payload = JSON.parse(Buffer.from(capturado.pase.split(".")[1], "base64url").toString("utf8"));
  ok((payload.tenant_id || payload.tenantId) === "empresa-a",
    "★ EL MURO: el pase lleva el tenant de la sesión — la empresa B jamás puede escribir el diario de A", JSON.stringify(payload));
  const sinSesion = await declararDiario({ tenantId: null, diario: sucio, env: {}, cliente: mockDb });
  ok(sinSesion.declarada === false, "…y sin sesión con empresa, no hay escritura");
}

/* ═══ 3 · LA CADENA ESTÁTICA · la 007, la op, el arrastre y la siembra existen y dicen la verdad ═══════════ */
H("3 · la cadena: migración → op → arrastre → siembra (estático, cada eslabón)");
{
  const sql = fs.readFileSync(path.join(root, "db", "migraciones", "007_diario.sql"), "utf8");
  ok(/adi_escribir_diario/.test(sql) && /adi_leer_diario/.test(sql) && /perfil,diario/.test(sql),
    "la 007 declara leer y escribir `perfil.diario` en la versión activa (el patrón de la 006)");
  ok(/jsonb_array_length\(p_diario->'intenciones'\) > 10/.test(sql) && /pg_column_size\(p_diario\) > 16384/.test(sql),
    "…y la base valida FORMA y TAMAÑO — una regla solo-servidor es una costumbre, no una garantía");
  const ing = fs.readFileSync(path.join(root, "src", "ingesta", "handleIngesta.server.js"), "utf8");
  ok(/body\.op === "diario"/.test(ing) && /declararDiario\(\{ tenantId: s\.tenantId/.test(ing),
    "la op «diario» va por la puerta de siempre, con el tenant DE LA SESIÓN");
  const per = fs.readFileSync(path.join(root, "src", "ingesta", "persistirCarga.server.js"), "utf8");
  ok(/diarioAnterior/.test(per) && /diario: diarioAnterior/.test(per),
    "el arrastre lleva el diario a la versión siguiente — el producto no se olvida todos los meses");
  const chat = fs.readFileSync(path.join(root, "src", "ui", "ChatADI.jsx"), "utf8");
  ok(/perfil && .*\.perfil\.diario/.test(chat) && /diarioTesis: d\.tesis/.test(chat),
    "la siembra lee `perfil.diario` del pack (ni un fetch nuevo) y alimenta el mem del hilo");
  ok(/op: "diario", diario, access: getAccessCode\(\)/.test(chat) && /el diario no se persistió/.test(chat),
    "…y el turno que cambió el diario lo persiste por la puerta, con rastro si falla (jamás mudo)");
}

/* ═══ 4 · CARNADAS · cada garantía, probada ROJA con el defecto adentro ════════════════════════════════════ */
H("4 · CARNADA · el capturador ancho, el afirmar-sin-re-medir y el olvido que no borra");
{
  const tmp = [];
  let nCar = 0;
  /* sufijo ÚNICO por carnada: el import de ESM cachea por URL — dos copias con el mismo nombre hacían que la
   * segunda carnada importara el módulo de la PRIMERA y diera «desapercibido» (medido al estrenar este gate). */
  const mutar = (rel, re, a) => {
    const abs = path.join(root, rel);
    const txt = fs.readFileSync(abs, "utf8").replace(/\r\n/g, "\n");
    const m = txt.replace(re, a);
    if (m === txt) return { error: `no encontró qué mutar en ${rel}` };
    const destino = abs.replace(/\.js$/, `.carnadaD${process.pid}_${++nCar}.js`);
    fs.writeFileSync(destino, m);
    tmp.push(destino);
    return { url: pathToFileURL(destino).href };
  };
  // (a) el capturador ANCHO: sin exigir la pregunta previa, cualquier «es apuesta mía» se anota — y el gate lo ve
  {
    const m = mutar("src/adi/agente/bucleAgente.js", /if \(_mPregunta && _AFIRMA\.test\(q\) && q\.trim\(\)\.length <= 240\) \{/, "if (_AFIRMA.test(q) && q.trim().length <= 240) { const _mPregunta = [null, \"X\"];");
    if (m.error) ok(false, "carnada «capturador ancho»", m.error);
    else {
      const Mut = await import(m.url);
      initTenant(TENANT_DEMO);
      const r = await Mut.answerViaAgente({ text: "el volumen de Lider es apuesta mía", history: [], mem: {}, scenario: "actual", callAgente: MUDO });
      ok(r.r.agente.estado === "intencion", "carnada «capturador ancho (sin pregunta previa)» → el negativo 1b daría ✗: se pone ROJO", "el defecto pasó DESAPERCIBIDO");
    }
  }
  // (b) afirmar sin re-medir: la caducidad por carga vaciada — la tesis vieja vuelve a afirmarse como de hoy
  {
    const m = mutar("src/adi/agente/playbooks/margenEnRiesgo.js", /const otraCarga = \(tesisPrevia\.carga \|\| null\) !== \(cargaActual \|\| null\);/, "const otraCarga = false;   // CARNADA: toda carga es la misma");
    if (m.error) ok(false, "carnada «afirmar sin re-medir la carga»", m.error);
    else {
      const Mut = await import(m.url);
      initTenant(TENANT_DEMO);
      const t = String(Mut.margenEnRiesgo.componer({
        figs: [], pregunta: "por qué estamos perdiendo margen", semilla: "s", scenario: "actual",
        mem: { diarioTesis: { clave: "margen-roles", resumen: "r", huella: { caen: 1 }, fecha: "2026-09-01", carga: "otra@x" } },
      }) || "");
      /* con la mutación, la tesis de otra carga ya NO se declara de la carga anterior */
      ok(!/era de tu carga anterior/.test(t), "carnada «la caducidad por carga, vaciada» → el check ★ de 1c daría ✗: se pone ROJO", t.slice(0, 120));
    }
  }
  // (c) el olvido que no borra: la promesa rota más cara de una memoria persistente
  {
    const m = mutar("src/adi/agente/bucleAgente.js", /const mem2 = \{ \.\.\.memIn, diarioTesis: null, intenciones: \[\], diarioCambio: true \};/, "const mem2 = { ...memIn, diarioCambio: true };   // CARNADA: borrar no borra");
    if (m.error) ok(false, "carnada «el olvido que no borra»", m.error);
    else {
      const Mut = await import(m.url);
      initTenant(TENANT_DEMO);
      const r = await Mut.answerViaAgente({ text: "olvida todo lo que guardaste", history: [], mem: { diarioTesis: { clave: "margen-roles", huella: {} }, intenciones: [{ cita: "x" }] }, scenario: "actual", callAgente: MUDO });
      ok(!!r.mem.diarioTesis, "carnada «el olvido que no borra» → el check ★ de 1c daría ✗: se pone ROJO", "el defecto pasó DESAPERCIBIDO");
    }
  }
  for (const f of tmp) { try { fs.unlinkSync(f); } catch { /* */ } }
}

initTenant(TENANT_DEMO);
console.log(`\n── _diario_persistente_gate: ${pass} PASS · ${fail} FAIL (de ${pass + fail}) ──`);
process.exit(fail ? 1 : 0);
