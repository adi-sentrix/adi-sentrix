/* === _voz_etapa3_gate.mjs · ADI HABLA CON LA CALIDAD CON LA QUE PIENSA ═══════════════════════════════════════
 *
 * EL MANDATO (owner 2026-09-11, Etapa 3): «ADI ya piensa bien. Ahora queremos que hable con la misma calidad con
 * la que piensa.» Sin sacrificar rigor. Sus reglas, medidas acá sobre la VOZ DETERMINÍSTICA —los pisos que
 * garantizan respuesta cuando el cerebro no ayuda— con proxies mecánicos, honestos sobre lo que miden:
 *   · jerarquía: la conclusión antes que la demostración (la foto abre con una frase sin cifras);
 *   · no repetición: una cifra, una vez (fuera de tablas); el benchmark una vez; nombres sin abuso;
 *   · naturalidad: cero voz de motor en TODO el corpus; sin subtítulos en negrita en la foto ni en el porqué;
 *   · síntesis: la foto en ≤ 120 palabras; el porqué sin formato de informe y bajo su trinquete;
 *   · incertidumbre premium: los límites abren con lo verificado, jamás con «no tengo información autorizada»;
 *   · brevedad adaptativa y destinatario: en _reformular_gate §9 (misma conclusión, distinta forma);
 *   · el sello del período una vez: en _sello_periodo_una_vez_gate;
 *   · y la carta lleva las reglas de voz SIN romper su techo del 20% (_carta_asesor_gate).
 * Lo que este gate NO puede medir: cómo redacta el cerebro vivo cuando sí coopera — eso es la batería en vivo
 * (Etapa 4), con el gasto del owner.
 *
 * OFFLINE · determinístico · CERO llamadas.
 * `node --import ./scripts/offline-guard.mjs _voz_etapa3_gate.mjs` */
import { initTenant } from "./src/data/tenantStore.js";
import { TENANT_DEMO } from "./src/data/tenants/demo.js";
import { answerViaAgente } from "./src/adi/agente/bucleAgente.js";
import { vetosDeRegistro } from "./src/adi/agente/contratoAgente.js";
import { CARTA_DEL_ASESOR } from "./src/adi/agente/cartaAsesor.js";
import { composeNoDataMessage } from "./src/adi/oracle/narrationBlocks.js";
import { ESCENARIO_INICIAL } from "./src/config/scenarios.js";
import { axisEntityNames } from "./src/adi/oracle/entityIndex.js";

let pass = 0, fail = 0;
const ok = (cond, label, detalle) => {
  if (cond) { pass++; console.log(`  ✓ ${label}`); }
  else { fail++; console.log(`  ✗ ${label}`); if (detalle !== undefined) console.log(`      ${String(detalle).slice(0, 320)}`); }
};
const H = (t) => console.log(`\n${t}`);
const ESC = ESCENARIO_INICIAL;
const MUDO = async () => ({ tipo: "texto", texto: "" });
initTenant(TENANT_DEMO);
const CLIENTES = axisEntityNames("cliente");

const palabras = (t) => String(t).trim().split(/\s+/).length;
const sinTablas = (t) => String(t).split("\n").filter((l) => !/^\s*\|/.test(l)).join("\n");
const cifras = (t) => (sinTablas(t).match(/\$[\d.,]+[KMB]?|[\d.,]+\s*(?:%|pp\b)/g) || []).map((c) => c.replace(/\s+/g, ""));
const repetidas = (t, max) => { const n = {}; for (const c of cifras(t)) n[c] = (n[c] || 0) + 1; return Object.entries(n).filter(([, k]) => k > max).map(([c, k]) => `${c}×${k}`); };
const nombresRepetidos = (t, max) => CLIENTES.map((e) => [e, (sinTablas(t).match(new RegExp(`(?:^|[^\\wáéíóúñ])${e.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![\\wáéíóúñ])`, "g")) || []).length]).filter(([, k]) => k > max).map(([e, k]) => `${e}×${k}`);
const primeraFrase = (t) => String(t).split(/(?<=[.!?…])\s+(?=[A-ZÁÉÍÓÚÑ¿«])/)[0] || "";

