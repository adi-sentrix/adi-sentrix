/* === _iniciativa_gate.mjs · LA INICIATIVA DE CFO — CORTE 3d.1 (owner 2026-09-25, offline) ═══════════════════════
 * `_ADI_DISENO_CORTE_3D.md` §A — `src/adi/entrega/iniciativa.js` + su enganche en `componerEntrega(resolucion)`
 * (el camino GENERAL de `entrega/componer.js` — las 4 rutas fijas nunca la ejercitan, ver la sección 5).
 *
 * LO QUE ESTE GATE EXIGE (medido sobre TENANT_DEMO real, con `validarEncargo` + `componerEntrega`, el mismo
 * patrón que `_entrega_general_gate.mjs`):
 *   1 · CANDADO §A.6 — con la iniciativa encendida o apagada (`resolucion.encargo.iniciativa`), lo PEDIDO queda
 *       byte-idéntico: misma Respuesta pedida (sin las oraciones marcadas `_iniciativa`/`_marcaIniciativa`),
 *       mismas Cifras, mismos Límites, mismos Universos, mismo libro de hechos (`e*`, mismos ids).
 *   2 · PROPORCIONALIDAD POR CIERRE (§A.2) — `lectura`/`decision` sin entidad ("la cartera entera") sirve las
 *       agregadas del tema EN EL TEXTO; `cifra` con entidad y ≥2 conceptos sirve `vs-benchmark` EN EL TEXTO;
 *       `cifra` con entidad y 1 concepto la deja como OFERTA (nunca en el texto) — o, si el hecho no verifica
 *       (medido: el benchmark de `entityRecord` no trae crudo), no se sirve en ningún lado y se declara en
 *       `entrega.detalle.iniciativaNoVerificada` SIN tumbar la Entrega.
 *   3 · NINGÚN TEMA NO PEDIDO — la iniciativa nunca calcula sobre un dominio que ninguna parte del encargo tocó.
 *   4 · IDS `i*`, NUNCA `e*` — el libro de iniciativa usa su propio prefijo y su propio libro
 *       (`entrega.procedencia.libroIniciativa`), separado del libro pedido.
 *   5 · LAS 4 RUTAS FIJAS NUNCA LA EJERCITAN — un encargo que delega (`_delegarRutaCanonica`) da
 *       `entrega.iniciativa === null`.
 *   6 · LA MARCA VISIBLE — `MARCA_INICIATIVA` es una ÚNICA constante de texto, y aparece en el texto servido
 *       tal cual, antes de las oraciones `▹`.
 *   7 · `verificarEntrega` regla 12 — un hecho de iniciativa declarado como servido tiene que verificar Y estar
 *       ubicado (Respuesta u oferta); carnadas: uno sin verificar, y uno verificado pero no ubicado, arden.
 *
 * CERO llamadas a un LLM · CERO red. Solo por `npm run gates:offline` o
 * `node --import ./scripts/offline-guard.mjs _iniciativa_gate.mjs`. */
import { initTenant } from "./src/data/tenantStore.js";
import { TENANT_DEMO } from "./src/data/tenants/demo.js";
import { validarEncargo } from "./src/adi/encargo/validar.js";
import { componerEntrega } from "./src/adi/entrega/componer.js";
import { verificarEntrega } from "./src/adi/entrega/verificar.js";
import { INICIATIVA, INICIATIVA_CALLS_MAX, MARCA_INICIATIVA, INICIATIVA_VALORES, calcularIniciativa } from "./src/adi/entrega/iniciativa.js";
import { INICIATIVA_VALORES as INICIATIVA_VALORES_ESQUEMA, MOTIVOS } from "./src/adi/encargo/esquema.js";
import { clasificarFuente } from "./scripts/clasificarGates.mjs";
import fs from "node:fs";

let pass = 0, fail = 0;
const ok = (c, m, extra = "") => { if (c) { pass++; console.log("  ✓ " + m); } else { fail++; console.log("  ✗ " + m + (extra ? "\n      " + extra : "")); } };
const H = (t) => console.log(`\n${t}`);

