// Собирает js/json/videos.json со всех публичных видео канала.
// Нужен yt-dlp:  pip install -U yt-dlp
//
// Запуск из корня проекта:
//   node dev-tools/generate-videos-db.js            быстрый режим, без куки (даты приблизительные)
//   node dev-tools/generate-videos-db.js firefox    точные даты, куки из браузера (firefox | chrome | edge)
const { spawnSync } = require("child_process");
const fs = require("fs");

const CHANNEL = "https://www.youtube.com/@sunymoia/videos";
const browser = process.argv[2];

const args = ["--skip-download", "--ignore-errors", "--no-warnings"];
if (browser) {
  args.push("--cookies-from-browser", browser, "--print", "%(id)s\t%(upload_date>%Y-%m-%d)s\t%(title)s");
} else {
  args.push("--flat-playlist", "--extractor-args", "youtubetab:approximate_date",
            "--print", "%(id)s\t%(timestamp>%Y-%m-%d)s\t%(title)s");
}
args.push(CHANNEL);

const res = spawnSync("yt-dlp", args, { encoding: "utf8", maxBuffer: 1 << 28 });
if (res.error) {
  console.error("yt-dlp не найден. Установи: pip install -U yt-dlp");
  process.exit(1);
}

const seen = new Set();
const videos = res.stdout
  .split(/\r?\n/)
  .map((l) => l.split("\t"))
  .filter((p) => p.length >= 3 && /^[\w-]{11}$/.test(p[0]) && !seen.has(p[0]) && seen.add(p[0]))
  .map(([id, d, ...t]) => ({
    id,
    title: t.join("\t"),
    date: /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : "",
  }))
  .sort((a, b) => b.date.localeCompare(a.date));

if (!videos.length) {
  console.error("Ничего не получено. Первые строки ошибки:\n" + (res.stderr || "").slice(0, 600));
  process.exit(1);
}

fs.writeFileSync("js/json/videos.json", JSON.stringify(videos, null, 1));
console.log(`videos.json: ${videos.length} videos, без даты: ${videos.filter((v) => !v.date).length}`);