/* ── EL CORPUS: los pisos, con cerebro mudo ─────────────────────────────────────────────────────────────────── */
const turno = async (q, history = [], mem = {}) => { const r = await answerViaAgente({ text: q, history, mem, scenario: ESC, callAgente: MUDO }); return { t: String(r.r.text || ""), a: r.r.agente, mem: r.mem }; };
const foto = await turno("¿Cómo va el negocio?");
const HF = [{ role: "user", text: "¿Cómo va el negocio?" }, { role: "assistant", text: foto.t }];
const quienes = await turno("¿Qué clientes explican más eso?", HF, foto.mem);
const porque = await turno("¿por qué estamos perdiendo margen?");
const directorio = await turno("dame los 3 riesgos para el directorio");
const plan = await turno("qué hago esta semana");
const comparar = await turno("¿qué es más urgente, margen o cobranza?");
const CORPUS = { foto, quienes, porque, directorio, plan, comparar };

/* ═══ 1 · NATURALIDAD · cero voz de motor, en todo el corpus ═══════════════════════════════════════════════ */
H("1 · naturalidad: el mecanismo detrás, el criterio delante — cero voz de motor en el corpus determinístico");
for (const [k, v] of Object.entries(CORPUS)) {
  ok(v.a.estado === "playbook", `«${k}» sale por su procedimiento (${v.a.estado})`);
  const vm = vetosDeRegistro(v.t, {}).filter((x) => x.regla === "lexico-voz-de-motor");
  ok(vm.length === 0 && !/\bel motor\b|\bdel motor\b|seg[uú]n el procedimiento|la regla me dice/i.test(v.t), `…sin «el motor», «según el procedimiento» ni «la regla me dice»`, v.t.slice(0, 120));
}
ok(vetosDeRegistro("La contribución sin capturar que el motor detecta suma $4.9M.", {}).some((x) => x.regla === "lexico-voz-de-motor"), "★ la frase que salía en el piso ARDE ahora en el juez compartido (los dos caminos)");
ok(vetosDeRegistro("Según el procedimiento, entraría por Falabella.", {}).some((x) => x.regla === "lexico-voz-de-motor"), "★ «según el procedimiento» arde");
ok(!vetosDeRegistro("Falabella es tu motor de crecimiento este año.", {}).some((x) => x.regla === "lexico-voz-de-motor"), "…y «motor de crecimiento» (lenguaje de negocio) NO arde");

