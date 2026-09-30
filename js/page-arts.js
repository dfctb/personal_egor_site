let artsData = [];
let sortAscending = false; // false = сначала новые (по умолчанию)

// Находим элементы интерфейса
const container = document.getElementById("art-container");
const yearFilter = document.getElementById("year-filter");
const sortBtn = document.getElementById("sort-btn");

// Переменные для Лайтбокса (убедитесь, что эти ID есть в вашем HTML для лайтбокса)
const lightboxOverlay = document.getElementById("lightbox-overlay");
const lightboxImage = document.getElementById("lightbox-image");
const closeBtn = document.getElementById("lightbox-close");

// Достаём дату из имени файла вида "19122024.png" → день 19, месяц 12, год 2024
function extractDateFromFilename(filename) {
  if (!filename) return null;
  const match = filename.match(/(\d{2})(\d{2})(\d{4})/);
  if (!match) return null;

  const [, day, month, year] = match;
  return new Date(Number(year), Number(month) - 1, Number(day));
}

// Загрузка данных
async function loadArtsData() {
  try {
    const response = await fetch("/js/json/arts-data.json");
    const rawData = await response.json();

    // ОПТИМИЗАЦИЯ: Парсим даты один раз при загрузке и сохраняем прямо в объект
    artsData = rawData.map(art => {
      const parsedDate = extractDateFromFilename(art.filename);
      return {
        ...art,
        parsedDate: parsedDate,
        yearStr: parsedDate ? parsedDate.getFullYear().toString() : "Unknown",
        dateStr: parsedDate
          ? `${String(parsedDate.getDate()).padStart(2, "0")}.${String(parsedDate.getMonth() + 1).padStart(2, "0")}.${parsedDate.getFullYear()}`
          : "Unknown Date"
      };
    });

    populateYearFilter();
    applyFiltersAndSort();
  } catch (error) {
    console.error("Ошибка загрузки arts-data.json:", error);
    if (container) {
      container.innerHTML = '<li class="loading-text">Error: Run dev-tools/generate-arts-db.js</li>';
    }
  }
}

// Автоматическое заполнение фильтра годов на основе закэшированных данных
function populateYearFilter() {
  if (!yearFilter) return;

  // ОПТИМИЗАЦИЯ: Просто берем уже готовые строки годов из объектов
  const years = [
    ...new Set(artsData.map(art => art.yearStr))
  ]
    .filter((y) => y !== "Unknown")
    .sort((a, b) => b - a); // Сортируем годы по убыванию

  years.forEach((year) => {
    const option = document.createElement("option");
    option.value = year;
    option.textContent = year;
    yearFilter.appendChild(option);
  });
}

// Быстрая фильтрация и сортировка
function applyFiltersAndSort() {
  if (!yearFilter || !container) return;
  const selectedYear = yearFilter.value;

  // ОПТИМИЗАЦИЯ: Фильтруем по уже готовой строке года
  let filtered = artsData.filter((art) => {
    return selectedYear === "all" || art.yearStr === selectedYear;
  });

  // ОПТИМИЗАЦИЯ: Сортируем по готовым объектам Date, без повторного парсинга строк
  filtered.sort((a, b) => {
    const dateA = a.parsedDate || new Date(0);
    const dateB = b.parsedDate || new Date(0);
    return sortAscending ? dateA - dateB : dateB - dateA;
  });

  renderArts(filtered);
}

// Рендеринг списка в стиле вашего терминала
function renderArts(artsToRender) {
  if (!container) return;
  container.innerHTML = "";

  if (artsToRender.length === 0) {
    container.innerHTML = '<li class="loading-text">No arts found</li>';
    return;
  }

  // Используем фрагмент документа для ускорения отрисовки большого количества элементов
  const fragment = document.createDocumentFragment();

  artsToRender.forEach((art, index) => {
    const item = document.createElement("li"); // Используем <li>, так как в CSS у вас `.entries li`
    item.className = "art-item";
    item.dataset.year = art.yearStr;

    // Индекс в стиле DOS/Ретро терминала, [02]...
    const displayIndex = String(index + 1).padStart(2, '0');

    // art.src берется из вашего JSON. Если там только filename, можно заменить на `../assets/images/arts/${art.filename}`
    const fullSrc = art.src || `/assets/images/arts/${art.filename}`;
    const thumbSrc = `/assets/images/arts/thumbs/${art.filename.replace(/\.\w+$/, ".webp")}`;

    item.innerHTML = `
        <span class="idx">[${displayIndex}]</span>
        <div class="entry-content">
          <img src="${thumbSrc}" data-full="${fullSrc}" alt="${art.title || 'Art'}" class="art-image" loading="lazy">
          <span class="date-label">Date: ${art.dateStr}</span>
        </div>
    `;

    fragment.appendChild(item);
  });

  container.appendChild(fragment);
}

// === Event Listeners ===

if (yearFilter) {
  yearFilter.addEventListener("change", () => {
    yearFilter.blur();
    applyFiltersAndSort();
  });
}

if (sortBtn) {
  sortBtn.addEventListener("click", () => {
    sortAscending = !sortAscending;
    sortBtn.textContent = sortAscending
      ? "Sort: Oldest first ▲"
      : "Sort: Newest first ▼";

    sortBtn.blur();
    applyFiltersAndSort();
  });
}

// Лайтбокс (Проверяем существование элементов, чтобы код не падал, если лайтбокса нет на странице)
if (container && lightboxOverlay && lightboxImage) {
  container.addEventListener("click", (e) => {
    if (e.target.classList.contains("art-image")) {
      lightboxImage.src = e.target.dataset.full;
      lightboxOverlay.classList.remove("lightbox-hidden");

      requestAnimationFrame(() => {
        lightboxOverlay.classList.add("lightbox-active");
      });
      document.body.style.overflow = "hidden";
    }
  });

  const closeLightbox = () => {
    lightboxOverlay.classList.remove("lightbox-active");

    setTimeout(() => {
      lightboxOverlay.classList.add("lightbox-hidden");
      document.body.style.overflow = "";
      lightboxImage.src = "";
    }, 300);
  };

  if (closeBtn) closeBtn.addEventListener("click", closeLightbox);
  lightboxOverlay.addEventListener("click", (e) => {
    if (e.target === lightboxOverlay) closeLightbox();
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !lightboxOverlay.classList.contains("lightbox-hidden")) {
      closeLightbox();
    }
  });

  lightboxImage.addEventListener("dragstart", (e) => e.preventDefault());
}

// Старт
loadArtsData();
