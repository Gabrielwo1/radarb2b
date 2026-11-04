import { loadFont } from "@remotion/google-fonts/Outfit";
import type { CSSProperties, ReactNode } from "react";
import {
  AbsoluteFill, Audio, Easing, Img, Sequence, interpolate, spring, staticFile, useCurrentFrame,
} from "remotion";
import { MapaRadar } from "./MapaRadar";

// Reel 1 — "O radar". Motion design com o design system do Radar B2B (carvão, lime, vidro, Outfit),
// ícones 3D e efeitos do Freepik, sincronizado com a narração (27,5 s).

export const FPS = 30;
export const DURACAO = 29 * FPS;
const { fontFamily } = loadFont("normal", { weights: ["400", "500", "600"] });

export const COR = { carvao: "#141518", carvao2: "#1d1f24", lime: "#E3FC3F", gelo: "#EEF2F8", texto: "#2A2B2E", cinza: "#8A8F98", steel: "#3D4A5C" };
const s = (seg: number) => Math.round(seg * FPS);

// Momentos da narração (segundos, medidos no áudio)
const T = {
  pergunta: 0, escuro: 1.4, ligaPra: 3.82, acende: 6.38, milhoes: 8.1, escreve: 12.65, cidade: 17.1,
  whats: 19.3, marca: 22.94, pare: 24.34, teste: 25.89,
};

export const Reel = () => (
  <AbsoluteFill style={{ background: COR.carvao, fontFamily, color: "white" }}>
    <Audio src={staticFile("audio/narracao.mp3")} />
    <Efeitos />

    <Sequence from={0} durationInFrames={s(T.escuro)}><CenaPergunta /></Sequence>
    <Sequence from={s(T.escuro)} durationInFrames={s(T.acende - T.escuro)}><CenaEscuro /></Sequence>
    <Sequence from={s(T.acende)} durationInFrames={s(T.escreve - T.acende)}><CenaRadar /></Sequence>
    <Sequence from={s(T.escreve)} durationInFrames={s(T.whats - T.escreve)}><CenaChat /></Sequence>
    <Sequence from={s(T.whats)} durationInFrames={s(T.marca - T.whats)}><CenaWhats /></Sequence>
    <Sequence from={s(T.marca)}><CenaMarca /></Sequence>
  </AbsoluteFill>
);

// ---------------------------------------------------------------------------
// Efeitos sonoros (sem música: só narração + SFX)

function Sfx({ em, arquivo, volume = 0.6 }: { em: number; arquivo: string; volume?: number }) {
  return <Sequence from={s(em)}><Audio src={staticFile(`audio/${arquivo}.mp3`)} volume={volume} /></Sequence>;
}
function Efeitos() {
  return (
    <>
      <Sfx em={0.05} arquivo="digitacao" volume={0.45} />
      <Sfx em={T.escuro} arquivo="boom" volume={0.7} />
      <Sfx em={T.ligaPra} arquivo="glitch" volume={0.35} />
      <Sfx em={T.acende - 0.05} arquivo="ping" volume={0.7} />
      <Sfx em={T.acende + 0.5} arquivo="varredura" volume={0.45} />
      <Sfx em={10.2} arquivo="pop" volume={0.5} />
      <Sfx em={T.escreve + 0.2} arquivo="digitacao" volume={0.4} />
      <Sfx em={15.1} arquivo="ding" volume={0.45} />
      {[15.5, 15.75, 16.0].map((t) => <Sfx key={t} em={t} arquivo="pop" volume={0.4} />)}
      {[17.3, 17.55, 17.8, 18.05].map((t) => <Sfx key={t} em={t} arquivo="pop" volume={0.35} />)}
      <Sfx em={T.whats + 0.9} arquivo="ding" volume={0.55} />
      <Sfx em={T.whats + 2.1} arquivo="swoosh" volume={0.55} />
      <Sfx em={T.marca} arquivo="logo" volume={0.6} />
    </>
  );
}

// ---------------------------------------------------------------------------
// Utilitários de animação

/** Entrada com mola (função pura: pode ser usada em listas e condições). */
const ent = (frame: number, atraso = 0, config = { damping: 14, stiffness: 120 }) =>
  spring({ frame: frame - s(atraso), fps: FPS, config });

