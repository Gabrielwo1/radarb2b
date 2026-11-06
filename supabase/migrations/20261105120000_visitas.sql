-- Visualizações de página (site inteiro, com e sem login) para o painel /admin.
-- Sem IP e sem dado pessoal: o visitante é um id aleatório guardado no navegador.

create table public.visitas (
  id bigint generated always as identity primary key,
  criado_em timestamptz not null default now(),
  visitante uuid not null,
  user_id uuid references auth.users (id) on delete set null,
  caminho text not null check (char_length(caminho) <= 300),
  origem text check (char_length(origem) <= 200),          -- domínio de quem indicou (referrer)
  utm_source text check (char_length(utm_source) <= 100),
  utm_campaign text check (char_length(utm_campaign) <= 100),
  dispositivo text check (dispositivo in ('mobile', 'desktop'))
);
create index visitas_criado_idx on public.visitas (criado_em desc);
create index visitas_visitante_idx on public.visitas (visitante, criado_em desc);
alter table public.visitas enable row level security; -- sem políticas: ninguém lê pela API; só as funções

create function public.registrar_visita(
  p_visitante uuid, p_caminho text, p_origem text default null, p_utm_source text default null,
  p_utm_campaign text default null, p_dispositivo text default null
)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.visitas (visitante, user_id, caminho, origem, utm_source, utm_campaign, dispositivo)
  values (
    p_visitante, auth.uid(), left(p_caminho, 300), nullif(left(p_origem, 200), ''),
    nullif(left(p_utm_source, 100), ''), nullif(left(p_utm_campaign, 100), ''),
    case when p_dispositivo in ('mobile', 'desktop') then p_dispositivo end
  );
$$;

-- Tráfego para o painel: totais, série de 30 dias, páginas, origens e dispositivos
create function public.admin_visitas(p_segredo text)
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
  with v as (
    select *, (criado_em at time zone 'America/Sao_Paulo')::date as dia from public.visitas
    where criado_em > now() - interval '31 days'
  )
  select jsonb_build_object(
    'hoje', (select count(*) from v where dia = hoje),
    'visitantes_hoje', (select count(distinct visitante) from v where dia = hoje),
    'd7', (select count(*) from v where dia > hoje - 7),
    'visitantes_7d', (select count(distinct visitante) from v where dia > hoje - 7),
    'd30', (select count(*) from v where dia > hoje - 30),
    'visitantes_30d', (select count(distinct visitante) from v where dia > hoje - 30),
    'logados_30d', (select count(distinct visitante) from v where dia > hoje - 30 and user_id is not null),
    'series', (select jsonb_agg(jsonb_build_object(
        'dia', d.dia,
        'visualizacoes', (select count(*) from v where v.dia = d.dia),
        'visitantes', (select count(distinct visitante) from v where v.dia = d.dia)
      ) order by d.dia) from (select generate_series(hoje - 29, hoje, interval '1 day')::date as dia) d),
    'paginas', coalesce((select jsonb_agg(x) from (
        select caminho as rotulo, count(*) as valor, count(distinct visitante) as unicos
        from v where dia > hoje - 30 group by caminho order by count(*) desc limit 10) x), '[]'::jsonb),
    'origens', coalesce((select jsonb_agg(x) from (
        select coalesce(utm_source, origem, 'Direto') as rotulo, count(distinct visitante) as valor
        from v where dia > hoje - 30 group by 1 order by 2 desc limit 8) x), '[]'::jsonb),
    'campanhas', coalesce((select jsonb_agg(x) from (
        select utm_campaign as rotulo, count(distinct visitante) as valor
        from v where dia > hoje - 30 and utm_campaign is not null group by 1 order by 2 desc limit 8) x), '[]'::jsonb),
    'dispositivos', coalesce((select jsonb_agg(x) from (
        select coalesce(dispositivo, 'desconhecido') as rotulo, count(distinct visitante) as valor
        from v where dia > hoje - 30 group by 1 order by 2 desc) x), '[]'::jsonb)
  ) into r;
  return r;
end;
$$;

revoke execute on function public.registrar_visita(uuid, text, text, text, text, text), public.admin_visitas(text) from public;
grant execute on function public.registrar_visita(uuid, text, text, text, text, text) to anon, authenticated;
grant execute on function public.admin_visitas(text) to anon, authenticated;
