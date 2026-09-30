// GET /api/latest -> { type: "album"|"track", id, url, title }
// Cloudflare Pages Function. Ходит на Bandcamp с сервера (из браузера нельзя: CORS) и кэширует на 1 час.
const BASE = "https://qumcl.bandcamp.com";
const HEADERS = { "User-Agent": "Mozilla/5.0 (compatible; qumcl-site)" };
const decode = (s) => s.replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");

export async function onRequestGet({ request, waitUntil }) {
  const cache = caches.default;
  const key = new Request(new URL("/api/latest", request.url).toString());
  const hit = await cache.match(key);
  if (hit) return hit;

  try {
    const list = await (await fetch(`${BASE}/music`, { headers: HEADERS })).text();
    const link = list.match(/href="(\/(?:album|track)\/[^"#?]+)"/);
    if (!link) throw new Error("no releases found");

    const url = BASE + link[1];
    const page = await (await fetch(url, { headers: HEADERS })).text();
    const type = page.match(/item_type(?:&quot;|")\s*:\s*(?:&quot;|")([at])/);
    const id = page.match(/item_id(?:&quot;|")\s*:\s*(\d+)/);
    const title = page.match(/property="og:title"\s+content="([^"]+)"/);
    if (!type || !id) throw new Error("no item id");

    const res = new Response(JSON.stringify({
      type: type[1] === "a" ? "album" : "track",
      id: Number(id[1]),
      url,
      title: title ? decode(title[1]).replace(/, by .*$/, "") : "",
    }), { headers: { "Content-Type": "application/json", "Cache-Control": "public, max-age=3600" } });
    waitUntil(cache.put(key, res.clone()));
    return res;
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 502, headers: { "Content-Type": "application/json" } });
  }
}
