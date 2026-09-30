const list = document.getElementById("releases");
const count = document.getElementById("release-count");
const player = document.getElementById("bc-player");

// плеер Bandcamp: цвета под текущую тему (в самой ссылке они зашиты)
const PLAYER = {
  light: "bgcol=f4f1ea/linkcol=b87400",
  dark: "bgcol=0a0a0a/linkcol=ffb000",
};
function syncPlayer() {
  if (!player) return;
  const key = document.documentElement.dataset.theme === "dark" ? "dark" : "light";
  const next = player.src.replace(/bgcol=\w+\/linkcol=\w+/, PLAYER[key]);
  if (next !== player.src) player.src = next;
}
syncPlayer();
new MutationObserver(syncPlayer).observe(document.documentElement, {
  attributes: true,
  attributeFilter: ["data-theme"],
});

function makeItem(r) {
  const li = document.createElement("li");

  const idx = document.createElement("div");
  idx.className = "idx";
  idx.textContent = r.cat;

  const wrap = document.createElement("div");
  const title = document.createElement("div");
  title.className = "entry-title";
  if (r.bandcamp) {
    const a = document.createElement("a");
    a.href = r.bandcamp;
    a.target = "_blank";
    a.rel = "noopener";
    a.textContent = r.title;
    title.appendChild(a);
  } else {
    title.textContent = r.title;
  }

  const note = document.createElement("div");
  note.className = "entry-note";
  const extra = [r.note, r.bandcamp ? "" : "not on bandcamp"].filter(Boolean);
  note.textContent = [r.artist, r.year, ...extra].join(" · ");

  wrap.append(title, note);
  li.append(idx, wrap);
  return li;
}

function makeDivider(text) {
  const li = document.createElement("li");
  li.className = "entries-divider";
  li.textContent = text;
  return li;
}

async function loadReleases() {
  if (!list) return;
  try {
    const res = await fetch("/js/json/releases.json");
    const releases = await res.json();

    const isCat = (r) => /^XQ\d+$/.test(r.cat);
    // каталог лейбла: новые сверху по номеру XQ....
    const catalogued = releases.filter(isCat).sort((a, b) => b.cat.localeCompare(a.cat));
    // без каталога (XQ??????): новые сверху по дате
    const other = releases
      .filter((r) => !isCat(r))
      .sort((a, b) => (b.date || b.year).localeCompare(a.date || a.year));

    if (count) count.textContent = `(${releases.length})`;

    const frag = document.createDocumentFragment();
    catalogued.forEach((r) => frag.appendChild(makeItem(r)));
    if (other.length) {
      frag.appendChild(makeDivider(`// no label catalog number — ${other.length}`));
      other.forEach((r) => frag.appendChild(makeItem(r)));
    }
    list.replaceChildren(frag);
  } catch (err) {
    console.error("releases.json:", err);
    list.innerHTML = '<li class="loading-text">Error loading releases</li>';
  }
}
loadReleases();

// последний релиз: /api/latest (Cloudflare Function). Если её нет (локально) — остаётся id из HTML.
async function loadLatest() {
  if (!player) return;
  try {
    const res = await fetch("/api/latest");
    if (!res.ok) return;
    const d = await res.json();
    if (!d.id) return;
    player.src = player.src.replace(/(album|track)=\d+/, `${d.type}=${d.id}`);
    const cap = document.getElementById("bc-caption");
    if (cap && d.title) {
      const a = document.createElement("a");
      a.href = "https://qumcl.bandcamp.com/";
      a.textContent = "qumcl.bandcamp.com";
      cap.replaceChildren(document.createTextNode(`${d.title} — full catalog on `), a);
    }
  } catch (e) { /* остаёмся на запасном плеере */ }
}
loadLatest();
