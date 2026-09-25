/* === _acta_ingesta_gate.mjs · EL ACTA DE INGESTA, SOBRE LOS DOS CAMINOS QUE YA EXISTEN (2026-09-25) =============
 *
 * Prueba `src/ingesta/acta/actaDeIngesta.js` — la capa declarativa que el plan v2 (Parte A §1 + Parte B §B2)
 * pide como PRIMER entregable de la Etapa 0. No re-prueba `validarPlantilla`/`motorKpi`/`mapeoDeterministico`
 * (esos ya tienen sus propios candados: `_plantilla_oficial_gate.mjs`, `_ingesta_lectura_gate.mjs`) — prueba que
 * el Acta LEE bien lo que esos módulos ya producen.
 *
 * CORTE 0a (estructura del Acta) + CORTE 0b (motor de materialidad, revisión del supervisor 2026-09-25), en
 * el orden del encargo:
 *   [A] la plantilla de demostración (Caso 1 · completo, moneda declarada) → acta completa, cero preguntas
 *   [B] una carga sin moneda declarada (camino negocio) → pregunta obligatoria
 *       una carga sin escala confirmada (camino heterogéneo) → pregunta obligatoria
 *   [C] columna desconocida (camino heterogéneo) → `pendiente`, no bloquea
 *   [D] colisión/ambigüedad EN EL CAMINO NEGOCIO → sigue siendo rechazo binario (NO se toca, ley del owner)
 *   [E] capacidades == CALCULOS/BLOQUEADOS (camino negocio) del motor, no una lista escrita a mano
 *   [F] equivalencia: `actaDeIngesta` es de SOLO LECTURA — el resultado de la ingesta que recibe sale intacto
 *   [G] CORTE 0b · materialidad NO material (heterogéneo) → se resuelve SOLA, no bloquea, no pregunta
 *   [H] CORTE 0b · materialidad MATERIAL (heterogéneo, campo opcional) → no bloquea, pregunta con cifras
 *   [I] CARNADA · la materialidad JAMÁS silencia la pregunta de escala (aunque la ambigüedad sea no-material)
 *   [J] CARNADA · un `tipo` de aviso sin entrada en `avisoSeveridad.js` hace FALLAR, nunca cae a "info"
 *
 * Determinístico · sin red · sin credenciales · sin modelo. El clasificador de `scripts/clasificarGates.mjs`
 * no lee marcadores de red en este archivo (no hay ninguno que nombrar).
 */
import { readFileSync } from "node:fs";
import { actaDeIngesta } from "./src/ingesta/acta/actaDeIngesta.js";
import { ingestarPlantilla } from "./src/ingesta/plantilla/ingestarPlantilla.js";
import { ingestarLibro } from "./src/ingesta/ingestarLibro.js";
import { construirXlsx } from "./src/ingesta/escribirLibro.js";
import { CASOS } from "./src/ingesta/plantilla/casosPrueba.js";
import { CALCULOS, BLOQUEADOS } from "./src/ingesta/plantilla/motorKpi.js";
import { MONEDAS_CONOCIDAS } from "./src/config/moneda.js";
import { severidadAviso, SEVERIDAD_AVISO } from "./src/config/contract/avisoSeveridad.js";

const FX = JSON.parse(readFileSync(new URL("./fixtures/acta-ingesta-heterogeneo-2026-09-25.json", import.meta.url), "utf8"));
const libroDe = (f) => construirXlsx([{ nombre: f.hoja, filas: f.filas }]);

let PASS = 0, FAIL = 0;
const ok = (c, m, extra = "") => { if (c) { PASS++; console.log("  ✓ " + m); } else { FAIL++; console.log("  ✗ FALLO: " + m + (extra ? "\n      " + extra : "")); } };
const H = (t) => console.log("\n" + t + "\n" + "─".repeat(Math.min(100, t.length)));

