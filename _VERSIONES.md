# Versiones de ADI

**La regla (owner 2026-08-16):** cada vez que el owner dice **«deployalo»**, el deploy sale con las cuatro cosas
en el mismo momento — **número de versión · tag en el repo · `/api/version` actualizado · nota corta**. Puestas
después, se abandonan: ya pasó una vez (`v1.0-demo-privada` quedó 533 commits atrás de su propio producto).

**Formato.** Cambios normales suben el segundo número (1.1 · 1.2 · 1.3). Un cambio grande sube el primero (2.0).
**Supabase + carga de archivos ya está reservado como 2.0.**

**Dónde vive cada cosa.** El número: `src/config/version.js` (una sola fuente). La nota: este archivo. El tag:
el repo. Que los tres digan lo mismo lo verifica `_version_gate.mjs`.

---

## 1.1 — *sin desplegar* (en `dev`)

Lo acumulado en `dev` desde que se desplegó la 1.0. Sale a producción cuando el owner diga «deployalo».

- **«Vara» fuera de pantalla**: los 4 textos de producto, el glosario (la palabra queda como alias de ENTRADA,
  el concepto visible pasa a «tu referencia») y 5 razones del manifiesto que terminaban en el prompt.
- **Los dos cierres del Examen 4**: los superlativos se verifican contra el conjunto y la métrica («el peor
  margen» es una clasificación, y una clasificación es evidencia), y ADI marca qué es dato duro y qué es
  criterio suyo cuando recomienda, aunque no se lo pidan.
- **La etiqueta de los días**: «días sin rotar» no existe en el dato — hay días de inventario y días sin venta.
- **Cada ranking se declara entero**: universo · dirección · polaridad · regla de empate · campo fuente ·
  términos. Incluye el eje SKU, que antes no tenía contra qué verificarse.
- **El versionado**: esto mismo.

---

## 1.0 — producción · commit `b9c552e` · tag `v1.0`

ADI privado con camino natural, notario calibrado, contrato `[[CALCULO]]`, reparación, suplente seguro, carpeta
única, preguntas reales del «Cómo funciona» y controles anti-invento para cifras, estados, rankings, universos y
cálculos.

---

## v0.1-demo-privada — *legacy* · commit `500165c`

La demo privada con código compartido, **antes** del camino natural, del notario y del contrato de cálculo.
Se llamaba `v1.0-demo-privada`; se renombró para que no hubiera dos «1.0» confundiendo el producto con la demo.
No comparte línea de numeración con la de arriba: es otra época del producto.
