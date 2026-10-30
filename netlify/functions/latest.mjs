// Returns the latest J2 stats and the latest note / radio posts as JSON.
// The homepage calls /api/latest on load and swaps in these values,
// so the site stays current without anyone editing the HTML.
// Results are cached on Netlify's CDN for 30 minutes.

const NOTE_USER = "ken_tshizanga";
const JLEAGUE_PLAYER_URL = "https://www.jleague.jp/player/1633289/";
const UA = "Mozilla/5.0 (compatible; kentshizanga-homepage/1.0)";

// Radio = title starts with "42Radio" or contains "ラジオ".
// Titles containing "Podcast" also count as radio, for posts published from 2026-10-30 16:45 JST on
// (older Podcast-titled posts stay in the note list, as the owner asked).
const PODCAST_AS_RADIO_FROM = Date.parse("2026-10-30T16:45:00+09:00");
const isRadio = (p) =>
  /^42Radio|ラジオ/.test(p.title) ||
  (/podcast/i.test(p.title) && Date.parse(p.publishAt || 0) >= PODCAST_AS_RADIO_FROM);
const cleanRadioTitle = (title) => title.replace(/^42Radio\s*/, "").trim();

async function fetchNote() {
  const posts = [];
  for (let page = 1; page <= 4; page++) {
    const res = await fetch(
      `https://note.com/api/v2/creators/${NOTE_USER}/contents?kind=note&page=${page}`,
      { headers: { "user-agent": UA, accept: "application/json" } }
    );
    if (!res.ok) throw new Error(`note ${res.status}`);
    const json = await res.json();
    for (const c of json?.data?.contents ?? []) {
      if (c?.name && c?.noteUrl) posts.push({ title: c.name.replace(/\s+/g, " ").trim(), url: c.noteUrl, publishAt: c.publishAt });
    }
    const radio = posts.filter((p) => isRadio(p));
    const note = posts.filter((p) => !isRadio(p));
    if ((radio.length >= 3 && note.length >= 3) || json?.data?.isLastPage) break;
  }
  return {
    radio: posts.filter((p) => isRadio(p)).slice(0, 3).map((p) => ({ title: cleanRadioTitle(p.title), url: p.url })),
    note: posts.filter((p) => !isRadio(p)).slice(0, 3).map((p) => ({ title: p.title, url: p.url })),
  };
}

async function fetchStats() {
  const res = await fetch(JLEAGUE_PLAYER_URL, { headers: { "user-agent": UA, accept: "text/html" } });
  if (!res.ok) throw new Error(`jleague ${res.status}`);
  const html = (await res.text()).replace(/\\"/g, '"');
  const m = html.match(
    /"playerInfo":\{"numberOfAppearances":"?(\d+)"?,"goals":"?(\d+)"?,"assists":"?(\d+)"?/
  );
  if (!m) throw new Error("jleague stats not found");
  return { matches: Number(m[1]), goals: Number(m[2]), assists: Number(m[3]) };
}

const PODCAST_ID = "1887278282";

async function fetchPodcast() {
  const res = await fetch(
    `https://itunes.apple.com/lookup?id=${PODCAST_ID}&entity=podcastEpisode&country=jp&limit=10`,
    { headers: { "user-agent": UA, accept: "application/json" } }
  );
  if (!res.ok) throw new Error(`podcast ${res.status}`);
  const json = await res.json();
  const episodes = (json?.results ?? [])
    .filter((r) => r.wrapperType === "podcastEpisode" && r.trackName && r.trackViewUrl)
    .sort((a, b) => String(b.releaseDate).localeCompare(String(a.releaseDate)))
    .slice(0, 3)
    .map((r) => ({ title: r.trackName.replace(/\s+/g, " ").trim(), url: r.trackViewUrl.split("&uo=")[0] }));
  if (!episodes.length) throw new Error("podcast episodes not found");
  return episodes;
}

export default async () => {
  const [noteResult, statsResult, podcastResult] = await Promise.allSettled([
    fetchNote(),
    fetchStats(),
    fetchPodcast(),
  ]);
  const body = { updatedAt: new Date().toISOString() };
  if (noteResult.status === "fulfilled") Object.assign(body, noteResult.value);
  else body.noteError = String(noteResult.reason);
  if (statsResult.status === "fulfilled") body.stats = statsResult.value;
  else body.statsError = String(statsResult.reason);
  if (podcastResult.status === "fulfilled") body.podcast = podcastResult.value;
  else body.podcastError = String(podcastResult.reason);

  const ok = [noteResult, statsResult, podcastResult].every((r) => r.status === "fulfilled");
  return new Response(JSON.stringify(body), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "public, max-age=0, must-revalidate",
      // Cache on Netlify's CDN: 30 min when everything worked, 5 min otherwise.
      "netlify-cdn-cache-control": ok
        ? "public, s-maxage=1800, stale-while-revalidate=86400"
        : "public, s-maxage=300",
    },
  });
};

export const config = { path: "/api/latest" };
