# Studio32 Hub: acceso privado y despliegue

## Arquitectura desplegada

- **Aplicación web:** el frontend mantiene un build vinext y genera una salida estática con Vite para GitHub Pages.
- **Dominio:** `www.hub.studio32.es` apunta a `tsmluky.github.io` mediante CNAME.
- **Acceso:** Supabase Auth mediante las tres cuentas `@studio32.es`. El PIN visible se transforma en una contraseña fuerte antes de enviarse a Auth.
- **Datos compartidos:** Supabase Postgres con políticas que solo permiten entrar a miembros del workspace.
- **Actualizaciones en directo:** Supabase Realtime para conversación, tareas e Inbox.
- **Calendario:** una Edge Function autenticada conecta el Hub con el calendario compartido de Google mediante una cuenta de servicio.
- **Archivos:** Drive continúa siendo el almacén principal; el Hub guarda contexto y enlaces.

## Modelo de acceso

La pantalla inicial muestra a Juanma, Pancho y Gonzalo. Cada miembro selecciona su perfil e introduce un PIN de seis dígitos:

1. Las cuentas se crean con `scripts/bootstrap-supabase.mjs` usando la clave de servicio solo en local.
2. El navegador usa únicamente la clave pública de Supabase.
3. Supabase Auth valida cada sesión y aplica sus límites de autenticación.
4. Cada miembro puede cambiar su PIN desde el botón de llave de su perfil.
5. Las políticas de base de datos comprueban que `auth.uid()` pertenece al workspace de Studio32.
6. La clave de servicio y el archivo de PINes iniciales están ignorados por Git.

Así, conocer la URL no concede acceso y no es necesario desarrollar un sistema propio de contraseñas.

## Entidades de la primera versión compartida

- `workspaces`: el espacio privado de Studio32.
- `workspace_members`: relación entre cuentas y workspace.
- `hub_states`: documento operativo compartido con tareas, agenda, conversación, recursos, Inbox y pizarra.
- `leads`: bandeja de prospección. Cada fila es un negocio con su huella, el porqué y el correo ya redactado, a la espera de aprobación. Tabla aparte y no dentro de `hub_states` a propósito: ese documento se reescribe entero en cada guardado.

Los leads solo entran por el script local de subida, que usa la `service_role`. No hay
política de `insert` para miembros: nada aparece en la bandeja sin pasar por la skill.
Desde el hub se puede decidir y editar el correo, pero no alterar la huella ni el
porqué — la evidencia que justificó el envío tiene que seguir siendo auditable.

`hub_states` incluye revisión y auditoría. Las escrituras usan control optimista para reintentar sobre la última revisión si dos miembros actualizan el Hub al mismo tiempo.

## Alta o recuperación de cuentas

1. Copiar `.env.example` a `.env.local` y completar las claves.
2. Opcionalmente definir `JUANMA_PIN`, `PANCHO_PIN` y `GONZALO_PIN`.
3. Ejecutar `npm run supabase:bootstrap`.
4. Entregar a cada miembro su PIN y pedir que lo cambie en su primera sesión.

La migración SQL versionada está en `supabase/migrations`. La web pública no expone datos sin una sesión válida: RLS es la frontera de seguridad, no el selector de perfiles.

## Publicación web

1. Ejecutar `npm run build:static` con las variables públicas de Supabase.
2. Publicar el contenido de `static-dist` en `tsmluky/studio32-hub-live`.
3. GitHub Pages sirve la rama `main` desde la raíz.
4. El archivo `public/CNAME` mantiene asociado `www.hub.studio32.es`.
5. El repositorio de despliegue solo contiene artefactos compilados; el código fuente permanece en el repositorio privado.

## Google Calendar

El navegador nunca contiene la clave de Google. `supabase/functions/google-calendar` comprueba la sesión, verifica que el usuario pertenece a Studio32 y limita las operaciones al calendario configurado.

Configuración necesaria en Supabase Edge Function Secrets:

- `GOOGLE_CALENDAR_ID`: ID del calendario compartido Studio32.
- `GOOGLE_SERVICE_ACCOUNT_JSON`: contenido completo de la clave JSON de `studio32-agent@studio32-500714.iam.gserviceaccount.com`.

El calendario debe estar compartido con esa cuenta como **Modificar eventos** y Google Calendar API debe estar habilitada en el proyecto de Google Cloud.

Despliegue de la función:

```bash
npx supabase login
npx supabase functions deploy google-calendar --project-ref wwhinwxedcvpxprmcsta
```

Las citas creadas, modificadas o eliminadas desde el Hub se escriben directamente en Google Calendar. Las fechas de tareas permanecen en el Hub y se muestran superpuestas en la vista mensual.