/* ── [A] LA PLANTILLA DE DEMOSTRACIÓN → ACTA COMPLETA, CERO PREGUNTAS ─────────────────────────────────────── */
H("[A] CASO 1 · COMPLETO (moneda declarada) → acta completa, cero preguntas");
const bytesCompleto = CASOS.find((c) => c.clave === "completo").construir();
const resCompleto = ingestarPlantilla(bytesCompleto, { nombreArchivo: "Caso_1_completo.xlsx" });
{
  ok(resCompleto.ok === true, "el caso completo carga (precondición del gate)");
  const acta = actaDeIngesta(resCompleto);

  ok(acta.carga.tipo === "negocio", `el tipo se detecta solo, por la FORMA del resultado: "${acta.carga.tipo}"`);
  ok(acta.carga.fuente.archivo === "Caso_1_completo.xlsx", "la fuente lleva el nombre del archivo");
  ok(Array.isArray(acta.columnas) && acta.columnas.length > 0, `${acta.columnas.length} columnas en el acta`);
  const todasDelContrato = acta.columnas.every((c) => c.campo || c.origen === null);
  ok(todasDelContrato, "cada columna trae su campo del contrato, o es null cuando no hay uno que asignarle");
  const usadas = acta.columnas.filter((c) => c.estado === "usada");
  ok(usadas.length > 0 && usadas.every((c) => c.origen === "plantilla"), `${usadas.length} columnas "usada" y todas con origen "plantilla"`);
  ok(acta.columnas.every((c) => ["usada", "ignorada", "bloqueante", "pendiente"].includes(c.estado)), "el estado de cada columna es uno de los cuatro del contrato");

  ok(acta.fundamentales.moneda.valor === "CLP" && acta.fundamentales.moneda.origen === "archivo", `moneda: ${acta.fundamentales.moneda.valor} · origen ${acta.fundamentales.moneda.origen}`);
  ok(acta.fundamentales.escala.valor === "raw" && acta.fundamentales.escala.origen === "declarada_por_motor", "escala: declarada por el motor, nunca preguntada en este camino");
  ok(acta.fundamentales.entidadEje.valor === "cliente", "el eje de entidad es «cliente», el único que declara hoy la plantilla");

  ok(Array.isArray(acta.ambiguedades) && acta.ambiguedades.length === 0, "sin ambigüedades: el archivo completo no tiene ninguna colisión");
  ok(acta.preguntas.length === 0, `CERO preguntas — todo lo fundamental está declarado (${acta.preguntas.length} preguntas)`, JSON.stringify(acta.preguntas));

  ok(acta.capacidades.calculables === CALCULOS, "las capacidades calculables SON el registro CALCULOS del motor (misma referencia, no una copia)");
  ok(acta.capacidades.bloqueadas === BLOQUEADOS, "las bloqueadas SON el registro BLOQUEADOS del motor");
  ok(Array.isArray(acta.capacidades.caras) && acta.capacidades.caras.length === 4, `4 caras de la Mesa (${acta.capacidades.caras.map((c) => c.cara).join(" · ")})`);
  ok(acta.capacidades.caras.every((c) => c.completa), "con el archivo completo las 4 caras dan COMPLETA");
  ok(Array.isArray(acta.capacidades.ausencias) && acta.capacidades.ausencias.length > 0, `${acta.capacidades.ausencias.length} ausencias del dominio comercial+inventario, derivadas de ausencias.js`);

  ok(acta.calidad.hallazgos.every((h) => ["blocker", "warning", "info"].includes(h.severidad)), "cada hallazgo de calidad trae una severidad reconocida");
  ok(acta.calidad.compatibilidad !== null && "inventario|venta_comercial" in acta.calidad.compatibilidad, "la compatibilidad entre universos viaja (medida por motorKpi, no inventada acá)");
}

