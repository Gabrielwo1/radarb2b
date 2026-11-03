-- Painel de gestão (/admin): acessos diários + consultas agregadas.
-- As funções admin_* exigem o segredo do servidor; o site só as chama para e-mails em ADMIN_EMAILS.

create table public.acessos_diarios (
  user_id uuid not null references auth.users (id) on delete cascade,
  dia date not null default (now() at time zone 'America/Sao_Paulo')::date,
  primary key (user_id, dia)
);
alter table public.acessos_diarios enable row level security;

-- Chamado ao abrir o app (1 linha por usuário por dia)
create function public.registrar_acesso()
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.acessos_diarios (user_id) select auth.uid() where auth.uid() is not null on conflict do nothing;
$$;

-- Visão geral: números, séries de 30 dias, funil, planos e últimos pagamentos
create function public.admin_painel(p_segredo text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  hoje date := (now() at time zone 'America/Sao_Paulo')::date;
  r jsonb;
begin
  if not public.segredo_ok(p_segredo) then raise exception 'não autorizado'; end if;

  with dias as (select generate_series(hoje - 29, hoje, interval '1 day')::date as dia),
  ativos as (select a.* from public.assinaturas a where a.valido_ate > now()),
  aprovados as (select p.* from public.pagamentos p where p.status = 'approved')
  select jsonb_build_object(
    'contas', (select count(*) from auth.users),
    'confirmadas', (select count(*) from auth.users where email_confirmed_at is not null),
    'novas_7d', (select count(*) from auth.users where created_at > now() - interval '7 days'),
    'novas_30d', (select count(*) from auth.users where created_at > now() - interval '30 days'),
    'ativos_hoje', (select count(*) from public.acessos_diarios where dia = hoje),
    'ativos_7d', (select count(distinct user_id) from public.acessos_diarios where dia > hoje - 7),
    'ativos_30d', (select count(distinct user_id) from public.acessos_diarios where dia > hoje - 30),
    'planos', jsonb_build_object(
      'pro_mensal', (select count(*) from ativos where plano = 'pro' and ciclo = 'mensal'),
      'pro_anual', (select count(*) from ativos where plano = 'pro' and ciclo = 'anual'),
      'empresa', (select count(*) from ativos where plano = 'empresa' or ciclo = 'manual'),
      'recorrentes', (select count(*) from ativos where recorrente),
      'avulsas_ativas', (select count(*) from public.consultas_avulsas where valido_ate > now())
    ),
    'mrr', coalesce((select sum(case when ciclo = 'anual' then 712.80 / 12 when ciclo = 'mensal' then 99 else 0 end)
                     from ativos where plano = 'pro'), 0),
    'receita_30d', coalesce((select sum(valor) from aprovados where criado_em > now() - interval '30 days'), 0),
    'receita_total', coalesce((select sum(valor) from aprovados), 0),
    'vendas', jsonb_build_object(
      'avulso', (select count(*) from aprovados where tipo = 'avulso'),
      'pro_mensal', (select count(*) from aprovados where tipo = 'pro_mensal'),
      'pro_anual', (select count(*) from aprovados where tipo = 'pro_anual'),
      'pix_pendentes', (select count(*) from public.pagamentos where status = 'pending')
    ),
    'uso', jsonb_build_object(
      'pesquisas', (select count(*) from public.uso_pesquisas),
      'contatos', (select count(*) from public.uso_contatos),
      'leads_crm', (select count(*) from public.crm_leads)
    ),
    'funil', jsonb_build_object(
      'cadastros', (select count(*) from auth.users),
      'confirmaram', (select count(*) from auth.users where email_confirmed_at is not null),
      'pesquisaram', (select count(distinct user_id) from public.uso_pesquisas),
      'esgotaram', (select count(*) from (select user_id from public.uso_pesquisas group by user_id having count(*) >= 5) x),
      'pagaram', (select count(distinct user_id) from aprovados)
    ),
    'series', (select jsonb_agg(jsonb_build_object(
        'dia', d.dia,
        'cadastros', (select count(*) from auth.users u where (u.created_at at time zone 'America/Sao_Paulo')::date = d.dia),
        'ativos', (select count(*) from public.acessos_diarios a where a.dia = d.dia),
        'pesquisas', (select count(*) from public.uso_pesquisas s where (s.criado_em at time zone 'America/Sao_Paulo')::date = d.dia),
        'receita', coalesce((select sum(valor) from aprovados p where (p.criado_em at time zone 'America/Sao_Paulo')::date = d.dia), 0)
      ) order by d.dia) from dias d),
    'pagamentos', coalesce((select jsonb_agg(x order by x.criado_em desc) from (
        select p.id, p.tipo, p.valor, p.status, p.metodo, p.criado_em, u.email
        from public.pagamentos p join auth.users u on u.id = p.user_id
        order by p.criado_em desc limit 15) x), '[]'::jsonb)
  ) into r;
  return r;
end;
$$;

-- Lista de contas com plano e uso (busca por nome/e-mail/telefone, filtro de plano, paginação)
create function public.admin_contas(p_segredo text, p_busca text default '', p_plano text default '', p_pagina int default 1)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  r jsonb;
begin
  if not public.segredo_ok(p_segredo) then raise exception 'não autorizado'; end if;
  with base as (
    select u.id, u.email::text as email, p.nome, p.telefone, u.created_at, u.last_sign_in_at, u.email_confirmed_at,
      case when a.valido_ate > now() then (case when a.plano = 'empresa' or a.ciclo = 'manual' then 'empresa' else 'pro_' || a.ciclo end) else 'gratis' end as plano,
      a.valido_ate, coalesce(a.recorrente, false) as recorrente,
      (select count(*) from public.uso_pesquisas s where s.user_id = u.id) as pesquisas,
      (select count(*) from public.uso_contatos c where c.user_id = u.id) as contatos,
      (select count(*) from public.crm_leads l where l.user_id = u.id) as leads,
      coalesce((select sum(valor) from public.pagamentos g where g.user_id = u.id and g.status = 'approved'), 0) as pago,
      (select max(dia) from public.acessos_diarios d where d.user_id = u.id) as ultimo_acesso
    from auth.users u
    left join public.perfis p on p.id = u.id
    left join public.assinaturas a on a.user_id = u.id
  ),
  filtrada as (
    select * from base b
    where (coalesce(p_busca, '') = '' or b.email ilike '%' || p_busca || '%' or b.nome ilike '%' || p_busca || '%'
           or b.telefone like '%' || regexp_replace(p_busca, '\D', '', 'g') || '%' and regexp_replace(p_busca, '\D', '', 'g') <> '')
      and (coalesce(p_plano, '') = '' or b.plano = p_plano or (p_plano = 'pagantes' and b.plano <> 'gratis'))
  )
  select jsonb_build_object(
    'total', (select count(*) from filtrada),
    'contas', coalesce((select jsonb_agg(f order by f.created_at desc) from (
        select * from filtrada order by created_at desc limit 50 offset greatest(p_pagina - 1, 0) * 50) f), '[]'::jsonb)
  ) into r;
  return r;
end;
$$;

-- Ficha de uma conta
create function public.admin_conta(p_segredo text, p_user uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.segredo_ok(p_segredo) then raise exception 'não autorizado'; end if;
  return (select jsonb_build_object(
    'id', u.id, 'email', u.email, 'criado_em', u.created_at, 'ultimo_login', u.last_sign_in_at,
    'confirmado_em', u.email_confirmed_at, 'provedor', u.raw_app_meta_data ->> 'provider',
    'nome', p.nome, 'telefone', p.telefone, 'empresa', p.empresa, 'recebe_dicas', p.recebe_dicas,
    'assinatura', (select to_jsonb(a) - 'user_id' from public.assinaturas a where a.user_id = u.id),
    'pagamentos', coalesce((select jsonb_agg(to_jsonb(g) - 'user_id' order by g.criado_em desc) from public.pagamentos g where g.user_id = u.id), '[]'::jsonb),
    'avulsas', coalesce((select jsonb_agg(jsonb_build_object('chave', c.chave, 'valido_ate', c.valido_ate)) from public.consultas_avulsas c where c.user_id = u.id), '[]'::jsonb),
    'pesquisas', coalesce((select jsonb_agg(jsonb_build_object('chave', s.chave, 'em', s.criado_em) order by s.criado_em desc) from public.uso_pesquisas s where s.user_id = u.id), '[]'::jsonb),
    'contatos', (select count(*) from public.uso_contatos c where c.user_id = u.id),
    'crm', coalesce((select jsonb_object_agg(etapa, n) from (select etapa, count(*) n from public.crm_leads l where l.user_id = u.id group by etapa) e), '{}'::jsonb),
    'favoritos', (select count(*) from public.favoritos f where f.user_id = u.id),
    'buscas_salvas', (select count(*) from public.buscas_salvas b where b.user_id = u.id),
    'acessos', coalesce((select jsonb_agg(d.dia order by d.dia desc) from (select dia from public.acessos_diarios x where x.user_id = u.id order by dia desc limit 60) d), '[]'::jsonb),
    'emails', coalesce((select jsonb_agg(jsonb_build_object('tipo', e.tipo, 'em', e.enviado_em) order by e.enviado_em desc) from public.emails_enviados e where e.user_id = u.id), '[]'::jsonb)
  ) from auth.users u left join public.perfis p on p.id = u.id where u.id = p_user);
end;
$$;

revoke execute on function public.registrar_acesso(), public.admin_painel(text), public.admin_contas(text, text, text, int),
  public.admin_conta(text, uuid) from public, anon;
grant execute on function public.registrar_acesso() to authenticated;
grant execute on function public.admin_painel(text), public.admin_contas(text, text, text, int), public.admin_conta(text, uuid)
  to anon, authenticated;
