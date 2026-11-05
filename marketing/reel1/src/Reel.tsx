import { loadFont } from "@remotion/google-fonts/Outfit";
import type { CSSProperties, ReactNode } from "react";
import {
  AbsoluteFill, Audio, Easing, Img, Sequence, interpolate, spring, staticFile, useCurrentFrame,
} from "remotion";
import { MapaRadar } from "./MapaRadar";

// Reel 1 — "O radar". Motion design com o design system do Radar B2B (carvão, lime, vidro, Outfit),
// ícones 3D e efeitos do Freepik, sincronizado com a narração (29,4 s, ElevenLabs v3).

export const FPS = 30;
export const DURACAO = 30 * FPS;
export const { fontFamily } = loadFont("normal", { weights: ["400", "500", "600"] });

export const COR = { carvao: "#141518", carvao2: "#1d1f24", lime: "#E3FC3F", gelo: "#EEF2F8", texto: "#2A2B2E", cinza: "#8A8F98", steel: "#3D4A5C" };
export const s = (seg: number) => Math.round(seg * FPS);

// Momentos da narração (segundos, medidos no áudio)
const T = {
  pergunta: 0, escuro: 1.85, prospecta: 3.3, ligaPra: 5.3, perde: 6.69, acende: 8.45, milhoes: 10.85, escreve: 15.05,
  cidade: 18.35, whats: 20.84, marca: 24.45, pare: 25.75, teste: 27.11,
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

export function Sfx({ em, arquivo, volume = 0.6 }: { em: number; arquivo: string; volume?: number }) {
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
      <Sfx em={T.acende + 3.8} arquivo="pop" volume={0.5} />
      <Sfx em={T.escreve + 0.2} arquivo="digitacao" volume={0.4} />
      <Sfx em={T.escreve + 2.45} arquivo="ding" volume={0.45} />
      {[0, 1, 2].map((i) => <Sfx key={`c${i}`} em={T.escreve + 2.85 + i * 0.25} arquivo="pop" volume={0.4} />)}
      {[0, 1, 2, 3].map((i) => <Sfx key={`e${i}`} em={T.cidade + 0.2 + i * 0.25} arquivo="pop" volume={0.35} />)}
      <Sfx em={T.whats + 0.9} arquivo="ding" volume={0.55} />
      <Sfx em={T.whats + 2.1} arquivo="swoosh" volume={0.55} />
      <Sfx em={T.marca} arquivo="logo" volume={0.6} />
    </>
  );
}

// ---------------------------------------------------------------------------
// Utilitários de animação

/** Entrada com mola (função pura: pode ser usada em listas e condições). */
export const ent = (frame: number, atraso = 0, config = { damping: 14, stiffness: 120 }) =>
  spring({ frame: frame - s(atraso), fps: FPS, config });

export function Titulo({ children, atraso = 0, tamanho = 92, cor = "white", style }: {
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

export function Icone3D({ arquivo, tamanho, atraso = 0, style, flutuar = true }: {
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

export function Brilho({ x, y, tamanho = 700, opacidade = 0.25 }: { x: string; y: string; tamanho?: number; opacidade?: number }) {
  return (
    <div style={{
      position: "absolute", left: x, top: y, width: tamanho, height: tamanho, borderRadius: "50%",
      background: COR.lime, opacity: opacidade, filter: "blur(160px)", transform: "translate(-50%,-50%)",
    }} />
  );
}

/** Logo do WhatsApp: símbolo oficial em branco sobre o círculo verde. */
const WHATS = "M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z";
export function LogoWhats({ tamanho, brilho = false }: { tamanho: number; brilho?: boolean }) {
  return (
    <div style={{
      width: tamanho, height: tamanho, borderRadius: "50%", background: "#25D366", display: "grid", placeItems: "center", flexShrink: 0,
      boxShadow: brilho ? "0 30px 80px rgba(37,211,102,0.45), inset 0 -10px 30px rgba(0,0,0,0.12)" : "none",
    }}>
      <svg viewBox="0 0 24 24" width={tamanho * 0.58} height={tamanho * 0.58}><path d={WHATS} fill="white" /></svg>
    </div>
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
    { t: T.prospecta - T.escuro, texto: "Prospecta no escuro." },
    { t: T.ligaPra - T.escuro, texto: "Liga pra quem não compra." },
    { t: T.perde - T.escuro, texto: "E perde o dia inteiro." },
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
                  <LogoWhats tamanho={60} />
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
          <LogoWhats tamanho={280} brilho />
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

export function CenaMarca({ pare = T.pare - T.marca, teste = T.teste - T.marca, frase }: { pare?: number; teste?: number; frase?: ReactNode } = {}) {
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
      <Titulo atraso={pare} tamanho={74} style={{ marginTop: 60 }}>{frase ?? <>Pare de vender <span style={{ color: COR.lime }}>no escuro.</span></>}</Titulo>
      <div style={{
        marginTop: 70, background: COR.lime, color: COR.carvao, borderRadius: 99, padding: "30px 56px", fontSize: 50, fontWeight: 600,
        opacity: ent(frame, teste), transform: `scale(${0.8 + ent(frame, teste, { damping: 9, stiffness: 160 }) * 0.2})`,
      }}>
        Teste grátis →
      </div>
      <div style={{ marginTop: 34, fontSize: 44, color: "#C9CDD3", opacity: ent(frame, teste + 0.3) }}>b2bradar.pro</div>
    </AbsoluteFill>
  );
}
