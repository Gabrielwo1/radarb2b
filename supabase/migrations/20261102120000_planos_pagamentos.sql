-- Planos e cobrança (Mercado Pago, checkout transparente).
--
-- Grátis (uma vez, como teste): 5 pesquisas, 10 contatos revelados, até a página 2, sem CRM nem exportação.
-- Avulso (R$ 10): libera uma pesquisa por 30 dias: até 20 páginas, contatos e exportação dela.
-- Pro (R$ 99/mês ou R$ 712,80/ano): tudo liberado + CRM.  Empresa: tudo + automação de WhatsApp (liberado pela equipe).
--
-- O consumo é registrado pelo servidor do site (proxy da API) chamando as funções abaixo com a sessão do usuário.
-- A liberação após pagamento exige o segredo do servidor (só o hash fica aqui).

create table public.assinaturas (
  user_id uuid primary key references auth.users (id) on delete cascade,
  plano text not null check (plano in ('pro', 'empresa')),
  ciclo text not null check (ciclo in ('mensal', 'anual', 'manual')),
  valido_ate timestamptz not null,
  recorrente boolean not null default false,
  mp_preapproval_id text,
  atualizado_em timestamptz not null default now()
);

create table public.pagamentos (
  id text primary key,                          -- id do pagamento no Mercado Pago
  user_id uuid not null references auth.users (id) on delete cascade,
  tipo text not null check (tipo in ('avulso', 'pro_mensal', 'pro_anual')),
  valor numeric(10, 2) not null,
  status text not null,
  metodo text,
  chave text,                                   -- pesquisa liberada (avulso)
  aplicado boolean not null default false,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create index pagamentos_user_idx on public.pagamentos (user_id, criado_em desc);

create table public.uso_pesquisas (
  user_id uuid not null references auth.users (id) on delete cascade,
  chave text not null check (char_length(chave) <= 2000),
  criado_em timestamptz not null default now(),
  primary key (user_id, chave)
);

create table public.uso_contatos (
  user_id uuid not null references auth.users (id) on delete cascade,
  cnpj char(14) not null,
  criado_em timestamptz not null default now(),
  primary key (user_id, cnpj)
);

create table public.consultas_avulsas (
  user_id uuid not null references auth.users (id) on delete cascade,
  chave text not null check (char_length(chave) <= 2000),
  valido_ate timestamptz not null,
  pagamento_id text references public.pagamentos (id),
  primary key (user_id, chave)
);

-- Leitura só do próprio usuário; escrita só pelas funções (security definer)
alter table public.assinaturas enable row level security;
alter table public.pagamentos enable row level security;
alter table public.uso_pesquisas enable row level security;
alter table public.uso_contatos enable row level security;
alter table public.consultas_avulsas enable row level security;

create policy "assinatura: dono lê" on public.assinaturas for select to authenticated using (user_id = (select auth.uid()));
create policy "pagamentos: dono lê" on public.pagamentos for select to authenticated using (user_id = (select auth.uid()));
create policy "uso_pesquisas: dono lê" on public.uso_pesquisas for select to authenticated using (user_id = (select auth.uid()));
create policy "uso_contatos: dono lê" on public.uso_contatos for select to authenticated using (user_id = (select auth.uid()));
create policy "avulsas: dono lê" on public.consultas_avulsas for select to authenticated using (user_id = (select auth.uid()));

-- Plano ativo (pro ou empresa) ---------------------------------------------------------------
create function public.tem_plano(uid uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.assinaturas a where a.user_id = uid and a.valido_ate > now());
$$;

-- CRM só com plano: leitura continua liberada (quem assinou e venceu ainda vê o funil)
drop policy "crm: dono acessa" on public.crm_leads;
create policy "crm: dono lê" on public.crm_leads for select to authenticated using (user_id = (select auth.uid()));
create policy "crm: dono com plano cria" on public.crm_leads for insert to authenticated
  with check (user_id = (select auth.uid()) and public.tem_plano((select auth.uid())));
create policy "crm: dono com plano edita" on public.crm_leads for update to authenticated
  using (user_id = (select auth.uid()) and public.tem_plano((select auth.uid())))
  with check (user_id = (select auth.uid()));
create policy "crm: dono com plano remove" on public.crm_leads for delete to authenticated
  using (user_id = (select auth.uid()) and public.tem_plano((select auth.uid())));

-- Situação da conta: plano + consumo ---------------------------------------------------------
create function public.situacao_conta()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'plano', coalesce((select a.plano from public.assinaturas a where a.user_id = auth.uid() and a.valido_ate > now()), 'gratis'),
    'ciclo', (select a.ciclo from public.assinaturas a where a.user_id = auth.uid()),
    'valido_ate', (select a.valido_ate from public.assinaturas a where a.user_id = auth.uid()),
    'recorrente', coalesce((select a.recorrente from public.assinaturas a where a.user_id = auth.uid()), false),
    'pesquisas', (select count(*) from public.uso_pesquisas u where u.user_id = auth.uid()),
    'contatos', (select count(*) from public.uso_contatos u where u.user_id = auth.uid()),
    'avulsas', coalesce((select jsonb_agg(jsonb_build_object('chave', c.chave, 'valido_ate', c.valido_ate))
                         from public.consultas_avulsas c where c.user_id = auth.uid() and c.valido_ate > now()), '[]'::jsonb)
  );
