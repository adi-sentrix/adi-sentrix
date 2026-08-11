/* === _cerrojo_certificacion_gate.mjs · EL CERROJO DE LA CERTIFICACIÓN, CERTIFICADO ============================
 * @inspeccion-estatica — importa el CERROJO del arnés de certificación (una función pura) y además lee ese
 * archivo como texto para confirmar que no puede ejecutarse por accidente. No importa el gateway, no invoca a
 * nadie y no abre un socket: el arnés de verdad sólo corre con dos llaves explícitas, y este gate no las tiene.
 *
 * POR QUÉ EXISTE: el §9 del contrato pone un tope de 15 llamadas y el owner uno de US$0,40. Un tope que nadie
 * probó es una intención. Acá se prueba lo único que importa de un tope: que la llamada 16 NO SE ENVÍA — que el
 * corte ocurre ANTES del envío, no después de haberlo pagado.
 *
 * CERO RED, CERO LLM, CERO CRÉDITO.
 */
import { readFileSync } from "node:fs";
import { crearCerrojo, SONDAS, TOPE_LLAMADAS, TOPE_USD, LLAMADAS_ESPERADAS, SONDAS_ESPERADAS } from "./_certificacion_v12_live.mjs";

let pass = 0, fail = 0;
const ok = (n, c, d) => { if (c) { pass++; console.log(`  OK  ${n}`); } else { fail++; console.log(`FAIL  ${n}${d ? " — " + d : ""}`); } };
const section = (t) => console.log(`\n== ${t} ==`);

section("1 · LA LLAMADA 16 NO SE ENVÍA");
{
  // `enviadas` cuenta lo que el cerrojo DEJÓ pasar. El emisor de mentira cuenta lo que SALIÓ de verdad.
  const c = crearCerrojo({ topeUSD: 999 });
  let salieron = 0;
  const enviar = () => { c.guardar(); salieron++; };
  let corte = null;
  for (let i = 1; i <= 20; i++) {
    try { enviar(); } catch (e) { corte = { intento: i, msg: String(e.message) }; break; }
  }
  ok("se envían exactamente 15", salieron === 15, `salieron ${salieron}`);
  ok("el corte ocurre EN la llamada 16", corte && corte.intento === 16, JSON.stringify(corte));
  ok("…y ocurre ANTES del envío (la 16 nunca salió)", salieron === 15 && corte, `salieron ${salieron}`);
  ok("el mensaje nombra el número de llamada y el tope", corte && /llamada 16 NO enviada/.test(corte.msg) && /15/.test(corte.msg), corte && corte.msg);
  ok("el estado queda DETENIDO, no sigue como si nada", /tope de llamadas/.test(c.estado().detenido || ""), JSON.stringify(c.estado()));
  // una vez detenida, la corrida no se reanuda sola.
  let reintento = null;
  try { c.guardar(); } catch (e) { reintento = String(e.message); }
  ok("una vez detenida, no acepta una llamada más", /ya se detuvo/.test(reintento || ""), reintento || "no lanzó");
}

section("2 · EL TOPE MONETARIO CORTA IGUAL, Y TAMBIÉN ANTES DE ENVIAR");
{
  const c = crearCerrojo({ topeLlamadas: 999, topeUSD: 0.10, costoEstimadoPorLlamada: 0.03 });
  let salieron = 0, corte = null;
  for (let i = 1; i <= 20; i++) {
    try { c.guardar(); salieron++; c.registrar(0.03); } catch (e) { corte = String(e.message); break; }
  }
  ok("corta al proyectar que la próxima excede el tope", salieron === 3 && !!corte, `salieron ${salieron}`);
  ok("el mensaje nombra el gasto acumulado y el tope", /US\$0\.0900/.test(corte || "") && /US\$0\.1/.test(corte || ""), corte);
  ok("el estado declara el motivo monetario", /tope monetario/.test(c.estado().detenido || ""), JSON.stringify(c.estado()));
  ok("no se sube el tope por cuenta propia", c.estado().topeUSD === 0.10);
}