function Titulo({ children, atraso = 0, tamanho = 92, cor = "white", style }: {
  children: ReactNode; atraso?: number; tamanho?: number; cor?: string; style?: CSSProperties;
}) {
  const frame = useCurrentFrame();
  const p = ent(frame, atraso);
  return (
    <div style={{
      fontSize: tamanho, fontWeight: 500, letterSpacing: -2, lineHeight: 1.05, color: cor, textAlign: "center",
      opacity: p, transform: `translateY(${(1 - p) * 40}px) scale(${0.96 + p * 0.04})`, ...style,
    }}>{children}</div>
  );
}

function Icone3D({ arquivo, tamanho, atraso = 0, style, flutuar = true }: {
  arquivo: string; tamanho: number; atraso?: number; style?: CSSProperties; flutuar?: boolean;
}) {
  const frame = useCurrentFrame();
  const p = ent(frame, atraso, { damping: 10, stiffness: 140 });
  const y = flutuar ? Math.sin(frame / 14) * 10 : 0;
  return (
    <Img src={staticFile(`icones/${arquivo}.png`)} style={{
      position: "absolute", width: tamanho, height: tamanho, objectFit: "contain",
      transform: `translateY(${y}px) scale(${p}) rotate(${(1 - p) * -18}deg)`,
      filter: "drop-shadow(0 30px 40px rgba(0,0,0,0.45))", ...style,
    }} />
  );
}

function Brilho({ x, y, tamanho = 700, opacidade = 0.25 }: { x: string; y: string; tamanho?: number; opacidade?: number }) {
  return (
    <div style={{
      position: "absolute", left: x, top: y, width: tamanho, height: tamanho, borderRadius: "50%",
      background: COR.lime, opacity: opacidade, filter: "blur(160px)", transform: "translate(-50%,-50%)",
    }} />
  );
}

// ---------------------------------------------------------------------------
// Cena 1 — "Quem compra de você?" (digitado)

function CenaPergunta() {
  const frame = useCurrentFrame();
  const texto = "Quem compra de você?";
  const n = Math.min(texto.length, Math.floor(frame / 1.6));
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", padding: 80 }}>
      <div style={{ fontSize: 112, fontWeight: 500, letterSpacing: -3, textAlign: "center", lineHeight: 1.05 }}>
        {texto.slice(0, n)}
        <span style={{ color: COR.lime, opacity: Math.floor(frame / 8) % 2 ? 1 : 0.15 }}>|</span>
      </div>
    </AbsoluteFill>
  );
}

// ---------------------------------------------------------------------------
// Cena 2 — o problema: prospectar no escuro

function CenaEscuro() {
  const frame = useCurrentFrame();
  const tremor = frame > s(T.ligaPra - T.escuro) ? Math.sin(frame * 2.3) * 4 : 0;
  const interrogacoes = [
    { x: 120, y: 420, t: 0.1, z: 190 }, { x: 760, y: 360, t: 0.4, z: 150 }, { x: 560, y: 1180, t: 0.8, z: 210 },
    { x: 90, y: 1250, t: 1.3, z: 140 }, { x: 830, y: 1020, t: 1.7, z: 170 }, { x: 380, y: 640, t: 2.3, z: 120 },
    { x: 700, y: 1500, t: 2.6, z: 150 }, { x: 200, y: 1560, t: 3.0, z: 130 },
  ];
  const frases = [
    { t: 0, texto: "Você não sabe." },
    { t: 0.9, texto: "Prospecta no escuro." },
    { t: T.ligaPra - T.escuro, texto: "Liga pra quem não compra." },
    { t: 3.6, texto: "E perde o dia inteiro." },
  ];
  const atual = [...frases].reverse().find((f) => frame >= s(f.t))!;
  return (
    <AbsoluteFill style={{ transform: `translateX(${tremor}px)` }}>
      <MapaRadar modo="apagado" />
      {interrogacoes.map((q, i) => (
        <Icone3D key={i} arquivo="interrogacao" tamanho={q.z} atraso={q.t} style={{ left: q.x, top: q.y, opacity: 0.85 }} />
      ))}
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", padding: 70 }}>
        <div key={atual.texto} style={{ background: "rgba(20,21,24,0.82)", borderRadius: 40, padding: "28px 44px" }}>
          <Titulo atraso={atual.t} tamanho={86} cor="#C9CDD3">{atual.texto}</Titulo>
        </div>
      </AbsoluteFill>
      {/* relógio do dia correndo no rodapé */}
      <div style={{ position: "absolute", bottom: 150, left: 0, right: 0, textAlign: "center", fontSize: 40, color: COR.cinza, letterSpacing: 2 }}>
        {(() => {
          const minutos = Math.round(interpolate(frame, [0, s(T.acende - T.escuro)], [8 * 60, 18 * 60 + 30]));
          return `${String(Math.floor(minutos / 60)).padStart(2, "0")}:${String(minutos % 60).padStart(2, "0")}`;
        })()}
      </div>
    </AbsoluteFill>
  );
}

