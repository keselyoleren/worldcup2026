import { Highlight, Match, Team } from "./types";

// ---------------------------------------------------------------------------
// Video highlight — tiga sumber, dicoba berurutan:
// 1. Highlightly API via RapidAPI (butuh HIGHLIGHTLY_API_KEY; free tier 100
//    req/hari TAPI coverage World Cup disembunyikan — baru terisi kalau upgrade)
// 2. YouTube Data API v3 (butuh YOUTUBE_API_KEY; pencarian dibatasi ke channel
//    resmi FIFA, kuota gratis ±100 pencarian/hari — aman berkat cache 30 menit)
// 3. RSS resmi channel YouTube FIFA (tanpa key; hanya memuat ±15 video terbaru)
// Scorebat sengaja tidak dipakai: domainnya diblokir Internet Positif sehingga
// player embed-nya tidak bisa diputar dari jaringan Indonesia.
// ---------------------------------------------------------------------------
const HL_BASE = "https://football-highlights-api.p.rapidapi.com";
const HL_HOST = "football-highlights-api.p.rapidapi.com";
const WC_LEAGUE_ID = 1635; // id liga World Cup 2026 di Highlightly
const FIFA_CHANNEL_ID = "UCpcTrCXblq78GZrTUTLWeBw"; // channel YouTube resmi FIFA
const FIFA_RSS = `https://www.youtube.com/feeds/videos.xml?channel_id=${FIFA_CHANNEL_ID}`;
const YT_SEARCH = "https://www.googleapis.com/youtube/v3/search";
const REVALIDATE_SECONDS = 1800; // hemat kuota free tier

// ---------------------------------------------------------------------------
// Sumber 1: Highlightly
// ---------------------------------------------------------------------------
function normalizeHighlightly(x: any): Highlight {
  const m = x?.match ?? {};
  const homeName = m.homeTeam?.name ?? null;
  const awayName = m.awayTeam?.name ?? null;
  return {
    id: String(x?.id ?? x?.url),
    title: x?.title ?? "Highlight",
    embedUrl: x?.embedUrl ?? null,
    url: x?.url ?? x?.embedUrl ?? "#",
    imgUrl: x?.imgUrl ?? undefined,
    source: (x?.source ?? "video").toLowerCase(),
    channel: x?.channel ?? undefined,
    verified: x?.type === "VERIFIED",
    matchTitle: homeName && awayName ? `${homeName} vs ${awayName}` : undefined,
    date: m.date ?? undefined,
  };
}

async function fetchHighlightly(query: string): Promise<Highlight[]> {
  const key = process.env.HIGHLIGHTLY_API_KEY;
  if (!key) return [];
  try {
    const res = await fetch(`${HL_BASE}/highlights?${query}`, {
      headers: { "x-rapidapi-key": key, "x-rapidapi-host": HL_HOST },
      next: { revalidate: REVALIDATE_SECONDS },
    });
    if (!res.ok) return [];
    const raw = await res.json();
    const rows: any[] = Array.isArray(raw) ? raw : raw?.data ?? [];
    return rows
      .map(normalizeHighlightly)
      .sort(
        (a, b) =>
          Number(b.verified) - Number(a.verified) ||
          Number(!!b.embedUrl) - Number(!!a.embedUrl)
      );
  } catch {
    return []; // highlight bersifat opsional — jangan mematahkan halaman
  }
}

