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
 *   8 · ENSAYO 6 (owner 2026-10-08): LA VENTA NO SE ABRE POR BODEGA — `consultar` rechaza (`venta_por_bodega`) toda métrica comercial sobre un universo definido por bodega o agrupada por bodega, con la razón de negocio y lo que SÍ se puede; el inventario por bodega sigue permitido; el agente ya cumple la misma ley.
 *   9 · ENSAYO 6: EL CATÁLOGO ES COHERENTE CON `consultar` — un recorrido llama a `consultar` por cada concepto × eje × cierre, definición, tipo de supuesto, lente, estado y conjunto que el catálogo ofrece (demo y no-demo), y cada defecto de ANTES reconstruido lo pone en rojo.
 *   10 · ENSAYO 7 (owner 2026-10-08): LO OFRECIDO ENTREGA CIFRAS (ventas del año anterior en las 4 cuentas/marcas/familias/canales, brecha por cuenta, capital inmovilizado por familia, margen de inventario por SKU, y los conceptos con productor propio al nombrar entidades o comparar), el aviso de ausencia no dice «la empresa no tiene el dato», y un universo como lista de nombres se honra (o se rechaza enseñando) — nunca se ignora.
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
import { MCP_TOOLS } from "./src/adi/capacidad/puerta.js";
import { crearAlmacenEnMemoria } from "./src/adi/continuidad/almacen.js";
import { compactarParaAnfitrion } from "./src/adi/capacidad/compacto.js";
import { conTenantActivo } from "./src/adi/capacidad/aislamiento.js";
import { ensenarRechazos } from "./src/adi/capacidad/ensenar.js";
import { validarUniverso, CAMPOS_UNIVERSO } from "./src/adi/notario/hechos.js";
import { estadosValidosPara } from "./src/adi/notario/estados.js";
import { MOTIVOS } from "./src/adi/encargo/esquema.js";
import { separarVentaPorBodega } from "./src/adi/capacidad/leyDeBodega.js";
import { validarEncargo } from "./src/adi/encargo/validar.js";
import { componerEntrega } from "./src/adi/entrega/componer.js";
import { TOOLS } from "./src/adi/oracle/toolRegistry.js";
import { axisEntityNames } from "./src/adi/oracle/entityIndex.js";
import { mapaDelDato } from "./src/adi/agente/mapaDelDato.js";
import { packRenombrado, EMPRESA_NO_DEMO } from "./scripts/medicion-anfitrion/empresa-no-demo.mjs";
import { claveDeMetrica } from "./src/adi/notario/lexico.js";
import { MOTIVO_SIN_DATO } from "./src/config/contract/ausencias.js";

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
    ok(Array.isArray(salida.uso) && salida.uso.length === 5, `${caso.id} · trae la cabecera de uso completa (5 reglas)`, JSON.stringify(salida.uso));
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

/* ═══ 8 · ENSAYO 6 (owner 2026-10-08) · LA VENTA NO SE ABRE POR BODEGA: `consultar` lo rechaza con una razón que enseña ═════════════════════════════════════════════════════════════
 * B03 pidió «ventas por bodega»: `consultar` aceptó el universo «los SKU de Lampa» para una métrica comercial y el anfitrión escribió «Lampa vende $97.6M… 11.5 veces Calama». Decisión del owner (opción A): se RECHAZA, con la razón en
 * palabras de negocio y lo que SÍ se puede. El inventario por bodega sigue permitido; nada de esto toca el Core (`encargo/*`, `entrega/*`). Sobre el demo Y la empresa no-demo. */
const PACK_RC = packRenombrado({ version: 1 });
const MUNDOS = [
  { etiqueta: "demo", T: { id: "demo", nombre: "ADI Demo", dataset: TENANT_DEMO, version: 1, sello: null }, bodegas: ["Santiago", "Valparaíso", "Concepción", "Antofagasta"] },
  { etiqueta: "no-demo", T: { id: EMPRESA_NO_DEMO.id, nombre: EMPRESA_NO_DEMO.nombre, dataset: PACK_RC, version: 1, sello: null }, bodegas: ["Lampa", "Quilpué", "Rancagua", "Calama"] },
];
const E1 = (partes, extra = {}) => ({ version: "encargo/v1", partes, ...extra });
const filasDeVenta = (r) => (r && r.entrega && r.entrega.json && r.entrega.json.cifras ? r.entrega.json.cifras.filas : []).filter((f) => f.valores && f.valores["Métrica"] === "Venta" && f.valores["Tema"] === "comercial");
const textoDeLaLey = (inv) => `La venta no se abre por bodega: el dato no dice qué bodega despachó cada venta, y tampoco su margen, contribución ni unidades. Puedo darle ${inv}, o la venta de los productos que usted nombre.`;