// ---------------------------------------------------------------------------
// Cena 3 — a virada: acende o radar, 28 milhões de empresas

function CenaRadar() {
  const frame = useCurrentFrame();
  const contador = interpolate(frame, [s(T.milhoes - T.acende), s(T.milhoes - T.acende + 2.4)], [0, 28263114], {
    extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.out(Easing.cubic),
  });
  const zoom = interpolate(frame, [0, s(T.escreve - T.acende)], [1.08, 1], { extrapolateRight: "clamp" });
  return (
    <AbsoluteFill>
      <Brilho x="50%" y="45%" opacidade={interpolate(frame, [0, 30], [0, 0.18], { extrapolateRight: "clamp" })} />
      <AbsoluteFill style={{ transform: `scale(${zoom})` }}><MapaRadar modo="varredura" /></AbsoluteFill>
      <Icone3D arquivo="pin" tamanho={210} atraso={3.8} style={{ left: 640, top: 1000 }} />
      <AbsoluteFill style={{ alignItems: "center", paddingTop: 210 }}>
        <Titulo atraso={0.1} tamanho={96}>Acende o <span style={{ color: COR.lime }}>radar.</span></Titulo>
      </AbsoluteFill>
      <AbsoluteFill style={{ justifyContent: "flex-end", alignItems: "center", paddingBottom: 230 }}>
        <div style={{ opacity: interpolate(frame, [s(T.milhoes - T.acende), s(T.milhoes - T.acende) + 10], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }), textAlign: "center" }}>
          <div style={{ fontSize: 150, fontWeight: 600, letterSpacing: -5, color: COR.lime, fontVariantNumeric: "tabular-nums", lineHeight: 1 }}>
            {Math.round(contador).toLocaleString("pt-BR")}
          </div>
          <div style={{ fontSize: 50, marginTop: 18, color: "#D6D9DE" }}>empresas ativas da Receita Federal</div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
}

// ---------------------------------------------------------------------------
// Cena 4 — "Escreve o que você vende": chat com IA + resultados

const PERGUNTA = "quem compra embalagens no PR?";
const SEGMENTOS = ["Frigoríficos", "Laticínios", "Cosméticos"];
const EMPRESAS = [
  { nome: "Laticínios Serra Azul", seg: "Preparação do leite", cidade: "Toledo · PR", cor: "#F6C9A8" },
  { nome: "Frigorífico Vale Verde", seg: "Abate de aves", cidade: "Cascavel · PR", cor: "#BFD3F2" },
  { nome: "Bella Cosméticos", seg: "Fabricação de cosméticos", cidade: "Curitiba · PR", cor: "#D9C8F5" },
  { nome: "Pão Dourado Indústria", seg: "Produtos de padaria", cidade: "Londrina · PR", cor: "#E3FC3F" },
];

