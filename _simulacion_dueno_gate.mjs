/* === _simulacion_dueno_gate.mjs · DUEÑO DE LA SIMULACIÓN — CORTE 3d, garantía estructural (owner 2026-09-26,
 * offline) ══════════════════════════════════════════════════════════════════════════════════════════════════
 * Hallazgo de raíz (D27, ronda anterior): `oracle/specRetrieval.js:_scopeRows` exige `entityScope.entities`
 * (un array DENTRO de esa clave); `encargo/lecturasDe.js:_callDeSupuesto` pasaba `[nombre]` — un array A SECAS,
 * sin la clave — así que el filtro por entidad se saltaba en silencio y una simulación de UNA cuenta (Falabella)
 * corría sobre las 13 cuentas del tenant. Corregido en `lecturasDe.js` (una línea) + defensa en profundidad en
 * `entrega/componer.js:_planSimulacion` (filtra otra vez, por ENTIDAD RESUELTA, nunca por texto).
 *
 * LO QUE ESTE GATE EXIGE:
 * RENOMBRADO (owner 2026-09-26, `_colapso_eje_gate` C4 — «el CONCEPTO visible "escenario" murió»): la columna de
 * la tabla y todo texto emitido dicen «Simulación», nunca «Escenario» — el campo ESTRUCTURAL `escenarioId` no
 * cambia (nunca es texto emitido). Este gate usa el rótulo nuevo en todo lo que compara contra el texto/columnas
 * servidas; sigue diciendo «escenario» solo en prosa que describe el campo estructural interno.
 *
 * LO QUE ESTE GATE EXIGE:
 *   1 · BARRIDO GENERADO — (cada cliente del demo) × (cada tipo de supuesto con productor: growth · price ·
 *       margin · costo · carga) compone y verifica sin una sola fila huérfana (sin Entidad/Simulación/Supuesto) ni
 *       una sola fila fuera del universo pedido. El motor de hoy no corre más de una variante por tipo (no hay un
 *       segundo eje de "variantes del motor" que probar aparte de los tipos).
 *   2 · GARANTÍA §1/§2 (tabla) — toda fila de una tabla de simulación trae Entidad · Simulación · Supuesto, y
 *       ningún supuesto se imprime con su `tipo` interno («custom» es jerga del sistema, nunca prosa).
 *   3 · GARANTÍA §(ii)/(iii) (bloques) — la Respuesta se organiza en bloques con un encabezado que nombra
 *       entidad+simulación+supuesto UNA vez; el cuerpo del bloque no repite el cliente (libertad narrativa).
 *   4 · CARNADAS — fila sin Simulación → rojo · entidad fuera del universo pedido → rojo · delta entre entidades
 *       distintas → rojo · delta entre escenarios distintos → rojo · bloque sin encabezado → rojo · oración de
 *       simulación suelta (sin bloque ni `_mezcla`) → rojo · oración DENTRO de su bloque sin repetir el cliente →
 *       VERDE (control negativo: la libertad narrativa no es un defecto) · supuesto `custom` sin concepto
 *       nombrable (comercial · cliente) → `noResuelto` (`supuesto_mal_formado`, nunca compone con "custom") ·
 *       una fila cuyo rótulo NO está en el léxico de la casa (jerga interna del motor) → rojo.
 *   5 · LÉXICO DE LA CASA (ronda final, owner 2026-09-26) — la tabla de una simulación sirve SOLO filas con papel
 *       de negocio (referencia una vez, pares base↔resultado, impacto en $, delta); jerga interna («Lectura
 *       relativa descartada», «movimiento de carga» que duplica el Supuesto, un «total» agregado que duplica el
 *       impacto de la única entidad en alcance) se descarta y se cuenta en `meta.descartadasJergaInterna`.
 *   6 · COMPARABLES JUNTAS — el resultado de una simulación nombra su base en la MISMA cláusula («el margen
 *       pasaría de 22,0 % a 23,0 % (1 pp)»), nunca «margen supuesto» como sujeto suelto sin decir desde dónde.
 *
 * CERO llamadas a un LLM · CERO red. Solo por `npm run gates:offline` o
 * `node --import ./scripts/offline-guard.mjs _simulacion_dueno_gate.mjs`. */