// ---------------------------------------------------------------------------
// Sumber 2: YouTube Data API v3 — pencarian di channel resmi FIFA.
// Satu pencarian = 100 unit kuota (jatah gratis 10.000/hari); dengan cache 30
// menit per query, pemakaian normal jauh di bawah batas.
// ---------------------------------------------------------------------------
async function fetchYouTube(query: string, maxResults: number): Promise<Highlight[]> {
  const key = process.env.YOUTUBE_API_KEY;
  if (!key) return [];
  try {
    const params = new URLSearchParams({
      part: "snippet",
      type: "video",
      channelId: FIFA_CHANNEL_ID,
      order: "date",
      q: query,
      maxResults: String(maxResults),
      key,
    });
    const res = await fetch(`${YT_SEARCH}?${params}`, {
      next: { revalidate: REVALIDATE_SECONDS },
    });
    if (!res.ok) return [];
    const raw = await res.json();
    return ((raw.items ?? []) as any[])
      .map((x): Highlight | null => {
        const videoId = x?.id?.videoId;
        if (!videoId) return null;
        const sn = x?.snippet ?? {};
        return {
          id: `yt-${videoId}`,
          title: decodeXml(sn.title ?? "Highlight"), // judul dari API ter-escape HTML
          embedUrl: `https://www.youtube.com/embed/${videoId}`,
          url: `https://www.youtube.com/watch?v=${videoId}`,
          imgUrl: sn.thumbnails?.high?.url ?? sn.thumbnails?.default?.url,
          source: "youtube",
          channel: sn.channelTitle ?? "FIFA",
          verified: true,
          date: sn.publishedAt ?? undefined,
        };
      })
      .filter((h): h is Highlight => !!h && /highlight|goal/i.test(h.title));
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// Sumber 3 (fallback tanpa key): RSS channel YouTube FIFA
// ---------------------------------------------------------------------------
function decodeXml(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'");
}

async function fetchFifaRss(): Promise<Highlight[]> {
  try {
    const res = await fetch(FIFA_RSS, { next: { revalidate: REVALIDATE_SECONDS } });
    if (!res.ok) return [];
    const xml = await res.text();
    return xml
      .split("<entry>")
      .slice(1)
      .map((e): Highlight | null => {
        const pick = (re: RegExp) => e.match(re)?.[1];
        const videoId = pick(/<yt:videoId>([^<]+)<\/yt:videoId>/);
        if (!videoId) return null;
        const title = decodeXml(pick(/<title>([^<]*)<\/title>/) ?? "");
        return {
          id: `yt-${videoId}`,
          title,
          embedUrl: `https://www.youtube.com/embed/${videoId}`,
          url: `https://www.youtube.com/watch?v=${videoId}`,
          imgUrl: pick(/<media:thumbnail url="([^"]+)"/),
          source: "youtube",
          channel: "FIFA",
          verified: true,
          date: pick(/<published>([^<]+)<\/published>/),
        };
      })
      // channel FIFA juga berisi konferensi pers/wawancara — ambil cuplikan saja
      .filter((h): h is Highlight => !!h && /highlight|goal/i.test(h.title))
      // video "Highlights | ..." (rangkuman penuh) di atas klip gol satuan
      .sort((a, b) => Number(/^highlights/i.test(b.title)) - Number(/^highlights/i.test(a.title)));
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// Pencocokan tim — penamaan antar sumber bisa beda ("South Korea" vs "Korea
// Republic", judul FIFA memakai "USA" bukan "United States"), jadi longgar:
// substring dua arah, berbagi kata bermakna (≥ 4 huruf), atau kode 3 huruf tim.
// ---------------------------------------------------------------------------
function norm(s: string): string {
  // buang diakritik (é -> e) supaya "Côte d'Ivoire" vs "Cote d'Ivoire" tetap cocok
  return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

function matchesTeam(text: string, team: Team): boolean {
  const t = norm(text);
  const name = norm(team.name);
  if (t.includes(name) || name.includes(t)) return true;
  const words = t.split(/[^a-z]+/);
  if (team.code && words.includes(team.code.toLowerCase())) return true;
  const significant = name.split(/[^a-z]+/).filter((w) => w.length >= 4);
  return significant.some((w) => words.includes(w));
}

function isForMatch(h: Highlight, match: Match): boolean {
  // cocokkan lewat metadata match kalau ada; kalau tidak, lewat judul video
  const target = h.matchTitle ?? h.title;
  return matchesTeam(target, match.home) && matchesTeam(target, match.away);
}

// ---------------------------------------------------------------------------
// Public: getTournamentHighlights() — video terbaru seluruh turnamen
// ---------------------------------------------------------------------------
export async function getTournamentHighlights(limit = 40): Promise<Highlight[]> {
  const hl = await fetchHighlightly(`leagueId=${WC_LEAGUE_ID}&limit=${limit}`);
  if (hl.length > 0) return hl;
  const yt = await fetchYouTube("World Cup 2026 highlights", Math.min(limit, 50));
  if (yt.length > 0) return yt;
  return fetchFifaRss();
}

// ---------------------------------------------------------------------------
// Public: getMatchHighlights() — video satu laga
// ---------------------------------------------------------------------------
export async function getMatchHighlights(match: Match): Promise<Highlight[]> {
  const date = match.utcDate.slice(0, 10); // YYYY-MM-DD (UTC)
  const hl = await fetchHighlightly(`leagueId=${WC_LEAGUE_ID}&date=${date}&limit=40`);
  if (hl.length > 0) return hl.filter((h) => isForMatch(h, match));

  // pencarian YouTube tetap disaring isForMatch — hasil search bisa meleset
  const yt = await fetchYouTube(`${match.home.name} vs ${match.away.name} highlights`, 10);
  const found = yt.filter((h) => isForMatch(h, match));
  if (found.length > 0) return found;

  const rss = await fetchFifaRss();
  return rss.filter((h) => isForMatch(h, match));
}
