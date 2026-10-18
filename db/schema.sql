-- Estrutura base (idempotente). Roda no início de toda carga do ETL.

CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS unaccent;

-- unaccent() não é IMMUTABLE; este wrapper permite usar em índice/coluna de busca
CREATE OR REPLACE FUNCTION f_unaccent(text) RETURNS text
  LANGUAGE sql IMMUTABLE PARALLEL SAFE STRICT
  AS $$ SELECT public.unaccent('public.unaccent', $1) $$;

-- Datas da Receita vêm como YYYYMMDD, às vezes "0", "00000000" ou inválidas (ex.: 20230231).
-- SQL puro: sem bloco de exceção por linha (lento e gera um aviso por data inválida).
CREATE OR REPLACE FUNCTION f_data_rfb(text) RETURNS date
  LANGUAGE sql IMMUTABLE PARALLEL SAFE AS $$
  SELECT CASE
    WHEN $1 IS NULL OR $1 !~ '^(19|20)\d{2}(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])$' THEN NULL
    ELSE CASE
      WHEN substr($1, 7, 2)::int <= extract(day FROM make_date(substr($1, 1, 4)::int, substr($1, 5, 2)::int, 1) + interval '1 month - 1 day')::int
      THEN make_date(substr($1, 1, 4)::int, substr($1, 5, 2)::int, substr($1, 7, 2)::int)
    END
  END
$$;

-- Telefone da Receita: DDD (às vezes com zero à esquerda) + número. Inválido (zeros, curto) → NULL.
CREATE OR REPLACE FUNCTION f_telefone(ddd text, numero text) RETURNS text
  LANGUAGE sql IMMUTABLE PARALLEL SAFE AS $$
  SELECT CASE WHEN n ~ '^[1-9][1-9]([2-9][0-9]{7}|9[0-9]{8})$' THEN n END
  FROM (SELECT ltrim(regexp_replace(coalesce($1, '') || coalesce($2, ''), '\D', '', 'g'), '0') AS n) x
$$;

-- Staging: espelho cru dos CSVs da Receita (tudo text)
CREATE UNLOGGED TABLE IF NOT EXISTS stg_estabelecimentos (
  cnpj_basico text, cnpj_ordem text, cnpj_dv text, matriz_filial text,
  nome_fantasia text, situacao text, data_situacao text, motivo_situacao text,
  cidade_exterior text, pais text, data_inicio text, cnae_principal text,
  cnaes_secundarios text, tipo_logradouro text, logradouro text, numero text,
  complemento text, bairro text, cep text, uf text, municipio text,
  ddd1 text, telefone1 text, ddd2 text, telefone2 text, ddd_fax text, fax text,
  email text, situacao_especial text, data_situacao_especial text
);

CREATE UNLOGGED TABLE IF NOT EXISTS stg_empresas (
  cnpj_basico text, razao_social text, natureza_juridica text,
  qualificacao_responsavel text, capital_social text, porte text,
  ente_federativo text
);

CREATE UNLOGGED TABLE IF NOT EXISTS stg_simples (
  cnpj_basico text, opcao_simples text, data_opcao_simples text,
  data_exclusao_simples text, opcao_mei text, data_opcao_mei text,
  data_exclusao_mei text
);

CREATE UNLOGGED TABLE IF NOT EXISTS stg_codigos_cnaes (codigo text, descricao text);
CREATE UNLOGGED TABLE IF NOT EXISTS stg_codigos_municipios (codigo text, descricao text);

-- Tabelas auxiliares
CREATE TABLE IF NOT EXISTS cnaes (
  codigo int PRIMARY KEY,
  descricao text NOT NULL
);
-- Quantas empresas da base têm o CNAE como principal (ordena o autocomplete)
ALTER TABLE cnaes ADD COLUMN IF NOT EXISTS total int;
CREATE INDEX IF NOT EXISTS cnaes_descricao_trgm
  ON cnaes USING gin (f_unaccent(lower(descricao)) gin_trgm_ops);

CREATE TABLE IF NOT EXISTS municipios_rfb (
  codigo int PRIMARY KEY,
  nome text NOT NULL
);

-- Histórico de cargas
CREATE TABLE IF NOT EXISTS cargas (
  id serial PRIMARY KEY,
  mes_referencia text NOT NULL,
  ufs text NOT NULL,
  situacoes text NOT NULL,
  total_estabelecimentos bigint,
  iniciada_em timestamptz NOT NULL DEFAULT now(),
  concluida_em timestamptz
);

-- Coordenadas dos municípios (fonte: github.com/kelvins/municipios-brasileiros).
-- siafi = código de município usado pela Receita.
CREATE TABLE IF NOT EXISTS municipios_geo (
  siafi int PRIMARY KEY,
  ibge int NOT NULL,
  nome text NOT NULL,
  uf_codigo int NOT NULL,
  lat double precision NOT NULL,
  lng double precision NOT NULL,
  capital boolean NOT NULL,
  ddd int
);
