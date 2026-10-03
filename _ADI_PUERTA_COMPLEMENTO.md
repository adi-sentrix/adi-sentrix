# La puerta del Complemento · MCP + OpenAPI sobre las cuatro acciones (Etapa 3, corte 8)

> Estado: CONSTRUIDO, detrás de la bandera `ADI_COMPLEMENTO` (apagada en todos los perfiles). Sin desplegar, sin
> piloto — nada de lo que sigue corre hasta que el owner encienda la bandera y dé la palabra de gasto (la puerta
> misma no gasta: cero llamadas a un modelo, ver más abajo).
>
> **ACTUALIZADO (Etapa 2, bloque 1 · guardado durable, 2026-10-02):** la continuidad ya no es el doble en memoria
> (`continuidadMemoria.js` se retiró en el corte 9): `crearAcciones({ continuidad })` recibe un almacén ASÍNCRONO
> (`continuidad/almacen.js`) y las cuatro acciones se esperan. La puerta usa la memoria DEL PROCESO por defecto (se
> pierde al reiniciar) y, con `ADI_MEMORIA_DURABLE=true` —y la migración 015 aplicada—, arma UN almacén de Supabase POR
> PEDIDO con el pase de la empresa de esa llamada (`manejarPuerta(request, env)`; los candados le pasan una tercera
> costura de inyección, nunca producción). Con la bandera encendida y la base sin responder, las acciones dicen «memoria no
> disponible» (falla cerrado): nunca caen en silencio a la memoria del proceso. Candado: `_guardado_durable_gate.mjs`.

Esta pieza es la PUERTA por la que un anfitrión externo (Claude, ChatGPT) entra a la capacidad de ADI. No lee
prosa, no llama a ningún modelo, no decide nada de negocio: verifica identidad, resuelve el tenant desde el token
y ejecuta una de las cuatro acciones de `src/adi/capacidad/acciones.js`. La comprensión del lenguaje —qué pidió el
usuario, qué encargo tipado arma— la hace el LLM anfitrión, ANTES de llamar acá.

---

## 1 · Las cuatro acciones (qué ve el LLM)

Una sola presentación, sin nombres de mecanismos internos: *«ADI es el asesor de negocio de esta empresa: conoce
sus datos, verifica cada cifra y responde cualquier consulta soportada por lo que calcula.»*

| Acción | Qué hace | Entrada | Salida |
|---|---|---|---|
| `conocerEmpresa` | La ficha de la empresa activa + el catálogo GENERADO (temas, conceptos, ejes, cierres, lo que no calcula y por qué) | `{ conversacionId? }` | `{ empresa, datos, perfil, catalogo, hechosAportados }` |
| `consultar` | Responde CUALQUIER encargo soportado (cifra · lectura · decisión · comparación · simulación · definición) | `{ encargo: Encargo v1 }` | `{ entrega:{texto,json}, noResuelto, uso, meta }` |
| `aportarContexto` | Registra lo que el usuario declaró (perfil, criterio, hecho, documento) | `{ conversacionId?, aportes[], confirmar[] }` | `{ conversacionId, resultados[], estadoVigente }` |
| `retomar` | Recupera el estado de una conversación anterior | `{ conversacionId }` | `{ estadoVigente, hechos, advertencias }` |

El catálogo de `conocerEmpresa` se GENERA del Core real (nunca se escribe a mano): `src/adi/capacidad/catalogo.js`.
Las cuatro acciones viven en `src/adi/capacidad/acciones.js`, con el tenant INYECTADO — nunca leen un token ni
saben qué es un bearer.

---

## 2 · Cómo el owner la conecta

### 2.1 · En Claude (conector MCP por URL)

Claude (claude.ai / Claude Desktop / Claude Code) admite conectores MCP remotos por URL, con autenticación
bearer. Los pasos, una vez que `ADI_COMPLEMENTO=true` esté encendida en el entorno de destino:

1. En la configuración de conectores de Claude, agregar un conector remoto con la URL:
   `https://<dominio-de-adi>/api/adi-capacidad/mcp`
2. Autenticación: **bearer token** = el código de acceso de la sesión (`ADI-{payload}.{firma}`, el MISMO pase que
   ya usa la demo privada — `src/adi/llm/accessToken.js`). Ese código YA declara la empresa (firmado con
   `ADI_TOKEN_SECRET`): la puerta nunca pregunta "de qué empresa sos", lo lee del token.
