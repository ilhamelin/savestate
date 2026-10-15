# Bóveda / Memory Card

1. Ejecutar completo `supabase/migrations/202610140032_vault.sql` en Supabase.
2. Configurar las cinco variables R2 de `.env.example` en servidor y Vercel Production. Nunca exponer las claves con `NEXT_PUBLIC_`.
3. Cloudflare → R2 → `savestate-vault` → Settings → CORS policy: aplicar `docs/vault-r2-cors.json`. Si hay reglas para otras aplicaciones, conservarlas y agregar esta regla. Los orígenes no llevan barra final. Añadir el origen exacto si cambia el dominio de producción.
4. Los enlaces R2 son públicos. La galería y las reservas son privadas por propietario. No guardar material confidencial ni asumir que un enlace compartido hereda los permisos del canal de Discord.

Las subidas reservan cuota atómicamente y usan PUT firmado durante cinco minutos, con tamaño, MIME y `If-None-Match: *` firmados. La confirmación verifica tamaño y Content-Type con HEAD antes de publicar en la galería. No se usa el cuerpo de una función Vercel para transportar el archivo. La reserva sigue contando si la conexión falla: desde Subidas pendientes se puede confirmar o eliminar después de cinco minutos. También se limita a 1000 archivos por cuenta. La galería no autoelimina archivos por fallos de red.

Durante los primeros cinco minutos la eliminación devuelve 409: evita que una autorización todavía válida recree el archivo después de liberar su cuota. Eliminar desde la bóveda borra en R2 y después la fila; si falla R2, la cuota no se libera. Los enlaces ya compartidos dejarán de funcionar, aunque terceros pueden conservar copias.

Referencias: [URLs firmadas de R2](https://developers.cloudflare.com/r2/api/s3/presigned-urls/), [CORS](https://developers.cloudflare.com/r2/buckets/cors/), [operaciones condicionales](https://developers.cloudflare.com/r2/api/s3/api/).
