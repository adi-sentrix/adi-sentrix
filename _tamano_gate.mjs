/* === _tamano_gate.mjs · TAMAÑO GOBERNADO — CORTE 3d.3/3d.4 (owner 2026-09-25/26, offline) ═══════════════════════
 * `_ADI_DISENO_CORTE_3D.md` §B — `src/adi/entrega/tamano.js:gobernarTamano` + su enganche en
 * `componerEntrega(resolucion)` (`entrega/componer.js:_conTamanoGobernado`, aplicado tanto al camino GENERAL
 * como a las 4 rutas fijas cuando llegan por DELEGACIÓN — nunca a las 4 funciones exportadas llamadas directo).
 *
 * LO QUE ESTE GATE EXIGE:
 *   0 · las constantes de `verificar.js` son las que el diseño pactó: 350/900 palabras, 8/24 filas.
 *   1 · CARNADA «tope artificial» — con un texto que NUNCA cabe bajo el tope aunque se recorte todo lo
 *       recortable, la CONCLUSIÓN (prioridad 0) sigue serivida siempre — nunca es candidata a recorte.
 *   2 · CARNADA «fila de baja prioridad puesta primera» — una fila de prioridad NUMÉRICA alta (baja importancia)
 *       colocada en la posición [0] del array se recorta ANTES que una de prioridad numérica baja (alta
 *       importancia) colocada después — el recorte es por PRIORIDAD, nunca por orden de aparición.
 *   3 · CANDADO breve ⊂ completa — sobre el MISMO encargo real (D11), todo lo servido en "breve" (oraciones y
 *       filas, por id) aparece TAMBIÉN en "completa", con el MISMO render — nunca un contenido "distinto" en
 *       breve, solo un SUBCONJUNTO.
 *   4 · D11 y D27 (fixtures reales, TENANT_DEMO) — con su profundidad por defecto ("completa", ninguno de los
 *       dos la declara), el texto SERVIDO cae bajo 900 palabras y 24 filas — ANTES de este corte D27 (1620
 *       palabras / 96 filas) necesitaba la exención `IDS_SIN_TOPE_DE_TAMANO` de `_entrega_general_gate.mjs`,
 *       retirada en este mismo corte.
 *   5 · `entrega.meta.entregaRef` — determinístico (mismo tenant+escenario+encargo canónico ⇒ mismo ref, dos
 *       corridas) y sensible (un encargo distinto da un ref distinto); siempre `"E:" + hex`.
 *   6 · `entrega.detalle.comoPedirlo` — el encargo exacto, con `profundidad:"completa"`; volver a componer CON
 *       ese `comoPedirlo` da el MISMO resultado que pedir "completa" directamente (no una reconstrucción
 *       aproximada).
 *   7 · lo recortado NUNCA desaparece — cada oración/fila que sale de lo servido en "breve" aparece en
 *       `entrega.detalle.oraciones`/`.filas`, con el MISMO id.
 *   8 · CARNADA «prioridad explícita, no orden de aparición» (owner 2026-09-26) — un multitema de DOS dominios
 *       (comercial+cobranza, que NO delega en ninguna de las 4 rutas fijas — D11 sí delega y por eso no sirve
 *       para esta carnada: la ruta fija no declara `.prioridad`, así que gobierna por el fallback posicional, no
 *       por la prioridad real) declara la conclusión integrada («Quien más pesa en el conjunto…») en la posición
 *       [2] del array, prioridad 0 — en "breve" sobrevive ESA oración, aunque NO fue la primera escrita.
 *   9 · CERO red.
 *   10 · §7.3·33 (SUPERVISOR, 2026-09-28, diagnóstico v11) «tamaño con contenido obligatorio» —
 *       `meta.excedeTope` sale `true` de la CARNADA 1 (el contenido obligatorio, ya sin nada recortable,
 *       sigue sobre el tope); `verificarEntrega` (`entrega/verificar.js`, regla 8) NO rechaza esa Entrega
 *       (el exceso es SOLO contenido obligatorio, ya declarado) pero SIGUE rechazando un exceso sin
 *       `meta.excedeTope` — sea porque `meta` no lo declara (las 4 rutas fijas, que no pasan por
 *       `gobernarTamano`) o porque lo declara `false` a propósito (control negativo: el campo se lee con
 *       `=== true`, nunca por presencia).
 *
 * CERO llamadas a un LLM · CERO red. Solo por `npm run gates:offline` o
 * `node --import ./scripts/offline-guard.mjs _tamano_gate.mjs`. */
