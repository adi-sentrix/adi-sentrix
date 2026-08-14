# Informe · «Ventas» como volumen + candado de promesas de la guía

**Worktree** `claude/priceless-raman-0c69a1` sobre `dev` (aaf3400) · commits locales, sin push · 2026-08-14 (encargo del owner: opción «Enseñar ventas + candado de la guía»).

---

## 1 · Diagnóstico (confirmado contra el código, coincide con el del arquitecto)

La guía de inicio ofrece con un click **«Si subo ventas 4%, ¿qué cambia?»** (`GuiaInicio.jsx`, tema Simulación). No es chip de `HERO_CHIPS`: su spec se deriva de `coerceFloor`. Pero con el **oráculo encendido —que es producción hoy— todo ejemplo de la guía viaja como texto libre**: `submitSpec` degrada a `submit(q)` (ChatADI.jsx), así que el spec derivado no protege nada en la vía viva. En esa vía, el único piso pre-PLAN para simulaciones es `detectScenarioIntent` (scenarioIntent.js), y su vocabulario de volumen era `/\bvolumen\b|\bunidades\b/` — «ventas» devolvía `{kind:"none"}` → el turno quedó a merced de PLAN (Haiku), que no corrió la simulación → «No tengo corrida esa simulación».

Dato que refuerza la decisión: el guard de pertinencia del pendiente (`_VOCAB_FALTANTE.unidades`, answerViaOracle.js) **ya trataba «ventas»/«vendo»/«vendemos» como sinónimos de volumen desde 2026-08-11** cuando el usuario *contesta* la variable faltante. El turno fresco era el único que no compartía esa interpretación. Este cambio los alinea.

## 2 · Qué se cambió

### 2a · Vocabulario (`src/adi/oracle/scenarioIntent.js`)

- **`ventas`/`venta` + stems de vender** cuentan como campo volumen (`unidades`). Stems reconocidos: formas presentes/hipotéticas (vendo, vendemos, vende, venden, vender, vendiera, vendería, vendiendo…). **Excluidos**: `vendedor` (sujeto, no variable) y el pasado de vender (vendí/vendió/vendimos/vendiste/vendieron — lectura, no supuesto).
- **`vendió`/`vendieron` se sumaron a `_PAST_3RD_RE`**: «se vendieron 4% menos unidades este mes» era un hueco *preexistente* (disparaba por «unidades»); ahora es `historical`.
- **«N% más» postfijo cerrando la cláusula** («vendo 4% más», «vendo 4% más, ¿qué cambia?») resuelve dirección arriba. Deliberadamente estrecho: «4% más que el año pasado» o «5% más altas que el benchmark» son comparaciones → siguen ambiguas → `none`. «menos» ya era palabra direccional global; no necesitó espejo.
- **La XOR sigue intacta**: «subo precio y ventas 4%» → `null` → PLAN decide (criterio explícito del owner).
- **Guardia causal nueva**: `¿por qué …?` → `{kind:"none"}` (PLAN explica). Motivo: el filtro de pasado no alcanza a la causal en *presente* («¿por qué caen las ventas 8%?»), y «ventas» aparece seguido en causales. Protege de paso a «precio»/«volumen», que tenían la misma grieta menos expuesta. Con `"none"` el módulo solo *se aparta* — no bloquea nada, PLAN corre normal.
- **Carve-out «ventas como resultado preguntado»**: en «¿qué pasa con las ventas si subo el precio 5% a Lider?», «ventas» nombra lo que se quiere *ver*, no la variable. Sin el carve-out, la XOR anularía el piso que **precio ya tenía** para esa frase natural (medido: hoy da `future precio +5`; con XOR pelada daría `none`). Se podan solo cabezas interrogativas **direccionalmente neutras** («qué pasa con» / «cómo quedan» / «cuánto cambian» + ventas). «¿cuánto **caen** las ventas si subo el precio 5%?» NO se poda a propósito: su verbo direccional contaminaría el signo del precio (hoy esa frase ya resolvía mal el signo; ahora cae a `none`, que es más seguro que lo que había).
- La variable sale marcada **`via:"ventas"`** cuando el volumen entró solo por este vocabulario, para que el consumidor declare la interpretación. Los shapes persistidos (`pendingSimulation.known`, `pendienteDesdeEscenario`) podan la marca: nada nuevo viaja a memoria ni a las tools.

### 2b · Supuesto declarado (`src/adi/oracle/answerViaOracle.js`)

**Lo que ya existía y NO se duplicó** (verificado corriendo el circuito completo con mocks): el motor **nunca asume precios constantes en silencio** — pregunta «¿cuánto esperás que cambie el precio? No quiero asumir que se mantiene sin cambios, sin que me lo confirmes», y `simulateGeneral` recién corre con ambas variables confirmadas. La boleta declara **ambos** supuestos como figs autorizadas (`Precio propuesto 0%` · `Volumen propuesto 4%`) y cada fig lleva `context: "supuesto: precio +0% · volumen +4% sobre X (dato real)"`; el narrador está obligado a nombrar ambos (esas figs existen exactamente para eso, hallazgo 2026-07-31).

