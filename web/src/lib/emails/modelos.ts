import { type Bloco, esc, montarEmail } from "./layout";

// Estratégia de e-mails do Radar B2B
//
// Transacionais (sempre enviados, disparados por uma ação):
//   boas_vindas ......... conta confirmada: o que fazer primeiro (3 buscas prontas)
//   creditos_acabando ... usou 4 das 5 pesquisas: avisa e mostra o avulso de R$ 10
//   gratis_esgotado ..... acabou o grátis: avulso x Pro anual (-40%)
//   pix_pendente ........ gerou Pix e não pagou: código copia e cola para concluir
//   pagamento_avulso .... consulta avulsa liberada
//   assinatura_ativa .... Pro ativo (mensal ou anual): primeiros passos com CRM
//   renovacao_cancelada . cancelou: acesso até a data + porta aberta
//   vence_3d ............ Pro no Pix vence em 3 dias: renovar
//
// Relacionamento (agendados, 1x por dia, com descadastro):
//   dica_d1 ............. 1 dia após o cadastro, ainda sem pesquisa: "sua primeira lista em 30 s"
//   casos_d3 ............ 3 dias: como times usam (segmento + cidade + WhatsApp + CRM)
//   oferta_d7 ........... 7 dias, ainda no grátis: anual 12x R$ 59,40 (-40%)
//   venceu .............. Pro venceu e não renovou (1 dia depois): volta com o funil salvo

export type TipoEmail =
  | "boas_vindas" | "creditos_acabando" | "gratis_esgotado" | "pix_pendente" | "pagamento_avulso"
  | "assinatura_ativa" | "renovacao_cancelada" | "vence_3d"
  | "dica_d1" | "casos_d3" | "oferta_d7" | "venceu";

export const RELACIONAMENTO: TipoEmail[] = ["dica_d1", "casos_d3", "oferta_d7", "venceu"];

export type Dados = {
  nome?: string | null;
  /** pix_pendente */
  pix?: string; valor?: string;
  /** assinatura_ativa */
  ciclo?: "mensal" | "anual";
  /** renovacao_cancelada, vence_3d */
  ate?: string;
  /** pagamento_avulso */
  consulta?: string | null;
  /** link de descadastro (relacionamento) */
  descadastro?: string;
};

const SITE = "https://www.b2bradar.pro";
const link = (caminho: string, campanha: string) => {
  const u = new URL(caminho, SITE);
  u.searchParams.set("utm_source", "email");
  u.searchParams.set("utm_medium", "email");
  u.searchParams.set("utm_campaign", campanha);
  return u.toString();
};
const busca = (texto: string, campanha: string) => link(`/app?busca=${encodeURIComponent(texto)}`, campanha);
const primeiroNome = (n?: string | null) => (n ? esc(n.trim().split(/\s+/)[0]) : "");
const ola = (n?: string | null) => (primeiroNome(n) ? `Oi, ${primeiroNome(n)}!` : "Oi!");

const EXEMPLOS = ["Padarias em Curitiba com WhatsApp", "Clínicas odontológicas em Belo Horizonte", "Agropecuárias abertas no último ano em Goiás"];

export function modeloEmail(tipo: TipoEmail, d: Dados = {}): { assunto: string; html: string } {
  const m = MODELOS[tipo](d);
  return { assunto: m.assunto, html: montarEmail({ ...m, descadastro: RELACIONAMENTO.includes(tipo) ? d.descadastro : undefined }) };
}

type Modelo = { assunto: string; preheader: string; selo?: string; titulo: string; blocos: Bloco[]; rodape?: string };