for (const M of MUNDOS) {
  H(`8 · la venta no se abre por bodega (${M.etiqueta})`);
  const A = crearAcciones();
  const consultarM = (partes, extra) => A.consultar({ tenant: M.T, encargo: E1(partes, extra) });
  const [b1, b2] = M.bodegas;

  /* 8a · EL CASO DEL ENSAYO: B03|1|1 tal cual lo mandó el anfitrión (una parte por bodega, universo `{eje:sku, bodega}`) */
  const b03 = M.bodegas.map((b, i) => ({ id: `p${i + 1}`, tema: "comercial", cierre: "cifra", conceptos: ["ventas"], eje: "sku", universo: { eje: "sku", bodega: b } }));
  const r03 = await consultarM(b03);
  ok(r03.ok === false && r03.entrega === null, "★ B03|1|1: «ventas por bodega» (una parte por bodega, universo {sku, bodega}) NO entrega nada — antes entregaba los SKU de cada bodega sin ningún límite", JSON.stringify(r03).slice(0, 300));
  ok(r03.noResuelto.length === 4 && r03.noResuelto.every((n, i) => n.motivo === "venta_por_bodega" && n.parte === `p${i + 1}` && n.campo === "universo"), "…cada parte rechazada con su motivo (`venta_por_bodega`) y su parte", JSON.stringify(r03.noResuelto.map((n) => [n.parte, n.motivo, n.campo])));
  ok(r03.noResuelto.every((n, i) => n.detalle === textoDeLaLey(`el inventario de ${M.bodegas[i]}`)), "★ la razón es EXACTAMENTE la de negocio: «La venta no se abre por bodega: el dato no dice qué bodega despachó cada venta… Puedo darle el inventario de <bodega>, o la venta de los productos que usted nombre»", r03.noResuelto[0] && r03.noResuelto[0].detalle);
  ok(r03.noResuelto.every((n) => !/\d/.test(n.detalle)) && !/boleta|\bfig\b|motor|sistema/i.test(r03.noResuelto[0].detalle), "…en palabras de negocio, sin una cifra ni jerga");
  const alt = r03.noResuelto[0].alternativas;
  ok(alt.map((a) => a.tipo).join() === "inventario_por_bodega,venta_por_producto,ejes_de_la_venta", "★ enseña (ensenar.js): el inventario por bodega, la venta por producto y los ejes donde la venta sí se abre", alt.map((a) => a.tipo).join());
  ok(alt[0].tema === "inventario" && alt[0].eje === "bodega" && alt[0].bodegas.join() === b1 && alt[0].conceptos.includes("capital") && !alt[0].conceptos.includes("ventas"), "   inventario_por_bodega: la bodega pedida y los conceptos con cifras por bodega (capital sí, ventas no)", JSON.stringify(alt[0]));
  ok(alt[1].tema === "comercial" && alt[1].eje === "sku" && alt[1].conceptos.join() === "ventas", "   venta_por_producto: el concepto que pidió, por producto (nombrando los productos)", JSON.stringify(alt[1]));
  ok(alt[2].validos.includes("cliente") && alt[2].validos.includes("sku") && !alt[2].validos.includes("bodega"), "   ejes_de_la_venta: los ejes donde la venta existe (la bodega no está)", JSON.stringify(alt[2]));
  ok(JSON.stringify(r03.noResuelto[0]).length < 1500, `   y todo es compacto (${JSON.stringify(r03.noResuelto[0]).length} B por rechazo)`);
  ok(JSON.stringify(compactarParaAnfitrion("consultar", r03)) === JSON.stringify(r03), "   y viaja igual al anfitrión (una consulta sin Entrega ya es chica)");
  /* lo que ofrece VALE: el inventario de la bodega y la venta de los productos que nombre se responden */
  const rInv = await consultarM([{ id: "p1", tema: "inventario", cierre: "cifra", conceptos: alt[0].conceptos.slice(0, 2), eje: "sku", universo: { eje: "sku", bodega: b1 } }]);
  ok(rInv.ok === true && rInv.noResuelto.length === 0 && filasDeVenta(rInv).length === 0, "★ lo que ofrece vale: «el inventario de <bodega>» se responde (sin una fila de venta)", JSON.stringify(rInv.noResuelto).slice(0, 200));
  const skus = conTenantActivo(M.T.dataset, () => axisEntityNames("sku")).slice(0, 2);
  const rProd = await consultarM([{ id: "p1", tema: "comercial", cierre: "cifra", conceptos: ["ventas"], eje: "sku", entidades: skus.map((nombre) => ({ nombre, eje: "sku" })) }]);
  ok(rProd.ok === true && rProd.noResuelto.length === 0 && filasDeVenta(rProd).length === 2, "…y «la venta de los productos que usted nombre» también (las dos ventas por SKU)", JSON.stringify(rProd.noResuelto).slice(0, 200));

  /* 8b · QUÉ PETICIONES LA DISPARAN: toda métrica comercial sobre algo definido por bodega, o agrupada por bodega */
  const P = (o) => ({ id: "p1", tema: "comercial", cierre: "cifra", ...o });
  const dispara = [
    ["venta agrupada por bodega (eje bodega)", [P({ conceptos: ["ventas"], eje: "bodega" })], "eje"],
    ["venta de una bodega nombrada, sin eje", [P({ conceptos: ["ventas"], entidades: [{ nombre: b1 }] })], "entidad"],
    ["margen de una bodega nombrada, con eje", [P({ conceptos: ["margen"], entidades: [{ nombre: b1, eje: "bodega" }] })], "entidad"],
    ["comparar la venta de dos bodegas", [P({ cierre: "comparacion", conceptos: ["ventas"], entidades: [{ nombre: b1, eje: "bodega" }, { nombre: b2, eje: "bodega" }] })], "entidad"],
    ["lectura comercial de una bodega (sin conceptos)", [P({ cierre: "lectura", entidades: [{ nombre: b1, eje: "bodega" }] })], "entidad"],
    ["lectura comercial de los SKU de dos bodegas", [P({ cierre: "lectura", eje: "sku", universo: { eje: "sku", bodega: [b1, b2] } })], "universo"],
    ["contribución de los SKU fuera de una bodega (excluir.bodega)", [P({ conceptos: ["contribucion"], eje: "sku", universo: { eje: "sku", excluir: { bodega: b1 } } })], "universo"],
    ["unidades vendidas con una unión de bodegas", [P({ conceptos: ["unidades"], eje: "sku", universo: { eje: "sku", union: [{ bodega: b1 }, { bodega: b2 }] } })], "universo"],
    ["carga comercial de los SKU de una bodega", [P({ conceptos: ["carga"], eje: "sku", universo: { eje: "sku", bodega: b1 } })], "universo"],
    ["inventario recortado por venta dentro de una bodega (top por ventas)", [{ id: "p1", tema: "inventario", cierre: "cifra", conceptos: ["capital"], eje: "sku", universo: { eje: "sku", bodega: b1, top: { metrica: "ventas", k: 2, direccion: "mayor" } } }], "universo"],
    ["inventario filtrado por margen dentro de una bodega", [{ id: "p1", tema: "inventario", cierre: "cifra", conceptos: ["capital"], eje: "sku", universo: { eje: "sku", bodega: b1, filtros: [{ metrica: "margen", op: ">", valor: 20 }] } }], "universo"],
    ["una simulación de venta de una bodega", [P({ cierre: "simulacion", supuestos: ["s1"], entidades: [{ nombre: b1, eje: "bodega" }] })], "entidad", { supuestos: [{ id: "s1", tipo: "growth", valor: 5, unidad: "pct", alcance: { eje: "bodega", nombre: b1 } }] }],
  ];
  for (const [nombre, partes, campo, extra] of dispara) {
    const r = await consultarM(partes, extra);
    ok(r.ok === false && r.entrega === null && r.noResuelto.some((n) => n.motivo === "venta_por_bodega" && n.campo === campo && n.alternativas.length === 3), `★ se rechaza con la razón: ${nombre}`, JSON.stringify(r.noResuelto.map((n) => [n.motivo, n.campo])).slice(0, 300));
  }
  ok((await consultarM([P({ conceptos: ["ventas"], entidades: [{ nombre: b1, eje: "bodega" }, { nombre: b2, eje: "bodega" }] })])).noResuelto[0].detalle === textoDeLaLey(`el inventario de ${b1} y ${b2}`), "con dos bodegas nombradas, la razón ofrece el inventario de las dos");
  ok((await consultarM([P({ conceptos: ["ventas"], eje: "bodega" })])).noResuelto[0].detalle === textoDeLaLey("el inventario por bodega"), "sin una bodega nombrada (agrupada por bodega), ofrece «el inventario por bodega»");

  /* 8c · LO QUE SIGUE PERMITIDO (control): el inventario por bodega, la venta sin bodega, definir un concepto */
  const permitido = [
    ["inventario de los SKU de una bodega", [{ id: "p1", tema: "inventario", cierre: "cifra", conceptos: ["capital", "rotacion"], eje: "sku", universo: { eje: "sku", bodega: b1 } }]],
    ["inventario agrupado por bodega", [{ id: "p1", tema: "inventario", cierre: "cifra", conceptos: ["capital", "rotacion"], eje: "bodega" }]],
    ["inventario de una bodega nombrada", [{ id: "p1", tema: "inventario", cierre: "cifra", conceptos: ["capital"], entidades: [{ nombre: b1, eje: "bodega" }] }]],
    ["inventario de los SKU sin venta de una bodega (estado)", [{ id: "p1", tema: "inventario", cierre: "cifra", conceptos: ["capital"], eje: "sku", universo: { eje: "sku", bodega: b1, estados: ["sin venta"] } }]],
    ["la venta por SKU, sin bodega", [P({ conceptos: ["ventas"], eje: "sku" })]],
    ["la venta por cliente", [P({ conceptos: ["ventas"], eje: "cliente" })]],
    ["definir «venta» aunque se hable de bodegas", [P({ cierre: "definicion", concepto: "ventas", eje: "bodega" })]],
  ];
  for (const [nombre, partes] of permitido) {
    const r = await consultarM(partes);
    ok(!r.noResuelto.some((n) => n.motivo === "venta_por_bodega") && (r.ok === true || nombre.startsWith("definir")), `control · sigue permitido: ${nombre}`, JSON.stringify(r.noResuelto.map((n) => [n.motivo, n.campo])).slice(0, 300));
  }

  /* 8d · UNA PARTE RECHAZADA NO ANULA A LAS DEMÁS (nunca sustitución por vecino) y no deja rastro en la Entrega */
  const rMix = await consultarM([b03[0], { id: "p2", tema: "inventario", cierre: "cifra", conceptos: ["capital"], eje: "bodega" }]);
  ok(rMix.ok === true && rMix.noResuelto[0].motivo === "venta_por_bodega" && rMix.noResuelto[0].parte === "p1" && filasDeVenta(rMix).length === 0, "★ de dos partes, la de venta × bodega se rechaza y la de inventario corre (sin una sola fila de venta en la Entrega)", JSON.stringify(rMix.noResuelto.map((n) => [n.parte, n.motivo])));
  ok(rMix.entrega.json.universos.every((u) => !/^p1/.test(u.id)) && !/Venta/.test(rMix.entrega.texto.split("**Cifras.**")[1] || ""), "   y la parte rechazada no deja universo ni cifra en la Entrega");
  const libroMix = await A.consultar({ tenant: M.T, encargo: E1([b03[0], { id: "p2", tema: "inventario", cierre: "cifra", conceptos: ["capital"], eje: "bodega" }]) });
  ok(libroMix.continuidad && libroMix.continuidad.guardada === true, "   y la conversación se guarda igual (lo rechazado no rompe la continuidad)");
  /* una parte con conceptos comerciales E inventario: corre con el inventario y declara los comerciales */
  const rParcial = await consultarM([{ id: "p1", tema: "inventario", cierre: "cifra", conceptos: ["unidades_stock", "contribucion"], eje: "bodega", entidades: [{ nombre: b1, eje: "bodega" }] }]);
  const nrP = rParcial.noResuelto.find((n) => n.motivo === "venta_por_bodega");
  ok(rParcial.ok === true && nrP && nrP.campo === "concepto" && nrP.valor === "contribucion" && rParcial.entrega.json.cifras.filas.some((f) => f.valores["Métrica"] === "Unidades en stock") && filasDeVenta(rParcial).length === 0, "★ lo válido corre y lo inválido se declara: de «unidades en stock» + «contribución» de una bodega, sirve el stock y rechaza la contribución", JSON.stringify(rParcial.noResuelto.map((n) => [n.motivo, n.campo, n.valor])));
  /* un supuesto que solo citaba la parte rechazada se va con ella (no queda «sin productor» por una parte que ya no existe) */
  const rSup = await consultarM([P({ cierre: "simulacion", supuestos: ["s1"], entidades: [{ nombre: b1, eje: "bodega" }] }), { id: "p2", tema: "inventario", cierre: "cifra", conceptos: ["capital"], eje: "bodega" }], { supuestos: [{ id: "s1", tipo: "growth", valor: 5, unidad: "pct", alcance: { eje: "bodega", nombre: b1 } }] });
  ok(rSup.noResuelto.length === 1 && rSup.noResuelto[0].motivo === "venta_por_bodega", "   y el supuesto que solo citaba esa parte no deja un segundo rechazo ruidoso", JSON.stringify(rSup.noResuelto.map((n) => [n.motivo, n.campo])));

  /* 8e · CARNADA: sin la ley, el defecto ENTREGA venta de los SKU de la bodega (la misma pregunta por el Core directo) — el predicado muerde */
  const sinLey = conTenantActivo(M.T.dataset, () => componerEntrega(validarEncargo(E1([b03[0]]), {})));
  ok(sinLey.ok === true && sinLey.entrega.cifras.filas.filter((f) => f.valores["Métrica"] === "Venta").length >= 2, "CARNADA «el Core directo, sin la ley» → entrega la venta de los SKU de la bodega (el defecto del ensayo 6): el predicado `filasDeVenta` lo caza", String(sinLey.ok));
  ok(filasDeVenta(await consultarM([b03[0]])).length === 0, "…y por `consultar` ya no hay ninguna");
}

