-- Monta a tabela final a partir do staging e troca pela atual sem downtime.
-- Variável psql obrigatória: :mes (ex.: 2026-09)

\set ON_ERROR_STOP on

TRUNCATE cnaes;
INSERT INTO cnaes (codigo, descricao)
SELECT DISTINCT ON (codigo::int) codigo::int, trim(descricao)
FROM stg_codigos_cnaes WHERE codigo ~ '^\d+$';

TRUNCATE municipios_rfb;
INSERT INTO municipios_rfb (codigo, nome)
SELECT DISTINCT ON (codigo::int) codigo::int, trim(descricao)
FROM stg_codigos_municipios WHERE codigo ~ '^\d+$';

DROP TABLE IF EXISTS empresas_new;

CREATE TABLE empresas_new AS
SELECT
  e.cnpj_basico || e.cnpj_ordem || e.cnpj_dv            AS cnpj,
  e.cnpj_basico                                         AS cnpj_basico,
  e.matriz_filial = '1'                                 AS matriz,
  nullif(trim(p.razao_social), '')                      AS razao_social,
  nullif(trim(e.nome_fantasia), '')                     AS nome_fantasia,
  nullif(e.situacao, '')::smallint                      AS situacao,
  f_data_rfb(e.data_situacao)                           AS data_situacao,
  f_data_rfb(e.data_inicio)                             AS data_abertura,
  nullif(e.cnae_principal, '')::int                     AS cnae_principal,
  CASE WHEN e.cnaes_secundarios ~ '^\d+(,\d+)*$'
       THEN string_to_array(e.cnaes_secundarios, ',')::int[]
       ELSE '{}'::int[] END                             AS cnaes_secundarios,
  nullif(p.natureza_juridica, '')::int                  AS natureza_juridica,
  nullif(p.porte, '')::smallint                         AS porte,
  CASE WHEN p.capital_social ~ '^\d+(,\d+)?$'
       THEN replace(p.capital_social, ',', '.')::numeric END AS capital_social,
  s.opcao_simples = 'S'                                 AS simples,
  s.opcao_mei = 'S'                                     AS mei,
  nullif(trim(e.tipo_logradouro), '')                   AS tipo_logradouro,
  nullif(trim(e.logradouro), '')                        AS logradouro,
  nullif(trim(e.numero), '')                            AS numero,
  nullif(trim(e.complemento), '')                       AS complemento,
  nullif(trim(e.bairro), '')                            AS bairro,
  nullif(trim(e.cep), '')                               AS cep,
  e.uf                                                  AS uf,
  nullif(e.municipio, '')::int                          AS municipio_codigo,
  coalesce(m.nome, upper(f_unaccent(g.nome)))           AS municipio,
  f_telefone(e.ddd1, e.telefone1)                       AS telefone1,
  f_telefone(e.ddd2, e.telefone2)                       AS telefone2,
  nullif(lower(trim(e.email)), '')                      AS email,
  f_unaccent(lower(coalesce(p.razao_social, '') || ' ' || coalesce(e.nome_fantasia, ''))) AS busca,
  :'mes'::text                                          AS mes_referencia
-- A Receita às vezes repete registros (ex.: mesma empresa duas vezes, uma delas em branco):
-- deduplica cada origem, preferindo a linha preenchida.
FROM (SELECT DISTINCT ON (cnpj_basico, cnpj_ordem, cnpj_dv) * FROM stg_estabelecimentos
      ORDER BY cnpj_basico, cnpj_ordem, cnpj_dv, data_situacao DESC) e
LEFT JOIN (SELECT DISTINCT ON (cnpj_basico) * FROM stg_empresas
           ORDER BY cnpj_basico, (nullif(trim(razao_social), '') IS NULL), porte DESC NULLS LAST) p
       ON p.cnpj_basico = e.cnpj_basico
LEFT JOIN (SELECT DISTINCT ON (cnpj_basico) * FROM stg_simples
           ORDER BY cnpj_basico, opcao_simples DESC NULLS LAST) s
       ON s.cnpj_basico = e.cnpj_basico
LEFT JOIN municipios_rfb m ON m.codigo = nullif(e.municipio, '')::int
LEFT JOIN municipios_geo g ON g.siafi = nullif(e.municipio, '')::int
-- Grava fisicamente agrupado por UF/município: buscas por estado e cidade leem só a sua região do disco
ORDER BY e.uf, nullif(e.municipio, '')::int;

ALTER TABLE empresas_new ADD PRIMARY KEY (cnpj);
CREATE INDEX ON empresas_new (uf, municipio_codigo);
CREATE INDEX ON empresas_new (cnae_principal);
-- Busca mais comum: cidade + segmento
CREATE INDEX ON empresas_new (municipio_codigo, cnae_principal);
CREATE INDEX ON empresas_new USING gin (cnaes_secundarios);
CREATE INDEX ON empresas_new (data_abertura DESC NULLS LAST, cnpj);
CREATE INDEX ON empresas_new (data_abertura ASC NULLS LAST, cnpj);
CREATE INDEX ON empresas_new (capital_social DESC NULLS LAST, cnpj);
CREATE INDEX ON empresas_new (porte);
CREATE INDEX ON empresas_new (razao_social, cnpj);
CREATE INDEX ON empresas_new USING gin (busca gin_trgm_ops);
ANALYZE empresas_new;

-- Resumo de municípios por UF (a tabela da Receita não traz UF)
DROP TABLE IF EXISTS municipios_new;
CREATE TABLE municipios_new AS
-- Agrupa só pelo código: a Receita tem códigos com nome/UF divergentes em poucos registros
SELECT municipio_codigo AS codigo, mode() WITHIN GROUP (ORDER BY municipio) AS nome,
       mode() WITHIN GROUP (ORDER BY uf) AS uf, count(*) AS total
FROM empresas_new
WHERE municipio_codigo IS NOT NULL
GROUP BY 1;
ALTER TABLE municipios_new ADD PRIMARY KEY (codigo);

BEGIN;
DROP TABLE IF EXISTS empresas_old, municipios_old;

ALTER TABLE IF EXISTS empresas RENAME TO empresas_old;
ALTER TABLE empresas_new RENAME TO empresas;
ALTER TABLE IF EXISTS municipios RENAME TO municipios_old;
ALTER TABLE municipios_new RENAME TO municipios;
COMMIT;

DROP TABLE IF EXISTS empresas_old, municipios_old;

-- Popularidade dos CNAEs (ordena o autocomplete), já sobre a tabela nova
UPDATE cnaes c SET total = x.n
FROM (SELECT cnae_principal, count(*) AS n FROM empresas GROUP BY 1) x
WHERE x.cnae_principal = c.codigo;

-- Libera espaço do staging
TRUNCATE stg_estabelecimentos, stg_empresas, stg_simples;