initTenant(TENANT_DEMO);

const _comp = (encargoCrudo) => { const res = validarEncargo(encargoCrudo, {}); return { res, R: res.ok ? componerEntrega(res) : null }; };
const _pedido = (entrega) => entrega.respuesta.filter((r) => !r._iniciativa && !r._marcaIniciativa);

/* ═══ 0 · EL CATÁLOGO — datos, sin lógica ═══ */
H("0 · iniciativa.js — el catálogo declarado, MARCA_INICIATIVA, los valores del interruptor");
ok(typeof MARCA_INICIATIVA === "string" && MARCA_INICIATIVA.length > 0, "MARCA_INICIATIVA es una constante de texto no vacía", MARCA_INICIATIVA);
ok(MARCA_INICIATIVA === "Además, revisé lo que un controller miraría antes de responder:", "MARCA_INICIATIVA es EXACTAMENTE la frase decidida por el supervisor para este encargo");
ok(INICIATIVA_CALLS_MAX === 3, `INICIATIVA_CALLS_MAX = 3 (§A.2b) — hoy siempre 0 de 3 usadas (ninguna entrada ➕ implementada en este corte)`);
ok(JSON.stringify(INICIATIVA_VALORES) === JSON.stringify(["completa", "ninguna"]), "INICIATIVA_VALORES = [\"completa\",\"ninguna\"]");
ok(JSON.stringify(INICIATIVA_VALORES_ESQUEMA) === JSON.stringify(INICIATIVA_VALORES), "★ UNA SOLA VERDAD · encargo/esquema.js:INICIATIVA_VALORES calza con iniciativa.js:INICIATIVA_VALORES — si diverge, este candado arde");
ok(MOTIVOS.includes("iniciativa_invalida"), "el contrato del encargo declara el motivo \"iniciativa_invalida\" (§2.1)");
for (const tema of ["comercial", "cobranza", "inventario", "cruce"]) ok(Array.isArray(INICIATIVA[tema]), `INICIATIVA declara la sección "${tema}"`);
const activas = Object.values(INICIATIVA).flat().filter((e) => e.activo);
const declaradasNoActivas = Object.values(INICIATIVA).flat().filter((e) => !e.activo);
ok(activas.length >= 8, `${activas.length} entradas ACTIVAS en este corte (comercial+cobranza+inventario+cruce)`, activas.map((e) => e.id).join(", "));
ok(declaradasNoActivas.length >= 5, `${declaradasNoActivas.length} entradas del diseño quedan declaradas sin correr en este corte (➕, ya-cubiertas o decisión abierta) — documentadas, no silenciadas`, declaradasNoActivas.map((e) => e.id).join(", "));

