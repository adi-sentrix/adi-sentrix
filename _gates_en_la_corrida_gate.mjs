/* === _gates_en_la_corrida_gate.mjs · NINGÚN GATE SE APAGA EN SILENCIO (owner 2026-09-01) ====================
 *
 * EL INCIDENTE QUE CIERRA. Tres gates estuvieron FUERA de la suite offline y ROJOS desde el 2026-08-21, y nadie
 * podía saberlo: no corrían (cb8c25e los devolvió). Mencionaban un marcador de red SOLO EN UN COMENTARIO — dos
 * de esos comentarios declaraban textualmente que el gate NO usa la red, y la frase que declaraba la inocencia
 * era la que condenaba. El clasificador los mandó a la lista LIVE, que el runner imprime al final pero nadie
 * compara contra nada. «El próximo que se apague no va a avisar» — desde este gate, avisa.
 *
 * LA REGLA. Todo `_*_gate.mjs` de la raíz está en la corrida offline O en la lista DECLARADA de live
 * (scripts/gates-live-declarados.mjs, con nombre y motivo). Cualquier diferencia pone esto ROJO, en las dos
 * direcciones: un live sin declarar es un gate que salió de la corrida sin que nadie lo decidiera; un declarado
 * que ya clasifica offline (o no existe) es una declaración vieja que mañana taparía una ausencia real.
 *
 * CON QUÉ MIDE. Importa `clasificarGates` — LA MISMA función que usa el runner, extraída para poder consultarla
 * sin disparar la suite — y un check de cableado verifica que el runner de verdad importe de ahí: si el runner
 * clasificara con otra copia, este gate vigilaría un espejo.
 *
 * LAS CARNADAS: los TRES casos reales de agosto (sus líneas condenatorias, verbatim) y la variante del bundle
 * (un gate con escape declarado que importa src/ui — el escape se pierde y el gate cae de la corrida). Cada una
 * tiene que poner rojo el chequeo; si alguna pasara en silencio, el chequeo es un verde de adorno.
 *
 * NOTA DE FORMA: los marcadores dentro de las carnadas van PARTIDOS («call»+«Plan») — el literal entero haría
 * que el clasificador mande ESTE gate a LIVE y el vigilante de ausencias quedaría ausente él mismo, que es
 * exactamente la ironía de agosto. PURO · determinístico · cero red. `node _gates_en_la_corrida_gate.mjs` */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const ROOT = process.cwd();
const { clasificarGates, clasificarFuente } = await import(pathToFileURL(join(ROOT, "scripts", "clasificarGates.mjs")).href);
const { LIVE_DECLARADOS } = await import(pathToFileURL(join(ROOT, "scripts", "gates-live-declarados.mjs")).href);

let PASS = 0, FAIL = 0;
const ok = (c, m, extra = "") => { if (c) { PASS++; console.log("  ✓ " + m); } else { FAIL++; console.log("  ✗ " + m + (extra ? "\n      " + extra : "")); } };
const H = (t) => console.log("\n" + t);

/** el chequeo, como función: la lista de violaciones entre lo clasificado y lo declarado. Vacía = todo en orden.
 *  Es función para que las carnadas la ejerciten DE VERDAD: cada carnada inyecta su caso y exige violación. */
function violaciones({ archivos, live }, declarados) {
  const v = [];
  const decl = new Map(declarados.map((d) => [d.file, d.motivo]));
  for (const l of live) {
    if (!decl.has(l.file)) v.push(`FUERA DE LA CORRIDA SIN DECLARAR: ${l.file} [${l.motivo}] — el caso de agosto: o le entró un marcador por un comentario (arreglá el comentario), o es live de verdad (declaralo con su motivo)`);
    else if (decl.get(l.file) !== l.motivo) v.push(`MOTIVO CAMBIADO: ${l.file} declara «${decl.get(l.file)}» pero clasifica «${l.motivo}» — algo cambió en su fuente: miralo antes de actualizar la línea`);
  }
  for (const d of declarados) {
    if (!archivos.includes(d.file)) v.push(`DECLARADO INEXISTENTE: ${d.file} — borrá su línea de gates-live-declarados.mjs`);
    else if (!live.some((l) => l.file === d.file)) v.push(`DECLARADO QUE VOLVIÓ A LA CORRIDA: ${d.file} — borrá su línea, o mañana esa declaración tapa una ausencia real`);
  }
  return v;
}

H("[1] EL REPO REAL · clasificación contra declaración, cero diferencias");
{
  const r = clasificarGates(ROOT);
  ok(r.offline.length + r.live.length === r.archivos.length,
    `sanidad: todo gate clasifica a un solo lado (${r.archivos.length} = ${r.offline.length} offline + ${r.live.length} live)`);
  const dup = LIVE_DECLARADOS.filter((d, i) => LIVE_DECLARADOS.findIndex((x) => x.file === d.file) !== i);
  ok(dup.length === 0, "la lista declarada no tiene duplicados", dup.map((d) => d.file).join(", "));
  const v = violaciones(r, LIVE_DECLARADOS);
  ok(v.length === 0, `★ los ${r.live.length} gates fuera de la corrida están DECLARADOS con nombre y motivo, y nadie más quedó afuera`, v.join("\n      "));
  ok(r.live.length === LIVE_DECLARADOS.length, `la cuenta cierra por los dos lados (${r.live.length} clasificados = ${LIVE_DECLARADOS.length} declarados)`);
}

