# B2B Prospect

Busca de empresas com filtros (UF, cidade, CNAE, porte, Simples/MEI, abertura...) sobre a base aberta de CNPJ da Receita Federal.

```
etl/   baixa a base mensal da Receita, filtra por UF/situação e carrega no Postgres
db/    schema.sql (estrutura) e build.sql (monta a tabela final e troca sem downtime)
api/   API de busca (Node + Fastify)
web/   front em Next.js 16 (dashboard com mapa de calor, filtros e lista de prospects)
```

## VPS (Hostinger) — `/opt/b2b`

Roda em containers próprios, isolados de outros serviços da máquina. Acesso: variáveis `VPS` e `VPS_CHAVE` em `.env.dev` (fora do git).

```bash
# deploy a partir do Mac
rsync -az --exclude node_modules --exclude dist --exclude data --exclude .env \
  -e "ssh -i $VPS_CHAVE" ./ $VPS:/opt/b2b/
ssh -i $VPS_CHAVE $VPS 'cd /opt/b2b && docker compose up -d --build api'

# carga (padrão: PR, ativas, mês mais recente) — o servidor da Receita é lento (~0,5–1 MB/s)
cd /opt/b2b && nohup docker compose run --rm etl > data/etl.log 2>&1 &
# outras UFs: UFS=PR,SC,SP docker compose run --rm etl   |  Brasil: UFS=ALL
```

Segredos ficam em `/opt/b2b/.env` (gerados na VPS, veja `.env.example`).

## API

Todas as rotas (exceto `/health`) exigem o header `x-api-key`.

| Rota | Descrição |
|---|---|
| `GET /empresas` | Busca paginada. Filtros: `uf`, `municipio`, `cnae`, `cnae_secundario=true`, `porte` (1,3,5), `situacao`, `simples`, `mei`, `matriz`, `abertura_de`, `abertura_ate`, `capital_min`, `capital_max`, `com_telefone`, `com_email`, `bairro`, `q` (nome ou CNPJ), `ordem` (nome, abertura_desc, abertura_asc, capital_desc), `page`, `limit` (máx. 100) |
| `GET /empresas/:cnpj` | Detalhe com CNAEs secundários |
| `GET /municipios?uf=PR` | Municípios com total de empresas (código da Receita, não IBGE) |
| `GET /cnaes?q=padaria` | Autocomplete de CNAE por descrição ou código |
| `GET /resumo` | KPIs da busca: totais, % com contato, top CNAEs/cidades, aberturas por ano |
| `GET /mapa` | Total por município com lat/lng (mapa de calor; ignora o filtro de município) |
| `GET /exportar` | CSV da busca (`;` + BOM, abre direto no Excel), até 20.000 linhas |
| `GET /stats` | Última carga concluída |

Todos os endpoints de busca aceitam os mesmos filtros, além de `cnpjs` (lista explícita, usada nos salvos).

## Front (`web/`)

Next.js 16 + Tailwind 4 + MapLibre (tiles grátis do OpenFreeMap). O navegador fala só com `/api/b2b/*`,
que repassa para a API da VPS com a chave guardada no servidor.

```bash
# dev: túnel até a API da VPS + servidor local
./dev.sh   # abre o túnel (lê VPS e VPS_CHAVE de .env.dev) e sobe o front
cp web/.env.example web/.env.local   # preencha API_KEY (está em /opt/b2b/.env na VPS)
npm --prefix web run dev
```

Filtros ficam na URL (buscas compartilháveis). Login, CRM, favoritos e buscas salvas ficam no Supabase
(migrações em `supabase/migrations`, RLS por usuário).

### Deploy na Vercel

- **Root Directory:** `web`
- **Variáveis de ambiente:** `API_URL` (URL HTTPS pública da API — Caddy, perfil `https` do compose), `API_KEY`,
  `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` e, opcionalmente, `OPENAI_API_KEY`/`ANTHROPIC_API_KEY`
  e `NEXT_PUBLIC_WHATSAPP_EQUIPE` (veja `web/.env.example`).
- No Supabase, adicione o domínio da Vercel em Authentication → URL Configuration (Site URL e Redirect URLs).
