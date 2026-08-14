# Informe · El alcance heredado y el delta declarado sobre la carga

**Encargo:** cerrar el hilo canónico del owner medido en la corrida doble (2026-08-14).
**Base:** `dev` = `2f4d83a`. Worktree `adoring-moser-06d535`, rama `claude/hungry-davinci-360233`. Commits locales, sin push.
**Suite:** 151 → **152 gates**, 0 FAIL, 0 red. `_constitucion_matriz_gate` sigue en 20/20.

---

## 1 · La conclusión, primero

El turno 2 del hilo canónico ahora responde **el escenario que el usuario pidió**, no otro parecido:

> **El supuesto (tuyo):** reducir la carga comercial en 2 puntos porcentuales. Interpreto ese movimiento como 2.0pp de carga (Falabella: 4.5% → 2.5%), no como un recorte relativo del 2% (que dejaría esa carga en 4.41%). Es un resultado estimado bajo tu supuesto —una proyección, no un dato observado.
>
> **El efecto directo:** bajo ese supuesto se liberan $1.3M al año — el cálculo es (carga actual − carga supuesta) × la venta de cada cuenta, cuenta por cuenta.
>
> **Contra el benchmark, cuenta por cuenta:** Falabella 22.0% + 2.0pp = 24.0% — sigue bajo el benchmark 30.1% por 6.1pp · Lider 21.5% + 2.0pp = 23.5% — sigue bajo el benchmark 30.1% por 6.6pp · Jumbo 24.0% + 2.0pp = 26.0% — sigue bajo el benchmark 30.1% por 4.1pp · Sodimac 23.5% + 2.0pp = 25.5% — sigue bajo el benchmark 30.1% por 4.6pp.

Es, línea por línea, el caso canónico que la constitución fija en «Simulación heredando alcance».

Reproducido offline con el hilo completo (turno 1 real, turno 2 con PLAN mockeado), el brazo natural pasó el muro **en el primer intento, cero vetos**. Y bajo `results_only` —sin narrador— la composición determinística sirve el margen resultante y la brecha **de las cuatro cuentas**.

---

## 2 · La aritmética carga→margen, con su evidencia

El encargo pedía verificarla contra el dato, no asumirla. **Es 1:1 exacta**, y la razón es estructural, no una coincidencia del demo.

En `clientesMargen`, medido sobre las 13 filas:

| Identidad | Resultado |
|---|---|
| `contribucion = venta − costo − rebates` | **exacta, 13/13** |
| `margen% = contribucion / venta × 100` | **exacta, 13/13** |
| `carga% (pctRebate) = rebates / venta × 100` | exacta salvo el redondeo a 1 decimal de 5 filas (Falabella 4.5027→4.5 · Sodimac 5.3974→5.4 · Mercado Libre 1.8077→1.8 · La Polar 3.8929→3.9 · Hites 3.6154→3.6) |

Margen y carga son **dos razones sobre la misma venta**, y los rebates entran en la contribución con coeficiente −1. Por eso bajar la carga X puntos sube el margen exactamente X puntos.

**Recomputado desde los campos crudos** (no desde la creencia): `rebates − 2%×venta → contribución → margen` da el mismo número que `margen + 2` en **las 13 filas, sin una sola excepción**. Está fijado en la sección 3 del gate nuevo, que recorre el dato en vivo — si el dataset cambia y la identidad deja de sostenerse, el gate se pone rojo antes de que la afirmación salga a pantalla.

> Si la relación **no** hubiera sido exacta, la respuesta correcta habría sido afirmar solo lo que el dato sostiene. Lo es, así que el veredicto sobre/bajo benchmark se **afirma**, no se estima.

### 2b · Las dos bases de venta — PUNTO DE FRENO, decisión del arquitecto

Al verificar lo anterior apareció algo que **no es de este encargo y es preexistente**, pero que hay que declarar porque toca la cifra en $:

- El **$ del movimiento** sale de `clientesVentas.actual` — la venta oficial de la cuenta, y el **mismo multiplicador que el detector de carga y el modo target usan desde siempre** (Falabella: $19.433K).
- El **efecto en puntos** vive en el libro de margen, cuya venta es `clientesMargen.venta` (Falabella: $18.500K).

Son **dos bases distintas, ~5,0% aparte**. Consecuencias exactas:

- Dividir el $ por la base del libro de margen daría **2.101pp** donde el dato sostiene **2.000pp** — una aproximación presentada como resultado. **El motor no hace esa división**: cada cifra lleva su fórmula con su base nombrada, y ninguna se deriva de la otra. Hay un chequeo del gate dedicado a esto.
- El corolario incómodo: `$389K` (base oficial) es **~5% mayor** que la ganancia real de contribución en el libro de margen (`2% × $18.500K = $370K`). **Esto ya pasaba en el modo target** desde siempre: «$194K recuperables» en Falabella son, en el libro de margen, $185K.

