#!/usr/bin/env node
/* === scripts/resumenConsumo.mjs · CLI · resume un JSONL de telemetría YA ESCRITO (owner 2026-09-25, ETAPA 0) ===
 *
 * POR QUÉ EXISTE. `_ADI_PLAN_PRODUCTO_V2.md` (ETAPA 0, B4) pide, además del agregador puro, «un script CLI que
 * resume un JSONL existente… sin tocar la red». Este es ese script: lee un archivo que YA quedó en disco (lo
 * escribió `telemetrySink.js` durante una corrida real, con `ADI_TELEMETRY_FILE` seteado) y contesta las
 * preguntas del contador — llamadas, tokens, costo, sin-conteo, reintentos — sin volver a tocar a nadie.
 *
 * CERO RED: solo abre un archivo local (`node:fs`) y llama a `resumenDeCorrida`, que es pura. No importa el
 * gateway, no importa ningún adapter, no llama a ningún proveedor.
 *
 * USO:
 *   node scripts/resumenConsumo.mjs <ruta-al-jsonl> [--json]
 *     --json   imprime el resumen crudo (para pegarlo en otra herramienta); sin la bandera imprime un informe
 *              legible además del JSON, igual que `resumenTelemetria()` en el sink legado (`src/adi/telemetria.js`)
 *              hace legible su propio resumen.
 *
 * Una línea que no es JSON válido (archivo cortado a mitad de escritura, la última línea de una rotación en
 * curso) se DESCARTA y se cuenta — nunca hace fallar la lectura entera ni se finge que esa línea no existía.
 */
import { readFileSync } from "node:fs";
import { resumenDeCorrida } from "../src/adi/llm/consumo.js";

function _parseArgs(argv) {
  const args = argv.slice(2);
  const soloJson = args.includes("--json");
  const ruta = args.find((a) => !a.startsWith("--"));
  return { ruta, soloJson };
}

function _leerEventos(ruta) {
  let texto;
  try { texto = readFileSync(ruta, "utf8"); }
  catch (e) {
    console.error(`[resumenConsumo] no se pudo leer "${ruta}": ${(e && e.message) || e}`);
    process.exit(1);
  }
  let corruptas = 0;
  const eventos = [];
  for (const linea of texto.split("\n")) {
    const l = linea.trim();
    if (!l) continue;
    try { eventos.push(JSON.parse(l)); }
    catch { corruptas++; }
  }
  return { eventos, corruptas };
}

function _informe(resumen, corruptas) {
  const L = [];
  L.push(`── resumenConsumo · ${resumen.eventos} renglones leídos${corruptas ? ` (${corruptas} línea(s) corrupta(s) descartada(s))` : ""} ──`);
  L.push(`  llamadas que salieron al proveedor : ${resumen.salieron}  (${resumen.noSalieron} no salieron: frenadas antes de gastar)`);
  L.push(`  sin conteo de tokens (pudo facturarse, invisible) : ${resumen.sinConteo.total}`);
  L.push(`  tokens de entrada : ${resumen.tokens.in}  (caché: ${resumen.tokens.inCache} · frescos: ${resumen.tokens.inFresh})`);
  L.push(`  tokens de salida  : ${resumen.tokens.out}`);
  L.push(`  costo estimado    : US$${resumen.costoUSD.toFixed(4)}${resumen.modelosSinPrecio.length ? "  ⚠ INCOMPLETO — hay modelos sin precio, ver abajo" : ""}`);
  if (resumen.modelosSinPrecio.length) {
    L.push(`  modelos SIN precio conocido (su costo NO está en el total de arriba):`);
    for (const m of resumen.modelosSinPrecio) L.push(`    · ${m.modelo} (${m.veces} llamada(s))`);
  }
  L.push(`  reintentos : ${resumen.reintentos.total}` + (Object.keys(resumen.reintentos.porEtapa).length
    ? `  (${Object.entries(resumen.reintentos.porEtapa).map(([e, n]) => `${e}:${n}`).join(" · ")})` : ""));
  L.push(`  resultados : ${Object.entries(resumen.resultados).map(([r, n]) => `${r}:${n}`).join(" · ")}`);
  if (resumen.porGrupo.length) {
    L.push(`  por proveedor·modelo·etapa:`);
    for (const g of resumen.porGrupo) {
      L.push(`    · ${g.proveedor}·${g.modelo}·${g.etapa} — ${g.llamadas} llamada(s)` +
        (g.sinConteo ? ` (${g.sinConteo} sin conteo)` : "") +
        ` · in:${g.tokens_in} out:${g.tokens_out} · US$${g.costoUSD.toFixed(4)}`);
    }
  }
  return L.join("\n");
}

const { ruta, soloJson } = _parseArgs(process.argv);
if (!ruta) {
  console.error("Uso: node scripts/resumenConsumo.mjs <ruta-al-jsonl> [--json]");
  process.exit(1);
}
const { eventos, corruptas } = _leerEventos(ruta);
const resumen = resumenDeCorrida(eventos);

if (soloJson) {
  console.log(JSON.stringify({ ...resumen, lineasCorruptas: corruptas }, null, 2));
} else {
  console.log(_informe(resumen, corruptas));
  console.log("\n(el JSON completo: agregá --json)");
}