function CenaChat() {
  const frame = useCurrentFrame();
  const n = Math.min(PERGUNTA.length, Math.max(0, Math.floor((frame - 6) / 1.4)));
  const resposta = ent(frame, 2.4);
  const fase2 = frame >= s(T.cidade - T.escreve);
  return (
    <AbsoluteFill style={{ background: `linear-gradient(180deg, ${COR.carvao} 0%, #1a1c20 100%)` }}>
      <Brilho x="85%" y="12%" tamanho={600} opacidade={0.16} />
      <AbsoluteFill style={{ alignItems: "center", paddingTop: 170 }}>
        <Titulo tamanho={84}>Você <span style={{ color: COR.lime }}>pergunta.</span></Titulo>
        <Titulo tamanho={84} atraso={2.4}>A IA acha.</Titulo>
      </AbsoluteFill>
      <Icone3D arquivo="chat-ia" tamanho={170} atraso={0.2} style={{ left: 835, top: 400, zIndex: 2 }} />

      {/* painel do app (vidro claro) */}
      <div style={{
        position: "absolute", left: 70, right: 70, top: 600, borderRadius: 56, background: COR.gelo,
        color: COR.texto, padding: 46, display: "flex", flexDirection: "column", gap: 26, overflow: "hidden",
        boxShadow: "0 40px 120px rgba(0,0,0,0.5)",
        transform: `translateY(${(1 - ent(frame, 0.1)) * 200}px)`,
      }}>
        <div style={{ alignSelf: "flex-end", background: COR.carvao, color: "white", fontSize: 40, padding: "22px 30px", borderRadius: "34px 34px 10px 34px", minHeight: 50 }}>
          {PERGUNTA.slice(0, n)}{n < PERGUNTA.length && <span style={{ color: COR.lime }}>|</span>}
        </div>

        <div style={{ opacity: resposta, transform: `translateY(${(1 - resposta) * 30}px)`, background: "white", borderRadius: "34px 34px 34px 10px", padding: "26px 30px", fontSize: 36, lineHeight: 1.35 }}>
          Quem compra embalagens no Paraná:
          <div style={{ display: "flex", flexWrap: "wrap", gap: 14, marginTop: 18 }}>
            {SEGMENTOS.map((g, i) => {
              const p = ent(frame, 2.85 + i * 0.25, { damping: 9, stiffness: 180 });
              return (
                <span key={g} style={{ background: COR.lime, borderRadius: 99, padding: "10px 22px", fontSize: 32, fontWeight: 500, transform: `scale(${p})` }}>{g}</span>
              );
            })}
          </div>
        </div>

        {fase2 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {EMPRESAS.map((e, i) => {
              const p = ent(frame, T.cidade - T.escreve + 0.2 + i * 0.25, { damping: 13, stiffness: 150 });
              return (
                <div key={e.nome} style={{
                  display: "flex", alignItems: "center", gap: 22, background: COR.carvao, color: "white", borderRadius: 30, padding: "20px 24px",
                  opacity: p, transform: `translateX(${(1 - p) * 120}px)`,
                }}>
                  <span style={{ width: 66, height: 66, borderRadius: 33, background: e.cor, color: COR.texto, display: "grid", placeItems: "center", fontSize: 26, fontWeight: 600 }}>
                    {e.nome.split(" ").slice(0, 2).map((p) => p[0]).join("")}
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 32, fontWeight: 500 }}>{e.nome}</div>
                    <div style={{ fontSize: 24, color: "#9EA3AB" }}>{e.seg} · {e.cidade}</div>
                  </div>
                  <Img src={staticFile("icones/whatsapp.png")} style={{ width: 62, height: 62 }} />
                </div>
              );
            })}
          </div>
        )}
      </div>

      {fase2 && (
        <div style={{ position: "absolute", bottom: 150, left: 0, right: 0, display: "flex", justifyContent: "center", gap: 16 }}>
          {["📍 Por cidade", "🏷️ Por segmento"].map((t, i) => {
            const p = ent(frame, T.cidade - T.escreve + i * 0.3);
            return <span key={t} style={{ fontSize: 38, padding: "14px 30px", borderRadius: 99, border: "2px solid rgba(255,255,255,0.18)", opacity: p }}>{t}</span>;
          })}
        </div>
      )}
    </AbsoluteFill>
  );
}

// ---------------------------------------------------------------------------
// Cena 5 — WhatsApp em 1 clique + lead entra no funil

