# Auditoría de restricciones de ADI

> Encargo del owner (2026-09-22): «No asumas que todas las leyes, guardrails, playbooks, reglas de Notario, contratos,
> procedimientos o decisiones históricas tienen que sobrevivir. Nuestro objetivo final manda sobre las decisiones
> antiguas… No quiero proteger decisiones históricas por el costo ya invertido. El objetivo no es preservar ADI como
> está. El objetivo es llegar al mejor ADI posible.»
>
> Base: inventario completo de la capa de FORMA + catálogo de **103 leyes del owner** (hay más en ~150 playbooks sin
> leer). Estado: auditoría, nada implementado, sin gasto.

## LA RESPUESTA A LA PREGUNTA FINAL

**NO.** Hoy no existe ninguna ley ni decisión estructural que haga **imposible** «naturalidad frontier + asesor
empresarial experto + verdad invisible».

Lo que frena no son leyes. Son tres cosas que no están escritas como reglas:
1. una máquina que el owner ya condenó y que sigue decidiendo en producción;
2. el modelo más barato como punto de partida de toda respuesta;
3. un libro de hechos más pobre que el asesor que se quiere.

**Las tres son decisiones de costo, no de arquitectura.**

⚠️ Una sola ley, **tal como está escrita hoy**, prohíbe el propio ejemplo del owner («el ranking pone a Lider primero;
yo miraría Falabella»): la ley de la conclusión. El owner ya la reescribió esta semana, pero **la reescritura vive en sus
palabras y en el producto sigue corriendo la versión vieja**, con un veto que exige que el último párrafo nombre al
primero del ranking. No es un imposible: es el primer trabajo pendiente.

---

## 1 · La tabla, ordenada por cuánto frena el objetivo

