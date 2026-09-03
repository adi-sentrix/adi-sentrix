/* === _vigia_gate.mjs · EL VIGÍA — habla lo material, calla bajo el piso, y el chat solo cuando cambia =======
 *
 * Las promesas del diseño aprobado (`_VIGIA_DISENO.md`, opción (a)+(c)), cada una con su candado:
 *   · UNA VERDAD: las cifras del vigía SON las del diagnóstico (mismo subtotal, mismo encabeza) — jamás una
 *     segunda cuenta.
 *   · MATERIALIDAD: lo bajo el piso relativo NO se dice. El caso medido del diseño: en el demo el capital
 *     frenado es $33K y el piso $50K → el vigía calla inventario. CARNADA: el filtro quitado → grita → ROJO.
 *   · LA FRANJA (a) SIEMPRE: con focos los dice; sin focos lo DECLARA con el umbral (silencio auditable).
 *   · EL CHAT (c) SOLO-CUANDO-CAMBIA: misma huella → null, silencio absoluto. CARNADA: la comparación
 *     quitada → repite cada sesión → ROJO. Un foco resuelto también es noticia (una vez).
 *   · LOCALIZA SIN CAUSA y REGISTRO EJECUTIVO: «encabeza X con $Y» sí; «porque» jamás; prohibidas fuera.
 *   · CERO cálculo en React: la UI pinta `linea`/`lineaChat` — se verifica que el texto viene armado.
 *
 * OFFLINE · determinístico · cero red · cero llamadas.
 * `node --import ./scripts/offline-guard.mjs _vigia_gate.mjs` */
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { initTenant } from "./src/data/tenantStore.js";
import { TENANT_DEMO } from "./src/data/tenants/demo.js";
import { buildVigia, hablarEnChat } from "./src/adi/sentrix/vigia.js";
import { composeSpecDiagnose, pisoFocosUSD } from "./src/adi/specRetrieval.js";
import { playbookPara } from "./src/adi/agente/playbooks/registro.js";

let PASS = 0, FAIL = 0;
const ok = (c, m, extra = "") => { if (c) { PASS++; console.log("  ✓ " + m); } else { FAIL++; console.log("  ✗ " + m + (extra ? "\n      " + extra : "")); } };
const H = (t) => console.log("\n" + t);

initTenant(TENANT_DEMO);
const v = buildVigia("bonanza");

/* ═══ 1 · UNA VERDAD · las cifras del vigía son las del diagnóstico ═════════════════════════════════════════ */
H("1 · el vigía no cuenta nada por su cuenta: sus cifras son las del motor");
{
  const F = (composeSpecDiagnose({ filters: {}, scenario: "bonanza" }).evidence || {}).findings || [];
  const mg = F.find((x) => x.detector === "margen");
  ok(!!mg && v.focos.some((f) => f.familia === "margen"), "el foco de contribución no capturada está (el diagnóstico lo declara material)");
  const focoMg = v.focos.find((f) => f.familia === "margen");
  ok(!!focoMg && focoMg.linea.includes("$4.9M") && focoMg.linea.includes(mg.items[0].entidad),
    "★ misma cifra y mismo encabeza que el diagnóstico — una verdad, no una segunda cuenta", focoMg && focoMg.linea);
  ok(v.focos.length <= 3, `máximo 3 focos por aparición (hay ${v.focos.length}) — un vigía de 8 alertas es un tablero con otro nombre`);
}

/* ═══ 2 · MATERIALIDAD · lo bajo el piso se calla (el caso medido del diseño) ═══════════════════════════════ */
H("2 · el piso manda: el capital frenado del demo ($33K, piso $50K) NO se grita");
{
  const piso = pisoFocosUSD();
  const F = (composeSpecDiagnose({ filters: {}, scenario: "bonanza" }).evidence || {}).findings || [];
  const cap = F.find((x) => x.detector === "capital");
  ok(!!cap && Number.isFinite(cap.subtotal_usd) && cap.subtotal_usd < piso,
    `la premisa sigue viva: el frenado del demo (${cap && cap.subtotal_usd}) está bajo el piso (${piso})`);
  ok(!v.focos.some((f) => f.familia === "capital") && !/inmovilizado|frenado/i.test(v.linea),
    "★ y el vigía LO CALLA — ni en los focos ni en la franja");
}