const MODELOS: Record<TipoEmail, (d: Dados) => Modelo> = {
  boas_vindas: (d) => ({
    assunto: "Sua conta no Radar B2B está pronta",
    preheader: "28 milhões de empresas, 5 pesquisas grátis e 3 buscas prontas para começar.",
    selo: "Bem-vindo",
    titulo: `${ola(d.nome)} Vamos achar seus próximos clientes.`,
    blocos: [
      { tipo: "texto", html: "Você tem <strong>5 pesquisas e 10 contatos grátis</strong> para testar. Descreva o cliente ideal do jeito que falaria com alguém do seu time, e o Radar transforma em filtros:" },
      { tipo: "exemplos", itens: EXEMPLOS.map((t) => ({ texto: t, url: busca(t, "boas_vindas") })) },
      { tipo: "numeros", itens: [{ valor: "28M", rotulo: "empresas ativas" }, { valor: "5.570", rotulo: "cidades" }, { valor: "95%", rotulo: "com telefone" }] },
      { tipo: "botao", texto: "Fazer minha primeira busca", url: link("/app", "boas_vindas") },
      { tipo: "texto", html: `<span style="color:#6B7079;font-size:13px;">Dica: abra a empresa para ver telefone, WhatsApp e e-mail. Cada contato aberto usa 1 dos seus 10 grátis.</span>` },
    ],
  }),

  creditos_acabando: (d) => ({
    assunto: "Resta 1 pesquisa grátis na sua conta",
    preheader: "Use bem a última, ou libere uma pesquisa inteira por R$ 10.",
    selo: "1 pesquisa restante",
    titulo: `${ola(d.nome)} Sua última pesquisa grátis está aqui.`,
    blocos: [
      { tipo: "texto", html: "Você já usou 4 das 5 pesquisas grátis. Para a última valer mais, combine <strong>segmento + cidade + “com WhatsApp”</strong>: a lista sai mais enxuta e pronta para abordar." },
      { tipo: "destaque", titulo: "Precisa de uma lista grande de uma vez?", texto: "A consulta avulsa libera uma pesquisa por <strong>R$ 10</strong>: até 20 páginas (600 empresas), contatos completos e exportação em CSV, no Pix ou cartão." },
      { tipo: "botao", texto: "Abrir o Radar", url: link("/app", "creditos_acabando") },
    ],
  }),

  gratis_esgotado: (d) => ({
    assunto: "Seu teste grátis acabou. Escolha como continuar",
    preheader: "R$ 10 por pesquisa ou tudo liberado com 40% off no anual.",
    selo: "Teste concluído",
    titulo: `${ola(d.nome)} Gostou do que encontrou?`,
    blocos: [
      { tipo: "texto", html: "Suas 5 pesquisas grátis acabaram. Você pode continuar de dois jeitos:" },
      { tipo: "destaque", titulo: "Só uma lista: R$ 10", texto: "Libere a pesquisa que você precisa agora: 20 páginas, contatos e CSV por 30 dias." },
      { tipo: "destaque", titulo: "Prospecção todo dia: Pro por 12x de R$ 59,40", texto: "No anual, <strong>40% off</strong> (de R$ 1.188 por R$ 712,80). Pesquisas, contatos e páginas ilimitados, com CRM para acompanhar cada lead." },
      { tipo: "botao", texto: "Ver os planos", url: link("/planos", "gratis_esgotado") },
    ],
  }),

  pix_pendente: (d) => ({
    assunto: "Falta só pagar o Pix para liberar seu acesso",
    preheader: "Copie o código e pague no app do seu banco. A liberação é automática.",
    selo: "Pix aguardando",
    titulo: `${ola(d.nome)} Seu Pix está pronto${d.valor ? ` (${esc(d.valor)})` : ""}.`,
    blocos: [
      { tipo: "texto", html: "Abra o app do seu banco, escolha <strong>Pix copia e cola</strong> e cole o código abaixo. Assim que o pagamento cair, seu acesso é liberado sozinho." },
      ...(d.pix ? [{ tipo: "codigo" as const, rotulo: "Código Pix (copia e cola)", valor: d.pix }] : []),
      { tipo: "texto", html: `<span style="color:#6B7079;font-size:13px;">O código vale por tempo limitado. Se expirar, é só gerar outro na página de planos.</span>` },
      { tipo: "botao", texto: "Gerar um novo Pix", url: link("/planos", "pix_pendente") },
    ],
  }),

  pagamento_avulso: (d) => ({
    assunto: "Pesquisa liberada! Seus contatos estão prontos",
    preheader: "Até 20 páginas, contatos completos e exportação por 30 dias.",
    selo: "Pagamento aprovado",
    titulo: `${ola(d.nome)} Sua pesquisa está liberada.`,
    blocos: [
      { tipo: "lista", itens: ["Até <strong>20 páginas</strong> (600 empresas)", "Telefone, WhatsApp e e-mail de todas", "Exportação em CSV para planilha ou CRM", "Válida por <strong>30 dias</strong>"] },
      { tipo: "botao", texto: "Ver minha pesquisa", url: link(d.consulta ? `/app?${d.consulta}` : "/app", "pagamento_avulso") },
      { tipo: "texto", html: `<span style="color:#6B7079;font-size:13px;">Vai fazer isso toda semana? No Pro anual sai por 12x de R$ 59,40, com tudo ilimitado.</span>` },
    ],
  }),

  assinatura_ativa: (d) => ({
    assunto: `Bem-vindo ao Radar B2B Pro${d.ciclo === "anual" ? " anual" : ""}`,
    preheader: "Tudo liberado: pesquisas, contatos, páginas e CRM.",
    selo: d.ciclo === "anual" ? "Pro anual ativo" : "Pro ativo",
    titulo: `${ola(d.nome)} Agora é tudo ilimitado.`,
    blocos: [
      { tipo: "texto", html: "Obrigado por assinar! Em 3 passos você monta uma rotina de prospecção:" },
      { tipo: "lista", itens: [
        "<strong>Busque</strong> seu cliente ideal no chat (segmento, cidade, porte, “com WhatsApp”).",
        "<strong>Selecione</strong> as melhores e envie ao CRM em massa.",
        "<strong>Chame no WhatsApp</strong> em 1 clique: o lead vai sozinho para “Em contato”.",
      ] },
      { tipo: "botao", texto: "Começar a prospectar", url: link("/app", "assinatura_ativa") },
      { tipo: "texto", html: `<span style="color:#6B7079;font-size:13px;">${d.ciclo === "anual" ? "Seu acesso vale por 12 meses." : "No cartão, a assinatura renova sozinha todo mês. Você pode cancelar quando quiser em Planos."}</span>` },
    ],
  }),

  renovacao_cancelada: (d) => ({
    assunto: "Renovação cancelada. Seu acesso continua até o fim do período",
    preheader: d.ate ? `Você segue com o Pro até ${d.ate}.` : "Você segue com o Pro até o fim do período pago.",
    selo: "Renovação cancelada",
    titulo: `${ola(d.nome)} Tudo certo com o cancelamento.`,
    blocos: [
      { tipo: "texto", html: `A renovação automática foi cancelada e nada mais será cobrado. Você continua com o Pro${d.ate ? ` até <strong>${esc(d.ate)}</strong>` : " até o fim do período pago"}, e seu funil no CRM fica salvo.` },
      { tipo: "texto", html: "Se puder, responda este e-mail contando o motivo. Lemos todas as respostas." },
      { tipo: "botao", texto: "Reativar a assinatura", url: link("/planos", "renovacao_cancelada") },
    ],
  }),

  vence_3d: (d) => ({
    assunto: "Seu Radar B2B Pro vence em 3 dias",
    preheader: "Renove no Pix ou ative a renovação automática no cartão.",
    selo: "Vence em 3 dias",
    titulo: `${ola(d.nome)} Seu Pro vence${d.ate ? ` em ${esc(d.ate)}` : " em 3 dias"}.`,
    blocos: [
      { tipo: "texto", html: "Para não perder o acesso às pesquisas ilimitadas e ao CRM, renove agora. No cartão a renovação passa a ser automática; no anual você economiza 40%." },
      { tipo: "botao", texto: "Renovar meu Pro", url: link("/planos", "vence_3d") },
    ],
  }),

  dica_d1: (d) => ({
    assunto: "Sua primeira lista de clientes em 30 segundos",
    preheader: "Escreva como você falaria com seu time. O Radar faz o resto.",
    titulo: `${ola(d.nome)} Ainda não fez sua primeira busca?`,
    blocos: [
      { tipo: "texto", html: "É só escrever quem você quer encontrar. Toque numa dessas e veja a lista na hora:" },
      { tipo: "exemplos", itens: [...EXEMPLOS, "Restaurantes no centro de Florianópolis"].map((t) => ({ texto: t, url: busca(t, "dica_d1") })) },
      { tipo: "texto", html: "Quanto mais específico (segmento, cidade, porte, abertas recentemente, com WhatsApp), mais pronta para abordar sai a lista." },
      { tipo: "botao", texto: "Fazer minha busca", url: link("/app", "dica_d1") },
    ],
  }),

  casos_d3: (d) => ({
    assunto: "3 jeitos de usar o Radar para vender mais esta semana",
    preheader: "Representantes, distribuidores e agências: veja como cada um usa.",
    titulo: `${ola(d.nome)} Como times comerciais usam o Radar.`,
    blocos: [
      { tipo: "destaque", titulo: "Representante comercial", texto: "Filtra o segmento da carteira por cidade da rota e chama no WhatsApp antes da visita." },
      { tipo: "destaque", titulo: "Distribuidor / indústria", texto: "Lista empresas <strong>abertas nos últimos 12 meses</strong>: negócio novo ainda está escolhendo fornecedor." },
      { tipo: "destaque", titulo: "Agência e software B2B", texto: "Separa por porte e regime (MEI, Simples) para falar a língua de cada um, e acompanha tudo no CRM." },
      { tipo: "botao", texto: "Montar minha lista", url: link("/app", "casos_d3") },
    ],
  }),

  oferta_d7: (d) => ({
    assunto: "40% off no Radar B2B Pro: 12x de R$ 59,40",
    preheader: "De R$ 1.188 por R$ 712,80 no ano. Tudo ilimitado + CRM.",
    selo: "-40% no anual",
    titulo: `${ola(d.nome)} Prospecção ilimitada pelo preço de um café por dia.`,
    blocos: [
      { tipo: "numeros", itens: [{ valor: "R$ 59,40", rotulo: "por mês no anual" }, { valor: "-40%", rotulo: "vs. mensal" }, { valor: "∞", rotulo: "pesquisas" }] },
      { tipo: "lista", itens: ["Pesquisas, contatos e páginas ilimitados", "CRM kanban com WhatsApp em 1 clique", "Exportação em CSV de até 20 mil empresas", "Cartão em até 12x ou Pix à vista"] },
      { tipo: "botao", texto: "Quero o anual com 40% off", url: link("/checkout?plano=pro_anual", "oferta_d7") },
      { tipo: "texto", html: `<span style="color:#6B7079;font-size:13px;">Prefere testar primeiro? O mensal sai por R$ 99 e você cancela quando quiser.</span>` },
    ],
  }),

  venceu: (d) => ({
    assunto: "Seu funil continua salvo no Radar B2B",
    preheader: "Reative o Pro e continue de onde parou.",
    titulo: `${ola(d.nome)} Seus leads estão esperando.`,
    blocos: [
      { tipo: "texto", html: "Seu plano Pro venceu, mas nada foi perdido: o funil do CRM, as buscas e os favoritos continuam na sua conta. Reative e continue de onde parou." },
      { tipo: "botao", texto: "Reativar meu Pro", url: link("/planos", "venceu") },
    ],
  }),
};