/* ── [B] FUNDAMENTALES SIN DECLARAR → PREGUNTA OBLIGATORIA ─────────────────────────────────────────────────── */
H("[B] SIN MONEDA (negocio) y SIN ESCALA CONFIRMADA (heterogéneo) → pregunta obligatoria");
{
  // sin moneda: se parte del mismo resultado válido y se borra lo que el archivo declaró — así se prueba SOLO
  // la reacción del Acta ante la ausencia, no una segunda ronda de `validarPlantilla`.
  const sinPerfil = { ...resCompleto.dataset.perfil }; delete sinPerfil.moneda;
  const sinMoneda = { ...resCompleto, dataset: { ...resCompleto.dataset, perfil: sinPerfil } };
  const actaSinMoneda = actaDeIngesta(sinMoneda);
  ok(actaSinMoneda.fundamentales.moneda.origen === "preguntar" && actaSinMoneda.fundamentales.moneda.valor === null, "sin moneda declarada: fundamentales.moneda queda en «preguntar», nunca inventada");
  const pregMoneda = actaSinMoneda.preguntas.find((p) => p.campo === "moneda");
  ok(!!pregMoneda, "…y aparece en preguntas[]");
  ok(pregMoneda && pregMoneda.canal === "pantalla", "la pregunta de moneda va por pantalla");
  ok(pregMoneda && Array.isArray(pregMoneda.opciones) && pregMoneda.opciones.join(",") === MONEDAS_CONOCIDAS.join(","), "las opciones de moneda SALEN de config/moneda.js, no de una lista escrita acá");
  ok(pregMoneda && pregMoneda.porQue === "en qué moneda están las cifras de venta, costo y stock. si lo dejas en blanco, te lo preguntamos al cargar.", "el texto de la pregunta es el rótulo del contrato (PARAMETROS), no redacción libre del Acta");

  // con memoria de empresa: la moneda de una carga anterior EVITA la pregunta — nunca se infiere, se RECUERDA
  const actaConMemoria = actaDeIngesta(sinMoneda, { memoriaEmpresa: { moneda: "USD" } });
  ok(actaConMemoria.fundamentales.moneda.valor === "USD" && actaConMemoria.fundamentales.moneda.origen === "memoria_empresa", "con memoria de empresa declarada, no se pregunta de nuevo");
  ok(!actaConMemoria.preguntas.some((p) => p.campo === "moneda"), "…y no hay pregunta de moneda en ese caso");

  // sin escala confirmada: el camino heterogéneo, con su propio cerrojo (`unidadesConfirmadas: false`)
  const resSinEscala = ingestarLibro(libroDe(FX.sin_escala_confirmada), { id: "x", nombre: "X", nombreArchivo: "x.xlsx", unidadesConfirmadas: false });
  ok(resSinEscala.ok === false, "sin confirmar unidades, el camino heterogéneo bloquea TODO el eje (precondición del gate)");
  const actaSinEscala = actaDeIngesta(resSinEscala);
  ok(actaSinEscala.fundamentales.escala.origen === "preguntar", `sin unidades confirmadas: fundamentales.escala.origen = "${actaSinEscala.fundamentales.escala.origen}"`);
  const pregEscala = actaSinEscala.preguntas.find((p) => p.campo === "escala");
  ok(!!pregEscala && pregEscala.canal === "pantalla", "…y aparece como pregunta obligatoria por pantalla");
}

/* ── [C] COLUMNA DESCONOCIDA (heterogéneo) → PENDIENTE, NO BLOQUEA ─────────────────────────────────────────── */
H("[C] COLUMNA DESCONOCIDA (heterogéneo) → pendiente, no bloquea la carga");
{
  const res = ingestarLibro(libroDe(FX.columna_desconocida), { id: "y", nombre: "Y", nombreArchivo: "y.xlsx", unidadesConfirmadas: true });
  ok(res.ok === true, `la carga entra igual con una columna desconocida (${res.ok ? "" : res.bloqueos.map((b) => b.detalle).join(" · ")})`);
  const acta = actaDeIngesta(res);
  const pendiente = acta.columnas.find((c) => c.columna === "Vendedor");
  ok(!!pendiente, "«Vendedor» aparece en columnas[]");
  ok(pendiente && pendiente.estado === "pendiente" && pendiente.campo === null && pendiente.origen === null, `estado "${pendiente && pendiente.estado}" · campo ${pendiente && pendiente.campo} · origen ${pendiente && pendiente.origen}`);
  ok(!acta.preguntas.some((p) => p.campo === "Vendedor"), "una columna pendiente NO genera una pregunta obligatoria por sí sola (corte 0b: eso es trabajo del modelo + confirmación humana)");
}