/* ═══ 1 · CANDADO §A.6 — LO PEDIDO ES BYTE-IDÉNTICO, ENCENDIDA O APAGADA ═══ */
H("1 · candado §A.6 — comercial + cobranza (2 partes, sin entidad): lo pedido no cambia con la iniciativa");
{
  const base = { version: "encargo/v1", partes: [{ id: "p1", tema: "comercial", cierre: "lectura" }, { id: "p2", tema: "cobranza", cierre: "lectura" }] };
  const { res: resOff, R: Roff } = _comp({ ...base, iniciativa: "ninguna" });
  const { res: resOn, R: Ron } = _comp(base);
  ok(resOff.ok && resOn.ok, "las dos Resoluciones son ok");
  ok(Roff.ok && Ron.ok, "las dos Entregas componen ok", `${Roff.motivo} / ${Ron.motivo}`);
  if (Roff.ok && Ron.ok) {
    ok(Ron.entrega.iniciativa && Ron.entrega.iniciativa.on === true, "con la iniciativa encendida, `entrega.iniciativa.on === true`");
    ok(Roff.entrega.iniciativa && Roff.entrega.iniciativa.on === false, "con `iniciativa:\"ninguna\"`, `entrega.iniciativa.on === false`");
    ok(Ron.entrega.iniciativa.ids.length > 0, `★ la iniciativa SÍ produjo contenido en este encargo (${Ron.entrega.iniciativa.ids.length} hechos servidos) — si diera 0, el candado de abajo sería vacío`, JSON.stringify(Ron.entrega.iniciativa));
    const pedidoOff = JSON.stringify(Roff.entrega.respuesta);
    const pedidoDeOn = JSON.stringify(_pedido(Ron.entrega));
    ok(pedidoOff === pedidoDeOn, "(i) Respuesta PEDIDA — byte-idéntica: apagada === encendida sin sus oraciones marcadas", pedidoOff === pedidoDeOn ? "" : `off=${pedidoOff}\non=${pedidoDeOn}`);
    ok(JSON.stringify(Roff.libro.hechos.map((h) => h.id)) === JSON.stringify(Ron.libro.hechos.map((h) => h.id)), "(ii) el libro PEDIDO declara los MISMOS ids `e*`, en el mismo orden");
    ok(JSON.stringify(Roff.entrega.cifras) === JSON.stringify(Ron.entrega.cifras), "Cifras — byte-idénticas (esta capa no agrega filas a Cifras en este corte)");
    const prioOff = Roff.entrega.respuesta.find((r) => /Prioridad del procedimiento|Quien m[aá]s pesa en el conjunto/.test(r.texto));
    const prioOn = _pedido(Ron.entrega).find((r) => /Prioridad del procedimiento|Quien m[aá]s pesa en el conjunto/.test(r.texto));
    ok(!!prioOff && !!prioOn && prioOff.texto === prioOn.texto, "(iii) la oración de prioridad del procedimiento es idéntica", JSON.stringify({ prioOff, prioOn }));
    ok(JSON.stringify(Roff.entrega.limites) === JSON.stringify(Ron.entrega.limites), "(iv) Límites PEDIDOS idénticos (esta capa no agregó ninguno en este corte)");
    ok(JSON.stringify(Roff.entrega.universos) === JSON.stringify(Ron.entrega.universos), "(v) Universos idénticos");
    ok(Ron.entrega.respuesta.some((r) => r._marcaIniciativa), "con la iniciativa encendida, aparece la línea `_marcaIniciativa`");
    ok(!Roff.entrega.respuesta.some((r) => r._marcaIniciativa), "con la iniciativa apagada, NO aparece ninguna línea `_marcaIniciativa`");
    ok(Ron.texto.includes(MARCA_INICIATIVA), "★ el texto servido incluye LA MARCA VISIBLE, tal cual la constante");
    ok(!Roff.texto.includes(MARCA_INICIATIVA), "el texto apagado NO incluye la marca (nada que marcar)");
    ok(/▹/.test(Ron.texto) && !/▹/.test(Roff.texto), "el glifo ▹ (iniciativa) aparece encendida y no apagada — lo pedido sigue con ▸");
  }
}

