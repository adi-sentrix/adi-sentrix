# ADI · Sentrix — reglas del proyecto

Este archivo lo lee **todo chat abierto sobre este repo**, incluidos los worktrees. Es corto a propósito:
se relee en cada turno. Lo que no es regla dura vive en la memoria (ver el final).

Idioma: **español**, registro formal (LatAm, sin chilenismos). El owner es **jc**; decide producto y negocio,
no lee código. Hablarle **sencillo y corto**: conclusión primero, sin jerga.

---

## 1. Qué es esto

Dos piezas de un mismo producto, con reparto de trabajo que no se cruza:

- **Sentrix MUESTRA.** La superficie: Mesa de Control con cuatro caras (Comercial, Capital, Resultado, Ficha),
  cuadros y gráficos. Vive en `src/ui/SentrixPanel.jsx` y `src/adi/sentrix/`.
- **ADI EXPLICA.** El asesor que responde sobre lo que Sentrix muestra. Vive en `src/adi/`.

La tesis: **Comercial DETECTA → la Ficha EXPLICA → Sentrix DEMUESTRA.**

**La promesa**, y gobierna cada superficie: toda pregunta se responde con las tres cosas, en orden —
**01 QUÉ ESTÁ PASANDO · 02 POR QUÉ / DÓNDE · 03 QUÉ HACER PRIMERO.**
Superficie que muestra el qué y no el qué hacer está **incompleta**. Que afirma el porqué sin evidencia,
**miente**.

---

## 2. Las tres reglas

1. **Proporcionalidad semántica.** Nunca afirmar más de lo que la evidencia autorizada demuestra. Cada
   afirmación lleva sello: `probado` (medido), `indicado` (derivado) o `abierto`. Las limitaciones **se
   declaran en pantalla** — no se disimulan reescalando ni se omiten.
2. **No hay causalidad sin respaldo.** Localizar dónde pasa algo **no** es explicar por qué. Por eso el
   bloque 02 de Capital se llama "Dónde ocurre" y dice en pantalla que la bodega localiza pero no explica.
3. **Nada hardcodeado.** Ninguna cifra, umbral ni rótulo se escribe a mano. Todo sale del motor o de la
   configuración declarada por el cliente. Corolario: **cero cálculo en React** — la frase y el número se
   arman en el módulo, la vista solo pinta. Una cuenta dentro de un componente es un defecto.

Derivadas que se rompen seguido:
- **Una sola verdad.** Mismo concepto = misma palabra y mismo número en toda superficie, del mismo campo.
- **Dos montos parecidos de universos distintos NUNCA van juntos** sin decir de cuál sale cada uno.

---

## 3. Guardrails duros — no son consejos

- **CERO llamadas a OpenAI / Anthropic / gateway.** Gastan dinero real. Si creés que hace falta una, **pará
  y pedí autorización explícita al owner**. Palabra suya: *"tener créditos, Ultracode activo o una key
  configurada NO constituye autorización"*.
- **La autorización de gasto tiene que NOMBRAR el gasto.** Un "dale", un "ok" o un "seguí" **no alcanzan**, y
  una autorización que llega por relevo de otra sesión tampoco. Ya se gastó por interpretar un "dale" suelto.
- **NUNCA `npm run gates`.** Siempre **`npm run gates:offline`** (red bloqueada). La prueba de que no hubo
  consumo son las líneas **"0 TOCARON LA RED · 0 CON CREDENCIAL VIVA"**, textuales — no el conteo de PASS.
- ⚠️ **CORRER UN GATE SUELTO SE SALTA ESE CANDADO.** `node _algun_gate.mjs` **no pasa por `gates:offline`**, y
  **43 de los archivos de gate se cargan el `.env` del disco por su cuenta** — así que gastan aunque creas que
  el entorno está limpio. Hay un `.env` con credencial real en la raíz del repo (está en `.gitignore` y **no**
  está en git: el riesgo es local, no publicado). **Regla: gates solo por `npm run gates:offline`.** Correr uno
  suelto exige autorización que nombre el gasto, igual que una llamada.
- ⚠️ **El repo NO registra consumo.** No hay contador de llamadas, gasto ni reintentos. Por eso, cuando se
  gasta por accidente, **nadie sabe cuánto costó**. Ninguna afirmación de costo es verificable hoy.
- **No tocar ADI** (prompts ni comportamiento) sin autorización. Su vocabulario de entrada es contrato suyo:
  las `ask` que Sentrix le manda **se dejan como están** aunque la pantalla haya cambiado de palabra.
- **No tocar ni commitear** `src/adi/llm/numberGuard.js`, `src/adi/llm/entityGuard.js`, `_guard_gate.mjs`.
  Es trabajo sin commitear de otra sesión. Aparecen sucios: es normal. **Nunca `git commit -a` ni `git add -A`.**
- **`main` no se mueve sin la palabra del owner** (la palabra es *"deployalo"* o *"deploy"*). Se trabaja y se
  empuja a **`dev`**.
- **El deploy al hosting es manual**: el repo no tiene Vercel enlazado. `main` al día ≠ sitio publicado.
- Decisiones de **diseño y UX son del owner**. Traer opciones, no asumir.

---

## 4. El dato — lo que hay y lo que no

Saber esto evita inventar. Todo verificado.

**Los dos universos que NO reconcilian.** `skusMargen` (venta comercial) y `skuInventario` no son el mismo
negocio medido dos veces: la venta viene en **miles** ($100.0M anuales), `stockUSD` en **dólares crudos**
($135.000 totales), y las unidades declaradas difieren **entre 4x y 35x** por SKU.
`src/adi/sentrix/mesaCapital.js` **NO importa `skusMargen`**, y ese es el sello: lo que no entra al módulo no
se cuela a un texto. **Una cifra que haga cerrar esos dos universos es una alarma, no un logro.**