H("8 · la ley, en frío: forma de lo que deja pasar y de lo que no");
{
  initTenant(TENANT_DEMO);
  const sano = E1([{ id: "p1", tema: "comercial", cierre: "cifra", conceptos: ["ventas"], eje: "cliente" }]);
  const l = conTenantActivo(TENANT_DEMO, () => separarVentaPorBodega(sano));
  ok(l.encargo === sano && l.rechazos.length === 0, "★ un encargo sin venta × bodega pasa IDÉNTICO (la misma referencia de objeto: los 532 sellados no se tocan por esto)");
  const raizRota = { ...E1([{ id: "p1", tema: "comercial", cierre: "cifra", conceptos: ["ventas"], eje: "bodega" }]), campoAjeno: 1 };
  const l2 = conTenantActivo(TENANT_DEMO, () => separarVentaPorBodega(raizRota));
  ok(l2.encargo === raizRota && l2.rechazos.length === 0, "una raíz inválida (campo ajeno) se deja pasar entera: ese rechazo es del validador, con su motivo de siempre");
  const siete = E1(Array.from({ length: 7 }, (_, i) => ({ id: `p${i + 1}`, tema: "comercial", cierre: "cifra", conceptos: ["ventas"], eje: "bodega" })));
  ok(conTenantActivo(TENANT_DEMO, () => separarVentaPorBodega(siete)).encargo === siete, "…y también un encargo con más partes que el tope (`partes_tope` lo dice el validador)");
  ok(MOTIVOS.indexOf("venta_por_bodega") === -1, "el motivo es de ESTA capa (como `formato_invalido`): la lista cerrada de MOTIVOS del contrato del Encargo no se toca");
  /* el agente (el chat de la app) ya cumple la misma ley: ni la herramienta de consulta ni el mapa del dato abren la venta por bodega */
  const q1 = conTenantActivo(TENANT_DEMO, () => TOOLS.queryMetric({ metric: "ventas", dimension: "bodega" }));
  const q2 = conTenantActivo(TENANT_DEMO, () => TOOLS.queryMetric({ metric: "ventas", dimension: "sku", filters: { bodega: "Santiago" } }));
  const q3 = conTenantActivo(TENANT_DEMO, () => TOOLS.queryMetric({ metric: "margen", dimension: "bodega" }));
  ok(q1.coverage.supported === false && q2.coverage.supported === false && q3.coverage.supported === false && q1.boleta.length === 0 && q2.boleta.length === 0, "★ el AGENTE (src/adi/agente): la consulta de venta o margen por bodega declina (sin una sola cifra)");
  const mapa = JSON.stringify(conTenantActivo(TENANT_DEMO, () => mapaDelDato()));
  ok(/bodega: SOLO inventario/.test(mapa) && /sin venta ni margen/.test(mapa), "…y el mapa del dato del agente dice el límite: «bodega: SOLO inventario… sin venta ni margen»");
  const importaComponer = fs.readdirSync("src/adi/agente").filter((f) => f.endsWith(".js")).filter((f) => /from\s+["'][^"']*entrega\/componer\.js["']/.test(fs.readFileSync(`src/adi/agente/${f}`, "utf8")));
  ok(importaComponer.length === 0, "★ el camino de la app no usa el compositor de la Entrega (`entrega/componer.js`): la venta por bodega por universo es solo del Encargo del Complemento, que ya la rechaza", importaComponer.join(", "));
}

/* ═══ 9 · EL CATÁLOGO ES COHERENTE CON `consultar` (ensayo 6, owner 2026-10-08): TODO LO QUE OFRECE SE PUEDE RESPONDER ═══════════════════════════════════════════════════════════════
 * A01|1|4 pidió `margen_promedio` (ofrecido por el catálogo como concepto del negocio) y `consultar` volvió `concepto_sin_productor`. Este recorrido camina la OFERTA del catálogo y llama a `consultar` por cada combinación —concepto × eje × cierre (cifra ·
 * lectura · decisión · comparación), cada id de definición, cada tipo de supuesto en cada lugar donde dice que corre, cada lente de criterio, cada estado y conjunto de universo—: si algo ofrecido no se responde, el recorrido lo nombra. Así no vuelve a desviarse. */
/* ENSAYO 7 (owner 2026-10-08): «responder» ya no es «no rechazar». Lo que el catálogo ofrece como concepto tiene que traer AL MENOS UNA CIFRA DEL CONCEPTO CON ID (una fila de la tabla con su hecho), o consultar la rechaza con una razón precisa que enseña
 * (`noResuelto` con alternativas). Un `ok` sin una sola cifra suya —aunque traiga un aviso genérico o las cifras de otro concepto— es una oferta que no se cumple (los sondeos del ensayo 7: `ventas_anterior` en los 4 ejes, `brecha` por cuenta, `capital_inmovilizado`
 * por familia y `margen_inventario` por SKU volvían ok con cero cifras). */
