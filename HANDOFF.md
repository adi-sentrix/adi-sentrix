# HANDOFF · REFACTOR ADI MODULAR → Claude Code

**Para:** Claude Code (o Cowork), corriendo en la máquina local del founder.
**Rol:** vos sos el EJECUTOR. El arquitecto (otro Claude, en chat) dirige y audita. El founder corre y sella.
**Objetivo de este handoff:** retomar el refactor del ADI desde donde está (Fase 4 completa) y llevarlo a Fase 5 (UI) y Fase 6 (app navegable en Vite · la Victoria 2), aprovechando que estás en la PC real.

---

## 0 · Qué es ADI y la regla madre (no negociable)

ADI Sentrix es un motor determinístico de inteligencia comercial: BI conversacional donde **cada cifra que muestra cierra con la cuenta que muestra. ADI no inventa.** En este refactor, eso se traduce en una regla absoluta:

**REGLA MADRE DEL REFACTOR:** la única diferencia permitida entre el monolito sellado y el ADI modular es *dónde vive el código*, nunca *qué calcula*. Misma entrada → misma salida. El piso `41cc33d8` es la verdad de referencia. Toda diferencia se clasifica: **esperada por extracción · bug de extracción · deuda descubierta**. No se agregan features, no se cambian fórmulas, no se cambian cifras durante el refactor.

---

## 1 · Estado actual (qué está hecho y auditado)

**Origen del refactor:** monolito `ADI_MVP_CORTE_INTENT_EARLY.jsx`, MD5 `41cc33d8ba5129fe06e61bd482528096`, 55.810 líneas, 2.98 MB. Es el piso sellado: capstone (inversa de cartera) + intent layer v1 + early gate v2. **Este archivo es la verdad de referencia; el founder lo tiene.**

**Estrategia:** strangler refactor por capas. 74% del código es puro (sin React); la frontera motor/UI es limpia (0 fugas reales). Plan de 6 fases.

**Fases COMPLETAS y auditadas (byte-idénticas al piso):**
- **Fase 2 · Datos/config:** 7 datasets byte-idénticos, 15 FEATURE_* flags, 5 labels, ontología (solo CONCEPT_ONTOLOGY + SEMANTIC_FAMILIES). Diferido: Memoria Org + semántica extendida.
- **Fase 3 · Motor puro:** applyScenarioTo* (×3 escenarios), deriveKpis, detectInternalDriver, _familyInventoryAgg ($135K sellado), formatters (fix de escala gateado intacto). Sin React. 18/18 idénticos.
- **Fase 4 · ADI conversacional + `answerADI`:** API pública `answerADI(question, context, state) → { text, route, ... }`. Cubre TODO el camino crítico byte-idéntico al piso:
  - 10 básicos → overview (early gate / late layer)
  - 6 anclas → client_dive, warehouse_comparison, inverse (entidad + cartera), ranking_extremes, brand_dive
  - 3 operaciones con número → defer
  - Agregadores de bodega extraídos (Santiago $63.8K/DOH29, etc. sellados)
  - Batería del ejecutor: 76 OK · 0 fallas

**El árbol `src/` ya extraído (34 archivos · todos auditados):**
```
src/
├── data/        (4)  demoData.js · catalogs.js · baseKpis.js · skusMargen.js
├── config/      (12) features.js · voiceFlags.js · scenarios.js · ontology.js · labels.js ·
│                     mechanisms.js · primitives.js · signalRules.js · intentsRegistry.js ·
│                     routerData.js · rankingData.js · cognitiveData.js
├── engine/      (6)  scenarios.js · metrics.js · inventory.js · portfolio.js · signals.js · formatters.js
└── adi/         (12) answerADI.js · router.js · detectors.js · helpers.js · intentLayer.js ·
                      composers/{overview,thesis,warehouse,brand,clientDive,inverse,ranking}.js
```
**El founder tiene estos archivos** (los entregó el ejecutor anterior en zips). Pegalos en `src/` con esa estructura exacta. Los imports ya están escritos para ese árbol (rutas relativas `../config/`, `../../data/`, etc.).

**Diferido (NO se toca en este refactor · entra después como bloque aparte):** Memoria Organizacional (`Org*`, 2.637 líneas), semántica extendida (SEMANTIC_GLOSSARY, BUSINESS_PATTERNS, ECONOMIC_TENSIONS, CAUSAL*). El camino crítico NO depende de ellos (verificado por cierre transitivo).

---

## 2 · Lo que falta · Fase 5 · UI

Extraer la UI desde el monolito `41cc33d8`. La UI **consume** `answerADI` y las funciones del motor — **NO recalcula nada**.

Crear:
- `src/ui/App.jsx` — el componente raíz `ADISentric` (estado de UI: escenario, contexto, módulo activo, filtros).
- `src/ui/ChatADI.jsx` — `PanelADI` **adelgazado**: solo la cáscara React (input, transcript, typewriter). El patrón clave: lo que el PanelADI del monolito hacía como `setX(...) + return` dentro del handler, ahora es `const r = answerADI(question, context, state); aplicar setX con r.text/r.route/...`. La decisión vive en `answerADI` (ya extraído); PanelADI solo renderiza y aplica el resultado.
- `src/ui/DataPanel.jsx` — el panel derecho (Sentrix).
- `src/ui/modules/{ventas,margenes,inventario}/` — los `Modulo*` + sus tablas/gráficos/drills (presentación pura de datos).

