/* === _pnl_conversation_scope_gate.mjs · GATE · Etapa 3/5 (owner 2026-08-04) — wiring de P&L a conversationScope ===
 * Verifica los 2 lados del wiring diseñado (pnlPlan del integrador, sin reescribir el motor de P&L — _draft/_lines/
 * _scope/detectPnlIntent/buildPnlCascade intactos):
 *
 * LADO A · ENTRADA (pnl.js, _scopeEntidadEn + los 2 sitios de fallback en composePnl, líneas ~1370/~1533): cuando
 * el hilo PROPIO de P&L (_scope) no trae entidad, composePnl ahora consulta conversationScope.current ANTES de la
 * boleta V1 legacy (ctx.memoria.entidad) — nunca la pisa, solo se agrega como fuente intermedia. Se prueba vía
 * import DIRECTO de pnl.js (sin esbuild — pnl.js es JS puro, mismo patrón que _pnl_dive_precedencia_gate.mjs).
 *
 * LADO B · SALIDA (ChatADI.jsx, _pnlScopeProjection + el wiring en _turnFromResult): al SALIR de un turno de P&L
 * con una entidad EXPLÍCITA en foco (pnlScope() no-global), esa entidad se proyecta hacia
 * context.memoriaInteraccion.conversationScope.current — construyendo el MISMO shape que produce
 * updateConversationScope (conversationScope.js). Nunca escribe en turnos globales/sin P&L (guarda contra borrar
 * en silencio un foco de Oracle vigente). Se prueba vía `buildAdiTurn` (camino demo/piso, sync — no requiere
 * mockear fetch), bundleado con esbuild porque ChatADI.jsx es JSX — MISMO patrón que
 * _reentry_evidence_gate.mjs/_reentry_evidence_gate_entry.jsx. `buildAdiTurn` y las funciones de control de pnl.js
 * (setPnlLines/clearPnl/resetPnlDraft/pnlScope) se exportan del MISMO bundle para compartir el singleton de
 * módulo de pnl.js (_lines/_scope) — un import directo por separado sería una instancia de módulo DISTINTA.
 *
 * CERO llamadas LLM reales en todo el archivo: composePnl/buildAdiTurn (camino demo) son 100% síncronos y
 * determinísticos: no abren un socket ni pasan por el oráculo.
 *
 * ⚠️ LA FRASE DE ARRIBA NOMBRABA LAS DOS FUNCIONES DEL ORÁCULO, y con eso el clasificador de `gates-offline`
 * mandaba este gate a la lista LIVE: el comentario que declaraba su inocencia era lo que lo dejaba FUERA de la
 * corrida. Estuvo afuera desde el 2026-08-21 y nadie lo supo. Se dice lo mismo sin nombrarlas.
 *
 * ⚠️ EL TENANT SE DECLARA DOS VECES, Y NO ES UNA DUPLICADA — no borres ninguna.
 * El commit `26abfae` quitó el dataset por defecto de `tenantStore` (con razón: con el default puesto, el
 * bundle de producción se llevaba el dato de OTRA empresa), así que en Node lo declara quien corre. Pero acá
 * hay DOS instancias del store, no una:
 *   1· la del PROCESO de este gate — para `composePnl` y todo lo que se importa directo (LADO A).
 *   2· la del BUNDLE de esbuild — `buildAdiTurn` viaja en un bundle propio, con su propia copia de los módulos
 *      y por lo tanto su propio store, que la llamada del proceso NO alcanza. Es el mismo patrón que
 *      `_spec_gate` ya declara en su cabecera: «el entry re-exporta también initTenant/TENANT_DEMO: hay que
 *      declarárselo AL BUNDLE».
 * Medido el 2026-09-01: con solo la del proceso, 15 PASS · 2 FAIL — las dos que sobrevivían eran justamente
 * las del bloque bundleado. Con las dos, 17 · 0.
 */
import fs from "fs";
import { initTenant } from "./src/data/tenantStore.js";
import { TENANT_DEMO } from "./src/data/tenants/demo.js";
initTenant(TENANT_DEMO);   // (1) el store del PROCESO — ver la nota de arriba: la del bundle está más abajo
for (const ln of fs.readFileSync(".env", "utf8").split(/\r?\n/)) { const m = ln.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, ""); }

let pass = 0, fail = 0;
const ok = (cond, label) => { console.log(`  ${cond ? "✓" : "✗"} ${label}`); if (cond) pass++; else fail++; };

