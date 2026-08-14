# El lavador cerrado — la red morfológica del voseo y «vara» como clase

**Worktree** sobre `dev` = `583c055` · rama real `claude/hungry-kowalevski-af8035` · commits locales SIN push.
`npm run gates:offline`: **150 PASS · 0 FAIL · 0 TOCARON LA RED · 0 CON CREDENCIAL VIVA**.

---

## 1. Conclusión primero

Los dos casos que el arquitecto midió en vivo salen corregidos:

> «…te muestro qué pasa con esa cuenta si **subes** el volumen 4%» *(el 4% intacto)*
> «Con **esa referencia** puesta, Falabella queda 8,1 puntos por debajo»

El stripper de runtime pasó de lavar **150 de 316** variantes a **290 de 311** (93,2%). Las **21** que quedan
están declaradas una por una con su motivo, dentro del propio gate. Cero falsos positivos en 88 controles de
prosa correcta, y cero literales de producción alterados por reglas nuevas.

**Lo que importa más que el número:** el hueco no era una lista corta, era el método. Una lista enumerada no
gana contra un narrador que conjuga libre y al que los prompts le hablan en voseo a propósito. Ahora hay una
**regla** para lo que es regular y una **tabla derivada** para lo que no — y el gate mide las dos contra el
detector, forma por forma.

**Y encontré un defecto que yo mismo introduje y el barrido cazó:** la primera versión de la red de enclíticos
convertía `rotate(…)` —la función de CSS y de SVG— en «rótate». Está cerrado (§5), pero es la razón por la que
la verificación de este pase no fue el gate, sino pasar los **11.255 literales reales del producto** por el
lavador y mirar qué cambiaba.

---

## 2. La regla morfológica elegida — y por qué son TRES redes, no una

El camino que §7.1 dejó sugerido era una red para `-ás`. La medición mostró que esa forma sirve para `-ás` y es
**peligrosa** para `-és`/`-ís`. La diferencia no es de estilo: es qué clase de palabras españolas comparten esa
terminación.

| Terminación | Mecanismo | Por qué |
|---|---|---|
| **`-ás`** (verbos en -ar) | **Red abierta** · el tuteo es quitar la tilde | Las palabras no verbales en «ás» son clase **cerrada** y corta (*estás · jamás · quizás · además · demás · compás · Tomás · Nicolás*). Y **todo el futuro de tuteo termina en «rás»** —incluidos los sincopados *harás, dirás, podrás, tendrás*—, así que se excluye entero con una condición sobre la raíz. El condicional (*recuperarías*) ni entra: lleva la tilde en la «í». |
| **`-és` / `-ís`** | **Tabla derivada de infinitivos** · nunca red abierta | Acá la terminación choca con clases **abiertas y productivas**: los gentilicios en -és (*francés, japonés, escocés* — la familia crece) y los sustantivos de uso diario en prosa de negocios (*después, interés, a través, al revés*). En -ís, *país* y —verificado contra el catálogo del tenant— el cliente **«Paris»**. Una red abierta ahí reescribe prosa correcta. |
| **Enclíticos** | **Tabla de raíces** · una regex por conjugación | La vocal temática tiene que corresponder al verbo. Con comodín, «avisame» (voseo) y **«avíseme» (imperativo de USTED)** caen en la misma regla — y convertiría el trato de usted en tuteo, arruinando justo el registro que el producto quiere. |

La tabla declara **una cosa por verbo**: el infinitivo, y el tuteo sólo cuando la raíz cambia (*entender →
entiendes*, no *entendes*). De ahí salen el presente, el imperativo y los enclíticos por regla. Sumar un verbo
es una línea.

**El tildado de los enclíticos se calcula, no se escribe.** «avisa» + «me» = «avísame»: la sílaba tónica no se
mueve, sólo se hace visible porque la palabra pasa de llana a esdrújula. `_tildarPorClitico` la ubica —con la
regla del hiato para *trae → tráeme*— y el gate la verifica contra la tabla entera.

**La tilde es obligatoria en toda forma de la red nueva.** Es lo que la hace segura: sin ella *vendes, pones,
subes, recorres* son tuteo correcto y *Paris* es un cliente.

### Las excepciones, todas medidas

- **Futuros en `-rás`**: excluidos por la condición `raíz termina en r`. Cuesta los presentes de los verbos en
  **-rar** (*mejorás, comparás, nombrás, filtrás*), que quedan **enumerados** — 20 de ellos.
- **Adverbios y nombres propios**: `est · jam · quiz · adem · dem · comp · tom · nicol · mam · pap · sof · anan
  · barrab`. **«Tomás» gana sobre «tomás» (de tomar)**: son la misma cadena y ningún contexto las separa.
