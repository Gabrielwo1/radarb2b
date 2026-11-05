import { AbsoluteFill, Audio, Easing, Sequence, interpolate, staticFile, useCurrentFrame } from "remotion";
import { Brilho, COR, CenaMarca, FPS, Icone3D, LogoWhats, Sfx, Titulo, ent, fontFamily, s } from "./Reel";

// Reel 2 — "Fim do mês". Dor: meta longe e funil vazio. Função: lista pronta + funil. Objetivo: meta batida.
// Narração ElevenLabs v3 (20,2 s), sem música.

export const DURACAO2 = 22 * FPS;

// Momentos da narração (segundos, medidos no áudio)
const T = {
  dia: 0, meta: 1.29, funil: 4.03, ninguem: 5.13, radar: 6.87, whats: 10.19, chama: 11.71, fim: 15.51,
  marca: 18.14, teste: 19.35,
};

export const Reel2 = () => (
  <AbsoluteFill style={{ background: COR.carvao, fontFamily, color: "white" }}>
    <Audio src={staticFile("audio/r2-narracao.mp3")} />
    <Efeitos />
    <Sequence from={0} durationInFrames={s(T.funil)}><CenaCalendario /></Sequence>
    <Sequence from={s(T.funil)} durationInFrames={s(T.radar - 0.15 - T.funil)}><CenaFunilVazio /></Sequence>
    <Sequence from={s(T.radar - 0.15)} durationInFrames={s(T.chama - T.radar + 0.15)}><CenaLista /></Sequence>
    <Sequence from={s(T.chama)} durationInFrames={s(T.fim - T.chama)}><CenaKanban /></Sequence>
    <Sequence from={s(T.fim)} durationInFrames={s(T.marca - T.fim)}><CenaMeta /></Sequence>
    <Sequence from={s(T.marca)}>
      <CenaMarca pare={0.6} teste={T.teste - T.marca} frase={<>Bata a meta <span style={{ color: COR.lime }}>todo mês.</span></>} />
    </Sequence>
  </AbsoluteFill>
);

function Efeitos() {
  return (
    <>
      <Sfx em={0} arquivo="calendario" volume={0.55} />
      <Sfx em={T.meta} arquivo="relogio" volume={0.4} />
      <Sfx em={T.funil} arquivo="boom" volume={0.6} />
      <Sfx em={T.radar - 0.2} arquivo="ping" volume={0.7} />
      <Sfx em={T.radar + 0.3} arquivo="digitacao" volume={0.4} />
      {[0, 1, 2, 3, 4].map((i) => <Sfx key={i} em={T.radar + 1.9 + i * 0.28} arquivo="pop" volume={0.35} />)}
      <Sfx em={T.whats} arquivo="ding" volume={0.45} />
      <Sfx em={T.chama + 0.5} arquivo="swoosh" volume={0.5} />
      <Sfx em={T.chama + 1.6} arquivo="swoosh" volume={0.45} />
      <Sfx em={T.chama + 2.6} arquivo="ding" volume={0.45} />
      <Sfx em={T.fim + 1.1} arquivo="conquista" volume={0.6} />
      <Sfx em={T.marca} arquivo="logo" volume={0.6} />
    </>
  );
}

// ---------------------------------------------------------------------------
// Cena 1 — "Dia 28. E a meta… em 30%."