/* ═══ 2 · JERARQUÍA · la conclusión antes que la demostración ══════════════════════════════════════════════ */
H("2 · jerarquía: la foto abre con la tesis, sin una sola cifra, y recién después la evidencia");
{
  const p1 = primeraFrase(foto.t);
  ok(!/\d/.test(p1), "★★ la primera frase de la foto es la conclusión, sin cifras", p1);
  ok(/creciendo|crece|no está creciendo/i.test(p1) && /margen/i.test(p1), "…y dice de qué va: crecimiento y margen", p1);
  ok(!/\*\*/.test(foto.t), "…sin subtítulos en negrita: es una conversación, no un informe");
  ok(!/^\s*(?:\d+[.)]|#)/m.test(foto.t), "…ni numeraciones ni encabezados");
}

/* ═══ 3 · NO REPETICIÓN · una cifra, una vez ═══════════════════════════════════════════════════════════════ */
H("3 · no repetición: una cifra una vez fuera de tablas; el benchmark una vez; nombres sin abuso");
for (const [k, v] of Object.entries(CORPUS)) {
  /* el porqué y el plan admiten UNA reaparición: la cifra vuelve cuando cambia su significado (el total del cobro
   * vencido como base de la comparación «$33K contra los $12.6M») — la regla del owner, no una excepción */
  const max = (k === "porque" || k === "plan") ? 2 : 1;
  const rep = repetidas(v.t, max);
  ok(rep.length === 0, `«${k}»: ninguna cifra se repite${max === 2 ? " más de dos veces" : ""}`, rep.join(", "));
}
ok((foto.t.match(/30\.1%/g) || []).length === 1, "★ el benchmark se dice UNA vez en la foto");
ok(nombresRepetidos(foto.t, 2).length === 0 && nombresRepetidos(directorio.t, 3).length === 0, "los nombres no se repiten sin aportar", `${nombresRepetidos(foto.t, 2)} ${nombresRepetidos(directorio.t, 3)}`);

/* ═══ 4 · SÍNTESIS · tres frases cuando alcanzan; el porqué sin formato de informe ═════════════════════════ */
H("4 · síntesis: la foto corta; el porqué con sus seis piezas pero sin informe");
ok(palabras(foto.t) <= 120, `la foto en ≤ 120 palabras (${palabras(foto.t)})`);
ok(palabras(directorio.t) <= 110, `la síntesis del directorio en ≤ 110 palabras (${palabras(directorio.t)})`);
ok(!/\*\*/.test(porque.t) && palabras(porque.t) <= 460, `★ el porqué sin negritas y bajo su trinquete de 460 palabras (${palabras(porque.t)}) — era 495 con cinco subtítulos`);
ok(/Para cerrarlo:/.test(porque.t) && /¿El volumen de .* es una apuesta tuya/i.test(porque.t) && /criterio m[ií]o/i.test(porque.t),
  "…y conserva el método entero: huellas con su sello, la pregunta al dueño y el criterio marcado");

/* ═══ 5 · INCERTIDUMBRE PREMIUM · el límite abre con lo verificado y pide la pista ═════════════════════════ */
H("5 · incertidumbre premium: el límite hace avanzar, nunca «no tengo información autorizada»");
{
  const gen = composeNoDataMessage([]);
  ok(!/informaci[oó]n autorizada/i.test(gen) && /Dime qu[eé]/.test(gen), "★ el genérico ya no dice «no tengo información autorizada»: pide la pista concreta", gen);
  const conCausa = composeNoDataMessage([{ coverage: { supported: false, reason: "el dato no trae corte por trimestre" } }]);
  ok(/^Eso no lo puedo afirmar con lo que tengo: el dato no trae corte por trimestre\./.test(conCausa), "…y con causa, la causa se dice primero", conCausa);
  /* la línea honesta: un cerebro terco que inventa → el rescate abre con lo VERIFICADO y después el límite */
  let k = 0;
  const terco = async () => { k++; return k === 1 ? { tipo: "herramientas", pedidos: [{ tool: "entityProfile", args: { entity: CLIENTES[0] } }] } : { tipo: "texto", texto: `${CLIENTES[0]} te compró $99.9M el último mes — un récord histórico.` }; };
  const r = await answerViaAgente({ text: `cuánto me compró ${CLIENTES[0]} el último mes`, history: [], mem: {}, scenario: ESC, callAgente: terco });
  const t = String(r.r.text || "");
  if (r.r.agente.estado === "limite") {
    ok(/^Lo que tengo verificado ahora: /.test(t), "★ la línea honesta ABRE con lo verificado", t.slice(0, 120));
    ok(!/No pude completar la lectura que pediste con la calidad/.test(t), "…y ya no abre con la disculpa burocrática");
  } else {
    ok(!/informaci[oó]n autorizada/i.test(t) && !/99\.9M/.test(t), `el turno terco sale por otro peldaño (${r.r.agente.estado}) sin la cifra inventada ni la frase burocrática`, t.slice(0, 120));
  }
}

/* ═══ 6 · LA CARTA LLEVA LAS REGLAS DE VOZ — bajo su techo (el techo lo mide _carta_asesor_gate) ═══════════ */
H("6 · la carta del asesor lleva las reglas de la Etapa 3, y remite el molde del lector a su turno");
ok(/CONCLUSIÓN PRIMERO, evidencia después/.test(CARTA_DEL_ASESOR), "«conclusión primero, evidencia después»");
ok(/UNA CIFRA, UNA VEZ/.test(CARTA_DEL_ASESOR), "«una cifra, una vez»");
ok(/MECANISMO DETRÁS, CRITERIO DELANTE/.test(CARTA_DEL_ASESOR) && /el motor detecta/.test(CARTA_DEL_ASESOR), "«mecanismo detrás, criterio delante», con la frase prohibida nombrada");
ok(/¿deseas profundizar\?/.test(CARTA_DEL_ASESOR) && /UNA oferta, priorizada/.test(CARTA_DEL_ASESOR), "el siguiente paso derivado del análisis, nunca «¿deseas profundizar?»");
ok(/puedo demostrar X, no todavía Y/.test(CARTA_DEL_ASESOR), "el límite que hace avanzar, con la forma del owner");
ok(/El molde de cada uno viaja cuando lo pides/.test(CARTA_DEL_ASESOR), "…y los moldes por lector NO viajan en cada turno: se remiten (el techo del 20% manda)");

console.log(`\n══ ${pass} PASS · ${fail} FAIL ══`);
process.exit(fail ? 1 : 0);
