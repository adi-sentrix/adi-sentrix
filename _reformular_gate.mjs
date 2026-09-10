/* === _reformular_gate.mjs · LA MISMA RESPUESTA, PARA OTRO ==================================================
 *
 * EL DEFECTO QUE LO ORIGINA, visto por el owner en producción (v2.23): después de cuatro lecturas buenas en
 * pantalla pidió «explícamelo para el equipo comercial» y ADI contestó **«No tengo información autorizada
 * suficiente para responder eso»**.
 *
 * ⚠️ ESO NO ES NO CONTESTAR: ES FALSO, y por eso este archivo existe. La información la tenía —la acababa de
 * servir con cifras verificadas— y le dijo al dueño que no la tenía. Declinar cuando no hay dato es un mérito
 * de esta casa; declinar cuando SÍ lo hay le enseña al usuario que el producto es más corto de lo que es.
 * §2 usa esa frase EXACTA como carnada.
 *
 * ⚠️ Y §1 GUARDA LA TRAMPA DEL CASTELLANO que costó cuatro de diez formas: el pronombre va PEGADO al verbo
 * («explícaMELO»), así que buscarlo como palabra suelta con `\b` no lo encuentra jamás. Es primo del `\b`
 * imposible tras vocal acentuada — la misma trampa de creer que el borde de palabra está donde uno lo imagina.
 *
 * OFFLINE · determinístico · CERO llamadas al modelo.
 * `node --import ./scripts/offline-guard.mjs _reformular_gate.mjs` */
import { initTenant } from "./src/data/tenantStore.js";
import { TENANT_DEMO } from "./src/data/tenants/demo.js";
import { esReformular, destinatarioDe, doctrinaDeReformular, vetosDeReformular } from "./src/adi/agente/reformular.js";
import { answerViaAgente } from "./src/adi/agente/bucleAgente.js";
import { playbookPara } from "./src/adi/agente/playbooks/registro.js";
import { ESCENARIO_INICIAL } from "./src/config/scenarios.js";
import { readFileSync } from "node:fs";

let pass = 0, fail = 0;
const ok = (cond, label, detalle) => {
  if (cond) { pass++; console.log(`  ✓ ${label}`); }
  else { fail++; console.log(`  ✗ ${label}`); if (detalle !== undefined) console.log(`      ${String(detalle).slice(0, 300)}`); }
};
const H = (t) => console.log(`\n${t}`);
const ESC = ESCENARIO_INICIAL;
initTenant(TENANT_DEMO);

/* la respuesta anterior del hilo: el material legítimo de un turno de reformulación */
const PREVIA = "Esta semana haría una cosa: entrar por Lider y ordenar su cobranza. Lider concentra $4.6M de $12.6M que suma el cobro vencido en toda la cartera, y le sigue Falabella con $2.5M.";
const HILO = [{ role: "user", text: "qué hago esta semana" }, { role: "assistant", text: PREVIA }];
const Q = "explícamelo para el equipo comercial";

/* ═══ 1 · EL DETECTOR ═══════════════════════════════════════════════════════════════════════════════════════ */
H("1 · el detector — pedir lo mismo dicho de otra manera, y nada más");
{
  const DEBE = [
    "explícamelo para el equipo comercial", "explícaselo al equipo comercial", "ponlo en palabras para mi gerente",
    "resúmemelo para el directorio", "dímelo más corto", "explícamelo más simple", "cómo se lo explico a mi socio",
    "resúmelo en dos líneas", "dímelo en una línea", "explícamelo más sencillo",
  ];
  const miss = DEBE.filter((q) => !esReformular(q));
  ok(miss.length === 0, `★ las ${DEBE.length} formas de pedir la misma respuesta de otra manera se reconocen`, miss.join(" · "));
  /* ⚠️ LA TRAMPA DEL CLÍTICO, con nombre: cuatro de estas diez se caían por buscar «lo» como palabra suelta. */
  ok(esReformular("explícamelo más simple") && esReformular("resúmemelo para el directorio"),
    "★★ el pronombre PEGADO al verbo se reconoce («explícaMELO», «resúmeMELO») — con `\\b` no se encontraba nunca");

  const NO_DEBE = [
    "explícame el cuadro", "explica el cuadro de cartera", "explícame el margen de Falabella",
    "¿qué hago esta semana?", "dame los tres pasos", "por dónde empiezo",
    "¿por qué vendo más pero gano menos?", "muéstrame la ficha de Falabella", "¿será que Lider está comprando menos?",
    "¿me conviene bajar precios?", "dame los 5 clientes de mejor margen", "¿cómo va la cobranza?",
    "¿qué es más urgente, margen o cobranza?", "proyecta 12 meses con +4%", "¿y qué harías primero?",
    "dime cuáles son los clientes bajo el benchmark",
  ];
  const fp = NO_DEBE.filter((q) => esReformular(q));
  ok(fp.length === 0, `★ cero falsos positivos sobre ${NO_DEBE.length} turnos que piden una lectura NUEVA`, fp.join(" · "));
  /* ⚠️ EL CASO QUE LA CALIBRACIÓN OBLIGÓ A DEJAR AFUERA */
  ok(!esReformular("qué le digo al equipo comercial"),
    "★ «qué le digo al equipo» NO es reformular: «digo» es primera persona — pide producir un mensaje, y eso es del plan");
  ok((playbookPara("qué le digo al equipo comercial", { history: [], viewContext: null, cuadro: null, mem: {} }) || {}).nombre === "plan-de-accion",
    "…y ese turno lo sigue atendiendo el plan de acción, que hoy lo resuelve bien");
  ok(destinatarioDe("explícamelo para el equipo comercial") !== null && destinatarioDe("dímelo más corto") === null,
    "y el destinatario se lee cuando lo hay; cuando solo piden otra forma, no se inventa uno");
}

