# Apariencia del perfil: temporadas y colores personalizados

El Estudio de Perfil permite elegir ocho habitaciones, doce avatares de galería,
seis wallpapers y ocho colores predefinidos, además de un color `#RRGGBB` libre.
Los SVG son locales y las decoraciones de las habitaciones son estáticas.

## Migración 025

Ejecuta el contenido completo de
`supabase/migrations/202610110025_custom_themes_and_seasonal_rooms.sql`
en el SQL Editor del proyecto Supabase. La migración es transaccional y se puede
repetir. Amplía los CHECK sin cambiar RLS ni los permisos existentes.

También traslada los respaldos de apariencia válidos a `theme_color` y `room_theme`,
y elimina su clave reservada sin alterar los enlaces sociales del jugador.

## Compatibilidad antes de la migración

El servidor intenta guardar los valores reales. Solo ante un error CHECK `23514`
y una apariencia extendida validada, reintenta con columnas compatibles y añade
`_savestate_appearance: "v1:COLOR:HABITACION"` a `social_links`.

La clave es metadato administrado por el servidor: no se acepta como enlace del
formulario ni se muestra en el perfil. La lectura del perfil público, Ajustes y
la respuesta del guardado restauran los valores extendidos y separan los enlaces.
Las guardadas siguientes regeneran el respaldo cuando sea necesario. Un guardado
que ya admita los valores nativos elimina el respaldo.

Las pruebas de `profileMutation` cubren tanto el esquema antiguo como el ampliado,
la conservación de enlaces y el rechazo de medios, colores y cosméticos inválidos.
La revisión visual usa un perfil temporal local sin guardar datos en Supabase.
