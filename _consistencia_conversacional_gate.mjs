/* === _consistencia_conversacional_gate.mjs · LA EQUIVALENCIA COMO PROPIEDAD (owner 2026-08-31) ==============
 *
 * SU CRITERIO DE CIERRE, textual: «preguntas equivalentes deben producir respuestas equivalentes en tamaño,
 * foco y forma; si falta dato, límite corto con alternativa disponible; nunca disculpa vacía».
 *
 * LO QUE VIO EN LA CORRIDA 3, y que este candado existe para que no vuelva:
 *   · T17 · T19 · T24 · T27 — cuatro preguntas de familias DISTINTAS, la MISMA cadena de 153 caracteres:
 *     «No pude armar la lectura nueva que pediste. Lo que te respondí recién sigue verificado y en pie…».
 *   · T6 (210 chars, una disculpa con una cifra) contra T12 (1.183 chars, la tabla entera) — misma cartera.
 *
 * LAS TRES CAUSAS, medidas antes de construir (ninguna del modelo, ninguna del muro — las tres determinísticas
 * y de este lado de la casa):
 *   C1 · la rama «pantalla repetida» del respaldo devolvía una frase FIJA, y su condición
 *        (`ultimaAprobada === recentNarrations[0]`) es verdadera POR CONSTRUCCIÓN tras cualquier turno
 *        aprobado: una salvaguarda de caso raro convertida en la respuesta por defecto.
 *   C2 · con esa frase en el hilo, el cerebro la copiaba (T20). Muere sola cuando el peldaño deja de tener UNA
 *        frase: por eso no se persigue aparte.
 *   C3 · el peldaño de límite elegía UNA cifra y, si el muro la vetaba, se rendía. Medido: «Q1 vs Q2» llegaba
 *        con 46 cifras verificadas, elegía «Venta del período = $100.0M» (derivada no reconciliada, vetada con
 *        razón) y el usuario recibía «No tengo información autorizada suficiente» con la serie en la mano.
 *
 * ⚠️ NADA DE ESTO ES «MÁS SEGURIDAD» (la orden del owner lo dice explícito): guardC y la boleta no se tocan.
 * Es nivelar la conducta hacia arriba.
 *
 * OFFLINE · determinístico · cerebro = guion · CERO llamadas al modelo · bandera ADI_AGENTE APAGADA.
 * `node --import ./scripts/offline-guard.mjs _consistencia_conversacional_gate.mjs` */
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { initTenant } from "./src/data/tenantStore.js";
import { TENANT_DEMO } from "./src/data/tenants/demo.js";
import { answerViaAgente } from "./src/adi/agente/bucleAgente.js";
import { _respaldoDeLoYaAprobado } from "./src/adi/oracle/respaldoAprobado.js";   // (B) del owner: el peldaño compartido, probado en sus dos modos (módulo propio desde el paso 0 de la Poda)

let pass = 0, fail = 0;
const ok = (cond, label, detalle) => {
  if (cond) { pass++; console.log(`  ✓ ${label}`); }
  else { fail++; console.log(`  ✗ ${label}`); if (detalle !== undefined) console.log(`      ${detalle}`); }
};
const H = (t) => console.log(`\n${t}`);
const MUDO = async () => ({ tipo: "texto", texto: "" });
/** un turno con el cerebro que NO logra componer: corre las herramientas que le tocan y cae a la escalera. */
const turno = (text, pedidos = [], mem = {}) => answerViaAgente({ text, history: [], mem, scenario: "bonanza",
  callAgente: async ({ ronda }) => (ronda === 1 && pedidos.length ? { tipo: "herramientas", pedidos } : { tipo: "texto", texto: "" }) });

/* las cuatro familias del expediente, cada una con la lectura que le corresponde.
 * ⚠️ RE-APUNTADO 2026-09-02 (el precedente vive en la sección 2, «sin "%" a propósito»): «Q1 vs Q2» y «riesgos
 * para directorio» ganaron camino garantizado (limite-honesto · sintesis-ejecutiva) y ya no llegan al peldaño
 * que ESTE gate mide. Se cambia el VEHÍCULO —preguntas sin dueño, mismo guion y misma herramienta— y la
 * conducta nueva de aquellas dos se certifica donde corresponde: §1g del gate de playbooks. */
