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
import { esReformular, destinatarioDe, doctrinaDeReformular, vetosDeReformular, componerReformulacion } from "./src/adi/agente/reformular.js";
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
  /* el import trae también `componerReformulacion` desde 2026-09-10: el piso que re-dice la previa cuando el
   * cerebro no puede (ver §8) — sin él, prohibir la frase falsa no alcanzaba para responder. */
  /* …y desde la Etapa 3 también `destinatarioDe` y `doctrinaDeAudiencia`: el molde del lector viaja solo en el turno que lo nombra */
  /* …y desde la batería en vivo de la Etapa 4 también `previaSustantiva`: la respuesta que se reformula es la última
   * SUSTANTIVA del hilo — las reformulaciones encadenadas degradaban el material (ver §10) */
  ok(/import \{ esReformular, doctrinaDeReformular, vetosDeReformular, componerReformulacion, destinatarioDe, doctrinaDeAudiencia, previaSustantiva \}/.test(bucle), "el bucle la importa");
  ok(/if \(_esReformularDelTurno\) mensajes\.push/.test(bucle), "…empuja su doctrina en el turno que la pide");
  ok(/vetosDeReformular\(t, \{ pregunta: q, previa: _previaDelHilo, sitio \}\)/.test(bucle),
    "★ …y la juzga con la respuesta ANTERIOR del hilo, que es el material del turno");
  ok(/\.\.\.vRef2,/.test(bucle), "…y su resultado entra a la lista de vetos que decide el turno");
  ok(/const _previaDelHilo = previaSustantiva\(history\);/.test(bucle),
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
  /* ⚠️ EL PISO CAMBIÓ Y ES MEJOR (2026-09-10): antes ganaba el respaldo genérico, que re-servía la respuesta
   * anterior TAL CUAL —«lo que quedó verificado…»—. Ahora gana el peldaño propio de esta ruta, que la re-dice
   * PARA QUIEN LA PIDIERON, que es lo que el turno pedía. Sigue sin llamar al cerebro y sin cifras nuevas. */
  ok(conPrevia.r.agente.estado === "reformular-piso",
    "★★ …y si el cerebro falla, el piso REFORMULA la respuesta anterior en vez de declinar", conPrevia.r.agente.estado);
  ok(!/no tengo informaci[oó]n autorizada/i.test(String((conPrevia.r && conPrevia.r.text) || "")),
    "★★ …y jamás sale la frase falsa: prohibirla no alcanzaba, había que tener qué responder");
}


/* ═══ 7 · ★★ LA CADENA DE DOS TURNOS · LA PRUEBA QUE FALTÓ ══════════════════════════════════════════════════
 * ⚠️ ESTE BLOQUE EXISTE PORQUE SU AUSENCIA COSTÓ UN DEPLOY. La ruta se probó con un `history` y un `mem`
 * escritos a mano, y pasó. En el producto real el turno anterior lo resuelve un PLAYBOOK — las cinco rutas
 * conversacionales lo son— y un turno de playbook no escribía NADA en la memoria del hilo: `aprobado` solo se
 * marca en los caminos del cerebro. Sin `recitaAprobada`, las cifras de la respuesta anterior no estaban
 * autorizadas, el muro vetaba la reformulación («$655K» sin boleta) y la escalera terminaba en el genérico.
 * El owner lo vio tres veces seguidas en producción.
 * LA LECCIÓN, y vale para cualquier ruta que dependa del turno anterior: probar la CADENA, no el eslabón.
 * Acá se encadena de verdad: se corre una ruta real y con SU memoria se pide la reformulación. */
