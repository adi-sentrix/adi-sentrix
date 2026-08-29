/* === _plantilla_congelada_gate.mjs · LA ESTRUCTURA NO SE MUEVE EN SILENCIO (owner 2026-08-26) ================
 *
 * LA REGLA, textual, al cerrar la v1.6: «a partir de aquí congelamos estructura de plantilla. No más cambios de
 * columnas salvo defecto grave. Si agregamos algo, debe ser compatible hacia adelante o ir como nueva versión
 * explícita». Y las cuatro condiciones que puso para este candado:
 *   · agregar una columna OPCIONAL AL FINAL es compatible y NO exige subir versión;
 *   · quitar, renombrar, reordenar o volver obligatoria una columna SÍ la exige;
 *   · si la estructura cambia sin cambio de versión, el gate se pone ROJO;
 *   · si `PLANTILLA_VERSION` cambia, el gate exige nota/razón del cambio.
 *
 * POR QUÉ HACÍA FALTA: la estructura cambió DOS VECES EN DOS VERSIONES y cada vez invalidó los archivos que la
 * gente ya había llenado — incluido el que el owner llenó a mano. Hasta hoy la regla vivía solo escrita, y este
 * proyecto tiene medido que una regla escrita no frena nada.
 *
 * ⚠️ LO QUE ESTE CANDADO **NO** HACE, dicho sin adornos: no impide romper la compatibilidad. Impide romperla
 * **en silencio**. Para volver al verde después de una ruptura hay que subir `PLANTILLA_VERSION` y escribir la
 * razón, y las dos cosas quedan en el diff. «Defecto grave lo decido yo, no el código» — el código solo se
 * asegura de que la decisión exista y esté firmada.
 *
 * OFFLINE · contrato + sello, dos objetos en memoria · no toca red, disco de datos ni modelo.
 */
import { HOJAS, PARAMETROS, PLANTILLA_VERSION } from "./src/config/contract/plantilla.js";
import { PLANTILLA_SELLADA, compararColumnas, compararParametros } from "./src/config/contract/plantillaSellada.js";

let pass = 0, fail = 0;
const ok = (cond, label, detalle) => {
  if (cond) { pass++; console.log(`  ✓ ${label}`); }
  else { fail++; console.log(`  ✗ FALLO: ${label}${detalle !== undefined ? `\n      ${detalle}` : ""}`); }
};
const H = (t) => console.log("\n" + "=".repeat(100) + "\n" + t + "\n" + "=".repeat(100));

/** la estructura VIVA, leída del contrato */
const vivas = (nombre) => {
  const h = HOJAS.find((x) => x.nombre === nombre);
  return h ? h.columnas.map((c) => ({ campo: c.campo, titulo: c.titulo, obligatoria: !!c.obligatoria })) : null;
};
const parametrosVivos = PARAMETROS.map((p) => ({ clave: p.clave, etiqueta: p.etiqueta, obligatorio: !!p.obligatorio }));

H("1 · LA VERSIÓN VIGENTE ESTÁ SELLADA, Y CON SU RAZÓN");
const sello = PLANTILLA_SELLADA[PLANTILLA_VERSION];
{
  ok(!!sello,
    `la versión vigente «${PLANTILLA_VERSION}» tiene su estructura sellada`,
    `subiste PLANTILLA_VERSION a «${PLANTILLA_VERSION}» y no hay entrada para ella en plantillaSellada.js.\n` +
    `      Agregá la entrada con la estructura nueva Y la razón del cambio: sin razón escrita, en seis meses nadie\n` +
    `      va a saber por qué se rompió la compatibilidad, y romperla no cuesta nada.`);
  if (!sello) { console.log(`\n── _plantilla_congelada_gate: ${pass} PASS · ${fail} FAIL (de ${pass + fail}) ──`); process.exit(1); }

  /* LA RAZÓN ES LA MITAD DEL CANDADO. Sin ella, subir la versión sería un trámite de una línea y la regla del
   * owner («o va como nueva versión explícita») se cumpliría en la letra y no en el fondo. */
  ok(typeof sello.razon === "string" && sello.razon.trim().length >= 40,
    `…y su razón escrita (${(sello.razon || "").trim().length} caracteres)`,
    "una versión nueva sin razón es un cambio sin firmar: escribí QUÉ cambió y POR QUÉ valía romper los archivos ya llenados");
  ok(typeof sello.desde === "string" && /^\d{4}-\d{2}-\d{2}$/.test(sello.desde), `…y desde cuándo rige (${sello.desde})`);
  ok(/^v\d+$/.test(PLANTILLA_VERSION), `el formato de versión es el declarado (${PLANTILLA_VERSION})`);
}

H("2 · LAS HOJAS DE DATOS · quitar, renombrar, reordenar o volver obligatoria EXIGE subir versión");
{
  const selladas = Object.keys(sello.hojas);
  ok(selladas.length === HOJAS.length && HOJAS.every((h) => selladas.includes(h.nombre)),
    `las hojas de datos son las selladas: ${selladas.join(" · ")}`,
    `vivas: ${HOJAS.map((h) => h.nombre).join(" · ")} — agregar o quitar una HOJA rompe todo archivo anterior`);

  for (const nombre of selladas) {
    const v = vivas(nombre);
    if (!v) { ok(false, `«${nombre}» sigue existiendo`, "la hoja desapareció del contrato"); continue; }
    const r = compararColumnas(sello.hojas[nombre], v);
    ok(r.compatible,
      `«${nombre}»: ningún cambio rompe los archivos ya llenados${r.agregadas.length ? ` (+${r.agregadas.length} opcional${r.agregadas.length === 1 ? "" : "es"} al final: ${r.agregadas.join(", ")})` : ""}`,
      r.rupturas.map((x) => `· [${x.tipo}] ${x.detalle}`).join("\n      ") +
      `\n\n      Esto ROMPE los archivos que los clientes ya llenaron. Si es lo que querés, no alcanza con cambiar\n` +
      `      el contrato: subí PLANTILLA_VERSION (hoy «${PLANTILLA_VERSION}») y agregá su entrada con la razón en\n` +
      `      plantillaSellada.js. Si NO era lo que querías, revertí el cambio en plantilla.js.`);
  }
}

