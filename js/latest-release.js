// Заполняет бокс "latest — release" данными из /api/latest.
// Бокс скрыт (display:none в HTML), пока скрипт не отработает.
// Подключать с defer или в конце страницы.
(async () => {
  const box = document.getElementById("bc-box");
  const player = document.getElementById("bc-player");
  const caption = document.getElementById("bc-caption");
  if (!box || !player || !caption) return;

  const catalogLink = () => {
    const a = document.createElement("a");
    a.href = "https://qumcl.bandcamp.com/";
    a.textContent = "qumcl.bandcamp.com";
    return a;
  };

  try {
    const r = await fetch("/api/latest");
    if (!r.ok) throw new Error(`API returned ${r.status}`);

    const { id, type, title } = await r.json();
    if (!id || !type) throw new Error("Bad data");

    player.src =
      `https://bandcamp.com/EmbeddedPlayer/${type}=${id}` +
      `/size=large/bgcol=f4f1ea/linkcol=b87400/tracklist=false/artwork=small/transparent=true/`;

    caption.textContent = title ? `${title} — full catalog on ` : "full catalog on ";
    caption.append(catalogLink());
  } catch (e) {
    // API недоступен: плеер не показываем, оставляем только ссылку на каталог
    player.style.display = "none";
    caption.textContent = "full catalog on ";
    caption.append(catalogLink());
  }

  box.style.display = "";
})();