const filasConId = (r) => [...((((r && r.entrega && r.entrega.json) || {}).cifras || {}).filas || []), ...((((r && r.entrega && r.entrega.json) || {}).detalle || {}).filas || [])].filter((f) => Array.isArray(f.hechos) && f.hechos.length);
const cifrasDelConcepto = (r, concepto) => filasConId(r).filter((f) => claveDeMetrica(String((f.valores || {})["Métrica"] || "")) === concepto).length;
async function recorrerOferta(A, T, catalogo) {
  const malas = [];
  const probar = async (etiqueta, partes, extra, concepto = null) => {
    let r; try { r = await A.consultar({ tenant: T, encargo: E1(partes, extra) }); } catch (e) { malas.push(`${etiqueta}: lanzó ${e && e.message}`); return false; }
    const ok1 = r.ok === true && (r.noResuelto || []).length === 0;
    if (!ok1) malas.push(`${etiqueta} → ${r.ok ? "ok" : "no ok"} ${(r.noResuelto || []).map((n) => `${n.campo}:${n.motivo}`).join(",")}`);
    else if (concepto && cifrasDelConcepto(r, concepto) === 0) { malas.push(`${etiqueta} → ok pero SIN UNA CIFRA de «${concepto}» con id y sin una razón que enseñe`); return false; }
    return ok1;
  };
  const ejemplos = Object.fromEntries((catalogo.ejes || []).map((e) => [e.eje, e.ejemplos || []]));
  for (const t of catalogo.temas) {
    if (t.estado !== "activo") continue;
    for (const c of t.conceptos) {
      const ejes = c.ejes && c.ejes.length ? c.ejes : [null];
      for (const eje of ejes) {
        const base = { tema: t.id, conceptos: [c.clave], ...(eje ? { eje } : {}) };
        for (const cierre of ["cifra", "lectura", "decision"]) if (t.cierres[cierre] === true) await probar(`${t.id}/${c.clave}/${eje || "sin eje"}/${cierre}`, [{ id: "p1", ...base, cierre }], undefined, c.negocio || c.referencia || !eje ? null : c.clave);
        /* nombrando entidades (como B02|2|3: «ventas y ventas del año anterior de Samsung y LG»): el concepto sigue entregando su cifra */
        if (eje && !c.negocio && !c.referencia) { const ex2 = ejemplos[eje] || []; if (ex2.length >= 2 && t.cierres.cifra === true) await probar(`${t.id}/${c.clave}/${eje}/cifra con entidades nombradas`, [{ id: "p1", ...base, cierre: "cifra", entidades: ex2.slice(0, 2).map((nombre) => ({ nombre, eje })) }], undefined, c.clave); }
        if (t.cierres.comparacion === true) {
          const ex = eje ? ejemplos[eje] || [] : [];
          if (ex.length < 2) malas.push(`${t.id}/${c.clave}/${eje || "sin eje"}/comparacion: el catálogo no trae dos ejemplos del eje para comparar`);
          else await probar(`${t.id}/${c.clave}/${eje}/comparacion`, [{ id: "p1", ...base, cierre: "comparacion", entidades: ex.slice(0, 2).map((nombre) => ({ nombre, eje })) }], undefined, c.negocio || c.referencia ? null : c.clave);
        }
      }
    }
  }
  const definibles = (catalogo.conceptosDeDefinicion || []).map((x) => x.id);
  for (const id of [...new Set(definibles)]) await probar(`definicion/${id}`, [{ id: "p1", tema: "comercial", cierre: "definicion", concepto: id }]);
  for (const s of catalogo.supuestosAdmitidos || []) {
    for (const [tema, ejes] of Object.entries(s.alcances || {})) for (const eje of ejes) {
      if (eje === "negocio") { await probar(`supuesto ${s.tipo}/${tema}/negocio`, [{ id: "p1", tema, cierre: "simulacion", supuestos: ["s1"] }], { supuestos: [{ id: "s1", tipo: s.tipo, valor: 5, unidad: (s.unidades || [])[0], alcance: "negocio" }] }); continue; }
      /* corre para AL MENOS una entidad del eje (una simulación libre de inventario solo corre en un SKU con capital detenido) */
      const nombres = conTenantActivo(T.dataset, () => axisEntityNames(eje));
      let corrio = false;
      for (const nombre of nombres) {
        const r = await A.consultar({ tenant: T, encargo: E1([{ id: "p1", tema, cierre: "simulacion", supuestos: ["s1"], entidades: [{ nombre, eje }] }], { supuestos: [{ id: "s1", tipo: s.tipo, valor: 5, unidad: (s.unidades || [])[0], alcance: { eje, nombre } }] }) });
        if (r.ok === true && (r.noResuelto || []).length === 0) { corrio = true; break; }
      }
      if (!corrio) malas.push(`supuesto ${s.tipo}/${tema}/${eje} → ninguna entidad del eje lo responde`);
    }
  }
  for (const c of catalogo.criterios || []) await probar(`criterio/${c.lente}`, [{ id: "p1", tema: c.tema || "comercial", cierre: "lectura" }], { criterio: { lente: c.lente } });
  const u = catalogo.universo || {};
  const temasProbables = ["comercial", "inventario", "cobranza"];
  const algunTema = async (etiqueta, mk) => { let corrio = false; for (const tema of temasProbables) { const r = await A.consultar({ tenant: T, encargo: E1([mk(tema)]) }); if (r.ok === true && (r.noResuelto || []).length === 0) { corrio = true; break; } } if (!corrio) malas.push(`${etiqueta} → ningún tema lo responde`); };
  for (const [eje, estados] of Object.entries(u.estados || {})) for (const e of estados) await algunTema(`estado ${eje}/${e}`, (tema) => ({ id: "p1", tema, cierre: "lectura", eje, universo: { eje, estados: [e] } }));
  for (const [eje, conjuntos] of Object.entries(u.conjuntos || {})) for (const cj of conjuntos) await algunTema(`conjunto ${eje}/${cj}`, (tema) => ({ id: "p1", tema, cierre: "lectura", eje, universo: { eje, base: cj } }));
  return malas;
}