import fs from "node:fs";
import { initTenant } from "./src/data/tenantStore.js";
import { TENANT_DEMO } from "./src/data/tenants/demo.js";
import { validarEncargo } from "./src/adi/encargo/validar.js";
import { componerEntrega } from "./src/adi/entrega/componer.js";
import { gobernarTamano } from "./src/adi/entrega/tamano.js";
import { verificarEntrega, contarPalabras, TOPE_BREVE, TOPE_COMPLETA, FILAS_BREVE_MAX, FILAS_COMPLETA_MAX } from "./src/adi/entrega/verificar.js";
import { clasificarFuente } from "./scripts/clasificarGates.mjs";

let pass = 0, fail = 0;
const ok = (c, m, extra = "") => { if (c) { pass++; console.log("  ✓ " + m); } else { fail++; console.log("  ✗ " + m + (extra ? "\n      " + extra : "")); } };
const H = (t) => console.log(`\n${t}`);

initTenant(TENANT_DEMO);

/* renderizador MÍNIMO para las pruebas AISLADAS (fixtures sintéticas, sin pasar por componer.js): el MISMO
 * contrato que `_textoDeLaEntrega` (respuesta con sus oraciones, cifras con sus filas) pero sin las otras seis
 * partes — suficiente para que `gobernarTamano` mida palabras/filas reales del render, como en producción. */
function _renderStub(entrega, titulo = "Prueba") {
  const L = [`**ENTREGA ADI · ${titulo}**`, "", "**Respuesta.**"];
  for (const r of entrega.respuesta) if (r.texto) L.push(`▸ ${r.texto}`);
  L.push("", "**Cifras.**");
  for (const f of entrega.cifras.filas) L.push(`| ${Object.values(f.valores).join(" | ")} |`);
  return L.join("\n");
}
const _entregaBase = (respuesta, filas) => ({ respuesta, cifras: { columnas: [], filas }, procedencia: { libro: null }, detalle: null });

/* ═══ 0 · LAS CONSTANTES DEL DISEÑO ═══ */
H("0 · las constantes de tamaño son las que pactó el diseño (§B.1)");
ok(TOPE_BREVE === 350, `TOPE_BREVE = 350 (era: 1 solo tope de 900 para toda profundidad)`, String(TOPE_BREVE));
ok(TOPE_COMPLETA === 900, `TOPE_COMPLETA = 900 (el tope de siempre, ahora con nombre por profundidad)`, String(TOPE_COMPLETA));
ok(FILAS_BREVE_MAX === 8, `FILAS_BREVE_MAX = 8`, String(FILAS_BREVE_MAX));
ok(FILAS_COMPLETA_MAX === 24, `FILAS_COMPLETA_MAX = 24`, String(FILAS_COMPLETA_MAX));

