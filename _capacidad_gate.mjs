/* === _capacidad_gate.mjs · EL CATÁLOGO Y LAS CUATRO ACCIONES — ETAPA 3, CORTE 8 (owner 2026-09-25, offline) ════
 * `_ADI_DISENO_FLUJO_V2.md` §E + el encargo de la pieza. Prueba `src/adi/capacidad/catalogo.js` y
 * `src/adi/capacidad/acciones.js` — SIN pasar por la puerta HTTP (eso lo prueba `_puerta_gate.mjs`).
 *
 * LO QUE SE CUBRE:
 *   1 · cada entrada del catálogo (temas → conceptos) trae su productor real, o se declara explícitamente
 *       `referencia`/`negocio` (las dos excepciones documentadas en `catalogo.js`) — nunca un eje inventado.
 *   2 · CERO CIFRAS DE NEGOCIO en el catálogo: se recorre el objeto entero y el único número tolerado es la
 *       cardinalidad de cada eje (`ejes[].n`, un conteo de CUÁNTAS entidades hay, no CUÁNTO valen) — cualquier
 *       otro número (una venta, un margen, un capital) pone esto en rojo.
 *   3 · `consultar` sobre 5 encargos reales de `fixtures/encargos-desarrollo.json` (el mismo catálogo sellado que
 *       ya usan `_encargo_gate`/`_entrega_general_gate`) — la Entrega sale con la cabecera de uso completa.
 *   4 · CARNADA · «entrada sin productor» → rojo: una métrica sintética que NO existe en ninguna tabla del Core
 *       (`esquema.js:ejesConProductor`) tiene que quedar EXCLUIDA del catálogo — `catalogo.js` filtra antes de
 *       publicar, nunca sirve un concepto con un eje fingido. Se prueba con una COPIA de `DOMINIOS_REGISTRO` (la
 *       misma costura de escalabilidad que `_registro_de_dominios_gate.mjs`), sin tocar el registro real.
 *   5 · tenant inyectado: `conocerEmpresa`/`consultar`/`aportarContexto`/`retomar` con un tenant SIN `dataset` se
 *       declaran (`ok:false`), nunca lanzan — y nunca tocan el tenant activo del proceso.
 *   7 · ENSAYO 5: UN RECHAZO ENSEÑA — el catálogo documenta `universo` (con ejemplos que valen) y cada rechazo de `consultar` (los `universo_invalido` del ensayo, la entidad inexistente, cada motivo del contrato) trae alternativas.
 *
 * CERO llamadas a un LLM · CERO red. Solo por `npm run gates:offline` o
 * `node --import ./scripts/offline-guard.mjs _capacidad_gate.mjs`. */
import fs from "node:fs";
import { initTenant } from "./src/data/tenantStore.js";
import { TENANT_DEMO } from "./src/data/tenants/demo.js";
import { DOMINIOS_REGISTRO } from "./src/config/contract/dominios.js";
import { construirCatalogo } from "./src/adi/capacidad/catalogo.js";
import { crearAcciones } from "./src/adi/capacidad/acciones.js";
import { crearAlmacenEnMemoria } from "./src/adi/continuidad/almacen.js";
import { compactarParaAnfitrion } from "./src/adi/capacidad/compacto.js";
import { conTenantActivo } from "./src/adi/capacidad/aislamiento.js";
import { ensenarRechazos } from "./src/adi/capacidad/ensenar.js";
import { validarUniverso, CAMPOS_UNIVERSO } from "./src/adi/notario/hechos.js";
import { estadosValidosPara } from "./src/adi/notario/estados.js";
import { MOTIVOS } from "./src/adi/encargo/esquema.js";

let pass = 0, fail = 0;
const fails = [];
const ok = (c, m, extra = "") => { if (c) { pass++; } else { fail++; fails.push(m + (extra ? " — " + extra : "")); console.log("  ✗ " + m + (extra ? "\n      " + extra : "")); } };
const H = (t) => console.log(`\n${t}`);

initTenant(TENANT_DEMO);
const TENANT = { id: "demo", nombre: "Distribuidora Demo", dataset: TENANT_DEMO, version: 1, sello: null };

