-- Ejecutar una sola vez en un proyecto Supabase NUEVO dedicado a CSLB Mediateca.
begin;
create table public.profiles (
 id uuid primary key references auth.users(id) on delete cascade,
 name text not null check (char_length(name) between 1 and 80),
 role text not null default 'student' check (role in ('student','teacher','owner'))
);
create table public.categories (
 id uuid primary key default gen_random_uuid(),
 name text not null check (char_length(btrim(name)) between 1 and 60),
 description text not null default '' check (char_length(description)<=200)
);
create table public.media (
 id uuid primary key default gen_random_uuid(),
 title text not null check (char_length(btrim(title)) between 1 and 120),
 description text not null default '' check (char_length(description)<=2000),
 category uuid not null references public.categories(id),
 path text not null unique,
 kind text not null check (kind in ('audio','video')),
 mime text not null,
 size bigint not null check(size>0 and size<=52428800),
 owner uuid not null references auth.users(id),
 author text not null,
 created timestamptz not null default now()
);
create table public.comments (
 id uuid primary key default gen_random_uuid(),
 media uuid not null references public.media(id) on delete cascade,
 body text not null check (char_length(btrim(body)) between 1 and 3000),
 author text not null,
 owner uuid not null references auth.users(id),
 created timestamptz not null default now()
);
create index media_category_idx on public.media(category);
create index comments_media_idx on public.comments(media);
create function public.on_new_user() returns trigger language plpgsql security definer set search_path='' as $$
begin
 insert into public.profiles(id,name) values(new.id,left(coalesce(nullif(btrim(new.raw_user_meta_data->>'name'),''),'Estudiante'),80));
 return new;
end;$$;
create trigger mediateca_new_user after insert on auth.users for each row execute function public.on_new_user();
insert into public.profiles(id,name) select id,left(coalesce(nullif(btrim(raw_user_meta_data->>'name'),''),'Estudiante'),80) from auth.users;
create function public.is_teacher() returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.profiles where id=auth.uid() and role in ('teacher','owner'));
$$;
create function public.is_owner() returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.profiles where id=auth.uid() and role='owner');
$$;
create function public.prepare_media() returns trigger language plpgsql security definer set search_path='' as $$
declare obj record;
begin
 if auth.uid() is null or split_part(new.path,'/',1)<>auth.uid()::text then raise exception 'Ruta no autorizada'; end if;
 select * into obj from storage.objects where bucket_id='mediateca' and name=new.path;
 if not found then raise exception 'Primero sube el archivo'; end if;
 new.mime:=obj.metadata->>'mimetype';
 if new.mime not in ('audio/mpeg','audio/mp4','audio/wav','audio/x-wav','audio/ogg','audio/webm','video/mp4','video/webm','video/ogg') then raise exception 'Formato no compatible'; end if;
 new.size:=(obj.metadata->>'size')::bigint;
 new.kind:=case when new.mime like 'audio/%' then 'audio' else 'video' end;
 new.owner:=auth.uid();
 select name into new.author from public.profiles where id=auth.uid();
 new.created:=now();
 return new;
end;$$;
create trigger media_author before insert on public.media for each row execute function public.prepare_media();
create function public.prepare_comment() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if not public.is_teacher() then raise exception 'Solo profesores'; end if;
 new.owner:=auth.uid();
 select name into new.author from public.profiles where id=auth.uid();
 new.created:=now();
 return new;
end;$$;
create trigger comment_author before insert on public.comments for each row execute function public.prepare_comment();
create function public.list_teachers() returns table(email text) language sql stable security definer set search_path='' as $$
 select u.email::text from auth.users u join public.profiles p on p.id=u.id where p.role='teacher' and public.is_owner() order by u.email;
$$;
create function public.set_teacher(teacher_email text,remove_role boolean default false) returns void language plpgsql security definer set search_path='' as $$
declare target uuid;
begin
 if not public.is_owner() then raise exception 'Solo el administrador principal puede asignar roles'; end if;
 select id into target from auth.users where lower(email)=lower(btrim(teacher_email)) and email_confirmed_at is not null;
 if target is null then raise exception 'El profesor debe registrarse y confirmar su correo primero'; end if;
 if exists(select 1 from public.profiles where id=target and role='owner') then raise exception 'No se puede cambiar el rol del administrador principal'; end if;
 update public.profiles set role=case when remove_role then 'student' else 'teacher' end where id=target and role<>'owner';
end;$$;
alter table public.profiles enable row level security;
alter table public.categories enable row level security;
alter table public.media enable row level security;
alter table public.comments enable row level security;
revoke all on public.profiles,public.categories,public.media,public.comments from anon,authenticated;
grant select on public.profiles to authenticated;
grant select,insert on public.categories,public.comments to authenticated;
grant select,insert,delete on public.media to authenticated;
create policy profiles_self on public.profiles for select to authenticated using(id=auth.uid());
create policy categories_read on public.categories for select to authenticated using(true);
create policy categories_teacher on public.categories for insert to authenticated with check(public.is_teacher());
create policy media_read on public.media for select to authenticated using(true);
create policy media_upload on public.media for insert to authenticated with check(owner=auth.uid());
create policy media_remove on public.media for delete to authenticated using(owner=auth.uid() or public.is_teacher());
create policy comments_read on public.comments for select to authenticated using(true);
create policy comments_teacher on public.comments for insert to authenticated with check(owner=auth.uid() and public.is_teacher());
revoke execute on function public.is_teacher(),public.is_owner(),public.list_teachers(),public.set_teacher(text,boolean) from public,anon;
grant execute on function public.is_teacher(),public.is_owner(),public.list_teachers(),public.set_teacher(text,boolean) to authenticated;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('mediateca','mediateca',false,52428800,array['audio/mpeg','audio/mp4','audio/wav','audio/x-wav','audio/ogg','audio/webm','video/mp4','video/webm','video/ogg']);
create policy mediateca_read on storage.objects for select to authenticated using(bucket_id='mediateca');
create policy mediateca_upload on storage.objects for insert to authenticated with check(bucket_id='mediateca' and (storage.foldername(name))[1]=auth.uid()::text);
create policy mediateca_remove on storage.objects for delete to authenticated using(bucket_id='mediateca' and ((storage.foldername(name))[1]=auth.uid()::text or public.is_teacher()));
insert into public.categories(name,description) values
 ('Música y expresión','Interpretaciones, composiciones y creaciones sonoras.'),
 ('Ciencias y tecnología','Experimentos, descubrimientos y proyectos.'),
 ('Lenguaje y literatura','Lecturas, relatos y comunicación.'),
 ('Historia y comunidad','Nuestra memoria, nuestro entorno y nuestras ideas.');
commit;
