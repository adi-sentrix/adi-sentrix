/* === _examen_consola_agente_gate.mjs · LA CONSOLA DEL EXAMEN, AUDITABLE (R7b·[10]·R-eco del examen 1) ========
 *
 * Lo MEDIDO en la corrida 1: el sello imprimió «camino natural REAL» en un examen del AGENTE (mentía de ruta) ·
 * los 28 veredictos dijeron «vetos: ninguno» con 14 turnos reintentando por guard (post-mortem a ciegas) · la
 * escalada al tier caro fue 66% del gasto con CERO verdes, siempre con boleta vacía · un «verde» sin una sola
 * herramienta ni cifra contó igual que uno con boleta.
 *
 * TEXTUAL a propósito: la consola lee `.env` al importarse (GASTA si corre) — este gate la lee como TEXTO y
 * verifica que la instrumentación esté cableada. La conducta del bucle la prueban _agente_bucle_gate y
 * _agente_contrato_gate con guiones; esto cubre el INSTRUMENTO.
 *
 * OFFLINE · determinístico · no puede gastar.
 * `node --import ./scripts/offline-guard.mjs _examen_consola_agente_gate.mjs` */
import fs from "node:fs";

let pass = 0, fail = 0;
const ok = (cond, label, detalle) => {
  if (cond) { pass++; console.log(`  ✓ ${label}`); }
  else { fail++; console.log(`  ✗ ${label}`); if (detalle !== undefined) console.log(`      ${detalle}`); }
};

const C = fs.readFileSync("_consola_examen.mjs", "utf8").replace(/\r\n/g, "\n");
const CH = fs.readFileSync("src/ui/ChatADI.jsx", "utf8").replace(/\r\n/g, "\n");
const P = fs.readFileSync("_EXAMEN_AGENTE_PROTOCOLO.md", "utf8").replace(/\r\n/g, "\n");

console.log("\n1 · R7b: el sello del agente PRUEBA su ruta, no la declara");
ok(C.includes("camino AGENTE REAL (answerViaAgente + handleAgente con tier por paso) — probada, no declarada"),
  "la ruta del agente se imprime como probada");
ok(C.includes("answerViaAgente importado") && C.includes("las 3 herramientas del agente en el catálogo"),
  "…y las pruebas mecánicas existen (bucle importado · catálogo con las 3 propias)");
ok(C.includes('vetosDeContrato("La carga subió. Procede con la renegociación de Falabella.")'),
  "…y el juez del contrato se prueba EN VIVO en el sello");
ok(C.includes("la ruta del agente se prueba con --agente"),
  "el sello del natural ya no habla por el agente");

console.log("\n2 · R-eco + P3: el tier caro SOLO con boleta no vacía Y con el hilo bajo el techo");
/* el criterio creció con P2(ii) (owner 2026-08-31): además de la boleta, escala cuando la multa NOMBRA una
 * cifra — corregir eso es reescribir una oración, que es lo que un modelo mejor sabe hacer. Medido antes de
 * aprobarlo: 2 escaladas nuevas en los 28 turnos de la corrida 4, no una puerta abierta. */
ok(C.includes('const paso = (attempt > 0 || cierre) && ((figsEnBoleta | 0) > 0 || vetoConCifra) && _charsHilo <= TECHO_ENTRADA_CIERRE_CHARS ? "cierre" : "herramientas";'),
  "la consola escala con boleta llena O con un veto que nombra cifra, y bajo el techo del hilo");
ok(CH.includes('const paso = (cierre || attempt > 0) && ((figsEnBoleta | 0) > 0 || vetoConCifra) && _charsHilo <= TECHO_ENTRADA_CIERRE_CHARS ? "cierre" : "herramientas";'),
  "el adapter de producción (_fetchAgente) aplica el MISMO criterio");
/* P3 de la corrida 2: el techo es UNA sola verdad — si consola y producción lo escribieran cada una, el día que
 * se ajuste uno el otro seguiría pagando. Los dos lo IMPORTAN del bucle. */