**Frené acá.** Las opciones, para el arquitecto/owner:

| | Qué implica |
|---|---|
| **(a) Dejarlo como está** (lo implementado) | Una sola base de $ en toda la tool, byte-consistente con `diagnose`/`mechanisms` y con los gates existentes. El $ sobreestima la ganancia de contribución ~5%, igual que hoy en producción. |
| **(b) Pasar el $ del modo delta a la base del libro de margen** | El $ sería exactamente la ganancia de contribución. Pero la MISMA cuenta tendría un $ distinto según el modo, dentro de la misma tool. |
| **(c) Reconciliar las dos bases en el contrato de datos** | Cierra el problema de raíz, para `diagnose`/`simulateCarga`/la Mesa a la vez. Es un trabajo de contrato, no de esta tool, y mueve cifras que hoy están en producción. |

Elegí **(a)** para no introducir un segundo criterio en una tool que ya tenía uno, y porque cambiar el $ del modo target rompe gates vigentes. Queda declarado, no escondido.

> Nota: `viewManifest.js` ya documenta una divergencia hermana («piso de materialidad de $50.000 … DECISIÓN DE OWNER PENDIENTE»). Las dos son la misma familia: el detector de carga y el libro de margen no comparten universo. Si el owner abre (c), conviene cerrarlas juntas.

---

## 3 · Qué cableé y qué construí

### Cableado (ya existía — lo verifiqué y le puse candado, no lo dupliqué)

**El alcance heredado llega solo.** Medido end-a-end: `marginRead` (turno 1) → `buildEntityList` lee los labels de la boleta → `conversationScope.current.entities = ["Falabella","Lider","Jumbo","Sodimac"]` → `resolveConversationReference` resuelve «esos clientes» → `applyMultiEntityScope` (la tool declara `entityScopeNativo: true`) → `simulateCarga({entityScope:{entities:[...4]}})` → `_scopeRows`.

**Cero líneas nuevas en ese camino.** Los args reales que llegan a la tool:

```
{"delta_pp":-2,"entityScope":{"entities":["Falabella","Lider","Jumbo","Sodimac"]},"scenario":"actual"}
```

La sección 1 del gate lo fija capturando los args que efectivamente llegaron, no simulándolos.

### Construido

1. **El segundo modo de la tool** (`specRetrieval.js`, `_simulateCargaDelta`). `composeSpecSimulateCarga` gana `deltaPp`; sin él, el modo target de siempre. Por cuenta: carga actual → carga supuesta, margen resultante, veredicto sobre/bajo benchmark, brecha, y el $ del movimiento.
2. **El arg de la tool** (`toolRegistry.js`): `simulateCarga{delta_pp}`, con el patrón `unsupported` de `simulateCosto` para declinar con motivo.
3. **El candado determinístico anti-invención** (`answerViaOracle.js`, `_coerceDeltaCargaDeclarado`). Ver §4.
4. **La línea del catálogo de PLAN** (`planPrompt.js`), 620 caracteres. Ver §6.
5. **El gate permanente** `_carga_delta_alcance_gate.mjs` — 51 chequeos, 7 secciones.

### Decisión de diseño que conviene mirar: el modo delta NO reusa el detector de carga

El modo target reusa `composeSpecDiagnose`, cuyo detector filtra por dos gates: `carga > POLICY.targetCarga` y `recuperable ≥ $50K`. **Ninguno de los dos es propiedad de un delta que el usuario declaró.** Reusarlo habría hecho desaparecer en silencio cualquier cuenta del alcance con carga bajo el target o con monto chico — el mismo defecto de sustituir el alcance, una capa más abajo. El universo del modo delta son las cuentas **del alcance**, sin más gate que tener carga en el dato. Medido y fijado en el gate: Unimarc (carga 3.0%, bajo el target) y Ripley ($47K, bajo el piso) sí responden.

---

## 4 · El negativo: un delta que el usuario no declaró jamás se ejecuta

`delta_pp` es el único arg del catálogo cuyo valor sale enteramente de la conversación. Si PLAN se lo inventa, ADI narra un escenario ajeno **con la marca de «tu supuesto» encima** — la misma clase de falla que el freno anti-simulación-ajena cierra para la *tool*, cerrada acá para el *argumento*. No queda en manos del prompt: es determinístico, en la misma familia que el resto de los `_coerce*`.