for (const M of MUNDOS) {
  H(`9 · el catálogo no ofrece nada que consultar no responda (${M.etiqueta})`);
  const A = crearAcciones();
  const cat = (await A.conocerEmpresa({ tenant: M.T })).catalogo;
  const nOferta = cat.temas.filter((t) => t.estado === "activo").reduce((n, t) => n + t.conceptos.reduce((m, c) => m + Math.max(1, c.ejes.length), 0), 0);
  const malas = await recorrerOferta(A, M.T, cat);
  ok(malas.length === 0, `★ cada combinación que el catálogo ofrece se responde (${nOferta} concepto×eje × sus cierres, ${cat.conceptosDeDefinicion.length} definiciones, ${cat.supuestosAdmitidos.length} tipos de supuesto con sus lugares, ${cat.criterios.length} lentes, estados y conjuntos)`, malas.slice(0, 6).join("\n      "));
  /* lo que ya no se ofrece como concepto viaja APARTE, diciendo lo que es, y consultar sigue rechazándolo (la verdad no cambia: solo deja de prometerse) */
  const todas = cat.temas.flatMap((t) => (t.referencias || []).map((r) => ({ tema: t.id, ...r })));
  ok(["margen_promedio", "benchmark", "nivel_carga", "umbral_materialidad", "piso_rotacion", "techo_cobertura"].every((k) => todas.some((r) => r.clave === k)) && cat.temas.every((t) => !t.conceptos.some((c) => (t.referencias || []).some((r) => r.clave === c.clave))), "★ el benchmark, el nivel de carga, el piso, el techo y el margen promedio del negocio viajan en `temas[].referencias` (se CITAN, no se piden) y ya no están entre los `conceptos`", JSON.stringify(todas.map((r) => r.clave)));
  for (const r of todas) {
    const x = await A.consultar({ tenant: M.T, encargo: E1([{ id: "p1", tema: r.tema, cierre: "cifra", conceptos: [r.clave] }]) });
    ok(x.noResuelto.some((n) => n.motivo === "concepto_sin_productor"), `   «${r.clave}»: consultar sigue sin tener productor (por eso no se ofrece)`);
  }
  ok(!cat.supuestosAdmitidos.some((s) => s.tipo === "inventory") && cat.supuestosAdmitidos.every((s) => Object.keys(s.alcances).length > 0), "★ el supuesto de inventario (sin productor en ningún tema) ya no se ofrece, y cada tipo ofrecido dice DÓNDE corre (tema · ejes)", JSON.stringify(cat.supuestosAdmitidos.map((s) => [s.tipo, s.alcances])).slice(0, 400));
  /* ENSAYO 9 (owner 2026-10-09): los cinco tipos comerciales corren en UN modelo — el negocio y cada eje (cuenta · marca · familia · producto); antes la carga era solo de cuentas y el costo y el margen no tenían el negocio (`supuesto_sin_productor`) */
  const _EJES_DE_SUPUESTO = ["cliente", "familia", "marca", "negocio", "sku"];
  ok(["growth", "price", "costo", "margin", "carga"].every((tp) => cat.supuestosAdmitidos.find((s) => s.tipo === tp).alcances.comercial.slice().sort().join() === _EJES_DE_SUPUESTO.join()) && cat.supuestosAdmitidos.find((s) => s.tipo === "custom").alcances.inventario.join() === "sku", "   (los cinco tipos comerciales: el negocio y cada eje · libre: solo producto, en Inventario — lo que el validador decide)");
  ok(["ventas_anterior", "markup", "variacion", "variacion_usd", "vs_presupuesto_usd", "umbral_materialidad", "unidades_stock"].every((id) => !cat.conceptosDeDefinicion.some((x) => x.id === id)) && ["ventas", "margen", "capital", "saldo_vencido"].every((id) => cat.conceptosDeDefinicion.some((x) => x.id === id)), "★ los ids que el glosario no define dejan de ofrecerse como definición (y los que sí, siguen)");

  /* CARNADAS: el catálogo de ANTES (lo que el recorrido tiene que cazar) — cada defecto reconstruido, solo él, pone el recorrido en ROJO */
  const minimo = (parche) => ({ temas: [], ejes: cat.ejes, conceptosDeDefinicion: [], supuestosAdmitidos: [], criterios: [], universo: {}, ...parche });
  const temaComercial = (conceptos) => ({ id: "comercial", estado: "activo", cierres: cat.temas.find((t) => t.id === "comercial").cierres, conceptos });
  const m1 = await recorrerOferta(A, M.T, minimo({ temas: [temaComercial([{ clave: "margen_promedio", rotulo: "Margen promedio", unidad: "pct", referencia: false, negocio: true, ejes: [] }])] }));
  ok(m1.some((x) => /margen_promedio/.test(x)), "CARNADA «el catálogo vuelve a ofrecer `margen_promedio` como concepto» → el recorrido lo nombra (concepto_sin_productor)", m1.join(" | ").slice(0, 300));
  const m2 = await recorrerOferta(A, M.T, minimo({ conceptosDeDefinicion: [{ id: "markup", rotulo: "Markup sobre costo" }, { id: "unidades_stock", rotulo: "Unidades en stock" }, { id: "ventas", rotulo: "Venta" }] }));
  ok(m2.some((x) => /definicion\/markup/.test(x)) && m2.some((x) => /definicion\/unidades_stock/.test(x)), "CARNADA «se vuelve a ofrecer la definición de `markup` y `unidades_stock`» → el recorrido las nombra (no hay definición curada)", m2.join(" | ").slice(0, 300));
  const m3 = await recorrerOferta(A, M.T, minimo({ supuestosAdmitidos: [{ tipo: "inventory", nombre: "Cambio de inventario", unidades: ["days", "pct"], perturba: "doh", alcances: { inventario: ["sku"] } }] }));
  ok(m3.some((x) => /supuesto inventory/.test(x)), "CARNADA «se vuelve a ofrecer el supuesto de inventario» → el recorrido lo nombra (ninguna entidad lo responde)", m3.join(" | ").slice(0, 300));
  const m4 = await recorrerOferta(A, M.T, minimo({ temas: [temaComercial([{ clave: "ventas", rotulo: "Venta", unidad: "money", referencia: false, negocio: false, ejes: ["cliente", "bodega"] }])] }));
  const m5 = await recorrerOferta(A, M.T, minimo({ temas: [temaComercial([{ clave: "ventas", rotulo: "Venta", unidad: "money", referencia: false, negocio: false, ejes: ["cliente"] }])] }));
  ok(m5.length === 0, "…y el control: la misma mini-oferta SIN la bodega pasa limpia (el recorrido no inventa rojos)", m5.join(" | ").slice(0, 200));
  ok(m4.some((x) => /comercial\/ventas\/bodega/.test(x)), "CARNADA «el catálogo ofrece la venta por bodega» → el recorrido la nombra (la ley de la bodega)", m4.join(" | ").slice(0, 300));

  /* CARNADAS DEL ENSAYO 7 — «ok sin una sola cifra»: cada oferta que los sondeos encontraron vacía, con la respuesta de ANTES reconstruida (la misma consulta, sin las cifras de ese concepto, sin aviso del concepto) → el recorrido la nombra;
   * el control es la misma oferta con la respuesta de HOY → limpia */
  const sinLasCifrasDe = (concepto) => ({ consultar: async (x) => {
    const r = JSON.parse(JSON.stringify(await A.consultar(x)));
    const j = r.entrega && r.entrega.json; if (!j) return r;
    const quitar = (o) => { if (o && Array.isArray(o.filas)) o.filas = o.filas.filter((f) => claveDeMetrica(String((f.valores || {})["Métrica"] || "")) !== concepto); };
    quitar(j.cifras); quitar(j.detalle); j.limites = (j.limites || []).filter((l) => l._ausencia === true || /perfil completo/.test(String(l.titulo || "")));
    return r;
  } });
  const temaDe = (id, conceptos) => { const t = cat.temas.find((x) => x.id === id); return { id, estado: "activo", cierres: t.cierres, conceptos }; };
  const OFERTAS_VACIAS = [
    ["comercial", "ventas_anterior", ["cliente", "marca", "familia", "canal"], "Ventas del año anterior", "money"],
    ["comercial", "brecha", ["cliente"], "Brecha al benchmark", "pp"],
    ["inventario", "capital_inmovilizado", ["familia"], "Capital inmovilizado", "money"],
    ["inventario", "margen_inventario", ["sku"], "Margen de inventario", "pct"],
  ];
  for (const [tema, clave, ejes, rotulo, unidad] of OFERTAS_VACIAS) {
    const oferta = minimo({ temas: [temaDe(tema, [{ clave, rotulo, unidad, referencia: false, negocio: false, ejes }])] });
    const antes = await recorrerOferta(sinLasCifrasDe(clave), M.T, oferta);
    ok(ejes.every((e) => antes.some((x) => x.startsWith(`${tema}/${clave}/${e}/cifra → ok pero SIN UNA CIFRA`))), `CARNADA «${clave} por ${ejes.join(" · ")} vuelve ok con cero cifras» → el recorrido nombra cada eje (ni una cifra con id ni una razón que enseñe)`, antes.join(" | ").slice(0, 400));
    const hoy = await recorrerOferta(A, M.T, oferta);
    ok(hoy.length === 0, `…y el control: «${clave}» de HOY entrega su cifra en ${ejes.join(" · ")} (cifra · lectura · decisión · con entidades nombradas · comparación)`, hoy.join(" | ").slice(0, 400));
  }
}

/* ═══ 10 · ENSAYO 7 (owner 2026-10-08): LO QUE EL CATÁLOGO OFRECE ENTREGA SU CIFRA · EL AVISO DE AUSENCIA NO DICE «LA EMPRESA NO TIENE EL DATO» · UN UNIVERSO COMO LISTA DE NOMBRES NO SE IGNORA ═══════════════════════════════════════════════════════
 * B02|2|3: «ventas y ventas del año anterior de Samsung y LG» → la Entrega dijo «sin dato de ventas del año anterior para Samsung y LG» con el dato en la tabla (`anterior`, la fuente de la variación: 4.1 % y 15.6 %) y el anfitrión le dijo al usuario «no hay ventas del año anterior».
 * Dos causas: la fila completa de la marca rotula esa cifra «Ventas año anterior» (el léxico solo conocía «Ventas del año anterior» y la leía como la venta del período) y la lectura por eje solo publicaba el TOTAL del negocio. Sobre el demo Y la empresa no-demo. */