/* ═══ 2 · ★ EL VETO DEL DEFECTO REAL ════════════════════════════════════════════════════════════════════════ */
H("2 · ★ decir «no tengo información» teniéndola es una afirmación falsa sobre el propio producto");
{
  const v = (t, previa = PREVIA) => vetosDeReformular(t, { pregunta: Q, previa, sitio: "cierre" }).map((x) => x.regla);
  ok(v("No tengo información autorizada suficiente para responder eso con el alcance pedido.").includes("reformular-niega-lo-que-tiene"),
    "★★ la frase EXACTA que salió en producción ARDE — con la respuesta anterior en el hilo, es falsa");
  ok(v("Para el equipo: la prioridad es Lider, que concentra $4.6M del cobro vencido. Después Falabella, con $2.5M.").length === 0,
    "…y la reformulación legítima pasa limpia: mismas cifras, otro destinatario");
  ok(v("Para el equipo: Lider concentra $4.6M, y además el margen cae 7.6%.").includes("reformular-cifra-nueva"),
    "★ una cifra que NO estaba en la respuesta anterior ARDE: reformular es re-decir, no re-calcular");
  /* ⚠️ y ese veto casi no ve nada: el `\b` tras «%» no existe, la misma trampa que cicloNotarial documenta */
  ok(v("Es 7.6%.").includes("reformular-cifra-nueva"),
    "★★ …incluso cuando la cifra cierra la frase: «7.6%.» no tiene borde de palabra tras el «%»");
  ok(v("No tengo información autorizada suficiente para responder eso.", null).includes("reformular-sin-previa-mal-dicho"),
    "★ sin respuesta previa TAMBIÉN arde esa frase: lo que falta es la lectura, no el dato");
  ok(v("Todavía no hay una respuesta que reescribir en este hilo. ¿Quieres que haga la lectura primero?", null).length === 0,
    "…y decirlo bien pasa: se declara que no hay qué reformular y se ofrece hacerlo");
  ok(v("").length === 0 && vetosDeReformular("lo que sea", { pregunta: "¿cuánto vendimos?", previa: PREVIA }).length === 0,
    "no multa el texto vacío ni los turnos que no son de esta ruta");
  ok(vetosDeReformular("No tengo información autorizada suficiente.", { pregunta: Q, previa: PREVIA, sitio: "linea-honesta" }).length === 0,
    "★ y juzga al cerebro, no a los peldaños: la línea honesta sirve textos ya juzgados");
}

/* ═══ 3 · LA DOCTRINA VIAJA, Y SOLO EN SU TURNO ═════════════════════════════════════════════════════════════ */
H("3 · el procedimiento llega al cerebro en el turno que lo pide — y en ningún otro");
{
  const doctrina = doctrinaDeReformular();
  ok(/NO SALGAS A LEER/.test(doctrina) && /MISMAS CIFRAS/.test(doctrina),
    "la doctrina dice lo esencial: no salir a leer, y las cifras son las de antes");
  ok(/JAMÁS digas que no tienes información/.test(doctrina),
    "★ y le prohíbe explícitamente la frase con la que falló en producción");
  ok(doctrina === doctrinaDeReformular(), "es byte-estable — la misma instrucción en cada turno");

  const espia = async (marca) => {
    let visto = false;
    await answerViaAgente({ text: marca, history: HILO, mem: {}, scenario: ESC,
      callAgente: async (a) => { visto = JSON.stringify(a.mensajes || a).includes("TE PIDIERON LA MISMA RESPUESTA"); return { tipo: "texto", texto: "" }; } });
    return visto;
  };
  ok(await espia(Q), "★ el cerebro RECIBE el procedimiento cuando le piden reformular");
  ok(!(await espia("¿qué hago esta semana?")), "…y NO lo recibe en un turno corriente: la instrucción no viaja hasta que hace falta");
}