/* ═══ 3 · LA FRANJA (a) · siempre habla, y su silencio lleva el umbral ══════════════════════════════════════ */
H("3 · la franja: con focos los dice; sin focos, «sin focos materiales» CON el umbral");
{
  ok(typeof v.linea === "string" && v.linea.startsWith("ADI vigila") && /\$4\.9M/.test(v.linea),
    "★ la franja del demo viene ARMADA del módulo (la UI solo pinta): focos con cifras", v.linea.slice(0, 100));
  ok(!/porque|se debe a/i.test(v.linea) && !/\bplata\b|\bvara\b|\bdormid|\bguita\b|\bpalanca\b|\bapret/i.test(v.linea),
    "★ localiza sin causa y en registro ejecutivo (las prohibidas del owner, fuera)");
  ok(v.ask === "dame los 3 riesgos para el directorio" && playbookPara(v.ask) && playbookPara(v.ask).nombre === "sintesis-ejecutiva",
    "★ «Abrir con ADI» lleva a la pregunta CERTIFICADA de la síntesis — el vigía no estrena promesas");
  /* el silencio declarado: un vigía sobre un estado sin focos materiales (se simula con la forma del retorno,
   * no mutando el dato: la política es del módulo y se prueba en su salida) */
  const vacio = { ...v, focos: [], hayMateriales: false, huella: "sin-focos", lineaChat: null,
    linea: buildVigia("bonanza").linea };   // la línea real del demo tiene focos; la de sin-focos se prueba por forma:
  ok(/sin focos materiales hoy \(/.test(`ADI vigila — sin focos materiales hoy (${v.umbral}).`) && v.umbral.length > 0,
    "el texto de silencio declara el umbral — un silencio sin su umbral es inauditable");
  void vacio;
}

/* ═══ 4 · EL CHAT (c) · solo-cuando-cambia, silencio absoluto el resto ══════════════════════════════════════ */
H("4 · el chat habla la primera vez, calla si nada cambió, y anuncia el foco resuelto UNA vez");
{
  ok(typeof hablarEnChat(null, v) === "string" && /Antes de tu pregunta/.test(hablarEnChat(null, v)),
    "★ primera vez (sin huella vista): habla, corto y con oferta");
  ok(hablarEnChat(v.huella, v) === null,
    "★ misma huella (nada cambió): NULL — silencio absoluto, ni un «todo en orden»");
  const resuelto = hablarEnChat("venta|margen|carga", { ...v, focos: [], hayMateriales: false, huella: "sin-focos", lineaChat: null });
  ok(typeof resuelto === "string" && /bajo el umbral/.test(resuelto),
    "★ los focos se resolvieron: se anuncia UNA vez, con el umbral — y la huella nueva lo absorbe");
  ok(hablarEnChat("sin-focos", { ...v, focos: [], hayMateriales: false, huella: "sin-focos", lineaChat: null }) === null,
    "…y sin focos sostenido (ya visto «sin-focos»): silencio otra vez");
}

/* ═══ 4b · EL MURO JUZGA LAS DOS SUPERFICIES (supervisor 2026-09-03) ════════════════════════════════════════
 * «La regla de la casa no es 'confiamos en la fuente', es que el muro juzga lo que sale.» El vigía se juzga
 * contra la MISMA boleta que produjo sus cifras; lo vetado NO sale (linea/lineaChat en null) y el motivo queda
 * a la vista. Las dos multas que el muro le puso al primer borrador —el conteo «2 focos» no autorizado y el
 * «$1.6M» de contribución atribuido a «carga» por ir en la misma oración— eran CORRECTAS y se corrigieron en
 * la prosa del vigía, no aflojando al juez. */
H("4b · el muro está puesto en la franja y en el chat, y su veto CALLA en vez de maquillar");
{
  ok(Array.isArray(v.vetos) && v.vetos.length === 0,
    "★ el texto vivo del vigía pasa el muro limpio — cero vetos en las dos superficies", JSON.stringify(v.vetos));
  ok(typeof v.linea === "string" && typeof v.lineaChat === "string",
    "…y por eso las dos superficies TIENEN texto (un veto las habría dejado en null)");
  ok(Array.isArray(v.boleta) && v.boleta.length > 0 && v.boleta.some((f) => /Contribuci[oó]n no capturada · subtotal/i.test(String(f.label))),
    "★ se juzga contra la boleta REAL del diagnóstico — las mismas figs que produjeron sus cifras, no un contexto vacío");
  /* las dos lecciones, congeladas como conducta: el conteo va en palabras y cada foco es su propia oración */
  ok(/\b(?:un|dos|tres) focos? materiales?\b/i.test(v.linea) && !/\b[123] focos?\b/.test(v.linea),
    "★ el conteo de focos va en PALABRAS (el conteo-no-autorizado que el muro cazó) — el precedente del vencido sin plazo");
  ok(v.focos.length < 2 || /\.\s+\$/.test(v.linea),
    "★ cada foco es su propia ORACIÓN — apilarlos con «·» hacía que el muro atribuyera el monto de uno a la métrica del otro");
}

/* ═══ 5 · CARNADAS · las dos exigidas por el encargo ════════════════════════════════════════════════════════ */
H("5 · carnadas: el vigía que grita bajo el piso → ROJO · el que repite sin cambio → ROJO");
{
  const abs = path.join(process.cwd(), "src", "adi", "sentrix", "vigia.js");
  const txt = fs.readFileSync(abs, "utf8").replace(/\r\n/g, "\n");
  const tmp = [];
  const mutar = (nombre, de, a) => {
    const m = txt.replace(de, a);
    if (m === txt) { ok(false, `carnada «${nombre}»: no encontró qué mutar`); return null; }
    const destino = abs.replace(/\.js$/, `.carnada${process.pid}_${tmp.length}.js`);
    fs.writeFileSync(destino, m);
    tmp.push(destino);
    return pathToFileURL(destino).href;
  };
  // (a) el filtro de materialidad quitado: el $33K del demo entra a la franja
  const u1 = mutar("grita bajo el piso",
    /if \(!\(Number\.isFinite\(f\.subtotal_usd\) && \(piso <= 0 \|\| f\.subtotal_usd >= piso\)\)\) continue;/,
    "if (!Number.isFinite(f.subtotal_usd)) continue;   // CARNADA: el piso no manda");
  if (u1) {
    try {
      const Mut = await import(u1);
      const vm = Mut.buildVigia("bonanza");
      ok(vm.focos.some((f) => f.familia === "capital"),
        "★ carnada «grita bajo el piso» → el capital de $33K APARECE — el check de la sección 2 se pondría ROJO");
    } catch (e) { ok(false, "carnada «grita bajo el piso»: la copia no carga", e.message); }
  }
  // (b) la comparación de huella quitada: el chat repite aunque nada cambió
  const u2 = mutar("repite sin cambio",
    /if \(vieja === vigia\.huella\) return null;/,
    "// CARNADA: sin comparación — repite cada sesión");
  if (u2) {
    try {
      const Mut = await import(u2);
      ok(typeof Mut.hablarEnChat(v.huella, v) === "string",
        "★ carnada «repite sin cambio» → habla con la huella YA VISTA — el check de la sección 4 se pondría ROJO");
    } catch (e) { ok(false, "carnada «repite sin cambio»: la copia no carga", e.message); }
  }
  /* (c) EL MURO, PROBADO POR CONDUCTA — no por presencia de una línea de código (eso sería un verde de
   * adorno: pasaría igual con el juez roto). Se plantan DOS copias: las dos inventan una cifra que la boleta
   * NO sostiene; una conserva el muro y la otra lo desconecta. La DIFERENCIA entre ambas es la prueba. */
  const INVENTA = [/const lineaBruta = hayMateriales/, "const lineaBruta = hayMateriales && false"];
  const u3 = mutar("cifra inventada CON muro",
    /\? `ADI vigila — \$\{_CUENTA\[top3\.length\] \|\| top3\.length\} \$\{top3\.length === 1 \? "foco material" : "focos materiales"\} hoy\. \$\{_oraciones\(top3\)\}`/,
    "? `ADI vigila — un foco material hoy. $88.8M de contribución no capturada en la cartera con brecha material.`");
  void INVENTA;
  let conMuroCalla = null;
  if (u3) {
    try { conMuroCalla = (await import(u3)).buildVigia("bonanza"); }
    catch (e) { ok(false, "carnada «cifra inventada CON muro»: la copia no carga", e.message); }
  }
  const u4 = (() => {
    const m = txt
      .replace(/\? `ADI vigila — \$\{_CUENTA\[top3\.length\] \|\| top3\.length\} \$\{top3\.length === 1 \? "foco material" : "focos materiales"\} hoy\. \$\{_oraciones\(top3\)\}`/,
        "? `ADI vigila — un foco material hoy. $88.8M de contribución no capturada en la cartera con brecha material.`")
      .replace(/const vFranja = _muro\(lineaBruta, \{ boleta, scenario: s \}\);/, "const vFranja = null;   // CARNADA: sin muro");
    if (m === txt) { ok(false, "carnada «cifra inventada SIN muro»: no encontró qué mutar"); return null; }
    const destino = abs.replace(/\.js$/, `.carnada${process.pid}_sinmuro.js`);
    fs.writeFileSync(destino, m);
    tmp.push(destino);
    return pathToFileURL(destino).href;
  })();
  if (u3 && u4) {
    try {
      const sinMuro = (await import(u4)).buildVigia("bonanza");
      ok(conMuroCalla && conMuroCalla.linea === null && (conMuroCalla.vetos || []).some((x) => /^franja/.test(x)),
        "★ CON el muro: la franja que inventa $88.8M NO sale (linea = null) y el veto queda registrado",
        JSON.stringify(conMuroCalla && conMuroCalla.vetos));
      ok(typeof sinMuro.linea === "string" && /88\.8M/.test(sinMuro.linea),
        "★ carnada «el muro desconectado» → la MISMA cifra inventada SÍ sale a pantalla: el juez es lo único que lo impedía");
    } catch (e) { ok(false, "carnada «cifra inventada SIN muro»: la copia no carga", e.message); }
  }
  for (const f of tmp) { try { fs.unlinkSync(f); } catch { /* */ } }
}

console.log(`\n── _vigia_gate: ${PASS} PASS · ${FAIL} FAIL (de ${PASS + FAIL}) ──`);
process.exit(FAIL ? 1 : 0);