**El cambio mínimo que sí faltaba**: nada le decía al usuario que su «ventas» se leyó como *volumen*. Ahora, cuando la variable viene `via:"ventas"`, la respuesta del bypass abre con: *«Ese cambio en las ventas lo tomo como cambio de volumen (unidades vendidas), con el precio declarado aparte.»* — en los tres arms (`no_entity`, `future`, `future_multi`). El usuario puede corregir antes de que exista una cifra.

Medición del circuito completo (mocks, cero red): «Si subo las ventas 4% a Falabella» → declara interpretación + pregunta precio + `pendingSimulation {Falabella, unidades +4, falta precioLista}` → «el precio queda igual» → `simulateGeneral(precio 0, unidades +4)` sin invocar PLAN, boleta con los 2 supuestos declarados.

### 2c · Candado de promesas de la guía (`_guia_promesas_gate.mjs` + `_guia_promesas_gate_entry.jsx`, nuevos)

Gate permanente offline. Lee `_TEMAS` del fuente (no está exportado) y lo cruza con `GUIA_EJEMPLOS` (ninguna pregunta se cae en silencio, la guía no ofrece nada no declarado), y exige **garantía declarada por pregunta** en un mapa (`CANDADO`): una pregunta nueva en la guía sin entrada ahí pone el gate en rojo.

| Pregunta (tema) | Garantía | Qué afirma el gate |
|---|---|---|
| «¿Qué clientes venden mucho pero dejan poco margen?» (Comercial) | `coerce` | `coerceFloor` la reclama (`margin`/cliente) y el spec ofrecido es el derivado byte-exacto. Cubre la vía sin oráculo y el fallback con gateway caído. |
| «¿Dónde tengo capital inmovilizado?» (Capital) | `hero` | Chip curado en `HERO_CHIPS`, spec byte-exacto. Misma cobertura que el anterior. |
| «¿Cuánto me queda después de gastos?» (Resultado) | `hero` + `oraculo` | Chip curado **y** `detectPnlIntent` la reclama → con oráculo ON, ChatADI le **cede el paso** al flujo guiado del P&L (determinístico). El primer click nunca depende de PLAN. |
| «Si subo ventas 4%, ¿qué cambia?» (Simulación) | `coerce` + `oraculo` | `detectScenarioIntent` → `no_entity`, volumen **+4**, `via:"ventas"` (el piso del oráculo la reclama antes de PLAN — el fix de este turno) **y** `coerceFloor` la reclama como `simulate` para la vía sin oráculo. |

### 2d · Gate de escenario (`_scenario_intent_gate.mjs`, ampliado e incorporado a la suite)

- Sección **1h**: positivos y negativos exhaustivos de «ventas» (los criterios de aceptación completos, ver §4).
- Sección **3 e2e**: reproduce el defecto de la guía con PLAN mockeado — PLAN nunca se invoca, la respuesta declara la interpretación, el circuito de 2 turnos corre `simulateGeneral(precio 0 confirmado, volumen +4)` con la boleta declarando ambos supuestos; control: la causal con «ventas» SÍ invoca a PLAN.
- **Movimiento de suite**: este gate estaba **EXCLUIDO en silencio** de `gates:offline` (nombra `callPlan` para sus mocks → la trampa del clasificador). Sus mocks son exactamente una *inyección simulada*; cumplía las 4 condiciones del escape y solo faltaba declararlo → se le agregó `@inyeccion-simulada`. Antes de moverlo se analizó: fija **comportamiento** (kinds del detector, bypass, pendientes), no formato, y ninguna de sus aserciones viejas queda invalidada por el vocabulario nuevo (verificado caso por caso: los históricos con «ventas» eran pretéritos → siguen `historical`; los controles de XOR usan volumen+precio → siguen `none`).

## 3 · Decisiones tomadas en puntos no obvios (todas reversibles, ninguna tapa nada)

1. **Singular «venta» incluido** («si subo la venta 4%») — fraseo natural; los riesgos son los mismos que el plural (exige % + dirección + XOR + no-pasado + no-causal).
2. **Guardia causal `por qué` → none** — no estaba pedida literalmente, pero enseñar «ventas» sin ella convertía «¿por qué caen las ventas 8%?» (presente) en arranque de simulación. Es apartarse, nunca bloquear.
3. **Carve-out de resultado preguntado** — sin él, la XOR le quitaba a *precio* un piso que ya tenía en frases naturales («¿qué pasa con las ventas si subo el precio 5%?»). Estrecho y direccional-neutro; el caso con verbo direccional cae a `none` (más seguro que el comportamiento previo, que resolvía el signo mal).
4. **«más» NO entra como palabra direccional global** — solo el postfijo «N% más» cerrando cláusula. Un «más» global habría convertido comparaciones contra benchmark en supuestos. Consecuencia: «vendo 4% más que ahora» queda `none` (PLAN decide) — pérdida asumida y declarada.
5. **`@inyeccion-simulada` al gate de escenario** — ver §2d; alternativa era dejar los casos nuevos en un gate que no corre, o sea sin garantía.

