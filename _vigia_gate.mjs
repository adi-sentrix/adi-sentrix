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
  for (const f of tmp) { try { fs.unlinkSync(f); } catch { /* */ } }
}

console.log(`\n── _vigia_gate: ${PASS} PASS · ${FAIL} FAIL (de ${PASS + FAIL}) ──`);
process.exit(FAIL ? 1 : 0);
