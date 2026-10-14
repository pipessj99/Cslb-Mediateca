# CSLB Mediateca

Web escolar con el logo original y sus colores, carpetas temáticas, audios y videos, comentarios de retroalimentación y roles de estudiante, profesor y administrador principal.

## Estado

Código adaptado para Next.js y Vercel. **Para activar cuentas, archivos y comentarios hay que conectar Supabase y ejecutar el esquema.** Sin configuración la web muestra un aviso; no simula usuarios ni guarda archivos solo en el navegador. La versión anterior de Sites es independiente: sus cuentas y archivos no se transfieren automáticamente.

## 1. Crear y configurar Supabase

1. Crea un proyecto Supabase nuevo dedicado a esta mediateca.
2. En SQL Editor ejecuta el archivo [`supabase/setup.sql`](supabase/setup.sql) una sola vez. Crea tablas, permisos, cuatro categorías iniciales y un contenedor privado de archivos.
3. Mantén activa la confirmación por correo en Authentication → Providers → Email.
4. En Authentication → URL Configuration configura **Site URL** y **Redirect URLs** con el dominio real que Vercel asigne al despliegue. Añade `http://localhost:3000` solo para desarrollo.

## 2. Importar en Vercel

1. Importa `pipessj99/Cslb-Mediateca` desde GitHub.
2. Framework: **Next.js**. Root Directory: raíz del repositorio. Build: `npm run build`. Output Directory: valor automático.
3. Añade estas variables tanto a Production como a Preview:
   - `NEXT_PUBLIC_SUPABASE_URL`: Project URL de Supabase.
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`: clave pública `anon` o publishable de ese proyecto.
4. Despliega. Si añades las variables después del primer despliegue, haz **Redeploy**: Next.js integra las variables públicas al compilar.

**No pongas `service_role`, secret keys, contraseñas ni tokens privados en variables `NEXT_PUBLIC_*` o en GitHub.** La clave pública es intencionalmente pública: los permisos se aplican en Supabase mediante RLS.

## 3. Activar el administrador principal

Regístrate en la web y confirma tu correo. Después, desde SQL Editor de tu propio proyecto Supabase, reemplaza el correo del siguiente comando por el de tu cuenta confirmada:

```sql
update public.profiles
set role = 'owner'
where id = (
  select id from auth.users
  where lower(email) = lower('TU-CORREO-CONFIRMADO')
    and email_confirmed_at is not null
);
```

Recarga la web. Aparecerá **Gestionar profesores**. Cada profesor debe registrarse y confirmar su cuenta antes de que le asignes el rol por correo. El primer visitante **no** obtiene permisos automáticamente.

## Funciones

- Archivos privados de audio/video de hasta 50 MB; subida directa a Supabase, sin pasar por el límite de cuerpo de Vercel Functions.
- Carpetas por temática y buscador por título o autor.
- Reproducción mediante enlaces temporales de una hora, renovados al abrir cada archivo.
- Comentarios exclusivos de profesores y administrador.
- Los estudiantes pueden borrar sus propios trabajos; los profesores pueden moderar cualquier trabajo. Se elimina también su retroalimentación.
- La biblioteca es visible para las cuentas registradas. No hay restricción automática al dominio escolar: configurar una lista de alumnos o dominio permitido antes de utilizarla como intranet restringida.
- El registro, contraseñas y la confirmación de correo los administra Supabase Auth. No hay formulario de recuperación de contraseña incluido todavía.

## Desarrollo

```sh
npm ci
cp .env.example .env.local
# Completa .env.local con la URL y clave pública de tu proyecto
npm run dev
```

```sh
npm run typecheck
npm run build
```

## Comprobación tras conectar Supabase

1. Registrar y confirmar una cuenta de alumno: puede subir y reproducir archivos, pero no crear categorías ni comentar.
2. Promover la cuenta administradora por SQL, registrar un profesor y asignarle su rol desde la web.
3. Como profesor, crear una categoría y comentar el trabajo de un alumno.
4. Verificar que el alumno ve la retroalimentación y que otro alumno no puede borrar su trabajo.
5. Revisar en otro navegador que los datos son compartidos y persistentes.

La compilación no requiere credenciales. Las pruebas de integración reales requieren un proyecto Supabase configurado; no se consideran realizadas solamente porque la web compile.