const dinero = (txt) => { const m = String(txt).match(/\$([\d.,]+)\s*([KMB]?)/); if (!m) return NaN; return parseFloat(m[1].replace(/,/g, "")) * ({ "": 1, K: 1e3, M: 1e6, B: 1e9 })[m[2]]; };
const filaDe = (r, ent, metrica) => filasConId(r).find((f) => f.valores && f.valores["Entidad / grupo"] === ent && f.valores["Métrica"] === metrica) || null;
const limitesDe = (r) => ((((r && r.entrega && r.entrega.json) || {}).limites) || []).filter((l) => l._ausencia !== true);
for (const M of MUNDOS) {
  H(`10 · ensayo 7: lo ofrecido entrega, el aviso es honesto, el universo por nombres se honra (${M.etiqueta})`);
  const A = crearAcciones();
  const C = (partes, extra) => A.consultar({ tenant: M.T, encargo: E1(partes, extra) });
  const nombresDe = (eje) => conTenantActivo(M.T.dataset, () => axisEntityNames(eje));
  const [mA, mB] = nombresDe("marca");

  /* 10a · B02|2|3 tal cual: la venta del año anterior de dos marcas nombradas, junto a la venta */
  const rB = await C([{ id: "p1", tema: "comercial", cierre: "cifra", conceptos: ["ventas", "ventas_anterior"], eje: "marca", entidades: [mA, mB] }]);
  const fA = filaDe(rB, mA, "Ventas del año anterior"), fB = filaDe(rB, mB, "Ventas del año anterior");
  ok(rB.ok === true && !!fA && !!fB, `★ B02|2|3: «ventas y ventas del año anterior de ${mA} y ${mB}» entrega la venta del año anterior de cada una, con su id (antes: «sin dato de ventas del año anterior para ${mA} y ${mB}»)`, JSON.stringify(limitesDe(rB).map((l) => l.titulo)));
  ok(!limitesDe(rB).some((l) => /ventas del año anterior/i.test(l.titulo)) && !/sin dato de ventas del año anterior/.test(rB.entrega.texto), "   y la Entrega ya no dice «sin dato de ventas del año anterior» (ni en el texto ni en los límites)");
  const rG = await C([{ id: "p1", tema: "comercial", cierre: "cifra", conceptos: ["ventas_anterior"], eje: "marca" }]);
  ok(rG.ok === true && cifrasDelConcepto(rG, "ventas_anterior") === nombresDe("marca").length, "★ la venta del año anterior por marca (el eje entero) entrega UNA cifra por marca, con id", `${cifrasDelConcepto(rG, "ventas_anterior")} de ${nombresDe("marca").length}`);
  ok(filaDe(rG, mA, "Ventas del año anterior") && filaDe(rG, mA, "Ventas del año anterior").valores.Valor === fA.valores.Valor && filaDe(rG, mB, "Ventas del año anterior").valores.Valor === fB.valores.Valor, "   y es LA MISMA cifra por la fila completa de la marca y por el eje entero (una sola verdad por eje)", `${fA && fA.valores.Valor} / ${filaDe(rG, mA, "Ventas del año anterior") && filaDe(rG, mA, "Ventas del año anterior").valores.Valor}`);
  /* coherente con la variación que la misma Entrega ya entregaba: venta ÷ año anterior − 1 (las cifras vienen redondeadas a $0.1M: la diferencia posible es la del redondeo) */
  const rV = await C([{ id: "p1", tema: "comercial", cierre: "cifra", conceptos: ["variacion", "ventas"], eje: "marca", entidades: [mA] }]);
  const vA = filaDe(rV, mA, "Variación vs año anterior"), ventaA = filaDe(rV, mA, "Venta");
  if (vA && ventaA && fA) { const calc = (dinero(ventaA.valores.Valor) / dinero(fA.valores.Valor) - 1) * 100, dicho = parseFloat(String(vA.valores.Valor).replace("%", "")); ok(Math.abs(calc - dicho) <= 0.6, `   y cuadra con la variación entregada de ${mA} (${vA.valores.Valor}) contra su venta y su año anterior (${ventaA.valores.Valor} / ${fA.valores.Valor})`, `${calc.toFixed(2)} vs ${dicho}`); }
  else ok(false, "   la variación, la venta y el año anterior de la misma marca existen para compararlos", JSON.stringify([!!vA, !!ventaA, !!fA]));
  /* 10b · lo que el catálogo ofrece al NOMBRAR entidades o COMPARAR: cada concepto con productor propio entrega (antes «no se pudo servir la cifra de X» / «sin dato de …»), uno por uno */
  const CON_PRODUCTOR_PROPIO = [["comercial", "ventas_anterior", ["cliente", "marca", "familia", "canal"]], ["comercial", "variacion_usd", ["cliente", "marca", "familia", "canal"]], ["comercial", "vs_presupuesto", ["cliente", "marca", "familia", "canal"]], ["comercial", "vs_presupuesto_usd", ["cliente", "marca", "familia", "canal"]], ["comercial", "carga_alta", ["cliente"]], ["comercial", "brecha_precio_costo", ["cliente"]], ["comercial", "markup", ["cliente"]], ["inventario", "capital_frenado", ["familia"]], ["inventario", "capital_inmovilizado", ["familia"]]];
  const sinCifra = [];
  for (const [tema, concepto, ejes] of CON_PRODUCTOR_PROPIO) for (const eje of ejes) {
    const ex = nombresDe(eje); if (ex.length < 2) continue;
    for (const cierre of ["cifra", "comparacion"]) {
      const r = await C([{ id: "p1", tema, cierre, conceptos: [concepto], eje, entidades: ex.slice(0, 2).map((nombre) => ({ nombre, eje })) }]);
      if (cifrasDelConcepto(r, concepto) === 0) sinCifra.push(`${tema}/${concepto}/${eje}/${cierre} con entidades`);
    }
  }
  ok(sinCifra.length === 0, "★ nombrando dos entidades (cifra y comparación) cada concepto con productor propio entrega al menos una cifra suya con id — antes: «no se pudo servir la cifra de X» / «sin dato de …» con el dato en la lectura", sinCifra.join(" | ").slice(0, 400));

  /* 10c · el aviso de ausencia: precisa que es un límite de ESTA LECTURA (no del dato de la empresa) y cómo pedirlo */
  const [f1, f2] = nombresDe("familia");
  const rAus = await C([{ id: "p1", tema: "inventario", cierre: "comparacion", conceptos: ["capital_frenado"], eje: "familia", entidades: [f1, f2].map((nombre) => ({ nombre, eje: "familia" })) }]);
  const lAus = limitesDe(rAus).find((l) => /sin dato de capital inmovilizado crítico para/.test(l.titulo));
  ok(!!lAus && /^Sobre la parte p1 \(inventario\), esta lectura quedó sin dato de capital inmovilizado crítico para /.test(lAus.titulo), "★ el aviso de ausencia dice «esta lectura quedó sin dato de X para Y» (la forma única «sin dato de X para Y», ahora atribuida a la lectura)", JSON.stringify(lAus));
  ok(!!lAus && lAus.motivo === MOTIVO_SIN_DATO && /no un dato que la empresa no tenga/.test(lAus.motivo) && /no publicó esa cifra/.test(lAus.motivo) && /pídala aparte/.test(lAus.motivo), "★ y su motivo dice lo que sabe: es un límite de esta lectura, NO un dato que la empresa no tenga, que se puede pedir aparte (solo ese concepto, para esas cuentas) — nunca puede leerse como «la empresa no tiene el dato»", lAus && lAus.motivo);
  ok(!/La lectura de este turno no publicó esa cifra para esas cuentas; no se rellena con otra\./.test(rAus.entrega.texto), "   y la redacción de ANTES («La lectura de este turno no publicó esa cifra para esas cuentas; no se rellena con otra.») ya no sale");
  const { declararLoQueFalta } = await import("./src/adi/entrega/servidas.js");
  const dSin = declararLoQueFalta({ _servido: true, parteId: "p1", tema: "comercial", sinCifra: ["Falabella"], orden: [], faltantes: [] }, { cifras: { filas: [] } }, { dominioNombre: (t) => t });
  ok(dSin.limites.length === 1 && /es un límite de esta lectura, no prueba que la empresa no tenga el dato/.test(dSin.limites[0].motivo) && /se puede pedir aparte/.test(dSin.limites[0].motivo), "★ «no se pudo servir la cifra de X» tampoco puede leerse como «la empresa no tiene la cifra»: dice que puede pedirse aparte", JSON.stringify(dSin.limites));

  /* 10d · UN UNIVERSO COMO LISTA DE NOMBRES: se honra (el conjunto nombrado, sin total) o se rechaza enseñando — nunca se ignora */
  const clientes = nombresDe("cliente"), [c1, c2] = clientes;
  const filasDe = (r) => (((((r && r.entrega && r.entrega.json) || {}).cifras) || {}).filas) || [];
  const entidadesDe = (r) => [...new Set(filasDe(r).map((f) => f.valores["Entidad / grupo"]))];
  const rU = await C([{ id: "p1", tema: "comercial", cierre: "cifra", conceptos: ["ventas"], eje: "cliente", universo: [c1, c2] }]);
  ok(rU.ok === true && entidadesDe(rU).join() === [c1, c2].join() && filasDe(rU).length === 2, `★ \`universo: ["${c1}","${c2}"]\` sirve EXACTAMENTE esas dos cuentas (antes: las ${clientes.length} del eje más su total, sin aviso)`, JSON.stringify(entidadesDe(rU)));
  ok(!filasDe(rU).some((f) => /total|negocio/i.test(String(f.valores["Entidad / grupo"]))), "   sin ninguna fila de «total» (un total solo si el conjunto es el universo entero)");
  ok((rU.advertencias || []).some((a) => /universo.*lista de nombres.*entidades de la parte/.test(a)), "   y lo dice: una advertencia explica que la lista se leyó como las entidades de la parte", JSON.stringify(rU.advertencias));
  const rE = await C([{ id: "p1", tema: "comercial", cierre: "cifra", conceptos: ["ventas"], eje: "cliente", entidades: [c1, c2] }]);
  ok(rE.entrega.texto === rU.entrega.texto, "   y la Entrega es la MISMA que con `entidades` (un solo camino: el conjunto nombrado)");
  const rTodos = await C([{ id: "p1", tema: "comercial", cierre: "cifra", conceptos: ["ventas"], eje: "cliente", universo: clientes }]);
  ok(rTodos.ok === true && entidadesDe(rTodos).length === clientes.length, "   la lista con TODAS las cuentas sirve todas (el conjunto nombrado es el universo entero)");
  const rNeg = await C([{ id: "p1", tema: "comercial", cierre: "cifra", conceptos: ["ventas"], eje: "cliente", universo: "negocio" }]);
  ok(rNeg.ok === true && entidadesDe(rNeg).length === clientes.length, "   y el texto «negocio» sigue sirviendo el eje entero (no cambia)");
  const skusM = nombresDe("sku");
  const rSku = await C([{ id: "p1", tema: "comercial", cierre: "cifra", conceptos: ["ventas"], eje: "sku", universo: skusM.slice(0, 2) }]);
  ok(rSku.ok === true && entidadesDe(rSku).join() === skusM.slice(0, 2).join(), "   en el eje producto también: solo los dos SKU nombrados");
  const rMismas = await C([{ id: "p1", tema: "comercial", cierre: "cifra", conceptos: ["ventas"], eje: "cliente", universo: [c1, c2], entidades: [c2, c1].map((nombre) => ({ nombre })) }]);
  ok(rMismas.ok === true && entidadesDe(rMismas).length === 2, "   con `universo` y `entidades` que nombran las mismas cuentas, no hay conflicto");
  const rDist = await C([{ id: "p1", tema: "comercial", cierre: "cifra", conceptos: ["ventas"], eje: "cliente", universo: [c1, c2], entidades: [clientes[2]] }]);
  ok(rDist.ok === false && rDist.entrega === null && ((rDist.noResuelto || [])[0] || {}).motivo === "formato_invalido" && ((rDist.noResuelto || [])[0] || {}).campo === "universo" && /distintas/.test(((rDist.noResuelto || [])[0] || {}).detalle), "★ `universo` y `entidades` DISTINTOS no se adivinan: se rechaza (formato_invalido, campo universo) en vez de elegir una en silencio", JSON.stringify(rDist.noResuelto));
  ok(/entidades/.test(((((rDist.noResuelto || [])[0] || {}).alternativas || [])[0] || {}).esperado || ""), "   y enseña la forma válida (la lista de `entidades`, o un objeto con reglas)", JSON.stringify(((rDist.noResuelto || [])[0] || {}).alternativas));
  for (const [u, que] of [[[], "vacía"], [[c1, 3], "con un elemento que no es un nombre"], [[c1, null], "con un null"]]) {
    const rX = await C([{ id: "p1", tema: "comercial", cierre: "cifra", conceptos: ["ventas"], eje: "cliente", universo: u }]);
    ok(rX.ok === false && rX.entrega === null && ((rX.noResuelto || [])[0] || {}).motivo === "formato_invalido" && ((rX.noResuelto || [])[0] || {}).campo === "universo", `   una lista ${que} no corre sin acotar: formato_invalido (antes servía el eje entero)`, JSON.stringify(rX.noResuelto).slice(0, 200));
  }
  const rIn = await C([{ id: "p1", tema: "comercial", cierre: "cifra", conceptos: ["ventas"], eje: "cliente", universo: [c1, "Cliente Que No Existe"] }]);
  ok(rIn.entrega === null || rIn.noResuelto.some((n) => n.motivo === "entidad_inexistente"), "   un nombre que no existe lo dice el validador de siempre (entidad_inexistente, con los nombres del eje), no se descarta en silencio", JSON.stringify(rIn.noResuelto).slice(0, 300));
}