3. Claude llama `initialize`, después `tools/list` (recibe las 4 herramientas con su `inputSchema` — el mismo
   `MCP_TOOLS` que exporta `puerta.js`) y usa `tools/call` para invocarlas durante la conversación.

No hace falta ningún archivo de configuración adicional del lado de ADI: la puerta responde el protocolo
completo (`initialize` · `tools/list` · `tools/call`) desde un único endpoint.

### 2.2 · En ChatGPT (GPT con Actions, desde el OpenAPI)

1. Crear un GPT (o editar uno existente) → pestaña **Actions** → *Importar desde URL* o *pegar el schema*, apuntando a:
   `https://<dominio-de-adi>/api/adi-capacidad/openapi.json` (GET, sin bearer — es el contrato público, lo que la
   herramienta PUEDE hacer, nunca datos de una empresa).
2. Autenticación de la Action: **API Key → Bearer** con el mismo código de acceso que en Claude. ChatGPT lo manda
   como `Authorization: Bearer <código>` en cada llamada.
3. El documento describe 4 operaciones (`conocerEmpresa`, `consultar`, `aportarContexto`, `retomar`), cada una
   `POST /api/adi-capacidad/<accion-en-kebab>` con su `requestBody` tipado — el GPT elige la operación y arma el
   cuerpo según el `inputSchema`, exactamente la misma forma que ve un conector MCP.
4. En las instrucciones del GPT conviene decirle: *"llamá conocerEmpresa al empezar la conversación; para
   cualquier cifra o análisis, armá un encargo tipado y llamá consultar; nunca inventes un número que consultar
   no te devolvió."*

Los dos canales (MCP y Actions) comparten el MISMO despacho (`puerta.js:_despachar`), la misma identidad, el
mismo catálogo y las mismas cuatro acciones — nunca dos implementaciones que puedan divergir.

---

## 3 · Identidad, tenant y límites (lo que la puerta garantiza)

- **Bearer obligatorio.** `Authorization: Bearer <código>`. Sin bearer, o con un código sin firma válida o
  vencido → `401`, antes de tocar la bandera del Complemento o el cuerpo del pedido.
- **El tenant sale del token, siempre.** La puerta resuelve el tenant llamando a
  `src/data/tenantService.server.js:handleData` — la MISMA función que ya usa `/api/adi-data` para servir el pack
  de una sesión firmada. Si la llamada trae un campo `tenant`/`tenantId`/`empresa`/`company`/`org`/`organizacion`
  en sus argumentos, se IGNORA y se declara en la respuesta (`advertencias`); nunca cambia de qué empresa se sirve.
- **Nunca viaja el archivo del cliente.** Lo único que sale de la puerta es texto y JSON de la Entrega, el
  catálogo (sin cifras) y lo que el usuario aportó — nunca un `.xlsx` ni sus filas.
- **La puerta no llama a ningún modelo.** Cero gasto por diseño: no importa el gateway de LLM ni ningún adapter
  de proveedor (verificado — ninguna dependencia transitiva de `capacidad/acciones.js`/`capacidad/catalogo.js`
  importa `node:*` ni el gateway).
- **Rate limit** por IP confiable (`x-real-ip`) o, si no hay IP, por el propio código de acceso — 30 llamadas por
  ventana de 10 minutos, techo global de 300 por isolate (el mismo patrón, ventana + techo, que ya usa el gateway
  de LLM para `op:mint`). Es defensa best-effort por instancia, no un control durable — la misma salvedad que ya
  deja escrita esa pieza.
- **La bandera `ADI_COMPLEMENTO`** (apagada por defecto) se revisa PRIMERO: apagada, la puerta responde
  `{ok:false, disponible:false, motivo}` para cualquier método, sin ejecutar nada más.

---

## 4 · Qué identificador de sesión exponen hoy Claude y ChatGPT — PREGUNTA ABIERTA

No lo pude verificar: la instrucción de esta pieza es no usar la red, y este repositorio no tiene documentación
propia sobre cómo Claude o ChatGPT identifican una conversación de cara a un conector/Action externo. Lo que sí
puedo dejar escrito, desde lo que la ARQUITECTURA de esta puerta ya asume:

- La puerta **nunca depende de que el canal mande un id de sesión propio** para saber de qué empresa se trata —
  eso lo resuelve el bearer (§3). El `conversacionId` que usan `aportarContexto`/`retomar` lo EMITE ADI (la
  continuidad, hoy el doble en memoria de `capacidad/continuidadMemoria.js`; en producción, la del carril B) — no
  se espera que Claude o ChatGPT traigan un id de threading estable entre llamadas.