| # | Restricción | Qué protege hoy | Qué cuesta como producto | ¿Necesaria? | Si la cambiamos | VEREDICTO |
|---|---|---|---|---|---|---|
| 1 | **El verificador de redacción** (juez viejo, 64 comprobaciones sobre *cómo* se escribió cada frase) | Que ninguna cifra, dirección, orden o período salga falso | Fuera de muestra multa 38 de cada 100 frases **verdaderas** y deja pasar 44 de cada 100 falsas. 3 de cada 10 respuestas al respaldo. Moldea la prosa hacia el formulario. Cada forma nueva de hablar pide una regla nueva | **Las leyes sí; el mecanismo no** | Apagado ANTES de que el libro decida → salen falsedades. Apagado DESPUÉS → no pasa nada: el libro ya cubre lo que él cubría | **SE MUDA EN BLOQUE** el día que v3 decide |
| 2 | **«La conclusión es del procedimiento»** + veto de prioridad («el último párrafo nombra a la primera») | Que el modelo no cambie en silencio quién va primero, el veredicto ni la primera acción | Leída literal **prohíbe disentir**. Convierte al asesor en vocero | Sí, angostada: prohibir *sustituir*, no *disentir* | El ranking va siempre; el disenso sale declarado con dirección y apoyos | **SE ANGOSTA** — ya decidido, falta escribirlo y mover el veto |
| 3 | **La ley del socio** («ADI y Notario evolucionan juntos») | Que ninguna capacidad salga sin poder comprobarse. Es el corazón de «verdad invisible» | Con el juez viejo, cada forma nueva de hablar exige un candado nuevo: **esta ley, bien intencionada, es el motor del ciclo de parches** | Sí, con otro objeto | Terminada cuando existe el **hecho**, no cuando el verificador reconoce la **frase**. Deja de generar reglas | **SE ANGOSTA** (gratis: una oración) |
| 4 | **Las cuatro garantías y sus hermanas** (temporal exige serie · brecha = estimación · naturaleza económica · comparables con cifra de cada lado · «dominante» exige medida · universos · atributo · relación en palabras · premisa · cobertura del encargo) | **Exactamente lo que un GPT no protege.** Un frontier dice «Falabella se deteriora» sin serie y nadie lo frena | Hoy se aplican **buscando palabras**, y multan verdades | **Sí, todas.** Cada una nació de una falsedad real servida | Derogadas → vuelven las mismas falsedades el mismo mes. Mudadas al libro → se cumplen sin moldear la prosa | **LEYES SE QUEDAN · MECANISMO SE MUDA** |
| 5 | **Topes de forma**: 90 palabras cortadas «sin importar qué escribió el narrador» · párrafo máx. 120 palabras · 1 subtítulo · 5 ítems | Contra el muro de texto; respeta «dame una línea» | La brevedad tiene más fuerza mecánica que la cobertura. **Corta un pensamiento a la mitad y el corte se ve** | La intención sí; el corte no | Se pide en el encargo; si se pasa, se regenera. **Nunca se trunca** | 90 palabras **SE MUDA** · 120 **SE ANGOSTA** a advertencia · «una línea → sin tabla» **SE QUEDA** |
| 6 | **Política de tabla** (tabla no autorizada bloquea) | Divulgación progresiva (owner 2026-08-07) | Una comparación de seis cuentas sin tabla es peor que con tabla. **Contradice al propio owner (2026-09-17: «ADI sí puede responder con tablas»)** | A medias | Tabla permitida si sale de un ranking o grupo verificado, con universo y cola. El veto por modo desaparece | **SE ANGOSTA** — septiembre manda sobre agosto |
| 7 | **Cirugía de voz posterior** (borra aperturas, cambia palabras, voseo→tuteo) | Registro ejecutivo con un modelo que no obedecía | **Reescribe lo que el modelo escribió, después de escrito.** Deja frases cojas. Es lo contrario de la doctrina nueva | Mientras el piso sea el modelo barato, algo hace | Retirada sin subir el piso → vuelve «Estuve revisando tus datos…». Convertida en detector que dispara regeneración → la voz queda entera | **SE MUDA** (de cirugía a detector) cuando se decida el piso |
| 8 | **La escalera de respaldo** | Que siempre haya respuesta y que el respaldo no sea un segundo cerebro | **3 de cada 10 respuestas las escribe una máquina sin voz.** «Repetir lo último aprobado» responde a otra pregunta | El principio sí; la escalera no | Un reintento, presupuesto por turno, y si falla se sirve la versión reparada contando el incidente | Principio **SE QUEDA** · escalera **SE ANGOSTA** · repetición **SE DEROGA** |
| 9 | **«Marcar qué es dato y qué es criterio»** + sello probado/indicado/abierto | Honestidad epistémica | Leído literal: una etiqueta entre paréntesis en cada frase. Eso es robótico | Sí | El sello va en pantalla y en el libro; en la prosa la marca es **la voz** («yo miraría», «no lo puedo demostrar con estos datos») | **SE ANGOSTA**: por la voz, no por rótulo |
| 10 | **La promesa «toda pregunta se responde con las tres cosas, en orden»** | Cobertura: qué pasa, por qué, qué hacer | En el código **ya es cobertura y varía por modo**. Pero el documento que se lee cada turno dice «toda pregunta» y «en orden»: quien lo lee construye formularios | Sí, como cobertura | Se reescribe: forma de pensar, no formulario; el orden lo pone el modo | **SE ANGOSTA** el texto (gratis) |
| 11 | **El período «OBLIGATORIO»** en el encargo al modelo | **Nada.** No se hace cumplir a propósito: cuando se hizo, tiró un tercio de las respuestas al respaldo | Una orden que se sabe incumplida le enseña al modelo que las órdenes no cuentan | No, así | La casa lo escribe una vez por conversación y lo arrastra | **SE MUDA** al render |
| 12 | **Certificaciones congeladas que comparan el texto palabra por palabra** | Que un cambio no rompa algo probado | **Cualquier mejora de voz pone la suite en rojo.** Congela la prosa por accidente: un freno a la naturalidad que nadie decidió | La idea sí; el método no | Se compara hechos, estructura y estado, no texto | **SE MUDA** |
| 13 | **El atajo sin pago** (41 % de preguntas sin modelo; construido, nunca encendido) | Costo | Encendido, 4 de cada 10 respuestas serían de máquina: lo opuesto del objetivo | No | Nada, salvo que alguien lo encienda por error | **SE DEROGA** |
| 14 | **Lista de registro** (13 palabras vetadas) | Voz formal, una palabra por concepto | Un uniforme si crece «por sensación». Veta «meta» **aunque el usuario la haya dicho** | Sí, acotada | Solo registro, no calidez; en eco del usuario, la palabra del usuario | **SE QUEDA angostada** |
| 15 | **«Las preguntas de los botones se dejan como están»** | El contrato de vocabulario pantalla↔asesor | Contradice la orden del owner del 2026-09-08. Quien lee la regla cree lo contrario de lo decidido | Sí, con la excepción al lado | Nada en el producto; menos confusión en quien trabaja | **SE ANGOSTA** el texto (gratis) |
| 16 | **La Poda** («un solo camino») | No mantener dos ADIs | Poco. 195 archivos no son dos ADIs: son un camino con muchos redactores de respaldo. Lo que sobra es la escalera | Sí | — | **SE QUEDA** |
| 17 | **«Cobertura resuelta por eliminación»** | Un término visible, un solo campo | Se decidió sobre **un solo dataset** y nunca se reverificó | Sí, con nota | Se reverifica con el primer pack real | **SE QUEDA** con nota de alcance |

