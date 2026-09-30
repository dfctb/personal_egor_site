const container = document.getElementById("video-container");
const yearFilter = document.getElementById("year-filter");
const sortBtn = document.getElementById("sort-btn");
const player = document.getElementById("yt-player");
const caption = document.getElementById("yt-caption");
const count = document.getElementById("video-count");

let videos = [];
let ascending = false;

const embedUrl = (id, autoplay) =>
  `https://www.youtube-nocookie.com/embed/${id}?rel=0${autoplay ? "&autoplay=1" : ""}`;

function setPlayer(v, autoplay) {
  player.src = embedUrl(v.id, autoplay);
  caption.textContent = `${v.title} — ${v.dateStr}`;
}

async function loadVideos() {
  try {
    const raw = await (await fetch("/js/json/videos.json")).json();
    videos = raw.map((v) => ({
      ...v,
      year: v.date ? v.date.slice(0, 4) : "Unknown",
      dateStr: v.date ? v.date.split("-").reverse().join(".") : "Unknown date",
    }));

    if (!videos.length) {
      container.innerHTML = '<li class="loading-text">No videos yet — run dev-tools/generate-videos-db.js</li>';
      return;
    }

    // самое новое видео — в плеер сверху
    const newest = [...videos].sort((a, b) => (b.date || "").localeCompare(a.date || ""))[0];
    setPlayer(newest, false);
    if (count) count.textContent = `(${videos.length})`;

    [...new Set(videos.map((v) => v.year))]
      .filter((y) => y !== "Unknown")
      .sort((a, b) => b - a)
      .forEach((y) => yearFilter.append(new Option(y, y)));

    render();
  } catch (err) {
    console.error("videos.json:", err);
    container.innerHTML = '<li class="loading-text">Error loading videos</li>';
  }
}

function render() {
  const year = yearFilter.value;
  const list = videos
    .filter((v) => year === "all" || v.year === year)
    .sort((a, b) => {
      const c = (a.date || "").localeCompare(b.date || "");
      return ascending ? c : -c;
    });

  if (!list.length) {
    container.innerHTML = '<li class="loading-text">No videos found</li>';
    return;
  }

  const frag = document.createDocumentFragment();
  for (const v of list) {
    const li = document.createElement("li");
    li.className = "art-item video-item";
    li.tabIndex = 0;

    const img = document.createElement("img");
    img.className = "art-image";
    img.loading = "lazy";
    img.alt = v.title;
    img.src = `https://i.ytimg.com/vi/${v.id}/mqdefault.jpg`;

    const t = document.createElement("div");
    t.className = "video-title";
    t.textContent = v.title;

    const d = document.createElement("span");
    d.className = "date-label";
    d.textContent = v.dateStr;

    li.append(img, t, d);
    const play = () => {
      setPlayer(v, true);
      player.scrollIntoView({ behavior: "smooth", block: "center" });
    };
    li.addEventListener("click", play);
    li.addEventListener("keydown", (e) => { if (e.key === "Enter") play(); });
    frag.appendChild(li);
  }
  container.replaceChildren(frag);
}

yearFilter.addEventListener("change", () => { yearFilter.blur(); render(); });
sortBtn.addEventListener("click", () => {
  ascending = !ascending;
  sortBtn.textContent = ascending ? "Sort: Oldest first ▲" : "Sort: Newest first ▼";
  sortBtn.blur();
  render();
});

loadVideos();
