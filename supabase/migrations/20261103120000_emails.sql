-- E-mails (Resend): registro do que já foi enviado, descadastro e fila diária de relacionamento.
-- As funções com p_segredo exigem o segredo do servidor (mesmo hash da migração de pagamentos).

alter table public.perfis add column recebe_dicas boolean not null default true;

create table public.emails_enviados (
  user_id uuid not null references auth.users (id) on delete cascade,
  tipo text not null,
  ref text not null default '',               -- ex.: data de vencimento (vence_3d, venceu)
  enviado_em timestamptz not null default now(),
  primary key (user_id, tipo, ref)
);
alter table public.emails_enviados enable row level security;
create policy "emails: dono lê" on public.emails_enviados for select to authenticated using (user_id = (select auth.uid()));

create function public.segredo_ok(p_segredo text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select encode(sha256(convert_to(coalesce(p_segredo, ''), 'UTF8')), 'hex')
       = '1cfe27b4c284c40bce368778361a13105aecbbac3d47778c917dad2bfef46123';
$$;

-- Marca um e-mail único do próprio usuário (boas-vindas, créditos). true = ainda não tinha sido enviado.
create function public.marcar_email(p_tipo text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  n int;
begin
  if auth.uid() is null or p_tipo not in ('boas_vindas', 'creditos_acabando', 'gratis_esgotado') then return false; end if;
  insert into public.emails_enviados (user_id, tipo) values (auth.uid(), p_tipo) on conflict do nothing;
  get diagnostics n = row_count;
  return n > 0;
end;
$$;

-- Registro feito pelo servidor (cron, pagamentos)
create function public.registrar_email(p_segredo text, p_user uuid, p_tipo text, p_ref text default '')
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  n int;
begin
  if not public.segredo_ok(p_segredo) then raise exception 'não autorizado'; end if;
  insert into public.emails_enviados (user_id, tipo, ref) values (p_user, p_tipo, coalesce(p_ref, '')) on conflict do nothing;
  get diagnostics n = row_count;
  return n > 0;
end;
$$;

-- Descadastro das dicas (link no rodapé dos e-mails de relacionamento)
create function public.sair_emails(p_segredo text, p_user uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.segredo_ok(p_segredo) then raise exception 'não autorizado'; end if;
  update public.perfis set recebe_dicas = false where id = p_user;
end;
$$;

-- Fila do dia: quem deve receber cada e-mail agendado (ainda não enviado)
create function public.fila_emails(p_segredo text)
returns table (user_id uuid, email text, nome text, tipo text, ref text, ate timestamptz)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.segredo_ok(p_segredo) then raise exception 'não autorizado'; end if;
  return query
  with contas as (
    select u.id, u.email::text as email, coalesce(p.nome, split_part(u.email, '@', 1)) as nome, u.created_at,
           coalesce(p.recebe_dicas, true) as dicas, public.tem_plano(u.id) as plano
    from auth.users u left join public.perfis p on p.id = u.id
    where u.email_confirmed_at is not null and u.email is not null
  ),
  candidatos as (
    select c.id, c.email, c.nome, 'dica_d1'::text as tipo, ''::text as ref, null::timestamptz as ate from contas c
    where c.dicas and c.created_at between now() - interval '3 days' and now() - interval '1 day'
      and not exists (select 1 from public.uso_pesquisas s where s.user_id = c.id) and not c.plano
    union all
    select c.id, c.email, c.nome, 'casos_d3', '', null from contas c
    where c.dicas and c.created_at between now() - interval '6 days' and now() - interval '3 days' and not c.plano
    union all
    select c.id, c.email, c.nome, 'oferta_d7', '', null from contas c
    where c.dicas and c.created_at between now() - interval '14 days' and now() - interval '7 days' and not c.plano
    union all
    select c.id, c.email, c.nome, 'vence_3d', a.valido_ate::date::text, a.valido_ate
    from contas c join public.assinaturas a on a.user_id = c.id
    where not a.recorrente and a.ciclo <> 'manual' and a.valido_ate between now() + interval '2 days' and now() + interval '3 days'
    union all
    select c.id, c.email, c.nome, 'venceu', a.valido_ate::date::text, a.valido_ate
    from contas c join public.assinaturas a on a.user_id = c.id
    where c.dicas and a.ciclo <> 'manual' and a.valido_ate between now() - interval '2 days' and now() - interval '1 day'
  )
  select k.id, k.email, k.nome, k.tipo, k.ref, k.ate from candidatos k
  where not exists (select 1 from public.emails_enviados e where e.user_id = k.id and e.tipo = k.tipo and e.ref = k.ref)
  limit 500;
end;
$$;

revoke execute on function public.marcar_email(text), public.registrar_email(text, uuid, text, text),
  public.sair_emails(text, uuid), public.fila_emails(text) from public, anon;
grant execute on function public.marcar_email(text) to authenticated;
grant execute on function public.registrar_email(text, uuid, text, text), public.sair_emails(text, uuid),
  public.fila_emails(text) to anon, authenticated;