import fs from "node:fs";
import { initTenant } from "./src/data/tenantStore.js";
import { TENANT_DEMO } from "./src/data/tenants/demo.js";
import { validarEncargo } from "./src/adi/encargo/validar.js";
import { componerEntrega } from "./src/adi/entrega/componer.js";
import { verificarEntrega } from "./src/adi/entrega/verificar.js";
import { crearEntrega } from "./src/adi/entrega/esquema.js";
import { axisEntityNames } from "./src/adi/oracle/entityIndex.js";
import { clasificarFuente } from "./scripts/clasificarGates.mjs";

let pass = 0, fail = 0;
const ok = (c, m, extra = "") => { if (c) { pass++; console.log("  ✓ " + m); } else { fail++; console.log("  ✗ " + m + (extra ? "\n      " + extra : "")); } };
const H = (t) => console.log(`\n${t}`);

initTenant(TENANT_DEMO);

/* ═══ 1 · BARRIDO GENERADO — cada entidad × cada tipo de supuesto con productor (comercial · cliente) ═══ */
H("1 · barrido generado — (cada cliente del demo) × (cada tipo de supuesto con productor)");
const ENTIDADES = axisEntityNames("cliente");
const TIPOS = [
  { tipo: "growth", valor: 10, unidad: "pct" },
  { tipo: "price", valor: 5, unidad: "pct" },
  { tipo: "margin", valor: 3, unidad: "pct" },
  { tipo: "costo", valor: -5, unidad: "pct" },
  { tipo: "carga", valor: -1, unidad: "pp" },
];
ok(ENTIDADES.length >= 10, `${ENTIDADES.length} clientes en el demo (universo del barrido)`, ENTIDADES.join(", "));
const _JERGA_INTERNA_SIM = /^(lectura relativa descartada|movimiento de carga|total)$/i;
{
  let compuestas = 0, verificadas = 0, huerfanas = 0, foraDeUniverso = 0, sinConceptoNombrable = 0, jergaInterna = 0, sinComparablesJuntas = 0;
  const fallas = [];
  for (const entidad of ENTIDADES) {
    for (const t of TIPOS) {
      const encargo = { version: "encargo/v1", partes: [{ id: "p1", tema: "comercial", cierre: "simulacion", entidades: [{ nombre: entidad }], supuestos: ["s1"] }], supuestos: [{ id: "s1", tipo: t.tipo, valor: t.valor, unidad: t.unidad, alcance: { eje: "cliente", nombre: entidad }, origen: "supuesto" }] };
      const res = validarEncargo(encargo, {});
      if (!res.ok) { fallas.push(`${entidad}/${t.tipo}: validar no-ok — ${JSON.stringify(res.noResuelto)}`); continue; }
      const R = componerEntrega(res);
      if (!R.ok) { fallas.push(`${entidad}/${t.tipo}: componer no-ok — ${R.motivo}`); continue; }
      compuestas++;
      const v = verificarEntrega({ texto: R.texto, entrega: R.entrega });
      if (!v.ok) { fallas.push(`${entidad}/${t.tipo}: verificar no-ok — ${JSON.stringify(v.violaciones)}`); continue; }
      verificadas++;
      for (const f of R.entrega.cifras.filas) {
        if (!f.valores.Entidad || !f.valores.Simulación || !f.valores.Supuesto) huerfanas++;
        if (f.valores.Entidad !== "Negocio" && f.valores.Entidad !== entidad) foraDeUniverso++;
        if (/\bcustom\b/i.test(f.valores.Supuesto || "")) sinConceptoNombrable++;
        if (_JERGA_INTERNA_SIM.test(String(f.valores.Métrica || "").trim())) jergaInterna++;
      }
      // COMPARABLES JUNTAS — todo tipo con productor de simulateGeneral/simulateCosto/simulateCarga trae un
      // par base↔resultado (growth/price/margin/costo mueven venta o margen sobre un valor real existente; solo
      // simulateCapital, sin base que contrastar, cae legítimamente a "concepto pasaría a valor" sin "de…a…").
      // AGREGADO (supervisor, revisión de cierre del 3d, corte 3e, 2026-09-26) — un par base↔resultado IDÉNTICO
      // (el supuesto no mueve la cifra para esa entidad/tipo) ya NO dice «pasaría de X a X» (afirmaría un cambio
      // que no ocurrió): dice «se mantiene en X» — misma disciplina de comparables-juntas, base y resultado
      // siguen en la MISMA cláusula, solo cambia el verbo cuando no hay cambio. Medido: 2/65 del barrido caen acá.
      if (!/pasar[ií]a de .+ a /.test(R.texto) && !/se mantiene en /.test(R.texto)) sinComparablesJuntas++;
    }
  }
  const total = ENTIDADES.length * TIPOS.length;
  ok(compuestas === total, `${compuestas}/${total} combinaciones componen ok`, fallas.join(" · "));
  ok(verificadas === total, `${verificadas}/${total} combinaciones verifican ok (verificarEntrega)`, fallas.join(" · "));
  ok(huerfanas === 0, `0 filas huérfanas (sin Entidad/Simulación/Supuesto) en las ${total} combinaciones`, String(huerfanas));
  ok(foraDeUniverso === 0, `0 filas fuera del universo pedido en las ${total} combinaciones`, String(foraDeUniverso));
  ok(sinConceptoNombrable === 0, `0 filas con "custom" impreso en la columna Supuesto (jerga del sistema)`, String(sinConceptoNombrable));
  ok(jergaInterna === 0, `0 filas con rótulo de jerga interna del motor (lectura relativa descartada · movimiento de carga · total) en las ${total} combinaciones`, String(jergaInterna));
  ok(sinComparablesJuntas === 0, `0/${total} combinaciones SIN "comparables juntas" (todas con productor base↔resultado dicen "de X a Y")`, String(sinComparablesJuntas));
  console.log(`    (barrido: ${total} combinaciones · ${ENTIDADES.length} entidades × ${TIPOS.length} tipos)`);
}