**Revisadas y confirmadas sin cambio:** una sola verdad por eje · no hay causalidad sin respaldo · Sentrix muestra / ADI
decide · ADI asesora, no gestiona · cero llamadas sin autorización que nombre el gasto. **Ninguna frena el objetivo.**

---

## 2 · Cicatriz vs. deuda

### Parecen burocracia y son CICATRIZ — derogarlas cuesta lo que ya costaron

- **«Un rótulo visible no puede nombrar dos campos.»** «Mis cinco clientes de mejor margen» devolvía **Falabella 22 %
  cuando el real era La Polar 34 %**, sellado «descendente» sobre una lista que no lo estaba.
- **«Evolución temporal solo con evidencia temporal.»** Es la falsedad que un modelo frontier comete más seguido,
  porque suena bien.
- **«La cifra conserva su significado»** (un porcentaje del total no «crece»). La cifra era real; la frase, falsa.
- **«Dos universos que no reconcilian nunca se suman.»** Venta en miles, stock en dólares crudos: sumarlos daba una
  cifra que «cerraba» y era basura.
- **«El encargo de tres dominios cubre los tres.»** Incidente en producción el 2026-09-14.
- **«La red de respaldo no es un segundo cerebro.»** Dos superficies diciendo cosas distintas de la misma empresa.
- **«La autorización nombra el gasto.»** Se gastó por interpretar un «dale».
- **«Una fila no es una muestra.»** El owner decidió sobre un motivo falso.

**Estas son las que un GPT generalista no tiene y por las que ADI vale más. No se derogan: se mudan de mecanismo.**

### Parecen leyes y son DEUDA — nacieron para tapar el modelo barato o un mecanismo ya condenado

La cirugía de voz posterior (nació el 2026-07-06 porque el modelo chico no obedecía) · el corte a 90 palabras (truncar
no es resumir: **la única regla que produce un defecto visible a propósito**) · el párrafo de 120 palabras · la tabla
prohibida por modo · «meta» vetada en el eco del usuario (corregir el vocabulario del cliente no es registro, es
descortesía) · el período «obligatorio» que no se hace cumplir · la poda que borra dos oraciones y las rejunta con un
espacio · «repetir lo último aprobado» como respaldo · el atajo sin pago · las certificaciones que comparan texto · **y
el mecanismo léxico de las 64 comprobaciones: la deuda no son las leyes, es haberlas implementado buscando palabras.**

---

## 3 · Orden de derogación

### Gratis hoy, sin código de producto
1. Reescribir la ley de la conclusión con el texto nuevo, **en el documento que se lee cada turno**, y escribir al lado
   la frontera con la ley del criterio.
2. Reescribir la promesa de las tres cosas: cobertura, no formulario; el orden lo pone el modo.
3. Angostar la ley del socio: terminada cuando existe el **hecho**, no cuando el verificador reconoce la **frase**.
4. Escribir la decisión sobre tablas: la de septiembre manda sobre la de agosto.
5. Corregir la regla de los botones con su excepción al lado.
6. **Corregir los comentarios que dicen que el agente está apagado: mienten desde el 2026-09-02.**
7. Escribir la doctrina de los tres límites aceptados (zona sin datos vigilada · yuxtaposición · adjetivos sin umbral ·
   techo del libro) como doctrina, no como bugs pendientes.
8. Escribir la derogación del atajo sin pago.
9. Escribir el alcance de la lista de registro.
10. Poner la nota «verificado sobre un solo dataset» a «cobertura por eliminación».

### Antes de v3, con código de bajo riesgo (no tocan la verdad)
11. Corte de 90 palabras → instrucción + regeneración.
12. Párrafo de 120 palabras → de multa a advertencia.
13. Sacar «OBLIGATORIO» del período.
14. Mover el veto de prioridad: de «el último párrafo nombra a la primera» a «la conclusión está presente y no fue
    reemplazada; el criterio apunta a ella». Con caso verdadero y caso falso.
15. **Migrar las certificaciones congeladas de texto a estructura, ANTES de que v3 las rompa solas.**

### No se toca hasta que v3 decide
16. Las 64 comprobaciones del juez viejo, en bloque · 17. El mecanismo léxico de las cuatro garantías · 18. La poda, la
escalera y la repetición · 19. La cirugía de voz (espera además la decisión del piso del modelo).

### Y antes que todo lo anterior
Un **gasto nombrado, una vez**, para medir los dos números que nunca se midieron con un modelo real: cuánto obedece el
protocolo de anclaje, y cuántas respuestas caen en regeneración. La regla «cero llamadas sin autorización nombrada» es
correcta — **pero hoy es la única cosa entre el diseño y su primer número creíble.**

---