/* ═══ 1 · CARNADA · «tope artificial» — la conclusión (prioridad 0) NUNCA se recorta ═══ */
H("1 · CARNADA «tope artificial» — trimming de la conclusión debe dar ROJO; gobernarTamano nunca la recorta");
{
  // una conclusión larga (prioridad 0, por ser la oración [0]) + 40 oraciones de relleno de baja prioridad — el
  // conjunto entero NUNCA cabe bajo 350 palabras, ni recortando TODO lo recortable (el relleno completo). Si
  // alguna implementación recortara la conclusión para "hacer caber" el resto, este candado la agarra.
  const conclusion = { texto: "Prioridad del procedimiento, por riesgo integrado: " + "abrir primero Lider por su exposición conjunta en comercial y cobranza, con evidencia cruzada de varias cuentas materiales. ".repeat(6), hechos: [], _prioridad: { alcance: "cruzada", primero: "Lider" } };
  const relleno = Array.from({ length: 40 }, (_, i) => ({ texto: `Dato adicional de contexto número ${i + 1}, de baja prioridad, prescindible si no cabe.`, hechos: [], prioridad: i + 1 }));
  const entrega = _entregaBase([conclusion, ...relleno], []);
  const { entrega: gob, texto, meta } = gobernarTamano(entrega, "breve", _renderStub, "Prueba");
  ok(gob.respuesta.some((r) => r.texto === conclusion.texto), "la conclusión (prioridad 0) sigue SERVIDA aunque el conjunto no quepa bajo 350 palabras", `palabras finales: ${meta.palabras}`);
  ok(gob.respuesta[0].texto === conclusion.texto, "la conclusión queda PRIMERA en el orden servido (orden original de aparición)");
  ok(meta.recortoOraciones > 0, "SÍ se recortó relleno (no es un no-op: el mecanismo de recorte corrió de verdad)", String(meta.recortoOraciones));
  ok(contarPalabras(texto) < contarPalabras(_renderStub(entrega, "Prueba")), "el texto final es MÁS CORTO que el original sin gobernar (el relleno de baja prioridad sí se fue)");
  // control negativo explícito (documenta qué haría ROJO este candado): si `gobernarTamano` alguna vez tratara la
  // prioridad 0 como recortable, `gob.respuesta.some(...)` de arriba daría `false` — la propia aserción ES la
  // carnada; no hace falta un segundo camino de código para "romperlo a propósito".
  // §7.3·33 (SUPERVISOR, 2026-09-28) — acá el recorte SÍ alcanza (la conclusión sola, sin relleno, cabe bajo
  // 350: ver el cálculo de la CARNADA 1b más abajo) — `meta.excedeTope` tiene que quedar `false`: la exención
  // es SOLO para cuando no queda nada más que retirar y el obligatorio por sí solo sigue sobre el tope (1b).
  ok(meta.excedeTope === false, "meta.excedeTope = false — acá el recorte alcanzó para bajar del tope (compárese con la CARNADA 1b)", `meta=${JSON.stringify(meta)}`);
}

/* ═══ 1b · CARNADA §7.3·33 — contenido obligatorio POR SÍ SOLO sobre el tope: meta.excedeTope = true ═══ */
H("1b · CARNADA §7.3·33 — sin nada recortable, el contenido obligatorio por sí solo excede el tope: meta.excedeTope = true");
{
  // la conclusión SOLA (prioridad 0, sin ningún relleno que recortar) ya excede 350 palabras — el caso exacto
  // que describe la decisión 33: "el contenido que no se recorta (premisas, conclusiones) supera el tope". El
  // bucle de `gobernarTamano` no tiene NADA que retirar (ninguna oración de prioridad > 0, ninguna fila) y
  // rompe por `!retirado` — el render final queda sobre el tope, y `meta.excedeTope` tiene que declararlo.
  const conclusionSola = { texto: "Prioridad del procedimiento, por riesgo integrado: " + "abrir primero Lider por su exposición conjunta en comercial y cobranza, con evidencia cruzada de varias cuentas materiales. ".repeat(20), _prioridad: { alcance: "cruzada", primero: "Lider" } };
  const entrega = _entregaBase([conclusionSola], []);
  const palabrasSinGobernar = contarPalabras(_renderStub(entrega, "Prueba"));
  const { entrega: gob, meta } = gobernarTamano(entrega, "breve", _renderStub, "Prueba");
  ok(palabrasSinGobernar > TOPE_BREVE, "la conclusión SOLA (sin relleno que recortar) ya supera 350 palabras — el escenario real de la decisión 33", String(palabrasSinGobernar));
  ok(gob.respuesta.some((r) => r.texto === conclusionSola.texto), "la conclusión sigue SERVIDA completa — «el tope nunca se cumple borrando una conclusión ni una premisa»");
  ok(meta.recortoOraciones === 0, "no había NADA recortable (ninguna oración de prioridad > 0, ninguna fila): el bucle no tenía qué retirar", String(meta.recortoOraciones));
  ok(meta.excedeTope === true, "meta.excedeTope = true — se sirve completo y se declara el exceso, nunca se corta a la fuerza ni se sirve oversized en silencio", `meta=${JSON.stringify(meta)}`);
}