section("3 · LOS TOPES SON LOS DEL CONTRATO Y LOS DEL OWNER");
{
  ok(`el tope absoluto de llamadas es 15 (§9)`, TOPE_LLAMADAS === 15, String(TOPE_LLAMADAS));
  ok(`las llamadas esperadas son 12 (§9)`, LLAMADAS_ESPERADAS === 12, String(LLAMADAS_ESPERADAS));
  ok(`las sondas esperadas son 6 (§9)`, SONDAS_ESPERADAS === 6, String(SONDAS_ESPERADAS));
  ok(`el tope monetario es US$0,40 (owner)`, TOPE_USD === 0.40, String(TOPE_USD));
  ok("hay exactamente 6 sondas declaradas", SONDAS.length === 6, String(SONDAS.length));
  // el presupuesto de la corrida tiene que CABER en el tope: 5 sondas de 2 llamadas + 1 de 1 = 11 ≤ 12 ≤ 15.
  const previstas = SONDAS.reduce((n, s) => n + (s.sinNarrar ? 1 : 2), 0);
  ok(`las 6 sondas prevén ${previstas} llamadas · ≤ ${LLAMADAS_ESPERADAS} esperadas · ≤ ${TOPE_LLAMADAS} tope`,
    previstas <= LLAMADAS_ESPERADAS && LLAMADAS_ESPERADAS <= TOPE_LLAMADAS, String(previstas));
  ok("cada sonda declara sus condiciones NOMBRADAS, y por qué", SONDAS.every((s) => Array.isArray(s.condiciones) && s.condiciones.length
    && s.condiciones.every(([n, f]) => typeof n === "string" && n && typeof f === "function") && s.porQue && s.texto && s.id));
  ok("las condiciones son evaluables sobre un plan cualquiera sin romperse",
    SONDAS.every((s) => s.condiciones.every(([, f]) => { try { f({}); return true; } catch { return false; } })));
  // la primera corrida pagada murió sin decir POR QUÉ: el arnés sólo dijo "no cumple". Cada sonda tiene que poder
  // señalar la condición exacta que falló, o una corrida fallida rinde menos de lo que costó.
  ok("una sonda que no cumple puede nombrar exactamente qué falló",
    SONDAS[0].condiciones.filter(([, f]) => !f({ intent: "answer", calls: [] })).map(([n]) => n).length >= 3);
  const ids = SONDAS.map((s) => s.id);
  ok("las sondas no se repiten", new Set(ids).size === ids.length, ids.join(","));
}

section("4 · EL ARNÉS NO PUEDE GASTAR POR ACCIDENTE");
{
  const SRC = readFileSync("./_certificacion_v12_live.mjs", "utf8");
  ok("su nombre NO termina en _gate.mjs: ninguna suite lo levanta", !/_gate\.mjs/.test("_certificacion_v12_live.mjs"));
  ok("exige DOS llaves para ejecutar (bandera + variable de entorno)",
    /process\.argv\.includes\("--ejecutar"\)/.test(SRC) && /ADI_CERTIFICACION_AUTORIZADA === "si"/.test(SRC));
  ok("sin las dos, imprime el plan y sale sin enviar nada", /PLAN DE LA CORRIDA \(no se ejecutó nada\)/.test(SRC));
  ok("el gateway se importa DENTRO del camino ejecutable, no al cargar el módulo",
    /await import\("\.\/src\/adi\/llm\/gatewayCore\.js"\)/.test(SRC));
  ok("§9 · aborta si la telemetría no quedó instalada, ANTES de la primera llamada",
    /ABORTADO · la telemetría no quedó instalada/.test(SRC) && /No se envió ninguna llamada/.test(SRC));
  ok("el cerrojo se consulta antes de CADA envío, en las dos pasadas",
    (SRC.match(/cerrojo\.guardar\(/g) || []).length === 2);
  ok("una sonda cortada por el cerrojo detiene la corrida entera (no se reintenta ni se recorta)",
    /if \(cortada\)/.test(SRC) && /NO CORRIDA/.test(SRC));
  ok("el contexto previo se siembra, no se paga", /scopeSembrado/.test(SRC) && /no se paga|se SIEMBRA/.test(SRC));
  // el registro de diagnóstico no puede filtrar dato del cliente: son vocabularios cerrados nuestros.
  ok("registra la FORMA del plan (intención, presencia de reparación, dimensiones, tools)",
    /intent: planReal\.intent/.test(SRC) && /reparacion: planReal\.reparacion === undefined \? "OMITIDA"/.test(SRC)
    && /declaradas:/.test(SRC) && /inferidas: inferirCorrige/.test(SRC) && /tools: \(planReal\.calls \|\| \[\]\)\.map/.test(SRC));
  ok("registra la condición EXACTA que falló", /condiciones que fallaron/.test(SRC) && /const fallas = planUsado/.test(SRC));
  // se certifica la CONDUCTA del producto (el plan que el motor usó), pero se reporta lo que el MODELO emitió:
  // las dos cosas visibles, nunca una tapando a la otra.
  // …Y CON LA REPARACIÓN NORMALIZADA: la 4ª corrida marcó fallida una sonda que el producto había resuelto bien,
  // porque leía el flag crudo del proveedor en vez de la capa que decide.
  ok("evalúa sobre el plan que el motor USÓ, con la reparación ya normalizada",
    /const planUsado = _coerc \? \{ \.\.\._coerc, reparacion: normalizeReparacion\(_coerc\) \} : null/.test(SRC)
    && /const forma = planReal \?/.test(SRC));
  ok("imprime el retryTrace completo, intento por intento, con su motivo",
    /trace PLAN intento/.test(SRC) && /trace NARRAR intento/.test(SRC) && /_rt\.plan \|\| \[\]/.test(SRC));
  ok("la pregunta de precisión se CUENTA, no se transcribe (nada del cliente al log)",
    /preguntas: planReal\.reparacion && typeof planReal\.reparacion\.pregunta === "string"/.test(SRC)
    && !/pregunta: planReal\.reparacion\.pregunta[^.]/.test(SRC));
  ok("no se vuelca el texto de la respuesta ni el plan crudo al reporte",
    !/texto: r && r\.r && r\.r\.text/.test(SRC) && !/plan: planReal/.test(SRC));
}

console.log(`\n${pass} OK · ${fail} FAIL`);
process.exit(fail ? 1 : 0);
