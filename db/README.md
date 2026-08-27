# `db/` — el esquema de la base

Acá vive **lo que la base de datos declara**: las tablas, el muro que aísla a cada empresa y los permisos.
No hay credenciales en esta carpeta y no puede haberlas — hay un candado que se pone rojo si aparecen.

El plan que gobierna estos archivos es la **vía 3** de [`_FRENTE_DATOS_PLANO_VIAS.md`](../_FRENTE_DATOS_PLANO_VIAS.md).

---

## Qué hay

| Archivo | Qué crea |
|---|---|
| `migraciones/001_esquema_base.sql` | Las cuatro tablas, el rol del producto, RLS y los permisos |
| `migraciones/002_storage_originales.sql` | El depósito privado del `.xlsx` original y sus políticas |
| `migraciones/003_activar_version.sql` | Adoptar una versión como un solo acto, y leer la activa |

Se aplican **en orden** y son **idempotentes**: correrlas dos veces no rompe nada ni duplica nada.

## Cómo se comprueba que funciona de verdad

```
node scripts/verificar-supabase.mjs
```

Hace el camino completo contra la base real —guardar, subir el original, activar— y sobre todo prueba lo
único que no se puede simular: que **un pase de otra empresa no pueda leer ni escribir estos datos**.
Necesita las tres variables en el `.env` de la raíz. No gasta nada: habla con Supabase, no con un modelo.

## Cómo se aplican

En el panel de Supabase → **SQL Editor** → pegar el contenido de cada archivo y ejecutar, primero el `001`
y después el `002`. Es la única vez que se usa la llave de servicio.

## La idea que hay que entender antes de tocar esto

**Cada consulta llega con un pase corto que dice de qué empresa es**, y la base filtra por eso. El pase lo
emite el servidor después de verificar el código de acceso; el navegador no puede fabricarlo ni cambiarlo.

Lo importante es cómo falla: si el pase falta, está vencido o viene mal, la base devuelve **cero filas** —
nunca las filas de otra empresa. Esa es la diferencia con confiar en que el código del servidor filtre bien.

## Tres cosas que parecen detalles y no lo son

**No hay permiso de borrado en ningún lado.** Una versión de datos no se pisa: se agrega una nueva y se
marca activa. Volver atrás es marcar activa la anterior.

**Una sola versión activa por empresa, garantizado por la base.** No por una comprobación del servidor que
alguien pueda olvidar: por un índice que hace que dos activas sean imposibles.

**El archivo original se borra a los 12 meses; el pack vive para siempre.** Por eso el pack guarda adentro
de dónde salió cada cifra, como texto. Si guardara una referencia al archivo, en un año ADI no podría
explicar sus propios números.

## Lo que falta y está declarado

La función de retención (`adi.originales_vencidos`) **lista** lo vencido pero no borra nada ni corre sola.
Programarla es trabajo posterior; está escrito así para no prometer una retención que nadie dispara.