$$;

-- Consumo grátis -----------------------------------------------------------------------------
-- Pesquisa: libera se tem plano, se a pesquisa foi comprada avulsa, se já foi feita antes ou se ainda há saldo (5).
-- Devolve 'plano' | 'avulsa' | 'gratis' | 'esgotado'.
create function public.usar_pesquisa(p_chave text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then return 'esgotado'; end if;
  if public.tem_plano(uid) then return 'plano'; end if;
  if exists (select 1 from public.consultas_avulsas c where c.user_id = uid and c.chave = p_chave and c.valido_ate > now()) then
    return 'avulsa';
  end if;
  if exists (select 1 from public.uso_pesquisas u where u.user_id = uid and u.chave = p_chave) then return 'gratis'; end if;
  perform pg_advisory_xact_lock(hashtext(uid::text));
  if (select count(*) from public.uso_pesquisas u where u.user_id = uid) >= 5 then return 'esgotado'; end if;
  insert into public.uso_pesquisas (user_id, chave) values (uid, p_chave) on conflict do nothing;
  return 'gratis';
end;
$$;

-- Contato (telefone, e-mail, ficha completa): plano libera; senão consome 1 de 10 (o mesmo CNPJ não conta de novo).
create function public.usar_contato(p_cnpj text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then return 'esgotado'; end if;
  if public.tem_plano(uid) then return 'plano'; end if;
  if exists (select 1 from public.uso_contatos u where u.user_id = uid and u.cnpj = p_cnpj) then return 'gratis'; end if;
  perform pg_advisory_xact_lock(hashtext(uid::text));
  if (select count(*) from public.uso_contatos u where u.user_id = uid) >= 10 then return 'esgotado'; end if;
  insert into public.uso_contatos (user_id, cnpj) values (uid, p_cnpj) on conflict do nothing;
  return 'gratis';
end;
$$;

-- Contatos já revelados entre os CNPJs informados (para não mascarar na lista)
create function public.contatos_revelados(p_cnpjs text[])
returns text[]
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(array_agg(u.cnpj::text), '{}') from public.uso_contatos u
  where u.user_id = auth.uid() and u.cnpj = any (p_cnpjs);
$$;

-- Liberação após pagamento (chamada pelo servidor, que confirma o pagamento na API do Mercado Pago) ----
create function public.registrar_pagamento(
  p_segredo text, p_id text, p_user uuid, p_tipo text, p_valor numeric, p_status text, p_metodo text,
  p_chave text, p_preapproval text default null, p_data timestamptz default now()
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  ja_aplicado boolean;
  base timestamptz;
begin
  if encode(sha256(convert_to(coalesce(p_segredo, ''), 'UTF8')), 'hex')
     <> '1cfe27b4c284c40bce368778361a13105aecbbac3d47778c917dad2bfef46123' then
    raise exception 'não autorizado';
  end if;

  insert into public.pagamentos (id, user_id, tipo, valor, status, metodo, chave)
  values (p_id, p_user, p_tipo, p_valor, p_status, p_metodo, p_chave)
  on conflict (id) do update set status = excluded.status, metodo = excluded.metodo, atualizado_em = now();

  select aplicado into ja_aplicado from public.pagamentos where id = p_id for update;
  if p_status <> 'approved' or ja_aplicado then return false; end if;

  if p_tipo = 'avulso' then
    insert into public.consultas_avulsas (user_id, chave, valido_ate, pagamento_id)
    values (p_user, p_chave, now() + interval '30 days', p_id)
    on conflict (user_id, chave) do update set valido_ate = greatest(public.consultas_avulsas.valido_ate, now()) + interval '30 days',
      pagamento_id = excluded.pagamento_id;
  elsif p_preapproval is not null then
    -- Cobrança da assinatura no cartão: vale 1 mês (+3 dias de folga) a partir da data da cobrança
    insert into public.assinaturas (user_id, plano, ciclo, valido_ate, recorrente, mp_preapproval_id)
    values (p_user, 'pro', 'mensal', p_data + interval '33 days', true, p_preapproval)
    on conflict (user_id) do update set
      valido_ate = greatest(public.assinaturas.valido_ate, excluded.valido_ate),
      plano = case when public.assinaturas.plano = 'empresa' then 'empresa' else 'pro' end,
      ciclo = case when public.assinaturas.ciclo = 'anual' and public.assinaturas.valido_ate > now() then 'anual' else 'mensal' end,
      recorrente = true, mp_preapproval_id = excluded.mp_preapproval_id, atualizado_em = now();
  else
    -- Pix (mensal) ou anual: soma ao que ainda resta
    select greatest(coalesce((select valido_ate from public.assinaturas where user_id = p_user), now()), now()) into base;
    insert into public.assinaturas (user_id, plano, ciclo, valido_ate)
    values (p_user, 'pro', case when p_tipo = 'pro_anual' then 'anual' else 'mensal' end,
            base + case when p_tipo = 'pro_anual' then interval '365 days' else interval '30 days' end)
    on conflict (user_id) do update set
      valido_ate = excluded.valido_ate,
      plano = case when public.assinaturas.plano = 'empresa' then 'empresa' else 'pro' end,
      ciclo = excluded.ciclo, atualizado_em = now();
  end if;

  update public.pagamentos set aplicado = true, atualizado_em = now() where id = p_id;
  return true;
end;
$$;

-- Assinatura recorrente criada/cancelada no cartão
create function public.registrar_assinatura(p_segredo text, p_user uuid, p_preapproval text, p_status text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if encode(sha256(convert_to(coalesce(p_segredo, ''), 'UTF8')), 'hex')
     <> '1cfe27b4c284c40bce368778361a13105aecbbac3d47778c917dad2bfef46123' then
    raise exception 'não autorizado';
  end if;
  if p_status = 'authorized' then
    -- Primeira cobrança é feita na criação: libera o mês já (a cobrança confirma depois)
    insert into public.assinaturas (user_id, plano, ciclo, valido_ate, recorrente, mp_preapproval_id)
    values (p_user, 'pro', 'mensal', now() + interval '33 days', true, p_preapproval)
    on conflict (user_id) do update set
      valido_ate = greatest(public.assinaturas.valido_ate, now() + interval '33 days'),
      recorrente = true, mp_preapproval_id = p_preapproval, atualizado_em = now();
  else
    update public.assinaturas set recorrente = false, atualizado_em = now()
    where user_id = p_user and mp_preapproval_id = p_preapproval;
  end if;
end;
$$;

-- Permissões: consumo só para usuários logados; liberação também para o servidor sem sessão (webhook)
revoke execute on function public.tem_plano(uuid), public.situacao_conta(), public.usar_pesquisa(text),
  public.usar_contato(text), public.contatos_revelados(text[]),
  public.registrar_pagamento(text, text, uuid, text, numeric, text, text, text, text, timestamptz),
  public.registrar_assinatura(text, uuid, text, text) from public, anon;
grant execute on function public.tem_plano(uuid), public.situacao_conta(), public.usar_pesquisa(text),
  public.usar_contato(text), public.contatos_revelados(text[]) to authenticated;
grant execute on function public.registrar_pagamento(text, text, uuid, text, numeric, text, text, text, text, timestamptz),
  public.registrar_assinatura(text, uuid, text, text) to anon, authenticated;