H("[2] EL CABLEADO · el runner clasifica con LA MISMA función que este gate consulta");
{
  const runner = readFileSync(join(ROOT, "scripts", "gates-offline.mjs"), "utf8");
  ok(/from\s+["']\.\/clasificarGates\.mjs["']/.test(runner) && /clasificarGates\(ROOT\)/.test(runner),
    "gates-offline.mjs importa ./clasificarGates.mjs y clasifica con clasificarGates(ROOT) — sin esto, este gate vigilaría un espejo");
  ok(!/const\s+LIVE\s*=\s*\[/.test(runner), "y no le quedó una copia local de los marcadores (una copia diverge sin avisar)");
}

/* Los marcadores de las carnadas van PARTIDOS (ver NOTA DE FORMA). */
const CP = "call" + "Plan", CN = "call" + "Narrate", API = "/api/" + "adi-";

H("[3] LAS CARNADAS DE AGOSTO · las tres líneas que apagaron gates reales, contra el chequeo de hoy");
{
  // Las líneas CONDENATORIAS verbatim de cb8c25e — cada una apagó un gate real durante 11 días:
  const AGOSTO = [
    ["_conversation_scope_gate.mjs", ` * degraded_gate.mjs — mockea el estado a mano, nunca llama a ${CP}/${CN} reales).`],
    ["_integrator_confirmed_fixes_gate.mjs", `  // reproduce EXACTO el plan real devuelto por el LLM en vivo (capturado de ${API}plan, ver reporte final)`],
    ["_pnl_conversation_scope_gate.mjs", ` * determinísticos, sin fetch ni ${CP}/${CN}.`],
  ];
  const r = clasificarGates(ROOT);
  for (const [victima, linea] of AGOSTO) {
    // el comentario condena HOY igual que en agosto (esa conducta del clasificador no cambió — por eso existe la lista):
    const fixture = `/* gate determinístico */\n${linea}\nconsole.log("puro");\n`;
    const c = clasificarFuente(fixture);
    ok(c.tipo === "live", `la línea que apagó ${victima} sigue condenando hoy [${c.motivo || "—"}]`);
    // y la MISMA ausencia que en agosto pasó en silencio, hoy pone rojo el chequeo:
    const conCarnada = { archivos: [...r.archivos, "_carnada_agosto_gate.mjs"], live: [...r.live, { file: "_carnada_agosto_gate.mjs", motivo: c.motivo }] };
    const v = violaciones(conCarnada, LIVE_DECLARADOS);
    ok(v.some((x) => /_carnada_agosto_gate\.mjs/.test(x) && /SIN DECLARAR/.test(x)),
      `★ carnada «${victima} se apaga otra vez» → el chequeo se pone ROJO (en agosto pasó en silencio)`, v.join(" | "));
  }
}

H("[4] LA VARIANTE DEL BUNDLE · un escape declarado que importa src/ui pierde el escape y cae de la corrida");
{
  // el patrón del gate de P&L: el motor viaja en un bundle, y src/ui es donde viven los fetchers REALES — por
  // eso el escape @inyeccion-simulada exige NO importarlo. Un import de src/ui (p.ej. para bundlear la UI del
  // turno) le quita el escape al gate SIN que nadie lo note: clasifica live y sale de la corrida en silencio.
  const base = [
    "/* @inyeccion-simulada — certifica el motor con las dos pasadas inyectadas a mano */",
    `const plan = await ${CP}({ pregunta });`,
    "console.log(plan);",
  ].join("\n");
  const conUI = `import { x } from "./src/ui/ChatADI.jsx";\n${base}`;
  ok(clasificarFuente(base).tipo === "offline", "CONTROL · el mismo gate SIN el import de src/ui conserva su escape y corre");
  const c = clasificarFuente(conUI);
  ok(c.tipo === "live", `con el import de src/ui el escape se pierde: clasifica live [${c.motivo || "—"}] (condición (d) del escape)`);
  const r = clasificarGates(ROOT);
  const v = violaciones({ archivos: [...r.archivos, "_carnada_bundle_gate.mjs"], live: [...r.live, { file: "_carnada_bundle_gate.mjs", motivo: c.motivo }] }, LIVE_DECLARADOS);
  ok(v.some((x) => /_carnada_bundle_gate\.mjs/.test(x) && /SIN DECLARAR/.test(x)),
    "★ carnada «el gate del bundle cae de la corrida» → el chequeo se pone ROJO, no silencio");
}

H("[5] LAS OTRAS DOS DIRECCIONES · una declaración vieja también es rojo");
{
  const r = clasificarGates(ROOT);
  const vInex = violaciones(r, [...LIVE_DECLARADOS, { file: "_carnada_borrado_gate.mjs", motivo: "x" }]);
  ok(vInex.some((x) => /DECLARADO INEXISTENTE/.test(x)), "carnada «declarado que ya no existe» → ROJO (la lista no acumula fantasmas)");
  const vuelto = LIVE_DECLARADOS[0].file;
  const vVolvio = violaciones({ archivos: r.archivos, live: r.live.filter((l) => l.file !== vuelto) }, LIVE_DECLARADOS);
  ok(vVolvio.some((x) => /VOLVIÓ A LA CORRIDA/.test(x) && x.includes(vuelto)),
    `carnada «${vuelto} vuelve a la corrida con la declaración puesta» → ROJO (la declaración vieja taparía la próxima ausencia)`);
  const vMotivo = violaciones({ archivos: r.archivos, live: r.live.map((l) => l.file === vuelto ? { ...l, motivo: "otro-marcador" } : l) }, LIVE_DECLARADOS);
  ok(vMotivo.some((x) => /MOTIVO CAMBIADO/.test(x)), "carnada «el motivo cambió sin tocar la lista» → ROJO (algo cambió en ese gate: hay que mirarlo)");
}

console.log(`\n── _gates_en_la_corrida_gate: ${PASS} PASS · ${FAIL} FAIL (de ${PASS + FAIL}) ──`);
process.exit(FAIL ? 1 : 0);
