// Cloudflare Worker: обслуживает только /api/*, всё остальное отдаётся как статика из public/.
const BASE = "https://qumcl.bandcamp.com";
const HEADERS = { "User-Agent": "Mozilla/5.0 (compatible; qumcl-site)" };
const decode = (s) => s.replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
const json = (data, status = 200, extra = {}) =>
  new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json", ...extra } });

// GET /api/latest -> { type: "album"|"track", id, url, title }, кэш 1 час
async function latest(request, ctx) {
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

    const res = json(
      {
        type: type[1] === "a" ? "album" : "track",
        id: Number(id[1]),
        url,
        title: title ? decode(title[1]).replace(/, by .*$/, "") : "",
      },
      200,
      { "Cache-Control": "public, max-age=3600" }
    );
    ctx.waitUntil(cache.put(key, res.clone()));
    return res;
  } catch (e) {
    return json({ error: String(e) }, 502);
  }
}

export default {
  async fetch(request, env, ctx) {
    const { pathname } = new URL(request.url);
    if (pathname === "/api/latest") return latest(request, ctx);
    return env.ASSETS.fetch(request);
  },
};