**Componentes UI a extraer del monolito** (50 defs, ~12.188 líneas): ADISentric, PanelADI, ModuloVentas/Margenes/Inventario, FocoInventario, las tablas (TablaTop10*, TablaGeneral*, TablaBloque80*), gráficos (Pareto*, Grafico*, AnimatedChart), drills (Drill*), KpiCard, Card, MultiSelect, FiltrosGlobales, ScenarioSelector, ContextSelector, TypewriterText, InfoTip, renderMarkdownLite, useAnimatedPareto.

**Criterio Fase 5:** lo que la UI muestra sale de `answerADI`/motor, idéntico a lo que da headless. La UI no contiene lógica de cálculo ni de ruteo.

---

## 3 · Lo que falta · Fase 6 · App ejecutable (Victoria 2)

Montar en Vite:
- `package.json`, `vite.config.js`, `index.html`, `src/main.jsx`.
- `npm install` → `npm run dev` → URL local.
- **Acá es donde tu entorno (PC real) hace la diferencia:** podés correr esto de verdad y el founder ve el ADI completo en el navegador.

**Victoria 2:** el founder abre la URL local y ve el ADI funcionando — early gate, dives, panorama, todo ejecutándose de verdad (no simulado). Por primera vez el ADI completo corre observable.

---

## 4 · Método de verificación (en cada fase · innegociable)

**Arnés paralelo:** por cada función/composer extraído, una batería que corre la MISMA entrada contra (a) el monolito `41cc33d8` y (b) el módulo, y compara salida byte a byte. La red existente: la batería headless del ejecutor anterior (76 OK en Fase 4) — extendela, no la reduzcas.

Para Fase 5/6, además: verificar que la UI renderizada muestre las MISMAS cifras que `answerADI` da headless. Una query en la UI y la misma en Node deben dar idéntico.

**Cómo probar `answerADI` headless (ejemplo):**
```js
import { answerADI } from "./src/adi/answerADI.js";
const r = answerADI("cómo están las ventas", {}, { scenario: "bonanza" });
// r.text debe ser byte-idéntico al early gate del monolito
// r.route === "early_gate"
```
El camino crítico a no romper: 10 básicos (early_gate/late_layer) + 6 anclas (client_dive, warehouse_comparison, inverse_projection ×2, ranking_extremes, brand_dive) + 3 operaciones (defer). Todos byte-idénticos al piso.

---

## 5 · Reglas de oro (repetir antes de cada commit)

1. **Misma entrada → misma salida que `41cc33d8`.** Si una query da distinto, es bug de extracción → arreglar para volver a coincidir.
2. **La UI consume, no recalcula.** Toda cifra sale de `answerADI`/motor.
3. **No agregar features.** No cambiar fórmulas, cifras, ni textos esperados (salvo diferencias inevitables de extracción, reportadas).
4. **Fixes gateados intactos** (escala de inventario, DOH, override): se extraen tal cual con su flag, no se "limpian". Limpiarlos = corte, no refactor.
5. **El motor puro (`engine/`, `adi/` salvo un eventual `context.js`) NO importa React.**
6. **El piso `41cc33d8` y el respaldo `1462ddb1` quedan intactos.** Nunca se editan.
7. **Diferido se queda diferido:** Memoria Org + semántica extendida no entran en este refactor.

---

## 6 · Orden de trabajo para Claude Code

1. **Armá el árbol:** creá `src/` con la estructura de §1 y pegá los 34 archivos ya auditados que tiene el founder. Confirmá que `import { answerADI } from "./src/adi/answerADI.js"` resuelve y que el camino crítico da byte-idéntico (corré la batería headless del founder).
2. **Fase 5 · UI:** extraé los componentes del monolito, PanelADI adelgazado consumiendo `answerADI`. Batería: UI muestra == answerADI headless.
3. **Fase 6 · Vite:** `package.json` + config + `npm run dev`. El founder abre la URL y ve el ADI.
4. **En cada paso:** batería verde contra `41cc33d8` antes de avanzar. Reportá toda diferencia clasificada.

**Después del refactor (no ahora):** el panel Evidencia (margen de cliente, contrato motor↔panel) entra como primer feature sobre la base modular — será la prueba de fuego de la arquitectura. Y la Memoria Org + semántica como bloque diferido.

---

## 7 · Cómo se dirige esto

El founder lleva tus entregas (o el estado del repo) al arquitecto en el chat, que audita contra `41cc33d8` y aprueba cada fase antes de avanzar. Vos ejecutás en la PC; el arquitecto verifica byte-identidad; el founder sella viendo correr la app. La disciplina que trajo el refactor hasta acá sin una sola diferencia de valor se mantiene: **medir antes de mover, verificar después de mover, nunca aprobar sobre reporte — siempre sobre la corrida real.**

**Lección que costó horas y no se repite:** el monolito de 3 MB NO se ejecuta como artifact (se lee y se simula, infiel). Por eso vamos a módulos + Vite: para que el ADI **se ejecute de verdad** y cada sello sea sobre algo que corre, no que se lee.