H("7 · ★★ encadenado de verdad: una ruta real, y después la reformulación con SU memoria");
{
  const MUDO2 = async () => ({ tipo: "texto", texto: "" });
  const t1 = await answerViaAgente({ text: "¿por qué vendo más pero gano menos?", history: [], mem: {}, scenario: ESC, callAgente: MUDO2 });
  ok(t1.r.agente.estado === "playbook", `el turno 1 lo resuelve un playbook (${t1.r.agente.estado}) — como las cinco rutas del owner`);
  ok(!!(t1.mem && t1.mem.ultimaAprobada), "★★ …y DEJA memoria del hilo: un entregable de playbook es una respuesta verificada");
  ok(!!(t1.mem && t1.mem.recitaAprobada && t1.mem.recitaAprobada.figs.length),
    `★★ …y presta sus cifras al turno siguiente (${(t1.mem && t1.mem.recitaAprobada && t1.mem.recitaAprobada.figs.length) || 0})`);

  const hist = [{ role: "user", text: "¿por qué vendo más pero gano menos?" }, { role: "adi", text: t1.r.text }];
  /* un cerebro que hace lo que la doctrina pide: re-dice lo anterior con SUS cifras y sus dueños */
  const REFORMULA = async () => ({ tipo: "texto", texto: "Para el equipo, en corto: la venta creció 7.6% contra el período comparable, pero el margen viene cediendo mes a mes. Se están cediendo $655K de carga comercial por sobre el nivel declarado. El foco de la semana es la condición, no el volumen." });
  const t2 = await answerViaAgente({ text: Q, history: hist, mem: t1.mem || {}, scenario: ESC, callAgente: REFORMULA });
  ok((t2.r.agente.vetos || []).length === 0, "★★ la reformulación pasa el muro con las cifras del turno anterior", (t2.r.agente.vetos || [])[0]);
  ok(t2.r.agente.estado !== "vacio", `…y NO cae al genérico (estado ${t2.r.agente.estado})`);
  ok(!/no tengo informaci[oó]n autorizada/i.test(String(t2.r.text || "")),
    "★★ …así que el dueño ya no recibe «no tengo información» teniendo la respuesta en pantalla");

  /* ⚠️ ESTA CARNADA LA JUBILÓ SU PROPIO ARREGLO (2026-09-10), y es la lección más cara de la ruta. Medía que
   * SIN la memoria del turno anterior el turno se caía al genérico —y lo daba por correcto, como «el defecto
   * exacto que el owner vio»—. Pero el owner lo volvió a ver DESPUÉS, en su prueba de continuidad: con la
   * respuesta en pantalla, ADI seguía diciendo «no tengo información autorizada». La carnada estaba
   * certificando el defecto en vez de impedirlo.
   * LO QUE SE MIDE AHORA: sin esa memoria el turno YA NO se cae, porque el piso lee del HILO —que la app manda
   * siempre— y no de una memoria que algún peldaño puede no haber escrito. Un piso que se apoya en lo que
   * puede faltar no es un piso. */
  const memSin = { ...(t1.mem || {}) }; delete memSin.recitaAprobada; delete memSin.ultimaAprobada;
  const t2malo = await answerViaAgente({ text: Q, history: hist, mem: memSin, scenario: ESC, callAgente: REFORMULA });
  ok(t2malo.r.agente.estado !== "vacio",
    "★★ sin la memoria del turno anterior el turno SIGUE respondiendo: el material se lee del hilo", t2malo.r.agente.estado);
  ok(!/no tengo informaci[oó]n autorizada/i.test(String(t2malo.r.text || "")),
    "★★ …y tampoco ahí sale la frase falsa — que es lo que el owner vio tres veces");
}

/* ═══ 8 · ★★ EL PISO · PROHIBIR NO ES RESPONDER ═════════════════════════════════════════════════════════════
 * EL HILO REAL DE LA PRUEBA DE CONTINUIDAD DEL OWNER (2026-09-10, 4/5): cinco turnos encadenados que ADI
 * resolvió bien, y en el sexto —«Explícamelo para el equipo comercial»— la frase falsa otra vez.
 * LA RAÍZ, y por eso esta sección existe: los vetos de esta ruta PROHIBEN esa frase, pero el turno se quedaba
 * sin texto y la escalera terminaba en el mensaje de sin-datos… que es LA MISMA FRASE. El candado cerraba la
 * puerta y la salida de emergencia daba a la misma habitación.
 * SE MIDE CON EL CEREBRO EN CONTRA: mudo y, peor, insistiendo con la frase de producción. */