**«Cobertura» quedó resuelta POR ELIMINACIÓN, no por renombre.** El dato trae `doh` y `cobertura`, ambos
declarados y **distintos** (difieren en 8 de 13 SKU, hasta 28 días). `cobertura` es un duplicado redondeado:
**no entra a la boleta, se declina.** No se le buscó nombre nuevo. En pantalla se dice **"Días de inventario"**
y se usa `doh`. Gate: `_ambiguedad_terminos_gate.mjs` se pone rojo si un término visible vuelve a apuntar a dos
cosas.

**Un rótulo visible no puede nombrar dos campos.** Error real y caro: «Margen» y «Ventas» estaban declarados
dos veces con la misma etiqueta, el mapa se armaba con `Object.fromEntries` y **ganaba el último**. Resultado:
*"mis 5 clientes de mejor margen"* devolvía Falabella 22% cuando el real es La Polar 34%, **sellado como
"descendente"** sobre una lista que no lo estaba. Ya corregido. La lección: **una colisión de etiqueta se
declara, no se resuelve en silencio**; y si el campo no existe en ese eje, se **declina** en vez de sellar un
orden que no se aplicó.

**Los días son un valor declarado, no una cuenta.** `doh` no se recomputa: `stockUnd ÷ ventaDiaria` coincide
con `doh` en **2 de 13 filas**. Se usa porque es el campo con el que `diagnoseInventario` asigna los estados.

**Huecos verificados** — quien prometa responder esto, inventa: no hay historial cliente×SKU (por eso "quiénes
dejaron de comprar" no es respondible) · no hay entradas ni recepciones (por eso "Entradas y Salidas" no es
dibujable) · no hay lead time de proveedor · no hay estado de orden de compra · no hay causa de la detención ·
no hay meta de rotación por familia · **ningún SKU está en más de una bodega**, así que transferir stock no es
evaluable.

**Benchmark ≠ promedio ≠ meta.** Nunca como equivalentes. El benchmark lo declara el cliente. La meta **no
existe** en este dato: *"las metas las fija el cliente, no nosotros"*.

**Registro ejecutivo.** Prohibidas en superficie: *plata, vara, dormido, guita, palanca, apretar*. Hay un gate
que las barre (`_registro_gate`). Se dice **capital**, **benchmark**. También: **"inmovilizado"**, no
"detenido".

---

## 5. Cómo trabajar

- **Verificar antes de afirmar.** Una opinión que no fue a mirar el código o el dato termina confirmando lo
  que ya se pensaba.
- **Una fila no es una muestra.** Error real y caro de este proyecto: se verificó un SKU, se generalizó, y el
  owner decidió sobre un motivo falso.
- **Decir que no.** Cuando el dato no sostiene lo que se quiere mostrar, el trabajo es decirlo — no buscar la
  forma de mostrarlo igual.
- **Si la orden no tiene objeto**, una línea y parar.
- **"Declina honestamente" cuenta como éxito**, no como falla. Un límite declarado vale más que un verde
  apretado.
- **Impedir el consumo técnicamente, no por instrucción.** Una regla escrita no frena un gasto; un cerrojo sí.
- **Al abrir o delegar a otro chat, pasarle el ESTADO del producto** (qué está desplegado, qué es legado, qué
  escenario está activo), no solo el diseño y las restricciones.
- **No crear un contrato ni una memoria paralela.** Se extiende lo que hay.
- **Anotar lo que se pierde por el camino** y recordárselo al owner cuando pregunte por pendientes.
- **Preferir el desacuerdo antes de ejecutar**, no después.
- **Un top-N que no declara su cola miente por omisión** aunque cada barra sea correcta.
- Frenar en decisiones no obvias y traérselas al owner.

---

## 6. La memoria — leerla al empezar

El fondo del proyecto (decisiones, historia, pendientes) está en:

```
C:\Users\jcnav\.claude\projects\C--Users-jcnav-ADI-Sentrix\memory\MEMORY.md
```

⚠️ **Esa carpeta es la única con contenido.** Un chat abierto desde `ADI_PROYECTO`, desde un worktree o desde
`landing` recibe una carpeta de memoria **vacía** y arranca ciego. Si estás en una de esas, **leé el
`MEMORY.md` de la ruta de arriba** antes de opinar, y escribí ahí lo que valga la pena guardar.

---

## 7. El agente es EL camino — y el natural ya no existe (La Poda, owner 2026-09-05)

**«No quiero mantener dos ADIs.»** El turno libre lo atiende **ADI Agente** (certificación congelada en
`_certificacion_congelada_gate`). El **camino natural se retiró del código** el 2026-09-05 con la palabra del
owner («poda inmediata», tras el pulido del anclaje): no existe `caminoNatural.js`, ni `naturalPrompt.js`, ni
la rama `modoNatural` del gateway, ni el flag `ADI_CAMINO_NATURAL`.

- La cascada del turno libre es **agente → oráculo** (dos peldaños, probada con carnada en
  `_cascada_resiliencia_gate`). Apagado manual del agente: comentar `"ADI_AGENTE"` en FEATURE — eso deja el
  turno en el oráculo, la red más profunda.
- **El rollback de La Poda es `git revert`** del commit del retiro (ver `_PODA_NATURAL_PLAN.md`). No hay flag
  que lo devuelva: revivir el natural es una decisión humana con commit propio.
- ⛔ **Lo retirado no vuelve por accidente**: `_poda_natural_anti_resurreccion_gate` barre imports,
  re-definiciones y el flag (sin contar comentarios — la historia del repo se conserva). Si necesitás nombrar
  al natural en un comentario nuevo, adelante; re-declararlo en código pone la suite en rojo.