| Turno del usuario | PLAN emite | Qué pasa |
|---|---|---|
| «reduce en 2 puntos…» | `delta_pp:-2` | corre tal cual |
| «¿y si bajamos las acciones comerciales?» (sin cifra) | `delta_pp:-2` | **se despoja** → cae al modo target de siempre · `delta-carga-no-declarado(-2)` |
| «reduce en 2 puntos…» | `delta_pp:-5` | **se despoja** — magnitud que el usuario no dio |
| «reduce en 2 puntos…» | `delta_pp:2` | **se corrige el signo** por el verbo del usuario · `delta-carga-signo(2→-2)` |
| «reduce en **dos** puntos…» | `delta_pp:-2` | corre — el numeral en letras también respalda |
| «¿cuáles tienen 2 rebates activos?» | `delta_pp:-2` | **se despoja** — un «2» sin puntos/pp/% no es una magnitud de movimiento |

El peor caso de esta prudencia es responder **lo mismo que respondía ayer**; nunca inventar.

**Alcance deliberado (declarado):** se mira el texto de **este** turno, mismo criterio que `_esSimulacionAjenaSinPedido`. Un delta declarado en un turno anterior no se hereda todavía. Es una restricción, no un bug: como el default es el modo target, un follow-up tipo «¿y en Jumbo?» responde el escenario del target en vez del −2pp heredado. Si el owner lo quiere, la extensión natural es guardarlo en `conversationScope.supuestos` (donde ya vive el supuesto del usuario) — no lo hice porque abre la puerta a heredar un supuesto muerto, que es un riesgo mayor que el que cierra.

**Fuera de rango.** `|delta_pp| > 20pp` o `= 0` **declinan con el motivo dicho**, nunca recortan en silencio ni caen al target: un delta absurdo respondido con otro escenario sería exactamente el defecto original.

**Piso en cero.** Una carga no puede quedar negativa. Con −3pp, Mercado Libre (carga 1.8%) baja 1.8pp efectivos y **el texto lo dice**: «en Mercado Libre la baja efectiva es de 1.8pp, no 3: su carga hoy es 1.8% y no puede quedar negativa».

---

## 5 · La regla del 2% (constitución)

«Reduce en 2 puntos» es inequívoco → **se ejecuta declarando la interpretación**. No dupliqué el chequeo `ambiguedad-no-declarada` del notario: me aseguré de que la boleta permita cumplirlo, y fui un paso más allá.

- El opener **declara siempre** la lectura elegida («interpreto ese movimiento como 2.0pp de carga»), venga el pedido en «puntos» o en «%».
- Y **calcula la lectura descartada**: «no como un recorte relativo del 2% (que dejaría esa carga en 4.41%)» — que es, literalmente, el caso canónico de la constitución (`4.5% × 0.98 = 4.41%`). Viaja **autorizada en la boleta** (`Lectura relativa descartada · Falabella = 4.41%`), así que el narrador puede citarla y el notario verificarla.

Verificado contra `guardC` en vivo: la cuenta a la vista «22.0% + 2.0pp = 24.0%» **pasa el muro** por el camino que ya existía (`_rePP` recomputa y exige que los puntos vengan del usuario). No hizo falta tocar el muro.

---

## 6 · Los tres presupuestos de prompt que subí — cost decision, reversible

La línea nueva del catálogo cuesta **620 caracteres (~155 tokens por llamada de PLAN)**, todo del lado **fijo** del caché (~15 tokens efectivos por turno al 90%). Tres topes lo bloqueaban; los subí **al valor medido, sin holgura**, con la justificación escrita al lado, que es el procedimiento que los propios gates prescriben («subí TOPE_CAR y dejá escrito por qué»):

| Gate | Antes | Ahora | Medido |
|---|---|---|---|
| `_tools_alcanzables_gate` · `TOPE_CAR` | 18.550 | **19.120** | 19.112 |
| `_reparacion_contextual_gate` · PLAN system | 3.990 | **4.580** | +4.577 |
| `_reparacion_contextual_gate` · total PLAN | 1.300 tok | **1.450 tok** | 1.445 tok |

`PLAN_TOOL` **no se movió** (1.210): el enum de tools no gana ninguna entrada — `delta_pp` viaja en `args`, que ya es objeto abierto.

Si al arquitecto le parece caro, es reversible en tres líneas: comprimir el catálogo y bajar los topes. La garantía anti-invención **no depende del prompt** (§4), así que recortar texto ahí no debilita nada — solo aumentaría los reintentos de PLAN.

---

## 7 · Lo que frené o declaré, y no toqué

