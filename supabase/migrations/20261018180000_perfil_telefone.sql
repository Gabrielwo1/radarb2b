-- Telefone/WhatsApp informado no cadastro (só dígitos, com DDD)
alter table public.perfis add column telefone text
  check (telefone is null or telefone ~ '^[1-9][0-9]9?[0-9]{8}$');

create or replace function public.criar_perfil()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  fone text := nullif(regexp_replace(coalesce(new.raw_user_meta_data ->> 'telefone', ''), '\D', '', 'g'), '');
begin
  insert into public.perfis (id, nome, telefone)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'nome', split_part(new.email, '@', 1)),
    case when fone ~ '^[1-9][0-9]9?[0-9]{8}$' then fone end
  );
  return new;
end;
$$;
