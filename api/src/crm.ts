import type { FastifyInstance } from 'fastify';
import type pg from 'pg';

// CRM simples (kanban). Tabela própria: a carga mensal da Receita não mexe nela.
// Guarda um retrato dos dados da empresa no momento em que entrou no funil.

export const ETAPAS = ['novo', 'contato', 'qualificado', 'proposta', 'negociacao', 'ganho', 'perdido'] as const;
type Etapa = (typeof ETAPAS)[number];
const ehEtapa = (v: unknown): v is Etapa => typeof v === 'string' && (ETAPAS as readonly string[]).includes(v);

export async function prepararCrm(pool: pg.Pool) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS crm_leads (
      cnpj char(14) PRIMARY KEY,
      etapa text NOT NULL DEFAULT 'novo',
      ordem double precision NOT NULL DEFAULT 0,
      valor numeric,
      proxima_acao date,
      notas text,
      origem text,
      dados jsonb NOT NULL,
      criado_em timestamptz NOT NULL DEFAULT now(),
      atualizado_em timestamptz NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS crm_leads_etapa_idx ON crm_leads (etapa, ordem);
  `);
}

// Retrato dos dados de cada empresa, gravado junto do lead no CRM do usuário (Supabase)
const SQL_DADOS = `jsonb_build_object(
  'razao_social', e.razao_social, 'nome_fantasia', e.nome_fantasia,
  'municipio', e.municipio, 'uf', e.uf, 'bairro', e.bairro,
  'telefone1', e.telefone1, 'telefone2', e.telefone2, 'email', e.email,
  'cnae_principal', e.cnae_principal, 'cnae_descricao', c.descricao,
  'porte', e.porte, 'capital_social', e.capital_social,
  'simples', e.simples, 'mei', e.mei, 'data_abertura', e.data_abertura,
  'endereco', concat_ws(' ', e.tipo_logradouro, e.logradouro, e.numero), 'cep', e.cep)`;

export function rotasCrm(app: FastifyInstance, pool: pg.Pool) {
  app.post<{ Body: { cnpjs?: string[] } }>('/snapshot', async (req, reply) => {
    const cnpjs = (req.body?.cnpjs ?? []).map((c) => String(c).replace(/\D/g, '')).filter((c) => c.length === 14).slice(0, 500);
    if (!cnpjs.length) return reply.code(400).send({ erro: 'Informe ao menos um CNPJ' });
    const { rows } = await pool.query(
      `SELECT e.cnpj, ${SQL_DADOS} AS dados
       FROM empresas e LEFT JOIN cnaes c ON c.codigo = e.cnae_principal
       WHERE e.cnpj = ANY($1) ORDER BY e.razao_social`,
      [cnpjs],
    );
    return rows;
  });

  app.get('/crm', async () => {
    const { rows } = await pool.query(
      `SELECT cnpj, etapa, ordem, valor, proxima_acao, notas, origem, dados, criado_em, atualizado_em
       FROM crm_leads ORDER BY etapa, ordem, criado_em LIMIT 5000`,
    );
    return rows;
  });

  // Adiciona empresas ao funil. Se já existir em "novo" e vier com etapa mais avançada
  // (ex.: clique no WhatsApp → "contato"), avança; nunca retrocede um lead.
  app.post<{ Body: { cnpjs?: string[]; etapa?: string; origem?: string } }>('/crm', async (req, reply) => {
    const cnpjs = (req.body?.cnpjs ?? []).map((c) => String(c).replace(/\D/g, '')).filter((c) => c.length === 14).slice(0, 500);
    const etapa = req.body?.etapa ?? 'novo';
    if (!cnpjs.length) return reply.code(400).send({ erro: 'Informe ao menos um CNPJ' });
    if (!ehEtapa(etapa)) return reply.code(400).send({ erro: 'Etapa inválida' });

    const { rowCount } = await pool.query(
      `INSERT INTO crm_leads (cnpj, etapa, ordem, origem, dados)
       SELECT e.cnpj, $2,
              coalesce((SELECT max(ordem) FROM crm_leads WHERE etapa = $2), 0) + row_number() OVER (ORDER BY e.razao_social),
              $3,
              jsonb_build_object(
                'razao_social', e.razao_social, 'nome_fantasia', e.nome_fantasia,
                'municipio', e.municipio, 'uf', e.uf, 'bairro', e.bairro,
                'telefone1', e.telefone1, 'telefone2', e.telefone2, 'email', e.email,
                'cnae_principal', e.cnae_principal, 'cnae_descricao', c.descricao,
                'porte', e.porte, 'capital_social', e.capital_social,
                'simples', e.simples, 'mei', e.mei, 'data_abertura', e.data_abertura,
                'endereco', concat_ws(' ', e.tipo_logradouro, e.logradouro, e.numero), 'cep', e.cep)
       FROM empresas e LEFT JOIN cnaes c ON c.codigo = e.cnae_principal
       WHERE e.cnpj = ANY($1)
       ON CONFLICT (cnpj) DO UPDATE
         SET etapa = CASE WHEN crm_leads.etapa = 'novo' AND EXCLUDED.etapa <> 'novo' THEN EXCLUDED.etapa ELSE crm_leads.etapa END,
             atualizado_em = CASE WHEN crm_leads.etapa = 'novo' AND EXCLUDED.etapa <> 'novo' THEN now() ELSE crm_leads.atualizado_em END`,
      [cnpjs, etapa, req.body?.origem ?? null],
    );
    return { adicionados: rowCount };
  });

  app.patch<{ Params: { cnpj: string }; Body: Record<string, unknown> }>('/crm/:cnpj', async (req, reply) => {
    const b = req.body ?? {};
    const sets: string[] = [];
    const params: unknown[] = [req.params.cnpj.replace(/\D/g, '')];
    const set = (coluna: string, valor: unknown) => {
      params.push(valor);
      sets.push(`${coluna} = $${params.length}`);
    };

    if ('etapa' in b) {
      if (!ehEtapa(b.etapa)) return reply.code(400).send({ erro: 'Etapa inválida' });
      set('etapa', b.etapa);
    }
    if ('ordem' in b && Number.isFinite(Number(b.ordem))) set('ordem', Number(b.ordem));
    if ('valor' in b) set('valor', b.valor === null || b.valor === '' ? null : Number(b.valor));
    if ('proxima_acao' in b) set('proxima_acao', typeof b.proxima_acao === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(b.proxima_acao) ? b.proxima_acao : null);
    if ('notas' in b) set('notas', typeof b.notas === 'string' ? b.notas.slice(0, 5000) : null);
    if (!sets.length) return reply.code(400).send({ erro: 'Nada para atualizar' });

    const { rows } = await pool.query(
      `UPDATE crm_leads SET ${sets.join(', ')}, atualizado_em = now() WHERE cnpj = $1 RETURNING *`,
      params,
    );
    if (!rows[0]) return reply.code(404).send({ erro: 'Lead não encontrado' });
    return rows[0];
  });

  app.delete<{ Params: { cnpj: string } }>('/crm/:cnpj', async (req) => {
    const { rowCount } = await pool.query('DELETE FROM crm_leads WHERE cnpj = $1', [req.params.cnpj.replace(/\D/g, '')]);
    return { removidos: rowCount };
  });
}