/* ═══ 2 · CARNADA · una fila de baja prioridad puesta PRIMERA se recorta antes que una de alta prioridad puesta después ═══ */
H("2 · CARNADA «fila de baja prioridad puesta primera» — se recorta por PRIORIDAD, nunca por orden de aparición");
{
  // prioridad 99 = LA MENOS importante de todas (garantizado: mayor que cualquier relleno) — colocada PRIMERA en
  // el array; prioridad 0 = LA MÁS importante — colocada DESPUÉS. Con 9 filas y tope 8 (breve), UNA sale: tiene
  // que ser la de 99, nunca la de 0, sin importar dónde esté cada una en el array.
  const filaBajaPrimero = { valores: { A: "fila de relleno, prioridad numérica 99 (la menos importante de todas)" }, hechos: [], prioridad: 99 };
  const filaAltaDespues = { valores: { A: "fila importante, prioridad numérica 0 (la más importante)" }, hechos: [], prioridad: 0 };
  const relleno = Array.from({ length: 7 }, (_, i) => ({ valores: { A: `relleno ${i}` }, hechos: [], prioridad: 5 + i }));
  const entrega = _entregaBase([{ texto: "Una oración cualquiera, sin cifras que la aten a ninguna fila.", hechos: [], prioridad: 0 }], [filaBajaPrimero, filaAltaDespues, ...relleno]);
  const { entrega: gob } = gobernarTamano(entrega, "breve", _renderStub, "Prueba");   // topeFilas = 8; hay 9 filas: una tiene que salir
  ok(gob.cifras.filas.length === FILAS_BREVE_MAX, `con 9 filas y tope 8, sirve exactamente ${FILAS_BREVE_MAX}`, String(gob.cifras.filas.length));
  ok(!gob.cifras.filas.includes(filaBajaPrimero), "la fila de prioridad 99 (colocada PRIMERA) es la que sale — nunca la protege su posición");
  ok(gob.cifras.filas.includes(filaAltaDespues), "la fila de prioridad 0 (colocada DESPUÉS) sigue servida — la protege su prioridad, no su posición");
  // orden final: sigue siendo el orden ORIGINAL de aparición entre lo que quedó (filaBajaPrimero iba primero en
  // el array; al salir, filaAltaDespues pasa a ser la primera servida).
  ok(gob.cifras.filas[0] === filaAltaDespues, "el orden servido sigue siendo el de aparición ENTRE LO QUE QUEDÓ (nunca se reordena por prioridad)");
}

/* ═══ 3 · candado breve ⊂ completa, sobre un encargo real (D11) ═══ */
H("3 · candado «breve ⊂ completa» — D11 real: todo lo servido en breve aparece en completa, con el MISMO render");
{
  const cat = JSON.parse(fs.readFileSync("./fixtures/encargos-desarrollo.json", "utf8")).casos;
  const d11 = cat.find((c) => c.id === "D11");
  ok(!!d11, "D11 existe en el catálogo de desarrollo");
  if (d11) {
    const resBreve = validarEncargo({ ...d11.encargo, profundidad: "breve" }, {});
    const resCompleta = validarEncargo({ ...d11.encargo, profundidad: "completa" }, {});
    const Rb = componerEntrega(resBreve), Rc = componerEntrega(resCompleta);
    ok(Rb.ok && Rc.ok, "D11 compone ok en las dos profundidades", `breve.ok=${Rb.ok} completa.ok=${Rc.ok}`);
    if (Rb.ok && Rc.ok) {
      const textosServidosBreve = Rb.entrega.respuesta.map((r) => r.texto);
      const textosServidosCompleta = new Set(Rc.entrega.respuesta.map((r) => r.texto));
      ok(textosServidosBreve.every((t) => textosServidosCompleta.has(t)), "cada oración SERVIDA en breve aparece TAMBIÉN servida en completa (mismo texto)", JSON.stringify(textosServidosBreve.filter((t) => !textosServidosCompleta.has(t))));
      const filasBreve = Rb.entrega.cifras.filas.map((f) => JSON.stringify(f.valores));
      const filasCompleta = new Set(Rc.entrega.cifras.filas.map((f) => JSON.stringify(f.valores)));
      ok(filasBreve.every((f) => filasCompleta.has(f)), "cada fila SERVIDA en breve aparece TAMBIÉN servida en completa (mismos valores)", JSON.stringify(filasBreve.filter((f) => !filasCompleta.has(f))));
      ok(Rb.entrega.cifras.filas.length <= Rc.entrega.cifras.filas.length, "breve nunca sirve MÁS filas que completa");
      ok(Rb.entrega.respuesta.length <= Rc.entrega.respuesta.length, "breve nunca sirve MÁS oraciones que completa");
    }
  }
}