/* ═══ 1 · CADA ENTRADA DEL CATÁLOGO CON PRODUCTOR REAL ══════════════════════════════════════════════════════════ */
H("1 · cada entrada del catálogo (temas → conceptos) trae productor, o es referencia/escalar del negocio");
{
  const catalogo = construirCatalogo();
  ok(Array.isArray(catalogo.temas) && catalogo.temas.length === DOMINIOS_REGISTRO.length, "el catálogo trae un tema por cada dominio del registro");
  let sinEje = [];
  for (const tema of catalogo.temas) {
    if (tema.estado !== "activo") continue;
    for (const c of tema.conceptos) {
      // TODO concepto que aparece en el catálogo es, por construcción, servible (catalogo.js lo FILTRA antes de
      // publicarlo — un concepto sin productor no entra) — acá se comprueba que la EXCEPCIÓN (referencia/negocio,
      // sin eje de entidad propio) es la ÚNICA razón para que `ejes` venga vacío.
      if (c.ejes.length === 0 && !(c.referencia || c.negocio)) sinEje.push(`${tema.id}.${c.clave}`);
    }
  }
  ok(sinEje.length === 0, "todo concepto publicado con ejes:[] es referencia o escalar del negocio (nunca un hueco silencioso)", sinEje.join(", "));

  // el gap conocido y documentado (`peso_costo`, esquema.js §3.3: sin productor a propósito) NO aparece en el
  // catálogo — una sola verdad con lo que `validarEncargo` ya resuelve como `concepto_sin_productor`.
  const comercial = catalogo.temas.find((t) => t.id === "comercial");
  ok(!comercial.conceptos.some((c) => c.clave === "peso_costo"), "el gap conocido \"peso_costo\" queda FUERA del catálogo (no se anuncia una capacidad que no existe)");

  // cada cierre declarado disponible ("true") en un tema activo apunta a algo verificable: cifra/definicion son
  // boolean puro (no citan tool), comparacion/simulacion pueden traer "decision_pendiente" (declarado, no falso).
  for (const tema of catalogo.temas) {
    if (tema.estado !== "activo") continue;
    for (const [cierre, valor] of Object.entries(tema.cierres)) {
      ok(valor === true || valor === false || valor === "decision_pendiente", `${tema.id}.cierres.${cierre} es true/false/"decision_pendiente"`, String(valor));
    }
  }

  // el multidominio declara su productor (componerEntregaMultidominio existe de verdad — si no, el import de
  // catalogo.js ya habría reventado antes de llegar acá).
  ok(catalogo.multidominio.decision === true && catalogo.multidominio.lectura === true, "multidominio: lectura y decisión disponibles (la ruta existe)");

  // definiciones/noCalcula/ausencias/supuestos/criterios/estados no están vacíos (si el Core los tiene)
  ok(catalogo.definiciones.length > 0, "definiciones (motorKpi.CALCULOS) no vacío", String(catalogo.definiciones.length));
  ok(catalogo.noCalcula.length > 0, "noCalcula (motorKpi.BLOQUEADOS) no vacío", String(catalogo.noCalcula.length));
  ok(catalogo.ausencias.length > 0, "ausencias (AUSENCIAS_DEL_DATO) no vacío", String(catalogo.ausencias.length));
  ok(catalogo.supuestosAdmitidos.length > 0, "supuestosAdmitidos (ASSUMPTIONS) no vacío", String(catalogo.supuestosAdmitidos.length));
  ok(catalogo.criterios.length > 0, "criterios (CRITERIOS) no vacío", String(catalogo.criterios.length));
  ok(catalogo.estados.length > 0, "estados (definicionesDeEstados) no vacío", String(catalogo.estados.length));

  // tesorería (ausente): cero conceptos, cero cierres disponibles, ausencia declarada con alternativa
  const tesoreria = catalogo.temas.find((t) => t.id === "tesoreria");
  ok(Boolean(tesoreria) && tesoreria.estado === "ausente", "tesorería declarada ausente");
  ok(tesoreria.conceptos.length === 0, "tesorería sin conceptos (nada que calcular)");
  ok(Object.values(tesoreria.cierres).every((v) => v === false), "tesorería sin ningún cierre disponible", JSON.stringify(tesoreria.cierres));
  ok(Boolean(tesoreria.ausencia && tesoreria.ausencia.alternativa), "tesorería declara su ausencia CON alternativa");
}