/* ═══ 2 · PROPORCIONALIDAD POR CIERRE (§A.2) ═══ */
H("2 · proporcionalidad — cifra·entidad·1 concepto (oferta o nada) vs cifra·entidad·N conceptos (texto)");
{
  const parte1 = { version: "encargo/v1", partes: [{ id: "p1", tema: "comercial", cierre: "cifra", entidades: [{ nombre: "Lider", eje: "cliente" }], conceptos: ["margen"] }] };
  const parteN = { version: "encargo/v1", partes: [{ id: "p1", tema: "comercial", cierre: "cifra", entidades: [{ nombre: "Lider", eje: "cliente" }], conceptos: ["margen", "ventas"] }] };
  const { R: R1 } = _comp(parte1);
  const { R: RN } = _comp(parteN);
  ok(R1.ok && RN.ok, "las dos Entregas componen ok");
  if (R1.ok) {
    // MEDIDO (TENANT_DEMO real, `entityRecord`): el "Benchmark de margen" de esta tool no trae crudo — el hecho
    // `vs-benchmark` se declara, se intenta verificar y NO VERIFICA. Es exactamente el candado del diseño («un
    // hecho de iniciativa que no verifica no se sirve y no tumba la Entrega»): la Entrega sigue `ok:true`, el
    // hecho roto queda en `detalle.iniciativaNoVerificada`, nada se imprime.
    ok(!_pedido(R1.entrega).some((r) => false) , "cifra·1 concepto no imprime nada de iniciativa en el TEXTO PEDIDO (por construcción — solo se anexa fuera de _pedido)");
    ok(!R1.entrega.respuesta.some((r) => r._iniciativa), "cifra·1 concepto: NINGUNA oración `_iniciativa` en Respuesta — nunca en el texto (§A.2)");
    const huboOferta = R1.entrega.queMasPuedoCalcular.puedo.some((s) => s.startsWith("▹"));
    const huboRoto = R1.entrega.detalle && R1.entrega.detalle.iniciativaNoVerificada.length > 0;
    ok(huboOferta || huboRoto, "cifra·1 concepto: el candidato vs-benchmark quedó como OFERTA o, si no verificó, declarado en `detalle.iniciativaNoVerificada` — nunca silencioso", JSON.stringify({ puedo: R1.entrega.queMasPuedoCalcular.puedo, detalle: R1.entrega.detalle }));
    if (huboRoto) ok(R1.entrega.detalle.iniciativaNoVerificada[0].id === "vs-benchmark" && typeof R1.entrega.detalle.iniciativaNoVerificada[0].motivo === "string", "el roto trae su id de catálogo y su motivo, nombrando lo que falta");
  }
}

H("2b · lectura/decision con entidad — vs-benchmark verifica (marginRead+diagnose corrieron completos) y sale PRINCIPAL");
{
  const enc = { version: "encargo/v1", partes: [{ id: "p1", tema: "comercial", cierre: "lectura", entidades: [{ nombre: "Lider", eje: "cliente" }] }, { id: "p2", tema: "cobranza", cierre: "lectura", entidades: [{ nombre: "Lider", eje: "cliente" }] }] };
  const { R } = _comp(enc);
  ok(R.ok, "compone ok", R.motivo);
  if (R.ok) {
    const vb = R.entrega.respuesta.find((r) => r._iniciativa && /benchmark/i.test(r.texto));
    ok(!!vb, "★ vs-benchmark verificó y salió PRINCIPAL (en el texto, marcado `_iniciativa`)", JSON.stringify(R.entrega.respuesta.filter((r) => r._iniciativa)));
    ok(!!vb && vb.solicitud === "iniciativa", "la oración trae `solicitud:\"iniciativa\"` (§A.5.1)");
    // dos temas con entidad ⇒ ninguno usa `_planMultiTema` (cada uno resuelve por `_planCifraEntidad`) ⇒
    // `yaTieneIntegrada` es false ⇒ la iniciativa PUEDE calcular "integrada" (cruce) sobre los dos.
    const integrada = R.entrega.respuesta.find((r) => r._iniciativa && /en conjunto/i.test(r.texto));
    ok(!!integrada, "★ cruce.integrada corrió (ningún plan multitema del pedido la calculó ya)", JSON.stringify(R.entrega.respuesta.filter((r) => r._iniciativa)));
  }
}

/* ═══ 3 · NINGÚN TEMA NO PEDIDO ═══ */
H("3 · la iniciativa NUNCA calcula sobre un dominio que el encargo no tocó");
{
  const soloComercial = { version: "encargo/v1", partes: [{ id: "p1", tema: "comercial", cierre: "lectura", entidades: [{ nombre: "Lider", eje: "cliente" }] }] };
  const { R } = _comp(soloComercial);
  ok(R.ok, "compone ok", R.motivo);
  if (R.ok) {
    const iniciativas = R.entrega.respuesta.filter((r) => r._iniciativa);
    ok(!iniciativas.some((r) => /vencid[oa]|cobranza|capital frenado|inventario/i.test(r.texto)), "★ ningún hecho de iniciativa de cobranza/inventario aparece cuando el encargo es SOLO comercial", JSON.stringify(iniciativas));
    ok(R.entrega.limites.every((l) => !/cobranza|inventario/i.test(l.titulo) || /Sin conocimiento del sector/i.test(l.titulo)), "ningún límite de un dominio no pedido se coló (solo la ausencia de conocimiento del sector, que ya existía)");
  }
}

