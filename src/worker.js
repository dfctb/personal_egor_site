const BASE = "https://qumcl.bandcamp.com";
const HEADERS = {
  "User-Agent": "Mozilla/5.0 (compatible; qumcl-site)"
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

// Получить самый свежий релиз с Bandcamp.
// Если передан knownUrl и самый новый релиз на Bandcamp имеет тот же URL,
// возвращает null (ничего нового, страницу релиза не скачиваем).
async function getLatestFromBandcamp(knownUrl) {
  const listResponse = await fetch(`${BASE}/music`, {
    headers: HEADERS
  });

  if (!listResponse.ok) {
    throw new Error(`Bandcamp /music returned ${listResponse.status}`);
  }

  const list = await listResponse.text();

  // Первый album/track в /music считаем самым новым
  const link = list.match(/href="(\/(?:album|track)\/[^"#?]+)"/);

  if (!link) {
    throw new Error("No releases found");
  }

  const url = BASE + link[1];

  // Ссылка не изменилась — новых релизов нет
  if (knownUrl && url === knownUrl) {
    return null;
  }

  const pageResponse = await fetch(url, {
    headers: HEADERS
  });

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
    url,
    title: extractTitle(page)
  };
}

// API для сайта: /api/latest
async function latest(request, env) {
  if (request.method !== "GET" && request.method !== "HEAD") {
    return json({ error: "Method not allowed" }, 405, { Allow: "GET, HEAD" });
  }

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
    return json({ error: "Failed to load latest release" }, 502, {
      "Cache-Control": "no-store"
    });
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

      // Подстраховка: тот же тип и id — значит, просто сменился адрес, но это тот же релиз
      // (всё равно обновляем запись, чтобы url был актуальным)
      await env.qumcl_bandcamp.put(KV_KEY, JSON.stringify(release));

      console.log(`New release saved: ${release.title} (${release.type} ${release.id})`);
    } catch (e) {
      console.error("Bandcamp cron error:", String(e));
    }
  }
};