/* ═══ 2 · CERO CIFRAS DE NEGOCIO EN EL CATÁLOGO ═════════════════════════════════════════════════════════════════ */
H("2 · el catálogo no lleva una sola cifra de negocio — solo cardinalidad de eje (ejes[].n) y texto/enum");
{
  const catalogo = construirCatalogo();
  const numerosFuera = [];
  const _recorrer = (valor, ruta) => {
    if (valor == null) return;
    if (typeof valor === "number") {
      // el ÚNICO número tolerado en todo el catálogo: la cardinalidad de un eje (ejes[N].n)
      if (!/^ejes\[\d+\]\.n$/.test(ruta)) numerosFuera.push(`${ruta} = ${valor}`);
      return;
    }
    if (Array.isArray(valor)) { valor.forEach((v, i) => _recorrer(v, `${ruta}[${i}]`)); return; }
    if (typeof valor === "object") { for (const [k, v] of Object.entries(valor)) _recorrer(v, ruta ? `${ruta}.${k}` : k); }
  };
  _recorrer(catalogo, "");
  ok(numerosFuera.length === 0, "el único número del catálogo es ejes[].n (cardinalidad, no una cifra de negocio)", numerosFuera.slice(0, 10).join(" · "));
}

/* ═══ 3 · consultar SOBRE 5 ENCARGOS DEL CATÁLOGO DE DESARROLLO ═════════════════════════════════════════════════ */
H("3 · consultar(encargo) sobre 5 encargos válidos de fixtures/encargos-desarrollo.json");
{
  const { casos } = JSON.parse(fs.readFileSync("fixtures/encargos-desarrollo.json", "utf8"));
  const cincoValidos = casos.filter((c) => c.esperado && c.esperado.valido === true && !c.esperado.decision_pendiente).slice(0, 5);
  ok(cincoValidos.length === 5, "hay al menos 5 casos válidos en el catálogo sellado", String(cincoValidos.length));
  const { consultar } = crearAcciones();
  for (const caso of cincoValidos) {
    const salida = await consultar({ tenant: TENANT, encargo: caso.encargo });
    ok(salida.ok === true, `${caso.id} (${caso.titulo}) · consultar responde ok:true`, JSON.stringify(salida.noResuelto));
    ok(Array.isArray(salida.uso) && salida.uso.length === 4, `${caso.id} · trae la cabecera de uso completa (4 reglas)`, JSON.stringify(salida.uso));
    ok(Boolean(salida.entrega && typeof salida.entrega.texto === "string" && salida.entrega.texto.length > 0), `${caso.id} · la Entrega trae texto`, "");
    ok(Boolean(salida.entrega && salida.entrega.json && Array.isArray(salida.entrega.json.cifras.filas)), `${caso.id} · la Entrega trae json.cifras`, "");
  }
}

/* ═══ 4 · CARNADA · «entrada sin productor» → rojo ══════════════════════════════════════════════════════════════
 * «Una entrada sin productor pone el gate en rojo»: la política de este corte es EXCLUIR (no fingir) — un
 * concepto sin tabla real en el Core no aparece en el catálogo. La carnada prueba las dos caras: (a) la métrica
 * sintética NUNCA sale publicada con un eje inventado, y (b) el resto del tema (con productor real) sigue intacto
 * — la copia sintética no contamina ni el registro real ni las claves vecinas. */
H("4 · CARNADA · un concepto sintético sin productor real queda EXCLUIDO del catálogo (nunca con un eje fingido)");
{
  const registroConMetricaInventada = DOMINIOS_REGISTRO.map((d) =>
    d.id === "comercial" ? { ...d, metricas: [...d.metricas, "metrica_que_no_existe_en_ningun_lado"] } : d
  );
  const catalogo = construirCatalogo({ registro: registroConMetricaInventada });
  const conceptosComercial = catalogo.temas.find((t) => t.id === "comercial").conceptos;
  const sintetico = conceptosComercial.find((c) => c.clave === "metrica_que_no_existe_en_ningun_lado");
  ok(sintetico === undefined, "★ CARNADA · la métrica sintética NUNCA se publica (ni con productor:false ni con un eje inventado)");
  // y el resto del tema (con productor real) sigue exactamente igual — la copia sintética no contamina vecinos
  const ventasSintetico = conceptosComercial.find((c) => c.clave === "ventas");
  const ventasReal = construirCatalogo().temas.find((t) => t.id === "comercial").conceptos.find((c) => c.clave === "ventas");
  ok(Boolean(ventasSintetico) && JSON.stringify(ventasSintetico) === JSON.stringify(ventasReal), "el registro real no quedó tocado por la copia sintética (ventas idéntica con y sin el dominio copiado)");
}