/* ═══ 4 · D11 y D27 reales — bajo el tope de su profundidad por defecto ("completa") ═══ */
H("4 · D11 y D27 (TENANT_DEMO, profundidad por defecto) caben bajo 900 palabras / 24 filas");
{
  const cat = JSON.parse(fs.readFileSync("./fixtures/encargos-desarrollo.json", "utf8")).casos;
  for (const id of ["D11", "D27"]) {
    const caso = cat.find((c) => c.id === id);
    ok(!!caso, `${id} existe en el catálogo`);
    if (!caso) continue;
    const res = validarEncargo(caso.encargo, {});
    const R = componerEntrega(res);
    ok(R.ok, `${id} compone ok`, R.motivo);
    if (!R.ok) continue;
    const n = contarPalabras(R.texto);
    const filas = R.entrega.cifras.filas.length;
    ok(n <= TOPE_COMPLETA, `${id} · ${n} palabras, bajo el tope de ${TOPE_COMPLETA} ("completa", su profundidad por defecto)`, `meta=${JSON.stringify(R.entrega.meta)}`);
    ok(filas <= FILAS_COMPLETA_MAX, `${id} · ${filas} filas, bajo el tope de ${FILAS_COMPLETA_MAX}`);
    ok(!!R.entrega.meta && R.entrega.meta.profundidad === "completa", `${id} · entrega.meta.profundidad = "completa" (default, el fixture no la declara)`);
  }
}

/* ═══ 4b · BREVE ≤ 350, OBLIGATORIO — D11, D27 y TODO el catálogo (owner 2026-09-26, ronda final del corte) ═══
 * `meta.palabras ≤ 350` en "breve" es OBLIGATORIO para D11, D27 y CUALQUIER caso válido del catálogo — incluidos
 * los que DELEGAN en una ruta fija (D08-D11): `_conTamanoGobernado` ahora aplica las reglas de "breve" también al
 * resultado delegado (límites con título y el motivo en `entrega.limites`/`comoPedirlo`, Referencia del oficio
 * omitida si repite la ausencia, «Qué más puedo calcular» a una sola línea, la conclusión integrada —«Prioridad
 * del procedimiento»/«Quien más pesa en el conjunto»— marcada prioridad 0 SIN tocar la función fija). Esta
 * sección declara el resultado REAL, sin relajar el tope para que pase: si algún caso no cabe, se reporta con su
 * desglose por sección (Marco/Respuesta/Cifras/Límites/Para su juicio/Qué más puedo calcular) — la decisión de
 * seguir comprimiendo esas secciones (hoy fuera de las cuatro reglas de "breve" recién enumeradas) es del owner. */
H('4b · BREVE ≤ 350 OBLIGATORIO — D11, D27 y todo el catálogo (SIN relajar el tope; los que no caben se reportan con su desglose)');
{
  const cat = JSON.parse(fs.readFileSync("./fixtures/encargos-desarrollo.json", "utf8")).casos;
  const validos = cat.filter((c) => c.esperado && c.esperado.valido === true);
  const _contarPorSeccion = (texto) => texto.split(/\n\n(?=\*\*)/).map((s) => { const t = (s.match(/^\*\*([^*]+)\*\*/) || [, "?"])[1]; return `${t}: ${contarPalabras(s)}`; }).join(" | ");
  const resultados = [];
  for (const c of validos) {
    const res = validarEncargo({ ...c.encargo, profundidad: "breve" }, {});
    if (!res.ok || !(res.partes || []).some((p) => p.estado === "resuelta" || p.estado === "parcial")) continue;
    const R = componerEntrega(res);
    if (!R.ok) continue;
    resultados.push({ id: c.id, palabras: contarPalabras(R.texto), texto: R.texto });
  }
  ok(resultados.length >= 30, `${resultados.length} casos válidos y componibles evaluados en "breve"`);
  const sobreElTope = resultados.filter((r) => r.palabras > TOPE_BREVE);
  for (const id of ["D11", "D27"]) {
    const r = resultados.find((x) => x.id === id);
    ok(!!r, `${id} está en el barrido de "breve"`);
    if (r) ok(r.palabras <= TOPE_BREVE, `${id} · "breve" ≤ ${TOPE_BREVE} palabras (OBLIGATORIO) — dio ${r.palabras}`, r.palabras > TOPE_BREVE ? `desglose: ${_contarPorSeccion(r.texto)}` : "");
  }
  ok(sobreElTope.length === 0, `TODO el catálogo (${resultados.length} casos) cae bajo ${TOPE_BREVE} palabras en "breve" — OBLIGATORIO, sin relajar`, sobreElTope.map((r) => `${r.id}: ${r.palabras}p — ${_contarPorSeccion(r.texto)}`).join("\n      "));
}