console.log("═".repeat(90));
console.log("LADO A · ENTRADA — pnl.js lee conversationScope.current (composePnl, import directo, sin esbuild)");
console.log("═".repeat(90));
{
  const { composePnl, setPnlLines, clearPnl, resetPnlDraft } = await import("./src/adi/pnl.js");
  const csCtx = (entities, dimension = "cliente") => ({ memoriaInteraccion: { conversationScope: { version: 1, current: { entities, dimension }, history: [] } } });

  console.log("\n── 1 · proyeccion_venta: SIN _scope propio ni pi.entidad, conversationScope.current (1 entidad) resuelve ──");
  {
    clearPnl(); resetPnlDraft(); setPnlLines([{ nombre: "Administrativos", pct: 1 }]);
    const r = composePnl({ action: "proyeccion_venta", ventaK: 6000 }, csCtx(["Sodimac"]), { scenario: "actual" });
    ok(r.evidence && r.evidence.entidad === "Sodimac", `ev.entidad === "Sodimac" — obtuvo ${JSON.stringify(r.evidence && r.evidence.entidad)}`);
  }

  console.log("\n── 2 · proyeccion_venta: conversationScope.current con 2+ entidades (lista) NO adivina — cae a \"el negocio\" ──");
  {
    clearPnl(); resetPnlDraft(); setPnlLines([{ nombre: "Administrativos", pct: 1 }]);
    const r = composePnl({ action: "proyeccion_venta", ventaK: 6000 }, csCtx(["Sodimac", "Jumbo"]), { scenario: "actual" });
    ok(!r.evidence.entidad && r.evidence.dimension === "cliente", `sin entidad puntual, dimension="cliente" (negocio) — obtuvo ${JSON.stringify(r.evidence)}`);
  }

  console.log("\n── 3 · PRIORIDAD — el hilo PROPIO de P&L (_scope) gana SIEMPRE sobre conversationScope.current ──");
  {
    clearPnl(); resetPnlDraft(); setPnlLines([{ nombre: "Administrativos", pct: 1 }]);
    composePnl({ action: "resultado_scoped", entidad: "Falabella" }, {}, { scenario: "actual" });   // establece _scope.entity="Falabella"
    const r = composePnl({ action: "proyeccion_venta", ventaK: 6000 }, csCtx(["Sodimac"]), { scenario: "actual" });
    ok(r.evidence.entidad === "Falabella", `_scope propio ("Falabella") no lo pisa conversationScope ("Sodimac") — obtuvo ${JSON.stringify(r.evidence.entidad)}`);
  }

  console.log("\n── 4 · simulate_line + scopeDeictic: conversationScope.current resuelve cuando el eje CALZA ──");
  {
    clearPnl(); resetPnlDraft(); setPnlLines([{ nombre: "Logistica", pct: 3 }]);
    const r = composePnl({ action: "simulate_line", nombre: "Logistica", pct: 2, scopeDeictic: "cliente" }, csCtx(["Jumbo"]), { scenario: "actual" });
    ok(r.evidence && r.evidence.entidad === "Jumbo", `sEnt="Jumbo" vía conversationScope — obtuvo ${JSON.stringify(r.evidence && r.evidence.entidad)}`);
  }

  console.log("\n── 5 · simulate_line + scopeDeictic: el eje NO calza (\"esa familia\" vs conversationScope dimension=\"cliente\") → NO adivina ──");
  {
    clearPnl(); resetPnlDraft(); setPnlLines([{ nombre: "Logistica", pct: 3 }]);
    const r = composePnl({ action: "simulate_line", nombre: "Logistica", pct: 2, scopeDeictic: "familia" }, csCtx(["Jumbo"], "cliente"), { scenario: "actual" });
    ok(/¿En cuál\?/.test(r.text) && r.route === "pnl_reading", `eje no calza → re-pregunta honesta (nunca adivina un cliente para "esa familia") — obtuvo "${r.text}"`);
  }

  console.log("\n── 6 · REGRESIÓN — sin conversationScope, la boleta V1 legacy (ctx.memoria.entidad) sigue funcionando igual ──");
  {
    clearPnl(); resetPnlDraft(); setPnlLines([{ nombre: "Administrativos", pct: 1 }]);
    const r = composePnl({ action: "proyeccion_venta", ventaK: 6000 }, { memoria: { entidad: { nombre: "Ripley" } } }, { scenario: "actual" });
    ok(r.evidence && r.evidence.entidad === "Ripley", `fallback legacy intacto — obtuvo ${JSON.stringify(r.evidence && r.evidence.entidad)}`);
  }

  console.log("\n── 7 · PRIORIDAD — conversationScope.current gana sobre la boleta V1 legacy cuando ambos traen algo ──");
  {
    clearPnl(); resetPnlDraft(); setPnlLines([{ nombre: "Administrativos", pct: 1 }]);
    const ctx = { memoriaInteraccion: { conversationScope: { version: 1, current: { entities: ["Tottus"], dimension: "cliente" }, history: [] } }, memoria: { entidad: { nombre: "Ripley" } } };
    const r = composePnl({ action: "proyeccion_venta", ventaK: 6000 }, ctx, { scenario: "actual" });
    ok(r.evidence && r.evidence.entidad === "Tottus", `conversationScope ("Tottus") gana sobre memoria V1 ("Ripley") — obtuvo ${JSON.stringify(r.evidence && r.evidence.entidad)}`);
  }

  console.log("\n── 8 · HONESTO — conversationScope resolvió un eje que P&L NO cubre (bodega) → no se adivina, cae a \"el negocio\" ──");
  {
    clearPnl(); resetPnlDraft(); setPnlLines([{ nombre: "Administrativos", pct: 1 }]);
    const r = composePnl({ action: "proyeccion_venta", ventaK: 6000 }, csCtx(["Santiago"], "bodega"), { scenario: "actual" });
    ok(!r.evidence.entidad && r.evidence.dimension === "cliente", `eje bodega no cubierto por P&L → negocio, sin inventar prorrateo — obtuvo ${JSON.stringify(r.evidence)}`);
  }
}