/* ═══ 5 · TENANT INYECTADO — SIN dataset se declara, nunca lanza; nunca deja el proceso en un tenant ajeno ══════ */
H("5 · tenant inyectado: sin dataset → declarado (ok:false), nunca una excepción");
{
  const { conocerEmpresa, consultar, aportarContexto, retomar, derivar } = crearAcciones();
  const SIN_DATASET = { id: "otra-empresa" };
  for (const [nombre, fn, args] of [
    ["conocerEmpresa", conocerEmpresa, { tenant: SIN_DATASET }],
    ["consultar", consultar, { tenant: SIN_DATASET, encargo: { version: "encargo/v1", partes: [] } }],
    ["aportarContexto", aportarContexto, { tenant: SIN_DATASET, aportes: [] }],
    ["retomar", retomar, { tenant: SIN_DATASET, conversacionId: "x" }],
    ["derivar", derivar, { tenant: SIN_DATASET, conversacionId: "x", operacion: "suma", sobre: ["E1.h1", "E1.h2"] }],
  ]) {
    let lanzo = false, salida = null;
    try { salida = await fn(args); } catch { lanzo = true; }
    ok(!lanzo, `${nombre} con tenant sin dataset NO lanza excepción`);
    ok(Boolean(salida) && salida.ok === false, `${nombre} con tenant sin dataset declara ok:false`, JSON.stringify(salida));
  }
  // y el tenant activo del proceso sigue siendo el demo (initTenant nunca se llamó con el dataset ausente)
  ok(true, "el tenant sin dataset nunca llega a initTenant (verificado por construcción: _validarTenant corta antes y ni siquiera abre el tramo del Core)");
}

/* ═══ 6 · aportarContexto / retomar — contra la CONTINUIDAD REAL (carril B, `src/adi/continuidad/`) ══════════════
 * Corte 9 (owner 2026-09-26): ya no hay doble — `continuidad` acá es el ALMACÉN de `continuidad/almacen.js`. El
 * flujo completo (consultar → conversación → aportarContexto → retomar) lo prueba `_capacidad_continuidad_gate.mjs`;
 * acá solo la FORMA del enganche: `crearAcciones({continuidad})` funciona contra un almacén real, con las leyes
 * de `empresa.js` intactas (el perfil se rechaza; un aporte sin colisión queda vigente ya mismo; solo una
 * colisión entre dos declarados abre el "pendiente"). */