/* ── [D] COLISIÓN / AMBIGÜEDAD EN EL CAMINO NEGOCIO → SIGUE SIENDO RECHAZO BINARIO ─────────────────────────── */
H("[D] AMBIGÜEDAD · camino negocio (título parecido) — NO se toca: ley del owner (miles-contra-dólares)");
{
  // Caso 3 (malo) trae "venta (miles)" — título parecido a "venta", que el portero NO acepta como equivalente.
  // El supervisor autorizó el motor de materialidad SOLO en el camino heterogéneo; acá sigue exactamente
  // igual que en el corte 0a — sin evaluar materialidad, `accion` siempre "preguntar".
  const bytesMalo = CASOS.find((c) => c.clave === "malo").construir();
  const resMalo = ingestarPlantilla(bytesMalo, { nombreArchivo: "Caso_3_malo.xlsx" });
  ok(resMalo.ok === false, "el caso malo se rechaza (precondición del gate)");
  const actaMalo = actaDeIngesta(resMalo);
  ok(actaMalo.ambiguedades.length >= 1, `${actaMalo.ambiguedades.length} ambigüedad(es) en el camino negocio`);
  const amb1 = actaMalo.ambiguedades[0];
  ok(!!amb1 && Array.isArray(amb1.candidatas) && amb1.candidatas.length === 2, "trae candidatas (dos interpretaciones)");
  ok(!!amb1 && amb1.materialidad && amb1.materialidad.material === null, "materialidad.material queda en null — el camino negocio no evalúa materialidad, por diseño");
  ok(!!amb1 && amb1.accion === "preguntar", "sin materialidad medida, la acción por defecto es preguntar (nunca elegir en silencio)");
  ok(!!amb1 && amb1.pregunta && typeof amb1.pregunta.texto === "string" && amb1.pregunta.texto.length > 0, "trae una pregunta con texto");
  const bloqueanteEnColumnas = actaMalo.columnas.some((c) => c.estado === "bloqueante");
  ok(bloqueanteEnColumnas, "la MISMA ambigüedad también deja una columna en estado «bloqueante» en columnas[]");
}

/* ── [E] CAPACIDADES · == CALCULOS/BLOQUEADOS, NUNCA UNA LISTA A MANO ──────────────────────────────────────── */
H("[E] CAPACIDADES coinciden EXACTO con CALCULOS/BLOQUEADOS del motor (camino negocio)");
{
  const acta = actaDeIngesta(resCompleto);
  ok(acta.capacidades.calculables.length === CALCULOS.length, `${acta.capacidades.calculables.length} calculables == ${CALCULOS.length} de CALCULOS`);
  ok(acta.capacidades.bloqueadas.length === BLOQUEADOS.length, `${acta.capacidades.bloqueadas.length} bloqueadas == ${BLOQUEADOS.length} de BLOQUEADOS`);
  ok(acta.capacidades.calculables.every((c, i) => c === CALCULOS[i]), "cada entrada es la MISMA referencia del registro (no una reconstrucción)");
}

/* ── [F] EQUIVALENCIA · EL ACTA ES DE SOLO LECTURA ─────────────────────────────────────────────────────────── */
H("[F] EQUIVALENCIA · la ingesta existente produce EXACTAMENTE la misma salida con o sin el Acta");
{
  const antes = JSON.stringify(resCompleto);
  actaDeIngesta(resCompleto);
  actaDeIngesta(resCompleto, { memoriaEmpresa: { moneda: "USD" } });
  const despues = JSON.stringify(resCompleto);
  ok(antes === despues, "llamar a actaDeIngesta() una y dos veces no mutó el resultado de ingestarPlantilla ni un byte");

  const resHeterogeneo = ingestarLibro(construirXlsx([{ nombre: "Ventas", filas: [["Cliente", "Venta del mes"], ["Cuenta Uno", 1000]] }]),
    { id: "w", nombre: "W", nombreArchivo: "w.xlsx", unidadesConfirmadas: true });
  const antesH = JSON.stringify(resHeterogeneo);
  actaDeIngesta(resHeterogeneo);
  const despuesH = JSON.stringify(resHeterogeneo);
  ok(antesH === despuesH, "…y lo mismo para el resultado de ingestarLibro");

  // el resultado ok:false (el caso malo) también se lee sin romperse ni mutar nada
  const bytesMalo = CASOS.find((c) => c.clave === "malo").construir();
  const resMalo = ingestarPlantilla(bytesMalo, { nombreArchivo: "m.xlsx" });
  const antesM = JSON.stringify(resMalo);
  const actaM = actaDeIngesta(resMalo);
  ok(JSON.stringify(resMalo) === antesM, "un resultado rechazado (ok:false, dataset:null) también se lee sin mutarlo");
  ok(actaM.carga.tipo === "negocio" && Array.isArray(actaM.columnas), "…y produce un acta válida igual (columnas con lo que se pudo leer del archivo)");
}

