import Fastify from 'fastify';
import cors from '@fastify/cors';
import pg from 'pg';
import { prepararCrm, rotasCrm } from './crm.js';

// DATE como "YYYY-MM-DD" (sem conversão de fuso) e bigint como número
pg.types.setTypeParser(pg.types.builtins.DATE, (v) => v);
pg.types.setTypeParser(pg.types.builtins.INT8, (v) => Number(v));

// Limite por consulta: nenhuma busca pesada pode travar a VPS (compartilhada com outros serviços)
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 10, options: '-c statement_timeout=30000' });
const API_KEY = process.env.API_KEY;
const CORS_ORIGINS = process.env.CORS_ORIGINS?.split(',').map((o) => o.trim());

const app = Fastify({ logger: true });
await app.register(cors, { origin: CORS_ORIGINS ?? true });

app.addHook('onRequest', async (req, reply) => {
  if (!API_KEY || req.url === '/health') return;
  if (req.headers['x-api-key'] !== API_KEY) {
    return reply.code(401).send({ erro: 'API key inválida' });
  }
});

const PORTES: Record<number, string> = { 0: 'Não informado', 1: 'Microempresa', 3: 'EPP', 5: 'Demais' };
const SITUACOES: Record<number, string> = { 1: 'Nula', 2: 'Ativa', 3: 'Suspensa', 4: 'Inapta', 8: 'Baixada' };

type Query = Record<string, string | undefined>;

const lista = (v?: string) => (v ? v.split(',').map((s) => s.trim()).filter(Boolean) : []);
const numeros = (v?: string) => lista(v).map(Number).filter(Number.isInteger);
const data = (v?: string) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : undefined);
const bool = (v?: string) => (v === 'true' ? true : v === 'false' ? false : undefined);
const normalizar = (v: string) => v.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

const ORDENS: Record<string, string> = {
  nome: 'e.razao_social ASC',
  abertura_desc: 'e.data_abertura DESC NULLS LAST',
  abertura_asc: 'e.data_abertura ASC NULLS LAST',
  capital_desc: 'e.capital_social DESC NULLS LAST',
};

// Com filtro seletivo (cidade, segmento, nome...), o Postgres tende a percorrer o índice da ordenação
// esperando achar 30 linhas cedo e acaba varrendo milhões. As expressões abaixo não casam com nenhum
// índice: ele filtra primeiro (dezenas de milhares de linhas) e ordena em memória.
const ORDENS_POS_FILTRO: Record<string, string> = {
  nome: "(e.razao_social || '') COLLATE \"C\" ASC", // nomes da Receita vêm em maiúsculas sem acento
  abertura_desc: '(e.data_abertura + 0) DESC NULLS LAST',
  abertura_asc: '(e.data_abertura + 0) ASC NULLS LAST',
  capital_desc: '(e.capital_social + 0) DESC NULLS LAST',
};
const FILTROS_SELETIVOS = ['municipio', 'cnae', 'q', 'bairro', 'cnpjs'];

