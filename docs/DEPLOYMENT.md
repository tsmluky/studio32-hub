# Studio32 Hub: acceso privado y despliegue

## Arquitectura recomendada

- **Aplicación web:** el frontend de Vite se publica en Vercel o Cloudflare Pages.
- **Dominio:** `hub.studio32.es` apunta al proveedor mediante un registro CNAME.
- **Acceso:** Supabase Auth con enlace mágico por correo. No hay contraseñas que mantener.
- **Datos compartidos:** Supabase Postgres con políticas que solo permiten entrar a miembros del workspace.
- **Actualizaciones en directo:** Supabase Realtime para conversación, tareas e Inbox.
- **Archivos:** Drive continúa siendo el almacén principal; el Hub guarda contexto y enlaces.

## Modelo de acceso

La pantalla inicial muestra a Juanma, Pancho y Gonzalo. Cada miembro selecciona su perfil e introduce un PIN de seis dígitos. En el prototipo el PIN se configura y valida localmente; en producción:

1. Se desactiva el registro público en Supabase.
2. Un administrador invita las tres direcciones de correo del equipo.
3. El primer acceso en un dispositivo se confirma mediante el correo `@studio32.es` y permite configurar el PIN.
4. Los siguientes accesos se realizan seleccionando el perfil e introduciendo el PIN.
5. El servidor limita los intentos, bloquea temporalmente la cuenta y guarda únicamente el hash del PIN.
6. Las políticas de base de datos comprueban que el usuario pertenece al workspace de Studio32.

Así, conocer la URL no concede acceso y no es necesario desarrollar un sistema propio de contraseñas.

## Entidades de la primera versión compartida

- `profiles`: nombre, avatar y rol del miembro.
- `workspaces`: el espacio privado de Studio32.
- `workspace_members`: relación entre cuentas y workspace.
- `projects`: estado, foco, salud y próximo hito.
- `tasks`: responsable, fecha, prioridad, estado y bloqueo.
- `updates`: mensajes, notas y decisiones vinculadas a un proyecto.
- `resources`: enlaces a Drive, Notion, PDFs y otras referencias.
- `inbox_items`: capturas todavía sin ordenar.
- `board_items`: ideas y elementos de la pizarra de cada proyecto.

Todas las tablas operativas incluyen `workspace_id`. Las políticas RLS deben exigir que `auth.uid()` sea miembro de ese workspace antes de leer o escribir.

## Pasos para publicar

1. Crear el proyecto privado en Supabase y sus tablas.
2. Añadir las variables de `.env.example` al entorno de despliegue.
3. Sustituir la persistencia local por un repositorio Supabase con suscripciones en tiempo real.
4. Invitar las tres cuentas y probar permisos con cada una.
5. Publicar el frontend y conectar `hub.studio32.es`.
6. Añadir `https://hub.studio32.es` a las URL permitidas de Supabase Auth.

No se debe publicar la versión actual como sistema privado: el selector de perfil identifica al usuario en el prototipo, pero no lo autentica.