/* ── [G] CORTE 0b · AMBIGÜEDAD NO MATERIAL (heterogéneo) → SE RESUELVE SOLA ────────────────────────────────── */
H("[G] CORTE 0b · «Costo»/«Costo total» con LOS MISMOS valores → diferencia $0, piso $1,5 → NO material");
{
  const res = ingestarLibro(libroDe(FX.ambiguedad_no_material),
    { id: "nomat", nombre: "No material", nombreArchivo: "nomat.xlsx", unidadesConfirmadas: true, ejePorHoja: { [FX.ambiguedad_no_material.hoja]: FX.ambiguedad_no_material.eje } });
  ok(res.ok === true, `la carga entra SIN bloqueo — se resolvió sola (${res.ok ? "" : res.bloqueos.map((b) => b.detalle).join(" · ")})`);
  ok(res.dataset.clientesMargen.length === 2 && res.dataset.clientesMargen.every((c) => typeof c.costo === "number"), "…y el campo «costo» SÍ quedó poblado en el dataset real (no se descartó)");

  const acta = actaDeIngesta(res);
  ok(!acta.ambiguedades.some((a) => a.campo === "costo"), "la ambigüedad YA NO aparece en ambiguedades[] — no queda nada pendiente de preguntar");
  ok(!acta.preguntas.some((p) => p.campo === "costo"), "…y tampoco genera una pregunta");
  const col = acta.columnas.find((c) => c.campo === "costo" && c.estado === "usada");
  ok(!!col, "en columnas[] el campo «costo» quedó «usada» (resuelto), no «pendiente» ni «bloqueante»");

  const avisoResuelto = acta.calidad.hallazgos.find((h) => h.tipo === "ambiguedad-resuelta-por-no-material");
  ok(!!avisoResuelto, "queda declarado un hallazgo «ambiguedad-resuelta-por-no-material» — cero cambio silencioso");
  ok(avisoResuelto && avisoResuelto.severidad === "info", `severidad "${avisoResuelto && avisoResuelto.severidad}" (informativo: no hubo pérdida material)`);

  const propuesta = acta.memoriaEmpresa.find((m) => m.clase === "mapeoColumna");
  ok(!!propuesta, "el supuesto elegido queda propuesto en memoriaEmpresa[] (clase «mapeoColumna»)");
  ok(propuesta && propuesta.valor.campo === "costo" && propuesta.confirmacion === "propuesta", `propuesta: campo "${propuesta && propuesta.valor.campo}" · columna "${propuesta && propuesta.valor.columna}" · confirmación "${propuesta && propuesta.confirmacion}"`);
}

/* ── [H] CORTE 0b · AMBIGÜEDAD MATERIAL (heterogéneo, campo OPCIONAL) → NO BLOQUEA, PREGUNTA CON CIFRAS ──────── */
H("[H] CORTE 0b · «Costo»/«Costo alternativo» MUY distintos → diferencia $18.000, piso $15 → MATERIAL");
{
  const res = ingestarLibro(libroDe(FX.ambiguedad_material),
    { id: "mat", nombre: "Material", nombreArchivo: "mat.xlsx", unidadesConfirmadas: true, ejePorHoja: { [FX.ambiguedad_material.hoja]: FX.ambiguedad_material.eje } });
  ok(res.ok === true, `«costo» es OPCIONAL en clientesMargen: la carga entra igual, aunque la ambigüedad sea material (${res.ok ? "" : res.bloqueos.map((b) => b.detalle).join(" · ")})`);
  ok(!res.dataset.clientesMargen.some((c) => typeof c.costo === "number"), "…y el campo «costo» queda SIN poblar (no se elige una candidata al azar)");

  const acta = actaDeIngesta(res);
  const amb = acta.ambiguedades.find((a) => a.campo === "costo");
  ok(!!amb, "la ambigüedad SIGUE en ambiguedades[] — no se resolvió sola");
  ok(!!amb && amb.materialidad.material === true, `materialidad.material = ${amb && amb.materialidad.material}`);
  ok(!!amb && amb.materialidad.deltaMax === 18000 && amb.materialidad.piso === 15, `deltaMax=${amb && amb.materialidad.deltaMax} · piso=${amb && amb.materialidad.piso} (0.05% de $30.000)`);
  ok(!!amb && amb.candidatas.length === 2 && amb.candidatas.every((c) => c.resultados.length > 0), "las DOS candidatas traen resultados (cifras), no un array vacío");
  ok(!!amb && amb.candidatas.some((c) => c.resultados.some((r) => r.metrica === "contribucion" && r.valor === 20700))
          && amb.candidatas.some((c) => c.resultados.some((r) => r.metrica === "contribucion" && r.valor === 2700)),
    `las cifras de cada candidata son correctas: ${JSON.stringify(amb.candidatas.map((c) => c.resultados))}`);
  ok(!!amb && amb.accion === "preguntar", "acción: preguntar (material)");
  ok(!!amb && /\$20\.700|\$2\.700|18\.000/.test(amb.pregunta.texto), `el TEXTO de la pregunta trae las cifras de cada candidata: "${amb && amb.pregunta.texto}"`);

  const pregunta = acta.preguntas.find((p) => p.campo === "costo");
  ok(!!pregunta, "…y aparece en preguntas[] (top-level), con canal pantalla");
  ok(pregunta && pregunta.canal === "pantalla", "canal pantalla");

  const col = acta.columnas.find((c) => c.campo === "costo");
  ok(!!col && col.estado === "pendiente", `columnas[]: «costo» queda "${col && col.estado}" (pendiente, NO bloqueante — es opcional)`);
  ok(!acta.memoriaEmpresa.some((m) => m.clase === "mapeoColumna"), "sin resolución automática, no hay propuesta de memoria para este campo");
}