console.log("\n" + "═".repeat(90));
console.log("LADO B · SALIDA — ChatADI.jsx proyecta pnlScope() hacia conversationScope.current (esbuild + jsdom)");
console.log("═".repeat(90));
{
  const { JSDOM } = await import("jsdom");
  const esbuild = (await import("esbuild")).default;
  const { fileURLToPath, pathToFileURL } = await import("url");
  const path = (await import("path")).default;

  // DOM mínimo (mismo patrón que _reentry_evidence_gate.mjs) — buildAdiTurn no renderiza nada, pero el grafo de
  // imports de ChatADI.jsx (theme/markdown/InlineChart/etc.) puede tocar globals de browser al cargar el módulo.
  const dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "http://localhost/" });
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  try { Object.defineProperty(globalThis, "navigator", { value: dom.window.navigator, configurable: true }); } catch {}
  globalThis.HTMLElement = dom.window.HTMLElement;
  globalThis.Node = dom.window.Node;
  globalThis.getComputedStyle = dom.window.getComputedStyle;
  globalThis.localStorage = dom.window.localStorage;

  const root = path.dirname(fileURLToPath(import.meta.url));
  const entry = path.join(root, "_pcsg_entry.js"), out = path.join(root, "_pcsg_bundle.mjs");
  fs.writeFileSync(entry, [
    'export { buildAdiTurn } from "./src/ui/ChatADI.jsx";',
    'export { setPnlLines, clearPnl, resetPnlDraft, pnlScope } from "./src/adi/pnl.js";',
    // (2) el store del BUNDLE — hay que declarárselo A ÉL, no alcanza con el del proceso (ver la cabecera)
    'export { initTenant } from "./src/data/tenantStore.js";',
    'export { TENANT_DEMO } from "./src/data/tenants/demo.js";',
  ].join("\n"));
  await esbuild.build({
    entryPoints: [entry], bundle: true, outfile: out, format: "esm", platform: "node", jsx: "automatic",
    external: ["react", "react-dom", "react-dom/client", "react/jsx-runtime", "react/jsx-dev-runtime"],
    logLevel: "silent",
  });
  const M = await import(pathToFileURL(out).href + "?t=" + Math.random());
  try { fs.unlinkSync(entry); } catch {} try { fs.unlinkSync(out); } catch {}
  const { buildAdiTurn, setPnlLines, clearPnl, resetPnlDraft, pnlScope } = M;
  M.initTenant(M.TENANT_DEMO);   // (2) el store del BUNDLE, que es OTRO — sin esto el bloque 9 cae, medido

  console.log("\n── 9 · CASO OBLIGATORIO — \"P&L de Falabella\" (texto libre, camino demo completo) proyecta la entidad ──");
  {
    clearPnl(); resetPnlDraft(); setPnlLines([{ nombre: "Administrativos", pct: 1 }]);
    const turn = buildAdiTurn("P&L de Falabella", {}, "actual");
    const cur = turn.context && turn.context.memoriaInteraccion && turn.context.memoriaInteraccion.conversationScope && turn.context.memoriaInteraccion.conversationScope.current;
    ok(turn.adiMsg.route === "pnl_reading", `el turno lo resolvió P&L (route="pnl_reading") — obtuvo route=${turn.adiMsg.route}`);
    ok(!!cur && JSON.stringify(cur.entities) === JSON.stringify(["Falabella"]) && cur.dimension === "cliente",
      `conversationScope.current = {entities:["Falabella"], dimension:"cliente"} — obtuvo ${JSON.stringify(cur)}`);
  }

  console.log("\n── 10 · GUARDA — un turno P&L GLOBAL (\"negocio\") NUNCA borra en silencio un foco previo de conversationScope ──");
  {
    clearPnl(); resetPnlDraft(); setPnlLines([{ nombre: "Administrativos", pct: 1 }]);
    const prevScope = { version: 1, current: {
      turno: 0, dimension: "cliente", entities: ["Jumbo"], selection: null, periodo: null, filtros: null, metrica: null,
      operacion: "queryMetric", modo: "default", tool: "marginRead", origen: { callId: null, boletaLabels: [] },
      supuestos: [], faltantes: [], ofertaPendiente: null, tenant: null,
    }, history: [] };
    const context0 = { memoriaInteraccion: { conversationScope: prevScope } };
    const turn = buildAdiTurn("¿cómo queda mi resultado comercial?", context0, "actual");   // acción "resultado" — GLOBAL (_scope.global=true)
    const cur = turn.context.memoriaInteraccion.conversationScope.current;
    ok(turn.adiMsg.route === "pnl_reading", `el turno lo resolvió P&L (route="pnl_reading") — obtuvo route=${turn.adiMsg.route}`);
    ok(JSON.stringify(cur.entities) === JSON.stringify(["Jumbo"]) && cur.dimension === "cliente",
      `el foco previo ("Jumbo") sigue intacto — un turno P&L global NUNCA lo pisa con "nada" — obtuvo ${JSON.stringify(cur)}`);
  }

  console.log("\n── 11 · REGRESIÓN — un turno NO-P&L nunca toca conversationScope (memoriaInteraccion pasa intacta) ──");
  {
    clearPnl(); resetPnlDraft();
    const prevScope = { version: 1, current: { dimension: "cliente", entities: ["Jumbo"], turno: 0, selection: null, periodo: null, filtros: null, metrica: null, operacion: null, modo: null, tool: null, origen: { callId: null, boletaLabels: [] }, supuestos: [], faltantes: [], ofertaPendiente: null, tenant: null }, history: [] };
    const context0 = { memoriaInteraccion: { conversationScope: prevScope } };
    const turn = buildAdiTurn("hola", context0, "actual");   // saludo — no toca P&L en absoluto
    const routeOk = !turn.adiMsg.route || turn.adiMsg.route.indexOf("pnl_") !== 0;
    ok(routeOk, `un turno no-P&L nunca produce route "pnl_*" — obtuvo route=${turn.adiMsg.route}`);
    const cur = turn.context.memoriaInteraccion && turn.context.memoriaInteraccion.conversationScope && turn.context.memoriaInteraccion.conversationScope.current;
    ok(!!cur && JSON.stringify(cur.entities) === JSON.stringify(["Jumbo"]), `conversationScope.current sigue byte-igual — obtuvo ${JSON.stringify(cur)}`);
  }

  console.log("\n── 12 · GUARDA — P&L sin hilo activo (pnlScope() null, ej. sinPnl()) no inventa un conversationScope de la nada ──");
  {
    clearPnl(); resetPnlDraft();   // SIN setPnlLines → _lines vacío → "resultado" cae a sinPnl()
    ok(!pnlScope(), `pnlScope() está inactivo (sin P&L declarado) antes del turno`);
    const turn = buildAdiTurn("¿cómo queda mi resultado comercial?", {}, "actual");
    ok(turn.adiMsg.route === "pnl_reading", `sinPnl() también responde route="pnl_reading" (abre el flujo guiado) — obtuvo route=${turn.adiMsg.route}`);
    const mi = turn.context.memoriaInteraccion;
    ok(!mi || !mi.conversationScope || !mi.conversationScope.current, `sin entidad real que proyectar, memoriaInteraccion queda sin conversationScope.current — obtuvo ${JSON.stringify(mi)}`);
  }
}

console.log(`\n── _pnl_conversation_scope_gate: ${pass} PASS · ${fail} FAIL (de ${pass + fail}) ──`);
process.exit(fail ? 1 : 0);