function BarraMeta({ pct, cor, tamanho = 900 }: { pct: number; cor: string; tamanho?: number }) {
  return (
    <div style={{ width: tamanho }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 40, color: "#B9BDC4", marginBottom: 16 }}>
        <span>Meta do mês</span>
        <span style={{ color: cor, fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>{Math.round(pct)}%</span>
      </div>
      <div style={{ height: 34, borderRadius: 99, background: "rgba(255,255,255,0.08)", overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${pct}%`, borderRadius: 99, background: cor, boxShadow: cor === COR.lime ? `0 0 40px ${COR.lime}` : "none" }} />
      </div>
    </div>
  );
}

function CenaCalendario() {
  const frame = useCurrentFrame();
  // dias correndo de 1 até 28 no primeiro segundo
  const dia = Math.round(interpolate(frame, [0, s(0.85)], [1, 28], { extrapolateRight: "clamp", easing: Easing.out(Easing.quad) }));
  const meta = interpolate(frame, [s(T.meta), s(T.meta + 1.6)], [0, 30], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.out(Easing.cubic) });
  const tremor = frame > s(2.3) ? Math.sin(frame * 1.7) * 3 : 0;
  return (
    <AbsoluteFill style={{ alignItems: "center", paddingTop: 260 }}>
      <Icone3D arquivo="calendario" tamanho={380} style={{ left: 350, top: 330 }} />
      {/* número grande do dia sobreposto */}
      <div style={{ position: "absolute", top: 760, left: 0, right: 0, textAlign: "center", fontSize: 200, fontWeight: 600, letterSpacing: -6, fontVariantNumeric: "tabular-nums", color: dia === 28 ? "white" : "#6B7079" }}>
        Dia {dia}.
      </div>
      <div style={{ position: "absolute", top: 1180, transform: `translateX(${tremor}px)`, opacity: ent(frame, T.meta) }}>
        <BarraMeta pct={meta} cor="#7A808A" />
      </div>
      <div style={{ position: "absolute", top: 1420, left: 0, right: 0 }}>
        <Titulo atraso={T.meta + 0.7} tamanho={70} cor="#C9CDD3">E a meta… em 30%.</Titulo>
      </div>
    </AbsoluteFill>
  );
}

// ---------------------------------------------------------------------------
// Cena 2 — "Funil vazio. Ninguém pra ligar."

function CenaFunilVazio() {
  const frame = useCurrentFrame();
  const giro = Math.sin(frame / 10) * 6;
  return (
    <AbsoluteFill style={{ alignItems: "center" }}>
      <div style={{ position: "absolute", top: 300, left: 0, right: 0 }}>
        <Titulo tamanho={104}>Funil vazio.</Titulo>
      </div>
      <Icone3D arquivo="funil" tamanho={520} style={{ left: 280, top: 520, transform: `rotate(${giro}deg)`, opacity: 0.9 }} flutuar={false} />
      {/* celular sem notificação */}
      <div style={{
        position: "absolute", top: 1180, width: 520, borderRadius: 40, background: "rgba(255,255,255,0.05)", border: "2px solid rgba(255,255,255,0.08)",
        padding: "34px 40px", display: "flex", alignItems: "center", gap: 28, opacity: ent(frame, T.ninguem - T.funil - 0.3),
      }}>
        <span style={{ width: 72, height: 72, borderRadius: 36, background: "rgba(255,255,255,0.08)", display: "grid", placeItems: "center", fontSize: 38 }}>📵</span>
        <div>
          <div style={{ fontSize: 34, color: "#C9CDD3" }}>0 contatos hoje</div>
          <div style={{ fontSize: 26, color: "#6B7079" }}>nenhuma notificação</div>
        </div>
      </div>
      <div style={{ position: "absolute", top: 1480, left: 0, right: 0 }}>
        <Titulo atraso={T.ninguem - T.funil} tamanho={78} cor="#C9CDD3">Ninguém pra ligar.</Titulo>
      </div>
    </AbsoluteFill>
  );
}

// ---------------------------------------------------------------------------
// Cena 3 — a virada: lista pronta que enche o funil

const PERGUNTA = "padarias em Curitiba com WhatsApp";
const LEADS = [
  { nome: "Padaria Bom Grão", bairro: "Batel", cor: "#F6C9A8" },
  { nome: "Pão & Cia", bairro: "Água Verde", cor: "#BFD3F2" },
  { nome: "Confeitaria Aurora", bairro: "Centro", cor: "#D9C8F5" },
  { nome: "Padaria Estrela", bairro: "Portão", cor: COR.lime },
  { nome: "Delícias do Trigo", bairro: "Bigorrilho", cor: "#F3B6C2" },
];

function CenaLista() {
  const frame = useCurrentFrame();
  const f = (t: number) => s(t - T.radar + 0.15); // tempo da narração → frame da cena
  const flash = interpolate(frame, [0, 6, 18], [1, 0.5, 0], { extrapolateRight: "clamp" });
  const n = Math.min(PERGUNTA.length, Math.max(0, Math.floor((frame - f(T.radar + 0.3)) / 1.2)));
  const enchendo = interpolate(frame, [f(T.radar + 1.9), f(T.radar + 3.4)], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <AbsoluteFill>
      <AbsoluteFill style={{ background: COR.lime, opacity: flash * 0.25 }} />
      <Brilho x="50%" y="62%" tamanho={760} opacidade={0.12 + enchendo * 0.16} />
      <div style={{ position: "absolute", top: 190, left: 0, right: 0 }}>
        <Titulo tamanho={88}>Lista <span style={{ color: COR.lime }}>pronta</span> em segundos.</Titulo>
      </div>

      {/* chat */}
      <div style={{ position: "absolute", top: 420, left: 90, right: 90, display: "flex", justifyContent: "flex-end" }}>
        <div style={{ background: COR.gelo, color: COR.texto, fontSize: 42, padding: "24px 32px", borderRadius: "36px 36px 10px 36px", opacity: ent(frame, 0.2) }}>
          {PERGUNTA.slice(0, n)}{n < PERGUNTA.length && <span style={{ color: COR.steel }}>|</span>}
        </div>
      </div>

      {/* cartões caindo dentro do funil */}
      {LEADS.map((l, i) => {
        const inicio = f(T.radar + 1.9 + i * 0.28);
        const p = interpolate(frame, [inicio, inicio + 16], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.in(Easing.quad) });
        const fixo = frame > f(T.whats - 0.2); // depois do "com WhatsApp" os cartões se alinham em lista
        const y = fixo ? 640 + i * 118 : interpolate(p, [0, 1], [560 + i * 20, 1250]);
        const escala = fixo ? 1 : interpolate(p, [0, 0.8, 1], [1, 0.8, 0.2]);
        const opac = fixo ? ent(frame, T.whats - T.radar + 0.15 - 0.2 + i * 0.06) : frame < inicio ? 0 : 1 - Math.max(0, p - 0.85) * 6;
        return (
          <div key={l.nome} style={{
            position: "absolute", left: 140, right: 140, top: y, transform: `scale(${escala})`, opacity: opac,
            display: "flex", alignItems: "center", gap: 20, background: COR.carvao2, border: "2px solid rgba(255,255,255,0.08)", borderRadius: 28, padding: "18px 22px",
          }}>
            <span style={{ width: 58, height: 58, borderRadius: 29, background: l.cor, color: COR.texto, display: "grid", placeItems: "center", fontSize: 22, fontWeight: 600 }}>
              {l.nome.split(" ").slice(0, 2).map((p) => p[0]).join("")}
            </span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 32, fontWeight: 500 }}>{l.nome}</div>
              <div style={{ fontSize: 24, color: "#9EA3AB" }}>{l.bairro} · Curitiba · PR</div>
            </div>
            <LogoWhats tamanho={54} />
          </div>
        );
      })}

      {/* funil que enche (some quando os cartões viram lista) */}
      <div style={{ opacity: frame > f(T.whats - 0.2) ? 0 : 1 }}>
        <Icone3D arquivo="funil" tamanho={460} style={{ left: 310, top: 1180 }} flutuar={false} />
        <div style={{ position: "absolute", left: 360, width: 360, top: 1260, height: 140, borderRadius: "0 0 180px 180px", background: COR.lime,
          opacity: enchendo * 0.55, filter: "blur(18px)", transform: `scaleY(${enchendo})`, transformOrigin: "bottom" }} />
      </div>

      <div style={{ position: "absolute", bottom: 200, left: 0, right: 0, display: "flex", justifyContent: "center" }}>
        <span style={{ display: "flex", alignItems: "center", gap: 14, fontSize: 42, padding: "16px 34px", borderRadius: 99, background: "rgba(37,211,102,0.14)",
          border: "2px solid rgba(37,211,102,0.4)", opacity: ent(frame, T.whats - T.radar + 0.15) }}>
          <LogoWhats tamanho={52} /> Com WhatsApp
        </span>
      </div>
    </AbsoluteFill>
  );
}

// ---------------------------------------------------------------------------
// Cena 4 — "Chama em um clique e acompanha cada lead até a proposta"

function CenaKanban() {
  const frame = useCurrentFrame();
  const colunas = ["Novos", "Em contato", "Proposta"];
  const passo = (t: number) => interpolate(frame, [s(t), s(t + 0.5)], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.inOut(Easing.cubic) });
  const a = passo(0.5), b = passo(1.6);
  const reunioes = frame < s(1.0) ? 0 : frame < s(2.0) ? 1 : frame < s(2.7) ? 2 : 3;
  return (
    <AbsoluteFill>
      <Brilho x="50%" y="40%" opacidade={0.14} />
      <div style={{ position: "absolute", top: 200, left: 0, right: 0 }}>
        <Titulo tamanho={84}>Do contato <span style={{ color: COR.lime }}>à proposta.</span></Titulo>
      </div>
      <div style={{ position: "absolute", left: 60, right: 60, top: 520, display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 20 }}>
        {colunas.map((c, i) => (
          <div key={c} style={{ background: "rgba(255,255,255,0.05)", border: "2px solid rgba(255,255,255,0.08)", borderRadius: 34, padding: 20, minHeight: 760 }}>
            <div style={{ fontSize: 32, fontWeight: 500, color: i === 2 ? COR.lime : "#B9BDC4", marginBottom: 18 }}>{c}</div>
            {Array.from({ length: [3, 2, 1][i] }, (_, j) => (
              <div key={j} style={{ height: 120, borderRadius: 24, background: "rgba(255,255,255,0.08)", marginBottom: 14 }} />
            ))}
          </div>
        ))}
        {/* lead que anda: Novos → Em contato → Proposta */}
        <div style={{
          position: "absolute", top: 80, height: 120, width: "calc(33.33% - 54px)", left: `calc(${(a + b) * 33.33}% + 20px)`,
          borderRadius: 24, background: COR.lime, color: COR.carvao, display: "flex", alignItems: "center", gap: 14, padding: "0 18px",
          boxShadow: "0 24px 50px rgba(227,252,63,0.3)", transform: `rotate(${Math.sin((a + b) * Math.PI) * 5}deg)`,
        }}>
          <LogoWhats tamanho={50} />
          <div style={{ fontSize: 26, fontWeight: 600, lineHeight: 1.1 }}>Padaria<br />Bom Grão</div>
        </div>
      </div>
      <div style={{ position: "absolute", bottom: 220, left: 0, right: 0, textAlign: "center" }}>
        <div style={{ fontSize: 44, color: "#C9CDD3" }}>Reuniões marcadas</div>
        <div style={{ fontSize: 150, fontWeight: 600, color: COR.lime, lineHeight: 1, fontVariantNumeric: "tabular-nums",
          transform: `scale(${1 + (frame % s(1) < 6 && reunioes > 0 ? 0.08 : 0)})` }}>{reunioes}</div>
      </div>
    </AbsoluteFill>
  );
}

// ---------------------------------------------------------------------------
// Cena 5 — "E o fim do mês… fica diferente."

function CenaMeta() {
  const frame = useCurrentFrame();
  const pct = interpolate(frame, [s(0.3), s(1.3)], [30, 100], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.inOut(Easing.cubic) });
  const confete = frame > s(1.15);
  return (
    <AbsoluteFill style={{ alignItems: "center" }}>
      <Brilho x="50%" y="45%" tamanho={900} opacidade={interpolate(pct, [30, 100], [0.08, 0.3])} />
      <div style={{ position: "absolute", top: 230, left: 0, right: 0 }}>
        <Titulo tamanho={86}>E o fim do mês…</Titulo>
        <Titulo tamanho={86} atraso={1.1} cor={COR.lime}>fica diferente.</Titulo>
      </div>
      <Icone3D arquivo="trofeu" tamanho={420} atraso={1.1} style={{ left: 330, top: 640 }} />
      <Icone3D arquivo="alvo" tamanho={200} atraso={1.3} style={{ left: 120, top: 760 }} />
      <div style={{ position: "absolute", top: 1220 }}>
        <BarraMeta pct={pct} cor={pct >= 99 ? COR.lime : "#C9CDD3"} />
      </div>
      {confete && Array.from({ length: 26 }, (_, i) => {
        const t = frame - s(1.15);
        const x = 540 + Math.cos(i * 2.4) * (120 + t * (9 + (i % 5)));
        const y = 1240 - t * (14 - (i % 4)) + t * t * 0.35;
        return <div key={i} style={{ position: "absolute", left: x, top: y, width: 18, height: 30, borderRadius: 6,
          background: i % 3 === 0 ? "white" : COR.lime, transform: `rotate(${t * (8 + i)}deg)`, opacity: Math.max(0, 1 - t / 45) }} />;
      })}
    </AbsoluteFill>
  );
}