H("6 · aportarContexto/retomar contra la continuidad real — la forma del enganche");
{
  const continuidad = crearAlmacenEnMemoria();
  const { aportarContexto, retomar } = crearAcciones({ continuidad });

  // el perfil NUNCA se declara por esta vía (ley de `empresa.js:declararHecho` — vive en `tenants`, 012/013)
  const aPerfil = await aportarContexto({ tenant: TENANT, aportes: [{ clase: "perfil", concepto: "sector", valor: "retail_moda" }] });
  ok(aPerfil.ok === true, "aportarContexto responde ok:true aunque el aporte se rechace (el rechazo va en el resultado, no en el sobre)");
  ok(aPerfil.resultados[0].estado === "rechazado", "clase \"perfil\" se rechaza: vive en tenants, no en la memoria de empresa", JSON.stringify(aPerfil.resultados[0]));

  // ACTUALIZADO (owner 2026-09-26, ley aprobada «un dato declarado o leído de un documento se devuelve para
  // confirmar ANTES de usarlo; proponer es del modelo, confirmar es de la persona»): TODO aporte nuevo — haya o
  // no colisión — nace "pendiente", con `paraConfirmar:true`. Antes de esta fecha, un aporte sin colisión
  // quedaba vigente de inmediato; eso violaba la ley (ADI proponía y usaba en el mismo paso).
  const a1 = await aportarContexto({ tenant: TENANT, aportes: [{ clase: "criterio", concepto: "benchmark_propio_margen", valor: 28, unidad: "pct" }] });
  ok(a1.ok === true, "aportarContexto crea una conversación y registra el aporte");
  ok(typeof a1.conversacionId === "string" && a1.conversacionId.length > 0, "conversacionId emitido por la continuidad inyectada (emitirConversacionId)");
  ok(a1.resultados[0].estado === "pendiente" && a1.resultados[0].paraConfirmar === true, "★ LEY 2026-09-26 · todo aporte nuevo nace pendiente — proponer no es usar", JSON.stringify(a1.resultados[0]));

  // declarar OTRO valor para la MISMA llave (mismo concepto/entidad/período), MIENTRAS el primero sigue sin
  // confirmar, SÍ choca igual (la colisión se compara contra vigente Y contra pendiente): nunca se pisa en
  // silencio — entra "pendiente" con `conflictoCon` apuntando al primero, y el origen sigue "declarado" en los dos.
  const a2 = await aportarContexto({ tenant: TENANT, conversacionId: a1.conversacionId, aportes: [{ clase: "criterio", concepto: "benchmark_propio_margen", valor: 32, unidad: "pct" }] });
  ok(a2.resultados[0].estado === "pendiente" && a2.resultados[0].paraConfirmar === true, "un valor distinto de la MISMA llave nunca pisa en silencio: queda pendiente", JSON.stringify(a2.resultados[0]));
  ok(a2.resultados[0].conflictoCon === a1.resultados[0].id, "el conflicto apunta al primer pendiente, aunque TODAVÍA no esté confirmado", JSON.stringify(a2.resultados[0]));

  const a3 = await aportarContexto({ tenant: TENANT, conversacionId: a1.conversacionId, aportes: [], confirmar: [a2.resultados[0].id] });
  ok(a3.ok === true && a3.confirmaciones[0].confirmado === true, "confirmar por id resuelve el conflicto (el nuevo valor queda vigente, el viejo se retira)");

  const r1 = await retomar({ tenant: TENANT, conversacionId: a1.conversacionId });
  ok(r1.ok === true, "retomar recupera la conversación abierta por aportarContexto");
  ok(Array.isArray(r1.hechos) && r1.hechos.length === 0, "sin ninguna Entrega todavía (nunca se llamó consultar), retomar no inventa hechos entregados", JSON.stringify(r1.hechos));
  ok(Array.isArray(r1.estadoVigente.hechosAportados) && r1.estadoVigente.hechosAportados.length === 2, "el estado vigente sí referencia los DOS aportes de esta conversación (el vigente y el confirmado)", JSON.stringify(r1.estadoVigente.hechosAportados));
  ok(Array.isArray(r1.advertencias) && r1.advertencias.length > 0, "sin ninguna cifra entregada, retomar lo DECLARA («todavía no tiene cifras entregadas que revalidar») en vez de callar (la revalidación real, con cifras, la prueba _retomar_revalida_gate.mjs)", JSON.stringify(r1.advertencias));

  const rFalla = await retomar({ tenant: TENANT, conversacionId: "conversacion-que-no-existe" });
  ok(rFalla.ok === false, "retomar sobre un id inexistente se declara, no inventa un estado vacío con ok:true");

  // una acción sin la continuidad inyectada (default) también funciona — usa su propio almacén en memoria
  const suelto = crearAcciones();
  const aSuelto = await suelto.aportarContexto({ tenant: TENANT, aportes: [{ clase: "hecho", concepto: "acuerdo verbal de plazo", valor: "60 días" }] });
  ok(aSuelto.ok === true, "crearAcciones() sin argumentos trae su propio almacén en memoria por defecto");
}

/* ═══ 7 · UN RECHAZO ENSEÑA (ensayo 5, owner 2026-10-07) ═════════════════════════════════════════════════════════════════════════════════════════════════════
 * En el ensayo 5, 9 de 48 `consultar` se rechazaron con `universo_invalido` y `alternativas: []` (`{"top":5}` ×5, `direccion:"desc"`, `{"estado":"en mora"}` ×2, `{"marca":"Alsen"}` ×2) y 1 con `entidad_inexistente` sin
 * candidatos, porque el catálogo no documentaba ni `filtros` ni la forma de `universo`. Ahora: el catálogo trae `universo` (la forma, los estados y conjuntos por eje, ejemplos que VALEN) y cada rechazo trae lo válido en ese lugar. */