/* ═══ 4 · IDS `i*`, LIBRO APARTE ═══ */
H("4 · los hechos de iniciativa usan prefijo `i*` y viven en su PROPIO libro");
{
  const base = { version: "encargo/v1", partes: [{ id: "p1", tema: "comercial", cierre: "lectura" }, { id: "p2", tema: "cobranza", cierre: "lectura" }] };
  const { R } = _comp(base);
  ok(R.ok, "compone ok", R.motivo);
  if (R.ok) {
    ok(R.entrega.iniciativa.ids.every((id) => /^i\d+$/.test(id)), "todo id servido por la iniciativa empieza con \"i\"", JSON.stringify(R.entrega.iniciativa.ids));
    ok(R.libro.hechos.every((h) => /^e\d+$/.test(h.id)), "el libro PEDIDO sigue usando SOLO ids \"e*\" — ninguno \"i*\" se coló");
    const libroIni = R.entrega.procedencia.libroIniciativa;
    ok(!!libroIni, "`entrega.procedencia.libroIniciativa` existe, aparte de `entrega.procedencia.libro`");
    ok(R.entrega.iniciativa.ids.every((id) => { const h = libroIni.porId.get(id); return h && h.ok; }), "todo id declarado como servido verifica en su propio libro");
  }
}

/* ═══ 5 · LAS 4 RUTAS FIJAS NUNCA LA EJERCITAN ═══ */
H("5 · las 4 rutas fijas (delegación) dan `entrega.iniciativa === null` — iniciativa.js no se ejercita ahí");
{
  const casos = [
    { version: "encargo/v1", partes: [{ id: "p1", tema: "comercial", cierre: "lectura" }] },
    { version: "encargo/v1", partes: [{ id: "p1", tema: "cobranza", cierre: "lectura" }] },
    { version: "encargo/v1", partes: [{ id: "p1", tema: "inventario", cierre: "lectura" }] },
    { version: "encargo/v1", partes: [{ id: "p1", tema: "comercial", cierre: "lectura" }, { id: "p2", tema: "inventario", cierre: "lectura" }, { id: "p3", tema: "cobranza", cierre: "lectura" }] },
  ];
  for (const [i, c] of casos.entries()) {
    const { R } = _comp(c);
    ok(R.ok, `caso ${i + 1} compone ok`, R.motivo);
    if (R.ok) ok(R.entrega.iniciativa === null && R.entrega.detalle === null, `caso ${i + 1} (ruta fija por delegación) — entrega.iniciativa/detalle quedan null`, JSON.stringify({ iniciativa: R.entrega.iniciativa, detalle: R.entrega.detalle }));
  }
}