ok(C.includes("TECHO_ENTRADA_CIERRE_CHARS } from \"./src/adi/agente/bucleAgente.js\"") &&
   CH.includes('const { TECHO_ENTRADA_CIERRE_CHARS } = await import("../adi/agente/bucleAgente.js");'),
  "…y los dos IMPORTAN el techo del bucle: una sola verdad, no dos copias");

console.log("\n3 · R7·[10]: el veredicto cuenta lo que pasó");
ok(C.includes('intentos.filter((i) => i.motivoReintento === "guard").length'),
  "los reintentos por guard se cuentan (el «vetos: ninguno» con 14 reintentos no vuelve)");
ok(C.includes("VERDE SIN LECTURA"),
  "el verde sin herramientas/figs/re-citas queda MARCADO — no infla el criterio A");
ok(C.includes("reintentosGuard:"),
  "…y los contadores viajan al estado del examen (post-mortem gratis)");

/* ═══ P3 · LA CONSOLA APUNTA A CUALQUIER EMPRESA (owner 2026-08-31) ══════════════════════════════════════════
 * El owner certifica con TRES escenarios (demo · planilla completa · planilla PARCIAL) y la consola solo sabía
 * cargar el demo: `initTenant(TENANT_DEMO)` clavado. Acá se prueba el cableado (textual, porque la consola lee
 * `.env` al importarse y GASTA si corre) y —eso sí en vivo— el camino que usa: ingesta real → tenant → mapa. */
console.log("\n3b · P3 · la consola puede examinar otra empresa, no solo el demo");
ok(/const RUTA_PLANILLA = _arg\("--planilla"\)/.test(C) && /const TENANT_ID = _arg\("--tenant"\)/.test(C),
  "la consola acepta --planilla y --tenant");
