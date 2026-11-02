// Gera os dados fixos da landing (src/lib/retrato-landing.json e public/dados/mapa-br.json).
// A landing não consulta a API ao abrir: usa este retrato da base, atualizado a cada carga mensal.
// Uso: API_URL=https://... API_KEY=... node scripts/snapshot-landing.mjs
import { mkdir, writeFile } from "node:fs/promises";

const { API_URL, API_KEY } = process.env;
if (!API_URL || !API_KEY) throw new Error("Defina API_URL e API_KEY");

const get = async (rota) => {
  const r = await fetch(`${API_URL}${rota}`, { headers: { "x-api-key": API_KEY } });
  if (!r.ok) throw new Error(`${rota}: HTTP ${r.status}`);
  return r.json();
};

const UFS = "AC AL AM AP BA CE DF ES GO MA MG MS MT PA PB PE PI PR RJ RN RO RR RS SC SE SP TO".split(" ");
// Só o que a landing mostra
const enxugar = (r) => ({
  total: r.total, com_telefone: r.com_telefone, novas_12m: r.novas_12m, mei: r.mei,
  top_municipios: r.top_municipios.slice(0, 5).map(({ codigo, nome, total }) => ({ codigo, nome, total })),
  top_cnaes: r.top_cnaes.slice(0, 5).map(({ codigo, descricao, total }) => ({ codigo, descricao, total })),
});

const resumos = { BR: enxugar(await get("/resumo")) };
for (const uf of UFS) resumos[uf] = enxugar(await get(`/resumo?uf=${uf}`));
const stats = await get("/stats");
// Mapa compacto em linhas [codigo, lat, lng, total, nome] (servido estático pela CDN, carregado com o mapa)
const mapa = (await get("/mapa")).map((p) => [p.codigo, +p.lat.toFixed(2), +p.lng.toFixed(2), p.total, p.nome]);

const dir = new URL("..", import.meta.url);
await mkdir(new URL("src/lib/", dir), { recursive: true });
await mkdir(new URL("public/dados/", dir), { recursive: true });
await writeFile(
  new URL("src/lib/retrato-landing.json", dir),
  JSON.stringify({ mes: stats.ultima_carga?.mes_referencia ?? null, municipios: mapa.length, resumos }, null, 1) + "\n",
);
await writeFile(new URL("public/dados/mapa-br.json", dir), JSON.stringify(mapa));
console.log(`ok: ${Object.keys(resumos).length} resumos, ${mapa.length} pontos, base ${stats.ultima_carga?.mes_referencia}`);