/* ═══ 2 · D27/D28 reales — la garantía sobre el catálogo (regresión del hallazgo original) ═══ */
H("2 · D27/D28 (catálogo real) — sin filas huérfanas, sin fuera de universo, bloques con encabezado");
{
  const cat = JSON.parse(fs.readFileSync("./fixtures/encargos-desarrollo.json", "utf8")).casos;
  for (const id of ["D27", "D28"]) {
    const caso = cat.find((c) => c.id === id);
    ok(!!caso, `${id} existe en el catálogo`);
    if (!caso) continue;
    const res = validarEncargo(caso.encargo, {});
    const R = componerEntrega(res);
    ok(R.ok, `${id} compone ok`, R.motivo);
    if (!R.ok) continue;
    const v = verificarEntrega({ texto: R.texto, entrega: R.entrega });
    ok(v.ok, `${id} verifica ok`, JSON.stringify(v.violaciones));
    ok(!/\bcustom\b/i.test(R.texto), `${id} · «custom» no aparece en el texto servido`);
    const encabezados = R.entrega.respuesta.filter((r) => r._bloqueEncabezado);
    ok(encabezados.length >= 1, `${id} · al menos un bloque con encabezado`, JSON.stringify(encabezados.map((e) => e.texto)));
    ok(encabezados.every((e) => e._bloqueMeta && e._bloqueMeta.entidad && e._bloqueMeta.escenarioId && e._bloqueMeta.supuestoId), `${id} · cada encabezado declara entidad/escenario/supuesto completos`);
  }
}

/* ═══ 3 · CARNADA · supuesto "custom" sin concepto nombrable (comercial·cliente) → noResuelto, nunca compone ═══ */
H('3 · CARNADA · supuesto "custom" en comercial/cliente → noResuelto (supuesto_mal_formado), nunca simulateCarga');
{
  const encargo = { version: "encargo/v1", partes: [{ id: "p1", tema: "comercial", cierre: "simulacion", entidades: [{ nombre: "Falabella" }], supuestos: ["s1"] }], supuestos: [{ id: "s1", tipo: "custom", valor: -1, unidad: "pct", alcance: { eje: "cliente", nombre: "Falabella" }, origen: "supuesto" }] };
  const res = validarEncargo(encargo, {});
  const malFormado = (res.noResuelto || []).find((n) => n.campo === "supuesto" && n.motivo === "supuesto_mal_formado");
  ok(!!malFormado, 'CARNADA: "custom" sobre comercial/cliente cae en noResuelto con motivo "supuesto_mal_formado"', JSON.stringify(res.noResuelto));
  ok(!!malFormado && Array.isArray(malFormado.alternativas) && malFormado.alternativas.some((a) => a.concepto === "carga"), "las alternativas ofrecen el concepto \"carga\" (§7.1)", JSON.stringify(malFormado && malFormado.alternativas));
  // control negativo: el MISMO supuesto con tipo:"carga" (el concepto nombrado) SÍ resuelve
  const encargoOk = { ...encargo, supuestos: [{ ...encargo.supuestos[0], tipo: "carga", unidad: "pp" }] };
  const resOk = validarEncargo(encargoOk, {});
  ok(resOk.ok && (resOk.partes || []).every((p) => p.estado === "resuelta"), 'control negativo: el MISMO supuesto con tipo:"carga" SÍ resuelve');
}