const FAMILIAS = [
  ["periodo", "compara marzo vs abril en ventas, margen y contribución", [{ tool: "trend", args: {} }]],
  ["directorio", "dame un resumen para el equipo con los 3 focos principales", [{ tool: "diagnose", args: {} }]],
  ["inventario", "ranking de SKU por peor rotación cruzado con margen", [{ tool: "inventoryStatus", args: {} }]],
  ["cartera", "qué clientes están bajo el benchmark de margen", [{ tool: "marginRead", args: { focus: "bajo_benchmark", dimension: "cliente" } }]],
];

/* ═══ 1 · NUNCA LA MISMA CADENA PARA FAMILIAS DISTINTAS ══════════════════════════════════════════════════════ */
H("1 · cuatro familias distintas → cuatro respuestas distintas (el molde único, muerto)");
initTenant(TENANT_DEMO);
const salidas = [];
for (const [fam, q, pedidos] of FAMILIAS) {
  const r = await turno(q, pedidos);
  salidas.push({ fam, texto: String(r.r.text || ""), estado: r.r.agente.estado, figs: r.r.agente.figs });
}
{
  const textos = salidas.map((s) => s.texto.trim());
  ok(new Set(textos).size === textos.length,
    `★ ${textos.length} familias → ${new Set(textos).size} textos distintos`,
    salidas.map((s) => `${s.fam}:${s.texto.length}`).join(" · "));
  ok(!textos.some((t) => /sigue verificado y en pie — dime qué parte profundizo/.test(t)),
    "★ la cadena de 153 chars que recibieron T17·T19·T24·T27 no existe más");
  /* ⚠️ EL ALCANCE, ACOTADO POR EL OWNER: la frase SIGUE VIVA para el camino natural, que corre en producción
   * («no quiero que una reparación diseñada y medida para el agente cambie de rebote ADI_CAMINO_NATURAL»). Lo
   * que se exige acá es que el AGENTE no la use nunca; que el natural la conserve BYTE-IDÉNTICA se prueba en
   * la sección 6, y su corrección propia es un encargo futuro (§11c del F1). */
  // (el cuerpo del peldaño vive en respaldoAprobado.js desde el paso 0 de la Poda — el check lee al módulo compartido)
  const src = fs.readFileSync(path.join(process.cwd(), "src", "adi", "oracle", "respaldoAprobado.js"), "utf8");
  ok(/if \(contexto\.cederSiRepetida\) return null;/.test(src),
    "…y en el agente la frase no se usa: el peldaño cede cuando el caller lo pide");
}

/* ═══ 2 · NUNCA DISCULPA VACÍA · con evidencia en la mano, se responde con ella ═══════════════════════════════
 * El criterio se mide donde tiene sentido: si el turno TRAJO cifras, su respuesta tiene que citar una o
 * nombrar una alternativa concreta. Con la boleta vacía y sin memoria no hay nada que ofrecer, y decirlo es
 * honesto — pero eso ya no puede pasar en un turno que sí leyó. */