## 4 · Las cuatro cosas que no son reglas y frenan más que las reglas

**(a) El piso del narrador es el modelo más barato.** Y es peor que un techo de calidad: **es la fábrica de reglas.** La
cirugía de voz, el corte a 90, el párrafo de 120, la lista de aperturas prohibidas: todas son parches sobre un modelo
que no hace lo que se le pide. Si se derogan sin subir el piso, los incidentes vuelven; si se sube el piso, la mitad se
vuelve innecesaria sola. ⚠️ Matiz que no se puede olvidar: **un modelo frontier miente mejor, no menos.** Subir el piso
no reemplaza ninguna ley de verdad.

**(b) La riqueza del libro es el techo de la especialización — pero solo de una mitad.** «Superior a un GPT» tiene dos
mitades: saber más sobre la empresa del cliente (eso es el libro) y saber lo que sabe el oficio («en distribución, un
ciclo de cobro sano anda en 45 días»). **Eso hoy no tiene canal. Un GPT lo dice; ADI no puede.** Sin ese canal, ADI sabe
más que un GPT sobre el archivo y menos que un GPT sobre el negocio: eso no es especialización superior, es un reporte
que habla.

**(c) El aparato viejo gobierna porque lo nuevo está apagado.** Hay tres capas contradiciéndose: la ley dice que ADI
puede disentir, el código veta el disenso, los comentarios dicen que el agente está apagado. Y el aparato viejo **no solo
decide: también produjo la evidencia** — los 888 casos se escribieron bajo las 55 comprobaciones viejas con el cerebro
mudo, así que esas cifras no se transfieren. **La máquina condenada no se queda por una ley: se queda por una
autorización de gasto que no se ha dado.**

**(d) No existe presupuesto por turno.** Peor caso: siete llamadas seguidas, con un único tiempo límite por llamada. Un
usuario que viene de GPT no espera setenta segundos. No es una ley, no es el modelo, no es el libro: es un número que
nadie fijó. **Sin ese número no hay premium aunque todo lo demás salga bien.**

---

## 5 · Contradicciones detectadas (seis)

- **A · Ley 6 vs ley 96.** «La conclusión es del procedimiento» (2026-09-10) contra «marcar qué es dato y qué es
  criterio» (2026-08-16, un mes ANTERIOR: el permiso explícito para opinar). Conviven porque alguien entendió que una
  aplica donde el procedimiento decidió y la otra donde no, **pero esa frontera no está escrita en ningún lado.**
- **B · `ask` congelados.** `CLAUDE.md` §3 lo afirma sin matiz; el owner ordenó cambiar seis el 2026-09-08. La excepción
  vive en la línea 170 de un contrato de 754.
- **C · Tablas.** 2026-08-07 («divulgación progresiva») contra 2026-09-17 («ADI sí puede responder con tablas»).
- **D · Ley reescrita vs veto vivo.** El owner cerró «ADI puede discrepar»; en producción el veto de prioridad sigue
  prohibiendo su ejemplo canónico.
- **E · Doctrina de reparación invisible vs mecanismos vivos.** «La casa nunca reescribe una palabra del modelo» es
  incompatible con la cirugía de voz (reescritura libre post-LLM) y con la poda. **Ambos violan la doctrina hoy**; la
  poda ya está en el plan de retiro, la cirugía de voz no está en ningún plan.
- **F · Estado del agente.** `CLAUDE.md` §7 dice que el agente ES el camino; dos comentarios del código dicen que está
  apagado en todos los perfiles. Verificado: **el agente está encendido en producción desde el 2026-09-02**; los
  comentarios quedaron de agosto.

---

## 6 · El trinquete oculto: los candados que casan por texto

Los gates que comparan texto literal de una respuesta esperada son **una ley de facto**: cualquier mejora de voz o del
encargo los pone en rojo, y el equipo aprende a no tocar la prosa. Cuando v3 encienda el render, **la prosa cambia por
diseño y esos candados se rompen todos a la vez.** Hay que migrarlos a comparación estructural (ids servidos, hechos
renderizados, modo de cierre, estado) **antes** del cambio. Regla para el candado nuevo: *un gate del agente no puede
contener texto español literal de una respuesta esperada.*

---

## 7 · Lo que el objetivo necesita y NO es derogación

- **Coherencia conversacional** (requisito de cierre del owner): ninguna ley la impide, falta estructura. El libro tiene
  que vivir la conversación, no el turno.
- **Canal de referencia de oficio**: no existe, y sin él «superior a un GPT» falla en la mitad del oficio.
- **Presupuesto de turno**: no existe.
- **La decisión del piso del modelo**: es la única de esta auditoría que **ni el diseño nuevo ni ninguna derogación
  resuelven.**