// ---------------------------------------------------------------------------
// Modelos do Supabase Auth (enviados pelo Supabase via SMTP do Resend). Usam as variáveis do Supabase
// ({{ .Token }}, {{ .ConfirmationURL }}); geram os arquivos em supabase/templates/ (veja /api/emails/previa).

export type TipoAuth = "confirmacao" | "recuperacao" | "troca_email";

export function modeloAuth(tipo: TipoAuth) {
  const m: Record<TipoAuth, { assunto: string; html: string }> = {
    confirmacao: {
      assunto: "Seu código do Radar B2B: {{ .Token }}",
      html: montarEmail({
        preheader: "Digite o código no Radar para confirmar seu e-mail.",
        selo: "Confirme seu e-mail",
        titulo: "Seu código de acesso",
        blocos: [
          { tipo: "texto", html: "Digite este código na tela de cadastro do Radar B2B para confirmar seu e-mail:" },
          { tipo: "numeros", itens: [{ valor: "{{ .Token }}", rotulo: "válido por 1 hora" }] },
          { tipo: "texto", html: "Ou, se preferir, confirme com um clique:" },
          { tipo: "botao", texto: "Confirmar meu e-mail", url: "{{ .ConfirmationURL }}" },
          { tipo: "texto", html: `<span style="color:#6B7079;font-size:13px;">Não criou uma conta no Radar B2B? Pode ignorar este e-mail.</span>` },
        ],
      }),
    },
    recuperacao: {
      assunto: "Redefina sua senha do Radar B2B",
      html: montarEmail({
        preheader: "Crie uma nova senha em poucos segundos.",
        selo: "Nova senha",
        titulo: "Vamos criar uma nova senha",
        blocos: [
          { tipo: "texto", html: "Recebemos um pedido para redefinir a senha da sua conta. Clique no botão para escolher uma nova:" },
          { tipo: "botao", texto: "Criar nova senha", url: "{{ .ConfirmationURL }}" },
          { tipo: "texto", html: `<span style="color:#6B7079;font-size:13px;">O link vale por 1 hora. Se não foi você, ignore este e-mail: sua senha continua a mesma.</span>` },
        ],
      }),
    },
    troca_email: {
      assunto: "Confirme seu novo e-mail no Radar B2B",
      html: montarEmail({
        preheader: "Confirme a troca de e-mail da sua conta.",
        selo: "Troca de e-mail",
        titulo: "Confirme seu novo e-mail",
        blocos: [
          { tipo: "texto", html: "Para usar <strong>{{ .NewEmail }}</strong> na sua conta do Radar B2B, confirme abaixo:" },
          { tipo: "botao", texto: "Confirmar novo e-mail", url: "{{ .ConfirmationURL }}" },
          { tipo: "texto", html: `<span style="color:#6B7079;font-size:13px;">Não pediu essa troca? Ignore este e-mail e fale com a gente.</span>` },
        ],
      }),
    },
  };
  return m[tipo];
}