/* ═══ 4 · CABLEADO AL MURO ══════════════════════════════════════════════════════════════════════════════════ */
H("4 · la ley está conectada, no solo escrita");
{
  const bucle = readFileSync(new URL("./src/adi/agente/bucleAgente.js", import.meta.url), "utf8");
  ok(/import \{ esReformular, doctrinaDeReformular, vetosDeReformular \}/.test(bucle), "el bucle la importa");
  ok(/if \(_esReformularDelTurno\) mensajes\.push/.test(bucle), "…empuja su doctrina en el turno que la pide");
  ok(/vetosDeReformular\(t, \{ pregunta: q, previa: _previaDelHilo, sitio \}\)/.test(bucle),
    "★ …y la juzga con la respuesta ANTERIOR del hilo, que es el material del turno");
  ok(/\.\.\.vRef2,/.test(bucle), "…y su resultado entra a la lista de vetos que decide el turno");
  ok(/const _previaDelHilo = /.test(bucle) && /h\.role !== "user"/.test(bucle),
    "…leyendo el hilo que el bucle ya tiene, sin inventar una segunda memoria");
}

/* ═══ 5 · NO LE QUITA EL TURNO A NADIE ══════════════════════════════════════════════════════════════════════ */
H("5 · las cinco rutas del owner siguen respondiendo lo suyo");
{
  const CTX = { history: [], viewContext: null, cuadro: null, mem: {} };
  const DUEÑOS = [
    ["¿será que Lider está comprando menos?", "hipotesis-del-usuario"],
    ["¿hago bien en priorizar volumen?", "desafiar-decision"],
    ["¿por qué vendo más pero gano menos?", "contradiccion-de-metricas"],
    ["¿qué es más urgente, margen o cobranza?", "comparar-alternativas"],
    ["qué hago esta semana", "plan-de-accion"],
  ];
  for (const [q, dueño] of DUEÑOS) {
    ok((playbookPara(q, CTX) || {}).nombre === dueño, `«${q.slice(0, 38)}» sigue siendo de ${dueño}`);
    ok(!esReformular(q), `…y la ley de reformular no se le asoma`);
  }
}


/* ═══ 6 · SIN NADA QUE REFORMULAR, SE DICE LA VERDAD ════════════════════════════════════════════════════════
 * El peldaño de siempre contestaba «no tengo información autorizada suficiente», que es la misma afirmación
 * falsa: el dato está, lo que falta es la lectura. Y no hace falta ni llamar al cerebro para decirlo. */
H("6 · sin respuesta previa en el hilo: se dice qué falta de verdad, sin gastar una llamada");
{
  const MUDO = async () => ({ tipo: "texto", texto: "" });
  const sinNada = await answerViaAgente({ text: Q, history: [], mem: {}, scenario: ESC, callAgente: MUDO });
  const t = String((sinNada.r && sinNada.r.text) || "");
  ok(sinNada.r.agente.estado === "sin-que-reformular", `el turno se resuelve solo (estado ${sinNada.r.agente.estado})`);
  ok(sinNada.r.agente.calls === 0, "★ sin una sola llamada al cerebro: no hay nada que reescribir, no hay qué pedirle");
  ok(!/no tengo informaci[oó]n autorizada/i.test(t), "★★ y NO dice la frase falsa: el dato está, lo que falta es la lectura");
  ok(/no hay una respuesta que reescribir/i.test(t) && /Dime qué quieres mirar/i.test(t),
    "…dice qué falta de verdad y ofrece hacerlo", t.slice(0, 140));

  const conPrevia = await answerViaAgente({ text: Q, history: HILO, mem: { ultimaAprobada: PREVIA }, scenario: ESC, callAgente: MUDO });
  ok(conPrevia.r.agente.estado !== "sin-que-reformular",
    "★ y CON respuesta previa el atajo no se aplica: ahí sí hay material y el turno sigue su camino");
  ok(/quedó verificado/i.test(String((conPrevia.r && conPrevia.r.text) || "")),
    "…y si el cerebro falla, el piso re-sirve la respuesta anterior en vez de declinar");
}

console.log(`\n── _reformular_gate: ${pass} PASS · ${fail} FAIL (de ${pass + fail}) ──`);
process.exit(fail === 0 ? 0 : 1);