1. **Las dos bases de venta** (§2b) — traje tres opciones, no decidí solo.
2. **El aviso de graduación del modo target.** Verificado: el opener del modo *target* levanta el aviso `graduacion` de `guardC` («falta marca de supuesto») porque «Es una proyección sobre el dato real» no contiene ninguna de las marcas que `_ASSUMPTION` reconoce (`si`, `supon`, `estimad`, `proyectad`…). **Es preexistente, es un aviso y no bloquea.** No lo toqué: cambiar el texto del modo target es tocar producción por un aviso. El modo delta **sí** trae la marca («resultado estimado») y pasa sin aviso — hay un chequeo del gate que lo fija.
3. **`guardC`, `_calibracion_casos.mjs`, `_constitucion_matriz_gate.mjs`**: sin tocar. La matriz sigue en 20/20. Nada de este trabajo necesitó relajar el muro.
4. **`numberGuard.js`, `entityGuard.js`, `_guard_gate.mjs`, `_evidence_spec_views_gate_entry.jsx`**: sin tocar ni commitear.
5. **`narrationBlocks.js` / la zona del respaldo**: sin tocar — es la zona del worker paralelo. Lo que sí hice, y está de mi lado, es **ordenar la boleta por concepto en vez de por cuenta**: agrupada por cuenta, la tabla determinística (tope de 12 filas del renderer) mostraba el detalle de Falabella y medio Lider, y **Jumbo y Sodimac —que el usuario nombró— no llegaban a pantalla**. Por concepto, las 12 primeras filas son las 4 base + el margen resultante y la brecha de las cuatro. Lo que se recorta ahora es el desglose, nunca una cuenta del pedido. Hay un candado del gate para eso.
6. **El modo target, intacto.** Comparado **byte a byte** contra `HEAD` (`2f4d83a`) sobre **24 combinaciones** (4 escenarios × {sin args · `filters.cliente` · `filters.marca` · `filters.familia` · `entityScope` de 2 · `entityScope` de 4}): **24/24 idénticas**. En el gate quedó congelada la huella completa de su boleta más los recuperables de los cuatro escenarios ($655.663 · $654.953 · $1.332.104 · $2.259.527) y el subtotal acotado por `entityScope` ($349.997).

---

## 8 · El candado

`_carga_delta_alcance_gate.mjs` — **51 chequeos, 0 FAIL**, declarado `@inyeccion-simulada` (cumple las cuatro condiciones del escape: no importa el gateway ni un adapter, no importa nada de `src/ui/`, no tiene `fetch(`, y no carga `.env`). **Verificado que corre**: aparece en el resumen de `gates:offline` y el conteo del encabezado subió de 151 a 152 — no quedó excluido en silencio por el clasificador.

| § | Qué fija |
|---|---|
| 1 | El hilo de 2 turnos: el alcance heredado llega a la tool como `entityScope` con las 4 cuentas, una sola call, y el delta llega intacto |
| 2 | El delta sobre las 4 cuentas · la matriz exacta de la constitución · el margen resultante y el veredicto por cuenta · el orden de la boleta · el contraste con el defecto medido (todas bajan 2.0pp, no 1.0/0.7/0.3/1.9) |
| 3 | La aritmética recomputada desde `venta/costo/rebates` en las 13 filas · las dos bases separadas |
| 4 | El sello de proyección · la interpretación declarada · la lectura descartada · «22.0% + 2.0pp = 24.0%» contra `guardC` |
| 5 | El modo target byte-idéntico: huella completa de la boleta + 4 escenarios + `entityScope` |
| 6 | El negativo: 6 formas de delta no declarado, más los declines por rango y por cero |
| 7 | El piso en cero declarado · el universo del modo delta ≠ el del detector |

---

## 9 · Verificación

```bash
npm run gates:offline
```

**152 PASS · 0 FAIL · 0 TOCARON LA RED · 0 CON CREDENCIAL VIVA** (de 152 offline). Baseline en `2f4d83a`: 151 PASS · 0 FAIL. `_constitucion_matriz_gate` 20/20. Los gates de simulación existentes (`_simulate_gate`, `_registro_boleta_gate`, `_registro_gate`, `_routing_gate`, `_promise_gate`, `_vocabulario_vara_gate`, `_alcance_pendiente_gate`, `_concordancia_escala_gate`), verdes.

`_tool_contracts_gate.mjs` está clasificado LIVE (usa `callPlan`), así que **no corre en la suite offline**. Verificado a mano: su chequeo `6b-iii` (`simulateCarga` con `entityScope` acotado al subtotal de 2 cuentas) sigue verde — es el modo target, byte-idéntico.

### Archivos

| Archivo | Qué |
|---|---|
| `src/adi/specRetrieval.js` | `_deltaCargaValido`, `_simulateCargaDelta`, y el desvío en `composeSpecSimulateCarga` |
| `src/adi/oracle/toolRegistry.js` | `simulateCarga{delta_pp}` + decline con motivo |
| `src/adi/oracle/answerViaOracle.js` | `_coerceDeltaCargaDeclarado` — el candado anti-invención |
| `src/adi/oracle/planPrompt.js` | la línea del catálogo |
| `src/adi/oracle/toolContracts.js` | notas del contrato |
| `_carga_delta_alcance_gate.mjs` | **nuevo** — el candado |
| `_tools_alcanzables_gate.mjs`, `_reparacion_contextual_gate.mjs` | los tres topes de prompt, con su justificación medida |