H("8 · ★★ el piso: con la respuesta en el hilo, el turno responde aunque el cerebro no ayude");
{
  const PREVIA_REAL = [
    "Cuatro clientes explican prácticamente toda la brecha: Lider, Falabella, Sodimac y Jumbo concentran el mecanismo probado — carga comercial sobre el nivel de referencia (3.5%) — y entre los cuatro pesan 73.8% de la venta total.",
    "Lider: brecha 8.6 pp, margen 21.5%, carga comercial 4.2%, venta $17.8M.",
    "Con eso, mi recomendación —criterio mío, no algo que el dato ordene— es partir por Falabella: mueve más dinero por punto de ajuste que cualquier otra cuenta.",
  ].join("\n");
  const HILO_REAL = [
    { role: "user", text: "¿Cómo va el negocio?" },
    { role: "assistant", text: "El margen cruzó, pero deja caja en la mesa: la venta viene +7.5% y el margen cierra en 25.1%, por debajo del benchmark de 30.1%." },
    { role: "user", text: "¿Qué clientes explican más eso?" },
    { role: "assistant", text: PREVIA_REAL },
  ];
  const FRASE_DE_PRODUCCION = "No tengo información autorizada suficiente para responder eso con el alcance pedido. Cuéntame qué dato específico necesitas y lo busco.";
  const MUDO = async () => ({ tipo: "texto", texto: "" });
  const INSISTE = async () => ({ tipo: "texto", texto: FRASE_DE_PRODUCCION });

  for (const [comoEsta, cerebro] of [["mudo", MUDO], ["insistiendo con la frase de producción", INSISTE]]) {
    const r = await answerViaAgente({ text: Q, history: HILO_REAL, mem: {}, scenario: ESC, callAgente: cerebro });
    const t = String((r.r && r.r.text) || "");
    ok(r.r.agente.estado === "reformular-piso", `★★ con el cerebro ${comoEsta}, el turno lo resuelve el piso (${r.r.agente.estado})`);
    ok(!/no tengo informaci[oó]n autorizada/i.test(t), "★★ …y la frase que el owner vio NO sale");
    ok(/equipo comercial/i.test(t), "…le habla a quien pidieron: el destinatario se lee entero, con su calificador");
    ok(/Falabella/.test(t) && /partir por Falabella/i.test(t),
      "★★ …y CONSERVA LA CONCLUSIÓN del turno anterior — la ley del owner: el piso es otro camino de entrega, no un segundo cerebro");
    ok(/\$17\.8M|21\.5%|8\.6 pp|3\.5%|73\.8%/.test(t), "…con las cifras que ya estaban en pantalla");
  }

  /* NO INVENTA: cada cifra del piso tiene que estar en la previa — es re-decir, no re-calcular */
  const compuesto = componerReformulacion(PREVIA_REAL, { pregunta: Q });
  const _CIF = /\$[\d.,]+\s?[KMB]?|[\d.,]+\s*(?:%|pp\b)/gi;
  const nuevas = [...new Set(String(compuesto).match(_CIF) || [])].filter((c) => !PREVIA_REAL.includes(c));
  ok(nuevas.length === 0, "★ ni una cifra que no estuviera en la respuesta anterior", nuevas.join(" · "));
  ok(vetosDeReformular(compuesto, { pregunta: Q, previa: PREVIA_REAL, sitio: "cierre" }).length === 0,
    "★ y su propia salida pasa los vetos de la ruta — el piso no se salva de la ley que aplica a los demás");

  /* SIN MATERIAL NO INVENTA UNO: una previa sin cifras ni conclusión no se puede reformular, y se dice */
  ok(componerReformulacion("Hola, ¿en qué te ayudo? Cuéntame qué quieres mirar del negocio y lo abrimos juntos.", { pregunta: Q }) === null,
    "★ una previa sin cifra ni conclusión NO se reformula: mejor ceder al peldaño que lo dice honestamente");
  ok(componerReformulacion("corto", { pregunta: Q }) === null, "…ni un texto demasiado corto para ser una respuesta");
}

