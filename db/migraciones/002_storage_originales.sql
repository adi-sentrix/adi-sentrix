-- === db/migraciones/002_storage_originales.sql · DÓNDE QUEDA EL .XLSX QUE SUBIÓ EL CLIENTE =========
--
-- QUÉ GUARDA. El archivo original tal como llegó, y nada más. El pack calculado NO vive acá: vive en
-- `fact_pack_versions.pack` como jsonb, porque pesa entre 10 y 98 KB y se consulta en cada arranque.
--
-- POR QUÉ SE GUARDA EL ORIGINAL SI YA TENEMOS EL PACK: para poder responder «de dónde salió este
-- número» con el archivo a la vista, y para reprocesar si un día se encuentra un defecto en la ingesta.
-- Las dos cosas dejan de ser posibles a los 12 meses, y por eso el pack tiene que ser autosuficiente.
--
-- LA RUTA ES `{tenant_id}/{upload_id}.xlsx` Y ESO NO ES ORNAMENTAL: la política de más abajo compara la
-- primera carpeta del nombre contra la empresa del pase. La estructura de la ruta ES el control de
-- acceso, así que cambiarla sin cambiar la política abriría el bucket.

insert into storage.buckets (id, name, public)
values ('adi-originales', 'adi-originales', false)
on conflict (id) do nothing;


-- ⚠️ EL BUCKET ES PRIVADO (`public = false`) Y TIENE QUE SEGUIR SIÉNDOLO. Un bucket público sirve
-- cualquier objeto a cualquiera que adivine la URL, sin pasar por RLS ni por el pase: sería devolver
-- el archivo de contabilidad de un cliente a quien pruebe identificadores. La política de acá abajo no
-- protege nada si el bucket se marca público.

drop policy if exists originales_leer_del_pase     on storage.objects;
drop policy if exists originales_escribir_del_pase on storage.objects;

-- `split_part(name, '/', 1)` en vez del ayudante `storage.foldername()` a propósito: es SQL llano, se
-- entiende sin conocer las funciones de Supabase y no se rompe si esa función cambia de forma.
create policy originales_leer_del_pase on storage.objects
  for select
  using (
    bucket_id = 'adi-originales'
    and split_part(name, '/', 1) = adi.tenant_actual()
  );

create policy originales_escribir_del_pase on storage.objects
  for insert
  with check (
    bucket_id = 'adi-originales'
    and split_part(name, '/', 1) = adi.tenant_actual()
  );

-- ⚠️ NO HAY POLÍTICA DE `delete`, IGUAL QUE EN LAS TABLAS. Borrar un original vencido es la tarea de
-- retención (`adi.originales_vencidos`), que corre con la llave de servicio. Una sesión no borra
-- archivos: solo sube el suyo y lee el suyo.
