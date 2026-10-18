#!/usr/bin/env bash
# Baixa a base de CNPJ da Receita Federal, filtra por UF/situação e carrega no Postgres.
#
# Variáveis:
#   UFS        UFs separadas por vírgula ou ALL        (padrão: PR)
#   SITUACOES  códigos de situação ou ALL; 02 = ativa  (padrão: 02)
#   MES        AAAA-MM; vazio = mês mais recente
#   DATA_DIR   onde ficam os ZIPs e arquivos de trabalho (padrão: /data)
#   SO_LOCAL   1 = não baixa nada; carrega só os ZIPs já completos (carga parcial enquanto o download segue)
#   PG*        conexão com o Postgres (PGHOST, PGUSER, PGPASSWORD, PGDATABASE)
set -euo pipefail

UFS=${UFS:-PR}
SITUACOES=${SITUACOES:-02}
MES=${MES:-}
DATA_DIR=${DATA_DIR:-/data}
SO_LOCAL=${SO_LOCAL:-0}
SHARE=${RFB_SHARE:-YggdBLfdninEJX9}
BASE="https://arquivos.receitafederal.gov.br/public.php/dav/files/$SHARE"
SQL_DIR=${SQL_DIR:-/sql}
export LC_ALL=C

log() { echo "[$(date '+%F %T')] $*"; }

# O servidor da Receita às vezes devolve corpo vazio; repete até vir conteúdo.
propfind() {
  local out
  for _ in $(seq 1 30); do
    out=$(curl -sS -m 120 -X PROPFIND -H 'Depth: 1' "$1" || true)
    if [ -n "$out" ]; then printf '%s' "$out"; return 0; fi
    sleep 5
  done
  log "PROPFIND falhou: $1" >&2
  return 1
}

# Saída: "nome tamanho" por arquivo da pasta do mês
listar_arquivos() {
  propfind "$BASE/$MES/" | sed 's#<d:response>#\n#g' | while read -r linha; do
    nome=$(sed -n 's#.*<d:href>[^<]*/\([^/<]*\.zip\)</d:href>.*#\1#p' <<<"$linha")
    tam=$(sed -n 's#.*<d:getcontentlength>\([0-9]*\)</d:getcontentlength>.*#\1#p' <<<"$linha")
    if [ -n "$nome" ] && [ -n "$tam" ]; then echo "$nome $tam"; fi
  done
}

baixar() {
  local nome=$1 tam=$2 arq="$DIR/$1" atual
  for tentativa in $(seq 1 30); do
    atual=$(stat -c %s "$arq" 2>/dev/null || echo 0)
    if [ "$atual" = "$tam" ]; then
      if unzip -tq "$arq" >/dev/null 2>&1; then return 0; fi
      log "  $nome corrompido, baixando de novo"; rm -f "$arq"; atual=0
    fi
    [ "$atual" -gt "$tam" ] && { rm -f "$arq"; atual=0; }
    [ "$tentativa" -gt 1 ] && log "  $nome: tentativa $tentativa ($atual/$tam bytes)"
    rc=0
    curl -sS -m 7200 -C - -o "$arq" "$BASE/$MES/$nome" || rc=$?
    if [ "$rc" -eq 33 ]; then rm -f "$arq"; fi   # servidor não aceitou retomar
    sleep 5
  done
  log "Falha ao baixar $nome"; return 1
}

descompactar() { unzip -p "$1" | tr -d '\000'; }

copy() { # tabela arquivo
  psql -v ON_ERROR_STOP=1 -q -c "\\copy $1 FROM '$2' WITH (FORMAT csv, DELIMITER ';', QUOTE '\"', ENCODING 'LATIN1')"
}

# ---------------------------------------------------------------------------

if [ -z "$MES" ] && [ "$SO_LOCAL" = 1 ]; then
  MES=$(find "$DATA_DIR" -mindepth 1 -maxdepth 1 -type d -name '20*' -printf '%f\n' | sort | tail -1)
elif [ -z "$MES" ]; then
  MES=$(propfind "$BASE/" | grep -oE "$SHARE/[0-9]{4}-[0-9]{2}/" | grep -oE '[0-9]{4}-[0-9]{2}' | sort -u | tail -1)
fi
[ -n "$MES" ] || { log "Não foi possível descobrir o mês mais recente"; exit 1; }

DIR="$DATA_DIR/$MES"
WORK="$DATA_DIR/work$([ "$SO_LOCAL" = 1 ] && echo -parcial)"
mkdir -p "$DIR" "$WORK"
log "Mês $MES | UFs: $UFS | situações: $SITUACOES"