/* ═══ 9 · ★ EL LECTOR CAMBIA LA FORMA, NO LA CONCLUSIÓN (Etapa 3, owner 2026-09-11) ═══════════════════════════
 * Su vara: «"Más corto" debe significar realmente más corto. "Para directorio" debe subir de nivel. "Para
 * comercial" debe aterrizar al cliente, cifra y acción. "Dame detalle" sí debe abrir evidencia. La conclusión
 * debe mantenerse idéntica; cambia la forma.» Y su ejemplo de «más corto»: «Creces, pero con margen presionado.
 * Falabella concentra la mayor recuperación potencial; yo empezaría por ahí.» — sin una sola cifra. */
H("9 · ★ el piso por audiencia: misma conclusión, distinta forma — y «más corto» es más corto");
{
  const { tipoDeAudiencia, doctrinaDeAudiencia } = await import("./src/adi/agente/reformular.js");
  ok(tipoDeAudiencia("el directorio") === "directorio" && tipoDeAudiencia("el equipo comercial") === "comercial" && tipoDeAudiencia("el analista") === "analista" && tipoDeAudiencia("mi socio") === "dueno",
    "los cuatro lectores del owner se reconocen desde el destinatario que ya se detectaba (sin segundo detector)");
  for (const d of ["el directorio", "el equipo comercial", "el analista"]) {
    const doc = doctrinaDeAudiencia(d);
    ok(/LA CONCLUSIÓN NO CAMBIA POR EL LECTOR/.test(doc) && doc === doctrinaDeAudiencia(d), `el molde para «${d}» lleva la invariante y es byte-estable`);
  }
  ok(/Sin órdenes/.test(doctrinaDeAudiencia("el equipo comercial")) && /Nada operativo/.test(doctrinaDeAudiencia("el directorio")),
    "…comercial sin órdenes, directorio sin operativa: las diferencias reales que el owner pidió");

  const MUDO2 = async () => ({ tipo: "texto", texto: "" });
  const t1 = await answerViaAgente({ text: "¿Cómo va el negocio?", history: [], mem: {}, scenario: ESC, callAgente: MUDO2 });
  const FOTO = String(t1.r.text || "");
  const H2 = [{ role: "user", text: "¿Cómo va el negocio?" }, { role: "assistant", text: FOTO }];
  const pide = async (q) => { const r = await answerViaAgente({ text: q, history: H2, mem: t1.mem, scenario: ESC, callAgente: MUDO2 }); return { t: String(r.r.text || ""), a: r.r.agente }; };
  const tesis = FOTO.split("\n")[0].trim();
  /* la ORACIÓN del criterio, no la línea entera: el piso parte por oraciones y deja fuera la oferta que la sigue («Cuando digas, la abro.») */
  const criterio = ((FOTO.split("\n").find((l) => /entrar[ií]a por|mirar[ií]a primero|empezar[ií]a por/i.test(l)) || "").split(/(?<=[.!?])\s+(?=[A-ZÁÉÍÓÚÑ¿«])/)[0] || "").trim();
  ok(tesis.length > 20 && criterio.length > 20, "la foto trae tesis y criterio para reformular (el material del piso)", `${tesis.slice(0, 50)} · ${criterio.slice(0, 50)}`);

  const corto = await pide("dímelo más corto");
  const nCorto = corto.t.split(/\s+/).length, nFoto = FOTO.split(/\s+/).length;
  ok(corto.a.estado === "reformular-piso" && nCorto < nFoto / 2, `★★ «más corto» es de verdad más corto: ${nCorto} palabras contra ${nFoto} de la foto`);
  ok(corto.t.includes(tesis) && corto.t.includes(criterio), "★ …y conserva la tesis y el criterio — la conclusión idéntica, verbatim");
  ok(!/Es la misma lectura de recién/.test(corto.t), "…sin la línea que se describía a sí misma (voz de sistema)");

  const dir = await pide("resúmemelo para el directorio");
  const com = await pide("explícamelo para el equipo comercial");
  const ana = await pide("explícamelo para el analista");
  ok(dir.t.includes(tesis) && com.t.includes(tesis) && ana.t.includes(tesis) && dir.t.includes(criterio) && com.t.includes(criterio) && ana.t.includes(criterio),
    "★★ los tres lectores reciben la MISMA tesis y el MISMO criterio");
  const nDir = dir.t.split(/\s+/).length, nCom = com.t.split(/\s+/).length, nAna = ana.t.split(/\s+/).length;
  ok(nDir <= nCom && nCom <= nAna, `…y la evidencia crece con el lector: directorio ${nDir} ≤ comercial ${nCom} ≤ analista ${nAna} palabras`);
  ok(/Para el directorio/.test(dir.t) && /Para el equipo comercial/.test(com.t) && /Para el analista/.test(ana.t), "…cada uno abre nombrando a su lector");
  const cifras = (t) => (t.match(/\$[\d.,]+[KMB]?|[\d.,]+\s*%/g) || []).map((c) => c.trim());
  ok([dir, com, ana].every((r) => cifras(r.t).every((c) => FOTO.includes(c))), "★ ni una cifra que no estuviera en la foto, en ninguno de los tres");
  /* y la vara del owner para «más corto» sin cifra ya no arde en el cerebro: con la conclusión a bordo, alcanza */
  ok(vetosDeReformular("Creces, pero con margen presionado. Falabella concentra la mayor recuperación potencial; yo empezaría por ahí.", { pregunta: "dímelo más corto", previa: FOTO, sitio: "cierre" }).length === 0,
    "★ el ejemplo textual del owner de «más corto» —sin cifra, con la conclusión— pasa limpio los vetos de la ruta");
}