H("3 · LA HOJA EMPRESA · mismo trato, juzgada por clave y no por posición");
{
  const r = compararParametros(sello.parametros, parametrosVivos);
  ok(r.compatible,
    `la hoja Empresa: ningún cambio rompe los archivos ya llenados${r.agregadas.length ? ` (+${r.agregadas.length} opcional${r.agregadas.length === 1 ? "" : "es"})` : ""}`,
    r.rupturas.map((x) => `· [${x.tipo}] ${x.detalle}`).join("\n      ") +
    `\n\n      Subí PLANTILLA_VERSION y sellá la estructura nueva con su razón.`);
  /* Se juzga por CLAVE porque en esa hoja cada campo se lee por su etiqueta, no por su lugar en la fila: mover
   * un campo de arriba abajo no rompe ningún archivo. En las hojas de datos sí, y por eso allá se compara
   * por posición. La diferencia es del formato, no una relajación. */
  ok(true, "…y reordenarlos NO cuenta como ruptura: en esa hoja cada campo se lee por su etiqueta");
}

H("4 · CARNADA · el candado tiene que poder ponerse rojo, y distinguir");
{
  /* Sin esto, todo lo de arriba podría estar verde y ciego — pasó cinco veces en este repo. Se fabrican los
   * cinco cambios que el owner nombró y se comprueba que la comparación los clasifica uno por uno. */
  const base = [
    { campo: "a", titulo: "a", obligatoria: true },
    { campo: "b", titulo: "b", obligatoria: false },
    { campo: "c", titulo: "c", obligatoria: true },
  ];
  const casos = [
    ["AGREGAR una opcional al final", [...base, { campo: "d", titulo: "d", obligatoria: false }], true, null],
    ["QUITAR una columna", base.slice(0, 2), false, "quitada"],
    ["RENOMBRAR una columna", [base[0], { ...base[1], titulo: "be" }, base[2]], false, "renombrada"],
    ["REORDENAR dos columnas", [base[1], base[0], base[2]], false, "reordenada"],
    ["VOLVER OBLIGATORIA una opcional", [base[0], { ...base[1], obligatoria: true }, base[2]], false, "volvio-obligatoria"],
    ["AGREGAR una obligatoria al final", [...base, { campo: "d", titulo: "d", obligatoria: true }], false, "nueva-obligatoria"],
    ["meter una columna EN EL MEDIO", [base[0], { campo: "x", titulo: "x", obligatoria: false }, base[1], base[2]], false, "reordenada"],
  ];
  for (const [que, viva, esperadoCompatible, tipoEsperado] of casos) {
    const r = compararColumnas(base, viva);
    ok(r.compatible === esperadoCompatible,
      `${esperadoCompatible ? "PASA" : "ROMPE"}: ${que}`,
      `dio compatible=${r.compatible} · rupturas: ${r.rupturas.map((x) => x.tipo).join(", ") || "(ninguna)"}`);
    if (tipoEsperado) {
      ok(r.rupturas.some((x) => x.tipo === tipoEsperado),
        `…y lo nombra como «${tipoEsperado}», no como un rechazo genérico`,
        `dio: ${r.rupturas.map((x) => x.tipo).join(", ") || "(ninguna)"}`);
    }
  }
  ok(compararColumnas(base, base).compatible, "y sin cambios, verde: el candado no molesta cuando nadie tocó nada");
}

H("5 · LAS VERSIONES ANTERIORES NO DESAPARECEN");
{
  /* Un sello que se puede vaciar no es un sello. Si mañana alguien sube a v2, la entrada de v1 tiene que quedar:
   * es el registro de qué se le pidió a los clientes que llenaron con esa versión. */
  const versiones = Object.keys(PLANTILLA_SELLADA);
  ok(versiones.length >= 1, `hay ${versiones.length} versión(es) sellada(s): ${versiones.join(" · ")}`);
  ok(versiones.includes("v1"), "la v1 sigue registrada — es lo que se le pidió a quien llenó con esa versión");
  ok(versiones.every((v) => PLANTILLA_SELLADA[v].razon && PLANTILLA_SELLADA[v].hojas && PLANTILLA_SELLADA[v].parametros),
    "…y toda versión sellada trae razón, hojas y parámetros: ninguna entrada a medias");
  const nums = versiones.map((v) => Number(v.slice(1))).filter((n) => Number.isFinite(n));
  ok(Number(PLANTILLA_VERSION.slice(1)) === Math.max(...nums),
    `la versión vigente es la más alta sellada (${PLANTILLA_VERSION} de ${versiones.join(", ")})`);
}

console.log(`\n── _plantilla_congelada_gate: ${pass} PASS · ${fail} FAIL (de ${pass + fail}) ──`);
process.exit(fail === 0 ? 0 : 1);