H("2 · un turno con cifras en la boleta jamás sale con una disculpa pelada");
{
  for (const s of salidas) {
    const citaCifra = /\$\s?[\d.,]+\s?[KMB]?|[\d.,]+\s*%/.test(s.texto);
    const ofrece = /también tengo/i.test(s.texto);
    ok(s.figs > 0 && (citaCifra || ofrece),
      `«${s.fam}» (${s.figs} figs) responde con cifra o alternativa nombrada`, s.texto.slice(0, 110));
  }
  const conAlternativa = salidas.filter((s) => /también tengo .+ y .+: ¿te abro alguno\?/i.test(s.texto)).length;
  ok(conAlternativa >= 3, `★ y la alternativa va NOMBRADA, no «pídeme otro corte» (${conAlternativa} de ${salidas.length})`);

  /* ⚠️ LA ALTERNATIVA SE LE OFRECE A UNA PERSONA, ASÍ QUE VA EN SU IDIOMA (certificación 2026-09-01): en el
   * turno 4 salió a pantalla «también tengo Valor y headlineSub», un nombre de campo del motor. El filtro de
   * jerga descartaba por PREFIJO («Medida…», «Vs…», «% …») y `headlineSub` no empieza con ninguno.
   *
   * ESTE TURNO ES EL DE LA CERTIFICACIÓN, REPRODUCIDO: misma pregunta, misma herramienta, mismo resultado
   * (`estado=limite`, 32 cifras). Primero lo escribí sobre las cuatro familias de arriba y quedaba VERDE con
   * el filtro quitado —ninguna de ellas trae un label camelCase—: era un verde de adorno, o sea un check
   * falso. El turno que SÍ lo produce es el único que prueba algo. */
  {
    /* sin «%» a propósito (re-apuntado 2026-09-01): con «+4%» el playbook proyección-declarada compone la
     * respuesta y este turno ya no llega al peldaño de la alternativa — que es lo que ESTE check mide. Sin
     * supuesto en la pregunta C se retira, `salesRead` sigue dejando su boleta, y el peldaño ofrece. */
    const r4 = await turno("Con ese total anual, dime cuánto genera adicional el año que viene.",
      [{ tool: "salesRead", args: {} }]);
    const t4 = String(r4.r.text || "");
    const fugado = (t4.match(/\b[a-z]{2,}[a-z0-9]*[A-Z][A-Za-z0-9]*\b/g) || [])[0] || null;
    /* LOS DOS ARREGLOS SE NECESITAN, y este check lo prueba junto: si la FUENTE vuelve a ofrecer jerga, el
     * juez del contrato —que ahora sí caza el camelCase— veta la línea honesta y el turno se desploma al
     * genérico pelado («No tengo información autorizada suficiente», estado `vacio`). Medido con la carnada:
     * arreglar solo el juez empeoraría la respuesta en vez de mejorarla. Por eso se exige LA CONDUCTA
     * COMPLETA —ofrece alternativa Y en idioma del usuario—, no una de las dos mitades. */
    ok(/también tengo/.test(t4) && !fugado && r4.r.agente.estado === "limite",
      "★ T4 de la certificación · ofrece alternativa Y en palabras del negocio — antes: «Valor y headlineSub»",
      `estado=${r4.r.agente.estado} figs=${r4.r.agente.figs} fugado=${fugado || "-"} · ${t4.slice(0, 110)}`);
  }
}

/* ═══ 3 · C3 · EL PELDAÑO NO SE RINDE CON LA PRIMERA CIFRA ═══════════════════════════════════════════════════ */
H("3 · con 46 cifras en la boleta, el rescate encuentra una servible");
{
  // el vehículo sin dueño (ver la nota de FAMILIAS): «Q1 vs Q2» ahora lo compone limite-honesto y no llega acá
  const r = await turno("compara marzo vs abril en ventas, margen y contribución", [{ tool: "trend", args: {} }]);
  ok(r.r.agente.figs > 40, `el turno traía la serie entera (${r.r.agente.figs} figs)`);
  ok(r.r.agente.estado !== "vacio", `y NO cae al genérico pelado (${r.r.agente.estado}) — antes: «vacio»`);
  ok(/\$92\.9M/.test(r.r.text),
    "★ sirve una cifra que el muro SÍ acepta (la del año anterior), no la que vetó", r.r.text.slice(0, 150));
  ok(!/No tengo información autorizada suficiente/.test(r.r.text),
    "★ y el «no tengo información suficiente» con la serie en la mano no vuelve");
  // UNA CIFRA POR ORACIÓN — la regla que P1a dejó escrita con sangre
  for (const oracion of r.r.text.split(/(?<=\.)\s+/)) {
    const n = (oracion.match(/\$\s?[\d.,]+\s?[KMB]?|[\d.,]+\s*%/g) || []).length;
    ok(n <= 1, `una cifra por oración como máximo (${n})`, oracion.slice(0, 90));
  }
}

/* ═══ 4 · TAMAÑOS COMPARABLES DENTRO DE LA MISMA FAMILIA ═════════════════════════════════════════════════════
 * El contraste que abrió el encargo: T6 (210 chars) contra T12 (1.183) en la misma cartera. Con el playbook,
 * las dos preguntas de esa familia entregan la MISMA lectura, así que la equivalencia es propiedad y no caso. */