/* ═══ 10 · ★★ LA BATERÍA EN VIVO DE LA ETAPA 4 (owner 2026-09-11): las formas que se iban al cerebro libre ═══
 * Tres turnos de su batería no eran de esta ruta para el detector: «Dámelo más corto.» (el verbo se escribía
 * con «í»), «Ahora para directorio.» (sin artículo no había lector) y la cadena entera degradaba el material
 * porque cada reformulación se apoyaba en la ANTERIOR (dos frases) y no en la respuesta sustantiva. */
H("10 · ★★ la batería en vivo: «dámelo», «ahora para directorio» y la cadena que no degrada");
{
  const { previaSustantiva } = await import("./src/adi/agente/reformular.js");
  ok(esReformular("Dámelo más corto.") && esReformular("dámelo en dos líneas"), "★ «Dámelo más corto» ES reformular: «dá» y «dí» son el mismo verbo");
  ok(esReformular("Ahora para directorio.") && esReformular("¿y para comercial?") && esReformular("también para finanzas"),
    "★ la frase que es SOLO el lector («Ahora para directorio.») pide lo mismo para otro: no hace falta verbo");
  ok(destinatarioDe("Ahora para directorio.") === "el directorio" && destinatarioDe("Explícamelo para comercial") === "el equipo comercial",
    "…y el lector sin artículo se nombra completo (directorio → «el directorio», comercial → «el equipo comercial»)");
  ok(!esReformular("los riesgos para el directorio") && !esReformular("¿qué vendo para el directorio de Falabella?"),
    "…sin tragarse lecturas nuevas que nombran un lector de paso");

  /* previaSustantiva: la respuesta que se reformula es la última cuya pregunta NO fue reformular */
  const HS = [
    { role: "user", text: "¿Cómo va el negocio?" }, { role: "assistant", text: "El negocio está creciendo, pero deja menos margen del que debería. Entraría por Falabella: ahí coinciden el volumen y la carga excedida." },
    { role: "user", text: "Dámelo más corto." }, { role: "assistant", text: "Lo mismo, más corto: entraría por Falabella. Ahí coinciden el volumen y la carga excedida." },
    { role: "user", text: "Ahora para directorio." }, { role: "assistant", text: "Para el directorio, en corto: entraría por Falabella. Ahí coinciden el volumen y la carga excedida." },
  ];
  ok(previaSustantiva(HS) === HS[1].text, "★★ `previaSustantiva` salta las reformulaciones y devuelve la respuesta sustantiva del hilo");
  ok(previaSustantiva(HS.slice(0, 2)) === HS[1].text && previaSustantiva([]) === null, "…la primera respuesta cuenta, y sin hilo devuelve null");

  /* la cadena entera del owner con el cerebro MUDO: T1 foto → T3 corto → T4 comercial → T5 directorio.
   * El material de T4 y T5 es la FOTO (no la reformulación previa): la conclusión llega verbatim a los tres. */
  const MUDO3 = async () => ({ tipo: "texto", texto: "" });
  let h = [], mem = {};
  const paso = async (q) => { const r = await answerViaAgente({ text: q, history: h, mem, scenario: ESC, callAgente: MUDO3 }); h = [...h, { role: "user", text: q }, { role: "assistant", text: String(r.r.text || "") }]; mem = r.mem || mem; return { t: String(r.r.text || ""), a: r.r.agente }; };
  const t1 = await paso("¿Cómo va el negocio?");
  const t3 = await paso("Dámelo más corto.");
  const t4 = await paso("Explícamelo para el equipo comercial.");
  const t5 = await paso("Ahora para directorio.");
  const tesis2 = t1.t.split("\n")[0].trim();
  const criterio2 = ((t1.t.split("\n").find((l) => /entrar[ií]a por|mirar[ií]a primero|empezar[ií]a por/i.test(l)) || "").split(/(?<=[.!?])\s+(?=[A-ZÁÉÍÓÚÑ¿«])/)[0] || "").trim();
  ok(t1.a.estado === "playbook" && [t3, t4, t5].every((x) => x.a.estado === "reformular-piso"), `los tres turnos del owner salen por el piso de reformular (${t3.a.estado} · ${t4.a.estado} · ${t5.a.estado})`);
  ok([t3, t4, t5].every((x) => x.t.includes(tesis2) && x.t.includes(criterio2)),
    "★★ y los tres conservan la tesis y el criterio de la FOTO, verbatim — la cadena ya no degrada el material");
  ok(/^Para el equipo comercial/.test(t4.t) && /^Para el directorio/.test(t5.t), "…cada uno abre nombrando a su lector");
  ok(t3.t.split(/\s+/).length < t1.t.split(/\s+/).length / 2, "…y «más corto» sigue siendo más corto");
  /* LA PREVIA ESCRITA POR EL CEREBRO (batería en vivo, T5): abre con su tesis CON cifras y no dice «entraría por».
   * Antes el piso no encontraba tesis ni criterio y el directorio recibía una sola línea de números; ahora la
   * tesis abre igual, y las negritas del cerebro (formato de informe) no se heredan. */
  const PREVIA_CEREBRO = [
    "La brecha no es un problema difuso: son 5 puntos de margen (25.1% contra el benchmark de 30.1%) concentrados en 6 cuentas, y en 4 de ellas hay dos señales que se mueven juntas.",
    "", "**Lo que se movió, con cifras:**",
    "- **Falabella, Lider, Jumbo y Sodimac** están bajo el benchmark con carga sobre el 3.5% de referencia.",
    "  - Falabella: margen 22.0% (brecha 8.1 pp), carga 4.5%, contribución no capturada $1.6M",
    "  - Lider: margen 21.5% (brecha 8.6 pp), carga 4.2%, $1.5M",
    "", "¿Sabes si Falabella y Jumbo tienen un rebate pactado por volumen?",
  ].join("\n");
  const dirC = componerReformulacion(PREVIA_CEREBRO, { pregunta: "Ahora para directorio." });
  ok(!!dirC && dirC.split("\n")[1] === "La brecha no es un problema difuso: son 5 puntos de margen (25.1% contra el benchmark de 30.1%) concentrados en 6 cuentas, y en 4 de ellas hay dos señales que se mueven juntas.",
    "★★ la previa del cerebro abre con su tesis aunque lleve cifras — el directorio recibe la conclusión, no solo una línea de números", dirC);
  ok(!!dirC && !/\*\*/.test(dirC) && (dirC.match(/\$[\d.,]+[KMB]?/g) || []).length >= 1, "…sin negritas heredadas, y con su línea en dinero", dirC);
  const comC = componerReformulacion(PREVIA_CEREBRO, { pregunta: "Explícamelo para el equipo comercial." });
  ok(!!comC && comC.includes("La brecha no es un problema difuso") && !/\*\*/.test(comC) && comC.split("\n").length >= 4, "…y el equipo comercial recibe la tesis más las cuentas con su cifra", comC);
  /* los CONTEOS de la previa («6 pagan margen…») viajan en la boleta del piso: sin eso el muro los vetaba como no autorizados */
  const bucle = readFileSync(new URL("./src/adi/agente/bucleAgente.js", import.meta.url), "utf8");
  ok(/counts: parseCounts\(_previaDelHilo\)/.test(bucle), "★ los conteos de la respuesta previa entran a la boleta del piso (el muro los reconocía como no autorizados)");
}