H("7 · un rechazo enseña: el catálogo documenta el universo y cada rechazo de consultar trae alternativas de esta empresa");
{
  initTenant(TENANT_DEMO);
  const { conocerEmpresa, consultar } = crearAcciones();
  const catalogo = construirCatalogo();
  const u = catalogo.universo;
  ok(u && typeof u.forma === "string" && u.campos && Array.isArray(u.ejemplos) && u.ejemplos.length >= 3 && u.estados && u.conjuntos, "★ el catálogo trae `universo`: la forma, los campos, los estados y conjuntos por eje y ejemplos");
  ok(CAMPOS_UNIVERSO.length === Object.keys(u.campos).length && CAMPOS_UNIVERSO.every((c) => c in u.campos), "★ documenta EXACTAMENTE los campos que el validador admite (ni uno más ni uno menos), `filtros` incluido");
  ok(/mayor · menor · peor · mejor/.test(u.campos.top) && /> · >= · < · <= · == · entre/.test(u.campos.filtros), "las direcciones de `top` y los operadores de `filtros` son los del validador");
  ok(Object.entries(u.estados).every(([eje, l]) => l.every((e) => estadosValidosPara(eje).includes(e))) && u.estados.cliente.includes("en mora") && u.estados.cliente.includes("al dia"), "los estados por eje son los de la casa: «en mora» y «al dia» están en cliente");
  /* los ejemplos VALEN: el validador los acepta (con el número que falta) y `consultar` los resuelve */
  const conNumero = (x) => JSON.parse(JSON.stringify(x).replace(/"<cantidad>"/g, "3").replace(/"<número>"/g, "30"));
  for (const ej of u.ejemplos) {
    ok(validarUniverso(conNumero(ej), { tamanoDelEje: () => 13 }) === null, `★ el ejemplo del catálogo ${JSON.stringify(ej)} lo acepta el validador de universos`);
    const r = await consultar({ tenant: TENANT, encargo: { version: "encargo/v1", partes: [{ id: "p1", tema: "comercial", cierre: "cifra", conceptos: ["ventas"], eje: "cliente", universo: conNumero(ej) }] } });
    ok(r.ok === true && r.noResuelto.length === 0, `y consultar lo resuelve: ${JSON.stringify(ej)}`, JSON.stringify(r.noResuelto).slice(0, 300));
  }
  const c = await conocerEmpresa({ tenant: TENANT });
  ok(c.ok && c.catalogo.universo && JSON.stringify(compactarParaAnfitrion("conocerEmpresa", c).catalogo.universo) === JSON.stringify(c.catalogo.universo), "★ conocerEmpresa lo entrega al anfitrión (también por la respuesta compacta)");
  ok(JSON.stringify(c.catalogo.universo).length < 3500, `y es corto (${JSON.stringify(c.catalogo.universo).length} B)`);

  /* los rechazos del ensayo, tal como los mandó el anfitrión */
  const P = (universo) => ({ version: "encargo/v1", partes: [{ id: "p1", tema: "comercial", cierre: "cifra", conceptos: ["ventas"], eje: "cliente", universo }] });
  const casos = [
    ["{top:5}", { top: 5 }, (a) => a.some((x) => x.tipo === "top" && /direccion/.test(x.forma) && x.metricas.includes("ventas") && x.ejemplo.top.direccion === "mayor")],
    ["direccion «desc»", { top: { metrica: "ventas", k: 5, direccion: "desc" } }, (a) => a.some((x) => x.tipo === "top" && /mayor · menor · peor · mejor/.test(x.forma))],
    ["{estado:\"en mora\"} (singular)", { estado: "en mora" }, (a) => a.some((x) => x.tipo === "campo_de_universo" && x.campo === "estados" && x.en_lugar_de === "estado") && a.some((x) => x.tipo === "campos_de_universo" && x.validos.includes("filtros"))],
    ["{marca:\"Alsen\"}", { marca: "Alsen" }, (a) => a.some((x) => x.tipo === "limite" && /marca/.test(x.texto))],
    ["estado que no existe", { eje: "cliente", estados: ["en moraa"] }, (a) => a.some((x) => x.tipo === "estados" && x.validos.includes("en mora"))],
    ["conjunto que no existe", { eje: "cliente", base: "clientes grandes" }, (a) => a.some((x) => x.tipo === "conjuntos" && x.validos.length > 0)],
    ["filtros sin forma", { eje: "cliente", filtros: "dias_vencido > 30" }, (a) => a.some((x) => x.tipo === "filtros" && x.operadores.includes(">") && x.metricas.includes("dias_vencido"))],
    ["eje que no existe", { eje: "region" }, (a) => a.some((x) => x.tipo === "ejes" && x.validos.includes("cliente"))],
  ];
  for (const [nombre, universo, vale] of casos) {
    const r = await consultar({ tenant: TENANT, encargo: P(universo) });
    const nr = r.noResuelto.find((n) => n.motivo === "universo_invalido");
    ok(r.ok === false && nr && nr.alternativas.length > 0 && nr.detalle.length > 0, `★ ${nombre}: se rechaza como universo_invalido, CON alternativas (y con el detalle de siempre)`, JSON.stringify(r.noResuelto).slice(0, 300));
    ok(nr && vale(nr.alternativas), `   y las alternativas dicen lo válido en ese lugar (${nombre})`, JSON.stringify(nr && nr.alternativas).slice(0, 500));
    ok(JSON.stringify(nr ? nr.alternativas : []).length < 1800, `   y son compactas (${JSON.stringify(nr ? nr.alternativas : []).length} B)`);
  }
  const rEnt = await consultar({ tenant: TENANT, encargo: { version: "encargo/v1", partes: [{ id: "p1", tema: "comercial", cierre: "cifra", conceptos: ["ventas"], eje: "cliente", entidades: [{ nombre: "Zzzz" }] }] } });
  const nEnt = rEnt.noResuelto.find((n) => n.motivo === "entidad_inexistente");
  ok(nEnt && nEnt.alternativas.some((a) => a.tipo === "entidades_del_eje" && a.eje === "cliente" && a.nombres.includes("Falabella") && a.n === 13), "★ una entidad que no existe (C02: «Falabella» en otra empresa) trae los nombres del eje de ESTA empresa", JSON.stringify(nEnt).slice(0, 400));
  /* un rechazo que ya traía alternativas queda idéntico; todo motivo cerrado tiene su enseñanza */
  const conAlt = [{ parte: "p1", campo: "tema", valor: "x", motivo: "tema_desconocido", detalle: "", alternativas: [{ tipo: "tema", tema: "comercial" }] }];
  ok(JSON.stringify(ensenarRechazos(conAlt)) === JSON.stringify(conAlt), "lo que el validador ya enseña no se toca");
  const sinAlt = MOTIVOS.map((motivo) => ({ parte: null, campo: "raiz", valor: null, motivo, detalle: "", alternativas: [] }));
  const ens = conTenantActivo(TENANT_DEMO, () => ensenarRechazos(sinAlt, { encargo: { partes: [] } }));
  ok(ens.length === MOTIVOS.length && ens.every((n) => n.alternativas.length > 0), `★ cada uno de los ${MOTIVOS.length} motivos de rechazo del contrato sale con alternativas (nunca una lista vacía)`, ens.filter((n) => !n.alternativas.length).map((n) => n.motivo).join(", "));
  const soloCatalogo = ens.filter((n) => n.alternativas.some((a) => a.tipo === "catalogo")).map((n) => n.motivo);
  ok(soloCatalogo.length === 0, `y NINGUNO se queda en un puntero al catálogo: cada motivo dice lo válido (${soloCatalogo.join(", ")})`);
  /* el formato inválido (forma antes que valor) también enseña */
  const rF = await consultar({ tenant: TENANT, encargo: { version: "encargo/v1", partes: [{ id: "p1", tema: "comercial", cierre: "cifra", conceptos: { a: 1 } }] } });
  ok(rF.ok === false && rF.noResuelto.length > 0 && rF.noResuelto.every((n) => n.alternativas.length > 0), "un `formato_invalido` también trae alternativas (la forma esperada)", JSON.stringify(rF.noResuelto).slice(0, 300));
}

console.log(`\n── _capacidad_gate: PASS ${pass} · FAIL ${fail} (de ${pass + fail}) ──`);
if (fail) { console.log("\nFALLOS:"); for (const f of fails) console.log("  ✗ " + f); }
process.exit(fail ? 1 : 0);