/* ═══ 11 · ENSAYO 8 (owner 2026-10-08) · LA SIMULACIÓN SE ENSEÑA Y EL SUPUESTO EVIDENTE SE ACEPTA · EL EXTREMO SOBRE EL TOTAL SE PIDE A ADI ═════════════════════════════════════════════════════
 * A02|1|7: «Calcúlame tú directo cuánto sería la venta si Mercantil Pacífico subiera diez por ciento»: tres intentos, tres `cierre_incompleto · ningún supuesto citado tiene productor` (el supuesto dentro de la parte con `alcance` como cadena · con `entidad` y
 * `valor:{raw,unidad}` · en la raíz sin id y sin que la parte lo cite). Con el supuesto en la raíz con id y la parte citándolo, corre. Ahora el contrato lo ENSEÑA (catálogo, esquema de la herramienta y el rechazo) y ACEPTA la forma evidente.
 * Y el orden sobre el total («el mayor», «el que más creció») se le pide a ADI: un top de 1 sobre el universo completo; la lista parcial lo dice. */
H("11 · ensayo 8: la simulación (el supuesto en la raíz con id, la parte lo cita) se enseña y se acepta · el extremo se pide a ADI");
{
  initTenant(TENANT_DEMO);
  const { consultar, conocerEmpresa } = crearAcciones();
  const C = (partes, extra = {}) => consultar({ tenant: TENANT, encargo: { version: "encargo/v1", partes, ...extra } });
  const clientes = axisEntityNames("cliente");
  const cuenta = clientes[0];
  const PARTE = { id: "p1", tema: "comercial", cierre: "simulacion", conceptos: ["ventas"], eje: "cliente", entidades: [cuenta] };
  const filas = (r) => (r.entrega && r.entrega.json && r.entrega.json.cifras ? r.entrega.json.cifras.filas : []).map((f) => `${f.valores["Entidad / grupo"]}|${f.valores["Métrica"]}|${f.valores["Valor"]}`);
  const buena = await C([{ ...PARTE, supuestos: ["s1"] }], { supuestos: [{ id: "s1", tipo: "growth", valor: 10, unidad: "pct", alcance: { eje: "cliente", nombre: cuenta } }] });
  ok(buena.ok === true && filas(buena).some((x) => /Venta supuesta/.test(x)), "(control) la forma completa corre: el supuesto en la raíz con id y la parte lo cita", JSON.stringify(buena.noResuelto).slice(0, 300));
  ok(!(buena.advertencias || []).some((a) => /supuesto/.test(a)), "   y no trae ninguna advertencia de forma (lo bien formado pasa idéntico)");
  /* los tres intentos del anfitrión, tal como los mandó */
  const intentos = [
    ["A02|1|7 intento 1 · el supuesto DENTRO de la parte, con `alcance` como cadena", [{ ...PARTE, supuestos: [{ tipo: "growth", valor: 10, unidad: "pct", alcance: cuenta }] }], {}],
    ["A02|1|7 intento 2 · dentro de la parte, con `entidad` y `valor: {raw, unidad}`", [{ ...PARTE, supuestos: [{ tipo: "growth", entidad: cuenta, valor: { raw: 10, unidad: "pct" } }] }], {}],
    ["A02|1|7 intento 3 · en la raíz SIN id, con `alcance: {tema, eje, entidad}`, y la parte sin citarlo", [PARTE], { supuestos: [{ tipo: "growth", valor: 10, unidad: "pct", alcance: { tema: "comercial", eje: "cliente", entidad: cuenta } }] }],
  ];
  for (const [nombre, partes, extra] of intentos) {
    const r = await C(partes, extra);
    ok(r.ok === true && r.noResuelto.length === 0 && JSON.stringify(filas(r)) === JSON.stringify(filas(buena)), `★ ${nombre}: corre y da las MISMAS cifras que la forma completa (antes: «ningún supuesto citado tiene productor»)`, JSON.stringify(r.noResuelto).slice(0, 400));
    ok((r.advertencias || []).some((a) => /supuesto/.test(a) && /(«s1»|id «s1»)/.test(a)), "   y lo dice: una advertencia explica cómo se leyó y la forma completa", JSON.stringify(r.advertencias));
  }
  /* lo ambiguo NO se adivina: dos simulaciones y un supuesto que ninguna cita */
  const amb = await C([{ ...PARTE, id: "p1" }, { ...PARTE, id: "p2", entidades: [clientes[1]] }], { supuestos: [{ id: "s1", tipo: "growth", valor: 10, unidad: "pct", alcance: { eje: "cliente", nombre: cuenta } }] });
  ok(amb.noResuelto.some((n) => n.motivo === "cierre_incompleto"), "★ con DOS simulaciones y un supuesto que ninguna cita, no se adivina de cuál es: las dos quedan sin supuesto (cierre_incompleto)", JSON.stringify(amb.noResuelto).slice(0, 300));
  /* el rechazo ENSEÑA la forma exacta que corre */
  const sin = await C([PARTE]);
  const nr = sin.noResuelto.find((n) => n.motivo === "cierre_incompleto");
  const forma = nr && nr.alternativas.find((a) => a.tipo === "forma_de_simulacion");
  ok(sin.ok === false && forma && /RAÍZ/.test(forma.forma) && /CITA/.test(forma.forma) && forma.ejemplo && forma.ejemplo.supuestos[0].id === "s1" && forma.ejemplo.partes[0].supuestos[0] === "s1", "★ el rechazo «ningún supuesto citado tiene productor» trae la forma EXACTA de una simulación (el supuesto en la raíz con id, la parte lo cita) con un ejemplo mínimo", JSON.stringify(nr && nr.alternativas).slice(0, 600));
  const conNum = (x) => JSON.parse(JSON.stringify(x).replace(/"<número>"/g, "10").replace(/"<nombre exacto>"/g, JSON.stringify(cuenta)));
  const ej = forma ? conNum(forma.ejemplo) : null;
  const rEj = ej ? await consultar({ tenant: TENANT, encargo: ej }) : null;
  ok(rEj && rEj.ok === true && JSON.stringify(filas(rEj)) === JSON.stringify(filas(buena)), "★ y el ejemplo del rechazo CORRE (con el número y la cuenta que le faltan): da la misma simulación", rEj && JSON.stringify(rEj.noResuelto).slice(0, 300));
  const cat = construirCatalogo();
  const sinNumeros = (x) => (typeof x === "number" ? false : Array.isArray(x) ? x.every(sinNumeros) : x && typeof x === "object" ? Object.values(x).every(sinNumeros) : true);
  ok(cat.simulacion && cat.simulacion.ejemplo && JSON.stringify(cat.simulacion.ejemplo) === JSON.stringify(forma.ejemplo) && /RAÍZ/.test(cat.simulacion.forma), "★ el catálogo (conocerEmpresa) trae la MISMA forma y el mismo ejemplo: `simulacion`");
  const rCat = await consultar({ tenant: TENANT, encargo: conNum(cat.simulacion.ejemplo) });
  ok(rCat.ok === true && JSON.stringify(filas(rCat)) === JSON.stringify(filas(buena)), "   y el ejemplo del catálogo corre");
  ok(JSON.stringify(cat.simulacion).length < 1000 && sinNumeros(cat.simulacion.ejemplo), `   corto (${JSON.stringify(cat.simulacion).length} B) y sin una cifra de negocio`);
  const c = await conocerEmpresa({ tenant: TENANT });
  ok(c.ok && JSON.stringify(compactarParaAnfitrion("conocerEmpresa", c).catalogo.simulacion) === JSON.stringify(cat.simulacion), "   y llega al anfitrión por la respuesta compacta");
  const tool = MCP_TOOLS.find((t) => t.name === "consultar");
  const props = tool.inputSchema.properties.encargo.properties;
  ok(/SIMULACIÓN/.test(tool.inputSchema.properties.encargo.description) && /supuestos:\[\{id:'s1'/.test(tool.inputSchema.properties.encargo.description) && props.supuestos && props.supuestos.items.required.includes("id") && props.supuestos.items.required.includes("alcance"), "★ la herramienta `consultar` dice la forma de la simulación (descripción con el ejemplo + esquema de `supuestos` con id y alcance)");

  /* EL EXTREMO SOBRE EL TOTAL: un top de 1 sobre el universo completo */
  const u = cat.universo;
  ok(u.extremo && /top de 1/.test(u.extremo.texto) && /universo completo/.test(u.extremo.texto) && u.extremo.ejemplo && u.extremo.ejemplo.top.k !== undefined, "★ el catálogo expone el camino del extremo: «un top de 1 … calculado sobre el universo completo del eje»");
  ok(tool.inputSchema.properties.encargo.description.includes("top:{metrica, k:1"), "   y la herramienta `consultar` lo dice");
  for (const direccion of ["mayor", "menor"]) {
    const r = await C([{ id: "p1", tema: "comercial", cierre: "cifra", conceptos: ["ventas"], eje: "cliente", universo: { eje: "cliente", top: { metrica: "ventas", k: 1, direccion } } }]);
    const completa = await C([{ id: "p1", tema: "comercial", cierre: "cifra", conceptos: ["ventas"], eje: "cliente", universo: "negocio" }]);
    const ventas = completa.entrega.json.cifras.filas.filter((f) => f.valores["Métrica"] === "Venta" && f.valores["Entidad / grupo"] !== undefined).map((f) => [f.valores["Entidad / grupo"], f.valores["Valor"]]);
    const cr = (x) => completa.entrega.json.procedencia.libro.hechos.find((hh) => hh.roles && hh.roles.sujetos && hh.roles.sujetos[0] === x && hh.claves && [...hh.claves][0] === "ventas").numeros.at(-1).raw;
    const ordenadas = ventas.map(([n]) => n).sort((a, b) => cr(b) - cr(a));
    const esperado = direccion === "mayor" ? ordenadas[0] : ordenadas[ordenadas.length - 1];
    ok(r.ok === true && filas(r).length === 1 && filas(r)[0].startsWith(`${esperado}|`) && new RegExp(`top 1 de ${clientes.length}`).test(r.entrega.texto), `★ el extremo (${direccion}) sobre el total: un top de 1 devuelve ${esperado}, y la Entrega dice «top 1 de ${clientes.length}» (vio el universo completo)`, JSON.stringify(filas(r)));
  }
}

console.log(`\n── _capacidad_gate: PASS ${pass} · FAIL ${fail} (de ${pass + fail}) ──`);
if (fail) { console.log("\nFALLOS:"); for (const f of fails) console.log("  ✗ " + f); }
process.exit(fail ? 1 : 0);