/* ═══ 11 · ★★ EL ENCARGO COMPUESTO CON PRESENTACIÓN AL FINAL (owner 2026-09-11) ═══════════════════════════
 * Su pantalla: «…qué parte puedes demostrar y qué harías primero. Después resúmemelo para directorio» recibió
 * «Todavía no te he respondido nada en esta conversación…» — el detector miraba si el mensaje CONTENÍA la forma
 * de reformular, y el atajo de «no hay nada que reformular» corría antes del scope, del procedimiento y del
 * cerebro. Su regla: reformular solo cuando el mensaje ES eso; al final, tras «después / luego / al final» o
 * como frase de cierre, es una instrucción de presentación de lo que este turno produce. Y la audiencia final
 * no secuestra el tema: los procedimientos leen el encargo, el lector viaja como molde. */
H("11 · ★★ el encargo compuesto: reformular no eclipsa el turno, y la audiencia final no secuestra el tema");
{
  const { presentacionPosterior, sinPresentacionPosterior } = await import("./src/adi/agente/reformular.js");
  const { playbookPara: pbPara, doctrinaDelPlaybook } = await import("./src/adi/agente/playbooks/registro.js");
  const OWNER = "Quiero que me digas cómo va el negocio, qué está explicando el resultado, qué clientes están presionando más el margen, qué parte puedes demostrar y qué harías primero. Después resúmemelo para directorio";
  const P1 = "Dime cómo va el negocio, qué está explicando el resultado, qué clientes presionan más el margen, qué puedes demostrar y qué harías primero. Al final resúmelo para directorio.";
  const P3 = "Analiza la cartera: quién sostiene ventas, quién destruye margen, dónde está la mayor recuperación y qué tres cuentas revisarías primero. Explícalo para comercial.";
  const SIN_PUNTO = "dime cómo va el negocio y qué harías primero y después resúmelo para el directorio";
  ok(!esReformular(OWNER) && !esReformular(P1) && !esReformular(P3) && !esReformular(SIN_PUNTO),
    "★★ los encargos con presentación al final NO son reformular: «después…», «al final…», «Explícalo para comercial.» de cierre, con y sin punto");
  const pp = presentacionPosterior(OWNER);
  ok(!!pp && pp.destinatario === "el directorio" && /^Después resúmemelo/.test(pp.clausula) && /qué harías primero\.$/.test(pp.resto),
    "…la instrucción posterior se separa del encargo: cláusula, lector y resto", JSON.stringify(pp));
  ok(destinatarioDe(OWNER) === "el directorio" && destinatarioDe(P3) === "el equipo comercial", "…y el lector sigue viajando como molde (destinatarioDe lee el mensaje entero)");
  ok(esReformular("Dámelo más corto.") && esReformular("Explícamelo para el equipo comercial.") && esReformular("Ahora para directorio.") && esReformular("resúmemelo para el directorio") && esReformular("¿y para comercial?"),
    "★ las reformulaciones enteras siguen siendo reformular: nada de lo probado en vivo se afloja");
  ok(presentacionPosterior("Ahora para directorio.") === null && presentacionPosterior("¿qué pasó después de marzo?") === null && presentacionPosterior("dame los 3 riesgos para el directorio") === null,
    "…sin encargo delante no hay «posterior», y «después de marzo» no es presentación");
  ok(pbPara(OWNER, {}) && pbPara(OWNER, {}).nombre === "resumen-del-negocio" && pbPara(P1, {}).nombre === "resumen-del-negocio",
    "★★ la foto del negocio toma el encargo aunque termine en «para directorio»: la audiencia final no la retira");
  ok(pbPara("dame los 3 riesgos para el directorio", {}).nombre === "sintesis-ejecutiva" && pbPara("¿Cómo va el negocio?", {}).nombre === "resumen-del-negocio",
    "…y «los 3 riesgos para el directorio» sigue siendo de la síntesis: ahí el directorio es el tema, no la presentación");
  ok(sinPresentacionPosterior(P3) === "Analiza la cartera: quién sostiene ventas, quién destruye margen, dónde está la mayor recuperación y qué tres cuentas revisarías primero.",
    "los procedimientos leen el encargo sin la instrucción de presentación");
  /* de punta a punta con el cerebro mudo: el turno YA NO se corta en el atajo — lee, y le llevan al cerebro el
   * procedimiento con la forma del encargo y el molde del lector, pero NO la doctrina de «no salgas a leer» */
  let capt = null;
  const MUDO4 = async ({ mensajes }) => { if (!capt) capt = mensajes; return { tipo: "texto", texto: "" }; };
  const r = await answerViaAgente({ text: OWNER, history: [], mem: {}, scenario: ESC, callAgente: MUDO4 });
  ok(r.r.agente.estado !== "sin-que-reformular" && r.r.agente.calls >= 3, `★★ la pantalla del owner ya no se corta en el atajo: el turno lee (${r.r.agente.calls} herramientas, ${r.r.agente.estado})`);
  ok(!/Todavía no te he respondido nada/.test(String(r.r.text || "")), "…y la frase que vio el owner no sale");
  const docs = (capt || []).filter((m) => m.role === "user").map((m) => String(m.content || ""));
  ok(!docs.some((d) => /TE PIDIERON LA MISMA RESPUESTA DICHA DE OTRA MANERA/.test(d)), "★ la doctrina de reformular («no salgas a leer») NO viaja en un encargo");
  ok(docs.some((d) => /ESTE TURNO ES PARA EL DIRECTORIO/i.test(d)), "…el molde del directorio SÍ viaja");
  ok(docs.some((d) => /FORMA \(encargo compuesto\)/.test(d) && /cierra con la versión para el directorio/.test(d)), "…y la forma del turno dice: una sola lectura, y la versión para el directorio al final");
  ok(/lectura completa del negocio/.test(doctrinaDelPlaybook(pbPara(OWNER, {}), OWNER)), "…con el entregable completo de la foto, no el corto que «ofrece» el resto");
}

console.log(`\n── _reformular_gate: ${pass} PASS · ${fail} FAIL (de ${pass + fail}) ──`);
process.exit(fail === 0 ? 0 : 1);