H("4 · misma familia, tamaños comparables (el contraste 6 vs 12)");
{
  const a = await turno("llamame jc de ahora en adelante. como viene mi margen?");
  const b = await turno("De los clientes bajo benchmark, dime cuáles son prioridad 1, 2 y 3");
  const la = a.r.text.length, lb = b.r.text.length;
  const ratio = Math.max(la, lb) / Math.max(1, Math.min(la, lb));
  ok(a.r.agente.estado === "playbook" && b.r.agente.estado === "playbook",
    `las dos preguntas de la familia cartera van por el mismo procedimiento (${a.r.agente.estado}/${b.r.agente.estado})`);
  ok(ratio <= 1.5, `★ tamaños comparables: ${la} vs ${lb} chars (${ratio.toFixed(2)}×) — el contraste medido era 5,6×`);
  ok(/\b8\b[^\n]{0,60}bajo (?:esa referencia|el benchmark)/i.test(a.r.text) && /\b8\b[^\n]{0,60}bajo (?:esa referencia|el benchmark)/i.test(b.r.text),
    "…y el foco es el mismo: las dos entregan la lectura, no una disculpa");
}

/* ═══ 6 · EL CAMINO NATURAL QUEDA BYTE-IDÉNTICO (la opción (B) del owner) ════════════════════════════════════
 * «No quiero que una reparación diseñada y medida para el agente cambie de rebote ADI_CAMINO_NATURAL en
 * producción» (textual — dicho cuando el natural corría en prod).
 * (La Poda 2026-09-05: el orquestador del natural se retiró del código. La rama SIN señal de este módulo
 * compartido quedó sin caller — se conserva como contrato de la función y este check la documenta
 * byte-idéntica; retirarla es un pendiente menor anotado, no una conducta viva de producción.) */
H("6 · el arreglo vive solo donde el examen lo midió: la rama sin señal, intacta (hoy sin caller)");
{
  const YA_VISTO = "Las ventas totales del negocio suman $99.9M contra un presupuesto de $97.0M.";
  const memIn = { ultimaAprobada: YA_VISTO, recentNarrations: [YA_VISTO] };
  const ctx = { pregunta: "dame un resumen para directorio con los 3 riesgos", entidades: [], recienMostrado: YA_VISTO };
  const natural = _respaldoDeLoYaAprobado(memIn, null, ctx);                          // sin la señal → camino natural
  const agente = _respaldoDeLoYaAprobado(memIn, null, { ...ctx, cederSiRepetida: true });   // con la señal → agente
  ok(typeof natural === "string" && /sigue verificado y en pie — dime qué parte profundizo/.test(natural),
    "★ el camino natural conserva su conducta de hoy, byte-idéntica", String(natural).slice(0, 80));
  ok(agente === null, "★ y el agente cede, para caer a su límite con alternativa");
  const F1 = fs.readFileSync(path.join(process.cwd(), "_ADI_AGENTE_F1_DISENO.md"), "utf8");
  // (el markdown mete negritas en medio de la frase — se buscan los dos hechos, no una cadena literal)
  ok(/11c · EL FALLBACK PROPIO DEL CAMINO NATURAL/.test(F1) && /fallback propio.*ejecutivo y breve/i.test(F1)
    && /\bNO\b\**\s*el tablero de KPIs/i.test(F1),
    "…y el pendiente del owner queda anotado en el mapa: fallback propio del camino natural, NO el tablero");
}