psql -v ON_ERROR_STOP=1 -q -f "$SQL_DIR/schema.sql"
if [ "$(psql -tA -c 'SELECT count(*) FROM municipios_geo')" = "0" ]; then
  log "Carregando coordenadas dos municípios"
  psql -v ON_ERROR_STOP=1 -q <<SQL
CREATE TEMP TABLE g (ibge int, nome text, lat float8, lng float8, capital int, uf int, siafi int, ddd int, fuso text);
\\copy g FROM '$SQL_DIR/municipios_geo.csv' WITH (FORMAT csv, HEADER true)
INSERT INTO municipios_geo SELECT DISTINCT ON (siafi) siafi, ibge, nome, uf, lat, lng, capital = 1, ddd FROM g ON CONFLICT DO NOTHING;
SQL
fi
CARGA_ID=$(psql -qtA -v ON_ERROR_STOP=1 -c "INSERT INTO cargas (mes_referencia, ufs, situacoes) VALUES ('$MES', '$UFS', '$SITUACOES') RETURNING id")

if [ "$SO_LOCAL" = 1 ]; then
  log "Modo parcial: usando só os ZIPs já completos"
  ESTABS=()
  for f in "$DIR"/Estabelecimentos*.zip; do
    if unzip -tq "$f" >/dev/null 2>&1; then ESTABS+=("$f"); log "  ok: $(basename "$f")"; else log "  ainda baixando: $(basename "$f")"; fi
  done
  [ ${#ESTABS[@]} -gt 0 ] || { log "Nenhum arquivo de Estabelecimentos completo ainda"; exit 1; }
  for f in Cnaes Empresas0 Empresas9; do
    unzip -tq "$DIR/$f.zip" >/dev/null 2>&1 || { log "$f.zip ainda não está completo"; exit 1; }
  done
else
  ARQUIVOS=$(listar_arquivos | grep -E '^(Estabelecimentos|Empresas|Simples|Cnaes|Municipios)')
  [ "$(grep -c '^Estabelecimentos' <<<"$ARQUIVOS")" -ge 10 ] || { log "Listagem incompleta:"; echo "$ARQUIVOS"; exit 1; }

  log "Baixando $(wc -l <<<"$ARQUIVOS") arquivos"
  while read -r nome tam; do
    log "  $nome ($((tam / 1000000)) MB)"
    baixar "$nome" "$tam"
  done <<<"$ARQUIVOS"
  ESTABS=("$DIR"/Estabelecimentos*.zip)
fi

# Reescreve a linha como CSV válido: a Receita às vezes deixa aspas soltas dentro de um campo,
# o que faria o COPY "engolir" milhões de linhas até estourar memória.
# Reescreve a linha como CSV válido: a Receita às vezes deixa aspas soltas dentro de um campo,
# o que faria o COPY "engolir" milhões de linhas até estourar memória. Linha com número de
# campos diferente do esperado (separador quebrado) é descartada e contada no log.
SANEAR='
  function sanear(l, esperado,   n, f, i, out) {
    sub(/^"/, "", l); sub(/"\r?$/, "", l)
    n = split(l, f, "\";\"")
    if (n != esperado) { descartadas++; return "" }
    out = ""
    for (i = 1; i <= n; i++) { gsub(/"/, "\"\"", f[i]); out = out (i > 1 ? "\";\"" : "") f[i] }
    return "\"" out "\""
  }
  END { if (descartadas) printf "  %d linhas malformadas descartadas\n", descartadas > "/dev/stderr" }'

filtrar_estab() {
  awk -v ufs="$UFS" -v sits="$SITUACOES" "$SANEAR"'
    BEGIN {
      FS = "\";\""
      n = split(ufs, a, ","); for (i = 1; i <= n; i++) U[a[i]] = 1
      n = split(sits, b, ","); for (i = 1; i <= n; i++) S[b[i]] = 1
    }
    (ufs == "ALL" || ($20 in U)) && (sits == "ALL" || ($6 in S)) { l = sanear($0, 30); if (l != "") print l }
  '
}
sanear() { awk -v esperado="$1" "$SANEAR"' { l = sanear($0, esperado); if (l != "") print l }'; }

copy_stdin() { # tabela  (lê o CSV da entrada padrão)
  psql -v ON_ERROR_STOP=1 -q -c "\\copy $1 FROM pstdin WITH (FORMAT csv, DELIMITER ';', QUOTE '\"', ENCODING 'LATIN1')"
}
tem_zip() { unzip -tq "$DIR/$1.zip" >/dev/null 2>&1; }

psql -v ON_ERROR_STOP=1 -q -c "TRUNCATE stg_estabelecimentos, stg_empresas, stg_simples, stg_codigos_cnaes, stg_codigos_municipios"

if [ "$UFS" = "ALL" ]; then
  # Brasil inteiro: direto do ZIP para o banco, sem arquivos intermediários nem lista de CNPJs em memória
  log "Carregando estabelecimentos (Brasil inteiro, direto no banco)"
  for f in "${ESTABS[@]}"; do
    log "  $(basename "$f")"
    descompactar "$f" | filtrar_estab | copy_stdin stg_estabelecimentos
  done
  TOTAL=$(psql -qtA -c "SELECT count(*) FROM stg_estabelecimentos")
  log "  $TOTAL estabelecimentos"
  log "Carregando empresas e Simples"
  for f in "$DIR"/Empresas*.zip; do descompactar "$f" | sanear 7 | copy_stdin stg_empresas; done
  if tem_zip Simples; then descompactar "$DIR/Simples.zip" | sanear 7 | copy_stdin stg_simples
  else log "  Simples.zip ainda não baixado: regime (Simples/MEI) fica vazio nesta carga"; fi
else
  log "Filtrando estabelecimentos"
  : >"$WORK/estab.csv"
  for f in "${ESTABS[@]}"; do descompactar "$f" | filtrar_estab >>"$WORK/estab.csv"; done
  TOTAL=$(wc -l <"$WORK/estab.csv")
  log "  $TOTAL estabelecimentos"

  log "Filtrando empresas e Simples pelos CNPJs selecionados"
  cut -c2-9 "$WORK/estab.csv" | sort -u -S 256M -T "$WORK" >"$WORK/basicos.txt"
  filtrar_basicos() { awk 'NR == FNR { K[$1]; next } substr($0, 2, 8) in K' "$WORK/basicos.txt" -; }
  for f in "$DIR"/Empresas*.zip; do descompactar "$f"; done | filtrar_basicos | sanear 7 >"$WORK/empresas.csv"
  if tem_zip Simples; then descompactar "$DIR/Simples.zip" | filtrar_basicos | sanear 7 >"$WORK/simples.csv"
  else log "  Simples.zip ainda não baixado: regime (Simples/MEI) fica vazio nesta carga"; : >"$WORK/simples.csv"; fi

  log "Carregando staging"
  copy stg_estabelecimentos "$WORK/estab.csv"
  copy stg_empresas "$WORK/empresas.csv"
  copy stg_simples "$WORK/simples.csv"
  rm -f "$WORK"/*.csv "$WORK/basicos.txt"
fi

descompactar "$DIR/Cnaes.zip" | copy_stdin stg_codigos_cnaes
if tem_zip Municipios; then descompactar "$DIR/Municipios.zip" | copy_stdin stg_codigos_municipios
else log "  Municipios.zip ainda não baixado: nomes vêm da tabela de coordenadas"; fi
psql -q -c "ANALYZE stg_estabelecimentos, stg_empresas, stg_simples"

log "Montando tabela final e índices"
psql -v ON_ERROR_STOP=1 -q -v mes="$MES" -f "$SQL_DIR/build.sql"
log "Pré-calculando resumo por UF"
psql -v ON_ERROR_STOP=1 -q -f "$SQL_DIR/resumo_uf.sql"
psql -q -c "UPDATE cargas SET total_estabelecimentos = $TOTAL, concluida_em = now() WHERE id = $CARGA_ID"

rm -rf "$WORK"
# Mantém só os ZIPs do mês carregado
find "$DATA_DIR" -mindepth 1 -maxdepth 1 -type d -name '20*' ! -name "$MES" -exec rm -rf {} +
log "Concluído: $TOTAL estabelecimentos do mês $MES"

# Pré-aquece o cache da API (totais, mapa e contagem por UF) para a primeira visita ser rápida
if [ -n "${API_URL:-}" ] && [ -n "${API_KEY:-}" ]; then
  log "Aquecendo cache da API"
  sleep 70   # a API detecta a carga nova em até 60 s e limpa o cache antigo
  for uf in $(psql -qtA -c "SELECT DISTINCT uf FROM empresas ORDER BY 1"); do
    for rota in "resumo?uf=$uf" "mapa?uf=$uf" "empresas?uf=$uf&limit=30"; do
      curl -s -o /dev/null -m 120 -H "x-api-key: $API_KEY" "$API_URL/$rota" || true
    done
  done
  log "Cache aquecido"
fi