- Si alguno de los dos canales SÍ expone un identificador estable de conversación (algo que el LLM pudiera pasar
  de una llamada a la siguiente sin que el usuario lo repita), sería una oportunidad para que `conocerEmpresa`
  reciba ese id como `conversacionId` desde el primer llamado y la continuidad no dependa de que el LLM se acuerde
  de reenviarlo — hoy la puerta no lo asume, así que si no llega, la conversación arranca "nueva" y el LLM tiene
  que reenviar el `conversacionId` que ADI le devolvió.
- **Queda como pregunta para quien lea la documentación oficial de conectores MCP de Claude y de Actions de
  ChatGPT** antes del piloto: ¿hay un header o un campo de protocolo con un id de sesión/hilo estable? Si lo hay,
  es una mejora de UX (menos fricción para retomar), nunca un requisito — la puerta ya funciona sin él.

---

## 5 · Qué falta para la vista privada con datos de demostración

Lo que YA existe y esta pieza reutiliza tal cual (nada de esto se tocó):

- El código de acceso firmado (`ADI-{payload}.{firma}`, `src/adi/llm/accessToken.js`) — el mismo login de la
  demo privada, ahora también sirve como bearer de la puerta.
- La resolución de tenant por sesión (`tenantService.server.js:handleData`/`resolverTenantDeSesion`/`packActivo`)
  — la misma que usa `/api/adi-data`.

Lo que falta, en orden de lo más chico a lo más grande:

1. **Encender la bandera** `ADI_COMPLEMENTO=true` en el entorno de destino (staging primero) — hoy apagada en
   todos los perfiles, a propósito.
2. **Emitir un código de acceso** para la sesión de demostración con `makeAccessCode` (ya existe, ya emite pases
   para la demo privada) — nada nuevo que construir, solo usarlo para este canal también.
3. **Registrar el dominio real** en `construirOpenApi(baseUrl)` — hoy el default es `https://app.adiai.cl`; si el
   piloto corre en otro dominio (staging), pasar ese `baseUrl` al servir `openapi.json` (la puerta ya lo arma con
   el host del propio pedido — `url.protocol`/`url.host` — así que esto es automático mientras la puerta se sirva
   desde el dominio correcto; no hace falta tocar código).
4. **Decidir el límite de la puerta en el proyecto Vercel** (la ruta dinámica `api/adi-capacidad/[accion].js`
   necesita que el proyecto la despliegue como el resto de `api/*` — no hay `vercel.json` que tocar, es
   convención de archivos, pero conviene confirmarlo en el primer deploy a staging).
5. **La certificación del Complemento** (`_ADI_PLAN_PRODUCTO_V2.md` §B3): esta puerta es la SUPERFICIE; falta la
   medición en vivo con el modelo real (gasto nombrado por el owner, etapa 3 del plan) antes de cualquier piloto
   con un cliente. Esta pieza NO la ejecuta — solo la habilita.
6. **La continuidad real** (`aportarContexto`/`retomar`, hoy respaldadas por el doble en memoria de
   `continuidadMemoria.js`): el carril B trae `src/adi/continuidad/`; el día que exista, se inyecta en
   `crearAcciones({ continuidad })` (`src/adi/capacidad/acciones.js`) sin tocar `puerta.js` ni el resto de esta
   pieza — es el punto de enganche que este corte dejó escrito.

---

## 6 · Archivos de esta pieza

- `src/adi/capacidad/catalogo.js` — el catálogo GENERADO desde el Core (temas, conceptos con productor real,
  ejes, cierres, definiciones, lo que no calcula, ausencias, supuestos admitidos, criterios, estados). Sin una
  sola cifra de negocio.
- `src/adi/capacidad/acciones.js` — las cuatro acciones puras (tenant inyectado), con la cabecera de uso para el
  LLM y el punto de enganche de continuidad.
- `src/adi/capacidad/continuidadMemoria.js` — el doble en memoria de la interfaz de continuidad (mientras el
  carril B construye la real).
- `src/adi/capacidad/puerta.js` — el manejador HTTP: identidad, tenant, rate limit, JSON-RPC (MCP) y REST simple
  (Actions), y el generador del documento OpenAPI.
- `api/adi-capacidad/[accion].js` — el envoltorio de Vercel (runtime edge), ruta dinámica.
- `_capacidad_gate.mjs`, `_puerta_gate.mjs` — los candados offline de esta pieza.
