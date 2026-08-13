/* === _gen_inventario_poda.mjs · genera _INVENTARIO_RUTAS_PODA_F1.md desde la salida del enjambre ultracode
 * (La Poda Fase 1, 2026-08-14). Script de escritorio: cero red, cero motor. */
import fs from "fs";
const SRC = "C:/Users/jcnav/AppData/Local/Temp/claude/C--Users-jcnav-ADI-Sentrix/da0d7f7e-d10a-428c-8764-389cc4638ba3/tasks/w4vzso1mq.output";
const d = JSON.parse(fs.readFileSync(SRC, "utf8")).result;

const norm = (p) => String(p || "").replace(/^C:\/Users\/jcnav\/ADI-Sentrix\/ADI_PROYECTO\//, "").replace(/^ADI_PROYECTO\//, "");
const todas = [];
for (const m of d.inventario) for (const r of (m.rutas || [])) todas.push({ ...r, zona: (m.zona || "?").split("—")[0].trim() });
for (const r of (d.faltantes || [])) todas.push({ ...r, zona: "Zona G (completitud)" });

// veredictos de la fase de verificación pisan la clase del mapa
const veredicto = new Map();
for (const v of (d.verificadas || [])) veredicto.set(v.nombre, v);

const clase = (r) => {
  const v = veredicto.get(r.nombre);
  return v ? v.claseFinal : r.clase;
};

const L = [];
L.push("# La Poda · Fase 1 — Inventario de rutas determinísticas");
L.push("");
L.push("**Generado 2026-08-14** por enjambre ultracode (13 agentes, 6 zonas en paralelo + adjudicación + crítico de completitud) sobre `dev`=aaf3400. Solo lectura: ningún archivo tocado, ninguna llamada a proveedor.");
L.push("");
L.push("Una **ruta** es cualquier mecanismo determinístico que pueda (a) responder un turno completo sin el modelo, (b) interceptar la pregunta antes del PLAN, (c) reemplazar o reparar la narración del modelo, o (d) forzar un modo o comportamiento.");
L.push("");
const porClase = {};
for (const r of todas) porClase[clase(r)] = (porClase[clase(r)] || 0) + 1;
L.push(`## Resumen: ${todas.length} rutas`);
L.push("");
L.push("| Clase | Cuántas | Qué significa |");
L.push("|---|---|---|");
L.push(`| vigente | ${porClase.vigente || 0} | camino del oráculo, comportamiento deseado hoy |`);
L.push(`| legado-en-uso | ${porClase["legado-en-uso"] || 0} | camino viejo AÚN alcanzable desde producción — migrar antes de quitar |`);
L.push(`| muerto | ${porClase.muerto || 0} | sin caller alcanzable, adjudicado con búsqueda exhaustiva — se elimina |`);
L.push(`| dudoso | ${porClase.dudoso || 0} | quedó sin adjudicar (tope de la corrida) — se declara, no se toca |`);
L.push("");

L.push("## Lo que se elimina (adjudicado muerto)");
L.push("");
for (const r of todas.filter((x) => clase(x) === "muerto")) {
  const v = veredicto.get(r.nombre);
  L.push(`- **${r.nombre}** — \`${norm(r.archivo)}:${r.linea}\``);
  L.push(`  - ${r.queHace}`);
  L.push(`  - Evidencia: ${(v && v.evidencia) || r.evidencia}`);
}
L.push("");

L.push("## Lo que se migra antes de quitar (legado en uso)");
L.push("");
L.push("| Ruta | Archivo | Qué hace |");
L.push("|---|---|---|");
for (const r of todas.filter((x) => clase(x) === "legado-en-uso")) L.push(`| ${r.nombre} | \`${norm(r.archivo)}:${r.linea}\` | ${String(r.queHace).replace(/\|/g, "/").slice(0, 160)} |`);
L.push("");

L.push("## Lo que quedó sin adjudicar (se declara, no se toca)");
L.push("");
for (const r of todas.filter((x) => clase(x) === "dudoso")) L.push(`- **${r.nombre}** — \`${norm(r.archivo)}:${r.linea}\` · ${r.evidencia}`);
L.push("");

const conRiesgo = todas.filter((r) => r.riesgo && String(r.riesgo).trim() && String(r.riesgo).trim() !== '""');
L.push(`## Riesgos anotados sobre rutas VIGENTES (${conRiesgo.filter((r) => clase(r) === "vigente").length})`);
L.push("");
L.push("No son defectos confirmados: son puntos donde una ruta puede pisarse con otra o responder mal. Entran a la Fase 2 como candidatos, cada uno con verificación propia.");
L.push("");
for (const r of conRiesgo.filter((x) => clase(x) === "vigente")) L.push(`- **${r.nombre}** (\`${norm(r.archivo)}:${r.linea}\`): ${r.riesgo}`);
L.push("");

const lits = (d.literales || []);
L.push(`## Literales de registro prohibido (${lits.length} hallazgos)`);
L.push("");
L.push("CLAUDE.md §4: prohibidas en superficie *plata, vara, dormido, guita, palanca, apretar*; se dice **inmovilizado**, no *detenido*. El barrido cubrió todo `src/`. Hay solapamiento entre agentes (dos zonas reportaron los mismos archivos) — la Fase 2 deduplica antes de tocar.");
L.push("");
L.push("| Archivo | Texto | ¿Llega a pantalla? |");
L.push("|---|---|---|");
for (const l of lits) L.push(`| \`${norm(l.archivo)}:${l.linea}\` | ${String(l.texto).replace(/\s+/g, " ").replace(/\|/g, "/").slice(0, 90)} | ${String(l.llegaAPantalla || "?").replace(/\s+/g, " ").replace(/\|/g, "/").slice(0, 100)} |`);
L.push("");

L.push("## Inventario completo por zona");
L.push("");
const zonas = [...new Set(todas.map((r) => r.zona))];
for (const z of zonas) {
  L.push(`### ${z} (${todas.filter((r) => r.zona === z).length})`);
  L.push("");
  L.push("| Ruta | Archivo | Se activa cuando | Clase |");
  L.push("|---|---|---|---|");
  for (const r of todas.filter((x) => x.zona === z)) L.push(`| ${r.nombre} | \`${norm(r.archivo)}:${r.linea}\` | ${String(r.disparador).replace(/\|/g, "/").slice(0, 120)} | ${clase(r)} |`);
  L.push("");
}

fs.writeFileSync("_INVENTARIO_RUTAS_PODA_F1.md", L.join("\n"), "utf8");
console.log(`escrito _INVENTARIO_RUTAS_PODA_F1.md · ${todas.length} rutas · ${lits.length} literales · ${L.length} líneas`);
