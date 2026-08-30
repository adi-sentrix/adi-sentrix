# Baja de una empresa · el borrado total, escrito

**Por qué existe este documento (owner 2026-08-30):** el borrado en ADI es un acto deliberado — las tablas no
tienen permiso de borrado justamente para que nada se pierda en silencio. Pero «deliberado» sin procedimiento
escrito es «improvisado el día que pase». Este es el procedimiento. La pregunta del cliente que responde:
**«¿y si me voy?»**.

**Cuándo se ejecuta:** a pedido del cliente (por escrito), o al cierre de la relación comercial. Lo ejecuta el
administrador del proyecto (el owner) en el panel de Supabase. Nada de esto es automatizable a propósito: borrar
una empresa entera no debe ser un botón.

---

## 1 · Confirmar QUÉ empresa y QUÉ hay

En el SQL Editor, con el id de la empresa (ej. `'empresa-x'`):

```sql
select t.id, t.nombre,
       (select count(*) from public.uploads u where u.tenant_id = t.id)           as archivos,
       (select count(*) from public.fact_pack_versions f where f.tenant_id = t.id) as versiones,
       (select count(*) from public.memberships m where m.tenant_id = t.id)        as membresias
  from public.tenants t
 where t.id = 'empresa-x';
```

Anotar los conteos: son lo que el paso 4 verifica en cero.

## 2 · Borrar los ARCHIVOS ORIGINALES del depósito

⚠️ **Este paso va PRIMERO y es el único que la base no arrastra sola**: los objetos de Storage no se borran en
cascada. En el panel: **Storage → adi-originales → carpeta `empresa-x/`** → seleccionar todo → Delete.
O por SQL:

```sql
delete from storage.objects
 where bucket_id = 'adi-originales'
   and name like 'empresa-x/%';
```

## 3 · Borrar la EMPRESA — la base arrastra el resto

Un solo borrado: `memberships`, `uploads` y `fact_pack_versions` declaran `on delete cascade` contra
`tenants`, así que caen con la fila madre. (Verificado contra `001_esquema_base.sql`.)

```sql
delete from public.tenants where id = 'empresa-x';
```

Con esto mueren también los accesos: un código vigente de esa empresa seguirá siendo un JWT válido hasta su
vencimiento, pero **no tiene ninguna fila que leer** — el muro RLS devuelve vacío para un tenant que no existe.
Si igual se quiere invalidar TODO código emitido (de todas las empresas), el botón rojo es rotar
`ADI_TOKEN_SECRET` en Vercel; es global y expulsa a todos, usar solo si corresponde.

## 4 · VERIFICAR el cero — la parte que convierte esto en un hecho

```sql
select
  (select count(*) from public.tenants            where id = 'empresa-x')        as tenant,
  (select count(*) from public.uploads            where tenant_id = 'empresa-x') as archivos,
  (select count(*) from public.fact_pack_versions where tenant_id = 'empresa-x') as versiones,
  (select count(*) from public.memberships        where tenant_id = 'empresa-x') as membresias,
  (select count(*) from storage.objects where bucket_id = 'adi-originales'
      and name like 'empresa-x/%')                                               as originales;
```

**Las cinco columnas en 0.** Guardar captura o resultado como constancia, y confirmar al cliente por escrito.

## 5 · Lo que queda FUERA de este borrado — decirlo, no esconderlo

- **Backups de la plataforma**: Supabase mantiene respaldos de la base por su ventana de retención propia
  (días). El dato borrado desaparece de ellos cuando la ventana rota. Si el cliente exige constancia, se le
  dice esta verdad — no se promete lo que la plataforma no hace.
- **El proveedor del modelo**: las lecturas curadas que viajaron en consultas pasadas se rigen por la retención
  limitada del proveedor según sus términos comerciales; no se usan para entrenar. Los datos nuevos ya no
  viajan: la empresa no existe.
- **Lo que el cliente descargó** (su propia planilla, capturas): es suyo, siempre lo fue.

---

*Este procedimiento acompaña al documento de seguridad para clientes («Tus datos en ADI»). Si el esquema suma
tablas con `tenant_id`, este runbook DEBE actualizarse en el mismo cambio — regla de la casa: una tabla nueva
con datos de empresa que no esté en el paso 4 es un borrado que miente.*