function montarFiltros(q: Query, ignorar: string[] = []) {
  q = Object.fromEntries(Object.entries(q).filter(([k]) => !ignorar.includes(k)));
  const where: string[] = [];
  const params: unknown[] = [];
  const p = (v: unknown) => {
    params.push(v);
    return `$${params.length}`;
  };

  const ufs = lista(q.uf).map((u) => u.toUpperCase());
  if (ufs.length) where.push(`e.uf = ANY(${p(ufs)})`);

  // Lista explícita (ex.: empresas salvas pelo usuário)
  const cnpjs = lista(q.cnpjs).map((c) => c.replace(/\D/g, '')).filter((c) => c.length === 14).slice(0, 500);
  if (cnpjs.length) where.push(`e.cnpj = ANY(${p(cnpjs)})`);

  const municipios = numeros(q.municipio);
  if (municipios.length) where.push(`e.municipio_codigo = ANY(${p(municipios)})`);

  const cnaes = numeros(q.cnae);
  if (cnaes.length) {
    const arr = p(cnaes);
    where.push(
      q.cnae_secundario === 'true'
        ? `(e.cnae_principal = ANY(${arr}) OR e.cnaes_secundarios && ${arr}::int[])`
        : `e.cnae_principal = ANY(${arr})`,
    );
  }

  const portes = numeros(q.porte);
  if (portes.length) where.push(`e.porte = ANY(${p(portes)})`);

  const situacoes = numeros(q.situacao);
  if (situacoes.length) where.push(`e.situacao = ANY(${p(situacoes)})`);

  const simples = bool(q.simples);
  if (simples !== undefined) where.push(`e.simples IS ${simples ? 'TRUE' : 'NOT TRUE'}`);
  const mei = bool(q.mei);
  if (mei !== undefined) where.push(`e.mei IS ${mei ? 'TRUE' : 'NOT TRUE'}`);
  if (q.matriz === 'true') where.push('e.matriz');

  const de = data(q.abertura_de);
  if (de) where.push(`e.data_abertura >= ${p(de)}`);
  const ate = data(q.abertura_ate);
  if (ate) where.push(`e.data_abertura <= ${p(ate)}`);

  if (q.capital_min && !isNaN(+q.capital_min)) where.push(`e.capital_social >= ${p(+q.capital_min)}`);
  if (q.capital_max && !isNaN(+q.capital_max)) where.push(`e.capital_social <= ${p(+q.capital_max)}`);

  if (q.com_telefone === 'true') where.push('e.telefone1 IS NOT NULL');
  if (q.com_email === 'true') where.push('e.email IS NOT NULL');

  if (q.bairro?.trim()) where.push(`f_unaccent(lower(e.bairro)) LIKE ${p(`%${normalizar(q.bairro.trim())}%`)}`);

  const termo = q.q?.trim();
  if (termo) {
    const digitos = termo.replace(/[.\-/\s]/g, '');
    if (/^\d{8,14}$/.test(digitos)) {
      where.push(`e.cnpj LIKE ${p(`${digitos}%`)}`);
    } else if (termo.length >= 3) {
      where.push(`e.busca LIKE ${p(`%${normalizar(termo)}%`)}`);
    }
  }

  return { where: where.length ? `WHERE ${where.join(' AND ')}` : '', params };
}

// Cache em memória para agregações e contagens. A base só muda na carga mensal: a chave inclui
// a versão da base (id da última carga concluída), então uma carga nova invalida tudo sozinha.
const TTL_CACHE = 24 * 60 * 60 * 1000;
const cache = new Map<string, { expira: number; valor: Promise<unknown> }>();
let versaoBase = '0';
async function atualizarVersao() {
  try {
    const { rows } = await pool.query('SELECT max(id)::text AS v FROM cargas WHERE concluida_em IS NOT NULL');
    const nova = rows[0]?.v ?? '0';
    if (nova !== versaoBase) {
      versaoBase = nova;
      cache.clear();
    }
  } catch {
    // tabela ainda não existe (base vazia): mantém a versão atual
  }
}
await atualizarVersao();
setInterval(atualizarVersao, 60_000).unref();

function emCache<T>(chave: string, fn: () => Promise<T>): Promise<T> {
  const agora = Date.now();
  const item = cache.get(chave);
  if (item && item.expira > agora) return item.valor as Promise<T>;
  const valor = fn();
  cache.set(chave, { expira: agora + TTL_CACHE, valor });
  valor.catch(() => cache.delete(chave));
  if (cache.size > 5000) cache.delete(cache.keys().next().value!);
  return valor;
}
// Visão padrão de um estado (só o filtro de UF): usa o resumo pré-calculado na carga
const apenasUmaUf = (where: string, params: unknown[]) => {
  if (where === '') return 'BR'; // sem filtro nenhum: visão nacional pré-calculada
  return where === 'WHERE e.uf = ANY($1)' && Array.isArray(params[0]) && params[0].length === 1 ? (params[0][0] as string) : null;
};
async function resumoPreCalculado(uf: string) {
  try {
    const { rows } = await pool.query('SELECT total, dados, mapa FROM resumo_uf WHERE uf = $1', [uf]);
    return rows[0] ?? null;
  } catch {
    return null; // tabela ainda não criada: cai no cálculo normal
  }
}

const chaveCache = (rota: string, where: string, params: unknown[]) =>
  `${versaoBase}|${rota}|${where}|${JSON.stringify(params)}`;

app.get('/health', async () => {
  await pool.query('SELECT 1');
  return { ok: true };
});

app.get('/stats', async () => {
  const { rows } = await pool.query(`
    SELECT mes_referencia, ufs, situacoes, total_estabelecimentos, concluida_em
    FROM cargas WHERE concluida_em IS NOT NULL ORDER BY id DESC LIMIT 1`);
  return { ultima_carga: rows[0] ?? null };
});

app.get<{ Querystring: Query }>('/municipios', async (req) => {
  const ufs = lista(req.query.uf).map((u) => u.toUpperCase());
  const { rows } = await pool.query(
    `SELECT codigo, nome, uf, total FROM municipios
     WHERE cardinality($1::text[]) = 0 OR uf = ANY($1)
     ORDER BY uf, nome`,
    [ufs],
  );
  return rows;
});

