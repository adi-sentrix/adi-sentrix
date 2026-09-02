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
  const { mapaDelDato, faltanteQueToca } = await import("./src/adi/agente/mapaDelDato.js");
  const { answerViaAgente } = await import("./src/adi/agente/bucleAgente.js");
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
  /* ── EL PENDIENTE, CERRADO (owner vía supervisor 2026-08-31) ─────────────────────────────────────────────
   * Lo que la ingesta descubre YA VIAJA con el dato (`avisosDeCarga`), y con eso el agente puede decir la
   * CAUSA en vez de la consecuencia. Las cuatro condiciones con las que se aprobó, probadas acá: */
  const d = getTenantData();
  ok(Array.isArray(d.avisosDeCarga) && d.avisosDeCarga.length > 0,
    `★ (1) el dataset lleva lo que el archivo NO trajo (${(d.avisosDeCarga || []).length} entradas)`);
  ok(d.avisosDeCarga.some((a) => /no vino la hoja «Abonos»/.test(a.detalle))
    && d.avisosDeCarga.some((a) => /«Ventas» no trae la columna "canal"/.test(a.detalle)),
    "…nombrando la hoja y la columna por su nombre, contra el contrato");
  const mapaP = mapaDelDato("actual");
  ok(/TU ARCHIVO NO TRAE \(\d+\)/.test(mapaP) && /no trae la columna "canal"/.test(mapaP),
    "★ (3) el mapa DECLARA lo que falta con las palabras de la ingesta — no deriva consecuencias nuevas");

  // (4) LA CONDUCTA OBJETIVO: nombra la pieza, no se disculpa ni inventa
  const mudo = async () => ({ tipo: "texto", texto: "" });
  const casos = [
    ["quien me debe y que esta vencido", /Tu archivo no trae la hoja Abonos: con eso te abro quién te debe/],
    ["dame el ranking por canal", /Tu archivo no trae la columna «canal» de Ventas/],
    ["cuanto vendi a credito", /Tu archivo no trae la columna «condición» de Ventas/],
  ];
  for (const [q, esperado] of casos) {
    const r = await answerViaAgente({ text: q, history: [], mem: {}, scenario: "actual", callAgente: mudo });
    ok(esperado.test(r.r.text) && r.r.agente.estado !== "vacio",
      `★ (4) «${q.slice(0, 34)}…» → nombra la pieza que falta (${r.r.agente.estado})`, r.r.text.slice(0, 120));
    ok(!/No tengo información autorizada suficiente/.test(r.r.text), "…y no cae en la disculpa genérica");
  }

  /* (2) EL PACK VIEJO — hay packs REALES guardados en la base sin esta llave. Su conducta tiene que ser
   * EXACTAMENTE la de hoy: ausencia de la llave NO significa «no faltaba nada», significa «no se registró».
   * ⚠️ 2026-09-01: «la de hoy» ya no se hardcodea. El check nació afirmando la disculpa genérica porque esa ERA
   * la conducta de hoy; al ganar «quién me debe» camino garantizado (playbook cobranza), el hardcode caducó. Se
   * mide la propiedad que el check siempre nombró: misma pregunta contra el pack DE HOY y el viejo, igualdad
   * exacta — y que ambas sean la respuesta REAL (dos fallas idénticas no cuentan como conducta). */
  const { plantillaEjemplo } = await import("./src/ingesta/plantilla/generarPlantilla.js");
  const completa = ingestarPlantilla(plantillaEjemplo(), { nombreArchivo: "completa.xlsx", fechaCarga: "2026-08-31" });
  initTenant(completa.dataset);
  const rHoy = await answerViaAgente({ text: "quien me debe y que esta vencido", history: [], mem: {}, scenario: "actual", callAgente: mudo });
  const { avisosDeCarga, ...packViejo } = completa.dataset;   // el pack tal como está guardado hoy en la base
  initTenant(packViejo);
  ok(!/TU ARCHIVO NO TRAE/.test(mapaDelDato("actual")),
    "★ (2) con un pack SIN la llave, el mapa no dice nada de faltantes — ausencia ≠ «no faltaba nada»");
  ok(faltanteQueToca("quien me debe y que esta vencido") === null,
    "…y nada se inventa por la ausencia del campo");
  const rViejo = await answerViaAgente({ text: "quien me debe y que esta vencido", history: [], mem: {}, scenario: "actual", callAgente: mudo });
  ok(rViejo.r.text === rHoy.r.text && /Saldo pendiente/.test(rViejo.r.text),
    "…la conducta del pack viejo es EXACTAMENTE la de hoy — la respuesta real del cobro, sin crash ni falta inventada",
    rViejo.r.text.slice(0, 80));

  /* ── LAS REGLAS, CONTRA LOS AVISOS QUE LA INGESTA EMITE DE VERDAD (no contra los que yo esperaba) ────────
   * El supervisor midió la planilla REAL del owner y encontró el hueco: mis reglas buscaban la COLUMNA
   * ausente, pero en un archivo de verdad las hojas y columnas opcionales no se borran — **vienen vacías**.
   * La plantilla oficial se descarga con las cuatro hojas adentro, así que la hoja vacía es el caso NORMAL:
   * `hoja «Abonos» vino sin ninguna fila` y `"canal" quedó vacía en todas las filas`. Con la hoja Inventario
   * vacía, NINGUNA regla matcheaba y «capital por bodega» volvía a la disculpa sin nombre.
   * Se prueban acá los textos exactos que la ingesta produce, uno por uno: una regla que solo funciona con el
   * aviso que imaginé es una regla que no funciona. */
  const AVISOS_REALES = [
    ["la hoja «Abonos» vino sin ninguna fila", "quién me debe y qué está vencido", /la hoja Abonos/],
    ["la hoja «Inventario» vino sin ninguna fila", "dame el capital por bodega", /la hoja Inventario/],
    ["la hoja «Inventario» vino sin ninguna fila", "qué SKU tienen capital frenado", /la hoja Inventario/],
    ['"canal" quedó vacía en todas las filas', "ranking por canal", /columna «canal»/],
    ['"condición" quedó vacía en todas las filas', "cuánto vendí a crédito", /columna «condición»/],
    ['"punto de venta" quedó vacía en todas las filas', "mejores y peores puntos de venta", /columna «punto de venta»/],
    ['"bodega" quedó vacía en todas las filas', "capital por bodega", /columna «bodega»/],
    ['"marca" quedó vacía en todas las filas', "qué marca deja más margen", /columna «marca»/],
    ['"familia" quedó vacía en todas las filas', "margen por familia", /columna «familia»/],
    /* EL PLURAL, que es como se pregunta de verdad — «ranking de puntoS de venta» es el turno textual del
     * escenario 3 y el patrón en singular no lo veía. Misma familia que el `\b` acentuado: la regla medía una
     * FORMA de escribir, no el concepto. Cazado por este gate al usar la pregunta real. */
    ['"punto de venta" quedó vacía en todas las filas', "ranking de puntos de venta", /columna «punto de venta»/],
    ['"canal" quedó vacía en todas las filas', "ranking por canales", /columna «canal»/],
    ['"bodega" quedó vacía en todas las filas', "capital por bodegas", /columna «bodega»/],
    ['"familia" quedó vacía en todas las filas', "margen por familias", /columna «familia»/],
  ];
  for (const [aviso, pregunta, esperado] of AVISOS_REALES) {
    initTenant({ ...packViejo, avisosDeCarga: [{ tipo: "x", detalle: aviso }] });
    const f = faltanteQueToca(pregunta);
    ok(!!f && esperado.test(f.pieza), `★ «${aviso.slice(0, 46)}…» + «${pregunta.slice(0, 30)}» → nombra la pieza`,
      JSON.stringify(f));
  }
  /* ⚠️ EL NOMBRE DE UNA ENTIDAD NO ES UN EJE (medido sobre la parcial corregida, 2026-09-01): el cliente
   * «Depósito Riachuelo» hacía que una pregunta sobre ÉL disparara la regla de BODEGA por la palabra
   * «depósito», y ADI contestaba «tu archivo no trae la columna bodega» a una pregunta de cliente. En
   * distribución esos nombres son la norma, así que el falso positivo era esperable, no raro. */
  initTenant({ ...packViejo, avisosDeCarga: [{ tipo: "columna-opcional-vacia", detalle: '«Inventario»: "bodega" quedó vacía en todas las filas' }] });
  ok(faltanteQueToca("cuánto me compró Depósito Riachuelo el último mes") === null,
    "★ el nombre de un cliente («Depósito Riachuelo») NO se lee como el eje bodega",
    JSON.stringify(faltanteQueToca("cuánto me compró Depósito Riachuelo el último mes")));
  ok(!!faltanteQueToca("dame el capital por bodega"),
    "…y la pregunta que SÍ es del eje sigue nombrando la pieza");

  /* ⚠️ EL TAPADO NO PUEDE CURAR DE MÁS (control del supervisor, 2026-09-01): con una entidad llamada
   * EXACTAMENTE como el eje, tapar borraba de la pregunta la palabra que la regla necesita y la pieza dejaba
   * de nombrarse — falla SILENCIOSA, la peor: nada se pone rojo. El control aísla la única variable (el nombre
   * de la entidad) dejando el aviso presente en los dos casos. */
  {
    const { initTenant: _it } = await import("./src/data/tenantStore.js");
    const avisoCanal = [{ tipo: "columna-opcional-vacia", detalle: '«Ventas»: "canal" quedó vacía en todas las filas' }];
    const conMarca = (marca) => ({ ...packViejo, avisosDeCarga: avisoCanal,
      marcasMargen: [{ nombre: marca, venta: 1000, margen: 20 }], MARCAS_ALL: [marca] });
    _it(conMarca("Acme"));
    const neutral = faltanteQueToca("ranking por canal");
    _it(conMarca("Canal"));
    const homonima = faltanteQueToca("ranking por canal");
    ok(!!neutral && /columna «canal»/.test(neutral.pieza), "CONTROL · con marca «Acme», «ranking por canal» nombra la pieza");
    ok(!!homonima && /columna «canal»/.test(homonima.pieza),
      "★ y con una marca llamada «Canal» TAMBIÉN — el tapado ya no se come la palabra del eje", JSON.stringify(homonima));
    /* EL CRUCE, que es donde un arreglo así se rompe (lo señaló el supervisor y por eso queda acá, no en su
     * medición de una vez): con la marca homónima CARGADA y el aviso de bodega puesto, el tapado del cliente
     * tiene que seguir en pie. Un arreglo que cure la homónima rompiendo «Depósito Riachuelo» pasaría los dos
     * checks de arriba por separado y solo este los cruza. */
    const avisoBodega = [{ tipo: "columna-opcional-vacia", detalle: '«Inventario»: "bodega" quedó vacía en todas las filas' }];
    const conMarcaYBodega = (marca) => ({ ...packViejo, avisosDeCarga: avisoBodega,
      marcasMargen: [{ nombre: marca, venta: 1000, margen: 20 }], MARCAS_ALL: [marca] });
    _it(conMarcaYBodega("Canal"));
    ok(faltanteQueToca("cuánto me compró Depósito Riachuelo el último mes") === null,
      "★ CRUCE · con la marca «Canal» cargada, «Depósito Riachuelo» SIGUE tapado — curar uno no rompió el otro",
      JSON.stringify(faltanteQueToca("cuánto me compró Depósito Riachuelo el último mes")));
    _it(conMarcaYBodega("Bodega"));
    const homoBodega = faltanteQueToca("dame el capital por bodega");
    ok(!!homoBodega && /columna «bodega»/.test(homoBodega.pieza),
      "★ y el segundo eje igual · con una marca llamada «Bodega», «capital por bodega» nombra la pieza",
      JSON.stringify(homoBodega));
  }

  /* Y EL ORDEN: con la hoja Inventario vacía, la pieza que falta es la HOJA, no su columna — mandar al usuario
   * a agregar «bodega» en una hoja que vino en blanco sería mandarlo a arreglar lo que no es. */
  initTenant({ ...packViejo, avisosDeCarga: [
    { tipo: "hoja-vacia", detalle: "la hoja «Inventario» vino sin ninguna fila" },
    { tipo: "columna-opcional-vacia", detalle: '"bodega" quedó vacía en todas las filas' }] });
  const fOrden = faltanteQueToca("dame el capital por bodega");
  ok(!!fOrden && /la hoja Inventario/.test(fOrden.pieza),
    "★ con la hoja vacía Y la columna vacía, gana la HOJA: falta el inventario entero, no una columna", JSON.stringify(fOrden));

  /* (1) ESTRICTAMENTE ADITIVO: el pack de la planilla completa es el MISMO de siempre salvo la llave nueva. */
  const clavesViejas = Object.keys(packViejo).sort().join(",");
  const clavesNuevas = Object.keys(completa.dataset).sort().filter((k) => k !== "avisosDeCarga").join(",");
  ok(clavesViejas === clavesNuevas, "★ (1) el pack es byte-idéntico en forma salvo la llave nueva");
  initTenant(TENANT_DEMO);
  ok(getTenantData().avisosDeCarga === undefined, "…y el demo de fábrica, que no pasa por la ingesta, queda intacto");
}

console.log("\n4 · el protocolo de la segunda corrida existe con su gasto nombrado");
ok(P.includes("SEGUNDA CORRIDA") && P.includes("FRENO INTACTO: esta corrida NO corre sin la palabra del owner que NOMBRE el gasto."),
  "el pedido de autorización actualizado está — y el freno del gasto, intacto");
ok(P.includes("los 20 turnos REALES de los consolidados"),
  "el conteo de A quedó en los 20 turnos que existen (el 24 era estimación)");

console.log(`\n── _examen_consola_agente_gate: ${pass} PASS · ${fail} FAIL (de ${pass + fail}) ──`);
process.exit(fail ? 1 : 0);