- **Verbos de raíz cambiante**: enumerados **antes** de las redes, porque ahí la regla general miente. Añadí los
  que faltaban: *acordá→acuerda, forzá→fuerza, negá→niega, despertá→despierta, colgá→cuelga, recomendás→
  recomiendas, demostrás→demuestras*. Y **«apretás»→«ajustas»**, porque *apretar* está vetada del registro.
- **Verbos en `-uar`** (hallazgo del barrido): su tuteo **lleva** tilde. La red daba *evalua*; ahora
  *evaluá→evalúa, continuá→continúa, actuá→actúa, situá→sitúa, graduá→gradúa*.
- **`tomate`** (§5).
- **`rotate` · `validate` · `calculate` · `separate`** (§5).

---

## 3. «Vara» cerrada como clase — y la verificación que pedía el encargo

El pase anterior cubría tres frases (`tu` / `la` / `declarada`) y el narrador escribió una cuarta. Un
determinante no cambia el registro: si la palabra está vetada, lo está con cualquiera. Ahora la clase se cierra
por **lista de determinantes**, no de frases:

- singular: `la · una · esa · esta · aquella · tu · su · mi · nuestra · otra · dicha · misma · cada · cualquier`
- plural: sólo **con determinante femenino plural** delante
- sin determinante: sólo con adjetivo enumerado (`declarada · propia · alta · baja · mínima · máxima · actual ·
  vigente · puesta · fijada · definida`)

**El plural exige determinante y no es un capricho: «Puerto Varas» es un topónimo chileno real.** Un
`\bvaras\b` suelto lo convertiría en «Puerto referencias». El determinante se preserva (grupo capturado), así
que la concordancia y la mayúscula salen solas — *vara* y *referencia* son las dos femeninas, incluidos los
adjetivos pospuestos.

### Verificado contra `defineConcept`: la definición servida NO pasa por el stripper

Era la condición para poder ampliar. **No pasa**, y quedó lockeado en el gate (V9a–V9d):

- `defineConcept` → `composeFromTextualEvidence` arma la respuesta **verbatim** en la rama determinística de
  `answerViaOracle` (líneas 2696–2728). El gate lee ese tramo y exige que **no** contenga `stripLanguageLeaks`.
- `narrationBlocks.js` —donde vive ese compositor— **no importa** el guard de voz. El gate lo verifica: si algún
  día lo importa, la definición del glosario empieza a lavarse y hay que frenar.
- Y se deja **medido** por qué importa, no dicho: el `distingue` de la entrada `vara` **sí** cambiaría al pasar
  por el stripper (quedaría *«la referencia es la referencia que tú declaraste»*, circular). V9a/V9b son el
  candado de que eso no ocurra; V9d prueba que el riesgo es real.

El **eco narrado** de «vara» sí se lava, y eso es la decisión ya tomada en el cierre del espejo (*el registro
manda sobre el eco*). Lo que no se toca es la definición curada. **El freno de la Poda 2B sobre el renombre del
concepto sigue en pie: no lo moví.**

---

## 4. Convergencia detector ↔ stripper — con la diferencia listada

| | antes | ahora |
|---|---|---|
| Entradas del detector | 247 | 246 |
| Variantes concretas | 316 | **311** |
| Lava en prosa neutra | 150 | **280** |
| Lava sólo en posición de orden | 10 | **10** |
| **No cubiertas** | **156** | **21** |
| Convergencia | 50,6% | **93,2%** |

**Las 21 que no se cubren, y por qué.** Son la grafía **sin tilde** del presente voseante en -er/-ir
(*subis, pedis, entendes, resolves, salis*…). No se cubren porque aceptar la forma pelada de esa clase obligaría
a aceptarla para toda la tabla — y ahí **«retenes»** (plural de retén), **«soles»** (plural de sol), *vendes,
pones, subes* son palabras españolas legítimas. El detector puede nombrarlas porque marcar de más sólo pone un
gate rojo; **el stripper no puede lavarlas porque reescribir de más cambia la respuesta que lee el owner.**
La asimetría es deliberada y el gate la lista entera en `NO_CUBIERTAS`: si crece sin declararse, se pone rojo.

**Las 10 gateadas a posición de orden** (*reponé, vendé, resolvé, atendé, corré, aprendé, entendé, escogé,
recorré, mantené*) siguen igual: el imperativo en -é/-í es a la vez orden y pretérito de primera, y sólo se lava
donde abre la oración.