app.get<{ Querystring: Query }>('/cnaes', async (req) => {
  const termo = req.query.q?.trim() ?? '';
  const limite = Math.min(Number(req.query.limit) || 20, 100);
  const codigos = numeros(req.query.codigos);
  if (codigos.length) {
    const { rows } = await pool.query(`SELECT codigo, descricao FROM cnaes WHERE codigo = ANY($1)`, [codigos]);
    return rows;
  }
  if (/^\d+$/.test(termo)) {
    const { rows } = await pool.query(
      `SELECT codigo, descricao FROM cnaes WHERE codigo::text LIKE $1 ORDER BY codigo LIMIT $2`,
      [`${termo}%`, limite],
    );
    return rows;
  }
  // Cada palavra precisa casar no início de uma palavra da descrição ("racao" não casa com "administração").
  // Mais comuns na base primeiro.
  const padroes = normalizar(termo)
    .split(/\s+/)
    .filter(Boolean)
    .map((p) => `\\m${p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`);
  const { rows } = await pool.query(
    `SELECT codigo, descricao FROM cnaes
     WHERE f_unaccent(lower(descricao)) ~ ALL($1::text[])
     ORDER BY total DESC NULLS LAST, descricao LIMIT $2`,
    [padroes, limite],
  );
  return rows;
});

app.get<{ Querystring: Query }>('/empresas', async (req) => {
  const q = req.query;
  const limite = Math.min(Math.max(Number(q.limit) || 25, 1), 100);
  const pagina = Math.max(Number(q.page) || 1, 1);
  const seletivo = FILTROS_SELETIVOS.some((k) => q[k]?.trim());
  const tabela = seletivo ? ORDENS_POS_FILTRO : ORDENS;
  const ordem = tabela[q.ordem ?? ''] ?? tabela.nome;
  const { where, params } = montarFiltros(q);

  const [dados, total] = await Promise.all([
    pool.query(
      `SELECT e.cnpj, e.razao_social, e.nome_fantasia, e.situacao, e.data_abertura,
              e.cnae_principal, c.descricao AS cnae_descricao, e.porte, e.capital_social,
              e.simples, e.mei, e.matriz, e.bairro, e.municipio, e.uf,
              e.telefone1, e.telefone2, e.email,
              e.tipo_logradouro, e.logradouro, e.numero, e.complemento, e.cep
       FROM empresas e
       LEFT JOIN cnaes c ON c.codigo = e.cnae_principal
       ${where}
       ORDER BY ${ordem}, ${seletivo ? "(e.cnpj || '')" : 'e.cnpj'}
       LIMIT ${limite} OFFSET ${(pagina - 1) * limite}`,
      params,
    ),
    emCache(chaveCache('count', where, params), async () => {
      const uf = apenasUmaUf(where, params);
      const pre = uf ? await resumoPreCalculado(uf) : null;
      if (pre) return pre.total as number;
      const r = await pool.query(`SELECT count(*)::int AS total FROM empresas e ${where}`, params);
      return r.rows[0].total as number;
    }),
  ]);

  return {
    total,
    pagina,
    limite,
    resultados: dados.rows.map((r) => ({
      ...r,
      porte_descricao: PORTES[r.porte] ?? null,
      situacao_descricao: SITUACOES[r.situacao] ?? null,
    })),
  };
});

app.get<{ Querystring: Query }>('/resumo', async (req) => {
  const { where, params } = montarFiltros(req.query);
  return emCache(chaveCache('resumo', where, params), async () => {
    const uf = apenasUmaUf(where, params);
    const pre = uf ? await resumoPreCalculado(uf) : null;
    return pre ? pre.dados : calcularResumo(where, params);
  });
});

