const BASE = "https://qumcl.bandcamp.com";
const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Accept": "text/html,application/xhtml+xml",
  "Accept-Language": "en-US,en;q=0.9"
};

const KV_KEY = "latest_release";

// Декодирование HTML-сущностей (&amp; всегда последним, чтобы не было двойного декодирования)
const decode = (s) =>
  s
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");

const json = (data, status = 200, extra = {}) =>
  new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...extra
    }
  });

const absolute = (p) => (/^https?:\/\//.test(p) ? p : BASE + p);

// <title> страницы — нужен для диагностики (например, заглушка "Just a moment...")
function pageTitle(html) {
  const m = html.match(/<title[^>]*>([^<]*)<\/title>/i);
  return m ? decode(m[1]).trim() : "";
}

// og:title с любым порядком атрибутов
function extractTitle(page) {
  const m =
    page.match(/<meta[^>]+property="og:title"[^>]+content="([^"]+)"/) ||
    page.match(/<meta[^>]+content="([^"]+)"[^>]+property="og:title"/);

  if (!m) return "";

  const t = decode(m[1]);
  // Убираем ", by Артист" только в конце (последнее вхождение)
  const i = t.lastIndexOf(", by ");
  return i > -1 ? t.slice(0, i) : t;
}

// Достаём самый первый релиз из HTML страницы /music
function parseFirstRelease(list) {
  // Способ 1: JSON в атрибуте data-client-items (есть id, type, page_url, title)
  const m = list.match(/data-client-items="([^"]+)"/);
  if (m) {
    try {
      const items = JSON.parse(decode(m[1]));
      const first = Array.isArray(items) ? items[0] : null;

      if (first && first.page_url && first.id) {
        return {
          id: Number(first.id),
          type: String(first.type).startsWith("a") ? "album" : "track",
          url: absolute(first.page_url),
          title: first.title ? String(first.title) : ""
        };
      }
    } catch {
      // падаем на способ 2
    }
  }

  // Способ 2: первая ссылка на /album/... или /track/... (относительная или абсолютная)
  const link = list.match(
    /href=["'](?:https?:\/\/[^"'\/]*bandcamp\.com)?(\/(?:album|track)\/[^"'#?]+)["']/
  );
  if (link) {
    return { url: BASE + link[1] };
  }

  return null;
}

// Получить самый свежий релиз с Bandcamp.
// Если передан knownUrl и самый новый релиз имеет тот же URL — возвращает null
// (ничего нового; страницу релиза не скачиваем).
async function getLatestFromBandcamp(knownUrl) {
  const listResponse = await fetch(`${BASE}/music`, { headers: HEADERS });

  if (!listResponse.ok) {
    throw new Error(`Bandcamp /music returned ${listResponse.status}`);
  }

  const list = await listResponse.text();
  const found = parseFirstRelease(list);

  if (!found) {
    throw new Error(
      `No releases found in /music ` +
        `(title="${pageTitle(list)}", length=${list.length}, ` +
        `hasGrid=${list.includes("music-grid")}, ` +
        `hasClientItems=${list.includes("data-client-items")})`
    );
  }

  // Ссылка не изменилась — новых релизов нет
  if (knownUrl && found.url === knownUrl) {
    return null;
  }

  // Если уже есть всё нужное — страницу релиза скачивать не надо
  if (found.id && found.type && found.title) {
    return found;
  }

  // Иначе берём id/type/title со страницы самого релиза
  const pageResponse = await fetch(found.url, { headers: HEADERS });

  if (!pageResponse.ok) {
    throw new Error(`Bandcamp release page returned ${pageResponse.status}`);
  }

  const page = await pageResponse.text();

  const type = page.match(/item_type(?:&quot;|")\s*:\s*(?:&quot;|")([at])/);
  const id = page.match(/item_id(?:&quot;|")\s*:\s*(\d+)/);

  if (!type || !id) {
    throw new Error("Could not find release ID/type");
  }

  return {
    id: Number(id[1]),
    type: type[1] === "a" ? "album" : "track",
    url: found.url,
    title: extractTitle(page)
  };
}

// API для сайта: /api/latest
async function latest(request, env) {
  if (request.method !== "GET" && request.method !== "HEAD") {
    return json({ error: "Method not allowed" }, 405, { Allow: "GET, HEAD" });
  }

  const debug = new URL(request.url).searchParams.has("debug");

  try {
    // Сначала читаем уже сохранённый релиз из KV
    const stored = await env.qumcl_bandcamp.get(KV_KEY);

    if (stored) {
      return json(JSON.parse(stored), 200, {
        // Браузер и edge-кеш держат ответ 5 минут — KV не дёргается на каждый визит
        "Cache-Control": "public, max-age=300"
      });
    }

    // Если KV пока пустой — получаем первый релиз с Bandcamp
    // (без аргумента, поэтому null здесь не вернётся)
    const release = await getLatestFromBandcamp();

    await env.qumcl_bandcamp.put(KV_KEY, JSON.stringify(release));

    return json(release, 200, {
      "Cache-Control": "public, max-age=300"
    });
  } catch (e) {
    console.error("Latest release error:", String(e));

    // /api/latest?debug=1 показывает причину ошибки (удобно при настройке)
    return json(
      {
        error: "Failed to load latest release",
        ...(debug ? { detail: String(e) } : {})
      },
      502,
      { "Cache-Control": "no-store" }
    );
  }
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // API последнего релиза
    if (url.pathname === "/api/latest") {
      return latest(request, env);
    }

    // Всё остальное — обычная статика
    return env.ASSETS.fetch(request);
  },

  // Запускается по cron (раз в 15 минут)
  async scheduled(event, env, ctx) {
    try {
      // Что сейчас лежит в KV
      const stored = await env.qumcl_bandcamp.get(KV_KEY);
      const previous = stored ? JSON.parse(stored) : null;

      // Проверяем Bandcamp; null = ничего нового
      const release = await getLatestFromBandcamp(previous?.url);

      if (!release) {
        console.log("No new release.");
        return;
      }

      await env.qumcl_bandcamp.put(KV_KEY, JSON.stringify(release));

      console.log(`New release saved: ${release.title} (${release.type} ${release.id})`);
    } catch (e) {
      console.error("Bandcamp cron error:", String(e));
    }
  }
};
