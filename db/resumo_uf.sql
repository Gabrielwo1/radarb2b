-- Resumo pré-calculado por UF (visão padrão de cada estado, sem outros filtros).
-- Roda ao fim de cada carga; estados grandes como SP (8,7M de empresas) passam a responder na hora.

DROP TABLE IF EXISTS resumo_uf_new;
CREATE TABLE resumo_uf_new AS
SELECT t.uf, t.total,
  jsonb_build_object(
    'total', t.total,
    'com_telefone', t.com_telefone,
    'com_email', t.com_email,
    'novas_12m', t.novas_12m,
    'simples', t.simples,
    'mei', t.mei,
    'top_cnaes', (
      SELECT coalesce(jsonb_agg(x), '[]') FROM (
        SELECT e.cnae_principal AS codigo, c.descricao, count(*)::int AS total
        FROM empresas e LEFT JOIN cnaes c ON c.codigo = e.cnae_principal
        WHERE e.uf = t.uf GROUP BY 1, 2 ORDER BY 3 DESC LIMIT 5) x),
    'top_municipios', (
      SELECT coalesce(jsonb_agg(x), '[]') FROM (
        SELECT e.municipio_codigo AS codigo, e.municipio AS nome, count(*)::int AS total
        FROM empresas e WHERE e.uf = t.uf GROUP BY 1, 2 ORDER BY 3 DESC LIMIT 5) x),
    'aberturas_por_ano', (
      SELECT coalesce(jsonb_agg(x ORDER BY x.ano), '[]') FROM (
        SELECT extract(year FROM e.data_abertura)::int AS ano, count(*)::int AS total
        FROM empresas e
        WHERE e.uf = t.uf AND e.data_abertura >= date_trunc('year', current_date) - interval '9 years'
        GROUP BY 1) x)
  ) AS dados,
  -- Mapa de calor do estado (total por município com coordenadas)
  (SELECT coalesce(jsonb_agg(x), '[]') FROM (
     SELECT g.siafi AS codigo, g.nome, g.lat, g.lng, count(*)::int AS total
     FROM empresas e JOIN municipios_geo g ON g.siafi = e.municipio_codigo
     WHERE e.uf = t.uf GROUP BY 1, 2, 3, 4) x) AS mapa
FROM (
  SELECT uf,
         count(*)::int AS total,
         count(*) FILTER (WHERE telefone1 IS NOT NULL)::int AS com_telefone,
         count(*) FILTER (WHERE email IS NOT NULL)::int AS com_email,
         count(*) FILTER (WHERE data_abertura >= current_date - interval '12 months')::int AS novas_12m,
         count(*) FILTER (WHERE simples)::int AS simples,
         count(*) FILTER (WHERE mei)::int AS mei
  FROM empresas GROUP BY uf
) t;
-- Linha "BR": visão nacional (landing page e busca sem UF)
INSERT INTO resumo_uf_new (uf, total, dados, mapa)
SELECT 'BR', sum(total)::int,
  jsonb_build_object(
    'total', sum(total)::int,
    'com_telefone', sum((dados->>'com_telefone')::int),
    'com_email', sum((dados->>'com_email')::int),
    'novas_12m', sum((dados->>'novas_12m')::int),
    'simples', sum((dados->>'simples')::int),
    'mei', sum((dados->>'mei')::int),
    'top_cnaes', (SELECT coalesce(jsonb_agg(x), '[]') FROM (
        SELECT c.codigo, c.descricao, c.total FROM cnaes c WHERE c.total IS NOT NULL ORDER BY c.total DESC LIMIT 5) x),
    'top_municipios', (SELECT coalesce(jsonb_agg(x), '[]') FROM (
        SELECT m.codigo, m.nome, m.total FROM municipios m ORDER BY m.total DESC LIMIT 5) x),
    'aberturas_por_ano', (SELECT coalesce(jsonb_agg(jsonb_build_object('ano', ano, 'total', t) ORDER BY ano), '[]') FROM (
        SELECT (a->>'ano')::int AS ano, sum((a->>'total')::int)::int AS t
        FROM resumo_uf_new r, jsonb_array_elements(r.dados->'aberturas_por_ano') a GROUP BY 1) y)
  ),
  (SELECT jsonb_agg(p) FROM resumo_uf_new r, jsonb_array_elements(r.mapa) p)
FROM resumo_uf_new;
ALTER TABLE resumo_uf_new ADD PRIMARY KEY (uf);

BEGIN;
DROP TABLE IF EXISTS resumo_uf;
ALTER TABLE resumo_uf_new RENAME TO resumo_uf;
COMMIT;