### Tres falsos positivos del detector, corregidos

`aprend[eé]s`, `escog[eé]s`, `recorr[eé]s` estaban declarados con la tilde **opcional** — pero *aprendes*,
*escoges* y *recorres* sin tilde son **tuteo perfectamente correcto**. El detector marcaba prosa buena, que es
la forma en que un gate se termina desactivando. Ninguna está en las 36 formas medidas en pantalla de
`_registro_boleta_gate` [2d]: el detector no perdió cobertura real.

### Y una asimetría más, cerrada

El Nivel 2 del detector miraba la marca de pasado sólo **hacia atrás**, así que marcaba *«Corregí el dato ayer
con la boleta nueva»* — pretérito, con el «ayer» **detrás**. El stripper ya miraba las dos direcciones. Ahora el
detector usa el mismo criterio.

---

## 5. Lo que encontró el barrido de los 11.255 literales — incluido un defecto mío

El gate no alcanzaba para confiar en una red abierta. Pasé **todos los literales de pantalla del camino vigente**
(21 archivos) por el lavador y miré qué cambiaba. Encontró cuatro cosas:

**🔴 (a) Mi propia red rompía CSS y SVG.** `transform="rotate(-40 …)"` (SentrixPanel) y
`transform: rotate(360deg)` (ChatADI) se convertían en «rótate»: la raíz *rot* + vocal + clítico *te*. Hoy esos
literales no pasan por el stripper, así que **nada estaba roto en pantalla** — pero una regla que reescribe una
función de CSS es una bomba con la mecha puesta. Excluidos `rotate`, y por la misma colisión con inglés e
identificadores, `validate`, `calculate` y `separate`. Está en el gate (V7f).

**🟡 (b) Las versales se rompían — y no era sólo mío.** El motor usa mayúsculas para enfatizar una orden
(«CONTESTÁ la decisión», «DECLARALO en la primera frase»), y el camino de réplica-string devolvía «Compras»
donde decía «COMPRÁS»: le apagaba el énfasis a un texto que lo tenía puesto a propósito. Corregido **para todas
las reglas**, no sólo las nuevas.

**🟡 (c) Los verbos en -uar.** El literal *«después frená compras o evaluá salida»* (mesaCapital) se convertía
en «evalua», que no existe. Ver §2.

**🔴 (d) Voseo VIVO en literales de pantalla que ningún gate caza — NO LO TOQUÉ.** El barrido de §7.1 no los vio
porque sus formas no estaban en `VOSEO_FORMAS`. Los dejo listados para el arquitecto:

| Archivo | Literal | Clase |
|---|---|---|
| `AccessGate.jsx` ×2 | «**Habilitá** la emisión primero» | pantalla, inequívoco |
| `SentrixPanel.jsx` | «**Protegé** estas condiciones y **usala** de referencia» | pantalla |
| `mesaCapital.js` | «Primero **protegé** los SKU de alta salida…» | pantalla |
| `specRetrieval.js` | «**frená** la próxima compra…» · «**pedime** «¿Es por precio o por costo?»» · «La decisión: **cuidala**» | respaldo determinístico |
| `porQueEstaCifra.js` | «es un supuesto que declaraste **vos**» | pantalla |
| `toolRegistry.js` | «**CONTESTÁ** la decisión…» · «**DECLARALO** en la primera frase» · «**decílo** tal cual» | **ambiguo — hay que leerlo** |

**Por qué no los corregí.** El stripper ahora lava casi todos en runtime (agregué `protegé` a la tabla, que
faltaba), pero varios de esos textos **no pasan** por el stripper: son labels, chips y `razon` verbatim. Y los
tres de `toolRegistry.js` son de clase **incierta**: el informe anterior declara que esos `razon` llegan a
pantalla verbatim, pero su redacción («no presentes estos totales…», «en la PRIMERA frase») suena a instrucción
al narrador — donde el voseo es legítimo. Decidir cuál es cuál exige leer cada sitio, y el candado del encargo
dice que los prompts internos no se tocan. **Prefiero listarlos que adivinar.**

*Las 3 líneas de `dialogueState.js` que también cambian son `buildOrientacionInstruction`: las exenciones ya
declaradas — voseo legítimo, texto para el modelo.*

---

## 6. El candado

`_voice_gate.mjs`: **41 → 155 PASS · 0 FAIL**. Verificado que **el clasificador no lo excluye**: aparece corrido
en la suite, y el conteo del encabezado se mantiene en **150 PASS** (no bajó).