/* ═══ 5 · entrega.meta.entregaRef — determinístico y sensible al encargo ═══ */
H("5 · entrega.meta.entregaRef — MISMO tenant+escenario+encargo canónico ⇒ MISMO ref; un encargo distinto ⇒ ref distinto");
{
  const cat = JSON.parse(fs.readFileSync("./fixtures/encargos-desarrollo.json", "utf8")).casos;
  const d11 = cat.find((c) => c.id === "D11"), d09 = cat.find((c) => c.id === "D09");
  const res1 = validarEncargo(d11.encargo, {}); const res2 = validarEncargo(d11.encargo, {});
  const R1 = componerEntrega(res1), R2 = componerEntrega(res2);
  ok(typeof R1.entrega.meta.entregaRef === "string" && R1.entrega.meta.entregaRef.startsWith("E:"), `entregaRef tiene la forma "E:<hex>"`, R1.entrega.meta.entregaRef);
  ok(R1.entrega.meta.entregaRef === R2.entrega.meta.entregaRef, "dos corridas del MISMO encargo (mismo tenant+escenario) dan el MISMO entregaRef — determinismo, sin cálculo nuevo");
  const resOtro = validarEncargo(d09.encargo, {});
  const R3 = componerEntrega(resOtro);
  ok(R3.entrega.meta.entregaRef !== R1.entrega.meta.entregaRef, "un encargo DISTINTO (D09 vs D11) da un entregaRef DISTINTO");
}

/* ═══ 6 · detalle.comoPedirlo — el encargo exacto para recuperar lo recortado ═══ */
H("6 · entrega.detalle.comoPedirlo — reconstruye EXACTAMENTE el resultado de pedir profundidad:\"completa\" directo");
{
  const cat = JSON.parse(fs.readFileSync("./fixtures/encargos-desarrollo.json", "utf8")).casos;
  const d27 = cat.find((c) => c.id === "D27");
  const resBreve = validarEncargo({ ...d27.encargo, profundidad: "breve" }, {});
  const Rb = componerEntrega(resBreve);
  ok(Rb.ok, "D27 compone ok en breve", Rb.motivo);
  if (Rb.ok) {
    const comoPedirlo = Rb.entrega.detalle.comoPedirlo;
    ok(!!comoPedirlo && comoPedirlo.profundidad === "completa", "comoPedirlo declara profundidad:\"completa\"");
    const resDesdeComoPedirlo = validarEncargo(comoPedirlo, {});
    const Rr = componerEntrega(resDesdeComoPedirlo);
    const resCompletaDirecto = validarEncargo({ ...d27.encargo, profundidad: "completa" }, {});
    const Rc = componerEntrega(resCompletaDirecto);
    ok(Rr.ok && Rc.ok && Rr.texto === Rc.texto, "componer con `comoPedirlo` da el MISMO texto que pedir \"completa\" directo — no una reconstrucción aproximada");
  }
}

/* ═══ 7 · lo recortado nunca desaparece — mismos ids en entrega.detalle ═══
 * D11, no D27: desde que la tabla de una simulación filtra la jerga interna (ronda final del corte), D27 quedó
 * con 7 filas limpias — ya cabe entera bajo el tope de 8 de "breve" y no necesita recortar ninguna. D11 (5 filas
 * en "completa", multidominio) SÍ sigue necesitando recorte real: sirve para probar la garantía con datos reales. */