/* ── [I] CARNADA · LA MATERIALIDAD JAMÁS SILENCIA LA PREGUNTA DE ESCALA ────────────────────────────────────── */
H("[I] CARNADA · unidadesConfirmadas:false + ambigüedad NO material → la materialidad NUNCA corre, escala se pregunta igual");
{
  // la MISMA hoja de [G] (que resolvería sola con unidadesConfirmadas:true), ahora SIN confirmar unidades.
  const res = ingestarLibro(libroDe(FX.ambiguedad_no_material),
    { id: "carnada", nombre: "Carnada", nombreArchivo: "carnada.xlsx", unidadesConfirmadas: false, ejePorHoja: { [FX.ambiguedad_no_material.hoja]: FX.ambiguedad_no_material.eje } });
  ok(res.ok === false, "sin unidades confirmadas la carga bloquea igual (precondición)");
  ok(res.bloqueos.some((b) => b.tipo === "unidades-sin-confirmar"), "…por el bloqueo de escala");
  ok(res.bloqueos.some((b) => b.tipo === "columna-ambigua"), "…Y TAMBIÉN por la ambigüedad — que NO se evaluó ni se resolvió: sin unidades no hay un solo número confiable");
  ok(!res.preview.avisos.some((a) => a.tipo === "ambiguedad-resuelta-por-no-material"), "la materialidad NUNCA corrió: cero avisos «ambiguedad-resuelta-por-no-material»");
  const hoja0 = res.preview.hojas[0];
  ok((hoja0.resueltasPorMaterialidad || []).length === 0, "…y `resueltasPorMaterialidad` queda vacío (no confundir con [G], la misma hoja con unidades SÍ confirmadas)");

  const acta = actaDeIngesta(res);
  ok(acta.fundamentales.escala.origen === "preguntar", `fundamentales.escala.origen = "${acta.fundamentales.escala.origen}" — la materialidad no la tocó`);
  ok(acta.preguntas.some((p) => p.campo === "escala"), "la pregunta de escala SIGUE apareciendo en preguntas[]");
}

/* ── [J] CARNADA · UN TIPO DE AVISO SIN ENTRADA HACE FALLAR (nunca cae a "info" en silencio) ──────────────── */
H('[J] CARNADA · severidadAviso("un-tipo-que-no-existe") debe LANZAR, no devolver "info"');
{
  let lanzo = false;
  try { severidadAviso("un-tipo-que-nunca-se-declaro-2026"); }
  catch (e) { lanzo = true; ok(/no está declarado/.test(e.message), `el mensaje dice qué falta: "${e.message}"`); }
  ok(lanzo, "severidadAviso() LANZA ante un tipo desconocido — no cae a info por defecto");

  // y la tabla cubre TODOS los tipos que los dos caminos de ingesta pueden producir hoy — se prueba contra los
  // avisos REALES que ya salieron en este mismo gate ([A] camino negocio completo trae varios).
  const acta = actaDeIngesta(resCompleto);
  const tiposVistos = new Set(acta.calidad.hallazgos.map((h) => h.tipo));
  ok(tiposVistos.size > 0, `${tiposVistos.size} tipos de aviso/bloqueo distintos vistos en el caso completo, todos clasificados sin lanzar`);
  ok(Object.keys(SEVERIDAD_AVISO).length >= 15, `la tabla declara ${Object.keys(SEVERIDAD_AVISO).length} tipos (cerrada, no un patrón que "cubre cualquier cosa")`);
}

console.log(`\n${"═".repeat(60)}\n${PASS} PASS · ${FAIL} FAIL\n${"═".repeat(60)}`);
if (FAIL > 0) process.exit(1);