ok(/ingestarPlantilla\(buf, \{ nombreArchivo/.test(C),
  "★ --planilla ingesta por el camino REAL (`ingestarPlantilla`), no por un atajo del examen");
ok(/initTenant\(ing\.dataset\)/.test(C) && /initTenant\(pack\)/.test(C) && /initTenant\(TENANT_DEMO\)/.test(C),
  "…y los tres orígenes terminan en el MISMO initTenant: demo, planilla y base");
ok(/LA PLANILLA NO PASÓ LA INGESTA/.test(C),
  "una planilla que la app rechazaría tampoco arranca el examen (no se mide sobre un dato que no existiría)");
ok(/NEGOCIO examinado: \$\{ORIGEN\.nombre\}/.test(C),
  "★ el sello NOMBRA el negocio examinado — sin eso, tres corridas se vuelven indistinguibles");
ok(/lo que el archivo NO trae/.test(C) && /el agente debe DECLINAR nombrando esto/.test(C),
  "★ y con planilla declara lo que el archivo NO trae: es lo que el escenario PARCIAL viene a medir");
ok(/SALIÓ A LA RED/.test(C), "la rama --tenant DECLARA que salió a la red (no gasta modelo, pero es red)");
ok(/S\.negocio = \{ tipo: ORIGEN\.tipo/.test(C) && /falta: \(ORIGEN\.avisos \|\| \[\]\)/.test(C),
  "el expediente guarda el negocio y lo que le faltaba al dato — hace comparables los tres escenarios");
ok(/motivosDelDato: \(nat\.motivos/.test(C), "…y por turno, el motivo del motor cuando el dato no soportó algo");

console.log("\n3c · P3 · el camino que la consola usa, probado EN VIVO con una planilla parcial");
{
  /* la planilla PARCIAL del owner: solo las columnas OBLIGATORIAS y sin la hoja Abonos. Se arma con el
   * escritor del producto para que sea el archivo que un cliente podría mandar, no una maqueta. */
  const { construirXlsx, ESTILO } = await import("./src/ingesta/escribirLibro.js");
  const { HOJAS, PARAMETROS, HOJA_EMPRESA, MARCA_PLANTILLA, AVISO_OPCIONALES } = await import("./src/config/contract/plantilla.js");
  const { datosEjemplo } = await import("./src/ingesta/plantilla/generarPlantilla.js");
  const { ingestarPlantilla } = await import("./src/ingesta/plantilla/ingestarPlantilla.js");
  const { initTenant, getTenantData } = await import("./src/data/tenantStore.js");
  const { mapaDelDato } = await import("./src/adi/agente/mapaDelDato.js");
  const { TENANT_DEMO } = await import("./src/data/tenants/demo.js");

  const datos = datosEjemplo();
  const porHoja = { Ventas: datos.ventas, Inventario: datos.inventario };
  const empresa = { nombre: HOJA_EMPRESA, anchos: [52, 30], filas: [[{ v: MARCA_PLANTILLA, s: ESTILO.TITULO }], [], [{ v: "completa estos tres campos.", s: ESTILO.AYUDA }], [],
    ...PARAMETROS.flatMap((p) => [[{ v: p.etiqueta, s: p.obligatorio ? ESTILO.OBLIGATORIA : ESTILO.OPCIONAL }, datos.parametros[p.clave] ?? null], [{ v: p.ayuda, s: ESTILO.AYUDA }], []])] };
  const hojas = HOJAS.filter((h) => h.nombre !== "Abonos").map((h) => {
    const cols = h.columnas.filter((c) => c.obligatoria);
    return { nombre: h.nombre, anchos: cols.map(() => 18), filas: [[{ v: h.que, s: ESTILO.AYUDA }], [{ v: AVISO_OPCIONALES, s: ESTILO.AYUDA }], [],
      cols.map((c) => ({ v: c.ayuda, s: ESTILO.AYUDA })), cols.map((c) => ({ v: c.titulo, s: ESTILO.OBLIGATORIA })),
      ...(porHoja[h.nombre] || []).map((f) => cols.map((c) => (f[c.campo] ?? null)))] };
  });
  const ing = ingestarPlantilla(construirXlsx([empresa, ...hojas]), { nombreArchivo: "parcial.xlsx", fechaCarga: "2026-08-31" });
  ok(ing.ok && !!ing.dataset, "★ una planilla con SOLO las columnas obligatorias CARGA (el escenario parcial existe)",
    JSON.stringify(((ing.preview || {}).bloqueos || []).map((b) => b.tipo)));
  const avisos = (ing.preview || {}).avisos || [];
  ok(avisos.some((a) => /punto de venta/.test(String(a.detalle))) && avisos.some((a) => /bodega/.test(String(a.detalle))),
    `la ingesta SÍ sabe qué columnas faltaron (${avisos.length} avisos)`, avisos.map((a) => a.tipo).join(", "));
  initTenant(ing.dataset);
  const mapa = mapaDelDato("actual");
  ok(/sin datos en: marca, familia, bodega, canal/.test(mapa),
    "el mapa que ve el agente declara los ejes que este dato no tiene", mapa.split("\n").find((l) => /sin datos/.test(l)));
  /* ⚠️ LO QUE FALTA PARA EL CRITERIO DEL OWNER, dejado a la vista y no escondido: la ingesta sabe que «Ventas
   * no trae punto de venta», pero ESO NO VIAJA AL DATASET —muere en el preview—, así que el agente puede decir
   * «no tengo el eje canal» y no «tu archivo no trae esa columna». Declinar NOMBRANDO la columna es el criterio
   * del escenario parcial, y exige que el dato lo lleve: toca el camino de ingesta, que está VIVO en
   * producción, así que se reporta antes de tocarlo. */
  ok(getTenantData().avisosDeCarga === undefined,
    "PENDIENTE DECLARADO: el dataset todavía NO lleva los avisos de la carga (por eso el agente no puede nombrar la columna)");
  initTenant(TENANT_DEMO);
}

console.log("\n4 · el protocolo de la segunda corrida existe con su gasto nombrado");
ok(P.includes("SEGUNDA CORRIDA") && P.includes("FRENO INTACTO: esta corrida NO corre sin la palabra del owner que NOMBRE el gasto."),
  "el pedido de autorización actualizado está — y el freno del gasto, intacto");
ok(P.includes("los 20 turnos REALES de los consolidados"),
  "el conteo de A quedó en los 20 turnos que existen (el 24 era estimación)");

console.log(`\n── _examen_consola_agente_gate: ${pass} PASS · ${fail} FAIL (de ${pass + fail}) ──`);
process.exit(fail ? 1 : 0);