H("7 · lo recortado en breve aparece en entrega.detalle, con el MISMO id — «lo recortado no desaparece»");
{
  const cat = JSON.parse(fs.readFileSync("./fixtures/encargos-desarrollo.json", "utf8")).casos;
  const d11 = cat.find((c) => c.id === "D11");
  const resBreve = validarEncargo({ ...d11.encargo, profundidad: "breve" }, {});
  const resCompleta = validarEncargo({ ...d11.encargo, profundidad: "completa" }, {});
  const Rb = componerEntrega(resBreve), Rc = componerEntrega(resCompleta);
  ok(Rb.ok && Rc.ok, "D11 compone ok en las dos profundidades");
  if (Rb.ok && Rc.ok) {
    ok(Array.isArray(Rb.entrega.detalle.filas) && Rb.entrega.detalle.filas.length > 0, `D11 en breve recorta filas a detalle (${Rb.entrega.detalle.filas.length})`, `servidas=${Rb.entrega.cifras.filas.length}`);
    // una fila no trae `.id` propio — su identidad es el HECHO que la respalda (`f.hechos[0]`, el mismo id "e*"
    // del libro); usar eso como clave evita el test vacuo de comparar `undefined` contra `undefined`.
    const _idDeFila = (f) => (f.hechos && f.hechos[0]) || null;
    const idsServidos = new Set(Rb.entrega.cifras.filas.map(_idDeFila).filter(Boolean));
    const idsDetalle = new Set(Rb.entrega.detalle.filas.map(_idDeFila).filter(Boolean));
    const idsCompleta = new Set(Rc.entrega.cifras.filas.map(_idDeFila).filter(Boolean));
    ok([...idsServidos].every((id) => idsCompleta.has(id)), "todo id servido en breve existe en completa");
    ok([...idsDetalle].every((id) => idsCompleta.has(id)), "todo id recortado a detalle también existe en completa (el MISMO id, no uno inventado)");
    const union = new Set([...idsServidos, ...idsDetalle]);
    ok([...idsCompleta].every((id) => union.has(id)), "servido ∪ detalle = completa — ningún id de completa se pierde sin rastro");
  }
}

/* ═══ 8 · CARNADA «prioridad explícita, no orden de aparición» ═══ */
H('8 · CARNADA · un multitema NO delegado — la conclusión integrada (prioridad 0, en la posición [2]) sobrevive en "breve", no la primera oración escrita');
{
  const encargo = { version: "encargo/v1", partes: [{ id: "p1", tema: "comercial", cierre: "lectura" }, { id: "p2", tema: "cobranza", cierre: "lectura" }] };
  const res = validarEncargo(encargo, {});
  const Rcompleta = componerEntrega(res);
  ok(Rcompleta.ok, "el multitema de 2 dominios (comercial+cobranza) compone ok — NO es ninguna de las 4 formas canónicas, así que corre el camino GENERAL", Rcompleta.motivo);
  if (Rcompleta.ok) {
    const idxConclusion = Rcompleta.entrega.respuesta.findIndex((r) => /^Quien m[aá]s pesa en el conjunto|^Prioridad del procedimiento/.test(r.texto));
    ok(idxConclusion > 0, `la conclusión integrada NO es la primera oración escrita (queda en la posición [${idxConclusion}])`, JSON.stringify(Rcompleta.entrega.respuesta.map((r) => r.texto.slice(0, 40))));
    ok(Rcompleta.entrega.respuesta[idxConclusion].prioridad === 0, "esa oración declara `.prioridad = 0` explícita (la ley: la conclusión es 0)");

    const resBreve = validarEncargo({ ...encargo, profundidad: "breve" }, {});
    const Rbreve = componerEntrega(resBreve);
    ok(Rbreve.ok, "el mismo multitema compone ok en \"breve\"", Rbreve.motivo);
    if (Rbreve.ok) {
      const textoConclusion = Rcompleta.entrega.respuesta[idxConclusion].texto;
      ok(Rbreve.entrega.respuesta.some((r) => r.texto === textoConclusion), 'CARNADA: la conclusión integrada SOBREVIVE en "breve"', JSON.stringify(Rbreve.entrega.respuesta.map((r) => r.texto.slice(0, 60))));
      /* §7.3·49: el Marco de una Entrega con cobranza ya no arrastra «foto de inventario» (la fila «Saldo vencido · total» se leía como de otro dominio): el presupuesto de «breve» alcanza para la primera oración. Lo que el candado protege es la LEY —se retira por prioridad explícita, nunca por posición—: si la primera sobrevive, ninguna oración retirada tiene mejor prioridad que ella. */
      { const primera = Rcompleta.entrega.respuesta[0]; const sobrevive = Rbreve.entrega.respuesta.some((r) => r.texto === primera.texto); const retiradas = Rcompleta.entrega.respuesta.filter((r) => !Rbreve.entrega.respuesta.some((x) => x.texto === r.texto));
        ok(!sobrevive || primera.texto === textoConclusion || (typeof primera.prioridad === "number" && retiradas.every((r) => (typeof r.prioridad === "number" ? r.prioridad : Rcompleta.entrega.respuesta.indexOf(r)) >= primera.prioridad)), 'la PRIMERA oración escrita («En comercial…») NO tiene por qué sobrevivir solo por ser la primera — si sobrevive, es porque su propia prioridad alcanzó (ninguna oración retirada tiene mejor prioridad que ella; sin prioridad explícita cuenta su lugar de aparición, como en `gobernarTamano`), no por su posición', JSON.stringify({ primera: primera.prioridad, retiradas: retiradas.map((r) => r.prioridad) })); }
    }
  }
}