/* ═══ 4 · CARNADAS estructurales sobre verificarEntrega (regla 14) — Entregas sintéticas ═══ */
H("4 · CARNADAS de verificarEntrega (regla 14) — fila sin escenario, fuera de universo, delta mezclado, bloque sin encabezado, oración suelta");
// regla 3 (doble colocación) lee `h.roles.sujetos` de TODO hecho `ref`/`derivada` citado en Respuesta, sin
// chequeo defensivo (asume que `libroDeHechos` siempre lo declara) — un hecho sintético de prueba necesita el
// mismo mínimo, o el propio archivo bajo prueba revienta antes de llegar a la regla 14 que este gate ejercita.
const _libroFake = (extra) => ({ hechos: [], porId: new Map(Object.entries(extra).map(([id, h]) => [id, { id, ok: true, roles: { sujetos: [] }, entidades: new Set(), ...h }])) });
const _cifrasSim = (filas) => ({ columnas: ["Entidad", "Simulación", "Supuesto", "Métrica", "Valor", "Tipo"], filas });
{
  // (a) fila sin Simulación → rojo
  const entrega = { ...crearEntrega(), respuesta: [{ texto: "Falabella — simulación: la carga comercial baja 1 punto (1 pp).", hechos: ["e0"], _bloqueId: "b1", _bloqueEncabezado: true, _bloqueMeta: { entidad: "Falabella", escenarioId: "s1", supuestoId: "s1" } }], cifras: _cifrasSim([{ valores: { Entidad: "Falabella", Simulación: "", Supuesto: "La carga comercial baja 1 punto", Métrica: "Margen supuesto", Valor: "23.0%", Tipo: "derivado" }, hechos: ["e0"], entidad: "Falabella", escenarioId: "s1", supuestoId: "s1" }]), procedencia: { libro: _libroFake({ e0: { id: "e0", tipo: "ref", ok: true, roles: { sujetos: ["Falabella"] } } }) } };
  const v = verificarEntrega({ texto: "x 23.0%", entrega });
  ok(!v.ok && v.violaciones.some((x) => x.regla === "fila-simulacion-sin-dueno"), 'CARNADA: fila sin "Simulación" → ROJO (fila-simulacion-sin-dueno)', JSON.stringify(v.violaciones));
}
{
  // (b) entidad fuera del universo pedido (`entrega._simulacionUniverso`, la unión de `parte.entidades` que
  // `componer.js:_planSimulacion` declara — NUNCA el `partes` de la regla 11, ver el comentario de verificar.js) → rojo
  const filaFalabella = { valores: { Entidad: "Falabella", Simulación: "E", Supuesto: "S", Métrica: "Margen supuesto", Valor: "23.0%", Tipo: "derivado" }, hechos: ["e0"], entidad: "Falabella", escenarioId: "s1", supuestoId: "s1" };
  const filaLider = { valores: { Entidad: "Lider", Simulación: "E", Supuesto: "S", Métrica: "Margen supuesto", Valor: "20.0%", Tipo: "derivado" }, hechos: ["e1"], entidad: "Lider", escenarioId: "s1", supuestoId: "s1" };
  const entrega = { ...crearEntrega(), cifras: _cifrasSim([filaFalabella, filaLider]), procedencia: { libro: _libroFake({ e0: { tipo: "ref" }, e1: { tipo: "ref" } }) }, _simulacionUniverso: ["Falabella"] };
  const v = verificarEntrega({ texto: "x 23.0% x 20.0%", entrega });
  ok(!v.ok && v.violaciones.some((x) => x.regla === "fila-fuera-de-universo"), "CARNADA: una fila de \"Lider\" cuando solo se pidió \"Falabella\" → ROJO (fila-fuera-de-universo)", JSON.stringify(v.violaciones));
  // control negativo: SIN `_simulacionUniverso` declarado, esta regla no se paga (es opcional)
  const entregaSinUniverso = { ...entrega, _simulacionUniverso: undefined };
  const v2 = verificarEntrega({ texto: "x 23.0% x 20.0%", entrega: entregaSinUniverso });
  ok(!v2.violaciones.some((x) => x.regla === "fila-fuera-de-universo"), "control: sin `_simulacionUniverso` declarado, la regla de universo no corre (opcional)");
}
{
  // (c) delta entre ENTIDADES distintas → rojo (h.entidades con más de una entidad)
  const fila = { valores: { Entidad: "Falabella", Simulación: "E", Supuesto: "S", Métrica: "Delta · Margen", Valor: "1 pp", Tipo: "derivado" }, hechos: ["eDelta"], entidad: "Falabella", escenarioId: "s1", supuestoId: "s1" };
  const entrega = { ...crearEntrega(), cifras: _cifrasSim([fila]), procedencia: { libro: _libroFake({ eDelta: { tipo: "derivada", ok: true, entidades: new Set(["falabella", "lider"]) } }) } };
  const v = verificarEntrega({ texto: "x 1 pp", entrega });
  ok(!v.ok && v.violaciones.some((x) => x.regla === "delta-entre-entidades-distintas"), "CARNADA: un delta cuyo hecho involucra DOS entidades → ROJO (delta-entre-entidades-distintas)", JSON.stringify(v.violaciones));
  // control negativo: UNA sola entidad en el hecho → verde por esta regla
  const entregaOk = { ...entrega, procedencia: { libro: _libroFake({ eDelta: { tipo: "derivada", ok: true, entidades: new Set(["falabella"]) } }) } };
  const v2 = verificarEntrega({ texto: "x 1 pp", entrega: entregaOk });
  ok(!v2.violaciones.some((x) => x.regla === "delta-entre-entidades-distintas"), "control negativo: un delta de UNA sola entidad no dispara esta regla");
}
{
  // (d) delta entre ESCENARIOS distintos → rojo (el MISMO id de hecho en filas de escenarioId distinto)
  const filaA = { valores: { Entidad: "Falabella", Simulación: "Simulación A", Supuesto: "S", Métrica: "Margen supuesto", Valor: "23.0%", Tipo: "derivado" }, hechos: ["eX"], entidad: "Falabella", escenarioId: "s1", supuestoId: "s1" };
  const filaB = { valores: { Entidad: "Falabella", Simulación: "Simulación B", Supuesto: "S2", Métrica: "Margen supuesto", Valor: "23.0%", Tipo: "derivado" }, hechos: ["eX"], entidad: "Falabella", escenarioId: "s2", supuestoId: "s2" };
  const entrega = { ...crearEntrega(), cifras: _cifrasSim([filaA, filaB]), procedencia: { libro: _libroFake({ eX: { tipo: "ref", ok: true } }) } };
  const v = verificarEntrega({ texto: "x 23.0%", entrega });
  ok(!v.ok && v.violaciones.some((x) => x.regla === "delta-entre-escenarios-distintos"), 'CARNADA: el MISMO hecho citado en filas de dos escenarios ("s1" y "s2") → ROJO (delta-entre-escenarios-distintos)', JSON.stringify(v.violaciones));
}
{
  // (e) bloque sin encabezado → rojo
  const entrega = { ...crearEntrega(), respuesta: [{ texto: "Bajo este supuesto, el margen pasaría a 23.0%.", hechos: ["e0"], _bloqueId: "b1", _simulacion: true }], procedencia: { libro: _libroFake({ e0: { tipo: "ref", ok: true } }) } };
  const v = verificarEntrega({ texto: "x 23.0%", entrega });
  ok(!v.ok && v.violaciones.some((x) => x.regla === "bloque-sin-encabezado"), 'CARNADA: un bloque sin oración `_bloqueEncabezado` → ROJO (bloque-sin-encabezado)', JSON.stringify(v.violaciones));
}
{
  // (f) oración de simulación SUELTA (sin bloque, sin `_mezcla`) → rojo
  const entrega = { ...crearEntrega(), respuesta: [{ texto: "Comparando los dos escenarios, el margen difiere 0.5 pp.", hechos: ["e0"], _simulacion: true }], procedencia: { libro: _libroFake({ e0: { tipo: "derivada", ok: true, entidades: new Set(["falabella"]) } }) } };
  const v = verificarEntrega({ texto: "x 0.5 pp", entrega });
  ok(!v.ok && v.violaciones.some((x) => x.regla === "oracion-simulacion-sin-alcance"), "CARNADA: una oración de simulación que mezcla escenarios SIN nombrarlos (`_mezcla`) → ROJO (oracion-simulacion-sin-alcance)", JSON.stringify(v.violaciones));
  // control negativo: la MISMA oración, declarando `_mezcla`, no dispara la regla
  const entregaOk = { ...entrega, respuesta: [{ ...entrega.respuesta[0], _mezcla: { escenarios: ["s1", "s2"] } }] };
  const v2 = verificarEntrega({ texto: "x 0.5 pp", entrega: entregaOk });
  ok(!v2.violaciones.some((x) => x.regla === "oracion-simulacion-sin-alcance"), "control negativo: declarando `_mezcla` (los escenarios que compara), la MISMA oración no arde");
}
{
  // (g) CARNADA · léxico de la casa — una fila cuyo rótulo (Métrica) ES jerga interna del motor → rojo
  const filaJerga = { valores: { Entidad: "Falabella", Simulación: "E", Supuesto: "S", Métrica: "Lectura relativa descartada", Valor: "4.46%", Tipo: "derivado" }, hechos: ["e0"], entidad: "Falabella", escenarioId: "s1", supuestoId: "s1" };
  const entrega = { ...crearEntrega(), cifras: _cifrasSim([filaJerga]), procedencia: { libro: _libroFake({ e0: { tipo: "ref", ok: true } }) } };
  const v = verificarEntrega({ texto: "x 4.46%", entrega });
  ok(!v.ok && v.violaciones.some((x) => x.regla === "fila-jerga-interna"), 'CARNADA: una fila con rótulo "Lectura relativa descartada" (jerga interna, no está en el léxico de la casa) → ROJO (fila-jerga-interna)', JSON.stringify(v.violaciones));
  // control negativo: un rótulo de papel de negocio (par base↔resultado) no dispara esta regla
  const filaOk = { ...filaJerga, valores: { ...filaJerga.valores, Métrica: "Margen supuesto" } };
  const entregaOk = { ...crearEntrega(), cifras: _cifrasSim([filaOk]), procedencia: entrega.procedencia };
  const v2 = verificarEntrega({ texto: "x 4.46%", entrega: entregaOk });
  ok(!v2.violaciones.some((x) => x.regla === "fila-jerga-interna"), 'control negativo: "Margen supuesto" (papel de negocio: resultado) no arde');
}
{
  // (h) CONTROL NEGATIVO — una oración DENTRO de su bloque que NO repite el cliente → VERDE (libertad narrativa)
  const entrega = {
    ...crearEntrega(),
    respuesta: [
      { texto: "Falabella — simulación: la carga comercial baja 1 punto (1 pp).", hechos: ["e0"], _bloqueId: "b1", _bloqueEncabezado: true, _simulacion: true, _bloqueMeta: { entidad: "Falabella", escenarioId: "s1", supuestoId: "s1" } },
      { texto: "Bajo este supuesto, el margen pasaría a 23.0%.", hechos: ["e1"], _bloqueId: "b1", _simulacion: true },
    ],
    cifras: _cifrasSim([{ valores: { Entidad: "Falabella", Simulación: "E", Supuesto: "S", Métrica: "Margen supuesto", Valor: "23.0%", Tipo: "derivado" }, hechos: ["e1"], entidad: "Falabella", escenarioId: "s1", supuestoId: "s1" }]),
    procedencia: { libro: _libroFake({ e0: { tipo: "ref", ok: true }, e1: { tipo: "ref", ok: true } }) },
  };
  const v = verificarEntrega({ texto: "x 1 pp x 23.0%", entrega });
  ok(!v.violaciones.some((x) => ["bloque-sin-encabezado", "bloque-sin-dueno", "oracion-simulacion-sin-alcance"].includes(x.regla)), 'CONTROL NEGATIVO: una oración dentro de su bloque, sin repetir "Falabella", no arde ninguna regla de dueño de la simulación', JSON.stringify(v.violaciones));
}

/* ═══ 5 · CERO red ═══ */
H("5 · CERO red — clasificarFuente(este gate) === offline");
{
  const c = clasificarFuente(fs.readFileSync("./_simulacion_dueno_gate.mjs", "utf8"));
  ok(c.tipo === "offline", "este gate se clasifica offline (no toca la red)", JSON.stringify(c));
}

console.log(`\n── _simulacion_dueno_gate: PASS ${pass} · FAIL ${fail} (de ${pass + fail}) ──`);
if (fail > 0) process.exit(1);