async function calcularResumo(where: string, params: unknown[]) {
  const [totais, cnaes, municipios, anos] = await Promise.all([
    pool.query(
      `SELECT count(*)::int AS total,
              count(*) FILTER (WHERE e.telefone1 IS NOT NULL)::int AS com_telefone,
              count(*) FILTER (WHERE e.email IS NOT NULL)::int AS com_email,
              count(*) FILTER (WHERE e.data_abertura >= current_date - interval '12 months')::int AS novas_12m,
              count(*) FILTER (WHERE e.simples)::int AS simples,
              count(*) FILTER (WHERE e.mei)::int AS mei
       FROM empresas e ${where}`,
      params,
    ),
    pool.query(
      `SELECT e.cnae_principal AS codigo, c.descricao, count(*)::int AS total
       FROM empresas e LEFT JOIN cnaes c ON c.codigo = e.cnae_principal
       ${where} GROUP BY 1, 2 ORDER BY 3 DESC LIMIT 5`,
      params,
    ),
    pool.query(
      `SELECT e.municipio_codigo AS codigo, e.municipio AS nome, count(*)::int AS total
       FROM empresas e ${where} GROUP BY 1, 2 ORDER BY 3 DESC LIMIT 5`,
      params,
    ),
    pool.query(
      `SELECT extract(year FROM e.data_abertura)::int AS ano, count(*)::int AS total
       FROM empresas e ${where ? `${where} AND` : 'WHERE'} e.data_abertura >= date_trunc('year', current_date) - interval '9 years'
       GROUP BY 1 ORDER BY 1`,
      params,
    ),
  ]);
  return { ...totais.rows[0], top_cnaes: cnaes.rows, top_municipios: municipios.rows, aberturas_por_ano: anos.rows };
}

// Agregado por município para o mapa de calor. Ignora o filtro de município para manter o contexto.
app.get<{ Querystring: Query }>('/mapa', async (req) => {
  const { where, params } = montarFiltros(req.query, ['municipio']);
  return emCache(chaveCache('mapa', where, params), async () => {
    const uf = apenasUmaUf(where, params);
    const pre = uf ? await resumoPreCalculado(uf) : null;
    if (pre?.mapa) return pre.mapa;
    const { rows } = await pool.query(
      `SELECT g.siafi AS codigo, g.nome, g.lat, g.lng, count(*)::int AS total
       FROM empresas e JOIN municipios_geo g ON g.siafi = e.municipio_codigo
       ${where} GROUP BY 1, 2, 3, 4`,
      params,
    );
    return rows;
  });
});

const COLUNAS_CSV = [
  'cnpj', 'razao_social', 'nome_fantasia', 'cnae_principal', 'cnae_descricao', 'porte_descricao',
  'capital_social', 'data_abertura', 'simples', 'mei', 'logradouro', 'numero', 'bairro', 'cep',
  'municipio', 'uf', 'telefone1', 'telefone2', 'email',
] as const;

app.get<{ Querystring: Query }>('/exportar', async (req, reply) => {
  const limite = Math.min(Number(req.query.limit) || 5000, 20000);
  const { where, params } = montarFiltros(req.query);
  const { rows } = await pool.query(
    `SELECT e.*, c.descricao AS cnae_descricao FROM empresas e
     LEFT JOIN cnaes c ON c.codigo = e.cnae_principal
     ${where} ORDER BY e.razao_social, e.cnpj LIMIT ${limite}`,
    params,
  );
  const celula = (v: unknown) => {
    if (v === null || v === undefined) return '';
    const t = typeof v === 'boolean' ? (v ? 'Sim' : 'Não') : String(v);
    return /[";\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
  };
  const linhas = rows.map((r) =>
    COLUNAS_CSV.map((c) => celula(c === 'porte_descricao' ? PORTES[r.porte] : r[c])).join(';'),
  );
  // BOM + ";" para abrir direto no Excel em português
  const csv = '\uFEFF' + [COLUNAS_CSV.join(';'), ...linhas].join('\r\n');
  return reply
    .header('content-type', 'text/csv; charset=utf-8')
    .header('content-disposition', `attachment; filename="prospects-${new Date().toISOString().slice(0, 10)}.csv"`)
    .send(csv);
});

app.get<{ Params: { cnpj: string } }>('/empresas/:cnpj', async (req, reply) => {
  const cnpj = req.params.cnpj.replace(/\D/g, '');
  const { rows } = await pool.query(
    `SELECT e.*, c.descricao AS cnae_descricao,
            (SELECT coalesce(json_agg(json_build_object('codigo', s.codigo, 'descricao', s.descricao)), '[]')
               FROM cnaes s WHERE s.codigo = ANY(e.cnaes_secundarios)) AS cnaes_secundarios_detalhe
     FROM empresas e
     LEFT JOIN cnaes c ON c.codigo = e.cnae_principal
     WHERE e.cnpj = $1`,
    [cnpj],
  );
  if (!rows[0]) return reply.code(404).send({ erro: 'CNPJ não encontrado na base' });
  const { busca: _busca, ...empresa } = rows[0];
  return {
    ...empresa,
    porte_descricao: PORTES[empresa.porte] ?? null,
    situacao_descricao: SITUACOES[empresa.situacao] ?? null,
  };
});

await prepararCrm(pool);
rotasCrm(app, pool);

await app.listen({ host: '0.0.0.0', port: Number(process.env.PORT) || 3000 });