/* ═══ 9 · CERO red ═══ */
H("9 · CERO red — clasificarFuente(este gate) === offline");
{
  const c = clasificarFuente(fs.readFileSync("./_tamano_gate.mjs", "utf8"));
  ok(c.tipo === "offline", "este gate se clasifica offline (no toca la red)", JSON.stringify(c));
}

/* ═══ 10 · CARNADA §7.3·33 — «el verificador no rechaza una Entrega cuyo exceso es SOLO contenido
 * obligatorio con excedeTope declarado; SÍ sigue rechazando un exceso de contenido recortable» ═══ */
H("10 · CARNADA §7.3·33 — verificarEntrega (regla 8, tope-de-tamano) lee `entrega.meta.excedeTope`, nunca a ciegas");
{
  // texto sintético, muy por sobre el tope de "breve" (350) — el MISMO exceso en los tres casos; lo único que
  // cambia es cómo lo declara `entrega.meta`.
  const textoLargo = Array.from({ length: 400 }, (_, i) => `palabra${i}`).join(" ");
  const _entregaMin = (meta) => ({ meta, cifras: { columnas: [], filas: [] }, universos: [], respuesta: [] });

  const conExcedeTope = verificarEntrega({ texto: textoLargo, entrega: _entregaMin({ excedeTope: true }), profundidad: "breve" });
  ok(!conExcedeTope.violaciones.some((v) => v.regla === "tope-de-tamano"), "CARNADA: `meta.excedeTope: true` — la regla 8 NO dispara (el exceso ya está declarado como contenido obligatorio)", JSON.stringify(conExcedeTope.violaciones));

  // control negativo 1 — sin `meta` (o sin `excedeTope`), el MISMO exceso de palabras sigue rechazado: la
  // exención nunca es el comportamiento por defecto (las 4 rutas fijas, que no pasan por `gobernarTamano`,
  // nunca declaran este campo y tienen que seguir auditadas como siempre).
  const sinMeta = verificarEntrega({ texto: textoLargo, entrega: _entregaMin(null), profundidad: "breve" });
  ok(sinMeta.violaciones.some((v) => v.regla === "tope-de-tamano"), "control negativo: SIN `entrega.meta` (camino viejo), el mismo exceso SIGUE rechazado", JSON.stringify(sinMeta.violaciones));

  // control negativo 2 — `excedeTope: false` explícito (contenido TODAVÍA recortable que nadie recortó): la
  // regla 8 se lee con `=== true`, nunca por la sola presencia del campo `meta`.
  const excedeTopeFalso = verificarEntrega({ texto: textoLargo, entrega: _entregaMin({ excedeTope: false }), profundidad: "breve" });
  ok(excedeTopeFalso.violaciones.some((v) => v.regla === "tope-de-tamano"), "control negativo: `meta.excedeTope: false` (contenido recortable, no recortado) SIGUE rechazado", JSON.stringify(excedeTopeFalso.violaciones));

  // bajo el tope, con o sin `excedeTope`, nunca dispara — la regla 8 sigue siendo primero «¿n > tope?».
  const textoCorto = "Una Entrega breve, bajo el tope, sin necesidad de ninguna exención.";
  const bajoTope = verificarEntrega({ texto: textoCorto, entrega: _entregaMin({ excedeTope: false }), profundidad: "breve" });
  ok(!bajoTope.violaciones.some((v) => v.regla === "tope-de-tamano"), "bajo el tope, la regla 8 no dispara de todos modos (con o sin `excedeTope`)", JSON.stringify(bajoTope.violaciones));
}

console.log(`\n── _tamano_gate: PASS ${pass} · FAIL ${fail} (de ${pass + fail}) ──`);
if (fail > 0) process.exit(1);