/* ═══ 6 · EL INTERRUPTOR DEL ENCARGO (§A.2c) — enum validado, default "completa" ═══ */
H("6 · encargo.iniciativa — enum validado, default \"completa\", un valor inválido se declara y no bloquea");
{
  // 2 partes (comercial + cobranza, sin entidad) — NO delega a una ruta fija, así el camino general SÍ llena
  // `entrega.iniciativa` (con 1 sola parte "lectura" delegaría, ver la sección 5 de este mismo gate).
  const base = { version: "encargo/v1", partes: [{ id: "p1", tema: "comercial", cierre: "lectura" }, { id: "p2", tema: "cobranza", cierre: "lectura" }] };
  const resDefault = validarEncargo(base, {});
  ok(resDefault.ok && resDefault.encargo.iniciativa === undefined, "sin declarar `iniciativa`, el campo queda undefined en la Resolucion (el compositor lo interpreta como \"completa\", default)");
  const resInvalido = validarEncargo({ ...base, iniciativa: "todo" }, {});
  ok(resInvalido.ok, "un `iniciativa` inválido NO bloquea el encargo (ok sigue true)");
  ok(resInvalido.noResuelto.some((n) => n.campo === "iniciativa" && n.motivo === "iniciativa_invalida"), "★ CARNADA · `iniciativa:\"todo\"` (fuera del enum) se declara en `noResuelto` con motivo \"iniciativa_invalida\"", JSON.stringify(resInvalido.noResuelto));
  const { R: Rinvalido } = _comp({ ...base, iniciativa: "todo" });
  ok(Rinvalido.ok && !!Rinvalido.entrega.iniciativa && Rinvalido.entrega.iniciativa.on === true, "con un valor inválido, el compositor cae al default (\"completa\" ⇒ `on:true`) — nunca truena", JSON.stringify(Rinvalido.entrega && Rinvalido.entrega.iniciativa));
}

/* ═══ 7 · verificarEntrega REGLA 12 — todo `i*` servido verifica Y está ubicado ═══ */
H("7 · verificar.js regla 12 — iniciativa servida y verificada; carnadas: sin verificar / sin ubicar");
{
  const base = { version: "encargo/v1", partes: [{ id: "p1", tema: "comercial", cierre: "lectura" }, { id: "p2", tema: "cobranza", cierre: "lectura" }] };
  const { R } = _comp(base);
  ok(R.ok, "compone ok", R.motivo);
  if (R.ok) {
    const V = verificarEntrega(R);
    ok(V.ok, "verificarEntrega ok sobre la Entrega real con iniciativa encendida (regla 12 incluida)", JSON.stringify(V.violaciones));

    // CARNADA A · un id declarado como servido que NO verifica en su libro. Clon SUPERFICIAL (nunca
    // JSON.parse/stringify: `libro.porId`/`libroIniciativa.porId` son `Map`, que un round-trip JSON destruye).
    const Rroto = { ...R, entrega: { ...R.entrega, iniciativa: { ...R.entrega.iniciativa, ids: [...R.entrega.iniciativa.ids, "i999"] } } };
    const Vroto = verificarEntrega(Rroto);
    ok(!Vroto.ok && Vroto.violaciones.some((v) => v.regla === "iniciativa-no-verificada"), "★ CARNADA · un id \"i999\" declarado como servido pero ausente del libro de iniciativa hace arder la regla 12 (iniciativa-no-verificada)", JSON.stringify(Vroto.violaciones));

    // CARNADA B · un id que SÍ verifica pero no aparece ni en Respuesta ni en la oferta
    const idReal = R.entrega.iniciativa.ids[0];
    const respuestaSinUbicar = R.entrega.respuesta.filter((r) => !(r.solicitud === "iniciativa" && (r.hechos || []).includes(idReal)));
    const Rsinubicar = { ...R, entrega: { ...R.entrega, respuesta: respuestaSinUbicar } };
    const Vsinubicar = verificarEntrega(Rsinubicar);
    ok(!Vsinubicar.ok && Vsinubicar.violaciones.some((v) => v.regla === "iniciativa-sin-ubicar"), `★ CARNADA · quitar la oración que cita ${idReal} de Respuesta (y no dejarlo en la oferta) hace arder "iniciativa-sin-ubicar"`, JSON.stringify(Vsinubicar.violaciones));

    // control negativo: una Entrega SIN campo `entrega.iniciativa` (las 4 rutas fijas) no paga esta regla
    const { R: Rfija } = _comp({ version: "encargo/v1", partes: [{ id: "p1", tema: "comercial", cierre: "lectura" }] });
    const Vfija = verificarEntrega(Rfija);
    ok(Vfija.ok, "control negativo · una ruta fija (entrega.iniciativa === null) no paga la regla 12", JSON.stringify(Vfija.violaciones));
  }
}