**Consecuencia conocida de la XOR (para el owner):** «¿cuánto caen las ventas si subo el precio 5% a Lider?» perdía el piso de precio de todos modos por su verbo direccional; y cualquier frase que nombre ventas *como variable* junto a precio va a PLAN. Es el diseño que el owner pidió; si en vivo aparece un fraseo natural frecuente que cae ahí, el siguiente paso sería enseñárselo a PLAN (prompt), que este turno no toca.

## 4 · Criterios de aceptación — medidos

| Probe | Resultado |
|---|---|
| «Si subo ventas 4%, ¿qué cambia?» | `no_entity` · campo `unidades` · **+4** · `via:"ventas"` ✓ |
| «si subo el precio 4%» | `no_entity` · precio +4 — **byte-igual a hoy** ✓ |
| «subo precio y ventas 4%» | `none` (antes resolvía precio +4; el criterio del owner pide null) ✓ |
| «¿por qué cayeron las ventas 8%?» | `historical` — no simula ✓ |
| «las ventas subieron 4% este mes» | `historical` — no simula ✓ |
| Negativos extra | causal presente (`none`) · «vendimos 8% menos» (`none`) · «vendedor» (`none`) · «ventas 4%» sin dirección (`none`) · comparaciones «más que»/«más altas que» (`none`) · «se vendieron 4% menos unidades» (`historical`, hueco preexistente cerrado) ✓ |

## 5 · Suite

`npm run gates:offline` completo: **145 PASS · 0 FAIL · 0 TOCARON LA RED · 0 CON CREDENCIAL VIVA (de 145 offline)** — el conteo subió de 143 a **145** (+`_guia_promesas_gate` nuevo 30/30, +`_scenario_intent_gate` incorporado 61/61), verificado que ambos aparecen corridos y en verde (la trampa del clasificador quedó descartada mirando el conteo y la lista de corridos, no solo el exit code). `_guia_inicio_gate` 126/126 y `_pendiente_secuestro_por_sinonimo_gate` 58/58 siguen verdes — ningún gate viejo roto. Cero llamadas a proveedor/gateway en todo el turno (probes y gates con PLAN/NARRAR inyectados o módulos puros).

## 6 · Hallazgos reportados SIN tocar

1. **🔴 Comercial y Capital no tienen garantía en la vía oráculo viva.** Con oráculo ON (producción), «¿Qué clientes venden mucho pero dejan poco margen?» y «¿Dónde tengo capital inmovilizado?» viajan como texto libre a PLAN: ningún piso determinístico del oráculo las reclama. Su garantía actual (spec/coerce) cubre solo la vía sin oráculo y el fallback. El candado lo deja **medible** (sección 3 del gate: si algún día un piso las reclama, avisa para promover la garantía). Mismo patrón del defecto de esta guía; PLAN las resuelve bien hoy, pero es la clase de promesa sin piso que el owner señaló. Candidato natural: La Poda / un coerce pre-PLAN de lecturas.
2. **PLAN no conoce «ventas = volumen» en frases de 2 variables.** «subo precio 4% y ventas 2%» va a PLAN por diseño (XOR); si PLAN mapea mal «ventas», este turno no lo cubre — los prompts de ADI no se tocaron (fuera del encargo).
3. **`submitSpec` degrada TODO chip a texto libre con oráculo ON** (ChatADI.jsx, decisión 2026-07-28 «los chips bien conectados al LLM»). Es la raíz estructural por la que un spec curado no garantiza nada en producción. No se tocó; si se quisiera garantía dura para los chips de lectura, la decisión es de producto (¿chip = spec enlatado aun con oráculo?).
4. **Header stale en `_pendiente_secuestro_por_sinonimo_gate.mjs`** («LOCAL, NO commiteado») — la convención real es que los gates se commitean (205 trackeados). No se tocó por no ser del encargo.
5. **Legacy intacto**: `coerceFloor` ya reclamaba la pregunta de la guía como `simulate` (por eso la vía sin oráculo respondía); no se tocó nada del camino spec/answerADIFromSpec.

## 7 · Archivos del commit

- `src/adi/oracle/scenarioIntent.js` — vocabulario ventas/vender, pasado de vender, postfijo «% más», guardia causal, carve-out de resultado, marca `via`.
- `src/adi/oracle/answerViaOracle.js` — `_avisoVentasComoVolumen` en los 3 arms; `known` normalizado (poda `via`).
- `_scenario_intent_gate.mjs` — secciones 1h y 3 e2e; `@inyeccion-simulada`.
- `_guia_promesas_gate.mjs` + `_guia_promesas_gate_entry.jsx` — el candado nuevo.
- `_INFORME_VENTAS_SIMULACION.md` — este informe.
