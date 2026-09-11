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
  ok(/import \{ esReformular, doctrinaDeReformular, vetosDeReformular, componerReformulacion, destinatarioDe, doctrinaDeAudiencia \}/.test(bucle), "el bucle la importa");
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

console.log(`\n── _reformular_gate: ${pass} PASS · ${fail} FAIL (de ${pass + fail}) ──`);
process.exit(fail === 0 ? 0 : 1);
