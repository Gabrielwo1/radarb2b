-- Radar B2B: dados de cada usuário (login via Supabase Auth).
-- A base de CNPJ continua na VPS; aqui ficam só CRM, favoritos e buscas salvas.
-- RLS em tudo: cada usuário enxerga e altera apenas os próprios registros.

-- Perfil (criado automaticamente no cadastro)
create table public.perfis (
  id uuid primary key references auth.users (id) on delete cascade,
  nome text,
  empresa text,
  criado_em timestamptz not null default now()
);

create function public.criar_perfil()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.perfis (id, nome)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'nome', split_part(new.email, '@', 1)));
  return new;
end;
$$;

create trigger ao_criar_usuario
  after insert on auth.users
  for each row execute function public.criar_perfil();

-- Funil de vendas (kanban). "dados" guarda um retrato da empresa no momento em que entrou no funil.
create table public.crm_leads (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  cnpj char(14) not null,
  etapa text not null default 'novo'
    check (etapa in ('novo', 'contato', 'qualificado', 'proposta', 'negociacao', 'ganho', 'perdido')),
  ordem double precision not null default 0,
  valor numeric check (valor is null or valor >= 0),
  proxima_acao date,
  notas text check (char_length(notas) <= 5000),
  origem text,
  dados jsonb not null,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  primary key (user_id, cnpj)
);
create index crm_leads_etapa_idx on public.crm_leads (user_id, etapa, ordem);

-- Favoritos (estrela na prospecção)
create table public.favoritos (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  cnpj char(14) not null,
  nome text not null,
  municipio text,
  salvo_em timestamptz not null default now(),
  primary key (user_id, cnpj)
);

-- Buscas salvas (combinações de filtros)
create table public.buscas_salvas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  nome text not null check (char_length(nome) between 1 and 120),
  query text not null,
  criada_em timestamptz not null default now()
);
create index buscas_salvas_user_idx on public.buscas_salvas (user_id, criada_em desc);

-- atualizado_em automático no CRM
create function public.tocar_atualizado_em()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.atualizado_em = now();
  return new;
end;
$$;

create trigger crm_leads_atualizado_em
  before update on public.crm_leads
  for each row execute function public.tocar_atualizado_em();

-- RLS
alter table public.perfis enable row level security;
alter table public.crm_leads enable row level security;
alter table public.favoritos enable row level security;
alter table public.buscas_salvas enable row level security;

create policy "perfil: o próprio usuário lê" on public.perfis
  for select to authenticated using (id = (select auth.uid()));
create policy "perfil: o próprio usuário edita" on public.perfis
  for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));

create policy "crm: dono acessa" on public.crm_leads
  for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy "favoritos: dono acessa" on public.favoritos
  for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy "buscas: dono acessa" on public.buscas_salvas
  for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
