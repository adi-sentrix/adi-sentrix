# ADI · Plan del flujo CORE + NOTARIO + KNOWLEDGE → ENTREGA → LLM → USUARIO

> Owner 2026-09-25: «Nuestro trabajo para complemento que funcionará con un LLM es que este flujo sea de altísimo nivel.»
> Deriva de `_ADI_LLMBUSINESS_PLAN.md` (marco aprobado 2026-09-22). Estado: propuesta del supervisor, pendiente de
> aprobación del owner.

## 0 · La regla que ordena todo

**La comprensión del lenguaje es del LLM. La verdad es de ADI.** El LLM (el anfitrión en el Complemento, el agente en
ADI directo) entiende lo que el usuario quiso decir y se lo pide a ADI en forma estructurada. ADI no interpreta prosa:
calcula, verifica y entrega. Todo problema del tipo «ADI no entendió la pregunta» se resuelve en el contrato con el
LLM, nunca agregando vocabulario al código determinístico (ver memoria `adi-no-desviarse-deterministico`).

## 1 · Los tres contratos del flujo

| Contrato | Quién → quién | Qué fija | Estado hoy |
|---|---|---|---|
| **1 · Solicitud** | LLM → ADI | Qué recibe ADI: la pregunta original y la interpretación del LLM, tipada: temas, conceptos (métricas del registro), entidades con su eje (cliente, SKU, marca, familia, bodega, canal), período, cierre pedido (cifra · lectura · decisión), criterio/lente si se dio. ADI valida cada campo contra el registro y el índice del tenant: lo que resuelve, lo usa; lo que no, lo **devuelve declarado** («no existe la entidad X», «no hay dato mensual»), nunca lo adivina. | **No existe.** Hoy ADI adivina la pregunta desde la prosa. |
| **2 · Entrega** | ADI → LLM | Las siete partes (Marco · Respuesta · Cifras · Lo que no se puede concluir · Referencia del oficio · Para su juicio · Qué más puedo calcular), escritas por ADI sin modelo, verificadas por el Notario antes de salir, con el Knowledge por pertinencia por encargo. | **Parcial.** Compositor con 4 rutas fijas (`src/adi/entrega/componer.js`), bandera `ADI_ENTREGA` apagada. Libro rico, perfil, verificador exacto, PRI-04 y CAU-01 firmadas: listos. |
| **3 · Uso** | LLM → usuario | Qué puede y qué no puede hacer el LLM con la Entrega: citar ▸ tal cual, no calcular cifras nuevas (pedirlas a ADI), respetar las negativas, ejercer juicio en «Para su juicio», no convertir la referencia en meta. Y cómo se mide cuánto sobrevive (prueba de paráfrasis). | **Solo en diseño** (§1 y §6 del plan LLMBusiness). |

## 2 · Fases

| Fase | Qué se construye | Cómo se prueba | Gasto |
|---|---|---|---|
| **F1 · Contrato de solicitud** | Esquema tipado de la solicitud, validador contra el registro de dominios y el índice de entidades del tenant, respuesta estructurada de lo no resuelto. Una sola puerta: la usan el Complemento (herramienta del anfitrión) y ADI directo (el agente la llena). | Catálogo de solicitudes estructuradas (no frases): válidas, con entidad inexistente, período inexistente, concepto ausente (tesorería), varias entidades. Cero adivinanza. | Gratis |
| **F2 · Compositor general de la Entrega** | La Entrega para **cualquier** solicitud válida, no para 4 preguntas fijas: las siete partes armadas desde el libro por tema × concepto × entidad, con prioridad integrada cuando se pide decisión, negativas como hallazgos, Knowledge por encargo, «Qué más puedo calcular» con ofertas. | Catálogo de ~40 solicitudes CFO (las que haría un controller): cada Entrega sin cifras sin dueño, sin hechos omitidos, cada hueco declarado, Notario verde. | Gratis |
| **F3 · Knowledge** | Pieza 3 en adelante (CAU-06 SKU frenado vs top seller; CAU-03 como marcador), con PRI-04 y CAU-01 como vara. Sesiones con owner y socio. | La vara de las piezas firmadas: cifras del libro, piso con dueño, tres veredictos, bloque, pertinencia por encargo. | Horas del owner y socio |
| **F4 · Contrato de uso + puerta del Complemento** | Instrucciones de uso que viajan con la Entrega; la herramienta/endpoint del Complemento con identidad (tenant desde el token, nunca de un argumento) y solo los hechos que la solicitud necesita. | Seguridad offline; el uso real se mide en F5. | Gratis |
| **F5 · Prueba de paráfrasis (ÚLTIMA)** | Un modelo avanzado, Entregas reales, frases naturales de usuarios: acá recién se mide la comprensión del LLM + la verdad de ADI + cuánto sobrevive. | Umbrales del plan LLMBusiness §4. | **Gasto nombrado, autorizado por el owner** |

En paralelo, fuera de este flujo y solo con la palabra del owner: aplicar las migraciones 012-014 (perfil, taxonomía,
piso) y la ingesta del perfil.

## 3 · Qué NO se hace

- Nada de vocabulario, cierres, modismos ni reconocedores para entender frases en el determinístico.
- No se mide la comprensión del lenguaje sin el LLM. Offline se miden **solicitudes estructuradas y Entregas**.
- No se reabre el frente de encargo natural ni el piso sin modelo (commits `0349f4aa`, `13adf988` quedan congelados; el
  parche `_parche_congelado_piso_sin_modelo_ronda5.patch` no se aplica).
- No se gasta sin autorización que nombre el gasto. `main` no se mueve sin «deployalo».

## 4 · Decisiones del owner antes de F1

1. ¿Aprueba los tres contratos como la estructura del trabajo (solicitud · Entrega · uso)?
2. ¿Aprueba que la comprensión viva solo en el LLM, y que ADI reciba la pregunta **ya interpretada** (con la pregunta
   original al lado, para trazabilidad)?
3. ¿Aprueba el orden F1 → F2 → F3 → F4 → F5, con Knowledge (F3) avanzando en paralelo según las horas del owner y socio?