function CenaWhats() {
  const frame = useCurrentFrame();
  const toque = interpolate(frame, [s(0.7), s(0.9), s(1.1)], [1, 0.9, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const pulso = frame > s(0.9) ? (frame - s(0.9)) % 30 : 99;
  const mover = interpolate(frame, [s(2.0), s(2.6)], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.inOut(Easing.cubic) });
  const colunas = ["Novos", "Em contato", "Proposta", "Ganhos"];
  return (
    <AbsoluteFill>
      <Brilho x="50%" y="40%" opacidade={0.14} />
      <AbsoluteFill style={{ alignItems: "center", paddingTop: 170 }}>
        <Titulo tamanho={92}><span style={{ color: COR.lime }}>WhatsApp</span> em 1 clique.</Titulo>
        <Titulo tamanho={56} atraso={1.9} cor="#C9CDD3" style={{ marginTop: 18 }}>e o lead já entra no seu funil</Titulo>
      </AbsoluteFill>

      {/* ícone 3D com ondas de toque */}
      <div style={{ position: "absolute", left: 540, top: 720, transform: "translate(-50%,-50%)" }}>
        {pulso < 30 && (
          <div style={{ position: "absolute", left: "50%", top: "50%", width: 260 + pulso * 10, height: 260 + pulso * 10, borderRadius: "50%",
            border: `4px solid ${COR.lime}`, opacity: 1 - pulso / 30, transform: "translate(-50%,-50%)" }} />
        )}
        <div style={{ transform: `scale(${toque * interpolate(frame, [s(2.0), s(2.4)], [1, 0.55], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })})` }}>
          <Img src={staticFile("icones/whatsapp.png")} style={{ width: 300, height: 300, filter: "drop-shadow(0 30px 50px rgba(37,211,102,0.35))" }} />
        </div>
      </div>

      {/* kanban do CRM */}
      <div style={{ position: "absolute", left: 50, right: 50, top: 1000, display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16,
        opacity: ent(frame, 1.6), transform: `translateY(${(1 - ent(frame, 1.6)) * 80}px)` }}>
        {colunas.map((c, i) => (
          <div key={c} style={{ background: "rgba(255,255,255,0.06)", border: "2px solid rgba(255,255,255,0.08)", borderRadius: 30, padding: 16, minHeight: 520 }}>
            <div style={{ fontSize: 26, color: i === 1 ? COR.lime : "#B9BDC4", marginBottom: 14, fontWeight: 500 }}>{c}</div>
            {Array.from({ length: [3, 1, 2, 1][i] }, (_, j) => (
              <div key={j} style={{ height: 96, borderRadius: 20, background: "rgba(255,255,255,0.09)", marginBottom: 12 }} />
            ))}
          </div>
        ))}
        {/* o lead viaja de "Novos" para "Em contato" */}
        <div style={{
          position: "absolute", top: 60 + mover * 108, left: `calc(${mover * 25}% + ${16 - mover * 4}px)`, width: "calc(25% - 44px)",
          height: 96, borderRadius: 20, background: COR.lime, color: COR.carvao, fontSize: 22, fontWeight: 600,
          display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 20px 40px rgba(227,252,63,0.3)",
          transform: `rotate(${Math.sin(mover * Math.PI) * 6}deg) scale(${1 + Math.sin(mover * Math.PI) * 0.08})`,
        }}>Laticínios</div>
      </div>
    </AbsoluteFill>
  );
}

// ---------------------------------------------------------------------------
// Cena 6 — marca + chamada

function CenaMarca() {
  const frame = useCurrentFrame();
  const anel = ent(frame, 0, { damping: 12, stiffness: 90 });
  const giro = frame * 4;
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
      <Brilho x="50%" y="38%" tamanho={800} opacidade={0.22} />
      <div style={{ position: "relative", width: 300, height: 300, transform: `scale(${anel})`, marginTop: -260 }}>
        <div style={{ position: "absolute", inset: 0, borderRadius: "50%", background: COR.carvao2, boxShadow: "0 0 0 2px rgba(255,255,255,0.08)" }} />
        {[1, 0.66, 0.33].map((r) => (
          <div key={r} style={{ position: "absolute", left: "50%", top: "50%", width: 260 * r, height: 260 * r, borderRadius: "50%",
            border: `6px solid ${COR.lime}`, opacity: 0.35 + r * 0.4, transform: "translate(-50%,-50%)" }} />
        ))}
        <div style={{ position: "absolute", left: "50%", top: "50%", width: 130, height: 6, background: COR.lime, transformOrigin: "0 50%",
          transform: `rotate(${giro}deg)`, borderRadius: 3, boxShadow: `0 0 30px ${COR.lime}` }} />
        <div style={{ position: "absolute", left: "50%", top: "50%", width: 26, height: 26, borderRadius: 13, background: COR.lime, transform: "translate(-50%,-50%)" }} />
      </div>
      <Titulo atraso={0.2} tamanho={110} style={{ marginTop: 50, fontWeight: 600 }}>radar<span style={{ color: COR.cinza }}>b2b</span></Titulo>
      <Titulo atraso={T.pare - T.marca} tamanho={74} style={{ marginTop: 60 }}>Pare de vender <span style={{ color: COR.lime }}>no escuro.</span></Titulo>
      <div style={{
        marginTop: 70, background: COR.lime, color: COR.carvao, borderRadius: 99, padding: "30px 56px", fontSize: 50, fontWeight: 600,
        opacity: ent(frame, T.teste - T.marca), transform: `scale(${0.8 + ent(frame, T.teste - T.marca, { damping: 9, stiffness: 160 }) * 0.2})`,
      }}>
        Teste grátis →
      </div>
      <div style={{ marginTop: 34, fontSize: 44, color: "#C9CDD3", opacity: ent(frame, T.teste - T.marca + 0.3) }}>b2bradar.pro</div>
    </AbsoluteFill>
  );
}