/* ═══ 5 · CARNADAS ══════════════════════════════════════════════════════════════════════════════════════════ */
H("5 · CARNADA · cada garantía, probada ROJA con el defecto adentro");
{
  const tmp = [];
  let n = 0;
  const mutar = (rel, reemplazos) => {
    const abs = path.join(process.cwd(), rel);
    let txt = fs.readFileSync(abs, "utf8").replace(/\r\n/g, "\n");
    for (const [de, a] of reemplazos) {
      const antes = txt;
      txt = txt.replace(de, a);
      if (txt === antes) return { error: `la carnada no encontró qué mutar en ${rel}` };
    }
    const destino = abs.replace(/\.js$/, `.carnada${process.pid}_${++n}.js`);
    fs.writeFileSync(destino, txt);
    tmp.push(destino);
    return { url: pathToFileURL(destino).href };
  };
  const carnada = async (nombre, rel, reemplazos, prueba) => {
    const m = mutar(rel, reemplazos);
    if (m.error) return ok(false, `carnada «${nombre}»`, m.error);
    let cazada = false, detalle = "";
    try { cazada = await prueba(await import(m.url)); }
    catch (e) { detalle = `la copia mutada ni siquiera carga: ${e.message}`; }
    ok(cazada, `carnada «${nombre}» → el chequeo se pone ROJO`, detalle || "el defecto pasó DESAPERCIBIDO");
  };
  const turnoMut = (Mut, text, pedidos = [], mem = {}) => Mut.answerViaAgente({ text, history: [], mem, scenario: "bonanza",
    callAgente: async ({ ronda }) => (ronda === 1 && pedidos.length ? { tipo: "herramientas", pedidos } : { tipo: "texto", texto: "" }) });

  // (a) C1 · la frase fija de vuelta: las familias distintas vuelven a compartir cadena
  await carnada("la frase de molde reinstalada (C1)", "src/adi/oracle/respaldoAprobado.js",
    // el defecto que se reinstala: el AGENTE deja de ceder y vuelve a comer la frase de molde
    [[/    if \(contexto\.cederSiRepetida\) return null;\n/, ""]],
    /* se prueba EL PELDAÑO, no el bucle: la copia mutada de caminoNatural no es la que el bucle importa, y lo
     * que hay que cazar es exactamente su salida — la misma frase para dos preguntas de familias distintas. */
    async (Mut) => {
      const YA_VISTO = "Las ventas del período del año anterior sumaron $92.9M.";
      const memIn = { ultimaAprobada: YA_VISTO };
      const a = Mut._respaldoDeLoYaAprobado(memIn, null, { pregunta: "dame un resumen para directorio con los 3 riesgos", entidades: [], recienMostrado: YA_VISTO });
      const b = Mut._respaldoDeLoYaAprobado(memIn, null, { pregunta: "dame una versión más dura para el gerente", entidades: [], recienMostrado: YA_VISTO });
      return typeof a === "string" && a === b && /sigue verificado y en pie/.test(a);   // el defecto: molde único
    });

  // (b) C3 · el peldaño se rinde con la primera cifra: vuelve el genérico con la boleta llena
  await carnada("el rescate se rinde con la primera cifra (C3)", "src/adi/agente/bucleAgente.js",
    [[/  for \(const fig of candidatas\.slice\(0, TOPE_INTENTOS\)\) \{/, "  for (const fig of candidatas.slice(0, 1)) {"],
     [/  const sinCifra = _armar\(null\);\n  return _pasa\(sinCifra\) \? sinCifra : null;/, "  return null;"]],
    async (Mut) => {
      initTenant(TENANT_DEMO);
      const r = await turnoMut(Mut, "compara marzo vs abril en ventas, margen y contribución", [{ tool: "trend", args: {} }]);
      return r.r.agente.figs > 40 && /No tengo información autorizada suficiente/.test(r.r.text);
    });

  // (c) la alternativa sin nombrar: vuelve el «pídeme otro corte» genérico
  await carnada("alternativa sin nombrar", "src/adi/agente/bucleAgente.js",
    [[/    return nombres\.length \? `De este mismo turno también tengo \$\{nombres\.join\(" y "\)\}: ¿te abro alguno\?` : null;/,
      "    return null;"]],
    async (Mut) => {
      initTenant(TENANT_DEMO);
      const r = await turnoMut(Mut, "ranking de SKU por peor rotación cruzado con margen", [{ tool: "inventoryStatus", args: {} }]);
      return !/también tengo/i.test(r.r.text);
    });

  for (const f of tmp) { try { fs.unlinkSync(f); } catch { /* */ } }
}

initTenant(TENANT_DEMO);
console.log(`\n── _consistencia_conversacional_gate: ${pass} PASS · ${fail} FAIL (de ${pass + fail}) ──`);
process.exit(fail ? 1 : 0);