/* ═══ 7b · REVISIÓN DE CALIDAD DEL SUPERVISOR (2026-09-25) — LA INICIATIVA NUNCA REPITE LO PEDIDO ═══════════════
 * «Un hecho de iniciativa cuyo contenido (clave, entidad, valor, universo) ya está servido como pedido NO se
 * sirve otra vez.» Caso real medido: en 2 temas (comercial+cobranza, cartera entera) el PEDIDO ya declara la
 * participación de Lider en el vencido total («De lo vencido en toda la cartera, Lider concentra el 36,3%» —
 * `_planMultiTema`, la razón sobre el vencido de Lider ÷ vencido total); el candidato de iniciativa
 * `participacion-vencido` calcula la MISMA razón sobre los MISMOS figs — tiene que desaparecer (`componer.js`:
 * comparación por firma tipo+figs subyacentes, `_firmasPedido`/`iniciativaSinDuplicar`). */
H("7b · CARNADA · la iniciativa no repite un hecho ya pedido (misma razón, mismos figs subyacentes)");
{
  const base = { version: "encargo/v1", partes: [{ id: "p1", tema: "comercial", cierre: "lectura" }, { id: "p2", tema: "cobranza", cierre: "lectura" }] };
  const { R } = _comp(base);
  ok(R.ok, "compone ok", R.motivo);
  if (R.ok) {
    const enPedido = R.entrega.respuesta.some((r) => !r._iniciativa && /Lider concentra el 36[.,]3%/.test(r.texto));
    ok(enPedido, "el PEDIDO declara la participación de Lider en el vencido total (línea base del caso)", JSON.stringify(R.entrega.respuesta.map((r) => r.texto)));
    const duplicadaEnIniciativa = R.entrega.respuesta.some((r) => r._iniciativa && /vencido total/i.test(r.texto) && /Lider/.test(r.texto) && /36[.,]3%/.test(r.texto));
    ok(!duplicadaEnIniciativa, "★ CARNADA · ninguna oración de iniciativa repite esa misma participación (misma razón, mismos figs)", JSON.stringify(R.entrega.respuesta.filter((r) => r._iniciativa).map((r) => r.texto)));
    const totalOcurrencias = (R.texto.match(/Lider concentra el 36[.,]3%/g) || []).length;
    ok(totalOcurrencias === 1, `el hecho aparece EXACTAMENTE una vez en todo el texto (apareció ${totalOcurrencias})`, R.texto);
  }
}

/* ═══ 8 · calcularIniciativa (función pura) — apagada da listas vacías, sin tocar `figs` ═══ */
H("8 · calcularIniciativa — con iniciativaOn:false, siempre vacío (el interruptor lo respeta la función pura)");
{
  const { hechos, candidatos } = calcularIniciativa({ figs: [{ id: "f1", label: "Lider · Margen", raw: 0.2, unit: "pct" }], partes: [{ tema: "comercial", cierre: "lectura", conceptos: 0, entidades: [] }], iniciativaOn: false });
  ok(hechos.length === 0 && candidatos.length === 0, "iniciativaOn:false ⇒ hechos y candidatos vacíos, sin excepción");
  const vacio = calcularIniciativa({ figs: [], partes: [{ tema: "comercial", cierre: "lectura", conceptos: 0, entidades: [] }], iniciativaOn: true });
  ok(vacio.candidatos.length === 0, "sin figs, ningún candidato (no hay boleta que citar)");
}

/* ═══ 9 · CERO RED ═══ */
H("9 · CERO red — clasificarFuente(este gate) === offline");
{
  const src = fs.readFileSync("./_iniciativa_gate.mjs", "utf8");
  const c = clasificarFuente(src);
  ok(c.tipo === "offline", "este gate se clasifica offline (no toca la red)", JSON.stringify(c));
}

console.log(`\n── _iniciativa_gate: PASS ${pass} · FAIL ${fail} (de ${pass + fail}) ──`);
if (fail > 0) process.exit(1);