- **V1** · los dos casos medidos en vivo, literales, con la cifra intacta.
- **V2/V3** · el inventario completo del detector medido contra el stripper. Las no cubiertas son una lista
  **cerrada**: si aparece una nueva sin declarar, rojo; si una se cubre y nadie la saca de la lista, rojo
  también. Igual con las 10 gateadas a posición de orden.
- **V4** · 60 frases de prosa correcta que tienen que salir **byte-idénticas**, agrupadas por clase de riesgo
  real: futuros, condicionales, adverbios, gentilicios, «Paris»/«Puerto Varas»/«Tomás», tuteo correcto,
  **imperativo de usted**, «retenes»/«soles»/«tomate», tercera persona, pretérito de primera.
- **V5** · el detector contra **el mismo corpus**: los dos tienen que estar de acuerdo en qué no es voseo.
- **V6** · la convergencia, con la diferencia declarada y comparada contra `NO_CUBIERTAS`.
- **V7** · las reglas duras: number-safety, idempotencia, mayúscula inicial, **versales**, verbos en -uar,
  `rotate(…)` de CSS, y una comprobación de que el bloque nuevo **no usa lookbehind** (lee su propio fuente).
- **V8** · «vara» como clase, 9 formas + «Puerto Varas»/«varado» intactos.
- **V9** · el cableado del glosario (§3).

También actualicé el comentario de `_registro_boleta_gate.mjs` [2d], que declaraba el hueco como abierto
(«150 de 316… decisión del arquitecto»): quedó falso y ahora apunta a dónde vive la medición.

### Gates movidos — análisis comportamiento vs. formato

**Ninguno.** No cambié ni una fixture existente: las 41 aserciones previas de `_voice_gate` siguen tal cual, y
las 114 nuevas son aditivas. `_registro_boleta_gate` **subió** de 13.677 a **13.724 PASS** sin tocar sus casos
(el detector cambió de tamaño y sus checks lo recorren). Los demás gates de registro pasaron sin modificación.

---

## 7. Lo que frené

1. **Los literales de voseo vivo de §5(d)** — listados, no tocados. Los tres de `toolRegistry.js` necesitan que
   alguien lea el sitio para decidir si son pantalla o instrucción.
2. **El renombre del concepto `vara`** del glosario — sigue frenado esperando al owner (Poda 2B). Amplié el
   barrido de la **voz narrada** después de verificar que la definición servida no pasa por ahí.
3. **Las 21 variantes sin tilde** — declaradas, no cubiertas (§4).
4. **Los imperativos en -í nuevos** (*recibí, conseguí, compartí, repetí*): colisionan de frente con el
   pretérito de primera y no los medí en pantalla. Sumé sólo los **-é**, donde esa ambigüedad casi no existe.
5. **Dos lookbehind preexistentes** (`_voseoConContexto` y la red de `-á`) siguen ahí. Mis reglas no usan
   ninguno y el gate lo verifica sobre el bloque nuevo, pero **el archivo declara «sin lookbehind» y hoy tiene
   dos**. No los toqué: cambiarlos es reescribir dos redes que están en producción y funcionando, sin haber
   medido una falla real en Safari. Queda anotado.

---

## 8. Verificación

```bash
npm run gates:offline
```

- **150 PASS · 0 FAIL · 0 TOCARON LA RED · 0 CON CREDENCIAL VIVA** (líneas textuales).
- `_voice_gate`: **155 PASS · 0 FAIL** · corrido, no excluido por el clasificador.
- `_registro_boleta_gate`: **13.724 PASS · 0 FAIL**.
- Cobertura: **311 variantes · 280 en prosa neutra · 10 en orden · 21 declaradas**.
- Falsos positivos: **0/88** en el stripper y **0/88** en el detector · **0** entidades del tenant alteradas ·
  **0** fallas de idempotencia o number-safety.
- Barrido de regresión: **11.255 literales** de pantalla del camino vigente; los 55 que cambian son voseo real
  (§5d), clases preexistentes ya declaradas («capital detenido», «vara», «upside»/«palanca»/«driver») o
  artefactos del scanner sobre código (`${drivers}`, `${iF}`, los regex de entrada `poneme`/`ponele`).
  **Cero alterados por reglas nuevas.**

**Tocados y commiteados (3):** `src/adi/llm/voiceGuard.js` · `_voice_gate.mjs` · `_registro_boleta_gate.mjs`.
**No se tocó ni commiteó** `numberGuard.js`, `entityGuard.js`, `_guard_gate.mjs`,
`_evidence_spec_views_gate_entry.jsx`. Sin `git add -A`, sin `commit -a`, sin push, `main` intacto.
**Cero llamadas a proveedor, gateway o red.**
